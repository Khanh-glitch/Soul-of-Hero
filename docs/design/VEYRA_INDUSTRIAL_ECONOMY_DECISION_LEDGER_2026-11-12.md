# VEYRA INDUSTRIAL ECONOMY — Decision ledger (2026-11-12)

> **RED FLAG-SPAWN-001 — HIGH PRIORITY DESIGN MISMATCH:** There are **four hardcoded Veyra *regional starting windows* in today's implementation**, NOT four canonical Last Island / SOH spawn points. NEVER treat that number as a design target, coverage denominator or valid universal balance test. §12's four-region QA matrix is **SUPERSEDED** by §13's full-map, eligible-cell coverage method. No global-spawn code change has been approved or implemented.
>
> **READ FIRST — 2026-11-12 CURRENT STATUS:** The only Creator-approved industrial direction is §1. Earlier §4/§9 are recorded exploration hypotheses, **not approved recipes, deterministic reward sites, finite-only policy, rates or implementation authority**. §10 corrects the false guaranteed-vs-random choice; §11 below is the latest **testable SOURCE-CLASS design**, not a production loot contract. Keep original evidence without allowing rejected/superseded examples to function as implementation orders.

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

### 9.3 Historical four-site **superseded** deterministic control sample — NOT AUTHORIZED distribution

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

---

## 10. Design correction: false guaranteed-versus-random binary — 2026-11-12 Creator challenge

**STATUS: CORRECTION TO ASSISTANT PROPOSAL, NOT A NEW CREATOR DECISION.** This section explicitly qualifies §9.3–§9.6 and earlier suggestions that finished components must be once-per-run guaranteed drops. The 4-site supply `2 Pipe / 2 Gear / 2 Plate` was **a test fixture to compare source economics**, not justified as the actual SOH loot experience. Do not implement it by default; do not treat finite bonus vs timer refill as a binary based solely on whether item is "advanced".

### What Last Island sources actually demonstrate

1. Official 2022-11-09/10 notice `https://hero.yingxiong.com/info/2022/1109/13052.html` distinguishes **crate category** (Supply guaranteed *facility/material class*, Military guaranteed *weapons/equipment/special-material class*, Food guaranteed *food class*, Medical guaranteed *medical class*, Harpoon guaranteed *harpoon/diving class*), **crate tier** (damaged/low/mid/high as available), and **access rooms** (green/blue/purple with differing crate mixes). **Guaranteed category ≠ guaranteed Pipe/Gear/Plate SKU.**
2. The notice expressly gives *chance* that any Toolbox drops bicycle blueprint, so specialist crates do not necessarily guarantee a particular blueprint. It separately specifies **guaranteed specific drops for particular bosses** (4 defibrillators per Port Boss death; 2 from Avenger in the named update), showing SKU-specific guarantee is a different, source-specific contract — NOT default ordinary crate behavior.
3. LI Atlas v4 distinguishes **container family, tier, per-item chance, access** and independently records **POI loot, keycard and power cycles**; the source-specific timers are community/period-variant, not blanket official 2026 values. Atlas v5 S06 likewise distinguishes "guaranteed category" from item chance. Avoid forcing every specialist POI to be a one-time named reward chest.
4. TapTap 2022-08-04 Metal Pipe note: Pipe appears in yellow/blue barrels, Supply, Military, Advanced Military and Airdrop, can be recycled or crafted at medium bench; it is a **multi-source economical intermediate**, not proven guaranteed once-per-run at one "Pipe Store".

### What SOH canon actually requires

- `web/ref/bible.md` §K3 and source model: source has identity, type, stock, finite-or-respawn status and valid timer; player interaction debits/grants atomically and has save continuity. **Plants/scrap/monsters/POIs can replenish by their own rules**; Ragnarok special cash is **finite** and cannot share ordinary loot renewal. This does **not** imply finished industrial intermediates are globally or locally once-per-run.
- 336-hour continuously running 14-day world, wipe, offline simulation, player freedom to search/skip/recycle/craft, geographic variability: expected viable **source classes and tradeoffs**, not fixed named collectible pickup itinerary.
- Creator-approved principle from §1 is only: advanced industry meaningfully uses intermediates, with genuine alternative sources/uses, not unnecessary compulsory chains.
- Code's current `renewableLoot()` uses broad item-category eligibility; that is too coarse to control special finite bonuses, but **finite bonuses are not automatically the right answer to that defect**. Fix should be source-granular policy with explicit stock/renewal class and evidence-based generation.

### Revised design hypothesis

Prefer **source class (what a place can plausibly contain) + quality tier (how valuable/rare) + access gates/risk + physical stock + per-item probabilities** for normal scavenging. "Guaranteed" may refer to a broad class or minimum useful salvage, not an exact Gear/Pipe every run. Preserve independent replenishment rules for normal sources where intended, with bounded renewable stock and stable deterministic rolls; non-renewable named treasure and unique tech only for exceptional source contracts justified by SOH canon and actual player experience. If a source has a finite component, protect its UID and once-issued state; if it is a renewable industrial toolbox, do not ban Gear simply because it is an advanced intermediate — control cooldown, count, rarity, and anti-exploit.

**Reopen** §9.3 four-site deterministic pilot for design; **DO NOT AUTHORIZE 1 guaranteed Pipe @ Pumphouse, 1 Pipe+Gear @ Falls, 1 Gear @ Freight, 2 Plates @ Slag** as an actual gameplay distribution until class/tier/access/probability and run-time sample are reviewed. Source/site names remain plausible thematic candidates only.

**Next actual design question** is not "guarantee item versus random item?" but: which physical source categories should the player recognize in Veyra, how should risk, recovery, time/route and POI depth change the distribution of viable materials, and which exceptional sources alone warrant guaranteed exact rewards? Revisit Last Island source-version-referenced numbers before locking item-level odds.

---

## 11. Veyra source-family taxonomy and probability stress test — 2026-11-12 pass 4

**STATUS:** RESEARCH + RECOMMENDED DESIGN, **NOT CREATOR-APPROVED NUMBERS** or implemented. Supersedes §9.3's deterministic `2 Pipe/2 Gear/2 Plate` distribution as a candidate **actual** gameplay policy. Retain that set only as a clearly labeled unit-test fixture. Do not commission an agent based on §11 until outstanding decisions are accepted and data/source versions are pinned.

### 11.1 Key discovery: the source-class infrastructure already exists in SOH, but is Shipping-scoped

- `web/src/game/loot-ecology.ts` has `LootClass=toolbox|supply|military|advanced`, W06 fixed/optional stock, B01/B04 grammar, B05 low/mid/high grade pools, per-run/physical-source/cycle deterministic hashing, source URI and historical LI container-class reference.
- `web/src/game/loot-source-spec.ts` `LootSourceSpec` already separates `role`, `grade`, `access`, `stock=finite|renewable`, `cooldownHours`, `capacity`, `sourceId`, `match`, `digest`. It declares exactly **three Shipping** sources, not 81 Veyra sites, and is explicitly `loot-source-v2`.
- `engine.ts` creates `r.lootEcology` only for `shipping_fresh`/`dev_delta_fresh` fresh runs; Veyra receives static authored/fallback items but **no B05 grading or roll** as of reference SHA. `lootClass()` is tied to Shipping site labels/POI aliases, so it will not magically recognize `po_falls` or `po_slag`.
- `validLootSourceContract()` expects **all contract sites** to exist in the single `World.statics` passed to it. Veyra windows are 200×200 streaming slices of a much larger 4000×2800 geography; do not reuse its all-present Shipping assumption on Veyra's 81 POIs. Validate by compiled `global POI/source registry` once, with per-window actual physical access checked at activation.
- B05 `LOOT_B05_TOOLBOX_GRADE.high` has **guaranteed 1 Mechanical Gear** (plus refined iron) as fixed grade stock. Shipping's `factory-exterior-industrial` source is flagged `renewable` every **24h**: when legally refilled, that can yield a Gear every cycle. This is not a historical LI rate and must **not** become the Veyra default. Ignoring practical travel/access, 14 successful daily source cycles = 14 Gear, which may overwhelm alternatives.
- **FINITENESS BUG/SEMANTIC GAP:** B05 finite flag gates only `lootGrammarRoll` optional grade results. `renewableStock()` always concatenates `renewableLoot(site)`, whose broad `ITEMS.cat in ['res','food']` criterion can replenish original source items even if the B05 bonus is `finite`. Therefore "finite spec" does not itself prove "entire physical chest once-per-run"; design must explicitly declare policy at stock-subgroup or distinct-physical-source granularity. Do not erase ordinary replenishment by global category ban.

**Design action:** adapt/reuse `LootSourceSpec` + `lootEcology` rather than building another parallel economy. Extend a versioned Veyra registry and carefully revise per-group stock accounting; preserve Shipping behavior and historical save versions.

### 11.2 Canonical player-recognizable family × grade matrix (design, **not** existing in Veyra)

| Family | Player clue / where | Guaranteed useful *category*, never guaranteed exact rare SKU | Optional finished intermediate | Proposed source rhythm |
| --- | --- | --- | --- | --- |
| Roadside **salvage** | Wreck, damaged cart, roadside scrap | Scrap/Spares, occasional Fasteners/Parts; physical harvesting uses existing `SOURCES` | In ordinary roadside low-grade source: none by default (use separate credible containers for uncommon finds) | Existing wild source stock and `wreckEconomy` untouched. Do not turn every roadside wreck into a mystery gear crate |
| **Field toolbox** | Fishing repair locker, bridge/tool hut, small sawmill | Fasteners/Parts/repair utility | Small chance of Pipe, Blade or Gear according to context | Ordinary cache, provisional 24h; low quality |
| **Industrial maintenance toolbox** | Pump, turbine access, saw drive loft, crane cab | Parts/Fasteners + repair/metal utility | Pipe/Gear/occasionally Plate by machinery role | Provisional 24h at grade mid, 48h for deep grade high |
| **Material supply / metal stock** | Ore bin, furnace sorting, foundry/warehouse | Iron Ore/Ingot/Coal/Refined Iron **as site appropriate** | Plate/Blade occasionally at high industrial grade | Stock class independent of a toolbox; proposed 24h or 48h by location, not arbitrary food 12h |
| **Food/medical/supply** | Village, camp, first aid, kitchen, storage | Existing role-specific health/food and supplies | Not made into a Pipe/Gear farm by POI name alone | Preserve own class and authored content |
| **Military/special technology** | Actual authorized military cache / exceptional room | Combat materials or study/blueprints per separate canon | Blade/parts where justified; unique tech and Core **not inferred** | Their own explicit source contract, not a generic industrial overlay |

`role` (what class of thing), `grade` (value within that class), `access` (actual geometry/gate), `stockSubgroups` (physical contents/replenishment), and `cycle` remain orthogonal. A high-quality toolbox is NOT automatically a locked military vault. A low-grade machine source is not necessarily closer to every spawn.

### 11.3 Proposed test-only grade parameters to probe economy sensitivity — absolutely NOT LI values

This small model is a *test hypothesis*, not an attempt to assert true official drop odds or final SOH balance. A grade entry always yields useful ordinary materials by its own class; only the finished intermediate is optional:

- `field-toolbox/low`: 24h nominal class cooldown, **5%** roll for at most **one** thematically eligible finished component per eligible successful stock generation; otherwise raw repair stock.
- `industrial-maintenance/mid`: 24h nominal, **12%** finished-component event, at most one per stock generation; if triggered, choose Pipe/Gear/Blade/Plate from that POI's allowed set using source-specific weights not yet approved.
- `deep-industrial/high`: 48h nominal, **20%** finished-component event, at most one, still with ordinary useful stock each eligible generation.
- `metal-stock` is a separate category and must be benchmarked for Refined Iron/Plate/Blade without reusing Gear-focused toolbox probabilities by name.
- `unique/special` remains its own finite policy: e.g. Ragnarok-only cash and explicitly authored one-off tech. Neither "Pipe" nor "Gear" is automatically unique merely because it is a finished intermediate.

| Laboratory probe | Repeated full-depletion opportunities used for arithmetic | Chance per opportunity | Expected finished components | Probability ≥1 rare success |
| --- | ---: | ---: | ---: | ---: |
| One low field toolbox | 14 hypothetical 24h visits | 0.05 | 0.70 | 51.2% |
| One mid maintenance toolbox | 14 hypothetical 24h visits | 0.12 | 1.68 | 83.3% |
| One high deep-industrial toolbox | 7 hypothetical 48h visits | 0.20 | 1.40 | 79.0% |
| Old B05 high toolbox with Gear fixed | 14 hypothetical 24h successful restocks | Gear guaranteed in high grade pool | 14 Gear | 100% (conditional upon valid access/issued pool) |

**Hard caveat:** `14`/`7` are artificial consistent visit counts within 336h, *not* measured reachable visits, not spawn-adjusted and not an inventory endowment. An in-game source restocks only when depleted and due; travel, danger, capacity, remaining partial stock, raid/reset and actual stage length matter. A fixed starting batch may create an additional first opportunity. A sample percentage applies to "any eligible finished component"; it is NOT the drop chance of one named Pipe/Gear/Blade.

**Caution from LI sources:** Original developer update 2022-11-09 guarantees *classes* of supply/food/medical/military contents and specifies card-room crate combinations, not universal guaranteed individual pipe drops. 2023 published bicycle blueprint odds (0.5%→4%) apply ONLY to the stated keycard-room Toolbox context, not an analog for Veyra Pipe rate. 2022-08-04 TapTap player guide documents Pipe from barrels, Supply/Military/Airdrop and recycling. Authoritative source URLs:
- https://hero.yingxiong.com/info/2022/1109/13052.html
- https://www.taptap.cn/moment/304314693734893241

### 11.4 Actual POI/room mapping for a 12-site **assessment roster**, not automatic 12 new crates

| POI | Already-existing physical authored room or fallback | Candidate economic class / grade | Why it makes sense | Do not do |
| --- | --- | --- | --- | --- |
| `po_mere` | Hook Mere Pier generic 5 Scrap +1 Part + bandages | Field salvage / low | Hook starts with repair and transport material | Do not turn dock into guaranteed Gear |
| `po_dpier` | Drowned Pier generic 6 Scrap + rope/bandages | Field salvage / low | Westmouth coastal wreck/salvage | Do not spawn a brand-new mandatory inland gate |
| `po_westbank` | Westbank Landing generic 3 Spares +1 Part + **blueprint:gas_mask** | Field toolbox / low | Gulf's small service pier | **Preserve** existing blueprint/medical entitlement on old saves |
| `po_pumphouse` | Real F03 `pipe_store` ground-floor room + rotor room | Maintenance toolbox / mid | A pump facility can yield piping repairs | No guaranteed Pipe SKU; no invented keycard |
| `po_falls` | `pipe_store` F0, `turbine_subfloor` F-1 with actual hatch | Mid maintenance at F0; high at F-1 | Inner bearing room more specialized; physical depth | High grade not equal boss kill; door/hatch must physically work |
| `po_sawaion` | `saw_attic` F+1 Belt Drive Loft | Maintenance toolbox / mid | Gear/belt tools belong to log-driving mechanism | Do not add a free Gear at exterior generic cache |
| `po_freightyard` | Real `freight_platform` F0 with ore_cart, existing crew supplies | Freight salvage / low or mid if validated machinery | Loose wagon tools and salvage, Orc1 habitat configured | Do not give guaranteed rare item purely for combat |
| `po_ironvein` | `iron_cut` F-1 Prospector Cut with real hatch and ore_cart; generic cache today is herb/medkit/stew | **Material supply**, mid only if high-grade vein physically present | Geological role, not generic Gear store | Do not grant renewable ore at 24h without source-stock audit |
| `po_slag` | F03 `slag_sort` F0, `quench_underpass` F-1; actual Recycler at (2414,1896) | Material/metal stock high, risk-proven before grant | Refined iron/Plate/Blade more plausible than Gear at every cycle | Do not treat Recycler as a loot crate or overwrite its policy |
| `po_ironmine` | Authored `Crane Cab Locker` at F+1 already has Parts×2/Fasteners×6 | Maintenance toolbox high candidate | Operating crane needs drive gear | Preserve existing authored cache/UID, no duplicate overlay by default |
| `po_wreck` | `boat_hull` prop and weathered salvage shelter F0, generic ore+coal cache | Wreck salvage / mid after testing | Ship stock, steel or pipe remnants | Do not make free Gear with no corresponding machine evidence |
| `po_oldpump` | F03 `pipe_store` F0; GOLD notes deeper core gate needing card+electricity+protection | Mid maintenance in *proven open periphery* only | Old hydraulic plant supports pipe repair logic | Do not silently unlock or place stock beyond unimplemented access gate |

**Assessment roster is not a 12-point mandatory quest**. It spans near-spawn alternatives, deeper specialized routes, material-rich industrial stops, and authored multi-floor locations. Any assigned room/source must pass authored-plan occupancy, door/stair reach, item custody, 200×200 window shift, saved floor return and old-run isolation. The F03 designs have meaningful process-specific rooms; **do not replace Map's architecture** simply to host a crate. `po_ironvein` rest48 F-1 adit exists; no claim about its current ore quantity without a path/source audit.

### 11.5 Implementation architecture restrictions (not an implementation order)

- Reuse the **conceptual `LootSourceSpec`** and existing deterministic roll engine, but do not try to call unchanged `SHIPPING_LOOT_SOURCES`, `lootClass()` or `validLootSourceContract()` directly for the full global Veyra world.
- Define a versioned **global authored Veyra-source registry**, keyed by `runId / sourceVersion / poiId / floor / stableSourceKey`. Evaluate access from real local physical geometry upon entering the source window; do not assume all 81 sites loaded. Store physical stock in one custody owner and durable cycle/issuance/depletion timer in one run ledger; preserve existing item UIDs across unload/reload. A full spec digest change must not automatically invalidate/erase legitimate old runs: keep their compatible older spec versions or explicit safe migration.
- Add per-group stock policy: e.g. `baseMaterials: renewable`, `generatedOption: renewable or finite`, `oneOffUnique: finite`; never synthesize them from `ITEMS.cat==='res'`.
- A source is not "available" until location exists at valid unblocked floor cell, visible/interactable, and accessible via legal movement without debug teleport. A physically closed door means it remains gated; bypass classification must never give the rewards for free.
- Keep physical item economy, ordinary loot one-way (no PUT), partial custody, offline clock, per-cycle deterministic RNG not global RNG rerolling, legacy old save semantics, and no new post-run persistence.
- Add scarcity stress cases across 14 days: idle 336h without claiming, 14 daily exhaustions, old save updating, low-to-high grade transitions, source without authorized room, two different source IDs same POI, repeat intent replay, recursive site in new window, floor hatch transition and unloading while partial.
- **Economic failure tripwires:** no successful source roll if physical source didn't exist/access; no repeated bonus on reload; no advanced Gear flood proportional to time alone; no new mandatory recipe requirement sourced only from one locked room; no arbitrary flattening of uneven Veyra iron/scrap geography; no accidental refund arbitrage with Recycler.

### 11.6 Working recommendation / still-open Creator choices

**Working default for further exploration:** player-recognizable source family guarantees a *useful class* of material, while a small optional intermediate bonus follows grade, location and measured source rate. Ordinary mechanically plausible boxes may replenish according to their distinct cycle; unique story/cash/tech sources follow explicitly finite contracts. Exact Pipe/Gear/Plate/Blade drop weights, stock quantities, rollout versions, family-specific cooldown, risk adjustment and physical placements **remain unapproved**.

The next source-grounded task is to simulate several 336h/first-hour routes with these proposed odds and existing POI stock/physical travel, compare the outcomes with baseline and the risk of already-fixed B05 values, and then solicit Creator feedback only on material gameplay trade-offs rather than a generic "guaranteed or random" question.

---

## 12. HISTORICAL/SUPERSEDED: four current start windows vs literal spawn cells — QA clarification 2026-11-12

**Why recorded:** User challenged an ambiguous statement about "four spawns." This fixes the test scope; do not treat four GOLD geographic anchor coordinates as four exact runtime spawn points.

**Verified runtime `web/src/game/engine.ts` SHA `c6c6fc5`:**
- `VEYRA_SPAWN_LAYOUTS = ['veyra05-westmouth', U05_WORLD_LAYOUT_ID, 'veyra05-hook', 'veyra05-gulf']`. In `startRun(..., region=null, seedOverride?)` the selected region is either the user/QA supplied region index 0–3 or deterministic `seed % 4`; it selects a **regional 200×200 streaming window**, not an immutable spawn cell.
- `chooseLegalSpawn()` makes a seeded non-repeating traversal over candidates, requiring world collision / walkability, avoiding toxic/ash/snow, avoiding local threats, checking a 3×3 safe vicinity, and requiring reachable wood, rock, food, fresh water and at least 9 buildable sites within depth 30. Its own comment expressly states **"Compiler reachability anchors and Map sp_* are never player spawn authorities."** `spawnChoice` records chosen actual tile, not GOLD-map `sp_*`.
- GOLD `project.spawns` coordinates (Westmouth Shore, Greywater South Shore, Hook Meadow, Gulf West Bank) carry `conf='proposal'`. Their role is map reference/analysis only. Prior straight-line estimates are conceptual lower bounds from these references, never runtime spawn-to-POI walking routes.

**Proposed QA purpose (NOT performed):** Test *uneven industrial viability* across selected starts, not guarantee a loot item from any named POI or enforce one route. Four regional windows × multiple seed-selected legal spawn cells (illustrative minimum 10 independent starts per region, **40 trials total**, not an official power calculation) × several player-selected styles: (A) local roadside scrap → Iron via `scrap_ingot` → Workbench II/Gear; (B) natural ore+coal → self-crafted Gear/Pipe if reachable; (C) POI salvage including nearest maintenance and deeper specialized rooms without debug teleports. Runs should respect no boss/no Core/no quest constraints, but no mandatory script.

Per run log: actual `spawnChoice`, map/build SHA & loot spec version, player inventory, real path and first legal interaction to target source, successful loot withdrawals (including failed attempts), time to first **useful** part/Gear/Pipe; carrying weight, weapon/tool wear, water/food loss, encounters/radiation, travel/return time and survival; original cache UID/stock, take/drop/refill/save/relaunch continuity; compare to crafting baseline including furnace/fuel/Workbench costs. A route with no open source by 20min is a meaningful negative outcome. Ideally contrast at least multiple physical paths to a goal per region, not grant debug inventory to pass.

**Ordering:** First run native real-collision reachable-source validation and record what is accessible; THEN estimate openable rolls and expected outcomes under candidate 5/12/20% category chances (which are exploratory values). Do not simulate 14 daily openings from a source if traversability, cooldown and depletion are unproven. No evidence permits a current claim that all four regions are balanced or that any named completed component is actually lootable on Veyra.

---

## 13. RED_FLAG-SPAWN-001 — Fixed four-region test denominator is a false design premise (2026-11-12)

**Severity: P0 for design/acceptance correctness; not yet a proven runtime crash or creator-approved source-code migration.**
**Reporter: Creator.**
**RED-FLAG STATEMENT:** “Last Island không hề có cụ thể bao nhiêu điểm spawn cả.” We had extrapolated a SOH `4 regional windows × 10 starts` smoke-test into an assumed global player-spawn system / comprehensive loot-economy coverage. That extrapolation is **INVALID**. Creator requested this red flag be recorded, and work should continue without a fixed spawn count premise.

### 13.1 Evidence hierarchy: separate LI, SOH canon, existing code and maps

- **Last Island**: Independent Last Island of Survival beginner's guide (updated 2022-10-30, LevelWinner) explicitly describes **random starting/respawn areas**, rather than a documented four-point contract: https://www.levelwinner.com/last-day-rules-survival-beginners-guide-tips-cheats-strategies-to-become-a-top-survivor/ . Official 2019 `Civilization Restart` FAQ supports world/respawn gameplay but does **not** document an exact spawn-point count: https://hero.yingxiong.com/info/2019/0730/6973.html . **No assertion that LI has literally infinite possible cells or that LI's exact modern algorithm is known.**
- **SOH authoritative `web/ref/bible.md` §world**: stable geography, **random spawn in multiple valid safe areas** with nearby viable basic survival resources, geographical asymmetry; no numerical mandate for four regions/cells.
- **Current code, verified SHA `c6c6fc5`**: `engine.ts::VEYRA_SPAWN_LAYOUTS` contains four values: Westmouth, `U05_WORLD_LAYOUT_ID` (Greywater-centered world window), Hook and Gulf. `startRun` selects one region by seed modulo four or optional region index; `chooseLegalSpawn()` then pseudo-randomly scans eligible cells **within the currently loaded 200×200 tile window**. Thus four applies to the *first window's regional bias*, **not** exactly four spawn tiles and **not** the full Veyra map. In-game no global eligible-site sampling is currently demonstrated.
- **GOLD map** `project.world` is 2000×1400 AU, `land` has **8** island/land polygons, `pois` **81**, `zones` **23** named candidate terrain/building locality polygons, and `spawns` **4 proposal anchors** (`conf:'proposal'`) used as geographic reference; they do **not** authorize runtime spawn policy or assert that 23 zones are all safe, connected or reachable.
- **Current scene implementation** `web/src/veyra05/scenes.ts` uses streaming 200×200 tile =100×100 AU windows; other scenes exist (Argus, Saltwick, Slag, Cinder etc.) but are **not selected by the four-branch fresh-run chooser**. A streaming window catalog is a technical subdivision, not a population/spawn zoning mandate.

### 13.2 Why this is a gameplay/economic risk and what is actually proven

The previous four-region test plan excluded all regions not selected in `VEYRA_SPAWN_LAYOUTS`, disproportionately sampling main-island first-hour scenery. Unbalanced availability, island isolation, heat/cold/toxic starts, POI variety and logistics costs would be missed. This is a **test coverage invalidity** independent of whether four current starting windows produce legal positions.

Two different questions MUST be separated:

1. **Current implementation acceptance (bounded):** In the four currently selected starting windows, are random chosen cells safe and survival-capable? This remains an implementation smoke test, not representative global design validation.
2. **Whole-world design suitability (global):** Across the intended full world, which land/biome cells can support legal starts, which cannot safely start until traversal systems (boat, bridges), hazards or basic resource access exist, and how does local economy vary? This is a separate assessment and requires a global candidate generator / static geometry scan and real movement sampling.

No forced equal opportunity for Pipe/Gear/ore: valid cold, coast, wetlands and valley starts can have **different** industrial pathways. No universal loot gift, no guaranteed mid-tier part, no per-zone fixed quota and no compulsory route to a remote foundry.

### 13.3 Replacement full-map verification, not “4×10 starts”

**Step A — Discover actual *eligible cells*, not pre-name spawn points.** Scan entire streamed frame through Veyra's existing stable world geometry, in windows or global raster. Candidate conditions must be verified on physical tile/collision and source graph: safe player footprint, no immediate lethal terrain, reachable starter wood+stone+food+fresh water (not only Euclidean radius), real buildable site, no blockers/hostile spawn trap, and at least one plausible exit route. Reject an isolated island without a proven boat/bridge/escape plan; the zone name alone does not confer spawn eligibility.

**Step B — Coverage strata derived from actual eligible set, not fixed four.** Group eligible cells by actual landmass, measured biome / hazard band, resource ecology, near-road vs remote and POI accessibility. Sample *all nonempty eligible clusters* with deterministic seeds. Sampling count grows from measured candidate diversity and failure cases; no universal fixed number of spawn regions is assumed. Preserve four implementation-window tests as a separate backward-compatibility track.

**Step C — Economic journey comparisons from each eligible class**, not every exact tile: (1) immediate natural survival baseline and early knife → stone tools, (2) Scrap→Iron via Furnace→Workbench II→Gear, (3) quarry/coal→Refined Iron→Pipe, (4) relevant real industrial POI salvage, (5) route back/storage/recycler; collect actual paths, hazard exposures, hunger/thirst, tools and capacity, stock/cooldown/UID persistence, failed crossings and recovery. The metric is **plural viable player choices** rather than every start guaranteeing one Gear.

**Step D — Class-based loot simulation** only over physically reachable sources. Evaluate expected output per opened source-cycle at actual travel / consumption, controlled by per-source versioned deterministic roll. Do not use four GOLD `sp_*` geographic references as distance origins in a balance acceptance claim.

**Test deliverables:** eligible-cell / rejected-reason heatmap; strata list including island and hazardous edge cases; source-to-goal path matrix; 14-day full-run renewal / conservation stress trials; first 20-minute exploratory play outcomes; correct legacy save and no debug grants. All passed from one pinned build SHA and physical evidence where claims require gameplay proof.

### 13.4 New macro-geography diagnostic (static, not runtime spawn eligibility)

Read-only polygon/POI study from GOLD `project.zones[].ring` and `project.pois[].at`, using **area-weighted polygon centroid** and straight-line distance (AU), without terrain/collision/bridge checks:

- **23 named locality polygons** (one explicitly `Slag Flats Pad (đất độc — viability thấp)`): no claim all are viable/safe spawn candidates.
- **81 POIs** across **8 land polygons**; straight-line POI proximity from zone centroid: **4 of 23** zone centers have **zero POI inside 75 AU** (Mossbrook Valley Floor, Greyback Foothill Shelf, Dune Rock Outcrop, North Woods Hollow); **8 have exactly one POI**, **7 have exactly two**, **4 have ≥3** within this radius. This is an *exploration density proxy* only, not 4 sites to modify or proof of traversability.
- Example: North Woods Hollow nearest POI is `po_rc_dam` (~139 AU by geometry), but that is a **special Ragnarok cash POI**, not an ordinary loot source. A simple nearest-POI metric is therefore insufficient to certify early economic viability.
- Example: Saltwick Flats zone center has three POIs within 75 AU but **is an offshore landmass**; local POI count cannot prove water, food, exit or transport. Slag Flats zone nearest `po_slag` ~58 AU but toxicity may disqualify spawn.
- Implication for item-source allocation: score **reachable usable source classes** (scrap, food, wood, stone, water, quarry ore, maintenance, foundry) rather than raw POI count or membership in a hardcoded start region. Roadside `SOURCES` can supply useful inputs independently of POI proximity.

### 13.5 Action owner and status

- **DESIGN CHANGE — RECOMMENDED:** no hardcoded `4` in gameplay spawn authority as a canonical design requirement. The eventual choice of safe-global spawn sampling vs weighted-eligible-zone sampling is pending source and QA constraints; it must preserve deterministic run and avoid stranded islands.
- **AUDIT CHANGE — NOW ACTIVE:** retire §12 four-region matrix as whole-world acceptance standard; retain it only as 4-window regression/smoke coverage.
- **ECONOMY DESIGN — CONTINUES:** proceed with Veyra's source-class × grade × actual physical room/access × stock/renewal matrix across all eligible geography; not fixed start count.
- **IMPLEMENTATION STATE:** NOT CHANGED. Current runtime still has four starting windows until code work is specifically approved. No claim of native or browser gameplay run made here.
- **SOURCE STATUS:** LI spawn area randomness supported by historical guide; exact algorithm/count unknown. SOH Bible is stronger for desired behavior than the four current map anchors. All proposed full-world QA outcomes still untested.

### 13.6 POI-function-aware coverage check (more precise static diagnostic)

Excluding 6 Elder sites, 6 special Ragnarok cash POIs, 2 vendors, and 3 evacuations = **17 non-ordinary POIs**; **64 ordinary/interactable exploration POI roles** remain in the 81-POI registry. This is a provisional class filter, NOT proof all 64 provide loot to a fresh character. Recompute the centroid/straight-line proxy excluding those 17:
- Within 75 AU of each of the 23 named zone polygon centroids, the counts of **ordinary POI IDs** are: zero: **4 zones**, exactly one: **12 zones**, exactly two: **4 zones**, three or more: **3 zones**.
- Four zero-centroid/proxy zones: **Mossbrook Valley Floor** (nearest `po_sapgrove`, ~83 AU), **Greyback Foothill Shelf** (nearest `po_greyquarry`, ~107 AU), **Dune Rock Outcrop** (nearest `po_cairns`, ~83 AU), **North Woods Hollow** (nearest `po_academy`, ~142 AU; likely gated specialist). All four have at least one *ordinary POI ID* inside 150 AU by straight line; not an accessibility pass.
- **Misleading-nearest examples:** Ironvein Ridge: nearest any-POI `po_rc_meridian` (Ragnarok cash) ~36 AU vs nearest ordinary `po_ironvein` ~48 AU. Westmouth: nearest any `po_evac_west` (evac) ~48 AU vs nearest ordinary `po_westmouth` ~55 AU. Kestrel: nearest any `po_rc_kestrel` (Ragnarok cash) ~32 AU vs ordinary `po_kestrel` ~52 AU. North Woods: nearest `po_rc_dam` (special cash) ~139 AU vs ordinary `po_academy` ~142 AU.
- **Design correction:** a radius to the nearest named POI is NOT a radius to accessible tools, scrap, food, wood, freshwater or industrial stock. Categorize each POI by *physical source role and actual access* and include roadside/natural sources, otherwise tests produce false-positive economics. This analysis cannot identify which geographic cells are legal spawns and has not simulated routes.

No new spawn count, no uniform POI-distance target, no changes to quantities/cooldowns.
