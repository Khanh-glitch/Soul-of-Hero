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

const toast = async () => await ev(() => [...document.querySelectorAll('.toast, [class*="toast"]')].map(x => x.textContent).slice(-3));
const doorScene = async (tag, gate, note) => {
  const [dx, dy] = gate.door, [ix, iy] = gate.interior; await ev(() => K.care());
  const st = await ev(([x, y, o]) => K.standBy(x, y, o), [dx, dy, [[-ix, -iy]]]); if (!st) { console.log('no stand', tag); log.push({ tag, failed: 'stand' }); return null; }
  await p.waitForTimeout(1400); await aimAt(st.local[0], st.local[1]); await p.waitForTimeout(500);
  const prompt = await ev(() => window.__sohView().target);
  await p.keyboard.press('KeyF'); await p.waitForTimeout(700);
  await shot(tag, { gate: gate.id, door: gate.door, playerSide: st.side, prompt, toasts: await toast(), receipts: await ev(() => K.last()), inv: (await ev(() => K.inv())).filter(Boolean), ...note });
  return st;
};
const fixScene = async (tag, fx, note, take) => {
  await ev(() => K.care()); const st = await ev(([x, y]) => K.standBy(x, y), [fx.gx, fx.gy]); if (!st) { console.log('no stand', tag); return; }
  await p.waitForTimeout(1400); await aimAt(st.local[0], st.local[1]); await p.waitForTimeout(500);
  const prompt = await ev(() => window.__sohView().target);
  await shot(tag + '-a-approach', { fixture: fx.id, global: [fx.gx, fx.gy], prompt, entity: await ev(sid => K.ent(sid), fx.id), ...note });
  await p.keyboard.press('KeyF'); await p.waitForTimeout(900);
  await shot(tag + '-b-after-F', { fixture: fx.id, entity: await ev(sid => K.ent(sid), fx.id), toasts: await toast(), receipts: await ev(() => K.last()) });
  if (take) { const btn = p.getByText(/Take all/i).first(); if (await btn.count()) { await btn.click(); await p.waitForTimeout(700); } await shot(tag + '-c-taken', { fixture: fx.id, entity: await ev(sid => K.ent(sid), fx.id), inv: (await ev(() => K.inv())).filter(Boolean) }); await p.keyboard.press('Escape'); await p.waitForTimeout(600); }
};
const gates = await ev(() => K.gates), fixtures = await ev(() => K.fixtures);
const gate = id => gates.find(q => q.id.endsWith(id)), fx = id => fixtures.find(q => q.id.endsWith(id));
log.push({ info: await ev(() => G.info()), gates, fixtures });
// 1. green room: refused without the card, card case, then opened with the card
await doorScene('gate-green-1-refused-no-card', gate('po_academy:room_green'), { expect: 'refused: Green Card required' });
await fixScene('card-green', fx('card:green'), {}, true);
await doorScene('gate-green-2-opened-with-card', gate('po_academy:room_green'), { expect: 'opens, one card use spent' });
// 2. Falls: dead circuit, generator without fuel, generator with fuel (QA GRANT: 1 Fuel Canister), door opens
await doorScene('gate-falls-1-refused-no-power', gate('po_falls:deep'), { expect: 'refused: circuit dead' });
await fixScene('gen-falls-1-no-fuel', fx('gen:po_falls'), { expect: 'refused: needs a Fuel Canister' }, false);
log.push({ qaGrant: 'fuel_can x1', left: await ev(() => K.give('fuel_can', 1)) });
await fixScene('gen-falls-2-fuelled', fx('gen:po_falls'), { qaGrant: 'fuel_can x1', expect: 'burns exactly one canister, circuit live' }, false);
await doorScene('gate-falls-2-opened-powered', gate('po_falls:deep'), { expect: 'opens' });
// 3. Archive purple: card + power + Filter Mask
log.push({ qaGrant: 'keycard_purple via real case below' });
await fixScene('card-purple', fx('card:purple'), {}, true);
await doorScene('gate-purple-1-refused-no-power', gate('po_archive:room_purple'), { expect: 'refused: circuit dead (has card)' });
// 4. Core V2 (QA GRANT: Big Bang + energy + essence + upgrade bill)
const grant = { core_blast: 1, energy_basic: 10, energy_refined: 4, essence_fire: 2 };
for (const [k, n] of Object.entries(grant)) await ev(([k, n]) => K.give(k, n), [k, n]);
log.push({ qaGrant: grant });
const slot = await ev(() => window.__soh.run.custody.inv.slots.findIndex(s => s?.key === 'core_blast'));
if (slot >= 0 && slot < 8) await p.keyboard.press('Digit' + (slot + 1)); else await ev(s => { window.__soh.run.player.active = s; G.E.markDirty(); }, slot);
await p.mouse.move(420, 150); await p.waitForTimeout(900);
await shot('core-1-held-lv1-hud', { slot, inv: (await ev(() => K.inv())).filter(Boolean) });
await p.mouse.down(); await p.waitForTimeout(120); await p.mouse.up(); await p.waitForTimeout(450);
await shot('core-2-lmb-cast', { inv: (await ev(() => K.inv())).filter(Boolean), receipts: await ev(() => K.last()) });
await p.keyboard.press('KeyQ'); await p.waitForTimeout(700);
await shot('core-3-q-refused-at-lv1', { toasts: await toast(), inv: (await ev(() => K.inv())).filter(Boolean), receipts: await ev(() => K.last()) });
await p.waitForTimeout(1500); await p.keyboard.press('KeyI'); await p.waitForTimeout(900);
const cell = p.locator('[data-testid="core-service"]').first();
if (!(await cell.count())) { const cands = p.locator('.slot'); const n = await cands.count(); for (let i = 0; i < n && !(await cell.count()); i++) { const t = await cands.nth(i).getAttribute('title').catch(() => null); const h = await cands.nth(i).innerHTML().catch(() => ''); if (/core_blast|Big Bang/i.test((t || '') + h)) { await cands.nth(i).click().catch(() => {}); await p.waitForTimeout(650); } } }
await shot('core-4-pack-service-panel', { serviceVisible: await cell.count(), text: (await cell.count()) ? await cell.innerText() : null });
log.push({ pageErrors: errs });
fs.writeFileSync(OUT + 'gates-core-log.json', JSON.stringify(log, null, 1)); console.log('errs', errs.length, errs.slice(0, 3));
await b.close();
