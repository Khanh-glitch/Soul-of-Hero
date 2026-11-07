// Controlled generated-tree/door fixture; mouse swings and E door input are real.
import { chromium } from 'playwright'; import { createServer } from 'vite'; import assert from 'node:assert/strict';
const vite = await createServer({ configFile: 'vite.config.ts', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { newGame, dispatch, addItem, C, sourceAt, blockGrid, markDirty, weatherAt, isWet } = await vite.ssrLoadModule('/src/game/engine.ts');
const { serializeSnapshot, validate } = await vite.ssrLoadModule('/src/game/persist.ts');
const now = Date.now(), g = newGame(); assert(dispatch(g, { id: 'door-start', type: 'startRun', character: 'female', region: 0, seed: 1 }, now).ok);
const r = g.run; r.creatures = []; const grid = blockGrid(r); let spot;
outer: for (let y = 20; y < 180; y++) for (let x = 20; x < 180; x++) { const s = sourceAt(r, x, y); if (!s || s.def.mat !== 'wood' || !s.def.tall || grid[y * 200 + x - 1] || grid[y * 200 + x - 2]) continue; if (Object.values(r.entities).some(e => Math.hypot(e.x - x * 16, e.y - y * 16) < 60)) continue; spot = { x, y }; break outer; }
assert(spot); for (let seed = 1; seed < 10000; seed++) { r.seed = seed; if (!isWet(weatherAt(r, now)) && !isWet(weatherAt(r, now + 15000))) break; }
r.player.x = spot.x * 16 - 20; r.player.y = spot.y * 16 + 8; addItem(r, 'inv', 'torch', 1); r.player.active = C(r, 'inv').slots.findIndex(s => s?.key === 'torch');
const door = 'fixture-door'; r.entities[door] = { id: door, kind: 'struct', type: 'door_wood', tx: spot.x - 1, ty: spot.y, x: (spot.x - 1) * 16 + 8, y: spot.y * 16 + 8, hp: 140, maxHp: 140, open: false }; markDirty(); assert(validate(g));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
try { for (const [width, height] of [[640, 360], [1280, 720]]) {
  const context = await browser.newContext({ viewport: { width, height } }); await context.addInitScript(s => localStorage.setItem('soh.state.v3', s), serializeSnapshot(g)); const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4191', { waitUntil: 'networkidle' }); await page.getByRole('button', { name: /Continue —/ }).click(); await page.waitForFunction(() => window.__soh?.run); const report = page.getByRole('button', { name: 'Continue', exact: true }); if (await report.isVisible().catch(() => false)) await report.click();
  const scale = width / 640, cx = Math.max(0, Math.min(3200 - 640, r.player.x - 320)), cy = Math.max(0, Math.min(3200 - 360, r.player.y - 186)); const px = (spot.x * 16 + 8 - cx) * scale, py = (spot.y * 16 + 8 - cy) * scale, index = spot.y * 200 + spot.x;
  await page.mouse.move(px, py); await page.waitForTimeout(200); await page.mouse.click(px, py); await page.waitForTimeout(500);
  const closed = await page.evaluate(i => ({ fire: window.__soh.run.sources[i]?.fire || 0, torch: window.__soh.run.custody.inv.slots.find(s => s?.key === 'torch').dur }), index); assert.equal(closed.fire, 0); assert.equal(closed.torch, 120);
  await page.screenshot({ path: `evidence/trace-home/door-blocks-torch-${width}x${height}.png` });
  await page.keyboard.press('e'); await page.waitForFunction(id => window.__soh.run.entities[id].open, door); await page.waitForTimeout(300);
  await page.mouse.click(px, py); await page.waitForFunction(i => window.__soh.run.sources[i]?.fire > window.__soh.run.clock.simMs, index, { timeout: 3000 }); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__soh.run.custody.inv.slots.find(s => s?.key === 'torch').dur), 119);
  await page.screenshot({ path: `evidence/trace-home/door-open-torch-${width}x${height}.png` }); assert.deepEqual(errors, []); await context.close(); console.log('PASS', width, height, 'closed door blocked torch; E opened; real swing ignited.');
} } finally { await browser.close(); await vite.close(); }
