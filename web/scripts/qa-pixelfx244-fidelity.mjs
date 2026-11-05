// Fidelity QA for the single-file PIXELF-244 test build, per-effect vs the ORIGINAL
// Foundry-rendered pack:
//  A) spawn every one of the 244 effects in the built file and verify the current frame
//     cell has real visible content (non-transparent pixel count above threshold);
//  B) for every embedded atlas page, compare it against the original PNG (both drawn at
//     the original page size) and report mean/max abs RGBA error, aggregated per effect.
// Usage (from web/): node scripts/qa-pixelfx244-fidelity.mjs --pack /tmp/pfx244 --html releases/SOH-PIXELF-244-TEST.html
// Prints a JSON summary + worst offenders; writes evidence/pixelfx244-fidelity/report.json.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const packDir = resolve(web, flag('--pack', 'pixelfx-assets'));
const html = resolve(web, flag('--html', 'releases/SOH-PIXELF-244-TEST.html'));
const OUT = join(web, 'evidence/pixelfx244-fidelity');
mkdirSync(OUT, { recursive: true });

const manifest = JSON.parse(readFileSync(join(packDir, 'index.json'), 'utf8'));
const srv = createServer((q, s) => {
  try {
    const d = readFileSync(join(packDir, decodeURIComponent(q.url.split('?')[0])));
    s.writeHead(200, { 'content-type': q.url.endsWith('.json') ? 'application/json' : 'image/png' });
    s.end(d);
  } catch { s.writeHead(404); s.end(); }
}).listen(4397);

const browser = await chromium.launch({
  executablePath: process.env.QA_CHROME || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--js-flags=--max-old-space-size=4096'],
});

// ---------- part B: per-page pixel comparison (original PNG vs embedded data URL) ----------
{
  const page = await (await browser.newContext()).newPage();
  await page.goto('http://localhost:4397/index.json'); // same origin as pack server
  const htmlText = readFileSync(html, 'utf8');
  const m = htmlText.match(/window\.__PFX244_MANIFEST__=(\{.*?\});<\/script>/s);
  if (!m) throw new Error('embedded manifest not found in html');
  const embedded = JSON.parse(m[1]);
  const embById = new Map(embedded.effects.map(e => [e.id, e]));
  const perEffect = [];
  let pages = 0, sumMean = 0, worst = [];
  for (const orig of manifest.effects) {
    const emb = embById.get(orig.id);
    if (!emb) { perEffect.push({ id: orig.id, error: 'MISSING in embedded manifest' }); continue; }
    let eSum = 0, eMax = 0, n = 0;
    for (const ch of ['combined', 'light']) {
      for (let i = 0; i < (orig.export.pages[ch]?.length ?? 0); i++) {
        const op = orig.export.pages[ch][i];
        const ep = emb.export.pages[ch]?.[i];
        if (!ep || !ep.path.startsWith('data:')) continue;
        const r = await page.evaluate(async ({ origSrc, embData }) => {
          const load = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
          const a = await load(origSrc), b = await load(embData);
          const W = a.width, H = a.height;
          const ca = document.createElement('canvas'); ca.width = W; ca.height = H;
          const xa = ca.getContext('2d', { willReadFrequently: true }); xa.drawImage(a, 0, 0);
          const cb = document.createElement('canvas'); cb.width = W; cb.height = H;
          const xb = cb.getContext('2d', { willReadFrequently: true }); xb.drawImage(b, 0, 0, W, H);
          const da = xa.getImageData(0, 0, W, H).data, db = xb.getImageData(0, 0, W, H).data;
          let sum = 0, mx = 0;
          for (let i = 0; i < da.length; i += 4) {
            const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) + Math.abs(da[i + 3] - db[i + 3]);
            sum += d; if (d > mx) mx = d;
          }
          return { mean: sum / (da.length / 4), max: mx };
        }, { origSrc: '/' + op.path, embData: ep.path });
        eSum += r.mean; eMax = Math.max(eMax, r.max); n++;
      }
    }
    pages += n;
    const mean = n ? eSum / n : -1;
    sumMean += mean;
    perEffect.push({ id: orig.id, pages: n, meanAbsDiff: +mean.toFixed(3), maxDiff: eMax });
    worst.push({ id: orig.id, mean: +mean.toFixed(3) });
  }
  worst.sort((a, b) => b.mean - a.mean);
  const report = {
    pagesCompared: pages,
    effectsCompared: perEffect.filter(p => p.pages > 0).length,
    overallMeanAbsDiffPerChannel: +(sumMean / Math.max(1, perEffect.length)).toFixed(3),
    worst15: worst.slice(0, 15),
    missing: perEffect.filter(p => p.error).map(p => p.id),
  };
  writeFileSync(join(OUT, 'page-fidelity.json'), JSON.stringify({ report, perEffect }, null, 1));
  console.log('PAGE-FIDELITY', JSON.stringify(report));
  await page.close();
}

// ---------- part A: spawn all 244 in the built file, verify visible content ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + html);
  await page.waitForFunction(() => window.__soh && window.__soh.run && window.__pfx && window.__PFX244_MANIFEST__, null, { timeout: 90000 });
  const spawnReport = await page.evaluate(async () => {
    const pfx = window.__pfx;
    pfx.injectManifest(window.__PFX244_MANIFEST__.effects);
    const cat = pfx.catalog();
    const px = window.__soh.run.player.x, py = window.__soh.run.player.y;
    const out = [];
    for (const c of cat) {
      const inst = pfx.spawn(c.id, { x: px, y: py });
      if (!inst) { out.push({ id: c.id, spawn: false }); continue; }
      // wait until its combined pages are loaded (or failed)
      let loaded = false, failed = false;
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 100));
        if (pfx.catalog().find(x => x.id === c.id)?.loaded) { loaded = true; break; }
        if (pfx.isFailed(c.id)) { failed = true; break; }
      }
      // measure visible content of the current frame cell from the loaded image
      let ink = -1;
      if (loaded) {
        const e = pfx.catalog().find(x => x.id === c.id);
        const entry = inst.entry;
        const f = 0;
        const p = entry.export.pages.combined.find(pp => f >= pp.first && f < pp.first + pp.count);
        if (p) {
          const img = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = p.path; });
          if (img) {
            const cw = p.dimensions[0] / p.columns, chh = p.dimensions[1] / p.rows;
            const cv = document.createElement('canvas'); cv.width = cw; cv.height = chh;
            const x = cv.getContext('2d', { willReadFrequently: true });
            x.drawImage(img, 0, 0, cw, chh, 0, 0, cw, chh);
            const d = x.getImageData(0, 0, cw, chh).data;
            let cnt = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 10) cnt++;
            ink = cnt / (d.length / 4);
          }
        }
      }
      out.push({ id: c.id, spawn: true, loaded, failed, ink: ink >= 0 ? +ink.toFixed(3) : null });
      pfx.clear();
    }
    return { total: cat.length, out };
  });
  const bad = spawnReport.out.filter(r => !r.spawn || r.failed || !r.loaded || (r.ink !== null && r.ink < 0.005));
  const summary = {
    total: spawnReport.total,
    spawned: spawnReport.out.filter(r => r.spawn).length,
    loaded: spawnReport.out.filter(r => r.loaded).length,
    withVisibleContent: spawnReport.out.filter(r => r.ink !== null && r.ink >= 0.005).length,
    problems: bad.map(b => b.id),
    pageerrors: errors,
  };
  writeFileSync(join(OUT, 'spawn-report.json'), JSON.stringify(summary, null, 1));
  console.log('SPAWN-CHECK', JSON.stringify(summary));
  await ctx.close();
}

await browser.close();
srv.close();
console.log('DONE');
