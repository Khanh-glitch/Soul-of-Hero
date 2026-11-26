// Regions compiled ahead of need on another thread must answer exactly like regions compiled on the game thread,
// in whatever order either side compiles them. The pack hop is simulated with structuredClone + transfer, which is
// what postMessage does. Also pins the request policy, the title-screen warm-up list and the autosave timing rule.
import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../src/game/core';
import { regionsWanted, residentDistance } from '../src/veyra05/region-demand';
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
  it('asks for a neighbouring region while a resident stands within 24 tiles of it, nearest first', () => {
    // The western region (origin 960) answers for tiles up to 1091: a resident at x stands x - 1091 tiles from it.
    const west = layoutIdAt(960, 1024), north = layoutIdAt(1024, 960);
    expect(regionsWanted(run({ a: person(1091 + 24, 1124) })).nearby).toEqual([west]);
    expect(regionsWanted(run({ a: person(1091 + 25, 1124) })).nearby).toEqual([]);
    // 20 tiles from the western region, 9 from the northern one (which answers up to y = 1091).
    expect(regionsWanted(run({ a: person(1111, 1100) })).nearby).toEqual([north, layoutIdAt(960, 960), west]);
  });
  it('has nothing to ask without residents', () => {
    expect(regionsWanted({} as RunState)).toEqual({ urgent: [], nearby: [] });
    expect(regionsWanted(run({ x: person(10, 10, 'EVACUATED') }))).toEqual({ urgent: [], nearby: [] });
  });
});

describe('title-screen warm-up list', () => {
  it('starts with the regions a new game compiles while it is created, then residents, then their neighbours', async () => {
    try {
      vi.resetModules();
      const list = (await import('../src/veyra05/region-warmup')).newGameRegions();
      const keys = list.map(([id, rules]) => rules + ':' + id);
      expect(new Set(keys).size).toBe(keys.length);                       // each region once
      expect(list.length).toBeGreaterThan(200);
      // Another new game (other seed, other character) on a thread that has compiled nothing yet.
      vi.resetModules();
      const engine = await import('../src/game/engine'), world = await import('../src/game/world');
      const scenes = await import('../src/veyra05/scenes'), win = await import('../src/veyra05/window');
      const demand = await import('../src/veyra05/region-demand');
      const asked: string[] = [];
      win.setPrebuiltRegionSource((id, rules) => { asked.push(rules + ':' + id); return undefined; });
      const gs = engine.newGame(); world.setActiveLayout(scenes.U05_WORLD_LAYOUT_ID);
      expect(engine.startRun(gs, 'male', Date.UTC(2026, 10, 26, 9), null, 7606).ok).toBe(true);
      win.setPrebuiltRegionSource(null);
      expect(asked.length).toBeGreaterThan(0);                            // creating a game does read the ground
      expect(keys.slice(0, asked.length)).toEqual(asked);                 // the same regions, first on the list
      // Residents start in fixed settlements at spots that differ from game to game: nearly every region under a
      // resident of this other game is on the list, as a resident's region or as a neighbour.
      const rules = gs.run!.sourceMap?.rules === 4 ? 4 : 3, other = demand.regionsWanted(gs.run!);
      expect(other.urgent.length).toBeGreaterThan(100);
      expect(other.urgent.filter(id => !keys.includes(rules + ':' + id)).length).toBeLessThanOrEqual(8);
      // The list itself: creation regions, then the regions under residents, then neighbours, in the order of region-demand.
      const same = engine.newGame(); world.setActiveLayout(scenes.U05_WORLD_LAYOUT_ID);
      expect(engine.startRun(same, 'female', Date.UTC(2026, 10, 26, 9), null, 1).ok).toBe(true);
      const want = demand.regionsWanted(same.run!), expected = [...asked];
      for (const id of [...want.urgent, ...want.nearby]) if (!expected.includes(rules + ':' + id)) expected.push(rules + ':' + id);
      expect(keys).toEqual(expected);
    } finally { vi.resetModules(); }
  }, 120000);
});

describe('prebuild worker lifetime', () => {
  it('is shut down after half a minute with nothing to compile and started again on the next request', async () => {
    type Fake = { posted: unknown[]; terminated: boolean; onmessage: ((e: { data: unknown }) => void) | null; onerror: (() => void) | null; postMessage(m: unknown): void; terminate(): void };
    const made: Fake[] = [];
    vi.stubGlobal('Worker', function (this: Fake) { this.posted = []; this.terminated = false; this.onmessage = null; this.onerror = null; this.postMessage = m => { this.posted.push(m); }; this.terminate = () => { this.terminated = true; }; made.push(this); });
    try {
      vi.resetModules();
      const { prebuildRegions, regionPrebuildStats } = await import('../src/veyra05/region-prebuild');
      const { U05_WORLD_LAYOUT_ID } = await import('../src/veyra05/scenes');
      const r = { layoutId: U05_WORLD_LAYOUT_ID, sourceMap: { rules: 4 }, humanWorld: { people: { a: { gx: 1120, gy: 1120, floor: 0, state: 'IDLE' } } } } as unknown as RunState;
      const T = 1_000_000;
      prebuildRegions(r, T);
      expect(made.length).toBe(1);
      const want = (made[0].posted[0] as { want: [string, number][] }).want;
      expect(want[0]).toEqual([layoutIdAt(1024, 1024), 4]);
      // The worker answers every region (an empty answer counts: it is simply compiled on the game thread when asked).
      for (const [layoutId, rules] of want) made[0].onmessage!({ data: { layoutId, rules, pack: null } });
      prebuildRegions(r, T + 1000);                      // nothing left to ask for: the idle clock starts
      prebuildRegions(r, T + 30000);
      expect(made[0].terminated).toBe(false);
      prebuildRegions(r, T + 31000);
      expect(made[0].terminated).toBe(true);
      expect(regionPrebuildStats().shutdowns).toBe(1);
      prebuildRegions(r, T + 120000);                    // still nothing to ask for: no worker is started for that
      expect(made.length).toBe(1);
      prebuildRegions(r, T + 6 * 60000);                 // the regions may be asked for again: a new worker
      expect(made.length).toBe(2);
      expect((made[1].posted[0] as { want: unknown[] }).want.length).toBe(want.length);
    } finally { vi.unstubAllGlobals(); vi.resetModules(); }
  });
});

describe('room in the pool of waiting packs', () => {
  type Fake = { posted: { want: [string, number][] }[]; onmessage: ((e: { data: unknown }) => void) | null; onerror: (() => void) | null; postMessage(m: unknown): void; terminate(): void };
  const person = (gx: number, gy: number) => ({ gx, gy, floor: 0, state: 'IDLE' });
  const withWorker = async (body: (api: typeof import('../src/veyra05/region-prebuild'), made: Fake[], run: (people: Record<string, unknown>) => RunState) => void) => {
    const made: Fake[] = [];
    vi.stubGlobal('Worker', function (this: Fake) { this.posted = []; this.onmessage = null; this.onerror = null; this.postMessage = m => { this.posted.push(m as Fake['posted'][0]); }; this.terminate = () => { /* */ }; made.push(this); });
    try {
      vi.resetModules();
      const api = await import('../src/veyra05/region-prebuild'), { U05_WORLD_LAYOUT_ID } = await import('../src/veyra05/scenes');
      body(api, made, people => ({ layoutId: U05_WORLD_LAYOUT_ID, sourceMap: { rules: 4 }, humanWorld: { people } } as unknown as RunState));
    } finally { vi.unstubAllGlobals(); vi.resetModules(); }
  };
  const pack = (layoutId: string, floors: number) => ({ data: { layoutId, rules: 4, pack: { layoutId, rules: 4, levels: new Array(floors).fill(0) } } });
  const T = 2_000_000;

  it('packs no resident is near any more give way to what residents want now', () => withWorker((api, made, run) => {
    // One resident in the middle of a region: 28 tiles from every neighbour, so the list is that region alone.
    api.prebuildRegions(run({ a: person(1120, 1120) }), T);
    expect(made[0].posted[0].want).toEqual([[layoutIdAt(1024, 1024), 4]]);
    made[0].onmessage!(pack(layoutIdAt(1024, 1024), 4));
    // The pool fills up with regions of places everybody has left (239 more packs of 4 floors: 960 floors, the limit).
    for (let i = 0; i < 239; i++) made[0].onmessage!(pack(layoutIdAt(64 * (i % 40), 64 * (5 + Math.floor(i / 40))), 4));
    expect(api.regionPrebuildStats()).toMatchObject({ waiting: 240, waitingFloors: 960, dropped: 0, released: 0 });
    // The resident walks to another region, 3 tiles from its western neighbour.
    api.prebuildRegions(run({ a: person(2118, 2140) }), T + 1000);
    expect(made[0].posted[1].want).toEqual([[layoutIdAt(2048, 2048), 4], [layoutIdAt(1984, 2048), 4]]);
    const after = api.regionPrebuildStats();
    expect(after.released).toBeGreaterThanOrEqual(2); expect(after.released).toBeLessThanOrEqual(4);   // only as many as needed
    expect(after.waiting).toBe(240 - after.released);
  }));

  it('of the packs nobody is near, those farthest from every resident go first', () => withWorker((api, made, run) => {
    const resident = { a: person(1120, 1120) };
    api.prebuildRegions(run(resident), T);
    made[0].onmessage!(pack(layoutIdAt(1024, 1024), 4));
    // Two regions nobody is near wait as well: one 100 tiles east of the resident (delivered first), one far away.
    const close = layoutIdAt(1152, 1024), far = layoutIdAt(3200, 2048);
    made[0].onmessage!(pack(close, 478)); made[0].onmessage!(pack(far, 478));
    expect(residentDistance(run(resident), [layoutIdAt(1024, 1024), close, far, 'elsewhere'])).toEqual([0, 100, 2148, Infinity]);
    // A resident appears elsewhere: room for one region is missing, and one pack is enough to make it.
    api.prebuildRegions(run({ ...resident, c: person(2144, 2144) }), T + 1000);
    expect(api.regionPrebuildStats()).toMatchObject({ waiting: 2, released: 1 });
    // The far pack went. The close one is still there: a resident who walks up to it is not made to ask for it again.
    api.prebuildRegions(run({ a: person(1250, 1120), c: person(2144, 2144) }), T + 2000);
    const lists = made[0].posted.map(p => p.want.map(w => w[0]));
    expect(lists[lists.length - 1]).not.toContain(close);
    expect(lists.flat()).not.toContain(far);
  }));

  it('the farthest guess gives way to a region a resident stands on, never the other way round', () => withWorker((api, made, run) => {
    // b stands 3 tiles from the western region and 10 from the northern and the north-western ones.
    const here = { b: person(1094, 1101) };
    api.prebuildRegions(run(here), T);
    const west = layoutIdAt(960, 1024), north = layoutIdAt(1024, 960), northWest = layoutIdAt(960, 960), home = layoutIdAt(1024, 1024);
    expect(made[0].posted[0].want).toEqual([[home, 4], [west, 4], [northWest, 4], [north, 4]]);
    // Four very tall regions fill the pool: every waiting pack is one a resident wants.
    for (const id of [home, west, north, northWest]) made[0].onmessage!(pack(id, 240));
    expect(api.regionPrebuildStats()).toMatchObject({ waiting: 4, waitingFloors: 960, released: 0 });
    api.prebuildRegions(run(here), T + 1000);
    expect(api.regionPrebuildStats().released).toBe(0);                    // nothing new to ask for: nothing is given back
    // A second resident appears in another region (in its middle: no neighbours of their own).
    api.prebuildRegions(run({ ...here, c: person(2144, 2144) }), T + 2000);
    expect(made[0].posted[made[0].posted.length - 1].want).toEqual([[layoutIdAt(2048, 2048), 4]]);
    expect(api.regionPrebuildStats()).toMatchObject({ waiting: 3, waitingFloors: 720, released: 1 });
    // The pack given back is the farthest guess. It is not asked for again straight away: the pool had no room for it.
    api.prebuildRegions(run({ ...here, c: person(2144, 2144) }), T + 3000);
    expect(made[0].posted[made[0].posted.length - 1].want).toEqual([[layoutIdAt(2048, 2048), 4]]);
    expect(api.regionPrebuildStats()).toMatchObject({ waiting: 3, released: 1 });
  }));
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
