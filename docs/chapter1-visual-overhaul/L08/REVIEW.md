# Divided Reliquary (L08) - visual review

- Level id: `chapter_1_level_8`
- Map source: `data/levels/chapter_1_level_8.json`
- Source sha256: `6dd0317f0e2ba2fdaa1ad4f570f9c3f1180717466c8f77496bd8a0dd4612747a`
- Status: `COMPLETE — AWAITING OWNER VISUAL REVIEW`
- Art direction: Divided Reliquary — two opposed wings around one decision

## What the native frames show

- Derived facade cells: 1114
- Landmark lights: 45
- Authored entities preserved: 44

### Improved

- One building, two wings that are separate places to fight: cold black iron, bone and lit niches west; wine velvet, gilt, a running fountain and smashed marble east. The shared base is pale marble, which is what makes it read as one divided reliquary rather than two rooms.
- The choice is drawn on the floor: each sealed door has its branch's emblem inlaid in front of it - an iron disc with a scythe, a gilt-ringed disc with a chalice - same construction, different sigil, so the player reads the branch before touching the seal.
- Nothing may stand on, beside or in front of a seal: the placer refuses the protected cell set and the validator re-checks it, so there is no decorative bypass.
- The Reaper wing is a colonnade of fluted columns and hooded statues with iron grilles over cold-lit niches, sarcophagi along every wall, a bier and a grave cut into the floor in iron inlay.
- The vault is a room, not a corridor end: a raised dais with the elite's sigil, the founders' sarcophagi either side of the chest, and a pointed exit arch with a cold, lit opening and two lamps inside it.

### Still missing against the brief

- The two wings share one plan: the differentiation is material and furniture, which is the honest limit of a symmetric map.
- Flagstone joints are regular enough to read as a grid at 1x zoom; the veining that was meant to break it up had to be made faint because a bright vein tiled into wallpaper.
- The east wing's damage is authored as broken paving and rubble rather than structural collapse, because the map has one floor layer.

### Next correction pass

- If the owner wants the wings further apart, the cheapest honest lever is the wing's ceiling light colour, not more props.
- The reaper statue's scythe reads at 3x and merges into the robe at 1x; it may want a paler blade.

## Cost of the layer

- Nodes: 680 (art off) -> 829 (art on)
- Draw calls: 115 -> 128
- Static memory: 112.8 MiB with the layer on

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
