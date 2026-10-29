# A3 Owner-Ready Handoffs — Product Model V2

Status: **A3 CONTRACT PROPOSAL / SIMULATION_ONLY / WORLD_NOT_INTEGRATED / NOT_HUMAN_PLAYTESTED**  
Branch: `arena/7a12b27e-soul-of-hero`, PR #19. A1 source refreshed to PR #20 head `91a3544983ff2712e66fd77997df24f59efb3a44`.

## Evidence legend

- **CONFIRMED SOURCE**: read from A1 PR #20 or live SURV-010/A0 catalog; hash pinned in `progression_model.json`.
- **A1-AUTHORED PROPOSAL**: A1 authored action/route/material contract, not native-playtested.
- **A3-DESIGN PROPOSAL**: A3 balance/cost/timing/mitigation proposal; requires owner approval.
- **NATIVE TESTED**: A3 adapter fixture passes against real SaveService; not production world integration.
- **HUMAN PLAYTEST REQUIRED**: fun, pacing, fatigue, decision clarity, 14-day engagement.

## 1. A1 source reconciliation (A3 → A1)

Contract: `data/survival/items/a1_source_adoption.v2.json`.

- Adopted **source-specific** transformations only:
  - `src_crown_reed → reed_fibre` (river/lake reed morphs; not oasis/forest dry fibre).
  - `src_amber_herb → moonleaf` (conditional on real sink; verified sink `minor_salve` + filter lesson proposal).
- Rejected global aliases remain blocked: `frost_resin`, `venom_sac`, `peat`, `hardwood`, `bog_iron`, `glacial_iron`, `fibre`, `rare_herb`.
- Proposed **not catalogged**: `frost_resin`, `venom_sac`, `peat`, `bog_iron`, `glacial_iron`, `dry_fibre`, `karst_herb`, `hardwood`.
- Missing items remain explicit: copper, rubber_sap, limestone, honey, salt, pearl, silica_sand, storm_glass, obsidian, basalt, abyssal_pearl, aether_crystal. None are first-hour blocking.
- First hour reconciled to A1 authored sequence: **Refuge → Ashen Waystation → Crown Relay Shed → Refuge → Orchard Apothecary**. Safe approach `rt_crown_safe_approach` has zero exposure; east shortcut `rt_east_seam` requires `cap_filter`.
- Hazard access ≠ mitigation: `cap_filter`/`cap_thermal` are preparation/access grammar. A3 proposes a 0.6 mitigation fraction from A1 hazard contract, **not** full immunity and **not** `toxin_mask venom:60` coverage for heat/acid_gas/poison. Concrete gear/resistance values remain A3 extension pending.

**A1 asks:** approve/reject source-specific adoptions, missing-item catalog additions, specimen/catalyst POI bindings, and native POI action state/renewal. Do not silently alias.

## 2. A0 producer contract (A3 → A0)

Machine-readable: `A0_ECONOMY_PRODUCER_CONTRACT.v2.json`. Related: `A0_SAVE_SERVICE_GUARD_CONTRACT.md`, `A0_ACTIVE_TICK_HOST_CONTRACT.md`.

- SaveService remains sole inventory/transaction authority. A3 introduces no second save.
- Physical Core instance (`soh_i_*` token + attribute record) is distinct from permanent recipe knowledge. Research consumes the specimen atomically; manufacture creates a new finite instance.
- Uses/condition/equipment/readiness persist in A0; A3 validates before effect. Production casts remain `BLOCKED_PENDING_A4`.
- Station queue + authoritative active time use `soh.economy.active_tick.v1`; no offline catch-up; revision/power/removed stations pause and preserve escrow recovery.
- Research sacrifice requires explicit warning + atomic confirmation (`event_id`, `expected_revision`). UI flags never authorize consumption.
- Generic drop/transfer/merge/equip/container/reward paths must guard unique tokens or atomically couple attribute records.

**A0 asks:** implement positive guard tests, production station/time host, home placement, death/respawn, hazard damage application, and merged-branch native review.

## 3. A6 read-only consumer contract (A3 → A6)

Machine-readable: `A6_ECONOMY_READ_ONLY_CONTRACT.v2.json`.

- A6 consumes read-only snapshots: inventory, craftability, rejections, provenance, unlock state, Core decisions, station queue, time accounting.
- Every snapshot carries `revision`/`source_sha256`; mutation requests carry `expected_revision` and are revalidated by A3/A0.
- Craftability/readiness flags are previews, **not** transaction grants.
- Sacrifice UI must show: physical specimen consumed, permanent recipe unlock, replacement cost/catalyst/station/time, irreversible confirmation.
- Provenance labels visible in QA mode: CONFIRMED_SOURCE / A1_AUTHORED_PROPOSAL / A3_DESIGN_PROPOSAL / NATIVE_TESTED / HUMAN_PLAYTEST_REQUIRED / BLOCKED_PENDING_A4 / MISSING_A1_A3_ITEM.
- Time accounting UI must label unused budget as unused, not engagement; combat/decision time may be unmodeled.

**A6 asks:** wire read-only snapshots, stale-revision rejection, sacrifice confirmation flow, provenance labels, and human decision-clarity playtest. No UI path mutates SaveService or station time.

## 4. Time-accounting handoff (A3 → A0/A1/A6/human)

The 14×45-minute claim is a **SPARSE_SCENARIO_MODEL**, not proven engagement.

- Scheduled budget: 37,800 s. Active modeled: 23,323 s. Unused: 14,477 s. Station work: 1,002 s (overlaps active actions).
- Modeled categories: travel 7,167 s; exploration/interaction 13,830 s; gathering 1,201 s; crafting handling 162 s; research handling 17 s; construction 192 s; station wait 754 s.
- Combat duration and human read/plan/decide time are **0 s modeled / unmodeled**, not claimed as zero real time.
- Late sessions (11–14) model only 411 s active against 2,700 s budget; the remainder is explicitly unused, not padded.

**Required evidence:** A0 station queue + active-time receipts; A0/A1 native combat/retreat durations; A1 POI traversal/puzzle timings; A3/A0 gather cooldown/yield observation; A6 human decision/inventory friction; human 45-minute session observation.

## 5. Decision-consequence handoff (A3 → A4/A6/human)

- USE: loadout allocation only; `native_casts_executed=0`; no verified Gold effect/risk reduction.
- STORE: preserves physical instance/optionality; opportunity cost and carry/storage risk.
- SACRIFICE: consumes specimen, grants permanent recipe; replacement requires catalyst/reagents/station/time.
- Fair USE vs SACRIFICE comparison is **not yet fair**. Missing: A4-verified USE effect/uses/condition/risk delta; atomic sacrifice confirmation; manufacture cost/catalyst availability; time-to-replacement; encounter outcomes with/without USE; human valuation.
- Adversity scenarios: early loss, targeted fallback (6 spares + 2 notes, no free Core), blocked safe route, catalyst drought, queue interruption, limited playtime. No invisible protection or free rewards.

## 6. Current evidence

- Python: **30 tests PASS** (10 preserved hardening/catalog + 11 V1 progression + 9 V2 regressions).
- Native adapter: **362 checks / 20 cases PASS** (unchanged; fixture host, not production world).
- Immutable conservation fixture: `balance_report.json` SHA-256 `45bceb2d6f9e190c9fd89b540cc11d088d98ebb6efcef36bb0f977cadc437e71` unchanged.
- Product model: `progression_report.json` regenerated; baseline Ember discovery s3, Frost s5, sacrifice s8, manufacture s9; 0 native casts; 5 remaining late goals.
- CI: pending final V2 code SHA; prior checkpoint `08711ea7` was CI-green.

**NEXT_ATOMIC_ACTION:** Control Tower / A0 / A1 / A6 review of the V2 adoption + producer/consumer contracts; do not merge PR #19 or claim balance/human approval from simulation alone.
