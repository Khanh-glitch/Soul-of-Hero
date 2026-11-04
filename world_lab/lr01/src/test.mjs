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

// ---- Milestone B: whole-world geography ----
const BG = readJson(path.join(OUT, 'geography.v1.json'));
const FS = readJson(path.join(OUT, 'feature_status.v1.json'));
const REG = path.join(OUT, 'regions');
ok('B-01-GEO-SCHEMA', BG.schema === 'soh.map.lr01.geography.v1' && BG.stage === 'STAGE_1_MAP_GEOGRAPHY' && BG.status.includes('WHOLE_WORLD'));
ok('B-02-ALL-CANON-COUNTS', BG.counts.land === 8 && BG.counts.rivers === 17 && BG.counts.roads === 92 && BG.counts.bridges === 12 && BG.counts.docks === 27 && BG.counts.pois === 81 && BG.counts.zones === 23 && BG.counts.resources === 280 && BG.counts.spawns === 4 && BG.counts.elders === 6 && BG.counts.labels === 24 && BG.counts.totalCanonicalObjects === 579);
ok('B-03-FRAME-AND-TRANSFORM', BG.frame.authoring.w === 2000 && BG.frame.authoring.h === 1400 && BG.frame.transform.status === 'UNDECIDED' && BG.frame.transform.fullFrameRetained === true && BG.frame.sourceGrid.cells === 43750);
ok('B-04-EIGHT-LANDMASSES', BG.landmasses.length === 8 && new Set(BG.landmasses.map(l => l.id)).size === 8 && BG.landmasses.every(l => l.geometry.ringsAu && l.rasterCells.cells > 0 && l.coastline && l.wetlands && l.relief));
ok('B-05-579-STATUS-ROWS', FS.count === 579 && FS.features.length === 579 && FS.features.every(f => f.status || f.statuses));
ok('B-06-41-REGION-EXPORTS', fs.readdirSync(REG).filter(f => f.endsWith('.v1.json')).length === 41);
ok('B-07-HYDRO-INTEGRITY', BG.hydrography.rivers.length === 17 && BG.hydrography.watershed.danglingReferenceCount === 0 && BG.hydrography.watershed.authoredOutletGaps.length === 1);
ok('B-08-NO-GAMEPLAY-FABRICATION', BG.habitatMarkers.markerCount === 280 && BG.habitatMarkers.noFabrication.includes('No runtime resource instance') && BG.noClaims.some(s => s.includes('NO runtime resource instances')));
ok('B-09-NO-CLIMATE-INVENTION', !!BG.terrain.noMoistureOrTemperature && BG.terrain.elevation.physicalScale === 'UNDEFINED' && BG.terrain.slope.editorThresholdStatus.includes('NOT_GAMEPLAY'));
ok('B-10-ELDERS-AND-SEPARATION', BG.elders.length === 6 && BG.elderSeparation.length === 15 && BG.elders.every(e => e.geometry.arenas.length === e.arenaCount));
ok('B-11-SPAWNS-AND-CORRIDORS', BG.spawns.length === 4 && BG.spawns.every(s => s.walkableAtSpawn === true) && Object.keys(BG.practicalCorridors).length === 4);
ok('B-12-STATUS-VOCABULARY', BG.statusVocabulary.includes('SOURCE_AUTHORED') && BG.statusVocabulary.includes('PROPOSED') && BG.statusVocabulary.includes('UNRESOLVED') && BG.statusVocabulary.includes('BLOCKED') && BG.proposedChanges.length >= 8);
ok('B-13-NO-CANON-EDIT', BG.noClaims.includes('NO canonical Veyra edit') && BG.noClaims.includes('NO macro-geography rewrite'));

// ---- Milestone C: transport at SNAP_TOL=7 ----
const TR = readJson(path.join(OUT, 'transport.v1.json'));
const RG = readJson(path.join(OUT, 'route_graph.v1.json'));
const BS = readJson(path.join(OUT, 'build_sites.v1.json'));
const TF = readJson(path.join(OUT, 'transport_failures.v1.json'));
ok('C-01-TOL-7-AUTHORITATIVE', TR.constants.SNAP_TOL === 7 && RG.tol === 7 && TR.toleranceRegression.verdict.includes('REDERIVED_AT_7'));
ok('C-02-TOL-8-DEFECT-NOT-PRESERVED', TR.toleranceRegression.tol8.selfMergedFootEdges > 3 * TR.toleranceRegression.tol7.selfMergedFootEdges && TR.toleranceRegression.geo01JoinToleranceAu === 8 && TR.toleranceRegression.verdict.startsWith('GEO01_TOLERANCE'));
ok('C-03-CROSSINGS-MATCH-GEO02', TR.graph.crossingsMatchGeo02 === true && TR.crossings.count === 18 && TR.crossings.count === GEO.audit.audit.bridgeCrossings.allCrossings.length);
ok('C-04-NO-CART-PASSABLE-CLAIM', TR.bridges.every(b => b.cartPassable === false) && TR.roadPhysicalProposals.every(r => r.cartPassable === false) && TR.noClaims.some(s => s.includes('NO cart-passable claim')));
ok('C-05-POI-KILNS-CART-GAP', TR.poiAccess.noCartAccess.includes('po_kilns') && TR.poiAccess.footWithinAccessR === 81 && TR.poiAccess.cartWithinAccessR < 81);
ok('C-06-ZERO-CLEARANCE-FAILURE', TF.failures.some(f => f.id === 'F-C-04' && JSON.stringify(f.coordinate) === '[732,652]' && f.status === 'BLOCKED'));
ok('C-07-BUILD-SITES', BS.count === 23 && BS.sites.length === 23 && BS.sites.every(s => s.occupancyStatus === 'UNKNOWN' && s.claimLegalityStatus === 'GAMEPLAY_OWNED' && s.sweptClearanceAu === null));
ok('C-08-ROUTE-GRAPH', RG.nodeCount === TR.graph.nodes && RG.footEdges.length === TR.graph.footEdges && RG.cartEdges.length === TR.graph.cartEdges);
ok('C-09-FAILURE-CASES', TF.count === 7 && TF.failures.every(f => f.featureIds && f.unit && f.sourceFile && f.expected && f.actual && f.owner && f.status));
ok('C-10-GLYPH-NOT-COLLISION', TR.bridges.every(b => b.displayGlyphStatus.includes('NOT_COLLISION_DIMENSION') && b.physicalDeckSpanAu === null && b.channelFitVerified === false));
ok('C-11-FERRIES-BLOCKED', TR.ferries.length === 8 && TF.failures.some(f => f.id === 'F-C-05' && f.status === 'BLOCKED' && f.owner === 'GAMEPLAY'));
ok('C-12-WIDTHS-UNRESOLVED', TR.roadPhysicalProposals.every(r => r.physicalWidthAu === null && r.physicalWidthStatus === 'UNRESOLVED' && r.proposedSurface.status === 'PROPOSED' && r.sweptClearanceAu === null));
ok('C-13-ACTIVE-VS-ISOLATED', TR.graph.footComponentsActive < TR.graph.footComponentsIncludingIsolatedNodes && TR.graph.isolatedNodeInflation.cart > 0);

// ---- Milestone D: 81 POI spatial layouts ----
const DL = readJson(path.join(OUT, 'poi_layouts.v1.json'));
const EXDIR = path.join(OUT, 'poi_examples');
ok('D-01-SCHEMA', DL.schema === 'soh.map.lr01.poi_layouts.v1' && DL.status.includes('INTERIORS_PROPOSED_NOT_CANON') && DL.stage === 'STAGE_1_MAP_GEOGRAPHY');
ok('D-02-81-POIS', DL.layouts.length === 81 && new Set(DL.layouts.map(l => l.poiId)).size === 81);
ok('D-03-24-ARCHETYPES', DL.archetypeCoverage.length === 24 && DL.archetypeCoverage.reduce((s, a) => s + a.poiCount, 0) === 81);
ok('D-04-STABLE-IDS', DL.counts.duplicateStableIds === 0 && DL.counts.stableIds === 1701 && DL.layouts.every(l => l.stableIds.rooms.every(id => id.includes(l.poiId)) && l.stableIds.sockets.every(id => id.includes(l.poiId))));
ok('D-05-SOURCE-SHELLS', DL.layouts.every(l => l.canonical.footPolygonAu.length >= 3 && l.status.includes('CANONICAL_FOOTPRINT_ONLY')));
ok('D-06-NO-INVENTED-DOORS', DL.layouts.every(l => l.entrance.lockedState === 'UNKNOWN' && l.entrance.powerRequirement === 'UNKNOWN' && l.entrance.doorStateOwner === 'GAMEPLAY' && l.entrance.openingStatus.includes('PROPOSED')));
ok('D-07-KILNS-WEST-OPENING', (() => { const k = DL.layouts.find(l => l.poiId === 'po_kilns'); const minX = Math.min(...k.canonical.footPolygonAu.map(p => p[0])); return k.entrance.openingAu === 3.696 && k.entrance.openingStatus.includes('GEO02_PROPOSED') && k.entrance.atAu[0] < minX + 2; })());
ok('D-08-SOCKETS-ARE-FIT-ONLY', DL.layouts.every(l => l.sockets.every(s => s.gameplayObject === null && s.purpose === 'SPATIAL_FIT_ONLY' && s.parentPoiId === l.poiId)));
ok('D-09-SIX-ADAPTERS', DL.adapterVocabulary.length === 6 && DL.layouts.every(l => DL.adapterVocabulary.every(k => l.geometryAdapters[k]) && l.geometryAdapters.portalPassability.status.startsWith('UNKNOWN__')));
ok('D-10-DEEP-LEVELS', DL.layouts.filter(l => l.levels.length > 1).length === 18 && DL.layouts.filter(l => l.portals.some(p => p.kind === 'VERTICAL_LINK')).every(l => l.portals.find(p => p.kind === 'VERTICAL_LINK').verticalSeparationAu === null));
ok('D-11-NO-LOOT-OR-DEVICES', DL.noClaims.some(s => s.includes('NO loot')) && DL.noClaims.some(s => s.includes('NO generator')) && DL.noClaims.some(s => s.includes('NO locked-door')));
ok('D-12-ARCHETYPE-VARIETY', new Set(DL.archetypeCoverage.map(a => a.template.pattern)).size >= 20 && new Set(DL.summary.map(s => s.rooms)).size >= 3 && new Set(DL.summary.map(s => s.sockets)).size >= 3);
ok('D-13-REPRESENTATIVE-EXAMPLES', DL.representativeExamples.length === 8 && fs.readdirSync(EXDIR).filter(f => f.endsWith('.v1.json')).length === 8 && DL.representativeExamples.every(e => e.reason && fs.existsSync(path.join(EXDIR, `${e.poiId}.v1.json`))));
ok('D-14-CIRCULATION-CONNECTED', DL.layouts.every(l => l.circulation.reachableRooms === l.circulation.totalRooms));
ok('D-15-NO-CANON-REWRITE', DL.noClaims.includes('NO canonical Veyra rewrite') && DL.noClaims.some(s => s.includes('one-generic-room')));

// ---- Milestone E-F gates (appended as modules land) ----
for (const f of ['art_manifest.v1.json', 'handoff.v1.json']) {
  if (fs.existsSync(path.join(OUT, f))) ok(`GATE-FILE-${f}`, true);
}

console.log(`LR01_TESTS ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
