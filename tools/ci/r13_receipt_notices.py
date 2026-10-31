#!/usr/bin/env python3
"""Publish the R13 two-process receipts as check-run notices.

Raw job logs are not always retrievable, but `check-runs/<id>/annotations` is,
so the durable evidence - PIDs, save path, A1 binding hash, A8 verdict, source
receipt, preparation cost, settlement and conservation - is emitted as notices
that can be read back later without the log.

Reads `$ARTIFACT_DIR/r13_two_process_summary.json` plus both receipts. Never
mutates them and never decides the build result.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def load(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def notice(title: str, body: str) -> None:
    print(f"::notice title={title}::{body}")


def main() -> int:
    artifact_dir = Path(os.environ.get("ARTIFACT_DIR", "artifacts/r13-value-economy"))
    summary = load(artifact_dir / "r13_two_process_summary.json")
    if not summary:
        print(f"::warning::R13 notices: no summary at {artifact_dir}")
        return 0
    p1 = load(artifact_dir / "tests/receipts/r13_p1_receipt.json")
    p2 = load(artifact_dir / "tests/receipts/r13_p2_receipt.json")

    p1_pid = summary.get("p1_pid")
    p2_pid = summary.get("p2_pid")
    notice(
        "R13 two processes",
        f"p1={p1_pid} p2={p2_pid} distinct={p1_pid != p2_pid} save={summary.get('save_path')}",
    )
    notice(
        "R13 settlement",
        f"job={summary.get('job_id')} granted={summary.get('granted_output')} "
        f"duplicate={summary.get('duplicate_reason')}",
    )
    notice(
        "R13 provenance",
        f"bindings={str(summary.get('bindings_sha256', ''))[:16]} "
        f"a8={summary.get('a8_status')} auth_tx={p1.get('auth_tx')} harvest_tx={p1.get('harvest_tx')}",
    )
    notice(
        "R13 source receipt",
        f"source={p1.get('source_id')} rewards={json.dumps(p1.get('harvest_rewards'))} "
        f"tool_after={p1.get('tool_condition_after_harvest')}",
    )
    notice(
        "R13 preparation",
        f"oak {p1.get('oak_before')}->{p1.get('oak_after')} "
        f"iron {p1.get('iron_before')}->{p1.get('iron_after')} "
        f"output_at_prepare={p1.get('fragment_after_prepare')}",
    )
    notice("R13 conservation", json.dumps(summary.get("conservation")))
    notice(
        "R13 verdict",
        f"ok={summary.get('ok')} findings={summary.get('findings')} p2_checks={p2.get('checks')}",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
