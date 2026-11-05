/**
 * WHOLE-MAP OVERVIEW — a small, lazily built, SAMPLED terrain raster used ONLY
 * when the viewer is zoomed out below the native 1x camera.
 *
 *  - 500 x 350 pixels; one pixel = one 8x8-tile block sampled at EXACT tile
 *    centres by the RAW GOLD-polygon sampler `u05TileRaw()`. The paint-level
 *    isolated-cell despeckle is deliberately NOT applied here: at an 8-tile
 *    stride a single speck is sub-pixel, and using the raw sampler keeps this
 *    whole-frame preview cheap (no 43,750 chunk-window rebuilds).
 *    That is 175,000 pixels / 525,000 tile samples — NOT an 11,200,000-cell
 *    array and NOT a full-frame allocation.
 *  - It is NOT the 8 AU WMP-04R1 analysis raster upscaled, and it is NOT
 *    advertised as authored runtime detail. It is an ANALYSIS/VIEWER preview:
 *    a coarse sample of real GOLD geometry at exact tile centres.
 *  - Thin features (6-tile roads, rivers) are preserved by taking the HIGHEST
 *    visual priority among 3 deterministic sample points inside each block.
 *  - Colours are the BASE colours of the verbatim live Gameplay PAL, so the
 *    Creator-liked Beacon road keeps the same material language.
 *  - Built progressively (a few rows per animation frame) so the UI never
 *    freezes; rows appear top-to-bottom as they are measured.
 */
import { T } from '../game/core';
import { u05TileRaw, FRAME_W, FRAME_H } from '../u05/world';

export const OV_W = 500;
export const OV_H = 350;
export const OV_STRIDE = FRAME_W / OV_W; // 8 tiles (= 4 AU at U=0.5); FRAME_H/OV_H is also 8

/** Base palette entries copied from the verbatim live render.ts PAL (first colour). */
const BASE: Record<number, [number, number, number]> = {
  [T.GRASS]: [0x4f, 0x8a, 0x3a], [T.MEADOW]: [0x7a, 0xa8, 0x4a], [T.FOREST]: [0x3a, 0x6e, 0x30],
  [T.SAND]: [0xdc, 0xc6, 0x8e], [T.SNOW]: [0xe6, 0xee, 0xf6], [T.HILL]: [0x8a, 0x7a, 0x62],
  [T.CLIFF]: [0x6e, 0x6a, 0x66], [T.MARSH]: [0x4a, 0x6a, 0x3e], [T.ASH]: [0x4a, 0x40, 0x44],
  [T.TOXIC]: [0x6a, 0x70, 0x38], [T.ROAD]: [0xa0, 0x80, 0x60], [T.BRIDGE]: [0x8a, 0x60, 0x38],
  [T.FLOOR]: [0x9a, 0x6a, 0x3e], [T.PWALL]: [0x4a, 0x40, 0x48], [T.DEEP]: [0x1e, 0x3c, 0x6a],
  [T.SHALLOW]: [0x2e, 0x6e, 0xa0], [T.RIVER]: [0x34, 0x78, 0xa8], [T.LAVA]: [0xc8, 0x3a, 0x1e],
  [T.BURNT]: [0x2e, 0x28, 0x26], [T.ICE]: [0xb8, 0xe0, 0xf0]
};
/** Higher wins inside a sampled block, so 6-tile roads / rivers stay visible. */
function priority(t: number) {
  if (t === T.ROAD || t === T.BRIDGE) return 9;
  if (t === T.RIVER) return 8;
  if (t === T.SHALLOW) return 7;
  if (t === T.LAVA || t === T.CLIFF || t === T.PWALL || t === T.ICE) return 6;
  if (t === T.DEEP) return 1;
  return 5; // all dry-land biomes
}

let cv: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let img: ImageData | null = null;
let buf: Uint32Array | null = null;
let row = 0, samples = 0, builtMs = 0, calls = 0;

function init() {
  cv = document.createElement('canvas'); cv.width = OV_W; cv.height = OV_H;
  ctx = cv.getContext('2d', { alpha: false })!;
  img = ctx.createImageData(OV_W, OV_H);
  buf = new Uint32Array(img.data.buffer);
  // Deep-water default so partially built rows still look like the map.
  const c = BASE[T.DEEP];
  buf.fill((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]);
  ctx.putImageData(img, 0, 0);
}

/** Build up to `maxRows` rows. Returns progress; call once per frame. */
export function buildOverviewRows(maxRows = 6) {
  if (!cv) init();
  const t0 = performance.now();
  calls++;
  const end = Math.min(OV_H, row + maxRows);
  for (; row < end; row++) {
    const ty0 = row * OV_STRIDE;
    for (let x = 0; x < OV_W; x++) {
      const tx0 = x * OV_STRIDE;
      let best = T.DEEP, bestPr = -1;
      // 3 deterministic exact tile centres inside the 8x8 block.
      for (const [ox, oy] of [[4, 4], [1, 1], [7, 7]] as [number, number][]) {
        const t = u05TileRaw(tx0 + ox, ty0 + oy);
        samples++;
        const p = priority(t);
        if (p > bestPr) { bestPr = p; best = t; }
      }
      const c = BASE[best] || BASE[T.GRASS];
      buf![row * OV_W + x] = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
    }
  }
  ctx!.putImageData(img!, 0, 0);
  builtMs += performance.now() - t0;
  return progress();
}
export function progress() {
  return {
    ready: row >= OV_H, rowsDone: row, rowsTotal: OV_H,
    pixels: OV_W * OV_H, builtPixels: row * OV_W, strideTiles: OV_STRIDE,
    tileSamples: samples, buildCalls: calls, buildMs: Math.round(builtMs),
    fullFrameAllocated: false, addressableCells: FRAME_W * FRAME_H,
    note: 'Sampled viewer preview of EXACT GOLD tile centres; NOT the 8 AU analysis raster upscaled, NOT authored runtime detail, NOT an 11.2M-cell array.'
  };
}
export function getOverview(): HTMLCanvasElement | null { return cv; }
export function overviewSize(): [number, number] { return [OV_W, OV_H]; }
