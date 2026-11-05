/**
 * P4 — U05 isolated six-scene Creator selector / audition QA.
 *
 * Runs against the live Vite audition server (default http://localhost:5182).
 * 640x360 @ DPR 1, native 1x camera, no zoom, no stretched sprites.
 *
 * ALL walking is performed with REAL Playwright keyboard events (keydown/keyup)
 * on the page window. BFS is used ONLY to select a legal tile path against the
 * SAME runtime collision predicate; it never substitutes for the walk.
 *
 * QA spawn fixtures are used ONLY to place the player at the documented start
 * tile and at the wall-collision probe tile. They are recorded as
 * `spawnFixture=true`, `teleportUsedAsRoute=false`, `cameraUsedAsRoute=false`.
 *
 * Outputs: creator-u05/evidence/shots/*.png
 *          creator-u05/evidence/qa-report.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/home/user/pr38/web/node_modules/playwright/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'evidence', 'shots');
const REPORT = path.join(ROOT, 'evidence', 'qa-report.json');
const BASE = process.env.U05_URL || 'http://localhost:5182/u05.html';
const CHROMIUM = '/tmp/chromium';
const LD = '/tmp/al2023/lib';
const SCENES = (process.env.U05_SCENES ? process.env.U05_SCENES.split(',') : ['po_beacon', 'po_greywater', 'po_academy', 'po_ironmine', 'po_westmouth', 'po_typhon']);
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: LD }
});
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const consoleErrors = [], pageErrors = [], failedRequests = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => pageErrors.push(e.message));
page.on('requestfailed', r => failedRequests.push(r.url() + ' :: ' + (r.failure()?.errorText || '')));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(() => window.__u05?.ready === true, { timeout: 30000 });

const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name) => {
  await page.waitForTimeout(140);
  await page.locator('canvas#u05').screenshot({ path: path.join(SHOTS, name) });
  return name;
};
const st = () => ev(() => window.__u05.state());

/** REAL keyboard input: hold the key until the runtime reports the target tile. */
async function stepKey(code, tile) {
  await page.keyboard.down(code);
  let ok = false;
  try {
    await page.waitForFunction(([x, y]) => {
      const s = window.__u05.state();
      return s.player.tile[0] === x && s.player.tile[1] === y;
    }, tile, { timeout: 900, polling: 16 });
    ok = true;
  } catch { ok = false; }
  await page.keyboard.up(code);
  return ok;
}

const INVERT = { KeyW: 'KeyS', KeyS: 'KeyW', KeyA: 'KeyD', KeyD: 'KeyA' };

/** Walk a BFS-selected tile path using ONLY real keyboard events. */
async function walk(goal, label) {
  const before = await st();
  const startTile = before.player.tile;
  await ev(() => window.__u05.clearInputLog());
  let planned = [], plannedLen = 0, stepsWalked = 0, resyncs = 0, failures = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = (await st()).player.tile;
    const p = await ev(([s, g]) => window.__u05.computeWalkPath(s, g), [cur, goal]);
    if (!p.found) break;
    if (attempt === 0) { plannedLen = p.steps.length; planned = p.steps.map(x => x.code); }
    if (attempt > 0) resyncs++;
    let allOk = true;
    for (const s of p.steps) {
      const ok = await stepKey(s.code, s.tile);
      if (ok) stepsWalked++; else { failures++; allOk = false; break; }
    }
    const now = (await st()).player.tile;
    if (now[0] === goal[0] && now[1] === goal[1]) break;
    if (allOk) break; // path exhausted without arrival (e.g. rounding)
  }
  const after = await st();
  const input = await ev(() => window.__u05.inputLog());
  return {
    label, startTile, goal, plannedLen, plannedCodes: planned.length <= 80 ? planned : `${planned.length} codes`,
    stepsWalked, resyncs, failures, arrived: after.player.tile[0] === goal[0] && after.player.tile[1] === goal[1],
    finalTile: after.player.tile,
    realKeyboardEvents: input.length,
    inputCodes: [...new Set(input.map(x => x.code))].sort(),
    movedPx: after.stats.movedPx - before.stats.movedPx,
    blockedAttemptsDelta: after.stats.blockedAttempts - before.stats.blockedAttempts,
    spawnFixtureUsed: false, teleportUsedAsRoute: false, cameraUsedAsRoute: false
  };
}

const results = [];
for (const id of SCENES) {
  await ev(i => window.__u05.selectScene(i), id);
  await page.waitForTimeout(260);
  const sceneState = await st();
  const geom = await ev(i => window.__u05.sceneGeometry(i), id);
  const approach = await ev(i => window.__u05.resolveApproach(i), id);
  const roofC = await ev(() => window.__u05.roofCentroid());
  const roofGoal = roofC ? await ev(([x, y]) => {
    const a = window.__u05;
    if (a.walkableTile(x, y)) return [x, y];
    for (let r = 1; r <= 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && a.walkableTile(x + dx, y + dy)) return [x + dx, y + dy];
    return null;
  }, roofC) : null;
  const probe = await ev(() => window.__u05.probeWall());

  // ---- A. genuine before/after at the SAME native camera -------------------
  await ev(() => window.__u05.setPhysical(false));
  const beforeShot = await shot(`before_${id}.png`);
  const beforeState = await st();
  await ev(() => window.__u05.setPhysical(true));
  const afterShot = await shot(`after_${id}.png`);
  const afterState = await st();

  // ---- B. approach + reentry with REAL input -------------------------------
  await ev(([x, y]) => window.__u05.resetPlayer(x, y), approach.resolved.start);
  const spawnState = await st();
  const approachStartShot = await shot(`approach_${id}_start.png`);
  const approachWalk = await walk(approach.resolved.goal, `approach_${id}`);
  const approachGoalShot = await shot(`approach_${id}_goal.png`);
  const atDoor = await st();
  const reentryWalk = await walk(approach.resolved.start, `reentry_${id}`);
  const reentryShot = await shot(`reentry_${id}_back.png`);
  const afterReentry = await st();

  // ---- C. roof hidden/visible transition with REAL input -------------------
  let roofWalk = null, roofBack = null, roofInsideShot = null, roofOutsideShot = null, roofVisible = null;
  let roofHiddenInside = null, roofHiddenOutside = null;
  if (roofGoal) {
    roofWalk = await walk(roofGoal, `roof_enter_${id}`);
    roofInsideShot = await shot(`roof_${id}_inside.png`);
    roofHiddenInside = await ev(() => window.__u05.roofHiddenCount());
    // Walk OUT of the roof with REAL keys and stop at the first frame where the
    // roof becomes visible again, so the capture really shows the occlusion.
    let roofVisibleSteps = 0, roofVisibleCodes = [];
    const outPath = await ev(([s, g]) => window.__u05.computeWalkPath(s, g), [(await st()).player.tile, approach.resolved.start]);
    for (const sp of outPath.steps.slice(0, 60)) {
      const ok = await stepKey(sp.code, sp.tile);
      roofVisibleSteps++; roofVisibleCodes.push(sp.code);
      await page.waitForTimeout(45);
      const h = await ev(() => window.__u05.roofHiddenCount());
      if (!ok || h === 0) break;
    }
    roofOutsideShot = await shot(`roof_${id}_outside.png`);
    roofHiddenOutside = await ev(() => window.__u05.roofHiddenCount());
    roofBack = await walk(approach.resolved.start, `roof_exit_${id}`);
    roofVisible = { steps: roofVisibleSteps, codes: roofVisibleCodes, realKeyboardEvents: roofVisibleSteps * 2, note: 'Real keyboard steps out of the roof until the runtime reports roofHiddenCount()==0; roof is therefore visible in the capture.' };
  }

  // ---- D. solid wall collision with REAL input ------------------------------
  let collision = null, collisionShot = null;
  if (probe) {
    await ev(([x, y]) => window.__u05.resetPlayer(x, y), probe.tile);
    await ev(() => window.__u05.clearInputLog());
    const c0 = await st();
    await page.keyboard.down(probe.code);
    await page.waitForTimeout(520);
    await page.keyboard.up(probe.code);
    const c1 = await st();
    const keys = await ev(() => window.__u05.inputLog());
    collisionShot = await shot(`collision_${id}_blocked.png`);
    collision = {
      probeTile: probe.tile, probeCode: probe.code, wallIds: probe.wallIds,
      wallBlockedNeighbour: await ev(([x, y, code]) => {
        const d = { KeyD: [1, 0], KeyA: [-1, 0], KeyS: [0, 1], KeyW: [0, -1] }[code];
        return window.__u05.wallBlockedTile(x + d[0], y + d[1]);
      }, [probe.tile[0], probe.tile[1], probe.code]),
      spawnFixtureUsed: true, spawnFixtureNote: 'QA fixture positions the player at the wall-adjacent probe tile ONLY; the blocking attempt itself is real keyboard input.',
      playerTileBefore: c0.player.tile, playerTileAfter: c1.player.tile,
      blockedAttemptsBefore: c0.stats.blockedAttempts, blockedAttemptsAfter: c1.stats.blockedAttempts,
      realKeyboardEvents: keys.length, inputCodes: [...new Set(keys.map(k => k.code))],
      blocked: c1.stats.blockedAttempts > c0.stats.blockedAttempts &&
               c1.player.tile[0] === c0.player.tile[0] && c1.player.tile[1] === c0.player.tile[1]
    };
  }

  // ---- E. bounded caches / chunk keys / no full-frame allocation ------------
  const final = await st();
  results.push({
    id, name: sceneState.sceneName,
    contract: sceneState.contract, status: sceneState.status,
    native: {
      viewport: sceneState.viewport, dpr: sceneState.dpr, zoom: sceneState.zoom, cameraTrick: sceneState.cameraTrick,
      U: sceneState.U, TILE: sceneState.TILE, frameTiles: sceneState.frameTiles,
      addressableCells: sceneState.addressableCells, heroSpritePx: sceneState.heroSpritePx,
      speedPxPerSec: sceneState.speedPxPerSec
    },
    geometry: { buildings: geom.buildings, walls: geom.walls, doors: geom.doors, roofs: geom.roofs, envelope: geom.envelope },
    approachPlan: {
      roadId: approach.roadId, designed: approach.designed, resolved: approach.resolved,
      adjusted: approach.adjusted, roadCentrelineChanged: approach.roadCentrelineChanged,
      pathFound: approach.pathFound, pathSteps: approach.pathSteps, visited: approach.visited,
      note: approach.note
    },
    beforeAfter: {
      beforeShot, afterShot, cameraIdentical: JSON.stringify(beforeState.camera) === JSON.stringify(afterState.camera),
      physicalBefore: beforeState.physical, physicalAfter: afterState.physical,
      drawBefore: beforeState.draw, drawAfter: afterState.draw,
      note: 'Same 640x360 1x camera, same player tile, physical layer toggled OFF then ON. GOLD terrain/road untouched.'
    },
    spawnFixture: { used: true, tile: approach.resolved.start, recorded: spawnState.stats.spawnFixture, teleportUsedAsRoute: false, cameraUsedAsRoute: false },
    approach: { startShot: approachStartShot, goalShot: approachGoalShot, ...approachWalk, atDoor: { tile: atDoor.player.tile, wallBlockedHere: atDoor.wallBlockedHere, walkableHere: atDoor.walkableHere } },
    reentry: { shot: reentryShot, ...reentryWalk, finalState: { tile: afterReentry.player.tile, movedPx: afterReentry.stats.movedPx } },
    roof: roofGoal ? { roofCentroid: roofC, legalGoal: roofGoal, enter: roofWalk, exit: roofBack, insideShot: roofInsideShot, outsideShot: roofOutsideShot, roofHiddenInside, roofHiddenOutside, walkOut: roofVisible, transitionProven: roofHiddenInside > roofHiddenOutside && roofHiddenOutside === 0 } : { status: 'NO_ROOF_IN_SCENE', roofCentroid: null },
    collision,
    collisionShot,
    final: {
      draw: final.draw, chunkAudit: final.chunkAudit,
      stats: final.stats, frameMs: final.frameMs,
      materializedAllCells: false,
      maxResidentChunks: final.stats.maxResidentChunks, maxDisplayCanvases: final.stats.maxDisplayCanvases
    }
  });
  console.log(`U05_QA_SCENE ${id} approach=${approachWalk.arrived} reentry=${reentryWalk.arrived} roof=${roofGoal ? (roofHiddenInside > roofHiddenOutside) : 'none'} collision=${collision?.blocked}`);
}

const report = {
  schema: 'soh.u05.qa-report.v1',
  generatedAt: new Date().toISOString(),
  url: BASE,
  browser: { executablePath: CHROMIUM, viewport: [640, 360], deviceScaleFactor: 1, flags: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] },
  method: 'REAL Playwright keyboard keydown/keyup events for every tile step; BFS only selects the legal path against the SAME runtime collision predicate. No camera-as-route, no teleport-as-route, no zoom, no stretched sprites.',
  scope: 'ISOLATED U05 CREATOR SELECTOR / AUDITION ONLY — not full Gameplay runtime integration, not visual acceptance, not 81 POI production art.',
  consoleErrors, pageErrors, failedRequests,
  scenes: results,
  shots: fs.readdirSync(SHOTS).filter(f => f.endsWith('.png')).sort(),
  gates: {
    'P4-G0': { status: results.length === SCENES.length && (!process.env.U05_SCENES || results.length === 6) ? 'PASS' : 'FAIL', reason: 'six Creator-selected deep scenes auditioned' },
    'P4-G1': { status: results.every(r => r.beforeAfter.cameraIdentical && r.beforeAfter.physicalBefore === false && r.beforeAfter.physicalAfter === true) ? 'PASS' : 'FAIL', reason: 'genuine before/after at identical native camera' },
    'P4-G2': { status: results.every(r => r.approach.arrived && r.reentry.arrived && r.approach.realKeyboardEvents > 0 && r.reentry.realKeyboardEvents > 0) ? 'PASS' : 'FAIL', reason: 'real-input approach and reentry arrive at their legal tiles' },
    'P4-G3': { status: results.every(r => r.collision?.blocked) ? 'PASS' : 'FAIL', reason: 'real-input solid wall collision blocked' },
    'P4-G4': { status: results.every(r => r.roof.transitionProven) ? 'PASS' : 'FAIL', reason: 'roof hidden/visible transition along real walks' },
    'P4-G5': { status: consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0 ? 'PASS' : 'FAIL', reason: 'zero console/page/request errors' },
    'P4-G6': { status: results.every(r => r.final.chunkAudit.uniqueKeys === r.final.chunkAudit.totalChunks && r.final.chunkAudit.collisions === 0 && r.final.stats.materializedAllCells === false && r.final.stats.residentChunks <= 36 && r.final.stats.displayCanvases <= 36) ? 'PASS' : 'FAIL', reason: 'bounded LRU chunks/canvases, unique chunk keys, no eager 11.2M cell allocation' },
    'P4-G7': { status: results.every(r => r.native.viewport[0] === 640 && r.native.viewport[1] === 360 && r.native.dpr === 1 && r.native.zoom === 1 && r.native.U === 0.5 && r.native.heroSpritePx[0] === 16 && r.native.heroSpritePx[1] === 24) ? 'PASS' : 'FAIL', reason: 'native 640x360 1x camera, U=0.5, unstretched 16x24 hero' }
  },
  notProven: [
    'Full Gameplay runtime integration (VEYRA_PLAYABLE)',
    'Creator visual acceptance',
    'All 81 POIs art-complete/interactive',
    'Production inventory/transactions/traces/monsters/ownership/loot/keys/power/HP law',
    'Marine/boat/ferry/swim law, helicopter object, car wreck/ship hull substitute',
    'Full 4000x2800 streaming / sustained 60 FPS production acceptance',
    'Any change to the Creator-liked Beacon road (preserved verbatim)'
  ]
};
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
const fails = Object.entries(report.gates).filter(([, v]) => v.status !== 'PASS').map(([k]) => k);
console.log(`U05_QA_OK scenes=${results.length} shots=${report.shots.length} errors=${consoleErrors.length + pageErrors.length + failedRequests.length} failingGates=${fails.join(',') || 'none'}`);
await browser.close();
if (fails.length) process.exitCode = 1;
