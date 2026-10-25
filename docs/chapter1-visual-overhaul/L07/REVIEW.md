# The Failing Beacon (L07) - visual review

- Level id: `chapter_1_level_7`
- Map source: `data/levels/chapter_1_level_7.json`
- Source sha256: `d17730dbd5d4116761f32050172994d6cd73ca5a865e3bb3fc8b61ccdf1b08c9`
- Status: `COMPLETE — AWAITING OWNER VISUAL REVIEW`
- Art direction: The Failing Beacon — besieged ember-lit defence yard

## What the native frames show

- Derived facade cells: 844
- Landmark lights: 26
- Authored entities preserved: 44

### Improved

- The level has its own world: chalk-white dry limestone, blackened iron at every joint, and fire as the only saturated colour, so it reads as a garrison yard at dusk rather than as a recoloured crypt.
- The Beacon is defended by an inlaid seven-cell iron ward ring with eight burn marks on it, and framed by four fire-capped watch pillars on the ring's diagonals: the thing being defended has a boundary drawn on the floor instead of being a light on open paving.
- The four approaches the waves use are the most legible thing in the room, and they are floor tiles: a raised chalk apron with an iron edge and four three-cell causeways cut open where they meet it. Nothing is placed within a cell of them, so the lanes stay free while reading as roads.
- The middle of the hall has four drill squares with four different garrison jobs on them - a muster line, a fire station with the cistern and woodpile, a dressing station and an armoury - so the composition is not symmetry.
- The perimeter is furnished all the way round, including the south boundary whose face the camera never sees: crates, barrels, sandbags, firewood and torn banners at the wall feet, buttresses, arrow slits and fire baskets on the broadside faces.

### Still missing against the brief

- The Beacon's own light and the entity's glow still wash the centre of the yard to a pale cream, which flattens the ward ring at gameplay zoom. The correction pass cut the authored ember energy by two thirds, which fixed the furnace, but the centre is still the least legible part of the room.
- The drill squares read more strongly as prop clusters than as painted squares: the outline is a floor tile and at 1x it disappears under the props that define it.
- The three waves are runtime behaviour and are not photographable as architecture; the frames show the yard, not the wave pacing.

### Next correction pass

- Give the Beacon's cell a darker apron so the entity's glow has something to fall on.
- Consider a second, coarser floor mark for the drill squares so they survive the props standing on them.

## Cost of the layer

- Nodes: 665 (art off) -> 908 (art on)
- Draw calls: 92 -> 120
- Static memory: 116.0 MiB with the layer on

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
