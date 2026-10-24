#!/usr/bin/env python3
"""Write INDEX.md and BASELINES.md for docs/chapter1-visual-overhaul/.

Status rules (deliberately not generous):

  * no native frames for the level            -> NOT ATTEMPTED
  * a frozen gameplay suite failed            -> BLOCKED — REGRESSION
  * frames exist, verdict file says reviewed  -> that verdict
  * frames exist, no verdict yet              -> TECHNICALLY VALID — VISUAL NOT READY

The verdict file is authored by the agent after looking at the frames; nothing
in the pipeline promotes a level to READY FOR HUMAN VISUAL REVIEW on its own.
That label still means "a human must look", never "accepted".
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "chapter1-visual-overhaul"
VERDICTS = ROOT / "data" / "environment" / "chapter1" / "review_status.json"
SUITES = ROOT / ".artifacts" / "chapter1" / "suites"

REQUIRED_SUITES = {
    "chapter_1_map_design_test": "CHAPTER 1 MAP DESIGN",
    "chapter_1_campaign_map_design_test": "CAMPAIGN MAP DESIGN PASSED",
    "chapter_1_collision_route_test": "COLLISION ROUTE TEST PASSED",
}


def suite_state() -> tuple[str, dict]:
    rows = {}
    ok = True
    for name, marker in REQUIRED_SUITES.items():
        log = SUITES / (name + ".log")
        text = log.read_text(errors="replace") if log.exists() else ""
        passed = marker in text and "FAILED" not in text
        rows[name] = "PASSED" if passed else ("MISSING" if not log.exists() else "FAILED")
        ok = ok and passed
    return ("PASSED" if ok else "FAILED"), rows


def _perf_rows() -> list:
    rows = []
    logs = DOCS / "regressions" / "logs"
    for log in sorted(logs.glob("*_after.txt")):
        level_id = log.name[: -len("_after.txt")]
        text = log.read_text(errors="replace")
        before = logs / f"{level_id}_before.txt"
        btext = before.read_text(errors="replace") if before.exists() else ""
        after_perf = re.search(r"PERF: .*nodes=(\d+) draw_calls=(\d+) static_mb=([\d.]+)", text)
        before_perf = re.search(r"PERF: .*nodes=(\d+) draw_calls=(\d+) static_mb=([\d.]+)", btext)
        if not after_perf:
            continue
        nodes = f"{before_perf.group(1)} -> {after_perf.group(1)}" if before_perf else after_perf.group(1)
        calls = f"{before_perf.group(2)} -> {after_perf.group(2)}" if before_perf else after_perf.group(2)
        memory = f"{after_perf.group(3)} MiB"
        rows.append((level_id, nodes, calls, memory))
    return rows


def main() -> int:
    index = json.loads((ROOT / "data" / "environment" / "chapter1" / "chapter_index.json").read_text())
    status_path = DOCS / "gallery" / "status.json"
    captured = {}
    if status_path.exists():
        for result in json.loads(status_path.read_text()):
            captured[result["level_id"]] = result.get("stations", [])
    verdicts = {}
    if VERDICTS.exists():
        verdicts = json.loads(VERDICTS.read_text()).get("levels", {})
    suites_ok, suite_rows = suite_state()

    lines = [
        "# Chapter 1 — visual overhaul",
        "",
        "Shared presentation layer: `game/levels/presentation/chapter1_environment_art.gd`.",
        "Per-level themes: `data/environment/chapter1/<level_id>.json`.",
        "Native frames: `.github/workflows/chapter1-visual-overhaul.yml` "
        "(production `AppRoot` → `AppFlow.start_campaign_level`).",
        "",
        "| Level | Title | Native frames | Status |",
        "| --- | --- | --- | --- |",
    ]
    for entry in index["levels"]:
        level_id = entry["level_id"]
        stations = captured.get(level_id, [])
        if not stations:
            status = "NOT ATTEMPTED"
        elif not suites_ok:
            status = "BLOCKED — REGRESSION"
        else:
            status = verdicts.get(level_id, "TECHNICALLY VALID — VISUAL NOT READY")
        lines.append("| L%02d | %s | %d | `%s` |"
                     % (entry["slot"], entry["title"], len(stations), status))

    lines += [
        "",
        "## Gameplay gates (frozen, unchanged expectations)",
        "",
        "| Suite | Result |",
        "| --- | --- |",
    ]
    for name, state in suite_rows.items():
        lines.append("| `%s` | %s |" % (name, state))
    lines += [
        "",
        "`chapter_1_balance_matrix_test` is a known pre-existing, baseline-matched",
        "failure on this branch and is reported in `regressions/` rather than",
        "silently passed. See the Level 5 review for the pinned-baseline proof.",
        "",
        "## Gallery",
        "",
        "`gallery/chapter1_after_overview.png` — one AFTER frame per level.",
        "`L01/` … `L10/` — native frames, before/after pairs, crops, `REVIEW.md`.",
        "",
        "## Cost of the presentation layer",
        "",
        "Measured on the capture frame of the same run, art off vs art on:",
        "",
        "| Level | Nodes | Draw calls | Static memory |",
        "| --- | --- | --- | --- |",
    ]
    for row in _perf_rows():
        lines.append("| %s | %s | %s | %s |" % (row[0], row[1], row[2], row[3]))
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / "INDEX.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    baselines = [
        "# Baselines",
        "",
        "Branch: `arena/6e89e68d-soul-of-hero` (the only authorized branch).",
        "Evidence commit before this sprint: `564c65ec4472fd0481aa475f5e69346278a5dbfb`.",
        "",
        "Map sources are the production campaign documents and were not edited by",
        "this overhaul; the presentation layer is additive and derived:",
        "",
        "| Level | Map source |",
        "| --- | --- |",
    ]
    for entry in index["levels"]:
        baselines.append("| L%02d | `data/levels/%s` |" % (entry["slot"], entry["map"]))
    baselines += [
        "",
        "Exact per-file hashes: `regressions/source_pins.txt`, toolchain and HEAD:",
        "`regressions/toolchain.txt`.",
        "",
        "## What BEFORE means here",
        "",
        "`--no-art` boots the *same* map with the presentation layer disabled: same",
        "geometry, same collision, same entities, same HUD, same camera stations.",
        "The before/after pairs therefore isolate exactly one variable — the art",
        "layer — instead of comparing two different maps.",
    ]
    (DOCS / "BASELINES.md").write_text("\n".join(baselines) + "\n", encoding="utf-8")
    print("INDEX.md and BASELINES.md written; suites=%s" % ("PASSED" if suites_ok else "FAILED"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
