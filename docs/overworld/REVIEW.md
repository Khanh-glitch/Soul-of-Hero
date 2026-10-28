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
| **D** pixel art | 16 px, 640×360 internal, ten distinctive exterior identities, camps vs decorative fires distinct, no blurry scaling / flat surfaces / random noise | **PARTIAL** | 212-frame 16 px atlas + 47 props, nearest filtering, camera zoom 2; each landmark has its own silhouette and furniture; see "What is still not production" below |
| **E** truthful evidence | static / native / visual results kept separate; parse errors fail validation; exit 0 cannot mask log errors; native PNGs; repaired capture script | **PARTIAL (honest)** | static and native are real and separated; the capture script was repaired and now derives every station from the world document; **native PNGs are BLOCKED in this sandbox** (no display server), and the offline composites are labelled supporting-only |

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
| 12 | No voids / camera bounds / obstructed routes; visual readiness | **PARTIAL** | the envelope is fully painted, camera limits come from the world size, and reachability is gated at bake time; visual polish is the remaining gap (next section) |

## What is still not production

1. **The art is authored, procedural pixel art.** It is no longer a greybox —
   every tile is a 16 px hand-coded surface with grain, blades, cracks, verge
   dithering and 16-way edge masks, and every landmark is a drawn sprite — but
   the ten exteriors share one generator. The Beacon, Crimson Gate and Castellan
   Throne carry the most individual detail; the Archive and Spiral Reliquary the
   least. A hand-painted pass would lift those two first.
2. **Landmark bakes are static.** The plaza is a stone disc with furniture; there
   is no per-landmark ground pattern beyond `f`/`v`/`y` region codes.
3. **No observed native screenshot** (environment limit, see `VALIDATION.md`).
   Everything else about the visuals is backed by the shipped atlas.
4. **Audio is untouched.** The overworld is silent apart from whatever the shared
   audio layer already does.

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
4. **`art.h01()` barely avalanched.** With dense three-integer keys, bits 8–23
   stayed tiny, so ordered dither and grain fired almost uniformly per tile and
   flat colour replaced texture. A murmur3 finaliser fixed the distribution
   (measured: 5/64 cells below 0.1 instead of 60/64).
5. **The paving tile drew a border on every cell** (and before that, four 8 px
   bevelled quadrants): a paved region resolved into a plank lattice. Now
   irregular brick courses with interior joints only, so masonry runs across
   tiles.
6. **`hollow_marches.json` had no `regions` key** while the HUD derived labels
   from landmark `region` strings; the roster and labels are now authored once.
7. Roundtrip and acceptance tests: `extends SceneTree` cannot host a
   production `app_root.tscn`, so the roundtrip moved to `extends Node` behind a
   new `--overworld-roundtrip-test` AppRoot hook; acceptance gained an isolated
   save profile, group-`player` hero lookup, a typed currency path and a
   re-fetched gate node after the return.

## Verdict

**PLAYABLE — VISUAL POLISH REMAINS.** The loop is real end-to-end, the geography
and progression are gated by data, and every behavioural claim above was
executed on a real engine. The two honest gaps are a hand-painted art pass on
two of the ten exteriors and one native screenshot, which this container cannot
produce.
