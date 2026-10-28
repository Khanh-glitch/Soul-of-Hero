# L10 — The Castellan's Throne

- Map: `data/levels/chapter_1_level_10.json` ("Castellan's Throne", two-phase boss)
- Kit: `castellan` — `assets/environment/chapter1/castellan/`
- Authoring: `tools/level10/art_castellan.py`, `tools/level10/architecture_castellan.py`
- Document: `data/levels/chapter_1_level_10_architecture.json`
- Status: `COMPLETE — AWAITING OWNER VISUAL REVIEW` (handoff for visual review, not a claim of approval)

## The place

The chapter's last room, and the most formal in it: cool violet-grey marble, thin
gold leaf, a crimson runner, and cold moon-teal light where the portal is. The
violet is deliberately cool and grey — the reliquary two levels below used wine and
gilt, and the difference is the temperature, not the saturation.

## What the composition says

- **One axis, read from the south door.** Antechamber, nave, runner, steps, throne,
  portal — every element in the level sits on the same centre line, and the carpet
  draws it on the floor from the checkpoint to the seat.
- **The throne is colossal and inside the frame.** A wide seat with a three-panel
  back, swept canopy fins, gold finials, crimson cushion and heavy arms, standing on
  a four-tier approach. It is built low on purpose: the camera stops at the map
  edge, so the seat is monumental by width and by its steps, not by being too tall
  to see.
- **The fight is drawn on the floor.** The crimson cross in the arena is the same
  carpet as the runner: the crossing lanes of the encounter are the one part of the
  floor with nothing on it, and the art says so without a marker or a change to any
  boss statistic.
- **The portal is the conclusion.** A moon-lit arch with two gold-banded pillars
  behind the throne, its teal light the only cold light in the room, so the last
  thing the chapter shows is where the chapter ends.
- **The court.** Four heavy fluted columns on the arena's pillars, gold-leaf
  friezes and moon windows in the walls, royal banners, veiled statues of earlier
  Castellans, chained censers, candelabra and the wreckage of the fight that got
  this far.

## Verification

- Validator: clean. 2222 floor overrides on walkable cells, 40 wall dressings on
  solid faces, 43 props on cells the map already made walkable or solid, and none
  on a protected gameplay cell (boss, portal, checkpoint, spawn).
- No boss statistic, mechanic, phase threshold, telegraph or HUD element is touched
  by this pass; the kit and the document only draw.

## Known weaknesses at handoff

- The arena's east and west flanks are wide and only lightly furnished: the map
  gives the boss room a lot of open floor, and filling it would work against the
  fight.
- Flagstone joints are regular enough to read as a grid at 1x zoom.
- The steps read as inlay more than as elevation: the map is one flat floor layer
  and the art cannot create an actual height difference.

## Native capture

- Run: [run 40179536413](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40179536413) (all steps green), evidence commit `4ef3212`.
- Frames: `docs/chapter1-visual-overhaul/L10/images/` — `before_*` and `after_*` at the same
  stations, plus 3x crops and side-by-side pairs, all native Godot 4.7 at 1280×720.
- Gate line: `AUTHORED ART: kit=castellan floor_detail=4444 wall_cells=572 props=41 lights=23 shadows=68`
- Capture line: `CHAPTER1 CAPTURE: level=chapter_1_level_10 slot=10 art=on facade_cells=572 lights=23 entities=33`

### The one correction pass

The first native frames showed a room with no focal point: the marble, the ambient and the
fill lights were all the same violet value, so the throne and the portal were not the brightest
things in their own room. Ambient and fill energy were cut, the marble shifted one step cooler
and darker, and the bedrock lifted. The throne itself was rebuilt once — the first version read
as a chair-shaped object at 1x, so it was redrawn as four large shapes (back, fins, seat, arms)
and made monumental by width and by its four steps rather than by height, since the camera stops
at the map edge.
