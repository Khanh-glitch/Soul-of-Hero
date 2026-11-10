// Wave 2 end-to-end visual & interactive verification driver.
// Serves dist/ over HTTP and exercises real browser input across all Wave 2 systems.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const dist = path.resolve('dist');
const out = path.resolve('evidence/wave2');
fs.mkdirSync(out, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  let f = path.join(dist, u === '/' ? 'index.html' : u);
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader'] });
const errors = [];
const log = (...a) => console.log(...a);

for (const [w, h, tag] of [[640, 360, '640x360'], [1280, 720, '1280x720']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => errors.push(`[${tag}] PAGEERROR ${String(e).slice(0, 400)}`));
  const shot = async (n) => { await page.screenshot({ path: path.join(out, `${tag}-${n}.png`) }); log('shot', `${tag}-${n}.png`); };

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await shot('01-title');

  // Open Full-Gear QA Sandbox preset picker
  await page.getByRole('button', { name: /Full-Gear QA Sandbox/i }).first().click();
  await page.waitForTimeout(450);
  await shot('02-qa-picker');

  // Launch into All 11 Cores preset
  await page.locator('.dirbtn', { hasText: 'All 7 Creator Cores' }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /Launch QA Sandbox/i }).first().click();
  await page.waitForTimeout(1400);
  await shot('03-cores-discovery');

  // Close QA drawer briefly to capture clean Core HUD + cast a Core skill
  await page.keyboard.press('F9');
  await page.waitForTimeout(300);
  await page.mouse.move(w * 0.68, h * 0.5);
  await page.mouse.down(); await page.waitForTimeout(220); await page.mouse.up();
  await page.waitForTimeout(350);
  await shot('04-core-cast');

  // Open QA Lab [F9] -> Switch to Six Elder Boss Arena -> Trigger Overheat 2x Vuln
  await page.keyboard.press('F9');
  await page.waitForTimeout(300);
  await page.locator('.dirbtn', { hasText: 'Six Elder Boss Arena' }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /^Events$/i }).first().click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: /Trigger 2× Vuln Window/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.press('F9'); // hide drawer to inspect clean Elder Boss HUD + world ring
  await page.waitForTimeout(300);
  await shot('05-elder-boss');

  // Open QA Lab [F9] -> Switch to Industrial Compound -> Open Station Console & queue real craft job
  await page.keyboard.press('F9');
  await page.waitForTimeout(300);
  await page.locator('.dirbtn', { hasText: 'Home, Power & Industrial Compound' }).first().click();
  await page.waitForTimeout(900);
  await page.keyboard.press('F9');
  await page.waitForTimeout(250);
  // Walk 1 tile east to stand right beside the Furnace / Refinery and press E to open StationConsole
  await page.keyboard.down('d'); await page.waitForTimeout(240); await page.keyboard.up('d');
  await page.waitForTimeout(200);
  await page.keyboard.press('e');
  await page.waitForTimeout(450);
  // Queue a real job if Queue job button is enabled
  const qBtn = page.getByRole('button', { name: /Queue job/i });
  if (await qBtn.count() && await qBtn.first().isEnabled()) {
    await qBtn.first().click();
    await page.waitForTimeout(400);
    log(`[${tag}] StationConsole real craft job queued!`);
  }
  await shot('06-station-console');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Open QA Lab [F9] -> Switch to Vehicle & Freight Convoy -> Run Automated Mount->Drive->Steer->Dismount Demo
  await page.keyboard.press('F9');
  await page.waitForTimeout(300);
  await page.locator('.dirbtn', { hasText: 'Utility Motorbike & Freight Convoy' }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /Anim & Bike/i }).first().click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: /Run Full Mount/i }).first().click();
  await page.waitForTimeout(1150); // mid-drive mounted!
  await shot('07-motorbike-riding');
  await page.waitForTimeout(2100); // dismounted

  // Inspect 1x Asset Inspector tab
  await page.getByRole('button', { name: /1× Assets/i }).first().click();
  await page.waitForTimeout(350);
  await shot('08-asset-inspector');

  // Switch to Offline Return Chronicle preset
  await page.getByRole('button', { name: /^Presets$/i }).first().click();
  await page.waitForTimeout(250);
  await page.locator('.dirbtn', { hasText: 'Offline Return Chronicle' }).first().click();
  await page.waitForTimeout(700);
  await shot('09-offline-return');
  await page.getByRole('button', { name: /Enter the Island/i }).first().click();
  await page.waitForTimeout(350);

  // QaSandboxDrawer automatically reappears once ReportPanel closes!
  // Switch to Ragnarok Economy & Evacuation preset
  await page.locator('.dirbtn', { hasText: 'Ragnarok, Escrow & Evacuation' }).first().click();
  await page.waitForTimeout(800);
  await page.keyboard.press('F9');
  await page.waitForTimeout(300);
  await shot('10-ragnarok-hud');

  // Switch to Fallen Adventurer & Bag Recovery preset -> test Death overlay & Rise & Recover
  await page.keyboard.press('F9');
  await page.waitForTimeout(300);
  await page.locator('.dirbtn', { hasText: 'Fallen Adventurer & Bag Recovery' }).first().click();
  await page.waitForTimeout(800);
  await shot('11-death-recovery');
  const rise = page.getByRole('button', { name: /Rise & Recover Gear/i });
  if (await rise.count()) {
    await rise.first().click();
    await page.waitForTimeout(450);
    await shot('12-respawned');
  }

  await ctx.close();
}

await browser.close();
server.close();
fs.writeFileSync(path.join(out, 'console-errors.json'), JSON.stringify(errors, null, 2));
log('WAVE 2 CONSOLE ERRORS:', errors.length);
errors.forEach(e => log('  ', e));
