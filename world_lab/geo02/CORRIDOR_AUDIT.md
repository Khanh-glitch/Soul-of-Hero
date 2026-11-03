# MAP-GEO-02 · `sp_lake → po_kilns` spatial geometry audit

Full machine-readable evidence: `output/corridor_audit.v1.json`.
Visual: `output/audit_before_after.svg` / `.png` / `.html`.

## Four connectivity layers — never conflated

| Layer | What it actually is | Result |
|---|---|---|
| **SOURCE_AUTHORED** | explicit river `mouth`/`source` refs, bridge `at`/`load`, 5 POI `links`, 43 exactly coincident road endpoint pairs. Veyra has **no road-to-road junction table** | explicit refs only; `rd_16` terminates *inside* `po_kilns.foot` |
| **DERIVED_ROAD_GRAPH** | GEO-01 endpoint+intersection graph @ `joinToleranceAu=8` (131 nodes / 105 edges) **vs** MapLab `graph.ts` `SNAP_TOL=7` over Catmull-Rom curves resampled at 8u | **incompatible**: 1,444 nodes @7 vs 790 @8; 773 consecutive-sample self-merges @8 would delete road edges in `graph.ts`. 4 endpoint joins exist only at 8 |
| **RASTER_CANDIDATE** | GEO-01 50-step `walkableCandidate` BFS; MapLab `stepMult` Dijkstra (foot/cart) | both `connected=true`, **but the Dijkstra path uses 0 river cells / no bridge and ~half its cells are off the 9u cart-road raster**. A connected raster is NOT a route |
| **PHYSICAL_CLEARANCE** | swept clearance, road width, channel width, bridge span | **UNPROVEN**. 1 zero-clearance cell (`[732,652]`, 0 au) on the GEO-01 path; `channelSpanFitVerified=false` |

## Audited items

- **Junction tolerances:** editor `SNAP_TOL=7` (comment: *"merge tolerance for graph nodes, same value the editor uses to attach endpoints"*). GEO-01 used 8. 4 endpoint joins (`rd_6/rd_o`, `rd_f/rd_g`, `rd_w/rd_1t`, `rd_w/rd_1u`, distances 7.21–7.68au) exist only at 8; 3 road/road intersections sit 7.19–7.66au from an endpoint. 64 exact road/road segment intersections.
- **Both bridges** (exact road × river intersections on smoothed curves):
  - `br_4` **cart** at `[732.0069,649.8171]`, covers `rd_b × rv_silver` at `[732.1486,649.7952]`, distance **0.1433au**, `BRIDGE-VALID` (<14u) PASS.
  - `br_a` **foot** at `[882.9744,646.9031]`, covers `rd_20 × rv_silver` at `[882.9405,646.9076]`, distance **0.0342au**, PASS; **cart blocked** (`graph.ts` blocks cart at any non-cart bridge). `rd_20` is `riverside` anyway.
  - `rv_silver.width = 4` → `riverMask` stroke `max(4,9) = 9u`; carve radius `max(20,4*4) = 20u`. The `13 × 7.2u` exporter rectangle is a **display glyph**, not a deck span.
- **Zero-clearance cells:** 1 on the GEO-01 BFS path, cell 20341 `[732,652]`, `crossingCandidate=2`, `br_4`, 0 au clearance. GEO-01 reported only `min 0 / mean 2.2941 cells`; GEO-02 lists the cell and gives au distances from MapLab masks.
- **River widths:** all 17 rivers carry an **editor stroke width**, a 9u-min mask stroke and a carve radius; physical channel width is `UNDEFINED` for every one.
- **Surface continuity:** all 3 routes have 0 off-land / 0 lake samples on their smoothed centrelines; RT-1/RT-2 cross 2 river-mask samples, RT-3 crosses 1; RT-3 has 1 sample outside the 9u road analysis stroke. `minClearanceAu = 0` on every route. Slope index 0.0245–0.5442 (MapLab heuristic, **not** a Gameplay law).
- **Derived connectors:** 4 straight lines (`RT-1` 37.20au, `RT-2` 37.20au, `RT-3` 55.14au + 62.57au). None is an authored road. All on land, 0 river/lake crossings, but the two RT-3 connectors **exceed editor `ACCESS_R=48`**. All flagged `NEEDS MAP SPATIAL AUTHORING`.
- **`po_kilns` access:** nearest foot road `rd_16` at 0au; nearest **cart** road `rd_n` at **56.8792au** → **no cart access within `ACCESS_R=48`**.

## Failing / needs-authoring paths (`failingOrNeedsAuthoring`)

| ID | Severity | Subject |
|---|---|---|
| F-01 | FAIL | RT-1/RT-2 label "Authored cart corridor" — only `rd_b` is cart, `rd_13`/`rd_1w`/`rd_16` are trails |
| F-02 | FAIL | `po_kilns` cart access (56.88au > 48au) |
| F-03 | NEEDS_AUTHORING | 4 derived connectors are not authored roads |
| F-04 | UNPROVEN | swept clearance at `br_4` |
| F-05 | NEEDS_REDERIVATION | road junction tolerance 8 ≠ 7 |
| F-06 | NEEDS_AUTHORING | `po_kilns` physical shell (`PROPOSED` candidate supplied) |
| F-07 | UNPROVEN | bridge span fit for both crossings |
| F-08 | FAIL_FOR_CART | `br_a` / `rd_20` crossing (RT-3 foot only) |

**No passability rule was invented.** `stepMult`, `RULES`, `FOOT_B`/`CART_B` and the 9u strokes are quoted from the pinned MapLab v3 source with
`MAPLAB_EDITOR_HEURISTIC__NOT_GAMEPLAY_PASSABILITY_LAW` authority.

> **No claim of physically traversable cart routes** until road/river widths, bridge deck span
> and swept clearance are validated. No runtime merge, no Gameplay population.
