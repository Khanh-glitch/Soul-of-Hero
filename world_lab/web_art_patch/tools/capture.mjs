// Reproducible real-browser A/B capture for the Fisher's Point map-art slice.
// Serves a built `dist/index.html` (see serve.mjs), drives real keyboard input.
//
//   GAME_URL=http://127.0.0.1:4180 ART_OUT=evidence/before node capture.mjs
//   GAME_URL=http://127.0.0.1:4181 ART_OUT=evidence/after  node capture.mjs
//
// CHROMIUM_PATH may point at a Chromium binary; otherwise Playwright's own browser is used.
// LD_LIBRARY_PATH should be set in the shell when using a standalone Chromium build.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(process.env.ART_OUT || 'art-shots');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4181';
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage(); page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const manifest = { url: URL, browser: browser.version(), seed: null, startedAt: null, shots: [], route: [], errors };

const hold = async (code, ms) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code); };
const state = () => page.evaluate(() => {
  const r = window.__soh?.run; if (!r) return null;
  const len = 24 * 60000;
  const elapsed = Date.now() - r.startedAt + r.qaOffset;
  const dayTime = (((elapsed + len * 0.3) % len) + len) % len / len;
  const dark = Math.max(0, Math.min(0.78, 0.5 - Math.cos((dayTime - 0.5) * Math.PI * 2) * 0.85));
  return {
    x: Math.round(r.player.x * 100) / 100, y: Math.round(r.player.y * 100) / 100,
    hp: r.player.hp, hunger: r.player.hunger, thirst: r.player.thirst, dead: r.player.dead,
    qaOffset: r.qaOffset, dayTime: Math.round(dayTime * 1000) / 1000,
    dark: Math.round(dark * 1000) / 1000, weatherSlot: r.clock.weatherSlot, regionName: r.player.regionName,
  };
});
const shot = async name => {
  for (const [w, h] of [[640, 360], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(280);
    const file = `${name}-${w}x${h}.png`;
    await page.screenshot({ path: path.join(OUT, file), animations: 'disabled' });
    manifest.shots.push({ file, ...(await state()), w, h });
  }
  await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(150);
};
// In-game QA time button (+1h), reached through the real paused menu. No teleport.
const qaHour = async () => {
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const cont = page.getByRole('button', { name: 'Continue', exact: true });
  if (await cont.count() && await cont.isVisible().catch(() => false)) {
    await cont.click(); await page.waitForTimeout(200);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  }
  await page.getByRole('button', { name: '+1h', exact: true }).click();
  await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
};

try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'New run' }).click(); await page.waitForTimeout(350);
  await page.getByRole('button', { name: "Fisher's Point", exact: true }).click(); await page.waitForTimeout(350);
  await page.getByRole('button', { name: /Begin the 14 days/ }).click();
  await page.waitForFunction(() => Boolean(window.__soh?.run), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  manifest.seed = await page.evaluate(() => window.__soh.run.seed);
  manifest.startedAt = await page.evaluate(() => window.__soh.run.startedAt);
  console.log('spawn', JSON.stringify(await state()));
  await shot('day-spawn');
  await qaHour(); console.log('night', JSON.stringify(await state()));
  await shot('night-spawn');
  // Real physical traversal: south from the Net Shed to the surf, then west along the beach.
  const route = [['KeyS', 2800], ['KeyA', 2200], ['KeyA', 1200]];
  for (const [k, ms] of route) {
    await hold(k, ms);
    const s = await state(); manifest.route.push({ key: k, ms, ...s });
    console.log('walk', k, ms, s.x, s.y);
  }
  await page.waitForTimeout(300);
  await shot('night-walk');
  await qaHour(); console.log('day2', JSON.stringify(await state()));
  await shot('day-walk');
  console.log('ERRORS', JSON.stringify(errors));
} catch (e) { console.error('CAPTURE_FAIL', e); manifest.fatal = String(e); process.exitCode = 1; }
await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
await browser.close();
