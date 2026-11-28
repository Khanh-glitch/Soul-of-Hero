/**
 * Compiled world regions kept between visits.
 *
 * Compiling one region takes a few hundred milliseconds, and a Continue after an absence asks for about 180 of them
 * before the residents' first simulated minutes are over: 18 seconds and more in which the progress bar hardly
 * moves. A region is a pure function of (layout, rules) and of the game's code, so the compiler's output for it (a
 * `GeometryRegionPack`) can be kept in the browser's IndexedDB and read back on the next visit instead of being
 * compiled again. Reading a pack back changes nothing but the wait: it is the same pack.
 *
 * Packs are only valid for the code that made them. The region compiler and everything it imports are bundled into
 * the prebuild worker's script, and a production build names that script after its content
 * (`region-prebuild.worker-<hash>.js`), so that name is the store's `build`: it changes exactly when the compiler's
 * code may have changed. The store remembers which build filled it and empties itself when another build opens it.
 * Without such a name (dev server, tests, a page that inlines its workers) or without IndexedDB (private windows,
 * some `file:` pages) nothing is kept and every read answers "not kept": regions compile when asked, as before.
 *
 * Every failure here means only "not kept". Nothing in this file throws into the game.
 */
import type { GeometryRegionPack, VeyraPlacementRules } from './window';

const DB_NAME = 'soh.regions.v1', PACKS = 'packs', META = 'meta', BUILD_KEY = 'build';
/** Most packs the store keeps. A pack is about 0.34 MB (a run's residents ask for about 280: close to 100 MB of
 * browser storage). Beyond the limit the store is emptied and starts again: a guard against unbounded growth, not a
 * working limit. */
export const REGION_STORE_LIMIT = 600;

/** What the store needs from a database. IndexedDB in the browser; a plain map in tests. */
export interface RegionStoreBackend {
  /** The build id the kept packs belong to, or undefined when none was recorded. */
  build(): Promise<string | undefined>;
  /** Forget every pack and record `build` as their owner from now on. */
  reset(build: string): Promise<void>;
  keys(): Promise<string[]>;
  get(keys: string[]): Promise<(GeometryRegionPack | undefined)[]>;
  put(key: string, pack: GeometryRegionPack): Promise<void>;
}

/** A record is filed under its build as well as its region: a page still running an older build (another tab) can
 * then never be handed a newer build's region, whatever the order in which the two open and empty the store. */
export const regionStoreKey = (build: string, layoutId: string, rules: VeyraPlacementRules) => `${build}|${rules}:${layoutId}`;

const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const done = (t: IDBTransaction) => new Promise<void>((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });

function indexedDbBackend(): Promise<RegionStoreBackend | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => { const db = open.result; if (!db.objectStoreNames.contains(PACKS)) db.createObjectStore(PACKS); if (!db.objectStoreNames.contains(META)) db.createObjectStore(META); };
      open.onerror = () => resolve(null); open.onblocked = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result; db.onversionchange = () => db.close();
        resolve({
          build: () => request(db.transaction(META).objectStore(META).get(BUILD_KEY)) as Promise<string | undefined>,
          reset: build => { const t = db.transaction([PACKS, META], 'readwrite'); t.objectStore(PACKS).clear(); t.objectStore(META).put(build, BUILD_KEY); return done(t); },
          keys: async () => (await request(db.transaction(PACKS).objectStore(PACKS).getAllKeys())).map(String),
          get: keys => { const s = db.transaction(PACKS).objectStore(PACKS); return Promise.all(keys.map(k => request(s.get(k)) as Promise<GeometryRegionPack | undefined>)); },
          put: (key, pack) => { const t = db.transaction(PACKS, 'readwrite'); t.objectStore(PACKS).put(pack, key); return done(t); },
        });
      };
    } catch { resolve(null); }
  });
}

/** A pack that came back from storage is only used when it is whole and answers for the region it was asked for. */
function soundPack(p: unknown, layoutId: string, rules: number): p is GeometryRegionPack {
  const q = p as GeometryRegionPack | undefined;
  return !!q && q.layoutId === layoutId && q.rules === rules && q.fresh instanceof Uint8Array && !!q.climate && Array.isArray(q.levels) && q.levels.length > 0
    && q.levels.every(l => l && l.tiles instanceof Uint8Array && l.walkable instanceof Uint8Array && l.solidProps instanceof Uint8Array && l.sourceCells instanceof Uint32Array && l.sourceCodes instanceof Uint16Array && Array.isArray(l.sourceNames) && Array.isArray(l.statics));
}

export interface RegionStore {
  /** The kept packs for these regions, in the same order; undefined where none is kept. */
  load(wanted: readonly (readonly [layoutId: string, rules: VeyraPlacementRules])[]): Promise<(GeometryRegionPack | undefined)[]>;
  /** Keep a pack. Call BEFORE the pack's buffers are transferred to another thread; it is copied at once. */
  save(pack: GeometryRegionPack): void;
  /** Resolves when everything saved so far has been written (for tests and measurements). */
  settled(): Promise<void>;
}

const NOTHING: RegionStore = { load: async wanted => wanted.map(() => undefined), save: () => { /* not kept */ }, settled: async () => { /* nothing pending */ } };

/** A store over `backend` for packs made by `build`. Exported for tests; the game uses `regionStore()`. */
export function makeRegionStore(build: string, backend: Promise<RegionStoreBackend | null>): RegionStore {
  if (!build) return NOTHING;
  let count = 0, writes: Promise<void> = Promise.resolve();
  // Opened once: a store filled by another build is emptied before anything is read from it.
  const ready: Promise<RegionStoreBackend | null> = backend.then(async b => {
    if (!b) return null;
    if (await b.build() !== build) await b.reset(build);
    count = (await b.keys()).length;
    return b;
  }).catch(() => null);
  return {
    async load(wanted) {
      try {
        const b = await ready; if (!b || !wanted.length) return wanted.map(() => undefined);
        const packs = await b.get(wanted.map(([lid, rules]) => regionStoreKey(build, lid, rules)));
        return packs.map((p, i) => soundPack(p, wanted[i][0], wanted[i][1]) ? p : undefined);
      } catch { return wanted.map(() => undefined); }
    },
    save(pack) {
      // Copied now: the caller may hand the pack's buffers to another thread right after this call.
      let copy: GeometryRegionPack; try { copy = structuredClone(pack); } catch { return; }
      writes = writes.then(async () => {
        const b = await ready; if (!b) return;
        if (count >= REGION_STORE_LIMIT) { await b.reset(build); count = 0; }
        await b.put(regionStoreKey(build, copy.layoutId, copy.rules), copy); count++;
      }).catch(() => { /* not kept */ });
    },
    settled: () => writes,
  };
}

/** The store's `build` for a worker script address: the content-named file of a production build, or '' (keep
 * nothing) for any other address. */
export function regionBuildOf(scriptUrl: string): string {
  const m = /^https?:\/\/[^?#]*\/(region-prebuild\.worker-[A-Za-z0-9_-]{8,}\.js)$/.exec(scriptUrl);
  return m ? m[1] : '';
}

const stores = new Map<string, RegionStore>();
/** The store for packs made by `build` (one per thread; all threads of the page share the same database). */
export function regionStore(build: string): RegionStore {
  if (!build) return NOTHING;
  let store = stores.get(build);
  if (!store) stores.set(build, store = makeRegionStore(build, indexedDbBackend()));
  return store;
}
