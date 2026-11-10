// Builds web/releases/SOH-PIXELF-244-TEST.html — a SINGLE-FILE test build that embeds
// the FULL 244-effect PixelFX pack (rendered by the Foundry intake pipeline) as data-URL
// atlas pages, so all 244 effects can be eyeballed from file:// with F9 (FX Lab).
//
// Pack source: run the documented intake first (from repo root):
//   node tools/pixelfx_foundry/intake.mjs --upstream /path/to/pixelfx@a84159688af3ca37a4be05a0d422b94451b2e24e --out web/pixelfx-assets
// then: node scripts/build-pixelfx244-test.mjs [--pack web/pixelfx-assets] [--k 0.25] [--q 0.85]
//
// The pack PNGs are re-encoded to WebP at scale k (atlas cells render at ~30-90 px on
// screen, so k=0.25 loses no visible detail) and embedded base64; the manifest's page
// dimensions are scaled by the same k so frame lookup stays consistent. Test artifact
// only — the shipped game code and the pixelfx library itself are untouched; the shim
// calls the QA-only pfx.injectManifest() hook.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const OUT_HTML = resolve(web, flag('--out', 'releases/SOH-PIXELF-244-TEST.html'));
const packDir = resolve(web, flag('--pack', 'pixelfx-assets'));
const K = Number(flag('--k', '0.5'));
const Q = Number(flag('--q', '0.95'));
const CHANNELS = flag('--channels', 'combined,light').split(',');
// categories embedded at 100% original resolution (lossless PNG data URLs), e.g. --fullres arcane
const FULLRES = new Set(flag('--fullres', '').split(',').filter(Boolean));

const manifest = JSON.parse(readFileSync(join(packDir, 'index.json'), 'utf8'));
if (!manifest.effects || manifest.effects.length !== 244) throw new Error(`pack must have 244 effects, got ${manifest.effects?.length}`);

// collect unique page paths (only the channels we embed)
const pagePaths = new Set();
const fullresPaths = new Set();
for (const e of manifest.effects) {
  const full = FULLRES.has(e.id.split('/')[0]);
  for (const ch of CHANNELS) for (const p of e.export.pages[ch] ?? []) {
    pagePaths.add(p.path);
    if (full) fullresPaths.add(p.path);
  }
}
const paths = [...pagePaths].filter(p => !fullresPaths.has(p));
console.log(`pack: ${manifest.effects.length} effects, ${pagePaths.size} atlas pages, k=${K} q=${Q}, fullres categories: ${[...FULLRES].join(',') || '(none)'} (${fullresPaths.size} pages lossless)`);

// serve pack over http (avoids file:// canvas taint), re-encode in the browser
const srv = createServer((q, s) => {
  try {
    const d = readFileSync(join(packDir, decodeURIComponent(q.url.split('?')[0])));
    s.writeHead(200, { 'content-type': q.url.endsWith('.json') ? 'application/json' : 'image/png' });
    s.end(d);
  } catch { s.writeHead(404); s.end(); }
}).listen(4398);

const browser = await chromium.launch({
  executablePath: process.env.QA_CHROME || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const N = 4;
const ctxs = [];
for (let i = 0; i < N; i++) ctxs.push(await (await browser.newContext()).newPage());
for (const p of ctxs) await p.goto('http://localhost:4398/index.json');

const dataUrl = new Map();
// full-res categories: embed original PNGs losslessly (100% sharpness)
for (const p of fullresPaths) {
  dataUrl.set(p, 'data:image/png;base64,' + readFileSync(join(packDir, p)).toString('base64'));
}
let done = 0;
const t0 = Date.now();
async function worker(pi) {
  const page = ctxs[pi];
  for (let i = pi; i < paths.length; i += N) {
    const p = paths[i];
    const url = await page.evaluate(async ({ src, k, q }) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', q);
    }, { src: '/' + p, k: K, q: Q });
    dataUrl.set(p, url);
    done++;
    if (done % 100 === 0) console.log(`  re-encoded ${done}/${paths.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
}
await Promise.all(ctxs.map((_, i) => worker(i)));
await browser.close();
srv.close();

// rewrite manifest: data URLs + scaled page dimensions (fullres pages keep k=1)
const scalePage = (p) => {
  const k = fullresPaths.has(p.path) ? 1 : K;
  return { ...p, path: dataUrl.get(p.path) ?? p.path, dimensions: [Math.max(1, Math.round(p.dimensions[0] * k)), Math.max(1, Math.round(p.dimensions[1] * k))] };
};
const out = { effects: manifest.effects.map(e => ({
  ...e,
  export: {
    ...e.export,
    pages: {
      combined: (e.export.pages.combined ?? []).map(scalePage),
      light: CHANNELS.includes('light') ? (e.export.pages.light ?? []).map(scalePage) : [],
    },
  },
})) };
const manifestJson = JSON.stringify(out);
console.log(`embedded manifest: ${(manifestJson.length / 1e6).toFixed(1)} MB`);

const SHIM = `<script>
    // ===== SOH PIXELF-244 TEST build — boot shim (test artifact only) =====
    // 1) same recovery watcher as the ARCANA20 test build: if the game itself shows
    //    "Save recovery required", clear stale save copies once per tab and reload.
    // 2) auto-start a new run (Meadow Bay), inject the embedded 244-effect manifest
    //    via the QA-only __pfx.injectManifest hook, open the FX Lab (F9).
    // 3) ADAPTIVE RESAMPLE (test build): wrap drawImage so atlas cells are drawn
    //    nearest-neighbor when upscaling (crisp, like the original pixelfx 1:1 render)
    //    and high-quality bilinear when downscaling (keeps thin detail such as rune
    //    strokes that nearest-neighbor would drop at small display sizes).
    (function () {
      try {
        var proto = CanvasRenderingContext2D.prototype;
        var sd = Object.getOwnPropertyDescriptor(proto, 'imageSmoothingEnabled');
        var qd = Object.getOwnPropertyDescriptor(proto, 'imageSmoothingQuality');
        var origDraw = proto.drawImage;
        proto.drawImage = function (img) {
          var a = arguments, sw = 0, dw = 0;
          if (a.length >= 9) { sw = a[3]; dw = a[7]; }
          else if (a.length >= 5) { sw = img.width || 1; dw = a[3]; }
          else { sw = img.width || 1; dw = a[1]; }
          if (sd && sd.set && sw > 0 && dw > 0) {
            var up = dw >= sw;
            sd.set.call(this, !up);
            if (qd && qd.set) qd.set.call(this, 'high');
          }
          return origDraw.apply(this, a);
        };
      } catch (e) {}
    })();
    (function () {
      try {
        var ALREADY = /pfx244-cleared/.test(location.hash);
        if (!ALREADY) {
          var obs = new MutationObserver(function () {
            try {
              var h = document.querySelector('h1');
              if (h && h.textContent && h.textContent.indexOf('Save recovery required') >= 0) {
                obs.disconnect();
                try { for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && (k.indexOf('soh.state.') === 0 || k.indexOf('soh.quarantine.') === 0)) localStorage.removeItem(k); } } catch (e) {}
                try {
                  var rq = indexedDB.deleteDatabase('soul-of-hero');
                  var fin = (function () { var f = false; return function () { if (!f) { f = true; location.hash = 'pfx244-cleared'; location.reload(); } }; })();
                  rq.onsuccess = fin; rq.onerror = fin; rq.onblocked = fin; setTimeout(fin, 1500);
                } catch (e) { location.hash = 'pfx244-cleared'; location.reload(); }
              }
            } catch (e) {}
          });
          obs.observe(document.documentElement, { childList: true, subtree: true });
        }
      } catch (e) {}
      function clickText(t) {
        var els = document.querySelectorAll('button');
        for (var i = 0; i < els.length; i++) if (els[i].textContent.indexOf(t) >= 0) { els[i].click(); return true; }
        return false;
      }
      var step = 0;
      var iv = setInterval(function () {
        try {
          if (step === 0 && clickText('New run')) step = 1;
          else if (step === 1 && clickText('Meadow Bay')) step = 2;
          else if (step === 2 && clickText('Begin the 14 days')) step = 3;
          else if (step === 3 && window.__pfx && window.__pfx.injectManifest && window.__PFX244_MANIFEST__) {
            window.__pfx.injectManifest(window.__PFX244_MANIFEST__.effects);
            // TEST BUILD ONLY: render atlas cells 1:1 at NATIVE size (like the upstream
            // pixelfx gallery) instead of the gameplay 44px normalization, so visual
            // comparison against the original is pixel-faithful. Toggle: window.__PFX_NATIVE_SCALE__=false
            try { if (window.__PFX_NATIVE_SCALE__ !== false && window.__pfx.setNativeScale) window.__pfx.setNativeScale(true); } catch (e) {}
            step = 4;
          } else if (step === 4 && window.__soh && window.__soh.run) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F9', bubbles: true }));
            clearInterval(iv);
            var d = document.createElement('div');
            d.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;background:rgba(18,12,24,.93);color:#ffe27a;border:1px solid #6b5a2a;border-radius:8px;padding:8px 12px;font:12px/1.6 monospace;max-width:380px;pointer-events:none';
            d.innerHTML = 'BẢN TEST 244 HIỆU ỨNG PIXELF (file test, không phải bản chính)<br>• Đã nhúng đủ 244 hiệu ứng vào file này — F9 mở FX Lab, gõ tên/danh mục ở ô search rồi click để cast lên world thật<br>• family (ground/hover/body/screen/proj) + scale ở panel trái; quality cao/thấp ở góc phải<br>• clear / scrub / +frame để xem từng khung hình · H: ẩn/hiện lab. Bản này tự dọn save cũ (file://) để boot sạch.';
            document.body.appendChild(d);
          }
        } catch (e) {}
      }, 600);
    })();
    </script>
    `;

const dist = readFileSync(join(web, 'dist/index.html'), 'utf8');
if (!dist.includes('<title>')) throw new Error('dist/index.html has no <title>');
if (dist.includes('PIXELF-244 TEST build')) throw new Error('shim already injected — rebuild dist first');
// optional extra demo shim (e.g. --demo demon-spirit appends scripts/demo-demon-spirit.js)
const DEMO = flag('--demo', '');
const shim = DEMO ? SHIM + '\n' + readFileSync(join(here, 'demo-' + DEMO + '.js'), 'utf8') : SHIM;
const outHtml = dist.replace('<title>', `<script>window.__PFX244_MANIFEST__=${manifestJson};</script>\n    ` + shim + '<title>');
const target = OUT_HTML;
writeFileSync(target, outHtml);
const sha = createHash('sha256').update(outHtml).digest('hex');
console.log('wrote', target, `(${(statSync(target).size / 1e6).toFixed(1)} MB)`);
console.log('sha256', sha);
