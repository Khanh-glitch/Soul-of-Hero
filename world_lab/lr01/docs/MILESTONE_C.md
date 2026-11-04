# MAP-LR01 Milestone C — full transport audit at verified SNAP_TOL=7

**Status:** `MILESTONE_C__FULL_TRANSPORT_AUDIT_AT_SNAP_TOL_7__NO_CART_PASSABILITY_CLAIM`
**Authority:** Map supplies physical space/constraints; Gameplay supplies vehicles,
speeds, loads, weights, building rules, placement and dynamic state.

## 1. Verified graph semantics, not preserved tolerance-8 defects

`src/lib/transport.mjs` ports the **verbatim** `world_lab/geo02/source_excerpt/`
`graph.ts` + `geom.ts` semantics: `catmull()` (9 au target, 2–28 samples per
segment), `resample(..., 8)`, `Idx.key(tol)` spatial-hash snap, `addEdge()`
dropping `a===b`, `SNAP_TOL=7`, `ACCESS_R=48`, `DOCK_R=40`, `BRIDGE_R=22`,
`reattach`-consistent hydrology, lake/sea/dock/ferry/POI access.

| | tol=7 (authoritative) | tol=8 (GEO-01 defect) |
|---|---:|---:|
| nodes | 1476 | 822 |
| foot edges | 1158 | 654 |
| cart edges | 682 | 383 |
| self-merged foot edges dropped | **81** | **596** |

Verdict: `GEO01_TOLERANCE_NOT_THE_EDITOR_TOLERANCE__DERIVED_GRAPH_MUST_BE_REDERIVED_AT_7`.
At tol=8, exactly-8 au resample steps merge into one node, so road edges are
silently dropped. GEO-02 F-05 is reproduced as evidence, **not** carried into
any transport conclusion. The 81 tol=7 self-merges are the short final resample
segments MapLab itself drops; they are reported, not hidden.

Graph over **active** edges (isolated `Idx.key` samples excluded): 18 foot
components, 26 cart components, 2 all-network components; raw counts including
isolated samples (324 / 792) are reported separately so neither is mistaken for
the other. **18 road×river crossings** are reproduced exactly, matching
`world_lab/geo02/output/corridor_audit.v1.json :: bridgeCrossings.allCrossings`.

## 2. Audit results

* 92 roads audited individually: sample count, foot/cart blocked edges, endpoint
  components, split routes, crossing counts and classification issues. 40 roads
  carry at least one classification issue; 1 foot and 6 cart routes are split
  across active components. `kind=trail` is explicitly **never** cart-passable
  without a Gameplay rule and a physical clearance dimension.
* 75 snap nodes join ≥2 roads; 13 are flagged `UNVERIFIED_JUNCTION` /
  `FALSE_JOIN_CANDIDATE__NODE_ON_WATER_CLASS` because they sit on water class or
  have `clearanceCells ≤ 1`. A 7 au editor snap is **topology, not a physical
  junction**.
* POI access at `ACCESS_R=48`: 81/81 have an active **foot** node;
  **57/81 have an active cart node**, and `po_kilns` is correctly in the 24
  without cart access (GEO-02 measured nearest cart road `rd_n` at 56.8792 au).
* 12 bridges: matched graph crossings, nearest road/river, raster river-centreline
  chord along the authored bridge axis, clearance cells. All keep
  `physicalDeckSpanAu: null`, `channelFitVerified: false`, `cartPassable: false`.
  The 13×7.2 au glyph remains `EDITOR_DISPLAY_ONLY__NOT_COLLISION_DIMENSION`.
* 8 ferry centrelines remain `SOURCE_AUTHORED_FERRY_CENTRELINE__NO_APPROVED_GAMEPLAY_BOAT_RULE`
  and are `BLOCKED` for runtime traversal; no boat is fabricated.
* 15 spawn→zone / spawn→POI / Elder-approach OD pairs were run through Dijkstra
  on the foot centreline graph; 5 have an alternate centreline after cutting the
  midpoint edge. These are **centreline connectivity** results — no ferry, deck,
  slope, cart clearance or survival cost is applied.
* 23 build sites with priority ranks, footprint polygons, measured buildable
  cells, **PROPOSED** build/loading envelopes, choke clusters, nearest roads,
  spawn distance and nearby POIs/Elders. Each keeps
  `occupancyStatus: UNKNOWN`, `claimLegalityStatus: GAMEPLAY_OWNED`,
  `sweptClearanceAu: null`. A site is space, not a house or a permission.

## 3. Explicit physical proposals (all PROPOSED / UNKNOWN)

`roadPhysicalProposals` gives all 92 roads an authored display stroke labelled
display-only, `physicalWidthAu: null` / `UNRESOLVED`, a measured
`clearanceCells` lower bound at authored vertices, an `availableWidthUpperBoundAu`
from GEO-01's clearance BFS, and a **PROPOSED** centreline buffer half-width.
`bridges[].proposedDeck` gives a **PROPOSED** span = measured raster river chord
+ one 8 au bearing cell each side, with `clearanceEvidence: NOT_MEASURED`.
`sweptClearanceAu` stays `null` because cart footprint / trailer sweep are
Gameplay-owned. **No `cartPassable: true` exists anywhere in the output.**

## 4. Source-linked failure cases

`output/transport_failures.v1.json` holds 7 cases with feature IDs, unit,
coordinate, source file, SHA prefix, expected vs actual, owner and status:
`F-C-01` tolerance defect; `F-C-02` `po_kilns`/`rd_n` cart gap; `F-C-03`
foot-only `br_a`; `F-C-04` zero clearance `[732,652]` at `br_4` (`BLOCKED`);
`F-C-05` 8 ferries without a boat rule (`BLOCKED`, owner Gameplay); `F-C-06`
`rd_13`/`rd_1w`/`rd_16` trail segments in RT-1; `F-C-07` river width unit.

## Deliverables

| path | content |
|---|---|
| `src/lib/transport.mjs` | MapLab-faithful graph rederivation, components, Dijkstra, path reconstruction |
| `src/c_transport.mjs` | audit + proposals + failure case generator |
| `output/transport.v1.json` | master audit package |
| `output/route_graph.v1.json` | 1476 nodes, 1158 foot edges, 682 cart edges at tol=7 |
| `output/build_sites.v1.json` | 23 prioritised physical build/loading envelopes |
| `output/transport_failures.v1.json` | 7 source-linked failure cases |

**Next:** Milestone D authors the 81 POI shells as real spatial structures with
stable room/portal/entrance/socket IDs, still without Gameplay devices or loot.
