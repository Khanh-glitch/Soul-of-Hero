import { afterEach, describe, expect, it } from 'vitest';
import { TILE, WW, type GameState } from '../src/game/core';
import { C, dispatch, newGame } from '../src/game/engine';
import { getWorld, setActiveLayout } from '../src/game/world';
import { serializeSnapshot, validate } from '../src/game/persist';
import legacyShipping from './fixtures/7b9805b2-shipping-v3.json';

const T = Date.UTC(2026, 10, 4); let serial = 0;
const act = (g: GameState, type: string, payload: object = {}, id = `loot-${++serial}`) => dispatch(g, { id, type, ...payload }, T + serial + 1);
function fixture() {
  setActiveLayout('shipping_fresh');
  const g = newGame(); expect(act(g, 'startRun', { character: 'female', seed: 99 }).ok).toBe(true);
  const r = g.run!, e = Object.values(r.entities).find(e => e.kind === 'loot' && e.poi === 'tp' && C(r,e.c!).slots.some(s => s?.meta === 'bow'))!;
  expect(e).toBeTruthy(); r.player.x = e.x; r.player.y = e.y + TILE; // controlled proximity fixture, not player-route evidence
  return { g, r, e, c: C(r, e.c!) };
}
const saveRoundTrip = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
afterEach(() => setActiveLayout('shipping'));

describe('authored public loot custody and retirement', () => {
  it('rejects deposit, auto-merge and swap without mutation; partial withdrawal persists with remaining original UIDs', () => {
    const { g, r, e, c } = fixture();
    const initial = structuredClone(c.slots); const knife = C(r, 'inv').slots.findIndex(s => s?.key === 'knife');
    for (const args of [{ from: 'inv', fs: knife, to: c.id }, { from: 'inv', fs: knife, to: c.id, ts: 4 }, { from: c.id, fs: 0, to: 'inv', ts: knife }]) {
      const before = JSON.stringify(g); expect(act(g, 'move', args).ok).toBe(false); expect(JSON.stringify(g)).toBe(before);
    }
    expect(act(g, 'move', { from: c.id, fs: 0, to: 'inv', qty: 2 }).ok).toBe(true);
    expect(c.slots[0]?.qty).toBe(initial[0]!.qty - 2); expect(c.slots[0]?.uid).toBe(initial[0]!.uid);
    const copy = saveRoundTrip(g); expect(validate(copy)).toBeTruthy(); expect(copy.run!.entities[e.id]).toBeTruthy();
    expect(copy.run!.custody[c.id].slots).toEqual(c.slots); expect(copy.run!.depletedLootSites).toBeUndefined();
  });
  it('retires exactly once on final withdrawal, preserves inventory through save, and rejects forged or duplicate site claims', () => {
    const { g, r, e, c } = fixture(), site = e.ty! * WW + e.tx!, originals = c.slots.filter(Boolean).map(s => ({ ...s! }));
    const occupied = c.slots.map((s, i) => s ? i : -1).filter(i => i >= 0);
    const last = occupied.pop()!;
    for (const i of occupied) expect(act(g, 'move', { from: c.id, fs: i, to: 'inv' }).ok).toBe(true);
    const finalIntent = 'same-withdrawal';
    expect(act(g, 'move', { from: c.id, fs: last, to: 'inv' }, finalIntent).ok).toBe(true);
    expect(r.entities[e.id]).toBeUndefined(); expect(r.custody[c.id]).toBeUndefined(); expect(r.depletedLootSites).toEqual([site]);
    expect(r.receipts.filter(x => x.kind === 'loot.depleted')).toHaveLength(1);
    for (const s of originals) expect(C(r, 'inv').slots.some(x => x?.key === s.key)).toBe(true);
    const after = JSON.stringify(g); expect(act(g, 'move', { from: c.id, fs: last, to: 'inv' }, finalIntent)).toMatchObject({ ok: false, dup: true }); expect(JSON.stringify(g)).toBe(after);
    const copy = saveRoundTrip(g); expect(validate(copy)).toBeTruthy(); expect(copy.run!.depletedLootSites).toEqual([site]);
    expect(act(copy, 'move', { from: c.id, fs: last, to: 'inv' }, finalIntent)).toMatchObject({ ok: false, dup: true });
    const duplicateSite = structuredClone(copy); duplicateSite.run!.depletedLootSites!.push(site); expect(validate(duplicateSite)).toBeNull();
    const forged = structuredClone(copy); forged.run!.depletedLootSites!.push(0); expect(validate(forged)).toBeNull();
    const phantom = structuredClone(copy); phantom.run!.depletedLootSites = []; expect(validate(phantom)).toBeNull();
    const live = fixture(); const original = structuredClone(live.g); original.run!.depletedLootSites = [live.e.ty! * WW + live.e.tx!]; expect(validate(original)).toBeNull();
  });
  it('does not retire cash, chests, partial loot, or assume that legacy empty containers were respawned', () => {
    const { g, r, e, c } = fixture();
    const last = c.slots.findIndex(Boolean); expect(act(g, 'move', { from: c.id, fs: last, to: 'inv' }).ok).toBe(true);
    expect(r.entities[e.id]).toBeTruthy(); expect(r.depletedLootSites).toBeUndefined();
    const legacy = structuredClone(g); legacy.run!.custody[c.id].slots.fill(null); expect(validate(legacy)).toBeTruthy();
    const snap = saveRoundTrip(legacy); expect(snap.run!.entities[e.id]).toBeTruthy(); expect(snap.run!.depletedLootSites).toBeUndefined();
    const cash = getWorld('shipping_fresh').statics.find(s => s.kind === 'cash')!;
    expect(Object.values(snap.run!.entities).some(x => x.kind === 'cash' && x.tx === cash.tx && x.ty === cash.ty)).toBe(true);
  });
  it('preserves a real historical Shipping save with and without the old map digest while retiring its own authored starter crate', () => {
    for (const withDigest of [true, false]) {
      setActiveLayout('shipping');
      const g = structuredClone(legacyShipping.save) as GameState, r = g.run!;
      if (!withDigest) delete (r.sourceMap as any).mapDigest;
      expect(validate(structuredClone(g))).toBeTruthy();
      const e = Object.values(r.entities).find(x => x.kind === 'loot' && x.poi === 's0')!, c = C(r, e.c!);
      r.player.x = e.x; r.player.y = e.y; // controlled proximity only
      for (let i = 0; i < c.slots.length; i++) if (c.slots[i]) expect(act(g, 'move', { from: c.id, fs: i, to: 'inv' }).ok).toBe(true);
      expect(r.entities[e.id]).toBeUndefined(); expect(r.depletedLootSites).toEqual([e.ty! * WW + e.tx!]);
      expect(validate(saveRoundTrip(g))).toBeTruthy();
    }
  });
  it('retires a final item consumed or dropped directly from public custody', () => {
    for (const mode of ['useItem', 'drop'] as const) {
      const { g, r, e, c } = fixture();
      // Remove other slots with normal transactions, then learn or drop the last blueprint.
      for (const i of [0, 1]) expect(act(g, 'move', { from: c.id, fs: i, to: 'inv' }).ok).toBe(true);
      if (mode === 'useItem') expect(act(g, 'useItem', { c: c.id, slot: 2 }).ok).toBe(true);
      else expect(act(g, 'drop', { c: c.id, slot: 2 }).ok).toBe(true);
      expect(r.entities[e.id]).toBeUndefined(); expect(r.depletedLootSites).toContain(e.ty! * WW + e.tx!); expect(validate(saveRoundTrip(g))).toBeTruthy();
    }
  });
});
