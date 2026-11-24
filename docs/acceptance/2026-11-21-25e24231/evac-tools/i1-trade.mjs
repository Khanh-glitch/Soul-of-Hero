// Barter with a resident through the real panel, production build (port 4174).
// STAGED: the nearest living resident is moved beside the player. Nothing else is changed.
import fs from 'node:fs'; import { open } from './lib.mjs';
const out = '/home/user/acc/shots/i1'; const url = 'http://127.0.0.1:4174/';
const { p, log, shot, btn, close } = await open(out);
const R = {}; const note = (k, v) => { R[k] = v; console.log('## ' + k, JSON.stringify(v).slice(0, 1500)); };
await p.addInitScript(() => { let at = Date.now(), anim = 0, seq = 0; const next = new Map();
  Date.now = () => at; Object.defineProperty(performance, 'now', { value: () => anim });
  window.requestAnimationFrame = cb => { next.set(++seq, cb); return seq; }; window.cancelAnimationFrame = id => next.delete(id);
  window.stepFrames = (n, ms) => { for (let i = 0; i < n; i++) { at += ms; anim += ms; const jobs = [...next]; next.clear(); for (const [, cb] of jobs) cb(anim); } return at; };
  window.snap = id => { const r = window.readRun().run, h = r.humanWorld.people[id]; const pk = s => s.filter(Boolean).map(x => x.key + 'x' + x.qty);
    return { player: pk(r.custody.inv.slots), state: h.state, trust: h.trust, receipts: r.receipts.filter(x => /barter|trade/.test(x.kind)).map(x => x.kind + ' ' + String(x.detail).slice(0, 90)) }; };
});
const step = (n, ms = 50) => p.evaluate(([n, ms]) => window.stepFrames(n, ms), [n, ms]);
await p.goto(url); await step(20); await btn('New run').click(); await step(5); await btn('Begin the 14 days').click();
await p.waitForFunction(() => !!window.readRun(), {}, { polling: 200, timeout: 120000 }); await step(40);
for (let i = 0; i < 6; i++) { await p.keyboard.press('Escape'); await step(4); }
const staged = await p.evaluate(() => { const r = window.readRun().run, hw = r.humanWorld, P = r.player;
  const o = r.sourceMap.veyra.originAu, ox = Math.round(o[0] / .5), oy = Math.round(o[1] / .5), floor = r.veyraFloor ?? 0;
  const h = Object.values(hw.people).filter(q => q.state !== 'DEAD' && q.state !== 'DOWNED' && q.floor === floor).sort((a, b) => Math.hypot(a.gx - ox - P.x / 16, a.gy - oy - P.y / 16) - Math.hypot(b.gx - ox - P.x / 16, b.gy - oy - P.y / 16))[0];
  h.gx = ox + Math.floor(P.x / 16) + 1; h.gy = oy + Math.floor(P.y / 16); h.motion = undefined; h.intent = undefined;
  return { id: h.actorId, name: h.name, state: h.state }; });
note('staged', staged); await step(6); note('before', await p.evaluate(id => window.snap(id), staged.id));
const list = p.getByLabel('Nearby survivors'); note('listOptions', await list.locator('option').allTextContents());
await list.selectOption(staged.id); await step(6);
const panel = p.getByTestId('human-panel');
await panel.getByLabel('Survivor action').selectOption('Barter'); await step(4); await shot('01-barter');
const text = async () => (await panel.innerText()).replace(/\n+/g, ' | ');
note('barterText', (await text()).slice(0, 900));
const adds = await panel.getByRole('button', { name: /add one/ }).evaluateAll(b => b.map(x => x.getAttribute('aria-label') + (x.disabled ? ' (disabled)' : '')));
note('addButtons', adds);
const theirs = adds.filter(a => a.startsWith('Their goods') && !a.endsWith('(disabled)')), mine = adds.filter(a => a.startsWith('Your offer') && !a.endsWith('(disabled)'));
let done = false; const tried = [];
if (theirs.length && mine.length) {
  await panel.getByRole('button', { name: theirs[0], exact: true }).click(); await step(3);
  outer: for (const m of mine) for (let k = 0; k < 6; k++) {
    const b = panel.getByRole('button', { name: m, exact: true }); if (await b.isDisabled()) break; await b.click(); await step(3);
    const rv = panel.getByRole('button', { name: 'Review exchange' }); const t = await text(); tried.push(m + ' -> ' + (t.match(/\| ([^|]*) \| Value:[^|]*/)?.[0] ?? t.slice(-160)));
    if (await rv.count() && !(await rv.isDisabled())) { await shot('02-ok'); await rv.click(); await step(3); await shot('03-review'); note('reviewText', (await text()).slice(-500));
      const acc = panel.getByRole('button', { name: 'Accept & exchange' }); note('acceptCount', await acc.count()); if (await acc.count()) { await acc.click(); await step(20); done = true; } break outer; }
  }
}
note('tried', tried); await shot('04-after');
const end = await p.evaluate(id => window.snap(id), staged.id); note('after', end); note('afterText', (await text().catch(() => 'closed')).slice(0, 600));
note('errors', { errors: log.errors, failed: log.failed, bad: log.badStatus });
const ok = done && JSON.stringify(end.player) !== JSON.stringify(R.before.player) && log.errors.length === 0;
note('verdict', ok ? 'PASS' : 'NOT COMPLETED'); fs.writeFileSync(out + '/result.json', JSON.stringify(R, null, 1)); await close(); process.exit(ok ? 0 : 1);
