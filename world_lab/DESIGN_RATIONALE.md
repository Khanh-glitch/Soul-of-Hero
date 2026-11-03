# Design rationale — legacy paired candidate + ONE rebuilt hero scene

The creator selected `paired` for the **legacy** spatial thesis: a **Greywater open mill/harbor** connected to an **Argus deep-vault traverse**. `screenshots/PAIRED_VISUAL_REVIEW.png` shows the historical four-quadrant packet, but the creator **rejected all 10 legacy screenshots**; `paired` now survives only as a traversal-route thesis, not a visual candidate.

The current work is a different, stronger pipeline: **one** rebuilt Argus / Great Lens hero scene at native `640×360` 1×, documented in `HERO_SCENE_REVIEW.md`. The rest of this file records the legacy GOLD compiler/renderer rationale, which still underpins the review tool but is not the hero-scene pipeline.

## Authority and scale

- The canonical product Bible is the sole gameplay truth: creator decisions > Bible > history > GOLD/technical docs. This lab owns candidate geometry/art only, never economy, AI, loot prices, HP, yields, respawn, recipes, gates or unlocks.
- GOLD IDs and coordinates are immutable. `world_px = authoring_unit * 4`; `tile = 16px = 4 authoring units`; grid is `500×350`; camera is `640×360` at 1× nearest-neighbor. The `2000×1400` authoring overview is a separate minimap, never a stretched gameplay texture.
- `refs` and `goldIndex` retain all 579 GOLD IDs across roads, bridges, docks, 81 POIs, 23 zones, 280 resources, 4 spawns, 6 Elders and labels.

## Terrain / water

Real 16px tiles are generated from coherent palettes, not random per-pixel noise or Canvas strokes. Four animated water frames, shallow/deep/river volumes, 46 ordered blob-47 material-transition pairs, shoreline edges/corners, river mouths, confluences, deltas, sandbanks, bridge approaches and underwater/shore overlays are compiled from GOLD geography. Roads are not painted over water; bridges and decks are real walkable geometry with distinct render/collision footprints.

## Art grammar

Three explicit profiles: `SOH-PROTO-16` small 3/4 side-presented props, `CRAFTPIX-3Q` larger donor vegetation after integer downscale, and `INDUSTRIAL-TILE-16` modular 16px buildings/bridges/interiors. They are not mixed inside one local prop family. External donor trees use foot colliders derived from bottom-28% alpha; canopy never becomes collision. Shadows, y-sort by foot anchor and roof opacity when the avatar is inside a building are real renderer behavior.

Greywater uses open working waterfront geometry: quay, filter house, tide mill, warehouse, cottages, market/loading plaza, cart/log props, sawmill shed and three distinct build-site samples. Argus uses a legible academy threshold, rounded courtyard, annex/observatory/lantern landmarks and three `48×32` vertical levels: reception/generator, archive/cistern, Great Lens vault. The lens chamber has a walkable hazard ring, north/south doors, west/east retreat loops and an emergency drainage shaft. Stairs/lifts are authoring transitions, not gameplay teleports or unlocks.

## Ecology and variants

Variant A uses seed `20261102`, variant B `20261103`; both preserve GOLD resource IDs and coordinates. Clusters mix GOLD resource anchors, clearings, spawn-safe radii, blue-noise spacing and reserved structure/prop/patch footprints. `resource_proposals.json` contains `PROPOSED_PLACEMENT_ONLY` records with no yields, stock, HP or respawn. Locked creator edits/regions survive B regeneration.

## Navigation and negative testing

`movement.mjs` is a review-tool circle-vs-tile/AABB mover with axis sliding, corner assist, 4px substeps and BFS. QA proves eight tree approaches, one-tile passage, corner assist, open doors, solid walls, soft traversable decoration, four-spawn early-resource reachability, bridge usage on the academy route, two+ interior retreat paths, landmark reachability, and rejection of wrong GOLD IDs / water goals / removed-edge softlocks. These are **spatial candidates**, not canonical player laws.

## ONE rebuilt hero scene — art pipeline

`src/hero/` is separate from the legacy compiler. `kit.mjs` resolves `155` real prototype-generated crops from 8 exact staged sheets using the prototype's own frame manifests; `scene.mjs` serializes an explicit `40×23` 16px tile map, two exact-frame mosaics (81 + 25 crops), 21 y-sorted whole sprites, 7 light emitters, functional spaces and focal hierarchy to `data/hero_scene.json`; `render.mjs` verifies every SHA/rect/frame, then writes `screenshots/ARGUS_GREAT_LENS_HERO.png`. `palette.mjs` supplies one 36-colour hue-shifted value ladder (dark→blue/violet, highlights→brass/ivory); `light.mjs` applies one cool ambient step plus small warm/cool pools from the real `light_radial.png` alpha crop quantized into four hard bands. Exactly one hero landmark is labelled `AI_DERIVED_HERO_PROP_NOT_REAL_ASSET` and is never real-asset proof. `qa/HERO_TEST_REPORT.md` proves 12 strict checks; `HERO_SCENE_REVIEW.md` compares honestly against the staged L06/L09 native references.

This pipeline deliberately follows the applied research recorded in `ART_PIPELINE_REVIEW.md`: tileable/trim majority on a uniform 16px grid, one hero asset, conservative ≤1-tile contact shadows, cool ambient + warm local light, foreground/center/background hierarchy, leading lines, hard edges, y-depth sorting and a single destination. It does **not** claim parity with the L06/L09 native frames.

## Explicit non-claims

`source_present ≠ native_fixture_pass ≠ composed_player_usable ≠ creator_experience_accepted`. Camera screenshot triage is not visual acceptance; an isolated fixture PASS is not composed game. No Godot 4.7 import, native player journey, owner semantic commitment, C01–C24 proof packet, 336h E2, performance/streaming benchmark in Godot, or creator acceptance exists.
