import { afterEach, expect, it, vi } from 'vitest';
import { dispatch, markDirty, newGame } from '../src/game/engine';

function fakeStorage() {
  const map = new Map<string, string>(); let failWrites = false;
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { if (failWrites) throw Error('quota'); map.set(k, v); }, removeItem: (k: string) => map.delete(k), fail: (v: boolean) => { failWrites = v; } };
}
function fakeIDB() {
  const state: { value: string | null; failWrite: boolean; failRead: boolean } = { value: null, failWrite: false, failRead: false };
  const database = { transaction: (_store: string, mode: string) => {
    const tx: any = { objectStore: () => ({
      get: () => { const rq: any = {}; queueMicrotask(() => { if (state.failRead) rq.onerror?.(); else { rq.result = state.value; rq.onsuccess?.(); } }); return rq; },
      put: (v: string) => { queueMicrotask(() => { if (state.failWrite) tx.onabort?.(); else { state.value = v; tx.oncomplete?.(); } }); },
      delete: () => { queueMicrotask(() => { state.value = null; tx.oncomplete?.(); }); },
    }) };
    return tx;
  } };
  const indexedDB = { open: () => { const rq: any = { result: database }; queueMicrotask(() => rq.onsuccess?.()); return rq; } };
  return { state, indexedDB };
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
it('selects latest local snapshot after an interrupted IDB write, quarantines corrupt bytes, and reports dual-write failure', async () => {
  const local = fakeStorage(), idb = fakeIDB(); vi.stubGlobal('localStorage', local); vi.stubGlobal('indexedDB', idb.indexedDB);
  const p = await import('../src/game/persist');
  const gs = newGame(); markDirty(); expect(dispatch(gs, { id: 'start-storage', type: 'startRun', character: 'male', region: 0, seed: 123 }, 100000).ok).toBe(true);
  idb.state.value = p.serializeSnapshot(gs); gs.run!.player.hunger = 33; expect(p.saveSync(gs)).toBe(true);
  expect((await p.load()).gs!.run!.player.hunger).toBe(33);
  idb.state.value = '{not a snapshot';
  const recovered = await p.load(); expect(recovered.gs!.run!.player.hunger).toBe(33); expect(recovered.note).toContain('quarantined');
  expect([...local.map.entries()].some(([key, value]) => key.startsWith('soh.quarantine.') && value === '{not a snapshot')).toBe(true);
  local.fail(true); gs.run!.player.hunger = 22;
  expect(await p.save(gs)).toBe(true); // IDB succeeds when localStorage is full
  expect((await p.load()).gs!.run!.player.hunger).toBe(22);
  idb.state.failWrite = true; gs.run!.player.hunger = 11;
  expect(await p.save(gs)).toBe(false);
  expect((await p.load()).gs!.run!.player.hunger).toBe(22);
});
it('does not open a new game or overwrite copies when IDB cannot be read', async () => {
  const local = fakeStorage(), idb = fakeIDB(); idb.state.failRead = true;
  local.setItem('soh.state.v3', 'preserve me'); vi.stubGlobal('localStorage', local); vi.stubGlobal('indexedDB', idb.indexedDB);
  const p = await import('../src/game/persist'); const result = await p.load();
  expect(result.gs).toBeNull(); expect(result.note).toContain('could not be read'); expect(local.getItem('soh.state.v3')).toBe('preserve me');
});
