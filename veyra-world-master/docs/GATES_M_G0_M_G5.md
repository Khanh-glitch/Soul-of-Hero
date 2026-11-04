# MAP-LR03 / WMP-01 — Gates M-G0..M-G5 (actual commands and results)

Master revision digest: `8e3e76da5b7f8db35c66322b0236ef37599b4d2dfbe381ea7b2e5ae176d38e4f`.
Test command: `node tests/run.mjs`. Total **75/75** PASS, **0** FAIL.
Clean-room command: `./clean-room.sh` (logs `evidence/clean_room.log`).
Reproduction command: `./reproduce.sh`.

| Gate | Command / artifact | PASS | FAIL | Result |
|---|---|---:|---:|---|
| M-G0 | `node tests/run.mjs` -> `evidence/tests/test_results.v1.json` | 15 | 0 | PASS |
| M-G1 | `node tests/run.mjs` -> `evidence/tests/test_results.v1.json` | 5 | 0 | PASS |
| M-G2 | `node tests/run.mjs` -> `evidence/tests/test_results.v1.json` | 13 | 0 | PASS |
| M-G3 | `node tests/run.mjs` -> `evidence/tests/test_results.v1.json` | 8 | 0 | PASS |
| M-G4 | `node tests/run.mjs` -> `evidence/tests/test_results.v1.json` | 12 | 0 | PASS |
| M-G5 | `node tests/run.mjs` -> `evidence/tests/test_results.v1.json` | 22 | 0 | PASS |

## Scope of each gate

- **M-G0 canonical parity / source integrity** — pinned GOLD SHA `88780f78…`, 579 IDs, 12 verbatim collections, 26 rasters, cell domains, immutable LR01/LR02 digests, six byte-preserved Web PNGs, tamper detection.
- **M-G1 standalone no-GOLD reproduction** — static clean-room scan, isolated `clean-room.sh` build, manifest child digests, deterministic `revisionDigest`.
- **M-G2 meaningful physical/environmental data** — 32 derived rasters, `groundAt`/`waterAt`/`terrainProfile`/`climateBaselineAt`, cross-sections, fords, contradictions, 4 scale profiles, 12→14→20 crosswalk.
- **M-G3 POI / roof / vertical** — 81 POIs, 210 rooms, 153 proposed roof candidates, 10 proposed vertical links + 8 exact-ID named blockers, LOS/occlusion, negative fixtures.
- **M-G4 chunks / roads / bridges / cargo / build / alt routes** — 70 continuous chunks, 92/12/27 infrastructure, 3 body profiles, no `cartPassable=true`, 23 build envelopes, nonboss route with no Elder gate.
- **M-G5 typed interfaces / determinism / source preservation / perf / handoff** — 15 typed queries, 12 executed negative fixtures, 1,000-query performance, chunk-aware intake window, classified views, docs.

## Gate boundaries (NOT claimed)

Full Web ingestion, weather realization, stock/custody, live AI, player buildings, vehicle runtime, economy, escrow, save/offline, visual approval and continuous playable Veyra are downstream Gameplay gates. No Gameplay runtime file was modified to manufacture a PASS.

## Per-test results

| ID | Gate | Test | Status |
|---|---|---|---|
| M-G0-01 | M-G0 | Embedded GOLD bytes match pinned SHA-256 and byte length | PASS |
| M-G0-02 | M-G0 | GOLD format/version/grid/seed and 12 canonical collection counts preserved | PASS |
| M-G0-03 | M-G0 | geometry_snapshot collections are byte-equal (JSON) to embedded GOLD project collections | PASS |
| M-G0-04 | M-G0 | Full float precision, polygon vertices and authored water holes preserved (no rounding) | PASS |
| M-G0-05 | M-G0 | Source manifest self-check equals the real whole-data file/byte count | PASS |
| M-G0-06 | M-G0 | Every embedded data/ file matches its recorded SHA-256 and byte length | PASS |
| M-G0-07 | M-G0 | 21 GEO-01 rasters + 5 MapLab masks: byte length and SHA-256 verified by loader | PASS |
| M-G0-08 | M-G0 | No corrupt raster cells: declared u8 domains respected | PASS |
| M-G0-09 | M-G0 | Invalid-water and water/land contradiction scan | PASS |
| M-G0-10 | M-G0 | 579 stable feature IDs: unique, indexed, with chunk ownership | PASS |
| M-G0-11 | M-G0 | Route topology: 92/12/27/17/81 authored IDs, vertices in frame, positive lengths | PASS |
| M-G0-12 | M-G0 | LR01 81 layouts / 210 rooms / 410 walls / 235 portals and LR02 463 solids / 169 openings | PASS |
| M-G0-13 | M-G0 | Immutable LR01 v1 and LR02 v2 package digests preserved verbatim | PASS |
| M-G0-14 | M-G0 | Six genuine Web runtime captures preserved byte-for-byte | PASS |
| M-G0-15 | M-G0 | NEGATIVE: a tampered raster cell is detected by the pinned SHA-256 guard | PASS |
| M-G1-01 | M-G1 | Clean-room static scan: no GOLD / MapLab / git / network / Gameplay-runtime references in code | PASS |
| M-G1-02 | M-G1 | Clean-room runtime marker (clean-room.sh runs this test with WMP_CLEAN_ROOM=1) | PASS |
| M-G1-03 | M-G1 | Master manifest lists every child with a valid SHA-256 and byte length | PASS |
| M-G1-04 | M-G1 | Deterministic build: repeated compiler run reproduces the exact revisionDigest | PASS |
| M-G1-05 | M-G1 | All 32 derived rasters reload through the digest-verified clean-room loader | PASS |
| M-G2-01 | M-G2 | groundAt returns physical terrain fields with explicit unit unknowns | PASS |
| M-G2-02 | M-G2 | Every one of the 43,750 cells has a defined physical terrain classification | PASS |
| M-G2-03 | M-G2 | 17 rivers with measured cross-sections, authored editor stroke and UNRESOLVED navigable width | PASS |
| M-G2-04 | M-G2 | 5 lakes, 8 shoreline rings with holes, banks/channels/floodplains, fresh-salt identity | PASS |
| M-G2-05 | M-G2 | Ford candidates, river direction and outlet defects are explicit, never fabricated | PASS |
| M-G2-06 | M-G2 | BR-4 and unbridged river/crossing contradictions named, not silently resolved | PASS |
| M-G2-07 | M-G2 | Static climate potential: 12 regions, 5 explicit unknowns, no numeric temperature/damage/rates | PASS |
| M-G2-08 | M-G2 | At least 3 scale profiles incl U=1.6 and U=2.0; conditional recommendation only | PASS |
| M-G2-09 | M-G2 | Coordinate round trips and frame-boundary drift are measured for every scale | PASS |
| M-G2-10 | M-G2 | terrainProfile crosses multiple chunks and reports raw bytes + chunk sequence | PASS |
| M-G2-11 | M-G2 | Explicit 12 source biomes -> 14 EconomyMap labels -> 20 Web terrain codes crosswalk | PASS |
| M-G2-12 | M-G2 | Resource ecology: 280 authored markers + geographic candidates, no loot/stock/yield/respawn | PASS |
| M-G2-13 | M-G2 | visualSurfaceIds returns technical surface-code histogram, not art approval | PASS |
| M-G3-01 | M-G3 | All 81 POIs assessed with 210 rooms, roof candidates only on covered source rooms, open-air preserved | PASS |
| M-G3-02 | M-G3 | Roof polygons derived only from source room polygons, inside parent bbox, PROPOSED status | PASS |
| M-G3-03 | M-G3 | All 18 vertical cases: 10 proposed links, 8 exact-ID named blockers; no hidden exception | PASS |
| M-G3-04 | M-G3 | Proposed shaft polygons lie inside the measured ground/DEEP overlap | PASS |
| M-G3-05 | M-G3 | Two POI exterior / deep / retreat examples inspectable through poiGraph | PASS |
| M-G3-06 | M-G3 | LOS/occlusion results are real (blocked AND clear), never undefined PASS | PASS |
| M-G3-07 | M-G3 | Every room has a valid polygon, floor and roof descriptor; dynamic state is Gameplay-owned | PASS |
| M-G3-08 | M-G3 | NEGATIVE: invalid POI ID returns typed INVALID, no fallback or fabricated link | PASS |
| M-G4-01 | M-G4 | 70 continuous chunks with neighbours and stable per-chunk ID digests | PASS |
| M-G4-02 | M-G4 | Features crossing chunk boundaries keep the SAME stable ID in every owning chunk | PASS |
| M-G4-03 | M-G4 | 92 roads / 12 bridges / 27 docks with parameterized clearance and three body profiles | PASS |
| M-G4-04 | M-G4 | No cartPassable=true; centreline clearance is never a swept-clearance PASS | PASS |
| M-G4-05 | M-G4 | Road/bridge clearance comparison distinguishes foot, cart and loaded-cart profiles | PASS |
| M-G4-06 | M-G4 | Disconnected roads, false joins, unbridged crossings and 8 blocked ferries preserved | PASS |
| M-G4-07 | M-G4 | Alternate FOOT / CART_PROPOSED / OFFROAD-WATER route candidates with explicit non-canonical status | PASS |
| M-G4-08 | M-G4 | 23 build envelopes: dry cells, water-overlap cells, occupancy UNKNOWN, claims Gameplay-owned | PASS |
| M-G4-09 | M-G4 | Four distinct spawn areas, three independent homes, six distinct Elder territories | PASS |
| M-G4-10 | M-G4 | Possible nonboss source -> vendor -> home -> evacuation route with NO Elder gate | PASS |
| M-G4-11 | M-G4 | traversalCandidateAt never turns an undefined width or bridge deck into PASS | PASS |
| M-G4-12 | M-G4 | buildEnvelopeAt reports water overlap and unknown occupancy instead of a fabricated PASS | PASS |
| M-G5-01 | M-G5 | Every typed query returns the versioned schema and Map/Gameplay authority | PASS |
| M-G5-02 | M-G5 | Deterministic queries: repeated identical calls produce identical JSON | PASS |
| M-G5-03 | M-G5 | Chunk-aware 200x200 intake window: 5 verified masks, chunk continuity, no runtime claims | PASS |
| M-G5-04 | M-G5 | Intake contract states 200x200 Web slice is NOT whole Veyra; no runtime modification | PASS |
| M-G5-05 | M-G5 | Query performance: 1,000 typed queries complete within 2s | PASS |
| M-G5-06 | M-G5 | Source preservation: manifest pins GOLD/LR01/LR02 digests and source manifest SHA | PASS |
| M-G5-07 | M-G5 | Forbidden product claims absent from manifest and layer files | PASS |
| M-G5-08 | M-G5 | Technical views and real Web captures are classified separately | PASS |
| M-G5-09 | M-G5 | Docs, gates, decision register and blockers evidence exist | PASS |
| M-G5-NEG-NEG-01-INVALID-FEATURE-ID | M-G5 | EXECUTED negative fixture NEG-01-INVALID-FEATURE-ID | PASS |
| M-G5-NEG-NEG-02-INVALID-COORDS | M-G5 | EXECUTED negative fixture NEG-02-INVALID-COORDS | PASS |
| M-G5-NEG-NEG-03-BRIDGE-CLIPPING | M-G5 | EXECUTED negative fixture NEG-03-BRIDGE-CLIPPING | PASS |
| M-G5-NEG-NEG-04-BLOCKED-DOOR-LOS | M-G5 | EXECUTED negative fixture NEG-04-BLOCKED-DOOR-LOS | PASS |
| M-G5-NEG-NEG-05-DISCONNECTED-CHUNKS | M-G5 | EXECUTED negative fixture NEG-05-DISCONNECTED-CHUNKS | PASS |
| M-G5-NEG-NEG-06-UNREACHABLE-CANDIDATE | M-G5 | EXECUTED negative fixture NEG-06-UNREACHABLE-CANDIDATE | PASS |
| M-G5-NEG-NEG-07-WATER-OVERLAP | M-G5 | EXECUTED negative fixture NEG-07-WATER-OVERLAP | PASS |
| M-G5-NEG-NEG-08-FALSE-PASSABILITY | M-G5 | EXECUTED negative fixture NEG-08-FALSE-PASSABILITY | PASS |
| M-G5-NEG-NEG-09-ROOF-OPEN-AIR | M-G5 | EXECUTED negative fixture NEG-09-ROOF-OPEN-AIR | PASS |
| M-G5-NEG-NEG-10-VERTICAL-BLOCKER | M-G5 | EXECUTED negative fixture NEG-10-VERTICAL-BLOCKER | PASS |
| M-G5-NEG-NEG-11-CORRUPT-RASTER | M-G5 | EXECUTED negative fixture NEG-11-CORRUPT-RASTER | PASS |
| M-G5-NEG-NEG-12-CLIMATE-NUMERIC | M-G5 | EXECUTED negative fixture NEG-12-CLIMATE-NUMERIC | PASS |
| M-G5-10 | M-G5 | All 12 negative fixtures executed and recorded | PASS |
