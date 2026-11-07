// B04 visual smoke (controlled fixture, NOT a natural player journey).
// A broken motorbike with real cargo, placed beside the player, loaded through the real Continue button.
// Captures the vehicle panel's breakdown status and the emergency unload action at 640x360.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
const out = 'evidence/b04-vehicle'; await fs.mkdir(out, { recursive: true });
const vite = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const E = await vite.ssrLoadModule('/src/game/engine.ts');
const P = await vite.ssrLoadModule('/src/game/persist.ts');
const C = await vite.ssrLoadModule('/src/game/core.ts');
const now = Date.now(), gs = E.newGame();
const started = now - 2 * 60e3;
E.dispatch(gs, { id: 'fx-start', type: 'startRun', region: 0, character: 'female', seed: 101 }, started);
const r = gs.run;
r.creatures = [];
const TILE = C.TILE, BAL = C.BAL;
const cid = E.mkContainer(r, 'vehicle', BAL.motorbike.slots).id;
const px = r.player.x + TILE, py = r.player.y;
r.entities['fx-bike'] = {
  id: 'fx-bike', kind: 'vehicle', x: px, y: py, c: cid, hp: 0, maxHp: BAL.motorbike.maxHp,
  deployed: { key: 'motorbike_kit', uid: 'bike-fx', qty: 1, dur: 0 },
  vehicle: { fuel: 0, angle: 0, odometer: 120, geometry: 'vehicle-geometry-v1' },
};
E.addItem(r, cid, 'fuel_can', 1);
E.addItem(r, cid, 'mechanical_parts', 2);
E.addItem(r, cid, 'fasteners', 2);
r.clock.lastSimAt = started;
E.markDirty();
const snapshot = P.serializeSnapshot(gs);
await vite.close();

const browser = await chromium.launch({ headless: true, executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
await ctx.addInitScript(v => localStorage.setItem('soh.state.v3', v), snapshot);
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4330', { waitUntil: 'load', timeout: 60000 });
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await page.waitForFunction(() => window.__soh?.run, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible().catch(() => false)) { await close.click(); await page.waitForTimeout(400); }
  await page.screenshot({ path: `${out}/bike-stranded-world-640x360.png` });
  await page.mouse.move(340, 186); await page.waitForTimeout(300);
  await page.keyboard.press('e'); await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/bike-panel-640x360.png` });
  const unload = page.getByRole('button', { name: /Unload all/ });
  const visible = await unload.isVisible().catch(() => false);
  if (visible) {
    await unload.click(); await page.waitForTimeout(400);
    const after = await page.evaluate(() => { const b = Object.values(window.__soh.run.entities).find(e => e.kind === 'bag' && e.label === 'Motorbike cargo'); return b ? { bag: b.id, items: window.__soh.run.custody[b.c].slots.filter(Boolean).map(s => s.uid) } : null; });
    console.log('AFTER_UNLOAD', JSON.stringify(after));
    await page.screenshot({ path: `${out}/bike-unloaded-640x360.png` });
  } else console.log('UNLOAD_BUTTON_NOT_VISIBLE');
  if (errors.length) throw Error(errors.join('; '));
  console.log('OK screenshots in', out);
} finally { await browser.close(); }
