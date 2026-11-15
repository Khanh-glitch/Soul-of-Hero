/**
 * G1B — Creator Core V2 (approved §F): no reload and no magazine, ammunition from the pack per accepted cast,
 * 300 durability, per-UID cooldowns, level-gated skills, same-UID upgrade and repair, and pre-V2 save migration.
 */
import { describe, expect, it } from 'vitest';
import { TILE, type Entity, type Stack } from '../src/game/core';
import { ITEMS } from '../src/game/catalog';
import { C, coreCastBlock, coreCastCommit, mkContainer, mkStack, settleCore } from '../src/game/engine';
import { CORE_SPECS, CORE_V2, CORE_REPAIR_BILL, G1B_CORE_TIERS, coreAmmo, coreLevel, coreReadout } from '../src/game/g1b';
import { serializeSnapshot, validate } from '../src/game/persist';
import { G1bRun, count } from './helpers/g1b-kit';

const CORES = Object.values(G1B_CORE_TIERS).flat();
const fresh = () => { const k = new G1bRun(101); C(k.r, 'inv').slots.fill(null); return k; };
const hold = (k: G1bRun, key: string, lvl: 1 | 2 | 3 = 1): Stack => { const s = mkStack(k.r, key, 1); s.lvl = lvl; C(k.r, 'inv').slots[0] = s; k.r.player.active = 0; return s; };
const put = (k: G1bRun, slot: number, key: string, qty: number) => { C(k.r, 'inv').slots[slot] = mkStack(k.r, key, qty); };
const bench = (k: G1bRun, level: 1 | 2 | 3): Entity => { const p = k.r.player; const e = { id: 'core-bench', kind: 'struct', type: 'workbench', x: p.x + TILE, y: p.y, tx: Math.floor(p.x / TILE) + 1, ty: Math.floor(p.y / TILE), hp: 160, maxHp: 160, station: { queue: [], burn: 0, fuelC: mkContainer(k.r, 'fuel', 0).id, outC: mkContainer(k.r, 'out', 4).id, level } } as any as Entity; k.r.entities[e.id] = e; return e; };
const essence = (key: string) => `essence_${ITEMS[key].essence}`;

describe('Core V2 contract', () => {
  it('all seven Cores have a spec; a newly minted Core is Lv1, 300/300, no magazine; approved repair and ammunition', () => {
    const k = fresh(); expect(CORES).toHaveLength(7); expect(CORE_V2).toMatchObject({ maxDur: 300, repairPoints: 75, modeLevel: { basic: 1, refined: 2, signature: 3 } });
    for (const key of CORES) {
      const sp = CORE_SPECS[key]; expect(sp, key).toBeTruthy(); const s = mkStack(k.r, key, 1);
      expect([s.lvl, s.dur, s.reserves, s.cd, s.upg], key).toEqual([1, 300, undefined, undefined, undefined]);
      expect(sp.wear.basic).toBe(1); expect(sp.wear.refined).toBeGreaterThan(1); expect(sp.wear.signature).toBeGreaterThan(sp.wear.refined);
      expect(sp.cooldownMs.basic).toBeLessThan(sp.cooldownMs.refined); expect(sp.cooldownMs.refined).toBeLessThan(sp.cooldownMs.signature);
      for (const to of [2, 3] as const) for (const [item, q] of sp.bills[to]) { expect(ITEMS[item], `${key} Lv${to} bill: ${item}`).toBeTruthy(); expect(q).toBeGreaterThan(0); }
      expect(ITEMS[essence(key)], `${key} signature essence`).toBeTruthy();
      expect(sp.tier).toBe((Object.entries(G1B_CORE_TIERS).find(([, ids]) => ids.includes(key)) || [])[0]);
    }
    expect(CORE_REPAIR_BILL).toEqual({ C: [['spares', 1], ['iron_ingot', 1]], M: [['spares', 2], ['iron_ingot', 1]], R: [['spares', 2], ['refined_iron_ingot', 1]] });
    expect(coreAmmo('basic', 'fire')).toEqual([['energy_basic', 1]]); expect(coreAmmo('refined', 'fire')).toEqual([['energy_refined', 1]]); expect(coreAmmo('signature', 'fire')).toEqual([['energy_refined', 1], ['essence_fire', 1]]);
  });

  it('the reload intent is gone: nothing can be loaded into a Core', () => {
    const k = fresh(); const s = hold(k, 'core_blast'); put(k, 1, 'energy_basic', 20);
    const rc = k.act('loadCore', { slot: 0, uid: s.uid, mode: 'basic' }); expect(rc.ok).toBe(false); expect(count(k.r, 'energy_basic')).toBe(20); expect(s.reserves).toBeUndefined();
  });
});

describe('Core V2 casting', () => {
  it('refuses for free: no ammunition, locked skill, cooldown, worn out — and charges ammo + wear + cooldown together when accepted', () => {
    const k = fresh(); const s = hold(k, 'core_meteor', 1); const sp = CORE_SPECS.core_meteor; const now = k.now;
    const snap = () => JSON.stringify([s, C(k.r, 'inv').slots]);
    // no ammunition
    let before = snap(); expect(coreCastBlock(k.r, s, 'basic', now)).toMatch(/No Basic Energy/); expect(coreCastCommit(k.r, s, 'basic', now)).toBe(false); expect(snap()).toBe(before);
    put(k, 1, 'energy_basic', 3); put(k, 2, 'energy_refined', 3); put(k, 3, essence('core_meteor'), 2);
    // Lv1 has only LMB
    before = snap(); expect(coreCastBlock(k.r, s, 'refined', now)).toMatch(/Q needs .* Lv2/); expect(coreCastBlock(k.r, s, 'signature', now)).toMatch(/E needs .* Lv3/);
    expect(coreCastCommit(k.r, s, 'refined', now)).toBe(false); expect(coreCastCommit(k.r, s, 'signature', now)).toBe(false); expect(snap()).toBe(before);
    // accepted LMB: exactly 1 Basic Energy, wear, cooldown on this UID
    expect(coreCastCommit(k.r, s, 'basic', now)).toBe(true); expect(count(k.r, 'energy_basic')).toBe(2); expect(s.dur).toBe(300 - sp.wear.basic); expect(s.cd!.basic).toBe(now + sp.cooldownMs.basic);
    // cooling down: free refusal; ready again exactly at the stamp
    before = snap(); expect(coreCastBlock(k.r, s, 'basic', now + sp.cooldownMs.basic - 1)).toMatch(/LMB recharging/); expect(coreCastCommit(k.r, s, 'basic', now + 1)).toBe(false); expect(snap()).toBe(before);
    expect(coreCastBlock(k.r, s, 'basic', now + sp.cooldownMs.basic)).toBeNull();
    // Lv3: Q takes 1 Refined; E takes 1 Refined + 1 matching Essence; cooldowns are per skill
    s.lvl = 3; const t = now + 10_000;
    expect(coreCastCommit(k.r, s, 'refined', t)).toBe(true); expect(count(k.r, 'energy_refined')).toBe(2); expect(count(k.r, essence('core_meteor'))).toBe(2);
    expect(coreCastCommit(k.r, s, 'signature', t)).toBe(true); expect(count(k.r, 'energy_refined')).toBe(1); expect(count(k.r, essence('core_meteor'))).toBe(1);
    expect(s.dur).toBe(300 - sp.wear.basic - sp.wear.refined - sp.wear.signature); expect(s.cd).toMatchObject({ refined: t + sp.cooldownMs.refined, signature: t + sp.cooldownMs.signature });
    // E without the essence: refused for free even with Refined Energy in the pack
    C(k.r, 'inv').slots[3] = null; before = snap(); const later = t + sp.cooldownMs.signature;
    expect(coreCastBlock(k.r, s, 'signature', later)).toMatch(/No .*Essence/); expect(coreCastCommit(k.r, s, 'signature', later)).toBe(false); expect(snap()).toBe(before);
    // worn out
    s.dur = 0; before = snap(); expect(coreCastBlock(k.r, s, 'basic', later)).toMatch(/worn out/); expect(coreCastCommit(k.r, s, 'basic', later)).toBe(false); expect(snap()).toBe(before);
  });

  it('cooldown belongs to the physical Core: a second Core of the same kind is ready', () => {
    const k = fresh(); const a = hold(k, 'core_blast'); const b = mkStack(k.r, 'core_blast', 1); C(k.r, 'inv').slots[1] = b; put(k, 2, 'energy_basic', 5);
    expect(coreCastCommit(k.r, a, 'basic', k.now)).toBe(true); expect(coreCastBlock(k.r, a, 'basic', k.now)).toMatch(/recharging/); expect(coreCastBlock(k.r, b, 'basic', k.now)).toBeNull(); expect(a.uid).not.toBe(b.uid);
  });

  it('durability never goes below zero and the last cast is still paid for in full', () => {
    const k = fresh(); const s = hold(k, 'core_dragon', 3); const sp = CORE_SPECS.core_dragon; put(k, 1, 'energy_refined', 5); put(k, 2, essence('core_dragon'), 5);
    s.dur = 3; expect(sp.wear.signature).toBeGreaterThan(3); expect(coreCastCommit(k.r, s, 'signature', k.now)).toBe(true); expect(s.dur).toBe(0);
    expect(coreCastCommit(k.r, s, 'refined', k.now)).toBe(false); expect(count(k.r, 'energy_refined')).toBe(4);
  });

  it('through the real sim: holding LMB with a Lv1 Core spends Basic Energy and wears the Core; with none it does nothing', () => {
    const k = fresh(); const s = hold(k, 'core_blast'); const p = k.r.player;
    for (let i = 0; i < 20; i++) k.step(50, { attack: true, attackPressed: i === 0, mx: p.x + 60, my: p.y });
    expect(s.dur, 'no ammunition: no cast').toBe(300); expect(k.r.receipts.some(v => v.kind === 'core.commit')).toBe(false);
    put(k, 1, 'energy_basic', 10);
    for (let i = 0; i < 40; i++) k.step(50, { attack: true, attackPressed: i === 0, mx: p.x + 60, my: p.y });
    const casts = k.r.receipts.filter(v => v.kind === 'core.commit').length; expect(casts).toBeGreaterThanOrEqual(1);
    expect(count(k.r, 'energy_basic')).toBe(10 - casts); expect(s.dur).toBe(300 - casts * CORE_SPECS.core_blast.wear.basic);
    // 2 s of holding at a 0.7 s cooldown cannot exceed 3 casts
    expect(casts).toBeLessThanOrEqual(3); expect(k.valid()).toBe(true);
  }, 120_000);

  it('through the real sim: Q on a Lv1 Core is refused without spending; on Lv2 it spends one Refined Energy', () => {
    const k = fresh(); const s = hold(k, 'core_blast', 1); put(k, 1, 'energy_refined', 4); const p = k.r.player;
    const q = () => { for (let i = 0; i < 30; i++) k.step(50, { skill: i === 0 ? 'refined' : undefined, skillAim: i === 0 ? ({ uid: s.uid, slot: 0, mx: p.x + 60, my: p.y, viewX: 0, viewY: 0 } as any) : undefined, mx: p.x + 60, my: p.y }); };
    q(); expect(count(k.r, 'energy_refined')).toBe(4); expect(s.dur).toBe(300); expect(p.action).toBeFalsy();
    s.lvl = 2; q(); expect(count(k.r, 'energy_refined')).toBe(3); expect(s.dur).toBe(300 - CORE_SPECS.core_blast.wear.refined); expect(s.cd?.refined).toBeGreaterThan(k.now);
  }, 120_000);
});

describe('Core V2 upgrade and repair', () => {
  it('upgrade keeps the UID, needs the right Workbench level and the whole bill, takes real time, and survives save/load', () => {
    const k = fresh(); const s = hold(k, 'core_elsa', 1); const sp = CORE_SPECS.core_elsa; const uid = s.uid; s.dur = 222;
    const give = (bill: [string, number][], short = 0) => bill.forEach(([item, q], i) => put(k, 2 + i, item, q - (i === 0 ? short : 0)));
    expect(k.act('coreUpgrade', { uid }).ok, 'no bench').toBe(false);
    const b = bench(k, 1); give(sp.bills[2]);
    const low = k.act('coreUpgrade', { uid }); expect(low.ok).toBe(false); expect(low.reason).toMatch(/level 2 Workbench/);
    b.station!.level = 2; give(sp.bills[2], 1); const short = k.act('coreUpgrade', { uid }); expect(short.ok).toBe(false); expect(short.reason).toMatch(/Missing/);
    for (const [item, q] of sp.bills[2]) expect(count(k.r, item), 'a refused upgrade takes nothing').toBe(item === sp.bills[2][0][0] ? q - 1 : q);
    give(sp.bills[2]); const t0 = k.now; expect(k.act('coreUpgrade', { uid }).ok).toBe(true);
    for (const [item] of sp.bills[2]) expect(count(k.r, item)).toBe(0);
    expect(s.upg).toEqual({ to: 2, readyAt: t0 + 10 + CORE_V2.upgrade[2].ms }); expect(s.lvl).toBe(1); expect(s.uid).toBe(uid); expect(s.dur).toBe(222);
    // busy: cannot cast, cannot upgrade again, cannot repair
    put(k, 1, 'energy_basic', 2); expect(coreCastBlock(k.r, s, 'basic', k.now)).toMatch(/being upgraded/); expect(k.act('coreUpgrade', { uid }).ok).toBe(false); expect(k.act('coreRepair', { uid }).ok).toBe(false);
    // save mid-upgrade, load after the timer elapsed: the same Core is Lv2
    const env = JSON.parse(serializeSnapshot(k.gs)); const loaded = validate(JSON.parse(env.payload))!; expect(loaded).not.toBeNull();
    const ls = loaded.run!.custody.inv.slots[0]!; expect(ls.uid).toBe(uid); expect(ls.upg).toEqual(s.upg);
    settleCore(ls, s.upg!.readyAt - 1); expect(ls.lvl).toBe(1); settleCore(ls, s.upg!.readyAt); expect(ls.lvl).toBe(2); expect(ls.upg).toBeUndefined(); expect(ls.dur).toBe(222);
    expect(coreReadout(s, s.upg!.readyAt).lvl).toBe(2);
    // live path: after the timer Q is available; then 2 → 3 needs a level 3 bench
    k.now = s.upg!.readyAt + 1; put(k, 1, 'energy_refined', 2); expect(coreCastBlock(k.r, s, 'refined', k.now)).toBeNull(); expect(s.lvl).toBe(2);
    give(sp.bills[3]); expect(k.act('coreUpgrade', { uid }).reason).toMatch(/level 3 Workbench/); b.station!.level = 3; expect(k.act('coreUpgrade', { uid }).ok).toBe(true);
    k.now += CORE_V2.upgrade[3].ms + 20; settleCore(s, k.now); expect(coreLevel(s)).toBe(3); expect(s.uid).toBe(uid);
    expect(k.act('coreUpgrade', { uid }).reason).toMatch(/already Lv3/); expect(k.valid()).toBe(true);
  }, 120_000);

  it('repair adds 75 up to 300 for the tier bill, at any owned Workbench, and never overfills', () => {
    const k = fresh(); const s = hold(k, 'core_dragon', 2); const bill = CORE_REPAIR_BILL.R; s.dur = 100; const uid = s.uid;
    bill.forEach(([item, q], i) => put(k, 2 + i, item, q * 4));
    expect(k.act('coreRepair', { uid }).ok, 'no bench').toBe(false); bench(k, 1);
    expect(k.act('coreRepair', { uid }).ok).toBe(true); expect(s.dur).toBe(175); for (const [item, q] of bill) expect(count(k.r, item)).toBe(q * 3);
    expect(k.act('coreRepair', { uid }).ok).toBe(true); expect(k.act('coreRepair', { uid }).ok).toBe(true); expect(s.dur).toBe(300); // 250 → capped
    const full = k.act('coreRepair', { uid }); expect(full.ok).toBe(false); expect(full.reason).toMatch(/full durability/); for (const [item, q] of bill) expect(count(k.r, item)).toBe(q);
    expect(s.uid).toBe(uid); expect(s.lvl).toBe(2);
    s.dur = 0; C(k.r, 'inv').slots[2] = null; const none = k.act('coreRepair', { uid }); expect(none.ok).toBe(false); expect(none.reason).toMatch(/Missing/); expect(s.dur).toBe(0);
  }, 120_000);
});

describe('Core V2 save migration', () => {
  it('a pre-V2 Core (reserves, no level) loads as Lv3 300/300 with the same UID; its stored energy is spent first and never refilled', () => {
    const k = fresh(); const s = hold(k, 'core_demon'); const uid = s.uid;
    const raw = JSON.parse(JSON.stringify(k.gs)); const old = raw.run.custody.inv.slots[0]; delete old.lvl; delete old.dur; old.reserves = { basic: 2, refined: 0, signature: 1 };
    const empty = JSON.parse(JSON.stringify(old)); empty.uid = uid + '-b'; empty.reserves = { basic: 0, refined: 0, signature: 0 }; raw.run.custody.inv.slots[5] = empty;
    const gs = validate(raw)!; expect(gs, 'legacy save loads').not.toBeNull(); const m = gs.run!.custody.inv.slots[0]!, m2 = gs.run!.custody.inv.slots[5]!;
    expect([m.uid, m.lvl, m.dur, m.reserves]).toEqual([uid, 3, 300, { basic: 2, refined: 0, signature: 1 }]); expect([m2.lvl, m2.dur, m2.reserves]).toEqual([3, 300, undefined]);
    // idempotent
    const again = validate(JSON.parse(JSON.stringify(gs)))!; expect(again.run!.custody.inv.slots[0]).toEqual(m);
    // stored energy first (pack untouched), then the pack; the bank is deleted when dry
    const r = gs.run!; r.custody.inv.slots[1] = mkStack(r, 'energy_basic', 5); const t = k.now; const cd = CORE_SPECS.core_demon.cooldownMs.basic;
    expect(coreCastCommit(r, m, 'basic', t)).toBe(true); expect(coreCastCommit(r, m, 'basic', t + cd)).toBe(true); expect(m.reserves).toEqual({ basic: 0, refined: 0, signature: 1 }); expect(r.custody.inv.slots[1]!.qty).toBe(5);
    expect(coreCastCommit(r, m, 'basic', t + 2 * cd)).toBe(true); expect(r.custody.inv.slots[1]!.qty).toBe(4);
    expect(coreCastCommit(r, m, 'signature', t)).toBe(true); expect(m.reserves).toBeUndefined();
    expect(validate(JSON.parse(JSON.stringify(gs)))).not.toBeNull();
  });

  it('a V2 Core with an impossible level, durability or upgrade is rejected by the save validator', () => {
    const k = fresh(); hold(k, 'core_blast');
    for (const patch of [{ lvl: 4 }, { dur: 301 }, { dur: -1 }, { upg: { to: 3, readyAt: 1 } }, { cd: { ultimate: 5 } }]) { const raw = JSON.parse(JSON.stringify(k.gs)); Object.assign(raw.run.custody.inv.slots[0], patch); expect(validate(raw), JSON.stringify(patch)).toBeNull(); }
    const raw = JSON.parse(JSON.stringify(k.gs)); raw.run.custody.inv.slots[1] = { ...raw.run.custody.inv.slots[0], uid: 'x-knife', key: 'knife', lvl: 2 }; expect(validate(raw)).toBeNull();
  });
});
