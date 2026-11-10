import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const dist = path.resolve('dist'); const out = path.resolve('evidence/wave3'); fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); fs.createReadStream(path.join(dist, 'index.html')).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ args: ['--no-sandbox'] }); const errors = [];
for (const [w, h, tag] of [[640, 360, '640'], [1280, 720, '1280']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Full-Gear QA Sandbox/i }).click(); await page.waitForTimeout(250);
  await page.getByRole('button', { name: /Adventurer ♂/ }).first().click();
  await page.locator('.dirbtn', { hasText: 'Utility Motorbike' }).first().click(); await page.getByRole('button', { name: /Launch QA Sandbox/i }).click();
  await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/${tag}-07-bike-parked-on-foot.png` });
  await page.getByRole('button', { name: /Anim & Bike/i }).click(); await page.waitForTimeout(200);
  const demo = page.getByRole('button', { name: /Approach → Mount/i });
  const enabled = await demo.isEnabled(); console.log(tag, 'demo enabled', enabled);
  if (enabled) {
    await demo.click();
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(650); await page.screenshot({ path: `${out}/${tag}-08-bike-seq-${i}.png` }); }
    await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/${tag}-09-bike-dismounted.png` });
    const st = await page.evaluate(() => { const v = window.__sohView?.(); return v ? { target: v.target } : null; }); console.log(tag, JSON.stringify(st));
  }
  await ctx.close();
}
await browser.close(); server.close(); console.log('errors', errors.length, errors.slice(0, 4));
