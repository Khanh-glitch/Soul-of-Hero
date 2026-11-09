// B04-P2 physical recovery loop (controlled fixture for the start state only; every step after Continue is real input).
// broken motorbike with real cargo -> E bike -> Unload all -> close bike panel -> WASD walk to the bag -> E bag ->
// Shift+click one named stack into inventory -> wait for autosave -> NEW browser context -> Continue -> verify by UID.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
const out = 'evidence/b04-bag-loop'; await fs.mkdir(out, { recursive: true });
const vite = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const E = await vite.ssrLoadModule('/src/game/engine.ts');
const P = await vite.ssrLoadModule('/src/game/persist.ts');
const C = await vite.ssrLoadModule('/src/game/core.ts');
const now = Date.now(), gs = E.newGame();
const started = now - 2 * 60e3;
E.dispatch(gs, { id: 'fx-start', type: 'startRun', region: 0, character: 'female', seed: 101 }, started);
const r = gs.run; r.creatures = [];
const TILE = C.TILE, BAL = C.BAL;
const cid = E.mkContainer(r, 'vehicle', BAL.motorbike.slots).id;
r.entities['fx-bike'] = { id: 'fx-bike', kind: 'vehicle', x: r.player.x + TILE, y: r.player.y, c: cid, hp: 0, maxHp: BAL.motorbike.maxHp,
  deployed: { key: 'motorbike_kit', uid: 'bike-fx', qty: 1, dur: 0 }, vehicle: { fuel: 0, angle: 0, odometer: 120, geometry: 'vehicle-geometry-v1' } };
E.addItem(r, cid, 'fuel_can', 1); E.addItem(r, cid, 'mechanical_parts', 2); E.addItem(r, cid, 'fasteners', 2);
r.clock.lastSimAt = started; E.markDirty();
const snapshot = P.serializeSnapshot(gs);
await vite.close();

const URL = process.env.GAME_URL || 'http://127.0.0.1:4330';
const EXE = '/home/user/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell';
const log = [];
const state = (page, fn) => page.evaluate(fn);
async function closeReport(page) { const b = page.getByRole('button', { name: 'Close', exact: true }); if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(300); } }
async function walkTo(page, tx, ty) {
  for (let i = 0; i < 80; i++) {
    const p = await state(page, () => ({ x: window.__soh.run.player.x, y: window.__soh.run.player.y }));
    const dx = tx - p.x, dy = ty - p.y; if (Math.hypot(dx, dy) < 8) return p;
    const keys = []; if (dx > 2) keys.push('d'); if (dx < -2) keys.push('a'); if (dy > 2) keys.push('s'); if (dy < -2) keys.push('w');
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(160);
    for (const k of keys) await page.keyboard.up(k);
  }
  throw new Error('could not walk to the bag');
}
const bagInfo = (page) => state(page, () => {
  const run = window.__soh.run; const b = Object.values(run.entities).find(e => e.kind === 'bag' && e.vehicleSource);
  return b ? { id: b.id, x: b.x, y: b.y, c: b.c, uids: run.custody[b.c].slots.map(s => s && s.uid).filter(Boolean), keys: run.custody[b.c].slots.map(s => s && s.key).filter(Boolean), src: b.vehicleSource } : null;
});
const invUids = (page) => state(page, () => window.__soh.run.custody.inv.slots.map(s => s && s.uid).filter(Boolean));

const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.addInitScript(v => localStorage.setItem('soh.state.v3', v), snapshot);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await page.waitForFunction(() => window.__soh?.run, null, { timeout: 15000 });
  await page.waitForTimeout(600); await closeReport(page);
  // 1. E-open the broken motorbike and press the real unload button.
  await page.mouse.move(340, 186); await page.keyboard.press('e'); await page.waitForTimeout(500);
  const unload = page.getByRole('button', { name: /Unload all/ });
  if (!(await unload.isVisible().catch(() => false))) throw new Error('unload button not visible');
  await unload.click(); await page.waitForTimeout(400);
  const bag0 = await bagInfo(page); if (!bag0) throw new Error('no motorbike bag created');
  log.push({ step: 'unload', bag: bag0.id, uids: bag0.uids, src: bag0.src });
  await page.screenshot({ path: `${out}/1-unloaded-640x360.png` });
  // 2. Close the bike panel with its own button, then walk (WASD) to the bag and E-open it.
  const bikePanel = page.locator('.panel', { hasText: 'Utility Motorbike' }).first();
  await bikePanel.locator('button', { hasText: '✕' }).click(); await page.waitForTimeout(300);
  const at = await walkTo(page, bag0.x, bag0.y);
  log.push({ step: 'walked', player: { x: Math.round(at.x), y: Math.round(at.y) }, bag: { x: Math.round(bag0.x), y: Math.round(bag0.y) } });
  await page.mouse.move(340, 186); await page.keyboard.press('e'); await page.waitForTimeout(500);
  const bagPanel = page.locator('.panel', { hasText: 'Motorbike cargo' }).first();
  await bagPanel.waitFor({ timeout: 5000 });
  await page.screenshot({ path: `${out}/2-bag-open-640x360.png` });
  // 3. Shift+click the first named stack (real pointer input) into inventory.
  const target = bag0.uids[0];
  const slot = bagPanel.locator('.slot[title]:not([title=""])').first();
  await page.keyboard.down('Shift'); await slot.click(); await page.keyboard.up('Shift'); await page.waitForTimeout(400);
  const inv = await invUids(page), bag1 = await bagInfo(page);
  log.push({ step: 'shift-click', uid: target, inInventory: inv.includes(target), bagUidsAfter: bag1 ? bag1.uids : null });
  if (!inv.includes(target)) throw new Error('UID did not reach inventory');
  await page.screenshot({ path: `${out}/3-after-pickup-640x360.png` });
  // 4. Wait for the debounced autosave, read the persisted snapshot, reopen in a NEW browser context.
  await page.waitForTimeout(3000);
  const persisted = await page.evaluate(() => localStorage.getItem('soh.state.v3'));
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 640, height: 360 } });
  await ctx2.addInitScript(v => localStorage.setItem('soh.state.v3', v), persisted);
  const p2 = await ctx2.newPage(); const errors2 = []; p2.on('pageerror', e => errors2.push(e.message));
  await p2.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await p2.getByRole('button', { name: /Continue/i }).first().click();
  await p2.waitForFunction(() => window.__soh?.run, null, { timeout: 15000 });
  await p2.waitForTimeout(600); await closeReport(p2);
  const inv2 = await invUids(p2), bag2 = await bagInfo(p2);
  log.push({ step: 'reload-new-context', uidInInventory: inv2.includes(target), bagUids: bag2 ? bag2.uids : null, bagSource: bag2 ? bag2.src : null });
  await p2.screenshot({ path: `${out}/4-reloaded-640x360.png` });
  if (errors.length || errors2.length) throw new Error([...errors, ...errors2].join('; '));
  if (!inv2.includes(target)) throw new Error('UID lost across reload');
  await ctx2.close();
  console.log('LOG', JSON.stringify(log, null, 1));
  console.log('OK', out);
} finally { await browser.close(); }
