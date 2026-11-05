// Controlled encounter fixtures; the footprint chain itself is made by real keyboard movement.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'evidence/trace-home'; await mkdir(out, { recursive: true });
const vite = await createServer({ configFile: 'vite.config.ts', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { newGame, dispatch, blockGrid, mkCreature, markDirty } = await vite.ssrLoadModule('/src/game/engine.ts');
const { serializeSnapshot, validate } = await vite.ssrLoadModule('/src/game/persist.ts');
const { getWorld } = await vite.ssrLoadModule('/src/game/world.ts');
const now = Date.now(), game = newGame(); assert(dispatch(game, { id: 'trace-demo', type: 'startRun', character: 'female', region: 0, seed: 411 }, now).ok);
const r = game.run, w = getWorld(), grid = blockGrid(r); r.creatures = [];
let pos;
outer: for (let y = 12; y < 188; y++) for (let x = 12; x < 170; x++) {
  let valid = true;
  for (let dy = 0; dy <= 0 && valid; dy++) for (let dx = -2; dx <= 20; dx++) {
    const i = (y + dy) * 200 + x + dx;
    if (grid[i] !== 0 || ![2, 3, 4, 5, 6, 7, 9, 10, 11, 12].includes(w.tiles[i])) { valid = false; break; }
  }
  if (valid) { pos = { x: x * 16 + 8, y: y * 16 + 8 }; break outer; }
}
assert(pos, 'need a naturally clear meadow or grass corridor'); r.player.x = pos.x; r.player.y = pos.y; markDirty();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const url = process.env.GAME_URL || 'http://127.0.0.1:4191'; const results = [];
async function enter(snapshot, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(s => localStorage.setItem('soh.state.v3', s), snapshot);
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' }); await page.getByRole('button', { name: /Continue —/ }).click();
  await page.waitForFunction(() => window.__soh?.run); const report = page.getByRole('button', { name: 'Continue', exact: true });
  if (await report.isVisible().catch(() => false)) await report.click();
  return { context, page, errors };
}
try {
  // Live input, not a synthetic trail: travel over existing generated terrain.
  const create = await enter(serializeSnapshot(game), 640, 360);
  await create.page.keyboard.down('d'); await create.page.waitForTimeout(2500); await create.page.keyboard.up('d');
  const generated = await create.page.evaluate(() => JSON.parse(JSON.stringify(window.__soh)));
  assert(generated.run.player.x - pos.x > 130, 'actual keyboard travel'); assert(generated.run.traces.length > 8, 'live footprints');
  const traces = generated.run.traces; assert(traces[1].prevId === traces[0].id);
  await create.page.keyboard.press('Escape');
  await create.page.getByText('Before you leave').waitFor(); await create.page.waitForTimeout(400);
  await create.page.screenshot({ path: `${out}/preparation-640x360.png` });
  await create.context.close();
  const first = traces[0];
  for (const scenario of ['valid-trail', 'broken-trail', 'undiscovered-home']) for (const [width, height] of [[640, 360], [1280, 720]]) {
    const fixture = structuredClone(generated), run = fixture.run;
    // Fixtures isolate each case without changing the geography or inventing creature movement.
    run.clock.lastSimAt = Date.now(); run.creatures = []; run.player.action = null; run.player.invuln = 0;
    const homeX = Math.floor((pos.x + 135) / 16), homeY = Math.floor(pos.y / 16);
    for (let dy = -1; dy <= 1; dy++) {
      const id = `fixture-wall-${dy}`; run.entities[id] = { id, kind: 'struct', type: dy === 0 ? 'door_wood' : 'wall_wood', tx: homeX, ty: homeY + dy, x: homeX * 16 + 8, y: (homeY + dy) * 16 + 8, hp: dy === 0 ? 140 : 160, maxHp: dy === 0 ? 140 : 160, open: false };
    }
    if (scenario === 'broken-trail') run.traces = run.traces.filter(tr => tr.id !== traces[1].id);
    if (scenario === 'undiscovered-home') run.traces = [];
    const wx = scenario === 'undiscovered-home' ? homeX * 16 - 6 : first.x - 8;
    const wolf = mkCreature(run, 'wolf', wx, pos.y, 30); wolf.t = scenario === 'undiscovered-home' ? 0 : 480;
    wolf.tx = scenario === 'undiscovered-home' ? homeX * 16 + 8 : wolf.x + 40; wolf.ty = pos.y;
    run.creatures.push(wolf); assert(validate(fixture)); markDirty();
    const loaded = await enter(serializeSnapshot(fixture), width, height), page = loaded.page;
    if (scenario === 'valid-trail') {
      await page.waitForFunction(id => { const m = window.__soh.run.creatures.find(m => m.id === id); return m?.knows?.kind === 'trace' && m.knows.traceId !== window.__soh.run.traces[0].id; }, wolf.id, { timeout: 5000 });
    } else if (scenario === 'broken-trail') {
      try { await page.waitForFunction(id => window.__soh.run.creatures.find(m => m.id === id)?.traceIgnore, wolf.id, { timeout: 5000 }); } catch (e) { console.error('BROKEN DEBUG', await page.evaluate(id => ({ m: window.__soh.run.creatures.find(m => m.id === id), traces: window.__soh.run.traces.slice(0, 4), player: { x: window.__soh.run.player.x, y: window.__soh.run.player.y } }), wolf.id)); throw e; }
    } else await page.waitForTimeout(1200);
    // One real movement input during each encounter; does not manipulate the creature.
    await page.keyboard.down('d'); await page.waitForTimeout(180); await page.keyboard.up('d');
    const state = await page.evaluate(id => { const r = window.__soh.run, m = r.creatures.find(m => m.id === id); return { x: m.x, y: m.y, state: m.state, knows: m.knows, ignore: m.traceIgnore, door: r.entities['fixture-wall-0'].hp, playerX: r.player.x, traces: r.traces.length }; }, wolf.id);
    if (scenario === 'valid-trail') { assert(state.x > wx, 'wolf moved along the trail'); assert.equal(state.knows?.kind, 'trace'); }
    if (scenario === 'broken-trail') { assert.equal(state.ignore, first.chainId); assert.notEqual(state.knows?.kind, 'trace'); }
    if (scenario === 'undiscovered-home') { assert.equal(state.door, 140); assert.notEqual(state.knows?.kind, 'trace'); }
    assert(state.playerX > generated.run.player.x, 'actual input moved player');
    await page.screenshot({ path: `${out}/${scenario}-${width}x${height}.png` });
    if (scenario === 'valid-trail' && width === 1280) { await page.keyboard.press('Escape'); await page.getByText('Before you leave').waitFor(); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/preparation-1280x720.png` }); }
    assert.equal(await page.getByText(/Something is following your tracks/).count(), 0); assert.deepEqual(loaded.errors, []); await loaded.context.close(); results.push({ scenario, width, height, initialWolfX: wx, ...state });
    console.log('PASS', scenario, width, height, JSON.stringify(state));
  }
  await writeFile(`${out}/observations.json`, JSON.stringify({ inputTravel: generated.run.player.x - pos.x, generatedTraceCount: traces.length, results }, null, 2));
} finally { await browser.close(); await vite.close(); }
