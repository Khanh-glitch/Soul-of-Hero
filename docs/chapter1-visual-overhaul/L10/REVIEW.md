# Castellan Throne (L10) - visual review

- Level id: `chapter_1_level_10`
- Map source: `data/levels/chapter_1_level_10.json`
- Source sha256: `84a5af5d70c5bffcb0e0fd72d5642fbfee4ed65ee0ccc0eb6b84c86ec8a2ae30`
- Status: `INCOMPLETE — ART DELIVERY FAILED`
- Art direction: Castellan Throne — the fallen ruler's hall

## What the native frames show

- Derived facade cells: 310
- Landmark lights: 6
- Authored entities preserved: 33

### Improved

- Axial hall with warm masonry, torch trim and the boss arena lit from the throne end.

### Still missing against the brief

- Royal symbols and damage to them are not in the derived layer.
- Phase distinction is carried by the boss, not by the room.
- The completion portal is a prop, not an architectural terminus.

### Next correction pass

- Author a throne dais: raised platform edge, damaged banner pairs, a broken crest behind the throne.
- Frame the portal with a full-height arch so completion reads as leaving through something.

## Cost of the layer

- Nodes: 640 (art off) -> 673 (art on)
- Draw calls: 97 -> 108
- Static memory: 98.3 MiB with the layer on

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
