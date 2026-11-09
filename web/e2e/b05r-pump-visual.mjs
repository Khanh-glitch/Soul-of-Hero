// B05-R pump visual proof (CONTROLLED FIXTURE, disclosed). Loads the W08-M3 industrial save and, IN PAGE ONLY,
// registers a labelled TEST-FIXTURE oil source and a pump entity on the player's tile. Visual states are derived from
// the real pumpStateKey inputs (source stock, burn, queue); no production source exists in the shipping world.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = 'evidence/b05r-pump'; await fs.mkdir(out, { recursive: true });
const snap = await fs.readFile('evidence/w08m3-industrial/save.json', 'utf8');
const browser = await chromium.launch({ headless: true, executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const results = { fixture: 'TEST-FIXTURE oil source (test-fixture-v1) + pump entity injected in page; not a Map site', shots: [], errors: [] };
const errors = results.errors;
try {
  for (const [vn, vp] of [['640x360', { width: 640, height: 360 }], ['1280x720', { width: 1280, height: 720 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addInitScript(v => localStorage.setItem('soh.state.v3', v), snap);
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4410', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Continue/i }).first().click();
    const ov = page.getByRole('button', { name: 'Continue', exact: true });
    if (await ov.isVisible().catch(() => false)) await ov.click();
    await page.waitForFunction(() => window.__soh?.run, null, { timeout: 20000 });
    await page.waitForTimeout(600);
    const close = page.getByRole('button', { name: 'Close', exact: true });
    if (await close.isVisible().catch(() => false)) { await close.click(); await page.waitForTimeout(300); }
    // place the pump at the player's tile on the fixture source, with a fuel stock and an output container
    await page.evaluate(() => {
      const r = window.__soh.run; r.player.x -= 32; const tx = Math.floor(r.player.x / 16) + 2, ty = Math.floor(r.player.y / 16);
      r.oilSources = r.oilSources ?? {}; r.oilSources[`oil:${tx}:${ty}`] = { tx, ty, stock: 9, authority: 'test-fixture-v1' };
      const mk = (k) => { const id = 'c' + k + Math.random().toString(36).slice(2, 6); r.custody[id] = { id, kind: k, slots: new Array(6).fill(null) }; return id; };
      r.entities['b05r-pump'] = { id: 'b05r-pump', kind: 'struct', type: 'oil_pump', x: tx * 16 + 8, y: ty * 16 + 8, tx, ty, hp: 160, maxHp: 160,
        station: { queue: [], burn: 0, fuelC: mk('fuel'), outC: mk('out'), stateCode: 'idle' } };
      window.__b05rPump = r.entities['b05r-pump'];
    });
    const shot = async (name) => { const p = `${out}/${name}-${vn}.png`; await page.screenshot({ path: p }); results.shots.push(p); };
    await page.waitForTimeout(250); await shot('pump-idle');
    await page.evaluate(() => { const e = window.__b05rPump; e.station.burn = 12000; e.station.queue.push({ id: 'b05r-j', recipe: 'pump_crude', left: 6000, total: 12000, reserved: [] }); });
    await page.waitForTimeout(250); await shot('pump-run-a');
    await page.waitForTimeout(400); await shot('pump-run-b');
    await page.evaluate(() => { const r = window.__soh.run; const e = window.__b05rPump; e.station.queue = []; e.station.burn = 0; r.oilSources[`oil:${e.tx}:${e.ty}`].stock = 0; });
    await page.waitForTimeout(250); await shot('pump-dry');
    // the crude drum in the output and the inventory icon
    await page.evaluate(() => { const r = window.__soh.run; const e = window.__b05rPump; r.oilSources[`oil:${e.tx}:${e.ty}`].stock = 3; r.custody[e.station.outC].slots[0] = { uid: 'b05r-crude', key: 'crude_petroleum', qty: 3 }; r.custody.inv.slots[0] = { uid: 'b05r-crude-inv', key: 'crude_petroleum', qty: 2 }; });
    await page.keyboard.press('KeyI'); await page.waitForTimeout(350); await shot('inventory-crude');
    await ctx.close();
  }
  if (errors.length) throw Error(errors.join('; '));
  console.log('OK');
} finally {
  await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 1));
  await browser.close();
}
