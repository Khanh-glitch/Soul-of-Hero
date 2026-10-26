# Crossfire Archive (L03) - visual review

- Level id: `chapter_1_level_3`
- Map source: `data/levels/chapter_1_level_3.json`
- Source sha256: `c9a6ab13be74fda58ed29a2ee707ae8b7213242fb95799d0249d2cd5b3514dbd`
- Status: `INCOMPLETE — ART DELIVERY FAILED`
- Art direction: Crossfire Archive — warm archive stacks and long sightlines

## What the native frames show

- Derived facade cells: 2770
- Landmark lights: 7
- Authored entities preserved: 77

### Improved

- Amber palette and masonry framing make the archive hall warmer while leaving the production map and its collision untouched.

### Still missing against the brief

- The archive identity lives in scattered shelf props; there are no constructed shelf bays, no reading alcoves, no gallery rail.
- The Gate 3 geometry was deliberately not promoted, so the room still reads as a hall with books in it.

### Next correction pass

- Build shelf bays from the decor sheet against wall faces, three tiles wide, with a lintel course.
- Add a gallery rail course above the hall to give the room a second storey of readable structure.

## Cost of the layer

- Nodes: 750 (art off) -> 961 (art on)
- Draw calls: 69 -> 83
- Static memory: 119.7 MiB with the layer on

## Frames

- `images/after_checkpoint.png`
- `images/after_checkpoint_2.png`
- `images/after_entry.png`
- `images/after_exit.png`
- `images/after_landmark.png`
- `images/after_landmark_2.png`
- `images/after_landmark_3.png`
- `images/after_landmark_4.png`
- `images/after_landmark_5.png`
- `images/before_checkpoint.png`
- `images/before_checkpoint_2.png`
- `images/before_entry.png`
- `images/before_exit.png`
- `images/before_landmark.png`
- `images/before_landmark_2.png`
- `images/before_landmark_3.png`
- `images/before_landmark_4.png`
- `images/before_landmark_5.png`
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
- `images/pair_landmark_5.png`

Every image above is a native Godot frame from the production `AppRoot`
campaign boot at 1280x720. `before_*` is the same map with the art layer
disabled, so the pair isolates the layer and nothing else. Nothing in this
folder is a plan diagram, a PIL preview or a generated image.
