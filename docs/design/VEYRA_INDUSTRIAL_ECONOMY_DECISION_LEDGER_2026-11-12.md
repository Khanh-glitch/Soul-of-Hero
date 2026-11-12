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
