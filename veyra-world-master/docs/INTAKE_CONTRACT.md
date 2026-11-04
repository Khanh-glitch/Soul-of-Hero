# WMP-01 → Gameplay intake contract (proposed; not implemented in Gameplay)

**Schema:** `soh.wmp.chunk_intake_contract.v1` · **Status:** `PROPOSED__GAMEPLAY_INTAKE_NOT_IMPLEMENTED`
**Authority:** Map designs the physical world; Gameplay populates and simulates it.

## 1. Pin, then read

1. Pin `manifest.v1.json` by SHA-256 and read `revisionDigest`.
2. Verify `sourceIntegrity`: GOLD SHA `88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256`, `goldReadCount=1`, LR01 body `e3259eb…`, LR02 v2 `e3ba6d…`.
3. Verify all `manifest.components[].sha256` against the files.
4. Select a bounded window: `originAu`, `U`, `widthTiles`, `heightTiles`.

```js
import { intakeContract, projectWindow } from './api/intake.mjs';
const c = intakeContract();
const w = projectWindow({ originAu: [0, 0], U: 1.6, widthTiles: 200, heightTiles: 200 });
// w.files -> tiles/fresh/zone/seaDist/land u8 masks, verified by SHA-256
```

**The 200×200 Web window is NOT the whole 2000×1400 authoring frame.** It is a bounded
`PLAYABLE_WEB_SLICE`. `projectWindow()` returns `chunkIds`, boundary continuity results and
`outOfFrameTiles`; it never claims full-world ingestion.

## 2. What Map supplies

| Field | Layer / raster | Status |
|---|---|---|
| Surface colour / Web T code | `rasters/surface.u8`, `layers/crosswalks.v1.json` | `PROPOSED` crosswalk |
| Original 12 biome subtype IDs | `rasters/biomeSubtype.u8`, `terrain.biomeLegend` | `SOURCE_AUTHORED` |
| 14 EconomyMap labels / 20 Web codes | `layers/crosswalks.v1.json` | `PROPOSED` lossy crosswalk |
| Water / road / wall / floor overrides | `crosswalks.overrides` | `PROPOSED`, consumer-side |
| Landform, substrate, soil, slope ordinal, cliff, terrace, construction, vegetation, drainage, exposure | `rasters/*.u8` | `PROPOSED` |
| Static climate potentials (hot/cold/wetland/snow/toxic/radiation/rain/sun/wind/frost/fire/farming) | `rasters/*.u8`, `layers/climate.v1.json` | `PROPOSED` / `UNKNOWN` |
| Hydrology banks, channels, cross-sections, fords, floodplains, contradictions | `layers/hydrology.v1.json` | `DERIVED` / `UNRESOLVED` |
| 81 POIs, rooms, roofs, solids, openings, LOS, vertical links | `layers/architecture.v1.json` | `PROPOSED` or named blocker |
| 92 roads / 12 bridges / 27 docks with 3 body profiles | `layers/transport.v1.json` | `DERIVED`, no passability verdict |
| 23 build envelopes, habitats, nonboss endgame route geometry | `layers/build_habitat_endgame.v1.json` | `PROPOSED` geometry |
| 70 chunks + 579 stable IDs | `layers/chunks.v1.json`, `layers/feature_index.v1.json` | `SOURCE_AUTHORED` / `DERIVED` |
| 4 comparison scale profiles | `layers/scales.v1.json` | `NOT_APPROVED_CANON` |

## 3. What Gameplay must supply (never inferred by Map)

- Approved `U` and runtime tile transform; player/vehicle/cart body dimensions; swept
  clearance and trailer sweep; grade/climb limit; bridge deck bearing; ferry/boat rule.
- Weather realization, actual temperature, thermal effects, seasons, damage and survival
  consequences; radiation numerics.
- `starts`, `buildings`, `statics`, runtime Elder entities, occupancy, claims, placed
  structures, dynamic locks/power/HP/ownership/loot/enemy placement.
- Stock, custody, prices, cash quantities, receipts, escrow placement, save/offline,
  combat, economy, AI, visual approval.
- `validateEconomyMap` / `validateGeographicHandoff` from the Gameplay branch and all
  runtime safety checks.

## 4. Minimal required validation sequence

1. `sha256sum manifest.v1.json`; compare with the pinned handoff value.
2. `projectWindow(...)`; verify the five mask SHA-256 values and `continuity.boundaryMismatches === 0`.
3. Apply the explicit crosswalk overrides; **never** equate a source biome string with a
   Gameplay `Biome` semantic without `layers/crosswalks.v1.json`.
4. Supply Gameplay-owned fields above; do not treat `UNKNOWN`/`UNRESOLVED` as `PASS`.
5. Run Gameplay's own validators and record the exact Gameplay HEAD SHA.

## 5. Non-claims

No Gameplay runtime file was modified by WMP-01. No full Web ingestion, weather, stock,
custody, live AI, player buildings, vehicle runtime, economy, escrow, save/offline,
visual approval or continuous playable Veyra is proven here. `intake.mjs` writes only
`evidence/windows/` inside this Map package.
