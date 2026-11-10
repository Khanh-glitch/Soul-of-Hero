import { afterEach, describe, expect, it, vi } from 'vitest';
import { BAL, TILE, WW, T, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, destroyStructure, dispatch, markDirty, mkContainer, newGame, stepStations } from '../src/game/engine';
import { getWorld } from '../src/game/world';
import { settle } from '../src/game/sim';
import { load, migrate, save, saveSync, selectSnapshots, serializeSnapshot, validate } from '../src/game/persist';

const T0 = Date.UTC(2026, 10, 1);
let serial = 0;
const id = () => `b1-${++serial}`;
function fresh() { const gs = newGame(); markDirty(); expect(dispatch(gs, { id: id(), type: 'startRun', character: 'female', region: 0, seed: 101 }, T0).ok).toBe(true); return gs; }
function station(gs: GameState, type: string) {
  const r = gs.run!, p = r.player;
  const fuel = mkContainer(r, 'fuel', 3), out = mkContainer(r, 'out', 6);
  const e: Entity = { id: 'test-station-' + id(), kind: 'struct', type, x: p.x + 16, y: p.y, tx: Math.floor((p.x + 16) / TILE), ty: Math.floor(p.y / TILE), hp: 100, maxHp: 100, station: { fuelC: fuel.id, outC: out.id, burn: 0, queue: [] } };
  r.entities[e.id] = e; markDirty(); return e;
}
function allStacks(gs: GameState) {
  const r = gs.run!;
  return [...Object.values(r.custody).flatMap(c => c.slots.filter(s => s !== null)), ...Object.values(r.entities).flatMap(e => (e.station?.queue || []).flatMap(j => j.reserved || []))];
}
function physical(gs: GameState, key: string) { return allStacks(gs).filter(s => s.key === key).reduce((n, s) => n + s.qty, 0); }
const act = (gs: GameState, type: string, payload: object = {}, intentId = id()) => dispatch(gs, { id: intentId, type, ...payload }, T0 + 10);

const memoryStorage = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, String(v)); }, removeItem: (k: string) => map.delete(k), clear: () => map.clear(), map };
};
afterEach(() => vi.unstubAllGlobals());

describe('B1 station reservation and conservation', () => {
  it('reclaim preserves paid inputs and filled output exactly without partial-refund duplication', () => {
    const gs = fresh(), r = gs.run!, e = station(gs, 'workbench'); r.knowledge.recipes.push('leather_armor');
    addItem(r, 'inv', 'leather', 5); addItem(r, 'inv', 'rope', 2);
    expect(act(gs, 'craft', { eid: e.id, recipe: 'leather_armor' }).ok).toBe(true);
    const out = C(r, e.station!.outC); addItem(r, out.id, 'leather', 29); for (let i = 0; i < 5; i++) addItem(r, out.id, 'stone_axe', 1);
    const before = physical(gs, 'leather'), beforeRope = physical(gs, 'rope');
    expect(act(gs, 'reclaim', { eid: e.id }).ok).toBe(true);
    expect(physical(gs, 'leather')).toBe(before); expect(physical(gs, 'rope')).toBe(beforeRope);
    const bag = Object.values(r.entities).find(x => x.kind === 'bag' && x.label === 'Reclaimed contents')!;
    expect(C(r, bag.c!).slots.filter(s => s?.key === 'leather').reduce((n, s) => n + s!.qty, 0)).toBe(34);
  });
  it('cancel refunds exact partially paid stack plus full-inventory drops, and replay does not duplicate', () => {
    const gs = fresh(), r = gs.run!, e = station(gs, 'workbench'); r.knowledge.recipes.push('leather_armor');
    addItem(r, 'inv', 'leather', 10); addItem(r, 'inv', 'rope', 2);
    expect(act(gs, 'craft', { eid: e.id, recipe: 'leather_armor' }).ok).toBe(true);
    const job = e.station!.queue[0], uids = job.reserved!.map(s => s.uid);
    while (C(r, 'inv').slots.includes(null)) addItem(r, 'inv', 'stone_axe', 1);
    const before = physical(gs, 'leather'), beforeRope = physical(gs, 'rope'); const intent = id();
    expect(act(gs, 'cancelJob', { eid: e.id, jobId: job.id }, intent).ok).toBe(true);
    expect(act(gs, 'cancelJob', { eid: e.id, jobId: job.id }, intent)).toMatchObject({ ok: false, dup: true });
    expect(physical(gs, 'leather')).toBe(before); expect(physical(gs, 'rope')).toBe(beforeRope);
    expect(uids.every(uid => allStacks(gs).some(s => s.uid === uid))).toBe(true);
    expect(Object.values(r.entities).some(x => x.kind === 'drop' && uids.includes(C(r, x.c!).slots[0]!.uid))).toBe(true);
  });
  it('research reserves actual spares and charged Core identity, returning or consuming once', () => {
    const gs = fresh(), r = gs.run!, e = station(gs, 'research'); addItem(r, 'inv', 'spares', 9);
    expect(act(gs, 'research', { mode: 'directed', recipe: 'bow', eid: e.id }).ok).toBe(true);
    const paid = e.station!.queue[0].reserved![0]; expect(paid.key).toBe('spares'); expect(paid.qty).toBe(9);
    expect(act(gs, 'cancelJob', { eid: e.id, jobId: e.station!.queue[0].id }).ok).toBe(true);
    expect(allStacks(gs).find(s => s.uid === paid.uid)).toEqual(paid);
    addItem(r, 'inv', 'core_fire', 1); const slot = C(r, 'inv').slots.findIndex(s => s?.key === 'core_fire'); const core = C(r, 'inv').slots[slot]!; core.charge = 1; const expected = { ...core };
    expect(act(gs, 'research', { mode: 'specimen', slot, eid: e.id }).ok).toBe(true);
    expect(e.station!.queue[0].reserved![0]).toEqual(expected);
    const restored = JSON.parse(JSON.stringify(gs)) as GameState;
    const re = restored.run!.entities[e.id]; expect(act(restored, 'cancelJob', { eid: e.id, jobId: re.station!.queue[0].id }).ok).toBe(true);
    expect(allStacks(restored).filter(s => s.uid === expected.uid)).toEqual([expected]);
    expect(act(gs, 'research', { mode: 'specimen', slot, eid: e.id }).ok).toBe(false); // input is in the reservation, not duplicated
    stepStations(gs, 30000, T0 + 30000); expect(allStacks(gs).some(s => s.uid === expected.uid)).toBe(false);
    expect(C(r, e.station!.outC).slots.some(s => s?.key === 'blueprint' && s.meta === 'core_fire')).toBe(true);
  });
  it('reserves and refunds random research payment even if inventory is full', () => {
    const gs = fresh(), r = gs.run!, e = station(gs, 'research'); addItem(r, 'inv', 'spares', 18);
    const before = physical(gs, 'spares'); expect(act(gs, 'research', { mode: 'random', eid: e.id }).ok).toBe(true);
    const job = e.station!.queue[0], reservation = job.reserved![0]; expect(reservation.qty).toBe(BAL.research.randomSparesCost);
    while (C(r, 'inv').slots.includes(null)) addItem(r, 'inv', 'stone_axe', 1);
    expect(act(gs, 'cancelJob', { eid: e.id, jobId: job.id }).ok).toBe(true);
    expect(physical(gs, 'spares')).toBe(before); expect(allStacks(gs).filter(s => s.uid === reservation.uid)).toEqual([reservation]);
  });
  it('station destruction bags paid instances; unknown legacy jobs survive and can resume without invented refunds', () => {
    const gs = fresh(), r = gs.run!, e = station(gs, 'research'); addItem(r, 'inv', 'core_fire', 1);
    const slot = C(r, 'inv').slots.findIndex(s => s?.key === 'core_fire'), core = { ...C(r, 'inv').slots[slot]! };
    expect(act(gs, 'research', { mode: 'specimen', slot, eid: e.id }).ok).toBe(true);
    e.station!.queue.push({ id: id(), recipe: 'R:bow', left: 1000, total: 25000 });
    expect(act(gs, 'reclaim', { eid: e.id }).ok).toBe(false);
    expect(act(gs, 'cancelJob', { eid: e.id, jobId: e.station!.queue[1].id }).ok).toBe(false);
    const bag = destroyStructure(r, e, T0)!;
    expect(C(r, bag.c!).slots.some(s => s?.uid === core.uid)).toBe(true);
    expect(bag.legacyJobs!.queue).toHaveLength(1); expect(bag.legacyJobs!.queue[0].reserved).toBeUndefined(); expect(validate(gs)).toBeTruthy();
    const newStation = station(gs, 'research');
    expect(act(gs, 'recoverLegacyJobs', { eid: bag.id, stationId: newStation.id }).ok).toBe(true);
    expect(bag.legacyJobs).toBeUndefined(); expect(newStation.station!.queue).toHaveLength(1);
    stepStations(gs, 1000, T0 + 1000); expect(C(r, newStation.station!.outC).slots.some(s => s?.meta === 'bow')).toBe(true);
    expect(allStacks(gs).filter(s => s.uid === core.uid)).toEqual([core]);
  });
});

describe('B1 command boundary', () => {
  it('rejects invalid indexes, quantities, self-moves, swaps into readonly containers and unowned/remote access without mutation', () => {
    const gs = fresh(), r = gs.run!, e = station(gs, 'workbench'); addItem(r, 'inv', 'wood', 10); const slot = C(r, 'inv').slots.findIndex(s => s?.key === 'wood');
    const output = C(r, e.station!.outC); addItem(r, output.id, 'stone', 1);
    const cases = [
      { type: 'move', from: 'inv', fs: slot, to: output.id },
      { type: 'move', from: 'inv', fs: slot, to: 'inv', ts: slot },
      ...[0, -1, 1.1, NaN, Infinity, 11].map(qty => ({ type: 'move', from: 'inv', fs: slot, to: e.station!.fuelC, qty })),
      ...[-1, 24, 0.5, NaN].map(fs => ({ type: 'move', from: 'inv', fs, to: e.station!.fuelC })),
      { type: 'move', from: output.id, fs: 0, to: 'inv', ts: slot },
      { type: 'useItem', c: '__proto__', slot: 0 },
      { type: 'split', c: 'inv', slot: -1 },
      { type: 'qaAdvance', hours: NaN },
      { type: 'build', struct: 'toString', tx: 1, ty: 1 },
    ];
    for (const c of cases) { const before = JSON.stringify(gs); expect(act(gs, c.type, c).ok, JSON.stringify(c)).toBe(false); expect(JSON.stringify(gs)).toBe(before); }
    e.owner = 'someone-else'; for (const c of [{ type: 'sort', c: output.id }, { type: 'split', c: output.id, slot: 0 }, { type: 'useItem', c: output.id, slot: 0 }, { type: 'reclaim', eid: e.id }]) { const before = JSON.stringify(gs); expect(act(gs, c.type, c).ok).toBe(false); expect(JSON.stringify(gs)).toBe(before); }
    e.owner = undefined; e.x += 500; expect(act(gs, 'sort', { c: output.id }).ok).toBe(false);
  });
  it('keeps stateful stack metadata and unique ids through partial move, sorting and a swap', () => {
    const gs = fresh(), r = gs.run!; addItem(r, 'inv', 'torch', 2); const a = C(r, 'inv').slots.findIndex(s => s?.key === 'torch'); C(r, 'inv').slots[a]!.dur = 13;
    expect(act(gs, 'move', { from: 'inv', fs: a, to: 'inv', ts: 10, qty: 1 }).ok).toBe(true);
    const first = C(r, 'inv').slots[a]!, second = C(r, 'inv').slots[10]!; expect(second.dur).toBe(13); expect(second.uid).not.toBe(first.uid);
    expect(act(gs, 'sort', { c: 'inv' }).ok).toBe(true);
    expect(C(r, 'inv').slots.filter(s => s?.key === 'torch').map(s => s!.uid).sort()).toEqual([first.uid, second.uid].sort());
  });
  it('returns the original deployable kit instance and metadata on packing', () => {
    const gs = fresh(), r = gs.run!, p = r.player; addItem(r, 'inv', 'cart_kit', 1);
    addItem(r, 'inv', 'cart_kit', 1); const slot = C(r, 'inv').slots.map((s, i) => s?.key === 'cart_kit' ? i : -1).filter(i => i >= 0).pop()!; const kit = C(r, 'inv').slots[slot]!; p.active = slot; kit.meta = 'kept metadata'; const expected = { ...kit };
    const before = JSON.stringify(gs); expect(act(gs, 'placeCart', { x: NaN, y: p.y }).ok).toBe(false); expect(JSON.stringify(gs)).toBe(before);
    expect(act(gs, 'placeCart', { x: p.x + 4, y: p.y + 4 }).ok).toBe(true);
    const cart = Object.values(r.entities).find(e => e.kind === 'cart')!; expect(cart.deployed).toEqual(expected); expect(validate(gs)).toBeTruthy();
    expect(act(gs, 'reclaim', { eid: cart.id }).ok).toBe(true);
    expect(C(r, 'inv').slots.filter(s => s?.uid === expected.uid)).toEqual([expected]);
  });
  it('conserves items across many legal partial inventory moves and rejected malformed moves', () => {
    const gs = fresh(), r = gs.run!; addItem(r, 'inv', 'wood', 30);
    const inv = C(r, 'inv'), before = countItem(r, 'inv', 'wood');
    for (let n = 0; n < 100; n++) {
      const from = inv.slots.findIndex(s => s?.key === 'wood'); const to = inv.slots.findIndex((s, i) => !s && i !== from);
      if (to >= 0 && inv.slots[from]!.qty > 1) expect(act(gs, 'move', { from: 'inv', fs: from, to: 'inv', ts: to, qty: 1 }).ok).toBe(true);
      const malformed = JSON.stringify(gs); expect(act(gs, 'move', { from: 'inv', fs: from, to: 'inv', ts: 1000, qty: 1 }).ok).toBe(false); expect(JSON.stringify(gs)).toBe(malformed);
      expect(countItem(r, 'inv', 'wood')).toBe(before);
      expect(act(gs, 'sort', { c: 'inv' }).ok).toBe(true); expect(countItem(r, 'inv', 'wood')).toBe(before);
    }
    expect(validate(gs)).toBeTruthy();
  });
  it('rejects replay of profile-changing intent after a run transition', () => {
    const gs = fresh(), original = id(); expect(act(gs, 'abandon', {}, original).ok).toBe(true);
    expect(act(gs, 'startRun', { character: 'female', region: 1, seed: 102 }).ok).toBe(true);
    const before = JSON.stringify(gs); expect(act(gs, 'abandon', {}, original)).toMatchObject({ ok: false, dup: true }); expect(JSON.stringify(gs)).toBe(before);
  });
});

describe('B1 snapshots and recovery', () => {
  it('orders meaningful snapshots even when no dispatch occurred, and rejects equal-sequence divergent copies', () => {
    const gs = fresh(); expect(validate(gs)).toBeTruthy(); const older = serializeSnapshot(gs); gs.run!.player.hunger -= 5; const newer = serializeSnapshot(gs);
    expect(selectSnapshots([older, newer]).gs!.run!.player.hunger).toBe(gs.run!.player.hunger);
    const a = JSON.parse(JSON.stringify(gs)), b = JSON.parse(JSON.stringify(gs)); b.run.player.hunger -= 1;
    expect(selectSnapshots([JSON.stringify(a), JSON.stringify(b)])).toMatchObject({ gs: null, conflict: true });
  });
  it('rejects damaged, unsupported, duplicate UID and dangling custody records', () => {
    const gs = fresh(), text = serializeSnapshot(gs), badChecksum = JSON.parse(text); badChecksum.payload += ' ';
    const v = JSON.parse(JSON.stringify(gs)); v.run.custody.inv.slots[3] = { ...v.run.custody.inv.slots[0] };
    const d = JSON.parse(JSON.stringify(gs)); d.run.entities[Object.keys(d.run.entities).find(k => d.run.entities[k].c)!].c = 'missing';
    expect(validate(v)).toBeNull(); expect(validate(d)).toBeNull();
    expect(selectSnapshots([JSON.stringify(badChecksum), text]).bad).toEqual([0]);
    const future = JSON.parse(JSON.stringify(gs)); future.version += 1;
    expect(selectSnapshots([text, JSON.stringify(future)])).toMatchObject({ gs: null, unsupported: true });
  });
  it('preserves compatible old run data and rejects incomplete migration on load', async () => {
    const gs = fresh(), older = JSON.parse(JSON.stringify(gs)); older.version -= 1;
    const m = migrate(older); expect(m.gs!.run!.custody.inv).toEqual(gs.run!.custody.inv);
    const storage = memoryStorage(); storage.setItem('soh.state.v3', JSON.stringify({ version: 2, revision: 99, profile: { securedCash: 2 }, run: { custody: {} } })); vi.stubGlobal('localStorage', storage);
    const result = await load(); expect(result.gs).toBeNull(); expect(storage.getItem('soh.state.v3')).not.toBeNull();
  });
  it('quarantines a corrupt copy before selecting a valid one and never overwrites a sole bad copy', async () => {
    const storage = memoryStorage(); vi.stubGlobal('localStorage', storage);
    storage.setItem('soh.state.v3', '{bad'); expect((await load()).gs).toBeNull(); expect(storage.getItem('soh.state.v3')).toBe('{bad');
    const gs = fresh(); expect(await save(gs)).toBe(true); gs.run!.player.hunger = 12; expect(saveSync(gs)).toBe(true);
    const result = await load(); expect(result.gs!.run!.player.hunger).toBe(12);
  });
});

describe('B1 offline shelter causes', () => {
  function shelter() { const gs = fresh(), r = gs.run!, b = getWorld().buildings.find(b => b.id === 'b_tp')!; r.player.x = (b.x + 2) * TILE + 8; r.player.y = (b.y + 2) * TILE + 8; r.player.hp = 1; r.clock.lastSimAt = T0; for (let y=b.y;y<b.y+b.h;y++) for(let x=b.x;x<b.x+b.w;x++) if(x===b.x||y===b.y||x===b.x+b.w-1||y===b.y+b.h-1) r.terrain[y*WW+x]={t:T.PWALL}; markDirty(); return gs; }
  it('only hunger is floored; thirst alone and hunger with thirst are lethal with one bag', () => {
    const h = shelter(); h.run!.player.hunger = 0; h.run!.player.thirst = 100; settle(h, T0 + 60000); expect(h.run!.player.dead).toBe(false); expect(h.run!.player.hp).toBe(1);
    for (const hunger of [0, 100]) { const g = shelter(); g.run!.player.hunger = hunger; g.run!.player.thirst = 0; settle(g, T0 + 60000); settle(g, T0 + 2 * 60000); expect(g.run!.player.dead).toBe(true); expect(Object.values(g.run!.entities).filter(e => e.kind === 'bag')).toHaveLength(1); }
  });  it('radiation remains lethal under shelter and an empty inventory still yields one death bag', () => {
    const gs = shelter(), r = gs.run!, w = getWorld(), tx = Math.floor(r.player.x / TILE), ty = Math.floor(r.player.y / TILE), idx = ty * WW + tx, old = w.zone[idx];
    try { w.zone[idx] = 7; r.player.rad = 100; r.player.hunger = 0; r.player.thirst = 100; C(r, 'inv').slots.fill(null); C(r, 'eq').slots.fill(null);
      settle(gs, T0 + 60000); settle(gs, T0 + 120000);
      expect(r.player.dead).toBe(true); expect(Object.values(r.entities).filter(e => e.kind === 'bag')).toHaveLength(1); expect(validate(gs)).toBeTruthy();
    } finally { w.zone[idx] = old; }
  });

});
