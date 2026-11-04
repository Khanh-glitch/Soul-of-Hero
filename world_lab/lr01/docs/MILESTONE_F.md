# MAP-LR01 Milestone F — Stage 1 geography-only handoff

**Status:** `GEOGRAPHY_ONLY__STAGE_1__NO_GAMEPLAY_POPULATION`.
**Web playability gate:** **OPEN** — compiled geography, verified transform
metadata, minimal adapter spec and executable isolated tests are delivered; no
playable integration is claimed.

## 1. Two stages remain distinct

`src/f_handoff.mjs` emits `output/geography_package.v1.json`
(`soh.map.lr01.geography_package.v1`, schemaVersion 1, revision 1,
`packageId: veyra-geography-map-lr01`) whose digest is
`SHA-256(JSON.stringify(body))` and is recomputed by the continuous gates.
`output/handoff.v1.json` is the concise record; `output/pr44_handoff.md` is a
Map-owned handoff file with exact pins.

**STAGE 1 (Map, this package):** stable IDs / schema version / revision / digest
/ provenance / authored coords / transform metadata (`UNDECIDED`, full 2000×1400)
/ terrain, land-water, biome, elevation, slope, constraints / traversal topology
and route classes / build-site and loading geometry / POI footprint, rooms,
walls, floors, levels, entrances, portals, circulation, roof coverage, sockets /
Elder territories, approaches, arenas, separation / explicit UNKNOWN, PROPOSED,
BLOCKED, UNRESOLVED, DERIVED, SOURCE_AUTHORED, VALIDATED states. Payloads: 12
primary files, 41 region exports, 8 POI examples, 18 native views — all with
SHA-256.

**STAGE 2 (Gameplay, NOT here):** procedural resource population, source stock,
loot, money, vendors, economy, locks/keys/power, generators, machines, recipes,
quests, weather, AI, dynamic door states, destruction, player construction,
vehicle/passability rules, persistence, `RuntimeMapPackage` compilation. The
package's `noClaims` and `fieldOwnership` enforce this. `habitatMarkers` records
WHERE 280 source-authored markers are; it produces zero instances.

## 2. PR44 `GeographicHandoff` is an integration dependency, not a validator

Read at live HEAD `f8010ec973095c88f3c462a68116c169b61237a3`:
`web/src/game/geography-contract.ts` requires `economy:EconomyMap` and calls
`validateEconomyMap`, `compileEconomy`, `diagnoseStarts`; `PoiGeometry` requires
`powerNodes`, `hazardCells`, `exteriorLootSites`, `interiorLootSites`, `doors`,
`retreatPaths`; `GeographicHandoff` requires `nonbossCashSites`, `vendorSites`,
`evacuationSites`; `RoadGeometry` requires `widthTiles`, `surface`,
`cargoPassable`. `web/src/game/map-package.ts` requires exactly `200×200` tiles
of 16 px plus populated `buildings`, `statics` (loot/cash/vendor/door/gen),
`places` and Elders. A `git grep` over `web/src` + `web/tests` found **no
geography-only intake seam**.

Gameplay K6 handoff comment `6619055192` states verbatim that these mixed
validators are not the agreed geography-only contract, and that its POI adapter
uses existing runtime rectangles, not the future Veyra room/portal handoff.
Therefore **Map fabricates no Gameplay-owned field** to pass them.
`handoff.v1.json :: schemaCompatibility` says
`satisfiesGeographicHandoff: false`, `satisfiesRuntimeMapPackage: false` with the
reason, and lists `requiredFromGameplay`.

## 3. Integration proof: blocked, recorded precisely

`integrationGate.status = OPEN__WEB_PLAYABILITY_NOT_PROVEN`;
`realIntegrationProof = NOT_ATTEMPTED__NO_COMPATIBLE_GEOGRAPHY_ONLY_INTAKE_SEAM_AND_NO_CROSS_BRANCH_WRITE_AUTHORIZATION`.
Cross-branch **read** worked; cross-branch **push** to Gameplay was intentionally
NOT attempted (Gameplay ACK `6608030530`: each agent pushes only its own branch).
No exact-SHA worktree/handoff patch was applied, no merge, no cherry-pick, no
force-push, no canonical rewrite, no parallel fake survival game. Delivered
instead: compiled geometry, verified transform metadata, `docs/ADAPTER_SPEC.md`,
and `./reproduce.sh` with isolated tests.

Six blockers with feature ID / unit / coordinate / source file / SHA prefix /
expected-vs-actual / owner: undecided transform; `[732,652]` zero clearance and
unmeasured deck/width; `po_kilns` 56.8792 au cart gap; 8 ferries with no boat
rule; mixed validators with no pure intake seam; no cross-branch write
authorization. Ten explicit UNKNOWN/PROPOSED records are in the package.

## 4. Adapter spec

`docs/ADAPTER_SPEC.md` defines input digest verification, the hard stage
boundary, transform rules (no assumed `U`, no 8→16 reinterpretation, explicit
fractional mode), stable-ID preservation, static/dynamic split, six geometry
adapters, required Gameplay providers, joint validation gates, forbidden
actions, and the precise next integration step.

## 5. No-claims

No runtime resources/loot/money/generators/locks/weather; no dynamic door state
or construction; no cart-passable claim without clearance; no canonical rewrite;
no approved scale (U=2 diagnostic only); no runtime merge; no playable survival
acceptance; no creator visual approval; **no acknowledgement of any MAP-LR01
handoff yet**.

**Final:** `docs/FINAL_HANDOFF.md` reports exact local/remote HEAD/commits,
milestone status, coverage, artifacts, schemas/compat, inspected visuals/tests,
regressions, limitations, outstanding creator decisions and the next step.
