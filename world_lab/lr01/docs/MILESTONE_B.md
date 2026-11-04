# MAP-LR01 Milestone B — whole-Veyra deterministic geography compiler

**Status:** `MILESTONE_B__WHOLE_WORLD_GEOGRAPHY_COMPILED__SOURCE_AUTHORED_IDS_PRESERVED`
**Stage:** STAGE 1 MAP GEOGRAPHY only. Gameplay population/simulation is NOT performed.
**Source:** canonical Veyra GOLD `19d8c6ec…`, SHA-256 `88780f78…`; full
**2000×1400 authoring frame unchanged**. No rescale, crop, warp or canonical rewrite.

## What was built

`src/lib/geo_compile.mjs` is a reusable, deterministic compiler over:

* all canonical authored polygons/polylines/points (579 objects, source IDs preserved);
* GEO-01's 21 verified u8 raster layers and GEO-02's 5 MapLab masks (43,750 cells,
  250×175 @ 8 au/cell) — the raster **supplies geography, not final detail**;
* GEO-02's verified 12-code biome legend and width/slope semantics.

`src/b_geography.mjs` emits one versioned `output/geography.v1.json`, one
`output/feature_status.v1.json` registry (579 rows) and **41 per-region exports**
(8 landmasses, 6 Elder territories, 23 construction zones, 4 spawns). Every
important feature carries `SOURCE_AUTHORED | DERIVED | PROPOSED | VALIDATED |
UNRESOLVED | BLOCKED | UNDECIDED` status with a `sourceRef`.

## Coverage

| canonical | count | derived in package |
|---|---:|---|
| landmasses | 8 | area/perimeter/bbox/centroid, coastline cells, beach band (≤2 cells from sea), wetlands, highland/steep bins, contained rivers/lakes/zones/Elders/POIs, biome & road-class histograms, walkable components |
| lakes / rivers | 5 / 17 | geometry, raster cell counts, authored `source`/`mouth` references, watershed components, dangling-reference and outlet-gap audit |
| roads / bridges / docks | 92 / 12 / 27 | centrelines, authored classification, explicit `physicalWidthAu: null` + `UNRESOLVED`, bridge glyph marked display-only |
| POIs | 81 | footprints handled in A and D; B records their parent land/zone context |
| construction zones | 23 | geometric build suitability (1,021 buildable cells), **PROPOSED** loading space (467 cells), natural choke clusters, nearest roads, walkable components |
| spawns | 4 | land/walkable/component/sea/freshwater/clearance, nearest dock/POI/zone/cart road, practical corridor reachability |
| resource habitat markers | 280 | WHERE the authored markers are; by-kind/radius/gate/density histograms only |
| Elder territories | 6 | outer/core/arena polygons, approach length, linked POIs, all 15 pairwise minimum outer separations |
| labels / biome legend | 24 / 12 | source colours and `sourceRef` retained |

Terrain: raw elevation bytes (`physicalScale: UNDEFINED`), raw slope deltas with
Editor thresholds marked `EDITOR_HEURISTIC__NOT_GAMEPLAY_PASSABILITY_LAW`,
descriptive lowland/highland/mountain/cliff bins, 24 top biome transitions and a
land↔water boundary count. **No moisture, temperature, hazard, climate or
Gameplay terrain mapping is fabricated** (`terrain.noMoistureOrTemperature`).

Hydrography is derived ONLY from authored `source`/`mouth` references: 1 connected
component, **0 dangling references**, 1 authored outlet gap (`rv_grey_low`
`mouth.kind="none"`), retained as `UNRESOLVED` instead of inventing a sea mouth.

Connectivity (4-neighbour, geometric only): 11 walkable components, 152 cargo
candidate components (dominated by isolated dock centre cells, **not** 152 cart
networks), 11 choke clusters. Each spawn reaches 16/23 zones on the geometric
BFS; the remaining 7 are recorded as `unreachableZones` — **not** as failures to
be silently repaired, because no ferry/bridge/slope law is approved.

## Explicit proposed changes (not canon)

`PC-B-01..08` are source-linked: cart-road connector alternatives for
`po_kilns`, foot-only `br_a`, `br_4` zero-clearance cell `[732,652]`, 8 ferry
roads `BLOCKED` until Gameplay owns a boat rule, `rv_grey_low` outlet, river
width unit, and 12 bridge deck proposals. `UN-B-01..05` record the undecided
transform, 12→14 biome mapping, climate fields, physical widths/swept clearance
and Elder combat behaviour.

## No-claims

No macro-geography rewrite, no canonical edit, no approved runtime scale, no
fabricated climate values, no runtime resource instances/stock/loot/locks/economy,
no cart-passable claim without clearance evidence, no playable survival
acceptance, no `200×200` / 1M-cell / chunk-stride design law. `250×175` is a
geography supply raster, not a final runtime detail grid.

**Next:** Milestone C rederives the transport graph at the verified
`SNAP_TOL=7` (GEO-01's tolerance-8 defect is not preserved).
