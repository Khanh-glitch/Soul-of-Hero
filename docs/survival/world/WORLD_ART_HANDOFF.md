# A1 Survival World Art — implementation handoff

Status: `VISUAL_ONLY_ISOLATED_PRESENTATION_NOT_PRODUCTION_MOUNT`  
Owner: A1 World Architect / Lead World Visual Direction  
Branch: `arena/e385312a-soul-of-hero` · PR: https://github.com/Khanh-glitch/Soul-of-Hero/pull/20  
Production native playable: **false**. A0 alone mounts production scenes.

## What actually shipped

This is a reusable visual-only world art system, not a moodboard: baked atlas, causal macro-terrain treatments, hardened Godot presentation node, driven-corridor overlay proof, A8 compact-shell visual skins, validators/tests, and native capture fixtures.

- `assets/environment/survival_world/terrain.png` — **238** 16×16 terrain frames: ash, moor, soil, grass, forest, snow, tundra, basalt, gravel, water, ice; stepped 2 px blends; dirt/stone road overlays; shore banks; maintained court. Ground marks are low-contrast material clusters, not per-pixel static.
- `assets/environment/survival_world/props.png` — **45** unscaled prop/structure frames: supply caches, deadfall/stump, handcart, tarp shelter, open Ashen Waystation awning, banners/lamps, fences, cairns, skarn ore, moonleaf herb, log pile, Amber watch/apothecary, Frost shrine, mill wheel/house, quarry workface, orchard shed, drying rack, beehive, snow drift, split rail, whetstone, light pool, plus **9 pinned inherited original SOH frames** reused without scaling.
- `data/survival/world/art/atlas.v1.json` — grid-aligned terrain atlas, prop rects, inherited-frame provenance, pixel/file SHA-256.
- `data/survival/world/art/world_art_grammar.v1.json` — shared material culture, semantic roles, biome profiles, lighting profiles, production rules. Macro-terrain boundaries are authored causal landforms; tile hash only selects a texture variant inside an already-authored material.
- `data/survival/world/art/crown_roadside.treatment.v1.json` — visual-only overlay pinned to the accepted corridor (`9d3909b0…`). It replaces corridor decor visuals, dresses the three canonical roadside caches and Waystation forecourt, and adds warm return-route markers, deadfall/stump/reeds/rail scenery. **No collision, stand, cache identity, reward or save change.**
- `data/survival/world/art/biome_studies.v1.json` — Amberwood apothecary/herb margin and Frost Crown shrine/skarn windows. No new POIs; harvestable visuals are pinned to canonical resource nodes.
- `data/survival/world/art/compiled/*.presentation.v1.json` + `presentations.v1.json` — runtime data: opaque ground rows, road/bank overlays, y-sorted props, warm lights, capture views, ambient day/night colors, landform report, SHA pins.
- `game/world_art/world_art_presentation.gd` + `world_art_ambient.gdshader` — atomic load validation, idempotent rebuild/clear, focus rebinding, per-frame occlusion stepping, real collision/area/TileSet physics counts, road/bank overlays, private world-light cull mask, and reuse of `OverworldOcclusion`. It creates **zero collision bodies** and does not tint inherited Gold/Hero VFX.
- `data/survival/world/art/a8_visual_contract.v1.json` + `a8_shell_visuals.v1.json` — executable A8 conformance target and compact 128×128 Quarry/Orchard/Mill visual skins. A8 keeps collision/entry/interaction; A0 alone mounts.

## Causal macro-terrain

The compiler no longer uses noise to decide biome material boundaries. Each treatment declares landforms with a reason and source reference:

- **Ashen Crown:** caldera ash fan, south-west moor drainage, postern ruin shoulder, maintained station court and supply layby. Impassable source mass reads as basalt; warning cairn/rock explain the old closure without a new blocker.
- **Amberwood:** old-moraine terrace, tended apothecary garden, shaded moonleaf forest margin. Orchard rows, drying rack, beehive and split rail mark human care; herb visuals remain pinned to `src_amber_herb` nodes.
- **Frost Crown:** glacial cirque snowfield, wind-scoured basalt arête, skarn exposure, shrine court. Lee-side pines, snow drifts and warning cairns communicate exposure; ore visuals remain pinned to `src_frost_skarn` nodes.

Roads are transparent overlays on opaque base ground, so road edges no longer create black-cornered replacement tiles. The validator checks landform reasons/cells, road overlay counts, and that no road frame is baked into the ground row.

## First-hour pilot readability

The Crown treatment distinguishes:

- **Supply location:** worked iron + cloth latch + plank cache body; state frames exist but reward authority remains A3.
- **Ordinary harvestable:** natural material clusters (deadfall/stump/fern/herb/ore/tree), no container latch and no shelter roof.
- **Major Waystation:** large open awning + counter + warm lamps + maintained court + banners; visually larger than any container.
- **Background scenery:** lower-contrast dead trees, bush, small rocks, cairns, reeds, split rail; no latch/lamp/counter.
- **Physical danger / restricted access:** broken wall/column mass and rust warning cairn beside the route; no arbitrary red border and no fake interactable gate.
- **Return route:** maintained dirt road, signpost, handcart, repeated warm markers and shelter silhouette leading back to the postern.

The accepted corridor geometry/identities are **not rebuilt**. The treatment is a visual overlay pinned by SHA; the compiler rejects stale corridor pins, cache visuals that drift from canonical instance cells, and props placed on required nav cells.

## Runtime hardening and Gold isolation

- `load_presentation()` validates schema, tile size, visual-only authority, ground dimensions, every terrain/prop/overlay frame, prop feet anchors, scale=1, and light positions before replacing the loaded document. Invalid data fails atomically.
- `build()` is idempotent; `clear()` releases occlusion materials and frees only A1-owned children. `bind_focus()` rebinds after the host reparents the Hero into the y-sorted prop root.
- `_process(delta)` steps `OverworldOcclusion`; sprites carry `frame_name` meta so landmark/vegetation/architecture fade classes are correct.
- `stats()` counts actual `CollisionObject2D`, `Area2D`, and TileSet physics layers under the presentation, excluding the bound Hero. It no longer hardcodes zero.
- World ground/props/overlays use `WORLD_LIGHT_MASK = 2`; A1 lamps use the same private cull mask. Inherited Gold/Hero VFX remain on default mask `1` and are never ambient-tinted by A1 day/night.

## A8 compact-shell alignment

A8 PR #26 now supplies 128×128 overworld shells with action socket `(64,64)` and entry portal `(64,108)`. A1 supplies `a8_shell_visuals.v1.json`: 8×8 shared-atlas ground, road overlays, unscaled landmarks/props, and a clear doorway rect. Quarry uses the workface/rock/cart grammar; Orchard uses shed/orchard/drying rack/beehive; Mill uses house/wheel/cart/log pile. The skins are **visual only**: A8 keeps collision/entry/interaction, A0 approves mount mode and preserves global coordinates. The 960×600 worksites remain interior/local.

`a8_visual_contract.v1.json` records PR #26 head `5ccf7b3f` and divergences A8-VIS-01…07, including the new compact-shell primitive-draw divergence. A1 supplies conformance data only.

## Asset / license decisions

- **Used:** original SOH art baked by `build_world_art.py`; nine inherited original frames from `assets/environment/overworld/overworld_props.png` reused unscaled. File and pixel SHA-256 are pinned in the atlas manifest.
- **Drive verified, not imported:** Google Drive connector was enabled this turn. Folder `1pRNobw2FrKWQmelMdGpGnh3PUHPijjA0` metadata lists 43 CraftPix ZIPs. One candidate, `craftpix-net-574220-free-path-and-road-top-down-pixel-tileset.zip`, was downloaded into the private workspace and byte-verified: size **1,205,980**, MD5 `ff7fe573a16faf9e8fca62ad703527ff`, SHA-256 `302e8fa1da79163d2cd9da5ddfd7610bb0186b16de7f959b7d9a09ee4763e43c`. Its `license.txt` points to https://craftpix.net/file-licenses/; the Freebie terms permit use/modification in games and forbid source-file redistribution. Decision: **REJECT_IMPORT_STYLE_MISMATCH** — bright cartoon cobble/grass palette and outline density do not match the muted SOH survival ramp. Raw ZIP stays out of Git; no CraftPix bytes are committed.
- **Rejected:** Cainos demo art (bright fantasy palette, non-integer scaling in A8 prototype, standalone license unproven). No Cainos bytes imported.
- **Reference only:** GDQuest persistent-sector pattern (MIT code / CC-BY art) and Godot demo `2d/dynamic_tilemap_layers` (MIT). No art imported from either.
- The two user-fixed bald avatars are untouched.

## Verification

Local (this follow-up):

- `pytest tests/survival/world -q` → **113 passed**.
- `validate_world.py`, `validate_slice.py`, `validate_connector.py`, `validate_corridor.py`, `validate_world_art.py` → **0 errors**.
- `validate_handoff.py` → PASS (13 tracked tasks); `validate_atlas_contract.py` → PASS (source SHA `b958de0f…`).
- `check_determinism.py` → **ok**, 246 artifacts, tree SHA `a833e5f93e88667ce8521d6afb5b29a8cf96dd0beb6693122139961e6d7997cd`.
- `gdparse game/world_art/world_art_presentation.gd tests/survival/world/world_art_native_test.gd tests/survival/world/corridor_native_test.gd` → clean.
- Pillow/atlas composition previews rendered and personally inspected: `docs/survival/world/evidence/world_art_*.png`, `world_art_views_contact.png`, `a8_shell_*_pillow.png`, `a8_shells_contact.png`. These are **not native Godot evidence**.

Native:

- `world_art_native_test.gd` loads the real pinned Knight as a physics/scale proxy, proves zero added collision before and after foot-sort reparent, tests atomic invalid-load rejection and idempotent rebuild, steps occlusion, checks inherited VFX light-mask/tint isolation, captures 1280×720 / 2560×1440 / 3840×2160 frames, and requires integer-downscaled logical pixel hashes to match across resolutions.
- `corridor_native_test.gd --world-art` drives the real Knight through the accepted corridor with the art overlay mounted over real connector/container collision, then captures driven-position art frames at 720p/1440p/2160p. It does not teleport for the navigation proof.
- CI job `A1 GODOT 4.7 WORLD ART NATIVE VISUAL FIXTURE (NOT PRODUCTION)` runs both fixtures under Xvfb 3840×2160 with anti-vacuity gates.
- At this follow-up refresh, current-head World Reader runs **41026150160 / 41026143600** at `2f6edd3f` had Python SUCCESS but native jobs still **queued**; only Python evidence artifacts existed. Native captures remain **NOT_TESTED** until CI runs and the captures are personally inspected. No native PASS is claimed here.

## Reproduce

```bash
.venv/bin/python tools/survival/worldgen/build_world_art.py
.venv/bin/python tools/survival/worldgen/compile_world_art.py
.venv/bin/python tools/survival/worldgen/validate_world_art.py
.venv/bin/python tools/survival/worldgen/preview_world_art.py
.venv/bin/python tools/survival/worldgen/preview_a8_shells.py
.venv/bin/python -m pytest tests/survival/world -q
.venv/bin/python tools/survival/worldgen/check_determinism.py
.venv/bin/gdparse game/world_art/world_art_presentation.gd tests/survival/world/world_art_native_test.gd tests/survival/world/corridor_native_test.gd
```

Native CI: `.github/workflows/survival-world-reader.yml` → `godot-world-art-native`.

## Owner dependencies

- **A0:** mount the presentation in production only after native visual review; keep SaveService/construction/Gold untouched; preserve exact corridor collision/stands; approve A8 shell mount mode.
- **A3:** bind `si:r_ashen_crown:roadside_supply:*` economics and cache state authority; art state frames are ready but do not set rewards/rates.
- **A8:** adopt/reject `a8_shell_visuals.v1.json` for compact shells; keep interaction engine and creative control; local worksite art remains A8-owned.
- **A6:** hazard/capability labels remain authored data; no HUD/UX change here.
- **CT:** accept/reject the visual quality bar after native captures; Drive candidate was byte/license verified and rejected for style, not silently imported.
