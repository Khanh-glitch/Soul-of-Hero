// B04-P4 pixel + interaction evidence (continuation). Scenes are built by the real engine:
//  - airdrop: the authoritative lifecycle (stepAirdrops at signal/descent/landing/unlock, and a real 'move' take) — no phase is assigned by hand.
//  - traps/IR: real build/bearTrapSet/basePower/irSensorToggle actions. Fixture: spent/worn trap state in the save schema, player placed beside devices.
//  - trapSnap: the spring-snap frame is shown with a FROZEN browser clock for 0.4 s-window capture; labeled fixture (the live hit is proven by tick() tests).
//  - recycler: a real Foundry Recycler entity (fixture placement) and the real UI flow: select pipe -> Recycle item… -> Confirm recycle -> real time -> output.
//  - caches: the four W06/B01 class families from real world statics; the player stands beside each.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'evidence/b04-p4-world'; await fs.mkdir(out, { recursive: true });
const vite = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const E = await vite.ssrLoadModule('/src/game/engine.ts');
const P = await vite.ssrLoadModule('/src/game/persist.ts');
const C = await vite.ssrLoadModule('/src/game/core.ts');
const K = await vite.ssrLoadModule('/src/game/catalog.ts');
const W = await vite.ssrLoadModule('/src/game/world.ts');
const A = await vite.ssrLoadModule('/src/game/airdrop.ts');
const SIM = await vite.ssrLoadModule('/src/game/sim.ts');
const IDLE = { up: false, down: false, left: false, right: false, attackPressed: false, roll: false, cancel: false, mx: 0, my: 0, interact: false, sprint: false };
// advance the committed world clock through the real tick() loop (player idle), then let the airdrop state machine observe it
const advance = (g, at) => { SIM.tick(g, IDLE, 50, at); E.stepAirdrops(g.run, at); };
const LE = await vite.ssrLoadModule('/src/game/loot-ecology.ts');
const { TILE, WW, T, HOUR } = C;
const T0 = Date.UTC(2026, 10, 5);
const act = (g, type, data, now = T0) => E.dispatch(g, { id: `p4b-${type}-${Math.random()}`, type, ...data }, now);
const results = {};

function newRun(seed = 313, start = T0) { const g = E.newGame(); assert(act(g, 'startRun', { character: 'female', region: 0, seed }, start).ok); g.run.creatures = []; return g; }
function clearBlock(r) {  // fixture: clear grass block at a fixed spot (same setup as the unit tests)
  const w = W.getWorld(), x0 = 80, y0 = 80;
  for (let yy = y0 - 2; yy <= y0 + 2; yy++) for (let xx = x0 - 2; xx <= x0 + 12; xx++) { const i = yy * WW + xx; r.terrain[i] = { t: T.GRASS }; if (w.sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 }; }
  E.markDirty(); return { x: x0, y: y0 };
}
function builder(g, r) {
  const at = (x, y) => { r.player.x = x * TILE + 8; r.player.y = y * TILE + 8; E.markDirty(); };
  const build = (type, tx, ty) => {
    at(tx, ty + 1); for (const [k, q] of K.STRUCTS[type].cost) E.addItem(r, 'inv', k, q);
    const res = act(g, 'build', { struct: type, tx, ty }); assert(res.ok, `${type} @${tx},${ty}: ${res.reason}`);
    return Object.values(r.entities).find(e => e.kind === 'struct' && e.tx === tx && e.ty === ty && e.type === type);
  };
  return { build, at };
}
const scenes = {};
// ---- bear traps: four physical states; armed one was armed by the real bearTrapSet action ----
{
  const g = newRun(), r = g.run, s = clearBlock(r), { build, at } = builder(g, r);
  const traps = [0, 2, 4, 6].map(dx => build('bear_trap', s.x + dx, s.y));
  E.addItem(r, 'inv', 'iron_plate', 2); at(s.x + 2, s.y + 1);
  assert(act(g, 'bearTrapSet', { eid: traps[1].id }).ok, 'arm with one Iron Plate');
  traps[2].bearTrap.state = 'spent'; traps[2].bearTrap.uses = 2;   // fixture: used trap (save schema)
  traps[3].bearTrap.state = 'worn'; traps[3].bearTrap.uses = 0;
  at(s.x + 3, s.y + 2);
  scenes.traps = { snap: P.serializeSnapshot(g), clock: T0 + 60000 };
}
// ---- spring-snap frame (fixture stamp; frozen clock during capture) ----
{
  const g = newRun(), r = g.run, s = clearBlock(r), { build, at } = builder(g, r);
  const t = build('bear_trap', s.x + 2, s.y); E.addItem(r, 'inv', 'iron_plate', 1); at(s.x + 2, s.y + 1);
  assert(act(g, 'bearTrapSet', { eid: t.id }).ok);
  t.bearTrap.state = 'spent'; t.bearTrap.uses = 2; t.bearTrap.snapAt = T0 + 60000;
  at(s.x + 2, s.y + 2);
  scenes.trapSnap = { snap: P.serializeSnapshot(g), clock: T0 + 60100, freeze: true };
}
// ---- IR sensor states ----
function irScene(name, { fuel = true, enable = true, playerAt, wall = null, powerOn = true }) {  // wall: [dx,dy] from the sensor, on the sight line
  const g = newRun(), r = g.run, s = clearBlock(r), { build, at } = builder(g, r);
  const gen = build('base_generator', s.x, s.y); build('power_cable', s.x + 1, s.y); const sensor = build('ir_sensor', s.x + 2, s.y);
  if (wall) build('wall_wood', s.x + wall[0], s.y + wall[1]);
  gen.basePower.capacity = 2; if (fuel) E.addItem(r, gen.c, 'wood', 2);
  if (powerOn) { at(s.x, s.y + 1); assert(act(g, 'basePower', { eid: gen.id, enabled: true }).ok); }
  if (enable) { at(s.x + 2, s.y + 1); assert(act(g, 'irSensorToggle', { eid: sensor.id }).ok); }
  at(s.x + playerAt[0], s.y + playerAt[1]);
  results[name] = E.irSensorVisual(r, sensor);
  scenes[name] = { snap: P.serializeSnapshot(g), clock: T0 + 60000 };
}
irScene('irOff', { enable: false, fuel: true, playerAt: [2, 2] });
irScene('irUnpowered', { fuel: false, playerAt: [2, 2] });
irScene('irReady', { fuel: true, playerAt: [9, 2] });
irScene('irDetect', { fuel: true, playerAt: [2, 2] });
irScene('irBlocked', { fuel: true, wall: [2, 1], playerAt: [2, 3] });   // wall directly between the sensor and the player
assert.deepEqual([results.irOff, results.irUnpowered, results.irReady, results.irDetect, results.irBlocked], ['off', 'unpowered', 'ready', 'detect', 'blocked'], 'IR states are the five distinct engine states');
// ---- industrial inventory (icons) ----
{
  const g = newRun(), r = g.run, s = clearBlock(r), { build, at } = builder(g, r);
  for (const [k, q] of [['metal_pipe', 2], ['iron_plate', 2], ['metal_blade', 1], ['mechanical_gear', 2], ['refined_iron_ingot', 3]]) E.addItem(r, 'inv', k, q);
  build('workbench', s.x, s.y); at(s.x, s.y + 1);
  scenes.industrial = { snap: P.serializeSnapshot(g), clock: T0 + 60000 };
}
// ---- Foundry Recycler with one carried pipe: the engine's own authorized recycler entity (no hand-placed station) ----
{
  W.setActiveLayout('shipping');
  const g = newRun(313), r = g.run;
  const rec = Object.values(r.entities).find(e => e.kind === 'recycler');
  assert(rec, 'the authorized Foundry Recycler exists in this run');
  E.addItem(r, 'inv', 'metal_pipe', 1); r.player.x = rec.x; r.player.y = rec.y + TILE; E.markDirty();
  results.recyclerSite = { tx: rec.tx, ty: rec.ty };
  scenes.recycler = { snap: P.serializeSnapshot(g), clock: T0 + 60000 };
}
// ---- airdrop: the authoritative lifecycle; night chosen by the real darkness function ----
function airRun(k) { W.setActiveLayout('shipping'); const g = E.newGame(); assert(act(g, 'startRun', { character: 'female', seed: 55 }, T0 + k * HOUR).ok); g.run.creatures = []; return g; }
let night = null;
for (let k = 0; k < 24 && !night; k++) { const g = airRun(k); const t = A.airdropTimes(g.run, 0); if (E.darkness(g.run, t.landAt + 30000) > 0.6) night = k; }
assert(night !== null, 'a night landing exists');
function landedDrop(g) {
  const r = g.run, t = A.airdropTimes(r, 0);
  advance(g, t.signalAt); assert.equal(Object.values(r.entities).find(e => e.kind === 'airdrop').airdrop.phase, 'signal');
  advance(g, t.descentAt); assert.equal(Object.values(r.entities).find(e => e.kind === 'airdrop').airdrop.phase, 'descending');
  r.player.x = 0; r.player.y = 0; E.markDirty();   // landing clearance requires the player to be away; the drop cannot land on a player
  advance(g, t.landAt); return { t, e: Object.values(r.entities).find(x => x.kind === 'airdrop') };
}
const nearDrop = (g, e, at) => { g.run.player.x = e.x - 2 * TILE; g.run.player.y = e.y; E.markDirty(); SIM.tick(g, IDLE, 50, at); return P.serializeSnapshot(g); };  // the capture moment is a real tick, so the saved clock is honest
{
  const g = airRun(night), { t, e } = landedDrop(g);
  assert.equal(e.airdrop.phase, 'locked');
  scenes.airLocked = { snap: nearDrop(g, e, t.landAt + 30000), clock: t.landAt + 30000, expect: 'locked' };
  advance(g, t.unlockAt + 5000); assert.equal(e.airdrop.phase, 'open');
  scenes.airOpen = { snap: nearDrop(g, e, t.unlockAt + 5000), clock: t.unlockAt + 5000, expect: 'open' };
  const first = e.c && Object.values(g.run.custody[e.c].slots).findIndex(Boolean);
  const mv = act(g, 'move', { from: e.c, fs: first, to: 'inv' }, t.unlockAt + 6000);
  assert(mv.ok, `take one stack: ${mv.reason}`);
  advance(g, t.unlockAt + 6000);
  results.airdropPartialPhase = e.airdrop.phase;
  scenes.airPartial = { snap: nearDrop(g, e, t.unlockAt + 6000), clock: t.unlockAt + 6000, expect: 'partial' };
  results.airdropStacksRemaining = g.run.custody[e.c].slots.filter(Boolean).length;
}
// ---- cache families: the real world statics of each W06/B01 class, the player beside each ----
{
  W.setActiveLayout('shipping');
  const statics = W.getWorld('shipping').statics.filter(s => s.kind === 'loot' && LE.lootClass(s));
  const seen = {};
  for (const s of statics) { const k = LE.lootClass(s); if (!seen[k]) seen[k] = s; }
  for (const [k, s] of Object.entries(seen)) {
    const g = newRun(313, T0); const r = g.run;
    r.lootEcology = r.lootEcology ?? { version: 'w06-v1', cycles: {}, grammar: LE.LOOT_GRAMMAR_CURRENT };
    r.player.x = (s.tx + 1) * TILE + 8; r.player.y = (s.ty + 1) * TILE + 8; E.markDirty();
    scenes['cache_' + k] = { snap: P.serializeSnapshot(g), clock: T0 + 60000, cache: k, site: { tx: s.tx, ty: s.ty } };
  }
  results.cacheClasses = Object.keys(seen);
}
await fs.writeFile(`${out}/scenes-snapshots.json`, JSON.stringify(scenes));
await fs.writeFile(`${out}/results-precheck.json`, JSON.stringify(results, null, 1));

// ---- browser ----
const URL = process.env.GAME_URL || 'http://127.0.0.1:4410';
const sp = (await import(process.env.SPARTICUZ || '/home/user/browser/node_modules/@sparticuz/chromium/build/index.js')).default;
const browser = await chromium.launch({ headless: true, executablePath: await sp.executablePath(), args: sp.args.filter(a => a !== '--single-process') });
const errors = [];
async function open(name, vp) {
  const sc = scenes[name];
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript(({ v, t, freeze }) => { localStorage.setItem('soh.state.v3', v); const real = Date.now.bind(Date), begin = real(); Date.now = freeze ? () => t : () => t + (real() - begin); }, { v: sc.snap, t: sc.clock, freeze: !!sc.freeze });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  const cont = page.getByRole('button', { name: /Continue/i }).first();
  await cont.waitFor({ state: 'visible', timeout: 15000 }).then(() => cont.click()).catch(() => {});
  await page.waitForFunction(() => window.__soh?.run, null, { timeout: 20000 });
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible().catch(() => false)) { await close.click(); await page.waitForTimeout(150); }
  return { ctx, page };
}
const VPS = [['640x360', { width: 640, height: 360 }], ['1280x720', { width: 1280, height: 720 }]];
const shots = [];
const shot = async (page, name, vn) => { await page.screenshot({ path: `${out}/${name}-${vn}.png` }); shots.push(`${name}-${vn}.png`); };
for (const [vn, vp] of VPS) {
  for (const name of ['traps', 'trapSnap', 'irOff', 'irUnpowered', 'irReady', 'irDetect', 'irBlocked', 'airLocked', 'airOpen', 'airPartial']) {
    const { ctx, page } = await open(name, vp);
    if (name.startsWith('air')) {
      const phase = await page.evaluate(() => Object.values(window.__soh.run.entities).find(e => e.kind === 'airdrop')?.airdrop?.phase ?? null);
      results[`${name}.browserPhase`] = phase; assert.equal(phase, scenes[name].expect === 'partial' ? results.airdropPartialPhase : scenes[name].expect, `${name} phase`);
      await page.waitForTimeout(300);
    }
    if (name === 'trapSnap') { const snap = await page.evaluate(() => { const t = Object.values(window.__soh.run.entities).find(e => e.type === 'bear_trap'); return t?.bearTrap?.snapAt ?? null; }); results.trapSnapStamp = snap; }
    await shot(page, name, vn);
    await ctx.close();
  }
  // recycler: the real UI path
  { const { ctx, page } = await open('recycler', vp);
    await page.keyboard.press('e'); await page.waitForTimeout(400);
    await shot(page, 'recycler-open', vn);
    const pipeUid = await page.evaluate(() => window.__soh.run.custody.inv.slots.find(s => s && s.key === 'metal_pipe')?.uid);   // the real carried pipe's UID
    assert(pipeUid, 'a carried Metal Pipe exists before the recycler is used');
    await page.getByLabel('Recycler item').selectOption(pipeUid); await page.waitForTimeout(150);
    await page.getByRole('button', { name: 'Recycle item…' }).click(); await page.getByRole('button', { name: 'Confirm recycle' }).click();
    await page.waitForTimeout(600); await shot(page, 'recycler-processing', vn);
    await page.waitForTimeout(10500);
    const outCount = await page.evaluate(() => { const r = window.__soh.run; const e = Object.values(r.entities).find(x => x.kind === 'recycler'); const c = r.custody[e.station.outC]; return c.slots.filter(Boolean).map(s => `${s.qty} ${s.key}`); });
    const pipesLeft = await page.evaluate(() => window.__soh.run.custody.inv.slots.filter(s => s && s.key === 'metal_pipe').length);
    results[`recycler.${vn}`] = { output: outCount, pipesLeftInInventory: pipesLeft };
    await shot(page, 'recycler-done', vn);
    await ctx.close(); }
  // cache families
  for (const k of ['toolbox', 'supply', 'military', 'advanced']) {
    if (!scenes['cache_' + k]) continue;
    if (vn === '1280x720' && k !== 'advanced') continue;   // one large frame for the family set; the 640 frames carry the set
    const { ctx, page } = await open('cache_' + k, vp);
    results[`cache_${k}.browserEntity`] = await page.evaluate(() => !!Object.values(window.__soh.run.entities).find(e => e.kind === 'loot'));
    await page.waitForTimeout(300);
    await shot(page, 'cache-' + k, vn); await ctx.close();
  }
  // industrial inventory
  { const { ctx, page } = await open('industrial', vp); await page.keyboard.press('KeyI'); await page.waitForTimeout(300); await shot(page, 'industrial-inventory', vn); await ctx.close(); }
}
await browser.close(); await vite.close();
await fs.writeFile(`${out}/results.json`, JSON.stringify({ results, shots, errors, irVisual: { irOff: results.irOff, irUnpowered: results.irUnpowered, irReady: results.irReady, irDetect: results.irDetect, irBlocked: results.irBlocked } }, null, 1));
console.log(JSON.stringify({ results, shots, errors }, null, 1));
assert.equal(errors.length, 0, 'no page errors');
