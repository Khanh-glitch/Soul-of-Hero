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
    "a6": ["game/survival/ui/", "game/survival/player/"],
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
    # A0 has no `game/survival/player/` at all, so A6 is unambiguously its author and
    # replacing the prefix removes nothing from the base.
    ("a6", "game/survival/player/"): "replace",
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
    # Round 12 (CT-GATE-v2026-10-31). A0, A6, A8 and AVFX all moved since round 11,
    # so the three-layer attribution question is re-cut again on new names. Nothing
    # from round 10 or 11 is inherited: those verdicts belong to those bytes.
    "r12_a0": {
        "base": "a0",
        "overlays": [],
        "question": "what can A0's own bytes do before any other owner is composed in?",
    },
    "r12_core": {
        "base": "a0",
        "overlays": ["a1", "a3"],
        "question": "does current A0 mount current A1 geography and current A3 economy alone?",
    },
    "r12_full": {
        "base": "a0",
        "overlays": ["a1", "a3", "a6", "a8"],
        "question": "the product a player would install at the round-12 owner heads, under the current overlay policy",
    },
    # Round 13. Same overlay policy as round 12; only the owner heads move. Round
    # 12's `663a83ede523` stays reproducible through the `r12_*` names because
    # `DEFAULT_REFS` still points at `refs/live12/*`; round 13 is built with
    # `--ref-root refs/live13`, so neither round can silently rebuild the other.
    "r13_a0": {
        "base": "a0",
        "overlays": [],
        "question": "what does the A0 head alone do, at the round-13 SHA?",
    },
    "r13_core": {
        "base": "a0",
        "overlays": ["a1", "a3"],
        "question": "A0 + A1 geography + A3 economy at the round-13 heads",
    },
    # The owners' own join: A0's published `tools/a0/ownership.json` scopes, so
    # A6's title/avatar-choice screens, A1's reader under `tests/survival/world/`
    # and A1's `data/overworld/` all land where their owners and A0 put them.
    # This is the composition A0's own CI builds; A7's narrower map is `r13_full`.
    "r13_heads": {
        "base": "a0",
        "overlays": ["a1", "a3", "a8", "a6"],
        "scope_source": "a0_manifest",
        "question": "the product at the round-13 owner heads, joined by the scopes A0 itself publishes",
    },
    # Round 14: the same policies at the heads the owners advanced to during the
    # round-13 review. `r14_heads` is A0's own manifest join (the product A0's CI
    # builds); `r14_full` is A7's narrower map, kept for comparison.
    "r14_heads": {
        "base": "a0",
        "overlays": ["a1", "a3", "a8", "a6"],
        "scope_source": "a0_manifest",
        "question": "the product at the round-14 owner heads, joined by the scopes A0 itself publishes",
    },
    "r14_full": {
        "base": "a0",
        "overlays": ["a1", "a3", "a6", "a8"],
        "question": "the product at the round-14 owner heads under A7's narrower map",
    },
    "r13_full": {
        "base": "a0",
        "overlays": ["a1", "a3", "a6", "a8"],
        "question": "the product a player would install at the round-13 owner heads, under the current overlay policy",
    },
    # COUNTERFACTUAL, not a shipping candidate. A6's avatar integration lands on
    # paths this map assigns to A0 (`game/characters/knight/knight.tscn`,
    # `game/app/app_root.gd`, the avatar-choice screens). The shipping profile cannot
    # contain them, so "is the avatar merely unmerged, or actually broken?" is
    # unanswerable from `r12_full` alone. This profile copies exactly A6's *changed*
    # files on those paths and nothing else, so the answer is measured instead of
    # argued. It is labelled `r12_wired` everywhere and is never reported as the
    # product.
    "r12_wired": {
        "base": "a0",
        "overlays": ["a1", "a3", "a6", "a8"],
        "question": "COUNTERFACTUAL: if A6's out-of-prefix integration files were accepted by A0, would the avatar actually mount?",
        "extra_files": {
            "a6": [
                "game/characters/knight/knight.tscn",
                "game/app/app_root.gd",
                "game/app/app_flow.gd",
                "game/ui/screens/avatar_choice/avatar_choice_screen.gd",
                "game/ui/screens/avatar_choice/avatar_choice_screen.tscn",
                "game/ui/screens/avatar_choice/a6_avatar_preview.gd",
                "game/ui/screens/home/home_actor.tscn",
                "game/ui/screens/title/title_screen.gd",
                "game/ui/screens/title/title_screen.tscn",
                "game/ui/theme/a6_survival_theme.tres",
            ],
        },
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

#: Round 13's counterfactual is round 12's counterfactual applied to the new heads,
#: so the out-of-prefix file list is inherited rather than retyped (a retyped list
#: is a second source of truth that drifts).
PROFILES["r13_wired"] = {
    **PROFILES["r12_wired"],
    "question": "COUNTERFACTUAL: round-13 heads plus A6's out-of-policy scene/UI files; never a product state",
}

DEFAULT_REFS: Dict[str, str] = {
    "a0": "refs/live12/arena_dea2428e-soul-of-hero",
    "a1": "refs/live12/arena_e385312a-soul-of-hero",
    "a3": "refs/live12/arena_7a12b27e-soul-of-hero",
    # `arena-443f004f` is the old PR24 head. The ACTIVE A6 branch is
    # `arena/05e0328d-soul-of-hero`; round 9 pinned PR24 by mistake and CT's
    # round-10 order names the active branch explicitly.
    "a6": "refs/live12/arena_05e0328d-soul-of-hero",
    "a8": "refs/live12/arena_2d7e6d7a-soul-of-hero",
    "avfx": "refs/live12/arena_c7b0c4e8-soul-of-hero",
    "ct": "refs/live12/docs_ct-loot-discovery-gate-20261030",
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


def a0_manifest_scopes(base_sha: str) -> Dict[str, List[str]]:
    """The owner scopes A0 itself publishes in `tools/a0/ownership.json`.

    A0 owns the integrated runtime, so its declaration of which owner may write
    which path is the product's own answer. A7's map is narrower by design (it
    was written before A0 had a manifest); a profile built from this returns the
    owners' join, not A7's opinion of it.
    """
    try:
        raw = git("show", f"{base_sha}:tools/a0/ownership.json", check=False).stdout
    except SystemExit:
        return {}
    if not raw.strip():
        return {}
    import re

    text = re.sub(r"^\s*#.*$", "", raw, flags=re.M)
    try:
        manifest = json.loads(text)
    except json.JSONDecodeError:
        return {}
    owners = manifest.get("owners", {})
    return {name: list(info.get("scopes", [])) for name, info in owners.items() if info.get("scopes")}


def profile_prefixes(spec: Dict[str, object], base_sha: str, owner: str) -> List[str]:
    declared = spec.get("scopes")
    if isinstance(declared, dict) and owner in declared:
        return list(declared[owner])  # type: ignore[index]
    if spec.get("scope_source") == "a0_manifest":
        return a0_manifest_scopes(base_sha).get(owner, OWNER_PREFIXES[owner])
    return OWNER_PREFIXES[owner]


def profile_mode(spec: Dict[str, object], owner: str, prefix: str) -> str:
    # The owners' own join is additive: A0 copies every owner file inside its
    # declared scope and never deletes a base file just because an owner's fork
    # predates it. `replace` stays A7's default for its narrower map.
    if spec.get("scope_source") == "a0_manifest":
        return "merge"
    return mode_for(owner, prefix)


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
        for prefix in profile_prefixes(spec, base_sha, owner)
        if profile_mode(spec, owner, prefix) == "replace"
    ]
    for mode, blob, path in ls_tree(base_sha):
        if any(path.startswith(p) for p in own_prefixes):
            continue
        provenance.append({"path": path, "owner": base_owner, "source_sha": base_sha, "blob": blob})

    # Index lines: "<mode> <blob>\t<path>" (100644 form is required by update-index).
    lines: List[str] = []
    removed: List[Dict[str, str]] = []
    for owner in overlays:
        prefixes = profile_prefixes(spec, base_sha, owner)
        owner_sha = heads[owner]
        owner_rows = ls_tree(owner_sha, prefixes)
        owner_paths = {path for _mode, _blob, path in owner_rows}
        for mode, blob, path in ls_tree(base_sha, prefixes):
            prefix = next((pre for pre in prefixes if path.startswith(pre)), "")
            if profile_mode(spec, owner, prefix) == "merge":
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
                    "mode": profile_mode(spec, owner, prefix),
                }
            )

    # Exact-path overlay: the counterfactual profile's whole mechanism. Each named
    # file must exist on the owner's head, or the composition refuses to build —
    # a missing file would otherwise look like a passing integration.
    extra_files: Dict[str, List[str]] = dict(spec.get("extra_files", {}) or {})  # type: ignore[arg-type]
    for owner, paths in extra_files.items():
        owner_sha = heads[owner]
        for path in paths:
            rows = ls_tree(owner_sha, [path])
            if not rows:
                raise SystemExit(f"extra file {path} is not on {owner} {owner_sha[:12]}")
            for mode, blob, real_path in rows:
                lines.append(f"{mode} {blob}\t{real_path}")
                provenance.append(
                    {"path": real_path, "owner": owner, "source_sha": owner_sha, "blob": blob,
                     "mode": "counterfactual_exact_file"}
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
        "counterfactual_files": sorted(
            row["path"] for row in provenance if row.get("mode") == "counterfactual_exact_file"
        ),
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
    parser.add_argument(
        "--ref-root",
        default="refs/live12",
        help="rewrite the default owner refs to this ref prefix (e.g. refs/live13); explicit --a0/--a1/... still win",
    )
    for owner in DEFAULT_REFS:
        parser.add_argument(f"--{owner}", default=DEFAULT_REFS[owner])
    args = parser.parse_args()

    refs = {}
    for owner in DEFAULT_REFS:
        explicit = getattr(args, owner) != DEFAULT_REFS[owner]
        value = getattr(args, owner)
        if not explicit:
            value = value.replace("refs/live12", args.ref_root, 1)
        refs[owner] = value
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
