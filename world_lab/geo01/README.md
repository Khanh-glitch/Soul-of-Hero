# MAP-GEO-01 — VEYRA WORLD GEOGRAPHY FOUNDATION (milestone A)

**Source-preserving geography, not gameplay population.**

`MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.`

Milestone A is an **executable, deterministic decoder / verifier / exporter** for the existing
Veyra GOLD source, plus a Map-owned geographic handoff. Milestone B (same task, second commit)
adds the real-corridor proof, visual inspection and PR #44 contract boundary.

## Hierarchy

| Layer | Ref | SHA | Role |
|---|---|---|---|
| Veyra GOLD (canonical, PAPER) | `map/veyra-gold-asset-canon-20261102` | `19d8c6ec820f324a6ac12733165e43b5e2c6eab2` | **read-only** `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json` |
| Gameplay contract | PR #44 / `arena/d4bfcfff-soul-of-hero` | `a956c9e85624c1ca7a2b5585eb423f8fa1cf296c` | `web/src/game/{world-economy,geography-contract,map-package}.ts` — **compared against, not modified** |
| MAP-R01 art research | this branch | `ce3f9c58` / `09b96bd2` | preserved, **not merged**, **not visually approved** |

Source fingerprint (measured): **332,249 bytes**, SHA-256
`88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256`,
`meta.status = "GOLD MAP DESIGN - PAPER ONLY - NOT NATIVE PRODUCTION"`.

### Correction to an earlier MAP-R01 claim

`world_lab/map_r01/VEYRA_CROSSWALK.md` said the 250×175 terrain raster was **absent** from the
committed Veyra JSON. That was **wrong**. The raster is embedded:
`project.terrain = {gw:250, gh:175, cell:8, seed:2026, elev:<base64>, biome:<base64>}` — two
canonical base64 strings of 58,336 chars decoding to **43,750 uint8 cells each**. The crosswalk is
corrected in this commit. What is genuinely **not** committed is the semantic legend / physical
units (biome codes 0..11, elevation byte scale, river/road width units, climate); those remain
explicit UNKNOWNs.

## Run it

```bash
cd world_lab/geo01
./reproduce.sh                    # verify -> export -> tests
node src/verify.mjs               # -> output/source_verification.v1.json
node src/export.mjs               # -> output/geography.v1.json + output/rasters/*.u8
node src/test.mjs                 # determinism / fidelity / no-invention tests
```

Pure Node built-ins only. `node src/export.mjs --source=<path>` reads a local copy of the canonical
JSON; default is `git show <pinned commit>:<pinned path>`. Output is **derived data**: the original
`.sohmap.json` stays canonical, and `src/test.mjs` regenerates the export twice in temp dirs and
compares SHA-256 against the committed artifacts.

## Verified (18/18 checks)

| Area | Measured result |
|---|---|
| Landmasses | **8** preserved ids (`ld_veyra` main, 6 satellite, `ld_beacon` islet); 1 ring each, no holes; areas 1,061.7 → 835,818.7 au² |
| Coastline | **812** coast cells, **8** 8-connected components (one per landmass), sizes 471/86/74/65/43/37/26/10 |
| Terrain raster | **250×175**, `cell=8`, `seed=2026`; `elev`/`biome` → **43,750 uint8 cells each**, no compression, canonical base64 roundtrip; elevation 0..243 (238 distinct, 28,624 zeros), biome 0..11 (12 distinct) |
| Landmask agreement | elevation>0 vs land polygons **0.998697** (15,126 positive / 15,077 land cells; 53 boundary, 4 land-at-zero) |
| Slope | derived raw byte gradient 0..150, mean 2.4562 **raw byte deltas per grid cell**, deliberately not normalized |
| Water | **5 lakes**, **17 rivers** (13 river / 1 canal / 3 distributary), 1 connected component reaching sea; mouths 10 sea / 3 lake / 3 river / 1 `none`; waterfall/lock/weir/rapids features; all refs resolve; per-river elevation + slope profiles sampled at 8 au |
| Roads | **92** (34 cart / 37 trail / 11 foot / 2 riverside / 8 ferry), 10,853.76 au total; **12 bridges** (7 cart / 5 foot); **27 docks** (17 coastal / 10 inland); route graph 131 nodes / 105 edges from exact segment intersections + 8 au endpoint joins |
| Buildable | **23** authored zone polygons; walkable / buildable / clearance candidate rasters |
| POIs | **81** ids, **24** archetypes, 18 `multi`, 18 with `deep`, 18 with `retreat`, 5 with `links`; foot areas 176 → 2,034.56 au². Rooms/entrances/doors/loot = NOT_IN_SOURCE / GAMEPLAY_OWNED |
| Spawns / Elders | **4** spawns; **6 distinct** Elder territories with outer/core/arena/approach + resolving POI refs |
| Resources | **280** preserved as **candidate geographic annotations only** (11 kinds, `dens` 1..3, `gate:none`) |
| Confidence / IDs | 544 `proposal`, 11 `assumption`, 24 labels without `conf`; **579** unique ids; **3,504** coordinate occurrences within 0..1919.3 × 0..1370 |

Detail: `output/source_verification.v1.json`, `SOURCE_VERIFICATION.md`.

## Geography handoff (`output/geography.v1.json`)

- **21 uint8 raster layers** (43,750 cells each) + `output/rasters/manifest.v1.json` with per-layer
  SHA-256: verbatim `elevation`/`biomeCode` decodes; derived `slope`, `landId`, `lakeId`, `riverId`,
  `waterClass`, `coast`, `freshwater`, `roadClass`, `zoneId`, `poiGeometryId`, `elderGeometryId`,
  `walkableCandidate`, `buildableCandidate`, `protectedGeometryCandidate`, `cargoCandidate`,
  `crossingCandidate`, `seaDistanceCells`, `freshwaterProximityCells`, `clearanceCells`.
- **Verbatim `objects`**: all 12 source arrays with every id and authored coordinate unchanged.
- **Derived topology**: land/coast metrics, directed water connectivity graph, river mouths +
  profiles, road/bridge/dock/ferry topology, zone access, POI spatial shells, Elder territories,
  resource suitability annotations with terrain context, spawn regions.
- **Explicit `UNKNOWN` / `NOT_IN_SOURCE` / `UNDEFINED`** for climate, biome legend, physical units,
  road width, loaded-cart capability, bridge span fit, boat rules, POI rooms/entrances, A0
  protection, hazard intensity and the world-scale transform.

Field-by-field reading: `GEOGRAPHY_HANDOFF.md`.

## Hard boundaries

- **No gameplay population**: no tree/rock/resource spawn positions, yields, monster spawns, loot,
  locked doors, generator requirements, ambient audio events, economy, boss behaviour, hazard
  intensities or six fake Elder mappings.
- **No silent rescale**: `frame.transform.status = "UNDECIDED"`, `mode = "NONE_APPLIED"`. All
  coordinates stay in 2000×1400 authoring units. `toCell()` is an index lookup, not a world-scale
  decision. PR44's runtime needs exactly 200×200 cells of `TILE=16`; that decision stays open.
- **No new environment art** and **no merge of MAP-R01's ground/water replacements**. The existing
  Web sea, wave patterns and animation remain the preferred visual baseline pending separate
  aesthetic review. Art applies **to** geography, never as a substitute for it.
- **No runtime intake claim** and **no survivability claim**.

## Known blockers

`UNDECIDED` world-scale transform; missing biome legend / units; missing climate; no runtime intake;
no Godot-native Veyra import; no creator visual approval; `STAGING_PARTIAL` art coverage; no
measured journey times. Milestone B adds the corridor proof and the precise PR #44 contract delta.
