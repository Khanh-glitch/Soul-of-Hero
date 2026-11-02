# Asset compatibility report — Veyra corrective pass

Search scope: all 1280 tracked PNGs in `Khanh-glitch/Soul-of-Hero@9417297`. 110 non-UI
environment/character sheets were inventoried by size; 12 were opened and inspected directly
(tilesets, plants, props, structures, water coasts, dungeon walls). The Drive vault used by the
pilot is **not** used: it is not in the repository and is no longer present in this environment.

## Admitted sources (all committed, all SHA-pinned in `map_tower/assets/VEYRA_ART_MANIFEST.json`)

| role | file | tile | verdict |
| --- | --- | --- | --- |
| meadow, stone path | `assets/environment/cainos_demo/cainos_tileset_grass.png` | 32 px | ADMITTED — one palette, one perspective, path modules included |
| stone / rock ground | `assets/environment/cainos_demo/cainos_tileset_stone_ground.png` | 32 px | ADMITTED — same palette, but carries visible 32 px grid lines (noted) |
| walls, arches, stairs | `assets/environment/cainos_demo/cainos_struct.png` | 32 px | ADMITTED — stone walls with grass tops, arches, timber stairs |
| props | `assets/environment/cainos_demo/cainos_props.png` | 32 px | ADMITTED — 39 components; only 20 curated (crates, barrels, urns, signs, graves, well, statue, pedestal, workbench, furnace, ruin, door, boulders, rocks) |
| trees / bushes / tufts | `assets/environment/cainos_demo/cainos_plant.png` | 32 px | ADMITTED — 3 tree variants, 5 bushes, 1 tuft |
| cliff / ocean wall | `assets/environment/ocean_cainos/ocean_tileset_wall.png` | 32 px | HELD BACK — same author and palette but the sheet is a wall/cliff atlas whose mask layout was not verified in this pass; unused rather than used blind |

## Rejected or unusable sources

| source | why |
| --- | --- |
| `assets/library/downloaded/free_topdown_pixel_dungeon/PNG/Water_coasts_animation.png` | Inspected: it is **dungeon water over black void** with a cyan rim, cold blue-grey palette; it has no sea, lake or riverbank semantics and clashes with the Cainos palette. Rejected as overworld water. |
| `.../free_topdown_pixel_dungeon/PNG/walls_floor.png`, `Objects.png` | dungeon stone and interior furniture in the same cold palette; would create the collage effect the art direction forbids. |
| `assets/environment/ocean_cainos/ocean_tileset_grass.png` | It is the Cainos grass sheet **recoloured teal** (verified tile-by-tile: same layout, same autotile block); using it as water would be a tint trick, not water art. |
| `assets/environment/dungeon*`, `assets/characters/*`, `assets/library/downloaded/rpg_*` | wrong genre / scale / not overworld tilesets. |

## Compatibility rules checked

- **Pixel density**: all admitted sheets are the same 32 px Cainos grid; no stretching anywhere.
- **Perspective**: top-down 3/4-ish, single projection across ground, structure and prop sheets.
- **Outline and shading**: consistent 1 px dark outline, light from the upper left, in all four
  admitted sheets.
- **Scale**: trees are 79–113 px wide against a 32 px tile; the D051 body is 22 px, i.e. 0.7 of a
  tile. This is the one genuine **scale conflict** in the build and it is reported, not hidden.
- **Palette**: olive-green meadow, warm-grey stone, deep green canopy — one family.
- **Transition connectivity**: only the path-core tiles are used as road texture (measured stone
  fraction 0.69–0.80); edge/corner modules are deliberately excluded so no grass hole is painted
  inside a road.
- **Prop anchoring**: props are y-sorted with the sprite's feet on the placement point and a
  collision cell only for the usable ones (walls, trees, crates, statues).

## What this means for the world

Six of the ten required material families **do not exist in the repository**: sea/lake/river
surface, sand/hard-earth/ash/volcanic ground, building exteriors, bridge modules, dock modules and
elder-specific biome art. They are listed with exact requirements in
`map_tower/assets/UNRESOLVED_ART_GAPS.json`. The compiler renders clearly-marked stand-ins for the
water surface and assembles bridges, piers and sites from admitted tiles — never presenting them
as finished art.
