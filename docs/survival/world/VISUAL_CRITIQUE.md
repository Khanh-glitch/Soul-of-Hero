# Visual Critique and Geography Revisions — SURV-050A

These are authored strategic previews rendered from the compiled plan with Pillow. They are **not** native Godot screenshots and do not prove tile art, collision, camera, or runtime performance.

Preview manifest: `docs/survival/world/previews/preview_manifest.json`.

## Inspected previews

- `previews/continent_biome.png`
- `previews/continent_elevation.png`
- `previews/continent_hydrology.png`
- `previews/continent_routes.png`
- `previews/continent_pois.png`
- `previews/starter_quarter_detail.png`
- `previews/region_panels.png`
- `previews/capability_graph.png`

## First-pass weaknesses found by looking, not only by validator

1. **Coast polygon inverted.** The first compile produced only 208,082 land cells and a thin coastal band; the continent was mostly ocean. Fixed the coast winding order before accepting any geography.
2. **Rectangular biome blocks.** Region ownership rectangles were leaking directly into biome color, making the continent look like disconnected swatches. Added blended base elevation across ownership seams, moisture/climate rules, and low-frequency deterministic roughness. Region `allowed_biomes` now publishes the observed transitional set instead of pretending ownership edges are ecological walls.
3. **Straight ruler rivers.** Authored control points rendered as straight diagonal channels. Added deterministic meander vertices while preserving descending elevation and outlet contracts.
4. **Empty south-west buffer and coastal seams.** The first meaningful-anchor audit found 15% of sampled new land over 64 tiles from an anchor, max distance 172.9 tiles. Added functional sites (mills, barrows, quarries, watches, pumps, boardwalks, nurseries, springs) rather than decorative scatter. Final empty ratio is 1.15%, max anchor distance 80.99 tiles.
5. **Late core vaults mid-accessible.** The first progression audit found late core/specimen vaults open with mid preparation. Added `cap_tide_ward`, moved late core vaults behind `cap_seal_3` / `cap_deepward` / `cap_tide_ward`, and kept infrastructure pumps as preparation sites rather than specimen vaults.
6. **Over-snowed Frostcrown and over-volcanic Ashen buffer.** Reduced the Frostcrown ridge amplitude and restricted volcanic steppe in the Ashen buffer so the opening quarter reads as temperate/moorland rather than a late-game ash field.
7. **Perfect elliptical bays.** Reduced bay/headland radii so coastal irregularity reads as authored geography rather than crater stamps.

## Final visual reading

- The preserved legacy inset is visibly distinct and remains the opening quarter anchor; the two seam carves are small, legible posterns rather than a rewritten Chapter 1.
- Early regions (Ashen Crown buffer, Amberwood, Mirrormere) read as temperate woodland/marsh/lake basin with staple resources and low-risk loops.
- Mid regions have clear preparation identities: Frostcrown snow/thermal, Glasswind coastal storm/thermal, Embersteppe volcanic/filter, Saffron arid coast/salt/heat.
- Late regions are not recolors: Verdant Fold karst/canopy/spore, Pearl Mangroves tidal/boat/tide-ward, Sunken Orchard karst/dive/deepward, Ashwater Fen bog/filter/pump world-state.
- Trunk routes form a cyclic network; spurs connect every new POI. Boat/pass alternates exist, and removing any single trunk edge does not disconnect the hub graph.
- Hydrology preview shows descending rivers, Mirrormere outflow, Frost tarn, terminal salt pan, Pearl distributaries, and the karst conduit contract. Legacy hydrology inside the inset is preserved, not fabricated.

## Remaining visual limitations (do not hide these)

- This is a strategic masterplan render, not final 16 px tile art. Surface grammar still needs A0/A5 native tile/prop pass.
- Region ownership rectangles remain visible as white contract borders; biome transitions are softer but the map is still schematic at continent scale.
- Frostcrown remains snow-dominated by design; native pass should add more boreal valley micro-relief and avalanche clue props.
- Trunk roads are authored polylines, not yet grade-limited native paths. A0 must reconcile slope, bridges, and collision before playable claims.
- POI labels are dense on the continent POI sheet; use `region_panels.png` and `starter_quarter_detail.png` for local reading.
- No native camera/zoom, Knight movement, occlusion, or SaveService round-trip was run. Godot 4.7 binary download was blocked; CI was not triggered by A1.

## Acceptance position

The visual pass materially changed the geography (coast, drainage, biome transitions, emptiness, progression gates). The remaining limitations are native integration/art limitations, not missing continent design. The plan is review-ready as A1 static truth; native playable status remains false.
