/**
 * VEYRA U=0.5 FULL-WORLD FRAME — canonical constants and EXACT transforms.
 *
 * Authority: WMP-04R1 world master over the GOLD canon (frame 2000x1400 AU),
 * Creator-locked design-scale intent U = 0.5 AU per tile, TILE = 16 px.
 *   -> 4000 x 2800 addressable runtime tiles (NON-SQUARE), 11,200,000 cells.
 * The frame is NEVER materialised: everything is streamed in bounded chunks
 * (see chunks.ts) and materialised only as bounded gameplay windows (window.ts).
 *
 * Reuses the LW-01 / U05 coordinate method from the Map branch
 * (creator-u05/web-u05/src/u05/lw/coords.ts): floor division, signed string
 * chunk keys (never the legacy `cy*100+cx` which aliases at >=100 chunks).
 */
export const U = 0.5;                       // AU per tile (LOCKED design-scale intent)
export const TILE = 16;                     // px per tile (existing SOH presentation)
export const FRAME_AU: readonly [number, number] = [2000, 1400];
export const FRAME_W = 4000;                // tiles
export const FRAME_H = 2800;                // tiles
export const CHUNK = 32;                    // tiles per chunk side (16 AU)
export const CHUNKS_X = FRAME_W / CHUNK;    // 125
export const CHUNKS_Y = FRAME_H / CHUNK;    // 88 (2800/32 = 87.5 -> last row is a half chunk, handled by inFrame)
export const ANALYSIS_CELL_AU = 8;          // WMP-04R1 analysis raster cell (ANALYSIS data, never a tile)
export const ANALYSIS_W = 250, ANALYSIS_H = 175;
export const PROFILE_ID = 'veyra05';
/** Gameplay engine window (the live runtime is a bounded 200x200 world). */
export const WINDOW_W = 200, WINDOW_H = 200;

export const floordiv = (a: number, b: number) => Math.floor(a / b);
export const inFrame = (tx: number, ty: number) => Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < FRAME_W && ty < FRAME_H;

/** Global tile -> AU centre of that tile (cell-centre projection, same rule as the live projection.ts). */
export const tileToAu = (tx: number, ty: number): [number, number] => [(tx + 0.5) * U, (ty + 0.5) * U];
/** AU -> global tile (floor). */
export const auToTile = (ax: number, ay: number): [number, number] => [Math.floor(ax / U), Math.floor(ay / U)];
/** Global linear identity. Fits exactly in 24 bits (11.2M < 16.7M); stable for the frame. */
export function globalIndex(tx: number, ty: number): number {
  if (!inFrame(tx, ty)) throw Error(`VEYRA05_INDEX_OUT_OF_FRAME ${tx},${ty}`);
  return ty * FRAME_W + tx;
}
export const unindex = (i: number): [number, number] => [i % FRAME_W, (i / FRAME_W) | 0];
export const chunkOf = (tx: number, ty: number) => ({ cx: floordiv(tx, CHUNK), cy: floordiv(ty, CHUNK), lx: tx - floordiv(tx, CHUNK) * CHUNK, ly: ty - floordiv(ty, CHUNK) * CHUNK });
export const chunkKey = (cx: number, cy: number) => `${PROFILE_ID}|${cx}:${cy}`;
export const inChunkFrame = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < CHUNKS_X && cy < Math.ceil(FRAME_H / CHUNK);

/** Bounded engine window placed on the global frame (origin in global tiles). */
export interface WindowSpec { originTx: number; originTy: number; w: number; h: number }
export const windowToGlobal = (win: WindowSpec, x: number, y: number): [number, number] => [win.originTx + x, win.originTy + y];
export const globalToWindow = (win: WindowSpec, tx: number, ty: number): [number, number] => [tx - win.originTx, ty - win.originTy];
export const windowOriginAu = (win: WindowSpec): [number, number] => [win.originTx * U, win.originTy * U];
/** px inside the window (engine space) -> global tile. */
export const windowPxToGlobalTile = (win: WindowSpec, px: number, py: number): [number, number] => [win.originTx + Math.floor(px / TILE), win.originTy + Math.floor(py / TILE)];

/** Clamp a desired window centre so the window stays inside the frame (frame edge chunks are legal). */
export function windowAround(centreTx: number, centreTy: number, w = WINDOW_W, h = WINDOW_H): WindowSpec {
  const originTx = Math.max(0, Math.min(FRAME_W - w, Math.round(centreTx - w / 2)));
  const originTy = Math.max(0, Math.min(FRAME_H - h, Math.round(centreTy - h / 2)));
  return { originTx, originTy, w, h };
}
export const CONTRACT = Object.freeze({
  U, TILE, FRAME_AU, FRAME_W, FRAME_H, CHUNK, addressableCells: FRAME_W * FRAME_H,
  materialisedFullFrame: false, chunkKeyScheme: 'profile|cx:cy (signed, collision-free)', legacyKeyScheme: 'NEVER cy*100+cx',
  hero: '16x24 px', view: '640x360 native, integer scaled', gameplayWindow: `${WINDOW_W}x${WINDOW_H} tiles (live engine bound)`,
});
