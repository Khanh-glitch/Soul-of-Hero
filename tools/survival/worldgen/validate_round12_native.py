#!/usr/bin/env python3
"""Validate the completed Round 12 native report without upgrading its scope."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
from collections import Counter

from estimate_round12_native_budget import planned_journey_labels, planned_work


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_size(path: Path) -> list[int]:
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError(f"not a PNG: {path}")
    return list(struct.unpack(">II", header[16:24]))


def validate(report: dict, inputs: dict, budget: dict | None = None) -> dict:
    checks: list[dict] = []

    def check(name: str, condition: bool, detail=None) -> None:
        checks.append({"name": name, "ok": bool(condition), "detail": detail})

    check("completed_native_ok", report.get("ok") is True and not report.get("abort") and not report.get("budget_probe"))
    dispositions = report.get("dispositions", {})
    check("independent_dispositions", dispositions.get("SOURCE_READY") == "PASS"
          and dispositions.get("NATIVE_FIXTURE_PASS") == "PASS"
          and all(dispositions.get(key) == "NOT_TESTED" for key in
                  ["PRODUCTION_MOUNTED", "PLAYER_PLAYABLE", "VISUALLY_ACCEPTED"]), dispositions)
    compatibility = report.get("source_report", {}).get("runtime_compatibility", {})
    observed = compatibility.get("observed_sha256", {})
    expected_observations = inputs.get("runtime_interfaces", {}).get("observed_paths", {})
    check("semantic_runtime_interfaces", compatibility.get("ok") is True
          and compatibility.get("policy") == "SEMANTIC_INTERFACE_NOT_MUTABLE_BYTE_IDENTITY"
          and set(compatibility.get("interfaces", {})) == {"player", "LEGACY_CONTROLLER", "LEGACY_TRAVERSABILITY", "LEGACY_WORLD"}
          and compatibility.get("interfaces", {}).get("player", {}).get("identity_policy") == "PHYSICAL_INTERFACE_ONLY_NO_VISUAL_OR_SCRIPT_IDENTITY"
          and set(observed) == set(expected_observations)
          and all(row.get("path") == expected_observations.get(key) and len(str(row.get("sha256", ""))) == 64
                  for key, row in observed.items())
          and report.get("runtime_observed_sha256") == observed, compatibility)
    pinned_paths = {row.get("path") for row in report.get("source_hash_manifest", {}).values()}
    check("mutable_runtime_not_byte_pinned", pinned_paths.isdisjoint(expected_observations.values()))
    expected_refusals = {
        "plan_identity": "runtime_plan_hash", "chunk_integrity": "source_chunk_hash",
        "a8_source_identity": "dependency_hash:a8_quarry",
        "legacy_tile_art_integrity": "dependency_hash:legacy_tiles_texture",
        "spawn_index_semantics": "spawn_cells_hash", "spawn_index_binding": "spawn_index_stale",
        "player_shape_interface": "runtime_interface:PLAYER_BODY_SHAPE_SIZE",
        "legacy_world_interface": "runtime_interface:LEGACY_WORLD_METHOD_IS_WALKABLE",
    }
    controls = {row.get("id"): row for row in report.get("runtime_negative_controls", [])}
    check("named_integrity_and_interface_refusals", set(controls) == set(expected_refusals)
          and all(row.get("pass") and row.get("refused") and row.get("actual_error") == expected_refusals[key]
                  for key, row in controls.items()), controls)
    spawn_path = Path(str(inputs["spawn_index_path"]).replace("res://", "", 1))
    contract_path = Path(str(inputs["source_contract"]).replace("res://", "", 1))
    plan_path = Path("data/survival/world/world_plan.v1.json")
    spawn = json.loads(spawn_path.read_text())
    contract = json.loads(contract_path.read_text())
    plan = json.loads(plan_path.read_text())
    spawn_binding = (
        sha(spawn_path) == inputs["spawn_index_sha256"]
        and spawn["world_plan_sha256"] == inputs["world_plan_sha256"] == sha(plan_path)
        and spawn["runtime_contract_sha256"] == inputs["source_contract_sha256"] == sha(contract_path)
        and spawn["world_id"] == plan["world_id"] and spawn["frame"] == inputs["world_extents_cells"][2:]
        and spawn["chunk_cells"] == inputs["chunk_cells"]
        and spawn["algorithm"] == contract["spawn_policy"]["algorithm"]
        and spawn["criteria"] == contract["spawn_policy"] and spawn["production_spawn_approval"] is False
    )
    spawn_cells_ok = spawn["candidate_chunks"] == len(spawn["chunks"])
    region_totals: Counter[str] = Counter()
    for chunk in spawn["chunks"]:
        cells = chunk["cells"]
        canonical = json.dumps(cells, separators=(",", ":")).encode()
        spawn_cells_ok = spawn_cells_ok and chunk["candidate_count"] == len(cells)
        spawn_cells_ok = spawn_cells_ok and hashlib.sha256(canonical).hexdigest() == chunk["cells_sha256"]
        spawn_cells_ok = spawn_cells_ok and cells == sorted(set(cells))
        region_totals.update(chunk["region_counts"])
        spawn_cells_ok = spawn_cells_ok and sum(chunk["region_counts"].values()) == len(cells)
    spawn_cells_ok = spawn_cells_ok and dict(region_totals) == spawn["region_counts"]
    spawn_cells_ok = spawn_cells_ok and sum(spawn["region_counts"].values()) == spawn["candidate_cells"]
    spawn_cells_ok = spawn_cells_ok and report.get("source_report", {}).get("spawn_region_counts") == spawn["region_counts"]
    check("spawn_binding_hashes_policy_and_region_accounting", spawn_binding and spawn_cells_ok, {
        "binding": spawn_binding, "cells_and_regions": spawn_cells_ok,
        "candidate_cells": spawn["candidate_cells"], "candidate_chunks": spawn["candidate_chunks"]})
    version = str(report.get("godot_version", {}))
    check("exact_godot_47", "5b4e0cb0f" in version, version)
    check("assertion_count", int(report.get("checks", 0)) >= 220, report.get("checks"))
    spawns = report.get("spawn_results", [])
    check("broad_spawn_matrix", len(spawns) == 36 and sum(bool(x["native_drive"]) for x in spawns) == 12
          and all(x["clear"] and x["forward_ok"] and x["return_ok"] for x in spawns))
    check("three_exact_a8_arrivals", len(report.get("site_arrivals", [])) == 3
          and all(not x["interior_entered"] and not x["production_scene_mounted"] for x in report["site_arrivals"]))
    check("roadside_source_no_reward", bool(report.get("roadside_salvage"))
          and report["roadside_salvage"].get("reward_items_granted") == 0
          and not report["roadside_salvage"].get("interaction_executed"))
    expected_journeys = planned_journey_labels(inputs)
    actual_journeys = [str(row.get("label", "")) for row in report.get("journeys", [])]
    missing_journeys = list((Counter(expected_journeys) - Counter(actual_journeys)).elements())
    unexpected_journeys = list((Counter(actual_journeys) - Counter(expected_journeys)).elements())
    check("driven_segment_count", Counter(actual_journeys) == Counter(expected_journeys)
          and all(row.get("ok") and not row.get("production_mount") for row in report.get("journeys", [])),
          {"actual": len(actual_journeys), "expected": len(expected_journeys),
           "missing": missing_journeys, "unexpected": unexpected_journeys})
    check("no_unexpected_motion_or_stream_defects", not report.get("unexpected_contacts")
          and not report.get("stream_violations") and not report.get("teleport_violations")
          and float(report.get("max_hero_step_px", 999)) <= 20.0)
    dynamic = report.get("dynamic", {})
    check("dynamic_baseline_block_reload_detour", dynamic.get("baseline_ok") and dynamic.get("detour_ok")
          and int(dynamic.get("expected_block_contacts", 0)) > 0
          and int(dynamic.get("initial_expected_block_contacts", 0)) > 0
          and int(dynamic.get("reloaded_expected_block_contacts", 0)) > 0
          and int(dynamic.get("reload_generation", 0)) >= 1
          and not dynamic.get("save_service_used") and not dynamic.get("paid_construction_approved"), dynamic)
    check("two_hazard_retreats", len(report.get("hazards", [])) == 2
          and all(x["forward_ok"] and x["retreat_ok"] and not x["damage_applied"] for x in report["hazards"]))
    asymmetry = report.get("geography_asymmetry", {})
    regional_materials = asymmetry.get("regional_materials", {})
    material_signatures = {tuple(sorted(row)) for row in regional_materials.values()}
    check("asymmetric_geography", len(set(asymmetry.get("climate_channels", []))) == 11
          and len(regional_materials) == 11 and len(material_signatures) == 11
          and asymmetry.get("material_signature_count") == 11
          and len(set(asymmetry.get("surface_ids", []))) >= 8
          and len(set(asymmetry.get("planning_effort_per_cell_rates", []))) >= 4
          and asymmetry.get("application_status") == "A1_SOURCE_QUERY_ONLY_NO_A0_SPEED_A3_COST_OR_DAMAGE", asymmetry)
    evaluation = report.get("journey_evaluation", {})
    check("geographic_journey_ids", set(evaluation) == {"J01", "J03", "J04", "J06", "J07", "J12"}, sorted(evaluation))
    j01 = evaluation.get("J01", {})
    check("journey_J01_geographic_scope", j01.get("native_cases") == 36 and j01.get("physical_road_returns") == 12
          and j01.get("explore_first_primary_executed") and j01.get("home_first_player_value_tested") is False, j01)
    j03 = evaluation.get("J03", {})
    check("journey_J03_geographic_scope", bool(j03.get("locked_poi_discoveries"))
          and j03.get("site_arrivals") == report.get("site_arrivals") and len(j03.get("route_options", [])) == 3
          and all(row.get("compiled_alternative_count") == 3 for row in j03.get("route_options", []))
          and j03.get("activation_or_power_tested") is False, j03)
    j04 = evaluation.get("J04", {})
    check("journey_J04_geographic_scope", j04.get("rows") == report.get("hazards") and len(j04.get("rows", [])) == 2
          and j04.get("site_arrivals") == report.get("site_arrivals") and bool(j04.get("salvage")), j04)
    j06 = evaluation.get("J06", {})
    logistics = j06.get("rows", [])
    check("journey_J06_geographic_scope", logistics == inputs.get("logistics")
          and any(float(row.get("repeat_roundtrip_seconds_saved", 0)) > 0 for row in logistics)
          and any(float(row.get("repeat_roundtrip_seconds_saved", 0)) < 0 for row in logistics)
          and j06.get("activation_or_carrying_tested") is False, j06)
    j07_routes = evaluation.get("J07", {}).get("routes", {})
    check("journey_J07_geographic_scope", set(j07_routes) == {"quarry", "orchard", "mill"}
          and all(len(j07_routes[key]) == 3 for key in j07_routes), list(j07_routes))
    j12 = evaluation.get("J12", {})
    check("journey_J12_geographic_scope", len(j12.get("options", [])) == 3
          and all(row.get("non_dungeon_outer_site_option") and not row.get("productive_reward_tested")
                  for row in j12.get("options", []))
          and j12.get("dynamic") == dynamic and j12.get("productive_sessions_tested") is False
          and j12.get("dungeon_preparation_tested") is False, j12)
    work = planned_work(inputs)
    captures = report.get("captures", [])
    check("capture_count", len(captures) == work["captures"], {"actual": len(captures), "expected": work["captures"]})
    regions = {row.get("region_id") for row in captures if row.get("view_id")}
    resolutions = {tuple(row["resolution"]) for row in captures}
    check("all_regions_and_resolutions", len(regions) == 11 and resolutions == {(1280, 720), (2560, 1440), (3840, 2160)},
          {"regions": sorted(regions), "resolutions": sorted(resolutions)})
    planned_regions = {view["region_id"] for view in inputs["visual_views"]}
    check("every_capture_has_valid_region", all(row.get("region_id") in planned_regions for row in captures))
    nonvisual = [row for row in captures if not row.get("view_id")]
    phase_counts = Counter(row.get("phase") for row in nonvisual)
    check("nonvisual_phase_matrix", len(nonvisual) == 10 and phase_counts == {
        "primary_no_teleport_J04_J07": 9, "dynamic_structure_and_J12": 1}, dict(phase_counts))
    for view in inputs["visual_views"]:
        expected_resolutions = {(1280, 720), (2560, 1440), (3840, 2160)} if view["full_resolution"] else {(1280, 720)}
        actual = {tuple(row["resolution"]) for row in captures if row.get("view_id") == view["view_id"]}
        check("view_resolution_matrix:" + view["view_id"], actual == expected_resolutions,
              {"actual": sorted(actual), "expected": sorted(expected_resolutions)})
    capture_root = Path(report["_report_dir"])
    by_view_resolution = {}
    for row in captures:
        path = Path(row["path"])
        if not path.is_absolute():
            path = capture_root / path
        elif not path.is_file():
            # Actions reports contain runner-absolute paths. Mirrored evidence
            # remains verifiable beside the report without changing its hashes.
            path = capture_root / path.name
        try:
            actual_size = png_size(path)
            actual_hash = sha(path)
        except (OSError, ValueError):
            actual_size, actual_hash = [], ""
        # This rejects solid/two-tone blank frames only; palette richness and
        # composition remain a separate human visual-acceptance gate.
        check("capture_bytes:" + path.name, actual_size == row["resolution"] and actual_hash == row["sha256"]
              and int(row.get("sample_unique_colors", 0)) >= 3 and float(row.get("sample_luminance_range", 0)) > 0.03
              and not set(path.name).intersection('<>:"/\\|?*')
              and bool(row.get("live_source_chunk_hashes")) and not row.get("production_frame"))
        if row.get("view_id"):
            by_view_resolution[(row["view_id"], tuple(row["resolution"]))] = row
    pairs = 0
    for view in inputs["visual_views"]:
        if "pair_of" not in view:
            continue
        for resolution in [(1280, 720), (2560, 1440), (3840, 2160)]:
            night = by_view_resolution.get((view["view_id"], resolution))
            day = by_view_resolution.get((view["pair_of"], resolution))
            check(f"day_night_pair:{view['pair_of']}:{resolution[0]}", night and day
                  and night["center_cell"] == day["center_cell"] and night["sha256"] != day["sha256"])
            pairs += 1
    check("nine_day_night_pairs", pairs == 9)
    if budget is not None:
        check("measured_budget_used", budget.get("ok") and budget.get("native_fixture_evidence") is False
              and float(report.get("elapsed_seconds", 1e9)) <= int(budget["timeout_seconds"]),
              {"elapsed": report.get("elapsed_seconds"), "timeout": budget.get("timeout_seconds")})
    failures = [row for row in checks if not row["ok"]]
    return {
        "schema": "soh.world.a1_round12_native_validation.v1", "ok": not failures,
        "checks": len(checks), "failures": failures,
        "capture_count": len(captures), "driven_segments": len(report.get("journeys", [])),
        "production_mounted": "NOT_TESTED", "player_playable": "NOT_TESTED", "visually_accepted": "NOT_TESTED",
        "scope": "NATIVE_REPORT_ORACLE_NOT_INDEPENDENT_VISUAL_OR_PLAYER_ACCEPTANCE",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--inputs", type=Path, required=True)
    parser.add_argument("--budget", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    report["_report_dir"] = str(args.report.resolve().parent)
    result = validate(report, json.loads(args.inputs.read_text()),
                      json.loads(args.budget.read_text()) if args.budget else None)
    output = json.dumps(result, indent=2, sort_keys=True)
    print(output)
    if args.out:
        args.out.write_text(output + "\n")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
