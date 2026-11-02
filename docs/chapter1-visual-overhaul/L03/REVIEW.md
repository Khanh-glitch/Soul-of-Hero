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

- The cases stand in rows with cross aisles, not on a lattice: a run of three or four cases along a row, a gap every fourth bay and a wider aisle every fifth, so the room has a direction to read and the player has somewhere to fight.
- Above the shelf courses the wall carries a gallery: an opening in shadow with ledgers inside it, an iron rail on posts and a lit sill under it, so the reading rooms have a storey above the floor you are standing on.
- The aisles between the runs are clear and counted: no rank is more than four cases long before a way through it, which is also what stops the rank reading as wallpaper.

### Next correction pass

- Give two of the runs a reading table and a lamp between the stacks, so the rooms have a place to stand still.

## Cost of the layer

- Nodes: 750 (art off) -> 957 (art on)
- Draw calls: 69 -> 83
- Static memory: 119.8 MiB with the layer on

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
