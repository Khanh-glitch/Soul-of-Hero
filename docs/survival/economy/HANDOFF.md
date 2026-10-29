# A3 Git/Docs Handoff — SURV-030A

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
- Reports: `docs/survival/economy/{validation_report,balance_report,reverse_index}.json`
- A1 mapping: `data/survival/items/a1_material_mapping.json`, `docs/survival/economy/A1_MATERIAL_MAPPING.md` (27 contracts: 7 existing, 8 proposed aliases, 12 explicit missing)

## Evidence
- Catalog audit: PASS (56 items, 36 recipes, 5 technologies, 36 sources, 7 stations; all contract-reachable; no production cycles).
- Python adversarial/balance/mapping/schema/growth tests: 10/10 PASS locally at hardening authoring time.
- Native Godot 4.7 SaveService adapter: hardening suite PASS at 17e0358b, 362 checks / 20 cases; push run 40878087266 and PR-side run 40878096753 both SUCCESS.
- Balance model: conservation invariants PASS; gameplay-design NOT_HUMAN_PLAYTESTED.
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

## Explicit non-claims
- No Gold VFX/effect changes, no production overworld edits, no SaveService edits, no human playtest PASS, no offline production.
