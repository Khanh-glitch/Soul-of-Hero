import { start } from './lib.mjs'; import fs from 'fs';
const OUT = '/home/user/Soul-of-Hero/web/evidence/g1b/screens/'; const log = [];
const { b, p, errs } = await start();
await p.evaluate(async () => {
  const B = await import('/src/game/g1b.ts'); const E = G.E, CO = G.CO; const WW = 200, WH = 200, TILE = 16; const gs = () => window.__soh, g = () => window.__soh.run;
  const origin = () => { const o = g().sourceMap.veyra.originAu; return [Math.round(o[0] / 0.5), Math.round(o[1] / 0.5)]; };
  window.K = { B,
    origin,
    care() { const pl = g().player; pl.hp = 100; pl.hunger = 100; pl.thirst = 100; pl.warmth = 100; },
    bring(gx, gy) { for (let i = 0; i < 80; i++) { const [ox, oy] = origin(); const dx = gx - (ox + WW / 2), dy = gy - (oy + WH / 2); if (Math.abs(dx) <= 40 && Math.abs(dy) <= 40) return true; const sx = Math.max(-64, Math.min(64, Math.round(dx))), sy = Math.max(-64, Math.min(64, Math.round(dy))); const pl = g().player; pl.x = (WW / 2) * TILE + 8 + sx * TILE; pl.y = (WH / 2) * TILE + 8 + sy * TILE; if (!CO.shiftVeyraWindowBy(gs(), sx, sy, E.markDirty)) return false; } return false; },
    standBy(gx, gy, order) { if (!this.bring(gx, gy)) return null; const [ox, oy] = origin(); const grid = E.blockGrid(g()); for (const [dx, dy] of (order || [[0, 1], [1, 0], [-1, 0], [0, -1]])) { const lx = gx - ox + dx, ly = gy - oy + dy; if (grid[ly * WW + lx] === 0) { const pl = g().player; pl.x = lx * TILE + 8; pl.y = ly * TILE + 8; E.markDirty(); return { side: [dx, dy], local: [gx - ox, gy - oy] }; } } return null; },
    ent(sid) { const e = Object.values(g().entities).find(v => v.g1b?.sid === sid); if (!e) return null; const c = g().custody[e.c]; return { eid: e.id, state: e.g1b.state, cycle: e.g1b.cycle, roll: e.g1b.roll, refillAt: e.g1b.refillAt, poweredUntil: e.g1b.poweredUntil, stock: c.slots.filter(Boolean).map(s => `${s.key}x${s.qty}${s.lvl ? ' Lv' + s.lvl : ''}`) }; },
    pickSites() { const out = {}; for (const s of B.G1B_SOURCE_SITES) { if (B.g1bGateOf?.(s.id)) continue; (out[s.variant] ||= []).push(s); } return out; },
    gates: B.G1B_GATES, fixtures: B.G1B_FIXTURES, chests: Object.fromEntries(Object.entries(B.G1B_CHESTS).map(([k, v]) => [k, { family: v.family, grade: v.grade }])),
    gated: Object.fromEntries(B.G1B_SOURCE_SITES.map(s => [s.id, s.gate || null])),
    give(key, n) { return E.addItem(g(), 'inv', key, n); },
    inv() { return g().custody.inv.slots.map(s => s ? `${s.key}x${s.qty}${s.lvl ? ' Lv' + s.lvl : ''}${s.dur !== undefined ? ' dur' + s.dur : ''}${s.charge !== undefined ? ' ch' + s.charge : ''}` : null); },
    hour() { const r = g(); return r.clock; },
    last() { return g().receipts.slice(-6).map(x => x.kind + ' ' + (x.detail || '')); },
  };
});
const ev = (f, a) => p.evaluate(f, a);
const shot = async (name, note) => { await p.waitForTimeout(500); await p.screenshot({ path: OUT + name + '.png' }); log.push({ shot: name + '.png', ...note }); console.log(name, JSON.stringify(note).slice(0, 300)); };
const aimAt = async (lx, ly) => { const s = await ev(([x, y]) => G.screen(x, y), [lx, ly]); await p.mouse.move(Math.round(s.x), Math.round(s.y)); return s; };
log.push({ info: await ev(() => G.info()), chests: await ev(() => K.chests), errsAtStart: errs.slice() });
const sites = await ev(() => { const out = {}; for (const s of K.B.G1B_SOURCE_SITES) (out[s.variant] ||= []).push(s); return out; });
const gatedIds = new Set((await ev(() => K.B.G1B_GATES.flatMap(q => q.sources || q.chests || []))));
console.log('variants', Object.keys(sites).length, 'gated', gatedIds.size, JSON.stringify(await ev(() => K.gates[0])).slice(0, 300));
const OPEN = new Set(process.env.OPEN ? process.env.OPEN.split(',') : ['supply_low', 'food_high', 'medical_mid', 'industrial_high', 'military_mid']);
for (const variant of Object.keys(sites).sort()) {
  const s = sites[variant].find(x => !gatedIds.has(x.id) && x.zone !== 'CARD_ROOM') || sites[variant][0];
  await ev(() => K.care());
  const st = await ev(([x, y]) => K.standBy(x, y), [s.gx, s.gy]); if (!st) { log.push({ variant, failed: 'standBy', sid: s.id }); console.log('FAILED standBy', s.id); continue; }
  await p.waitForTimeout(1400); await aimAt(st.local[0], st.local[1]); await p.waitForTimeout(500);
  const before = await ev(sid => K.ent(sid), s.id); const target = await ev(() => window.__sohView().target);
  await shot(`${variant}-1-closed`, { variant, sid: s.id, place: s.place, global: [s.gx, s.gy], playerSide: st.side, entity: before, prompt: target });
  if (!OPEN.has(variant)) continue;
  await p.keyboard.press('KeyF'); await p.waitForTimeout(900);
  const opened = await ev(sid => K.ent(sid), s.id);
  await shot(`${variant}-2-opened-ui`, { variant, sid: s.id, entity: opened, receipts: await ev(() => K.last()) });
  // take everything through the panel's own control if present, else move stacks through the move intent
  const btn = p.getByText(/Take all/i).first();
  if (await btn.count()) { await btn.click(); await p.waitForTimeout(700); }
  const after = await ev(sid => K.ent(sid), s.id);
  await shot(`${variant}-3-after-take-all-ui`, { variant, sid: s.id, entity: after, inv: await ev(() => K.inv()) });
  await p.keyboard.press('Escape'); await p.waitForTimeout(900); await aimAt(st.local[0], st.local[1]); await p.waitForTimeout(600);
  const fin = await ev(sid => K.ent(sid), s.id);
  await shot(`${variant}-4-world-after`, { variant, sid: s.id, entity: fin, prompt: await ev(() => window.__sohView().target) });
}
log.push({ pageErrors: errs });
fs.writeFileSync(OUT + 'chests-log.json', JSON.stringify(log, null, 1)); console.log('errs', errs.length, errs.slice(0, 3));
await b.close();
