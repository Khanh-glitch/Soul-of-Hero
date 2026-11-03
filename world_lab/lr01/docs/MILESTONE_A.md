# MAP-LR01 Milestone A — corrected per-POI geometry & scale

**Status:** `MILESTONE_A__CORRECTED_SCALE_METHODOLOGY__RUNTIME_SCALE_STILL_UNDECIDED`
**Authority:** MAP designs the physical world; Gameplay populates and simulates it.
**Source:** canonical Veyra GOLD `19d8c6ec820f324a6ac12733165e43b5e2c6eab2`,
`map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json`, SHA-256
`88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256`, 332249 B.
The full **2000×1400 authoring frame is unchanged**. No canon edit, no runtime merge, no
Gameplay population.

## 1. The defect that is fixed

MAP-SCALE-01A (commit `9e0f0805`) computed
`poiFeetUnableToHostSmallestRoom` with a **global** `F.poiFoot.minEdgeAu`
(the minimum edge over all POIs = 11 au) applied to **every** POI, plus one flat
area threshold. It therefore reported **81/81 failures at U=4 and U=8** — a
multiplication of one worst case, not a per-POI measurement.

Measured distribution of each POI's own shortest foot edge:

| own min edge (au) | 11 | 13.2 | 15.4 | 17.6 | 18.48 | 22 | 24.2 | 26.4 | 28.6 | 30.8 | 31.68 | 33 | 37.4 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| POIs | 4 | 5 | 19 | 9 | 1 | 2 | 6 | 15 | 7 | 4 | 1 | 3 | 5 |

Only **4 of 81** POIs own the 11 au edge. There are 13 distinct edge sizes.

Correction implemented in `src/lib/scale.mjs`:

* `poiGeometry()` measures **each** POI's own quad with an oriented bounding box
  following its first edge (`quadOBB`), its own four edge lengths, its own area,
  centroid and — where present — its own `deep` polygon. Rotations and
  non-square footprints are preserved.
* `classifyEnclosure()` separates POIs before judging them:
  * `ENCLOSED_MULTI_LAYER` — `depth === "multi"` **and** a canonical `deep` polygon (18 POIs).
  * `ENCLOSED_SINGLE` — archetype in an explicit enclosed set (20 POIs).
  * `OPEN_AIR_YARD` — archetype in an explicit open-air set (43 POIs).
  * `UNRESOLVED` — none here, but the code keeps the state.
  This classification is **derived**, `DERIVED_HEURISTIC__NOT_CANONICAL`, from
  canonical `depth`/`deep`/`gate`/`arche` fields. It is not written back to canon.
* `poiFit()` judges only enclosed POIs for a room (`>=5×4` runtime tiles after
  one-tile walls, both orientations), and only open-air POIs for a usable yard
  (`>=3×3` tile envelope). It reports both metric families for every POI at
  every U.
* Canonical Veyra authors **no door openings**. Each POI's `entranceCapacityAu`
  is the upper bound given by that POI's own shortest edge and is labelled
  `UPPER_BOUND_ONLY__NO_AUTHORED_OPENING_IN_SOURCE`. The 3.696 au west opening is
  a **GEO-02 PROPOSED** `po_kilns` example, non-canonical, and is carried as a
  separate worked example: it quantizes to 0 whole tiles at U ≥ 3.696.

Corrected enclosed-room failures (per-POI, enclosed POIs only): U=2 → 0/38,
U=4 → 17/38, U=8 → 38/38. Open-air yard failures: U=2 → 0/43, U=4 → 4/43,
U=8 → 23/43. The corrected numbers are **not directly comparable** to the old
81/81 because both the population and the rule changed.

## 2. Bounded candidate profiles (diagnostic, NOT approved)

`src/a_scale.mjs` evaluates `U ∈ {1, 1.25, 1.5, 1.6, 1.68, 1.75, 1.8, 2, 2.25, 2.5, 3, 4, 8}`.
The requested focus band `U=1.68–2.25` is fully sampled. Verdict:

> **Physical-fit evidence supports a BOUNDED BAND U ∈ [1, 2.5] among the tested
> candidates — not a single approved integer. U=2 is one member, NOT canonized.**

The band is a *continuum of evidence*, not a design law. U=3 fails 14/38 enclosed
POIs; U=4 fails 17/38 enclosed and 4/43 open-air; U=8 fails all enclosed POIs
and is exactly the 250×175 authoring raster, so it invents no geometry at all.
U=1 is physically generous but is rejected as a runtime choice by the temporary
engine's chunk-key collision and economy-cell gates (see below) — those gates are
**temporary constants**, not Veyra design laws.

### Explicit transform / raster coverage

For fractional U the last runtime row/column is partial. Three documented modes
are emitted (`FLOOR_DROPS_PARTIAL_EDGE_STRIP`, `CEIL_PADS_BEYOND_FRAME`,
`NONUNIFORM_RESAMPLE_REQUIRED`); **none is approved**. Whole-tile and ceil-tile
coverage fractions, unrepresented authoring area and partial-edge tile counts
are in `output/scale_corrected.v1.json`.

| U | world tiles (exact) | partial edge tiles | 8 au cells needing resample | tile-straddles | memory MB (lower bound) | RT-1 route s |
|---:|---|---:|---:|---:|---:|---:|
| 1 | 2000×1400 | 0 | 0 | 0 | 403.2135 | 63.1523 |
| 1.25 | 1600×1120 | 0 | 43750 | 340 | 258.0566 | 50.5218 |
| 1.5 | 1333.3333×933.3333 | 2267 | 43750 | 282 | 179.4237 | 42.1015 |
| 1.6 | 1250×875 | 0 | 0 | 0 | 157.5053 | 39.4702 |
| **1.68** | **1190.4762×833.3333** | **2024** | **43750** | **404** | **143.0391** | **37.5906** |
| 1.75 | 1142.8571×800 | 800 | 43750 | 364 | 131.678 | 36.087 |
| 1.8 | 1111.1111×777.7778 | 1889 | 43750 | 377 | 124.5838 | 35.0846 |
| **2** | **1000×700** | **0** | **0** | **0** | **100.8034** | **31.5761** |
| **2.25** | **888.8889×622.2222** | **1511** | **43750** | **377** | **79.7566** | **28.0677** |
| 2.5 | 800×560 | 0 | 43750 | 340 | 64.5142 | 25.2609 |
| 3 | 666.6667×466.6667 | 1133 | 43750 | 282 | 44.8559 | 21.0508 |
| 4 | 500×350 | 0 | 0 | 0 | 25.2008 | 15.7881 |
| 8 | 250×175 | 0 | 0 | 0 | 6.3002 | 7.894 |

Important nuance: **U=2.5 divides the 2000×1400 frame evenly (800×560) yet
8/2.5 = 3.2 is fractional, so all 43,750 source cells still need a resampling
rule.** A frame that divides evenly is not sufficient for exact raster coverage.
U=1.6, 2, 4, 8 have integer `8/U` and zero source-cell resampling. At U=1.68,
404 runtime tile columns/rows have a source-cell edge falling strictly inside
them.

### Measured/modelled travel

Times use pinned PR44 constants (`balance.player.speed=72 px/s`, `TILE=16`,
`HOUR_MS=3600_000`) and the accepted GEO-01/GEO-02 RT-1 foot route
(`routeAu=346.1492`, `effectiveFootAu=284.1852`, `effectiveCartAu=464.1813`).
U=2 reproduces SCALE-01A's `31.5761 s` geographic route exactly. Fractional
U=1.68 gives `37.5906 s`; cross-world width at U=2 is `222.2222 s`, at U=1.68
`264.5503 s`. These are **modelled**, not native-input measured, and the
loaded-cart figures are modelled **on the foot route**:
`cartStatus = MODELLED_SCENARIO_ON_FOOT_ROUTE__NOT_CART_PASSABLE`. RT-1 contains
`kind=trail` segments (`rd_13`, `rd_1w`, `rd_16`) and has no swept-clearance
dimension, no ferry rule and no bridge-clearance proof.

### Physical space, resolution, memory

* Physical space: 81 POI foot quads, 18 deep polygons, 8 landmasses, 5 lakes,
  17 rivers, 92 roads, 12 bridges, 27 docks, 23 build zones, 4 spawns, 6 Elder
  territories — all measured in unchanged authoring units. Room/yard fit is
  reported per POI and per U.
* Resolution: source raster is **8 au/cell**. U<8 duplicates/interpolates and
  creates **no new authored detail**; U>8 loses authored cells. `U=8` is exactly
  the 250×175 raster.
* Memory: lower-bound model only (typed arrays + economy numeric arrays +
  source V3 + package arrays). U=2 → 100.8034 MB, U=1.68 → 143.0391 MB,
  U=8 → 6.3002 MB. Chunk-cache upper bound uses a 16×16 render chunk. **This
  is not a measured heap** and PR44 chunk culling is **not** world streaming.
* `WW=WH=200`, `TILE=16`, the `validateEconomyMap` 1,000,000-cell cap, the
  `cy*100+cx` chunk key stride and the 6-cell claim radius are **temporary
  engine constants** (Gameplay ACK `6608030530`). They are recorded as
  constraints on the *current* runtime, never as Veyra dimensions.

## 3. Reusable deliverables

| path | content |
|---|---|
| `src/lib/veyra.mjs` | pinned-source loader, SHA verification, GEO-01/GEO-02 input loaders, geometry primitives (OBB, area, centroid, PIP, segment intersection), JSON helpers |
| `src/lib/scale.mjs` | `poiGeometry`, `classifyEnclosure`, `poiFit`, `aggregateFit`, `transformProfile`, `featureQuantization`, `travelAt`, `memoryAt`, `loadScale01a` |
| `src/a_scale.mjs` | benchmark generator |
| `output/scale_corrected.v1.json` | 13 profiles + defect record + bounded band + full uncertainty |
| `output/poi_geometry.v1.json` | all 81 POIs with own quad/deep/edges/OBB + derived enclosure |
| `output/views/scale_corrected.{svg,png,html}` | inspected visual: real 81 quads, fit curves, coverage table, defect histogram |
| `src/test.mjs` | 37 continuous gates (37/37 pass) |
| `tools/render_a.mjs` | reproducible SVG→PNG renderer |

## 4. Uncertainty & no-claims

Enclosure class is derived, not canonical. Wall = 1 runtime tile and room
`>=5×4` are assumptions anchored to the smallest PR44 authored building, not
approved Veyra dimensions. Canonical POIs have no authored entrances. U=2 is
**not** canonized for being an integer; no `200×200`, 1M-cell or chunk-stride law
is asserted. `2000×1400` is retained with `transformStatus: UNDECIDED`. No
approved scale, no canonical edit, no runtime merge, no fabricated travel time,
no cart-passable trail, no playable survival acceptance.

**Next:** Milestone B produces the whole-world deterministic geography compiler
in the same source-coordinate frame. A final runtime scale is *not* a
prerequisite for that work; transform metadata stays explicit.
