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
