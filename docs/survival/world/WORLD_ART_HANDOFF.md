# A1 Survival World Art — implementation handoff

Status: `VISUAL_ONLY_ISOLATED_PRESENTATION_NOT_PRODUCTION_MOUNT`  
Owner: A1 World Architect / Lead World Visual Direction  
Branch: `arena/e385312a-soul-of-hero` · PR: https://github.com/Khanh-glitch/Soul-of-Hero/pull/20  
Production native playable: **false**. A0 alone mounts production scenes.

## What actually shipped

This is not a style guide or a moodboard. It is a small reusable art system, a baked atlas, three compiled visual treatments, an isolated Godot presentation node, validators/tests, and a native capture fixture.

- `assets/environment/survival_world/terrain.png` — **238** 16×16 terrain frames: ash, moor, soil, grass, forest, snow, tundra, basalt, gravel, water, ice; stepped 2 px blends; dirt/stone road masks; shore banks; maintained court.
- `assets/environment/survival_world/props.png` — **38** unscaled prop/structure frames: supply caches (closed/open/spent), deadfall/stump, handcart, tarp shelter, open Ashen Waystation awning, banners/lamps, fences, cairns, skarn ore, moonleaf herb, log pile, Amber watch/apothecary, Frost shrine, mill wheel, whetstone, light pool, plus **9 pinned inherited original SOH frames** reused without scaling.
- `data/survival/world/art/atlas.v1.json` — grid-aligned terrain atlas, prop rects, inherited-frame provenance, pixel/file SHA-256.
- `data/survival/world/art/world_art_grammar.v1.json` — shared material culture, semantic roles, biome profiles, lighting profiles, production rules.
- `data/survival/world/art/crown_roadside.treatment.v1.json` — visual-only overlay pinned to the accepted corridor (`9d3909b0…`). It replaces the eight corridor decor visuals, dresses the three canonical roadside caches and the Waystation forecourt, and adds warm return-route markers. **No collision, stand, cache identity, reward or save change.**
- `data/survival/world/art/biome_studies.v1.json` — two genuinely contrasting authored windows in existing regions: Amberwood apothecary/herb margin and Frost Crown shrine/skarn. No new POIs; harvestable visuals are pinned to canonical resource nodes.
- `data/survival/world/art/compiled/*.presentation.v1.json` + `presentations.v1.json` — runtime data: ground rows, bank overlays, y-sorted props, warm lights, capture views, ambient day/night colors, SHA pins.
- `game/world_art/world_art_presentation.gd` + `world_art_ambient.gdshader` — TileMapLayer ground, unscaled AtlasTexture sprites, bank overlays, warm PointLight2D pockets, A1-owned ambient shader, and reuse of `OverworldOcclusion.configure_sprites`. It creates **zero collision bodies**.
- `data/survival/world/art/a8_visual_contract.v1.json` — executable A8-compatible visual/spatial conformance target with specific PR #26 divergences. A8 keeps creative control and its interaction engine.

## First-hour pilot readability

The Crown treatment distinguishes:

- **Supply location:** worked iron + cloth latch + plank cache body; state frames exist but reward authority remains A3.
- **Ordinary harvestable:** natural material clusters (deadfall/stump/fern/herb/ore/tree), no container latch and no shelter roof.
- **Major Waystation:** large open awning + counter + warm lamps + maintained court + banners; visually larger than any container.
- **Background scenery:** lower-contrast dead trees, bush, small rocks, cairns; no latch/lamp/counter.
- **Physical danger / restricted access:** broken wall/column mass and rust warning cairn beside the route; no arbitrary red border and no fake interactable gate.
- **Return route:** maintained dirt road, signpost, handcart, repeated warm markers and the shelter silhouette leading back to the postern.

The accepted corridor geometry/identities are **not rebuilt**. The treatment is a visual overlay pinned by SHA; the compiler rejects stale corridor pins, cache visuals that drift from canonical instance cells, and props placed on required nav cells.

## Contrasting environmental identities

- **Ashen Crown:** ash/moor macro patches, dirt road, gravel court, dead trees/ruin stone, rust cloth, overcast grey-violet daylight and warm shelter pockets at night.
- **Amberwood:** grass/forest floor macro patches, tended soil garden, orchard/amber trees, ferns, moonleaf herb clusters, apothecary silhouette, amber morning light.
- **Frost Crown:** snow/tundra/basalt macro patches, stone road, frost pines, skarn ore, shrine soul-cyan accent, blue-hour light with readable night ambient.

These are not generic recolors: ground material sets, vegetation, structures and lighting profiles differ. The validator checks profile separation and the test suite checks ground-frame overlap is low and prop sets are disjoint between Amberwood and Frost Crown.

## A8 visual contract

`a8_visual_contract.v1.json` records executable requirements (16 px tile, 640×360 viewport, zoom 1, nearest filter, unscaled props, shared palette ramp, 16 px ground grid, tile-divisible export, collision readability, stepped blending, shared lighting) and specific PR #26 divergences:

- `A8-VIS-01`: rock_a 1.615×, rock_e 2.4×, cart/crate 3×, barrel 2.75× → replace with unscaled atlas frames.
- `A8-VIS-02`: Cainos tree 132×160 → 122×153 (~0.92×/0.96×) → reject import (license unproven + scale/palette mismatch).
- `A8-VIS-03`: flat ground rects / 48 px grid → use 16 px TileMapLayer.
- `A8-VIS-04`: per-site palettes → shared material culture.
- `A8-VIS-05`: 960×600 site (600/16 = 37.5) → local canvas may remain, export must align to 16 px.
- `A8-VIS-06`: invisible player probe / draw-only props → fine for isolated prototype, not production spatial proof.

A1 supplies conformance data only. A8 keeps its interaction engine, local creative control and reward actions; A0 alone mounts production.

## Asset / license decisions

- **Used:** original SOH art baked by `build_world_art.py`; nine inherited original frames from `assets/environment/overworld/overworld_props.png` reused unscaled. File and pixel SHA-256 are pinned in the atlas manifest.
- **Rejected:** Cainos demo art (bright fantasy palette, non-integer scaling in A8 prototype, standalone license unproven). No Cainos bytes imported.
- **Reference only:** GDQuest persistent-sector pattern (MIT code / CC-BY art) and Godot demo `2d/dynamic_tilemap_layers` (MIT) for runtime tile update / per-layer collision disable. No art imported from either.
- **Unavailable:** CT 43-pack Drive registry (`SOH_ASSET_LIBRARY_43_DRIVE_REGISTRY_20261030.json`) remains `NOT_IMPORTED`; Google Drive connector is disconnected in Arena. No import was fabricated. The two user-fixed bald avatars are untouched.

## Verification

Local (this checkpoint):

- `pytest tests/survival/world -q` → **109 passed** (101 prior + 8 world-art).
- `validate_world.py`, `validate_slice.py`, `validate_connector.py`, `validate_corridor.py`, `validate_world_art.py` → **0 errors**.
- `validate_handoff.py` → PASS (13 tracked tasks); `validate_atlas_contract.py` → PASS (source SHA `b958de0f…`).
- `check_determinism.py` → **ok**, 245 artifacts, tree SHA `d50f4f900b7564235caba58491102b9b70d16110781c4d2fa0e606e97ecd3a37`.
- `gdparse game/world_art/world_art_presentation.gd tests/survival/world/world_art_native_test.gd` → clean.
- Pillow/atlas composition previews rendered and personally inspected: `docs/survival/world/evidence/world_art_*.png` and `world_art_views_contact.png`. These are **not native Godot evidence**.

Native:

- `tests/survival/world/world_art_native_test.gd` loads the real Knight, builds each presentation, reuses OverworldOcclusion, asserts zero collision bodies, and captures 1280×720 / 2560×1440 / 3840×2160 frames.
- CI job `A1 GODOT 4.7 WORLD ART NATIVE VISUAL FIXTURE (NOT PRODUCTION)` runs under Xvfb screen 3840×2160 with an anti-vacuity gate (≥30 assertions, ≥12 captures, `failures=0`, zero-collision proof).
- At authoring time the specified World Reader runs **41020340273 / 41020347365** were still `queued` (repo-wide Actions backlog). The corridor native fixture has not executed. World-art native captures are therefore **NOT_TESTED** until CI runs and the captures are personally inspected. No native PASS is claimed here.

## Reproduce

```bash
.venv/bin/python tools/survival/worldgen/build_world_art.py
.venv/bin/python tools/survival/worldgen/compile_world_art.py
.venv/bin/python tools/survival/worldgen/validate_world_art.py
.venv/bin/python tools/survival/worldgen/preview_world_art.py
.venv/bin/python -m pytest tests/survival/world -q
.venv/bin/python tools/survival/worldgen/check_determinism.py
.venv/bin/gdparse game/world_art/world_art_presentation.gd tests/survival/world/world_art_native_test.gd
```

Native CI: `.github/workflows/survival-world-reader.yml` → `godot-world-art-native`.

## Owner dependencies

- **A0:** mount the presentation in production only after native visual review; keep SaveService/construction/Gold untouched; preserve exact corridor collision/stands.
- **A3:** bind `si:r_ashen_crown:roadside_supply:*` economics and cache state authority; art state frames are ready but do not set rewards/rates.
- **A8:** adopt/reject the visual conformance target for Quarry/Orchard/Mill; keep interaction engine and creative control; resolve footprint mismatch separately (`A8_SITE_TRANSFORM_CONTRACT.md`).
- **A6:** hazard/capability labels remain authored data; no HUD/UX change here.
- **CT:** accept/reject the visual quality bar after native captures; Drive 43-pack remains unavailable in Arena.
