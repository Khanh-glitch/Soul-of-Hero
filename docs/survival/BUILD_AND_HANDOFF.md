# VEYRA GOLD — Build / Run Path & Handoff

**Branch:** `arena/aa37e527-soul-of-hero` (dedicated conversion branch, unmerged)
**HEAD commit:** `5214788933b1a827f3a177d11ff486433dfe5e8a` (main)
**Map canon branch:** `map/veyra-gold-asset-canon-20261102` (source of
`VEYRA_GOLD_MAP.sohmap.json`)
**Engine:** Godot 4.7 (`project.godot`, GL Compatibility, 640×360 viewport)

---

## Build / run

### 1. Generate world data + preview scene
```
cd /home/user/Soul-of-Hero
python3 tools/generators/veyra_gold_converter.py
```
Outputs:
- `data/content/levels/veyra_gold/veyra_gold_world.json` — engine-agnostic
  GOLD-derived data; every original ID + field preserved.
- `game/levels/veyra_gold_world.tscn` — Godot 4.7 preview scene
  (`Node2D` root + `OverviewCamera` + `Sprite2D` terrain + vector overlays for
  every class). Terrain texture reference:
  `res://assets/environment/veyra/veyra_terrain_render.png`.

### 2. Render terrain art
Requires Pillow in an isolated venv (system PIP blocked by PEP 668):
```
python3 -m venv /tmp/sor-env
/tmp/sor-env/bin/pip install pillow
/tmp/sor-env/bin/python3 tools/generators/render_terrain.py
```
Output: `assets/environment/veyra/veyra_terrain_render.png` (2000×1400,
nearest-neighbor, Cainos 16 px top-down grass/stone tiles, deterministic from
`terrain.elev`/`terrain.biome`).

### 3. Review screenshot
```
/tmp/sor-env/bin/python3 tools/generators/make_review_screenshot.py
```
Output: `docs/survival/screenshots/veyra_gold_review.png` (native 2000×1400,
all classes composited).

### 4. Browser review tool (live preview)
```
python3 -m http.server 8080 --bind 0.0.0.0
```
Open the proxied preview at `https://8080-{sandboxId}.e2b.app/tools/review/veyra_review/index.html`.
Features: per-class visibility toggles, ID/name search, zoom/pan, hover
inspector showing original GOLD ID + all fields, native-resolution PNG export.
Loads `../../../data/content/levels/veyra_gold/veyra_gold_world.json` via
`fetch` (must be served over HTTP, not `file://`).

### 5. Contract tests
```
python3 tools/tests/veyra_gold_contract_test.py
```
3,504 checks, 0 failures. Verifies source-vs-contract counts/IDs/coords/refs and
that converted data is field-identical to the source canon (all original IDs
preserved).

---

## Reusable design modules

| Module | Purpose |
|--------|---------|
| `tools/generators/veyra_gold_converter.py` | Source canon → world.json + .tscn; full contract validation |
| `tools/generators/render_terrain.py` | terrain.elev/biome → pixel-art terrain PNG |
| `tools/generators/make_review_screenshot.py` | world data → composited review screenshot PNG |
| `tools/tests/veyra_gold_contract_test.py` | standalone contract test suite (pure Python) |
| `tools/review/veyra_review/index.html` | browser review tool (single-file HTML/JS) |

Each module derives paths from `__file__` so it runs from any clone of the repo.

---

## Handoff

### What is ready for creator review
1. **Source canon archived locally** — verbatim `VEYRA_GOLD_MAP.sohmap.json` at
   `data/survival/veyra_gold_map.source.json` (all 41 chunks retrieved; terrain
   elevation + biome base64 rasters complete).
2. **GOLD-derived world data** — `veyra_gold_world.json`, all 12 classes at
   contract counts, original IDs intact, field-identical to source.
3. **Godot preview scene** — `veyra_gold_world.tscn` opens in Godot 4.7 and
   shows the full world with an overview camera.
4. **Browser review tool** — inspect every object with its original GOLD ID;
   export screenshots.
5. **Art base layer** — `veyra_terrain_render.png` (2000×1400 pixel terrain
   from Cainos 16 px top-down atlases).
6. **Tests + screenshot** — 3,504 passing checks; native-res review PNG in
   `docs/survival/screenshots/`.

### What remains (creator art/design decisions — not micromanagement)
- **Final per-biome tile assignment** for the 250×175 terrain grid (the current
  render uses grass/stone placeholder mapping keyed to elev/biome; replace with
  the approved biome tile set).
- **POI/elder/zone sprite placement** — footprints and rings are preserved as
  data; actual sprite instances (foot/root footprint only, no full-canopy
  blockers) are a scene-authoring step.
- **Native visual acceptance** — not declared unilaterally; creator signs off
  after review of the branch.
- **Integration** — this branch is intentionally **unmerged**; do not merge into
  production or modify A0/A1/A3/A6/AVFX without coordination.

### Branch/commit IDs for traceability
- Working branch: `arena/aa37e527-soul-of-hero`
- Base commit: `5214788933b1a827f3a177d11ff486433dfe5e8a` (main)
- Map canon branch: `map/veyra-gold-asset-canon-20261102`
- All deliverables committed on `arena/aa37e527-soul-of-hero`, unmerged.
