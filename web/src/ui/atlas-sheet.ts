import { T } from '../game/core';
import { sampleTile } from '../veyra05/reader';
import { FRAME_W, FRAME_H } from '../veyra05/frame';

// ---------------------------------------------------------------------------
// ATLAS SHEETS — the terrain picture under the field chart, at two levels of detail.
//
//   overview : 300 x 210, one pixel per ~13 tiles. Enough for the whole continent.
//   detail   : 1000 x 700, one pixel per 4 x 4 tiles. Shown once the chart is zoomed in.
//
// Both are sampled from the same authoritative reader the world is built from, and both are the same for every run,
// so each is painted once per session, a slice at a time so the panel never stalls. The detail sheet stops at one
// sample per 4 x 4 tiles on purpose: that is the lie of the land, never the outline of what stands on it.
// ---------------------------------------------------------------------------

export function veyraContinentTileColor(t: number): string {
  switch (t) {
    case T.DEEP: return '#14243a';
    case T.SHALLOW: case T.RIVER: return '#265c84';
    case T.SAND: return '#b8a26e';
    case T.GRASS: case T.MEADOW: return '#426e3c';
    case T.FOREST: return '#284a2a';
    case T.MARSH: return '#3a5442';
    case T.HILL: case T.CLIFF: return '#68625c';
    case T.SNOW: return '#cad8e4';
    case T.ASH: return '#4e3c38';
    case T.TOXIC: return '#5a6e2e';
    case T.ROAD: case T.FLOOR: return '#9a8462';
    default: return '#426e3c';
  }
}

export const OVERVIEW_W = 300;
export const OVERVIEW_H = 210;
/** Tiles per pixel of the detail sheet. */
export const DETAIL_TPP = 4;
export const DETAIL_W = FRAME_W / DETAIL_TPP;
export const DETAIL_H = FRAME_H / DETAIL_TPP;
const BAND = 10;

const waiters = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

let overview: HTMLCanvasElement | null = null;
let overviewRows = 0;

let detail: HTMLCanvasElement | null = null;
let detailBands: Uint8Array | null = null;
let detailLeft = 0;
let detailFocus = 0;
let detailWanted = false;

const rgbCache = new Map<number, [number, number, number]>();
function rgbOf(t: number): [number, number, number] {
  let c = rgbCache.get(t);
  if (!c) {
    const n = parseInt(veyraContinentTileColor(t).slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(t, c);
  }
  return c;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  let g: CanvasRenderingContext2D | null = null;
  try { g = c.getContext('2d'); } catch { g = null; }
  return g ? c : null;
}

function paintOverview(budgetMs: number): void {
  const g = overview?.getContext('2d');
  if (!g) { overviewRows = OVERVIEW_H; return; }
  const t0 = performance.now();
  while (overviewRows < OVERVIEW_H) {
    const y = overviewRows;
    const ty = Math.min(FRAME_H - 1, Math.floor((y + 0.5) * FRAME_H / OVERVIEW_H));
    const img = g.createImageData(OVERVIEW_W, 1);
    for (let x = 0; x < OVERVIEW_W; x++) {
      const tx = Math.min(FRAME_W - 1, Math.floor((x + 0.5) * FRAME_W / OVERVIEW_W));
      const [cr, cg, cb] = rgbOf(sampleTile(tx, ty).tile);
      img.data[x * 4] = cr; img.data[x * 4 + 1] = cg; img.data[x * 4 + 2] = cb; img.data[x * 4 + 3] = 255;
    }
    g.putImageData(img, 0, y);
    overviewRows++;
    if (performance.now() - t0 > budgetMs) break;
  }
}

/** Paint the band of the detail sheet nearest to the row being looked at. */
function paintDetailBand(): void {
  const g = detail?.getContext('2d');
  if (!g || !detailBands) { detailLeft = 0; return; }
  const want = Math.max(0, Math.min(detailBands.length - 1, Math.floor(detailFocus / BAND)));
  let pick = -1;
  for (let d = 0; d < detailBands.length && pick < 0; d++) {
    if (want - d >= 0 && !detailBands[want - d]) pick = want - d;
    else if (want + d < detailBands.length && !detailBands[want + d]) pick = want + d;
  }
  if (pick < 0) { detailLeft = 0; return; }
  const y0 = pick * BAND, rows = Math.min(BAND, DETAIL_H - y0);
  const img = g.createImageData(DETAIL_W, rows);
  for (let y = 0; y < rows; y++) {
    const ty = (y0 + y) * DETAIL_TPP + (DETAIL_TPP >> 1);
    for (let x = 0; x < DETAIL_W; x++) {
      const [cr, cg, cb] = rgbOf(sampleTile(x * DETAIL_TPP + (DETAIL_TPP >> 1), ty).tile);
      const i = (y * DETAIL_W + x) * 4;
      img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, y0);
  detailBands[pick] = 1;
  detailLeft--;
}

function pending(): boolean {
  return (!!overview && overviewRows < OVERVIEW_H) || (detailWanted && !!detail && detailLeft > 0);
}

function schedule(): void {
  if (timer || !pending()) return;
  const step = () => {
    timer = null;
    if (overview && overviewRows < OVERVIEW_H) paintOverview(8);
    else if (detailWanted && detail && detailLeft > 0) paintDetailBand();
    const done = !pending();
    const list = [...waiters];
    if (done) waiters.clear();
    for (const w of list) w();
    if (!done) timer = setTimeout(step, 0);
  };
  timer = setTimeout(step, 0);
}

/** The overview sheet as far as it is painted; `onProgress` fires when more is ready. Null where there is no canvas (tests). */
export function overviewSheet(onProgress?: () => void): HTMLCanvasElement | null {
  if (!overview) {
    overview = makeCanvas(OVERVIEW_W, OVERVIEW_H);
    if (!overview) return null;
    const g = overview.getContext('2d')!;
    g.fillStyle = '#0c141b'; g.fillRect(0, 0, OVERVIEW_W, OVERVIEW_H);
  }
  if (overviewRows < OVERVIEW_H) { if (onProgress) waiters.add(onProgress); schedule(); }
  return overview;
}

/** The detail sheet. Rows not painted yet are transparent, so the overview shows through. `focusTileY` is the row
 *  of the continent the player is looking at: it is painted first. */
export function detailSheet(onProgress: (() => void) | undefined, focusTileY: number): HTMLCanvasElement | null {
  if (!detail) {
    detail = makeCanvas(DETAIL_W, DETAIL_H);
    if (!detail) return null;
    detailBands = new Uint8Array(Math.ceil(DETAIL_H / BAND));
    detailLeft = detailBands.length;
  }
  detailWanted = true;
  detailFocus = focusTileY / DETAIL_TPP;
  if (detailLeft > 0) { if (onProgress) waiters.add(onProgress); schedule(); }
  return detail;
}

/** True once both sheets are complete. */
export const sheetsReady = (): boolean => !!overview && overviewRows >= OVERVIEW_H && !!detail && detailLeft === 0;
