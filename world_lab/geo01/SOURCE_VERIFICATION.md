# MAP-GEO-01 — source verification report (milestone A)

**Command:** `node src/verify.mjs` → `output/source_verification.v1.json`
**Verdict:** `VERIFY_PASS 18/18`. Reproducible (SHA-256 stable across regenerations).

## Canonical source

| Field | Value |
|---|---|
| Branch | `map/veyra-gold-asset-canon-20261102` |
| Commit | `19d8c6ec820f324a6ac12733165e43b5e2c6eab2` |
| Path | `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json` |
| Bytes | 332,249 |
| SHA-256 | `88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256` |
| `format / version` | `soh-maplab / 1` |
| `meta.status` | `GOLD MAP DESIGN - PAPER ONLY - NOT NATIVE PRODUCTION` |
| `project.world` | `2000 × 1400` authoring units |
| `project.name` | `Soul of Hero - VEYRA GOLD MAP V1 (Creator 2026-11-02)` |

The tool reads the blob via `git show <commit>:<path>` and verifies the fingerprint. It never
writes to the source and never promotes `proposal` / `assumption` notes into gameplay law.

## Check results

| Check | Requirement | Result |
|---|---|---|
| SRC-01 | pinned fingerprint | PASS — bytes/SHA/commit/branch/path recorded |
| SRC-02 | PAPER-only status | PASS |
| GEO-01 | 8 landmasses + coastline topology | PASS |
| GEO-02 | measurable closed coastline | PASS — 812 coast cells, 8 components |
| RAS-01 | embedded 250×175 raster, 43,750 cells each | PASS |
| RAS-02 | decoded value domains reported, not reinterpreted | PASS |
| WAT-01 | rivers, lakes, mouths, nav, slope | PASS |
| WAT-02 | water connectivity reaches sea | PASS |
| TRN-01 | roads/trails/bridges/docks/ferry topology | PASS |
| BLD-01 | buildable regions + physical access | PASS |
| POI-01 | POI footprints / deep / retreat / links | PASS |
| SPW-01 | 4 spawn regions | PASS |
| ELD-01 | 6 distinct Elder territories | PASS |
| RES-01 | 280 resource objects as annotations | PASS |
| CONF-01 | confidence flags preserved | PASS |
| ID-01 | unique preserved ids | PASS |
| COORD-01 | coordinates inside authoring canvas | PASS |
| SCALE-01 | no rescale to 200×200 | PASS |

## Landmasses and coastline (derived)

| id | kind | ring vertices | area au² | perimeter au | coast cells |
|---|---|---:|---:|---:|---:|
| `ld_veyra` | main | 372 | 835,818.7270 | 4,204.6626 | 471 |
| `ld_cinder` | satellite | 86 | 46,386.8545 | 779.8256 | 86 |
| `ld_saltwick` | satellite | 74 | 31,853.1629 | 669.9447 | 74 |
| `ld_gull` | satellite | 28 | 4,791.1764 | 248.5012 | 26 |
| `ld_ironholm` | satellite | 64 | 22,875.3139 | 576.6555 | 65 |
| `ld_threshold` | satellite | 45 | 12,573.4826 | 401.9562 | 43 |
| `ld_wreck` | satellite | 38 | 8,764.6646 | 336.5796 | 37 |
| `ld_beacon` | islet | 14 | 1,061.7135 | 117.5483 | 10 |

All 8 have exactly one ring and **no holes**. Coast cells = land cells with a 4-neighbour sea cell.
8-connected coastline components = **8**, i.e. one closed coastline per landmass — no merged or
broken shoreline. Areas/perimeters are shoelace measurements of the authored rings, not estimates.

## Terrain raster — this is the corrected finding

`project.terrain` **is present** in the committed JSON:

```
gw=250, gh=175, cell=8, seed=2026
elev  : base64 length 58,336 -> 43,750 uint8 cells (canonical roundtrip)
biome : base64 length 58,336 -> 43,750 uint8 cells (canonical roundtrip)
grid order: i = gy*gw + gx, cell centre = [(gx+0.5)*8, (gy+0.5)*8]
encoding: base64 / uint8 / row-major / NO compression / NO zlib-brotli container
```

| Layer | distinct | min | max | zero cells | interpretation |
|---|---:|---:|---:|---:|---|
| `elev` | 238 | 0 | 243 | 28,624 | `0` = sea/no-land (verified); `>0` = land height in **unspecified source units** |
| `biome` | 12 | 0 | 11 | 33,048 | **raw codes**; no semantic legend committed |

Landmask agreement `elev>0` vs authored land polygons = **0.998697** (15,126 positive cells,
15,077 land cells; 53 positive cells just outside a polygon boundary, 4 land cells with zero).
That is a factual cross-check of the byte, **not** a semantic reinterpretation.

Biome code evidence (cell count, elevation range/mean of non-zero-elevation cells):

| code | count | E=0 | elev min..max | mean | semantics |
|---:|---:|---:|---:|---:|---|
| 0 | 33,048 | 28,624 | 8..123 | 47.14 | UNKNOWN |
| 1 | 3,019 | 0 | 9..157 | 50.06 | UNKNOWN |
| 2 | 1,111 | 0 | 21..84 | 61.35 | UNKNOWN |
| 3 | 834 | 0 | 99..169 | 125.28 | UNKNOWN |
| 4 | 770 | 0 | 9..53 | 21.69 | UNKNOWN |
| 5 | 1,308 | 0 | 11..138 | 41.11 | UNKNOWN |
| 6 | 1,400 | 0 | 9..121 | 40.17 | UNKNOWN |
| 7 | 511 | 0 | 29..214 | 147.01 | UNKNOWN |
| 8 | 217 | 0 | 122..243 | 220.57 | UNKNOWN |
| 9 | 452 | 0 | 19..219 | 144.71 | UNKNOWN |
| 10 | 199 | 0 | 12..136 | 28.77 | UNKNOWN |
| 11 | 881 | 0 | 7..30 | 13.80 | UNKNOWN |

The elevation range strongly suggests a height ordering, but **no legend is committed**. MAP-GEO-01
therefore ships raw codes and refuses to map them onto PR44's 14 `Biome` strings.

Derived slope = central difference of raw elevation bytes: min 0, max 150, mean **2.4562 raw byte
deltas per grid cell**. It is deliberately **not** normalized — `world-economy.ts` compares it to
`0.6`, which is a Gameplay threshold requiring a jointly approved normalization.

## Water, mouths and connectivity

- **5 lakes**: `lk_tarn`, `lk_grey`, `lk_verdant`, `lk_mirage` (`oasis:true`), `lk_mere`; 40 ring
  vertices each.
- **17 rivers**: 13 `river`, 1 `canal` (`rv_canal`, `conf:assumption`), 3 `distributary`.
  All `source` / `mouth` refs resolve (`unresolvedRefs: []`).
- Mouths: **10 sea** (`rv_east`, `rv_d1`, `rv_d2`, `rv_d3`, `rv_amber_low`, `rv_west`, `rv_hook`,
  `rv_ash`, `rv_salt`, `rv_slag`), **3 lake**, **3 river**, **1 `none`** (`rv_grey_low`).
- `nav` flags: navigable vs non-navigable segments are counted per river; `feats` recorded:
  `rv_grey_up:waterfall`, `rv_canal:lock`, `rv_moss:weir`, `rv_east:rapids`.
- Undirected water graph = **1 connected component**, which includes `sea`; all five lakes are
  sea-connected through authored mouths. Per-river elevation min/max and source→mouth descent are
  measured at 8 au sampling (`derivedElevationProfile`, `derivedSlopeProfile`).
- `nav[]` and feature flags are **source proposals**, not navigability law. Boat/portage rules are
  Gameplay-owned and UNDEFINED.

## Transport topology

| Class | Count | Length (au) | Notes |
|---|---:|---:|---|
| `cart` | 34 | 5,363.5713 | cargo candidate, **width not authored** |
| `trail` | 37 | 2,691.0010 | |
| `foot` | 11 | 1,007.8349 | |
| `riverside` | 2 | 420.3283 | |
| `ferry` | 8 | 1,371.0219 | boat rules UNDEFINED; **not land roads** |
| **total** | **92** | **10,853.7574** | |

- **12 bridges**: 7 `load:cart`, 5 `load:foot`; each has a measured nearest-river and nearest-road
  distance. `channelSpanFitVerified: false` and `widthStatus: NOT_IN_SOURCE`.
- **27 docks**: 17 coastal / 10 inland; every `water` ref resolves to `sea`, a lake id or a river
  id. Boarding/disembark cells and functional boat/pier art are UNDEFINED / `STAGING_PARTIAL`.
- Route graph: **131 nodes / 105 edges** from authored endpoints, **17 exact segment intersections**
  and an explicit configurable `joinToleranceAu = 8` (one source grid cell). 123 land-road nodes,
  1 isolated stop node. Ferry edges are present but flagged `ferry:true`.

## Regions, POIs, spawns, Elders, resources

- **23 buildable zone polygons** with verbatim `soil` / `water` / `slope` / `tags`; derived area,
  centroid, walkable/buildable cell counts, nearest road, nearest POI, freshwater proximity,
  sea distance and mean raw slope. A0 legality is NOT asserted.
- **81 POIs** / **24 archetypes**; 18 `depth:multi`, 63 `surface`; 18 with `deep` polygons, 18 with
  `retreat` points, 5 with `links`. Foot areas 176 → 2,034.56 au². Rooms, entrances, interior
  circulation, doors, power nodes, hazard cells and loot sites are **NOT_IN_SOURCE / Gameplay-owned**.
  `gate` / `access` / `role` / `opp` / `notes` are preserved **as provisional source prose**, not law.
- **4 spawns**: `sp_west (372,606)`, `sp_lake (790,622)`, `sp_hook (1282,392)`, `sp_gulf (872,930)`.
- **6 distinct Elder territories**: `surtur`, `typhon`, `aion`, `atlas`, `argus`, `anubis`, each
  with `outer` (44 pts), `core` (44 pts), `arenas` (1), `approach`, POI refs (all resolve) and the
  verbatim `ragnarok` prose note. No runtime `ELDERS` mapping created.
- **280 resource objects** / 11 kinds (`fish 39, food 59, wood 54, herbs 19, ore 3, stone 30,
  clay 2, sulfur 4, obsidian 4, fresh_water 65, salt 1`), `dens` ∈ {1,2,3}, all `gate:"none"`.
  Preserved as **candidate geographic annotations** with suitability circles and terrain context;
  **no** final harvestable instances, stock, yield or depletion.

## Confidence, IDs, coordinates

- 544 `proposal`, 11 `assumption`, 24 labels with no `conf` → 579 objects. Flags are preserved
  verbatim on every object; no provisional note became a gameplay law.
- **579 unique ids** (no duplicates). **3,504 coordinate occurrences**, all within
  `x ∈ [0, 1919.3013]`, `y ∈ [0, 1370]` of the 2000×1400 authoring canvas.
- `SCALE-01`: source grid 250×175 @ 8 au; runtime reference 200×200 @ TILE=16;
  `transformStatus = UNDECIDED`. **No coordinate was rescaled, rounded or translated.**

## What verification deliberately does not claim

It does not prove native playability, collision, survivability, travel times, art readiness,
climate, gameplay balance or creator visual approval. It proves the source was decoded faithfully,
its geometry is measurable, and its unknowns are explicit.
