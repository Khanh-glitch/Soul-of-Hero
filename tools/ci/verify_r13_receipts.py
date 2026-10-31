#!/usr/bin/env python3
"""Validate the two-process R13 receipts produced by two distinct Godot PIDs.

Process 1 and Process 2 are separate `godot --headless` invocations against the
same isolated durable save. They write JSON receipts; this verifier is the CI
oracle, so no shell variable has to survive between workflow steps.

Proves, from the receipts alone:
  * two distinct OS processes wrote them,
  * both used the same durable save and the same A1 binding document,
  * preparation really paid (inputs escrowed, no output before maturity),
  * the reloaded process matured the canonical queue and collected exactly once,
  * the duplicate claim was refused and changed nothing,
  * conservation held (output batch, prepaid inputs, one source-claim receipt,
    and no ghost A3 queue).

Exit 0 only when every assertion holds.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ALLOWED_DUPLICATE_REASONS = {"nothing_to_collect", "ALREADY_CLAIMED"}


def load(path: Path, findings: list[str]) -> dict:
    if not path.exists():
        findings.append(f"missing receipt: {path}")
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive
        findings.append(f"invalid JSON in {path}: {exc}")
        return {}
    if not isinstance(data, dict):
        findings.append(f"receipt is not an object: {path}")
        return {}
    return data


def require(condition: bool, message: str, findings: list[str]) -> None:
    if not condition:
        findings.append(message)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--p1", required=True)
    parser.add_argument("--p2", required=True)
    parser.add_argument("--summary", default="")
    args = parser.parse_args()

    findings: list[str] = []
    p1 = load(Path(args.p1), findings)
    p2 = load(Path(args.p2), findings)

    if p1 and p2:
        require(p1.get("role") == "process_1", "P1 receipt role is not process_1", findings)
        require(p2.get("role") == "process_2", "P2 receipt role is not process_2", findings)
        require(
            int(p1.get("pid", 0)) != int(p2.get("pid", 0)),
            f"P1/P2 are not distinct OS processes (pid {p1.get('pid')} == {p2.get('pid')})",
            findings,
        )
        require(
            p1.get("save_path") == p2.get("save_path"),
            "P1/P2 did not use the same durable save path",
            findings,
        )
        require(
            p1.get("bindings_sha256") == p2.get("bindings_sha256"),
            "A1 binding document hash changed between processes",
            findings,
        )
        require(
            p1.get("job_id") and p1.get("job_id") == p2.get("job_id"),
            "P2 did not reload the job that P1 prepared",
            findings,
        )
        require(
            str(p1.get("a8_status", "")).startswith("REJECTED"),
            "A8 Quarry authorization is not fail-closed in P1",
            findings,
        )
        require(
            int(p1.get("fragment_after_prepare", -1)) == 0,
            "P1 granted production output at prepare time",
            findings,
        )
        require(
            int(p1.get("oak_after", -1)) == int(p1.get("oak_before", -2)) - 5,
            "P1 did not escrow 5 oak_wood",
            findings,
        )
        require(
            int(p1.get("iron_after", -1)) == int(p1.get("iron_before", -2)) - 3,
            "P1 did not escrow 3 iron_scrap",
            findings,
        )
        expected_outputs = p1.get("expected_outputs") or {}
        expected_output = int(expected_outputs.get("quarry_core_fragment", -1))
        require(expected_output > 0, "P1 receipt declares no expected output", findings)

        early = p2.get("early_refusal") or {}
        require(not bool(early.get("ok", True)), "P2 early claim before maturity was accepted", findings)
        collect = p2.get("collect") or {}
        require(bool(collect.get("ok", False)), "P2 first collection did not succeed", findings)
        duplicate = p2.get("duplicate") or {}
        require(not bool(duplicate.get("ok", True)), "P2 duplicate claim was accepted", findings)
        require(
            str(duplicate.get("reason", "")) in ALLOWED_DUPLICATE_REASONS,
            f"P2 duplicate refusal reason unexpected: {duplicate.get('reason')}",
            findings,
        )
        require(
            int(p2.get("output_after_first_claim", -1)) == expected_output,
            f"P2 granted {p2.get('output_after_first_claim')} outputs, expected {expected_output}",
            findings,
        )
        require(
            int(p2.get("output_after_duplicate", -2)) == int(p2.get("output_after_first_claim", -1)),
            "P2 duplicate claim changed inventory",
            findings,
        )
        conservation = p2.get("conservation") or {}
        require(bool(conservation.get("ok", False)), f"P2 conservation failed: {conservation.get('problems')}", findings)
        for label, receipt in (("P1", p1), ("P2", p2)):
            checks = receipt.get("checks") or {}
            require(
                int(checks.get("checks_failed", -1)) == 0,
                f"{label} reported {checks.get('checks_failed')} internal failed check(s)",
                findings,
            )

    summary = {
        "schema": "soh.r13.two_process_summary.v1",
        "p1_pid": p1.get("pid"),
        "p2_pid": p2.get("pid"),
        "save_path": p1.get("save_path"),
        "job_id": p1.get("job_id"),
        "bindings_sha256": p1.get("bindings_sha256"),
        "a8_status": p1.get("a8_status"),
        "granted_output": p2.get("output_after_first_claim"),
        "duplicate_reason": (p2.get("duplicate") or {}).get("reason"),
        "conservation": p2.get("conservation"),
        "findings": findings,
        "ok": not findings,
    }
    if args.summary:
        Path(args.summary).write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        print(f"R13 two-process summary written to {args.summary}")
    print("R13_TWO_PROCESS " + json.dumps({k: summary[k] for k in ("p1_pid", "p2_pid", "job_id", "granted_output", "ok")}))
    if findings:
        for finding in findings:
            print(f"::error::R13 two-process: {finding}")
        print(f"R13 TWO-PROCESS VERIFICATION FAILED - {len(findings)} finding(s)")
        return 1
    print("R13 TWO-PROCESS VERIFICATION PASSED - one paid durable settlement, duplicate refused")
    return 0


if __name__ == "__main__":
    sys.exit(main())
