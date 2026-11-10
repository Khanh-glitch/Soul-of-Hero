// Visual Arena evidence driver. Serves a built dist over HTTP and drives REAL browser input.
// Usage: node tools/shot.mjs <distDir> <outDir> [script]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const dist = path.resolve(process.argv[2] || 'dist');
const out = path.resolve(process.argv[3] || 'evidence/before');
const script = process.argv[4] || 'baseline';
fs.mkdirSync(out, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  let f = path.join(dist, u === '/' ? 'index.html' : u);
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader'] });
const errors = [];
const log = (...a) => console.log(...a);

async function session(w, h, tag, fn) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => errors.push(`[${tag}] PAGEERROR ${String(e).slice(0, 400)}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  return { ctx, page, shot: async (n) => { await page.screenshot({ path: path.join(out, `${tag}-${n}.png`) }); log('shot', `${tag}-${n}.png`); } };
}

async function startRun(page) {
  const newRun = page.getByRole('button', { name: /New run/i });
  if (await newRun.count()) { await newRun.first().click(); await page.waitForTimeout(500); }
  const begin = page.getByRole('button', { name: /Begin the 14 days/i });
  await begin.first().click();
  await page.waitForTimeout(2200);
}

const view = (page) => page.evaluate(() => (window).__sohView ? (window).__sohView() : null);

for (const [w, h, tag] of [[640, 360, '640x360'], [1280, 720, '1280x720']]) {
  const { ctx, page, shot } = await session(w, h, tag);
  await shot('01-title');
  await page.getByRole('button', { name: /New run/i }).first().click();
  await page.waitForTimeout(600);
  await shot('02-select');
  await page.getByRole('button', { name: /Begin the 14 days/i }).first().click();
  await page.waitForTimeout(2500);
  await shot('03-spawn');

  // real locomotion: hold D then S, capture mid-stride
  await page.mouse.move(w * 0.62, h * 0.5);
  await page.keyboard.down('d'); await page.waitForTimeout(900);
  await shot('04-walk');
  await page.keyboard.up('d');
  await page.keyboard.down('s'); await page.waitForTimeout(600); await page.keyboard.up('s');
  await page.waitForTimeout(200);

  // swing / harvest attempt at whatever is in front
  for (let i = 0; i < 6; i++) { await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up(); await page.waitForTimeout(160); }
  await shot('05-action');

  await page.keyboard.press('i'); await page.waitForTimeout(450); await shot('06-inventory');
  await page.keyboard.press('i'); await page.waitForTimeout(200);
  await page.keyboard.press('c'); await page.waitForTimeout(450); await shot('07-craft');
  await page.keyboard.press('c'); await page.waitForTimeout(200);
  await page.keyboard.press('m'); await page.waitForTimeout(500); await shot('08-map');
  await page.keyboard.press('m'); await page.waitForTimeout(200);
  await page.keyboard.press('b'); await page.waitForTimeout(450); await shot('09-build');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(450); await shot('10-menu');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);

  if (script !== 'baseline') {
    try { await (await import('./flow.mjs')).run({ page, shot, w, h, view, log }); }
    catch (e) { log('flow error', String(e).slice(0, 400)); }
  }
  log(tag, 'view', JSON.stringify(await view(page)));
  await ctx.close();
}

await browser.close(); server.close();
fs.writeFileSync(path.join(out, 'console-errors.json'), JSON.stringify(errors, null, 2));
log('CONSOLE ERRORS:', errors.length);
errors.slice(0, 12).forEach(e => log('  ', e));
