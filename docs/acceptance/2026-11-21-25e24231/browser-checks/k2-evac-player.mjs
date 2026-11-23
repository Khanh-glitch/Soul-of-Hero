// The player's own evacuation, through the real berth panel, production build (port 4174).
// CONTROLLED TIME + STAGED TRAVEL: the game is given the hour-288 save of endurance run 13 (the player in it has fallen;
// they rise through the game's own "Rise" button). The player is then CARRIED to the west berth by writing their
// position near the window edge again and again, so the game's own code slides the world window; no walking.
// From the berth on, everything is the game: E on the beacon, "Request a Seat", "Board the Vessel", then the clock is
// moved forward and the game reopened, the way a player would come back later.
import fs from 'node:fs'; import { boot } from './kit.mjs';
const T0 = 1794729600000; const save = fs.readFileSync('/home/user/acc/h288-run13.save.txt', 'utf8'); const BERTH = process.env.BERTH ?? 'evac:po_evac_west';
const k = await boot('/home/user/acc/shots/k2', { clock: T0 + 288 * 3600000 + 60000 }); const { p, shot, note, step, st, aimAt } = k;
await p.addInitScript(() => {
  window.evac = () => { const r = window.readRun()?.run; if (!r) return null; const hw = r.humanWorld;
    return { hour: +((r.clock.lastSimAt - r.startedAt) / 3600000).toFixed(3), ended: r.ended ?? null, player: { dead: r.player.dead, hp: Math.round(r.player.hp), hunger: Math.round(r.player.hunger), thirst: Math.round(r.player.thirst) },
      trips: Object.values(hw.evacuation).map(t => ({ id: t.tripId, phase: t.phase, boarded: t.boarded, playerAboard: !!t.playerAboard, departAtH: t.departAt ? +((t.departAt - r.startedAt) / 3600000).toFixed(2) : null, arriveAtH: t.arriveAt ? +((t.arriveAt - r.startedAt) / 3600000).toFixed(2) : null })),
      evacuated: Object.values(hw.people).filter(h => h.state === 'EVACUATED').map(h => h.actorId), playerEvacArrivedAt: hw.playerEvacArrivedAt ?? null,
      receipts: r.receipts.filter(x => /^player\.(board|evac)|^evac\.(depart|arrive)|^run\./.test(x.kind)).map(x => x.kind + ' ' + String(x.detail).slice(0, 70)) }; };
  window.carry = id => { const r = window.readRun().run, t = r.humanWorld.evacuation[id], o = r.sourceMap.veyra.originAu, ox = Math.round(o[0] / .5), oy = Math.round(o[1] / .5), lx = t.siteGx - ox, ly = t.siteGy - oy, P = r.player; let done = true;
    if (lx < 40) { P.x = 10 * 16 + 8; done = false; } else if (lx >= 160) { P.x = 190 * 16 + 8; done = false; } if (ly < 40) { P.y = 10 * 16 + 8; done = false; } else if (ly >= 160) { P.y = 190 * 16 + 8; done = false; } P.vx = 0; P.vy = 0;
    return { ox, oy, lx, ly, done }; };
});
const evac = () => p.evaluate(() => window.evac()); const text = () => p.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
const cont = async (wantHour) => { await p.reload(); await step(20); const c = p.getByRole('button', { name: /Continue/ }).first(); for (let i = 0; i < 60 && !(await c.count()); i++) { await p.waitForTimeout(1000); await step(5); } if (!(await c.count())) return { offered: false, title: (await text()).slice(0, 300) }; const t0 = Date.now(); await c.click(); let e = null;
  for (let i = 0; i < 400; i++) { await p.waitForTimeout(1500); await step(3); e = await evac(); if (e && (e.hour >= wantHour - 0.1 || e.ended)) break; if (!e && i > 5 && !/While you were away/.test(await text())) { await p.waitForTimeout(1500); await step(3); e = await evac(); if (!e) break; } }
  return { offered: true, wallSeconds: Math.round((Date.now() - t0) / 1000), evac: e }; };
await p.goto(k.url); await step(10); await p.evaluate(s => localStorage.setItem('soh.state.v3', s), save);
note('continue1', await cont(288)); await shot('01-after-continue'); note('screen1', (await text()).slice(0, 400));
const enter = p.getByRole('button', { name: 'Enter the Island' }); if (await enter.count()) { await enter.click({ force: true }); await step(8); }
const rise = p.getByRole('button', { name: /Rise/ }); note('riseCount', await rise.count()); await step(120); if (await rise.count()) { await rise.click({ timeout: 5000 }).catch(e => note('riseErr', String(e).slice(0, 200))); await step(80); }
for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await step(4); }
note('afterRise', await evac()); await shot('02-risen');
// carried to the berth
const hops = []; for (let i = 0; i < 90; i++) { const c = await p.evaluate(id => window.carry(id), BERTH); hops.push([c.ox, c.oy]); if (c.done) { note('window', c); break; } await step(3); }
note('hops', { count: hops.length, first: hops[0], last: hops[hops.length - 1] });
const site = await p.evaluate(id => { const r = window.readRun().run, t = r.humanWorld.evacuation[id], o = r.sourceMap.veyra.originAu, ox = Math.round(o[0] / .5), oy = Math.round(o[1] / .5);
  const beacons = Object.values(r.entities).filter(e => e.kind === 'evac').map(e => ({ id: e.id, tx: e.tx, ty: e.ty, x: e.x, y: e.y })); return { dock: { x: (t.siteGx - ox + .5) * 16, y: (t.siteGy - oy + .5) * 16 }, beacons }; }, BERTH);
note('site', site);
let boarded = false; const tries = [];
for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [0, -2], [2, 0], [-2, 0], [0, 0]]) {
  await p.evaluate(([x, y]) => { const P = window.readRun().run.player; P.x = x; P.y = y; P.vx = 0; P.vy = 0; }, [site.dock.x + dx * 16, site.dock.y + dy * 16]); await step(6);
  const b = site.beacons[0]; const bx = b ? (b.x ?? (b.tx + .5) * 16) : site.dock.x, by = b ? (b.y ?? (b.ty + .5) * 16) : site.dock.y; await aimAt({ x: bx, y: by }); await step(3);
  const target = (await st()).view?.target; await p.keyboard.press('e'); await step(6);
  const req = p.getByRole('button', { name: /Request a Seat/ }); const row = { off: [dx, dy], target: target?.label ?? null, panel: await req.count() };
  if (row.panel) { if (!tries.some(t => t.panelText)) { row.panelText = (await text()).match(/Evacuation Service.*/)?.[0].slice(0, 600); await shot('03-panel'); }
    if (await req.isEnabled()) { await req.click(); await step(3); await p.getByRole('button', { name: 'Board the Vessel' }).click(); await step(6); }
    const e = await evac(); row.aboard = e.trips.find(t => t.id === BERTH).playerAboard; row.msg = (await text()).match(/Reach the berth[^|]*|No free seat[^|]*|already aboard[^|]*/)?.[0] ?? null;
    if (row.aboard) { boarded = true; tries.push(row); await shot('04-aboard'); note('aboardPanel', (await text()).slice(-700)); break; } await p.keyboard.press('Escape'); await step(4); }
  tries.push(row); }
note('tries', tries); note('afterBoard', await evac());
if (!boarded) { await shot('04-not-aboard'); await k.finish(false); }
await p.keyboard.press('Escape'); await step(4);
// the game saves; then come back 2.5 hours later, and again 4.5 hours after that
const waitSave = async () => { await p.keyboard.press('i'); let v = null; for (let i = 0; i < 80; i++) { await step(10, 100); await p.waitForTimeout(250); v = await p.evaluate(() => ({ last: window.__sohView().lastSave, live: window.readRun()?.revision })); if (v.last?.ok && v.last.revision === v.live) break; } await p.keyboard.press('Escape'); await step(3); return v; };
note('save1', await waitSave());
await p.evaluate(() => window.jumpClock(2.5 * 3600000)); const c2 = await cont(290.5); note('back+2.5h', c2); await shot('05-back-2h5'); note('screen2', (await text()).slice(0, 900));
if (c2.evac && !c2.evac.ended) { for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await step(4); } note('save2', await waitSave()); await p.evaluate(() => window.jumpClock(4.5 * 3600000)); const c3 = await cont(295); note('back+7h', c3); await shot('06-back-7h'); note('screen3', (await text()).slice(0, 1200)); }
await k.finish(k.log.errors.length === 0);
