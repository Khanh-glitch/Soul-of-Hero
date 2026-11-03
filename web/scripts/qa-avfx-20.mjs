// AVFX #20 Reality Ripper visual QA — real primary game, WebGL2 presenter.
// Captures BEFORE/OPENING/CLIMAX/RESTITCH/AFTER in a bright clearing (day) and a
// dark structured area (night). GPU gate: exit 2 unless presenter.mode==='webgl2'
// (QA_ALLOW_FALLBACK=1 only for logic smoke).
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

const OUT = 'evidence/avfx-20';
mkdirSync(OUT, { recursive: true });
const ALLOW_FALLBACK = process.env.QA_ALLOW_FALLBACK === '1';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/favicon.ico') { s.writeHead(204); s.end(); return; }
  let f = join('dist', p === '/' ? 'index.html' : p);
  try { const d = readFileSync(f); s.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); s.end(d); }
  catch { s.writeHead(404); s.end(); }
}).listen(4331);

const b = await chromium.launch({
  executablePath: process.env.QA_CHROME || undefined,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
await page.goto('http://localhost:4331/'); await page.waitForTimeout(2500);
await page.getByText('New run').click(); await page.waitForTimeout(400);
await page.getByText('Meadow Bay').click(); await page.getByText('Begin the 14 days').click(); await page.waitForTimeout(2000);

const report = { errors, softwareGL: true };
report.webgl2Probe = await page.evaluate(() => ({
  webgl2: !!document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: false }),
  presenterMode: window.__presenter?.mode ?? 'none',
}));
if (!ALLOW_FALLBACK && report.webgl2Probe.presenterMode !== 'webgl2') {
  console.log('GPU GATE FAILED:', JSON.stringify(report.webgl2Probe));
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  await b.close(); srv.close(); process.exit(2);
}

const PHASES = [['t0.6', 0.6], ['t1.3', 1.3], ['t2.7', 2.7], ['t4.5', 4.5], ['t6.6', 6.6], ['t7.8', 7.8], ['t9.5', 9.5], ['t9.85', 9.85], ['after', 10.8]];
const MODES = ['current', 'restored'];

// Scene A: bright open clearing, DAY — both modes
await page.evaluate(() => window.__qaNight(false));
for (const mode of MODES) {
  await page.evaluate(m => { window.__d20qa.client.mode = m; }, mode);
  for (const [name, t] of PHASES) {
    await page.evaluate(tt => { if (tt >= 0) window.__d20qa.seek(tt); else window.__d20qa.client.cast = null; }, t);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}/A-day-${mode}-${name}.png` });
  }
}
// Scene B: night, near structure/trees
await page.evaluate(() => window.__qaNight(true));
await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
for (const mode of MODES) {
  await page.evaluate(m => { window.__d20qa.client.mode = m; }, mode);
  for (const [name, t] of PHASES) {
    await page.evaluate(tt => { if (tt >= 0) window.__d20qa.seek(tt); else window.__d20qa.client.cast = null; }, t);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}/B-night-${mode}-${name}.png` });
  }
}
// normal playback smoke: play from 0 for 2.5s, confirm passes flowing then OUT
report.playback = await page.evaluate(async () => {
  window.__d20qa.play();
  const seen = [];
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 500));
    seen.push(window.__comp.collectGpuPasses({ g: null, cam: { x: 0, y: 0 }, now: Date.now(), dark: 0 }).map(l => l.kind + '@t' + l.time.toFixed(1)));
  }
  return { frames: seen, mode: window.__presenter.mode };
});
report.metrics = await page.evaluate(() => {
  const pr = window.__presenter;
  return { mode: pr.mode, worldUploads: pr.worldUploads, layerUploads: pr.layerUploads, gpuPasses: pr.gpuPasses, postCalls: pr.postCalls, glError: pr.lastGlError, fbo: pr.fboStatus };
});
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await b.close(); srv.close();
process.exit(errors.length ? 1 : 0);
