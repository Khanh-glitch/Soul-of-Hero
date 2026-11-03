#!/usr/bin/env node
// MAP-GEO-01 milestone B: exact Map <-> Gameplay boundary against PR #44.
// Compares the derived geography export with the ACTUAL PR44 interfaces.
// Produces no RuntimeMapPackage, no dummy loot/cash/doors/sources/Elder mapping.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadSource } from './lib/source.mjs';
import { parseArgs, ensureOut, writeJson, DEFAULT_OUT, ROOT } from './lib/cli.mjs';

const PR44 = {
  commit: 'a956c9e85624c1ca7a2b5585eb423f8fa1cf296c',
  ref: 'refs/pull/44/head / arena/d4bfcfff-soul-of-hero',
  files: {
    'web/src/game/world-economy.ts': 'bcc87d4aef1c226229ccdfff77a896e95bd929f3ac4000c639bd62f5cd5c6fa7',
    'web/src/game/geography-contract.ts': '2dad5ff6d1ff7616ede7913b62b00b41566a4c5d2769c9180d89f432ecef34e3',
    'web/src/game/map-package.ts': '54b5821c0626f60011be3f68e65c57214a0d827b9f46dcd6950a763fb323603d',
    'web/src/game/core.ts': 'a9dcd43d4d0d58e4f85c465f3ba5a0fa02eca3e651140570002a2d7a1476975f',
  },
};
const sha = b => createHash('sha256').update(b).digest('hex');

function verifyGameplayFiles() {
  const out = {};
  for (const [name, expected] of Object.entries(PR44.files)) {
    let actual = null;
    try { actual = sha(Buffer.from(execFileSync('git', ['show', `${PR44.commit}:${name}`], { cwd: ROOT, maxBuffer: 8 * 1024 * 1024 }))); } catch { /* object may not be fetched in a fresh clone */ }
    out[name] = { expectedSha256: expected, gitBlobSha256: actual, verified: actual === null ? 'NOT_AVAILABLE_LOCALLY' : actual === expected ? 'MATCH' : 'MISMATCH' };
  }
  return out;
}

const CLS = {
  DIRECT: 'DIRECTLY_SUPPLIED_BY_MAP',
  TRANSFORM: 'DERIVABLE_FROM_MAP_WITH_VERIFIED_TRANSFORM',
  GAMEPLAY: 'SUPPLIED_BY_GAMEPLAY',
  JOINT: 'JOINTLY_VALIDATED',
  UNDEFINED: 'NOT_YET_DEFINED',
  // MAP-GEO-02 correction: physical geometry that Veyra has NOT authored is
  // still MAP-OWNED design work. "NOT_IN_SOURCE" is a status, never an owner.
  MAP_REQUIRED: 'MAP_RESPONSIBILITY_NOT_IN_SOURCE',
};

function field(scope, name, cls, o = {}) {
  return {
    field: `${scope}.${name}`, scope, classification: cls,
    mapSupply: o.map ?? null,
    veyraSource: o.veyra ?? null,
    transformRequired: o.transform ?? null,
    owner: o.owner ?? null,
    status: o.status ?? null,
    note: o.note ?? null,
  };
}

function main() {
  const args = parseArgs();
  const out = ensureOut(args.out ? path.resolve(args.out) : DEFAULT_OUT);
  const source = loadSource({ sourcePath: args.source || null });
  const geo = JSON.parse(fs.readFileSync(path.join(out, 'geography.v1.json'), 'utf8'));
  const corridor = JSON.parse(fs.readFileSync(path.join(out, 'corridor.v1.json'), 'utf8'));

  const F = [];
  const E = 'EconomyMap(world-economy.ts)';
  const G = 'GeographicHandoff(geography-contract.ts)';
  const R = 'RuntimeMapPackage(map-package.ts)';
  const T = 'Frame/transform';

  // --- frame / transform
  F.push(field(T, 'authoringCanvas', CLS.DIRECT, { map: 'frame.authoring 2000x1400 authoring units', veyra: 'project.world', status: 'SUPPLIED' }));
  F.push(field(T, 'sourceGrid', CLS.DIRECT, { map: 'frame.grid 250x175 cell=8 = 43,750 cells', veyra: 'project.terrain gw/gh/cell', status: 'SUPPLIED' }));
  F.push(field(T, 'authoringUnitToRuntimeTile', CLS.UNDEFINED, { map: 'frame.transform.status = UNDECIDED', owner: 'Map + Gameplay joint decision', status: 'OPEN', note: 'PR44 core.ts pins WW=WH=200, TILE=16 => exactly 40,000 runtime cells. Veyra is 43,750 source cells. No scale/crop/pad was applied.' }));
  F.push(field(T, 'journeyTimes', CLS.UNDEFINED, { owner: 'Gameplay + Map measurement', status: 'OPEN', note: 't_foot / t_cart_loaded / exposure_time require a real measured journey at an approved world scale.' }));

  // --- EconomyMap
  F.push(field(E, 'id/revision/seed', CLS.GAMEPLAY, { owner: 'Gameplay package identity', status: 'NOT_SUPPLIED', note: 'project.terrain.seed=2026 is a TERRAIN AUTHORING seed, NOT the runtime world seed. Do not reuse it as EconomyMap.seed.' }));
  F.push(field(E, 'width/height/tileSize', CLS.TRANSFORM, { map: '250x175 @ 8 authoring units', owner: 'Gameplay runtime constraint (WW=200, WH=200, TILE=16)', status: 'BLOCKED_BY_TRANSFORM', note: 'validateRuntimeMapPackage rejects any extent other than 200x200 @ 16.' }));
  F.push(field(E, 'biome', CLS.TRANSFORM, { map: 'rasters/biomeCode.u8 (12 raw codes)', veyra: 'project.terrain.biome', transform: 'approved raw-code -> one of 14 Biome strings', owner: 'Map + Gameplay', status: 'BLOCKED_BY_APPROVED_MAPPING', note: 'MAP-GEO-02: the 12-code legend WAS FOUND in the pinned Map Lab Studio v3 reference source (types.ts BIOMES), not in the canonical JSON and not from appearance. Caveat: code 0 is "meadow" on land but a no-biome SENTINEL on sea (28,624 cells). An approved 12->14 mapping + land/sea guard + UNKNOWN member is still required.' }));
  F.push(field(E, 'elevation', CLS.TRANSFORM, { map: 'rasters/elevation.u8 (0..243 raw bytes)', veyra: 'project.terrain.elev', transform: 'approved world-scale transform + grid transform', status: 'BLOCKED_BY_WORLD_SCALE', note: 'MAP-GEO-02: the unit IS resolved from source — byte/255 = abstract normalized height (0 = sea, 1..255 land), with NO approved real-world unit (Bible §11.5). Physical elevation and world scale remain UNDEFINED.' }));
  F.push(field(E, 'slope', CLS.TRANSFORM, { map: 'rasters/slope.u8 (0..150 raw byte gradient)', transform: 'approved normalization to Gameplay scale', owner: 'Map + Gameplay', status: 'BLOCKED_BY_NORMALIZATION', note: 'compileEconomy hardcodes slope > 0.6 as impassable; that threshold is a Gameplay rule with no source unit.' }));
  F.push(field(E, 'moisture', CLS.UNDEFINED, { owner: 'Gameplay / climate authority', status: 'UNKNOWN_IN_SOURCE', note: 'validateEconomyMap requires finite 0..1; Veyra has no moisture array. Map exposes freshwaterProximityCells as geometric POTENTIAL only.' }));
  F.push(field(E, 'temperature', CLS.UNDEFINED, { owner: 'Gameplay / climate authority', status: 'UNKNOWN_IN_SOURCE', note: 'Veyra has no temperature array; no season/weather model.' }));
  F.push(field(E, 'freshwater', CLS.TRANSFORM, { map: 'rasters/freshwater.u8 + lakes[]/rivers[] geometry', veyra: 'lakes[5], rivers[17]', transform: 'grid transform', status: 'SUPPLIED_AT_SOURCE_RESOLUTION' }));
  F.push(field(E, 'coast', CLS.TRANSFORM, { map: 'rasters/coast.u8 (812 cells)', veyra: 'land[8].rings', transform: 'grid transform', status: 'SUPPLIED_AT_SOURCE_RESOLUTION' }));
  F.push(field(E, 'walkable', CLS.JOINT, { map: 'rasters/walkableCandidate.u8', owner: 'Map geometry + Gameplay slope/collision/hazard rules', status: 'DERIVED_CANDIDATE', note: 'No slope threshold, collision or dynamic occupancy applied by Map.' }));
  F.push(field(E, 'buildable', CLS.JOINT, { map: 'rasters/buildableCandidate.u8 + zones[23]', owner: 'Map geometry + A0 protection/occupancy/collision', status: 'DERIVED_CANDIDATE' }));
  F.push(field(E, 'cargoPassable', CLS.UNDEFINED, { map: 'rasters/cargoCandidate.u8 (spatial candidate only)', owner: 'Gameplay loaded-cart slope/width/bridge rules', status: 'UNDEFINED', note: 'Physical capability is not established anywhere in the source.' }));
  F.push(field(E, 'road', CLS.TRANSFORM, { map: 'rasters/roadClass.u8 + roads[92] polylines', veyra: 'roads[92]', transform: 'grid transform', status: 'SUPPLIED_AT_SOURCE_RESOLUTION', note: 'road width is NOT authored.' }));
  F.push(field(E, 'protected', CLS.UNDEFINED, { map: 'rasters/protectedGeometryCandidate.u8 (geometry overlap only)', owner: 'A0 / Gameplay protection policy', status: 'NOT_DEFINED' }));
  F.push(field(E, 'industrial', CLS.UNDEFINED, { map: 'pois[81].arche (24 archetypes, provisional prose)', owner: 'Gameplay archetype mapping', status: 'NOT_DEFINED', note: 'No approved archetype -> industrial mask mapping.' }));
  F.push(field(E, 'starts', CLS.TRANSFORM, { map: 'spawns[4] with verbatim ids/coords', veyra: 'spawns[4]', transform: 'grid transform + integer tile bounds', status: 'SUPPLIED_AT_SOURCE_RESOLUTION' }));

  // --- GeographicHandoff
  F.push(field(G, 'economy', CLS.TRANSFORM, { map: 'output/geography.v1.json (partial EconomyMap inputs)', status: 'BLOCKED', note: 'See the EconomyMap rows; validateEconomyMap cannot pass without climate, legend and transform.' }));
  F.push(field(G, 'roads[].id', CLS.DIRECT, { map: 'roads[92].id', status: 'SUPPLIED' }));
  F.push(field(G, 'roads[].cells', CLS.TRANSFORM, { map: 'roadClass raster + polylines', transform: 'grid transform', status: 'BLOCKED_BY_TRANSFORM' }));
  F.push(field(G, 'roads[].surface', CLS.TRANSFORM, { map: 'roads[].kind (cart/trail/foot/riverside/ferry)', transform: 'approved kind -> surface string', status: 'BLOCKED_BY_MAPPING' }));
  F.push(field(G, 'roads[].widthTiles', CLS.UNDEFINED, { owner: 'Map + Gameplay', status: 'NOT_IN_SOURCE', note: 'Veyra roads have NO width field. MAP-GEO-02: Map Lab v3 rasterises ALL non-ferry roads with a 9u EDITOR ANALYSIS stroke (analysis.ts rasterRoads) and draws 3.4u/1.6u DISPLAY strokes (exporter.ts). Neither is an authored physical width or swept-clearance envelope. validateGeographicHandoff requires an integer 1..32 width and checks its cross-section.' }));
  F.push(field(G, 'roads[].bridgeCells', CLS.TRANSFORM, { map: 'bridges[12].at + crossingCandidate raster', transform: 'grid transform', status: 'SUPPLIED_AT_SOURCE_RESOLUTION', note: 'Bridge channel span fit is UNVERIFIED.' }));
  F.push(field(G, 'roads[].cargoPassable', CLS.UNDEFINED, { owner: 'Gameplay', status: 'UNDEFINED' }));
  F.push(field(G, 'pois[].id/kind', CLS.TRANSFORM, { map: 'pois[81].id + arche (24 values)', transform: 'approved arche -> 5-kind enum', status: 'BLOCKED_BY_MAPPING' }));
  // --- MAP-GEO-02 ownership correction -------------------------------------
  // MAP DESIGNS THE PHYSICAL WORLD. Physical POI rooms, entrances, passages,
  // door openings, interior circulation and retreat geometry are Map-owned
  // even when Veyra has NOT_IN_SOURCE. Locked states, loot, power, hazard
  // intensity and interactions stay Gameplay-owned.
  const MAP_STATUS = 'NOT_IN_SOURCE__MAP_DESIGN_REQUIRED';
  F.push(field(G, 'pois[].footprint', CLS.TRANSFORM, { map: 'pois[].foot / deep polygons', transform: 'grid transform', owner: 'Map (physical site boundary)', status: 'SUPPLIED_AT_SOURCE_RESOLUTION', note: 'foot is a SITE BOUNDARY, not a finished interior layout (AGENT_HANDOFF.md, Greywater input package).' }));
  F.push(field(G, 'pois[].entrances', CLS.MAP_REQUIRED, { owner: 'Map (physical openings)', status: MAP_STATUS, note: 'CORRECTED: entrances are physical geometry and Map-owned. Validator requires >=1 entrance inside the footprint; Map must author it. GEO-02 supplies a PROPOSED, non-canonical candidate for po_kilns only.' }));
  F.push(field(G, 'pois[].rooms', CLS.MAP_REQUIRED, { owner: 'Map (physical rooms / working-space allocation)', status: MAP_STATUS, note: 'CORRECTED: rooms are Map-owned physical space, not Gameplay population.' }));
  F.push(field(G, 'pois[].passages', CLS.MAP_REQUIRED, { owner: 'Map (physical passages)', status: MAP_STATUS, note: 'CORRECTED: 5 POIs author links; passages remain physical Map geometry.' }));
  F.push(field(G, 'pois[].doorOpenings', CLS.MAP_REQUIRED, { owner: 'Map (physical door openings)', status: MAP_STATUS, note: 'CORRECTED: the OPENING is physical geometry. A door LOCK/key/power condition is Gameplay-owned (see the next row).' }));
  F.push(field(G, 'pois[].interiorCirculation', CLS.MAP_REQUIRED, { owner: 'Map (physical circulation)', status: MAP_STATUS, note: 'CORRECTED: circulation / approach / retreat geometry is Map-owned.' }));
  F.push(field(G, 'pois[].spatialSockets', CLS.MAP_REQUIRED, { owner: 'Map (physical placement geometry)', status: MAP_STATUS, note: 'CORRECTED: physical sockets are Map geometry. What Gameplay attaches to them is Gameplay-owned; no functional assignment was invented here.' }));
  F.push(field(G, 'pois[].doors.lockedState/powerNodes/hazardIntensity/interactions', CLS.GAMEPLAY, { owner: 'Gameplay', status: 'NOT_SUPPLIED', note: 'Locked states, loot, power, hazard intensity and interactions remain Gameplay-owned. gate/access/role text in Veyra are provisional design notes (conf:proposal/assumption), not laws.' }));
  F.push(field(G, 'pois[].exteriorLootSites/interiorLootSites', CLS.GAMEPLAY, { owner: 'Gameplay', status: 'NOT_SUPPLIED', note: 'No dummy loot was constructed.' }));
  F.push(field(G, 'pois[].retreatPaths', CLS.MAP_REQUIRED, { map: '18 pois with retreat points (points only, no paths)', owner: 'Map (physical retreat geometry)', status: MAP_STATUS, note: 'CORRECTED: a retreat PATH is physical circulation, Map-owned. Retreat decisions/AI are Gameplay-owned.' }));
  F.push(field(G, 'criticalPaths', CLS.JOINT, { owner: 'Map physical path geometry + Gameplay protection policy', status: 'NOT_SUPPLIED', note: 'CORRECTED: contiguous path geometry is Map-owned; the protected/walkable policy is Gameplay-owned. Requires protected+walkable contiguous authored paths.' }));
  F.push(field(G, 'buildSites[].cells', CLS.JOINT, { map: 'zones[23] + buildableCandidate raster', owner: 'Map + A0', status: 'DERIVED_CANDIDATE' }));
  F.push(field(G, 'buildSites[].loadingCells', CLS.GAMEPLAY, { owner: 'Gameplay / cargo rules', status: 'NOT_SUPPLIED', note: 'Requires cargoPassable, which is UNDEFINED.' }));
  F.push(field(G, 'nonbossCashSites', CLS.GAMEPLAY, { owner: 'Gameplay', status: 'NOT_SUPPLIED', note: 'Validator requires a cash static above the escrow price. No cash/economy values were invented.' }));
  F.push(field(G, 'vendorSites', CLS.JOINT, { map: '2 pois with arche:chest_vendor (shells only)', owner: 'Gameplay vendor entity', status: 'CANDIDATE_SHELL_ONLY' }));
  F.push(field(G, 'evacuationSites', CLS.JOINT, { map: '3 pois with arche:evac (shells only)', owner: 'Gameplay evac entity', status: 'CANDIDATE_SHELL_ONLY' }));
  F.push(field(G, 'compileEconomy + diagnoseStarts', CLS.GAMEPLAY, { owner: 'Gameplay population algorithm', status: 'NOT_RUN', note: 'validateGeographicHandoff runs these internally; Map must not run Gameplay population to make a validator pass.' }));

  // --- RuntimeMapPackage
  F.push(field(R, 'schemaVersion/id/revision/seed/title/description', CLS.GAMEPLAY, { owner: 'Gameplay package registry', status: 'NOT_SUPPLIED' }));
  F.push(field(R, 'geometry', CLS.TRANSFORM, { map: 'geography.v1.json (partial)', status: 'BLOCKED', note: 'See GeographicHandoff rows.' }));
  F.push(field(R, 'tiles', CLS.TRANSFORM, { map: 'elevation/biome/land/water/road layers', transform: 'approved transform + raw-code -> runtime tile enum mapping', status: 'NOT_SUPPLIED', note: 'Exactly 40,000 cells required; 20 runtime tile classes in world.ts.' }));
  F.push(field(R, 'fresh', CLS.TRANSFORM, { map: 'freshwater raster', transform: 'grid transform', status: 'NOT_SUPPLIED', note: 'Validator requires fresh[i] === economy.freshwater[i].' }));
  F.push(field(R, 'zone', CLS.TRANSFORM, { map: 'zones[23]', transform: 'grid transform + zone id remap', status: 'BLOCKED_BY_RANGE', note: 'Runtime allows zone values 0..15; Veyra has 23 authored zone ids. No remap was invented.' }));
  F.push(field(R, 'seaDist', CLS.TRANSFORM, { map: 'seaDistanceCells raster (grid cells, x8 = au)', transform: 'unit + grid transform', status: 'NOT_SUPPLIED', note: 'Runtime cap 255 matches the derived raster cap, but the unit is different.' }));
  F.push(field(R, 'buildings', CLS.GAMEPLAY, { owner: 'Gameplay', status: 'NOT_SUPPLIED', note: 'POI foot/deep polygons are spatial shells, not Building records with roof/w/h.' }));
  F.push(field(R, 'statics', CLS.GAMEPLAY, { owner: 'Gameplay', status: 'NOT_SUPPLIED', note: 'No dummy loot, cash, powered doors, generators or source nodes were constructed.' }));
  F.push(field(R, 'places', CLS.GAMEPLAY, { owner: 'Gameplay', status: 'NOT_SUPPLIED', note: 'Validator requires all six runtime catalog ELDERS ids. Veyra has six DIFFERENT Elder identities (surtur/typhon/aion/atlas/argus/anubis); no fake six-way mapping was created.' }));
  F.push(field(R, 'validateRuntimeMapPackage dims', CLS.UNDEFINED, { owner: 'Map + Gameplay', status: 'HARD_BLOCKER', note: 'e.width!==WW || e.height!==WH || e.tileSize!==TILE is rejected unconditionally.' }));

  const counts = {};
  for (const f of F) counts[f.classification] = (counts[f.classification] || 0) + 1;

  const deltas = [
    { id: 'CD-01', severity: 'HARD_BLOCKER', target: 'core.ts / validateRuntimeMapPackage', problem: 'Runtime pins WW=WH=200, TILE=16 (40,000 cells); Veyra is 250x175 source cells of 8 authoring units (43,750 cells) on a 2000x1400 canvas.', requiredDelta: 'Approve and document an explicit authoring-unit -> runtime-tile transform (or relax the fixed extent). Supply measured journey times with the scale decision. Map will not silently rescale.' },
    { id: 'CD-02', severity: 'HARD_BLOCKER', target: 'validateEconomyMap', problem: 'moisture and temperature must be finite 0..1 per cell with no UNKNOWN representation; Veyra defines no climate.', requiredDelta: 'Add a climate sub-contract with an explicit unknown/undefined state (e.g. climateStatus + separate optional arrays), or let Gameplay supply climate. Map will not fabricate plausible numbers.' },
    { id: 'CD-03', severity: 'HARD_BLOCKER', target: 'validateEconomyMap / Biome', problem: 'biome must be one of 14 Gameplay strings; Veyra has 12 raw codes with NO legend embedded in the canonical JSON. MAP-GEO-02 found the 12-name legend in the pinned Map Lab v3 reference source, but it is on a different branch, not approved, and code 0 doubles as a sea sentinel.', requiredDelta: 'Approve + embed the source-derived 12-code legend with a land/sea guard, approve a 12->14 Biome mapping (and an UNKNOWN member if partial coverage is allowed), then a verified transform. Never infer the legend from colour/appearance.' },
    { id: 'CD-04', severity: 'HARD_BLOCKER', target: 'validateGeographicHandoff', problem: 'Requires entrances, rooms, doors, powerNodes, hazardCells, loot sites, retreatPaths, widthTiles, cargoPassable and criticalPaths — none authored in Veyra. MAP-GEO-01 wrongly classified POI rooms/entrances as Gameplay-owned.', requiredDelta: 'SPLIT BY CREATOR ARCHITECTURE: physical POI rooms, entrances, passages, door openings, interior circulation, spatial sockets and retreat paths are MAP responsibilities even when NOT_IN_SOURCE (GEO-02 supplies a PROPOSED, non-canonical candidate for po_kilns). Locked states, loot, power, hazard intensity and interactions remain GAMEPLAY responsibilities. Do not require Map to fabricate Gameplay fields, and do not require Gameplay to author physical geometry.' },
    { id: 'CD-05', severity: 'HARD_BLOCKER', target: 'validateGeographicHandoff', problem: 'A single validator calls compileEconomy + diagnoseStarts, i.e. Gameplay population, inside Map geometry validation.', requiredDelta: 'Two-stage validation: (1) Map geometry integrity; (2) Gameplay population/placement diagnostics after Gameplay has run. Map must not run Gameplay population to pass a validator.' },
    { id: 'CD-06', severity: 'CONTRACT_MISMATCH', target: 'validateRuntimeMapPackage zone', problem: 'zone array allows 0..15; Veyra authors 23 buildable zone ids.', requiredDelta: 'Widen the zone id space or approve an explicit zone remap. No remap was invented here.' },
    { id: 'CD-07', severity: 'CONTRACT_MISMATCH', target: 'RoadGeometry.widthTiles', problem: 'Veyra roads have no width field; validator requires an integer 1..32 and tests its cross-section.', requiredDelta: 'Either approve an authored width per road class (a joint decision) or allow widthStatus=UNKNOWN with a relaxed width check. Map keeps width NOT_IN_SOURCE.' },
    { id: 'CD-08', severity: 'CONTRACT_MISMATCH', target: 'compileEconomy slope', problem: 'Hardcoded slope > 0.6 impassable threshold; Map slope was a raw byte gradient with no unit. MAP-GEO-02 resolved the source unit: hypot(d(elev/255)/dx, d(elev/255)/dy) x 100 in abstract authoring units (a Map Lab heuristic, NOT a Bible value).', requiredDelta: 'Define a jointly approved normalization + threshold; expose it as a Gameplay rule, not a Map constant. Map Lab thresholds (buildSlopeMax 0.5 / cartSlopeMax 0.7 / footSlopeMax 1.5) are editor heuristics only.' },
    { id: 'CD-09', severity: 'CONTRACT_MISMATCH', target: 'places / ELDERS', problem: 'Runtime requires six catalog Elder ids; Veyra has six distinct named Elder territories with different identities.', requiredDelta: 'Approve an explicit identity mapping (or a new runtime Elder catalog). No six fake Elder mappings were created.' },
    { id: 'CD-10', severity: 'CONTRACT_MISMATCH', target: 'EconomyMap.seed', problem: 'Veyra project.terrain.seed=2026 is a terrain authoring seed, not a world/runtime seed.', requiredDelta: 'Keep package seed Gameplay-owned; do not reuse the terrain seed as world seed.' },
    { id: 'CD-11', severity: 'CONTRACT_MISMATCH', target: 'road raster / ferry', problem: '8 Veyra ferry paths are water routes with UNDEFINED boarding rules; runtime road raster is land-only.', requiredDelta: 'Add an explicit waterRoute / ferry concept with Gameplay boat rules; never flatten ferry into a land road.' },
    { id: 'CD-12', severity: 'CONTRACT_MISMATCH', target: 'statics / cash / escrow', problem: 'Validator requires a nonboss cash static above escrowChestPrice and matching door/gen/loot statics.', requiredDelta: 'Gameplay supplies all economy entities. Map supplies only POI shells and candidate site ids.' },
  ];

  const doc = {
    schema: 'soh.map.contract_boundary.v1',
    generatedBy: 'world_lab/geo01/src/contract.mjs',
    canonicalSourceSha256: source.fingerprint.sha256,
    geographyExportSha256: sha(fs.readFileSync(path.join(out, 'geography.v1.json'))),
    corridorProofSha256: sha(fs.readFileSync(path.join(out, 'corridor.v1.json'))),
    gameplayReference: { ...PR44, fileVerification: verifyGameplayFiles() },
    classificationLegend: CLS,
    classificationCounts: counts,
    fields: F,
    contractDeltas: deltas,
    ownershipCorrection: {
      schema: 'soh.map.ownership_correction.v1',
      appliedIn: 'MAP-GEO-02',
      supersedes: 'MAP-GEO-01 contract_boundary.v1.json / CONTRACT_DELTA.md (CD-04) and GEOGRAPHY_HANDOFF.md section 6',
      rule: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
      mapOwns: ['POI rooms', 'POI entrances', 'POI passages', 'physical door openings', 'interior circulation', 'physical spatial sockets', 'approach / retreat geometry', 'physical footprint / site boundary', 'corridor and road/river/bridge geometry'],
      gameplayOwns: ['locked / key / power states', 'loot', 'power requirements', 'hazard intensity', 'interactions and machinery', 'population, spawns, economy', 'climate', 'passability / survivability rules'],
      statusIsNotOwner: 'NOT_IN_SOURCE describes the CURRENT STATE of Veyra data; it never transfers ownership to Gameplay.',
      geo02Deliverable: 'world_lab/geo02/output/poi_po_kilns.proposed.v1.json — a separate, explicitly PROPOSED, non-canonical Map-owned spatial design candidate for po_kilns only. No runtime merge, no Gameplay population.',
    },
    twoStageIntegrationSeam: {
      stage1: 'Map: source-verified geography export (MAP-GEO-01) — deterministic, id-preserving, all unknowns explicit.',
      stage1b: 'Map: physical POI shell design (rooms, entrances, passages, door openings, circulation, retreat) — MAP RESPONSIBILITY. GEO-02 supplies a PROPOSED, non-canonical candidate for po_kilns only; canonical authoring still pending.',
      stage2: 'Gameplay: locked states, loot/cash, power, hazard intensity, interactions, Elder identity mapping, climate and economy rules, then compileEconomy / diagnoseStarts / validateRuntimeMapPackage.',
      joint: 'Approved transform + measured journey times + approved biome mapping + slope normalization + road width policy, then a versioned RuntimeMapPackage.',
      note: 'Do not build a RuntimeMapPackage from dummy data to make the validator pass.',
    },
    explicitlyNotSupplied: [
      'dummy loot tables', 'cash / escrow chests', 'powered doors / generators', 'final harvestable source nodes',
      'six fake Elder -> runtime ELDERS mappings',
      'CANONICAL POI rooms / entrances / interior circulation (NOT_IN_SOURCE in Veyra; now correctly classified MAP_OWNED, not fabricated here — see GEO-02 PROPOSED candidate)',
      'moisture / temperature / climate values', 'cargo capability verdicts', 'road widths',
      'a rescaled 200x200 tile array', 'survivability or travel-time claims',
    ],
    verdict: 'DIRECT_RUNTIME_INTAKE_BLOCKED__INDEPENDENT_GEOGRAPHY_EXPORT_PROVIDED',
    statement: 'The geography export is independently usable by a future Gameplay compiler (21 rasters + verbatim objects + derived topology). It is not a RuntimeMapPackage and does not attempt to satisfy validateRuntimeMapPackage.',
    corridorEvidence: {
      spawn: corridor.spawnSelection.chosen, poi: corridor.targetSelection.chosen,
      connected: corridor.physicalConnectivity.connected,
      primaryDistanceAu: corridor.routes.primary.totalDistanceAu,
      gridSteps: corridor.physicalConnectivity.gridSteps,
      crossings: corridor.physicalConnectivity.crossingCells.map(c => ({ bridgeId: c.bridgeId, riverId: c.riverId })),
      survivability: corridor.survivability.status,
    },
    geo02Corrections: {
      routeLabel: 'The MAP-GEO-01 label "Authored cart corridor via the br_4 river crossing" is misleading: only rd_b on RT-1 is kind:cart; rd_13 / rd_1w / rd_16 are kind:trail. GEO-02 audits this and does NOT claim a physically traversable cart route to po_kilns.',
      joinTolerance: 'GEO-01 used joinToleranceAu=8; the Map Lab v3 editor uses SNAP_TOL=7 (graph.ts). GEO-02 audits both.',
      encoding: 'See world_lab/geo02/output/maplab_encoding.v1.json for the source-derived biome legend, normalized elevation unit, road/river width semantics and graph constants.',
    },
  };
  writeJson(path.join(out, 'contract_boundary.v1.json'), doc);
  console.log(`CONTRACT_OK fields=${F.length} deltas=${deltas.length} counts=${JSON.stringify(counts)} verdict=${doc.verdict}`);
  console.log(`  ${path.relative(process.cwd(), path.join(out, 'contract_boundary.v1.json'))} ${fs.statSync(path.join(out, 'contract_boundary.v1.json')).size} bytes`);
}
main();
