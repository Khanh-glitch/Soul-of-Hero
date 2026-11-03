/** Generic source-C semantic runner for the ARCANA20 batch import.
 *  Runs any of the 20 vendored C SpellDefs on the unmodified C Frame, with the
 *  REAL SOH world region as the ground/base (no lab floor), and composites on
 *  CPU with the source compositor equation (engine/gl.ts MAIN_FS). */
import { Frame, W, H } from './c/engine/frame';
import { Rng, hash, bayer, clamp } from './c/engine/math';
import type { FX, Inst } from './c/spells/types';
import type { RGB } from './c/engine/palette';
import { SPELLS } from './c/spells';

export const C_W = W, C_H = H;
export const DT = 1 / 60;

export interface CatalogEntry {
  id: number; index: number; name: string; school: string; dur: number; climax: number;
  status: 'SOURCE_PREVIEW' | 'FUSION_PREVIEW' | 'REDESIGN_STUDY';
  note: string;
}

// Per FUSION_DECISIONS.md votes: 8 single-lead, 6 fusions, 6 redesign slots.
const STATUS: Record<number, CatalogEntry['status']> = {
  2: 'SOURCE_PREVIEW', 3: 'SOURCE_PREVIEW', 7: 'SOURCE_PREVIEW', 8: 'SOURCE_PREVIEW',
  10: 'SOURCE_PREVIEW', 15: 'SOURCE_PREVIEW', 17: 'SOURCE_PREVIEW', 19: 'SOURCE_PREVIEW',
  1: 'FUSION_PREVIEW', 5: 'FUSION_PREVIEW', 9: 'FUSION_PREVIEW', 11: 'FUSION_PREVIEW',
  16: 'FUSION_PREVIEW', 20: 'FUSION_PREVIEW',
  4: 'REDESIGN_STUDY', 6: 'REDESIGN_STUDY', 12: 'REDESIGN_STUDY', 13: 'REDESIGN_STUDY',
  14: 'REDESIGN_STUDY', 18: 'REDESIGN_STUDY',
};

export const CATALOG: CatalogEntry[] = SPELLS.map((s, i) => ({
  id: s.id, index: i, name: s.name, school: s.school, dur: s.dur, climax: s.climax,
  status: STATUS[s.id] ?? 'SOURCE_PREVIEW',
  note: s.blurb,
}));

export class CRunner {
  private frame = new Frame();
  private inst: Inst | null = null;
  private idx = -1;
  private t = 0;
  private steps = 0;
  private fx: FX;
  private shakeK = 0;
  private flashK = 0;
  private chromaK = 0;
  private flashC: RGB = [0, 0, 0];
  private world = new Uint8ClampedArray(W * H * 4);
  out = new Uint8ClampedArray(W * H * 4);
  constructor() {
    const self = this;
    this.fx = {
      shake(a) { self.shakeK = Math.max(self.shakeK, a); },
      flash(c, k) { if (k >= self.flashK * 0.6) { self.flashC = c; self.flashK = Math.max(self.flashK, k); } },
      kick(c) { self.chromaK = Math.max(self.chromaK, c); },
      invert: 0, desat: 0, chroma: 0, bloom: 1, ambient: 1, ambientEcho: 0,
    };
  }
  get count() { return SPELLS.length; }
  get current() { return this.idx; }
  cast(index: number) {
    this.idx = ((index % SPELLS.length) + SPELLS.length) % SPELLS.length;
    this.inst = SPELLS[this.idx].make(new Rng(1000 + this.idx * 7919), this.fx);
    this.t = 0; this.steps = 0; this.shakeK = 0; this.flashK = 0; this.chromaK = 0;
  }
  reset() { if (this.idx >= 0) this.cast(this.idx); else { this.t = 0; this.steps = 0; } }
  setWorld(rgba: Uint8ClampedArray) { this.world.set(rgba.subarray(0, W * H * 4)); }
  seek(target: number) {
    if (!this.inst) return;
    target = Math.max(0, target);
    if (target < this.t) this.cast(this.idx);
    while (this.t < target - 1e-6) this.step();
  }
  playTo(t: number) { this.seek(t); }
  private step() {
    if (!this.inst) return;
    const f = this.frame;
    f.clear(); f.t = this.t;
    this.fx.invert = 0; this.fx.desat = 0; this.fx.chroma = 0; this.fx.bloom = 1;
    // real world as the ground/base (replaces lab floor; spells' G decals add on top)
    f.ground.set(this.world);
    f.base.set(this.world);
    this.inst.update(DT, this.t);
    this.inst.render(f, this.t);
    this.t += DT; this.steps++;
    this.shakeK *= 0.86; this.flashK *= 0.82; this.chromaK *= 0.88;
    if (this.shakeK < 0.3) this.shakeK = 0;
    this.composite();
  }
  /** CPU mirror of source engine/gl.ts MAIN_FS (chroma split, ink, quantized
   *  signed light, over-highlight, invert, flash), ground sampled displaced. */
  private composite() {
    const f = this.frame, out = this.out, N = W * H;
    const shx = this.shakeK > 0 ? (hash(this.steps * 3) - 0.5) * 2 * this.shakeK : 0;
    const shy = this.shakeK > 0 ? (hash(this.steps * 3 + 1) - 0.5) * 2 * this.shakeK : 0;
    const chroma = this.fx.chroma + this.chromaK;
    const inv = this.fx.invert, desat = this.fx.desat;
    const flash = [this.flashC[0] * this.flashK * 0.28, this.flashC[1] * this.flashK * 0.28, this.flashC[2] * this.flashK * 0.28];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let qx = clamp(x - Math.round(shx), 0, W - 1), qy = clamp(y - Math.round(shy), 0, H - 1);
      const qi = (qy * W + qx) * 4;
      let spx = clamp(qx + Math.floor(f.disp[qi] + .5), 0, W - 1);
      let spy = clamp(qy + Math.floor(f.disp[qi + 1] + .5), 0, H - 1);
      const ch = f.disp[qi + 3] + chroma;
      let r, g, b;
      if (ch > 0.2) {
        const o = Math.ceil(ch);
        r = f.ground[(spy * W + clamp(spx + o, 0, W - 1)) * 4] / 255;
        g = f.ground[(spy * W + spx) * 4 + 1] / 255;
        b = f.ground[(spy * W + clamp(spx - o, 0, W - 1)) * 4 + 2] / 255;
      } else {
        r = f.ground[(spy * W + spx) * 4] / 255; g = f.ground[(spy * W + spx) * 4 + 1] / 255; b = f.ground[(spy * W + spx) * 4 + 2] / 255;
      }
      const shade = f.disp[qi + 2];
      r *= shade; g *= shade; b *= shade;
      if (desat > 0) { const lum = r * 0.3 + g * 0.55 + b * 0.15; r = r + (lum * 0.85 - r) * desat; g = g + (lum * 0.95 - g) * desat; b = b + (lum * 1.15 - b) * desat; }
      const ia = f.ink[qi + 3];
      r = r * (1 - ia) + f.ink[qi]; g = g * (1 - ia) + f.ink[qi + 1]; b = b * (1 - ia) + f.ink[qi + 2];
      const th = bayer(qx, qy) - .5;
      r += Math.floor(Math.max(-8, f.light[qi]) * 8 + th + .5) / 8;
      g += Math.floor(Math.max(-8, f.light[qi + 1]) * 8 + th + .5) / 8;
      b += Math.floor(Math.max(-8, f.light[qi + 2]) * 8 + th + .5) / 8;
      const over = Math.max(r - 1, 0) + Math.max(g - 1, 0) + Math.max(b - 1, 0);
      r += over * .45; g += over * .45; b += over * .45;
      r = clamp(r, 0, 1); g = clamp(g, 0, 1); b = clamp(b, 0, 1);
      if (inv > 0) { r = r + ((1 - r) - r) * inv; g = g + ((1 - g) - g) * inv; b = b + ((1 - b) - b) * inv; }
      const o = (y * W + x) * 4;
      out[o] = Math.round(clamp(r + flash[0], 0, 1) * 255);
      out[o + 1] = Math.round(clamp(g + flash[1], 0, 1) * 255);
      out[o + 2] = Math.round(clamp(b + flash[2], 0, 1) * 255);
      out[o + 3] = 255;
    }
  }
}
