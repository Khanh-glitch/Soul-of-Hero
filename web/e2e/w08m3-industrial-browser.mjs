// W08-M3 Delivery 1 browser proof. Starts from e2e/w08m3-industrial-setup.mjs (CONTROLLED FIXTURE, disclosed there).
// After load, every gameplay action is real keyboard/mouse input on the game UI:
// E on refinery -> Queue industrial row -> wait for the batch on the game clock -> shift-click outputs into inventory
// -> walk to the deployed motorbike -> E -> Add 1 Fuel Canister -> Lubricate -> Enter and drive -> F exit -> save -> reopen.
// window.__soh is read-only observation for assertions.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir = 'evidence/w08m3-industrial';
const setup = JSON.parse(fs.readFileSync(`${dir}/setup.json`, 'utf8'));
const snap = fs.readFileSync(`${dir}/save.json`, 'utf8');
const trace = { labelled: setup.labelled, uid: setup.uid, inputs: [], observations: {} };
const input = (s) => trace.inputs.push(s);
const obs = (k, v) => { trace.observations[k] = v; console.log(k, JSON.stringify(v).slice(0, 600)); };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
await ctx.addInitScript(v => localStorage.setItem('soh.state.v3', v), snap);
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4190/', { waitUntil: 'networkidle' });
input('click Continue (title) — real');
await page.getByRole('button', { name: /Continue/i }).first().click();
await page.waitForFunction(() => window.__soh?.run);
await page.waitForTimeout(4000);
const ov = page.getByRole('button', { name: 'Continue', exact: true });
if (await ov.isVisible().catch(() => false)) { input('click overlay Continue — real'); await ov.click(); }
const S = (fn, arg) => page.evaluate(fn, arg);
const refState = () => S(id => { const r = window.__soh.run, e = r.entities[id]; return { queue: e.station.queue.map(j => ({ recipe: j.recipe, left: j.left, total: j.total })), burn: e.station.burn, fuel: r.custody[e.station.fuelC].slots.filter(Boolean).map(s => ({ uid: s.uid, key: s.key, qty: s.qty })), out: r.custody[e.station.outC].slots.filter(Boolean).map(s => ({ uid: s.uid, key: s.key, qty: s.qty })) }; }, setup.refineryId);
obs('REFINERY_BEFORE', await refState());

// --- 1. open the refinery with the real E key ---
const refPanel = page.locator('.panel').filter({ hasText: 'Industrial batch' }).first();
for (let k = 0; k < 4; k++) {
  await page.waitForTimeout(700);
  input('keyboard e (near refinery)');
  obs('E_ATTEMPT_'+k, await page.evaluate(() => [...document.querySelectorAll('.panel')].map(p => p.innerText.slice(0, 30)).concat(['prompt:' + ([...document.querySelectorAll('div')].find(d => /Use /.test(d.innerText || '') && d.innerText.length < 60)?.innerText || 'none')])));
  await page.keyboard.press('e');
  if (await refPanel.waitFor({ timeout: 1500 }).then(() => true).catch(() => false)) break;
}
await refPanel.waitFor({ timeout: 3000 });
await page.screenshot({ path: `${dir}/10-refinery-open-640.png` });

// --- 2. queue the paid industrial batch with the row's real Queue button ---
const rowTexts = await refPanel.locator('div').evaluateAll(ds => ds.map(d => d.innerText).filter(t => t && t.includes('Queue') && t.length < 160));
obs('REFINERY_RECIPE_ROWS', rowTexts);
obs('REFINERY_PANEL_TEXT', (await refPanel.innerText()).slice(0,700));
obs('PANEL_TITLES', await page.evaluate(() => [...document.querySelectorAll('.panel')].map(p => p.innerText.slice(0, 40))));
const row = refPanel.locator('div').filter({ hasText: 'Fuel Canister' }).filter({ hasText: 'Lubricant' }).filter({ has: page.getByRole('button', { name: 'Queue', exact: true }) }).last();
assert.equal(await row.count() > 0, true, 'industrial batch row not found');
await row.getByRole('button', { name: 'Queue', exact: true }).click();
input('click Queue on the 2 Fuel Canister + 1 Machine Lubricant row');
await page.waitForTimeout(400);
obs('AFTER_QUEUE', await refState());
await page.screenshot({ path: `${dir}/11-queued-640.png` });

// --- 3. let the batch run on the game clock (refinery burns the fixture fuel) ---
await page.keyboard.press('Escape'); input('keyboard Escape (close)');
await page.waitForTimeout(300);
let guard = 0;
while (guard++ < 40) {
  await page.waitForTimeout(3000);
  const st = await refState();
  if (st.out.some(s => s.key === 'lubricant') && st.queue.length === 0) break;
}
input('wait real game time (3 s polls) until batch completes');
obs('AFTER_BATCH', await refState());

// --- 4. collect both products with the real inventory UI (shift-click output slots) ---
await page.keyboard.press('e'); input('keyboard e (reopen refinery)');
const refPanel2 = page.locator('.panel').filter({ hasText: 'Industrial batch' }).first();
await refPanel2.waitFor({ timeout: 5000 });
for (const title of ['Fuel Canister', 'Machine Lubricant']) {
  const slot = refPanel2.locator(`[title="${title}"]`).first();
  if (await slot.count()) { await page.keyboard.down('Shift'); await slot.click(); await page.keyboard.up('Shift'); input(`shift-click output slot "${title}"`); await page.waitForTimeout(200); }
}
const collected = await S(id => { const r = window.__soh.run; return r.custody.inv.slots.filter(Boolean).filter(s => ['fuel_can', 'lubricant'].includes(s.key)).map(s => ({ uid: s.uid, key: s.key, qty: s.qty })); }, setup.refineryId);
obs('COLLECTED_INVENTORY', collected);
await page.screenshot({ path: `${dir}/12-collected-640.png` });
await page.keyboard.press('Escape'); input('keyboard Escape');

// --- 5. walk to the deployed motorbike (real held keys, position from the game) ---
const bikeNow = () => S(id => { const e = window.__soh.run.entities[id]; const p = window.__soh.run.player; return { bx: e.x, by: e.y, px: p.x, py: p.y, fuel: e.vehicle.fuel, lube: e.vehicle.lube || 0, odo: e.vehicle.odometer, hp: e.hp, uid: e.deployed.uid }; }, setup.bikeId);
{
  // Route on the game's own block grid (same blocked classes as the existing harness), then walk it with real held keys.
  const route = await S(async (id) => {
    const { blockGrid, sourceAt } = await import('/src/game/engine.ts');
    const r = window.__soh.run, e = r.entities[id], grid = blockGrid(r), WWn = 200;
    const sx = Math.floor(r.player.x / 16), sy = Math.floor(r.player.y / 16), gx = Math.floor(e.x / 16), gy = Math.floor(e.y / 16);
    const blocked = (x, y) => (grid[y * WWn + x] !== undefined && [1, 2, 3, 5].includes(grid[y * WWn + x])) || (() => { const src = sourceAt(r, x, y); return !!(src && src.stock > 0); })();
    const prev = new Map([[sy * WWn + sx, -1]]), q = [sy * WWn + sx];
    const goal = new Set([gy * WWn + gx]);
    for (let h = 0; h < q.length && h < 40000; h++) {
      const i = q[h]; if (goal.has(i)) break;
      const cx = i % WWn, cy = Math.floor(i / WWn);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = cx + dx, ny = cy + dy; const j = ny * WWn + nx;
        if (nx < 1 || ny < 1 || nx >= 199 || ny >= 199 || prev.has(j) || blocked(nx, ny)) continue;
        prev.set(j, i); q.push(j);
      }
    }
    // goal tile itself is the vehicle tile; accept the closest reached tile to it
    let best = null, bd = Infinity;
    for (const j of prev.keys()) { const d = Math.hypot(j % WWn - gx, Math.floor(j / WWn) - gy); if (d < bd) { bd = d; best = j; } }
    const path = []; for (let j = best; j !== -1 && j !== undefined; j = prev.get(j)) path.push([j % WWn, Math.floor(j / WWn)]);
    return { path: path.reverse(), reachedDist: bd, start: [sx, sy], goal: [gx, gy] };
  }, setup.bikeId);
  obs('ROUTE', { len: route.path.length, reachedDist: route.reachedDist, start: route.start, goal: route.goal });
  // thin the path to waypoints every 4 tiles
  const wps = route.path.filter((_, k) => k % 4 === 0 || k === route.path.length - 1);
  for (const [tx, ty] of wps) {
    for (let t = 0; t < 120; t++) {
      const b = await bikeNow(); const dx = tx * 16 + 8 - b.px, dy = ty * 16 + 8 - b.py;
      if (Math.hypot(dx, dy) < 6) break;
      const key = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'd' : 'a') : (dy > 0 ? 's' : 'w');
      await page.keyboard.down(key); await page.waitForTimeout(120); await page.keyboard.up(key);
    }
  }
}
obs('BLOCK_DIAG', await page.evaluate(async () => {
  const { blockGrid, sourceAt } = await import('/src/game/engine.ts');
  const r = window.__soh.run, g = blockGrid(r); const tx = Math.floor(r.player.x / 16), ty = Math.floor(r.player.y / 16);
  const cells = []; for (let dy = -2; dy <= 2; dy++) { const row = []; for (let dx = -2; dx <= 2; dx++) { const x = tx + dx, y = ty + dy; const src = sourceAt(r, x, y); row.push(g[y * 200 + x] + (src && src.stock > 0 ? 'S' + src.key : '')); } cells.push(row.join(' ')); }
  return { tile: [tx, ty], cells, ents: Object.values(r.entities).filter(e => Math.hypot(e.x - r.player.x, e.y - r.player.y) < 48).map(e => ({ k: e.kind, t: e.type, x: Math.round(e.x), y: Math.round(e.y) })), vehicle: r.player.vehicle || null };
}));
// final approach: real taps toward the bike until it is inside the interaction reach
{
  let flip = false, last = await bikeNow();
  for (let t = 0; t < 200; t++) {
    const b = await bikeNow(); const dx = b.bx - b.px, dy = b.by - b.py;
    if (Math.hypot(dx, dy) < 22) break;
    const vertical = Math.abs(dy) > Math.abs(dx);
    const useVertical = flip ? !vertical : vertical;
    const key = useVertical ? (dy > 0 ? 's' : 'w') : (dx > 0 ? 'd' : 'a');
    await page.keyboard.down(key); await page.waitForTimeout(140); await page.keyboard.up(key);
    const nb = await bikeNow();
    // no progress on the chosen axis: try the other axis next (blocked by a tree/rock)
    flip = Math.hypot(nb.px - b.px, nb.py - b.py) < 1.5;
    last = nb;
  }
}
input('walk (held WASD) to motorbike');
const atBike = await bikeNow(); obs('AT_BIKE', atBike);
await page.screenshot({ path: `${dir}/13-at-bike-640.png` });

// --- 6. refuel with a real Fuel Canister and lubricate the same UID ---
const cam = await S(async () => { const { cam } = await import('/src/game/render.ts'); return { x: cam.x, y: cam.y }; });
const scr = { x: atBike.bx - Math.round(cam.x), y: atBike.by - Math.round(cam.y) };
await page.mouse.move(scr.x, scr.y); input(`mouse hover bike screen (${scr.x},${scr.y})`);
const bikePanel = page.locator('.panel').filter({ hasText: 'Utility Motorbike' }).first();
for (let k = 0; k < 4; k++) {
  obs('BIKE_E_ATTEMPT_' + k, await page.evaluate(() => [...document.querySelectorAll('div')].map(d => d.innerText || '').find(t => /^\[?F\/E\]? Use /.test(t) && t.length < 80) || 'no-prompt'));
  await page.keyboard.press('e'); input('keyboard e (motorbike)');
  if (await bikePanel.waitFor({ timeout: 1500 }).then(() => true).catch(() => false)) break;
}
await bikePanel.waitFor({ timeout: 3000 });
await bikePanel.getByRole('button', { name: 'Add 1 Fuel Canister' }).click(); input('click Add 1 Fuel Canister');
await page.waitForTimeout(200);
await bikePanel.getByRole('button', { name: /^Lubricate/ }).click(); input('click Lubricate: 1 Lubricant');
await page.waitForTimeout(200);
obs('AFTER_REFUEL_LUBE', await bikeNow());
await page.screenshot({ path: `${dir}/14-refuel-lube-640.png` });

// --- 7. drive: real key holds; measure fuel, wear and odometer ---
await bikePanel.getByRole('button', { name: 'Enter and drive' }).click(); input('click Enter and drive');
await page.waitForTimeout(300);
const beforeDrive = await bikeNow();
await page.keyboard.down('d'); await page.waitForTimeout(2500); await page.keyboard.up('d'); input('hold d 2.5 s (drive)');
await page.waitForTimeout(200);
const afterDrive = await bikeNow(); obs('DRIVE', { before: beforeDrive, after: afterDrive });
await page.screenshot({ path: `${dir}/15-driving-640.png` });
await page.keyboard.press('f'); input('keyboard f (exit)');
await page.waitForTimeout(300);
const parked = await bikeNow(); obs('PARKED', parked);

// --- 8. save, reopen, verify identity and quantities ---
const invBefore = await S(() => window.__soh.run.custody.inv.slots.filter(Boolean).map(s => ({ uid: s.uid, key: s.key, qty: s.qty })));
const save = page.getByRole('button', { name: 'Save & quit to title' });
for (let k = 0; k < 4; k++) {
  await page.keyboard.press('Escape'); input('keyboard Escape (open/close menu)');
  await page.waitForTimeout(500);
  if (await save.isVisible().catch(() => false)) break;
}
await save.waitFor({ timeout: 5000 }); await save.click(); input('click Save & quit to title');
await page.getByRole('button', { name: /Continue/i }).first().click(); input('click Continue (reopen)');
await page.waitForFunction(id => window.__soh?.run?.entities?.[id], setup.bikeId);
await page.waitForTimeout(800);
const reopened = await bikeNow(); obs('REOPENED_BIKE', reopened);
const invAfter = await S(() => window.__soh.run.custody.inv.slots.filter(Boolean).map(s => ({ uid: s.uid, key: s.key, qty: s.qty })));
obs('INV_BEFORE_SAVE', invBefore); obs('INV_AFTER_REOPEN', invAfter);
assert.equal(reopened.uid, setup.uid);
assert.equal(reopened.fuel, parked.fuel);
assert.equal(reopened.lube, parked.lube);
assert.equal(reopened.odo, parked.odo);
assert.deepEqual(invAfter, invBefore);
await page.screenshot({ path: `${dir}/16-reopened-640.png` });
trace.errors = errors;
fs.writeFileSync(`${dir}/trace.json`, JSON.stringify(trace, null, 2));
console.log('PASS', errors.length ? errors : 'no page errors');
await browser.close();
