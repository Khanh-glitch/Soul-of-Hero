/**
 * LAZY DETERMINISTIC CHUNK STREAMING (U=0.5) with a BOUNDED LRU.
 *
 * A chunk is 32x32 tiles (16 AU). It is built from the authoritative reader
 * (reader.ts) plus the deterministic COMPOSITION rules below, never from a
 * full-frame array. The same (cx,cy) always yields byte-identical layers,
 * regardless of build order or which window asked for it (tested).
 *
 * Layers per chunk (Uint8, 1024 cells each):
 *   tile     – SOH terrain code (T.*) after the U05 despeckle rule (3 passes on a
 *              34x34 bordered window; authored ROAD/water/CLIFF never change)
 *   flags    – bit0 land, bit1 lake, bit2 river, bit3 road, bit4 coast, bit5 poi,
 *              bit6 zone, bit7 elder
 *   biome    – WMP-04R1 effective biome code (0..11) sampled with the 1 AU dither
 *   feature  – composition decor code (F.*): NON-solid, NON-harvestable, visual only
 *   poi      – POI index (255 none) · zone – zone index (255 none)
 *   clim     – bit0 cold(class>=2) bit1 marine>0 bit2 cliff bit3 nearWater bit4 nearRoad bit5 forestEdge bit6 clearing bit7 interior
 *   elev     – LR01 elevation byte (0..255) · node – GOLD resource/dock/bridge node tag (0 none,1 resource,2 dock,3 bridge)
 */
import { T, hash2 } from '../game/core';
import { CHUNK, chunkKey, inFrame, inChunkFrame, FRAME_W, FRAME_H } from './frame';
import { sampleTile, type TileSample } from './reader';

// Local copy of the live value-noise fbm (world.ts) to avoid an import cycle with world.ts; same formula.
function vnoise(x: number, y: number, s: number) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x: number, y: number, s: number, oct = 4) { let f = 0, amp = 0.5, fr = 1, n = 0; for (let i = 0; i < oct; i++) { f += vnoise(x * fr, y * fr, s + i * 17) * amp; n += amp; amp *= 0.5; fr *= 2; } return f / n; }
export const FL = { LAND: 1, LAKE: 2, RIVER: 4, ROAD: 8, COAST: 16, POI: 32, ZONE: 64, ELDER: 128 } as const;
export const CL = { COLD: 1, MARINE: 2, CLIFF: 4, NEAR_WATER: 8, NEAR_ROAD: 16, FOREST_EDGE: 32, CLEARING: 64, INTERIOR: 128 } as const;
/** Decor feature codes. Every code is classified in art-nature.ts (sprite, bounds, layer, biome, rule). */
export const F = {
  NONE: 0, FERN: 1, FERN_LARGE: 2, SAPLING: 3, STUMP: 4, LOG: 5, MOSS_ROCK: 6, WILDFLOWERS: 7, LEAF_LITTER: 8,
  CATTAIL: 9, LILYPAD: 10, PUDDLE: 11, MUD_CRACK: 12, DEAD_REED: 13,
  PEBBLES: 14, SMALL_BOULDER: 15, ROCK_CRACK: 16, SCREE: 17, DRY_TUFT: 18,
  SHELL: 19, DRIFTWOOD: 20, DUNE_GRASS: 21, WET_SAND: 22, KELP: 23,
  SNOW_DRIFT: 24, FROSTED_SHRUB: 25, ICE_SHARD: 26,
  CINDER_ROCK: 27, EMBER_CRACK: 28, ASH_MOUND: 29,
  DEAD_SHRUB: 30, SLICK: 31, BONES: 32,
  RUBBLE: 33, FOUNDATION: 34, WORN_GROUND: 35, POST_STUB: 36, CRATE_DEBRIS: 37,
  RUT: 38, MILESTONE: 39, ROADSIDE_GRASS: 40, GRASS_TUFT: 41, FLOWER_SMALL: 42, DIRT_PATCH: 43, ROOTS: 44, BIRCH_SAPLING: 45, REED_CLUMP: 46,
} as const;
export type FeatureCode = typeof F[keyof typeof F];

export interface Chunk { cx: number; cy: number; key: string; tile: Uint8Array; flags: Uint8Array; biome: Uint8Array; feature: Uint8Array; poi: Uint8Array; zone: Uint8Array; clim: Uint8Array; elev: Uint8Array; node: Uint8Array; builtSeq: number; used: number }
const N = CHUNK * CHUNK, W2 = CHUNK + 2;          // 34x34 bordered work window
const SMOOTHABLE = new Set<number>([T.MEADOW, T.GRASS, T.FOREST, T.MARSH, T.SAND, T.HILL, T.SNOW, T.ASH, T.TOXIC]);
const isWater = (t: number) => t === T.DEEP || t === T.SHALLOW || t === T.RIVER;

// ---------- bounded LRU ----------
export const MAX_RESIDENT = 160;                   // ~160 x 9 KB ≈ 1.4 MB of layers; never the frame
const resident = new Map<string, Chunk>();
let tick = 0, builds = 0, hits = 0, evictions = 0, buildMs = 0;
export const streamStats = () => ({ resident: resident.size, maxResident: MAX_RESIDENT, builds, hits, evictions, buildMs: Math.round(buildMs), chunkTiles: CHUNK, frameChunks: [Math.ceil(FRAME_W / CHUNK), Math.ceil(FRAME_H / CHUNK)], fullFrameMaterialised: false });
export function resetStream() { resident.clear(); tick = 0; builds = 0; hits = 0; evictions = 0; buildMs = 0; }
export function getChunk(cx: number, cy: number): Chunk {
  if (!inChunkFrame(cx, cy)) throw Error(`VEYRA05_CHUNK_OUT_OF_FRAME ${cx},${cy}`);
  const key = chunkKey(cx, cy); const hit = resident.get(key);
  if (hit) { hit.used = ++tick; hits++; return hit; }
  const t0 = performance.now(); const c = buildChunk(cx, cy, key); buildMs += performance.now() - t0; builds++;
  resident.set(key, c);
  while (resident.size > MAX_RESIDENT) { let oldest = '', best = Infinity; for (const [k, v] of resident) if (v.used < best) { best = v.used; oldest = k; } resident.delete(oldest); evictions++; }
  return c;
}
/** Tile-level accessors through the stream (frame-clamped: outside the frame is sea). */
export function tileAtGlobal(tx: number, ty: number) { if (!inFrame(tx, ty)) return T.DEEP; const cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK); return getChunk(cx, cy).tile[(ty - cy * CHUNK) * CHUNK + (tx - cx * CHUNK)]; }
export function cellAtGlobal(tx: number, ty: number) { if (!inFrame(tx, ty)) return null; const cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK); const c = getChunk(cx, cy); return { c, i: (ty - cy * CHUNK) * CHUNK + (tx - cx * CHUNK) }; }

// ---------- composition fields (MACRO) ----------
const SALT = 0x7e05;
/** Stand density: slow field that groups trees into stands and opens glades. */
const standDensity = (tx: number, ty: number) => fbm(tx / 56, ty / 56, SALT + 1, 3);
/** Clearing field: medium frequency; >0.68 inside forest opens a glade. */
const clearingField = (tx: number, ty: number) => fbm(tx / 17, ty / 17, SALT + 2, 2);
/** Wetness field for marsh pools/puddles. */
const wetField = (tx: number, ty: number) => fbm(tx / 11, ty / 11, SALT + 3, 2);
/** Rock exposure field for hills/scree bands. */
const rockField = (tx: number, ty: number) => fbm(tx / 23, ty / 23, SALT + 4, 2);
const h = (tx: number, ty: number, s: number) => hash2(tx, ty, SALT ^ s);

function buildChunk(cx: number, cy: number, key: string): Chunk {
  const x0 = cx * CHUNK - 1, y0 = cy * CHUNK - 1;
  const S: (TileSample | null)[] = new Array(W2 * W2); const code = new Uint8Array(W2 * W2); const elig = new Uint8Array(W2 * W2);
  for (let j = 0; j < W2; j++) for (let i = 0; i < W2; i++) {
    const tx = x0 + i, ty = y0 + j, k = j * W2 + i;
    if (!inFrame(tx, ty)) { S[k] = null; code[k] = T.DEEP; continue; }
    const s = sampleTile(tx, ty); S[k] = s;
    let t = s.tile;
    // MESO — forest clearings and stand edges are composed BEFORE despeckle so they smooth like any biome boundary.
    if (t === T.FOREST && !s.road && s.poi < 0) {
      const d = standDensity(tx, ty), c = clearingField(tx, ty);
      if (c > 0.68 && d < 0.62) t = T.GRASS;                       // glade: real opening (compiler places bushes/tall grass, few trees)
      else if (d < 0.30 && c > 0.56) t = T.GRASS;                   // thin stand margin
    }
    // Live Gameplay WMP-04R1 cliff rule (cliffCandidate==1 on dry land, not road, not POI), dithered like biome (no 8 AU squares).
    if (s.land && !s.lake && !s.river && !s.road && s.poi < 0 && cliffDithered(s, tx, ty)) t = T.CLIFF;
    code[k] = t; elig[k] = s.land && !s.lake && !s.river && !s.road && SMOOTHABLE.has(t) ? 1 : 0;
  }
  // U05 despeckle: 3 passes, isolated biome cell surrounded by 4 identical neighbours adopts them.
  for (let pass = 0; pass < 3; pass++) { let changed = 0; for (let j = 1; j < W2 - 1; j++) for (let i = 1; i < W2 - 1; i++) { const k = j * W2 + i; if (!elig[k]) continue; const t = code[k], n = code[k - W2], so = code[k + W2], e = code[k + 1], w = code[k - 1]; if (n === so && so === e && e === w && n !== t && SMOOTHABLE.has(n)) { code[k] = n; changed++; } } if (!changed) break; }
  const c: Chunk = { cx, cy, key, tile: new Uint8Array(N), flags: new Uint8Array(N), biome: new Uint8Array(N), feature: new Uint8Array(N), poi: new Uint8Array(N).fill(255), zone: new Uint8Array(N).fill(255), clim: new Uint8Array(N), elev: new Uint8Array(N), node: new Uint8Array(N), builtSeq: ++tick, used: tick };
  for (let j = 0; j < CHUNK; j++) for (let i = 0; i < CHUNK; i++) {
    const k = (j + 1) * W2 + (i + 1), o = j * CHUNK + i, s = S[k]; const t = code[k]; c.tile[o] = t;
    if (!s) continue; const tx = x0 + i + 1, ty = y0 + j + 1;
    c.flags[o] = (s.land ? FL.LAND : 0) | (s.lake ? FL.LAKE : 0) | (s.river ? FL.RIVER : 0) | (s.road && t === T.ROAD ? FL.ROAD : 0) | (s.coast ? FL.COAST : 0) | (s.poi >= 0 ? FL.POI : 0) | (s.zone >= 0 ? FL.ZONE : 0) | (s.elder >= 0 ? FL.ELDER : 0);
    c.biome[o] = s.biome; c.poi[o] = s.poi >= 0 ? s.poi : 255; c.zone[o] = s.zone >= 0 ? s.zone : 255; c.elev[o] = s.elevation; c.node[o] = s.bridgeNode ? 3 : s.dockNode ? 2 : s.node ? 1 : 0;
    const n = code[k - W2], so = code[k + W2], e = code[k + 1], w = code[k - 1], ne = code[k - W2 + 1], nw = code[k - W2 - 1], se = code[k + W2 + 1], sw = code[k + W2 - 1];
    const ring8 = [n, so, e, w, ne, nw, se, sw];
    const nearWater = ring8.some(isWater), nearRoad = ring8.some(v => v === T.ROAD);
    const forestEdge = t === T.FOREST && [n, so, e, w].some(v => v !== T.FOREST && !isWater(v));
    const interior = t === T.FOREST && ring8.every(v => v === T.FOREST);
    const clearing = t === T.GRASS && s.biome >= 1 && s.biome <= 3;
    c.clim[o] = (s.cold >= 2 ? CL.COLD : 0) | (s.marine > 0 ? CL.MARINE : 0) | (t === T.CLIFF ? CL.CLIFF : 0) | (nearWater ? CL.NEAR_WATER : 0) | (nearRoad ? CL.NEAR_ROAD : 0) | (forestEdge ? CL.FOREST_EDGE : 0) | (clearing ? CL.CLEARING : 0) | (interior ? CL.INTERIOR : 0);
    c.feature[o] = composeFeature(s, t, tx, ty, { nearWater, nearRoad, forestEdge, interior, clearing, ring8, n, so, e, w });
  }
  return c;
}
function cliffDithered(s: TileSample, tx: number, ty: number) {
  if (!s.cliff) return false;
  // Irregular edge: drop ~35% of boundary-ish samples deterministically so the 8 AU cell does not read as a square.
  return h(tx, ty, 0xc1f) > 0.35 || h(tx >> 1, ty >> 1, 0xc1e) > 0.5;
}

// ---------- MESO / MICRO composition ----------
interface Ctx { nearWater: boolean; nearRoad: boolean; forestEdge: boolean; interior: boolean; clearing: boolean; ring8: number[]; n: number; so: number; e: number; w: number }
function composeFeature(s: TileSample, t: number, tx: number, ty: number, c: Ctx): number {
  const r = h(tx, ty, 1), r2 = h(tx, ty, 2);
  // POI SITE ENVELOPE — visual storytelling only: worn ground, foundation lines, rubble at the envelope edge. No doors/buildings invented.
  if (s.poi >= 0 && s.land && !isWater(t) && t !== T.ROAD) {
    const edge = c.ring8.length && (c.n !== t || c.so !== t || c.e !== t || c.w !== t);
    const arche = POI_ARCHE(s.poi);
    if (r < 0.10) return F.WORN_GROUND;
    if (edge && r2 < 0.22) return arche === 'ruin' || arche === 'military' ? F.RUBBLE : F.POST_STUB;
    if (r2 < 0.05) return arche === 'industrial' || arche === 'mining' || arche === 'port' ? F.CRATE_DEBRIS : F.FOUNDATION;
    return F.NONE;
  }
  if (t === T.ROAD) { if (r < 0.08) return F.RUT; if (r < 0.085 && (tx + ty) % 9 === 0) return F.MILESTONE; return F.NONE; }
  if (c.nearRoad && !isWater(t) && t !== T.CLIFF && r < 0.12) return F.ROADSIDE_GRASS;
  const dens = standDensity(tx, ty), wet = wetField(tx, ty), rock = rockField(tx, ty);
  switch (t) {
    case T.FOREST: {
      const cold = s.cold >= 2 || s.biome === 3;
      if (c.interior) { if (r < 0.18) return cold ? F.MOSS_ROCK : F.FERN_LARGE; if (r < 0.34) return F.FERN; if (r < 0.40) return F.LEAF_LITTER; if (r < 0.43) return F.LOG; if (r < 0.45) return F.STUMP; if (r < 0.52) return F.ROOTS; return F.NONE; }
      if (c.forestEdge) { if (r < 0.14) return F.SAPLING; if (r < 0.22) return cold ? F.FROSTED_SHRUB : F.FERN; if (r < 0.27) return F.BIRCH_SAPLING; if (r < 0.33) return F.GRASS_TUFT; return F.NONE; }
      if (r < 0.12) return F.FERN; if (r < 0.17) return F.LEAF_LITTER; if (r < 0.20) return F.LOG; if (r < 0.22) return F.MOSS_ROCK; if (r < 0.25 && dens > 0.5) return F.ROOTS; return F.NONE;
    }
    case T.GRASS: case T.MEADOW: {
      if (c.clearing) { if (r < 0.10) return F.WILDFLOWERS; if (r < 0.16) return F.STUMP; if (r < 0.22) return F.LOG; if (r < 0.34) return F.GRASS_TUFT; if (r < 0.38) return F.SAPLING; return F.NONE; }
      if (c.nearWater && r < 0.18) return F.REED_CLUMP;
      if (r < 0.09) return F.GRASS_TUFT; if (r < 0.12) return F.FLOWER_SMALL; if (r < 0.14) return F.DIRT_PATCH; if (r < 0.145) return F.PEBBLES; return F.NONE;
    }
    case T.MARSH: {
      if (c.nearWater) { if (r < 0.30) return F.CATTAIL; if (r < 0.42) return F.REED_CLUMP; if (r < 0.48) return F.PUDDLE; return F.NONE; }
      if (wet > 0.62) { if (r < 0.20) return F.PUDDLE; if (r < 0.30) return F.CATTAIL; if (r < 0.34) return F.LOG; return F.NONE; }
      if (r < 0.10) return F.DEAD_REED; if (r < 0.15) return F.MUD_CRACK; if (r < 0.19) return F.REED_CLUMP; if (r < 0.21) return F.MOSS_ROCK; return F.NONE;
    }
    case T.SHALLOW: case T.RIVER: { if (s.lake && !c.nearRoad && r < 0.06 && c.ring8.every(isWater)) return F.LILYPAD; if (!s.land && r < 0.0) return F.KELP; return F.NONE; }
    case T.HILL: {
      const dry = s.biome === 6;
      if (rock > 0.60) { if (r < 0.16) return F.SMALL_BOULDER; if (r < 0.30) return F.SCREE; if (r < 0.36) return F.ROCK_CRACK; return F.NONE; }
      if (r < 0.10) return F.PEBBLES; if (r < 0.18) return dry ? F.DRY_TUFT : F.GRASS_TUFT; if (r < 0.21) return F.SMALL_BOULDER; if (r < 0.23) return F.ROCK_CRACK; return F.NONE;
    }
    case T.SAND: {
      if (s.coast) { if (s.coastDist < 1.2 && r < 0.22) return F.WET_SAND; if (r < 0.08) return F.SHELL; if (r < 0.12) return F.DRIFTWOOD; if (r < 0.20) return F.DUNE_GRASS; return F.NONE; }
      if (r < 0.05) return F.DRY_TUFT; if (r < 0.07) return F.PEBBLES; if (r < 0.075) return F.BONES; return F.NONE;
    }
    case T.SNOW: { if (r < 0.14) return F.SNOW_DRIFT; if (r < 0.19) return F.FROSTED_SHRUB; if (r < 0.22) return F.ICE_SHARD; if (r < 0.24) return F.SMALL_BOULDER; return F.NONE; }
    case T.ASH: { if (r < 0.10) return F.CINDER_ROCK; if (r < 0.15) return F.EMBER_CRACK; if (r < 0.19) return F.ASH_MOUND; if (r < 0.21) return F.BONES; return F.NONE; }
    case T.TOXIC: { if (r < 0.10) return F.DEAD_SHRUB; if (r < 0.17) return F.SLICK; if (r < 0.19) return F.BONES; if (r < 0.21) return F.DEAD_REED; return F.NONE; }
    case T.CLIFF: return F.NONE;
  }
  return F.NONE;
}
import { POIS } from './reader';
function POI_ARCHE(idx: number) { return POIS[idx]?.arche || 'site'; }
