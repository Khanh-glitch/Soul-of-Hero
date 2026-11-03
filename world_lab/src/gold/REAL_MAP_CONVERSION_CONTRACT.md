# Veyra Lab -> actual SOH playable world: exact conversion contract

## Source and authority
Read `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json` and `docs/survival/CURRENT_PRODUCT_CONTRACT.md`. Never confuse the authoring canvas coordinate (2000x1400) with native SOH tile coordinates (16px) or the 640x360 native camera. Coordinate transform must be explicit, deterministic and documented as a world-scale decision with measured journey times. Keep source object IDs in all outputs and expose roundtrip/debug lookups. Never infer that the 2000x1400 authoring units equal 2000x1400 native tiles.

## Object-class compiler
- `land[8]`: polygon rings and holes -> landmask, coast edge family, island identity, beach/bluff/shore constraints.
- `terrain`: raster 250x175 at cell=8 -> elevation + biome source **with original encoding decoded**, never stretch a single global terrain image. Validate decoded dimensions and layer-boundaries, tile transitions, slope/biome neighbors.
- `lakes[5]`: polygon -> water volume/surface and real navigability; shore segmentation, entry points, outlets, crossing constraints.
- `rivers[17]`: sampled polyline, width, nav segment flags, source/mouth references, waterfall/rapids/lock/weir -> rasterized channel and banks, confluence junctions, flow/collision, bridges/portage. Sample local elevation along entire river, not only endpoints. Check canal locks and artificial changes as *assumptions*, not unapproved gameplay law.
- `roads[92]`: polyline kind=`cart`/`trail`/`foot`/`riverside`/`ferry` -> traversal, slopes/footprints and route classes. Eight ferry paths need boats/boarding rules + owner contract; cannot become land roads.
- `bridges[12]`: bearing, load class, channel span and walk/cart collisions. Use real bridge sprite spans after verifying tile fit, never stamp arbitrary bridge over river.
- `docks[27]`: 17 coastal / 10 inland; physically reachable shore, boarding/disembark cells, water depth and land paths; functional asset not yet universally sourced.
- `pois[81]`: archetype, footprint and deep polygons, access/gates/retreat and real interaction semantics. A generic building sprite is not an implemented mill, powerplant, academy, deposit vendor, or escape point.
- `zones[23]`: buildable polygons -> placement legality after A0 protection/collision/route/resource/dynamic occupancy checks; no bank/public storage inference.
- `resources[280]`: kind + density + access -> durable source nodes owned by A3/A0, not random decorative sprites.
- `spawns[4]`: verified player size/safe route, no hard-coded single spawn.
- `elders[6]`: outer/core/arena/approach/POI with recognizable location-first Surtur/Typhon/Aion/Atlas/Argus/Anubis. Optional bosses, safe return routes. Atlas threshold leads to separate dimensional scene, not a normal island boss circle.
- `labels[24]`: editor cartography/UX only; no runtime collider or POI by default.

## Pixel-art visual contracts
Original SOH ground/road is the initial primary target: `assets/environment/survival_world/terrain.png`; verify atlas manifest on the actual branch. Imported CraftPix is candidate, not a mandatory pack mélange. Check pixel density and palette at native camera 640x360 with nearest filtering; preserve source animation frames and feet anchor, never scale a 320x400 building to a 48px world icon. Atlas-level cartography and native 1x regional scenes are distinct views over the *same world data*. Define autotile and seam tests for open water, shoreline, inner/outer bends, T/Y/X confluence, river mouths, coastal inlets, delta, bridges, underwater overlay. Draw sprite-backed regional scenery with correct occlusion, Y-sort, collision, access footprints.

## Gameplay and live-world proof
Bible governs the 14-day real-clock run (offline time advances), final 72-hour Ragnarok, non-boss/non-Core sustainable survival, finite Ragnarok currency and personally bought escrow chest, optional Elders, track-discovery creature pursuit of homes, weather/seasons/biome hazards, material gathering and logistics, discovery and crafting loops. Map placement must make these playable. Test travel-time and inventory carrying costs on foot/cart/boat, real independent spawns, early shelter, alternate routes, day/night, hazard preparation, supply chains and returning from distant sites. A rendered map is not playable production.

## Acceptance
1. Exact input fingerprint + ID completeness and deterministic compile/recompile.
2. Native Godot 4.7 import, walkable/collision/water/multi-level/door transitions on a representative span; actual boat/portage or documented blocker.
3. All map classes translated with source-ID audit, no dropped or relocated POIs.
4. Player journey and survival proofs on real scene with real input and separate restart persistence.
5. At 640x360 native pixel scale, daylight/night captures; screenshot visual review with creator; no opaque pasted background.
6. Benchmark FPS/load/streaming; layer and collision checks; source licenses/provenance and assets are Git-resident.
7. Contradictions and missing art labeled BLOCKED, not replaced by fabricated features.

This file is the conversion **technical specification**, not proof that conversion is implemented.
