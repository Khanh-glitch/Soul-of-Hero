# Level 5 — Blood Crucible: redesign review

**Status: `TECHNICALLY VALID — VISUAL QUALITY NOT READY`**

This label is deliberately conservative. The map is authored, validated and
reproducible, and the frozen acceptance suites are wired to run against it, but
at the time of writing this document **no native Godot frame of the redesign has
been inspected**. Everything below that describes how the level *looks* is a
derivation from the tile data and from the plan renderer, and it is marked as
such. The label may only move to `READY FOR HUMAN VISUAL REVIEW` after the
native frames published by `.github/workflows/level5-redesign.yml` have been
looked at in `after/` and `comparisons/`, and after the six review frames were
compared against their `before/` partners.

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

The measured tile vocabulary was **8 floor / 8 geometry / 3 decor tiles** for a
5 584-cell floor. The accepted Level 3 rebuild uses 12 / 56 / 30; Level 4 uses
11 / 42 / 13. Level 5 was the least constructed map in the chapter.

## 2. What it is now

The authoring authority moved out of the GDScript generator to
`tools/level5/author.py`, for the same reason Level 2's
did: this level is an ordered architectural compile, and regenerating it from
the rectangle carver would silently erase it. The generator now refuses
`--level=5` by name (and `--level=2`, which was already refused).

The file is the single source of truth. `--check` proves the committed JSON is
byte-identical to the author output; `--write` rewrites it; `--validate` replays
the frozen map contract offline.

| Layer | Before | After | Distinct tiles |
| --- | --- | --- | --- |
| Backdrop | 5 584 | 5 181 | 8 (one flagstone family, five per-room resurfacing grades) |
| Geometry | 1 132 | 1 793 | 35 |
| Decor | 28 | 50 | 10 |
| Entities | 83 | 83 | unchanged IDs and types |

Preserved exactly: 120 × 88, 16 px tiles, three storeys, 4 reciprocal floor
doors, 4 required Sigils, 2 checkpoints, 24 spikes, 10 Skeletons / 5 Reapers /
1 Vampire / 1 Hooded Archer, 3 combat camps (6 / 6 / 4), all reward payloads,
`guaranteed_loot_profile = level_5_archer_soul`, the boss entity
`l5_hooded_archer_miniboss` at cell (95, 74) — that cell is hard-coded in two
frozen tests — and the L5 → L6 promotion contract. No combat stat changes.

**81 of 83 entities moved** (the two that did not are
`l5_hooded_archer_miniboss`, frozen at (95, 74) because two tests hard-code that
cell, and one other that resolved back onto its anchor) and every move is machine-diffable against
`prototypes/level5/baseline/chapter_1_level_5.json`. Positions are resolved by a
deterministic snap: the table in the author holds *design anchors*, and each one
resolves to the nearest cell that is walkable, Knight-clear, off every hazard,
inside its own camp rect, and (for enemies) patrol-clear. Ties break on
`(distance, y, x)`, so the file stays byte-reproducible.

## 3. The design — three floors, one ceremony

The intent is a *blood crucible*: a forecourt where offerings are brought in, a
court where they are ringed and bled, and an arena where the crucible itself is
the floor. Each storey answers the same question differently, which is what
stops the level from being three decorated corridors.

### Floor 1 — Blood Forecourt

- **First-frame landmark.** The spawn cell (10, 17) looks east down a 35-tile
  vestibule whose north wall carries a monumental 2 × 2 sealed gate and whose
  floor is cut by a crimson processional run. The far end is the offering apse:
  a sunken basin with a masonry kerb, broken interior and a burnt floor rim,
  with the blood channel entering and leaving it.
- **Chambers with thresholds.** Vestibule | chapel | nave | reliquary | guard
  court | stair tower are separated by masonry bands (`band_h` / `band_v`) that
  are *pierced* by 3–4-tile doorways with worn thresholds and sconces on the
  jambs. There is no place where two rooms simply share a floor edge.
- **Guard camp.** Six units in the east court, between two buttress anchors,
  with two sconce-lit wall bays behind them.
- **Descent.** The stair tower is a separate chamber to the south-east, entered
  through a second pierced band; the floor door sits under a stair lip.

### Floor 2 — The Blood Court

- **A ring, not a corridor.** The storey is a loop around a **solid ceremonial
  island** (26 × 8 cells of masonry). The player enters at the west landing and
  must choose the north bank or the south bank; both rejoin at the east breach.
  A straight line is impossible by construction, not by clutter.
- **Checkpoint breather.** The landing is the only short room on the level and
  carries the first checkpoint, a sealed gate and a descent lip.
- **Blood Court hall.** The Vampire holds an altar on a raised north dais, with
  two reaper anchors and three swordsmen in front of it, under a barred arch
  recessed into the north wall.
- **Reliquary vault.** A low chamber hanging south of the hall: three coffins, a
  blue-draped altar, and the level's second chest.

### Floor 3 — Antechamber and the Crucible Arena

- **Last guard.** Four units in a hall with a blue-draped altar, a stone arch
  recessed into the north wall, and a broken east wall.
- **Foreshadowing.** The antechamber is deliberately *narrow* (11 wide) and holds
  the second checkpoint and the second chest; its mouth frames the arena, so the
  player sees the crucible before committing to it.
- **The arena.** A 35 × 21 bowl: the sunken crucible sits west of centre under a
  masonry rim, four buttresses stand at the corners, two tier lines step the
  floor down toward the bowl, a crimson pool marks the Archer's ground, and the
  exit dais is engaged into the east wall. The Archer spawns at (95, 74), with a
  clear 165-px east stance for the boss capture and cover lanes on both sides.
- **The pick-up.** Killing the Archer drops `level_5_archer_soul` as ordinary
  ground loot, physically claimed as before; the map change does not touch that
  path.

## 4. What is verified, and how

Verified in this environment (Python, no engine):

- `python3 tools/level5/author.py --validate` → `CONTRACT: OK`.
  The validator replays, offline, the rules the frozen suites assert: schema
  bounds, no floor/geometry overlap, entity-on-floor, three floor components,
  door reciprocity and arrival pads, player reachability over doors, spawn
  clearance (240 px enemy / 160 px trap), checkpoint clearance (150 px / 64 px),
  camp membership, camp spacing (55–560 px), patrol cardinal clearance, spike
  dodge space and spike-free route to every Sigil and the exit, per-type counts,
  the named Archer arena, and **Knight-sized route clearance** (a cell is clear
  iff neither it nor the cell above it is Geometry — the live `BodyShape` is a
  12 × 16 rectangle at `(0, −8)`).
- `--check` → byte-identical to the committed JSON (round-trips through
  `json.dumps(indent=2, ensure_ascii=False)` + trailing newline). Redesign
  SHA-256: `77fc8f17759257b672d4136d28a5e7bfb1754d5aae9689199290858542c7ee50`.
- Cross-level invariants measured directly: all ten campaign floor masks differ
  by ≥ 500 cells pairwise, and L5/L6 Jaccard overlap is 0.491 (limit 0.65).
- `git diff --stat a1ae892` touches only `data/levels/chapter_1_level_5.json`
  and the generator guard: Levels 1–4 and 6 are byte-unchanged.

**Not verified here, and therefore not claimed:**

- Any native frame. No captured image of this level exists yet in `after/`.
- The frozen suites themselves. `tests/` is untouched and unrun in this
  environment; `.github/workflows/level5-redesign.yml` runs
  `chapter_1_map_design_test`, `chapter_1_campaign_map_design_test`,
  `chapter_1_level_5_miniboss_test`, `level_5_archer_pickup_test`,
  `chapter_1_level_5_live_loot_regression`, `chapter_1_collision_route_test` and
  `chapter_1_balance_matrix_test` against the committed map. Until that run is
  green, "technically valid" means *offline* valid.
- Silhouette read at a glance, camera framing, HUD legibility, and whether the
  crucible reads as a crucible without text. Those are the human questions.

## 5. Evidence pipeline

`tools/captures/level5_blood_crucible_capture.gd` boots the production
`AppRoot` → `AppFlow.start_campaign_level("chapter_1_level_5")`, and photographs
six stations at 1280 × 720: `f1_spawn`, `f1_camp`, `f2_court`, `f2_checkpoint`,
`f3_approach`, `f3_archer` (the last one stages the real phase-2 Soul Mark state
at 165 px from the live Archer, the same stance the frozen boss capture uses).

**Staged, and said so here and in the code:** the Knight is placed at the station
anchor rather than walked there, because a review needs repeatable framings and a
literal walk would depend on the fight's outcome. Nothing about the map, the
entities or the HUD is staged. The anchor is validated against live TileMap
collision, spike cells and body overlap before the shutter opens.

`tools/level5/evidence.py` turns those frames into `comparisons/pair_*.png`
(before/after at full resolution), `evidence/crops/crop4x_*.png` (4× nearest),
`comparisons/comparison_sheet.png`, and two plan route traces. The route traces
are rendered with Pillow and are labelled *PLAN DIAGRAM, not a native capture*.

## 6. The six questions

**1. What was the level before?**
Three stacked bands of hash-floored rectangles with a one-tile 9-slice wall ring:
five rooms per storey, no interior wall, no threshold, 28 decor cells. Enemies
stood in open slabs; the boss arena was a large empty rectangle.

**2. What is it now?**
A three-storey ceremonial sequence — forecourt, ringed court, crucible arena —
built from masonry bands pierced by doorways, with three sunken basins, blood
channels that connect them, per-room floor grades, coffins, altars, statues,
recessed arches and sconce-lit bays, and a level footprint that is an L on floor
1, a loop around a solid island on floor 2, and a bowl on floor 3.

**3. How is it different from Level 3?**
Level 3 is a *crossfire archive*: long sightlines, stacks and bays that give
cover at range, a chasm with bridges. Level 5 never lets you see a whole storey:
its route is a ring you must walk. L3's identity is verticality and open fire
lanes; L5's is enclosure and ceremony.

**4. From Level 4?**
Level 4 is a spiral: pressure that closes in as you rotate. L5 is a *loop with a
solid heart* — you go around something you can never enter, and the two banks are
symmetric in function but not in dressing (north bank is processional, south bank
is a reliquary vault). L4 rewards pushing forward; L5 rewards choosing a side.

**5. From Level 6?**
Level 6 is an anchor-relay lesson: small rooms, a beacon objective, teaching a
mechanic. L5 is the chapter's first *arena* — the boss floor is a bowl with
cover lanes, and the platforming pressure is replaced by ring geometry.

**6. Does it read as a Blood Crucible without text?**
**Unproven.** The tile vocabulary is chosen for it — crimson processional runs,
sunken basins with broken kerbs, burnt rims, hanging banners, coffins, stone
altars, statues, a void seen through the basin interior — and the three basins
are on the processional axis of all three storeys. Whether that survives contact
with the actual engine, palette and camera is exactly what the native frames must
answer. The plan renders say "stone rooms with ceremonial furniture"; they cannot
say more, because they render no sprites, no lighting and no HUD.

**7. Traversal, boss and pick-up.**
Traversal: every objective and every combat marker is reachable with Knight
clearance, every spike has at least two safe neighbours, and no Sigil or the exit
requires crossing a hazard (offline proof; the native `collision_route_test` must
confirm it). Boss: unchanged entity, unchanged cell, unchanged stats, unchanged
drop; the arena around it changed from an empty rectangle to a bowl with four
buttresses and two cover lanes. Pick-up: the Soul still drops as ground loot
inside the 80-px death radius and is claimed by walking over it; the auto-pickup
radius (96 px) and the transaction key are untouched.

**8. Remaining weaknesses.**
- Floor 1's nave is still long; at 1280 × 720 the camera will show about 80 × 45
  tiles, so the basin landmark and the vestibule gate are never in frame
  together. That is intentional (two beats) but unverified in motion.
- The interior masonry is entirely one tile family (`0x72`) plus one 9-slice
  shell; there is no second stone language to distinguish "ceremonial" from
  "service" areas. A second material pass is the obvious next upgrade.
- The reliquary vault on floor 2 is reached from the hall only; it is a dead end
  with no return shortcut, so a player who skips it never sees the chest.
- No lighting pass was authored. Torches are entities, and their light is the
  game's, not the map's — the "damaged crucible" mood depends on it.
- The plan renderer is ~3.4× darker than a native frame (measured: mean luminance
  10.5 vs 36.7 on the same crop of Level 3), so judgements made from plan renders
  systematically understate contrast.

## 7. Self-score

**Not scored yet.** A numeric score before native frames exist would be a guess
dressed as a measurement, and the brief only accepts a score as *justification*
for submitting, never as a substitute for the evidence. The score will be added
with the frames.

## 8. How to review this

1. `after/` — six native 1280 × 720 stations of the redesign.
2. `before/` — the same six stations of the pinned baseline.
3. `comparisons/pair_*.png` — the same station, before beside after.
4. `comparisons/comparison_sheet.png` — all six after-frames on one sheet.
5. `evidence/crops/crop4x_*.png` — 4× nearest-neighbour architecture crops.
6. `evidence/route_trace_after.png` / `_before.png` — authored route, plan only.
7. `evidence/logs/` — every suite log, the capture logs, the source pin.

Approve, reject, or name the storey that fails. Level 6 is not started until
Level 5 is visually approved.

---

## 9. Change inventory (for the reviewer's diff)

| Path | Change | Why |
| --- | --- | --- |
| `data/levels/chapter_1_level_5.json` | regenerated by the new author | the redesign itself |
| `tools/level5/author.py` | new | single source of truth for Level 5 |
| `tools/level5/render_level_plan.py` | new | offline plan renderer (documentation only) |
| `tools/level5/evidence.py` | new | pairs, 4× crops, sheet, route traces |
| `tools/captures/level5_blood_crucible_capture.{gd,tscn}` | new | the six native review stations |
| `prototypes/level5/baseline/chapter_1_level_5.json` | new (verbatim `git show a1ae892:…`) | frozen BEFORE source |
| `tools/generators/generate_chapter_1_levels_2_to_5.gd` | refuses `--level=5` and `--level=2` | cannot silently erase an authored level |
| `.github/workflows/level5-redesign.yml` | new | native capture + acceptance/evidence gates |
| `docs/level-design/level5-redesign/**` | new | this review, frames, crops, logs |

Untouched: `game/**`, `tests/**`, `assets/**`, `project.godot`, Levels 1–4,
Level 6, every `.tres`, every reward, every progression rule.

## 10. Reverting

    cp prototypes/level5/baseline/chapter_1_level_5.json data/levels/chapter_1_level_5.json
    # or, to go back to the tree of record entirely:
    git checkout a1ae892 -- data/levels/chapter_1_level_5.json

Re-applying the redesign is one command:

    python3 tools/level5/author.py --write
