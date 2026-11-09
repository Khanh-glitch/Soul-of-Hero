// B03-C visual smoke (controlled fixture, NOT a natural player journey).
// Builds a 2-hour-old run with real engine objects (ripe plot, full Tender chest, barrel, a campfire whose
// fuel runs out during the absence), then drives the real Continue button and captures the 640x360 report.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
const out = 'evidence/b03-return'; await fs.mkdir(out, { recursive: true });
const vite = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const E = await vite.ssrLoadModule('/src/game/engine.ts');
const P = await vite.ssrLoadModule('/src/game/persist.ts');
const now = Date.now(), gs = E.newGame();
const started = now - 2 * 3600e3;
E.dispatch(gs, { id: 'fx-start', type: 'startRun', region: 0, character: 'female', seed: 313 }, started);
const r = gs.run;
r.creatures = [];
const tx0 = Math.floor(r.player.x / 16), ty0 = Math.floor(r.player.y / 16);
const at = (dx, dy) => ({ tx: tx0 + dx, ty: ty0 + dy, x: (tx0 + dx) * 16 + 8, y: (ty0 + dy) * 16 + 8 });
const add = (id, type, dx, dy, extra = {}) => { const p = at(dx, dy); r.entities[id] = { id, kind: 'struct', type, ...p, hp: 60, maxHp: 60, ...extra }; return r.entities[id]; };
const chest = add('fx-chest', 'chest_small', 2, 0, { hp: 100, maxHp: 100, c: E.mkContainer(r, 'chest', 12).id });
for (let i = 0; i < 12; i++) E.addItem(r, chest.c, 'cart_kit', 1);
const garden = add('fx-garden', 'garden', -2, 0, { garden: { crop: 'crop', growth: 1, water: 3 } });
const barrel = add('fx-barrel', 'barrel', 0, 2, { hp: 80, maxHp: 80, water: 6 });
const tender = add('fx-tender', 'farm_controller', 0, -1, { hp: 140, maxHp: 140, c: E.mkContainer(r, 'chest', 3).id, farm: { enabled: true, crop: 'crop', energy: 40, gardenId: garden.id, barrelId: barrel.id, chestId: chest.id } });
const fire = add('fx-campfire', 'campfire', 3, 2, { hp: 60, maxHp: 60, station: { queue: [], burn: 0, fuelC: E.mkContainer(r, 'fuel', 6).id, outC: E.mkContainer(r, 'out', 6).id } });
E.addItem(r, fire.station.fuelC, 'wood', 1); // 20 s of paid fuel: goes out while away
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
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4320', { waitUntil: 'load', timeout: 60000 });
  await page.getByRole('button', { name: /Continue/i }).first().click();
  const panel = page.locator('.return-report').first();
  await panel.waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/report-body-640x360.png` });
  for (const [name, file] of [['Work', 'report-production-640x360.png'], ['Home', 'report-home-640x360.png'], ['Loss', 'report-loss-640x360.png']]) {
    await panel.getByRole('button', { name: new RegExp(name) }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}/${file}` });
  }
  const bb = await panel.boundingBox();
  const scroll = await panel.locator('.scroll').first().evaluate(el => ({ sh: el.scrollHeight, ch: el.clientHeight }));
  console.log('PANEL', JSON.stringify(bb), 'SCROLL', JSON.stringify(scroll));
  if (errors.length) throw Error(errors.join('; '));
  console.log('OK screenshots in', out);
} finally { await browser.close(); }
