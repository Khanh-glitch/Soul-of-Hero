# Minimal Map → Gameplay geography adapter spec (NOT IMPLEMENTED)

**Status:** specification only. The Web playability gate is **OPEN**. This is the
minimal contract a later Gameplay-owned adapter must satisfy; it is not a
validator, not a compiler and not an integration proof.

## 1. Input

`output/geography_package.v1.json` — schema `soh.map.lr01.geography_package.v1`,
`schemaVersion: 1`, `revision: 1`, `packageId: veyra-geography-map-lr01`,
`revisionDigest = SHA-256(JSON.stringify(body))`.

Verification before any use:

1. canonical Veyra SHA-256 `88780f78…` and GEO-01/GEO-02 fingerprints from
   `provenance`;
2. recompute `revisionDigest` over `body`;
3. verify every `payloads.primary / regions / poiExamples / views` SHA-256;
4. verify `schemaVersion`, `revision`, `stage === STAGE_1_MAP_GEOGRAPHY` and
   `status === GEOGRAPHY_ONLY__STAGE_1__NO_GAMEPLAY_POPULATION`.

## 2. Hard stage boundary

The adapter consumes **STAGE 1 MAP GEOGRAPHY**. It must NOT invent STAGE 2
population/simulation fields, and must NOT call PR44's
`validateGeographicHandoff()` as a geography validator — that function requires
`EconomyMap`, cash/vendor/loot/power/door fields and calls `compileEconomy()`.
`RuntimeMapPackage` requires a populated 200×200×16 px runtime package. Neither
is the agreed geography-only intake.

## 3. Transform rules

* `body.frame.transform.status = UNDECIDED`. Do not assume `U`; do not
  reinterpret 8 authoring units as 16 runtime pixels; do not crop, warp or
  rescale the **2000×1400** frame.
* If a runtime tile grid is later approved, choose one explicit documented mode
  (`FLOOR_DROPS_PARTIAL_EDGE_STRIP`, `CEIL_PADS_BEYOND_FRAME`,
  `NONUNIFORM_RESAMPLE_REQUIRED`) and record fractional raster coverage,
  partial-edge tiles and source-cell resampling counts from Milestone A.
* `WW=WH=200`, `TILE=16`, the 1,000,000-cell economy cap and `cy*100+cx` chunk
  stride are **temporary engine constants**, not Veyra design laws.
* `250×175` @ 8 au/cell supplies geography, not final detail. `U<8` invents no
  new authored detail; `U>8` loses cells.

## 4. Stable identities

Preserve: 579 canonical feature IDs; `room.<poi>.<r>.<c>`, `wall.<poi>.<n>`,
`entrance.<poi>.1`, `portal.<poi>.<…>`, `socket.<poi>.<n>`,
`level.<poi>.<0|-1>`, `floor.<poi>.<…>`, `site.<zoneId>`; and route-graph node
IDs rederived at `SNAP_TOL=7`. IDs must survive persistence and dynamic-state
keying; Gameplay may add dynamic state keyed BY these IDs, never replace them.

## 5. Static / dynamic split

| MAP_STATIC (consume) | GAMEPLAY_DYNAMIC (provide) |
|---|---|
| walls, rooms, floors, roof coverage, static portal openings, circulation geometry | door open/closed/locked/destroyed, power/device state |
| sockets (fit envelopes with `gameplayObject: null`) | loot/cash/vendor instances, resource stock, recipes, quests |
| terrain / raster / biome legend / transitions | weather, environmental effects, exposure, AI |
| road/trail/bridge/dock geometry + route topology | vehicle speeds, weights, cart passability, swept clearance, ferry rule |
| build / loading envelopes | building rules, placement, construction, destruction |
| Elder outer/core/arena/approach geometry | combat behaviour, effects, persistence |

Six geometry adapters are exported per POI: `collision`, `enclosure`, `reach`,
`lineOfSight`, `roofCoverage`, `portalPassability`. The last has status
`UNKNOWN__DYNAMIC_DOOR_STATE_DESTRUCTION_AND_DEVICES_OWNED_BY_GAMEPLAY`.

## 6. Required Gameplay providers before any runtime claim

approved transform + mode · 12-code→runtime biome mapping · physical road width
and swept-clearance/cart-footprint rules · bridge deck/channel fit · ferry rule ·
dynamic door and device state · resource population and economy ·
`RuntimeMapPackage` compiler · persistence schema.

## 7. Validation gates (joint, later)

source integrity / 579 IDs · coast-water / raster transform / regional coverage
· physical widths / crossings / continuity / build-site / room / portal / retreat
· field ownership / stable identity / persistence prerequisites / placement ·
GEO-01 / GEO-02 / SCALE regressions · native 640×360 visual inspection.
**Never call static geography QA playable survival acceptance.**

## 8. Forbidden

fabricate loot/cash/vendor/generator/lock/weather · treat sockets as objects ·
treat the 13×7.2 au bridge glyph as collision · claim cart-passable without
clearance evidence · force Veyra into 200×200 · mutate Gameplay production
branches · build a parallel fake survival game · claim an acknowledgement that
does not exist.

## 9. Exact next step

Creator approves the au→tile transform; Gameplay implements a geography-only
intake seam that verifies this package digest and stable IDs; Gameplay then
populates/simulates and compiles `RuntimeMapPackage`. Only after that should an
exact-SHA worktree integration proof be attempted. Until then the deliverable is
compiled geometry + verified transform metadata + this spec + executable
isolated tests (`./reproduce.sh`).
