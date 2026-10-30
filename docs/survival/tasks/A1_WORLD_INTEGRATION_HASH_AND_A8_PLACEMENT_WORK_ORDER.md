# A1 world integration — first-hour hash reconciliation + A8 placement review

**Owner:** A1 on existing PR20 / `arena/e385312a-soul-of-hero`. **Status:** implementation started; native result pending at intake. **Base:** `7d2b017c8a90b7d5e24ff85f065ff1b18548cd29`.

## User work order
1. Refresh source/CI and read `CURRENT_PRODUCT_CONTRACT.md` + `DECISIONS.md` at A0 `4b4b63f56b92c2f7b50d770554afd96d5d0a098b`.
2. Reconcile A0/A1 first-hour source-frame and crop-hash discrepancy with actual file/hash proof before any A0 repin.
3. Review A8's existing six Elder candidates at `02ad8b727298284c16ea7f469d43310021b40f20:data/survival/world_content/ragnarok_six_territories.v1.json` and four physical endpoint proposals at `.../physical_ragnarok_endpoints.v1.json`. Do not author a competing six-territory system.
4. As geography authority, approve/reject each location using biome identity, collision, approach, retreat, hazards, safe ordinary exploration and days1–11 usefulness. Use real Godot Hero-shape validation in both directions including corner/edge collision. Flag every placement that is only authored data, not traversable production world.
5. Deliver updated authoritative A1 placement contract, exact IDs/coordinates, source SHA, native evidence, and A0/A8/A3/A7 handoff. Preserve approved art, licenses, quiet melee-first exploration, dungeon sources and world identity. No fake boss, loot grant, production acceptance, A0 SaveService, A3 economy or Gold edits.

## Implementation record at intake
- A0 `4b4b63f5` and PR20 `7d2b017c` verified; PR20 OPEN/MERGEABLE. Accepted native art parity milestone preserved.
- A0 comment `#issuecomment-6524971216` identifies three lock values that do not equal whole presentation file SHAs.
- Hash review finds distinct domains: payload-subset canonical JSON vs whole file bytes vs raw decoded RGBA crops.
- All 181 first-hour crops match `ad39bde6` raw RGBA; eight only moved atlas coordinates. `cache_notes`/`cache_closed` IDs and rects preserved.
- Existing A8 IDs are reviewed in place; pinned A8 input copies are read-only references, not another territory system.
- All placements remain source-window / connector-fixture evidence until A0 mounts production. No A0 repin is performed.

## Acceptance
- `tests/survival/world/placement_native_test.gd` runs under Godot 4.7/Xvfb with the real 12×16 Knight body.
- Six territories + four endpoints, forward and return ordinary-input paths, zero ordinary-path hazard cells, swept corner/edge probes, native captures and a failure count.
- Native Godot independently hashes all 181 raw RGBA crops.
- Final report names exact SHA, CI job/artifact, approved/rejected sockets, unresolved hazard/production gates and consumer handoff.
