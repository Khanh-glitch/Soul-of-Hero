// MAP-LR02 M1 — full-world opening-aware portal geometry package (81 POIs).
import path from 'node:path';
import { OUT, CONST, loadLr01, loadSources, writeRevisionPackage, sourceHeader, r4 } from './lib/lr02.mjs';
import { compileAll, STATUS } from './lib/portal_geometry.mjs';
import { negativeTests } from './lib/negative_tests.mjs';

const lr = loadLr01();
const src = loadSources();
const all = compileAll(lr.layouts);
const negatives = negativeTests(lr.layouts);

const statusHistogram = {};
const bump = k => { statusHistogram[k] = (statusHistogram[k] || 0) + 1; };
for (const p of all.pois) {
  bump(`verdict:${p.verdict}`); bump(`policy:${p.policy.id}`);
  for (const s of p.staticSolids) bump(`solid:${s.status}`);
  for (const o of p.staticOpenings) bump(`opening:${o.status}`);
  for (const b of p.openBoundary) bump(`boundary:${b.status}`);
  for (const r of p.portalRecords) bump(`portal:${r.status}`);
  for (const e of p.exceptions) bump(`exception:${e.reason}`);
}
const perPoi = all.pois.map(p => ({
  poiId: p.poiId, arche: p.arche, enclosureClass: p.enclosureClass, enclosurePolicy: p.policy.id,
  parentSourceRef: p.sourceRef, verdict: p.verdict,
  status: { geometry: p.status, walls: p.staticSolids[0]?.status ?? 'NONE', openings: p.staticOpenings[0]?.status ?? 'NONE', boundary: p.openBoundary[0]?.status ?? 'NONE' },
  testsPass: Object.values(p.tests).filter(v => v === true).length,
  testsApplicable: Object.values(p.tests).filter(v => v === true || v === false).length,
  testsNotApplicable: p.notApplicableTests.length, failedTests: p.failedTests,
  staticSolids: p.staticSolids.length, staticOpenings: p.staticOpenings.length,
  nonSolidBoundary: p.openBoundary.length, parentWalls: p.idMapping.length,
  splitWalls: p.idMapping.filter(m => m.kind === 'SPLIT_BY_OPENINGS').length,
  unchangedWalls: p.idMapping.filter(m => m.kind === 'UNCHANGED').length,
  physicallyReachableRooms: p.circulation.physicallyReachableRoomCount, groundRooms: p.circulation.groundRoomCount,
  graphOnlyRooms: p.circulation.graphOnlyRooms.length, diagonalOnlyRooms: p.circulation.diagonalOnlyReachableRooms.length,
  fitAtDiagnosticU: p.fitAtDiagnosticU.map(f => ({ U: f.U, verdict: f.verdict, effectiveClearTiles: f.effectiveClearTiles })),
  adapterConsistency: p.adapterConsistency.status,
  exceptions: p.exceptions,
  portalStatusCounts: p.portalRecords.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {}),
}));

const body = {
  schema: 'soh.map.lr02.portal_geometry.v1',
  version: 1, revision: 1,
  generatedBy: 'world_lab/lr02/src/m1_portals.mjs',
  authority: 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT',
  status: 'DERIVED_STATIC_GEOMETRY__PROPOSED_PHYSICAL_ARCHITECTURE__NOT_RUNTIME_COLLISION',
  parent: { ...sourceHeader().parent, layoutFile: 'world_lab/lr01/output/poi_layouts.v1.json', layoutCount: 81, parentPoiStableIds: 1701 },
  source: { ...sourceHeader(), canonSha256: src.V.fingerprint.sha256, reuseCompiler: 'world_lab/lr02/src/lib/portal_geometry.mjs', note: 'LR01 poi_layout.mjs defect corrected by a NEW reusable compiler in LR02; LR01 outputs are NOT overwritten.' },
  frame: { authoring: CONST.frame, unit: 'authoring_unit', transformStatus: 'UNDECIDED', diagnosticU: CONST.diagnosticU, note: 'U=1.6/2 isolated diagnostics only; no approved scale, no canonical frame edit.' },
  ownership: {
    map: ['static solid spans', 'static geometric holes', 'stable parent IDs', 'exact old->new span ID mapping', 'roof/retreat/entrance/circulation adapter consistency'],
    gameplay: ['dynamic door open/closed state', 'locks/keys/power', 'destruction', 'runtime collision rules', 'player-scale clearance', 'population and simulation'],
    statusVocabulary: {
      SOURCE_AUTHORED: 'canonical Veyra GOLD object',
      DERIVED: 'computed from pinned source geometry',
      PROPOSED: 'Map-proposed physical geometry, not canon',
      VERIFIED: 'Map geometric proof passed; NOT playable acceptance',
      BLOCKED: 'cannot be resolved from Map-owned evidence',
      UNKNOWN: 'Gameplay-dependent, deliberately not asserted',
      UNRESOLVED: 'canonical deep polygon exists but no approved vertical geometry',
      INVALID: 'rejected by explicit geometric validation',
    },
    gameplayCrosswalk: { VERIFIED: 'VALIDATED (Map geometric proof ONLY)', UNKNOWN: 'UNDECIDED', INVALID: 'BLOCKED', UNRESOLVED: 'UNRESOLVED' },
  },
  compiler: {
    module: 'world_lab/lr02/src/lib/portal_geometry.mjs',
    enclosurePolicies: ['FULL_ENCLOSURE', 'PARTIAL_CLUSTER', 'OPEN_YARD'],
    method: 'Ground each portal on the actual wall / shared-room boundary; validate interval against wall length, safe corner margin and room-boundary segment; reject overlaps/too-close openings; clip each wall into exact solid spans; subtract static holes from a physical occupancy grid; compare 4-neighbour grid BFS against graph BFS and against 8-neighbour BFS.',
    units: { coordinates: 'authoring_unit', lengths: 'authoring_unit', angles: 'radian', thickness: 'authoring_unit', runtimeTiles: 'DIAGNOSTIC_ONLY' },
    explicitStatuses: ['PROPOSED', 'DERIVED', 'VERIFIED', 'INVALID', 'UNRESOLVED', 'UNKNOWN'],
    negativeTests: negatives,
  },
  counts: all.counts,
  acceptance: {
    perPoi,
    acceptanceCounts: {
      pois: all.counts.pois,
      verified: all.counts.verified, verifiedWithExceptions: all.counts.verifiedWithExceptions, failed: all.counts.failed,
      geometricallyAccepted: all.counts.verified + all.counts.verifiedWithExceptions,
      openYardNotEnclosed: all.counts.openYard, partialCluster: all.counts.partialCluster, fullEnclosure: all.counts.fullEnclosure,
      staticSolids: all.counts.staticSolids, staticOpenings: all.counts.staticOpenings,
      splitWalls: perPoi.reduce((s, p) => s + p.splitWalls, 0),
      unchangedWalls: perPoi.reduce((s, p) => s + p.unchangedWalls, 0),
      invalidPortals: all.counts.invalidPortals, unresolvedVerticalLinks: all.counts.unresolvedVerticalLinks,
      exceptions: all.counts.exceptions,
      testsPass: all.counts.testsPass, testsApplicable: all.counts.testsApplicable, testsNotApplicable: all.counts.testsNotApplicable,
      fitFailPois: all.counts.fitFailPois,
    },
    failureCounts: {
      failedPois: all.counts.failed,
      failedTests: all.pois.reduce((s, p) => s + p.failedTests.length, 0),
      coverageDefects: all.pois.reduce((s, p) => s + p.wallClipAudit.filter(a => a.status !== 'EXACT_COVERAGE').length, 0),
      graphOnlyRooms: all.pois.reduce((s, p) => s + p.circulation.graphOnlyRooms.length, 0),
      diagonalOnlyRooms: all.pois.reduce((s, p) => s + p.circulation.diagonalOnlyReachableRooms.length, 0),
      status: 'REAL_COUNTS__NO_FABRICATED_ACCEPTANCE',
    },
    statusHistogram,
    exceptionIndex: all.pois.flatMap(p => p.exceptions.map(e => ({ ...e, poiId: p.poiId }))),
  },
  pois: all.pois,
  noClaims: [
    'NO dynamic door state, lock, key, power, device or destruction',
    'NO runtime collision data or player-scale clearance in the real Web runtime',
    'NO approved au->tile scale; U=1.6/2 diagnostic only',
    'NO canonical Veyra rewrite or LR01 overwrite',
    'NO playable Veyra, final world or creator visual approval',
    'NO fabricated vertical geometry for the 18 UNRESOLVED deep links',
    'NO graph-BFS substituted for physical clearance',
  ],
};

const digest = writeRevisionPackage(path.join(OUT, 'portal_geometry.v1.json'), body);
console.log(`M1_PORTAL_GEOMETRY_OK pois=${all.counts.pois} verified=${all.counts.verified}+${all.counts.verifiedWithExceptions} failed=${all.counts.failed} solids=${all.counts.staticSolids} openings=${all.counts.staticOpenings} exceptions=${all.counts.exceptions}`);
console.log(`  testsPass=${all.counts.testsPass}/${all.counts.testsApplicable} negative=${negatives.pass}/${negatives.total} revisionDigest=${digest}`);
