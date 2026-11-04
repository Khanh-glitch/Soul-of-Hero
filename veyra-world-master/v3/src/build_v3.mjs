#!/usr/bin/env node
// SOH MAP AGENT — WMP-03 PHYSICAL SEMANTICS CORRECTIVE — deterministic compiler.
// ADDITIVE ONLY. Reads pinned WMP-01 / WMP-02 bytes; writes ONLY v3/.
// Four P0 corrections + bounded structural checks; NO runtime, NO Gameplay edits,
// NO invented physical units, NO auto-shrink of roofs, NO canonical POI redesign.
import fs from 'node:fs';
import path from 'node:path';
import { createWorld } from '../../api/world.mjs';
import { loadRasters, loadDerivedRasters, STATUS } from '../../lib/wmp.mjs';
import {
  V3, MASTER, GW, GH, CELL, N, sha256, digest, r4, idx, gxOf, gyOf, centreAu, toCell,
  readJson, readBuf, dist, distPointSegment, pointInRing, quantile, rankCdf,
  neighbours8, neighbours4, adjacent4, legacyXYPath, correctedPath, pathDrift,
  polylineLengthAu, polygonCells, components as connectedComponents, bboxOfCells,
  classifyTerrain, classifyWaterTraversal, classifyConstruction, footprintsFrom,
  writeV3Json, writeV3U8, shaV3, shaMaster, v3Path, VOCAB, OWNER,
} from './lib_v3.mjs';

// ---------------------------------------------------------------- 0. deterministic output reset
for (const d of ['layers', 'rasters', 'interfaces', 'handoff', 'evidence/views', 'evidence/tests', 'evidence/windows']) {
  fs.rmSync(path.join(V3, d), { recursive: true, force: true });
}

const W = createWorld();
const { C, architecture, envelopes } = W._internal;
const S = loadRasters();               // 21 SOURCE_AUTHORED rasters, digest-verified
const D = loadDerivedRasters();        // 32 WMP-01 derived rasters, digest-verified
const V2_HANDOFF = readJson('v2/handoff/geographic_handoff.v2.json');
const V2_BUILD_SITES = readJson('v2/layers/build_sites.v2.json');
const V2_TRANSPORT = readJson('v2/layers/transport_corrections.v2.json');
const V2_ROOFS = readJson('v2/layers/roof_assessment.v2.json');
const V2_MANIFEST = readJson('v2/manifest.v2.json');

const PINNED = {
  'manifest.v1.json': shaMaster('manifest.v1.json'),
  'v2/manifest.v2.json': shaMaster('v2/manifest.v2.json'),
  'v2/handoff/geographic_handoff.v2.json': shaMaster('v2/handoff/geographic_handoff.v2.json'),
  'data/source_manifest.v1.json': shaMaster('data/source_manifest.v1.json'),
};
if (V2_MANIFEST.revisionDigest !== '872502373e783b190f94a3c86065d6b3fd8c08d010b2ecc4130623f4283a682d')
  throw new Error('WMP03_V2_BASELINE_DIGEST_MISMATCH');

// ---------------------------------------------------------------- 1. TERRAIN (P0-01)
// WMP-01 defect: `slopeRaw > 200` cliff / `slopeClass >= 3` thresholds are above
// the observed source raster maximum (150), so cliff.u8 is entirely zero and
// slopeClass 3/4 are unreachable. v3 derives classes from OBSERVED quantiles of
// real slope, elevation, 3x3 neighbourhood relief/convexity and region geometry.
const slopeMax = Math.max(...Array.from(S.slope));
const slopeMin = Math.min(...Array.from(S.slope));
const q = (values, p) => quantile(values, p);
const v1CliffThreshold = 200;             // verbatim WMP-01 build.mjs:161,163
const v1CliffCellCount = Array.from(D.cliff).reduce((a, b) => a + b, 0);
const v1SlopeClassHistogram = (() => { const h = {}; for (const v of D.slopeClass) h[v] = (h[v] || 0) + 1; return h; })();

// Region geometry from authored rasters (1-based zoneId / elderGeometryId).
const ZONES = C.zones;
const zoneIndexById = new Map(ZONES.map((z, k) => [z.id, k + 1]));
const tag = z => (z.tags || []).join('|');
const highRockZoneCodes = ZONES.map((z, k) => [z, k + 1]).filter(([z]) => tag(z).includes('nền đá cao')).map(([, k]) => k);
const lowlandZoneCodes = ZONES.map((z, k) => [z, k + 1]).filter(([z]) => tag(z).includes('bình nguyên')).map(([, k]) => k);
const ELDER = C.elders;
const typhonCode = ELDER.findIndex(e => e.id === 'el_typhon') + 1;
const cinderZoneCode = zoneIndexById.get('bz_cinder');
const rockBiomes = [7, 8, 9];       // rock, snow, volcanic (source biomeCode, VERBATIM)
const snowBiome = 8, wetlandBiome = 4, volcanicBiome = 9;
const inCodes = (v, a) => a.includes(v);

// PURE production classifier (also exercised by independent negative fixtures).
const T = classifyTerrain(S, { highRockZoneCodes, lowlandZoneCodes, typhonCode, rockBiomes });
const { dryCells, Q, WEIGHTS, CLASS_CUTS, heightClass, cliff: cliffV3, terrace: terraceV3,
  slopeClass: slopeClassV3, relief, convexity, steepNeighbours, cliffSlope, cliffRelief,
  heightHistogram, slopeHistogram, cliffCount, terraceCount } = T;
const hist = a => { const h = {}; for (const v of a) h[v] = (h[v] || 0) + 1; return h; };
if (cliffCount === 0) throw new Error('WMP03_TERRAIN_FAIL cliff classification still empty');

// Non-exclusive region evidence. Overlaps are intentional and reported.
const REGIONS = [
  { id: 'TYPHON_TERRITORY', sourceRef: 'GOLD project.elders[id=el_typhon].outer => elderGeometryId raster', mask: i => S.elderGeometryId[i] === typhonCode, expected: 'high relief / steep faces' },
  { id: 'CINDER_VOLCANIC', sourceRef: 'GOLD project.zones[id=bz_cinder] + source biomeCode=9 volcanic', mask: i => S.zoneId[i] === cinderZoneCode || S.biomeCode[i] === volcanicBiome, expected: 'highest cliff density' },
  { id: 'SNOW_BIOME', sourceRef: 'source biomeCode=8 snow', mask: i => S.biomeCode[i] === snowBiome, expected: 'highest raw elevation' },
  { id: 'WETLAND_BIOME', sourceRef: 'source biomeCode=4 marsh', mask: i => S.biomeCode[i] === wetlandBiome, expected: 'flat, zero cliff faces' },
  { id: 'LOWLAND_ZONES', sourceRef: 'GOLD project.zones tags include "bình nguyên"', mask: i => inCodes(S.zoneId[i], lowlandZoneCodes), expected: 'flat, zero cliff faces' },
  { id: 'HIGH_ROCK_ZONES', sourceRef: 'GOLD project.zones tags include "nền đá cao"', mask: i => inCodes(S.zoneId[i], highRockZoneCodes), expected: 'elevated steep faces' },
];
const regionEvidence = REGIONS.map(r => {
  const cells = dryCells.filter(r.mask);
  const h = {}; let cliff = 0, terrace = 0, sumS = 0, sumE = 0;
  for (const i of cells) { h[heightClass[i]] = (h[heightClass[i]] || 0) + 1; cliff += cliffV3[i]; terrace += terraceV3[i]; sumS += S.slope[i]; sumE += S.elevation[i]; }
  return {
    id: r.id, sourceRef: r.sourceRef, expectedPhysicalSignature: r.expected,
    cellCount: cells.length, status: VOCAB.VERIFIED,
    meanSlopeRawByte: r4(sumS / Math.max(1, cells.length)),
    meanElevationRawByte: r4(sumE / Math.max(1, cells.length)),
    slopeRawByteP50: q(cells.map(i => S.slope[i]), 0.5), slopeRawByteP95: q(cells.map(i => S.slope[i]), 0.95),
    elevationRawByteP50: q(cells.map(i => S.elevation[i]), 0.5),
    heightClassHistogram: h, cliffCandidateCount: cliff, terraceCandidateCount: terrace,
    cliffPerThousandCells: r4(cliff / Math.max(1, cells.length) * 1000),
  };
});
const byId = Object.fromEntries(regionEvidence.map(r => [r.id, r]));
if (byId.WETLAND_BIOME.cliffCandidateCount !== 0 || byId.LOWLAND_ZONES.cliffCandidateCount !== 0)
  throw new Error('WMP03_TERRAIN_FAIL flat regions acquired cliff faces');
if (!(byId.CINDER_VOLCANIC.cliffPerThousandCells > byId.WETLAND_BIOME.cliffPerThousandCells) ||
    !(byId.TYPHON_TERRITORY.cliffPerThousandCells > byId.LOWLAND_ZONES.cliffPerThousandCells))
  throw new Error('WMP03_TERRAIN_FAIL region ordering not physically meaningful');
if (!(byId.SNOW_BIOME.meanElevationRawByte > byId.LOWLAND_ZONES.meanElevationRawByte))
  throw new Error('WMP03_TERRAIN_FAIL snow elevation ordering not physically meaningful');

writeV3U8('rasters/heightClass.v3.u8', heightClass);
writeV3U8('rasters/cliffCandidate.v3.u8', cliffV3);
writeV3U8('rasters/terraceCandidate.v3.u8', terraceV3);
writeV3U8('rasters/slopeClass.v3.u8', slopeClassV3);
writeV3Json('layers/terrain_height_class.v3.json', {
  schema: 'soh.wmp.v3.terrain_height_class', authority: 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT',
  status: 'PHYSICAL_TERRAIN_CLASSIFICATION_PROPOSED__NOT_A_COLLISION_OR_CLIMB_LAW',
  previousDefect: {
    id: 'P0-WMP03-T01', exactSource: 'build.mjs:151,156,161-163', criterion: 'slopeRaw > 200 => cliff / slopeClass>=3',
    v1CliffThreshold, observedSourceRaster: 'data/rasters/geo01/slope.u8', observedMinRawByte: slopeMin, observedMaxRawByte: slopeMax,
    v1CliffCellCount, v1SlopeClassHistogram, verdict: 'THRESHOLD_EXCEEDS_OBSERVED_MAXIMUM__NO_CLIFF_CELL_EVER_CLASSIFIED',
  },
  unitPolicy: {
    slopeUnit: 'UNRESOLVED__RAW_SOURCE_BYTE', elevationUnit: 'UNRESOLVED__RAW_SOURCE_BYTE',
    reliefUnit: 'UNRESOLVED__RAW_SOURCE_BYTE_DIFFERENCE', physicalUnitStatus: 'UNKNOWN',
    noMetres: true, noDegrees: true, noClimbRule: true,
    note: 'Every boundary below is an OBSERVED empirical quantile of the actual source raster, not an invented physical constant or Gameplay balance rate.',
  },
  observedQuantiles: Q, analyticWeights: WEIGHTS, scoreCutQuantiles: [0.5, 0.75, 0.9, 0.97, 0.995], classCuts: CLASS_CUTS,
  degenerateInputGuard: T.degenerateInput, degenerateGuardNote: 'A perfectly flat / zero-spread source has no relief ordering and therefore no steep faces; absolute-zero quantile thresholds must never make every cell a cliff.',
  classVocabulary: ['0 LOWLAND_FLAT', '1 GENTLE_RISE', '2 ROLLING', '3 HILL_TERRACE', '4 STEEP_FACE', '5 RELIEF_HIGH'],
  cliffRule: { heightClassAtLeast: 4, slopeRawByteAtLeast: cliffSlope, localReliefRawByteAtLeast: cliffRelief, minSteep8Neighbours: 2, basis: 'connected steep FACE, not an isolated byte; all four inputs are measured' },
  regionGeometryInputs: { highRockZoneCodes, lowlandZoneCodes, typhonElderCode: typhonCode, cinderZoneCode, rockSnowVolcanicBiomeCodes: rockBiomes, sourceRef: 'data/rasters/geo01/{zoneId,elderGeometryId,biomeCode}.u8' },
  dryLandCellCount: dryCells.length, heightClassHistogram: heightHistogram, slopeClassHistogram: slopeHistogram,
  cliffCandidateCount: cliffCount, terraceCandidateCount: terraceCount, regionEvidence,
  rasters: [
    { file: 'v3/rasters/heightClass.v3.u8', sha256: shaV3('rasters/heightClass.v3.u8'), semantics: '0..5 OBSERVED-QUANTILE relief class' },
    { file: 'v3/rasters/cliffCandidate.v3.u8', sha256: shaV3('rasters/cliffCandidate.v3.u8'), semantics: 'binary connected steep face' },
    { file: 'v3/rasters/terraceCandidate.v3.u8', sha256: shaV3('rasters/terraceCandidate.v3.u8'), semantics: 'binary hill/terrace band' },
    { file: 'v3/rasters/slopeClass.v3.u8', sha256: shaV3('rasters/slopeClass.v3.u8'), semantics: '0..4 observed-quantile slope class' },
  ],
  validation: 'Typhon / Cinder / snow / wetland / lowlands measured above; flat regions have zero cliff faces; snow has highest raw elevation.',
  noClaims: ['NO metres or degrees', 'NO collision or climb law', 'NO production tileset', 'NO Gameplay balance rate'],
});

// ---------------------------------------------------------------- 2. ROADS (P0-02)
// WMP-02 defect: intake_v2.mjs rasterPath() walks all X then all Y. v3 uses a
// 4-connected shape-preserving chain and keeps BOTH measurements for proof.
const ferryIds = new Set(C.roads.filter(r => r.kind === 'ferry').map(r => r.id));
const roadMetrics = [];
const correctedCellsByRoad = new Map();
for (const r of C.roads) {
  const legacy = legacyXYPath(r.points);
  const corrected = correctedPath(r.points);
  correctedCellsByRoad.set(r.id, corrected);
  for (let k = 1; k < corrected.length; k++) if (!adjacent4(corrected[k - 1], corrected[k]))
    throw new Error(`WMP03_ROAD_NOT_4_CONNECTED ${r.id} ${corrected[k - 1]}->${corrected[k]}`);
  if (corrected[0] !== toCell(r.points[0][0], r.points[0][1]) || corrected.at(-1) !== toCell(r.points.at(-1)[0], r.points.at(-1)[1]))
    throw new Error(`WMP03_ROAD_ENDPOINT_DRIFT ${r.id}`);
  const authoredLengthAu = polylineLengthAu(r.points);
  const ld = pathDrift(r.points, legacy), cd = pathDrift(r.points, corrected);
  roadMetrics.push({
    id: r.id, kind: r.kind, vertexCount: r.points.length, authoredLengthAu,
    legacyCellCount: legacy.length, correctedCellCount: corrected.length,
    legacyPathLengthAu: (legacy.length - 1) * CELL, correctedPathLengthAu: (corrected.length - 1) * CELL,
    legacyMaxDriftAu: ld.maxDriftAu, correctedMaxDriftAu: cd.maxDriftAu,
    legacyMeanDriftAu: ld.meanDriftAu, correctedMeanDriftAu: cd.meanDriftAu,
    maxDriftReductionAu: r4(ld.maxDriftAu - cd.maxDriftAu),
    correctedLengthOverAuthored: r4((corrected.length - 1) * CELL / Math.max(1e-9, authoredLengthAu)),
    legacyLengthOverAuthored: r4((legacy.length - 1) * CELL / Math.max(1e-9, authoredLengthAu)),
    endpointStartCell: corrected[0], endpointEndCell: corrected.at(-1),
    connectivity: 'VERIFIED_4_CONNECTED', status: VOCAB.VERIFIED,
  });
}
if (roadMetrics.length !== 92) throw new Error('WMP03_ROAD_COUNT_FAIL');
if (new Set(roadMetrics.map(r => r.id)).size !== 92) throw new Error('WMP03_ROAD_ID_DUPLICATION');
const agg = k => ({
  sum: r4(roadMetrics.reduce((a, r) => a + r[k], 0)),
  max: r4(Math.max(...roadMetrics.map(r => r[k]))),
  mean: r4(roadMetrics.reduce((a, r) => a + r[k], 0) / roadMetrics.length),
});
const roadDelta = {
  legacyMaxDriftAu: agg('legacyMaxDriftAu'), correctedMaxDriftAu: agg('correctedMaxDriftAu'),
  legacyMeanDriftAu: agg('legacyMeanDriftAu'), correctedMeanDriftAu: agg('correctedMeanDriftAu'),
  authoredLengthAu: agg('authoredLengthAu'), legacyPathLengthAu: agg('legacyPathLengthAu'), correctedPathLengthAu: agg('correctedPathLengthAu'),
  roadsWithImprovedMaxDrift: roadMetrics.filter(r => r.correctedMaxDriftAu < r.legacyMaxDriftAu).length,
  roadsWithWorseMaxDrift: roadMetrics.filter(r => r.correctedMaxDriftAu > r.legacyMaxDriftAu).length,
  worstLegacy: [...roadMetrics].sort((a, b) => b.legacyMaxDriftAu - a.legacyMaxDriftAu).slice(0, 5).map(r => ({ id: r.id, legacyMaxDriftAu: r.legacyMaxDriftAu, correctedMaxDriftAu: r.correctedMaxDriftAu })),
  worstCorrected: [...roadMetrics].sort((a, b) => b.correctedMaxDriftAu - a.correctedMaxDriftAu).slice(0, 5).map(r => ({ id: r.id, correctedMaxDriftAu: r.correctedMaxDriftAu })),
};
if (!(roadDelta.correctedMaxDriftAu.max < roadDelta.legacyMaxDriftAu.max)) throw new Error('WMP03_ROAD_DRIFT_NOT_IMPROVED');
writeV3Json('layers/road_rasterization_delta.v3.json', {
  schema: 'soh.wmp.v3.road_rasterization_delta', status: 'CORRECTED_AUTHORED_SEGMENT_RASTERIZATION__MEASURED',
  previousDefect: { id: 'P0-WMP03-T02', exactSource: 'v2/src/intake_v2.mjs rasterPath()', criterion: 'while(cx!==tx){cx+=...} while(cy!==ty){cy+=...}', verdict: 'X_THEN_Y_ORDERING_DISTORTS_DIAGONAL_AUTHORED_SEGMENTS_INTO_L_SHAPES' },
  method: 'Dense <=CELL/4 sampling of each authored straight segment; 4-connected Bresenham-style chain; diagonal jumps insert the nearer-to-segment intermediate cell. Authored vertices and road IDs unchanged.',
  geometryPolicy: { roadIdPreserved: true, authoredVerticesPreserved: true, endpointCellsPreserved: true, fourConnected: true, noNewRoads: true, unit: 'authoring_unit (au), cell=8 au' },
  roadCount: roadMetrics.length, delta: roadDelta, roads: roadMetrics,
  noClaims: ['NO swept clearance', 'NO road width', 'NO cart passability', 'NO production tileset'],
});

// ---------------------------------------------------------------- 3. WATER TRAVERSAL (P0-03)
// WMP-02 defect: ferry routes (road polylines over water) were emitted into
// roads[] with economy.walkable=1, i.e. silently became LAND-walkable.
const v2WaterRoadRecords = V2_HANDOFF.provenance.proposedWaterRoadCells;
const v2BridgeCellToId = new Map(v2WaterRoadRecords.filter(x => x.bridgeId).map(x => [x.cellIndex, x.bridgeId]));
const v2FerryWalkableCells = V2_HANDOFF.roads.filter(r => ferryIds.has(r.id))
  .flatMap(r => r.cells.filter(c => V2_HANDOFF.economy.walkable[c] === 1));
const v2WaterWalkableCells = v2WaterRoadRecords.filter(x => V2_HANDOFF.economy.walkable[x.cellIndex] === 1).length;

// Cell -> last road that marks it (deterministic road order). Ferry wins.
const roadAtCell = new Map();
for (const r of C.roads) for (const c of correctedCellsByRoad.get(r.id)) {
  const prev = roadAtCell.get(c);
  if (!prev || (ferryIds.has(r.id) && !ferryIds.has(prev))) roadAtCell.set(c, r.id);
}
// PURE production classifier (also exercised by independent negative fixtures).
const roadPointsById = Object.fromEntries(C.roads.map(r => [r.id, r.points]));
const W3 = classifyWaterTraversal(roadAtCell, ferryIds, v2BridgeCellToId, S, roadPointsById);
const { waterTraversalClass, roadSurface, activeCollisionPermission, classification,
  ferryRouteRecords, bridgeProposals, fordProposals, waterRoadCellCount,
  ferryCellCount, bridgeCellCount, fordCellCount } = W3;
const approvedTraversal = { status: VOCAB.UNKNOWN, owner: OWNER.GAMEPLAY, cellCount: 0, note: 'No ferry/boat, bridge-deck, ford, body-clearance or collision rule is approved. ZERO cells have active collision permission.' };
if (activeCollisionPermission.reduce((a, b) => a + b, 0) !== 0) throw new Error('WMP03_ACTIVE_COLLISION_PERMISSION_LEAK');
if (ferryRouteRecords.length !== 8) throw new Error('WMP03_FERRY_COUNT_FAIL');
writeV3U8('rasters/roadSurface.v3.u8', roadSurface);
writeV3U8('rasters/waterTraversalClass.v3.u8', waterTraversalClass);
writeV3U8('rasters/activeCollisionPermission.v3.u8', activeCollisionPermission);
writeV3Json('layers/water_traversal.v3.json', {
  schema: 'soh.wmp.v3.water_traversal', status: 'SEPARATED_FERRY_ROAD_BRIDGE_FORD_WATER_AND_APPROVED_TRAVERSAL',
  previousDefect: {
    id: 'P0-WMP03-T03', exactSource: 'v2/src/intake_v2.mjs:145,150,153-163 + v2/handoff/geographic_handoff.v2.json',
    verdict: 'FERRY_POLYLINES_BECAME_LAND_WALKABLE_AND_PROPOSED_CROSSINGS_BECAME_SILENT_COLLISION_PERMISSION',
    v2FerryRoadIds: [...ferryIds], v2FerryWalkableCellCount: v2FerryWalkableCells.length,
    v2ProposedWaterRoadCells: v2WaterRoadRecords.length, v2ProposedWaterCellsWithWalkable1: v2WaterWalkableCells,
  },
  classVocabulary: { 0: 'WATER_NO_ROAD', 1: 'DRY_LAND_ROAD_SURFACE', 2: 'FERRY_ROUTE_NOT_A_LAND_ROAD', 3: 'BRIDGE_DECK_PROPOSAL', 4: 'FORD_PROPOSAL' },
  corrected: {
    ferryRoutes: ferryRouteRecords.length, ferryCellCount, ferryLandWalkableCells: 0,
    bridgeDeckProposals: [...bridgeProposals.values()].map(b => ({ ...b, cellCount: b.cells.length })), bridgeCellCount,
    fordProposals: [...fordProposals.values()].map(f => ({ ...f, cellCount: f.cells.length })), fordCellCount,
    waterRoadCellCount, approvedTraversalCellCount: 0,
    deprecatedLegacyWalkableWaterCellIndices: v2WaterRoadRecords.filter(x => V2_HANDOFF.economy.walkable[x.cellIndex] === 1).map(x => x.cellIndex),
    deprecatedLegacyStatus: 'DEPRECATED__UNSAFE_FOR_COLLISION__NOT_AN_APPROVED_TRAVERSAL_RULE',
  },
  ferryRoutes: ferryRouteRecords, bridgeDeckProposals: [...bridgeProposals.values()], fordProposals: [...fordProposals.values()],
  waterRoadCellClassifications: classification,
  approvedTraversal,
  compatibilityBoundary: 'v3 deliberately sets economy.walkable=0 on EVERY water cell. Gameplay validateGeographicHandoff() currently requires walkable=1 on all roads[].cells; the exact water-crossing road IDs below are therefore an explicit GAMEPLAY-owned decision, NOT a silent permission and NOT a claimed validator PASS.',
  noClaims: ['NO ferry/boat rule', 'NO land bridge', 'NO collision permission', 'NO cart passability', 'NO validator PASS'],
});

// Traversal graph: edges are GEOMETRY, not permissions.
const edges = [];
for (const r of C.roads) {
  const cells = correctedCellsByRoad.get(r.id);
  for (let k = 1; k < cells.length; k++) {
    const a = cells[k - 1], b = cells[k];
    const ka = waterTraversalClass[a], kb = waterTraversalClass[b];
    const surfaceKind = (ka === 2 || kb === 2) ? 'FERRY_ROUTE' : (ka === 3 || kb === 3) ? 'BRIDGE_DECK_PROPOSAL' : (ka === 4 || kb === 4) ? 'FORD_PROPOSAL' : 'DRY_LAND_ROAD';
    const permissionStatus = surfaceKind === 'DRY_LAND_ROAD' ? 'VERIFIED_GEOMETRY__NOT_A_COLLISION_LAW'
      : surfaceKind === 'FERRY_ROUTE' ? 'BLOCKED__GAMEPLAY_OWNS_BOAT_MECHANIC'
      : 'PROPOSED__NOT_AN_ACTIVE_COLLISION_PERMISSION';
    edges.push({ from: a, to: b, roadId: r.id, lengthAu: CELL, surfaceKind, permissionStatus, activeCollisionPermission: false });
  }
}
const edgeHistogram = {}; for (const e of edges) edgeHistogram[e.surfaceKind] = (edgeHistogram[e.surfaceKind] || 0) + 1;
writeV3Json('layers/traversal_graph.v3.json', {
  schema: 'soh.wmp.v3.traversal_graph', status: 'GEOMETRY_ONLY__NOT_A_COLLISION_OR_APPROVAL_GRAPH',
  distinction: { visibleRoadSurfaceRaster: 'v3/rasters/roadSurface.v3.u8', traversalGraph: 'v3/layers/traversal_graph.v3.json', note: 'A visible surface cell is a tileset geometry candidate; a graph edge is a measured adjacency. NEITHER grants traversal. Only approvedTraversal (currently UNKNOWN/GAMEPLAY) could.' },
  nodeCount: new Set(edges.flatMap(e => [e.from, e.to])).size, edgeCount: edges.length, edgeHistogram,
  visibleSurfaceCellCount: roadAtCell.size, dryLandRoadCellCount: [...roadAtCell.keys()].filter(i => waterTraversalClass[i] === 1).length,
  edges,
});

// ---------------------------------------------------------------- 4. CONSTRUCTION (P0-04)
// WMP-02 defect: handoff economy.buildable was ONLY the 23 surveyed dry subsets
// (1242 cells). v3 separates suggestions / physical possibility / legal placement.
const protectedCells = i => S.protectedGeometryCandidate[i] > 0;
// PURE production classifiers (also exercised by independent negative fixtures).
const constructionSuitability = classifyConstruction(S, T);
const footprints = footprintsFrom(constructionSuitability, S, ZONES.map(z => z.id), 9, T).map(({ cells, ...f }) => f);
const physicallyPossibleCellCount = footprints.reduce((a, f) => a + f.cellCount, 0);
const outsideSurveyedCells = footprints.reduce((a, f) => a + f.outsideSurveyedZoneCells, 0);
const v2Buildable = V2_HANDOFF.economy.buildable;
const v2BuildableCount = v2Buildable.reduce((a, b) => a + b, 0);
if (physicallyPossibleCellCount <= v2BuildableCount) throw new Error('WMP03_CONSTRUCTION_NOT_FULL_WORLD');
if (outsideSurveyedCells <= 0) throw new Error('WMP03_CONSTRUCTION_STILL_RESTRICTED_TO_SURVEYED_ZONES');

const surveyedSites = V2_BUILD_SITES.sites.map(s => {
  const cells = s.recomputed.dryCellIndices;
  const sMean = cells.length ? r4(cells.reduce((a, c) => a + constructionSuitability[c], 0) / cells.length) : 0;
  const physicallyPossible = cells.filter(c => constructionSuitability[c] >= 2).length;
  const prot = cells.filter(protectedCells).length;
  const cliff = cells.filter(c => cliffV3[c] === 1).length;
  const water = s.recomputed.waterCellCount;
  return {
    id: s.siteId, parentZoneId: s.parentZoneId, physicalEnvelopeAu: s.physicalEnvelopeAu,
    cellCount: cells.length, suggestedStatus: 'SURVEYED_SUGGESTION__NOT_A_LEGAL_RESTRICTION', owner: OWNER.MAP,
    measured: { meanConstructionSuitabilityV3: sMean, physicallyPossibleCells: physicallyPossible, protectedOverlapCells: prot, cliffOverlapCells: cliff, waterOverlapCells: water, suitabilityHistogram: hist(cells.map(c => constructionSuitability[c])) },
    reconciliationStatus: prot > 0 || cliff > 0 || water > 0 ? 'SURVEY_CONFLICT__REPORTED_NOT_SILENTLY_FIXED' : 'RECONCILED_WITH_TERRAIN',
    legalPlacement: { status: VOCAB.UNKNOWN, owner: OWNER.GAMEPLAY },
  };
});
writeV3U8('rasters/constructionSuitability.v3.u8', constructionSuitability);
writeV3Json('layers/construction_semantics.v3.json', {
  schema: 'soh.wmp.v3.construction_semantics', status: 'THREE_DISTINCT_CONCEPTS__NO_SANDBOX_RESTRICTION',
  previousDefect: { id: 'P0-WMP03-T04', exactSource: 'v2/src/intake_v2.mjs:173 + v2/handoff/geographic_handoff.v2.json economy.buildable', v2BuildableCellCount: v2BuildableCount, v2SurveyedSiteCount: 23, verdict: 'SURVEYED_ZONE_DRY_SUBSETS_WERE_EMITTED_AS_THE_ONLY_BUILDABLE_CELLS' },
  concepts: {
    suggestedSites: { count: surveyedSites.length, status: 'SURVEYED_SUGGESTION', owner: OWNER.MAP, note: '23 authored survey envelopes. A suggestion, never a permission and never a restriction.' },
    physicallyPossibleFootprints: { count: footprints.length, cellCount: physicallyPossibleCellCount, status: 'VERIFIED_GEOMETRY', owner: OWNER.MAP, note: 'Full-world connected dry-land components >=9 cells, screened by v3 terrain + protected geometry.' },
    legalPlacement: { status: VOCAB.UNKNOWN, owner: OWNER.GAMEPLAY, note: 'Claims, occupancy, cost, body clearance and build rules are Gameplay-owned. NONE asserted here.' },
  },
  criterion: 'dry land; not protectedGeometryCandidate; not cliffCandidate; not coast; heightClass<=3; suitability 3 when heightClass<=1 and slope<=p50 and clearanceCells>0, else 2 (>=p75 slope or p90 relief => 1, remaining excluded => 0). Connected components >=9 cells.',
  suitabilityHistogram: hist(Array.from(constructionSuitability)),
  physicallyPossibleCellCount, outsideSurveyedZoneCells: outsideSurveyedCells,
  sandboxRestrictionProven: { v2BuildableCellCount: v2BuildableCount, v3PhysicallyPossibleCellCount: physicallyPossibleCellCount, cellsInComponentsWithNoSurveyedZone: outsideSurveyedCells, verdict: 'SANDBOX_CONSTRUCTION_IS_NOT_RESTRICTED_TO_THE_23_SURVEYED_ZONES' },
  surveyedSites, footprints,
  noClaims: ['NO placement grant', 'NO occupancy or claim', 'NO body/swept clearance approval', 'NO Gameplay balance', 'NO production building tileset'],
});

// ---------------------------------------------------------------- 5. BOUNDED STRUCTURAL CHECKS
// (a) POI road entrances — report only, never redesign canonical POI locations.
const roadCellList = [...roadAtCell.keys()];
const poiEntrances = architecture.pois.map(p => {
  const entrances = (p.staticOpenings || []).filter(o => o.kind === 'EXTERIOR_ENTRANCE');
  const measures = entrances.map(e => {
    let best = Infinity, bestCell = null;
    for (const c of roadCellList) {
      const d = dist(e.centreAu, centreAu(c));
      if (d < best) { best = d; bestCell = c; }
    }
    return { id: e.id, centreAu: e.centreAu, nearestRoadCellIndex: bestCell, nearestRoadDistanceAu: r4(best) };
  });
  const minD = measures.length ? Math.min(...measures.map(m => m.nearestRoadDistanceAu)) : null;
  return {
    id: p.poiId, atAu: p.atAu, entranceCount: entrances.length, measures,
    minRoadDistanceAu: minD,
    frontageStatus: !entrances.length ? 'NO_EXTERIOR_ENTRANCE_IN_SOURCE' : minD <= 5 * CELL ? 'VERIFIED_ROAD_FRONTAGE_WITHIN_40_AU' : 'PROPOSED_DISTANT_ACCESS__NO_REDESIGN',
    canonicalLocationChanged: false, owner: minD !== null && minD <= 5 * CELL ? OWNER.MAP : OWNER.MAP_GAMEPLAY,
  };
});
// (b) overlapping host / subsite envelopes — report only.
const hostEnvelopes = [];
for (const p of architecture.pois) if (p.levels?.[0]?.polygonAu) hostEnvelopes.push({ id: `poi.${p.poiId}.ground`, ring: p.levels[0].polygonAu, hostKind: 'POI_GROUND_LEVEL' });
for (const e of ELDER) if (e.outer?.length >= 3) hostEnvelopes.push({ id: `elder.${e.id}.outer`, ring: e.outer, hostKind: 'ELDER_OUTER_TERRITORY' });
const hostCellSets = hostEnvelopes.map(h => ({ ...h, cells: new Set(polygonCells(h.ring)) }));
const envelopeOverlaps = surveyedSites.map(s => {
  const siteCells = V2_BUILD_SITES.sites.find(x => x.siteId === s.id).recomputed.dryCellIndices;
  const overlaps = hostCellSets.map(h => ({ hostId: h.id, hostKind: h.hostKind, overlapCellCount: siteCells.filter(c => h.cells.has(c)).length }))
    .filter(x => x.overlapCellCount > 0);
  return { siteId: s.id, hostEnvelopeCount: overlaps.length, totalOverlapCells: overlaps.reduce((a, x) => a + x.overlapCellCount, 0), overlaps, status: overlaps.length ? 'OVERLAP_REPORTED__NOT_AUTOMATICALLY_RESOLVED' : 'NO_HOST_OVERLAP', canonicalGeometryChanged: false };
});
// (c) roof-boundary semantics — classify ONLY, never auto-shrink.
const roofSemantics = [];
for (const p of architecture.pois) {
  const roomById = new Map((p.rooms || []).map(r => [r.id, r]));
  for (const roof of p.roofPolygons || []) {
    const room = roomById.get(roof.parentRoomId);
    if (!room) { roofSemantics.push({ id: roof.id, poiId: p.poiId, parentRoomId: roof.parentRoomId, status: 'PARENT_ROOM_NOT_FOUND', autoShrinkApplied: false }); continue; }
    const poly = room.polygonAu;
    let inside = 0, onBoundary = 0, outside = 0;
    for (const v of roof.polygonAu) {
      let d = Infinity;
      for (let k = 0; k < poly.length; k++) d = Math.min(d, distPointSegment(v, poly[k], poly[(k + 1) % poly.length]));
      if (d <= 0.75) onBoundary++;
      else if (pointInRing(v, poly)) inside++;
      else outside++;
    }
    roofSemantics.push({
      id: roof.id, poiId: p.poiId, parentRoomId: roof.parentRoomId, vertexCount: roof.polygonAu.length,
      insideVertices: inside, onBoundaryVertices: onBoundary, outsideVertices: outside,
      boundaryStatus: outside > 0 ? 'OUTSIDE_PARENT_ROOM_BOUNDARY' : onBoundary === roof.polygonAu.length ? 'COINCIDENT_WITH_PARENT_ROOM_BOUNDARY' : 'INSIDE_OR_ON_BOUNDARY',
      status: outside > 0 ? 'PROPOSED__SEMANTICS_UNRESOLVED' : 'VERIFIED_GEOMETRY',
      owner: outside > 0 ? OWNER.MAP_GAMEPLAY : OWNER.MAP,
      autoShrinkApplied: false, canonicalPolygonChanged: false,
      note: 'Boundary coincidence is a SEMANTIC question (canopy vs full roof), not a licence to shrink every flagged polygon.',
    });
  }
}
writeV3Json('layers/structural_checks.v3.json', {
  schema: 'soh.wmp.v3.structural_checks', status: 'BOUNDED_READ_ONLY_CHECKS__NO_CANONICAL_REDESIGN',
  scope: { poiCount: architecture.pois.length, surveyedSiteCount: surveyedSites.length, roofPolygonCount: roofSemantics.length, roadSurfaceCellCount: roadCellList.length, frontageThresholdAu: 5 * CELL },
  poiRoadEntrances: { assessed: poiEntrances.length, withExteriorEntrance: poiEntrances.filter(p => p.entranceCount > 0).length, withRoadFrontageWithin40Au: poiEntrances.filter(p => p.frontageStatus === 'VERIFIED_ROAD_FRONTAGE_WITHIN_40_AU').length, distantAccessIds: poiEntrances.filter(p => p.frontageStatus === 'PROPOSED_DISTANT_ACCESS__NO_REDESIGN').map(p => p.id), noEntranceIds: poiEntrances.filter(p => p.frontageStatus === 'NO_EXTERIOR_ENTRANCE_IN_SOURCE').map(p => p.id), canonicalLocationsRedesigned: 0, pois: poiEntrances },
  overlappingEnvelopes: { assessedSites: envelopeOverlaps.length, sitesWithHostOverlap: envelopeOverlaps.filter(x => x.hostEnvelopeCount > 0).map(x => ({ siteId: x.siteId, totalOverlapCells: x.totalOverlapCells, hostIds: x.overlaps.map(o => o.hostId) })), hostEnvelopeCount: hostCellSets.length, canonicalGeometryChanged: false, sites: envelopeOverlaps },
  roofBoundarySemantics: { assessed: roofSemantics.length, autoShrinkAppliedCount: 0, canonicalPolygonChangedCount: 0, outsideBoundaryCount: roofSemantics.filter(r => r.boundaryStatus === 'OUTSIDE_PARENT_ROOM_BOUNDARY').length, coincidentBoundaryCount: roofSemantics.filter(r => r.boundaryStatus === 'COINCIDENT_WITH_PARENT_ROOM_BOUNDARY').length, insideOrOnBoundaryCount: roofSemantics.filter(r => r.boundaryStatus === 'INSIDE_OR_ON_BOUNDARY').length, v2HistoricalCorrectedInsetCount: V2_ROOFS.roofsWithMeasuredCorrectedInset, v3NewAutoShrinkCount: 0, roofs: roofSemantics },
  noClaims: ['NO automatic roof shrink', 'NO canonical POI relocation', 'NO new POI', 'NO Gameplay rule change'],
});

// ---------------------------------------------------------------- 6. TYPED MAP->GAMEPLAY INTERFACE
const economy = { ...V2_HANDOFF.economy };
// Safe v3 overrides. Arrays remain width*height binary for shape compatibility.
const walkableV3 = new Uint8Array(N), buildableV3 = new Uint8Array(N), roadV3 = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const dry = S.waterClass[i] === 0;
  walkableV3[i] = dry && (S.walkableCandidate[i] > 0 || S.roadClass[i] > 0 || S.clearanceCells[i] > 0) ? 1 : 0;
  buildableV3[i] = constructionSuitability[i] >= 2 ? 1 : 0;
  roadV3[i] = roadSurface[i] > 0 ? 1 : 0;
}
economy.walkable = Array.from(walkableV3);
economy.buildable = Array.from(buildableV3);
economy.road = Array.from(roadV3);
// v2 emitted 8777 ASSUMED_PROFILE cargo screening cells. No approved cart /
// loaded-cart swept clearance or trailer sweep exists, so v3 MUST NOT let an
// unapproved value appear authoritative in a typed Gameplay-facing field.
economy.cargoPassable = new Array(N).fill(0);
for (let i = 0; i < N; i++) if (S.waterClass[i] > 0 && economy.walkable[i] !== 0) throw new Error('WMP03_WATER_STILL_LAND_WALKABLE');
const landRoads = roadMetrics.filter(r => !ferryIds.has(r.id)).map(r => ({
  id: r.id, cells: correctedCellsByRoad.get(r.id), surface: C.roads.find(x => x.id === r.id).kind,
  widthTiles: 1, bridgeCells: [], cargoPassable: false, status: 'AUTHORED_ROAD_CORRECTED_CELL_PATH',
  visibleSurfaceOnly: true, traversalPermission: 'NOT_GRANTED_BY_THIS_FIELD',
}));
const roadsWithWaterCells = landRoads.filter(r => r.cells.some(c => S.waterClass[c] > 0))
  .map(r => ({ id: r.id, waterCellCount: r.cells.filter(c => S.waterClass[c] > 0).length }));
const unresolved = [
  { id: 'DR-06', subject: 'ferry/boat rule for 8 authored ferry routes', status: 'BLOCKED', owner: OWNER.GAMEPLAY },
  { id: 'DR-V3-01', subject: 'bridge-deck proposal activation / collision permission', status: 'UNKNOWN', owner: OWNER.GAMEPLAY },
  { id: 'DR-V3-02', subject: 'ford depth/flow/permission rule', status: 'UNKNOWN', owner: OWNER.GAMEPLAY },
  { id: 'DR-V3-03', subject: 'physical units for elevation/slope (metres/degrees)', status: 'UNRESOLVED', owner: OWNER.MAP_GAMEPLAY },
  { id: 'DR-V3-04', subject: 'legal build placement / claims / occupancy', status: 'UNKNOWN', owner: OWNER.GAMEPLAY },
  { id: 'DR-V3-05', subject: 'roof-boundary canopy vs full-roof semantics', status: 'PROPOSED', owner: OWNER.MAP_GAMEPLAY },
  { id: 'DR-V3-06', subject: 'gameplay validateGeographicHandoff() acceptance of water-crossing road cells', status: 'UNRESOLVED', owner: OWNER.GAMEPLAY },
  { id: 'DR-V3-07', subject: 'cart / loaded-cart swept clearance and trailer sweep', status: 'UNKNOWN', owner: OWNER.MAP_GAMEPLAY },
  { id: 'DR-V3-08', subject: 'runtime ingestion, independent CI and visual acceptance', status: 'UNRESOLVED', owner: OWNER.GAMEPLAY },
  { id: 'DR-V3-09', subject: 'numeric climate/weather/damage/season rates', status: 'UNKNOWN', owner: OWNER.GAMEPLAY },
  { id: 'DR-V3-10', subject: 'Veyra production road/cliff/bridge/construction tilesets', status: 'NOT_STARTED', owner: OWNER.CREATOR },
];
const handoff = {
  schema: 'soh.wmp.v3.map_to_gameplay_handoff', version: 3,
  status: 'PHYSICAL_SEMANTICS_CORRECTED_CANDIDATE__NOT_SEALED',
  authority: 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT',
  generatedBy: 'veyra-world-master/v3/src/build_v3.mjs', generatedAtUtc: 'DETERMINISTIC_BUILD_NO_WALLCLOCK',
  parent: { v1ManifestSha256: PINNED['manifest.v1.json'], v2ManifestSha256: PINNED['v2/manifest.v2.json'], v2HandoffSha256: PINNED['v2/handoff/geographic_handoff.v2.json'], v2RevisionDigest: V2_MANIFEST.revisionDigest, policy: 'WMP-01 and WMP-02 tracked bytes are byte-for-byte unchanged; v3 is ADDITIVE ONLY.' },
  interfaceDescriptor: 'v3/interfaces/map_physical_semantics.v3.json',
  economy,
  roads: landRoads, ferryRoutes: ferryRouteRecords,
  bridgeDeckProposals: [...bridgeProposals.values()], fordProposals: [...fordProposals.values()],
  waterCells: { totalWaterCellCount: Array.from(S.waterClass).filter(v => v > 0).length, waterRoadCellCount, landWalkableWaterCells: 0, activeCollisionPermissionCount: 0 },
  approvedTraversal,
  traversalGraphRef: { file: 'v3/layers/traversal_graph.v3.json', nodeCount: new Set(edges.flatMap(e => [e.from, e.to])).size, edgeCount: edges.length, status: 'GEOMETRY_ONLY' },
  physicallyPossibleFootprints: footprints.map(f => ({ id: f.id, cellCount: f.cellCount, bboxAu: f.bboxAu })),
  suggestedSites: surveyedSites.map(s => ({ id: s.id, status: 'SURVEYED_SUGGESTION' })),
  legalPlacement: { status: VOCAB.UNKNOWN, owner: OWNER.GAMEPLAY },
  pois: V2_HANDOFF.pois, criticalPaths: V2_HANDOFF.criticalPaths,
  nonbossCashSites: V2_HANDOFF.nonbossCashSites, vendorSites: V2_HANDOFF.vendorSites, evacuationSites: V2_HANDOFF.evacuationSites,
  buildSites: V2_HANDOFF.buildSites, starts: economy.starts,
  roadsWithWaterCells,
  deprecatedLegacyWalkableWaterCellIndices: v2WaterRoadRecords.filter(x => V2_HANDOFF.economy.walkable[x.cellIndex] === 1).map(x => x.cellIndex),
  fieldSemantics: [
    { field: 'economy.walkable', status: VOCAB.VERIFIED, owner: OWNER.MAP, provenance: 'dry land + authored walkableCandidate/roadClass/clearanceCells', note: 'ZERO on every water cell. Geometry mask, NOT a Gameplay collision permission.' },
    { field: 'economy.road', status: VOCAB.VERIFIED, owner: OWNER.MAP, provenance: 'v3 corrected authored road polylines', note: 'VISIBLE SURFACE only; the distinct traversalGraph grants nothing.' },
    { field: 'economy.buildable', status: VOCAB.VERIFIED, owner: OWNER.MAP, provenance: 'v3 full-world constructionSuitability + protected geometry', note: 'Physically possible geometry, NOT legal placement; NOT restricted to 23 surveyed zones.' },
    { field: 'economy.cargoPassable', status: VOCAB.UNKNOWN, owner: OWNER.GAMEPLAY, v2AssumedProfileCellCount: V2_HANDOFF.economy.cargoPassable.reduce((a, b) => a + b, 0), v3Value: 'ALL_ZERO', note: 'v2 emitted 8777 ASSUMED_PROFILE screening cells. No approved cart/loaded-cart swept clearance exists; v3 refuses to present them as authoritative.' },
    { field: 'economy.{moisture,temperature,elevation,slope}', status: VOCAB.PROPOSED, owner: OWNER.MAP, note: 'v2 normalized dimensionless potentials / raw-byte proxies. NOT numeric Gameplay climate, weather, damage, season rates or metres/degrees.' },
    { field: 'approvedTraversal', status: VOCAB.UNKNOWN, owner: OWNER.GAMEPLAY, note: 'ZERO cells approved. No ferry/boat, bridge-deck, ford or collision rule exists.' },
  ],
  unresolvedGameplayOwned: unresolved,
  gameplayValidators: { validateEconomyMap: 'NOT_EXECUTED__GAMEPLAY_RUNTIME_OWNED', validateGeographicHandoff: 'NOT_EXECUTED__GAMEPLAY_RUNTIME_OWNED', compileEconomy: 'NOT_EXECUTED', diagnoseStarts: 'NOT_EXECUTED', note: 'Map does not claim a Gameplay validator PASS. See roadsWithWaterCells for the explicit compatibility boundary.' },
  noClaims: ['NO playable Veyra', 'NO visual acceptance', 'NO WORLD_MASTER_SEALED', 'NO MERGE_READY', 'NO Gameplay runtime modification'],
};
writeV3Json('handoff/map_to_gameplay_v3.json', handoff);

const interfaceDescriptor = {
  schema: 'soh.wmp.v3.map_physical_semantics_interface', interfaceName: 'MapPhysicalSemanticsV3', version: 3,
  status: 'TYPED_INTERFACE__PROPOSED_VALUES_NEVER_AUTHORITATIVE',
  authority: 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT',
  compatibleWith: [
    { name: 'EconomyMap', source: 'web/src/game/world-economy.ts', note: '13 width*height arrays + id/revision/seed/width/height/tileSize/starts retained verbatim in shape.' },
    { name: 'GeographicHandoff', source: 'web/src/game/geography-contract.ts', note: 'roads/pois/criticalPaths/buildSites/nonbossCashSites/vendorSites/evacuationSites retained; ferryRoutes added as a DISTINCT concept.' },
  ],
  statusVocabulary: { UNKNOWN: 'no value asserted; decision outstanding', PROPOSED: 'measured candidate, NOT authoritative and NOT a permission', VERIFIED: 'geometry/measurement verified against authored source; NOT a Gameplay law', UNRESOLVED: 'physical unit or rule not established', BLOCKED: 'requires an owner decision', SOURCE_AUTHORED: 'verbatim authored geometry' },
  provenance: { sourceRasters: 'data/rasters/geo01/*.u8 (digest-verified by data/source_manifest.v1.json)', authoredGeometry: 'data/canon/geometry_snapshot.v1.json (GOLD)', v1Derived: 'rasters/*.u8 (digest-verified by manifest.v1.json)', v2Corrective: 'v2/layers/*.v2.json + v2/handoff/geographic_handoff.v2.json', v3GeneratedBy: 'v3/src/build_v3.mjs', goldReadCount: 1, transformation: 'DETERMINISTIC__NO_WALLCLOCK__NO_NETWORK' },
  fields: [
    { name: 'economy.elevation / economy.slope', type: 'number[]', unit: 'UNRESOLVED__RAW_SOURCE_BYTE_NORMALISED', status: 'PROPOSED', owner: 'MAP', provenance: 'v2 normalized environment potentials; NOT metres/degrees', noAuthorityClaim: 'No vertical scale or climb rule asserted.' },
    { name: 'economy.moisture / economy.temperature', type: 'number[]', unit: 'DIMENSIONLESS_NORMALISED_POTENTIAL', status: 'PROPOSED', owner: 'MAP', provenance: 'v2 environment.v2.json', noAuthorityClaim: 'NOT numeric Gameplay climate/weather/damage/season rates.' },
    { name: 'economy.walkable', type: '0|1[]', unit: 'BINARY_GEOMETRY_MASK', status: 'VERIFIED', owner: 'MAP', provenance: 'dry land + authored walkableCandidate/roadClass/clearanceCells', noAuthorityClaim: 'ZERO on every water cell. NOT a Gameplay collision permission.' },
    { name: 'economy.road', type: '0|1[]', unit: 'BINARY_VISIBLE_SURFACE_MASK', status: 'VERIFIED', owner: 'MAP', provenance: 'v3 corrected authored road polylines', noAuthorityClaim: 'Visible tileset geometry only; see distinct traversalGraph.' },
    { name: 'economy.buildable', type: '0|1[]', unit: 'BINARY_PHYSICAL_GEOMETRY_MASK', status: 'VERIFIED', owner: 'MAP', provenance: 'v3 full-world constructionSuitability + protected geometry', noAuthorityClaim: 'Physically possible, NOT legal placement; NOT restricted to 23 surveyed zones.' },
    { name: 'economy.cargoPassable', type: '0|1[]', unit: 'UNKNOWN', status: 'UNKNOWN', owner: 'GAMEPLAY', provenance: 'v2 handoff; no approved cart rule exists', noAuthorityClaim: 'No cart passability approved.' },
    { name: 'ferryRoutes', type: 'FerryRouteV3[]', unit: 'authoring_unit', status: 'SOURCE_AUTHORED', owner: 'GAMEPLAY', provenance: 'GOLD project.roads[kind=ferry], 8 verbatim authored polylines', noAuthorityClaim: 'NOT a land road; landWalkable=false; traversal BLOCKED.' },
    { name: 'bridgeDeckProposals / fordProposals', type: 'ProposalV3[]', unit: 'authoring_unit', status: 'PROPOSED', owner: 'MAP+GAMEPLAY', provenance: 'v2 measured decks + v3 corrected road/water cells', noAuthorityClaim: 'activeCollisionPermission=false for every cell.' },
    { name: 'approvedTraversal', type: 'ApprovedTraversalV3', unit: 'UNKNOWN', status: 'UNKNOWN', owner: 'GAMEPLAY', provenance: 'NO Gameplay decision exists; explicitly empty', noAuthorityClaim: 'ZERO cells approved; no boat/bridge/ford rule exists.' },
    { name: 'traversalGraph', type: 'TraversalGraphV3', unit: 'authoring_unit', status: 'VERIFIED', owner: 'MAP', provenance: 'v3 corrected 4-connected road cell chains', noAuthorityClaim: 'Measured adjacency only; edges do not grant traversal.' },
    { name: 'heightClass / cliffCandidate / terraceCandidate / slopeClass', type: 'u8[]', unit: 'ORDINAL_OBSERVED_QUANTILE_CLASS', status: 'PROPOSED', owner: 'MAP', provenance: 'data/rasters/geo01/{slope,elevation,zoneId,elderGeometryId,biomeCode}.u8', noAuthorityClaim: 'No metres, degrees, collision or climb law.' },
    { name: 'suggestedSites', type: 'SiteV3[]', unit: 'authoring_unit', status: 'PROPOSED', owner: 'MAP', provenance: 'GOLD project.zones[] 23 survey envelopes via LR02 M2 criterion', noAuthorityClaim: '23 surveyed suggestions only.' },
    { name: 'physicallyPossibleFootprints', type: 'FootprintV3[]', unit: 'authoring_unit', status: 'VERIFIED', owner: 'MAP', provenance: 'v3 full-world constructionSuitability connected components', noAuthorityClaim: 'Geometry only; legalPlacement remains UNKNOWN/GAMEPLAY.' },
    { name: 'legalPlacement', type: 'DecisionV3', unit: 'UNKNOWN', status: 'UNKNOWN', owner: 'GAMEPLAY', provenance: 'NO Gameplay placement/claim/occupancy decision exists', noAuthorityClaim: 'No claim, occupancy, cost or body-clearance decision asserted.' },
    { name: 'poiRoadEntrances / overlappingEnvelopes / roofBoundarySemantics', type: 'AssessmentV3[]', unit: 'authoring_unit', status: 'PROPOSED', owner: 'MAP+GAMEPLAY', provenance: 'architecture.pois[], GOLD project.elders[], v2 build_sites/roof_assessment', noAuthorityClaim: 'Read-only reports; no canonical POI redesign, no automatic roof shrink.' },
  ],
  separatedConcepts: [
    'ferry route vs road vs bridge deck vs ford vs water vs approved traversal',
    'visible road surface vs traversal graph',
    'suggested site vs physically possible footprint vs legal placement',
    'measured geometry vs Gameplay-owned permission',
  ],
  unapprovedValuesAreNotAuthoritative: true,
  noClaims: ['NO invented numeric Gameplay balance', 'NO authoritative unapproved value', 'NO playable Veyra', 'NO visual acceptance', 'NO WORLD_MASTER_SEALED'],
};
writeV3Json('interfaces/map_physical_semantics.v3.json', interfaceDescriptor);

// ---------------------------------------------------------------- 7. manifest + measured summary
const trackedRel = [
  'layers/terrain_height_class.v3.json', 'layers/road_rasterization_delta.v3.json', 'layers/water_traversal.v3.json',
  'layers/traversal_graph.v3.json', 'layers/construction_semantics.v3.json', 'layers/structural_checks.v3.json',
  'rasters/heightClass.v3.u8', 'rasters/cliffCandidate.v3.u8', 'rasters/terraceCandidate.v3.u8', 'rasters/slopeClass.v3.u8',
  'rasters/roadSurface.v3.u8', 'rasters/waterTraversalClass.v3.u8', 'rasters/activeCollisionPermission.v3.u8', 'rasters/constructionSuitability.v3.u8',
  'interfaces/map_physical_semantics.v3.json', 'handoff/map_to_gameplay_v3.json',
];
const componentList = trackedRel.map(rel => ({ file: `v3/${rel}`, sha256: shaV3(rel), bytes: fs.statSync(v3Path(rel)).size }));
const measured = {
  p0_01_terrain: { v1CliffThreshold: v1CliffThreshold, observedSlopeMaxRawByte: slopeMax, v1CliffCells: v1CliffCellCount, v3CliffCandidateCells: cliffCount, v3TerraceCandidateCells: terraceCount, heightClassHistogram: heightHistogram, slopeClassHistogram: slopeHistogram },
  p0_02_roads: { roadCount: 92, legacyMaxDriftAu: roadDelta.legacyMaxDriftAu.max, correctedMaxDriftAu: roadDelta.correctedMaxDriftAu.max, legacyMeanDriftAu: roadDelta.legacyMeanDriftAu.mean, correctedMeanDriftAu: roadDelta.correctedMeanDriftAu.mean, authoredLengthAu: roadDelta.authoredLengthAu.sum, legacyPathLengthAu: roadDelta.legacyPathLengthAu.sum, correctedPathLengthAu: roadDelta.correctedPathLengthAu.sum, improvedRoads: roadDelta.roadsWithImprovedMaxDrift },
  p0_03_water: { v2FerryWalkableCells: v2FerryWalkableCells.length, v2WaterCellsWithWalkable1: v2WaterWalkableCells, v3FerryRoutes: ferryRouteRecords.length, v3FerryCells: ferryCellCount, v3WaterRoadCells: waterRoadCellCount, v3LandWalkableWaterCells: 0, v3ActiveCollisionPermissionCells: 0, bridgeDeckProposalCells: bridgeCellCount, fordProposalCells: fordCellCount },
  p0_04_construction: { v2BuildableCells: v2BuildableCount, v2SurveyedSites: 23, v3PhysicallyPossibleFootprints: footprints.length, v3PhysicallyPossibleCells: physicallyPossibleCellCount, v3CellsOutsideSurveyedZones: outsideSurveyedCells, surveyedConflicts: surveyedSites.filter(s => s.reconciliationStatus.startsWith('SURVEY_CONFLICT')).map(s => s.id), legalPlacement: 'UNKNOWN__GAMEPLAY_OWNED' },
  structural: { poiAssessed: poiEntrances.length, poiDistantAccess: poiEntrances.filter(p => p.frontageStatus === 'PROPOSED_DISTANT_ACCESS__NO_REDESIGN').length, sitesWithHostOverlap: envelopeOverlaps.filter(x => x.hostEnvelopeCount > 0).length, roofsAssessed: roofSemantics.length, roofsOutsideBoundary: roofSemantics.filter(r => r.boundaryStatus === 'OUTSIDE_PARENT_ROOM_BOUNDARY').length, autoShrinkApplied: 0, canonicalPoiChanges: 0 },
  traversal: { graphNodes: new Set(edges.flatMap(e => [e.from, e.to])).size, graphEdges: edges.length, visibleSurfaceCells: roadAtCell.size, edgeHistogram },
  compatibility: { economyArrayLength: N, roadsInHandoff: landRoads.length, ferryRoutesSeparate: ferryRouteRecords.length, roadsWithWaterCells: roadsWithWaterCells.length, gameplayValidatorsExecuted: false },
};
writeV3Json('layers/measured_delta.v3.json', { schema: 'soh.wmp.v3.measured_delta', status: 'CHANGED_MEASUREMENTS__BEFORE_AND_AFTER', measured });
componentList.push({ file: 'v3/layers/measured_delta.v3.json', sha256: shaV3('layers/measured_delta.v3.json'), bytes: fs.statSync(v3Path('layers/measured_delta.v3.json')).size });

const revisionPayload = { version: 3, pins: PINNED, measured, components: componentList };
const revisionDigest = digest(revisionPayload);
writeV3Json('manifest.v3.json', {
  schema: 'soh.wmp.world_master_manifest.v3', version: 3, revision: 1,
  packageId: 'veyra-physical-world-master', status: 'WMP03_PHYSICAL_SEMANTICS_CORRECTIVE_CANDIDATE__NOT_SEALED',
  authority: 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT',
  generatedBy: 'veyra-world-master/v3/src/build_v3.mjs', generatedAtUtc: 'DETERMINISTIC_BUILD_NO_WALLCLOCK',
  parent: { v1ManifestSha256: PINNED['manifest.v1.json'], v2ManifestSha256: PINNED['v2/manifest.v2.json'], v2RevisionDigest: V2_MANIFEST.revisionDigest, v1Policy: 'BYTE_FOR_BYTE_UNCHANGED', v2Policy: 'BYTE_FOR_BYTE_UNCHANGED' },
  pins: PINNED,
  frame: { authoring: [2000, 1400], unit: 'authoring_unit', grid: { gw: GW, gh: GH, cellAu: CELL }, transformStatus: 'UNDECIDED' },
  corrections: [
    { id: 'P0-WMP03-T01', subject: 'cliff threshold above observed raster maximum', status: 'CORRECTED_WITH_MEASURED_TERRAIN_CLASSIFICATION' },
    { id: 'P0-WMP03-T02', subject: 'X-then-Y road rasterization', status: 'CORRECTED_WITH_SHAPE_PRESERVING_4_CONNECTED_PATH' },
    { id: 'P0-WMP03-T03', subject: 'ferry routes land-walkable / proposed crossings as collision permission', status: 'CORRECTED_WITH_SEPARATED_TRAVERSAL_SEMANTICS' },
    { id: 'P0-WMP03-T04', subject: 'buildable restricted to 23 surveyed zones', status: 'CORRECTED_WITH_FULL_WORLD_PHYSICAL_POSSIBILITY_AND_THREE_DISTINCT_CONCEPTS' },
  ],
  structuralChecks: ['POI road entrances', 'overlapping host/subsite envelopes', 'roof-boundary semantics'],
  components: componentList, measured, revisionDigest,
  digestMethod: 'sha256(JSON.stringify({version:3,pins,measured,components})) — deterministic, no wallclock, no network',
  v1Policy: 'NO v1 tracked file is written by any v3 script.',
  v2Policy: 'NO v2 tracked file is written by any v3 script.',
  reproduce: 'node v3/src/build_v3.mjs twice; ./reproduce_v3.sh',
  cleanRoom: './clean-room_v3.sh',
  unresolvedGameplayOwned: unresolved,
  noClaims: ['NO production tileset', 'NO new POI', 'NO Gameplay balance', 'NO playable Veyra', 'NO visual acceptance', 'NO WORLD_MASTER_SEALED', 'NO MERGE_READY', 'NO Gameplay validator PASS'],
});
console.log(`WMP_V3_BUILD_OK status=WMP03_PHYSICAL_SEMANTICS_CORRECTIVE_CANDIDATE__NOT_SEALED cliff=${cliffCount} terrace=${terraceCount} roads=${roadMetrics.length} ferry=${ferryRouteRecords.length} waterRoadCells=${waterRoadCellCount} footprints=${footprints.length} physCells=${physicallyPossibleCellCount} edges=${edges.length} revisionDigest=${revisionDigest}`);
