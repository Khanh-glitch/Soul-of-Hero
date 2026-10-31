"""Refresh the pinned A1/A3 data snapshots from the owners' branches.

Earlier rounds produced these snapshots by hand, which made a repin hard to audit.
This script is the reproducible path: it reads `snapshot_manifest.json`, pulls each
listed upstream path from a git ref, writes the snapshot copy and updates the
recorded commit/sha256/size. It refuses to write a snapshot whose upstream file is
missing, and it never invents a commit: the ref's current `rev-parse` is used.

Usage:

    python3 tools/survival/balance/build_snapshot_pins.py \
        --a1 refs/a1 --a3 refs/a3 [--check]

`--check` reports drift without writing.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "data" / "survival" / "balance"
MANIFEST = DATA_DIR / "snapshot_manifest.json"

REF_FOR_OWNER = {"A1": "a1", "A3": "a3"}


def _git(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def _blob(ref: str, path: str) -> bytes:
    result = subprocess.run(
        ["git", "show", f"{ref}:{path}"], cwd=ROOT, capture_output=True
    )
    if result.returncode != 0:
        raise SystemExit(f"missing upstream file {ref}:{path}")
    return result.stdout


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--a1", default="refs/a1")
    parser.add_argument("--a3", default="refs/a3")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)

    refs = {"a1": args.a1, "a3": args.a3}
    heads = {name: _git("rev-parse", ref).strip() for name, ref in refs.items()}
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    changed = []
    for snap in manifest["snapshots"]:
        owner = snap["owner"]
        ref = refs[REF_FOR_OWNER[owner]]
        payload = _blob(ref, snap["upstream_path"])
        digest = hashlib.sha256(payload).hexdigest()
        if digest == snap["sha256"]:
            continue
        changed.append(f"{snap['key']}: {snap['sha256'][:8]} -> {digest[:8]}")
        snap["sha256"] = digest
        snap["size_bytes"] = len(payload)
        snap["upstream_ref"] = refs[REF_FOR_OWNER[owner]].replace("refs/", "arena_")
        snap["upstream_commit"] = heads[REF_FOR_OWNER[owner]]
        snap["snapshot_path"] = f"data/survival/balance/snapshot/{snap['key']}.json"
        if args.check:
            continue
        target = ROOT / snap["snapshot_path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)

    if args.check:
        if changed:
            print("snapshot drift:")
            for row in changed:
                print("  " + row)
            return 2
        print("snapshots up to date")
        return 0

    if not changed:
        print("snapshots up to date; nothing written")
        return 0
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"repinned {len(changed)} snapshot(s): a1={heads['a1'][:8]} a3={heads['a3'][:8]}")
    for row in changed:
        print("  " + row)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
