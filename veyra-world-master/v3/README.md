# WMP-03 — Physical Semantics Corrective (SOH MAP AGENT)

**Status:** `WMP03_MAP_CORRECTIVE_READY_FOR_GAMEPLAY_REVIEW`
**Authority:** `MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT`
**Branch:** `arena/2e3cfbd2-soul-of-hero` (only Map branch is written)
**Parent:** WMP-01 `8e3e76da…`, WMP-02 `872502373e…` — **both byte-for-byte unchanged**.

WMP-03 is an **additive** corrective round. It fixes four demonstrated P0 physical-world
defects before any Veyra road / cliff / bridge / construction production tileset is
started. It does **not** start production tilesets, add POIs, invent Gameplay balance,
modify the Web runtime, or claim a playable / visually accepted Veyra.

## One-command reproduction

```bash
cd veyra-world-master
./reproduce_v3.sh
```

That runs, in order: the pinned WMP-02 baseline (`./reproduce_v2.sh`), two independent
WMP-03 builds (determinism check), the typed handoff + 25-mask windows, 7 analytical PNGs,
the 91-test physical suite with 17 independent negative fixtures, the isolated clean room
(**no external GOLD/MapLab tree, no migration reader, no network**), and the supplementary
artifact index.

## Layout

| Path | Contents |
| --- | --- |
| `src/build_v3.mjs` | deterministic compiler; writes ONLY `v3/` |
| `src/lib_v3.mjs` | shared helpers + the four **pure** P0 classifiers used by both build and fixtures |
| `src/intake_v3.mjs` | typed Map→Gameplay handoff reader, Map-owned structural self-check, 3×25-mask spatial windows |
| `src/views_v3.mjs` | 7 deterministic analytical technical PNGs |
| `src/run_v3.mjs` | 91 tests: 74 physical + 17 independent negative fixtures |
| `src/artifact_index_v3.mjs` | supplementary index of all v3 files |
| `layers/terrain_height_class.v3.json` | P0-01 quantiles, region evidence, unit policy |
| `layers/road_rasterization_delta.v3.json` | P0-02 per-road before/after drift + length |
| `layers/water_traversal.v3.json` | P0-03 ferry / road / bridge / ford / water / approved traversal |
| `layers/traversal_graph.v3.json` | visible surface vs traversal graph separation |
| `layers/construction_semantics.v3.json` | P0-04 suggestions / physical possibility / legal placement |
| `layers/structural_checks.v3.json` | bounded POI-entrance / host-overlap / roof-boundary checks |
| `layers/measured_delta.v3.json` | consolidated changed measurements |
| `interfaces/map_physical_semantics.v3.json` | typed interface, provenance, UNKNOWN/PROPOSED/VERIFIED |
| `handoff/map_to_gameplay_v3.json` | compatible EconomyMap + GeographicHandoff shapes with explicit field semantics |
| `docs/` | preflight audit, delta report, intake contract, gates, negative fixtures, commit reference |
| `evidence/` | determinism, handoff check, windows, views, tests, clean room, artifact index |

## The four corrections (measured)

| ID | Before | After |
| --- | --- | --- |
| P0-01 | cliff threshold `slopeRaw > 200` exceeds observed raster max `150`; `cliff.u8` = **0** cells; slope classes 3/4 unreachable | 6 observed-quantile height classes, 5 reachable slope classes, **305** connected cliff candidates, **996** terraces; Typhon/Cinder/snow/wetland/lowlands validated; units remain UNRESOLVED |
| P0-02 | X-then-Y `rasterPath()` produces L-shaped staircases; max drift **76.198 au** | shape-preserving 4-connected chain; max drift **5.6569 au**, mean **6.5994 → 2.2759 au**; all 92 IDs, vertices, endpoints, connectivity preserved |
| P0-03 | 8 ferry polylines had **219** land-walkable water cells; **267** proposed crossings silently had `walkable=1` | 8 ferry routes separated from roads, **0** land-walkable water cells, **0** active collision permissions; 211 ferry / 10 bridge-proposal / 26 ford-proposal cells classified; `approvedTraversal = UNKNOWN / GAMEPLAY` |
| P0-04 | `economy.buildable` = **1242** cells from only 23 surveyed zones | **21** full-world physically possible footprints / **7035** cells, **6481** outside surveyed zones; 23 surveyed envelopes reconciled with terrain + protected geometry; `legalPlacement = UNKNOWN / GAMEPLAY` |

Road cell-count length is **unchanged** (13,408 au before and after vs 10,853.7572 au authored):
both rasterizations are monotone 4-connected chains, so the defect was **shape drift**, not
length. Grid quantization over-counts both equally by 23.5%; v3 reports that honestly
rather than claiming a route-length gain.

## Bounded structural checks (read-only)

- **POI entrances:** 81 assessed; 55 have a source exterior entrance and **all 55** have road
  frontage within 40 au; **26** have no exterior entrance in the source and are reported by
  exact ID. Zero canonical POI relocations.
- **Host/subsite envelopes:** 18 of 23 surveyed sites overlap a POI ground level or Elder
  outer territory; exact IDs and cell counts reported, none auto-resolved.
- **Roof boundaries:** 153 classified; WMP-02's 99 "vertices outside parent room" are
  actually **boundary-coincident**, with **0** vertices truly outside. Boundary coincidence is
  a canopy-vs-full-roof semantic question, not a licence to shrink every flagged polygon.
  **Zero** automatic shrinks in v3; **zero** canonical polygon changes.

## What is NOT claimed

No Gameplay validator PASS, no runtime ingestion, no independent CI, no visual or creator
acceptance, no `WORLD_MASTER_SEALED`, no `VEYRA_PLAYABLE`, no `MERGE_READY`, no production
tileset, no new POI, no numeric Gameplay balance rate, no invented metres/degrees/climb law,
no approved ferry/boat, bridge-deck, ford, cart-swept-clearance or collision rule, no legal
placement grant. `economy.cargoPassable` is deliberately **all zero** in v3 because WMP-02's
8,777 ASSUMED_PROFILE screening cells are not an approved cart-passability verdict.
