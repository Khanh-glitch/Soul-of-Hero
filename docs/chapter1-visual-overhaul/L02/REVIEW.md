# Ossuary Fork (L02) - visual review

- Level id: `chapter_1_level_2`
- Map source: `data/levels/chapter_1_level_2.json`
- Source sha256: `aea1a4b2fd315cc8bf6f785897726f4e1ff48719d1d9b0d9055e48ffc94b9e0f`
- Status: `INCOMPLETE — ART DELIVERY FAILED`
- Art direction: Ossuary Fork — burial galleries, bone masonry

## What the native frames show

- Derived facade cells: 1835
- Landmark lights: 12
- Authored entities preserved: 64

### Improved

- The burial gallery keeps its authored bone piles and urns and now sits inside brick walls with a coping line and contact shadow.
- Warm bone-toned palette separates this floor from Level 1 without changing the map.

### Still missing against the brief

- Burial niches are not architectural yet: the bone galleries are props on a floor, not constructed recesses in a wall.
- Safe and risky branches read the same; the brief asked for the environment to signal which fork is dangerous.

### Next correction pass

- Add a niche band on wall faces (a recessed dark tile framed by two jambs) at fixed intervals.
- Differentiate the branches with a blood channel or rubble fall on the risky side.

## Cost of the layer

- Nodes: 695 (art off) -> 716 (art on)
- Draw calls: 72 -> 97
- Static memory: 133.3 MiB with the layer on

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
