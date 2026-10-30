# SURV-050A — A1 Living Continent World Plan

Status: `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED`  
Owner: A1 World Architect  
World ID: `world:soh_continent_v1`

This directory contains the review package for the complete authored continent. It is a machine-readable world masterplan, deterministic compiler/validator, schemas, previews, and A0 integration contracts. It is **not** a native Godot playable build and does not modify the production overworld controller, SaveService, A0 construction, A3 economy, A4 Gold/VFX, or A6 UX files.

## Read order

1. [`SURV-050A_REPORT.md`](SURV-050A_REPORT.md) — milestone report, acceptance checklist, metrics, dependencies, next steps.
2. [`A0_ADAPTER.md`](A0_ADAPTER.md) — load order, chunk grammar, seam carves, protected rects, identity/dynamic-state separation.
3. [`VALIDATION.md`](VALIDATION.md) — exact commands, validator/pytest/schema/determinism results.
4. [`VISUAL_CRITIQUE.md`](VISUAL_CRITIQUE.md) — inspected previews, geography revisions, remaining visual limitations.
5. [`PACING_ANALYSIS.md`](PACING_ANALYSIS.md) — concrete journey/travel/preparation/logistics estimates; playtime NOT_TESTED.
6. [`PRODUCT_CORRECTIONS.md`](PRODUCT_CORRECTIONS.md) — novice hazard bootstrap, A1/A3 material decisions, truthful POI readiness and two early exemplars.
7. [`RESEARCH_AND_LICENSES.md`](RESEARCH_AND_LICENSES.md) — required source reading, pinned external research, license/reuse decisions.
8. [`CANONICAL_GEOGRAPHY_CONNECTOR_HANDOFF.md`](CANONICAL_GEOGRAPHY_CONNECTOR_HANDOFF.md) — single canonical seam blocker: exact legacy carve + one-chunk annex contract, A0 owners, acceptance vectors, rollback; production native still false.

## Machine-readable artifacts

- `data/survival/world/world_plan.v1.json` — masterplan.
- `data/survival/world/chunks/*.json` — 192 deterministic 64×64 RLE chunks.
- `data/survival/world/schemas/*.schema.json` — 11 schemas including `reader_contract`; chunk schema now requires `build_permission`.
- `data/survival/world/reader_contract.json` — machine-readable build delegation, overlay precedence and sample cells for the isolated Godot reader.
- `data/survival/world/hazard_capability_contracts.json` — A6 hazard/capability labels, rects, severity and required preparation.
- `data/survival/world/pacing_analysis.json` — bounded travel/preparation/logistics estimates, not playtime proof.
- `data/survival/world/novice_bootstrap_contract.json` / `hazard_damage_contract.json` — first-hour safe preparation and native-compatible A0/A3 damage/mitigation proposal.
- `data/survival/world/a1_a3_material_decisions.json` — explicit A1 decisions for PR #19 aliases and 12 missing items.
- `data/survival/world/poi_authoring/*.v1.json` — two early interaction specs; 106 other new POIs remain `WORLD_SITE_CONTRACT_ONLY`.
- `data/survival/world/vertical_slice/` — native-ready two-POI handoff for Ashen Waystation + Crown Relay Shed: exact cell contracts, A0/A3/A6 payloads, 10 adversarial vectors; `native_playable=false`.
- `data/survival/world/connector/` — canonical geography connector contract + exact 46-cell legacy collision delta / 48-cell road dressing / 14-prop suppression; bounded one-chunk annex pilot inputs are derived to `artifacts/a1-connector/`, not committed as replacement legacy sources.
- `data/survival/world/poi_route_graph.json` — POI/route/capability graph for A3/A5/A6.
- `data/survival/world/material_source_contracts.json` — material source/consumer contracts for A3.
- `data/survival/world/baseline_lock.json` — read-only production baseline hashes and entrance oracle.
- `data/survival/world/metrics.json` — density/accessibility/emptiness/progression metrics.
- `docs/survival/world/previews/*.png` — authored strategic previews, not native screenshots.

## Reproduce

```bash
python3 -m venv .venv
.venv/bin/pip install -r tools/survival/worldgen/requirements.txt
python3 tools/survival/worldgen/make_schemas.py
python3 tools/survival/worldgen/compile_plan.py
python3 tools/survival/worldgen/compile_slice.py
python3 tools/survival/worldgen/preview_slice.py
python3 tools/survival/worldgen/analyze_pacing.py
.venv/bin/python tools/survival/worldgen/validate_world.py
.venv/bin/python tools/survival/worldgen/validate_slice.py
.venv/bin/python tools/survival/worldgen/compile_connector.py --out artifacts/a1-connector
.venv/bin/python tools/survival/worldgen/validate_connector.py --out artifacts/a1-connector
.venv/bin/python -m pytest tests/survival/world -q
python3 tools/survival/worldgen/check_determinism.py
.venv/bin/python tools/survival/worldgen/preview.py
```

Review PR: https://github.com/Khanh-glitch/Soul-of-Hero/pull/20 (to integration). Issue: #12.

Google Docs tab 04 sync: **DONE** — appended review-correction checkpoint (`A1_SURV050A_REVIEW_CORRECTIONS_ea64df75`), product-correction checkpoint (`A1_SURV050A_PRODUCT_CORRECTIONS_91a35449`) and native-slice checkpoint (`A1_SURV050A_NATIVE_SLICE_ec9edecb`) and verified readback in tab `t.h4haqfdoyzzn`. Control-tower tab 12 left to coordinator.

Isolated Godot 4.7 reader fixture: `tests/survival/world/godot/`; CI: `.github/workflows/survival-world-reader.yml`. This is authored-data consumption proof only, not native continent integration.

## Native-ready two-POI vertical slice

See `VERTICAL_SLICE_HANDOFF.md`. The slice makes only `poi_crown_waystation` and `poi_crown_relay_shed` implementation-ready for A0 native integration. It adds exact footprints, required nav, obstacles, entrances, retreat paths, action/state transitions, A0 save/transaction identities, exact A3 item/source IDs, discovered-only A6 projections and 10 executable adversarial vectors. It does not regenerate the world, add POIs, import prototype TypeScript, implement P1–P3 research mechanics, or claim native playability.

## Canonical geography connector blocker

See `CANONICAL_GEOGRAPHY_CONNECTOR_HANDOFF.md`. A1 selected a bounded static one-chunk annex: exact 46-cell legacy ridge cut in a 16×3 mouth `x368..383,y199..201`, 48 dressed road cells, 14 flat cliff decal suppressions, and unchanged chunk `6:3` composed at canonical `(384,192)` into `448×256`. It preserves global coordinates, ten dungeon entrances, canonical POI identities and exact rewards; it does not import all 192 chunks or spawn the 106 unmounted POIs. A0 owns the production world-source seam, annex build guard, slice obstacle mount and production Hero/save acceptance. Local source gate and prior isolated connector CI native fixture pass (push 40993737087 / PR 40993742640). A0 then proved the exact locker stand `(408,199)` collided with the full-tile locker bank; A1 correction `a1_locker_stand_toe_clearance_v1` refines only that local collision footprint to 16×14 offset (0,-1), keeping stand/anchor/rewards/ridge unchanged. Locker-correction CI PASS at `bc71b536` (push 40999023888 / PR 40999029445); production `native_playable=false`. A1 state: `PAUSED_AWAITING_NATIVE_INTEGRATION`.

## 2026-10-30 first-hour corridor checkpoint

- `FIRST_HOUR_CORRIDOR_HANDOFF.md`: durable `source_class_id -> region_id -> instance_id -> canonical POI/null` chain, three physical roadside crates plus the canonical Waystation cache, A3 binding boundary, A0 mount steps.
- `A8_SITE_TRANSFORM_CONTRACT.md`: exact cell-to-native transform review for Quarry/Orchard/Mill; direct 1:1 mount rejected for footprint mismatch.
- `STREAMING_EVALUATION.md`: bounded static annex retained; true 2D TileMapLayer streaming deferred until measured need.
- `data/survival/world/corridor/`: compiled corridor and A8 transform review. `tools/survival/worldgen/compile_corridor.py`, `validate_corridor.py`, `preview_corridor.py`; `tests/survival/world/test_corridor.py`, `corridor_native_test.gd`.
- Local source gate: 101 pytest cases, corridor validator 0 errors, determinism 236 artifacts. Production `native_playable=false`; A3 economics and A0 production mounting remain pending.
