#!/usr/bin/env python3
"""Validate the completed Round 12 native report without upgrading its scope."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
from collections import Counter

from estimate_round12_native_budget import planned_work


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
    check("driven_segment_count", len(report.get("journeys", [])) == 38, len(report.get("journeys", [])))
    check("no_unexpected_motion_or_stream_defects", not report.get("unexpected_contacts")
          and not report.get("stream_violations") and not report.get("teleport_violations")
          and float(report.get("max_hero_step_px", 999)) <= 20.0)
    dynamic = report.get("dynamic", {})
    check("dynamic_baseline_block_reload_detour", dynamic.get("baseline_ok") and dynamic.get("detour_ok")
          and int(dynamic.get("expected_block_contacts", 0)) > 0 and int(dynamic.get("reload_generation", 0)) >= 1
          and not dynamic.get("save_service_used") and not dynamic.get("paid_construction_approved"), dynamic)
    check("two_hazard_retreats", len(report.get("hazards", [])) == 2
          and all(x["forward_ok"] and x["retreat_ok"] and not x["damage_applied"] for x in report["hazards"]))
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
        try:
            actual_size = png_size(path)
            actual_hash = sha(path)
        except (OSError, ValueError):
            actual_size, actual_hash = [], ""
        check("capture_bytes:" + path.name, actual_size == row["resolution"] and actual_hash == row["sha256"]
              and int(row.get("sample_unique_colors", 0)) > 8 and float(row.get("sample_luminance_range", 0)) > 0.03
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
