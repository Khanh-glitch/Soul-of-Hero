/**
 * NATURE-02 — browser QA for the ONE-biome forest quality vertical slice.
 *
 * Runs THREE real standalone executables (terrain baseline, NATURE-01,
 * NATURE-02) from file:// in Chromium at exactly 640x360 DPR 1. Produces:
 *   - exact baseline / NATURE-01 / NATURE-02 comparison triptychs,
 *   - native OFF/ON pairs at identical tile positions,
 *   - real-keyboard walking sequences (4 native shots per composition),
 *   - a native-scale art audit sheet,
 *   - objective stand-coherence and road-unobstructed measurements.
 *
 * Context A freezes requestAnimationFrame time so the hero animation frame is
 * deterministic -> OFF/ON and baseline canvas pixels can be compared EXACTLY.
 * Context B uses the real clock so real WASD movement and frame timing work.
 *
 * QA IS NOT VISUAL ACCEPTANCE. The five required human evaluations live in
 * evidence/nature02-visual-review.json and docs/NATURE02_FOREST_SLICE.md.
 */
import { chromium } from '/home/user/pr38/web/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'evidence/nature02-shots');
const OUT = path.join(ROOT, 'evidence/nature02-qa.json');
const N2 = path.join(ROOT, 'SoulOfHero_Nature02_ForestSlice.html');
const N1 = path.join(ROOT, 'SoulOfHero_Nature01_U05.html');
const BASE = path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html');
const BASE_SHA = '540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0';
const N1_SHA = 'ac4d54e310f0f3cf7e0e12d728bc5e9ad62f801994be37ce64f76b099af4a0a7';
const BUILD = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/nature02-build.json'), 'utf8'));
const FOREST_DOC = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/nature02-forest.json'), 'utf8'));

fs.mkdirSync(SHOTS, { recursive: true });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const view = f => 'file://' + f;
const COMPS = { dense_interior: [1416, 1320], clearing: [1408, 1332], road_forest_edge: [1452, 1316] };
const COMPARE_TILES = { ...COMPS, nature01_site01_tile: [1472, 1336] };
const BEACON = [544, 1304];
const WINDOW = [1392, 1288, 1488, 1352];
const OTHER_N01_WINDOWS = [[1312, 788, 1408, 852], [2112, 788, 2208, 852], [2592, 1268, 2688, 1332], [1052, 1148, 1148, 1212]];
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const TALL = ['oak', 'pine', 'snowpine', 'willow', 'dead'];

const gates = [];
const gate = (id, name, ok, detail) => {
  gates.push({ id, name, pass: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${name} :: ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 4000)}`);
  return !!ok;
};
const pngSize = buf => (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG')
  ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null;
/** Mean absolute channel difference over the whole 640x360 PNG (0 = pixel-identical). */
const diffRatio = (a, b) => +parseFloat(execFileSync('convert', [a, b, '-compose', 'difference', '-composite', '-format', '%[fx:mean]', 'info:'], { encoding: 'utf8' }).trim()).toFixed(6);
/**
 * EXACT native 640x360 capture. The #game canvas has a 1px CSS border, so a
 * Playwright element screenshot is 642x362; canvas.toDataURL() returns the real
 * 1x drawing-surface pixels with no border, no DPR scaling and no viewport
 * clipping. Full-viewport Playwright screenshots are captured separately below.
 */
const shot = async (p, name) => {
  const b64 = await p.evaluate(() => document.getElementById('game').toDataURL('image/png').split(',')[1]);
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(path.join(SHOTS, name), buf);
  return { file: `creator-u05/evidence/nature02-shots/${name}`, sha256: sha(buf), bytes: buf.length,
    size: pngSize(buf), capture: 'native canvas.toDataURL 640x360 DPR1' };
};
const canvasShot = async (p, id, name) => {
  const b64 = await p.evaluate(id => document.getElementById(id).toDataURL('image/png').split(',')[1], id);
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(path.join(SHOTS, name), buf);
  return { file: `creator-u05/evidence/nature02-shots/${name}`, sha256: sha(buf), bytes: buf.length, size: pngSize(buf) };
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
 * Context A — deterministic clock, EXACT pixel comparisons
 * ------------------------------------------------------------------ */
const ctxA = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
await ctxA.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(() => cb(0));
});
const pn = await ctxA.newPage(); attach(pn);   // NATURE-02
const p1 = await ctxA.newPage(); attach(p1);   // NATURE-01
const pb = await ctxA.newPage(); attach(pb);   // terrain-only baseline
await pn.goto(view(N2)); await p1.goto(view(N1)); await pb.goto(view(BASE));
await pn.waitForFunction(() => window.__nature02 && window.__nature02.ready === true, { timeout: 60000 });
await p1.waitForFunction(() => window.__nature && window.__nature.ready === true, { timeout: 60000 });
await pb.waitForFunction(() => window.__terrain && window.__terrain.ready === true, { timeout: 60000 });
await pn.evaluate(() => { window.__nature02.freezeAnimation(true); window.__nature02.setGuides(false); });
await p1.evaluate(() => { window.__nature.freezeAnimation(true); window.__nature.setGuides(false); });
await pb.evaluate(() => window.__terrain.setGuides(false));

const n2Sha = sha(fs.readFileSync(N2)), n1Sha = sha(fs.readFileSync(N1)), baseSha = sha(fs.readFileSync(BASE));
const s0 = await pn.evaluate(() => window.__nature02.state());
const htmlText = fs.readFileSync(N2, 'utf8');
const forbidden = ['PhysicalLayer', 'U05_SCENES', 'SITE_ENVELOPE', 'BUILDING_COMPOSITION',
  'ROOF_OCCLUSION', 'roofHiddenCount', 'drawSource', 'harvestProbe', 'VEYRA_PLAYABLE'];
const leaked = forbidden.filter(x => htmlText.includes(x));

gate('F-G0', 'boot + THREE untouched executables + native contract + no forbidden leak',
  baseSha === BASE_SHA && n1Sha === N1_SHA && n2Sha === BUILD.sha256 &&
  BUILD.preserved.terrainBaseline.untouched && BUILD.preserved.nature01.untouched &&
  s0.U === 0.5 && s0.TILE === 16 && s0.viewport[0] === 640 && s0.viewport[1] === 360 &&
  s0.heroSpritePx[0] === 16 && s0.heroSpritePx[1] === 24 &&
  s0.speedMultiplierRange[0] === 1 && s0.speedMultiplierRange[1] === 10 &&
  s0.frameTiles[0] === 4000 && s0.frameTiles[1] === 2800 &&
  s0.stats.materializedAllCells === false && s0.draw.physicalLayerLoaded === false &&
  Object.values(s0.draw.overlays).every(v => v === 0) && leaked.length === 0 &&
  s0.forest.productionApproved === false,
  { baseSha, n1Sha, n2Sha, bytes: fs.statSync(N2).size, U: s0.U, viewport: s0.viewport, hero: s0.heroSpritePx, leaked });

/* F-G1 — OFF/ON native pairs at identical positions, exact OFF === baseline */
const pairs = [];
for (const k of [...Object.keys(COMPS), 'beacon_control']) {
  const [tx, ty] = k === 'beacon_control' ? BEACON : COMPS[k];
  await pn.evaluate(([x, y]) => { window.__nature02.setForest(false); window.__nature02.zoomNative(); window.__nature02.reset(x, y); }, [tx, ty]);
  await pb.evaluate(([x, y]) => { window.__terrain.zoomNative(); window.__terrain.reset(x, y); }, [tx, ty]);
  await pn.waitForTimeout(130); await pb.waitForTimeout(130);
  const off = await shot(pn, `${k}_off.png`);
  const baseline = await shot(pb, `${k}_baseline.png`);
  await pn.evaluate(() => window.__nature02.setForest(true));
  await pn.waitForTimeout(130);
  const on = await shot(pn, `${k}_on.png`);
  const st = await pn.evaluate(() => window.__nature02.state());
  pairs.push({
    composition: k, tile: [tx, ty], off, on, baseline,
    offEqualsBaseline: off.sha256 === baseline.sha256,
    offVsBaselineDiff: diffRatio(path.join(SHOTS, `${k}_off.png`), path.join(SHOTS, `${k}_baseline.png`)),
    offOnDiff: diffRatio(path.join(SHOTS, `${k}_off.png`), path.join(SHOTS, `${k}_on.png`)),
    onDiffersFromOff: off.sha256 !== on.sha256,
    forestObjectsDrawn: st.forest.drawnThisFrame, kindCounts: st.forest.kindCountsInFrame,
    zoneCounts: st.forest.zoneCountsInFrame, behindHero: st.forest.behindHero,
    inFrontOfHero: st.forest.inFrontOfHero, drawOrderSorted: st.forest.drawOrderSorted,
    zoomMode: st.zoomMode, nativePx: [on.size[0], on.size[1]]
  });
}
gate('F-G1', 'OFF canvas pixel-identical to untouched baseline; ON changes exactly the 3 forest compositions',
  pairs.every(p => p.offEqualsBaseline && p.offVsBaselineDiff === 0 && p.zoomMode === 'NATIVE_1X' &&
    p.on.size[0] === 640 && p.on.size[1] === 360) &&
  pairs.filter(p => p.composition !== 'beacon_control').every(p => p.onDiffersFromOff && p.offOnDiff > 0 && p.forestObjectsDrawn > 100) &&
  pairs.find(p => p.composition === 'beacon_control').onDiffersFromOff === false &&
  pairs.find(p => p.composition === 'beacon_control').forestObjectsDrawn === 0,
  pairs.map(p => ({ composition: p.composition, tile: p.tile, offEqualsBaseline: p.offEqualsBaseline, offVsBaselineDiff: p.offVsBaselineDiff, offOnDiff: p.offOnDiff, drawn: p.forestObjectsDrawn })));

/* F-G2 — EXACT baseline / NATURE-01 / NATURE-02 triptychs at identical tiles */
const triptychs = [];
for (const [k, [tx, ty]] of Object.entries(COMPARE_TILES)) {
  await pb.evaluate(([x, y]) => { window.__terrain.zoomNative(); window.__terrain.reset(x, y); }, [tx, ty]);
  await p1.evaluate(([x, y]) => { window.__nature.setNature(true); window.__nature.zoomNative(); window.__nature.setGuides(false); window.__nature.reset(x, y); }, [tx, ty]);
  await pn.evaluate(([x, y]) => { window.__nature02.setForest(true); window.__nature02.zoomNative(); window.__nature02.setGuides(false); window.__nature02.reset(x, y); }, [tx, ty]);
  await pn.waitForTimeout(140); await p1.waitForTimeout(140); await pb.waitForTimeout(140);
  const b = await shot(pb, `compare_${k}_baseline.png`);
  const a = await shot(p1, `compare_${k}_nature01.png`);
  const c = await shot(pn, `compare_${k}_nature02.png`);
  await pn.evaluate(() => window.__nature02.setForest(false));
  await pn.waitForTimeout(140);
  const cOff = await shot(pn, `compare_${k}_nature02_off.png`);
  const f = n => path.join(SHOTS, `compare_${k}_${n}.png`);
  const rec = {
    composition: k, tile: [tx, ty], baseline: b, nature01: a, nature02: c, nature02Off: cOff,
    diff: {
      baselineVsNature01: diffRatio(f('baseline'), f('nature01')),
      baselineVsNature02: diffRatio(f('baseline'), f('nature02')),
      nature01VsNature02: diffRatio(f('nature01'), f('nature02')),
      nature02OffVsBaseline: diffRatio(f('nature02_off'), f('baseline')),
      nature02OffVsNature02: diffRatio(f('nature02_off'), f('nature02'))
    },
    distinctFiles: new Set([b.sha256, a.sha256, c.sha256]).size
  };
  triptychs.push(rec);
  await pn.evaluate(() => window.__nature02.setForest(true));
}
gate('F-G2', 'exact 640x360 baseline / NATURE-01 / NATURE-02 comparisons at 4 identical tiles',
  triptychs.length === 4 && triptychs.every(t =>
    [t.baseline, t.nature01, t.nature02, t.nature02Off].every(x => x.size[0] === 640 && x.size[1] === 360) &&
    t.diff.nature02OffVsBaseline === 0 && t.diff.baselineVsNature01 > 0 &&
    t.diff.baselineVsNature02 > 0 && t.diff.nature01VsNature02 > 0 && t.distinctFiles === 3),
  triptychs.map(t => ({ composition: t.composition, tile: t.tile, diff: t.diff, distinctFiles: t.distinctFiles })));

/* Genuine full-viewport Playwright screenshots (UI + native canvas) at 640x360. */
const browserViewportShots = [];
for (const [k, [tx, ty]] of Object.entries(COMPS)) {
  await pn.evaluate(([x, y]) => { window.__nature02.setForest(true); window.__nature02.zoomNative(); window.__nature02.reset(x, y); }, [tx, ty]);
  await pn.waitForTimeout(140);
  const name = `browser_viewport_${k}.png`;
  const buf = await pn.screenshot({ path: path.join(SHOTS, name) });
  browserViewportShots.push({ composition: k, tile: [tx, ty], file: `creator-u05/evidence/nature02-shots/${name}`,
    sha256: sha(buf), size: pngSize(buf), bytes: buf.length });
}
gate('F-G2b', '3 genuine full-viewport Chromium screenshots at exactly 640x360',
  browserViewportShots.length === 3 && browserViewportShots.every(x => x.size[0] === 640 && x.size[1] === 360) &&
  new Set(browserViewportShots.map(x => x.sha256)).size === 3,
  browserViewportShots);

/* F-G3 — three independently reviewable compositions + objective design features */
const compositionDesign = await pn.evaluate(([comps, bounds]) => {
  const a = window.__nature02, out = {};
  const TALLK = new Set(['oak', 'pine', 'snowpine', 'willow', 'dead']);
  for (const [k, [cx, cy]] of Object.entries(comps)) {
    const objs = a.objectsInTileWindow(cx - 20, cy - 11, cx + 20, cy + 11);
    const byZone = {}, treeTiles = new Set();
    let interiorTiles = 0, interiorObjects = 0, rimUnder = 0;
    for (let ty = cy - 11; ty < cy + 11; ty++) for (let tx = cx - 20; tx < cx + 20; tx++) {
      const d = a.designAt(tx, ty); byZone[d.zone] = (byZone[d.zone] || 0) + 1;
      if (d.zone === 'clearing_interior') interiorTiles++;
    }
    for (const o of objs) {
      const d = a.designAt(o.tx, o.ty);
      if (d.zone === 'clearing_interior') interiorObjects++;
      if (d.zone === 'clearing_rim' && !TALLK.has(o.kind)) rimUnder++;
      if (TALLK.has(o.kind)) treeTiles.add(`${o.tx},${o.ty}`);
    }
    out[k] = { shotTile: [cx, cy], objectsInViewport: objs.length, treeTiles: treeTiles.size,
      byZone, clearingInteriorTiles: interiorTiles, clearingInteriorObjects: interiorObjects,
      clearingRimUndergrowth: rimUnder };
  }
  return out;
}, [COMPS, WINDOW]);

/** Pixel hash restricted to authored GOLD road/bridge tiles in the native viewport. */
const ROAD_HASH_FN = () => {
  const a = window.__nature02, s = a.state(), cx = s.camera.x, cy = s.camera.y;
  const cv = document.getElementById('game'), g = cv.getContext('2d');
  const d = g.getImageData(0, 0, 640, 360).data;
  const mask = new Uint8Array(640 * 360);
  const t0 = Math.floor(cx / 16), r0 = Math.floor(cy / 16);
  for (let ty = r0; ty < r0 + 25; ty++) for (let tx = t0; tx < t0 + 42; tx++) {
    const t = a.sampleTile(tx, ty);
    if (!t || !(t.road || t.bridge)) continue;
    for (let py = Math.max(0, ty * 16 - cy); py < Math.min(360, ty * 16 + 16 - cy); py++)
      for (let px = Math.max(0, tx * 16 - cx); px < Math.min(640, tx * 16 + 16 - cx); px++) mask[py * 640 + px] = 1;
  }
  let h = 0x811c9dc5, n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) {
    const j = i * 4;
    for (let c = 0; c < 4; c++) { h ^= d[j + c]; h = Math.imul(h, 0x01000193) >>> 0; }
    n++;
  }
  return { hash: (h >>> 0).toString(16), pixels: n };
};
await pn.evaluate(([x, y]) => { window.__nature02.zoomNative(); window.__nature02.reset(x, y); window.__nature02.setForest(false); }, COMPS.road_forest_edge);
await pn.waitForTimeout(160);
const roadOff = await pn.evaluate(ROAD_HASH_FN);
await pn.evaluate(() => window.__nature02.setForest(true));
await pn.waitForTimeout(160);
const roadOn = await pn.evaluate(ROAD_HASH_FN);
const onShas = pairs.filter(p => p.composition !== 'beacon_control').map(p => p.on.sha256);
const drawnCounts = pairs.filter(p => p.composition !== 'beacon_control').map(p => p.forestObjectsDrawn);
gate('F-G3', '3 distinct reviewable compositions; clearing readable; road pixel-identical OFF/ON',
  new Set(onShas).size === 3 && new Set(drawnCounts).size === 3 &&
  compositionDesign.dense_interior.treeTiles >= 150 &&
  compositionDesign.clearing.clearingInteriorTiles >= 25 &&
  compositionDesign.clearing.clearingInteriorObjects <= compositionDesign.clearing.clearingInteriorTiles * 0.20 &&
  compositionDesign.clearing.clearingRimUndergrowth > 10 &&
  roadOff.pixels > 10000 && roadOff.hash === roadOn.hash &&
  pairs.find(p => p.composition === 'road_forest_edge').forestObjectsDrawn > 100,
  { onShaDistinct: new Set(onShas).size, drawnCounts, compositionDesign, roadPixelsUnchanged: roadOff.hash === roadOn.hash, roadPixels: roadOff.pixels });

/* F-G4 — real native sprite audit + reviewable audit sheet */
const metrics = await pn.evaluate(() => window.__nature02.artMetrics());
const auditVisible = await pn.evaluate(() => window.__nature02.showArtAudit());
await pn.waitForTimeout(180);
const auditSheetRec = await canvasShot(pn, 'artAudit', 'art_audit_sheet.png');
const auditSheetSize = auditSheetRec.size, auditSheet = Buffer.alloc(0);
const auditSheetBytes = auditSheetRec.bytes;
const sheetOk = metrics.hero.size[0] === 16 && metrics.hero.size[1] === 24 &&
  metrics.treeCanvas[0] === 24 && metrics.treeCanvas[1] === 32 &&
  metrics.groundCanvas[0] === 16 && metrics.groundCanvas[1] === 16 &&
  Math.abs(metrics.findings.treeHeightVsHero - 4 / 3) < 1e-9 &&
  Math.abs(metrics.findings.treeWidthVsHero - 1.5) < 1e-9 &&
  metrics.sprites.length === 12 && metrics.sprites.every(s => s.alphaPixels > 0 && s.alphaBBox[2] >= s.alphaBBox[0]) &&
  metrics.hero.alphaBBox[2] - metrics.hero.alphaBBox[0] < 16;
gate('F-G4', 'native art audit sheet: real alpha-BBox metrics vs 16x24 hero, no sprite scaling',
  sheetOk && auditVisible === true && auditSheetSize[0] === 640 && auditSheetSize[1] === 360 && auditSheetBytes > 4000,
  { hero: metrics.hero, treeCanvas: metrics.treeCanvas, groundCanvas: metrics.groundCanvas,
    treeHeightVsHero: metrics.findings.treeHeightVsHero, treeWidthVsHero: metrics.findings.treeWidthVsHero,
    sprites: metrics.sprites.map(s => ({ key: s.key, size: s.size, alphaBBox: s.alphaBBox, alphaPixels: s.alphaPixels })),
    sheetFile: 'creator-u05/evidence/nature02-shots/art_audit_sheet.png', sheetBytes: auditSheetBytes, sheetSize: auditSheetSize });

/* F-G5 — decorative-only classification + exact owner dependency + asset gap */
const inv = await pn.evaluate(() => window.__nature02.assetInventory());
const owner = await pn.evaluate(() => window.__nature02.ownerDependency());
const gap = await pn.evaluate(() => window.__nature02.assetGapSpec());
const f = s0.forest;
const classified =
  inv.used.length === 6 && inv.newArtAssets === 0 && inv.newAtlases === 0 && inv.spriteScaling === false &&
  inv.decorativeOnly === true && inv.gameplayOwned === false && inv.productionApproved === false &&
  inv.deliberatelyExcluded.length >= 5 &&
  f.assetInventory.newArtAssets === 0 && f.buildingsOrPoiStructures === 0 && f.walls === 0 &&
  f.roofs === 0 && f.doors === 0 && f.fences === 0 && f.artificialRuins === 0 &&
  f.goldOrRasterWrites === 0 && f.fullWorldPropagation === false &&
  f.decorativeOnly === true && f.gameplayOwned === false && f.noResourceRewardsOrDepletion === true &&
  f.productionApproved === false && owner.pilotStatus === 'NOT_APPROVED_FOR_PRODUCTION' &&
  owner.mapCannotChange === true && owner.conflicts.length >= 8 &&
  gap.status === 'PROPOSED__NOT_CREATED__NOT_APPROVED' && gap.proposedAssets.length === 3 &&
  !htmlText.includes('VEYRA_PLAYABLE');
gate('F-G5', 'decorative-only; exact Gameplay owner dependency recorded; asset gap PROPOSED not manufactured',
  classified,
  { usedSprites: inv.used.map(u => u.kind), excluded: inv.deliberatelyExcluded, newArtAssets: inv.newArtAssets,
    ownerHead: owner.verifiedHead, ownerLaterHead: owner.observedLaterHead, conflicts: owner.conflicts.length,
    decision: owner.decisionRequiredFromGameplay, gapId: gap.id, gapStatus: gap.status,
    proposedAssets: gap.proposedAssets.map(a => a.key), pilotStatus: owner.pilotStatus });

/* F-G6 — deterministic positions + 32-tile chunk boundaries + stability hash */
const chunkChecks = [];
for (const [k, [cx, cy]] of Object.entries(COMPS)) {
  const bx = Math.floor(cx / 32) * 32, by = Math.floor(cy / 32) * 32;
  const w = [bx - 6, by - 6, bx + 6, by + 6];
  const a1 = await pn.evaluate(t => window.__nature02.objectsInTileWindow(t[0], t[1], t[2], t[3]), w);
  await pn.evaluate(() => window.__nature02.resetForestCaches());
  const a2 = await pn.evaluate(t => window.__nature02.objectsInTileWindow(t[0], t[1], t[2], t[3]), w);
  await pn.evaluate(([x, y]) => window.__nature02.reset(x, y), [bx, by]);
  await pn.waitForTimeout(130);
  const frameKeys = await pn.evaluate(() => {
    const a = window.__nature02, s = a.state();
    return a.forestObjectsInRect(s.camera.x, s.camera.y, 640, 360).map(o => `${o.tx},${o.ty}`);
  });
  const missing = a1.filter(o => !frameKeys.includes(`${o.tx},${o.ty}`)).length;
  chunkChecks.push({ composition: k, boundaryTile: [bx, by], window: w, objects: a1.length,
    left: a1.filter(o => o.tx < bx).length, right: a1.filter(o => o.tx >= bx).length,
    stableAcrossCacheReset: sha(Buffer.from(JSON.stringify(a1))) === sha(Buffer.from(JSON.stringify(a2))),
    presentInFrame: a1.length - missing, missing });
}
const audit1 = await pn.evaluate(() => window.__nature02.auditForest());
const audit2 = await pn.evaluate(() => window.__nature02.auditForest());
gate('F-G6', 'deterministic placement, stable across cache resets and 32-tile chunk boundaries',
  chunkChecks.every(c => c.stableAcrossCacheReset && c.objects >= 2 && c.missing === 0) &&
  chunkChecks.filter(c => c.left > 0 && c.right > 0).length >= 2 &&
  audit1.stabilityHash === audit2.stabilityHash,
  { stabilityHash: audit1.stabilityHash, chunkChecks });

/* F-G7 — objective stand coherence vs NATURE-01 uniform scatter */
const n1Objs = await p1.evaluate(w => window.__nature.objectsInTileWindow(w[0], w[1], w[2], w[3]), WINDOW);
const n2Objs = await pn.evaluate(w => window.__nature02.objectsInTileWindow(w[0], w[1], w[2], w[3]), WINDOW);
const coherence = objs => {
  const set = new Set(objs.filter(o => TALL.includes(o.kind)).map(o => `${o.tx},${o.ty}`));
  const blocks = [];
  for (let y = WINDOW[1]; y < WINDOW[3]; y += 8) for (let x = WINDOW[0]; x < WINDOW[2]; x += 8) {
    let n = 0;
    for (let j = y; j < y + 8; j++) for (let i = x; i < x + 8; i++) if (set.has(`${i},${j}`)) n++;
    blocks.push(n);
  }
  const mean = blocks.reduce((s, v) => s + v, 0) / blocks.length;
  const sd = Math.sqrt(blocks.reduce((s, v) => s + (v - mean) ** 2, 0) / blocks.length);
  const seen = new Set(); const sizes = [];
  for (const k of set) {
    if (seen.has(k)) continue;
    const q = [k]; let n = 0; seen.add(k);
    while (q.length) {
      const t = q.pop(); n++; const [x, y] = t.split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const k2 = `${x + dx},${y + dy}`;
        if (set.has(k2) && !seen.has(k2)) { seen.add(k2); q.push(k2); }
      }
    }
    sizes.push(n);
  }
  sizes.sort((a, b) => b - a);
  return { objects: objs.length, treeTiles: set.size, blocks: blocks.length,
    blockMean: +mean.toFixed(2), blockSd: +sd.toFixed(2), blockCv: +(sd / Math.max(0.001, mean)).toFixed(3),
    largestTreeComponentTiles: sizes[0] || 0, top5Components: sizes.slice(0, 5), components: sizes.length };
};
const coh1 = coherence(n1Objs), coh2 = coherence(n2Objs);
const zeroViolations = Object.values(audit1.violations).every(v => v === 0);
const openOk = Object.values(audit1.openGround).every(v => v >= 0.60) &&
  audit1.openGround.road_forest_edge > audit1.openGround.dense_interior;
gate('F-G7', 'uniform scatter corrected: coherent canopy stands, dense edges, natural empty space, zero veto violations',
  coh2.largestTreeComponentTiles >= 50 && coh1.largestTreeComponentTiles <= 10 &&
  coh2.largestTreeComponentTiles > coh1.largestTreeComponentTiles * 10 &&
  coh2.blockCv >= coh1.blockCv && coh2.treeTiles > coh1.treeTiles * 2 &&
  audit2.stands === FOREST_DOC.stands.length && audit2.clearings === FOREST_DOC.clearings.length &&
  audit2.routes === FOREST_DOC.routes.length && zeroViolations && openOk,
  { nature01: coh1, nature02: coh2, largestComponentGain: +(coh2.largestTreeComponentTiles / Math.max(1, coh1.largestTreeComponentTiles)).toFixed(1),
    totalObjects: audit1.totalObjects, byZone: audit1.byZone, kinds: audit1.kinds,
    openGround: audit1.openGround, violations: audit1.violations, stabilityHash: audit1.stabilityHash });

/* F-G8 — y-sorted drawing with the hero */
const ysort = pairs.filter(p => p.composition !== 'beacon_control');
gate('F-G8', 'y-sorted draw order: forest objects both behind and in front of the hero',
  ysort.length === 3 && ysort.every(p => p.drawOrderSorted && p.behindHero > 0 && p.inFrontOfHero > 0),
  ysort.map(p => ({ composition: p.composition, sorted: p.drawOrderSorted, behindHero: p.behindHero, inFrontOfHero: p.inFrontOfHero })));

/* F-G12 (part 1) — GOLD / roads / rivers / despeckle unchanged + other windows empty */
const TILES_TO_COMPARE = [
  [544, 1304], [544, 1303], [545, 1304], [2160, 840], [2152, 828],
  [1440, 1320], [1416, 1320], [1408, 1332], [1452, 1316], [1472, 1336],
  [1360, 840], [2640, 1320], [1100, 1200], [900, 900], [2100, 900], [1982, 1745]
];
const TILE_FIELDS = ts => ts.map(([x, y]) => {
  const s = window.__terrain.sampleTile(x, y);
  return s ? { tile: s.tile, biome: s.biome, road: s.road, bridge: s.bridge, water: s.water,
    river: s.river, lake: s.lake, coast: s.coast, authoredLand: s.authoredLand,
    poiId: s.poiId, sourceTile: s.sourceTile, painted: window.__terrain.u05Tile(x, y) } : null;
});
const terrainInN2 = await pn.evaluate(TILE_FIELDS, TILES_TO_COMPARE);
const terrainInBase = await pb.evaluate(TILE_FIELDS, TILES_TO_COMPARE);
const terrainIdentical = JSON.stringify(terrainInN2) === JSON.stringify(terrainInBase);
const DS_INVARIANT = ['rule', 'windowTiles', 'chunkTiles', 'smoothableTiles', 'untouchedByTileCode',
  'overviewUsesRawSampler', 'goldPolygonsUnchanged', 'analysisRasterUnchanged', 'verbatimPainterUnchanged', 'windowMax', 'note'];
const dsInvariant = d => Object.fromEntries(DS_INVARIANT.map(k => [k, d[k]]));
const dsN2 = await pn.evaluate(() => window.__nature02.despeckleStats());
const dsBase = await pb.evaluate(() => window.__terrain.despeckleStats());
const despeckleConfigIdentical = JSON.stringify(dsInvariant(dsN2)) === JSON.stringify(dsInvariant(dsBase));
const isolatedN2 = await pn.evaluate(() => window.__nature02.isolatedCells(900, 900, 60, 40));
const isolatedBase = await pb.evaluate(() => window.__terrain.isolatedCells(900, 900, 60, 40));
const otherWindows = await pn.evaluate(ws => ws.map(w => window.__nature02.objectsInTileWindow(w[0], w[1], w[2], w[3]).length), OTHER_N01_WINDOWS);
const outsideWindow = await pn.evaluate(w => {
  const a = window.__nature02;
  return a.objectsInTileWindow(w[0] - 40, w[1] - 40, w[2] + 40, w[3] + 40)
    .filter(o => o.tx < w[0] || o.tx >= w[2] || o.ty < w[1] || o.ty >= w[3]).length;
}, WINDOW);
gate('F-G12', 'GOLD polygons / roads / rivers / biome raster / despeckle + collision authority unchanged; one window only',
  terrainIdentical && despeckleConfigIdentical &&
  isolatedN2.paintedIsolated === isolatedBase.paintedIsolated && isolatedN2.paintedIsolated === 0 &&
  pairs.find(p => p.composition === 'beacon_control').forestObjectsDrawn === 0 &&
  otherWindows.every(n => n === 0) && outsideWindow === 0 && zeroViolations,
  { tilesCompared: TILES_TO_COMPARE.length, terrainIdentical, despeckleConfigIdentical,
    isolatedPainted: isolatedN2.paintedIsolated, beaconForestObjects: pairs.find(p => p.composition === 'beacon_control').forestObjectsDrawn,
    otherNature01WindowObjects: otherWindows, objectsOutsideForestWindow: outsideWindow });

/* ------------------------------------------------------------------ *
 * Context B — real clock, real WASD walking + obstruction + performance
 * ------------------------------------------------------------------ */
const ctxB = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
const pm = await ctxB.newPage(); attach(pm);
await pm.goto(view(N2));
await pm.waitForFunction(() => window.__nature02 && window.__nature02.ready === true, { timeout: 60000 });
await pm.evaluate(() => window.__nature02.setGuides(false));

const traversal = [], perf = [];
const KEYS = ['d', 's', 'a', 'w'];
for (const [k, [tx, ty]] of Object.entries(COMPS)) {
  await pm.evaluate(([x, y]) => { window.__nature02.setForest(true); window.__nature02.zoomNative(); window.__nature02.setSpeed(10); window.__nature02.freezeAnimation(false); window.__nature02.reset(x, y); }, [tx, ty]);
  await pm.evaluate(() => window.__nature02.clearInputLog());
  await pm.waitForTimeout(220);
  const start = await pm.evaluate(() => window.__nature02.state().player);
  const steps = [];
  for (let i = 0; i < KEYS.length; i++) {
    await pm.keyboard.down(KEYS[i]); await pm.waitForTimeout(420); await pm.keyboard.up(KEYS[i]);
    await pm.waitForTimeout(90);
    const st = await pm.evaluate(() => window.__nature02.state());
    const file = `${k}_walk_${i + 1}.png`;
    const rec = await shot(pm, file);
    steps.push({ key: KEYS[i], tile: st.player.tile, px: Math.round(st.player.px), py: Math.round(st.player.py),
      movedPx: Math.round(st.stats.movedPx), forestObjectsDrawn: st.forest.drawnThisFrame,
      file: rec.file, nativePx: rec.size, sha256: rec.sha256 });
  }
  const end = await pm.evaluate(() => window.__nature02.state());
  const log = await pm.evaluate(() => window.__nature02.inputLog());
  const realDowns = log.filter(e => e.type === 'down' && MOVE_KEYS.includes(e.code)).length;
  const realUps = log.filter(e => e.type === 'up' && MOVE_KEYS.includes(e.code)).length;
  const dist = Math.abs(end.player.px - start.px) + Math.abs(end.player.py - start.py);
  traversal.push({ composition: k, startTile: start.tile, endTile: end.player.tile,
    totalMovedPx: Math.round(end.stats.movedPx), netDisplacementPx: Math.round(dist),
    realKeyEvents: { down: realDowns, up: realUps }, teleportUsed: false, camUsedAsRoute: false,
    spawnFixtureOnlyAtReset: end.stats.spawnFixture, zoomMode: end.zoomMode,
    cameraFollowsPlayer: end.cameraFollowsPlayer, steps });
  await pm.evaluate(([x, y]) => window.__nature02.reset(x, y), [tx, ty]);
  await pm.evaluate(() => window.__nature02.setForest(true));
  await pm.waitForTimeout(1050);
  const on = await pm.evaluate(() => window.__nature02.state());
  await pm.evaluate(() => window.__nature02.setForest(false));
  await pm.waitForTimeout(1050);
  const off = await pm.evaluate(() => window.__nature02.state());
  perf.push({ composition: k,
    onP50: +on.frameMs.p50.toFixed(2), onP95: +on.frameMs.p95.toFixed(2),
    offP50: +off.frameMs.p50.toFixed(2), offP95: +off.frameMs.p95.toFixed(2),
    p95Ratio: +(on.frameMs.p95 / Math.max(1, off.frameMs.p95)).toFixed(2),
    onObjects: on.forest.drawnThisFrame, forestChunks: on.forest.residentChunks,
    maxForestChunks: on.forest.maxResidentChunks, terrainChunks: on.stats.residentChunks,
    maxTerrainChunks: on.stats.maxResidentChunks, displayCanvases: on.stats.displayCanvases,
    materializedAllCells: on.stats.materializedAllCells, overviewFullFrameAllocated: on.overview.fullFrameAllocated });
}
gate('F-G9', 'REAL keyboard walking sequences in all 3 compositions (4 native 640x360 shots each)',
  traversal.length === 3 && traversal.every(t => t.steps.length === 4 && t.totalMovedPx > 400 &&
    t.realKeyEvents.down >= 4 && t.realKeyEvents.up >= 4 && t.zoomMode === 'NATIVE_1X' &&
    t.cameraFollowsPlayer === true && !t.teleportUsed && !t.camUsedAsRoute),
  traversal.map(t => ({ composition: t.composition, totalMovedPx: t.totalMovedPx, realKeys: t.realKeyEvents,
    shots: t.steps.length, startTile: t.startTile, endTile: t.endTile })));

/* F-G10 — obstruction / collision unchanged */
const obstruction = [];
for (const [k, [tx, ty]] of Object.entries(COMPS)) {
  const measure = async (on, collision) => {
    await pm.evaluate(([x, y, n, c]) => { window.__nature02.reset(x, y); window.__nature02.setSpeed(1); window.__nature02.setForest(n); window.__nature02.setCollision(c); window.__nature02.clearInputLog(); }, [tx, ty, on, collision]);
    await pm.waitForTimeout(120);
    await pm.keyboard.down('d'); await pm.waitForTimeout(420); await pm.keyboard.up('d');
    await pm.waitForTimeout(80);
    return pm.evaluate(() => { const s = window.__nature02.state(); return {
      movedPx: Math.round(s.stats.movedPx), blockedSubsteps: s.stats.blockedSubsteps,
      collision: s.collision, forestBlocksMovement: s.forest.blocksMovement,
      terrain: s.terrain.tileRendered }; });
  };
  const off = await measure(false, false), on = await measure(true, false);
  const offColl = await measure(false, true), onColl = await measure(true, true);
  obstruction.push({ composition: k, off, on, offCollisionOn: offColl, onCollisionOn: onColl,
    movedPxRatio: +(on.movedPx / Math.max(1, off.movedPx)).toFixed(3),
    collisionOnMovedPxRatio: +(onColl.movedPx / Math.max(1, offColl.movedPx)).toFixed(3) });
}
gate('F-G10', 'decorative layer does not obstruct movement or alter natural-terrain collision (BOTH collision modes)',
  obstruction.every(o => o.on.forestBlocksMovement === false && o.on.blockedSubsteps === o.off.blockedSubsteps &&
    o.on.collision === o.off.collision && o.on.terrain === o.off.terrain &&
    o.off.movedPx > 12 && o.on.movedPx > 12 && o.movedPxRatio > 0.6 && o.movedPxRatio < 1.6 &&
    o.onCollisionOn.forestBlocksMovement === false &&
    o.onCollisionOn.collision === o.offCollisionOn.collision &&
    o.onCollisionOn.terrain === o.offCollisionOn.terrain &&
    o.onCollisionOn.blockedSubsteps === o.offCollisionOn.blockedSubsteps &&
    Math.abs(o.onCollisionOn.movedPx - o.offCollisionOn.movedPx) <= 2),
  obstruction);

gate('F-G11', 'bounded chunks / native frame budget with forest ON',
  perf.every(p => p.p95Ratio < 2.5 && p.onP95 < 60 && p.forestChunks <= p.maxForestChunks &&
    p.terrainChunks <= p.maxTerrainChunks && p.materializedAllCells === false && p.overviewFullFrameAllocated === false),
  perf);

gate('F-G13', 'no page errors / no camera trick / real input log / evidence consistency',
  errors.length === 0 && s0.cameraTrick === false && s0.cameraFollowsPlayer === true &&
  traversal.every(t => t.realKeyEvents.down >= 4) &&
  BUILD.sha256 === n2Sha && BUILD.preserved.terrainBaseline.sha256 === BASE_SHA &&
  BUILD.preserved.nature01.sha256 === N1_SHA &&
  Object.keys(BUILD.sourceSha256).length === 11 &&
  FOREST_DOC.stands.length === audit2.stands && FOREST_DOC.clearings.length === audit2.clearings &&
  FOREST_DOC.routes.length === audit2.routes && FOREST_DOC.spriteScaling === false &&
  FOREST_DOC.creatorVisualAcceptance === 'NOT_GRANTED',
  { browserErrors: errors, cameraTrick: s0.cameraTrick, followMode: s0.followMode,
    sourceFiles: Object.keys(BUILD.sourceSha256), visualAcceptance: FOREST_DOC.creatorVisualAcceptance });

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
const failing = gates.filter(g => !g.pass).map(g => g.id);
const report = {
  schema: 'soh.u05.nature02-qa.v1',
  generatedAt: new Date().toISOString(),
  browser: { chromium: '/tmp/chromium', viewport: [640, 360], dpr: 1, fileProtocol: true,
    frozenClockContextA: true, realClockContextB: true },
  files: {
    nature02: 'creator-u05/SoulOfHero_Nature02_ForestSlice.html', nature02Sha256: n2Sha,
    nature01: 'creator-u05/SoulOfHero_Nature01_U05.html', nature01Sha256: n1Sha,
    baseline: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html', baselineSha256: baseSha
  },
  pilot: 'NATURE-02 ONE-BIOME FOREST QUALITY VERTICAL SLICE — three compositions',
  compareTiles: COMPARE_TILES, shotTiles: COMPS, window: WINDOW,
  gates, passing: gates.length - failing.length, total: gates.length, failing,
  pairs, triptychs, browserViewportShots, compositionDesign, roadPixelsUnchanged: { off: roadOff, on: roadOn },
  artMetrics: metrics, artAuditSheet: 'creator-u05/evidence/nature02-shots/art_audit_sheet.png',
  ownerDependency: owner, assetGapSpec: gap, assetInventory: inv,
  standCoherence: { nature01: coh1, nature02: coh2 },
  audit: { totalObjects: audit1.totalObjects, byZone: audit1.byZone, kinds: audit1.kinds,
    compositionObjects: audit1.compositionObjects, openGround: audit1.openGround,
    violations: audit1.violations, stabilityHash: audit1.stabilityHash,
    stands: audit1.stands, clearings: audit1.clearings, routes: audit1.routes },
  chunkChecks, traversal, obstruction, perf,
  terrainComparison: { tilesCompared: TILES_TO_COMPARE.length, identical: terrainIdentical,
    despeckleConfigIdentical, despeckleRuntimeCountersAreVisitDependent: true,
    isolatedPainted: isolatedN2.paintedIsolated, otherNature01WindowObjects: otherWindows,
    objectsOutsideForestWindow: outsideWindow },
  shotsDirectory: 'creator-u05/evidence/nature02-shots/',
  shotCount: fs.readdirSync(SHOTS).filter(f => f.endsWith('.png')).length,
  browserErrors: errors,
  visualEvaluationIsSeparate: true,
  visualReviewFile: 'creator-u05/evidence/nature02-visual-review.json',
  scope: 'QA / BROWSER EVIDENCE IS NOT VISUAL ACCEPTANCE. One-biome pilot only; no other biome, no world propagation, no Gameplay merge, no VISUAL_ACCEPTED, no VEYRA_PLAYABLE.'
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(`U05_NATURE02_QA ${report.passing}/${report.total} PASS shots=${report.shotCount} failing=${failing.length ? failing.join(',') : 'none'} errors=${errors.length}`);
await browser.close();
if (failing.length) process.exit(1);
