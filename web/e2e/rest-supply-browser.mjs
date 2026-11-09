// Priority 1 browser proof: supplied bed rest.
// REAL input: New run, layout, begin, keyboard E on the bed, clicks in the rest panel, reload via Continue.
// CONTROLLED FIXTURE (labelled in evidence/rest-supply/fixture.json): the 2x2 shelter, bed, chest and provisions are
// placed through the game's own dispatch() build/addItem intents, and hunger/thirst are set to 40/60 so a
// 8-hour interval reaches the trigger. The clock is advanced with Playwright page.clock so the real game loop
// (tick -> settle -> restStep) runs the interval; nothing else is simulated.
import {chromium} from 'playwright';
import fs from 'node:fs';
const URL = process.env.GAME_URL || 'http://127.0.0.1:4190/';
const OUT = 'evidence/rest-supply';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (k, v) => { const row = { t: new Date().toISOString(), k, v }; log.push(row); console.log(k, JSON.stringify(v)); };
const H = 3600000;

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.clock.install({ time: new Date('2026-11-06T10:00:00+07:00') });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'New run' }).click();
await page.getByTestId('layout-shipping-fresh').click();
await page.getByRole('button', { name: 'Begin the 14 days' }).click();
await page.waitForTimeout(1200);

const G = `(()=>{let el=document.querySelector('canvas'),f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];while(f&&!f.memoizedProps?.gs)f=f.return;return f.memoizedProps.gs;})()`;

// ---- controlled fixture through real game intents ----
const fixture = await page.evaluate(async (G) => {
  const gs = eval(G);
  const E = await import('/src/game/engine.ts');
  const { getWorld } = await import('/src/game/world.ts');
  const { WW, TILE } = await import('/src/game/core.ts');
  const r = gs.run; r.creatures = []; const now = Date.now();
  const w = getWorld(), grid = E.blockGrid(r);
  const px = Math.floor(r.player.x / TILE), py = Math.floor(r.player.y / TILE);
  const ok = (x, y) => { for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) { const i = (y + dy) * WW + x + dx; if (!(grid[i] === 0 && !w.sourceV3[i] && w.economyMap.buildable[i] && !w.economyMap.protected[i] && !w.accessCorridors?.mask[i])) return false; } return true; };
  let site = null;
  for (let rad = 3; rad < 60 && !site; rad++) for (let dy = -rad; dy <= rad && !site; dy++) for (let dx = -rad; dx <= rad && !site; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === rad && ok(px + dx, py + dy)) site = { x: px + dx, y: py + dy };
  if (!site) return { error: 'no site' };
  const { x, y } = site; const fails = [];
  const mats = [['wood', 400], ['fiber', 200], ['stone', 60]];
  for (const [k, n] of mats) E.addItem(r, 'inv', k, n);
  const build = (struct, tx, ty) => { const res = E.dispatch(gs, { id: `fx-${struct}-${tx}-${ty}`, type: 'build', struct, tx, ty }, now); if (!res.ok) fails.push(`${struct}@${tx},${ty}:${res.reason}`); return res.ok; };
  const stand = (tx, ty) => { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; };
  stand(x, y + 1);
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) build('floor_wood', x + dx, y + dy);
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) build('roof_thatch', x + dx, y + dy);
  for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 2; dy++) {
    if (dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1) continue;
    stand(x + dx + (dx < 0 ? -1 : dx > 1 ? 1 : 0), y + dy + (dy < 0 ? -1 : dy > 1 ? 1 : 0));
    build('wall_wood', x + dx, y + dy);
  }
  stand(x, y + 1);
  build('bed_straw', x, y); build('chest_small', x + 1, y + 1);
  const bed = Object.values(r.entities).find(e => e.type === 'bed_straw');
  const chest = Object.values(r.entities).find(e => e.type === 'chest_small');
  if (!bed || !chest) return { error: 'bed/chest missing', fails };
  E.addItem(r, chest.c, 'cooked_meat', 3); E.addItem(r, chest.c, 'meat', 1); E.addItem(r, chest.c, 'water_flask', 1);
  const flask = E.C(r, chest.c).slots.find(s => s?.key === 'water_flask'); flask.charge = 4;
  r.player.hunger = 40; r.player.thirst = 60;
  stand(x, y + 1);
  return { site, bedId: bed.id, chestId: chest.id, fails, chestUids: E.C(r, chest.c).slots.filter(Boolean).map(s => ({ uid: s.uid, key: s.key, qty: s.qty, charge: s.charge ?? null })), flaskUid: flask.uid, meatUid: E.C(r, chest.c).slots.find(s => s?.key === 'cooked_meat')?.uid };
}, G);
fs.writeFileSync(`${OUT}/fixture.json`, JSON.stringify({ labelled: 'CONTROLLED FIXTURE — shelter/bed/chest/provisions placed through game intents; hunger 40 / thirst 60 set for the test', ...fixture }, null, 2));
note('FIXTURE', fixture);
if (fixture.error) throw new Error(fixture.error);

await page.waitForTimeout(600);
// ---- real input: walk is unnecessary (player stands beside the bed); press E ----
await page.keyboard.press('KeyE');
await page.waitForTimeout(500);
await page.getByText('Straw bed · rest').waitFor({ timeout: 5000 });
await page.screenshot({ path: `${OUT}/01-bed-panel-640x360.png` });
note('PANEL_OPEN', 'Straw bed · rest visible after real KeyE');

// ---- real clicks: reserve the eligible stacks by UID, keep 8 h ----
const reserveBtn = page.getByRole('button', { name: 'Reserve', exact: true });
await reserveBtn.nth(0).click(); await page.waitForTimeout(150);
await reserveBtn.nth(0).click(); await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/02-reserved-640x360.png` });
const before = await page.evaluate(G => { const g = eval(G), r = g.run; return { hunger: r.player.hunger, thirst: r.player.thirst, chest: r.entities[Object.keys(r.entities).find(k => r.entities[k].type === 'chest_small')].c && r.custody[Object.values(r.entities).find(e => e.type === 'chest_small').c].slots.filter(Boolean).map(s => ({ uid: s.uid, key: s.key, qty: s.qty, charge: s.charge ?? null })), now: Date.now() }; }, G);
note('BEFORE_START', before);
await page.getByRole('button', { name: 'Lie down 8 h' }).click();
await page.waitForTimeout(400);
await page.getByText('Resting on straw bed').waitFor({ timeout: 5000 });
await page.screenshot({ path: `${OUT}/03-resting-640x360.png` });
const started = await page.evaluate(G => { const g = eval(G), r = g.run; const rc = r.custody[r.rest.reserveId]; return { rest: r.rest, reserve: rc.slots.filter(Boolean).map(s => ({ uid: s.uid, key: s.key, qty: s.qty, charge: s.charge ?? null })), chestNow: r.custody[Object.values(r.entities).find(e => e.type === 'chest_small').c].slots.filter(Boolean).length }; }, G);
note('STARTED', started);

// ---- an interval passes through the real loop (3 h), then the page is reopened ----
await page.clock.fastForward(3 * H);
await page.waitForTimeout(400);
const mid = await page.evaluate(G => { const g = eval(G), r = g.run; return { restActive: !!r.rest, hunger: r.player.hunger, thirst: r.player.thirst, reserve: r.rest ? r.custody[r.rest.reserveId].slots.filter(Boolean).map(s => ({ uid: s.uid, key: s.key, qty: s.qty, charge: s.charge ?? null })) : null, receipts: r.receipts.filter(x => x.kind.startsWith('rest.')).map(x => [x.kind, x.detail]) }; }, G);
note('MID_REST_3H', mid);
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /^Continue/ }).click();
await page.waitForTimeout(800);
const reopened = await page.evaluate(G => { const g = eval(G), r = g.run; return { restActive: !!r.rest, reserve: r.rest ? r.custody[r.rest.reserveId].slots.filter(Boolean).map(s => ({ uid: s.uid, key: s.key, qty: s.qty, charge: s.charge ?? null })) : null, now: Date.now() }; }, G);
note('REOPENED_MID_REST', reopened);
await page.clock.fastForward(6 * H);
await page.waitForTimeout(600);
const done = await page.evaluate(G => { const g = eval(G), r = g.run; const ch = r.custody[Object.values(r.entities).find(e => e.type === 'chest_small').c]; return { restActive: !!r.rest, hunger: r.player.hunger, thirst: r.player.thirst, chest: ch.slots.filter(Boolean).map(s => ({ uid: s.uid, key: s.key, qty: s.qty, charge: s.charge ?? null })), receipts: r.receipts.filter(x => x.kind.startsWith('rest.')).map(x => [x.kind, x.at, x.detail]), log: r.log?.slice(-3) ?? null }; }, G);
note('WOKE', done);
await page.screenshot({ path: `${OUT}/04-woke-640x360.png` });

// ---- save and reopen after the wake: custody must be identical to what the wake reported ----
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /^Continue/ }).click();
await page.waitForTimeout(800);
const final = await page.evaluate(G => { const g = eval(G), r = g.run; const ch = r.custody[Object.values(r.entities).find(e => e.type === 'chest_small').c]; return { restActive: !!r.rest, chest: ch.slots.filter(Boolean).map(s => ({ uid: s.uid, key: s.key, qty: s.qty, charge: s.charge ?? null })), receipts: r.receipts.filter(x => x.kind.startsWith('rest.')).map(x => [x.kind, x.at, x.detail]) }; }, G);
note('REOPENED_AFTER_WAKE', final);
await page.screenshot({ path: `${OUT}/05-reopened-640x360.png` });
fs.writeFileSync(`${OUT}/run-log.json`, JSON.stringify({ log, errors }, null, 2));
note('PAGE_ERRORS', errors);
await browser.close();
