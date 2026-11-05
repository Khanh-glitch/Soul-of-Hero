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
const SMOOTHABLE = new Set<number>([
  T.MEADOW, T.GRASS, T.FOREST, T.MARSH, T.SAND, T.HILL, T.SNOW, T.ASH, T.TOXIC
]);
/** Raw GOLD sampler result (no despeckle) — used by the coarse 8-tile overview. */
export function u05TileRaw(tx: number, ty: number): number {
  if (!inFrame(tx, ty)) return T.DEEP;
  const s = sampleTile(tx, ty);
  return s ? s.tile : T.DEEP;
}
const DWIN = CHUNK + 2;              // 18x18: chunk interior + 1-tile border
const DWIN_MAX = 256;                // bounded window LRU (83 KB of tile codes)
const dwin = new Map<string, { used: number; codes: Uint8Array }>();
let dwinBuilds = 0, dwinEvictions = 0, despeckleReplacements = 0, dwinPasses = 0;

function rawCell(tx: number, ty: number) {
  if (!inFrame(tx, ty)) return { code: T.DEEP, eligible: 0 };
  const s = sampleTile(tx, ty);
  if (!s) return { code: T.DEEP, eligible: 0 };
  // Tile code alone is the authority: ROAD/BRIDGE/RIVER/DEEP/SHALLOW/CLIFF/
  // ICE/LAVA/FLOOR/PWALL are NOT in SMOOTHABLE, so authored geometry can never
  // be changed. DOCK/LAKE/RIVER flags do not alter the painted tile code and
  // must NOT veto despeckling (27 dock node radii would otherwise leave whole
  // speckled areas untouched).
  const eligible = s.authoredLand && SMOOTHABLE.has(s.tile) ? 1 : 0;
  return { code: s.tile, eligible };
}
/**
 * Build an 18x18 window for one 16x16 display chunk and run THREE deterministic
 * passes of the isolated-cell rule. Cascades (a neighbour becoming B and thereby
 * isolating the centre) are resolved because each pass reads the UPDATED grid.
 * Border columns/rows stay raw so the rule never invents geometry outside the
 * chunk; every painted tile is read from the window that owns it.
 */
function buildDespeckleWindow(cx: number, cy: number): Uint8Array {
  const x0 = cx * CHUNK - 1, y0 = cy * CHUNK - 1;
  const codes = new Uint8Array(DWIN * DWIN);
  const elig = new Uint8Array(DWIN * DWIN);
  for (let j = 0; j < DWIN; j++) for (let i = 0; i < DWIN; i++) {
    const c = rawCell(x0 + i, y0 + j);
    codes[j * DWIN + i] = c.code; elig[j * DWIN + i] = c.eligible;
  }
  for (let pass = 0; pass < 3; pass++) {
    let changed = 0; dwinPasses++;
    for (let j = 1; j < DWIN - 1; j++) for (let i = 1; i < DWIN - 1; i++) {
      const k = j * DWIN + i;
      if (!elig[k]) continue;
      const t = codes[k], n = codes[k - DWIN], so = codes[k + DWIN], e = codes[k + 1], w = codes[k - 1];
      if (n === so && so === e && e === w && n !== t && SMOOTHABLE.has(n)) { codes[k] = n; changed++; }
    }
    despeckleReplacements += changed;
    if (!changed) break;
  }
  dwinBuilds++;
  return codes;
}
/** Despeckled painter tile — the ONLY terrain sampler used by renderChunk(). */
export function u05Tile(tx: number, ty: number): number {
  if (!inFrame(tx, ty)) return T.DEEP;
  const cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK);
  const key = `creator-u05|despeckle|${cx}:${cy}`;
  let e = dwin.get(key);
  if (!e) {
    e = { used: ++tick, codes: buildDespeckleWindow(cx, cy) };
    dwin.set(key, e);
    while (dwin.size > DWIN_MAX) {
      let oldest = '', best = Infinity;
      for (const [kk, v] of dwin) if (v.used < best) { best = v.used; oldest = kk; }
      if (!oldest) break;
      dwin.delete(oldest); dwinEvictions++;
    }
  } else e.used = ++tick;
  const lx = tx - (cx * CHUNK - 1), ly = ty - (cy * CHUNK - 1);
  return e.codes[ly * DWIN + lx];
}
export function despeckleStats() {
  return {
    rule: '3 deterministic passes: a BIOME-DERIVED centre tile with 4 identical orthogonal biome neighbours and a different centre adopts the neighbour tile; passes read the UPDATED grid so cascades are resolved',
    replacements: despeckleReplacements, passesRun: dwinPasses,
    windowsBuilt: dwinBuilds, windowsResident: dwin.size, windowMax: DWIN_MAX, evictions: dwinEvictions,
    windowTiles: [DWIN, DWIN], chunkTiles: [CHUNK, CHUNK],
    smoothableTiles: [...SMOOTHABLE],
    untouchedByTileCode: ['ROAD', 'BRIDGE', 'RIVER', 'DEEP', 'SHALLOW', 'CLIFF', 'ICE', 'LAVA', 'FLOOR', 'PWALL', 'BURNT'],
    overviewUsesRawSampler: true,
    goldPolygonsUnchanged: true, analysisRasterUnchanged: true, verbatimPainterUnchanged: true,
    note: 'Additive U=0.5 sampler output only. GOLD polygons, 8 AU analysis raster and the byte-identical live PAL/PRIO/texel painter are NOT edited.'
  };
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
