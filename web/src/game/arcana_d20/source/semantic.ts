/** SEMANTIC BRIDGE for ARCANA #20 — runs the unmodified P0 fused-donor spell
 *  (source/fusion20/ripper.ts) on the unmodified C Frame (source/engine/frame.ts)
 *  and composites with the source composite equation (identity world transform).
 *  Frame.base / sampling world = the REAL Soul of Hero world region (Phase 2),
 *  or a controlled reference background (Phase 1 QA). */
import { Frame, W, H } from './engine/frame';
import { Rng, clamp } from './engine/math';
import { bayer } from './engine/math';
import type { FX, Inst } from './engine/types';
import type { RGB } from './engine/palette';
import { ripperFusion } from './fusion20/ripper';

export const SF_W = W, SF_H = H; // 384 x 216 — the true source frame size

export class SemanticRipper {
  private frame = new Frame();
  private spell: Inst;
  private fx: FX & { flashK: number; flashC: RGB };
  private tick = 0;
  private world = new Uint8ClampedArray(W * H * 4); // pristine world region (composite source)
  out = new Uint8ClampedArray(W * H * 4);
  flash = 0; flashCol: RGB = [1, 1, 1];
  constructor() {
    this.fx = {
      shake: () => {}, kick: () => {}, ambient: 0, ambientEcho: 0,
      invert: 0, desat: 0, chroma: 0, bloom: 0,
      flash: (c, k) => { this.flash = Math.max(this.flash, k); this.flashCol = c; },
      flashK: 0, flashC: [1, 1, 1],
    };
    this.spell = ripperFusion.make(new Rng(151461), this.fx);
  }
  /** Provide the real world region pixels (RGBA8, W*H*4) as base + sample source. */
  setWorld(rgba: Uint8ClampedArray) {
    this.world.set(rgba.subarray(0, W * H * 4));
    this.frame.base.set(rgba.subarray(0, W * H * 4));
  }
  reset() { this.tick = 0; this.spell = ripperFusion.make(new Rng(151461), this.fx); }
  /** Advance the deterministic source sim to source-time t and render. */
  stepTo(t: number) {
    const target = Math.floor(t * 60 + 1e-6);
    if (target < this.tick) this.reset();
    while (this.tick < target) {
      this.tick++;
      const tt = this.tick / 60;
      this.frame.clear();
      this.fx.invert = 0; this.fx.desat = 0; this.fx.chroma = 0; this.fx.bloom = 0;
      this.flash = 0;
      this.spell.update(1 / 60, tt);
      this.spell.render(this.frame, tt);
      this.composite();
    }
  }
  /** Source C composite equation (compositeC) with identity world transform:
   *  out = world where !worldInfluence, else ground(displaced)*shade masked by
   *  ink/fragment coverage + fragment sample + quantized signed light. */
  private composite() {
    const f = this.frame, orig = this.world, out = this.out;
    out.set(orig);
    const N = W * H;
    for (let p = 0; p < N; p++) {
      if (!f.worldInfluence[p]) continue;
      const qi = p * 4;
      const qx = p % W, qy = (p / W) | 0;
      const spx = clamp(qx + Math.floor(f.disp[qi] + .5), 0, W - 1);
      const spy = clamp(qy + Math.floor(f.disp[qi + 1] + .5), 0, H - 1);
      const ch = f.disp[qi + 3], o = ch > .2 ? Math.ceil(ch) : 0;
      const alpha = f.groundCoverage[p];
      const sh = f.disp[qi + 2], ink = f.ink[qi + 3], fragment = f.worldFragment[qi + 2];
      const fx0 = clamp(f.worldFragment[qi], 0, W - 1), fy0 = clamp(f.worldFragment[qi + 1], 0, H - 1);
      const fi = ((fy0 | 0) * W + (fx0 | 0)) * 4;
      const mode = f.worldFragment[qi + 3];
      const th = bayer(qx, qy) - .5;
      const ops = f.liveLight.get(p);
      const v: number[] = [0, 1, 2].map(k => {
        const offset = k === 0 ? o : k === 2 ? -o : 0;
        const sx = clamp(spx + offset, 0, W - 1);
        const g = orig[(spy * W + sx) * 4 + k] / 255 * (1 - alpha) + f.ground[(spy * W + sx) * 4 + k] / 255;
        let frag = orig[fi + k] / 255;
        if (mode > 1.5) frag = 1 - frag * [2.5, 3, 2][k];
        else if (mode > .5) frag = clamp(1 - frag * 3, 0, 1) * [.45, .2, .5][k] + [.2, 0, .15][k];
        let light = f.light[(qy * W + qx) * 4 + k];
        if (ops) for (const op of ops) light += orig[(clamp(op.sy, 0, H - 1) * W + clamp(op.sx, 0, W - 1)) * 4 + k] / 255 * op.gain;
        return g * sh * Math.max(0, 1 - ink - fragment) + f.ink[qi + k] + frag * fragment + Math.floor(light * 8 + th + .5) / 8;
      });
      const over = (Math.max(v[0] - 1, 0) + Math.max(v[1] - 1, 0) + Math.max(v[2] - 1, 0)) * .45;
      const dest = p * 4;
      for (let k = 0; k < 3; k++) out[dest + k] = Math.round(clamp(v[k] + over, 0, 1) * 255);
    }
  }
}
