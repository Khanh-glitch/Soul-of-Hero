# The Failing Beacon (L07) - visual review

- Level id: `chapter_1_level_7`
- Map source: `data/levels/chapter_1_level_7.json`
- Source sha256: `d17730dbd5d4116761f32050172994d6cd73ca5a865e3bb3fc8b61ccdf1b08c9`
- Status: `INCOMPLETE — ART DELIVERY FAILED`
- Art direction: The Failing Beacon — besieged ember-lit defence yard

## What the native frames show

- Derived facade cells: 428
- Landmark lights: 8
- Authored entities preserved: 44

### Improved

- The beacon is the brightest thing on the floor and the ember palette supports it; no new solids were added, so enemy lanes are untouched.

### Still missing against the brief

- Siege damage is absent from the derived layer: no collapsed courses, no rubble spills, no scorch.
- The beacon itself is a light, not a structure.

### Next correction pass

- Add a damaged coping pass: every few bays the cap course is missing or displaced.
- Ring the beacon with a broken masonry base so the light has a source.

## Cost of the layer

- Nodes: 663 (art off) -> 678 (art on)
- Draw calls: 92 -> 103
- Static memory: 107.8 MiB with the layer on

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
