# Overworld implementation notes

## Scene entry point
- Scene: `res://game/overworld/chapter1_overworld.tscn`
- Route constant added to `AppFlow`: `OVERWORLD_SCENE`; entered via
  `AppFlow.open_overworld(payload)` which clears any stale dungeon run and shows
  the scene through `AppRoot.show_route`.
- A production-facing entry button ("BƯỚC VÀO VÙNG BIÊN / THE HOLLOW MARCHES") is
  added to the Home campaign tab.

## File layout
```
game/overworld/
  chapter1_overworld.gd / .tscn     -- main controller, scene
  chapter1_environment_art.gd       -- (intentionally absent; not a dungeon level)
  overworld_painter.gd              -- procedural terrain/road/pad painter
  overworld_state.gd                -- persistent state (position, camp, provisions,
                                      discoveries, shortcuts), persists through SaveService
  overworld_camera.gd               -- camera tuning (zoom 2x, smoothing, limits)
  overworld_gate.gd / .tscn         -- dungeon entrance interactable
  overworld_camp.gd / .tscn         -- rest-site interactable
  overworld_discovery.gd / .tscn    -- searchable discovery interactable

data/overworld/
  hollow_marches.json               -- world data: bounds, palette, landmarks, camps,
                                      discoveries, shortcuts, survival config
  landmark_registry.json            -- bijective mapping campaign_level_id <-> world_id

assets/environment/overworld/        -- (terrain textures will live here for art pass)
tools/validate_overworld_topology.py
tests/overworld/
docs/overworld/
```

## Terrain pipeline
Terrain is authored in grid space (16 px cells, 384x256 world envelope) by
`OverworldPainter` from `hollow_marches.json`. At load time the painter generates
a small TileSet texture from the palette (one 16x16 tile per distinct terrain
code, with a subtle etched border to avoid the "giant flat" look), fills the
three TileMapLayers (Ground, Decor, Collision) with the authored terrain, and
applies collision polygons to every tile painted into the Collision layer.
Player collision mask (5 = World bit 1 + Enemy bit 3) collides with the
Collision layer (layer 1 = World) without any additional static bodies.

Tile codes:
- `g`/`G`/`d` grass (walkable)
- `r`/`R` dirt / road stone (walkable)
- `s` stone/courtyard (walkable)
- `w` water (blocks; bridge `b` walks over it)
- `m` mud (walkable, potential hazard)
- `b` bridge (walkable over water)
- `c` camp pad, `L` landmark pad (walkable)
- `#` cliff / wall / rubble / valve (blocks; unlocked by shortcuts)
- `x` broken bridge (blocks; unlocked by crucible completion)
- `f`/`t` forest / thicket (blocks; pure decor).

## Entry / return loop
1. Player presses [E] on a gate (OverworldGate).
2. Controller verifies `AppFlow.is_campaign_level_unlocked(level_id)` and that any
   required overworld shortcut is open.
3. Controller calls `AppFlow.set_pending_overworld_return({return_pos, last_camp,
   world_id})` so the completion/abort screen knows to offer "Return to Marches"
   instead of "Return Home", then invokes `AppFlow.start_campaign_level(level_id)`
   (the canonical authority). The dungeon loads through the existing `main.tscn`.
4. While the run is active, AppFlow's `abort_to_home`, `return_home_after_completion`,
   and the completion choice screen honour the pending-return flag: the
   "Home" button is relabelled "VỀ VÙNG ĐẤT HOANG" and routes back through
   `AppFlow.show_route(OVERWORLD_SCENE, {from_return: true})` rather than to Home.
5. The `run_completion_ready` signal listener in the overworld grants any
   shortcut tied to the completed level (e.g. L5 opens the crucible bridge)
   via `state.open_shortcut(...)`, which repaints the barrier swath. Rewards
   and unlocks continue to flow through the canonical
   `_commit_campaign_completion()` transaction — the overworld never writes
   rewards directly.
6. On re-entry, the scene's `configure(payload)` restores the player to either
   the dungeon threshold (victory return) or their last activated camp (death
   / abandon), by reading `state.get_spawn_position()` which is populated from
   the persisted `last_camp`/`last_position`.

## Survival MVP
- One resource: **Provisions** (0–100). Start at 80, camps restore 60, discoveries
  restore 20.
- Drain is 0.4/sec in the wild, 0 in camp radius, 1.2/sec in explicit hazard
  zones (crucible valley + eastern watershed bounding bands). A fractional
  accumulator ensures sub-per-frame rates drain over time rather than rounding
  to zero.
- Provisions reaching zero does not kill the player in V1 (fairness rule); it
  leaves the player vulnerable to future attrition effects but cannot create an
  unwinnable save. Recovery is always available by returning to any camp.
- State persists under `save["overworld"]["hollow_marches"]` at schema version 1
  via `SaveService.transact_once` with per-revision transaction keys plus a
  one-time schema migration receipt.

## Shortcuts and routing
Shortcuts block their associated choke point by painting `#` (cliff) into the
Collision layer. When opened (by a dungeon clear or explicit event), the
controller erases the collision cell(s) and repaints walkable ground/road at
the same position. The topology validator in
`tools/validate_overworld_topology.py` confirms that every landmark is reachable
after the canonical unlock sequence.
