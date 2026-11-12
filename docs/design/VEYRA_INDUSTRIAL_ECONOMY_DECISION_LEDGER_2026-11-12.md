# VEYRA INDUSTRIAL ECONOMY — Decision ledger (2026-11-12)

**Status: DESIGN ONLY. No gameplay code implemented, no loot table approved, no agent implementation dispatched.**
**Verified code reference:** `arena/f561fd0d-soul-of-hero` @ `c6c6fc50471f9dff2633e6dcde00f2d342c8ce7e`.
**Source hierarchy:** `web/ref/bible.md` + latest explicit Creator decisions > historical Atlas v1–v11 > old proposals/reports. This design record is a working ledger, not an override of the Bible or a released game specification. Do not merge conflicting design documents as if all were current.

## 1. Creator-approved design decisions (LOCKED PRINCIPLE)

1. **Advanced industry must materially use meaningful intermediate components:** Metal Pipe, Mechanical Gear, Iron Plate and related products, not only generic Iron Ingot / Mechanical Parts / Spares.
2. **Maintain real sandbox alternatives:** self-produce, explore and recover an intermediate, recycle, or pursue another gameplay branch. No mandatory linear quest or compulsory boss for general survival and technology; no arbitrary new ingredient simply to extend a chain.
3. **Design first; implementation after explicit decisions.** Do not assign an agent to invent missing loot sources, rates, recipes, access conditions or industrial balance while the design is pending.
4. **Atlas v1–v11 is a historical research source for originating decisions/mechanics.** Original Last Island values must be version/mode scoped; historical archived proposed orders are not live implementation orders. The archive originals (13 base64 parts + restore script) have not been reconstructed and hash-verified during this review. Partial extracted v2/v4/v5/v10/v11 research was examined.

## 2. Verified current Web code facts, not runtime-play evidence

**Catalogue:** `web/src/game/catalog.ts`, `web/src/game/balance.v1.json`, `web/src/game/recycler.ts`, `web/src/game/engine.ts`.

- Metal Pipe: craft 2 refined iron ingot + 1 Mechanical Parts -> 1 Pipe (18s, workbench II); Recycler new jobs `X:pipe-v2`: 1 Refined Iron + 1 Mechanical Parts (12s), old saved `X:pipe-v1` remains 1 Refined Iron.
- Mechanical Gear: craft 2 Iron Ingots + 2 Mechanical Parts + 1 Fastener -> 1 Gear (20s, workbench II); Recycler `X:gear-v1`: 1 Iron Ingot + 2 Mechanical Parts (15s).
- Iron Plate: craft 2 Refined Iron + 1 Pipe + 1 Mechanical Parts -> 2 Plates (18s, workbench II). So **1 Plate in a requirement entails a whole 2-Plate batch** when starting with none, leaving 1 Plate as physical surplus. Plate is used to patch walls/doors by up to 25% max HP and to arm/rearm Bear Traps; no standard component Recycler recipe recorded.
- Metal Blade: craft 4 Iron Ingots + 1 Mechanical Parts -> 1 Blade (16s, workbench II); Recycler `X:blade-v1`: 2 Iron Ingots + 1 Mechanical Parts (14s).
- Mechanical Parts: 2 Scrap + 1 Iron Ingot -> 2 Parts (12s).
- Gear direct uses: `industrial_pick_geared` (1), `vehicle_drive_geared` (1), `ir_sensor` (1), `bear_trap` (1). Gear recycle is a distinct sink.
- Pipe direct uses: `vehicle_frame_piped` (1), `iron_plate` (1 per two plates); Pipe recycle is a distinct sink.
- Baseline self-crafting Motorbike without component alternatives: Frame (3 Iron +2 Parts+2 Spares), Drive (2 Iron+2 Parts+2 Fasteners+3 Spares), Motorbike kit (1 Frame+1 Drive+2 Iron+2 Fasteners), requiring Workbench III. **Gear and Pipe are not required by this baseline route.**
- Workbench III current upgrade: 6 Parts+8 Iron+8 Fasteners+12 Spares, no Gear or Plate. Field Generator current: 3 Iron+3 Parts+4 Spares+6 Wood. Generator *capacity upgrade already exists* (4 Parts+2 Iron+2 Fasteners+4 Spares, workbench II). Powered Door current: 4 Iron+2 Parts+3 Fasteners+3 Spares, HP350. Iron Door HP420.
- Concrete caution: `metal_pipe` catalogue description refers only to the old single-ingot recycler outcome, inconsistent with `X:pipe-v2`. Correct description at implementation time.

### Source-to-craft expansion: method and limits

Assume 1 Iron Ore -> 1 Iron Ingot; 3 Iron Ingots + 1 Coal -> 2 Refined Iron; batches are integral; 2 Scrap + 1 Iron Ingot -> 2 Mechanical Parts; 1 Iron Ingot + 1 Scrap -> 3 Fasteners. Sum job times **excluding** gathering, walking, fuel to run the furnace, all station building and upgrades, research, and actions. Record leftover outputs instead of treating them as lost.

| Target, self-craft | Minimum raw materials for this particular chosen expansion | Sequential processing time | Leftover |
| --- | --- | --- | --- |
| 1 Pipe | 4 Iron Ore, 2 Scrap, 1 Coal | 90s | 1 Mechanical Parts |
| 1 Gear | 4 Iron Ore, 3 Scrap | 82s | 2 Fasteners |
| 2 Plates | 7 Iron Ore, 2 Scrap, 2 Coal | 158s | none |
| 1 Blade | 5 Iron Ore, 2 Scrap | 78s | 1 Mechanical Parts |

Not a global cost-minimum optimization over every alternate route, different fuel/ore grade, salvage, and shared batches. Verified from recipe dependencies; **not tested in browser**.

## 3. Veyra industrial-source audit (verified static code, NOT natural play proof)

- `web/src/veyra05/arch/sites.ts` registers 33 directly plus 48 via `rest48.ts` = **81 authored POI IDs**. Six manually authored sites have their own placed caches: `po_greywater`, `po_academy`, `po_ironmine`, `po_hook`, `po_oasis`, `po_cindercamp`. Some other sites use special cash/vendor/evac roles, six Elder sites excluded from generic extra-cache. **58 remaining sites use a deterministic fallback cache only when the authored levels contain no loot**, based on 13 generic tables; this is a count by code branch, not 58 proof of physical access.
- `web/src/veyra05/floors.ts` 13 fallback tables include some Scrap/Parts/Fasteners but do **not** explicitly include Pipe/Gear/Plate/Blade.
- `web/src/game/loot-ecology.ts` B04/B05 higher grade toolbox pools DO include Pipe/Gear/Plate/Blade, but `engine.ts` only initializes the source ecology on `shipping_fresh`/`dev_delta_fresh`, not Veyra. **Do not claim those rolls work on Veyra.**
- `web/src/veyra05/arch/sites.ts` authored Ironholm Crane Cab Locker contains Mechanical Parts ×2 + Fasteners ×6 + repair kit; Greywater Smith's Chest Iron Ingots ×2 + Fasteners ×4 + Scrap ×4. These are actual authored item entries, not yet confirmed natural-play reachable.
- `web/src/game/engine.ts` `renewableLoot()` includes all authored items with category `res`/`food` except `damaged_drive`. **Any naive insertion of Pipe/Gear/Plate/Blade (all `res`) directly in ordinary authored stock causes them to be eligible for generic renewal.** A separate finite-vs-renewable custody contract is required.
- `engine.ts` processes depletion and cooldown; Veyra floor projection preserves global depletion keys by level/global coordinate. Upgrading source semantics demands save compatibility, cooldown and negative tests. `loot-ecology.ts` has saved job / source version safety for Shipping; do not carry that authority into Veyra unexamined.
- `web/src/veyra05/ecosystem.ts`: vampire/orc/slime anchors, notably Slime1 @ Pumphouse; Slime2 @ Old Pump; Orc1 @ Freight Yard; Orc2 @ Viaduct; Orc3 @ Ironvein. These are *configured habitats*, not proof a knife-first player can reach cache or survive.
- Source roles must not override/map-change existing 81 POIs, GOLD geography, existing cash, vendor, evacuation, Elder lairs, authored room layouts.

## 4. Current design proposals (NOT CREATOR APPROVED; NOT CODING ORDERS)

### 4.1 Proposed physical source roles — names are canonical POI IDs

| Item | Candidate POI/source roles | Rationale | Proof missing |
| --- | --- | --- | --- |
| Pipe | `po_falls` pipe store; `po_pumphouse`; `po_oldpump`; also `po_dpier`, `po_wreck` salvage | Pressurized hydraulic equipment, derelict pipe, shipped hardware | Place real containers in accessible authored rooms; grade/renewal/finite status; spawn reach |
| Gear | `po_ironmine` crane cab; `po_falls` rotor/bearing; `po_sawaion` saw drive; `po_freightyard`; `po_kestrel` | Mechanical drives/gears in machines or transport | Specific stock, exposure, reach; no automatic monster kill gating |
| Plate | `po_slag`; `po_ironmine`; `po_ironharbor`; perhaps `po_ember` | Foundry metal stock, industrial structure reinforcement | Batch supply and renovation sink vs scarcity |
| Blade | Greywater smithy; Cinder forge; `po_slag`; `po_wreck` | Cutting tools/forged stock | Is a loot Blade actually useful versus sword and recycler |
| Mechanical Parts | Roadside wrecks/scrap, maintenance POIs, existing direct craft | Broad utility base material | Veyra-specific live source and renewable economic rate |

**Current ratio policy proposal (not approved):** common salvage may renew, but special premanufactured Pipe/Gear/Plate/Blade in selected caches is finite per run/source or separately capped. Do not introduce generic infinite refresh. No percentage/quantity assigned yet. Do not fabricate card/power gate. More dangerous sites should improve choice/reward only after actual hazards/reach verified.

### 4.2 Proposed recipes, different statuses

- **Vehicle Frame (piped) redesign candidate:** 1 Pipe + 1 Iron + 1 Mechanical Parts + 1 Spares -> 1 Frame, 20s (was 1 Pipe +2 Iron+2 Parts+2 Spares, 22s). Finding a Pipe then makes bypass valuable. Requires exact economic and source trial; **not approved**.
- **Do NOT force Gear/Plate into the sole Workbench III path.** That would transitively force their acquisition for Motorbike, contradicting approved sandbox alternative principle. **Proposal:** retain existing direct-material Workbench III route and offer an alternative precision assembly using Gear/Plate. Prototype direct recipe: 3 Iron +3 Parts+4 Fasteners+8 Spares+1 Gear+1 Plate. Need check implementability of upgrade alternatives and relative pricing. **Not approved**.
- **Do NOT force Gear into the only Field Generator recipe.** It already has a Generator Capacity Upgrade; proposal is to put Gear into *an alternate/upgraded capacity route* with an actual physical benefit rather than baseline power. Existing upgrade stays as fallback until balanced. **Not approved**.
- **Do NOT force Plate into the only Powered Door recipe** without a distinct, visible reinforced benefit. Existing base door 350 HP vs ordinary Iron Door 420 HP: investigate whether paid reinforcement grants distinct defense/function, rather than just making a baseline item expensive. **Not approved**.
- Other fixed alternatives currently: Salvager Pick gear path, Motor Drive gear path, sword blade path. Avoid destroying them.

### 4.3 Preliminary demand scenarios (counts are *scenario inputs*, not proven demand forecast)

| Player-selected goal | Gear direct inputs | Pipe direct inputs | Notes |
| --- | ---: | ---: | --- |
| One Salvager Pick by Gear route | 1 | 0 | Parts-only route exists |
| One Motor Drive by Gear route | 1 | 0 | Default drive route exists |
| One Infrared Sensor | 1 | 0 | Specialized optional powered automation |
| One Bear Trap | 1 | 0 | Each (re-)arm uses one Plate, but no Pipe direct |
| One Vehicle Frame by Pipe route | 0 | 1 | Baseline non-Pipe frame exists |
| One Plate batch (2 pieces) | 0 | 1 | 1 Pipe +2 Refined Iron+1 Parts ->2 Plates; use for repairs/traps |
| One optional precision Workbench III proposed | 1 | 1 indirectly for batch of two Plates | Extra Plate remains |
| Generator capacity upgrade using Gear (proposed) | 1 | 0 | Existing direct-material capacity upgrade remains |
| One hypothetical reinforced door via Plate | 0 | 1 indirectly for batch of two Plates | Must provide measurable distinct function |

Example cumulative choice: Pick Gear (1) + Drive Gear (1) + Sensor (1) + Bear Trap (1) = **4 Gear**, all optional goals. Adding proposed precision Workbench III (1) and upgraded generator (1) = **6 Gear**. This is *not* a mandatory progression bill or target minimum supply: users may craft Gear, skip any goals, or find alternatives. Pipe demand for 1 piped frame + 2 Plates (one batch) = **2 Pipes** by direct composition; more Plates require additional batches. Do not set loot counts from these scenarios alone.

## 5. Design task order and acceptance gates

1. **Demand proof:** derive a small set of optional building, weapon, travel, base-defense scenarios; count consumer uses and repeated consumption (Plate trap re-arm and wall repair); avoid treating a fixed script/20 journeys as quests.
2. **Supply geography:** map actual authored chests/rooms and nearest distinct alternatives for the four Veyra spawn choices. Mark every source candidate as proposed until physically certified. Never assume current 58 fallback caches are industrial-quality evidence.
3. **Finite-vs-renewable versioning:** define loot identity by `run_id + global xyz/floor + authored source id`, separate fixed original stock from finite industrial bonus and renewal roll. Prove no save/reload reroll, no in-container duplication, no source respawn of finite items.
4. **Economic balance:** measure raw materials, processing seconds, fuel, station upgrade, research, travel time, damage risk, carrying capacity, alternative loot and recycler opportunity cost. Keep batch leftovers.
5. **Creator review:** obtain approval of numerical cost changes, source locations/rates, recharge schedule and mechanical benefits of upgrades. Only approved bounded work becomes an agent implementation brief.
6. **Real acceptance:** production Veyra from each legal spawn where relevant, native input/no debug grant, visible pickup + recipes/recycler, logout/relaunch, positive and negative trials, pinned exact SHA, screenshots and player qualitative evaluation. CI PASS is not PLAY PROVEN.

## 6. Ledger of open decisions and disputes

- OPEN: Pipe-frame cost/time proposal.
- OPEN: optional Workbench III precision alternative and actual station code support.
- OPEN: which Generator capacity upgrade consumes Gear and whether current upgrade is replaced or complemented.
- OPEN: Powered Door reinforcement actual HP/armor/behavior and repair ratio, not merely Plate bill.
- OPEN: per-POI industrial loot source coordinates/rooms, finite budget and source eligibility, refill schedule.
- OPEN: item-level rates for 336h run; no rates established in Atlas for this Veyra design.
- OPEN: Veyra access and threat by spawn proven via actual game.
- OPEN: historical Last Island v1–v11 original source ZIP restore + hash verification (README declares archived original 1,489,422 bytes SHA-256 `8b4fdedaa9397baaa1bcb8ba58d5c95ca2e7cbdd679963c6d4177fc9ab861e98`; **not revalidated here**).
- OPEN: oil/fuel, broader industrial roles and structures, later design sequence.
- NOTE: Existing Veyra architecture / code SHA is just the compared snapshot; always refresh branch/PR before assigning any implementation agent.

## 7. Next design pass

Prioritize realistic player-selected gear/pipe demand against geography; inspect the specific Veyra cache list for `po_falls`, `po_ironmine`, `po_pumphouse`, `po_freightyard`, `po_wreck` and authored variants. No work order until proposed numbers and source rules have explicit review. Keep this ledger updated IN PLACE; do not create an equally-authoritative competing document.

---

## 8. Expedition comparison and live-evidence correction — 2026-11-12 research pass 2

**Evidence class:** RESEARCH_DELIVERED / STATIC_SOURCE_AUDIT + replay of existing M2 machine-readable audit, **NOT** new natural-play evidence, walking pathfinding, live re-simulation or a numerical loot-table authorization. Runtime comparison remains pinned to `c6c6fc50471f9dff2633e6dcde00f2d342c8ce7e`; M2 generated evidence may predate later D5 corrections. Record sources in §8.8.

### 8.1 Crucial correction: do not cite stale M2 verdict as current runtime

- Historical `M2_AUDIT_REPORT.md` reported Veyra's old `23/24` authored caches, `57/58` fallback POIs, `0` damaged drives from wrecks, and no Recycler.
- Later `CURRENT_ACCEPTANCE.md` §1, §3 records **D3: 24/24 authored + 58/58 fallback**, and **D5/WP3: actual Veyra `po_slag` Foundry Recycler**, at global TILE coordinate `(2414,1896)`; fresh runs with authorized recycler have `wreckEconomy:'recycler-v1'`, producing finite `damaged_drive` in wreck salvage. The WP3 integration exercised physical harvest → drive → Recycler → Spares → Workbench L2 Frame → save/reload, with screenshot evidence; it does **not** prove geographic walk-route fitness or the candidate Gear/Pipe caches.
- `web/src/game/wreck-economy.ts` pins wreck policy by run and ensures old saves without authorized recycler preserve `direct-v1` (no drive bonus, higher Spares chance). Do not overwrite this compatibility to make a loot test pass.
- M2 `M2_SIMULATION_RESULTS.json` current static POI item count remains **0 Pipe, 0 Gear, 0 Plate, 0 Blade, 0 Refined Iron, 0 static Damaged Drive**: *static inventory* is distinct from the repaired **dynamic wreck drop**.
- Distinguish `24/24` cache materialization from **walkable reachable from four legal starts**; code-only materialization is not reach proof.

### 8.2 Verified 81-POI static cache stock at M2 snapshot

`M2_SIMULATION_RESULTS.json -> worldEndowments.veyra.staticLootItems`: Pipe=0, Gear=0, Plate=0, Blade=0, Refined Iron=0; Mechanical Parts=16, Spares=62, Fasteners=44, Iron Ingot=18, Iron Ore=25, Scrap=84, Coal=41. These are contents of 81 POIs' static containers; they **exclude** wild veins, roadside scrap/wreck source stock, creature drops, crafting, vendors, recycling and any future authorized new loot contract. No claim that all are available in a given 200×200 local window or accessible from spawn.

Specific currently authored/fallback POI cache contents (before proposed item source roles):
- `po_greywater` Smith's Chest: 2 Iron Ingot +4 Fasteners +4 Scrap; Smugglers' Hoard Floor -1: 3 Spares +2 Iron Ingot +1 Fuel Can.
- `po_pumphouse` generic cache: 2 Iron Ingot +3 Fasteners +1 Fuel Can.
- `po_hook` Boat-Repair Locker: 2 Rope +2 Treated Canvas +3 Fasteners; `po_mere` generic cache: 5 Scrap +1 Mechanical Parts +2 Bandages.
- `po_westmouth` generic cache: 4 Herb +1 Medkit +1 blueprint:stew; `po_dpier`: 6 Scrap +2 Rope +2 Bandages.
- `po_westbank`: 3 Spares +1 Mechanical Parts +1 blueprint:gas_mask; `po_filter`: 4 Seed +4 Berries +3 Cloth.
- `po_falls`: 5 Iron Ore +4 Coal +2 Fasteners.
- `po_freightyard`: 3 Rope +1 Treated Canvas +3 Herb; `po_ironvein`: 4 Herb +1 Medkit +1 blueprint:stew.
- `po_ironmine` Crane Cab Locker Floor +1: 2 Mechanical Parts +6 Fasteners +1 repair kit; Drowned Store Floor -1: 5 Iron Ore +4 Coal +1 repair kit.
- `po_slag`: 4 Seed +4 Berries +3 Cloth (its **separate** D5 actual Recycler is present, even though its fallback loot is inappropriate for metalworkers).
**Design implication:** prioritise fixing off-theme industrial fallback semantics **without** destroying existing authored/story cache stock, and separately author physical *finite* intermediate containers.

### 8.3 Measured code constants for travel/carry and raw source stock

- `BAL.player.speed=72` px/s, `TILE=16` px, Veyra `U=0.5` AU/tile → 1 AU = 2 tiles = 32px; fastest normal on-foot public surface `ROAD/BRIDGE=1.28` ⇒ **92.16 px/s**. Neutral grass 72, forest 61.92, marsh 44.64 px/s, ignoring slow, combat, collision, baggage. Walking while swinging multiplies speed by 0.45. Source `sim.ts:tickPlayer`.
- Inventory `BAL.player.carryLimit=60kg`, overload movement penalty lower-bounded at 0.35; `trail_pack` +20kg but occupies back slot. Inventory holds 24 slots plus equipment. `invWeight()` includes inventory *and* equipped items. Cart 24 slots/240kg base; cart may snag at rivers/walls, and cart speed varies by road/rough/freight weight.
- `SOURCES.iron` 5 Iron Ore per fully depleted vein (hp24), `coalv` 5 Coal per seam, roadside `scrap` 4 Scrap per source, `wreck` 8 Scrap per wreck, all finite (excluding explicitly regenerative plant sources). The tool's power changes swings/work per node; stone pick ore2/scrap2, iron pick ore5/scrap4, salvager ore8/scrap7; no invalid "one swing = five ore" assumption. Dynamic wreck bonuses separately roll Spares, drive, etc., by policy.
- Mass: 8 Iron Ore ×2kg +5 Scrap ×1kg +1 Coal ×1kg = **22kg** raw carried. Finished 1 Gear (0.8kg) +1 Pipe (1.2kg) = **2kg** before additional co-products. Stock transport, station fuel, equipment and food are additional.
- Workbench Level 1 placement = 14 Wood +4 Stone; Furnace = 18 Stone +4 Wood; hand-crafted Stone Pick =3 Wood+4 Stone+1 Rope, with 1 Rope =3 Fiber. Thus from a knife-only start, before collecting metals, the basic station/pick **raw item bill** is 21 Wood +26 Stone +3 Fiber (plus fuel and tool wear). At their catalog masses, Wood+Stone already weigh **52.2kg** — staged crafting / cargo/drop storage matters. No claim all building materials must be carried in one load.
- `WORKBENCH_UPGRADE` L1→L2 =2 Mechanical Parts +1 Iron Ingot, with Parts crafted 2 Scrap+1 Iron Ingot→2 Parts.

### 8.4 Controlled expedition comparison: self-produce versus near versus distant

**A — Self-produce fresh-run 1 Gear + 1 Pipe, no found intermediate.**
- If Workbench II and Furnace **already exist**: 8 Iron Ore +5 Scrap +1 Coal through 8 Iron smelts, 2 MP batches, 1 Fastener batch, 1 Refined batch, Gear and Pipe; **172 seconds of sequential nominal job time** (not user elapsed time). There is 1 MP +2 Fasteners surplus.
- If Workbench L2 **still needs to be upgraded**, combined batch schedule: **10 Iron Ore +7 Scrap +1 Coal**, **204 seconds** of sequential nominal metal/intermediate jobs, plus initial Stone Pick, Workbench, Furnace and fuel as above. The source minimum at full stock is at least 2 iron veins, 2 roadside Scrap nodes or 1 wreck, and 1 coal seam, plus wood/stone/fiber sources. Multiple local sources, legal reach, recipe selection, fuel and queues are not proven by the inventory calculation. Actual jobs may overlap when using more than one station.
- In a region without natural iron, `scrap_ingot` converts **3 Scrap →1 Iron Ingot** without Coal as input, though a fuelled Furnace is still required. Example at Westmouth: Workbench II +1 Gear from **23 Scrap** in a zero-ingot/zero-fastener case (6 ingots cost18 Scrap, MP cost4 Scrap, Fastener batch cost1 Scrap; 2 MP batches, one Fastener batch, Gear); 126s nominal processing plus fuel/stations/gathering. A Gear is feasible from salvage even when local Iron Ore nodes are absent. However a Pipe needs 2 Refined Iron from 3 Ingots **and 1 Coal**, so it can prompt a different expedition.

**B — Near-POI skip, Greywater (theory from exact cache contents, not reach proof):**
- Greywater Smith's Chest (2 Iron,4 Scrap,4 Fasteners) + Greywater Smugglers' Hoard F-1 (2 Iron,3 Spares) + Pumphouse Cache (2 Iron,3 Fasteners) = **6 Iron Ingots +4 Scrap +7 Fasteners +3 Spares**.
- Workbench L2 bill consumes 2 Iron Ingots +2 Scrap to manufacture 2 Parts then pay 1 Iron; Gear bill consumes 2 Iron Ingots +2 Scrap for another 2 Parts then 2 Iron +1 Fastener. Combined for **L2+1 Gear =5 Iron +4 Scrap +1 Fastener**, leaving 1 Iron +6 Fasteners +3 Spares, if all containers accessible and unlooted. No ore vein, Coal seam or Furnace needed for these specific metal conversion steps; 2 MP jobs (24s) +Gear (20s)=**44s** sequential. Still must build Workbench (14 Wood +4 Stone), reach Floor -1, survive, interact and return as desired.
- This is a **strong early Gear bypass**, not a guaranteed route: source competition, camera/doors/stairs, legal world collision and save persistence require natural play proof.

**C — Distant industrial/ore expedition:**
- `po_slag` currently hosts an actual Recycler from D5 and a *poorly matched* static cache (seeds/berries/cloth). Its sampled 200×200 scene had 761 iron nodes, 263 coal nodes, 39 roadside Scrap nodes and 5 wrecks in the earlier M2 resource raster. This is abundant ore in the sampled window, **not** 761 readily reachable veins on a single route. Toxic hazard matters: `sim.ts` adds radiation on `T.TOXIC` at 7/min without gas mask or 0.8/min with mask (at full exposure), and damage once rad>50; measured trip must account for actual exposure.
- `po_ironvein` has Orc3 (configured habitat), but its current fallback cache has herbs/medkit/stew. Its name alone is not a rich loot roll or guaranteed mine ore vein.
- Actual journey advantage must subtract time and loss risk of outbound+return travel, tools, food/water, load, survival, and spent source stock. Far POIs may be worth ore, but presently do **not** reward already-made Gear/Pipe/Plate/Blade from static caches.

### 8.5 Absolute-coordinate straight-line travel LOWER BOUNDS — not traversable path or ETA

Source coordinates: GOLD canonical `web/geography/veyra-lr01/map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json` `project.spawns[].at` and `project.pois[].at` (AU). Game chooses legal spawn near region; it does not place every run at exact GOLD anchor. Formula:

`D_au = hypot(spawnAU - poiAU); straight_road_min_minutes = D_au * (32 px/AU) / (72 px/s * 1.28) / 60`.

Values below are **unattainable ideal lower bounds if all displacement were on a perfectly straight clear road at full speed**; rivers, no real ferry/bridge decks, interior routes, slowing terrain, enemies, doors, load, darkness, camping, and the randomized legal spawn add cost or may make the route impossible. Do NOT present as real route times.

| GOLD spawn anchor | Near relevant POI | D AU / lower bound one-way | Further industrial POI | D AU / lower bound one-way |
| --- | --- | --- | --- | --- |
| Greywater South Shore `sp_lake (790,622)` | Greywater Hamlet | 37.2 AU / 0.22min | Ironvein Mine | 416.3 AU / 2.41min |
| Greywater South Shore | Greywater Pumphouse | 89.2 AU / 0.52min | Slagworks | 508.5 AU / 2.94min |
| Westmouth Shore `sp_west (372,606)` | Drowned Pier | 169.4 AU / 0.98min | Slagworks | 882.1 AU / 5.10min |
| Hook Meadow `sp_hook (1282,392)` | Hook Mere Pier | 40 AU / 0.23min | Ironvein Mine | 274 AU / 1.59min |
| Gulf West Bank `sp_gulf (872,930)` | Westbank Landing | 46 AU / 0.27min | Slagworks | 318.1 AU / 1.84min |
| Gulf West Bank | Delta Filter Station | 87.7 AU / 0.51min | Ironvein Mine | 431.9 AU / 2.50min |

Even two legs at these lower bounds are **NOT** an end-to-end walking trip time, and cannot establish whether a trip is worth its loot. Pathfinding on the actual GOLD terrain is next engineering analysis/acceptance task, not delegated before policy approval.

### 8.6 Source census from M2 12 × 200×200 windows (not unique 81-POI all-world totals)

- Sampled `veyra05-greywater`: 0 Iron,0 Coal,40 roadside Scrap,7 Wreck. `westmouth`: 0 Iron,0 Coal,51 Scrap,11 Wreck. `hook`:0 Iron,0 Coal,25 Scrap,5 Wreck. `gulf`:195 Iron,75 Coal,37 Scrap,4 Wreck (these are window-node counts, not guaranteed reachable).
- `veyra05-slag`: 761 Iron,263 Coal,39 Scrap,5 Wreck in the sampled window. `veyra05-greyback`:51 Iron,28 Coal. Some scene windows may overlap; aggregate counts must NOT be interpreted as unique whole-map stocks.
- Only `greywater`, `westmouth`, `hook` and `gulf` are the four spawn-choice regions of interest. Each new run has a legal spawn chosen by runtime, not automatically the GOLD anchor.

### 8.7 Recommended **design next action** (proposal, not approval)

1. Do not homogenize ore spawn placement: rejected M3 proposal A6 to mint 14 Iron/8 Coal veins near every spawn is **CANON_REJECTED** in `M5_CANON_CORRECTIVE.md`. Preserve west/Hook salvage and Gulf metal mining asymmetry.
2. **First POI content fixes** should repair the glaring mismatch: Ironvein Mine herb/medkit/stew and Slagworks Foundry seed/berries/cloth **as primary cache contents**, while preserving existing lore supplies by relocating/retaining them in plausible food/first-aid locations rather than silently deleting. Freight Yard also has rope/canvas/herb, with no machinery scrap reward.
3. Sample proposal to review, **NOT** apply: source-bound finite 1 Gear candidate at `po_ironmine` Crane Cab Locker or `po_falls` rotor room; 1 Pipe candidate at `po_pumphouse` maintenance store or `po_falls` pipe store; 1–2 Plate candidate at `po_slag` foundry stock. Avoid making every first-hour chest guarantee an intermediate; no chance values approved.
4. Reuse / extend the existing world floors + source ecology contract with stable global `run_id + source_id + floor + x,y`, separate **finite component bonus** from the ordinary renewed resource stack. Since `renewableLoot()` currently renews `res` items, do NOT merely append `metal_pipe`/Gear/Plate/Blade to ordinary `site.loot`.
5. After real pathfinding / journey capture, compare available useful outputs from 20-minute natural play (not a mandatory quest) for knife-only, scrap-first, ore-first and POI-raider strategies. Only then approve per-cache counts/probabilities and Pipe/Workbench precision recipe changes.

### 8.8 Evidence pointers

- Live code: `web/src/game/catalog.ts`, `engine.ts`, `sim.ts`, `core.ts`, `wreck-economy.ts`, `world-economy.ts`, `web/src/veyra05/reader.ts`, `floors.ts`, `scenes.ts`, `web/geography/veyra-lr01/map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json`.
- Programmatically generated source audit: `web/reports/economic-network/M2_SIMULATION_RESULTS.json`, `M2_AUDIT_REPORT.md`. **The report's first-run defect descriptions predate the later D3–D5 fixes.**
- Corrective authority: `web/reports/economic-network/M5_CANON_CORRECTIVE.md` (rejects false source fixes), `CURRENT_ACCEPTANCE.md` (WP3/D5 Recycler proven, D3 caches fixed), `web/ref/bible.md`.
- Historical Last Island study: `web/ref/atlas/extracted/LI_MASTER_RESEARCH_REPORT_v5.md`, v10/11 ledgers. Historical figures are research sources, not current-game recipes or production authorization.

---

## 9. Finite industrial loot protocol and four-site pilot — 2026-11-12 pass 3

**Status:** Engineering design and quantified **CANDIDATE PILOT**. No source code implementation and **NO CREATOR APPROVAL** for amounts, specific guaranteed locations or item content changes. The *only* Creator-locked industrial principle is in §1. Do not turn §9 into an agent coding prompt before explicit review of the distribution policy.

### 9.1 Confirmed lifecycle and exact failure if rare items are naively added

**Files examined on runtime SHA `c6c6fc50471f9dff2633e6dcde00f2d342c8ce7e`:** `web/src/game/engine.ts` around 1332–1427, `web/src/veyra05/floors.ts` 570–735, `web/src/veyra05/continuity.ts` 190–282, `web/src/game/core.ts` run fields 218–249, `web/src/game/balance.v1.json` `lootRespawn`.

1. `renewableLoot(site)` returns **all** original `site.loot` entries whose catalog `cat` is `res` or `food`, except `damaged_drive`. `metal_pipe`, `mechanical_gear`, `iron_plate`, `metal_blade` are all **`res`**. Therefore naïvely placing a Gear/Plate/Pipe/Blade in a normal static crate makes it reappear after normal inventory depletion.
2. `lootCooldown(site)` falls back to industrial 24h / food 12h / other 18h in Veyra when no special grammar; no Veyra `lootEcology` overlay is initialized in the current default flow.
3. `retireEmptyLoot()` executes only after a successful transaction that empties the public crate, schedules eligible refresh and removes the physical entity. Partial stock survives in `r.custody` until consumed. `stepLootRespawn()` later rebuilds `renewableStock` in a new crate, potentially minting all original component `res` items again.
4. Veyra stores depletion and cooldown across window + floor transformations via `r.veyraGlobalDepletedLoot` and `projectDepletedLootFromGlobal`; saved offscreen entities may preserve partial container stock. These mechanisms prove **existing accounting paths**, NOT a new rare finite-source policy.
5. `r.depletedLootSites` uses **local tile index**, while global Veyra state keys `floor:global_x:global_y` plus timer. A component source must have its own stable identity independent of arbitrary local-window tile index, random new entity ID or site label.
6. `migrateLootRespawn()` and offline `stepLootRespawn` must obey a rare finite-stock source policy. A global `ITEMS` exclusion based on item key is insufficient because different physical sources may legitimately have different renewal status for the same product.
7. A changed authored static plan could be materialized on **old ongoing saves** if new POI statics simply become globally visible when the player changes windows/floors. Rollout must pin a new-run loot policy version, not retrofit bonuses to legacy runs.
8. `r.seenIntents` records successful transaction identities and `dispatch` retires emptied crates after commit. Any new finite claim must use the same authoritative successful withdrawal boundary and be idempotent across replay/restart.

### 9.2 Recommended minimal industrial source contract (proposed architecture)

Do not overwrite `r.lootRespawnAt` or repurpose the meaning of `depletedLootSites` in legacy saves.

- Explicit opt-in on a **new run only**: `industrialLootVersion:'veyra-industrial-v1'`, absent means legacy behavior.
- Stable **authored physical source ID**: `runId + poiId + floor + authoredSiteKey`; world global x/y as a geometry check, not the sole identity. A site key might be `po_falls/pipe_store/finite_pipe`. Once created, its item roll is bound to a run seed and version.
- Each source has a declared `policy:` either `ordinary-renewable` (current caches) or `finite-once`. A source should not silently include both types in a single generic respawn bucket. Simpler design: keep old public cache and add **one separately tracked finite industrial lockbox or interactable stock** in a plausible actual room. Visually it may belong to the machine inventory; the real player must physically interact.
- Single stock authority: durable physical container carries **remaining exact item UID/quantity** while source issuance/exhaustion is recorded in a compact versioned `issued / exhausted` ledger. Do NOT store two independent mutable copies of current item quantity (avoids divergent ownership).
- On first authorized materialization: derive eligible item(s) once; create physical container and record issuance. On partial withdrawal, update physical stock transactionally; on final withdrawal, mark source exhausted and remove entity. On revisiting, no new roll or re-materialization once exhausted.
- On ordinary public cache renewal, the industrial finite lockbox is **not** part of the refreshed stock; existing ordinary `supplyHours=12`, `industrialHours=24`, `otherHours=18` stay untouched until a separately approved economy rebalance.
- Never mint source bonus as profile currency, blueprint or Creator Core; never hide acquisition behind new keycard gate, boss kill or invented POI access.
- Seasonal/offline clock continues to affect existing ordinary sources. **Finite-once** remains exhausted at 336-hour run boundary. Next new run has a new stock identity and policy. Cross-run inventory transfer stays prohibited.

**Specific abuse cases to test:** (a) take 1 of 2 Plates, reload, take last; (b) empty then shift window out/back; (c) empty Floor -1 chest, climb then descend; (d) empty on day 1, offline 25h, return; (e) duplicate/reordered dispatch intent; (f) reload before and after issuing first stock; (g) old save enters new POI after patch; (h) source spot becomes blocked by changed prop; (i) player death with loot in inventory; (j) inventory full/partial withdrawal; (k) rain/weather/resumed offline settlement; (l) fresh new run after previous run wipe; (m) source item dropped on ground then returned; (n) rare source initially empty due to seeded roll; (o) multiple appearances in overlapping Veyra windows. Every test must assert item UID count/receipts and no gains on replay.

### 9.3 Four-site controlled pilot design — NOT AUTHORIZED distribution

The pilot deliberately adds **finite, complete industrial items** at only four POIs; it leaves their existing standard cache untouched. Physically distinct places must be checked for real floor cells and unobstructed interaction. **The numbers below are a deterministic fixed-outcome pilot for balancing only**; probability-based/randomized policy is still an open Creator experience decision.

| POI | Existing ordinary stock | Finite source candidate with concrete authored room | Candidate first-run bonus | Rationale and verification |
| --- | --- | --- | --- | --- |
| `po_pumphouse` Greywater Pumphouse | 2 Iron Ingot +3 Fasteners +1 Fuel Can at F0 global tile approx (1740,1114) | `pipe_store` / Pressure Pipe and Tool Store, Floor 0; author stable source key, choose an actual unblocked cell after compile | **1 Pipe** | Near Greywater; early industrial shortcut, no boss. Do not mistake the fall back cache itself for the new finite source |
| `po_falls` Falls Powerhouse | 5 Iron Ore +4 Coal +2 Fasteners at Floor 0 approx (1414,848) | `pipe_store` Floor 0, **1 Pipe**; `turbine_subfloor` / Bearing Chamber Floor -1, **1 Gear** | **1 Pipe +1 Gear**, separate physical finite stock | A reason to explore both maintenance storage and the machine subfloor; existing real hatch has authored landing, access still requires natural-play proof |
| `po_freightyard` Shattered Freight Yard | 3 Rope +1 Treated Canvas +3 Herb at F0 approx (1404,991) | `freight_platform` / Broken Rail Platform with ore_cart; alternative `guard_shack` would not explain a precision Gear as well | **1 Gear** | Salvage of freight handling drive, Orc1 habitat already configured. Crew/food loot may remain as a separate ordinary cache |
| `po_slag` Slagworks Foundry | 4 Seed +4 Berries +3 Cloth at F0 approx (2410,1852); separate real Recycler at global (2414,1896) | `slag_sort` / Quenched Bloom Sorting Bay Floor 0; additional `quench_underpass` maintenance may matter later | **2 Iron Plates** | A single craft batch equivalent; real industrial risk/toxic terrain, separate from its Recycler. Not one Plate minted at every 24h cooldown |

**Pilot finite supply if all physically reachable and visited:** **Pipe=2, Gear=2, Plate=2, Blade=0**. Total rare stock mass: Pipe 2×1.2kg + Gear 2×0.8kg + Plates 2×1.5kg = **7.0kg** of finished materials. Baseline ordinary stock is preserved; *a new rare bonus increases total run supply*, so quantify separately rather than pretending a cost-neutral substitution.

**Demand cross-check:** §4.3 scenario of Pick+Drive+Sensor+Trap consumes **4 Gear**, so this pilot supplies at most half of that optional Gear demand, forcing meaningful crafting or deeper explorations if player chooses all goals. One piped Frame and one Plate batch together need two Pipes by direct craft composition; pilot's two Pipes cover those selected uses, but `po_slag` already yielding two finished Plates could save that Plate batch instead. There is no required itinerary or mandatory target.
**Trade-off:** deterministic fixed contents make each POI predictably worth a trip, but may flatten replay surprise; randomized per-run contents add uncertainty but can yield zero finished components in a run. Creator approval required before either rule is implemented.

### 9.4 Why do not immediately rewrite `po_ironvein` or all 58 fallbacks

- `po_ironvein` is not a generic mine shell: `rest48.ts` builds `Prospector Shelter` (F0) and `Stone Prospecting Cut` (F-1) with an actual adit hatch and ore_cart, but M2 fallback cache yields herbs/medkit/stew. A new *ore-bin* cache is thematically valid, but adding even 5 Iron Ore on a 24h renewable contract may mint up to ~70 units over 14 days in one site; must decide its renewal budget before doing so. Retain first-aid/food for now, and audit real adjacent ore seams and walk path before authorizing ore restock.
- `po_slag` existing pantry-like fallback does not prove no industrial content exists: Recycler is separately placed and has WP3 physical evidence. Pilot only adds a bounded Plate component source, not broad infinite metal resupply.
- `po_freightyard` has an actual `freight_platform` and cart prop, so a site-bound Gear is more coherent than adding Gear to the generic food/cloth fallback, while leaving ordinary crew supplies intact.
- Any new source must be physically placed using `compilePlan`/world-floor stack with occupancy tests, stable identity, no obstacle to stairs/doors/props; a POI title alone cannot authorize a container.

### 9.5 Acceptance metrics and stop conditions

**Inventory conservation:**
1. `physical source initial total = remaining in source + successful withdrawals + lost/destroyed stock` per source UID (account for transfer, drop, salvage and crafting separately).
2. In one run, `finite delivered ≤ finite original issued` across reload/window/floor/offline; **0 items minted on second visit**. Intent replays never double payout.
3. Existing non-premium crates maintain old renewal cadence and original content, and existing caches do not silently swap loot on an old save.

**Sandbox usability:** Player can get a Gear through Scrap-to-Iron and Workbench II with no special POI, or by exploring the proposed sites; player can still make a Vehicle Frame and Motor Drive without rare-component routes. No boss and no mission sequence required.

**Evidence classes:** `SOURCE_IMPLEMENTED` only after a merged code SHA; `TESTED` only after code build and automated tests; `PHYSICALLY_PROVEN` only after real Veyra movement, loot, inventory, recycling/crafting and separate-process save/restart; `VISUALLY_VERIFIED` from same SHA screenshots with no clipping. A toy loot-generator unit test cannot prove the loop.

**Stop:** no changes to geography, old run save authority, Ragnarok cash, Creator Core distribution, airdrop or vendor rules in an industrial-loot task. No agent is commissioned just from this ledger. Exact candidate location/guarantee remains creator-review state.

### 9.6 Creator decision needed, only if authorizing this pilot

**Choice:** Should identifiable physical stock (e.g. a pressure-pipe store and turbine bearing) supply **a guaranteed once-per-run specific component** after it is reached, with optional randomized minor toolboxes elsewhere (recommended), or should even these specialist stocks have chance-based outcomes? This is a player-experience and 14-day exploration-economy decision, not something code can settle. Distinguish from total compulsory progression: crafting still exists. Only the selection rule is open; the lifecycle requirement (no duplicate farming) is mandatory technical integrity once finite stock is adopted.
