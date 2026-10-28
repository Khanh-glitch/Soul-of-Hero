# THE HOLLOW MARCHES — BIÊN VỰC TÀN VONG — hand-off

Branch `arena/54306b59-soul-of-hero`. Everything below was executed on this
branch; numbers are from the runs named next to them. Nothing here is inferred
from a green exit code.

---

## A. Branch and exact SHA

| Item | Value |
| --- | --- |
| Branch | `arena/54306b59-soul-of-hero` (only branch written to; `main` untouched) |
| HEAD | `a9a3d1d6` (this document) on top of `c8dfd4ef59562790a05cce3023ca4b100a42bda1` |
| Verified code state | `c8dfd4ef` — run `40686549192`, all three jobs green. The overworld workflow is path-filtered, so a docs-only push does not re-run it |
| Base | `5214788933b1a827f3a177d11ff486433dfe5e8a` (`main`) |
| Engine | Godot `4.7.stable.custom_build`, built from source in-sandbox (scons 4.11.1 + local `pkg-config` shim) |

Overworld-relevant commits, oldest first:

```
3d364327  Integrate Chapter 1 visual overhaul (6e89e68d) with Hollow Marches overworld (582489aa)
bd835cb9  Overworld: real geography, real loop, honest evidence
bbc91da6  CI: mirror the repo's proven Xvfb invocation, surface failures as annotations
182ff064  Capture: stop overriding the root window, and bound every frame wait
61bd6c00  CI: control capture + verbose trace for the overworld capture
4b51d30a  CI: one fail-closed log gate, honest about engine shutdown notices
8c0d8572  CI: capture with the exact invocation that already works in this repo
b7acb15e  Capture: native PNGs now come out of CI; diagnose the one that does not
52519172  Capture: fail closed on a zero-byte PNG, and one multi-line diagnostic
c36e98b2  CI: show the head of the capture log in the verify diagnostic
1fa83303  Capture: the overview aborted silently; gate the capture's own log
676ecbaf  Capture: no Camera2D.clear_current in Godot 4, and no detour through Home
329be559  Capture: wait for AppRoot boot before opening the Marches
979b23ca  Capture: the overview camera was zoomed 10x in, not out
c8dfd4ef  Overworld: clustered rubble on the plazas, and a bake that refuses bad props
```

## B. Baseline integration and preserved assets

The source branches were read through Git, ancestry was established, and the
overworld work was integrated **into** this branch (`git merge -X theirs`,
`3d364327`), not the other way round — no source branch was modified, forced or
merged into `main`.

Preserved unchanged: Chapter 1's authored interiors and their art set
(`game/levels/presentation/`, `data/environment/chapter1/`,
`assets/environment/chapter1/`, `tools/chapter1_env/`), the L01–L10 gameplay and
campaign unlock chain in `data/content/levels/chapter_1_level_*.tres`, reward
idempotency (`transact_once`), Hero Soul progression, Home screens, save
compatibility, combat/animation/VFX, render scale (640×360 internal, 1280×720
presentation) and input (interaction stays an unhandled LMB over
`player_interactable` — no new input action was introduced).

Added, additive only: `game/overworld/`, `data/overworld/`,
`assets/environment/overworld/`, `tools/overworld/`,
`tools/validate_overworld_topology.py`, `tests/overworld_*`,
`tools/captures/chapter1_overworld_native_capture.*`,
`.github/workflows/overworld-runtime-validation.yml`, `docs/overworld/`, plus two
hooks in `game/app/app_root.gd` and the campaign tab's `BƯỚC VÀO VÙNG BIÊN`
button.

Conflict resolutions, for the record: `knight.tscn`/`knight.gd` kept Chapter 1's
version and gained only the group name the overworld queries; `app_flow.gd` kept
its route table and gained `OVERWORLD_SCENE` + `open_overworld()`; the campaign
tab kept its layout and gained one button; `project.godot` gained no autoload.

## C. Runtime results

Local, on the built engine (all re-run after the final content change):

```
OVERWORLD_REGRESSION_GUARD            PASSED - 82 checks
OVERWORLD_STATIC_CONTRACTS            PASSED - 38 checks
OVERWORLD SCENE_RUNTIME_TEST          PASSED - 29 checks
OVERWORLD MOVEMENT_RUNTIME_TEST       PASSED -  7 checks
OVERWORLD GATE_RUNTIME_TEST           PASSED - 35 checks
OVERWORLD PROVISIONS_RUNTIME_TEST     PASSED - 15 checks
OVERWORLD SHORTCUT_RUNTIME_TEST       PASSED - 30 checks
OVERWORLD PERSISTENCE_RUNTIME_TEST    PASSED - 26 checks
KNIGHT_MINI                           PASSED -  4 checks
OVERWORLD ROUNDTRIP_RUNTIME           PASSED - 27 checks
OWACCEPT:                              64 checks, 0 failures
```

The acceptance run is the production path: HOME → campaign tab →
`EnterOverworldButton` → `AppFlow.open_overworld` → the Marches → terrain
collision → a discovery (paid once, `40` coins) → a camp → a shortcut (sprite and
collision) → L01 `ENTER` / L10 `LOCKED` → the **real** `chapter_1_level_1`
(`DungeonLevel`, >100 cells) → the real completion screen →
`abort_to_hub(&"campaign")` → back on the overworld within 96 px of the camp →
progress retained → save/reload. Account currency moves `0 → 40 → 160`.

The roundtrip does not name methods and call it a day: it asserts the returned
route is `overworld`, that the level reads uncleared, and that the player is
within 96 px of `camp.rest_position()`.

## D. World design

`data/overworld/hollow_marches.json` + `hollow_marches_layers.json`, authored by
`tools/overworld/author.py` (single source of geography; `python3
tools/overworld/author.py` re-bakes and refuses to write an unreachable world).

* **Envelope** 384×256 tiles (6144×4096 px), three layers (`ground`, `detail`,
  `solid`) as RLE; 23 338 solid cells, 6 328 detail cells, 6 184 props.
* **Reachability** flood fill from the refuge: 73 171 cells with shortcuts
  closed, 73 296 open. Every threshold, camp and discovery must be reachable in
  **both** states or the bake aborts.
* **Ten landmarks → L01…L10**, thresholds one tile south of the building:
  crypt (88,180), ossuary (64,128), archive (132,152), reliquary (200,136),
  crucible (192,192), relay (288,140), beacon (208,80), divided (272,72),
  gate (208,40), throne (280,36). Road distances from the refuge:
  69 / 109 / 141 / 225 / 161 / 309 / 289 / 361 / 329 / 405 tiles.
* **Four camps** — Ashen Refuge (56,216, lit at start), Wayfarer Stones (152,188),
  Relay Foot (248,158), Watch Ridge (208,104). Camps are tents + furniture + a
  standing fire, not a decorative flame.
* **Eight discoveries**, each paid once via `transact_once("overworld:discovery:<id>")`:
  crypt offer 40 coins, ossuary stash, archive lore, shrine grove (+provisions),
  crucible cove, relay shard, quartermaster 80 coins, gate plunder.
* **Four shortcuts**, each a real carve box cleared out of the solid layer plus a
  sprite swap: crucible bridge (181,209)–(187,211), relay conduit
  (254,122)–(258,128), beacon rubble (204,93)–(212,98), gate valve
  (232,48)–(234,52).
* **Survival** one resource: provisions, 100 max / 80 start, 0.22·s⁻¹ wild,
  0.0·s⁻¹ safe, 0.75·s⁻¹ hazard, camp +60, discovery +20, empty pack = 0.66×
  speed, never a hard stop. Three hazard regions: crucible basin, fen marsh,
  relay watershed.
* **Two traversal loops** (the western spur and the basin loop) plus the
  pilgrimage road; `ROUTE_GRAPH.md` carries the measured distances.

## E. Visuals

* 16 px tiles, 640×360 internal, 1280×720 presentation, nearest filtering,
  camera zoom 2 in play.
* `overworld_tiles.png` 212 frames (512×112), `overworld_props.png` 47 frames
  (512×370), both generated by `art.py` / `art_props.py` and indexed by JSON.
* Ground families carry several variants picked by a stable per-cell hash, so a
  wide apron does not repeat; surfaces are grained in 2 px clusters because a
  per-pixel speckle becomes noise at zoom 2, and edge masks are consumed as
  *exposed* bits (`opened_mask()`) so roads and copses do not resolve into a
  16 px lattice.
* Ten exterior identities share one material culture but have distinct
  silhouettes and furniture (gatehouse with braziers and portcullis, castle keep
  with twin towers and banners, ritual basin, beacon ring, archive, ossuary
  hypostyle…); camps read as inhabited.
* Two scatter passes: colliders (trees, columns, tents) keep a two-tile corridor
  off every lane; non-colliders (rubble, bones, barrels) use a one-tile corridor
  with clustered density so the plazas are not empty fields — 4 451 → 6 184
  props with the ground/detail/solid layers byte-identical.
* Whole-world overview: `zoom = 1/TILE`, one tile per logical pixel (2×2 device
  pixels), so all 384×256 tiles fit and the map fills 60%×71% of the frame.

## F. Persistence

Key `["overworld","hollow_marches"]`, schema **2**, through the existing
`SaveService` (`overworld_state.gd`). Round-trips: player position, opened
shortcuts, activated camps, claimed discoveries, possessions/provisions.
Failure behaviour, asserted: an unreadable block boots authored defaults; a
future schema (99) boots defaults instead of crashing; a corrupt position is
clamped into the envelope; a shortcut re-opened after load does not re-pay its
discovery. No new save file, no schema fork, no progression change.

## G. Test evidence

Workflow `.github/workflows/overworld-runtime-validation.yml`, three separate
jobs — static contracts, native behaviour, visual evidence — so a green picture
can never stand in for a behavioural result.

| Run | Commit | Result |
| --- | --- | --- |
| [`40686549192`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40686549192) | `c8dfd4ef` | **all three green** — STATIC 36 s, VISUAL 1 m 9 s (13/13 PNGs, `OVERWORLD CAPTURE PASSED - 13 images`), NATIVE 1 m 21 s |
| [`40684317214`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40684317214) | `979b23ca` | all three green; first run with the overview actually showing the world (436 KB vs 47 KB) |
| [`40683536183`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40683536183) | `329be559` | all three green; 13 PNGs, boot race fixed |
| [`40682890254`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40682890254) | `676ecbaf` | VISUAL red — the gated capture log named `clear_current` and the boot race |
| [`40682198226`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40682198226) | `1fa83303` | VISUAL red — first run with the capture's own log gated; named both bugs |
| [`40681511867`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40681511867) | `c36e98b2` | VISUAL red — `world_overview.png (missing/empty)`, no failure attached |
| `40679114636`, `40680004290`, `40680741314` | `8c0d8572`…`52519172` | capture produced 12–13 PNGs; overview missing |
| `40677523855`, `40674904069`, `40672343598` | `61bd6c00`, `182ff064`, `bbc91da6` | VISUAL exit 124 — the **job's invocation**, not the scene (a known-good control capture timed out too); fixed by removing `--windowed` and `--user-data-dir` and installing `libgl1-mesa-dri` |

Two gates keep the logs honest, and both are why the capture failures above were
found rather than assumed:

* `tools/ci/gate_log.sh <log> <label> "<PASS line>"` — the single fail-closed
  gate used by every native step and by the capture itself. Fails on
  `SCRIPT ERROR` / `Parse Error` / `^ERROR:` (with surrounding frames), tolerates
  and annotates `resources still in use at exit` / `ObjectDB instances were
  leaked`, and requires the step's PASS line. It exists because bare `at: `
  matches Godot's V-Sync frame and `^ERROR:` matches shutdown accounting — the
  earlier inline greps failed a *passing* run.
* `tools/ci/validate_png.py` — every required PNG is checked for signature,
  size (≥320×180) and payload (≥6 KB), so a flat-colour frame cannot pass.

**Known baseline failures (not caused by this branch).** Workflow
`Godot 4.7 Runtime Validation`, run
[`40686549129`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40686549129):
the two branch jobs pass (`Xvfb rendered gameplay captures`, `Import and
headless runtime tests`); the third job deliberately re-runs the same corrected
tests against **original `main`** and fails there — `SMOKE TEST FAILED — 3/89
checks failed` (second light input accepted; hot-tuned light damage projection;
respawn clearing stale combo state) and 20 Chapter 2 XP-queue assertions. Those
are pre-existing defects on `main`, reproduced on `main`.

## H. Outstanding items

1. **A human should look at the native frames.** CI renders all thirteen every
   push, but this sandbox cannot download the artifact (`gh run download` →
   `EOF` at the blob host), so the art judgement in `REVIEW.md` rests on offline
   composites built from the same atlas, same variant hash and same camera
   framing — labelled supporting, never as screenshots.
2. **A hand-painted pass on the two plainest exteriors.** Crossfire Archive and
   Spiral Reliquary carry the least individual detail; the Beacon, Gate and
   Throne the most. The ten share one generator by design (one place, not ten
   style experiments), but two of them are doing less work than the rest.
3. **Paving wants a second, warmer stone.** The debris pass closed the "empty
   plaza" problem, but fallen masonry uses the same grey family as the flagstone,
   so it sits low in contrast. Moss, seepage and a warmer cut stone would lift it.
4. **No audio work.** The overworld is silent apart from the shared audio layer.
5. **Dungeon interiors untouched** — additive by design.
6. `.png.import` files for the Chapter 1 art set are generated locally and left
   uncommitted; CI imports them itself and the repo's existing import metadata is
   unchanged.

## I. Verdict

**PLAYABLE — VISUAL POLISH REMAINS.**

The loop is real end to end and proven on the production scenes: Home → Marches →
walk → interact → the real `chapter_1_level_1` → real completion → back → the
world remembers, and a save/reload keeps it. The geography is data, gated at bake
time in both shortcut states. Every behavioural claim above was executed, not
inferred. The evidence set is green in CI **and** gated, so a script error inside
the photographer can no longer masquerade as a picture.

What keeps this short of "READY FOR OWNER PLAYTEST" is art and eyes, not
behaviour: two of the ten exteriors are doing less work than the rest, the paving
reads calm rather than weathered, and nobody has walked the world looking at it —
the sandbox cannot open a window, so the frames CI renders are checked for
existence, size and non-blankness rather than judged by a person.
