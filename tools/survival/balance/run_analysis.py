#!/usr/bin/env python3
"""A7 balance / loot-discovery inspector.

Usage (from the repository root):

    python3 tools/survival/balance/run_analysis.py            # rebuild artifacts
    python3 tools/survival/balance/run_analysis.py --check    # fail if artifacts would change
    python3 tools/survival/balance/run_analysis.py --print-summary

Reads only pinned snapshots in data/survival/balance/snapshot/ plus
data/survival/balance/hypotheses.v1.json. Writes only into
data/survival/balance/results/. It never writes to another owner's files.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from sohbalance import report  # noqa: E402


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify committed artifacts are current")
    parser.add_argument("--print-summary", action="store_true", help="print headline results")
    parser.add_argument("--results-dir", default=str(report.RESULTS_DIR))
    args = parser.parse_args(argv)

    artifacts = report.build()
    results_dir = Path(args.results_dir)

    if args.check:
        stale = []
        for name, payload in artifacts.items():
            path = results_dir / name
            expected = json.dumps(payload, indent=2, sort_keys=True) + "\n"
            if not path.exists() or path.read_text(encoding="utf-8") != expected:
                stale.append(name)
        if stale:
            print("STALE ARTIFACTS: " + ", ".join(sorted(stale)))
            return 1
        print("artifacts up to date")
        return 0

    digests = report.write(artifacts, results_dir)
    print("wrote artifacts to", results_dir)
    for name in sorted(digests):
        print(f"  {name:20s} {digests[name][:16]}")
    summary = artifacts["summary.json"]
    print("assertions_all_hold:", summary["assertions_all_hold"])
    for assertion in summary["assertions"]:
        print(("  PASS " if assertion["holds"] else "  FAIL ") + assertion["assertion_id"])
    if args.print_summary:
        print(json.dumps(summary["headline"], indent=2, sort_keys=True))
    return 0 if summary["assertions_all_hold"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
