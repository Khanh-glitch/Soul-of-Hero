import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const dist = path.resolve('dist'); const out = path.resolve('evidence/wave3'); fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => { let f = path.join(dist, 'index.html'); res.writeHead(200, { 'Content-Type': 'text/html' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
for (const [w, h, tag] of [[640, 360, '640'], [1280, 720, '1280']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[${tag}] ${String(e).slice(0, 200)}`)); page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] ${m.text().slice(0, 200)}`); });
  await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Full-Gear QA Sandbox/i }).click(); await page.waitForTimeout(300);
  await page.locator('.dirbtn', { hasText: 'Full-Gear World' }).first().click(); await page.getByRole('button', { name: /Launch QA Sandbox/i }).click();
  await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/${tag}-01-entry-event.png` });
  await page.keyboard.press('F9'); await page.waitForTimeout(300);
  await page.keyboard.press('KeyI'); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/${tag}-02-inventory.png` });
  // select a slot to show the item card
  await page.locator('.inv .slot').nth(0).dispatchEvent('mousedown', { button: 0 }); await page.waitForTimeout(300); await page.screenshot({ path: `${out}/${tag}-03-inventory-item.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.keyboard.press('KeyC'); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/${tag}-04-craft.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.keyboard.press('KeyB'); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/${tag}-05-build.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  // hand craft rope to trigger a real forge event plaque (fiber present in full gear? use energy_basic recipe needs stone+fiber)
  await page.keyboard.press('KeyC'); await page.waitForTimeout(300);
  const craftBtn = page.locator('.craft .recipe-meta .btn');
  if (await craftBtn.count() && await craftBtn.first().isEnabled()) { await craftBtn.first().click(); await page.waitForTimeout(250); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(350); await page.screenshot({ path: `${out}/${tag}-06-craft-event.png` });
  await ctx.close();
}
await browser.close(); server.close();
fs.writeFileSync(`${out}/console-errors.json`, JSON.stringify(errors, null, 2)); console.log('errors', errors.length, errors.slice(0, 5));
