# Visual acceptance report — corrective Veyra build

**Status: NOT ACCEPTED.** This report records what I inspected, what improved, and what is
still visibly wrong. All images are in `docs/map_tower/evidence/` with
`EVIDENCE_INDEX.json`.

**Capture method:** every image here is a **Pillow composite of the compiled `out/world.png`**.
Gate D (real browser capture) is **BLOCKED**: this sandbox has no `chromium`, `chromium-browser`,
`google-chrome`, `firefox`, no `playwright` module and no cached Playwright browsers
(`node -e "require.resolve('playwright')"` → module absent; `ls /root/.cache/ms-playwright` →
absent). Checked images are therefore *generated* views, exactly as labelled. No image in this
report is a browser screenshot and none is claimed to be.

Build under review: `out/world.png` 8000×5600, 4 px per GOLD unit, 32 px art tiles,
commit `9417297` + this pass, GOLD SHA `88780f78…` (see `BASELINE_RECONCILIATION.md`).

## Scene-by-scene

| scene | file | what it proves | defects still visible |
| --- | --- | --- | --- |
| Full world | `overview.png` (1:5) | continent silhouette follows GOLD landmass polygons; no external asset dependency | flat blue sea, no coast material; land is one continuous canopy outside the POIs; biome contrast is weak because the repository has no sand/ash/dry ground family |
| Spawns 1–4 | `spawn_1_sp_west.png` … `spawn_4_sp_gulf.png` (1×, 640×360) | D051 stands on walkable ground at all four GOLD spawn points; trail, river, trees, props read at native scale | character is visually small against 32 px Cainos trees (body ≈ 0.7 art tile) — scale conflict between the D051 sheet and the only committed tileset |
| All 12 bridges | `bridges_12_contact.png` (2×) | each GOLD bridge id has a deck that spans measured bank-to-bank water and is walkable | decks are masked stone texture, not bridge modules; no posts/planks; at ~5 units wide they read as a widened causeway rather than a bridge |
| Docks (6 of 27) | `docks_contact.png` (2×) | piers extend from the landing into navigable water; land and water anchors exist in metadata | piers are stone rectangles; no planks, posts or bollards; boat movement is unimplemented and labelled as such |
| Elder environments ×6 | `elder_aion.png`, `elder_typhon.png`, `elder_surtur.png`, `elder_atlas.png`, `elder_argus.png`, `elder_anubis.png` | six distinct site compositions (forest, boulders, furnace+rock, arch+pedestal, arch+statue, graves+statue) at the GOLD elder centres | **Surtur and Anubis are not visually volcanic or desert** — the repository has no ash or dry-ground family; these are prop-only identities |
| Confluences ×3 | `confluence_1.png` … `confluence_3.png` | rivers meet at authored junctions; widths stay true (~10–16 px) | junctions are raster merges of two discs; no confluence bank treatment; water is a flat fill |
| Lakes ×2 | `lake_1.png`, `lake_2.png` | lake polygons filled at authored size | no shoreline art, no shallows gradient, hard flat edge to grass |
| Sites: village, hamlet, farm, quarry, mine, forge, necropolis, research, observatory | `site_*.png` (1×) | each archetype gets a different prop vocabulary (well+walls, boulders, furnace+workbench, graves+statue, pedestal+arch) | **no building exteriors exist in the repository**, so a village reads as an enclosure with a well, not as a village; this is the largest art gap (`ART-002`) |
| Highland | `highland.png` | elevation percentiles drive stone/rock ground and non-walkable cliff blocks | stone ground boundaries are blocky where the tile family changes; stone texture has visible 32 px grid lines |
| Before / after | `before_after_sp_west.png` | side-by-side at the same camera coordinate (`sp_west`) | the "before" frame is from the pilot and used Drive art that cannot be rebuilt from Git |

## Defects fixed in this pass

1. **Cliff faces as walkable ground** — cliff cells derived from elevation deltas are now solid;
   stone/rock ground is only painted where slope is low.
2. **Flat tiles chosen by colour statistics** — replaced with an explicit curated registry
   (`tools/world/art_registry.py`), every rectangle visually inspected via a labelled contact
   sheet before being written to `map_tower/assets/VEYRA_ART_MANIFEST.json`.
3. **48 px rivers** — rivers now rasterise at their authored half-width (2.5 u river = 5 px
   half-width = 10 px channel), drawn on a 4 px/unit raster independently of the 32 px art grid.
4. **Black seams at the coast** — the canvas is initialised to the water tone, so no transparent
   pixel can appear between the sub-tile water mask and the 32 px ground grid.
5. **Cobblestone flooding** — roads are masked at their authored width instead of tiling a whole
   cell, so a cart road is a ~11 px trail, not a paved plaza.
6. **Rectangular POI pads** — removed; sites are compositions anchored inside the GOLD `foot`
   polygon, not a stamped rectangle.

## Verdict

Not acceptable as final art: the water substitute, the absent building exteriors and the missing
ash/dry/desert families remain blocking. Geography, trail width, river width, cliff solidity and
material provenance are materially better and are verifiable in the files above. The creator
remains the visual acceptance authority.
