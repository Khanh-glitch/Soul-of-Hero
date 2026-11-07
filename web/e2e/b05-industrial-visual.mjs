// B05 visual proof (CONTROLLED FIXTURE, disclosed). Loads the W08-M3 industrial save (real build/place intents in setup).
// Visual-only in-page state changes, each labelled in results.json:
//   - bike fuel/angle/cargo set to show the sprite states (real travel sets the angle via sim; the set here is a snapshot of that field);
//   - refinery burn + one queued job set to show the lit sprite (real processing is covered by tests/s10-oil-refinery and motorbike tests).
// Output: evidence/b05-industrial/*.png and results.json.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = 'evidence/b05-industrial'; await fs.mkdir(out, { recursive: true });
const snap = await fs.readFile('evidence/w08m3-industrial/save.json', 'utf8');
const browser = await chromium.launch({ headless: true, executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const results = { fixtures: [], shots: [], errors: [], notCaptured: [] };
async function open(vp) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript(v => localStorage.setItem('soh.state.v3', v), snap);
  const page = await ctx.newPage();
  page.on('pageerror', e => results.errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4410', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Continue/i }).first().click();
  const ov = page.getByRole('button', { name: 'Continue', exact: true });
  if (await ov.isVisible().catch(() => false)) await ov.click();
  await page.waitForFunction(() => window.__soh?.run, null, { timeout: 20000 });
  await page.waitForTimeout(700);
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible().catch(() => false)) { await close.click(); await page.waitForTimeout(300); }
  return { ctx, page };
}
const shot = async (page, name, vn, target, state) => { const p = `${out}/${name}-${vn}.png`; await page.screenshot({ path: p }); results.shots.push({ path: p, viewport: vn, target, state, camera: 'follows player; player relocated beside the bike (fixture)' }); };
const relocateNearBike = (page, vn) => page.evaluate(() => {
  const r = window.__soh.run; const b = Object.values(r.entities).find(e => e.kind === 'vehicle');
  r.player.x = b.x - 36; r.player.y = b.y + 14; // fixture: stand just left of the bike so the camera centres the vehicle
  return { bike: { id: b.id, x: b.x, y: b.y }, player: { x: r.player.x, y: r.player.y } };
}).then(f => results.fixtures.push({ viewport: vn, kind: 'player relocated next to motorbike (disclosed visual fixture; no transaction)', ...f }));
const setBike = (page, patch) => page.evaluate(p => {
  const r = window.__soh.run; const b = Object.values(r.entities).find(e => e.kind === 'vehicle');
  if (p.fuel !== undefined) b.vehicle.fuel = p.fuel;
  if (p.angle !== undefined) b.vehicle.angle = p.angle;
  if (p.cargo) { const c = r.custody[b.c]; c.slots[0] = { uid: 'b05-wood', key: 'wood', qty: 12 }; c.slots[1] = { uid: 'b05-plate', key: 'iron_plate', qty: 2 }; }
  return b.id;
}, patch);
try {
  for (const [vn, vp] of [['640x360', { width: 640, height: 360 }], ['1280x720', { width: 1280, height: 720 }]]) {
    const { ctx, page } = await open(vp);
    const info = await page.evaluate(() => { const r = window.__soh.run; const b = Object.values(r.entities).find(e => e.kind === 'vehicle'); const f = Object.values(r.entities).find(e => e.type === 'refinery'); return { bike: b ? { x: b.x, y: b.y, fuel: b.vehicle.fuel, hp: b.hp } : null, refinery: f ? { tx: f.tx, ty: f.ty, burn: f.station?.burn ?? 0, queue: f.station?.queue.length ?? 0 } : null, player: { x: r.player.x, y: r.player.y } }; });
    results[`initial.${vn}`] = info;
    await relocateNearBike(page, vn); await page.waitForTimeout(500);
    // 1. refinery as saved (idle: no fuel burning, no queued job)
    await page.evaluate(() => { const r = window.__soh.run; const f = Object.values(r.entities).find(e => e.type === 'refinery'); if (f) f.station.burn = 0; });
    await page.waitForTimeout(250); await shot(page, 'refinery-idle', vn, 'refinery', 'idle, burn=0, no job');
    // 2. refinery lit: fuelled and one queued job (fixture: visual state only)
    await page.evaluate(() => { const r = window.__soh.run; const f = Object.values(r.entities).find(e => e.type === 'refinery'); f.station.burn = 14; if (!f.station.queue.length) f.station.queue.push({ id: 'b05-vis', recipe: 'refinery_fuel', left: 9000, total: 14000, reserved: [] }); });
    await page.waitForTimeout(300); await shot(page, 'refinery-lit', vn, 'refinery', 'lit fixture: burn=14 and one queued job (visual state only)');
    // 3. motorbike states (fixture field changes): fuelled right, left, down, up; then empty tank; then loaded with cargo
    await setBike(page, { fuel: 200, angle: 0 }); await page.waitForTimeout(250); await shot(page, 'bike-right-ok', vn, 'motorbike', 'fuel 200, angle 0 (side, facing right)');
    await setBike(page, { angle: Math.PI }); await page.waitForTimeout(250); await shot(page, 'bike-left-ok', vn, 'motorbike', 'fuel 200, angle PI (side, facing left)');
    await setBike(page, { angle: Math.PI / 2 }); await page.waitForTimeout(250); await shot(page, 'bike-down-ok', vn, 'motorbike', 'fuel 200, angle PI/2 (front)');
    await setBike(page, { angle: -Math.PI / 2, cargo: true }); await page.waitForTimeout(250); await shot(page, 'bike-up-ok-cargo', vn, 'motorbike', 'fuel 200, angle -PI/2 (back), cargo 12 wood + 2 plate (fixture cargo)');
    await setBike(page, { fuel: 0, angle: 0, cargo: true }); await page.waitForTimeout(250); await shot(page, 'bike-right-dead-cargo', vn, 'motorbike', 'fuel 0 (depleted), cargo fixture');
    results[`bike.${vn}`] = await page.evaluate(() => { const b = Object.values(window.__soh.run.entities).find(e => e.kind === 'vehicle'); return { fuel: b.vehicle.fuel, angle: b.vehicle.angle, cargoSlots: window.__soh.run.custody[b.c].slots.filter(Boolean).length }; });
    // 4. lubricant icon in the inventory panel (real key I), inventory opened with a jug
    await page.evaluate(() => { const r = window.__soh.run; const s = r.custody.inv.slots; s[s.findIndex(x => !x)] = { uid: 'b05-lube', key: 'lubricant', qty: 2 }; });
    await page.keyboard.press('KeyI'); await page.waitForTimeout(350); await shot(page, 'inventory-lubricant', vn, 'inventory', 'lubricant fixture slot');
    await ctx.close();
  }
  results.notCaptured.push('cart: no cart entity exists in the W08-M3 fixture save and placeCart is not driven here; cart silhouette and cart-vs-bike comparison NOT captured');
  if (results.errors.length) throw Error(results.errors.join('; '));
  console.log('OK', JSON.stringify(results, null, 1));
} finally {
  await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 1));
  await browser.close();
}
