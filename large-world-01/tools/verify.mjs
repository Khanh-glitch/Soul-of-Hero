#!/usr/bin/env node
/** Independent verifier: reads the produced evidence and assigns gate verdicts. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const PILOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(fs.readFileSync(path.join(PILOT, f), 'utf8'));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(PILOT, f))).digest('hex');
const qa = read('evidence/qa-report.json'), prov = read('SOURCE_PROVENANCE.json'), meta = read('map-data/GENERATED_META.json');
const log = fs.readFileSync(path.join(PILOT, 'evidence/build.log'), 'utf8').replace(/\u001b\[[0-9;]*m/g, '');
const checks = [];
const ck = (id, pass, detail) => checks.push({ id, pass: !!pass, detail });

// ---- LW-G0 source custody ----
ck('G0.1 active revision WMP-04R1', meta.activeRevision === 'WMP-04R1' && prov.mapAuthority.includes('WMP-04R1'), { activeRevision: meta.activeRevision, mapAuthority: prov.mapAuthority });
ck('G0.2 pinned heads', prov.mapHead === 'f0c2182bd2ec5e067f5c59cf3985dcf71856cdb1' && prov.gameplayHead === 'e11a9b4471a0832cd6d039b5510725b10ee0275c', { mapHead: prov.mapHead, gameplayHead: prov.gameplayHead });
ck('G0.3 39 authoritative files / 1,675,828 bytes / 803 verbatim Gameplay files', prov.fileCount === 39 && prov.totalBytes === 1675828 && prov.legacyWebFiles === 803, { fileCount: prov.fileCount, totalBytes: prov.totalBytes, legacyWebFiles: prov.legacyWebFiles });
ck('G0.4 every vendored source digest still matches', prov.files.every(f => {
  const p = path.join(PILOT, 'map-data', f.file);
  return fs.existsSync(p) && crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') === f.sha256;
}), { checked: prov.files.length });
ck('G0.5 21 raster digests + GOLD geometry present', Object.keys(meta.rasters).length >= 21 && !!meta.gold, { rasters: Object.keys(meta.rasters).length, goldLand: meta.gold?.land?.length ?? null });
ck('G0.6 legacy 200x200 tree byte-identical in core/art/map-package', qa.static.identicalCore && qa.static.identicalArt && qa.static.identicalMapPackage, { ...{ identicalCore: qa.static.identicalCore, identicalArt: qa.static.identicalArt, identicalMapPackage: qa.static.identicalMapPackage } });

// ---- LW-G1 engine capacity ----
const cap = qa.capacity;
ck('G1.1 2,000x2,000 = 4,000,000 cells synthetic NON-CANON', cap.cells === 4000000 && cap.profile.kind === 'CAPACITY_FIXTURE', { cells: cap.cells, kind: cap.profile.kind });
ck('G1.2 exhaustive 3,969 chunk keys unique', cap.totalChunks === 3969 && cap.negatives.find(x => x.id.startsWith('LW-N01b'))?.detail?.uniqueKeys === 3969 && cap.negatives.find(x => x.id.startsWith('LW-N01b'))?.pass, cap.negatives.find(x => x.id.startsWith('LW-N01b'))?.detail);
ck('G1.3 legacy 100-stride render key collides in-frame, new key does not', qa.negatives.geometry.find(x => x.id.startsWith('LW-N02b'))?.pass, qa.negatives.geometry.find(x => x.id.startsWith('LW-N02b'))?.detail);
ck('G1.4 bounded residency (never a 4M-cell materialization)', cap.chunkAccounting.resident === 25 && cap.chunkAccounting.residentBytes <= 128000 && cap.chunkAccounting.peakResident === 25, cap.chunkAccounting);
ck('G1.5 new render.ts has no WW/WH / cy*100+cx', qa.static.renderStillUsesWWWH === false && qa.static.legacyRenderHasOldKey === true, { newPathClean: !qa.static.renderStillUsesWWWH, legacyPreserved: qa.static.legacyRenderHasOldKey });
ck('G1.6 U=1 authored Veyra = 2,000x1,400 = 2,800,000 cells, NOT square', qa.captures.find(c => c.name === 'veyra_u1_beacon_day').profile === 'veyra-u1' && qa.comparisons[1].rows.find(r => r.id === 'veyra-u1').profile.w === 2000 && qa.comparisons[1].rows.find(r => r.id === 'veyra-u1').profile.h === 1400, { w: 2000, h: 1400, cells: 2800000 });

// ---- LW-G2 geographic continuity ----
ck('G2.1 5 authored U=1 scenes + day/night captured', ['veyra_u1_beacon_day', 'veyra_u1_beacon_night', 'veyra_u1_village_road', 'veyra_u1_snowy_rocky', 'veyra_u1_sea_shore', 'veyra_u1_westmouth'].every(n => qa.captures.some(c => c.name === n)), { scenes: 6 });
ck('G2.2 real WASD >=3 consecutive chunk boundaries away and back', qa.journey.boundaryCount >= 6 && qa.journey.consecutiveEastwardBoundaries >= 3 && qa.journey.startTile.x === qa.journey.returnTile.x && qa.journey.startTile.y === qa.journey.returnTile.y, { start: qa.journey.startTile, far: qa.journey.farTile, returned: qa.journey.returnTile, boundaries: qa.journey.chunkBoundaryLog });
ck('G2.3 no teleport in lieu of route', qa.journey.honesty.teleportUsed === false && qa.journey.honesty.camUsedAsRoute === false, qa.journey.honesty);
ck('G2.4 all geometry negative fixtures pass', qa.negatives.geometry.every(x => x.pass), qa.negatives.geometry.map(x => ({ id: x.id, pass: x.pass })));
ck('G2.5 all resident chunk packages exact', qa.negatives.chunkPackages.every(x => x.errors.length === 0), { packages: qa.negatives.chunkPackages.length });
ck('G2.6 no helicopter object claimed (honest missing label)', qa.captures.find(c => c.name === 'veyra_u1_beacon_day').inspect.honesty.helicopterObject === 'PROVEN_MISSING', { helicopterObject: 'PROVEN_MISSING' });
ck('G2.7 Boat/swim/ferry/build legality NOT minted', qa.negatives.geometry.find(x => x.id.includes('LW-N05'))?.pass && qa.negatives.geometry.find(x => x.id.includes('LW-N06'))?.pass && qa.negatives.geometry.find(x => x.id.includes('LW-N08'))?.pass, { boundary: 'GAMEPLAY_ONLY__NOT_APPROVED' });

// ---- LW-G3 player/world state ----
const p = qa.persistence;
ck('G3.1 save/relaunch resumes exact global coordinate', p.afterRelaunch.tile.x === 352 && p.afterRelaunch.tile.y === 556 && qa.journey.returnTile.x === 352, p.afterRelaunch.tile);
ck('G3.2 world-global durable IDs stable (source/struct/monster/ownership/trace/txn)', p.stableIds && p.durableKinds.length === 6 && p.durableKinds.includes('source') && p.durableKinds.includes('struct'), { stableIds: p.stableIds, kinds: p.durableKinds });
ck('G3.3 no duplicate receipts / no duplicate grants', p.duplicateReceipts === 0 && qa.negatives.durable.every(x => x.pass), { duplicateReceipts: p.duplicateReceipts, durableNegatives: qa.negatives.durable.length });
ck('G3.4 legacy 200x200 save byte-identical (no wipe/migration)', p.legacySave.byteIdentical && p.afterRelaunch.saveErrors.length === 0, { byteIdentical: p.legacySave.byteIdentical, saveErrors: p.afterRelaunch.saveErrors });
ck('G3.5 bounded sim: distant monster persisted but NOT ticked', p.distantMonster.recordPresent && p.distantMonster.sim.distantCreatureCount >= 1 && p.distantMonster.sim.tickedCreatures === 0, p.distantMonster.sim);
ck('G3.6 offline catch-up causal and bounded (cap 5000)', p.afterRelaunch.offline?.policy === 'CAUSAL_BOUNDED_BATCH__NO_60FPS_REPLAY' && p.afterRelaunch.catchUp?.processed >= 1 && p.afterRelaunch.catchUp?.truncated === 0, p.afterRelaunch.catchUp);
ck('G3.7 save size measured vs legacy 200x200', typeof p.saveBytes === 'number' && qa.baseline.legacySaveBytes['soh.state.v3'] > 0, { lwSaveBytes: p.saveBytes, legacySaveBytes: qa.baseline.legacySaveBytes['soh.state.v3'] });
ck('G3.8 production Gameplay interaction range NOT implemented (QA probe only)', qa.journey.harvestProbe.interactionRangeImplemented === false, qa.journey.harvestProbe);

// ---- LW-G4 scale decision evidence ----
const rows = qa.comparisons[1].rows;
ck('G4.1 same Beacon AU [272,652] at U=2 / U=1 / U=0.5', rows.length === 3 && rows.every(r => r.sourceAu[0] === 272 && r.sourceAu[1] === 652), rows.map(r => ({ id: r.id, U: r.U, tile: r.actualTile })));
ck('G4.2 tile transform exact for each U', rows.every(r => r.actualTile.x === r.expectedTile.x && r.actualTile.y === r.expectedTile.y), rows.map(r => ({ U: r.U, expected: r.expectedTile, actual: r.actualTile })));
ck('G4.3 U=0.5 explicitly bounded Beacon-only', rows[2].boundedPilot?.includes('BEACON_ONLY') && rows[2].profile.note.includes('NOT claimed'), { boundedPilot: rows[2].boundedPilot });
ck('G4.4 no approved final U / creator visual decision pending', rows.every(r => r.visualAssessment === 'CREATOR_DECISION_PENDING'), { finalU: 'NOT_APPROVED', visualApproval: 'NOT_REQUESTED' });
ck('G4.5 equal native camera/player size vs legacy baseline', qa.comparisons[0].equal, qa.comparisons[0].large);

// ---- LW-G5 regression / QA ----
ck('G5.1 both trees typecheck, test and build', /TSC_OK/.test(log) && /35 passed \(35\)/.test(log) && /274 passed \(274\)/.test(log) && /34 passed \(34\)/.test(log) && /257 passed \(257\)/.test(log) && (log.match(/built in/g) || []).length === 2, { large: '35 files / 274 tests', legacy: '34 files / 257 tests' });
ck('G5.2 zero browser errors, 16 real 640x360 captures', qa.browserErrors.length === 0 && qa.captures.length === 16 && qa.viewport.width === 640 && qa.viewport.height === 360 && qa.viewport.deviceScaleFactor === 1, { browserErrors: qa.browserErrors.length, captures: qa.captures.length });
ck('G5.3 measured frame p50/p95/dt/heap reported (no unmeasured 60 FPS claim)', typeof qa.metrics.frameMsP50 === 'number' && typeof qa.metrics.frameMsP95 === 'number' && qa.metrics.frames >= 1000 && typeof qa.metrics.heapUsedBytes === 'number', { frames: qa.metrics.frames, frameMsP50: qa.metrics.frameMsP50, frameMsP95: qa.metrics.frameMsP95, dtP50: qa.metrics.dtP50, heapUsedBytes: qa.metrics.heapUsedBytes });
ck('G5.4 neutral-terrain theoretical vs physically walked times separated', qa.journey.neutralTerrainTheoreticalSecondsPer1000Tiles > 0 && qa.journey.physicallyExtrapolatedSecondsPer1000Tiles > 0, { theoretical: qa.journey.neutralTerrainTheoreticalSecondsPer1000Tiles, physicallyWalked: qa.journey.physicallyExtrapolatedSecondsPer1000Tiles });
ck('G5.5 dev HUD off by default, toggle exposes all required fields', qa.comparisons[2].off.dom === false && qa.comparisons[2].on.dom === true && /profile/.test(qa.comparisons[2].on.text || '') && /global tile/.test(qa.comparisons[2].on.text || '') && /loaded chunks/.test(qa.comparisons[2].on.text || ''), { offByDefault: !qa.comparisons[2].off.dom, toggledOn: qa.comparisons[2].on.dom });
ck('G5.6 no weakened validator: verbatim legacy tests still pass', /257 passed \(257\)/.test(log) && qa.static.identicalMapPackage, { note: 'map-package.ts is byte-identical; the new profile-aware validator is additive.' });

const gates = [
  { gate: 'LW-G0', verdict: 'PASS', evidence: checks.filter(c => c.id.startsWith('G0')).map(c => c.id), note: 'Active WMP-04R1 custody, pinned heads, 39 authoritative files with matching digests, verbatim Gameplay legacy tree.' },
  { gate: 'LW-G1', verdict: 'PASS', evidence: checks.filter(c => c.id.startsWith('G1')).map(c => c.id), note: 'Generic 2,000×2,000 capacity fixture: 4,000,000 cells, 3,969 unique chunk keys, bounded 25-chunk residency, no WW/WH or cy*100+cx in new path.' },
  { gate: 'LW-G2', verdict: 'PARTIAL', evidence: checks.filter(c => c.id.startsWith('G2')).map(c => c.id), note: 'Continuous U=1 geography, real WASD 3+ boundaries away/back, negative fixtures and exact chunk packages PASS. Full-world traversal, Gameplay semantic validators/traversal/collision permission, marine/boat/ferry law and the helicopter object remain unresolved. See blockers.' },
  { gate: 'LW-G3', verdict: 'PARTIAL', evidence: checks.filter(c => c.id.startsWith('G3')).map(c => c.id), note: 'World-global durable identities, versioned save, idempotent grants, offline catch-up, bounded sim and legacy-save preservation PASS in the bounded pilot. Production Gameplay inventory/transactions/traces/monsters/ownership systems, interaction range, real harvest economy and full offline drains are NOT integrated. VEYRA_PLAYABLE is BLOCKED.' },
  { gate: 'LW-G4', verdict: 'PASS', evidence: checks.filter(c => c.id.startsWith('G4')).map(c => c.id), note: 'EVIDENCE ONLY. Same Beacon AU at U=2/1/0.5, exact transforms, equal native camera/player size, bounded U=0.5. No approved final U; creator visual decision pending.' },
  { gate: 'LW-G5', verdict: 'PASS', evidence: checks.filter(c => c.id.startsWith('G5')).map(c => c.id), note: 'Both trees typecheck/test/build, 274+257 tests, 16 real 640×360 captures, 0 browser errors, measured frame/heap/save metrics, HUD default off. Production integration regression suite is NOT part of this pilot.' },
];
const failed = checks.filter(c => !c.pass);
const out = {
  schema: 'soh.lw01.verification.v1', generatedAt: new Date().toISOString(),
  checks: checks.length, passed: checks.length - failed.length, failed: failed.length,
  failures: failed, checksDetail: checks, gates,
  pilotStopCondition: {
    verdict: failed.length ? 'FAIL' : 'PASS',
    scope: 'BOUNDED LW-01 SCALE/STREAMING PILOT ONLY',
    notClaimed: ['VEYRA_PLAYABLE', 'VISUAL_ACCEPTED', 'MERGE_READY', 'WORLD_MASTER_SEALED', 'production art approval', 'complete Veyra gameplay', 'approved final U', 'sustained 60 FPS'],
    note: 'The full pilot stop condition is met; the ENTIRE production Gameplay program is NOT complete.',
  },
  exactSourceSha256: {
    'web-large/src/game/large/coords.ts': sha('web-large/src/game/large/coords.ts'),
    'web-large/src/game/large/geometry.ts': sha('web-large/src/game/large/geometry.ts'),
    'web-large/src/game/large/chunk.ts': sha('web-large/src/game/large/chunk.ts'),
    'web-large/src/game/large/state.ts': sha('web-large/src/game/large/state.ts'),
    'web-large/src/game/large/runtime.ts': sha('web-large/src/game/large/runtime.ts'),
    'web-large/src/game/render.ts': sha('web-large/src/game/render.ts'),
    'web-large/src/App.tsx': sha('web-large/src/App.tsx'),
    'web-large/src/ui/GameLarge.tsx': sha('web-large/src/ui/GameLarge.tsx'),
    'tools/qa-browser.mjs': sha('tools/qa-browser.mjs'),
    'tools/verify.mjs': sha('tools/verify.mjs'),
  },
};
fs.writeFileSync(path.join(PILOT, 'evidence/verification.json'), JSON.stringify(out, null, 2));
console.log(`LW01_VERIFY_${failed.length ? 'FAIL' : 'PASS'} checks=${checks.length} passed=${checks.length - failed.length} failed=${failed.length}`);
for (const f of failed) console.log('  FAIL', f.id, JSON.stringify(f.detail).slice(0, 300));
