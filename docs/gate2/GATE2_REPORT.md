# Gate 2 — Level 3 Archive Architectural Cohesion & Visual Identity

**Level:** `chapter_1_level_3` · **Engine:** Godot 4.7 stable (CI) · **Branch:**
`arena/6e89e68d-soul-of-hero` · **Evidence run:** GitHub Actions **40010717499**
(`Gate 2 — Archive architectural cohesion (native Godot 4.7)`, success)

> **This is a design review submission, not a production approval.** Nothing here
> has been merged, deployed or promoted. I did not score my own work: Gate 1 was
> scored by the reviewer at 81/100 and Gate 2 should be scored the same way. What
> follows is what was built, what the native frames show, what the tests prove,
> and what is still wrong.

---

## 1. Deliverables

| Phase | Deliverable | Where |
| --- | --- | --- |
| A | Visual diagnosis | `GATE2_CONCEPT_REVIEW.md` §Phase A |
| B | 3 concepts, comparison table, chosen direction | `GATE2_CONCEPT_REVIEW.md` §Phase B |
| C | Reversible, Godot-playable prototype | `prototypes/gate2/`, `tools/gate2/` |
| D | Native 1280x720 frames from the real campaign route | `docs/gate2/evidence/` |
| — | Test results | §5 below, `evidence/logs/` |
| — | Changed-file manifest | §8 below |

Six stations, each as a **before** (Candidate A, untouched) and **after** (Gate 2)
native frame, plus six side-by-side comparison sheets and four labelled 3x
inspection crops. Both runs boot the real `AppRoot` → `AppFlow.start_campaign_level`
route, show the real HUD and the real Knight, and **walk** between stations with
the production input actions — there is no teleport, no mockup, no compositing.

---

## 2. What Gate 2 actually changed

### 2.1 The argument

Gate 1 lost the level on cohesion: an archive annex attached to a grey crypt.
Gate 2 does not add a ninth room. It reads Candidate A's existing plan as **one
building** and makes that reading explicit: the long row-11 corridor becomes the
nave and the main artery, the void the corridors already ring becomes a flooded
cloister garth, and one stone language is laid over the whole level.

Full reasoning, the discarded concepts and the measured diagnosis (three quarters
of the first frame is unpainted in Candidate A) are in
`GATE2_CONCEPT_REVIEW.md`.

### 2.2 The one change to level data

A **12-cell alcove** cut into the nave's north wall (`x25..33, y9..10`) for the
open armarium. Cells that were `Geometry` become `Backdrop`. It is strictly
additive: `Backdrop` 3351 → 3363, `Geometry` 1702 → 1690, `Decor` 73 → 73, entities
79 → 79 and **every entity's id, type and position is byte-identical**. No cell
that was reachable stops being reachable (`author_gate2.py` fails the build if one
does).

### 2.3 Presentation, composited over the level in prototype-local layers

12 `TileMapLayer`s built at runtime from Candidate B's approved atlas — vault
rock in five graded bands, floor flagstone, garth water plus a shoreline pass,
contact shadow, weather decals, dressed wall mass and ashlar wall faces with a
plinth course. None of them is a TileSet source on the level, so the authored
JSON, its two TileSet sources and its collision are untouched.

20 whole-sprite props in three story groups — closed stacks and one abandoned
copyist station in the nave, the armarium in its alcove on the artery, a cleared
reading room with a long board used as cover in the east — plus three light pools.
Ten of them are solid; each collider is derived from its own sprite's rendered
width and height, so a body cannot drift from its art.

### 2.4 Where the archive's identity now lives

Not in furniture. In the **material** and the **plan**: at every one of the six
stations, 100 % of the 80x45-cell camera window is now dressed by Gate 2 material
(measured from `visual_placement.json`), against 12.9–30.7 % authored floor and
51.6–76.9 % unpainted cells in Candidate A. The room reads as a building with
rock around it before a single prop is on screen.

---

## 3. Evidence

All frames in `docs/gate2/evidence/` are native 1280x720 PNGs captured from the
live viewport (`get_viewport().get_texture().get_image()`) by
`prototypes/gate2/capture_gate2.gd`. Logs: `evidence/logs/{before,after,author,
author_check,stats,base_pin,gate2_pin,import,version,sheets}.txt`.

| station | cell | what it is for | before | after |
| --- | --- | --- | --- | --- |
| spawn | (17,13) | first impression on the authored spawn | `before_spawn.png` | `after_spawn.png` |
| archive_entry | (23,12) | the architectural transition onto the artery | `before_archive_entry.png` | `after_archive_entry.png` |
| landmark | (30,12) | the armarium in its lit alcove | `before_landmark.png` | `after_landmark.png` |
| cloister | (38,18) | the flooded garth from the west ambulatory | `before_cloister.png` | `after_cloister.png` |
| combat_space | (58,21) | the east reading room, long board as cover | `before_combat_space.png` | `after_combat_space.png` |
| return_route | (44,21) | the south ambulatory looking back | `before_return_route.png` | `after_return_route.png` |

Comparison sheets: `comparison_<station>.png` (two native frames, no other
transform). Inspection crops: `inspection_crop_{armarium_alcove,cloister_garth,
reading_room_cover,nave_stacks}_3x.png` — nearest-neighbour 3x crops of an AFTER
frame, labelled as crops, used only to inspect material and prop detail.

`after_combat_space.png` also catches live combat: an enemy engaged and the HUD's
weapon pickup banner on screen, so the frame shows the room under load rather
than posed.

---

## 4. What the frames show (and what they do not)

**Confirmed in the native frames**

- The first frame no longer floats in black. Rock recedes from the building's edge
  into darkness on every side, and the level reads as cut *into* something.
- The armarium is on the artery and on the spawn sightline, lit by its alcove
  lamp: at `archive_entry` and `landmark` it is the largest, warmest object in
  frame, and the player meets it without detouring.
- The garth reads as water in a courtyard: its shoreline pass, the parapet above
  it, and its own light pool. The ambulatory around it reads as a walk.
- Walls read as walls: plinth course at the floor, two courses of ashlar above,
  contact shadow under the wall.
- Props are in the y-sorted `Entities` container, so the knight correctly passes
  in front of the shelves and behind the armarium.
- The HUD, the enemy actors and the campaign route are the production ones.

**Not shown, and cannot be**

- A top-down 2D camera cannot show a wall's top surface, so a long wall still
  reads as a band. The plinth, the two courses and the contact shadow are as far
  as this projection can be pushed without changing the camera.
- The frames are 1280x720 at zoom 1 with the HUD in the way. Roughly a third of
  each frame is still level-adjacent rock rather than archive.

---

## 5. Test results

### 5.1 Design-time validation (`tools/gate2/author_gate2.py`)

The build refuses to write either generated document unless all of the following
hold. All pass at HEAD.

| check | result |
| --- | --- |
| entity list identical to the pinned Candidate A fixture | pass (79 entities, byte-identical) |
| level size unchanged, no layer added or removed | pass (still exactly `Backdrop`, `Geometry`, `Decor`) |
| every cell edit inside the Gate 2 zone | pass (12 cells, all in the alcove) |
| no previously reachable cell lost | pass |
| no entity left standing on non-floor | pass |
| every prop stands on floor in its own standing row | pass (20/20) |
| no prop art overlaps entity art | pass (20/20, 4 px clearance) |
| every solid collider covers floor only | pass (10/10) |
| no two solid colliders overlap | pass |
| no prop cuts off anything larger than a 16-cell dead-end pocket | pass (1 pocket, 9 cells: the recess behind the armarium, which is what a recess is for) |
| no entity sealed behind furniture | pass |
| every authored floor cell carries archive stone | pass (3363/3363) |
| no opaque material layer covers a walkable cell | pass |
| every frame name resolves in the atlas | pass |
| `--check`: generated documents match the committed ones | pass |

### 5.2 Runtime contracts (`capture_gate2.gd`, in CI)

| check | before | after |
| --- | --- | --- |
| Level 3 sha256 pin | `5ea50e9c…` | `3ee945f8…` |
| authored cell counts | 3351/1702/73 | 3363/1690/73 |
| live TileMapLayer cell counts equal authored | pass | pass |
| 79 entities, authored player spawn at (17,13) | pass | pass |
| enemy actors still spawn, container still y-sorted | pass | pass |
| exactly one HUD, HUD visible, Level 1 tutorial hidden | pass | pass |
| Backdrop still declares exactly 2 TileSet sources | pass | pass |
| every placement prop built | — | pass (20) |
| every material layer present with its authored cell count | — | pass (12/12) |
| no material layer covers a walkable cell | — | pass |

### 5.3 Traversal — walked, not teleported

| leg | pixels | cells | frames |
| --- | --- | --- | --- |
| spawn → archive_entry | 97 | 7 | 69 |
| archive_entry → landmark | 113 | 7 | 62 |
| landmark → cloister | 159 | 14 | 186 |
| cloister → combat_space | 323 | 27 | 278 |
| combat_space → return_route | 222 | 18 | 169 |

73 cells walked with the production input actions. The planner is the same
body-safe BFS Gate 1 used (a cell counts as walkable only if the cell and the row
above are open, because the Knight's 12x16 `BodyShape` spans both), extended to
subtract the solid props' footprints and Candidate A's spike cells.

### 5.4 Collision

```
GATE2 COLLISION: Knight at (713.1164, 343.9882) is clear of every wall and prop
GATE2 COLLISION: 10 solid prop footprints probed, each covered by a body
GATE2 COLLISION: open floor at (713.1164, 339.9882) is free of prop bodies
```

A shape query with the Knight's own `BodyShape` at the end of the walk finds
nothing; a point probe inside each of the 10 solid props' authored footprints
finds a `Gate2Collision` body; the same probe on open floor next to him finds
none.

### 5.5 Errors

`grep -E "^ERROR:|^SCRIPT ERROR:"` over both run logs: nothing. The only warnings
are Godot's V-Sync notice, three `ObjectDB` leak notices at shutdown (Gate 1 had
seven), and GitHub's Node 20 deprecation notice.

### 5.6 Repository suite

The branch's own tests pass: the repo's **Godot 4.7 Runtime Validation** workflow
jobs *Xvfb rendered gameplay captures* and *Import and headless runtime tests* are
green at this commit. Its third job, *Original main baseline comparison*, fails —
because it checks out original `main` and runs the same tests there, and original
`main` fails them. That job is red on every commit on this branch, including
`3ebcdf1`, the head of the delivered Gate 0 work; Gate 2 did not change its
status. It is pre-existing and outside this gate's scope.

---

## 6. Unresolved issues

Listed as defects, not as footnotes. None of them is fixed.

1. **The sealed shaft still reads as a hole.** Candidate A's plan has an enclosed
   void at `x27..33, y16..20` inside the nave's south wall, open to the void on its
   fourth side. The "enclosed void becomes masonry" rule does not catch it, and no
   floor is adjacent, so no prop can dress its lip. In `after_landmark.png` and
   `after_spawn.png` it is a dark rectangle. It is at least readable as a pit, but
   it is undressed.
2. **Candidate A's `Decor` art is magenta.** The shelf/grille tiles with pale
   vessels are the only strongly cool objects left in a warm room. A warm multiply
   on that one live layer (logged: `Decor -> (0.966, 0.816, 0.6708, 1.0)`) pulls
   them toward the palette but cannot recolour magenta into stone. Removing them
   would mean editing production art, which is out of scope here.
3. **A long wall still reads as a band.** Plinth, two courses and contact shadow
   are as far as a top-down projection goes. See §4.
4. **The garth is a hard-edged rectangle** because Candidate A's void is one.
   Softening the shoreline means moving geometry, which this gate did not do.
5. **The walk is not a safe route.** The Knight lost 40 HP crossing the level
   (live enemies; HP 1100 → 1060, never critical). More importantly, Candidate A's
   spike at `(46,21)` seals the south walk for a 12 px-wide body, so the only way
   from the west to the east rooms is the artery loop. That is Candidate A's
   design, and it is one of the reasons the level feels like one corridor — but
   Gate 2 did not open it, because opening it is a gameplay change.
6. **The five-band vault falloff can still show band edges** on close inspection
   (see the 3x crops). The bands are 4 cells apart; with the level's own lighting
   on top, the steps are mostly invisible but not perfectly.
7. **Material is applied to all three floors of Level 3; props and lights are on
   floor 1 only.** Descending will show the same stone with Candidate A's sparse
   dressing. The evidence covers floor 1 only — this is a scope limitation, not a
   claim of coverage.

---

## 7. Proposals (documented, deliberately not implemented)

1. **Archive camera zoom.** At zoom 1 the first frame shows 80x45 cells for a
   floor that is 70x22. A modest zoom-in for archive interiors would raise the
   level's share of the screen from 13–31 % to roughly 40–60 % and would improve
   every frame in this report. It changes the campaign's camera contract, so it is
   proposed here and not done.
2. **Open the south ambulatory.** Removing or relocating Candidate A's spike at
   `(46,21)` would make the cloister a real loop instead of a C-shape plus an
   artery detour. That is a gameplay change (hazard placement), so it is proposed.
3. **Replace the magenta `Decor` frames** in production art with a stone-coloured
   family from Candidate B's atlas. Needs production art sign-off.
4. **Make the sealed shaft a room** — the descent to the deep stacks, with stairs
   and a landing. It is the natural next architectural beat of this level and the
   one place where Candidate A's plan is actually wrong rather than under-dressed.
5. **Reliquary spine** (Concept 3). If Level 3 is ever re-planned rather than
   re-dressed, this is the plan to build; see `GATE2_CONCEPT_REVIEW.md`.

---

## 8. Changed-file manifest

Nothing outside the paths below is modified. Verified:
`git diff --name-only 3ebcdf1..HEAD -- data/ game/ tests/ project.godot assets/`
is empty (0 files), and `main` is untouched.

| file | role |
| --- | --- |
| `tools/gate2/author_gate2.py` | authoring source of truth + validator; generates both documents |
| `tools/gate2/preview.py` | offline composition preview — **authoring aid, never evidence** |
| `tools/gate2/make_evidence_sheets.py` | before/after sheets and labelled 3x crops from native frames |
| `tools/gate2/write_source_manifest.py` | provenance: proves all five art copies are byte-identical to Candidate B |
| `prototypes/gate2/gate2_redesign.gd` / `.tscn` | runtime adapter: props, colliders, 12 material layers, lights, Decor tint |
| `prototypes/gate2/capture_gate2.gd` / `.tscn` | native capture harness: campaign boot, contracts, walking, collision, 6 frames |
| `prototypes/gate2/level_data/chapter_1_level_3_gate2.json` | generated trial level (the 12-cell alcove) |
| `prototypes/gate2/visual_placement.json` | generated placement document: props, colliders, material, lights |
| `prototypes/gate2/art/{props.png,props.json,archive_tiles.png,tiles.json,light_radial.png}` | Candidate B's approved atlas copies, pinned by SHA in the source manifest of Gate 1 |
| `.github/workflows/gate2-runtime.yml` | CI: validate, import, capture before, capture after, publish |
| `docs/gate2/GATE2_REPORT.md` | this report |
| `docs/gate2/GATE2_CONCEPT_REVIEW.md` | Phase A diagnosis and Phase B concepts |
| `docs/gate2/SOURCE_MANIFEST.md` | generated provenance table, verified in CI |
| `docs/gate2/evidence/**` | 12 native frames, 6 comparison sheets, 4 labelled crops, 10 logs (CI-published) |
| `.gitignore` | `__pycache__/` (one stray `.pyc` was caught and removed) |

### Provenance and licensing

**Gate 2 adds no new art.** All five art files are Candidate B's approved
audition art, copied byte-for-byte from `e7cad36:prototypes/environment_art/
archive_audition/art/` (the prop atlas, the 40-frame architectural tileset, the
light texture and both frame tables). `tools/gate2/write_source_manifest.py`
records the source commit, both SHA-256 digests and a byte-identical verdict per
file, writes `docs/gate2/SOURCE_MANIFEST.md`, and runs with `--check` in CI — it
fails the build if any copy differs from B's original by one byte. No art was
drawn, generated, downloaded or recoloured for Gate 2 (the only recolouring is a
runtime `modulate` on Candidate A's own live `Decor` layer).

The level data is Candidate A's pinned fixture
(`prototypes/gate0/level_data/chapter_1_level_3_a.json`, SHA-256 `5ea50e9c…`),
edited by 12 cells by `tools/gate2/author_gate2.py`.

---

## 9. Reproduce / revert

```bash
# regenerate and validate both documents (no Godot needed)
python3 tools/gate2/author_gate2.py
python3 tools/gate2/author_gate2.py --check
python3 tools/gate2/author_gate2.py --stats

# native evidence (CI, ~3 minutes)
#   push any change under tools/gate2/, prototypes/gate2/ or the workflow file;
#   the gate2-runtime job materialises the trial level inside the runner only:
#     cp prototypes/gate0/level_data/chapter_1_level_3_a.json data/levels/chapter_1_level_3.json   # before
#     cp prototypes/gate2/level_data/chapter_1_level_3_gate2.json data/levels/chapter_1_level_3.json  # after
```

**Revert:** delete `prototypes/gate2/`, `tools/gate2/`, `docs/gate2/` and
`.github/workflows/gate2-runtime.yml`. No production file was ever modified, so
there is nothing else to undo.

**Stop point:** Gate 2 is delivered for review. No merge, no deploy, no PR
changes.
