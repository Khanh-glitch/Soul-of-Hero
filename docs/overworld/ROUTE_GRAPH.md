# Hollow Marches — Route graph

All coordinates are tile cells in the 384×256 envelope, taken from
`data/overworld/hollow_marches.json` as baked by `tools/overworld/author.py`.
The reachability gate floods from the refuge spawn `(56, 218)` and must reach
every threshold, camp and discovery **with all four shortcuts closed**; if it
does not, the bake refuses to write. So nothing below is load-bearing for the
main road. Measured walking distance from the refuge, in tiles: L01 69, L02 109,
L03 141, L04 225, L05 161, L06 309, L07 289, L08 361, L09 329, L10 405 — a full
tour is a few minutes of walking at the Knight's overworld speed of 112 px/s.

## The road, south to north

```
Refuge hollow (56,218) ── camp (56,216) · start · respawn anchor
   │ military road north
   ├── L01 Crypt Entrance (88,180)          western funerary quarter
   │      └── discovery d_crypt_offer (76,196)   +40 gold
   ├── L02 Ossuary Fork (64,128)            western funerary quarter
   │      └── discovery d_ossuary_stash (48,146) +1 soul shard
   ├── Crossroads camp (152,188)            central cross-ruins
   ├── L03 Crossfire Archive (132,152)      central cross-ruins
   │      └── discovery d_archive_lore (146,138)
   ├── L05 Blood Crucible (192,192)         ritual basin (hazard)
   │      └── discovery d_crucible_cove (200,226) +1 fragment
   │      └── short_crucible_bridge (184,210)  ← opened by clearing L05
   ├── L04 Spiral Reliquary (200,136)       sacred terraces
   │      └── discovery d_shrine_grove (176,118)  restores half a pack
   ├── Relay Foot camp (248,158)            eastern watershed (hazard)
   ├── L06 Soul Anchor Relay (288,140)
   │      └── discovery d_relay_shard (312,156) +1 sigil
   │      └── short_relay_power (256,125)      ← opened by clearing L06
   ├── Watch Ridge camp (208,104)           northern watch ridge
   ├── L07 The Failing Beacon (208,80)
   │      └── short_beacon_road (208,96)       ← opened by clearing L07
   │      └── discovery d_quartermaster (232,96)  +80 gold
   ├── L08 Divided Reliquary (272,72)       northern precinct
   ├── L09 Crimson Gate (208,40)            fortified pass
   │      └── short_gate_valve (233,50)        ← opened by clearing L09
   │      └── discovery d_gate_plunder (184,52)   +2 shards, +1 fragment
   └── L10 Castellan Throne (280,36)        citadel plateau
```

## Two traversal loops

1. **South loop** — refuge → crypt road → crossroads camp → back along the
   western spur. Short, scenic, no prerequisite. This is the loop a new player
   walks while learning the region.
2. **Basin loop** — crossroads → crucible basin → northern terraces →
   reliquary → back to the crossroads. Closed at both ends from the start; the
   crucible bridge is the *shortcut across the middle-ish south*, not the only
   way round.

A third, longer route exists without being a loop: the south road refuge → basin
→ fen → crossroads, which is how the fen and its discovery are reached at all.

## Shortcuts

All four are closed on a fresh profile, all four are validated at bake time to
be fully solid while closed, and all four persist across save/reload.

| ID | Kind | Opened by | Carve box (closed = solid) | Effect |
| --- | --- | --- | --- | --- |
| `short_crucible_bridge` | broken bridge | L05 clear | `181,209 → 187,211` | Restores the span across the basin outflow: the west–east crossing stops being a detour. |
| `short_relay_power` | powered conduit | L06 clear | `254,122 → 258,128` | Energizes the conduit stair up the watershed ridge. |
| `short_beacon_road` | rubble fall | L07 clear | `204,93 → 212,98` | Clears the ridge stair under the Beacon. |
| `short_gate_valve` | gate valve | L09 clear | `232,48 → 234,52` | Opens the inner postern beside the Crimson Gate. |

Opening one changes three things at once: the prop frame, the prop body's
collision layer, and the terrain cells in the carve box. See
`IMPLEMENTATION.md § Shortcuts are world surgery`.

## Camps

| Camp | Cell | State on a fresh profile |
| --- | --- | --- |
| Ashen Refuge | (56, 216) | lit — starting camp (the spawn point is (56, 218), one tile south of the fire) |
| Crossroads | (152, 188) | dark until visited |
| Relay Foot | (248, 158) | dark until visited |
| Watch Ridge | (208, 104) | dark until visited |

Reachable with every shortcut closed, so a key progression beat can never be
behind a door the player has not earned.

## Hazards

| Hazard | Rect (x, y, w, h) | Drain |
| --- | --- | --- |
| `crucible_basin` | 160, 184, 64, 40 | 0.75/s |
| `fen_marsh` | 232, 196, 104, 48 | 0.75/s |
| `relay_watershed` | 246, 122, 62, 34 | 0.75/s |

Wild drain is 0.22/s and camps are 0.0/s, so a full pack (100) lasts ~7½ minutes
of walking and about 2¼ minutes standing in a hazard. A hazard *inside* a camp is
rejected at bake time, so the safe state always wins where they overlap.
