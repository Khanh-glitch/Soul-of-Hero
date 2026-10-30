"""Collapse the raw finding list into the few blockers a player actually hits.

The raw audit produces ~60 observations. That list is an appendix, not a
deliverable: it repeats one root cause across many records and it mixes static
authoring gaps, mount gaps and hypothesis notes. This module maps every finding
to exactly one of five player-facing blockers (or to ``NONE``), states the
owner, the smallest safe correction and an executable closure probe, and keeps
the observation count only as traceability.

Rules enforced here:

* a blocker must be *player-facing*: if the player cannot observe it, it is not
  a blocker;
* a blocker must have one owner who can close it inside their own paths;
* a blocker must have a closure probe that flips from FAIL to PASS from the
  pinned bytes alone, so "done" is not an opinion;
* nothing is promoted to a live gameplay claim: verification is a static read
  of pinned sources, and the remaining native question stays ``NOT_TESTED``.
"""
from __future__ import annotations

from typing import Dict, Iterable, List, Sequence

# finding code -> blocker id. Codes not listed are traceability only.
CODE_TO_BLOCKER: Dict[str, str] = {
    # BLK-1 the loop cannot be entered
    "POI_NOT_PLAYABLE": "BLK-1",
    "NOT_NATIVE_INTEGRATED": "BLK-1",
    "POI_NOT_ON_ROUTE_GRAPH": "BLK-1",
    "POI_ROUTE_UNREACHABLE": "BLK-1",
    "ROUTE_UNREACHABLE": "BLK-1",
    "ROUTE_LOCKED_FOR_CAPABILITIES": "BLK-1",
    "NONE_ELIGIBLE": "BLK-1",
    "CORE_DROP_RATE_ABSENT": "BLK-1",
    # BLK-2 loot identity / host
    "SOURCE_POI_UNRESOLVED": "BLK-2",
    "SOURCE_REGION_UNRESOLVED": "BLK-2",
    "SOURCE_ID_DIVERGENCE": "BLK-2",
    "PROVISIONAL_BINDING": "BLK-2",
    "QUANTITY_OWNERSHIP_UNRESOLVED": "BLK-2",
    "ITEM_OVEROWNED": "BLK-2",
    "ZERO_RESTOCK_NOT_RENEWABLE": "BLK-2",
    "CAPACITY_TRUNCATED": "BLK-1",
    "REPEATED_ONE_TIME_CLAIM_BLOCKED": "BLK-2",
    "UNIQUE_INSTANCE_DUPLICATION_BLOCKED": "BLK-2",
    # BLK-3 avatar
    "CAPABILITY_SELF_DEPENDENCY": "BLK-4",
    "CAPABILITY_ORPHAN": "BLK-4",
    # BLK-4 bootstrap / research
    "BOOTSTRAP_DEPENDENCY_CYCLE": "BLK-4",
    "RESISTANCE_CHAIN_BLOCKED": "BLK-4",
    "SOURCE_REQUIREMENT_UNMAPPED": "BLK-4",
    # BLK-5 debug / duplicate surface
    "DEATH_CARGO_LOSS_UNMODELLED": "NONE",
    "HYPOTHESIS_USED": "NONE",
}

CHECK_TO_BLOCKER: Dict[str, str] = {
    "PROD-01": "BLK-1",
    "PROD-02": "BLK-2",
    "PROD-03": "BLK-3",
    "PROD-04": "BLK-5",
    "PROD-05": "BLK-5",
    "PROD-06": "BLK-5",
    "PROD-07": "NONE",
}

EVIDENCE_CLASS = {
    "BLK-1": "RUNTIME_MOUNT_GAP",
    "BLK-2": "STATIC_AUTHORING_GAP",
    "BLK-3": "SOURCE_BLOCKED",
    "BLK-4": "STATIC_AUTHORING_GAP",
    "BLK-5": "PRODUCT_SURFACE_GAP",
}

BLOCKERS: Sequence[Dict[str, object]] = (
    {
        "blocker_id": "BLK-1",
        "title": "The player cannot enter the survival loop at all",
        "owner": "A0 (mount) with A1 (world scene)",
        "evidence_class": EVIDENCE_CLASS["BLK-1"],
        "player_impact": (
            "From the home screen the player can only open campaign, hero roster, storage, modes, bestiary "
            "and settings. There is no world, POI, container or survival destination, so no exploring, "
            "gathering, looting or Core discovery can happen in the running game."
        ),
        "verified_by": "static read of pinned bytes (A0 9d287f33, A6 8bc561df); no runtime executed",
        "reproduce": [
            "python3 tools/survival/balance/run_analysis.py --print-blockers",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/blockers.json'));print(d['blockers'][0]['evidence'])\"",
        ],
        "minimal_safe_correction": (
            "A0 adds ONE home-screen destination whose scene instantiates the existing A1 world host, behind "
            "the existing gameplay input gate. No new gameplay system, no data change, no other owner's file."
        ),
        "closure_probe": "product.PROD-01 must report PASS with a survival-like home destination key",
        "closure_test": "tests/survival/balance/test_product_audit.py::ProductClosureTests::test_blk1_closes_when_one_survival_destination_exists",
        "not_proven_after_closure": "that the mounted scene runs, is reachable on foot and does not error (native run required)",
    },
    {
        "blocker_id": "BLK-2",
        "title": "Authored loot has no host, and its identifiers do not join A1's world",
        "owner": "A1 (identifier contract + instances) with A3 (bindings) and A0 (container mount)",
        "evidence_class": EVIDENCE_CLASS["BLK-2"],
        "player_impact": (
            "Even with a world on screen there would be nothing to open: no production script mentions any A3 "
            "loot table, and the 16 loot records address 10 class-style ids ('poi:roadside_cache') in a "
            "namespace A1 never uses. A1 authors no container vocabulary at all, so the whole loot layer has "
            "no counterpart in the world."
        ),
        "verified_by": "static read of pinned A1/A3 data + pinned A0/A6 code; no runtime executed",
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/access.json'));print(d['loot_identity'])\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/blockers.json'));print(d['blockers'][1]['evidence'])\"",
        ],
        "minimal_safe_correction": (
            "A1 publishes ONE identifier rule (class id + region id + instance id) and authors N container "
            "instances on existing POIs; A3 rewrites its 16 records to use that rule; A0 mounts one container "
            "scene. Start with a single class ('roadside_cache') at one already-reachable POI: it proves the "
            "contract without touching loot weights."
        ),
        "closure_probe": "product.PROD-02 PASS (a mounted container references an authored table) and identity.targets_resolving_to_a1_instance is non-empty",
        "closure_test": "tests/survival/balance/test_product_audit.py::ProductClosureTests::test_blk2_closes_when_a_container_is_hosted_and_ids_join",
        "not_proven_after_closure": "drop behaviour in play, duplication across reload (A0 test required), Core rate (still absent)",
    },
    {
        "blocker_id": "BLK-3",
        "title": "The player body is still Knight art, and the locked avatar/armour sources are not in the build",
        "owner": "A0 (mount) with A6 (art source)",
        "evidence_class": EVIDENCE_CLASS["BLK-3"],
        "player_impact": (
            "The character on screen is the old Knight. The user locked exactly two bald unarmoured Craftpix "
            "bodies (male 555940, female 419402) with armour-1/armour-2 stages driven by equipped gear; zero "
            "production files reference either source, no armour stage exists, and the swordsman pack 180537 is "
            "not a valid substitute for either gender."
        ),
        "verified_by": "static read of pinned A0/A6 bytes (18 captured files) + tree-wide art index",
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/blockers.json'));print(d['blockers'][2]['evidence'])\"",
        ],
        "minimal_safe_correction": (
            "Mount the chosen gender body from the user's Drive ZIP and mark armour-1/armour-2 SOURCE_BLOCKED "
            "until the gender-matched frames are handed over. Do not draw a swordsman as the female body and do "
            "not report the current Knight body as accepted."
        ),
        "closure_probe": "product.PROD-03 PASS requires a production scene path matching the canonical source",
        "closure_test": "tests/survival/balance/test_product_audit.py::ProductClosureTests::test_blk3_closes_when_the_mounted_body_is_canonical",
        "not_proven_after_closure": "animation fidelity, feet anchors, 720p-4K clarity, licence, armour reversal on unequip (native + human)",
    },
    {
        "blocker_id": "BLK-4",
        "title": "First research is a bootstrap cycle, so the knowledge ladder cannot start",
        "owner": "A3",
        "evidence_class": EVIDENCE_CLASS["BLK-4"],
        "player_impact": (
            "knowledge_spares come only from loot that is not mounted, and the research station needs spares "
            "to be built: the player cannot take the first research step even in a perfect world with loot "
            "hosted. Expected claims for the smelting technology are now 3.53 (corrected from 2.53) of a "
            "container that does not exist."
        ),
        "verified_by": "exact arithmetic over pinned A3 tables + static A1/A3 dependency read",
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/sensitivity.json'));print(d['research_gate'])\"",
        ],
        "minimal_safe_correction": (
            "A3 names ONE non-loot source of knowledge_spares (a native reward, a harvest node, or an explicit "
            "one-time Waystation cache quantity) and keeps the loot table unchanged. No rate is invented."
        ),
        "closure_probe": "the bootstrap-cycle finding disappears from findings.json while the loot table is unchanged",
        "closure_test": "tests/survival/balance/test_adversarial.py::BootstrapClosureTests::test_cycle_clears_when_one_non_loot_spare_source_exists",
        "not_proven_after_closure": "that the player finds it, or that 3.53 claims feels acceptable",
    },
    {
        "blocker_id": "BLK-5",
        "title": "The only survival UI is developer-facing and duplicates A0's HUD job",
        "owner": "A6",
        "evidence_class": EVIDENCE_CLASS["BLK-5"],
        "player_impact": (
            "93 player-visible strings in the survival UI carry developer vocabulary (FIXTURE, PROJECTION, "
            "BLOCKED_PENDING, raw ids). The survival UI also only preloads itself: no production scene "
            "references it, while A0's HUD and A0's overworld HUD already render health/provisions. Mounting "
            "it as-is would put debug text on screen and ship a second HUD."
        ),
        "verified_by": "static read of pinned A6 bytes; no runtime executed",
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/product.json'));print([c for c in d['checks'] if c['check_id'] in ('PROD-04','PROD-06')])\"",
        ],
        "minimal_safe_correction": (
            "A6 moves provenance/fixture vocabulary behind an opt-in debug panel and declares one owner for "
            "status/needs (A0), keeping its survival panel as a child view. No new UI system."
        ),
        "closure_probe": "product.PROD-04 PASS (zero debug literals on visible label paths) and PROD-06 PASS (one status surface)",
        "closure_test": "tests/survival/balance/test_product_audit.py::ProductClosureTests::test_blk5_closes_when_debug_text_and_duplication_are_gone",
        "not_proven_after_closure": "readability at 720p/2K/4K and comprehension (human capture review)",
    },
)


def build(
    findings: Sequence[Dict[str, object]],
    product_checks: Sequence[Dict[str, object]],
    identity: Dict[str, object],
    product_facts: Dict[str, object],
) -> Dict[str, object]:
    """Attach every observation to a blocker and attach evidence to every blocker."""
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
                    EVIDENCE_CLASS.get(blocker, "TRACEABILITY_ONLY")
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

    evidence = {
        "BLK-1": {
            "home_destinations": product_facts.get("home_function_keys"),
            "mounted_survival_ui_scenes": product_facts.get("survival_ui_scenes_mounted"),
            "playable_pois_in_authored_contract": 0,
            "note": "A1 records 118 POIs / 106 contract-only sites; none is reachable from a mounted screen",
        },
        "BLK-2": {
            "loot_records": identity.get("record_count"),
            "distinct_targets": identity.get("distinct_targets"),
            "targets_resolving_to_a1_instance": identity.get("targets_resolving_to_a1_instance"),
            "a1_container_vocabulary": identity.get("a1_container_class_vocabulary"),
            "loot_tables_referenced_by_production_code": product_facts.get("loot_tables_in_production_code"),
            "regions_unresolved": identity.get("regions_unresolved"),
        },
        "BLK-3": {
            "mounted_player_scene": product_facts.get("mounted_player_scene"),
            "canonical_source_production_refs": product_facts.get("canonical_avatar_production_refs"),
            "canonical_source_doc_refs": product_facts.get("canonical_avatar_doc_refs"),
            "armor_stage_art_refs": product_facts.get("armor_stage_refs"),
        },
        "BLK-4": {
            "bootstrap_findings": len(per_blocker["BLK-4"]),
            "knowledge_spares_sources": [
                row["code"] for row in triage if row["blocker_id"] == "BLK-4"
            ],
        },
        "BLK-5": {
            "debug_token_count": len(product_facts.get("visible_debug_tokens") or []),  # type: ignore[arg-type]
            "debug_tokens": sorted(
                {str(row["token"]) for row in (product_facts.get("visible_debug_tokens") or [])}  # type: ignore[union-attr]
            ),
            "status_surfaces": product_facts.get("dashboards"),
            "survival_ui_closed_island": product_facts.get("survival_ui_closed_island"),
            "product_checks": {key: checks_by_id[key]["status"] for key in ("PROD-04", "PROD-06") if key in checks_by_id},
        },
    }

    blockers: List[Dict[str, object]] = []
    for row in BLOCKERS:
        blocker_id = str(row["blocker_id"])
        merged = dict(row)
        merged["observations"] = per_blocker[blocker_id]
        merged["observation_count"] = len(per_blocker[blocker_id])
        merged["evidence"] = evidence[blocker_id]
        merged["status"] = "OPEN"
        blockers.append(merged)

    counts = {
        "raw_observations": len(findings),
        "product_checks": len(product_checks),
        "player_facing_blockers": len(blockers),
        "traceability_only": sum(1 for row in triage if row["blocker_id"] == "NONE"),
        "unmapped_product_checks": sum(
            1 for check in product_checks if CHECK_TO_BLOCKER.get(str(check["check_id"]), "NONE") == "NONE"
        ),
    }
    payload: Dict[str, object] = {
        "schema": "soh.balance.blockers.v2",
        "read_this_first": (
            "Five player-facing blockers, not a findings list. Each has one owner, the smallest safe "
            "correction, and a closure test that flips from FAIL to PASS."
        ),
        "counts": counts,
        "blockers": blockers,
        "triage": triage,
        "reduction": (
            f"{counts['raw_observations']} observations -> {counts['player_facing_blockers']} blockers "
            f"({counts['traceability_only']} observations are traceability/hypothesis only)"
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
        "so every native claim below stays `NOT_TESTED` until its owner runs it.\n"
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
        lines.append(f"**Owner.** {row['owner']}  \n**Evidence class.** {row['evidence_class']}  \n**Verified by.** {row['verified_by']}\n")
        lines.append("**Reproduce.**\n")
        for command in row["reproduce"]:
            lines.append(f"```bash\n{command}\n```")
        lines.append("")
        lines.append(f"**Minimal safe correction.** {row['minimal_safe_correction']}\n")
        lines.append(f"**Test that proves closure.** `{row['closure_test']}`\n")
        lines.append(f"**Still NOT_TESTED after closure.** {row['not_proven_after_closure']}\n")
        lines.append("**Evidence.**\n")
        for key, value in sorted((row["evidence"] or {}).items()):
            lines.append(f"- `{key}` = `{value}`")
        lines.append("")
        lines.append(f"**Absorbs** {row['observation_count']} observation(s).\n")
    return "\n".join(lines)
