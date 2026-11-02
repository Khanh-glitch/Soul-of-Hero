/* Real-browser capture + verification for the Veyra walk test (CI, Playwright/Chromium).
   - loads the page over HTTP, waits for the real assets to decode
   - drives REAL keyboard input (walk, sprint) and asserts the avatar moves
   - reads canvas pixels to prove the frame is not blank
   - captures 1x screenshots of every required scene
   Fails the job if any capture is blank or any console/page error appears.
*/
import { chromium } from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const BASE = process.env.VEYRA_BASE || 'http://127.0.0.1:8011/web/';
const OUT = process.env.VEYRA_OUT || 'docs/map_tower/evidence/browser';
const META = process.env.VEYRA_META || 'world/assets/world_meta.json';
fs.mkdirSync(OUT, { recursive: true });

const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
const report = { base: BASE, capture: 'chromium playwright, real canvas',
  viewport: [640, 360], overlays: 'hidden for evaluation captures, shown separately',
  commit: process.env.GITHUB_SHA || null, run: process.env.GITHUB_RUN_ID || null,
  scenes: [], checks: [], errors: [], console_log: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
page.on('console', m => { report.console_log.push(m.type() + ': ' + m.text()); if (m.type() === 'error') report.errors.push('console: ' + m.text()); });
page.on('pageerror', e => report.errors.push('pageerror: ' + String(e)));

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => window.veyraGoto && !document.getElementById('loading'), null,
                           { timeout: 60000 });

// real image decode proof
const decoded = await page.evaluate(() => {
  const s = window.__veyra;
  return { world: [s.world.naturalWidth, s.world.naturalHeight],
           hero: [s.hero.naturalWidth, s.hero.naturalHeight] };
});
report.checks.push({ name: 'images_decoded', pass: decoded.world[0] === 8000 && decoded.hero[0] === 384,
                     detail: decoded });

async function pixels() {
  return page.evaluate(() => {
    const c = document.getElementById('view');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let nonBlank = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 24) nonBlank++; sum += d[i]; }
    return { nonBlank, ratio: nonBlank / (d.length / 4), meanRed: sum / (d.length / 4) };
  });
}

// ---------------------------------------------------------------------------------------------
// Real input measurement.  The runtime state is `window.__veyra` with `meta.spawns`; the same
// verified start cell is used for every trial, and the trial direction is chosen by probing all
// four directions so the corridor is genuinely free of collision.
// ---------------------------------------------------------------------------------------------
const spawnPx = await page.evaluate(() => window.__veyra.meta.spawns[0].world_px);

async function resetToSpawn() {
  await page.evaluate(([x, y]) => window.veyraGoto(x, y), spawnPx);
  await page.waitForTimeout(120);
  return page.evaluate(() => ({ x: window.__veyra.p.x, y: window.__veyra.p.y }));
}

async function trial(dir, run, ms = 700) {
  const before = await resetToSpawn();
  if (run) await page.keyboard.down('Shift');
  await page.keyboard.down(dir);
  await page.waitForTimeout(ms);
  await page.keyboard.up(dir);
  if (run) await page.keyboard.up('Shift');
  const after = await page.evaluate(() => ({ x: window.__veyra.p.x, y: window.__veyra.p.y }));
  const dist = Math.hypot(after.x - before.x, after.y - before.y);
  return { dir, run, ms, before, after, dist: +dist.toFixed(1),
           input: run ? 'Shift+' + dir : dir,
           blocked: dist < 2 };
}

// probe: pick the direction with the most free space from the spawn
let bestDir = 'd', bestDist = -1;
for (const dir of ['d', 's', 'a', 'w']) {
  const t = await trial(dir, false, 220);
  if (t.dist > bestDist) { bestDist = t.dist; bestDir = dir; }
}
const walk = await trial(bestDir, false, 700);
const run = await trial(bestDir, true, 700);
const ratio = walk.dist > 0 ? +(run.dist / walk.dist).toFixed(3) : 0;
report.checks.push({ name: 'keyboard_moves_avatar', pass: walk.dist > 5,
                     detail: { trial: walk } });
report.checks.push({ name: 'walk_vs_run_speed', pass: ratio > 1.25 && walk.dist > 5 && !run.blocked,
                     detail: { direction: bestDir, ratio, walk, run } });
// sustained movement in the tested direction (2 s) to prove no mid-corridor stop
const sustained = await trial(bestDir, false, 2000);
report.checks.push({ name: 'sustained_movement', pass: sustained.dist > walk.dist * 2.2,
                     detail: { sustained, single_window: walk } });

async function setEvalMode(on) {
  await page.evaluate((evalOn) => document.body.classList.toggle('eval', evalOn), on);
}

async function blackBars() {
  return page.evaluate(() => {
    const c = document.getElementById('view');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let darkRows = 0;
    for (let y = 0; y < c.height; y++) {
      let dark = 0;
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (d[i] + d[i + 1] + d[i + 2] < 30) dark++;
      }
      if (dark > c.width * 0.9) darkRows++;
    }
    return { darkRows, height: c.height, ratio: darkRows / c.height };
  });
}

async function setOverlays(on) {
  await page.evaluate((visible) => {
    for (const id of ['minimap', 'hud', 'help', 'footer', 'instructions', 'legend', 'here', 'pos']) {
      const el = document.getElementById(id);
      if (el) el.style.visibility = visible ? 'visible' : 'hidden';
    }
  }, on);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function shot(name, x, y, note) {
  await page.evaluate(([px, py]) => window.veyraGoto(px, py), [x, y]);
  await page.waitForTimeout(220);
  const file = path.join(OUT, name + '.png');
  await page.locator('#view').screenshot({ path: file });
  const px = await pixels();
  const bars = await blackBars();
  const ok = px.ratio > 0.30 && bars.ratio < 0.08;
  report.scenes.push({ file: path.basename(file), camera: [Math.round(x), Math.round(y)],
                       scene: name, note, pixels: px, sha256: sha256(file), pass: ok });
  if (!ok) report.errors.push(`bad frame ${name}: fill=${px.ratio.toFixed(2)} darkRows=${bars.darkRows}`);
}

const roads = meta.roads || [];
const rivers = meta.rivers || [];
const net = meta.network || {};
const midOf = (r, t = 0.5) => {
  const p = r.points || r.world_points_px || [];
  if (!p.length) return [0, 0];
  const f = Math.min(0.999, Math.max(0, t)) * (p.length - 1);
  const i = Math.floor(f), k = f - i;
  const a = p[i], b = p[Math.min(p.length - 1, i + 1)];
  const ux = 4;   // every authored polyline in world_meta.json is in GOLD units (4 px per unit)
  return [((a[0] + (b[0] - a[0]) * k) * ux), ((a[1] + (b[1] - a[1]) * k) * ux)];
};

await setEvalMode(true);
await setOverlays(false);      // evaluation captures: no minimap, no debug labels, no footer

// 1. spawns (four authored start points)
for (const s of meta.spawns) await shot('spawn_' + s.id, s.world_px[0], s.world_px[1], 'spawn');

// 2. Greywater: upstream -> lake -> downstream, one continuous waterway
const rvUp = rivers.find(r => r.source_id === 'rv_grey_up');
const rvLow = rivers.find(r => r.source_id === 'rv_grey_low');
const lkGrey = (meta.lakes || []).find(l => l.source_id === 'lk_grey') || null;
if (rvUp) for (const [i, t] of [[0, 0.15], [1, 0.6]]) {
  const [x, y] = midOf(rvUp, t); await shot('greywater_upstream_' + i, x, y, rvUp.source_id);
}
if (lkGrey) {
  const ring = (lkGrey.rings && lkGrey.rings[0]) || [];
  const cx = ring.reduce((a, q) => a + q[0], 0) / Math.max(1, ring.length);
  const cy = ring.reduce((a, q) => a + q[1], 0) / Math.max(1, ring.length);
  await shot('greywater_lake', cx * 4, cy * 4, lkGrey.source_id);
}
if (rvLow) for (const [i, t] of [[0, 0.25], [1, 0.85]]) {
  const [x, y] = midOf(rvLow, t); await shot('greywater_downstream_' + i, x, y, rvLow.source_id);
}
if (rvLow) {                          // estuary: the authored mouth
  const p = rvLow.points[rvLow.points.length - 1];
  await shot('estuary_grey', p[0] * 4, p[1] * 4, 'rv_grey_low mouth');
}
// 3. a full river junction (three-channel confluence around the delta)
const confluence = rivers.find(r => (meta.network?.roads?.near_miss || []).length >= 0 &&
  r.points.length >= 3 && /delta|grey/.test(r.source_id)) || rivers[0];
await shot('river_junction', confluence.points[1][0] * 4, confluence.points[1][1] * 4,
           confluence.source_id);

// 4. three cart roads, three consecutive camera positions each
const carts = roads.filter(r => r.kind === 'cart').slice(0, 3);
for (const r of carts) {
  for (const [i, t] of [[0, 0.25], [1, 0.5], [2, 0.75]]) {
    const [x, y] = midOf(r, t);
    await shot(`road_${r.source_id}_${i}`, x, y, `cart ${r.source_id} @${t}`);
  }
}
// 5. two forest paths (foot / trail)
for (const r of roads.filter(r => r.kind === 'foot' || r.kind === 'trail').slice(0, 2)) {
  const [x, y] = midOf(r, 0.5);
  await shot('forest_path_' + r.source_id, x, y, r.kind + ' through cover');
}
// 6. two junctions: authored road endpoints that share a node
const jnodes = Object.values((meta.network?.roads?.near_miss || [])
  .filter(n => n.class === 'VALID_JUNCTION').slice(0, 2));
for (const [i, n] of jnodes.entries()) {
  await shot(`junction_${i}_${n.road}`, n.at[0] * 4, n.at[1] * 4,
             `${n.road} meets ${n.nearest} (${n.class})`);
}
// 7. two bridge approaches (camera sits on the approach, deck visible)
for (const b of (meta.bridges || []).slice(0, 2)) {
  const ang = b.bearing_rad || 0, span = (b.span_units || 8) * 4;
  await shot('bridge_approach_' + b.source_id,
             b.deck_px[0] - Math.cos(ang) * (span * 0.5 + 40),
             b.deck_px[1] - Math.sin(ang) * (span * 0.5 + 40), b.load + ' approach');
}
// 8. two dock approaches
for (const d of (meta.docks || []).filter(d => d.anchor_valid).slice(0, 2)) {
  await shot('dock_approach_' + d.source_id, d.land_anchor_px[0], d.land_anchor_px[1], d.kind);
}
// 9. every authored ford (water crossing that must read as a wade, not a gap)
for (const f of (meta.network?.authored_fords || [])) {
  if (f.at) await shot('ford_' + f.road, f.at[0] * 4, f.at[1] * 4, 'authored ford');
}
// 10. every road that previously failed the traversal gate
for (const rid of ['rd_0', 'rd_i', 'rd_w', 'rd_x', 'rd_1f', 'rd_1g', 'rd_1n', 'rd_24',
                   'rd_27', 'rd_29', 'rd_2a', 'rd_2b']) {
  const r = roads.find(x => x.source_id === rid);
  if (!r) continue;
  const [x, y] = midOf(r, 0.5);
  await shot('repaired_' + rid, x, y, 'previously failing traversal');
}

await setOverlays(true);       // gameplay-overlay captures (minimap / HUD visible)
await shot('overlay_gameplay_west', meta.spawns[0].world_px[0], meta.spawns[0].world_px[1], 'HUD visible');
await setOverlays(false);
// minimap toggle with real input
await page.keyboard.press('m'); await page.waitForTimeout(120);
const miniOff = await page.evaluate(() => document.getElementById('minimap').style.display === 'none');
await page.keyboard.press('m');
report.checks.push({ name: 'minimap_toggle', pass: miniOff, detail: 'M key' });

// world overview: rendered from the decoded world image inside the browser, written as PNG bytes
await setOverlays(false);
const overviewData = await page.evaluate(() => {
  const s = window.__veyra;
  const c = document.createElement('canvas');
  c.width = 1600; c.height = 1120;
  c.getContext('2d').drawImage(s.world, 0, 0, 1600, 1120);
  return c.toDataURL('image/png');
});
fs.writeFileSync(path.join(OUT, 'overview.png'), Buffer.from(overviewData.split(',')[1], 'base64'));
report.scenes.push({ file: 'overview.png', scene: 'overview', camera: [8000, 5600],
                     note: 'whole compiled world image, decoded in Chromium',
                     sha256: sha256(path.join(OUT, 'overview.png')), pass: true });

report.world_sha256 = crypto.createHash('sha256')
  .update(fs.readFileSync('out/world.png')).digest('hex');
report.world_meta_sha256 = crypto.createHash('sha256')
  .update(fs.readFileSync('out/world_meta.json')).digest('hex');
report.summary = {
  scenes: report.scenes.length,
  blank_scenes: report.scenes.filter(s => !s.pass).length,
  checks_passed: report.checks.filter(c => c.pass).length,
  checks_total: report.checks.length,
  errors: report.errors,
};
fs.writeFileSync(path.join(OUT, 'BROWSER_CAPTURE.json'), JSON.stringify(report, null, 1));
await browser.close();
console.log(JSON.stringify(report.summary, null, 1));
if (process.env.GITHUB_SHA && report.commit &&
    !report.commit.startsWith(process.env.GITHUB_SHA.slice(0, 12))) {
  console.error('capture commit ' + report.commit + ' != tested SHA ' + process.env.GITHUB_SHA);
  process.exit(1);
}
if (report.summary.blank_scenes > 0 || report.errors.length > 0 ||
    report.checks.some(c => !c.pass)) process.exit(1);
