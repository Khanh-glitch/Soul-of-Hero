// Deterministic browser capture of the original D standalone HTML.
// The original canvas includes a simulated floor and markers; it is evidence
// only, NEVER a texture for SOH. The isolated diagnostic suppresses those
// draw calls, but is not an unmodified full-scene source or parity gate.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = path.join(root, 'prototypes/arcana_fusion20/original_source/package/handoff/reference/Elemental_VFX_Lab_FIXED_Standalone.html');
const outDir = process.env.ARCANA_D_OUTPUT || path.join(root, 'prototypes/arcana_fusion20/renderer/evidence_out/d-browser');
mkdirSync(outDir, { recursive: true });
const times = [0.5, 1.2, 2.0, 3.2, 4.4, 5.2, 6.4, 7.4, 7.9, 8.15, 8.8, 9.3];
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
async function capture(isolated, requested, save) {
  const page = await browser.newPage({viewport:{width:900,height:700},deviceScaleFactor:1});
  await page.addInitScript(() => {
    let now = 0, id = 0;
    const callbacks = new Map();
    window.requestAnimationFrame = cb => { callbacks.set(++id, cb); return id; };
    window.cancelAnimationFrame = n => callbacks.delete(n);
    Object.defineProperty(performance, 'now', {value: () => now});
    window.__advance = count => {
      for (let i = 0; i < count; i++) {
        now += 1000 / 60;
        const frame = [...callbacks.values()]; callbacks.clear();
        for (const cb of frame) cb(now);
      }
    };
  });
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(() => window.__vfxDebug || window.__vfxError, null, {timeout:30000});
  const details = await page.evaluate(isolate => {
    if (window.__vfxError) throw Error(window.__vfxError);
    const debug = window.__vfxDebug, r = debug.state.renderer;
    const canvas = document.getElementById('stage');
    canvas.style.width = '480px'; canvas.style.height = '270px'; r.resize();
    const idx = debug.ALL.findIndex(s => s.id === 19 && s.name === 'Constellation Engine');
    if (idx < 0) throw Error('D spell not found');
    if (isolate) {
      // Suppress battlefield floor + marker calls without rewriting the HTML.
      // Preserve all other source spell rendering and postprocessing.
      const quad = r.quad.bind(r);
      r.quad = p => { if (p !== r.floorProg) quad(p); };
      r.drawMarkers = () => {};
    }
    debug.cast(idx); debug.state.playing = true; debug.state.speed = 1;
    return {width:canvas.width,height:canvas.height, index:idx, name:debug.ALL[idx].name,
      webgl:r.gl.getParameter(r.gl.RENDERER)};
  }, isolated);
  if (details.width !== 480 || details.height !== 270) throw Error('incorrect capture dimensions: '+JSON.stringify(details));
  console.log('renderer', JSON.stringify({isolated,...details}));
  const result = {}; let done = 0;
  for (const t of requested) {
    const target = Math.round(t * 60);
    await page.evaluate(n => window.__advance(n), target - done); done = target;
    const state = await page.evaluate(() => ({time:window.__vfxDebug.state.t, error:window.__vfxError || null,
      data:window.__vfxDebug.state.renderer.capture()}));
    if (state.error) throw Error(state.error);
    const bytes = Buffer.from(state.data.split(',')[1], 'base64');
    const key = `t${String(Math.round(t*100)).padStart(3,'0')}`;
    const hash = createHash('sha256').update(bytes).digest('hex');
    result[key] = {requested:t,actual:state.time,sha256:hash};
    if (save) writeFileSync(path.join(outDir, `${isolated ? 'fx-only' : 'original'}_${key}.png`),bytes);
    console.log(key, 'actual=',state.time,'sha256=',hash);
  }
  await page.close();
  return result;
}
try {
  const original = await capture(false, times, true);
  const isolated = await capture(true, times, true);
  // A fresh page resets renderer.time, persistent framebuffer and pool; a
  // second cast in the same page does not reset them and is not comparable.
  const repeat = await capture(true, [5.2], false);
  if (repeat.t520.sha256 !== isolated.t520.sha256) throw Error('Fresh-page deterministic repeat mismatch');
  writeFileSync(path.join(outDir,'manifest.json'), JSON.stringify({source:path.relative(root,html), clock:'virtual requestAnimationFrame, 60 Hz', original, isolated,
    caveats:'Original images contain simulated floor/markers; FX-only skips floor/markers but retains source post. Neither is yet a like-for-like native parity gate. Authored native OUT has no matching original.'},null,2));
} finally { await browser.close(); }
