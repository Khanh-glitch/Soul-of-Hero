# MAP-GEO-REJOIN-01 — Map Execution Status (Physical Terrain & Traversal Readiness)

> **This is a current Map execution status, NOT a competing product roadmap.**
> Active authority stays `WMP-04R1` / `U=0.5` / `CREATOR_CHOSEN_U05.v1`.
> Purpose: let Control Tower decide whether **physical Veyra geography** is ready
> for Gameplay integration, with **named blockers instead of fabricated completion**.
> Generated 2026-11-05. Evidence is machine-readable in `creator-u05/evidence/mapgeo01-*.json`
> and `creator-u05/map-data/MAPGEO01_FINDINGS_RECONCILED.json`.

---

## 1. Exact source SHAs and active authority

| Item | Value |
|---|---|
| Map branch / local HEAD / remote HEAD | `arena/2e3cfbd2-soul-of-hero` @ `99a196f3b601155ae216ba8968d4f94ee2d0a157` |
| `main` | `5214788933b1a827f3a177d11ff486433dfe5e8a` |
| Gameplay branch / **live** PR44 HEAD | `arena/d4bfcfff-soul-of-hero` @ **`6e7d116b4400ea3c24373fe884b7fad258f4f7bc`** (OPEN, *not edited/merged*) |
| Gameplay HEAD observed in the task text | `2f0836587b76a4a98fffedf8c202fb37cbb2a67c` (superseded by the commit above) |
| Creator-verified Gameplay HEAD | `5b3e683402bbc8540dea9404576164097e753f97` |
| U05 source pin | `b5c8004ca4e77be62484fb3cd296fe296d7de4c9` |
| Active revision / manifest / status | `WMP-04R1` / `v4/r1/manifest.r1.json` / `MAP_GEO_R1_CORRECTED__GAMEPLAY_INTAKE_PENDING` |
| Scale / camera | `U=0.5 AU/tile`, `TILE=16 px`, `1×` `640×360`, hero `16×24`, frame `4000×2800` (11,200,000 addressable cells, never materialised) |
| Protected terrain-only executable | `540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0` — **unchanged** |
| NATURE-01 / NATURE-02 executables | `ac4d54e3…` / `6e1e897a…` — unchanged; archived R&D, **not** production resource placement |

**Live-ref drift (verified before working):** the Gameplay branch advanced from the
observed `2f083658…` to `6e7d116b…` ("Prove and improve natural living home route").
The live `web/ref/bible.md` changed at §K6 ownership and §11.3 C07/C09 (Creator
2026-11-05 claim/upkeep decision); **§V and §11.5 are unchanged**. `web/src/game/art.ts`
gained `S.claim` at `2f083658…` while the U05 vendored copy remains pinned to
`b5c8004c…` — do **not** silently re-vendor. The **terrain painter block**
(`PAL/PRIO/texel/renderChunk`) is byte-identical at all three heads, SHA
`f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803`, so the
Creator-locked Beacon road appearance is preserved. `web/ref/bible.md` is **absent**
in the Map worktree; §V/§11.5 were read from the live Gameplay object. The
vendored `creator-u05/web-u05/ref/bible.md` is a different file.
Full preflight: `evidence/mapgeo01-preflight.json`.

## 2. Map layer completion matrix

| Layer | Source / provenance | Measured status | Owner of remaining gap |
|---|---|---|---|
| L01 World-master pointer, WMP-04R1 manifest, 21 rasters | `CURRENT_WORLD_MASTER.json`, `manifest.r1.json`, `v4/r1/data/*` | **SOURCE-COMPLETE** (SHA-pinned, unchanged) | — |
| L02 GOLD canon geometry & all canonical IDs | `VEYRA_GOLD_MAP.sohmap.json` `88780f78…` | **SOURCE-COMPLETE & IMMUTABLE** — 8 land / 5 lakes / 17 rivers / 92 roads / 12 bridges / 27 docks / 81 POIs / 23 zones / 280 resources / 4 spawns / 6 elders / 24 labels | — |
| L03 Hydrography (coast, islands, lakes, rivers, bends, mouths, shores) | real `sampleTile()` at stride 8 + centreline probes | **MEASURED** — 17/17 river centrelines continuous, 17/17 mouths reach water, 7 confluences, 2,923 coast tiles @ stride 8 | Creator (any reauthoring) |
| L04 Elevation / slope / cliff / terraces / material transitions | WMP-03 candidate rasters + 8 stride-1 windows | **MEASURED GAP** — 305 `cliffCandidate` cells (code 1) but **0 physical `T.CLIFF` tiles** because the U05 rule requires `>=2` (`MGP-D10`) | Map derived layer + Gameplay/Creator cliff law |
| L05 Road network / visible width / continuity / intersections | all 92 GOLD `rd_*` centrelines | **MEASURED** — 92/92 centreline-continuous, 17 GOLD intersections, 58 biome transitions, mean perpendicular 10.08 road-flag tiles; 31 roads have water overrides at river crossings | Creator / Gameplay A8 (crossings) |
| L06 Bridges | 12 GOLD `br_*` | **BLOCKED** — 12/12 centres render `RIVER`, 12/12 `terrainBlocked=true`, **0 physically crossable** (`MGP-D01`) | Map derived layer + Creator span/art + Gameplay collision |
| L07 Docks | 27 GOLD `dk_*` | **PARTIAL** — 25/27 have a dry-land approach, 18/27 road adjacency, 15/27 dock flag at centre; no boarding cell | Gameplay A8 / Creator |
| L08 Spawns + nearby routes | 4 GOLD `sp_*` | **MEASURED** — 4/4 dry, unblocked, `foot=true`; nearest rendered road 29 / 48 / 57 / 42 tiles | Gameplay A0 (spawn legality) |
| L09 POI exteriors / buildable / retreat | 81 GOLD `po_*` + 23 `bz_*` | **CANDIDATES ONLY** — 81/81 have walkable exterior samples, 18/81 retreat polylines, 23/23 zones have buildable candidates; no doors/rights | Gameplay A8 / A0 |
| L10 Visible surface ↔ physical geometry ↔ permission separation | `u05Tile()` / `sampleTile()` / `permissions` | **EXPLICIT & ENFORCED** — `build/boat/swim/ferryFoot` are `false` at every sampled tile | Gameplay |
| L11 Native 640×360 runtime evidence | protected terrain-only executable | **PARTIAL** — 16 native screenshots, 6 real-key traversals | Full Gameplay runtime |
| L12 Gameplay integration | `arena/d4bfcfff-soul-of-hero` | **NOT DONE** — PR44 untouched | Gameplay owner |
| L13 Production atlas / visual acceptance / merge | — | **NOT AUTHORISED / NOT REQUESTED / NOT DONE** | Creator |

## 3. Reconciliation of the 62 U05 findings

| Classification | Count | Owner | Severity |
|---|---:|---|---|
| Genuine Map geometry defect, source-backed correctable | **0** | MAP_U05 | HIGH |
| Intentional overlap / host–subsite relationship | **12** | MAP_U05 / CREATOR | INFO |
| Gameplay / A8 semantic decision | **46** | GAMEPLAY A8 / A0 | HIGH |
| Creator decision required | **1** | CREATOR / GAMEPLAY A8 | MEDIUM |
| Missing evidence | **3** | GAMEPLAY / CREATOR | MEDIUM |
| **Total** | **62** | | |

Before: 61 `UNRESOLVED` + 1 schematic note, 6 mixed owner strings, **0** explicit
categories. After: **62/62** classified with one owner, one severity, one decision
and U05 evidence each. **30** polygon findings were remeasured at exact 0.5 AU tile
centres using a **union** of shapes; **7** buildable zones were proven to be
double-counted in the original per-object 1 AU sum (example `bz_cinder`:
2,131 cells → naive 8,524 tiles → **5,505** real U=0.5 tiles).
`0` findings qualified as a clearly Map-owned geometry correction — every
candidate either touches immutable GOLD geometry, needs a Gameplay/A8 decision,
needs a Creator decision, or lacks source-backed evidence.
`0` polygons amended / relocated / expanded / recoloured / widened; `0` doors,
props, buildings or entrances generated.
Packet: `map-data/MAPGEO01_FINDINGS_RECONCILED.json`, `evidence/mapgeo01-reconciliation.json`.

## 4. Physical defect list (measured, owner, severity)

| ID | Defect | Measurement | Owner | Severity |
|---|---|---|---|---|
| MGP-D01 | All 12 bridges are `RIVER` + blocked; no bridge deck spans the channel | 12/12 RIVER, 12/12 blocked, 0 crossable, 3/12 bridge flag at centre | Map derived layer + Creator (span/art) + Gameplay A8 | **BLOCKER** |
| MGP-D02 | Road centrelines overridden by water at river crossings | 31/92 roads affected, 8 ferry-path roads dominate | Map + Creator + Gameplay A8 | HIGH |
| MGP-D03 | 27 docks lack boarding/disembark cells and land-path permission | 25/27 land approach, 18/27 road adjacency, 15/27 dock flag | Map + Gameplay A8 + Creator | HIGH |
| MGP-D04 | 26 missing exterior entrance records | 26/81 POIs; all have an `access` string, none has a door record | Gameplay A8 + Creator | HIGH |
| MGP-D05 | 19 buildable zones overlap POI/Elder envelopes | remeasured to 0.5 AU tiles; legal placement still Gameplay-owned | Gameplay A0 + Creator | MEDIUM |
| MGP-D06 | Retreat / vertical-link / cart clearance lack a Gameplay decision | 63 POIs without retreat, 8 vertical blockers, 1 cart pair | Gameplay / A8 | MEDIUM |
| MGP-D07 | Helicopter vs lighthouse 5.6569 AU, sprite proven missing | 11.3137 U=0.5 tiles; `NO_RELOCATION__NO_SUBSTITUTE` | Creator / Gameplay A8 | MEDIUM |
| MGP-D08 | Marine foot/boat/swim/ferry permission forbidden | `false` at every sampled tile | Gameplay / Creator | **BLOCKER (marine routes)** |
| MGP-D09 | `po_timberyard` centre authored on a `RIVER` tile | 1/81 POI centres blocked | Creator + Gameplay A8 | MEDIUM |
| MGP-D10 | `cliffCandidate` 0/1 encoding never satisfies `cliff>=2` | 305 candidate cells, **0** physical `T.CLIFF` tiles | Map derived layer + Creator/Gameplay | HIGH |

Full register with per-item measurements: `evidence/mapgeo01-physical-audit.json :: defects`.
**No defect was silently corrected.** MGP-D01 and MGP-D10 are the two derived-layer
discrepancies: fixing them would respectively stamp an arbitrary ~48-tile bridge deck
over a river and mint physical blockers from 8 AU **candidate** cells. Both are
physical-law/asset decisions, not source-backed geometry corrections.

## 5. Before/after actual-runtime screenshots

All 16 PNGs are **native `640×360`** from
`document.getElementById('game').toDataURL()` in the **protected, unmodified**
`SoulOfHero_TerrainOnly_U05_x10.html`, Chromium DPR 1, `file://`, 0 console errors.
Directory `creator-u05/evidence/mapgeo01-shots/`.

| Pair | Before | After | What changes in the real runtime |
|---|---|---|---|
| T1…T6 | `T<n>_*_before.png` | `T<n>_*_after.png` | start frame → end frame of a **continuous real-key traversal** |
| Physical state | `physical_free_roam_before/after.png` | `physical_natural_collision_before/after.png` | same bridge coordinates `[2020,907]`, **collision OFF** → **collision ON**, both with real held `D`: 888 px / 0 blocked → 344 px / 122 blocked |
| Bridge blocker | `T3_bridge_approach_crossing_before.png` | `T3_bridge_approach_crossing_after.png` | hero walks to the bank and is **stopped by the river**; bridge deck exists on land but not over the channel |

> These are **traversal / physical-state before-after frames**, not "corrected geometry"
> after-images. **No GOLD geometry correction was applied**, so no such after-image
> exists — that absence is itself a named blocker. Free-roam (`C` OFF) is a viewer
> diagnostic only: it is **not** walkable water, not a traversal proof, not a permission.
> QA/browser screenshots are **not** visual or production acceptance.

## 6. Verified continuous traversal paths, distances and failures

Runtime: `NATURAL_TERRAIN_ONLY` collision ON, `x10` **viewer** multiplier (720 px/s;
base `SPEED=72 px/s` unchanged), real held WASD + `requestAnimationFrame` sub-steps
≤6 px. `reset(tx,ty)` is used **once per run as a viewer spawn control** (the source
labels it `spawnFixture … NOT a route / teleport claim`); `cameraTeleportUsed=false`,
`cameraUsedAsRoute=false`, `cameraTrick=false`. **No camera teleport is called a traversal.**

| # | Path | Start → end tile | Distance | Blocked | Result |
|---|---|---|---:|---:|---|
| T1 | `sp_west` → safe terrain → authored road | `[744,1212]` → `[774,1182]` | 967 px / 60.44 tiles | 0 | **PASS_VIEWER_PHYSICAL** (ends on `ROAD`) |
| T2 | GOLD `rd_12` cart road through biome transition | `[2372,2580]` → `[2473,2580]` | 1,620 px / 101.25 tiles | 0 | **PASS_VIEWER_PHYSICAL** (100/100 corridor tiles `ROAD`, `forest → meadow`) |
| T3 | `br_1` river-bank approach + attempted crossing | `[2020,907]` → `[2041,907]` | 342 px / 21.38 tiles | **122** | **FAIL_CROSSING__BANK_APPROACH_PASS** — bank reached, crossing physically blocked |
| T4 | Highland route + alternative | `[1200,1200]` → `[1203,1199]` | 1,908 px / 119.25 tiles | 0 | **PARTIAL__NO_PHYSICAL_CLIFF_BLOCKER_EXISTS** (FOREST/CONIFER/ROCK transitions, no cliff to force a detour) |
| T5 | Coastal/dock approach to `dk_cinder` | `[3170,1769]` → `[3130,1769]` | 644 px / 40.25 tiles | 17 | **PASS_VIEWER_PHYSICAL** (dock reached; 17 blocked substeps = coastline correctly blocks further westward movement) |
| T6 | `po_beacon` exterior + return | `[520,1304]` → `[519,1304]` | 636 px / 39.75 tiles | 0 | **PASS_VIEWER_PHYSICAL** (out-and-back; no door/prop invented) |

Aggregate: **4 PASS / 1 FAIL / 1 PARTIAL**, 0 browser errors, 16 native screenshots,
all input logs contain real `keydown` events. Evidence: `evidence/mapgeo01-traversal.json`.

**Proven in the isolated viewer:** native 1× camera + verbatim painter; continuous
real-key movement with `movedPx`/`blockedSubsteps`; natural terrain blocking;
road/bridge/biome surface continuity; 4 dry spawns within 29–57 tiles of a rendered
road; **bridge crossing not supported**; **zero physical cliffs**.
**Still requires full Gameplay runtime:** building/wall/door/roof collision, POI/room
interaction, A0 spawn legality and legal placement, foot/cart/boat/swim permissions
and loading capacity, bridge span/sprite/collision, dock boarding and water depth,
cliff collision law, vertical-link separation, retreat routes for 63 POIs,
4000×2800 streaming, offline save migration and production clock.

## 7. Map-owned corrections performed

| ID | Correction | Measured before → after | Geometry changed |
|---|---|---|---|
| C-01 | 30 polygon findings remeasured at exact U=0.5 tile centres with a **union** | 1 AU-cell sums (7 zones double-counted) / AU² analytic → native 0.5 AU tile counts; e.g. `bz_cinder` 2,131 → 5,505 | **NO** |
| C-02 | 62 findings classified into the 5 required categories | 61 UNRESOLVED + 1 note, 6 owner strings, 0 categories → 62 classified, 4 owner strings, 5 categories | **NO** |
| C-03 | Source-pinned immutable GOLD provenance + 10-defect physical register | no per-task SHA/provenance block → 21 SHA-pinned sources + 10 measured defects | **NO** |

**Zero GOLD geometry amendments**: `amendedPolygons=0`, `relocatedObjects=0`,
`expandedEnvelopes=0`, `recolouredRoads=0`, `widenedRoads=0`, `newBuildings=0`,
`newDoors=0`, `newProps=0`, `newAtlas=0`, `canonicalIdsChanged=0`.
`U05_GEOMETRY_CONFLICTS.json`, GOLD JSON, WMP-04R1 rasters, `world.ts`,
`terrain.ts`, `geometry.ts`, `art.ts` and all three protected executables are
byte-identical to their pre-task SHA-256. Static gate: `tests/test-mapgeo01.mjs`
**130/130 PASS**.

## 8. Gameplay-owned interfaces still missing

1. `WorldTraversal` bridge/ferry edges with real span, `bridge_width`, `load_validity`
   and `alternate_edges` for 12 bridges (currently 0 crossable).
2. Foot / cart / boat / swim / ferry permission + `t_foot`, `t_cart_loaded`,
   `t_cart_unloaded`, `distance_to_road`; no loading capacity is approved.
3. `POIAccessGraphCandidate` exterior entrances for 26 POIs, `door_positions`,
   `room_geometry`, `power_nodes`, `exit_paths`, `stand_positions`.
4. `BuildSiteSample` legal placement after A0 protection/collision/route/resource/
   dynamic-occupancy checks for 19 overlapping buildable zones.
5. Dock boarding/disembark cells, water depth, harbour collision for 27 docks.
6. Cliff collision law and 8 vertical-link separation blockers.
7. 63 POI retreat/exit routes; cart swept-clearance rule for `po_ironmine`/`po_westmouth`.
8. MAP-SPAWN-04 / HOME-03 / POI-02 / LOG-03 / U1–U5 / CAMERA full-runtime tests;
   WMP-04 marine weather/hazard and unique-item custody.
9. Approval of the missing Beacon helicopter sprite (`NO_RELOCATION__NO_SUBSTITUTE`).
10. Decision on `po_timberyard` centre on a `RIVER` tile; no auto-relocation.

## 9. Acceptance statuses — kept separate

| Gate | Status |
|---|---|
| **PAPER** | **MEASURED** — 62/62 findings classified, 10 physical defects named, U=0.5 remeasurement + immutable provenance. Not "design accepted". |
| **RUNTIME** | **ISOLATED_VIEWER_PHYSICAL_PARTIAL** — 6 real-key traversals: 4 PASS / 1 FAIL / 1 PARTIAL; 16 native 640×360 shots; 0 browser errors. **Not** full Gameplay runtime integration. |
| **VISUAL** | **NOT_REQUESTED_AND_NOT_GRANTED** — QA screenshots are not visual acceptance; Creator visual approval was not requested. |
| **GAMEPLAY** | **NOT_REQUESTED_AND_NOT_GRANTED** — no Gameplay build, no PR44 merge, no `VEYRA_PLAYABLE`. |

Historical blockers remain in force: `VEYRA_PLAYABLE` BLOCKED, LW-G2/G3 PARTIAL,
H/J QA-only fixtures, `legalPlacement` UNKNOWN/GAMEPLAY, P5-G5/G6 FAIL.
`creator-u05/docs/LAYER_INVENTORY.md` is referenced by the U05 contract but
**does not exist** (recorded, not fabricated); only `contracts/LAYER_INVENTORY.json` exists.

## 10. One recommended next integration action

**Hand the source-pinned packet to the Gameplay owner and open one joint decision on
`MGP-D01` (12 bridge crossings).** Concretely: Gameplay pins
`6e7d116b4400ea3c24373fe884b7fad258f4f7bc`, consumes `MAPGEO01_GAMEPLAY_HANDOFF.md`
+ `mapgeo01-physical-audit.json`, and decides — with the Creator — the bridge
span/art and the `WorldTraversal` collision contract. That single decision unblocks
T3, converts 31 water-overridden road segments into measurable alternatives, and
gives Control Tower a real PASS/FAIL for land-route continuity. **Map will not edit
or merge PR44**, will not invent a bridge deck, and will not declare integration.

## 11. Stops / not-claims

No mass POI production · no resource scattering · no new atlas · no new standalone
map product or visual simulation · no replacement geography · no production merge ·
no PR44 edit/merge · no walkable water, approved carts/boats, loading capacity,
POI doors, build rights or fake entrance props · no `VISUAL_ACCEPTED` ·
no `VEYRA_PLAYABLE` · no `MERGE_READY` · no full 4000×2800 streaming claim.
