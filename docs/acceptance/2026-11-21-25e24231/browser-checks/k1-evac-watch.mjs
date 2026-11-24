// Evacuation seen from the production build in a real browser (port 4174), player not taking part.
// CONTROLLED TIME: the game is given the hour-288 save of endurance run 13 (written by the same code in Node; the
// player in it died early of hunger) and a clock AHEAD_H hours later. "Continue" then settles those hours the way the
// game does when a player comes back after being away. Nothing in the save is edited.
import fs from 'node:fs'; import { boot } from './kit.mjs';
const AHEAD_H = Number(process.env.AHEAD_H ?? 7), FROM = Number(process.env.FROM ?? 288); const T0 = 1794729600000;
const save = fs.readFileSync(`/home/user/acc/h${FROM}-run13.save.txt`, 'utf8');
const k = await boot('/home/user/acc/shots/k1-' + FROM + '-' + AHEAD_H, { clock: T0 + (FROM + AHEAD_H) * 3600000 }); const { p, shot, note, step } = k;
await p.addInitScript(() => { window.evac = () => { const r = window.readRun()?.run; if (!r) return null; const hw = r.humanWorld; const c = {}; for (const h of Object.values(hw.people)) c[h.state] = (c[h.state] || 0) + 1;
  return { hour: +((r.clock.lastSimAt - r.startedAt) / 3600000).toFixed(3), playerDead: r.player.dead, states: c,
    trips: Object.values(hw.evacuation).map(t => ({ id: t.tripId, phase: t.phase, round: t.round, boarded: t.boarded, departAtH: t.departAt ? +((t.departAt - r.startedAt) / 3600000).toFixed(2) : null, arriveAtH: t.arriveAt ? +((t.arriveAt - r.startedAt) / 3600000).toFixed(2) : null })),
    evacuated: Object.values(hw.people).filter(h => h.state === 'EVACUATED').map(h => h.actorId),
    receipts: r.receipts.filter(x => /^evac\.|human\.board|human\.evac\.(arrive|release)/.test(x.kind)).map(x => x.kind + ' ' + String(x.detail).slice(0, 60)) }; }; });
await p.goto(k.url); await step(10);
note('inject', await p.evaluate(s => { localStorage.setItem('soh.state.v3', s); return { ok: localStorage.getItem('soh.state.v3') === s, chars: s.length }; }, save));
await p.reload(); await step(20); const cont = p.getByRole('button', { name: /Continue/ }).first(); note('continueOffered', await cont.count()); await shot('00-title');
const t0 = Date.now(); await cont.click(); let e = null, entered = false;
for (let i = 0; i < 400; i++) { await p.waitForTimeout(2000); await step(3); e = await p.evaluate(() => window.evac()); if (i % 20 === 0) console.log('t+', Math.round((Date.now() - t0) / 1000), e ? e.hour : (await p.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 160)))); if (e && Math.abs(e.hour - (FROM + AHEAD_H)) < 0.2) { entered = true; break; } }
note('settled', { entered, wallSeconds: Math.round((Date.now() - t0) / 1000) }); note('evac', e); await shot('01-after-continue');
note('screenText', (await p.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '))).slice(0, 700));
await p.keyboard.press('Escape'); await step(10); await shot('02-ingame');
await k.finish(entered && k.log.errors.length === 0);
