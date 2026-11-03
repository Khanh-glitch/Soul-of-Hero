// MAP-R01 — SOH real-asset bridge for the playable Web runtime.
// Visual-only. Terrain state, collisions, sources, gameplay, save and controls stay authoritative.
// Loads ONE small crop sheet (only admitted A1 frames); selects authored frames deterministically.
import sliceUrl from './assets/soh_slice_atlas.png?inline';
import ledger from './assets/frame_ledger.v1.json';
import { TILE, WW, WH, T, type RunState } from './core';
import { effTile } from './engine';

interface FrameRec { rect: [number, number, number, number]; }
const FRAMES = (ledger as unknown as { frames: Record<string, FrameRec> }).frames;
const CH = 16;

let sheet: HTMLImageElement | null = null;
let ready = false;
// SSR / node-test safe: no Image global means the bridge stays dormant and the
// untouched Web renderer is used (visual-only feature, never a hard dependency).
const img: HTMLImageElement | null = typeof Image !== 'undefined' ? new Image() : null;
if (img) {
  img.onload = () => { sheet = img; ready = true; };
  img.onerror = () => { ready = false; };
  img.src = sliceUrl;
}

export function worldAssetsReady(): boolean { return ready; }

/** Explicit per-material decisions. false = KEEP the original Web material for that family. */
export const ASSET_DECISIONS = {
  ground: true,       // REPLACE grass / meadow / forest / sand bases with A1 authored 16px tiles
  water: true,        // REPLACE shallow / deep / river bases
  coast: true,        // REPLACE shoreline with A1 coast + grass/water blend sets
  grassForest: true,  // REPLACE grass<->forest edges with A1 blend sets
  road: false,        // KEEP Web road (A1 plank set reads as boardwalk, not the island road)
  props: false,       // KEEP all Web resource sprites: A1 inherited props are darker/boxier (direct A/B/C review)
};

type Cls = 'grass' | 'meadow' | 'forest' | 'sand' | 'water' | 'road' | null;
function cls(t: number): Cls {
  switch (t) {
    case T.GRASS: return 'grass';
    case T.MEADOW: return 'meadow';
    case T.FOREST: return 'forest';
    case T.SAND: return 'sand';
    case T.SHALLOW: case T.DEEP: case T.RIVER: return 'water';
    case T.ROAD: return 'road';
    default: return null; // BURNT / ICE / SNOW / ASH / TOXIC / LAVA / BRIDGE / FLOOR / etc = KEEP
  }
}

// Integer hash of the tile identity only. It picks a texture VARIANT inside an already
// authored material; it never paints a tile, invents geometry or derives a biome.
function variant(tx: number, ty: number, salt: number): number {
  let h = Math.imul(tx + 1, 73856093) ^ Math.imul(ty + 1, 19349663) ^ Math.imul(salt + 1, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

type TileAt = (x: number, y: number) => number;
const isW = (t: number) => cls(t) === 'water';
const isF = (t: number) => cls(t) === 'forest';
const isG = (t: number) => cls(t) === 'grass' || cls(t) === 'meadow';
const isR = (t: number) => cls(t) === 'road';

/** A1 corner-mask convention (decoded from atlas pixels): 1=TL 2=TR 4=BR 8=BL. */
function cornerMask(at: TileAt, tx: number, ty: number, pred: (t: number) => boolean): number {
  const N = pred(at(tx, ty - 1)), E = pred(at(tx + 1, ty)), S = pred(at(tx, ty + 1)), W = pred(at(tx - 1, ty));
  const NW = pred(at(tx - 1, ty - 1)), NE = pred(at(tx + 1, ty - 1)), SE = pred(at(tx + 1, ty + 1)), SW = pred(at(tx - 1, ty + 1));
  return ((N || W || NW) ? 1 : 0) | ((N || E || NE) ? 2 : 0) | ((S || E || SE) ? 4 : 0) | ((S || W || SW) ? 8 : 0);
}
/** A1 edge-mask convention (decoded from atlas pixels): 1=N 2=E 4=S 8=W. */
function edgeMask(at: TileAt, tx: number, ty: number, pred: (t: number) => boolean): number {
  return (pred(at(tx, ty - 1)) ? 1 : 0) | (pred(at(tx + 1, ty)) ? 2 : 0)
    | (pred(at(tx, ty + 1)) ? 4 : 0) | (pred(at(tx - 1, ty)) ? 8 : 0);
}

function grassBase(c: Cls, v: number): string {
  // Meadow uses the A1 silt-margin family; ordinary grass uses the calm tuft family.
  return c === 'meadow' ? `mix_grass_silt_${v % 15 + 1}` : `grass_${v % 4}`;
}
function forestBase(v: number): string { return `forest_${v % 4}`; }

function select(tx: number, ty: number, t: number, c: Cls, at: TileAt): string[] {
  if (!ASSET_DECISIONS.ground) return [];
  const v = variant(tx, ty, 0);
  switch (c) {
    case 'grass': case 'meadow': {
      if (ASSET_DECISIONS.coast) {
        const wm = cornerMask(at, tx, ty, isW);
        // 15 = all four corners water: never repaint a walkable tile as open sea.
        if (wm > 0 && wm < 15) return [`blend_grass_water_${wm}`];
      }
      if (ASSET_DECISIONS.grassForest) {
        const fm = cornerMask(at, tx, ty, isF);
        if (fm === 15) return [forestBase(v)];
        if (fm > 0) return [`blend_grass_forest_${fm}`];
      }
      return [grassBase(c, v)];
    }
    case 'forest': {
      if (ASSET_DECISIONS.grassForest) {
        const gm = cornerMask(at, tx, ty, isG);
        const idx = 15 & ~gm; // corners that remain forest
        if (gm > 0 && idx > 0) return [`blend_grass_forest_${idx}`];
      }
      return [forestBase(v)];
    }
    case 'sand': {
      if (ASSET_DECISIONS.coast) {
        const em = edgeMask(at, tx, ty, isW);
        if (em > 0 && em < 15) return [`coast_dune_tidal_${em}`];
      }
      return [`dune_${v % 4}`];
    }
    case 'water': {
      if (!ASSET_DECISIONS.water) return [];
      if (t === T.SHALLOW) return [`tidal_${v % 4}`];
      if (t === T.RIVER) return [`river_${v % 4}`];
      return [`lake_${v % 4}`];
    }
    case 'road': {
      if (!ASSET_DECISIONS.road) return [];
      const em = edgeMask(at, tx, ty, isR);
      const nearSand = isW(at(tx, ty)) || cls(at(tx, ty - 1)) === 'sand' || cls(at(tx, ty + 1)) === 'sand'
        || cls(at(tx - 1, ty)) === 'sand' || cls(at(tx + 1, ty)) === 'sand';
      // A1 roads are transparent overlays on an opaque base ground.
      return [nearSand ? `dune_${v % 4}` : `grass_${v % 4}`, `road_dirt_${em}`];
    }
    default: return [];
  }
}

/**
 * Draw admitted A1 frames on top of the engine's own chunk canvas. Returns false when the
 * sheet is not decoded yet (graceful fallback = untouched Web terrain).
 * No fillRect / hash / sine tile painting happens here — only authored frame blits.
 */
export function worldAssetChunk(r: RunState, cx: number, cy: number, cv: HTMLCanvasElement): boolean {
  if (!ready || !sheet || !sheet.complete) return false;
  const at: TileAt = (x, y) => (x < 0 || y < 0 || x >= WW || y >= WH) ? T.DEEP : effTile(r, x, y);
  const g = cv.getContext('2d'); if (!g) return false;
  g.imageSmoothingEnabled = false; // nearest-neighbour, integer 1:1 scale
  let drew = false;
  for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
    const tx = cx * CH + i, ty = cy * CH + j;
    const t = at(tx, ty), c = cls(t); if (!c) continue;
    const names = select(tx, ty, t, c, at); if (!names.length) continue;
    const X = i * TILE, Y = j * TILE;
    for (const n of names) {
      const f = FRAMES[n]; if (!f) continue;
      g.drawImage(sheet, f.rect[0], f.rect[1], f.rect[2], f.rect[3], X, Y, f.rect[2], f.rect[3]);
      drew = true;
    }
  }
  return drew;
}

/** Y-sorted A1 props pinned to REAL resource cells only. No invented landmarks, no collision change. */
// Candidate A1 prop frames for the existing y-sorted drawable list. REJECTED for this
// slice after direct visual comparison (see map_r01/KEEP_REPLACE_REJECT.md); retained as
// the provenance-pinned seam for the next production pass, gated by ASSET_DECISIONS.props.
const PROP_MAP: Record<string, string[]> = {
  rock: ['rock_a', 'rock_c'],
  bush: ['bush'],
  reed: ['reeds'],
};
/** Pure deterministic prop-frame selector (testable, no canvas required). */
export function propFrameFor(key: string, tx: number, ty: number): string | null {
  const arr = PROP_MAP[key]; if (!arr) return null;
  const name = arr[variant(tx, ty, 7) % arr.length];
  return FRAMES[name] ? name : null;
}
/** Pure deterministic material/frame selector (testable, no canvas required). */
export function selectFrameNames(tx: number, ty: number, t: number, at: (x: number, y: number) => number): string[] {
  const c = cls(t); if (!c) return [];
  return select(tx, ty, t, c, at);
}
export function worldAssetSource(g: CanvasRenderingContext2D, s: { key: string; stock: number }, tx: number, ty: number): boolean {
  if (!ready || !sheet || !sheet.complete || !ASSET_DECISIONS.props) return false;
  if (s.stock <= 0) return false; // keep the Web depleted-state feedback
  const name = propFrameFor(s.key, tx, ty); if (!name) return false;
  const f = FRAMES[name]; if (!f) return false;
  const w = f.rect[2], h = f.rect[3], X = tx * TILE, Y = ty * TILE;
  g.imageSmoothingEnabled = false;
  // Pixel ellipse shadow, matching the Web renderer's scale.
  g.fillStyle = 'rgba(10,8,20,0.32)';
  for (let k = 0; k < 3; k++) { const hw = Math.max(2, Math.round(w * 0.34) - k * 2); g.fillRect(Math.round(X + 8 - hw), Y + 12 + k, hw * 2, 1); }
  g.drawImage(sheet, f.rect[0], f.rect[1], w, h, Math.round(X + 8 - w / 2), Math.round(Y + 16 - h), w, h);
  return true;
}
