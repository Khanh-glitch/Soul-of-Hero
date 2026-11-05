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

// ---- WHOLE-MAP ZOOM (Creator follow-up) ----------------------------------
// Z zooms to the SMALLEST possible scale: the entire 4000x2800-tile frame
// must fit inside the native 640x360 view.
await page.keyboard.press('KeyZ');
const zoomAfterZ = await ev(() => window.__terrain.state());
await page.waitForFunction(() => window.__terrain.overviewStats().ready === true, { timeout: 30000 });
const fitState = await ev(() => window.__terrain.state());
const wholeMapShot = await shot('terrain_only_whole_map.png');
const guidesDefault = await ev(() => window.__terrain.state());
await page.keyboard.press('KeyB');
await page.waitForTimeout(120);
const guidesOff = await ev(() => window.__terrain.state());
await page.keyboard.press('KeyB');
await page.waitForTimeout(120);
const guidesState = await ev(() => window.__terrain.state());
const guidesShot = await shot('terrain_only_whole_map_guides.png');
// Mid zoom via API + mouse wheel (viewer controls).
await ev(() => window.__terrain.setZoom(0.5));
const midZoom = await ev(() => window.__terrain.state());
await page.mouse.wheel(0, -120);
const afterWheel = await ev(() => window.__terrain.state());
// Movement still works while zoomed out (x10 pans the whole map).
await ev(() => { window.__terrain.zoomFit(); window.__terrain.setSpeed(10); window.__terrain.setFollow('FIT_FOLLOW'); });
await page.waitForTimeout(150);
const followBefore = await ev(() => window.__terrain.state());
await page.keyboard.down('KeyD'); await page.waitForTimeout(700); await page.keyboard.up('KeyD');
const followAfter = await ev(() => window.__terrain.state());
const panBefore = followBefore.player.px, panAfter = followAfter.player.px;
// F cycles FIT_FOLLOW -> CENTER_FOLLOW (player exactly centred, map scrolls)
// -> LOCK (map frozen). Then cycle back to FIT_FOLLOW.
await page.keyboard.press('KeyF'); await page.waitForTimeout(150);
const centerState = await ev(() => window.__terrain.state());
const centerShot = await shot('terrain_only_center_follow.png');
await page.keyboard.down('KeyD'); await page.waitForTimeout(500); await page.keyboard.up('KeyD');
const centerAfterMove = await ev(() => window.__terrain.state());
const lensShot = await page.locator('#lens').screenshot({ path: path.join(SHOTS, 'terrain_only_lens_1x.png') }).then(() => 'terrain_only_lens_1x.png');
await page.keyboard.press('KeyF'); await page.waitForTimeout(150);
const lockState = await ev(() => window.__terrain.state());
await page.keyboard.press('KeyF'); await page.waitForTimeout(150);
const fitAgain = await ev(() => window.__terrain.state());
const lensInfo = await ev(() => ({ w: document.getElementById('lens').width, h: document.getElementById('lens').height, isHtmlCanvas: document.getElementById('lens') !== document.getElementById('game') }));
// ---- ISOLATED-CELL DESPECKLE (Creator bug report) ------------------------
const despeckleWindows = await ev(() => [[900, 900], [2500, 1700], [2222, 804], [2100, 1900], [3300, 1500]]
  .map(([x, y]) => window.__terrain.isolatedCells(x, y, 60, 40)));
const despeckle = await ev(() => window.__terrain.despeckleStats());
const geomPreserved = await ev(() => {
  const a = window.__terrain;
  const c = { road: [0, 0], river: [0, 0], deep: [0, 0], bridge: [0, 0], cliff: [0, 0], ice: [0, 0], lava: [0, 0] };
  const idx = { 12: 'road', 19: 'river', 0: 'deep', 13: 'bridge', 8: 'cliff', 18: 'ice', 16: 'lava' };
  for (let y = 1250; y < 1360; y++) for (let x = 480; x < 620; x++) {
    const raw = a.sampleTile(x, y).tile, painted = a.u05Tile(x, y);
    if (idx[raw] !== undefined) c[idx[raw]][0]++;
    if (idx[painted] !== undefined) c[idx[painted]][1]++;
  }
  return c;
});
await ev(() => window.__terrain.reset(900, 900));
await page.waitForTimeout(250);
const despeckleShot = await shot('terrain_only_despeckled.png');
await ev(() => window.__terrain.reset(544, 1304));
// Return to native 1x and prove the camera/hero contract is intact.
await page.keyboard.press('KeyV');
await page.waitForTimeout(200);
const nativeAgain = await ev(() => window.__terrain.state());
await ev(() => window.__terrain.setSpeed(1));

/** Measure real keyboard movement at a given multiplier. */
async function measure(mult) {
  await ev(([m, tx, ty]) => { window.__terrain.zoomNative(); window.__terrain.setSpeed(m); window.__terrain.reset(tx, ty); }, [mult, 544, 1304]);
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
// Deep link ?zoom=fit opens straight into the whole-map view.
await page.goto(HTTP + '?zoom=fit', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(() => window.__terrain?.ready === true, { timeout: 30000 });
const deepLink = await ev(() => window.__terrain.state());
const deepLinkShot = await shot('terrain_only_zoom_fit_deeplink.png');

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
  'T-G9': { status: consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0 ? 'PASS' : 'FAIL', reason: 'zero console / page / request errors' },
  'T-G10': { status: zoomAfterZ.zoomMode === 'WHOLE_MAP_OVERVIEW' && fitState.mapFitsViewport === true && fitState.zoom < 0.01 && Math.abs(fitState.pxPerTile - 0.128571) < 0.0001 ? 'PASS' : 'FAIL', reason: 'Z reaches the smallest zoom; whole 4000x2800 frame fits 640x360' },
  'T-G11': { status: fitState.overview.ready === true && fitState.overview.pixels === 175000 && fitState.overview.strideTiles === 8 && fitState.overview.tileSamples > 500000 && fitState.overview.fullFrameAllocated === false && fitState.stats.materializedAllCells === false ? 'PASS' : 'FAIL', reason: 'sampled 500x350 overview, no 11.2M-cell allocation, no 8AU raster upscale' },
  'T-G12': { status: Object.values(fitState.draw.overlays).every(v => v === 0) && fitState.draw.drawn.hero === 0 && fitState.draw.drawn.overviewBitmap === 1 && fitState.draw.terrainOnly === true ? 'PASS' : 'FAIL', reason: 'overview is pure terrain sample, no overlay layers' },
  'T-G13': { status: guidesDefault.draw.viewerGuides.viewportRect === 1 && guidesOff.draw.viewerGuides.viewportRect === 0 && guidesState.draw.viewerGuides.viewportRect === 1 && guidesState.overview.guides === true ? 'PASS' : 'FAIL', reason: 'viewer guides (B) DEFAULT ON, toggle off/on, explicitly reported, not map layers' },
  'T-G16': { status: fitState.draw.viewerCursor.playerMarker === 1 && fitState.playerMarkerScreen[0] >= 0 && fitState.playerMarkerScreen[0] <= 640 && fitState.playerMarkerScreen[1] >= 0 && fitState.playerMarkerScreen[1] <= 360 && followAfter.playerMarkerScreen[0] !== followBefore.playerMarkerScreen[0] ? 'PASS' : 'FAIL', reason: 'hero marker ALWAYS drawn on the overview and MOVES with WASD (regression: first zoom attempt hid the character)' },
  'T-G17': { status: followBefore.followMode === 'FIT_FOLLOW' && followBefore.overviewCamera.followGain[0] > 0 && followBefore.overviewCamera.followGain[0] < 1 && Math.abs(followAfter.overviewCamera.offset[0] - followBefore.overviewCamera.offset[0]) > 0.5 && followAfter.overviewCamera.wholeMapVisible === true && followAfter.mapFitsViewport === true ? 'PASS' : 'FAIL', reason: 'FIT_FOLLOW camera pans with the player while the WHOLE frame stays visible' },
  'T-G18': { status: centerState.followMode === 'CENTER_FOLLOW' && centerState.overviewCamera.cameraCenteredOnPlayer === true && centerAfterMove.overviewCamera.cameraCenteredOnPlayer === true && centerState.overviewCamera.wholeMapVisible === false && lockState.followMode === 'LOCK' && lockState.followCamera === false && fitAgain.followMode === 'FIT_FOLLOW' ? 'PASS' : 'FAIL', reason: 'F cycles Fit / Center (player stays centred while map scrolls) / Lock; real camera follow at every zoom' },
  'T-G19': { status: lensInfo.w === 192 && lensInfo.h === 144 && lensInfo.isHtmlCanvas === true && fitState.draw.lens.hero === 1 && fitState.draw.lens.terrainChunks > 0 && fitState.draw.lens.followCamera === true && fitState.lensEnabled === true && Object.values(fitState.draw.overlays).every(v => v === 0) ? 'PASS' : 'FAIL', reason: 'separate HTML 192x144 native 1x follow camera always draws the hero; game canvas still has zero overlay layers' },
  'T-G20': { status: despeckleWindows.every(w => w.paintedIsolated === 0) && despeckleWindows.some(w => w.rawIsolated > 20) && despeckle.replacements > 0 && despeckle.verbatimPainterUnchanged === true && despeckle.goldPolygonsUnchanged === true ? 'PASS' : 'FAIL', reason: 'isolated A-surrounded-by-4-B cells eliminated in every sampled window; GOLD + verbatim painter untouched' },
  'T-G21': { status: Object.values(geomPreserved).every(([raw, painted]) => raw === painted) ? 'PASS' : 'FAIL', reason: 'ROAD / RIVER / DEEP / BRIDGE / CLIFF / ICE / LAVA tile counts around Beacon are byte-for-byte unchanged' },
  'T-G22': { status: despeckle.overviewUsesRawSampler === true && despeckle.windowsResident <= despeckle.windowMax && despeckle.passesRun >= 3 ? 'PASS' : 'FAIL', reason: 'despeckle is bounded (<=256 chunk windows), overview stays cheap on the raw sampler' },
  'T-G23': { status: fs.existsSync(path.join(SHOTS, 'speckle_before.png')) && fs.existsSync(path.join(SHOTS, 'speckle_after.png')) && fs.existsSync(path.join(SHOTS, despeckleShot)) ? 'PASS' : 'FAIL', reason: 'before/after native 1x evidence shots of the same tile (900,900) exist' },
  'T-G15': { status: deepLink.zoomMode === 'WHOLE_MAP_OVERVIEW' && deepLink.mapFitsViewport === true && deepLink.zoomLevel === 0 && Object.values(deepLink.draw.overlays).every(v => v === 0) ? 'PASS' : 'FAIL', reason: '?zoom=fit deep link opens directly at the smallest whole-map zoom' },
  'T-G14': { status: midZoom.zoomMode === 'WHOLE_MAP_OVERVIEW' && midZoom.zoom > fitState.zoom && midZoom.zoom < 1 && afterWheel.zoomLevel > midZoom.zoomLevel && panAfter > panBefore && nativeAgain.zoom === 1 && nativeAgain.zoomMode === 'NATIVE_1X' && nativeAgain.draw.drawn.hero === 1 && nativeAgain.draw.drawn.overviewBitmap === 0 ? 'PASS' : 'FAIL', reason: 'slider/wheel zoom, x10 pan while zoomed out, V restores native 1x hero' }
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
  despeckle: {
    windows: despeckleWindows,
    stats: despeckle,
    authoredGeometryTileCountsPreserved: geomPreserved,
    shot: despeckleShot
  },
  zoom: {
    follow: {
      before: { mode: followBefore.followMode, offset: followBefore.overviewCamera.offset, gain: followBefore.overviewCamera.followGain, marker: followBefore.playerMarkerScreen, wholeMapVisible: followBefore.overviewCamera.wholeMapVisible },
      after: { mode: followAfter.followMode, offset: followAfter.overviewCamera.offset, gain: followAfter.overviewCamera.followGain, marker: followAfter.playerMarkerScreen, wholeMapVisible: followAfter.overviewCamera.wholeMapVisible },
      center: { mode: centerState.followMode, centered: centerState.overviewCamera.cameraCenteredOnPlayer, marker: centerState.playerMarkerScreen, wholeMapVisible: centerState.overviewCamera.wholeMapVisible, afterMoveCentered: centerAfterMove.overviewCamera.cameraCenteredOnPlayer, afterMoveOffset: centerAfterMove.overviewCamera.offset },
      lock: { mode: lockState.followMode, followCamera: lockState.followCamera, offset: lockState.overviewCamera.offset },
      backToFit: fitAgain.followMode,
      lens: lensInfo,
      shots: [centerShot, lensShot]
    },
    guidesDefault: guidesDefault.draw.viewerGuides.viewportRect,
    guidesOff: guidesOff.draw.viewerGuides.viewportRect,
    afterZ: { zoom: zoomAfterZ.zoom, mode: zoomAfterZ.zoomMode },
    fit: { zoom: fitState.zoom, pxPerTile: fitState.pxPerTile, mapFitsViewport: fitState.mapFitsViewport, overview: fitState.overview, draw: fitState.draw },
    guides: { viewerGuides: guidesState.draw.viewerGuides, enabled: guidesState.overview.guides },
    midZoom: { zoom: midZoom.zoom, level: midZoom.zoomLevel, mode: midZoom.zoomMode, zoomMode: midZoom.zoomMode, fits: midZoom.mapFitsViewport },
    wheel: { levelBefore: midZoom.zoomLevel, levelAfter: afterWheel.zoomLevel, zoomAfter: afterWheel.zoom },
    panAtX10: { beforePx: Math.round(panBefore), afterPx: Math.round(panAfter), deltaPx: Math.round(panAfter - panBefore) },
    nativeAgain: { zoom: nativeAgain.zoom, mode: nativeAgain.zoomMode, zoomMode: nativeAgain.zoomMode, draw: nativeAgain.draw },
    shots: [wholeMapShot, guidesShot]
  },
  longRun: { player: longRun.player, camera: longRun.camera, stats: longRun.stats, frameMs: longRun.frameMs },
  http: { mode: httpState.mode, viewport: httpState.viewport, draw: httpState.draw },
  deepLink: { zoomMode: deepLink.zoomMode, mapFitsViewport: deepLink.mapFitsViewport, zoomLevel: deepLink.zoomLevel, draw: deepLink.draw, shot: deepLinkShot },
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
