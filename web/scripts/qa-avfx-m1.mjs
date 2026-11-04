// AVFX M1 GPU QA — runs on the Playwright-installed Chromium with SwiftShader
// (software WebGL2, clearly labelled). GPU ACCEPTANCE GATE: exits 2 if the
// presenter is not in webgl2 mode. Set QA_ALLOW_FALLBACK=1 only for the separate
// fallback smoke job.
// Run: node scripts/qa-avfx-m1.mjs   (after `npx playwright install chromium`)
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

const OUT = 'evidence/avfx-m1';
mkdirSync(OUT, { recursive: true });
const ALLOW_FALLBACK = process.env.QA_ALLOW_FALLBACK === '1';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const srv = createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/favicon.ico') { s.writeHead(204); s.end(); return; }
  let f = join('dist', p === '/' ? 'index.html' : p);
  try { const data = readFileSync(f); s.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); s.end(data); }
  catch { s.writeHead(404); s.end(); }
}).listen(4330);

// software WebGL2 on CI/headless: ANGLE over SwiftShader (labelled software, not hardware GPU)
const b = await chromium.launch({
  executablePath: process.env.QA_CHROME || undefined, // local override; CI uses the installed Playwright browser
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
await page.goto('http://localhost:4330/'); await page.waitForTimeout(2500);
await page.getByText('New run').click(); await page.waitForTimeout(400);
await page.getByText('Meadow Bay').click(); await page.getByText('Begin the 14 days').click(); await page.waitForTimeout(2000);

const report = { errors, softwareGL: true };

// --- 0) WebGL2 probe + presenter mode gate ---
report.webgl2Probe = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: false });
  return { webgl2: !!gl, renderer: gl ? gl.getParameter(gl.RENDERER) : null, presenterMode: window.__presenter?.mode ?? 'none', fbo: window.__presenter?.fboStatus ?? 'n/a' };
});
if (!ALLOW_FALLBACK && report.webgl2Probe.presenterMode !== 'webgl2') {
  console.log('GPU ACCEPTANCE GATE FAILED: presenter mode =', report.webgl2Probe.presenterMode);
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  await b.close(); srv.close();
  process.exit(2);
}

// --- 1) zero-cast GPU pixel identity with CORRECT row mapping (flip Y only) ---
report.zeroCastGPU = await page.evaluate(async () => {
  const pr = window.__presenter;
  if (pr.mode !== 'webgl2') return { skipped: 'fallback', mode: pr.mode };
  const gl = pr.gl;
  const w = pr.canvas.width, h = pr.canvas.height;
  pr.present([]);
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); // bottom-up rows
  const img = pr.worldContext().getImageData(0, 0, w, h).data; // top-down rows
  let diff = 0, maxd = 0;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const gi = (row * w + col) * 4;                    // canvas top-down
      const pi = ((h - 1 - row) * w + col) * 4;           // gl bottom-up -> flip Y ONLY
      for (let k = 0; k < 4; k++) {
        const d = Math.abs(px[pi + k] - img[gi + k]);
        if (d > 0) diff++;
        if (d > maxd) maxd = d;
      }
    }
  }
  return { ok: diff === 0, diffBytes: diff, maxChannelDelta: maxd, worldUploads: pr.worldUploads, postCalls: pr.postCalls, glError: pr.lastGlError };
});

// --- 2) D19 source at seed 97, ticks 60/240/498/552, day + night, real map ---
for (const tick of [60, 240, 498, 552]) {
  for (const [name, night] of [['day', false], ['night', true]]) {
    await page.evaluate(async ([tk, n]) => {
      window.__qaNight(n);
      window.__d19qa.seek(tk / 60);
    }, [tick, night]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/d19-t${tick}-${name}.png` });
    if (tick === 498 && name === 'day') {
      report.d19metrics = await page.evaluate(() => {
        const pr = window.__presenter;
        return { mode: pr.mode, worldUploads: pr.worldUploads, layerUploads: pr.layerUploads, gpuPasses: pr.gpuPasses, postCalls: pr.postCalls, sourceDraws: pr.sourceDraws, glError: pr.lastGlError, fbo: pr.fboStatus };
      });
    }
  }
}
// camera movement while frozen at tick 498: effect must persist
await page.evaluate(() => window.__d19qa.seek(498 / 60));
await page.waitForTimeout(300);
await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/d19-t498-cameramove.png` });
report.frozenTickPersists = await page.evaluate(() => {
  const layers = window.__comp.collectGpuPasses({ g: null, cam: { x: 0, y: 0 }, now: 0, dark: 0 });
  return { passesAtFrozenTick: layers.length, tick: layers[0]?.tick, seed: layers[0]?.seed };
});

// --- 3) genuine 2-layer GPU overlap: second layer must COMBINE, not overwrite ---
report.overlap = await page.evaluate(async () => {
  const comp = window.__comp, pr = window.__presenter;
  if (pr.mode !== 'webgl2') return { skipped: 'fallback' };
  const mk = (id, x) => ({ clientId: id, kind: 'd19', lightTex: pr.lightTexture(), warp: new Float32Array(480 * 270 * 4), influence: (() => { const u = new Uint8Array(480 * 270); u.fill(1); return u; }), region: { x, y: 100, w: 200, h: 113 }, fade: 1, bloomGain: 1, time: 1, tick: 1, seed: 97 });
  // light tex is whatever D19 last rendered; use region overlap: layer A at x=200, layer B at x=300 (overlap 200..400)
  pr.present([mk('A', 200)]);
  const gl = pr.gl; const w = pr.canvas.width, h = pr.canvas.height;
  const px1 = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px1);
  pr.present([mk('A', 200), mk('B', 300)]);
  const px2 = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px2);
  // in overlap region (screen x 300..400 => gl x same, rows flip), layer B must CHANGE pixels vs single-A
  let changed = 0;
  for (let row = 0; row < h; row++) for (let col = 300; col < 400; col++) {
    const pi = ((h - 1 - row) * w + col) * 4;
    for (let k = 0; k < 3; k++) if (Math.abs(px2[pi + k] - px1[pi + k]) > 2) { changed++; break; }
  }
  return { overlapPixelsChangedBySecondLayer: changed, gpuPasses: pr.gpuPasses, postCalls: pr.postCalls, glError: pr.lastGlError };
});

// --- 4) two-client deterministic order + duplicate rejection + one post/frame ---
report.twoClient = await page.evaluate(() => {
  const comp = window.__comp, pr = window.__presenter;
  const order = [];
  comp.registerVfxClient({ id: 'zz-fake', submitGpu: () => { order.push('zz-fake'); comp.submitGpuPass({ clientId: 'zz-fake', kind: 'd19', lightTex: null, warp: new Float32Array(4), influence: new Uint8Array(4), region: { x: 0, y: 0, w: 1, h: 1 }, fade: 0, bloomGain: 0, time: 0, tick: 0, seed: 0 }); } });
  let dup = null;
  try { comp.registerVfxClient({ id: 'zz-fake' }); } catch (e) { dup = String(e.message); }
  const before = pr.postCalls;
  const layers = comp.collectGpuPasses({ g: null, cam: { x: 0, y: 0 }, now: 0, dark: 0 });
  comp.unregisterVfxClient('zz-fake');
  return { ids: layers.map(l => l.clientId), duplicateRejected: dup, postsPerCollect: pr.postCalls - before };
});

// --- 5) natural OUT: no leftover passes after end ---
report.out = await page.evaluate(async () => {
  window.__d19qa.seek(10.5);
  await new Promise(r => setTimeout(r, 300));
  const layers = window.__comp.collectGpuPasses({ g: null, cam: { x: 0, y: 0 }, now: 1, dark: 0 });
  return { leftoverPasses: layers.length };
});

// --- 6) PixelFX still live under the presenter (core cast smoke) ---
await page.evaluate(() => { window.__qaNight(false); const r = window.__soh.run; r.custody.inv.slots[0] = { key: 'core_fire', qty: 1, charge: 3 }; r.player.active = 0; });
await page.mouse.move(632, 350); await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up(); await page.waitForTimeout(400);
report.pixelfx = await page.evaluate(() => ({ charge: window.__soh.run.custody.inv.slots[0].charge, fx: window.__pfx.getStats().instances, mode: window.__presenter.mode }));
await page.screenshot({ path: `${OUT}/pixelfx-cast.png` });

report.glGate = await page.evaluate(() => {
  const pr = window.__presenter;
  return { glError: pr.lastGlError, firstGlError: pr.firstGlError ?? null, errHistory: (pr.glErrHistory ?? []).slice(0, 32) };
});
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await b.close(); srv.close();
// GL ERROR GATE (CT 6624135398): fail unless the real WebGL2 path records glError=0.
// Exit code encodes the FIRST error stage (readable from check-run annotations):
// 101 upload-frame, 102 upload-frame-delta, 103 world-upload, 104 accum-seed,
// 105 zero-cast-post, 106 layer frame legacy, 107 layer frame signed, 108 other layer, 109 final-post.
const stageExit = (s) =>
  !s ? 99 : s === 'upload-frame' ? 101 : s === 'upload-frame-delta' ? 102 : s === 'world-upload' ? 103 :
  s === 'accum-seed' ? 104 : s === 'zero-cast-post' ? 105 : s.startsWith('layer:frame') ? (s.includes(':signed') ? 107 : 106) :
  s.startsWith('layer:') ? 108 : s === 'final-post' ? 109 : 110;
if (report.glGate.glError !== 0 || (report.glGate.firstGlError && report.glGate.firstGlError.code !== 0)) {
  console.log('GL ERROR GATE FAILED:', JSON.stringify(report.glGate));
  process.exit(report.glGate.firstGlError ? stageExit(report.glGate.firstGlError.stage) : 99);
}
process.exit(errors.length ? 1 : 0);
