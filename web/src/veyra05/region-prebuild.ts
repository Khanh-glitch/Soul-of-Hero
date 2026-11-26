/**
 * Region prebuilding. Residents ask the world compiler about the ground around them; compiling one region takes a
 * few hundred milliseconds, and after a new game or a Continue over a hundred of them are asked for within minutes.
 * This module keeps a background worker compiling the regions residents are about to ask for and hands the finished
 * packs to window.ts when it misses its cache. It never changes what a query returns: a pack is the compiler's own
 * output for that region, and a region the worker has not finished is compiled on the game thread as before.
 *
 * Which regions are asked for is decided in region-demand.ts. Before a run exists (title screen, no save to continue)
 * the worker works out the regions a new game needs first on its own (region-warmup.ts), so they are ready when the
 * game starts.
 */
import type { RunState } from '../game/core';
import { isVeyra05Layout } from './scenes';
import { regionsWanted, residentDistance } from './region-demand';
import { GEOMETRY_REGION_LIMIT, geometryRegionCount, hasGeometryRegion, setPrebuiltRegionSource, type GeometryRegionPack, type VeyraPlacementRules } from './window';
import type { PrebuildReply, PrebuildRequest } from './region-prebuild.worker';

/** Finished packs wait in a pool until a resident asks. The pool is bounded together with the geometry cache: both
 * hold floor regions in the same compact form (about 0.1 MB each), and together they stay within the cache's own
 * limit plus `POOL_EXTRA`; the pool may always keep `POOL_FLOOR` for the next few requests.
 * A new game asks for about 290 regions of about 3 floors each (120 under residents, 170 beside them): 448 lets all
 * of them wait at once. When the pool is full, packs no resident is near any more give their room back. */
const POOL_EXTRA = 448;
const POOL_FLOOR = 40;
/** A region is requested once; it may be requested again after this long (it was used and has since left the cache). */
const REQUEST_AGAIN_MS = 5 * 60000;
/** Longest request list handed to the worker. */
const WANT_LIMIT = 160;
/** The worker is its own copy of the world compiler with its own working memory (well over 100 MB once it has
 * compiled a hundred regions). With nothing to compile for this long it is shut down; the next request starts a new one. */
const IDLE_SHUTDOWN_MS = 30000;

/** While a game is running and its frames are already late, the worker rests after each region so it does not take
 * processor time from the game thread and the browser's own drawing: twice the region's time on 2 cores, once on 3
 * or 4, none above. With frames on time, or before the game starts, it does not rest. */
const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4;
const restWhenLate = cores <= 2 ? 2 : cores <= 4 ? 1 : 0;
const pool = new Map<string, GeometryRegionPack>();
let pooledFloors = 0;
/** Floor regions the pool may hold right now. */
const poolAllowance = () => Math.max(POOL_FLOOR, GEOMETRY_REGION_LIMIT + POOL_EXTRA - geometryRegionCount());
const drop = (key: string) => { const pack = pool.get(key); if (pack) { pool.delete(key); pooledFloors -= pack.levels.length; } return pack; };
const requestedAt = new Map<string, number>();
/** Requested and not yet answered. */
const pending = new Set<string>();
let worker: Worker | null | undefined;
let lastWant = '';
let idleSince: number | null = null;
/** Each miss is a region compiled on the game thread. `missLate`: the game asked while the worker still had it on
 * its list; `missUsed`: delivered earlier and since used up or given back; `missUnasked`: never on a request list of
 * this thread (the title-screen warm-up keeps its list in the worker: what it has not finished counts here too). */
const stats = { requested: 0, received: 0, served: 0, dropped: 0, released: 0, shutdowns: 0, missLate: 0, missUsed: 0, missUnasked: 0 };
/** Packs given back to make room (see `prebuildRegions`); forgotten when requested again. */
const released = new Set<string>();
/** Counters for tests and measurements. */
export const regionPrebuildStats = () => ({ ...stats, waiting: pool.size, waitingFloors: pooledFloors });

const keyOf = (layoutId: string, rules: VeyraPlacementRules) => `${rules}:${layoutId}`;

function start(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    if (typeof Worker === 'undefined') return worker = null;
    const w = new Worker(new URL('./region-prebuild.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = ({ data }: MessageEvent<PrebuildReply>) => {
      stats.received++; pending.delete(keyOf(data.layoutId, data.rules));
      if (!data.pack || hasGeometryRegion(data.layoutId, data.rules)) { stats.dropped++; return; }
      const key = keyOf(data.layoutId, data.rules); drop(key);
      pool.set(key, data.pack); pooledFloors += data.pack.levels.length;
      while (pooledFloors > poolAllowance() && pool.size > 1) { drop(pool.keys().next().value!); stats.dropped++; }
    };
    w.onerror = () => { try { w.terminate(); } catch { /* */ } worker = null; pool.clear(); pooledFloors = 0; pending.clear(); };
    setPrebuiltRegionSource((layoutId, rules) => {
      const key = keyOf(layoutId, rules), pack = drop(key);
      if (pack) stats.served++;
      else if (pending.has(key)) stats.missLate++;
      else if (requestedAt.has(key) || released.has(key)) stats.missUsed++;
      else stats.missUnasked++;
      return pack;
    });
    return worker = w;
  } catch { return worker = null; }
}

/** Stop the worker and free its memory. Finished packs stay in the pool; the next request starts a new worker. */
function shutDown(): void {
  if (!worker) return;
  try { worker.terminate(); } catch { /* */ }
  worker = undefined; lastWant = ''; idleSince = null; pending.clear(); stats.shutdowns++;
}

/** Call about once a second while a run is on screen or waiting behind the title. `framesLate`: the game is not
 * reaching its frame rate right now. Cheap; does nothing outside the Veyra world or without Worker. */
export function prebuildRegions(r: RunState, nowMs: number, framesLate = false): void {
  if (!r.layoutId || !isVeyra05Layout(r.layoutId) || !r.humanWorld) return;
  if (worker === null) return;
  const rules: VeyraPlacementRules = r.sourceMap?.rules === 4 ? 4 : 3;
  const want: [string, VeyraPlacementRules][] = [];
  const { urgent, nearby } = regionsWanted(r);
  // A floor region count is only known once a region is compiled; four per region is the usual size.
  let waitingReplies = 0; for (const key of pending) if (!pool.has(key)) waitingReplies++;
  const roomNow = () => Math.floor((poolAllowance() - pooledFloors) / 4) - waitingReplies;
  const isNew = (lid: string) => {
    const key = keyOf(lid, rules);
    return !pool.has(key) && !hasGeometryRegion(lid, rules) && !pending.has(key) && nowMs - (requestedAt.get(key) ?? -Infinity) >= REQUEST_AGAIN_MS;
  };
  // The pool is kept for what residents want now. When new requests do not fit, waiting packs give their room back:
  // first those no resident is near any more (farthest from every resident first), then, for a region a resident
  // stands on, the farthest guesses. A pack given back is only a region compiled when asked, as before this module.
  const newUrgent = Math.min(WANT_LIMIT, urgent.filter(isNew).length), newNearby = Math.min(WANT_LIMIT, nearby.filter(isNew).length);
  if (roomNow() < newUrgent + 2 * newNearby) {
    const wanted = new Set<string>(); for (const lid of urgent) wanted.add(keyOf(lid, rules)); for (const lid of nearby) wanted.add(keyOf(lid, rules));
    // `again`: the pack may be requested again as soon as a resident comes near (false: only after the usual wait).
    const release = (key: string, again: boolean) => { if (!drop(key)) return; stats.released++; released.add(key); if (again) requestedAt.delete(key); else requestedAt.set(key, nowMs); };
    const stale: string[] = [], staleIds: string[] = [];
    for (const [key, pack] of pool) if (!wanted.has(key)) { stale.push(key); staleIds.push(pack.layoutId); }
    const far = residentDistance(r, staleIds), order = stale.map((_, i) => i).sort((a, b) => far[b] - far[a]);
    for (const i of order) { if (roomNow() >= newUrgent + 2 * newNearby) break; release(stale[i], true); }
    for (let i = nearby.length - 1; i >= 0 && roomNow() < newUrgent; i--) release(keyOf(nearby[i], rules), false);
  }
  const room = roomNow();
  let fresh = 0;
  const consider = (lid: string, limit: number) => {
    if (want.length >= WANT_LIMIT) return;
    const key = keyOf(lid, rules);
    if (pool.has(key) || hasGeometryRegion(lid, rules)) return;
    if (pending.has(key)) { want.push([lid, rules]); return; }      // already on the worker's list: keep its place
    // Delivered once and since used up: leave it for a while, so an unused region is not recompiled in a loop.
    if (nowMs - (requestedAt.get(key) ?? -Infinity) < REQUEST_AGAIN_MS) return;
    if (fresh >= limit) return;
    fresh++; want.push([lid, rules]);
  };
  for (const lid of urgent) consider(lid, room);
  // Neighbours are a guess: they only use half of the room that is left.
  const guessLimit = fresh + Math.floor(Math.max(0, room - fresh) / 2);
  for (const lid of nearby) consider(lid, guessLimit);
  // Nothing to compile and nothing on its way: after a while, give the worker's memory back.
  if (want.length || pending.size) idleSince = null;
  else if (idleSince === null || nowMs < idleSince) idleSince = nowMs;
  else if (nowMs - idleSince >= IDLE_SHUTDOWN_MS) { shutDown(); return; }
  const rest = framesLate ? restWhenLate : 0;
  const text = rest + ' ' + want.map(x => x[0]).join(' ');
  if (text === lastWant) return;
  lastWant = text;
  const listed = new Set<string>();
  for (const [lid] of want) { const key = keyOf(lid, rules); listed.add(key); if (!pending.has(key)) { pending.add(key); requestedAt.set(key, nowMs); released.delete(key); stats.requested++; } }
  // The new list replaces the worker's queue: what fell off it is no longer on its way.
  for (const key of pending) if (!listed.has(key)) { pending.delete(key); requestedAt.delete(key); }
  if (!want.length && worker === undefined) return;   // nothing to ask for: do not start a worker for it
  start()?.postMessage({ want, rest } as PrebuildRequest);
}

/** Title screen, no run to continue: let the worker prepare the regions a new game opens with. Asked once. */
let warmed = false;
export function warmNewGameRegions(): void {
  if (warmed) return; warmed = true;
  start()?.postMessage({ warmNewGame: true } as PrebuildRequest);
}
