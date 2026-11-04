# WMP-03 Map→Gameplay intake contract (typed, versioned)

## 1. Shape compatibility

`v3/handoff/map_to_gameplay_v3.json` preserves the shapes consumed by
`web/src/game/world-economy.ts` (`EconomyMap`) and
`web/src/game/geography-contract.ts` (`GeographicHandoff`) at the live Gameplay head
`d73aa63f…`:

- `economy` retains all **13** `width*height = 43,750` arrays:
  `biome, elevation, slope, moisture, temperature, freshwater, coast, walkable,
  buildable, cargoPassable, road, protected, industrial`, plus
  `id, revision, seed, width, height, tileSize, starts`.
- `roads, pois, criticalPaths, buildSites, nonbossCashSites, vendorSites,
  evacuationSites` retain their v2 shapes.
- `starts` are the four authored spawns `[sp_west 46,75] [sp_lake 98,77]
  [sp_hook 160,49] [sp_gulf 109,116]`.

Compatibility is **shape**, not a claimed validator PASS. `v3` deliberately adds concepts
that the current validators do not know about, and deliberately refuses to fake values the
Gameplay side has not approved.

## 2. Added typed concepts

| Field | Type | Status | Owner |
| --- | --- | --- | --- |
| `ferryRoutes` | `FerryRouteV3[]` (8) | `SOURCE_AUTHORED` geometry / `BLOCKED` traversal | GAMEPLAY |
| `bridgeDeckProposals` | `ProposalV3[]` | `PROPOSED` | MAP+GAMEPLAY |
| `fordProposals` | `ProposalV3[]` | `PROPOSED` | MAP+GAMEPLAY |
| `waterCells` | counters | `VERIFIED` | MAP |
| `approvedTraversal` | decision | `UNKNOWN` | GAMEPLAY |
| `traversalGraphRef` | graph reference | `VERIFIED` geometry | MAP |
| `physicallyPossibleFootprints` | `FootprintV3[]` (21) | `VERIFIED` geometry | MAP |
| `suggestedSites` | `SiteV3[]` (23) | `PROPOSED` | MAP |
| `legalPlacement` | decision | `UNKNOWN` | GAMEPLAY |
| `fieldSemantics` | per-field provenance/status | typed | MAP |
| `roadsWithWaterCells` | exact ID + count (26) | `UNRESOLVED` | GAMEPLAY |
| `unresolvedGameplayOwned` | 11 exact IDs | `UNKNOWN/UNRESOLVED/BLOCKED/PROPOSED` | GAMEPLAY/CREATOR |
| `deprecatedLegacyWalkableWaterCellIndices` | 267 indices | `DEPRECATED__UNSAFE_FOR_COLLISION` | — |

## 3. Field semantics (authority boundaries)

| Field | Unit | Status | No-authority claim |
| --- | --- | --- | --- |
| `economy.elevation` / `slope` | `UNRESOLVED__RAW_SOURCE_BYTE_NORMALISED` | PROPOSED | No metres/degrees or climb rule |
| `economy.moisture` / `temperature` | `DIMENSIONLESS_NORMALISED_POTENTIAL` | PROPOSED | Not numeric climate/weather/damage/season rates |
| `economy.walkable` | binary geometry mask | VERIFIED | Zero on every water cell; NOT a Gameplay collision permission |
| `economy.road` | binary visible-surface mask | VERIFIED | Geometry only; traversal graph is a distinct object |
| `economy.buildable` | binary physical geometry mask | VERIFIED | Physically possible, NOT legal placement; NOT restricted to 23 zones |
| `economy.cargoPassable` | UNKNOWN | UNKNOWN / GAMEPLAY | All zero; v2's 8,777 ASSUMED_PROFILE cells are NOT an approved verdict |
| `approvedTraversal` | UNKNOWN | UNKNOWN / GAMEPLAY | Zero cells approved |

The full 15-field descriptor with per-field `provenance`, `statusVocabulary` and
`separatedConcepts` is `v3/interfaces/map_physical_semantics.v3.json`.

## 4. Separated concepts (the core of the corrective)

1. **ferry route ≠ road ≠ bridge deck ≠ ford ≠ water ≠ approved traversal.**
2. **visible road surface ≠ traversal graph.**
3. **suggested site ≠ physically possible footprint ≠ legal placement.**
4. **measured geometry ≠ Gameplay-owned permission.**

## 5. Explicit compatibility boundary

`validateGeographicHandoff()` currently requires `walkable=1` on all `roads[].cells`. v3 sets
`economy.walkable=0` on **every** water cell, including water-crossing cells on **26** land
roads (exact IDs/counts in `roadsWithWaterCells`). This is an intentional, documented
GAMEPLAY-owned decision (`DR-V3-06`), **not** a silent permission and **not** a claimed
validator PASS. For shape-level consumers that previously read v2's walkable projection, the
267 affected indices are retained only under `DEPRECATED__UNSAFE_FOR_COLLISION`.

`gameplayValidators` in the handoff are all `NOT_EXECUTED__GAMEPLAY_RUNTIME_OWNED`:
`validateEconomyMap`, `validateGeographicHandoff`, `compileEconomy`, `diagnoseStarts`.
`mapStructuralSelfCheckV3()` (`v3/evidence/handoff_check.v3.json`, `errors=0`) is a
**Map-owned** structural check that verifies array lengths, finite/binary values, 4-connected
road geometry, separation of ferry routes, zero water walkability and zero active collision
permissions. It deliberately omits Gameplay-owned economic/start diagnostics.

## 6. Spatial windows

`v3/src/intake_v3.mjs projectWindowV3()` emits **3 windows × 25 masks**
(`v3/evidence/windows/`): full 250×175, west 125×175, east 125×175. Masks are the 13
EconomyMap fields + `biomeSubtype, surface, zone, seaDistance, land` + the 7 new v3 rasters
(`heightClass, cliffCandidate, slopeClass, roadSurface, waterTraversalClass,
activeCollisionPermission, constructionSuitability`). Report:
`duplicates=0 coverage=43750/43750`. West/east are disjoint and their union covers the frame.

## 7. No unapproved value is authoritative

`unapprovedValuesAreNotAuthoritative=true`. Nothing in `v3/` asserts a numeric Gameplay
balance rate, an approved cart/boat/bridge/ford/collision rule, a legal placement grant, a
visual approval, a playable Veyra, a sealed world master or a merge-ready state.
