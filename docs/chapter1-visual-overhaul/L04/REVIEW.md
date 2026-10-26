# Spiral Reliquary (L04) - visual review

- Level id: `chapter_1_level_4`
- Map source: `data/levels/chapter_1_level_4.json`
- Source sha256: `11d82555e179a76bd9e7bbd6ed16e6a0fa76988d200241c49a15cb58b6740ca4`
- Status: `COMPLETE — AWAITING OWNER VISUAL REVIEW`
- Art direction: Spiral Reliquary — monumental concentric stone

## What the native frames show

- Derived facade cells: 2866
- Landmark lights: 9
- Authored entities preserved: 74

### Improved

- The reliquary has verticals now: engaged piers with fluted ivory shafts, bronze astragals, jade capitals and moulded bases stand along the walls at a nine-cell stride, so the halls have bays to count and depth to see.
- Walls are a dark warm plaster and the ivory is what the piers, the shrine band and the paving are made of, so the floor is a ground plane rather than a continuation of the wall.
- The processional route is walked out over the map's own floor and inlaid in darker paving with a bronze lozenge in every cell, so the way to the relic is legible from across the hall without a painted stripe.
- The spiral is cut around the shrine's own cell and the relic stands behind the live objective, so the thing the level is named for is what the floor turns around; the five chapels each have a bronze-framed shrine niche in the wall behind them.

### Still missing against the brief

- Outside the route and the shrine, the halls are still large and sparsely furnished: at the densest camera position the middle of the frame is paving.
- The four secondary turns are five-by-five discs of two floor families, so they read as patches of a different stone rather than as smaller spirals.
- The piers stand on the wall line only; there is no free-standing colonnade and no arcade, so the room's depth comes from one plane of verticals.

### Next correction pass

- Furnish the middle of the two largest halls at the density of the shrine court.
- Draw the secondary turns as spirals, not as discs - the floor families exist for it.

## Cost of the layer

- Nodes: 780 (art off) -> 860 (art on)
- Draw calls: 72 -> 79
- Static memory: 118.8 MiB with the layer on

## Frames

- `images/after_checkpoint.png`
- `images/after_checkpoint_2.png`
- `images/after_entry.png`
- `images/after_exit.png`
- `images/after_landmark.png`
- `images/after_landmark_2.png`
- `images/after_landmark_3.png`
- `images/after_landmark_4.png`
- `images/before_checkpoint.png`
- `images/before_checkpoint_2.png`
- `images/before_entry.png`
- `images/before_exit.png`
- `images/before_landmark.png`
- `images/before_landmark_2.png`
- `images/before_landmark_3.png`
- `images/before_landmark_4.png`
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

Every image above is a native Godot frame from the production `AppRoot`
campaign boot at 1280x720. `before_*` is the same map with the art layer
disabled, so the pair isolates the layer and nothing else. Nothing in this
folder is a plan diagram, a PIL preview or a generated image.
