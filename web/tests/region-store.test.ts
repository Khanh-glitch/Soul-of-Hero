/**
 * Compiled regions kept between visits (src/veyra05/region-store.ts).
 *
 * The promise: a kept region is the compiler's own output for that region, given back unchanged, and only to the
 * build that made it. Everything that can go wrong with browser storage ends in "not kept", never in an error and
 * never in a wrong region. IndexedDB is played by fake-indexeddb, which copies values the way a browser does.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeometryRegionPack, VeyraPlacementRules } from '../src/veyra05/window';
import type { RegionStoreBackend } from '../src/veyra05/region-store';
import { layoutIdAt } from '../src/veyra05/scenes';

const BUILD = 'region-prebuild.worker-AbCd1234.js', OTHER = 'region-prebuild.worker-ZyXw9876.js';
const A = layoutIdAt(1024, 1024), B = layoutIdAt(1280, 1024);

/** A small pack with the shape the compiler gives (the store never looks inside the arrays). */
const pack = (layoutId: string, rules: VeyraPlacementRules = 4, fill = 7): GeometryRegionPack => ({
  layoutId, rules, originTx: 1024, originTy: 1024, fresh: new Uint8Array(16).fill(fill),
  climate: { biomeNames: ['marsh'], biome: new Uint8Array(8), temperature: { codes: new Uint8Array(8), values: new Float32Array(2) }, moisture: { codes: new Uint8Array(8), values: new Float32Array(2) }, slope: { codes: new Uint8Array(8), values: new Float32Array(2) } },
  levels: [0, 1].map(level => ({ level, tiles: new Uint8Array(32).fill(fill + level), walkable: new Uint8Array(4).fill(255), solidProps: new Uint8Array(4), sourceNames: ['tree', 'rock'], sourceCells: Uint32Array.from([3, 9]), sourceCodes: Uint16Array.from([0, 1]), statics: [] })),
} as unknown as GeometryRegionPack);

const freshStoreModule = async () => { vi.resetModules(); return await import('../src/veyra05/region-store'); };
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); });
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('kept regions', () => {
  it('come back unchanged on a later visit, also after the original was handed to another thread', async () => {
    const first = await freshStoreModule(), original = pack(A), expected = structuredClone(original);
    const store = first.regionStore(BUILD);
    store.save(original);
    // What the prebuild worker does right after saving: the buffers leave with the message.
    const { geometryRegionPackBuffers } = await import('../src/veyra05/window');
    structuredClone(original, { transfer: geometryRegionPackBuffers(original) });
    expect(original.fresh.byteLength).toBe(0);
    await store.settled();
    // A later visit: new module state, same database.
    const later = (await freshStoreModule()).regionStore(BUILD);
    const [a, b] = await later.load([[A, 4], [B, 4]]);
    expect(a).toEqual(expected);
    expect(a!.levels[1].tiles).toBeInstanceOf(Uint8Array);
    expect(b).toBeUndefined();                                        // never kept: compile as before
    expect((await later.load([[A, 3]]))[0]).toBeUndefined();         // other rules are another region
  });

  it('are forgotten when another build opens the store', async () => {
    const first = (await freshStoreModule()).regionStore(BUILD);
    first.save(pack(A)); await first.settled();
    const next = (await freshStoreModule()).regionStore(OTHER);
    expect((await next.load([[A, 4]]))[0]).toBeUndefined();
    next.save(pack(B, 4, 9)); await next.settled();
    // The first build comes back (an old tab): it does not get the other build's regions either.
    const back = (await freshStoreModule()).regionStore(BUILD);
    expect(await back.load([[A, 4], [B, 4]])).toEqual([undefined, undefined]);
  });

  it('are never handed to a page of another build that opened the store earlier (two tabs)', async () => {
    // An old tab opens the store first and keeps a region.
    const oldTab = (await freshStoreModule()).regionStore(BUILD);
    oldTab.save(pack(A)); await oldTab.settled();
    expect((await oldTab.load([[A, 4]]))[0]).toEqual(pack(A));
    // A tab with the new build opens it, which empties it, and keeps its own version of the same region.
    const newTab = (await freshStoreModule()).regionStore(OTHER);
    newTab.save(pack(A, 4, 99)); await newTab.settled();
    // The old tab, still open, asks again: it must compile, not receive the new build's region.
    expect((await oldTab.load([[A, 4]]))[0]).toBeUndefined();
    expect((await newTab.load([[A, 4]]))[0]).toEqual(pack(A, 4, 99));
    // What the old tab keeps afterwards does not reach the new build either.
    oldTab.save(pack(B)); await oldTab.settled();
    expect((await newTab.load([[B, 4]]))[0]).toBeUndefined();
  });

  it('keep nothing without a build name', async () => {
    const { regionStore } = await freshStoreModule(), store = regionStore('');
    store.save(pack(A)); await store.settled();
    expect(await store.load([[A, 4]])).toEqual([undefined]);
    expect((await (await freshStoreModule()).regionStore(BUILD).load([[A, 4]]))[0]).toBeUndefined();
  });

  it('take a build name only from a content-named script of a web build', async () => {
    const { regionBuildOf } = await freshStoreModule();
    expect(regionBuildOf('https://soul-of-hero.vercel.app/assets/region-prebuild.worker-AbCd1234.js')).toBe(BUILD);
    expect(regionBuildOf('http://localhost:5173/src/veyra05/region-prebuild.worker.ts?worker_file&type=module')).toBe('');
    expect(regionBuildOf('https://example.org/assets/region-prebuild.worker.js')).toBe('');
    expect(regionBuildOf('blob:https://example.org/0b9e7c1e-55aa-4e0c-9d2f-0c8d1f2a3b4c')).toBe('');
    expect(regionBuildOf('file:///C:/game/assets/region-prebuild.worker-AbCd1234.js')).toBe('');
    expect(regionBuildOf('')).toBe('');
  });
});

describe('storage that fails', () => {
  const memory = (over: Partial<RegionStoreBackend> = {}) => {
    const packs = new Map<string, unknown>(); let build: string | undefined;
    const backend: RegionStoreBackend = {
      build: async () => build, reset: async b => { packs.clear(); build = b; }, keys: async () => [...packs.keys()],
      get: async keys => keys.map(k => packs.get(k) as GeometryRegionPack | undefined), put: async (k, p) => { packs.set(k, p); }, ...over,
    };
    return { backend, packs };
  };

  it('means "not kept": no storage, storage that throws, a store that cannot be written', async () => {
    const { makeRegionStore } = await freshStoreModule();
    const none = makeRegionStore(BUILD, Promise.resolve(null));
    none.save(pack(A)); await none.settled();
    expect(await none.load([[A, 4]])).toEqual([undefined]);
    const broken = makeRegionStore(BUILD, Promise.reject(new Error('blocked')));
    broken.save(pack(A)); await broken.settled();
    expect(await broken.load([[A, 4]])).toEqual([undefined]);
    const full = memory({ put: async () => { throw new Error('QuotaExceededError'); } });
    const noRoom = makeRegionStore(BUILD, Promise.resolve(full.backend));
    noRoom.save(pack(A)); noRoom.save(pack(B)); await noRoom.settled();
    expect(await noRoom.load([[A, 4], [B, 4]])).toEqual([undefined, undefined]);
    const unreadable = makeRegionStore(BUILD, Promise.resolve(memory({ get: async () => { throw new Error('read failed'); } }).backend));
    expect(await unreadable.load([[A, 4]])).toEqual([undefined]);
    // Without IndexedDB at all (private windows of some browsers).
    vi.stubGlobal('indexedDB', undefined);
    const { regionStore } = await freshStoreModule(), bare = regionStore(BUILD);
    bare.save(pack(A)); await bare.settled();
    expect(await bare.load([[A, 4]])).toEqual([undefined]);
  });

  it('never hands out a record that is damaged or belongs to another region', async () => {
    const { makeRegionStore, regionStoreKey } = await freshStoreModule(), m = memory();
    const store = makeRegionStore(BUILD, Promise.resolve(m.backend));
    store.save(pack(A)); await store.settled();
    expect((await store.load([[A, 4]]))[0]).toEqual(pack(A));
    m.packs.set(regionStoreKey(BUILD, B, 4), pack(A));                                   // filed under the wrong region
    expect((await store.load([[B, 4]]))[0]).toBeUndefined();
    m.packs.set(regionStoreKey(BUILD, B, 4), { ...pack(B), rules: 3 });                  // wrong rules
    expect((await store.load([[B, 4]]))[0]).toBeUndefined();
    m.packs.set(regionStoreKey(BUILD, B, 4), { ...pack(B), levels: [] });                // no floors
    expect((await store.load([[B, 4]]))[0]).toBeUndefined();
    const cut = pack(B); (cut.levels[1] as unknown as { tiles: unknown }).tiles = [1, 2, 3];
    m.packs.set(regionStoreKey(BUILD, B, 4), cut);                                       // an array that is not the right kind
    expect((await store.load([[B, 4]]))[0]).toBeUndefined();
    m.packs.set(regionStoreKey(BUILD, B, 4), 'text');
    expect((await store.load([[B, 4]]))[0]).toBeUndefined();
    expect((await store.load([[A, 4]]))[0]).toEqual(pack(A));                     // the sound one is still served
  });

  it('starts again when it has grown to its limit', async () => {
    const { makeRegionStore, REGION_STORE_LIMIT } = await freshStoreModule(), m = memory();
    await m.backend.reset(BUILD);
    for (let i = 0; i < REGION_STORE_LIMIT; i++) m.packs.set(`${BUILD}|4:filler-${i}`, pack(`filler-${i}`));
    const store = makeRegionStore(BUILD, Promise.resolve(m.backend));
    store.save(pack(A)); await store.settled();
    expect(m.packs.size).toBe(1);
    expect((await store.load([[A, 4]]))[0]).toEqual(pack(A));
  });
});

describe('the prebuild worker and kept regions', () => {
  const SCRIPT = 'https://soul-of-hero.example/assets/' + BUILD;
  /** Start the worker module with a script address; collect what it posts. */
  const startWorker = async (href: string) => {
    const posted: { build?: string; layoutId?: string; pack?: GeometryRegionPack | null }[] = [];
    const fake = { location: { href }, onmessage: null as null | ((e: { data: unknown }) => void), postMessage(m: (typeof posted)[number]) { posted.push(m); } };
    vi.stubGlobal('self', fake);
    vi.resetModules();
    await import('../src/veyra05/region-prebuild.worker');
    const until = async (done: () => boolean) => { for (let i = 0; i < 6000 && !done(); i++) await new Promise(r => setTimeout(r, 10)); };
    return { posted, fake, until };
  };

  it('answers from the store without compiling, and keeps what it compiles', async () => {
    // Visit 1: nothing kept. The worker compiles the region and keeps it.
    const one = await startWorker(SCRIPT);
    expect(one.posted).toEqual([{ build: BUILD }]);                    // tells the page the name its regions go by
    one.fake.onmessage!({ data: { want: [[A, 4]], rest: 0 } });
    await one.until(() => one.posted.length >= 2);
    const compiled = one.posted[1].pack!;
    expect(compiled.layoutId).toBe(A);
    const { regionStore } = await import('../src/veyra05/region-store');
    await regionStore(BUILD).settled();

    // Visit 2: same build. The compiler must not run; the pack that arrives is the one compiled on visit 1.
    vi.resetModules();
    vi.doMock('../src/veyra05/window', async original => ({ ...(await original<typeof import('../src/veyra05/window')>()), compileGeometryRegionPack: () => { throw new Error('compiled a kept region'); } }));
    try {
      const two = await startWorker(SCRIPT);
      two.fake.onmessage!({ data: { want: [[A, 4]], rest: 0 } });
      await two.until(() => two.posted.length >= 2);
      expect(two.posted[1].pack).toEqual(compiled);
    } finally { vi.doUnmock('../src/veyra05/window'); }

    // Visit 3: another build. The kept pack is not used: the region is compiled again, and is the same region.
    const three = await startWorker('https://soul-of-hero.example/assets/' + OTHER);
    three.fake.onmessage!({ data: { want: [[A, 4]], rest: 0 } });
    await three.until(() => three.posted.length >= 2);
    expect(three.posted[0]).toEqual({ build: OTHER });
    expect(three.posted[1].pack).toEqual(compiled);
  }, 300_000);

  it('keeps nothing and says nothing about a build on a dev server', async () => {
    const dev = await startWorker('http://localhost:5173/src/veyra05/region-prebuild.worker.ts?worker_file&type=module');
    dev.fake.onmessage!({ data: { want: [[A, 4]], rest: 0 } });
    await dev.until(() => dev.posted.length >= 1);
    expect(dev.posted.length).toBe(1);
    expect(dev.posted[0].layoutId).toBe(A);
    const { regionStore } = await import('../src/veyra05/region-store');
    expect(await regionStore(BUILD).load([[A, 4]])).toEqual([undefined]);
  }, 300_000);
});

describe('Continue and kept regions', () => {
  it('starts the replay with the kept regions added to those handed over, and unchanged without any', async () => {
    const { makeRegionStore } = await freshStoreModule();
    const { withKeptRegions } = await import('../src/game/offline-return-worker');
    const store = makeRegionStore(BUILD, (async () => { const packs = new Map<string, GeometryRegionPack>(); let build: string | undefined; return { build: async () => build, reset: async (b: string) => { packs.clear(); build = b; }, keys: async () => [...packs.keys()], get: async (keys: string[]) => keys.map(k => packs.get(k)), put: async (k: string, p: GeometryRegionPack) => { packs.set(k, p); } }; })());
    store.save(pack(B)); await store.settled();
    const handed = pack(A), request = { snapshot: '{}', now: 1, packs: [handed], kept: { build: BUILD, wanted: [[B, 4], [layoutIdAt(1024, 1280), 4]] as [string, VeyraPlacementRules][] } };
    const ready = await withKeptRegions(request, store);
    expect(ready.packs).toEqual([handed, pack(B)]);
    expect(ready.snapshot).toBe('{}'); expect(ready.now).toBe(1);
    // Nothing kept for these regions, or no store named: the request goes on as it came.
    expect(await withKeptRegions({ ...request, kept: { build: BUILD, wanted: [[layoutIdAt(1024, 1280), 4]] } }, store)).toEqual({ ...request, kept: { build: BUILD, wanted: [[layoutIdAt(1024, 1280), 4]] } });
    const plain = { snapshot: '{}', now: 1, packs: [handed] };
    expect(await withKeptRegions(plain)).toBe(plain);
  });
});
