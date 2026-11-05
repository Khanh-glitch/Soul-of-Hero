// Salvage-skills ending probe — runs in CI with REAL (software) WebGL2.
// For #7/#10/#16/#17/#18: measure playback jank (rAF gaps) and screen luminance
// at the ending phase and right after the cast ends (whole-screen black detector).
// Emits ::error workflow annotations per failing metric; exit 3 on any failure,
// exit 2 if WebGL2 unavailable, else 0.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

const OUT = 'evidence/salvage-end';
mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/favicon.ico') { s.writeHead(204); s.end(); return; }
  let f = p === '/' ? join('dist', 'index.html') : (existsSync(join('dist', p)) ? join('dist', p) : join('.', p));
  try { const d = readFileSync(f); s.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); s.end(d); }
  catch { s.writeHead(404); s.end(); }
}).listen(4332);

const b = await chromium.launch({
  executablePath: process.env.QA_CHROME || undefined,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://localhost:4332/');
await page.waitForTimeout(2500);
await page.getByText('New run').click();
await page.waitForTimeout(400);
await page.getByText('Meadow Bay').click();
await page.getByText('Begin the 14 days').click();
await page.waitForTimeout(2000);

const probe = await page.evaluate(() => ({
  webgl2: !!document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: false }),
  presenterMode: window.__presenter?.mode ?? 'none',
}));
console.log('PROBE', JSON.stringify(probe));
if (probe.presenterMode !== 'webgl2') { console.log('::error ::SALVAGE-GATE presenter not webgl2'); await b.close(); srv.close(); process.exit(2); }

// mean luminance of the current page screenshot, decoded in-page
async function meanLum(tag) {
  const buf = await page.screenshot();
  const b64 = buf.toString('base64');
  const lum = await page.evaluate(async (dataUrl) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15;
    return s / (d.length / 4);
  }, 'data:image/png;base64,' + b64);
  console.log(`LUM ${tag} mean=${lum.toFixed(1)}`);
  return lum;
}

const report = { probe, errors, skills: {} };
let failures = 0;

// baseline: rAF gaps with NO cast active (game alone on WebGL2)
{
  const g = await page.evaluate(async () => {
    const gaps = await new Promise(resolve => {
      const a = []; let last = performance.now(); const t0 = last;
      const tick = () => { const n = performance.now(); a.push(n - last); last = n; if (n - t0 < 2000) requestAnimationFrame(tick); else resolve(a); };
      requestAnimationFrame(tick);
    });
    const s = gaps.reduce((x, y) => x + y, 0);
    return { avg: +(s / gaps.length).toFixed(1), max: +Math.max.apply(null, gaps).toFixed(0), over50: gaps.filter(x => x > 50).length };
  });
  report.baseline = g;
  console.log(`::warning ::SALVAGE-BASELINE avg=${g.avg} max=${g.max} over50=${g.over50}`);
}

const IDS = [7, 10, 16, 17, 18];
for (const id of IDS) {
  const r = await page.evaluate(async (id) => {
    const lab = window.__arcanaLab;
    const i = lab.catalog.findIndex(e => e.id === id);
    const e = lab.catalog[i];
    lab.cast(i, 'lead');
    await new Promise(r => setTimeout(r, 300));
    // jank during playback: rAF gaps over 2.5s of real-time play
    const gaps = await new Promise(resolve => {
      const g = []; let last = performance.now(); const t0 = last;
      const tick = () => { const n = performance.now(); g.push(n - last); last = n; if (n - t0 < 2500) requestAnimationFrame(tick); else resolve(g); };
      requestAnimationFrame(tick);
    });
    const sum = gaps.reduce((a, x) => a + x, 0);
    return {
      id, dur: e.dur, climax: e.climax,
      frames: gaps.length, avg: +(sum / gaps.length).toFixed(1),
      max: +Math.max.apply(null, gaps).toFixed(0), over50: gaps.filter(g => g > 50).length,
    };
  }, id);
  report.skills[id] = r;
  console.log(`::warning ::SALVAGE-JANK id=${id} avg=${r.avg} max=${r.max} over50=${r.over50} frames=${r.frames}`);
  if (r.over50 > 2 || r.max > 80) { console.log(`::error ::SALVAGE-JANK id=${id} avg=${r.avg} max=${r.max} over50=${r.over50}`); failures++; }
  // ending phase luminance
  await page.evaluate((id) => {
    const lab = window.__arcanaLab;
    const i = lab.catalog.findIndex(e => e.id === id);
    const e = lab.catalog[i];
    lab.seek(e.dur * 0.98, i, 'lead');
  }, id);
  await page.waitForTimeout(900);
  const lumEnd = await meanLum(`id${id}@ending`);
  await page.screenshot({ path: `${OUT}/end-${id}.png` });
  // right after the cast ends
  await page.evaluate((id) => {
    const lab = window.__arcanaLab;
    const i = lab.catalog.findIndex(e => e.id === id);
    lab.seek(lab.catalog[i].dur + 5, i, 'lead');
  }, id);
  await page.waitForTimeout(900);
  const lumAfter = await meanLum(`id${id}@after-end`);
  await page.screenshot({ path: `${OUT}/after-${id}.png` });
  report.skills[id].lumEnd = +lumEnd.toFixed(1);
  report.skills[id].lumAfter = +lumAfter.toFixed(1);
  console.log(`::warning ::SALVAGE-LUM id=${id} lumEnd=${lumEnd.toFixed(1)} lumAfter=${lumAfter.toFixed(1)}`);
  if (lumEnd < 12 || lumAfter < 12) { console.log(`::error ::SALVAGE-BLACK id=${id} lumEnd=${lumEnd.toFixed(1)} lumAfter=${lumAfter.toFixed(1)}`); failures++; }
  await page.evaluate(() => window.__arcanaLab.stop());
}

// real-time play-through of the shortest salvaged spell (#10, 7.4s): sample luminance
// every 400ms until 2s after it ends — catches a black flash at the natural ending.
await page.evaluate(() => {
  const lab = window.__arcanaLab;
  const i = lab.catalog.findIndex(e => e.id === 10);
  lab.cast(i, 'lead');
});
let minLum = 999; const t0 = Date.now();
while (Date.now() - t0 < 11000) {
  await page.waitForTimeout(400);
  const l = await meanLum('id10-realtime');
  minLum = Math.min(minLum, l);
}
report.realtime10 = { minLum: +minLum.toFixed(1) };
console.log(`::warning ::SALVAGE-REALTIME id=10 minLum=${minLum.toFixed(1)}`);
if (minLum < 12) { console.log(`::error ::SALVAGE-BLACK-RT id=10 minLum=${minLum.toFixed(1)}`); failures++; }

if (errors.length) { console.log(`::error ::SALVAGE-PAGEERRORS ${errors.slice(0, 3).join(' | ')}`); failures++; }
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
await b.close(); srv.close();
console.log(failures ? `SALVAGE PROBE FAILURES=${failures}` : 'SALVAGE PROBE ALL OK');
process.exit(failures ? 3 : 0);
