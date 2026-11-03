# MAP-SCALE-01A — acceptance assessment

**Scope:** decision-support measurement against the *actual* SOH Gameplay Bible and PR44 HEAD
implementation. **Not** a survivability pass, **not** a playable full-world integration,
**not** an approval of any scale. Every row separates **MEASURED** results, **ASSUMPTIONS**
and **MISSING** Gameplay rules/tests. Source-linked data:
`output/benchmark.v1.json :: acceptance`, `output/gameplay_sources.v1.json :: bible`.

> Creator rule: **MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.**

---

## K2 — Environment / surface / topology

- **MEASURED.** Veyra GOLD `19d8c6ec…`: 8 landmasses, 5 lakes, 17 rivers, 92 roads, 12 bridges,
  27 docks, 23 zones, 81 POIs, 280 resource annotations, 4 spawns, 6 Elder territories, 24
  labels = **579 source IDs**; `2000×1400` authoring units; embedded `250×175` raster at 8 au
  per cell; 12-code biome array; `coast` = 812 cells. PR44 HEAD `terrainSpeed`: 14 keys
  (road/bridge 1.28, floor 1.10, grass/meadow 1.00, forest 0.86, sand 0.88, marsh 0.62,
  shallow 0.50, snow 0.78, hill 0.90, ash 0.92, toxic 0.95, burnt 1.00, ice 1.05).
  `world.ts` `seaDist` BFS stops at 6 hops → meaningful coverage 0% / 5.39% / 15.29% /
  31.91% of land cells at U=1/2/4/8.
- **ASSUMPTION.** The benchmark maps the 12 MapLab biome codes to those PR44 keys
  (`0 meadow, 1/2/3 forest, 4 marsh, 5 sand, 6 grass, 7 hill, 8 snow, 9 ash, 10 toxic,
  11 sand`). GEO-02 `maplab_encoding.v1.json` explicitly records that this mapping is
  **NOT_APPROVED_FOR_THE_14_STRING_GAMEPLAY_BIOME_ENUM**, and that code 0 on sea is a sentinel,
  not meadow. Road/river 9 au strokes and the 13×7.2 au bridge glyph are EDITOR
  analysis/display geometry, not physical widths.
- **MISSING.** Approved 12→14 biome mapping; Gameplay slope threshold; swept-clearance
  dimension; weather/trace/footprint *state* and `exposure_time` from a real simulation;
  Gameplay-approved hazard/weather region boundaries. `weather_tick / terrain_changed /
  decayed` events cannot be asserted from a static geometry benchmark.

## K3 — Sources / ecological economy

- **MEASURED.** 280 authored resource annotations (39 fish, 59 food, 54 wood, 19 herbs, 3 ore,
  30 stone, 2 clay, 4 sulfur, 4 obsidian, 65 fresh_water, 1 salt). For each of the 4 spawns:
  nearest annotation of `fresh_water`, `food/fish/herbs`, `wood/stone/ore`, and counts of each
  kind within 100/200/300 au (`output/benchmark.v1.json :: measured.resourceSuitability`).
  Example `sp_lake`: 50 annotations within 200 au (GEO-01 `resourceGeography`), 1,771
  candidate land cells / 113,344 au² in that radius.
- **ASSUMPTION.** Proximity of an annotation is treated as *geometric suitability only*.
  All 280 are `conf = proposal`; no Gameplay source ID is attached.
- **MISSING.** `SOURCES` / `catalog.ts` source-ID mapping, stock, HP, finite/respawn policy,
  harvest legality, item yields, `source_depleted / grant_once / recovered` receipts. A
  "resource dot near spawn" is not proof that a no-Core starter can drink, eat or craft.

## K6 — Territory / building / multi-layer POI

- **MEASURED.** PR44 HEAD `world.ts` authored buildings 5×4 … 17×12 tiles (smallest 5×4 =
  20 tiles², 4-tile side); `STRUCTS` are single-tile instances; `claimRadius` 6 tiles,
  `maxClaims` 2, `claimMinDistFromPoi` 10 tiles, `tenderLinkTiles` 3, build range
  `4.6*TILE`, near interaction 2.2 / 3 tiles. Per scale: entrance open tiles, POI foot
  tiles², workspace tiles², bridge glyph tiles, number of POI feet unable to hold a room.
  Three alternative home zones measured from `sp_lake`: `bz_silver`, `bz_hook`,
  `bz_ironholm` (the last is UNRESOLVED — disconnected land component). Canonical Veyra POIs
  have **0 authored doors, rooms, corridors or workspaces** and only a textual `access` label.
- **ASSUMPTION.** The 3.696 au entrance and 57.4232 au² workspace come from the GEO-02
  **PROPOSED** `po_kilns` shell (`canonical: false`), used only as a worked scale probe. A
  3×3 tile working envelope is derived from `near(r,e,3)`, not an approved dimension.
- **MISSING.** Gameplay-owned lock/keycard/power states, loot, hazards, item sockets, retreat
  success; roof-hidden-when-inside behaviour; three houses actually built by testers with
  collision, garden, furnace, freight and differing monster encounters. `geography-contract.ts`
  requires footprint/entrances/rooms/doors/power/loot/retreat sites that Veyra canon does not
  yet author.

## K7 — Travel / freight / route economy

- **MEASURED.** 51 source-linked journeys; 41 with straight-line distance, terrain-weighted
  raster route, and foot + 3 loaded-cart scenario times at U=1/2/4/8; 10 explicitly
  UNRESOLVED with **no time**. RT-1/RT-2/RT-3 authored corridor lengths (400.1147 /
  403.9036 / 398.0289 au) with cart-road vs trail split. RT-1 at U=2: 22.16 s straight
  lower bound, 31.58 s geographic route, 90.80 s loaded cart (`cw=240`). Cross-world width at
  U=2 = 222.22 s = 15.43% of a 24-min fictional day. Cart-road raster has **6** disconnected
  8-connected components (largest 643 cells); walkable land has **9** components.
  `po_kilns` nearest cart road `rd_n` = 56.8792 au > `ACCESS_R = 48`, foot trail `rd_16` = 0 au;
  `br_4` cart crossing clearance 0.1433 au, `br_a` foot-only 0.0342 au; one zero-clearance
  cell `[732,652]`.
- **ASSUMPTION.** Loaded-cart figures are **modelled on the same foot route** using the PR44
  cart profile; they are explicitly `MODELLED_SCENARIO…NOT_A_CART_PASSABILITY_CLAIM`.
  Trail segments use `speedOffRoad`, never `speedOnRoad`. `cartPassable = false` and
  `cartRoadRouteVerified = false` for **every** journey.
- **MISSING.** Gameplay cart footprint/swept-clearance rule; slope, bridge load/width,
  water/ford/ice thresholds; repair/fuel/opportunity cost; a continuous physically verified
  cargo road; approved ferry/boat/cargo rule for 8 landmasses; `exposure_time`,
  `footprint_monster_intersections`, `retreat_success`, `usable_loot_net`,
  `deposit_completed` from a real creature/hazard simulation. **Never label an incomplete
  trail cart-passable.** RT-1's `rd_13 / rd_1w / rd_16` are `kind = trail`.

## K8 — Clock / run / Ragnarok / profile

- **MEASURED.** PR44 HEAD `HOUR = 3,600,000 ms`; `runElapsedMs = now - startedAt + qaOffset`;
  `maxRunHours 336` = 1,209,600 s; Ragnarok final 72 h; danger day 12; Elders day 14;
  fictional day/night 24 real min (separate `dayTime` clock). All modelled times are real
  seconds, converted to game hours and to a fraction of the fictional day. Bible §5 K8 states
  "thời gian thật của run … tối đa 1.209.600 giây. Cửa sổ Ragnarok là 259.200 giây cuối."
- **ASSUMPTION.** 1 game hour = 3,600 real seconds (the HEAD code uses real elapsed ms).
  Fictional day/night is reported separately, not mixed into the run clock.
- **MISSING.** Offline/event causality, save size, `mapDigest` and streaming/LOD for a
  >40,000-cell world; no world-streaming loader exists in PR44 HEAD `web/src/game/*`.
  No global leaderboard verification is asserted.

---

## MAP-SPAWN-04 — four spawns, no-Core survival loop

- **MEASURED (geometry).** All 4 spawns carry 8 journeys each. Straight-line distances to
  nearest water / food / tool material / build zone / near POI / far POI / Elder approach /
  cart corridor (table in `SCALE_COMPARISON.md` §3). Resource suitability within
  100/200/300 au and buildable land cells within 300 au per spawn. PR44 C24 reference:
  current Web prototype has wood/stone/food within 12 tiles of each start; at U=2 that is
  24 au, at U=8 it is 96 au.
- **MISSING / insufficient evidence.** A "safe dot on a map" is explicitly insufficient.
  Requires a 30–60 min blind-novice first session without Core, real water/food/tool source
  IDs, collision, a road vs off-road choice and a route to buildable land. `sp_gulf`'s nearest
  water annotation is 92.04 au away but has **no connected foot route** on the accepted masks —
  an approved ferry/bridge rule is needed before claiming starter viability.

## MAP-HOME-03 — three tester-chosen houses

- **MEASURED.** Three distinct alternative zones from the chosen spawn `sp_lake`, using the
  area-weighted polygon centroid of each authored ring: `bz_silver` 103.8557 au straight /
  127.5591 au route, `bz_hook` 542.4717 / 814.2974 au, `bz_ironholm` 745.5038 au
  **UNRESOLVED** (separate land component); plus per-scale claim radius
  (6/12/24/48 au at U=1/2/4/8) and `claimMinDistFromPoi` (10/20/40/80 au).
- **MISSING / insufficient evidence.** A buildable % or three HousePins are explicitly
  insufficient. Requires 3 real houses with collision, roof transparency, garden/furnace,
  freight and *different* monster-route encounters, at each candidate scale. At U=4/U=8 the
  3.696 au entrance quantizes to zero tiles, so an enclosed house with a door cannot be
  expressed at all.

## MAP-LOG-03 — foot road vs cart road, far warehouse, route changed by weather/enemy

- **MEASURED.** `po_kilns` foot trail `rd_16` at 0 au and cart road `rd_n` at 56.8792 au
  (GEO-02); `po_kilns → po_ironwh` (Ironholm Depot, `arche = warehouse`) 603.8096 au straight;
  RT-1 authored chain 136.4366 au cart + 226.4759 au trail; RT-1/2/3 authored-chain times
  split into foot / unloaded cart / loaded cart. Distinct foot-vs-cart *geometry* exists.
- **MISSING / insufficient evidence.** "Không có item/collision/xe thật" — a real cart
  instance, cargo items, collision and a **continuous physically verified** cargo route;
  a far warehouse whose value measurably rises after a cart; a weather/enemy-driven route
  change. `po_kilns → po_ironwh` has no connected foot route on the accepted masks (ferry
  rule missing). No incomplete trail is labelled cart-passable.

## MAP-U4 — no-boss cash → seller → base → chest → deposit → optional evacuation

- **MEASURED.** Distances for 3 legs using canonical POIs: nearest `chest_vendor` → nearest
  `ragnarok_cache`, cache → `bz_greywater`, home → nearest `evac`. `cache → bz_greywater` is
  351.2031 au straight / 690.8183 au terrain-weighted route (detour 1.97×). PR44 HEAD escrow
  price is 30 cash, 7 sealed cash chests, vendor/claim/deposit intents exist.
- **MISSING / insufficient evidence.** Bible §5.4 explicitly: "**Giá, stock, seller,
  khoảng cách, quyền đất, số chuyến và khả năng route này tối ưu chưa chốt**". A physical
  cash→purchase→claim→deposit run with real item instances, multiple trips, a storm-blocked
  branch and no cargo teleport is required. "Chest icon + bank icon in map" is insufficient.

## MAP-U5 — six distinct Elder regions + no-boss retreat

- **MEASURED.** Six authored Elder territories (`el_surtur`, `el_typhon`, `el_aion`,
  `el_atlas`, `el_argus`, `el_anubis`) each with 44-point outer/core rings, 1–3 `approach`
  points, associated `pois` and `ragnarok` data — not one shared arena. Straight-line
  distances from `sp_lake` measured for all six (two are UNRESOLVED: separate land component).
  `geography-contract.ts` / `validateRuntimeMapPackage()` require all six unique Elder sites.
- **MISSING / insufficient evidence.** Six symmetric coloured zones or empty boss rooms are
  explicitly insufficient. Requires pre-/post-awakening physical regions with distinct point
  sources, at least one verified no-boss retreat path, and real Elder AI/hazard behaviour.
  Canonical POIs have `retreat` arrays but no validated swept clearance.

---

## Cross-cutting honesty gates (enforced by `src/test.mjs`, 48/48)

1. `cartPassable === false` and `cartRoadRouteVerified === false` for all 51 journeys.
2. Any route with `trailOnlyCells > 0` carries `AUTHORED_TRAIL_SEGMENTS__NOT_CART_PASSABLE`.
3. UNRESOLVED journeys have `geographicRouteSeconds = null`, all loaded-cart seconds `null`,
   and `exposureTimeSeconds = null` with `NOT_MEASURABLE` status.
4. `output/gameplay_sources.v1.json` proves PR44 HEAD `d80ad1b5…` was read and that it differs
   from pinned `a956c9e…`.
5. Two fresh benchmark runs are byte-identical; GEO-01/02 accepted outputs unchanged.
6. No production branch, `web/`, canonical Veyra, MAP-R01 art or Gameplay economy was modified.
