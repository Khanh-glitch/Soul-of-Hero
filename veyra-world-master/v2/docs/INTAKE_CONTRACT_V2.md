# WMP-02 typed, versioned geographic handoff (consumer boundary)

Status: **MAP-OWNED GEOGRAPHIC FIELDS SUPPLIED / GAMEPLAY INGESTION NOT IMPLEMENTED**.
Source: `v2/src/intake_v2.mjs`. Output: `v2/handoff/geographic_handoff.v2.json`.
Structural self-check: `v2/handoff/handoff_check.v2.json`.

## 1. Why v1 was insufficient

`api/intake.mjs` `projectWindow()` writes 5 u8 masks
(`tiles`, `fresh`, `zone`, `seaDist`, `land`). `validateEconomyMap()` requires
**13** full-width arrays (`biome`, `elevation`, `slope`, `moisture`, `temperature`,
`freshwater`, `coast`, `walkable`, `buildable`, `cargoPassable`, `road`, `protected`,
`industrial`) plus `starts`, and `validateGeographicHandoff()` additionally requires
`roads`, `pois`, `criticalPaths`, `buildSites`, `nonbossCashSites`, `vendorSites`,
`evacuationSites`. WMP-02 emits **18** masks per spatial window and a complete typed
handoff. `H-07` is a negative fixture proving the 5-mask projection is rejected as a
complete `EconomyMap`.

## 2. What is supplied (all Map-owned)

| Field | Source / semantics |
|---|---|
| `economy.id / revision / width / height / tileSize` | `veyra-wmp-v2`, `2`, `250`, `175`, `8` authoring units per cell (au→runtime-tile transform UNRESOLVED) |
| `economy.biome` | `layers/crosswalks.v1.json` lossy 14-label projection; original 12 subtype IDs preserved in `biomeSubtype.u8` and window masks |
| `economy.elevation` | GEO-01 **RAW BYTE**, metres UNRESOLVED |
| `economy.slope` | normalized raw byte `[0,1]`, NOT degrees, NOT a Gameplay passability threshold |
| `economy.moisture` | v2 `moisturePotentialNorm.u8 / 255` — dimensionless PROPOSED geographic potential |
| `economy.temperature` | v2 `temperaturePotentialNorm.u8 / 255` — dimensionless PROPOSED thermal potential, NOT °C |
| `economy.freshwater / coast / protected` | authored GEO-01 / LR02 masks |
| `economy.walkable / road` | authored dry-land + road cell paths; 267 road-over-water cells are **PROPOSED deck/ford geometry**, never authored land |
| `economy.buildable` | 23 v2 largest-connected dry build subsets |
| `economy.cargoPassable` | **ASSUMED 8 au footprint screening mask**, NOT approved cart passability; all 92 `roads[].cargoPassable=false` |
| `economy.industrial` | reproducible from authored zone tags `gần đường vận tải` / `gần trung tâm khai thác` plus road/POI geometry |
| `economy.starts` | 4 GOLD `project.spawns[]` anchors, snapped only when the anchor cell is not walkable |
| `roads` | 92 authored 4-connected cell paths, `widthTiles=1` raster cell, `bridgeCells` subset, `cargoPassable=false` |
| `pois` | 81 authored POIs: ground-level polygon footprint, exterior entrance cells, room cells (subset of footprint), static doorway cells, BFS retreat paths to authored road cells |
| `criticalPaths` | contiguous greedy path inside the largest `protected ∧ walkable` component |
| `buildSites` | 23 dry footprints + assumed-profile loading candidates |
| `nonbossCashSites / vendorSites / evacuationSites` | geometry cell indices only from `layers/build_habitat_endgame.v1.json` |

## 3. What is explicitly UNRESOLVED (no fake fallback values)

`handoff.unresolvedGameplayOwned` has 14 entries. Notably:

- `seed = 0` is an **explicit UNRESOLVED placeholder**, NOT a Gameplay world seed.
- `tileSize = 8` is an authoring-unit raster, NOT an approved au→tile transform.
- numeric temperature / weather / damage / crop / seasonal rates: **absent**.
- `pois[].powerNodes`, `hazardCells`, `exteriorLootSites`, `interiorLootSites`: **empty arrays** — no invented loot, power node, hazard or stock.
- stock / custody / escrow / save / offline / live AI / visual approval: not supplied.
- ford depth & flow, bridge deck bearing, swept/trailer clearance: `UNKNOWN`.
- `Gameplay` owns adopting any of the 8 corrected vertical candidates and any of the
  12 proposed decks / 4 road connectors / 1 outlet channel.

## 4. Checks executed vs NOT executed

A deterministic **JS structural port** of `validateEconomyMap()` and the structural
parts of `validateGeographicHandoff()` is implemented in `mapStructuralSelfCheck()`.
Result: **0 errors** for the emitted handoff (`H-01`).

**NOT executed** (Gameplay-owned, Web runtime untouched):

- `compileEconomy()`
- `diagnoseStarts()`
- the full `validateGeographicHandoff()` (which calls both of the above)

`gameplayOwnedChecks.webRuntimeModified = false`. A Map-side structural self-check
PASS is **NOT** a `validateGeographicHandoff()` PASS, NOT balanced starts, NOT
Gameplay ingestion, and NOT playable Veyra.

## 5. Complete spatial window sampling

`projectWindowV2()` emits 3 windows × 18 masks into `v2/evidence/windows/`:
`wmp.v2.window.full.250x175`, `wmp.v2.window.west.125x175`,
`wmp.v2.window.east.125x175`. At `U = 8 au/tile`, each window tile maps to exactly
one 8 au source cell — no interpolation.

- west global tiles `gx 0..124`, east `gx 125..249`, both `gy 0..174`
- **0 duplicate global tiles**, union `43750 / 43750` cells, `0` out-of-frame tiles
- 70 chunk `stableIdDigest` values recomputed and matched,
  `0` duplicate feature IDs within a chunk, `0` missing feature IDs,
  `stableSourceIdDigest` recorded
- vertical chunk boundary neighbour declarations checked (10 boundaries)

Report: `v2/evidence/windows/window_report.v2.json`.

## 6. Technical views

`v2/evidence/views/index_v2.json` records 8 deterministic pure-Node PNGs. They are
**MAP ANALYTICAL BEFORE/AFTER PREVIEWS**, explicitly labelled
`TECHNICAL_VIEW__NOT_WEB_RUNTIME_PROOF__NOT_CREATOR_APPROVED_ART`. The 15 WMP-01
analytical views and 6 byte-preserved real Web PNGs remain unchanged.
