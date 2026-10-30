#!/usr/bin/env python3
"""Capture the *pinned* production-surface snapshot that the product audit reads.

Why a separate capture step: A7 never runs Godot and must not read another
agent's moving branch at analysis time. This script copies the exact files the
audit needs into ``data/survival/balance/snapshot/product/`` and writes
``snapshot/product_manifest.json`` with the source ref, path and sha256 of every
copy plus a small derived index (mounts, avatar art references, UI inventory).

Run it only when you deliberately want to move the pin:

    python3 tools/survival/balance/build_product_snapshot.py \
        --a0 refs/a0 --a6 refs/a6 --a8 refs/a8

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
        # integration seam: the only authorized commit path
        "game/autoload/save_service.gd",
        # A0 mirrors A3's item/source catalog; a drift between the copies is a
        # silent item-mapping defect, so the mirror is pinned too.
        "data/survival/items/sources.json",
        "game/survival/survival_service.gd",
        "game/survival/survival_resource_node.gd",
        # the ordinary menu route: Home hub -> campaign tab -> overworld
        "game/app/app_flow.gd",
        "game/ui/screens/hub/tabs/campaign_tab.gd",
        "game/ui/screens/hub/tabs/campaign_tab.tscn",
        "game/ui/screens/home/home_map_screen.tscn",
        # A0's own native entry + separate-process test, and the workflow that runs it
        "tests/survival_normal_entry_home_restart_test.gd",
        "tests/survival_normal_home_journey_test.gd",
        ".github/workflows/a0-normal-entry-home-restart.yml",
        # The only path that has ever paid an A3-authorized cache reward, plus the
        # player-input half of the same pilot. Both are pinned so their own headers
        # ("fixture", "isolated connector") can be quoted instead of paraphrased.
        "tests/survival_waystation_authority_test.gd",
        "tests/survival_waystation_input_restart_test.gd",
        ".github/workflows/a0-waystation-input-restart.yml",
        # The survival catalog decides which physical harvest nodes exist; the
        # first-hour material chain cannot be computed without it.
        "data/survival/survival_catalog.json",
        # The world-slice custody guard is what stops a generic transaction from
        # manufacturing world rights, so it belongs to the commit seam.
        "game/survival/economy/unique_ownership_guard.gd",
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
        "game/survival/ui/avatar_appearance_adapter.gd",
        "game/survival/ui/avatar_art_manifest.json",
    ],
    "a8": [
        "game/survival/world_content/scenes/south_quarry.tscn",
        "game/survival/world_content/scenes/south_orchard_ruin.tscn",
        "game/survival/world_content/scenes/south_crown_mill.tscn",
        "game/survival/world_content/scenes/poi_pilot.tscn",
        "game/survival/world_content/scripts/native_poi_site.gd",
        "game/survival/world_content/scripts/native_poi_shell.gd",
        "game/survival/world_content/scripts/poi_authority_fixture.gd",
        "game/survival/world_content/scripts/poi_pilot.gd",
        "data/survival/world_content/sites/south_quarry.json",
        "data/survival/world_content/sites/south_orchard_ruin.json",
        "data/survival/world_content/sites/south_crown_mill.json",
        "data/survival/world_content/interaction_contract.v1.json",
        # A8's explicit integration candidate: which actions still need A3 pricing
        "data/survival/world_content/quarry_integration_candidate.v1.json",
    ],
    "a1": [
        # The vertical-slice handoff contract is where A1 states instance ids, reward
        # rights, transaction keys and the A3 source bindings for the first hour.
        "data/survival/world/vertical_slice/handoff_contracts.json",
        "data/survival/world/poi_authoring/poi_crown_waystation.v1.json",
        # A1's own statement of whether the first-hour corridor is production
        # playable, and which mount it is waiting for.
        "data/survival/world/corridor/crown_roadside.corridor.v1.json",
    ],
    "a3": [],  # A3 authored data already comes from the data snapshots; nothing to copy here
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

# Only code/asset paths are indexed: the audit needs to know whether a referenced
# file exists, not to carry docs or CI configuration around.
TREE_SUFFIXES = (".tscn", ".tres", ".gd", ".png", ".import", ".res")
TREE_OWNERS = ("a0", "a6")


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
    parser.add_argument(
        "--a8",
        default="refs/a8",
        help="git ref holding the A8 native POI content tree (PR26 branch; A8's own task branch carries docs only)",
    )
    parser.add_argument("--a8-task", default="", help="optional A8 task-branch ref, recorded for provenance only")
    parser.add_argument("--a1", default="refs/a1", help="git ref holding the A1 world/contract tree")
    args = parser.parse_args()

    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []
    refs = {"a0": args.a0, "a6": args.a6, "a8": args.a8, "a1": args.a1}
    for owner, paths in CAPTURE.items():
        if not paths:
            continue
        ref = refs[owner]
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
            if name == "survival_ui_mounts":
                rows.extend(git_grep(args.a8, pattern, ["game/"]))
        deduped = {(row["path"], row["line"], row["pattern"]): row for row in rows}
        index[name] = [deduped[key] for key in sorted(deduped)]

    # Every scene in both trees, so the audit can say which survival UI scene is
    # referenced by another scene (mounted) and which exists only as a file.
    scenes = sorted(
        {
            path
            for ref in (args.a0, args.a6, args.a8)
            for path in git_ls(ref, "game")
            if path.endswith(".tscn")
        }
    )
    scene_refs: dict[str, list[str]] = {}
    for pattern in ("ext_resource", 'preload("res://'):
        for ref in (args.a0, args.a6, args.a8):
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

    # A path index of the owners' code/asset files. Existence checks (an avatar
    # sheet, a scene, a script) are only honest if the tool can see the tree.
    tree_lines: list[str] = []
    for owner in TREE_OWNERS:
        for path in git_ls(refs[owner], "."):
            if path.endswith(TREE_SUFFIXES):
                tree_lines.append(f"{owner}\t{path}")
    tree_lines.sort()
    tree_payload = ("\n".join(tree_lines) + "\n").encode("utf-8")
    tree_target = SNAPSHOT_DIR / "tree_index.txt"
    tree_target.write_bytes(tree_payload)

    manifest = {
        "schema": "soh.balance.product_snapshot.v1",
        "tree_index": {
            "path": "data/survival/balance/snapshot/product/tree_index.txt",
            "sha256": hashlib.sha256(tree_payload).hexdigest(),
            "lines": len(tree_lines),
            "owners": list(TREE_OWNERS),
            "suffixes": list(TREE_SUFFIXES),
        },
        "sources": {"a0_ref": args.a0, "a6_ref": args.a6, "a8_ref": args.a8},
        "a0_head": subprocess.run(["git", "rev-parse", args.a0], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip(),
        "a6_head": subprocess.run(["git", "rev-parse", args.a6], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip(),
        "a8_head": subprocess.run(["git", "rev-parse", args.a8], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip(),
        "a1_head": subprocess.run(["git", "rev-parse", args.a1], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip(),
        "a8_task_head": (
            subprocess.run(["git", "rev-parse", args.a8_task], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip()
            if args.a8_task
            else None
        ),
        "a8_note": (
            "A8 native POI scenes live on the PR26 branch; the A8 task branch carries docs only. Both heads are "
            "recorded so a reader cannot mistake the doc branch for the scene branch."
        ),
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
