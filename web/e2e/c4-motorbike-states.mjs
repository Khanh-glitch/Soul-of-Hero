// C4 motorbike: native 1x captures of READY / OUT OF FUEL / BROKEN, and mounted vs unmounted (rider).
// Save: the W08-M3 fixture (motorbike e8h at 2296,1752; fuel 0, hp 200) = OUT OF FUEL, real state.
// DISCLOSED FIXTURES (visual state only): READY sets fuel 120; BROKEN sets hp 0. Mount uses the real vehicleMount action.
// Player is placed beside the bike (fixture) so the bike is in frame; the camera is the game's own.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = 'evidence/c4-motorbike'; await fs.mkdir(out, { recursive: true });
const seed = await fs.readFile('evidence/w08m3-industrial/save.json', 'utf8');
const BASE = process.env.GAME_URL || 'http://127.0.0.1:4430';
const browser = await chromium.launch({ headless: true, executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const results = { base: BASE, shots: [], fixtures: [], errors: [] };
const cases = [
  { name: 'out-of-fuel', fixture: null, mount: false },
  { name: 'ready', fixture: 'fuel120', mount: false },
  { name: 'ready-mounted', fixture: 'fuel120', mount: true },
  { name: 'broken', fixture: 'hp0', mount: false },
];
try {
  for (const [vn, vp] of [['1280x720', { width: 1280, height: 720 }], ['640x360', { width: 640, height: 360 }]]) {
    for (const c of cases) {
      const ctx = await browser.newContext({ viewport: vp });
      await ctx.addInitScript(v => { if (!localStorage.getItem('soh.driver.seeded')) { localStorage.setItem('soh.state.v3', v); localStorage.setItem('soh.driver.seeded', '1'); } }, seed);
      const page = await ctx.newPage(); page.on('pageerror', e => results.errors.push(e.message));
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Continue/i }).first().click();
      await page.waitForFunction(() => window.__soh?.run, null, { timeout: 25000 });
      for (let i = 0; i < 4; i++) { await page.waitForTimeout(500); const b = page.getByRole('button', { name: 'Close', exact: true }).first(); if (!(await b.isVisible().catch(() => false))) break; await b.click(); await page.waitForTimeout(300); }
      const fx = await page.evaluate(([fixture, mountCase]) => {
        const r = window.__soh.run; const bike = Object.values(r.entities).find(e => e.kind === 'vehicle');
        if (fixture === 'fuel120') bike.vehicle.fuel = 120;
        if (fixture === 'hp0') bike.hp = 0;
        r.player.x = mountCase ? bike.x - 14 : bike.x - 36; r.player.y = mountCase ? bike.y + 6 : bike.y + 14;  // mount reach is 1.7 tiles
        return { bike: bike.id, x: bike.x, y: bike.y, fuel: bike.vehicle.fuel, hp: bike.hp };
      }, [c.fixture, c.mount]);
      let mounted = null;
      if (c.mount) mounted = await page.evaluate(([id]) => window.__sohQA.act('vehicleMount', { eid: id }), [fx.bike]);
      await page.waitForTimeout(700);
      const st = await page.evaluate(() => { const r = window.__soh.run; const b = Object.values(r.entities).find(e => e.kind === 'vehicle'); return { fuel: b.vehicle.fuel, hp: b.hp, mounted: r.player.vehicle === b.id }; });
      const p = `${out}/motorbike-${c.name}-${vn}.png`; await page.screenshot({ path: p });
      results.shots.push({ path: p, viewport: vn, state: c.name, fixture: c.fixture, mountAction: c.mount ? mounted : null, state_after: st, bikeAt: fx });
      await ctx.close();
    }
  }
  if (results.errors.length) throw Error(results.errors.join('; '));
  console.log('C4_BIKE_CAPTURED');
} catch (e) { results.failure = String(e.message || e); console.log('FAILED', results.failure); process.exitCode = 1; }
finally { await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 1)); await browser.close(); }
