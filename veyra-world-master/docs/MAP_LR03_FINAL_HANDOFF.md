# MAP-LR03 / WMP-01 — one final PR #44 handoff (copy-ready)

> This file is the copy-ready handoff. The **authoritative exact-SHA version is the single
> PR #44 comment** posted at the end of this run; that comment contains the final commit
> SHA, which cannot be embedded inside the commit itself without a circular dependency.
> No intermediate PR #44 comments were posted for LR03.

## STATUS

`MAP_MASTER_CANDIDATE_PARTIAL_BLOCKED`

Self-contained physical world master candidate delivered. Product gate remains
`HOLD_INTEGRATION` / PR #44 `OPEN / DRAFT / NO MERGE`. No `WORLD_MASTER_SEALED`,
`VEYRA_PLAYABLE`, `VISUAL_ACCEPTED` or `MERGE_READY` claim.

## 1. Exact SHAs and refs

| Item | Value |
|---|---|
| Map branch | `arena/2e3cfbd2-soul-of-hero` (only branch touched) |
| Start HEAD | `7342972cd84cd6de3aaea7ed938666a2d376bdfd` (clean) |
| End HEAD / remote SHA | **see the single final PR #44 comment** (exact, non-circular) |
| Observed Gameplay HEAD | `d1c56a45eb29dccb9ea376cc5490c7e422e9e8bf` (`arena/d4bfcfff-soul-of-hero`) |
| PR #44 | OPEN / DRAFT, head `d1c56a45…`, base `arena/4795760e-soul-of-hero`, unchanged by this run |
| GOLD source commit | `19d8c6ec820f324a6ac12733165e43b5e2c6eab2` |
| GOLD bytes SHA-256 | `88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256` (332,249 bytes, read once) |
| LR01 v1 body digest | `e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63` |
| LR01 v1 raw SHA | `b4cc77228caf847d1ad0d8a680457ca65731202513a047826e8bd973662e19ad` |
| LR02 v2 digest | `e3ba6d298fe2872cf5a39b2e3e8cc8704f54c5582f15cff49e2aacffdd20b3e7` |
| Master manifest | `manifest.v1.json` `revisionDigest=1d032deb1b03feac918ed0485aa31c21b4c7951373d4dda5ebfbe3b8f850474e` |
| Source manifest SHA-256 | `c1f0b7a8664656842d97df95a63ee93a258268b6856ac579f27c1908a072cc4d` |
| Compiler children | 12 `layers/*.v1.json` + 32 `rasters/*.u8`, all SHA-256 pinned in `manifest.v1.json` |
| Gates | `WMP_TESTS 75/75` — M-G0 15/15, M-G1 5/5, M-G2 13/13, M-G3 8/8, M-G4 12/12, M-G5 22/22 |

Nine newer Gameplay commits were reconciled against live `d1c56a45…`, not reset; the
user-supplied `d185d7f3…` is older. Newer owner comments `6622509728`, `6622888238`,
`6623153015`, `6623629800`, `6623791963` (M-CORE-03 / 03R / CT) were read. They are
**not** Arena start signals and do not modify Map scope. The sole Map-owned item they
raise — an industrial Veyra Recycler POI — is **explicitly declined in this round**: WMP-01
does not fabricate a POI, hand-place a Gameplay machine, or assert a reachable
approach/clear LOS within 2.8 tiles for an unauthored site. Existing industrial ZONE/POI
candidate geometry and `buildEnvelopeAt` are available for a separate creator Map dispatch
(DR-15). Gameplay `direct-v1` fallback remains in force.

## 2. Actual product

`veyra-world-master/` — one self-contained package, **no GOLD/MapLab/network dependency**:

- `data/` — 117 SHA-256 pinned files (verbatim GOLD, 12 canonical collections with holes/
  vertices/lines/precision, 21 GEO-01 rasters, 5 MapLab masks, LR01/LR02 artifacts, 6
  byte-preserved genuine Web PNGs, `source_manifest.v1.json` with whole-dir self-check).
- `migration/migrate.mjs` — the only GOLD reader; idempotent, `readCount=1`.
- `build.mjs` — deterministic compiler: 12 `layers/*.v1.json`, 32 indexed `rasters/*.u8`,
  `manifest.v1.json` with full child digests.
- `api/world.mjs` — 15 typed versioned queries; `api/intake.mjs` — chunk-aware window.
- `tests/run.mjs` — gates M-G0..M-G5 + 12 executed negative fixtures.
- `tools/views.mjs` — 15 deterministic technical views (pure Node PNG writer).
- `reproduce.sh`, `clean-room.sh`, `docs/`.

Canonical facts preserved: 2000×1400 AU, 250×175@8 AU, 579 IDs, 8 landmasses, 12 source
biome codes, 5 lakes/17 rivers/92 roads/12 bridges/27 docks, 81 POIs/24 archetypes,
23 zones, 280 markers, 6 distinct Elders; LR01 210 rooms/410 walls/235 portals/18 deep
cases; LR02 463 solids/169 openings/16 regions/5151 cells. No source-authored fact was
silently replaced by a heuristic; no Elder region was redesigned to uniformity.

## 3. Evidence

| Artifact | Content |
|---|---|
| `evidence/tests/test_results.v1.json` | Per-test PASS/FAIL, gate summary, manifest digest |
| `evidence/tests/negative_fixtures.v1.json` | 12 executed negative fixtures with expected/actual values |
| `evidence/build_determinism.v1.json` | Two `node build.mjs` runs, identical `revisionDigest` |
| `evidence/clean_room.log` | Isolated temp tree, `migration/` excluded, identical digest |
| `evidence/reproduce.log` | Full `./reproduce.sh` transcript |
| `evidence/views/views_index.v1.json` | 15 analytical views + master digest |
| `evidence/web_captures_index.v1.json` | 6 real Web captures classified separately |
| `evidence/windows/` | 5 verified chunk-aware window masks |
| `evidence/artifact_index.v1.json` | 51 supplementary evidence/docs/code SHA-256 digests + manifest SHA (runtime `.log` transcripts excluded) |
| `docs/GATES_M_G0_M_G5.md` | Gate commands/results generated from the test run |
| `docs/BLOCKERS_AND_OWNERS.md` | Exact-ID blocker/owner register |
| `docs/DECISION_REGISTER.md` | One consolidated pending batch |

Commands actually run: `node migration/migrate.mjs` (one-time), `node build.mjs` (x2),
`node tools/views.mjs`, `node tests/run.mjs`, `./clean-room.sh`, `./reproduce.sh`,
`node tools/artifact_index.mjs`.
LR02 baseline `cd world_lab/lr02 && ./reproduce.sh` → EXIT 0, `LR02_TESTS 46/46`.
`./clean-room.sh` reported `WMP_CLEAN_ROOM_OK digest=1d032deb… noGold=true noMapLab=true
noNetwork=true` with an isolated `WMP_TESTS 75/75`.

## 4. Phase A parity

GOLD bytes/shape/grid/seed verified; `geometry_snapshot` collections JSON-equal to embedded
GOLD (zero coordinate drift); 721 land polygon vertices, 2,305 total authored polygon
vertices, 685 authored water-mask hole cells inside land polygons, and high-precision
sub-4-decimal coordinates preserved; 579 IDs unique; all 26 rasters length 43,750 and
SHA-verified; declared cell domains enforced; invalid-water scan zero; 92/12/27/17/81
topology; LR01 210/410/235 and LR02 463/169; immutable v1/v2 digests; 6 Web PNGs
byte-identical; tampered raster cell detected.

## 5. Clean room

`./clean-room.sh` copies a strict whitelist to `/tmp/wmp_cleanroom.*` **excluding
`migration/`**, runs `node build.mjs`, `node tools/views.mjs` and
`WMP_CLEAN_ROOM=1 node tests/run.mjs` there, and compares the exact manifest digest.
Test `M-G1-01` statically rejects GOLD commit, MapLab paths, `git show`, `child_process`,
`execFileSync`, `fetch`, HTTP(S), `../web/` and Bible references in clean-room code.
`M-G1-02` asserts `migration/` and `world_lab/` are absent at runtime.

## 6. Scales, climate, clearance

Four comparison profiles U=1.0 / 1.6 / 2.0 / 2.5 with measured camera legibility, POI/wall/
opening pixels, body widths, world/route tiles, streaming budgets, coordinate round trips
and boundary drift. **Recommendation:** `scale.U20` = `RECOMMENDED_CONDITIONAL__NOT_APPROVED_CANON`
(4 au opening = 32 px, 2 au wall = 16 px at native 1×, world 1000×700 tiles), conditional
on Gameplay body/cart confirmation, swept clearance, runtime transform, human 640×360
legibility and creator approval. U=1.6 and U=2.0 remain diagnostics. Raw elevation bytes
are **not** proven metres; raw slope bytes are **not** degrees.

Climate: 12 static spatial potential regions with hot/cold/wetland/snow/toxic/radiation,
rain/sun/wind/frost/soil moisture/evaporation, fire fuel/break/propagation, vegetation and
farming affordance. All numeric temperature/damage/rain/season rates are `UNKNOWN` and
Gameplay-owned. No official temperature, damage, weather or season rate was invented.

Clearance: three `ASSUMPTION_PROFILE` bodies (2 / 8 / 16 au). Every road records min/mean
centre clearance, choke cells, raw grade, corner angles, approaches and three per-profile
geometric fits. **No `cartPassable=true` anywhere**; swept clearance, turning radius,
trailer sweep, grade limit and bridge deck are `UNKNOWN`/`UNRESOLVED`. All 12 bridges are
`deckStatus=UNRESOLVED` with `cartPassable=false`. BR-4 contradiction (clearance 0,
waterClass 3, roadClass 1, Elder geometry) is named with measured values.

## 7. POIs, roofs, vertical, water, roads

81 POIs assessed; 210 rooms; **153 PROPOSED physical roof candidates** derived only from
source room polygons and `coverageFractionOfRoom`; 43 open-air POIs remain roofless. All
18 vertical cases: **10 `PROPOSED_PHYSICAL_LINK`** (source `atAu` inside both ground room
and DEEP polygon, positive overlap, shaft/stair/opening candidate, `verticalSeparationAu:
null` / `UNRESOLVED`) and **8 `NAMED_BLOCKER_WITH_PROPOSED_ALTERNATIVE`** with exact portal
ID, `atAu`, conflict codes (`SOURCE_VERTICAL_PORTAL_AT_OUTSIDE_GROUND_ROOM`), ground/DEEP
polygons, measured overlap bbox, a non-canonical alternative shaft and a named negative
test. No fabricated link at a contradictory source coordinate and no hidden exception.
LOS: 123 blocked / 38 clear direct segments against M1 solids. Static openings 169,
solids 463; dynamic locks/power/HP/ownership/loot/enemies remain Gameplay-owned.

Water: 5 lakes, 17 rivers with perpendicular raster cross-sections (editor stroke vs
measured wet width distinguished, navigable width `UNRESOLVED`), 8 shoreline rings with
holes, 1,484 bank cells, 400 channel cells, 1,398 floodplain cells, 6 ford candidates with
`UNKNOWN` depth/fordability, fresh-salt identity, direction and one outlet defect. 11 named
crossing contradictions. No fabricated river, bridge or land connection.

Roads/bridges/docks: 92/12/27 with widths/grades/approaches/corners/turning/loading/
chokepoints/alternates. 7 disconnected roads, 8 blocked ferries (geometry only, no boats
claimed), unbridged crossings, false joins and Kilns ALT-A/ALT-B preserved. Alternate
FOOT / CART_PROPOSED / WATER_GEOMETRY_ONLY route candidates are explicit and non-canonical.

## 8. Coverage / defects / negative tests

23 build envelopes (12 with unresolved water-overlap cells), 70 continuous chunks, 579
stable feature IDs across boundaries, 12 climate regions, 12 source→14→20 crosswalk with
original subtype IDs and water/road/building overrides, 4 distinct spawn landmarks,
3 independent homes, 6 distinct Elder territories, 2 POI exterior/deep/retreat examples,
and 2 fully connected nonboss source→vendor→home→evacuation routes with `elderGate: NONE`
(first route `po_kestrel → wmp.vendor.1 → wmp.home.1 → dk_emberport`, 3,152 au over 394
cells; bridge geometry cells used with `bridgeDeckStatus=UNRESOLVED`, swept clearance
`UNKNOWN`, no cash/stock/receipt claimed). 123 direct LOS segments blocked by static solids
and 38 clear; 6 ford candidates, 11 named crossing contradictions, 685 authored water
holes, 1,484 bank cells, 400 channel cells, 1,398 floodplain cells.

Executed negative fixtures: invalid feature/POI ID, invalid coordinates, bridge clipping,
blocked-door/LOS occlusion, disconnected-chunk detection, unreachable deep-sea candidate,
water-overlap envelope, false passability, open-air roof, vertical named blocker, corrupt
raster cell, numeric climate prohibition. No invalid ID, undefined width, undefined
temperature or undefined collision was treated as `PASS`.

## 9. Real vs technical images

15 `MAP_ANALYTICAL_VIEW` / `SCALE_DIAGNOSTIC` images were generated here and inspected
(`world_terrain_full.png`, `detail_po_academy.png`, `scale_U20_camera.png`,
`detail_br4_crossing.png` opened and read back). 6 byte-preserved genuine Web runtime
captures are in `evidence/web_real/` classified separately.
`ACTUAL_WEB_RENDERED_INTEGRATION_PROOF=NOT_AVAILABLE__GAMEPLAY_OWNED`. No new art-direction
exercise, no unverified replacement tileset, no `VISUAL_ACCEPTED`.

## 10. Minimal intake contract

Pin `manifest.v1.json` SHA → verify `sourceIntegrity` and all child digests →
`projectWindow({originAu,U,widthTiles,heightTiles})` → apply explicit crosswalk overrides
from `layers/crosswalks.v1.json` → supply Gameplay-owned starts/occupancy/claims/hazards/
weather/stock/persistence → run Gameplay's `validateEconomyMap` /
`validateGeographicHandoff` at an exact Gameplay SHA. The 200×200 Web window is a bounded
slice, **not** the whole 2000×1400 Veyra. `api/intake.mjs` writes only
`evidence/windows/`; no Gameplay runtime file was modified.

## 11. Consolidated blockers / owners / decisions

See `docs/BLOCKERS_AND_OWNERS.md` and `docs/DECISION_REGISTER.md` (DR-01..DR-15). Owners:
Map (geometry, cross-sections, roof/vertical alternatives, chunk contract), Gameplay
(runtime scale, bodies, weather, stock, economy, escrow, save/offline, AI, visual approval),
Creator (scale/visual approval, any new Recycler POI dispatch). PR #44 remains DRAFT/HOLD;
no merge, no cherry-pick, no force-push, no modification of `main`, GOLD, Gameplay or other
owner branches.

## 12. Next action

Gameplay / Control Tower: consume `manifest.v1.json` at the exact SHA, run the bounded
intake validation at an exact Gameplay head, and answer the DR-01..DR-15 batch. Map awaits
a **separate creator dispatch** for any new POI placement or approved scale. No further
LR03 PR comments will be posted.
