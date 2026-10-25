# L09 — The Crimson Gate

- Map: `data/levels/chapter_1_level_9.json` ("Crimson Gate", three seals, one named elite)
- Kit: `gatehouse` — `assets/environment/chapter1/gatehouse/`
- Authoring: `tools/level9/art_gatehouse.py`, `tools/level9/architecture_gatehouse.py`
- Document: `data/levels/chapter_1_level_9_architecture.json`
- Status: `INCOMPLETE — ART DELIVERY FAILED` until its native frames are captured and reviewed

## The place

A gatehouse, not a hall. Oxblood basalt in blocks too large to lift, riveted iron
plating, bone trophies: the loot of everyone who tried the gate and did not get
through it. The palette is deliberately close to the Crucible's in hue and nothing
else — dried blood and cold iron, lit by fire.

## What the composition says

- **The gate is inside the frame.** The monumental arch and its two towers are
  built up from the arena floor rather than hung on the top wall, because the
  camera stops at the map edge and a gate whose head is off-screen is only a
  lintel. It is the one cold light in the level: from anywhere in the nave the
  blue-white opening is the thing to head for.
- **Three stations, three silhouettes.** A bronze bell hanging from an iron
  gallows in the west arm, a burning cauldron in the east, the winch wheel in the
  north throat. Each stands on the same stone platform and sits in its own inlaid
  iron-and-blood ring, so they read as three locks on one gate rather than three
  copies of a marker. No prop stands on a seal cell or beside one.
- **The cross is drawn on the floor.** A riveted iron aisle runs the building's
  full axis from the spawn to the gate, with iron cross bands where the two arms
  meet the nave, so the map's shape is legible without a minimap.
- **A gatehouse that has been fought over.** Blood in the arena and at each
  threshold, skull piles, broken blades, war drums, trophy shields, chained
  columns and thirty fire-lit braziers.

## Verification

- Validator: clean. All 2834 floor overrides on walkable cells, all 58 wall
  dressings on solid faces, all 71 props on cells the map already made walkable or
  solid, and none on a protected gameplay cell (the three seals, the exit, the
  checkpoint, the spawn and the named elite).
- Station safety is structural: each station's ring is floor-only and the placer
  refuses the protected cell set, so the seal itself is never covered.

## Known weaknesses before the first native capture

- The paving still reads as brickwork at gameplay zoom; the flagstone joints are
  regular enough to form a grid. Documented rather than hidden.
- The three arms are architecturally identical apart from their station: the level
  design gives them the same geometry, and the art differentiates them by fixture
  and light rather than by plan.
- The portcullis is drawn inside the gate arch and will read at gameplay scale but
  not in a thumbnail.
