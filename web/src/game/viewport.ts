// ============================================================================
// The visible view: how many stage pixels the window shows.
//
// The game is authored on a 640 x 360 stage (16:9). A browser window is rarely
// exactly 16:9: tabs and the address bar make it wider, a 16:10 laptop makes it
// taller. Rather than leave black bars, the view grows with the window, up to
// 768 x 400, and shows a little more of the world on the sides it grew.
//
//   VIEW_W x VIEW_H (core.ts)  the reference frame. Game RULES that say "in view"
//                              (the meteor storm, the frost that freezes the screen)
//                              keep this size, centred in the view, so a wider
//                              window changes what you see and never what happens.
//   viewW x viewH (here)       what is drawn. Only drawing, camera and HUD read it.
//
// The width stops at 768 (48 tiles): VEYRA slides its loaded window when the
// player comes within 24 tiles of its edge, so a view no wider than 24 tiles to
// either side of the player never reaches that edge.
// ============================================================================
import { VIEW_W, VIEW_H } from './core';

export const MAX_VIEW_W = 768;
export const MAX_VIEW_H = 400;

/** Current drawn size in stage pixels. Live bindings: importers always read the current value. */
export let viewW = VIEW_W;
export let viewH = VIEW_H;

const even = (v: number) => Math.floor(v / 2) * 2;

/** Set the drawn size. Clamped to [640..768] x [360..400], whole even pixels. True when it changed. */
export function setViewSize(w: number, h: number): boolean {
  const nw = Math.max(VIEW_W, Math.min(MAX_VIEW_W, even(Number.isFinite(w) ? w : VIEW_W)));
  const nh = Math.max(VIEW_H, Math.min(MAX_VIEW_H, even(Number.isFinite(h) ? h : VIEW_H)));
  if (nw === viewW && nh === viewH) return false;
  viewW = nw; viewH = nh;
  return true;
}

/** Top-left of the 640 x 360 reference frame inside the view (it is centred). */
export const viewInsetX = () => (viewW - VIEW_W) >> 1;
export const viewInsetY = () => (viewH - VIEW_H) >> 1;

export interface StageView { w: number; h: number; k: number; x: number; y: number }

/**
 * View size, scale and offset for a window of W x H CSS pixels.
 *   wide = false  the classic 640 x 360 stage, letterboxed.
 *   mode 'fit'    scale to the window; the view takes the window's shape between 16:10 and 19.2:9.
 *   mode 'integer' whole-pixel scale; the view then takes as much of the window as that scale shows.
 * The view never exceeds the window, so what remains outside it is at most a pixel or two unless the
 * window is wider than 19.2:9 or taller than 16:10.
 */
export function fitStageView(W: number, H: number, mode: 'fit' | 'integer' = 'fit', wide = true): StageView {
  let w = VIEW_W, h = VIEW_H;
  const base = Math.min(W / VIEW_W, H / VIEW_H);
  let k = mode === 'integer' ? (base >= 1 ? Math.floor(base) : base) : base;
  if (wide && W > 0 && H > 0 && k > 0) {
    if (mode === 'integer') {
      w = Math.max(VIEW_W, Math.min(MAX_VIEW_W, even(W / k)));
      h = Math.max(VIEW_H, Math.min(MAX_VIEW_H, even(H / k)));
    } else if (W * VIEW_H > H * VIEW_W) {
      w = Math.max(VIEW_W, Math.min(MAX_VIEW_W, even(VIEW_H * W / H)));
    } else {
      h = Math.max(VIEW_H, Math.min(MAX_VIEW_H, even(VIEW_W * H / W)));
    }
    if (mode !== 'integer') k = Math.min(W / w, H / h);
  }
  // h * (H / h) can come out a hair above H in floating point: without the guard that put the stage at -1.
  const mid = (room: number) => Math.max(0, Math.floor(room / 2 + 1e-9));
  return { w, h, k, x: mid(W - w * k), y: mid(H - h * k) };
}
