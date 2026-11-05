/**
 * P5 — final verification packet for the additive U=0.5 physical POI program.
 * Runs TypeScript compile + the static suite, cross-checks every evidence
 * artifact, records git/gh refs, and emits evidence/verification.json.
 *
 * Gates without runtime proof remain PARTIAL / FAIL by design. In particular
 * full Gameplay runtime integration and Creator visual acceptance are NOT
 * granted. PASS on P5-G0..G4 is scoped to the ISOLATED six-scene audition.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const U = (p) => path.join(ROOT, p);
const j = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const git = (...a) => { try { return execFileSync('git', a, { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString().trim(); } catch (e) { return 'ERROR:' + (e.stderr?.toString().trim() || e.message); } };

function run(label, cmd, args, cwd) {
  let ok = true, out = '';
  try { out = execFileSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env } }).trim(); }
  catch (e) { ok = false; out = (e.stdout?.toString() || '') + (e.stderr?.toString() || e.message); }
  return { label, command: cmd + ' ' + args.join(' '), ok, output: out.slice(-4000) };
}

const checks = [];
checks.push(run('typescript', 'npx', ['tsc', '--noEmit', '-p', 'tsconfig.u05.json'], U('web-u05')));
checks.push(run('static-suite', 'node', [U('tests/test-u05.mjs')], REPO));
checks.push(run('asset-inventory', 'node', [U('tools/build-asset-inventory-u05.mjs')], REPO));
checks.push(run('drift-record', 'node', [U('tools/record-drift-u05.mjs')], REPO));

const tests = j(U('evidence/test-results.json'));
const qa = j(U('evidence/qa-report.json'));
const assets = j(U('evidence/asset-inventory.json'));
const cust = j(U('evidence/source-custody.json'));
const audit = j(U('map-data/U05_AUDIT.json'));
const conflicts = j(U('map-data/U05_GEOMETRY_CONFLICTS.json'));
const scenes = fs.readdirSync(U('scenes')).filter(f => f.endsWith('.u05.json')).sort().map(f => j(U('scenes/' + f)));
const shots = fs.readdirSync(U('evidence/shots')).filter(f => f.endsWith('.png')).sort();

const p4Pass = Object.values(qa.gates).every(g => g.status === 'PASS');
const compileOk = checks.every(c => c.ok);
const proofAttached = scenes.length === 6 && scenes.every(s => s.physicalProof.runtimeWalkProof === 'PROVEN_BY_P4_QA' && s.physicalProof.artComplete === false);
const zeroDelta = conflicts.amendedPolygons.length === 0 && conflicts.relocatedObjects.length === 0 &&
  conflicts.expandedEnvelopes.length === 0 && conflicts.recolouredRoads.length === 0 && conflicts.widenedRoads.length === 0 &&
  audit.noChanges.polygonAmendments === 0 && audit.noChanges.roadCentrelines === 0;
const docs = ['docs/U05_GEOMETRY_CONFLICTS_DELTA.md', 'docs/ASSET_INVENTORY.md', 'docs/CONTROL_TOWER_U05_HANDOFF.md', 'README.md']
  .map(p => ({ path: p, exists: fs.existsSync(U(p)), bytes: fs.existsSync(U(p)) ? fs.statSync(U(p)).size : 0 }));

const refs = {
  arenaBranch: git('branch', '--show-current'),
  mapHeadBeforeU05: 'b12d05866366de0d50e4d305ff7b72fcf36b4921',
  mapHeadAtVerification: git('rev-parse', 'HEAD'),
  mapHeadNote: 'HEAD at the moment this verification packet was generated (i.e. before the U05 commit itself). The final U05 commit SHA is the tip of this branch in git log.',
  remoteMap: git('ls-remote', 'origin', 'refs/heads/arena/2e3cfbd2-soul-of-hero'),
  main: git('ls-remote', 'origin', 'refs/heads/main'),
  gameplayPin: cust.gameplay.verifiedLatestSha,
  gameplayLiveHead: cust.verificationDrift?.liveHeadSha,
  pr44: cust.verificationDrift?.pr44,
  lw01Code: '38d13514d20b089b6fcbf0fa78d605086c50385c',
  lw01VendoredGameplay: cust.lw01Reuse.derivedFromGameplaySha,
  disclosure: cust.disclosure
};

const verification = {
  schema: 'soh.u05.verification.v1',
  generatedAt: new Date().toISOString(),
  program: 'P1–P5 Creator-chosen U=0.5 additive physical POI program',
  scope: 'ISOLATED six-scene Creator selector / audition. Additive physical POI proof ONLY.',
  status: 'P5_ISOLATED_AUDITION_VERIFIED__FULL_GAMEPLAY_RUNTIME_INTEGRATION_NOT_YET_VALIDATED__VISUAL_ACCEPTANCE_NOT_GRANTED',
  checks,
  refs,
  evidence: {
    contracts: ['contracts/CREATOR_CHOSEN_U05.v1.json', 'contracts/LAYER_INVENTORY.json'],
    sourceCustody: 'evidence/source-custody.json',
    masterplan: 'map-data/U05_POI_MASTERPLAN.v1.json',
    audit: 'map-data/U05_AUDIT.json',
    geometryConflicts: 'map-data/U05_GEOMETRY_CONFLICTS.json',
    benchmark: 'map-data/U05_BENCHMARK.json',
    scenes: scenes.map(s => 'scenes/' + s.id + '.u05.json'),
    qaReport: 'evidence/qa-report.json',
    testResults: 'evidence/test-results.json',
    assetInventory: 'evidence/asset-inventory.json',
    shots: { count: shots.length, bytes: shots.reduce((a, f) => a + fs.statSync(U('evidence/shots/' + f)).size, 0), allExist: qa.shots.every(f => shots.includes(f)) },
    docs
  },
  measured: {
    staticTests: { pass: tests.pass, fail: tests.fail, verdict: tests.verdict },
    compileClean: checks.find(c => c.label === 'typescript')?.ok,
    pois: audit.poiCount, uniquePois: audit.uniqueIds,
    conflictItems: conflicts.items.length,
    zoneOverlap: `${audit.buildableSiteOverlap.count}/${audit.buildableSiteOverlap.of}`,
    overlapPairs: audit.poiOverlapPairs.count,
    missingEntrances: audit.missingExteriorEntrance.count,
    roadPoiPairs: audit.roadCentrelineCrossings.measurements.roadPoiEnvelopePairs,
    scenes: scenes.length,
    reusedSprites: assets.reusedStructureSprites.usedCount,
    availableSprites: assets.reusedStructureSprites.availableCount,
    newPngArt: assets.newPngArtFiles.length,
    rasters: assets.rasters.count,
    vendoredFiles: cust.gameplay.vendoredFiles,
    vendoredBytes: cust.gameplay.vendoredBytes,
    verbatimMismatches: cust.gameplay.verbatimMismatches,
    p4Gates: qa.gates,
    p4Errors: qa.consoleErrors.length + qa.pageErrors.length + qa.failedRequests.length,
    realKeyboardEvents: qa.scenes.reduce((a, s) => a + s.approach.realKeyboardEvents + s.reentry.realKeyboardEvents + (s.collision?.realKeyboardEvents || 0) + (s.roof.walkOut?.realKeyboardEvents || 0), 0),
    driftCommitsAfterPin: cust.verificationDrift?.commitsAfterPin?.length,
    u05RelevantBlocksIdentical: cust.verificationDrift?.u05RelevantBlocksIdentical
  },
  gates: {
    'P5-G0': { status: compileOk && tests.fail === 0 && cust.verificationDrift?.u05RelevantBlocksIdentical === true ? 'PASS' : 'FAIL', scope: 'Contracts, layer inventory, WMP-04R1/GOLD + live Gameplay source custody, TypeScript compile, static suite, drift disclosure.' },
    'P5-G1': { status: audit.poiCount === 81 && conflicts.items.length === 62 && zeroDelta ? 'PASS' : 'FAIL', scope: '81-POI masterplan / audit / 62 measured geometry conflicts with ZERO amendments, relocations, expanded envelopes, recoloured or widened roads.' },
    'P5-G2': { status: scenes.length === 6 && proofAttached && docs.every(d => d.exists) ? 'PASS' : 'FAIL', scope: 'Six separated-layer deep scenes with attached runtime-walk proof, delta/asset/handoff docs.' },
    'P5-G3': { status: p4Pass && qa.scenes.length === 6 && qa.shots.length === 48 && qa.consoleErrors.length === 0 && qa.pageErrors.length === 0 ? 'PASS' : 'FAIL', scope: 'ISOLATED audition ONLY: real WASD/arrow approach+reentry, wall collision, roof hidden/visible, genuine before/after, native 640x360 1x, bounded caches.' },
    'P5-G4': { status: assets.noNewAtlas && assets.newPngArtFiles.length === 0 && assets.reusedStructureSprites.allUsedExistInSource && zeroDelta ? 'PASS' : 'FAIL', scope: 'Asset inventory: 12/68 reused live sprites, 0 new PNG/atlas, 21 analysis rasters, GOLD geometry/road delta = 0.' },
    'P5-G5': { status: 'FAIL', scope: 'FULL Gameplay runtime integration (VEYRA_PLAYABLE). NO runtime proof; NOT_YET_VALIDATED.' },
    'P5-G6': { status: 'FAIL', scope: 'Creator visual acceptance. NOT_REQUESTED_AND_NOT_GRANTED. No pixel-diff proof; whitebox only.' },
    'P5-G7': { status: 'PARTIAL', scope: 'All 81 POIs art-complete/interactive, full 4000x2800 streaming, sustained 60 FPS, exhaustive traversal. Only six scenes proven.' },
    'P5-G8': { status: 'PARTIAL', scope: 'Gameplay semantic validators, marine/boat/ferry/swim law, helicopter entity, economy/inventory/ownership/loot/keys/power/HP/boss/reward, §11.5 proof packet. Unresolved.' },
    'P5-G9': { status: zeroDelta ? 'PASS' : 'FAIL', scope: 'Creator-liked Beacon road preserved verbatim: no reauthor/redraw/widen/recolour; terrain painter byte-identical; GOLD polygons unchanged.' }
  },
  inheritedLw01Gates: { 'LW-G0': 'PASS', 'LW-G1': 'PASS', 'LW-G2': 'PARTIAL', 'LW-G3': 'PARTIAL', 'LW-G4': 'PASS', 'LW-G5': 'PASS', VEYRA_PLAYABLE: 'BLOCKED' },
  notClaims: [
    'VEYRA_PLAYABLE', 'MERGE_READY', 'WORLD_MASTER_SEALED', 'VISUAL_ACCEPTED',
    'WORLD_MASTER_U_APPROVED_AS_PRODUCTION', 'ALL_81_POI_ART_COMPLETE',
    'HELICOPTER_OBJECT_IMPLEMENTED', 'MARINE_BOAT_FERRY_LAW_RESOLVED',
    'PIXEL_EQUALITY_WITH_BENCHMARK', 'PRODUCTION_ATLAS_AUTHORIZED'
  ],
  reproductionOrder: [
    'node creator-u05/tools/vendor-u05.mjs',
    'node creator-u05/tools/build-u05.mjs',
    'node creator-u05/tools/build-scenes-u05.mjs',
    'npx tsc --noEmit -p creator-u05/web-u05/tsconfig.u05.json',
    'npx vite --host 0.0.0.0 --port 5182 (cwd creator-u05/web-u05)',
    'LD_LIBRARY_PATH=/tmp/al2023/lib node creator-u05/tests/qa-u05.mjs',
    'node creator-u05/tools/attach-proof-u05.mjs',
    'node creator-u05/tests/test-u05.mjs',
    'node creator-u05/tools/build-asset-inventory-u05.mjs',
    'node creator-u05/tools/record-drift-u05.mjs',
    'node creator-u05/tools/verify-u05.mjs'
  ]
};
verification.verdict = Object.entries(verification.gates).filter(([k, v]) => k.startsWith('P5-G') && ['P5-G0', 'P5-G1', 'P5-G2', 'P5-G3', 'P5-G4', 'P5-G9'].includes(k)).every(([, v]) => v.status === 'PASS')
  ? 'U05_ISOLATED_PROGRAM_VERIFIED__INTEGRATION_AND_VISUAL_GATES_REMAIN_FAIL_OR_PARTIAL'
  : 'U05_VERIFICATION_INCOMPLETE';
fs.writeFileSync(U('evidence/verification.json'), JSON.stringify(verification, null, 2) + '\n');
console.log(`U05_VERIFY_OK checks=${checks.filter(c => c.ok).length}/${checks.length} static=${tests.pass}/${tests.pass + tests.fail} p4GatesPass=${p4Pass} verdict=${verification.verdict}`);
for (const [k, v] of Object.entries(verification.gates)) console.log(`  ${k} ${v.status}`);
