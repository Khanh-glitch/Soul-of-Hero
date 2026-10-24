# Divided Reliquary (L08) - visual review

- Level id: `chapter_1_level_8`
- Map source: `data/levels/chapter_1_level_8.json`
- Source sha256: `6dd0317f0e2ba2fdaa1ad4f570f9c3f1180717466c8f77496bd8a0dd4612747a`
- Status: `TECHNICALLY VALID — VISUAL NOT READY`
- Art direction: Divided Reliquary — two opposed wings around one decision

## What the native frames show

- Derived facade cells: 494
- Landmark lights: 10
- Authored entities preserved: 44

### Improved

- Cool neutral palette and masonry framing keep both wings consistent while leaving the exclusive branch logic untouched.

### Still missing against the brief

- The two wings are separated only by hue; the decision chamber is not marked as a threshold.
- The vault is not visible as an earned destination.

### Next correction pass

- Give each wing its own trim rhythm and floor family so the player can tell them apart at a glance.
- Put a heavier threshold course at the decision chamber mouth.

## Cost of the layer

- Nodes: 680 (art off) -> 697 (art on)
- Draw calls: 110 -> 121
- Static memory: 103.9 MiB with the layer on

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
