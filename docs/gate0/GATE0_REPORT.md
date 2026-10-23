# Gate 0 — Candidate B's archive art inside Candidate A's Chapter 1 Level 3

**Branch:** `arena/6e89e68d-soul-of-hero` · **Evidence run:** [39988534019](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/39988534019) — `success`
(the frames in `docs/gate0/evidence/` are republished by every green run of this
workflow and land in a `ci(gate0): publish Godot 4.7 before/after frames` commit,
together with the comparison and close-up sheets cut from those same frames)
**Status:** M0–M4 complete. Runtime evidence is real Godot 4.7 output. Visual approval is the reviewer's call, not mine.
**Not done, by instruction:** nothing merged, nothing deployed, PR #4 untouched, no campaign/Level 2/`data/**`/`game/**`/`tests/**` change.

---

## 0. Read this first: one deviation from the brief

The brief said to work on `integration/gate0-archive-art` from `78ebc830`. I could not: this
session is pinned to `arena/6e89e68d-soul-of-hero` and I am not permitted to switch, create
or push to another branch. Everything below is on `arena/6e89e68d-soul-of-hero`, branched
from Candidate B's `e7cad36` (which also carries the archive-audition art).

**Consequence, stated plainly:** this branch does **not** contain Candidate A's design-pilot
Level 3 rebuild. Its `data/levels/chapter_1_level_3.json` is the main-branch version
(116×84, 5004/1104/29 cells, 77 entities), not Candidate A's pinned document
(116×96, 3351/1702/73, 79 entities). To keep the gate honest about *which level it decorates*
without touching frozen `data/**`, Candidate A's pinned document travels in the repo as
`prototypes/gate0/level_data/chapter_1_level_3_a.json` (sha256 pinned in code) and the CI job
copies it over the canonical path **inside the ephemeral runner only**, verifying the hash
before and after. Every frame below was rendered from Candidate A's geometry.

Because every Gate 0 commit touches only new files, the change set cherry-picks cleanly onto
`78ebc830`; on that branch the materialise step is a verified no-op. Report §7 has the exact
commands.

## 1. Checkpoints

| | commit | what it established |
|---|---|---|
| M0 | `dcae5af` | B's art copied verbatim; `docs/gate0/SOURCE_MANIFEST.md` records source blob, destination blob and SHA-256 of each file, and **fails** if a byte differs |
| M1 | `0a39e4b` | 15-prop overlay + validator; refuses any level that is not Candidate A's pinned document; byte-identical regeneration; `--check` for CI |
| M2 | `29f8b87` | runtime adapter + capture harness, pushed **before** any runtime experiment |
| M3 | `41bf415` + `+4` fixes | Godot 4.7 workflow; the four fixes were real 4.7 parse/runtime defects, listed in §5 |
| M4 | `41791f4` + `255b771` | native frames, comparison pairs, 4× close-ups, logs, this report; sheets are cut inside the publish step so they always match the committed frames |

## 2. What is integrated

Fifteen of B's own props, ten solid, one evacuation narrative west→east. All are whole
sprites cut from B's untouched `props.png` atlas; no multi-tile asset was split into tiles,
no art was redrawn, recoloured or re-exported (M0's check fails if it were).

| sprite | world (x, base y) | solid | the reason it is there |
|---|---|---|---|
| `shelf_closed` | 296, 176 | ● | bay 17–19: the tall records press above the spawn — the first thing he can identify |
| `shelf_full` | 440, 176 | ● | bay 26–28: a press still full of rolled records |
| `shelf_partial` | 504, 176 | ● | bay 30–32: the same press half-emptied — the evacuation began here and worked west |
| `scroll_roll` | 408, 208 | – | the dropped-scroll trail starts between the desks |
| `desk` | 240, 224 | ● | a writing desk west of the spawn, open page and inkwell facing the room |
| `stool` | 248, 240 | – | its stool, still upright: one station abandoned mid-copy |
| `reading_table` | 136, 256 | ● | a reading table against the west wall |
| `long_table` | 256, 320 | ● | the long board — the piece that makes the hall a workroom, not a corridor |
| `bench` | 304, 352 | ● | pulled out from the board's east end and left askew |
| `shelf_collapsed` | 184, 320 | ● | a press tipped off the west wall, shelving face up |
| `beam` | 200, 320 | – | the beam that came down with the wall |
| `rubble_large` | 384, 352 | ● | fallen vaulting where the record run stopped |
| `scrolls_a` | 600, 320 | – | more of the load dropped towards the exit |
| `lectern` | 600, 352 | ● | the catalogue lectern, left standing by the way out |
| `book_stack` | 680, 352 | – | a stack set down at the doorway and never picked up |

Deliberately **not** used: B's `armarium_open`/`armarium_closed` (drawn to be embedded in a
deep wall; A's north band is 2–4 cells thick, so they would have to be faked), `column`,
`door_portal` (A has its own door art and door entities), `desk_overturned` (repeats the
collapse already told by the tipped press + beam), and all 19 of B's lights.

## 3. Architecture

Prototype-local visual overlay. Nothing is added to the level format.

* `tools/gate0/author_overlay.py` — the single source of truth: placement table + validator.
  Rejects void, entity-art overlap, collider overlap, off-floor bases and route seals, and
  refuses to run against a Level 3 that is not the pinned hash.
* `prototypes/gate0/overlay_level3_archive.json` — **generated**, never hand-edited; 15 props
  with sprite rect, world anchor, cells, collider, intent and provenance.
* `prototypes/gate0/archive_overlay.gd|.tscn` — attaches to the **live** `DungeonLevel`. Whole
  `AtlasTexture` sprites go into A's own y-sorted `Level/Entities`, so props sort against the
  Knight and enemies exactly like A's actors. Each solid prop gets one `StaticBody2D` on
  layer 1, mask 0, under a single `ArchiveCollision` node. It refuses to run unless the live
  level is Level 3 and the container is y-sorted.
* No schema change, no new TileSet source, no second Knight/HUD/campaign node, no second
  collision layer, no extra lights. A's torch lighting and `WorldTint` do all the lighting.
* Props are tinted `[0.84, 0.83, 0.88, 1.0]` to sit inside A's palettised range.

## 4. Verification (all measured, all reproducible)

| check | result |
|---|---|
| Overlay validation vs pinned A geometry | **PASSED** — 15 props / 10 solids, no void, no entity overlap, no collider overlap |
| Route | 978/3351 walkable cells reachable, 30 blocked by overlay colliders, 27 anchors still reachable |
| Determinism | regeneration is byte-identical; CI re-runs `author_overlay.py` and fails on any diff |
| Art provenance | 3 files byte-identical to B's blobs at `e7cad36` (`write_source_manifest.py --check`) |
| Canonical files | `data/**`, `game/**`, `tests/**` untouched (`git status` clean for them); level JSON contains no TileSet source 2 |
| **Real traversal** | Knight walked, with production `move_*` actions, spawn→entry→destination→combat_space: **280,216 → 216,200 → 361,185 → 551,216**, 66/146/192 px, no teleport |
| **Real collision** | Knight clear of every wall and prop at the final station; **all 10 solid prop footprints probed and each covered by a body**; open floor beside him free of prop bodies |
| Frames | 8 × 1280×720 native viewport captures, real HUD, real renderer (Mesa llvmpipe, GL 4.5 / gl_compatibility) |

Exact log lines are in `docs/gate0/evidence/logs/before.txt` and `after.txt`. Frames were
produced by [run 39988534019](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/39988534019),
whose `Publish the frames` step committed them to `docs/gate0/evidence/`, so they are durable
in git rather than an expiring CI artifact (the `gate0-logs` artifact expires in 14 days and is
only a convenience copy).

Durability was verified two ways, not assumed:

* the workflow's own step fetched `…/docs/gate0/evidence/after_spawn.png` back from
  `raw.githubusercontent.com` at the run's commit and logged the result
  (`logs/durability_probe.txt`: 162 786 bytes on the first such run);
* `gh api repos/…/contents/…?ref=<sha>` returns every frame, sheet and this report at the
  commit they were published in.

## 5. Defects found and fixed by running Godot (not by guessing)

1. `39984548139` — manifest check assumed `origin/main`; shallow/short checkout → no branch ref. Fixed by pinning the base commit.
2. `39984790287` — Godot 4.7 refused the harness: `_boot()`/`_attach_overlay()` are coroutines and must be `await`ed; `Input.action_release()` takes one argument. The script failed to load, so the scene never quit and the step died on its 420 s timeout.
3. `39985982659` — HUD's root is a `CanvasLayer`, so `visible` on a `CanvasItem` cast exploded; and the walker wedged on a wall corner because the planner only checked the Knight's feet cell while his 12×16 body spans two rows.
4. `39986305188` — the HUD counter filtered on `CanvasItem` and therefore counted zero HUDs.
5. `39986612418` — first full **success**: both runs passed, but framing was poor.
6. `39987201278` — new stations exposed walk drift (single-axis input let the Knight clip a pillar); fixed by correcting both axes.
7. `39987433621` — both runs pass with the corrected stations; this is the framing that was reviewed.
8. `39987946607` — a later push cancelled its publish step mid-flight (`cancel-in-progress`), so
   the frames it rendered were lost; re-run cleanly instead of reusing them.
9. `39988534019` — **evidence run for this report**: both runs pass, and the publish step now cuts
   the sheets from the frames it is committing, after `c5a0df9` showed sheets from an older run
   surviving a frame refresh.

## 6. Visual review — what the frames actually show

**It works at gameplay scale.** In `after_spawn` the room reads as a records archive in the
first frame: a writing desk with an open page to the Knight's left, the long work board across
the lower hall, two open presses and a partial press along the north wall, and the collapse
tangle in the south-west. In `after_destination` all three presses span the frame and the
joinery around them is visible; the shelves are clearly furniture against the wall, not decals.
In `after_entry` the copyist station, the board with its crockery and the tipped press read as
one working room. Lighting, tint and proportions sit inside A's range — comparing
`comparison_*.png`, the furniture does not glow out of the palette.

Honest weaknesses, visible in the evidence and not hidden by framing:

1. **A's tutorial banner sits across the upper third of every frame.** It is real HUD this gate
   has to show, so it is not cropped away. It covers the top few pixels of the north-wall
   presses at the destination station.
2. **`shelf_closed` reads as a plain dark panel.** At 1× it has no visible shelving, so from
   the spawn it is a large brown box. The open presses carry the archive reading; this one
   carries "emptied". Cheapest fix: swap it for `shelf_partial` and keep the closed press out
   of the first frame.
3. **B's furniture is 1×, A's entities are upscaled.** A draws its torch at scale 2 and its
   coin at 1.5×, so furniture scaled true to the 16 px grid looks small next to them. Scaling
   props up would break pixel anchoring on the tile grid; this is A's existing scale language,
   not a defect introduced here.
4. **The stool is quiet** at 12×12 — it supports the copyist story but does not read on its own.
5. **`rubble_large` touches the floor-door frame** — it reads as debris leaning on the frame,
   which is plausible, but it is a touch rather than a gap.
6. **A pickup toast ("Nhận được")** is visible in the destination frames — the test walk
   happens to pass a coin pickup. It is unmodified gameplay output, not an overlay artefact.

The "before" frames are the same stations of the same level with the overlay absent, so every
change in the pairs is the overlay's.

## 7. Minimum safe changes for permanent integration

1. Move the atlas to `assets/environment/archive/` (nothing else changes; paths are in JSON).
2. Move the placement table into `tools/generators/level_3_crossfire_archive_builder.gd` so the
   builder emits level + placement together, and regeneration stays deterministic.
3. Decide where collision lives permanently: the prototype's generated `StaticBody2D`s are
   fine, but they should be authored and validated with the map rather than attached at boot.
4. Hook `DungeonLevel.reload_from_disk()` and rebuild the overlay, or a hot reload leaves stale
   sprites behind.
5. Tag props with meta/group so `main.gd`'s entity bookkeeping skips them explicitly
   (`entity_root.get_child_count() - 1` in the web readiness report is off by fifteen today).
6. Keep the M3 workflow as the standing gate for this room.

To reproduce on the integration branch:

```bash
git checkout integration/gate0-archive-art          # at 78ebc830
git cherry-pick dcae5af 0a39e4b 29f8b87 41bf415     # M0-M3 source (new files only)
git cherry-pick 41791f4 255b771                     # report + CI sheet fix
# then push; the workflow runs and publishes frames to docs/gate0/evidence/
```

On that branch `data/levels/chapter_1_level_3.json` already is Candidate A's pinned document, so
the workflow's `Materialise` step logs "already is Candidate A's pinned document" and changes
nothing.

## 8. Unresolved defects / limitations

* **Branch divergence, §0** — this work is on `arena/6e89e68d-soul-of-hero`; it is portable to
  `integration/gate0-archive-art` but has not been applied there.
* **B's deep-wall armaria are not integrable** into A's 2–4-cell north band without faking
  thickness. Documented, not forced.
* **A fourth press bay was rejected** because the west face at (40,9) has void behind it; a
  cabinet there floats against darkness.
* **Evidence is one run, GL compatibility renderer, llvmpipe (software).** Real hardware and a
  Forward+ pass may differ in lighting; not tested.
* **Visual approval is not claimed.** The screenshots are native and the collision/route
  evidence is measured, but whether the composition is *good* is the reviewer's judgement.

## 9. Files

New, all on `arena/6e89e68d-soul-of-hero`; nothing under `data/`, `game/`, `tests/` or
`project.godot` changed.

```
prototypes/gate0/art/archive_props.png            B's atlas, verbatim (M0)
prototypes/gate0/art/props.json                   B's frame table, verbatim (M0)
prototypes/gate0/provenance/author_archive_art.py B's art generator, provenance only (M0)
prototypes/gate0/level_data/chapter_1_level_3_a.json  pinned Candidate A Level 3 fixture
prototypes/gate0/overlay_level3_archive.json      GENERATED placement data (15 props)
prototypes/gate0/archive_overlay.gd|.tscn         runtime adapter (M2)
prototypes/gate0/capture_gate0.gd|.tscn           capture + walk + collision harness (M2)
tools/gate0/author_overlay.py                     placement source of truth + validator (M1)
tools/gate0/write_source_manifest.py              provenance manifest + check (M0)
tools/gate0/make_evidence_sheets.py               comparison + 4x close-up sheets (M4)
.github/workflows/gate0-integration.yml           Godot 4.7 verification + publish (M3)
docs/gate0/SOURCE_MANIFEST.md                     generated provenance table
docs/gate0/GATE0_REPORT.md                        this report
docs/gate0/evidence/*.png                         24 native images (see below)
docs/gate0/evidence/logs/*.txt                    Godot, authoring and pin logs
```

### Evidence index

| files | what they are |
|---|---|
| `{before,after}_{spawn,entry,destination,combat_space}.png` | native Godot 4.7, 1280×720, production HUD, walked not teleported |
| `comparison_{spawn,entry,destination,combat_space}.png` | before \| after, identical crops, same stations |
| `closeup_pair_{press_bank,copyist_station,long_board_collapse,east_departure}.png` | 4× nearest-neighbour, before \| after, identical boxes |
| `closeup_{...}_{before,after}.png` | the individual 4× cuts |
| `logs/{before,after}.txt` | the Godot console output the assertions come from |
| `logs/{level_pin,source_manifest,author,author_check,godot_version,import}.txt` | pins, provenance, determinism, engine version |
