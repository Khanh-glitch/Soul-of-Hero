#!/usr/bin/env python3
"""Capture the *pinned* production-surface snapshot that the product audit reads.

Why a separate capture step: A7 never runs Godot and must not read another
agent's moving branch at analysis time. This script copies the exact files the
audit needs into ``data/survival/balance/snapshot/product/`` and writes
``snapshot/product_manifest.json`` with the source ref, path and sha256 of every
copy plus a small derived index (mounts, avatar art references, UI inventory).

Run it only when you deliberately want to move the pin:

    python3 tools/survival/balance/build_product_snapshot.py \
        --a0 refs/a0 --a6 refs/a6

The analyzer itself never needs git: it verifies the copies against the
manifest, so a shallow clone reproduces every number.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT_DIR = ROOT / "data" / "survival" / "balance" / "snapshot" / "product"
MANIFEST = ROOT / "data" / "survival" / "balance" / "snapshot" / "product_manifest.json"

CAPTURE = {
    "a0": [
        "game/ui/screens/home/home_map_screen.gd",
        "game/app/app_root.gd",
        "game/main.tscn",
        "project.godot",
        "game/characters/knight/knight.tscn",
        "game/overworld/chapter1_overworld.tscn",
        "game/world/interactables/chest.gd",
        "game/ui/hud.gd",
        "game/overworld/overworld_hud.gd",
        "game/survival/chest_inventory_panel.gd",
    ],
    "a6": [
        "game/survival/ui/player_first_hud.gd",
        "game/survival/ui/acceptance_journeys.gd",
        "game/survival/ui/expedition_workspace.gd",
        "game/survival/ui/expedition_planner.gd",
        "game/survival/ui/expedition_map.gd",
        "game/survival/ui/survival_journal.gd",
        "game/survival/ui/survival_view_adapter.gd",
        "game/survival/ui/a0_storage_command_adapter.gd",
    ],
}

# Tree-wide facts that cannot be captured as whole files without bloating the repo.
# Each pattern records file:line so the audit can cite an exact location.
INDEX_PATTERNS = {
    "avatar_or_character_art": [
        r"555940",
        r"419402",
        r"180537",
        r"game/characters/knight",
        r"knight\.png",
        r"adventurer",
    ],
    "survival_ui_mounts": [
        r"survival/ui/",
        r"player_first_hud",
        r"expedition_workspace",
        r"survival_journal",
    ],
}
INDEX_SCOPE = ["game/", "docs/survival/ux/"]


def git_bytes(ref: str, path: str) -> bytes:
    return subprocess.run(
        ["git", "cat-file", "blob", f"{ref}:{path}"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    ).stdout


def git_ls(ref: str, prefix: str = "") -> list[str]:
    out = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", ref, prefix or "."],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return [line for line in out.splitlines() if line]


def git_grep(ref: str, pattern: str, scope: list[str]) -> list[dict]:
    hits: list[dict] = []
    for prefix in scope:
        proc = subprocess.run(
            ["git", "grep", "-n", "-I", "-E", pattern, ref, "--", prefix],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        for line in proc.stdout.splitlines():
            # "ref:path:line:content"
            head, _, content = line.partition(":")
            rest = line[len(head) + 1 :]
            path, _, tail = rest.partition(":")
            number, _, text = tail.partition(":")
            if not number.isdigit():
                continue
            hits.append(
                {
                    "path": path,
                    "line": int(number),
                    "pattern": pattern,
                    "text": text.strip()[:200],
                }
            )
    return hits


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--a0", default="refs/a0", help="git ref holding the A0 production tree")
    parser.add_argument("--a6", default="refs/a6", help="git ref holding the A6 UI tree")
    args = parser.parse_args()

    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []
    for owner, paths in CAPTURE.items():
        ref = args.a0 if owner == "a0" else args.a6
        for path in paths:
            payload = git_bytes(ref, path)
            target = SNAPSHOT_DIR / f"{owner}.{Path(path).name}"
            target.write_bytes(payload)
            entries.append(
                {
                    "key": f"{owner}.{Path(path).name}",
                    "owner": owner,
                    "source_path": path,
                    "size_bytes": len(payload),
                    "sha256": hashlib.sha256(payload).hexdigest(),
                }
            )

    index: dict[str, list[dict]] = {}
    for name, patterns in INDEX_PATTERNS.items():
        rows: list[dict] = []
        for pattern in patterns:
            rows.extend(git_grep(args.a6 if name == "survival_ui_mounts" else args.a0, pattern, INDEX_SCOPE))
            if name == "avatar_or_character_art":
                rows.extend(git_grep(args.a6, pattern, INDEX_SCOPE))
        deduped = {(row["path"], row["line"], row["pattern"]): row for row in rows}
        index[name] = [deduped[key] for key in sorted(deduped)]

    # Every scene in both trees, so the audit can say which survival UI scene is
    # referenced by another scene (mounted) and which exists only as a file.
    scenes = sorted(
        {
            path
            for ref in (args.a0, args.a6)
            for path in git_ls(ref, "game")
            if path.endswith(".tscn")
        }
    )
    scene_refs: dict[str, list[str]] = {}
    for pattern in ("ext_resource", 'preload("res://'):
        for ref in (args.a0, args.a6):
            for line in subprocess.run(
                ["git", "grep", "-n", "-I", "-F", pattern, ref, "--", "game"],
                cwd=ROOT,
                capture_output=True,
                text=True,
            ).stdout.splitlines():
                match = re.search(r'res://([^"]+)"', line)
                if not match:
                    continue
                target = match.group(1)
                origin = line.split(":", 2)[1]
                scene_refs.setdefault(target, [])
                if origin not in scene_refs[target]:
                    scene_refs[target].append(origin)

    manifest = {
        "schema": "soh.balance.product_snapshot.v1",
        "sources": {"a0_ref": args.a0, "a6_ref": args.a6},
        "a0_head": subprocess.run(["git", "rev-parse", args.a0], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip(),
        "a6_head": subprocess.run(["git", "rev-parse", args.a6], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip(),
        "files": entries,
        "ui_scenes": scenes,
        "scene_mount_refs": {path: refs for path, refs in sorted(scene_refs.items()) if path.endswith(".tscn")},
        "index": index,
        "note": (
            "Read-only copies of another owner's files, pinned by sha256. A7 never edits them; "
            "the audit asserts on these bytes only."
        ),
    }
    MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {len(entries)} files + manifest ({MANIFEST.relative_to(ROOT)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
