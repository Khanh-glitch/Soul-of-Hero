# ROUND 5 — independent acceptance and promotion readiness

**Date:** 2026-10-24 · **Branch:** `arena/6e89e68d-soul-of-hero` · **Reviewed HEAD:** `12ff770`
**Latest native green run:** [40091078257](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40091078257) @ `799ac9e`
**Scope:** acceptance review and integration feasibility. No production file was modified,
no PR opened, no merge, no deploy, no evidence rewritten.

---

## 0. What this document is

Round 4 ended with a green workflow and a report. This round asks a different question:
*is the thing ready to go into the game?* The answer below is not "the CI is green".

Everything here was re-derived from the committed artefacts — the level documents, the
placement document, the capture logs and the PNG frames — not from the previous report's
prose. Where I could not verify something, it says so.

**Provenance of the evidence read**

| source | revision | what it establishes |
| --- | --- | --- |
| `docs/gate3/evidence/logs/*.txt`, `*.png` | `32d7389` (run `40093897428`) | the current native frames, coverage, respawn and stability logs (sample D) |
| `docs/gate3/evidence/logs/stability_table.txt` | `0516c67` (run `40091078257`) | stability sample C |
| `docs/gate3/evidence/logs/stability_table.txt` | `48c7582` (run `40090068943`) | stability sample B |
| `docs/gate3/evidence/logs/stability_table.txt` | `b76fe3f` (run `40088983090`) | stability sample A |
| `data/levels/chapter_1_level_3.json` | `12ff770` | the **shipped** Level 3 (77 entities, 116×84) |
| `prototypes/gate0/level_data/chapter_1_level_3_a.json` | `12ff770` | Candidate A, the base Gate 3 redesigns (79 entities, 116×96) |
| `prototypes/gate3/level_data/chapter_1_level_3_gate3.json` | `12ff770` | the Gate 3 map |
| PR #5 branch `design-pilot/levels3-4-candidate-a` | live | the pilot that also owns Level 3 design |
| PR #3 branch `integration/chapter1-2-hero-web-playtest` | live | the integration + Web playtest line |

**What this review could not execute.** The sandbox has no Godot and no browser: every
native frame and every runtime number below is the CI artefact, read directly. No new
Godot run, no browser run and no human playtest was possible from here, and none is
claimed. Where a question needs one, it appears as *unverified* in §5 and as a required
test in §8.

---

## 1. Method

1. **Recomputed the framing statistics** from `visual_placement.json` and the camera
   rectangles in the logs, with an implementation written independently of
   `gate3_redesign.gd::camera_frame_report()`. Result: agreement within 0.05 pp on all
   16 recorded frames (§2.6).
2. **Recomputed the stability statistics** from the raw `stability_run_*.txt` logs of the
   three published samples, instead of reading the generated table (§3.2).
3. **Looked at the frames at 1× and 3×** — composition, surface repetition, hazard bays,
   hero legibility — including a 3× crop of the rock apron that no evidence sheet shows.
4. **Read the runtime and the data** to establish what promotion would actually require:
   `gate3_redesign.gd`, `capture_gate3.gd`, `game/main.gd`, `DungeonLevel`,
   `HUD`/`Knight`, the level documents and the repository tests that load Level 3.
5. **Compared with PR #5 and PR #3** through their live branches.

---

## 2. Visual assessment

### 2.1 The material actually renders — verified, and the z-order defect is genuinely gone

Round 3's `after_*` frames and Round 4's are not the same picture. The coverage proof is
in the log:

```
GATE3 COVERAGE: Backdrop 3413/3413 cells painted by ["floor", "water", "water_edge", "coping"]
GATE3 COVERAGE: Geometry 1686/1686 cells painted by ["wall_face", "mass", "niche"]
```

I checked that this is a proof and not a slogan: `_hide_level_layers()` only sets
`visible = false` on `Decor`, `Backdrop` and `Geometry`, and the assert runs per cell
before it does, failing on the first uncovered cell with coordinates. Collision stays with
the production TileSet, which is why the walks still work.

The pixel test that found the Round 3 defect now passes in the right direction:
`before_spawn.png` and `after_spawn.png` differ in floor and wall pixels
(`(300,400)` `(58,44,36)` vs `(29,31,35)`; `(600,500)` `(124,103,91)` vs `(66,60,71)`).
**Pass.**

### 2.2 Identity: the archive is a real place now — with one unresolved surface problem

The frames read as one coherent warm-stone archive: brick courses with recesses and
niches, water in the garth, book-filled alcoves, crimson hazard bays, low candle pools.
It is clearly not the 0x72 blue-grey crypt of Candidate A. That is a large, verifiable
improvement over Round 3, where 5 800 authored cells never reached the screen.

**The "artificial diagonal band" complaint is reduced, not resolved.** At 3× (see the
crop in §6 of the acceptance table) the rock apron outside the building is a *regular
diamond lattice* — 32-px lozenges with a lit top edge, repeated without irregularity
across the whole apron. The eight flip/transpose variants broke the 16-px weave into a
32-px lattice; they did not make the stone look like stone. A reviewer looking at
`after_floor2_arrival.png` still sees a wallpaper pattern across 55 % of the frame.
This is the strongest remaining visual criticism, and it is a *content* problem (one
pair of hand-drawn frames), not a compositing problem.

### 2.3 Floors 2–3 differentiation: structural, not atmospheric

| | floor 1 | floor 2 | floor 3 |
| --- | --- | --- | --- |
| props | 24 | 12 | 9 |
| lights | 4 | 3 | 3 |
| material bias | wall_face/niche rhythm of the nave | thicker dado, pier rhythm shifted | broken faces, more niches |

The props are semantic, not decorative (opened presses, a collapsed range, the pier under
the crossfire hall, the lectern where the seals are counted). The storeys are therefore
*differentiated by programme*, which is the right kind of differentiation, but they are
**not differentiated by surface**: all three storeys are painted from the same eleven
materials with the same palette. A player who is teleported between floors would know by
the furniture, not by the stone. **Pass with a limitation.**

### 2.4 Knight readability — verified, including the frame that had failed

- Combat (`after_combat_space.png`, `after_combat_load.png`): the white Knight reads
  cleanly against the brown floor, the skeleton is distinguishable, the boss bar and HUD
  are intact.
- Respawn (`after_respawn_after.png`): after the Round 4 correction the hero is in front
  of the checkpoint plate (`GATE3 ENTITY Z: 2 checkpoint plates drawn under the Knight`)
  and the toast `Đã hồi sinh tại điểm lưu` is visible.
- No frame shows the Knight occluded by props. Props are inserted into the level's own
  y-sorted `Entities` container, and the harness asserts the container *is* y-sorted
  before adding anything.

**Pass.**

### 2.5 Hazards — visible, and none were removed

18 spike entities exist in the level document and all 18 are still instantiated (entity
list byte-identical, 79/79). The reskin keeps the spike pixels and repaints only the
plate; the shipped frames show four-spike bays on a dark crimson pit, which reads as
danger at a glance and contrasts with the floor far more strongly than the Round 3 violet
card. I measured pale-spike clusters against their local surround in eleven station
frames: contrast ratio 2.0–3.8× (median ≈ 2.8×). **Pass.**

### 2.6 Camera and composition — recomputed independently

The station frames use the level's own camera at zoom 1.0; only the four `cam_archive_*`
frames use zoom 2.0, and they are labelled as such. So the percentages below are not a
zoom trick. My independent recomputation (half-open cell rectangle, same role lists)
matches the harness on all 16 frames to within 0.05 pp:

| station | floor | building | rock | void | note |
| --- | --- | --- | --- | --- | --- |
| spawn | 1 | 56.6 % | 43.4 % | 0 % | |
| archive_entry | 1 | 60.8 % | 39.2 % | 0 % | |
| landmark | 1 | 71.2 % | 28.8 % | 0 % | |
| descent_landing | 1 | 70.4 % | 29.6 % | 0 % | |
| cloister | 1 | 78.0 % | 22.0 % | 0 % | |
| south_loop | 1 | 78.2 % | 21.8 % | 0 % | |
| combat_space | 1 | 70.8 % | 29.2 % | 0 % | |
| return_route | 1 | 74.5 % | 25.5 % | 0 % | |
| combat_load | 1 | 74.1 % | 25.9 % | 0 % | mid-fight |
| **floor2_arrival** | 2 | **45.3 %** | 54.7 % | 0 % | **below the 60 % target** |
| floor2_stacks | 2 | 61.9 % | 38.1 % | 0 % | |
| **floor3_camp** | 3 | **59.2 %** | 40.8 % | 0 % | **below the 60 % target** |
| cam_baseline_1280 | 1 | 71.2 % | 28.8 % | 0 % | zoom 1.0 |
| cam_archive_1280 | 1 | 91.7 % | 8.3 % | 0 % | zoom 2.0 |
| cam_baseline_1024 | 1 | 71.2 % | 28.8 % | 0 % | zoom 1.0 |
| cam_archive_1024 | 1 | 91.7 % | 8.3 % | 0 % | zoom 2.0 |

`void = 0 %` everywhere is real and meaningful: no frame shows the flat background
polygon, which was the Round 3 defect at the floor-2 landing (25.0 % void).

**But the metric is not the composition.** "Building" counts *painted cells*, not visual
interest: a 100 %-building frame can be an empty hall of one floor tile. The two failures
are therefore about **how much of the picture is the room**, which is a legitimate
composition proxy — and the failure at floor 2 is visible, not statistical: the door
lands the camera at the storey's west edge, with the rock apron filling the left and
bottom of the frame. That is a first-impression problem on the beat that is supposed to
open floor 2.

### 2.7 Evidence-hygiene defects found while reviewing

These do not change any frame or log, but they matter for an acceptance decision because
they mean the report cannot be read as a precise record.

1. **`GATE3_REPORT.md` §13.6 quoted a median its own data did not support.** It said
   "median 51 %" over twelve runs, which recomputes to **492 / 1100 = 44.7 %**. The number
   became right for sixteen runs only after a fourth sample was published *during this
   review* (`40093897428`, median 51.1 %) — the report printed a figure from a data set it
   was not describing. Corrected to the sixteen-run aggregate with all four samples shown;
   no log was touched.
2. **"11 of the 12 needed at least one checkpoint respawn"** conflates respawns with
   runs: 11 respawns happen across **8** runs. Corrected.
3. **"10 of the twelve at exactly 100 % explained"** — it is **8** of those twelve
   (11 of 16 once sample D is included).
4. **§2 still prints the Round 3 totals** (`PROPS 36 · LIGHTS 6`) next to a Round 4
   delivery of `PROPS 45 (21 solid) · LIGHTS 10`. Both numbers are real; they are from
   different rounds, and the table does not say so.
5. **`prototypes/gate3/art/derived_art.json` carries a stale note** ("the flat violet
   plate is cleared to transparency") describing the *rejected* first treatment. The
   frames themselves are the crimson pit — verified by reading the PNGs:
   `(72,30,30,210)` × 151–208 pixels per frame.
6. **Stale attempt logs in the evidence folder.** `logs/deep_attempt_2.txt` (10:57) and
   `logs/deep_attempt_3.txt` (10:12) are from earlier runs than the publish (11:58); the
   current deep pass completed on **attempt 1**. The folder mixes vintages without saying
   so per file.

None of these is a gameplay defect. All of them are the kind of thing that makes a
reviewer distrust the rest, and they are cheap to fix.

---

## 3. Gameplay acceptance

### 3.1 What the sixteen descents prove — and what they do not

They prove **automation reliability**: the same production descent, driven by production
input actions, reaches floor 3 on foot in 12 of 12 attempts, 3 763–3 787 px, 7–12 fights,
through the level's own floor doors.

They do **not** prove balance, and the design of the pass guarantees that: the stability
mode runs with the Round 4 respawn director armed, so a death refunds the whole health
bar and the run continues. "Descent complete = true" is compatible with having died
three times. A successful descent after automatic respawns says the *route* is walkable
and the *harness* is robust. It says nothing about whether a player would survive it.

### 3.2 The numbers, recomputed from the logs

Samples A (`40088983090`), B (`40090068943`), C (`40091078257`) and D
(`40093897428`), four runs each:

| run | fights | deaths | cells | net HP lost | gross damage | explained |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | 11 | 1 | 121 | 328 | 1 428 | 100 % |
| A2 | 9 | 1 | 151 | 0 | 1 100 | 98.2 % |
| A3 | 9 | 0 | 167 | 1 044 | 1 044 | 85.2 % |
| A4 | 9 | 1 | 126 | 502 | 1 602 | 90.4 % |
| B1 | 7 | 0 | 213 | 676 | 676 | 100 % |
| B2 | 10 | 2 | 363 | 0 | 2 200 | 87.7 % |
| B3 | 10 | 0 | 157 | 944 | 944 | 100 % |
| B4 | 10 | 1 | 260 | 696 | 1 796 | 100 % |
| C1 | 9 | 2 | 140 | 368 | 2 568 | 100 % |
| C2 | 12 | 1 | 151 | 482 | 1 582 | 100 % |
| C3 | 8 | 2 | 256 | 0 | 2 200 | 100 % |
| C4 | 8 | 0 | 183 | 622 | 622 | 100 % |
| D1 | 13 | 1 | 152 | 1 004 | 2 104 | 92.7 % |
| D2 | 10 | 1 | 141 | 368 | 1 468 | 100 % |
| D3 | 12 | 1 | 250 | 830 | 1 930 | 100 % |
| D4 | 13 | 1 | 127 | 676 | 1 776 | 100 % |

| statistic | value | against the Round 4 target |
| --- | --- | --- |
| descents reaching floor 3 | 16 / 16 | pass |
| net HP lost — min / **median** / max | 0 / **562** / 1 044 | median 51.1 % vs ≈ 40 % — **miss** |
| net HP lost — max | 1 044 = **94.9 %** of the bar | vs ≤ 75 % — **fail** |
| gross damage — median | **1 592 = 144.7 %** of the bar | not targeted; see §3.3 |
| runs taking more than one full bar | **11 / 16** | — |
| deaths / runs with a death | 15 / **12 of 16** | — |
| damage attributed to a source | 24 288 of 25 040 = **97.0 %** | vs ≥ 90 % — pass |

The per-sample medians (415, 686, 425, 753) differ by 34 % of a health bar between
consecutive samples of the *same build*, which is the single most important number in this
table: **the run-to-run variance is larger than any plausible tuning step**, so a
four-run sample cannot certify this level's difficulty in either direction. The
sixteen-run median moved from 44.7 % (samples A–C) to 51.1 % when a fourth sample was
published during this review — a movement produced by the harness, not by the game.

### 3.3 The mortality finding — the reason a "16/16" is not reassuring

Gross damage per descent has a median of 1 592 against a 1 100 health pool, and 11 of 16
descents absorbed **more than a full bar**. The shipped game has no respawn (§3.5), so in
those 11 runs a player with the harness's effectiveness would have died at least once and
been sent back to the level's start by the production death screen.

The harness's bot is not a weak player: it dashes 150–493 times per descent, and its
logged break-offs run as low as HP 2 (`GATE3 COMBAT: the Knight broke off … at HP 2`), so
it is fighting to the edge rather than avoiding the fights. Treating the bot as a
competent player, the honest reading is **"this level kills a competent player in the
majority of attempts"**, before any question of fun.

That is a statement about `chapter_1_level_3`'s combat budget, not about Gate 3's visual
work — Gate 3 cannot change it (D2(a), `data/**` frozen). But it is decisive for
promotion, because Gate 3's evidence of "it plays" was obtained *through a mechanic the
shipped game does not have*.

### 3.4 The attribution gap is not random — it is the level's own crossfire

`_damage_source()` attributes a loss to `hazard` if a hazard is within 28 px, else to
`enemy` if an enemy is within 72 px, else to `unknown`. The residual 598 points (3.4 %
overall) is therefore systematically **damage from beyond 72 px** — which in this level
means the archers'/reapers' crossfire, the design's own centrepiece. Its share is very
uneven: 0 % in eight runs, but 22 % in the rendered deep run (`unexplained 250` of 1 120).

Two consequences worth stating plainly:
* enemy damage is under-reported, not over-reported, so the mortality finding in §3.3 is
  if anything conservative;
* a hit taken while standing near a spike is booked as `hazard` (hazard is tested first),
  so the hazard/enemy split is indicative, not exact.

### 3.5 Checkpoint recovery and repeated deaths — the mechanic works, but it is not shipped

Verified in native runs: a real spike death on floor 2, revival at the floor-2 checkpoint,
full health, tree unpaused, production toast shown, and the same again on floor 3
(`GATE3 RESPAWN TOTAL: 2 deaths recovered` in the deep log). Play continues immediately.

The production gap is unchanged and is the crux: `game/ui/HUD.tscn` has a `RespawnButton`
wired to nothing and hidden in `_ready()`, and `hud.gd` never calls
`KnightController.respawn()`. In the shipped game, death means restart. Gate 3
demonstrates the fix in the prototype; it does not ship it.

### 3.6 What "green CI" means here — retry and optionality

Read from `.github/workflows/gate3-runtime.yml`, not from the summary:

* The **rendered deep pass retries the whole Godot process up to three times**. The
  last two runs passed on attempt 1; an earlier run needed attempt 2 (`HP 444`).
* That step requires **floor 2**; reaching **floor 3 is optional**
  (`GATE3 DEPTH LIMIT` is printed and tolerated). The 16/16 three-storey record comes from
  the *headless stability* step, not from the rendered pass.
* The stability step tolerates runs that produce no summary (`|| echo`). It does not fail
  the step on a missing descent; the summary grep only needs *one* line.
* `ERROR:` scanning excludes Godot's own `ObjectDB instances were leaked` and
  `resources still in use at exit` notices by name.

So "green" means: the rendered capture produced its required frames and logs, and at
least one descent summary exists. It does **not** mean "three storeys in one attempt".
The report says this in §12.1 and it remains true.

### 3.7 ObjectDB

Unchanged: one notice per rendered capture naming 7 instances, zero under `--headless
--verbose`, objects therefore still unidentified. Low severity, unresolved, and honestly
labelled as such in the report. It does not block anything, but it will appear in any
shipped build's shutdown log until someone chases it.

### 3.8 Disposition of the combat-balance failures (D2(a) preserved)

Nothing was tuned. `git diff --name-only fa83414..HEAD -- data game tests assets
project.godot` is still 0 files, and this round adds only documentation. The failures are
recorded as failures, with two concrete proposals that require **owner approval** because
each one changes the game, not the prototype:

* **P1 (death flow, not balance):** ship a death→checkpoint respawn. This does not make
  the fight easier; it makes a loss cost a storey instead of the level. It is the change
  the prototype proves, and it is a production decision (`hud.gd`/`knight.gd`).
* **P2 (balance, only with explicit permission):** if the level is expected to be
  survivable without any respawn, the encounter budget has to change — fewer converged
  skeletons or lower per-blow damage in `data/content/**`/`data/levels/**`. The variance
  data says the right target is *the tail*, not the median.

---

## 4. Integration feasibility

### 4.1 What Gate 3 physically is

| artefact | path (prototype) | size | needs to ship as |
| --- | --- | --- | --- |
| overlay runtime | `prototypes/gate3/gate3_redesign.gd` | ~700 lines | `game/…` (protected) |
| placement document | `prototypes/gate3/visual_placement.json` | authored data | `data/…` (protected) |
| material atlas | `prototypes/gate2/art/archive_tiles.png` | 4.5 KB | `assets/…` (protected) |
| prop atlas + frames | `prototypes/gate2/art/props.png` + `props.json` | 11 KB | `assets/…` |
| light texture | `prototypes/gate2/art/light_radial.png` | 3.6 KB | `assets/…` |
| derived hazard frames | `prototypes/gate3/art/peaks_1..4.png` | derived | `assets/…` + provenance record |
| level map | `prototypes/gate3/level_data/chapter_1_level_3_gate3.json` | 593 KB | `data/levels/chapter_1_level_3.json` |
| respawn director | inside `gate3_redesign.gd` | ~40 lines | production death flow |
| camera bands | inside `gate3_redesign.gd` | ~60 lines | `main.gd`/camera code |

The overlay refuses to attach to any level other than `chapter_1_level_3`, and both the
placement document and the derived art are addressed by absolute `res://` paths that
point into `prototypes/`. **Zero of this is shippable as-is**: it is a prototype that
happens to be loaded by a prototype capture scene. Moving it is mechanical but it must go
through the four protected trees above, so it is owner-gated by definition.

### 4.2 The map-identity conflict — the single biggest blocker

| | shipped `data/levels/chapter_1_level_3.json` | Candidate A / Gate 3 |
| --- | --- | --- |
| size | 116 × **84** | 116 × **96** |
| entities | **77** | **79** |
| difference | — | +2 torches, different spawn `(136,216)` → `(280,216)`, most enemy positions moved |
| camera bounds | 1856 × 1344 | 1856 × 1536 |
| objective text | "Dùng hố làm vật che…" | "Dùng kệ sách đá làm vật chắn đạn hồi hồn…" |

Gate 3 does not redesign the shipped Level 3. It redesigns **Candidate A**, a
design-audition map that has never been in the game. Promoting Gate 3 therefore means one
of two very different things:

* **(i) adopt Candidate A as the shipped Level 3** — replaces the level's geometry, spawn,
  two torches, enemy placement and objective string; every Level 3 test, camp and
  checkpoint anchoring then refers to a different map; or
* **(ii) port the design onto the shipped 77-entity map** — re-run
  `tools/gate3/author_gate3.py` against `data/levels/chapter_1_level_3.json`, re-place all
  45 props, rebuild the material and shade for an 84-row map, and re-take every frame.
  This is a new authoring pass, not a promotion.

Either way it is a design-owner decision, and it must be taken before any code moves.

### 4.3 Conflict with PR #5 (Levels 3–4 design pilot)

PR #5 (`design-pilot/levels3-4-candidate-a`, 3 files, docs/tools/workflow only) claims
**the same Level 3** with an explicit contract that Gate 3's map violates:

* "**Pinned baseline:** 116×84 tiles, 5 004 Backdrop, 1 104 Geometry, 29 Decor, **77
  entities**";
* "Every original authored entity ID and **type** must survive… **no substitution**";
* Level 3's design identity in that brief — *Crossfire Archive*, real colliding cover,
  readable flank-vs-direct-fire choice, 11 canonical rooms, 3 camps — is **the same
  brief** Gate 3 executed, on a different map.

There is exactly one Level 3. Two branches, two baselines, one slot. Whichever is chosen,
the other's acceptance evidence becomes non-transferable:
* if PR #5's pilot proceeds, Gate 3's frames, placements and balance measurements describe
  a map the pilot does not ship;
* if Candidate A is adopted, PR #5's pinned-baseline audit tool
  (`tools/design/levels3_4_pilot_audit.py`) fails on entity count and footprint by
  construction, and its Level 4 work inherits a chapter whose Level 3 no longer matches
  the chapter's other maps.

### 4.4 Conflict with PR #3 (integration + Web playtest)

PR #3 (86 files) is the line that would carry any promotion into `main`. It touches, among
others, `game/main.gd`, `game/ui/hud.gd`, `game/characters/knight/knight.gd`,
`game/levels/level_schema.gd`, and the Level-3-loading tests. Those are **exactly** the
files a Gate 3 integration must edit:

* `game/main.gd` — the only place that sets `level.level_data_path` and calls
  `reload_from_disk()`; an overlay must be re-attached after **every** reload, not once.
* `game/ui/hud.gd` — the respawn button and `_on_player_respawned` handling; Gate 3's
  director bypasses the button entirely, so whichever fix PR #3 lands decides whether the
  director is still needed.
* `game/levels/level_schema.gd` — entity type list; the promoted map must still validate.
* `tests/chapter_1_collision_route_test.gd`, `tests/chapter_1_balance_matrix_test.gd`,
  `tests/content/content_contracts_test.gd`, `tests/chapter_1_campaign_map_design_test.gd`
  — all load `res://data/levels/chapter_1_level_3.json` and will silently re-validate
  against whatever map is dropped in.

Merging Gate 3 first makes PR #3's conflicts worse, not better. The order that costs least
is: PR #3 lands → Level 3 ownership is decided → the overlay is ported onto the winning
map → native + Web gates run on that branch.

`content_contracts_test` pins `chapter_1_level_3: 20` enemies; both maps have 15 skeletons
+ 5 reapers = 20, so that specific assertion survives either way — the route and balance
matrix tests do not have that luxury.

### 4.5 Browser / Web playtest risk

The Web preset (`export_presets.cfg`, "Web Playtest") has never rendered Gate 3. What
changes for the browser: 12 extra `TileMapLayer`s over the whole map, one 116×96
`ImageTexture` shade sprite with linear filtering, 45 sprites, 10 `PointLight2D`s (no
shadows enabled — good for WebGL) and `CanvasModulate`. The only performance figure that
exists is software-rasterised (`render_process = 147.65 ms`, `physics 1.39 ms`), which is
a ceiling, not a browser number. Texture memory is trivial; the open questions are draw
calls (242 measured under llvmpipe) and per-frame TileMap update cost in WebGL2/WebGPU.
**Unverified. A browser frame-time capture is mandatory before any deploy.**

---

## 5. Acceptance criteria table

Legend: **P** passed and independently verified · **F** failed against a stated target ·
**U** unverified from this environment · **N** not applicable to the prototype decision

| # | criterion | verdict | evidence / reason |
| --- | --- | --- | --- |
| 1 | Material layers actually render (z-order fixed) | **P** | coverage assert 3413/3413 + 1686/1686; before/after pixel delta |
| 2 | No production file modified by the gate | **P** | `git diff --name-only fa83414..HEAD -- data game tests assets project.godot` = 0 |
| 3 | 79 entities byte-identical, original order | **P** | `write_change_manifest.py --check`, entity arrays compared |
| 4 | Real spawn + campaign entry, not a test harness teleport | **P** | `GATE3 CAMPAIGN ROUTE: chapter_1_level_3`; doors call `interact()` |
| 5 | Floor doors reciprocal, 3 storeys reachable | **P** | door lines + `floor 1..3` in 16/16 stability runs |
| 6 | Whole-sprite props, colliders match footprints | **P** | 21 solid footprints probed, each covered by a body |
| 7 | No overlapping solids / no unwalkable required route | **P** | authoring validator + `audit` 0 unreachable + walked routes |
| 8 | 18 hazards present and legible | **P** | 18 spike entities; crimson-bay frames; contrast 2.0–3.8× |
| 9 | Knight readable in combat and after respawn | **P** | `after_combat_space.png`, `after_respawn_after.png`, `GATE3 ENTITY Z` |
| 10 | Death → checkpoint respawn works natively | **P** | `respawn.txt`: died on spike, back at `(1576,744)`, HP 1100/1100, unpaused |
| 11 | Respawn exists in the shipped game | **F** | `RespawnButton` unwired, `respawn()` never called in production |
| 12 | Visual identity distinct from the 0x72 crypt | **P** | paired frames at 10 stations |
| 13 | Repeated stone surfaces resolved | **F** | 3× crop: regular 32-px diamond lattice on the apron |
| 14 | Floors 2–3 visually differentiated | **P** (limitation) | 12/9 props, 3/3 lights, material bias — programme, not surface |
| 15 | Framing ≥ 60 % building at every station | **F** | `floor2_arrival` 45.3 %, `floor3_camp` 59.2 % |
| 16 | No frame shows empty background | **P** | `void = 0 %` on all 16 frames |
| 17 | Camera bands prevent storey-gap framing | **P** | per-storey limits + `reset_smoothing()` |
| 18 | Median descent cost ≈ 40 % of the bar | **F** | 51.1 % across 16 runs |
| 19 | Maximum descent cost ≤ 75 % of the bar | **F** | 94.9 % |
| 20 | Level survivable without the prototype respawn | **F** | 11/16 descents exceeded a full bar |
| 21 | ≥ 90 % of damage attributed | **P** | 97.0 % across 16; one rendered deep run at 22 % gap |
| 22 | Zero `ERROR:`/`SCRIPT ERROR:` in capture logs | **P** | `grep -cE '^(ERROR|SCRIPT ERROR):' logs/*.txt` = 0 |
| 23 | ObjectDB leak explained | **F** (open, low) | 7 instances, unidentified, unchanged since Round 3 |
| 24 | Rendering performance acceptable on GPU | **U** | only llvmpipe figures exist |
| 25 | Rendering performance acceptable in the browser | **U** | never rendered in WebGL2 |
| 26 | Repository Level 3 tests still pass on the promoted map | **U** | route/balance matrix must be re-run on the integration branch |
| 27 | Report numbers match the evidence | **F** (fixed here) | median restated over 16 runs; respawn run count; §2 totals (§10) |

---

## 6. Precise disposition of the two framing failures

**Framing failure 1 — `floor2_arrival`, 45.3 % (target 60 %).**
It is a real failure, and the cause is locational, not statistical: the floor-1→2 door
delivers the player to the storey's western edge, so the arrival frame is roughly half
bare rock apron with one wall band and a checkpoint in view. This is the *first* picture of
floor 2 a player sees. It is not a camera bug — moving the camera would only hide it — and
it is not fixable in the prototype without moving the door or adding architecture at the
landing. Disposition: **accepted as an open defect; blocking for "composition accepted",
not for engineering adoption.** Fixing it belongs with whichever Level 3 map wins (§4.2)
and requires moving an authored door (owner sign-off).

**Framing failure 2 — `floor3_camp`, 59.2 % (target 60 %).**
A 0.8 pp miss on a self-imposed proxy, while the frame itself reads well (camp table,
cases, piers, two skeletons, warm light). The number and the picture disagree, which is
evidence that the metric is a proxy rather than the thing itself. Disposition:
**recorded as a metric miss, accepted on inspection; no remediation proposed.** The
honest way to close it is to stop presenting a single percentage as the composition
criterion.

---

## 7. Minimal, dependency-aware integration plan

Nothing below is executed, and none of it is safe to start before step 0.

| # | step | depends on | touches | owner gate |
| --- | --- | --- | --- | --- |
| 0 | **Decide the Level 3 map**: Candidate A (116×96, 79 entities) or shipped (116×84, 77). Resolve with PR #5's pilot contract. | — | nothing | **Design owner — mandatory** |
| 1 | Land PR #3 (integration + Web line) so the promotion has a base, or branch the promotion off it | 0 | — | maintainer |
| 2 | If 0 = shipped map: re-run `author_gate3.py` against `data/levels/chapter_1_level_3.json`; re-place props; regenerate material, shade and placement | 0, 1 | `data/**` | design owner |
| 3 | Move overlay runtime + documents + atlases out of `prototypes/` into `game/`, `data/`, `assets/` | 2 | `game/**`, `data/**`, `assets/**` | engineering |
| 4 | Add the attach hook where `DungeonLevel` rebuilds (re-attach on every `reload_from_disk()`) | 3 | `game/main.gd` | engineering |
| 5 | Decide the death flow (P1): wire `%RespawnButton` or ship the director | 0 | `game/ui/hud.gd`, `game/characters/knight/knight.gd` | **design owner — gameplay change** |
| 6 | Adopt per-storey camera bands in production camera code, scoped to Level 3 only | 5 | `game/main.gd`, camera | design owner |
| 7 | Re-baseline the Level 3 tests (route, balance matrix, map design, content contracts) against the new map | 2 | `tests/**` | engineering |
| 8 | Re-take all native evidence **on the integration branch**, not in `prototypes/` | 3–7 | docs/evidence | engineering |
| 9 | Browser capture: first frame, steady-state frame time, memory, on the Web preset | 3–7 | — | engineering |
| 10 | Independent visual + gameplay review of the promoted build, ≥ 85/100 | 8, 9 | — | reviewer |

Estimated change surface: **1 level document, 1 placement document, 4 atlases, ~800 lines
of runtime, 2 production gameplay files, 4 test files.** No schema change, no new
singleton, no second Knight/HUD.

---

## 8. Required regression tests before any promotion

**Native (Godot 4.7, on the integration branch):**
1. `chapter_1_collision_route_test` — every Chapter 1 map, including the promoted Level 3,
   with Knight-shaped clearance and door reciprocity.
2. `chapter_1_balance_matrix_test` — density bands and outcome envelopes re-run against
   the promoted map; a red result here is a real balance regression, not a flake.
3. `content_contracts_test` — registry → `data/levels/chapter_1_level_3.json` (it will
   already pass on the 20-enemy count; verify the rest).
4. `chapter_1_campaign_map_design_test` + `chapter_1_map_design_test`.
5. `campaign_entry_runtime_test` and the campaign loop: Level 3 must be enterable,
   completable and reward-paying with the overlay live.
6. The Round 4 gate itself, re-pointed at the production paths (coverage assert, prop
   colliders, hazard legibility), because the coverage assert is the only thing standing
   between "archive materials" and "a hole in the level".
7. A memory/leak check with the overlay live: the ObjectDB notice should not grow from 7.

**Browser (Web preset, PR #3's Playwright/smoke harness):**
8. Boot to first frame; the overlay must attach without console errors.
9. Steady-state frame time and draw calls at 1280×720 in WebGL2; compare against the same
   scene without the overlay to isolate its cost.
10. A scripted short walk on floor 1 and one floor-door transition, to prove the extra
    TileMapLayers and the `CanvasModulate`/lights behave in the browser renderer.
11. Check the build size delta and that the derived hazard frames and both atlases are in
    the exported `.pck`.

---

## 9. Verdict

**CONDITIONAL GO — for the visual system and its runtime architecture.**
**NO-GO — for promoting Candidate A as Level 3, and for accepting the current combat
balance as shipped.**

What justifies the GO: the archive material now genuinely renders (verified, not
asserted), the identity is real and differentiated from the shipped crypt, the props and
colliders are honest, hazards remain legible, the Knight reads in every frame including
the respawn one, and the overlay is a self-contained ~800-line adapter with no second
Knight, HUD or campaign manager. On the five review axes it is a different game from
Round 3.

What blocks a clean GO:

1. **Map identity (blocking, owner decision).** Gate 3 redesigns Candidate A, not the
   shipped Level 3, and PR #5 is simultaneously designing the shipped Level 3 under a
   no-substitution, 77-entity contract. One slot, two baselines.
2. **Combat balance (blocking, D2(a) preserved).** 51.1 % median net loss and 94.9 % max
   miss both declared targets; more importantly the **gross** cost has a median of 144.7 %
   of the health bar and 11 of 16 descents exceed one bar, so the level is not survivable
   without a respawn that the shipped game does not have. The sixteen-run median moved
   from 44.7 % to 51.1 % when one more sample was published, which is itself part of the
   finding: the harness's variance is the same size as the effect being judged.
3. **Composition (partial).** `floor2_arrival` at 45.3 % is a visible first-impression
   defect on floor 2; `floor3_camp` at 59.2 % is a metric miss that the picture does not
   support.
4. **Surfaces (visual).** The 32-px diamond lattice on the rock apron is still an
   artificial repeating pattern at 3×.
5. **Unverified performance (gate).** No GPU and no browser number exists for a scene
   that adds 12 TileMapLayers and a full-map shade sprite to a Web-targeted build.

**Smallest corrective scope that would convert this to an unconditional GO:**
*owner decisions on (0) the Level 3 map and (5) the death flow*, plus one authoring pass
for the two framing defects and the rock frames, plus one browser capture. No redesign
round, no new features, no new evidence architecture — the harness that produced this
round's numbers can produce the next round's.

---

## 10. Corrections applied to the Round 4 report

Applied in this round, to the report only. **No log, frame or level document was
modified**, so every number in the evidence remains exactly as published.

| § | was | is | why |
| --- | --- | --- | --- |
| 13.6 | "median 51 %" over twelve runs | sixteen runs, all four samples shown, median 51.1 % — and the twelve-run figure (44.7 %) stated as such | the original figure matched no data set the report named |
| 13.6 | "11 of the 12 needed at least one checkpoint respawn" | 12 of 16 runs, 15 respawns in total | respawns ≠ runs |
| 13.6 | "10 of the twelve at exactly 100 %" | 11 of 16 | recomputed per run |
| 13.6 | — | added: gross damage median 1 592 = 144.7 % of the bar; 11/16 descents exceed one bar | the number that decides survivability |
| 13.6 | "3 765–3 787 px each" | 3 763–3 787 px | measured range |
| 13.7 | "median of 51 %" | 51.1 % over sixteen runs, with the sample spread stated | as above |
| 2 | "PROPS 36 · LIGHTS 6" presented as the delivery | marked as the Phase C figures, with the Round 4 totals (45 props/21 solid, 10 lights) alongside | two real numbers, different rounds |

---

## Appendix — how to reproduce every number above

```bash
# framing percentages, recomputed independently of the runtime
python3 - <<'PY'
import json,re
mat=json.load(open('prototypes/gate3/visual_placement.json'))['material']
def cells(r): return {(int(c[0]),int(c[1])) for c in mat.get(r,[])}
build=set().union(*[cells(r) for r in ["floor","wall_face","mass","niche","coping","water","water_edge","decor","weather"]])
rock=cells('rock')|cells('rock_deep')
for f in ('after.txt','deep.txt'):
    for line in open('docs/gate3/evidence/logs/'+f):
        m=re.search(r'CAMERA FRAME: (\S+) floor \d cells \((\d+), (\d+), (\d+), (\d+)\) building ([\d.]+)%',line)
        if not m: continue
        l,t,r,b=map(int,m.groups()[1:5]); bb=rr=vv=0
        for y in range(t,b):
            for x in range(l,r):
                if (x,y) in build: bb+=1
                elif (x,y) in rock: rr+=1
                else: vv+=1
        print(m.group(1), round(100*bb/(bb+rr+vv),1), 'logged', m.group(6))
PY

# stability aggregate, from the three published samples
git show b76fe3f:docs/gate3/evidence/logs/stability_table.txt   # sample A
git show 48c7582:docs/gate3/evidence/logs/stability_table.txt   # sample B
git show 0516c67:docs/gate3/evidence/logs/stability_table.txt   # sample C
cat docs/gate3/evidence/logs/stability_table.txt                # sample D

# the numbers this round derived from them (16 runs)
#   net delta : 0,0,0,328,368,368,482,502,622,676,676,696,830,944,1004,1044 -> median 562 (51.1 %), max 1044 (94.9 %)
#   gross     : median 1592 (144.7 %)
#   > one bar : 11 of 16     deaths: 15 across 12 runs     explained: 24288 / 25040 = 97.0 %

# evidence integrity
grep -cE "^(ERROR|SCRIPT ERROR):" docs/gate3/evidence/logs/*.txt | grep -v ":0"
python3 tools/gate3/write_change_manifest.py --check
git diff --name-only fa83414..HEAD -- data game tests assets project.godot | wc -l   # 0
```
