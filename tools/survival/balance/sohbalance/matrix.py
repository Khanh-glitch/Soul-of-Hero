"""The living evidence matrix: one row per player-facing gap, tied to a SHA.

This is not a report. It is the artefact a reviewer or an owner reads when they
want to know, for the current pin, three things per gap:

* **what a player can and cannot do right now** (not what the code contains);
* **what would prove it** - a native command plus the exact assertion that flips;
* **which gate decision the row is allowed to earn** - source / native / visual.

Rows are derived, never hand-written: the gate supplies the claim states, the
oracles supply the independent verdicts, the adversary run supplies the
anti-vacuity result, and the blockers supply the owner and the smallest fix. If a
number here disagrees with `gate.json`, the artifact is stale and `--check`
fails.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Sequence

SCHEMA = "soh.balance.matrix.v2"

# What a row may claim, in increasing strength. A row never exceeds the weakest
# evidence it cites.
LEVELS = (
    "NOTHING",
    "SOURCE_ABSENT",
    "SOURCE_PRESENT_BEHIND_GUARD",
    "SOURCE_PRESENT_UNRESOLVED",
    "SOURCE_PRESENT_OUTSIDE_MOUNTED_WORLD",
    "SOURCE_FIXED_PENDING_NATIVE",
    "NATIVE_VERIFIED",
    "VISUAL_INSPECTED",
)


def _level_rank(level: str) -> int:
    return LEVELS.index(level) if level in LEVELS else 0


def _row(
    gap_id: str,
    title: str,
    player_sentence: str,
    owner: str,
    fix_state: str,
    allowed_claims: Sequence[str],
    proof: Dict[str, object],
    blocker: Optional[Dict[str, object]] = None,
    verify_command: str = "",
) -> Dict[str, object]:
    return {
        "gap_id": gap_id,
        "title": title,
        "player_now": player_sentence,
        "owner": owner,
        "fix_state": fix_state,
        "allowed_claims": list(allowed_claims),
        "proof": proof,
        "smallest_fix": (blocker or {}).get("minimal_safe_correction"),
        "closure_probe": (blocker or {}).get("closure_probe"),
        "closure_test": (blocker or {}).get("closure_test"),
        "not_proven_after_closure": (blocker or {}).get("not_proven_after_closure"),
        "verify_command": verify_command,
    }


def build(
    gate: Dict[str, object],
    oracle: Dict[str, object],
    adversary: Dict[str, object],
    blockers: Dict[str, object],
    heads: Dict[str, str],
    probes: Optional[Dict[str, object]] = None,
) -> Dict[str, object]:
    by_id = {row["blocker_id"]: row for row in (blockers.get("blockers") or [])}
    claims = gate.get("entry_claims") or {}
    content = gate.get("entry_content") or {}
    identity = oracle.get("instance_identity") or {}
    api = oracle.get("engine_api") or {}
    fidelity = oracle.get("save_fidelity") or {}
    knowledge = oracle.get("knowledge_gate") or {}
    native = gate.get("native_states") or {}
    s4 = gate.get("s4") or {}
    quality = {row["check_id"]: row for row in ((gate.get("quality") or {}).get("checks") or [])}
    guard = content.get("guard") or {}
    probe_payload = probes or {}
    probe_files = [str(row.get("file")) for row in (probe_payload.get("probes") or [])]

    rows: List[Dict[str, object]] = []

    rows.append(
        _row(
            "GAP-1",
            "The Waystation exists in production code but no normal player can reach it",
            (
                "A player can open the survival overworld through the ordinary menu and walk it. They cannot "
                "reach the Waystation: the mount is behind a project setting the shipped game does not enable, "
                "and no native run has ever walked there."
                if not content.get("mounted")
                else "A player can walk to the Waystation in the shipped build."
            ),
            "A0",
            "SOURCE_PRESENT_BEHIND_GUARD",
            ["SOURCE_ABSENT", "SOURCE_PRESENT_BEHIND_GUARD"] if not content.get("mounted") else LEVELS,
            {
                "claim_C": claims.get("C_content_is_mounted", {}).get("state"),
                "guard_setting": guard.get("setting"),
                "guard_declared_in_project": guard.get("declared_in_project"),
                "guard_enabled_by_default": guard.get("enabled_by_default"),
                "entry_native": native.get("a0_normal_entry_home"),
                "reproduce": "python3 tools/survival/balance/run_analysis.py",
            },
            by_id.get("BLK-1"),
            (
                "xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 "
                "--script res://tests/survival/balance_native/first_hour_route_probe.gd"
            ),
        )
    )

    rows.append(
        _row(
            "GAP-2",
            "The cache reward cannot resolve even if the player enables the guard",
            (
                "Standing at the cache and pressing interact fails: the request A0 sends uses the A3 world "
                "instance id si:r_ashen_crown:waystation_cache:01, and the catalog A0 ships still keys the old "
                "alias node_waystation_cache. The player sees a refusal, not 3 scrap + 2 spares."
                if identity.get("verdict") == "HOST_ACTION_UNRESOLVED"
                else "The cache interaction resolves against the loaded catalog."
            ),
            "A0 (re-vendor) + A3 (canonical id)",
            "SOURCE_PRESENT_UNRESOLVED"
            if identity.get("verdict") == "HOST_ACTION_UNRESOLVED"
            else "SOURCE_FIXED_PENDING_NATIVE",
            ["SOURCE_PRESENT_UNRESOLVED"] if identity.get("verdict") == "HOST_ACTION_UNRESOLVED" else LEVELS,
            {
                "identity_verdict": identity.get("verdict"),
                "host_instance_ids": identity.get("host_instance_ids"),
                "unresolved": identity.get("unresolved_host_requests"),
                "a3_only_bindings": identity.get("a3_only_bindings"),
                "fixture_ids_absent_from_host": identity.get("fixture_ids_absent_from_host"),
            },
            by_id.get("BLK-2"),
            (
                "python3 tools/survival/balance/run_analysis.py && python3 -c \"import json;"
                "print([r for r in json.load(open('data/survival/balance/results/oracle.json'))"
                "['instance_identity']['unresolved_host_requests']])\""
            ),
        )
    )

    rows.append(
        _row(
            "GAP-3",
            "A8's native POI steps are fixed in source and unproven in the engine",
            (
                "Nothing about A8's sites is visible to a player: they are not in the mounted world. The scenes "
                "themselves no longer call a non-existent engine method, and their native contract step has not "
                "been green on this sha."
            ),
            "A8",
            "SOURCE_FIXED_PENDING_NATIVE",
            ["SOURCE_FIXED_PENDING_NATIVE"],
            {
                "unknown_engine_calls": api.get("unknown_call_count"),
                "native_state": native.get("a8_native_poi_contract"),
                "historical_pin": "5ccf7b3f had 15 unknown calls",
            },
            by_id.get("BLK-3"),
            "gh run list --workflow a8-world-content-native.yml --commit c8b4bc88 && gh run view <run-id> --log",
        )
    )

    rows.append(
        _row(
            "GAP-4",
            "No native journey on the current sha: every required run is stale or queued",
            (
                "A player on this build has no evidence-backed guarantee that a session survives a restart, "
                "because no run on this sha has executed entry, real input, a second process or a replay "
                "refusal. S4 is 0 of 5 clauses."
            ),
            "A0",
            "RUNTIME_UNKNOWN",
            ["RUNTIME_UNKNOWN"],
            {
                "s4_granted": s4.get("s4_granted"),
                "clauses": {k: v.get("state") for k, v in (s4.get("clauses") or {}).items()},
                "native_states": {k: v.get("state") for k, v in native.items()},
                "save_fidelity": fidelity.get("verdict"),
                "probe_verdict": probe_payload.get("verdict"),
                "probe_evidence_class": probe_payload.get("evidence_class"),
                "probes": probe_files,
            },
            by_id.get("BLK-4"),
            (
                "xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 "
                "--script res://tests/survival/balance_native/bed_death_bag_probe.gd -- --verify-separate-process"
            ),
        )
    )

    rows.append(
        _row(
            "GAP-5",
            "The playable body is the Knight, not the locked bald adventurer",
            (
                "A player controls a Knight. The two user-locked bald bodies (555940 male, 419402 female) exist "
                "as inspected source archives, not as imported sheets, so nothing can be shown even if A0 "
                "swapped the scene today."
            ),
            "A6 (import) + A0 (mount)",
            "SOURCE_ABSENT",
            ["SOURCE_ABSENT"],
            {
                "mounted_scene": "game/characters/knight/knight.tscn",
                "q04": (quality.get("Q-04") or {}).get("status"),
                "q09": (quality.get("Q-09") or {}).get("status"),
                "adapter_referenced_from_a0": (
                    ((quality.get("Q-09") or {}).get("evidence") or {}).get("adapter_references_from_a0")
                ),
            },
            by_id.get("BLK-5"),
            (
                "xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 "
                "--script res://tests/survival/balance_native/avatar_body_probe.gd"
            ),
        )
    )

    site_check = quality.get("Q-08") or {}
    rows.append(
        _row(
            "GAP-7",
            "Every A8 site anchor lies outside the world A0 actually mounts",
            (
                "No player can reach an A8 site, and enabling the Waystation flag would not change that: the "
                "mounted world is 448x256 tiles, its one imported annex is (384,192)-(448,256), and the three "
                "site anchors sit at y=280, 300 and 360. A scene cannot be walked to from outside the map."
            ),
            "A1 (anchors) + A0 (mount mode) + A8 (shell footprint)",
            "SOURCE_PRESENT_OUTSIDE_MOUNTED_WORLD",
            ["SOURCE_PRESENT_OUTSIDE_MOUNTED_WORLD"],
            {
                "q08": site_check.get("status"),
                "world_bounds": site_check.get("world_bounds"),
                "annex": site_check.get("annex"),
                "sites": site_check.get("evidence"),
            },
            {
                "minimal_safe_correction": (
                    "A1 must either move the anchors inside the mounted world or author the extension; A0 must "
                    "then mount it as one contiguous surface (annex_build is disabled pending a composite "
                    "validator) or declare the sites interior instances entered from a canonical anchor. A8 "
                    "supplies a shell whose collision footprint fits the authored radius."
                ),
                "closure_probe": (
                    "every site's canonical_cell satisfies 0 <= cell < world_bounds and its "
                    "direct_overworld_mount_decision is not REJECT"
                ),
                "closure_test": "tests/survival/balance/test_quality.py::QualityClosureTests::test_q08_passes_when_anchors_are_inside_and_the_mount_decision_is_not_reject",
                "not_proven_after_closure": (
                    "that the composed surface has no seam the Hero can fall through (native walk required)"
                ),
            },
            (
                "python3 tools/survival/balance/run_analysis.py && python3 -c \"import json;"
                "print([c['status'] for c in json.load(open('data/survival/balance/results/quality.json'))"
                "['checks'] if c['check_id']=='Q-08'])\""
            ),
        )
    )

    # The first-hour ladder is a property of the catalog, not of a mount, so it is
    # reported as its own row with its own truth value.
    rows.append(
        _row(
            "GAP-6",
            "The research ladder has exactly one seed, and that seed is behind GAP-1/GAP-2",
            (
                "A player can harvest wood and stone all hour and still never build the first research "
                "station: every spare recipe needs a station, the kit costs 3 spares, and the only "
                "non-circular seed is the cache reward that cannot be paid yet."
            ),
            "A1 + A3 (data), A0 (mount)",
            "SOURCE_PRESENT_BEHIND_GUARD",
            ["SOURCE_PRESENT_BEHIND_GUARD"],
            {
                "verdict": knowledge.get("verdict"),
                "non_circular_recipes": knowledge.get("non_circular_spare_recipes"),
                "seeded_by": sorted((knowledge.get("spare_loot_sources") or {}).keys()),
                "claims_needed": knowledge.get("claims_needed_for_first_station"),
            },
            None,
        )
    )

    heads_clean = {name: value for name, value in heads.items() if value}
    strongest = max((_level_rank(row["fix_state"]) for row in rows), default=0)
    return {
        "schema": SCHEMA,
        "heads": heads_clean,
        "row_count": len(rows),
        "rows": rows,
        "strongest_row": LEVELS[strongest],
        "b0_verdict": (
            "B0_NOT_MET"
            if any(
                row["fix_state"]
                in (
                    "SOURCE_ABSENT",
                    "SOURCE_PRESENT_UNRESOLVED",
                    "SOURCE_PRESENT_OUTSIDE_MOUNTED_WORLD",
                    "RUNTIME_UNKNOWN",
                )
                for row in rows
            )
            else "B0_CANDIDATE"
        ),
        "adversary": {
            "verdict": adversary.get("verdict"),
            "probes": adversary.get("probe_count"),
            "rejected": adversary.get("rejected_count"),
            "holes": adversary.get("holes"),
        },
        "rule": (
            "A row may never claim more than its weakest column. SOURCE_FIXED_PENDING_NATIVE is not a native "
            "pass; NATIVE_VERIFIED requires a green owner run on this sha; VISUAL_INSPECTED requires frames a "
            "human looked at."
        ),
        "reproduce": "python3 tools/survival/balance/run_analysis.py && cat data/survival/balance/results/matrix.json",
    }


def as_markdown(payload: Dict[str, object]) -> str:
    lines: List[str] = []
    lines.append("# B0 evidence matrix — what a player can and cannot do at this pin\n")
    lines.append(
        "_Generated from `data/survival/balance/results/matrix.json`. Do not edit by hand; regenerate with "
        "`python3 tools/survival/balance/run_analysis.py`._\n"
    )
    heads = payload.get("heads") or {}
    lines.append("**Heads.** " + " · ".join(f"{name.upper()} `{str(sha)[:8]}`" for name, sha in heads.items()) + "\n")
    lines.append(f"**B0 verdict.** `{payload['b0_verdict']}` — strongest row `{payload['strongest_row']}`.\n")
    adv = payload.get("adversary") or {}
    lines.append(
        f"**Anti-vacuity.** `{adv.get('verdict')}` — {adv.get('rejected')}/{adv.get('probes')} spoof probes "
        f"rejected; open holes: {adv.get('holes')}.\n"
    )
    lines.append("| Gap | What a player can do now | Owner | State | May claim |")
    lines.append("|---|---|---|---|---|")
    for row in payload["rows"]:
        lines.append(
            f"| `{row['gap_id']}` | {row['player_now']} | {row['owner']} | `{row['fix_state']}` | "
            f"{', '.join(f'`{c}`' for c in row['allowed_claims'])} |"
        )
    lines.append("")
    for row in payload["rows"]:
        lines.append(f"## {row['gap_id']} — {row['title']}\n")
        lines.append(f"**Now.** {row['player_now']}\n")
        if row.get("smallest_fix"):
            lines.append(f"**Smallest safe fix.** {row['smallest_fix']}\n")
        if row.get("closure_probe"):
            lines.append(f"**Closure probe.** {row['closure_probe']}\n")
        if row.get("closure_test"):
            lines.append(f"**Test that flips.** `{row['closure_test']}`\n")
        if row.get("verify_command"):
            lines.append(f"**Reproduce.** `{row['verify_command']}`\n")
        if row.get("not_proven_after_closure"):
            lines.append(f"**Still unproven after closure.** {row['not_proven_after_closure']}\n")
        lines.append("**Evidence.**\n")
        for key, value in sorted((row.get("proof") or {}).items()):
            lines.append(f"- `{key}` = `{value}`")
        lines.append("")
    lines.append("## Rule\n")
    lines.append(str(payload.get("rule")) + "\n")
    return "\n".join(lines)
