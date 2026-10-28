# The Hollow Marches — World Bible

## Identity
The Hollow Marches is the fallen southern frontier of the kingdom whose ruins
make up the ten Chapter 1 dungeons. It is a late-autumn / dying-summer borderland
of pale grass, grey gravel, fractured stone and faded gold roads. The realm is
held together by failing infrastructure: cracked aqueducts, dead watch-beacons,
a half-broken Soul Relay, and a single pilgrimage road running north from a
southern refuge through graveyards, archives, a blood-cult basin, a soul-watershed
relay, a failing military beacon, a divided reliquary, the Crimson Gate, and
finally the Castellan's citadel.

## Visual identity
- Global tint: muted dusk violet-grey (`default_tint` `0.88, 0.85, 0.93`).
- Grass is pale and yellowed rather than lush; dead grass and mud dominate the
  south; rock and cliff dominate the north.
- Roads are worn dirt and cracked paving, faded into the verge with a dithered
  edge rather than a hard tile cut.
- Water is deep desaturated blue and impassable; shallows and fords are walkable
  and carry the road across.
- One material culture throughout: grey-violet stone, rusted iron, dried cloth,
  bone, and the cold cyan of the Soul Relay. Landmarks are told apart by
  **silhouette and furniture** first (`lm_crypt` a low vaulted door, `lm_beacon`
  a tall shaft with a live fire on top, `lm_throne` a three-tower keep), and by
  colour second (cyan relay, orange beacon fire, red crucible/gate/throne).

## Regions
The ten region ids in `data/overworld/hollow_marches.json` (`regions`) are the
HUD's vocabulary; each names the landmark that anchors it, and every point of the
map resolves to the nearest one. See `ROUTE_GRAPH.md` for distances and loops.

| Region | Contents |
| --- | --- |
| Southern refuge | Ashen Refuge (starting camp), broken road south. |
| Western funerary quarter | Crypt Entrance (L1), Ossuary Fork (L2). |
| Central cross-ruins | Crossfire Archive (L3), Crossroads camp. |
| Central ritual basin | Blood Crucible (L5), broken bridge shortcut. |
| Eastern terraces | Spiral Reliquary (L4), Relay Foot camp. |
| Eastern watershed | Soul Anchor Relay (L6), the river canyon, powered conduit shortcut. |
| Northern watch ridge | The Failing Beacon (L7), Watch Ridge camp, landslide shortcut. |
| Northern religious precinct | Divided Reliquary (L8). |
| Northern fortified pass | Crimson Gate (L9), valve shortcut. |
| Northern citadel | Castellan Throne (L10). |

## Landmark roster (fixed destination mapping)

| Id | Level | Place | Region |
| --- | --- | --- | --- |
| `lm_crypt` | `chapter_1_level_1` | Crypt Entrance | Western Funerary Quarter |
| `lm_ossuary` | `chapter_1_level_2` | Ossuary Fork | Ossuary Ravines |
| `lm_archive` | `chapter_1_level_3` | Crossfire Archive | Central Ruins |
| `lm_reliquary` | `chapter_1_level_4` | Spiral Reliquary | Sacred Terraces |
| `lm_crucible` | `chapter_1_level_5` | Blood Crucible | Ritual Basin |
| `lm_relay` | `chapter_1_level_6` | Soul Anchor Relay | Relay Watershed |
| `lm_beacon` | `chapter_1_level_7` | The Failing Beacon | Watch Ridge |
| `lm_divided` | `chapter_1_level_8` | Divided Reliquary | Northern Precinct |
| `lm_gate` | `chapter_1_level_9` | The Crimson Gate | Fortified Pass |
| `lm_throne` | `chapter_1_level_10` | Castellan Throne | Citadel |

## Tone
The overworld does not attempt to be a cheerful open world. It is quieter and
sparser than the dungeons — a travel-space between threats — where small camps,
the road underfoot, and one far-off landmark at a time give the player bearings.
