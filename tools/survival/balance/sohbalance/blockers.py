"""Collapse the audit into the few blockers a player actually hits - v5.

Round 5 keeps round 4's discipline (one owner, one smallest correction, one test
that flips FAIL to PASS, and a recorded correction whenever A7 was wrong) and adds
what the review demanded:

* a blocker is only CLOSED when the *source* condition holds **and** the native
  evidence it needs is VERIFIED on the pinned commit - S4 is a five-clause
  conjunction, never a workflow tick;
* oracles take their answer from outside the file under review (engine class
  list, Godot's JSON contract, the recipe graph, A3's pinned catalog), so a marker
  or a fixture cannot authorize itself;
* five blockers, ordered by what actually stops a player.

    BLK-1  no production mount: the A1 cache and A8 site are in no reachable world
    BLK-2  A8 scenes call Vector2.from_array, which Godot does not have
    BLK-3  the save writer loses float precision, so restart equality is broken
    BLK-4  the only paid cache proof is a fixture, and its own reload checks fail
    BLK-5  the player body is the Knight; the locked avatar art is not imported
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
    "SOURCE_POI_UNRESOLVED": "BLK-1",
    "SOURCE_REGION_UNRESOLVED": "BLK-1",
    "SOURCE_ID_DIVERGENCE": "CLOSED-R5",
    "PROVISIONAL_BINDING": "CLOSED-R5",
    "QUANTITY_OWNERSHIP_UNRESOLVED": "BLK-4",
    "ITEM_OVEROWNED": "CLOSED-R5",
    "ZERO_RESTOCK_NOT_RENEWABLE": "CLOSED-R5",
    "REPEATED_ONE_TIME_CLAIM_BLOCKED": "BLK-4",
    "UNIQUE_INSTANCE_DUPLICATION_BLOCKED": "BLK-4",
    "BOOTSTRAP_DEPENDENCY_CYCLE": "BLK-1",
    "RESISTANCE_CHAIN_BLOCKED": "NONE",
    "SOURCE_REQUIREMENT_UNMAPPED": "NONE",
    "CAPABILITY_SELF_DEPENDENCY": "NONE",
    "CAPABILITY_ORPHAN": "NONE",
    "DEATH_CARGO_LOSS_UNMODELLED": "NONE",
    "HYPOTHESIS_USED": "NONE",
}

CHECK_TO_BLOCKER: Dict[str, str] = {
    "PROD-01": "BLK-1",
    "PROD-02": "BLK-1",
    "PROD-03": "BLK-5",
    "PROD-04": "CLOSED-R5",
    "PROD-05": "CLOSED-R5",
    "PROD-06": "CLOSED-R5",
    "PROD-07": "CLOSED-R5",
    "Q-01": "CLOSED-R5",
    "Q-02": "CLOSED-R5",
    "Q-03": "CLOSED-R5",
    "Q-04": "BLK-5",
    "Q-05": "CLOSED-R5",
    "Q-06": "BLK-5",
    "Q-07": "BLK-4",
}

# Each blocker is one of the owner's own failure classes, not an A7 opinion.
EVIDENCE_CLASS = {
    "BLK-1": "MISSING_PRODUCTION_MOUNT",
    "BLK-2": "NATIVE_RUNTIME_FAILURE",
    "BLK-3": "SOURCE_OF_TRUTH_DEFECT",
    "BLK-4": "FIXTURE_ONLY_SUCCESS",
    "BLK-5": "PLAYER_FACING_VISUAL_DEFECT",
}

CLASSES_NOT_USED = (
    {
        "class": "HUMAN_OBSERVED_QUALITY_UNVERIFIED",
        "why_not": (
            "Kept as a standing label (HUMAN_NOT_TESTED) on every visual claim rather than as a blocker: no "
            "human review of the mounted world has been submitted to A7, so there is nothing to grade."
        ),
    },
    {
        "class": "REGION_VS_INSTANCE_ID_CONFUSION",
        "why_not": (
            "Closed by owner source this round: A1 publishes both ids for the same object "
            "(instance_id si:r_ashen_crown:waystation_cache:01, interaction_node_id node_waystation_cache) and "
            "A3 binds the interaction node id, so the two vocabularies meet at a named seam."
        ),
    },
)

BLOCKERS: Sequence[Dict[str, object]] = (
    {
        "blocker_id": "BLK-1",
        "title": "The A1 cache and A8 site are placed in no world a player can reach",
        "owner": "A0 (mount) with A1 (cell + instance identity) and A8 (scene)",
        "evidence_class": EVIDENCE_CLASS["BLK-1"],
        "player_impact": (
            "The menu route into A0's overworld works in source, and A1's corridor authors exactly four physical "
            "bodies, but none of them is placed in that world: no production A0 file names "
            "poi_crown_waystation, node_waystation_cache or any A8 site scene. The consequence is sharper than "
            "'nothing to loot' - knowledge_spares has exactly one non-circular source in the whole catalog (that "
            "cache), because every spare recipe needs a research station, so a player can harvest stone and wood "
            "all hour and still never begin research."
        ),
        "verified_by": (
            "gate claim C over production paths only (tests/.github/tools excluded and reported separately), "
            "plus A1's own corridor status SOURCE_AND_ISOLATED_NATIVE_FIXTURE_SCOPE_NOT_PRODUCTION and "
            "production_native_playable=false, plus oracle.knowledge_gate"
        ),
        "owner_commands": [
            '# A0, on the host with the Godot 4.7 binary and a display (xvfb is fine):',
            'godot --headless --path . --user-data-dir artifacts/ud_entry --import',
            'xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 godot --path . --user-data-dir artifacts/ud_entry \\',
            '  --script res://tests/survival_normal_entry_home_restart_test.gd',
            '# expected once mounted: the log names node_waystation_cache as present in the world',
        ],
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['entry_content']['a1_instance_references_in_a0_surface'], d['entry_content']['mounted'])\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/oracle.json'));"
            "k=d['knowledge_gate'];print(k['verdict'], k['non_circular_spare_recipes'], "
            "list(k['spare_loot_sources']))\"",
            "git show refs/a1:data/survival/world/corridor/crown_roadside.corridor.v1.json | "
            "python3 -c \"import json,sys;d=json.load(sys.stdin);print(d['status'], "
            "d['production_native_playable'])\"",
        ],
        "minimal_safe_correction": (
            "A0 places the existing A1 instance node_waystation_cache at poi_crown_waystation inside the one "
            "production overworld the route already reaches. No new system, no data edit, no rate change: A1 "
            "supplies the cell and identity, A3 already prices the reward."
        ),
        "closure_probe": (
            "gate claim C is SOURCE_PRESENT from a production path and both chains lose their L2/L3 blocker"
        ),
        "closure_test": "tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk1_needs_a_production_path_not_a_test_harness",
        "native_required_for_closure": False,
        "not_proven_after_closure": "that the mounted node boots, is walkable and is interactable (native run)",
    },
    {
        "blocker_id": "BLK-2",
        "title": "A8's scene scripts call Vector2.from_array, which no Godot release exposes",
        "owner": "A8",
        "evidence_class": EVIDENCE_CLASS["BLK-2"],
        "player_impact": (
            "Every A8 scene position, portal, socket and interior spawn is read through "
            "Vector2.from_array(...) - 15 live call sites across native_poi_site.gd, native_poi_shell.gd and "
            "poi_pilot.gd. Godot's Vector2 has exactly one static method (from_angle), so these calls cannot "
            "resolve; the scenes cannot position anything, and A8's own contract step fails while the "
            "import-only step above it passes and uploads no artifact."
        ),
        "verified_by": (
            "oracle.engine_api against the engine's own class documentation, plus A8 run 41019689728 at "
            "2d7f10d3: import succeeded, 'Run native physics, intent and persistence contracts' failed, no "
            "artifacts produced"
        ),
        "owner_commands": [
            '# A8, same engine: the audit is the oracle, the native step is the proof',
            'godot --headless --path . --script tests/survival/world_content/native_poi_contract_test.gd',
            'godot --headless --path . --script tests/survival/world_content/native_poi_transition_test.gd',
            '# both must exit 0 and upload .artifacts/a8-world-content/ on the pinned sha',
        ],
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/oracle.json'));"
            "print(d['engine_api']['unknown_call_count']);[print(r['file'],r['line'],r['call']) "
            "for r in d['engine_api']['unknown_calls'][:5]]\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/engine_api.v1.json'));"
            "print(sorted(d['static_methods']['Vector2']))\"",
        ],
        "minimal_safe_correction": (
            "A8 replaces each call with the array form that exists - Vector2(arr[0], arr[1]) on a two-element "
            "array, or Vector2i(...) where the value is a cell. Mechanical, 15 sites, no design change."
        ),
        "closure_probe": "oracle engine_api unknown_call_count is 0 and A8's contract step passes on the pinned sha",
        "closure_test": "tests/survival/balance/test_oracle.py::EngineApiOracleTests::test_a8_call_sites_disappear_after_the_conversion",
        "native_required_for_closure": True,
        "not_proven_after_closure": "that the repaired scenes reach the player's world (BLK-1)",
    },
    {
        "blocker_id": "BLK-3",
        "title": "The float-precision fix is in A0's tree but no native run on the pinned sha has exercised it",
        "owner": "A0",
        "evidence_class": EVIDENCE_CLASS["BLK-3"],
        "player_impact": (
            "At this pin the authoritative writer is correct - JSON.stringify(snapshot, \"\\t\", false, true) at "
            "save_service.gd:2459 - so the oracle now reads ROUND_TRIP_EXACT. But the only native word on the "
            "defect is two failed runs on the older tree, where whole-document equality broke while every "
            "targeted integer comparison passed, and the workflow that proves the fix triggers only on A0's own "
            "branch. Until a green a0-save-precision run is cited on the pinned sha, a player's profile still "
            "has no evidence that it reloads exactly as written."
        ),
        "verified_by": (
            "oracle.save_fidelity over the pinned writer (ROUND_TRIP_EXACT, one authoritative writer) plus the "
            "failure labels recorded verbatim from 41018366655 and 41022547962"
        ),
        "owner_commands": [
            "# A0: the workflow only triggers on A0's branch, so dispatch or push it there",
            'godot --headless --path . --user-data-dir artifacts/ud_precision --import',
            'godot --headless --path . --user-data-dir artifacts/ud_precision \\',
            '  --script res://tests/survival_save_precision_test.gd -- --survival-save-fault-test',
            'godot --headless --path . --user-data-dir artifacts/ud_precision \\',
            '  --script res://tests/survival_save_precision_test.gd -- --survival-save-fault-test --restart',
            "# both logs must print 'A0 SAVE PRECISION PASSED'",
        ],
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/oracle.json'));"
            "f=d['save_fidelity'];print(f['verdict'], f['authoritative_writer_count']);"
            "[print(w['file'],w['line'],w['full_precision']) for w in f['writers'] if w['authoritative']]\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['native_states']['a0_save_precision']['state'])\"",
        ],
        "minimal_safe_correction": (
            "A0 dispatches a0-save-precision on the pinned sha (its trigger is branch-locked to A0's own branch) "
            "and cites the green run. No code change is needed any more; the fix is already in the tree."
        ),
        "closure_probe": (
            "oracle save_fidelity is ROUND_TRIP_EXACT and a0_save_precision is VERIFIED on the pinned sha"
        ),
        "closure_test": "tests/survival/balance/test_oracle.py::SaveFidelityOracleTests::test_whole_document_reload_is_impossible_to_prove_without_full_precision",
        "native_required_for_closure": True,
        "not_proven_after_closure": "durability across a real OS restart or power loss (a simulated boundary is not that)",
    },
    {
        "blocker_id": "BLK-4",
        "title": "The only A3-authorized cache reward is proved by a fixture, and its reload checks fail",
        "owner": "A0 (player-input path) with A3 (event identity)",
        "evidence_class": EVIDENCE_CLASS["BLK-4"],
        "player_impact": (
            "The single run that has ever paid 3 iron_scrap + 2 knowledge_spares is survival_waystation_authority_test.gd, "
            "whose own header says it 'does not prove player input, physical reach, production mount or OS restart' "
            "and which funds its own inventory and advances its own clock. It fails two of its own whole-snapshot "
            "checks (41022547962). The player-input half of the same workflow was skipped, so real input has never "
            "produced a receipt, and the S4 conjunction is 0 of 5 clauses at this pin."
        ),
        "verified_by": (
            "evidence.s4_clauses (exact sha + normal entry + independent process + authorized commit + negative "
            "replay) and the skipped step in run 41022547962"
        ),
        "owner_commands": [
            '# A0: the fixture half is the only thing that has ever produced a receipt',
            'godot --headless --path . --user-data-dir artifacts/ud_authority \\',
            '  --script res://tests/survival_waystation_authority_test.gd -- --survival-save-fault-test',
            '# the player-input half has never run; this is the command that would prove it',
            'xvfb-run -a godot --path . --user-data-dir artifacts/ud_waystation --resolution 960x540 \\',
            '  --script res://tests/survival_waystation_input_restart_test.gd',
            'xvfb-run -a godot --path . --user-data-dir artifacts/ud_waystation --resolution 960x540 \\',
            '  --script res://tests/survival_waystation_input_restart_test.gd -- --restart',
        ],
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['s4']['s4_granted']);[print(k,v['state']) for k,v in d['s4']['clauses'].items()]\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['commit_seam']['static_state'], d['commit_seam']['mounted_caller_count'])\"",
        ],
        "minimal_safe_correction": (
            "A0 makes the player-input half run and pass on the pinned sha - the same event earning the same "
            "receipt through real input, with the second process refusing a replay. No new reward, no new key."
        ),
        "closure_probe": "gate s4_granted is true: all five clauses hold on the pinned sha",
        "closure_test": "tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk4_needs_all_five_s4_clauses",
        "native_required_for_closure": True,
        "not_proven_after_closure": "that the reward is useful (BLK-1) or repeatable by a human (S5)",
    },
    {
        "blocker_id": "BLK-5",
        "title": "The player body is still the Knight; the locked avatar art is not imported",
        "owner": "A6 (import + adapter) with A0 (mount)",
        "evidence_class": EVIDENCE_CLASS["BLK-5"],
        "player_impact": (
            "The mounted body is game/characters/knight/knight.tscn. A6 is honest about the replacement: its "
            "manifest says BASE_ART_NOT_IMPORTED, runtime_status NOT_IMPORTED and idle_sheet \"\" for the "
            "authorised identities (Craftpix 555940 male, 419402 female), and the adapter returns SOURCE_BLOCKED "
            "instead of substituting another character. So nothing is faked - and nothing is visible either."
        ),
        "verified_by": "quality Q-04 over the pinned tree (mounted scene identity, claimed sheets, adapter fallback)",
        "owner_commands": [
            '# A6 + A0: import the authorised grade-0 sheet, then mount the body and look at it',
            'godot --headless --path . --import',
            'godot --path . --resolution 1280x720   # open the overworld and inspect the avatar',
            '# rendered-frame inspection is S5 work: it cannot be closed from this repository',
        ],
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/quality.json'));"
            "print([c for c in d['checks'] if c['check_id']=='Q-04'][0]['static_verdict'])\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/product.json'));"
            "print(d['player_surface_facts']['mounted_player_scene'])\"",
        ],
        "minimal_safe_correction": (
            "A6 imports the grade-0 idle sheet for ONE gender from the authorised archive, points the manifest at "
            "the installed file, and A0 mounts that scene. Grades 1-2 stay SOURCE_BLOCKED; no Knight/Swordsman "
            "substitution."
        ),
        "closure_probe": "Q-04 static verdict REFERENCE_CONSISTENT with the canonical body mounted",
        "closure_test": "tests/survival/balance/test_quality.py::QualityClosureTests::test_blk5_closes_when_the_mounted_body_and_grade0_sheet_are_canonical",
        "native_required_for_closure": False,
        "not_proven_after_closure": "directional animation, armour swap and rendered frames (S5, human)",
    },
)

CLOSED: Sequence[Dict[str, object]] = (
    {
        "blocker_id": "BLK-MIRROR",
        "was": "A0 shipped a stale copy of A3's source catalog (34/36 rows, 2 drifted)",
        "disposition": "CLOSED_BY_OWNER_SOURCE",
        "closed_at": "A0 2faf005b, re-checked against A3 100b3406",
        "why": (
            "Q-03 now reports MATCH over all 36 rows: A0's mirrored data/survival/items/sources.json carries the "
            "adopted A1 binding for road_scrap and road_supplies. No quantity changed, because A1 and A3 already "
            "agreed on 3 and 2."
        ),
        "evidence": {"q03": "PASS", "mirror_rows": 36, "divergent": []},
        "residual": "the mirror is still a copy; drift can return on the next A3 edit, which is why Q-03 stays.",
        "still_needs_owner": "nothing for this item.",
    },
    {
        "blocker_id": "BLK-BINDING",
        "was": "A1 authorizes the first-hour cache but A3 had not adopted the binding",
        "disposition": "CLOSED_BY_OWNER_SOURCE",
        "closed_at": "A3 100b3406 built on c23292be; re-checked against A1 2f6edd3f",
        "why": (
            "A3 adopted both instance rebinds and keeps A1's own yields (3 iron_scrap, 2 knowledge_spares) and the "
            "1800 active-second window. The third binding is a live-source reuse, satisfied as authored. A7 "
            "requested no rate change at any point."
        ),
        "evidence": {"rebind_required": 2, "rebind_adopted": 2, "yields_changed": False, "cooldown": 1800},
        "residual": "the reward still has nowhere to be paid - now BLK-1/BLK-4.",
        "still_needs_owner": "nothing from A3 for this item.",
    },
    {
        "blocker_id": "BLK-INSTANCE-ID",
        "was": "A1's physical instance id (si:r_ashen_crown:waystation_cache:01) and A3's node_waystation_cache might not meet",
        "disposition": "CLOSED_BY_OWNER_SOURCE",
        "closed_at": "A1 2f6edd3f, A3 100b3406",
        "why": (
            "A1 publishes both ids for one object - instance_id for the physical body and interaction_node_id for "
            "the interaction - and A3 binds the interaction node id. The vocabularies meet at a named seam instead "
            "of being silently aliased, which was the actual risk."
        ),
        "evidence": {"a1_instance": "si:r_ashen_crown:waystation_cache:01", "a1_interaction_node": "node_waystation_cache", "a3_instance": "node_waystation_cache"},
        "residual": "A1 still declares production_native_playable=false for the corridor (BLK-1).",
        "still_needs_owner": "nothing for the id contract.",
    },
    {
        "blocker_id": "BLK-DEBUG-UI",
        "was": "The only survival UI is developer-facing and duplicates A0's HUD",
        "disposition": "CLOSED_NOT_PLAYER_FACING_AT_THIS_PIN",
        "closed_at": "round 3, re-verified at A6 8bc0af5a",
        "why": (
            "No production scene mounts the survival UI, the developer vocabulary sits behind "
            "_developer_diagnostics (default false), and the three HUD scripts own disjoint jobs."
        ),
        "evidence": {"survival_ui_mounted": False, "hud_jobs": ["a0.hud=health", "a0.overworld_hud=provisions", "a6=context/core/feedback"]},
        "residual": "PROD-04 keeps its file-level FAIL as hygiene, not as a player blocker.",
        "still_needs_owner": "A6 keeps the panel opt-in when it mounts.",
    },
)

CORRECTIONS: Sequence[Dict[str, object]] = (
    {
        "id": "CORR-6",
        "round4_claim": "The first-research bootstrap cycle is CLOSED_MEASURED_FALSE: 2 spares per claim, 3 needed, so two claims reach it.",
        "status": "TRUE ONLY ONCE THE CACHE IS MOUNTED",
        "what_is_actually_true": (
            "Walking the catalog: every recipe that yields knowledge_spares (make_spares, study_predator_jaw, "
            "study_axe_insignia) requires a research station, and the research station costs a research_kit that "
            "needs 3 spares. The only non-circular seed is road_supplies from the A1 cache, which is mounted "
            "nowhere. At this pin the cycle is real."
        ),
        "what_remains_true": "with the cache mounted, two claims (one 1800 s restock) do reach the kit, as round 4 said.",
        "fix_in_this_round": "the closure is now expressed as a conditional and computed by oracle.knowledge_gate, not asserted.",
    },
    {
        "id": "CORR-7",
        "round4_claim": "Claim C (content mounted) reads every pinned A0 byte.",
        "status": "WOULD HAVE PRODUCED A FALSE POSITIVE",
        "what_is_actually_true": (
            "Round 5 pins A0's own test harness, which names node_waystation_cache. Counting test references as a "
            "production mount flipped claim C to SOURCE_PRESENT in this round's first run - the exact defect the "
            "claim exists to catch, produced by A7's own pinning change."
        ),
        "what_remains_true": "no production A0 file names the instance; the mount is still absent.",
        "fix_in_this_round": "entry_content now reads production paths only and reports the excluded test references separately.",
    },
    {
        "id": "CORR-8",
        "round4_claim": "A6 'points the manifest at an invented sheet' was the central avatar risk.",
        "status": "NOT WHAT THE BYTES SAY",
        "what_is_actually_true": (
            "A6 declares BASE_ART_NOT_IMPORTED, idle_sheet \"\" and runtime_status NOT_IMPORTED, and its adapter "
            "returns SOURCE_BLOCKED. It is not spoofing anything; the defect is that the locked identity is not "
            "imported at all."
        ),
        "what_remains_true": "the mounted body is still the Knight, so a player sees the wrong character.",
        "fix_in_this_round": "BLK-5 states the honest condition and Q-04 keeps grading the real mount.",
    },
)

OPEN_CONDITIONS = {
    "BLK-1": "no production A0 path names the A1 cache instance, so claim C is not SOURCE_PRESENT",
    "BLK-2": "oracle.engine_api reports at least one call to a static method the engine class does not expose",
    "BLK-3": "the pinned writer is lossy, or no green a0-save-precision run is cited on the pinned sha",
    "BLK-4": "gate.s4 is not granted: at least one of the five native clauses does not hold on the pinned sha",
    "BLK-5": "quality Q-04 is not REFERENCE_CONSISTENT for the canonical mounted body",
}


def _is_open(blocker_id: str, evidence: Dict[str, object]) -> bool:
    if blocker_id == "BLK-1":
        return not bool(evidence.get("content_mounted"))
    if blocker_id == "BLK-2":
        return int(evidence.get("unknown_engine_calls") or 0) > 0
    if blocker_id == "BLK-3":
        return str(evidence.get("verdict")) != "ROUND_TRIP_EXACT" or str(
            evidence.get("save_precision_native_state")
        ) != "VERIFIED"
    if blocker_id == "BLK-4":
        return evidence.get("s4_granted") is not True
    if blocker_id == "BLK-5":
        return str(evidence.get("q04")) != "REFERENCE_CONSISTENT"
    return True


def build(
    findings: Sequence[Dict[str, object]],
    product_checks: Sequence[Dict[str, object]],
    identity: Dict[str, object],
    product_facts: Dict[str, object],
    gate_payload: Dict[str, object] | None = None,
    quality_payload: Dict[str, object] | None = None,
    oracle_payload: Dict[str, object] | None = None,
) -> Dict[str, object]:
    gate_payload = gate_payload or {}
    oracle_payload = oracle_payload or {}
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
    content = gate_payload.get("entry_content") or {}
    s4 = gate_payload.get("s4") or {}
    oracle_api = oracle_payload.get("engine_api") or {}
    oracle_fid = oracle_payload.get("save_fidelity") or {}
    oracle_know = oracle_payload.get("knowledge_gate") or {}
    evidence = {
        "BLK-1": {
            "production_instance_refs": content.get("a1_instance_references_in_a0_surface"),
            "production_a8_refs": content.get("a8_instance_references_in_a0_surface"),
            "non_production_refs_excluded": sorted((content.get("non_production_references") or {}).keys()),
            "content_mounted": content.get("mounted"),
            "claim_C": (gate_payload.get("entry_claims") or {}).get("C_content_is_mounted", {}).get("state"),
            "knowledge_gate": oracle_know.get("verdict"),
            "non_circular_spare_recipes": oracle_know.get("non_circular_spare_recipes"),
            "spare_loot_sources": sorted((oracle_know.get("spare_loot_sources") or {}).keys()),
            "claims_needed_for_first_station": oracle_know.get("claims_needed_for_first_station"),
        },
        "BLK-2": {
            "unknown_engine_calls": oracle_api.get("unknown_call_count"),
            "sample": oracle_api.get("unknown_calls", [])[:5] if oracle_api.get("unknown_calls") else [],
            "static_calls_checked": oracle_api.get("static_call_count"),
            "audited_types": oracle_api.get("audited_types"),
            "a8_last_run": next(
                (row for row in (gate_payload.get("native_outcome_ledger") or []) if str(row.get("workflow")) == "a8-world-content-native.yml"),
                None,
            ),
        },
        "BLK-3": {
            "verdict": oracle_fid.get("verdict"),
            "authoritative_writers": oracle_fid.get("authoritative_writer_count"),
            "lossy_writers": oracle_fid.get("lossy_writers"),
            "formula": oracle_fid.get("formula"),
            "save_precision_native_state": (native_states.get("a0_save_precision") or {}).get("state"),
            "failing_native_labels": [
                {"run_id": row.get("run_id"), "head_sha": row.get("head_sha"), "failed": row.get("failed_checks")}
                for row in (gate_payload.get("native_outcome_ledger") or [])
                if row.get("failed_checks")
            ],
        },
        "BLK-4": {
            "static_seam_state": seam.get("static_state"),
            "mounted_caller_count": seam.get("mounted_caller_count"),
            "s4_granted": s4.get("s4_granted"),
            "s4_clauses": {k: v.get("state") for k, v in (s4.get("clauses") or {}).items()},
            "native_states": {k: v.get("state") for k, v in native_states.items()},
        },
        "BLK-5": {
            "q04": (quality_by_id.get("Q-04") or {}).get("static_verdict"),
            "visual_state": (quality_by_id.get("Q-04") or {}).get("visual_state"),
            "mounted_player_scene": product_facts.get("mounted_player_scene"),
            "canonical_avatar_production_refs": product_facts.get("canonical_avatar_production_refs"),
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
        # A blocker is open because its own condition is false, not because some
        # unrelated check is red. Each condition is the closure probe above.
        merged["open_condition"] = OPEN_CONDITIONS[blocker_id]
        merged["status"] = "OPEN" if _is_open(blocker_id, merged["evidence"]) else "CLOSED"
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
        "schema": "soh.balance.blockers.v5",
        "read_this_first": (
            "Five player-facing blockers, each with one owner, one smallest safe correction and a test that "
            "flips FAIL to PASS. A blocker closes only when the source condition holds AND the native evidence "
            "it needs is VERIFIED on the pinned sha. Three earlier A7 claims are corrected rather than dropped."
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
    lines.append("# Player-facing blockers (A7, consolidated v5)\n")
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
        owner_commands = row.get("owner_commands") or []
        if owner_commands:
            lines.append("**Run it natively (owner-side, exact command).**\n")
            lines.append("```bash\n" + "\n".join(owner_commands) + "\n```\n")
        lines.append("**Reproduce the static finding.**\n")
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
    lines.append("## A7 self-corrections\n")
    for row in payload["corrections"]:
        lines.append(f"### {row['id']} — `{row['status']}`\n")
        earlier = row.get("round4_claim") or row.get("round3_claim") or ""
        lines.append(f"**A7's earlier claim.** {earlier}\n")
        lines.append(f"**What is actually true.** {row['what_is_actually_true']}\n")
        lines.append(f"**What remains true.** {row['what_remains_true']}\n")
        lines.append(f"**Fix in this round.** {row['fix_in_this_round']}\n")
    return "\n".join(lines)
