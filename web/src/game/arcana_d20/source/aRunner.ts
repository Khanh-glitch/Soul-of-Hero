// ============================================================================
// ARunner — source-A semantic adapter (reusable, NOT per-spell).
// Runs the vendored, unmodified A Lab (416x234 HDR framebuffer, fixed-step sim)
// with the REAL SOH world snapshot injected as the arena background layer.
// Pure CPU: works in browser AND in node (ImageData polyfilled when absent).
// ============================================================================

// node/vitest has no ImageData — the vendored A Framebuffer only needs a
// {data,width,height} carrier, so provide a minimal stand-in.
if (typeof (globalThis as any).ImageData === 'undefined') {
  (globalThis as any).ImageData = class ImageDataPolyfill {
    data: Uint8ClampedArray; width: number; height: number;
    constructor(a: number | Uint8ClampedArray, b: number, c?: number) {
      if (typeof a === 'number') { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4); }
      else { this.data = a; this.width = b; this.height = c ?? a.length / 4 / b; }
    }
  };
}

import { Lab } from './a/engine/lab';
import { SPELLS } from './a/spells';
import { VIEW_W, VIEW_H, ARENA_C, ANCHORS } from './a/engine/arena';
import { VoltCarousel } from './a/spells/tempest';
import type { Framebuffer } from './a/engine/framebuffer';

export const A_W = VIEW_W, A_H = VIEW_H;
const STUB_CTX = { putImageData() { /* CPU-only: pixels stay in fb.out */ } } as unknown as CanvasRenderingContext2D;

export class ARunner {
  private lab = new Lab();
  private idx = -1;
  out = new Uint8ClampedArray(VIEW_W * VIEW_H * 4);

  constructor() { this.lab.showEnemies = false; this.lab.showArena = true; }

  cast(index: number) { this.idx = index; this.lab.load(SPELLS[index]); }
  reset() { if (this.idx >= 0) this.cast(this.idx); }
  get duration() { return SPELLS[this.idx]?.duration ?? 0; }
  get climax() { return SPELLS[this.idx]?.climax ?? 0; }

  /** inject the real world region as the linear-HDR arena background */
  setWorld(rgba: Uint8ClampedArray) {
    if (!rgba || rgba.length < VIEW_W * VIEW_H * 4) throw new Error(`ARunner.setWorld: world snapshot missing/wrong size (${rgba?.length} < ${VIEW_W * VIEW_H * 4})`);
    const bg = this.lab.fb.bg;
    for (let i = 0, j = 0; i < VIEW_W * VIEW_H; i++, j += 4) {
      bg[i * 3] = Math.pow(rgba[j] / 255, 2.2);
      bg[i * 3 + 1] = Math.pow(rgba[j + 1] / 255, 2.2);
      bg[i * 3 + 2] = Math.pow(rgba[j + 2] / 255, 2.2);
    }
  }

  seek(t: number) {
    if (this.idx < 0) return;
    this.lab.seek(t);
    this.lab.render(STUB_CTX);
    this.out.set(this.lab.fb.out.data);
  }

  /** Moving spatial anchors authored by an A spell at time t.
   *  #11 VoltCarousel: its own ring segment connectors (segPos). */
  anchorsFor(skillId: number, t: number): { x: number; y: number }[] {
    if (skillId === 11) {
      const vc = new VoltCarousel();
      const pts: { x: number; y: number }[] = [];
      for (const ring of vc.rings) for (let k = 0; k < ring.segs; k++) {
        const p = vc.segPos(ring, k, t, 1);
        pts.push({ x: p.x, y: p.y });
      }
      return pts;
    }
    if (skillId === 9) return ANCHORS.map(a => ({ x: a.x, y: a.y })); // distinct static pair set
    return [{ x: ARENA_C.x, y: ARENA_C.y }];
  }

  /** Render the A spell, then inject extracted source contributions (arcs bound
   *  to this spell's moving anchors, or a light channel) before present. */
  renderWithContributions(index: number, t: number, extra?: (fb: Framebuffer) => void) {
    this.cast(index);
    const fb = this.lab.fb;
    const orig = fb.present.bind(fb);
    if (extra) fb.present = (ctx: CanvasRenderingContext2D) => { extra(fb); orig(ctx); };
    try {
      this.lab.seek(t);
      this.lab.render(STUB_CTX);
    } finally {
      fb.present = orig;
    }
    this.out.set(fb.out.data);
  }
}

export const A_SPELLS = SPELLS;
