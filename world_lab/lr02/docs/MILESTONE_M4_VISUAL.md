# MAP-LR02 M4 — visual production method (production-ready, not integration proof)

## Classification (never conflate these)

1. `REAL_WEB_SCREENSHOT` — unmodified `640×360` bytes from Gameplay HEAD `240db32a1a69211f87af161796498b82afcde20e`, in `output/visual/web_evidence/`. This is the visual quality baseline to PRESERVE.
2. `MAP_ONLY_ANALYTICAL_PREVIEW` — `640×360` pairs in `output/visual/comparisons/`. Both before and after are Map analytical previews; after adds ONLY the LR02 static-wall art layer.
3. `ACTUAL_WEB_RENDERED_INTEGRATION_PROOF` — `NOT_AVAILABLE__GAMEPLAY_OWNED` **for the M4 portable layers and M1/M3/M3b geometry**. Gameplay separately pinned M0 clipped solids and M2 cell sets in its own diagnostic LR02/Oasis layouts (`web/src/game/veyra/lr02.ts`, `eligibility.ts`, PR44 `6620726633`, HEAD `bfbf44df9ebf403290dce45ff197327947762e8e`) and published its own Web-rendered evidence. `projectVeyra()` still returns `statics:[]`; Map does not modify Gameplay code and never labels class (2) as class (3).

## What is preserved (exact primary-source locations)

| Feature | Source | Action |
| --- | --- | --- |
| Pixel trees / source sprites | `art.ts` + `render.ts drawSource()` ~238–259 | RETAIN VERBATIM |
| Terrain variation | `render.ts texel()` `PAL`/`fbm`/`hash2` | RETAIN VERBATIM |
| Ocean / large wave motifs | `render.ts texel()` `case T.DEEP` sinusoidal `wv` | RETAIN VERBATIM |
| Animated shoreline | `render.ts draw()` `sin(time/520 + tx*0.7 + ty*0.3)`, `rgba(235,248,255,0.85)` glint, `rgba(220,240,255,0.7)` sparkle | GAMEPLAY ONLY, not simulated by Map |
| Natural coast/river/land transitions | `render.ts renderChunk()` `PRIO` neighbour fringe; `ctx.sea<=1` sand darkening | RETAIN VERBATIM |
| Native `640×360` readability | `VIEW_W/VIEW_H`, `TILE=16`, `imageSmoothingEnabled=false` | RETAIN VERBATIM |
| SOH identity | `OUT='#140c14'`, original pixel art, local VT323/Pixelify Sans | RETAIN VERBATIM |

`web/THIRD_PARTY.md` confirms no third-party sprites/tiles/sounds. No external art pack was adopted; `newExternalAssetsCreated=0`, `replacedSprites=0`, `replacedTiles=0`.

## Portable layer

`output/visual/layers/<region>_lr02_static_walls.svg`: transparent `640×360`, `shape-rendering=crispEdges`, integer pixels. Each `staticSolid` from `portal_geometry.v1.json` becomes a hard-edged wall segment with a 1px ground shadow, dark `T.PWALL[2]` outline, `T.PWALL[0]` body and `T.PWALL[3]` top highlight. Each `staticOpening` is an ABSENCE of stroke plus a 1px `T.PWALL[4]` door jamb at each end. No grid, no cell tint, no arrows, no labels, no canopy.

Proposed Web layer order (Gameplay implements):
`terrain chunks → animated water/lava + shore glints → footprints → **lr02_static_architecture** → ground structures/hazards → buildings/roofs → entities → dynamic doors → HUD`.

Usage rules: read geometry from `portal_geometry.v1.json` at its pinned digest, never from a PNG; draw at integer pixels with `imageSmoothingEnabled=false`; never resample; Gameplay owns `doorState`, `lockedState`, `powerRequirement` and destruction at opening centres; eligibility `cellIndices` are NOT a visual layer; roof polygons remain UNRESOLVED.

## Comparisons

- `zone_bz_greywater`: before `zone_bz_greywater_before_640x360.png` (MAP_ONLY_ANALYTICAL_PREVIEW), after `zone_bz_greywater_after_640x360.png` (MAP_ONLY_ANALYTICAL_PREVIEW), class 3 `NOT_AVAILABLE__GAMEPLAY_OWNED`.
- `zone_bz_silver`: before `zone_bz_silver_before_640x360.png` (MAP_ONLY_ANALYTICAL_PREVIEW), after `zone_bz_silver_after_640x360.png` (MAP_ONLY_ANALYTICAL_PREVIEW), class 3 `NOT_AVAILABLE__GAMEPLAY_OWNED`.
- `zone_bz_hook`: before `zone_bz_hook_before_640x360.png` (MAP_ONLY_ANALYTICAL_PREVIEW), after `zone_bz_hook_after_640x360.png` (MAP_ONLY_ANALYTICAL_PREVIEW), class 3 `NOT_AVAILABLE__GAMEPLAY_OWNED`.
- `zone_bz_delta`: before `zone_bz_delta_before_640x360.png` (MAP_ONLY_ANALYTICAL_PREVIEW), after `zone_bz_delta_after_640x360.png` (MAP_ONLY_ANALYTICAL_PREVIEW), class 3 `NOT_AVAILABLE__GAMEPLAY_OWNED`.
- `land_ld_ironholm`: before `land_ld_ironholm_before_640x360.png` (MAP_ONLY_ANALYTICAL_PREVIEW), after `land_ld_ironholm_after_640x360.png` (MAP_ONLY_ANALYTICAL_PREVIEW), class 3 `NOT_AVAILABLE__GAMEPLAY_OWNED`.
- `elder_el_typhon`: before `elder_el_typhon_before_640x360.png` (MAP_ONLY_ANALYTICAL_PREVIEW), after `elder_el_typhon_after_640x360.png` (MAP_ONLY_ANALYTICAL_PREVIEW), class 3 `NOT_AVAILABLE__GAMEPLAY_OWNED`.

For `zone_bz_greywater` the real Web screenshots are also available separately as class (1). For the other five regions no real Web screenshot exists at the observed Gameplay HEAD; Map does not fabricate one.

No playable Veyra, no final world, no creator visual approval, no Web-rendered integration proof.
