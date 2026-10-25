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
(`docs/chapter1-audit/logs/chapter_1_level_N.txt`):

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
level 1  ENVIRONMENT BEDROCK: enclosed_void=112  outside_void=3052
level 2  ENVIRONMENT BEDROCK: enclosed_void=762  outside_void=9886
level 3  ENVIRONMENT BEDROCK: enclosed_void=182  outside_void=3454
level 4  ENVIRONMENT BEDROCK: enclosed_void=640  outside_void=3368
```

## 4. Workflow state

| Workflow | At baseline `e613242` | At this pass | Note |
| --- | --- | --- | --- |
| Chapter 1 — architecture breakthrough | success at `3215a15`, then failure at `0a7bbce` | **success** at `7f8e765` | The failure was this pass's own regression: the schema rejected the headroom. Fixed in `951552f`, verified green. Includes the frozen Level 5 suites, the collision route test and the map design tests |
| Chapter 1 — audit sweep | success | **success** | Regenerated the mosaics from the branch; this is what the AFTER evidence is |
| Chapter 1 — visual overhaul | success | in progress at time of writing | Pre-existing path; not a gate for this pass |
| Godot 4.7 Runtime Validation | **failure** | **failure** | Pre-existing at the baseline and at every commit since. Not caused by, and not fixed by, this pass |
| Level 2 Audition QA | **failure** | **failure** | Pre-existing (`a39dcf1`, `b87dbaf` before this pass) |
| Level 5 — Blood Crucible redesign | **failure** | **failure** | Pre-existing (`9d237bc`, `2d859d5` before this pass) |

No workflow is described as green here unless it is green, and the three pre-existing
failures are separated from this pass's work rather than counted as fixes.

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
