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

- The middle of the halls is a hypostyle now - piers on an eight-cell lattice with votive urns on the line between them and dais drums where four bays meet - so the densest camera position is a room with colonnades running out of frame instead of a field of paving.
- The four secondary turns are five-by-five discs of two floor families, so they read as patches of a different stone rather than as smaller spirals.
- The free-standing columns stand on an eight-cell lattice, and the bays that were lost come out as broken stumps - a stepped break, the bed of the stone exposed, the fallen drums at the foot - in clusters rather than sprinkled, so a hall reads as a colonnade with bays missing rather than as a grid.
- The intact columns are solid: the hero and the enemies cannot walk through architecture that reads as load-bearing. The stumps are not, which is what makes the collapsed bays legible as the way across.
- The wall piers and the free-standing ones are the same frame, so a column in the middle of a hall is lit and modelled like one engaged to a wall.

### Next correction pass

- Break the column stride further with a second, heavier order at the bay crossings.
- Draw the secondary turns as spirals, not as discs - the floor families exist for it.

## Cost of the layer

- Nodes: 779 (art off) -> 1023 (art on)
- Draw calls: 72 -> 80
- Static memory: 119.9 MiB with the layer on

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
