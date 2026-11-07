// B05-R P0-A/P0-C: legal full-pack fixture, deliberately invalid over-max fixture, and bounded save diagnostics.
// The localStorage double is a test stand-in (Node has none). IndexedDB is absent in Node, so the idb-init path is the real outcome here.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { type GameState } from '../src/game/core';
import { C, dispatch, newGame } from '../src/game/engine';
import { ITEMS } from '../src/game/catalog';
import { setActiveLayout } from '../src/game/world';
import { serializeSnapshot, validate, saveDetailed, diagnoseInvalidState, lastSaveOutcome } from '../src/game/persist';
import { qaPrepareFullPack } from '../src/game/qa-fixtures';

const T = Date.UTC(2026, 10, 7);
type Store = { data: Record<string, string>; setItem: (k: string, v: string) => void; getItem: (k: string) => string | null; removeItem: (k: string) => void; writes: number };
let store: Store;
const realLS = (globalThis as any).localStorage;
beforeEach(() => {
  store = { data: {}, writes: 0,
    setItem(k, v) { this.writes++; this.data[k] = v; }, getItem(k) { return this.data[k] ?? null; }, removeItem(k) { delete this.data[k]; } };
  (globalThis as any).localStorage = store;
});
afterEach(() => { (globalThis as any).localStorage = realLS; setActiveLayout('shipping'); });

function run(): GameState {
  setActiveLayout('shipping_fresh');
  const g = newGame(); dispatch(g, { id: 'start', type: 'startRun', character: 'female', seed: 131 }, T);
  g.run!.creatures = [];
  return g;
}

describe('P0-A legal full-pack fixture', () => {
  it('fills all 24 pack slots with stacks that respect ITEMS[key].max and unique UIDs; validate and serialize pass', () => {
    const g = run(); const r = g.run!;
    const fill = qaPrepareFullPack(r);
    expect(fill).toEqual({ filled: 24, total: 24 });
    const stacks = C(r, 'inv').slots.filter(Boolean)!;
    for (const s of stacks) expect(s.qty).toBeLessThanOrEqual(ITEMS[s.key].max);
    expect(new Set(stacks.map(s => s.uid)).size).toBe(stacks.length);
    expect(validate(g)).not.toBeNull();
    expect(() => serializeSnapshot(g)).not.toThrow();
  });
  it('a valid full-pack save is written and reads back exactly', async () => {
    const g = run(); qaPrepareFullPack(g.run!);
    const o = await saveDetailed(g);
    expect(o.ok).toBe(true); expect(o.category).toBe('ok'); expect(o.localStatus).toBe('ok');
    expect(store.data['soh.state.v3']).toBeTruthy();
    expect(store.data['soh.state.v3']).toContain(g.run!.id);
  });
});

describe('P0-A deliberately invalid over-max fixture (must be rejected before any write)', () => {
  it('stone at qty 99 is rejected, classified by invariant only, and the previous valid save is untouched', async () => {
    const g = run(); qaPrepareFullPack(g.run!);
    const good = await saveDetailed(g); expect(good.ok).toBe(true);
    const before = store.data['soh.state.v3']; const writesBefore = store.writes;
    const slot = C(g.run!, 'inv').slots.findIndex(s => s?.key === 'stone');
    C(g.run!, 'inv').slots[slot]!.qty = 99;                       // ITEMS.stone.max is 60
    expect(validate(g)).toBeNull();
    expect(diagnoseInvalidState(g)).toBe('over-max:stone');
    expect(() => serializeSnapshot(g)).toThrow('Refusing to save invalid game state.');
    const o = await saveDetailed(g);
    expect(o.ok).toBe(false); expect(o.category).toBe('invalid-state'); expect(o.invariant).toBe('over-max:stone');
    expect(store.writes).toBe(writesBefore);                      // nothing written
    expect(store.data['soh.state.v3']).toBe(before);              // previous valid snapshot intact
    expect(JSON.stringify(lastSaveOutcome())).not.toContain('fixture');  // no payload in diagnostics
  });
});

describe('P0-C bounded save diagnostics', () => {
  it('localStorage write failure is classified as local-write (not a generic failure)', async () => {
    const g = run(); qaPrepareFullPack(g.run!);
    store.setItem = () => { throw new Error('QuotaExceededError'); };
    const o = await saveDetailed(g);
    expect(o.localStatus).toBe('local-write');
    expect(o.ok).toBe(false);
    expect(o.category).toBe('idb-init');   // Node has no IndexedDB: the primary failure reported is the database, both are in the outcome
  });
  it('a readback mismatch is classified as readback-conflict', async () => {
    const g = run(); qaPrepareFullPack(g.run!);
    store.getItem = () => 'something else';
    const o = await saveDetailed(g);
    expect(o.localStatus).toBe('readback-conflict');
  });
  it('outcomes carry categories and revisions, never a snapshot payload', async () => {
    const g = run(); qaPrepareFullPack(g.run!);
    await saveDetailed(g);
    const out = JSON.stringify(lastSaveOutcome());
    expect(out).not.toContain(g.run!.id);
    expect(out).not.toMatch(/"uid"/);
  });
});
