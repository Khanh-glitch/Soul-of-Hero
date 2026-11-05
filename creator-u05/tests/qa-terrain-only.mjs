/**
 * QA for the standalone TERRAIN-ONLY game file.
 * Proves: runs from file:// with no server; NO overlay layers on canvas;
 * real WASD input; x1..x10 speed multiplier actually moves ~10x faster;
 * optional natural-terrain collision; bounded caches; zero errors.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/home/user/pr38/web/node_modules/playwright/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html');
const SHOTS = path.join(ROOT, 'evidence/terrain-only-shots');
const HTTP = process.env.U05_TERRAIN_URL || 'http://localhost:5182/terrain-only.html';
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib' }
});
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const consoleErrors = [], pageErrors = [], failedRequests = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => pageErrors.push(e.message));
page.on('requestfailed', r => failedRequests.push(r.url() + ' :: ' + (r.failure()?.errorText || '')));

const url = 'file://' + FILE;
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__terrain?.ready === true, { timeout: 30000 });
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name) => { await page.waitForTimeout(180); await page.locator('canvas#game').screenshot({ path: path.join(SHOTS, name) }); return name; };

const initial = await ev(() => window.__terrain.state());
const pureShot = await shot('terrain_only_beacon.png');

// HUD hidden => canvas is literally only terrain + hero.
await page.keyboard.press('KeyH');
const hudHiddenShot = await shot('terrain_only_beacon_no_hud.png');
const hudHidden = await ev(() => document.getElementById('ui').classList.contains('hidden'));
await page.keyboard.press('KeyH');

/** Measure real keyboard movement at a given multiplier. */
async function measure(mult) {
  await ev(([m, tx, ty]) => { window.__terrain.setSpeed(m); window.__terrain.reset(tx, ty); }, [mult, 544, 1304]);
  await ev(() => window.__terrain.clearInputLog());
  const before = await ev(() => window.__terrain.state());
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyD');
  const after = await ev(() => window.__terrain.state());
  const log = await ev(() => window.__terrain.inputLog());
  return {
    mult, beforeTile: before.player.tile, afterTile: after.player.tile,
    movedPx: after.stats.movedPx - before.stats.movedPx,
    deltaPx: Math.round(after.player.px - before.player.px),
    speedPxPerSec: after.speedPxPerSec,
    realKeyboardEvents: log.length, inputCodes: [...new Set(log.map(x => x.code))],
    simMs: after.stats.simMs - before.stats.simMs
  };
}
const m1 = await measure(1);
const m10 = await measure(10);
const ratio = m1.movedPx > 0 ? m10.movedPx / m1.movedPx : 0;
const x10Shot = await shot('terrain_only_x10.png');

// Keyboard +/- and slider bounds.
await ev(() => { window.__terrain.setSpeed(1); window.__terrain.clearInputLog(); });
await page.keyboard.press('Equal'); await page.keyboard.press('Equal');
const afterPlus = await ev(() => window.__terrain.state().speedMultiplier);
await page.keyboard.press('Minus');
const afterMinus = await ev(() => window.__terrain.state().speedMultiplier);
const rangeBounds = await ev(() => {
  const r = document.getElementById('speedRange');
  return { min: r.min, max: r.max, step: r.step };
});
await ev(() => window.__terrain.setSpeed(10));
const clamped = await ev(() => {
  const a = window.__terrain.setSpeed(99), b = window.__terrain.setSpeed(-5);
  return { over: a, under: b };
});

// Optional NATURAL terrain collision (no walls / no POI collision).
const waterTile = await ev(() => {
  const a = window.__terrain;
  for (let r = 1; r < 60; r++)
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const tx = 544 + dx, ty = 1304 + dy, s = a.sampleTile(tx, ty);
      if (s && s.water) return [tx, ty];
    }
  return null;
});
let collisionProof = null;
if (waterTile) {
  await ev(([tx, ty]) => { window.__terrain.setCollision(true); window.__terrain.setSpeed(1); window.__terrain.reset(tx, ty); }, waterTile);
  const c0 = await ev(() => window.__terrain.state());
  await page.keyboard.down('KeyW'); await page.waitForTimeout(420); await page.keyboard.up('KeyW');
  const c1 = await ev(() => window.__terrain.state());
  const blockedShot = await shot('terrain_only_natural_collision.png');
  await ev(() => window.__terrain.setCollision(false));
  await page.keyboard.down('KeyW'); await page.waitForTimeout(420); await page.keyboard.up('KeyW');
  const c2 = await ev(() => window.__terrain.state());
  collisionProof = {
    waterTile, modeBlocked: c0.collision, blockedSubsteps: c1.stats.blockedSubsteps - c0.stats.blockedSubsteps,
    tileUnchangedWhenBlocked: JSON.stringify(c1.player.tile) === JSON.stringify(c0.player.tile),
    freeRoamMode: c2.collision, freeRoamMovedPx: c2.stats.movedPx - c1.stats.movedPx,
    shot: blockedShot
  };
}

// Long x10 run to prove bounded caches over many chunk loads.
await ev(() => { window.__terrain.setCollision(false); window.__terrain.setSpeed(10); window.__terrain.reset(544, 1304); });
await page.keyboard.down('KeyD'); await page.waitForTimeout(2500); await page.keyboard.up('KeyD');
const longRun = await ev(() => window.__terrain.state());
const longShot = await shot('terrain_only_x10_long_run.png');

// HTTP entry (live preview) also works, with no overlay layer.
await page.goto(HTTP, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(() => window.__terrain?.ready === true, { timeout: 30000 });
const httpState = await ev(() => window.__terrain.state());
const httpShot = await shot('terrain_only_http.png');

const gates = {
  'T-G0': { status: initial.ready && initial.mode === 'TERRAIN_ONLY__NO_BUILDINGS__NO_OVERLAY_LAYERS' ? 'PASS' : 'FAIL', reason: 'standalone file:// game boots' },
  'T-G1': { status: Object.values(initial.draw.overlays).every(v => v === 0) && initial.draw.physicalLayerLoaded === false && initial.draw.sceneDataLoaded === false && initial.draw.terrainOnly === true ? 'PASS' : 'FAIL', reason: 'zero overlay layers on canvas' },
  'T-G2': { status: m1.movedPx > 40 && m10.movedPx > 400 && ratio > 7 && ratio < 13 && m10.realKeyboardEvents >= 2 ? 'PASS' : 'FAIL', reason: `real x1 -> x10 movement ratio ${ratio.toFixed(2)}` },
  'T-G3': { status: afterPlus === 2 && afterMinus === 1.5 && rangeBounds.max === '10' && clamped.over === 10 && clamped.under === 1 ? 'PASS' : 'FAIL', reason: 'x1..x10 custom speed, keyboard and slider, clamped' },
  'T-G4': { status: collisionProof?.blockedSubsteps > 0 && collisionProof.tileUnchangedWhenBlocked === true && collisionProof.freeRoamMovedPx > 0 ? 'PASS' : 'FAIL', reason: 'optional natural terrain collision + free roam toggle' },
  'T-G5': { status: hudHidden === true && longRun.draw.overlays.hudOnCanvas === 0 ? 'PASS' : 'FAIL', reason: 'HUD hideable, nothing drawn on canvas' },
  'T-G6': { status: longRun.stats.materializedAllCells === false && longRun.stats.residentChunks <= 36 && longRun.stats.displayCanvases <= 36 ? 'PASS' : 'FAIL', reason: 'bounded LRU over a long x10 run' },
  'T-G7': { status: initial.viewport[0] === 640 && initial.viewport[1] === 360 && initial.dpr === 1 && initial.zoom === 1 && initial.U === 0.5 && initial.heroSpritePx[0] === 16 && initial.heroSpritePx[1] === 24 && initial.speedBasePxPerSec === 72 ? 'PASS' : 'FAIL', reason: 'native 640x360 1x camera, unstretched 16x24 hero, base 72 px/s' },
  'T-G8': { status: httpState.ready === true && Object.values(httpState.draw.overlays).every(v => v === 0) ? 'PASS' : 'FAIL', reason: 'HTTP live preview entry also terrain-only' },
  'T-G9': { status: consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0 ? 'PASS' : 'FAIL', reason: 'zero console / page / request errors' }
};
const report = {
  schema: 'soh.u05.terrain-only-qa.v1',
  generatedAt: new Date().toISOString(),
  file: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html',
  fileUrl: url, httpUrl: HTTP,
  method: 'Playwright real keyboard events; standalone file:// AND Vite HTTP entry; 640x360 DPR1.',
  initial,
  speed: { x1: m1, x10: m10, ratio: Number(ratio.toFixed(3)), keyboard: { afterPlus, afterMinus }, rangeBounds, clamped },
  collisionProof,
  hudHidden,
  longRun: { player: longRun.player, camera: longRun.camera, stats: longRun.stats, frameMs: longRun.frameMs },
  http: { mode: httpState.mode, viewport: httpState.viewport, draw: httpState.draw },
  consoleErrors, pageErrors, failedRequests,
  shots: fs.readdirSync(SHOTS).filter(f => f.endsWith('.png')).sort(),
  gates,
  notClaims: ['FULL_GAMEPLAY_RUNTIME_INTEGRATION', 'VISUAL_ACCEPTANCE', 'VEYRA_PLAYABLE', 'MERGE_READY', 'PRODUCTION_GAME', 'NEW_ATLAS']
};
fs.writeFileSync(path.join(ROOT, 'evidence/terrain-only-qa.json'), JSON.stringify(report, null, 2) + '\n');
const fails = Object.entries(gates).filter(([, v]) => v.status !== 'PASS').map(([k]) => k);
console.log(`U05_TERRAIN_ONLY_QA ratio=${ratio.toFixed(2)} shots=${report.shots.length} errors=${consoleErrors.length + pageErrors.length + failedRequests.length} failing=${fails.join(',') || 'none'}`);
await browser.close();
if (fails.length) process.exitCode = 1;
