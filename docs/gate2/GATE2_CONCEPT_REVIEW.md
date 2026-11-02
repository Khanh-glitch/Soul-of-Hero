# Gate 2 — Phase A diagnosis and Phase B concepts

**Level:** `chapter_1_level_3` (Candidate A's production plan, pin
`5ea50e9cf37791a6283bfd9a58bd634ec8aa144e9602c5b9f40f0b4600555f54`)
**Date:** 2026-10-24
**Status:** design review input. Gate 2 is a prototype; nothing here is a
production approval.

---

## Phase A — why Level 3 does not read as an archive

### A1. It is not a missing-prop problem, and Gate 1 proved that

Gate 1 attached a well-made archive annex to this level and scored 81/100. Its
own native captures show the annex reading as a **pad with furniture on it**
against a black field, with a flat frontal elevation and no floor depth. Adding
an eighth room to a crypt does not make the crypt an archive. The material
failure is at the level of *the building*, so the fix has to be too.

### A2. Measured: the frame is mostly nothing

`1280x720` at 16 px tiles is an **80x45 cell** view, centred on the Knight.
Candidate A's floor 1 of Level 3 occupies about 70x22 cells. Measured against
the six camera stations Gate 2 planned to capture:

| station | cell | floor in frame | wall in frame | **unpainted** |
| --- | --- | --- | --- | --- |
| spawn | (17,13) | 12.9 % | 10.1 % | **76.9 %** |
| archive entry | (23,12) | 15.0 % | 10.9 % | **74.1 %** |
| landmark | (30,12) | 16.9 % | 12.1 % | **71.0 %** |
| cloister | (38,18) | 18.5 % | 16.4 % | **65.1 %** |
| combat space | (62,21) | 30.7 % | 17.8 % | **51.6 %** |
| return route | (44,21) | 28.6 % | 18.0 % | **53.4 %** |

Three quarters of the first frame is not level. In `before_spawn.png` that is
literally true: black. This is the structural cause of Gate 1's "black screen
borders" and of "sanctuary = stone pad against black abyss" — the annex was
surrounded by unpainted cells, so no amount of prop work could make it sit in a
building. **This is the single highest-value thing Gate 2 can change**, and it is
a material problem, not a layout problem.

### A3. Why the level reads grey

`game/levels/dungeon_level.gd :: _apply_dungeon_palette` modulates the
`Backdrop`, `Geometry` and `Decor` layers with desaturated tints. The 0x72 atlas
is warm; the palette tint pulls it to grey-violet. The only warmth left in the
frame comes from Candidate A's own torch lights, which is why the `before`
frames are warm at the torches and grey everywhere else. Any fix that lives in
the *atlas* would be fighting the palette; a fix that lives in **separate,
untinted material layers** is not.

### A4. What Candidate A's plan already contains

Reading the plan as architecture rather than as a tile dump, three things are
already there and were being hidden:

1. **A nave with an artery.** Row 11 runs `x11..73` unbroken — one long
   east-west spine with the spawn hall hanging off it, three authored torches
   along it, and it is the route the campaign actually uses. The archive's
   front door belongs on this line, not on a detour. (Gate 1 put its armarium
   on a lateral/southern detour and lost 6 of 30 points for it.)
2. **A cloister.** The plan encloses a 14x5 void at `x41..54, y13..17` with
   wall on all four sides and a walkable corridor immediately outside it on
   every side: `x35..39` west, `x56..60` east, `y12`/`y11` north, `y20..21`
   south. That is a **garth ringed by an ambulatory**, and it is the centre of
   the map. It currently renders as a black hole.
3. **A north wall of real thickness.** `y7..y10` of the nave is solid masonry
   two to four courses thick. It can carry an alcove honestly.

### A5. What is wrong in the evidence

Quoting the `before` frames (native, in `evidence/`):

- `before_spawn.png`: the first frame contains three torches, two coins and two
  spike beds. Nothing on the first screen says *archive*. The largest object is
  a candle table; the second largest is the black field.
- `before_spawn.png`: a sealed void sits inside the nave's south wall
  (`x27..33, y16..20`) and renders as a hole punched in the masonry.
- The level's grey tile language is applied to floor, wall and mass with the
  same two-tone hatch, so a wall face, a wall mass and a floor read as the same
  value. There is no plinth, no dado, no contact shadow: nothing tells the eye
  that a wall is a vertical surface.

### A6. Constraints this diagnosis has to respect

- 79 entities, their positions and their roles do not change.
- Navigation must not get worse. Any cell that was reachable stays reachable.
- Production `data/**`, `game/**`, `tests/**` and `project.godot` stay
  untouched; the trial level is materialised only inside the CI runner.
- No second Knight, HUD, campaign manager or TileSet source.
- The camera is a campaign system (zoom 1). Gate 2 may not change it, so the
  unpainted-cell problem must be solved *inside* the frame, not by zooming.

---

## Phase B — three spatial concepts

### Concept 1 — "Annex" (Gate 1's approach, for comparison)

Add new rooms to the plan: a scriptorium wing, a sanctuary pad, extra geometry
at `x16..34, y21..30`, dressed with the new art.

- **Visual identity:** strong inside the annex, absent outside it. Two languages
  in one frame, with a visible seam where the annex ends.
- **First impression:** unchanged, because the annex is off the spawn sightline.
- **Gameplay readability:** worse. It adds 208 solid cells and a second short
  route, and Gate 1's own review calls the route "one safe route only".
- **Implementation risk:** low mechanically, high for narrative — it needs new
  geometry to be blessed into production, which Gate 1 explicitly forbade.
- **SoH consistency:** good art, wrong argument. A crypt with an archive room
  attached is not an archive.

**Rejected** — this is the approach that produced 81/100.

### Concept 2 — "Carved cloister" (chosen)

Do not re-plan. **Read Candidate A's plan as one building** and make the reading
explicit:

- the heart of the map (`x41..54, y13..17`) becomes a **flooded cloister garth**;
  the corridors that already ring it become its **ambulatory**;
- the nave's north wall gets a real **alcove** cut for the **open armarium**, on
  the artery and therefore on the spawn sightline;
- the whole of Level 3 gets **one stone language** — flagstone floor, plinth and
  two-course ashlar on every wall face, dressed wall mass, contact shadow —
  composited in untinted layers over Candidate A's grey tiles;
- every unpainted cell within camera reach becomes **rock the building is cut
  into**, graded from the wall mass at the edge to near-black at twenty cells,
  so the frame falls away into darkness instead of stopping at a black border;
- **20 whole-sprite props** in three groups that tell one story (closed stacks
  in the nave, one abandoned copyist station, a cleared reading room in the east
  with a long board used as cover), plus three warm/cold light pools.

Only **one** cell-level change to the level document: 12 cells of the nave's
north wall become floor, for the alcove. It is strictly additive.

- **Visual identity:** one archive, everywhere the camera goes, including the
  floors above and below.
- **First impression:** at spawn the eye gets warm flagstone, a lit armarium on
  the artery eleven cells away, and rock receding into darkness.
- **Gameplay readability:** unchanged plan, so every authored route, hazard and
  encounter stays where the designers put it. Cover is *added* in the east room
  (a long board) without closing anything.
- **Implementation risk:** low. One additive geometry edit, everything else is
  presentation in prototype-local layers.
- **SoH consistency:** reuses Candidate B's approved palette with provenance,
  keeps Candidate A's level design intact, and does not ask production to adopt
  a new level format.

**Chosen.**

### Concept 3 — "Reliquary spine"

Re-plan the nave into a three-aisle basilica: a processional spine down the
centre, side aisles of stacks, an apse at the west end, the garth beyond a
screen of columns.

- **Visual identity:** the strongest of the three, and the closest to a real
  monastic library plan.
- **First impression:** excellent — a threshold, a centre line, a destination.
- **Gameplay readability:** genuinely better sightlines, but it requires
  re-cutting roughly 400 cells of masonry, which changes where walls, cover and
  corridors are for every enemy in the level. `reachable` cell counts would move
  in both directions, and the 79 entities would have to be re-checked one by
  one against a new plan.
- **Implementation risk:** high. This is a level-design change wearing an art
  change's clothes, and the brief says a change to the gameplay contract must be
  *proposed*, not smuggled in.
- **SoH consistency:** high, but it invalidates Candidate A's tuning.

**Rejected for this gate, documented as a proposal** (see
`GATE2_REPORT.md` → "Proposals, not implemented"). If the archive is ever given
its own chapter, this is the plan to build.

### Comparison

| | 1 Annex (Gate 1) | 2 Carved cloister (**chosen**) | 3 Reliquary spine |
| --- | --- | --- | --- |
| Visual identity | inside the annex only | one language across the level | strongest, new plan |
| First impression at spawn | unchanged (off the sightline) | armarium + garth + rock falloff | threshold + centre line |
| Gameplay readability | adds a second, short route | plan untouched; adds cover | needs re-tuning of every encounter |
| Implementation risk | medium (needs new geometry blessed) | low (12 additive cells) | high (≈400 cells re-cut) |
| SoH consistency | art yes, argument no | art + plan + provenance | art yes, plan replaced |
| Uses the void (77 % of frame) | no | yes, by construction | partly |
| Reversible | yes | yes, delete two files | hard to undo |

### What would make me abandon Concept 2

- If the alcove carve cost any reachable cell, or disconnected an entity. The
  authoring validator fails the build in that case.
- If the props could not be placed without covering authored floor or entity
  art. The validator fails the build in that case too.
- If the rock treatment looked like wallpaper rather than depth in the native
  frames. That is what the first CI iteration is for; if it does not convince at
  1280x720, the falloff gets stronger before anything else is added.
