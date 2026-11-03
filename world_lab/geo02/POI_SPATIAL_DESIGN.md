# MAP-GEO-02 · `po_kilns` physical spatial design candidate

**`output/poi_po_kilns.proposed.v1.json` — status `PROPOSED`, `canonical: false`, owner `MAP`,
scope `po_kilns ONLY`. It is NOT merged into Veyra GOLD, NOT loaded at runtime, and NOT a
Gameplay population.**

## Why this exists

The Veyra GOLD `po_kilns` record has a 4-point `foot` site boundary (496.7424 au²),
`deep: null`, `depth: surface`, `gate: none`, `retreat: []`, `links: []` — and **no rooms,
entrances, passages, door openings or circulation**. The Greywater input handoff explicitly says
`foot` is a *site boundary, not a finished interior layout*. MAP-GEO-01 wrongly called those
missing physical fields Gameplay-owned; MAP-GEO-02 corrects the ownership and supplies a bounded
candidate so Gameplay can inspect a real POI shell rather than a bare polygon.

## Separation (hard requirement)

- `existingAuthored[]`: **verbatim** `po_kilns.foot`, `rd_16`, `rd_20`, `rd_n`. Never modified.
- `proposed[]`: every new item carries `status: "PROPOSED"`, `canonical: false`, `owner: "MAP"`.
- The candidate **does not enlarge** the canonical site boundary; all new polygons lie inside the
  verbatim foot. Approach/retreat are **centreline only** with `width: "NOT_DEFINED"`.
- `noRuntimeMerge: true`, `noGameplayPopulation: true`, `noCanonicalRewrite: true`.

## Geometry (all 2000×1400 authoring units)

A deterministic bilinear `(u,v)` frame spans the verbatim foot quad (`u=0` west, `u=1` east,
`v=0` north, `v=1` south). These fractions are **PROPOSED design parameters**, explicitly marked
`PROPOSED_DESIGN_PARAMETERS__NOT_SOURCE_VALUES__NOT_VALIDATED` — not source values, not physical
dimensions.

| Item | Geometry | Status |
|---|---|---|
| Footprint | reuse `po_kilns.foot` (no expansion) | PROPOSED boundary reference to EXISTING |
| Approach | `rd_16` last segment is EXISTING and **already terminates inside the foot** at `[905,785]`; exact `rd_16 × west-edge` intersection `[891.4531,786.1953]`; proposed centreline from that crossing into the interior | PROPOSED centreline only |
| Entrance A (primary, west) | centred on the **exact** `rd_16` crossing, `v = 0.6124 ± 0.10`, width 3.696au | PROPOSED physical opening |
| Entrance B (secondary, north) | `u 0.62..0.82` on `F0→F1`, faces `rd_20` control point `[926.9056,772.7915]` | PROPOSED physical opening |
| Entrance C (retreat/service, south) | `u 0.36..0.58` on `F2→F3`, faces `rd_n` | PROPOSED physical opening |
| Working spaces | 4 bilinear rectangles (WS1–WS4), 57.42 au² each — "covered enclosure / open yard / staging enclosure / transfer enclosure" | PROPOSED spatial allocation only |
| Circulation | east-west spine, north-south cross, 3 opening links (5 centrelines) | PROPOSED centrelines |
| Retreat | from opening C to the existing authored `rd_n` control point (geometric egress only) | PROPOSED centreline |

Each proposed path/polygon carries a `check` block: on-land fraction, river/lake cell counts,
minimum au clearance and authoring-space bounds, computed against the source-semantic masks.
That is **geometric context, not a passability rule, not swept clearance, not a survivability
claim**.

## Explicitly excluded

Furnace/kiln **recipes**, loot or loot sites, locked / key / power **states**, power nodes and
generators, hazard intensity, interactive machinery, spawn/resource/NPC placement, climate,
survivability or travel-time claims, physical width approvals, swept-clearance validation.
Entrances are **physical openings only**; door hardware, locks, power and interactions remain
Gameplay-owned.

## Unresolved constraints

- Authoring-unit → runtime-tile transform / world scale: `UNDECIDED`.
- Road width, river channel width, bridge deck span, cart/foot footprint: `UNDEFINED`.
- Swept clearance, collision, vertical/roof dimension: not modelled (2D candidate).
- `po_kilns` has **no cart road within editor `ACCESS_R=48`**; no cart access or physically
  traversable cart route is claimed.
- `rd_16` already penetrates the foot — reported, not silently "fixed".
- Requires creator/Map approval before any of it becomes canonical.

Run: `node src/poi_design.mjs`.
