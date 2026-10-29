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
python3 tools/survival/worldgen/analyze_pacing.py
.venv/bin/python tools/survival/worldgen/validate_world.py
.venv/bin/python -m pytest tests/survival/world -q
python3 tools/survival/worldgen/check_determinism.py
.venv/bin/python tools/survival/worldgen/preview.py
```

Review PR: https://github.com/Khanh-glitch/Soul-of-Hero/pull/20 (to integration). Issue: #12.

Google Docs tab 04 sync: **DONE** — appended review-correction checkpoint and verified readback marker `A1_SURV050A_REVIEW_CORRECTIONS_ea64df75` in tab `t.h4haqfdoyzzn`. Control-tower tab 12 left to coordinator.

Isolated Godot 4.7 reader fixture: `tests/survival/world/godot/`; CI: `.github/workflows/survival-world-reader.yml`. This is authored-data consumption proof only, not native continent integration.
