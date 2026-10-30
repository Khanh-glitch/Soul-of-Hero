# Crypt Entrance (L01) - visual review

- Level id: `chapter_1_level_1`
- Map source: `data/levels/crypt_entrance.json`
- Source sha256: `2987734ec11d675f634d013af5e272263c86187be2478282fd9eee3efd77eece`
- Status: `COMPLETE — AWAITING OWNER VISUAL REVIEW`
- Art direction: Crypt Entrance — the chapter's approachable threshold

## What the native frames show

- Derived facade cells: 2190
- Landmark lights: 6
- Authored entities preserved: 61

### Improved

- The walls of the first room are the crypt's own storey now: coursed ashlar with a dado course of arched columbarium recesses, each holding a shelf of urns, so the room is an underground burial hall rather than a box with a pattern on it.
- The hall is laid out around the level's processional axis: an aisle of dressed stone with a raised kerb on both sides and a bronze inlay down its joint, running the length of the level and crossing at the shaft.
- The burial business is furniture, not decoration: sarcophagi stand in ranks through the galleries in four kinds (an effigy chest, a plainer chest with a cut cross and a chipped corner, a two-burial chest, and one levered open), with loculi in the corners, biers, and candelabra with real lights.
- Beyond the rooms the rock is the crypt's own, in the crypt's own palette, so the level no longer floats on a shared grey field.

### Still missing against the brief

- Value structure inside the galleries is still flat: the tomb chests are cut from a stone close to the paving they stand on, so a rank of them reads as dark shapes on a dark floor rather than as carved objects with a lit top plane.
- There is still no door surround at a room mouth; transitions remain a gap in a wall.
- The columbarium dado repeats on a fixed six-cell rhythm, which is visible as a rhythm rather than as an accident of construction.

### Next correction pass

- Raise the tomb lid's top plane and darken the chest's shaded side, so a rank of them separates from the floor at 1x.
- Author a masonry jamb-and-lintel surround at each room opening, in the kit's own stone.

## Cost of the layer

- Nodes: 677 (art off) -> 748 (art on)
- Draw calls: 74 -> 81
- Static memory: 112.3 MiB with the layer on

## Frames

- `images/after_checkpoint.png`
- `images/after_checkpoint_2.png`
- `images/after_entry.png`
- `images/after_exit.png`
- `images/after_landmark.png`
- `images/after_landmark_2.png`
- `images/after_landmark_3.png`
- `images/before_checkpoint.png`
- `images/before_checkpoint_2.png`
- `images/before_entry.png`
- `images/before_exit.png`
- `images/before_landmark.png`
- `images/before_landmark_2.png`
- `images/before_landmark_3.png`
- `images/crop3x_entry.png`
- `images/crop3x_exit.png`
- `images/crop3x_landmark.png`
- `images/pair_checkpoint.png`
- `images/pair_checkpoint_2.png`
- `images/pair_entry.png`
- `images/pair_exit.png`
- `images/pair_landmark.png`
- `images/pair_landmark_2.png`
- `images/pair_landmark_3.png`

Every image above is a native Godot frame from the production `AppRoot`
campaign boot at 1280x720. `before_*` is the same map with the art layer
disabled, so the pair isolates the layer and nothing else. Nothing in this
folder is a plan diagram, a PIL preview or a generated image.
