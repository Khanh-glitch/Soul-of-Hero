# Overworld implementation notes

> Status line, so this file cannot drift into aspiration: every statement below
> describes code that exists **in this branch**. Runtime claims are marked
> `[verified]` (executed) or `[unverified]` (written and parsed, not yet run);
> see `VALIDATION.md` for what was actually executed and where.

## Entry point

- Scene: `res://game/overworld/chapter1_overworld.tscn` — a `Node2D` with
  `Entities` (y-sorted), `Places` (y-sorted), a dark `Backdrop` CanvasLayer and
  a `CanvasModulate`.
- `AppFlow.OVERWORLD_SCENE` points at it. Entry is `AppFlow.open_overworld(payload)`,
  which clears stale run state and routes through `AppRoot.show_route`.
- `AppFlow.set_pending_overworld_return(payload)` is called the moment a
  threshold is entered, so the normal completion/abort screens can route back
  to the Marches instead of dumping the player in Home.
- Home entry: `%EnterOverworldButton` in the campaign tab.

## Files

```
game/overworld/
  chapter1_overworld.gd / .tscn   controller: build order, player, thresholds,
                                  camps, discoveries, survival tick, hand-off
  overworld_world.gd              decodes the baked RLE layers, builds the three
                                  TileMapLayers, paints props, owns collision and
                                  the shortcut carve
  overworld_state.gd              persistence (provisions, camps, discoveries,
                                  shortcuts, position) through SaveService
  overworld_tiles.gd              TileSet builder + token decoder + stable variant
                                  index (shared with tools/overworld/preview.py)
  overworld_gate.gd               dungeon threshold (Area2D, player_interactable)
  overworld_camp.gd               rest site (Area2D, player_interactable)
  overworld_discovery.gd          find (Area2D, player_interactable)
  overworld_hud.gd                CanvasLayer 20: region, provisions bar, counts,
                                  prompt, hint

tools/overworld/
  art.py          palette + primitives → overworld_tiles.png / .json, light_radial
  art_props.py    47 props → overworld_props.png / .json
  author.py       the single source of geography: fields, landforms, roads,
                  rivers, camps, discoveries, shortcuts, landmarks; owns the
                  reachability gate and writes the baked layers
  preview.py      offline Pillow compositor (same atlas, same variant hash)

data/overworld/
  hollow_marches.json          world document (bounds, landmarks, camps,
                               discoveries, shortcuts incl. carve boxes, survival,
                               hazards, regions)
  hollow_marches_layers.json   baked RLE: ground / detail / solid
  hollow_marches_props.json    baked prop placements
                               (no preview PNG is committed: render any crop with
                                `python3 tools/overworld/preview.py --at x,y,w,h`)
  overworld_tiles.json         frame index + symbol→frame codes
  overworld_props.json         prop frame atlas
  landmark_registry.json       campaign_level_id ↔ world_id

assets/environment/overworld/
  overworld_tiles.png          212 frames, 512x112, 16 px grid
  overworld_props.png          47 frames, 512x370

tools/overworld/evidence.py     renders the capture station list offline from the
                                shipped atlas → docs/overworld/evidence/*.png
                                (supporting evidence, never a native screenshot)
```

There is **no** `overworld_painter.gd`, `overworld_camera.gd`, or per-place
`.tscn` any more. The greybox ColorRect painter and the runtime camera node were
deleted: terrain is a real `TileMapLayer` stack and the camera is the Knight's
own `Camera2D` with limits derived from the world size.

## Build order (observable, not timed)

`chapter1_overworld.gd` builds in one deferred call and advances
`BuildStage`: `IDLE → LOADING_DATA → PAINTING_TERRAIN → SPAWNING_PLAYER →
SPAWNING_PLACES → RESTORING_PROGRESS → READY` (or `FAILED` with `build_error`).
`is_world_ready()` and the `world_ready` signal are the contract; **no test
waits on a frame count.**

Terrain painting is ~98k tile cells across three layers plus ~4.4k prop sprites,
which is why the build is deferred rather than done inside `_ready()`: touching
autoloads and the RenderingServer mid-tree is a race.

## Terrain pipeline

1. `art.py` emits one packed atlas for the whole overworld: a 16 px grid, with
   every ground/detail/solid family as a row of frames and a 16-way neighbour
   mask for anything that needs edging (cliffs, water banks, road edges,
   canopies). The mask is *interior* bits, so art that only draws on an exposed
   side must invert it (`opened_mask()`) — otherwise every tile paints its own
   outline and a road or a copse becomes a grid of 16 px boxes.
2. `author.py` paints a 384×256 grid in three ASCII layers (`ground`, `detail`,
   `solid`), then runs a flood fill from the refuge with shortcuts both closed
   and open. If any threshold, camp or discovery is unreachable, **the bake
   refuses to write**.
3. `bake()` RLEs the three layers to `hollow_marches_layers.json`.
4. `OverworldWorld` decodes them; the solid layer gets a TileSet physics layer,
   so cliffs, walls, canopies and deep water collide for free.
5. Props are `Sprite2D`s with `AtlasTexture` regions, parented into the y-sorted
   `Entities` node so the Knight can walk behind a tower and in front of a tree.

Tokens are `symbol` or `symbol+hexmask` (e.g. `#c`, `T3`, `!f`). Solid symbols
are `#` cliff, `W` wall, `T` canopy, `!` deep-water blocker, `R` rubble.

Ground families carry several variants per code (`d` dirt, `,` grass, `;` moor,
`g` gravel, `r` rock, `f` flagstone …) and the runtime picks one with the stable
per-cell hash shared with `preview.py`, so a wide apron does not visibly repeat.
Surfaces are grained in 2 px clusters rather than single pixels: the camera runs
at zoom 2, which turns a per-pixel speckle into noise and a per-tile border into
a visible lattice.

## Ground variation is chosen in patches, not per tile

A ground code names a family of atlas frames (`f` → `floor0…floor3`, `r` →
`rock0…rock3`). Which member a cell gets comes from `OverworldTiles.variant_index`,
mirrored exactly in `tools/overworld/preview.py` so the offline composite is the
game.

That choice used to be per tile, and once the four stone frames were given real
tone differences it turned every plaza into a checkerboard: each 16 px cell was
its own shade, and at the camera's 2× zoom the eye reads the grid, not the
weathering. The index is now a hash of a **3×3-tile cluster**, with one tile in
six borrowing a neighbouring cluster's tone, so a tone runs for a few tiles and
its outline is ragged. A paved region reads as damp patches and pale replacements
rather than as noise.

`ground_flagstone` carries the rest of that work: a 4×4 moss patch worn through
the joints, a slab that has dropped out of its course with a lit lip on the north
and west, or a paler stone set in to repair a hole. One of the three per tile, so
three of the four floor variants have something legible from across the screen.
`ground_rock` gained a darker seam that runs out of the tile.

## The frame report

`tools/captures/frame_report.gd` turns a rendered image into text — colour count,
edge density, dominant-tone share, luminance spread, a four-entry palette and a
32×16 luminance map — and the capture prints it for every station. It exists
because this project's CI cannot hand its own PNGs back: without it, "the station
passed" only means a file of the right size exists, which is how an overview that
was a 10× close-up of four tiles passed for three runs.

`tools/captures/frame_report_probe.gd` runs the same report over PNGs on disk,
headlessly, so the metric can be checked without a display server.

## Two scatter passes, and what the bake refuses

`paint_scatter()` runs twice over the same grid, for two different reasons.

The first pass places everything that **collides** — trees, columns, statues,
camp tents, sarcophagi, wall stubs. It keeps a two-tile corridor clear around
every walking lane, so a road can never be pinched by a prop; the corridor is
what left the wide flagstone plazas empty, because an approach lane runs through
the middle of every one of them.

The second pass fills that stone with **non-collider** frames only (`rock_a`,
`rock_b`, `barrel`, `grave_cross`, `gravestone`, `bush`), so it can use a
one-tile corridor — the lane cells and nothing else — and still cannot narrow a
road or trap the player. Its density is clustered: a three-tile block that is
"hot" carries a debris field, the rest stays near-empty. A uniform sprinkle of
single rocks reads as noise at 2x; a cluster reads as something having fallen.

Both passes skip `interaction_cells()` — the landmark thresholds, camp rest
cells, discovery cells and the spawn. This is not cosmetic: `validate()` found a
pine standing exactly on `d_ossuary_stash`, which would have held the player off
the cell that claims it. `author.py` now asserts, before it will write anything:

* every prop frame exists in the atlas (shortcut ids excepted, since the runtime
  resolves `short_bridge` → `short_bridge_broken`),
* no collider-bearing frame stands in a walking lane (trees, carts, sarcophagi),
* no collider-bearing frame covers an interaction cell.

The second and third rules were checked against deliberately broken worlds and
both fire; a non-collider frame on the same cell is correctly allowed.

## Landmarks and framing

A landmark's sprite is placed at its authored `(tx, ty)` with its **base** on the
north edge of the plaza, so the building sits at the end of its paved approach
rather than five tiles behind it. The world document also carries a
`capture_offset` per landmark, derived from the height of the sprite standing
there (`prop_height_tiles()` reads the generated prop index); the capture script
and the offline renderer both use it, so a station always frames the building the
player is walking towards. `regions` names the ten regions and their anchors; the
HUD label resolves a position to its nearest landmark and reads the display name
from that table.

## Shortcuts are world surgery, not sprite swaps

Each shortcut owns an authored rectangle (`carve` in `hollow_marches.json`),
produced by `author.py` from the same numbers it draws with, and validated at
bake time to be **fully solid while closed**. Opening one:

- swaps the prop to its second frame (`short_bridge_broken → short_bridge_fixed`),
- zeroes the prop body's collision layer,
- clears exactly that rectangle in the solid grid and in the TileMapLayer, and
- remembers the token each cell held, so closing restores the terrain byte for
  byte instead of drawing a guess.

Opening is persisted twice over: as a flag in the overworld state and as a
fallback derived from the campaign level that grants it
(`OverworldState.is_shortcut_open(id, app_flow)`), so an existing profile that
already cleared L5 keeps its bridge.

## Survival

Provisions (max 100, start 80) drain at the authored rates — 0.22/s wild,
0.0/s at a camp, 0.75/s inside a hazard rect. Camps restore 60 and set the
respawn anchor; discoveries restore 20 or the authored `restore` ratio. An
empty pack scales move speed to 0.66× — it never blocks the march.

## Interaction

The Marches use the project's existing interaction contract and invent nothing:
`KnightController` resolves `player_interactable` on a left-click or the
`interact` action. Gates, camps and discoveries join that group and implement
`can_interact()` / `interact(player)`.

## Persistence

`OverworldState` reads and writes `["overworld", "hollow_marches"]` through
`SaveService.patch_state_path`, schema 2. A newer schema in the file is ignored
rather than reinterpreted; the world then boots with authored defaults.
Discovery rewards are one-shot through `transact_once("overworld:discovery:<id>")`,
so a re-entry, reload or replay cannot pay twice.

Return policy, in one place (`_apply_payload_spawn`):

- cleared level → back at the threshold you entered by,
- uncleared level (death or retreat) → back at the last camp you lit,
- no valid point → nearest walkable cell, then the authored spawn.
