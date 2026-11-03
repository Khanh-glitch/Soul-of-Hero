// ============================================================================
// Unified VFX compositor — SINGLE owner of the final frame's effect output.
// (AVFX takeover M0+M1, 2026-11-03 — docs/vfx/AVFX_TAKEOVER_UNIFIED_COMPOSITOR_2026-11-03.md)
//
// Two submission channels, ONE compositor:
//  1. Canvas2D passes (PixelFX) draw into the offscreen world producer; their
//     ordered hooks are dispatched here (depthItems -> auras -> warp -> screen
//     -> post-night). These are pixel-equivalent to the pre-M0 direct calls.
//  2. GPU pass submissions (ARCANA D19 today): clients submit TYPED, READ-ONLY
//     pass data via submitGpuPass(); the compositor drains them exactly once
//     per frame and hands them to the single WebGL2 presenter, which owns the
//     ONE final post. Clients can NEVER run their own post or extra context.
//
// Invariants enforced here: duplicate client IDs are rejected explicitly,
// unregister/reset works, submission order is deterministic (registration
// order), and takeGpuPasses() drains so the post runs exactly once per frame.
// ============================================================================

import type { PresentedLayer } from './gpu/presenter';

export type Ctx = CanvasRenderingContext2D;
export interface Cam { x: number; y: number }
export interface DepthItem { y: number; f: () => void }

/** A VFX source (PixelFX, ARCANA20, ...) plugs in here. It keeps its own
 *  algorithms/timeline/passes internally; only the hook points are shared. */
export interface VfxClient {
  readonly id: string;
  /** world-space, y-sorted FX that must be occluded by actors/roofs (Canvas2D producer) */
  depthItems?(g: Ctx): DepthItem[];
  /** hover/body auras: screen space, drawn ABOVE the whole world incl. roofs */
  drawAuras?(g: Ctx, cam: Cam): void;
  /** full-screen distortion/warp pass (Canvas2D producer) */
  drawWarpPass?(g: Ctx, cam: Cam, now: number): void;
  /** screen-space FX layer (Canvas2D producer) */
  drawScreen?(g: Ctx): void;
  /** post-night passes (Canvas2D producer) */
  drawPostNight?(g: Ctx, cam: Cam, dark: number): void;
  /** per-frame hook before present: submit typed GPU passes (read-only data) */
  submitGpu?(frame: FrameCtx): void;
}

export interface FrameCtx {
  g: Ctx;            // offscreen world producer context
  cam: Cam;
  now: number;
  dark: number;
}

const clients: VfxClient[] = [];
let gpuQueue: PresentedLayer[] = [];

export function registerVfxClient(c: VfxClient): void {
  if (clients.some(x => x.id === c.id)) throw new Error(`duplicate VfxClient id: ${c.id}`);
  clients.push(c);
}
export function unregisterVfxClient(id: string): boolean {
  const i = clients.findIndex(x => x.id === id);
  if (i < 0) return false;
  clients.splice(i, 1);
  return true;
}
export function vfxClients(): readonly VfxClient[] { return clients; }

/** Clients call this during their submitGpu hook. Data is queued, never executed. */
export function submitGpuPass(layer: PresentedLayer): void { gpuQueue.push(layer); }
/** Compositor drains the queue exactly once per frame → post runs exactly once. */
export function takeGpuPasses(): PresentedLayer[] { const q = gpuQueue; gpuQueue = []; return q; }

/** Run all clients' submit hooks in deterministic registration order. */
export function collectGpuPasses(frame: FrameCtx): PresentedLayer[] {
  for (const c of clients) c.submitGpu?.(frame);
  return takeGpuPasses();
}

// ---- fixed Canvas2D pass order (unchanged from M0) ----
export function depthItems(g: Ctx): DepthItem[] {
  const out: DepthItem[] = [];
  for (const c of clients) if (c.depthItems) out.push(...c.depthItems(g));
  return out;
}
export function drawAuras(g: Ctx, cam: Cam): void { for (const c of clients) c.drawAuras?.(g, cam); }
export function drawWarpPass(g: Ctx, cam: Cam, now: number): void { for (const c of clients) c.drawWarpPass?.(g, cam, now); }
export function drawScreen(g: Ctx): void { for (const c of clients) c.drawScreen?.(g); }
export function drawPostNight(g: Ctx, cam: Cam, dark: number): void { for (const c of clients) c.drawPostNight?.(g, cam, dark); }
