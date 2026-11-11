# Milestone M3 Specification — Soul of Hero Counterfactual Rebalance (`DESIGN_PROPOSED` / Partially `CANON_REJECTED`)

> **CONTROL TOWER STATUS BANNER (`M5_CANON_CORRECTIVE.md`):**
> - **Artifact Status:** `RESEARCH_DELIVERED` / `DESIGN_PROPOSED` (Counterfactual model ONLY — **NOT `SOURCE_IMPLEMENTED`**, **NOT `PRODUCTION_FIXED`**).
> - **Superseded Proposals (`CANON_REJECTED`):** **`A1`** (`7/day` Journey `securedCash` — must be **`0`** via `escrow_chest` only), **`A2`** (`32` cabinet slots — **Creator-locked at `24`**, `10%` upkeep unapproved), **`A3`** (`qty=1` free `<50%` repairs — creates infinite repair exploit), **`A4`** (legacy Cores mislabeled as Creator Cores), **`A5`** (cross-species animal/monster drops), **`A6`** (forced spawn iron/coal nodes), **`A7`** (random Tier-3 Core unlock lottery after 4 unlocks).
> - **Simulation Caveat:** All 336h player archetype simulations in M2/M3 are non-authoritative diagnostics, never balance proof. See **`M5_CANON_CORRECTIVE.md`** and **`SOH_ECONOMIC_HANDOFF.md`** for authoritative canon classification and live fixes (`D1`–`D5`).

**Repository Branch:** `arena/f561fd0d-soul-of-hero`  
**Policy Spec Identifier:** `soh.economic-rebalance-m3.v1` *(Non-Authoritative Counterfactual Spec)*  
**Counterfactual Simulation Engine:** `web/src/game/economic-rebalance-m3.ts`  
**Verification Suite:** `web/tests/economic-network-m3.test.ts`  
**Machine-Readable Evidence:** `web/reports/economic-network/M3_BEFORE_AFTER_SIM.json`

---

## 1. Design Mandates & `LOCKED_CANON` Preservation

Every tuning rule in `M3_PROPOSED_V1` repairs a proven M2 failure while strictly preserving every non-negotiable Bible law (`LOCKED_CANON`):

| `LOCKED_CANON` Law | M3 Compliance Proof (`validateLockedCanonM3()`) |
|---|---|
| **336h Run Clock & 72h Ragnarok** (`K8`) | `BAL.run.maxRunHours === 336`, `ragnarokFinalHours === 72`, `calendar.years === 2`, `phaseHours === 42` untouched. |
| **Cash-Only Meta Escrow** (`K1`/`K8`) | `escrow_chest` stays cash-only (`30` `rcash`); no items, recipes, Core charges, or buildings carry across wipes. Cutting off-map Requisition minting `588 -> 98` restores physical `rcash` loot and Ragnarok risk-reward as dominant. |
| **Finite Non-Plant Sources & Zero Free Energy** (`K3`) | All non-plant wild/wellhead sources remain strictly finite (no regrow timers on stone, ores, wrecks, or oil sites). `stationBurnable()` continues blocking `fuel_can` inside smelters/campfires/refineries. |
| **Directed Research Tier Cap** (`K4`) | `permitsDirectedResearch(recipe)` remains strictly `recipe.tier < 3`; random Core unlocking activates weighted random discovery after 4 starter unlocks without bypassing blueprint/specimen study or directed tier limits. |
| **Net-Loss Recycler Integrity** (`K1`/`K4`) | Live `X:recover-v3`, `X:recover-v1`, and `COMPONENT_RULES` keep **`0` `OVER_RETURN`** under `industrial-proof.ts`. |
| **81-POI Continuous Veyra Fidelity** | All 81 POIs across all 12 Veyra scenes remain intact (`0` removed POIs); only geometry/coordinate drops and loot/resource parity gaps are repaired. |

---

## 2. Workstream A — Territory Upkeep, Cabinet Autonomy & POI Boundaries

*Addresses `M2-F08` (HIGH), `M2-F10` (MEDIUM), `M2-F13` (LOW).*

### 2.1 Parameter & Mechanics Deltas

1. **Territory Upkeep Rate & Exempted Precision Parts (`web/src/game/balance.v1.json:territory`):**
   - Lower `BAL.territory.upkeepFractionPerDay`: **`0.25` (350% over 14d) → `0.10` (140% over 14d)**.
   - Narrow `BAL.territory.materials` to structural construction materials: `['wood', 'plank', 'stone', 'fiber', 'rope', 'brick', 'iron_ingot', 'scrap']`, exempting `['spares', 'mechanical_parts', 'fasteners', 'glass']` from passive hourly drain (precision gadgets already sink material via craft cost, trap re-arming, and combat repair).
2. **Cabinet Capacity & Demand-Weighted Slot Utilization (`web/src/game/catalog.ts:STRUCTS.claim`, UI helpers):**
   - Increase `STRUCTS.claim.slots`: **`24` → `32`**, AND supply an optional `homeStatus` slot-allocation helper showing minimum hours across stocked stacks weighted by consumption rate rather than uniform stack division.
3. **POI Minimum Claim Radius Guard (`web/src/game/engine.ts:buildReason`, `1428–1458`):**
   - Enforce `BAL.economy.claimMinDistFromPoi` (`10` tiles) in `buildReason()` when `type === 'claim'`, checking both `w.places` (`kind !== 'start'`) on Shipping and global POI coordinates (`POIS`) on Veyra.
4. **Fractional `qty=1` Repair Edge Fairness (`web/src/game/engine.ts:structureRepairCost`, `624`):**
   - Current formula `Math.max(1, Math.ceil(q * 0.25))` bills 100% of any `qty = 1` ingredient on a 25% HP patch (`17` structure-ingredient pairs affected while `reclaimRefund = 0.5`).
   - **M3 Rule:** Keep `ceil(q * 0.25)` for `q >= 2`; for `q === 1` ingredients, require billing ONLY if structure damage `>= 50%` (`hp / maxHp <= 0.5`) OR substitute primary structural base material (`wood`/`stone`/`iron_ingot`), cutting `17 -> 0` overcharge edges.

### 2.2 Simulated Before vs After Outcomes (`M3_BEFORE_AFTER_SIM.json`)

| Base Preset | Structs | Before Mats | After Mats | Before 24-Slot Autonomy | After 32-Slot Weighted Autonomy | Autonomy Gain | Before 14d Items | After 14d Items | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `Starter_2x2_Wood` | 20 | 4 | 4 | 384.00 h | **3,600.00 h** | **9.38×** | 452 | **182** | `-59.73%` |
| `Standard_4x4_Plank` | 56 | 7 | 6 | 97.63 h | **1,301.69 h** | **13.33×** | 1,233 | **485** | `-60.67%` |
| `Stone_Keep_5x5` | 86 | 9 | 6 | 33.98 h | **637.17 h** | **18.75×** | 2,155 | **841** | `-60.97%` |
| `Brick_Citadel_6x6_Armed` | 127 | 9 | 5 | 31.22 h | **496.55 h** | **15.90×** | 2,809 | **1,016** | `-63.83%` |
| `Solo_Outpost_Zero_Wood` | 21 | 7 | 4 | 161.50 h | **2,287.85 h** | **14.17×** | 681 | **250** | `-63.29%` |

---

## 3. Workstream B — Energy, Fuel, Campfire & Production Oil Chain

*Addresses `M2-F05` (HIGH), `M2-F11` (MEDIUM), `M2-F12` (MEDIUM), `M2-F15` (LOW).*

### 3.1 Parameter & Mechanics Deltas

1. **`base_generator` Fuel Rating & Zero-Load Phantom Drain (`web/src/game/engine.ts:861–874`, `balance.v1.json`):**
   - Separate liquid generator potency from solid campfire fuel: `baseGeneratorFuelSeconds(key)` grants `fuel_can` **`360s`** (6 min/load, `2×` POI generator `180s` and `4×` `fuel_briquette` `90s`), while leaving `stationBurnable` strict (`fuel_can` disallowed in stations).
   - Fix `stepBasePower` (`engine.ts:869`): replace `const load = Math.max(1, powerAllocation(r, e, online).length)` with:
     ```ts
     const alloc = powerAllocation(r, e, online);
     if (alloc.length === 0) continue; // Zero idle fuel hemorrhage when switches/turrets/workbenches are inactive
     ```
2. **Production `oil_pump` Map Wellheads & Crude Batch Ratio (`balance.v1.json:oilPumpV1,oilRefineryV1`, `world.ts`, `veyra05/window.ts`):**
   - Graduate `oil_pump` (`authority: 'map-v1'`) alongside preserving `test-fixture-v1` compatibility:
     - **Shipping (`shipping_fresh`):** 2 finite map-authored oil wellhead sites (`stock = 120` each = `240` `crude_petroleum` total, Foundry Yard & Salt Cove).
     - **Veyra (`veyra05`):** 2 finite map-authored oil wellhead sites (`po_pumphouse` & `po_oldpump`, `stock = 150` each = `300` `crude_petroleum` total).
   - Double `BAL.oilRefineryV1.recipes.crude` yield: `4 crude_petroleum + 1 glass -> 2 fuel_can` (matching `batch` refinery efficiency, `16s`).
   - Remove the Veyra offscreen exclusion in `engine.ts:2419` (`if (!r.entities[e.id] && e.type === 'oil_pump') continue;`) so pumped oil integrates offscreen identically to furnaces and refineries (`oilPumpOffscreenSkipped: true -> false`).
3. **Idle Campfire Auto-Pause & Dynamic Tooltip Copy (`engine.ts:2461`, `Game.tsx:825`, `journey.ts:81`):**
   - In `stepStations`, stop campfire from burning fuel on an empty roast queue unless the player enables explicit `keepLitForWarmth` mode (eliminating silent `30 wood / 10 min` waste during cooking mistakes).
   - Replace hardcoded `"~2h"` text in `Game.tsx:825` & `journey.ts:81` with `${BAL.territory.unprotectedCollapseHours}h` (`12h`).

### 3.2 Simulated Before vs After Outcomes (`M3_BEFORE_AFTER_SIM.json`)

| Metric | Before (M2) | After (M3) | Change |
|---|---:|---:|---|
| `base_generator` `fuel_can` runtime (1 load) | `60s` | **`360s`** | **`6.0×` per canister** |
| Zero-load `base_generator` idle drain (24h) | `1,440` cans | **`0` cans** | **Eliminated** |
| Idle empty `campfire` 10-min wood burn | `30` wood | **`0` wood** | **Eliminated** |
| Shipping expected total `fuel_can` pool (wreck + wellheads) | `19.6` cans | **`139.6` cans** | **`+612.2%`** |
| Shipping continuous 1-load active turret/workbench power | `0.33 h` | **`13.96 h`** | **`42.30×`** |
| Veyra continuous 1-load active turret/workbench power | `0.18 h` | **`16.10 h`** | **`89.44×`** |
| 14-day 1-load continuous `fuel_can` deficit factor | `1,028.57×` | **`24.07×`** *(sustainable on realistic active-combat duty)* | **`42.7×` improvement** |

---

## 4. Workstream C — Veyra Parity, 81-POI Geometry, Creature Drops & Ore Distribution

*Addresses `M2-F01` (CRITICAL), `M2-F02` (CRITICAL), `M2-F03` (CRITICAL), `M2-F09` (MEDIUM).*

### 4.1 Parameter & Mechanics Deltas

1. **81-POI Materialization Repairs (`M2-F02`):**
   - `web/src/veyra05/arch/sites.ts:75`: Relocate `po_greywater` `Tackle Box` from `(1642, 1176)` (collides with `Cottage Ladder`) to clear floor tile `(1640, 1174)` (`authoredLootMaterialized: 23/24 -> 24/24`).
   - `web/src/veyra05/arch/rest48.ts:116` & `floors.ts:375`: Add a `T.FLOOR` altar pad under `po_glade`'s `sundial` (`open` `'floor'`) or widen `pickCell()` fallback for `'grove'` sites (`archetypePoisMaterialized: 57/58 -> 58/58`; **`81/81` POIs 100%**).
2. **Creature Drop Parity on Veyra (`M2-F01`):**
   - Keep Veyra's thematic enemy roster (`vampire_*`, `orc_*`, `slime_*`, `fox`) intact while bridging every missing material/specimen drop and adding coastal `crab`:
     - `slime_3` (`po_sulfur` / Ash): `+ ['chitin', 1, 0.70]`, `['beetle_horn', 1, 0.25]`
     - `orc_3` (`po_ironvein` / Quarry): `+ ['chitin', 1, 0.50]`
     - `vampire_2` (`po_academy` / Toxic-Ruin): `+ ['crawler_optic', 1, 0.35]`
     - `slime_1` (`po_pumphouse` / Marsh-Lake): `+ ['shell', 1, 0.70]`
     - `fox` (Forest night stalker): `+ ['wolf_fang', 1, 0.35]`
     - `VEYRA_BIOME_CREATURE[T.SAND]`: include `'crab'` alongside `['orc_1', 'slime_1']`.
   - **Result:** Missing Veyra craftable recipes (`chitin_armor`, `essence_spirit`, `core_demon`, `essence_water`, `core_elsa`, `shell_glass`) and study specimens (`beetle_horn`, `crawler_optic`, `wolf_fang`): **`6 broken -> 0 broken`**.
3. **Veyra Core, Blueprint, Wreck & Airdrop Parity (`M2-F03`):**
   - Distribute 5 curated static Creator Cores (`core_fire` @ `po_surtur`, `core_storm` @ `po_typhon`, `core_frost` @ `po_ironvein`, `core_meteor` @ `po_academy`, `core_dragon` @ `po_necropolis` or side-boss strongboxes) plus `blueprint:arrow` (`po_ranger`) and `blueprint:core_earth` (`po_elderwood`) (`staticCores: 0 -> 5`, `staticBlueprints: 6 -> 8`).
   - Enable `damaged_drive` bonus roll (`0.20/hit`) on Veyra `wreck` nodes (feeding the already-known `recover_drive` Workbench recipe!) and adapt `airdropV1` (`supportsAirdrops = true` landing inside active `veyra05` window bounds) (`airdropEvents: 0 -> 14`, `wreckDamagedDrives80` mean `0 -> 16.14`).
4. **Spawn-Window Ore & Mineral Floor (`M2-F09`):**
   - Inject deterministic shallow hill/outcrop clusters (min `14` `iron` nodes + `8` `coalv` nodes) into the outer walkable margin (`radius 28–55` tiles) of any Veyra spawn scene whose macro-geography lacks iron (`greywater`, `westmouth`, `hook`).
   - Spawn-window $N=200$ Monte Carlo `iron` nodes rise from **`P50 = 0` (`mean = 35.1`) → `P50 = 14` (`mean = 46.58`, `min = 14`)**.

---

## 5. Workstream D — Currency Sinks, Research Unblock, UI Parity & Refined Energy

*Addresses `M2-F04` (HIGH), `M2-F06` (HIGH), `M2-F07` (HIGH), `M2-F14` (INFO verified), `M2-F16` (MEDIUM).*

### 5.1 Parameter & Mechanics Deltas

1. **Journey Requisition Minting vs `VENDOR_SECURED` Sink Realignment (`M2-F04`):**
   - Rebalance `BAL.journeyRequisitions` daily `securedCash` rewards: `ember: 5 -> 1`, `hearth: 12 -> 2`, `beacon: 25 -> 4` (**`42/day -> 7/day`**, **`588/14d -> 98/14d`**), keeping physical item parcels intact (`bandage`, `cooked_meat`, `medkit`, `mechanical_parts`, `spares`, `fuel_can`, `crystal`) as day-by-day play motivation.
   - Expand `VENDOR_SECURED` inventory (`76 -> 160` `securedCash` spendable per run) by adding high-utility run boosters: `salvaged_oil x3 @ 6` (`18`), `energy_refined x6 @ 5` (`30`), `spares x4 @ 5` (`20`), `field_repair_kit x2 @ 8` (`16`).
   - **`requisitionOverVendorCapRatio` drops `7.74× → 0.61×` (`12.63×` improvement)** — restoring `rcash` exploration + `escrow_chest` Ragnarok extraction as the true meta-currency engine.
2. **Weighted Core Discovery in Random Research (`M2-F06`):**
   - In `engine.ts:2383`, replace `const pool = unknown.filter(k => !k.startsWith('core_'))` with:
     - Gate `core_*` only until `unlockedNonStarterCount >= 4` (protecting fresh-run survival basics in rolls 1–4), then allow `core_*` into `random` research with relative weight `0.5` vs `1.0` for non-core recipes.
   - **$N=400$ Monte Carlo Proof:** Spares to first random Core drops from **`108` fixed (`min/p50/max = 108`) → `P10 = 20, P50 = 32, P90 = 60, max = 84, mean = 35.89` spares** (`-66.8%` mean spares barrier), while preserving `permitsDirectedResearch` (`tier < 3`).
3. **Classic `BuildPanel` `BUILD_ORDER` Sync (`M2-F07`):**
   - Append `'ir_sensor'` and `'bear_trap'` into `BUILD_ORDER` (`web/src/game/catalog.ts:450`), eliminating the `2 -> 0` missing defense discrepancy against `BUILD_GROUPS.Defense`.
4. **Crystal & Sulfur Supply Scaling (`M2-F16`):**
   - Increase `SOURCES.crystal.stock` & `SOURCES.sulfur.stock`: **`3` → `4` units/node**, and raise `RECIPES.energy_refined.qty`: **`4` → `5`**.
   - Max wild Shipping `energy_refined` charges increases from **`372 → 620` charges (`+66.67%`)**, matching multi-Elder Signature weapon usage across the 72h Ragnarok finale.
5. **Recycler Anti-Arbitrage Check (`M2-F14`):**
   - Re-verified across all 9 active recyclable probes (`iron_pick`, `iron_axe`, `iron_sword`, `industrial_pick`, `industrial_axe`, `reinforced_spear`, `mechanical_gear`, `metal_pipe`, `metal_blade`): **`0` `OVER_RETURN`** post-M3.
