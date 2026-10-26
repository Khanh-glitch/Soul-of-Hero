# Per-level report

Native scale is 640×360; the mosaics in `docs/chapter1-visual-recovery/after/` are 1:1 world pixels,
so every frame is twice the size the player actually sees. Review order used here:
the whole mosaic first for composition, then crops at 1:1 for detail. No smoothing,
no exposure compensation — where a frame is dark, the note says so rather than the
crop hiding it.

The native numbers in each entry come from the branch's own logs
(`docs/chapter1-visual-recovery/after/logs/chapter_1_level_N.txt`), not from the audit's estimated
counts.

---

## L01 — Crypt Entrance

`AUTHORED ART` is not printed for L1–L4 (they are procedural, not document-driven).
The native pass prints `ENVIRONMENT BEDROCK: void_cells=3164 headroom_cells=624`.

**Before.** Rooms sat as rectangles in a black field. The wall band was one tile
thick with a lit lip, the facade above it ended flush at row 0 with no coping, and
the space between rooms — 112 enclosed cells, 3052 outer — was background. The
level read as a floor plan, not as a place.

**After.** Every void is rock — 3164 cells inside the map and 624 in the headroom
above it — in one value, so the rooms are lit islands of floor cut out of a
continuous mass. Wall bands finish with a cornice and a cap inside the world's top
row instead of stopping at the frame edge.

**Still wrong.** The four rooms are interchangeable: same band, same floor, same
scatter of debris. The rock and the wall band are also the same material, so the only
thing separating a room from the stone around it is the coping strip, and the hard-
edged shadow rectangles drawn inside the rock read as holes rather than as shade. There is no prop layer, no door, no buttress, no fixture. The
tiny free-standing boxes in the middle of two halls (a 5×4 walled cell) have no
readable purpose. The exterior rock is three tiles hashed, not strata.

## L02 — (largest of L1–L4)

`ENVIRONMENT BEDROCK: void_cells=10648 headroom_cells=984`.

**Before.** The most unmarked cells in the chapter, plus 19 cells painted above row 0. At 1:1 the interior read as corridors of floor separated by black.

**After.** Voids filled; the corridors sit in rock. Walls crown.

**Still wrong.** Same as L01, at a larger scale: 762 cells of new rock make the
repetition more visible, not less. Nothing in the level tells the player which kind
of room they are in.

## L03 — crossfire floors

`ENVIRONMENT BEDROCK: void_cells=3636 headroom_cells=696`.

**Before.** 48 cells above row 0, including the whole coping of the optional
top-floor cache whose ceiling *is* the map's first row.

**After.** The cache's architecture has room to finish; the voids are rock.

**Still wrong.** The cache is still a 2-row-tall slot with nothing in it.

## L04 — Spiral Reliquary

`ENVIRONMENT BEDROCK: void_cells=4008 headroom_cells=696`.

**Before.** The level is mostly masonry by area, and 50 cells were painted above row
0, so the heavy walls were cut flat at the top of the screen.

**After.** The masonry is material on both sides of the wall band.

**Still wrong.** "Monumental concentric stone" is in the theme's own description and
is not in the picture: no concentric anything, no monument.

---

## L05 — Blood Crucible

`AUTHORED ART: kit=crucible floor_detail=5761 wall_cells=3303 bedrock=4609 props=169 lights=29 shadows=506`

**Before.** The document had no `kit`, no `ambient` and no `background`, and the
renderer silently used `crucible` and the chapter defaults. 139 cells were painted
above row 0. 90 floor cells were claimed twice — 89 of them by *different* frames —
because a corridor pass and a dressing pass wrote the same cell and the last write
won, which is why an aisle changed tile halfway along its own length. Lights were
authored at scales 2.4–6.4, corrected by an older pass that multiplied radius down
and energy *up*, leaving cores at 2.5.

**After.** The document states its kit, ambient and background. Floor claims are
resolved by rule (a lane beats wear; two drainage channels become the kit's crossing
tile; a lane with no crossing tile keeps its first direction and is counted): 656
floor cells, 656 unique, 90 claims settled, 16 competing lanes reported. Lights: 10
distinct radii between 209 and 378 px, cores rolled off at 0.85–1.15 instead of 2.5.
Walls reach the top of the world with their crown intact.

**Still wrong.** Floor and wall still hold nearly the same value (audit finding H),
so the room has no readable ground plane. The crucible itself — the level's name —
is a bowl that does not read as a hero object (finding K). The 16 lane clashes are
reported, not designed: the kit has no aisle crossing tile, and inventing one is art
work this pass did not do.

## L06 — Relay

`AUTHORED ART: kit=relay floor_detail=6300 wall_cells=2720 bedrock=6155 props=156 lights=75 shadows=360`

**Before.** 122 cells above row 0; 53 props cut by the top of the screen in the
chapter, of which this level's banners were the worst at −32 px. Seventy-five lights
authored up to 2.6 scale, i.e. 665 px pools, 25 of which needed resizing.

**After.** 25 pools resized (7 distinct radii, 207–399 px), one core dimmed. Banners
have their headroom.

**Still wrong.** The 1-px conduit motif still reads as a printed line rather than a
built channel. Floor/wall value separation (finding H) is untouched.

## L07 — Beacon Yard

`AUTHORED ART: kit=vigil floor_detail=7211 wall_cells=844 bedrock=2334 props=213 lights=22 shadows=108`

**Before.** 176 cells above row 0 — the most in the chapter — plus 20 store cells
that asked for a frame called `barrels` that the atlas does not have, so a fifth of
the garrison's stores drew as empty ground. Five `banner_torn` props were cut by
30 px, and the watch pillars by 2 px.

**After.** `barrels` → `barrel`: 213 props, `missing=0`, `clamped=0`. Headroom means
the torn banners hang whole. This level's lights were already the most disciplined in
the chapter (3 distinct energies) and the normalisation barely touched them: 1
resize.

**Still wrong.** The beacon — the level's name and the landmark the yard is built
around — still does not read (finding K). The lane motif is still hairlines.

## L08 — Reliquary

`AUTHORED ART: kit=reliquary floor_detail=7296 wall_cells=1114 bedrock=4956 props=96 lights=45 shadows=266`

**Before.** Two nave banners asked for `banner_pale`, a frame that did not exist, so
neither banner drew. 40 cells above row 0; two columns were cut by 60 px and the gate
frame by 20 px. 150 wall faces were one tile high, and the kit's light scales ran to
2.6.

**After.** `prop_banner_pale()` authored and the kit regenerated to 19 props. 21
lights resized (8 distinct radii). No prop now crosses the world top.

**Still wrong.** The one-tile-high wall faces are still one tile high: the level's
walls have thickness only where the map made them thick. Detail inside the
over-bright right-hand wing is still hard to read at native scale.

## L09 — Gatehouse

`AUTHORED ART: kit=gatehouse floor_detail=5668 wall_cells=810 bedrock=5340 props=71 lights=29 shadows=100`

**Before.** The gate — the level's hero object — was an arch with a 614 px cold
flood over it at 1.05 energy, and the kit's `portcullis` frame was never placed.
Four seals, four medallions: the audit's finding was that they do not read as four
stations, and at 1:1 they read as identical spiky rosettes on stalks. 64 cells above
row 0.

**After.** Gate light 0.66 on a 333 px pool: the arch now reads as stone — voussoirs,
keystone seal, towers either side, the gate's own bars dark against the cold light —
instead of as a blue bloom with a shape somewhere inside it. 29 lights resized, 13
cores rolled off. A portcullis prop was placed in the mouth during this pass and then
removed: at native scale it drew behind the arch sprite and contributed nothing, and
the arch already draws its bars. It was not left in the document as decoration.

**Still wrong.** The four seal stations still do not differentiate. The iron band is
still a 1-px motif. The props down the nave are evenly spaced chains of identical
silhouettes.

## L10 — Castellan Hall

`AUTHORED ART: kit=castellan floor_detail=4444 wall_cells=572 bedrock=2922 props=41 lights=23 shadows=68`

**Before.** 40 cells above row 0; six of the chapter's 1-px carpet hairlines; the
throne did not read; the hall had floor equal to wall in value.

**After.** 20 of 23 lights resized (6 distinct radii), walls crown inside the world.

**Still wrong.** The hall is the emptiest room in the chapter by prop count (41 props
for its area), the throne does not read, and the candles sit on a regular grid.

---

## Verdicts

**Technical integrity:** PASS on the parts this pass touched. Every generator runs
clean, every document validates, regeneration is byte-stable, the art-reference
validator resolves all 6 documents against all 6 kits, and the native renderer
reports `missing=0 clamped=0` on every level it owns. One pre-existing CI failure
(`Godot 4.7 Runtime Validation`) remains and is unrelated to this pass; two more
(`Level 2 Audition QA`, `Level 5 — Blood Crucible redesign`) fail identically at the
baseline.

**P0 resolution:** the three missing-content classes (A1, A2, A5) and the two
structural causes of the clipping and flooding (B1, D1) are repaired and verified.
No P0 is left open.

## This pass — what changed on the branch, level by level

Judged the way the audit asked: whole mosaic first, then crops at 1:1 and at 2-4x
for detail, with the authored document open beside them. Round numbers below are
native log values, not estimates.

**L01–L04.** No art changed this pass. The findings stand: four variations of one
room, single-pixel noise decals on the floor, no prop layer, rock and wall band the
same material (G3, F1, C3).

**L05 — The Crucible.** The halls were black: an ambient of 0.30/0.32/0.40 over
already-dark blue-grey paving lands near 30/255, so a 4x crop of a floor/wall
junction shows the two as the same value with only the joints to tell them apart.
Ambient is now 0.44/0.45/0.53 — still the darkest level in the chapter, still fire
lit, all 29 authored lights untouched. The three basins remain identical to each
other (C3/E2) and the bowl itself is unchanged (D4).

**L06 — The Relay House.** No art changed. Of the six document-driven levels it is
in the best shape: the floor is a dark slate, the walls are a lighter masonry band,
and the relay platform is a genuine focal point. Its remaining faults are the 1-px
conduit lines (E1) and hot-pink blood decals that read as spray paint.

**L07 — The Beacon Yard.** The ward ring was never in any build. `apron()` covers
nine cells in every direction and ran after `ward()`, so it repainted the whole
disc: the 13x13 ward with its octagonal iron ring, hot centre line and eight ward
marks existed in the kit and on the floor for zero frames. The apron is laid first
and the ring inlaid into it; `stats.ward_cells` now reports 169 painted cells
instead of a guess. The free-standing "banners" with no pole still read as
monoliths (G4).

**L08 — The Reliquary.** No art changed. New finding G1: it is over-exposed. Pale
marble plus 45 lights plus a bright ambient stack until a whole wing sits at
230-255 and detail is gone; the left hall reads as white brick under a blue wash.

**L09 — The Crimson Gate.** Four repairs, all of them art:
the east cauldron was a 70 x 108 funnel wider than its own shrine, hanging over the
seal cell and laying the darkest value in the room across it (D4); the seal rings
were broken crescents because the stations stand two cells from their end walls, and
a full 5x5 ring cannot be painted where the wall is (E2/F2); the paving, walls,
iron and blood were one oxblood value (D3); and blood was painted *lighter* than the
stone, so it read as pink petals instead of a stain (E1).
The cauldron is 48 px inside its niche, the rings are generated per arm (whole ring
in the throat and at the gate; horseshoes at the west and east stations, cut at 80
degrees so both ends land inside a paintable column, each capped with a bronze
socket and a bolt), every ring sits on a recessed dark pad, and the paving is now
the coolest, darkest value in the room. `ring_cells` 88, validation clean.

**L10 — The Castellan's Throne.** Two repairs. The throne (D4) was a small seat in
front of a black hatched fence: twenty-two 1-px canopy columns two pixels apart
averaged into a moire wash at gameplay zoom and the crown floated above the lintel.
It is now five masses — three-step dais, winged buttresses outside the back slab so
their silhouette reads, pilastered back around a crimson field, projecting seat with
arms, crown resting on the lintel — each at least three cells across. And the
staircase (E1) was painted as scattered `aisle`/`lane` tiles whose 2-px seam rules
read as gold scratches; four tiers of tread and riser bands now read as four steps.
Hollow blocks flanking the throne (G5) are unchanged and still read as holes.

### Native confirmation at `bf1c4ce` (sweep `40203197505`)

Read at 6x off `after/L09_mosaic.png` and 3x off `after/L07_mosaic.png`:

* **L9 east station.** The bronze cauldron stands in its niche, on its plinth, and
  the seal cell beside it is clear: the gold centre boss of the ring is visible, the
  ring reads as a steel-and-brass mechanism on a recessed pad instead of a red
  scribble on red paving. The pad's arc and the iron ring are both legible.
  What does *not* read is the bronze socket on the north-east end: the cauldron
  occupies that cell and hides it. The cut on the south-east end is visible.
  Honest summary: the occlusion is fixed and the ring is a mechanism, not a
  mechanism whose every detail is visible.
* **L7 ward ring.** The disc, the inner iron arc, the hot centre line and the ward
  marks are all present on the floor now. The centre is still crowded — four
  braziers, two watch pillars and two free-standing cloth panels stand on and around
  the ring — so the disc reads as a patterned floor rather than as an arena centre.
  Repair of the bug is confirmed; the composition around it is not finished.
* **L10.** The four treads and the riser read as a staircase under the dais at 3x,
  and the throne's dais, buttress steps, pilasters, crimson field, seat and crown all
  read as separate masses. The gold scratch marks that were scattered over the paving
  are gone; the only remaining floor ornament is the inlay band, which is continuous.

### Pass 3 — exposure, material and identity at `0edc5a1` (sweep `40211470676`)

Four commits, each with its own reason:

* `d4ea1dd` bands the L1–L4 rock by its distance from the rooms and picks its tiles per
  48 px patch. One tint over one tile at one phase, wall to frame edge, was a stamped
  lattice on a third of every L1–L4 frame. The seam between bands is dithered, because
  a clean multiple of the band width draws the falloff as contour lines around every
  room.
* `352b25e` gives the four L1–L4 themes four material stories - bone masonry, archive
  warmth, cold monumental stone - using the chapter's own sheet, and stops the wall
  backing tint from being hardcoded grey.
* `f1cacfc` adds `wall_tint` / `bedrock_tint` to `CrucibleArt` and sets them for L6, L7
  and L9; doubles L7's light energies and lights its ring braziers; and logs the
  palette that actually reaches the canvas.
* `0edc5a1` fixes the bug that log line found: `Chapter1EnvironmentArt.attach()`
  rebuilt the existing layer from the node's own stale `level_data_path`, so from level
  2 onward every level painted level 1's theme. Measured, not guessed: on the mosaics
  at `f1cacfc`, L2, L3 and L4 shared the exact wall colour `(110, 90, 76)` while L1 sat
  at `(116, 96, 83)`.

Luminance ledger, 0-255, sampled off `after/L*_mosaic.png`. Floor and wall are cell
medians; `rock` for L1–L4 is the void fill, and for L5–L10 the fraction of it away from
a light.

| Level | floor | wall | rock | frame median | p10 | p90 | >245 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L01 | 133 | 66 | 44 near, 28 far | 63 | 20 | 171 | 0.91% |
| L02 | 117 | 62 | | 48 | 18 | 122 | 0.35% |
| L03 | 121 | 62 | | 58 | 17 | 161 | 0.54% |
| L04 | 115 | 56 | | 54 | 16 | 140 | 0.45% |
| L05 | 83 | 74 | 55 | 76 | 34 | 113 | 0.03% |
| L06 | 110 | 87 | 75 | 87 | 43 | 144 | 0.28% |
| L07 | 104 | 96 | 48 far, 121 under a brazier | 107 | 44 | 145 | 0.10% |
| L08 | 138 | 126 | 88 | 91 | 67 | 189 | 2.42% |
| L09 | 93 | 79 | 66 | 65 | 54 | 106 | 0.04% |
| L10 | 110 | 103 | 45 | 81 | 6 | 125 | 0.13% |

The L7 and L8 rows are the second attempt. The first one (`d94a344`) over-corrected
both: L7 clipped 0.33% of the frame at a white beacon core, and L8 went from flat to
blown at 5.0% above 245. `8c1f2da` pulled L7's stacked shrine lights back to 0.45-0.55
energy (0.10% clipping now) and L8 to ambient 0.64 with a 1.2x lamp gain.

What the ledger says, item by item:

* **D3 floor/wall separation - PARTIAL.** Every level is now ordered floor > wall >
  rock, which four of the ten were not before (`f1cacfc`: L6 110/111/106, L7 99/90/118,
  L9 93/93; L1–L4 all sharing one theme). L04 is the weakest at 115/56 - a 2:1 step -
  and L01–L04 still read as one bright plane per room rather than as a floor with
  furniture-scale incident on it.
* **F1 / C3 L1–L4 identity - PARTIAL.** The four documents now differ in wall mass,
  course count, trim rhythm, wear pattern, shadow depth and rock falloff, and they are
  finally *read*: L2, L3 and L4 sample at 117/121/115 floor against L1's 133, with
  different walls and different colour. At 1:1 the rooms still share one floor
  material, the same repeating dentil along every wall band, and the same dust speckle,
  because all four are cut from one shared sheet that this pass does not change.
* **L7 focus - FIXED, then re-balanced.** Twenty-two lights at 0.30-0.42 under a 0.74
  ambient, and the ring braziers with no light at all: the yard was a uniformly lit tan
  field. It now has a pool. The beacon core measures white - the braziers, the pillar
  fires and the beacon's own light stack on the same 4x4 cells - so the shrine's centre
  first attempt at the fix blew that core out: the shrine clipped 0.33% of the frame.
  At `8c1f2da` the stacked lights are back to 0.45-0.55 and the core holds - 0.10%
  clipping against 0.33% before the lights were touched at all - so the yard has a
  pool and the beacon keeps its silhouette.
* **L6 material hierarchy - FIXED.** 110/87/75 against 110/111/106 before. The floors
  and walls are separable at 1:1 for the first time.
* **L9 wall mass - FIXED.** 93/79/66 against 93/93/81.
* **L8 over-exposure - PARTIAL, and worse before it got better.** The level lit
  itself with ambient while its 45 lamps averaged 0.41 energy. Dropping the ambient to
  0.58 and doubling the lamps traded flat for blown - 5.0% of the frame above 245, by
  far the worst in the chapter. At 0.64 ambient and a 1.2x gain it measures 2.42%
  against 1.25% at the start: the range is wider (p10 67, p90 189) and the clipping is
  concentrated in lamp cores rather than spread across the floor, but it is still twice
  the chapter's worst-case before this pass and the level is not finished.
* **L10 deep shadows - STILL OPEN.** p10 at 6 means a tenth of the frame is at or near
  black; the rock averages 45 and the throne flanks are still hollow.
* **E1 hairline motifs, E2 prop composition, E3 bedrock strata, G3–G5 - STILL OPEN.**
  Nothing in this pass touched them.
* **CI publish step - FIXED (workflow).** The evidence-publishing step failed on three
  separate sweeps while every compile, gameplay, capture and verification step passed.
  Both publishing workflows rebased their own commit onto the moved branch; the two
  jobs write overlapping docs, so the rebase conflicted, the abort left the commit
  behind the branch, and the push failed three times. Each step now takes the new base
  and rebuilds its commit from the files already generated - the artefacts are
  regenerable, so the history does not need to be rebased.

**P1/P2 resolution:** partly. Floor/wall value separation (D3) and L1–L4 identity
(F1) moved from "not attempted" to "measurably present, materially incomplete";
hero objects (D4), hairline motifs (E1), prop composition (E2) and L9's seal stations
(F2) are open, and they are exactly the findings that decide whether the chapter looks
designed. One defect was introduced by this pass - L7's blown-out beacon core - and is
recorded as open rather than as a win.

## Final state — the exposure, material and identity pass

Recorded after the repairs below, which are all on the branch and all measured
either off the kit sheets or off native frames published by CI.

| Repair | What was wrong | What changed | Measurement |
| --- | --- | --- | --- |
| L1–L4 paving | Eight stone variants hashed per cell average into one value; the floor read as a flat field whose only feature was the flag joint | The family is chosen from a smooth value field (a lot of stone, a repaired patch) and the cell varies only within it; wear is a second, coarser field thresholded into areas | Kit frame means; `validation: clean` on all four |
| L2/L4 columns | Every prop was a Sprite2D, so the hero, the enemies and the hitboxes passed through load-bearing masonry | `solid: true` gives a prop a StaticBody2D with a box across the middle of its own cell; the generator marks a cell solid only after re-walking the floor without it | 44 solid piers (L4), 34 solid shafts (L2); `chapter_1_collision_route_test` PASSED in CI |
| L3 archive | Shelf ranks on a fixed stride on both axes; no storey above the grille course | Runs three cells apart with rows seven apart, a cross aisle every fifth bay and a case missing every fourth; `wall_gallery` two rows up where the masonry is thick enough | 28 gallery overrides; frames at the same cells |
| L7 Beacon | The ward ring is laid across a thirteen-cell disc, so the cell the Beacon stands on was a ward tile on chalk at 193 and its own lamp made it the brightest thing in the room | New kit frame `hearth` over the ring's inner octagon and nothing else; apron one step down | hearth 71.7, ward 90.8, apron 181.4, floor 147–156 |
| L7 lamps | Clipping in a band centred on the camera in all four frames: torches in pairs 32 px apart on a 140+ px radius, and five lamps on the Beacon's cell | Each lamp to what one lamp can carry: torches 0.50→0.30, pillar fires 0.55→0.34, Beacon 0.55→0.40, sigils 0.30→0.22, gate pillars 0.60→0.40 | 26 lights, max energy 0.40; exit frame 3.94 % → 3.88 % (the lamp pass landed after that frame was published — see the status note) |
| L8 vault | Three lamps stacking on the shared pale marble floor between the arch and the dais | Arch 0.38→0.30, dais 0.36→0.29 before the level's own lamp gain | Exit frame clipping 2.51 % → 1.97 % on the published native frames |
| L9 paving | The gatehouse kit drew one more line inside every slab, cutting each 32 px flag in half on both axes — a 16 px grid | The two extra strokes are gone; each slab carries a sheen from the light's side | Internal seam flat (95.0/94.0/94.1/93.5), NW quadrant 87→95.7→92 |
| L5 basin | The court's, forecourt's and arena's basins were one drawing at three scales; the court's had to be the thing the eye finds from the spawn station and was a blob at that distance | The grand vessel carries a bronze crest — a band on the rim's ellipse, four tapered horns with finials, a chain and the order's disc; the lesser basins keep the plain rim | 27 tiles, 25 props unchanged; the small basin byte-identical |

**Status note on the measurements.** The last native frames this branch has published
are the `614fdf87` visual-overhaul run: they cover the L7 hearth and the L8 vault
lamps (L07 exit 3.88 %, L08 exit 1.97 % against 3.94 % and 2.51 % before). The L7
lamp pass, the L9 paving and the L5 crest landed in later commits, and the
visual-overhaul workflow did not start for those pushes — every push received a
`Godot 4.7 Runtime Validation` run and none of them started a visual-overhaul or
audit-sweep run, although the changed files match both workflows' path lists
(`tools/level*/**`, `assets/environment/chapter1/**`). Those three repairs are
verified off the kit sheets and by the level validators, not off native frames, and
that is stated rather than glossed.

**Visual production review:** **READY FOR OWNER REVIEW.** The chapter no longer has holes in its
maps, sliced walls, invisible props or lamps that erase the room, and since this pass
it also has, level by level, a floor that out-values its walls and walls that
out-value their rock - a hierarchy it did not have on six of its ten levels. That is
real progress a reviewer can see in the BEFORE/AFTER mosaics. It is not enough: L1–L4
are still four rooms cut from one sheet with one repeating dentil, L6–L10 still lack
hero objects and non-mechanical prop composition, L8 is bright everywhere and L10 is
black in a tenth of its frame, and this pass left L7's beacon centre blown out. Gates
E and F were not attempted, Gate D is half done, and Gate C is now measurably started
rather than merely claimed.
