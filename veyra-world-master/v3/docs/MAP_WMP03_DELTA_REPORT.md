# WMP-03 — consolidated evidence-based Map → Gameplay / Control Tower handoff

**Status:** `WMP03_MAP_CORRECTIVE_READY_FOR_GAMEPLAY_REVIEW`
**Meaning:** every **Map-owned** gate of the P0 corrective round is proven with executable
evidence. This is **not** Gameplay acceptance, runtime ingestion, visual approval, a sealed
world master, a playable Veyra, or a merge request. Remaining decisions are listed with exact
IDs and owners in §8.

**Branch:** `arena/2e3cfbd2-soul-of-hero` only. PR44 stays OPEN / DRAFT / HOLD / NO MERGE.
**Parents:** WMP-01 `revisionDigest=8e3e76da…`, WMP-02 `revisionDigest=872502373e…` — both
byte-for-byte unchanged; `v3/` and two root scripts are the only additions.

---

## 1. Exact SHAs (this revision)

| Artifact | SHA-256 |
| --- | --- |
| `manifest.v1.json` (pinned, unchanged) | `327bf48c05c92d9ce0ee3ddf1281aca9ce2a47dcf47ede81dc524f80e86e313e` |
| `v2/manifest.v2.json` (pinned, unchanged) | `6954e17a6fa46da2123e9bffa4faeb65f0cbc87be6def9483e43aa012be94009` |
| `v2/handoff/geographic_handoff.v2.json` (pinned, unchanged) | `82d8b061ab60b5feab29c6a1cfd579ad9e6428bc9c371983061681a381fe0f8c` |
| **`v3/manifest.v3.json`** | `9043386cb9ba9a470a9d2764a5b9a7ec20fc3ecb433b23aaace212d8330f8004` |
| **`revisionDigest`** | `1356735557a421f720e24c6e9dd54ae0812e5f75cc18a48c14ddfc69de9bd114` |
| `v3/handoff/map_to_gameplay_v3.json` | `53ee6727345288ce1b7898d1dcb97015e2153154c780f288e9a40b25272e65c8` |
| `v3/interfaces/map_physical_semantics.v3.json` | `031f6100448799225611d8a29de5f9f18c4ba065cb2754196f4d4bbec75e583d` |
| `v3/layers/measured_delta.v3.json` | `9de6922d61987b7b8df15ec6de4612b62f98fe98406f50da97d958a84d398934` |
| `v3/evidence/handoff_check.v3.json` | `ecdf14460be2cb4c94ed106e11ea9008432c2c59890910701864326f89cd6ad0` |
| `v3/evidence/windows/window_report.v3.json` | `568934b7272978edecfe60eb5d94e720129b0e49fa54e71e9d13f306210f3c29` |
| `v3/evidence/views/views_index.v3.json` | `6665712ad0b204a44ac54f718c6b4150c569697dad8a152928c6bdda6dcb32f2` |
| `v3/evidence/tests/test_results.v3.json` | `4856307d2dc42310d86fea51f4945434aca88ec0f3aad6dc7043b36b4d87daee` |
| `v3/evidence/tests/negative_fixtures.v3.json` | `31f634057a7fd626b3e9569141a1d42622d95960150bd066bbc7ac9dfe9e1275` |
| `v3/evidence/clean_room_v3.json` | `de9eb30ce53f29a7156dab98fbf6398c75cb825aecf4ce8afed25944c2b46ae2` |
| `v3/evidence/build_determinism_v3.json` | `dbf7a7ed139469e4c95461d1d0dc437b109d0723165d212a24caeea8f00ac976` |
| `v3/evidence/artifact_index.v3.json` | self-describing supplementary index (120 files); read the file for its exact byte total, own SHA and per-file digests |

---

## 2. Reproduction evidence

```
./reproduce_v3.sh
  WMP_V2_REPRODUCE_OK revisionDigest=872502373e783b190f94a3c86065d6b3fd8c08d010b2ecc4130623f4283a682d
  WMP_TESTS 75/75 gates=M-G0:15/15 M-G1:5/5 M-G2:13/13 M-G3:8/8 M-G4:12/12 M-G5:22/22
  WMP_V2_TESTS 47/47 physical=29 negative=11 FAIL=0
  WMP_V3_BUILD_DETERMINISM_OK 1356735557a421f720e24c6e9dd54ae0812e5f75cc18a48c14ddfc69de9bd114
  WMP_V3_HANDOFF_OK errors=0 roads=84 ferryRoutes=8 landWalkableWaterCells=0 activeCollisionPermissionCells=0
  WMP_V3_WINDOWS_OK windows=3 masks=25 duplicates=0 coverage=43750/43750
  WMP_V3_VIEWS_OK analytical=7 totalBytes=80331
  WMP_V3_TESTS 91/91 physical=74 negative=17 FAIL=0
  WMP_V3_NEGATIVE_FIXTURES_OK fixtures=17 defects=17
  WMP_V3_CLEAN_ROOM_OK digest=1356735557a421f720e24c6e9dd54ae0812e5f75cc18a48c14ddfc69de9bd114
       noExternalGoldTree=true noLegacyLab=true noNetwork=true
  WMP_V3_ARTIFACT_INDEX_OK files=120 (see v3/evidence/artifact_index.v3.json for exact bytes and per-file SHA-256)
  WMP_V3_REPRODUCE_OK revisionDigest=1356735557a421f720e24c6e9dd54ae0812e5f75cc18a48c14ddfc69de9bd114
```

- **Build twice deterministically:** two independent `node v3/src/build_v3.mjs` runs produced
  the identical `revisionDigest` (recorded in `build_determinism_v3.json`).
- **Clean room:** a fresh `/tmp` copy containing only `data/ lib/ api/ tools/ tests/ build.mjs
  README.md docs/ manifest.v1.json layers/ rasters/ evidence/ v2/src/ v3/src/` rebuilt the
  WMP-02 baseline, all v3 layers, handoff, windows, views and test results from scratch. The
  isolated `revisionDigest`, typed handoff SHA, test-results SHA and views-index SHA all equal
  the source tree. No `migration/` reader, no `world_lab/`, no external GOLD tree, no
  network-capable import. WMP-01 75/75 and WMP-03 91/91 also pass inside the isolated copy.
- **Technical images inspected:** all **7** PNGs were opened and read directly (not merely
  hashed): terrain height class, cliff before/after, road drift before/after, water traversal,
  construction before/after, region geometry, bounded structural checks. Each is labelled
  `MAP_ANALYTICAL_TECHNICAL_PREVIEW` / `NOT_WEB_RUNTIME_PROOF` / `NOT_VISUAL_ACCEPTANCE`.

---

## 3. P0-01 — Terrain classification

**Defect (proven):** WMP-01 `build.mjs:151,156,161-163` classified a cliff with
`slopeRaw > 200`, but `data/rasters/geo01/slope.u8` has observed min `0`, max **`150`**.
`rasters/cliff.u8` therefore contains **0** one-cells and `slopeClass` only ever reaches 0–2
(histogram `{0:43624, 1:107, 2:19}`).

**Correction:** deterministic, physically meaningful classification from **observed empirical
quantiles** of real slope, elevation, 3×3 neighbourhood relief/convexity and authored region
geometry (`zoneId`, `elderGeometryId`, `biomeCode`). Dimensionless analytic weights
`{slope .40, relief .25, elevation .20, convexity .10, region .05}` feed six height classes
bounded by score quantiles `[.5,.75,.9,.97,.995]`. A cliff is a **connected steep face**:
`heightClass≥4` AND `slope≥p95` AND `3×3 relief≥p90` AND ≥2 steep 8-neighbours.

| Measurement | Before | After |
| --- | --- | --- |
| Cliff cells | 0 | **305** |
| Terrace cells | — | **996** |
| Reachable slope classes | 3 (0–2) | **5 (0–4)** `{0:5678,1:4768,2:2311,3:1170,4:465}` |
| Height classes | 1 (implied flat) | **6** `{0:7199,1:3595,2:2158,3:1008,4:361,5:71}` |

Observed dry-land quantiles (RAW BYTES, **not** metres/degrees): slope
`p50=3 p75=9 p90=17 p95=20 p97=22 p99=27 max=150`; relief `p50=8 p75=24 p90=42 p95=51`;
elevation `p50=51 p75=69 p90=120 p95=155`.

**Region validation (measured, non-exclusive masks):**

| Region | Cells | Mean slope raw | Mean elev raw | Cliff candidates | Cliff / 1000 | Height classes |
| --- | --- | --- | --- | --- | --- | --- |
| TYPHON_TERRITORY | 789 | 15.8517 | 159.82 | 96 | **121.673** | `{0:6,1:106,2:323,3:209,4:87,5:58}` |
| CINDER_VOLCANIC | 462 | 17.868 | 140.3593 | 94 | **203.4632** | `{0:4,1:19,2:100,3:187,4:151,5:1}` |
| SNOW_BIOME | 217 | 13.4839 | **220.5668** (highest) | 18 | 82.9493 | `{0:5,1:44,2:95,3:42,4:15,5:16}` |
| WETLAND_BIOME | 527 | 3.2087 | 21.5484 | **0** | **0** | flat `{0:419,1:107,2:1}` |
| LOWLAND_ZONES | 412 | 3.6917 | 47.2015 | **0** | **0** | flat `{0:242,1:152,2:18}` |
| HIGH_ROCK_ZONES | 161 | 8.2795 | 71.9193 | 11 | 68.323 | `{0:43,1:54,2:37,3:12,4:10,5:5}` |

Flat wetland and lowland regions acquire **zero** cliff faces; snow has the highest raw
elevation; Typhon/Cinder have the highest cliff density. A **degenerate-input guard** was
added after an independent flat-world fixture exposed that zero-spread quantiles would
otherwise mark every cell a cliff — the fix is in the production classifier, not the test.

Units remain `UNRESOLVED__RAW_SOURCE_BYTE`; no metres, degrees, climb rule or collision law.

---

## 4. P0-02 — Road rasterization

**Defect (proven):** `v2/src/intake_v2.mjs rasterPath()` walked all X first then all Y, turning
diagonal authored segments into L-shaped staircases arbitrarily far from the source geometry.

**Correction:** dense ≤`CELL/4` sampling of each authored straight segment, joined by a
4-connected Bresenham-style chain; diagonal cell jumps insert the intermediate cell whose
centre is nearer the authored segment. No authored vertex, endpoint cell, road ID or count
changed.

| Measurement (92 roads) | Before (X-then-Y) | After (v3) |
| --- | --- | --- |
| Max perpendicular drift | **76.198 au** | **5.6569 au** |
| Mean perpendicular drift | **6.5994 au** | **2.2759 au** |
| Roads with improved max drift | — | **78** (14 already axis-aligned, unchanged) |
| Worst road | `rd_s` 76.198 au | `rd_s` 5.5971 au |
| Authored polyline length | 10,853.7572 au | 10,853.7572 au |
| Rasterized path length | 13,408 au | 13,408 au |

**Length is deliberately reported as unchanged.** Both algorithms produce monotone
4-connected chains with the same cell count per road (0/92 differ), so the defect was **shape
drift**, not length. Both over-count the authored polyline by 23.5% due to grid quantization;
v3 does not claim a route-length gain. Per-road authored length, legacy/corrected path length,
drift and endpoint cells are in `layers/road_rasterization_delta.v3.json`.

**Visible surface ≠ traversal graph:** `rasters/roadSurface.v3.u8` (1,654 cells) is a tileset
geometry candidate; `layers/traversal_graph.v3.json` is 1,676 measured adjacency edges over
1,654 nodes with `lengthAu=8` and `activeCollisionPermission=false` on every edge. They are
separate objects with separate semantics; neither grants traversal.

---

## 5. P0-03 — Water traversal

**Defect (proven):** WMP-02 emitted all 92 roads — including **8 ferry polylines** — into
`roads[]` and set `economy.walkable=1` on **219** ferry water cells plus **267** proposed
water-road cells in total. Ferry routes silently became land-walkable and proposed
bridge/ford crossings silently became active collision permissions.

**Correction:** a pure classifier separates `0 WATER_NO_ROAD`, `1 DRY_LAND_ROAD_SURFACE`,
`2 FERRY_ROUTE_NOT_A_LAND_ROAD`, `3 BRIDGE_DECK_PROPOSAL`, `4 FORD_PROPOSAL`. Ferry routes
are removed from `roads[]` and emitted as a distinct `ferryRoutes` array (union of IDs still
92 = 84 + 8).

| Measurement | v2 | v3 |
| --- | --- | --- |
| Ferry routes in `roads[]` | 8 (as land roads) | **0** (8 separate `ferryRoutes`) |
| Land-walkable ferry water cells | **219** | **0** |
| Water cells with `walkable=1` | **267** | **0** |
| Active collision permissions | implicit (unmarked) | **0** (explicit all-zero raster) |
| Water-road cells classified | 267 (all "proposed") | **247** = 211 ferry + 10 bridge proposal + 26 ford proposal |
| `approvedTraversal` | absent | `UNKNOWN / GAMEPLAY / 0 cells` |

Every ferry route has `landWalkable=false`, `activeCollisionPermission=false` and
`traversalStatus=BLOCKED__GAMEPLAY_OWNS_BOAT_MECHANIC`. Bridge and ford proposals are
`PROPOSED__DECK_GEOMETRY_ONLY` / `PROPOSED__DEPTH_AND_FLOW_UNKNOWN`. `economy.walkable=0`
on **every** water cell. v2's 267 legacy walkable water cell indices are preserved only in a
`deprecatedLegacyWalkableWaterCellIndices` list labelled
`DEPRECATED__UNSAFE_FOR_COLLISION__NOT_AN_APPROVED_TRAVERSAL_RULE`.

**Explicit compatibility boundary:** Gameplay's `validateGeographicHandoff()` requires
`walkable=1` on all `roads[].cells`. **26** land roads contain water-crossing cells whose exact
IDs and counts are reported in `roadsWithWaterCells`. v3 deliberately does **not** fake
walkability there; adopting a water-traversal rule is a GAMEPLAY-owned decision
(`DR-V3-06`). Map does **not** claim `validateEconomyMap()` / `validateGeographicHandoff()`
PASS; `gameplayValidators` are all `NOT_EXECUTED`.

---

## 6. P0-04 — Construction semantics

**Defect (proven):** `v2/src/intake_v2.mjs:173` set `economy.buildable` to only the dry subsets
of the 23 surveyed envelopes (**1242** cells), implicitly restricting sandbox construction to
those zones — contrary to Bible §11.5.4 "many buildable player-chosen positions".

**Correction:** three explicitly distinct concepts.

| Concept | Count | Status / owner |
| --- | --- | --- |
| `suggestedSites` | **23** | `SURVEYED_SUGGESTION` / MAP — a suggestion, never a permission or restriction |
| `physicallyPossibleFootprints` | **21** components / **7035** cells | `VERIFIED_GEOMETRY` / MAP — full-world connected dry-land components ≥9 cells |
| `legalPlacement` | — | `UNKNOWN` / GAMEPLAY — claims, occupancy, cost, body clearance, build rules |

Suitability is derived from v3 terrain (height class, slope, neighbourhood relief), dry land,
`protectedGeometryCandidate`, `coast` and `clearanceCells`. **6481** physically possible cells
lie outside any surveyed zone (`zoneId=0`), proving sandbox construction is not restricted to
the 23 zones. All 23 surveyed envelopes were reconciled with measured mean suitability,
physically-possible cell count, protected overlap, cliff overlap and water overlap; all 23
carry a `SURVEY_CONFLICT__REPORTED_NOT_SILENTLY_FIXED` because each contains ≥1 protected
geometry cell (WMP-02's survey did not screen protected geometry). No envelope was shrunk,
moved or granted.

`economy.cargoPassable` is **all zero** in v3: WMP-02's **8777** ASSUMED_PROFILE screening
cells are not an approved cart-passability verdict, and must not appear authoritative in a
typed Gameplay-facing field (`fieldSemantics` documents the override).

---

## 7. Bounded structural checks (read-only)

| Check | Measured | Action taken |
| --- | --- | --- |
| POI road entrances | 81 assessed; **55** have a source `EXTERIOR_ENTRANCE` and **all 55** have road frontage ≤40 au; **26** have no exterior entrance in source | 26 exact IDs reported (`po_hall_eyes`, `po_typhon`, `po_viaduct`, `po_freightyard`, `po_fracquarry`, `po_pumphouse`, `po_glade`, `po_sapgrove`, `po_elderwood`, `po_mere`, …). **Zero** canonical POI relocations, **zero** distant-access redesigns |
| Overlapping host/subsite envelopes | **18** of 23 surveyed sites overlap a POI ground level or Elder outer territory; 81 POI + 6 Elder host envelopes tested | Exact site IDs, host IDs and overlap cell counts reported. **Zero** automatic resolutions, **zero** canonical geometry changes |
| Roof-boundary semantics | **153** roofs classified: **99** `COINCIDENT_WITH_PARENT_ROOM_BOUNDARY`, **54** inside/on-boundary, **0** vertices truly outside | WMP-02's 99 "vertices outside parent room" flags were boundary coincidence, not overflow. **Zero** automatic shrinks in v3, **zero** canonical polygon changes; v2's 99 historical insets are preserved but not re-applied |

These are **bounded read-only assessments**. No POI was redesigned, no roof was auto-shrunk
and no Gameplay rule was changed.

---

## 8. Typed Map→Gameplay interface & independent negative fixtures

`v3/interfaces/map_physical_semantics.v3.json` declares 15 typed fields, each with
`provenance`, `status`, `owner`, `unit` and an explicit `noAuthorityClaim`. Vocabulary:
`UNKNOWN / PROPOSED / VERIFIED / UNRESOLVED / BLOCKED / SOURCE_AUTHORED`. It preserves the
`EconomyMap` 13-array shape and the `GeographicHandoff` field shape while adding
`ferryRoutes`, `bridgeDeckProposals`, `fordProposals`, `traversalGraphRef`,
`physicallyPossibleFootprints`, `suggestedSites`, `legalPlacement`, `approvedTraversal`,
`fieldSemantics` and `unresolvedGameplayOwned`. `unapprovedValuesAreNotAuthoritative=true`.

`v3/src/lib_v3.mjs` exports the **same pure production classifiers** used by
`build_v3.mjs`. `run_v3.mjs` calls them on **independent synthetic source inputs**; no
fixture merely documents a blocker. 17 fixtures, 17 covered defect IDs:

| Fixture | Independent input | Proven result |
| --- | --- | --- |
| T-NEG-01 | perfectly flat world (slope=0, elevation=40) | 0 cliffs, heightClass ≤1 |
| T-NEG-02 | every slope byte +51 (same terrain, different labels) | WMP-01 `>200` flips from 0 to >0 cliffs; v3 rasters **bit-identical** |
| T-NEG-03 | one isolated slope=255 cell | not a cliff (connectivity guard) |
| T-NEG-04 | unitPolicy JSON | no asserted metres/degrees/climb law |
| R-NEG-01 | synthetic diagonal (4,4)→(500,500) | legacy drift >40 au (L-shape), corrected ≤5.7 au |
| R-NEG-02 | synthetic L polyline | 4-connected, endpoints preserved, ≤5.7 au |
| R-NEG-03 | synthetic reverse diagonal | 4-connected, ≤5.7 au |
| W-NEG-01 | synthetic 20 water cells + ferry/bridge/ford | ferry class=2, `landWalkable=false`, 0 permissions |
| W-NEG-02 | same grid | bridge=3, ford=4, both PROPOSED with 0 permissions |
| W-NEG-03 | real v2 ferry cells | v2=219 walkable, v3=0 |
| C-NEG-01 | synthetic 20×20 dry patch with `zoneId=0` | ≥1 full-world footprint, every cell outside surveyed zones |
| C-NEG-02 | one protected geometry cell | suitability 0 |
| C-NEG-03 | one forced cliff cell | suitability 0 |
| S-NEG-01 | structural report vs `architecture.pois[]` | 0 canonical redesigns |
| S-NEG-02 | v2 99 insets vs v3 semantics | 0 new auto-shrinks, 99 boundary-coincident |
| I-NEG-01 | interface + handoff | `cargoPassable` all 0, 0 approved cells, validators NOT_EXECUTED |
| I-NEG-02 | 3 v3 rasters + graph | surface >0, edges >0, **0** active permissions |

---

## 9. Remaining owners (exact IDs, NOT Map-claimed)

| ID | Subject | Owner | Status |
| --- | --- | --- | --- |
| DR-06 | ferry/boat rule for 8 authored ferry routes | GAMEPLAY | BLOCKED |
| DR-V3-01 | bridge-deck proposal activation / collision permission | GAMEPLAY | UNKNOWN |
| DR-V3-02 | ford depth/flow/permission rule | GAMEPLAY | UNKNOWN |
| DR-V3-03 | physical units for elevation/slope (metres/degrees) | MAP+GAMEPLAY | UNRESOLVED |
| DR-V3-04 | legal build placement / claims / occupancy | GAMEPLAY | UNKNOWN |
| DR-V3-05 | roof-boundary canopy vs full-roof semantics | MAP+GAMEPLAY | PROPOSED |
| DR-V3-06 | Gameplay validator acceptance of 26 water-crossing road IDs | GAMEPLAY | UNRESOLVED |
| DR-V3-07 | cart / loaded-cart swept clearance and trailer sweep | MAP+GAMEPLAY | UNKNOWN |
| DR-V3-08 | runtime ingestion, independent CI, visual acceptance | GAMEPLAY | UNRESOLVED |
| DR-V3-09 | numeric climate/weather/damage/season rates | GAMEPLAY | UNKNOWN |
| DR-V3-10 | Veyra production road/cliff/bridge/construction tilesets | CREATOR | NOT_STARTED |

WMP-02 dependencies `DR-01..DR-15` and `DR-V2-01..09` remain in force. `seed=0` remains an
unresolved placeholder; normalized environment rasters are dimensionless PROPOSED potentials,
not rates; `powerNodes/hazardCells/lootSites` remain empty; `mapStructuralSelfCheckV3()
errors=0` is a **Map-owned structural check**, not a Gameplay validator PASS.

---

## 10. Non-claims

No production tileset, no new POI, no canonical POI relocation, no automatic roof shrink, no
Gameplay runtime modification, no numeric Gameplay balance rate, no invented physical units,
no approved ferry/boat/bridge/ford/cart/collision rule, no legal placement grant, no
independent CI, no visual or creator acceptance, no `WORLD_MASTER_SEALED`, no
`VEYRA_PLAYABLE`, no `VISUAL_ACCEPTED`, no `MERGE_READY`, no exact-head combined product
status. PR44 remains OPEN / DRAFT / HOLD / NO MERGE.

**Next owner:** Gameplay / Control Tower review of the four corrections, the typed interface
and the 11 unresolved IDs above; Creator decision before any production tileset.
