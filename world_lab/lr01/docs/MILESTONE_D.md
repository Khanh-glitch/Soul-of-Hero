# MAP-LR01 Milestone D — 81 POIs as real spatial structures

**Status:** `MILESTONE_D__81_POI_STATIC_SPATIAL_LAYOUTS__INTERIORS_PROPOSED_NOT_CANON`
**Rule:** proposed interiors are separate from canon. Canonical Veyra is NOT rewritten.

## Architecture

`src/lib/poi_layout.mjs` is a reusable spatial authoring system. For each of the
81 canonical POIs it takes the **source-authored** foot quad, optional `deep`
polygon, `at`/`rot`/`scale`, `arche`, `gate`, `links`, `retreat` waypoints and
`access` text, and derives **PROPOSED** static geometry in the unchanged
`2000×1400` authoring frame:

| derived | detail |
|---|---|
| shell | 4 exterior walls from the POI's OWN foot edges; wall thickness `min(2 au, 8% of that POI's own shortest edge)` — per-POI, never a global constant |
| rooms | archetype-specific grid (`rows×cols`), each room polygon inset by half the wall thickness, with its own floor ID |
| interior walls | grid split lines, opaque for LOS |
| entrance | one PROPOSED opening on the edge nearest an authored road; `capacityUpperBoundAu` = that edge's length |
| portals | exterior portal + interior doorways between adjacent rooms + vertical link for deep levels |
| circulation | BFS depth from the entrance room, `interiorDepthAu`, reachable-room count |
| approach / retreat | nearest authored road and distance; canonical retreat **waypoints** (18 POIs) with the anchor→waypoint segment marked DERIVED; no invented full corridor |
| sockets | stable fit envelopes with `gameplayObject: null`, `purpose: SPATIAL_FIT_ONLY` |
| levels | GROUND for all 81; DEEP for the 18 canonical `deep` polygons, with `verticalSeparationAu: null` / `UNRESOLVED` |
| roof | measured coverage from PROPOSED room/canopy polygons, weighted by coverage fraction |

**24 archetypes** each have their own template (grid, roof, socket count,
pattern): 22 distinct spatial patterns, from `research` 2×2 study cells to
`quarry` unroofed terraced pit, `warehouse` long aisle, `port` dockside loading,
`ragnarok_cache` antechamber+vault, `elder_site` arena ring, `pier` linear deck.
Milestone A's derived enclosure class decides whether a room is enclosed;
open/mixed yards can still get a **partial canopy**, never a fake enclosed room.
Region context (land, biome, zone, Elder geometry, sea distance, clearance,
nearest road/dock) adds explicit modifiers. This is systematic coverage, **not
one generic room copied onto 81 POIs**.

Eight representative examples are exported separately with reasons:
`output/poi_examples/{po_kilns,po_academy,po_fracquarry,po_mere,po_rc_meridian,po_hall_eyes,po_siloc,po_strait}.v1.json`.
`po_kilns` uses the GEO-02 **PROPOSED** 3.696 au west opening as a worked
example — `openingStatus: GEO02_PROPOSED_WEST_OPENING__NON_CANONICAL` — and is
placed on the POI's west edge (wall 4, x≈891.59 au).

## Measured output

`D_POI_OK pois=81 archetypes=24 rooms=210 walls=410 portals=235 sockets=456
levels=99 deep=18 stableIds=1701 dup=0 examples=8`.

Stable IDs are `room.<poi>.<r>.<c>`, `wall.<poi>.<n>`,
`entrance.<poi>.1`, `portal.<poi>.<…>`, `socket.<poi>.<n>`,
`level.<poi>.<0|-1>`, `floor.<poi>.<…>` — all carry `parentPoiId`. A duplicate
check runs in the generator and in the continuous gates.

## Shared spatial-kernel adapters (TARGET, not source truth)

Every layout exports six consistent static views:
`collision` (static wall IDs + PROPOSED thickness, dynamic collision owned by
Gameplay), `enclosure` (enclosed area fraction + derived class),
`reach` (interior depth, approach length, min portal opening — **no** Gameplay
reach rule), `lineOfSight` (opaque wall IDs, transparent portal IDs, dynamic
opacity owned by Gameplay), `roofCoverage`, and `portalPassability`
(`UNKNOWN__DYNAMIC_DOOR_STATE_DESTRUCTION_AND_DEVICES_OWNED_BY_GAMEPLAY`).
Gameplay ACK `6608030530` calls the shared K6 kernel a **target**; Map exports
the static half only.

## Not authored (explicit)

No loot, chest contents, vendor inventory, money or economy; no locked-door rule,
key, card or power requirement; no generator, machine, recipe, quest or device;
no dynamic door state, destruction or player construction; no approved vertical
unit / stair geometry; no runtime tile binding; no playable acceptance. A socket
means **where an object could fit**, not that an object exists. Canonical Veyra
authors no door openings — every entrance is `PROPOSED`.

## Deliverables

`src/lib/poi_layout.mjs`, `src/d_poi.mjs`,
`output/poi_layouts.v1.json` (all 81 + 24-archetype coverage + 6 adapters),
`output/poi_summary.v1.json`, `output/poi_examples/*.v1.json` (8).

**Next:** Milestone E produces real in-world native `640×360` previews with
traceable asset provenance, then Milestone F packages geography-only handoff.
