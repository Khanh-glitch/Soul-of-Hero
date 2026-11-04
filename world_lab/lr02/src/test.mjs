// MAP-LR02 reproducible test gates. Distinguishes canonical source integrity,
// static geometry validity, physical clearance, spatial connectivity,
// eligibility, diagnostic transforms and Gameplay-owned runtime acceptance.
import fs from 'node:fs';
import path from 'node:path';
import { OUT, LR01, CONST, digestBody, loadLr01, loadSources, readJson, r4 } from './lib/lr02.mjs';
import { compilePoi, compileAll } from './lib/portal_geometry.mjs';
import { compileEligibility, CELL, GW } from './lib/spawn_eligibility.mjs';
import { negativeTests } from './lib/negative_tests.mjs';

const results = [];
const ok = (id, cond, detail = '') => results.push({ id, verdict: cond ? 'PASS' : 'FAIL', detail });
const lr = loadLr01();
const src = loadSources();
const sources = { I: src.I, P: src.P, V: src.V, GEO: src.GEO };
const patchPath = path.join(OUT, 'greywater_spatial_patch.v1.json');
const patch = fs.existsSync(patchPath) ? readJson(patchPath) : null;
const gwLayout = lr.layouts.layouts.find(l => l.poiId === 'po_greywater');
const gw = compilePoi(gwLayout);
const all = compileAll(lr.layouts);
const elig = compileEligibility(sources, lr);
const neg = negativeTests(lr.layouts);

// --- canonical source integrity ---
ok('LR02-01_PARENT_DIGEST_RECOMPUTED', lr.digest === CONST.lr01Digest && lr.pkg.revisionDigest === CONST.lr01Digest, lr.digest);
ok('LR02-02_CANON_579_IDS_AND_FRAME_RETAINED',
  lr.pkg.body.counts.totalCanonicalObjects === 579 && lr.pkg.body.counts.land === 8 &&
  lr.pkg.body.counts.poiStableIds === 1701 && lr.pkg.body.frame.authoring.w === 2000 &&
  lr.pkg.body.frame.authoring.h === 1400 && lr.pkg.body.frame.transform.fullFrameRetained === true,
  JSON.stringify({ objects: lr.pkg.body.counts.totalCanonicalObjects, lands: lr.pkg.body.counts.land, frame: [lr.pkg.body.frame.authoring.w, lr.pkg.body.frame.authoring.h] }));
ok('LR02-03_CANON_SHA_VERIFIED', src.V.fingerprint.verified === true && src.V.fingerprint.sha256 === '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256', src.V.fingerprint.sha256);

// --- M0 package integrity ---
const recomputed = patch ? digestBody((() => { const { revisionDigest, digestMethod, ...rest } = patch; return rest; })()) : null;
ok('LR02-04_M0_PATCH_DIGEST_RECOMPUTED', !!patch && recomputed === patch.revisionDigest, `${recomputed} vs ${patch?.revisionDigest}`);
ok('LR02-05_PARENT_DIGEST_PINNED_IN_PATCH', !!patch && patch.parent.revisionDigest === CONST.lr01Digest && patch.parent.file === CONST.lr01Package);
ok('LR02-06_FULL_FRAME_AND_TRANSFORM_METADATA', !!patch && patch.coordinateAndTransform.authoringFrame.w === 2000 && patch.coordinateAndTransform.authoringFrame.h === 1400 && patch.coordinateAndTransform.transformStatus === 'UNDECIDED' && patch.coordinateAndTransform.diagnosticTransforms.length === 2);

// --- static geometry validity ---
ok('LR02-07_PARENT_IDS_PRESERVED', gw.staticSolids.every(s => !!s.parentWallId) && gw.portalRecords.length === gwLayout.portals.length && gw.parentIds.walls.length === gwLayout.walls.length);
ok('LR02-08_EXACT_OLD_TO_NEW_SPAN_IDS', gw.idMapping.length === gwLayout.walls.length && gw.idMapping.filter(m => m.kind === 'SPLIT_BY_OPENINGS').every(m => m.newIds.length > 1) && new Set(gw.staticSolids.map(s => s.id)).size === gw.staticSolids.length);
ok('LR02-09_OPENINGS_GROUNDED_ON_REAL_WALL_BOUNDARIES', gw.staticOpenings.every(o => {
  const w = gwLayout.walls.find(x => x.id === o.wallId); if (!w) return false;
  const L = Math.hypot(w.bAu[0] - w.aAu[0], w.bAu[1] - w.aAu[1]);
  return o.intervalAu[0] >= 0 && o.intervalAu[1] <= L + 0.02 && o.intervalAu[1] > o.intervalAu[0] && o.openingAu > gw.wallThicknessAu;
}), `${gw.staticOpenings.length} openings`);
ok('LR02-10_EXACT_WALL_COVERAGE_NO_INVISIBLE_WALL_OR_GAP', gw.wallClipAudit.length === gwLayout.walls.length && gw.wallClipAudit.every(a => a.status === 'EXACT_COVERAGE' && a.overlap === false));
ok('LR02-11_STATIC_HOLES_SEPARATE_FROM_DYNAMIC_DOORS', gw.staticOpenings.every(o => o.staticHole === true && o.dynamicDoorOwner === 'GAMEPLAY' && o.doorState === 'UNKNOWN' && o.lockedState === 'UNKNOWN' && o.powerRequirement === 'UNKNOWN'));

// --- physical clearance / connectivity ---
ok('LR02-12_GREYWATER_POSITIVE_AND_NEGATIVE_TESTS', gw.verdict === 'VERIFIED' && gw.failedTests.length === 0 && Object.values(gw.tests).filter(v => v === true).length >= 12,
  JSON.stringify(gw.tests));
ok('LR02-13_GRAPH_BFS_NOT_SUBSTITUTED_FOR_PHYSICS', gw.circulation.physicallyReachableRoomCount === gw.circulation.groundRoomCount && gw.circulation.graphOnlyRooms.length === 0 && gw.circulation.diagonalOnlyReachableRooms.length === 0);
ok('LR02-14_INJECTED_NEGATIVE_TESTS', neg.allPass, `${neg.pass}/${neg.total}`);
ok('LR02-15_DIAGNOSTIC_U_FIT', gw.fitAtDiagnosticU.length === 2 && gw.fitAtDiagnosticU.every(f => f.verdict === 'FIT' && f.status === 'DIAGNOSTIC_ONLY__NOT_APPROVED_SCALE'));
ok('LR02-16_U_TRANSFORMS_EXACT_SAME_ORIGIN', !!patch && patch.coordinateAndTransform.diagnosticTransforms.every(t => {
  const U = t.U;
  return t.sameOriginProjectionOnly && t.canonicalFrameRetained && t.staticSolids.every(s => {
    const orig = gw.staticSolids.find(x => x.id === s.id);
    return orig && Math.abs(s.aTiles[0] - orig.aAu[0] / U) < 0.0001 && Math.abs(s.aTiles[1] - orig.aAu[1] / U) < 0.0001;
  });
}));

// --- generalization ---
ok('LR02-17_ALL_81_POIS_COMPILED_WITH_PER_POI_EXCEPTIONS', all.counts.pois === 81 && all.counts.failed === 0 && all.counts.exceptions === all.counts.unresolvedVerticalLinks && all.pois.every(p => ['VERIFIED', 'VERIFIED_WITH_EXCEPTIONS'].includes(p.verdict)));
ok('LR02-18_OPEN_YARDS_NOT_ENCLOSED', all.pois.filter(p => p.policy.id === 'OPEN_YARD').every(p => p.staticSolids.length === 0 && p.openBoundary.every(b => b.blocksMovement === false)), `${all.counts.openYard} open yards`);
ok('LR02-19_STATUS_VOCABULARY_DISTINCT', new Set(all.pois.flatMap(p => p.portalRecords.map(r => r.status))).has('UNRESOLVED') && all.pois.some(p => p.status === 'PROPOSED') && all.pois.some(p => p.openBoundary.some(b => b.status === 'DERIVED')));

// --- spawn / build eligibility ---
ok('LR02-20_GREYWATER_ELIGIBLE_AREA_NOT_A_POINT', !!patch && patch.spawnEligibility.greywaterEligibleArea.cellCount >= 20 && patch.spawnEligibility.greywaterEligibleArea.areaAu2 >= 1000 && patch.spawnEligibility.greywaterEligibleArea.derivedFromCandidateRegionIds.length >= 1,
  `${patch?.spawnEligibility.greywaterEligibleArea.cellCount} cells`);
ok('LR02-21_MULTIPLE_DISTINCT_VEYRA_CANDIDATE_REGIONS', elig.candidateRegions.length >= 8 && elig.coverage.distinctLandmasses >= 2 && elig.coverage.rejectedLandCells > 0);
ok('LR02-22_SPAWN_CONTRACT_UNKNOWNS_PRESERVED', elig.gameplayContract.unknowns.length >= 8 && elig.gameplayContract.unknowns.every(u => u.status === 'UNKNOWN' || u.status === 'GAMEPLAY_OWNED' || u.status === 'UNDECIDED') && elig.gameplayContract.decision === 'SEEDED_RANDOM_LEGAL_POSITION_SAMPLING');
ok('LR02-23_NO_PREDETERMINED_RUNTIME_SPAWN', !!patch && patch.boundedRegion.sourceLandmarkRole === 'PROVENANCE_ONLY__NOT_A_RUNTIME_SPAWN_COORDINATE' && !JSON.stringify(patch).includes('"runtimeSpawnPoint"') && !JSON.stringify(patch).includes('"spawnCompound"'));
ok('LR02-24_BUILD_SITE_ENVELOPE_PHYSICALLY_VALIDATED', !!patch && patch.buildSiteEnvelope && patch.buildSiteEnvelope.roadFrontage.distanceAu !== null && patch.buildSiteEnvelope.derivedCellCount >= 8 && patch.buildSiteEnvelope.sweptClearanceStatus === 'UNKNOWN', patch?.buildSiteEnvelope?.geometricEnvelopeStatus);
ok('LR02-25_SP_LANDMARKS_PROVENANCE_ONLY', elig.spLandmarkPolicy.status === 'SOURCE_AUTHORED_PROVENANCE_LANDMARK_ONLY' && elig.spLandmarkPolicy.ids.includes('sp_lake'));

// --- ownership / no fabrication ---
const s = patch ? JSON.stringify(patch) : '';
ok('LR02-26_NO_GAMEPLAY_OWNED_FABRICATION', !['"lootTable"', '"vendor"', '"cash"', '"quest"', '"weather"', '"dynamicDoorState": "OPEN"', '"starterCrate"'].some(k => s.includes(k)));
ok('LR02-27_NO_PLAYABLE_OR_FINAL_CLAIM', patch?.status === 'CONSUMER_READY_STATIC_GEOMETRY__NOT_PLAYABLE_ACCEPTANCE' && patch?.noClaims.some(x => x.includes('NO playable Veyra')));

// --- observed GAME-LR02 compatibility (read-only checkpoint) ---
ok('LR02-28_CONSUMER_PROJECTION_MATCHES_OBSERVED_GAMEPLAY_ORIGIN', !!patch && patch.gameplayCompatibility.consumerProjections.length === 2 && patch.gameplayCompatibility.consumerProjections.every(t => {
  const U = t.U;
  return t.originAu[0] === 640 && t.originAu[1] === 440 && t.runtimeGridTiles[0] === 200 && t.insideObservedGameplayWindow === true && t.staticSolids.every(s => {
    const o = gw.staticSolids.find(x => x.id === s.id);
    return o && Math.abs(s.aTiles[0] - (o.aAu[0] - 640) / U) < 0.0001 && Math.abs(s.aTiles[1] - (o.aAu[1] - 440) / U) < 0.0001;
  });
}), patch?.gameplayCompatibility?.consumerProjections?.map(t => `${t.U}:${t.insideObservedGameplayWindow}`).join(','));
ok('LR02-29_TRUE_INCOMPATIBILITIES_IDENTIFIED_WITH_OWNERS', !!patch && patch.gameplayCompatibility.trueIncompatibilities.length >= 6 && patch.gameplayCompatibility.trueIncompatibilities.every(x => x.detail && x.owner && x.status) && patch.gameplayCompatibility.observedIntake.pinnedBodySha === CONST.lr01Digest && patch.gameplayCompatibility.observedAt.readOnly === true);
ok('LR02-30_STATUS_CROSSWALK_NO_PLAYABLE_CLAIM', !!patch && patch.gameplayCompatibility.statusCrosswalk.VERIFIED.includes('ONLY') && patch.gameplayCompatibility.statusCrosswalk.note.includes('never means playable'));

const pass = results.filter(r => r.verdict === 'PASS').length;
for (const r of results) if (r.verdict === 'FAIL') console.log(`FAIL ${r.id} ${r.detail}`);
console.log(`LR02_TESTS ${pass}/${results.length}`);
if (pass !== results.length) process.exit(1);
