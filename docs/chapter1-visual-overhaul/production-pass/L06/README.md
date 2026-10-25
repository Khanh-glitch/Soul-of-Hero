# L06 — The Relay House

- Map: `data/levels/chapter_1_level_6.json` ("Two Souls, One Path", three floors)
- Kit: `relay` — `assets/environment/chapter1/relay/`
- Authoring: `tools/level6/art_relay.py`, `tools/level6/architecture_relay.py`
- Document: `data/levels/chapter_1_level_6_architecture.json`
- Shared engineering: `tools/chapter1_env/` (atlas packing, plan + validator, preview)
- Evidence: run [40174706175](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40174706175), evidence commit `8c13ef0`
- Frames: `docs/chapter1-visual-overhaul/L06/images/`
- Status: `COMPLETE — AWAITING OWNER VISUAL REVIEW`

## The place

A cold signal-house, not a furnace. Pale cool limestone laid as 32 px flags,
aged verdigris copper as the only metal, cold mint soul-light carried in open
channels cut into the paving. Nothing in the kit is warm except the lamps, which
is what makes the three Anchor crystals the brightest things in their rooms.

## What the composition says, floor by floor

- **The stepped approach (floor 1).** The west corridor climbs east in three-cell
  terraces with drawn risers under each band and a pylon pair at every second
  brow, so the walk to the first Anchor is counted by the eye.
- **The Anchor dais (all three).** A nine-cell square plate is cut into the
  paving, carrying a round copper-and-verdigris medallion with an eight-point
  radial joint and a two-diamond centre. Two pylons, four conduit posts and a
  crystal monument on the axis behind the core frame it. The relay core the player
  collects sits on the medallion's centre cell.
- **The split diamond (floor 2).** Conduit runs both ways around the central
  block, and the paving chevrons run east on the north lane and west on the south
  lane. A signal wheel with two opposed needles hangs where the lanes divide. The
  level teaches relay in both directions; the floor says so before the HUD does.
- **The return loop (floor 3).** The conduit circles the last Anchor chamber, the
  chevrons run west, and the run ends at the exit arch, which carries the same
  two-ring mark as the three medallions.

## The correction pass (one, as agreed)

The first native frames came back one jade value: a green-grey stone under a
green ambient, with a dozen mint lights on top, so floor, wall and medallion were
the same brightness and none of the composition was legible. The correction was
material, not more props — the stone became a cool neutral grey and the ambient a
blue-grey, light energies dropped by roughly half and the conduit glow thinned to
one every ten cells. Measured after: floor detail 6300 cells, wall cells 2720,
props 156, lights 75, shadows 360.

## Known weaknesses, for the owner's eye

- The two east breather rooms and the two landings are thinly furnished; the
  layer is densest where the composition is, and those floors are the emptiest.
- Inlaid wall panels and lancets are used only on broadside wall runs. A wall seen
  end-on keeps the plain course, and the join between the two is visible.
- The hollow centres of the two central blocks are rock, not architecture. They
  read correctly as uncut mass but add nothing to the loop that circles them.
- The exit arch sits nine cells above the exit gate, so the 4-cells-short exit
  station puts it just outside the frame; it is visible in the overview and in a
  free camera, not in that one shot.
