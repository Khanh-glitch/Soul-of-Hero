// ARCANA #19 (D Constellation Engine) reference capture.
// Loads the ORIGINAL standalone HTML (Elemental_VFX_Lab) in headless
// Chromium (WebGL2/SwiftShader), casts ALL index 2 (Constellation
// Engine), and steps it with a virtual deterministic 60 Hz clock
// (rAF + performance.now replaced before page scripts run), so the
// dt-integrated node motion is reproducible frame-for-frame.
// Output: renderer/source_d/reference/constellation_tXXX.png + meta.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = path.join(root, 'prototypes/arcana_fusion20/original_source/package/handoff/reference/Elemental_VFX_Lab_FIXED_Standalone.html');
const outDir = path.join(root, 'prototypes/arcana_fusion20/renderer/source_d/reference');
mkdirSync(outDir, { recursive: true });

const TIMES = [0.5, 1.2, 2.0, 3.2, 4.4, 5.2, 6.4, 7.4, 7.9, 8.15, 8.8, 9.3];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  let vnow = 0;
  let idc = 0;
  const cbs = new Map();
  window.requestAnimationFrame = (cb) => { const id = ++idc; cbs.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => cbs.delete(id);
  performance.now = () => vnow;
  window.__advance = (frames) => {
    for (let i = 0; i < frames; i++) {
      vnow += 1000 / 60;
      const list = [...cbs.values()];
      cbs.clear();
      for (const cb of list) cb(vnow);
    }
  };
});
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto(pathToFileURL(html).href);
await page.waitForFunction(() => window.__vfxDebug || window.__vfxError, null, { timeout: 30000 });
const err = await page.evaluate(() => window.__vfxError || null);
if (err) { console.error('VFX ERROR', err); process.exit(1); }

await page.evaluate(() => {
  const c = document.getElementById('stage');
  c.style.width = '480px';
  c.style.height = '270px';
  window.__vfxDebug.state.renderer.resize();
  window.__vfxDebug.cast(2); // Constellation Engine
  window.__vfxDebug.state.playing = true;
  window.__vfxDebug.state.speed = 1;
});
const dims = await page.evaluate(() => {
  const c = document.getElementById('stage');
  return { w: c.width, h: c.height, name: window.__vfxDebug.ALL[window.__vfxDebug.state.idx].name };
});
console.log('canvas', dims);
if (dims.w !== 480 || dims.h !== 270) { console.error('unexpected canvas size'); process.exit(1); }

const meta = {};
let done = 0;
const hashes = {};
for (const t of TIMES) {
  const target = Math.round(t * 60);
  await page.evaluate((n) => window.__advance(n), target - done);
  done = target;
  const dataUrl = await page.evaluate(() => window.__vfxDebug.state.renderer.capture());
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  const key = 't' + String(Math.round(t * 100)).padStart(3, '0');
  writeFileSync(path.join(outDir, `constellation_${key}.png`), buf);
  hashes[key] = createHash('sha256').update(buf).digest('hex').slice(0, 16);
  meta[key] = { t };
  console.log('captured', key, 't=', t, buf.length, 'bytes', hashes[key]);
}
writeFileSync(path.join(outDir, 'constellation_meta.json'), JSON.stringify(meta, null, 2));

// Determinism proof: fresh cast, re-step to t=5.2, hash must match.
await page.evaluate(() => { window.__vfxDebug.cast(2); window.__advance(Math.round(5.2 * 60)); });
const again = await page.evaluate(() => window.__vfxDebug.state.renderer.capture());
const h2 = createHash('sha256').update(Buffer.from(again.split(',')[1], 'base64')).digest('hex').slice(0, 16);
console.log('determinism t320 first=', hashes['t520'], 'second=', h2, h2 === hashes['t520'] ? 'MATCH' : 'MISMATCH');
await browser.close();
if (h2 !== hashes['t520']) process.exit(2);
