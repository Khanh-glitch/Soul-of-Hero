"""Collapse the raw finding list into the few blockers a player actually hits.

The raw audit produces ~60 observations. That list is an appendix, not a
deliverable: it repeats one root cause across many records and it mixes static
authoring gaps, mount gaps and hypothesis notes.

Round 3 repins this module against the current owner heads and the integration
gate. Two of the old blockers were *measurable claims that turned out false* and
are now recorded as closed with the measurement that closed them, rather than
kept alive for continuity:

* the "first research is a bootstrap cycle" blocker: A3 authors ``make_spares``,
  the waystation cache is a renewable non-station source of ``knowledge_spares``
  authorized by A1 (2 per claim, 1800 s), and ``research_kit`` is a **workbench**
  recipe, so no station is needed to start the ladder;
* the "debug text + duplicate HUD" blocker: on mounted surfaces the developer
  vocabulary is gated behind ``_developer_diagnostics`` (default ``false``) and
  the three HUD scripts own disjoint jobs, so nothing is shown twice.

What remains are four blockers, each with one owner, the smallest safe correction
and a closure probe that flips on pinned bytes.
"""
from __future__ import annotations

from typing import Dict, Iterable, List, Sequence

# finding code -> blocker id. Codes not listed are traceability only.
CODE_TO_BLOCKER: Dict[str, str] = {
    # BLK-1 nothing mounted: no entry, no placed route, no placed interaction
    "POI_NOT_PLAYABLE": "BLK-1",
    "NOT_NATIVE_INTEGRATED": "BLK-1",
    "POI_NOT_ON_ROUTE_GRAPH": "BLK-1",
    "POI_ROUTE_UNREACHABLE": "BLK-1",
    "ROUTE_UNREACHABLE": "BLK-1",
    "ROUTE_LOCKED_FOR_CAPABILITIES": "BLK-1",
    "NONE_ELIGIBLE": "BLK-1",
    "CORE_DROP_RATE_ABSENT": "BLK-1",
    "CAPACITY_TRUNCATED": "BLK-1",
    # BLK-2 the binding to a physical instance is not adopted
    "SOURCE_POI_UNRESOLVED": "BLK-2",
    "SOURCE_REGION_UNRESOLVED": "BLK-2",
    "SOURCE_ID_DIVERGENCE": "BLK-2",
    "PROVISIONAL_BINDING": "BLK-2",
    "QUANTITY_OWNERSHIP_UNRESOLVED": "BLK-2",
    "ITEM_OVEROWNED": "BLK-2",
    "ZERO_RESTOCK_NOT_RENEWABLE": "BLK-2",
    # duplicate protection belongs with the commit blocker, not the binding one
    "REPEATED_ONE_TIME_CLAIM_BLOCKED": "BLK-4",
    "UNIQUE_INSTANCE_DUPLICATION_BLOCKED": "BLK-4",
    # CLOSED-R3: measured false this round, kept for traceability only
    "BOOTSTRAP_DEPENDENCY_CYCLE": "CLOSED-R3",
    "RESISTANCE_CHAIN_BLOCKED": "NONE",
    "SOURCE_REQUIREMENT_UNMAPPED": "NONE",
    "CAPABILITY_SELF_DEPENDENCY": "NONE",
    "CAPABILITY_ORPHAN": "NONE",
    "DEATH_CARGO_LOSS_UNMODELLED": "NONE",
    "HYPOTHESIS_USED": "NONE",
}

CHECK_TO_BLOCKER: Dict[str, str] = {
    "PROD-01": "BLK-1",
    "PROD-02": "BLK-2",
    "PROD-03": "BLK-3",
    "PROD-04": "CLOSED-R3",
    "PROD-05": "CLOSED-R3",
    "PROD-06": "CLOSED-R3",
    "PROD-07": "CLOSED-R3",
}

EVIDENCE_CLASS = {
    "BLK-1": "MISSING_PRODUCTION_MOUNT",
    "BLK-2": "SOURCE_DATA_INCOMPATIBILITY",
    "BLK-3": "PLAYER_FACING_VISUAL_DEFECT",
    "BLK-4": "FIXTURE_ONLY_SUCCESS",
}

BLOCKERS: Sequence[Dict[str, object]] = (
    {
        "blocker_id": "BLK-1",
        "title": "No production mount: not one interaction is reachable with normal input",
        "owner": "A0 (mount) with A1 (slice scene) and A8 (native site scene)",
        "evidence_class": EVIDENCE_CLASS["BLK-1"],
        "player_impact": (
            "The home screen offers campaign, hero roster, storage, modes, bestiary and settings. There is "
            "no survival destination, so a player cannot walk anywhere, interact with anything or find any "
            "item. A8's South Quarry scene is native and walkable, but it is only reachable through a test "
            "flag (its own emit is gated by 'test_harness_only := true')."
        ),
        "verified_by": (
            "integration gate over pinned bytes: waystation_cache and a8_quarry both report S0_ABSENT at "
            "L1_ENTRY; no runtime executed"
        ),
        "reproduce": [
            "python3 tools/survival/balance/run_analysis.py",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print([(c['chain_id'],c['chain_level'],c['weakest_link']) for c in d['chains']])\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['entry'])\"",
        ],
        "minimal_safe_correction": (
            "A0 adds ONE home-screen destination whose scene instantiates the existing A1 world host and the "
            "existing A8 site scene behind the normal gameplay input gate (no test flag). Nothing else: no "
            "new system, no data edit, no other owner's file."
        ),
        "closure_probe": (
            "gate.entry.home_survival_keys non-empty and both chains report L1_ENTRY at S3_OWNER_SEAM_UNWIRED "
            "with no missing text"
        ),
        "closure_test": "tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk1_closes_when_a_home_destination_exists",
        "not_proven_after_closure": (
            "that the mounted scene boots, is walkable and throws no console error (owner native run required)"
        ),
    },
    {
        "blocker_id": "BLK-2",
        "title": "A1 already authorizes the first-hour cache; A3 has not adopted the binding",
        "owner": "A3 (binding adoption), with A8 deferring to the same table",
        "evidence_class": EVIDENCE_CLASS["BLK-2"],
        "player_impact": (
            "A1's vertical-slice contract pays iron_scrap 3 and knowledge_spares 2 from node_waystation_cache "
            "at poi_crown_waystation on a renewable 1800 s right, with the transaction key "
            "'a1slice:poi_crown_waystation:cache_restock:1'. A3 still points those two source rows at the "
            "provisional class id 'poi:roadside_cache', so the reward has no physical instance to be paid at. "
            "A8's quarry pays its own fixed stone_chunk and records 'A3 cost authorization absent'."
        ),
        "verified_by": (
            "identity.binding_adoption over the A1 handoff contract and the pinned A3 sources: 0 of 3 "
            "authorized bindings adopted, yields already agree (3 / 2 / 2)"
        ),
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['binding_adoption']['summary'])\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['binding_adoption']['pending_rebind'])\"",
        ],
        "minimal_safe_correction": (
            "A3 adopts A1's own rebind request for road_scrap and road_supplies: set poi_id to "
            "poi_crown_waystation (class id stays a class id; the instance id is A1's), keep the yields A1 "
            "already authorizes, and list poi_crown_waystation in the a1_poi resolution. No quantity, rate "
            "or table changes. A8 then replaces its self-declared costs with the adopted table."
        ),
        "closure_probe": "binding_adoption.pending_rebind is empty and both chains report L4_AUTHORIZATION unblocked",
        "closure_test": "tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk2_closes_when_a3_adopts_the_a1_binding_without_changing_yields",
        "not_proven_after_closure": (
            "that the physical cache node exists in a scene, that the payment happens at runtime, and any "
            "Core rate (still absent, still not invented here)"
        ),
    },
    {
        "blocker_id": "BLK-3",
        "title": "The mounted player body is still Knight art and the locked avatar has no installed frames",
        "owner": "A6 (art source + adapter) with A0 (mount)",
        "evidence_class": EVIDENCE_CLASS["BLK-3"],
        "player_impact": (
            "The character on screen is the old Knight. The user locked two bald unarmoured bodies (male "
            "555940, female 419402) with armour stages driven by equipped gear; A6's new art manifest has an "
            "empty grade-0 sheet and null grades 1-2, so the adapter honestly returns SOURCE_BLOCKED and no "
            "production file references either source. A swordsman pack (180537) is not a substitute."
        ),
        "verified_by": "quality Q-04 over the pinned A6 manifest, adapter and mounted body (A6 bed3fc81)",
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/quality.json'));"
            "print([c for c in d['checks'] if c['check_id']=='Q-04'])\"",
        ],
        "minimal_safe_correction": (
            "A6 installs the grade-0 idle sheet for the chosen gender from the user's Drive ZIP (one sheet, "
            "one manifest entry) and keeps grades 1-2 SOURCE_BLOCKED until gender-matched armour frames "
            "exist. A0 then swaps the mounted body. Do not report the Knight body as accepted."
        ),
        "closure_probe": "quality Q-04 PASS (mounted body resolves to a canonical source with a non-empty grade-0 sheet)",
        "closure_test": "tests/survival/balance/test_quality.py::QualityClosureTests::test_blk3_closes_when_the_mounted_body_and_grade0_sheet_are_canonical",
        "not_proven_after_closure": (
            "animation fidelity, feet anchors, readability at 720p-4K, licence, armour reversal on unequip "
            "(human review)"
        ),
    },
    {
        "blocker_id": "BLK-4",
        "title": "Every reward path that exists is fixture-only: nothing is committed, reloaded or de-duplicated",
        "owner": "A0 (commit) with A8 (replace its fake authority)",
        "evidence_class": EVIDENCE_CLASS["BLK-4"],
        "player_impact": (
            "SaveService.transact_once is idempotent and records receipts, and A1's contract names the exact "
            "transaction keys to use, but no mounted path calls it. A8's pilot installs PoiAuthorityFixture, "
            "which declares itself test-only and keeps inventory in memory, so a quarry claim cannot survive "
            "a reload. The only reload evidence in the repo reuses one process, which cannot prove durable "
            "restore or prove that a replay is refused."
        ),
        "verified_by": (
            "integration gate L5/L6/L7 on both chains (S3_OWNER_SEAM_UNWIRED and S0_ABSENT), plus a read of "
            "a0 save_service.gd transact_once and the A8 fixture header"
        ),
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['commit_seam']);print(d['authority_a8'])\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['blocked_links'])\"",
        ],
        "minimal_safe_correction": (
            "A0 wires the cache claim to SaveService.transact_once with A1's transaction key, and adds the "
            "two-process reload test in gate.native_commands_for_owner['process_restart_reload'] (one process "
            "claims, a second process re-reads and asserts ALREADY_APPLIED). A8 swaps its fixture for the "
            "SaveService adapter and keeps the fixture in tests only."
        ),
        "closure_probe": "gate.commit_seam.any_poi_calls_transact_once is true and a two-process reload test exists in the repo",
        "closure_test": "tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk4_closes_when_a_mounted_path_commits_through_transact_once",
        "not_proven_after_closure": (
            "that the commit is durable across a real OS restart and that the second process reads the same "
            "document (S4 requires the owner's native two-process run)"
        ),
    },
)

CLOSED: Sequence[Dict[str, object]] = (
    {
        "blocker_id": "BLK-BOOTSTRAP",
        "was": "First research is a bootstrap cycle, so the knowledge ladder cannot start",
        "disposition": "CLOSED_MEASURED_FALSE",
        "closed_at": "round 3, A1 2951bf85 / A3 18e7afcb",
        "why_it_was_wrong": (
            "The earlier claim read only the static make_spares -> research station edge. A1's own handoff "
            "contract authorizes 2 knowledge_spares per Waystation cache claim (renewable, 1800 s) with a "
            "transaction key, and research_kit is built at a workbench, not at a research station, so the "
            "ladder can start without any station."
        ),
        "evidence": {
            "cache_spares_per_claim": 2,
            "cache_cooldown_seconds": 1800,
            "research_kit_station": "workbench",
            "research_kit_spares": 3,
            "claims_needed_for_first_station_kit": 2,
            "no_rate_changed": True,
        },
        "residual_note": (
            "Two cache claims are needed for 3 spares, i.e. one 1800 s cooldown wait. That is a pacing "
            "question for A3, not a dead end, and no new source or rate is proposed."
        ),
        "still_needs_owner": "A3 wants to confirm the 30-minute first-station wait is intended pacing.",
    },
    {
        "blocker_id": "BLK-DEBUG-UI",
        "was": "The only survival UI is developer-facing and duplicates A0's HUD job",
        "disposition": "CLOSED_NOT_PLAYER_FACING_AT_THIS_PIN",
        "closed_at": "round 3, A0 77e434a7 / A6 bed3fc81",
        "why_it_was_wrong": (
            "The old count of ~100 developer tokens was a whole-file grep. Measured on mounted surfaces the "
            "vocabulary is behind '_developer_diagnostics' (default false) and no production scene mounts the "
            "survival UI at all, so a player cannot see it. The three HUD scripts own disjoint jobs "
            "(a0.hud health, a0.overworld_hud provisions, a6 context/core/feedback), so there is no duplicate "
            "ownership to fix either."
        ),
        "evidence": {
            "developer_diagnostics_default": False,
            "survival_ui_mounted_by_a_production_scene": False,
            "hud_jobs": ["a0.hud.gd=health", "a0.overworld_hud.gd=provisions", "a6.player_first_hud.gd=context/core/feedback"],
            "quality_checks": {"Q-02": "PASS", "Q-06": "PASS"},
        },
        "residual_note": (
            "PROD-04 keeps its broad file-level token measure and stays FAIL; that is a hygiene warning, not a "
            "player-facing blocker. The moment any scene mounts this UI, Q-02 re-opens as a blocker."
        ),
        "still_needs_owner": "A6 keeps the debug panel opt-in when it mounts the UI.",
    },
)


def build(
    findings: Sequence[Dict[str, object]],
    product_checks: Sequence[Dict[str, object]],
    identity: Dict[str, object],
    product_facts: Dict[str, object],
    gate_payload: Dict[str, object] | None = None,
    quality_payload: Dict[str, object] | None = None,
) -> Dict[str, object]:
    """Attach every observation to a blocker and attach evidence to every blocker."""
    gate_payload = gate_payload or {}
    quality_payload = quality_payload or {}
    checks_by_id = {str(check["check_id"]): check for check in product_checks}
    per_blocker: Dict[str, List[Dict[str, object]]] = {row["blocker_id"]: [] for row in BLOCKERS}  # type: ignore[index]
    triage: List[Dict[str, object]] = []
    for finding in findings:
        code = str(finding.get("code"))
        blocker = CODE_TO_BLOCKER.get(code, "NONE")
        triage.append(
            {
                "code": code,
                "subject": finding.get("subject"),
                "severity": finding.get("severity"),
                "blocker_id": blocker,
                "evidence_class": (
                    EVIDENCE_CLASS.get(blocker, "CLOSED_OR_TRACEABILITY")
                    if blocker != "NONE"
                    else "TRACEABILITY_OR_HYPOTHESIS"
                ),
            }
        )
        if blocker in per_blocker:
            per_blocker[blocker].append({"kind": "finding", "code": code, "subject": finding.get("subject")})
    for check in product_checks:
        blocker = CHECK_TO_BLOCKER.get(str(check["check_id"]), "NONE")
        if blocker in per_blocker:
            per_blocker[blocker].append(
                {
                    "kind": "product_check",
                    "id": check["check_id"],
                    "status": check["status"],
                    "title": check["title"],
                }
            )

    quality_checks = {str(row["check_id"]): row for row in quality_payload.get("checks", []) or []}
    binding = gate_payload.get("binding_adoption") or identity.get("binding_adoption") or {}
    evidence = {
        "BLK-1": {
            "home_destinations": product_facts.get("home_function_keys"),
            "home_survival_destinations": (gate_payload.get("entry") or {}).get("survival_keys"),
            "chain_levels": {
                chain["chain_id"]: chain["chain_level"] for chain in gate_payload.get("chains", []) or []
            },
            "a8_scene_is_harness_only": (gate_payload.get("authority_a8") or {}).get("harness_only_by_default"),
            "note": "A1 records 118 POIs / 106 contract-only sites; none is reachable from a mounted screen",
        },
        "BLK-2": {
            "authorized_bindings": binding.get("authorized_bindings"),
            "adopted_by_a3": binding.get("adopted_by_a3"),
            "pending_rebind": [
                {
                    "source_id": row.get("source_id"),
                    "a1_poi": row.get("a1_authorized_poi"),
                    "a3_poi": row.get("a3_declared_poi"),
                    "yield": row.get("a1_authorized_yield"),
                    "yield_agrees": row.get("yield_agrees"),
                }
                for row in binding.get("pending_rebind", []) or []
            ],
            "loot_tables_referenced_by_production_code": product_facts.get("loot_tables_in_production_code"),
            "a8_self_declared_costs": [
                action["action_id"]
                for site in gate_payload.get("a8_sites", []) or []
                for action in site.get("actions", [])
                if action.get("a3_authorization_absent")
            ],
        },
        "BLK-3": {
            "mounted_player_scene": product_facts.get("mounted_player_scene"),
            "canonical_source_production_refs": product_facts.get("canonical_avatar_production_refs"),
            "canonical_source_doc_refs": product_facts.get("canonical_avatar_doc_refs"),
            "armor_stage_art_refs": product_facts.get("armor_stage_refs"),
            "q04_status": (quality_checks.get("Q-04") or {}).get("status"),
            "q04_detail": (quality_checks.get("Q-04") or {}).get("detail"),
        },
        "BLK-4": {
            "commit_seam": gate_payload.get("commit_seam"),
            "authority_a8": gate_payload.get("authority_a8"),
            "blocked_links": [
                {
                    "chain_id": row.get("chain_id"),
                    "link": row.get("link"),
                    "level": row.get("level"),
                }
                for row in gate_payload.get("blocked_links", []) or []
                if row.get("blocker_id") == "BLK-4"
            ],
            "two_process_reload_evidence": False,
        },
    }

    blockers: List[Dict[str, object]] = []
    for row in BLOCKERS:
        blocker_id = str(row["blocker_id"])
        merged = dict(row)
        merged["observations"] = per_blocker[blocker_id]
        merged["observation_count"] = len(per_blocker[blocker_id])
        merged["evidence"] = evidence[blocker_id]
        linked = [
            row2
            for row2 in gate_payload.get("blocked_links", []) or []
            if row2.get("blocker_id") == blocker_id
        ]
        merged["gate_links"] = linked
        merged["status"] = "OPEN" if (linked or blocker_id == "BLK-3") else "OPEN"
        blockers.append(merged)

    counts = {
        "raw_observations": len(findings),
        "product_checks": len(product_checks),
        "player_facing_blockers": len(blockers),
        "closed_blockers": len(CLOSED),
        "traceability_only": sum(1 for row in triage if row["blocker_id"] == "NONE"),
        "closed_or_traceability": sum(1 for row in triage if row["blocker_id"] in ("NONE", "CLOSED-R3")),
        "unmapped_product_checks": sum(
            1
            for check in product_checks
            if CHECK_TO_BLOCKER.get(str(check["check_id"]), "NONE") in ("NONE", "CLOSED-R3")
        ),
    }
    payload: Dict[str, object] = {
        "schema": "soh.balance.blockers.v3",
        "read_this_first": (
            "Four player-facing blockers, each with one owner, the smallest safe correction and a closure "
            "test that flips from FAIL to PASS. Two earlier blockers are recorded as closed because the "
            "measurement contradicted them, not because the code changed."
        ),
        "counts": counts,
        "blockers": blockers,
        "closed": list(CLOSED),
        "triage": triage,
        "reduction": (
            f"{counts['raw_observations']} observations -> {counts['player_facing_blockers']} blockers "
            f"({counts['closed_blockers']} closed by measurement, {counts['traceability_only']} observations "
            "are traceability/hypothesis only)"
        ),
    }
    # The human-readable companion is produced from this exact payload so the
    # markdown can never drift from the JSON.
    payload["markdown"] = as_markdown(payload)
    return payload


def as_markdown(payload: Dict[str, object]) -> str:
    lines: List[str] = []
    lines.append("# Player-facing blockers (A7, consolidated)\n")
    lines.append(
        "_Generated from `data/survival/balance/results/blockers.json` by "
        "`tools/survival/balance/run_analysis.py`. Do not edit by hand._\n"
    )
    lines.append(
        f"**{payload['reduction']}.** A finding list is not a deliverable; these are the only things that "
        "currently stop a player. Verification is a static read of pinned sources — no runtime was executed, "
        "so every native claim below stays `NOT_TESTED` until its owner runs it. Proof levels are the gate's "
        "`S0`–`S5`: static work can earn at most `S3`.\n"
    )
    lines.append("| # | Blocker | Owner | Class | Closure probe |\n|---|---|---|---|---|")
    for row in payload["blockers"]:
        lines.append(
            f"| {row['blocker_id']} | {row['title']} | {row['owner']} | {row['evidence_class']} | "
            f"`{row['closure_probe']}` |"
        )
    lines.append("")
    for row in payload["blockers"]:
        lines.append(f"## {row['blocker_id']} — {row['title']}\n")
        lines.append(f"**Player impact.** {row['player_impact']}\n")
        lines.append(
            f"**Owner.** {row['owner']}  \n**Evidence class.** {row['evidence_class']}  \n"
            f"**Verified by.** {row['verified_by']}\n"
        )
        lines.append("**Reproduce.**\n")
        for command in row["reproduce"]:
            lines.append(f"```bash\n{command}\n```")
        lines.append("")
        lines.append(f"**Minimal safe correction.** {row['minimal_safe_correction']}\n")
        lines.append(f"**Test that proves closure.** `{row['closure_test']}`\n")
        lines.append(f"**Still NOT_TESTED after closure.** {row['not_proven_after_closure']}\n")
        linked = row.get("gate_links") or []
        if linked:
            lines.append("**Gate links currently blocked.**\n")
            lines.append("| Chain | Link | Level | Missing |\n|---|---|---|---|")
            for link in linked:
                lines.append(
                    f"| {link['chain_id']} | {link['link']} | `{link['level']}` | {link['missing']} |"
                )
            lines.append("")
        lines.append("**Evidence.**\n")
        for key, value in sorted((row["evidence"] or {}).items()):
            lines.append(f"- `{key}` = `{value}`")
        lines.append("")
        lines.append(f"**Absorbs** {row['observation_count']} observation(s).\n")
    lines.append("## Closed by measurement (kept for traceability)\n")
    for row in payload["closed"]:
        lines.append(f"### {row['blocker_id']} — was: _{row['was']}_\n")
        lines.append(f"**Disposition.** `{row['disposition']}` at {row['closed_at']}\n")
        lines.append(f"**Why the earlier claim was wrong.** {row['why_it_was_wrong']}\n")
        lines.append(f"**Residual note.** {row['residual_note']}\n")
        lines.append(f"**Still with the owner.** {row['still_needs_owner']}\n")
        lines.append("**Evidence.**\n")
        for key, value in sorted((row["evidence"] or {}).items()):
            lines.append(f"- `{key}` = `{value}`")
        lines.append("")
    return "\n".join(lines)
