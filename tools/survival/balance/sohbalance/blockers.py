"""Collapse the audit into the few blockers a player actually hits — v4.

Round 4 exists because round 3's output contained two claims that the owners' own
source contradicted. This module keeps the measurement honest in three ways:

* every blocker cites the gate link (or quality check) that fails, with the exact
  file and line, and its proof level;
* a blocker is only `CLOSED` when the *source* condition is satisfied **and** the
  native evidence it needs is VERIFIED — a queued CI run can never close anything;
* corrections to A7's own earlier claims are recorded in the payload, because a
  QA report that quietly drops its mistakes is worth nothing.

Blockers carried forward, in the order a player meets them:

    BLK-1  nothing is mounted: no A1 cache instance or A8 site in the reachable world
    BLK-2  A0 ships a stale copy of A3's source catalog (two owners disagree)
    BLK-3  the mounted body is not the locked avatar, and no sheet is installed
    BLK-4  no A1-contract-keyed claim exists, and no native run verifies any of it
    BLK-5  A8's route actions have an item id but no authorized quantity
"""
from __future__ import annotations

from typing import Dict, List, Sequence

CODE_TO_BLOCKER: Dict[str, str] = {
    "POI_NOT_PLAYABLE": "BLK-1",
    "NOT_NATIVE_INTEGRATED": "BLK-1",
    "POI_NOT_ON_ROUTE_GRAPH": "BLK-1",
    "POI_ROUTE_UNREACHABLE": "BLK-1",
    "ROUTE_UNREACHABLE": "BLK-1",
    "ROUTE_LOCKED_FOR_CAPABILITIES": "BLK-1",
    "NONE_ELIGIBLE": "BLK-1",
    "CORE_DROP_RATE_ABSENT": "BLK-1",
    "CAPACITY_TRUNCATED": "BLK-1",
    "SOURCE_POI_UNRESOLVED": "BLK-2",
    "SOURCE_REGION_UNRESOLVED": "BLK-2",
    "SOURCE_ID_DIVERGENCE": "BLK-2",
    "PROVISIONAL_BINDING": "BLK-2",
    "QUANTITY_OWNERSHIP_UNRESOLVED": "BLK-2",
    "ITEM_OVEROWNED": "BLK-2",
    "ZERO_RESTOCK_NOT_RENEWABLE": "BLK-2",
    "REPEATED_ONE_TIME_CLAIM_BLOCKED": "BLK-4",
    "UNIQUE_INSTANCE_DUPLICATION_BLOCKED": "BLK-4",
    # measured false in an earlier round, or traceability only
    "BOOTSTRAP_DEPENDENCY_CYCLE": "CLOSED-R4",
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
    "PROD-04": "CLOSED-R4",
    "PROD-05": "CLOSED-R4",
    "PROD-06": "CLOSED-R4",
    "PROD-07": "CLOSED-R4",
    "Q-01": "CLOSED-R4",
    "Q-02": "CLOSED-R4",
    "Q-03": "BLK-2",
    "Q-04": "BLK-3",
    "Q-05": "CLOSED-R4",
    "Q-06": "CLOSED-R4",
    "Q-07": "CLOSED-R4",
}

# The owner's correction asked for defect classes that cannot be confused with
# "not tested yet". These five are what the pinned bytes actually show.
EVIDENCE_CLASS = {
    "BLK-1": "MISSING_PRODUCTION_MOUNT",
    "BLK-2": "SOURCE_DATA_INCOMPATIBILITY",
    "BLK-3": "PLAYER_FACING_VISUAL_DEFECT",
    "BLK-4": "FIXTURE_ONLY_SUCCESS",
    "BLK-5": "UNAUTHORIZED_COST",
}

CLASSES_NOT_USED = (
    {
        "class": "NATIVE_RUNTIME_FAILURE",
        "why_not": (
            "No run at the five pinned heads has finished, so there is no native runtime evidence of any kind. "
            "A queued workflow is not a failure and is not a pass."
        ),
    },
    {
        "class": "HUMAN_OBSERVED_QUALITY_UNVERIFIED",
        "why_not": (
            "Kept as a standing label (HUMAN_NOT_TESTED) on every visual claim rather than as a blocker, because "
            "no human review of the mounted world has been submitted to A7."
        ),
    },
    {
        "class": "REGION_VS_INSTANCE_ID_CONFUSION",
        "why_not": (
            "Reclassified, not closed as a defect: A3's remaining ten targets are class ids in a ':' namespace, "
            "which is a legitimate class vocabulary, while A1's poi_* are physical instances. Merging or "
            "renaming either set is an owner decision, so this is recorded inside BLK-2 rather than as a 6th ticket."
        ),
    },
)

BLOCKERS: Sequence[Dict[str, object]] = (
    {
        "blocker_id": "BLK-1",
        "title": "The world is reachable, but the A1 cache and A8 site are not mounted in it",
        "owner": "A0 (mount) with A1 (cell + instance identity) and A8 (scene)",
        "evidence_class": EVIDENCE_CLASS["BLK-1"],
        "player_impact": (
            "A player can now walk the menu route Home -> Campaign -> Enter Overworld into A0's own overworld. "
            "That world contains no A1 city node and no A8 site scene, so there is nothing to loot: the "
            "Waystation cache exists only as an authored contract and the quarry only as a harness scene."
        ),
        "verified_by": (
            "gate L2 on both chains (source_state absent-of-content) plus a grep of every pinned A0 byte for "
            "poi_crown_waystation / node_waystation_cache / crown_south_quarry"
        ),
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['entry_content'])\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print([(c['chain_id'],c['chain_level'],c['weakest_link']) for c in d['chains']])\"",
        ],
        "minimal_safe_correction": (
            "A0 places ONE thing into the overworld the route already reaches: the A1 slice node "
            "node_waystation_cache at poi_crown_waystation, or the A8 quarry scene at its A1 cell. A1 supplies "
            "the cell and the persistent instance identity; A8/A1 supply the scene. No new system, no data edit."
        ),
        "closure_probe": "gate L2 reaches a non-empty mounted content set and both chains lose their L2 blocker",
        "closure_test": "tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk1_closes_when_content_is_mounted",
        "native_required_for_closure": False,
        "not_proven_after_closure": "that the mounted node boots and is walkable (native run required)",
    },
    {
        "blocker_id": "BLK-2",
        "title": "A0 ships a stale copy of A3's source catalog, so two owners disagree about the first-hour cache",
        "owner": "A0",
        "evidence_class": EVIDENCE_CLASS["BLK-2"],
        "player_impact": (
            "A3 adopted A1's rebind at c23292be: road_scrap and road_supplies now point at "
            "poi_crown_waystation / node_waystation_cache with A1's own 3 and 2 yields, so A7 changed no loot "
            "rate. A0's mirrored data/survival/items/sources.json still says poi:roadside_cache for exactly "
            "those two rows (34/36 identical), so a runtime that reads A0's copy would look for a container "
            "that no longer exists. Measured consequence of the rebind: the first-hour safe loop now returns "
            "3 iron_scrap + 2 knowledge_spares from a single crown claim, and research_kit needs 3 spares, so "
            "the first station costs a second claim after the 1800 s restock - pacing, not a dead end."
        ),
        "verified_by": "quality Q-03 mirror comparison over the pinned A0 mirror and the pinned A3 catalog (34/36 rows identical)",
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/quality.json'));"
            "print([c for c in d['checks'] if c['check_id']=='Q-03'][0]['evidence'][-1])\"",
        ],
        "minimal_safe_correction": (
            "A0 re-syncs the two drifted rows (or deletes the mirror and reads A3's file). One file, two rows, "
            "no quantity change: the yields already agree."
        ),
        "closure_probe": "quality Q-03 reports the A0 mirror as MATCH (36/36 identical rows)",
        "closure_test": "tests/survival/balance/test_quality.py::QualityClosureTests::test_blk2_closes_when_the_a0_mirror_matches_a3",
        "native_required_for_closure": False,
        "not_proven_after_closure": "that the runtime actually reads the catalog at claim time",
    },
    {
        "blocker_id": "BLK-3",
        "title": "The mounted player body is not the locked avatar, and no grade-0 sheet is installed",
        "owner": "A6 (art import + adapter) with A0 (mount)",
        "evidence_class": EVIDENCE_CLASS["BLK-3"],
        "player_impact": (
            "The body on screen is the old Knight. A6 declares the two locked identities (Craftpix 555940 male, "
            "419402 female) but every claimed sheet is empty, the adapter honestly returns SOURCE_BLOCKED, and "
            "armour grades 1-2 are null. A player sees the wrong character."
        ),
        "verified_by": "quality Q-04: identity + claimed-sheet existence against the pinned tree",
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/quality.json'));"
            "print([c for c in d['checks'] if c['check_id']=='Q-04'][0])\"",
        ],
        "minimal_safe_correction": (
            "A6 installs the grade-0 idle sheet for ONE gender from the user's authorised ZIP and points the "
            "manifest at the installed file; A0 mounts the canonical body. Grades 1-2 stay SOURCE_BLOCKED until "
            "gender-matched armour art is chosen. Never substitute Knight/Swordsman for the base identity."
        ),
        "closure_probe": "Q-04 static verdict REFERENCE_CONSISTENT (canonical mount + every claimed sheet exists)",
        "closure_test": "tests/survival/balance/test_quality.py::QualityClosureTests::test_blk3_closes_when_the_mounted_body_and_grade0_sheet_are_canonical",
        "native_required_for_closure": False,
        "not_proven_after_closure": (
            "directional animation, equipment swap and rendered frames (visual_state stays NOT_TESTED; S5 needs a human)"
        ),
    },
    {
        "blocker_id": "BLK-4",
        "title": "No A1-contract-keyed claim exists, and no native run verifies the reload path",
        "owner": "A0 (claim + native run) with A8 (drop its fixture)",
        "evidence_class": EVIDENCE_CLASS["BLK-4"],
        "player_impact": (
            "A0's SaveService is idempotent, eight proven mounted callers commit through it (harvest and transfers "
            "in SurvivalService, five campaign paths in AppFlow) and A0 ships a genuine two-process reload test. "
            "What does not exist is "
            "a caller keyed on A1's cache contract, so the Waystation reward cannot be paid; A8's quarry commits "
            "through an in-memory fixture. On top of that, every owner workflow at the pinned heads is still "
            "queued, so no native run has verified any of it."
        ),
        "verified_by": (
            "gate L5/L6/L7 (static seam state + evidence file); the evidence file records every run with its "
            "commit, so a green run on another commit cannot be spent here"
        ),
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['commit_seam']['static_state'], d['commit_seam']['mounted_caller_count'], d['commit_seam']['rejected_count'])\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['native_states'])\"",
        ],
        "minimal_safe_correction": (
            "A0 adds ONE caller keyed on 'a1slice:poi_crown_waystation:cache_restock:1' that pays the A1 binding "
            "through add_items_to_candidate inside transact_once; then lands the queued "
            "a0-normal-entry-home-restart workflow green on this commit. A8 swaps its fixture for that caller."
        ),
        "closure_probe": "gate commit_seam.static_state == MOUNTED_A1_CONTRACT_CALLER AND evidence a0_two_process_reload == VERIFIED on the pinned head",
        "closure_test": "tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk4_needs_both_a_contract_caller_and_native_evidence",
        "native_required_for_closure": True,
        "not_proven_after_closure": "durability on a real device, and interaction feel (human)",
    },
    {
        "blocker_id": "BLK-5",
        "title": "A8's quarry route actions have an item id but no authorized quantity",
        "owner": "A3",
        "evidence_class": EVIDENCE_CLASS["BLK-5"],
        "player_impact": (
            "Bracing the east shelf and chocking the west ramp both name their item (oak_wood, stone_chunk) but "
            "carry cost_quantity null and their own authorization note says no approved price exists. Even with "
            "the scene mounted, neither action could be paid, so the quarry route cannot open."
        ),
        "verified_by": "gate L4 on the A8 chain over A8's own quarry_integration_candidate.v1.json",
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['a8_candidate']['unpriced_actions'])\"",
        ],
        "minimal_safe_correction": (
            "A3 authorizes a quantity for the two route actions (a one-time construction cost, not a loot rate). "
            "A8 then replaces its self-declared value with A3's number."
        ),
        "closure_probe": "gate a8_candidate.unpriced_actions is empty and the A8 chain L4 unblocks",
        "closure_test": "tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk5_closes_when_a3_prices_the_two_route_actions",
        "native_required_for_closure": False,
        "not_proven_after_closure": "that the paid cost produces the collision change the player expects (native)",
    },
)

CLOSED: Sequence[Dict[str, object]] = (
    {
        "blocker_id": "BLK-BINDING",
        "was": "A1 authorizes the first-hour cache but A3 has not adopted the binding",
        "disposition": "CLOSED_BY_OWNER_SOURCE",
        "closed_at": "A3 PR19 head c23292be, re-checked against A1 PR20 head 7fd000e1",
        "why": (
            "A3 adopted A1's rebind: road_scrap and road_supplies now carry poi_crown_waystation, "
            "instance node_waystation_cache, region r_ashen_crown, status A1_PINNED_A3_BOUND, with A1's own "
            "yields (3 iron_scrap, 2 knowledge_spares) and the same 1800 active-second renewable window. "
            "A1's third binding is a live-source reuse, not a rebind, and A3 satisfies it as authored."
        ),
        "evidence": {
            "rebind_required": 2,
            "rebind_adopted": 2,
            "live_source_reuse": 1,
            "yields_changed": False,
            "cooldown_active_seconds": 1800,
            "note": "no loot rate was requested or changed by A7 at any point",
        },
        "residual": "A0's mirrored copy of the catalog still has the pre-adoption rows — now BLK-2.",
        "still_needs_owner": "nothing from A3 for this item.",
    },
    {
        "blocker_id": "BLK-BOOTSTRAP",
        "was": "First research is a bootstrap cycle, so the knowledge ladder cannot start",
        "disposition": "CLOSED_MEASURED_FALSE",
        "closed_at": "round 3, re-verified round 4",
        "why": (
            "A1 authorizes 2 knowledge_spares per Waystation cache claim (renewable, 1800 s) and research_kit is "
            "a workbench recipe needing 3 spares, so the ladder starts without any station."
        ),
        "evidence": {
            "cache_spares_per_claim": 2,
            "research_kit_station": "workbench",
            "research_kit_spares": 3,
            "claims_needed_for_first_station_kit": 2,
            "no_rate_changed": True,
        },
        "residual": "two claims = one 1800 s cooldown wait; a pacing question for A3, not a dead end.",
        "still_needs_owner": "A3 confirms the first-station wait is intended.",
    },
    {
        "blocker_id": "BLK-DEBUG-UI",
        "was": "The only survival UI is developer-facing and duplicates A0's HUD",
        "disposition": "CLOSED_NOT_PLAYER_FACING_AT_THIS_PIN",
        "closed_at": "round 3, re-verified round 4",
        "why": (
            "Measured on mounted surfaces the developer vocabulary sits behind _developer_diagnostics "
            "(default false), no production scene mounts the survival UI, and the three HUD scripts own "
            "disjoint jobs."
        ),
        "evidence": {
            "developer_diagnostics_default": False,
            "survival_ui_mounted": False,
            "hud_jobs": ["a0.hud=health", "a0.overworld_hud=provisions", "a6=context/core/feedback"],
        },
        "residual": "PROD-04 keeps its broad file-level FAIL as a hygiene warning, not a player blocker.",
        "still_needs_owner": "A6 keeps the panel opt-in when it mounts.",
    },
)

CORRECTIONS: Sequence[Dict[str, object]] = (
    {
        "id": "CORR-1",
        "round3_claim": "There is no survival entry: the home screen has no survival destination, so no interaction is reachable.",
        "status": "WRONG_AS_STATED",
        "what_is_actually_true": (
            "A0 ships an ordinary menu route — Home hub -> campaign destination -> EnterOverworldButton -> "
            "AppFlow.open_overworld — with no test flag. The A7 detector searched only for a home function key "
            "named 'survival'."
        ),
        "what_remains_true": (
            "The route reaches A0's own overworld; it contains no A1 slice node and no A8 site scene, and no "
            "native run has verified it (every run at the pinned heads is queued)."
        ),
        "fix_in_this_round": "gate.entry_claims separates A (route in source), B (native), C (content mounted), D (reward claimable).",
    },
    {
        "id": "CORR-2",
        "round3_claim": "No mounted path calls SaveService.transact_once, so every reward path is fixture-only.",
        "status": "WRONG_AS_STATED",
        "what_is_actually_true": (
            "Mounted callers do commit through transact_once: harvest and inventory transfers in SurvivalService "
            "plus five campaign-progression paths in AppFlow, with a replay guard inside "
            "_transact_once_internal. Eight further SurvivalService actions (place_structure, death/bag, bed, "
            "door, remove_structure, learn_recipe) are called from files A7 does not pin, so they are reported "
            "as unproven rather than counted."
        ),
        "what_remains_true": (
            "No caller is keyed on an A1 contract key, so the Waystation cache cannot be paid; A8 still commits "
            "through an in-memory fixture; and no native run has verified the two-process reload path."
        ),
        "fix_in_this_round": "gate.commit_seam classifies each caller and lists every rejected match with its reason.",
    },
    {
        "id": "CORR-3",
        "round3_claim": "A3's binding adoption is the second blocker; A1 authorizes but A3 has not adopted.",
        "status": "OVERTAKEN_BY_OWNER_WORK",
        "what_is_actually_true": "A3 adopted it at c23292be with unchanged yields.",
        "what_remains_true": "A0's mirrored copy of the catalog still carries the pre-adoption rows.",
        "fix_in_this_round": "binding adoption is a closed item; the stale mirror is BLK-2.",
    },
    {
        "id": "CORR-4",
        "round3_claim": "The avatar check passes when a manifest points at a sheet and the scene name changes.",
        "status": "SELF_INFLICTED_FALSE_POSITIVE",
        "what_is_actually_true": "An invented res:// path is not an installed image.",
        "what_remains_true": "Nothing is installed at this pin; the check now requires tree existence.",
        "fix_in_this_round": "Q-04 checks identity, sheet existence and substitute code paths separately from visual readiness.",
    },
    {
        "id": "CORR-5",
        "round3_claim": "Injecting a call-shaped string into text is enough to close the commit blocker.",
        "status": "SELF_INFLICTED_FALSE_POSITIVE",
        "what_is_actually_true": "Comments, strings, test files, unmounted files and dead functions are not production.",
        "what_remains_true": "Closing BLK-4 needs the caller plus a VERIFIED native run on the pinned commit.",
        "fix_in_this_round": "gdscan strips comments/strings, checks mounting and dead code; evidence gates S4.",
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
    gate_payload = gate_payload or {}
    quality_payload = quality_payload or {}
    checks_by_id = {str(check["check_id"]): check for check in product_checks}
    quality_by_id = {str(check["check_id"]): check for check in quality_payload.get("checks", []) or []}

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
                "evidence_class": EVIDENCE_CLASS.get(blocker, "CLOSED_OR_TRACEABILITY"),
            }
        )
        if blocker in per_blocker:
            per_blocker[blocker].append({"kind": "finding", "code": code, "subject": finding.get("subject")})
    for check in product_checks:
        blocker = CHECK_TO_BLOCKER.get(str(check["check_id"]), "NONE")
        if blocker in per_blocker:
            per_blocker[blocker].append(
                {"kind": "product_check", "id": check["check_id"], "status": check["status"], "title": check["title"]}
            )
    for check in quality_payload.get("checks", []) or []:
        blocker = CHECK_TO_BLOCKER.get(str(check["check_id"]), "NONE")
        if blocker in per_blocker:
            per_blocker[blocker].append(
                {"kind": "quality_check", "id": check["check_id"], "status": check["status"], "title": check["title"]}
            )

    binding = gate_payload.get("binding_adoption") or identity.get("binding_adoption") or {}
    seam = gate_payload.get("commit_seam") or {}
    native_states = gate_payload.get("native_states") or {}
    evidence = {
        "BLK-1": {
            "entry_route_exists": (gate_payload.get("entry_claims") or {}).get("A_route_exists_in_source", {}).get("state"),
            "content_mounted": (gate_payload.get("entry_claims") or {}).get("C_content_is_mounted", {}).get("state"),
            "a1_instance_refs_in_a0": (gate_payload.get("entry_content") or {}).get("a1_instance_references_in_a0_surface"),
            "a8_instance_refs_in_a0": (gate_payload.get("entry_content") or {}).get("a8_instance_references_in_a0_surface"),
            "a8_site_scenes_in_overworld": (gate_payload.get("entry_content") or {}).get("a8_site_scenes_in_overworld"),
        },
        "BLK-2": {
            "mirror": [
                row
                for check in quality_payload.get("checks", []) or []
                if check["check_id"] == "Q-03"
                for row in check["evidence"]
                if row.get("fact") == "A0 mirror of the A3 catalog"
            ],
            "binding_adoption": binding.get("summary"),
            "a3_rebind_adopted": binding.get("rebind_adopted"),
            "a3_rebind_required": binding.get("rebind_required"),
            "a1_cache_restock_seconds": [
                row.get("cooldown_seconds_proposal")
                for row in (gate_payload.get("waystation_spec") or {}).get("actions") or []
                if row.get("action_id") == "cache_restock"
            ],
        },
        "BLK-3": {
            "q04": (quality_by_id.get("Q-04") or {}).get("static_verdict"),
            "visual_state": (quality_by_id.get("Q-04") or {}).get("visual_state"),
            "mounted_player_scene": product_facts.get("mounted_player_scene"),
        },
        "BLK-4": {
            "static_seam_state": seam.get("static_state"),
            "mounted_caller_count": seam.get("mounted_caller_count"),
            "rejected_call_sites": seam.get("rejected_count"),
            "raw_token_occurrences": seam.get("raw_token_occurrences"),
            "unproven_caller_count": len(seam.get("unproven_callers") or []),
            "two_process_test_in_source": seam.get("two_process_reload_test_in_source"),
            "native_states": native_states,
        },
        "BLK-5": {
            "unpriced_actions": (gate_payload.get("a8_candidate") or {}).get("unpriced_actions"),
            "candidate_status": (gate_payload.get("a8_candidate") or {}).get("status"),
        },
    }

    blockers: List[Dict[str, object]] = []
    for row in BLOCKERS:
        blocker_id = str(row["blocker_id"])
        merged = dict(row)
        merged["observations"] = per_blocker[blocker_id]
        merged["observation_count"] = len(per_blocker[blocker_id])
        merged["evidence"] = evidence[blocker_id]
        merged["gate_links"] = [
            link for link in gate_payload.get("blocked_links", []) or [] if link.get("blocker_id") == blocker_id
        ]
        merged["blocked_gate_links"] = len(merged["gate_links"])
        merged["failing_checks"] = [
            obs["id"]
            for obs in per_blocker[blocker_id]
            if obs.get("kind") in ("product_check", "quality_check") and obs.get("status") == "FAIL"
        ]
        merged["status"] = (
            "OPEN" if merged["blocked_gate_links"] or merged["failing_checks"] else "CLOSED"
        )
        blockers.append(merged)

    counts = {
        "raw_observations": len(findings),
        "product_checks": len(product_checks),
        "quality_checks": len(quality_payload.get("checks", []) or []),
        "player_facing_blockers": len(blockers),
        "closed_blockers": len(CLOSED),
        "corrections_recorded": len(CORRECTIONS),
        "traceability_only": sum(1 for row in triage if row["blocker_id"] == "NONE"),
        "closed_or_traceability": sum(1 for row in triage if row["blocker_id"] in ("NONE", "CLOSED-R4")),
    }
    payload: Dict[str, object] = {
        "schema": "soh.balance.blockers.v4",
        "read_this_first": (
            "Five player-facing blockers. Each names the failing gate link or quality check, its owner, the "
            "smallest safe correction and a closure test. Two earlier A7 claims are corrected rather than "
            "quietly dropped."
        ),
        "counts": counts,
        "blockers": blockers,
        "closed": list(CLOSED),
        "classes_not_used": list(CLASSES_NOT_USED),
        "corrections": list(CORRECTIONS),
        "triage": triage,
        "reduction": (
            f"{counts['raw_observations']} observations -> {counts['player_facing_blockers']} blockers "
            f"({counts['closed_blockers']} closed, {counts['corrections_recorded']} A7 self-corrections, "
            f"{counts['traceability_only']} observations traceability only)"
        ),
    }
    payload["markdown"] = as_markdown(payload)
    return payload


def as_markdown(payload: Dict[str, object]) -> str:
    lines: List[str] = []
    lines.append("# Player-facing blockers (A7, consolidated v4)\n")
    lines.append(
        "_Generated from `data/survival/balance/results/blockers.json` by "
        "`tools/survival/balance/run_analysis.py`. Do not edit by hand._\n"
    )
    lines.append(
        f"**{payload['reduction']}.** Proof levels are the gate's `S0`–`S5`. Source text can reach `S3`; `S4` "
        "requires a green native run on the pinned commit, which no owner has yet. Nothing below was executed "
        "by A7.\n"
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
            f"**Verified by.** {row['verified_by']}  \n"
            f"**Native run required to close.** {row['native_required_for_closure']}\n"
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
            lines.append("**Blocked gate links.**\n")
            lines.append("| Chain | Link | Source state | Native | Level | Missing |\n|---|---|---|---|---|---|")
            for link in linked:
                lines.append(
                    f"| {link['chain_id']} | {link['link']} | `{link.get('level')}` | {link.get('native_state')} | "
                    f"`{link.get('level')}` | {link.get('missing')} |"
                )
            lines.append("")
        lines.append("**Evidence.**\n")
        for key, value in sorted((row["evidence"] or {}).items()):
            lines.append(f"- `{key}` = `{value}`")
        lines.append("")
    lines.append("## Closed, kept for traceability\n")
    for row in payload["closed"]:
        lines.append(f"### {row['blocker_id']} — was: _{row['was']}_\n")
        lines.append(f"**Disposition.** `{row['disposition']}` at {row['closed_at']}\n")
        lines.append(f"**Why.** {row['why']}\n")
        lines.append(f"**Residual.** {row['residual']}\n")
        lines.append(f"**Still with the owner.** {row['still_needs_owner']}\n")
        lines.append("**Evidence.**\n")
        for key, value in sorted((row["evidence"] or {}).items()):
            lines.append(f"- `{key}` = `{value}`")
        lines.append("")
    lines.append("## A7 self-corrections (round 4)\n")
    for row in payload["corrections"]:
        lines.append(f"### {row['id']} — `{row['status']}`\n")
        lines.append(f"**Round-3 claim.** {row['round3_claim']}\n")
        lines.append(f"**What is actually true.** {row['what_is_actually_true']}\n")
        lines.append(f"**What remains true.** {row['what_remains_true']}\n")
        lines.append(f"**Fix in this round.** {row['fix_in_this_round']}\n")
    return "\n".join(lines)
