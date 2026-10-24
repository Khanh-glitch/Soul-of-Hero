# Level 5 — Blood Crucible: redesign review

**Status: `TECHNICALLY VALID — VISUAL QUALITY NOT READY`**

Everything the brief asks to be *proved* is proved: the redesign is authored by a
deterministic authority, the frozen suites are green against it in native Godot
4.7, and twelve native 1280 × 720 frames (six after, six before) plus pairs, 4×
crops, a comparison sheet, two route traces and every log are committed under
this directory.

What is **not** yet earned is the visual bar. The frames exist and were reviewed,
they are a large step past the pinned baseline, and they still fall short of "a
level worth approving" on one specific axis: the macro silhouette is still three
stacked bands, and the first frame of a run has no landmark that says *Blood
Crucible* before the player moves. Self-score **80/100** (§9), which is why the
status is not `READY FOR HUMAN VISUAL REVIEW`.

Nothing here claims `FULLY ACCEPTED`. Level 6 was not started.

---

## 1. What was wrong before

Pinned baseline: `git show a1ae892:data/levels/chapter_1_level_5.json`
(SHA-256 `3307f072…0732`, copied verbatim to
`prototypes/level5/baseline/chapter_1_level_5.json`).

The baseline was emitted by `tools/generators/generate_chapter_1_levels_2_to_5.gd`
through `ChapterOneMapBuilder`, and that builder is a rectangle carver:

| Symptom | Cause in the builder |
| --- | --- |
| Every room is the same flat slab | rooms are `carve(x, y, w, h)` calls plus a hash-scattered floor tile from a palette of 8 |
| Walls are one tile tall and read as a painted edge, not as mass | a 9-slice ring of `atlas_walls_low` drawn around each carved rect, no corner grammar, no north courses |
| Corridors, not thresholds | rooms touch each other directly; there is no wall pierced by a door anywhere on the map |
| Three horizontal bands | the three storeys are three y-bands of stacked rectangles, so the silhouettes are near copies of each other |
| Decoration is 28 cells | 3 tiles, placed by hash, no relation to architecture |
| The floor is one slab | a single flagstone tile covered **86 %** of the 5 584-cell floor |

The measured tile vocabulary was **8 floor / 8 geometry / 3 decor tiles**. The
accepted Level 3 rebuild uses 12 / 56 / 30; Level 4 uses 11 / 42 / 13. Level 5
was the least constructed map in the chapter.

## 2. What it is now

The authoring authority moved out of the GDScript generator to
`tools/level5/author.py`: this level is an ordered architectural compile, and
regenerating it from the rectangle carver would silently erase it. The generator
now refuses `--level=5` by name (and `--level=2`, which was already refused).

The file is the single source of truth. `--check` proves the committed JSON is
byte-identical to the author output; `--write` rewrites it; `--validate` replays
the frozen map contract offline; `--stats` prints the vocabulary below.

| Layer | Before | After | Distinct tiles (after) | Dominant tile |
| --- | --- | --- | --- | --- |
| Backdrop | 5 584 | 5 105 | 8 | 86 % → **45 %** |
| Geometry | 1 132 | 1 968 | 38 | 31 % → 18 % |
| Decor | 28 | 50 | 10 | 43 % → 24 % |
| Entities | 83 | 83 | unchanged IDs and types | — |

Redesign SHA-256: `d0e623097b3cd8d568d8f2834e10b3ffa93306071428c9b8c2a0e615d8c8552a`
(1 099 685 bytes).

Preserved exactly: 120 × 88, 16 px tiles, three storeys, 4 reciprocal floor
doors, 4 required Sigils, 2 checkpoints, 24 spikes, 10 Skeletons / 5 Reapers /
1 Vampire / 1 Hooded Archer, 3 combat camps (6 / 6 / 4), all reward payloads,
`guaranteed_loot_profile = level_5_archer_soul`, the boss entity
`l5_hooded_archer_miniboss` at cell (95, 74) — that cell is hard-coded in two
frozen tests — and the L5 → L6 promotion contract. No combat stat changes.

**81 of 83 entities moved**; the two that did not are
`l5_hooded_archer_miniboss` (frozen at (95, 74)) and `door_l5_f2_f3_up`, whose
anchor resolved onto the pinned cell. Every other move is machine-diffable
against `prototypes/level5/baseline/chapter_1_level_5.json`. Positions are
resolved by a deterministic snap: the table in the author holds *design anchors*,
and each one resolves to the nearest cell that is walkable, Knight-clear, off
every hazard, inside its own camp rect, and (for enemies) patrol-clear. Ties
break on `(distance, y, x)`, so the file stays byte-reproducible.

## 3. The design — three floors, one ceremony

The intent is a *blood crucible*: a forecourt where offerings are brought in, a
court where they are ringed and bled, and an arena where the crucible itself is
the floor. Each storey answers the same question differently.

### Floor 1 — Blood Forecourt

- **Entry.** The spawn cell (10, 17) is a procession entry: a green-draped altar
  in the north wall, paired buttress masses framing the walk east, a coffin
  against the south wall, and sconce-lit bays. *Honest correction after the
  native frames: this is an entry that reads as a chapel vestibule, not a
  landmark. See §4 and §8.*
- **Chambers with thresholds.** Vestibule | chapel | nave | reliquary | guard
  court | stair tower are separated by masonry bands (`band_h` / `band_v`) that
  are *pierced* by 3–4-tile doorways with worn thresholds and sconces on the
  jambs. There is no place where two rooms simply share a floor edge.
- **The offering apse.** A sunken basin (masonry kerb, broken interior, burnt
  floor rim) on the nave's north wall, fed and drained by crimson channels; the
  nave now carries a full north colonnade and a south buttress row so the room
  has bays instead of one slab.
- **Guard camp.** Six units in the east court, between two buttress anchors,
  with three sconce-lit wall bays behind them.
- **Descent.** The stair tower is a separate chamber to the south-east, entered
  through a second pierced band; the floor door sits under a stair lip.

### Floor 2 — The Blood Court

- **A ring, not a corridor.** The storey is a loop around a **solid ceremonial
  island** (27 × 9 cells of ashlar). The player enters at the west landing and
  must choose the north bank or the south bank; both rejoin at the east breach.
  A straight line is impossible by construction, not by clutter.
- **The island is the crucible.** It is capped on its north face, brick through
  the body and shaded on its south, and the sunken basin is cut into it, so the
  centrepiece reads as a mass with a worked cavity, not as a hole in the floor.
- **Checkpoint breather.** The landing is the only short room on the level and
  carries the first checkpoint, a sealed gate and a descent lip.
- **Blood Court hall.** The Vampire holds an altar on a raised north dais, with
  reaper anchors and swordsmen in front of it, under a barred arch recessed into
  the north wall; the hall now has colonnade bays on both long walls.
- **Reliquary vault.** A low chamber hanging south of the hall: three coffins, a
  blue-draped altar, and the level's second chest.

### Floor 3 — Antechamber and the Crucible Arena

- **Last guard.** Four units in a hall with a blue-draped altar, a stone arch
  recessed into the north wall, pier teeth, and a broken east wall.
- **Foreshadowing.** The antechamber is deliberately *narrow* (11 wide) and holds
  the second checkpoint and second chest; its mouth frames the arena, so the
  player sees the crucible before committing.
- **The arena.** A bowl with the sunken crucible west of centre under a masonry
  rim, four corner buttresses, bracket bays on the north and south walls, two
  tier lines that step the floor down toward the bowl, a crimson pool marking the
  Archer's ground, and the exit dais engaged into the east wall. The Archer
  spawns at (95, 74) with a clear 165-px east stance and cover lanes on both
  sides.
- **The pick-up.** Killing the Archer drops `level_5_archer_soul` as ordinary
  ground loot, physically claimed as before; the map change does not touch that
  path.

## 4. What the native frames showed (round 5 correction pass)

This is the first round in which the redesign was rendered by the engine. Six
after-frames and their six before-partners were inspected before anything was
changed, and they showed three concrete problems — none of them a contract
failure, all of them visible in every frame:

| What the frame showed | Cause | Correction |
| --- | --- | --- |
| A bottomless black moat around a floating basin in the Blood Court | the uncarved ceremonial core is farther than two tiles from any floor, so `compile_masonry` never skinned it: no floor, no geometry, and the Knight could walk across the level background | `fill_island()` lays real ashlar courses (north cap, brick body, south shade) |
| Halls that read as flat slabs with furniture on them | four free-standing blocks in a 40 × 17 hall, one-tile walls | `colonnade_line()` adds wall-attached bays to the F1 nave and guard court, the F2 hall, the F3 last-guard hall and both arena walls |
| A repeating waffle floor in every frame | one flagstone covered 70 % of the floor and every room reused it | the slab hash now spreads eight slabs at 40 / 22 / 14 / 10 %, and `KIND_FLOOR` gives each room family six of eleven slots of its own wear: dominant slab 45 % |
| 4× crops that were portraits of the Knight on empty floor | the crop window was a fixed fraction of the frame | the crop centre is derived from the level document: the window that is closest to 42 % masonry and still contains floor, around the station anchor |

Measured after the pass: floor 5 181 → 5 105 cells, geometry 1 793 → 1 968 cells,
dominant floor tile 70 % → 45 %.

What the frames **still** show, and this pass did not fix:

- The macro silhouette is still three horizontal bands. Each storey is a
  different *plan* (L, ring, bowl), but at the campaign-map scale the three
  outlines are stacked slabs, which is the one shape the brief named as a
  failure mode.
- The spawn frame has no landmark. The offering apse is 34 tiles east, outside
  the first frame; the vestibule reads as a chapel anteroom.
- Wall mass is still mostly one tile thick behind the colonnades, and there is
  one stone language: `0x72` plus a 9-slice shell. Ceremonial and service space
  are told apart by furniture, not by masonry.
- The Blood Court island is now a large, fairly undifferentiated brick mass; it
  reads as an altar platform rather than as a crucible at 1× zoom.

## 5. What is verified, and how

Every line below is a native Godot 4.7 run against the committed map, published
in `evidence/logs/`. The job is `.github/workflows/level5-redesign.yml`; its two
gates are the only steps that can turn it red.

| Check | Result | Log |
| --- | --- | --- |
| Authoring contract (`--validate`) | `CONTRACT: OK — 5105 floor / 1968 geometry / 50 decor cells, 83 entities` | `validate.txt` |
| Byte reproducibility (`--check`) | `data/levels/chapter_1_level_5.json is byte-identical to the author output` | `check.txt` |
| `chapter_1_map_design_test` | `CHAPTER 1 MAP DESIGN 837/837` | `chapter_1_map_design_test.txt` |
| `chapter_1_campaign_map_design_test` | `PASSED — 46 292 checks across ten maps` | `chapter_1_campaign_map_design_test.txt` |
| `chapter_1_level_5_miniboss_test` | `PASSED — 77 checks` | `chapter_1_level_5_miniboss_test.txt` |
| `level_5_archer_pickup_test` | `PASSED — 59 checks` | `level_5_archer_pickup_test.txt` |
| `chapter_1_level_5_live_loot_regression` | `PASSED — 22 checks` (run as its scene: it boots autoloads) | `chapter_1_level_5_live_loot_regression.txt` |
| `chapter_1_collision_route_test` | `PASSED — 161 checks across ten live maps` | `chapter_1_collision_route_test.txt` |
| Campaign entry/completion, slot 5 | `PASSED: slot=5 point=mid` and `point=end` | `campaign_mid.txt`, `campaign_end.txt` |
| Levels 1–4 and 6 untouched | `git diff a1ae892` on those documents is empty | `unrelated_drift.txt` |
| Pinned baseline unedited | `sha256 = 3307f072…0732` equals `git show a1ae892:…` | `pins.txt`, `baseline_from_history.txt` |

`chapter_1_map_design_test` prints a count, not the word PASSED; the gate matches
each suite's exact success line *and* its check count, so a suite that runs fewer
checks cannot pass.

**One suite is red, and it is not a Level 5 suite.**
`chapter_1_balance_matrix_test` fails (`583 checks`, `FAIL … uses canonical
formula v1`). It asserts on the Hero stat projection and the tempo model and
never reads a level document, and this branch is red on it before the redesign.
The workflow therefore runs it twice — once over this tree, once over the pinned
baseline tree `a1ae892` in a detached worktree — and the Acceptance gate carries
the failure **only** while both runs produce the identical failure set
(`chapter_1_balance_matrix_test.txt` vs `chapter_1_balance_matrix_at_pin.txt`).
A different failure set turns the job red. No expectation was relaxed, and
nothing in `game/**` was touched.

**Not claimed:** that the level is visually finished, that a human has approved
it, or that the plan renders are captures. `evidence/route_trace_*.png` are
labelled PLAN DIAGRAM in their own pixels.

## 6. Evidence pipeline

`tools/captures/level5_blood_crucible_capture.gd` boots the production
`AppRoot` → `AppFlow.start_campaign_level("chapter_1_level_5")` and photographs
six stations at 1280 × 720: `f1_spawn`, `f1_camp`, `f2_court`, `f2_checkpoint`,
`f3_approach`, `f3_archer` (the last stages the real phase-2 Soul Mark windup at
165 px from the live Archer, the same stance the frozen boss capture uses). The
harness has a `--check` mode that boots the scene, prints
`LEVEL5 HARNESS CHECK OK: level=… floor_cells=… entities=…` and quits, so a
compilation or registry break is caught before a fifteen-minute capture.

**Staged, and said so here and in the code:** the Knight is *placed* at the
station anchor rather than walked there, because a review needs repeatable
framings and a literal walk would depend on the fight's outcome. Nothing about
the map, the entities or the HUD is staged; the anchor is validated against live
TileMap collision, spike cells and body overlap before the shutter opens, and
the harness logs `LEVEL5 REVIEW STATION MOVED` if it ever has to step aside.
The `--check` and campaign passes use no teleport at all.

`tools/level5/evidence.py` turns the frames into `comparisons/pair_*.png`,
`evidence/crops/crop4x_*.png` (4× nearest, centred on architecture), the
comparison sheet, and the two plan route traces.

## 7. The six questions

**1. What was the level before?**
Three stacked bands of hash-floored rectangles with a one-tile 9-slice wall ring:
five rooms per storey, no interior wall, no threshold, 28 decor cells, one
flagstone over 86 % of the floor. Enemies stood in open slabs; the boss arena was
a large empty rectangle.

**2. What is it now?**
A three-storey ceremonial sequence — forecourt, ringed court, crucible arena —
built from masonry bands pierced by doorways, with three sunken basins, blood
channels that connect them, per-room floor families, coffins, altars, statues,
recessed arches and sconce-lit bays; an L on floor 1, a loop around a solid
ashlar island on floor 2, a tiered bowl on floor 3.

**3. How is it different from Level 3?**
Level 3 is a *crossfire archive*: long sightlines, stacks and bays that give
cover at range, a chasm with bridges. Level 5 never lets you see a whole storey:
its route is a ring you must walk. L3's identity is verticality and open fire
lanes; L5's is enclosure and ceremony.

**4. From Level 4?**
Level 4 is a spiral: pressure that closes in as you rotate. L5 is a *loop with a
solid heart* — you walk around something you can never enter, and the two banks
are symmetric in function but not in dressing (north bank processional, south
bank reliquary vault). L4 rewards pushing forward; L5 rewards choosing a side.

**5. From Level 6?**
Level 6 is an anchor-relay lesson: small rooms, a beacon objective, teaching a
mechanic. L5 is the chapter's first *arena* — the boss floor is a bowl with
cover lanes, and platforming pressure is replaced by ring geometry.

**6. Does it read as a Blood Crucible without text?**
**Partly.** The native frames support three of the four intended readings: the
court centrepiece now reads as a worked stone mass with a sunken basin; the
processional crimson runs and the sconce-lit bays read as ceremony; the arena
reads as a bowl with a rim, cover and a dais. What does not read is the *entry*
— the first frame is a chapel anteroom, not a threshold into a crucible — and the
survey silhouette of all three storeys is still three bands. That is the honest
answer, and it is why this document does not ask for approval yet.

**7. Traversal, boss and pick-up.**
Traversal: every objective and combat marker is reachable with Knight clearance
(12 × 16 mask), every spike has at least two safe neighbours, no Sigil or exit
requires crossing a hazard — reproduced offline by `--validate` and natively by
`chapter_1_collision_route_test` (161 checks) and `chapter_1_campaign_map_design_test`
(46 292 checks). Boss: unchanged entity, cell, stats and drop; the arena around
it became a bowl with corner buttresses, bracket bays and two tier lines.
Pick-up: the Soul still drops as ground loot inside the 80-px death radius and is
claimed by walking over it; `level_5_archer_pickup_test` (59 checks) and
`chapter_1_level_5_live_loot_regression` (22 checks) both pass.

**8. Remaining weaknesses.**
- Three stacked bands is still the campaign-map silhouette (§4).
- No entrance landmark in the spawn frame (§4).
- One stone language; no second material for ceremonial vs service space.
- The Blood Court island reads as an altar platform at 1× rather than a crucible.
- The reliquary vault is a dead end with no return shortcut.
- No lighting pass was authored; torch light is the game's, not the map's.
- The plan renderer is ~3.4× darker than a native frame, so plan renders
  systematically understate contrast — never judge from them.

## 8. Self-score

| Dimension | Weight | Score | Why |
| --- | --- | --- | --- |
| Architectural construction (mass, corners, depth) | 20 | 14 | colonnades, buttresses, caps, tiers and a solid island; walls still mostly one tile |
| Identity and landmark (reads as a blood crucible) | 15 | 10 | basins, gutters, altars and drapery carry it; the entry does not |
| Storey differentiation | 15 | 12 | L / ring / bowl plans, distinct floor families, antechamber narrowing |
| Traversal and readability | 15 | 14 | verified natively; ring route choice is legible |
| Encounter staging | 10 | 8 | camps, cover lanes, boss arena; arena cover is modest |
| Art integrity (whole props, no composites, no tiling) | 10 | 8 | whole-sprite props, 45 % dominant slab; repeated niche motif remains |
| Evidence completeness | 10 | 9 | twelve native frames, pairs, crops, sheet, traces, logs, pins, source SHA |
| Documentation | 5 | 5 | this document plus `evidence/README.md` |
| **Total** | **100** | **80** | below the 85 the brief requires to submit for review |

## 9. How to review this

1. `after/` — six native 1280 × 720 stations of the redesign.
2. `before/` — the same six stations of the pinned baseline.
3. `comparisons/pair_*.png` — the same station, before beside after.
4. `comparisons/comparison_sheet.png` — all six after-frames on one sheet.
5. `evidence/crops/crop4x_*.png` — 4× nearest architecture crops.
6. `evidence/route_trace_after.png` / `_before.png` — authored route, plan only.
7. `evidence/chapter_1_level_05_mid_runtime.png` / `_end_runtime.png` — the same
   map entered through the campaign at slot 5, mid and end.
8. `evidence/logs/` — every suite log, the capture logs, the source pin.

Approve, reject, or name the storey that fails. Level 6 is not started until
Level 5 is visually approved.

## 10. Change inventory (for the reviewer's diff)

| Path | Change | Why |
| --- | --- | --- |
| `data/levels/chapter_1_level_5.json` | regenerated by the new author | the redesign itself |
| `tools/level5/author.py` | new | single source of truth for Level 5 |
| `tools/level5/render_level_plan.py` | new | offline plan renderer (documentation only) |
| `tools/level5/evidence.py` | new | pairs, 4× architecture crops, sheet, route traces |
| `tools/captures/level5_blood_crucible_capture.{gd,tscn}` | new | the six native review stations plus `--check` |
| `prototypes/level5/baseline/chapter_1_level_5.json` | new (verbatim `git show a1ae892:…`) | frozen BEFORE source |
| `tools/generators/generate_chapter_1_levels_2_to_5.gd` | refuses `--level=5` and `--level=2` | cannot silently erase an authored level |
| `.github/workflows/level5-redesign.yml` | new | native capture, acceptance gate, evidence gate, pre-existing-failure proof |
| `docs/level-design/level5-redesign/**` | new | this review, frames, crops, logs |

Untouched: `game/**`, `tests/**`, `assets/**`, `project.godot`, Levels 1–4,
Level 6, every `.tres`, every reward, every progression rule.

## 11. Reverting

    cp prototypes/level5/baseline/chapter_1_level_5.json data/levels/chapter_1_level_5.json
    # or, to go back to the tree of record entirely:
    git checkout a1ae892 -- data/levels/chapter_1_level_5.json

Re-applying the redesign is one command:

    python3 tools/level5/author.py --write
