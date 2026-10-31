# CT ROUND11 P1 — WP4: Quarry / Orchard / Mill source-economy decisions

Status: A3-owned binding decisions. All three POIs are
**REJECTED_PENDING_EVIDENCE_FAIL_CLOSED**. Approve bounded rewards/costs ONLY
where actual source identity / sinks / risk / cooldown evidence justifies;
otherwise explicit FAIL_CLOSED. No A8 Quarry authorization is invented; no
fixture amount is promoted to live.

## Source evidence (fetched from A8 PR #26 head `3a7ab461`, GitHub raw;
not in this clone)

### south_quarry.json — `poi_crown_south_quarry` [30, 280], worksite
- action_socket [506, 302], approach [506, 378]
- choices: `brace_east_shelf`, `chock_west_ramp`, `leave_seam_unworked`
- action `extract_outcrop` requires `east_braced` + `west_chocked`
- All Quarry cost / yield / cooldown fields: **null**
- Evidence: `quarry_economics_evidence.v2.json` =
  `EVIDENCE_CANDIDATE_NO_AUTHORIZATION`; fixture values
  (2 oak / 2 stone / 2 stone per 45s) are `TEST_ONLY_FAKE_VALUES_NOT_LIVE`,
  never in `soh.native_poi.intent.v2`; `decision_request_to_a3` pending A3
  authorization SHA + A0 durable-instance evidence
- Native result: `world_action(poi_crown_south_quarry, ...)` →
  `unknown_world_poi`; caller-priced request fields →
  `invalid_world_request_field`; no read-only economy projection (adapter
  test case 25)
- Verdict: **REJECTED_PENDING_EVIDENCE_FAIL_CLOSED** — all actions
  `REJECT_PENDING_EVIDENCE`, `authorized_cost_quantity` /
  `authorized_reward_quantity` / `authorized_replenishment_seconds` null

### south_orchard_ruin.json — `poi_crown_south_orchard_ruin` [140, 360], cultivation
(POI prioritized for one early ordinary source decision)
- choices: `clear_irrigation`, `leave_for_safety`
- actions: `gather_reeds` + `read_water_marks`, `owner_ready_required`
- blocked_rewards: `honey`, `rare_herb` (Core-adjacent rewards forbidden
  without A4 attestation and source authorization)
- Existing A3 item `reed_fibre` (source_ids: `live_reed_fibre`,
  acquisition_status: LIVE) is a genuine, already-available ordinary material.
- No cost / yield / cooldown / authorization evidence in A3 data for
  Orchard → reeds. No stand cells, no interaction node, no depletion logic,
  no anti-repeat recorded for `gather_reeds` at this POI.
- Native result: `unknown_world_poi` (no binding in
  `data/survival/items/world_source_bindings.v3.json`); no projection
- Verdict: **REJECTED_PENDING_EVIDENCE_FAIL_CLOSED** pending A8/A1 evidence
  (see handoff below). Do NOT approve `reed_fibre` yield/cooldown from
  fixture values.

### south_crown_mill.json — `poi_crown_south_crown_mill` [120, 300], salvage_mill
- access requires `cap_salvage` (Waystation locker capability, earned
  in-run — not a cross-run grant)
- choices: `repair_waterwheel`, `leave_wheel`
- actions `observe_race`, `recover_fastener` require `cap_salvage` +
  `mill_wheel turning`
- gates: `outer_access`, `maintenance_walk`, `retreat_one_way`
- No cost / yield / cooldown / authorization evidence in A3 data
- Native result: `unknown_world_poi`; no projection
- Verdict: **REJECTED_PENDING_EVIDENCE_FAIL_CLOSED**

## Enforcement in A3 code (native tested)

- `data/survival/items/world_source_bindings.v3.json` contains exactly 5
  bindings, all at `poi_crown_waystation`. Zero Quarry / Orchard / Mill
  bindings → `world_action` returns `unknown_world_poi` for those POIs.
- `world_action` rejects caller-injected `cost_quantity` /
  `reward_quantity` / `ready` / `rewards` fields with
  `invalid_world_request_field` — UI flags never authorize.
- Python oracle `tools/survival/economy/world_binding_contract.py`
  (`validate`) fails on any Quarry/Orchard/Mill world_action, canonical
  yield/cooldown drift, Core rewards, missing source backlinks, random loot
  tables and alias collisions (tests:
  `test_a8_quarry_is_fail_closed_not_guess_priced`, negative oracles;
  adapter case 27 covers Orchard + Mill).

## R5 gate impact

A8 current native input journey: CODE_RUNTIME / TEST_ORACLE /
SYSTEM_VALUE / INTEGRATION **FAIL** (Quarry/Orchard/Mill have no authorized
source identity). A3 keeps all three FAIL_CLOSED until A8 produces actual
source identity + A0 durable-instance evidence + A3 authorization SHA, and the
product gate approves bounded costs/yields/cooldowns per source.

## What would be needed to approve (not granted here)

Per POI, A8 + A1 must provide:
1. Source identity record: source class / region / poi / instance_id /
   interaction_node_id / stand cells.
2. Authorized cost items + quantities (real A3 catalog items, paid at
   commit time inside A0 `SaveService.transact_once`).
3. Authorized reward items + quantities (existing A3 catalog only; no
   Core/rare/honey/rare_herb without A4).
4. Replenishment cooldown in ACTIVE seconds (not wall clock) + depletion
   logic + max claims per run.
5. Sink justification: what the reward is used for, why the POI is worth
   visiting before Ragnarok, anti-farming / repeatability limits.
6. A3 authorization SHA binding the above to a versioned A3 policy.

Until all six are provided: no binding, no projection, no reward, no cost
accepted from request fields. Orchard remains the priority candidate because
`reed_fibre` is an existing live A3 material with a genuine early-game use
(binding_cloth → tool repair), but no yield/cooldown may be set from fixture
values.

## A8 / A1 handoff (Orchard reed_fibre candidate)

A3 owns: versioned policy shape (cost/yield/cooldown/max_claims/stand cells),
negative test vectors (unknown POI, caller-priced fields, replay, full bag,
interrupted write), and the binding oracle.

A8 must provide: physical Orchard scene with `gather_reeds` interaction node,
stand cells at poi [140, 360], durable source state (generation/opened/
depleted/phase), and confirmation that `reed_fibre` is the intended yield.

A1 must provide: source identity registration (class/region/poi/instance),
stand-cell authorization, and placement confirmation that the Orchard is
reachable before Ragnarok for a knife-only adventurer.

A0 must perform: the actual `SaveService.transact_once` commit for any
reed harvest (cost payment + yield grant + receipt in one candidate), and the
production mount of the Orchard POI binding. A3 does not mount production.

A7 must independently falsify: replay, forged source, out-of-range stand,
full bag, interrupted write, and cross-run receipt rejection.