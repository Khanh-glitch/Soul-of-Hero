// Controlled saved-clock fixture exercises real Continue/report input, not actor replay.
import { chromium } from 'playwright'; import { createServer } from 'vite'; import assert from 'node:assert/strict';
const vite = await createServer({ configFile: 'vite.config.ts', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { newGame, dispatch } = await vite.ssrLoadModule('/src/game/engine.ts'), { serializeSnapshot, validate } = await vite.ssrLoadModule('/src/game/persist.ts');
const now = Date.now(), g = newGame(); assert(dispatch(g, { id: 'return', type: 'startRun', character: 'female', region: 0, seed: 100 }, now - 120000).ok); const r = g.run; r.creatures = [];
r.traces.push({ id: 'return-mark', chainId: 'return-mark', x: r.player.x, y: r.player.y, t: now - 119000, life: 10000, a: 0, s: 3 }); assert(validate(g));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
try { for (const [width, height] of [[640, 360], [1280, 720]]) {
  const context = await browser.newContext({ viewport: { width, height } }); await context.addInitScript(s => localStorage.setItem('soh.state.v3', s), serializeSnapshot(g)); const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4191', { waitUntil: 'networkidle' }); await page.getByRole('button', { name: /Continue —/ }).click();
  await page.getByText(/Creatures did not move or attack while away/).waitFor(); await page.waitForTimeout(400);
  await page.screenshot({ path: `evidence/trace-home/return-report-${width}x${height}.png` }); assert.equal(await page.evaluate(() => window.__soh.run.traces.some(t => t.id === 'return-mark')), false);
  await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.keyboard.down('d'); await page.waitForTimeout(180); await page.keyboard.up('d'); assert.deepEqual(errors, []); await context.close(); console.log('PASS', width, height, 'elapsed report, expired trace and real Continue input');
} } finally { await browser.close(); await vite.close(); }
