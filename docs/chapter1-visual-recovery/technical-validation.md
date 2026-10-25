# Technical validation

Everything below was run on `arena/6e89e68d-soul-of-hero`. Where a number comes
from a CI log, the run is named. Where it comes from a local run, the command is
given so it can be repeated.

## 1. Generators and determinism

All six architecture generators run clean, and re-running them produces byte-identical
files (the architecture workflow enforces this for L5 and L7; it was also checked by
hand for L6, L8, L9 and L10).

| Generator | Result |
| --- | --- |
| `tools/level5/architecture.py` | `ARCHITECTURE: OK` — floor 656 (656 unique), wall 26, props 169, lights 29, 90 floor claims resolved, 16 competing lanes reported |
| `tools/level6/architecture_relay.py` | `validation: clean` — props 156, lights 75, 25 resized |
| `tools/level7/architecture_vigil.py` | `validation: clean` — props 213, 20 store cells now resolve to `barrel` |
| `tools/level8/architecture_reliquary.py` | `validation: clean` — 21 lights resized |
| `tools/level9/architecture_gatehouse.py` | `validation: clean` — 23 lights resized, portcullis placed |
| `tools/level10/architecture_castellan.py` | `validation: clean` — 20 lights resized |

Art generators: `art_crucible.py` (27 tiles, 25 props), `art_gatehouse.py` (47 tiles,
18 props), `art_reliquary.py` (129 tiles, 19 props). Each kit is regenerated and
compared in the architecture workflow.

## 2. Document validation

`python3 tools/validate_chapter1_art_refs.py`

```
Chapter 1 art reference validation: 6 architecture document(s), 6 kit(s).
PASS: every authored frame resolves to a kit atlas.
```

Before the Gate A repairs this check reported exactly three problems, and they were
the audit's three: L5's missing `kit` field, L7's `barrels` at 20 cells, L8's
`banner_pale` at 2 cells. That is the check validating itself against a known answer
rather than against its own assumptions.

`tools/validate_chapter_1_assets.ps1` now runs the same check as part of the chapter
asset gate, and the architecture workflow runs it as its own step.

## 3. Native runtime evidence

From the audit sweep's published logs on the branch
(`docs/chapter1-visual-recovery/after/logs/chapter_1_level_N.txt`):

```
level 5  CRUCIBLE ART: floor_detail=5761 wall_cells=3303 bedrock=4609 props=169 lights=29 shadows=506
         AUTHORED PROPS: missing=0 clamped=0
level 6  CRUCIBLE ART: floor_detail=6300 wall_cells=2720 bedrock=6155 props=156 lights=75  shadows=360
         AUTHORED PROPS: missing=0 clamped=0
level 7  CRUCIBLE ART: floor_detail=7211 wall_cells=844  bedrock=2334 props=213 lights=22  shadows=108
         AUTHORED PROPS: missing=0 clamped=0
level 8  CRUCIBLE ART: floor_detail=7296 wall_cells=1114 bedrock=4956 props=96  lights=45  shadows=266
         AUTHORED PROPS: missing=0 clamped=0
level 9  CRUCIBLE ART: floor_detail=5668 wall_cells=810  bedrock=5340 props=71  lights=29  shadows=100
         AUTHORED PROPS: missing=0 clamped=0
level 10 CRUCIBLE ART: floor_detail=4444 wall_cells=572  bedrock=2922 props=41  lights=23  shadows=68
         AUTHORED PROPS: missing=0 clamped=0
```

`missing=0` on every level is the Gate A assertion: no document anywhere in the
chapter requests a frame its kit cannot draw. `clamped=0` is the Gate B assertion:
with the headroom in place, no prop needed to be moved down to stay inside the world.

For Level 1–4, the native pass prints the void counts, and they match the audit's
independent count exactly:

```
level 1  ENVIRONMENT BEDROCK: void_cells=3164  headroom_cells=624
level 2  ENVIRONMENT BEDROCK: void_cells=10648 headroom_cells=984
level 3  ENVIRONMENT BEDROCK: void_cells=3636  headroom_cells=696
level 4  ENVIRONMENT BEDROCK: void_cells=4008  headroom_cells=696
```

Each Level 1–4 log carries two `ENVIRONMENT BEDROCK` lines: the harness loads the
default level (this crypt) before the target level, so Level 1's own line and the
pre-load line are the same one. The line quoted for each level above is that level's.

The counts are `void_cells` (inside the map) and `headroom_cells` (the strip above row
0 that the camera can now look into). Before the single-value correction the line read
`enclosed_void=112 outside_void=3052` for Level 1, and 112/762/182/640 enclosed for
L1–L4 — the same numbers the audit had counted independently, from the other
direction. That agreement is what made the void count trustworthy.

## 3b. Mosaic alignment

The sweep stitches overlapping native frames into a 1:1 mosaic per level, so the
review is of the whole map rather than of five stations. Stitching can lie if a frame
is pasted in the wrong place, so each overlap is checked: the two copies are compared
at zero shift and at every shift within ±4 px, and the shift that actually agrees best
is recorded. The metric runs on edge maps rather than on raw brightness, because the
torches flicker between frames and a brightness comparison is minimised by sliding a
pool rather than by lining up the architecture.

On the mosaics committed with this report
(`docs/chapter1-visual-recovery/after/L*_mosaic.json`):

| level | frames | coverage of authored content | worst overlap shift | overlaps agreeing at 0 |
| --- | --- | --- | --- | --- |
| 1 | 20 | 0.990 | 0 px | 19/19 |
| 2 | 54 | 1.000 | 0 px | 53/53 |
| 3 | 20 | 1.000 | 0 px | 19/19 |
| 4 | 20 | 1.000 | 0 px | 19/19 |
| 5 | 24 | 1.000 | 0 px | 23/23 |
| 6 | 24 | 1.000 | 0 px | 23/23 |
| 7 | 15 | 1.000 | 0 px | 14/14 |
| 8 | 20 | 1.000 | 0 px | 19/19 |
| 9 | 15 | 1.000 | 0 px | 14/14 |
| 10 | 15 | 1.000 | 0 px | 14/14 |

Every overlap on every level agrees best at zero shift, and each mosaic's
`limits_applied` is `true`, i.e. no frame was drawn outside the camera rectangle the
level actually allows. Level 1's 0.990 coverage is its map's own lattice margin, not a
missing frame.

## 4. Workflow state

| Workflow | At baseline `e613242` | At this pass | Note |
| --- | --- | --- | --- |
| Chapter 1 — architecture breakthrough | success at `3215a15`, then failure at `0a7bbce` | **success** at `7f8e765` | The failure was this pass's own regression: the schema rejected the headroom. Fixed in `951552f`, verified green. Includes the frozen Level 5 suites, the collision route test and the map design tests |
| Chapter 1 — audit sweep | success | **success** at `e9f6a6a` | Regenerated the mosaics from the branch into `docs/chapter1-visual-recovery/after/`; this is the AFTER evidence |
| Chapter 1 — visual overhaul | success | **success** at `db05ae6` | Every gate inside it passed with this pass's art: compile check, frozen gameplay suites, capture of all ten levels art-on and art-off, evidence tree, and "verify the art layer built on every level" |
| Godot 4.7 Runtime Validation | **failure** | **failure** | Pre-existing at the baseline and at every commit since. Not caused by, and not fixed by, this pass |
| Level 2 Audition QA | **failure** | **failure** | Pre-existing (`a39dcf1`, `b87dbaf` before this pass) |
| Level 5 — Blood Crucible redesign | **failure** | **failure** | Pre-existing (`9d237bc`, `2d859d5` before this pass) |

No workflow is described as green here unless it is green, and the three pre-existing
failures are separated from this pass's work rather than counted as fixes.

Both evidence jobs spent several runs failing *after* every gate had passed, on the
publishing step, because the branch moved under them mid-capture. That is a publishing
conflict, not an art verdict, and it is fixed rather than tolerated: both now fetch,
rebase and retry, and say so in the log. The distinction matters in both directions —
a red build that only means "someone pushed" teaches the team to ignore red builds.

## 5. Gameplay invariants

The pass touched three kinds of file: presentation (`game/levels/presentation/*.gd`,
`game/levels/level_schema.gd`), level metadata (`camera_bounds` in ten documents) and
art/data (architecture documents, kits, generators).

* **No collision, route, spawn, checkpoint, trigger, entity id, reward or save field
  was edited.** The presentation layers are drawn behind or above the gameplay layers
  and add no collision: `_build_bedrock` fills only cells that are neither floor nor
  geometry, and the facade/wall passes only paint cells that are already solid.
* **`camera_bounds`** changed in one direction only: `top` from `0` to `-96`, i.e.
  the camera may look six rows further up. `left`, `right`, `bottom` are untouched, so
  no existing playable area moved.
* **Level geometry and level order are unchanged**: all ten maps keep their width,
  height, layers and entity lists.
* **The schema change is narrower than it looks.** `HEADROOM_LIMIT` allows `top` down
  to −256 px and nothing else: `left` must still be ≥ 0, the rectangle must stay
  positive, and it must still fit inside the level's right and bottom edges. The
  headroom carries art only.

## 6. What this validation does *not* claim

* It does not claim the chapter is visually finished — see `level-report.md`.
* It does not claim the pre-existing failures are understood, only that they are not
  this pass's.
* It does not claim the BEFORE/AFTER comparison is like-for-like for lighting: the
  light normalisation deliberately changes exposure in L5, L6, L8 and L9, and that is
  the point of the change rather than a correction applied to hide a problem.
