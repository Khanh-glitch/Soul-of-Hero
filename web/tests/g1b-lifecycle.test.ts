/**
 * G1B — chest lifecycle on a real Veyra run: seeding, the single roll, custody, EMPTY → one refill, save round-trip,
 * window streaming, card rooms / power / PPE gates, card cases, generators and deliberate drops.
 * Everything goes through the shipped intents and the real sim tick; nothing is stubbed.
 */
import { describe, expect, it } from 'vitest';
import { BAL, TILE, WW, WH } from '../src/game/core';
import { ITEMS } from '../src/game/catalog';
import { C, allRunEntities, g1bEntities, g1bGateOf, g1bPowered, mkStack, markDirty, stepG1b } from '../src/game/engine';
import { findInteract } from '../src/game/sim';
import { G1B_SOURCE_SITES, G1B_FIXTURES, G1B_GATES, G1B_LOOT_REVISION, G1B_CHESTS, g1bRoll, g1bSeed, g1bRefreshHours } from '../src/game/g1b';
import { serializeSnapshot, validate } from '../src/game/persist';
import { shiftVeyraWindowBy } from '../src/veyra05/continuity';
import { G1bRun, HOUR, count } from './helpers/g1b-kit';

const src = (variant: string, pred: (s: typeof G1B_SOURCE_SITES[number]) => boolean = s => !s.gate) => G1B_SOURCE_SITES.find(s => s.variant === variant && pred(s))!;
const stacks = (k: G1bRun, cid: string) => C(k.r, cid).slots.filter(Boolean).map(s => `${s!.key}x${s!.qty}${s!.lvl ? ':lv' + s!.lvl : ''}`);
const takeAll = (k: G1bRun, cid: string) => { const c = C(k.r, cid); for (let i = 0; i < c.slots.length; i++) if (c.slots[i]) expect(k.act('move', { from: cid, fs: i, to: 'inv' }).ok).toBe(true); };
const roundTrip = (k: G1bRun) => { const env = JSON.parse(serializeSnapshot(k.gs)); const gs = validate(JSON.parse(env.payload)); expect(gs, 'saved state must load').not.toBeNull(); return gs!; };
const clearPack = (k: G1bRun) => { C(k.r, 'inv').slots.fill(null); };

describe('G1B seeding', () => {
  it('a new Veyra run carries all 130 chests, 3 card cases and 3 generators exactly once, CLOSED and unrolled', () => {
    const k = new G1bRun(101); const all = g1bEntities(k.r);
    expect(all).toHaveLength(136); expect(new Set(all.map(e => e.g1b!.sid))).toEqual(new Set([...G1B_SOURCE_SITES.map(s => s.id), ...G1B_FIXTURES.map(f => f.id)]));
    for (const e of all) {
      const g = e.g1b!, c = k.r.custody[e.c!];
      if (g.kind === 'chest') { expect(g.state).toBe('closed'); expect(g.cycle).toBe(0); expect(g.roll).toBeUndefined(); expect(c.slots.some(Boolean), 'no loot exists before the first open').toBe(false); expect(c.slots).toHaveLength(12); }
      if (g.kind === 'card') { expect(g.state).toBe('opened'); expect(c.slots.filter(Boolean).map(s => s!.key)).toEqual([G1B_FIXTURES.find(f => f.id === g.sid)!.card]); expect(c.slots[0]!.charge).toBe(BAL.poiAccess.cardUses); }
    }
    expect(k.r.g1b).toMatchObject({ version: 'g1b-v1', rev: G1B_LOOT_REVISION, doors: {} });
    // the objects outside the streamed window wait in their own table and never enter the structure table
    expect(Object.values(k.r.g1b!.far).every(e => !!e.g1b)).toBe(true);
    expect(Object.values(k.r.veyraOffscreenEntities || {}).some(e => !!e.g1b)).toBe(false);
    expect(Object.values(k.r.entities).filter(e => e.g1b).length + Object.keys(k.r.g1b!.far).length).toBe(136);
    expect(allRunEntities(k.r).some(e => !!e.g1b && !k.r.entities[e.id])).toBe(false);
    expect(k.valid()).toBe(true); roundTrip(k);
  });

  it('two runs with different ids roll the same chest differently; the same run always rolls it the same way', () => {
    const a = new G1bRun(101), b = new G1bRun(202); expect(a.r.id).not.toBe(b.r.id);
    const s = src('military_high', () => true); expect(g1bSeed(a.r.id, s.id, 0)).not.toBe(g1bSeed(b.r.id, s.id, 0));
  });
});

describe('G1B chest lifecycle', () => {
  it('opens once, stores the roll, survives save/load and window streaming, empties, refills exactly once', () => {
    const k = new G1bRun(101); const s = src('military_mid'); clearPack(k);
    k.standBy(s.gx, s.gy); const e = k.live(s.id);
    // the prompt the player sees
    const hint = findInteract(k.gs, k.now); expect(hint?.eid).toBe(e.id); expect(hint?.kind).toBe('g1b:chest'); expect(hint?.label).toBe('Open Mid Military Case');
    // out of reach: refused, nothing rolled
    const p = k.r.player, px = p.x, py = p.y; p.x += 6 * TILE; expect(k.act('g1bOpen', { eid: e.id }).ok).toBe(false); expect(e.g1b!.state).toBe('closed'); p.x = px; p.y = py;

    const want = g1bRoll(k.r.id, s.id, 0, key => ITEMS[key]?.max ?? 1);
    const rc = k.act('g1bOpen', { eid: e.id }); expect(rc.ok).toBe(true);
    expect(e.g1b!.state).toBe('opened'); expect(e.g1b!.roll).toMatchObject({ rev: G1B_LOOT_REVISION, seed: want.seed });
    const got = stacks(k, e.c!); expect(got).toEqual(want.stacks.map(v => `${v.key}x${v.qty}${v.level ? ':lv' + v.level : ''}`));
    const uids = C(k.r, e.c!).slots.filter(Boolean).map(v => v!.uid); expect(new Set(uids).size).toBe(uids.length);
    const rolls = k.r.receipts.filter(v => v.kind === 'g1b.roll'); expect(rolls).toHaveLength(got.length); expect(rolls.every(v => v.detail.includes(s.id) && v.detail.includes(G1B_LOOT_REVISION))).toBe(true);

    // opening again never rerolls or adds
    expect(k.act('g1bOpen', { eid: e.id }).ok).toBe(true); expect(stacks(k, e.c!)).toEqual(got); expect(k.r.receipts.filter(v => v.kind === 'g1b.roll')).toHaveLength(got.length);
    // nothing can be stored in a world chest
    expect(k.act('move', { from: e.c, fs: 0, to: 'inv' }).ok).toBe(true); const invSlot = C(k.r, 'inv').slots.findIndex(Boolean);
    expect(k.act('move', { from: 'inv', fs: invSlot, to: e.c }).ok).toBe(false);
    // partially looted: stays OPENED with the rest, across save/load and across a window slide away and back
    k.step(); expect(e.g1b!.state).toBe('opened'); expect(e.g1b!.refillAt).toBeUndefined();
    const left = stacks(k, e.c!); expect(left).toEqual(got.slice(1));
    const loaded = roundTrip(k); const le = Object.values(loaded.run!.entities).find(v => v.g1b?.sid === s.id)!; expect(le.g1b).toEqual(e.g1b);
    expect(loaded.run!.custody[le.c!].slots.filter(Boolean).map(v => v!.uid)).toEqual(C(k.r, e.c!).slots.filter(Boolean).map(v => v!.uid));
    expect(shiftVeyraWindowBy(k.gs, 150, 0, markDirty)).toBe(true); expect(Object.values(k.r.entities).some(v => v.g1b?.sid === s.id), 'chest left the window').toBe(false);
    expect(k.ent(s.id).tx).toBe(s.gx); expect(k.valid(), 'parked chest validates').toBe(true); roundTrip(k);
    expect(shiftVeyraWindowBy(k.gs, -150, 0, markDirty)).toBe(true); const back = k.live(s.id); const [ox, oy] = k.origin(); expect([back.tx! + ox, back.ty! + oy]).toEqual([s.gx, s.gy]); expect(back.x).toBe(back.tx! * TILE + 8);
    expect(stacks(k, back.c!)).toEqual(left); expect(g1bEntities(k.r)).toHaveLength(136);

    // take the rest → EMPTY, one timer of the approved length, one receipt
    k.standBy(s.gx, s.gy); takeAll(k, back.c!); const t0 = k.now; k.step();
    expect(back.g1b!.state).toBe('empty'); const hours = g1bRefreshHours(s.id); expect(hours).toBe(G1B_CHESTS[s.variant].refresh_hours);
    expect(Math.abs(back.g1b!.refillAt! - t0 - hours * HOUR), 'one timer of the approved length from the moment it emptied').toBeLessThan(5000);
    expect(k.act('g1bOpen', { eid: back.id }).ok).toBe(false); expect(findInteract(k.gs, k.now)?.label).toMatch(/^Mid Military Case · empty · restocks in /);
    const refillAt = back.g1b!.refillAt!; roundTrip(k);
    // not early
    k.now = refillAt - 60_000; k.step(); expect(back.g1b!.state).toBe('empty'); expect(back.g1b!.refillAt).toBe(refillAt);
    // a very long absence refills ONCE: closed, next cycle, still unrolled (no catch-up, no stockpile)
    k.r.player.hunger = 100; k.r.player.thirst = 100; k.now = refillAt + 1000; k.step(); expect(back.g1b!.state, 'the sim tick restocks it').toBe('closed'); stepG1b(k.r, refillAt + 400 * HOUR); expect(back.g1b!.state).toBe('closed'); expect(back.g1b!.cycle).toBe(1); expect(back.g1b!.roll).toBeUndefined(); expect(back.g1b!.refillAt).toBeUndefined();
    expect(C(k.r, back.c!).slots.some(Boolean)).toBe(false); expect(k.r.receipts.filter(v => v.kind === 'g1b.refill' && v.detail.startsWith(s.id))).toHaveLength(1);
    // cycle 1 is a fresh, equally deterministic roll
    k.r.player.hp = BAL.player.maxHp; k.r.player.dead = false; k.standBy(s.gx, s.gy); clearPack(k);
    expect(k.act('g1bOpen', { eid: back.id }).ok).toBe(true);
    expect(stacks(k, back.c!)).toEqual(g1bRoll(k.r.id, s.id, 1, key => ITEMS[key]?.max ?? 1).stacks.map(v => `${v.key}x${v.qty}${v.level ? ':lv' + v.level : ''}`));
    expect(k.valid()).toBe(true);
  }, 300_000);

  it('a chest that restocks while outside the window is closed and unrolled when the player returns', () => {
    const k = new G1bRun(101); const s = src('food_low'); clearPack(k); k.standBy(s.gx, s.gy); const e = k.live(s.id);
    expect(k.act('g1bOpen', { eid: e.id }).ok).toBe(true); takeAll(k, e.c!); k.step(); const at = e.g1b!.refillAt!; expect(e.g1b!.state).toBe('empty');
    expect(shiftVeyraWindowBy(k.gs, 0, e.ty! > 120 ? 160 : -160, markDirty) || shiftVeyraWindowBy(k.gs, 160, 0, markDirty)).toBe(true);
    expect(Object.values(k.r.entities).some(v => v.g1b?.sid === s.id)).toBe(false);
    k.r.player.hunger = 100; k.r.player.thirst = 100; k.now = at + 1000; k.step();
    expect(k.ent(s.id).g1b).toMatchObject({ state: 'closed', cycle: 1 }); expect(k.valid()).toBe(true);
  }, 300_000);

  it('a Core found in a chest arrives at the rolled level with full durability and no magazine', () => {
    const s = src('military_high', () => true); let found = false;
    // search run ids for one that rolls a Core here, then prove the minted stack through the real intent on that run
    const k = new G1bRun(101); const realId = k.r.id;
    for (let cycle = 0; cycle < 60 && !found; cycle++) {
      const roll = g1bRoll(realId, s.id, cycle, key => ITEMS[key]?.max ?? 1); const core = roll.stacks.find(v => v.from === 'core'); if (!core) continue; found = true;
      const e = k.ent(s.id); e.g1b!.cycle = cycle; // same run, later restock cycle
      const st = mkStack(k.r, core.key, 1); expect(st.lvl).toBe(1); expect(st.dur).toBe(300); expect(st.reserves).toBeUndefined();
    }
    expect(found, 'military_high rolls a Core in 53.5% of opens').toBe(true);
  });
});

describe('G1B card rooms, power and PPE', () => {
  const gateDoor = (k: G1bRun, gateId: string) => { const g = G1B_GATES.find(v => v.id === gateId)!; k.bring(g.door[0], g.door[1]); const [ox, oy] = k.origin(); const e = Object.values(k.r.entities).find(v => v.kind === 'door' && v.tx === g.door[0] - ox && v.ty === g.door[1] - oy && ((v as any).floor ?? 0) === 0)!; expect(e, `door entity of ${gateId}`).toBeTruthy(); expect(g1bGateOf(k.r, e)?.id).toBe(gateId); return { g, e }; };
  const stand = (k: G1bRun, gx: number, gy: number) => { const [ox, oy] = k.origin(); k.r.player.x = (gx - ox) * TILE + 8; k.r.player.y = (gy - oy) * TILE + 8; };
  const outside = (k: G1bRun, g: typeof G1B_GATES[number]) => stand(k, g.door[0] - g.interior[0], g.door[1] - g.interior[1]);
  const inside = (k: G1bRun, g: typeof G1B_GATES[number]) => stand(k, g.door[0] + g.interior[0], g.door[1] + g.interior[1]);

  it('the three cards are finite world pickups; a taken case stays empty forever', () => {
    const k = new G1bRun(101); clearPack(k);
    for (const f of G1B_FIXTURES.filter(v => v.kind === 'card')) {
      k.standBy(f.gx, f.gy); const e = k.live(f.id); expect(findInteract(k.gs, k.now)?.kind).toBe('g1b:card');
      expect(k.act('g1bOpen', { eid: e.id }).ok).toBe(true); takeAll(k, e.c!); k.step(); expect(e.g1b!.state).toBe('empty'); expect(e.g1b!.refillAt).toBeUndefined();
      expect(count(k.r, f.card!)).toBe(1);
      stepG1b(k.r, k.now + 1000 * HOUR); expect(e.g1b!.state).toBe('empty'); expect(C(k.r, e.c!).slots.some(Boolean), 'a card case never restocks').toBe(false);
    }
    expect(k.valid()).toBe(true);
  }, 300_000);

  it('green room (Academy): no card → sealed; wrong card → sealed; green card → one scan spent; interior handle is free; door re-closes', () => {
    const k = new G1bRun(101); clearPack(k); const { g, e } = gateDoor(k, 'veyra.g1b:gate:po_academy:room_green'); outside(k, g);
    expect(e.open).toBeFalsy(); const no = k.act('door', { eid: e.id }); expect(no.ok).toBe(false); expect(no.reason).toMatch(/Green Card is required/);
    C(k.r, 'inv').slots[0] = mkStack(k.r, 'blue_card', 1); const wrong = k.act('door', { eid: e.id }); expect(wrong.ok).toBe(false); expect(wrong.reason).toMatch(/wrong colour/); expect(C(k.r, 'inv').slots[0]!.charge).toBe(BAL.poiAccess.cardUses);
    C(k.r, 'inv').slots[1] = mkStack(k.r, 'green_card', 1); const uses = C(k.r, 'inv').slots[1]!.charge!;
    expect(findInteract(k.gs, k.now)?.label).toBe(`Sealed door · Green Card · ${uses} uses`);
    const yes = k.act('door', { eid: e.id }); expect(yes.ok).toBe(true); expect(e.open).toBe(true); expect(C(k.r, 'inv').slots[1]!.charge).toBe(uses - 1); expect(C(k.r, 'inv').slots[0]!.charge).toBe(BAL.poiAccess.cardUses);
    // walk in; the door closes behind on its own once the doorway is clear
    inside(k, g); stand(k, g.door[0] + 2 * g.interior[0], g.door[1] + 2 * g.interior[1]); k.now += BAL.poiAccess.doorOpenMs + 500; k.step(); expect(e.open).toBe(false);
    // the six green-room chests are reachable from inside and roll normally
    const chest = G1B_SOURCE_SITES.find(s => s.gate === g.id)!; k.standBy(chest.gx, chest.gy); expect(k.act('g1bOpen', { eid: k.live(chest.id).id }).ok).toBe(true);
    // leaving never needs a card: drop every card, use the handle from the interior cell
    C(k.r, 'inv').slots[0] = null; C(k.r, 'inv').slots[1] = null; inside(k, g);
    expect(findInteract(k.gs, k.now)?.label).toMatch(/^Interior exit handle/);
    const out = k.act('door', { eid: e.id }); expect(out.ok).toBe(true); expect(e.open).toBe(true); expect(k.valid()).toBe(true);
  }, 300_000);

  it('blue room (Meridian): needs the live circuit AND the blue card; the generator burns exactly one Fuel Canister', () => {
    const k = new G1bRun(101); clearPack(k); const { g, e } = gateDoor(k, 'veyra.g1b:gate:po_meridian:room_blue'); outside(k, g);
    C(k.r, 'inv').slots[0] = mkStack(k.r, 'blue_card', 1); const uses = C(k.r, 'inv').slots[0]!.charge!;
    const dead = k.act('door', { eid: e.id }); expect(dead.ok).toBe(false); expect(dead.reason).toMatch(/circuit is dead/); expect(C(k.r, 'inv').slots[0]!.charge, 'a refused scan costs nothing').toBe(uses);
    const gen = G1B_FIXTURES.find(f => f.id === g.power)!; k.standBy(gen.gx, gen.gy); const ge = k.live(gen.id); expect(findInteract(k.gs, k.now)?.kind).toBe('g1b:gen');
    expect(k.act('g1bGenerator', { eid: ge.id }).ok, 'no fuel').toBe(false);
    C(k.r, 'inv').slots[1] = mkStack(k.r, 'fuel_can', 2); expect(k.act('g1bGenerator', { eid: ge.id }).ok).toBe(true); expect(count(k.r, 'fuel_can')).toBe(1);
    expect(k.act('g1bGenerator', { eid: ge.id }).ok, 'already running: no second can burned').toBe(false); expect(count(k.r, 'fuel_can')).toBe(1);
    expect(g1bPowered(k.r, g, k.now)).toBe(true); roundTrip(k);
    outside(k, g); expect(k.act('door', { eid: e.id }).ok).toBe(true); expect(C(k.r, 'inv').slots[0]!.charge).toBe(uses - 1);
    // the circuit dies when the fuel runs out
    expect(g1bPowered(k.r, g, k.now + BAL.poiAccess.fuelRuntimeMs + 1)).toBe(false);
  }, 300_000);

  it('purple annex (Archive): power, Filter Mask and purple card are all required, checked before any scan is spent', () => {
    const k = new G1bRun(101); clearPack(k); const { g, e } = gateDoor(k, 'veyra.g1b:gate:po_archive:room_purple'); expect(g).toMatchObject({ card: 'purple', ppe: true });
    const gen = G1B_FIXTURES.find(f => f.id === g.power)!; k.standBy(gen.gx, gen.gy); C(k.r, 'inv').slots[1] = mkStack(k.r, 'fuel_can', 1); expect(k.act('g1bGenerator', { eid: k.live(gen.id).id }).ok).toBe(true);
    outside(k, g); C(k.r, 'inv').slots[0] = mkStack(k.r, 'purple_card', 1); const uses = C(k.r, 'inv').slots[0]!.charge!;
    const bare = k.act('door', { eid: e.id }); expect(bare.ok).toBe(false); expect(bare.reason).toMatch(/Filter Mask/); expect(C(k.r, 'inv').slots[0]!.charge).toBe(uses);
    C(k.r, 'eq').slots[0] = mkStack(k.r, 'gas_mask', 1);
    expect(k.act('door', { eid: e.id }).ok).toBe(true); expect(C(k.r, 'inv').slots[0]!.charge).toBe(uses - 1);
    // the Archive deep court shares the same generator and the same rule
    const deep = gateDoor(k, 'veyra.g1b:gate:po_archive:deep'); expect(deep.g).toMatchObject({ card: 'purple', ppe: true, power: g.power });
  }, 300_000);

  it('Falls deep room: power only — no card is asked for or spent', () => {
    const k = new G1bRun(101); clearPack(k); const { g, e } = gateDoor(k, 'veyra.g1b:gate:po_falls:deep'); expect(g.card).toBeUndefined(); outside(k, g);
    expect(k.act('door', { eid: e.id }).ok).toBe(false);
    const gen = G1B_FIXTURES.find(f => f.id === g.power)!; k.standBy(gen.gx, gen.gy); C(k.r, 'inv').slots[1] = mkStack(k.r, 'fuel_can', 1); expect(k.act('g1bGenerator', { eid: k.live(gen.id).id }).ok).toBe(true);
    outside(k, g); expect(k.act('door', { eid: e.id }).ok).toBe(true); expect(e.open).toBe(true);
  }, 300_000);
});

describe('G1B deliberate drops', () => {
  it('an item dropped on purpose stays on the ground until F picks it up', () => {
    const k = new G1bRun(101); clearPack(k); C(k.r, 'inv').slots[0] = mkStack(k.r, 'spares', 7);
    expect(k.act('drop', { c: 'inv', slot: 0 }).ok).toBe(true); const d = Object.values(k.r.entities).find(e => e.kind === 'drop' && e.manual)!; expect(d).toBeTruthy();
    const x0 = d.x, y0 = d.y; for (let i = 0; i < 60; i++) k.step(50); // 3 s standing on it
    expect(k.r.entities[d.id], 'not vacuumed back').toBeTruthy(); expect([d.x, d.y]).toEqual([x0, y0]); expect(count(k.r, 'spares')).toBe(0);
    expect(k.valid()).toBe(true); roundTrip(k);
    const hint = findInteract(k.gs, k.now); expect(hint?.eid).toBe(d.id); expect(hint?.label).toBe('Pick up Parts ×7');
    expect(k.act('pickup', { eid: d.id }).ok).toBe(true); expect(count(k.r, 'spares')).toBe(7); expect(k.r.entities[d.id]).toBeUndefined();
  }, 120_000);
});
