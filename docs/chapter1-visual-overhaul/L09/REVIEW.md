# The Crimson Gate (L09) - visual review

- Level id: `chapter_1_level_9`
- Map source: `data/levels/chapter_1_level_9.json`
- Source sha256: `40b5d7dfe1ba4a93498562bf934591e38c1da8ed902a777d2b46e5ba5abc3227`
- Status: `TECHNICALLY VALID — VISUAL NOT READY`
- Art direction: Crimson Gate — fortress seal chamber

## What the native frames show

- Derived facade cells: 416
- Landmark lights: 6
- Authored entities preserved: 40

### Improved

- Crimson palette plus focal red light at the gate; the gate hall no longer loses its floor to near-black.

### Still missing against the brief

- The three seal chambers are not legible as separate chambers with seal-state feedback.
- Fortress scale is a plan property, not a picture property yet.

### Next correction pass

- Build three distinct seal housings, each with its own lit ring that can show state.
- Raise the gate wall two courses above the rest of the room so the frame reads as fortification.

## Cost of the layer

- Nodes: 719 (art off) -> 732 (art on)
- Draw calls: 106 -> 113
- Static memory: 101.0 MiB with the layer on

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
