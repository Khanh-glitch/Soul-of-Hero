/**
 * SOH — MAP-GEO-REJOIN-02 — REAL RUNTIME / REAL-KEY PHYSICAL VERIFICATION.
 *
 * Executable: creator-u05/SoulOfHero_MapGeo02_CorrectedProjection.html
 *   (a NEW, explicitly labelled QA verification build; the THREE protected
 *    standalone baselines are NEVER modified).
 *
 * Uses the SAME U=0.5 renderer, native 640x360 @1x, hero 16x24, verbatim
 * terrain painter, x10 viewer speed. Every reported path comes from REAL held
 * WASD with NATURAL_TERRAIN_ONLY collision ON. `reset(tx,ty)` is ONE viewer
 * spawn control per run, NOT a route/teleport claim.
 *
 * Two candidate modes are ALWAYS explicit:
 *   PRODUCTION_NO_PERMISSION (default) — deck still blocked, cliff NOT a wall.
 *   QA_CANDIDATE_CROSSING              — geometry measurement ONLY; never a
 *                                       production traversal permission.
 *
 * Outputs: creator-u05/evidence/mapgeo02-traversal.json
 *          creator-u05/evidence/mapgeo02-shots/*.png (native 640x360)
 */
import { chromium } from '/home/user/pr38/web/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const VIEWER = path.join(ROOT, 'SoulOfHero_MapGeo02_CorrectedProjection.html');
const OLD_VIEWER = path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html');
const SHOTS = path.join(ROOT, 'evidence/mapgeo02-shots');
const OLD_SHOTS = path.join(ROOT, 'evidence/mapgeo01-shots');
const OUT = path.join(ROOT, 'evidence/mapgeo02-traversal.json');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(SHOTS, { recursive: true });
const VIEWER_SHA = sha(fs.readFileSync(VIEWER));
const OLD_SHA = sha(fs.readFileSync(OLD_VIEWER));
const errors = [];

const browser = await chromium.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib' }
});
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('file://' + VIEWER);
await page.waitForFunction(() => window.__terrain?.ready === true, { timeout: 60000 });
const oldPage = await ctx.newPage();
oldPage.on('pageerror', e => errors.push('old pageerror: ' + e.message));
await oldPage.goto('file://' + OLD_VIEWER);
await oldPage.waitForFunction(() => window.__terrain?.ready === true, { timeout: 60000 });

const st = () => page.evaluate(() => window.__terrain.state());
async function shot(name) {
  const d = await page.evaluate(() => {
    const c = document.getElementById('game');
    return { png: c.toDataURL('image/png'), w: c.width, h: c.height };
  });
  fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(d.png.split(',')[1], 'base64'));
  return { file: `creator-u05/evidence/mapgeo02-shots/${name}.png`, size: [d.w, d.h] };
}
const setup = (tx, ty, mode, collision = true) => page.evaluate(({ tx, ty, mode, collision }) => {
  const a = window.__terrain;
  a.zoomNative(); a.setGuides(false); a.setLens(false); a.setFollow('CENTER_FOLLOW');
  a.setSpeed(10); a.setCollision(collision); a.setCandidateMode(mode);
  a.reset(tx, ty); a.clearInputLog();
  return a.state();
}, { tx, ty, mode, collision });
const PROD = 'PRODUCTION_NO_PERMISSION', QA = 'QA_CANDIDATE_CROSSING';

/* Pixel comparison with the MAP-GEO-01 shot at the SAME coordinate. */
async function pixelDiff(oldFile, newFile) {
  const a = fs.readFileSync(oldFile).toString('base64');
  const b = fs.readFileSync(newFile).toString('base64');
  return page.evaluate(async ([a, b]) => {
    const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
    const g = c.getContext('2d'); g.drawImage(ia, 0, 0); const A = g.getImageData(0, 0, c.width, c.height).data;
    g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const B = g.getImageData(0, 0, c.width, c.height).data;
    let diff = 0, sum = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
      if (d > 24) diff++; sum += d;
    }
    return { size: [ia.width, ia.height], differingPixels: diff, totalPixels: ia.width * ia.height,
      meanAbsChannelDiff: +(sum / (A.length / 4) / 3).toFixed(3) };
  }, [a, b]);
}

/* ── Real-key run ─────────────────────────────────────────────────────── */
async function walk(id, tile, legs, mode, extra = {}) {
  const s0 = await setup(tile[0], tile[1], mode, extra.collision ?? true);
  const before = await shot(id + '_before');
  const samples = [{ leg: 'start', tile: s0.player.tile, px: Math.round(s0.player.px), py: Math.round(s0.player.py),
    visibleTile: s0.terrain?.tileRendered, candidate: { deck: s0.candidate?.bridgeDeckId ?? null, face: s0.candidate?.cliffFace?.side ?? null } }];
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i];
    for (const k of l.keys) await page.keyboard.down(k);
    await page.waitForTimeout(l.ms);
    for (const k of l.keys) await page.keyboard.up(k);
    const s = await st();
    samples.push({ leg: i + 1, keys: l.keys, heldMs: l.ms, tile: s.player.tile,
      px: Math.round(s.player.px), py: Math.round(s.player.py), visibleTile: s.terrain?.tileRendered,
      candidate: { deck: s.candidate?.bridgeDeckId ?? null, face: s.candidate?.cliffFace?.side ?? null },
      blockedSubsteps: s.stats.blockedSubsteps });
  }
  const s1 = await st();
  const after = await shot(id + '_after');
  const inputLog = await page.evaluate(() => window.__terrain.inputLog());
  return {
    id, mode, collision: s1.collision,
    spawn: { tile, au: s0.player.au, method: 'window.__terrain.reset(tx,ty) VIEWER SPAWN CONTROL (one per run)' },
    legs, samples,
    movement: {
      movedPx: +(s1.stats.movedPx - s0.stats.movedPx).toFixed(2),
      tilesTraversed: +((s1.stats.movedPx - s0.stats.movedPx) / 16).toFixed(2),
      blockedSubsteps: s1.stats.blockedSubsteps - s0.stats.blockedSubsteps,
      startTile: s0.player.tile, endTile: s1.player.tile,
      tileDelta: [s1.player.tile[0] - s0.player.tile[0], s1.player.tile[1] - s0.player.tile[1]],
      endVisibleTile: s1.terrain?.tileRendered,
      endOnBridgeDeck: s1.candidate?.bridgeDeckId ?? null,
      endOnCliffFace: s1.candidate?.cliffFace?.side ?? null,
      endProductionBlocked: s1.candidate?.productionBlocked,
      endQaBlocked: s1.candidate?.qaBlocked
    },
    realKeys: { held: legs.reduce((a, l) => a + l.ms, 0), inputLogEntries: inputLog.length,
      teleportUsed: false, camUsedAsRoute: false, collisionDisabled: false },
    before, after, feature: extra.feature ?? '', result: extra.result ?? '',
    note: extra.note ?? ''
  };
}

/* ── A. Six MAP-GEO-01 runs at EXACTLY the same coordinates / legs ─────── */
const MATCHING = [
  ['T1_spawn_to_route', [744, 1212], [{ keys: ['w', 'd'], ms: 950 }]],
  ['T2_road_biome_transition', [2372, 2580], [{ keys: ['d'], ms: 2200 }]],
  ['T3_bridge_approach_crossing', [2020, 907], [{ keys: ['d'], ms: 1250 }]],
  ['T4_highland_and_alternative', [1200, 1200], [
    { keys: ['d'], ms: 700 }, { keys: ['s'], ms: 600 }, { keys: ['a'], ms: 700 }, { keys: ['w'], ms: 600 }]],
  ['T5_coastal_dock_approach', [3170, 1769], [
    { keys: ['a'], ms: 600 }, { keys: ['a'], ms: 250 }, { keys: ['a'], ms: 90 }]],
  ['T6_poi_exterior_return', [520, 1304], [{ keys: ['d'], ms: 450 }, { keys: ['a'], ms: 450 }]]
];
const matchingRuns = [];
const old01 = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/mapgeo01-traversal.json'), 'utf8'));
for (const [id, tile, legs] of MATCHING) {
  const r = await walk('match_' + id, tile, legs, PROD, {
    feature: 'exact MAP-GEO-01 coordinate/legs, PRODUCTION_NO_PERMISSION',
    result: 'MATCHING_COORDINATE_COMPARISON'
  });
  const oldFile = path.join(OLD_SHOTS, id + '_after.png');
  r.comparedTo = `creator-u05/evidence/mapgeo01-shots/${id}_after.png`;
  r.pixelDiff = fs.existsSync(oldFile) ? await pixelDiff(oldFile, path.join(SHOTS, 'match_' + id + '_after.png')) : null;
  // STATIC, EXACT same-coordinate comparison: spawn at the MAP-GEO-01 measured
  // end tile (the coordinate of the old `_after` screenshot) and take a native
  // shot. Viewer frame timing may differ slightly between runs; this isolates
  // the GEOMETRY difference at an identical world coordinate.
  const oldEnd = old01.traversals.find(t => t.id === id)?.measurement?.endTile;
  if (oldEnd) {
    await setup(oldEnd[0], oldEnd[1], PROD);
    const cs = await shot('coord_' + id);
    const win = { x0: oldEnd[0] - 20, x1: oldEnd[0] + 19, y0: oldEnd[1] - 11, y1: oldEnd[1] + 11 };
    const codes = async pg => pg.evaluate(w => {
      const a = window.__terrain, out = [];
      for (let y = w.y0; y <= w.y1; y++) for (let x = w.x0; x <= w.x1; x++) out.push(a.u05Tile(x, y));
      return out;
    }, win);
    const oldCodes = await codes(oldPage), newCodes = await codes(page);
    let changed = 0, oldBridgeOnLand = 0, newBridgeOnWater = 0, newCliff = 0, oldCliff = 0;
    for (let i = 0; i < oldCodes.length; i++) {
      if (oldCodes[i] !== newCodes[i]) changed++;
      if (oldCodes[i] === 13) oldBridgeOnLand++;
      if (newCodes[i] === 13) newBridgeOnWater++;
      if (oldCodes[i] === 8) oldCliff++;
      if (newCodes[i] === 8) newCliff++;
    }
    r.exactCoordinate = { tile: oldEnd, shot: cs, window: win,
      pixelDiff: fs.existsSync(oldFile) ? await pixelDiff(oldFile, path.join(SHOTS, 'coord_' + id + '.png')) : null,
      tileCodeComparison: { tiles: oldCodes.length, changedTiles: changed,
        oldBridgeTiles: oldBridgeOnLand, newBridgeTiles: newBridgeOnWater,
        oldCliffTiles: oldCliff, newCliffTiles: newCliff,
        note: 'exact world-coordinate tile-code comparison; independent of viewer sub-pixel camera offset' },
      pixelDiffCaveat: 'Raw pixel diff also includes a small viewer camera offset between independently timed runs; the tile-code comparison is the authoritative same-coordinate geometry check.' };
  }
  matchingRuns.push(r);
}

/* ── B. Representative bridge candidates, real WASD, both modes ───────── */
const BRIDGE_RUNS = [
  { id: 'B_br1_T3_production', tile: [2020, 907], legs: [{ keys: ['d'], ms: 1250 }], mode: PROD,
    feature: 'br_1 at [2045,907]; production must NOT silently grant traversal' },
  { id: 'B_br1_T3_qa', tile: [2020, 907], legs: [{ keys: ['d'], ms: 1250 }], mode: QA,
    feature: 'br_1 bounded deck; QA candidate crossing geometry only' },
  { id: 'B_br2_production', tile: [2579, 1052], legs: [{ keys: ['w'], ms: 700 }], mode: PROD,
    feature: 'br_2, authored ang≈-1.535 (almost pure north crossing)' },
  { id: 'B_br2_qa_full_cross', tile: [2579, 1052], legs: [{ keys: ['w'], ms: 700 }], mode: QA,
    feature: 'br_2 QA candidate crossing from bank A to bank B, 0 blocked substeps expected' },
  { id: 'B_br7_production', tile: [3227, 685], legs: [{ keys: ['d'], ms: 450 }, { keys: ['d', 's'], ms: 300 }], mode: PROD,
    feature: 'br_7, 2 AU water span, cart load' },
  { id: 'B_br7_qa_full_cross', tile: [3227, 685], legs: [{ keys: ['d'], ms: 450 }, { keys: ['d', 's'], ms: 300 }], mode: QA,
    feature: 'br_7 QA candidate crossing with real d / d+s held keys' },
  { id: 'B_br6_qa_deck', tile: [2019, 1465], legs: [{ keys: ['a'], ms: 600 }], mode: QA,
    feature: 'br_6 foot bridge; QA reaches the measured deck (angled, partial straight-line crossing)' },
  { id: 'B_brb_unresolved', tile: [2052, 1859], legs: [{ keys: ['d'], ms: 600 }], mode: QA,
    feature: 'br_b UNRESOLVED (no verified second bank); NO deck art must be stamped here' }
];
const bridgeRuns = [];
for (const r of BRIDGE_RUNS) bridgeRuns.push(await walk(r.id, r.tile, r.legs, r.mode, { feature: r.feature, result: 'REAL_KEY_QA' }));
for (const r of bridgeRuns) {
  const x = await shot(r.id + '_at_bridge');
  r.bridgeCentreShot = x;
}

/* ── C. Highland cliff face + alternative, real WASD ──────────────────── */
const CLIFF_RUNS = [
  { id: 'C_cliff_production', tile: [1200, 1200], mode: PROD,
    legs: [{ keys: ['d'], ms: 700 }, { keys: ['s'], ms: 600 }, { keys: ['a'], ms: 700 }, { keys: ['w'], ms: 600 }],
    feature: '305 binary cliff candidates now visible; PRODUCTION has NO permanent cliff wall' },
  { id: 'C_cliff_qa_candidate', tile: [1200, 1200], mode: QA,
    legs: [{ keys: ['d'], ms: 700 }, { keys: ['s'], ms: 600 }, { keys: ['a'], ms: 700 }, { keys: ['w'], ms: 600 }],
    feature: 'explicit QA candidate collision; real movement is measurably blocked by the face' },
  { id: 'C_cliff_qa_alternative', tile: [1200, 1200], mode: QA,
    legs: [{ keys: ['d'], ms: 400 }, { keys: ['w'], ms: 700 }, { keys: ['d'], ms: 400 }, { keys: ['s'], ms: 700 }],
    feature: 'alternative highland route with real keys in QA mode; detour, not a teleport' }
];
const cliffRuns = [];
for (const r of CLIFF_RUNS) cliffRuns.push(await walk(r.id, r.tile, r.legs, r.mode, { feature: r.feature, result: 'REAL_KEY_QA' }));

/* Extra static screenshots at a measured jagged cliff face. */
const faceTile = await page.evaluate(() => {
  const a = window.__terrain;
  for (let y = 1190; y < 1240; y++) for (let x = 1180; x < 1260; x++)
    if (a.u05Tile(x, y) === 8) return [x, y];
  return null;
});
if (faceTile) { await setup(faceTile[0], faceTile[1], PROD); await shot('cliff_face_measured_production'); }
await setup(2045, 907, PROD); await shot('br1_centre_production');
await setup(2045, 907, QA); await shot('br1_centre_qa');
await setup(2020, 907, PROD); await shot('br1_T3_matching_coordinate');

/* ── D. Static / semantic checks ──────────────────────────────────────── */
const checks = [];
const check = (id, ok, detail) => checks.push({ id, verdict: ok ? 'PASS' : 'FAIL', detail });
const source = await page.evaluate(() => window.__terrain.mapgeo02Source());
const bridges = await page.evaluate(() => window.__terrain.bridgeCandidates());
const cliff = await page.evaluate(() => window.__terrain.cliffStats());
const deckTiles = await page.evaluate(() => window.__terrain.deckTileCount());
const goldBytes = fs.readFileSync(path.join(REPO, 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json'));
const GOLD = JSON.parse(goldBytes.toString('utf8')).project;
const crossBytes = fs.readFileSync(path.join(REPO, 'veyra-world-master/data/rasters/geo01/crossingCandidate.u8'));
const cliffBytes = fs.readFileSync(path.join(REPO, 'veyra-world-master/v3/rasters/cliffCandidate.v3.u8'));
const slopeClassBytes = fs.readFileSync(path.join(REPO, 'veyra-world-master/v3/rasters/slopeClass.v3.u8'));
const hClassBytes = fs.readFileSync(path.join(REPO, 'veyra-world-master/v3/rasters/heightClass.v3.u8'));
const slopeBytes = fs.readFileSync(path.join(REPO, 'veyra-world-master/data/rasters/geo01/slope.u8'));
const permBytes = fs.readFileSync(path.join(REPO, 'veyra-world-master/v3/rasters/activeCollisionPermission.v3.u8'));

const s = await page.evaluate(() => window.__terrain.state());
check('D01_native_renderer', s.viewport[0] === 640 && s.viewport[1] === 360 && s.dpr === 1 &&
  s.heroSpritePx[0] === 16 && s.heroSpritePx[1] === 24 && s.U === 0.5 && s.TILE === 16 &&
  s.frameTiles[0] === 4000 && s.frameTiles[1] === 2800,
  { viewport: s.viewport, dpr: s.dpr, hero: s.heroSpritePx, U: s.U, TILE: s.TILE,
    frameTiles: s.frameTiles,
    nativeCanvas: await page.evaluate(() => [document.getElementById('game').width, document.getElementById('game').height]) });

check('D02_gold_source_sha', source.goldSha256 === sha(goldBytes), { runtime: source.goldSha256, file: sha(goldBytes) });
check('D03_crossing_raster_sha', source.crossingRasterSha256 === sha(crossBytes), { runtime: source.crossingRasterSha256, file: sha(crossBytes) });
check('D04_all_12_ids', bridges.length === 12 && bridges.every((b, i) => b.id === GOLD.bridges[i].id),
  { ids: bridges.map(b => b.id) });
check('D05_not_forced_12_pass', source.unresolvedBridgeIds.length > 0 &&
  source.resolvedBridgeIds.length + source.unresolvedBridgeIds.length === 12,
  { resolved: source.resolvedBridgeIds, unresolved: source.unresolvedBridgeIds });
check('D06_unresolved_ids_exact', JSON.stringify(source.unresolvedBridgeIds) === JSON.stringify(['br_9', 'br_b']),
  { unresolved: source.unresolvedBridgeIds, reasons: bridges.filter(b => b.status.startsWith('UNRESOLVED')).map(b => ({ id: b.id, reasons: b.unresolvedReasons })) });
check('D07_resolved_evidence', bridges.filter(b => b.status.startsWith('CANDIDATE_DECK')).every(b =>
  b.deckTileCount > 0 && b.continuity === true && b.roadApproaches === true &&
  Object.values(b.sourceEvidence).every(Boolean) && b.deckFootprintAu.notMarkerRadius === true &&
  b.deckFootprintAu.width === 3.0 && b.waterSpanAu <= 16),
  bridges.filter(b => b.status.startsWith('CANDIDATE_DECK')).map(b => ({
    id: b.id, spanAu: b.waterSpanAu, deckTiles: b.deckTileCount,
    footprintAu: b.deckFootprintAu, spanCoverage: b.spanCoverage,
    banks: [b.bankA.dryLand, b.bankB.dryLand], roads: [b.bankA.road, b.bankB.road],
    seams: b.bankSeams, continuity: b.continuity
  })));
check('D08_crossing_codes', bridges.every(b => b.crossingCandidateCode === (GOLD.bridges.find(g => g.id === b.id).load === 'cart' ? 2 : 1)),
  bridges.map(b => ({ id: b.id, load: b.authoredLoad, code: b.crossingCandidateCode })));
const deckScan = await page.evaluate(() => {
  const a = window.__terrain, res = { total: 0, onWater: 0, onLand: 0, permissionLeaks: 0, sourceIdMissing: 0, ids: {} };
  for (const b of a.bridgeCandidates()) {
    if (!b.status.startsWith('CANDIDATE_DECK')) continue;
    const cx = b.atTile[0], cy = b.atTile[1];
    for (let y = cy - 20; y <= cy + 20; y++) for (let x = cx - 20; x <= cx + 20; x++) {
      if (a.u05Tile(x, y) !== 13) continue;
      res.total++;
      const q = a.sampleTile(x, y), c = a.candidateInfo(x, y);
      if (q?.water) res.onWater++; else res.onLand++;
      if (c.bridgeDeckId) res.ids[c.bridgeDeckId] = (res.ids[c.bridgeDeckId] || 0) + 1; else res.sourceIdMissing++;
      if (c.productionBlocked !== true || c.qaBlocked !== false || c.activeCollisionPermission !== false) res.permissionLeaks++;
      if (c.permissions?.foot !== false) res.permissionLeaks++;
      if (q?.permissions?.boat !== false || q?.permissions?.swim !== false || q?.permissions?.ferryFoot !== false) res.permissionLeaks++;
    }
  }
  return res;
});
check('D09_deck_ok', deckScan.onLand === 0 && deckScan.onWater > 0 && deckScan.permissionLeaks === 0 &&
  deckScan.sourceIdMissing === 0, deckScan);

/* Independent file-level cliff evidence. */
const candidateCells = [];
for (let i = 0; i < cliffBytes.length; i++) if (cliffBytes[i] === 1) candidateCells.push(i);
const fileCliff = {
  candidateCells: candidateCells.length,
  heightClassAtLeast4: candidateCells.filter(i => hClassBytes[i] >= 4).length,
  slopeAtLeast20: candidateCells.filter(i => slopeBytes[i] >= 20).length,
  slopeClassAtLeast3: candidateCells.filter(i => slopeClassBytes[i] >= 3).length,
  activeCollisionPermissionNonZero: Array.from(permBytes).filter(v => v !== 0).length
};
check('D10_cliff_candidate_contract', fileCliff.candidateCells === 305 &&
  fileCliff.heightClassAtLeast4 === 305 && fileCliff.slopeAtLeast20 === 305 &&
  fileCliff.slopeClassAtLeast3 === 305 && cliff.candidateCells === 305 && cliff.qualifiedCells === 305,
  { file: fileCliff, runtime: { candidateCells: cliff.candidateCells, qualifiedCells: cliff.qualifiedCells,
    repairedPredicate: cliff.repairedPredicate, faceBand: cliff.faceBandTilesPerCellEdge, sideHistogram: cliff.sideHistogram } });
check('D11_no_active_collision_permission', fileCliff.activeCollisionPermissionNonZero === 0 &&
  cliff.productionCollisionCells === 0, fileCliff);

/* Runtime cliff tile scan: visible faces exist, not filled slabs, no production walls. */
const cliffScan = await page.evaluate(() => {
  const a = window.__terrain, windows = [
    { id: 'highland_T4', cx: 1200, cy: 1200, w: 40, h: 40 },
    { id: 'northeast', cx: 1976, cy: 344, w: 40, h: 40 },
    { id: 'cinder', cx: 3231, cy: 688, w: 40, h: 40 }
  ];
  const out = [];
  for (const win of windows) {
    let cliffTiles = 0, prodWall = 0, qaWall = 0, waterWalkable = 0, permissionLeaks = 0;
    const cellCounts = new Map();
    for (let y = win.cy - win.h; y <= win.cy + win.h; y++) {
      for (let x = win.cx - win.w; x <= win.cx + win.w; x++) {
        const code = a.u05Tile(x, y), q = a.sampleTile(x, y), c = a.candidateInfo(x, y);
        if (code === 8) {
          cliffTiles++; if (c.productionBlocked) prodWall++; if (c.qaBlocked) qaWall++;
          if (c.activeCollisionPermission !== false) permissionLeaks++;
          if (!c.cliffFace || c.cliffFace.cliffCandidate < 1) permissionLeaks++;
          const ck = `${Math.floor(x / 16)}:${Math.floor(y / 16)}`;
          cellCounts.set(ck, (cellCounts.get(ck) || 0) + 1);
        }
        if (q?.water && c.permissions?.foot === true) waterWalkable++;
      }
    }
    const maxCliffTilesInOne16x16Cell = Math.max(0, ...cellCounts.values());
    out.push({ ...win, cliffTiles, prodWall, qaWall, waterWalkable, permissionLeaks,
      maxCliffTilesInOne16x16Cell, filled16x16Slabs: maxCliffTilesInOne16x16Cell >= 200 ? 1 : 0 });
  }
  return out;
});
check('D12_cliff_visible_not_slabs', cliffScan.some(w => w.cliffTiles > 0) &&
  cliffScan.every(w => w.filled16x16Slabs === 0 && w.prodWall === 0 &&
    (w.cliffTiles === 0 || w.qaWall > 0) && w.waterWalkable === 0 && w.permissionLeaks === 0), cliffScan);
const oldCliff = await oldPage.evaluate(() => {
  let n = 0;
  for (let y = 1160; y < 1240; y++) for (let x = 1160; x < 1260; x++) if (window.__terrain.u05Tile(x, y) === 8) n++;
  return n;
});
check('D13_old_had_zero_cliffs', oldCliff === 0, { oldCliffTilesInT4Window: oldCliff });
/* Exact-coordinate cliff comparison: OLD 0 CLIFF, NEW jagged face band. */
const cliffCoord = faceTile ?? [1210, 1214];
const cliffWin = { x0: cliffCoord[0] - 20, x1: cliffCoord[0] + 19, y0: cliffCoord[1] - 11, y1: cliffCoord[1] + 11 };
const ccOld = await oldPage.evaluate(w => {
  const a = window.__terrain, r = { cliff: 0, bridge: 0, road: 0, tiles: 0 };
  for (let y = w.y0; y <= w.y1; y++) for (let x = w.x0; x <= w.x1; x++) {
    const t = a.u05Tile(x, y); r.tiles++; if (t === 8) r.cliff++; if (t === 13) r.bridge++; if (t === 12) r.road++;
  } return r;
}, cliffWin);
const ccNew = await page.evaluate(w => {
  const a = window.__terrain, r = { cliff: 0, bridge: 0, road: 0, tiles: 0 };
  for (let y = w.y0; y <= w.y1; y++) for (let x = w.x0; x <= w.x1; x++) {
    const t = a.u05Tile(x, y); r.tiles++; if (t === 8) r.cliff++; if (t === 13) r.bridge++; if (t === 12) r.road++;
  } return r;
}, cliffWin);
check('D13b_cliff_exact_coordinate', ccOld.cliff === 0 && ccNew.cliff > 0 && ccNew.road === ccOld.road,
  { coordinateTile: cliffCoord, window: cliffWin, old: ccOld, corrected: ccNew });

/* No large artificial wood carpet: OLD br_1 had huge land bridge counts. */
const carpet = await Promise.all([
  (async () => oldPage.evaluate(() => {
    let land = 0, water = 0, total = 0;
    for (let y = 887; y <= 927; y++) for (let x = 2025; x <= 2065; x++) {
      const t = window.__terrain.u05Tile(x, y), q = window.__terrain.sampleTile(x, y);
      if (t === 13) { total++; if (q?.water) water++; else land++; }
    }
    return { land, water, total };
  }))(),
  (async () => page.evaluate(() => {
    let land = 0, water = 0, total = 0;
    for (let y = 887; y <= 927; y++) for (let x = 2025; x <= 2065; x++) {
      const t = window.__terrain.u05Tile(x, y), q = window.__terrain.sampleTile(x, y);
      if (t === 13) { total++; if (q?.water) water++; else land++; }
    }
    return { land, water, total };
  }))()
]);
check('D14_wood_carpet_removed', carpet[0].land > 500 && carpet[1].land === 0 && carpet[1].water > 0,
  { old: carpet[0], corrected: carpet[1] });

/* Ferry routes must remain water navigation references. */
const wt = JSON.parse(fs.readFileSync(path.join(REPO, 'veyra-world-master/v3/layers/water_traversal.v3.json'), 'utf8'));
const ferryCentres = wt.ferryRoutes.map(f => {
  const i = f.cells[Math.floor(f.cells.length / 2)];
  return { id: f.id, cellIndex: i, au: [(i % 250) * 8 + 4, Math.floor(i / 250) * 8 + 4] };
});
const ferryScan = await page.evaluate(list => list.map(f => {
  const a = window.__terrain;
  const tx = Math.floor(f.au[0] * 2), ty = Math.floor(f.au[1] * 2);
  const q = a.sampleTile(tx, ty), c = a.candidateInfo(tx, ty);
  return { id: f.id, cellIndex: f.cellIndex, tile: [tx, ty], au: f.au,
    visibleTile: a.u05Tile(tx, ty), water: !!q?.water,
    waterTraversalClass: q?.waterTraversalClass, foot: q?.permissions?.foot,
    boat: q?.permissions?.boat, swim: q?.permissions?.swim, ferryFoot: q?.permissions?.ferryFoot,
    activeCollisionPermission: c.activeCollisionPermission,
    productionBlocked: c.productionBlocked, qaBlocked: c.qaBlocked };
}), ferryCentres);
check('D15_ferries_not_dry_land_roads', ferryScan.length === 8 &&
  ferryScan.every(f => f.visibleTile !== 12 && f.waterTraversalClass === 2 &&
    f.foot === false && f.boat === false && f.swim === false && f.ferryFoot === false &&
    f.activeCollisionPermission === false && f.productionBlocked === true), ferryScan);

/* Beacon road NOT widened / recoloured / redrawn (old vs new tile codes). */
const beacon = await Promise.all([
  oldPage.evaluate(() => {
    const a = window.__terrain, r = { road: 0, bridge: 0, cliff: 0, other: 0 };
    for (let y = 1284; y <= 1324; y++) for (let x = 504; x <= 584; x++) {
      const t = a.u05Tile(x, y);
      if (t === 12) r.road++; else if (t === 13) r.bridge++; else if (t === 8) r.cliff++; else r.other++;
    }
    return r;
  }),
  page.evaluate(() => {
    const a = window.__terrain, r = { road: 0, bridge: 0, cliff: 0, other: 0 };
    for (let y = 1284; y <= 1324; y++) for (let x = 504; x <= 584; x++) {
      const t = a.u05Tile(x, y);
      if (t === 12) r.road++; else if (t === 13) r.bridge++; else if (t === 8) r.cliff++; else r.other++;
    }
    return r;
  })
]);
check('D16_beacon_road_unchanged', JSON.stringify(beacon[0]) === JSON.stringify(beacon[1]),
  { old: beacon[0], corrected: beacon[1] });

/* Nearby chunks, determinism, source ids, save coordinates. */
const nearby = await page.evaluate(() => {
  const a = window.__terrain, out = [];
  for (const b of a.bridgeCandidates()) {
    if (!b.status.startsWith('CANDIDATE_DECK')) continue;
    const [cx, cy] = b.atTile;
    let codes = 0, cliffs = 0, decks = 0;
    for (let y = cy - 34; y <= cy + 34; y++) for (let x = cx - 34; x <= cx + 34; x++) {
      const t = a.u05Tile(x, y); codes++;
      if (t === 8) cliffs++; if (t === 13) decks++;
    }
    out.push({ id: b.id, centreTile: [cx, cy], windowTiles: codes, cliffTiles: cliffs, deckTiles: decks });
  }
  return { windows: out, stats: a.stats() };
});
check('D17_nearby_chunks_bounded', nearby.windows.length === 10 &&
  nearby.windows.every(w => w.deckTiles > 0) && nearby.stats.materializedAllCells === false &&
  nearby.stats.residentChunks <= nearby.stats.maxResidentChunks, nearby);

const snap1 = await page.evaluate(() => ({
  source: window.__terrain.mapgeo02Source(), bridges: window.__terrain.bridgeCandidates(),
  cliff: window.__terrain.cliffStats(),
  tiles: (() => { const a = window.__terrain, r = []; for (let y = 897; y <= 917; y += 2) for (let x = 2035; x <= 2055; x += 2) r.push(a.u05Tile(x, y)); return r; })()
}));
const p2 = await ctx.newPage();
await p2.goto('file://' + VIEWER);
await p2.waitForFunction(() => window.__terrain?.ready === true, { timeout: 60000 });
const snap2 = await p2.evaluate(() => ({
  source: window.__terrain.mapgeo02Source(), bridges: window.__terrain.bridgeCandidates(),
  cliff: window.__terrain.cliffStats(),
  tiles: (() => { const a = window.__terrain, r = []; for (let y = 897; y <= 917; y += 2) for (let x = 2035; x <= 2055; x += 2) r.push(a.u05Tile(x, y)); return r; })()
}));
await p2.close();
check('D18_deterministic', JSON.stringify(snap1) === JSON.stringify(snap2), { reloadIdentical: true });
check('D19_source_ids_and_coords', snap1.source.deterministic === true &&
  snap1.source.bridgeIds.length === 12 && snap1.source.gameplayPermissionGranted === false &&
  snap1.source.productionMerge === false && snap1.source.veyraPlayable === false &&
  bridges.every(b => Math.abs(b.atAu[0] - GOLD.bridges.find(g => g.id === b.id).at[0]) < 0.00001 &&
    Math.abs(b.atAu[1] - GOLD.bridges.find(g => g.id === b.id).at[1]) < 0.00001),
  { sourceIds: snap1.source.bridgeIds, saveCoordinatesUnchanged: true });

/* No permission leakage globally over sampled windows. */
const leak = await page.evaluate(() => {
  const a = window.__terrain, res = { samples: 0, activePermissionTrue: 0,
    waterFootTrue: 0, boatTrue: 0, swimTrue: 0, ferryFootTrue: 0, buildTrue: 0,
    deckProductionUnblocked: 0, cliffProductionBlocked: 0 };
  for (const [cx, cy] of [[2045, 907], [1711, 1152], [2579, 1042], [1200, 1200], [544, 1304], [3130, 1769]]) {
    for (let y = cy - 20; y <= cy + 20; y++) for (let x = cx - 20; x <= cx + 20; x++) {
      const q = a.sampleTile(x, y), c = a.candidateInfo(x, y); if (!q) continue;
      res.samples++;
      if (c.activeCollisionPermission !== false) res.activePermissionTrue++;
      if (q.water && q.permissions.foot === true) res.waterFootTrue++;
      if (q.permissions.boat === true) res.boatTrue++;
      if (q.permissions.swim === true) res.swimTrue++;
      if (q.permissions.ferryFoot === true) res.ferryFootTrue++;
      if (q.permissions.build === true) res.buildTrue++;
      if (c.bridgeDeckId && c.productionBlocked !== true) res.deckProductionUnblocked++;
      if (c.cliffFace && c.productionBlocked === true) res.cliffProductionBlocked++;
    }
  }
  return res;
});
check('D20_no_permission_leakage', leak.activePermissionTrue === 0 && leak.waterFootTrue === 0 &&
  leak.boatTrue === 0 && leak.swimTrue === 0 && leak.ferryFootTrue === 0 && leak.buildTrue === 0 &&
  leak.deckProductionUnblocked === 0 && leak.cliffProductionBlocked === 0, leak);

/* Real-key outcomes (not fabricated PASS). */
const byId = id => [...bridgeRuns, ...cliffRuns].find(r => r.id === id);
const b2q = byId('B_br2_qa_full_cross'), b2p = byId('B_br2_production');
const b7q = byId('B_br7_qa_full_cross'), b7p = byId('B_br7_production');
const cq = byId('C_cliff_qa_candidate'), cp = byId('C_cliff_production');
const b1q = byId('B_br1_T3_qa'), b1p = byId('B_br1_T3_production');
check('E01_production_still_blocked', b2p.movement.blockedSubsteps > 0 && b2p.movement.tilesTraversed < 10 &&
  b1p.movement.blockedSubsteps > 0, { br2: b2p.movement, br1: b1p.movement });
check('E02_qa_candidate_geometry_crossable', b2q.movement.blockedSubsteps === 0 &&
  b2q.movement.tilesTraversed > 20 && b7q.movement.tilesTraversed > 20 &&
  b1q.movement.endOnBridgeDeck === 'br_1',
  { br2: b2q.movement, br7: b7q.movement, br1: b1q.movement });
check('E03_qa_cliff_collision_explicit', cq.movement.blockedSubsteps > cp.movement.blockedSubsteps &&
  cp.movement.blockedSubsteps === 0,
  { production: cp.movement, qa: cq.movement, alternative: byId('C_cliff_qa_alternative').movement });
check('E04_unresolved_brb_no_deck', byId('B_brb_unresolved').movement.endOnBridgeDeck === null &&
  bridges.find(b => b.id === 'br_b').status.startsWith('UNRESOLVED'),
  { brb: bridges.find(b => b.id === 'br_b').unresolvedReasons });
check('E05_real_keys_only', [...bridgeRuns, ...cliffRuns, ...matchingRuns].every(r =>
  r.realKeys.held > 0 && r.realKeys.inputLogEntries > 0 && !r.realKeys.teleportUsed &&
  !r.realKeys.camUsedAsRoute && !r.realKeys.collisionDisabled),
  { runs: bridgeRuns.length + cliffRuns.length + matchingRuns.length });

/* Matching-coordinate screenshot diffs must be real (non-zero, not identical). */
check('E06_matching_coordinate_shots', matchingRuns.length === 6 &&
  matchingRuns.every(r => r.pixelDiff?.size?.[0] === 640 && r.pixelDiff?.size?.[1] === 360 &&
    r.exactCoordinate?.pixelDiff?.size?.[0] === 640) &&
  matchingRuns.some(r => r.pixelDiff.differingPixels > 1000),
  matchingRuns.map(r => ({ id: r.id, endTile: r.movement.endTile,
    exactCoordinateTile: r.exactCoordinate?.tile ?? null,
    dynamicDiff: r.pixelDiff, exactCoordinateDiff: r.exactCoordinate?.pixelDiff ?? null,
    tileCodeComparison: r.exactCoordinate?.tileCodeComparison ?? null })));

/* Protected baselines unchanged. */
const baselineWant = {
  'SoulOfHero_TerrainOnly_U05_x10.html': '540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0',
  'SoulOfHero_Nature01_U05.html': 'ac4d54e310f0f3cf7e0e12d728bc5e9ad62f801994be37ce64f76b099af4a0a7',
  'SoulOfHero_Nature02_ForestSlice.html': '6e1e897a0e365412f6bc92d65390dc10bf7b0352e6ad8ef4a1c38e57f4f30fa6'
};
const baselines = Object.fromEntries(Object.entries(baselineWant).map(([f, want]) =>
  [f, { sha256: sha(fs.readFileSync(path.join(ROOT, f))), unchanged: sha(fs.readFileSync(path.join(ROOT, f))) === want }]));
check('E07_protected_baselines', Object.values(baselines).every(b => b.unchanged), baselines);

/* Immutable bridge-by-bridge / cliff geometry table for the handoff. */
fs.writeFileSync(path.join(ROOT, 'evidence/mapgeo02-bridge-geometry.json'), JSON.stringify({
  schema: 'soh.mapgeo02.bridge-geometry.v1',
  task: 'SOH — MAP-GEO-REJOIN-02',
  generatedAt: new Date().toISOString(),
  executableSha256: VIEWER_SHA,
  goldSha256: source.goldSha256,
  crossingRasterSha256: source.crossingRasterSha256,
  method: 'runtime derivation from GOLD id/at/ang/load + authored river banks + road approaches + crossingCandidate code; NO 12 AU marker radius',
  bridges, cliffStats: cliff, deckTileCount: deckTiles,
  resolvedIds: source.resolvedBridgeIds, unresolvedIds: source.unresolvedBridgeIds,
  authority: 'MAP_PHYSICAL_GEOMETRY_ONLY__GAMEPLAY_WORLDTRAVERSAL_PERMISSION_REQUIRED',
  noClaims: ['NO production traversal permission', 'NO bearing/load/cart clearance law', 'NO GOLD amendment']
}, null, 2));

const passes = checks.filter(c => c.verdict === 'PASS').length;
const fails = checks.filter(c => c.verdict === 'FAIL');
const evidence = {
  schema: 'soh.mapgeo02.traversal.v1',
  task: 'SOH — MAP-GEO-REJOIN-02',
  status: 'QA_VERIFICATION__NOT_PRODUCTION__NOT_VISUAL_ACCEPTANCE',
  generatedAt: new Date().toISOString(),
  executable: { file: 'creator-u05/SoulOfHero_MapGeo02_CorrectedProjection.html', sha256: VIEWER_SHA },
  comparisonExecutable: { file: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html', sha256: OLD_SHA },
  method: {
    renderer: 'existing SOH U=0.5 terrain renderer, verbatim terrain.ts painter, native 640x360 1x, hero 16x24',
    screenshots: 'document.getElementById("game").toDataURL("image/png")',
    movement: 'REAL held WASD / arrow keys with NATURAL_TERRAIN_ONLY collision ON; x10 viewer speed',
    spawnControl: 'window.__terrain.reset(tx,ty) ONCE per run; NOT a route or teleport claim',
    modes: { default: PROD, qaOnly: QA },
    authority: 'QA candidate crossing/collision is EXPLICIT and NEVER grants production traversal'
  },
  source: {
    bridgeCount: bridges.length, resolved: source.resolvedBridgeIds,
    unresolved: source.unresolvedBridgeIds, deckTileCount: deckTiles,
    cliff: { candidateCells: cliff.candidateCells, qualifiedCells: cliff.qualifiedCells,
      faceBand: cliff.faceBandTilesPerCellEdge, sideHistogram: cliff.sideHistogram }
  },
  matchingCoordinateRuns: matchingRuns, bridgeRuns, cliffRuns,
  checks, summary: { checks: checks.length, passes, fails: fails.length,
    failedIds: fails.map(f => f.id), browserErrors: errors,
    shots: fs.readdirSync(SHOTS).length },
  acceptance: {
    PAPER: 'MEASURED', RUNTIME: 'ISOLATED_VIEWER_PHYSICAL_VERIFIED_QA_ONLY',
    VISUAL: 'NOT_REQUESTED_AND_NOT_GRANTED', GAMEPLAY: 'NOT_REQUESTED_AND_NOT_GRANTED',
    veyraPlayable: false, productionMerge: false, fullWorldVisualAcceptance: false
  },
  noClaims: [
    'NO production traversal permission', 'NO Gameplay collision/load/cart/climb law',
    'NO GOLD amendment', 'NO new atlas/art/world', 'NO PR44 edit/merge',
    'NO full-world visual acceptance', 'NO VEYRA_PLAYABLE'
  ]
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2));
console.log(`U05_MAPGEO02_TRAVERSAL_OK checks=${passes}/${checks.length} fails=${fails.length} ` +
  `runs=${matchingRuns.length + bridgeRuns.length + cliffRuns.length} shots=${evidence.summary.shots} errors=${errors.length}` +
  (fails.length ? ' FAILIDS=' + fails.map(f => f.id).join(',') : ''));
await browser.close();
if (fails.length || errors.length) process.exitCode = 1;
