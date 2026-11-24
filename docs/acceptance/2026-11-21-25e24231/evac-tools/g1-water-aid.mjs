// Water as first aid, through the real panel, on the production build (port 4174).
// STAGED through the page's game state: one resident is put beside the player, with thirst 0 and down the way the
// game downs a starving resident (state, time, one unbleeding wound, health 1). Everything after that is the game's
// own UI: "Nearby survivors" list -> Help -> "Offer Water Flask" -> six seconds -> the resident stands up.
import fs from 'node:fs'; import { open } from './lib.mjs';
const out = '/home/user/acc/shots/g1'; const url = 'http://127.0.0.1:4174/';
const { p, log, shot, btn, close } = await open(out);
const R = {}; const note = (k, v) => { R[k] = v; console.log('## ' + k, JSON.stringify(v).slice(0, 1200)); };
await p.addInitScript(() => { let at = Date.now(), anim = 0, seq = 0; const next = new Map();
  Date.now = () => at; Object.defineProperty(performance, 'now', { value: () => anim });
  window.requestAnimationFrame = cb => { next.set(++seq, cb); return seq; }; window.cancelAnimationFrame = id => next.delete(id);
  window.stepFrames = (n, ms) => { for (let i = 0; i < n; i++) { at += ms; anim += ms; const jobs = [...next]; next.clear(); for (const [, cb] of jobs) cb(anim); } return at; };
  window.pat = id => { const r = window.readRun().run, h = r.humanWorld.people[id], f = r.custody.inv.slots.find(s => s?.key === 'water_flask');
    return { state: h.state, thirst: h.thirst, hp: h.hp, trust: h.trust, wounds: h.wounds.map(w => ({ treated: w.treated, bleeding: w.bleeding })), flaskCharge: f?.charge, aid: r.humanWorld.playerAid ? { kind: r.humanWorld.playerAid.kind, ms: r.humanWorld.playerAid.dueAt - r.humanWorld.playerAid.startedAt } : null,
      receipts: r.receipts.filter(x => x.kind.startsWith('human.aid')).map(x => x.kind + ' ' + x.detail) }; };
});
const step = (n, ms = 50) => p.evaluate(([n, ms]) => window.stepFrames(n, ms), [n, ms]);
await p.goto(url); await step(20); await btn('New run').click(); await step(5); await btn('Begin the 14 days').click();
await p.waitForFunction(() => !!window.readRun(), {}, { polling: 200, timeout: 120000 }); await step(40);
for (let i = 0; i < 6; i++) { await p.keyboard.press('Escape'); await step(4); }                    // close the opening tips
const staged = await p.evaluate(() => { const r = window.readRun().run, hw = r.humanWorld, P = r.player, now = Date.now();
  const o = r.sourceMap.veyra.originAu, ox = Math.round(o[0] / .5), oy = Math.round(o[1] / .5), floor = r.veyraFloor ?? 0;
  const h = Object.values(hw.people).filter(q => q.state !== 'DEAD' && q.floor === floor).sort((a, b) => Math.hypot(a.gx - ox - P.x / 16, a.gy - oy - P.y / 16) - Math.hypot(b.gx - ox - P.x / 16, b.gy - oy - P.y / 16))[0];
  const was = { gx: h.gx, gy: h.gy, thirst: h.thirst, state: h.state };
  h.gx = ox + Math.floor(P.x / 16) + 1; h.gy = oy + Math.floor(P.y / 16); h.motion = undefined; h.intent = undefined;
  h.thirst = 0; h.hp = 1; h.state = 'DOWNED'; h.downedAt = now; h.nextMedicalReviewAt = now; h.wounds = [{ severity: 0.7, bleeding: false, bleedingUntil: now + 20 * 60000, treated: false }];
  return { id: h.actorId, name: h.name, occupation: h.occupation, was, inv: r.custody.inv.slots.filter(Boolean).map(s => s.key + (s.charge != null ? ':' + s.charge : 'x' + s.qty)) }; });
note('staged', staged); await step(6); await shot('01-downed'); note('before', await p.evaluate(id => window.pat(id), staged.id));
const list = p.getByLabel('Nearby survivors'); note('listCount', await list.count());
note('listOptions', await list.locator('option').allTextContents());
await list.selectOption(staged.id); await step(6); await shot('02-panel');
const panel = p.getByTestId('human-panel'); note('panelText', (await panel.innerText()).replace(/\n+/g, ' | ').slice(0, 500));
note('panelButtons', await panel.getByRole('button').allTextContents());
const offer = panel.getByRole('button', { name: 'Offer Water Flask' }); note('offerCount', await offer.count());
await offer.click(); await step(2); await shot('03-giving'); note('afterClick', { text: (await panel.innerText()).replace(/\n+/g, ' | ').slice(0, 400), pat: await p.evaluate(id => window.pat(id), staged.id) });
await step(100, 50); note('at5s', await p.evaluate(id => window.pat(id), staged.id));              // 5.1 s: still down
await step(30, 50); await shot('04-revived'); const end = await p.evaluate(id => window.pat(id), staged.id); note('at6.6s', end);
note('panelAfter', (await p.getByTestId('human-panel').innerText().catch(() => 'closed')).replace(/\n+/g, ' | ').slice(0, 400));
note('errors', { errors: log.errors, failed: log.failed, bad: log.badStatus });
const ok = end.state !== 'DOWNED' && end.thirst > 29 && end.thirst <= 30 && end.flaskCharge === 1 && end.trust === 55 && end.receipts.some(x => x.startsWith('human.aid.commit')) && log.errors.length === 0;
note('verdict', ok ? 'PASS' : 'FAIL'); fs.writeFileSync(out + '/result.json', JSON.stringify(R, null, 1)); await close(); process.exit(ok ? 0 : 1);
