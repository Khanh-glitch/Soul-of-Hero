# MAP-GEO-01 — real Veyra spatial corridor proof (milestone B)

**Command:** `node src/corridor.mjs` → `output/corridor.v1.json`
**Visual:** `output/corridor.svg` / `output/corridor.png` / `output/corridor.html`
**Status:** `GEOGRAPHIC_CORRIDOR_PROOF_NOT_GAMEPLAY_VALIDATION`.

> **This is not gameplay validation.** No harvestable resource, loot, stock, yield, monster,
> locked door, generator, ambient event, survival timer or economy rule was placed. The corridor
> is **NOT claimed to be naturally survivable** until Gameplay's actual population algorithm and
> survival rules have been applied. A static diagram is a geographic inspection, not a playtest.

## Why this spawn (measured, not chosen by preference)

Deterministic grounding score = sum of nearby authored objects within fixed radii
(roads 250 au, POIs 200 au, zones 300 au, bridges 250 au, docks 250 au, rivers 250 au),
tie-break by nearest road. All four Veyra spawns were measured:

| Spawn | At | Roads | POIs | Zones | Bridges | Docks | Rivers | Score |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| **`sp_lake`** Greywater South Shore | (790,622) | **23** | **12** | **10** | **6** | 4 | 4 | **59** |
| `sp_gulf` Gulf West Bank | (872,930) | 24 | 8 | 6 | 4 | 5 | 6 | 53 |
| `sp_hook` Hook Meadow | (1282,392) | 12 | 6 | 6 | 2 | 3 | 4 | 33 |
| `sp_west` Westmouth Shore | (372,606) | 10 | 6 | 4 | 0 | 4 | 2 | 26 |

`sp_lake` has the strongest grounded route: it sits inside `ld_veyra`, 51.8 au from `lk_grey`,
18 au from `rv_silver`, 10.3 au from buildable `bz_greywater`, and 37.2 au from the `po_greywater`
road junction where three authored cart roads meet (`rd_9`, `rd_b`, `rd_d`/`rd_20`).

## Target POI shell (existing, not invented)

`po_kilns` — "Charcoal Kilns", `arche:smelter`, `at [905,785]`, `depth:surface`, `gate:none`,
`elder:aion`, `conf:proposal`, authored 4-point `foot` polygon (area 496.7424 au², preserved
verbatim in `corridor.v1.json → targetSelection.poiShell.foot` and
`geography.v1.json → objects.pois`). Selection rule: existing POI shell with **≥2 authored
road-graph edges** and straight-line distance ≤300 au, ranked by edge count then authored route
length. `po_kilns` has 4 edges; 10 candidates qualified. `deep`, `rooms` and `entrances` are
`NOT_IN_SOURCE` / absent for this surface POI — and are nevertheless **Map-owned** physical
geometry (MAP-GEO-02 correction). A `PROPOSED`, non-canonical spatial candidate for this single POI
is in `../geo02/output/poi_po_kilns.proposed.v1.json`.

**Label correction (MAP-GEO-02):** RT-1's label "Authored cart corridor" is misleading. Only
`rd_b` is `kind:cart`; `rd_13`, `rd_1w` and `rd_16` are `kind:trail`. `br_4` is a cart bridge but
does not make the whole route a cart route. No physically traversable cart route to `po_kilns` is
claimed until road width, bridge span fit and swept clearance are validated.

## Safe initial terrain candidates

Radius **8 source cells = 64 au** around (790,622), centre cell 19348. **175 walkable candidate
cells**, clearance 1..6 cells (mean 2.8 = 22.4 au), raw slope 1..6 (mean 1.98). The lowest
raw-slope quartile (cutoff **1**) yields 12 listed candidates with elevation, biome raw code,
clearance and freshwater proximity per cell.

These are **relative** candidates (lowest quartile of nearby walkable cells), **not** spawn points
and **not** a safety verdict. No absolute safe-slope/safety threshold exists in Veyra; Gameplay owns
that rule.

## Nearby land suitable for basic resource generation

Within **200 au**: **1,771 walkable candidate cells** (113,344 au² of candidate land) and **50
existing Veyra geographic annotations** with source ids preserved:
`stone 4, wood 17, herbs 7, food 5, fresh_water 11, fish 6`. Each annotation keeps its authored
`at`, `r`, `dens`, `gate`, `conf` and gets terrain context (elevation raw byte, biome raw code,
slope, freshwater proximity, sea distance, zone/walkable flags).

`finalHarvestableInstances: "NOT_SUPPLIED"` — **no exact harvestable resource was placed**, and no
stock/yield/respawn/depletion was generated. Gameplay's population algorithm decides instances.

## More than one candidate build site

**10** authored buildable zone polygons within 300 au of the spawn, each with area, centroid,
bbox, verbatim `soil` / `water` / `slope` / `tags`, buildable flag, clearance and freshwater
proximity at the centroid. Nearest four:

| Zone | Distance to spawn (au) | Authored slope | Tags |
|---|---:|---|---|
| `bz_greywater` | 10.3372 | thoải | bờ hồ / bình nguyên |
| `bz_silver` | 52.7519 | phẳng | ven sông / bình nguyên |
| `bz_elder_clear` | 139.8702 | thoải | trong rừng |
| `bz_typhon_t` | 143.988 | dốc nhẹ | nền đá cao / gần trung tâm khai thác |

`a0Legality: NOT_ASSERTED` for all — A0 protection, collision, occupancy and route clearance are
Gameplay/A0-owned.

## Physically connected path to the POI shell

**Derived 4-neighbour land BFS on the source raster** (250×175, cell 8 au). Passable =
`walkableCandidate=1` **or** a river-centreline cell carrying an authored `crossingCandidate`
(bridge/ford). Start cell 19348, goal cell 24613 → **CONNECTED**, **50 grid steps = 400 au**
(rectilinear grid lower bound; **not** the authored polyline length, **not** travel time).

| Measure | Along BFS grid path | Along RT-1 authored route |
|---|---|---|
| cells / samples | 51 | 62 |
| clearance (cells) | min 0, mean 2.294, max 5 | min 0, mean 7.274, max 16 |
| clearance (au) | 0 .. 40 | 0 .. 128 |
| raw slope (byte deltas) | 1 .. 12, mean 3.922 | 1 .. 4, mean 2.032 |

**Exactly one crossing cell** on the BFS path: cell 20341 at authoring **(732,652)**,
`crossingValue 2` = cart bridge **`br_4`** over **`rv_silver`**. `br_4` is authored at
(732.0069, 649.8171), `load:cart`, `conf:proposal`, 0.1495 au from the `rv_silver` centreline.
Its channel span fit is **UNVERIFIED**.

## Source-linked routes (distance in authoring units)

The road graph uses authored endpoints, **17 exact segment intersections** and an explicit
configurable `joinToleranceAu = 8` (one source grid cell): 131 nodes / 105 edges.

| Route | Total au | Authored roads au | Derived connectors au | Authored road ids | Bridge within 8 au |
|---|---:|---:|---:|---|---|
| **RT-1** primary cart corridor | **400.1147** | 362.9125 | 37.2022 | `rd_b`, `rd_13`, `rd_1w`, `rd_16` | `br_4` (cart, 3.5157 au) |
| **RT-2** alternative (ban `rd_1w` detour) | 403.9036 | 366.7014 | 37.2022 | `rd_b`, `rd_13`, `rd_16` | `br_4` (cart) |
| **RT-3** alternative (riverside) | 398.0289 | 280.3206 | 117.7083 | `rd_20` | `br_a` (foot, 5.3283 au) |

RT-1: spawn (790,622) → **37.2022 au derived connector** → `po_greywater` junction (812,592) →
`rd_b` cart 136.4366 au (crossing `rv_silver` at `br_4`) → `po_sawaion` (748,668) → `rd_13` trail →
`rd_1w` (the source's `alt:true` forest detour) → `rd_16` trail → `po_kilns` foot shell (905,785).
All segment vertices are verbatim authored road points or exact segment intersections; every route
point is checked against the source by `src/test.mjs`.

**Return route** = RT-1 reversed (400.1147 au); a physically distinct return is available via
RT-2 or RT-3. **Alternative paths are authored**, not invented: `rd_1w` is flagged `alt:true` in
Veyra and `rd_20` is the authored "Greywater West Bank Path". RT-3's two derived connectors
(55.1 au + 62.6 au over land) are explicitly reported, not hidden.

## Dependencies and unresolved conditions

- **River:** `rv_silver` (`width:4`, unit UNKNOWN) crosses RT-1/RT-2 at `br_4`; `rv_grey_low`
  (`width:7`) runs 41.0 au from RT-1 and is followed by RT-3 (`rd_20`). Only centreline cells are
  treated as channel because the width unit is unestablished.
- **Bridge:** `br_4` (cart) for RT-1/RT-2, `br_a` (foot) for RT-3; `br_3` (cart) is 46.1 au from
  RT-1. All `conf:proposal`, `channelSpanFitVerified: false`. Loaded-cart grade limits are a
  Gameplay rule.
- **Slope:** raw byte gradient 1..4 along RT-1; **no passable slope threshold** is authored.
- **Ferry:** **0 ferry paths used** by any route. Nearest is `rd_2j` (Gulf ferry,
  `conf:assumption`) at 187.1 au from RT-1 / 126.6 au from any route. 8 ferry paths exist
  elsewhere; boat/boarding/portage rules are UNDEFINED and no ferry was flattened into a land road.
- **POI / climate / world scale:** rooms and entrances `NOT_IN_SOURCE` but **MAP_OWNED** (GEO-02
  supplies a `PROPOSED` candidate, not canonical data); climate and hazard intensity
  UNDEFINED; `frame.transform.status = UNDECIDED`; travel times `t_foot`, `t_cart_loaded`,
  `exposure_time` not measured.

## Visual inspection

`output/corridor.png` (1600×1300) and `output/corridor.svg` draw the **actual** Veyra land rings,
lakes, rivers (stroke = raw source `width` field), 92 roads colour-coded by kind, 23 buildable
zones, 81 POI shells, 12 bridges, 27 docks, 6 Elder outer territories, the 50 candidate resource
suitability circles, the BFS grid path (white dots) and RT-1/RT-2/RT-3. A 100-au scale bar, source
ids, a legend and an explicit "NOT GAMEPLAY VALIDATION" warning are included. It is a geographic
diagram — **not** a game screenshot, not an art proposal, not a substitute for real playtesting.

## What would be needed next

Gameplay must actually populate the corridor (source placement, survival rules, day/night, weather,
creatures, inventory carrying cost, 14-day clock), then run `compileEconomy` / `diagnoseStarts` and
real-input native proof. Map's job ends at the physical geography above.
