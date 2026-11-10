import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const dist = path.resolve('dist'); const out = path.resolve('evidence/wave4'); fs.mkdirSync(out, { recursive: true });
const server = http.createServer((q, s) => { s.writeHead(200, { 'Content-Type': 'text/html' }); fs.createReadStream(path.join(dist, 'index.html')).pipe(s); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ args: ['--no-sandbox'] }); const errors = []; const log = [];
for (const [w, h, tag] of [[640, 360, '640'], [1280, 720, '1280']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[${tag}] ${String(e).slice(0, 200)}`)); page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] ${m.text().slice(0, 160)}`); });
  const shot = n => page.screenshot({ path: `${out}/${tag}-${n}.png` });
  await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Full-Gear QA Sandbox/i }).click(); await page.waitForTimeout(200);
  await page.locator('.dirbtn', { hasText: 'Full-Gear World' }).first().click(); await page.getByRole('button', { name: /Launch QA Sandbox/i }).click();
  await page.waitForTimeout(900); await page.keyboard.press('F9'); await page.waitForTimeout(3500); await shot('01-normal-play');
  await page.keyboard.press('KeyI'); await page.waitForTimeout(400); await shot('02-survivor-screen');
  // real drag: pack slot 12 -> hotbar slot 7 (index 6)
  const src = page.locator('.sv [data-c="inv"][data-s="12"]'), dst = page.locator('.sv [data-c="inv"][data-s="6"]');
  const a = await src.boundingBox(), b = await dst.boundingBox();
  const before = await src.getAttribute('title'), beforeDst = await dst.getAttribute('title');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(a.x + 30, a.y - 10, { steps: 4 }); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await shot('03-dragging');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(250);
  log.push(`[${tag}] drag: src '${before}' -> hotbar6 now '${await dst.getAttribute('title')}' (was '${beforeDst}')`);
  // hover + digit: pack slot 14 -> hotbar 8
  const h14 = page.locator('.sv [data-c="inv"][data-s="14"]'); const t14 = await h14.getAttribute('title'); await h14.hover(); await page.keyboard.press('Digit8'); await page.waitForTimeout(250);
  log.push(`[${tag}] hover+8: '${t14}' -> slot7 '${await page.locator('.sv [data-c="inv"][data-s="7"]').getAttribute('title')}'`);
  // click = inspect (no hidden pick-up state)
  await page.locator('.sv [data-c="inv"][data-s="0"]').click(); await page.waitForTimeout(200); await shot('04-survivor-inspect');
  await page.locator('.sv-cat', { hasText: 'Stations' }).click(); await page.waitForTimeout(200); await shot('05-survivor-stations');
  await page.locator('.sv-cat', { hasText: 'All' }).click(); await page.waitForTimeout(150);
  // craft something cheap by hand (real dispatch) → expect FEED line, not centre plaque
  await page.getByRole('button', { name: /ready/ }).click(); await page.waitForTimeout(150);
  const hand = page.locator('.sv-tile.ok').first(); if (await hand.count()) { await hand.click(); await page.waitForTimeout(100); }
  const go = page.locator('.sv-go'); const goTxt = await go.textContent(); if (await go.isEnabled()) { await go.click(); log.push(`[${tag}] crafted via '${goTxt}'`); }
  await page.waitForTimeout(150); await page.keyboard.press('Escape'); await page.waitForTimeout(500); await shot('06-feed-after-craft');
  log.push(`[${tag}] feed lines: ${await page.locator('.feed__line').count()} · centre plaques: ${await page.locator('.xp-plaque').count()}`);
  await page.keyboard.press('KeyB'); await page.waitForTimeout(300); await page.mouse.move(w * 0.62, h * 0.42); await page.waitForTimeout(200); await shot('07-build-mode');
  await page.keyboard.press('Digit2'); await page.waitForTimeout(150); await page.keyboard.press('KeyU'); await page.waitForTimeout(200); await shot('08-build-upgrade-tool');
  await page.keyboard.press('KeyB'); await page.waitForTimeout(250); await shot('09-build-exited');
  await ctx.close();
}
await browser.close(); server.close();
fs.writeFileSync(`${out}/run-log.json`, JSON.stringify({ log, errors }, null, 2)); console.log(log.join('\n')); console.log('errors', errors.length, errors.slice(0, 4));
