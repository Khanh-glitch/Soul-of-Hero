// C4 motorbike controlled matrix: angle x state x mounted, native 1x at 640x360 and 1280x720.
// Angles are forced on the bike entity (right 0, toward camera pi/2, left pi, away -pi/2); the expected view is
// computed with the same rule as vehicleView (|cos|>=|sin| -> side, else front if sin>0 else back).
// DISCLOSED FIXTURES (visual state only): READY sets fuel 120; OUT OF FUEL keeps the save's fuel 0; BROKEN sets hp 0.
// Mount uses the real vehicleMount action; the player is placed beside the bike, so the camera is the game's own.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = 'evidence/c4-motorbike-matrix'; await fs.mkdir(out, { recursive: true });
const seed = await fs.readFile('evidence/w08m3-industrial/save.json', 'utf8');
const BASE = process.env.GAME_URL || 'http://127.0.0.1:4430';
const expView = a => { const c = Math.cos(a), s = Math.sin(a); if (Math.abs(c) >= Math.abs(s)) return { view: 'side', mirror: c < 0 }; return { view: s > 0 ? 'front' : 'back', mirror: false }; };
const ANGLES = [['right', 0], ['toward', Math.PI / 2], ['left', Math.PI], ['away', -Math.PI / 2]];
const STATES = [['ready', 'fuel120', false], ['empty', null, false], ['broken', 'hp0', false], ['ready-mounted', 'fuel120', true]];
const browser = await chromium.launch({ headless: true, executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const results = { base: BASE, shots: [], errors: [] };
try {
  for (const [vn, vp] of [['1280x720', { width: 1280, height: 720 }], ['640x360', { width: 640, height: 360 }]]) {
    for (const [sn, fixture, mount] of STATES) for (const [an, ang] of ANGLES) {
      const ctx = await browser.newContext({ viewport: vp });
      await ctx.addInitScript(v => { if (!localStorage.getItem('soh.driver.seeded')) { localStorage.setItem('soh.state.v3', v); localStorage.setItem('soh.driver.seeded', '1'); } }, seed);
      const page = await ctx.newPage(); page.on('pageerror', e => results.errors.push(e.message));
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Continue/i }).first().click();
      await page.waitForFunction(() => window.__soh?.run, null, { timeout: 25000 });
      for (let i = 0; i < 4; i++) { await page.waitForTimeout(500); const b = page.getByRole('button', { name: 'Close', exact: true }).first(); if (!(await b.isVisible().catch(() => false))) break; await b.click(); await page.waitForTimeout(300); }
      const fx = await page.evaluate(([fixture, mount, ang]) => {
        const r = window.__soh.run; const bike = Object.values(r.entities).find(e => e.kind === 'vehicle');
        if (fixture === 'fuel120') bike.vehicle.fuel = 120;
        if (fixture === 'hp0') bike.hp = 0;
        bike.vehicle.angle = ang;
        r.player.x = mount ? bike.x - 14 : bike.x - 36; r.player.y = mount ? bike.y + 6 : bike.y + 14;
        return { bike: bike.id, x: bike.x, y: bike.y };
      }, [fixture, mount, ang]);
      if (mount) await page.evaluate(id => window.__sohQA.act('vehicleMount', { eid: id }), fx.bike);
      await page.waitForTimeout(700);
      const st = await page.evaluate(() => { const r = window.__soh.run; const b = Object.values(r.entities).find(e => e.kind === 'vehicle'); return { fuel: b.vehicle.fuel, hp: b.hp, angle: b.vehicle.angle, mounted: r.player.vehicle === b.id, camX: r.cam?.x, camY: r.cam?.y }; });
      const p = `${out}/${sn}-${an}-${vn}.png`; await page.screenshot({ path: p });
      results.shots.push({ path: p, viewport: vn, state: sn, angle: an, radians: ang, expectedView: expView(ang), mounted: mount, bike: fx, after: st });
      await ctx.close();
    }
  }
  if (results.errors.length) throw Error(results.errors.join('; '));
  console.log('C4_MATRIX_CAPTURED', results.shots.length);
} catch (e) { results.failure = String(e.message || e); console.log('FAILED', results.failure); process.exitCode = 1; }
finally { await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 1)); await browser.close(); }
