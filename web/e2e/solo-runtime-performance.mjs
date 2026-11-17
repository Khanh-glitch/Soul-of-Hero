/** Technical UI/performance probe, NOT a gameplay journey or human acceptance.
 * Run against Vite: SOH_BASE_URL=http://localhost:5173 node e2e/solo-runtime-performance.mjs
 * Optional CHROMIUM_EXECUTABLE_PATH for a locally provisioned browser; no production switches.
 * SOH_ATLAS_EAGER=1 reconstructs ONLY the pre-3682329 eager encode inside the served module.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.SOH_BASE_URL || 'http://localhost:5173';
const out = process.env.SOH_PERF_OUT || 'evidence/solo-final-fallback/20261117/runtime-performance.json';
const eager = process.env.SOH_ATLAS_EAGER === '1';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const samples = [];
try {
  for (let n = 0; n < Number(process.env.SOH_PERF_SAMPLES || 3); n++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (eager) await page.route('**/src/game/item-atlas.ts', async route => {
      const res = await route.fetch(); const text = await res.text();
      const target = text.includes('next[key] = c;') ? 'next[key] = c;' : 'cells[key] = c;';
      if (!text.includes(target)) throw new Error('Eager reconstruction no longer matches source');
      await route.fulfill({ response: res, body: text.replace(target, 'urls[key] = c.toDataURL("image/png"); ' + target) });
    });
    await page.addInitScript(() => {
      window.__perf = { encodes: [], frames: [], longTasks: [], inventoryInputs: [], inventoryPaints: [] };
      const orig = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (...args) {
        const at = performance.now(), result = orig.apply(this, args);
        window.__perf.encodes.push({ at, ms: performance.now() - at, w: this.width, h: this.height }); return result;
      };
      new PerformanceObserver(list => window.__perf.longTasks.push(...list.getEntries().map(e => ({ at: e.startTime, ms: e.duration })))).observe({ type: 'longtask', buffered: true });
      document.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'i') window.__perf.inventoryInputs.push(performance.now()); }, true);
      new MutationObserver(() => {
        const v = window.__perf;
        if (/Sort Pack/.test(document.body?.innerText || '') && v.inventoryPaints.length < v.inventoryInputs.length) {
          v.inventoryPaints.push({ dom: performance.now() });
          const p = v.inventoryPaints[v.inventoryPaints.length - 1]; requestAnimationFrame(() => requestAnimationFrame(() => { p.paint = performance.now(); }));
        }
      }).observe(document, { childList: true, subtree: true });
      let prev; const frame = t => { if (prev !== undefined) window.__perf.frames.push({ at: t, ms: t - prev }); prev = t; requestAnimationFrame(frame); }; requestAnimationFrame(frame);
    });
    const stamp = () => page.evaluate(() => ({ at: performance.now(), encodes: window.__perf.encodes.length }));
    await page.goto(base, { timeout: 120000 });
    await page.getByRole('button', { name: 'New run', exact: true }).waitFor({ timeout: 120000 });
    const title = await stamp();
    await page.getByRole('button', { name: 'New run', exact: true }).click();
    const begin = await stamp();
    await page.getByRole('button', { name: 'Begin the 14 days', exact: true }).click({ timeout: 120000 });
    // Inventory keyboard input uses the normal production handler; no state/item/position injection.
    await page.waitForTimeout(1200);
    const game = await stamp();
    const panels = [];
    for (let i = 0; i < 2; i++) {
      const before = await stamp(); await page.keyboard.press('i');
      await page.getByRole('button', { name: 'Sort Pack', exact: true }).waitFor({ timeout: 15000 });
      await page.waitForTimeout(300); const opened = await stamp();
      panels.push({ before, opened, visibleText: (await page.locator('body').innerText()).slice(0, 700) });
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    }
    const steady = await stamp(); await page.waitForTimeout(3000);
    const metrics = await page.evaluate(start => {
      const v = window.__perf, fs = v.frames.filter(f => f.at >= start).map(f => f.ms).sort((a, b) => a - b);
      const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl'); const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return { ...v, steady: { count: fs.length, median: fs[Math.floor(fs.length / 2)], p95: fs[Math.floor(fs.length * .95)], p99: fs[Math.floor(fs.length * .99)] },
        gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', memory: performance.memory?.usedJSHeapSize };
    }, steady.at);
    samples.push({ title, begin, game, panels, metrics, errors });
    if (n === 0 && process.env.SOH_PERF_SCREENSHOT) await page.screenshot({ path: process.env.SOH_PERF_SCREENSHOT });
    await context.close();
  }
} finally { await browser.close(); }
const result = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }),
  timestamp: new Date().toISOString(), browser: browser.version(), base, eagerReconstruction: eager,
  limitations: 'Dev build, fresh browser contexts, shared Vite transform cache; software SwiftShader, not physical GPU FPS certification. Random normal spawn scenes vary; frame metrics are descriptive, not a controlled atlas FPS causal claim.', samples };
mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true }); writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(samples.map(s => ({ title: s.title, game: s.game, panels: s.panels, encodes: s.metrics.encodes.length, encodeMs: s.metrics.encodes.reduce((a, e) => a + e.ms, 0), steady: s.metrics.steady, errors: s.errors })), null, 2));
