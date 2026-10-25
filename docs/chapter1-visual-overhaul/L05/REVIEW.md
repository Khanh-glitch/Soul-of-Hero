# Blood Crucible (L05) - visual review

- Level id: `chapter_1_level_5`
- Map source: `data/levels/chapter_1_level_5.json`
- Source sha256: `2b72582559654d678fe2e1f5728f0dea5584d704b2ee1f482a977af260a8fdb6`
- Status: `TECHNICALLY VALID — VISUAL NOT READY`
- Art direction: Blood Crucible — dark ceremonial stone and sacrificial masonry

## What the native frames show

- Derived facade cells: 3303
- Landmark lights: 29
- Authored entities preserved: 83

### Improved

- Blood-red masonry, wall torches with lights and lit pools replace the previous flat slate hall; the hall now has depth and a horizon line.
- Walls no longer read as see-through bricks: transparent authored wall tiles are backed with solid stone.

### Still missing against the brief

- The crucible basin is still not legible from the spawn station; the brief's first-frame landmark is missing.
- The forecourt, the court and the boss arena still look like the same room with different props.

### Next correction pass

- Compose the spawn frame around the processional arch and the basin rim so both are visible on arrival.
- Give each floor its own floor family and trim rhythm so the three-storey progression is legible.

## Cost of the layer

- Nodes: 870 (art off) -> 1073 (art on)
- Draw calls: 103 -> 110
- Static memory: 119.6 MiB with the layer on

## Frames

- `images/after_boss.png`
- `images/after_checkpoint.png`
- `images/after_entry.png`
- `images/after_exit.png`
- `images/after_landmark.png`
- `images/before_boss.png`
- `images/before_checkpoint.png`
- `images/before_entry.png`
- `images/before_exit.png`
- `images/before_landmark.png`
- `images/crop3x_boss.png`
- `images/crop3x_entry.png`
- `images/crop3x_exit.png`
- `images/crop3x_landmark.png`
- `images/pair_boss.png`
- `images/pair_checkpoint.png`
- `images/pair_entry.png`
- `images/pair_exit.png`
- `images/pair_landmark.png`

Every image above is a native Godot frame from the production `AppRoot`
campaign boot at 1280x720. `before_*` is the same map with the art layer
disabled, so the pair isolates the layer and nothing else. Nothing in this
folder is a plan diagram, a PIL preview or a generated image.
