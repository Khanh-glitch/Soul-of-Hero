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
- choices: `clear_irrigation`, `leave_for_safety`
- actions `gather_reeds` + `read_water_marks`, `owner_ready_required`
- blocked_rewards: `honey`, `rare_herb` (Core-adjacent rewards forbidden
  without A4 attestation and source authorization)
- No cost / yield / cooldown / authorization evidence in A3 data
- Native result: `unknown_world_poi` (no binding in
  `data/survival/items/world_source_bindings.v3.json`); no projection
- Verdict: **REJECTED_PENDING_EVIDENCE_FAIL_CLOSED**

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
  (`validate`) fails on any Quarry world_action, canonical yield/cooldown
  drift, Core rewards, missing source backlinks, random loot tables and alias
  collisions (tests: `test_a8_quarry_is_fail_closed_not_guess_priced`,
  negative oracles).

## R5 gate impact

A8 current native input journey: CODE_RUNTIME / TEST_ORACLE /
SYSTEM_VALUE / INTEGRATION **FAIL** (Quarry/Orchard/Mill have no authorized
source identity). A3 keeps all three FAIL_CLOSED until A8 produces actual
source identity + A0 durable-instance evidence + A3 authorization SHA, and the
product gate approves bounded costs/yields/cooldowns per source.

## What would be needed to approve (not granted here)

Per POI: A8 source identity record (class/region/poi/instance), authorized
cost items + quantities, authorized reward items + quantities, replenishment
cooldown in ACTIVE seconds (not wall clock), stand cells, interaction node,
sink justification, risk/cooldown evidence, and A3 authorization SHA. Until
then: no binding, no projection, no reward, no cost accepted from request
fields.