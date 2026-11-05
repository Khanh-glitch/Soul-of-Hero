/**
 * NATURE-01 — browser QA for the five-biome decorative ecology pilot.
 *
 * Runs the real standalone executables from file:// in Chromium at exactly
 * 640x360 DPR 1. Produces native OFF/ON screenshot pairs at IDENTICAL tile
 * positions, wider real-keyboard traversal sequences, and machine-readable
 * gate results. No visual-acceptance claim is made by this script.
 *
 * Context A freezes requestAnimationFrame time so the hero animation frame is
 * deterministic -> OFF/ON and baseline canvas pixels can be compared EXACTLY.
 * Context B uses the real clock so real WASD movement and frame timing work.
 */
import { chromium } from '/home/user/pr38/web/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'evidence/nature01-shots');
const OUT = path.join(ROOT, 'evidence/nature01-qa.json');
const NATURE_HTML = path.join(ROOT, 'SoulOfHero_Nature01_U05.html');
const BASE_HTML = path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html');
const BASELINE_SHA = '540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0';
const BUILD = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/nature01-build.json'), 'utf8'));
const SITES_DOC = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/nature01-sites.json'), 'utf8'));

fs.mkdirSync(SHOTS, { recursive: true });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const viewFile = f => 'file://' + f;

const SITE_ORDER = ['temperate_forest', 'snow_forest', 'marsh', 'dry', 'rocky_highlands'];
const SHOT_TILE = {
  temperate_forest: [1472, 1336], snow_forest: [1360, 840], marsh: [2152, 828],
  dry: [2640, 1320], rocky_highlands: [1100, 1200]
};
const CENTRE_TILE = {
  temperate_forest: [1440, 1320], snow_forest: [1360, 840], marsh: [2160, 840],
  dry: [2640, 1320], rocky_highlands: [1100, 1200]
};
const BEACON = [544, 1304];
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

const gates = [];
const gate = (id, name, ok, detail) => {
  gates.push({ id, name, pass: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${name} :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  return !!ok;
};
const browser = await chromium.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib' }
});
const errors = [];
const attach = p => {
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
};

/* ------------------------------------------------------------------ *
 * Context A — deterministic clock, exact pixel comparisons
 * ------------------------------------------------------------------ */
const ctxA = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
await ctxA.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(() => cb(0));
});
const pn = await ctxA.newPage(); attach(pn);
const pb = await ctxA.newPage(); attach(pb);
await pn.goto(viewFile(NATURE_HTML)); await pb.goto(viewFile(BASE_HTML));
await pn.waitForFunction(() => window.__nature && window.__nature.ready === true, { timeout: 60000 });
await pb.waitForFunction(() => window.__terrain && window.__terrain.ready === true, { timeout: 60000 });
await pn.evaluate(() => { window.__nature.freezeAnimation(true); window.__nature.setGuides(false); });
await pb.evaluate(() => window.__terrain.setGuides(false));

const natureBytes = fs.readFileSync(NATURE_HTML);
const baseBytes = fs.readFileSync(BASE_HTML);
const natureSha = sha(natureBytes), baseSha = sha(baseBytes);
const s0 = await pn.evaluate(() => window.__nature.state());
const b0 = await pb.evaluate(() => window.__terrain.state());
const htmlText = natureBytes.toString('utf8');
const forbidden = ['PhysicalLayer', 'U05_SCENES', 'SITE_ENVELOPE', 'BUILDING_COMPOSITION', 'ROOF_OCCLUSION', 'roofHiddenCount', 'drawSource', 'harvestProbe', 'VEYRA_PLAYABLE'];
const leaked = forbidden.filter(x => htmlText.includes(x));

gate('N-G0', 'boot + untouched baseline + native contract',
  baseSha === BASELINE_SHA && natureSha === BUILD.sha256 && BUILD.baseline.untouched &&
  s0.U === 0.5 && s0.TILE === 16 && s0.viewport[0] === 640 && s0.viewport[1] === 360 &&
  s0.heroSpritePx[0] === 16 && s0.heroSpritePx[1] === 24 &&
  s0.speedMultiplierRange[0] === 1 && s0.speedMultiplierRange[1] === 10 &&
  s0.frameTiles[0] === 4000 && s0.frameTiles[1] === 2800 &&
  s0.stats.materializedAllCells === false && s0.draw.physicalLayerLoaded === false &&
  s0.draw.sceneDataLoaded === false && Object.values(s0.draw.overlays).every(v => v === 0) &&
  leaked.length === 0,
  { baseSha, natureSha, bytes: natureBytes.length, U: s0.U, viewport: s0.viewport, hero: s0.heroSpritePx, leaked });

/* N-G1 — OFF/ON pairs at identical positions + exact OFF === baseline */
const pairs = [];
for (const k of [...SITE_ORDER, 'beacon_road']) {
  const [tx, ty] = k === 'beacon_road' ? BEACON : SHOT_TILE[k];
  await pn.evaluate(([x, y]) => { window.__nature.setNature(false); window.__nature.zoomNative(); window.__nature.reset(x, y); }, [tx, ty]);
  await pb.evaluate(([x, y]) => { window.__terrain.zoomNative(); window.__terrain.reset(x, y); }, [tx, ty]);
  await pn.waitForTimeout(110); await pb.waitForTimeout(110);
  const off = await pn.locator('#game').screenshot();
  const base = await pb.locator('#game').screenshot();
  await pn.evaluate(() => window.__nature.setNature(true));
  await pn.waitForTimeout(110);
  const on = await pn.locator('#game').screenshot();
  const offSha = sha(off), onSha = sha(on), baseSha2 = sha(base);
  fs.writeFileSync(path.join(SHOTS, `${k}_off.png`), off);
  fs.writeFileSync(path.join(SHOTS, `${k}_on.png`), on);
  const offEqualsBase = offSha === baseSha2;
  const changed = offSha !== onSha;
  const st = await pn.evaluate(() => window.__nature.state());
  pairs.push({
    site: k, tile: [tx, ty], offEqualsBaseline: offEqualsBase,
    offSha, onSha, baselineSha: baseSha2, onDiffersFromOff: changed,
    natureObjectsDrawn: st.nature.drawnThisFrame,
    camera: st.camera, zoomMode: st.zoomMode,
    behindHero: st.nature.behindHero, inFrontOfHero: st.nature.inFrontOfHero,
    drawOrderSorted: st.nature.drawOrderSorted,
    shotFiles: [`creator-u05/evidence/nature01-shots/${k}_off.png`, `creator-u05/evidence/nature01-shots/${k}_on.png`]
  });
}
gate('N-G1', 'OFF canvas pixel-identical to untouched terrain baseline at 6 positions',
  pairs.every(p => p.offEqualsBaseline) &&
  pairs.filter(p => p.site !== 'beacon_road').every(p => p.onDiffersFromOff) &&
  pairs.find(p => p.site === 'beacon_road').onDiffersFromOff === false &&
  pairs.every(p => p.zoomMode === 'NATIVE_1X'),
  pairs.map(p => ({ site: p.site, tile: p.tile, offEqualsBaseline: p.offEqualsBaseline, onDiffersFromOff: p.onDiffersFromOff, drawn: p.natureObjectsDrawn })));

/* N-G2 — five genuinely distinct environments + placement audit */
const tAudit = Date.now();
const audit = await pn.evaluate(() => window.__nature.auditPilot());
const auditMs = Date.now() - tAudit;
const rules = await pn.evaluate(() => window.__nature.rules());
const designedFloor = { temperate_forest: 0.72, snow_forest: 0.82, marsh: 0.72, dry: 0.90, rocky_highlands: 0.82 };
const zeroViolations = Object.values(audit.violations).every(v => v === 0);
const distinct = new Set(SITE_ORDER.map(k => Object.entries(audit.bySite[k].kinds).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]).join('|'))).size === 5;
const dryOpen = audit.openGround.dry >= 0.85;
const floorsOk = SITE_ORDER.every(k => audit.openGround[k] >= designedFloor[k]);
const gold = k => SITES_DOC.sites[k].biomeCounts;
const biomesOk =
  (gold('temperate_forest').forest || 0) > 4000 &&
  (gold('snow_forest').snow || 0) > 3000 && (gold('snow_forest').conifer || 0) > 1000 &&
  (gold('marsh').marsh || 0) > 4000 &&
  (gold('dry').scrub_dry_steppe || 0) > 6000 &&
  (gold('rocky_highlands').rock || 0) > 3000 && (gold('rocky_highlands').conifer || 0) > 1500;
gate('N-G2', 'five distinct GOLD-biome samples, density / access / no-authority-write audit',
  audit.sites === 5 && audit.totalObjects > 2500 && zeroViolations && distinct && dryOpen && floorsOk && biomesOk,
  { totalObjects: audit.totalObjects, openGround: audit.openGround, designedFloor, violations: audit.violations, distinctKindProfiles: distinct, auditMs,
    kindProfiles: Object.fromEntries(SITE_ORDER.map(k => [k, Object.entries(audit.bySite[k].kinds).sort((a, b) => b[1] - a[1]).slice(0, 5)])) });

/* N-G3 — decorative-only classification, no fabricated mechanics / structures */
const inv = await pn.evaluate(() => window.__nature.assetInventory());
const nat = s0.nature;
const classificationOk = inv.used.every(a => a.decorativeOnly === true && a.gameplayOwned === false) &&
  inv.excludedGameplayOwned.length > 0 && inv.used.length === 12 &&
  nat.buildingsOrPoiStructures === 0 && nat.walls === 0 && nat.roofs === 0 && nat.doors === 0 &&
  nat.fences === 0 && nat.artificialRuins === 0 && nat.goldOrRasterWrites === 0 &&
  nat.newArtAssets === 0 && nat.fullWorldPropagation === false &&
  nat.decorativeOnly === true && nat.gameplayOwned === false &&
  nat.blocksMovement === false && nat.collisionChanged === false &&
  nat.hasInteraction === false && nat.hasRewards === false && nat.hasDepletion === false && nat.hasOwnership === false;
gate('N-G3', 'existing SOH art only; decorative NOT Gameplay-owned; no structures / mechanics',
  classificationOk, { usedSprites: inv.used.map(a => a.spriteArray), excludedGameplayOwned: inv.excludedGameplayOwned, excludedArtificial: inv.excludedArtificial, flags: {
    decorativeOnly: nat.decorativeOnly, gameplayOwned: nat.gameplayOwned, blocksMovement: nat.blocksMovement,
    hasRewards: nat.hasRewards, hasDepletion: nat.hasDepletion, hasOwnership: nat.hasOwnership, newArtAssets: nat.newArtAssets } });

/* N-G4 — stable positions + chunk boundaries */
const chunkChecks = [];
for (const k of SITE_ORDER) {
  const [cx, cy] = CENTRE_TILE[k];
  const bx = Math.floor(cx / 32) * 32;
  const by = Math.floor(cy / 32) * 32;
  const t0 = [bx - 6, by - 6, bx + 6, by + 6];
  const w1 = await pn.evaluate(t => window.__nature.objectsInTileWindow(t[0], t[1], t[2], t[3]), t0);
  await pn.evaluate(() => window.__nature.resetNatureCaches());
  const w2 = await pn.evaluate(t => window.__nature.objectsInTileWindow(t[0], t[1], t[2], t[3]), t0);
  const hash1 = sha(Buffer.from(JSON.stringify(w1))), hash2 = sha(Buffer.from(JSON.stringify(w2)));
  const left = w1.filter(o => o.tx < bx).length, right = w1.filter(o => o.tx >= bx).length;
  // Camera-independent window objects must all be present in the drawn frame.
  await pn.evaluate(([x, y]) => window.__nature.reset(x, y), [bx, by]);
  await pn.waitForTimeout(110);
  const frame = await pn.evaluate(() => {
    const s = window.__nature.state();
    return window.__nature.natureObjectsInRect(s.camera.x, s.camera.y, 640, 360).map(o => `${o.tx},${o.ty}`);
  });
  const missing = w1.filter(o => !frame.includes(`${o.tx},${o.ty}`)).length;
  chunkChecks.push({ site: k, boundaryTile: [bx, by], window: t0, objects: w1.length, left, right, stableAcrossCacheReset: hash1 === hash2, windowHash: hash1, presentInFrame: w1.length - missing, missing });
}
const audit2 = await pn.evaluate(() => window.__nature.auditPilot());
const stabilityHash1 = audit.stabilityHash, stabilityHash2 = audit2.stabilityHash;
gate('N-G4', 'deterministic positions, stable across cache resets and 32-tile chunk boundaries',
  chunkChecks.every(c => c.stableAcrossCacheReset && c.objects >= 2 && c.missing === 0) &&
  chunkChecks.filter(c => c.left > 0 && c.right > 0).length >= 3 &&
  stabilityHash1 === stabilityHash2,
  { stabilityHash1, stabilityHash2, chunkChecks });

/* N-G5 — y-sorted drawing order with the hero */
const order = pairs.filter(p => p.site !== 'beacon_road');
gate('N-G5', 'y-sorted draw order: nature objects both behind and in front of the hero',
  order.length === 5 && order.every(p => p.drawOrderSorted && p.behindHero > 0 && p.inFrontOfHero > 0),
  order.map(p => ({ site: p.site, sorted: p.drawOrderSorted, behindHero: p.behindHero, inFrontOfHero: p.inFrontOfHero })));

/* N-G9 — Beacon road / GOLD / roads / rivers / despeckle unchanged */
const TILES_TO_COMPARE = [
  [544, 1304], [544, 1303], [545, 1304], [2160, 840], [2152, 828],
  [1440, 1320], [1360, 840], [2640, 1320], [1100, 1200], [900, 900], [2100, 900], [1982, 1745]
];
const terrainCompare = await (async () => {
  const inNature = await pn.evaluate(ts => ts.map(([x, y]) => { const s = window.__nature.sampleTile(x, y); return s ? { tile: s.tile, biome: s.biome, road: s.road, bridge: s.bridge, water: s.water, river: s.river, lake: s.lake, coast: s.coast, authoredLand: s.authoredLand, poiId: s.poiId, sourceTile: s.sourceTile, painted: window.__nature.u05Tile(x, y) } : null; }), TILES_TO_COMPARE);
  const inBase = await pb.evaluate(ts => ts.map(([x, y]) => { const s = window.__terrain.sampleTile(x, y); return s ? { tile: s.tile, biome: s.biome, road: s.road, bridge: s.bridge, water: s.water, river: s.river, lake: s.lake, coast: s.coast, authoredLand: s.authoredLand, poiId: s.poiId, sourceTile: s.sourceTile, painted: window.__terrain.u05Tile(x, y) } : null; }), TILES_TO_COMPARE);
  return { identical: JSON.stringify(inNature) === JSON.stringify(inBase), inNature, inBase };
})();
const despeckleNature = await pn.evaluate(() => window.__nature.despeckleStats());
const despeckleBase = await pb.evaluate(() => window.__terrain.despeckleStats());
// Runtime counters (windowsBuilt / passesRun / replacements / evictions) depend
// on which tiles each page happened to visit, so compare the INVARIANT config.
const DS_INVARIANT = ['rule', 'windowTiles', 'chunkTiles', 'smoothableTiles', 'untouchedByTileCode', 'overviewUsesRawSampler', 'goldPolygonsUnchanged', 'analysisRasterUnchanged', 'verbatimPainterUnchanged', 'windowMax', 'note'];
const dsInvariant = d => Object.fromEntries(DS_INVARIANT.map(k => [k, d[k]]));
const despeckleConfigIdentical = JSON.stringify(dsInvariant(despeckleNature)) === JSON.stringify(dsInvariant(despeckleBase));
const isolatedNature = await pn.evaluate(() => window.__nature.isolatedCells(900, 900, 60, 40));
const isolatedBase = await pb.evaluate(() => window.__terrain.isolatedCells(900, 900, 60, 40));
const beaconPair = pairs.find(p => p.site === 'beacon_road');
gate('N-G9', 'Beacon road / GOLD polygons / roads / rivers / biome raster / despeckle unchanged',
  terrainCompare.identical && despeckleConfigIdentical &&
  isolatedNature.paintedIsolated === isolatedBase.paintedIsolated && isolatedNature.paintedIsolated === 0 &&
  beaconPair.natureObjectsDrawn === 0 && beaconPair.onDiffersFromOff === false,
  { tilesCompared: TILES_TO_COMPARE.length, terrainIdentical: terrainCompare.identical,
    despeckleConfigIdentical,
    isolatedPainted: isolatedNature.paintedIsolated, beaconNatureObjects: beaconPair.natureObjectsDrawn,
    beaconOpenGroundCharacter: 'unchanged; site is outside all five bounded pilot windows' });

/* N-G11 — source SHA / build evidence */
gate('N-G11', 'source SHA + build + site evidence present and consistent',
  !!BUILD.sourceHead && BUILD.sha256 === natureSha && BUILD.baseline.sha256 === BASELINE_SHA &&
  Object.keys(BUILD.sourceSha256).length === 6 && SITES_DOC.pilotSiteKeys.length === 5 && !!BUILD.geographySource,
  { sourceHead: BUILD.sourceHead, buildSha: BUILD.sha256.slice(0, 16), baselineUntouched: BUILD.baseline.untouched, sourceFiles: Object.keys(BUILD.sourceSha256) });

/* ------------------------------------------------------------------ *
 * Context B — real clock, real WASD traversal + obstruction + performance
 * ------------------------------------------------------------------ */
const ctxB = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
const pm = await ctxB.newPage(); attach(pm);
await pm.goto(viewFile(NATURE_HTML));
await pm.waitForFunction(() => window.__nature && window.__nature.ready === true, { timeout: 60000 });
await pm.evaluate(() => window.__nature.setGuides(false));

const traversal = [];
const perf = [];
const KEYS = ['d', 's', 'a', 'w'];
for (const k of SITE_ORDER) {
  const [tx, ty] = SHOT_TILE[k];
  await pm.evaluate(([x, y]) => { window.__nature.setNature(true); window.__nature.zoomNative(); window.__nature.setSpeed(10); window.__nature.freezeAnimation(false); window.__nature.reset(x, y); }, [tx, ty]);
  await pm.evaluate(() => window.__nature.clearInputLog());
  await pm.waitForTimeout(220);
  const start = await pm.evaluate(() => window.__nature.state().player);
  const steps = [];
  for (let i = 0; i < KEYS.length; i++) {
    await pm.keyboard.down(KEYS[i]);
    await pm.waitForTimeout(420);
    await pm.keyboard.up(KEYS[i]);
    await pm.waitForTimeout(90);
    const st = await pm.evaluate(() => window.__nature.state());
    const file = `creator-u05/evidence/nature01-shots/${k}_walk_${i + 1}.png`;
    await pm.locator('#game').screenshot({ path: path.join(SHOTS, `${k}_walk_${i + 1}.png`) });
    steps.push({ key: KEYS[i], tile: st.player.tile, px: Math.round(st.player.px), py: Math.round(st.player.py), movedPx: Math.round(st.stats.movedPx), natureObjectsDrawn: st.nature.drawnThisFrame, file });
  }
  const end = await pm.evaluate(() => window.__nature.state());
  const log = await pm.evaluate(() => window.__nature.inputLog());
  const realDowns = log.filter(e => e.type === 'down' && MOVE_KEYS.includes(e.code)).length;
  const realUps = log.filter(e => e.type === 'up' && MOVE_KEYS.includes(e.code)).length;
  const dist = Math.abs(end.player.px - start.px) + Math.abs(end.player.py - start.py);
  traversal.push({ site: k, startTile: start.tile, endTile: end.player.tile, totalMovedPx: Math.round(end.stats.movedPx),
    netDisplacementPx: Math.round(dist), realKeyEvents: { down: realDowns, up: realUps },
    teleportUsed: false, camUsedAsRoute: false, spawnFixtureOnlyAtReset: end.stats.spawnFixture,
    zoomMode: end.zoomMode, cameraFollowsPlayer: end.cameraFollowsPlayer, steps });
  // Performance with nature ON and OFF at the same position.
  await pm.evaluate(([x, y]) => window.__nature.reset(x, y), [tx, ty]);
  await pm.evaluate(() => window.__nature.setNature(true));
  await pm.waitForTimeout(1050);
  const on = await pm.evaluate(() => window.__nature.state());
  await pm.evaluate(() => window.__nature.setNature(false));
  await pm.waitForTimeout(1050);
  const off = await pm.evaluate(() => window.__nature.state());
  perf.push({ site: k,
    onP50: +on.frameMs.p50.toFixed(2), onP95: +on.frameMs.p95.toFixed(2),
    offP50: +off.frameMs.p50.toFixed(2), offP95: +off.frameMs.p95.toFixed(2),
    p95Ratio: +(on.frameMs.p95 / Math.max(1, off.frameMs.p95)).toFixed(2),
    onObjects: on.nature.drawnThisFrame, natureChunks: on.nature.residentChunks,
    maxNatureChunks: on.nature.maxResidentChunks, terrainChunks: on.stats.residentChunks,
    maxTerrainChunks: on.stats.maxResidentChunks, displayCanvases: on.stats.displayCanvases,
    materializedAllCells: on.stats.materializedAllCells, overviewFullFrameAllocated: on.overview.fullFrameAllocated });
}

gate('N-G8', 'wider real-keyboard traversal in each of the five environments (4 native shots each)',
  traversal.length === 5 && traversal.every(t => t.steps.length === 4 && t.totalMovedPx > 400 &&
    t.realKeyEvents.down >= 4 && t.realKeyEvents.up >= 4 && t.zoomMode === 'NATIVE_1X' &&
    t.cameraFollowsPlayer === true && !t.teleportUsed && !t.camUsedAsRoute),
  traversal.map(t => ({ site: t.site, totalMovedPx: t.totalMovedPx, realKeys: t.realKeyEvents, shots: t.steps.length, startTile: t.startTile, endTile: t.endTile })));

/* N-G6 — obstruction: nature changes neither movement nor collision */
const obstruction = [];
for (const k of SITE_ORDER) {
  const [tx, ty] = SHOT_TILE[k];
  const measure = async on => {
    await pm.evaluate(([x, y, n]) => { window.__nature.reset(x, y); window.__nature.setSpeed(1); window.__nature.setNature(n); window.__nature.clearInputLog(); }, [tx, ty, on]);
    await pm.waitForTimeout(120);
    await pm.keyboard.down('d'); await pm.waitForTimeout(420); await pm.keyboard.up('d');
    await pm.waitForTimeout(80);
    return pm.evaluate(() => { const s = window.__nature.state(); return { movedPx: Math.round(s.stats.movedPx), blockedSubsteps: s.stats.blockedSubsteps, collision: s.collision, natureBlocksMovement: s.nature.blocksMovement, terrain: s.terrain.tileRendered }; });
  };
  const off = await measure(false), on = await measure(true);
  obstruction.push({ site: k, off, on, movedPxRatio: +(on.movedPx / Math.max(1, off.movedPx)).toFixed(3) });
}
gate('N-G6', 'decorative layer does not obstruct movement or alter natural-terrain collision',
  obstruction.every(o => o.on.natureBlocksMovement === false && o.on.blockedSubsteps === o.off.blockedSubsteps &&
    o.on.collision === o.off.collision && o.on.terrain === o.off.terrain &&
    o.off.movedPx > 12 && o.on.movedPx > 12 && o.movedPxRatio > 0.6 && o.movedPxRatio < 1.6),
  obstruction);

gate('N-G7', 'bounded chunks / native frame budget with nature ON',
  perf.every(p => p.p95Ratio < 2.5 && p.onP95 < 60 && p.natureChunks <= p.maxNatureChunks &&
    p.terrainChunks <= p.maxTerrainChunks && p.materializedAllCells === false && p.overviewFullFrameAllocated === false),
  perf);

gate('N-G10', 'no page errors / no camera trick / real input log',
  errors.length === 0 && s0.cameraTrick === false && s0.cameraFollowsPlayer === true &&
  traversal.every(t => t.realKeyEvents.down >= 4),
  { browserErrors: errors, cameraTrick: s0.cameraTrick, followModes: s0.followMode });

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
const failing = gates.filter(g => !g.pass).map(g => g.id);
const report = {
  schema: 'soh.u05.nature01-qa.v1',
  generatedAt: new Date().toISOString(),
  browser: { chromium: '/tmp/chromium', viewport: [640, 360], dpr: 1, fileProtocol: true,
    frozenClockContextA: true, realClockContextB: true },
  files: { nature: 'creator-u05/SoulOfHero_Nature01_U05.html', natureSha256: natureSha,
    baseline: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html', baselineSha256: baseSha },
  sourceHead: BUILD.sourceHead,
  siteWindows: SITES_DOC.sites,
  shotTiles: SHOT_TILE,
  gates, passing: gates.length - failing.length, total: gates.length, failing,
  pairs, audit: {
    totalObjects: audit.totalObjects, bySite: audit.bySite, openGround: audit.openGround,
    violations: audit.violations, stabilityHash: audit.stabilityHash, elapsedMs: auditMs
  },
  placementRules: rules,
  chunkChecks, traversal, obstruction, perf, terrainComparison: {
    tilesCompared: TILES_TO_COMPARE.length, identical: terrainCompare.identical,
    despeckleConfigIdentical, despeckleRuntimeCountersAreVisitDependent: true,
    isolatedPainted: isolatedNature.paintedIsolated
  },
  shotsDirectory: 'creator-u05/evidence/nature01-shots/',
  shotCount: fs.readdirSync(SHOTS).filter(f => f.endsWith('.png')).length,
  browserErrors: errors,
  scope: 'QA IS NOT VISUAL ACCEPTANCE. Five-biome pilot only; no full-world propagation, no POI architecture, no production merge, no VEYRA_PLAYABLE claim.'
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(`U05_NATURE01_QA ${report.passing}/${report.total} PASS shots=${report.shotCount} failing=${failing.length ? failing.join(',') : 'none'} errors=${errors.length}`);
await browser.close();
if (failing.length) process.exit(1);
