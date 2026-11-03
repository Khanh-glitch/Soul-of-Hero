# MAP-GEO-01 — Map / Gameplay integration boundary against PR #44

**Command:** `node src/contract.mjs` → `output/contract_boundary.v1.json`
**Verdict:** `DIRECT_RUNTIME_INTAKE_BLOCKED__INDEPENDENT_GEOGRAPHY_EXPORT_PROVIDED`
**Compared against (git blob SHA-256 verified `MATCH`):**

| PR #44 file @ `a956c9e85624c1ca7a2b5585eb423f8fa1cf296c` | SHA-256 |
|---|---|
| `web/src/game/world-economy.ts` | `bcc87d4aef1c226229ccdfff77a896e95bd929f3ac4000c639bd62f5cd5c6fa7` |
| `web/src/game/geography-contract.ts` | `2dad5ff6d1ff7616ede7913b62b00b41566a4c5d2769c9180d89f432ecef34e3` |
| `web/src/game/map-package.ts` | `54b5821c0626f60011be3f68e65c57214a0d827b9f46dcd6950a763fb323603d` |
| `web/src/game/core.ts` | `a9dcd43d4d0d58e4f85c465f3ba5a0fa02eca3e651140570002a2d7a1476975f` |

No Gameplay loader, validator or game file was rewritten. No `RuntimeMapPackage` was built.

## Field classification (51 fields)

| Classification | Count | Meaning |
|---|---:|---|
| DIRECTLY_SUPPLIED_BY_MAP | 3 | Map supplies verbatim (authoring canvas, source grid, road/POI ids) |
| DERIVABLE_FROM_MAP_WITH_VERIFIED_TRANSFORM | 19 | e.g. `freshwater`, `coast`, `road`, `starts`, POI footprint, elevation raw — needs an approved transform first |
| SUPPLIED_BY_GAMEPLAY | 10 | locked states, loot, power, hazard intensity, cash, statics, places, package identity, population |
| JOINTLY_VALIDATED | 6 | `walkable`, `buildable`, `criticalPaths`, build sites, vendor/evac shells |
| NOT_YET_DEFINED | 10 | climate, road width, cargo capability, protected/industrial masks, world-scale transform |
| **MAP_RESPONSIBILITY_NOT_IN_SOURCE** | **7** | **MAP-GEO-02 correction:** physical POI rooms, entrances, passages, door openings, interior circulation, spatial sockets, retreat paths — Map-owned even though Veyra has not authored them |

> **Ownership correction (MAP-GEO-02).** MAP-GEO-01 wrongly placed POI rooms/entrances under
> Gameplay. `NOT_IN_SOURCE` is a *status*, never an *owner*. Physical door **openings** are Map
> geometry; the door **lock/key/power state** is Gameplay. A `PROPOSED`, non-canonical Map-owned
> spatial candidate exists for `po_kilns` only in `../geo02/`.

Full row-by-row table with `mapSupply / veyraSource / transformRequired / owner / status` is in
`output/contract_boundary.v1.json → fields`.

### Direct / derivable highlights

- `freshwater` ← `lakes[5]` + `rivers[17]` → `rasters/freshwater.u8`.
- `coast` ← 812 coast cells from 8 land rings → `rasters/coast.u8`.
- `road` ← 92 authored polylines → `rasters/roadClass.u8` (width NOT_IN_SOURCE).
- `starts` ← 4 verbatim spawn ids/coords.
- `POI footprint` ← 81 `foot`/`deep` polygons; `bridgeCells` ← 12 bridge positions.
- `elevation` / `biome` ← the two decoded 43,750-cell uint8 arrays. MAP-GEO-02 resolved their
  *source* semantics from the pinned Map Lab v3 reference: `byte/255` = abstract normalized height
  (0 = sea), and 12 named biome codes — but no approved world scale, no approved 12→14 `Biome`
  mapping, and code 0 is also a sea sentinel. See `../geo02/MAPLAB_ENCODING.md`.

### Map-owned physical geometry, `NOT_IN_SOURCE` (deliberately NOT fabricated)

POI `rooms`, `entrances`, `passages`, `doorOpenings`, `interiorCirculation`, `spatialSockets`,
`retreatPaths` and the physical portion of `criticalPaths`. Veyra has no such data; **Map must
author it**. GEO-02 ships a separate `PROPOSED` candidate for `po_kilns` only — no canonical
rewrite, no runtime merge.

### Gameplay-owned (deliberately NOT supplied)

`compileEconomy` / `diagnoseStarts`, locked/key/power **states**, `powerNodes`, `hazardIntensity`,
interactions, `exteriorLootSites`/`interiorLootSites`, `buildSites.loadingCells`,
`nonbossCashSites`, `cargoPassable`, `RuntimeMapPackage.statics` (loot/cash/vendor/evac/gen),
`buildings`, `places`, package identity, six runtime `ELDERS` ids.

**Nothing was invented to satisfy the validator:** no dummy loot, cash, powered door, generator,
source node, escrow chest, six fake Elder mapping, canonical POI room/entrance or climate value.

## The 12 precise contract deltas

| ID | Severity | Target | Problem | Required delta |
|---|---|---|---|---|
| CD-01 | HARD_BLOCKER | `core.ts` / `validateRuntimeMapPackage` | pins `WW=WH=200`, `TILE=16` (40,000 cells); Veyra = 250×175 cells of 8 authoring units (43,750 cells) on 2000×1400 | Approve + document an explicit authoring-unit → runtime-tile transform **with measured journey times**, or relax the fixed extent |
| CD-02 | HARD_BLOCKER | `validateEconomyMap` | `moisture`/`temperature` must be finite 0..1 with **no UNKNOWN representation**; Veyra has no climate | Add a climate sub-contract with an explicit unknown state, or let Gameplay supply climate |
| CD-03 | HARD_BLOCKER | `validateEconomyMap` / `Biome` | 14 fixed `Biome` strings; Veyra has 12 raw codes. MAP-GEO-02 **found** the 12-name legend in the pinned Map Lab v3 source (not in the canonical JSON, never inferred from appearance); code 0 doubles as a sea sentinel | Approve + embed the source-derived legend with a land/sea guard, approve a 12→14 mapping (+ UNKNOWN member) then a verified transform |
| CD-04 | HARD_BLOCKER | `validateGeographicHandoff` | requires `entrances`, `rooms`, doors, power, hazard, loot, `retreatPaths`, `widthTiles`, `cargoPassable`, `criticalPaths` — none authored. MAP-GEO-01 wrongly made rooms/entrances Gameplay-owned | **Map:** rooms/entrances/passages/door openings/circulation/sockets/retreat geometry (GEO-02 `PROPOSED` candidate for `po_kilns`). **Gameplay:** locked states, loot, power, hazard intensity, interactions. Two-layer handoff |
| CD-05 | HARD_BLOCKER | `validateGeographicHandoff` | a single validator runs `compileEconomy` + `diagnoseStarts` (Gameplay population) inside Map geometry validation | Two-stage validation: Map geometry integrity → Gameplay population diagnostics |
| CD-06 | CONTRACT_MISMATCH | `validateRuntimeMapPackage.zone` | zone values capped at 0..15; Veyra authors **23** zone ids | Widen the id space or approve an explicit remap (none invented) |
| CD-07 | CONTRACT_MISMATCH | `RoadGeometry.widthTiles` | Veyra roads have **no width**; Map Lab v3 uses a 9u **editor analysis stroke** and 3.4u/1.6u **display strokes**, neither physical | Approve an authored width per class, or allow `widthStatus=UNKNOWN` with a relaxed check; never promote the 9u stroke to a swept-clearance envelope |
| CD-08 | CONTRACT_MISMATCH | `compileEconomy` slope | hardcoded `slope > 0.6` impassable; source unit now resolved as `hypot(∂(elev/255)/∂x, ∂(elev/255)/∂y)×100` in abstract authoring units (a Map Lab heuristic, not Bible) | Define normalization + jointly approved threshold as a Gameplay rule |
| CD-09 | CONTRACT_MISMATCH | `places` / `ELDERS` | runtime requires 6 catalog Elder ids; Veyra has 6 **different** named territories | Approve an explicit identity mapping; no six fake mappings created |
| CD-10 | CONTRACT_MISMATCH | `EconomyMap.seed` | `project.terrain.seed=2026` is a terrain authoring seed, not a world seed | Keep package seed Gameplay-owned; do not reuse the terrain seed |
| CD-11 | CONTRACT_MISMATCH | road raster / ferry | 8 Veyra ferry paths are water routes with UNDEFINED boarding rules | Add a `waterRoute`/ferry concept with Gameplay boat rules; never flatten ferry into land road |
| CD-12 | CONTRACT_MISMATCH | `statics` / cash / escrow | validator requires a nonboss cash static above `escrowChestPrice` plus matching door/gen/loot statics | Gameplay supplies all economy entities; Map supplies shells + candidate site ids only |

### The single most important structural issue

`validateGeographicHandoff` **conflates Map geometry with Gameplay population**: it requires POI
loot sites, doors, power nodes, cash/vendor/evac statics and then runs `compileEconomy` +
`diagnoseStarts` itself. Under the creator's rule
`MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.`, Map cannot legitimately
make **the Gameplay half** of that validator pass. The geometry half (rooms, entrances, passages,
door openings, circulation, retreat) is Map-owned and must be authored by Map — see MAP-GEO-02.
Making the validator pass with dummy loot/power/cash would be exactly the fake map this task
forbids. The contract needs a two-stage handoff (CD-04 + CD-05).

## Integration seam (what to actually do next)

1. **Map (done):** source-verified geography export — 21 rasters, 579 verbatim objects, derived
   topology, all unknowns explicit. Independently usable now by a compiler that stays in
   authoring units.
2. **Map (MAP-GEO-02):** physical POI shell design is Map-owned even when `NOT_IN_SOURCE`.
   A `PROPOSED`, non-canonical candidate for `po_kilns` exists in `../geo02/`; corridor geometry
   is audited against the editor's own `SNAP_TOL=7`, both bridges and source-faithful masks.
3. **Joint decision:** approve the transform + measured journey times; approve the source-derived
   biome mapping and physical units; define slope normalization, road width policy, climate
   ownership, zone id space, ferry/waterRoute concept and the Elder identity mapping.
4. **Gameplay:** supply locked states, power/loot/interactions, cash/vendor/evac statics, `places`,
   package identity and the actual population algorithm; then run `compileEconomy`,
   `diagnoseStarts` and `validateRuntimeMapPackage` against a versioned `RuntimeMapPackage`.
5. **Validation:** native Godot/Web runtime intake with real input and day/night captures; creator
   visual approval. None of that is claimed here.

## Honest status

- PR #44 is **not merged** and was not modified.
- `RuntimeMapPackage` was **not** produced; `validateRuntimeMapPackage` was **not** run against a
  fabricated package.
- MAP-R01 art (`ce3f9c58` / `09b96bd2`) remains **not merged**, **not visually approved**. The
  existing Web sea, wave patterns and animation remain the preferred visual baseline pending
  separate aesthetic review.
- Veyra GOLD stays `PAPER ONLY - NOT NATIVE PRODUCTION`; MAP-GEO-01 is a derived geographic
  foundation, not native production and not a competing world source.
