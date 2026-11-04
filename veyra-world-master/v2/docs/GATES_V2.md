# WMP-02 / MAP-LR03R TEST GATES (auto-generated)

Command: `node v2/src/run_v2.mjs (via ./reproduce_v2.sh)`
v1 manifest SHA: `327bf48c05c92d9ce0ee3ddf1281aca9ce2a47dcf47ede81dc524f80e86e313e`  
v2 revisionDigest: `872502373e783b190f94a3c86065d6b3fd8c08d010b2ecc4130623f4283a682d`  
v2 manifest SHA: `6954e17a6fa46da2123e9bffa4faeb65f0cbc87be6def9483e43aa012be94009`

Result: **47/47 PASS**, 0 FAIL. Physical=29, negative fixtures=11, coverage/integrity=7.

DOCUMENTATION/COVERAGE PASS is NOT physical-completion PASS. v1 M-G3/M-G4 documentation PASSes are audited in `v2/layers/preflight_audit.v2.json`.

| Gate | PASS | FAIL |
|---|---|---|
| PV | 5 | 0 |
| V | 11 | 0 |
| T | 9 | 0 |
| B | 5 | 0 |
| R | 3 | 0 |
| E | 4 | 0 |
| H | 9 | 0 |
| TV | 1 | 0 |

| ID | Kind | Name | Verdict |
|---|---|---|---|
| PV-01 | INTEGRITY | v1 manifest SHA and all v1 compiler bytes are unchanged | PASS |
| PV-02 | INTEGRITY | v2 manifest pins v1 parent and every v2 component SHA | PASS |
| PV-03 | INTEGRITY | v2 build is deterministic (no wallclock, reproducible revisionDigest) | PASS |
| PV-04 | COVERAGE | M-G3/M-G4 audit separates DOCUMENTATION_PASS from physical checks | PASS |
| PV-05 | INTEGRITY | v1 regression suite is still 75/75 reproducible (documented, not re-executed here) | PASS |
| V-ARCHIVE | PHYSICAL | portal.po_archive.vertical: corrected shaft is collision-free and bidirectionally traversable | PASS |
| V-MERIDIAN | PHYSICAL | portal.po_meridian.vertical: corrected shaft is collision-free and bidirectionally traversable | PASS |
| V-OLDPUMP | PHYSICAL | portal.po_oldpump.vertical: corrected shaft is collision-free and bidirectionally traversable | PASS |
| V-IRONVEIN | PHYSICAL | portal.po_ironvein.vertical: corrected shaft is collision-free and bidirectionally traversable | PASS |
| V-TOMBS | PHYSICAL | portal.po_tombs.vertical: corrected shaft is collision-free and bidirectionally traversable | PASS |
| V-SULFUR | PHYSICAL | portal.po_sulfur.vertical: corrected shaft is collision-free and bidirectionally traversable | PASS |
| V-GEO | PHYSICAL | portal.po_geo.vertical: corrected shaft is collision-free and bidirectionally traversable | PASS |
| V-IRONMINE | PHYSICAL | portal.po_ironmine.vertical: corrected shaft is collision-free and bidirectionally traversable | PASS |
| V-NEG-01 | NEGATIVE_FIXTURE | Canonical portal shaft is REJECTED (outside ground room) for all 8 exact IDs | PASS |
| V-NEG-02 | NEGATIVE_FIXTURE | Shaft outside both room polygons is REJECTED | PASS |
| V-NEG-03 | NEGATIVE_FIXTURE | po_meridian narrow shaft is NOT promoted to VERIFIED | PASS |
| T-01 | PHYSICAL | 12 bridges have measured deck polygons derived from wet chord + dry bearing cells | PASS |
| T-02 | PHYSICAL | Bridge connector role verified WITH deck vs WITHOUT deck (5 exact IDs) | PASS |
| T-03 | PHYSICAL | Remaining blocked bridges are reported with exact IDs, not silently dropped | PASS |
| T-04 | PHYSICAL | 3 FALSE_DISCONNECT roads reclassified with measured coincident endpoints | PASS |
| T-05 | PHYSICAL | 4 real road splits have measured 4-connected DRY-LAND connectors (no water cells) | PASS |
| T-06 | PHYSICAL | 11 crossing contradictions have measured geometry, all cartPassability UNRESOLVED | PASS |
| T-07 | PHYSICAL | Outlet gap has exact river ID rv_grey_low and measured channel to nearest SEA cell | PASS |
| T-NEG-01 | NEGATIVE_FIXTURE | No cartPassable=true / approved swept clearance in any v2 transport layer | PASS |
| T-NEG-02 | NEGATIVE_FIXTURE | No bridge/road/river was added to the canonical authored collections | PASS |
| B-01 | PHYSICAL | All 23 envelopes reconcile EXACTLY with LR02 under identical criterion | PASS |
| B-02 | PHYSICAL | LR02 9 overlaps vs LR03 v1 12: 3 exact false-positive IDs identified | PASS |
| B-03 | PHYSICAL | Every dry subset is a single 4-connected component with >=8 cells | PASS |
| B-04 | NEGATIVE_FIXTURE | No authored water cell appears in any dry subset | PASS |
| B-05 | PHYSICAL | 3 home candidates are dry, independently selectable and road-reachable | PASS |
| R-01 | PHYSICAL | All 153 roof polygons assessed; 99 defective roofs have a corrected source-room inset | PASS |
| R-02 | NEGATIVE_FIXTURE | Original v1 roof polygon with vertices outside parent room is REJECTED | PASS |
| R-03 | COVERAGE | No roof is labelled completed / runtime canopy / creator-approved sprite | PASS |
| E-01 | PHYSICAL | 11 normalized u8 rasters are length 43750 and reproducible from declared formula | PASS |
| E-02 | PHYSICAL | 12 climate regions have reproducible dry-land spatial evidence summing to all land cells | PASS |
| E-03 | NEGATIVE_FIXTURE | No official numeric temperature/weather/damage/crop/season rate is present | PASS |
| E-04 | PHYSICAL | moisture/temperature normalized potentials are within [0,1] for EconomyMap | PASS |
| H-01 | PHYSICAL | Map-side structural self-check has 0 errors and Gameplay checks are NOT executed | PASS |
| H-02 | PHYSICAL | All 13 EconomyMap arrays are length 43750 and binary masks strictly 0/1 | PASS |
| H-03 | PHYSICAL | 14 unsupported Gameplay-owned fields are explicitly UNRESOLVED (no fake fallback) | PASS |
| H-04 | PHYSICAL | 92 roads: cargoPassable=false, 4-connected cells, road mask covers all cells | PASS |
| H-05 | PHYSICAL | 81 POIs: entrances/rooms subset of footprint, valid retreat paths | PASS |
| H-06 | PHYSICAL | 3 windows × 18 masks: zero duplicate global tiles, full coverage, stable chunk IDs | PASS |
| H-07 | NEGATIVE_FIXTURE | v1 five-mask projectWindow is NOT accepted as a complete EconomyMap | PASS |
| H-NEG-01 | NEGATIVE_FIXTURE | Corrupted economy (moisture=2) is REJECTED by structural self-check | PASS |
| H-NEG-02 | NEGATIVE_FIXTURE | Duplicate start id is REJECTED by structural self-check | PASS |
| TV-01 | COVERAGE | 8 v2 technical views exist, are valid PNGs, and are labelled NOT Web proof | PASS |

Gameplay-owned `compileEconomy()`, `diagnoseStarts()` and the full `validateGeographicHandoff()` are NOT executed. Web runtime is NOT modified.
