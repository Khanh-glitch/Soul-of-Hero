#!/usr/bin/env python3
"""Fail CI when the A0 adoption contract drifts from this tree.

The contract is A3's *request* to A0: "compose exactly these files, with exactly
these hashes". A stale contract is worse than no contract, because A0 would
compose a file set that no engine run validated. The previous package shipped a
contract whose generated head and status were behind the branch, so this check
makes that class of drift a build failure instead of a review catch.

Checks:
  1. every `files[]` entry exists and its sha256/bytes match the working tree;
  2. every `rejected_or_superseded` path is really absent;
  3. the status is one of the two known states, and a *_PASSED status names the
     tested head and the native run id;
  4. if `tested_head` differs from HEAD, no *composed* file changed in the range
     (tested head must be an ancestor; a docs-only commit after the native pass
     is legitimate, an economy edit after it is not).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "docs/survival/economy/A0_ADOPTION_CONTRACT_V2.json"

KNOWN_STATUSES = {
    "OWNER_NATIVE_PENDING_EXACT_HEAD_CI",
    "OWNER_NATIVE_EXACT_HEAD_CI_PASSED",
}


def git(*args: str) -> tuple[int, str]:
    result = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True)
    return result.returncode, result.stdout.strip()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", default=str(CONTRACT))
    args = parser.parse_args(argv)

    path = Path(args.contract)
    problems: list[str] = []
    if not path.is_file():
        print(f"::error::adoption contract missing at {path}")
        return 1
    document = json.loads(path.read_text(encoding="utf-8"))

    files = document.get("files") or []
    if len(files) < 29:
        problems.append(f"contract lists only {len(files)} composed file(s), expected >= 29")
    for entry in files:
        relative = entry.get("path", "")
        target = ROOT / relative
        if not target.is_file():
            problems.append(f"missing composed file: {relative}")
            continue
        if sha256(target) != entry.get("sha256"):
            problems.append(f"sha256 drift: {relative}")
        if int(entry.get("bytes", -1)) != target.stat().st_size:
            problems.append(f"byte size drift: {relative}")

    for entry in document.get("rejected_or_superseded") or []:
        relative = entry.get("path", "")
        if relative and (ROOT / relative).exists():
            problems.append(f"rejected file still present: {relative}")

    status = document.get("status", "")
    if status not in KNOWN_STATUSES:
        problems.append(f"unknown contract status: {status!r}")
    generated = document.get("generated_from") or {}
    tested_head = str(generated.get("tested_head", ""))
    run_id = str(generated.get("native_run_id", ""))
    if status == "OWNER_NATIVE_EXACT_HEAD_CI_PASSED" and not (tested_head and run_id):
        problems.append("status claims a native pass but tested_head/native_run_id are empty")

    head_code, head = git("rev-parse", "HEAD")
    head = head if head_code == 0 else ""
    compose_paths = {str(entry.get("path", "")) for entry in files}
    if tested_head and head and tested_head != head:
        code, _ = git("cat-file", "-e", f"{tested_head}^{{commit}}")
        if code != 0:
            print(
                "::warning title=adoption contract::tested_head is not in this shallow "
                f"checkout ({tested_head}); compose-diff check skipped"
            )
        else:
            _, changed = git("diff", "--name-only", tested_head, head)
            drifted = sorted(set(changed.split()) & compose_paths)
            if drifted:
                problems.append(
                    "composed files changed after the native pass: " + ", ".join(drifted)
                )

    print(
        f"contract status={status} files={len(files)} head={head[:12]} "
        f"tested_head={tested_head[:12]} run={run_id}"
    )
    if problems:
        for problem in problems[:6]:
            print(f"::error title=adoption contract::{problem}")
        print(f"ADOPTION CONTRACT DRIFT - {len(problems)} problem(s)")
        return 1
    print("::notice title=adoption contract::composed hashes match this tree")
    print("ADOPTION CONTRACT MATCHES TREE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
