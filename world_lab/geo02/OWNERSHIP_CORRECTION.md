# MAP-GEO-02 · Map/Gameplay ownership correction

> **MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.**
> `NOT_IN_SOURCE` is a **status**, never an **owner**.

MAP-GEO-01 classified physical POI rooms, entrances and interior circulation as Gameplay-owned
(or left them ownerless while the docs said Gameplay). **That is reversed here.**

## Map owns (even while `NOT_IN_SOURCE` in Veyra)

| Field | What Map authors |
|---|---|
| `pois[].footprint` | physical site boundary (`foot` / `deep`) — a boundary, **not** a finished interior layout |
| `pois[].rooms` | physical rooms / working-space allocation |
| `pois[].entrances` | physical entrance openings in the shell |
| `pois[].passages` | physical passages between spaces |
| `pois[].doorOpenings` | the **opening** itself (width/position/geometry) |
| `pois[].interiorCirculation` | approach, circulation and interior path geometry |
| `pois[].spatialSockets` | physical placement geometry (what Gameplay attaches is Gameplay-owned) |
| `pois[].retreatPaths` | physical retreat geometry |
| `criticalPaths.geometry` | contiguous physical path geometry |

Classification in `../geo01/output/contract_boundary.v1.json`:
**`MAP_RESPONSIBILITY_NOT_IN_SOURCE`** (7 rows), status
`NOT_IN_SOURCE__MAP_DESIGN_REQUIRED`.

## Gameplay owns (unchanged)

Locked / key / power **states**, loot, power requirements, hazard intensity, interactions,
interactive machinery, recipes, population, spawns, economy, climate, passability rules,
survivability rules, and the protection policy behind `criticalPaths`. No furnace recipe, loot
table, lock, power node or machine is authored in this milestone.

## What changed on disk

- `../geo01/src/contract.mjs` → new `MAP_RESPONSIBILITY_NOT_IN_SOURCE` class, 7 corrected POI
  rows, split `doorOpenings` (Map) from `doors.lockedState` (Gameplay), corrected
  `retreatPaths` and `criticalPaths`, updated CD-03 / CD-04 / CD-07 / CD-08, added
  `ownershipCorrection` + `twoStageIntegrationSeam.stage1b` + `geo02Corrections`.
- `../geo01/output/contract_boundary.v1.json` regenerated (55 fields, 12 deltas).
- `../geo01/CONTRACT_DELTA.md`, `GEOGRAPHY_HANDOFF.md`, `README.md`, `CORRIDOR_PROOF.md`
  corrected.
- **`../geo01/output/geography.v1.json` is NOT rewritten.** It is an accepted export. Its stale
  `spatial.rooms.owner = "Gameplay / level design"` strings are enumerated and superseded by the
  reproducible overlay `output/ownership_correction.v1.json` instead of being silently edited.

## The bounded candidate

`output/poi_po_kilns.proposed.v1.json` is a **PROPOSED**, **non-canonical**, **Map-owned**
spatial design for **`po_kilns` only**. It contains footprint, approach, entrance options,
interior working-space allocation, circulation and retreat — no recipes, loot, locks, power,
interactive machinery, runtime merge or Gameplay population. Existing authored geometry and
newly proposed geometry are separate arrays with separate status flags.

Run: `node src/ownership.mjs`.
