# WMP-04R1 — Creator correction: rock outcrops + snow retreat; art REUSE FIRST

**Effective source:** `veyra-world-master/CURRENT_WORLD_MASTER.json` -> WMP-04R1 -> `api/current.mjs`.
**Historical line:** WMP-01/02/03 and prior WMP-04 are byte-preserved; no GOLD or Gameplay file rewritten.

## Root cause and physical correction
The original WMP-04 source snow expansion allowed canonical code `7=rock`, overwriting **483 of 510 rock cells**. Independent source check: baseline rock 510, post-WMP04 rock only **27**. This is a mapping fault, not a lack of rock tileset.

R1 restores all 483 overwritten rock cells to their original rock biome and trims **217** additional inland snow cells outside a continuous, north-skewed boundary. Snow is redistributed to **557** eligible northern fringe cells without covering original rock, marsh, volcanic, toxic, desert/dry steppe, beaches or water. Current snow **3,311 / 14,392 dry cells = 23.0058%**, down from 3,454 (24.0%). Snow extends no farther than AU Y=600; **no snow at Y>=610**. Preserve the 217 original source snow cells. The margin is a deterministic art/geography proposal, not a temperature isotherm.

Rock original **510**, WMP-04 **27**, R1 **510**. Existing desert/dry scrub +30.0152%, all 92 roads, docks, 81 POIs, 579 source IDs, WMP-03 collision/physical source, and marine hazard/free-water contract preserved. No climate rates, damage or live AI added.

## Asset policy — corrected after direct Gameplay source audit
**No asset acquisition or new sprite production is authorized merely because a biome is present on the world map.** Do not recreate materials already present in Soul of Hero.

Exact Gameplay source at `d73aa63f9f7f98aa1f6c6a42211693c7710cf3c4`:
- `web/src/game/render.ts`: `T.SNOW`, `T.ICE`, `T.HILL`, `T.CLIFF`, `T.SAND`, `T.DEEP`, `T.SHALLOW`, `T.RIVER`, `T.LAVA` native 16px pixel material ramps, texel variation, water-wave and shoreline painting.
- `web/src/game/art.ts`: native `S.snowpine`, `S.pine`, `S.rock`, `S.iron`, `S.coal`, `S.sulfur`, `S.crystal` and other source sprites (generated from actual game code).
- `web/src/game/world.ts`: stable source keys and world terrain catalog.
The past "must find a winter tileset" conclusion from five *inferior off-game LAB renders* is **withdrawn**. Those labs were never a valid test of Web's own snow/rock visuals.

Art decisions: **KEEP** actual native materials and sprites; compose them first in correct WMP04R1 geometry. Only after inspecting exact GameRoot at native 640×360 1x may one request a specifically identified absent asset/feature. Any new asset needs exact gap evidence, size and source licensing. Existing water, snow, cliff, ice, dry land, snowpine, stone/ore assets must not be purchased, remade, cloned or re-packed gratuitously.

## Validation and handoff
- Generator `v4/r1/src/rebalance_snow.mjs` deterministically derives both active `.u8` rasters from pinned old WMP04 and original source. Original parent rasters are unchanged.
- Consumer `api/current.mjs` selects R1 biome and cold transition but retains original WMP04 marine mask/routing and original WMP03 base physical geometry.
- Tests `v4/r1/tests/run_r1.mjs` assert original rock preservation, snow area and inward trim, no deeper snow tail, source snow retention, historic parity and no unrelated biome mutation.
- Visual `v4/r1/evidence/snow_and_rock_before_after.svg` compares canonical WMP04 vs corrected effective map. **DIAGNOSTIC, not gameplay render/visual acceptance**.
- No new tileset, owner AI/season rates, world playable or Gameplay runtime adoption is claimed.

**Dispatch:** Gameplay/Control Tower consumes updated `CURRENT_WORLD_MASTER.json` at exact SHA after CI. Avoid direct historical WMP04 raster reads.
