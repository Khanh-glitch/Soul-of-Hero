# Gate 3 — Phase B: design decision

Two directions were carried far enough to be judged, and one of them was then
built. This document records both, with the measurements that decided between
them. Nothing below is a preference expressed in adjectives: every row is either a
number from `tools/gate3/worldmodel.py`, a cell count from
`prototypes/gate3/visual_placement.json`, or an explicit risk statement about the
production contract.

---

## Option A — Evolved Carved Cloister (selected)

Keep Candidate A's building exactly where it stands. Rebuild the relationships
inside it:

| what | how | cells |
| --- | --- | --- |
| the sealed shaft `x27..33 y16..20` | floored and opened west at `x34 y16..17`, sealed on its south side by masonry, read as the collapsed head of the stair to the deep stacks; lit from above so it reads as depth, not as a hole | 44 |
| the south ambulatory | the pier block `x50..52` opened so the walk is two rows tall the whole way, plus a bay framing the spike at `(46,21)` | 6 |
| the garth | parapet opened west, east and on the north crossing; four corner piers canted in, so the basin is octagonal and the walk has a water edge | 13 |
| the wall bands | a recess and a pier rhythm derived from the level's own geometry: every bay measured from the real wall run, not stamped | 979 `wall_face` + 241 `niche` cells |
| the vault | one continuous distance-field shade sprite instead of five band layers | 5616 cells of scenery removed |
| the fittings | Candidate A's cool-toned `Decor` layer hidden, the archive's own fittings painted in the eleven-role material | 110 `decor` cells |
| floors 2 and 3 | the same eleven roles, with their own furniture, their own lanterns and their own purpose (stacks level, camp level) | 36 props, 6 lights, all three storeys |

**Cost:** 75 cell edits to the level document, 36 props, 6 lights, 11 material
layers, 1 shade node, 0 entity changes, 0 changes under `data/`, `game/`,
`tests/`, `assets/`, `project.godot`.

---

## Option B — Controlled Reliquary Spine (rejected, implemented nowhere)

Gate 2's Concept 3, taken seriously: re-plan the nave as a three-aisle basilica with
a processional centre line, side aisles of stacks, an apse at the west end and the
garth beyond a screen of columns. It is the strongest *plan* in the concept review
and it is the right plan for a chapter about an archive.

| axis | A — Evolved Carved Cloister | B — Controlled Reliquary Spine |
| --- | --- | --- |
| spawn impression | the nave is re-formed around the armarium and the shaft: a lit alcove, a descent, a cloister beyond. Before: 3/5. After: measured below | best of the two: a threshold, a centre line, a destination |
| landmark visibility | the armarium stays where the level put it and is now framed by a real recess and a lantern; visible on the spawn sightline in the AFTER frame | a new apse would put it on the axis, at the cost of moving the objective |
| route quality | every authored route preserved and three of them improved (shaft, south walk, garth edge); reachable cells 871 → 2850 including both storeys, exactly the same entity connectivity | needs ≈400 cells re-cut; every route re-measured from scratch |
| combat readability | unchanged enemy placement, unchanged cover, but the wall rhythm gives the eye a depth cue it did not have | better sightlines, but every encounter re-tuned |
| architectural plausibility | high: a cloister garth, a stair head and a stack bay are the three things a monastic archive actually has | highest: a basilica plan is the real thing |
| implementation risk | **low** — additive inside the existing footprint, validated cell by cell before it is written | **high** — a level-design change wearing an art change's clothes |
| contract preservation | 79/79 entities byte-identical, in order; zero edits under frozen paths | would have to re-check 79 entities one by one against a new plan |
| deliverable visual gain | measured in the AFTER frames at all six Gate 2 stations | larger in the abstract, unprovable inside this gate |

**Decision: A.** The brief's own constraint decides it. Option B re-cuts the plan
that the level's objectives, hazards, enemies and tuning were authored against; that
is a gameplay contract change, and Gate 3 is not allowed to smuggle one in. Option B
is also the option that cannot be *shown* to be better within this gate, because its
benefit only appears after a full re-tune that would not fit in the same delivery.

**What is taken from B anyway.** The parts of Concept 3 that do not need a new plan:
the processional reading of the nave (achieved with the recess-and-pier rhythm
rather than with new walls), the screen of columns at the garth (achieved with the
four corner piers and the coping ring), and the apse-like destination at the west end
(achieved by giving the armarium a real recess and a lantern). That is the honest
form of "study Concept 3, do not improvise": adopt its *relationships*, refuse its
*cost*.

**What B would need to become shippable:** a new level revision with the objectives,
hazards, enemies and camera bounds re-authored against it; a full re-run of the
Gate 2/3 harness on the new plan; and an explicit product decision to spend Level 3's
tuning budget. Recorded as a proposal, not attempted.

---

## The seven Gate 2 defects → what was implemented

| # | Gate 2 defect | implementation | how it is proved |
| --- | --- | --- | --- |
| C1 | sealed shaft | floored, opened west, south side sealed, one lantern above; a rubble arch at the stair head so no false interaction is implied | `audit`: floor-1 entities 16/16, the shaft is walkable (`descent_landing` station reached on foot in 15 cells); AFTER versus BEFORE native frame |
| C2 | magenta `Decor` | live `Decor` layer hidden, archive fittings painted on the wall plane in the same eleven-role palette | `Gate3_decor` 110 cells; contract `Decor hidden (C2)`; the violet blocks are gone from the AFTER frame |
| C3 | flat wall bands | recess/pier rhythm from real geometry: `wall_face` 979, `niche` 241, `mass` 707, `coping` 34 cells | no material layer covers a walkable cell (contract check); 3× crops |
| C4 | rectangular garth | 9 parapet cells opened, 4 corner piers, coping ring, shoreline on 30 cells, water kept on all 66 original cells | `garth_open 9`, `garth_piers 4`; the walk now touches water on three sides |
| C5 | south ambulatory | pier block opened; both directions walked by the harness with the real 12×16 body | `audit` strict and permissive: PASS 23 cells; harness walks `south_loop` then `return_route` |
| C6 | five vault bands | five band layers deleted in favour of one distance-field sprite | `shade_built` contract; 3× `shade_depth` crop |
| C7 | floor 1 only | 36 props and 6 lights across all three storeys, each with its own purpose | native frames for floors 2 and 3 via real floor-door descents |

## Camera (Phase D) — decided after the frames

The campaign camera is a plain follow camera at zoom 1. The alternative evaluated
is an archive framing at zoom 2, applied to the live `Camera2D` at runtime. Both are
captured at the same moment, at 1280×720 and 1024×576, in
`docs/gate3/evidence/comparison_camera_*.png`. The decision and its reasoning are in
`GATE3_REPORT.md`, because the brief requires it to be argued from the native frames
rather than from intent.
