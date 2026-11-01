# THE HOLLOW MARCHES — BIÊN VỰC TÀN VONG — hand-off

Branch `arena/54306b59-soul-of-hero`. Everything below was executed on this
branch; numbers are from the runs named next to them. Nothing here is inferred
from a green exit code.

---

## A. Branch and exact SHA

| Item | Value |
| --- | --- |
| Branch | `arena/54306b59-soul-of-hero` (only branch written to; `main` untouched) |
| HEAD | tip of `arena/54306b59-soul-of-hero`; the last content state with the static-contract job green is `3d3f0c18` |
| Verified | static contracts green on `3d3f0c18`; VISUAL EVIDENCE green on `0712fb4d`; NATIVE RUNTIME has been red since `8be364c` on `main` too — see section H, it is an upstream defect, not a regression here |
| Playable | <https://khanh-glitch.github.io/Soul-of-Hero/> (Web export, Chromium smoke-tested before publish) |
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

* 16 px tiles, 640×360 internal, 1280×720 presentation, `default_texture_filter=0`
  (nearest) confirmed in `project.godot`, camera zoom 2 in play.
* `overworld_tiles.png` 212 frames (512×112), `overworld_props.png` 47 frames
  (512×370), both generated by `art.py` / `art_props.py` and indexed by JSON.
* Ground families carry several variants per code. The variant is chosen per
  **3×3-tile cluster** with one tile in six borrowing a neighbour's tone, so a
  weathered area has a ragged outline; the choice is shared bit-for-bit by
  `OverworldTiles.variant_index` and `preview.py`. Per-tile selection turned four
  tones of one stone into a checkerboard at 2× zoom, which is exactly the failure
  the paving pass exists to avoid.
* `ground_flagstone` weathers in blocks: a moss patch worn through the joints, a
  slab dropped out of its course with a lit lip, or a paler stone set in to
  repair a hole. `ground_rock` gained a seam that runs out of the tile.
* Ten exterior identities share one material culture with distinct silhouettes
  and furniture — gatehouse with braziers, keep with twin towers and banners,
  ritual basin, beacon ring, colonnaded archive with shelves, low reliquary
  terrace with a soul-light, and so on. Camps read as inhabited (tent, crates,
  bedroll, banner, standing fire), not as decorative flames.
* Two scatter passes: colliders keep a two-tile corridor off every lane;
  non-colliders use a one-tile corridor with clustered density, so the plazas are
  not empty fields (4 451 → 6 184 props, ground/detail/solid byte-identical).
* **Measured natively, per station**: 123–239 distinct colours, 17–27 % edge
  density, 11–29 % dominant tone, luminance σ 0.063–0.092. The whole-world
  overview is the outlier by design — 56 % of that frame is the void around the
  384×256 envelope at `zoom = 1/TILE`.

## F. Persistence## F. Persistence

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
| [`40692926869`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40692926869) | `a00e837f` | **all three green** — 15/15 PNGs, `OVERWORLD CAPTURE PASSED - 15 images`, twelve annotations carrying the frame report |
| [`40691921302`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40691921302) | `e205d3aa` | **all three green** — 15/15 PNGs including the two new landmark stations, with a structure report per station |
| [`40691921184`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40691921184) | `e205d3aa` | Play in Browser: export + Chromium smoke + Pages deploy, both jobs green |
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

## H0. Mission 2 (world art & readability) — what changed since G

Three shipped pieces, all gated; the full account is
[`MISSION_REPORT.md`](MISSION_REPORT.md).

1. **Smart occlusion** (`overworld_occlusion.gd`) — props in front of the player
   fade by role (vegetation 0.30, architecture 0.50, landmark 0.62), bucketed at
   128 px, 2/5 px hysteresis, purely visual. The demonstration is the
   `occlusion_off` / `occlusion_on` station pair: same camera, same tile, one flag;
   the native run reports **2 sprites faded, gate alpha 0.62, 4.0 % of sampled
   pixels different**.
2. **Traversability** (`overworld_traversability.gd`) — a 0/1/2 grid read from the
   live prop bodies plus a distance BFS. It found two real defects: two rewards
   (`d_crucible_cove`, `d_relay_shard`) buried under tree colliders, because the
   bake checked props by anchor tile rather than by the body they build; and a
   fresh character spawning inside the refuge tent, because the bake validated a
   cell that had drifted from the document's. All three are fixed and asserted.
3. **Hybrid override pipeline** (`overrides.py`, `art_manifest.json`,
   `source_audit.py --check`) — hand-painted frames win at bake time, deleting the
   PNG restores the generated frame, and every pixel carries provenance.

Art: L03 and L04 were repainted **after** looking at the first attempt at 5x and
in the scene; both were worse than the generated frames. The second pass gives the
archive coursed masonry, a recessed portal, a banner and a paved apron, and the
reliquary four tiers with pilasters, lit ledges, a continuous stair and a burning
monolith seam. Both were then lifted into the front-prop value band: measured
against the plaza, delta went from -0.03 / +0.01 to **+0.068 / +0.075**.
Before/after galleries are in `docs/overworld/evidence/overworld_gallery_*.png`.

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

The loop is real end to end and proven on the production scenes: Home →
Marches → walk → interact → the real `chapter_1_level_1` → real completion →
back → the world remembers, and a save/reload keeps it. The geography is data,
gated at bake time in both shortcut states. Every behavioural claim above was
executed, not inferred, and the evidence set is both green and gated: a script
error inside the photographer now fails the run, and every station publishes a
structure report of the pixels it actually rendered.

Art is where the gates stop. Nothing measures whether the Hollow Marches look
*good*; what can be measured is measured — no blur, no flat fill, ten distinct
silhouettes, all fifteen frames photographed and described — and the remaining
judgement is the owner's, which is what "ready for playtest" means. The two
exteriors a painter would start with are Crossfire Archive and Spiral Reliquary;
audio is untouched; dungeon interiors are untouched by design.

**COMPLETE — READY FOR OWNER PLAYTEST.**
---

## J. Mission re-scope — completed vs outstanding (supersedes section I)

The verdict in section I was written against a narrower mission and the owner
rejected it. This is the ledger against the **original** mission, from HEAD
`07b08bfd` on `arena/54306b59-soul-of-hero`.

### Completed

| Objective | What was actually done | Evidence |
| --- | --- | --- |
| 3. Pipeline beyond atlas frames | `data/overworld/world_patches.json` applied by `author.main()` between painters and gates. Ops: prop `add` / `remove` / `move` / `replace` (exact cell or `within` zone) and terrain writes on `ground` / `detail` / `solid`. Rebuild is deterministic, idempotent and non-destructive; 14 entries land today | `patches.py --check` → `patch check passed: deterministic, idempotent, non-destructive`; CI step "World patches" |
| 4. Selective occlusion | Banded shader with per-role `base_keep` (landmark 0.24, architecture 0.30, vegetation 0.0, default 0.22). Physical bases and contact shadows stay opaque; collision untouched; overlapping occluders handled; `add_focus` / `clear_focus` for allies; teleport and reload restore every material. Reusable on a real Chapter 1 dungeon, not a mock | 22 + 25 + 17 checks; CI steps 17–19 **succeeded natively** on run `40721420072` |
| 2. Asset evaluation | 0x72 accepted for dungeon interiors (already in use) and rejected for overworld terrain (seam 14.6–24.9 vs 0.66–2.35) and props (16 px grid vs 18–46 px frames). Dark World and Classical Ruin recorded as **not evaluable**, with the catalog search that establishes it | `docs/overworld/ASSET_EVALUATION.md` |
| 1. Camps | Four distinct compositions instead of one repeated eight times: shelter / crossing / depot / lookout, plus repainted tent, fire, bedroll and banner | gallery, camps 0.0–89.3 % diff |
| 1. Some landmarks | Six exteriors hand-painted over generated frames: Crypt, Archive, Reliquary, Crucible, Relay, Divided | gallery diffs 5.5 / 8.2 / 5.9 / 9.7 %; both new stations |
| 5. Coverage | One station list drives the renderer, the gallery and the native capture. Before/after sheets render the "before" side from a temporary worktree of the old revision, so both sides cannot come from the same code | `overworld_gallery_stations.png`, `overworld_gallery_landmarks.png` |
| 5. Performance | Budgeted probe that fails the gate: 6.48 ms frame script time, 0.381 ms per occlusion step, 0.0005 ms per traversability query, flat node count | `tests/overworld_performance_probe.gd` |
| 5. Regression | 16 local gates headless; three new CI steps (selective occlusion, Chapter 1 reuse, performance) and a log-surfacing diagnostic step | `local_suite.sh`, workflow |

### Outstanding — not claimed as done

1. **Landmark exteriors — closed.** All ten are hand-painted overrides as of this
   pass: Crypt, Ossuary, Archive, Reliquary, Crucible, Relay, Beacon, Divided,
   Crimson Gate, Castellan Throne. Gallery diffs against the last main-branch
   render: 17.6 % to 30.5 % of the station frame changed, and the two stations
   that did not exist before (Relay, Divided) are rendered for the first time.
   What remains judgement rather than work: a human has to look at the CI
   artifact, because this sandbox cannot read job logs.
2. **Travel regions — one measured defect fixed, the rest still open.** The
   surfaces a player spends the most time on were measured, not eyeballed: the
   road, path and plain-dirt tiles scored 12.0-13.6 % "static" (adjacent-pixel
   luma jumps) against 0.7-2.6 % for the ground beneath them, because the verge
   was drawn with a seeded dither and the path was a 42 % per-pixel coin flip.
   Both were rewritten as solid bands with a one-pixel wobbled silhouette and a
   worn rut: the road tiles now measure 4.3-8.1 % and the world-wide frame
   average fell to 3.9-5.5 %. The 3-tile lattice caused by picking the ground
   variant per 3x3 block was addressed with per-tile mirroring
   (`OverworldTiles.flip_id`), which decorrelates the detail without turning the
   four stone tones back into a checkerboard. Still open: the water margins and
   the plateau blockers have not had a dedicated region pass.
3. **Dark World and Classical Ruin tilesets cannot be evaluated**: neither is in
   the repository or the 87-package catalog. No quality judgement is made. The
   acceptance test they would face is written down in `ASSET_EVALUATION.md`.
4. **Native coverage of the new stations is queued, not yet green.** The capture
   scene now photographs Relay, Divided and all four camps, and the CI verifier
   requires those PNGs, but the run that proves it is the one after this commit.
5. **Native frames have not been reviewed by eye in this sandbox.** The log blob
   host is blocked (`gh api .../logs` → `EOF`), so the art judgement above rests
   on the offline composites, which use the shipped atlas at the camera's real
   2x framing. A human still has to look at the CI artifact before the art is
   called finished.
6. **Combat, Hero systems, Gold VFX, HUD, RPG progression, narrative, rewards and
   saves were not modified** — they remain frozen as required, and no overworld
   change required touching them.

### What would be next, in order

The travel-region pass (water margins, plateau blockers); then the evaluation of
the two missing tilesets, which needs the packs themselves; then a human look at
the CI artifact.

## Third pass (this turn)

The cliff mass — the world's dominant repeated graphic — was rebuilt, and the
measurements that found each defect became a gate (`tools/overworld/art_quality.py`,
wired into both the local suite and CI).

Closed this pass:

- **Cliff face.** The interior variant (13 545 cells, bands to 380 wide) carried a
  corduroy dash grid at the camera's own 2x zoom. It now carries no feature at
  all; structure comes from `cliff_ledge_*`, `cliff_buttress_*` and
  `cliff_crack_*` decals in world space, which cannot form a lattice because they
  are not tiled.
- **Cliff value.** The impassable mass was the same luminance as walkable ground
  (79 vs 84–101). It is now 76 against 91–101.
- **Full-width tile lines.** `ground_rock` and `ground_cliff_top` both ruled one,
  measured at 100 % line coverage. Both rewritten.
- **Landmark value.** All ten painted exteriors sat below the ground's median
  luminance (0.315 vs 0.356). All are now mixed to 0.46; separation +0.085.
- **Crypt.** A smooth turf dome became a built barrow: wandering crest, dense
  turf, drystone revetment, crown stone.
- **Boulders.** `rock_a`/`rock_b` read as concrete crates; they now have an
  irregular silhouette, a lit crown and a flat footprint.
- **Ground blends.** Per-tile material choice printed a 16 px quilt; quantised to
  a 2×2 clump.

Still open, and named rather than hidden:

- The buttress decal is placed but reads as a slab on the wall; it needs another
  pass or removal.
- L10's approach plaza is still wide and empty in the native frame.
- Camps, water margins and the L01–L05 approaches are unchanged this pass.

## Fourth pass — cliff mass, camps, and a CI lesson

### Art

- **Cliff mass.** The buttress decal that "read as a slab" was five attempts and one
  diagnosis: every attempt drew an elevation with a silhouette on a surface seen from
  above. A ledge with a shadow underneath, a lit flank, a ragged rim, a flat
  rectangle, a soft blob — each failed for a version of the same reason. The working
  form is a full-tile patch whose alpha falls to nothing at its edge, placed at ~30 %
  density with a half-tile jitter so neighbours overlap. Some patches are darker than
  the rock and some lighter; when every patch was lighter, an isolated one composited
  as a lit dome.
- **Camps** got their first art pass: procedural hearths instead of four gravel
  rectangles, a reserved scatter zone so a camp owns its footprint, road paving that
  degrades to footpath inside a clearing, an approach path to the nearest road, and a
  real windbreak at Watch Ridge.
- **Material boundaries** world-wide are dithered over one to two tiles instead of
  meeting on a tile edge. This is the change that most improved how camps sit in the
  terrain, and it applies to every clearing, bank and forest edge in the world.

### What actually went wrong in CI, and what now prevents it

Six red runs, three distinct causes, all in the same family: **GDScript is stricter
than any published grammar check**.

1. `var names` twice in one function — locals are function-scoped.
2. `var x := abs(...)` — `abs` is the Variant overload, so `:=` cannot infer.
3. `var layers_file` twice in one function, in scopes that overlap.

Each read as "step 8 failed" because the log lives behind a host this tooling cannot
read, and a script that will not compile exits in under a second without reaching a
single assertion. Three things changed:

- The parse gate now loads **test scripts too**, one at a time, and annotates the
  failing file and the offending line. Tests were the gap: nothing compiled them
  until the step that ran them.
- The static-contract step re-emits `SCRIPT ERROR` / `Parse Error` /
  `OW_STATIC_FAIL` lines as annotations, and `_expect` emits its own.
- `tools/overworld/gd_scope_check.py` runs locally in the suite and catches the
  overlapping-scope class in a second, calibrated against this repository's green
  code (disjoint sibling blocks are legal and common; nested ones are not).

### Still open

- Cliff-scale landform: the mass is mottled but regionally uniform. Level design, not
  tiles.
- Camps are sparse in the middle; new furniture art needed.
- L10 approach plaza, far south-west field, marsh overlay variety.

## Fifth pass — the original mission, item by item

State at `7dccf4d4`: all three CI jobs green (STATIC CONTRACTS, VISUAL EVIDENCE,
NATIVE RUNTIME) — the first fully green run since `0712fb4d`, and the first time
NATIVE RUNTIME has passed in this session.

### 1. Ten landmark exteriors, four camps, problematic travel regions

| Item | State |
| --- | --- |
| Ten landmark exteriors | **Done.** All ten hand-painted and value-lifted over earlier passes; this pass gave every one a forecourt, because all ten had the same compositional fault — building, approach and plaza all north of the player and nothing in front, so each read as a wall seen from a distance. The Crimson Gate additionally got a gatehouse (two towers flanking the arch) it had never had. |
| Four camps | **Done.** Procedural hearths replacing four gravel rectangles; a reserved scatter zone so a camp owns its footprint; road paving that degrades to footpath inside a clearing; an approach path to the nearest road; Watch Ridge rebuilt around its actual windbreak. |
| Travel regions | **Done.** Forest floor was a per-tile coin flip (checkerboard of single-tree colliders); canopy was per-pixel white noise; rock field was a variant quilt; paving and walls tiled on their own period; boulders came in two sprites for two hundred placements; material boundaries stair-cased on every tile edge. All fixed and measured. |

### 2. Asset evaluation

Complete (`ASSET_EVALUATION.md`): 0x72 accepted for dungeon interiors, rejected for
overworld terrain and props with measured seams. Dark World and Classical Ruin are
**not evaluable** — neither is in the repository or the reachable catalog. That is a
blocker, not an omission.

### 3. Hybrid pipeline

`data/overworld/world_patches.json` plus the procedural painters; deterministic,
idempotent, non-destructive, gated by `patches.py --check`. This pass added four new
procedural passes to the same pipeline (`feather_boundaries`, `soften_camp_roads`,
`paint_pools`, `paint_stone_mottle`), each placed by a coherent field rather than by
tile choice.

### 4. Selective occlusion

Done earlier and still green natively. Note: its precondition was being satisfied by
accident (scattered boulders overlapping the gate) until this pass gave the gate a
real gatehouse.

### 5. Coverage, passes, performance, regression

- Native station frames: **15**, regenerated this pass.
- Before/after galleries regenerate from a worktree of the old revision.
- Performance probe, topology validation, art-quality gate, patch check, scope check
  and `gdparse` all pass locally; CI runs the same gates natively.

### Honest gaps

1. **No human has looked at the CI artifact.** The sandbox cannot read job logs or
   artifacts (the blob host returns `EOF`). Every art judgement here rests on
   offline renders built from the shipped atlas at the camera's real 2x framing —
   which is faithful, but it is not the same as a person looking at the game.
2. **The plateau overlay is nearly invisible.** `w` (stone mottle) is placed on
   7 000 cells and is subtle to the point of not reading at native zoom. More
   contrast would make it patchwork; the real answer is large-scale landform, which
   is level design.
3. **Camps are sparse in the middle.** Props cluster at the edges; the centre of a
   large clearing is bare. Needs new furniture art.
4. **The citadel wall behind L10 is one flat masonry field** with no buttress or
   gatehouse reading.

## Sixth pass — the four gaps, and what is genuinely left

The fifth pass listed four honest gaps. Three of them were art gaps with one cause
between them, and they are closed. The fourth is a limitation of the sandbox and
cannot be closed from here.

### 1. No human has looked at the CI artifact — still true

Unchanged and unfixable from inside the sandbox: job logs and artifacts are served
from a host that returns `EOF`. Every art judgement below rests on offline renders of
the shipped atlas at the camera's real 2x framing, which share the atlas and the
per-cell variant hash with the runtime, plus the two CI jobs that do run the real
engine. It is not the same as a person looking at the game, and nothing in this
document should be read as claiming otherwise.

### 2. The plateau overlay — answered at the wrong scale, then at the right one

`w` (stone mottle) is still subtle, and it is still the wrong instrument: the defect
was that a 22 000-cell mass sat at one tone, and no per-tile overlay fixes that.

What fixed it was structure at the scale of the mass:

- a **six-step depth ramp** on the cliff, placed by a BFS distance field from open
  ground, with roughened band boundaries;
- **courses and piers** at the foot of every south-facing face — a projecting lip on
  1251 faces, a 28x54 pier every eight cells along runs of six or more;
- **worn paving** on laid stone, pale toward the middle of a field and absent at its
  rim, which is the same idea with the sign reversed.

The lesson worth keeping: the first attempt at the ramp used two levels, which put a
24 % alpha step on a 16 px edge and printed as a square block standing in the rock.
Six steps of about 7 % read as a gradient.

### 3. Camps sparse in the middle — closed with new art

Five frames at the size their role implies, not three-tile objects in a ring:

| frame | size | role |
| --- | --- | --- |
| `camp_pavilion` | 74x62 | the camp's command structure |
| `camp_cookfire` | 52x40 | a cauldron in a stone hearth |
| `camp_wagon` | 66x46 | a two-wheeled supply wagon |
| `camp_table` | 56x30 | a trestle table with a map and benches |
| `camp_rack` | 44x44 | a weapon rack with a hung shield |

All four clearings are furnished by what the camp *is* — the crossing gets the hearth
and the wagon and one bedroll, the depot gets the wagon and rack beside its stores,
the watch post gets the rack and the watch bill — and all five frames are **solid**,
so a pavilion is not something the Knight walks through.

### 4. The citadel wall behind L10 — closed, and it was two different walls

The recorded gap conflated two things:

* the **cliff mass** behind the keep, which the depth ramp and the courses answer;
* the **court** in front of it — 900-odd cells of one flagstone — which is not a wall
  at all. It is now laid as a court: a darker dressed border course along the flanks,
  a lighter processional walk running south from the keep with a landing at the steps,
  and the only colonnade in the world on either side of it. Measured mean luminance:
  field 88.5, border 73.3, walk 104.2.

The station also frames the court now. The keep is ten tiles tall; the old offset,
derived from sprite height so the whole building fitted under the top edge, put the
entire court below the bottom edge. The station photographed a wall and none of the
thing under review.

### What the passes cost, and what they broke

Worth recording, because it is the pattern:

- Relaxing the cliff-decal enclosure test to reach **narrow** walls put 44 px patches
  over walkable ground south of them. A player standing at a wall's foot was inside a
  patch's rect, and the occlusion system faded masonry from 26 tiles away. Fixed by
  putting the surface decals in `FLAT_PROPS`: a wall is not a thing standing in front
  of you, and neither is the pattern on it.
- The same relaxation smeared patches across the lattice of one-cell walls north of
  the crossroads. Walls under seven enclosed neighbours now take fractures, not
  patches.
- The court flood was unbounded and laid dressed court stone ninety tiles away around
  the beacon. Found by dumping ground codes and asking why a court course was there.
- The worn-paving wash accepted gravel and dirt, where a flat pale wash reads as a
  smear rather than as wear. Flagstone only now.

Every one of those was found by rendering a station and looking at it. None was found
by a validator, and two of them were *introduced* by a change that passed every
validator.

### Original mission, item by item — current state

| # | Requirement | State |
| --- | --- | --- |
| 1 | Audit/materially improve all ten landmark exteriors, four camps, problematic travel regions | 10/10 exterior passes and forecourts; 10/10 have a distinct silhouette, plaza and approach furniture; the gate now has a gatehouse, L10 a court; all four camps furnished with purpose-made art; travel regions treated (roads, canopy, rock quilt, cliff, plateau, paving) |
| 2 | Evaluate Dark World / Classical Ruin / 0x72 atlas, record accepts and rejects with licence | Complete (`ASSET_EVALUATION.md`); DW and CR remain **not evaluable** — not in the repo, not reachable |
| 3 | Hybrid pipeline beyond atlas replacement | Complete — deterministic, idempotent, non-destructive, gated |
| 4 | Selective occlusion, prove Chapter 1 reuse | Complete and green natively |
| 5 | World-wide before/after native coverage, repeated correction passes, perf, regression | 15 native stations, galleries regenerate from the old revision, three correction passes this session, perf probe and regression guard green |

### Still outstanding

1. **No human has seen the CI artifact** (item 1 above). This is the largest remaining
   uncertainty in the whole mission.
2. **Large paved fields have tone but no layout.** The L10 court has hierarchy because
   it was designed; every other plaza is a field with weathering on it. Doing the same
   for each landmark is level design, not decoration, and was not attempted here.
3. **`w` stone mottle is still nearly invisible.** It is now sitting under the depth
   ramp, which supplies the cue it was missing, but the mottle itself has not been
   re-judged against a native capture.
4. **`MIN_OCCLUDER_HEIGHT` is 26 px**, so anything shorter than a bedroll is invisible
   to the occlusion system by construction. It has not caused a problem yet.
