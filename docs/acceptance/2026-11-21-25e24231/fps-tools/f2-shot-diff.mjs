// Largest per-channel difference between two screenshots (same save, same frame count), read back through a canvas.
import fs from 'node:fs'; import { chromium } from 'playwright-core'; import sparticuz from '@sparticuz/chromium';
const [a, b] = process.argv.slice(2).map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
const browser = await chromium.launch({ executablePath: await sparticuz.executablePath(), args: [...sparticuz.args, '--disable-gpu'], headless: true });
const page = await browser.newPage();
const out = await page.evaluate(async ([a, b]) => {
  const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  const [ia, ib] = [await load(a), await load(b)]; const W = ia.width, H = ia.height;
  const px = i => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, W, H).data; };
  const A = px(ia), B = px(ib); const hist = new Array(8).fill(0); let max = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d > max) max = d;
    hist[d === 0 ? 0 : d <= 2 ? 1 : d <= 4 ? 2 : d <= 8 ? 3 : d <= 16 ? 4 : d <= 32 ? 5 : d <= 64 ? 6 : 7]++;
    if (d > 8) { const p = i / 4, x = p % W, y = (p / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return { size: [W, H, ib.width, ib.height], pixels: A.length / 4, maxDifference: max, 'pixels by difference 0 | 1-2 | 3-4 | 5-8 | 9-16 | 17-32 | 33-64 | 65+': hist, boxOfDifferencesOver8: x1 < 0 ? null : [x0, y0, x1, y1] };
}, [a, b]);
console.log(JSON.stringify(out)); await browser.close();
