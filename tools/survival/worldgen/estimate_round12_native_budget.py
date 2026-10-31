#!/usr/bin/env python3
"""Fail-closed Round 12 native runtime budget from a measured short probe.

The probe is never accepted as native-fixture evidence. It only prevents an
unmeasured big-bang full run and gives CI a concrete timeout with margin.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def planned_journey_labels(inputs: dict) -> list[str]:
    """Enumerate every physical segment; never substitute a hard-coded count."""
    labels: list[str] = []
    for case in inputs["spawn_safety"]["cases"]:
        if case["native_drive"]:
            seed = int(case["seed"])
            labels.extend([f"spawn seed {seed} to road rally", f"spawn seed {seed} road rally return"])
    labels.extend("primary " + leg["leg_id"] for leg in inputs["primary_journey"]["legs"])
    labels.extend([
        "dynamic baseline passage", "dynamic baseline physical return",
        "reloaded dynamic detour", "reloaded dynamic detour physical return",
    ])
    for probe in inputs["hazard_probes"]:
        labels.extend([
            "warned hazard approach " + probe["hazard_id"],
            "hazard physical retreat " + probe["hazard_id"],
        ])
    return labels


def planned_work(inputs: dict, resolutions: int = 3) -> dict:
    spawn_cells = sum(len(c["forward_cells"]) + len(c["return_cells"])
                      for c in inputs["spawn_safety"]["cases"] if c["native_drive"])
    primary_cells = sum(len(leg["cells"]) for leg in inputs["primary_journey"]["legs"])
    fixture = inputs["dynamic_fixture"]
    base = next(leg for leg in inputs["reload_baseline_journey"]["legs"]
                if leg["leg_id"] == fixture["baseline_leg_id"])
    detour = next(leg for leg in inputs["reload_journey"]["legs"]
                  if leg["leg_id"] == fixture["detour_leg_id"])
    dynamic_cells = len(base["cells"]) + len(base["return_cells"]) + len(detour["cells"]) + len(detour["return_cells"])
    hazard_cells = sum(len(p["forward_cells"]) + len(p["return_cells"]) for p in inputs["hazard_probes"])
    visual_captures = sum(resolutions if view["full_resolution"] else 1 for view in inputs["visual_views"])
    # salvage 1, Quarry 3, Orchard 3, Mill 1, home 1, dynamic 1.
    journey_captures = 1 + resolutions + resolutions + 1 + 1 + 1
    return {
        "spawn_cells": spawn_cells, "primary_cells": primary_cells,
        "dynamic_cells": dynamic_cells, "hazard_cells": hazard_cells,
        "drive_cells": spawn_cells + primary_cells + dynamic_cells + hazard_cells,
        "drive_segments": len(planned_journey_labels(inputs)),
        # The real Hero must refuse the dynamic body both before and after reload.
        "expected_block_frames": 180, "visual_captures": visual_captures,
        "visual_preparations": len(inputs["visual_views"]), "journey_captures": journey_captures,
        "captures": visual_captures + journey_captures,
        "reader_stream_constructions": 3,
    }


def estimate(probe: dict, inputs: dict, margin: float = 2.0, cap_seconds: int = 1800) -> dict:
    if not probe.get("budget_probe") or not probe.get("ok") or probe.get("abort"):
        raise ValueError("a successful explicit budget probe is required")
    if probe.get("dispositions", {}).get("NATIVE_FIXTURE_PASS") != "NOT_TESTED":
        raise ValueError("budget probe must not claim native fixture acceptance")
    journeys = probe.get("journeys", [])
    captures = probe.get("captures", [])
    preparations = probe.get("prepare_measurements", [])
    if len(journeys) != 2 or len(captures) != 4 or len(preparations) != 1:
        raise ValueError("probe needs one forward/return route, one visual preparation, three resolutions and one single-resolution branch capture")
    resolution_count = len({tuple(row["resolution"]) for row in captures})
    if resolution_count != 3 or sum(bool(row.get("single_resolution_branch")) for row in captures) != 1:
        raise ValueError("probe must cover three unique resolutions and exactly one single-resolution branch")
    probe_cells = sum(int(row["cells"]) for row in journeys)
    probe_frames = sum(int(row["frames"]) for row in journeys)
    drive_seconds = sum(int(row["wall_ms"]) for row in journeys) / 1000.0
    capture_seconds = sum(int(row["capture_wall_ms"]) for row in captures) / 1000.0
    prepare_seconds = sum(int(row["wall_ms"]) for row in preparations) / 1000.0
    elapsed = float(probe["elapsed_seconds"])
    if probe_cells < 32 or probe_frames <= 0 or drive_seconds <= 0 or capture_seconds <= 0 or prepare_seconds <= 0 or elapsed <= 0:
        raise ValueError("probe measurements are vacuous")
    setup_seconds = max(0.0, elapsed - drive_seconds - capture_seconds - prepare_seconds)
    work = planned_work(inputs, resolution_count)
    estimate_seconds = (
        setup_seconds * work["reader_stream_constructions"]
        + drive_seconds / probe_cells * work["drive_cells"]
        + drive_seconds / probe_frames * work["expected_block_frames"]
        + prepare_seconds * work["visual_preparations"]
        + capture_seconds / len(captures) * work["captures"]
    )
    timeout = max(300, math.ceil((estimate_seconds + 60.0) * margin))
    result = {
        "schema": "soh.world.a1_round12_native_budget.v1",
        "ok": timeout <= cap_seconds,
        "probe_elapsed_seconds": elapsed,
        "probe_drive_seconds": drive_seconds, "probe_capture_seconds": capture_seconds,
        "probe_prepare_seconds": prepare_seconds,
        "probe_setup_seconds": setup_seconds, "probe_cells": probe_cells, "probe_frames": probe_frames,
        "probe_resolution_count": resolution_count, "probe_single_branch_captures": 1,
        "seconds_per_cell": drive_seconds / probe_cells,
        "seconds_per_capture": capture_seconds / len(captures),
        "planned": work, "estimated_full_seconds": estimate_seconds,
        "margin": margin, "added_headroom_seconds": 60,
        "timeout_seconds": timeout, "cap_seconds": cap_seconds,
        "policy": "MEASURED_PROBE_THEN_FULL_RUN_REFUSE_OVERCAP_BIG_BANG",
        "native_fixture_evidence": False,
    }
    if timeout > cap_seconds:
        result["error"] = "measured full-run budget exceeds cap; split phases before retrying"
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--probe", type=Path, required=True)
    parser.add_argument("--inputs", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--cap-seconds", type=int, default=1800)
    args = parser.parse_args()
    result = estimate(json.loads(args.probe.read_text()), json.loads(args.inputs.read_text()), cap_seconds=args.cap_seconds)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps(result, indent=2, sort_keys=True))
    print(f"ROUND12_BUDGET_SECONDS={result['timeout_seconds']}")
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
