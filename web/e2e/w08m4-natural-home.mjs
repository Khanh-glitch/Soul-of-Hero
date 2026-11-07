// W08-M4 Delivery A: NATURAL home from a clean New Game. No material grants, no teleport, no terrain edits,
// no creature changes. Every gameplay action is real keyboard/mouse input. window.__soh is read-only observation.
// Route: gather wood/stone/plant fiber -> hand-craft rope -> build 2x2 shelter (floors, roof, bed, chest, Cabinet,
// walls, door) -> fill Cabinet from inventory -> close door -> save -> reopen in a NEW browser context.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const OUT = 'evidence/w08m4-natural-home';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.GAME_URL || 'http://127.0.0.1:4190/';
const trace = { steps: [], inputs: 0, builds: [], gathers: [] };
const step = (k, v) => { trace.steps.push({ t: Date.now(), k, v }); console.log(k, JSON.stringify(v ?? null).slice(0, 400)); };
const key = async (page, k, ms = 120) => { trace.inputs++; await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
let page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'New run' }).click(); trace.inputs++;
await page.getByTestId('layout-shipping-fresh').click(); trace.inputs++;
await page.getByRole('button', { name: 'Begin the 14 days' }).click(); trace.inputs++;
await page.waitForTimeout(3500);
const dismiss = page.getByRole('button', { name: 'Continue', exact: true });
if (await dismiss.isVisible().catch(() => false)) { await dismiss.click(); trace.inputs++; }
await page.waitForTimeout(500);

const obs = () => page.evaluate(() => {
  const r = window.__soh.run, p = r.player;
  const tot = {}; for (const s of r.custody.inv.slots) if (s) tot[s.key] = (tot[s.key] || 0) + s.qty;
  return { px: p.x, py: p.y, tx: Math.floor(p.x / 16), ty: Math.floor(p.y / 16), inv: tot, hp: p.hp, hunger: p.hunger, thirst: p.thirst, dead: p.dead, cam: null };
});
const camOf = () => page.evaluate(async () => { const { cam } = await import('/src/game/render.ts'); return { x: Math.round(cam.x), y: Math.round(cam.y) }; });

// Walkability on the game's own grid + live resource sources (what physically stops a player).
const WALK_BFS = `(async (goalTiles) => {
  const { blockGrid, sourceAt } = await import('/src/game/engine.ts');
  const r = window.__soh.run, g = blockGrid(r), W = 200;
  const sx = Math.floor(r.player.x / 16), sy = Math.floor(r.player.y / 16);
  const bad = (x, y) => { const c = g[y * W + x]; if ([1, 2, 3, 5].includes(c)) return true; const s = sourceAt(r, x, y); return !!(s && s.stock > 0); };
  const goal = new Set(goalTiles.map(([x, y]) => y * W + x));
  const prev = new Map([[sy * W + sx, -1]]), q = [sy * W + sx]; let hit = -1;
  for (let h = 0; h < q.length && h < 60000; h++) {
    const i = q[h]; if (goal.has(i)) { hit = i; break; }
    const cx = i % W, cy = Math.floor(i / W);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cx + dx, ny = cy + dy, j = ny * W + nx;
      if (nx < 1 || ny < 1 || nx >= 199 || ny >= 199 || prev.has(j)) continue;
      if (bad(nx, ny) && !goal.has(j)) continue;
      prev.set(j, i); q.push(j);
    }
  }
  if (hit < 0) return null;
  const path = []; for (let j = hit; j !== -1; j = prev.get(j)) path.push([j % W, Math.floor(j / W)]);
  return path.reverse();
})`;
async function walkTo(goalTiles, label) {
  const path = await page.evaluate(`${WALK_BFS}(${JSON.stringify(goalTiles)})`);
  if (!path) throw new Error(`no walkable route for ${label}`);
  for (const [tx, ty] of path.slice(1)) {
    let flip = false;
    for (let t = 0; t < 160; t++) {
      if (t % 3 === 0) await fightNearby(label);
      const a = await obs(); const dx = tx * 16 + 8 - a.px, dy = ty * 16 + 8 - a.py;
      if (Math.hypot(dx, dy) < 5) break;
      const vertical = Math.abs(dy) > Math.abs(dx);
      const up = flip ? !vertical : vertical;
      const k = up ? (dy > 0 ? 's' : 'w') : (dx > 0 ? 'd' : 'a');
      await key(page, k, 110);
      const b = await obs(); flip = Math.hypot(b.px - a.px, b.py - a.py) < 1.2;
    }
  }
  return true;
}
// Equip: press the hotbar digit (1-8) of the first slot holding `key` (real keyboard).
async function equip(key) {
  const idx = await page.evaluate(k => window.__soh.run.custody.inv.slots.findIndex(s => s && s.key === k), key);
  if (idx < 0 || idx > 7) return false;
  const a = await obs(); if (a.inv[key] === undefined) return false;
  await page.keyboard.press(`Digit${idx + 1}`); trace.inputs++; await page.waitForTimeout(120);
  return true;
}
// Real combat: when a live creature is within 4 tiles, aim at it with the mouse and swing (LMB hold).
async function fightNearby(tag) {
  let stall = 0;
  for (let i = 0; i < 30; i++) {
    const c = await page.evaluate(() => {
      const r = window.__soh.run, p = r.player; let best = null;
      const HOSTILE = ['chase', 'attack', 'tell', 'recover', 'track', 'lunge', 'charge'];
      for (const m of r.creatures) { if (m.state === 'dead' || !HOSTILE.includes(m.state)) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < 64 && (!best || d < best.d)) best = { type: m.type, state: m.state, x: m.x, y: m.y, hp: m.hp, d }; }
      return best;
    });
    if (!c) return;
    const a0 = await obs();
    if (a0.hp < 55 && a0.inv.bandage) { const ok = await useItemByTitle('Bandage'); step('HEAL', { tag, hp: a0.hp, ok, in: 'fight' }); continue; }
    if (a0.dead) { fs.writeFileSync(`${OUT}/trace-fail.json`, JSON.stringify(trace, null, 1)); throw new Error(`player dead during fight (${tag}): ${JSON.stringify(a0)}`); }
    if (c.d > 22) { // close to melee reach with real movement first; give up if the gap is not shrinking (blocked)
      if (stall >= 2) return;
      const dx = c.x - a0.px, dy = c.y - a0.py; const k = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 's' : 'w') : (dx > 0 ? 'd' : 'a');
      await key(page, k, 160); const a1 = await obs(); const d1 = Math.hypot(c.x - a1.px, c.y - a1.py);
      stall = d1 >= c.d - 1 ? stall + 1 : 0;
      step('CLOSE', { tag, type: c.type, d: Math.round(c.d), after: Math.round(d1) }); continue;
    }
    const cam = await camOf();
    await page.mouse.move(c.x - cam.x, c.y - cam.y); trace.inputs++;
    await page.mouse.down(); trace.inputs++; await page.waitForTimeout(380); await page.mouse.up(); trace.inputs++;
    step('FIGHT', { tag, type: c.type, state: c.state, hp: c.hp, d: Math.round(c.d), me: a0.hp });
  }
}
// Use an item by right-clicking its slot; bag slots beyond the 8-slot hotbar need the Inventory panel (I).
async function useItemByTitle(title) {
  const hot = page.locator(`.slot[title^="${title}"]`).first();
  if (await hot.count()) { await hot.click({ button: 'right' }); trace.inputs++; await page.waitForTimeout(300); return true; }
  await page.keyboard.press('i'); trace.inputs++; await page.waitForTimeout(300);
  const bag = page.locator(`.slot[title^="${title}"]`).first();
  if (!(await bag.count())) { await page.keyboard.press('i'); trace.inputs++; return false; }
  await bag.click({ button: 'right' }); trace.inputs++; await page.waitForTimeout(300);
  await page.keyboard.press('i'); trace.inputs++; await page.waitForTimeout(200);
  return true;
}
// Real survival inputs: right-click an inventory slot = useItem (same as the game's context action).
async function survive(tag) {
  await fightNearby(tag);
  const a = await obs();
  if (a.dead) { fs.writeFileSync(`${OUT}/trace-fail.json`, JSON.stringify(trace, null, 1)); throw new Error(`player dead during ${tag}: ${JSON.stringify(a)}`); }
  if (a.thirst < 45 && a.inv.water_flask) { const ok = await useItemByTitle('Water Flask'); step('DRINK', { tag, thirst: a.thirst, ok }); }
  if (a.hp < 60 && a.inv.bandage) { const ok = await useItemByTitle('Bandage'); step('HEAL', { tag, hp: a.hp, ok }); }
  if (a.hunger < 45 && a.inv.berries) { const ok = await useItemByTitle('Berries'); step('EAT', { tag, hunger: a.hunger, ok }); }
}
// Gather from the nearest source of a material with real hits; re-plan after each target.
async function gather(mat, want, invKeys, label, keys = null) {
  const dead = []; // targets that yielded nothing on a real hold (exhausted or unreachable from this side)
  for (let turn = 0; turn < 90; turn++) {
    await survive(label);
    await equip(mat === 'wood' ? 'stone_axe' : 'knife');
    const a = await obs();
    const have = invKeys.reduce((n, k) => n + (a.inv[k] || 0), 0);
    if (have >= want) return have;
    const plan = await page.evaluate(async ({ mat, dead, keys }) => {
      const { sourceAt, blockGrid } = await import('/src/game/engine.ts');
      const r = window.__soh.run, W = 200, g = blockGrid(r);
      const sx = Math.floor(r.player.x / 16), sy = Math.floor(r.player.y / 16);
      const seen = new Map([[sy * W + sx, -1]]), q = [sy * W + sx];
      for (let h = 0; h < q.length && h < 20000; h++) {
        const i = q[h], cx = i % W, cy = Math.floor(i / W);
        for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          const nx = cx + dx, ny = cy + dy, j = ny * W + nx;
          const s = sourceAt(r, nx, ny);
          if (s && s.stock > 0 && s.def.mat === mat && (!keys || keys.includes(s.key)) && !dead.includes(`${nx},${ny}`)) {
            const path = []; for (let k = i; k !== -1; k = seen.get(k)) path.push([k % W, Math.floor(k / W)]);
            return { path: path.reverse(), target: { x: nx, y: ny, key: s.key, stock: s.stock } };
          }
          if (nx < 1 || ny < 1 || nx >= 199 || ny >= 199 || seen.has(j)) continue;
          if ([1, 2, 3, 5].includes(g[j]) || (sourceAt(r, nx, ny)?.stock > 0)) continue;
          seen.set(j, i); q.push(j);
        }
      }
      return null;
    }, { mat, dead, keys });
    if (!plan) throw new Error(`no reachable ${mat} source (${label})`);
    await walkTo(plan.path.slice(-1), `${label} stand`);
    const cam = await camOf(); const t = plan.target;
    await page.mouse.move(t.x * 16 + 8 - cam.x, t.y * 16 + 8 - cam.y); trace.inputs++;
    await page.mouse.down(); trace.inputs++;
    await page.waitForTimeout(3600);
    await page.mouse.up(); trace.inputs++;
    await page.waitForTimeout(400);
    const after = await obs();
    const gained = invKeys.reduce((n, k) => n + (after.inv[k] || 0), 0) - have;
    if (gained <= 0) dead.push(`${t.x},${t.y}`);
    step('dbg', { hp: after.hp, hunger: after.hunger, thirst: after.thirst, dead: after.dead, dead_tiles: dead.slice(-3), mouse: [t.x * 16 + 8 - cam.x, t.y * 16 + 8 - cam.y], cam, player: [after.px, after.py], gained });
    trace.gathers.push({ mat, target: t, before: have, after: invKeys.reduce((n, k) => n + (after.inv[k] || 0), 0) });
    step('gather', { label, target: t, before: have, after: trace.gathers.at(-1).after, pos: [after.tx, after.ty] });
  }
  fs.writeFileSync(`${OUT}/trace-fail.json`, JSON.stringify(trace, null, 1));
  throw new Error(`gather target unmet: ${label}`);
}
// Build one structure at (x,y). Stands on the nearest reachable free tile, then uses the real build menu + click.
async function build(type, label, x, y, center = null) {
  const stands = [];
  for (let d = 1; d <= 3; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
    const sx = x + dx, sy = y + dy; if (sx === x && sy === y) continue; stands.push([sx, sy]);
  }
  // ring walls: stand OUTSIDE the shelter (farthest from its centre first); interior stands cannot place walls
  if (center) stands.sort((a, b) => Math.hypot(b[0] - center.x, b[1] - center.y) - Math.hypot(a[0] - center.x, a[1] - center.y));
  let lastReason = null;
  for (const st of stands.slice(0, 24)) {
    try { await walkTo([st], `${label} stand at ${st}`); } catch { continue; }
    const a = await obs(); if (a.tx !== st[0] || a.ty !== st[1]) continue;
    lastReason = await page.evaluate(async ({ type, x, y }) => { const { buildReason } = await import('/src/game/engine.ts'); return buildReason(window.__soh, type, x, y); }, { type, x, y });
    if (lastReason) continue;
    await page.keyboard.press('b'); trace.inputs++;
    await page.waitForTimeout(250);
    await page.getByLabel('Find structure').fill(label); trace.inputs++; await page.waitForTimeout(150);
    await page.getByRole('button', { name: new RegExp(label) }).first().click(); trace.inputs++;
    await page.waitForTimeout(200);
    const cam = await camOf();
    await page.mouse.click(x * 16 + 8 - cam.x, y * 16 + 8 - cam.y); trace.inputs++;
    await page.waitForTimeout(450);
    await page.keyboard.press('Escape'); trace.inputs++;
    const rec = await page.evaluate(({ type, x, y }) => window.__soh.run.receipts.some(q => q.kind === 'build' && q.detail === `${type}@${x},${y}`), { type, x, y });
    if (rec) { trace.builds.push({ type, x, y, stand: st }); step('BUILT', { type, x, y, stand: st }); return true; }
  }
  throw new Error(`build failed ${type}@${x},${y}: ${lastReason ?? 'no stand'}`);
}

// Hand craft: open Crafting (C), search a known recipe, select it, press Craft (real clicks).
async function craftHand(name) {
  await page.keyboard.press('c'); trace.inputs++;
  await page.waitForTimeout(300);
  const q = page.getByLabel('Find known recipe');
  if (await q.count()) { await q.fill(name); trace.inputs++; await page.waitForTimeout(200); }
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click(); trace.inputs++;
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Craft', exact: true }).first().click(); trace.inputs++;
  await page.waitForTimeout(2800);
  await page.keyboard.press('c'); trace.inputs++;
  await page.waitForTimeout(200);
}
// ---------- phase 1: first tools with the starting knife (natural order) ----------
step('START', await obs());
await gather('stone', 3, ['stone'], 'stone-start');
await gather('plant', 3, ['fiber'], 'fiber-start', ['grass', 'reed']);
// hand-craft rope (3 fiber -> 1 rope, 1 s, no station)
await craftHand('Rope');
step('CRAFTED_ROPE', (await obs()).inv);
await gather('wood', 3, ['wood'], 'wood-start');
// hand-craft stone axe (3 wood + 3 stone + 1 rope, no station): 3x wood power of the knife
await craftHand('Stone Axe');
step('CRAFTED_AXE', (await obs()).inv);
// bandages (base recipe, 4 fiber each, heal 18 HP on right-click) so fights are survivable
await gather('plant', 32, ['fiber'], 'fiber-bandage', ['grass', 'reed']);
for (let i = 0; i < 8; i++) await craftHand('Bandage');
step('CRAFTED_BANDAGES', (await obs()).inv);
// ---------- phase 1b: bulk gather with the axe ----------
await gather('wood', 125, ['wood'], 'wood');
step('GATHERED_WOOD', await obs());
await gather('stone', 15, ['stone'], 'stone');
step('GATHERED_STONE', await obs());
await gather('plant', 60, ['fiber'], 'fiber', ['grass', 'reed']); // bulk fiber after bandages
step('GATHERED_FIBER', await obs());
await page.screenshot({ path: `${OUT}/01-gathered-640.png` });
await craftHand('Rope'); // second rope for the door
await craftHand('Bandage'); await craftHand('Bandage'); // reserve for fights (6 total)
step('CRAFTED_ROPE2', (await obs()).inv);

// ---------- phase 3: shelter origin on a terrain-free 4x4 block near the player ----------
const origin = await page.evaluate(async () => {
  const { blockGrid, sourceAt } = await import('/src/game/engine.ts');
  const r = window.__soh.run, g = blockGrid(r), W = 200;
  const px = Math.floor(r.player.x / 16), py = Math.floor(r.player.y / 16);
  for (let rad = 2; rad < 14; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
    const ox = px + dx, oy = py + dy; let ok = true;
    for (let y = oy - 1; y <= oy + 2 && ok; y++) for (let x = ox - 1; x <= ox + 2 && ok; x++) { if (g[y * W + x] !== 0 || sourceAt(r, x, y)?.stock > 0) ok = false; }
    if (!ok) continue;
    // the game's own placement rules (protected entrances / corridors) must accept every footprint tile
    const { buildReason } = await import('/src/game/engine.ts');
    const tiles = []; for (let y = oy - 1; y <= oy + 2; y++) for (let x = ox - 1; x <= ox + 2; x++) tiles.push([x, y]);
    let rules = true;
    for (const [x, y] of tiles) { if (buildReason(window.__soh, (x >= ox && x <= ox + 1 && y >= oy && y <= oy + 1) ? 'floor_wood' : 'wall_wood', x, y)) { rules = false; break; } }
    if (rules) return { x: ox, y: oy };
  }
  return null;
});
if (!origin) throw new Error('no terrain-free 4x4 site near the player');
step('SHELTER_ORIGIN', origin);
const { x: ox, y: oy } = origin;

// interior (player-side) first, then walls from outside
await walkTo([[ox, oy + 1]], 'interior stand');
for (const [x, y] of [[ox, oy], [ox + 1, oy], [ox, oy + 1], [ox + 1, oy + 1]]) await build('floor_wood', 'Wood Floor', x, y);
for (const [x, y] of [[ox, oy], [ox + 1, oy], [ox, oy + 1], [ox + 1, oy + 1]]) await build('roof_thatch', 'Thatch Roof', x, y);
await build('bed_straw', 'Straw Bed', ox, oy);
await build('claim', 'Territory Cabinet', ox + 1, oy);
await build('chest_small', 'Wood Chest', ox + 1, oy + 1);
step('INTERIOR_DONE', { sample: await obs() });
// ring walls (12 tiles), door on the south side
const ring = [];
for (let y = oy - 1; y <= oy + 2; y++) for (let x = ox - 1; x <= ox + 2; x++) if (!(x >= ox && x <= ox + 1 && y >= oy && y <= oy + 1)) ring.push([x, y]);
for (const [x, y] of ring) {
  const center = { x: ox + 0.5, y: oy + 0.5 };
  if (x === ox && y === oy + 2) await build('door_wood', 'Wood Door', x, y, center);
  else await build('wall_wood', 'Wood Wall', x, y, center);
}
step('RING_DONE', {});
// topology: read-only check that the interior is a single enclosed roofed room
const topo = await page.evaluate(async ({ ox, oy }) => {
  const E = await import('/src/game/engine.ts');
  const r = window.__soh.run; const bed = Object.values(r.entities).find(e => e.type === 'bed_straw');
  const room = E.roofRoom(r, bed.x, bed.y);
  return { enclosed: room.enclosed, cells: [...room.cells].length, bed: { tx: bed.tx, ty: bed.ty } };
}, { ox, oy });
step('TOPOLOGY', topo);
assert.equal(topo.enclosed, true, 'shelter must be enclosed');
await page.screenshot({ path: `${OUT}/02-shelter-640.png` });

// ---------- phase 4: fund the Cabinet from the inventory (open the door, go in) ----------
await walkTo([[ox, oy + 3]], 'outside door');
await page.keyboard.press('e'); trace.inputs++;
await page.waitForTimeout(400);
await walkTo([[ox, oy + 1]], 'inside');
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/03-inside-640.png` });
await page.keyboard.press('f'); trace.inputs++;
await page.waitForTimeout(500);
const cabPanel = page.locator('.panel').filter({ hasText: 'Inventory · X returns' }).first();
const fillBtn = page.getByRole('button', { name: 'Inventory / fill cabinet' });
if (await fillBtn.count()) { await fillBtn.click(); trace.inputs++; }
await page.waitForTimeout(300);
for (const title of ['Wood', 'Stone']) {
  const slot = cabPanel.locator(`.slot[title="${title}"]`).first();
  if (await slot.count()) { await slot.click({ modifiers: ['Shift'] }); trace.inputs++; await page.waitForTimeout(250); }
}
const funded = await obs();
step('CABINET_FILL', funded.inv);
await page.screenshot({ path: `${OUT}/04-cabinet-filled-640.png` });
await page.keyboard.press('Escape'); trace.inputs++;

// ---------- phase 5: close the door from inside, then read the home state ----------
await walkTo([[ox, oy + 1]], 'door stand');
await page.keyboard.press('e'); trace.inputs++;
await page.waitForTimeout(300);
const home = await page.evaluate(async () => {
  const E = await import('/src/game/engine.ts');
  const r = window.__soh.run; const s = E.homeStatus(r);
  return { cabinets: s.cabinets.map(c => ({ state: c.state, funded: c.funded, hours: c.hours, stock: c.stock })), structures: s.structures.map(x => ({ type: x.type, state: x.state, hp: x.hp, maxHp: x.maxHp })), uncovered: s.uncoveredCount };
});
step('HOME', home);
const doorOpen = await page.evaluate(() => Object.values(window.__soh.run.entities).filter(e => e.type === 'door_wood').map(e => ({ open: !!e.open })));
step('DOOR', doorOpen);
await page.screenshot({ path: `${OUT}/05-home-640.png` });
trace.errors = errors;
fs.writeFileSync(`${OUT}/trace.json`, JSON.stringify(trace, null, 2));
await browser.close();
console.log('DONE', errors.length ? errors : 'no page errors');
