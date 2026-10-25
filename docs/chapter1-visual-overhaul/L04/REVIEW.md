# Spiral Reliquary (L04) - visual review

- Level id: `chapter_1_level_4`
- Map source: `data/levels/chapter_1_level_4.json`
- Source sha256: `0f46c997ef129c78ef1fd1b5530ed49c7c5ba5bf21226f4821f5c4e4de710b5d`
- Status: `INCOMPLETE — ART DELIVERY FAILED`
- Art direction: Spiral Reliquary — monumental concentric stone

## What the native frames show

- Derived facade cells: 1403
- Landmark lights: 13
- Authored entities preserved: 74

### Improved

- Neutral stone palette and a paved margin make the reliquary floor read as cut stone rather than a tile grid.

### Still missing against the brief

- The concentric ritual stonework and the central landmark the brief asks for are in the plan, not in the picture.
- The final apse is architecturally identical to the rest of the floor.

### Next correction pass

- Ring the central landmark with a concentric band of paving and four cardinal inlays.
- Give the apse a distinct floor family and a heavier coping so the room change is visible from the doorway.

## Cost of the layer

- Nodes: 781 (art off) -> 799 (art on)
- Draw calls: 72 -> 77
- Static memory: 111.2 MiB with the layer on

## Frames

- `images/after_checkpoint.png`
- `images/after_checkpoint_2.png`
- `images/after_entry.png`
- `images/after_exit.png`
- `images/after_landmark.png`
- `images/after_landmark_2.png`
- `images/after_landmark_3.png`
- `images/after_landmark_4.png`
- `images/before_checkpoint.png`
- `images/before_checkpoint_2.png`
- `images/before_entry.png`
- `images/before_exit.png`
- `images/before_landmark.png`
- `images/before_landmark_2.png`
- `images/before_landmark_3.png`
- `images/before_landmark_4.png`
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
- `images/pair_landmark_4.png`

Every image above is a native Godot frame from the production `AppRoot`
campaign boot at 1280x720. `before_*` is the same map with the art layer
disabled, so the pair isolates the layer and nothing else. Nothing in this
folder is a plan diagram, a PIL preview or a generated image.
