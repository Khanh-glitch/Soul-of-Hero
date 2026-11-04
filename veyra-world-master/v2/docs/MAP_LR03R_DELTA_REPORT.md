# MAP-LR03R / WMP-02 — ONE CONSOLIDATED CORRECTIVE DELTA REPORT

**Status: `CORRECTED_PHYSICAL_WORLD_MASTER_CANDIDATE__NOT_SEALED`.**
**PR #44 remains OPEN / DRAFT / HOLD / NO MERGE.** No other-owner branch, `main`,
GOLD, PR #44 head branch or Web runtime was modified. No Gameplay law was invented.

This is a **corrective round on top of WMP-01**, not a rebuild. WMP-01
(`MAP_MASTER_CANDIDATE_PARTIAL_BLOCKED`, `HOLD_INTEGRATION`) is preserved byte-for-byte.
All WMP-01 digests are unchanged: `manifest.v1.json`
`327bf48c05c92d9ce0ee3ddf1281aca9ce2a47dcf47ede81dc524f80e86e313e`,
`revisionDigest` `8e3e76da5b7f8db35c66322b0236ef37599b4d2dfbe381ea7b2e5ae176d38e4f`,
`data/source_manifest.v1.json` `c1f0b7a8664656842d97df95a63ee93a258268b6856ac579f27c1908a072cc4d`.
`evidence/artifact_index.v1.json` and every other v1 file were deliberately **not**
regenerated; all v2 source lives under `v2/`.

Per-defect before/after register: `v2/layers/corrective_register.v2.json`.
Per-defect classification vocabulary: `VERIFIED_GEOMETRY` (real spatial check
passed), `PROPOSED_GEOMETRY` (measured non-canonical candidate), `BLOCKED`
(exact ID/reason retained). Documentation improvement is **never** a PASS.

---

## 1. Eight vertical blockers — resolved

Original canonical portals are **UNCHANGED** (exact source `atAu`, `portalId`,
ground room and DEEP level preserved verbatim in
`v2/layers/vertical_corrections.v2.json`). A separate `vlink.corrected.<poi>.v2`
candidate was derived by a 0.5 au grid search over the measured ground/DEEP polygon
overlap, maximising shaft half-size subject to polygon-edge distance (diagonal
corner bound) and M1 clipped-static-solid clearance. Each candidate carries:
shaft polygon, stair run, ground + DEEP boundary openings, 4 BFS legs (ground→shaft,
shaft→ground, shaft→DEEP, DEEP→shaft) on a 2 au grid avoiding static solids,
entrance→shaft and shaft→DEEP LOS, and explicit negative counterexamples.

| Exact portal ID | Previous failure | Corrected `atAu` | Half-size | Verdict |
|---|---|---|---|---|
| `portal.po_archive.vertical` | canonical `[1022.5,229]` outside ground room | `[1011.9131,231.6544]` | 2.3698 au | **VERIFIED_GEOMETRY** |
| `portal.po_meridian.vertical` | canonical `[1123.6,692.4]` outside ground room | `[1125.4286,686.7829]` | 0.9731 au | **PROPOSED_GEOMETRY__NARROW_SHAFT_BELOW_2AU** |
| `portal.po_oldpump.vertical` | canonical `[854.5,988]` outside ground room | `[855.0529,980.7414]` | 1.1910 au | **VERIFIED_GEOMETRY** |
| `portal.po_ironvein.vertical` | canonical `[1208.9,657.6]` outside ground room | `[1200.7064,655.2097]` | 2.0266 au | **VERIFIED_GEOMETRY** |
| `portal.po_tombs.vertical` | canonical `[523.3,1088.2]` outside ground room | `[515.9729,1090.4402]` | 1.6894 au | **VERIFIED_GEOMETRY** |
| `portal.po_sulfur.vertical` | canonical `[1771.9,884.6]` outside ground room | `[1764.5502,878.976]` | 1.9574 au | **VERIFIED_GEOMETRY** |
| `portal.po_geo.vertical` | canonical `[1739.3,918.2]` outside ground room | `[1734.1327,922.7637]` | 2.1076 au | **VERIFIED_GEOMETRY** |
| `portal.po_ironmine.vertical` | canonical `[1189.9,1292.6]` outside ground room | `[1181.0319,1292.4378]` | 1.9531 au | **VERIFIED_GEOMETRY** |

**7 of 8 VERIFIED_GEOMETRY, 1 PROPOSED (narrow), 0 left fully BLOCKED.**
`verticalSeparationAu` remains `null` / `UNRESOLVED` everywhere. `po_meridian` is NOT
promoted: its measured overlap admits only a sub-2 au shaft and no Gameplay body
envelope is approved. Negative fixtures `V-NEG-01/02/03` reject the canonical shaft,
an outside shaft, and a narrow shaft masquerading as VERIFIED. No canonical portal
was secretly moved.

## 2. Bridges / roads / water contradictions — resolved with exact remaining IDs

**12 bridges** — every `deckStatus=UNRESOLVED` / `deckPolygonAu=null` replaced by a
measured non-canonical deck in `v2/layers/transport_corrections.v2.json`. Span reaches
the first dry bearing cell beyond the measured wet chord along the authored bridge
axis; width = `min(24 au, measured lateral dry land)`. Connectivity is a real 4-connected
BFS over GEO-01 dry land **WITH** the proposed deck cells vs **WITHOUT** them.

- **5 VERIFIED dry-land connectors:** `br_0`, `br_1`, `br_2`, `br_6`, `br_8`.
- **5 PROPOSED (endpoints already connected on land):** `br_3`, `br_4`, `br_7`, `br_9`, `br_a`.
- **2 still BLOCKED, exact IDs:** `br_5` (no dry-land connection at either bearing point),
  `br_b` (88 au wet chord across a lake; 184 au proposed span, still no dry connection).
- All 12 `bodySweep` verdicts remain `UNKNOWN` under the three clearly labelled
  `ASSUMPTION_PROFILE` widths 2 / 8 / 16 au; **no `cartPassable=true`**.

**7 disconnected roads → 3 false + 4 real.**

- `rd_22`, `rd_25`, `rd_28`: `VERIFIED_GEOMETRY__COINCIDENT_ENDPOINT_NO_NEW_ROAD_REQUIRED`
  (measured endpoint distance = 0). These were graph-topology artefacts, not missing
  geometry. **No road invented.**
- `rd_w`, `rd_1n`, `rd_1p`, `rd_2a`: measured 4-connected **dry-land BFS** connectors
  (16 / 16 / 16 / 80 au), all cells `waterClass=0`, `landId>0`, with per-profile
  geometric clearance and `sweptClearance=UNKNOWN`. Negative fixture asserts no water
  cell in any connector.

**11 crossing contradictions** — all now carry measured contiguous-freshwater chord
width perpendicular to the authored road centreline, source stroke width, and an
explicit geometry candidate:

- 7 measured deck candidates: `CC-BR4-01`, `CC-rd_v-rv_moss`, `CC-rd_1k-rv_east`,
  `CC-rd_1y-rv_grey_up`, `CC-rd_20-rv_silver`, `CC-rd_28-rv_d3`, `CC-rd_29-rv_grey_up`.
- 4 measured ford candidates (`depth=UNKNOWN`, `fordable=UNKNOWN`):
  `CC-rd_x-rv_ash`, `CC-rd_1f-rv_amber_up`, `CC-rd_1l-rv_amber_up`, `CC-rd_2a-rv_argus`.
- Every one keeps `cartPassability.status=UNRESOLVED` and `value=false`.

**River outlet gap** — exact ID `rv_grey_low` (`mouth.kind="none"`), authored terminal
vertex `[990,858]`, nearest authored SEA cell `[988,900]` (cell 28123), measured gap
`42.0476 au`. `outlet.rv_grey_low.v2` is a **PROPOSED measured channel**, not a
canonized river; `mouth.kind="none"` is preserved. Navigability/flood rule stays
Gameplay-owned.

**Remaining exact IDs in this group:** `br_5`, `br_b` (geometry cannot connect dry
land without an approved deck/vehicle rule); all 12 decks and 11 crossings remain
`UNRESOLVED` for cart passability, swept clearance, turning radius, ford depth/flow,
deck bearing. Authoring stroke width is still an EDITOR value, not a physical channel
width.

## 3. Dry build-envelope results vs LR02

All **23** envelopes were recomputed with the **exact LR02 M2 criterion**
(`gx0=floor(x0/8)`, `gx1=ceil(x1/8)`, `gy0=floor(y0/8)`, `gy1=ceil(y1/8)`, cell
centre clipped to the authored bbox). The v1 defect was `floor()` instead of `ceil()`
for the upper bbox cell range AND no centre clipping, so sea cells **outside** the
authored envelope were counted as water overlap.

| Criterion | Water-overlap sites |
|---|---|
| LR02 (`spawn_eligibility.v1.json`) | **9** |
| WMP-01 v1 (`build_habitat_endgame.v1.json`) | **12** (over-count) |
| WMP-02 recomputed, identical criterion | **9** — **23/23 exact matches** with LR02 |

**3 exact v1 false-positive IDs eliminated:** `site.bz_silver`, `site.bz_dune`,
`site.bz_cinder`. The 9 genuine water-overlap IDs are preserved exactly:
`site.bz_greywater`, `site.bz_hook`, `site.bz_eastflats`, `site.bz_oasis`,
`site.bz_moss`, `site.bz_verdant`, `site.bz_salt`, `site.bz_slag`, `site.bz_ironholm`.

For every site the **largest 4-connected dry component** is extracted and verified
(B-03): all 23 have ≥8 connected dry cells; 23/23 usable dry subsets. Water cells are
excluded by a negative fixture (B-04). Three independently selectable player-home
geometry candidates are supplied (`wmp.v2.home.1/2/3` at
`site.bz_greywater`, `site.bz_gulfwest`, `site.bz_westmouth`), each dry, inside its
connected subset and within 200 au of an authored dry road cell. Loading approaches
are explicit `PROPOSED_ASSUMED_CARGO_PROFILE_LOADING_CANDIDATES` with
`sweptClearance=UNKNOWN`. No placement grant, house, claim legality or swept vehicle
clearance is asserted.

## 4. Climate / soil improvements

`v2/layers/environment.v2.json` + 11 reproducible `u8` rasters in `v2/rasters/`:
`elevationNorm`, `slopeNorm`, `waterProximityNorm`, `canopyNorm`, `exposureNorm`,
`substrateNorm`, `drainageNorm`, `moisturePotentialNorm`, `temperaturePotentialNorm`,
`soilSuitabilityNorm`, `climateSuitabilityNorm`. Every formula is an explicit weighted
combination of authored inputs (raw elevation byte, slope byte, 12-source biome
subtype, freshwater/sea distance, canopy, drainage, substrate, soil moisture, sun /
frost / thermal ordinals, exposure). `E-01` re-derives sampled cells from the declared
formula. `E-02` verifies 12 climate-region evidence rows computed on **dry land only**
sum to all `14392` dry-land cells.

These are **dimensionless NORMALIZED PROPOSED GEOGRAPHIC POTENTIALS** for spatial
comparison and `EconomyMap` structural completeness. They are **not** numeric
temperature, weather, damage, crop-yield or seasonal rates; `E-03` is a negative
fixture asserting no such rate field exists. `ENV-U01..U05` are explicitly
`UNKNOWN` / `UNRESOLVED`, owned by Gameplay / Map+Gameplay. No physical unit (metres,
degrees, °C) was invented.

## 5. Architecture (153 roofs) and consumer-interface completeness

**Roofs:** all **153** proposed roof polygons were assessed for polygon-inside-parent-
room (not bbox), coverage ratio, interior static-wall crossings, authored openings
within 24 au and clear LOS from an authored opening. Result: **54 VERIFIED meaningful
coverage**, **99 with named defects** (`ROOF_VERTICES_OUTSIDE_PARENT_ROOM` 99,
`INTERIOR_WALL_CROSSING_2` 7, `NO_AUTHORED_OPENING_WITHIN_24AU` 6). Source polygon
clipping was therefore **not** automatic roof completion. All 99 defective roofs
received a measured corrected candidate: the largest source-room inset whose vertices
are strictly inside the parent room and whose interior excludes every static-wall
midpoint (`R-01` re-verifies all 99). 147 roofs have clear LOS from an authored
opening. No roof is labelled completed, runtime canopy or creator-approved art.

**Consumer interface:** `v2/handoff/geographic_handoff.v2.json` supplies every
`EconomyMap` field and every `GeographicHandoff` field. `v2/src/intake_v2.mjs`
`mapStructuralSelfCheck()` is a deterministic JS port of the structural parts only:
**0 errors** (`H-01`). `compileEconomy()`, `diagnoseStarts()` and the full
`validateGeographicHandoff()` are **NOT executed** (Gameplay-owned); Web runtime was
not modified. 14 unsupported Gameplay-owned fields are explicitly `UNRESOLVED`,
including `seed=0` as a declared placeholder, empty loot/power/hazard arrays and
`cargoPassable=false` on all 92 roads.

`projectWindowV2()` emits **3 windows × 18 masks** including all 13 `EconomyMap`
fields. West (`gx 0..124`) and east (`gx 125..249`) are disjoint:
**0 duplicate global tiles**, union `43750/43750` cells, `0` out-of-frame tiles,
70 chunk `stableIdDigest` values matched, `0` duplicate/missing feature IDs,
10 vertical chunk-boundary neighbour declarations checked. `H-07` proves the v1
5-mask projection is not a complete `EconomyMap`.

## 6. Independent tests / new negative fixtures / clean-room

| Command | Result |
|---|---|
| `/tmp/wmp_preflight_verify && ./reproduce.sh` | WMP-01 **75/75**, clean-room 75/75, `revisionDigest=8e3e76da…`, source tree clean |
| `./reproduce_v2.sh` | `WMP_V2_REPRODUCE_OK`, build ×2 deterministic `revisionDigest=872502373e…` |
| `node tests/run.mjs` (isolated clean room only) | WMP-01 **75/75** — v1 bytes untouched |
| `node v2/src/run_v2.mjs` | **WMP_V2_TESTS 47/47**, 0 FAIL |
| `./clean-room_v2.sh` | isolated WMP-01 75/75 + WMP-02 47/47, equal `revisionDigest`, equal handoff SHA, equal test-results SHA; no external canonical source, no legacy lab, no network |
| `node v2/src/artifact_index_v2.mjs` | supplementary index pins every v2 file |

The v2 suite is **29 PHYSICAL + 11 NEGATIVE_FIXTURE + 7 COVERAGE/INTEGRITY** checks,
not count inflation: the v1 75 count is preserved and the v2 suite is separate and
kind-labelled. **18 new negative-fixture records across 11 NEGATIVE_FIXTURE tests** in
`v2/evidence/tests/negative_fixtures_v2.json`: canonical vertical shaft rejected (×8
exact portal IDs), outside shaft rejected, narrow shaft not promoted, no invented
cart approval, canonical 12/92/17 counts unchanged, no water/sea cell in dry subsets,
v1 roof outside parent room rejected (99 such roofs), no invented climate rate, v1
5-mask window rejected as complete `EconomyMap`, corrupted `moisture=2` rejected,
duplicate start id rejected.

**Technical images inspected** (8 deterministic pure-Node PNGs, all classified
`TECHNICAL_VIEW__NOT_WEB_RUNTIME_PROOF__NOT_CREATOR_APPROVED_ART`):
`v2_vertical_before_after.png`, `v2_bridge_decks_full.png`, `v2_build_envelopes.png`,
`v2_env_moisture.png`, `v2_env_temperature.png`, `v2_env_soil.png`,
`v2_windows_adjacent.png`, `v2_roof_corrections.png`. The 15 WMP-01 analytical
views and 6 byte-preserved real Web PNGs are unchanged. No analytical preview is
labelled playable Web or creator-approved art.

## 7. Remaining decisions STRICTLY requiring Gameplay / Creator

Machine-readable: `v2/layers/decision_register.v2.json`.

- **Carried WMP-01 decisions DR-01..DR-15** — approved au→tile scale, elevation/
  slope units, numeric climate rates, cart/vehicle footprints & swept clearance,
  bridge/ferry rules, runtime ingestion, stock/custody/economy/escrow/save/offline,
  live AI, spawn/home runtime legality, visual/creator approval, DR-15 Recycler
  placement (declined). None overturned.
- **DR-V2-01** adopt any of the 8 corrected vertical candidates vs preserve canonical
  portals — `GAMEPLAY+CREATOR`, `UNDECIDED`.
- **DR-V2-02** numeric vertical separation / stair pitch / ladder collision — `UNRESOLVED`.
- **DR-V2-03** adopt 12 proposed decks as canonical geometry — `CREATOR+MAP`, `PROPOSED`.
- **DR-V2-04** approved player/cart/loaded-cart footprints and swept clearance — `GAMEPLAY`, `UNKNOWN`.
- **DR-V2-05** ford depth/flow and ferry/boat mechanic — `GAMEPLAY`, `BLOCKED`.
- **DR-V2-06** `outlet.rv_grey_low.v2` as authored river — `CREATOR+MAP`, `PROPOSED`.
- **DR-V2-07** normalized climate potentials vs official numeric rates — `GAMEPLAY`, `PROPOSED`.
- **DR-V2-08** `cargoPassable` / starts / stock / loot / escrow runtime semantics — `GAMEPLAY`, `UNKNOWN`.
- **DR-V2-09** creator visual approval and native 640×360 human legibility — `CREATOR`, `UNKNOWN`.
- Exact still-blocked geometry IDs: `br_5`, `br_b`; `portal.po_meridian.vertical`
  (narrow PROPOSED candidate only); all 12 decks + 11 crossings for cart/swept
  approval; 99 roof corrected insets remain `PROPOSED`, not completed buildings.
- No independent exact-head CI, no Gameplay runtime ingestion, no balanced-start
  verdict, no clean Workbench visual acceptance, no continuous playable Veyra,
  no `WORLD_MASTER_SEALED`, `VEYRA_PLAYABLE`, `VISUAL_ACCEPTED` or `MERGE_READY`.

**Next-action owner:** Gameplay / Creator (adoption decisions DR-V2-01..09, runtime
ingestion, numeric laws, visual approval). Map has exhausted all independently
resolvable physical tasks; **no further Map work is started without a new signal.**

## 8. Exact commits / manifest hashes / images / next-action owner

| Artifact | Exact value |
|---|---|
| Parent WMP-01 Map commit | `d0221688076f823b5e15fe9c1050406928eafbca` |
| WMP-02 package commit | `caf6429506bc675d8347e731f3c04b2a71aaa8a8` (all WMP-02 code, layers, handoff, windows, views, tests, docs) |
| Final metadata/reference commit | the follow-up commit that inserts this SHA; its exact SHA is in `v2/docs/COMMIT_REFERENCE.md` and the one PR #44 corrective comment |
| Branch | `arena/2e3cfbd2-soul-of-hero` (only branch touched) |
| `manifest.v1.json` SHA-256 | `327bf48c05c92d9ce0ee3ddf1281aca9ce2a47dcf47ede81dc524f80e86e313e` |
| v1 `revisionDigest` | `8e3e76da5b7f8db35c66322b0236ef37599b4d2dfbe381ea7b2e5ae176d38e4f` |
| `v2/manifest.v2.json` SHA-256 | `6954e17a6fa46da2123e9bffa4faeb65f0cbc87be6def9483e43aa012be94009` |
| v2 `revisionDigest` | `872502373e783b190f94a3c86065d6b3fd8c08d010b2ecc4130623f4283a682d` |
| `v2/layers/*.v2.json` | 8 layers; `v2/rasters/*.u8` 11 rasters; all SHA-pinned inside `v2/manifest.v2.json` |
| `v2/handoff/geographic_handoff.v2.json` SHA | `82d8b061ab60b5feab29c6a1cfd579ad9e6428bc9c371983061681a381fe0f8c` |
| `v2/handoff/handoff_check.v2.json` SHA | `f94082b92fc88faab08ff04ee5d62b9a2e198c2ad637b109b8fe105cbc5dda50` |
| `v2/evidence/windows/window_report.v2.json` SHA | `39f63fd69231161a52c8c12e95b31cf16986df4f7c0ce4e5f89cc5379ff6f0a9` |
| `v2/evidence/tests/results_v2.json` SHA | `408f0ca258466280a3305ec8857200103cc36cf1dc7fad205fdc62c94783a865` |
| `v2/evidence/tests/negative_fixtures_v2.json` SHA | `7c9cd291b50f3f66fdb95fde2cd7710bc1d278bd18434f0462cfd4d1577565a3` |
| `v2/evidence/views/index_v2.json` SHA | `ae17cc96cd6b5dcef447b24493fa93e8373b1a9866927e8c988bd9616e91b903` |
| `v2/evidence/artifact_index.v2.json` | self-excluding index of 100 supplementary v2 files (incl. this report); its own final SHA is reported in the PR #44 corrective comment and `v2/docs/COMMIT_REFERENCE.md` |
| Technical images | 8 PNGs with exact SHA-256 in `v2/evidence/views/index_v2.json` |
| PR #44 | OPEN / DRAFT, base `arena/4795760e-soul-of-hero`, head branch `arena/d4bfcfff-soul-of-hero`; head `8206869f627128e700c64a41f8c9ee29912aee84` at contract inspection, **`d73aa63f9f7f98aa1f6c6a42211693c7710cf3c4` at WMP-02 push** |
| WMP-01 PR comment (not duplicated) | `6624249473` |
| Gameplay/CT comments since WMP-01 | `6624475878` (M-CORE-03S), `6624745510` (CT verdict, no Map task, no merge), `6625624576` (M-CORE-03T PARTIAL / HOLD, no Map request) |
| Concurrent Gameplay commit at push | `d73aa63f` — evidence/docs only; **no** `world-economy.ts` / `geography-contract.ts` / `web/src/game` change, so the read-only intake contract inspection stays valid |
| One WMP-02 corrective comment | posted once after push, with the exact final commit + manifest SHAs |
| **Next-action owner** | **Gameplay / Creator** — decisions DR-V2-01..09, runtime ingestion, numeric laws, visual acceptance. Map is on HOLD. |
