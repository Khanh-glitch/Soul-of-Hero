// B04-P3 short controlled browser checks at 640x360 (fixture = start state only; every interaction is real input/load).
// Scenes: SYS12 airdrop phases (incoming, descending, locked+E refusal, accessible+E, partial withdrawal, night locked),
// SYS15 local heat card (burning -> burned out after a real offline settle on Continue), B02 IR sensor E toggle,
// B02 bear trap E arm / spent+E rearm, with autosave reload in a new context for the partial airdrop and the armed trap.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'evidence/b04-p3-world'; await fs.mkdir(out, { recursive: true });
const vite = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const E = await vite.ssrLoadModule('/src/game/engine.ts');
const P = await vite.ssrLoadModule('/src/game/persist.ts');
const C = await vite.ssrLoadModule('/src/game/core.ts');
const A = await vite.ssrLoadModule('/src/game/airdrop.ts');
const W = await vite.ssrLoadModule('/src/game/world.ts');
const K = await vite.ssrLoadModule('/src/game/catalog.ts');
const H = await vite.ssrLoadModule('/src/game/thermal.ts');
const { TILE, WW, T, HOUR } = C;
const T0 = Date.UTC(2026, 10, 5);
const act = (g, type, data, now) => E.dispatch(g, { id: `p3b-${type}-${Math.random()}`, type, ...data }, now);

// ---------- airdrop: pick a start so the landing falls at night and at day (real sun/darkness function) ----------
function airGame(startHourOffset) {
  W.setActiveLayout('shipping_fresh');
  const g = E.newGame(); const started = T0 + startHourOffset * HOUR;
  assert(act(g, 'startRun', { character: 'female', seed: 55 }, started).ok);
  g.run.creatures = [];
  const t = A.airdropTimes(g.run, 0);
  E.stepAirdrops(g.run, t.signalAt); g.run.clock.lastSimAt = t.signalAt; E.markDirty();
  return { g, t };
}
let nightK = null, dayK = null;
for (let k = 0; k < 24 && (nightK === null || dayK === null); k++) {
  const { g, t } = airGame(k); const r = g.run;
  const dark = E.darkness(r, t.landAt + 30000);
  if (nightK === null && dark > 0.6) nightK = { k, t, dark };
  if (dayK === null && dark < 0.1) dayK = { k, t, dark };
}
assert(nightK && dayK, 'could not find a day and a night landing');
W.setActiveLayout('shipping');
function airSnapshot(k) {
  const { g, t } = airGame(k); const r = g.run; const ev = Object.values(r.entities).find(e => e.kind === 'airdrop');
  return { snap: P.serializeSnapshot(g), t, e: { x: ev.x, y: ev.y, id: ev.id, c: ev.c } };
}
const day = { ...airSnapshot(dayK.k), dark: dayK.dark }, night = { ...airSnapshot(nightK.k), dark: nightK.dark };

// ---------- heat: a snowy spot, real campfire built by the real build action ----------
function snowSpot(r) {
  const grid = E.blockGrid(r), w = W.getWorld();
  const free = (x, y) => { const i = y * WW + x; return grid[i] === 0 && E.effTile(r, x, y) === T.SNOW && !w.economyMap.protected[i] && !w.accessCorridors?.mask[i]; };
  for (let y = 12; y < 200; y++) for (let x = 12; x < 200; x++) if (free(x, y) && free(x + 1, y) && free(x + 2, y) && free(x, y - 1) && free(x + 2, y - 1)) return { x, y };
  throw new Error('no snow spot');
}
function camp(kind, extra) {
  const g = E.newGame(); assert(act(g, 'startRun', { character: 'female', region: 0, seed: 313 }, T0).ok);
  const r = g.run; r.creatures = []; const s = snowSpot(r);
  E.addItem(r, 'inv', 'wood', 40); E.addItem(r, 'inv', 'stone', 20); E.addItem(r, 'inv', 'mechanical_gear', 2); E.addItem(r, 'inv', 'iron_ingot', 4); E.addItem(r, 'inv', 'fasteners', 4); E.addItem(r, 'inv', 'iron_plate', 4);
  const build = (type, tx, ty) => { r.player.x = tx * TILE + 8; r.player.y = (ty + 1) * TILE + 8; E.markDirty(); const res = act(g, 'build', { struct: type, tx, ty }, T0); assert(res.ok, `${type}: ${res.reason}`); return Object.values(r.entities).find(e => e.type === type && e.tx === tx && e.ty === ty); };
  const target = kind === 'campfire' ? build('campfire', s.x + 2, s.y) : build(kind, s.x + 1, s.y);
  r.player.x = s.x * TILE + 8; r.player.y = s.y * TILE + 8; r.player.aim = 0; E.markDirty();
  if (kind === 'campfire') E.addItem(r, target.station.fuelC, 'wood', 2);
  r.clock.lastSimAt = T0; E.markDirty();
  return { g, r, s, target, snap: P.serializeSnapshot(g) };
}
const fire = camp('campfire'); const paidMs = H.heaterRows(fire.r, { x: fire.r.player.x, y: fire.r.player.y })[0].paidMs; assert.ok(paidMs > 0, 'campfire has real paid fuel');
const sensor = camp('ir_sensor');
const trap = camp('bear_trap');
// spent-trap variant: a real used trap (uses 2) with one plate to re-arm; built state set via the save schema.
const trapSpentSnap = (() => { const o = camp('bear_trap'); const t = Object.values(o.r.entities).find(e => e.type === 'bear_trap'); t.bearTrap.state = 'spent'; t.bearTrap.uses = 2; return P.serializeSnapshot(o.g); })();

// ---------- browser ----------
const URL = process.env.GAME_URL || 'http://127.0.0.1:4330';
const EXE = '/home/user/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell';
const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });
const errors = []; const report = [];
async function open(snapshot, clockAt, { cont = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.addInitScript(({ v, t }) => { if (v) localStorage.setItem('soh.state.v3', v); const real = Date.now.bind(Date), begin = real(); Date.now = () => t + (real() - begin); }, { v: snapshot, t: clockAt });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  if (cont) { await page.getByRole('button', { name: /Continue/i }).first().click(); }
  await page.waitForFunction(() => window.__soh?.run, null, { timeout: 15000 });
  await page.waitForTimeout(700);
  await closeReport(page);
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: `${out}/${name}-640x360.png` });
const banner = (page) => page.locator('[data-testid="airdrop-banner"]').first().getAttribute('data-phase').catch(() => null);
const bannerText = (page) => page.locator('[data-testid="airdrop-banner"]').first().innerText().catch(() => '');
const closeReport = async (page) => { const b = page.getByRole('button', { name: 'Close', exact: true }); if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(250); } };
const invCount = (page, key) => page.evaluate(k => window.__soh.run.custody.inv.slots.filter(s => s && s.key === k).reduce((a, s) => a + s.qty, 0), key);
const trapState = (page) => page.evaluate(() => { const t = Object.values(window.__soh.run.entities).find(e => e.type === 'bear_trap'); return t ? t.bearTrap : null; });

try {
  const { t, e } = day;
  // A1 incoming: broad sector only; the crate is a lifted parachute over the sector.
  let c = await open(day.snap, t.signalAt + 5000);
  await c.page.waitForTimeout(400);
  report.push(['airdrop incoming phase', await banner(c.page)]); assert.equal(await banner(c.page), 'incoming');
  const incomingText = await bannerText(c.page);
  assert.ok(!/\d+\s*,\s*\d+/.test(incomingText), 'no coordinates in the banner');
  await shot(c.page, 'airdrop-1-incoming-day'); await c.ctx.close();
  // A2 descending: visible lift and chute.
  c = await open(day.snap, t.descentAt + 20000); await c.page.waitForTimeout(400);
  report.push(['airdrop descending phase', await banner(c.page)]); assert.equal(await banner(c.page), 'descending');
  await shot(c.page, 'airdrop-2-descending-day'); await c.ctx.close();
  // A3 locked: real E refusal with the countdown reason.
  c = await open(day.snap, t.landAt + 30000); await c.page.waitForTimeout(400);
  assert.equal(await banner(c.page), 'locked');
  await c.page.evaluate(([x, y]) => { window.__soh.run.player.x = x - 10; window.__soh.run.player.y = y; window.__soh.run.player.aim = 0; }, [e.x, e.y]);
  await c.page.waitForTimeout(300);
  await shot(c.page, 'airdrop-3-locked-prompt-day');
  await c.page.keyboard.press('e'); await c.page.waitForTimeout(300);
  await shot(c.page, 'airdrop-4-locked-refused-day');
  report.push(['locked E refusal toast', await c.page.getByText(/Airdrop locked: opens to all in \d+s/).count()]);
  assert.ok(await c.page.getByText(/Airdrop locked: opens to all in \d+s/).count() > 0, 'locked refusal reason visible');
  await c.ctx.close();
  // A4 accessible, E opens take-only; a real shift-click withdraws one stack; autosave; reload in a new context.
  c = await open(day.snap, t.unlockAt + 5000); await c.page.waitForTimeout(400);
  assert.equal(await banner(c.page), 'accessible');
  await c.page.evaluate(([x, y]) => { window.__soh.run.player.x = x - 10; window.__soh.run.player.y = y; window.__soh.run.player.aim = 0; }, [e.x, e.y]);
  await c.page.waitForTimeout(300); await shot(c.page, 'airdrop-5-accessible-day');
  await c.page.keyboard.press('e'); await c.page.getByText('Airdrop · take only').waitFor({ timeout: 5000 });
  const airPanel = c.page.getByText('Airdrop · take only').locator('xpath=ancestor::div[contains(@class,"panel")][1]');
  const slot = airPanel.locator('.slot[title]:not([title=""])').first();
  const stockNow = () => c.page.evaluate(() => { const a = Object.values(window.__soh.run.entities).find(x => x.kind === 'airdrop'); return a ? [window.__soh.run.custody[a.c].slots.filter(Boolean).length, a.airdrop.phase] : null; });
  const s0 = await stockNow(); const slotCount = await slot.count();
  await c.page.keyboard.down('Shift'); await slot.click(); await c.page.keyboard.up('Shift'); await c.page.waitForTimeout(500);
  const s1 = await stockNow();
  report.push(['airdrop shift-click diagnostics', { s0, s1, slotCount, banner: await banner(c.page) }]);
  assert.equal(await banner(c.page), 'partial', JSON.stringify({ s0, s1, slotCount }));
  await shot(c.page, 'airdrop-6-partial-day');
  await c.page.waitForTimeout(1200);
  const saved = await c.page.evaluate(() => localStorage.getItem('soh.state.v3'));
  const left = await c.page.evaluate(() => { const a = Object.values(window.__soh.run.entities).find(x => x.kind === 'airdrop'); return a ? window.__soh.run.custody[a.c].slots.filter(Boolean).length : -1; });
  await c.ctx.close();
  const back = await open(saved, t.unlockAt + 5000);
  const phaseBack = await banner(back.page); const leftBack = await back.page.evaluate(() => { const a = Object.values(window.__soh.run.entities).find(x => x.kind === 'airdrop'); return a ? window.__soh.run.custody[a.c].slots.filter(Boolean).length : -1; });
  report.push(['airdrop partial after reload', phaseBack, `stacks ${left}->${leftBack}`]);
  assert.equal(phaseBack, 'partial'); assert.equal(leftBack, left);
  await back.ctx.close();
  // A5 night locked (real darkness from the run's own day clock).
  c = await open(night.snap, night.t.landAt + 30000); await c.page.waitForTimeout(500);
  await c.page.evaluate(([x, y]) => { window.__soh.run.player.x = x - 10; window.__soh.run.player.y = y; window.__soh.run.player.aim = 0; }, [night.e.x, night.e.y]); await c.page.waitForTimeout(500);
  report.push(['airdrop night phase', await banner(c.page), `darkness ${night.dark.toFixed(2)}`]);
  await shot(c.page, 'airdrop-7-locked-night'); await c.ctx.close();

  // SYS15 heat: burning at the start; then the same save with real wall clock elapsed past the paid burn.
  c = await open(fire.snap, T0 + 1000); await c.page.waitForTimeout(500);
  const card = c.page.locator('[data-testid="thermal-status"]');
  const cardTxt = await card.innerText().catch(() => '');
  report.push(['heat card burning', cardTxt.includes('burning')]);
  assert.ok(cardTxt.includes('burning'), 'card shows the burning campfire: ' + cardTxt);
  await shot(c.page, 'heat-1-burning-day'); await c.ctx.close();
  c = await open(fire.snap, T0 + paidMs + 10 * 60000); await c.page.waitForTimeout(700);
  const cardOut = await c.page.locator('[data-testid="thermal-status"]').innerText().catch(() => '');
  report.push(['heat card after paid fuel ends (offline settle on Continue)', cardOut.includes('out of fuel')]);
  assert.ok(cardOut.includes('out of fuel'), 'card shows burned out: ' + cardOut);
  await shot(c.page, 'heat-2-out-of-fuel'); await c.ctx.close();

  // B02 IR sensor: real E toggles OFF -> ON; the status names the missing cable.
  c = await open(sensor.snap, T0 + 1000); await c.page.waitForTimeout(500);
  await c.page.keyboard.press('e'); await c.page.waitForTimeout(400);
  const sensorLabel = await c.page.getByText(/Infrared sensor ON:/).first().innerText().catch(() => '');
  report.push(['sensor after E', sensorLabel]);
  await shot(c.page, 'sensor-1-on-no-cable');
  assert.ok(/Infrared sensor ON: No cable/.test(sensorLabel), 'sensor readout after E: ' + sensorLabel);
  await c.ctx.close();

  // B02 bear trap: real E arm (1 plate), then persist and reload in a new context.
  c = await open(trap.snap, T0 + 1000); await c.page.waitForTimeout(500);
  const plate0 = await invCount(c.page, 'iron_plate');
  await shot(c.page, 'trap-1-unarmed');
  await c.page.keyboard.press('e'); await c.page.waitForTimeout(400);
  const plate1 = await invCount(c.page, 'iron_plate');
  report.push(['trap arm: plates', plate0, plate1, await trapState(c.page)]);
  assert.equal(plate0 - plate1, 1); assert.equal((await trapState(c.page)).state, 'armed');
  await shot(c.page, 'trap-2-armed');
  await c.page.waitForTimeout(1200);
  const savedTrap = await c.page.evaluate(() => localStorage.getItem('soh.state.v3'));
  await c.ctx.close();
  c = await open(savedTrap, T0 + 1000); await c.page.waitForTimeout(400);
  const trapBack = await trapState(c.page); report.push(['trap armed after reload', trapBack]);
  assert.equal(trapBack.state, 'armed'); await c.ctx.close();
  // spent trap: real E re-arm costs one plate and returns to armed.
  c = await open(trapSpentSnap, T0 + 1000); await c.page.waitForTimeout(500);
  const sp0 = await invCount(c.page, 'iron_plate');
  await c.page.keyboard.press('e'); await c.page.waitForTimeout(400);
  const sp1 = await invCount(c.page, 'iron_plate');
  report.push(['trap rearm from spent: plates', sp0, sp1, await trapState(c.page)]);
  assert.equal(sp0 - sp1, 1); assert.equal((await trapState(c.page)).state, 'armed');
  await shot(c.page, 'trap-3-rearmed-from-spent'); await c.ctx.close();

  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report, null, 1));
  console.log('PASS b04-p3 browser scenes at 640x360');
} finally {
  await browser.close(); await vite.close();
}
