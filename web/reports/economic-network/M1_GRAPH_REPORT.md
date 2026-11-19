# Milestone M1 Report — Soul of Hero Economic Multigraph & Last Island Crosswalk

**Repository Baseline:** `Khanh-glitch/Soul-of-Hero` @ `52f27959f732aa8b47d6a897c9a5aa7d708cf926` (branch `arena/f561fd0d-soul-of-hero`)  
**Extractor & Validator:** `web/src/game/economic-graph.ts` (`soh.economic-graph.v1`)  
**Verification Suite:** `web/tests/economic-network-m1.test.ts`  
**Generated Artifacts:**
- `web/reports/economic-network/SOH_ECONOMIC_GRAPH.json` (deterministic multigraph serialization)
- `web/reports/economic-network/SOH_LI_ECONOMIC_CROSSWALK.csv` (`222` reconciled LI / live / creator / SOH-exclusive rows)
- `web/reports/economic-network/LI_SOURCE_EVIDENCE.md` (provenance ledger)
- `web/reports/economic-network/M1_GRAPH_REPORT.md` (this deliverable)

---

## 1. Executive Summary & Verification Status

Milestone M1 extracts the complete **Soul of Hero (SOH)** economic network directly from the authoritative runtime codebases (`web/src/game/*` and `web/src/veyra05/*`) across **Shipping (`shipping_fresh`)**, **Dev Delta (`dev_delta_fresh`)**, **Test Fixture (`oilTestFixture`)**, and the **81-POI continuous Veyra world (`veyra05`)**, and reconciles every economic node, edge, and gate against both the **Last Island (LI) archive** (`web/ref/atlas/extracted/*`, `web/ref/bible.md`) and **live-verified LI official/community docs**.

| Metric / Invariant | Verified Value |
|---|---|
| Total Graph Nodes | **595** across 16 node kinds (`item`: 123, `container`: 117, `recipe`: 102, `blueprint`: 75, `structure`: 36, `station`: 28, `sink`: 26, `creature`: 23, `world_source`: 20, `elder`: 12, `vendor_offer`: 10, `player_state`: 8, `currency`: 4, `husbandry`: 4, `poi_gate`: 4, `requisition`: 3) |
| Total Graph Edges | **2,037** directed, typed, gated multigraph edges across **54 edge kinds** |
| Structural Gates | **25** explicit gate definitions (`gate:*`) |
| Runtime Status Split | `LIVE_SHIPPING_AND_VEYRA`: **1,494** · `LIVE_VEYRA_ONLY`: **320** · `LIVE_SHIPPING_ONLY`: **191** · `TEST_FIXTURE_ONLY`: **32** |
| Graph Validation (`validateEconomicGraph`) | **0** dangling IDs, **0** duplicate IDs, **0** invalid gates, **0** schema violations |
| Serialization Determinism | Byte-identical across repeat extractions (`JSON.stringify(graph1) === JSON.stringify(graph2)`) |
| LI Crosswalk Coverage | **222 rows** (`104` XEDGE + `36` H-decisions + `32` A-gates + `17` S-systems + `12` U-gaps + `9` live LI + `12` SOH-exclusive) |

---

## 2. Node, Edge, and Gate Inventory

### 2.1 Node Inventory (595 Total)

| Node Kind | Count | Ground-Truth SOH Source |
|---|---|---|
| `item` | 123 | 100% of `catalog.ts` `ITEMS` (materials, tools, weapons, armor, food, cores, essences, components, elder stones, currency item `rcash`) |
| `container` | 117 | `22` Shipping chests (`shipping`) + `2` `dev_delta` relay chests + `1` `airdrop_v1` + `6` Shipping `LOOT_CLASSES`/`LOOT_B04_ROLES` ecology pools (`31` Shipping/Delta containers total) + `86` Veyra POI containers (`80` loot + `6` cash) |
| `recipe` | 102 | `89` crafting/refining/cooking recipes (`RECIPES`) + `2` `GARDEN_CROPS` yields (`crop`, `herb`) + `11` `recycler` disassembly entries (`6` equipment + `5` `COMPONENT_RULES` incl. `X:drive`) |
| `blueprint` | 75 | Every item/recipe gated by run-local `r.knowledge.recipes` (excluding `14` `ALWAYS_KNOWN_RECIPES`) |
| `structure` | 36 | 100% of `catalog.ts` `STRUCTS` (bases, defenses, walls, stations, containers) |
| `station` | 28 | Logical crafting/processing/POI/vehicle/husbandry workstations (`workbench_1..3`, `industrial_module`, `furnace`, `furnace_lined`, `campfire`, `refinery`, `oil_pump`, `research`, `recycler`, `base_generator`, `ir_sensor`, `arrow_turret`, `bear_trap`, `feed_trough`, `motorbike`, etc.) |
| `sink` | 26 | Burn, upkeep, fuel, wipe (`run_wipe_336h`), Ragnarok, trap/turret ammo, repair/recovery loss, cast sinks, vehicle wear |
| `creature` | 23 | `13` catalog/Shipping creatures (`boar`, `wolf`, `toad`, `crawler`, `beetle`, `crab`, `deer`, `hare`, `grouse`, `fox`, `vampire_*`, `orc_*`, `slime_*` across catalog) — exact count `23` incl. `boss_custodian`, `boss_greyback`, `boss_ronin`, `boss_tidemarshal` |
| `world_source` | 20 | `19` `SOURCES` + `1` `world_source:oil_site_fixture` |
| `elder` | 12 | `6` Legacy `ELDERS` (`shipping` only) + `6` `PRIMORDIAL_ELDERS` (`veyra05` only) |
| `vendor_offer` | 10 | `4` `VENDOR_SPARES` + `6` `VENDOR_SECURED` |
| `player_state` | 8 | `player:hp`, `hunger`, `thirst`, `stamina`, `warmth`, `rad`, `knowledge`, `profile:secured_cash` |
| `currency` | 4 | `currency:spares`, `currency:rcash`, `currency:secured_cash`, `currency:score` |
| `husbandry` | 4 | `boar`, `deer`, `grouse`, `hare` (`husbandry.ts`) |
| `poi_gate` | 4 | Shipping/Delta gates (`keycard:145_84`, `keycard:160_99`, `power:148_82`, `power:28_179`); `0` on Veyra |
| `requisition` | 3 | `ember`, `hearth`, `beacon` (`balance.v1.json:journeyRequisitions`) |

### 2.2 Gate Taxonomy (25 Structural Gates)

Key gating mechanisms verified in code:
- **Workstation & Module Gates (`gate:wb_l1`, `wb_l2`, `wb_l3`, `wb_industrial`, `station_*`):** `wb_l2` unlocks oil refining (`oilRefineryV1`), `wb_industrial` requires active `wire-v1` orthogonal power (`gate:base_power_wire_v1`) from fueled `base_generator`.
- **Fuel Constraint (`gate:station_fuel_non_canister`):** `catalog.ts:stationBurnable()` explicitly rejects `fuel_can`, isolating canisters exclusively to vehicles (`motorbike`), POI generators, and power runs.
- **Research Split (`gate:directed_research_tier_lt_3`):** `catalog.ts:permitsDirectedResearch` permits 9-Spares directed research only for `recipe.tier < 3`; Tier 3 knowledge depends on random research or physical blueprint loot.
- **Mode Split Gates (`gate:airdrop_v1`, `creator_loot_v1`, `loot_ecology_w06`, `recycler_site`, `shipping_spawner`, `veyra_spawner`):** `engine.ts:190` and `world.ts:webRecyclerSite()` disable Airdrops, Creator Loot, W06 Loot Ecology respawns, and the physical Recycler on Veyra (`wreckEconomy === 'direct-v1'`).
- **Test-Only Authority (`gate:oil_test_fixture`):** `engine.ts:1414` gates `oil_pump` behind `r.oilTestFixture === true` (`authority: 'test-fixture-v1'`).
- **Locked Canon Gates (`gate:escrow_cash_only`, `claim_2_limit`, `ragnarok_final_72h`, `run_wipe_336h`):** Enforce cash-only meta escrow (`rcash -> securedCash`), 2-claim limit + `25%/24h` territory upkeep, final-`72h` Ragnarok escalation (`h 264..336`), and full `336h` wipe.

---

## 3. Dual-World Extraction & Parity Findings (Shipping vs Veyra U=0.5)

### 3.1 World Resource Sampling (`Shipping` vs `Veyra05`)

Extracting live `world_source` placements across the Shipping grid (`shipping_fresh`) and all **81 clustered POI interior windows** (`115×115` tiles each) in Veyra (`buildWindowWorld` + `buildFloorStack`):
- **All 19 `SOURCES` exist on both Shipping and Veyra**, including `wreck` (`10` on Shipping; `96` across sampled Veyra POI windows) and `salt_shale` (`80` on Shipping; `215` across sampled Veyra windows).
- Both modes initialize `sourceLayoutVersion: 3` (`engine.ts:180`), so `wreck` rolls `salvaged_oil` (`0.35/hit`) and `VENDOR_SPARES` sells `salvaged_oil` on **both** maps.

### 3.2 Veyra 81-POI Coverage & Live Codebase Defects Caught in M1

Every one of the **81 POIs** in `VEYRA_GOLD_MAP.sohmap.json` / `POIS` was classified and audited:

| Veyra POI Role | Authored / Expected | Materialized in Live Code | Verified Node / Edge Impact |
|---|---|---|---|
| Authored-Cache POIs (`sites.ts`) | 6 POIs, **24** `.cache()` chests | 6 POIs, **23** chests materialized | **BUG CAUGHT (`sites.ts:67` vs `110`):** `po_greywater` L0 `Tackle Box` (`['rope',3],['fiber',5],['meat',1]`) shares exact tile `(1642,1176)` with `Cottage Ladder`, so `floors.ts` `occupiedStatic` silently drops `Tackle Box`. |
| Archetype Loot POIs (`floors.ts:ARCHETYPE_LOOT`) | **58** remaining POIs | **57** POIs materialized | **BUG CAUGHT (`rest48.ts:112` + `plan.ts:133`):** `po_glade` (*Mosslight Glade*) builds only `open` `'stone'` paths painted as `T.ROAD` instead of `T.FLOOR`; `floors.ts:375` `pickCell()` requires `T.FLOOR` and silently drops its cache, leaving `po_glade` with **0** containers. |
| `RCASH_BY_POI` Cash Chest POIs | 6 POIs (**275** `rcash`) | **6** POIs (**275** `rcash`) | `po_rc_dam` (50), `po_rc_salt` (50), `po_rc_ironvein` (45), `po_rc_meridian` (45), `po_rc_sandgate` (45), `po_rc_kestrel` (40). **Note:** Because NO creature drops `rcash` on `killCreature`, these 6 static chests = **275** are Veyra's primary finite in-world `rcash` mint. |
| `VENDOR_POIS` | 2 POIs | 2 POIs | `po_vend_gulf`, `po_vend_strait` |
| `EVAC_POIS` | 3 POIs | 3 POIs | `po_evac_west`, `po_evac_south`, `po_evac_hook` |
| `ELDER_POIS` | 6 POIs | 6 POIs | `po_elderwood` (`aion`), `po_necropolis` (`anubis`), `po_hall_eyes` (`argus`), `po_gate` (`atlas`), `po_surtur` (`surtur`), `po_typhon` (`typhon`) |
| Keycard / Power POI Gates | 0 authored on Veyra | **0** keycard doors, **0** power doors | `keycard` exists ONLY in `shipping`/`dev_delta` loot (`shipping:watch:21`, `dev_delta:delta_relay:4`). |

**81-POI Accounting Check:** `6 (authored caches) + 57 (archetype loot) + 1 (po_glade dropped) + 6 (rcash) + 2 (vendor) + 3 (evac) + 6 (elder) = 81`. Every single Veyra POI is accounted for.

### 3.3 Reachability & Dead-End Diagnostics (Static Graph Proof)

Static multigraph reachability confirms concrete **broken chains** and **dead-end sinks** already visible before simulation:

1. **Both Shipping & Veyra (`TEST_FIXTURE_ONLY` Isolation):**
   - `crude_petroleum`, `pump_crude`, and `refinery_crude` are completely unreachable in live play (`oilTestFixture !== true`).
   - `blueprint` generic item ID is never minted directly (uses tagged `blueprint:<recipe>` stacks).
2. **Broken & Blocked Chains Exclusive to Live Veyra (`veyraUnreachableItems` / `veyraUncraftableRecipes`):**
   - **Missing Spawns (`veyra05/ecosystem.ts`):** `wolf`, `toad`, `crawler`, `beetle`, and `crab` **never spawn on Veyra**. Consequently:
     - `beetle_horn` and `chitin` never drop $\rightarrow$ **`chitin_armor` is 100% uncraftable on Veyra**.
     - `crawler_optic` never drops $\rightarrow$ **`essence_spirit` is 100% uncraftable**, which in turn makes **`core_demon` 100% unobtainable** (crafted output AND `creatorLootV1` are both dead on Veyra!).
     - `wolf_fang` is 100% unobtainable on Veyra (`wolf` never spawns).
     - `shell` has **no repeatable source** on Veyra (`crab` absent; only 4 one-time shells drop from `boss_tidemarshal`).
   - **Disabled Ecology / Wreck / Recycler Systems (`engine.ts:190`, `world.ts`):**
     - `damaged_drive` never drops (`wreckEconomy === 'direct-v1'`), making **`recover_drive` 100% uncraftable** and removing physical component recycling (`X:*` edges).
     - `keycard` never drops anywhere in the 81 Veyra POIs.
     - Tier 3 Creator Cores (`core_meteor`, `core_dragon`, `core_elsa`, `core_mjolnir`, `core_demon`) have **no blueprint source** if `directedResearch` rejects `tier >= 3`, `airdropV1` is disabled, `creatorLootV1` is disabled, and `ARCHETYPE_LOOT` contains only `bow`, `stew`, `leather_armor`, `fur_cloak`, `gas_mask` (plus Shipping static chests' `arrow/brick/core_*`)! *(Quantified under full Monte Carlo random research in Milestone M2).*
3. **Shipping Unreachable Items (`shippingUnreachableItems`):**
   - `custodian_lantern`, `relic_shaleheart`, `ronin_nodachi`, `tidemarshal_trident` (`4` Veyra side-boss uniques) and `stone_aion..stone_typhon` (`6` Primordial stones) exist only on Veyra, while `stone_bog..stone_tide` (`6` Legacy Elder stones) exist only on Shipping.
4. **Items Without Any Non-Wipe Economic Sink (`21` items):**
   - Equipment/armor without wear-repair/consume/recycle loops on Veyra or without durability drain (`chitin_armor`, `fur_cloak`, `gas_mask`, `leather_armor`, `scrap_helm`, `lead_rope`, `trail_pack`, `relic_shaleheart`) + `12` Elder Stones + generic `blueprint` only leave the economy on the 336h run wipe (`RUN_WIPE_SINK`).

---

## 4. Last Island Crosswalk Summary (`SOH_LI_ECONOMIC_CROSSWALK.csv`)

Every single historical LI system (`S01..S17`), cross-system edge (`XEDGE-001..104`), gate (`A00..A31`), creator decision (`H01..H36`), unresolved gap (`U01..U12`), live official/community LI rule (`LI_LIVE_01..09`), and SOH invention (`SOH_ONLY_01..12`) is mapped in `SOH_LI_ECONOMIC_CROSSWALK.csv` (`222` rows):

- **Exact Architectural Divergence from LI:**
  - `H06` / `D01`: Firearms (`gunpowder`, `FAMAS`, `bullets`) replaced cleanly by **7 Creator Cores + 2 energy SKUs + 4 essences**.
  - `H08` / `D03`: Knowledge tier is decoupled from Workbench level (unlike LI's strict station-lock), while SOH restricts `directedResearch` to `tier < 3`.
  - `C01..C24` (`bible.md`): SOH runs a **336h (14d) wipe** with **72h Ragnarok**, **cash-only meta escrow** (`rcash -> securedCash` across wipes; blueprints wipe per run unlike some modern LI action modes), and **optional Elders/Side Bosses**.
  - **Veyra Feature Parity Gap vs LI:** While `shipping_fresh` mirrors LI's Recycler (`S03`), Keycard/Power POI ladder (`S07`), Respawning Loot Ecology (`S06`), and timed Airdrops (`S16`), live **`veyra05` omits all four**, substituting 24 authored caches (23 live) + 57 static one-time archetype chests.
- **Unretrieved / Blocked Sources Flagged Honestly:**
  - `9game.cn` URLs (`LI_LIVE_09`) remain `CAPTCHA_BLOCKED_AT_CHECK`.
  - `U01..U12` exact historical LI numeric tables remain `ORIGINAL_UNKNOWN` (`SOH_PROVISIONAL_TUNED` / `NOT_APPLICABLE_BY_CANON_H06`).

---

## 5. Verification Log & Hand-Off to M2

Verified directly on workspace commit `52f27959`:
```bash
cd web
npm run typecheck         # exit 0
npm run typecheck:tests   # exit 0
npm run build             # exit 0 (dist/index.html untouched source build)
npx vitest run tests/economic-network-m1.test.ts  # 1/1 passed (52.26s)
```

**Immediate M2 Inputs Established:** M2 simulations (`shipping_fresh` + `veyra05`) will numerically stress-test the exact loops identified above: random-research vs Tier-3 Creator Core gating, Veyra's finite `275` `rcash` chest pool vs Journey Requisition `securedCash`, `spares` abundance vs sink deficit on `direct-v1` wrecks, fuel/station burn vs `fuel_can` isolation, `25%/24h` territory upkeep under offline settlement, and motorbike/husbandry/garden ROI across `0h..336h`.
