# MAP-LR02 → Gameplay handoff

Ownership: **MAP designs the physical world. Gameplay populates and simulates it.**
This document is a factual handoff of Map-owned static inputs. It is **not** an
implementation command, a merge request, or a claim of playable Veyra.

## Checkpoint M0 — earliest consumer-ready package

| Field | Value |
| --- | --- |
| Branch | `arena/2e3cfbd2-soul-of-hero` |
| Package | `world_lab/lr02/output/greywater_spatial_patch.v1.json` |
| Schema | `soh.map.lr02.greywater_spatial_patch.v1` |
| Version / revision | `1` / `1` |
| Parent | `soh.map.lr01.geography_package.v1`, `world_lab/lr01/output/geography_package.v1.json` |
| Parent digest | `e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63` |
| New revision digest | see `revisionDigest` in the package (recomputed by `src/test.mjs` gate `LR02-04`) |
| Reproduce | `cd world_lab/lr02 && ./reproduce.sh` |
| Tests | `LR02_TESTS 30/30`; Greywater spatial `13/13`; injected negative `8/8`; all 81 POIs `0 FAIL` |

Exact pushed commit is recorded in the PR44 handoff comment for this checkpoint.

### What changed physically

`po_greywater` in LR01 had 7 **continuous** solid walls and 8 portals that were
mostly centroid-midpoint *metadata*: a player could not walk through a doorway
because no geometric hole existed. LR02 keeps LR01 untouched and emits a new
revision that:

- clips each intersected wall into deterministic solid spans
  (`wall.po_greywater.1.span.1`, `.span.2`, …) with an exact
  `oldWallId → newSolidSpanIds` mapping;
- gives every portal a **real geometric opening interval** on the actual wall /
  shared room boundary (not a centroid midpoint), with `intervalAu`, `aAu`,
  `bAu`, `centreAu`, `openingAu`, `effectiveClearWidthAu`, `thicknessAu`,
  `orientationRad`, `normalAu`, `fromRoomId`, `toRoomId` — all in
  **authoring units**, `2000×1400` frame, `transformStatus: UNDECIDED`;
- proves algebraically that solid spans + opening intervals tile every wall
  exactly (`EXACT_COVERAGE`): no invisible solid over a doorway, no accidental
  gap in a closed wall;
- preserves parent `wall.*`, `room.*`, `portal.*`, `entrance.*` IDs;
- keeps open-air POIs / yards / piers as non-solid boundaries, not arbitrary
  closed compounds.

Greywater result: **15 solid spans, 8 static openings, 7 wall mappings, 6/6
rooms physically reachable**, `verdict: VERIFIED`.

### Geometry fields a consumer should read

- `staticArchitecture.staticSolids[]` — clipped segments, `blocksMovement: true`,
  `blocksSight: true`, `thicknessAu`, `unit: authoring_unit`, `status: PROPOSED`.
- `staticArchitecture.staticOpenings[]` — static holes, `blocksMovement: false`,
  `staticHole: true`, `dynamicDoorOwner: GAMEPLAY`, `doorState/lockedState/
  powerRequirement: UNKNOWN`.
- `staticArchitecture.collisionAdapter` / `losAdapter` — static ID lists only.
- `staticArchitecture.circulation` — physical grid BFS **and** graph BFS,
  reported separately and compared. Graph BFS is not substituted for clearance.
- `coordinateAndTransform.diagnosticTransforms[]` — `U=1.6` (`1250×875` tiles)
  and `U=2.0` (`1000×700` tiles) **isolated same-origin projections** of the
  same geometry. Diagnostic only; no approved scale, no canonical frame edit.

### Spawn eligibility contract

`spawnEligibility.contract` is
`soh.map.lr02.spawn_eligibility_contract.v1`, decision
`SEEDED_RANDOM_LEGAL_POSITION_SAMPLING`.

Map supplies real **areas**: `greywaterEligibleArea` (107 × 8au cells =
6,848 au², clipped to the bounded window), plus 16 whole-Veyra candidate
regions across 3 landmasses / 18 source zones, with cell indices, convex hulls,
clearance, relief, slope descriptors, parent geographic IDs and rejection
evidence. `sp_*` remain **source/provenance landmarks only**.

Gameplay supplies the seed, runtime transform, runtime collision, dynamic
occupancy, claim legality, hazard/creature exposure, actor separation,
persistence and starter-resource policy. Map does **not** supply a runtime
spawn coordinate, spawn compound, house, shelter, crate, beacon, cleared
corridor, creature-free distance or occupancy verdict. All such conditions are
`UNKNOWN` / `GAMEPLAY_OWNED`.

Build sites are validated as **physical envelopes** (area, road frontage,
slope, terrain, water overlap), separately from spawn eligibility. Swept
vehicle clearance remains `UNKNOWN` and joint with Gameplay.

### Observed GAME-LR02 compatibility (read-only checkpoint)

Read at PR44 head `7b9805b2ff276d07121063b6dfb2f68a902605db` (comment `6619873863`,
GAME-LR02 G0 `b76d4091`). No Gameplay file was modified.

- `web/src/game/veyra/intake.ts` pins **LR01 v1 only**: schema, revision 1,
  packageId, stage, whole-package SHA `ac9317ae…`, body SHA `e3259eb3…`,
  79 payloads, 21 rasters, 579 features, 7-value status vocabulary. Its own
  comment says a new Map revision needs a **separately reviewed pin**.
  → An LR02 patch cannot and must not pass `validateStage1()`; Map does not
  overwrite LR01.
- `web/src/game/veyra/projection.ts` uses `originAu [640,440]`,
  `U ∈ {1.6, 2}`, a `200×200` runtime grid, `TILE=16`, and
  `tile = (au − origin)/U`. Map coordinates are global `[0,0]` authoring au.
  → **Do not compare raw au to Gameplay tile indices.** The patch supplies
  `gameplayCompatibility.consumerProjections[]` with exact projected solids,
  openings, entrance tile index and eligible-area bbox for both U values;
  all Greywater geometry lies inside the observed window.
- `projectVeyra()` returns `statics: []` and derives POI containment from
  canonical `foot` polygons only; it never reads
  `geometryAdapters.collision.staticWalls`. → **No static collision seam
  exists yet.** Map supplies clipped solids + static holes keyed by stable IDs;
  Gameplay owns injecting them and all dynamic door/lock/power rules.
- Status vocabularies differ: Gameplay pins `VALIDATED/UNDECIDED/…`; LR02 keeps
  `VERIFIED/UNKNOWN/INVALID/UNRESOLVED` distinct. The patch includes an
  explicit crosswalk; `VERIFIED` means Map geometric proof only.
- Gameplay uses internal compiler reachability anchors and `starts: []`;
  the Map seeded-sampling eligibility contract has no reader yet.
- `U=1.6/2.0` and the 9 au analytical road/river stroke are diagnostic /
  analytical only on both sides: no approved scale, width, swept clearance or
  bridge deck span.

Seven findings (`CMP-01`…`CMP-07`) with owners and statuses are in the package.

### Ready vs unverified

**Ready (Map-owned):** exact parent digest, bounded static solids/openings,
stable ID mapping, positive + negative doorway tests, physical-vs-graph
connectivity, U=1.6/U=2 diagnostic geometry, bounded eligible area, full
frame and provenance, reproducible tests.

**Unverified (Gameplay-owned / joint):** Gameplay intake, projection into the
existing SOH Web game, runtime collision and tile transform (U UNDECIDED),
dynamic doors/locks/power/destruction, seeded final position, occupancy/claim,
hazards, actor separation, K6 roof reveal, compiled resources, build/pay,
save/reload, native 640×360 performance, player-scale clearance in the real
runtime, creator visual approval, **playable Veyra**.

No playable or final-world claim is made. PR44 remains OPEN / DRAFT / HOLD.
