# Crossfire Archive (L03) - visual review

- Level id: `chapter_1_level_3`
- Map source: `data/levels/chapter_1_level_3.json`
- Source sha256: `c9a6ab13be74fda58ed29a2ee707ae8b7213242fb95799d0249d2cd5b3514dbd`
- Status: `COMPLETE — AWAITING OWNER VISUAL REVIEW`
- Art direction: Crossfire Archive — warm archive stacks and long sightlines

## What the native frames show

- Derived facade cells: 2770
- Landmark lights: 7
- Authored entities preserved: 77

### Improved

- The archive reads as a scriptorium: ranks of bookcases through the halls, in three variants with different spines, different gaps and the chained volume on a different shelf, plus two kinds of burnt shell where the fire reached them.
- Its walls are soot-blackened coursing, stepped well below the paving in value, with iron grilles over shelf recesses and boarded-over recesses as the wall's own language - so floor, wall and furniture are three planes instead of one brown field.
- The floor carries ash as a drift that thickens into one corner, with boardwalks and register rings where the level has reading rooms.
- Lecterns, scroll racks and braziers are placed with candles that light the shelves they face.

### Still missing against the brief

- The shelf ranks are a lattice at a fixed stride, and from any single camera position the repeat is legible as a grid.
- Between the ranks are three and four cells of bare paving with nothing in them; the rooms read as shelving with floor between it rather than as rooms with books in them.
- The level has no second storey of readable structure - no gallery, no rail, no upper face - so its walls end at the cornice and stop.

### Next correction pass

- Break the lattice with a second offset rank and a few cases standing out from the wall.
- Add a gallery rail course above the hall so the room has two readable layers.

## Cost of the layer

- Nodes: 750 (art off) -> 960 (art on)
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
