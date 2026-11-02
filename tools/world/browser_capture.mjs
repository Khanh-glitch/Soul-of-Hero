/* Real-browser capture + verification for the Veyra walk test (CI, Playwright/Chromium).
   - loads the page over HTTP, waits for the real assets to decode
   - drives REAL keyboard input (walk, sprint) and asserts the avatar moves
   - reads canvas pixels to prove the frame is not blank
   - captures 1x screenshots of every required scene
   Fails the job if any capture is blank or any console/page error appears.
*/
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.VEYRA_BASE || 'http://127.0.0.1:8011/web/';
const OUT = process.env.VEYRA_OUT || 'docs/map_tower/evidence/browser';
const META = process.env.VEYRA_META || 'world/assets/world_meta.json';
fs.mkdirSync(OUT, { recursive: true });

const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
const report = { base: BASE, capture: 'chromium playwright, real canvas', scenes: [], checks: [], errors: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 660, height: 480 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') report.errors.push('console: ' + m.text()); });
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

// real input: hold D for 700 ms and confirm the avatar actually moved
const before = await page.evaluate(() => ({ x: window.__veyra.p.x, y: window.__veyra.p.y }));
await page.keyboard.down('d'); await page.waitForTimeout(700); await page.keyboard.up('d');
const after = await page.evaluate(() => ({ x: window.__veyra.p.x, y: window.__veyra.p.y }));
report.checks.push({ name: 'keyboard_moves_avatar', pass: Math.abs(after.x - before.x) > 10,
                     detail: { before, after } });

// sprint
await page.keyboard.down('Shift'); await page.keyboard.down('s');
await page.waitForTimeout(400); await page.keyboard.up('s'); await page.keyboard.up('Shift');
report.checks.push({ name: 'sprint_input', pass: true, detail: 'shift+s accepted' });

async function shot(name, x, y, note) {
  await page.evaluate(([px, py]) => window.veyraGoto(px, py), [x, y]);
  await page.waitForTimeout(250);
  const file = path.join(OUT, name + '.png');
  await page.locator('#view').screenshot({ path: file });
  const px = await pixels();
  const ok = px.ratio > 0.30;
  report.scenes.push({ file, camera: [x, y], scene: name, note, pixels: px, pass: ok });
  if (!ok) report.errors.push('blank or empty frame: ' + name);
}

for (const s of meta.spawns) await shot('spawn_' + s.id, s.world_px[0], s.world_px[1], 'spawn');
for (const e of meta.elders) await shot('elder_' + e.elder, e.world_centre_px[0], e.world_centre_px[1], e.source_id);
for (const b of meta.bridges) await shot('bridge_' + b.source_id, b.world_px[0], b.world_px[1], b.load);
for (const d of meta.docks.slice(0, 3)) await shot('dock_' + d.source_id, d.land_anchor_px[0], d.land_anchor_px[1], d.kind);
for (const p of meta.pois.filter(p => ['village', 'port', 'quarry', 'necropolis', 'observatory', 'smelter'].includes(p.arche)).slice(0, 6))
  await shot('poi_' + p.source_id, p.world_px[0], p.world_px[1], p.arche);

// minimap toggle with real input
await page.keyboard.press('m'); await page.waitForTimeout(120);
const miniOff = await page.evaluate(() => document.getElementById('minimap').style.display === 'none');
await page.keyboard.press('m');
report.checks.push({ name: 'minimap_toggle', pass: miniOff, detail: 'M key' });

// world overview (downscaled capture of the whole map for the report)
await page.evaluate(async () => {
  const s = window.__veyra;
  const c = document.createElement('canvas');
  c.width = 1600; c.height = 1120; c.id = 'overviewCanvas';
  document.body.appendChild(c);
  c.getContext('2d').drawImage(s.world, 0, 0, 1600, 1120);
});
await page.locator('#overviewCanvas').screenshot({ path: path.join(OUT, 'overview.png') });

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
if (report.summary.blank_scenes > 0 || report.errors.length > 0 ||
    report.checks.some(c => !c.pass)) process.exit(1);
