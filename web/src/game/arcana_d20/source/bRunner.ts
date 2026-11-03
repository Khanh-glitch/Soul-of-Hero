// ============================================================================
// BRunner — source-B semantic adapter (reusable, NOT per-spell).
// Runs the vendored, unmodified B effects (384x216 CPU HDR renderer) with the
// REAL SOH world snapshot injected as the floor albedo (no lab background).
// ============================================================================
import { Renderer, W, H } from './b/engine/renderer';
import { EFFECTS } from './b/effects';
import type { Effect } from './b/engine/fx';

export const B_W = W, B_H = H;

export class BRunner {
  private r = new Renderer();
  private fx: Effect | null = null;
  private idx = -1;
  private state: any = null;
  private t = 0;
  out = new Uint8ClampedArray(W * H * 4);

  cast(index: number) {
    this.idx = index;
    this.fx = EFFECTS[index];
    this.r.target = { x: 262, y: 104 }; // same anchor/anchors the B lab uses
    this.r.anchors = [
      { x: 262, y: 104 }, { x: 318, y: 62 }, { x: 330, y: 160 }, { x: 196, y: 52 }, { x: 214, y: 176 }, { x: 150, y: 84 },
    ];
    this.state = this.fx!.setup(this.r);
    this.t = 0;
  }
  reset() { if (this.idx >= 0) this.cast(this.idx); else this.t = 0; }
  get duration() { return this.fx ? this.fx.duration : 0; }
  get climax() { return this.fx ? this.fx.climax : 0; }

  /** inject the real world region as linear-HDR floor albedo */
  setWorld(rgba: Uint8ClampedArray) {
    const f = this.r.floor;
    for (let i = 0, j = 0; i < W * H; i++, j += 4) {
      f[i * 3] = Math.pow(rgba[j] / 255, 2.2);
      f[i * 3 + 1] = Math.pow(rgba[j + 1] / 255, 2.2);
      f[i * 3 + 2] = Math.pow(rgba[j + 2] / 255, 2.2);
    }
  }

  seek(t: number) {
    if (!this.fx) return;
    this.t = Math.max(0, Math.min(t, this.fx.duration + 0.8));
    const r = this.r, fx = this.fx;
    r.begin();
    r.time = this.t; // wall clock = local time: deterministic replay
    fx.render(r, Math.min(this.t, fx.duration), this.state);
    r.lighting();
    if (fx.post) {
      r.setTarget(r.main);
      r.tx = r.ty = 0; r.ts = 1; r.clip = null;
      fx.post(r, Math.min(this.t, fx.duration), this.state);
    }
    r.setTarget(r.main);
    r.finalize(this.out);
  }
}

export const B_EFFECTS = EFFECTS;
