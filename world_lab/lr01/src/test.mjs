#!/usr/bin/env node
// MAP-LR01 continuous gates. Milestone A checks live here; B-F append below.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVeyra, loadGeoInputs, readJson } from './lib/veyra.mjs';
import { poiGeometry, poiFit, aggregateFit, transformProfile, featureQuantization, travelAt, memoryAt, loadScale01a, CANDIDATE_U, FOCUS_U } from './lib/scale.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.LR01_OUT ? path.resolve(process.env.LR01_OUT) : path.resolve(HERE, '../output');
let pass = 0, fail = 0;
const ok = (id, cond, detail = '') => { if (cond) { pass++; } else { fail++; console.error(`FAIL ${id} ${detail}`); } };
const approx = (a, b, eps = 1e-6) => a !== null && Math.abs(a - b) < eps;

const V = loadVeyra();
const GEO = loadGeoInputs();
const S01 = loadScale01a();
const A = readJson(path.join(OUT, 'scale_corrected.v1.json'));
const PG = readJson(path.join(OUT, 'poi_geometry.v1.json'));
const geoms = V.P.pois.map(poiGeometry);

// ---- source integrity ----
ok('SRC-01-CANON-SHA', V.fingerprint.verified && V.fingerprint.actualSha256 === V.fingerprint.sha256);
ok('SRC-02-CANON-FRAME', V.P.terrain.gw === 250 && V.P.terrain.gh === 175 && V.P.terrain.cell === 8, `${V.P.terrain.gw}x${V.P.terrain.gh}`);
ok('SRC-03-CANON-COUNTS', V.P.land.length === 8 && V.P.pois.length === 81 && V.P.roads.length === 92 && V.P.bridges.length === 12 && V.P.docks.length === 27 && V.P.elders.length === 6 && V.P.spawns.length === 4 && V.P.zones.length === 23 && V.P.lakes.length === 5 && V.P.rivers.length === 17 && V.P.resources.length === 280);
ok('SRC-04-GEO-SHA', GEO.fingerprints.geography.sha256.startsWith('13ae9727') && GEO.fingerprints.corridor.sha256.startsWith('e9212633'));
ok('SRC-05-RASTER-CELLS', Object.values(GEO.r1).every(r => r.data.length === 43750));
ok('SRC-06-NO-CANON-MUTATION', fs.existsSync(path.join(OUT, 'scale_corrected.v1.json')) && A.noClaims.includes('NO canon edit'));
ok('SRC-07-FRAME-UNCHANGED', A.frame.authoring[0] === 2000 && A.frame.authoring[1] === 1400 && A.frame.transformStatus === 'UNDECIDED');

// ---- Milestone A: corrected per-POI geometry ----
const minEdges = geoms.map(g => g.foot.minEdgeAu);
ok('A-01-PER-POI-EDGES-VARY', new Set(minEdges.map(x => x.toFixed(3))).size === 13, `distinct=${new Set(minEdges.map(x => x.toFixed(3))).size}`);
ok('A-02-NO-GLOBAL-MIN', Math.min(...minEdges) === 11 && minEdges.filter(x => x === 11).length === 4 && Math.max(...minEdges) === 37.4, 'only 4/81 POIs own the 11 au edge SCALE-01A applied to all 81');
ok('A-03-81-GEOMETRIES', PG.pois.length === 81 && geoms.every(g => g.foot.obb && g.foot.edgesAu.length >= 4));
ok('A-04-DEEP-POLYGONS', geoms.filter(g => g.deep).length === 18);
ok('A-05-CLASSIFICATION', geoms.filter(g => g.enclosure.startsWith('ENCLOSED')).length === 38 && geoms.filter(g => g.enclosure === 'OPEN_AIR_YARD').length === 43 && geoms.filter(g => g.enclosure === 'UNRESOLVED').length === 0);
ok('A-06-CLASS-STATUS', geoms.every(g => g.classificationStatus === 'DERIVED_HEURISTIC__NOT_CANONICAL'));
ok('A-07-NO-INVENTED-ENTRANCE', geoms.every(g => g.entrance.authored === false && g.entrance.status === 'NOT_IN_SOURCE'));

const fits = U => geoms.map(g => poiFit(g, U));
const agg = U => aggregateFit(geoms, fits(U), U);
ok('A-08-CORRECTED-U2', agg(2).enclosedWithRoomAndEntrance === 38 && agg(2).openAirWithYard === 43);
ok('A-09-CORRECTED-U8', agg(8).enclosedWithRoomAndEntrance === 0 && agg(8).openAirWithYard === 20);
ok('A-10-CORRECTED-NOT-81', agg(4).poiFeetUnableToHostSmallestRoom_CORRECTED !== 81 && agg(8).poiFeetUnableToHostSmallestRoom_CORRECTED !== 81);
ok('A-11-DEFECT-RECORDED', A.defectCorrection.id === 'SCALE01A-PER-POI-DEFECT' && A.defectCorrection.priorCounts['4'] === 81);
ok('A-12-DEFECT-NOT-RECURRING', A.defectCorrection.correctedCounts['8'] < 81 && A.defectCorrection.correctedCounts['4'] < 81);

// ---- fractional transforms / explicit raster coverage ----
const t168 = transformProfile(1.68), t2 = transformProfile(2), t8 = transformProfile(8), t25 = transformProfile(2.5);
ok('A-13-FOCUS-BAND', FOCUS_U.includes(1.68) && FOCUS_U.includes(2) && FOCUS_U.includes(2.25) && A.candidateU.length === CANDIDATE_U.length);
ok('A-14-U168-FRACTIONAL', t168.fractionalEdge === true && approx(t168.worldTilesExact[0], 2000 / 1.68, 1e-4) && t168.coverage.partialEdgeTileCount > 0);
ok('A-15-U168-RASTER-COVERAGE', t168.raster.fractionalSourceCellsRequiringResampling === 43750 && t168.raster.runtimeTileColumnsRowsStraddlingSourceCellBoundary > 0);
ok('A-16-U2-EXACT', t2.exactIntegerDims && t2.worldTilesExact[0] === 1000 && t2.worldTilesExact[1] === 700 && t2.coverage.partialEdgeTileCount === 0 && t2.raster.fractionalSourceCellsRequiringResampling === 0);
ok('A-17-U25-FRAME-EXACT-RASTER-NOT', !t25.fractionalEdge && t25.raster.fractionalSourceCellsRequiringResampling === 43750, 'frame divides evenly but 8/2.5 is fractional');
ok('A-18-U8-RASTER', t8.worldTilesExact[0] === 250 && t8.worldTilesExact[1] === 175 && t8.raster.sourceCellsExactlyAligned === 43750);
ok('A-19-TRANSFORM-MODES', t168.coverage.transformModes.length === 3 && t2.coverage.transformModes[0] === 'EXACT_1:1_TILE_GRID');
ok('A-20-FEATURE-QUANT', featureQuantization(2).features.find(f => f.id === 'proposed_po_kilns_west_opening').openTiles === 1 && featureQuantization(4).features.find(f => f.id === 'proposed_po_kilns_west_opening').openTiles === 0);

// ---- travel / physical space / memory / resolution ----
const tr2 = travelAt(2, S01), tr168 = travelAt(1.68, S01);
const priorRt1 = S01.metrics.byScale['2'].find(x => x.journeyId === 'corridor.RT-1');
ok('A-21-TRAVEL-REGRESSION', approx(tr2.rt1.geographicRouteSeconds, priorRt1.geographicRouteSeconds, 1e-3), `ours=${tr2.rt1.geographicRouteSeconds} prior=${priorRt1.geographicRouteSeconds}`);
ok('A-22-FRACTIONAL-TRAVEL', tr168.rt1.geographicRouteSeconds > tr2.rt1.geographicRouteSeconds && tr168.crossWorldWidthSeconds > tr2.crossWorldWidthSeconds);
ok('A-23-NO-CART-CLAIM', tr2.rt1.cartStatus.includes('NOT_CART_PASSABLE') && tr168.rt1.cartStatus.includes('NOT_CART_PASSABLE'));
ok('A-24-MEMORY-REGRESSION', approx(memoryAt(2).totalMBLowerBound, 100.8034, 1e-3) && approx(memoryAt(8).totalMBLowerBound, 6.3002, 1e-3));
ok('A-25-MEMORY-LABEL', memoryAt(2).model.startsWith('LOWER-BOUND MODEL, NOT MEASURED'));
ok('A-26-NO-NEW-DETAIL', A.profiles.every(p => p.resolution.newAuthoredDetail.startsWith('NONE')));
ok('A-27-UNCERTAINTY', A.profiles.every(p => p.uncertainty.length >= 5));
ok('A-28-NO-CANONIZED-SCALE', A.boundedBandStatement.includes('NOT') && A.noClaims.includes('NO approved scale') && A.status.includes('UNDECIDED'));
ok('A-29-NO-TEMP-CONSTANTS-AS-LAW', A.profiles.every(p => p.uncertainty.some(u => u.includes('TEMPORARY engine constants'))));
ok('A-30-GEO-TOL7-REGRESSION', GEO.audit.audit.junctionTolerances.maplabSnapTolAu === 7 && GEO.audit.audit.junctionTolerances.geo01JoinToleranceAu === 8 && GEO.audit.correctionsToGeo01 !== undefined, 'SNAP_TOL=7 must win; tolerance-8 defect not preserved');

// ---- Milestone B-F gates (appended as modules land) ----
for (const f of ['geography.v1.json', 'transport.v1.json', 'poi_layouts.v1.json', 'art_manifest.v1.json', 'handoff.v1.json']) {
  if (fs.existsSync(path.join(OUT, f))) ok(`GATE-FILE-${f}`, true);
}

console.log(`LR01_TESTS ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
