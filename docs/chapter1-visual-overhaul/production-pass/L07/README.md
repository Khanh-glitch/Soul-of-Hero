# L07 — The Beacon Yard

- Map: `data/levels/chapter_1_level_7.json` ("Soul Beacon", one open hall, three waves)
- Kit: `vigil` — `assets/environment/chapter1/vigil/`
- Authoring: `tools/level7/art_vigil.py`, `tools/level7/architecture_vigil.py`
- Document: `data/levels/chapter_1_level_7_architecture.json`
- Status: `INCOMPLETE — ART DELIVERY FAILED` until its native frames are captured and reviewed

## The place

A garrisoned yard at dusk, not a crypt. Chalk-white dry limestone, blackened iron
banding every joint, and fire: the yard is lit by braziers, torch brackets and two
fire-capped pillar types. The kit's only saturated colour is flame, which is why
the eye lands on the Beacon's core before anything else in frame.

## What the composition says

- **The ward ring.** A seven-cell iron ring inlaid around the Soul Beacon, with
  eight burn marks on it and a hot line through the iron. The thing being defended
  has a boundary drawn on the floor instead of being a light on open paving.
- **The apron and four causeways.** A raised chalk apron with an iron edge, and
  three-cell causeways running to each of the four walls, cut open where they meet
  the apron. The four approaches the waves use are the most legible thing in the
  room, and they are floor tiles: the art marks them without blocking them.
- **Nothing in the lanes.** Every prop in this level is placed by a rule that
  refuses the approach corridors and the apron openings, and the validator refuses
  anything that is not on a cell the map already made walkable. There is no prop,
  no collider and no added solid anywhere an enemy or the player must walk.
- **Four quadrants, four different jobs.** A muster line of spear racks, a fire
  station with the cistern and the woodpile, a dressing station with benches and
  spent arrows, and an armoury of shields and crates — each on its own marked
  drill square, so the middle of the hall has composition that is not symmetry.
- **A working fort.** Buttresses, arrow slits and fire baskets on the broadside
  faces; crates, barrels, sandbags, firewood and torn banners at the wall feet all
  the way round, including the south boundary whose face the camera never sees.
- **The bastions.** Each of the four hollow blocks carries a fire-capped watch
  pillar above its walls and braziers at its foot.

## Verification

- Validator: clean. Every floor override on walkable cells, every wall override on
  solid cells, every prop on a cell the map already made floor or wall, none on a
  gameplay entity's cell or its neighbours.
- Lane safety is computed, not asserted by eye: `LANES` in
  `tools/level7/architecture_vigil.py` defines the four approach strips and
  `lane_cells()` marks a one-cell margin around them; every placement function
  tests it.

## Known weaknesses before the first native capture

- The design has not yet been judged in engine; the first native frames may force
  a value or hue correction like the one Level 6 needed.
- The drill squares read more strongly as prop clusters than as painted squares at
  gameplay zoom.
- The three waves themselves are runtime behaviour, not architecture; the capture
  harness photographs the yard, and the wave contract is covered by the frozen
  runtime suite rather than by a frame.
