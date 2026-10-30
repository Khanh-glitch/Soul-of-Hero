# Hollow Marches — Validation

Three kinds of evidence, kept separate on purpose:

| Kind | What it proves | Can it be faked by a green exit code? |
| --- | --- | --- |
| **Static contract** | the authored data is internally consistent and the production scripts parse | No — every check is an assertion about file content |
| **Native behaviour** | the real engine builds the world, moves the Knight, saves and reloads | No — each test asserts observable state and exits non-zero on failure |
| **Visual evidence** | pixels rendered from the real scene | No — a PNG is validated for size and non-uniformity, and the tool reports `BLOCKED` (exit 2) only when there is no display server |

## 1. Static contracts

### Geography gate (part of the bake)

```
python3 tools/overworld/author.py
```

`author.py` floods from the refuge `(56, 216)` across the **real** baked grids,
twice: once with all shortcuts closed, once with all four open. Any unreachable
threshold, camp or discovery aborts the bake with `refusing to bake` and writes
nothing. It also asserts that every shortcut's carve rectangle is fully solid
while closed — if it is not, the "opened shortcut" would be a sprite swap over a
wall that was never there.

The bake is deterministic (`stable_seed()` uses `crc32`, not Python's salted
`hash()`), so two runs produce byte-identical JSON.

Current result (engine 4.7-stable, this branch):

```
ground: ;=19194 ,=18629 g=18107 d=11005 b=9457 r=8000 f=6270 m=2592 -=1529 ~=1260 a=1030 v=636 y=595
solid cells 23338, detail cells 6328, props 6184
baked OK
```

### Data consistency

```
python3 tools/validate_overworld_topology.py
python3 tools/ci/validate_png.py <file.png>      # used by the visual job
```

`validate_overworld_topology.py` reads the *baked* layers and the emitted world
document. It checks the envelope matches the grid, every campaign level maps to
a landmark, the registry is bijective, every threshold stands on walkable
ground, every carve box is solid, camps/discoveries sit on real ground, and the
survival rates are ordered. It deliberately does **not** re-derive the map from
a second private model.

```
OVERWORLD TOPOLOGY VALIDATION PASSED
  10 landmarks, 4 camps, 8 discoveries, 4 shortcuts
  grid 384x256, solid cells 23338
```

### Parse gate

```
godot --headless --path . --script res://tests/overworld_static_contracts_test.gd
godot --headless --path . --script res://tests/overworld_regression_guard_test.gd
```

`overworld_regression_guard_test.gd` preloads the production scene and `load()`s
all eight overworld scripts (a syntax error kills the run before the first
assertion), then checks the specific mistakes that previously reached `main`:
`push_print(`, `.call_deferred(func`, `PackedVector2Array(0, 0)`, a Pythonic
list comprehension, and `add_physics_layer(<int>)`. It also asserts every
AppFlow hand-off method still exists.

The workflow additionally runs `godot --check-only --script` over every file in
`game/overworld/`, and runs the intentionally broken fixture
(`tests/fixtures/intentionally_broken_parse_error.gd`) expecting a non-zero exit
or a parse error in the log — if that fixture ever *passes*, the guard is dead
and the job fails.

## 2. Native behaviour tests

Every one of these boots the production scene (or the production `app_root.tscn`
for routing) and waits on the observable build contract, never on a frame count.
`tests/overworld_runtime_case.gd` is the single shared harness.

| Test | Asserts |
| --- | --- |
| `tests/overworld_scene_runtime_test.gd` | 384×256 envelope; ground/detail/solid are real `TileMapLayer`s with the expected cell counts; the TileSet declares a physics layer; `is_solid_cell()` agrees; >1500 prop sprites in a y-sorted parent; the Knight spawns in group `player` on walkable ground with a camera bounded to the world; 10 gates / 4 camps / 8 discoveries; HUD mounted; **ten named regions in the world document, every point of the map resolves to one, and two distant points resolve differently** |
| `tests/overworld_movement_runtime_test.gd` | walking on clear ground moves ≥24 px under the real `move_right` action; a cliff face stops the same input; the camera follows the body |
| `tests/overworld_provisions_runtime_test.gd` | 10 s of wild drain removes exactly the authored amount; a hazard costs more; safe ground costs nothing; a camp restores; an empty pack slows but never stops the march; provisions clamp at 0 |
| `tests/overworld_gate_runtime_test.gd` | all ten thresholds exist on walkable ground; L01 is `ENTER` and L10 is `LOCKED` on a fresh profile; a sealed gate starts no run; writing a clear flips L01 to `CLEARED` and L02 to `ENTER`; campaign authority agrees |
| `tests/overworld_shortcut_runtime_test.gd` | each shortcut's authored box is blocked closed, unblocked open, remembered as open, and its sprite is the crossing frame; closing restores the original terrain token; re-opening is a no-op |
| `tests/overworld_persistence_runtime_test.gd` | the schema-2 snapshot reaches disk as JSON under `overworld.hollow_marches`; a torn-down and rebuilt world restores provisions, camp, discovery, shortcut *and* the carved collision; the Knight resumes within 48 px; a future-schema block boots with defaults instead of crashing |
| `tests/overworld_roundtrip_runtime_test.gd` | Home → Marches through `AppFlow`; lighting a camp sets the anchor; a gate launches the **real** `chapter_1_level_1` (asserting `DungeonLevel` geometry cells and the production Knight); retreating returns to the Marches, not Home; no clear is awarded; the Knight lands at the last camp; a second descent still works |
| `tests/overworld_acceptance_test.gd` | the whole feature: Home → Marches → ten thresholds in map space → walk → terrain collision → shortcut open (collision + sprite) → camp → discovery (paid exactly once) → L01 enterable / L10 sealed → descend the real L01 → complete the real run → the real completion screen → back to the Marches → progress retained → save/reload → fatigue |

Commands. Locally these run headless (`--headless`), which is enough because
none of them reads a pixel; the CI workflow runs the same files under
`xvfb-run` with `--display-driver x11 --rendering-driver opengl3`, which also
exercises the real render path.

```
godot --path . --script res://tests/overworld_scene_runtime_test.gd
godot --path . --script res://tests/overworld_movement_runtime_test.gd
godot --path . --script res://tests/overworld_provisions_runtime_test.gd
godot --path . --script res://tests/overworld_gate_runtime_test.gd
godot --path . --script res://tests/overworld_shortcut_runtime_test.gd
godot --path . --script res://tests/overworld_persistence_runtime_test.gd
godot --path . --script res://tests/overworld_roundtrip_runtime_test.gd
godot --path . res://game/app/app_root.tscn -- --overworld-acceptance-test
```

## 3. Visual evidence

```
xvfb-run -s "-screen 0 1280x720x24" godot --path . \
  res://tools/captures/chapter1_overworld_native_capture.tscn -- \
  --out-dir=res://.artifacts/overworld/native
```

Photographs `world_overview` plus fourteen stations derived from the authored
world document (so the camera follows the geography if it is re-authored):
`refuge_start`, `crypt_approach`, `ossuary_approach`, `archive_approach`,
`reliquary_approach`, `road_terrain`, `camp_crossroads`, `shortcut_before`,
`shortcut_after`, `crucible`, `beacon`, `gate`, `throne`, `region_north`, so all
ten landmark exteriors are photographed (L03 and L04 were missing from this list
until they were added, which is why the two plainest landmarks were also the two
nobody had a frame of). A station is a landmark id from
`hollow_marches.json` plus that landmark's own `capture_offset`, which
`author.py` derives from the height of the sprite standing there — nothing is
hand-placed in the capture script. Each frame is rejected if it is blank
(sampled pixels identical). Exit codes: `0` wrote every station, `2` no display
server (reported as `BLOCKED` by the tool itself), anything else is a failure.

**Natively: PASSING in CI, BLOCKED in this sandbox.** There is no `Xvfb`, no
`libGL` and no `/dev/dri` in this container, so the capture exits 2 here with
`OVERWORLD CAPTURE BLOCKED - no display server`. The `VISUAL EVIDENCE` job
installs `xvfb` + `libgl1-mesa-dri` and takes the real frames. Latest run
[`40684317214`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40684317214)
(commit `979b23ca`): **13/13 PNGs, 1280x720, every station `blank=false`,
`OVERWORLD CAPTURE PASSED - 13 images`**, `Script/engine errors:` empty.

The capture is a script, so its log is gated exactly like every other step:
`tools/ci/gate_log.sh` fails the step on `SCRIPT ERROR`/`Parse Error`/`^ERROR:`
and requires the `OVERWORLD CAPTURE PASSED` line, with a genuinely blocked run
(exit 2) exempt because it has no PASS line to look for. That gate is what
turned three silently-broken capture runs into named bugs — see
`overworld_world_overview.png` below.

### Three bugs the gated capture log caught

Each of these produced a **green station** and a **wrong or missing PNG**:

| Symptom | Cause | Fix |
|---|---|---|
| `world_overview.png` missing, no failed station | `camera.clear_current()` — Godot 3 API, does not exist in Godot 4; the thrown error aborted `_overview()` mid-function and the caller carried on | making the overview camera current is what unsets the player's camera; the call is gone |
| one stray `ERROR: Home scene loaded, but AppFlow did not open the startup profile choice` | the harness opened a route while AppRoot's boot coroutine was still running, so boot recorded `failed` | the capture waits for `boot_state == "complete"` first and prints it |
| `world_overview.png` present, 47 KB, showing 4×2 tiles | `Camera2D.zoom` is a **magnification**; `zoom = (6144/640, 4096/360)` magnified a 67×32 px patch by ~10x instead of fitting the world | `zoom = 1/TILE` (one tile per logical pixel, 2×2 device pixels per tile), limits disabled, and the capture prints world px / view px / frame coverage and fails if the world does not fit |

### The frame report: what the pixels actually contain

The PNGs render on a runner and cannot be downloaded back, so "the capture
passed" used to mean "a 1280×720 file exists". The capture now describes each
frame in the log, and CI republishes that description as numbered annotations:

```
OVERWORLD LOOK crypt_approach colours=190 edges=24pct flat=14pct mean=0.355 std=0.071 top=505060:14,504030:12
OVERWORLD MAP crypt_approach 05 ::::::-----=-=+++=====----::::--
```

`colours` counts distinct 4-bit-per-channel colours, `edges` is the share of
sampled neighbours that differ in luminance by more than 0.04, `flat` is the
share of the frame taken by its single most common colour, and the map is the
composition at 32×16. Measured natively across the fifteen stations: **123–239
colours, 17–27 % edges, 11–29 % flat** (the whole-world overview is the outlier
by design — 56 % of that frame is the void around the 384×256 envelope).

A station fails below **24 colours or 8 % edges**. Both sit far under the
quietest real frame and far over a flat fill, so the gate is a floor rather than
a taste test.

Three things had to be wrong first, and each was found by using the thing:

| Attempt | Problem | Fix |
| --- | --- | --- |
| 3 bits per channel | `rock` (92,92,108) and `stone` (100,102,120) are different materials but landed in one 36-step bucket, so a plaza read as "58 % one colour" when it was two stones plus mortar | 4 bits per channel |
| `flat` as the quality measure | it punishes large coherent patches — exactly what makes weathered stone read as stone rather than noise | measure edge density |
| one annotation with the whole report | GitHub truncates at ~4 KB, mid-line: six rows of one station out of thirteen, the same failure as the earlier `tail -40` diagnostic | numbered notices, two stations each |

The overview is now arithmetically constrained rather than eyeballed: at
`zoom 0.0625` a 640×360 viewport covers 640×360 tiles, so all 384×256 tiles fit
and the map occupies 60%×71% of the frame (`OVERWORLD CAPTURE overview: world
384x256 tiles = 6144x4096 px, zoom 0.0625, view covers 10240x5760 px (640.0
tiles)`), and the PNG grew from 47 KB to 436 KB.

### Offline (supporting) evidence — not native screenshots

```
python3 tools/overworld/evidence.py
```

`evidence.py` composites the **shipped atlas** with Pillow using the same
per-cell variant hash as `OverworldTiles.variant_index`, at the camera's real
2x zoom in a 640×360 frame, and writes eleven PNGs in
`docs/overworld/evidence/`: the whole-world overview, eight stations, and the
`shortcut_before` / `shortcut_after` pair. It proves the art and the geography
are what was authored; it does **not** prove that Godot drew them.

`shortcut_after` applies the same rule the runtime applies
(`OverworldWorld._carve_shortcut`): the authored carve box is cleared out of the
SOLID layer. The script measures the pair and fails if opening the shortcut
changes almost nothing on screen — currently **13.7% of the frame changes**,
which is the bridge deck giving way to the water channel it was spanning.

The workflow then validates each required PNG (signature, ≥320×180, ≥6 KB so a
flat-colour frame cannot pass) via `tools/ci/validate_png.py`.

## Manual playtest checklist

1. Home → Campaign → enter the Marches. The Ashen Refuge is lit, provisions
   read 80/100, the region label follows you.
2. Walk the road north. Stone, grass, mud and marsh bands change underfoot; no
   invisible walls; cliffs and deep water stop you.
3. Approach L01: the threshold reads `ENTER`, clicking descends into
   `chapter_1_level_1`.
4. Finish or retreat. Victory returns you to the threshold; retreat puts you at
   the last lit camp, never back in Home.
5. Clear L05 and watch the crucible bridge: the sprite changes *and* the water
   collision under it is gone — walk across it.
6. Rest at a camp: provisions jump, the camp lights, the HUD counts move.
7. Search a discovery: paid once; clicking again does nothing.
8. Quit and relaunch: position, camps, discoveries, shortcuts and provisions
   are all where you left them.
9. Walk until provisions hit 0: the Knight slows to ~66 % and keeps walking.

---

# Mission 2 additions: occlusion, traversability, hybrid overrides

## Two new runtime gates

Both run on the production scene (`chapter1_overworld.tscn`), assert observable
state, and fail closed. Neither is a screenshot: they read the same objects the
game reads.

### `tests/overworld_traversability_runtime_test.gd` — 26 checks

| check | why it exists |
| --- | --- |
| grid matches the world (384×256) | the system measures the world it was built from |
| terrain agrees on 2 035 sampled cells, 0 disagree | the grid is not a second opinion about the terrain |
| every solid terrain cell counted (23 338) | no silent drops |
| prop bodies block cells of their own (10 078) | if this were 0 the grid would be measuring nothing |
| 0 sealed endpoints | the *assertion that matters*: every landmark threshold, camp, discovery and the spawn is reachable on foot |
| the flood starts on standable ground | the origin is real ground, not a tent |
| the player does not start inside a body | regression: a fresh character used to spawn inside the refuge tent |
| the walk to the citadel is 405 cells | the march is a journey, not a hop |
| bridge banks resolve, 14 → 6 cells when it opens | a shortcut that only swaps a sprite is not a shortcut |
| closing restores a body to collision | and closing it takes the wall back |

### `tests/overworld_occlusion_runtime_test.gd` — 22 checks

| check | why it exists |
| --- | --- |
| 2 620 tall props registered, in 1 042 buckets | occluders exist and the work is bounded |
| the landmark is 104 px tall, standable ground behind it | the scenario is physically possible before it is asserted |
| opaque at 1.00 with the system off, 0.62 behind it | the fade happens, and only when the player is behind |
| ≥ 0.40 remains | the destination stays readable while the Knight is visible |
| the landmark body still blocks its cell | fading is visual: collision is unchanged |
| 420 px away nothing fades (0), 109 of 2 620 considered | locality is real, not assumed |
| a tree fades to 0.30 vs a landmark at 0.62 | depth is by role |

### What they found

Writing the traversability system immediately found two real defects that no
existing gate covered:

1. `d_crucible_cove` and `d_relay_shard` were covered by dead-tree *bodies*.
   `author.py` validated collider props against interaction cells by their
   **anchor tile**, but a body is 0.82 of the sprite wide and hangs from the
   feet, so it routinely covers a neighbour. Both rewards were visible and
   unclaimable. Fixed by testing the body footprint at scatter time and adding
   the same rule to `validate()`; the bake now refuses to write a world where a
   prop body seals an interaction cell.
2. A fresh character spawned **inside the refuge tent**: `validate()` checked a
   hard-coded `(56, 216)` while the world document spawns at `(56, 218)`. Both now
   read one `START` constant, and the scene settles the player onto the nearest
   free cell before the first frame if a body ever covers the spawn again.

## Hybrid override pipeline

`tools/overworld/overrides.py` lets a hand-painted frame win at bake time without
editing the generator:

```
python3 tools/overworld/overrides.py --list       # what is overridden, from where
python3 tools/overworld/overrides.py --compose    # rebuild the atlas + manifest
python3 tools/overworld/overrides.py --report     # provenance per frame
```

`art.py` and `art_props.py` call `overrides.compose()` as their last step, so the
atlas is always "generated, then overridden" and deleting an override PNG restores
the generated frame. `data/overworld/art_manifest.json` records, per frame, the
rect, source file, origin (`generated` / `hand`), license and the atlas sha256.
`tools/overworld/source_audit.py --check` fails if a shipped pixel has no origin.

## Local suite results

`bash tools/overworld/local_suite.sh` — every gate the workflow runs, on this
machine, headless:

| gate | result |
| --- | --- |
| STATIC | `OVERWORLD_STATIC_CONTRACTS PASSED - 38 checks` |
| GUARD | `OVERWORLD_REGRESSION_GUARD PASSED - 82 checks` |
| KNIGHT | `KNIGHT_MINI PASSED - 4 checks` |
| SCENE | `OVERWORLD SCENE_RUNTIME_TEST PASSED - 29 checks` |
| MOVEMENT | `OVERWORLD MOVEMENT_RUNTIME_TEST PASSED - 7 checks` |
| PROVISIONS | `OVERWORLD PROVISIONS_RUNTIME_TEST PASSED - 15 checks` |
| PERSISTENCE | `OVERWORLD PERSISTENCE_RUNTIME_TEST PASSED - 26 checks` |
| GATE | `OVERWORLD GATE_RUNTIME_TEST PASSED - 35 checks` |
| SHORTCUT | `OVERWORLD SHORTCUT_RUNTIME_TEST PASSED - 30 checks` |
| TRAVERSABILITY | `OVERWORLD TRAVERSABILITY_RUNTIME_TEST PASSED - 26 checks` |
| OCCLUSION | `OVERWORLD OCCLUSION_RUNTIME_TEST PASSED - 22 checks` |
| ROUNDTRIP | `OVERWORLD ROUNDTRIP_RUNTIME PASSED - 27 checks` |
| ACCEPTANCE | `OWACCEPT: 64 checks, 0 failures` |

413 checks, zero failures. The engine is a from-source Godot 4.7 build
(`4.7.stable.custom_build.5b4e0cb0f`, linuxbsd, editor, no pulseaudio/alsa/dbus/
udev, `-j2`, 50 min).

**Honest limit of the local run:** this machine has no display server and no
libGL, so the *native capture* cannot run here — it hangs waiting for a frame
that a dummy renderer never draws, and `timeout` kills it (rc=124). The 17
station PNGs are produced by CI under Xvfb, which is why the visual claims in
`REVIEW.md` and the occlusion pair are backed by the offline renderer
(`tools/overworld/evidence.py`, same atlas, same tile math, same camera framing)
and marked as such. Logic verification is local and complete; the photographic
verification is CI's.
