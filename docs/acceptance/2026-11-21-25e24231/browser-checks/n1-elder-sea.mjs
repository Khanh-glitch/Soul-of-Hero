// An Elder crossing the sea during Ragnarok, looked at on screen, production build (port 4174).
// CONTROLLED TIME + STAGED TRAVEL: hour-312 save of endurance run 13, clock AHEAD_H hours later, "Continue", "Rise";
// then the player is carried (window slides done by the game's own code) to where the game says that Elder is.
import fs from 'node:fs'; import { boot } from './kit.mjs';
const T0 = 1794729600000, AHEAD_H = Number(process.env.AHEAD_H ?? 6.5); const FROM = process.env.FROM_SAVE; const save = fs.readFileSync(FROM ?? '/home/user/acc/h312-run13.save.txt', 'utf8');
const k = await boot('/home/user/acc/shots/n1-' + (process.env.ELDER ?? 'auto') + '-' + AHEAD_H, { clock: FROM ? Number(fs.readFileSync(FROM + '.clock', 'utf8')) + 5000 : T0 + (312 + AHEAD_H) * 3600000 }); const { p, shot, note, step } = k;
await p.addInitScript(() => {
  window.elders = () => { const r = window.readRun()?.run; if (!r) return null; const o = r.sourceMap.veyra.originAu, ox = Math.round(o[0] / .5), oy = Math.round(o[1] / .5);
    return { hour: +((r.clock.lastSimAt - r.startedAt) / 3600000).toFixed(2), origin: [ox, oy], player: { dead: r.player.dead, hp: Math.round(r.player.hp), g: [ox + Math.floor(r.player.x / 16), oy + Math.floor(r.player.y / 16)] },
      pressure: Object.values(r.humanWorld.elderPressure).map(e => ({ id: e.elderId, alive: e.alive, g: [e.gx, e.gy], lair: [e.lairGx, e.lairGy], rest: Object.fromEntries(Object.entries(e).filter(([k, v]) => !['events', 'routeTargets', 'elderId', 'alive', 'gx', 'gy', 'lairGx', 'lairGy'].includes(k) && typeof v !== 'object')), lastEvent: (e.events ?? []).slice(-1).map(v => ({ state: v.state, targetPoi: v.targetPoi, why: String(v.blockReason ?? '').slice(0, 90) }))[0] })),
      onScreen: r.creatures.filter(c => c.elder).map(c => ({ type: c.type, x: Math.round(c.x), y: Math.round(c.y), hp: Math.round(c.hp), state: c.state, submerged: c.elder.submerged ?? null, elder: Object.fromEntries(Object.entries(c.elder).filter(([, v]) => typeof v !== 'object').slice(0, 12)) })),
      seaReceipts: r.receipts.filter(x => /^elder\.march/.test(x.kind)).slice(-8).map(x => x.kind + ' ' + String(x.detail).slice(0, 110)) }; };
  window.carryTo = (gx, gy) => { const r = window.readRun().run, o = r.sourceMap.veyra.originAu, ox = Math.round(o[0] / .5), oy = Math.round(o[1] / .5), lx = gx - ox, ly = gy - oy, P = r.player; let done = true;
    if (lx < 40) { P.x = 10 * 16 + 8; done = false; } else if (lx >= 160) { P.x = 190 * 16 + 8; done = false; } if (ly < 40) { P.y = 10 * 16 + 8; done = false; } else if (ly >= 160) { P.y = 190 * 16 + 8; done = false; } P.vx = 0; P.vy = 0; return { lx, ly, done }; };
});
const text = () => p.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
await p.goto(k.url); await step(10); await p.evaluate(s => localStorage.setItem('soh.state.v3', s), save);
await p.reload(); await step(20); const c = p.getByRole('button', { name: /Continue/ }).first(); for (let i = 0; i < 60 && !(await c.count()); i++) { await p.waitForTimeout(1000); await step(5); }
const t0 = Date.now(); await c.click(); let e = null; for (let i = 0; i < 500; i++) { await p.waitForTimeout(1500); await step(3); e = await p.evaluate(() => window.elders()); if (e && (FROM || e.hour >= 312 + AHEAD_H - 0.1)) break; }
note('settled', { wallSeconds: Math.round((Date.now() - t0) / 1000), hour: e?.hour }); note('elders', e);
const rise = p.getByRole('button', { name: /Rise/ }); let rose = null; const seenButtons = [];
for (let i = 0; i < 10; i++) { await step(60); const names = await p.$$eval('button', b => b.map(x => x.textContent.trim().slice(0, 24) + (x.disabled ? '(off)' : '')).filter(Boolean)); if (i < 2) seenButtons.push(names.slice(0, 14)); { const b2 = p.getByRole('button', { name: 'Enter the Island', exact: true }); if (await b2.count()) { await b2.first().click({ force: true }).catch(() => {}); await step(8); } }
  if (await rise.count() && await rise.isEnabled()) { await rise.click({ force: true, timeout: 5000 }).catch(err => { rose = String(err).slice(0, 120); }); await step(80); } if (!(await p.evaluate(() => window.readRun().run.player.dead))) { rose = 'risen after ' + (i + 1) + ' tries'; break; } }
note('buttonsSeen', seenButtons); note('rise', rose); for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await step(4); }
if (process.env.DUMP) { await p.keyboard.press('i'); for (let i = 0; i < 80; i++) { await step(10, 100); await p.waitForTimeout(250); const v = await p.evaluate(() => ({ last: window.__sohView().lastSave, live: window.readRun()?.revision })); if (v.last?.ok && v.last.revision === v.live) break; } await p.keyboard.press('Escape'); await step(3); fs.writeFileSync(process.env.DUMP, await p.evaluate(() => localStorage.getItem('soh.state.v3'))); fs.writeFileSync(process.env.DUMP + '.clock', String(await p.evaluate(() => Date.now()))); }
const want = process.env.ELDER; const sea = e.seaReceipts.filter(x => x.startsWith('elder.march.sea')).map(x => x.split(' ')[1].split(':')[0]);
const pickId = want ?? sea[sea.length - 1] ?? e.pressure.find(x => x.g[0] !== x.lair[0] || x.g[1] !== x.lair[1])?.id; const el = e.pressure.find(x => x.id === pickId || pickId?.includes(x.id)); note('picked', { pickId, el });
if (!el) await k.finish(false);
let carryErr = null; for (let i = 0; i < 90; i++) { const cur = await p.evaluate(() => window.elders()); const me = cur.pressure.find(x => x.id === el.id); const r = await p.evaluate(([x, y]) => window.carryTo(x, y), me.g); if (r.done) break; try { await step(3); } catch (err) { carryErr = String(err).slice(0, 160); break; } }
if (carryErr) { note('carryStopped', { why: carryErr, at: (await p.evaluate(() => window.elders()))?.origin }); await k.finish(false); }
// stand a few tiles to the side of it
const at = await p.evaluate(id => { const r = window.readRun().run, me = r.humanWorld.elderPressure[id], o = r.sourceMap.veyra.originAu, ox = Math.round(o[0] / .5), oy = Math.round(o[1] / .5); const P = r.player; P.x = (me.gx - ox - 7 + .5) * 16; P.y = (me.gy - oy + .5) * 16; P.vx = 0; P.vy = 0;
  const t = r.terrain?.[(me.gy - oy) * 200 + (me.gx - ox)]; return { local: [me.gx - ox, me.gy - oy], terrainUnderElder: t ?? null }; }, el.id);
const window0 = { x: 0, y: 0 }; note('at', at); await step(4); await shot('01-beside-elder'); const tl = []; for (let i = 0; i < 12; i++) { await step(10); const v = await p.evaluate(() => window.elders()); tl.push([(i + 1) * 0.5, v.player.hp, v.player.dead, v.onScreen[0]?.state ?? null, v.onScreen[0] ? Math.round(Math.hypot(v.onScreen[0].x - window0.x, v.onScreen[0].y - window0.y)) : null]); if (i === 3) await shot('01b-two-seconds'); } note('sixSeconds [s, playerHp, dead, elderState]', tl.map(r => r.slice(0, 4))); let s = await p.evaluate(() => window.elders()); note('view1', { player: s.player, onScreen: s.onScreen, target: (await p.evaluate(() => window.__sohView().target)) });
await step(40); await shot('02-two-seconds-later'); s = await p.evaluate(() => window.elders()); note('view2', { player: s.player, onScreen: s.onScreen, pressure: s.pressure.find(x => x.id === el.id) });
note('hud', (await text()).slice(0, 300));
await k.finish(k.log.errors.length === 0);
