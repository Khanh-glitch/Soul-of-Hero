# Validation Evidence — SURV-050A (review corrections)

Status: authored-data validation passed locally. Isolated Godot 4.7 reader CI **passed** at correction head `ea64df75`. Native continent gameplay validation remains **NOT_TESTED**.

## Commands

```bash
.venv/bin/python tools/survival/worldgen/make_schemas.py
.venv/bin/python tools/survival/worldgen/compile_plan.py
.venv/bin/python tools/survival/worldgen/analyze_pacing.py
.venv/bin/python tools/survival/worldgen/validate_world.py
.venv/bin/python -m pytest tests/survival/world -q
.venv/bin/python tools/survival/worldgen/check_determinism.py
.venv/bin/python tools/survival/worldgen/preview.py
.venv/bin/python -m py_compile tools/survival/worldgen/*.py
```

## Local results

- Compiler: `ok = true`.
- Masterplan SHA-256: `008d415f015610d1bb2ca6a940fc5e2974abe19406904e53ffb0ae7c9a89f46d`.
- Deterministic double-compile tree SHA-256: `36dcd527c58ffc7912a0c2124b5a10f600cd9f8b6262541593cb469a4b30b5c3` (212 JSON artifacts). See `determinism_report.json`.
- Structural validator: `ok = true`, 0 errors. See `validation_report.json`.
- JSON Schema validation: 11 schemas emitted; all validated objects PASS.
- Pytest: `41 passed`. See `pytest_report.txt`.
- Pacing audit: 10 concrete journeys resolve; `AUTHORED_ESTIMATE_NOT_PLAYTESTED`. See `PACING_ANALYSIS.md` and `data/survival/world/pacing_analysis.json`.
- Previews: 8 PNGs regenerated and visually inspected; `previews/preview_manifest.json`.
- `py_compile`: clean.

## Metrics

| Metric | Value |
|---|---:|
| Frame | 1024×768 tiles |
| Land cells | 702,356 |
| Preserved legacy inset | 384×256 = 98,304 cells (12.5% of frame) |
| Starter quarter | 512×384 (25% of frame) |
| Regions | 11 |
| Biomes | 22 |
| New POIs | 108 |
| Preserved Chapter 1 entrances | 10 |
| Resource sites / nodes | 33 / 178 |
| Route edges | 129 (21 trunk + 108 spurs) |
| Chunks | 192 × 64×64 |
| Physically reachable new POIs | 108 / 108 |
| Capability access counts | novice 39, mid 99, late 108 |
| Empty-space ratio (>64 tiles from anchor) | 0.0115 |
| Max distance to meaningful anchor | 80.99 tiles |
| Long-run post-14d goals | 5 |

Novice access increased from 38 to 39 because sheltered capability-source POIs are no longer over-gated by a hazard rect they do not occupy (e.g. the thermal wardhouse). Geography, region IDs, POI IDs, entrances and resource counts were not regenerated.

## Test coverage

- Masterplan validator + JSON schemas (including `reader_contract`).
- Exactly ten legacy entrances preserved; thresholds/cells match baseline lock; fresh-save baseline flood reaches every threshold with shortcuts closed.
- Physical accessibility from spawn for every new POI, resource node, and seam carve endpoint.
- Resource distribution, causal sources, novice staple loop, renewal policies, no new nodes inside the preserved inset.
- POI density/emptiness, alternate routes, three progression counterfactuals.
- **W-01 build delegation:** legal legacy home cell `[54,222]` has `build=0`, `build_permission=2`; A0 oracle/delegate allows it; naive zero-blocking would deny it. Missing delegate is an error. Protected camp and dynamic-child occupancy veto are honored. New-land candidates require A0; roads deny A1 candidates.
- **Overlay precedence:** walk/road overlays apply only outside legacy, cannot mutate immutable layers, stale bases fail closed, overlays cannot authorize construction.
- **Chunk/RLE negatives:** negative/zero/overlength/underlength counts, negative/fractional/boolean values, empty RLE, unknown layer values, missing required layers, chunk identity/alignment/bounds/path/manifest mismatch, hash mismatch, legacy `build_permission=0` rejection.
- **Seam negatives:** missing/ocean seam connection fails `SEAM_DISCONNECT`; protected-clearance seam fails `SEAM_PROTECTED`.
- **Pacing audit:** journeys resolve, capability grants are modeled, early home cost/node visits are bounded, post-14d goals are reachable with late caps, alternate detours exist, playtime remains `NOT_TESTED`.
- Existing negative mutations: duplicate ID, uphill river, orphan node, emptiness, novice starvation, long-run removal, chunk hash, moved entrance, mid-bypass, trunk disconnect.

## Godot 4.7 isolated reader

- Local Godot binary: unavailable. Release asset download failed (`release-assets.githubusercontent.com` SSL). PyPI does not provide a Godot engine binary (`godot` is an unrelated DOT-language package).
- A1-owned CI fixture: `tests/survival/world/godot/` + `.github/workflows/survival-world-reader.yml`.
- CI run: `SURV-050A World Reader` push run **40872678698** @ `ea64df75d251a5e7dee08dd919a78667250b772c` — **success**. Python authoring/schemas/pacing/pytest/determinism job success; Godot 4.7 isolated reader import/test/anti-vacuity/artifact-upload steps success. See `ci_evidence.json`.
- Raw CI log/artifact ZIP retrieval was blocked by sandbox egress (`results-receiver` / Azure blob EOF); GitHub job/step conclusions are authoritative. The anti-vacuity gate requires the PASS phrase and ≥50 assertions.
- The fixture is read-only and isolated. It does not boot the production overworld, SaveService, or A0 paid-construction transaction. The A0 delegate is a contract stub; native paid-home integration is a separate A0 gate.

## What this does not prove

- No native continent controller, camera, Knight movement, occlusion, prop collision reconciliation, POI/resource spawning, hazard damage, or SaveService round-trip was executed.
- `walk` is a proposed traversal layer; A0 must reconcile it with production solid RLE and lower-body prop collision before any playable claim.
- Pacing numbers are foot-equivalent travel estimates along authored polylines plus straight-line site detours. Combat, crafting, gathering animation, inventory friction, boat speed and day-equivalent playtime are **NOT_TESTED**.
- Pillow previews are authored design renders, not engine screenshots.
- Early buffer route intersects legacy crown heat/rot hazard rects; A6 must clue these and A0/A3 must decide early mitigation/alternates. This is an authored tuning gate, not a native damage claim.

Native playable integration remains `false`.
