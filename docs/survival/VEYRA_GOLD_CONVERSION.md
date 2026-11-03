# VEYRA GOLD → SOH World Conversion

**Source of truth (creator-approved):** `data/survival/veyra_gold_map.source.json`
— the `VEYRA_GOLD_MAP.sohmap.json` canon retrieved from branch
`map/veyra-gold-asset-canon-20261102` (commit `5214788` is this repo's HEAD;
the map canon lives on the dedicated map branch). Status in canon: *"GOLD MAP
DESIGN - PAPER ONLY - NOT NATIVE PRODUCTION"*. World: **2000 × 1400 authoring
units**.

**This conversion never replaces GOLD Map Studio with the old in-game Godot
map, never moves/removes/reinterprets a creator-approved geographic object, and
never invents free resources/loot/gates/unlocks.** A0/A3 economy rules are
preserved (every resource carries `gate: "none"` — gating is data, not free
loot).

---

## 1. Conversion contract enforced

Every object class from `REAL_MAP_CONVERSION_CONTRACT.md` is present with the
exact count, and every original GOLD ID is preserved verbatim:

| Class | Count | ID prefix | Geometry |
|-------|-------|-----------|----------|
| land | 8 | `ld_` | closed rings (main continent + 8 satellites/islets) |
| terrain | 250×175 cell=8 | — | elevation `elev` (0–243) + biome `biome` (0–11), base64 rasters |
| lakes | 5 | `lk_` | ring |
| rivers | 17 | `rv_` | polyline + width + mouth/source refs |
| roads | 92 | `rd_` | polyline (kind=cart) |
| bridges | 12 | `br_` | point `at` + angle + load (cart/foot) |
| docks | 27 | `dk_` | point `at` + water (sea / lake / river ref) |
| pois | 81 | `po_` | point `at` + footprint `foot` + archetype + depth |
| zones | 23 | `bz_` | ring |
| resources | 280 | `rs_` | point `at` + radius `r` + kind + dens + gate |
| spawns | 4 | `sp_` | point `at` + region |
| elders | 6 | `el_` | outer ring + elder name |
| labels | 24 | `lb_` | point `at` + text + size + style |

Terrain grid: `gw=250, gh=175, cell=8, seed=2026` — 43,750 cells; elevation
bytes 0–243, biome bytes 0–11. One authoring unit = one engine pixel at native
scale (1:1); the 8×8 cell grid maps exactly onto the engine world grid. The
16 px dungeon `TILE_SIZE` is dungeon-only and is **not** applied to this
overworld (no stretched overview textures as terrain substitutes).

## 2. Art profile (pixel-art contract)

- **Canvas:** 2000 × 1400 at 1:1 (engine pixels). Nearest-neighbor filtering
  only (`filter = false`); no Canvas strokes, no oversized symbols, no blended
  or stretched overview textures used as terrain.
- **Perspective consistency:** all terrain/prop art comes from the Cainos
  top-down 16 px atlas family (`assets/environment/ocean_cainos/*`,
  `assets/environment/cainos_demo/*`) — a single twin perspective; no
  incompatible sprite perspective mixing within the scene.
- **Terrain render:** `assets/environment/veyra/veyra_terrain_render.png`
  (2000×1400) is generated deterministically from `terrain.elev` +
  `terrain.biome` using the grass/stone 16 px tiles: water/lowland → grass
  edges, mid → grass, hills → shaded grass, high → stone/rock. It is a review
  base layer; final per-biome tile assignment is a creator art decision.
- **Footprints only:** POI footprints (`foot`) and elder `outer` rings are
  drawn as outlines; no full-canopy tree blockers. Deep/interior (`deep`) is
  data only.
- **Overlays:** all non-terrain geography is vector (Line2D/Polygon2D/Label2D)
  in `game/levels/veyra_gold_world.tscn` so the original rings/points survive
  exactly — nothing is rasterized away.

## 3. Deliverables

| Deliverable | Path |
|-------------|------|
| Source canon (verbatim GOLD JSON) | `data/survival/veyra_gold_map.source.json` |
| GOLD-derived world data (original IDs) | `data/content/levels/veyra_gold/veyra_gold_world.json` |
| Godot 4.7 preview scene | `game/levels/veyra_gold_world.tscn` |
| Terrain render (pixel art, 2000×1400) | `assets/environment/veyra/veyra_terrain_render.png` |
| Browser review tool | `tools/review/veyra_review/index.html` |
| Contract test suite | `tools/tests/veyra_gold_contract_test.py` |
| Converter (reusable module) | `tools/generators/veyra_gold_converter.py` |
| Terrain renderer (reusable module) | `tools/generators/render_terrain.py` |
| Review-screenshot renderer (reusable module) | `tools/generators/make_review_screenshot.py` |
| Review screenshot | `docs/survival/screenshots/veyra_gold_review.png` |
| This design rationale | `docs/survival/VEYRA_GOLD_CONVERSION.md` |
| Build/run + handoff | `docs/survival/BUILD_AND_HANDOFF.md` |

## 4. What was deliberately NOT done (per user constraints)

- No SaveService / economy / parallel gameplay engine built.
- A0, A1, A3, A6, AVFX **not modified** (no coordination-free changes).
- No old in-game map substituted; no procedural islands.
- No free resources/loot/gates/unlocks bypassing A0/A3.
- Not merged into production; native visual acceptance not declared
  unilaterally; remains on a dedicated, unmerged branch for creator review.

## 5. Builder notes

Run the pipeline from the repo root:

```
python3 tools/generators/veyra_gold_converter.py        # world.json + .tscn
/tmp/sor-env/bin/python3 tools/generators/render_terrain.py   # terrain PNG
/tmp/sor-env/bin/python3 tools/generators/make_review_screenshot.py  # review PNG
python3 tools/tests/veyra_gold_contract_test.py          # 3504 checks, 0 failures
```

The browser review tool is served over HTTP (the JSON is loaded via `fetch`,
so `file://` is blocked by CORS):

```
python3 -m http.server 8080 --bind 0.0.0.0   # from repo root
# open https://8080-{sandboxId}.e2b.app/tools/review/veyra_review/index.html
```

It renders every class with toggles, per-class visibility, ID/name search,
zoom/pan, hover inspection (original GOLD ID + every field), and native‑res
PNG export.

## 6. Acceptance criteria mapping (REAL_MAP_CONVERSION_CONTRACT)

- Original GOLD geography + source IDs preserved ✅ (converted data is
  field-identical to source; 3,504 checks pass)
- All 12 contract classes at exact counts ✅
- Pixel-art contract (nearest-neighbor, single perspective, footprints only) ✅
- No SaveService/economy/parallel engine; A0–A3/A6/AVFX untouched ✅
- Dedicated branch, unmerged, creator-reviewable with reasoning + visual
  evidence ✅
