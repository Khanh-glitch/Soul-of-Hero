# Validation Evidence — SURV-050A (review corrections)

Status: authored-data validation passed locally. Product-correction checkpoint adds novice hazard bootstrap, A1/A3 material decisions and truthful POI readiness. Previous isolated Godot 4.7 reader CI passed at `ea64df75`/`da93be3c`; product-correction CI passed at `b9c81fdb` (push run 40889886618, PR run 40889899260). Native continent gameplay validation remains **NOT_TESTED**.

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
- Masterplan SHA-256: `fc5412dfd9651e0b73f65159d686a39b9ec9a3eebac6fb92c9cedd1984175af4`.
- Deterministic double-compile tree SHA-256: `29e0cbf05f442929df676ce7bbd1c91087b49fe923f586c83683cd371a9ae77f` (221 JSON artifacts). See `determinism_report.json`.
- Structural validator: `ok = true`, 0 errors. See `validation_report.json`.
- JSON Schema validation: 15 schemas emitted; all validated objects PASS (including hazard_damage, novice_bootstrap, material_decisions, poi_authoring).
- Pytest: `56 passed`. See `pytest_report.txt`.
- Pacing audit: 11 concrete journeys resolve; first-hour safe preparation/retreat has zero authored hazard exposure; `AUTHORED_ESTIMATE_NOT_PLAYTESTED`. See `PACING_ANALYSIS.md` and `data/survival/world/pacing_analysis.json`.
- Previews: 9 PNGs regenerated; routes/starter/novice-bootstrap detail visually inspected; `previews/preview_manifest.json`.
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
| Route edges | 130 (22 trunk + 108 spurs; includes safe first-hour approach) |
| Chunks | 192 × 64×64 |
| Physically reachable new POIs | 108 / 108 |
| Capability access counts | novice 39, mid 99, late 108 |
| Empty-space ratio (>64 tiles from anchor) | 0.0115 |
| Max distance to meaningful anchor | 80.99 tiles |
| Long-run post-14d goals | 5 |
| POI content readiness | 106 site-contract-only, 2 interaction-spec-authored-not-native, 10 preserved baseline |

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
- **Novice hazard bootstrap:** safe approach has zero authored hazard exposure and walkable sampled cells; hazardous shortcut remains filter-gated and exposed; first-hour journey grants salvage/power/filter and retreats; no circular bootstrap material; removing safe route forces a long safe detour, not the hazard shortcut.
- **Material decisions:** 8 explicit alias decisions and 12 explicit missing items; provenance/renewal/sinks preserved; negative schema mutation fails.
- **POI readiness:** truthful counts; two distinct early exemplars validate against `poi_authoring` schema; relay first-hour power does not require missing copper; missing spec ref fails validator.
- Existing negative mutations: duplicate ID, uphill river, orphan node, emptiness, novice starvation, long-run removal, chunk hash, moved entrance, mid-bypass, trunk disconnect.

## Godot 4.7 isolated reader

- Local Godot binary: unavailable. Release asset download failed (`release-assets.githubusercontent.com` SSL). PyPI does not provide a Godot engine binary (`godot` is an unrelated DOT-language package).
- A1-owned CI fixture: `tests/survival/world/godot/` + `.github/workflows/survival-world-reader.yml`.
- CI run: `SURV-050A World Reader` push run **40872678698** @ `ea64df75d251a5e7dee08dd919a78667250b772c` — **success**. Product-correction push run **40889886618** @ `b9c81fdb38325276b05f8d98a571bc787c54ccfe` and PR run **40889899260** — **success**. Python authoring/schemas/pacing/pytest/determinism job success; Godot 4.7 isolated reader import/test/anti-vacuity/artifact-upload steps success, including product-consumption checks. See `ci_evidence.json`.
- Raw CI log/artifact ZIP retrieval was blocked by sandbox egress (`results-receiver` / Azure blob EOF); GitHub job/step conclusions are authoritative. The anti-vacuity gate requires the PASS phrase and ≥50 assertions.
- The fixture is read-only and isolated. It does not boot the production overworld, SaveService, or A0 paid-construction transaction. The A0 delegate is a contract stub; native paid-home integration is a separate A0 gate.

## What this does not prove

- No native continent controller, camera, Knight movement, occlusion, prop collision reconciliation, POI/resource spawning, hazard damage, or SaveService round-trip was executed.
- `walk` is a proposed traversal layer; A0 must reconcile it with production solid RLE and lower-body prop collision before any playable claim.
- Pacing numbers are foot-equivalent travel estimates along authored polylines plus straight-line site detours. Combat, crafting, gathering animation, inventory friction, boat speed and day-equivalent playtime are **NOT_TESTED**.
- Pillow previews are authored design renders, not engine screenshots.
- Early buffer route intersects legacy crown heat/rot hazard rects; A6 must clue these and A0/A3 must decide early mitigation/alternates. This is an authored tuning gate, not a native damage claim.

Native playable integration remains `false`.

## Vertical-slice contract validation

- `compile_slice.py` emits `data/survival/world/vertical_slice/` from the existing plan/specs without regenerating the continent.
- `validate_slice.py` checks 5 slice documents against 4 new schemas, pinned world identity, chunk-backed required nav, obstacle/doorway clearance, spawn policy, exact A3 IDs, reward ownership, research firewall and all 7 required adversarial vectors. Local result: 0 errors, 10 vectors.
- `pytest tests/survival/world`: **74 passed** (56 prior + 18 slice tests), including executable Python reference vectors and negative obstacle/failed-action/duplicate/reload/hidden-projection cases.
- `check_determinism.py` now double-compiles plan + slice: **230 artifacts**, tree SHA `429f0fabe8ff950918b32ff97e358a3eb8e68106d92a64cc64e40e57ca64c123`.
- CI runs the isolated Godot 4.7 slice reader/reducer (`slice_test.gd`) with PASS phrase `SURVIVAL SLICE CONTRACT PASSED` and an anti-vacuity gate of ≥120 assertions. Push run **40903943412** and PR run **40903953241** @ `ec9edecbc7fbf10b43753502cd6f56977fb09800` are **success**, including slice compile/validate, Python 74 tests, determinism, Godot chunk reader, Godot slice vectors and both anti-vacuity gates. Local sandbox has no Godot; CI job/step conclusions are authoritative.
- The slice fixture does not claim Hero movement, combat, damage, production SaveService persistence, A3 EconomyService integration or A6 UI mounting.

## Canonical geography connector validation

- `compile_connector.py` reads pinned legacy world/layers/props + unchanged A1 chunk6:3 and emits A1-owned contract/delta plus derived pilot inputs under `artifacts/a1-connector/`. It does not edit A0 legacy sources, controller, SaveService or A1 chunks.
- `validate_connector.py` fail-closed checks source pins, exact 46 collision / 48 dressed / 14 prop delta, locker-stand collision correction, protected legacy content separation, composed legacy preservation outside the mouth, annex walk identity, fail-closed padding, one-chunk import, canonical reward lock and `native_playable=false`.
- Local result: connector validation **0 errors**; `pytest tests/survival/world` **82 passed** (74 prior + 8 connector tests); world/slice validators pass; determinism **232 artifacts**, tree SHA `39b9f2535519f0080cf5809d073eb159f33ccdc3126603906fee6456192225c2`.
- CI adds `godot-connector-native`: root-project Godot 4.7 fixture with real Knight scene, live `PhysicsShapeQueryParameters2D` route verification and ordinary held movement Refuge → Waystation → Relay → Refuge, plus ten-endpoint reachability and camera-limit checks. It is an isolated composed-world fixture, **not** the production controller and **not** a native-playable claim. Result: **PASS** at `90c1d8bf` — push [40993737087](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40993737087) and PR [40993742640](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40993742640), including the connector anti-vacuity gate. This remains an isolated composed-world fixture, not production integration.
- A0 production acceptance (CN-07..10) remains pending: source-path injection, annex build guard, slice obstacle mount, fresh-save/reload global-pixel resume, exact rewards and rollback recovery.


## Locker-stand owner correction (2026-10-30)

- `validate_slice.py` now checks every action stand against the real 12×16 Hero body and authored obstacle collision footprints, plus interaction radius. It fails closed on the original full-tile locker overlap and passes the repaired 16×14 offset (0,-1) footprint.
- `validate_connector.py` locks the locker correction, stand `(408,199)`, anchor `(408,200)`, radius 24 and canonical rewards.
- Native fixture adds adverse original full-tile `intersect_shape` proof, repaired exact-stand clearance, interaction range, and ordinary-input Refuge → exact locker stand → Relay → Refuge. Result: **PASS** at `bc71b536` — push [40999023888](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40999023888) / PR [40999029445](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40999029445), including ≥20-assertion anti-vacuity, exact stand and adverse original proof. Production remains A0-owned; `native_playable=false`.

## First-hour corridor / A8 transform gate

Run:

```bash
python tools/survival/worldgen/compile_corridor.py
python tools/survival/worldgen/validate_corridor.py
python -m pytest tests/survival/world -q
python tools/survival/worldgen/check_determinism.py
```

The corridor gate checks durable class/region/instance/POI identity, multi-instance class semantics, zero new POIs, exact existing resource-node cells, walk/hazard/water clearance, live-shape stand clearance, adverse full-tile container overlap, return/revisit cells, A1 economy-field absence, inherited original art, valid detail masks, decor collision clearance, deferred-node preservation, and exact A8 transform/footprint/capability review. Negative tests mutate identity, cells, stands, economy fields, art, decor placement and A8 root transforms.

Native fixture: `corridor_native_test.gd` under Xvfb with the real Knight and ordinary input. It is isolated engineering evidence, not A3 loot integration, not SaveService production acceptance, and not human playtest. CI anti-vacuity requires at least 25 corridor assertions plus adverse-container and three-instance markers.

## 2026-10-30 world art visual production gate

Commands (local, branch `arena/e385312a-soul-of-hero`):

```bash
.venv/bin/python tools/survival/worldgen/build_world_art.py
.venv/bin/python tools/survival/worldgen/compile_world_art.py
.venv/bin/python tools/survival/worldgen/validate_world_art.py
.venv/bin/python tools/survival/worldgen/preview_world_art.py
.venv/bin/python -m pytest tests/survival/world -q
.venv/bin/python tools/survival/worldgen/validate_world.py
.venv/bin/python tools/survival/worldgen/validate_slice.py
.venv/bin/python tools/survival/worldgen/validate_connector.py --out artifacts/a1-connector
.venv/bin/python tools/survival/worldgen/validate_corridor.py
.venv/bin/python tools/survival/validate_handoff.py
.venv/bin/python tools/survival/validate_atlas_contract.py
.venv/bin/python tools/survival/worldgen/check_determinism.py
.venv/bin/gdparse game/world_art/world_art_presentation.gd tests/survival/world/world_art_native_test.gd
```

Results:

- Atlas bake: 238 terrain frames, 38 prop frames, 9 inherited original frames; file/pixel SHA pinned.
- Art validator: 3 presentations, profiles `amberwood`, `ashen_crown`, `frost_crown`, 0 errors.
- Pytest: **109 passed** (101 prior + 8 world-art).
- World/slice/connector/corridor validators: 0 errors; canonical rewards unchanged; 118 POI rows / 108 authored preserved.
- Handoff: PASS, 13 tracked tasks. Atlas contract: PASS, source SHA `b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157`.
- Determinism: ok, **245 artifacts**, tree SHA `d50f4f900b7564235caba58491102b9b70d16110781c4d2fa0e606e97ecd3a37`.
- gdparse: clean.
- Pillow/atlas previews: rendered and personally inspected; **not native evidence**.
- Native: CI job `godot-world-art-native` added (Xvfb 3840×2160, captures 720p/1440p/2160p, anti-vacuity ≥30 assertions / ≥12 captures / failures=0 / zero collision bodies). Specified runs 41020340273 / 41020347365 still queued at authoring time; native captures **NOT_TESTED**. No production mount.
