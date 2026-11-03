# MAP-SCALE-01A — compact scale comparison & bounded shortlist

**All four rows are DIAGNOSTIC CANDIDATES, not approved sizes.** `U` = Veyra authoring units
per one runtime tile; `TILE = 16 px` stays fixed (PR44 HEAD `core.ts`). Full `2000 × 1400`
authoring geometry is unchanged for every row — no crop, warp or rescale of canon.

Visual: `output/scale_comparison.png` (also `.svg` / `.html`).
Machine-readable: `output/comparison.v1.json`, `output/metrics.v1.json`,
`output/benchmark.v1.json`.

## 1. World dimensions, cells, runtime limits

| U (au/tile) | world tiles | world px | cells | 1M-cell economy validator | exact package validator `200×200 @16` | fixed `WW/WH` grid | render chunk key `cy*100+cx` | `seaDist` meaningful land coverage | memory lower bound | chunk-cache upper bound | camera screens across |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2000×1400 | 32000×22400 | 2,800,000 | **FAIL** (>1,000,000) | FAIL | FAIL | **FAIL** (125 cols > stride 100) | 0.00% | 403.21 MB | 2,750 MB | 50 × 62.2 |
| 2 | 1000×700 | 16000×11200 | 700,000 | PASS | FAIL | FAIL | PASS (63×44 chunks) | 5.39% | 100.80 MB | 693 MB | 25 × 31.1 |
| 4 | 500×350 | 8000×5600 | 175,000 | PASS | FAIL | FAIL | PASS (32×22) | 15.29% | 25.20 MB | 176 MB | 12.5 × 15.6 |
| 8 | 250×175 | 4000×2800 | 43,750 | PASS | FAIL | FAIL | PASS (16×11) | 31.91% | 6.30 MB | 44 MB | 6.25 × 7.8 |

Notes.

- `U = 8` is the tempting native-raster match: `250×175 = 43,750` cells equals the Veyra
  embedded terrain grid and is closest to the current `40,000`-cell Web runtime. **It is not
  selected.** This is exactly the "convenient integer dimension" trap the brief forbids.
- `U = 1` is 64× the source raster by cell count but adds **no new authored detail**: the
  source grid is 8 au/cell, so `U<8` only duplicates/interpolates; the coastline remains an
  8-au staircase repeated `8/U` times per axis. The `SHORELINE_DETAIL` row in the feasibility
  matrix records this as a measured loss (812 authored coast cells, no new bay/isthmus detail);
  `CARGO_CORRIDOR_AUTHORING` records that RT-1 contains 226.4759 au of `kind=trail` segments
  and the cart-road raster has 6 components — a **scale-independent** blocker that no choice
  of `U` repairs.
- **Every** row fails `validateRuntimeMapPackage()` and `core.ts`' fixed `WW = WH = 200`.
  That is a *global* runtime/contract change required by any full-Veyra intake, not a
  differentiator between rows. `render.ts` chunk cache is a cache, **not** world streaming;
  no LOD/streaming loader exists in PR44 HEAD.
- `seaDist` BFS stops at 6 hops in `world.ts`, so inland cells stay at sentinel 255. Finer
  scales lose that semantic almost entirely; this is a measured loss, not a hard gate.

## 2. Spatial resolution / physical gameplay feasibility

Thresholds come from actual HEAD code: player diameter 0.5 tile, cart diameter 0.625 tile;
smallest authored building 5×4 = 20 tiles² (4-tile side); `near(r,e,3)` → derived 3×3 = 9
tiles² minimum working envelope; one open floor tile is the atomic unit. Canonical Veyra
smallest POI foot = 176 au² with an 11 au edge; median = 851.84 au². The 3.696 au west
opening and 57.4232 au² workspace come from the **GEO-02 PROPOSED** (non-canonical)
`po_kilns` shell and are used only as worked scale probes.

| Feature (au) | U=1 | U=2 | U=4 | U=8 |
| --- | --- | --- | --- | --- |
| Entrance 3.696 → **open tiles** `floor(3.696/U)` | **3** | **1** | **0** | **0** |
| Smallest POI foot → tiles² | 176 | 44 | 11 | 2.75 |
| Median POI foot → tiles² | 851.84 | 212.96 | 53.24 | 13.31 |
| Smallest POI edge → tiles | 11 | 5.5 | 2.75 | 1.375 |
| PROPOSED workspace → tiles² | 57.42 | 14.36 | 3.59 | 0.90 |
| Road 9 au stroke → **open tiles** | 9 | 4 | 2 | 1 |
| River 9 au mask → **open tiles** | 9 | 4 | 2 | 1 |
| Bridge glyph 13×7.2 au → **open tiles** | 13×7 | 6×3 | 3×1 | 1×**0** |
| Claim radius / min POI distance (au) | 6 / 10 | 12 / 20 | 24 / 40 | 48 / 80 |
| POI feet unable to hold smallest 5×4 room (of 81) | 0 | 0 | **81** | **81** |
| Road bends with radius < 1 tile (of 1,080 measured) | 0 | 0 | 0 | **6** |
| Gating spatial/engine failures | 2 | **0** | 5 | 6 |

Interpretation.

- At `U=4` and `U=8` the 3.696 au entrance quantizes to **zero open tiles**. A door cannot
  be a sub-tile object in PR44 (`STRUCTS` occupy one tile centre). At `U=8` the 7.2 au bridge
  short axis also becomes zero tiles, and six road bends fall below one tile.
- At `U=4`/`U=8` **all 81** canonical POI feet are too small to host even the smallest
  authored PR44 building, so `geography-contract.ts` requirements (footprint, entrances,
  rooms, doors, retreat) cannot be met. `U=8` also collapses the median POI to 13.31 tiles².
- At `U=2` the entrance is 1 open tile (cart diameter 0.625 tile fits inside one tile), the
  smallest POI is 44 tiles² with a 5.5-tile edge, the median POI is 212.96 tiles², and the
  PROPOSED workspace is 14.36 tiles² (above the derived 9-tile envelope). Roads/rivers are
  4 open tiles; bridge glyph 6×3 tiles.
- `U=1` is spatially the richest but is rejected by the 1,000,000-cell economy validator and
  the render chunk-key collision.

## 3. Modelled travel time (real seconds)

Formula: `speed = 72 px/s × U / 16 px = 4.5U au/s`. Straight-line = unobstructed neutral
terrain **lower bound**. Geographic route = 8-neighbour Dijkstra on the accepted GEO-01/02
land/water/road/bridge masks, cost `Σ (stepAu / terrainSpeedMultiplier)`. Loaded cart =
PR44 cart profile on the **same foot route**, `weightPenalty = max(0.25, 1 − cw/100 × 0.18)`,
`cw = 240` (normal cart `maxWeight`). PR44 `run` clock is real elapsed ms, so 1 game hour =
3,600 s; the 24-min fictional day is a separate clock.

### RT-1 authored corridor, `sp_lake [790,622] → po_kilns [905,785]`
straight **199.4843 au**, terrain-weighted raster route **346.1492 au** (detour 1.7352×),
effective foot cost 284.1852 grass-equivalent au. The route contains **25 trail-only cells**,
1 bridge cell, 7 cart-road cells.

| U | straight-line s | geographic route s | unloaded cart s | loaded cart `cw=240` s | freight `cw=360` s | hunger drain on route |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 44.33 | 63.15 | 103.15 | 181.60 | 293.04 | 2.53 |
| 2 | 22.16 | 31.58 | 51.58 | 90.80 | 146.52 | 1.26 |
| 4 | 11.08 | 15.79 | 25.79 | 45.40 | 73.26 | 0.63 |
| 8 | 5.54 | 7.89 | 12.89 | 22.70 | 36.63 | 0.32 |

The **authored** RT-1 road chain (GEO-01) is 400.1147 au: 136.4366 au of `kind=cart` road
and **226.4759 au of `kind=trail`** (`rd_13`, `rd_1w`, `rd_16`). At `U=2` its authored-chain
foot time is 35.64 s and its loaded-cart scenario 91.26 s — but `cartPassable = false`,
because GEO-02 measured a foot-only `br_a` crossing (0.0342 au), a zero-clearance cell
`[732,652]`, `po_kilns` 56.8792 au from the nearest cart road (`rd_n`, beyond `ACCESS_R=48`),
and **no swept-clearance dimension exists in the source**.

### Whole-world width (2000 au, neutral terrain)

| U | seconds | game hours | % of 24-min fictional day | % of 336 h run | hunger drain |
| --- | --- | --- | --- | --- | --- |
| 1 | 444.44 | 0.1235 | 30.86% | 0.04% | 17.78 |
| 2 | 222.22 | 0.0617 | 15.43% | 0.02% | 8.89 |
| 4 | 111.11 | 0.0309 | 7.72% | 0.01% | 4.44 |
| 8 | 55.56 | 0.0154 | 3.86% | 0.005% | 2.22 |

**Important negative result:** even the finest candidate `U=1` crosses all 2,000 au in under
8 real minutes at PR44's 72 px/s. None of the four scales makes distance alone a "long,
memorable journey" against a 336 h run. K7 journey cost must therefore come from cargo weight,
terrain, `exposure_time`, risk, repair/fuel and opportunity cost — all of which need Gameplay
rules/simulation that do not exist yet for a full Veyra world. A scale chosen only to make
travel times look attractive would be unsound.

### All four spawns (straight-line au; full route/times in `output/metrics.v1.json`)

| Spawn | water | food | tool material | build zone | near POI | far POI | Elder approach | cart corridor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sp_west` Westmouth Shore | 64.48 | 29.46 | 41.62 | 16.48 | 39.70 | 1522.43 | 169.45 | 25.16 |
| `sp_lake` Greywater South Shore | 28.63 | 46.69 | 31.62 | 10.77 | 37.20 | 1110.04 | 62.29 | 35.71 |
| `sp_hook` Hook Meadow | 42.80 | 36.40 | 37.74 | 0.78 | 40.00 | 1229.67 | 369.62 | 56.15 |
| `sp_gulf` Gulf West Bank | 92.04 | 14.00 | 26.00 | 12.99 | 46.00 | 1123.59 | 128.16 | 39.81 |

Basic-resource suitability areas (counts within 100 / 200 / 300 au per spawn and kind,
plus land/buildable cells within 300 au) are in
`output/benchmark.v1.json :: measured.resourceSuitability`. They are source annotations
(`conf = proposal`), **not** Gameplay-approved source IDs, stock or legality.

**10 of 51 journeys are UNRESOLVED, not timed.** Veyra has 8 landmasses, 12 bridges and
`kind = ferry` roads; the accepted masks produce **9** disconnected walkable components and
**6** disconnected cart-road components. All four `farPOI` journeys, two Elder approaches,
the far-warehouse journey, one alternative home and one starter-water journey have no
connected foot route. PR44 HEAD has **no approved ferry/boat/cargo rule**, so no time is
fabricated for them. This is a full-world gameplay blocker independent of scale.

## 4. Veyra preservation

| U | canonical geometry | authored raster | shoreline detail | road bends |
| --- | --- | --- | --- | --- |
| 1 | unchanged, 2000×1400, 579 source IDs | 8×8 tiles per 8 au cell (upsample, no new detail) | 8-au staircase repeated 8× | 0 lost |
| 2 | unchanged | 4×4 tiles per cell | repeated 4× | 0 lost |
| 4 | unchanged | 2×2 tiles per cell | repeated 2× | 0 lost |
| 8 | unchanged | 1 tile = 1 source cell (native 250×175) | representable at native resolution | **6** bends < 1 tile |

All rows keep the full geography; the differentiator is **tile granularity and runtime cost**,
not "how much of Veyra is kept". `U=8` preserves the raster 1:1 but destroys the physical
gameplay built on top of it.

## 5. Verdict

**Bounded shortlist: `U = 2` only — diagnostic, NOT approved.**

- `U = 1` — **rejected**: 2,800,000 cells exceeds `validateEconomyMap()`; 125 render chunk
  columns collide with `k = cy*100+cx`; ~403 MB lower-bound memory, 2,750 MB chunk cache.
  It is the spatial upper bound and shows what is lost by coarser scales.
- `U = 2` — **shortlist**: 700,000 cells (validator PASS), chunk key PASS, 1 open entrance
  tile, 44 tiles² smallest POI, 212.96 tiles² median POI, 14.36 tiles² workspace, 4-tile
  roads/rivers, 6×3 bridge, 0 POI feet losing a room. RT-1 route 31.58 s, loaded cart 90.80 s;
  cross-world 222.22 s (15.43% of a fictional day). Requires ~100.80 MB lower-bound world
  memory and up to ~693 MB chunk cache.
- `U = 4` — **rejected**: 0 open entrance tiles, all 81 POI feet too small for a room,
  workspace 3.59 tiles².
- `U = 8` — **rejected**: 0 open entrance tiles, 2.75 tiles² smallest POI, 0.90 tiles²
  workspace, zero-height bridge glyph, 6 road bends below one tile, 1-tile road with no
  2-tile cart clearance. Exactly reproduces the source raster, but that convenience does not
  make it playable.

**No final scale is approved.** All four fail the exact `200×200 @ TILE=16` package validator
and `core.ts` fixed 40,000-cell grid. Before a full-world intake, Gameplay/runtime must supply
the items in §6.

## 6. Exactly what is still required for an approved final scale

| ID | Required Gameplay parameter / physical test | Why it blocks approval |
| --- | --- | --- |
| `GAMEPLAY_BIOME_MAPPING` | Approved 12 MapLab/Veyra biome codes → 14-string PR44 `Biome` enum mapping + verified grid transform | Terrain-weighted times and `compileEconomy()` legality depend on it; GEO-02 left it open |
| `SWEPT_CLEARANCE` | Player/cart collision envelope + swept-clearance test for every authored road, door opening, bridge deck, shoreline and road bend | GEO-02 found a zero-clearance cell, a foot-only bridge and no swept-clearance dimension |
| `CART_PASSABILITY_RULES` | Slope threshold, bridge load/width, water/ford/ice rule, repair/fuel/opportunity cost, continuous cargo road graph | RT-1 contains trails; cart-road raster has 6 components; no trail may be labelled cart-passable |
| `FERRY_RULE` | Gameplay-approved ferry/boat/cargo traversal for 8 landmasses and `kind=ferry` roads | 10 of 51 journeys are disconnected on the accepted masks; no crossing time may be invented |
| `EXPOSURE_SIMULATION` | Creature spawn/habitat/trace/hazard simulation producing `exposure_time`, `footprint_monster_intersections`, `retreat_success` | Bible C13/K7 require route risk, not only route distance |
| `RUNTIME_WORLD_SIZE` | `WW/WH`, exact validator, chunk key stride, `seaDist` BFS, streaming/LOD, save/`mapDigest` memory budget for chosen `U` | No streaming implementation exists; every candidate fails the exact package validator |
| `ECONOMY_ROUTE_APPROVAL` | MAP-U4 seller/price/stock/land rights/trips; MAP-LOG-03 far-warehouse value increase; MAP-HOME-03 three built houses | Bible explicitly leaves these unfixed; "map dots" are insufficient evidence |
| `HUMAN_640x360` | Pixel inspection at 640×360 1× of road, wall, footprint, door, hazard, character and workspace at chosen `U` | MAP-CAMERA / MAP-HOME-03 are human acceptance tests |

Full per-ID assessment: `ACCEPTANCE_ASSESSMENT.md` and
`output/benchmark.v1.json :: acceptance / missingRules / recommendation`.
