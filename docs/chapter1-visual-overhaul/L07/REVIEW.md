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

- The Beacon's own light no longer washes its own cell out: the cell it stands on was a ward tile on swept chalk at 193, which made it the brightest thing in the room. It now stands on a fire-scoured hearth at 71.7, with the ward ring's iron band at 90.8 ringing it and the apron at 181 beyond that - a value ladder the fire's own light can fall down instead of clipping against.
- The clipping that was left (a band centred on the camera in all four capture frames) was lamps stacking, not one hot lamp: the wall torches are authored in pairs thirty-two pixels apart on a radius of a hundred and forty or more, and the Beacon's cell took its own lamp plus two pillar fires plus two ward sigils. Each lamp is now at what one lamp can carry on its own, and the fire is still the only saturated colour in the room.
- The drill squares still read more strongly as prop clusters than as painted squares: the outline is a floor tile and at 1x it disappears under the props that define it.
- The three waves are runtime behaviour and are not photographable as architecture; the frames show the yard, not the wave pacing.

### Next correction pass

- The beacon's own cell is the one place the light still has to be judged by eye: the hearth is a repair of the setting, not of the composition around it (four braziers, two watch pillars and two free-standing cloth panels stand on and around the ring).
- Consider a second, coarser floor mark for the drill squares so they survive the props standing on them.

## Cost of the layer

- Nodes: 661 (art off) -> 908 (art on)
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
