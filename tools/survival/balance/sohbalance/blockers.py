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
    "SOURCE_ID_DIVERGENCE": "BLK-2",
    "PROVISIONAL_BINDING": "BLK-2",
    "QUANTITY_OWNERSHIP_UNRESOLVED": "BLK-4",
    "ITEM_OVEROWNED": "CLOSED-R6",
    "ZERO_RESTOCK_NOT_RENEWABLE": "CLOSED-R6",
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
    "PROD-02": "BLK-2",
    "PROD-03": "BLK-5",
    # Not a closed bucket: a WARN that nothing mounts yet is traceability, and it
    # re-promotes itself to a blocker the moment A6's UI is mounted.
    "PROD-04": "NONE",
    "PROD-05": "CLOSED-R6",
    "PROD-06": "CLOSED-R6",
    "PROD-07": "CLOSED-R6",
    "Q-01": "CLOSED-R6",
    "Q-02": "CLOSED-R6",
    "Q-03": "BLK-2",
    "Q-04": "BLK-5",
    "Q-05": "CLOSED-R6",
    "Q-06": "BLK-5",
    "Q-07": "BLK-4",
}

# How far a blocker has actually moved. The distinction that round 6 adds: a
# source fix is not a native pass, and a guarded candidate is not a mount.
FIX_STATES = (
    "SOURCE_ABSENT",
    "SOURCE_PRESENT_BEHIND_GUARD",
    "SOURCE_PRESENT_UNRESOLVED",
    "SOURCE_FIXED_PENDING_NATIVE",
    "RUNTIME_UNKNOWN",
    "NATIVE_VERIFIED",
)

EVIDENCE_CLASS = {
    "BLK-1": "MISSING_PRODUCTION_MOUNT",
    "BLK-2": "CROSS_OWNER_IDENTITY_MISMATCH",
    "BLK-3": "SOURCE_FIXED_NATIVE_PENDING",
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
            "Now a live blocker, not a naming quibble: A3 moved the canonical id to "
            "si:r_ashen_crown:waystation_cache:01 while A0 still vendors the alias node_waystation_cache, and A0's "
            "own host sends the si id. Recorded as BLK-2 with the exact unresolved request."
        ),
    },
)

BLOCKERS: Sequence[Dict[str, object]] = (
    {
        "blocker_id": "BLK-1",
        "title": "The only Waystation in production code is a candidate behind a project setting the shipped game does not enable",
        "owner": "A0",
        "evidence_class": EVIDENCE_CLASS["BLK-1"],
        "fix_state": "SOURCE_PRESENT_BEHIND_GUARD",
        "player_impact": (
            "A0 9269739e now builds a real physical host: five interaction points with stand cells, a range check, "
            "and A1's actual slice geometry mounted from byte-identical A1 939720d5 bytes. But the whole branch "
            "hangs on ProjectSettings survival/a0_waystation_candidate, and the shipped project.godot does not "
            "contain that key. Godot's fallback is false, so a normal player never enters the branch: the first "
            "useful reward in the game is unreachable by ordinary play even though the code exists."
        ),
        "verified_by": (
            "gate entry_content.guard, read from the pinned project.godot and chapter1_overworld.gd, plus the "
            "byte comparison of A0's vendored slice against A1's current slice"
        ),
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['entry_claims']['C_content_is_mounted']['state'], d['entry_content']['guard'])\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/snapshot/product_manifest.json'));"
            "print([f['sha256'][:12] for f in d['files'] if f['path'].endswith('poi_crown_waystation.slice.json')])\"",
        ],
        "owner_commands": [
            "# A0: prove the guarded branch boots at all, on the pinned sha",
            "godot --headless --path . --user-data-dir artifacts/ud_entry --import",
            "xvfb-run -a godot --path . --resolution 1280x720 --script res://tests/survival_normal_entry_home_restart_test.gd",
            "# and prove the CANDIDATE branch specifically (currently never executed by CI).",
            "# Godot 4 has no CLI switch for a project setting, so the branch is proved one",
            "# of two ways: put the key in project.godot (the fix) and run the same script, or",
            "# run A7's probe with --force-branch, which sets it in memory and labels the run",
            "# SOURCE_PRESENT_BEHIND_GUARD rather than acceptance:",
            "xvfb-run -a godot --path . --script res://tests/survival/balance_native/first_hour_route_probe.gd -- --force-branch",
        ],
        "minimal_safe_correction": (
            "A0 decides the guard's default. Either set survival/a0_waystation_candidate=true in project.godot "
            "once the interaction is proven, or mount the host unconditionally and keep the flag for the annex "
            "geometry only. One line, no new system."
        ),
        "closure_probe": "claim C is MOUNTED_BY_DEFAULT and guard.enabled_by_default is true",
        "closure_test": "tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk1_needs_a_production_path_not_a_test_harness",
        "native_required_for_closure": True,
        "not_proven_after_closure": "that the branch boots and the points are interactable (native run)",
    },
    {
        "blocker_id": "BLK-2",
        "title": "The Waystation cache cannot resolve its own reward: A0 sends the si: instance id, A0's vendored catalog still holds the alias",
        "owner": "A0 (re-vendor) with A3 (canonical id)",
        "evidence_class": EVIDENCE_CLASS["BLK-2"],
        "fix_state": "SOURCE_PRESENT_UNRESOLVED",
        "player_impact": (
            "A0 9269739e's host sends {poi_crown_waystation, cache_restock, "
            "si:r_ashen_crown:waystation_cache:01}. Its own lookup is exact string equality over those three "
            "fields, and the catalog it ships still says node_waystation_cache, because A0 vendors a pre-V4 copy "
            "of A3 (b1d291d0) while A3 c5e80922 is 622a277f. The result is deterministic: the first useful "
            "reward in the game fails with unknown_source_instance, and the only test that ever 'paid' 3 scrap + "
            "2 spares used the alias directly, so it never touched the host path."
        ),
        "verified_by": (
            "oracle.instance_identity: the shipped host's POINTS table replayed against the catalog A0 actually "
            "loads, with A3's canonical table alongside; plus Q-03 mirror drift naming the same three rows"
        ),
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/oracle.json'))"
            "['instance_identity'];print(d['verdict']);[print(x['point'],x['instance_id']) for x in "
            "d['unresolved_host_requests']]\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/oracle.json'))"
            "['instance_identity'];print('fixture ids absent from host:', d['fixture_ids_absent_from_host'])\"",
        ],
        "owner_commands": [
            "# A0: the reward path, replayed without Godot (the runtime does the same string comparison)",
            "python3 tools/survival/balance/run_analysis.py",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/oracle.json'))"
            "['instance_identity'];print(d['a3_only_bindings'])\"",
            "# then the native check that should now pay. Godot has no CLI switch for a",
            "# project setting, so either ship the key in project.godot or run A7's probe",
            "# with --force-branch (in-memory, classed SOURCE_PRESENT_BEHIND_GUARD):",
            "xvfb-run -a godot --path . --script res://tests/survival/balance_native/first_hour_route_probe.gd -- --force-branch",
        ],
        "minimal_safe_correction": (
            "A0 re-vendors A3 c5e80922's world_source_bindings.v3.json byte-for-byte (three bindings, si ids, "
            "instance_id + interaction_node_id + identity), and changes its authority test to send the host's "
            "request instead of the alias. No quantity, cooldown or price changes."
        ),
        "closure_probe": "oracle.instance_identity is IDENTITY_CONSISTENT and no host request is unresolved",
        "closure_test": "tests/survival/balance/test_oracle.py::InstanceIdentityOracleTests::test_the_alias_cannot_stand_in_for_the_world_instance",
        "native_required_for_closure": False,
        "not_proven_after_closure": "that the transaction commits durably (BLK-4)",
    },
    {
        "blocker_id": "BLK-3",
        "title": "A8's 15 invented Vector2.from_array calls are fixed in source, and still unproven natively",
        "owner": "A8",
        "evidence_class": EVIDENCE_CLASS["BLK-3"],
        "fix_state": "SOURCE_FIXED_PENDING_NATIVE",
        "player_impact": (
            "At the previous pin the native POI scenes read every position through Vector2.from_array, which no "
            "Godot release exposes. A8 c8b4bc88 replaced them with native_poi_vectors.gd and the audited call "
            "count is now zero. That is a real fix and it is not a native pass: A8's contract step has never "
            "been green on this sha, and the last failing log died at a preload of poi_authority_fixture.gd."
        ),
        "verified_by": (
            "oracle.engine_api over the pinned c8b4bc88 sources (0 unknown calls) plus the recorded CI outcomes "
            "for a8-world-content-native.yml on this sha (none green)"
        ),
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/oracle.json'))"
            "['engine_api'];print(d['verdict'], d['unknown_call_count'], d['static_call_count'])\"",
            "git grep -n 'from_array' refs/a8 -- '*.gd' | head",
        ],
        "owner_commands": [
            "# A8: the fix exists; these two native steps are what would close it",
            "godot --headless --path . --script tests/survival/world_content/native_poi_contract_test.gd",
            "godot --headless --path . --script tests/survival/world_content/native_poi_transition_test.gd",
        ],
        "minimal_safe_correction": (
            "A8 lands those two native steps green on a pushed sha and uploads the artifact. No code change is "
            "implied by this blocker any more."
        ),
        "closure_probe": "a8_native_poi_contract is VERIFIED on the pinned sha",
        "closure_test": "tests/survival/balance/test_oracle.py::EngineApiOracleTests::test_a8_call_sites_disappear_after_the_conversion",
        "native_required_for_closure": True,
        "not_proven_after_closure": "that the scenes are reachable in A0's world (BLK-1)",
    },
    {
        "blocker_id": "BLK-4",
        "title": "No native proof anywhere on the current sha: the only paid receipt is a fixture that bypasses the host",
        "owner": "A0",
        "evidence_class": EVIDENCE_CLASS["BLK-4"],
        "fix_state": "RUNTIME_UNKNOWN",
        "player_impact": (
            "Every required native assertion resolves STALE_HEAD at this pin: entry, second process, real input, "
            "save precision and negative replay. S4 is 0 of 5 clauses. The one run that has ever paid the cache "
            "reward funds its own inventory, advances its own clock and sends an instance id the shipped host "
            "never sends, so it proves the transaction helper and nothing about a player."
        ),
        "verified_by": "evidence.s4_clauses over the recorded runs plus oracle.instance_identity's fixture check",
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print({k:v['state'] for k,v in d['native_states'].items()})\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/gate.json'));"
            "print(d['s4']['s4_granted'], {k:v['state'] for k,v in d['s4']['clauses'].items()})\"",
        ],
        "owner_commands": [
            "# A0: one ordinary-input run on the sha, then the separate-process half",
            "xvfb-run -a godot --path . --user-data-dir artifacts/ud_entry --resolution 1280x720 \\",
            "  --script res://tests/survival_normal_entry_home_restart_test.gd",
            "xvfb-run -a godot --path . --user-data-dir artifacts/ud_entry --resolution 1280x720 \\",
            "  --script res://tests/survival_normal_entry_home_restart_test.gd -- --verify-separate-process",
        ],
        "minimal_safe_correction": (
            "A0 runs the two halves on the pinned sha and cites the green runs. Nothing else in A7's scope can "
            "move this: S4 is owner-native evidence only."
        ),
        "closure_probe": "gate s4_granted is true: all five clauses hold on the pinned sha",
        "closure_test": "tests/survival/balance/test_integration_gate.py::GateClosureTests::test_blk4_needs_all_five_s4_clauses",
        "native_required_for_closure": True,
        "not_proven_after_closure": "that a human finds the route and enjoys it (S5)",
    },
    {
        "blocker_id": "BLK-5",
        "title": "The player body is still the Knight; the D051 bald male/female art is still not imported",
        "owner": "A6 (import + adapter) with A0 (mount)",
        "evidence_class": EVIDENCE_CLASS["BLK-5"],
        "fix_state": "SOURCE_ABSENT",
        "player_impact": (
            "chapter1_overworld.gd still preloads game/characters/knight/knight.tscn and instantiates it as the "
            "player. A6 08ccb834 added a sprite pipeline, but its manifest still declares BASE_ART_NOT_IMPORTED "
            "with grade-0 idle_sheet empty for both 555940 and 419402, so there is nothing to mount. A player "
            "would control a Knight in a game whose locked identity is a bald human adventurer. A second A6 "
            "item rides along: acceptance_journeys.gd:241 and :340 hand fixture vocabulary to a Label, so "
            "mounting that viewer as-is would put 'READ-ONLY SCENARIO FIXTURE' on screen (PROD-04 WARN today; "
            "it becomes FAIL the moment the viewer is mounted)."
        ),
        "verified_by": "quality Q-04 over the pinned tree (mounted scene identity, claimed sheets, adapter fallback)",
        "reproduce": [
            "python3 -c \"import json;d=json.load(open('data/survival/balance/results/quality.json'));"
            "print([c for c in d['checks'] if c['check_id']=='Q-04'][0]['status'])\"",
            "python3 -c \"import json;d=json.load(open('data/survival/balance/snapshot/product/a6.avatar_art_manifest.json'));"
            "print(d['status']);print({g:c['armor_grades']['0']['idle_sheet'] for g,c in d['characters'].items()})\"",
        ],
        "owner_commands": [
            "# A6 + A0: the acceptance is a rendered body, not a string",
            "godot --headless --path . --import",
            "godot --path . --resolution 1280x720",
            "# spawn from normal entry, then die, reload and respawn: the body must stay 555940/419402",
        ],
        "minimal_safe_correction": (
            "Two A6 edits, neither of which needs A0: import the grade-0 idle sheet for ONE gender from the "
            "authorised archive and point the manifest at the installed file; and drop the two fixture labels "
            "from acceptance_journeys.gd before that viewer is mounted. A0 then mounts the scene behind the "
            "existing avatar seam. Grades 1-2 stay SOURCE_BLOCKED; no Knight substitution."
        ),
        "closure_probe": "Q-04 PASS with the canonical body mounted and every claimed sheet present",
        "closure_test": "tests/survival/balance/test_quality.py::QualityClosureTests::test_blk5_closes_when_the_mounted_body_and_grade0_sheet_are_canonical",
        "native_required_for_closure": False,
        "not_proven_after_closure": "4-direction animation, armour swap and rendered frames (S5, human)",
    },
)

CLOSED: Sequence[Dict[str, object]] = (
    {
        "blocker_id": "BLK-ENGINE-API",
        "was": "A8's scenes call Vector2.from_array, which no Godot release exposes (15 sites)",
        "disposition": "CLOSED_IN_SOURCE_RECLASSIFIED_BLK-3",
        "closed_at": "A8 c8b4bc88",
        "why": (
            "A8 added native_poi_vectors.gd with from_pair/from_int_pair and replaced every call. The oracle now "
            "reports ENGINE_API_CONSISTENT with 0 unknown calls over the pinned sources. It is not a native pass, "
            "so the residual moved to BLK-3 as SOURCE_FIXED_PENDING_NATIVE."
        ),
        "evidence": {"engine_api": "ENGINE_API_CONSISTENT", "unknown_calls": 0, "historical_pin": "5ccf7b3f: 15"},
        "residual": "the native contract/transition steps have never been green on this sha.",
        "still_needs_owner": "A8 runs its own two native steps.",
    },
    {
        "blocker_id": "BLK-MIRROR",
        "was": "A0 shipped a stale copy of A3's source catalog (Q-03 drift)",
        "disposition": "REOPENED_AS_BLK-2",
        "closed_at": "A3 c5e80922",
        "why": (
            "Round 5 closed this at A3 100b3406 where both copies matched. A3's V4 canonicalised the instance id "
            "to si:*, so A0's copy drifted again in exactly the three waystation rows - and this time the drift "
            "breaks the interaction. Reopened as BLK-2 rather than logged as a repeated finding."
        ),
        "evidence": {"q03": "FAIL", "divergent": ["road_notes", "road_scrap", "road_supplies"], "identical_rows": 33},
        "residual": "until A0 re-vendors, the cache action cannot be authorized.",
        "still_needs_owner": "A0 re-vendors A3's catalog bytes.",
    },
)

CORRECTIONS: Sequence[Dict[str, object]] = (
    {
        "id": "CORR-9",
        "round4_claim": "BLK-2: A8 has 15 Vector2.from_array source errors and the scenes cannot position anything.",
        "status": "STALE AT THE PIN, FIXED AT THE LIVE HEAD",
        "what_is_actually_true": (
            "True of A8 5ccf7b3f, which round 5 pinned. A8 c8b4bc88 replaced all of them; the pinned sources now "
            "contain the string only inside a comment explaining why the constructor does not exist."
        ),
        "what_remains_true": "no native evidence exists for the fixed code, so nothing is S4.",
        "fix_in_this_round": "classified SOURCE_FIXED_PENDING_NATIVE by comparing the pin, not by re-running the old claim.",
    },
    {
        "id": "CORR-10",
        "round4_claim": "Claim C: the A1 cache and A8 site are in no world a player can reach (ABSENT).",
        "status": "WRONG AT THE LIVE HEAD, RIGHT AT THE OLD PIN",
        "what_is_actually_true": (
            "A0 9269739e mounts A1's real slice geometry and a five-point interaction host. The content is in "
            "production code. It is also behind a ProjectSettings key absent from project.godot, so the player "
            "still cannot reach it."
        ),
        "what_remains_true": "no normal-input journey reaches the cache today.",
        "fix_in_this_round": "claim C gained MOUNTED_BY_DEFAULT / SOURCE_PRESENT_BEHIND_DISABLED_FLAG / ABSENT.",
    },
    {
        "id": "CORR-11",
        "round4_claim": "The A1/A3 instance-id seam is closed: both ids are published for one object.",
        "status": "TRUE AS NAMING, FALSE AS RUNTIME",
        "what_is_actually_true": (
            "A3 publishes both, but only the si:* id is in the binding table, and A0's host sends the si:* id "
            "while A0's vendored table still keys the alias. Exact-string lookup therefore fails. The seam exists "
            "and does not connect."
        ),
        "what_remains_true": "no quantity, price or cooldown is wrong; this is identity, not balance.",
        "fix_in_this_round": "oracle.instance_identity replays the shipped request against the loaded catalog.",
    },
    {
        "id": "CORR-12",
        "round4_claim": "The A0 authority fixture proves an A3-authorized reward commits.",
        "status": "IT PROVES THE TRANSACTION HELPER, NOT THE ROUTE",
        "what_is_actually_true": (
            "The fixture hardcodes instance_id node_waystation_cache, an id the shipped host never sends, and "
            "funds its own inventory and clock. It cannot observe the mismatch it hides."
        ),
        "what_remains_true": "the A3 transaction machinery does commit and does refuse replays.",
        "fix_in_this_round": "the oracle compares fixture instance ids against the host's request set.",
    },
    {
        "id": "CORR-13",
        "round4_claim": (
            "PROD-04 can FAIL while the same payload records it as closed - 'a broad FAIL kept as a hygiene "
            "warning'."
        ),
        "status": "A CHECK CANNOT BE BOTH FAILING AND CLOSED, AND TWO OF ITS HITS WERE NOT TEXT AT ALL",
        "what_is_actually_true": (
            "Two defects, both in A7's own tooling. (1) 'schema' sat in the debug-vocabulary list, so a wire key "
            "(intent.get('schema'), 'schema': INTENT_SCHEMA) was counted as player prose. (2) Every string "
            "literal in an A6 file counted as player-visible, including logs and test summaries, so 107 hits "
            "hid the 2 that are actually handed to a Label. PROD-04 also mapped to the closed bucket, which "
            "silently dropped a red check."
        ),
        "what_remains_true": (
            "The two real hits are real: game/survival/ui/acceptance_journeys.gd:241 shows 'A6 READ-ONLY "
            "SCENARIO FIXTURE - NOT LIVE GAMEPLAY' on a Label, and :340 shows 'Fixture progress only ...'. They "
            "are latent, not live, because no shipped scene mounts A6's survival UI."
        ),
        "fix_in_this_round": (
            "PROD-04 now splits display-sink literals from unbound ones, reports FAIL only when the surface is "
            "mounted and WARN when it is latent, and maps to traceability rather than a closed bucket. 'schema' "
            "is off the token list."
        ),
    },
)

OPEN_CONDITIONS = {
    "BLK-1": "claim C is not MOUNTED_BY_DEFAULT, or the guard is not enabled by the shipped project",
    "BLK-2": "a host request does not resolve in the catalog A0 loads, or A0's catalog diverges from A3's",
    "BLK-3": "the pinned sources still contain an unknown engine static call, or no native run verifies A8",
    "BLK-4": "gate.s4 is not granted: at least one of the five native clauses does not hold on the pinned sha",
    "BLK-5": "quality Q-04 is not PASS for the canonical mounted body",
}


def _is_open(blocker_id: str, evidence: Dict[str, object]) -> bool:
    if blocker_id == "BLK-1":
        return str(evidence.get("mount_state")) != "MOUNTED_BY_DEFAULT"
    if blocker_id == "BLK-2":
        return str(evidence.get("identity_verdict")) != "IDENTITY_CONSISTENT" or bool(
            evidence.get("unresolved_host_requests")
        )
    if blocker_id == "BLK-3":
        return int(evidence.get("unknown_engine_calls") or 0) > 0 or str(
            evidence.get("a8_native_state")
        ) != "VERIFIED"
    if blocker_id == "BLK-4":
        return evidence.get("s4_granted") is not True
    if blocker_id == "BLK-5":
        return str(evidence.get("q04")) != "PASS"
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
    product_by_id = dict(checks_by_id)
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
    oracle_identity = oracle_payload.get("instance_identity") or {}
    a8_ledger = [
        row
        for row in (gate_payload.get("native_outcome_ledger") or [])
        if str(row.get("workflow")) == "a8-world-content-native.yml"
    ]
    evidence = {
        "BLK-1": {
            "mount_state": content.get("mount_state"),
            "guard": content.get("guard"),
            "production_instance_refs": content.get("a1_instance_references_in_a0_surface"),
            "production_a8_refs": content.get("a8_instance_references_in_a0_surface"),
            "non_production_refs_excluded": sorted((content.get("non_production_references") or {}).keys()),
            "claim_C": (gate_payload.get("entry_claims") or {}).get("C_content_is_mounted", {}).get("state"),
            "knowledge_gate": oracle_know.get("verdict"),
            "non_circular_spare_recipes": oracle_know.get("non_circular_spare_recipes"),
            "spare_loot_sources": sorted((oracle_know.get("spare_loot_sources") or {}).keys()),
            "claims_needed_for_first_station": oracle_know.get("claims_needed_for_first_station"),
        },
        "BLK-2": {
            "identity_verdict": oracle_identity.get("verdict"),
            "host_instance_ids": oracle_identity.get("host_instance_ids"),
            "unresolved_host_requests": oracle_identity.get("unresolved_host_requests"),
            "a3_only_bindings": oracle_identity.get("a3_only_bindings"),
            "divergent_bindings": [row.get("identity") for row in (oracle_identity.get("divergent_bindings") or [])],
            "fixture_ids_absent_from_host": oracle_identity.get("fixture_ids_absent_from_host"),
            "q03": (quality_by_id.get("Q-03") or {}).get("status"),
        },
        "BLK-3": {
            "unknown_engine_calls": oracle_api.get("unknown_call_count"),
            "static_calls_checked": oracle_api.get("static_call_count"),
            "audited_types": oracle_api.get("audited_types"),
            "a8_native_state": (native_states.get("a8_native_poi_contract") or {}).get("state"),
            "a8_completed_runs": [
                {"run_id": row.get("run_id"), "head_sha": row.get("head_sha"), "failed": row.get("failed_checks")}
                for row in a8_ledger
            ],
        },
        "BLK-4": {
            "static_seam_state": seam.get("static_state"),
            "mounted_caller_count": seam.get("mounted_caller_count"),
            "s4_granted": s4.get("s4_granted"),
            "s4_clauses": {k: v.get("state") for k, v in (s4.get("clauses") or {}).items()},
            "native_states": {k: v.get("state") for k, v in native_states.items()},
            "save_fidelity": oracle_fid.get("verdict"),
            "failing_native_labels": [
                {"run_id": row.get("run_id"), "head_sha": row.get("head_sha"), "failed": row.get("failed_checks")}
                for row in (gate_payload.get("native_outcome_ledger") or [])
                if row.get("failed_checks")
            ],
        },
        "BLK-5": {
            "q04": (quality_by_id.get("Q-04") or {}).get("status"),
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
        # A check can also fail for a blocker that no finding maps to (Q-03 maps to
        # BLK-2 by identity, not by a source_id finding), so carry the mapping too.
        merged["mapped_failing_checks"] = sorted(
            row_id
            for row_id in (
                list((quality_by_id or {}).keys()) + list((product_by_id or {}).keys())
            )
            if CHECK_TO_BLOCKER.get(row_id) == blocker_id
            and ((quality_by_id.get(row_id) or {}).get("status") == "FAIL"
                 or (product_by_id.get(row_id) or {}).get("status") == "FAIL")
        )
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
        # Named honestly: these are earlier A7 claims that are now closed, not
        # blockers that closed. A blocker that closes is counted below.
        "closed_earlier_claims": len(CLOSED),
        "closed_blockers": sum(1 for row in blockers if row["status"] == "CLOSED"),
        "corrections_recorded": len(CORRECTIONS),
        "traceability_only": sum(1 for row in triage if row["blocker_id"] == "NONE"),
        "closed_or_traceability": sum(1 for row in triage if row["blocker_id"] in ("NONE", "CLOSED-R4")),
    }
    payload: Dict[str, object] = {
        "schema": "soh.balance.blockers.v6",
        "read_this_first": (
            "Five player-facing blockers, each with one owner, one smallest safe correction and a test that "
            "flips FAIL to PASS. A blocker closes only when the source condition holds AND the native evidence "
            "it needs is VERIFIED on the pinned sha. Five earlier A7 claims are corrected rather than dropped, "
            "including two defects in A7's own tooling."
        ),
        "counts": counts,
        "blockers": blockers,
        "closed": list(CLOSED),
        "classes_not_used": list(CLASSES_NOT_USED),
        "corrections": list(CORRECTIONS),
        "triage": triage,
        "reduction": (
            f"{counts['raw_observations']} observations -> {counts['player_facing_blockers']} blockers "
            f"({counts['closed_earlier_claims']} earlier claims closed, {counts['corrections_recorded']} A7 self-corrections, "
            f"{counts['traceability_only']} observations traceability only)"
        ),
    }
    payload["markdown"] = as_markdown(payload)
    return payload


def as_markdown(payload: Dict[str, object]) -> str:
    lines: List[str] = []
    lines.append("# Player-facing blockers (A7, consolidated v6)\n")
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
