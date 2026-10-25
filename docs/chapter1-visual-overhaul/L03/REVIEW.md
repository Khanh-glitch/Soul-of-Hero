# Crossfire Archive (L03) - visual review

- Level id: `chapter_1_level_3`
- Map source: `data/levels/chapter_1_level_3.json`
- Source sha256: `189ba341a2649731b56ea304ce5c4cc7ac61d56bbaf404b5a2bafab38b3b869b`
- Status: `TECHNICALLY VALID — VISUAL NOT READY`
- Art direction: Crossfire Archive — warm archive stacks and long sightlines

## What the native frames show

- Derived facade cells: 1318
- Landmark lights: 13
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

- Nodes: 750 (art off) -> 771 (art on)
- Draw calls: 69 -> 80
- Static memory: 109.9 MiB with the layer on

## Frames

- `images/after_checkpoint.png`
- `images/after_entry.png`
- `images/after_exit.png`
- `images/after_landmark.png`
- `images/before_checkpoint.png`
- `images/before_entry.png`
- `images/before_exit.png`
- `images/before_landmark.png`
- `images/crop3x_entry.png`
- `images/crop3x_exit.png`
- `images/crop3x_landmark.png`
- `images/pair_checkpoint.png`
- `images/pair_entry.png`
- `images/pair_exit.png`
- `images/pair_landmark.png`

Every image above is a native Godot frame from the production `AppRoot`
campaign boot at 1280x720. `before_*` is the same map with the art layer
disabled, so the pair isolates the layer and nothing else. Nothing in this
folder is a plan diagram, a PIL preview or a generated image.
