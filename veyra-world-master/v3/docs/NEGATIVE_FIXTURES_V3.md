# WMP-03 independent negative fixtures

Rule applied: **a test that merely documents a blocker is not proof a defect is fixed.**
Every fixture below mutates an **independent synthetic SOURCE input** and executes the
**same pure production classifier** exported from `v3/src/lib_v3.mjs` that
`v3/src/build_v3.mjs` uses. `T-10`, `C-09` and `B-07` additionally prove bit-for-bit
equivalence between the classifier and the emitted rasters. Raw records:
`v3/evidence/tests/negative_fixtures.v3.json`. Result: **17/17 PASS**.

## P0-01 — terrain

| ID | Independent input | Expected | Actual |
| --- | --- | --- | --- |
| T-NEG-01 | synthetic `S`: `slope=0`, `elevation=40`, no zones/elders everywhere | no false cliffs | `cliffCount=0`, `maxHeightClass≤1` |
| T-NEG-02 | synthetic `S`: every slope byte **+51** (same terrain, different labels) | WMP-01 `>200` flips from 0 to >0 cliffs; v3 stays bit-identical | WMP-01 shifted cliffs >0; v3 `cliff/heightClass/slopeClass` identical hex |
| T-NEG-03 | synthetic `S`: one isolated `slope=255` cell | connectivity guard rejects it | `cliff[cell]=0` |
| T-NEG-04 | `unitPolicy` JSON | no asserted metres/degrees/climb law | 0 asserted units, `physicalUnitStatus=UNKNOWN` |

**Production bug found and fixed by T-NEG-01:** zero-spread quantiles made `slope≥p95`
(`0≥0`) and `steepNeighbours≥2` trivially true, classifying all 14,392 dry cells as cliffs,
and floating-point noise pushed constant scores past all class cuts. `classifyTerrain()`
now has an explicit `degenerateInput` guard; `classifyConstruction()` applies spread-based
penalties only when the observed distribution has spread. The fix is in the production
classifier, not the fixture.

## P0-02 — roads

| ID | Independent input | Expected | Actual |
| --- | --- | --- | --- |
| R-NEG-01 | synthetic diagonal `(4,4)→(500,500)` | legacy L-shape drift >40 au; corrected ≤5.7 au | legacy >40 au with ≥60 X-first cells on the start row; corrected ≤5.7 au |
| R-NEG-02 | synthetic L polyline `(4,4)→(404,4)→(404,404)` | 4-connected, endpoints preserved, ≤5.7 au | PASS |
| R-NEG-03 | synthetic reverse diagonal `(900,900)→(100,100)` | 4-connected, ≤5.7 au | PASS |

## P0-03 — water traversal

| ID | Independent input | Expected | Actual |
| --- | --- | --- | --- |
| W-NEG-01 | 20 synthetic water cells, one ferry road, one bridge proposal, one ford | ferry class=2, `landWalkable=false`, 0 active permissions | PASS |
| W-NEG-02 | same grid | bridge=3, ford=4, both PROPOSED with 0 permissions | PASS |
| W-NEG-03 | real v2 ferry cells vs v3 `economy.walkable` | v2=219, v3=0 for every water cell | PASS |

## P0-04 — construction

| ID | Independent input | Expected | Actual |
| --- | --- | --- | --- |
| C-NEG-01 | synthetic 20×20 dry flat patch, `zoneId=0` (no surveyed zone) | ≥1 full-world footprint, every cell outside surveyed zones | PASS |
| C-NEG-02 | one `protectedGeometryCandidate` cell | suitability 0 | PASS |
| C-NEG-03 | one forced `cliffCandidate` cell | suitability 0 | PASS |

## Structural + interface

| ID | Independent input | Expected | Actual |
| --- | --- | --- | --- |
| S-NEG-01 | structural report vs `architecture.pois[]` | 0 canonical redesigns | PASS |
| S-NEG-02 | v2 99 corrected insets vs v3 roof semantics | 0 new auto-shrinks, 99 boundary-coincident | PASS |
| I-NEG-01 | interface + handoff | `cargoPassable` all 0, 0 approved cells, validators NOT_EXECUTED | PASS (also exposed v2's 8,777 ASSUMED_PROFILE cells leaking into v3; fixed by zeroing the field) |
| I-NEG-02 | `roadSurface.u8` + `traversal_graph.v3.json` + `activeCollisionPermission.u8` | surface >0, edges >0, 0 active permissions | PASS |

**Production bug found and fixed by I-NEG-01:** the v3 handoff spread v2's `economy` object
and inherited 8,777 `cargoPassable=1` ASSUMED_PROFILE screening cells. Since the typed
interface declares that field `UNKNOWN / GAMEPLAY`, those unapproved values would have
appeared authoritative. `build_v3.mjs` now sets `economy.cargoPassable` to all zero and
documents the override in `fieldSemantics`.
