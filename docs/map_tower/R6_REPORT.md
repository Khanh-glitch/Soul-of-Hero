# R6 — Road & hydrology reconstruction (in progress)

Base: `042b281e`. Verdict: **PARTIAL_IMPLEMENTATION — NOT ACCEPTED**.
Validation: 26/28 mandatory checks (see `docs/map_tower/SPATIAL_VALIDATION.json`).

## Fixed this round
- Rivers/lakes rasterised at **pixel resolution** (`fill_poly_px`, `stroke_px` round caps), so the
  unit-grid clamp that produced black/empty water bodies is gone; depth = 8 px erosions, rivers get
  deep/mid/shallow + one `bank_shadow` band, no foam/crests; foam/beach only on sea and lakes.
- Coloured rectangles at river bends removed: the canvas base is now tiled meadow instead of flat
  blue, so uncovered cells no longer read as water blocks.
- Roads: continuous per-class material (`earth` = cart+foot via `kit.soil_tiles(4)`, `stone_r` =
  trail+riverside), darkened 1-cell verge, lighter `erode(1)` core, junction discs at 68 degree>=3
  nodes; roads never paint over water; road corridors now reach their bridge landings.
- Road/hydro graph module `tools/world/network.py` with `ROAD_WIDTH`, provisional vehicle width
  (cart 16 px, unverified), `coverage()`, `hydro_relation_report()`; exports `out/network.json`
  (`coverage`, `near_miss` with classification, `water_conflicts`).
- New gates N1–N6 in `tools/world/validate.py`.

## Measured
| gate | result |
|---|---|
| road rendered coverage | 84/84 ≥99.5 % (worst 1.000) |
| road width contract | cart 21 px, trail 14, foot 12, riverside 14 |
| river rendered coverage | 17/17 ≥98 % (worst 1.000) |
| river source/mouth relations | 34/34 within 4 u |
| brook passes | 4, each ≤2.5 u with no bridge within 14 u |
| road on open water | 0 (`water_conflicts`) |
| roads walkable with 12×8 feet box | **72/84** (was 58/84) |
| road endpoint joins | 105 T junctions, **17 ambiguous (1.2–3.0 u)** |

## Open (blocking acceptance)
- N2: 12 roads still have a blocked feet-box point (water-adjacent corridors and pier/ferry
  endpoints); needs per-road classification, not a global wider corridor.
- N1: 17 endpoints in the ambiguous 1.2–3.0 u band need projection snaps justified against GOLD role.
- `poi clearings 0 cells` still unexplained in the last compile log.
- No R6 Chromium captures yet (footer strip removal, route studies, R5-vs-R6 same-camera pairs).
- `godot-native-gate` baseline path bug, artifact SHA sync and intake-manifest corrections
  (695666 Undead, 958568 Cursed Land, 694865 seabed objects) are still open from P1/P3/P4.

Asset reasons for the new materials: `665131` fields pack supplies soil/worn-grass road tiles chosen
by measured zero-grass fraction (roads must read as bare trodden ground); `574220` Road1/Road2 family
supplies the stone/paving used for trails, riverside tracks and junction discs (authored as paved,
not dirt, in GOLD's role list). Both replace the flat colour masks that read as painted strips.
