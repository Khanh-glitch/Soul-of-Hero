# A0 Integration Contract — SURV-050A World Plan

Status: `CONTRACT_NOT_SPAWNED` / `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED`  
A1 owns static world truth. A0 owns native construction, persistence, spawning, and runtime reconciliation. This document is the handoff seam; it does not change SaveService or the production overworld controller.

## 1. Load order

1. `data/survival/world/baseline_lock.json` — verify protected production hashes before any adapter applies seams.
2. `data/survival/world/world_plan.v1.json` — immutable static masterplan.
3. `chunk_manifest` — verify each chunk SHA-256 before use.
4. `data/survival/world/chunks/{cx:02d}_{cy:02d}.json` — stream/decode only needed 64×64 chunks.
5. A0 dynamic survival state — mutations keyed by stable world IDs, never by array index.

The existing Chapter 1 overworld remains authoritative until A0 lands an adapter. A1 does not paint new chunks into `data/overworld/*` and does not call `_paint_world`, `_spawn_player`, or SaveService.

## 2. Frame and preserved inset

- Frame: 1024×768 tiles, `tile_px = 16`.
- Starter quarter: `{x:0,y:0,w:512,h:384}`.
- Preserved legacy inset: `{x:0,y:0,w:384,h:256}`.
- Exactly ten Chapter 1 dungeon entrances are preserved with original `cell`, `threshold`, and `campaign_level_id`.
- Legacy elevation is `UNKNOWN_NOT_FABRICATED`; chunk elevation bands inside the inset are 0 and must not be interpreted as sea level.
- `build = 0` throughout the legacy inset is a **historical hint, not a denial**. The machine-readable authority is `build_permission = 2` (`delegate_to_a0_validate_cell`). An adapter MUST call A0 `SurvivalBuildSystem.validate_cell(cell)` and honor its result; it MUST NOT forbid homes because `build == 0`. A missing delegate is an error (`legacy_build_delegate_required`), not a silent deny.

## 3. Proposed legacy seam carves

These are the only proposed legacy edits. Apply through the existing shortcut/carve mechanism after baseline-lock verification. Do not move dungeon thresholds, camps, or shortcut interactables.

| Seam | Carve rect `[x0,y0,x1,y1]` | From → To | Purpose |
|---|---|---|---|
| `seam_east_crown` | `[368,198,392,202]` | `[368,200] → [392,200]` | East rim postern into the Ashen buffer. |
| `seam_south_amber` | `[51,240,55,264]` | `[53,240] → [53,264]` | South rim stair into Amberwood. |

Protected clearances used by the validator: dungeon thresholds/camps radius 5, shortcuts radius 4, existing route detail codes `= + :`. A seam that intersects protected clearance fails `SEAM_PROTECTED`.

## 4. Chunk grammar

Schema: `soh.world.chunk.v1`. Each chunk has `chunk_id`, `origin`, `size`, `tile_px`, `layers`, `legend`.

RLE format: `[[value, count], ...]`, row-major, total `size[0] * size[1]`.

| Layer | Meaning | Native caution |
|---|---|---|
| `region` | 1-based index into `legend.region` | Ownership contract, not a biome wall. |
| `biome` | 1-based index into `legend.biome` | Observed biomes may cross region seams. |
| `surface` | 1-based index into `legend.surface` | Strategic surface, not final tile art. |
| `walk` | Proposed 4-neighbour walkability | Must be reconciled with production solid RLE + lower-body prop collision before native claims. |
| `build` | Historical buildability hint | Legacy inset is 0 verbatim; **not** final authority. Use `build_permission`. |
| `build_permission` | 0 deny A1 candidate, 1 A1 candidate requires A0, 2 delegate to A0 | Legacy inset is always 2. Missing delegate is an error, not deny. |
| `hazard` | 1-based index into `legend.hazard` | Exposure/preparation contract, not an arbitrary level barrier. |
| `road` | Trunk/spur/bridge carriageway | Bridges are authored where foot routes cross water. |
| `preserved` | 1 inside legacy inset | Never overwrite production truth here. |
| `elevation_band` | `elevation_m // 50` | Legacy inset unknown = 0. |

## 4.1 Build delegation and overlay precedence (W-01 correction)

Machine-readable semantics live in `world_plan.v1.json.layer_semantics` and `reader_contract.json`.

| `build_permission` | Meaning | Adapter action |
|---:|---|---|
| 0 | `deny_a1_candidate` | Do not propose an A1 build candidate here. |
| 1 | `a1_candidate_requires_a0_validation` | Preview only; call A0 `validate_cell` before any paid placement. |
| 2 | `delegate_to_a0_validate_cell` | Legacy inset. Ignore `build=0`; call A0 and honor allow/deny. |

A0 delegate wrapper contract:

```gdscript
var reason: String = build.validate_cell(cell)
return {"ok": reason.is_empty(), "reason": reason}
```

Precedence:

1. Static chunk layers (`walk`, `road`, `build_permission`, etc.).
2. Authored world-repair overlays may change **only** `walk` or `road`, only outside the preserved inset, and only with `source_id`, `revision`, `cell`, `value`, `expected_base`. Stale or immutable-layer overlays fail closed.
3. Legacy dynamic child collision and A0 live occupancy/physics always win. Overlays cannot grant capabilities, change hazards, or authorize construction.

Negative regression: `tests/survival/world/test_build_contract.py` fixes legal fresh-save legacy cell `[54,222]` (`build=0`, `build_permission=2`). A naive zero-blocking adapter would deny it; the corrected contract delegates to A0 and allows it. Protected camp cell `[56,216]` delegates and denies `protected_place`. The isolated Godot reader fixture repeats this regression with a contract stub; native paid-home placement remains an A0 integration gate.

## 4.2 Isolated Godot 4.7 reader fixture

`tests/survival/world/godot/` is a minimal read-only fixture project. It does **not** load the production overworld, SaveService, or A0 build system. It proves chunk/RLE decoding, identity/hash/bounds, adjacent seams, legacy delegation, overlay precedence and malformed-input rejection under Godot 4.7 in CI (`.github/workflows/survival-world-reader.yml`). It is not native continent integration.

## 5. Identity and dynamic state

Static IDs:

- World: `world:soh_continent_v1`
- Region: `^r_[a-z0-9_]+$`
- POI: `^(poi|legacy_lm)_[a-z0-9_]+$`
- Chunk: `^chunk:[0-9]+:[0-9]+$`
- Resource node: `^res:[a-z0-9_]+:[0-9]{2}$`
- Route: `rt_*` trunk, `sp_*` spur.

Dynamic state must live in A0 persistence, keyed by these IDs. Suggested keys (contract, not implemented):

- `world_mutations[poi_id]` — cleared/opened/powered/restored state.
- `resource_depletion[node_id]` — harvest count, respawn timer, renewable state.
- `route_unlocks[route_id]` — bridge/ferry/pass/boardwalk repair.
- `capability_grants[cap_id]` — equipment/credential/power preparation, not XP level.
- `world_flags[goal_id]` — long-run goal completion.

Never rewrite `world_plan.v1.json` or chunk files to store runtime mutations. PR #11 container fixes remain A0-owned; A1 does not depend on them.

## 6. Cross-agent contracts

| Consumer | Contract | A1 guarantee | Not guaranteed |
|---|---|---|---|
| A0 construction/persistence | Chunk layers, seam carves, stable IDs, protected rects | Deterministic static truth, baseline lock, validator | Native spawning, collision reconciliation, SaveService schema |
| A3 economy | `material_source_contracts.json`, `material_key`, renewal, causes, `a0_item_hints` | Geological/ecological source sites and POI consumers; legacy A0 item aliases are hints only | Final `item_id`, recipes, yields, prices, Gold balance |
| A4 Gold/VFX | None | A1 does not import or modify Gold/VFX | Any A4 asset dependency |
| A6 UX | `hazard_capability_contracts.json`, hazard clues, capability gates, POI purpose, alternate approaches | Stable hazard/capability labels, rects, severity, required preparation | Final HUD/map UI/VFX implementation |
| S6 optional POI | None | A1 plan is complete without S6 | S6 content is nonblocking |

`material_key` is a world-source contract, not a final A3 item. `cap_*` is a preparation capability (equipment, credential, power, boat, seal), not a character level. Hazards communicate required preparation through clues and exposure; alternates may reduce combat but must not remove exposure preparation.

## 7. Native acceptance gate before playable claims

A0 must run Godot 4.7 native validation after adapter implementation:

- Baseline lock still matches production overworld hashes.
- Ten entrances and four shortcuts unchanged; fresh-save flood reaches all thresholds with shortcuts closed.
- Seam carves applied without protected-clearance violations.
- Chunk walkability reconciled with production collision and prop bodies.
- POI/resource spawning uses stable IDs and does not mutate static plan.
- Save/load round-trip preserves dynamic state keyed by world IDs.
- Native camera/zoom and Knight movement at 96 px/s traversed in engine, not only Python flood.

A1 local environment could not download Godot 4.7 (`release-assets.githubusercontent.com` SSL failure). An A1-owned isolated reader workflow (`.github/workflows/survival-world-reader.yml`) now runs the chunk/RLE/build-contract fixture under Godot 4.7 in CI; see `VALIDATION.md` for the exact run status. This proves authored-data consumption only. Native continent integration, paid-home placement, SaveService round-trip, camera/Knight traversal and production collision reconciliation remain separate A0 gates. Therefore this package is review-ready as an authored plan, not native playable integration.
