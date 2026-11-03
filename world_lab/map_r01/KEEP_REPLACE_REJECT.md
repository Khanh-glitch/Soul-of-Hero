# MAP-R01 — KEEP / REPLACE / REJECT per material

**Method.** A (untouched PR38 `8421b9c3`), B (rejected MapLab `438b813c` patch applied to the same
head) and C candidates were built and captured with an identical frozen epoch `1770000000000`, run
seed `2182077881`, spawn `(1352,2744)`, QA `+1h` day/night switch, weather slots `0 / 6 / 13`, native
**640×360**, and the same physical `KeyS 2800 / KeyA 2200 / KeyA 1200` route. End positions match
to 0.01 px; all manifests have `errors: []`. Screenshots were **inspected visually** (whole
A/B/C sheets and 2×/5× detail crops), not compared by hash alone.

Candidates C1 (A1 road + A1 props ON), C2 (both OFF) and C3 (A1 reeds only) were all built,
captured and inspected. The shipped C is the KEEP variant. Evidence:
`evidence/ABC-*.png`, `evidence/{A,B,C}/*.png`, `evidence/{A,B,C}/manifest.json`.

| # | Material / concern | A (original Web) | A1 candidate | Decision | Why (visual finding) |
|---|---|---|---|---|---|
| 1 | Grass / meadow ground | dense `hash2`+`fbm` stipple, orange/red accent speckles | `grass_0..3`, `mix_grass_silt_1..15` | **REPLACE** | A1 calm authored tufts remove the noise; no B-style confetti. Clear improvement in the main targeted deficiency. |
| 2 | Forest floor | very dark, busy stipple | `forest_0..3` | **REPLACE** | Coherent muted olive band; trees still read clearly against it. |
| 3 | Sand / beach | flat dotted sand, hard blocky grass→sand→sea steps | `dune_0..3`, `coast_dune_tidal_1..14` | **REPLACE** | Warm sand with subtle highlights and an authored blue shoreline fringe. Coast-day 2× crop is decisively cleaner than A. |
| 4 | Shallow / deep / river | big sine wave curves + white dashes, visually patterned | `tidal_0..3`, `lake_0..3`, `river_0..3` | **REPLACE** | Calm teal→blue gradient with sparse dashes. The engine's existing animated water overlay + day/night light remain, so water still moves; no B-style horizontal dashed sea. |
| 5 | Grass ↔ water edge | priority dithering, abrupt | `blend_grass_water_1..14` | **REPLACE** | Decoded corner-mask transitions produce a continuous shoreline in both day and night. |
| 6 | Grass ↔ forest edge | abrupt, noisy | `blend_grass_forest_1..14` | **REPLACE** | Symmetric authored blend; forest no longer looks like a cut-out rectangle. |
| 7 | Road | smooth brown dirt path with dark edge stripe | `road_dirt_0..15` 16-frame wooden-plank blob set | **KEEP A** | At 640×360 the plank lines and nails read as **scattered boardwalk squares**, not the island's dirt road; it clashes with the surrounding earthy palette. `ASSET_DECISIONS.road=false`; frames stay in the ledger. |
| 8 | Rock sprites | light grey outlined boulder, matches Web trees | inherited original `rock_a` / `rock_c` | **KEEP A** | 5× crop: A1 rocks are dark purple-grey and boxier, less readable on the new ground. |
| 9 | Bush sprites | bright green outlined bush | inherited original `bush` | **KEEP A** | A1 bush is a dark green slab; breaks the Web sprite style. |
| 10 | Reed sprites | small green tuft with brown stalks | inherited original `reeds` | **KEEP A** | C3 probe recorded **0** A1 prop draws on the first-hour route (`window.__r01props` debug counter), so there was no visible improvement to accept; the seam remains for a later palette-matched pass. |
| 11 | All tall trees (`oak`, `pine`, `palm`, `willow`, `snowpine`, `deadtree`) | bright green, dark outline — the Web visual identity | A1 `cainos_tree_*` (excluded) / `tree_pine` / `tree_dead` | **KEEP A** | A1 trees are either 113×139 external crops (rights/style) or thin dark triangles; replacing them would empty the forest canopy. |
| 12 | Player, creatures, items, structures, roofs, HUD, icons, VFX | original Web art | — | **KEEP A** | No A1 candidate improves them; PixelFX/VFX not duplicated or tinted. |
| 13 | `SNOW`, `ASH`, `TOXIC`, `LAVA`, `BURNT`, `ICE`, `BRIDGE`, `FLOOR`, `PWALL`, `CLIFF`, `HILL`, `MARSH` | original procedural material | A1 `ash_*`/`snow_*`/`basalt_*`/`moor_*` exist | **KEEP A (deferred)** | Outside the Fisher's Point first-hour slice; admitting them without captures on their own biomes would be an unverified change. Enforced by `cls(t)===null` and covered by a unit test. Next step = MAP-R02. |
| 14 | B MapLab `mapArt.ts` (hash/sine/fillRect grass, dashed water, invented beacon/cairn/post/dory/stones/mast, extra lamps) | — | — | **REJECT** | Noisy grass, orange road stripes, patterned sea and non-blocking invented landmarks. Retained only as B reference; **not approved for integration**. |
| 15 | A1 `cainos_*` / `ocean_*` crop frames | — | present in A1 atlas/provenance | **REJECT** | A1 `RESEARCH_AND_LICENSES.md` rejects Cainos (licence unproven) and CraftPix forbids raw redistribution; also bright fantasy palette. Excluded from the crop sheet entirely. |

## Net result

- **REPLACE**: 81 emitted A1 terrain frames across 10 families (ground, sand, water, two edge
  families, shoreline). Ground/coast targeted deficiencies are visibly fixed.
- **KEEP**: everything else — Web road, all resource sprites, all characters/structures/HUD/VFX,
  all non-slice biomes. Explicit `ASSET_DECISIONS` flags and `cls()` fallback; verified by test.
- **REJECT**: B's whole procedural MapLab kit, A1 plank road as a Web road, A1 inherited props as
  Web resource sprites, all external `cainos_*`/`ocean_*` frames.

C is **not** "technically successful but visually worse": the KEEP decisions were made precisely to
avoid that outcome. C is calmer and more authored than A and does not reproduce B's noisy grass,
orange stripes, patterned sea or invented landmarks. This is the agent's own visual assessment —
**creator visual approval is not claimed**.
