# A1 → A0 canonical geography connector handoff

Status: `SOURCE_GATE_PASS_PENDING_A0_PRODUCTION_NATIVE`  
Owner: A1 World Architect  
Branch / PR: `arena/e385312a-soul-of-hero` / #20 (open, unmerged)  
Companion A0 PR: #21 @ `06e00e59905ac9dfd41e37a7ca0c0ea84e2445b7`  
Production native playable: **false**

This is the single canonical-geography blocker wake. It does not expand the continent, migrate production POIs, rewrite rewards, edit `chapter1_overworld.gd`, edit SaveService, or touch A0/A3/A4/A6 owned code. A1 authors an independent, reviewable connector contract + exact legacy delta + bounded one-chunk pilot inputs. A0 owns production application and acceptance.

## 1. Blocker reproduced from A0 native evidence

A0 run **40931599594** @ `ef423ad` (`survival_canonical_seam_probe_test.gd`) is a **negative prerequisite PASS = blocker confirmed**, not a seam solution:

- Fresh production Hero starts at resolved Refuge `(56,218)`.
- Live 12×16 Knight shape BFS reaches legacy `(368,200)`; ordinary held movement reaches it.
- 120 frames right move x `5892.823 → 5897.996`, then stop before `x369`.
- Legacy `(383,200)` has live collider; canonical `(384,200)` is outside legacy bounds.
- A1 chunk `6:3` origin `(384,192)` is unchanged and already road/walk at the border, but A1 walk bits do not erase legacy baked cliff collision.

Therefore “mount the chunk and call it solved” is rejected.

## 2. Options compared

| Option | Geometry / source proof | Collision / nav | Camera / streaming | Save / build | Decision |
|---|---|---|---|---|---|
| **A. Minimal A0-owned legacy adjacency edit + static one-chunk annex** | Exact 46-solid-cell cut in a 16×3 mouth `x368..383,y199..201` (48 dressed cells; two were already clear); 14 flat cliff decals suppressed. A1 chunk `6:3` projected unchanged at canonical origin into a composed `448×256` grid. | Reuse `OverworldWorld` + `OverworldTraversability`; live Knight shape query required. Three clear rows match 12×16 body offset `(0,-8)` and foot anchor `y*16+15`. | Existing camera derives `limit_right = world.width*16 = 7168`; no streaming lifecycle. Unsupported new columns fail closed solid. | Global pixel coordinates unchanged; existing `OverworldState.last_position` path works. Connector road detail `=` triggers A0 `on_route` build rejection. Annex build disabled until composite validator exists. | **SELECTED for pilot.** Narrow, reversible, preserves canonical POI identity and rewards. |
| **B. Explicit physical region/streaming transition in canonical coordinates** | Correct long-term seam for multi-chunk continent; keeps global coordinates. | Requires composite nav across active chunks and atomic invalidation when bodies load/unload. | Requires chunk lifecycle, camera limit updates, edge prefetch, and no visible pop/teleport. | Save resume must identify active region/chunk set; build validator must span loaded chunks. | **DEFER.** Technically valid but unnecessary risk for one 64×64 chunk; no source proof that pilot needs streaming. |
| C. Teleport / local inset / duplicate POI | Would avoid legacy cliff by changing identity or transport. | Not a physical canonical journey. | Scene swap / local offset. | Coordinate migration and duplicate state risk. | **REJECTED** by user lock. |
| D. Import all 192 chunks | Solves adjacency by replacing scope. | Massive nav/collision/POI spawn surface. | Full continent streaming/build/save integration. | Would mount 106 contract-only POIs prematurely. | **REJECTED**; only `6:3` is needed. |

Selected approach is **A′: bounded static annex**. It is a temporary A0 composition input, not a replacement legacy source of truth.

## 3. Exact source delta

Machine-readable: `data/survival/world/connector/legacy_cell_delta.v1.json`  
Contract: `data/survival/world/connector/canonical_connector.v1.json`

- Collision carve rect: `[368,199,16,3]` = **48 cells**, of which **46** were legacy solid `#7/#f/#d/#6 → .`; `(368,199)` and `(368,200)` were already clear.
- Road dressing set: **48 cells** = the full three-row mouth. Native return trace proved the leftover `(368,201)` cliff corner catches the 12×16 body, so it is cleared too.
- After-state for dressed cells: ground `d`, detail `=<mask>` (masked `road_dirt`), solid `.` except mouth cells keep their already-clear solid.
- Prop suppression: **14** non-blocking flat cliff decals inside the carve, exact indices `9523,9524,9532..9537,9547..9551,13155` of pinned `hollow_marches_props.json`.
- A1 chunk edits: **0**. Chunk `5:3` and `6:3` hashes unchanged.
- Protected legacy content touched: **0** landmarks/thresholds, camps, discoveries, shortcut cells/carves.
- Composed bounds: `448×256`; legacy `384×256` inset preserved except exact mouth; annex `64×64` at `(384,192)`; other new columns solid fail-closed.

### Tradeoff reported to Control Tower

This removes 46 solid cells in a 16×3 eastern-ridge mouth inside the already-authored A1 road allowance and dresses all 48 mouth cells. It is a local layout-affecting change to legacy cliff collision/visuals. It does **not** move Waystation/Relay, relocate any of the ten dungeons, change rewards, spawn the 106 unmounted POIs, or replace the legacy map. If CT rejects even this local ridge cut, the physical canonical walking blocker remains unresolved under the current locks; A1 will not silently substitute teleport/inset/duplicate POIs.

## 4. Source pins

| Source | SHA-256 |
|---|---|
| `data/overworld/hollow_marches.json` | `1d30ad27ba4408a4ec72d77dbc57c76bbddb214c89fd6d1309e97af742d51a19` |
| `data/overworld/hollow_marches_layers.json` | `2e7e3d9c07b4af54915d016bb826425e202346969bf8b928c0242b74f916a37d` |
| `data/overworld/hollow_marches_props.json` | `ceafca1d4af01cf9b4dfff3e89de455935dc6ad0b3d1dd35d42c7230b7ffb180` |
| `data/survival/world/chunks/05_03.json` | `66badecf8838507cadae0a819da4902d464111f28334d6cc6c1bdb31c46d4032` |
| `data/survival/world/chunks/06_03.json` | `8bb0d95f7588124c9781fd942521e23b80271ef666c8cec5ce8a951002400c07` |
| `game/characters/knight/knight.tscn` | `2b29011bf361ac7e5cdde97c1fc454c69684dcb6c08e1c23186c05910a52e195` |

A0 PR21 compatibility pins are recorded in the contract. PR21 diff does not touch `data/overworld`, `overworld_world.gd`, `overworld_traversability.gd`, `overworld_state.gd`, or Knight, so the legacy geometry/collision pins remain valid.

## 5. A0 implementation contract (A1 does not edit these files)

1. **World-source seam:** PR21 `chapter1_overworld.gd` hardcodes `WORLD_DATA_PATH/LAYERS_PATH/PROPS_PATH`. A0 must add a narrow injection seam before the deferred build so a test/pilot can supply derived `annex_world.v1.json`, `annex_layers.v1.json`, `annex_props.v1.json` without editing production constants in A1.
2. **Apply delta or compose:** Either apply the exact delta in A0-owned legacy bake, or use the derived composed pilot inputs. Do not hand-paint a wider road. Do not mutate A1 chunks.
3. **Mount slice obstacles:** Add the two slice contracts’ `static_obstacles` as layer-1 bodies before nav/build acceptance. No dynamic spawns, no reward changes.
4. **Annex build guard:** Until a composite build validator exists, reject placement `x>=384` with `annex_build_not_enabled`. Walking is allowed. Legacy connector road detail `=` must continue to reject via A0 `on_route`; `build_permission=2` remains delegate-to-A0, not forbidden.
5. **Camera:** Keep existing `world.width*16` / `world.height*16` derivation. Composed right limit is `7168`, bottom `4096`. No camera teleport.
6. **Save:** Keep global canonical pixels under `["overworld","hollow_marches","last_position"]` via `SaveService.patch_state_path`. One-shot POI entitlements remain `transact_once` with existing `a1slice:` keys. No coordinate migration for existing `x<6144` saves.
7. **Production acceptance:** Repeat the isolated fixture vectors through the real production controller on fresh save and reload, including ordinary movement, camera visibility, ten dungeon thresholds, build rejection, and exact rewards.

## 6. Acceptance vectors

| ID | Gate | Current evidence |
|---|---|---|
| CN-01 | Exact 46 collision / 48 dressed / 14 prop delta; source pins; inverse rollback restores legacy grids/props. | **PASS source** (`validate_connector.py`, pytest). |
| CN-02 | Unmodified legacy blocker reproduced: Hero stops before x369. | **PASS A0 native negative** run 40931599594. |
| CN-03 | Composed live-shape route Refuge → border → Waystation anchor/approach `(408,200)` without teleport; exact locker-stand `(408,199)` micro-clearance against the slice obstacle is A0 POI-mount acceptance. | **PENDING CI native fixture**. |
| CN-04 | Waystation → Relay crank stand `(442,234)` around static slice obstacles. | **PENDING CI native fixture**. |
| CN-05 | Relay → Refuge return; camera right limit 7168; Hero visible. | **PENDING CI native fixture**. |
| CN-06 | Ten dungeon thresholds, camps, discoveries remain reachable in composed nav. | **PENDING CI native fixture**. |
| CN-07 | A0 production controller with source overrides repeats CN-03..06 on fresh save/reload; SaveService global pixels round-trip. | **PENDING A0**. |
| CN-08 | Build rejected on connector road and disabled annex; legacy home/build tests unchanged. | **SOURCE contract**; native A0 pending. |
| CN-09 | Canonical rewards byte-locked; no A3 hypothetical locker/cache rewards; one receipt per entitlement. | **PASS source**; production A0/A3 pending. |
| CN-10 | Only chunk6:3 imported; 106 unmounted POIs not spawned; rollback/downgrade recovery explicit. | **PASS source**; production A0 pending. |

Canonical reward lock: locker `cap_salvage` / 0 items; ledger `cap_seal_1` / 0; cache 3 `iron_scrap` + 2 `knowledge_spares` per 1800 active seconds; deadfall 2 `oak_wood` per 300; Relay consumes 2 `iron_scrap` + 1 `oak_wood` once → `cap_power_1`. Copper upgrade remains disabled.

## 7. Rollback

- **A1 branch:** disable/delete derived pilot inputs; committed contract/delta remain review evidence. No A1 chunk mutation to undo.
- **A0 bake:** restore pinned legacy world/layers/props byte-for-byte, or apply inverse `cell_deltas` and reinsert suppressed props at exact indices.
- **Save:** pre-adoption pilot saves can be discarded. Post-adoption downgrade with `last_position.x>=6144` must use an explicit rollback recovery to last camp/Refuge and log it; normal gameplay must never teleport.
- **Build:** remove annex guard only when annex is removed or composite validator is accepted.

## 8. Evidence commands

```bash
.venv/bin/python tools/survival/worldgen/compile_connector.py --out artifacts/a1-connector
.venv/bin/python tools/survival/worldgen/validate_connector.py --out artifacts/a1-connector
.venv/bin/python -m pytest tests/survival/world -q
.venv/bin/python tools/survival/worldgen/check_determinism.py
# CI-only native fixture (root project, real Knight, isolated composed world).
# Match A0 native boot: Xvfb + GL compatibility, not --headless, so autoloads
# (GameEvents/SaveService) exist before the Knight script is loaded.
xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 godot --path . --rendering-method gl_compatibility --rendering-driver opengl3 --audio-driver Dummy --resolution 960x540 --windowed --script res://tests/survival/world/connector_native_test.gd -- --connector-root=artifacts/a1-connector
```

Local source gate: connector validation 0 errors; pytest **82 passed**; world/slice validators pass; determinism **232 artifacts**, tree `e74cd6853be2d3df6fe4cb12f05b2552515770f5a84bf60910571d236002c485`. Local sandbox has no Godot/Xvfb; native fixture result is CI-pending until the workflow run is read back.

## 9. Research / reuse note

Repo source remains the geometry authority. Official Godot engine class documentation was consulted for `Camera2D` limits and `PhysicsShapeQueryParameters2D` shape/mask/exclude semantics (GitHub `godotengine/godot/doc/classes`). Low-authority forum/blog results about chunked TileMapLayer streaming were treated as non-authoritative and not used as acceptance evidence. No third-party code/art is imported. The selected pilot deliberately avoids a new streaming framework.

## 10. Handoff state

A1 returns **`PAUSED_AWAITING_NATIVE_INTEGRATION`** after this contract/evidence checkpoint. PR20 remains open and unmerged. A0 must apply the owned seam/delta/guard and run production acceptance; CT must accept or reject the exact local ridge tradeoff. Source/data/isolated-fixture success is not a claim of mounted gameplay.
