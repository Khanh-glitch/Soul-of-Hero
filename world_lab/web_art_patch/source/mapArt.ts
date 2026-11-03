// Fisher's Point map-art slice — an authored, data-driven visual layer for the REAL Web world.
//
// PROVENANCE / TECHNIQUE
//   Visual technique is reused from the world_lab GOLD MapLab research (hard-edged 16px
//   material transitions, blue-violet shadow ladder, warm brass/ember highlight ladder,
//   contact shadows, trim, hue-shifted value ramps) and from the tracked prototype
//   tilesets' coast / forest / road material vocabulary. Every sprite here is newly
//   authored pixel-by-pixel with the same `mk`-style offscreen-canvas approach as art.ts;
//   no third-party image is bundled and no GOLD 1024x768 world is imported.
//
// AUTHORITY CONTRACT (do not break)
//   This module READS `getWorld()`, `r` and the terrain/source arrays. It never writes to
//   them. It adds no collisions, no resources, no POIs, no entities, no economy, no
//   controls, no save data and no new gameplay law. All decoration is non-interactive and
//   non-blocking; the existing player, HUD, movement, routes and PixelFX/VFX stay intact.
//
// INTEGRATION SEAM (render.ts)
//   mapArtTexel()      — one hook at the top of texel(); returns a palette RGB or null.
//   mapArtGround()     — one call after the terrain chunks, before footprints/entities.
//   mapArtDrawables()  — one spread into the existing y-sorted drawable list.
//   mapArtLights()     — one spread into drawLight()'s existing `lights` array.
//   Nothing in the particles / weather / lighting functions is rewritten, so a concurrent
//   PixelFX/VFX change only has to keep those four one-line call sites.

import { WW, WH, TILE, VIEW_W, VIEW_H, T, hash2, type RunState } from './core';
import { getWorld, SRC_KEYS } from './world';
import { darkness } from './engine';

type RGB = [number, number, number];
type G = CanvasRenderingContext2D;

const H = (c: string): RGB => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** One shared 36-colour ladder: cool blue-violet darks → warm brass/ivory lights.
 *  All authored terrain pixels are exact members of this ladder (no arbitrary RGB). */
export const MAP_ART_RAMPS = {
  void:  ['#080e18', '#101a2c', '#18263c', '#22344e', '#304760', '#445e78'],
  water: ['#0d2740', '#123a58', '#1a5573', '#287a90', '#3f9fa8', '#78c9be'],
  sand:  ['#4a3a28', '#715537', '#9a7448', '#c29a5e', '#dfc184', '#f4e3b8'],
  green: ['#152b20', '#1e3f28', '#2a5531', '#3a7040', '#549050', '#79b267'],
  stone: ['#1a202c', '#28313f', '#3a4554', '#556270', '#778594', '#a9b4bd'],
  warm:  ['#2a1a14', '#5a3018', '#8a4e22', '#bb7b30', '#e2ad50', '#ffe0a0'],
} as const;
type Ramp = keyof typeof MAP_ART_RAMPS;
const C = (r: Ramp, i: number): RGB => H(MAP_ART_RAMPS[r][Math.max(0, Math.min(5, i))]);

/** The connected first-hour slice: Fisher's Point → south-coast forest/beach → lighthouse
 *  spit and the Halcyon Hull wreck approach. Edges are dither-feathered (see edgeWeight). */
export const MAP_ART_REGION = { x0: 20, y0: 140, x1: 146, y1: 196, name: "Fisher's Point coastal/forest/resource corridor" } as const;
const FEATHER = 7;
/** 0 at the region edge, 1 in the core; also used as a deterministic dither probability. */
function edgeWeight(tx: number, ty: number) {
  const d = Math.min(tx - MAP_ART_REGION.x0, MAP_ART_REGION.x1 - tx, ty - MAP_ART_REGION.y0, MAP_ART_REGION.y1 - ty);
  return d <= 0 ? 0 : d >= FEATHER ? 1 : d / FEATHER;
}
const inRegion = (tx: number, ty: number) => tx >= MAP_ART_REGION.x0 && tx <= MAP_ART_REGION.x1 && ty >= MAP_ART_REGION.y0 && ty <= MAP_ART_REGION.y1;
const SHORE_Y = 183; // south-coast surf line, read from world.ts's sea flood fill

const TALL_SRC = new Set(['oak', 'pine', 'snowpine', 'palm', 'willow', 'deadtree']);
const GLINT_SRC = new Set(['rock', 'iron', 'coalv', 'crystal', 'salt_shale', 'herb', 'mushroom']);

export interface TexelCtx { s: number; n: number; e: number; w: number; zone: number; sea: number }

/** Cached static terrain hook. `null` means "keep the engine's original texel". */
export function mapArtTexel(t: number, wx: number, wy: number, tx: number, ty: number, ctx: TexelCtx): RGB | null {
  if (!inRegion(tx, ty)) return null;
  const wgt = edgeWeight(tx, ty);
  if (wgt < 1 && hash2(tx, ty, 4242) > wgt) return null;
  const px = wx & 15, py = wy & 15;
  const q = (a: number, b: number, s: number) => hash2(a, b, s);
  const block = q(wx >> 2, wy >> 2, 9001);   // 4x4 value clusters, not per-pixel noise
  const grain = q(wx >> 1, wy >> 1, 9002);
  const sea = ctx.sea;                        // 255 = inland, 0 = sea, 1..6 = near shore
  const wet = sea !== 255 && sea <= 1;
  const depth = Math.max(0, ty - SHORE_Y);    // seaward depth for water bands

  switch (t) {
    case T.DEEP: {
      // Broad, low-contrast stepped swells. No near-black bands: the sea must stay calm.
      const wv = Math.sin(wx * 0.07 + Math.sin(wy * 0.04) * 1.5 + wy * 0.022);
      let c = depth < 3 ? C('water', 2) : C('void', 2);
      if (wv > 0.7) c = depth < 3 ? C('water', 3) : C('water', 1);
      else if (wv < -0.8) c = depth < 3 ? C('water', 1) : C('void', 1);
      if (wv > 0.95 && grain > 0.88) c = C('water', 4);          // sparse crisp wave lip
      return c;
    }
    case T.SHALLOW: case T.RIVER: {
      const fresh = t === T.RIVER || (getWorld().fresh[ty * WW + tx] === 1);
      const wv = Math.sin(wx * 0.1 + Math.sin(wy * 0.055) * 1.2 + wy * 0.03);
      let c = fresh ? (wv > 0.6 ? C('water', 3) : C('water', 2))
        : wv > 0.78 ? C('water', 4) : wv > 0.15 ? C('water', 3) : C('water', 2);
      if (!fresh && wv > 0.94 && grain > 0.85) c = C('sand', 5);  // sparse surf
      const landN = ctx.n !== T.DEEP && ctx.n !== T.SHALLOW && ctx.n !== T.RIVER;
      if (!fresh && sea <= 1 && landN && py === 0 && grain > 0.5) c = C('sand', 5); // true shoreline foam
      if (fresh && grain > 0.997) c = C('green', 4);              // reed fleck
      return c;
    }
    case T.SAND: {
      let c = wet ? C('sand', 1) : sea !== 255 && sea <= 3 ? C('sand', 3) : C('sand', 4);
      if (!wet && block > 0.7) c = C('sand', 4);
      else if (block < 0.16) c = C('sand', 2);
      if (wet && block > 0.82) c = C('void', 3);                  // wet pool, cool-shifted
      const ridge = (wy + Math.floor(wx / 6) * 2) % 16;           // hard dune contour
      if (!wet && ridge === 0) c = C('sand', 2);
      if (!wet && ridge === 1) c = C('sand', 5);                  // lit dune lip
      const waterS = ctx.s === T.SHALLOW || ctx.s === T.DEEP || ctx.s === T.RIVER;
      if (sea <= 1 && waterS && py === 15 && grain > 0.5) c = C('sand', 5); // broken waterline foam
      if (grain > 0.996) c = C('stone', 4);                       // shells / pebbles
      if (grain < 0.004) c = C('warm', 2);                        // rust fleck
      return c;
    }
    case T.GRASS: case T.MEADOW: {
      let c = block > 0.68 ? C('green', 4) : block > 0.32 ? C('green', 3) : C('green', 2);
      if (block < 0.13) c = C('green', 1);
      if (t === T.MEADOW && block > 0.84) c = C('green', 5);
      if ((wx & 3) === 0 && (wy & 3) === 0 && block > 0.55) c = C('green', 5); // upper-left light
      if (grain > 0.996) c = C('green', 5);                       // grass tuft
      if (grain < 0.004) c = C('warm', 5);                        // tiny flower
      return c;
    }
    case T.FOREST: {
      const i = ty * WW + tx, k = getWorld().src[i];
      const canopy = k >= 0 && TALL_SRC.has(SRC_KEYS[k]);
      let c = canopy ? (block > 0.62 ? C('green', 2) : C('green', 1))
        : block > 0.72 ? C('green', 4) : block > 0.3 ? C('green', 3) : C('green', 2);
      if (grain > 0.997) c = C('warm', 1);                         // sparse leaf litter
      if (grain < 0.003) c = C('stone', 2);                        // pebble
      if ((wx + Math.floor(wy / 5) * 3) % 23 === 0 && block < 0.5) c = C('green', 1); // root line
      return c;
    }
    case T.MARSH: {
      let c = block > 0.58 ? C('green', 1) : C('void', 2);         // readable dark water
      if (block > 0.84) c = C('water', 2);
      if (grain > 0.94) c = C('green', 4);                         // reed rim
      if (grain < 0.02) c = C('warm', 2);
      return c;
    }
    case T.HILL: {
      let c = block > 0.62 ? C('stone', 3) : C('stone', 2);
      if (py % 5 === 0) c = C('stone', 1);                         // strata crevice
      if (py % 5 === 1) c = C('stone', 4);                         // lit stratum
      if (block > 0.9) c = C('stone', 5);
      if (grain > 0.99) c = C('void', 0);
      return c;
    }
    case T.ROAD: {
      // Clean compacted earth with a stone edge trim. No per-tile stripe pattern:
      // the engine blends ROAD into neighbouring tiles, so stripes would read as curtains.
      let c = block > 0.6 ? C('warm', 2) : C('warm', 1);
      if (block < 0.16) c = C('warm', 0);
      if (grain > 0.97) c = C('warm', 3);                          // scattered wear
      if ((ctx.n !== T.ROAD && ctx.n !== T.BRIDGE && py === 0) || (ctx.s !== T.ROAD && ctx.s !== T.BRIDGE && py === 15)) c = C('stone', 2);
      if ((ctx.w !== T.ROAD && ctx.w !== T.BRIDGE && px === 0) || (ctx.e !== T.ROAD && ctx.e !== T.BRIDGE && px === 15)) c = C('stone', 2);
      if (tx % 4 === 0 && (px === 8 || px === 9) && (py === 7 || py === 8)) c = C('warm', 4); // brass waymark
      return c;
    }
    default: return null; // POI floors/walls, bridges, lava, snow, ash, toxic: engine art unchanged
  }
}

// ---------------------------------------------------------------------------
// Own authored pixel-art sprites (offscreen canvases, integer pixels, no smoothing)
// ---------------------------------------------------------------------------
const spriteCache = new Map<string, HTMLCanvasElement>();
function sprite(id: string, w: number, h: number, fn: (g: G) => void): HTMLCanvasElement {
  const hit = spriteCache.get(id); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; fn(g);
  spriteCache.set(id, c); return c;
}
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
const P = (g: G, x: number, y: number, c: string) => R(g, x, y, 1, 1, c);
function line(g: G, x0: number, y0: number, x1: number, y1: number, c: string, w = 1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= n; i++) { const t = i / Math.max(1, n); R(g, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w, w, c); }
}
const V = (i: number) => MAP_ART_RAMPS.void[i], W = (i: number) => MAP_ART_RAMPS.warm[i];
const S = (i: number) => MAP_ART_RAMPS.stone[i], Gc = (i: number) => MAP_ART_RAMPS.green[i];
const Sa = (i: number) => MAP_ART_RAMPS.sand[i];

function makeBeacon() {
  return sprite('beacon', 24, 44, g => {
    // tripod: three splayed weathered legs + two cross braces
    line(g, 3, 42, 10, 16, V(1), 2); line(g, 12, 42, 12, 16, V(2), 2); line(g, 21, 42, 14, 16, V(1), 2);
    line(g, 5, 34, 19, 34, V(2), 1); line(g, 7, 26, 17, 26, V(1), 1);
    line(g, 6, 34, 16, 26, W(3), 1); line(g, 18, 34, 8, 26, W(2), 1);
    // upper-left rim light on the legs
    line(g, 3, 42, 10, 16, W(2), 1); line(g, 21, 42, 14, 16, W(1), 1);
    // platform
    R(g, 6, 13, 12, 3, W(1)); R(g, 6, 12, 12, 1, W(3)); R(g, 6, 15, 12, 1, V(0));
    // brass lantern housing
    R(g, 8, 3, 8, 10, V(1)); R(g, 9, 4, 6, 8, W(2));
    R(g, 10, 5, 4, 6, W(5)); R(g, 11, 6, 2, 4, W(4));
    R(g, 8, 3, 8, 1, W(4)); R(g, 8, 12, 8, 1, W(4));
    R(g, 10, 0, 4, 3, V(1)); R(g, 11, 1, 2, 2, W(3));
    R(g, 7, 2, 1, 1, W(4)); R(g, 16, 2, 1, 1, W(4));
    // hanging net / rope
    line(g, 6, 16, 6, 24, Sa(3), 1); line(g, 18, 16, 18, 22, Sa(3), 1);
    R(g, 5, 22, 4, 1, Sa(2)); R(g, 16, 21, 4, 1, Sa(2));
  });
}
function makeCairn() {
  return sprite('cairn', 12, 12, g => {
    R(g, 1, 9, 10, 2, V(1)); R(g, 2, 7, 8, 3, S(2)); R(g, 3, 8, 6, 1, S(4));
    R(g, 3, 4, 6, 4, S(3)); R(g, 4, 5, 4, 1, S(5));
    R(g, 4, 1, 4, 3, S(2)); R(g, 5, 2, 2, 1, S(5));
    R(g, 2, 10, 8, 1, Gc(1)); R(g, 3, 11, 1, 1, Gc(3)); R(g, 9, 11, 1, 1, Gc(3));
  });
}
function makePost() {
  return sprite('post', 12, 24, g => {
    R(g, 2, 22, 8, 2, V(1)); R(g, 4, 7, 4, 15, W(1)); R(g, 5, 7, 1, 15, W(3));
    R(g, 3, 6, 6, 2, W(2)); R(g, 3, 5, 6, 1, W(4));
    R(g, 4, 1, 4, 5, V(1)); R(g, 5, 2, 2, 3, W(5)); R(g, 6, 2, 1, 3, W(4));
    R(g, 3, 0, 6, 1, W(4)); R(g, 4, 6, 4, 1, V(0));
    line(g, 2, 12, 0, 18, Sa(3), 1); line(g, 10, 12, 12, 18, Sa(3), 1);
  });
}
function makeDory() {
  return sprite('dory', 32, 16, g => {
    // upturned hull silhouette
    R(g, 2, 10, 28, 4, V(1)); R(g, 4, 8, 24, 3, W(1)); R(g, 6, 6, 20, 3, W(2));
    R(g, 8, 5, 16, 2, W(3)); R(g, 10, 4, 12, 2, Sa(3));
    line(g, 2, 10, 8, 5, W(3), 1); line(g, 30, 10, 24, 5, W(3), 1);
    line(g, 3, 13, 29, 13, V(0), 1);
    for (let x = 8; x <= 24; x += 4) { R(g, x, 6, 1, 5, V(2)); R(g, x + 1, 6, 1, 5, W(1)); }
    R(g, 6, 8, 20, 1, W(4));                 // lit gunwale
    R(g, 1, 12, 3, 1, V(2)); R(g, 28, 12, 3, 1, V(2));
    R(g, 14, 2, 4, 2, V(2)); R(g, 15, 1, 2, 2, Sa(4)); // broken thole
  });
}
function makeStones() {
  return sprite('stones', 20, 20, g => {
    R(g, 1, 17, 18, 2, V(1));
    R(g, 2, 8, 5, 10, S(2)); R(g, 3, 7, 3, 2, S(4)); R(g, 2, 8, 1, 9, S(4)); R(g, 6, 9, 1, 8, V(1));
    R(g, 8, 3, 5, 15, S(3)); R(g, 9, 2, 3, 2, S(5)); R(g, 8, 3, 1, 14, S(5)); R(g, 12, 4, 1, 13, V(1));
    R(g, 14, 9, 4, 9, S(2)); R(g, 15, 8, 2, 2, S(4)); R(g, 17, 9, 1, 8, V(1));
    R(g, 3, 16, 4, 1, Gc(2)); R(g, 9, 17, 3, 1, Gc(1)); R(g, 15, 16, 3, 1, Gc(2));
    R(g, 10, 8, 1, 1, W(4)); R(g, 11, 11, 1, 1, W(4)); // carved brass studs
  });
}
function makeMast() {
  return sprite('mast', 20, 40, g => {
    R(g, 1, 37, 18, 2, V(1)); R(g, 8, 4, 4, 34, W(1)); R(g, 9, 4, 1, 34, W(3));
    R(g, 4, 12, 12, 2, W(2)); R(g, 3, 11, 2, 4, W(3)); R(g, 15, 11, 2, 4, W(2));
    // torn sail
    R(g, 3, 14, 7, 12, Sa(4)); R(g, 4, 15, 5, 9, Sa(5));
    line(g, 3, 14, 10, 26, Sa(2), 1); line(g, 10, 14, 6, 22, Sa(3), 1);
    R(g, 3, 24, 8, 1, Sa(2)); R(g, 5, 27, 4, 1, V(2)); R(g, 3, 29, 3, 1, Sa(4));
    line(g, 12, 8, 18, 16, V(2), 1); line(g, 8, 6, 2, 14, V(2), 1);
    R(g, 9, 0, 2, 4, W(4)); R(g, 8, 3, 4, 1, W(5));
  });
}
const SPRITES: Record<string, () => HTMLCanvasElement> = {
  beacon: makeBeacon, cairn: makeCairn, post: makePost, dory: makeDory, stones: makeStones, mast: makeMast,
};

// ---------------------------------------------------------------------------
// Declarative landmark / light table. Positions are tile coordinates in the REAL
// 200x200 island. A landmark is skipped if a real resource or POI building occupies
// its tile, so no gameplay object is ever hidden by decoration.
// ---------------------------------------------------------------------------
interface Landmark { id: string; kind: keyof typeof SPRITES; tx: number; ty: number; oy?: number }
export const MAP_ART_LANDMARKS: Landmark[] = [
  { id: 'fp-beacon', kind: 'beacon', tx: 80, ty: 176 },
  { id: 'fp-cairn-1', kind: 'cairn', tx: 58, ty: 172 },
  { id: 'fp-cairn-2', kind: 'cairn', tx: 66, ty: 172 },
  { id: 'fp-cairn-3', kind: 'cairn', tx: 74, ty: 171 },
  { id: 'fp-post-1', kind: 'post', tx: 76, ty: 173 },
  { id: 'fp-post-2', kind: 'post', tx: 90, ty: 174 },
  { id: 'fp-post-3', kind: 'post', tx: 92, ty: 176 },
  { id: 'fp-dory', kind: 'dory', tx: 84, ty: 180 },
  { id: 'fp-stones-1', kind: 'stones', tx: 70, ty: 180 },
  { id: 'fp-stones-2', kind: 'stones', tx: 100, ty: 180 },
  { id: 'fp-mast', kind: 'mast', tx: 118, ty: 178 },
];
export const MAP_ART_LIGHTS = [
  { id: 'fp-beacon-light', tx: 80, ty: 176, dy: -14, rad: 54, col: '#ffb44a' },
  { id: 'fp-post-1-light', tx: 76, ty: 173, dy: -16, rad: 26, col: '#ff9a3a' },
  { id: 'fp-post-2-light', tx: 90, ty: 174, dy: -16, rad: 26, col: '#ff9a3a' },
  { id: 'fp-post-3-light', tx: 92, ty: 176, dy: -16, rad: 26, col: '#ff9a3a' },
];

function landmarkValid(l: Landmark) {
  const w = getWorld(), i = l.ty * WW + l.tx;
  if (w.src[i] >= 0) return false;
  const t = w.tiles[i];
  if (t === T.FLOOR || t === T.PWALL || t === T.BRIDGE || t === T.DEEP || t === T.LAVA || t === T.CLIFF) return false;
  if (w.buildings.some(b => l.tx >= b.x - 1 && l.tx <= b.x + b.w && l.ty >= b.y - 1 && l.ty <= b.y + b.h)) return false;
  return true;
}

function contactShadow(g: G, x: number, y: number, rw: number, a = 0.42) {
  g.fillStyle = `rgba(8,12,24,${a})`;
  for (let yy = 0; yy <= Math.max(2, rw >> 1); yy++) {
    const half = Math.round(rw * (1 - yy / (Math.max(2, rw >> 1) + 1)));
    if (half <= 0) continue;
    g.fillRect(Math.round(x - half), Math.round(y + yy), half * 2, 1);
  }
}

/** Animated world-space ground layer. Called once per frame after the terrain chunks. */
export function mapArtGround(g: G, r: RunState, cx: number, cy: number, time: number, now: number) {
  const w = getWorld();
  const x0 = Math.max(0, Math.floor(cx / TILE) - 2), x1 = Math.min(WW - 1, Math.floor((cx + VIEW_W) / TILE) + 2);
  const y0 = Math.max(0, Math.floor(cy / TILE) - 2), y1 = Math.min(WH - 1, Math.floor((cy + VIEW_H) / TILE) + 3);
  const dark = darkness(r, now);
  const surf = Math.floor(time / 260) % 4;

  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!inRegion(tx, ty)) continue;
    const wgt = edgeWeight(tx, ty); if (wgt <= 0) continue;
    const i = ty * WW + tx, t = w.tiles[i], X = tx * TILE, Y = ty * TILE;
    const sea = w.seaDist[i] ?? 255;

    // Canopy contact shadows: hard-edged, offset to the lower-right of the light.
    const k = w.src[i];
    if (k >= 0 && TALL_SRC.has(SRC_KEYS[k]) && wgt > 0.25) {
      g.globalAlpha = 0.3 * wgt; contactShadow(g, X + 13, Y + 11, 10, 0.5); g.globalAlpha = 1;
    }
    // A single sparse animated surf lip. The engine's own water animation is left in
    // charge of the rest, so the sea stays calm instead of turning into static.
    if ((t === T.SHALLOW || t === T.RIVER) && sea <= 1) {
      const ph = (Math.floor(time / 520) + tx * 3 + ty) % 11;
      if (ph < 1) { g.fillStyle = 'rgba(244,227,184,0.8)'; g.fillRect(X + ((surf * 3) & 15), Y + 2, 4, 1); }
    }
    // Resource discoverability: a single slow glint on real ore/herb source tiles.
    // Derived from the authoritative source array; creates no new pickup or rule.
    if (k >= 0 && GLINT_SRC.has(SRC_KEYS[k]) && (Math.floor(time / 900) + tx * 5 + ty * 3) % 17 === 0) {
      g.fillStyle = SRC_KEYS[k] === 'crystal' ? '#bff0ff' : SRC_KEYS[k] === 'herb' || SRC_KEYS[k] === 'mushroom' ? Gc(5) : W(4);
      g.fillRect(X + 7 + (hash2(tx, ty, 3) * 4 | 0), Y + 6, 1, 1);
    }
    // Hazard readability: marsh reeds and a cool rim on deep water.
    if (t === T.MARSH && hash2(tx, ty, 5) > 0.5) { g.fillStyle = 'rgba(121,178,103,0.85)'; g.fillRect(X + 3, Y + 11, 2, 4); g.fillRect(X + 11, Y + 9, 2, 5); }
  }
  // Warm ground bloom under the authored lanterns — strongest at night, uses the
  // renderer's existing darkness value and does not replace the VFX light pass.
  if (dark > 0.12) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const l of MAP_ART_LIGHTS) {
      const X = l.tx * TILE + 8, Y = l.ty * TILE + 8;
      if (X < cx - 60 || X > cx + VIEW_W + 60 || Y < cy - 60 || Y > cy + VIEW_H + 60) continue;
      g.fillStyle = l.col; g.globalAlpha = 0.05 + dark * 0.06;
      for (let k = 3; k >= 1; k--) { g.beginPath(); g.arc(X, Y + 8, k * 8, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  }
}

/** Y-sorted decorative drawables, inserted into the renderer's existing depth list.
 *  The context is captured by each closure; no module-level mutable draw state. */
export function mapArtDrawables(g: G, _r: RunState, cx: number, cy: number, time: number): { y: number; f: () => void }[] {
  const out: { y: number; f: () => void }[] = [];
  for (const l of MAP_ART_LANDMARKS) {
    if (!landmarkValid(l)) continue;
    const X = l.tx * TILE + 8, Y = l.ty * TILE + 8;
    if (X < cx - 48 || X > cx + VIEW_W + 48 || Y < cy - 60 || Y > cy + VIEW_H + 60) continue;
    const spr = SPRITES[l.kind]();
    const oy = l.oy ?? 0;
    out.push({ y: Y + 6, f: () => {
      contactShadow(g, X + 4, Y + 5, Math.max(5, spr.width >> 2), 0.4);
      g.drawImage(spr, Math.round(X - spr.width / 2), Math.round(Y + 8 - spr.height) + oy);
      if ((l.kind === 'beacon' || l.kind === 'post') && Math.floor(time / 130) % 7 !== 0) {
        g.fillStyle = W(5); g.fillRect(Math.round(X - 1), Math.round(Y + 8 - spr.height) + 5, 2, 1);
      }
    } });
  }
  return out;
}

/** Warm lights contributed to drawLight()'s existing `lights` array (no VFX rewrite). */
export function mapArtLights(_r: RunState, time: number): [number, number, number, string][] {
  const out: [number, number, number, string][] = [];
  for (const l of MAP_ART_LIGHTS) {
    if (!MAP_ART_LANDMARKS.some(m => m.tx === l.tx && m.ty === l.ty && landmarkValid(m))) continue;
    out.push([l.tx * TILE + 8, l.ty * TILE + 8 + l.dy, l.rad + Math.sin(time / 170 + l.tx) * 3, l.col]);
  }
  return out;
}

export function resetMapArt() { spriteCache.clear(); }
