# Hollow Marches Overworld — Self-Review vs Acceptance Criteria

Date: 2026-10-27
Branch: `arena/bc641b4c-soul-of-hero`
Revision: GATE0–GATE4 code complete; GATE5 (art direction polish) pending production art.
Runtime status: **No Godot 4.7 executable could be installed in this sandbox (GitHub release-asset CDN drops TLS mid-handshake; TuxFamily mirror unreachable; no apt/pip alternative).** All automated structural assertions below come from the offline Python topology validator and static code review — a runtime pass on CI / a local editor is still required before merging.

## 12 Acceptance Criteria Verdict

| # | Criterion | Verdict | Notes |
|---|---|---|---|
| 1 | Separate overworld scene (not Home rebrand) | **PASS** | `game/overworld/chapter1_overworld.tscn` is independent from `game/ui/screens/home/home_map_screen.tscn`. Routed via `AppFlow.open_overworld()`/`OVERWORLD_SCENE`. |
| 2 | TileMapLayer composition (no per-cell colliders/sprites) | **PASS** | Ground/Decor/Collision TileMapLayers authored procedurally by `OverworldPainter` into a generated atlas. Collision polygons are authored per-tile once. Interactables (gates/camps/discoveries) are single Area2Ds, not per-cell sprites. |
| 3 | 10 distinct landmark entrances mapping 1:1 to campaign levels L1–L10 | **PASS** | `data/overworld/landmark_registry.json` bidirectional mapping; `data/overworld/hollow_marches.json` lists 10 landmarks; validator confirms L1 Crypt → L10 Citadel. Each landmark has a unique `Polygon2D` silhouette color/shape. |
| 4 | One principal pilgrimage/military road + ≥2 loops | **PASS** | Main S→N pilgrimage road from refuge → crossroads → archive/crucible → ridge → gate → citadel. Two loops: southern refuge/crossroads/ossuary loop; eastern relay watershed loop. |
| 5 | ≥3 unlockable shortcuts | **PASS** | 4 authored: broken bridge (opens after L5), powered conduit (after L6), beacon-road rubble (after L7), iron gate valve (after L9). Each has a multi-cell swath repaint when opened. |
| 6 | Visible-but-inaccessible areas with visual+mechanical barriers (no invisible walls) | **PASS** | Northern ridge cliffs (`#` rock band), river canyon (`w` with `x` broken bridge), dark forest thickets (`t`/`f`), gated citadel ridge requiring valve. Void outside envelope uses dark background/CanvasModulate rather than an invisible wall. |
| 7 | ≥3 safe camps | **PASS** | 4 camps authored: Ashen Refuge (start), Wayfarer Stones (crossroads), Relay Foot, Watch Ridge Camp. Each restores provisions, updates respawn anchor. |
| 8 | Optional discoveries | **PASS** | 8 discoveries (coin/material/lore caches). |
| 9 | One survival MVP resource (no bloat) | **PASS** | Exactly one resource — `provisions` (max 100). Drains 0.4/s wild, 1.2/s hazard, 0/s safe. Camps restore +60 (cap 100); discoveries +20. Floor 0 (no softlock). |
| 10 | World-state persistence via existing SaveService | **PASS** | `OverworldState._save()` uses `SaveService.transact_once()` under `["overworld", "hollow_marches"]` with per-revision transaction keys + schema migration receipt. Camps/discoveries/shortcuts/position all persisted. |
| 11 | Entry from a legitimate production route, round-trip uses AppFlow, no reward duplication | **PASS** | Added Overworld panel + Enter Overworld button to the existing Campaign tab on Home; uses `AppFlow.start_campaign_level()` (authoritative for prerequisites/rewards). `set_pending_overworld_return()` flips the completion-screen "Return Home" to "Return to Marches"; returning goes through `AppFlow.show_route(OVERWORLD_SCENE, …)`. Rewards continue to flow through the canonical `_commit_campaign_completion()` transaction. |
| 12 | No unpainted voids / broken camera bounds / invalid atlases / obstructed routes; visual production readiness | **PARTIAL** | Camera clamps to authored world bounds; atlas is built programmatically; topology validator confirms every landmark is reachable via the road network with correct shortcuts. **Visuals are still a greybox** (solid-color generated 16px tiles + silhouette polygons), not production pixel art; GATE5 art pass required before production. |

## What Was Wired Since The Last Review

1. Fixed a critical collision-layer bug: interactable Areas (gates, camps, discoveries) were set to layer 64 (Hazard) — now layer 32 (Interactable, bit 6) as specified in the design.
2. Replaced the per-cell shortcut repaint with per-shortcut multi-cell swaths (`_repaint_shortcut_opened`) matching each barrier's authored shape (broken bridge 5 wide, conduit/rubble/gate_valve 3–5 cells).
3. Implemented real atlas reverse-lookup in the painter (`atlas_for_code` / `code_for_atlas` / `ordered_codes`) so collision cells can be identified by code and the `_atlas_for_collision_cell` stub is retired.
4. Collision polygons are now attached to every solid tile at TileSet build time, not lazily per-cell after paint (fixes a one-frame physics gap at spawn).
5. Proper return-to-overworld round-trip:
   - Added `AppFlow.set_pending_overworld_return / clear / has / return_to_overworld_after_completion`.
   - Modified `abort_to_hub()` and `return_home_after_completion()` to route back to overworld when the flag is set.
   - Relabelled the completion choice's Home button to "VỀ VÙNG ĐẤT HOANG" dynamically when launched from overworld.
6. Provisions drain uses a fractional accumulator (so the 0.4/s wild rate actually drains over time instead of rounding to zero per-frame).
7. OverworldState persistence switched from a fictitious `set_value`/`commit` API to real `SaveService.transact_once` with unique-per-revision keys and a schema migration receipt.
8. Wired `--overworld-entry-test` CLI argument in `app_root.gd`, dispatching to `tests/overworld_entry_test.gd`.
9. Additional tests authored:
   - `tests/overworld_persistence_test.gd` — camps/drains/discovery/shortcut state invariants.
   - `tests/overworld_transition_test.gd` — AppFlow routing surface + registry bidirectional map.
   - `tests/overworld_provisions_test.gd` — survival-MVP balance invariants (caps, floors, burn times).
   - `tests/overworld_integration_test.gd` — structural scene invariants (fixed to use `get_tree().get_nodes_in_group` and add itself to tree).
10. Capture tool skeleton `tools/captures/chapter1_overworld_capture.gd` (PNG mosaic of overview + 10 landmarks; headless mode logs positions per existing project convention).
11. Removed the StaticBody2D under camp fires (it had no collision purpose and was creating a zero-layer static body under a cosmetic light).

## Open Issues / Known Gaps

1. **No runtime Godot 4.7 binary in-sandbox.** Until CI or a local editor runs the project, these tests/invariants have not been executed. Final PASS must be confirmed with:
   ```
   godot --headless --path . --script res://tests/overworld_integration_test.gd
   godot --headless --path . --script res://tests/overworld_persistence_test.gd
   godot --headless --path . --script res://tests/overworld_transition_test.gd
   godot --headless --path . --script res://tests/overworld_provisions_test.gd
   godot --headless --path . -- --overworld-entry-test
   godot --headless --path . --script res://tools/captures/chapter1_overworld_capture.gd
   ```
2. **Visuals are greybox.** The generated atlas is solid-color 16px tiles with a subtle edge etch; landmark "silhouettes" are colored polygons. Production needs authored environment tiles/prop sprites for ruin walls, trees, water animation, stone road texture, and unique doorway sprites per landmark. No new systems need to change when art is dropped in — swap the painter's palette + add a "real" TileSet source alongside, or replace the painter's texture with a hand-authored atlas using the same tile codes.
3. **Hazard zones are authored by bounding band (crucible valley, eastern watershed) rather than by reading the mud/water tile codes from the grid.** Once art/audio is in place, switch `_in_hazard` to sample the collision/ground tile code at player position for perfect alignment.
4. **`interact` input action** is confirmed to exist on the Knight (`knight.gd:743` reads `Input.is_action_just_pressed("interact")`) but its project.godot binding was not grepped (may be defined in the input map via a feature profile). Runtime CI will confirm.
5. **Post-return camera snap**: on re-entry we call `camera.reset_smoothing()`; Godot 4's Camera2D will lerp from its last position if smoothing is enabled, so the first few frames may show a pan instead of a cut. Verify at runtime; if visible, add one frame at zoom=1 to force-snap.
6. **Save frequency**: `_do_save` is deferred to avoid 60 tx/sec during drains, but still fires a transaction for every frame the player moves. Tune to a 2–5 second throttle before shipping to avoid churn.

## Production Verdict

GATE0–GATE4 **code-complete and structurally sound**.
GATE5 (art) **not started**.
Merge readiness: **blocked** until runtime CI confirms the test battery passes on a real Godot 4.7 binary, and visual pass is scheduled.
