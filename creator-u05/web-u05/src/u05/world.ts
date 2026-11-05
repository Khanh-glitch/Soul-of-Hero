/**
 * U=0.5 WORLD — lazy bounded chunks over the active WMP-04R1 / GOLD authority.
 * REUSES the LW-01 chunk method (geometry.ts / coords.ts / profile.ts) with an
 * EXPLICIT new profile id. The whole 4000x2800 frame is never allocated.
 */
import { T } from '../game/core';
import { sampleAt } from './lw/geometry';
import type { WorldProfile } from './lw/profile';
import {
  U, TILE, FRAME_W, FRAME_H, FRAME_AU, CHUNK,
  MAX_RESIDENT_CHUNKS, geometryChunkKey, chunkFromTile, inFrame, CONTRACT_INVARIANTS
} from './contract';

export { FRAME_W, FRAME_H, FRAME_AU, U, TILE, CONTRACT_INVARIANTS };

export const PROFILE: WorldProfile = {
  id: 'creator-u05',
  label: 'CREATOR CHOSEN U=0.5 (4,000 x 2,800, NON-SQUARE)',
  kind: 'AUTHORED_VEYRA',
  w: FRAME_W, h: FRAME_H, U,
  frameAu: FRAME_AU,
  chunkSize: CHUNK,
  maxResidentChunks: MAX_RESIDENT_CHUNKS,
  simRadiusChunks: 2,
  sourceRevision: 'WMP-04R1',
  boundedPilot: 'SIX_POI_SCENES__LAZY_CHUNKS__NO_FULL_FRAME_STREAMING_CLAIM',
  note: 'Creator-locked scale intent. Full Gameplay runtime integration NOT_YET_VALIDATED. No eager 11.2M array.'
};

/** The ONLY terrain sampler. Exact GOLD polygons at tile centres + deterministic
 *  1 AU dither over the 8 AU analysis raster. Never a nearest-neighbour 8 AU
 *  square land outline; never advertised as extra authored detail. */
export function sampleTile(tx: number, ty: number) {
  if (!inFrame(tx, ty)) return null;
  return sampleAt(PROFILE, tx, ty);
}
export function u05Tile(tx: number, ty: number): number {
  const s = sampleTile(tx, ty);
  return s ? s.tile : T.DEEP;
}

let tick = 0;
export function nextTick() { return ++tick; }

// ---- bounded resident geometry chunk registry (typed, NOT a full frame) ----
const resident = new Map<string, { cx: number; cy: number; used: number; tileCount: number }>();
let residentLoads = 0, residentEvictions = 0;
export function touchGeometryChunk(tx: number, ty: number) {
  if (!inFrame(tx, ty)) return;
  const { cx, cy } = chunkFromTile(tx, ty);
  const k = geometryChunkKey(cx, cy);
  const hit = resident.get(k);
  if (hit) { hit.used = ++tick; return; }
  resident.set(k, { cx, cy, used: ++tick, tileCount: CHUNK * CHUNK });
  residentLoads++;
  while (resident.size > MAX_RESIDENT_CHUNKS) {
    let oldest: string | null = null, best = Infinity;
    for (const [kk, v] of resident) if (v.used < best) { best = v.used; oldest = kk; }
    if (!oldest) break;
    resident.delete(oldest); residentEvictions++;
  }
}
export function residentKeys(): string[] { return [...resident.keys()]; }
export function stats() {
  return {
    frameTiles: [FRAME_W, FRAME_H], frameAu: FRAME_AU, U, TILE,
    addressableCells: FRAME_W * FRAME_H, materializedAllCells: false,
    residentChunks: resident.size, residentLoads, residentEvictions,
    maxResidentChunks: MAX_RESIDENT_CHUNKS,
    chunkKeyExample: geometryChunkKey(125, 87),
    legacyStrideKey: 'NEVER_USED__cy*100+cx'
  };
}
export function resetCaches() {
  resident.clear(); tick = 0; residentLoads = 0; residentEvictions = 0;
}

const BLOCKING_TERRAIN = new Set<number>([T.DEEP, T.SHALLOW, T.RIVER, T.CLIFF, T.PWALL, T.LAVA, T.ICE, T.BURNT]);
export function terrainBlocked(tx: number, ty: number): boolean {
  if (!inFrame(tx, ty)) return true;
  return BLOCKING_TERRAIN.has(u05Tile(tx, ty));
}
/** Point-in-polygon in continuous tile space. */
export function pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** Distance from a point to a segment, in continuous tile space. */
export function distToSegment(px: number, py: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}
