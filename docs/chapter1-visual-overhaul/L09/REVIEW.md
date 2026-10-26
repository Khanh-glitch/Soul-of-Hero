# The Crimson Gate (L09) - visual review

- Level id: `chapter_1_level_9`
- Map source: `data/levels/chapter_1_level_9.json`
- Source sha256: `40b5d7dfe1ba4a93498562bf934591e38c1da8ed902a777d2b46e5ba5abc3227`
- Status: `COMPLETE — AWAITING OWNER VISUAL REVIEW`
- Art direction: Crimson Gate — fortress seal chamber

## What the native frames show

- Derived facade cells: 810
- Landmark lights: 29
- Authored entities preserved: 40

### Improved

- A gatehouse rather than a hall: oxblood basalt, riveted iron plating and bone trophies, deliberately close to the Crucible's hue and nothing else.
- The gate is inside the camera frame. The monumental arch and its two towers are built up from the arena floor instead of hung on the top wall, because the camera stops at the map edge; its cold blue-white opening is the level's only cold light and is visible from anywhere in the nave.
- The three gate seals are three fixtures with three silhouettes - a bronze bell on an iron gallows, a burning cauldron on three legs, the great winch wheel - each on the same stone platform inside its own inlaid iron-and-blood floor ring, so they read as three locks on one gate instead of three copies of a marker.
- No prop stands on a seal cell or beside one, and the validator re-checks every placement against the protected cell set.
- A riveted iron aisle runs the building's whole axis from the spawn to the gate with cross bands where the arms meet the nave, so the level's cross plan is drawn on the floor.

### Still missing against the brief

- The paving still reads as brickwork at gameplay zoom: the flag joints are regular enough to form a grid, and the first native frames show it as a woven texture rather than as large slabs.
- The three seal arms are architecturally identical apart from their station, because the map gives them the same geometry; the art differentiates them by fixture and light only.
- The portcullis inside the gate arch reads at gameplay scale but disappears in a thumbnail.

### Next correction pass

- The paving is the one thing worth a second structural attempt if the owner asks: fewer, larger joints and per-slab highlights rather than a repeating course.
- The gate's chains could be extended down the arena walls to tie the arch into the room.

## Cost of the layer

- Nodes: 720 (art off) -> 851 (art on)
- Draw calls: 108 -> 130
- Static memory: 109.6 MiB with the layer on

## Frames

- `images/after_boss.png`
- `images/after_checkpoint.png`
- `images/after_entry.png`
- `images/after_exit.png`
- `images/before_boss.png`
- `images/before_checkpoint.png`
- `images/before_entry.png`
- `images/before_exit.png`
- `images/crop3x_boss.png`
- `images/crop3x_entry.png`
- `images/crop3x_exit.png`
- `images/pair_boss.png`
- `images/pair_checkpoint.png`
- `images/pair_entry.png`
- `images/pair_exit.png`

Every image above is a native Godot frame from the production `AppRoot`
campaign boot at 1280x720. `before_*` is the same map with the art layer
disabled, so the pair isolates the layer and nothing else. Nothing in this
folder is a plan diagram, a PIL preview or a generated image.
