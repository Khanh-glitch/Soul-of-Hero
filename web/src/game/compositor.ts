// ============================================================================
// Unified VFX compositor — SINGLE owner of the final frame's effect passes.
// (AVFX takeover seam, 2026-11-03 — see docs/vfx/AVFX_TAKEOVER_UNIFIED_COMPOSITOR_2026-11-03.md)
//
// One compositor is responsible for the final image. World/terrain/actor/roof
// rendering stays in render.ts (game-owned); everything ABOVE the world that is
// a visual effect — auras, warp/distortion, screen-space FX, post-night
// (radiance/emission/art re-draw) — goes through THIS module, in a fixed pass
// order, from registered VFX clients (PixelFX today, ARCANA20 tomorrow).
// No client may draw to the visible canvas outside these passes.
// ============================================================================

export type Ctx = CanvasRenderingContext2D;
export interface Cam { x: number; y: number }
export interface DepthItem { y: number; f: () => void }

/** A VFX source (PixelFX, ARCANA20, ...) plugs in here. It keeps its own
 *  algorithms/timeline/passes internally; only the hook points are shared. */
export interface VfxClient {
  readonly id: string;
  /** world-space, y-sorted FX that must be occluded by actors/roofs */
  depthItems?(g: Ctx): DepthItem[];
  /** hover/body auras: screen space, drawn ABOVE the whole world incl. roofs */
  drawAuras?(g: Ctx, cam: Cam): void;
  /** full-screen distortion/warp pass */
  drawWarpPass?(g: Ctx, cam: Cam, now: number): void;
  /** screen-space FX layer */
  drawScreen?(g: Ctx): void;
  /** post-night: radiance + emission + crisp art re-draw (single post stage) */
  drawPostNight?(g: Ctx, cam: Cam, dark: number): void;
}

const clients: VfxClient[] = [];

export function registerVfxClient(c: VfxClient): void {
  if (clients.some(x => x.id === c.id)) return;
  clients.push(c);
}
export function unregisterVfxClient(id: string): void {
  const i = clients.findIndex(x => x.id === id);
  if (i >= 0) clients.splice(i, 1);
}
export function vfxClients(): readonly VfxClient[] { return clients; }

// ---- fixed pass order (the compositor contract) ----
export function depthItems(g: Ctx): DepthItem[] {
  const out: DepthItem[] = [];
  for (const c of clients) if (c.depthItems) out.push(...c.depthItems(g));
  return out;
}
export function drawAuras(g: Ctx, cam: Cam): void { for (const c of clients) c.drawAuras?.(g, cam); }
export function drawWarpPass(g: Ctx, cam: Cam, now: number): void { for (const c of clients) c.drawWarpPass?.(g, cam, now); }
export function drawScreen(g: Ctx): void { for (const c of clients) c.drawScreen?.(g); }
export function drawPostNight(g: Ctx, cam: Cam, dark: number): void { for (const c of clients) c.drawPostNight?.(g, cam, dark); }
