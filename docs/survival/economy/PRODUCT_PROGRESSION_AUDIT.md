# A3 Product-Facing Economy Progression / Balance Audit

Status: **SIMULATION_ONLY_SOH_DESIGN_PROPOSAL / NOT_HUMAN_PLAYTESTED / WORLD_NOT_INTEGRATED**  
PR: #19, branch `arena/7a12b27e-soul-of-hero`. Starting head `86dc21954fd0a1a4aa9f98b6ec7d1e6782cc800e`; hardening code `17e0358bf388680312789caecc7d26f3779aafb1` preserved.

## 1. Why this is separate from the technical conservation fixture

`tools/survival/economy/simulate_economy.py` and `docs/survival/economy/balance_report.json` remain unchanged. Their 14-session baseline claims every eligible source on a timer and produces **156 found Core specimens, 0 manufactured Cores, 0 finite-cast uses created**. That is useful for accounting conservation and save-growth stress; it is **not** a realistic player journey and is not relabeled as one.

The new model is `tools/survival/economy/model_progression.py` with scenario data in `data/survival/recipes/progression_model.json` and report `docs/survival/economy/progression_report.json`. It models a fresh-player agenda, finite bag/home storage, A1 candidate route polylines/hazards, one-time specimen vaults, active-session station queues, and explicit USE/STORE/SACRIFICE decisions. It does **not** execute Gold casts, edit SaveService, or approve A1 aliases.

Preserved fixture SHA-256:
- `simulate_economy.py`: `1528ec792d690b998f9d1b40fd1a5a8ec6e7469ebdd32e06d4741eaacb6c106f`
- `balance_report.json`: `45bceb2d6f9e190c9fd89b540cc11d088d98ebb6efcef36bb0f977cadc437e71`

## 2. Source and provenance boundary

- Original Atlas SHA-256: `b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157`.
- A1 PR #20 candidate commit: `da93be3c252b683d9b8b4c1cad9d067934fbaf05`. Read-only file hashes: `world_plan.v1.json` `008d415f015610d1bb2ca6a940fc5e2974abe19406904e53ffb0ae7c9a89f46d`, `poi_route_graph.json` `a83b2118a7795f2892a244ebdc5e934de2fb89eb485d859758f55f278710026d`, `material_source_contracts.json` `43abb123b8a94a4ec42827416aa5875c6165b43959a39fd48ddddb8233f54a51`, `hazard_capability_contracts.json` `a18d6ea63a5e1bbc865b3d13faa9b808dc94a06107c2034839c05af9e2c7b639`, `pacing_analysis.json` `bc2ea1b5d0629716aa53ce2bba4095ecc2ae0443077ccda6391f1fe3f4b957e5`.
- A0 build catalog SHA-256: `42c64cf7f37b2e6fdfa1d6d19c71f2bcd9455a42e8e8033241e663d2ece66974`. Shelter cost is derived from actual A0 piece costs: 4 foundations + 11 walls + 1 door + 1 chest = **36 oak_wood + 2 iron_scrap**.
- Atlas behavioral anchors: DEP-01 roadside salvage → spares → research; DEP-02 use-now vs reverse-engineer; DEP-03 green/blue/purple access; DEP-04 credential vs power; DEP-05 hazard preparation; DEP-07 home/storage; DEP-15 garden/prep; DEP-18 death marker; DEP-19 station queues. Numeric pacing/drop chances below are **SOH proposals**, not original 2019 percentages.

## 3. Model rules and explicit proposals

- Finite inventory: 30 bag slots; stack limit from A3 items; unique Core/equipment tokens occupy one slot. Home storage starts with one 12-slot chest; extra chests cost A0 `chest_wood` and are built when full.
- Active production: 1 active tick = 1 second is a **SOH proposal**. Station queue capacities come from `stations.json`. Jobs progress only during active session time; no offline catch-up. Collected outputs free queue slots.
- Low-risk bootstrap: live SURV-010 wood/stone/scrap/reed plus a **provisional safe legacy-inset roadside cache** (`early_roadside_salvage`) bootstrap knowledge_spares before research_kit. This is explicitly not A1-approved; it addresses the A1-P2 crown heat/rot vs filter circularity.
- Route choice: safe southern Amberwood Apothecary first-visit grants `cap_filter` before the exposed eastern crown buffer. Rushing `poi_crown_waystation` unprepared aborts on hazard exposure in the model; native damage/retreat is still A0/A1 pending.
- Capability grants: early sheltered bootstrap caps are allowed as A1 first-visit grants. Late caps (`cap_boat`, `cap_tide_ward`, `cap_seal_3`, `cap_deepward`, `cap_stormward`) are blocked while their A1 materials are missing/unresolved. The model does not convert `frost_resin`, `venom_sac`, or `peat` into A3 items.
- Rarity: Ember/Frost/Venom specimens are **one-time authored POI discoveries**, not repeatable timer loot. Roadside loot contains no Cores or exploration-only catalysts. `ancient_catalyst` is a one-time vault proposal with 70% discovery chance, not a historical drop rate.
- Core choice: USE is a loadout allocation only (`native_casts_executed=0`, no verified tactical effect/risk reduction). STORE keeps the physical specimen. SACRIFICE consumes the specimen through research and grants permanent recipe knowledge. Manufacture requires learned recipe, advanced workbench, charged_blank, catalyst and family reagents.

## 4. Baseline 14 × 45-minute journey

First milestones: home session 2; Ember discovery session 3; Frost discovery session 5; Core Binding tech session 4; Ember specimen sacrifice session 8; Ember manufacture session 9. Manufactured Ember creates **8 finite uses in the model**, but **0 native Gold casts are executed**.

Key inventory columns: spares / notes / catalyst / ingots / bone / soul ember / reaper essence / charcoal / cloth. Full per-session home/bag inventories are in `progression_report.json`.

| Session | Active s | Stations | Capabilities | Key inventory | Cores | Found total |
|---:|---:|---|---|---|---|---:|
| 1 | 2686 | hand | — | 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 | — | 0 |
| 2 | 2700 | furnace, hand, workbench | cap_salvage | 4 / 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 | — | 0 |
| 3 | 2687 | furnace, hand, research, workbench | cap_filter, cap_power_1, cap_salvage, cap_seal_1, cap_seal_2 | 3 / 3 / 0 / 3 / 27 / 17 / 2 / 6 / 4 | core_ember:specimen_ember/stored | 1 |
| 4 | 2700 | furnace, hand, research, workbench | cap_climb, cap_filter, cap_power_1, cap_salvage, cap_seal_1, cap_seal_2, cap_thermal | 2 / 1 / 0 / 4 / 20 / 12 / 2 / 9 / 6 | core_ember:specimen_ember/stored | 1 |
| 5 | 2698 | furnace, hand, research, workbench | cap_climb, cap_filter, cap_power_1, cap_salvage, cap_seal_1, cap_seal_2, cap_thermal | 5 / 0 / 0 / 7 / 16 / 11 / 2 / 9 / 6 | core_ember:specimen_ember/stored, core_frost:specimen_frost/stored | 2 |
| 6 | 2700 | advanced_workbench, furnace, hand, research, workbench | cap_climb, cap_filter, cap_power_1, cap_salvage, cap_seal_1, cap_seal_2, cap_thermal | 2 / 1 / 1 / 12 / 16 / 11 / 2 / 4 / 6 | core_ember:specimen_ember/stored, core_frost:specimen_frost/stored | 2 |
| 7 | 2051 | advanced_workbench, furnace, hand, research, workbench | cap_climb, cap_filter, cap_power_1, cap_salvage, cap_seal_1, cap_seal_2, cap_thermal | 4 / 3 / 1 / 12 / 16 / 11 / 2 / 4 / 6 | core_ember:specimen_ember/stored, core_frost:specimen_frost/stored | 2 |
| 8 | 944 | advanced_workbench, furnace, hand, research, workbench | cap_climb, cap_filter, cap_power_1, cap_salvage, cap_seal_1, cap_seal_2, cap_thermal | 0 / 4 / 1 / 12 / 16 / 11 / 2 / 4 / 6 | core_ember:specimen_ember/sacrificed, core_frost:specimen_frost/stored | 2 |
| 9 | 627 | advanced_workbench, furnace, hand, research, workbench | cap_climb, cap_filter, cap_power_1, cap_salvage, cap_seal_1, cap_seal_2, cap_thermal | 1 / 5 / 0 / 10 / 14 / 8 / 1 / 3 / 5 | core_ember:specimen_ember/sacrificed, core_frost:specimen_frost/stored, core_ember:craft/field_use_candidate | 2 |
| 10 | 561 | advanced_workbench, furnace, hand, research, workbench | cap_climb, cap_filter, cap_power_1, cap_salvage, cap_seal_1, cap_seal_2, cap_thermal | 9 / 5 / 0 / 10 / 14 / 8 / 1 / 3 / 5 | core_ember:specimen_ember/sacrificed, core_frost:specimen_frost/stored, core_ember:craft/field_use_candidate | 2 |
| 11 | 561 | advanced_workbench, furnace, hand, research, workbench | cap_climb, cap_filter, cap_power_1, cap_salvage, cap_seal_1, cap_seal_2, cap_thermal | 9 / 7 / 0 / 10 / 14 / 8 / 1 / 3 / 5 | core_ember:specimen_ember/sacrificed, core_frost:specimen_frost/stored, core_ember:craft/field_use_candidate | 2 |
| 12 | 561 | advanced_workbench, furnace, hand, research, workbench | cap_climb, cap_filter, cap_power_1, cap_salvage, cap_seal_1, cap_seal_2, cap_thermal | 11 / 8 / 0 / 10 / 14 / 8 / 1 / 3 / 5 | core_ember:specimen_ember/sacrificed, core_frost:specimen_frost/stored, core_ember:craft/field_use_candidate | 2 |
| 13 | 561 | advanced_workbench, furnace, hand, research, workbench | cap_climb, cap_filter, cap_power_1, cap_salvage, cap_seal_1, cap_seal_2, cap_thermal | 13 / 8 / 0 / 10 / 14 / 8 / 1 / 3 / 5 | core_ember:specimen_ember/sacrificed, core_frost:specimen_frost/stored, core_ember:craft/field_use_candidate | 2 |
| 14 | 561 | advanced_workbench, furnace, hand, research, workbench | cap_climb, cap_filter, cap_power_1, cap_salvage, cap_seal_1, cap_seal_2, cap_thermal | 19 / 8 / 0 / 10 / 14 / 8 / 1 / 3 / 5 | core_ember:specimen_ember/sacrificed, core_frost:specimen_frost/stored, core_ember:craft/field_use_candidate | 2 |

Baseline bottlenecks (top): session_time:expedition, capability_material_unresolved:cap_boat, inventory_full:home, home_required_for_stations, session_time, station_missing:workbench:t1, station_missing:furnace:t1, input_missing:iron_ingot. The model still shows session-time pressure, home storage pressure, unresolved boat materials, and early station/home prerequisites. It does not show an early Core flood: session 1 has 0 Core discoveries.

## 5. Expected vs rare rewards

- Roadside cache expected per claim: `{"iron_scrap": 3.6, "knowledge_spares": 1.35, "research_notes": 0.45, "grain_seed": 0.45}`. Baseline roadside claims: 25. Expected totals contain no Core/catalyst.
- Rare catalyst: attempts 3, successes 1, one-time vault policy.
- Specimens found: `{"core_ember": 1, "core_frost": 1}`. Venom remains locked behind late seal/boat/material gates in the baseline.

## 6. USE / STORE / SACRIFICE and manufacturing

Baseline decision log: `[{"session": 8, "decision": "SACRIFICE", "instance": "soh_model_000014", "item_id": "core_ember", "recipe": "craft_core_ember", "knowledge_permanent": true, "native_casts_executed": 0}]`.

- `use_now`: keeps specimens as field-use candidates; no specimen sacrifice; no manufactured Ember. No Gold effect is claimed.
- `store_all`: stores specimens; no sacrifice; no manufactured Ember.
- `research_first`: sacrifices the first eligible specimen; manufactured Ember session 10.
- Baseline: stores Ember until advanced workbench + Core Binding + catalyst are ready, sacrifices it for permanent `craft_core_ember`, then manufactures one Ember Core. Frost is stored; Frost/Venom manufacture remain blocked by unresolved reagents.

## 7. Sensitivity scenarios

| Scenario | Ember discovery | Frost discovery | Ember manufacture | Ember built | Catalyst | Deaths | Remaining goals | Technical |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| baseline | 3 | 5 | 9 | 1 | 1 | 0 | 5 | PASS |
| poor_loot | 5 | 8 | — | 0 | 1 | 1 | 5 | PASS |
| lost_specimen | 3 | 4 | 14 | 1 | 1 | 1 | 5 | PASS |
| material_shortage | 3 | 5 | — | 0 | 1 | 1 | 5 | PASS |
| failed_expeditions | 3 | 6 | — | 0 | 1 | 4 | 5 | PASS |
| limited_playtime | 11 | 13 | — | 0 | 1 | 0 | 5 | PASS |
| use_now | 3 | 5 | — | 0 | 1 | 0 | 5 | PASS |
| research_first | 3 | 5 | 10 | 1 | 1 | 0 | 5 | PASS |
| store_all | 3 | 5 | — | 0 | 1 | 0 | 5 | PASS |
| rush_east_unprepared | 3 | — | — | 0 | 1 | 0 | 5 | PASS |

Interpretation: poor loot and limited playtime delay discovery/manufacture; material shortage and failed expeditions block or delay manufacture; losing the Frost specimen removes that physical opportunity while knowledge/home persistence rules remain intact. These are deterministic sensitivity probes, not probability forecasts or human outcomes.

## 8. Remaining late-game goals

| Goal | POI | Systems | Required caps | Missing/unresolved materials | Status |
|---|---|---|---|---|---|
| goal_tide_customs | poi_pearl_customs | exploration, research | cap_boat, cap_seal_2, cap_tide_ward | abyssal_pearl, pearl, rubber_sap, hardwood | REMAINING_GOAL |
| goal_karst_dive | poi_sunken_cenote | exploration, building | cap_deepward | aether_crystal, rubber_sap, glacial_iron | REMAINING_GOAL |
| goal_fen_purification | poi_ashwater_pump | building, economy, exploration | cap_filter, cap_power_1, cap_seal_2 | copper, bog_iron, peat | REMAINING_GOAL |
| goal_storm_signal | poi_glasswind_light | exploration, research | cap_seal_2, cap_stormward | storm_glass, silica_sand, copper | REMAINING_GOAL |
| goal_canopy_lift | poi_verdant_root_lift | exploration, combat, research | cap_climb, cap_filter, cap_thermal | venom_sac, aether_crystal, hardwood, rubber_sap | REMAINING_GOAL |

At least three separate late goals remain after the modeled journey. They are authored destinations with unresolved material/capability gates, **not proven 14-day engagement**.

## 9. Unresolved / provisional decisions

- Unapproved A1 aliases: bog_iron, fibre, frost_resin, glacial_iron, hardwood, peat, rare_herb, venom_sac. In particular `frost_resin != frost_shard`, `venom_sac != venom_spine`, `peat != coal` for this model.
- Missing A3/A1 items: abyssal_pearl, aether_crystal, basalt, copper, honey, limestone, obsidian, pearl, rubber_sap, salt, silica_sand, storm_glass.
- Provisional A3 bindings: early_roadside_salvage, specimen_ember, specimen_frost, specimen_venom, catalyst_vault. These include the safe bootstrap roadside cache, specimen POI bindings, and the catalyst vault binding. A1 has not approved these loot identities.
- A0: generic SaveService unique-token guards, production station/time host, native home placement, death/respawn and hazard damage are not integrated.
- A4: real Gold skill verification, authoritative cast commit atomicity, and tactical effects are not modeled. `skill_readiness` remains `BLOCKED_PENDING_A4`.
- Human: fun, rarity excitement, actual travel/combat/gather pacing, and 14-day retention are unverified.

## 10. Reproduction and tests

```bash
python tools/survival/economy/model_progression.py --scenario baseline --json /tmp/progression_baseline.json
python tools/survival/economy/model_progression.py --json docs/survival/economy/progression_report.json
python -m unittest discover -s tests/survival/catalog -p 'test_*.py' -v
```

Local product-model gate: **21 Python tests PASS** (10 preserved hardening/catalog tests + 11 new progression negatives/sensitivities). Native hardening suite remains **362 checks / 20 cases** from the accepted fixture scope; this product model does not alter it. Final CI evidence is recorded in PR #19 after push.

## 11. Next integration boundary

1. A1: approve/reject the eight aliases and the provisional POI/source bindings; supply native POI state, hazard damage, route access and material provenance.
2. A0: implement generic SaveService token guards, station resolver/power/active tick host, home placement and death/respawn; then run combined native negative tests with A3.
3. A4: provide real Gold/source-backed skill binding and authoritative cast commit; only then can USE become a verified tactical action rather than a loadout allocation.
4. Human playtest: measure whether the proposed scarcity/choice curve actually feels exciting and unfinished-but-hooked after a 14-day-equivalent journey.

**NEXT_ATOMIC_ACTION:** independent Control Tower review of this separate product model and its unresolved A1 bindings; do not merge PR #19 or claim gameplay balance approval from simulation alone.
