/** Controlled SAME-CODE atlas microbenchmark + browser pixel proof, not game FPS or enjoyment. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const base = process.env.SOH_BASE_URL || 'http://localhost:5173', samples = [];
try {
  for (const variant of ['inherited-lazy', 'pre-P1-eager', 'readback-lazy']) for (let i = 0; i < 3; i++) {
    const context = await browser.newContext(); const page = await context.newPage();
    await page.route('**/__atlas_probe', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
    await page.route('**/src/game/item-atlas.ts', async route => {
      const response = await route.fetch(); let body = await response.text();
      if (variant !== 'readback-lazy') body = body.replace(/, \{\s*willReadFrequently: true\s*\}/, '');
      if (variant === 'pre-P1-eager') {
        if (!body.includes('next[key] = c;')) throw new Error('Unrecognized atlas loader');
        body = body.replace('next[key] = c;', 'urls[key] = c.toDataURL("image/png"); next[key] = c;');
      }
      await route.fulfill({ response, body });
    });
    await page.goto(base + '/__atlas_probe');
    samples.push({ variant, i, ...await page.evaluate(async () => {
      const a = await import('/src/game/item-atlas.ts');
      const start = performance.now(); if (!await a.loadItemAtlas()) throw new Error('Atlas load failed');
      const loadMs = performance.now() - start;
      const keys = Object.keys(a.ITEM_ATLAS.frames); let t = performance.now();
      for (const key of ['knife', 'water_flask', 'berries', 'wood']) a.atlasIconUrl(key);
      const firstFourMs = performance.now() - t; t = performance.now();
      for (const key of keys) a.atlasIconUrl(key);
      const remainingMs = performance.now() - t;
      const img = new Image(); img.src = a.ITEM_ATLAS.image; await img.decode();
      const c = document.createElement('canvas'); c.width = a.ITEM_ATLAS.width; c.height = a.ITEM_ATLAS.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const mismatches = [];
      for (const [key, f] of Object.entries(a.ITEM_ATLAS.frames)) {
        const expected = g.getImageData(f.x, f.y, f.w, f.h).data;
        const actual = a.atlasIconCell(key).getContext('2d').getImageData(0, 0, f.w, f.h).data;
        if (!expected.every((b, j) => b === actual[j])) mismatches.push(key);
      }
      return { loadMs, firstFourMs, remainingMs, mismatches };
    }) });
    await context.close();
  }
} finally { await browser.close(); }
const result = { browser: browser.version(), note: 'Isolated decoded 157-cell workload; eager and inherited variants reconstructed by intercepting this same Vite module only. Software SwiftShader; excludes App/world startup, not device FPS certification.', samples };
writeFileSync(process.env.SOH_PERF_OUT || 'evidence/solo-final-fallback/20261117/atlas-controlled.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
