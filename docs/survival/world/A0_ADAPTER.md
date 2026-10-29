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
- `build = 0` throughout the legacy inset. The existing A0 build validator remains authoritative there.

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
| `build` | Proposed buildability | A0 `validate_cell` remains authoritative; legacy inset is 0. |
| `hazard` | 1-based index into `legend.hazard` | Exposure/preparation contract, not an arbitrary level barrier. |
| `road` | Trunk/spur/bridge carriageway | Bridges are authored where foot routes cross water. |
| `preserved` | 1 inside legacy inset | Never overwrite production truth here. |
| `elevation_band` | `elevation_m // 50` | Legacy inset unknown = 0. |

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
| A3 economy | `material_source_contracts.json`, `material_key`, renewal, causes | Geological/ecological source sites and POI consumers | Final `item_id`, recipes, prices, Gold balance |
| A4 Gold/VFX | None | A1 does not import or modify Gold/VFX | Any A4 asset dependency |
| A6 UX | Hazard clues, capability gates, POI purpose, alternate approaches | Environmental preparation grammar and map labels | Final HUD/map UI implementation |
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

A1 local environment could not download Godot 4.7 (`release-assets.githubusercontent.com` SSL failure). Existing `workflow_dispatch` CI workflows were not triggered by A1. Therefore this package is review-ready as an authored plan, not native playable integration.
