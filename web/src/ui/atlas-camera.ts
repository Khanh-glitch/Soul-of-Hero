import { FRAME_W, FRAME_H } from '../veyra05/frame';

// ---------------------------------------------------------------------------
// ATLAS CAMERA — one sheet, one camera.
//
// The field chart used to be two separate pictures: a fixed continent sheet and a sector view in three steps. The
// wheel jumped from one to the other and the continent could not be moved at all. This camera makes it one sheet
// handled the way players already know from other maps: drag to move, wheel or pinch to zoom on the point under the
// cursor, any scale between the whole continent and a few tiles.
//
// Pure maths only (no canvas, no React), so it can be tested without a browser.
// ---------------------------------------------------------------------------

/** Chart canvas size in its own pixels (the panel scales it up). */
export const VIEW_W = 312;
export const VIEW_H = 260;

/** A view of the continent: the global tile at the centre of the sheet, and chart pixels per tile. */
export interface Cam { gx: number; gy: number; s: number }

/** Whole continent on the sheet: 300 x 210 chart pixels for 4000 x 2800 tiles. */
export const FIT_S = Math.min(300 / FRAME_W, 250 / FRAME_H);
/** Closest view: six chart pixels per tile. */
export const MAX_S = 6;
/** The 200 x 200 sector around the player fills the sheet's height. */
export const SECTOR_S = 1.3;
/** Each wheel notch (and each press of + or -) changes the scale by this ratio. */
export const ZOOM_STEP = 1.32;
/** How far, in chart pixels, the continent's edge may be pulled inside the sheet. */
const EDGE_PX = 28;

export const fitCam = (): Cam => ({ gx: FRAME_W / 2, gy: FRAME_H / 2, s: FIT_S });

const clampAxis = (g: number, size: number, viewPx: number, s: number): number => {
  const half = viewPx / (2 * s);
  const lo = half - EDGE_PX / s, hi = size - half + EDGE_PX / s;
  return lo >= hi ? size / 2 : Math.max(lo, Math.min(hi, g));
};

/** Keep the scale in range and the continent on the sheet. When the continent is smaller than the sheet it is centred. */
export function clampCam(c: Cam): Cam {
  const s = Math.max(FIT_S, Math.min(MAX_S, Number.isFinite(c.s) ? c.s : FIT_S));
  return {
    gx: clampAxis(Number.isFinite(c.gx) ? c.gx : FRAME_W / 2, FRAME_W, VIEW_W, s),
    gy: clampAxis(Number.isFinite(c.gy) ? c.gy : FRAME_H / 2, FRAME_H, VIEW_H, s),
    s,
  };
}

/** Chart pixel -> global tile (fractional). */
export const toGlobal = (c: Cam, mx: number, my: number): [number, number] =>
  [c.gx + (mx - VIEW_W / 2) / c.s, c.gy + (my - VIEW_H / 2) / c.s];

/** Global tile -> chart pixel. */
export const toScreen = (c: Cam, gtx: number, gty: number): [number, number] =>
  [VIEW_W / 2 + (gtx - c.gx) * c.s, VIEW_H / 2 + (gty - c.gy) * c.s];

/** Change the scale while the tile under the chart pixel (ax, ay) stays under it. */
export function zoomAt(c: Cam, s: number, ax: number, ay: number): Cam {
  const s2 = Math.max(FIT_S, Math.min(MAX_S, s));
  const [gx, gy] = toGlobal(c, ax, ay);
  return clampCam({ gx: gx - (ax - VIEW_W / 2) / s2, gy: gy - (ay - VIEW_H / 2) / s2, s: s2 });
}

/** Move the sheet by a drag of (dx, dy) chart pixels. */
export const panBy = (c: Cam, dx: number, dy: number): Cam => clampCam({ gx: c.gx - dx / c.s, gy: c.gy - dy / c.s, s: c.s });

export const isFit = (c: Cam): boolean => c.s <= FIT_S * 1.02;

/** Scale ratio for one wheel event. Trackpads send many small deltas, mice send about 100 per notch; a pinch on a
 *  trackpad arrives as a wheel event with ctrl held and small deltas. */
export function wheelRatio(deltaY: number, deltaMode: number, ctrl: boolean): number {
  const px = deltaMode === 1 ? deltaY * 33 : deltaMode === 2 ? deltaY * 300 : deltaY;
  const notches = Math.max(-3, Math.min(3, ctrl ? px / 30 : px / 100));
  return Math.pow(ZOOM_STEP, -notches);
}

const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/** A point on the way from one view to another, t in 0..1. The scale moves evenly in zoom steps, not in pixels. */
export function easeCam(from: Cam, to: Cam, t: number): Cam {
  const k = easeOut(t);
  return {
    gx: from.gx + (to.gx - from.gx) * k,
    gy: from.gy + (to.gy - from.gy) * k,
    s: Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * k),
  };
}

/** The view panned just enough to bring a tile inside the sheet with `margin` chart pixels to spare; null when it
 *  is already there. */
export function reveal(c: Cam, gtx: number, gty: number, margin = 36): Cam | null {
  const [x, y] = toScreen(c, gtx, gty);
  if (x >= margin && x <= VIEW_W - margin && y >= margin && y <= VIEW_H - margin) return null;
  return clampCam({ gx: gtx, gy: gty, s: c.s });
}

/** A round distance whose bar on the sheet is about 40 to 90 chart pixels long. */
export function scaleBar(s: number): { tiles: number; px: number } {
  const steps = [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  let tiles = steps[steps.length - 1];
  for (const st of steps) { if (st * s >= 40) { tiles = st; break; } }
  return { tiles, px: Math.round(tiles * s) };
}

// The view is kept for the session, per run, so the chart reopens where it was left.
const lastCam = new Map<string, Cam>();
export const rememberCam = (runId: string, c: Cam): void => { lastCam.set(runId, { ...c }); };
export const recallCam = (runId: string): Cam | null => { const c = lastCam.get(runId); return c ? clampCam(c) : null; };
/** Test seam. */
export const __forgetCams = (): void => { lastCam.clear(); };
