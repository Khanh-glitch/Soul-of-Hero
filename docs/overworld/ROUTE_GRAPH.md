# Hollow Marches — Route graph

## Principal pilgrimage road (red road on the map)
```
Refuge (camp)
   │ road
   ▼
L1 Crypt Entrance ─────────── (south loop) ── refuge
   │ road
   ▼
L2 Ossuary Fork
   │ road
   ▼
Crossroads (camp) ──► L3 Crossfire Archive (west branch)
   │ road
   ├──► L5 Blood Crucible ──(broken bridge shortcut unlocked by L5 clear)──┐
   │                                                                      │
   └──► L4 Spiral Reliquary ── east spur ─────────────────────────────────┤
                                                                          │
                                                                 Relay Foot (camp)
                                                                          │
                                                                 L6 Soul Anchor Relay
                                                                          │
                                                (powered conduit unlocked by L6 clear)
                                                                          │
                                                                  Ridge junction
                                                                     │
                                                          (landslide unlocked by L7 clear)
                                                                     │
                                        ┌──────── L7 The Failing Beacon
                                        │
                                  Watch Ridge (camp)
                                        │
                                   Crimson Gate approach
                                        │
                                   L9 Crimson Gate ──(valve unlocked by L9 clear)──┐
                                        │                                           │
                                        ├── L8 Divided Reliquary                    │
                                        │                                           │
                                        └────────────► L10 Castellan Throne ◄────────┘
```

## Loops
1. **South loop**: Refuge → Crypt road → south loop spur → refuge (small scenic loop).
2. **Central loop**: Crossroads → Crucible road → Reliquary spur → Crossroads (after the
   Crucible bridge is repaired the loop also closes east to west across the bridge).

## Shortcuts
| ID | Kind | Unlocked by | Effect |
| --- | --- | --- | --- |
| `short_crucible_bridge` | Broken bridge | L5 clear | Spans the river, closing the central loop and shortening the west–east crossing. |
| `short_relay_power` | Powered conduit | L6 clear | Energizes the ridge ascent; opens the road north from the relay watershed. |
| `short_beacon_road` | Rubble/landslide | L7 clear | Clears the ridge road north, giving access to the northern precincts. |
| `short_gate_valve` | Gate valve | L9 clear | Opens the inner approach to the Citadel of the Castellan. |

## Safe camps
- **Ashen Refuge** (start, active on a new profile).
- **Wayfarer Stones** at the central crossroads.
- **Relay Foot** east of the Reliquary spur.
- **Watch Ridge Camp** north of the beacon (only after clearing the landslide).

## Optional discoveries
Eight authored sites (stashes, shrines, lore markers, coin and material caches) are
placed off the main road. Several sit behind shortcut doors and reward
exploration with small currencies, materials, or partial provision restoration.
