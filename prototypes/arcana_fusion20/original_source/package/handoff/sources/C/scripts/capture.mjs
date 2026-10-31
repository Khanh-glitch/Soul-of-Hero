// Headless capture of the real renderer output.
//   node scripts/capture.mjs sheet 0,1,2,3 [cols]      -> screenshots/sheet-<ids>.png (rows = spells, cols = moments)
//   node scripts/capture.mjs times 5 1.0,2.5,4.0        -> screenshots/times-5.png
//   node scripts/capture.mjs climax                     -> screenshots/NN-name.png for all spells (3x)
// Requires puppeteer (set PUPPETEER_DIR to a folder containing node_modules/puppeteer if not installed locally).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(path.join(process.env.PUPPETEER_DIR || root, 'package.json'));
const puppeteer = req('puppeteer');
const [mode = 'climax', a1, a2] = process.argv.slice(2);
const out = path.join(root, 'screenshots');
fs.mkdirSync(out, { recursive: true });

const scale = mode === 'climax' ? 3 : mode === 'climaxsheet' ? 1 : 2;
const browser = await puppeteer.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 384 * scale, height: 216 * scale, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href + '?capture=1', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__arcana, { timeout: 20000 });
const list = await page.evaluate(() => window.__arcana.list);

async function grabSheet(jobs, cols, file) {
  const url = await page.evaluate(async (jobs, cols, scale) => {
    const A = window.__arcana, cv = document.querySelector('canvas');
    const fw = 384 * scale, fh = 216 * scale;
    const rows = Math.ceil(jobs.length / cols);
    const sheet = document.createElement('canvas');
    sheet.width = cols * fw + (cols - 1) * 4; sheet.height = rows * fh + (rows - 1) * 4;
    const g = sheet.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, sheet.width, sheet.height);
    g.imageSmoothingEnabled = false; g.font = '14px monospace';
    jobs.forEach(([i, t], k) => {
      A.seek(i, t);
      const x = (k % cols) * (fw + 4), y = Math.floor(k / cols) * (fh + 4);
      g.drawImage(cv, 0, 0, cv.width, cv.height, x, y, fw, fh);
      g.fillStyle = '#fff'; g.fillText(`${i + 1} @${t.toFixed(2)}s`, x + 6, y + 16);
    });
    return sheet.toDataURL('image/png');
  }, jobs, cols, scale);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', file);
}

if (mode === 'sheet') {
  const ids = a1.split(',').map(Number);
  const jobs = [];
  for (const i of ids) {
    const s = list[i];
    const ts = [s.climax * 0.35, s.climax * 0.75, s.climax, s.climax + (s.dur - s.climax) * 0.4];
    for (const t of ts) jobs.push([i, t]);
  }
  await grabSheet(jobs, 4, path.join(out, `sheet-${ids.join('-')}.png`));
} else if (mode === 'climaxsheet') {
  await grabSheet(list.map((s, i) => [i, s.climax]), 4, path.join(out, 'climax-sheet.png'));
} else if (mode === 'times') {
  const i = Number(a1);
  const ts = a2.split(',').map(Number);
  await grabSheet(ts.map((t) => [i, t]), Math.min(4, ts.length), path.join(out, `times-${i}.png`));
} else {
  for (let i = 0; i < list.length; i++) {
    await page.evaluate((i, t) => window.__arcana.seek(i, t), i, list[i].climax);
    const name = `${String(i + 1).padStart(2, '0')}-${list[i].name.toLowerCase().replace(/[^a-z]+/g, '-')}.png`;
    const el = await page.$('canvas');
    await el.screenshot({ path: path.join(out, name) });
    console.log('wrote', name);
  }
}
await browser.close();
