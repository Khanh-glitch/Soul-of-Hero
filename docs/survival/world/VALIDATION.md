# Validation Evidence — SURV-050A

Status: static/data validation passed. Native Godot gameplay validation **not run**.

## Commands

```bash
python3 tools/survival/worldgen/compile_plan.py
python3 tools/survival/worldgen/make_schemas.py
.venv/bin/python tools/survival/worldgen/validate_world.py
.venv/bin/python -m pytest tests/survival/world -q
python3 tools/survival/worldgen/check_determinism.py
.venv/bin/python tools/survival/worldgen/preview.py
```

## Results

- Compiler: `ok = true`.
- Masterplan SHA-256: `46eb504b44a2b18e25a807aae875e9002ce63fc92ab6975e20466db212928715`.
- Deterministic double-compile tree SHA-256: `77e71e19c5da2b05cc3305955c17aef5a825ff6a22d3aebbadb5ff97704fab9a` (208 JSON artifacts). See `determinism_report.json`.
- Structural validator: `ok = true`, 0 errors. See `validation_report.json`.
- JSON Schema validation: 10 schemas emitted; all validated objects PASS.
- Pytest: `18 passed`. See `pytest_report.txt`.
- Previews: 8 PNGs + `previews/preview_manifest.json`.

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
| Capability access counts | novice 38, mid 99, late 108 |
| Empty-space ratio (>64 tiles from anchor) | 0.0115 |
| Max distance to meaningful anchor | 80.99 tiles |
| Long-run post-14d goals | 5 |

## Test coverage

- Masterplan validator + JSON schemas.
- Exactly ten legacy entrances preserved; thresholds/cells match baseline lock; fresh-save baseline flood reaches every threshold with shortcuts closed.
- Physical accessibility from spawn for every new POI, resource node, and seam carve endpoint.
- Resource distribution: every region has sources; every POI material has a world source; novice staple loop (timber/stone/iron/fibre/salvage) is open; no new nodes inside the preserved inset; renewal policies present.
- POI density and emptiness: ≥5 new POIs per region, ≥80 total, empty ratio ≤5%, max anchor distance ≤96 tiles, ≥3 long-run goals, ≥20 late POIs.
- Alternate routes: removing any single trunk edge keeps the hub network connected; boat/pass alternates exist.
- Three counterfactuals: novice finds value; midgame cannot open late core/specimen vaults; endgame retains post-14d goals and late discovery.
- Negative mutations fail closed: duplicate ID, seam into protected clearance, uphill river, orphan resource node, excessive emptiness, novice starvation, missing long-run goals, chunk hash mismatch, moved legacy entrance, mid-bypass of a late core vault, trunk disconnect.

## What this does not prove

- No native Godot 4.7 runtime, camera, Knight movement, occlusion, prop collision, POI spawning, or SaveService round-trip was executed.
- Godot binary download failed (`release-assets.githubusercontent.com` SSL). Existing `workflow_dispatch` CI workflows were not triggered by A1.
- `walk` is a proposed traversal layer; A0 must reconcile it with production solid RLE and lower-body prop collision before any playable claim.
- Pillow previews are authored design renders, not engine screenshots.

Native playable integration remains `false`.
