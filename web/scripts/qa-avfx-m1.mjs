// AVFX M1 browser QA — real primary game, single WebGL2 presenter, D19 source.
// Evidence: zero-cast pixel identity, D19 tick 498 seed 97 day/night, 2-client order.
// Run: LD_LIBRARY_PATH=<nss> node scripts/qa-avfx-m1.mjs
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

const OUT = 'evidence/avfx-m1';
mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  let f = join('dist', p === '/' ? 'index.html' : p);
  try { const data = readFileSync(f); s.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); s.end(data); }
  catch { s.writeHead(404); s.end(); }
}).listen(4330);

const b = await chromium.launch({ executablePath: '/tmp/chromium', args: ['--no-sandbox', '--disable-gpu'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:4330/'); await page.waitForTimeout(2500);
await page.getByText('New run').click(); await page.waitForTimeout(400);
await page.getByText('Meadow Bay').click(); await page.getByText('Begin the 14 days').click(); await page.waitForTimeout(2000);

const report = { errors };

// --- 0) bounded platform probe: WebGL2 availability in this environment ---
report.webgl2Probe = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: false });
  return { webgl2: !!gl, renderer: gl ? gl.getParameter(gl.RENDERER) : null, presenterMode: window.__presenter?.mode ?? 'none' };
});

// --- 1) zero-cast pixel identity: presented WebGL frame vs Canvas2D producer ---
report.zeroCast = await page.evaluate(async () => {
  const pr = window.__presenter; if (!pr) return { ok: false, why: 'no presenter' };
  if (pr.mode === '2d-fallback') {
    pr.present([]);
    const vis = pr.canvas.getContext('2d').getImageData(0, 0, pr.canvas.width, pr.canvas.height).data;
    const src = pr.worldContext().getImageData(0, 0, pr.canvas.width, pr.canvas.height).data;
    let diff = 0;
    for (let i = 0; i < vis.length; i++) if (vis[i] !== src[i]) diff++;
    return { ok: diff === 0, mode: pr.mode, diffBytes: diff, postCount: pr.postCount };
  }
  const gl = pr.gl;
  const w = pr.canvas.width, h = pr.canvas.height;
  // render one present with zero layers, then read back
  pr.present([]);
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const g = pr.worldContext();
  const img = g.getImageData(0, 0, w, h).data;
  let diff = 0, maxd = 0;
  for (let i = 0; i < w * h * 4; i += 4) {
    for (let k = 0; k < 3; k++) {
      // gl.readPixels is bottom-up; canvas is top-down
      const gi = ((w * h - 1 - (i / 4)) * 4) + k;
      const d = Math.abs(px[i + k] - img[gi]);
      if (d > 0) diff++;
      if (d > maxd) maxd = d;
    }
  }
  return { ok: diff === 0, diffPixels: diff, maxChannelDelta: maxd, w, h, uploadsPerFrame: pr.uploadsPerFrame, postCount: pr.postCount };
});

// --- 2) D19 source at tick 498 seed 97, day and night, real map ---
for (const [name, night] of [['d19-t498-day', false], ['d19-t498-night', true]]) {
  await page.evaluate(async (n) => {
    const r = window.__soh.run;
    window.__qaNight(n);
    window.__d19qa.seek(498 / 60); // tick 498, seed 97 (client default)
  }, night);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  report[name] = await page.evaluate(() => {
    const pr = window.__presenter;
    const layers = window.__comp.takeGpuPasses();
    return { mode: pr.mode, postCount: pr.postCount, uploads: pr.uploadsPerFrame, pendingAfterDrain: layers.length, glError: pr.gl ? pr.gl.getError() : 'no-gl' };
  });
}

// --- 3) two-client deterministic order + exactly one post per frame ---
report.twoClient = await page.evaluate(async () => {
  const comp = window.__comp, pr = window.__presenter;
  const order = [];
  comp.registerVfxClient({ id: 'zz-fake', submitGpu: () => { order.push('zz-fake'); comp.submitGpuPass({ clientId: 'zz-fake', kind: 'd19', lightTex: pr.lightTexture(), warp: new Float32Array(480 * 270 * 4), influence: new Uint8Array(480 * 270), region: { x: 0, y: 0, w: 1, h: 1 }, fade: 0, bloomGain: 0, time: 0, tick: 0, seed: 0 }); } });
  let dup = null;
  try { comp.registerVfxClient({ id: 'zz-fake' }); } catch (e) { dup = String(e.message); }
  const before = pr.postCount;
  const layers = comp.collectGpuPasses({ g: null, cam: { x: 0, y: 0 }, now: 0, dark: 0 });
  if (pr.mode === 'webgl2') pr.present(layers); else pr.present([]);
  const ids = layers.map(l => l.clientId);
  comp.unregisterVfxClient('zz-fake');
  return { order, ids, duplicateRejected: dup, postsThisFrame: pr.postCount - before };
});

// --- 4) natural OUT: seek past end, no leftover passes ---
report.out = await page.evaluate(async () => {
  window.__d19qa.seek(10.5);
  await new Promise(r => setTimeout(r, 300));
  const layers = window.__comp.collectGpuPasses({ g: null, cam: { x: 0, y: 0 }, now: 1, dark: 0 });
  return { leftoverPasses: layers.length };
});

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await b.close(); srv.close();
process.exit(errors.length ? 1 : 0);
