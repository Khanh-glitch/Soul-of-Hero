# Milestone M2 Report — Full Economic Simulation & Structural Audit

**Repository Branch:** `arena/f561fd0d-soul-of-hero` (branched from `main` @ `82089fea`)  
**Audit Engine:** `web/src/game/economic-sim-audit.ts` (`soh.economic-sim-audit.v1`)  
**Verification Suite:** `web/tests/economic-network-m2.test.ts` (**8/8 Vitest suites passing**)  
**Audit Timestamp Anchor:** `2026-11-11T00:00:00.000Z` (`BASE_AUDIT_NOW`)  
**Machine-Readable Evidence:** `web/reports/economic-network/M2_SIMULATION_RESULTS.json`  
**Build & Type Verification:** `npm run typecheck && npm run typecheck:tests && npm run build` (exit `0`)

---

## 1. Executive Summary

Milestone M2 executes deterministic headless simulations of the live **Soul of Hero (SOH)** runtime engine across both **Shipping (`shipping_fresh`, 200×200 tiles)** and **Veyra (`veyra05-world`, 12 scene windows totaling 480,000 sampled tiles + 81 POIs)** over the full **336-hour (14-day) wipe horizon** and **72-hour final Ragnarok window (`264h–336h`)**, alongside **$N = 400$ seeded Monte Carlo runs** ($200$ Shipping + $200$ Veyra) and **16 live code-proven structural findings** (`3` CRITICAL, `5` HIGH, `5` MEDIUM, `2` LOW, `1` INFO).

### Key Verification Ledger

| Suite | Scope | Runtime Verification | Headline Empirical Result |
|---|---|---|---|
| **Suite 1** | Dual-World Endowments (`Shipping` 40k tiles vs `Veyra` 12 scenes / 480k tiles + 81 POIs) | Pass | All 19 wild source types present on both modes (`missingSampledSources: []`), including `palm: 66` on Veyra; however Veyra spawns **0/8** static Creator Cores (Shipping spawns **8**), **23/24** authored chests (`po_greywater` Tackle Box dropped), **57/58** archetype POIs (`po_glade` dropped), **0** legacy creature spawns (`wolf/toad/crawler/beetle/crab`), and severe regional ore skew (`sulfur` in 1/12 scenes, `crystal` in 2/12). |
| **Suite 2** | 5 Multi-Day Player Archetypes (`0h–336h`) | Pass | `fortifier14Day` consumed **288** items (Shipping, 12 structs) vs **379** items (Veyra, 15 structs); `casualOffline14Day` suffered **14** overnight deaths with `0` collapses; Journey Requisitions mint **588** `securedCash` / 14d (**7.74×** the `76` `VENDOR_SECURED` cap); Research gates Tier-3 `core_*` behind **104** `spares` across 26 non-core recipes. |
| **Suite 3** | Territory Upkeep Stress Matrix (5 presets × 336h) | Pass | 24-slot Cabinet autonomy drops from **384h** (`Starter_2x2_Wood`, 20 structs, 4 mats) and **97.63h** (`Standard_4x4_Plank`, 56 structs, 7 mats) to **33.98h** (`Stone_Keep_5x5`, 86 structs, 9 mats) and **31.22h** (`Brick_Citadel_6x6_Armed`, 127 structs, 9 mats); daily discrete ceiling rounds fractional rates up (+0.5 to +2.5 extra items/material/14d). |
| **Suite 4** | Seasonal Offline `settle()` Envelope (4 seasons × 40 runs) | Pass | All 4 calendar seasons verified. Both `Unsheltered_Open` and `Sheltered_With_Lit_Campfire_10Wood` survive **8h** (`hp=100`, `thirst=50` [44.25 summer]) and die by **24h** (`hp=0, thirst=0`, campfire fuel exhausted); `Supplied_Bed_Rest_24h` (`startRest()`) survives **8h** and **24h** in all 4 seasons at `hp=100`. |
| **Suite 5** | Fuel, Refinery, Base Generator, Motorbike & Idle Leak | Pass | `base_generator` burns `fuel_can` in **60s/load** (`3×` faster than `180s` POI generator; worse than `coal` **80s** and `fuel_briquette` **90s**); 14d 1-load operation demands **20,160** `fuel_can` vs **19.6** expected cans from an entire Shipping run (**1,028.57× deficit**). Idle `campfire` burns **30 wood / 10 min** forever when loaded vs `0` on `furnace`. |
| **Suite 6** | 336h `stepHusbandry` (4 Species) & 4-Season Garden | Pass | All **4** tamable species (`boar`, `deer`, `hare`, `grouse`) scale from 1 pair to pen cap `5` (**3 births/14d**), producing **80** `fiber` (`deer`), **30** `fur` (`hare`), **20** `grouse_egg` (`grouse`), `0` renewable (`boar`); `animal_feed` multiplies seed nutrition **9.5×** (`12 → 114`); `Sunroot` scales from **261s** (summer) to **541s** (winter). |
| **Suite 7** | $N = 400$ Seeded Monte Carlo (`200` Shipping + `200` Veyra) | Pass | Shipping airdrops mean **3.59** `fuel_can`, **7.21** `energy_refined`, **6.72** `iron_ingot`, **3.45** `iron_sword`; Veyra yields **0** airdrops, **0** `damaged_drive` on 80 wreck hits, and `p50 = 0` (`mean = 48.75`) iron / `p50 = 0` (`mean = 40.75`) crystal across the 4 official spawn scenes. |
| **Suite 8** | Anti-Arbitrage, Conservation & Exploit Probes (`M2-F01`..`M2-F16`) | Pass | **0/9** live recycler recipes exhibit `OVER_RETURN` (closed by `X:recover-v3`); **17** structure-ingredient pairs charge 100% repair cost on 25% HP loss; `claimMinDistFromPoi` (`10`) bypassed at distance **9** (`[100, 111]`); `oil_pump` skipped offscreen on Veyra. |

---

## 2. Suite 1: Global Resource & Loot Endowment (`Shipping` vs `Veyra05`)

### 2.1 Terrain, Wild Source Stocks, and Regional Skew

`shipping_fresh` spans **40,000 tiles** (`200×200`, `freshWaterTiles: 1,286`, `coldTiles: 10,000`), while Veyra was sampled across **12 scene windows** (`12 × 40,000 = 480,000` tiles around all official scenes).

| Source Key | Shipping Nodes | Shipping Stock Units | Veyra Sampled Nodes (12 Scenes) | Critical Parity / Skew Note |
|---|---|---|---|---|
| `oak` / `pine` / `snowpine` / `willow` / `palm` | `932 / 33 / 200 / 33 / 20` | `5,592 / 165 / 1,000 / 132 / 80` | `14,953 / 1,074 / 3,276 / 1,234 / 66` | `palm` DOES spawn on Veyra (`66` nodes on warm `code === 9` windows: `westmouth` 17, `gulf` 23, `saltwick` 26). |
| `rock` | `295` | `1,770` | `5,629` | Abundant everywhere (`140–963` nodes per scene). |
| `grass` / `bush` / `herb` / `reed` / `mushroom` | `895 / 438 / 110 / 90 / 18` | `1,790 / 1,314 / 220 / 270 / 36` | `11,111 / 6,624 / 1,636 / 3,188 / 779` | Baseline food/fiber abundant. |
| `iron` | `43` | `215` (`iron_ore`) | `1,307` (`6,535` units) | **Hyper-skewed:** present in only **5/12** scenes (`slag` 761, `saltwick` 251, `gulf` 195, `greyback` 51, `argus` 49); **0** in `greywater`, `westmouth`, `hook`, `elderwood`, `delta`, `cinder`, `mirage`. |
| `coalv` | `30` | `150` (`coal`) | `741` (`3,705` units) | **0** in 6/12 scenes (`greywater`, `elderwood`, `westmouth`, `hook`, `delta`, `mirage`). |
| `crystal` | `31` | `93` (`crystal`) | `468` (`1,404` units) | Exists in only **2/12** scenes (`argus` 305, `hook` 163); **0** at standard spawns `greywater`, `westmouth`, `gulf`. |
| `sulfur` | `35` | `105` (`sulfur`) | `540` (`1,620` units) | Exists in only **1/12** scenes (`cinder` 540); **0** in the other 11 scenes. |
| `salt_shale` | `80` | `320` (`raw_salt`) | `215` (`860` units) | Coastal scenes only (`saltwick` 108, `westmouth` 67, `gulf` 40). |
| `scrap` / `wreck` | `25 / 10` | `100 / 80` | `480 / 96` (`2,880 / 768` units) | `wreck` drops `damaged_drive` on Shipping (`0.2/hit` expected `16`), **0** on Veyra (`wreckEconomy: 'direct-v1'`). |

#### Veyra 12-Scene Per-Window Resource Breakdown

| Scene Window (`veyra05-*`) | `iron` | `coalv` | `crystal` | `sulfur` | `rock` | `oak` | `pine` | `snowpine` | `palm` | `wreck` | `salt_shale` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `greywater` | 0 | 0 | 0 | 0 | 140 | 1,794 | 0 | 0 | 0 | 7 | 0 |
| `elderwood` | 0 | 0 | 0 | 0 | 272 | 3,694 | 0 | 0 | 0 | 2 | 0 |
| `westmouth` | 0 | 0 | 0 | 0 | 472 | 691 | 0 | 0 | 17 | 11 | 67 |
| `hook` | 0 | 0 | 163 | 0 | 490 | 552 | 0 | 1,189 | 0 | 5 | 0 |
| `gulf` | 195 | 75 | 0 | 0 | 583 | 310 | 0 | 0 | 23 | 4 | 40 |
| `delta` | 0 | 0 | 0 | 0 | 217 | 3,531 | 0 | 0 | 0 | 24 | 0 |
| `greyback` | 51 | 28 | 0 | 0 | 429 | 2,899 | 1,060 | 0 | 0 | 0 | 0 |
| `cinder` | 0 | 264 | 0 | 540 | 575 | 8 | 5 | 0 | 0 | 0 | 0 |
| `argus` | 49 | 12 | 305 | 0 | 642 | 20 | 9 | 2,087 | 0 | 8 | 0 |
| `mirage` | 0 | 0 | 0 | 0 | 302 | 0 | 0 | 0 | 0 | 24 | 0 |
| `slag` | 761 | 263 | 0 | 0 | 963 | 0 | 0 | 0 | 0 | 5 | 0 |
| `saltwick` | 251 | 99 | 0 | 0 | 544 | 1,454 | 0 | 0 | 26 | 6 | 108 |

### 2.2 Static Loot, Blueprints, Creator Cores, Cash & Creatures

- **Static Creator Cores:** Shipping places **8 static Creator Cores** (`core_fire`, `core_dragon`, `core_demon`, `core_storm`, `core_meteor`, `core_frost`, `core_elsa`, `core_mjolnir` — 1 each across `shipping` chests and `CREATOR_LOOT_V1`). **Veyra spawns 0 static Creator Cores (`staticCores: {}`).**
- **Static Blueprints:** Shipping spawns **8 blueprints** (`arrow`, `bow`, `brick`, `core_earth`, `fur_cloak`, `gas_mask`, `leather_armor`, `stew`), whereas Veyra spawns **6 blueprints** (omitting `arrow` and `core_earth`).
- **Static `rcash`:** Shipping holds **325** `rcash` across `7` cash containers (plus `1` keycard vault & `1` power door); Veyra holds **275** `rcash` across `6` POIs (`0` keycard/power doors).
- **81-POI Integrity:** Across all `81` Veyra POIs (`9` ordinary habitats, `4` side-boss sites, `6` primordial sites):
  - Authored caches materialized: **23 / 24** (`po_greywater` Tackle Box collides with Cottage Ladder at `(1642, 1176)`).
  - Archetype loot POIs materialized: **57 / 58** (`po_glade` paints `T.ROAD` instead of `T.FLOOR`, silently dropping its cache).
- **Static Creature Spawns (`Shipping` vs `Veyra`):** Shipping initializes `77 boar`, `45 wolf`, `13 beetle`, `7 crawler`, `6 toad`, `2 crab`, and `6 elders`. Across all 12 Veyra scenes, wild respawners spawn only `['boar', 'deer', 'hare', 'grouse', 'fox']` — **zero** `wolf`, `toad`, `crawler`, `beetle`, or `crab`.

---

## 3. Suite 2: Multi-Day (`0h–336h`) Player Archetype Simulations

Simulated identically against both `shipping_fresh` and `veyra05-world`:

1. **`casualOffline14Day` (12 placed structures, 2h/day play + 22h offline over 14 days):**
   - Both Shipping and Veyra logged **14 deaths in 14 days** (`0` structure collapses while kept stocked), ending at `hp: 0`, `hunger: 28.69`, `thirst: 0`, `finalPhase: 'expired'`, consuming **182** `wood` and **14** `stone` upkeep.
2. **`fortifier14Day` (14-day continuous base operation under `stepTerritory`):**
   - **Shipping (`12` covered structs):** daily upkeep `wood: 14.25, fiber: 5, stone: 1.25`; actual 14d engine debits = `wood: 200, fiber: 70, stone: 18` (**288** total items).
   - **Veyra (`15` covered structs):** daily upkeep `wood: 16.75, fiber: 5, stone: 1.25, brick: 1.5, iron_ingot: 1.5, mechanical_parts: 0.5, fasteners: 0.5`; actual 14d engine debits = `wood: 235, fiber: 70, stone: 18, brick: 21, iron_ingot: 21, mechanical_parts: 7, fasteners: 7` (**379** total items).
3. **`motorbikeKinematics` (Scavenger/Hauler):**
   - On both modes: road speed **390 px/s**, unloaded tank range **6,000 px**, loaded road tank range **250 tiles**, loaded road range per `fuel_can` **83 tiles**, tank wear **32** units/loaded tank. Diverges in wreck economy (`recycler-v1` + `supportsAirdrops: true` on Shipping vs `direct-v1` + `supportsAirdrops: false` on Veyra).
4. **`researchAndCoreGate` (Completionist):**
   - Out of **89** total recipes, **54** are known at start and **35** are unknown (**26** non-core + **9** `core_*`; only `chitin_armor` is Tier-3 non-core).
   - Because `engine.ts:2383` excludes `core_*` from random research until all non-core recipes are learned (`unknown.filter(k => !k.startsWith('core_'))`), discovering the first random Core requires **104 `spares`** (all 26 non-core random rolls at `4` spares each), **140 `spares`** to exhaust all 35 via random research, or **265 `spares`** via mixed directed Tier 1–2 (`25 × 9 = 225`) + Tier-3 random (`10 × 4 = 40`).
5. **`currencySplit` (Journey Requisitions vs In-Run Escrow):**
   - Vendor total stock caps out at **76 `securedCash`** (`VENDOR_SECURED`) and **59 `spares`** (`VENDOR_SPARES`) per run.
   - Daily Journey Requisitions mint **42 `securedCash`/day = 588 `securedCash`/14d** (**7.74×** the vendor cap), directly into `gs.profile.securedCash` without needing `escrow_chest` or surviving Ragnarok.
   - **Live Day-1 Probe (`2026-11-11`):** Authentic gameplay dispatches (`build`, `craft`, `useItem`, `repairStructure`) legitimately earned `>= 25` authoritative daily points and claimed `ember`: `emberClaimOk: true`, `"+5 Secured Cash · 3× Bandage, 3× Roast Meat"`, `securedAfter: 5`.

---

## 4. Suite 3: Territory Upkeep Stress Matrix (`336h` Full Wipe)

With `BAL.territory.upkeepFractionPerDay = 0.25` (**350%** cumulative cost over 14 days), a 24-slot Territory Cabinet collapses on autonomy long before 14 days as structure material diversity grows:

| Preset Base | Structures | Upkeep Material Types | 24-Slot Max Autonomous Hours | Exact 14d Upkeep | Actual 14d Discrete Engine Debits | Rounding Overcharge |
|---|---:|---:|---:|---|---|---:|
| `Starter_2x2_Wood` | 20 | 4 | **384.00 h** | `wood 315, stone 28, rope 3.5, fiber 105` | `wood 315, stone 28, rope 4, fiber 105` | `+0.5` rope |
| `Standard_4x4_Plank` | 56 | 7 | **97.63 h** | `wood 619.5, stone 105, plank 147, rope 7, fiber 315, iron_ingot 17.5, spares 21` | `wood 620, stone 105, plank 147, rope 7, fiber 315, iron_ingot 18, spares 21` | `+0.5` wood, `+0.5` iron_ingot |
| `Stone_Keep_5x5` | 86 | 9 | **33.98 h** | `wood 490, stone 1186.5, iron_ingot 73.5, brick 283.5, spares 38.5, mechanical_parts 10.5, glass 7, fiber 56, rope 7` | `wood 490, stone 1187, iron_ingot 74, brick 284, spares 39, mechanical_parts 11, glass 7, fiber 56, rope 7` | `+0.5` each on 5 mats (`2.5`) |
| `Brick_Citadel_6x6_Armed` | 127 | 9 | **31.22 h** | `wood 539, stone 913.5, brick 861, iron_ingot 185.5, mechanical_parts 84, fasteners 87.5, spares 94.5, glass 7, fiber 35` | `wood 539, stone 914, brick 861, iron_ingot 186, mechanical_parts 84, fasteners 88, spares 95, glass 7, fiber 35` | `+0.5` each on 4 mats (`2.0`) |
| `Solo_Outpost_Zero_Wood_CabinetOnly_Plus_Stations` | 21 | 7 | **161.50 h** | `wood 143.5, stone 374.5, iron_ingot 38.5, brick 63, mechanical_parts 21, spares 31.5, glass 7` | `wood 144, stone 375, iron_ingot 39, brick 63, mechanical_parts 21, spares 32, glass 7` | `+0.5` each on 4 mats (`2.0`) |

*Finding:* A 127-structure mid/late-game citadel collapses in **31.22 hours** even when stuffed completely to 24 slots, forcing sub-daily logins purely to refill stone/brick slots.

---

## 5. Suite 4: Seasonal Offline Settlement Envelope (`4` Seasons × `40` Cases)

All 40 scenarios verified exact calendar season alignment (`calendarSeasonVerified === season`). Thirst (`16h` base survival limit) dominates every un-rested offline outcome:

| Scenario | Offline Horizon | Spring (`endHp` / `thirst` / `hunger`) | Summer (`endHp` / `thirst` / `hunger`) | Autumn (`endHp` / `thirst` / `hunger`) | Winter (`endHp` / `thirst` / `hunger`) | Outcome |
|---|---|---|---|---|---|---|
| `Unsheltered_Open` | `8h` | `100` / `50.0` / `66.67` | `100` / `44.25` / `66.67` | `100` / `50.0` / `66.67` | `100` / `50.0` / `66.67` | Survives (`warmth 77.28` in spring) |
| `Unsheltered_Open` | `24h / 72h / 168h` | `0` / `0` / `28.37` | `0` / `0` / `35.25` | `0` / `0` / `28.37` | `0` / `0` / `28.37` | **Dies by 24h** |
| `Sheltered_With_Lit_Campfire_10Wood` | `8h` | `100` / `50.0` / `66.67` (`fire=0`) | `100` / `44.25` / `66.67` (`fire=0`) | `100` / `50.0` / `66.67` (`fire=0`) | `100` / `50.0` / `66.67` (`fire=0`) | Survives; 10 wood burns dry (`fire=0`) |
| `Sheltered_With_Lit_Campfire_10Wood` | `24h / 72h / 168h` | `0` / `0` / `28.37` (`fire=0`) | `0` / `0` / `35.25` (`fire=0`) | `0` / `0` / `28.37` (`fire=0`) | `0` / `0` / `28.37` (`fire=0`) | **Dies by 24h** |
| `Supplied_Bed_Rest_24h` (`startRest`) | `8h` | `100` / `50.0` / `66.67` | `100` / `44.25` / `66.67` | `100` / `50.0` / `66.67` | `100` / `50.0` / `66.67` | **Survives (`restStarted=true`)** |
| `Supplied_Bed_Rest_24h` (`startRest`) | `24h` | `100` / `40.0` / `34.0` | `100` / `52.75` / `34.0` | `100` / `40.0` / `34.0` | `100` / `40.0` / `34.0` | **Survives (`restStarted=true`)** |

*Critical UX Gap:* Without invoking `startRest()` on a supplied bed/chest, any offline gap of **24h** is a **100% deterministic wipe death** in every season, even inside a lit, sheltered room.

---

## 6. Suite 5: Fuel, Refinery, Power Generator & Motorbike Energy Budget

### 6.1 Fuel Items vs 3-Slot `base_generator` Capacity

| Fuel Key | Fuel Runtime / Unit | `stationBurnable` | Max Stack | 3-Slot Generator Autonomy (1 Load) | 24h Demand (1 Load) | 24h Demand (2 Loads) |
|---|---:|:---:|---:|---:|---:|---:|
| `fuel_briquette` | **90s** | Yes | 30 | **135 min** | 960 | — |
| `coal` | **80s** | Yes | 40 | **160 min** | 1,080 | 2,160 |
| `charcoal` | **55s** | Yes | 60 | **165 min** | — | — |
| `fuel_can` | **60s** | **No** | 5 | **15 min** | **1,440** | **2,880** |
| `wood` | **20s** | Yes | 60 | **60 min** | 4,320 | — |
| `fiber` | **4s** | Yes | 80 | **16 min** | — | — |

### 6.2 Refinery Conversion Ratios & Run Oil Ceiling

| Recipe | Inputs | Outputs | `salvaged_oil` per Can | Generator Sec per Oil |
|---|---|---|---:|---:|
| `furnace_single` | `3 salvaged_oil + 1 glass` | `1 fuel_can` | `3.0` | `20s` |
| `refinery_single` | `3 salvaged_oil + 1 glass` | `1 fuel_can` | `3.0` | `20s` |
| `refinery_batch` | `5 salvaged_oil + 1 glass` | `2 fuel_can` | **`2.5`** | **`24s`** |
| `refinery_industrial` | `6 salvaged_oil + 1 glass` | `2 fuel_can + 1 lubricant` | `3.0` | `20s` |

- **Total Shipping Run Fuel Ceiling:** `80` wreck stock units yield `28` expected `salvaged_oil` (`+ 4` from vendor = **32 `salvaged_oil`**) + `4.8` direct wreck cans + `2` static cans = **19.6 total `fuel_can`** under optimal `refinery_batch` (`1,633` loaded road motorbike tiles total).
- **Structural Deficit:** Running just **1 wired electrical load** continuously on `fuel_can` for 14 days requires **20,160** `fuel_can` — **`1,028.57×` more oil than exists in the entire Shipping map**. Even 1 single day needs `1,440` cans, and **POI generators run `3×` longer per canister (`180s` vs `60s`)** than the player's own `base_generator`.
- **Idle Fuel Leak Probe:** Over `10 minutes` on an empty queue, `campfire` burned **30 `wood`** (`campfireBurnsIdleForeverWhileLoaded: true`) vs **`0` `wood`** burned by an idle `furnace`.

---

## 7. Suite 6: Husbandry (`336h`) & 4-Season Garden Yields

### 7.1 Live 14-Day Livestock Pen Simulation (`penTiles = 16`, `penCapacity = 5`)

| Species | Starting Pair | Births (14d) | End Alive | Feed Consumed (14d) | Renewable 14d Outputs | Adult Butcher Yields | Feedings to Tame |
|---|---|---:|---:|---:|---|---|---:|
| `boar` | 2 | **3** | 5 | 170 | `{}` *(butcher only)* | `meat: 5, hide: 2, boar_tusk: 2` | 2 |
| `deer` | 2 | **3** | 5 | 205 | **`fiber: 80`** | `meat: 5, hide: 3` | 2 |
| `hare` | 2 | **3** | 5 | 206 | **`fur: 30`** | `meat: 2, fur: 2` | 1 |
| `grouse` | 2 | **3** | 5 | 203 | **`grouse_egg: 20`** | `meat: 2, feather: 3` | 1 |

- **Fodder Multiplier (`animal_feed`):** Crafting `3 fiber` (`0` livestock nutrition) + `1 seed` (`12` raw nutrition) produces `3 × animal_feed` at `38` nutrition/unit = **114 total nutrition** (**`9.5×` raw seed multiplier**).

### 7.2 4-Season Garden Harvest Times (Water Maintained Before Dryout)

| Season | `Sunroot` (`crop`, base `300s`, yields `3 crop + 2 seed`) | `Bitterleaf` (`herb`, base `600s`, yields `3 herb + 1 seed`) |
|---|---:|---:|
| `spring` | **291s** | **591s** |
| `summer` | **261s** | **661s** |
| `autumn` | **331s** | **571s** |
| `winter` | **541s** | **741s** |

---

## 8. Suite 7: $N = 400$ Monte Carlo Outcome Distributions

### 8.1 Shipping Monte Carlo ($N = 200$ Seeded Runs)

| Stochastic Variable | Min | P10 | P50 | P90 | Max | Mean |
|---|---:|---:|---:|---:|---:|---:|
| `airdropFuelCans` (14 events max/run) | 0 | 2.0 | 3.0 | 6.0 | 8 | **3.59** |
| `airdropEnergyRefined` | 0 | 2.0 | 8.0 | 12.0 | 18 | **7.21** |
| `airdropIronIngot` | 0 | 3.8 | 6.0 | 12.0 | 16 | **6.72** |
| `airdropIronSword` | 0 | 1.0 | 3.0 | 6.0 | 9 | **3.45** |
| `wreckSpares` (80 total wreck hits) | 14 | 19.0 | 24.0 | 30.0 | 37 | **24.24** |
| `wreckSalvagedOil` (80 hits) | 17 | 22.0 | 28.0 | 34.1 | 43 | **27.96** |
| `wreckDamagedDrives` (80 hits) | 7 | 11.0 | 16.0 | 20.1 | 28 | **16.14** |
| `wreckDirectFuelCans` (80 hits) | 1 | 2.9 | 5.0 | 7.0 | 11 | **4.91** |
| `ironVeinRichOre_IronPick` (100 iron hits) | 2 | 4.0 | 8.0 | 12.0 | 17 | **7.95** |
| `ironVeinRichOre_Salvager` (100 iron hits) | 4 | 8.0 | 12.0 | 16.0 | 20 | **12.02** |
| `lootEcologySparesCycle0` | 6 | 10.0 | 12.0 | 14.2 | 18 | **11.98** |
| `lootEcologyFastenersCycle0` | 0 | 0.0 | 3.0 | 6.0 | 6 | **3.04** |
| `lootEcologyFieldRepairCycle0` | 0 | 0.0 | 1.5 | 3.0 | 3 | **1.48** |
| `randomResearchCostForCore_spares` | 108 | 108.0 | 108.0 | 108.0 | 108 | **108.00** |
| `dailyPointsDay1` | 55 | 55.0 | 55.0 | 55.0 | 55 | **55.00** |

### 8.2 Veyra Monte Carlo ($N = 200$ Seeded Runs + Local Spawn Sampling)

| Stochastic Variable | Min | P10 | P50 | P90 | Max | Mean |
|---|---:|---:|---:|---:|---:|---:|
| `airdropEvents` | 0 | 0 | **0** | 0 | 0 | **0.00** |
| `wreckDamagedDrives80Units` | 0 | 0 | **0** | 0 | 0 | **0.00** |
| `wreckSpares80Units` (`direct-v1`) | 45 | 51.9 | 56.0 | 62.0 | 67 | **56.53** |
| `wreckSalvagedOil80Units` | 17 | 22.0 | 27.0 | 33.0 | 41 | **27.51** |
| `localSpawnWindowIronNodes` | 0 | 0 | **0** | 195 | 195 | **48.75** |
| `localSpawnWindowCrystalNodes` | 0 | 0 | **0** | 163 | 163 | **40.75** |
| `localSpawnWindowWreckNodes` | 4 | 4.0 | 6.0 | 11.0 | 11 | **6.75** |
| `localSpawnWindowCreatures` (4 spawn scenes) | 23 | 23.6 | 27.5 | 31.4 | 32 | **27.50** |

*Critical Finding:* Across official Veyra spawn windows, **median (`p50`) local iron = `0` and median (`p50`) local crystal = `0`**, forcing spawn-window players (`greywater`, `westmouth`, `hook`) onto multi-window travel just for Tier-2 iron or Tier-3 crystal — while **0** `damaged_drive` drops and **0** airdrops deprive Veyra of Shipping's top progression accelerators.

---

## 9. Suite 8: Complete Structural Findings Register (`M2-F01` – `M2-F16`)

### Anti-Arbitrage & Conservation Proofs

- **Recycler Integrity (`M2-F14`):** All **9** active recyclable probes (`iron_pick`, `iron_axe`, `iron_sword`, `industrial_pick`, `industrial_axe`, `reinforced_spear`, `mechanical_gear`, `metal_pipe`, `metal_blade`) pass `industrial-proof.ts` with **`0` `OVER_RETURN`** under live `X:recover-v3`, `X:recover-v1`, and component rules (`iron_sword`: craft IE `5.0` vs high-recovery `2.333`). Historical `X:recover-v2` (confirmed broken on `iron_sword` [11.0 vs 5.0], `iron_pick` [6.167 vs 3.0 + minted coal], `iron_axe` [6.0 vs 3.0 + minted coal], `industrial_axe`) is quarantined to pre-patch saved jobs only.
- **Discrete Repair vs Reclaim Parity (`M2-F13`):** `structureRepairCost` uses `Math.max(1, Math.ceil(q * 0.25))` against `BAL.economy.reclaimRefund = 0`, charging **100% rebuild material cost** on **17** qty=1 ingredients (`wall_stone.wood`, `door_wood.rope`, `research.iron_ingot`, `barrel.rope`, `feed_trough.rope`, `power_cable.{iron_ingot,fiber}`, `power_switch.{iron_ingot,fasteners,spares}`, `pressure_switch.{iron_ingot,mechanical_parts,fasteners}`, `ir_sensor.{mechanical_gear,iron_ingot}`, `bear_trap.mechanical_gear`, `torch_post.torch`).

### Full 16-Finding Audit Ledger

| ID | Severity | Category | Title & Code Reference | Verified Simulation Proof |
|---|---|---|---|---|
| **M2-F01** | **CRITICAL** | `VEYRA_PARITY_AND_DEAD_CONTENT` | Legacy Creature Biome Gap Breaks Chitin Armor, Spirit Essence & Demon Core on Veyra (`engine.ts:261-273`, `veyra05/ecosystem.ts`, `catalog.ts`) | `VEYRA_BIOME_CREATURE` omits `wolf`, `toad`, `crawler`, `beetle`, `crab`. `0` spawn across all 12 Veyra scenes, giving `chitin` / `chitin_armor` **zero** drop path on Veyra and breaking `crawler_optic` / `beetle_horn` drops. |
| **M2-F02** | **CRITICAL** | `VEYRA_WORLD_GEOMETRY_BUG` | `po_greywater` Tackle Box Collision & `po_glade` `T.ROAD` Paving Drop Authored/Archetype Caches (`sites.ts:67,110`, `rest48.ts:112-118`, `plan.ts:133`, `floors.ts:375`) | **23/24** authored caches (`po_greywater` Tackle Box overwrote/lost at Cottage Ladder `(1642, 1176)`) and **57/58** archetype POIs (`po_glade` painted `T.ROAD`, failing `pickCell()` `T.FLOOR` check). |
| **M2-F03** | **CRITICAL** | `VEYRA_PROGRESSION_GAP` | Veyra Lacks Airdrops, Loot Ecology, Recycler & `CREATOR_LOOT_V1` Core Guarantees (`airdrop.ts:7`, `engine.ts:199`, `world.ts:90`, `creator-loot.ts`) | Shipping gets `14` airdrops, `LOOT_GRAMMAR_CURRENT` (`b05-v1`), physical Recycler, and **8** static Creator Cores (`staticCores: 8`); Veyra gets **0** airdrops, `undefined` loot ecology, **0** Recycler, and **0** static Creator Cores (`staticCores: {}`), plus omits static `arrow`/`core_earth` blueprints. |
| **M2-F04** | **HIGH** | `CURRENCY_DESIGN_FLAW` | Journey Requisitions Mint `7.7×` Entire Run Vendor Cap Off-Map, Bypassing Ragnarok & Escrow (`balance.v1.json:journeyRequisitions`, `catalog.ts:VENDOR_SECURED`, `engine.ts:1941`) | Daily Requisitions mint `+42 securedCash/day` (**588/14d**) directly into `profile.securedCash`, bypassing physical `rcash`, 72h Ragnarok gating, and `escrow_chest` (vs `76` `VENDOR_SECURED` total run cap — **`7.74×`** ratio). Verified live on `2026-11-11` (`emberClaimOk: true`, `+5 Secured Cash`). |
| **M2-F05** | **HIGH** | `ENERGY_ECONOMY_BROKEN` | Base Generator Burns `1` `fuel_can` in `60s` (`3×` Faster Than POI Gen, Worse Than Coal/Briquette) (`engine.ts:867-874`, `catalog.ts:fuel_can`, `balance.v1.json:poiAccess`) | `base_generator` consumes `fuel_can` in `60s/load` (`15m` max 3-slot run) vs `80s` (`coal`) & `90s` (`fuel_briquette`) & `180s` (POI gen). 14d 1-load operation requires `20,160` `fuel_can` (**1,028.57×** total Shipping `32 salvaged_oil` supply). |
| **M2-F06** | **HIGH** | `RESEARCH_BOTTLENECK` | Random Research Excludes All 9 `core_*` Recipes Until All 26 Non-Core Recipes Are Exhausted (`engine.ts:2383`, `catalog.ts:permitsDirectedResearch`) | `pool = unknown.filter(k => !k.startsWith('core_'))` plus Tier-3 directed research block requires burning **104 `spares`** (26 rolls) before the first random `core_*` roll can occur (`265 spares` mixed / `140` all-random). |
| **M2-F07** | **HIGH** | `UI_WIRING_DEFECT` | Classic `BuildPanel` Omits `ir_sensor` and `bear_trap` From `BUILD_ORDER` Filter (`catalog.ts:450`, `panels.tsx:411,420`) | `BUILD_GROUPS.Defense` references `ir_sensor` and `bear_trap`, but `panels.tsx:420` filters `BUILD_ORDER` where both keys are omitted; classic UI silently hides both defense structures. |
| **M2-F08** | **HIGH** | `UNENFORCED_TERRITORY_RULE` | `BAL.economy.claimMinDistFromPoi` (`10` Tiles) Declared in `balance.v1.json` But Unchecked in `buildReason()` (`balance.v1.json:169`, `engine.ts:1428-1458`) | Live `dispatch` probe placed `floor_wood` + Territory Cabinet at **`dist = 9` tiles** (`[100, 111]`, `< 10`) from Crossroads Trading Post with zero error. |
| **M2-F09** | **MEDIUM** | `VEYRA_REGIONAL_RESOURCE_SKEW` | Strategic Ores on Veyra Hyper-Concentrated into Isolated Windows (`veyra05/window.ts`, `world-economy.ts:68`, `veyra05/scenes.ts`) | Across 12 scenes: `sulfur` in **1/12** (`cinder`), `crystal` in **2/12** (`hook`, `argus`), `iron` in **5/12**; `westmouth` & `greywater` spawns have **0** `iron`, `coal`, `crystal`, `sulfur` (`palm=66` does spawn on `code=9` coastal tiles). |
| **M2-F10** | **MEDIUM** | `TERRITORY_UPKEEP_SCALING` | Territory Upkeep (`25%/day = 350%` over 14d) Bills Fractional Rare Parts & Overflows 24-Slot Cabinets (`balance.v1.json:territory`, `engine.ts:520-620`) | 24-slot cabinet autonomy drops to **33.98h** (`Stone_Keep_5x5`) and **31.22h** (`Brick_Citadel_6x6_Armed`) because all 9 billed materials compete inside 24 stack-limited slots; ceil billing overcharges fractional units. |
| **M2-F11** | **MEDIUM** | `FUEL_LEAK_AND_UI_COPY` | Campfire Burns Loaded Fuel 24/7 When Idle & Tooltip Claims Stale `2h` Decay (`engine.ts:2461`, `Game.tsx:825`, `journey.ts:81`, `balance.v1.json:166`) | Idle probe burned **30 `wood` in 10 min** on an empty `campfire` vs **`0` `wood`** on an empty `furnace`; UI text still states `"~2h"` unprotected collapse despite actual **`12h`**. |
| **M2-F12** | **MEDIUM** | `DISABLED_SYSTEM_STUB` | Oil Pump & Crude Petroleum Chain Permanently Disabled Outside Test Fixtures (`balance.v1.json:oilPumpV1`, `engine.ts:1413-1425,2365`) | `oil_pump`, `pump_crude`, and `refinery_crude` are always-known recipes (`ALWAYS_KNOWN_RECIPES`), yet `authorizedOilSource` rejects every non-`oilTestFixture` run in production. |
| **M2-F13** | **LOW** | `REPAIR_VS_REBUILD_PARITY` | Discrete `ceil(0.25*q)` Repair Charges 100% Material Cost on `qty=1` Components While Reclaim Refunds `0` (`engine.ts:624`, `balance.v1.json:economy`) | `17` structure-ingredient pairs (e.g., `wall_stone.wood`, `door_wood.rope`, `research.iron_ingot`, traps/wiring) charge 100% of that ingredient to repair 25% HP while reclaim yields `0`. |
| **M2-F14** | **INFO** | `ANTI_ARBITRAGE_VERIFIED` | Live Recycler v3 & Component v4 Rules Enforce Net-Loss Recovery (`recycler.ts`, `industrial-proof.ts`) | **0/9** live recycler probes exhibit `OVER_RETURN`; historical `X:recover-v2` arbitrage on 4 iron/industrial tools is closed cleanly. |
| **M2-F15** | **LOW** | `VEYRA_OFFSCREEN_SIM_ASYMMETRY` | `stepStations` Explicitly Skips `oil_pump` While Off-Window on Veyra (`engine.ts:2419`, `husbandry.ts:337`) | Offscreen Veyra probe yielded `0 crude_petroleum` and `0` stock consumption over 5s on `oil_pump`, unlike smelters, refineries, gardens, and livestock which step continuously offscreen. |
| **M2-F16** | **MEDIUM** | `ENDGAME_AMMO_AND_REFINED_ENERGY_GATE` | Refined Energy & Elemental Essences Tightly Bottlenecked by Wild Sulfur & Crystal Stocks (`catalog.ts:energy_refined`, `engine.ts:1645`) | `energy_refined` consumes `1 crystal + 1 iron_ingot` (yielding `4`), and `essence_fire` consumes `2 sulfur + 1 coal` (`2` out). Shipping holds only **93 `crystal`** (`372` `energy_refined` charges max) and **105 `sulfur`** total across the map (`468 crystal` / `540 sulfur` nodes sampled on Veyra). |

---

## 10. Handoff Targets for Milestone M3 (Rebalance Spec & Before/After Simulation)

Based strictly on verified M2 measurements, Milestone M3 (`M3_REBALANCE_SPEC.md`, `M3_BEFORE_AFTER_SIM.json`, `M3_RISK_REGISTER.md`) must design and quantify closed-form mathematical & structural interventions covering:
1. **Energy & Fuel Chain Realignment (`M2-F05`, `M2-F11`, `M2-F12`, `M2-F15`):** Rebalance `base_generator` burn durations (`fuel_can >= 360s` > `fuel_briquette` > `coal` > `wood`), stop idle `campfire` fuel burn when no roast recipe is queued, resolve or intentionally gate `oil_pump` / `salvaged_oil` supply for multi-day base power, and sync `2h → 12h` UI copy.
2. **Territory Upkeep & POI Protection (`M2-F08`, `M2-F10`, `M2-F13`):** Enforce `claimMinDistFromPoi` (`10`) in `buildReason()`, tune `upkeepFractionPerDay` / cabinet slot capacity / fractional-carry ledger so a 56–127 structure citadel retains **>= 72h–168h** cabinet autonomy without penalizing qty=1 repairs (`>= 1` reclaim refund / fractional repair bucket).
3. **Veyra Parity, World Loot & POI Geometry Fixes (`M2-F01`, `M2-F02`, `M2-F03`, `M2-F09`):** Fix `po_greywater` coordinate overlap and `po_glade` `T.FLOOR` patch; introduce Veyra drop paths (or beast-part substitutes) for `chitin`, `beetle_horn`, `crawler_optic`, `shell`; reconcile Creator Core / `core_earth` / `arrow` blueprint distribution and soften regional `iron`/`crystal`/`sulfur` deserts across spawn routes.
4. **Progression, Research & Currency Sink Integrity (`M2-F04`, `M2-F06`, `M2-F07`, `M2-F16`):** Reconcile `securedCash` minting (`588` vs `76` vendor stock — either add tiered `securedCash` sinks or curb off-map daily minting), allow `core_*` discovery in random research (or pity/milestone threshold without needing 104 spares first), restore `ir_sensor`/`bear_trap` into `BUILD_ORDER`, and evaluate late-game `crystal`/`sulfur` replenishment for Signature ammo.
