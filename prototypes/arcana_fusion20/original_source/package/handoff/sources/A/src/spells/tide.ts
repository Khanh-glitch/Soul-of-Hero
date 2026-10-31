// ---------------------------------------------------------------------------
// II. TIDE — water, ice, and the architecture of pressure
// ---------------------------------------------------------------------------

import { Framebuffer } from "../engine/framebuffer";
import { SpellInstance } from "../engine/types";
import { Pool, streakP } from "../engine/particles";
import { field, glow, streak, pulseRing, line, ribbon, RibbonPt } from "../engine/draw";
import {
  RNG,
  RGB,
  TAU,
  clamp,
  lerp,
  seg,
  smoothstep,
  easeOut,
  backOut,
  fbm,
  vnoise,
  hash2,
  catmull,
} from "../engine/math";
import { ARENA_C, CASTER } from "../engine/arena";
import { rampStep, shard } from "./common";

const C = ARENA_C;
const SQ = 1.5; // top-down vertical squash

/** parametric sheet rasteriser: walks a (u,v) surface and stamps pixels. */
export function sheet(
  fb: Framebuffer,
  us: number,
  vs: number,
  pos: (u: number, v: number) => [number, number],
  col: (u: number, v: number) => RGB | null,
  alpha = 1
) {
  for (let i = 0; i <= us; i++) {
    const u = i / us;
    for (let j = 0; j <= vs; j++) {
      const v = (j / vs) * 2 - 1;
      const c = col(u, v);
      if (!c) continue;
      const p = pos(u, v);
      fb.add(p[0], p[1], c[0], c[1], c[2], alpha);
    }
  }
}

// ===========================================================================
// 05 — ABYSSAL BLOOM
// ===========================================================================
export class AbyssalBloom implements SpellInstance {
  rng = new RNG(0xb100);
  petals: { a: number; len: number; w: number; curl: number; delay: number; twist: number }[] = [];
  inner: { a: number; len: number; w: number; delay: number }[] = [];
  bubbles: { a: number; r: number; sp: number; z: number; s: number }[] = [];
  drops = new Pool();
  BURST = 5.0;

  constructor() {
    const r = this.rng;
    for (let i = 0; i < 7; i++)
      this.petals.push({
        a: (i / 7) * TAU + r.range(-0.05, 0.05),
        len: r.range(58, 82),
        w: r.range(0.42, 0.62),
        curl: r.range(-0.5, 0.5),
        delay: r.range(0, 0.4),
        twist: r.range(-0.3, 0.3),
      });
    for (let i = 0; i < 7; i++)
      this.inner.push({
        a: (i / 7) * TAU + Math.PI / 7,
        len: r.range(28, 44),
        w: r.range(0.3, 0.48),
        delay: r.range(0.3, 0.9),
      });
    for (let i = 0; i < 46; i++)
      this.bubbles.push({
        a: r.angle(),
        r: r.range(6, 52),
        sp: r.range(0.5, 2.2) * r.sign(),
        z: r.next(),
        s: r.range(0.5, 1.6),
      });
  }

  update(dt: number, t: number) {
    if (t > this.BURST && t < this.BURST + 0.5 && this.drops.count() < 420) {
      for (let i = 0; i < 26; i++) {
        const a = this.rng.angle();
        const sp = this.rng.range(60, 300);
        this.drops.spawn({
          x: C.x + Math.cos(a) * this.rng.range(10, 60),
          y: C.y + (Math.sin(a) * this.rng.range(10, 60)) / SQ,
          vx: Math.cos(a) * sp,
          vy: (Math.sin(a) * sp) / SQ,
          life: this.rng.range(0.8, 2.3),
          size: this.rng.range(0.6, 2.2),
          k: this.rng.next(),
          seed: this.rng.next() * 999,
        });
      }
    }
    this.drops.each((p) => {
      // late in life droplets are drawn home again
      const age = 1 - p.life / p.max;
      if (age > 0.45) {
        const dx = C.x - p.x,
          dy = C.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * 170 * dt;
        p.vy += (dy / d) * 170 * dt;
      }
      p.vx *= Math.exp(-1.1 * dt);
      p.vy *= Math.exp(-1.1 * dt);
    });
    this.drops.step(dt);
  }

  casterLight(t: number) {
    return 0.2 + 0.4 * seg(t, 0, 3) + 1.0 * (1 - seg(t, this.BURST, this.BURST + 0.6));
  }

  render(fb: Framebuffer, t: number) {
    const ring = seg(t, 0, 1.0);
    const grow = seg(t, 0.8, 3.6);
    const freeze = smoothstep(4.3, 4.6, t) * (1 - smoothstep(this.BURST, this.BURST + 0.05, t));
    const burst = seg(t, this.BURST, this.BURST + 1.9);
    const open = burst > 0 ? 1 + easeOut(burst, 2) * 0.9 : 1;
    const fade = 1 - clamp(burst * 1.5);

    // --- ground ring with unnatural slow ripples
    if (fade > 0 || burst > 0) {
      const rr = lerp(10, 40, easeOut(ring, 2)) * (1 + burst * 2.2);
      const k = (0.8 - burst * 0.5) * (ring > 0 ? 1 : 0);
      if (k > 0)
        field(fb, C.x - rr * 1.6, C.y - (rr * 1.6) / SQ, C.x + rr * 1.6, C.y + (rr * 1.6) / SQ, (x, y, o) => {
          const dx = x + 0.5 - C.x,
            dy = (y + 0.5 - C.y) * SQ;
          const d = Math.hypot(dx, dy);
          if (d > rr * 1.5) return;
          const w = Math.sin(d * 0.55 - t * 3.4 + fbm(dx * 0.05, dy * 0.05 + t * 0.3, 3) * 4);
          const edge = clamp(1 - Math.abs(d - rr) / (rr * 0.55));
          const h = (0.28 + w * 0.3) * edge * k;
          if (h <= 0.02) return;
          const c = rampStep("water", clamp(h * 1.6), 7);
          o[0] = c[0];
          o[1] = c[1];
          o[2] = c[2];
        });
    }

    // --- petals: continuously flowing membranes
    const drawPetal = (
      a0: number,
      len: number,
      wk: number,
      curl: number,
      g: number,
      depthTint: number,
      twist: number
    ) => {
      const L = len * g * open;
      if (L < 2) return;
      sheet(
        fb,
        Math.max(8, Math.ceil(L * 1.1)),
        Math.max(6, Math.ceil(L * wk * 1.3)),
        (u, v) => {
          const a = a0 + curl * u * u + Math.sin(t * 1.3 + u * 3 + a0) * 0.08 * twist;
          const rr = L * u;
          const wid = L * wk * Math.sin(Math.pow(u, 0.65) * Math.PI) * (1 - burst * 0.2);
          // the contour never stops moving
          const rip = Math.sin(u * 7 - t * 4 + a0 * 3) * 2.2 * u + fbm(u * 5 + a0, t * 0.9, 2) * 3 * u;
          const px = C.x + Math.cos(a) * rr - Math.sin(a) * (v * wid + rip * v * 0.3);
          const py = C.y + (Math.sin(a) * rr + Math.cos(a) * (v * wid + rip * v * 0.3)) / SQ - u * u * 6 * g;
          return [px, py];
        },
        (u, v) => {
          const av = Math.abs(v);
          if (av > 1) return null;
          // darker currents beneath the brighter translucent edges
          const flow = fbm(u * 6 - t * 1.6, v * 3 + a0 * 2, 3);
          let h = 0.26 + flow * 0.3;
          h += Math.pow(av, 3) * 0.55; // luminous rim
          h *= 1 - u * 0.25;
          h *= depthTint;
          h *= fade;
          if (freeze > 0) h += freeze * 0.18;
          if (h < 0.04) return null;
          const c = rampStep("water", clamp(h), 8);
          return [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5];
        },
        1
      );
      // foam droplets shed where curvature is extreme
      if (fade > 0.2) {
        for (let i = 0; i < 5; i++) {
          const u = 0.55 + hash2(i, Math.floor(a0 * 97)) * 0.45;
          const ph = t * 2 + i;
          const a = a0 + curl * u * u;
          const wid = L * wk * Math.sin(Math.pow(u, 0.65) * Math.PI);
          const s = Math.sin(ph) > 0 ? 1 : -1;
          const px = C.x + Math.cos(a) * L * u - Math.sin(a) * s * (wid + 2 + (ph % 1) * 5);
          const py = C.y + (Math.sin(a) * L * u + Math.cos(a) * s * (wid + 2 + (ph % 1) * 5)) / SQ;
          fb.add(px, py, 1.1, 1.8, 2.2, 0.5 * fade * (1 - (ph % 1)));
        }
      }
    };

    for (const p of this.petals) {
      const g = easeOut(clamp((grow - p.delay * 0.25) / 0.8), 2);
      drawPetal(p.a, p.len, p.w, p.curl, g, 1, p.twist);
    }
    for (const p of this.inner) {
      const g = easeOut(clamp((grow - p.delay * 0.4) / 0.7), 2);
      drawPetal(p.a, p.len, p.w, -0.35, g, 1.35, 0.6);
    }

    // --- bubbles circling inside the formation
    if (fade > 0.1)
      for (const b of this.bubbles) {
        const a = b.a + b.sp * t * (0.4 + b.z);
        const rr = b.r * (0.4 + grow * 0.75) * open;
        const x = C.x + Math.cos(a) * rr;
        const y = C.y + (Math.sin(a) * rr) / SQ - b.z * 8 * grow;
        const k = (0.25 + b.z * 0.6) * fade;
        fb.add(x, y, 0.5, 1.1, 1.6, k);
        if (b.s > 1.2) fb.add(x, y - 1, 1.2, 1.9, 2.3, k * 0.6);
      }

    // --- the frozen symmetrical moment
    if (freeze > 0) {
      glow(fb, C.x, C.y, 34, [0.5, 1.0, 1.5], 0.5 * freeze);
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU;
        const rr = 64 + Math.sin(a * 7) * 4;
        fb.add(C.x + Math.cos(a) * rr, C.y + (Math.sin(a) * rr) / SQ, 1.0, 1.7, 2.1, 0.45 * freeze);
      }
    }

    // --- pressure pulse shatters the symmetry
    if (burst > 0 && burst < 1) {
      const e = burst;
      pulseRing(fb, C.x, C.y, 10 + e * 210, 10 * (1 - e), [0.7, 1.5, 2.0], 1.2 * (1 - e), SQ);
      pulseRing(fb, C.x, C.y, 4 + e * 120, 5 * (1 - e), [1.4, 2.0, 2.4], 1.0 * (1 - e), SQ);
      fb.flash[2] += 0.26 * Math.pow(1 - clamp(e * 7), 2);
      fb.flash[1] += 0.16 * Math.pow(1 - clamp(e * 7), 2);
      // erupting sheets
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.3;
        const L = easeOut(e, 2) * 160;
        const pts: RibbonPt[] = [];
        for (let s = 0; s <= 8; s++) {
          const u = s / 8;
          const aa = a + Math.sin(u * 2.2 + i) * 0.35;
          pts.push({ x: C.x + Math.cos(aa) * L * u, y: C.y + (Math.sin(aa) * L * u) / SQ });
        }
        ribbon(
          fb,
          pts,
          (u) => 10 * Math.sin(Math.pow(u, 0.7) * Math.PI) * (1 - e * 0.5),
          (u, _i, edge) => {
            const h = (0.3 + Math.pow(edge, 3) * 0.7) * (1 - e) * (1 - u * 0.4);
            if (h < 0.05) return null;
            const c = rampStep("water", clamp(h * 1.3), 7);
            return [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55];
          }
        );
      }
    }

    // --- droplet rain returning home
    this.drops.each((p) => {
      const l = p.life / p.max;
      const c = rampStep("water", 0.45 + l * 0.5, 7);
      streakP(fb, p, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.9], l * 0.8);
    });
  }
}

// ===========================================================================
// 06 — RIPTIDE CALLIGRAPHY
// ===========================================================================
interface Stroke {
  ctrl: { x: number; y: number }[];
  t0: number;
  dur: number;
  w: number;
  seed: number;
}
export class RiptideCalligraphy implements SpellInstance {
  rng = new RNG(0x7a1d);
  strokes: Stroke[] = [];
  knots: { x: number; y: number; t0: number; a: number }[] = [];
  spray = new Pool();
  WAVE = 5.1;

  constructor() {
    const S = (pts: number[][], t0: number, dur: number, w: number): Stroke => ({
      ctrl: pts.map((p) => ({ x: p[0], y: p[1] })),
      t0,
      dur,
      w,
      seed: this.rng.int(0, 999),
    });
    this.strokes = [
      S([[CASTER.x + 12, CASTER.y - 10], [150, 110], [210, 74], [286, 72], [340, 104]], 0.35, 0.95, 5),
      S([[352, 60], [300, 108], [252, 150], [236, 196], [286, 206]], 1.25, 0.8, 4.2),
      S([[150, 186], [196, 150], [250, 120], [300, 150], [268, 190], [214, 178]], 2.0, 1.0, 3.6),
      S([[120, 60], [190, 96], [258, 130], [330, 176], [372, 200]], 2.95, 0.42, 5.4),
      S([[330, 46], [286, 96], [300, 150], [350, 148], [330, 96], [268, 60]], 3.4, 0.95, 3.2),
      S([[96, 150], [160, 200], [240, 212], [320, 190]], 4.2, 0.55, 4.6),
    ];
    // precompute intersections for braided knots
    for (let i = 0; i < this.strokes.length; i++)
      for (let j = i + 1; j < this.strokes.length; j++) {
        const A = this.sample(this.strokes[i], 40);
        const B = this.sample(this.strokes[j], 40);
        for (let a = 0; a < A.length; a += 2)
          for (let b = 0; b < B.length; b += 2) {
            if (Math.hypot(A[a].x - B[b].x, A[a].y - B[b].y) < 5) {
              const t0 = Math.max(
                this.strokes[i].t0 + (a / A.length) * this.strokes[i].dur,
                this.strokes[j].t0 + (b / B.length) * this.strokes[j].dur
              );
              if (!this.knots.some((k) => Math.hypot(k.x - A[a].x, k.y - A[a].y) < 16))
                this.knots.push({ x: A[a].x, y: A[a].y, t0, a: this.rng.angle() });
            }
          }
      }
  }

  sample(s: Stroke, n: number) {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) out.push(catmull(s.ctrl, i / n));
    return out;
  }

  update(dt: number, t: number) {
    for (const s of this.strokes) {
      const u = seg(t, s.t0, s.t0 + s.dur);
      if (u > 0 && u < 1 && this.rng.next() < 0.75) {
        const p = catmull(s.ctrl, u);
        const q = catmull(s.ctrl, Math.max(0, u - 0.04));
        const a = Math.atan2(p.y - q.y, p.x - q.x) + this.rng.range(-1.2, 1.2);
        const sp = this.rng.range(20, 90);
        this.spray.spawn({
          x: p.x,
          y: p.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp * 0.6,
          life: this.rng.range(0.3, 0.9),
          size: 1,
          seed: this.rng.next() * 99,
        });
      }
    }
    this.spray.each((p) => {
      p.vx *= Math.exp(-2.2 * dt);
      p.vy *= Math.exp(-2.2 * dt);
    });
    this.spray.step(dt);
  }

  casterLight(t: number) {
    return 0.3 + 0.3 * Math.sin(t * 5) + 1.0 * (1 - seg(t, this.WAVE, this.WAVE + 0.8));
  }

  render(fb: Framebuffer, t: number) {
    const charge = seg(t, 4.75, this.WAVE);
    const waves = seg(t, this.WAVE, this.WAVE + 1.7);

    for (let si = 0; si < this.strokes.length; si++) {
      const s = this.strokes[si];
      const u = clamp(seg(t, s.t0, s.t0 + s.dur));
      if (u <= 0) continue;
      const n = 56;
      const pts: RibbonPt[] = [];
      for (let i = 0; i <= n; i++) {
        const uu = (i / n) * u;
        const p = catmull(s.ctrl, uu);
        // inertia: the ribbon lags and overshoots slightly
        const lag = Math.sin(uu * 9 - t * 5 + si) * 1.6 * (1 - uu);
        pts.push({ x: p.x, y: p.y + lag });
      }
      const dissolve = waves > 0 ? 1 - clamp(waves * 1.6) : 1;
      const energy = charge > 0 ? charge : 0;
      ribbon(
        fb,
        pts,
        (uu) => s.w * (0.35 + Math.sin(Math.pow(uu, 0.8) * Math.PI) * 0.95) * (1 + energy * 0.4),
        (uu, _i, edge) => {
          const head = clamp((uu - (u - 0.07)) / 0.07);
          const flow = fbm(uu * 14 - t * 2.4 + s.seed, edge * 3, 3);
          let h = 0.24 + flow * 0.3;
          h += Math.pow(edge, 2.6) * 0.65; // foam along turbulent edges
          h += head * 0.5;
          // energy racing through the finished script
          if (energy > 0) {
            const pulse = Math.sin(uu * 18 - t * 26 + si * 2);
            h += Math.max(0, pulse) * energy * 0.7;
          }
          h *= dissolve;
          if (h < 0.05) return null;
          const c = rampStep("water", clamp(h), 8);
          return [c[0] * 0.55, c[1] * 0.55, c[2] * 0.6];
        }
      );
    }

    // braided knots where strokes cross
    for (const k of this.knots) {
      const age = t - k.t0;
      if (age < 0) continue;
      const kk = clamp(age * 2) * (waves > 0 ? 1 - clamp(waves * 2) : 1);
      if (kk <= 0) continue;
      for (let i = 0; i < 3; i++) {
        const a = k.a + t * (1.6 + i * 0.7) + (i / 3) * TAU;
        const rr = 2.5 + i * 1.6 + Math.sin(t * 3 + i) * 0.8;
        for (let s = 0; s < 14; s++) {
          const aa = a + (s / 14) * 2.4;
          const r2 = rr * (1 - s / 26);
          const c = rampStep("water", 0.55 + 0.35 * (1 - s / 14), 7);
          fb.add(k.x + Math.cos(aa) * r2, k.y + (Math.sin(aa) * r2) / 1.2, c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, kk * 0.8);
        }
      }
      glow(fb, k.x, k.y, 5, [0.5, 1.1, 1.6], 0.4 * kk);
    }

    // --- the writing becomes cutting waves
    if (waves > 0) {
      for (let w = 0; w < 3; w++) {
        const u = clamp((waves - w * 0.14) * 1.5);
        if (u <= 0 || u >= 1) continue;
        const ang = -0.5 + w * 0.55;
        const dirx = Math.cos(ang),
          diry = Math.sin(ang) * 0.5;
        const travel = lerp(-60, 480, easeOut(u, 1.6));
        const ox = 20 + dirx * travel,
          oy = 60 + diry * travel + w * 40;
        const k = Math.sin(u * Math.PI) * 1.2;
        for (let i = -70; i <= 70; i++) {
          const curve = (i * i) / 300;
          const px = ox - curve * dirx * 1.4 - diry * i * 1.6;
          const py = oy - curve * diry + dirx * i * 1.0;
          const h = (1 - Math.abs(i) / 72) * k;
          for (let d = 0; d < 16; d++) {
            const f = (1 - d / 16) * h;
            const c = rampStep("water", clamp(0.25 + f * 0.8), 8);
            fb.add(px - dirx * d * 1.6, py - diry * d * 1.6, c[0] * 0.5 * f, c[1] * 0.5 * f, c[2] * 0.55 * f, 1);
          }
          fb.add(px, py, 1.3, 2.0, 2.4, h * 0.9);
        }
      }
      fb.flash[2] += 0.12 * Math.pow(1 - clamp(waves * 4), 2);
    }

    this.spray.each((p) => {
      const l = p.life / p.max;
      fb.add(p.x, p.y, 0.7 * l, 1.3 * l, 1.8 * l, l * 0.7);
    });
  }
}

// ===========================================================================
// 07 — MIRRORFROST BASILICA
// ===========================================================================
interface Piece {
  x: number;
  y: number;
  r: number;
  sides: number;
  a: number;
  seed: number;
  tier: number;
  delay: number;
  vx: number;
  vy: number;
  av: number;
  broken: number;
}
export class MirrorfrostBasilica implements SpellInstance {
  rng = new RNG(0xf205);
  pieces: Piece[] = [];
  frost: { x: number; y: number; a: number; len: number; delay: number; depth: number }[] = [];
  cracks: { x: number; y: number; a: number; len: number; t0: number }[] = [];
  glitter = new Pool();
  BREAK = 5.2;

  constructor() {
    const r = this.rng;
    // hexagonal frost filaments spreading from the centre
    const grow = (x: number, y: number, a: number, len: number, d: number, delay: number) => {
      this.frost.push({ x, y, a, len, delay, depth: d });
      if (d > 3) return;
      const ex = x + Math.cos(a) * len,
        ey = y + (Math.sin(a) * len) / SQ;
      const kids = d < 2 ? 3 : 2;
      for (let i = 0; i < kids; i++) {
        const na = a + (i - (kids - 1) / 2) * (Math.PI / 3) + r.range(-0.1, 0.1);
        grow(ex, ey, na, len * r.range(0.55, 0.78), d + 1, delay + len * 0.028);
      }
    };
    for (let i = 0; i < 6; i++) grow(C.x, C.y, (i / 6) * TAU, 26, 0, 0);

    // the architecture: concentric tiers of interlocking shards
    for (let tier = 0; tier < 4; tier++) {
      const count = [1, 6, 9, 12][tier];
      const rad = [0, 36, 74, 112][tier];
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + tier * 0.26;
        this.pieces.push({
          x: C.x + Math.cos(a) * rad,
          y: C.y + (Math.sin(a) * rad) / SQ,
          r: [30, 21, 17, 13][tier] * r.range(0.85, 1.15),
          sides: tier === 0 ? 6 : r.int(4, 6),
          a: a + r.range(-0.4, 0.4),
          seed: r.int(0, 9999),
          tier,
          delay: 1.0 + tier * 0.55 + (i / count) * 0.5 + r.range(0, 0.18),
          vx: Math.cos(a) * r.range(30, 110),
          vy: (Math.sin(a) * r.range(30, 110)) / SQ,
          av: r.range(-5, 5),
          broken: 0,
        });
      }
    }
    // spires
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.4;
      this.pieces.push({
        x: C.x + Math.cos(a) * 88,
        y: C.y + (Math.sin(a) * 88) / SQ - 18,
        r: 13,
        sides: 4,
        a,
        seed: r.int(0, 9999),
        tier: 4,
        delay: 3.0 + i * 0.16,
        vx: Math.cos(a) * 60,
        vy: -r.range(40, 90),
        av: r.range(-4, 4),
        broken: 0,
      });
    }
  }

  update(dt: number, t: number) {
    const post = t - this.BREAK;
    if (post > 0) {
      for (const p of this.pieces) {
        const d = Math.hypot(p.x - C.x - 40, p.y - C.y);
        // the fracture front races outward (~250 px/s), each piece snaps
        // loose instantly and is thrown hard, then decelerates
        const trig = d * 0.004;
        if (post > trig) {
          if (p.broken === 0) {
            p.vx *= 2.2;
            p.vy *= 2.2;
          }
          p.broken = Math.min(1, p.broken + dt * 3.2);
          p.vx *= Math.exp(-1.8 * dt);
          p.vy *= Math.exp(-1.8 * dt);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 60 * dt;
          p.a += p.av * dt;
          if (p.broken < 0.2 && this.rng.next() < 0.6)
            for (let i = 0; i < 4; i++) {
              const a = this.rng.angle();
              const sp = this.rng.range(30, 140);
              this.glitter.spawn({
                x: p.x,
                y: p.y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp * 0.6,
                life: this.rng.range(0.4, 1.5),
                size: 1,
                seed: this.rng.next() * 99,
              });
            }
        }
      }
    }
    if (t > 4.2 && t < this.BREAK && this.cracks.length < 60 && this.rng.next() < 0.5) {
      const p = this.pieces[this.rng.int(0, this.pieces.length - 1)];
      this.cracks.push({ x: p.x, y: p.y, a: this.rng.angle(), len: this.rng.range(4, 14), t0: t });
    }
    this.glitter.each((p) => (p.vy += 90 * dt));
    this.glitter.step(dt, 1.2);
  }

  casterLight(t: number) {
    return 0.25 + 0.4 * seg(t, 0, 3) + 1.0 * (1 - seg(t, this.BREAK, this.BREAK + 0.6));
  }

  render(fb: Framebuffer, t: number) {
    const post = t - this.BREAK;

    // --- frost filaments
    for (const f of this.frost) {
      const u = clamp((t - 0.1 - f.delay) * 2.2);
      if (u <= 0) continue;
      const fade = post > 0 ? 1 - clamp(post * 0.5) : 1;
      const ex = f.x + Math.cos(f.a) * f.len * u,
        ey = f.y + (Math.sin(f.a) * f.len * u) / SQ;
      const c = rampStep("frost", 0.45 + (3 - f.depth) * 0.1, 7);
      line(fb, f.x, f.y, ex, ey, [c[0] * 0.7, c[1] * 0.7, c[2] * 0.8], 0.8 * fade);
      // tiny angular leaves
      if (f.depth >= 2) {
        const c2 = rampStep("frost", 0.7, 7);
        fb.add(ex, ey, c2[0] * 0.6, c2[1] * 0.6, c2[2] * 0.6, 0.7 * fade);
      }
    }

    // --- spectral reflections on the floor (drawn first, beneath the mass)
    for (const p of this.pieces) {
      if (p.delay > t) continue;
      const g = clamp((t - p.delay) * 1.6);
      if (p.broken > 0.5) continue;
      for (let i = 1; i < 40; i++) {
        const k = (1 - i / 40) * 0.13 * g;
        const c = rampStep("frost", 0.45, 6);
        fb.add(p.x + i * 0.8, p.y + i * 1.4, c[0] * k, c[1] * k, c[2] * k, 1);
      }
    }

    // --- the basilica
    for (const p of this.pieces) {
      if (p.delay > t) continue;
      const g = clamp(backOut((t - p.delay) * 1.5, 2.4));
      if (g <= 0) continue;
      const fade = 1 - clamp((p.broken - 0.55) / 0.45);
      if (fade <= 0) continue;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.4 - p.tier * 1.1 - Math.hypot(p.x - C.x, p.y - C.y) * 0.05);
      shard(
        fb,
        p.x,
        p.y - (p.tier === 4 ? 10 * g : 0),
        p.r * g,
        p.a,
        p.sides,
        p.seed,
        (d, edge) => {
          // faceted interior + crisp luminous outline
          const facet = 0.1 + 0.36 * Math.pow(1 - d, 1.5) + 0.14 * Math.sin(d * 9 + p.a * 3);
          let h = facet + pulse * 0.14 * (1 - d);
          if (edge < 1.1 || d > 0.86) h = 0.88;
          h *= fade;
          // internal fracture webs appear before the break
          if (t > 4.0) {
            const cr = vnoise(p.x * 0.4 + d * 9 + p.seed, p.y * 0.4 - d * 5);
            if (cr > 0.72 - clamp((t - 4.0) * 0.14)) h += 0.3 * clamp((t - 4.0) * 0.8) * fade;
          }
          const c = rampStep("frost", clamp(h), 7);
          return [c[0] * 0.45, c[1] * 0.45, c[2] * 0.5];
        },
        SQ
      );
    }

    // arches spanning adjacent pieces of each tier
    for (let tier = 1; tier <= 3; tier++) {
      const tp = this.pieces.filter((p) => p.tier === tier);
      for (let i = 0; i < tp.length; i++) {
        const a = tp[i],
          b = tp[(i + 1) % tp.length];
        if (a.delay > t || b.delay > t) continue;
        const g = clamp(Math.min(t - a.delay, t - b.delay) * 1.1);
        const fade = (1 - clamp((Math.max(a.broken, b.broken) - 0.3) / 0.5)) * g;
        if (fade <= 0.02) continue;
        const n = Math.max(12, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 1.6));
        for (let s2 = 0; s2 <= n; s2++) {
          const u = s2 / n;
          const x = lerp(a.x, b.x, u);
          const y = lerp(a.y, b.y, u) - Math.sin(u * Math.PI) * (8 + tier * 3);
          const c = rampStep("frost", 0.5 + 0.3 * Math.sin(u * Math.PI), 6);
          fb.add(x, y, c[0] * 0.4, c[1] * 0.4, c[2] * 0.45, fade * 0.8);
          fb.add(x, y + 1, c[0] * 0.14, c[1] * 0.14, c[2] * 0.18, fade * 0.8);
        }
      }
    }

    // pulses of cold light travelling through the structure
    if (t > 3.4 && post < 0.2) {
      const ph = (t * 48) % 130;
      for (const p of this.pieces) {
        const d = Math.hypot(p.x - C.x, (p.y - C.y) * SQ);
        const f = Math.max(0, 1 - Math.abs(d - ph) / 18);
        // light travels *through* the facets (a lit shard), not a disc behind it
        if (f > 0 && p.broken < 0.3)
          shard(fb, p.x, p.y - (p.tier === 4 ? 10 : 0), p.r * 0.8, p.a, p.sides, p.seed, (dd) => {
            const k = f * 0.22 * (1 - dd);
            return [0.4 * k, 0.8 * k, 1.2 * k];
          }, SQ);
      }
    }

    // fine cracks
    for (const c of this.cracks) {
      const k = post > 0 ? 1 - clamp(post) : clamp((t - c.t0) * 3);
      if (k <= 0) continue;
      for (let i = 0; i < 4; i++) {
        const a = c.a + i * 1.3 + vnoise(c.x + i, c.y) * 0.8;
        line(fb, c.x, c.y, c.x + Math.cos(a) * c.len, c.y + (Math.sin(a) * c.len) / SQ, [1.0, 1.6, 2.1], 0.5 * k);
      }
    }

    // --- the break
    if (post > 0 && post < 0.5) {
      const k = 1 - post / 0.5;
      fb.flash[0] += 0.2 * k * k;
      fb.flash[1] += 0.3 * k * k;
      fb.flash[2] += 0.42 * k * k;
      pulseRing(fb, C.x + 40, C.y, post * 260, 16, [0.8, 1.5, 2.2], k * 0.45, SQ, 0.12, 2.3);
    }

    this.glitter.each((p) => {
      const l = p.life / p.max;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 22 + p.seed));
      fb.add(p.x, p.y, 0.9 * l * tw, 1.5 * l * tw, 2.1 * l * tw, l);
    });
  }
}

// ===========================================================================
// 08 — UNDERTOW MAW
// ===========================================================================
export class UndertowMaw implements SpellInstance {
  rng = new RNG(0x0ceb);
  foam: { a: number; r: number; sp: number; s: number }[] = [];
  drops = new Pool();
  STOP = 4.6;
  SURGE = 4.95;

  constructor() {
    for (let i = 0; i < 160; i++)
      this.foam.push({
        a: this.rng.angle(),
        r: this.rng.range(8, 110),
        sp: this.rng.range(0.6, 2.4),
        s: this.rng.range(0.4, 1.6),
      });
  }

  update(dt: number, t: number) {
    if (t < this.STOP) {
      const pull = seg(t, 0.6, 4.3);
      for (const f of this.foam) {
        f.a += (f.sp * (1.2 + 60 / (f.r + 14))) * dt * (0.4 + pull);
        f.r -= dt * (6 + 40 * pull) * (0.4 + f.s);
        if (f.r < 5) {
          f.r = this.rng.range(80, 130);
          f.a = this.rng.angle();
        }
      }
    }
    if (t > this.SURGE && t < this.SURGE + 0.4 && this.drops.count() < 500) {
      for (let i = 0; i < 34; i++) {
        const a = this.rng.angle();
        const sp = this.rng.range(120, 420);
        this.drops.spawn({
          x: C.x,
          y: C.y,
          vx: Math.cos(a) * sp,
          vy: (Math.sin(a) * sp) / SQ,
          life: this.rng.range(0.6, 2.0),
          size: this.rng.range(0.6, 2.4),
          seed: this.rng.next() * 999,
        });
      }
    }
    this.drops.each((p) => {
      p.vx *= Math.exp(-1.5 * dt);
      p.vy *= Math.exp(-1.5 * dt);
      p.vy += 30 * dt;
    });
    this.drops.step(dt);
  }

  casterLight(t: number) {
    return 0.2 + 0.3 * seg(t, 0, 4) + 1.2 * (1 - seg(t, this.SURGE, this.SURGE + 0.7));
  }

  render(fb: Framebuffer, t: number) {
    const open = seg(t, 0.2, 3.4);
    const rage = seg(t, 2.4, this.STOP);
    const stop = smoothstep(this.STOP, this.STOP + 0.06, t) * (1 - smoothstep(this.SURGE - 0.12, this.SURGE, t));
    const crush = seg(t, this.STOP + 0.05, this.SURGE);
    const surge = seg(t, this.SURGE, this.SURGE + 1.9);

    const Rmax = lerp(16, 112, easeOut(open, 2)) * (1 - crush * 0.92);
    const spin = stop > 0 ? this.STOP : t;

    if (t < this.SURGE) {
      // --- log-spiral vortex: concentric bands at different apparent depths
      const asym = rage * 0.26;
      field(fb, C.x - Rmax * 1.3, C.y - (Rmax * 1.3) / SQ, C.x + Rmax * 1.3, C.y + (Rmax * 1.3) / SQ, (x, y, o) => {
        const dx = x + 0.5 - C.x,
          dy = (y + 0.5 - C.y) * SQ;
        let d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        // asymmetric arms deform the outer silhouette
        const edgeR = Rmax * (1 + asym * Math.sin(a * 3 + spin * 1.3) + asym * 0.5 * Math.sin(a * 5 - spin * 0.7));
        if (d > edgeR) return;
        const rn = Math.max(0.04, d / edgeR);
        // depth: log-spiral descending shaft
        const depth = Math.log(rn + 0.03);
        const swirl = a + depth * 5.0 + spin * (1.2 + 2.6 * (1 - rn));
        const bandv = Math.sin(swirl * 2.0 + Math.log(rn) * 7 - spin * 3.2);
        const noise = fbm(Math.cos(swirl) * 3 * rn + 5, Math.sin(swirl) * 3 * rn - spin * 0.4, 3);
        let h = (0.3 + bandv * 0.34 + noise * 0.3) * Math.pow(rn, 0.55);
        // the throat disappears into darkness
        h *= smoothstep(0.03, 0.3, rn);
        h *= 0.45 + open * 0.9;
        h *= 1 + rage * 0.5;
        if (h < 0.03) {
          // active darkness
          o[0] = -0;
          return;
        }
        const c = rampStep("water", clamp(h), 9);
        o[0] = c[0] * 0.5;
        o[1] = c[1] * 0.5;
        o[2] = c[2] * 0.55;
      });
      // darken the throat
      for (let y = -Rmax / SQ; y <= Rmax / SQ; y++)
        for (let x = -Rmax; x <= Rmax; x++) {
          const d = Math.hypot(x, y * SQ) / (Rmax || 1);
          if (d > 0.45) continue;
          fb.mul(C.x + x, C.y + y, lerp(0.08, 1, clamp(d / 0.45)));
        }

      // bright liquid streams pulled across the void
      for (let i = 0; i < 7; i++) {
        const a0 = (i / 7) * TAU + spin * 0.6;
        const pts: RibbonPt[] = [];
        for (let s = 0; s <= 16; s++) {
          const u = s / 16;
          const rr = Rmax * (1 - u * 0.95);
          const aa = a0 + u * 3.6 * (1 + rage);
          pts.push({ x: C.x + Math.cos(aa) * rr, y: C.y + (Math.sin(aa) * rr) / SQ });
        }
        ribbon(
          fb,
          pts,
          (u) => (1 + 2.4 * (1 - u)) * (0.4 + open),
          (u, _i, e) => {
            const h = (1 - e * e) * (1 - u * 0.7) * (0.45 + rage * 0.5);
            if (h < 0.05) return null;
            const c = rampStep("water", clamp(h * 1.2), 7);
            return [c[0] * 0.5, c[1] * 0.5, c[2] * 0.55];
          }
        );
      }

      // foam clusters
      for (const f of this.foam) {
        if (f.r > Rmax) continue;
        const x = C.x + Math.cos(f.a) * f.r;
        const y = C.y + (Math.sin(f.a) * f.r) / SQ;
        const k = clamp(f.r / 40) * (0.3 + f.s * 0.5) * (0.4 + open);
        const px = C.x + Math.cos(f.a - 0.16) * (f.r + 2);
        const py = C.y + (Math.sin(f.a - 0.16) * (f.r + 2)) / SQ;
        streak(fb, px, py, x, y, 0.9 * f.s, 0.4, [0.8, 1.5, 2.0], k * 0.8);
      }
      // rim
      for (let i = 0; i < 180; i++) {
        const a = (i / 180) * TAU;
        const edgeR = Rmax * (1 + rage * 0.26 * Math.sin(a * 3 + spin * 1.3) + rage * 0.13 * Math.sin(a * 5 - spin * 0.7));
        fb.add(C.x + Math.cos(a) * edgeR, C.y + (Math.sin(a) * edgeR) / SQ, 0.7, 1.3, 1.8, 0.5 * open);
      }
    }

    // --- absolute stillness
    if (stop > 0) {
      fb.exposure *= lerp(1, 1.25, stop);
      glow(fb, C.x, C.y, 10 + crush * 14, [0.6, 1.2, 1.8], 0.6 * stop);
    }
    if (crush > 0.4 && t < this.SURGE) {
      glow(fb, C.x, C.y, lerp(30, 4, crush), [1.2, 1.9, 2.4], crush * 1.6);
    }

    // --- inverse surge
    if (surge > 0) {
      const e = surge;
      fb.flash[2] += 0.5 * Math.pow(1 - clamp(e * 6), 2);
      fb.flash[1] += 0.33 * Math.pow(1 - clamp(e * 6), 2);
      fb.flash[0] += 0.14 * Math.pow(1 - clamp(e * 6), 2);
      // enormous curved sheets
      for (let i = 0; i < 11; i++) {
        const a0 = (i / 11) * TAU + 0.2;
        const L = easeOut(e, 1.8) * (150 + hash2(i, 3) * 90);
        sheet(
          fb,
          Math.ceil(L),
          14,
          (u, v) => {
            const a = a0 + u * 0.8 * (hash2(i, 5) - 0.5) * 2;
            const wid = 24 * Math.sin(Math.pow(u, 0.5) * Math.PI) * u;
            const rr = L * u;
            return [
              C.x + Math.cos(a) * rr - Math.sin(a) * v * wid,
              C.y + (Math.sin(a) * rr + Math.cos(a) * v * wid) / SQ,
            ];
          },
          (u, v) => {
            const av = Math.abs(v);
            let h = (0.22 + Math.pow(av, 3) * 0.7) * (1 - u * 0.5) * (1 - e * 0.85);
            h *= 0.6 + fbm(u * 8 + i, v * 3 - t * 2, 2) * 0.9;
            if (h < 0.04) return null;
            const c = rampStep("water", clamp(h * 1.4), 8);
            return [c[0] * 0.45, c[1] * 0.45, c[2] * 0.5];
          }
        );
      }
      for (let i = 0; i < 3; i++) {
        const u = clamp(e * 1.6 - i * 0.12);
        pulseRing(fb, C.x, C.y, u * (260 - i * 40), 12 * (1 - u), [0.8, 1.6, 2.2], (1 - u) * 1.1, SQ);
      }
      // collapsing liquid tunnel
      const tun = 1 - clamp(e * 2.4);
      if (tun > 0)
        for (let i = 0; i < 4; i++) {
          const rr = 10 + i * 16 + e * 120;
          pulseRing(fb, C.x, C.y, rr, 3, [0.5, 1.1, 1.7], tun * 0.35 * (1 - i / 4), SQ, 0.3, i * 1.9);
        }
    }

    this.drops.each((p) => {
      const l = p.life / p.max;
      const c = rampStep("water", 0.4 + l * 0.55, 7);
      streakP(fb, p, [c[0] * 0.75, c[1] * 0.75, c[2] * 0.85], l * 0.85);
    });
  }
}
