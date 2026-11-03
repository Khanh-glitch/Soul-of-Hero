#!/usr/bin/env node
// MAP-SCALE-01A — determinism, source-linkage and no-fabrication gates.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'output');
const sha = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const checks = [];
const add = (id, ok, measured = null) => { checks.push({ id, status: ok ? 'PASS' : 'FAIL', measured }); if (!ok) console.error(`FAIL ${id}`, measured ?? ''); };

console.log('== 1/3 determinism (two fresh runs into temp dirs) ==');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scale01a-'));
const a = path.join(tmp, 'a'), b = path.join(tmp, 'b');
for (const d of [a, b]) execFileSync(process.execPath, [path.join(ROOT, 'src/benchmark.mjs')], { env: { ...process.env, SCALE01A_OUT: d }, stdio: 'ignore' });
const files = ['gameplay_sources.v1.json', 'metrics.v1.json', 'comparison.v1.json', 'benchmark.v1.json'];
for (const f of files) {
  add(`DETERMINISM-${f}`, sha(path.join(a, f)) === sha(path.join(b, f)), { a: sha(path.join(a, f)), b: sha(path.join(b, f)) });
  add(`COMMITTED-OUTPUT-${f}`, sha(path.join(OUT, f)) === sha(path.join(a, f)));
}
fs.rmSync(tmp, { recursive: true, force: true });

const S = json(path.join(OUT, 'gameplay_sources.v1.json'));
const D = json(path.join(OUT, 'benchmark.v1.json'));
const M = json(path.join(OUT, 'metrics.v1.json'));
const CC = json(path.join(OUT, 'comparison.v1.json'));

console.log('== 2/3 source linkage + no invention ==');
add('SRC-01-PR44-HEAD', S.gameplay.headCommit === 'd80ad1b5d46f17b729e90898cfa2ad31b677fae3' && S.gameplay.pinnedOlderCommit === 'a956c9e85624c1ca7a2b5585eb423f8fa1cf296c');
add('SRC-02-HEAD-NOT-PINNED', Object.values(S.gameplay.headDiffersFromPinned).some(Boolean), S.gameplay.headDiffersFromPinned);
add('SRC-03-ALL-FILES-FINGERPRINTED', Object.values(S.gameplay.files).every(f => f.sha256?.length === 64 && f.bytes > 0), Object.keys(S.gameplay.files).length);
add('SRC-04-VEYRA-GOLD', S.veyraGold.verified === true && S.veyraGold.sha256 === '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256');
add('SRC-05-GEO01-ACCEPTED', D.sourceEvidence.geo01.sha256 === '13ae97272edc47b063bb4a2ffde5dcf9f92f0f34dc3fd35b6ab3bee7f26c29dd' && D.sourceEvidence.geo01Corridor.sha256 === 'e9212633b277ec0cd7ee932a0d9b1266532e805a2816e23e092edce3582db63e');
add('SRC-06-RUNTIME-CONSTANTS', S.constants.runtime.TILE === 16 && S.constants.runtime.WW === 200 && S.constants.runtime.WH === 200 && S.constants.runtime.runtimeCells === 40000);
add('SRC-07-EXACT-VALIDATOR', S.constants.exactValidator.required.width === 200 && S.constants.exactValidator.required.height === 200 && S.constants.exactValidator.required.tileSize === 16 && S.constants.exactValidator.rules.length > 0);
add('SRC-08-ECONOMY-LIMIT', S.constants.economyLimit.maxCells === 1000000 && S.constants.economyLimit.arrayCount === 13 && S.constants.economyLimit.biomeEnum.length === 14);
add('SRC-09-BUILDINGS', S.constants.buildings.length >= 10 && S.constants.minBuilding.w * S.constants.minBuilding.h > 0);
add('SRC-10-BIBLE-IDS', ['MAP-SPAWN-04', 'MAP-HOME-03', 'MAP-LOG-03', 'MAP-U4', 'MAP-U5'].every(id => S.bible.ids[id]?.requirement));
add('SRC-11-KERNELS', ['K2', 'K3', 'K6', 'K7', 'K8'].every(k => S.bible.kernels[k]?.section));
add('SRC-12-COST-QUOTE', /World-position costs to measure/.test(S.bible.costQuote || ''));

console.log('== 3/3 benchmark integrity ==');
add('BEN-01-FOUR-CANDIDATES', JSON.stringify(D.candidates.map(c => c.u)) === '[1,2,4,8]');
add('BEN-02-CELLS', JSON.stringify(D.candidates.map(c => c.cells)) === '[2800000,700000,175000,43750]');
add('BEN-03-DIMS', D.candidates.every(c => c.worldTiles[0] * c.u === 2000 && c.worldTiles[1] * c.u === 1400));
add('BEN-04-NO-APPROVED-SCALE', D.candidates.every(c => c.status.startsWith('DIAGNOSTIC')) && D.recommendation.status.includes('NO_APPROVED'));
add('BEN-05-GEOMETRY-UNCHANGED', D.frame.authoringSpaceAu[0] === 2000 && D.frame.authoringSpaceAu[1] === 1400 && D.candidates.every(c => c.veyraPreservation === undefined) && CC.rows.every(r => r.veyraPreservation.noCropNoWarpNoRescale));
add('BEN-06-NO-TRAIL-CART-CLAIM', D.journeys.every(j => j.cartPassable === false && j.cartRoadRouteVerified === false) && D.authoredCorridors.length > 0 && D.authoredCorridors[0].segmentKinds.some(k => k.kind === 'trail') && CC.authoredCorridorTimesByScale[2].every(c => c.cartPassable === false));
add('BEN-07-TRAIL-FLAGGED', D.journeys.filter(j => (j.composition?.trailOnlyCells || 0) > 0).every(j => j.physicalClearance.includes('AUTHORED_TRAIL_SEGMENTS__NOT_CART_PASSABLE')));
add('BEN-08-CLEARANCE-UNVERIFIED', D.journeys.filter(j => j.routeStatus?.startsWith('GEOGRAPHIC')).every(j => j.physicalClearance.length > 0));
add('BEN-09-NO-TIME-FOR-UNRESOLVED', Object.values(M.byScale).every(arr => arr.every(t => {
  const j = D.journeys.find(x => x.id === t.journeyId);
  return j.routeStatus?.startsWith('GEOGRAPHIC') ? t.geographicRouteSeconds !== null : (t.geographicRouteSeconds === null && t.loadedCartCases.loadedMax.seconds === null);
})));
add('BEN-10-EXPOSURE-NOT-FABRICATED', Object.values(M.byScale).every(arr => arr.every(t => t.exposureTimeSeconds === null && /NOT_MEASURABLE/.test(t.exposureTimeStatus))));
add('BEN-11-FORMULA-FROM-BALANCE', M.formula.speedAuPerSec.includes('72') && M.terrainClassification.terrainSpeedValues.road === 1.28 && M.loads.find(l => l.id === 'loadedMax').cw === 240);
add('BEN-12-ASSUMPTION-FLAGGED', M.terrainClassification.status.includes('NOT_APPROVED') && D.assumptions.some(a => /NOT approved/i.test(a)));
add('BEN-13-ENGINE-LIMITS', D.candidates.every(c => c.engineLimits.exactPackageValidator.fits === false && c.engineLimits.coreFixedGrid.fits === false));
add('BEN-14-U1-OVER-LIMIT', D.candidates[0].engineLimits.economyValidator.fits === false && D.candidates[0].engineLimits.renderChunkCache.keyCollisionFree === false);
add('BEN-15-U8-NATIVE-RASTER-BUT-SPATIALLY-REJECTED', D.candidates[3].cells === 43750 && D.candidates[3].feasibility.hardRejections.length > 0);
add('BEN-16-U2-ONLY-GATING-PASS', JSON.stringify(D.recommendation.shortlist) === '[2]' && D.candidates[1].feasibility.hardRejections.length === 0);
add('BEN-17-REJECT-UNION', [...D.recommendation.shortlist, ...D.recommendation.rejected.map(r => r.u)].sort().join(',') === '1,2,4,8');
add('BEN-18-SHORTLIST-NOT-INTEGER-CONVENIENCE', D.recommendation.notChosenBecause.includes('convenient integer dimensions'));
add('BEN-19-MEMORY-MONOTONE', D.candidates.every((c, i) => i === 0 || c.memory.totalMBLowerBound < D.candidates[i - 1].memory.totalMBLowerBound));
add('BEN-20-COMPARISON-ROWS', CC.rows.length === 4 && CC.rows.every(r => r.veyraPreservation.fullAuthoringGeometryUnchanged === true));
add('BEN-21-ACCEPTANCE-COVERAGE', ['K2', 'K3', 'K6', 'K7', 'K8', 'MAP-SPAWN-04', 'MAP-HOME-03', 'MAP-LOG-03', 'MAP-U4', 'MAP-U5'].every(id => !!D.acceptance[id]));
add('BEN-22-MISSING-RULES', ['GAMEPLAY_BIOME_MAPPING', 'SWEPT_CLEARANCE', 'CART_PASSABILITY_RULES', 'EXPOSURE_SIMULATION', 'FERRY_RULE', 'RUNTIME_WORLD_SIZE', 'ECONOMY_ROUTE_APPROVAL', 'HUMAN_640x360'].every(id => D.missingRules.some(m => m.id === id)));
add('BEN-23-NOCLAIMS', D.noClaims.length >= 8 && D.noClaims.some(s => /NO fabricated travel time/.test(s)));
add('BEN-24-FERRY-UNRESOLVED', D.measured.footConnectivity.journeysWithoutGeographicRoute.length > 0 && /ferry/i.test(D.measured.footConnectivity.note));
add('BEN-25-QUANTIZED-ENTRANCE', D.candidates[3].spatial.quantizedOpenTiles.entranceOpenTiles === 0 && D.candidates[1].spatial.quantizedOpenTiles.entranceOpenTiles >= 1);
add('BEN-26-ROAD-BENDS-MEASURED', D.measured.roadBends.measured > 500 && D.candidates[3].spatial.roadBendsRadiusUnderOneTile > 0);
add('BEN-27-CART-NETWORK-FRAGMENTED', D.measured.cartNetwork.componentCount > 1);
add('BEN-28-ALL-SPAWNS', Object.keys(D.measured.spawnCoverage).length === 4 && Object.values(D.measured.spawnCoverage).every(v => v.journeys === 8));

const failed = checks.filter(c => c.status === 'FAIL');
console.log(`SCALE01A_TESTS ${checks.length - failed.length}/${checks.length}`);
if (failed.length) process.exit(1);
console.log('SCALE01A_TESTS_OK');
