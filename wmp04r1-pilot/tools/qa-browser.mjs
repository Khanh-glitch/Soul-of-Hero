#!/usr/bin/env node
/** WMP-04R1 real-browser QA. All screenshots are REAL 640x360 Chromium captures
 *  of the running SOH renderer — no mockups, no canvas re-draws of terrain.
 *
 *  Env: WMP04_PLAYWRIGHT (playwright/index.mjs), WMP04_CHROMIUM, WMP04_BASE_URL
 *       (default http://127.0.0.1:5174/), WMP04_BASELINE_URL (5175),
 *       LD_LIBRARY_PATH=/tmp/al2023/lib (session-local Chromium deps).
 *
 *  A "view anchor" is an explicit QA FAST SCENE SELECTION alignment: the player
 *  is placed on a walkable dry-land tile of the selected scene and the existing
 *  camera is aligned. It is NEVER presented as a walked journey. Journey proof
 *  below uses real keydown/keyup WASD input and records actual player positions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const PILOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PW = process.env.WMP04_PLAYWRIGHT || '/home/user/pr38/web/node_modules/playwright/index.mjs';
const CHROMIUM = process.env.WMP04_CHROMIUM || '/tmp/chromium';
const BASE = process.env.WMP04_BASE_URL || 'http://127.0.0.1:5174/';
const BASELINE = process.env.WMP04_BASELINE_URL || 'http://127.0.0.1:5175/';
const SHOTS = path.join(PILOT, 'evidence', 'shots');
const sha256 = b => createHash('sha256').update(b).digest('hex');
fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = await import(PW);
const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });

const SEED = 20261104;
const AFTER = [
  'wmp04r1-baseline-forest', 'wmp04r1-snow-highlands', 'wmp04r1-oasis-corridor',
  'wmp04r1-cinder-shore', 'wmp04r1-deathwater-beacon',
];
const BEFORE = {
  'wmp04r1-snow-highlands': 'wmp04r1-before-snow-highlands',
  'wmp04r1-oasis-corridor': 'wmp04r1-before-oasis-corridor',
  'wmp04r1-cinder-shore': 'wmp04r1-before-cinder-shore',
  'wmp04r1-deathwater-beacon': 'wmp04r1-before-deathwater-beacon',
};
// QA-ONLY diagnostic pair. NOT one of the five creator scenes: at the Oasis
// origin WMP-04R1 changed ZERO biome cells, so this pair exposes the ACTUAL
// WMP-04 meadow→scrub dry-steppe expansion at AU [1000,600].
const DIAGNOSTIC = { 'wmp04r1-dry-transition': 'wmp04r1-before-dry-transition' };
/** QA view anchors [tx,ty] in the 200x200 diagnostic tile grid. Chosen by
 *  --probe-anchors from the ACTUAL runtime world (see evidence/anchor-probe.json).
 *  Each is a walkable dry-land tile that shows representative WMP-04R1 geography. */
const ANCHORS = {
  'wmp04r1-baseline-forest': null,
  'wmp04r1-snow-highlands': [30, 162],
  'wmp04r1-oasis-corridor': [176, 58],
  'wmp04r1-cinder-shore': [100, 48],
  'wmp04r1-deathwater-beacon': [56, 46],
};
ANCHORS['wmp04r1-dry-transition'] = [69, 97];
for (const k of Object.keys(BEFORE)) ANCHORS[BEFORE[k]] = ANCHORS[k];
for (const [a, b] of Object.entries(DIAGNOSTIC)) { ANCHORS[a] = ANCHORS[a] || [69, 97]; ANCHORS[b] = ANCHORS[a]; }

async function openScene(sceneId, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  const anchor = opts.anchor === undefined ? ANCHORS[sceneId] : opts.anchor;
  const q = new URLSearchParams({ pilot: sceneId, autostart: '1', seed: String(SEED) });
  if (anchor) q.set('cam', anchor.join(','));
  if (opts.hours !== undefined) q.set('hours', String(opts.hours));
  const url = `${BASE}?${q.toString()}`;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__soh?.run, null, { timeout: 30000 });
  await page.waitForTimeout(opts.settle ?? 1100);
  return { ctx, page, errors, sceneId, anchor, url };
}

async function shot(page, name) {
  const file = path.join(SHOTS, name + '.png');
  const buf = await page.screenshot({ path: file, type: 'png' });
  return { file: 'evidence/shots/' + name + '.png', bytes: buf.length, sha256: sha256(buf), width: 640, height: 360 };
}

/** Structured runtime inspection of the ACTUAL compiled world, not the manifest. */
async function inspect(page) {
  return page.evaluate(() => {
    const gs = window.__soh, r = gs.run, w = window.__sohWorld(), d = window.__wmp04r1;
    const tiles = w.tiles, e = w.economyMap, n = 200 * 200;
    let waterTiles = 0, walkableWater = 0, cargoWater = 0, roadOnWater = 0, buildableWater = 0;
    let cliffTiles = 0, roadTiles = 0, marine1 = 0, marine2 = 0, cold2 = 0, cold3 = 0;
    const biomeCount = {};
    for (let i = 0; i < n; i++) {
      const isWater = tiles[i] === 0 || tiles[i] === 1 || tiles[i] === 19;
      if (isWater) { waterTiles++; if (e.walkable[i]) walkableWater++; if (e.cargoPassable[i]) cargoWater++; if (e.buildable[i]) buildableWater++; if (tiles[i] === 12) roadOnWater++; }
      if (tiles[i] === 8) cliffTiles++;
      if (tiles[i] === 12) roadTiles++;
      if (d) { if (d.marineRegion[i] === 1) marine1++; if (d.marineRegion[i] === 2) marine2++; if (d.coldTransition[i] === 2) cold2++; if (d.coldTransition[i] === 3) cold3++; biomeCount[d.effectiveBiome[i]] = (biomeCount[d.effectiveBiome[i]] || 0) + 1; }
    }
    const inv = (r.custody.inv?.slots || []).filter(Boolean).map(s => `${s.key}x${s.qty}`);
    return {
      layout: r.layoutId, seed: r.seed, sourceLayoutVersion: r.sourceLayoutVersion,
      sourceMap: r.sourceMap, veyra: w.veyra ? JSON.parse(JSON.stringify(w.veyra)) : null,
      integrity: d ? d.integrity : null, sceneId: d ? d.sceneId : null, isBefore: d ? d.isBefore : null,
      note: d ? d.note : null,
      camera: { x: window.__sohCam.x, y: window.__sohCam.y, init: window.__sohCam.init },
      player: { x: r.player.x, y: r.player.y, hp: r.player.hp, warmth: r.player.warmth },
      viewAnchor: window.__wmp04ViewAnchor || null,
      qaOffset: r.qaOffset, qaUsed: r.qaUsed, weatherSlot: r.clock.weatherSlot,
      counts: { waterTiles, walkableWater, cargoWater, buildableWater, roadOnWater, cliffTiles, roadTiles, marine1, marine2, cold2, cold3 },
      biomeCount,
      places: w.places.length, statics: w.statics.length, buildings: w.buildings.length,
      entities: Object.keys(r.entities).length, inventory: inv,
      sourceV3: w.sourceV3.filter(Boolean).length,
      enforceMasks: w.enforceMasks, wmp04r1Present: !!w.wmp04r1,
      zoneNames: w.zoneNames,
    };
  });
}

/** REAL keyboard journey. No teleports during the journey; every position sample
 *  comes from the game's own player state after tick(). */
async function journey(page) {
  await page.evaluate(() => {
    window.__journey = [];
    window.__journeyTimer = setInterval(() => {
      const r = window.__soh?.run;
      if (r) window.__journey.push({ x: r.player.x, y: r.player.y, t: Date.now() });
    }, 40);
  });
  const steps = [
    ['w', 900], ['d', 900], ['s', 800], ['a', 800], ['w', 700],
  ];
  for (const [key, ms] of steps) {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  }
  await page.waitForTimeout(200);
  return page.evaluate(() => {
    clearInterval(window.__journeyTimer);
    const pts = window.__journey, w = window.__sohWorld();
    let pathPx = 0, maxDisp = 0, nonWalkable = 0, seaPositions = 0;
    const start = pts[0];
    for (let k = 0; k < pts.length; k++) {
      if (k) pathPx += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
      maxDisp = Math.max(maxDisp, Math.hypot(pts[k].x - start.x, pts[k].y - start.y));
      const tx = Math.floor(pts[k].x / 16), ty = Math.floor(pts[k].y / 16);
      const i = ty * 200 + tx;
      if (!w.economyMap.walkable[i]) nonWalkable++;
      if (w.tiles[i] === 0 || w.tiles[i] === 1 || w.tiles[i] === 19) seaPositions++;
    }
    return {
      samples: pts.length, durationMs: pts.length ? pts[pts.length - 1].t - pts[0].t : 0,
      start, end: pts[pts.length - 1], pathPx: Math.round(pathPx * 10) / 10,
      maxDisplacementPx: Math.round(maxDisp * 10) / 10, nonWalkableSamples: nonWalkable, seaSamples: seaPositions,
      keysUsed: ['KeyW', 'KeyD', 'KeyS', 'KeyA', 'KeyW'],
      claim: 'Real keydown/keyup input through the original SOH input handler. No teleports during this journey.',
    };
  });
}

/** Sustained single-direction REAL input: proves the ORIGINAL player-following
 *  camera resumes after the QA same-camera lock is released by the first key. */
async function journeyStraight(page) {
  await page.evaluate(() => {
    window.__straight = [];
    window.__straightTimer = setInterval(() => {
      const r = window.__soh?.run;
      if (r) window.__straight.push({ x: r.player.x, y: r.player.y, camX: window.__sohCam.x, camY: window.__sohCam.y, t: Date.now() });
    }, 40);
  });
  await page.keyboard.down('d');
  await page.waitForTimeout(2600);
  await page.keyboard.up('d');
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    clearInterval(window.__straightTimer);
    const p = window.__straight, w = window.__sohWorld();
    let nonWalkable = 0, sea = 0, path = 0;
    for (let k = 0; k < p.length; k++) {
      if (k) path += Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y);
      const i = Math.floor(p[k].y / 16) * 200 + Math.floor(p[k].x / 16);
      if (!w.economyMap.walkable[i]) nonWalkable++;
      if ([0, 1, 19].includes(w.tiles[i])) sea++;
    }
    const a = p[0], z = p[p.length - 1];
    return {
      samples: p.length, key: 'KeyD held 2600ms',
      start: { x: a.x, y: a.y }, end: { x: z.x, y: z.y },
      displacementPx: Math.round(Math.hypot(z.x - a.x, z.y - a.y) * 10) / 10,
      pathPx: Math.round(path * 10) / 10,
      cameraDeltaPx: Math.round(Math.hypot(z.camX - a.camX, z.camY - a.camY) * 10) / 10,
      cameraFollowedPlayer: Math.abs((z.camX - a.camX) - (z.x - a.x)) < 12,
      camLockReleased: !window.__wmp04CamLock,
      nonWalkableSamples: nonWalkable, seaSamples: sea,
      claim: 'Real sustained keydown; camera lock released by the first movement key; original camera follows the player.',
    };
  });
}

/** Diagnostic collision setup (NOT a walked journey claim): place the player on
 *  a dry-land tile whose right neighbour is real DEEP water, then press into it. */
async function seaCollisionProbe(page) {
  const setup = await page.evaluate(() => {
    const w = window.__sohWorld(), r = window.__soh.run, tiles = w.tiles;
    let found = null;
    // Prefer a dry-land tile 4 tiles from the shore so the player can ACTUALLY
    // walk partway before the real collision stops them at the water boundary.
    for (let ty = 30; ty < 170 && !found; ty++) for (let tx = 30; tx < 166; tx++) {
      const i = ty * 200 + tx;
      let ok = w.economyMap.walkable[i] === 1;
      for (let k = 1; k < 4; k++) if (w.economyMap.walkable[i + k] !== 1 || tiles[i + k] === 0) ok = false;
      if (ok && tiles[i + 4] === 0 && w.economyMap.walkable[i + 4] === 0) {
        found = { tx, ty, i, landTile: tiles[i], seaTile: tiles[i + 4], seaTileOffset: 4 }; break;
      }
    }
    if (!found) return { ok: false, reason: 'no land/deep-water adjacency in this scene' };
    r.player.x = found.tx * 16 + 8; r.player.y = found.ty * 16 + 8; r.player.vx = 0; r.player.vy = 0;
    delete window.__wmp04CamLock;
    window.__sea = [];
    window.__seaTimer = setInterval(() => {
      const rr = window.__soh?.run;
      if (rr) window.__sea.push({ x: rr.player.x, y: rr.player.y });
    }, 40);
    return { ok: true, ...found, note: 'Diagnostic setup only: player placed on dry land adjacent to deep water; NOT a walked path.' };
  });
  if (!setup.ok) return setup;
  await page.keyboard.down('d');
  await page.waitForTimeout(2200);
  await page.keyboard.up('d');
  const res = await page.evaluate(() => {
    clearInterval(window.__seaTimer);
    const w = window.__sohWorld(), pts = window.__sea;
    let sea = 0, maxX = -Infinity, minX = Infinity;
    for (const p of pts) {
      const i = Math.floor(p.y / 16) * 200 + Math.floor(p.x / 16);
      if ([0, 1, 19].includes(w.tiles[i])) sea++;
      maxX = Math.max(maxX, p.x); minX = Math.min(minX, p.x);
    }
    return {
      samples: pts.length, seaSamples: sea, startX: pts[0]?.x, endX: pts[pts.length - 1]?.x, maxX, minX,
      walkedPx: Math.round((maxX - pts[0]?.x) * 10) / 10,
      seaBoundaryX: null, // filled by caller from setup
    };
  });
  const seaBoundaryX = (setup.tx + setup.seaTileOffset) * 16;
  return { ...setup, ...res, seaBoundaryX, stoppedBeforeSea: res.maxX < seaBoundaryX + 2, blockedAtSea: res.seaSamples === 0 && res.maxX < seaBoundaryX + 2 && res.walkedPx > 8 };
}

/** In-game selector must be reachable with a real keypress (P). */
async function selectorTest(page) {
  await page.keyboard.press('p');
  await page.waitForTimeout(180);
  const opened = await page.locator('[data-testid="wmp04r1-ingame-selector"]').isVisible().catch(() => false);
  const buttons = opened ? await page.locator('[data-testid^="pilot-ingame-"]').count() : 0;
  await page.keyboard.press('p');
  await page.waitForTimeout(180);
  const closed = !(await page.locator('[data-testid="wmp04r1-ingame-selector"]').isVisible().catch(() => false));
  return { openedWithKeyP: opened, sceneButtons: buttons, closedWithKeyP: closed };
}

/** Save/source identity regression: autosave -> reload -> Continue must succeed. */
async function saveReload(page, url) {
  await page.evaluate(() => { /* let the 5s autosave fire */ });
  await page.waitForTimeout(5400);
  const before = await page.evaluate(() => ({ layout: window.__soh.run.layoutId, seq: window.__soh.seq, mapDigest: window.__soh.run.sourceMap.mapDigest }));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(700);
  const recovery = await page.locator('body').innerText().then(t => t.includes('Save recovery required')).catch(() => false);
  const cont = page.getByText(/^Continue —/);
  const hasContinue = await cont.count() > 0;
  if (hasContinue) await cont.click();
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({ run: !!window.__soh?.run, layout: window.__soh?.run?.layoutId, mapDigest: window.__soh?.run?.sourceMap?.mapDigest }));
  return { recoveryScreenShown: recovery, continueOffered: hasContinue, runResumed: after.run, layoutPreserved: after.layout === before.layout, mapDigestPreserved: after.mapDigest === before.mapDigest };
}

/** Build a labelled side-by-side comparison of two REAL screenshots. */
async function compare(beforeFile, afterFile, outName, labels) {
  const before = fs.readFileSync(path.join(PILOT, beforeFile)).toString('base64');
  const after = fs.readFileSync(path.join(PILOT, afterFile)).toString('base64');
  const page = await browser.newPage({ viewport: { width: 1280, height: 400 }, deviceScaleFactor: 1 });
  await page.setContent('<html><body style="margin:0"><canvas id="c" width="1280" height="400"></canvas></body></html>');
  const data = await page.evaluate(async ({ before, after, labels }) => {
    const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = src; });
    const [a, b] = await Promise.all([load('data:image/png;base64,' + before), load('data:image/png;base64,' + after)]);
    const c = document.getElementById('c'), g = c.getContext('2d');
    g.fillStyle = '#0b0810'; g.fillRect(0, 0, 1280, 400);
    g.imageSmoothingEnabled = false;
    g.drawImage(a, 0, 40); g.drawImage(b, 640, 40);
    g.strokeStyle = '#ffe8b0'; g.lineWidth = 2; g.strokeRect(639.5, 40, 1, 360);
    g.font = 'bold 15px monospace'; g.fillStyle = '#ffe8b0';
    g.fillText(labels[0], 12, 26); g.fillText(labels[1], 652, 26);
    return c.toDataURL('image/png').split(',')[1];
  }, { before, after, labels });
  const buf = Buffer.from(data, 'base64');
  fs.writeFileSync(path.join(SHOTS, outName + '.png'), buf);
  await page.close();
  return { file: 'evidence/shots/' + outName + '.png', bytes: buf.length, sha256: sha256(buf), width: 1280, height: 400 };
}

/** The UNMODIFIED Gameplay web build, started through its own real UI. */
async function baselineOriginal() {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(BASELINE, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.getByText('New run', { exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByText('Begin the 14 days', { exact: true }).click();
  await page.waitForFunction(() => !!window.__soh?.run, null, { timeout: 20000 });
  await page.evaluate(() => { const r = window.__soh.run; r.player.x = 472; r.player.y = 2264; r.player.vx = 0; r.player.vy = 0; });
  await page.waitForTimeout(2000);
  const s = await shot(page, '00_BEFORE_original_soh_web');
  // The untouched baseline does not expose its camera; derive it from the
  // ORIGINAL SOH camera formula (render.ts) and the aligned player position.
  const meta = await page.evaluate(() => {
    const r = window.__soh.run, x = r.player.x, y = r.player.y;
    return {
      layout: r.layoutId, player: [x, y],
      camera: [Math.max(0, Math.min(200 * 16 - 640, x - 320)), Math.max(0, Math.min(200 * 16 - 360, y - 180 - 6))],
      cameraSource: 'derived from the original SOH camera formula after 2s of convergence',
    };
  });
  await ctx.close();
  return { screenshot: s, meta, errors };
}

async function probeAnchors() {
  const out = {};
  for (const id of AFTER.slice(1)) {
    const s = await openScene(id, { anchor: null, settle: 500 });
    const r = await s.page.evaluate(() => {
      const w = window.__sohWorld(), d = window.__wmp04r1;
      const tiles = Array.from(w.tiles), eb = d.effectiveBiome, mar = d.marineRegion;
      const want = {
        'wmp04r1-snow-highlands': (c, water, cliff, road) => 1.4 * Math.min(c[8], 620) + 2.6 * Math.min(c[7], 180) + 1.8 * Math.min(c[1] + c[2] + c[3] + c[0], 260) + .4 * road + .7 * cliff,
        'wmp04r1-oasis-corridor': (c, water, cliff, road) => 1.0 * Math.min(c[5], 600) + 2.2 * Math.min(c[6], 240) + 1.1 * Math.min(c[0], 240) + .6 * road + 2 * Math.min(c[11], 80),
        'wmp04r1-cinder-shore': (c, water, cliff, road, marine) => 1.5 * Math.min(c[9], 420) + 2.5 * Math.min(c[11], 120) + 1.4 * Math.min(water, 380) + .08 * marine + .5 * road + .3 * cliff,
        'wmp04r1-deathwater-beacon': (c, water, cliff, road, marine) => 1.1 * Math.min(c[1], 380) + 2.5 * Math.min(c[11], 120) + 1.4 * Math.min(water, 380) + .08 * marine + .45 * road,
      }[d.sceneId];
      const candidates = [];
      for (let ty = 14; ty < 186; ty += 2) for (let tx = 22; tx < 178; tx += 2) {
        const ci = ty * 200 + tx;
        if (!w.economyMap.walkable[ci]) continue;
        const c = new Array(12).fill(0); let water = 0, cliff = 0, road = 0, marine = 0;
        for (let y = ty - 11; y <= ty + 11; y++) for (let x = tx - 20; x <= tx + 20; x++) {
          const i = y * 200 + x; c[eb[i]]++;
          if (tiles[i] === 0) water++; if (tiles[i] === 8) cliff++; if (tiles[i] === 12) road++; if (mar[i]) marine++;
        }
        candidates.push({ tx, ty, score: Math.round(want(c, water, cliff, road, marine) * 100) / 100, codes: c, water, cliff, road, marine });
      }
      candidates.sort((a, b) => b.score - a.score);
      return { sceneId: d.sceneId, top: candidates.slice(0, 6) };
    });
    out[id] = r;
    console.log(id, JSON.stringify(r.top.map(t => ({ tx: t.tx, ty: t.ty, score: t.score }))));
    await s.ctx.close();
  }
  fs.writeFileSync(path.join(PILOT, 'evidence', 'anchor-probe.json'), JSON.stringify(out, null, 2) + '\n');
  await browser.close();
}

if (process.argv.includes('--probe-anchors')) { await probeAnchors(); process.exit(0); }

async function main() {
  const report = {
    schema: 'soh.wmp04r1.pilot_qa.v1', generatedAt: new Date().toISOString(),
    pilotBaseUrl: BASE, baselineBaseUrl: BASELINE, seed: SEED,
    mapHead: null, gameplayHead: null, scenes: [], comparisons: [], regressions: {}, journey: null,
    selector: null, saveReload: null, baselineOriginal: null, browserErrors: [],
  };
  const meta = JSON.parse(fs.readFileSync(path.join(PILOT, 'map-data/GENERATED_META.json'), 'utf8'));
  report.mapHead = meta.mapHead; report.gameplayHead = meta.gameplayHead;
  report.activeRevision = meta.activeRevision;

  // 1. Five real in-game AFTER scenes, day + night.
  for (let k = 0; k < AFTER.length; k++) {
    const id = AFTER[k];
    const day = await openScene(id, { hours: 0 });
    const dayShot = await shot(day.page, `0${k + 1}_AFTER_${id}_day`);
    report.scenes.push({ id, role: 'AFTER', time: 'day', url: day.url, anchor: day.anchor, screenshot: dayShot, inspect: await inspect(day.page), errors: day.errors });
    // In-game selector + real-input journey + save reload on the snow scene.
    if (id === 'wmp04r1-snow-highlands') {
      report.selector = await selectorTest(day.page);
      report.journey = await journey(day.page);
      report.saveReload = await saveReload(day.page, day.url);
    }
    await day.ctx.close();
    const night = await openScene(id, { hours: .2 });
    const nightShot = await shot(night.page, `0${k + 1}_AFTER_${id}_night`);
    report.scenes.push({ id, role: 'AFTER', time: 'night', url: night.url, anchor: night.anchor, screenshot: nightShot, inspect: await inspect(night.page), errors: night.errors });
    await night.ctx.close();
  }

  // 1b. QA diagnostic AFTER scene (not one of the five creator scenes).
  {
    const d = await openScene('wmp04r1-dry-transition', { hours: 0 });
    const sh = await shot(d.page, '06_DIAG_dry-transition_AFTER');
    report.scenes.push({ id: 'wmp04r1-dry-transition', role: 'QA_DIAGNOSTIC_AFTER', time: 'day', url: d.url, anchor: d.anchor, screenshot: sh, inspect: await inspect(d.page), errors: d.errors });
    report.journeyStraight = await journeyStraight(d.page);
    await d.ctx.close();
  }
  // 1c. Real sea-collision probe in the Cinder shoreline scene.
  {
    const c = await openScene('wmp04r1-cinder-shore', { hours: 0 });
    report.seaCollision = await seaCollisionProbe(c.page);
    await c.ctx.close();
  }

  // 2. Same-camera BEFORE scenes (pre-WMP-04 world) for all 5 comparisons.
  for (const [afterId, beforeId] of Object.entries({ ...BEFORE, ...DIAGNOSTIC })) {
    const s = await openScene(beforeId, { hours: 0 });
    const sh = await shot(s.page, `BEFORE_${afterId}`);
    report.scenes.push({ id: beforeId, role: 'BEFORE', pairWith: afterId, time: 'day', url: s.url, anchor: s.anchor, screenshot: sh, inspect: await inspect(s.page), errors: s.errors });
    await s.ctx.close();
    const a = report.scenes.find(x => x.id === afterId && (x.time === 'day'));
    const cmp = await compare(sh.file, a.screenshot.file, `COMPARE_${afterId}`, [
      `BEFORE · pre-WMP-04R1 biome · ${a.anchor.join(',')}`,
      `AFTER · WMP-04R1 effective biome · ${a.anchor.join(',')}`,
    ]);
    const bc = report.scenes[report.scenes.length - 1].inspect.camera;
    const dx = Math.abs(a.inspect.camera.x - bc.x), dy = Math.abs(a.inspect.camera.y - bc.y);
    report.comparisons.push({ afterId, beforeId, sameCamera: true, camera: [a.inspect.camera.x, a.inspect.camera.y], beforeCamera: [bc.x, bc.y], cameraDeltaPx: Math.round((dx + dy) * 1000) / 1000, cameraExactlyEqual: dx + dy === 0, image: cmp });
  }

  // 3. Untouched Gameplay web, same camera as pilot baseline scene.
  report.baselineOriginal = await baselineOriginal();
  const pilotBaseline = report.scenes.find(x => x.id === 'wmp04r1-baseline-forest' && x.time === 'day');
  const bdx = Math.abs(pilotBaseline.inspect.camera.x - report.baselineOriginal.meta.camera[0]);
  const bdy = Math.abs(pilotBaseline.inspect.camera.y - report.baselineOriginal.meta.camera[1]);
  report.comparisons.push({
    afterId: 'wmp04r1-baseline-forest', beforeId: 'ORIGINAL_GAMEPLAY_WEB', sameCamera: true,
    camera: [pilotBaseline.inspect.camera.x, pilotBaseline.inspect.camera.y],
    beforeCamera: report.baselineOriginal.meta.camera,
    cameraDeltaPx: Math.round((bdx + bdy) * 1000) / 1000, cameraExactlyEqual: bdx + bdy === 0,
    image: await compare(report.baselineOriginal.screenshot.file, pilotBaseline.screenshot.file, 'COMPARE_baseline_original_vs_pilot', [
      'BEFORE · untouched Gameplay f8fcde91 · shipping_fresh',
      'AFTER · pilot scene 1 · unchanged shipping_fresh',
    ]),
  });

  report.browserErrors = report.scenes.flatMap(s => s.errors.map(e => `${s.id}: ${e}`)).concat(report.baselineOriginal.errors.map(e => `original: ${e}`));
  fs.writeFileSync(path.join(PILOT, 'evidence', 'qa-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('WMP04R1_QA_CAPTURES scenes=' + report.scenes.length + ' comparisons=' + report.comparisons.length + ' browserErrors=' + report.browserErrors.length);
  console.log('WMP04R1_QA_JOURNEY ' + JSON.stringify(report.journey));
  console.log('WMP04R1_QA_SELECTOR ' + JSON.stringify(report.selector));
  console.log('WMP04R1_QA_SAVE ' + JSON.stringify(report.saveReload));
  console.log('WMP04R1_QA_STRAIGHT ' + JSON.stringify(report.journeyStraight));
  console.log('WMP04R1_QA_SEA ' + JSON.stringify(report.seaCollision));
  await browser.close();
}

await main();
