# L08 — The Divided Reliquary

- Map: `data/levels/chapter_1_level_8.json` ("Divided Reliquary", choose one branch)
- Kit: `reliquary` — `assets/environment/chapter1/reliquary/`
- Authoring: `tools/level8/art_reliquary.py`, `tools/level8/architecture_reliquary.py`
- Document: `data/levels/chapter_1_level_8_architecture.json`
- Status: `INCOMPLETE — ART DELIVERY FAILED` until its native frames are captured and reviewed

## The place

One reliquary with a decision in the middle of it. The building is pale marble
throughout — it is one foundation — and the two wings are told apart by what has
been brought into them: black iron, bone and cold blue in the west; wine velvet,
gilt, spilled wine and rose light in the east.

## What the composition says

- **The choice is drawn on the floor.** Each sealed door has its branch's emblem
  cut into the paving in front of it at the threshold: an iron disc with a scythe
  under the Reaper seal, a gilt-ringed disc with a chalice under the Vampire seal.
  Same size, same construction, different sigil — so the player reads the choice
  before touching it.
- **The seals are refused.** No prop may stand on a seal, the cell beside it, or
  in front of it; the placer and the validator both enforce it, so there is no
  decorative bypass hiding an interaction.
- **The Reaper wing** is a colonnade of fluted columns and hooded statues, iron
  grilles over lit niches, sarcophagi against every wall, a bier, and a grave cut
  into the floor in iron inlay. Its light is cold.
- **The Vampire wing** is velvet hangings in clusters, cracked gilt mirrors, a
  three-tier wine fountain still running, banquet tables left standing, smashed
  marble, and a gilt-ringed grave slab. Its light is rose.
- **The vault** ends the level properly: a raised inlaid dais carrying the elite's
  sigil, the founders' sarcophagi, and a pointed exit arch with a cold opening and
  two lamps inside it, so the exit is a place rather than a door tile.

## Verification

- Validator: clean, with tall fixtures restricted to wall mass. 3648 floor
  overrides (the whole of the building's floor, by wing), 91 wall dressings, 96
  props, 45 lights.
- The two wings share one kit on purpose: this level is about a divided building,
  and a completely different mountain of assets per wing would have said two
  buildings.

## Known weaknesses before the first native capture

- The wings' own geometry is symmetric; the differentiation is material and
  furniture, which is the honest limit of a shared plan.
- The paving flagstone joints are regular enough to read as a grid at 1x zoom.
- The east wing's damage is authored as broken paving and rubble rather than as
  structural collapse: the map has one floor and the art does not create holes.
