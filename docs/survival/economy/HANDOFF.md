# A3 Git/Docs Handoff — SURV-030A

> **V3 update:** source-authoritative A1 world loot + complete source→research→output chain. See `WORLD_SOURCE_HANDOFF_V3.md` for the exact A0 mount step, canonical locker/cache/relay contracts, host receipt schema and pinned external reuse. Native cases 21–23 and Python binding oracles added; production world integration remains A0-pending.

- Issue: #13
- PR: https://github.com/Khanh-glitch/Soul-of-Hero/pull/19
- Head: `arena/7a12b27e-soul-of-hero`; hardening code SHA `17e0358bf388680312789caecc7d26f3779aafb1` (final docs handoff SHA recorded in PR #19)
- Base: `feature/survival-rpg-foundation-20261029`
- Google Docs tab 04: synced via connector after hardening CI (see tab 04 entry)

## Delivered
- Catalogs/schemas: `data/survival/items/`, `data/survival/recipes/`
- Adapter: `game/survival/economy/economy_service.gd`
- Validation/simulation: `tools/survival/economy/`
- Tests: `tests/survival/catalog/`
- CI: `.github/workflows/survival-a3-economy.yml`
- Reports: `docs/survival/economy/{validation_report,balance_report,reverse_index,save_growth_report,progression_report}.json`
- Product progression model: `tools/survival/economy/model_progression.py`, `data/survival/recipes/progression_model.json`, `docs/survival/economy/PRODUCT_PROGRESSION_AUDIT.md`
- A1 mapping: `data/survival/items/a1_material_mapping.json`, `docs/survival/economy/A1_MATERIAL_MAPPING.md` (27 contracts: 7 existing, 8 proposed aliases, 12 explicit missing)

## Evidence
- Catalog audit: PASS (56 items, 36 recipes, 5 technologies, 36 sources, 7 stations; all contract-reachable; no production cycles).
- Python adversarial/balance/mapping/schema/growth tests: 10/10 PASS locally at hardening authoring time.
- Native Godot 4.7 SaveService adapter: hardening suite PASS at 17e0358b, 362 checks / 20 cases; push run 40878087266 and PR-side run 40878096753 both SUCCESS.
- Balance model: conservation invariants PASS; gameplay-design NOT_HUMAN_PLAYTESTED. The 156-specimen baseline is preserved as a technical fixture.
- Product progression model: separate SIMULATION_ONLY SOH proposal; baseline Ember discovery session 3, Frost session 5, Ember sacrifice session 8, manufacture session 9; 5 late goals remain. Code SHA 9b6b7771; push CI 40887990965 and PR-side CI 40888010777 SUCCESS; Python 21 tests PASS; native hardening remains 362 checks / 20 cases.
- Save-growth serialization model: schema-2 compaction saves ~409 KB in the 14-session model and ~14.6 MB at 100k receipts versus legacy duplicate commands; A0 receipt/terminal-instance retention still pending.

## Hardening status
See `HARDENING_STATUS.md`: E-01/E-02/E-03/E-04 PARTIAL with explicit A0/A4/A1 gates; E-05 DONE_A3_SCOPED. Overall NATIVE_FIXTURE_PASS / WORLD_NOT_INTEGRATED. PR #19 remains OPEN / NOT APPROVED FOR MERGE.

## Hardening contracts
- `A0_SAVE_SERVICE_GUARD_CONTRACT.md`: exact generic drop/transfer/merge/equip/container/reward guard request. A3 native negatives demonstrate the current A0 blocker; A3 does not claim to protect SaveService APIs it does not own.
- `A0_ACTIVE_TICK_HOST_CONTRACT.md`: `soh.economy.active_tick.v1`, injected trusted host, no caller ticks, no offline catch-up, pause/rebaseline semantics.
- `A4_SKILL_ATTESTATION_CONTRACT.md`: `soh.economy.skill_attestation.v1`, strict source/version/context/cast binding. Production Cores remain BLOCKED_PENDING_A4.
- `SAVE_GROWTH_AND_RETENTION.md`: measured serialization model, native micro-measure, and A0 retention obligations.

## Next owner actions
1. A0: review `migration_map.json` and `A0_SAVE_SERVICE_GUARD_CONTRACT.md`; add unique-token routing/refusal for generic drop/transfer/merge; station resolver/power/condition/removal guards; authoritative active-tick host; preserve `survival_economy` namespace.
2. A1: review `a1_material_mapping.json` proposed aliases and 12 explicit missing items; bind `CONTRACT_NOT_SPAWNED` nodes/POIs to native spawning/replenishment; confirm roadside vs sealed-archive pacing.
3. A4: provide verified abstract skill attestation for `soh.core.*`; until then Core cast remains fail-closed.
4. A6: consume read-only catalogs after A0/A1 contract freeze.
5. Independent reviewer: audit transaction atomicity, unique ownership, salvage/reconstruction conservation, and replay binding.
6. Design/playtest: measure knowledge-spare pressure, Core manufacture pacing, and exploration catalyst demand in the integrated world before any gameplay PASS.
7. A1/Control Tower: review provisional product-model POI/source bindings (`early_roadside_salvage`, specimen vaults, catalyst vault) and keep frost_resin/venom_sac/peat unapproved until explicit source/sink decisions.

## Product model V2 (A1 source reconciliation / sparse time / owner handoffs)
- A1 refreshed to PR #20 head `91a3544983ff2712e66fd77997df24f59efb3a44`; adoption contract `data/survival/items/a1_source_adoption.v2.json` adopts only `src_crown_reed→reed_fibre` and `src_amber_herb→moonleaf`; 8 global aliases remain rejected; 8 proposed additions and 12 missing items stay explicit.
- First hour reconciled to A1: Refuge → Ashen Waystation → Crown Relay Shed → Refuge → Orchard Apothecary; safe approach zero exposure; east shortcut requires `cap_filter`; unprepared rush is `shortcut_locked`.
- 14×45-minute claim audited as **SPARSE_SCENARIO_MODEL**: active 23,323 s / budget 37,800 s; unused 14,477 s; station work 1,002 s overlaps; combat/decision time unmodeled. No padding.
- 15 scenarios incl. early loss + targeted fallback, blocked safe route, catalyst drought, queue interruption. Native casts remain 0.
- Owner contracts: `A0_ECONOMY_PRODUCER_CONTRACT.v2.json`, `A6_ECONOMY_READ_ONLY_CONTRACT.v2.json`, `OWNER_HANDOFFS_V2.md`. UI flags never authorize transactions.
- Python **30 tests PASS** (10 preserved + 11 V1 + 9 V2); one V1 assertion updated to A1 shortcut-lock truth. Native adapter unchanged **362 checks / 20 cases**. Immutable conservation fixture unchanged.
- V2 code SHA `211349c986aa2f0e5b4b4a94eab8b183ea663ea9`; push CI 40900020970 (contracts 123539426272 / native 123540371824) and PR-side CI 40900036492 (contracts 123539480449 / native 123539788855) both SUCCESS; native annotation 362 checks / 20 cases.

## Explicit non-claims
- No Gold VFX/effect changes, no production overworld edits, no SaveService edits, no human playtest PASS, no offline production.
