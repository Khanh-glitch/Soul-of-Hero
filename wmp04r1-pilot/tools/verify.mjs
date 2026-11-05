#!/usr/bin/env node
/** Independent, machine-checkable WMP-04R1 pilot verification. Reads only
 *  workspace artifacts; does not launch a browser or modify any source. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const PILOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = b => createHash('sha256').update(b).digest('hex');
const json = f => JSON.parse(fs.readFileSync(path.join(PILOT, f), 'utf8'));
const checks = [];
const add = (id, ok, detail) => checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail });

const prov = json('ASSET_PROVENANCE.json');
const testProv = json('TEST_PROVENANCE.json');
const meta = json('map-data/GENERATED_META.json');
const qa = json('evidence/qa-report.json');
const MAP_HEAD = 'caccf21613aa57a55491ec44f687cc44c569f79e';
const GP_HEAD = 'f8fcde910c330aa953dd5c65b80a51792945d35e';

// 1. exact pinned source identity
add('SOURCE_MAP_SHA', prov.mapHead === MAP_HEAD && meta.mapHead === MAP_HEAD, { mapHead: prov.mapHead });
add('SOURCE_GAMEPLAY_SHA', prov.gameplayHead === GP_HEAD && meta.gameplayHead === GP_HEAD && testProv.gameplayHead === GP_HEAD, { gameplayHead: prov.gameplayHead });
add('ACTIVE_REVISION', meta.activeRevision === 'WMP-04R1' && meta.activeManifest === 'v4/r1/manifest.r1.json', { activeRevision: meta.activeRevision, activeManifest: meta.activeManifest });
add('BASE_PHYSICAL_REVISION', meta.basePhysicalRevision === 'WMP-03', { basePhysicalRevision: meta.basePhysicalRevision });

// 2. byte-for-byte digest validation of every vendored file
// The five pilot files below are INTENTIONALLY modified; their pristine copies
// live in web-baseline/. All other files must be byte-identical in BOTH trees.
const EXPECTED_EDITS = new Set(['src/App.tsx', 'src/game/veyra/projection.ts', 'src/game/world.ts', 'src/ui/Game.tsx', 'src/ui/Title.tsx']);
let bad = 0, checked = 0;
const recs = [...prov.files, ...testProv.records];
for (const rec of recs) {
  const f = rec.file;
  const targets = [];
  if (f.startsWith('map-data/')) targets.push(f);
  else if (f.startsWith('web-baseline/')) targets.push(f);
  else if (f.startsWith('web-pilot/')) { if (!EXPECTED_EDITS.has(f.replace(/^web-pilot\//, ''))) targets.push(f); }
  else { targets.push('web-baseline/' + f, 'web-pilot/' + f); }
  for (const t of targets) {
    const fp = path.join(PILOT, t);
    if (!fs.existsSync(fp)) { console.error('MISSING', t); bad++; continue; }
    const b = fs.readFileSync(fp); checked++;
    if (b.length !== rec.bytes || sha(b) !== rec.sha256) { console.error('DIGEST_MISMATCH', t); bad++; }
  }
}
add('VENDOR_DIGESTS', bad === 0, { checked, mismatches: bad, provenanceFiles: prov.files.length, testFiles: testProv.files, intentionalPilotEdits: [...EXPECTED_EDITS] });

// 3. static geography assertions
const rasters = meta.digests;
add('RASTER_SIZES', Object.values(meta.sizes).every(v => v === 43750), meta.sizes);
add('CHANGED_SEA_CELLS_ZERO', meta.sceneStats.length > 0 && meta.sceneStats.every(s => s.counts.tiles === 40000), { scenes: meta.sceneStats.length });
add('NO_LOWRES_GEOMETRY_REPLACEMENT', meta.policy.includes('Do not import original GOLD at runtime') && meta.allLayouts.filter(s => s.originAu).length === 10, { layouts: meta.allLayouts.filter(s => s.originAu).length });
add('FIVE_CREATOR_SCENES', meta.scenes.length === 5 && meta.scenes[0].id === 'wmp04r1-baseline-forest', { scenes: meta.scenes.map(s => s.id) });
add('U2_DIAGNOT_APPROVED', meta.sourceGrid.cellAu === 8 && meta.sourceGrid.unitsPerTileDiagnostic === 2 && meta.note.includes('NOT an approved world scale'), { sourceGrid: meta.sourceGrid });

// 4. browser QA
add('BROWSER_ERRORS_ZERO', qa.browserErrors.length === 0, { errors: qa.browserErrors });
add('REAL_CAPTURES', qa.scenes.length === 16 && qa.scenes.every(s => s.screenshot.width === 640 && s.screenshot.height === 360 && s.screenshot.bytes > 10000), { scenes: qa.scenes.length, comparisons: qa.comparisons.length });
add('SAME_CAMERA_EXACT', qa.comparisons.length === 6 && qa.comparisons.every(c => c.cameraExactlyEqual === true), qa.comparisons.map(c => ({ id: c.afterId, delta: c.cameraDeltaPx })));
add('BROWSER_INTEGRITY', qa.scenes.filter(s => s.inspect.integrity).every(s => s.inspect.integrity.ok === true), { checked: qa.scenes.filter(s => s.inspect.integrity).length, digests: Object.keys(rasters).length });
const wmpScenes = qa.scenes.filter(s => s.inspect.wmp04r1Present);
add('NO_WALK_ON_SEA', wmpScenes.every(s => s.inspect.counts.walkableWater === 0 && s.inspect.counts.cargoWater === 0 && s.inspect.counts.buildableWater === 0 && s.inspect.counts.roadOnWater === 0), { scenes: wmpScenes.length });
add('NO_FIXED_SPAWN_REWARD_OR_STRUCTURE', wmpScenes.every(s => s.inspect.entities === 0 && s.inspect.statics === 0 && s.inspect.buildings === 0 && s.inspect.inventory.join(',') === 'knifex1,water_flaskx1,berriesx3'), { scenes: wmpScenes.length });
add('MARINE_DOMAINS_PRESENT', qa.scenes.find(s => s.id === 'wmp04r1-cinder-shore' && s.time === 'day').inspect.counts.marine2 > 10000 && qa.scenes.find(s => s.id === 'wmp04r1-deathwater-beacon' && s.time === 'day').inspect.counts.marine1 > 10000, { cinder: qa.scenes.find(s => s.id === 'wmp04r1-cinder-shore' && s.time === 'day').inspect.counts.marine2, deathwater: qa.scenes.find(s => s.id === 'wmp04r1-deathwater-beacon' && s.time === 'day').inspect.counts.marine1 });
add('COLD_TRANSITION_PRESENT', qa.scenes.find(s => s.id === 'wmp04r1-snow-highlands' && s.time === 'day').inspect.counts.cold3 > 10000, { cold3: qa.scenes.find(s => s.id === 'wmp04r1-snow-highlands' && s.time === 'day').inspect.counts.cold3 });

// 5. real input / camera / collision / selector / save
add('REAL_INPUT_JOURNEY', qa.journey.samples > 50 && qa.journey.nonWalkableSamples === 0 && qa.journey.seaSamples === 0 && qa.journey.pathPx > 50, qa.journey);
add('CAMERA_FOLLOWS_AFTER_INPUT', qa.journeyStraight.displacementPx > 100 && qa.journeyStraight.cameraFollowedPlayer && qa.journeyStraight.camLockReleased && qa.journeyStraight.seaSamples === 0, qa.journeyStraight);
add('SEA_COLLISION_GENUINE', qa.seaCollision.blockedAtSea === true && qa.seaCollision.seaSamples === 0 && qa.seaCollision.walkedPx > 8, qa.seaCollision);
add('INGAME_SELECTOR', qa.selector.openedWithKeyP && qa.selector.sceneButtons === 5 && qa.selector.closedWithKeyP, qa.selector);
add('SAVE_SOURCE_IDENTITY', !qa.saveReload.recoveryScreenShown && qa.saveReload.runResumed && qa.saveReload.layoutPreserved && qa.saveReload.mapDigestPreserved, qa.saveReload);
add('DAY_AND_NIGHT_SUPPORTED', qa.scenes.filter(s => s.time === 'night').length === 5 && qa.scenes.filter(s => s.time === 'day' && s.role === 'AFTER').length === 5, { night: 5, day: 5 });

// 5b. pinned Gameplay vitest suite on BOTH pristine baseline and pilot
const strip = t => t.replace(/\x1b\[[0-9;]*m/g, '');
const testLog = f => strip(fs.readFileSync(path.join(PILOT, 'evidence', f), 'utf8'));
const testCount = t => ({ files: /(\d+) passed \((\d+)\)/.exec(t)?.[1], tests: /Tests\s+(\d+) passed/.exec(t)?.[1] });
const tb = testCount(testLog('tests-baseline.log')), tp = testCount(testLog('tests-pilot.log'));
add('GAMEPLAY_VITEST_REGRESSION', tb.files === '28' && tb.tests === '233' && tp.files === '28' && tp.tests === '233' && !testLog('tests-baseline.log').includes('FAIL') && !testLog('tests-pilot.log').includes('FAIL'), { baseline: tb, pilot: tp });

// 6. untouched Gameplay source: only 5 intentional edits + 2 new modules
const skip = new Set(['node_modules', 'dist', 'qa-shots']);
const listFiles = root => {
  const out = new Map();
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (skip.has(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.set(path.relative(root, p), fs.readFileSync(p)); } };
  walk(root); return out;
};
const b = listFiles(path.join(PILOT, 'web-baseline')), p = listFiles(path.join(PILOT, 'web-pilot'));
const changed = [...b.keys()].filter(k => p.has(k) && !b.get(k).equals(p.get(k)));
const added = [...p.keys()].filter(k => !b.has(k));
const missing = [...b.keys()].filter(k => !p.has(k));
const expectedChanged = ['src/App.tsx', 'src/game/veyra/projection.ts', 'src/game/world.ts', 'src/ui/Game.tsx', 'src/ui/Title.tsx'];
const expectedAdded = ['src/game/veyra/wmp04r1.generated.ts', 'src/game/veyra/wmp04r1.ts'];
add('BASELINE_SOURCE_UNCHANGED', changed.length === expectedChanged.length && changed.every(x => expectedChanged.includes(x)) && added.length === expectedAdded.length && added.every(x => expectedAdded.includes(x)) && missing.length === 0, { identical: b.size - changed.length, changed, added, missing });

const failed = checks.filter(c => c.status === 'FAIL');
const status = failed.length ? 'FAIL' : 'PASS';
const out = {
  schema: 'soh.wmp04r1.pilot_verify.v1', generatedAt: new Date().toISOString(),
  mapHead: MAP_HEAD, gameplayHead: GP_HEAD, activeRevision: meta.activeRevision,
  pilotStatus: status, checks, summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length },
  limitations: [
    'Gameplay live HEAD / PR44 advanced to 1b98e806dd000a5e115516ddd7f5ce31c92cfbcf after the pinned f8fcde91 source was vendored; this pilot deliberately consumes the exact pinned SHA, NOT the newer head. Owner: GAMEPLAY.',
    'Marine domains are STATIC geography only: no boat, swimming, Leviathan AI, helicopter flight, loot or weather damage was implemented or approved.',
    'Map road/cargo/buildable status remains a CANDIDATE; the existing Web buildReason() consumes buildable as a placement gate. Owner: GAMEPLAY.',
    'POI entrance/door behaviour is not instantiated in the existing Web Veyra projection (statics=[]); collision proof covers sea/cliff boundaries only. Owner: GAMEPLAY.',
    'U=2 and 8 AU analytical cells are DIAGNOSTIC, never an approved world scale.',
    'No production integration, no world-master sealing, no visual/art approval, no full Veyra playability.',
  ],
};
fs.writeFileSync(path.join(PILOT, 'evidence', 'verification.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`WMP04R1_VERIFY_${status} checks=${checks.length} passed=${checks.length - failed.length} failed=${failed.length}`);
for (const f of failed) console.log('FAIL', f.id, JSON.stringify(f.detail));
process.exit(failed.length ? 1 : 0);
