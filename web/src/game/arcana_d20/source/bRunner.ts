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
  get current() { return this.idx; }
  get duration() { return this.fx ? this.fx.duration : 0; }
  get climax() { return this.fx ? this.fx.climax : 0; }

  /** inject the real world region as linear-HDR floor albedo */
  setWorld(rgba: Uint8ClampedArray) {
    if (!rgba || rgba.length < W * H * 4) throw new Error(`BRunner.setWorld: world snapshot missing/wrong size (${rgba?.length} < ${W * H * 4})`);
    this.worldLdr.set(rgba.subarray(0, W * H * 4));
    const f = this.r.floor;
    for (let i = 0, j = 0; i < W * H; i++, j += 4) {
      f[i * 3] = Math.pow(rgba[j] / 255, 2.2);
      f[i * 3 + 1] = Math.pow(rgba[j + 1] / 255, 2.2);
      f[i * 3 + 2] = Math.pow(rgba[j + 2] / 255, 2.2);
    }
  }

  /** Pure HDR light channel of this effect on a black floor (semantic channel). */
  extractLight(index: number, t: number): { data: Float32Array; w: number; h: number } {
    this.cast(index);
    this.setWorld(new Uint8ClampedArray(W * H * 4));
    this.seek(t);
    return { data: new Float32Array(this.r.lightBuf), w: W, h: H };
  }

  private worldLdr = new Uint8ClampedArray(W * H * 4);
  private baseFrame = new Uint8ClampedArray(W * H * 4);

  private renderOnce(withFx: boolean, outBuf: Uint8ClampedArray) {
    const r = this.r, fx = this.fx!;
    r.begin();
    r.time = this.t;
    if (withFx) fx.render(r, Math.min(this.t, fx.duration), this.state);
    // source-to-world boundary: the source's global ambient/tint mood must NOT
    // darken the imported SOH world (that produced the dark 384x216 window).
    r.ambient = 1; r.tint = [1, 1, 1];
    r.lighting();
    if (withFx && fx.post) {
      r.setTarget(r.main);
      r.tx = r.ty = 0; r.ts = 1; r.clip = null;
      fx.post(r, Math.min(this.t, fx.duration), this.state);
    }
    r.setTarget(r.main);
    r.finalize(outBuf);
  }

  seek(t: number) {
    if (!this.fx) return;
    this.t = Math.max(0, Math.min(t, this.fx.duration + 0.8));
    // channel-level compose: world + (effectFrame - noEffectFrame) so the source
    // tonemap/ambient curve cancels and untouched world pixels stay EXACT.
    this.renderOnce(true, this.out);
    this.renderOnce(false, this.baseFrame);
    const w = this.worldLdr, o = this.out, b = this.baseFrame;
    for (let i = 0; i < o.length; i += 4) {
      o[i] = Math.max(0, Math.min(255, w[i] + o[i] - b[i]));
      o[i + 1] = Math.max(0, Math.min(255, w[i + 1] + o[i + 1] - b[i + 1]));
      o[i + 2] = Math.max(0, Math.min(255, w[i + 2] + o[i + 2] - b[i + 2]));
      o[i + 3] = 255;
    }
  }

}

export const B_EFFECTS = EFFECTS;
