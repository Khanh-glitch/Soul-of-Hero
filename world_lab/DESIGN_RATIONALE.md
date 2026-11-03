# Design rationale — paired Greywater → Argus candidate

The creator selected `paired`: the first creator-visible visual candidate must connect a **Greywater open mill/harbor** to an **Argus deep-vault traverse**. `screenshots/PAIRED_VISUAL_REVIEW.png` shows that packet at four unscaled 640×360 1× views (day and night).

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

## Explicit non-claims

`source_present ≠ native_fixture_pass ≠ composed_player_usable ≠ creator_experience_accepted`. Camera screenshot triage is not visual acceptance; an isolated fixture PASS is not composed game. No Godot 4.7 import, native player journey, owner semantic commitment, C01–C24 proof packet, 336h E2, performance/streaming benchmark in Godot, or creator acceptance exists.
