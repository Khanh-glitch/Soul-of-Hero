# ROUND 6 — Reuse matrix: what survives without Gate 3's map

Companion to `ROUND_6_ARCHITECTURE_DECISION.md`. Every "measured" number below was
produced read-only on `d7f6da7` (see that document §1 for the probes); every "specified"
item is a requirement, not a result.

**The rule this matrix applies:** a Gate 3 component is *reusable* only if it reads its
geometry from the level document at runtime or from a level-parameterised authoring
function. Anything that encodes 116 × 96, Candidate A's spawn, Candidate A's door cells or
Candidate A's prop cells is **re-authoring work**, however small the code looks.

---

## 1. Summary table

| # | Subsystem | Verdict | Why (measured unless stated) |
| --- | --- | --- | --- |
| 1 | Floor / wall / niche / mass material painting | **REUSE (code) + REAUTHOR (data)** | Painter covers **5 004 / 5 004** canonical floor cells and **1 104 / 1 104** wall cells (764 `wall_face` + 340 `mass`), 0 cells painted outside the map. Only the *document* it emits must be regenerated per map. |
| 2 | Rock apron / `rock_deep` band + 8 flip/transpose variants | **REUSE (code), REJECT (content), REAUTHOR (density)** | Map-agnostic (`ROCK_RADIUS 22`, `ROCK_BAND_RADIUS 6`), but the two hand-drawn quarry frames produce a **32-px lattice** (measured autocorrelation below). Canonical apron is much thinner than Candidate A's: `rock` 3 411 / `rock_deep` **225** vs 4 256 / 1 757. |
| 3 | Shade field (single distance-transform sprite) | **REUSE** | `_build_shade()` reads `width`/`height` from the live level and fills an `Image.create(width, height)`. No 116 × 96 constant anywhere. |
| 4 | Local lanterns (`_build_lights`, 10 `PointLight2D`) | **REAUTHOR** | Light positions/energies are authored data in `visual_placement.json` for Candidate A's rooms. |
| 5 | `carve()` architecture (alcove, shaft, piers, garth basin, south bay) | **REJECT for any map** | It **edits collision**: −27 wall cells → floor, +11 new wall cells (`SHAFT_SEAL`). A presentation layer must not do that. Keep as a design-time authoring tool for a *future* redesign, never in the presenter. |
| 6 | Props: whole-sprite placement + one collider per solid prop | **REUSE (algorithm) + REAUTHOR (placements)** | `fit_placements()` on canonical: **45 of 52 accepted**, 7 rejected (all floor-3 south cells), **28 explicitly relocated** (median 3.5 cells, max 9). |
| 7 | Hazard visual treatment (derived crimson-pit spike frames) | **DEFER** | Code is generic (`dungeon_hazards` group, per-sprite `SpriteFrames` swap). The frames are a product/art decision in a frozen tree; Round 5 §2.5 confirms no hazard was removed or dimmed. |
| 8 | Per-storey camera framing (`_build_camera`, `_apply_camera_band`) | **REAUTHOR** | Bands derive from `metadata.rooms`, but on the canonical 84-row map they **overlap by 5 and 9 rows and run past the map edge** (§4). The concept survives; the derivation does not. |
| 9 | Checkpoint z-order fix (`_tuck_checkpoints`) | **REUSE (and fix in production)** | 6 lines, keyed on the `RespawnPoint` child that every checkpoint entity already has. Map-agnostic. Fixes a real occlusion defect recorded in `after_respawn_after.png`. |
| 10 | Overlay lifecycle / attach + reload re-attachment | **REAUTHOR** | `EXPECTED_LEVEL` hardcodes one path; `main.gd::_on_level_data_changed()` respawns entities and calls `_apply_camera_bounds()`, which would duplicate props and clobber the bands. |
| 11 | Coverage / collision validation (`REPLACEMENTS` proof, `check_coverage`, `worldmodel.audit`) | **REUSE (all three)** | The proof is what makes hiding `Backdrop`/`Geometry` safe; it must run per map, and it does. |
| 12 | Respawn director (`_build_respawn`, `_on_player_died`) | **REJECT** | Automatic revival; see decision document §4.4. |
| 13 | Evidence-integrity tools (`make_derived_art.py --check`, `write_source_manifest.py`, `write_change_manifest.py`) | **REUSE** | Deterministic, path-driven, already wired as CI checks. |
| 14 | `tools/gate3/worldmodel.py` | **REAUTHOR** | `DOORS` is hardcoded to Candidate A; must be derived from `floor_door` entities (`position`/`target_position` ÷ 16) or it validates the wrong doors. |
| 15 | PR #5's `tools/design/levels3_4_pilot_audit.py` | **REUSE, re-pinned** | Independent contract auditor; **PASS** on canonical, Candidate A and Gate 3's map (measured). Needs its `BASE` and `SLOTS` re-pinned to whichever L3 wins. |

---

## 2. Measured portability evidence

### 2.1 Material painting against the canonical 116 × 84 map (painter only, `carve()` excluded)

```
roles        rock 3411  rock_deep 225  floor 5004  coping 0  water 0  water_edge 0
             wall_face 764  niche 206  mass 340  shadow 382  weather 450  decor 109
floor cells  5004 painted / 5004 in Backdrop      floor-role cells outside Backdrop: 0
wall cells   764 + 340 = 1104 of 1104 Geometry    out-of-bounds cells: 0
painted total 9744 cells
```

For comparison, Candidate A (uncarved): `rock 4256 / rock_deep 1757 / floor 3351 /
coping 38 / water 70 / water_edge 34 / wall_face 968 / niche 265 / mass 734 / shadow 501 /
weather 309 / decor 108`, floor 3 351/3 351, wall 968 + 734 = 1 702/1 702, 11 136 cells
painted, 0 out of bounds.

**Two consequences.**

* The painter is genuinely map-agnostic: on the canonical map it needs no garth, so
  `coping`/`water`/`water_edge` simply emit nothing and every other role still covers its
  layer completely. This is the single strongest portability result of the round.
* One hardcoded leak exists *inside* `build_material()`: the sealed-stair decor loop
  `for index, x in enumerate(range(SHAFT_ROOM[0] + 1, SHAFT_ROOM[0] + 6))` paints
  `stair_0..4` at `y = SHAFT_ROOM[3] + 1`. On the canonical map that lands on **floor**
  cells `(30, 21)`, `(31, 21)`, `(32, 21)` — stone steps painted over walkable floor that
  has no shaft. It is 3 cells out of 9 744, and it is exactly the kind of 116 × 96
  assumption the matrix is meant to catch. **REAUTHOR** (gate it on a `sha_fixture`
  key in the level/placement document rather than a module constant).

### 2.2 Props are bound to the 116 × 96 layout, the fitting algorithm is not

`fit_placements(level, PLACEMENTS)` with `worldmodel.DOORS` re-derived from the canonical
map's four `floor_door` entities:

* **45 of 52 placements accepted** (86 %).
* **7 rejected** — `armarium_open [30,80]`, `column [52,84]`, `stone_bench [48,88]`,
  `candle_stand [66,88]`, `column [56,86]`, `paternoster [44,88]`, `drying_rack [30,88]`.
  Every one of them is a floor-3 / southern-storey cell that does not exist below row 84.
* **28 of the accepted props are explicitly relocated** by the fitting pass (median
  Manhattan displacement **3.5 cells**, max **9**) because Candidate A's cells are occupied
  by different canonical geometry.
* With the Candidate A door list left in place the result is meaningless (unreachable
  doors, false "sealed" verdicts). This is the trap already recorded in the Round 5 notes
  and it still bites: **derive doors, never inherit them.**

Verdict: the algorithm (sprite-rect colliders, choke-point safety, entity-clearance) is
reusable and its safety proof is worth keeping; the 52-row placement table is 116 × 96
art. Re-authoring is a real pass with a real frame cost, not a find-and-replace.

### 2.3 Rock apron: the 32-px lattice is real, and it is a content problem

Round 5 reported a "regular 32-px diamond lattice" on the apron at 3×. Measured this round
by normalised autocorrelation of four 180 × 120 patches of `after_floor2_arrival.png`:

| patch | (16,0) | (32,0) | (64,0) | (32,32) |
| --- | --- | --- | --- | --- |
| (900,560) | 0.66 | **0.32** | 0.23 | −0.04 |
| (300,540) | 0.61 | 0.25 | 0.01 | 0.09 |
| (1050,180) | 0.42 | 0.18 | −0.07 | 0.01 |
| (60,600) | 0.67 | **0.60** | **0.56** | −0.06 |

A 32-px horizontal period with near-zero diagonal correlation in three of four patches
confirms both the reported lattice *and* the diagnosis: eight flip/transpose variants of
the same two frames break the 16-px weave but leave a 32-px period. **No amount of
compositing fixes this**; it needs more/apart rock frames or a different blend. That is an
`assets/**` change and therefore owner-gated. Recorded as REJECT (content) + REAUTHOR
(density), not as a coding task.

Density also does not transfer: `rock` 3 411 / `rock_deep` 225 on canonical versus
4 256 / 1 757 on Candidate A. On an 84-row map the `ROCK_RADIUS = 22` band still covers the
frame, but there is far less deep rock, so the **rock-repetition evidence from Gate 3
cannot be inherited** — it must be re-taken at 1× and 3× on the canonical map (and on
Candidate A if direction B wins).

### 2.4 Camera framing does not survive the 84-row envelope

`_build_camera()` merges each storey's room rects and grows them by `CAMERA_PAD_CELLS = 5`,
then `_apply_camera_band()` grows any band narrower than 41 × 24 cells. Recomputed from
`metadata.rooms` (this reproduces Gate 3's own CI log line for Candidate A exactly —
`floor 1 [P: (1,-2), S: (110,31)]`, `floor 2 [P: (11,34), S: (103,34)]`,
`floor 3 [P: (2,70), S: (113,29)]`):

| map | floor 1 | floor 2 | floor 3 | defects |
| --- | --- | --- | --- | --- |
| Candidate A | `P(1,−2) S(110,31)` rows −2…29 | `P(11,34) S(103,34)` rows 34…68 | `P(2,70) S(113,29)` rows 70…99 | rows 99 > 96 (pad overshoot, harmless at runtime because limits clamp) |
| **canonical** | `P(−1,−4) S(120,33)` rows −4…29 | `P(−1,25) S(120,39)` rows 25…64 | `P(−1,56) S(116,30)` rows 56…86 | **floor 1 ∩ floor 2 = rows 25–29; floor 2 ∩ floor 3 = rows 56–64**; x extends to 119 > 116; y to 86 > 84 |

The canonical bands overlap, so "_which storey am I on_" is ambiguous for 5 and 9 rows of
travel, and each band is ~120 cells wide — i.e. the whole map. On the canonical map the
banding degenerates into "no banding", which is precisely why the **floor-2 arrival framing
(45.3 %, door at the west edge of frame) cannot be reproduced there by reusing this code.**
Fixing it needs a different derivation (e.g. per-storey bands from the *floor* cell
extent, hysteresis on the floor transition, or a first-impression clamp around the door
landing cell) and new captures.

**Explicit non-permission:** no camera change may be tuned to raise the composition
percentage. `camera_frame_report()` exists to describe a frame; using it as an objective
would convert a visible first-impression defect into a metric that passes. Round 5 §2.6
already recorded that trap.

---

## 3. Subsystem detail: dependencies, ownership, target location

Legend for **Target**: the path the component would occupy *after* an owner-approved
promotion. None of these moves happened in Round 6.

### 3.1 Material + shade presenter — REUSE (code)

* **Files:** `prototypes/gate3/gate3_redesign.gd::_build_material()`,
  `_alternative_for()`, `_build_shade()`, `_hide_level_layers()`, `METHOD` constants
  `MATERIAL_ORDER`, `REPLACEMENTS`, `ROCK_VARIANT_ROLES`; data in
  `prototypes/gate3/visual_placement.json` (`material`, `layer_style`,
  `hidden_level_layers`, `shade`, `tile_atlas`); art `prototypes/gate2/art/archive_tiles.png`.
* **Depends on:** `DungeonLevel` node existence, `Entities` y-sort, the level's own
  `level_data` (`width`, `height`), and the *complete* coverage proof — the code refuses to
  hide a production layer whose cells are not all replaced.
* **Target:** `game/levels/presentation/archive_presenter.gd` (or equivalent), placement
  document to `data/presentation/chapter_1_level_3.presentation.json`, atlas to
  `assets/environment/archive/`.
* **Re-authoring:** run `author_gate3.py --level <chosen map>` to regenerate the material
  document; delete the hardcoded stair loop or gate it on authored data; re-verify coverage
  with `check_coverage()` before the first frame is taken.

### 3.2 Rock apron — REUSE (code), REJECT (content), REAUTHOR (density)

* **Files:** the rock branch of `build_material()`, `_alternative_for()` + `_alternative_cache`,
  `ROCK_RADIUS`, `ROCK_BAND_RADIUS`.
* **Re-authoring:** decide density per map (canonical's `ROCK_RADIUS 22` band is far
  thinner than Candidate A's); re-take the 1× and 3× repetition evidence per map. Art
  frames are a separate owner decision.
* **Do not** flip or scale the shade/rock to change measured composition.

### 3.3 Lighting — REAUTHOR

* **Files:** `_build_lights()`, `visual_placement.json:lights` (10 entries),
  `prototypes/gate2/art/light_radial.png`.
* **Depends on:** `PointLight2D` availability under `gl_compatibility`; no shadows
  (deliberate, keeps WebGL2 cheap).
* **Re-authoring:** positions are Candidate A's rooms. A per-map light list is authored
  art data, not code. Keep the "local lanterns only, no shadows" constraint; it is the
  reason the Web risk stays low.

### 3.4 `carve()` architecture — REJECT (as a runtime component)

* **Files:** `carve()`, `ALCOVE`, `SHAFT_ROOM`, `SHAFT_DOOR`, `SHAFT_SEAL`, `SOUTH_PIER`,
  `SOUTH_BAY`, `GARTH*`, and the `stair_*` decor loop.
* **Measured effect:** −27 wall cells (become floor), +11 wall cells, +62 floor cells. It
  changes collision and therefore the level contract.
* **Disposition:** keep it as a *design-time* authoring utility inside `tools/`, never call
  it from the presenter. If a future redesign wants the alcove or the shaft, that is a
  level-design change and must go through the same review as any layout edit (see
  `ROUND_6_ARCHITECTURE_DECISION.md` §3.3).

### 3.5 Props — REUSE (algorithm), REAUTHOR (placements)

* **Files:** `fit_placements()`, `prop_document()`, `sprite_rect()`, `collider_rect()`,
  `validate_props()`, `validate_prop_choke()`; runtime `_build_props()`; art
  `prototypes/gate2/art/props.png` + `props.json`.
* **Contract that must survive re-authoring:** one static rectangle per solid prop derived
  from the sprite's own rendered width (no rectangular approximations of round sprites),
  no overlapping solids, no sealed entities, no softlocks, no choke the Knight cannot pass.
  `validate_routes()` + `validate_prop_choke()` are the enforcement and they are reusable.
* **Re-authoring cost on canonical:** 7 placements need new cells (the floor-3 south wall
  does not exist below row 84), 28 relocate automatically, and every prop's collider must
  be re-proved against the canonical route.

### 3.6 Hazard treatment — DEFER

* **Files:** `_reskin_hazards()` + `HAZARD_FRAME_PATHS` + `tools/gate3/make_derived_art.py`.
* **Why defer, not reuse:** the *mechanism* is generic and honest (same frame count, same
  8 fps, same footprint, spike pixels unchanged), but the crimson-pit frames are an art
  substitution in a frozen tree, and Round 5 recorded that removing the plate made the
  hazard read as rubble. That is a product decision about hazard legibility, and the
  standing constraint is that hazard visibility may never be reduced.

### 3.7 Camera framing — REAUTHOR

Covered in §2.4. Files: `_build_camera()`, `_process()`, `_apply_camera_band()`,
`camera_frame_report()`; production dependency `main.gd::_apply_camera_bounds()` (`:247`).
Target: a presenter-owned camera controller that (a) derives bands from floor-cell extents
with hysteresis, (b) never extends limits past `0 … width*16`, and (c) is re-derived — or
deliberately discarded — on `map_changed`.

### 3.8 Checkpoint z-order — REUSE, promote early

* **Files:** `_tuck_checkpoints()`.
* **Why it is the cheapest win in the whole matrix:** it is six lines, it keys on
  `RespawnPoint` (present on every checkpoint entity in every Chapter 1 map), it changes
  only `z_index` (position, collision, trigger and glow untouched), and it fixes a defect
  that predates Gate 3 — the Knight respawning *behind* the checkpoint plate. It is also a
  prerequisite for judging any revival UX (you cannot photograph a revival you cannot see).

### 3.9 Overlay lifecycle — REAUTHOR

* **Files:** `attach_to_level()`, `EXPECTED_LEVEL`, `_load_placement()`, `get_failures()`.
* **Problems to solve, with the production hook for each:**
  * `EXPECTED_LEVEL` must become a per-level lookup (a presentation document per level,
    keyed by `level_data_path`), not `chapter_1_level_3`.
  * `dungeon_level.gd::reload_from_disk()` (`:51`, file watcher every 0.55 s in
    `_process()`) re-applies all three tile layers and emits `GameEvents.map_changed`;
    `main.gd::_on_level_data_changed()` (`:833`) then respawns every entity. A presenter
    attached once would leave **orphaned props and stale colliders** over freshly spawned
    entities. It must detach and re-attach on `map_changed`, idempotently.
  * `_fail()` uses `push_error`. The Web smoke test (`tests/ci/web_playtest_browser_smoke.cjs:21`)
    fails the build on **`warning` as well as `error`** console output, so the presenter
    must be silent on the happy path and must not warn per prop.
  * `attach_to_level()` returns `bool` and accumulates `_failures`; keep that shape — it is
    what lets a test assert refusal instead of silently painting nothing.

### 3.10 Validation tooling — REUSE

| Tool | What it proves | Reuse action |
| --- | --- | --- |
| `REPLACEMENTS` + `_hide_level_layers()` | no wall the Knight collides with becomes invisible | none — run per map |
| `check_coverage()` | every floor/wall cell has a replacement role | none — run per map |
| `tools/gate3/worldmodel.py audit` | reachability/doors on the authored map | **re-derive `DOORS`** from `floor_door` entities |
| `tools/design/levels3_4_pilot_audit.py` | no entity id/type/reward payload lost | re-pin `BASE` + `SLOTS` to the winning L3 |
| `make_derived_art.py --check`, `write_source_manifest.py --check`, `write_change_manifest.py --check` | derived art and manifests are reproducible | none |
| `tests/chapter_1_campaign_map_design_test.gd` etc. | the production map contract | unchanged — they run against the production path |

---

## 4. Re-authoring scope, as an estimate rather than a promise

| Item | Direction A (canonical 116 × 84) | Direction B (Candidate A 116 × 96) |
| --- | --- | --- |
| Material document regeneration | automatic (`build_material`, 9 744 cells) | automatic |
| Prop placements | **52 rows to re-fit**, 7 need new cells, 28 auto-relocate, all colliders re-proved | 0 (as authored) |
| Lantern list | 10 → re-derive from canonical rooms | 0 |
| Stair-decor constant | must be deleted or gated | 0 |
| Camera bands | new derivation (bands overlap today) | 0 concept change, still needs the framing fix from Round 5 |
| Rock repeat evidence | re-take at 1× / 3× | re-take at 1× / 3× |
| Frames (spawn/mid/end, floor 2, floor 3 camp) | all re-take | all re-take (the map changes with the carve if `carve()` is dropped) |
| Balance re-measure | required (the canonical route differs) | required |

Nothing in the right-hand column is free either: adopting Candidate A still invalidates
every Gate 3 frame because the shipped presenter must stop using the carved fixture.

---

## 5. What must **not** be reused, in one list

1. `prototypes/gate3/level_data/chapter_1_level_3_gate3.json` — carved fixture, never a
   production map.
2. `carve()` and every coordinate constant it uses (`ALCOVE`, `SHAFT_*`, `SOUTH_*`, `GARTH*`).
3. `worldmodel.DOORS` as written.
4. `gate3_redesign.gd::EXPECTED_LEVEL`.
5. The 52-row `PLACEMENTS` table and the 10-entry `LIGHTS` table, unmodified.
6. The sealed-stair decor loop inside `build_material()`.
7. `_build_respawn()` / `_on_player_died()` (the respawn director).
8. Any framing number or composition percentage taken on the carved fixture and presented
   as a property of "Level 3".
