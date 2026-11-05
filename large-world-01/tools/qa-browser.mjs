#!/usr/bin/env node
/**
 * LW-01 real-browser QA. Produces 640x360 DPR-1 captures + evidence/qa-report.json.
 * Requires: two Vite servers (5180 large, 5181 legacy) and a Chromium binary.
 *   LW_CHROMIUM=/path/to/chromium node tools/qa-browser.mjs
 * Real WASD is used for the >=3-boundary journey; no teleport substitution.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '../web-large/node_modules/playwright/index.mjs';

const PILOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(PILOT, 'evidence', 'shots');
const REPORT = path.join(PILOT, 'evidence', 'qa-report.json');
fs.mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.LW_BASE || 'http://127.0.0.1:5180';
const LEGACY = process.env.LW_LEGACY || 'http://127.0.0.1:5181';
const CHROMIUM = process.env.LW_CHROMIUM || '/tmp/chromium';
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(PILOT, f))).digest('hex');

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROMIUM) ? CHROMIUM : chromium.executablePath(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--js-flags=--expose-gc', '--enable-precise-memory-info'],
  env: { ...process.env, LD_LIBRARY_PATH: process.env.LW_LIBS || '/tmp/al2023/lib' },
});
const report = {
  schema: 'soh.lw01.qa.v1', generatedAt: new Date().toISOString(),
  base: BASE, legacy: LEGACY, chromium: CHROMIUM,
  viewport: { width: 640, height: 360, deviceScaleFactor: 1 },
  browserErrors: [], captures: [], comparisons: [], journey: null, persistence: null,
  negatives: null, metrics: null, capacity: null, baseline: null, static: {},
};
function watch(page, tag) {
  page.on('pageerror', e => report.browserErrors.push(`${tag} PAGEERROR ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') report.browserErrors.push(`${tag} CONSOLE ${m.text().slice(0, 300)}`); });
}
const ctx = () => browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
const url = (o) => {
  const q = new URLSearchParams({ profile: o.profile || 'veyra-u1', scene: o.scene || 'beacon', seed: '20261105', hours: String(o.hours ?? 0), autostart: '1', hud: o.hud ? '1' : '0' });
  if (o.fresh !== false) q.set('fresh', '1');
  if (o.cam) q.set('cam', o.cam.join(','));
  return `${BASE}/?${q}`;
};
async function open(o) {
  const c = await ctx(); const page = await c.newPage(); watch(page, o.tag || o.scene || 'large');
  await page.goto(url(o), { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForFunction(() => window.__lw?.runtime?.metrics?.frames >= 20, { timeout: 90000 });
  await page.waitForTimeout(350);
  return { page, c };
}
async function shot(page, name, extra = {}) {
  const meta = await page.evaluate(() => ({ ...window.__lw.screenshotMeta(), inspect: window.__lw.inspect(), metrics: window.__lw.metrics() }));
  const file = `evidence/shots/${name}.png`;
  await page.screenshot({ path: path.join(PILOT, file) });
  report.captures.push({ name, file, ...meta, ...extra });
  console.log(`LW01_SHOT ${name} profile=${meta.profile} U=${meta.U} tile=${meta.playerTile?.x},${meta.playerTile?.y}`);
  return meta;
}
/** Measure the ACTUAL native engine constants + hero sprite from the live module graph. */
async function measureEngine(page) {
  return await page.evaluate(async () => {
    const core = await import('/src/game/core.ts');
    const art = await import('/src/game/art.ts');
    const A = art.getArt();
    const s = A.hero.male.idle0[0];
    return { TILE: core.TILE, VIEW_W: core.VIEW_W, VIEW_H: core.VIEW_H,
      playerSpeed: core.BAL.player.speed, dayLengthMinutes: core.BAL.dayNight.dayLengthMinutes,
      heroSprite: { w: s.width, h: s.height }, WW: core.WW ?? null, WH: core.WH ?? null };
  });
}

// ---------------- 1. Legacy 200x200 baseline ----------------
{
  const c = await ctx(); const page = await c.newPage(); watch(page, 'legacy');
  await page.goto(LEGACY + '/', { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /New run/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Begin the 14 days/ }).click();
  await page.waitForTimeout(1800);
  const m = await measureEngine(page);
  const legacySave = await page.evaluate(() => {
    const o = {}; for (const k of ['soh.state.v3', 'soh.save.v3', 'soh.save', 'soh.game.v3']) { const v = localStorage.getItem(k); if (v !== null) o[k] = v.length; }
    return o;
  });
  await page.screenshot({ path: path.join(SHOTS, 'baseline_legacy_200x200.png') });
  report.baseline = { file: 'evidence/shots/baseline_legacy_200x200.png', engine: m, legacySaveBytes: legacySave,
    note: 'Verbatim current Gameplay e11a9b44 200x200 app; same 640x360 canvas and TILE=16.' };
  report.captures.push({ name: 'baseline_legacy_200x200', file: 'evidence/shots/baseline_legacy_200x200.png', profile: 'legacy-200x200', U: null, engine: m });
  await c.close();
}

// ---------------- 2. U=1 scene captures (day/night + 5 scenes) ----------------
const scenes = [
  { name: 'veyra_u1_beacon_day', scene: 'beacon', hours: 0.08, label: 'Beacon day (U=1)', dayPhase: 'day' },
  { name: 'veyra_u1_beacon_night', scene: 'beacon', hours: 0.32, label: 'Beacon night (U=1)', dayPhase: 'night' },
  { name: 'veyra_u1_village_road', scene: 'village', hours: 0.08, label: 'Mainland village & cart road' },
  { name: 'veyra_u1_snowy_rocky', scene: 'snow', hours: 0.08, label: 'Snowy / rocky highlands' },
  { name: 'veyra_u1_sea_shore', scene: 'shore', hours: 0.08, label: 'Cinder geothermal sea / shore' },
  { name: 'veyra_u1_westmouth', scene: 'westmouth', hours: 0.08, label: 'Westmouth shore & port' },
];
for (const s of scenes) {
  const { page, c } = await open({ ...s, tag: s.name });
  const meta = await shot(page, s.name, { label: s.label, dayPhase: s.dayPhase || 'day', qaHours: s.hours });
  if (s.name === 'veyra_u1_beacon_day') {
    const e = await measureEngine(page);
    report.comparisons.push({ id: 'C1 native camera/player size', legacy: report.baseline.engine, large: e,
      equal: report.baseline.engine.TILE === e.TILE && report.baseline.engine.VIEW_W === e.VIEW_W && report.baseline.engine.VIEW_H === e.VIEW_H
        && report.baseline.engine.playerSpeed === e.playerSpeed && report.baseline.engine.heroSprite.w === e.heroSprite.w && report.baseline.engine.heroSprite.h === e.heroSprite.h,
      note: 'Both trees are byte-identical in core.ts/art.ts; TILE=16, 640x360, speed 72 px/s, hero 16x24 unchanged. No enlarged pixel art, no speed hack.' });
  }
  await c.close();
}

// ---------------- 3. Beacon source-coordinate triage U=2 / U=1 / U=0.5 ----------------
const beaconU = [];
for (const [id, U, hours] of [['veyra-u2', 2, 0.08], ['veyra-u1', 1, 0.08], ['beacon-u05', 0.5, 0.08]]) {
  const name = `beacon_${id.replace(/[^a-z0-9]/gi, '_')}`;
  const { page, c } = await open({ profile: id, scene: 'beacon', hours, tag: name });
  const meta = await shot(page, name, { label: `Beacon AU [272,652] at U=${U}`, scaleTriage: true });
  const i = meta.inspect;
  beaconU.push({ id, U, profile: i.profile, expectedTile: { x: Math.floor(272 / U), y: Math.floor(652 / U) },
    actualTile: i.player.tile, globalIndex: i.player.globalIndex, sourceAu: [272, 652],
    spawn: i.spawn, file: `evidence/shots/${name}.png`,
    boundedPilot: i.profile.boundedPilot || null,
    visualAssessment: 'CREATOR_DECISION_PENDING' });
  await c.close();
}
report.comparisons.push({ id: 'C2 Beacon same source-coordinates at U=2 / U=1 / U=0.5', rows: beaconU,
  note: 'Same GOLD authoring AU [272,652], same 640x360 camera and 16x24 hero. U=0.5 is a BOUNDED Beacon-only pilot, NOT a full-world claim. No approved final U; global U=1 alone is not proof of satisfactory island composition.' });

// ---------------- 4. 2,000 x 2,000 capacity fixture ----------------
{
  const { page, c } = await open({ profile: 'capacity-2000x2000', scene: 'beacon', hours: 0.08, hud: true, tag: 'capacity' });
  const meta = await shot(page, 'capacity_2000x2000', { label: 'SYNTHETIC NON-CANON engine capacity fixture' });
  const neg = await page.evaluate(() => window.__lw.negatives());
  const i = meta.inspect;
  report.capacity = { profile: i.profile, cells: i.profile.w * i.profile.h,
    totalChunks: neg.geometry.find(x => x.id.startsWith('LW-N01b'))?.detail?.totalChunks,
    chunkAccounting: i.chunks.stats, chunkKeys: i.chunks.keys, metrics: meta.metrics,
    negatives: neg.geometry, syntheticNonCanon: true, file: 'evidence/shots/capacity_2000x2000.png',
    note: 'Generic 2,000×2,000 engine capacity ONLY. Deterministic synthetic terrain, no Veyra canon, no padded authored rows.' };
  await c.close();
}

// ---------------- 5. Dev HUD off-by-default / on ----------------
{
  const { page, c } = await open({ profile: 'veyra-u1', scene: 'beacon', hours: 0.08, tag: 'hud' });
  const off = await page.evaluate(() => ({ dom: !!document.getElementById('lw-dev-hud'), flag: window.__lw.hud() }));
  await page.keyboard.press('F3'); await page.waitForTimeout(300);
  const on = await page.evaluate(() => ({ dom: !!document.getElementById('lw-dev-hud'), flag: window.__lw.hud(), text: document.getElementById('lw-dev-hud')?.innerText }));
  await shot(page, 'dev_hud_on', { label: 'Developer HUD (F3)', offByDefault: off, toggledOn: !!on.dom });
  report.comparisons.push({ id: 'C3 dev HUD default', off, on, note: 'HUD is off by default; F3 exposes profile, source revision, global tile, loaded chunks, frame/perf, heap and save stats.' });
  await c.close();
}

// ---------------- 6. Real WASD journey: >=3 consecutive chunk boundaries, away then return ----------------
{
  const c = await ctx(); const page = await c.newPage(); watch(page, 'journey');
  // Seed a real-looking legacy 200x200 save to prove the pilot never wipes it.
  const LEGACY_FAKE = JSON.stringify({ version: 3, run: { id: 'legacy-200x200-run', character: 'male' }, profile: { securedCash: 7 } });
  await page.goto(url({ profile: 'veyra-u1', scene: 'westmouth', hours: 0.08, hud: true, tag: 'journey' }), { waitUntil: 'networkidle', timeout: 180000 });
  await page.evaluate(v => localStorage.setItem('soh.state.v3', v), LEGACY_FAKE);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__lw?.runtime?.metrics?.frames >= 20, { timeout: 90000 });
  await page.waitForTimeout(400);

  const start = await page.evaluate(() => ({ inspect: window.__lw.inspect(), legacy: window.__lw.legacy() }));
  // Durable identities created at the START chunk (real key input where possible).
  const near = await page.evaluate(() => window.__lw.nearestSource());
  await page.keyboard.press('h'); await page.waitForTimeout(200);
  await page.keyboard.press('j'); await page.waitForTimeout(200);
  const before = await page.evaluate(() => ({
    records: [...window.__lw.runtime.durable.records.values()].map(r => ({ id: r.id, kind: r.kind, tile: r.tile, chunk: r.chunk, receipt: r.receipt })),
    receipts: [...window.__lw.runtime.durable.receipts], inventory: window.__lw.runtime.durable.inv(),
    nearestSource: window.__lw.nearestSource(), inspect: window.__lw.inspect(),
  }));
  await shot(page, 'journey_start', { label: 'Real WASD journey start (Westmouth)', nearestSource: near });

  const hold = async (code, pred, maxMs) => {
    await page.keyboard.down(code);
    const t0 = Date.now(); let last = null;
    while (Date.now() - t0 < maxMs) {
      await page.waitForTimeout(120);
      last = await page.evaluate(() => ({ tile: window.__lw.inspect().player.tile, boundaries: window.__lw.inspect().boundaries.length, m: window.__lw.metrics() }));
      if (pred(last)) break;
    }
    await page.keyboard.up(code);
    await page.waitForTimeout(300);
    return { elapsedMs: Date.now() - t0, last };
  };
  // Walk south from authored anchor y=556 onto the verified foot-legal corridor y=560.
  const legS = await hold('s', s => s.tile.y >= 560, 15000);
  const atCorridor = await page.evaluate(() => window.__lw.inspect().player.tile);
  // Walk EAST across chunk boundaries 384, 416, 448 (+ more if speed allows).
  const legE = await hold('d', s => s.tile.x >= 452, 90000);
  const far = await page.evaluate(() => ({ inspect: window.__lw.inspect(), metrics: window.__lw.metrics() }));
  await shot(page, 'journey_far', { label: 'Far side of >=3 consecutive chunk boundaries (walked)', legE: legE.last, corridorTile: atCorridor });
  // Walk WEST back to the start chunk.
  const legW = await hold('a', s => s.tile.x <= 352, 90000);
  const legN = await hold('w', s => s.tile.y <= 556, 15000);
  const returned = await page.evaluate(() => ({ inspect: window.__lw.inspect(), metrics: window.__lw.metrics(),
    records: [...window.__lw.runtime.durable.records.values()].map(r => ({ id: r.id, kind: r.kind, tile: r.tile, chunk: r.chunk, receipt: r.receipt })),
    receipts: [...window.__lw.runtime.durable.receipts], inventory: window.__lw.runtime.durable.inv(),
    legacy: window.__lw.legacy(), saveErrors: window.__lw.saveErrors() }));
  await shot(page, 'journey_return', { label: 'Returned to start chunk (walked)' });

  // Explicit delayed-world event, saved and processed after relaunch.
  await page.evaluate(ids => {
    const d = window.__lw.runtime.durable;
    d.schedule('qa-delayed-tick', d.simMs + 60000, 'tick', { note: 'offline catch-up proof' });
    if (ids.bareSourceId) window.__lw.scheduleRegrow(ids.bareSourceId, 352, 556, 60000);
    // Distant monster / ownership / trace / transaction: durable identities that
    // must NOT reset on unload, save or restart, and must NOT be ticked while distant.
    d.setMonster('qa-distant-boar', { x: 1000, y: 730 }, { hp: 30, state: 'idle' });
    d.setOwnership('qa-home', { x: 353, y: 556 }, { owner: 'player' });
    d.addTrace('qa-trace', { x: 352, y: 556 }, { t: 1 });
    d.transact('qa-txn', { x: 352, y: 556 }, { item: 'wood', qty: 1 });
  }, { bareSourceId: (before.records.find(r => r.kind === 'source')?.id || '').replace(/^source:/, '') });
  const preSave = await page.evaluate(() => ({
    records: [...window.__lw.runtime.durable.records.values()].map(r => ({ id: r.id, kind: r.kind, tile: r.tile, chunk: r.chunk, receipt: r.receipt })),
    receipts: [...window.__lw.runtime.durable.receipts], inventory: window.__lw.runtime.durable.inv(),
    delayedEvents: window.__lw.runtime.durable.delayedEvents.length }));
  await page.keyboard.press('F9'); await page.waitForTimeout(300);
  const saved = await page.evaluate(() => ({ save: window.__lw.save(), raw: localStorage.getItem('soh.lw01.save.v1'),
    offline: window.__lw.offline(), legacy: window.__lw.legacy(), saveErrors: window.__lw.saveErrors() }));

  // Relaunch with the SAME browser profile, no `fresh`: must resume at global coord.
  await page.goto(`${BASE}/?profile=veyra-u1&scene=westmouth&seed=20261105&hours=0&autostart=1&hud=1`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForFunction(() => window.__lw?.runtime?.metrics?.frames >= 20, { timeout: 90000 });
  await page.waitForTimeout(400);
  const relaunch = await page.evaluate(() => ({ inspect: window.__lw.inspect(),
    records: [...window.__lw.runtime.durable.records.values()].map(r => ({ id: r.id, kind: r.kind, tile: r.tile, chunk: r.chunk, receipt: r.receipt })),
    receipts: [...window.__lw.runtime.durable.receipts], inventory: window.__lw.runtime.durable.inv(),
    legacy: window.__lw.legacy(), offline: window.__lw.offline(), saveErrors: window.__lw.saveErrors(),
    catchUp: window.__lw.catchUp(120000), raw: localStorage.getItem('soh.lw01.save.v1'),
    sim: window.__lw.inspect().sim, delayedEvents: window.__lw.inspect().durable.delayedEvents }));
  await shot(page, 'relaunch_at_global_coord', { label: 'Save / relaunch at global coordinate' });
  const legacyRawAfter = await page.evaluate(() => localStorage.getItem('soh.state.v3'));

  const boundaries = returned.inspect.boundaries || [];
  const cxOf = k => Number(String(k).split('|')[1].split(':')[0]);
  const eastward = boundaries.filter(b => cxOf(b.to) > cxOf(b.from));
  report.journey = {
    note: 'REAL keyboard WASD, no teleport in lieu of route. Start is the authored Westmouth anchor (legality snap only).',
    startTile: start.inspect.player.tile, spawn: start.inspect.spawn, corridorTile: atCorridor,
    legs: { south: legS, east: legE, west: legW, north: legN },
    farTile: far.inspect.player.tile, returnTile: returned.inspect.player.tile,
    chunkBoundaryLog: boundaries, boundaryCount: returned.metrics.chunkBoundariesCrossed,
    consecutiveEastwardBoundaries: eastward.length,
    walkedPx: returned.metrics.walkedPx, walkedMs: returned.metrics.walkedMs,
    physicallyWalkedTilesPerSecond: returned.metrics.physicallyWalkedTilesPerSecond,
    neutralTerrainTheoreticalSecondsPer1000Tiles: returned.metrics.neutralTerrainTheoreticalSecondsPer1000Tiles,
    physicallyExtrapolatedSecondsPer1000Tiles: returned.metrics.physicallyWalkedTilesPerSecond ? 1000 / returned.metrics.physicallyWalkedTilesPerSecond : null,
    canvasChunks: returned.metrics.canvasChunks,
    frameMsP50: returned.metrics.frameMsP50, frameMsP95: returned.metrics.frameMsP95, frameMsMax: returned.metrics.frameMsMax,
    dtP50: returned.metrics.dtP50, dtP95: returned.metrics.dtP95,
    heapUsedBytes: returned.metrics.heapUsedBytes, heapLimitBytes: returned.metrics.heapLimitBytes,
    residentLayerBytes: returned.metrics.residentLayerBytes, canvasBytes: returned.metrics.canvasBytes,
    peakResidentChunks: returned.metrics.peakResident, peakResidentBytes: returned.metrics.peakResidentBytes,
    loads: returned.metrics.loads, unloads: returned.metrics.unloads, evictions: returned.metrics.evictions,
    materializeMsTotal: returned.metrics.materializeMsTotal, materializeMsMax: returned.metrics.materializeMsMax,
    simSetSize: returned.metrics.simSetSize, tickedCreatures: returned.metrics.tickedCreatures, distantCreatures: returned.metrics.distantCreatures,
    chunkKeysAtFar: far.inspect.chunks.keys, chunkKeysAtReturn: returned.inspect.chunks.keys,
    sourceIdsAtStart: before.records.filter(r => r.kind === 'source').map(r => r.id),
    placedIdsAtStart: before.records.filter(r => r.kind === 'struct').map(r => r.id),
    nearestSource: near,
    harvestProbe: { note: 'H/J are QA-only state fixtures, NOT production interaction range. The harvested source is a WORLD-GLOBAL durable identity whose chunk is unloaded and reloaded by the walked journey.',
      distanceTiles: near?.distanceTiles ?? null, interactionRangeImplemented: false },
    honesty: { qaUsed: returned.inspect.time.qaUsed, teleportUsed: false, camUsedAsRoute: false },
  };
  report.persistence = {
    before: { records: before.records, receipts: before.receipts, inventory: before.inventory },
    preSave,
    afterReturn: { records: returned.records, receipts: returned.receipts, inventory: returned.inventory, saveErrors: returned.saveErrors },
    afterRelaunch: { tile: relaunch.inspect.player.tile, globalIndex: relaunch.inspect.player.globalIndex,
      records: relaunch.records, receipts: relaunch.receipts, inventory: relaunch.inventory,
      offline: relaunch.offline, catchUp: relaunch.catchUp, saveErrors: relaunch.saveErrors, delayedEvents: relaunch.delayedEvents },
    saveBytes: saved.raw?.length ?? null, saveSchema: saved.raw ? JSON.parse(saved.raw).schema : null,
    legacySave: { before: start.legacy, after: relaunch.legacy, byteIdentical: legacyRawAfter === LEGACY_FAKE },
    duplicateReceipts: new Set(relaunch.receipts).size !== relaunch.receipts.length ? relaunch.receipts.length - new Set(relaunch.receipts).size : 0,
    stableIds: relaunch.records.length === preSave.records.length && relaunch.records.every(r => preSave.records.some(b => b.id === r.id && b.receipt === r.receipt && b.tile.x === r.tile.x && b.tile.y === r.tile.y)) && JSON.stringify(relaunch.inventory) === JSON.stringify(preSave.inventory),
    durableKinds: [...new Set(relaunch.records.map(r => r.kind))].sort(),
    distantMonster: { recordPresent: relaunch.records.some(r => r.kind === 'monster'), sim: relaunch.sim,
      note: 'Distant monster is persisted but NOT instantiated/ticked every frame; it reattaches only when its chunk enters the active sim set.' },
  };
  report.metrics = returned.metrics;
  // Final negatives from the live U=1 profile.
  report.negatives = await page.evaluate(() => window.__lw.negatives());
  await c.close();
}

// ---------------- 7. static evidence ----------------
report.static = {
  sourceProvenance: JSON.parse(fs.readFileSync(path.join(PILOT, 'SOURCE_PROVENANCE.json'), 'utf8')),
  generatedMetaBytes: fs.statSync(path.join(PILOT, 'map-data', 'GENERATED_META.json')).size,
  identicalCore: sha('web-legacy/src/game/core.ts') === sha('web-large/src/game/core.ts'),
  identicalArt: sha('web-legacy/src/game/art.ts') === sha('web-large/src/game/art.ts'),
  identicalMapPackage: sha('web-legacy/src/game/map-package.ts') === sha('web-large/src/game/map-package.ts'),
  renderStillUsesWWWH: /\bWW\b|\bWH\b|cy \* 100 \+ cx/.test(fs.readFileSync(path.join(PILOT, 'web-large/src/game/render.ts'), 'utf8')),
  legacyRenderHasOldKey: /cy \* 100 \+ cx/.test(fs.readFileSync(path.join(PILOT, 'web-legacy/src/game/render.ts'), 'utf8')),
};
report.summary = {
  captures: report.captures.length, comparisons: report.comparisons.length,
  browserErrors: report.browserErrors.length,
  negativeChecks: (report.negatives?.geometry?.length || 0) + (report.negatives?.durable?.length || 0),
  negativeFailures: [...(report.negatives?.geometry || []), ...(report.negatives?.durable || [])].filter(x => !x.pass).map(x => x.id),
  chunkPackagesWithErrors: (report.negatives?.chunkPackages || []).filter(x => x.errors.length).length,
  journeyBoundaryCount: report.journey?.boundaryCount ?? 0,
};
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log(`LW01_QA_CAPTURES scenes=${report.captures.length} comparisons=${report.comparisons.length} browserErrors=${report.browserErrors.length} boundaries=${report.journey?.boundaryCount || 0} negFail=${report.summary.negativeFailures.length}`);
await browser.close();
