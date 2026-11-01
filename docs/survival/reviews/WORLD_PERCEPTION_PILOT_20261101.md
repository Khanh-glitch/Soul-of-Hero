# SOH — A0 World Perception Research Pilot (NO MAP CHANGES)

**Authority:** Creator approved proceeding after independent audit of uploaded `soul-of-hero-game-prototype (1).zip` on 2026-11-01. The only feature under evaluation is *perception/knowledge*, not map geography, art, POI design or any new GameRoot/SaveService.

**Baseline:** `fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1` on draft GP-B PR #31, plus the source review and exact linked concerns in its comment [6560918850](https://github.com/Khanh-glitch/Soul-of-Hero/pull/31#issuecomment-6560918850). New branch `research/visibility-pilot-20261101`, isolated and unmerged. Source inspiration: `src/sim/navigation.ts` from uploaded ZIP, not ported source/art.

## What was actually implemented

- `game/survival/perception/a0_visibility_projection.gd`: isolated bounded grid LOS, read-only opacity injection, current/remembered/unknown split, fail-closed opaque unknowns, collision-corner no-x-ray rule, invalidation on live structure/door change, no per-frame scanning when unchanged, explicit run-local discovery snapshot/load/reset interface.
- `tests/survival_a0_visibility_projection_pilot_test.gd`: native-script test covering closed/open physical-door *grid mock*, walls and corners, observers/radius, render information policy API, event-driven recompute, memory stale/live distinction, snapshot/restart, run reset and malformed-authority refusal.

**Exact test command (requires real Godot 4.7):**

```bash
godot --headless --path . --import
godot --headless --path . --script res://tests/survival_a0_visibility_projection_pilot_test.gd
# Require A0_VISIBILITY_PILOT_PASSED; 0 FAIL/Parse Error/SCRIPT ERROR.
```

No native engine is available in this review sandbox. **Tests are authored, NOT YET EXECUTED, NOT PASSED.** Workflow creation in this environment was blocked; no CI success is implied.

## Deliberate exclusions and owner boundaries

- NO edits to `game/survival/world/**`, any A1-authored geometry/tiles/assets, region graph, A8 scenes, POI coordinates, collision/physics layers or world-plan SHA.
- NO changes to existing `OverworldOcclusion` or `SurvivalRoofLayer` (SOH has superior selective overlap/room-based fading to the prototype).
- NO changes to A0 GameRoot, save schema, action/AI pipeline or normal player route; this means the projection is **NOT MOUNTED IN PRODUCTION**.
- NO alternative persistent authority. Only A0 could later validate a `run_id`, store discovered indices in its existing SaveService, and erase them at run closure. Current `load_run_local_discovered` assumes the caller has already authorized the payload.
- `_opacity_query` MUST be a genuinely world-physical read-only interface supplied by A0 from live A1/A8 opacity/door state. DO NOT silently treat impassable terrain, ocean, snow, hazards or movement blockers as universally opaque. A1 is read-only here and not an implementation owner.
- No forced 15/8-cell vision balance; night and lighting radii remain Gameplay tuning, not a copied prototype canon. LOS of a monster belongs to its own senses and must not read player-discovery arrays.
- No canvas/Gold replacement graphics; no static room-distance roof fade; no new world map.

## Next real production-admission gate (UNMET)

1. Native 4.7 **import + script gate** above on exact branch SHA, real log readback. Fix parse/runtime defects without weakening tests.
2. A0 owns a source-backed, read-only A1/A8 **physical occluder binding** (walls/doors/forest silhouettes, POI interior boundaries) including chunk load/unload and revision notifications; only after source semantics are verified. A1 does NOT redesign map.
3. A0 uses the existing SaveService single custody and same run identity; fresh run, reload after movement, malformed save, door opens during logout, and stale dynamic source state must be proven.
4. A6 presents memory fog separately from visible world, filters entities/status/FX through `can_show_live_entity` (or equivalent), while retaining existing per-room roof and selective prop occlusion. VFX must not leak hidden enemy positions via particles/HUD.
5. A7 verifies real-key player route across A1 authored world, POI A8, walls/doors, night and lighting; uses decoded 1280×720/1440p/2160p genuine Godot scene images opened at 1×, 640×360 readability and bounded frame/memory/stream performance. A browser/mock-only preview is NOT a visual acceptance.
6. Product check: darkness creates understandable exploration, never forces mission, ruins quiet knife-first play or grants unfair AI omniscience. Does not hide critical survival status without affordance.

**Stop / escalation:** If a genuine opacity source is not available in the current A1/A8 contract, report `PHYSICAL_OPACITY_CONTRACT_MISSING` and hold production binding; don't forge transparency from `cell_is_walkable`. If LOS or snapshot tests fail, keep pilot draft. Independently accepted tests do not grant merge or production status.

**Current conclusion:** `CODE_WRITTEN / NATIVE_UNVERIFIED / PRODUCTION_HOLD / NO_MAP_SCOPE`. This documentation is a real pilot handoff, not an Arena dispatch or owner ACK.
