import { describe, it, expect } from 'vitest';
import { chunkOf, globalCellKey, toLocal, crossing, acceptWindow, windowId, GlobalCellStore, PENDING_MAP_FRAME, CHUNK_SIZE } from '../src/game/world-window';

const ID = { mapId: 'test-geo', revision: 3, digest: 'abcd1234' };

describe('B06 world-window seam (pure)', () => {
  it('chunk identity is stable across the boundary and local coords stay inside one window', () => {
    expect(chunkOf(31, 5)).toEqual({ cx: 0, cy: 0 });
    expect(chunkOf(32, 5)).toEqual({ cx: 1, cy: 0 });
    const origin = chunkOf(32, 5);
    expect(toLocal(32, 5, origin)).toEqual({ x: 0, y: 5 });
    expect(toLocal(31, 5, chunkOf(31, 5))).toEqual({ x: 31, y: 5 });
  });
  it('a real player step across the chunk edge is reported as a window change; a step inside is not', () => {
    expect(crossing({ gx: 31, gy: 9 }, { gx: 32, gy: 9 })).toMatchObject({ changed: true, from: { cx: 0, cy: 0 }, to: { cx: 1, cy: 0 } });
    expect(crossing({ gx: 10, gy: 9 }, { gx: 11, gy: 9 }).changed).toBe(false);
  });
  it('global cell keys are collision-free across the pending frame corners and reject out-of-frame cells', () => {
    const { width: W, height: H } = PENDING_MAP_FRAME;
    const keys = new Set([globalCellKey(0, 0), globalCellKey(W - 1, 0), globalCellKey(0, H - 1), globalCellKey(W - 1, H - 1)]);
    expect(keys.size).toBe(4);
    expect(() => globalCellKey(W, 0)).toThrow();
    expect(() => globalCellKey(-1, 0)).toThrow();
    expect(() => chunkOf(1.5, 0)).toThrow();
  });
  it('a depleted resource keeps its depletion after the player leaves and returns (global store, not window-local)', () => {
    const store = new GlobalCellStore();
    store.set(40, 40, { depleted: true });
    const reloaded = GlobalCellStore.fromJSON(JSON.parse(JSON.stringify(store.toJSON())));
    expect(reloaded.get(40, 40)?.depleted).toBe(true);
    expect(reloaded.get(41, 40)).toBeUndefined();
  });
  it('an owned cargo UID keeps its global location across save/reload with no duplicate record', () => {
    const store = new GlobalCellStore();
    store.set(70, 12, { uid: 'cargo-s9i' });
    store.set(70, 12, { depleted: false });
    const json = store.toJSON();
    expect(json).toHaveLength(1);
    const back = GlobalCellStore.fromJSON(json);
    expect(back.get(70, 12)?.uid).toBe('cargo-s9i');
  });
  it('rejects malformed or duplicate persisted cell records instead of silently accepting them', () => {
    expect(() => GlobalCellStore.fromJSON([{ key: -1, depleted: false }])).toThrow();
    expect(() => GlobalCellStore.fromJSON([{ key: 4, depleted: false }, { key: 4, depleted: true }])).toThrow();
  });
  it('a window is accepted only for its authored map id, revision and digest', () => {
    expect(acceptWindow(ID, ID)).toEqual([]);
    expect(acceptWindow(ID, { ...ID, revision: 4 })).toContain('map revision mismatch 4');
    expect(acceptWindow(ID, { ...ID, digest: 'ffff0000' })).toContain('map digest mismatch');
    expect(acceptWindow(ID, { ...ID, mapId: 'other' })).toHaveLength(1);
  });
  it('window ids encode identity and chunk, so two windows never share an id', () => {
    expect(windowId({ cx: 0, cy: 0 }, ID)).not.toBe(windowId({ cx: 1, cy: 0 }, ID));
    expect(CHUNK_SIZE).toBe(32);
  });
});
