# MAP-GEO-01 — VEYRA WORLD GEOGRAPHY FOUNDATION

**Source-preserving geography, not gameplay population.**

`MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.`

An **executable, deterministic decoder / verifier / exporter** for the existing Veyra GOLD source,
a Map-owned geographic handoff, one real spatial corridor proof, and the exact PR #44 contract
boundary. It does **not** populate the world, rewrite the game, merge MAP-R01 art, or rescale Veyra
into the current 200×200 Web island.

## Hierarchy

| Layer | Ref | SHA | Role |
|---|---|---|---|
| Veyra GOLD (canonical, PAPER) | `map/veyra-gold-asset-canon-20261102` | `19d8c6ec820f324a6ac12733165e43b5e2c6eab2` | **read-only** `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json` |
| Gameplay contract | PR #44 / `arena/d4bfcfff-soul-of-hero` | `a956c9e85624c1ca7a2b5585eb423f8fa1cf296c` | `web/src/game/{world-economy,geography-contract,map-package}.ts` — **compared against, not modified** |
| MAP-R01 art research | this branch | `ce3f9c58` / `09b96bd2` | preserved, **not merged**, **not visually approved** |
| MAP-GEO-01 | this branch | milestone A `93d98946`, milestone B see `git log -1` | derived geography + corridor proof + contract delta |

Source fingerprint (measured): **332,249 bytes**, SHA-256
`88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256`,
`meta.status = "GOLD MAP DESIGN - PAPER ONLY - NOT NATIVE PRODUCTION"`.

### Correction to an earlier MAP-R01 claim

`world_lab/map_r01/VEYRA_CROSSWALK.md` said the 250×175 terrain raster was **absent** from the
committed Veyra JSON. **That was wrong** (and the archetype count 25 → **24** was also wrong). The
raster is embedded: `project.terrain = {gw:250, gh:175, cell:8, seed:2026, elev:<base64>,
biome:<base64>}` — two canonical base64 strings of 58,336 chars decoding to **43,750 uint8 cells
each**. The crosswalk was corrected in milestone A. What is genuinely **not** committed is the
semantic legend / physical units (biome codes 0..11, elevation byte scale, river/road width units)
and any climate layer; those remain explicit UNKNOWNs.

## Run it

```bash
cd world_lab/geo01
./reproduce.sh                  # verify -> export -> corridor -> render -> contract -> 15 tests
# individually:
node src/verify.mjs             # -> output/source_verification.v1.json
node src/export.mjs             # -> output/geography.v1.json + output/rasters/*.u8
node src/corridor.mjs           # -> output/corridor.v1.json
node src/render.mjs             # -> output/corridor.svg / .png / .html
node src/contract.mjs           # -> output/contract_boundary.v1.json
node src/test.mjs               # determinism / fidelity / no-invention / corridor / contract
```

Pure Node built-ins except `src/render.mjs` (already-installed `puppeteer-core` + Chromium at
`/tmp/chromium`, `LD_LIBRARY_PATH=/tmp/al2023/lib`). `node src/export.mjs --source=<path>` reads a
local copy; default is `git show <pinned commit>:<pinned path>`. Output is **derived data**: the
original `.sohmap.json` stays canonical, and `src/test.mjs` regenerates verify/export/corridor/
contract in temp dirs and compares SHA-256 against the committed artifacts.

**Test result:** `VERIFY_PASS 18/18`, `GEO_TESTS 15/15`.

## Verified source geometry (18/18 checks)

| Area | Measured result |
|---|---|
| Landmasses | **8** preserved ids (`ld_veyra` main, 6 satellite, `ld_beacon` islet); 1 ring each, no holes; areas 1,061.7 → 835,818.7 au²; perimeters 117.5 → 4,204.7 au |
| Coastline | **812** coast cells, **8** 8-connected components (one per landmass), sizes 471/86/74/65/43/37/26/10 |
| Terrain raster | **250×175**, `cell=8`, `seed=2026`; `elev`/`biome` → **43,750 uint8 cells each**, no compression, canonical base64 roundtrip; elevation 0..243 (238 distinct, 28,624 zeros), biome 0..11 |
| Landmask agreement | `elev>0` vs land polygons **0.998697** (15,126 positive / 15,077 land; 53 boundary, 4 land-at-zero) |
| Slope | derived raw byte gradient 0..150, mean 2.4562 **byte deltas per grid cell**, deliberately not normalized |
| Water | **5 lakes**, **17 rivers** (13 river / 1 canal / 3 distributary), 1 connected component reaching sea; mouths 10 sea / 3 lake / 3 river / 1 `none`; waterfall/lock/weir/rapids; all refs resolve; per-river elevation + slope profiles at 8 au |
| Roads | **92** (34 cart / 37 trail / 11 foot / 2 riverside / 8 ferry), 10,853.76 au; **12 bridges** (7 cart / 5 foot); **27 docks** (17 coastal / 10 inland); route graph 131 nodes / 105 edges |
| Buildable | **23** authored zone polygons; walkable / buildable / clearance candidate rasters |
| POIs | **81** ids, **24** archetypes, 18 `multi`, 18 `deep`, 18 `retreat`, 5 `links`; foot 176 → 2,034.56 au². Rooms/entrances/doors/loot = NOT_IN_SOURCE / GAMEPLAY_OWNED |
| Spawns / Elders | **4** spawns; **6 distinct** Elder territories with outer/core/arena/approach + resolving POI refs |
| Resources | **280** preserved as **candidate geographic annotations only** (11 kinds, `dens` 1..3, `gate:none`) |
| Confidence / IDs | 544 `proposal`, 11 `assumption`, 24 labels without `conf`; **579** unique ids; **3,504** coordinate occurrences inside 0..1919.3 × 0..1370 |

Detail: `output/source_verification.v1.json`, `SOURCE_VERIFICATION.md`.

## Map-owned geography handoff (`output/geography.v1.json`)

- **21 uint8 raster layers** (43,750 cells each) + `output/rasters/manifest.v1.json` with per-layer
  SHA-256: verbatim `elevation`/`biomeCode`; derived `slope`, `landId`, `lakeId`, `riverId`,
  `waterClass`, `coast`, `freshwater`, `roadClass`, `zoneId`, `poiGeometryId`, `elderGeometryId`,
  `walkableCandidate`, `buildableCandidate`, `protectedGeometryCandidate`, `cargoCandidate`,
  `crossingCandidate`, `seaDistanceCells`, `freshwaterProximityCells`, `clearanceCells`.
- **Verbatim `objects`**: all 12 source arrays, every id and authored coordinate unchanged.
- **Derived topology**: land/coast metrics, directed water connectivity graph, river mouths and
  profiles, road/bridge/dock/ferry topology, zone access, POI spatial shells, Elder territories,
  resource suitability annotations with terrain context, spawn regions.
- **Explicit `UNKNOWN` / `NOT_IN_SOURCE` / `UNDEFINED`** for climate, biome legend, physical units,
  road width, loaded-cart capability, bridge span fit, boat rules, POI rooms/entrances, A0
  protection, hazard intensity and the world-scale transform.
- `frame.transform.status = "UNDECIDED"`, `mode = "NONE_APPLIED"`, `configurable: true`. All
  coordinates stay in 2000×1400 authoring units; `toCell()` is an index lookup, not a scale decision.

Field-by-field reading: `GEOGRAPHY_HANDOFF.md`.

## One real Veyra spatial corridor (`CORRIDOR_PROOF.md`)

- **Spawn chosen by measurement**, not preference: `sp_lake` scores **59** (23 roads / 12 POIs /
  10 zones / 6 bridges / 4 docks / 4 rivers in range) vs `sp_gulf` 53, `sp_hook` 33, `sp_west` 26.
- **Target**: existing `po_kilns` shell (4 authored road-graph edges). **175** walkable initial
  cells within 64 au; **1,771** candidate land cells and **50** preserved source resource
  annotations (candidate only, **no harvestable instances**) within 200 au; **10** candidate build
  sites within 300 au.
- **Physical connectivity**: 4-neighbour BFS on the source raster → **CONNECTED**, **50 grid
  steps = 400 au**, crossing exactly one authored cell: cart bridge **`br_4`** over **`rv_silver`**.
- **Routes (authoring units)**: RT-1 primary **400.1147 au** (`rd_b`, `rd_13`, `rd_1w`, `rd_16` +
  37.2022 au derived connector), RT-2 alternative **403.9036 au** (full `rd_13`, no detour),
  RT-3 alternative **398.0289 au** (`rd_20` riverside, `br_a` foot bridge). Return = RT-1 reversed.
- Clearance along RT-1: min 0 / mean 58.19 / max 128 au; raw slope 1..4 (no threshold). **0 ferry
  paths used**; nearest `rd_2j` at 187.1 au with UNDEFINED boat rule.
- **NOT claimed survivable**; Gameplay population/survival rules have not run. Visual
  `output/corridor.png` is a geographic diagram, not gameplay validation.

## Integration boundary (`CONTRACT_DELTA.md`)

`output/contract_boundary.v1.json` classifies **51 PR44 fields**:
3 DIRECT / 19 DERIVABLE_WITH_VERIFIED_TRANSFORM / 11 GAMEPLAY / 6 JOINT / 12 UNDEFINED, and lists
**12 precise contract deltas** (CD-01..CD-12). PR44 file SHA-256s verified `MATCH`.

Verdict: `DIRECT_RUNTIME_INTAKE_BLOCKED__INDEPENDENT_GEOGRAPHY_EXPORT_PROVIDED`. Hard blockers:
fixed 200×200 @ TILE=16 extent, mandatory 0..1 climate with no UNKNOWN state, 14-string Biome enum
with no legend, Gameplay-owned POI/loot fields required by `validateGeographicHandoff`, and that
validator running `compileEconomy` + `diagnoseStarts` itself. No dummy `RuntimeMapPackage`, loot,
cash, powered doors, source nodes or six fake Elder mappings were built.

## Hard boundaries

- **No gameplay population:** no tree/rock/resource spawn positions, yields, monster spawns, loot,
  locked doors, generator requirements, ambient audio events, economy, boss behaviour, hazard
  intensities or six fake Elder mappings. Geographic landmarks stay fixed; ordinary collectibles
  are Gameplay-generated from suitability areas.
- **No silent rescale / no runtime intake claim / no survivability claim.**
- **No new environment art.** MAP-R01's ground/water replacements are **not merged**; existing Web
  sea, wave patterns and animation remain the preferred visual baseline pending separate aesthetic
  review. Art applies **to** geography, never as a substitute for it.
- **No force-push, no production merge, no rewrite of the canonical source, no rewrite of the
  Gameplay loader or the current game.** Veyra GOLD stays PAPER-only; MAP-GEO-01 is derived data.

## Known blockers / next executable seam

`UNDECIDED` world-scale transform; missing biome legend / units; missing climate; no runtime
intake; no Godot-native Veyra import; no creator visual approval; `STAGING_PARTIAL` art coverage;
no measured journey times; no 336 h E2E. The next executable seam is a **joint Map + Gameplay
contract revision** (CD-01..CD-05 first): approve the transform with measured travel times, commit
a biome/unit legend and climate ownership, split Map geometry validation from Gameplay population,
and only then compile a versioned `RuntimeMapPackage`.
