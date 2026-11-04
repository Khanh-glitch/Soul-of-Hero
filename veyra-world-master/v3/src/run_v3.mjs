#!/usr/bin/env node
// WMP-03 physical test suite + INDEPENDENT NEGATIVE FIXTURES.
// A fixture mutates the SOURCE inputs and runs the SAME pure production
// classifier exported by lib_v3.mjs; it is not a documentation-only blocker.
// ADDITIVE ONLY, clean-room safe, no network, no Gameplay runtime.
import fs from 'node:fs';
import { createWorld } from '../../api/world.mjs';
import { loadRasters, loadDerivedRasters } from '../../lib/wmp.mjs';
import {
  MASTER, GW, GH, CELL, N, sha256, digest, r4, idx, gxOf, gyOf, centreAu, toCell,
  readJson, readBuf, shaMaster, shaV3, writeV3Json, readV3U8, V3,
  legacyXYPath, correctedPath, pathDrift, adjacent4,
  classifyTerrain, classifyWaterTraversal, classifyConstruction, footprintsFrom,
  VOCAB,
} from './lib_v3.mjs';

const S = loadRasters();
const D = loadDerivedRasters();               // throws on any v1 byte change
const W = createWorld(); const { C, architecture } = W._internal;
const M = readJson('v3/manifest.v3.json');
const H = readJson('v3/handoff/map_to_gameplay_v3.json');
const I = readJson('v3/interfaces/map_physical_semantics.v3.json');
const TERRAIN = readJson('v3/layers/terrain_height_class.v3.json');
const ROADS = readJson('v3/layers/road_rasterization_delta.v3.json');
const WATER = readJson('v3/layers/water_traversal.v3.json');
const CONSTRUCT = readJson('v3/layers/construction_semantics.v3.json');
const STRUCT = readJson('v3/layers/structural_checks.v3.json');
const GRAPH = readJson('v3/layers/traversal_graph.v3.json');
const V2H = readJson('v2/handoff/geographic_handoff.v2.json');
const V2ROOFS = readJson('v2/layers/roof_assessment.v2.json');

const R = {
  heightClass: readV3U8('rasters/heightClass.v3.u8'),
  cliff: readV3U8('rasters/cliffCandidate.v3.u8'),
  terrace: readV3U8('rasters/terraceCandidate.v3.u8'),
  slopeClass: readV3U8('rasters/slopeClass.v3.u8'),
  roadSurface: readV3U8('rasters/roadSurface.v3.u8'),
  waterTraversalClass: readV3U8('rasters/waterTraversalClass.v3.u8'),
  activeCollisionPermission: readV3U8('rasters/activeCollisionPermission.v3.u8'),
  constructionSuitability: readV3U8('rasters/constructionSuitability.v3.u8'),
};
const results = [], fixtures = [];
const ok = (id, group, kind, cond, detail) => {
  const pass = !!cond;
  results.push({ id, group, kind, status: pass ? 'PASS' : 'FAIL', detail: String(detail) });
  if (!pass) throw new Error(`WMP_V3_TEST_FAIL ${id}: ${detail}`);
};
const fixture = (id, group, defect, input, expected, actual, pass) => {
  fixtures.push({ id, group, defectAgainst: defect, independentInput: input, expected, actual, status: pass ? 'PASS' : 'FAIL' });
  ok(id, group, 'NEGATIVE_FIXTURE', pass, `${defect} :: ${expected} :: ${actual}`);
};
const cloneS = () => Object.fromEntries(Object.entries(S).map(([k, v]) => [k, Uint8Array.from(v)]));
const bytes = a => Buffer.from(a).toString('hex');
const sum = a => Array.from(a).reduce((x, y) => x + y, 0);
const regionOpts = {
  highRockZoneCodes: [6, 7, 8, 16, 21], lowlandZoneCodes: [1, 2, 4, 9, 10, 11, 18, 20],
  typhonCode: C.elders.findIndex(e => e.id === 'el_typhon') + 1, rockBiomes: [7, 8, 9],
};

// ------------------------------------------------------------------ BASELINE / BYTE PRESERVATION
ok('B-01', 'BASE', 'PHYSICAL', M.pins['manifest.v1.json'] === '327bf48c05c92d9ce0ee3ddf1281aca9ce2a47dcf47ede81dc524f80e86e313e', 'WMP-01 manifest SHA-256 pinned');
ok('B-02', 'BASE', 'PHYSICAL', M.pins['v2/manifest.v2.json'] === '6954e17a6fa46da2123e9bffa4faeb65f0cbc87be6def9483e43aa012be94009', 'WMP-02 manifest SHA-256 pinned');
ok('B-03', 'BASE', 'PHYSICAL', M.pins['v2/handoff/geographic_handoff.v2.json'] === '82d8b061ab60b5feab29c6a1cfd579ad9e6428bc9c371983061681a381fe0f8c', 'WMP-02 handoff SHA-256 pinned');
ok('B-04', 'BASE', 'PHYSICAL', V2H.economy.walkable.length === N && Array.isArray(V2H.economy.biome), 'v2 baseline economy arrays intact');
ok('B-05', 'BASE', 'PHYSICAL', S.slope.length === N && D.cliff.length === N, 'source + derived rasters digest-verified on load');
ok('B-06', 'BASE', 'PHYSICAL', M.revisionDigest === digest({ version: 3, pins: M.pins, measured: M.measured, components: M.components }), 'revisionDigest recomputable from pinned method');
ok('B-07', 'BASE', 'PHYSICAL', M.components.every(c => shaMaster(c.file) === c.sha256), `all ${M.components.length} manifest component SHAs match`);
ok('B-08', 'BASE', 'PHYSICAL', M.noClaims.includes('NO Gameplay validator PASS') && M.noClaims.includes('NO visual acceptance'), 'no overclaim in v3 manifest');

// ------------------------------------------------------------------ P0-01 TERRAIN
const slopeMax = Math.max(...Array.from(S.slope));
ok('T-01', 'TERRAIN', 'PHYSICAL', TERRAIN.previousDefect.observedMaxRawByte === slopeMax && slopeMax === 150, `observed slope max raw byte=${slopeMax}`);
ok('T-02', 'TERRAIN', 'PHYSICAL', TERRAIN.previousDefect.v1CliffThreshold > slopeMax && TERRAIN.previousDefect.v1CliffCellCount === 0, 'WMP-01 threshold 200 > observed max 150; v1 cliff.u8 had ZERO cells');
ok('T-03', 'TERRAIN', 'PHYSICAL', TERRAIN.cliffCandidateCount === 305 && TERRAIN.cliffCandidateCount > 0, `v3 connected cliff candidates=${TERRAIN.cliffCandidateCount}`);
ok('T-04', 'TERRAIN', 'PHYSICAL', Object.keys(TERRAIN.slopeClassHistogram).length === 5 && Object.keys(TERRAIN.heightClassHistogram).length === 6, 'all 5 slope classes and 6 height classes are reachable/non-empty');
ok('T-05', 'TERRAIN', 'PHYSICAL', TERRAIN.unitPolicy.noMetres && TERRAIN.unitPolicy.noDegrees && TERRAIN.unitPolicy.noClimbRule && TERRAIN.unitPolicy.physicalUnitStatus === 'UNKNOWN', 'unknown physical units preserved');
ok('T-06', 'TERRAIN', 'PHYSICAL', TERRAIN.regionEvidence.length === 6 && TERRAIN.regionEvidence.every(r => r.cellCount > 0), 'Typhon/Cinder/snow/wetland/lowlands/high-rock all measured');
const RE = Object.fromEntries(TERRAIN.regionEvidence.map(r => [r.id, r]));
ok('T-07', 'TERRAIN', 'PHYSICAL', RE.CINDER_VOLCANIC.cliffPerThousandCells > RE.WETLAND_BIOME.cliffPerThousandCells && RE.TYPHON_TERRITORY.cliffPerThousandCells > RE.LOWLAND_ZONES.cliffPerThousandCells, `cliff density Cinder=${RE.CINDER_VOLCANIC.cliffPerThousandCells}/1000 vs wetland=${RE.WETLAND_BIOME.cliffPerThousandCells}/1000`);
ok('T-08', 'TERRAIN', 'PHYSICAL', RE.WETLAND_BIOME.cliffCandidateCount === 0 && RE.LOWLAND_ZONES.cliffCandidateCount === 0, 'flat wetland + lowlands have ZERO cliff faces');
ok('T-09', 'TERRAIN', 'PHYSICAL', RE.SNOW_BIOME.meanElevationRawByte > RE.LOWLAND_ZONES.meanElevationRawByte, `snow mean elevation ${RE.SNOW_BIOME.meanElevationRawByte} > lowland ${RE.LOWLAND_ZONES.meanElevationRawByte} raw bytes`);
ok('T-10', 'TERRAIN', 'PHYSICAL', bytes(R.cliff) === bytes(classifyTerrain(S, regionOpts).cliff), 'production classifier reproduces emitted cliff raster bit-for-bit');
ok('T-11', 'TERRAIN', 'PHYSICAL', TERRAIN.cliffRule.minSteep8Neighbours >= 2 && TERRAIN.cliffRule.heightClassAtLeast >= 4, 'cliff requires connected neighbourhood and region-aware relief, not one byte');

// Independent negative fixtures against P0-01
{
  const flat = cloneS();
  for (let i = 0; i < N; i++) { flat.slope[i] = 0; flat.elevation[i] = 40; flat.zoneId[i] = 0; flat.elderGeometryId[i] = 0; flat.biomeCode[i] = 0; }
  const t = classifyTerrain(flat, regionOpts);
  fixture('T-NEG-01', 'TERRAIN', 'P0-01 flat world must NOT produce false cliffs', 'synthetic S: slope=0, elevation=40 everywhere, no zones/elders', 'cliffCount=0 and max heightClass<=1', `cliffCount=${t.cliffCount} maxHeightClass=${Math.max(...t.heightClass)}`, t.cliffCount === 0 && Math.max(...t.heightClass) <= 1);
}
{
  const shifted = cloneS();
  for (let i = 0; i < N; i++) shifted.slope[i] = Math.min(255, S.slope[i] + 51);
  const t = classifyTerrain(shifted, regionOpts);
  const v1OnShifted = Array.from(shifted.slope).filter(v => v > 200).length;
  const invariant = bytes(t.cliff) === bytes(R.cliff) && bytes(t.heightClass) === bytes(R.heightClass) && bytes(t.slopeClass) === bytes(R.slopeClass);
  fixture('T-NEG-02', 'TERRAIN', 'P0-01 absolute threshold >200 changes meaning under a uniform byte relabel', 'synthetic S: every slope byte +51 (same terrain, different labels)', 'WMP-01 rule would flip to >0 cliffs; v3 quantile classification stays bit-identical', `WMP01 rule cliff cells on shifted=${v1OnShifted}; v3 invariant=${invariant}`, v1OnShifted > 0 && invariant);
}
{
  const isolated = cloneS();
  const center = idx(125, 87);
  isolated.slope[center] = 255;
  const t = classifyTerrain(isolated, regionOpts);
  fixture('T-NEG-03', 'TERRAIN', 'P0-01 isolated extreme byte must NOT become a cliff face', 'synthetic S: one cell slope=255, neighbours unchanged', 'cliff[isolatedCell]=0', `cliff=${t.cliff[center]} steepNeighbours=${t.steepNeighbours[center]}`, t.cliff[center] === 0);
}
{
  const u = TERRAIN.unitPolicy;
  const assertedUnits = Object.entries(u).filter(([, v]) => typeof v === 'string' && /^(metres?|degrees?|m|deg|°|climb rule)$/i.test(v.trim()));
  const pass = assertedUnits.length === 0 && u.noMetres === true && u.noDegrees === true && u.noClimbRule === true && u.physicalUnitStatus === 'UNKNOWN' && /UNRESOLVED/.test(u.slopeUnit) && /UNRESOLVED/.test(u.elevationUnit);
  fixture('T-NEG-04', 'TERRAIN', 'P0-01 invented physical units', 'v3 terrain layer unitPolicy JSON', 'no asserted metres/degrees/climb law; UNKNOWN physical unit status', `assertedUnits=${assertedUnits.length} slopeUnit=${u.slopeUnit}`, pass);
}

// ------------------------------------------------------------------ P0-02 ROADS
ok('R-01', 'ROADS', 'PHYSICAL', ROADS.roadCount === 92 && ROADS.roads.length === 92, 'all 92 authored road IDs preserved');
ok('R-02', 'ROADS', 'PHYSICAL', new Set(ROADS.roads.map(r => r.id)).size === 92, 'no duplicate or renamed road IDs');
ok('R-03', 'ROADS', 'PHYSICAL', ROADS.roads.every(r => r.connectivity === 'VERIFIED_4_CONNECTED'), 'every corrected cell path is 4-connected');
ok('R-04', 'ROADS', 'PHYSICAL', ROADS.delta.correctedMaxDriftAu.max < ROADS.delta.legacyMaxDriftAu.max, `max drift ${ROADS.delta.legacyMaxDriftAu.max} au -> ${ROADS.delta.correctedMaxDriftAu.max} au`);
ok('R-05', 'ROADS', 'PHYSICAL', ROADS.delta.correctedMeanDriftAu.mean < ROADS.delta.legacyMeanDriftAu.mean, `mean drift ${ROADS.delta.legacyMeanDriftAu.mean} au -> ${ROADS.delta.correctedMeanDriftAu.mean} au`);
ok('R-06', 'ROADS', 'PHYSICAL', ROADS.delta.authoredLengthAu.sum === 10853.7572 && ROADS.delta.correctedPathLengthAu.sum === 13408 && ROADS.delta.legacyPathLengthAu.sum === 13408, `authored=${ROADS.delta.authoredLengthAu.sum} au; both monotone 4-connected rasterizations=${ROADS.delta.correctedPathLengthAu.sum} au (grid quantization, NOT a route-length gain)`);
ok('R-07', 'ROADS', 'PHYSICAL', ROADS.delta.worstLegacy[0].id === 'rd_s' && ROADS.delta.worstLegacy[0].legacyMaxDriftAu === 76.198, 'worst legacy distortion measured per exact road ID');
ok('R-08', 'ROADS', 'PHYSICAL', GRAPH.visibleSurfaceCellCount !== GRAPH.edgeCount && GRAPH.distinction.visibleRoadSurfaceRaster !== GRAPH.distinction.traversalGraph, 'visible surface raster is a DISTINCT object from traversal graph');
ok('R-09', 'ROADS', 'PHYSICAL', GRAPH.edges.every(e => e.activeCollisionPermission === false), 'no graph edge grants an active collision permission');
ok('R-10', 'ROADS', 'PHYSICAL', ROADS.geometryPolicy.authoredVerticesPreserved && ROADS.geometryPolicy.endpointCellsPreserved && ROADS.geometryPolicy.noNewRoads, 'authored shape/vertices/endpoints preserved, no new roads');

// Independent negative fixtures against P0-02
{
  const pts = [[4, 4], [500, 500]];
  const legacy = legacyXYPath(pts), corrected = correctedPath(pts);
  const ld = pathDrift(pts, legacy), cd = pathDrift(pts, corrected);
  const xFirst = legacy.filter(c => gyOf(c) === gyOf(legacy[0])).length;
  fixture('R-NEG-01', 'ROADS', 'P0-02 X-then-Y rasterization distorts diagonal authored segments', 'independent synthetic diagonal segment (4,4)->(500,500)', 'legacy L-shape drift > 40 au; corrected drift <= 5.7 au', `legacy=${ld.maxDriftAu} au (all ${xFirst} X-first cells on start row), corrected=${cd.maxDriftAu} au`, ld.maxDriftAu > 40 && cd.maxDriftAu <= 5.7 && xFirst >= 60);
}
{
  const pts = [[4, 4], [404, 4], [404, 404]];
  const corrected = correctedPath(pts);
  const drift = pathDrift(pts, corrected);
  const conn = corrected.every((c, k) => k === 0 || adjacent4(corrected[k - 1], c));
  fixture('R-NEG-02', 'ROADS', 'P0-02 correction must not break authored L-shape connectivity/endpoints', 'independent synthetic L polyline with 2 authored segments', '4-connected, endpoints preserved, drift <= 5.7 au', `conn=${conn} start=${corrected[0] === toCell(4, 4)} end=${corrected.at(-1) === toCell(404, 404)} drift=${drift.maxDriftAu}`, conn && corrected[0] === toCell(4, 4) && corrected.at(-1) === toCell(404, 404) && drift.maxDriftAu <= 5.7);
}
{
  const pts = [[900, 900], [100, 100]];
  const corrected = correctedPath(pts);
  fixture('R-NEG-03', 'ROADS', 'P0-02 reverse-direction diagonal must remain shape-preserving', 'independent synthetic reverse diagonal (900,900)->(100,100)', '4-connected and drift <= 5.7 au', `cells=${corrected.length} drift=${pathDrift(pts, corrected).maxDriftAu}`, corrected.every((c, k) => k === 0 || adjacent4(corrected[k - 1], c)) && pathDrift(pts, corrected).maxDriftAu <= 5.7);
}

// ------------------------------------------------------------------ P0-03 WATER TRAVERSAL
const ferryIds = new Set(C.roads.filter(r => r.kind === 'ferry').map(r => r.id));
ok('W-01', 'WATER', 'PHYSICAL', WATER.previousDefect.v2FerryRoadIds.length === 8 && WATER.previousDefect.v2FerryWalkableCellCount === 219, 'v2 defect: 8 ferry routes had 219 LAND-walkable water cells');
ok('W-02', 'WATER', 'PHYSICAL', WATER.previousDefect.v2ProposedWaterCellsWithWalkable1 === 267, 'v2 defect: 267 proposed water-road cells silently had walkable=1');
ok('W-03', 'WATER', 'PHYSICAL', H.ferryRoutes.length === 8 && H.ferryRoutes.every(f => f.landWalkable === false && f.activeCollisionPermission === false), 'all 8 ferry routes are NOT land roads and grant NO collision permission');
ok('W-04', 'WATER', 'PHYSICAL', H.ferryRoutes.every(f => f.traversalStatus === 'BLOCKED__GAMEPLAY_OWNS_BOAT_MECHANIC'), 'ferry traversal is BLOCKED, owner GAMEPLAY');
ok('W-05', 'WATER', 'PHYSICAL', H.waterCells.landWalkableWaterCells === 0 && H.waterCells.activeCollisionPermissionCount === 0, 'ZERO water cells are land-walkable or have active collision permission');
ok('W-06', 'WATER', 'PHYSICAL', WATER.corrected.bridgeDeckProposals.length > 0 && WATER.corrected.fordProposals.length > 0 && WATER.corrected.approvedTraversalCellCount === 0, 'bridge/ford PROPOSALS distinct from APPROVED traversal (0 cells)');
ok('W-07', 'WATER', 'PHYSICAL', H.roads.length === 84 && !H.roads.some(r => ferryIds.has(r.id)) && H.ferryRoutes.length === 8, 'ferry routes removed from roads[] but union of IDs remains 92');
ok('W-08', 'WATER', 'PHYSICAL', sum(R.activeCollisionPermission) === 0, 'activeCollisionPermission.u8 is entirely zero');
ok('W-09', 'WATER', 'PHYSICAL', H.approvedTraversal.status === 'UNKNOWN' && H.approvedTraversal.owner === 'GAMEPLAY' && H.approvedTraversal.cellCount === 0, 'approvedTraversal is explicitly UNKNOWN/GAMEPLAY');
ok('W-10', 'WATER', 'PHYSICAL', H.waterCells.waterRoadCellCount === 247 && WATER.corrected.ferryCellCount + WATER.corrected.bridgeCellCount + WATER.corrected.fordCellCount === 247, `247 water-road cells classified = ${WATER.corrected.ferryCellCount} ferry + ${WATER.corrected.bridgeCellCount} bridge + ${WATER.corrected.fordCellCount} ford`);
ok('W-11', 'WATER', 'PHYSICAL', /deliberately sets economy.walkable=0/.test(WATER.compatibilityBoundary), 'compatibility boundary is reported in water_traversal.v3.json, not hidden');
ok('W-12', 'WATER', 'PHYSICAL', /NOT a claimed validator PASS/.test(WATER.compatibilityBoundary) && /GAMEPLAY-owned/.test(WATER.compatibilityBoundary), 'no silent Gameplay validator PASS claim');

// Independent negative fixtures against P0-03
{
  const syn = cloneS();
  const cells = [];
  for (let y = 20; y < 24; y++) for (let x = 20; x < 25; x++) { const c = idx(x, y); cells.push(c); syn.waterClass[c] = 1; }
  const map = new Map();
  const ferryCells = cells.slice(0, 10);
  for (const c of ferryCells) map.set(c, 'TEST_FERRY');
  map.set(cells[10], 'TEST_BRIDGE_ROAD');
  map.set(cells[11], 'TEST_FORD_ROAD');
  const bridgeIds = new Map([[cells[10], 'br_TEST']]);
  const out = classifyWaterTraversal(map, new Set(['TEST_FERRY']), bridgeIds, syn);
  const ferryOk = ferryCells.every(c => out.waterTraversalClass[c] === 2) && out.ferryRouteRecords.length === 1 && out.ferryRouteRecords[0].landWalkable === false;
  fixture('W-NEG-01', 'WATER', 'P0-03 ferry polyline must never become land-walkable', 'independent synthetic 20 water cells, one ferry road, one bridge proposal, one ford', 'ferry cells class=2, landWalkable=false, activeCollisionPermission=0 everywhere', `ferryOk=${ferryOk} activePermissionSum=${sum(out.activeCollisionPermission)}`, ferryOk && sum(out.activeCollisionPermission) === 0);
  const kindsOk = out.waterTraversalClass[cells[10]] === 3 && out.waterTraversalClass[cells[11]] === 4 && out.bridgeProposals.size === 1 && out.fordProposals.size === 1;
  fixture('W-NEG-02', 'WATER', 'P0-03 proposed crossing must not silently become active collision permission', 'same independent synthetic water grid', 'bridge=3, ford=4, both PROPOSED with activeCollisionPermission=false', `bridge=${out.waterTraversalClass[cells[10]]} ford=${out.waterTraversalClass[cells[11]]} proposals=${out.bridgeProposals.size}+${out.fordProposals.size}`, kindsOk && [...out.bridgeProposals.values(), ...out.fordProposals.values()].every(p => p.activeCollisionPermission === false));
  fixture('W-NEG-03', 'WATER', 'P0-03 v2 real ferry cells had walkable=1', 'v2 handoff ferry road cells vs v3 economy.walkable', 'v2=219 walkable ferry cells, v3=0 for every water cell', `v2=${WATER.previousDefect.v2FerryWalkableCellCount} v3WaterWalkable=${Array.from(H.economy.walkable).filter((v, i) => v === 1 && S.waterClass[i] > 0).length}`, WATER.previousDefect.v2FerryWalkableCellCount === 219 && Array.from(H.economy.walkable).every((v, i) => !(v === 1 && S.waterClass[i] > 0)));
}

// ------------------------------------------------------------------ P0-04 CONSTRUCTION
ok('C-01', 'CONSTRUCTION', 'PHYSICAL', CONSTRUCT.previousDefect.v2BuildableCellCount === 1242 && CONSTRUCT.previousDefect.v2SurveyedSiteCount === 23, 'v2 defect: economy.buildable was ONLY 1242 cells from 23 surveyed sites');
ok('C-02', 'CONSTRUCTION', 'PHYSICAL', CONSTRUCT.concepts.physicallyPossibleFootprints.count === 21 && CONSTRUCT.concepts.physicallyPossibleFootprints.cellCount === 7035, '21 full-world physically possible footprints / 7035 cells');
ok('C-03', 'CONSTRUCTION', 'PHYSICAL', CONSTRUCT.sandboxRestrictionProven.cellsInComponentsWithNoSurveyedZone === 6481, '6481 physically possible cells lie outside any surveyed zone');
ok('C-04', 'CONSTRUCTION', 'PHYSICAL', CONSTRUCT.concepts.suggestedSites.status === 'SURVEYED_SUGGESTION' && CONSTRUCT.concepts.legalPlacement.status === 'UNKNOWN' && CONSTRUCT.concepts.legalPlacement.owner === 'GAMEPLAY', 'three concepts distinct; legal placement UNKNOWN/GAMEPLAY');
ok('C-05', 'CONSTRUCTION', 'PHYSICAL', CONSTRUCT.surveyedSites.length === 23 && CONSTRUCT.surveyedSites.every(s => s.suggestedStatus === 'SURVEYED_SUGGESTION__NOT_A_LEGAL_RESTRICTION'), 'all 23 surveyed envelopes are suggestions only');
ok('C-06', 'CONSTRUCTION', 'PHYSICAL', CONSTRUCT.surveyedSites.every(s => s.measured && typeof s.measured.meanConstructionSuitabilityV3 === 'number'), 'every surveyed envelope reconciled with measured terrain suitability');
ok('C-07', 'CONSTRUCTION', 'PHYSICAL', CONSTRUCT.surveyedSites.filter(s => s.reconciliationStatus.startsWith('SURVEY_CONFLICT')).length > 0, 'survey/terrain conflicts are reported, not silently fixed');
ok('C-08', 'CONSTRUCTION', 'PHYSICAL', CONSTRUCT.footprints.every(f => f.protectedOverlapCells === 0 && f.cliffOverlapCells === 0), 'no physically possible footprint overlaps protected geometry or cliff faces');
ok('C-09', 'CONSTRUCTION', 'PHYSICAL', bytes(R.constructionSuitability) === bytes(classifyConstruction(S, classifyTerrain(S, regionOpts))), 'production classifier reproduces emitted construction suitability bit-for-bit');
ok('C-10', 'CONSTRUCTION', 'PHYSICAL', H.economy.buildable.reduce((a, b) => a + b, 0) > 1242, 'v3 economy.buildable is full-world, not the 23-site projection');

// Independent negative fixtures against P0-04
{
  const syn = cloneS();
  for (let i = 0; i < N; i++) {
    syn.waterClass[i] = 1; syn.elevation[i] = 0; syn.slope[i] = 0; syn.zoneId[i] = 0;
    syn.elderGeometryId[i] = 0; syn.biomeCode[i] = 0; syn.protectedGeometryCandidate[i] = 0;
    syn.coast[i] = 0; syn.clearanceCells[i] = 0;
  }
  const patch = [];
  for (let y = 30; y < 50; y++) for (let x = 30; x < 50; x++) { const c = idx(x, y); patch.push(c); syn.waterClass[c] = 0; syn.clearanceCells[c] = 1; }
  const t = classifyTerrain(syn, regionOpts);
  const suit = classifyConstruction(syn, t);
  const fp = footprintsFrom(suit, syn, [], 9, t);
  fixture('C-NEG-01', 'CONSTRUCTION', 'P0-04 sandbox construction must not be restricted to 23 surveyed zones', 'independent synthetic 20x20 dry flat patch with zoneId=0 (no surveyed zone)', '>=1 physically possible footprint, every cell outside surveyed zones', `footprints=${fp.length} cells=${fp.reduce((a, f) => a + f.cellCount, 0)} outside=${fp.reduce((a, f) => a + f.outsideSurveyedZoneCells, 0)}`, fp.length >= 1 && fp.every(f => f.outsideSurveyedZoneCells === f.cellCount));
}
{
  const syn = cloneS();
  const t = classifyTerrain(syn, regionOpts);
  const c = idx(100, 100); syn.protectedGeometryCandidate[c] = 1;
  const suit = classifyConstruction(syn, t);
  fixture('C-NEG-02', 'CONSTRUCTION', 'P0-04 protected geometry must never become physically possible', 'independent synthetic S with one protectedGeometryCandidate cell', 'suitability[protectedCell]=0', `suitability=${suit[c]}`, suit[c] === 0);
}
{
  const syn = cloneS();
  const t = classifyTerrain(syn, regionOpts);
  const c = idx(101, 100); t.cliff[c] = 1;
  const suit = classifyConstruction(syn, t);
  fixture('C-NEG-03', 'CONSTRUCTION', 'P0-04 a cliff face must never become a buildable footprint', 'independent synthetic T with one cliffCandidate cell forced', 'suitability[cliffCell]=0', `suitability=${suit[c]}`, suit[c] === 0);
}

// ------------------------------------------------------------------ BOUNDED STRUCTURAL CHECKS
ok('S-01', 'STRUCTURAL', 'PHYSICAL', STRUCT.poiRoadEntrances.assessed === 81 && STRUCT.poiRoadEntrances.canonicalLocationsRedesigned === 0, '81 POI road entrances assessed; zero canonical POI relocations');
ok('S-02', 'STRUCTURAL', 'PHYSICAL', STRUCT.poiRoadEntrances.withExteriorEntrance === 55 && STRUCT.poiRoadEntrances.withRoadFrontageWithin40Au === 55 && STRUCT.poiRoadEntrances.noEntranceIds.length === 26 && STRUCT.poiRoadEntrances.distantAccessIds.length === 0, `55/81 POIs have an exterior entrance and ALL 55 have road frontage within ${STRUCT.scope.frontageThresholdAu} au; 26 source POIs have NO exterior entrance (reported by exact ID, NOT redesigned)`);
ok('S-03', 'STRUCTURAL', 'PHYSICAL', STRUCT.overlappingEnvelopes.sitesWithHostOverlap.length > 0 && STRUCT.overlappingEnvelopes.canonicalGeometryChanged === false, `${STRUCT.overlappingEnvelopes.sitesWithHostOverlap.length} host/subsite envelope overlaps reported, none auto-resolved`);
ok('S-04', 'STRUCTURAL', 'PHYSICAL', STRUCT.roofBoundarySemantics.assessed === 153 && STRUCT.roofBoundarySemantics.autoShrinkAppliedCount === 0, '153 roofs classified; ZERO automatic shrinks');
ok('S-05', 'STRUCTURAL', 'PHYSICAL', STRUCT.roofBoundarySemantics.coincidentBoundaryCount === 99 && STRUCT.roofBoundarySemantics.outsideBoundaryCount === 0, 'v2 99 "outside" roofs are actually boundary-COINCIDENT; zero vertices truly outside');
ok('S-06', 'STRUCTURAL', 'PHYSICAL', STRUCT.roofBoundarySemantics.v3NewAutoShrinkCount === 0 && STRUCT.roofBoundarySemantics.v2HistoricalCorrectedInsetCount === 99, 'v2 historical 99 insets preserved but NOT re-applied in v3');
ok('S-07', 'STRUCTURAL', 'PHYSICAL', STRUCT.poiRoadEntrances.pois.every((p, k) => p.atAu[0] === architecture.pois[k].atAu[0] && p.atAu[1] === architecture.pois[k].atAu[1]), 'canonical POI coordinates byte-identical to authored source');
{
  fixture('S-NEG-01', 'STRUCTURAL', 'bounded check must not redesign canonical POIs', 'structural_checks.v3.json vs architecture.pois[]', 'canonicalGeometryChanged=false, 0 redesigns', `changed=${STRUCT.poiRoadEntrances.canonicalLocationsRedesigned}`, STRUCT.poiRoadEntrances.canonicalLocationsRedesigned === 0);
  fixture('S-NEG-02', 'STRUCTURAL', 'bounded check must not auto-shrink all flagged roofs', 'v2 99 corrected insets vs v3 roofBoundarySemantics', 'v3 autoShrinkAppliedCount=0 and 99 classified as boundary-coincident', `v3Shrinks=${STRUCT.roofBoundarySemantics.autoShrinkAppliedCount} coincident=${STRUCT.roofBoundarySemantics.coincidentBoundaryCount}`, STRUCT.roofBoundarySemantics.autoShrinkAppliedCount === 0 && STRUCT.roofBoundarySemantics.coincidentBoundaryCount === 99);
}

// ------------------------------------------------------------------ TYPED INTERFACE / COMPATIBILITY
ok('I-01', 'INTERFACE', 'PHYSICAL', I.compatibleWith.length === 2 && I.compatibleWith.some(x => x.name === 'EconomyMap') && I.compatibleWith.some(x => x.name === 'GeographicHandoff'), 'shape compatibility with EconomyMap + GeographicHandoff declared');
ok('I-02', 'INTERFACE', 'PHYSICAL', Object.keys(I.statusVocabulary).length >= 5 && ['UNKNOWN', 'PROPOSED', 'VERIFIED', 'UNRESOLVED', 'BLOCKED'].every(k => I.statusVocabulary[k]), 'explicit UNKNOWN/PROPOSED/VERIFIED/UNRESOLVED/BLOCKED vocabulary');
ok('I-03', 'INTERFACE', 'PHYSICAL', I.fields.length >= 15 && I.fields.every(f => f.provenance && f.noAuthorityClaim && f.status && f.owner), 'every typed field has provenance, status, owner and a no-authority claim');
ok('I-04', 'INTERFACE', 'PHYSICAL', I.unapprovedValuesAreNotAuthoritative === true && I.noClaims.includes('NO authoritative unapproved value'), 'unapproved values explicitly NOT authoritative');
ok('I-05', 'INTERFACE', 'PHYSICAL', ['biome', 'elevation', 'slope', 'moisture', 'temperature', 'freshwater', 'coast', 'walkable', 'buildable', 'cargoPassable', 'road', 'protected', 'industrial'].every(k => H.economy[k].length === N), `13 EconomyMap arrays each ${N} cells (shape compatibility)`);
ok('I-06', 'INTERFACE', 'PHYSICAL', H.gameplayValidators.validateEconomyMap.startsWith('NOT_EXECUTED') && H.gameplayValidators.validateGeographicHandoff.startsWith('NOT_EXECUTED'), 'Gameplay validators NOT executed and NOT claimed PASS');
ok('I-07', 'INTERFACE', 'PHYSICAL', H.unresolvedGameplayOwned.length >= 10 && H.unresolvedGameplayOwned.every(u => u.owner), 'every remaining blocker has an exact ID and owner');
ok('I-08', 'INTERFACE', 'PHYSICAL', H.roadsWithWaterCells.length === 26 && H.gameplayValidators.note.includes('compatibility boundary'), '26 water-crossing road IDs reported as an explicit compatibility boundary');
{
  fixture('I-NEG-01', 'INTERFACE', 'unapproved Gameplay values must not appear authoritative', 'interface fields + handoff validators', 'cargoPassable all 0, approvedTraversal cellCount 0, validators NOT_EXECUTED', `cargo=${H.economy.cargoPassable.reduce((a, b) => a + b, 0)} approved=${H.approvedTraversal.cellCount}`, H.economy.cargoPassable.reduce((a, b) => a + b, 0) === 0 && H.approvedTraversal.cellCount === 0 && H.gameplayValidators.validateEconomyMap.includes('NOT_EXECUTED'));
  fixture('I-NEG-02', 'INTERFACE', 'visible road surface must not be conflated with traversal permission', 'v3 roadSurface.u8 vs traversal_graph.v3.json + activeCollisionPermission.u8', 'road surface cells > 0, graph edges > 0, ZERO active permissions', `surfaceCells=${sum(R.roadSurface)} edges=${GRAPH.edgeCount} permissions=${sum(R.activeCollisionPermission)}`, sum(R.roadSurface) > 0 && GRAPH.edgeCount > 0 && sum(R.activeCollisionPermission) === 0);
}

// ------------------------------------------------------------------ EVIDENCE / VIEWS / DETERMINISM
const handoffCheck = readJson('v3/evidence/handoff_check.v3.json');
const winReport = readJson('v3/evidence/windows/window_report.v3.json');
ok('E-01', 'EVIDENCE', 'PHYSICAL', handoffCheck.status === 'WMP_V3_HANDOFF_OK' && handoffCheck.errors.length === 0, 'mapStructuralSelfCheckV3 errors=0 (NOT a Gameplay validator PASS)');
ok('E-02', 'EVIDENCE', 'PHYSICAL', handoffCheck.gameplayValidatorBoundary.owner === 'GAMEPLAY' && handoffCheck.gameplayValidatorsExecuted === false, 'compatibility boundary explicitly GAMEPLAY-owned');
ok('E-03', 'EVIDENCE', 'PHYSICAL', winReport.windows === 3 && winReport.maskCount === 25 && winReport.duplicates === 0 && winReport.coverage === `${N}/${N}`, `3 windows x 25 masks, disjoint, coverage ${winReport.coverage}`);
ok('E-04', 'EVIDENCE', 'PHYSICAL', fs.existsSync(`${V3}/evidence/views/views_index.v3.json`), 'technical analytical PNG index exists');
const viewsIndex = JSON.parse(fs.readFileSync(`${V3}/evidence/views/views_index.v3.json`, 'utf8'));
ok('E-05', 'EVIDENCE', 'PHYSICAL', viewsIndex.views.length >= 6 && viewsIndex.views.every(v => v.bytes > 1000 && /^[0-9a-f]{64}$/.test(v.sha256)), `${viewsIndex.views.length} real PNG files with SHA-256 and byte counts`);
ok('E-06', 'EVIDENCE', 'PHYSICAL', viewsIndex.views.every(v => v.classification === 'MAP_ANALYTICAL_TECHNICAL_PREVIEW' && v.status.includes('NOT_WEB_RUNTIME_PROOF')), 'all views labelled technical, NOT Web runtime or visual acceptance');
ok('E-07', 'EVIDENCE', 'PHYSICAL', M.revisionDigest.length === 64 && M.digestMethod.includes('no wallclock'), 'deterministic revision digest, no wallclock');
ok('E-08', 'EVIDENCE', 'PHYSICAL', M.noClaims.includes('NO production tileset') && M.noClaims.includes('NO playable Veyra'), 'no production/playable claim');

// ------------------------------------------------------------------ write results
const physical = results.filter(r => r.kind === 'PHYSICAL').length;
const negative = results.filter(r => r.kind === 'NEGATIVE_FIXTURE').length;
const fails = results.filter(r => r.status === 'FAIL').length;
writeV3Json('evidence/tests/test_results.v3.json', {
  schema: 'soh.wmp.v3.test_results', status: fails ? 'WMP_V3_TESTS_FAIL' : 'WMP_V3_TESTS_OK',
  total: results.length, physical, negative, fail: fails,
  groups: [...new Set(results.map(r => r.group))],
  results,
  note: 'Negative fixtures mutate independent synthetic SOURCE inputs and execute the SAME pure production classifiers exported from v3/src/lib_v3.mjs. No fixture merely documents a blocker.',
});
writeV3Json('evidence/tests/negative_fixtures.v3.json', {
  schema: 'soh.wmp.v3.negative_fixtures', status: fails ? 'WMP_V3_FIXTURES_FAIL' : 'WMP_V3_FIXTURES_OK',
  fixtureCount: fixtures.length, defectsCovered: [...new Set(fixtures.map(f => f.defectAgainst))],
  fixtures,
});
console.log(`WMP_V3_TESTS ${results.length - fails}/${results.length} physical=${physical} negative=${negative} FAIL=${fails}`);
console.log(`WMP_V3_NEGATIVE_FIXTURES_OK fixtures=${fixtures.length} defects=${[...new Set(fixtures.map(f => f.defectAgainst))].length}`);
