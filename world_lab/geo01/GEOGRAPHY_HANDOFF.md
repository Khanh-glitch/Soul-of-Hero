# MAP-GEO-01 — geography handoff for a future Gameplay compiler

**File:** `output/geography.v1.json` (`schema: soh.map.geography.v1`, ~1.43 MB)
**Rasters:** `output/rasters/*.u8` + `manifest.v1.json` (21 uint8 layers, 43,750 cells each)
**Status:** derived, reproducible, **not** a competing world source. Canonical source remains
`19d8c6ec…/map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json`.

Read `frame` first. Then `layers.semantics`. Then `physicalClassification`. Then `topology`.
`climate` and `unknowns` tell you what Map explicitly does **not** know.

## 0. Frame and transform (never implicit)

```
frame.authoring        = {w:2000, h:1400, unit:"authoring_unit"}
frame.grid             = {gw:250, gh:175, cell:8, cells:43750}
frame.transform.status = "UNDECIDED"      mode = "NONE_APPLIED"   configurable = true
frame.transform.config = {scaleX:1, scaleY:1, offsetX:0, offsetY:0, authoringUnitsPerCell:8}
frame.transform.runtimeReference = {WW:200, WH:200, TILE:16, requiredCells:40000}  // PR44 core.ts
```

`toCell(x,y) = [floor(x/8), floor(y/8)]` is the **only** conversion applied, and it is an index
lookup, not a world-scale decision. All 3,504 authored coordinate occurrences in `objects` are
byte-for-byte identical to the source. Nothing was stretched, cropped, padded or warped to fit
200×200. Any compiler must supply an approved `authoring_unit → runtime tile` transform plus
measured journey times before a single runtime cell is written.

## 1. Physical terrain, biome, elevation, slope

| Supply | Where | Status |
|---|---|---|
| elevation raw bytes | `rasters/elevation.u8`, `terrainEncoding.elevation` | **DIRECT decode**; unit `UNKNOWN_SOURCE_BYTE` |
| biome raw codes 0..11 | `rasters/biomeCode.u8`, `terrainEncoding.biome.codes` | **DIRECT decode**; legend `NOT_COMMITTED_IN_SOURCE` |
| slope gradient | `rasters/slope.u8` | **DERIVED**; `RAW_BYTE_DELTA_PER_GRID_CELL`, not normalized |
| land / lake / river / zone identity per cell | `landId`, `lakeId`, `riverId`, `zoneId` | **DERIVED** from authored polygons |
| semantic biome strings, physical elevation scale, passable slope threshold | — | **UNDEFINED / Gameplay-joint** |

Biome codes are shipped with honest evidence (count, `E=0` count, elevation min/max/mean) but
**no invented legend**. `world-economy.ts` needs one of 14 `Biome` strings; that mapping needs an
approved transform, not a guess from the elevation histogram.

## 2. Water, coastal geometry, transitions, crossings

| Supply | Where |
|---|---|
| sea / lake / river classification per cell | `waterClass` (0 none, 1 sea, 2 lake, 3 river centreline) |
| coast cells | `coast` (land cell with a 4-neighbour sea cell) |
| freshwater mask + proximity | `freshwater`, `freshwaterProximityCells` (BFS cells, ×8 = au) |
| closed coastline topology | `topology.land.coastline` (812 cells, 8 components), per-land area/perimeter/bbox |
| directed river source→mouth graph, mouth kinds, nav flags, features, per-river elevation/slope profiles | `topology.water` |
| authored bridge positions / fords | `crossingCandidate`, `topology.transport.bridges` |

**Not supplied:** `rivers[].width` is preserved but **not applied** as a physical channel width —
its unit is unestablished, so only centreline cells are treated as channel. Bridge-to-channel span
fit is `false` (unverified). Material transition atlases / autotile seams do not exist in Veyra;
neighbour transitions are *derivable* from the layers but not authored. Boat/portage rules are
Gameplay-owned.

## 3. Moisture / climate geography — explicitly UNKNOWN

`climate.status = "UNDEFINED_IN_SOURCE"`, `moisture.value = null`, `temperature.value = null`,
`hazardIntensity.value = null`. Veyra has **no** climate arrays. PR44's `EconomyMap` requires finite
`0..1` moisture and temperature per cell; filling them would be fabrication, so they are absent.

What Map *does* supply is **spatial potential** (clearly labelled as geometric, not climate):
`freshwaterProximityCells`, `seaDistanceCells`, `elevation`, `slope`, `zoneId`, `landId`,
`clearanceCells`. Gameplay may derive exposure/season/weather rules from these, but the values are
not climate. Ambient wind/rain/audio timing and gameplay effects are Gameplay/audio-owned.

## 4. Walkable / constrained / blocked / buildable / cargo candidates

| Layer | Meaning | Caveat |
|---|---|---|
| `walkableCandidate` | land polygon − lake − river centreline | slope threshold, collision, hazard, occupancy **not applied** |
| `waterClass` / `clearanceCells` | blocked geometry + distance to nearest blocked cell | river width unit unknown; clearance in grid cells |
| `slope` | raw gradient for a "constrained" classification | **no threshold supplied** |
| `buildableCandidate` | `walkableCandidate ∩ zones[].ring` | A0 protection / occupancy / route legality NOT asserted |
| `protectedGeometryCandidate` | POI foot/deep + Elder outer/core/arena overlap | geometry only; **NOT** A0's `protected` mask |
| `cargoCandidate` | cart roads + cart-load bridges + docks | `cargoPassable = UNDEFINED` (loaded-cart rules Gameplay-owned) |
| `crossingCandidate` | 0 none / 1 foot bridge / 2 cart bridge / 3 ford | channel fit unverified |

`topology.zones.buildableRegions` gives 23 candidate regions with area, centroid, cell counts,
nearest road, nearest POI, raw slope and freshwater/sea proximity. Clearance is measured, not
assumed.

## 5. Road class, width, slopes, bridges, route graph

`topology.transport.roads` = 92 verbatim polylines with derived length, `kind`, `conf`, `alt`,
`ford`, `purpose`, and **`widthAu: null / widthStatus: "NOT_IN_SOURCE"`**. `roadKinds` gives counts
and total length. `roadClass` is the per-cell raster. `routeGraph` = 131 nodes / 105 edges built
from authored endpoints, 17 exact segment intersections, and an **explicit configurable**
`joinToleranceAu = 8` (one cell). Ferry edges are flagged `ferry:true` and are **not** land roads.

`topology.transport.bridges` gives 12 bridges with `load`, nearest river/road distance and
`channelSpanFitVerified:false`. `docks` gives 27 with resolved `water` refs. Slopes along roads are
available via the `slope` layer but there is **no physical grade**, **no bridge span fit**, **no
loaded-cart limit**, **no ferry boarding rule**, and **no travel-time measurement**.

## 6. POI footprint, spatial rooms, passages, sockets

`topology.pois.pois` = 81 records preserving `id`, `at`, `rot`, `scale`, `foot`, `deep`, `depth`,
`retreat`, `links`, `access`, `gate`, `role`, `opp`, `notes`, `elder`, plus derived foot/deep areas,
bbox, centroid, footprint cells, nearest road/water and clearance.

`spatial` is explicit:

| Field | Status | Owner (MAP-GEO-02 correction) |
|---|---|---|
| `footprint`, `outerDeepRegions` | SUPPLIED / NOT_IN_SOURCE (18 have `deep`) | **Map** (site boundary, not an interior layout) |
| `retreatCandidates` | SUPPLIED for 18, else NOT_IN_SOURCE | **Map** (physical retreat geometry) |
| `passages` | PARTIAL (5 POIs have authored `links`) | **Map** |
| `rooms`, `entrances`, `entranceExitSockets`, `circulation`, `doorOpenings` | **NOT_IN_SOURCE** | **Map** — `MAP_RESPONSIBILITY_NOT_IN_SOURCE`; status ≠ owner |
| `doors.lockedState`, `powerNodes`, `hazardIntensity`, `lootSites`, interactions | **GAMEPLAY_OWNED** | **Gameplay** |

> **Correction.** MAP-GEO-01 said these physical POI fields were Gameplay-owned. That was wrong.
> The creator's rule is `MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.`
> Rooms, entrances, passages, door **openings**, circulation, spatial sockets and retreat paths are
> Map geometry even though Veyra has not authored them. Locked/**key**/**power** states, loot,
> power requirements, hazard intensity and interactions remain Gameplay-owned. The old `spatial`
> owner strings inside the accepted `geography.v1.json` are stale; the authoritative correction is
> `output/contract_boundary.v1.json → ownershipCorrection` and
> `../geo02/output/ownership_correction.v1.json`. No canonical rewrite was performed.

`gate:"key"/"power"/"hazard"` and `access`/`role` text are preserved **as provisional source
notes**, not as locked-door or power-plant law. No canonical interior room, door opening, socket,
loot site or NPC was invented. A separate `PROPOSED` Map-owned candidate for `po_kilns` lives in
`../geo02/output/poi_po_kilns.proposed.v1.json` and is explicitly **not** canonical.

## 7. Elder outer / core / arena / approach geography

`topology.elders.elders` = 6 distinct territories (`surtur`, `typhon`, `aion`, `atlas`, `argus`,
`anubis`) with verbatim `outer`, `core`, `arenas`, `approach`, `pois`, `ragnarok`, plus derived
areas/centroids/bboxes. `escapeTopology` is **PARTIAL** (approach points + prose design note with
`conf:proposal`), not a validated escape graph. `mappingStatus` is
`NO_GAMEPLAY_ELDER_MAPPING_CREATED`; boss behaviour, hazards, activation, rewards and dynamic state
are Gameplay-owned.

## 8. Resource suitability areas (NOT final instances)

`topology.resources.annotations` = 280 records with **source id**, `at`, `kind`, `r`, `dens`,
`gate`, `conf`, a suitability circle (`radiusAu`, `areaAu2`) and terrain context:
`elevationRawByte`, `biomeRawCode`, `slopeRawByteDelta`, `freshwaterProximityCells`,
`seaDistanceCells`, `landId`, `zoneId`, `walkableCandidate`.

Every record has `status: "CANDIDATE_GEOGRAPHIC_ANNOTATION"`,
`finalHarvestableInstances: "NOT_SUPPLIED"`, `stock/yield/respawn: "NOT_SUPPLIED"`,
`owner: "Gameplay population algorithm"`. `suitabilityWeights` and `biomeLegend` are UNDEFINED /
UNKNOWN. Map supplies **where physical conditions could suit** a kind; Gameplay decides **whether,
how many, how much, and when it regenerates**.

## Map–Gameplay boundary (worked examples)

| Domain | Map supplies | Gameplay supplies |
|---|---|---|
| FOREST | forest/extent geometry, walkability, raw slope, freshwater proximity, path clearances | oak/pine/bush selection, density, stock, regrowth, depletion, harvesting, persistence |
| MINE | geology (elevation/slope/zone soil tags), rock-formation area, POI shell, accessible route | ore source generation, hardness, yield, tools, depletion |
| POI | building shell, foot/deep regions, door-opening absence, passages (`links`), spatial sockets (UNDEFINED), circulation/retreat geometry | locked state, power/fuel, loot, NPCs, interactions, progression |
| ELDER | geographic territory, arena, approach, escape topology (partial) | boss behaviour, hazards/effects, activation, rewards, dynamic state |
| AMBIENCE | terrain, exposure *potential*, terrain features | wind/rain/ambient events, timing, gameplay effects |

Geographic landmarks that determine topology are fixed (all 579 ids). Ordinary collectible
resources are **not** fixed: they are generated through Gameplay systems from suitability areas.

## Consuming this file

```js
import fs from 'node:fs';
const geo = JSON.parse(fs.readFileSync('output/geography.v1.json','utf8'));
const manifest = JSON.parse(fs.readFileSync('output/rasters/manifest.v1.json','utf8'));
const layer = name => new Uint8Array(fs.readFileSync('output/' + manifest.layers.find(l => l.name === name).file));
const cell = (x, y) => Math.floor(y / geo.frame.grid.cell) * geo.frame.grid.gw + Math.floor(x / geo.frame.grid.cell);
// e.g. land/water/slope/buildable at an authored POI:
const p = geo.objects.pois.find(o => o.id === 'po_greywater');
const i = cell(p.at[0], p.at[1]);
console.log({ land: layer('landId')[i], water: layer('waterClass')[i], slope: layer('slope')[i], buildable: layer('buildableCandidate')[i] });
```

Verify every reader against `rasters/manifest.v1.json` SHA-256 values. Do not reinterpret
`biomeCode` without an approved legend, do not treat `walkableCandidate` as a collision mask, and
do not write a runtime tile until `frame.transform` is decided.
