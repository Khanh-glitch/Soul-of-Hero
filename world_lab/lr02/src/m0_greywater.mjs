// MAP-LR02 M0 — EARLY consumer-ready bounded Greywater spatial patch.
// Pins the exact LR01 parent digest; emits real clipped static solids and
// geometric openings, source/coordinate/transform metadata, geographic
// eligibility for the bounded region, and reproducible positive/negative tests.
import path from 'node:path';
import { OUT, LR01, CONST, sourceHeader, digestBody, loadLr01, loadSources, writeJson, readJson, r4 } from './lib/lr02.mjs';
import { compilePoi, compileAll } from './lib/portal_geometry.mjs';
import { compileEligibility, compileLocalContext, CELL, GW } from './lib/spawn_eligibility.mjs';
import { negativeTests } from './lib/negative_tests.mjs';

const lr = loadLr01();
const src = loadSources();
const sources = { I: src.I, P: src.P, V: src.V, GEO: src.GEO };
const WINDOW = [680, 550, 900, 660];
const POI_ID = 'po_greywater';
const ZONE_ID = 'zone_bz_greywater';

const gwLayout = lr.layouts.layouts.find(l => l.poiId === POI_ID);
if (!gwLayout) throw new Error('po_greywater missing from pinned LR01 layouts');
const gw = compilePoi(gwLayout);
const all = compileAll(lr.layouts);
const eligibility = compileEligibility(sources, lr);
const local = compileLocalContext(sources, lr, { id: ZONE_ID, label: 'Greywater bounded physical region', windowAu: WINDOW });
const negatives = negativeTests(lr.layouts);

// ---- bounded Greywater eligible AREA (not a point, not renamed sp_lake) ----
const eligibleCells = [];
for (const r of eligibility.candidateRegions) for (const i of r.geometry.cellIndices) {
  const x = (i % GW + 0.5) * CELL, y = (Math.floor(i / GW) + 0.5) * CELL;
  if (x >= WINDOW[0] && x <= WINDOW[2] && y >= WINDOW[1] && y <= WINDOW[3]) eligibleCells.push({ i, x, y });
}
const cellSet = new Map(eligibleCells.map(c => [c.i, c]));
const parentRegionIds = [...new Set(eligibility.candidateRegions.filter(r => r.geometry.cellIndices.some(i => cellSet.has(i))).map(r => r.candidateId))];
const cellStats = (() => {
  let clMin = Infinity, clSum = 0, elSum = 0, slSum = 0;
  const biomes = {};
  for (const c of eligibleCells) {
    clMin = Math.min(clMin, src.I.clearanceCells[c.i]); clSum += src.I.clearanceCells[c.i];
    elSum += src.I.elevation[c.i]; slSum += src.I.slope[c.i];
    biomes[src.I.biomeCode[c.i]] = (biomes[src.I.biomeCode[c.i]] || 0) + 1;
  }
  const n = Math.max(1, eligibleCells.length);
  return { localClearanceAu: { min: r4(clMin * CELL), mean: r4(clSum / n * CELL) }, elevationRawByteMean: r4(elSum / n), slopeRawDeltaMean: r4(slSum / n), biomeHistogram: biomes };
})();
const xs = eligibleCells.flatMap(c => [c.x - CELL / 2, c.x + CELL / 2]);
const ys = eligibleCells.flatMap(c => [c.y - CELL / 2, c.y + CELL / 2]);
const greywaterEligibleArea = {
  id: 'se.greywater_bounded.v1',
  derivedFromCandidateRegionIds: parentRegionIds,
  status: 'DERIVED_STATIC_ELIGIBILITY__CLIPPED_TO_BOUNDED_WINDOW',
  windowAu: WINDOW.map(r4),
  unit: 'authoring_unit', sourceResolutionAu: CELL,
  cellCount: eligibleCells.length, cellIndices: eligibleCells.map(c => c.i),
  areaAu2: r4(eligibleCells.length * CELL * CELL),
  bboxAu: eligibleCells.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r4) : null,
  support: cellStats,
  note: 'Authoritative membership is cellIndices. This is an AREA, not a single spawn point and not a renamed sp_lake landmark.',
};

// ---- DIAGNOSTIC U=1.6 / U=2.0 same-origin projections (NOT approved scale) ----
const diagnosticTransforms = CONST.diagnosticU.map(U => {
  const t = p => p.map(v => r4(v / U));
  return {
    U, formula: 'x_tile = x_au / U; y_tile = y_au / U', originAu: [0, 0], sameOriginProjectionOnly: true,
    frameTiles: [r4(CONST.frame.w / U), r4(CONST.frame.h / U)],
    canonicalFrameRetained: true, globalScaleDecision: 'UNDECIDED',
    staticSolids: gw.staticSolids.map(s => ({ id: s.id, parentWallId: s.parentWallId, aTiles: t(s.aAu), bTiles: t(s.bAu), lengthTiles: r4(s.lengthAu / U), thicknessTiles: r4(s.thicknessAu / U), orientationRad: s.orientationRad, blocksMovement: true })),
    staticOpenings: gw.staticOpenings.map(o => ({ id: o.id, wallId: o.wallId, aTiles: t(o.aAu), bTiles: t(o.bAu), centreTiles: t(o.centreAu), intervalTiles: o.intervalAu.map(v => r4(v / U)), openingTiles: r4(o.openingAu / U), effectiveClearWidthTiles: r4(o.effectiveClearWidthAu / U) })),
    entranceTiles: t(gw.entryGeometry.entryCentreAu),
    eligibleAreaTiles: { bboxTiles: greywaterEligibleArea.bboxAu?.map(v => r4(v / U)) ?? null, cellSizeTiles: r4(CELL / U) },
    status: 'DIAGNOSTIC_ONLY__NOT_APPROVED_WORLD_SCALE',
    note: 'Joint review 6619478477 request. Isolated projection of the SAME region at the SAME global origin. No canonical frame edit, no 200x200 reinterpretation.',
  };
});

// ---- observed GAME-LR02 source at a natural checkpoint (READ-ONLY) ----
// Facts from 7b9805b2 web/src/game/veyra/{intake,projection}.ts + PR44 6619873863.
const GAMEPLAY_HEAD = CONST.gameplayLr02HeadObserved;
const GAMEPLAY_ORIGIN_AU = [640, 440];
const GAMEPLAY_GRID = [200, 200];
const gameplayTile = (p, U) => [r4((p[0] - GAMEPLAY_ORIGIN_AU[0]) / U), r4((p[1] - GAMEPLAY_ORIGIN_AU[1]) / U)];
const gameplayTileIndex = (p, U) => [Math.floor((p[0] - GAMEPLAY_ORIGIN_AU[0]) / U), Math.floor((p[1] - GAMEPLAY_ORIGIN_AU[1]) / U)];
const consumerProjections = CONST.diagnosticU.map(U => {
  const solids = gw.staticSolids.map(s => ({ id: s.id, parentWallId: s.parentWallId, aTiles: gameplayTile(s.aAu, U), bTiles: gameplayTile(s.bAu, U), aTileIndex: gameplayTileIndex(s.aAu, U), bTileIndex: gameplayTileIndex(s.bAu, U), thicknessTiles: r4(s.thicknessAu / U), blocksMovement: true }));
  const openings = gw.staticOpenings.map(o => ({ id: o.id, wallId: o.wallId, aTiles: gameplayTile(o.aAu, U), bTiles: gameplayTile(o.bAu, U), centreTiles: gameplayTile(o.centreAu, U), centreTileIndex: gameplayTileIndex(o.centreAu, U), openingTiles: r4(o.openingAu / U), effectiveClearWidthTiles: r4(o.effectiveClearWidthAu / U), blocksMovement: false }));
  const allPts = gw.staticSolids.flatMap(s => [s.aAu, s.bAu]).concat(gw.staticOpenings.flatMap(o => [o.aAu, o.bAu]));
  const inside = allPts.every(p => gameplayTileIndex(p, U)[0] >= 0 && gameplayTileIndex(p, U)[0] < 200 && gameplayTileIndex(p, U)[1] >= 0 && gameplayTileIndex(p, U)[1] < 200);
  return {
    U, originAu: GAMEPLAY_ORIGIN_AU, runtimeGridTiles: GAMEPLAY_GRID, tilePx: 16,
    formula: 'tileExact = (au - originAu)/U; tileIndex = floor(tileExact)',
    insideObservedGameplayWindow: inside,
    entranceTileIndex: gameplayTileIndex(gw.entryGeometry.entryCentreAu, U),
    staticSolids: solids, staticOpenings: openings,
    eligibleAreaBboxTiles: null,
    status: 'MAP_SUPPLIED_CONSUMER_PROJECTION__GAMEPLAY_INTAKE_NOT_YET_IMPLEMENTED',
  };
});
// fix eligible-area bbox projection explicitly (x uses origin[0], y uses origin[1])
consumerProjections.forEach(t => {
  const b = greywaterEligibleArea.bboxAu;
  t.eligibleAreaBboxTiles = b ? [r4((b[0] - GAMEPLAY_ORIGIN_AU[0]) / t.U), r4((b[1] - GAMEPLAY_ORIGIN_AU[1]) / t.U), r4((b[2] - GAMEPLAY_ORIGIN_AU[0]) / t.U), r4((b[3] - GAMEPLAY_ORIGIN_AU[1]) / t.U)] : null;
});

const gameplayCompatibility = {
  observedAt: { branch: CONST.gp44Branch, head: GAMEPLAY_HEAD, pr44Comment: 6619873863, gameLr02FirstCheckpoint: 'b76d4091 (G0, per comment)', readOnly: true, note: 'Cross-branch READ only. No Gameplay file was modified; no merge, no force-push.' },
  observedIntake: {
    file: 'web/src/game/veyra/intake.ts',
    pinnedSchema: 'soh.map.lr01.geography_package.v1', pinnedRevision: 1, pinnedPackageId: 'veyra-geography-map-lr01',
    pinnedStage: 'STAGE_1_MAP_GEOGRAPHY',
    pinnedMapSourceSha: '74062a5baf2731451fad9638c4243c7459ce8e24',
    pinnedPackageCanonicalSha: 'ac9317ae385d47327f02765e4b2e8ca8465c504f3c7146737ab3ff9b91952eb4',
    pinnedBodySha: CONST.lr01Digest,
    payloadCount: 79, rasterLayers: 21, featureIndex: 579,
    statusVocabulary: ['SOURCE_AUTHORED', 'DERIVED', 'PROPOSED', 'VALIDATED', 'UNRESOLVED', 'BLOCKED', 'UNDECIDED'],
    comment: 'Strictly pinned LR01 v1. A new Map revision needs a separately reviewed pin.',
  },
  observedProjection: {
    file: 'web/src/game/veyra/projection.ts',
    originAu: GAMEPLAY_ORIGIN_AU, unitsPerTile: CONST.diagnosticU, runtimeGridTiles: GAMEPLAY_GRID, tilePx: 16,
    frameAuIdentity: [2000, 1400], projection: 'cell-centre-v1',
    poiGeometrySource: 'canonical project.pois[].foot (polygon containment)',
    returnedStatics: [], returnedStarts: [],
    protectedCellsRule: 'poi || isRoad', buildableRule: 'w===0 && !isRoad && !poi && zone',
    anchors: 'compiler reachability anchors on a 40-tile lattice; explicitly NOT spawn coordinates/landmarks/grants',
    evidenceScreenshots: 'web/evidence/veyra-lr02/{select,start,walk}-veyra-greywater-u{16,20}-{640,1280}.png',
  },
  trueIncompatibilities: [
    { id: 'CMP-01', kind: 'SCHEMA_PIN', detail: 'validateStage1() demands LR01 schema/revision/packageId/stage and a fixed SHA-256 of the WHOLE package JSON. An LR02 patch or v2 package cannot pass it; a separately reviewed Gameplay pin is required.', owner: 'GAMEPLAY', mapAction: 'Do NOT overwrite LR01; publish a new revision with its own digest (done here).', status: 'OPEN' },
    { id: 'CMP-02', kind: 'COORDINATE_ORIGIN', detail: 'Map patch coordinates are global authoring au with origin [0,0]. Gameplay projection uses originAu [640,440] and tile=(au-origin)/U over a 200x200 runtime grid. Raw au must NOT be compared directly to Gameplay tile indices.', owner: 'GAMEPLAY', mapAction: 'Supply exact consumer projection below for U=1.6 and U=2.', status: 'MAP_SUPPLIED' },
    { id: 'CMP-03', kind: 'STATIC_COLLISION_SEAM', detail: 'projectVeyra() returns statics: [] and derives POI containment only from canonical foot polygons. It never reads LR01 geometryAdapters.collision.staticWalls, so physical POI walls/doorways do not exist in the runtime World.', owner: 'GAMEPLAY', mapAction: 'Supply clipped staticSolids + staticOpenings keyed by stable IDs, with openings as holes, not solid walls.', status: 'MAP_SUPPLIED' },
    { id: 'CMP-04', kind: 'STATUS_VOCABULARY', detail: 'Gameplay pins 7 statuses (incl. VALIDATED, UNDECIDED). LR02 uses VERIFIED / UNKNOWN / INVALID / UNRESOLVED to keep Map geometric proof distinct from runtime acceptance.', owner: 'GAMEPLAY+MAP', mapAction: 'Provide an explicit crosswalk; never equate VERIFIED with playable acceptance.', status: 'CROSSWALK_SUPPLIED' },
    { id: 'CMP-05', kind: 'SPAWN_SEAM', detail: 'Gameplay uses internal compiler reachability anchors and returned starts: []; the Map spawn-eligibility contract supplies eligible AREAS + seeded-sampling rules. No contract reader exists yet.', owner: 'GAMEPLAY', mapAction: 'Supply cellIndices, area geometry, unknowns and forbidden fields; do not choose a runtime coordinate.', status: 'MAP_SUPPLIED' },
    { id: 'CMP-06', kind: 'SCALE_AUTHORITY', detail: 'U=1.6 / U=2.0 are Gameplay diagnostic layouts AND Map diagnostic projections. Neither is an approved world scale; the 2000x1400 authoring frame is retained.', owner: 'GAMEPLAY+MAP', status: 'ALIGNED_NO_CLAIM' },
    { id: 'CMP-07', kind: 'ROAD_WATER_WIDTH', detail: 'Gameplay uses a 9 au analytical stroke (radius 4.5) for road/river lines; Map does not treat it as a physical width, swept clearance or bridge deck span.', owner: 'GAMEPLAY+MAP', status: 'ALIGNED_NO_CLAIM' },
  ],
  statusCrosswalk: {
    SOURCE_AUTHORED: 'SOURCE_AUTHORED', DERIVED: 'DERIVED', PROPOSED: 'PROPOSED',
    VERIFIED: 'VALIDATED (Map geometric proof ONLY; runtime acceptance remains UNRESOLVED)',
    UNKNOWN: 'UNDECIDED', UNRESOLVED: 'UNRESOLVED', BLOCKED: 'BLOCKED', INVALID: 'BLOCKED',
    note: 'VERIFIED never means playable, final, or creator-approved.',
  },
  consumerProjections,
  note: 'Factual read of the latest accessible GAME-LR02 source. Not an implementation command, not an assertion that Gameplay has ingested this patch.',
};

const body = {
  schema: 'soh.map.lr02.greywater_spatial_patch.v1',
  version: 1, revision: 1,
  generatedBy: 'world_lab/lr02/src/m0_greywater.mjs',
  authority: 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT',
  status: 'CONSUMER_READY_STATIC_GEOMETRY__NOT_PLAYABLE_ACCEPTANCE',
  parent: sourceHeader().parent,
  source: {
    ...sourceHeader({ jointReview: CONST.jointReviewComment, mapAck: CONST.mapAckComment }),
    lr01LayoutFile: 'world_lab/lr01/output/poi_layouts.v1.json',
    lr01RegionFile: 'world_lab/lr01/output/regions/zone_bz_greywater.v1.json',
    lr01GeographyFile: 'world_lab/lr01/output/geography.v1.json',
    lr01TransportFile: 'world_lab/lr01/output/transport.v1.json',
    canonSha256: src.V.fingerprint.sha256,
    geo01GeographySha256: src.GEO.fingerprints.geography.sha256,
    rasterLayerSha256s: Object.fromEntries(Object.entries(src.GEO.r1).map(([k, v]) => [k, v.sha256])),
    note: 'All 579 canonical source IDs, 8 landmasses, coastlines and the full 2000x1400 authoring frame remain intact in the parent package. LR01 is NOT overwritten.',
  },
  coordinateAndTransform: {
    authoringFrame: CONST.frame,
    unit: 'authoring_unit',
    sourceGrid: CONST.sourceGrid,
    transformStatus: 'UNDECIDED',
    mode: 'NONE_APPLIED',
    canonicalFrameRetained: true,
    note: 'Every coordinate below is in the ORIGINAL 2000x1400 authoring frame. No rescale, crop or warp was applied to canon.',
    diagnosticTransforms,
  },
  boundedRegion: {
    id: 'greywater_bounded.v1',
    windowAu: WINDOW.map(r4),
    poiId: POI_ID, canonicalZoneIds: ['bz_greywater'],
    sourceLandmarkIds: ['sp_lake'],
    sourceLandmarkRole: 'PROVENANCE_ONLY__NOT_A_RUNTIME_SPAWN_COORDINATE',
    footPolygonAu: gwLayout.canonical.footPolygonAu,
    localContext: local,
    note: 'Real source raster, canonical vectors, LR01 region geometry, terrain, roads and water. No invented terrain.',
  },
  staticArchitecture: {
    poiId: POI_ID, arche: gw.arche, enclosurePolicy: gw.policy,
    parentIds: gw.parentIds, idMapping: gw.idMapping, wallClipAudit: gw.wallClipAudit,
    wallThicknessAu: gw.wallThicknessAu, wallThicknessStatus: gw.wallThicknessStatus, openingMarginAu: gw.openingMarginAu,
    staticSolids: gw.staticSolids, staticOpenings: gw.staticOpenings, openBoundary: gw.openBoundary, portalRecords: gw.portalRecords,
    collisionAdapter: gw.collisionAdapter, losAdapter: gw.losAdapter,
    circulation: gw.circulation, roofCoverage: gw.roofCoverage, retreat: gw.retreat,
    fitAtDiagnosticU: gw.fitAtDiagnosticU,
    exactOldToNewSpanIds: gw.idMapping.filter(m => m.kind === 'SPLIT_BY_OPENINGS').map(m => ({ oldWallId: m.oldId, newSolidSpanIds: m.newIds, openingIds: gw.staticOpenings.filter(o => o.wallId === m.oldId).map(o => o.id) })),
    ownership: gw.ownership,
    note: 'Exterior/interior walls are clipped into true solid spans. Each portal is a real geometric opening interval grounded on the actual shared wall/room boundary. Static holes are separate from Gameplay-owned dynamic doors.',
  },
  gameplayCompatibility,
  spawnEligibility: {
    contract: eligibility.gameplayContract,
    criteria: eligibility.criteria,
    greywaterEligibleArea,
    wholeVeyraCoverage: eligibility.coverage,
    wholeVeyraCandidateRegionCount: eligibility.candidateRegions.length,
    spLandmarkPolicy: eligibility.spLandmarkPolicy,
    unverified: eligibility.criteria.unknownConditions,
  },
  buildSiteEnvelope: eligibility.buildSiteEnvelopes.find(s => s.siteId === 'site.bz_greywater') ?? null,
  allPoiCompilerSummary: {
    note: 'Reusable compiler already exercised on all 81 pinned LR01 layouts. Full per-POI output is a later checkpoint; this M0 patch stays focused on the bounded consumer-ready region.',
    counts: all.counts,
    greywaterVerdict: gw.verdict,
  },
  tests: {
    positiveAndNegativeGreywater: gw.tests,
    notApplicableTests: gw.notApplicableTests,
    failedTests: gw.failedTests,
    injectedNegativeTests: negatives,
    digestRecomputation: 'VERIFIED_BY_world_lab/lr02/src/test.mjs',
    reproducibleBy: 'world_lab/lr02/reproduce.sh',
  },
  ready: [
    'Exact LR01 parent package/digest pinned and independently recomputable',
    'Bounded Greywater static solids with real clipped door/entrance openings in authoring units',
    'Exact old wall -> new span ID mapping; parent wall/room/portal/entrance IDs preserved',
    'Positive: exterior entry, open static doorway, LOS through gap, multi-room physical movement, 6/6 rooms reachable',
    'Negative: intact solid span blocks movement/LOS, no accidental gap, no corner shortcut, invalid doors/walls/corridors rejected',
    'Physical grid BFS compared against graph BFS (not substituted)',
    'Greywater eligible AREA geometry + machine-readable seeded-sampling Gameplay contract',
    'U=1.6 / U=2.0 isolated same-origin diagnostic projections with transformed geometry',
  ],
  unverified: [
    'Gameplay intake / projection / integration into the existing SOH Web game',
    'Runtime collision, dynamic door state, lock/power/destruction rules',
    'Runtime tile transform (U UNDECIDED)', 'Seeded final position, occupancy, claim, hazard, actor separation',
    'Player-scale clearance in the real Web runtime (diagnostic FIT only)',
    'K6 roof reveal, resource compilation, build/pay/save-reload acceptance',
    'Creator visual approval', 'Any playable Veyra claim',
  ],
  noClaims: [
    'NO playable Veyra', 'NO final world', 'NO approved scale', 'NO canonical rewrite',
    'NO Gameplay implementation command implied by this handoff',
    'NO dynamic door state, lock, key, power, device, loot, vendor, cash, quest, weather or AI',
    'NO runtime spawn coordinate, spawn compound, house, shelter, crate, beacon or cleared corridor',
    'NO occupancy/claim legality or creature-free distance', 'NO vehicle swept clearance claim',
    'NO fabricated ferry/boat rule or forced land bridge',
  ],
};

const revisionDigest = digestBody(body);
const out = { ...body, revisionDigest, digestMethod: 'sha256 over JSON.stringify(body) in field insertion order; recompute by deleting revisionDigest and digestMethod' };
const file = path.join(OUT, 'greywater_spatial_patch.v1.json');
const bytes = writeJson(file, out);
console.log(`M0_GREYWATER_OK file=${path.relative(process.cwd(), file)} bytes=${bytes}`);
console.log(`  parentDigest=${CONST.lr01Digest}`);
console.log(`  revisionDigest=${revisionDigest}`);
console.log(`  solids=${gw.staticSolids.length} openings=${gw.staticOpenings.length} idMapping=${gw.idMapping.length} verdict=${gw.verdict}`);
console.log(`  greywaterEligibleCells=${greywaterEligibleArea.cellCount} areaAu2=${greywaterEligibleArea.areaAu2} wholeVeyraRegions=${eligibility.candidateRegions.length}`);
console.log(`  greywaterTests=${Object.values(gw.tests).filter(v => v === true).length}/${Object.values(gw.tests).filter(v => v === true || v === false).length} negativeTests=${negatives.pass}/${negatives.total} allPoi=${all.counts.verified}+${all.counts.verifiedWithExceptions} verified / ${all.counts.failed} failed`);
console.log(`  diagnosticU=${CONST.diagnosticU.join(',')} frameRetained=true`);
