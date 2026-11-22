/**
 * Region prebuilding. Residents ask the world compiler about the ground around them; compiling one region takes a
 * few hundred milliseconds, and after a new game or a Continue over a hundred of them are asked for within minutes.
 * This module keeps a background worker compiling the regions residents are about to ask for and hands the finished
 * packs to window.ts when it misses its cache. It never changes what a query returns: a pack is the compiler's own
 * output for that region, and a region the worker has not finished is compiled on the game thread as before.
 *
 * Which regions are asked for is decided in region-demand.ts. Before a run exists (title screen, no save to continue)
 * the worker works out the regions a new game opens with on its own, so they are ready when the game starts.
 */
import type { RunState } from '../game/core';
import { isVeyra05Layout } from './scenes';
import { regionsWanted } from './region-demand';
import { GEOMETRY_REGION_LIMIT, geometryRegionCount, hasGeometryRegion, setPrebuiltRegionSource, type GeometryRegionPack, type VeyraPlacementRules } from './window';
import type { PrebuildReply, PrebuildRequest } from './region-prebuild.worker';

/** Finished packs wait in a pool until a resident asks. The pool is bounded together with the geometry cache: both
 * hold floor regions in the same compact form (about 0.1 MB each), and together they stay within the cache's own
 * limit plus `POOL_EXTRA`; the pool may always keep `POOL_FLOOR` for the next few requests. */
const POOL_EXTRA = 256;
const POOL_FLOOR = 40;
/** A region is requested once; it may be requested again after this long (it was used and has since left the cache). */
const REQUEST_AGAIN_MS = 5 * 60000;
/** Longest request list handed to the worker. */
const WANT_LIMIT = 160;

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
const stats = { requested: 0, received: 0, served: 0, dropped: 0 };
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
      const pack = drop(keyOf(layoutId, rules));
      if (pack) stats.served++;
      return pack;
    });
    return worker = w;
  } catch { return worker = null; }
}

/** Call about once a second while a run is on screen or waiting behind the title. `framesLate`: the game is not
 * reaching its frame rate right now. Cheap; does nothing outside the Veyra world or without Worker. */
export function prebuildRegions(r: RunState, nowMs: number, framesLate = false): void {
  if (!r.layoutId || !isVeyra05Layout(r.layoutId) || !r.humanWorld) return;
  const w = start(); if (!w) return;
  const rules: VeyraPlacementRules = r.sourceMap?.rules === 4 ? 4 : 3;
  const want: [string, VeyraPlacementRules][] = [];
  // A floor region count is only known once a region is compiled; four per region is the usual size.
  let waitingReplies = 0; for (const key of pending) if (!pool.has(key)) waitingReplies++;
  const room = Math.floor((poolAllowance() - pooledFloors) / 4) - waitingReplies;
  let fresh = 0;
  const consider = (lid: string, limit: number) => {
    if (want.length >= WANT_LIMIT) return;
    const key = keyOf(lid, rules);
    if (pool.has(key) || hasGeometryRegion(lid, rules)) return;
    if (pending.has(key)) { want.push([lid, rules]); return; }      // already on the worker's list: keep its place
    // Delivered once and since used up or dropped: leave it for a while, so an unused region is not recompiled in a loop.
    if (nowMs - (requestedAt.get(key) ?? -Infinity) < REQUEST_AGAIN_MS) return;
    if (fresh >= limit) return;
    fresh++; want.push([lid, rules]);
  };
  const { urgent, nearby } = regionsWanted(r);
  for (const lid of urgent) consider(lid, room);
  // Neighbours are a guess: they only use half of the room that is left.
  const guessLimit = fresh + Math.floor(Math.max(0, room - fresh) / 2);
  for (const lid of nearby) consider(lid, guessLimit);
  const rest = framesLate ? restWhenLate : 0;
  const text = rest + ' ' + want.map(x => x[0]).join(' ');
  if (text === lastWant) return;
  lastWant = text;
  const listed = new Set<string>();
  for (const [lid] of want) { const key = keyOf(lid, rules); listed.add(key); if (!pending.has(key)) { pending.add(key); requestedAt.set(key, nowMs); stats.requested++; } }
  // The new list replaces the worker's queue: what fell off it is no longer on its way.
  for (const key of pending) if (!listed.has(key)) { pending.delete(key); requestedAt.delete(key); }
  w.postMessage({ want, rest } as PrebuildRequest);
}

/** Title screen, no run to continue: let the worker prepare the regions a new game opens with. Asked once. */
let warmed = false;
export function warmNewGameRegions(): void {
  if (warmed) return; warmed = true;
  start()?.postMessage({ warmNewGame: true } as PrebuildRequest);
}
