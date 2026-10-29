# SURV-050A Review-Correction Checkpoint

Status: `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED`  
Decision: `KEEP A1 / CONTINUE_WITH_TARGETED_CORRECTIONS`  
PR: https://github.com/Khanh-glitch/Soul-of-Hero/pull/20  
Branch: `arena/e385312a-soul-of-hero`  
Starting HEAD: `8c62061b887ce1f017a3509ae9f4f160c762938d`

## Scope kept

- Existing continent, 11 regions, 22 biomes, 27 materials, 12 capabilities, 10 hazards, 108 new POIs, 33 sites / 178 nodes, 192 chunks and ten Chapter 1 entrances preserved.
- No production overworld controller, SaveService, A0 construction files, A3 economy files, A4 Gold/VFX, A6 UX files or root `project.godot` edited.
- No new project, no POI inflation, no geography regeneration. The only authored progression correction is hazard-rect exposure gating for sheltered capability-source POIs.

## W-01 — legacy build delegation

- Required chunk layer `build_permission`: 0 deny A1 candidate, 1 candidate requires A0, 2 delegate to A0.
- Legacy inset keeps historical `build=0` verbatim but sets `build_permission=2`.
- `world_plan.v1.json.layer_semantics` and `reader_contract.json` publish the authority, missing-delegate error and overlay precedence.
- Negative regression: legal fresh-save legacy home cell `[54,222]` delegates and allows; naive `build==0` blocking would deny it. Protected camp `[56,216]` delegates and denies. Dynamic child occupancy vetoes. Missing delegate is an error, not silent deny.
- Walk/road overlays only, outside legacy, stale/immutable overlays fail closed, overlays cannot authorize construction.

## W-02 — scale/pacing

- `tools/survival/worldgen/analyze_pacing.py` emits `data/survival/world/pacing_analysis.json` and `docs/survival/world/PACING_ANALYSIS.md`.
- 10 concrete journeys: early legacy home, early buffer, filter/climb/thermal/seal2/boat bootstrap+sustain, tide-ward, seal3 customs, deepward root lift.
- Measures route tiles, foot-equivalent minutes, detour ratios, hazard exposure, capability grants, outpost round-trips, alternate-route cuts and post-14d goal travel.
- Early home: 36 oak_wood + 2 iron_scrap, 7 node visits, 20 gather hits, ~0.62 min grid travel estimate. Gathering/crafting/combat seconds NOT_TESTED.
- Post-14d goals reachable with late caps in ~1.3–3.8 min travel each. This is not a fourteen-day playtime claim.
- Early buffer trunk intersects legacy crown heat/rot rects; exposure is quantified and left as an A6/A0/A3 tuning gate, not hidden behind a “low risk” label.

## Reader / CI / handoffs

- Isolated Godot 4.7 fixture: `tests/survival/world/godot/` (no autoloads, no production scene, no SaveService).
- A1-owned workflow: `.github/workflows/survival-world-reader.yml`.
- Local Godot unavailable; release asset SSL blocked; PyPI has no engine binary. CI run status is recorded in `VALIDATION.md` after push.
- A3: `material_source_contracts.json` with `a0_item_hints` (hints only; A3 owns final items/yields/recipes/prices).
- A6: `hazard_capability_contracts.json` with stable labels, rects, severity, required preparation and clue policy.

## Local evidence at checkpoint

- Validator: 0 errors; 11 schemas PASS.
- Pytest: 41 passed.
- Determinism: 212 artifacts, tree SHA `36dcd527c58ffc7912a0c2124b5a10f600cd9f8b6262541593cb469a4b30b5c3`.
- Masterplan SHA `008d415f015610d1bb2ca6a940fc5e2974abe19406904e53ffb0ae7c9a89f46d`.
- 8 previews regenerated; biome/starter/routes/capability PNGs opened and visually inspected.

## Acceptance request

Request independent acceptance of the **A1 AUTHORED WORLD milestone only**. Native continent integration, paid-home placement, SaveService round-trip, production collision/camera/Knight traversal, hazard damage, A3 economy and A6 UX remain separately gated. `native_playable=false`. Do not self-merge PR #20.

## Docs sync

Google Docs connector is enabled. Targeted tab 04 read/write is still being completed at this checkpoint: `DOCS_SYNC_PENDING` until readback is verified.
