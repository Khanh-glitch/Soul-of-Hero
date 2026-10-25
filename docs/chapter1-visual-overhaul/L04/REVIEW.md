# Spiral Reliquary (L04) - visual review

- Level id: `chapter_1_level_4`
- Map source: `data/levels/chapter_1_level_4.json`
- Source sha256: `86ea962af372f20f4779b394b2506b3d643e96266755cee34e13e5d3a939f6f5`
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

- Nodes: 776 (art off) -> 802 (art on)
- Draw calls: 72 -> 77
- Static memory: 111.3 MiB with the layer on

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
