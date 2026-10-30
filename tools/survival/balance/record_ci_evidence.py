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
REPO = "Khanh-glitch/Soul-of-Hero"
# One annotation message can carry several "FAIL <label>" lines separated by "~"
# (the workflow tails the log into the annotation), so every label is extracted.
_FAIL = __import__("re").compile(r"FAIL\s{2,}([^~]+)")
OUT = ROOT / "data/survival/balance/evidence/ci_runs.v1.json"

WORKFLOWS = (
    "a0-normal-entry-home-restart.yml",
    "a0-waystation-input-restart.yml",
    "a0-save-precision.yml",
    "a8-world-content-native.yml",
    "survival-runtime-validation.yml",
    "a0-a6-v4-latest-composition.yml",
)

# Phrases are copied from the owners' own test scripts, so a workflow that exits 0
# without running the assertion cannot be spent as proof.
PHRASES = (
    "NORMAL ENTRY HOME RESTART PASSED",
    "NORMAL ENTRY HOME RESTART FAILED",
    "ENTRY_HOME_FIRST_PROCESS",
    "ENTRY_HOME_SECOND_PROCESS",
    "A0 WAYSTATION INPUT RESTART PASSED",
    "A0 WAYSTATION INPUT RESTART FAILED",
    "A0 WAYSTATION AUTHORITY PASSED",
    "A0 WAYSTATION AUTHORITY FAILED",
    "independent-process cache replay during cooldown grants nothing",
    "post-rename retry cannot grant the same reward twice",
    "world reconstruction does not duplicate carried items",
    "A0 SAVE PRECISION",
    "PASSED -",
    "FAILED -",
    "PASS",
    "FAIL",
    "SCRIPT ERROR",
    "Parse Error",
    "Invalid call",
    "Nonexistent function",
)


def _gh(*args: str) -> str:
    result = subprocess.run(["gh", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"gh {' '.join(args)} failed: {result.stderr.strip()[:400]}")
    return result.stdout


def _build_row(row: Dict[str, object], workflow: str) -> Dict[str, object]:
    detail = json.loads(_gh("run", "view", str(row["databaseId"]), "--json", "jobs"))
    jobs = [
        {
            "name": job.get("name"),
            "status": job.get("status"),
            "conclusion": job.get("conclusion"),
            "steps": [
                {"name": step.get("name"), "conclusion": step.get("conclusion")}
                for step in job.get("steps", []) or []
            ],
        }
        for job in detail.get("jobs", [])
    ]
    # Failure annotations carry the owner's own "FAIL <label>" lines. They are the
    # only machine-readable statement of *which* assertion broke, so they are
    # recorded verbatim instead of being summarised.
    annotations: List[Dict[str, str]] = []
    for job in detail.get("jobs", []):
        try:
            # `gh run view --json jobs` reports `databaseId`, not `id`.
            check_run = job.get("databaseId") or job.get("id")
            raw = _gh("api", f"repos/{REPO}/check-runs/{check_run}/annotations")
        except SystemExit:
            continue
        for entry in json.loads(raw or "[]"):
            annotations.append(
                {"level": str(entry.get("annotation_level")), "message": str(entry.get("message"))[:600]}
            )
    phrases: List[str] = []
    if row.get("status") == "completed":
        try:
            log = _gh("run", "view", str(row["databaseId"]), "--log")
        except SystemExit:
            log = ""
        for line in log.splitlines():
            if any(phrase in line for phrase in PHRASES):
                phrases.append(line.strip()[:400])
    failed_checks = sorted(
        {
            label.strip(" ~")
            for annotation in annotations
            for label in _FAIL.findall(annotation["message"])
            if label.strip(" ~")
        }
    )
    return {
        "run_id": row["databaseId"],
        "annotations": annotations,
        "failed_checks": failed_checks,
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
    return [_build_row(row, workflow) for row in json.loads(raw or "[]")]


# Runs the reviewer must be able to re-read by number after a repin, whether or
# not they are still inside the per-workflow limit.
NAMED_RUNS = (
    41018366655,  # A0 normal entry, home and separate-process restart (3 second-process failures)
    41022547962,  # A0 Waystation input and separate-process pilot (custody/fault failures)
)


def _record(run_id: int, workflow: str) -> Dict[str, object]:
    row = json.loads(
        _gh(
            "api",
            f"repos/{REPO}/actions/runs/{run_id}",
        )
    )
    path = str(row.get("path") or "")
    if path.startswith(".github/workflows/"):
        workflow = path[len(".github/workflows/") :]
    return _build_row(
        {
            "databaseId": run_id,
            "headSha": row.get("head_sha"),
            "headBranch": row.get("head_branch"),
            "event": row.get("event"),
            "createdAt": row.get("created_at"),
            "status": row.get("status"),
            "conclusion": row.get("conclusion"),
        },
        workflow or str((row.get("name") or "").strip()),
    )


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=4, help="runs per workflow")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args(argv)

    runs: List[Dict[str, object]] = []
    seen = set()
    for workflow in WORKFLOWS:
        try:
            for row in _runs(workflow, args.limit):
                if row["run_id"] in seen:
                    continue
                seen.add(int(row["run_id"]))
                runs.append(row)
        except SystemExit as error:
            print(f"skip {workflow}: {error}")
    for run_id in NAMED_RUNS:
        if run_id in seen:
            continue
        try:
            row = _record(run_id, "")
            seen.add(run_id)
            runs.append(row)
            print(f"named run {run_id}: {row['workflow']} {row['status']}/{row['conclusion'] or '-'}")
        except SystemExit as error:
            print(f"skip run {run_id}: {error}")
    payload = {
        "schema": "soh.balance.ci_evidence.v2",
        "note": (
            "Recorded from the GitHub API by tools/survival/balance/record_ci_evidence.py. "
            "A run only counts for the commit it ran on. Job steps and failure labels are "
            "verbatim, so a passing step and a failing assertion cannot be confused."
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
