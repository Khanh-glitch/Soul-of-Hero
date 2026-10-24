#!/usr/bin/env python3
"""Turn the headless stability descents into one table.

Round 4, package F. The gate cannot tune `data/**` (frozen), so the honest answer to
"is the combat stable?" is a distribution: run the real descent several times, and
report what each run cost, where the health went, and how often the Knight needed the
checkpoint. This script only reads the logs the workflow already produced; it never
invents a run.

Usage:
    python3 tools/gate3/stability_report.py .artifacts/gate3/stability.log
"""

from __future__ import annotations

import re
import statistics
import sys

STABILITY = re.compile(
    r"GATE3 STABILITY: descent complete=(?P<complete>\w+) floors=(?P<floors>\d+) "
    r"hp_start=(?P<start>\d+) hp_end=(?P<end>\d+) delta=(?P<delta>\d+) "
    r"fights=(?P<fights>\d+) respawns=(?P<respawns>\d+) "
    r"hazard=(?P<hazard>\d+) enemy=(?P<enemy>\d+) unexplained=(?P<unexplained>\d+)"
)
ROUTE = re.compile(r"GATE3 ROUTE: (?P<cells>\d+) cells walked, (?P<pixels>\d+) px travelled")
PASSED = "GATE3 CAPTURE TEST PASSED"


def parse(path: str) -> list[dict]:
    runs: list[dict] = []
    current: dict = {}
    try:
        lines = open(path, encoding="utf-8", errors="replace").read().splitlines()
    except OSError as error:
        print(f"stability: cannot read {path}: {error}")
        return runs
    for line in lines:
        if line.startswith("GATE3 CAMPAIGN ROUTE"):
            current = {"passed": False}
        match = STABILITY.search(line)
        if match:
            values = match.groupdict()
            current.update({
                "complete": values["complete"] == "True",
                "floors": int(values["floors"]),
                "start": int(values["start"]),
                "end": int(values["end"]),
                "delta": int(values["delta"]),
                "fights": int(values["fights"]),
                "respawns": int(values["respawns"]),
                "hazard": int(values["hazard"]),
                "enemy": int(values["enemy"]),
                "unexplained": int(values["unexplained"]),
            })
            continue
        route = ROUTE.search(line)
        if route and current:
            current["cells"] = int(route.group("cells"))
            current["pixels"] = int(route.group("pixels"))
        if PASSED in line:
            current["passed"] = True
            runs.append(current)
            current = {}
    return runs


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    runs = parse(argv[1])
    print("# Descent stability")
    print()
    print("Headless replays of the same production descent (authored spawn, the level's")
    print("own floor doors, production input actions). Health is 1100 for every run.")
    print()
    print("| # | floors | fights | respawns | cells | HP lost | hazard | enemy | unexplained |")
    print("|---|---|---|---|---|---|---|---|---|")
    for index, run in enumerate(runs, start=1):
        print("| {} | 1..{} | {} | {} | {} | {} | {} | {} | {} |".format(
            index, run["floors"], run["fights"], run["respawns"], run.get("cells", "?"),
            run["delta"], run["hazard"], run["enemy"], run["unexplained"]))
    print()
    if not runs:
        print("GATE3 STABILITY: no descent produced a stability line")
        return 1
    deltas = [run["delta"] for run in runs]
    reached = sum(1 for run in runs if run["floors"] >= 3)
    explained = sum(run["hazard"] + run["enemy"] for run in runs)
    total = sum(deltas) or 1
    print("GATE3 STABILITY SUMMARY: runs={} three_storey={} hp_lost_min={} median={} max={} "
          "respawns={} explained={:.1f}%".format(
              len(runs), reached, min(deltas), int(statistics.median(deltas)), max(deltas),
              sum(run["respawns"] for run in runs), 100.0 * explained / total))
    spread = max(deltas) - min(deltas)
    print("GATE3 STABILITY SPREAD: max-min={} ({:.0f}% of a 1100 health bar)".format(
        spread, 100.0 * spread / 1100.0))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
