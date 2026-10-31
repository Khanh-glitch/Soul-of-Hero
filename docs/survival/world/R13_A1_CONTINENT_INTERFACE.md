# R13-A1-SEAM — production-consumable continent contract

**Disposition:** additive A1 source/interface candidate for the existing PR20. It is **not** `PRODUCTION_MOUNTED`, human-playable, visually accepted, D051-visual accepted, A8-interior accepted, or loot/economy accepted. Only A0 can mount and certify the production GameRoot. This document is the interface/handoff contract; the exact-head native report and visual review are separate evidence, not claims made by this file.

## 1. Immutable inputs and owner pins

- R13 A1 baseline: `a030cb89a5033ba5faba39995762b4bea1332cec`.
- A0 reviewed runtime: `ee5f9f5160c8e4385f35a63b355ddda957f93d10`.
- A6 reviewed D051 presenter/scene: `6d1e8bcee0bbb09be0ff04f14de1f7e59f06cfb8`.
- A8 reviewed local scenes: `0f885df862d7d34f18ca456e80b1aaac05b23de0`.
- Godot: `4.7.stable.official.5b4e0cb0f`.
- Canonical world: `world:soh_continent_v1`; geography instance: `continent:soh_continent_v1`.

The three A8 site JSON files at the current A8 pin are byte-identical to A1's frozen references. No Knight/A0/A6 mutable runtime byte hash is pinned. The physical controller is checked semantically; A6's presenter remains replaceable owner presentation.

## 2. Small consumer surface

| Path | Role |
| --- | --- |
| `data/survival/world/a1_continent_interface.v1.json` | Deterministic public manifest: world/transform/chunk/spawn/runtime/site/source contracts. |
| `game/survival/world/a1_continent_interface.gd` | Additive façade over the existing strict reader and bounded live stream. |
| `game/survival/world/a1_continent_consumer_sample.gd` | Executable A0 sample using only the façade and canonical `res://` data. |
| `tools/survival/worldgen/compile_r13_continent_interface.py` | Read-only source compiler and `--check` stale-manifest gate. |
| `tests/survival/world/r13_continent_seam_native_test.gd` | Isolated exact-owner native driver; never a production entry point. |
| `tools/survival/worldgen/validate_r13_continent_seam.py` | Independent native report, source hash and PNG-byte validator. |
| `.github/workflows/a1-r13-continent-seam.yml` | Exact-SHA A0+A1+A6+A8 composition and focused native gate. |

The old reader, streamer, masterplan, chunks, routes, art, spawn index and A8 source files are unchanged. The consumer does **not** read `round12_native_inputs.json`, a journey packet, a test scene, or fixture-generated POI bodies.

### Public calls

- `configure(world_root, player_scene_override, manifest_path)` — verifies the manifest, immutable source hashes, semantic actor/controller contract and all 192 chunks before reporting ready. Trusted source paths only; saves/user payloads must not choose them.
- `cell_to_world(cell, anchor)` / `world_to_cell(world_px)` — fail-closed transforms.
- `chunk_for_cell(cell)` / `chunk_for_world(world_px)` — stable chunk ID, origin, bounds, source path and SHA-256.
- `acquire_for_actor(actor_origin_px, camera_world_rect)` / `release_chunks()` / `active_chunk_ids()` — bounded chunk lifecycle.
- `sample_cell(cell)` / `sample_world(world_px)` — world/region/biome identity, source walkability, collision authority, build values, movement proposal, and water/river/bank/road/bridge environment semantics.
- `physics_sample_cell(cell)` — mounted source/physics state; refuses `CHUNK_NOT_ACQUIRED` rather than pretending a drained chunk has live collision.
- `build_eligibility(cell, a0_delegate, dynamic_child_blocked)` — A1 candidate/legacy permission plus the required A0/dynamic decision. It never places or pays for construction.
- `choose_safe_spawn(run_seed)` / `validate_spawn_cell(cell)` — deterministic broad candidate selection and fail-closed persisted-cell validation.
- `site(site_key_or_poi)` — canonical A8 shell/approach/door/retreat/instance/source descriptor.
- `set_time_of_day()` / `temporal_context()` — presentation/time queries only; A0 retains world-time authority.

## 3. Transform contract (no rounding ambiguity)

- Cells are integer `(x,y)`, +X east/right and +Y south/down.
- Cell size is **16×16 px**; world cell origin is **(0,0)**.
- World is **1024×768 cells = 16384×12288 px**.
- Cell rectangle is half-open: `[cell*16, (cell+1)*16)`. Negative coordinates and the exact right/bottom world edge reject.
- Actor origin/foot is **bottom-center minus one Y**: `(x*16+8, y*16+15)`. This matches the real 12×16 `BodyShape` at `(0,-8)` and A8 approach/return transforms.
- Cell center is `(x*16+8, y*16+8)`; top-left is `(x*16,y*16)`. These are explicit anchor options, not interchangeable actor positions.
- Chunks are **64×64 cells = 1024×1024 px**, in a 16×12 grid (192 total). Identity is `chunk:<floor(x/64)>:<floor(y/64)>`; for example `(64,64)` is `chunk:1:1`.
- All API rects and positions are unscaled **world pixels**. A0 owns camera and zoom. R13 captures use camera zoom `(1,1)` and a 640×360 logical viewport at 1280×720, 2560×1440 and 3840×2160.
- World and region identity come from the source cell, not the mounted scene name. Draining a chunk does not change `world_id`, region identity, or source query results; only `physics_sample_cell` refuses until reacquired.

## 4. A0 integration recipe

InputBootstrap is an autoload and must enter the tree **before** diagnosing missing input or actor behavior. Do not add a second input bootstrap.

```gdscript
const SAMPLE := preload("res://game/survival/world/a1_continent_consumer_sample.gd")

# During A0 GameRoot/world construction:
var opened := SAMPLE.create(self)  # optionally pass A0's semantic player scene override
if not opened.ok:
    fail_world(opened.error)
var continent: A1ContinentInterface = opened.continent

# New run: A0 owns run_seed and persists the chosen cell, not just a screen position.
var spawn := SAMPLE.select_run_spawn(continent, run_seed)
if not spawn.ok:
    fail_world(spawn.error)
# A0 checks dynamic occupancy, then performs the one initial placement.
player.global_position = spawn.actor_origin_px

# Existing run/load: validate the saved source cell again, then check dynamic occupancy.
var restored := continent.validate_spawn_cell(saved_spawn_cell)
if not restored.ok:
    refuse_or_recover_run(restored)

# Each physics/camera update; this rect is world pixels and contains the actor origin.
var world_view := Rect2(player.global_position - Vector2(320, 180), Vector2(640, 360))
var streamed := SAMPLE.sync_actor(continent, player, world_view)
if not streamed.ok:
    fail_world(streamed.error)
```

A0 must not use initial spawn placement as travel. Ordinary movement remains the real controller's input/`move_and_slide()` path. A0 also owns dynamic player/prop collision, save/run identity, final spawn acceptance, camera limits, movement-speed adoption and production mounting.

### Build and movement queries

Use `sample_cell` for source facts and `build_eligibility` for a decision. `build_permission=0` denies in A1; `1` is only a candidate until A0 validates; `2` requires the legacy A0 delegate. Dynamic child occupancy can independently deny. `speed_multiplier_proposal`, climate and hazard channels remain A1 source proposals until A7 measurement/A0 adoption; the façade does not mutate health, inventory or player speed.

### A8 shell mount and transition

For each desired site, A0 obtains `continent.site(key)`, instantiates `shell.scene` **once**, sets its origin to `shell.origin_world_px`, and retains A8 ownership of the scene and bodies. `collision.exclusions` is clearance evidence only—**never instantiate a second set of bodies from it**. A0 supplies the real run-phase projection before calling `NativePoiShell.try_enter(actor)` at the physical door with inward facing. R13 does not implement or accept that production transition.

## 5. Canonical southern A8 descriptors

All positions below are world pixels; approach/retreat cells use the actor-foot formula above.

| Site / stable instance | Canonical | Shell origin | Physical approach | Door target | Retreat target | Outer / inner capability |
| --- | --- | --- | --- | --- | --- | --- |
| South Quarry — `world:soh_continent_v1/site:crown_south_quarry` | `(30,280)` | `(424,4424)` | cell `(30,283)`, foot `(488,4543)` | `(488,4532)` | cell `(30,289)`, foot `(488,4639)` | none / none |
| South Orchard Ruin — `world:soh_continent_v1/site:crown_south_orchard` | `(140,360)` | `(2184,5704)` | cell `(140,363)`, foot `(2248,5823)` | `(2248,5812)` | cell `(140,369)`, foot `(2248,5919)` | none / none |
| South Crown Mill — `world:soh_continent_v1/site:crown_south_mill` | `(120,300)` | `(1864,4744)` | cell `(120,303)`, foot `(1928,4863)` | `(1928,4852)` | cell `(120,309)`, foot `(1928,4959)` | `cap_salvage` / `cap_salvage` |

Required semantic inputs are `move_left`, `move_right`, `move_up`, `move_down`, plus `interact` for A0's accepted interaction route. A1 does not bind desktop keys. A0 must resolve its accepted desktop/pointer/joypad intent without leaking UI clicks into combat.

Each descriptor also contains the 128×128 unrotated/unscaled shell, doorway clear rect, exact scene path, transition contract ID/version, source path/SHA/commit, and all five A8 boundary rectangles plus authored obstacles. Source A* reachability with the real body/exclusions reports 96 cells Refuge→Quarry, 242 Refuge→Orchard, 154 Refuge→Mill, and seven cells for each approach→retreat path. These are **source reachability summaries**, not native/production proof; full journey cells are deliberately not published as a consumer dependency.

## 6. Broad spawn contract

The verified index remains **27,445 candidates** across at least 18 chunks and three regions, not three spawn rectangles or `seed % 3`. Selection is SHA-256 over `world_id|run_seed|round12-spawn-v1`, then deterministic chunk/cell selection. `validate_spawn_cell` requires membership in that verified index and returns actor origin, region entry requirements and nearby material-family evidence. A0 must still validate dynamic occupancy when placing/loading the actor. Unsafe, POI-footprint, hazard, stranded or out-of-frame cells fail closed.

## 7. Required native negative behavior

The focused exact-owner driver executes, not merely lists:

1. Negative world/cell coordinates → `WORLD_BOUNDS` / `CELL_BOUNDS`.
2. Drained chunk physics query → `CHUNK_NOT_ACQUIRED`; source query remains valid.
3. Forbidden Quarry-anchor construction → `a1_no_build_candidate`, even with an allowing test delegate.
4. POI/unsafe spawn cell → `SPAWN_CELL_UNSAFE`.
5. Actual player scene mutated to a 20×16 body → semantic `PLAYER_BODY_SHAPE_SIZE` refusal.
6. One altered world-plan source hash → `interface_source_hash:world_plan` before stream readiness.
7. Real river terrain with real collision → the physics controller makes contact and cannot enter the blocked target.

The primary source tree is never modified by these probes; altered manifests/scenes live under `user://`.

## 8. Native and visual evidence boundary

The workflow composes the exact SHAs above, stages the two SHA-locked D051 base packs privately on the runner, initializes InputBootstrap, uses the real A0/A6 scene and real A8 shells, and drives every approach/door/retreat through movement actions. Only labelled independent test resets write coordinates. The isolated profile may select the canonical male identity through A0's real projection API; this is not production save acceptance and no world/run/economy save mutation is claimed.

If the licensed archive transport is unavailable, the workflow may still publish **diagnostic no-art** controller/world evidence with `d051_art_staged:false` and `D051_LICENSED_ART_STAGED:BLOCKED_SOURCE_TRANSPORT`. A mandatory final step keeps the overall R13 job failed in that case. Those diagnostic frames are not D051 evidence, visual acceptance, or a substitute sprite authorization.

Expected artifact: `a1-r13-continent-seam-native-evidence`, containing the report, independent validation, source provenance, exact composed-tree identity and 15 native PNGs:

- Quarry day and night at 720p/1440p/2160p;
- Orchard day and night at 720p/1440p/2160p;
- a physically driven Crown→Amberwood region/chunk transition at 720p/1440p/2160p.

All captures are native 1×; day/night source-lighting state and pixels are checked independently. Frames still require eye inspection for source readability, silhouettes, bank/route readability, night salience, blur/nearest-neighbor scaling and region continuity. Prior traversal success and these captures do not reverse the existing visual HOLD. Do not substitute blurred vector art or rewrite the masterplan to hide a defect.

## 9. Downstream actions

- **A0:** review/consume the façade; own GameRoot mounting, dynamic occupancy, camera, run/save identity, actual production movement and the only production acceptance claim. Keep the current production stream setting unchanged until that native gate passes.
- **A8:** verify the three public descriptors against the real shells; retain local scene/collision/transition ownership. No interior or loot acceptance is inferred.
- **A6:** D051 presenter compatibility is exercised; art/visual acceptance and armor-stage gaps remain separate.
- **A7:** independently measure/advise environmental movement before A0 adopts multipliers.
- **A3:** no item, cost, yield or loot authority is changed or requested by this seam.
- **CT/E2:** review exact-head CI and native frames; keep production, human play and visual acceptance separate until their own gates pass.
