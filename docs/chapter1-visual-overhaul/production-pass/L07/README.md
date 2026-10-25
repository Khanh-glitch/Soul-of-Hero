# L07 — The Beacon Yard

- Map: `data/levels/chapter_1_level_7.json` ("Soul Beacon", one open hall, three waves)
- Kit: `vigil` — `assets/environment/chapter1/vigil/`
- Authoring: `tools/level7/art_vigil.py`, `tools/level7/architecture_vigil.py`
- Document: `data/levels/chapter_1_level_7_architecture.json`
- Status: `COMPLETE — AWAITING OWNER VISUAL REVIEW` (handoff for visual review, not a claim of approval)

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

## Known weaknesses at handoff

- The design has not yet been judged in engine; the first native frames may force
  a value or hue correction like the one Level 6 needed.
- The drill squares read more strongly as prop clusters than as painted squares at
  gameplay zoom.
- The three waves themselves are runtime behaviour, not architecture; the capture
  harness photographs the yard, and the wave contract is covered by the frozen
  runtime suite rather than by a frame.

## Native capture

- Run: [run 40178671475](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40178671475) (all steps green), evidence commit `b1dbced`.
- Frames: `docs/chapter1-visual-overhaul/L07/images/` — `before_*` and `after_*` at the same
  stations, plus 3x crops and side-by-side pairs, all native Godot 4.7 at 1280×720.
- Gate line: `AUTHORED ART: kit=vigil floor_detail=7211 wall_cells=844 props=193 lights=22 shadows=108`
- Capture line: `CHAPTER1 CAPTURE: level=chapter_1_level_7 slot=7 art=on facade_cells=844 lights=22 entities=44`

### The one correction pass

The first native frames showed the yard lit like a furnace: the Beacon, the ward ring and the
apron had all washed to the same pale cream, because every brazier, torch and pillar fire was
authored at energy 0.85–1.25 with a 1.5–2.3 light scale **and** the flame palette was near-white,
so the sprite and the additive light saturated the same pixels. Ember energy came down to
0.30–0.42 with smaller scales, the flame colours dropped two stops, and the bedrock was lifted
out of near-black so the yard stops floating. No placement, cell or collider changed. The centre
of the yard is still the least legible area; that is recorded above rather than hidden.
