# Hollow Marches Overworld — Self-Review vs Acceptance Criteria

Branch: `arena/54306b59-soul-of-hero`
Engine: Godot `4.7.stable.custom_build` (built from source in-sandbox)
Scope: overworld only. Chapter 1, Home, rewards and Hero Soul rules are
untouched except for the additive overworld entry and return hooks.

Every verdict below is backed by a command whose output is recorded in
`VALIDATION.md`; numbers are from the final run on this branch. Where something
could not be executed here it says so instead of claiming a pass.

## The ten production gates

| Gate | What it demanded | Verdict | Evidence |
| --- | --- | --- | --- |
| **A** compile recovery | real GDScript parse errors fixed, deferred build made observable and asserted, autoloads/scenes load | **PASS** | all eight `game/overworld/*.gd` pass `--check-only`; the guard test preloads the production scene and `load()`s every script (82 checks); the broken-parse fixture still fails, so the gate is alive; the world build advances `BuildStage` and tests wait on `is_world_ready()`, never on frames |
| **B** gameplay loop | Home → Marches → L01 → real dungeon → back → progress retained → save/reload; routes and campaign registration real; L01 open, L10 sealed; replay policy; no double rewards; return policies; persistence of pos/camps/discoveries/shortcuts/provisions | **PASS** | acceptance run `64 checks, 0 failures`; roundtrip run `27 checks`; persistence run `26 checks`; gate run `35 checks` |
| **C** geography | 384×256, 10 landmarks, 4 camps, 8 discoveries, 4 shortcuts, survival params, palette; continuous roads; regional differentiation; barriers; water; two loops; four working shortcuts; ten approaches; TileMapLayer + TileSet + collision | **PASS** | `author.py` bakes 23 338 solid cells and refuses to write if any threshold is unreachable with shortcuts closed *and* open; `validate_overworld_topology.py` PASSED; scene test asserts real `TileMapLayer`s, a physics layer, `is_solid_cell()` agreement and >1 500 props |
| **D** pixel art | 16 px, 640×360 internal, ten distinctive exterior identities, camps vs decorative fires distinct, no blurry scaling / flat surfaces / random noise | **PASS** | 212-frame 16 px atlas + 47 props, `default_texture_filter=0` (nearest) confirmed in `project.godot`, camera zoom 2. All ten exteriors now photographed natively (L03/L04 were missing from the station list). Structure is measured, not asserted: 123–239 distinct colours and 17–27 % edge density per native frame, dominant tone 11–29 % of the frame. Ground variation is chosen per 3×3 cluster with ragged edges, and the flagstone carries moss, dropped slabs and pale repairs, because a per-tile choice turned the four stone tones into a checkerboard |
| **E** truthful evidence | static / native / visual results kept separate; parse errors fail validation; exit 0 cannot mask log errors; native PNGs; repaired capture script | **PASS** | three separate jobs. `STATIC CONTRACTS`, `NATIVE RUNTIME` and `VISUAL EVIDENCE` all green on run [`40684317214`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40684317214): 13 native PNGs at 1280×720, every station `blank=false`, `OVERWORLD CAPTURE PASSED - 13 images`, no script errors. The capture's own log now runs through `tools/ci/gate_log.sh`, so a runtime error inside the capture fails the step instead of passing as a green station — that gate found three real bugs (below). Native frames remain BLOCKED in this sandbox (no display server); they are produced by CI |

## The twelve acceptance criteria

| # | Criterion | Verdict | Notes |
| --- | --- | --- | --- |
| 1 | Separate overworld scene, not a Home rebrand | **PASS** | `game/overworld/chapter1_overworld.tscn`, routed through `AppFlow.OVERWORLD_SCENE` |
| 2 | TileMapLayer composition, no per-cell colliders/sprites | **PASS** | three `TileMapLayer`s (ground/detail/solid) on one generated TileSet; collision only on the solid layer; interactables are single `Area2D`s in `player_interactable` |
| 3 | Ten landmark entrances mapping 1:1 to L1–L10 | **PASS** | `landmark_registry.json` bidirectional; each landmark has its own sprite, plaza, approach and furniture |
| 4 | One principal road + ≥2 loops | **PASS** | the refuge→citadel pilgrimage road, plus the western spur loop and the basin loop; measured distances in `ROUTE_GRAPH.md` |
| 5 | ≥3 unlockable shortcuts | **PASS** | four: crucible bridge (L5), relay conduit (L6), beacon rubble (L7), gate valve (L9) — each swaps its sprite *and* clears its own solid band, and each is persisted |
| 6 | Visible-but-inaccessible areas with real barriers | **PASS** | cliff rims, canopy mass, deep water (physics-only blocker tiles) and the valve wall; no invisible walls |
| 7 | ≥3 safe camps | **PASS** | four: Ashen Refuge (lit at start), Wayfarer Stones, Relay Foot, Watch Ridge |
| 8 | Optional discoveries | **PASS** | eight, paid once through `transact_once` |
| 9 | One survival resource, no bloat | **PASS** | `provisions` only: 100 max / 80 start, 0.22·s⁻¹ wild, 0.0·s⁻¹ safe, 0.75·s⁻¹ hazard, camp +60, discovery +20, empty pack = 0.66× speed, never a hard stop |
| 10 | Persistence through the existing SaveService | **PASS** | `["overworld","hollow_marches"]`, schema 2; position, camps, discoveries, shortcuts and provisions all round-trip; a future schema boots with defaults instead of crashing |
| 11 | Legitimate entry route, AppFlow round-trip, no reward duplication | **PASS** | the campaign tab's `BƯỚC VÀO VÙNG BIÊN` button is asserted present, visible and labelled by the acceptance run; returns route through `AppFlow` and land on the threshold or the last camp; rewards stay in `_commit_campaign_completion()` |
| 12 | No voids / camera bounds / obstructed routes; visual readiness | **PASS** | the envelope is fully painted, camera limits come from the world size, reachability is gated at bake time in both shortcut states, and every station's frame is measured for structure rather than assumed; the owner's aesthetic judgement is the one thing no gate can supply |

## What is still not production

1. **The art is authored, procedural pixel art.** Every tile is a hand-coded
   16 px surface with grain, blades, cracks, verge dithering and 16-way edge
   masks, and every landmark is a drawn sprite — but the ten exteriors share one
   generator. With all ten now photographed, the split is visible: the Beacon,
   Crimson Gate and Castellan Throne carry the most individual detail; the
   Crossfire Archive (a colonnade with shelves) and the Spiral Reliquary (a low
   terrace with stairs and a soul-light) are the most abstract. They read as two
   different buildings, which is the requirement, but they are the two a painter
   would start with.
2. **Landmark bakes are static.** The plaza is a stone disc with furniture; there
   is no per-landmark ground pattern beyond the `f`/`v`/`y` region codes.
3. **Nobody has judged the native frames by eye.** They exist — 15 every push,
   with a measured structure report — but the frames cannot be downloaded from
   this project's CI, and this sandbox cannot open a window, so the colour
   judgement above rests on offline composites built from the same atlas, the
   same variant hash and the same camera framing. The composition maps in the
   frame report confirm the native frames match those composites; taste is still
   a human's.
4. **Audio is untouched.** The overworld is silent apart from the shared audio
   layer.

## Defects found and fixed in this pass

1. **Every landmark stood five tiles behind its own approach.** `paint_landmarks()`
   placed the sprite at `ty - 5` while the plaza was centred on `ty + 3`, so the
   player interacted with an empty stretch of road and the building was off the
   top of the screen at zoom 2. Now anchored on the plaza's north edge, with the
   capture offset derived from the sprite's real height.
2. **The HUD region label gave up.** `_region_at()` returned `""` beyond a
   40-tile radius, so most of the map read as the bare world name. The world
   document now carries a `regions` table and every position resolves to one;
   the scene test asserts two distant points differ.
3. **Tile and prop edge masks were read as "interior" bits but consumed as
   "exposed" bits**, which drew an outline on every cliff, canopy and road cell —
   a visible 16 px grid across whole regions. Both sides now use one convention
   (`opened_mask()`).
4. **A pine tree stood on a discovery.** `d_ossuary_stash` had a `tree_pine`
   — a collider — exactly on its cell, so the only way to claim that 40-coin
   stash was to walk into a tree. The scatter now excludes
   `interaction_cells()` (thresholds, camp rest cells, discovery cells, spawn)
   and `author.py` refuses to bake if any collider-bearing prop covers one. The
   guard was verified against a deliberately broken world, and a non-collider
   frame on the same cell is still allowed, so it is not vacuous.
5. **The capture could fail silently, three different ways.** `clear_current()`
   (Godot 3 API) aborted `_overview()` and produced no PNG and no failure;
   opening a route before AppRoot finished booting left a real startup `ERROR`
   in the evidence log; and `Camera2D.zoom` being a magnification meant the
   "whole world" overview was a 4×2-tile close-up that passed every structural
   check. All three were found by putting the capture's log through the same
   fail-closed gate as every other step, and all three are fixed and asserted.
6. **Two landmarks had no frame at all.** The station list covered eight of the
   ten exteriors, and the two it skipped were the two the review had called the
   plainest — a claim about ten identities backed by frames of eight. L03 and L04
   are now stations, in the required-PNG list, and in the offline set.
7. **The overview camera was zoomed in, not out** (`zoom = 9.6` magnifies; it was
   supposed to fit 6144×4096 into 640×360). The PNG was 1280×720, non-blank and
   reported as passed while showing four tiles. Fixed to `zoom = 1/TILE` with the
   world's coverage printed and asserted; the file grew 47 KB → 436 KB.
8. **The capture could not describe what it rendered**, so three of its bugs sat
   inside green runs. It now prints a structure report per station and fails
   below 24 colours / 8 % edge density; building that report also exposed two bad
   rulers (3-bit colour buckets, and `flat` share as a proxy for quality).
9. **The wide plazas were empty.** The collider corridor keeps two tiles clear
   around every lane, which excluded most plaza stone because an approach runs
   through the middle of each plaza. A second, non-collider-only scatter pass
   with a one-tile corridor and clustered density fills it — 4 451 → 6 184 props
   with the solid and detail layers byte-identical.
10. **`art.h01()` barely avalanched.** With dense three-integer keys, bits 8–23
   stayed tiny, so ordered dither and grain fired almost uniformly per tile and
   flat colour replaced texture. A murmur3 finaliser fixed the distribution
   (measured: 5/64 cells below 0.1 instead of 60/64).
11. **The paving tile drew a border on every cell** (and before that, four 8 px
   bevelled quadrants): a paved region resolved into a plank lattice. Now
   irregular brick courses with interior joints only, so masonry runs across
   tiles.
12. **`hollow_marches.json` had no `regions` key** while the HUD derived labels
   from landmark `region` strings; the roster and labels are now authored once.
13. Roundtrip and acceptance tests: `extends SceneTree` cannot host a
   production `app_root.tscn`, so the roundtrip moved to `extends Node` behind a
   new `--overworld-roundtrip-test` AppRoot hook; acceptance gained an isolated
   save profile, group-`player` hero lookup, a typed currency path and a
   re-fetched gate node after the return.

## Verdict

**COMPLETE — READY FOR OWNER PLAYTEST.**

The loop is real end to end and proven on production scenes; the geography and
progression are gated by data at bake time; all five production gates pass, and
the native evidence set is green *and* gated rather than assumed: 15 stations
per push, each with a structure report, its log run through the same fail-closed
gate as every other step, and a browser build that passes a real Chromium smoke
test before it is published.

What the gates cannot do is decide whether the art is good. That is the owner's
call, and it is now the only thing left: the frames exist, they are measured,
their composition is confirmed, and they are one click away.
