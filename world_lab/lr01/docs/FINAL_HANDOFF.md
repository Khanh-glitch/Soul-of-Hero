# MAP-LR01 — final Map Tower handoff

> **MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.**
> This is a **Stage 1 geography** deliverable. It is **not** a finished world,
> **not** visually approved, **not** playable survival acceptance.

## 1. Exact branch / commits / remote

| item | value |
|---|---|
| branch | `arena/2e3cfbd2-soul-of-hero` (only branch used; never switched) |
| long-run start HEAD | `9e0f08055a93ccf6cbd4657c4fc5c128385eb90a` |
| MAP-LR01 A | `5d9334daa9164e08ea36f8ec07ac546e93a6911e` |
| MAP-LR01 B+C | `e1dfd92130b041ed4b87bdbb1fb07e0695f8c303` |
| MAP-LR01 D | `b949d777bce71c8eddb4b71e994f75e8fb0b53d4` |
| MAP-LR01 E | `df29ea03b7e228e2a5d9675309bd925383dc7a9a` |
| MAP-LR01 F + final metadata | **`output/final_head.v1.json`** holds the exact final local HEAD, remote HEAD, full commit list and artifact digests. It is written by `tools/finalize.mjs` after the F commit so the reported SHA is real, not predicted. |
| remote | `origin/arena/2e3cfbd2-soul-of-hero`, pushed after every checkpoint; no force-push |
| PR #44 HEAD read at checkpoint | `f8010ec973095c88f3c462a68116c169b61237a3` (OPEN / DRAFT / HOLD) |
| PR #38 HEAD | `8421b9c3335c7648488ce8ae5dab43eb5787977e` |
| Veyra GOLD | `19d8c6ec820f324a6ac12733165e43b5e2c6eab2`, `88780f78…`, 332249 B |
| `main` | `5214788933b1a827f3a177d11ff486433dfe5e8a` (untouched) |
| PR #44 handoff comment | `6619191264` @ 00:33:40Z — posted, **no corresponding acknowledgement** |
| later Gameplay comment read | `6619188131` @ 00:33:29Z — Gameplay K6 bounded acceptance; MAP-LR01 remains separate; “Do NOT announce playable Veyra” |

No merge into #38/#44, no cross-branch write, no cherry-pick, no canonical Veyra
rewrite. Cross-branch **read** worked; cross-branch **push** was intentionally not
attempted.

## 2. Milestones — genuine status

| milestone | status | what is actually delivered |
|---|---|---|
| A | **COMPLETE** | Corrected per-POI geometry/scale tool: each POI's own quad/edges/deep polygon, derived open-air vs enclosed classification (38 enclosed / 43 open-air), 13 candidates incl. full `U=1.68–2.25` focus band, explicit fractional transform + raster coverage, measured/modelled travel, physical space, memory, resolution, uncertainty. Bounded diagnostic band `U∈[1,2.5]`; **U=2 NOT canonized**. Full `2000×1400` frame retained. |
| B | **COMPLETE** | Whole-Veyra deterministic geography compiler: 579 canonical IDs with statuses, all 8 landmasses, coastline/islands/beaches/wetlands, 5 lakes / 17 rivers / watershed (0 dangling refs, 1 authored outlet gap), elevation/slope/landforms/biome transitions, 23 zones with build suitability + PROPOSED loading space, 4 spawns + corridors, 6 Elder territories/approaches/arenas + 15 separations, 8 PC-B and 5 UN-B records, 41 region exports. `250×175` raster supplies geography, not final detail. |
| C | **COMPLETE** | Full transport audit rederived at verified `SNAP_TOL=7` (tol-8 defect reproduced: 596 vs 81 self-merged foot edges, NOT preserved); 18 crossings match GEO-02 exactly; 92 roads, 12 bridges, 8 ferries BLOCKED; 75 snap junctions / 13 flagged; POI foot 81/81, cart 57/81 with `po_kilns` correctly excluded; 15 OD alternate-route checks; 23 prioritised build sites; 7 source-linked failure cases; explicit PROPOSED road/deck widths bounded by measured clearance, `sweptClearanceAu=null` everywhere, **zero `cartPassable:true`**. |
| D | **COMPLETE** | 81 POIs / 24 archetypes as real static structures, not markers: 210 rooms, 410 walls, 235 portals, 456 sockets, 99 levels (18 deep), 1701 unique stable IDs, 8 representative examples, 22 distinct spatial patterns, six geometry adapters per POI. Interiors PROPOSED, never canonical. Sockets have `gameplayObject:null`. No loot/lock/power/device/machine/recipe/quest authored. |
| E | **COMPLETE** | 11 assets assessed individually across 5 tiers with exact SHAs/rights; primary Web art + original Web ocean/large wave motifs/animated shore glints KEPT; A1 terrain/props REFERENCE_ONLY; `web_art_patch` B REJECTED (repetitive canopy + procedural grass noise); no unlicensed pack. 18 reproducible native `640×360` before/after/`after_ui` views over 6 stable regions, with SVG/PNG SHA-256 and explicit transform metadata. **No creator visual approval.** |
| F | **COMPLETE as geography-only package; integration BLOCKED** | Versioned digest-verified Stage 1 package, concise handoff, Map-owned PR44 handoff file, compatibility/ownership report, minimal adapter spec, 6 blockers, 10 unknowns, isolated tests. Web playability gate OPEN. |

No milestone is claimed complete as playable gameplay. F's integration proof is
explicitly BLOCKED, not quietly skipped.

## 3. Full-world coverage / source-linked changes

All 579 canonical objects are indexed with `sourceRef` and status. All 8
landmasses, 23 zones, 4 spawns, 6 Elder territories, 81 POIs, 92 roads, 12
bridges, 27 docks, 17 rivers, 5 lakes and 280 habitat markers are covered.
Macro geography was **not** rewritten. Eight proposed changes (PC-B-01..08),
five C proposals, four D proposals and eight F-related blockers/UNKNOWNs are
source-linked with expected-vs-actual, coordinate, unit, source file/SHA and
owner. Retained non-production research (GEO-01, GEO-02, SCALE-01A, MAP-R01)
was not overwritten.

## 4. Artifacts / schemas

| artifact | schema / content |
|---|---|
| `output/scale_corrected.v1.json`, `poi_geometry.v1.json` | A: 13 profiles, 81 per-POI geometries |
| `output/geography.v1.json`, `feature_status.v1.json`, `output/regions/*.v1.json` | B: whole-world compiler + 579 status rows + 41 regions |
| `output/transport.v1.json`, `route_graph.v1.json`, `build_sites.v1.json`, `transport_failures.v1.json` | C: audit, tol-7 graph, sites, failures |
| `output/poi_layouts.v1.json`, `poi_summary.v1.json`, `poi_examples/*.v1.json` | D: 81 layouts + 8 examples |
| `output/art_manifest.v1.json`, `views_index.v1.json`, `output/views/*_640x360.{png,svg,html}` | E: provenance + 18 native views |
| `output/geography_package.v1.json` | `soh.map.lr01.geography_package.v1`, schemaVersion 1, revision 1, `revisionDigest` |
| `output/handoff.v1.json`, `output/pr44_handoff.md` | F: concise record + Map-owned handoff text |
| `docs/ADAPTER_SPEC.md`, `docs/COORDINATION.md`, `docs/MILESTONE_A..F.md` | specs, coordination, milestone records |

Field ownership and compatibility are in `handoff.v1.json`:
`satisfiesGeographicHandoff: false`, `satisfiesRuntimeMapPackage: false`, reason
and `requiredFromGameplay`. PR44's mixed validators are **integration
dependencies**, not geography validators.

## 5. Visuals / tests actually inspected

**Inspected by the agent (real image reads):** four PR44 native 640×360 evidence
captures, `web_art_patch` before/after pair, MAP-R01 slice atlas, A1
`terrain.png` and `props.png`; generated `zone_bz_greywater` before / after /
after_ui, `land_ld_ironholm` after (plus a 3× crop to check the snow patch and
wave treatment), `elder_el_typhon` after, `zone_bz_delta` after; Milestone A's
`scale_corrected.png` was inspected in the earlier SCALE-01A work. No human
640×360 playtest or creator visual approval occurred.

**Executed:** `./reproduce.sh` → `MAP-LR01_REPRODUCE_OK`;
`LR01_TESTS 90/90` (+ F gates in the final run); `GEO_TESTS 15/15 passed`;
`GEO02_TESTS 47/47 passed`; `GEO02_REPRODUCE_OK`;
`A_SCALE_OK`, `B_GEOGRAPHY_OK`, `C_TRANSPORT_OK`, `D_POI_OK`, `E_ART_OK`,
`E_RENDER_OK views=18 … errors=[]`, `F_HANDOFF_OK` (digest recomputed and
matched). Chromium rendered all PNGs with `errors=[]`.

## 6. Regressions / limitations

* GEO-01 / GEO-02 / SCALE-01A regressions pass. GEO-01 `joinToleranceAu=8`
  defect is reproduced and **not** preserved.
* No approved au→tile transform (`U=2` diagnostic only); fractional transforms
  have explicit raster-coverage costs; `250×175` is not final detail.
* Physical road width, bridge deck span, river channel width unit, swept
  clearance, cart footprint and vertical floor separation remain UNKNOWN.
* 8 ferry centrelines BLOCKED (no Gameplay boat rule); `po_kilns` has no cart
  access within `ACCESS_R=48`; RT-1 contains `kind=trail` segments and is NOT
  cart-passable; `br_a` is foot-only; zero clearance at `[732,652]`.
* Enclosure classes, wall thickness, room `5×4` requirement and `1 au`-scale
  wall thickness are DERIVED/PROPOSED assumptions, not canon.
* No streaming/LOD implementation; PR44 chunk culling is not world streaming.
  Memory figures are a lower-bound model, not measured heap.
* No third-party art pack imported; A1 assets are Godot `res://` paths from an
  unapproved research branch; Drive/CraftPix bytes inaccessible.
* No compatible geography-only intake seam; no Web playability proof; **no
  acknowledgement of any MAP-LR01 handoff exists**.

## 7. Outstanding creator decisions

1. Approve/reject an authoring-unit → runtime-tile transform and fractional mode.
2. Approve a geography-only intake seam and `docs/ADAPTER_SPEC.md`.
3. Approve a physical road/bridge width + swept-clearance evidence standard.
4. Approve any art change (none claimed).
5. Authorize any exact-SHA cross-branch integration worktree / handoff ack.

## 8. Precise next integration step

Creator approves the au→tile transform; Gameplay implements a geography-only
intake seam that verifies `geography_package.v1.json`'s `revisionDigest`, all
payload SHAs and stable IDs; Gameplay then populates/simulates Stage 2 and
compiles `RuntimeMapPackage`. Only after that should an exact-SHA worktree
integration proof be attempted. Until then: keep Stage 1 geography intact, keep
completed work intact, continue independent Map production if requested.
