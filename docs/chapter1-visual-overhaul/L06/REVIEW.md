# Soul Anchor Relay (L06) - visual review

- Level id: `chapter_1_level_6`
- Map source: `data/levels/chapter_1_level_6.json`
- Source sha256: `32724da3b58cba60e1b431160ee62729baa782dee5d42f925438eb55adb084c8`
- Status: `COMPLETE — AWAITING OWNER VISUAL REVIEW`
- Art direction: Soul Anchor Relay — spectral mechanism bound in old stone

## What the native frames show

- Derived facade cells: 2720
- Landmark lights: 75
- Authored entities preserved: 73

### Improved

- The level is a distinct place: pale cool limestone, verdigris copper and cold soul-light, built from its own kit rather than the Crucible's red basalt and brass.
- Each of the three Soul Anchors stands on a dais with an inlaid relay medallion cut into the paving, framed by two pylons and four conduit posts, with its crystal monument on the axis behind the core. The Anchor is now inside something instead of being a light on open floor.
- The split diamond is legible as two lanes: conduit runs around the central block on both sides and the floor chevrons run east on the north lane and west on the south one, so the two directions the level teaches are visible without a tooltip.
- The east approach is terraced, with risers under each band and a pylon pair at every second brow, so the climb to the first Anchor is counted by the eye.
- The last Anchor's conduit circles the chamber and turns back west to the exit arch, which carries the same two-ring mark as the medallions.

### Still missing against the brief

- The east rooms and the two landings are still large and thinly furnished; the authored layer reads best where the composition is dense and weakest in the biggest empty floors.
- Wall architecture is carried by inlaid panels and lancets on broadside faces only; a wall seen end-on still shows the default course, and the transition between the two is visible.
- The relief panel on the third floor's hollow centre is rock, not architecture: the massif reads correctly but adds nothing to the return loop.

### Next correction pass

- Furnish the three landing rooms at the same density as the Anchor chambers.
- Give the exit room a second element beyond the arch and the two pylons, so the last frame of the level has its own composition.

## Cost of the layer

- Nodes: 867 (art off) -> 1098 (art on)
- Draw calls: 66 -> 73
- Static memory: 118.8 MiB with the layer on

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
