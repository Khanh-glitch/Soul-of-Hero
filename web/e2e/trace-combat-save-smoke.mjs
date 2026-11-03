// Controlled in-flight effects, real menu save/reload; virtual wall clock advances only for the return.
import { chromium } from 'playwright'; import { createServer } from 'vite'; import assert from 'node:assert/strict';
const vite = await createServer({ configFile: 'vite.config.ts', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { newGame, dispatch } = await vite.ssrLoadModule('/src/game/engine.ts'), { serializeSnapshot, validate } = await vite.ssrLoadModule('/src/game/persist.ts');
const now = Date.now(), g = newGame(); assert(dispatch(g, { id: 'combat-save', type: 'startRun', character: 'female', region: 0, seed: 190 }, now).ok); const r = g.run; r.creatures = [];
r.combat = { projectiles: [{ x: r.player.x + 20, y: r.player.y, vx: 0, vy: 0, life: 8, delay: 10000, dmg: 5, from: 'enemy', kind: 'bolt', r: 3 }], hazards: [{ kind: 'circle', x: r.player.x + 100, y: r.player.y, r: 10, t: 0, tell: 10000, dur: 120, dmg: 8, style: 'erupt', owner: 'fixture' }] }; assert(validate(g));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
try {
 const context = await browser.newContext({ viewport: { width: 640, height: 360 } }); await context.addInitScript(s => { if (!localStorage.getItem('soh.state.v3')) localStorage.setItem('soh.state.v3', s); }, serializeSnapshot(g));
 const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); const url = process.env.GAME_URL || 'http://127.0.0.1:4191';
 await page.goto(url, { waitUntil: 'networkidle' }); await page.getByRole('button', { name: /Continue —/ }).click(); await page.waitForFunction(() => window.__soh?.run?.combat?.projectiles.length === 1);
 await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Save & quit to title' }).click();
 // Capture the exact saved committed effect, then reload in the same browser 2 minutes later.
 const saved = await page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('soh.state.v3')).payload).run.combat);
 await context.addInitScript(() => { const old = Date.now; Date.now = () => old() + 120000; });
 await page.reload({ waitUntil: 'networkidle' }); await page.getByRole('button', { name: /Continue —/ }).click(); await page.getByText(/Nearby evidenced trails may be followed while away/).waitFor();
 const returned = await page.evaluate(() => window.__soh.run.combat);
 assert.equal(returned.projectiles.length, 1); assert.equal(returned.hazards.length, 1); assert.equal(returned.projectiles[0].x, saved.projectiles[0].x);
 assert(returned.hazards[0].t - saved.hazards[0].t < 1500, 'only live frames may advance the hazard, not two minutes away');
 assert(saved.projectiles[0].delay - returned.projectiles[0].delay < 1500, 'only live frames may advance projectile delay');
 await page.getByRole('button', { name: 'Continue', exact: true }).click(); assert.deepEqual(errors, []); await context.close(); console.log('PASS real menu save/reload; two-minute offline gap preserved unresolved projectile and hazard');
} finally { await browser.close(); await vite.close(); }
