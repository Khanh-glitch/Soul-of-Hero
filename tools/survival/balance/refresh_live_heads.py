#!/usr/bin/env python3
"""Compare every pinned product byte with the same path on the owner's live branch.

Why this exists: the snapshot the gate reads is a *composition* capture. Each file
records the sha256 it had at the pinned head, but nothing in the artifact says
whether that head is still the owner's head. Without this check a reader can
mistake a month-old composition pin for the current branch, and every static
number in the gate silently describes a branch nobody is working on.

The comparison is local-only and deterministic: `git cat-file` against the live
ref and the pinned head, no network, no clock. The verdict is deliberately blunt.

    PIN_CURRENT              every captured path is byte-identical at the live head
    PIN_STALE                at least one path changed, appeared or vanished
    PIN_BRANCH_DIVERGED      the pinned head is not an ancestor of the live head,
                             so "changed" is not a fast-forward and the two lines
                             may not even share history

No owner branch is modified, and the snapshot is not re-pinned here: this tool
only measures the distance and reports it. Re-pinning is a deliberate act that
requires the composition to be rebuilt, because a path the gate reads can be
absent from the owner's live branch (as `game/survival/chest_inventory_panel.gd`
was when this was written).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional

ROOT = Path(__file__).resolve().parents[3]
MANIFEST = ROOT / "data" / "survival" / "balance" / "snapshot" / "product_manifest.json"
OUT = ROOT / "data" / "survival" / "balance" / "results" / "live_heads.v1.json"

SCHEMA = "soh.balance.live_heads.v1"
VERDICTS = ("PIN_CURRENT", "PIN_STALE", "PIN_BRANCH_DIVERGED")


def git(*args: str) -> Optional[subprocess.CompletedProcess]:
    return subprocess.run(["git", *args], cwd=str(ROOT), capture_output=True)


def resolve(ref: str) -> str:
    out = git("rev-parse", ref)
    if out.returncode != 0:
        raise SystemExit(f"cannot resolve {ref}: {out.stderr.decode().strip()}")
    return out.stdout.decode().strip()


def blob_at(ref: str, path: str) -> Optional[str]:
    """sha256 of the file at that ref, or None when the path is not there."""
    out = git("cat-file", "blob", f"{ref}:{path}")
    if out.returncode != 0:
        return None
    return hashlib.sha256(out.stdout).hexdigest()


def is_ancestor(older: str, newer: str) -> bool:
    return git("merge-base", "--is-ancestor", older, newer).returncode == 0


def compare(manifest: Dict[str, object], refs: Dict[str, str]) -> Dict[str, object]:
    heads = {owner: resolve(refs[owner]) for owner in ("a0", "a1", "a3", "a6", "a8")}
    pinned = {owner: str(manifest.get(f"{owner}_head") or "") for owner in heads}
    rows: List[Dict[str, object]] = []
    for entry in manifest["files"]:
        owner = str(entry["owner"])
        path = str(entry["source_path"])
        live = heads[owner]
        current = blob_at(live, path)
        state = (
            "MISSING_AT_LIVE_HEAD"
            if current is None
            else ("SAME" if current == entry["sha256"] else "CHANGED")
        )
        rows.append(
            {
                "key": entry["key"],
                "owner": owner,
                "source_path": path,
                "pinned_sha256": entry["sha256"],
                "live_sha256": current,
                "state": state,
            }
        )
    owners: List[Dict[str, object]] = []
    for owner in ("a0", "a1", "a3", "a6", "a8"):
        mine = [row for row in rows if row["owner"] == owner]
        counts = {
            state: sum(1 for row in mine if row["state"] == state)
            for state in ("SAME", "CHANGED", "MISSING_AT_LIVE_HEAD")
        }
        relates = (
            "SAME_COMMIT"
            if pinned[owner] == heads[owner]
            else (
                "PINNED_IS_ANCESTOR"
                if pinned[owner] and is_ancestor(pinned[owner], heads[owner])
                else "DIVERGED"
            )
        )
        owners.append(
            {
                "owner": owner,
                "ref": refs[owner],
                "pinned_head": pinned[owner],
                "live_head": heads[owner],
                "history": relates,
                "file_counts": counts,
                "stale": counts["CHANGED"] + counts["MISSING_AT_LIVE_HEAD"] > 0 or relates == "DIVERGED",
            }
        )
    verdict = "PIN_CURRENT"
    if any(owner["history"] == "DIVERGED" for owner in owners):
        verdict = "PIN_BRANCH_DIVERGED"
    elif any(owner["stale"] for owner in owners):
        verdict = "PIN_STALE"
    return {
        "schema": SCHEMA,
        "owners": owners,
        "files": rows,
        "counts": {
            state: sum(1 for row in rows if row["state"] == state)
            for state in ("SAME", "CHANGED", "MISSING_AT_LIVE_HEAD")
        },
        "verdict": verdict,
        "interpretation": (
            "MISSING_AT_LIVE_HEAD means the captured path is absent from the owner's live head. That can be a "
            "deletion, a rename, or a rewritten/rebased branch; this tool does not guess which, and A7 will not "
            "re-point a pin at a path it has not seen the bytes of."
        ),
        "rule": (
            "A pinned snapshot is not a live branch. PIN_BRANCH_DIVERGED means the pinned head is not an "
            "ancestor of the owner's head, so every static number in this gate describes the composition "
            "capture and must be re-measured on a new composition before it can be called current."
        ),
        "reproduce": "python3 tools/survival/balance/refresh_live_heads.py --write",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=str(MANIFEST))
    parser.add_argument("--a0", default="refs/a0")
    parser.add_argument("--a1", default="refs/a1")
    parser.add_argument("--a3", default="refs/a3")
    parser.add_argument("--a6", default="refs/a6")
    parser.add_argument("--a8", default="refs/a8")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    refs = {"a0": args.a0, "a1": args.a1, "a3": args.a3, "a6": args.a6, "a8": args.a8}
    payload = compare(manifest, refs)
    if args.write:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"wrote {OUT.relative_to(ROOT)}")
    print(json.dumps({"verdict": payload["verdict"], "counts": payload["counts"]}))
    for owner in payload["owners"]:
        print(
            "  %-3s pinned %s live %s %-17s same %d changed %d missing %d"
            % (
                owner["owner"],
                owner["pinned_head"][:8],
                owner["live_head"][:8],
                owner["history"],
                owner["file_counts"]["SAME"],
                owner["file_counts"]["CHANGED"],
                owner["file_counts"]["MISSING_AT_LIVE_HEAD"],
            )
        )
    return 0 if payload["verdict"] == "PIN_CURRENT" else 1


if __name__ == "__main__":
    sys.exit(main())
