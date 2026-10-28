# Gate 3 — Phase A: architectural audit of Level 3

**Level:** `chapter_1_level_3` — "Thư Khố Giao Hỏa" (Crossfire Archive), 116 × 96 cells,
three storeys in one map.
**Baseline audited:** Gate 2 as delivered at `fa83414` (evidence run `40011458967`).
**Method:** every number below was re-derived for this audit from the authored
documents with `tools/gate3/worldmodel.py` and from the native frames in
`docs/gate2/evidence/`; nothing is quoted from a previous report without being
re-measured. `python3 tools/gate3/worldmodel.py audit` reproduces the reachability
tables.

This audit is deliberately a **diagnosis**, not a list of symptoms. Each finding is
traced to the decision that produced it, because Gate 3's job is to change those
decisions, not to cover their output.

---

## 1. What is actually there

| storey | rows | authored floor | standable for a 12×16 body | objectives on the storey |
| --- | --- | --- | --- | --- |
| floor 1 | 0–33 | 1008 cells | 841 | 2 sigils, 1 chest, 4 torches, 6 spikes, the spawn |
| floor 2 | 34–65 | 1259 cells | 1086 | 2 sigils, 1 chest, 1 checkpoint, 14 enemies |
| floor 3 | 66–95 | 1084 cells | 937 | 1 sigil, 1 checkpoint, the exit, 13 enemies |

Geometry: 1702 masonry cells. `Decor`: 73 authored cells, which resolve to **18
two-by-two decoration objects** — this matters in §6.2.

**All three storeys are legitimately reachable.** The level authors four `floor_door`
entities, and `game/world/interactables/floor_door.gd` teleports the player to the
door's authored `target_position` on `interact()`:

```
f1_f2_down  (109,16) -> (106,42)      f2_f3_down  (9,51) -> (9,80)
f1_f2_up    (106,42) -> (109,16)      f2_f3_up    (9,80) -> (9,51)
```

With those four edges the reachable set grows from **819** cells (spawn, floor 1
only) to **2798** cells, and every objective entity on every storey is reachable.
Gate 2's report described floors 2–3 as "a scope limitation, not a claim of coverage".
Measured, it is not a limitation in the *level* — the descent works — it was a
limitation in Gate 2's *harness*, which never walked to a door.

---

## 2. Station-by-station audit

Seven axes, scored 1–5 against what the native frame actually shows. "5" means a
reviewer would call the station good without qualification; "2" means it actively
works against the room.

### spawn — `(17,13)`, `after_spawn.png`

| axis | score | what the frame shows |
| --- | --- | --- |
| architectural coherence | 3 | one stone language survives, but the room has no enclosure: the floor runs to a hard edge on three sides |
| composition / focal hierarchy | 2 | nothing is the subject; the eye lands on a scatter of barrels and a purple shelf |
| environmental storytelling | 2 | "furniture in a room", not "an archive someone left" |
| player + hazard readability | 4 | the Knight reads clearly against the floor; no hazard in frame |
| lighting / depth | 2 | flat; the light is uniform, the vault is five visible steps |
| material variation | 3 | floor and wall are the same value; only the props differ |
| spatial identity | 2 | could be any room in any level |

### archive_entry — `(23,12)`, `after_archive_entry.png`

| axis | score | what the frame shows |
| --- | --- | --- |
| architectural coherence | 3 | the wall band and the floor agree; nothing else does |
| composition / focal hierarchy | 3 | the artery is legible, but the far end is a wall of studded band |
| environmental storytelling | 3 | the shelf range starts here and is readable as stacks |
| player + hazard readability | 4 | clear |
| lighting / depth | 2 | the wall band is a single flat value from floor to vault |
| material variation | 2 | one bay pattern repeats with no pier, no recess, no capital |
| spatial identity | 3 | the stacks begin to give the level a subject |

### landmark — `(30,12)`, `after_landmark.png`

| axis | score | what the frame shows |
| --- | --- | --- |
| architectural coherence | 3 | the alcove is a real cut in a real wall — the strongest architectural act in Gate 2 |
| composition / focal hierarchy | 3 | the armarium is the warmest object, but it is off-axis and half out of frame at this station |
| environmental storytelling | 4 | an open press on the artery is a good story beat |
| player + hazard readability | 4 | clear |
| lighting / depth | 3 | the one place with a light pool, and it works |
| material variation | 2 | the bay above the armarium is the same band as everywhere else |
| spatial identity | 3 | "the archive's face to the visitor" is real |

### cloister — `(38,18)`, `after_cloister.png`

| axis | score | what the frame shows |
| --- | --- | --- |
| architectural coherence | 2 | a blue rectangle in a stone frame; the water has no relationship to any walk |
| composition / focal hierarchy | 2 | the water is a hole, not a centrepiece; nothing frames it |
| environmental storytelling | 2 | "water is here" is not yet "this is a cloister" |
| player + hazard readability | 3 | the walk is clear; the water is unambiguously impassable |
| lighting / depth | 3 | the cold light pool reads |
| material variation | 2 | a single flat water fill inside a single flat band |
| spatial identity | 2 | the least specific room in the level |

### combat_space — `(58,21)`, `after_combat_space.png`

| axis | score | what the frame shows |
| --- | --- | --- |
| architectural coherence | 3 | the east room holds together |
| composition / focal hierarchy | 3 | the long board reads as cover against a firing line |
| environmental storytelling | 3 | a cleared reading room is legible |
| player + hazard readability | 3 | the enemy and the board read; the spike at `(58,15)` is off-frame at this station |
| lighting / depth | 3 | its own pool |
| material variation | 2 | same floor, same band |
| spatial identity | 3 | the best-dressed room in Gate 2 |

### return_route — `(44,21)`, `after_return_route.png`

| axis | score | what the frame shows |
| --- | --- | --- |
| architectural coherence | 3 | the south walk is continuous stone |
| composition / focal hierarchy | 2 | a long empty lane with one bench |
| environmental storytelling | 2 | nothing to read |
| player + hazard readability | 3 | the spike bay at `(46,21)` is visible, which is the important part |
| lighting / depth | 2 | flat |
| material variation | 2 | flat |
| spatial identity | 2 | a corridor |

**Averages:** coherence 2.8 · composition 2.5 · storytelling 2.7 · readability 3.5 ·
lighting/depth 2.5 · material variation 2.2 · spatial identity 2.5.

The level is *readable* (3.5) and *coherent* (2.8) and weak at exactly the three
things the reviewer asked for: composition, material variation and spatial identity.
That is the signature of a presentation pass painted over a plan, which is what Gate 2
was.

---

## 3. Root causes

**R1 — The plan was never designed; it was dressed.** Level 3 is a generator output
(`tools/generators/generate_chapter_1_levels_2_to_5.gd`) of orthogonal rooms joined by
two-cell corridors. Every room is the same width and the same value. A material pass
cannot give a generated plan a hierarchy, because the plan has none to reveal: at the
cloister and return_route there is literally nothing to be the focal object. Gate 2's
own evidence shows this — the strongest station (combat_space, landmark) is the one
where a *prop*, not the architecture, supplies the subject.

**R2 — Wall bands are one cell deep, in one material, with no vertical hierarchy.**
Measured: 1702 masonry cells, of which Gate 2 dresses 1214 with four face frames in
two courses. There is no pier rhythm, no recess, no capital, no coping — the band that
bounds every room is the same band. Top-down 2D cannot show a wall's top surface, but
it can show *bay structure*: a pier every N cells, a recess where the wall is really
recessed, a different material at the base and the crown. Gate 2 did the plinth and
the courses and stopped, and every screen still reads as a stripe.

**R3 — The garth is a tank, not a courtyard.** Measured: 66 void cells at
`x41..54 y13..17`, ringed by masonry on all four sides, and **zero authored floor cells
adjacent to any water cell**. No walk touches the water; the water is not something you
arrive at, it is something you see past a wall. Painting a shoreline on it (Gate 2's
`water_edge`, 34 cells) cannot fix an adjacency that does not exist.

**R4 — The level's own `Decor` art fights the palette, and it is structural, not
cosmetic.** The 73 `Decor` cells resolve to 18 two-by-two objects: purple panels with
pale books, i.e. the archive's shelving drawn in a cool violet that no other asset in
the level uses. Gate 2's answer was a warm multiply on the live layer
(`Decor -> (0.966, 0.816, 0.6708)`), which cannot turn violet into stone because a
multiply can only remove light. The finding is not "the purple is ugly" but "the level
has two art languages and Gate 2 tried to reconcile them with arithmetic".

**R5 — The vault falloff is five constants.** `vault_b1..b5` are five full-screen
TileMapLayers whose only difference is a `modulate` step, four cells apart. 5616 cells
of scenery exist to express one gradient. The steps are measurable in the 3x crops and
they cost five layers and a fixed radius, so the falloff cannot follow a room's shape.

---

## 4. Floor-by-floor reachability audit

`python3 tools/gate3/worldmodel.py audit` (Candidate A, `prototypes/gate0/...`):

| storey | standable cells | reachable | objective entities reachable | unreachable |
| --- | --- | --- | --- | --- |
| floor 1 | 841 | 819 | 16/16 | — (22 cells: the spike footprints and two authored pockets) |
| floor 2 | 1086 | 1086 via the f1→f2 door | 17/17 | — |
| floor 3 | 937 | 937 via the f2→f3 door | 14/14 | — |

Unreachable *entities* on floor 1 before the door edges are added: the six spikes (they
are the hazard, not a destination) and two wall-mounted torches (`(11,11)`, `(23,10)`,
which sit on masonry). No sigil, chest, checkpoint, exit or enemy is sealed on any
storey.

**Gaps this audit found in the Gate 2 record:**

1. **The south ambulatory is not sealed.** Gate 2 defect 5 states the spike at
   `(46,21)` "seals the south walk for a 12 px-wide body". It does not. The spike's
   32×32 hazard box covers rows 20–21 at `x45..46`; rows 22–23 are open floor for the
   whole span, and a body-safe BFS from `(38,21)` to `(56,21)` succeeds in **23 cells**
   in both directions — with the hazard treated as lethal *and* with it treated as
   merely painful. What is real is narrower: the walk is four rows tall for most of its
   length and necks to two rows at a masonry pier at `x50..52` and again at the hazard.
   The ambulatory is *unreadable*, not impassable.
2. **The magenta art is a whole layer, not a tile family.** Gate 2 called it
   "Candidate A's `Decor` art"; measured, it is 18 discrete 2×2 objects and it is the
   only cool-toned art in the level. Hiding or replacing the layer is therefore a
   legitimate fix; recolouring individual frames is not needed.

---

## 5. The seven Gate 2 defects, re-diagnosed as requirements

| # | Gate 2 defect | diagnosis (cause) | Gate 3 requirement |
| --- | --- | --- | --- |
| C1 | sealed shaft `x27..33 y16..20` reads as a hole | 35 void cells, enclosed on three sides and **open to the exterior void on the south**; no floor is adjacent, so no prop can dress its lip. It is not a sealed chamber, it is a missing one | give it a real function with real geometry; if a descent cannot be built, say so and build the *collapse* convincingly |
| C2 | purple `Decor` | R4: two art languages, reconciled with a multiply | replace the layer's contribution with archive-consistent, prototype-local fittings; keep the production atlas; never touch hazard visibility |
| C3 | flat wall bands | R2: 1702 cells of band with no bay structure | real recesses and real piers, painted rhythm aligned to geometry that exists |
| C4 | rectangular garth | R3: zero floor cells adjacent to water | cut real openings so the walk meets the water; piers to break the rectangle |
| C5 | spike seals the south walk | **false as stated** (§4): the walk is legible but narrows | widen the walk, prove both directions with the real body, audit hazard pacing |
| C6 | five hard vault bands | R5: 5616 cells to express one gradient | one continuous field, judged at 1× and 3× |
| C7 | props and lights only on floor 1 | R1: floor 1 was the only storey the harness could reach | bespoke props and lights on all three storeys, distinct per storey, native frames for each |

---

## 6. What Gate 3 must not do

- It must not add rooms to fix composition. Gate 1 lost on exactly that: an annex that
  the plan did not need. Every Gate 3 cell edit is inside the existing building.
- It must not add decorative layers to fix material variation. Gate 2 lost on that.
  Gate 3 *removes* five scenery layers (C6) and hides one (C2).
- It must not move, add or remove an entity. The 79 authored entities stay
  byte-identical and in order, because objectives, rewards and the campaign contract
  live in them.
- It must not let a camera hide a weak room: Phase D evaluates framing as evidence,
  not as a fix.
