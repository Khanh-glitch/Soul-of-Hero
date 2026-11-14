# PA1 × Last Island — Git-only agent entrypoint (2026-11-13)

> **Status: RECOVERED_DESIGN_PARTIAL · SOURCE_IMPLEMENTED_PARTIAL · NOT 148/128 LIVE · NO MERGE.**
>
> This entrypoint is derived from the Creator's checked **SOH_PA1_LI_AI_TAKEOVER_FULL_RECOVERY_20261113.zip**. It makes the essential recovered design facts usable by an Agent with **GitHub only**. The archive is NOT hosted in this repository; these notes do **not** purport to be its full 152-file recovery. The original v1.1 and v1.2 master files are not in that archive either. Never claim byte-identical reconstruction.

## 0. One ordered reading path, all in Git

1. `web/ref/README.md`, `web/ref/bible.md`, `web/ref/OPERATIONS.md` — active product authority / mechanics-first sequence. Do not replace with this recovery note.
2. `docs/design/VEYRA_INDUSTRIAL_ECONOMY_DECISION_LEDGER_2026-11-12.md` §§24–25 — PA1 Creator decisions on Building ontology, 15 wood shapes and physical devices.
3. **This document** plus `docs/design/pa1-recovery/PA1_RECOVERED_RECIPE_PROVENANCE_15.csv` — recovered paper delta, precise known/unknown boundaries, latest dry-kit override.
4. `docs/design/PA1_OIL_MOBILITY_V1_2_ACCEPTANCE.md` **on PR #59 head** — newer v1.2 fuel and recipe corrective; branch PR #56 does not include this child-branch file until integration. Resolve it via [PR #59](https://github.com/Khanh-glitch/Soul-of-Hero/pull/59/files), not local path assumptions.
5. `web/src/game/{catalog,engine,persist,core,recycler}.ts`, `web/src/game/balance.v1.json`, `web/src/ui/{BuildBar,Game,panels}.tsx` and `web/tests/{pa1-building-ontology,economy-network}.test.ts` — actual runtime on chosen exact HEAD. Do not mistake PR branch snapshots for `main`.
6. `web/reports/economic-network/{README,M5_CANON_CORRECTIVE,SOH_ECONOMIC_HANDOFF,SOH_ITEM_FUNCTION_AUDIT.csv,SOH_RECIPE_ROUTE_AUDIT.csv}` — live predecessor audits; **M4_MASTER_BLUEPRINT is superseded/unapproved**.
7. `web/ref/atlas/extracted/LI_MASTER_RESEARCH_REPORT_v5.md` and the repository's LI references — historic Last Island evidence only, not universal current loot prices/recipes.
8. PRs [#56](https://github.com/Khanh-glitch/Soul-of-Hero/pull/56), [#57](https://github.com/Khanh-glitch/Soul-of-Hero/pull/57), [#58](https://github.com/Khanh-glitch/Soul-of-Hero/pull/58), [#59](https://github.com/Khanh-glitch/Soul-of-Hero/pull/59) — dependent branches, CI and issues; avoid merging without authority.

## 1. The Creator's item/building ontology

**Building shell is world geometry, never inventory.** The player chooses these wooden forms in Building and pays construction materials directly: 
`floor_wood`, `floor_triangle_wood`, `ceiling_wood`, `ceiling_triangle_wood`, `wall_wood`, `wall_window_wood`, `wall_doorframe_wood`, `door_wood`, `wall_half_wood`, `wall_pillar_wood`, `wall_triangle_wood`, `fence_wood`, `roof_thatch`, `roof_slope_thatch`, `roof_corner_thatch`.

They are intended to upgrade IN PLACE from **wood → stone → iron → steel**, via Territory Cabinet, keeping world identity, paid material, condition and save state. **15 wooden forms exist; 45 per-form upper-grade upgrades and true half-cell/multi-storey geometry are not implemented or numerically specified.** The 60 target transactions are not 60 inventory item IDs and not 60 craft recipe IDs. Do not bypass the Cabinet or treat brick as steel. LI historical versions sometimes have a different number of material grades: SOH's chosen FOUR is intentional.

**Devices are inventory items before placement:** `deploy_claim`, `deploy_bed_straw`, `deploy_chest_small`, `deploy_chest_large`, `deploy_campfire`, `deploy_furnace`, `deploy_oil_pump`, `deploy_refinery`, `deploy_workbench`, `deploy_research`, `deploy_garden`, `deploy_farm_controller`, `deploy_barrel`, `deploy_feed_trough`, `deploy_base_generator`, `deploy_power_cable`, `deploy_power_switch`, `deploy_pressure_switch`, `deploy_ir_sensor`, `deploy_arrow_turret`, `deploy_bear_trap`, `deploy_spikes`, `deploy_barricade`, `deploy_torch_post`. The physical pack is crafted from real ingredients, has inventory UID and HP/condition, is consumed ONCE by Build, exists in the world, and is recoverable by valid reclaim without duplicate or UID loss. `escrow_chest` is separately pre-existing; powered-door module remains unresolved and must not be counted as another approved deploy pack.

Current `catalog.ts` generates all 24 packs with `station:null`, `base:true`, `tier:0`, and adds all to `ALWAYS_KNOWN_RECIPES`. This is implementation, NOT proof that all advanced stations should be craftable/known at spawn. Don't create a bootstrap deadlock when adding family gates.

## 2. Census must use ID-set differences, not arithmetic

- **Runtime on PR #56/PR #57 source snapshot:** 147 item IDs / 113 active recipe IDs, 15 wooden forms, 24 packed devices.
- **Recovered paper ambition:** 148 item IDs / 128 *claimed* active formulas, 11 research families, 15 forms × 4 world-state tiers.
- **148 decomposition in the recovered registry:** original 123 baseline items + 24 packs + one paper `steel_ingot`. A separate preliminary ledger's “123+25” count includes a not-approved powered-door device; do not treat these as the same ID list.
- **15 provenance slots are NOT 15 net new recipes**. Eight slots have recovered input BOMs and seven have missing BOMs; ten slot IDs already exist in live 113. `refined_iron_ingot` / `refinery_fuel` unchanged and `fuel_briquette_legacy` retired, so the recovered data cannot reconstruct an executable 128-unique-recipe master. Use the accompanying CSV to build a three-way ID/input/output diff against code.
- Historical original paper master v1.1 SHA256 `b45b157e27f39688d22cc1319de43fec663aecbed8b63bd5b2cb92a6831c5537` and corrected v1.2 SHA256 `f4fcf26c9da05ed6ae26bbe1d25304596b328d2add4722ee5ced1c4c07128ede` are known **HASHES ONLY**. Neither original full JSON is included here or in the Creator's checked recovery archive.

## 3. Recovered v1.1 source-backed paper exemplars

See **`PA1_RECOVERED_RECIPE_PROVENANCE_15.csv`** for all eight known BOM rows, seven UNKNOWN rows, source status and **v1.2 precedence**.

| Existing formula / item | Recovered paper intent | Classification |
| --- | --- | --- |
| Refined Iron | `3 iron_ingot + 1 coal → 2 refined_iron_ingot` | Already live: no extra recipe |
| Metal Pipe | `2 refined_iron_ingot + 1 mechanical_parts → 2 metal_pipe` | Replace old output 1 |
| Mechanical Gear | `1 refined_iron_ingot + 1 iron_ingot + 2 mechanical_parts + 1 fasteners → 1 mechanical_gear` | Change existing recipe |
| Iron Plate | `2 refined_iron_ingot + 1 fasteners → 2 iron_plate` | Change existing recipe |
| Steel | `2 refined_iron_ingot + 1 coal → 1 steel_ingot` | New PAPER item only: requires STEEL tech; grade costs, HP, conditions and source economy not approved |
| Lubricant | `1 salvaged_oil + 2 meat + 1 raw_salt → 1 lubricant` | PAPER change to Refinery; investigate real food/oil source and BAL before cutover |
| Fuel | `3 salvaged_oil + 1 glass → 1 fuel_can` | Already live for refinery single |
| Motorbike Kit | `1 vehicle_frame + 1 vehicle_drive + 2 iron_plate + 2 fasteners → 1 motorbike_kit` | **Use v1.2 override**, not obsolete v1.1 kit which also consumed `fuel_can` |

The **v1.2 dry Motorbike Kit** has no fuel packaged or free refuel; `vehicleRefuel` consumes one real physical Fuel Can afterward. Retire obsolete `fuel_can.studyRecipe='fuel_can'` and its abandoned direct recipe only with explicit legacy queued-job migration. Recipe versioning is essential: `persist.ts` currently validates Refinery queued job reservations/duration against the **current** catalog recipe.

Paper only: 11 family names `METALLURGY, MOBILITY, ENERGY, ELECTRICAL, AGRICULTURE, ARMORY, EXPLORATION, ARCANA, STEEL, DEFENSE, CORE_SPECIFIC`. Each family should have atomic one-time paid unlock. Recovered exact **ENERGY** starter-study materials: `5 spares + 2 iron_ingot`. Family prices and separate per-Core study costs are mostly UNKNOWN. Armor patterns are tied to authentic first pickup of `hide/chitin/fur/scrap` rather than Core research; never merge these research mechanisms.

Paper Recycler proposal (not yet runtime): **1 metal_pipe → 1 refined_iron_ingot**; **1 mechanical_gear → 1 mechanical_parts + 1 scrap**; **1 metal_blade → 1 iron_ingot + 1 scrap**; **1 iron_plate → 1 scrap**; **steel_ingot rejected before debit**. Existing versioned recycler jobs must retain original economics; no fictional 75%/25% durability assigned to stackable industrial materials.

## 4. What is not confirmed / do not invent

- Seven paper slots with missing input BOMs; 45 tier upgrade costs, all per-shape Steel grade HP/repair/upkeep and actual non-square collider/support rules.
- Original v1.1 full 128-row master, v1.2 full correction and old original LI 132-label complete artifact (new recovered LI corpus is smaller).
- LI output batch sizes, general loot rates or universal blueprint rule aggregated across 2019/2022/2026 modes; avoid copying without mode-level evidence.
- Actual Veyra accessible routes and survival economy across legal spawns; PR57 is a limited source audit, PR59 is finite wreck/Graywater-source proof, not 336h human play. Owner map must authorize oil wellheads; **no zero-input infinite oil**.
- 24 packs' all-known hand craft is not automatically authorized research law, and old M3/M4 hypothetical balance proposals were explicitly rejected in M5.

## 5. Practical implementation contract — GO with bounded change

Agent may implement **immediately** from Git evidence: versioned recipe/job/snapshot migration + safe Pipe/Gear/Plate replacements + v1.2 dry-kit/retired fuel-can link, independent test coverage and truthful Craft/Build UI. Need failing-before/passing-after tests, exact source receipt/UID conservation, save/cancel/queue/offscreen, browser real-input tests. Preserve 15 geometry vs 24 pack split; keep ordinary survival/Workbench bootstrap playable. Do not mass-enable Tech family changes without individual cost gate tests, or insert fake Steel economics.

Do **not** require original master bytes as universal STOP. New proposals for unknown ingredients/costs are allowed as transparently new, sourced and tested design drafts, not automatically implemented canon. Do not claim 148/128 live until actual ID counts/recipes with sources are verified. Keep PR #56, #57, #58, #59 Draft and owners separated. End with branch/base/head, diff, CI exact SHA, snapshots, browser captures and unresolved decisions.

**Git-only execution order:** [Control Tower work order on PR #56](https://github.com/Khanh-glitch/Soul-of-Hero/pull/56#issuecomment-6849920753) plus this entrypoint. No ZIP or private sandbox attachment is required for this bounded milestone.
