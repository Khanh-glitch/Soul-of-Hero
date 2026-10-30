"""Record what the owners' Godot workflows actually did, verbatim.

Run this deliberately after a repin:

    python3 tools/survival/balance/record_ci_evidence.py --write

It shells out to `gh` (read-only API), and writes
`data/survival/balance/evidence/ci_runs.v1.json`. Only facts are recorded: run id,
workflow file, head sha, job status/conclusion and any assertion phrase found in
the job log. Nothing is interpreted here; `sohbalance.evidence` does the grading.

If a run is still queued, the file says `queued`. That is the honest state, and the
gate reports `QUEUED` rather than pretending the engine approved the build.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data/survival/balance/evidence/ci_runs.v1.json"

WORKFLOWS = (
    "a0-normal-entry-home-restart.yml",
    "a8-world-content-native.yml",
    "survival-runtime-validation.yml",
    "a0-a6-v4-latest-composition.yml",
)

PHRASES = (
    "NORMAL ENTRY HOME RESTART PASSED",
    "NORMAL ENTRY HOME RESTART FAILED",
    "ENTRY_HOME_FIRST_PROCESS",
    "ENTRY_HOME_SECOND_PROCESS",
    "PASS",
    "FAIL",
    "SCRIPT ERROR",
    "Parse Error",
)


def _gh(*args: str) -> str:
    result = subprocess.run(["gh", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"gh {' '.join(args)} failed: {result.stderr.strip()[:400]}")
    return result.stdout


def _runs(workflow: str, limit: int) -> List[Dict[str, object]]:
    raw = _gh(
        "run",
        "list",
        "--workflow",
        workflow,
        "--limit",
        str(limit),
        "--json",
        "databaseId,status,conclusion,headSha,event,createdAt,headBranch",
    )
    payload = json.loads(raw or "[]")
    runs: List[Dict[str, object]] = []
    for row in payload:
        detail = json.loads(_gh("run", "view", str(row["databaseId"]), "--json", "jobs"))
        jobs = [
            {
                "name": job.get("name"),
                "status": job.get("status"),
                "conclusion": job.get("conclusion"),
            }
            for job in detail.get("jobs", [])
        ]
        phrases: List[str] = []
        if row.get("status") == "completed":
            try:
                log = _gh("run", "view", str(row["databaseId"]), "--log")
            except SystemExit:
                log = ""
            for line in log.splitlines():
                if any(phrase in line for phrase in PHRASES):
                    phrases.append(line.strip()[:400])
        runs.append(
            {
                "run_id": row["databaseId"],
                "workflow": workflow,
                "head_sha": row.get("headSha"),
                "head_branch": row.get("headBranch"),
                "event": row.get("event"),
                "created_at": row.get("createdAt"),
                "status": row.get("status"),
                "conclusion": row.get("conclusion") or "",
                "jobs": jobs,
                "log_phrases": phrases,
            }
        )
    return runs


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=4, help="runs per workflow")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args(argv)

    runs: List[Dict[str, object]] = []
    for workflow in WORKFLOWS:
        try:
            runs.extend(_runs(workflow, args.limit))
        except SystemExit as error:
            print(f"skip {workflow}: {error}")
    payload = {
        "schema": "soh.balance.ci_evidence.v1",
        "note": (
            "Recorded from the GitHub API by tools/survival/balance/record_ci_evidence.py. "
            "A run only counts for the commit it ran on."
        ),
        "workflows": list(WORKFLOWS),
        "runs": sorted(runs, key=lambda row: (str(row["workflow"]), -int(row["run_id"]))),
    }
    text = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    counts: Dict[str, int] = {}
    for row in payload["runs"]:
        key = f"{row['status']}/{row['conclusion'] or '-'}"
        counts[key] = counts.get(key, 0) + 1
    print(f"{len(payload['runs'])} run(s): {counts}")
    if args.write:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(text, encoding="utf-8")
        print(f"wrote {OUT.relative_to(ROOT)}")
    else:
        print("dry run; pass --write to record")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
