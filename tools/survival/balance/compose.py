#!/usr/bin/env python3
"""Build an immutable, reproducible composition from the owners' live branches.

A7 audits *integrated* product behaviour, and the integrated product does not
exist on any single owner branch: A0 ships the runtime and vendors a copy of A3,
A1 authors the world data, A6 the UI, A8 the POI internals. Round 7 pinned one
frozen composition and then discovered it described branches nobody was working
on any more (`results/live_heads.v1.json`, `PIN_BRANCH_DIVERGED`).

This tool replaces "some arena branch someone built once" with a declared
composition:

* a **base** owner (A0) whose tree is the starting point,
* explicit **overlay** owners, each with path prefixes it owns,
* everything else recorded as `REFERENCED_NOT_OVERLAID` with the reason.

It writes Git objects only (tree + commit) through a scratch index, so no branch
and no working tree is touched, and it is deterministic: same inputs, same
commit sha. The commit is pinned by tagging it under `refs/comp/<name>`, which is
A7-owned and disposable.

    python3 tools/survival/balance/compose.py --profile full --pin

Profiles exist because integration truth is layered: `a0` is what the runtime
alone does, `world` adds A1+A8 geography, `full` adds A3+A6 on top. A probe that
passes in `a0` and fails in `full` is telling you about the integration, not
about the feature.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "data" / "survival" / "balance" / "results"

SCHEMA = "soh.balance.composition.v1"

#: Which paths each owner writes. Overlays replace the base's copy wholesale so
#: a stale vendored file cannot silently win; anything the owner does not have
#: is *removed* from the overlay prefix, which is the honest reading of "this
#: owner is the source of truth for this subtree".
OWNER_PREFIXES: Dict[str, List[str]] = {
    "a1": ["data/survival/world/"],
    "a3": ["data/survival/items/", "data/survival/recipes/", "data/survival/economy/", "game/survival/economy/"],
    "a6": ["game/survival/ui/"],
    "a8": ["game/survival/world_content/", "data/survival/world_content/"],
    # Round 10. A6's active branch keeps its whole survival UI (avatar art, return
    # cards, projection contract) under `game/survival/ui/`, which A0 does not have
    # at all. Its copies of `game/app/*` and `game/ui/screens/*` are A0-owned paths
    # in this map and are NOT overlaid: they are A6's older view of A0's files, and
    # copying them would silently revert the base. That difference is reported by
    # the composition rather than hidden.
}

#: How each prefix is applied.
#:
#: `replace` — the overlay owns the subtree: its files land and the base's stale
#: copies under that prefix are removed. Correct for authored data and for UI that
#: one owner ships whole.
#:
#: `merge` — the overlay's files are added and the base's copies are LEFT ALONE.
#: This is what a vendored dependency needs: A0 vendors `vendor/a3_economy_service.gd`
#: and A3 ships the canonical `economy_service.gd`, and deleting A0's copy would
#: break the runtime rather than measure the drift.
PREFIX_MODES: Dict[Tuple[str, str], str] = {
    ("a1", "data/survival/world/"): "replace",
    ("a3", "data/survival/items/"): "replace",
    ("a3", "data/survival/recipes/"): "replace",
    ("a3", "data/survival/economy/"): "replace",
    ("a3", "game/survival/economy/"): "merge",
    ("a6", "game/survival/ui/"): "replace",
    ("a8", "game/survival/world_content/"): "replace",
    ("a8", "data/survival/world_content/"): "replace",
}


def mode_for(owner: str, prefix: str) -> str:
    return PREFIX_MODES.get((owner, prefix), "replace")


#: Profiles are ordered: later overlays land on top of earlier ones.
PROFILES: Dict[str, Dict[str, object]] = {
    "a0": {
        "base": "a0",
        "overlays": [],
        "question": "what does the runtime commit alone actually do?",
    },
    "world": {
        "base": "a0",
        "overlays": ["a1", "a8"],
        "question": "does the authored continent mount in the runtime?",
    },
    "economy": {
        "base": "a0",
        "overlays": ["a3"],
        "question": "does A3's current economy vendor cleanly into A0's runtime?",
    },
    "full": {
        "base": "a0",
        "overlays": ["a1", "a3", "a6", "a8"],
        "question": "the integrated product an owner would actually ship",
    },
    # Round 9's question is narrower than `full`: A0's current runtime plus the
    # two owners whose work it now claims to mount (A1 geography, A3 V7 economy).
    # A6/A8 are added separately so a failure can be attributed to the layer that
    # introduced it instead of to "the composition".
    "r9_core": {
        "base": "a0",
        "overlays": ["a1", "a3"],
        "question": "can the current runtime mount its own Waystation against live A1 and A3 V7?",
    },
    "r9_full": {
        "base": "a0",
        "overlays": ["a1", "a3", "a6", "a8"],
        "question": "the same question with the UI and POI layers on top",
    },
    # Round 10 (CT P0). Current head of every owner, active A6 branch included.
    # `r10_core` is the attribution base: it answers whether a failure survives
    # without A6/A8, so a defect is never blamed on "the composition".
    # Attribution base: A0's bytes alone, which is what A0's own CI runs. A claim
    # that is green here and red on `r10_full` is a *composition* defect, not an A0
    # one, and that distinction has to be measurable rather than argued.
    "r10_a0": {
        "base": "a0",
        "overlays": [],
        "question": "does A0's own green claim survive its own bytes, before any overlay?",
    },
    "r10_core": {
        "base": "a0",
        "overlays": ["a1", "a3"],
        "question": "does the current A0 runtime mount current A1 geography and A3 V7 alone?",
    },
    "r10_full": {
        "base": "a0",
        "overlays": ["a1", "a3", "a6", "a8"],
        "question": "the product a player would actually install, at current owner heads",
    },
    # Round 11 (CT multidimensional gate). Same three-layer attribution question as
    # round 10, re-cut against refs that all five owners have moved since. The
    # profiles are *new* names on purpose: a round-10 verdict belongs to the
    # round-10 bytes, and reusing the profile name would silently transfer an old
    # failure to a tree that may not have it.
    "r11_a0": {
        "base": "a0",
        "overlays": [],
        "question": "what can A0's own bytes do before any other owner is composed in?",
    },
    "r11_core": {
        "base": "a0",
        "overlays": ["a1", "a3"],
        "question": "does current A0 mount current A1 geography and current A3 V7 alone?",
    },
    "r11_full": {
        "base": "a0",
        "overlays": ["a1", "a3", "a6", "a8"],
        "question": "the integrated product a player would install at the round-11 owner heads",
    },
}

#: Owners whose work is pinned for provenance but cannot be overlaid without
#: downgrading the base: AVFX's unique bytes are CI workflows and docs, and the
#: engine-facing VFX assets it shares with A0 are byte-identical or older.
REFERENCE_ONLY: Dict[str, str] = {
    "avfx": (
        "pinned for provenance only: its unique paths are .github/workflows and docs/vfx, and every VFX "
        "asset it shares with A0 is identical or older, so overlaying it would downgrade the base"
    ),
}

DEFAULT_REFS: Dict[str, str] = {
    "a0": "refs/live/arena-dea2428e",
    "a1": "refs/live/arena-e385312a",
    "a3": "refs/live/arena-7a12b27e",
    # `arena-443f004f` is the old PR24 head. The ACTIVE A6 branch is
    # `arena/05e0328d-soul-of-hero`; round 9 pinned PR24 by mistake and CT's
    # round-10 order names the active branch explicitly.
    "a6": "refs/live/arena-05e0328d",
    "a8": "refs/live/arena-2d7e6d7a",
    "avfx": "refs/live/arena-c7b0c4e8",
    "ct": "refs/live/docs-ct-loot-discovery-gate-20261030",
}


def git(*args: str, env: Optional[Dict[str, str]] = None, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=check,
        env={**os.environ, **(env or {})},
    )


def resolve(ref: str) -> str:
    out = git("rev-parse", ref)
    return out.stdout.strip()


def ls_tree(sha: str, prefixes: Sequence[str] = ()) -> List[Tuple[str, str, str]]:
    """(mode, blob, path) for the given ref, restricted to `prefixes`."""
    out = git("ls-tree", "-r", sha, "--", *prefixes)
    rows: List[Tuple[str, str, str]] = []
    for line in out.stdout.splitlines():
        meta, path = line.split("\t", 1)
        mode, kind, blob = meta.split()
        if kind == "blob":
            rows.append((mode, blob, path))
    return rows


def _index_env(tmp_index: Path) -> Dict[str, str]:
    return {"GIT_INDEX_FILE": str(tmp_index)}


def build(profile: str, refs: Dict[str, str], work: Path, pin: bool) -> Dict[str, object]:
    spec = PROFILES[profile]
    base_owner = str(spec["base"])
    overlays: List[str] = list(spec["overlays"])  # type: ignore[arg-type]
    base_sha = resolve(refs[base_owner])
    heads = {owner: resolve(refs[owner]) for owner in refs if owner != "ct"}
    ct_sha = resolve(refs["ct"]) if "ct" in refs else ""

    index = work / f"index.{profile}"
    if index.exists():
        index.unlink()
    env = _index_env(index)
    git("read-tree", base_sha, env=env)

    provenance: List[Dict[str, object]] = []
    # Base files, minus any prefix an overlay *replaces*.
    own_prefixes = [
        prefix
        for owner in overlays
        for prefix in OWNER_PREFIXES[owner]
        if mode_for(owner, prefix) == "replace"
    ]
    for mode, blob, path in ls_tree(base_sha):
        if any(path.startswith(p) for p in own_prefixes):
            continue
        provenance.append({"path": path, "owner": base_owner, "source_sha": base_sha, "blob": blob})

    # Index lines: "<mode> <blob>\t<path>" (100644 form is required by update-index).
    lines: List[str] = []
    removed: List[Dict[str, str]] = []
    for owner in overlays:
        prefixes = OWNER_PREFIXES[owner]
        owner_sha = heads[owner]
        owner_rows = ls_tree(owner_sha, prefixes)
        owner_paths = {path for _mode, _blob, path in owner_rows}
        for mode, blob, path in ls_tree(base_sha, prefixes):
            prefix = next((pre for pre in prefixes if path.startswith(pre)), "")
            if mode_for(owner, prefix) == "merge":
                continue
            if path not in owner_paths:
                lines.append(f"0 {'0' * 40}\t{path}")
                removed.append({"path": path, "was": base_owner, "because": f"{owner} is authoritative for {prefixes}"})
        for mode, blob, path in owner_rows:
            prefix = next((pre for pre in prefixes if path.startswith(pre)), "")
            lines.append(f"{mode} {blob}\t{path}")
            provenance.append(
                {
                    "path": path,
                    "owner": owner,
                    "source_sha": owner_sha,
                    "blob": blob,
                    "mode": mode_for(owner, prefix),
                }
            )

    if lines:
        proc = subprocess.run(
            ["git", "update-index", "--index-info"],
            cwd=str(ROOT),
            input="\n".join(lines) + "\n",
            text=True,
            capture_output=True,
            env={**os.environ, **env},
        )
        if proc.returncode != 0:
            raise SystemExit(f"update-index failed: {proc.stderr.strip()}")

    tree = git("write-tree", env=env).stdout.strip()

    # Deterministic commit: fixed identity and date, parents = base + overlays so a
    # reader can walk to the exact owner commits this tree was cut from.
    parents = [base_sha] + [heads[owner] for owner in overlays]
    message = (
        f"composition:{profile}\n\n"
        f"base {base_owner} {base_sha}\n"
        + "".join(f"overlay {owner} {heads[owner]}\n" for owner in overlays)
        + f"ct {ct_sha}\n"
    )
    commit_env = {
        "GIT_AUTHOR_NAME": "A7 composition",
        "GIT_AUTHOR_EMAIL": "a7@invalid",
        "GIT_AUTHOR_DATE": "2026-10-30T00:00:00+0000",
        "GIT_COMMITTER_NAME": "A7 composition",
        "GIT_COMMITTER_EMAIL": "a7@invalid",
        "GIT_COMMITTER_DATE": "2026-10-30T00:00:00+0000",
    }
    args = ["commit-tree", tree, "-m", message]
    for parent in parents:
        args += ["-p", parent]
    commit = git(*args, env=commit_env).stdout.strip()

    provenance.sort(key=lambda row: str(row["path"]))
    payload = {
        "schema": SCHEMA,
        "profile": profile,
        "question": spec["question"],
        "commit": commit,
        "tree": tree,
        "base": {"owner": base_owner, "ref": refs[base_owner], "sha": base_sha},
        "overlays": [
            {
                "owner": owner,
                "ref": refs[owner],
                "sha": heads[owner],
                "prefixes": [{"path": pre, "mode": mode_for(owner, pre)} for pre in OWNER_PREFIXES[owner]],
                "file_count": sum(1 for row in provenance if row["owner"] == owner),
            }
            for owner in overlays
        ],
        "reference_only": [{"owner": owner, "sha": heads[owner], "why": why} for owner, why in REFERENCE_ONLY.items()],
        "control_tower": {"ref": refs.get("ct", ""), "sha": ct_sha},
        "files": len(provenance),
        "removed_from_base": removed,
        "provenance": provenance,
        "provenance_digest": hashlib.sha256(
            "\n".join(f"{row['path']}:{row['owner']}:{row['blob']}" for row in provenance).encode()
        ).hexdigest(),
        "reproduce": (
            "python3 tools/survival/balance/compose.py --profile "
            f"{profile} --pin  # then: git worktree add --detach /tmp/comp {commit}"
        ),
        "rule": (
            "A composition is not an owner branch and no owner file is edited to build it. Every path names "
            "the commit its bytes came from; a path an overlay owns is either that overlay's blob or absent, "
            "never the base's stale copy."
        ),
    }
    if pin:
        git("update-ref", f"refs/comp/{profile}", commit)
        payload["pinned_ref"] = f"refs/comp/{profile}"
    (work / f"composition.{profile}.json").write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return payload


def _summarise(profile: Dict) -> Dict:
    """The profile without its per-file provenance rows."""
    return {
        key: value
        for key, value in profile.items()
        if key not in {"provenance", "files_by_owner"}
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="full", choices=sorted(PROFILES))
    parser.add_argument("--all", action="store_true", help="build every profile")
    parser.add_argument("--pin", action="store_true", help="also write refs/comp/<profile>")
    parser.add_argument("--write", default="", help="directory for composition.<profile>.json")
    parser.add_argument("--merge-manifest", default="", help="write one manifest covering every built profile")
    # The full manifest records one provenance row per file (5 MB for four
    # profiles). That belongs in a local run, not in git, so the committed copy is
    # the digest-level summary and the per-file rows stay reproducible on demand.
    parser.add_argument(
        "--summary",
        action="store_true",
        help="with --merge-manifest: write only digests and counts, not per-file provenance",
    )
    for owner in DEFAULT_REFS:
        parser.add_argument(f"--{owner}", default=DEFAULT_REFS[owner])
    args = parser.parse_args()

    refs = {owner: getattr(args, owner) for owner in DEFAULT_REFS}
    work = Path(args.write) if args.write else Path(os.environ.get("TMPDIR", "/tmp")) / "soh-compose"
    work.mkdir(parents=True, exist_ok=True)

    profiles = sorted(PROFILES) if args.all else [args.profile]
    built = []
    for profile in profiles:
        payload = build(profile, refs, work, args.pin)
        built.append(payload)
        print(f"{profile:8s} {payload['commit'][:12]}  files={payload['files']:5d}  overlays={','.join(o['owner'] for o in payload['overlays']) or '-'}")

    if args.merge_manifest:
        target = Path(args.merge_manifest)
        target.parent.mkdir(parents=True, exist_ok=True)
        rows = [_summarise(profile) for profile in built] if args.summary else built
        payload = {"schema": SCHEMA + ".set", "profiles": rows}
        if args.summary:
            payload["rule"] = (
                "Digest-level manifest. Every per-file {path, owner, source_sha, blob} row is reproducible with "
                "`python3 tools/survival/balance/compose.py --all --write <dir>`; it is not committed because it is "
                "5 MB of derivable data."
            )
        target.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"wrote {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
