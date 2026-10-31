#!/usr/bin/env python3
"""Independently validate the exact-head R13 native seam report and PNG bytes."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct


RESOLUTIONS = ([1280, 720], [2560, 1440], [3840, 2160])
VIEWS = ("quarry_day", "quarry_night", "orchard_day", "orchard_night", "region_transition")
NEGATIVES = {
    "negative_coordinates": "WORLD_BOUNDS",
    "unloaded_cell": "CHUNK_NOT_ACQUIRED",
    "forbidden_building": "a1_no_build_candidate",
    "unsafe_spawn": "SPAWN_CELL_UNSAFE",
    "stale_source_hash": "interface_source_hash:world_plan",
    "incompatible_body_shape": "reader:runtime_interface:PLAYER_BODY_SHAPE_SIZE",
    "blocked_terrain": "PHYSICALLY_REFUSED",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_size(path: Path) -> list[int]:
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError(f"not a PNG: {path}")
    return list(struct.unpack(">II", header[16:24]))


def validate(report: dict, manifest: dict, project: Path, require_d051_art: bool) -> list[dict]:
    checks: list[dict] = []

    def check(name: str, condition: bool, detail=None) -> None:
        checks.append({"name": name, "ok": bool(condition), "detail": detail})

    check("completed_native_ok", report.get("ok") is True and not report.get("abort"), report.get("failures"))
    check("input_bootstrap_before_body", report.get("input_bootstrap_initialized") is True)
    check("consumer_sample_executed", report.get("consumer_sample_used") is True
          and report.get("consumer_sample_path") == "res://game/survival/world/a1_continent_consumer_sample.gd")
    check("exact_godot_47", "5b4e0cb0f" in str(report.get("godot_version", {})), report.get("godot_version"))
    check("assertion_count", int(report.get("checks", 0)) >= 100, report.get("checks"))
    check("source_interface_ready", report.get("source_report", {}).get("ok") is True
          and report["source_report"].get("interface_ready") is True
          and report["source_report"].get("verified_chunks") == 192)
    check("manifest_binding", report.get("interface_manifest_sha256") == sha(project / "data/survival/world/a1_continent_interface.v1.json")
          == hashlib.sha256(json.dumps(manifest, indent=2, sort_keys=True).encode() + b"\n").hexdigest())
    for key, pin in manifest["source_pins"].items():
        check(f"source_pin_{key}", sha(project / pin["path"]) == pin["sha256"])
    observed = set(json.loads((project / "data/survival/world/a1_round12_runtime_contract.v1.json").read_text())
                   ["runtime_interfaces"]["observed_paths"].values())
    check("mutable_runtime_never_pinned", observed.isdisjoint({row["path"] for row in manifest["source_pins"].values()}))

    spawns = report.get("spawn_results", [])
    cells = {tuple(row.get("cell", [])) for row in spawns}
    chunks = {row.get("chunk_id") for row in spawns}
    regions = {row.get("region_id") for row in spawns}
    check("broad_safe_spawn_matrix", len(spawns) == 36 and len(cells) >= 30 and len(chunks) >= 12 and len(regions) >= 3
          and all(row.get("deterministic") and row.get("index_verified")
                  and int(row.get("minimum_material_families", 0)) >= 2 for row in spawns),
          {"rows": len(spawns), "cells": len(cells), "chunks": len(chunks), "regions": sorted(regions)})

    arrivals = {row.get("site_key"): row for row in report.get("site_arrivals", [])}
    check("three_real_a8_physical_returns", set(arrivals) == set(manifest["sites"]))
    for key, site in manifest["sites"].items():
        row = arrivals.get(key, {})
        check(f"a8_{key}_identity_motion_and_scope",
              row.get("canonical_cell") == site["canonical_cell"]
              and row.get("approach_cell") == site["physical_approach"]["cell"]
              and row.get("door_target") == site["door_target"]["world_px"]
              and row.get("retreat_cell") == site["retreat_target"]["cell"]
              and row.get("site_instance_id") == site["instance_identity"]["site_instance_id"]
              and row.get("real_a8_scene") == site["shell"]["scene"]
              and row.get("approach_ok") and row.get("door_ok") and row.get("return_ok")
              and not row.get("interior_entered") and not row.get("production_scene_mounted"), row)
    journeys = report.get("journeys", [])
    check("all_journeys_input_driven_without_coordinate_writes", len(journeys) >= 20
          and all(row.get("ok") and row.get("input_driven") and row.get("position_writes") == 0
                  and not row.get("production_mount") for row in journeys), len(journeys))
    check("no_teleport_stream_or_contact_defects", report.get("travel_position_writes") == 0
          and not report.get("teleport_violations") and not report.get("stream_violations")
          and not report.get("unexpected_contacts") and float(report.get("max_hero_step_px", 999)) <= 20.0)
    check("physical_region_and_chunk_transition",
          any(row.get("from") == "r_ashen_crown" and row.get("to") == "r_mirrormere"
              and row.get("from_biome_id") == "temperate_mixed" and row.get("to_biome_id") == "freshwater_marsh"
              and row.get("from_surface_id") == "grass" and row.get("to_surface_id") == "marsh"
              and row.get("from_world_id") == row.get("world_id") == "world:soh_continent_v1"
              for row in report.get("region_transitions", []))
          and len(report.get("chunk_transitions", [])) >= 1)

    controls = {row.get("id"): row for row in report.get("negative_controls", [])}
    check("all_required_negative_controls_executed", set(controls) == set(NEGATIVES)
          and all(row.get("pass") and row.get("refused") and row.get("actual") == NEGATIVES[key]
                  for key, row in controls.items()), controls)
    check("blocked_terrain_was_physical", int(controls.get("blocked_terrain", {}).get("contacts", 0)) > 0)

    captures = report.get("captures", [])
    check("capture_matrix_count", len(captures) == 15, len(captures))
    by_pair: dict[tuple[str, tuple[int, ...]], dict] = {}
    for row in captures:
        view = row.get("view_id")
        resolution = row.get("resolution")
        key = (view, tuple(resolution or []))
        path = Path(row.get("path", ""))
        valid = view in VIEWS and resolution in RESOLUTIONS and path.is_file()
        if valid:
            try:
                valid = png_size(path) == resolution and sha(path) == row.get("sha256")
            except (OSError, ValueError):
                valid = False
        valid = valid and row.get("camera_zoom") == [1, 1] and row.get("render_scale") == 1
        valid = valid and row.get("logical_viewport") == [640, 360]
        valid = valid and row.get("world_id") == "world:soh_continent_v1"
        valid = valid and row.get("visual_acceptance") == "NOT_TESTED" and not row.get("production_frame")
        if view == "region_transition":
            valid = valid and row.get("region_id") == "r_mirrormere"
            valid = valid and row.get("biome_id") == "freshwater_marsh" and row.get("surface_id") == "marsh"
        valid = valid and int(row.get("sample_unique_colors", 0)) >= 3 and float(row.get("sample_luminance_range", 0)) > 0.03
        check(f"capture_{view}_{resolution}", valid, row.get("path"))
        if key in by_pair:
            check(f"capture_unique_{view}_{resolution}", False, "duplicate view/resolution")
        by_pair[key] = row
    check("capture_matrix_complete", set(by_pair) == {(view, tuple(resolution)) for view in VIEWS for resolution in RESOLUTIONS})
    for site in ("quarry", "orchard"):
        for resolution in RESOLUTIONS:
            day = by_pair.get((site + "_day", tuple(resolution)), {})
            night = by_pair.get((site + "_night", tuple(resolution)), {})
            check(f"day_night_{site}_{resolution}", day.get("sha256") != night.get("sha256")
                  and day.get("time_of_day") == 0.35 and night.get("time_of_day") == 0.82
                  and day.get("source_visual", {}).get("night_factor") != night.get("source_visual", {}).get("night_factor"))

    if require_d051_art:
        avatar = report.get("avatar", {})
        projection = report.get("identity_selection", {}).get("projection", {})
        check("real_d051_presenter_active", report.get("d051_art_staged") is True
              and avatar.get("ready") and avatar.get("gender") == "male"
              and avatar.get("has_avatar_sprite") and projection.get("gender") == "male"
              and projection.get("provenance") == "A0_OWNER_PROJECTION", avatar)
    dispositions = report.get("dispositions", {})
    check("honest_d051_art_staging_disposition",
          bool(report.get("d051_art_staged")) == (dispositions.get("D051_LICENSED_ART_STAGED") == "PASS"))
    check("scoped_dispositions", dispositions.get("SOURCE_INTERFACE_READY") == "PASS"
          and dispositions.get("COMPOSED_NATIVE_SEAM") == "PASS"
          and all(dispositions.get(key) == "NOT_TESTED" for key in
                  ("PRODUCTION_MOUNTED", "PLAYER_PLAYABLE", "VISUALLY_ACCEPTED", "D051_VISUALLY_ACCEPTED", "A8_INTERIOR_OR_LOOT_ACCEPTED")),
          dispositions)
    check("no_production_save_reward_or_interior_claim", report.get("production_save_mutation") is False
          and report.get("reward_items_granted") == 0 and report.get("production_A8_interior_entered") is False
          and report.get("production_D051_visual_accepted") is False)
    return checks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, default=Path("data/survival/world/a1_continent_interface.v1.json"))
    parser.add_argument("--project", type=Path, default=Path("."))
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--require-d051-art", action="store_true")
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    manifest = json.loads(args.manifest.read_text())
    checks = validate(report, manifest, args.project, args.require_d051_art)
    failed = [row for row in checks if not row["ok"]]
    result = {"schema": "soh.world.a1_r13_native_validation.v1", "ok": not failed,
              "checks": checks, "check_count": len(checks), "failures": failed,
              "d051_art_required": args.require_d051_art,
              "d051_art_staged": bool(report.get("d051_art_staged")),
              "scope": "NATIVE_SOURCE_INTERFACE_ONLY_NOT_PRODUCTION_OR_VISUAL_ACCEPTANCE"}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"ok": not failed, "checks": len(checks), "failures": [row["name"] for row in failed]}, indent=2))
    if failed:
        raise ValueError("R13 native validation failed: " + ", ".join(row["name"] for row in failed))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
