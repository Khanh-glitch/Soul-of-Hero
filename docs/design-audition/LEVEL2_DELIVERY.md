# Level 2 — “Ngã Ba Cốt Trắng” / Ossuary Fork — delivery report

**Candidate:** B (branch `arena/6e89e68d-soul-of-hero`, working copy of
`design-audition/level2-candidate-b`)
**Redesign commit:** `bb5f4d6` (final content commit adds the last hazard fix; the
audition run below is from the commit it names)
**Frozen baseline:** `1c21a49c2eb3775c4b421dab86d057c7256f5964`
**Audition CI gate:** run [39900632510](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/39900632510)
— *Level 2 Audition QA — Godot 4.7*, `completed / success`.
**Godot product gate:** run [39900632540](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/39900632540)
— *Godot 4.7 Runtime Validation*: every Chapter 1 / Level 2 step passed; the run is
marked failed only by the **“Original main baseline comparison”** job, which checks
out `main` (86 commits behind this work) and fails there, unrelated to this branch.

Concept: [`LEVEL2_CONCEPT.md`](LEVEL2_CONCEPT.md). Evidence folder:
[`evidence/`](evidence/).

---

## 1. What was built

| | baseline `1c21a49` | candidate B |
| --- | --- | --- |
| map size | 112×80 (1792×1280 px) | **164×138 (2624×2208 px)** |
| `Backdrop` (playable) | 4,460 | **8,057** |
| `Geometry` (solid) | 1,134 | **3,927** |
| `Decor` (non-blocking) | 25 | **132** |
| entities | 64 | **64** (0 added, 0 removed, 0 retyped) |
| rooms / camps / safe zones | 13 / 3 / 3 | 13 / 3 / 3 |
| `required_sigils` | 3 of 4 authored | 3 of 4 authored |
| `layout_profile` | `three_floor_fork_and_recombine` | `three_floor_jawbone_fork_bone_well_choir` |
| footprint symmetric difference | — | **9,037 cells** |
| floor-mask Jaccard | 1.000 | **0.161** |

Every original entity ID survives with its original type and is repositioned
(64/64 moved). No new IDs. The three floors are now three different spatial
verbs rather than three copies of the same rectangle grid.

### Floor 1 — “Hàm Răng Trắng” (the jaw): the choice

`R1 Mouth Court` (ellipse, spawn) → throat → `R2 Jaw Hall`, split by a **solid
jawbone spine** (26×4 bar + 4 hanging teeth) over a black chasm. The upper gap
opens onto the **Ledge of Relics**, a 5–6 cell dog-legged shelf with 4 spike
bands, brazier light and the only chest on the main loop (+220). The lower gap
opens onto the **Flooded Nave**, an 11-cell hall with standing water, 3 spike
bands and room to circle. Both roads carry one sigil; the high road also carries
the chest, then recombines with the rotunda through a neck at `(119,13,12,4)`.
`R5 Cenotaph Rotunda` is the convergence and camp 1: an octagonal hall with a
**sunken moat ring carved to void** and four processional bridges onto a cenotaph
island, where five swordsmen fight from four quadrants.

### Floor 2 — “Giếng Xương” (the bone well): the fall

Landing (checkpoint) → causeway → `R7 ring gallery`, an ellipse with a **24×11
ellipse removed from the floor mask**: a real hole, not a painted one. Three
plank spans (north, south, and a long east crossing) meet a small island holding
`l2_sigil_ring`. The ring is a loop: the north rim is safe and serves the Ossuary
Shelf cache; the south rim is trap-lined and serves the Flooded Vault cache. Both
rims converge at `R8 Wellhead Hall` (camp 2) — so the fight is approached from a
different angle depending on the rim you took.

### Floor 3 — “Ca Đoàn Trắng” (the white choir): the voice

Landing (checkpoint) → processional → `R12 White Choir`: two **colonnades of five
piers** over three lanes, bier rows along both walls, one lit processional lane.
Camp 3 fights inside the colonnade, so the charge arrives in lanes and the piers
are real cover. The apse holds `l2_exit`; a discovery aisle east of the apse holds
the +280 chest, reachable in 26 cells from the exit.

## 2. Route graph — before vs after

```
BEFORE (three identical repeats)                AFTER (one body, three verbs)
                                                
[entry]--[square]--+--[square]--[square]        [Mouth Court]--[throat]--[JAW HALL]
   |               |        |                      (spawn)            /        \
[landing]--[hole]--+   [square]  [wing]        Ledge of Relics   Flooded Nave
   |               |        |                  (spikes, +220)     (water, wide)
[landing]--[room]--+--[room]--[exit]                 \               /
                                                    [CENOTAPH ROTUNDA]  camp 1
                                                    (moat ring, 4 bridges)
                                                            |
                                        [Well Antechamber]--checkpoint
                                                            |
                                     north rim <------> south rim
                                    (cache N)   ISLAND   (cache S, traps)
                                     (sigil)      |          |
                                          \   [WELLHEAD] camp 2
                                                    |
                                          [F3 landing]--checkpoint
                                                    |
                                        [WHITE CHOIR] 3 lanes, camp 3
                                              |            \
                                         [EXIT APSE]   [discovery +280]
```

Two decisions, both measured (see §5): **ledge vs nave** on floor 1 and **north
vs south rim** on floor 2. In both cases the two options cost almost the same
distance and differ in risk, space and reward, so the decision is about *how you
want to fight*, not about a strictly better path.

## 3. Entity list — original IDs, before → after (cell coordinates)

All 64 IDs kept. Types unchanged. Nothing added.

### player (1)
| id | before | after |
| --- | --- | --- |
| `player_spawn` | 8,12 | 12,26 |

### skeleton (15)
| id | before | after |
| --- | --- | --- |
| `l2_c1_skeleton_01` | 94,12 | 139,22 |
| `l2_c1_skeleton_02` | 99,12 | 147,22 |
| `l2_c1_skeleton_03` | 103,15 | 139,30 |
| `l2_c1_skeleton_04` | 95,20 | 147,30 |
| `l2_c1_skeleton_05` | 101,21 | 143,18 |
| `l2_c2_skeleton_01` | 58,34 | 126,56 |
| `l2_c2_skeleton_02` | 61,38 | 130,66 |
| `l2_c2_skeleton_03` | 59,43 | 126,77 |
| `l2_c2_skeleton_04` | 61,48 | 120,59 |
| `l2_c2_skeleton_05` | 56,50 | 121,85 |
| `l2_c3_skeleton_01` | 56,63 | 52,111 |
| `l2_c3_skeleton_02` | 69,63 | 62,116 |
| `l2_c3_skeleton_03` | 56,72 | 70,120 |
| `l2_c3_skeleton_04` | 70,72 | 79,116 |
| `l2_c3_skeleton_05` | 67,67 | 86,111 |

### floor_door (4) — two reciprocal pairs
| id | before | after | pair |
| --- | --- | --- | --- |
| `door_l2_f1_f2_down` | 103,23 | 156,26 | → `door_l2_f1_f2_up` |
| `door_l2_f1_f2_up` | 9,42 | 11,72 | → `door_l2_f1_f2_down` |
| `door_l2_f2_f3_down` | 103,48 | 142,72 | → `door_l2_f2_f3_up` |
| `door_l2_f2_f3_up` | 9,70 | 11,116 | → `door_l2_f2_f3_down` |

### sigil (4) — 3 required
| id | before | after | role |
| --- | --- | --- | --- |
| `l2_sigil_choice_north` | 73,8 | 122,12 | high-road reward (chapel) |
| `l2_sigil_choice_south` | 73,23 | 126,38 | low-road reward (chancel) |
| `l2_sigil_ring` | 77,50 | 88,70 | well island, mandatory-feeling |
| `l2_sigil_gauntlet` | 74,67 | 68,116 | choir centre lane |

### checkpoint (2), exit (1), chest (2)
| id | before | after |
| --- | --- | --- |
| `l2_checkpoint_floor_2` | 16,42 | 10,68 |
| `l2_checkpoint_floor_3` | 16,70 | 10,111 |
| `l2_exit` | 102,68 | 100,116 |
| `l2_chest_risky_branch` | 68,13 | 108,11 |
| `l2_chest_gauntlet` | 39,63 | 120,122 |

### spikes (15)
| id | before | after | id | before | after |
| --- | --- | --- | --- | --- | --- |
| `l2_spikes_01` | 59,9 | 96,10 | `l2_spikes_09` | 83,11 | 74,85 |
| `l2_spikes_02` | 59,21 | 104,13 | `l2_spikes_10` | 48,34 | 100,85 |
| `l2_spikes_03` | 39,34 | 112,9 | `l2_spikes_11` | 48,49 | 114,84 |
| `l2_spikes_04` | 39,49 | 78,12 | `l2_spikes_12` | 75,40 | 110,70 |
| `l2_spikes_05` | 44,67 | 78,37 | `l2_spikes_13` | 54,63 | 58,110 |
| `l2_spikes_06` | 72,72 | 100,34 | `l2_spikes_14` | 54,73 | 74,120 |
| `l2_spikes_07` | 48,9 | 114,41 | `l2_spikes_15` | 84,68 | 89,120 |
| `l2_spikes_08` | 48,21 | 60,82 | | | |

### torch (10)
| id | before | after | id | before | after |
| --- | --- | --- | --- | --- | --- |
| `l2_torch_01` | 17,9 | 8,24 | `l2_torch_06` | 70,32 | 22,76 |
| `l2_torch_02` | 32,6 | 23,20 | `l2_torch_07` | 92,49 | 135,50 |
| `l2_torch_03` | 80,6 | 18,33 | `l2_torch_08` | 18,65 | 6,118 |
| `l2_torch_04` | 91,22 | 44,9 | `l2_torch_09` | 37,74 | 46,110 |
| `l2_torch_05` | 18,36 | 22,69 | `l2_torch_10` | 101,63 | 96,106 |

### coin (10)
| id | before | after | id | before | after |
| --- | --- | --- | --- | --- | --- |
| `l2_coin_01` | 23,11 | 20,22 | `l2_coin_06` | 36,34 | 66,86 |
| `l2_coin_02` | 35,7 | 91,10 | `l2_coin_07` | 36,49 | 108,71 |
| `l2_coin_03` | 50,7 | 114,36 | `l2_coin_08` | 25,68 | 34,113 |
| `l2_coin_04` | 50,21 | 149,34 | `l2_coin_09` | 79,68 | 76,112 |
| `l2_coin_05` | 25,40 | 30,72 | `l2_coin_10` | 91,68 | 124,128 |

**Newly added entity IDs: none.** Room anchors: all 13 IDs kept
(`l2_f1_entry, l2_f1_fork, l2_f1_north_reliquary, l2_f1_south_reliquary,
l2_f1_convergence, l2_f2_landing, l2_f2_ring, l2_f2_north_cache,
l2_f2_south_cache, l2_f2_convergence, l2_f3_landing, l2_f3_gauntlet,
l2_f3_exit`), rects re-derived from the built geometry.

## 4. Authoring authority & reproducibility

* `tools/design/level2_ossuary_author.py` — the only author of the Level 2 JSON.
  Shape grammar (`rect/ells/ellipse/ring/poly/octagon`), ordered carve/refill/solid
  passes, ordered material passes, autotiled rock, deterministic seeded decor,
  then `resolve_entities()` snaps every marker onto the final floor mask.
  Modes: *(no flag)* write, `--check` verify sync, `--stats` summary.
* `tools/generators/generate_chapter_1_levels_2_to_5.gd` — **no longer authors
  Level 2.** It regenerates Levels 1, 3, 4, 5 only, and prints a pointer to the
  Python authority, so `tools/regenerate_chapter_1_maps.ps1` cannot erase the
  redesign. `--level=N` was added so a single slot can be regenerated.
* `python3 tools/design/level2_contract_check.py` — stdlib emulation of
  `level_schema.gd`, the Chapter 1 map-design tests and the Knight collision
  flood. It was extended during this work with a cross-entity unique-cell check.
* `python3 tools/design/level2_preview.py` — offline Pillow preview using the real
  atlases (`--camera CX CY` gives a 1280×720 crop). Design review only; **not**
  a substitute for the Godot captures.

## 5. Technical QA report

### 5.1 Schema / geometry (Godot 4.7, CI)

| gate | command (CI) | result |
| --- | --- | --- |
| import | `godot --headless --editor --path . --import --quit` | pass |
| Chapter 1 campaign map geometry | `godot --headless --script res://tests/chapter_1_campaign_map_design_test.gd` | pass |
| live Knight collision routes | `godot --headless res://tests/chapter_1_collision_route_test.tscn` | pass, `slot=2` present |
| objective / route / Training gates | `tests/chapter_1_campaign_objective_test.gd`, `…_route_test.gd` | pass |
| production smoke | `tests/production_gameplay_smoke_test.gd` | pass |
| generators reproducible | level 6 + sandbox regenerated, `git diff --quiet` | pass |

`schema: ok`, `one player / one exit_gate`, unique cells, `required_sigils 3 ≤ 4
sigils`, encounter pack present on all three floors.

### 5.2 Local pre-CI gate (fast, deterministic)

`python3 tools/design/level2_contract_check.py` →

```
floor 8057   Geometry 3927   Decor 132   entities 64
Knight-clear cells: 7333 / floor 8057; Knight-reachable 7320 / 7320
LEVEL 2 CONTRACT + ROUTE VALIDATION PASSED
```

It asserts: three floor components; every entity on walkable floor and inside no
`Geometry` cell; no two entities on the same cell; reciprocal door pairs with
floor arrival cells that have Knight clearance; all 13 anchors resolvable;
combat-camp spacing ≤ 576 px and patrols that do not scrape walls; every
objective (3 sigils used, checkpoints, exit, both chests) reachable **without
stepping on a spike**; the Knight body route graph covers 7,320/7,333 clear cells
(the 13 leftover cells are isolated wall-adjacent pockets no marker uses).

### 5.3 Measured route lengths (Knight-clear BFS, 16 px cells, 96 px/s)

Full table: [`evidence/level2_route_metrics.md`](evidence/level2_route_metrics.md).

| route | cells | px | traversal s |
| --- | ---: | ---: | ---: |
| spawn → jaw fork | 47 | 752 | 7.8 |
| spawn → high-road sigil (chapel) | 124 | 1,984 | 20.7 |
| spawn → low-road sigil (chancel) | 126 | 2,016 | 21.0 |
| high-road sigil → rotunda | 56 | 896 | 9.3 |
| low-road sigil → rotunda | 48 | 768 | 8.0 |
| floor-2 landing → island sigil | 97 | 1,552 | 16.2 |
| island sigil → floor-3 door | 56 | 896 | 9.3 |
| floor-2 landing → floor-3 door, north rim | 153 | 2,448 | 25.5 |
| floor-2 landing → floor-3 door, south rim | 155 | 2,480 | 25.8 |
| floor-3 landing → choir sigil | 57 | 912 | 9.5 |
| choir sigil → exit | 32 | 512 | 5.3 |
| floor-3 landing → exit, direct | 89 | 1,424 | 14.8 |
| floor-3 landing → discovery chest → exit | 115 | 1,840 | 19.2 |
| spawn → risky-branch chest (+220) | 111 | 1,776 | 18.5 |

High road total to the rotunda: **180 cells**. Low road total: **174 cells**.
North rim: **153**, south rim: **155** — the two options are within 3 %, so the
decision is about space and risk, not a dominant path.

### 5.4 Real Godot 4.7 captures (production harness, not JSON thumbnails)

Command per frame (from `.github/workflows/level2-audition.yml`):

```bash
xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 godot --path . --audio-driver Dummy \
  --rendering-method gl_compatibility --rendering-driver opengl3 \
  --resolution 1280x720 res://tests/chapter_1_campaign_level_visual_capture.tscn -- \
  --level-slot=2 --capture-point=$point --expected-width=1280 --expected-height=720
```

| frame | file | content observed |
| --- | --- | --- |
| spawn | `evidence/chapter_1_level_02_spawn_runtime.png` | Mouth Court: Knight at the spawn, three braziers, coin, a spike band on the throat, torch; HUD live |
| mid | `evidence/chapter_1_level_02_mid_runtime.png` | the Bone Well: standing on the island, plank cross over four void quadrants, two caches in view |
| end | `evidence/chapter_1_level_02_end_runtime.png` | exit apse: exit gate portal, a live Skeleton, a spike rack, the +280 chest, bier/brazier props |

All three are exactly 1280×720 and each run prints
`CHAPTER 1 CAMPAIGN CAPTURE TEST PASSED: slot=2 point=<spawn|mid|end>`; the step
fails if the PNG is empty.

### 5.5 Pacing — hypotheses, not observations

No human playthrough was recorded; these are **hypotheses** derived from the
measured route lengths, camps and respawn/rest beats at 96 px/s.

| segment | hypothesis | basis |
| --- | --- | --- |
| floors 1 fork decision | 20–30 s of reading + walking before committing | fork is 7.8 s away, both branches are visible from the jaw hall |
| high road (ledge + camp 1 opening) | 45–60 s | 20.7 s travel, 4 spike bands, tight dodging space |
| low road (nave + caches) | 45–60 s | 21.0 s travel, 3 spikes but wide evade lanes |
| camp 1 (rotunda, 5 swordsmen) | 20–35 s | ring space, retreat across bridges, no obstacles other than the moat |
| floor 2 rim loop | 50–70 s | 25 s rim, 16 s island, the other rim's traps on the way back if exploring |
| camp 2 (wellhead) | 20–30 s | east neck, well as a back wall |
| floor 3 choir + camp 3 + exit | 45–60 s | 9.5 s in, lane fights, 5 s from choir sigil to the exit |
| **total** | **≈ 180–280 s for a first, explorative clear**; ≈ 120–150 s for a direct clear taking 3 sigils and skipping both caches | sum of the above |

That is **above** the brief's 90–180 s window for a thorough clear. The direct
line (3 sigils, skip the north-rim cache and the +280 chest) lands inside it; the
explorative clear is deliberately longer. If the reviewer wants the *observed
minimum* inside 90–180 s, the lever is the map scale (shrink `WIDTH/HEIGHT` by
~15 %) rather than removing rooms — I did not do that because readability at
1280×720 argued for the larger rooms. This is an explicit hypothesis, not a
measured playthrough time.

## 6. Visual review — what the images show, honestly

* **Silhouettes**: the three floors read as three shapes, not one repeated grid —
  see [`evidence/level2_before_after_footprint.png`](evidence/level2_before_after_footprint.png)
  (identical 10 px-per-cell scale, labelled rooms, branch paths traced along real
  walkable lanes) and the cell-level overlay
  [`evidence/level2_footprint_overlay.svg`](evidence/level2_footprint_overlay.svg).
* **Landmarks** at gameplay zoom: the jawbone spine + chasm (floor 1), the moat
  rotunda, the well cross (floor 2, visible in the mid capture), the colonnade
  (floor 3).
* **Weaknesses I can see myself:**
  - The Backdrop tint (`0.64, 0.69, 0.78`) plus the room lighting makes large
    stretches of the nave and the apse quite dark; a player may read the deep
    water zones as walls on first contact. The teal lip strip is the only cue.
  - The candle-stub material is a high-contrast accent and, on the well island,
    it dominates the frame. It is intentional (the island should glow) but it is
    the busiest texture in the level.
  - The end capture has props and a live enemy at the frame edge, but the apse is
    still sparse compared with the choir.
  - No verticality: this is a pure top-down floor plan; the “balcony” is a
    narrative label, not a height difference.
  - Asset limitation: the shipped atlas has no ossuary-specific architecture, so
    the tomb identity comes from *arrangement* (colonnades, bier rows, graves,
    moat, shaft) rather than bespoke art.

## 7. Scope

Changed files:

```
data/levels/chapter_1_level_2.json                  (the redesign)
tools/generators/generate_chapter_1_levels_2_to_5.gd (delegate Level 2, --level=N)
tools/design/level2_ossuary_author.py               (new authoring authority)
tools/design/level2_contract_check.py               (new fast local gate)
tools/design/level2_preview.py                      (new offline preview)
tools/design/level2_footprint_compare.py            (new before/after figure)
tools/design/level2_route_metrics.py                (new route measurements)
docs/design-audition/LEVEL2_CONCEPT.md              (new)
docs/design-audition/LEVEL2_DELIVERY.md             (this file)
docs/design-audition/evidence/*                     (figures, tables, captures)
.github/workflows/level2-audition.yml               (branch trigger + publish step)
```

Not touched: `main`, `integration/chapter1-2-hero-web-playtest`, the deployed Web
Playtest branch, Hero Systems, progression, SaveService, combat, encounter
resources, rosters, rewards, and every unrelated test file.
