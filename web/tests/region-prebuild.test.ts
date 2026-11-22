// Regions compiled ahead of need on another thread must answer exactly like regions compiled on the game thread,
// in whatever order either side compiles them. The pack hop is simulated with structuredClone + transfer, which is
// what postMessage does. Also pins the request policy and the autosave timing rule.
import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../src/game/core';
import { regionsWanted } from '../src/veyra05/region-demand';
import { layoutIdAt } from '../src/veyra05/scenes';
import { autosaveDecision, AUTOSAVE_MAX_MS, AUTOSAVE_MIN_MS, AUTOSAVE_STILL_MS } from '../src/game/autosave-policy';

type WindowModule = typeof import('../src/veyra05/window');
const freshWindowModule = async (): Promise<WindowModule> => { vi.resetModules(); return await import('../src/veyra05/window'); };

describe('prebuilt regions', () => {
  it('answer exactly like regions compiled on the game thread', async () => {
    const origins: [number, number][] = [[2048, 1600], [1472, 1088], [2496, 576]];
    const ids = origins.map(([x, y]) => layoutIdAt(x, y));
    // "Worker": its own module state, compiles in the opposite order after an unrelated region.
    const worker = await freshWindowModule();
    worker.compileGeometryRegionPack(layoutIdAt(1536, 1024), 4);
    const packs = new Map([...ids].reverse().map(id => {
      const pack = worker.compileGeometryRegionPack(id, 4), buffers = worker.geometryRegionPackBuffers(pack);
      const arrived = structuredClone(pack, { transfer: buffers });
      expect(buffers.length).toBeGreaterThan(8);
      expect(buffers.every(b => b.byteLength === 0)).toBe(true);          // really moved, not copied
      // The worker's own caches survive handing a pack over: compiling the same region again gives the same pack.
      expect(structuredClone(worker.compileGeometryRegionPack(id, 4))).toEqual(arrived);
      return [id, arrived] as const;
    }));
    const prebuilt = await freshWindowModule(); let served = 0;
    prebuilt.setPrebuiltRegionSource((id, rules) => { const pack = rules === 4 ? packs.get(id) : undefined; if (pack) served++; return pack; });
    const local = await freshWindowModule();
    let cells = 0, sources = 0;
    for (const [ox, oy] of origins) for (const floor of [0, -1, 1, 2, 3]) {
      for (let gy = oy + 64; gy < oy + 136; gy += 2) for (let gx = ox + 64; gx < ox + 136; gx += 2) {
        const a = prebuilt.globalBaseGeometry(gx, gy, floor, 4), b = local.globalBaseGeometry(gx, gy, floor, 4);
        if (JSON.stringify(a) !== JSON.stringify(b)) expect(a).toEqual(b);
        cells++; if (b?.source) sources++;
      }
      const any = new Set(['tree', 'rock', 'bush', 'scrap_heap', 'ore_vein', 'reed', 'clay_bank', 'berry_bush']);
      for (let k = 0; k < 12; k++) { const gx = ox + 70 + (k * 37) % 60, gy = oy + 70 + (k * 53) % 60; expect(prebuilt.globalSourceCandidates(gx, gy, floor, 4, any)).toEqual(local.globalSourceCandidates(gx, gy, floor, 4, any)); }
    }
    expect(served).toBe(3);                    // one pack per region; missing floors do not ask again for a compiled floor
    expect(cells).toBeGreaterThan(15000); expect(sources).toBeGreaterThan(200);
    expect(prebuilt.hasGeometryRegion(ids[0], 4)).toBe(true);
    expect(prebuilt.geometryRegionCount()).toBe(local.geometryRegionCount());
  }, 600000);
});

describe('region demand', () => {
  const person = (gx: number, gy: number, state = 'IDLE') => ({ gx, gy, floor: 0, state });
  const run = (people: Record<string, unknown>) => ({ humanWorld: { people } } as unknown as RunState);
  it('asks for the region under each living resident first, then close neighbours nearest first', () => {
    // Region origin (1024, 1024) answers for tiles 1092..1155 on each axis.
    const w = regionsWanted(run({ a: person(1120, 1120), b: person(1094, 1120), c: person(3000, 2000, 'DEAD'), d: person(1150, 1153) }));
    expect(w.urgent).toEqual([layoutIdAt(1024, 1024)]);
    // b stands 3 tiles from the western region, d 3 tiles from the southern and 6 from the eastern one.
    expect(w.nearby.slice(0, 3)).toEqual([layoutIdAt(960, 1024), layoutIdAt(1024, 1088), layoutIdAt(1088, 1024)]);
    expect(w.nearby).toContain(layoutIdAt(1088, 1088));
    expect(w.nearby).not.toContain(layoutIdAt(1024, 960));   // nobody within reach of the northern region
    expect(w.nearby).not.toContain(layoutIdAt(1024, 1024));
  });
  it('has nothing to ask without residents', () => {
    expect(regionsWanted({} as RunState)).toEqual({ urgent: [], nearby: [] });
    expect(regionsWanted(run({ x: person(10, 10, 'EVACUATED') }))).toEqual({ urgent: [], nearby: [] });
  });
});

describe('autosave timing', () => {
  const moving = { sinceLastMs: AUTOSAVE_MIN_MS + 1, panelOpen: false, deadOrResting: false, stillMs: 0, threatNear: false };
  it('waits while the player moves or fights, but never past the limit', () => {
    expect(autosaveDecision(moving)).toBe('wait');
    expect(autosaveDecision({ ...moving, sinceLastMs: AUTOSAVE_MAX_MS })).toBe('wait');
    expect(autosaveDecision({ ...moving, sinceLastMs: AUTOSAVE_MAX_MS + 1 })).toBe('light');
    expect(autosaveDecision({ ...moving, stillMs: AUTOSAVE_STILL_MS, threatNear: true })).toBe('wait');
  });
  it('saves at a quiet moment, and never more often than before', () => {
    expect(autosaveDecision({ ...moving, panelOpen: true })).toBe('full');
    expect(autosaveDecision({ ...moving, deadOrResting: true })).toBe('full');
    expect(autosaveDecision({ ...moving, stillMs: AUTOSAVE_STILL_MS })).toBe('light');
    expect(autosaveDecision({ ...moving, sinceLastMs: AUTOSAVE_MIN_MS, panelOpen: true })).toBe('wait');
  });
});
