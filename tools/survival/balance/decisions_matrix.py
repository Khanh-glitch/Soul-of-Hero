#!/usr/bin/env python3
"""D055–D061 owner matrix, computed from one exact composition tree.

The point of this file is to stop a report from *describing* decisions in prose.
Every row answers three questions with paths and line numbers from the tree being
audited:

* is the rule implemented (symbol present), partial, or absent;
* who owns the missing half;
* which native probe would prove it once it exists.

Nothing is inferred from a document. A decision is `IMPLEMENTED` only when its
required symbols are all present in the audited tree; `PARTIAL` when some are and
`ABSENT` when none are. A doc that *claims* the rule never lifts a row.

Usage::

    python3 tools/survival/balance/decisions_matrix.py --tree /path/to/worktree \
        --sha 28f2d578... --write data/survival/balance/results/decisions.v1.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Dict, List

SCHEMA = "soh.balance.decisions.v1"

#: Every requirement names a glob of files to search and a regex that must match.
#: `runtime` rows are checked in production code only; a comment or a doc mention
#: never satisfies them because the regexes are matched against code lines with
#: comments stripped.
REQUIREMENTS: Dict[str, List[Dict[str, str]]] = {
    # Scope matters more than the pattern. `run_id` exists all over the combat
    # layer as a campaign-level run, `reset_run()` resets a combat level and
    # `clock_seconds` appears inside an error-message string. A requirement is
    # therefore only satisfied inside the *durable* namespace that owns it.
    "D055": [
        {"id": "durable_run_key", "scope": "game/autoload/save_service.gd,game/survival/**/*.gd",
         "regex": r'["\'](run_id|run_started_at|run_expires_at)["\']:',
         "why": "the run must be a persisted save key, not a local variable"},
        {"id": "expiry_1209600", "scope": "game/**/*.gd", "regex": r"1_?209_?600",
         "why": "14x24x3600 seconds must be enforced somewhere"},
        {"id": "season_end_entry", "scope": "game/autoload/save_service.gd,game/survival/**/*.gd",
         "regex": r"func\s+(end_run|settle_season|close_season|start_run|begin_season)\s*\(",
         "why": "a season must be able to end and a new one to begin"},
    ],
    "D056": [
        {"id": "profile_achievements", "scope": "game/autoload/save_service.gd,game/survival/**/*.gd",
         "regex": r'["\']achievements["\']', "why": "durable account achievements"},
        {"id": "run_history", "scope": "game/autoload/save_service.gd,game/survival/**/*.gd",
         "regex": r'["\']run_history["\']', "why": "immutable result record per completed run"},
        {"id": "season_reset_entry", "scope": "game/autoload/save_service.gd,game/survival/**/*.gd",
         "regex": r"func\s+(start_new_run|reset_season|wipe_run|new_run)\s*\(",
         "why": "the next run starts from zero; a combat `reset_run()` is not this"},
    ],
    "D057": [
        {"id": "quest_state", "scope": "game/survival/**/*.gd,game/app/**/*.gd",
         "regex": r'["\']quests?["\']', "why": "the starter chain must exist as state"},
        {"id": "quest_receipt_run_scoped", "scope": "game/**/*.gd",
         "regex": r"quest[^\n]*run_id|run_id[^\n]*quest", "why": "paid once per run, not once ever"},
    ],
    "D058": [
        {"id": "start_selector", "scope": "game/**/*.gd",
         "regex": r"func\s+(random_start|choose_start|eligible_start|pick_start|select_start)\s*\(",
         "why": "a run start must be chosen, not authored once"},
        {"id": "eligible_cell_set", "scope": "data/**/*.json",
         "regex": r"eligible_start|start_candidates", "why": "A1 must publish the candidate pool"},
    ],
    "D059": [
        {"id": "satiety_state", "scope": "game/autoload/save_service.gd,game/survival/**/*.gd",
         "regex": r'["\'](satiety|hunger|starvation)["\']', "why": "offline hunger needs a persisted hunger value"},
        {"id": "hp_floor", "scope": "game/autoload/save_service.gd,game/survival/**/*.gd",
         "regex": r"hp_floor|health_floor|min_hp|HUNGER_HP_FLOOR", "why": "the 1 HP shelter floor is a rule, not an accident"},
        {"id": "offline_settlement", "scope": "game/autoload/save_service.gd,game/survival/**/*.gd",
         "regex": r"func\s+(settle_offline|apply_elapsed|advance_offline|settle_absence)\s*\(",
         "why": "elapsed closure time must settle once"},
        {"id": "last_seen_at", "scope": "game/autoload/save_service.gd,game/survival/**/*.gd",
         "regex": r'["\']last_seen_at["\']', "why": "elapsed time needs a durable anchor"},
    ],
    "D060": [
        {"id": "world_clock_key", "scope": "game/survival/**/*.gd,game/autoload/save_service.gd",
         "regex": r'["\']clock["\']\s*:', "why": "one persisted world timeline"},
        {"id": "offline_clock_anchor", "scope": "game/autoload/save_service.gd,game/survival/**/*.gd",
         "regex": r'["\']last_seen_at["\']', "why": "online and offline intervals must share an absolute anchor"},
        {"id": "bounded_queue", "scope": "game/survival/**/*.gd",
         "regex": r"UNRESOLVED_JOB_STATES|func\s+jobs\s*\(", "why": "prepared work must be inspectable"},
        {"id": "fuel_bound", "scope": "game/survival/**/*.gd",
         "regex": r"\bfuel\b", "why": "a queue without committed fuel must stop"},
    ],
    "D061": [
        {"id": "trail_state", "scope": "game/survival/**/*.gd,game/overworld/**/*.gd,game/characters/**/*.gd",
         "regex": r"\b(footsteps?|footprint_trail|trail_points?|trail_segments?|player_trail|scent_[a-z_]+)\b",
         "why": "home discovery needs a real player trail; a build-placement footprint is not one"},
        {"id": "trail_decay", "scope": "game/survival/**/*.gd,game/overworld/**/*.gd",
         "regex": r"(footprint|trail_segment|scent)[^\n]*(decay|fade|erase|wash)",
         "why": "trails must fade or wash away"},
        {"id": "no_home_coordinate", "scope": "game/characters/**/*.gd",
         "regex": r"home_position|home_cell|player_home", "why": "FORBIDDEN: a monster must not store the home location",
         "forbidden": "1"},
    ],
}

PROBES = {
    "D055": "d055_d057_season_probe.gd",
    "D056": "d055_d057_season_probe.gd",
    "D057": "d055_d057_season_probe.gd",
    "D058": "d058_random_spawn_probe.gd",
    "D059": "d059_offline_hunger_probe.gd",
    "D060": "d060_world_time_probe.gd",
    "D061": "d061_trail_probe.gd",
}

OWNERS = {
    "D055": "A0",
    "D056": "A0 (namespace) + A3 (reward scope)",
    "D057": "A0 (events) + A3 (rewards) + A6 (UI)",
    "D058": "A1 (pool) + A0 (selection/persist) + A3 (survivability evidence)",
    "D059": "A0 (settlement/HP) + A3 (provisions) + A1 (shelter) + A6 (warning)",
    "D060": "A0 (clock) + A3 (queue bound) + A6 (return report)",
    "D061": "A0/A5 (trail + pursuit) + A1 (surfaces) + A6 (signs)",
}

_COMMENT = re.compile(r"(?m)^\s*#.*$|(?<!\w)#[^\n\"']*$")


def _source_files(tree: Path, scope: str) -> List[Path]:
    files: List[Path] = []
    for pattern in scope.split(","):
        pattern = pattern.strip()
        if not pattern:
            continue
        files.extend(p for p in tree.glob(pattern) if p.is_file())
    return sorted(set(files))


# Near-miss symbols that a naive scanner reports as satisfying a decision. Each
# one was opened in the audited tree and rejected. The ledger is re-verified on
# every run (`token_present`), so it cannot silently rot into fiction.
SPOOFS: List[Dict[str, str]] = [
    {
        "id": "SP-01", "decision": "D061",
        "path": "game/survival/survival_build_system.gd", "token": "var footprint := Vector2i.ONE",
        "verdict": "REJECTED",
        "reason": "a build-placement tile footprint of a structure; no card, no decay, no monster reads it",
    },
    {
        "id": "SP-02", "decision": "D060",
        "path": "game/survival/economy/world_source_adapter.gd", "token": "invalid_world_clock_seconds",
        "verdict": "REJECTED",
        "reason": "matches `clock_seconds` only inside an error string, not a persisted clock key",
    },
    {
        "id": "SP-03", "decision": "D055",
        "path": "game/autoload/game_session.gd", "token": '"run_id": active_run_id',
        "verdict": "REJECTED",
        "reason": "in-memory combat campaign run id; save_service.gd has no run_id key, so no durable season run",
    },
    {
        "id": "SP-04", "decision": "D056",
        "path": "game/autoload/game_session.gd", "token": "func reset_run() -> void:",
        "verdict": "REJECTED",
        "reason": "resets score/sigils/checkpoint for a combat level; it does not start a season or keep a run history",
    },
    {
        "id": "SP-05", "decision": "D061",
        "path": "game/autoload/save_service.gd", "token": '"pursuit_execution": false',
        "verdict": "REJECTED",
        "reason": "a tutorial-completion flag, not a monster pursuing a detected trail",
    },
    {
        "id": "SP-06", "decision": "D060",
        "path": "game/survival/economy/vendor/a3_economy_service.gd", "token": "const MAX_TICK_QUANTUM := 600",
        "verdict": "REJECTED",
        "reason": "bounds one tick delta; it cannot settle an 18 h or 48 h absence because no absolute anchor is stored",
    },
    {
        "id": "SP-07", "decision": "D057",
        "path": "game/autoload/save_service.gd", "token": "quest or shop delivery from paying twice",
        "verdict": "REJECTED",
        "reason": "the only `quest` occurrences are prose in comments; no quest state or quest receipt exists",
    },
    {
        "id": "SP-08", "decision": "D060",
        "path": "game/survival/economy/world_source_adapter.gd", "token": '"active_seconds": 0',
        "verdict": "REJECTED",
        "reason": "monotonic accumulated in-game seconds advanced by session index; it carries no wall-clock anchor",
    },
]


def verify_spoofs(tree: Path) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for spoof in SPOOFS:
        path = tree / spoof["path"]
        text = path.read_text(encoding="utf-8", errors="replace") if path.is_file() else ""
        out.append(
            dict(
                spoof,
                token_present="yes" if spoof["token"] in text else "NO (ledger stale)",
                counts_as_satisfied="never",
            )
        )
    return out


def check_requirement(tree: Path, spec: Dict[str, str]) -> Dict[str, object]:
    pattern = re.compile(spec["regex"])
    hits: List[str] = []
    for path in _source_files(tree, spec["scope"]):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if path.suffix == ".gd":
            text = _COMMENT.sub("", text)
        match = pattern.search(text)
        if match:
            line = text[: match.start()].count("\n") + 1
            hits.append(f"{path.relative_to(tree)}:{line}")
    forbidden = str(spec.get("forbidden", "")) == "1"
    present = bool(hits)
    # A forbidden construct is satisfied by *absence*, and violated by presence.
    ok = (not present) if forbidden else present
    return {
        "id": spec["id"],
        "why": spec["why"],
        "forbidden": forbidden,
        "ok": ok,
        "hits": hits[:6],
        "hit_count": len(hits),
    }


def scanned_bytes(tree: Path) -> Dict[str, object]:
    """Exactly which bytes this audit read, so the matrix cannot drift silently.

    The tree is a composition checkout that is not in this repository, so the
    artifact records both a byte digest and a per-file ledger: a reader can
    re-extract the same commit and confirm the matrix still describes it.
    """
    paths = set()
    for specs in REQUIREMENTS.values():
        for spec in specs:
            paths.update(_source_files(tree, spec["scope"]))
    ledger = {
        str(path.relative_to(tree)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(paths)
    }
    digest = hashlib.sha256(
        "\n".join(f"{name}:{value}" for name, value in ledger.items()).encode()
    ).hexdigest()
    return {"file_count": len(ledger), "digest": digest, "files": ledger}


def audit(tree: Path, sha: str) -> Dict[str, object]:
    rows: List[Dict[str, object]] = []
    for decision, specs in REQUIREMENTS.items():
        checks = [check_requirement(tree, spec) for spec in specs]
        # Forbidden constructs are *guards*: they can only subtract, never add.
        # Counting "no home coordinate exists" as a satisfied requirement would
        # let a decision with zero real features look a third implemented.
        required_checks = [c for c in checks if not c["forbidden"]]
        guard_checks = [c for c in checks if c["forbidden"]]
        satisfied = sum(1 for check in required_checks if check["ok"])
        if satisfied == len(required_checks):
            state = "IMPLEMENTED"
        elif satisfied == 0:
            state = "ABSENT"
        else:
            state = "PARTIAL"
        missing = [check["id"] for check in required_checks if not check["ok"]]
        violated_guards = [check["id"] for check in guard_checks if not check["ok"]]
        rows.append(
            {
                "decision": decision,
                "state": state,
                "owner": OWNERS[decision],
                "satisfied": satisfied,
                "required": len(required_checks),
                "guards_checked": len(guard_checks),
                "guards_violated": violated_guards,
                "missing": missing,
                "checks": checks,
                "native_probe": f"tests/survival/balance_native/{PROBES[decision]}",
                "claim_allowed": {
                    "IMPLEMENTED": "the native probe may now assert the rule (not a pass until it runs)",
                    "PARTIAL": "no acceptance claim: part of the rule is absent",
                    "ABSENT": "CONTRACT_ONLY / RED_NOT_IMPLEMENTED",
                }[state],
            }
        )
    counts = {state: sum(1 for row in rows if row["state"] == state) for state in ("IMPLEMENTED", "PARTIAL", "ABSENT")}
    spoofs = verify_spoofs(tree)
    return {
        "schema": SCHEMA,
        "tree": str(tree),
        "sha": sha,
        "rows": rows,
        "spoofs": spoofs,
        "counts": counts,
        "verdict": "D_SERIES_NOT_ACCEPTABLE" if counts["ABSENT"] or counts["PARTIAL"] else "D_SERIES_SOURCE_COMPLETE",
        "rule": (
            "IMPLEMENTED means every required symbol exists in production code of this exact tree. It is not a "
            "native pass: the probe must still run and hold. ABSENT rows are CONTRACT_ONLY and must never be "
            "reported as accepted. Forbidden constructs are guards: they can only subtract from a row, never add "
            "to it. Every near-miss in `spoofs` was opened and rejected; it never counts as satisfied."
        ),
    }


def as_markdown(payload: Dict[str, object]) -> str:
    lines = [
        f"# D055–D061 contract matrix — `{payload['sha'][:12]}`",
        "",
        f"**Verdict.** `{payload['verdict']}` — "
        + ", ".join(f"{state.lower()} {count}" for state, count in payload["counts"].items())
        + ".",
        "",
        "| Decision | State | Owner | Missing requirements | Native probe |",
        "|---|---|---|---|---|",
    ]
    for row in payload["rows"]:
        missing = ", ".join(f"`{item}`" for item in row["missing"]) or "—"
        lines.append(
            f"| `{row['decision']}` | `{row['state']}` ({row['satisfied']}/{row['required']}) | {row['owner']} | "
            f"{missing} | `{Path(row['native_probe']).name}` |"
        )
    lines.append("")
    for row in payload["rows"]:
        lines.append(f"## {row['decision']} — {row['state']}")
        lines.append("")
        lines.append(f"**May claim.** {row['claim_allowed']}")
        lines.append("")
        for check in row["checks"]:
            mark = "yes" if check["ok"] else "**no**"
            hits = ", ".join(f"`{hit}`" for hit in check["hits"][:3]) or "—"
            if check["forbidden"]:
                # A guard is reported as clean/violated, never as progress.
                guard = "clean" if check["ok"] else "**VIOLATED**"
                lines.append(f"- guard `{check['id']}`: {guard} — {check['why']} — {hits}")
            else:
                lines.append(f"- `{check['id']}`: {mark} — {check['why']} — {hits}")
        lines.append("")
    lines.append("## Rejected near-misses (spoof ledger)")
    lines.append("")
    lines.append("| Id | Decision | Symbol | Token in tree | Counts as satisfied | Why rejected |")
    lines.append("|---|---|---|---|---|---|")
    for spoof in payload["spoofs"]:
        lines.append(
            f"| `{spoof['id']}` | `{spoof['decision']}` | `{spoof['path']}` | {spoof['token_present']} | "
            f"{spoof['counts_as_satisfied']} | {spoof['reason']} |"
        )
    lines.append("")
    lines.append(f"**Rule.** {payload['rule']}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tree", required=True)
    parser.add_argument("--sha", default="")
    parser.add_argument("--write", default="")
    parser.add_argument("--markdown", default="")
    args = parser.parse_args()
    tree = Path(args.tree).resolve()
    if not (tree / "game").is_dir():
        print(f"{tree} is not a Godot project tree", file=sys.stderr)
        return 2
    sha = args.sha
    if not sha:
        git_head = tree / ".git"
        sha = "UNRECORDED" if not git_head.exists() else "UNRECORDED_WORKTREE"
    payload = audit(tree, sha)
    payload["scanned"] = scanned_bytes(tree)
    payload["reproduce"] = (
        "git worktree add --detach /tmp/dec-tree <composition-sha> && "
        "python3 tools/survival/balance/decisions_matrix.py --tree /tmp/dec-tree --sha <composition-sha> "
        "--write data/survival/balance/results/decisions.v1.json "
        "--markdown data/survival/balance/results/DECISIONS_MATRIX.md"
    )
    if args.write:
        out = Path(args.write)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"wrote {out}")
    if args.markdown:
        md = Path(args.markdown)
        md.parent.mkdir(parents=True, exist_ok=True)
        md.write_text(as_markdown(payload) + "\n", encoding="utf-8")
        print(f"wrote {md}")
    print(json.dumps({"sha": sha, "counts": payload["counts"], "verdict": payload["verdict"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
