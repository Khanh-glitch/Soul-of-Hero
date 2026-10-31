// Stage: deterministic fixed-step clock, spell lifecycle, scrubbing by re-simulation, showcase sequencing.
import { Frame, W, H } from './frame';
import { Compositor } from './gl';
import { buildFloor, drawCaster, drawTargets } from './floor';
import { Rng, hash, hash2 } from './math';
import { SCHOOLS, type RGB } from './palette';
import { SPELLS } from '../spells';
import type { FX, Inst } from '../spells/types';

export const DT = 1 / 60;
const TAIL = 1.0;

const hexRGB = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

export class Stage {
  frame = new Frame();
  comp: Compositor;
  idx = 0;
  inst!: Inst;
  t = 0;
  at = 0;
  steps = 0;
  speed = 1;
  paused = false;
  loop = true;
  showcase = false;
  private acc = 0;
  private shakeK = 0;
  private flashC: RGB = [0, 0, 0];
  private flashK = 0;
  private chromaK = 0;
  fx: FX;
  onSpell?: (i: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    buildFloor(this.frame);
    this.comp = new Compositor(canvas);
    const self = this;
    this.fx = {
      shake(a) { self.shakeK = Math.max(self.shakeK, a); },
      flash(c, k) { if (k >= self.flashK * 0.6) { self.flashC = c; self.flashK = Math.max(self.flashK, k); } },
      kick(c) { self.chromaK = Math.max(self.chromaK, c); },
      invert: 0, desat: 0, chroma: 0, bloom: 1, ambient: 1, ambientEcho: 0,
    };
    this.cast(0);
  }
  get spell() { return SPELLS[this.idx]; }

  cast(i: number) {
    this.idx = (i + SPELLS.length) % SPELLS.length;
    this.shakeK = 0; this.flashK = 0; this.chromaK = 0;
    this.fx.ambient = 1; this.fx.ambientEcho = 0;
    this.inst = this.spell.make(new Rng(1000 + this.idx * 7919), this.fx);
    this.t = 0; this.at = 0; this.steps = 0; this.acc = 0;
    this.onSpell?.(this.idx);
  }
  step() {
    this.fx.ambient = 1; this.fx.ambientEcho = 0;
    this.inst.update(DT, this.t);
    this.t += DT; this.steps++;
    this.at += DT * this.fx.ambient;
    this.shakeK *= 0.86; this.flashK *= 0.82; this.chromaK *= 0.88;
    if (this.shakeK < 0.3) this.shakeK = 0;
  }
  seek(target: number) {
    target = Math.max(0, target);
    if (target < this.t) this.cast(this.idx);
    while (this.t < target - 1e-6) this.step();
  }
  tick(dtReal: number) {
    if (!this.paused) {
      this.acc += Math.min(dtReal, 0.1) * this.speed;
      let n = 0;
      while (this.acc >= DT && n < 6) { this.step(); this.acc -= DT; n++; }
      if (n === 6) this.acc = 0;
      if (this.t >= this.spell.dur + TAIL) {
        if (this.showcase) this.cast(this.idx + 1);
        else if (this.loop) this.cast(this.idx);
        else this.paused = true;
      }
    }
    this.draw();
  }
  draw() {
    const f = this.frame, fx = this.fx;
    f.clear(); f.t = this.t;
    fx.invert = 0; fx.desat = 0; fx.chroma = 0; fx.bloom = 1;
    const gem = hexRGB(SCHOOLS[this.spell.school].color);
    drawTargets(f, this.at);
    drawCaster(f, gem, this.at, Math.min(1, this.t * 2) * (this.t < this.spell.climax + 0.5 ? 1 : 0.4));
    this.ambient(f);
    this.inst.render(f, this.t);
    const s = this.shakeK;
    const sh: [number, number] = s > 0 ? [(hash(this.steps * 3) - 0.5) * 2 * s, (hash(this.steps * 3 + 1) - 0.5) * 2 * s] : [0, 0];
    const fk = this.flashK;
    this.comp.render(f, {
      shake: sh,
      flash: [this.flashC[0] * fk * 0.28, this.flashC[1] * fk * 0.28, this.flashC[2] * fk * 0.28],
      invert: fx.invert, chroma: fx.chroma + this.chromaK, desat: fx.desat, bloom: fx.bloom,
    });
  }
  /** drifting motes of dust: pure function of the ambient clock, so time-spells can freeze or echo them */
  private ambient(f: Frame) {
    const draw = (at: number, c: RGB, k: number) => {
      for (let i = 0; i < 28; i++) {
        const hx = hash2(i, 1), hy = hash2(i, 2), sp = 2 + hash2(i, 3) * 4;
        const x = ((hx * W + at * sp * 0.6 + Math.sin(at * 0.5 + i) * 8) % W + W) % W;
        const y = (((hy * H - at * sp) % H) + H) % H;
        const tw = 0.5 + 0.5 * Math.sin(at * (1 + hash2(i, 4) * 2) + i * 3);
        f.L(x, y, c[0] * k * tw, c[1] * k * tw, c[2] * k * tw);
      }
    };
    draw(this.at, [0.22, 0.2, 0.26], 1);
    if (this.fx.ambientEcho > 0) {
      draw(this.at - 0.6, [0.1, 0.35, 0.4], this.fx.ambientEcho);
      draw(this.at - 1.2, [0.05, 0.2, 0.3], this.fx.ambientEcho * 0.6);
      draw(this.at + 0.6, [0.4, 0.1, 0.35], this.fx.ambientEcho * 0.7);
    }
  }
}
