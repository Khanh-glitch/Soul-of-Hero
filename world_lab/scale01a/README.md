# MAP-SCALE-01A — Veyra scale & gameplay-fit benchmark

**Status: `DECISION_SUPPORT_BENCHMARK__NO_APPROVED_SCALE__NO_RUNTIME_MERGE`.**
Continue from accepted MAP-GEO-02 HEAD `c6a900ae39fb05a83058606a80035a34021cd69d`.
Full `2000 × 1400` Veyra authoring geometry is **unchanged**; no rescale, crop, pad, warp,
new POIs, environment art, canonical rewrite, Gameplay population or runtime merge.

> **MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.**

## What this answers

Which *world-scale transformations* could make the FULL Veyra geography playable under the
**actual** SOH Gameplay Bible, using the **latest** Gameplay PR #44 HEAD
`d80ad1b5d46f17b729e90898cfa2ad31b677fae3` (not only pinned `a956c9e`), actual balance,
movement, collision, vehicle and building dimensions.

It compares four **diagnostic candidates**, `U = 1, 2, 4, 8` Veyra authoring units per
runtime tile. `U` is **not** an approved world size. No scale was chosen because it produces
convenient integer dimensions, matches the 40,000-cell Web runtime, or gives attractive
traversal times.

## Headline result

- **Bounded shortlist: `U = 2` only** — the only candidate that keeps a door opening, POI
  rooms, a working space, road/river/bridge geometry and the render chunk key physically
  representable **and** stays within the `validateEconomyMap()` 1,000,000-cell limit.
- `U = 1` is spatially best but produces 2,800,000 cells (`> 1,000,000` validator cap) and
  collides with `render.ts` chunk key `k = cy*100 + cx` (125 chunk columns > stride 100).
- `U = 4` and `U = 8` quantize the 3.696 au PROPOSED entrance to **0 open tiles** and reduce
  the smallest canonical POI foot to 11 / 2.75 tiles² — they destroy meaningful physical
  gameplay even though traversal is faster. `U = 8` is the tempting 250×175 / 43,750-cell
  native-raster match and is **rejected on spatial evidence**, not adopted for convenience.
- **All four** candidates fail `validateRuntimeMapPackage()` (exact `200×200 @ TILE=16`) and
  `core.ts` fixed `WW = WH = 200` / `40,000`-cell grid. No final scale can be approved until
  the runtime/contract is changed and re-tested. See `SCALE_COMPARISON.md`.

## Measured, assumed, missing

| Class | Examples |
| --- | --- |
| **Measured** | 51 source-linked journeys (41 terrain-weighted raster routes, 10 explicitly UNRESOLVED); all 4 spawns, 3 alternative home zones, 6 Elder approaches, near/far POIs, RT-1/2/3 corridors; PR44 HEAD balance + engine limits; 6 disconnected cart-road components. |
| **Assumption (flagged)** | 12 MapLab biome codes → PR44 `terrainSpeed` keys (GEO-02 says this is **NOT approved**); 9 au road/river strokes and 13×7.2 au bridge glyph are EDITOR geometry, not physical widths; 3.696 au entrance / 57.4232 au² workspace come from the GEO-02 **PROPOSED** `po_kilns` shell, not canon. |
| **Missing Gameplay rule / test** | Approved biome mapping; swept clearance; cart slope/bridge/water rules; ferry/boat rule for 8 landmasses; `exposure_time`; MAP-U4 seller/price/stock; 3 actually built houses; streaming/LOD/save budget; human 640×360 pixel test. Full list in `output/benchmark.v1.json :: missingRules`. |

**No fabricated travel times, no invented collision/passability rules.** Loaded-cart figures are
modelled scenarios on the *same foot route* using the PR44 cart speed/weight profile; they are
**not** cart-passability claims. `cartPassable` is `false` for every journey in this benchmark.
An authored `kind=trail` segment is **never** labelled cart-passable.

## Reproduce

```bash
cd world_lab/scale01a && ./reproduce.sh
```

Steps: fetch PR44 HEAD ref if needed → `src/benchmark.mjs` → `src/render.mjs` →
`src/test.mjs` (48/48) → accepted GEO-01 and GEO-02 `./reproduce.sh` regressions.
`SCALE01A_OUT=<dir>` redirects benchmark JSON outputs for determinism tests.

## Deliverables

| File | Content |
| --- | --- |
| `output/scale_comparison.png` / `.svg` / `.html` | visual comparison (open the PNG first) |
| `output/benchmark.v1.json` | full source-linked benchmark, acceptance assessment, recommendation |
| `output/metrics.v1.json` | flat machine-readable times for every journey × scale × load case |
| `output/comparison.v1.json` | compact comparison rows + authored corridor times |
| `output/gameplay_sources.v1.json` | PR44 HEAD / reference / canon fingerprints and derived constants |
| `GAMEPLAY_SOURCES.md` | what was read from PR44 HEAD and why the HEAD matters |
| `SCALE_COMPARISON.md` | compact comparison + defensible shortlist + required changes |
| `ACCEPTANCE_ASSESSMENT.md` | K2/K3/K6/K7/K8 and MAP-SPAWN-04 / HOME-03 / LOG-03 / U4 / U5 |

## Source chain

- Veyra GOLD `19d8c6ec820f324a6ac12733165e43b5e2c6eab2` (`88780f78…a256`, 332,249 B).
- GEO-01 `output/geography.v1.json` (`13ae9727…dd`), `corridor.v1.json` (`e9212633…6e`),
  21 `.u8` rasters + manifest — unchanged.
- GEO-02 `maplab_encoding.v1.json`, `corridor_audit.v1.json`,
  `poi_po_kilns.proposed.v1.json`, five `.u8` raster masks — unchanged.
- Gameplay PR #44 HEAD `d80ad1b5…`: `web/ref/bible.md`, `web/src/game/{balance.v1.json,
  core.ts, sim.ts, engine.ts, world.ts, world-economy.ts, geography-contract.ts,
  map-package.ts, catalog.ts, render.ts}`, `web/IMPLEMENTATION_EVIDENCE.md`.
- Reference docs `7a1c53ac…` (`CURRENT_PRODUCT_CONTRACT.md`,
  `GAMEPLAY_MAP_CONVERGENCE_BRIEF_20261101.md`,
  `C08_PROTOTYPE_REUSE_AND_CAUSAL_GATE_TRIAGE_20261102.md`,
  `SOH_GAME_DEVELOPMENT_GAMEPLAY_DEPTH_REUSE.md`).

None of those inputs is modified. This directory only adds a benchmark.
