// B04-P4 pixel evidence: bear trap states, IR sensor states, airdrop crate, industrial icons and the Metal Pipe recycle panel.
// Snapshots are built by the real engine (build/bearTrapSet/basePower/irSensorToggle actions). The one fixture step: a
// trap's state is set in the save schema for the spent/worn frames, and the player is placed beside each device for the frame.
// Served from the portable HTTP build (dist-http) via GAME_URL. Not a survival bot: no combat or journey is scripted.
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
const { TILE, WW, T } = C;
const T0 = Date.UTC(2026, 10, 5);
const act = (g, type, data, now = T0) => E.dispatch(g, { id: `p4b-${type}-${Math.random()}`, type, ...data }, now);

function newRun(seed = 313) { const g = E.newGame(); assert(act(g, 'startRun', { character: 'female', region: 0, seed }, T0).ok); g.run.creatures = []; return g; }
// Fixture: a clear grass block at a fixed spot (same setup as the P4 unit tests); tall-grass sources inside it are cleared.
function freeGrass(r) {
  const w = W.getWorld(), x0 = 80, y0 = 80;
  for (let yy = y0 - 2; yy <= y0 + 2; yy++) for (let xx = x0 - 2; xx <= x0 + 12; xx++) { const i = yy * WW + xx; r.terrain[i] = { t: T.GRASS }; if (w.sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 }; }
  E.markDirty();
  return { x: x0, y: y0 };
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
// Bear traps in four physical states, side by side (unarmed, armed, spent, worn).
{
  const g = newRun(313), r = g.run, s = freeGrass(r), { build, at } = builder(g, r);
  const cols = [0, 2, 4, 6];
  const traps = cols.map(dx => build('bear_trap', s.x + dx, s.y));
  E.addItem(r, 'inv', 'iron_plate', 2);
  at(s.x + 2, s.y + 1);
  assert(act(g, 'bearTrapSet', { eid: traps[1].id }).ok, 'arm the armed trap with one Iron Plate');
  traps[2].bearTrap.state = 'spent'; traps[2].bearTrap.uses = 2;   // fixture: a used trap from the save schema
  traps[3].bearTrap.state = 'worn'; traps[3].bearTrap.uses = 0;
  at(s.x + 3, s.y + 2);
  scenes.traps = { snap: P.serializeSnapshot(g), clock: T0 + 60000 };
}
// The same armed trap just after a live hit: the spring-snap frame (snapAt within 0.4 s of the clock).
{
  const g = newRun(313), r = g.run, s = freeGrass(r), { build, at } = builder(g, r);
  const t = build('bear_trap', s.x + 2, s.y); E.addItem(r, 'inv', 'iron_plate', 1);
  at(s.x + 2, s.y + 1); assert(act(g, 'bearTrapSet', { eid: t.id }).ok);
  t.bearTrap.state = 'spent'; t.bearTrap.uses = 2; t.bearTrap.snapAt = T0 + 60000;  // fixture stamp of a live hit
  at(s.x + 2, s.y + 2);
  scenes.trapSnap = { snap: P.serializeSnapshot(g), clock: T0 + 60100 };
}
// IR sensor states along one physical line: gen -> cable -> sensor, with a wall line for the blocked frame.
function irScene(name, { fuel = true, enable = true, playerAt, wall = false, powerOn = true }) {
  const g = newRun(313), r = g.run, s = freeGrass(r), { build, at } = builder(g, r);
  const gen = build('base_generator', s.x, s.y); build('power_cable', s.x + 1, s.y); const sensor = build('ir_sensor', s.x + 2, s.y);
  if (wall) build('wall_wood', s.x + 3, s.y + 2);
  gen.basePower.capacity = 2; if (fuel) E.addItem(r, gen.c, 'wood', 2);
  if (powerOn) { at(s.x, s.y + 1); assert(act(g, 'basePower', { eid: gen.id, enabled: true }).ok); }
  if (enable) { at(s.x + 2, s.y + 1); assert(act(g, 'irSensorToggle', { eid: sensor.id }).ok); }
  at(playerAt[0] + s.x, playerAt[1] + s.y);
  scenes[name] = { snap: P.serializeSnapshot(g), clock: T0 + 60000 };
}
irScene('irOff', { enable: false, fuel: true, playerAt: [2, 2] });
irScene('irUnpowered', { fuel: false, playerAt: [2, 2] });
irScene('irReady', { fuel: true, playerAt: [9, 2] });
irScene('irDetect', { fuel: true, playerAt: [2, 2] });
irScene('irBlocked', { fuel: true, wall: true, playerAt: [5, 2] });
// Industrial items in the carried inventory, and a workbench for the Metal Pipe recycle option.
{
  const g = newRun(313), r = g.run, s = freeGrass(r), { build, at } = builder(g, r);
  for (const [k, q] of [['metal_pipe', 2], ['iron_plate', 2], ['metal_blade', 1], ['mechanical_gear', 2], ['refined_iron_ingot', 3]]) E.addItem(r, 'inv', k, q);
  build('workbench', s.x, s.y); at(s.x, s.y + 1);
  scenes.industrial = { snap: P.serializeSnapshot(g), clock: T0 + 60000 };
}
// Airdrop crate: the real engine lands a drop; the player stands near it after the lock time (open) and before it (locked).
const airOf = (g) => Object.values(g.run.entities).find(e => e.kind === 'airdrop');
{
  W.setActiveLayout('shipping');
  const g = E.newGame(); assert(act(g, 'startRun', { character: 'female', seed: 55 }, T0).ok); g.run.creatures = [];
  const A = await vite.ssrLoadModule('/src/game/airdrop.ts');
  const t = A.airdropTimes(g.run, 0);
  E.stepAirdrops(g.run, t.signalAt); g.run.clock.lastSimAt = t.signalAt; E.markDirty();
  const e = airOf(g);
  const near = (at) => { g.run.player.x = e.x - 14; g.run.player.y = e.y; E.markDirty(); return P.serializeSnapshot(g); };
  scenes.airLocked = { snap: near(), clock: t.landAt + 30000 };
  scenes.airOpen = { snap: near(), clock: t.unlockAt + 5000 };
}

await fs.writeFile(`${out}/scenes-snapshots.json`, JSON.stringify(scenes));
// ---- browser: each scene in a fresh context (fixture restored from the snapshot; no teleports after load) ----
const URL = process.env.GAME_URL || 'http://127.0.0.1:4410';
// The Playwright-bundled shell lacks libnss3 in this sandbox; use the self-contained Chromium shipped with @sparticuz/chromium.
const sp = (await import(process.env.SPARTICUZ || '/home/user/browser/node_modules/@sparticuz/chromium/build/index.js')).default;
const EXE = await sp.executablePath();
const browser = await chromium.launch({ headless: true, executablePath: EXE, args: sp.args.filter(a => a !== '--single-process') });
const errors = [];
async function open(name, vp) {
  const sc = scenes[name];
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript(({ v, t }) => { localStorage.setItem('soh.state.v3', v); const real = Date.now.bind(Date), begin = real(); Date.now = () => t + (real() - begin); }, { v: sc.snap, t: sc.clock });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  const cont = page.getByRole('button', { name: /Continue/i }).first();
  await cont.waitFor({ state: 'visible', timeout: 15000 }).then(() => cont.click()).catch(() => {});
  await page.waitForFunction(() => window.__soh?.run, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible().catch(() => false)) { await close.click(); await page.waitForTimeout(250); }
  return { ctx, page };
}
const VPS = [['640x360', { width: 640, height: 360 }], ['1280x720', { width: 1280, height: 720 }]];
const shots = [];
for (const [vn, vp] of VPS) {
  for (const name of ['traps', 'trapSnap', 'irOff', 'irUnpowered', 'irReady', 'irDetect', 'irBlocked', 'airLocked', 'airOpen']) {
    const { ctx, page } = await open(name, vp);
    if (name === 'trapSnap') { /* first frame after the snapshot is inside the 0.4 s window */ }
    await page.screenshot({ path: `${out}/${name}-${vn}.png` }); shots.push(`${name}-${vn}.png`);
    await ctx.close();
  }
  // craft panel with the Metal Pipe recycle option at a real workbench, and the carried inventory
  const { ctx, page } = await open('industrial', vp);
  await page.keyboard.press('KeyI'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/industrial-inventory-${vn}.png` }); shots.push(`industrial-inventory-${vn}.png`);
  await page.keyboard.press('KeyI'); await page.keyboard.press('KeyC'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/industrial-craft-${vn}.png` }); shots.push(`industrial-craft-${vn}.png`);
  await ctx.close();
}
await browser.close(); await vite.close();
console.log(JSON.stringify({ shots, errors }, null, 1));
assert.equal(errors.length, 0, 'no page errors');
