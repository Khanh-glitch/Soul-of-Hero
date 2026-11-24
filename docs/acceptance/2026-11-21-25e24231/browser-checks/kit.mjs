// Shared boot for the acceptance browser scripts: stepped clock (nothing moves unless step() is called), common readers.
import fs from 'node:fs'; import { open } from './lib.mjs';
export async function boot(out, { url = 'http://127.0.0.1:4174/', clock = null } = {}) {
  const o = await open(out); const { p, log, shot, btn, close } = o;
  const R = {}; const note = (k, v) => { R[k] = v; console.log('## ' + k, (JSON.stringify(v) ?? 'undefined').slice(0, 1800)); };
  await p.addInitScript(([clock]) => {
    if (clock && !sessionStorage.getItem('acc-clock')) sessionStorage.setItem('acc-clock', String(clock));
    let at = Number(sessionStorage.getItem('acc-clock') || Date.now()), anim = 0, seq = 0; const next = new Map();
    Date.now = () => at; Object.defineProperty(performance, 'now', { value: () => anim });
    window.requestAnimationFrame = cb => { next.set(++seq, cb); return seq; }; window.cancelAnimationFrame = id => next.delete(id);
    window.stepFrames = (n, ms) => { for (let i = 0; i < n; i++) { at += ms; anim += ms; const jobs = [...next]; next.clear(); for (const [, cb] of jobs) cb(anim); } sessionStorage.setItem('acc-clock', String(at)); return at; };
    window.jumpClock = ms => { at += ms; sessionStorage.setItem('acc-clock', String(at)); return at; };
    window.st = () => { const r = window.readRun()?.run; if (!r) return null; const P = r.player;
      return { x: P.x, y: P.y, hp: P.hp, dead: P.dead, active: P.active, hour: (r.clock.lastSimAt - r.startedAt) / 3600000,
        inv: r.custody.inv.slots.map((s, i) => s ? `${i + 1}:${s.key}x${s.qty}${s.dur !== undefined ? '/d' + s.dur : ''}` : null).filter(Boolean),
        last: r.receipts.slice(-8).map(x => x.kind + ' ' + String(x.detail).slice(0, 70)), view: window.__sohView?.() }; };
    window.toasts = () => document.body.innerText.replace(/\n+/g, ' | ');
  }, [clock]);
  const step = (n, ms = 50) => p.evaluate(([n, ms]) => window.stepFrames(n, ms), [n, ms]);
  const st = () => p.evaluate(() => window.st());
  let held = new Set(); const keys = async want => { want = new Set(want); for (const k of held) if (!want.has(k)) await p.keyboard.up(k); for (const k of want) if (!held.has(k)) await p.keyboard.down(k); held = want; };
  const swing = async n => { for (let i = 0; i < n; i++) { await p.mouse.down(); await step(2); await p.mouse.up(); await step(9); } };
  const newGame = async () => { await p.goto(url); await step(20); await btn('New run').click(); await step(5); await btn('Begin the 14 days').click();
    await p.waitForFunction(() => !!window.readRun(), {}, { polling: 200, timeout: 120000 }); await step(40); for (let i = 0; i < 6; i++) { await p.keyboard.press('Escape'); await step(4); } };
  // screen position of a world point
  const aimAt = async t => { const c = await st(); const v = c.view; const sc = v?.scale ?? 1; const sx = (t.x - (v?.cam?.x ?? c.x - 320)) * sc + (v?.off?.x ?? 0), sy = (t.y - (v?.cam?.y ?? c.y - 180)) * sc + (v?.off?.y ?? 0); await p.mouse.move(Math.max(5, Math.min(635, sx)), Math.max(5, Math.min(355, sy))); return [Math.round(sx), Math.round(sy)]; };
  const finish = async (ok) => { note('errors', { errors: log.errors, failed: log.failed, bad: log.badStatus }); if (ok !== undefined) note('verdict', ok ? 'PASS' : 'FAIL'); fs.writeFileSync(out + '/result.json', JSON.stringify(R, null, 1)); await close(); if (ok !== undefined) process.exit(ok ? 0 : 1); };
  return { p, log, shot, btn, R, note, step, st, keys, swing, newGame, aimAt, finish, url };
}
