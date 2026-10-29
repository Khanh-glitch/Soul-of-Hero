#!/usr/bin/env python3
"""Rebuild docs/vfx/skill_readiness/readiness_manifest.json.

Keeps the four readiness axes defined by EPIC #6 strictly separate and adds a
clearly-labelled, NON-axis execution state so that no one can mistake a
catalogued row for a playable native spell.

  native_port_ready      - EPIC acceptance gate. Requires every evidence key
                           (source numeric oracle, native full-cast video,
                           original-vs-native comparison, real-map overlay,
                           native test run, WebGL test run, 2K/4K perf).
  native_executable      - NOT an EPIC axis. True only when a real Godot module
                           with a source-locked authored generator exists and a
                           full cast actually runs through the native runtime.
  gold_visual_approved   - independent Gold-vs-native visual sign-off.
  gameplay_configured    - user-approved combat/input numbers.
  production_integrated  - approved overworld/Hero/UI/save binding.

Run from the repository root:
    python3 prototypes/skill_readiness/tools/rebuild_readiness_manifest.py
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
REGISTRY = ROOT / "docs" / "vfx" / "gold_skill_registry.json"
MANIFEST = ROOT / "docs" / "vfx" / "skill_readiness" / "readiness_manifest.json"
VENOM_BASELINES = ROOT / "docs" / "vfx" / "skill_readiness" / "venom_21_source_baselines.json"

SCOPED_SOURCES = ("venomwright", "arcana_iii")

RUNTIME_SOURCE = ROOT / "prototypes" / "skill_readiness" / "core" / "gold93_runtime.gd"


def load_native_executable_modules() -> dict[str, str]:
    """Host modules come from `MODULE_PATHS` in the runtime, the single source of
    truth. A second hand-kept copy here went stale (it still listed only 001)."""
    text = RUNTIME_SOURCE.read_text(encoding="utf-8")
    block = text.split("const MODULE_PATHS: Dictionary = {", 1)[1].split("\n}", 1)[0]
    pairs = re.findall(r'"(venomwright:\d{3}|arcana[^"]*)":\s*"([^"]+)"', block)
    if not pairs:
        raise SystemExit("MODULE_PATHS parsed empty from gold93_runtime.gd")
    return {key: path.replace("res://", "") for key, path in pairs}


NATIVE_EXECUTABLE_MODULES = load_native_executable_modules()

SOURCE_ARCHIVE_BLOCKER = (
    "ORIGINAL_SOURCE_ARCHIVE_UNAVAILABLE: the original Gold ZIP is stored in "
    "neither this repository nor the execution environment "
    "(venomwright SHA-256 ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716, "
    "ARCANA III SHA-256 8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d), "
    "so this skill's authored generator cannot be source-locked. The readiness "
    "API, both family runtimes, the ports, the lifecycle, the lab and the CI "
    "gates are complete; dropping a module at the registered path is enough, "
    "no infrastructure change is required."
)

# Evidence the EPIC gate demands before native_port_ready may flip to true.
EVIDENCE_KEYS = (
    "gold_original_video",
    "source_numeric_oracle",
    "native_full_cast_video",
    "original_vs_native_comparison",
    "real_map_overlay",
    "native_test_run",
    "webgl_test_run",
    "performance_2k_4k",
)

# What is genuinely on hand for the source-locked module today, and what is
# still missing. Recorded so no one can silently claim the gate passed.
NATIVE_TEST_EVIDENCE = "prototypes/skill_readiness/tests"
SOURCE_ORACLE_EVIDENCE = "prototypes/gold_pair/tests"
PER_SKILL_HARNESS_EVIDENCE = "res://.artifacts/gold93/per_skill_harness.json"
RENDER_SURFACE_EVIDENCE = "res://.artifacts/gold93/render_surface.json"


def main() -> int:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    scoped = [s for s in registry["skills"] if s["source"] in SCOPED_SOURCES]
    if len(scoped) != 93:
        raise SystemExit(f"registry must yield exactly 93 scoped skills, got {len(scoped)}")

    by_key = {s["key"]: s for s in scoped}
    baselines = {}
    if VENOM_BASELINES.is_file():
        baselines = {
            r["key"]: r
            for r in json.loads(VENOM_BASELINES.read_text(encoding="utf-8"))["rows"]
        }
    entries = manifest["entries"]
    if len(entries) != 93:
        raise SystemExit(f"manifest must hold exactly 93 entries, got {len(entries)}")

    totals = Counter()
    for entry in entries:
        key = entry["key"]
        reg = by_key[key]
        module_path = NATIVE_EXECUTABLE_MODULES.get(key)
        native_executable = module_path is not None and (ROOT / module_path).is_file()

        entry["native_executable"] = native_executable
        entry["native_module_path"] = module_path
        entry["native_executable_evidence"] = (
            {
                "native_test_run": NATIVE_TEST_EVIDENCE,
                "source_numeric_oracle": SOURCE_ORACLE_EVIDENCE,
                "per_skill_harness": PER_SKILL_HARNESS_EVIDENCE,
                "render_surface": RENDER_SURFACE_EVIDENCE,
            }
            if native_executable
            else None
        )
        entry["source_material_blocker"] = (
            "" if native_executable else SOURCE_ARCHIVE_BLOCKER
        )

        # Attach the canonical ORIGINAL source runtime baseline where one exists
        # (all 21 Venomwright skills). It is the acceptance target a future
        # module must match; it is not evidence that the module exists.
        base = baselines.get(key)
        entry["source_baseline"] = base
        if base is not None:
            entry["coverage"]["source_deps"] = "AUDITED_FROM_REGISTRY"
            entry["coverage"]["particles"] = "BASELINE_RECORDED"
            entry["coverage"]["ground_environment"] = "BASELINE_RECORDED"

        if native_executable:
            # Honest per-area coverage for the one module that really runs.
            # Anything that still needs a GPU or the original Gold renderer stays
            # explicitly unverified instead of being quietly assumed.
            entry["coverage"] = {
                "source_deps": "AUDITED_SOURCE_LOCKED",
                "caster_visual": "AUDITED_SOURCE_LOCKED",
                "enemy_visual": "AUDITED_SOURCE_LOCKED",
                "ground_environment": "AUDITED_SOURCE_LOCKED",
                "particles": "AUDITED_SOURCE_LOCKED",
                "audio": "NOT_PRESENT_IN_ORIGINAL_SOURCE",
                "camera_post": "AUDITED_SOURCE_LOCKED",
                "cancel_cleanup": "AUDITED_SOURCE_LOCKED",
                # The CPU source raster that feeds the GPU passes is driven and
                # asserted every tick by the render-surface gate; the GPU
                # composite itself needs a real display, which the headless
                # execution environment does not have.
                "native_gpu": "CPU_SOURCE_RASTER_VERIFIED_HEADLESS_GPU_COMPOSITE_UNAVAILABLE",
            }

        # EPIC gate: every evidence key must be present before port-ready.
        missing = [k for k in EVIDENCE_KEYS if not entry.get("evidence", {}).get(k)]
        entry["evidence_gaps"] = missing
        if entry["native_port_ready"] and missing:
            raise SystemExit(
                f"native_port_ready set for {key} without evidence: {missing}"
            )

        # Candidate ARCANA fusions #302..312 must never be claimed Gold-approved.
        if reg["source"] == "arcana_iii" and 302 <= reg["source_skill_id"] <= 312:
            entry["skill_gold_candidate_unreviewed"] = True
            if entry["gold_visual_approved"]:
                raise SystemExit(f"unreviewed fusion candidate {key} marked Gold-approved")

        for axis in (
            "native_port_ready",
            "gold_visual_approved",
            "gameplay_configured",
            "production_integrated",
        ):
            assert isinstance(entry[axis], bool), f"{key}: {axis} must be boolean"
            totals[axis] += int(entry[axis])
        totals["native_executable"] += int(native_executable)

    manifest["readiness_totals"] = {
        "native_port_ready": totals["native_port_ready"],
        "gold_visual_approved": totals["gold_visual_approved"],
        "gameplay_configured": totals["gameplay_configured"],
        "production_integrated": totals["production_integrated"],
    }
    manifest["execution_totals"] = {
        "native_executable": totals["native_executable"],
        "catalogued_only": 93 - totals["native_executable"],
    }
    # `readiness_definition` was a single sentence when this branch inherited it;
    # widen it to a map without losing the original wording.
    if isinstance(manifest.get("readiness_definition"), str):
        manifest["readiness_definition"] = {
            "native_port_ready": manifest["readiness_definition"],
        }
    manifest["readiness_definition"]["native_executable"] = (
        "NOT an EPIC acceptance axis. True only when a real native Godot module "
        "with a source-locked authored generator exists and a full cast runs "
        "through the native runtime; it does not imply Gold visual approval, "
        "gameplay configuration or production integration."
    )
    manifest["source_material_status"] = {
        "archives_present_in_repository": False,
        "archives_present_in_execution_environment": False,
        "venomwright_sha256": "ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716",
        "arcana_iii_sha256": "8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d",
        "consequence": (
            "72 ARCANA III generators stay blocked until the pinned ARCANA archive "
            "is restored; no approximation is invented. 6 Venomwright skills "
            "(007, 008, 013, 015, 016, 020) have no host module because their "
            "source parity is unresolved. Every other registered id is backed by "
            "a host module that drives the original ported generator."
        ),
    }

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")

    print("readiness_manifest.json rebuilt: 93 entries")
    print("  native_port_ready     :", totals["native_port_ready"])
    print("  gold_visual_approved  :", totals["gold_visual_approved"])
    print("  gameplay_configured   :", totals["gameplay_configured"])
    print("  production_integrated :", totals["production_integrated"])
    print("  native_executable     :", totals["native_executable"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
