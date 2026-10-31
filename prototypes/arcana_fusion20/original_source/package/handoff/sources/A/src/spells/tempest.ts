// ---------------------------------------------------------------------------
// III. TEMPEST — electricity as unstable intelligence
// ---------------------------------------------------------------------------

import { Framebuffer } from "../engine/framebuffer";
import { SpellInstance } from "../engine/types";
import { Pool } from "../engine/particles";
import { fieldMul, glow, streak, line, boltPath, boltDraw, pulseRing } from "../engine/draw";
import {
  RNG,
  RGB,
  TAU,
  clamp,
  lerp,
  seg,
  smoothstep,
  easeOut,
  vnoise,
  hash2,
} from "../engine/math";
import { ARENA_C, CASTER } from "../engine/arena";
import { W } from "../engine/world";
import { rampStep, growBranches, updateBranches, drawBranch, Branch } from "./common";

const C = ARENA_C;
const VOLT = (h: number) => rampStep("volt", h, 8);
const CORE: RGB = [3.2, 3.4, 3.6];

/** jittered lightning, re-seeded every few frames so it crackles */
function bolt(
  fb: Framebuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: number,
  seed: number,
  w: number,
  k: number,
  chaos = 0.32
) {
  const frame = Math.floor(t * 28);
  const d = Math.hypot(x1 - x0, y1 - y0);
  const pts = boltPath(x0, y0, x1, y1, d * chaos, seed * 131 + frame * 7919, 5);
  boltDraw(fb, pts, w, VOLT(0.62), CORE, k);
  // forked leaders
  const r = new RNG(seed * 31 + frame);
  const n = Math.max(1, Math.floor(d / 40));
  for (let i = 0; i < n; i++) {
    const idx = r.int(3, pts.length - 3);
    const p = pts[idx];
    const a = r.angle();
    const len = d * r.range(0.07, 0.24);
    const sub = boltPath(p.x, p.y, p.x + Math.cos(a) * len, p.y + Math.sin(a) * len, len * 0.5, r.int(0, 9999), 3);
    boltDraw(fb, sub, w * 0.55, VOLT(0.5), VOLT(0.92), k * 0.6);
  }
  // capped local ionisation glow: long bolts no longer fog the frame white
  glow(fb, (x0 + x1) / 2, (y0 + y1) / 2, Math.min(16, d * 0.25), VOLT(0.45), 0.07 * k);
}

// ===========================================================================
// 09 — CHAIN VERDICT
// ===========================================================================
export class ChainVerdict implements SpellInstance {
  rng = new RNG(0x9c4a);
  nodes: { x: number; y: number; charge: number }[] = [];
  events: { a: number; b: number; t0: number; fail: boolean; seed: number }[] = [];
  sparks = new Pool();
  FINAL = 5.0;
  enemyOf = [-1, 4, 3, 1, 2, 5, 6, 0];

  constructor() {
    const r = this.rng;
    // every node but the caster's hand is a living body: the chain hunts enemies
    this.nodes = [{ x: CASTER.x + 14, y: CASTER.y - 8, charge: 0 }];
    for (let i = 1; i < this.enemyOf.length; i++) {
      const e = W.enemies[this.enemyOf[i]];
      this.nodes.push({ x: e ? e.x : C.x, y: e ? e.y - e.spr.h * 0.55 : C.y, charge: 0 });
    }
    // the discharge explores: successes advance the chain, failures collapse
    const order = [0, 1, 2, 7, 3, 4, 5, 6, 7, 2];
    let tt = 1.35;
    for (let i = 0; i < order.length - 1; i++) {
      // a couple of failed probes before each real connection
      for (let f = 0; f < r.int(1, 2); f++) {
        this.events.push({
          a: order[i],
          b: r.int(0, this.nodes.length - 1),
          t0: tt,
          fail: true,
          seed: r.int(0, 9999),
        });
        tt += 0.07;
      }
      this.events.push({ a: order[i], b: order[i + 1], t0: tt, fail: false, seed: r.int(0, 9999) });
      tt += r.range(0.22, 0.42);
    }
  }

  update(dt: number, t: number) {
    for (let i = 1; i < this.nodes.length; i++) {
      const en = W.enemies[this.enemyOf[i]];
      if (!en) continue;
      this.nodes[i].x = en.x;
      this.nodes[i].y = en.y - en.z - en.spr.h * 0.55;
    }
    for (const e of this.events) {
      if (!e.fail && t > e.t0 && t < e.t0 + 0.1) {
        const n = this.nodes[e.b];
        for (let i = 0; i < 10; i++) {
          const a = this.rng.angle();
          const sp = this.rng.range(30, 150);
          this.sparks.spawn({
            x: n.x,
            y: n.y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp * 0.6,
            life: this.rng.range(0.15, 0.6),
            seed: this.rng.next() * 99,
          });
        }
      }
    }
    if (t > this.FINAL && t < this.FINAL + 0.8 && this.rng.next() < 0.9) {
      const n = this.nodes[this.rng.int(0, this.nodes.length - 1)];
      for (let i = 0; i < 6; i++) {
        const a = this.rng.angle();
        const sp = this.rng.range(60, 260);
        this.sparks.spawn({
          x: n.x,
          y: n.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp * 0.6,
          life: this.rng.range(0.2, 0.9),
          seed: this.rng.next() * 99,
        });
      }
    }
    this.sparks.each((p) => (p.vy += 60 * dt));
    this.sparks.step(dt, 2.4);
  }

  casterLight(t: number) {
    let k = 0.2;
    for (const e of this.events) if (!e.fail) k += 0.5 * Math.exp(-Math.abs(t - e.t0) * 9);
    return clamp(k + 1.3 * Math.exp(-Math.abs(t - this.FINAL - 0.3) * 3), 0, 2.4);
  }

  render(fb: Framebuffer, t: number) {
    const final = seg(t, this.FINAL, this.FINAL + 1.0);

    // --- probing discharges crawling on the nodes
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const armed = this.events.some((e) => !e.fail && e.b === i && t > e.t0) || i === 0;
      const base = armed ? 0.8 : 0.35 * smoothstep(0.1, 1.2, t);
      const fr = Math.floor(t * 20) + i * 13;
      const r = new RNG(fr);
      for (let s = 0; s < 3; s++) {
        const a = r.angle();
        const len = r.range(3, 11) * base;
        const p = boltPath(n.x, n.y, n.x + Math.cos(a) * len, n.y + Math.sin(a) * len, len * 0.6, r.int(0, 999), 2);
        boltDraw(fb, p, 0.9, VOLT(0.45), VOLT(0.88), base * 0.8);
      }
      glow(fb, n.x, n.y, 4 + base * 5, VOLT(0.55), 0.2 + base * 0.3);
      fb.add(n.x, n.y, CORE[0], CORE[1], CORE[2], 0.5 * base);
    }

    // --- ghost channels : the memory of every path taken
    for (const e of this.events) {
      if (e.fail || t < e.t0) continue;
      const age = t - e.t0;
      const A = this.nodes[e.a],
        B = this.nodes[e.b];
      const ghost = Math.max(0, 0.22 - age * 0.02) + (final > 0 ? 0 : 0);
      if (ghost > 0.01) {
        const pts = boltPath(A.x, A.y, B.x, B.y, Math.hypot(B.x - A.x, B.y - A.y) * 0.3, e.seed, 4);
        for (let i = 0; i < pts.length - 1; i++)
          line(fb, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, VOLT(0.42), ghost * (0.7 + 0.3 * Math.sin(t * 9 + i)));
      }
    }

    // --- live discharges
    for (const e of this.events) {
      const age = t - e.t0;
      const A = this.nodes[e.a],
        B = this.nodes[e.b];
      if (e.fail) {
        // probes that reach out and collapse
        if (age < 0 || age > 0.16) continue;
        const u = 1 - age / 0.16;
        const ex = lerp(A.x, B.x, 0.45 * u),
          ey = lerp(A.y, B.y, 0.45 * u);
        bolt(fb, A.x, A.y, ex, ey, t, e.seed, 0.9, u * 0.55, 0.45);
      } else {
        if (age < 0 || age > 0.26) continue;
        const k = Math.pow(1 - age / 0.26, 1.5);
        // a powerful arc may split around the target and converge
        if (e.seed % 3 === 0) {
          const mx = (A.x + B.x) / 2,
            my = (A.y + B.y) / 2;
          const nx = -(B.y - A.y) * 0.3,
            ny = (B.x - A.x) * 0.3;
          bolt(fb, A.x, A.y, mx + nx, my + ny, t, e.seed, 1.4, k, 0.2);
          bolt(fb, mx + nx, my + ny, B.x, B.y, t, e.seed + 1, 1.4, k, 0.2);
          bolt(fb, A.x, A.y, mx - nx, my - ny, t, e.seed + 2, 1.2, k * 0.8, 0.2);
          bolt(fb, mx - nx, my - ny, B.x, B.y, t, e.seed + 3, 1.2, k * 0.8, 0.2);
        } else {
          bolt(fb, A.x, A.y, B.x, B.y, t, e.seed, 1.6, k);
        }
        glow(fb, B.x, B.y, 14 * k, VOLT(0.7), k);
        fb.flash[2] += 0.05 * k;
      }
    }

    // --- cascading network failure
    if (final > 0 && final < 1) {
      const succ = this.events.filter((e) => !e.fail);
      for (let i = 0; i < succ.length; i++) {
        const u = (final - i * 0.028) / 0.1;
        if (u < 0 || u > 1) continue;
        const k = Math.sin(u * Math.PI);
        const e = succ[i];
        bolt(fb, this.nodes[e.a].x, this.nodes[e.a].y, this.nodes[e.b].x, this.nodes[e.b].y, t, e.seed, 2.2, k * 1.4, 0.18);
      }
      const webK = Math.sin(clamp(final * 1.3) * Math.PI);
      fb.flash[2] += 0.3 * webK * webK;
      fb.flash[0] += 0.1 * webK * webK;
      for (const n of this.nodes) glow(fb, n.x, n.y, 8 + webK * 10, VOLT(0.7), webK * 0.55);
      if (final > 0.55) {
        const d = seg(t, this.FINAL + 0.55, this.FINAL + 1.6);
        for (const e of succ) {
          const A = this.nodes[e.a],
            B = this.nodes[e.b];
          const pts = boltPath(A.x, A.y, B.x, B.y, 20, e.seed, 4);
          for (let i = 0; i < pts.length - 1; i++)
            if (hash2(e.seed, i) > d)
              line(fb, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, VOLT(0.55), (1 - d) * 0.5);
        }
      }
    }

    this.sparks.each((p) => {
      const l = p.life / p.max;
      const c = VOLT(0.5 + l * 0.5);
      fb.add(p.x, p.y, c[0], c[1], c[2], l);
      fb.add(p.px, p.py, c[0], c[1], c[2], l * 0.4);
    });
  }
}

// ===========================================================================
// 10 — THUNDERLOOM
// ===========================================================================
export class Thunderloom implements SpellInstance {
  rng = new RNG(0x7417);
  T = { x: 272, y: 112 };
  threads: { r: number; tilt: number; squash: number; sp: number; ph: number; w: number }[] = [];
  cores: { r: number; sp: number; ph: number; s: number }[] = [];
  fract: Branch[] = [];
  relight: { x: number; y: number; t0: number; a: number }[] = [];
  STRIKE = 4.9;

  constructor() {
    const r = this.rng;
    for (let i = 0; i < 16; i++)
      this.threads.push({
        r: r.range(16, 62),
        tilt: r.angle(),
        squash: r.range(1.6, 5),
        sp: r.range(0.5, 2.6) * r.sign(),
        ph: r.angle(),
        w: r.range(0.6, 1.6),
      });
    for (let i = 0; i < 4; i++)
      this.cores.push({ r: r.range(10, 34), sp: r.range(1.2, 3) * r.sign(), ph: r.angle(), s: r.range(1, 2.4) });
    const br = new RNG(515);
    for (let i = 0; i < 14; i++)
      this.fract.push(
        ...growBranches(br, this.T.x, this.T.y, br.angle(), 1.5, {
          steps: 9,
          step: 9,
          wander: 0.42,
          branchChance: 0.2,
          maxDepth: 2,
          widthFalloff: 0.6,
          speed: 6,
        })
      );
    for (let i = 0; i < 18; i++) {
      const a = r.angle(),
        d = r.range(20, 120);
      this.relight.push({
        x: this.T.x + Math.cos(a) * d,
        y: this.T.y + Math.sin(a) * d * 0.7,
        t0: this.STRIKE + r.range(0.35, 1.7),
        a: r.angle(),
      });
    }
  }

  update(_dt: number, t: number) {
    if (t > this.STRIKE) updateBranches(this.fract, t - this.STRIKE);
  }

  casterLight(t: number) {
    return 0.15 + 0.4 * seg(t, 0, 4) + 1.6 * (1 - seg(t, this.STRIKE, this.STRIKE + 0.5));
  }

  render(fb: Framebuffer, t: number) {
    const build = seg(t, 0.2, 3.4);
    const wind = seg(t, 3.2, 4.45);
    const rev = seg(t, 4.45, this.STRIKE);
    const post = t - this.STRIKE;
    const T = this.T;

    if (t < this.STRIKE) {
      // --- the shadow gathering overhead
      const sh = build * (1 + wind * 0.3);
      fieldMul(fb, T.x - 110, T.y - 90, T.x + 110, T.y + 90, (x, y) => {
        const d = Math.hypot((x - T.x) / 100, (y - T.y) / 78);
        if (d > 1) return 1;
        return lerp(1, lerp(0.14, 1, d * d), sh);
      });

      const contract = 1 - rev * 0.93;
      const spin = t * (1 + wind * 3 + rev * 9);

      // --- magnetic filaments weaving the storm
      for (let i = 0; i < this.threads.length; i++) {
        const th = this.threads[i];
        const g = clamp((build - i * 0.03) * 1.4);
        if (g <= 0) continue;
        const rr = th.r * contract * g;
        const steps = 54;
        let px = 0,
          py = 0;
        for (let s = 0; s <= steps; s++) {
          const a = (s / steps) * TAU + th.ph + spin * th.sp * 0.3;
          const lx = Math.cos(a) * rr;
          const ly = (Math.sin(a) * rr) / th.squash;
          const x = T.x + lx * Math.cos(th.tilt) - ly * Math.sin(th.tilt);
          const y = T.y + lx * Math.sin(th.tilt) + ly * Math.cos(th.tilt);
          if (s > 0) {
            const flow = 0.5 + 0.5 * Math.sin(a * 4 - t * 12 + i);
            const c = VOLT(0.35 + flow * 0.35);
            line(fb, px, py, x, y, c, (0.26 + flow * 0.4) * g * (0.5 + wind * 0.8));
          }
          px = x;
          py = y;
        }
      }
      // --- discharges jumping between threads reveal the internal architecture
      const fr = Math.floor(t * 24);
      const r = new RNG(fr * 7 + 3);
      const nJump = Math.floor(2 + build * 5 + wind * 7);
      for (let i = 0; i < nJump; i++) {
        const a1 = r.angle(),
          a2 = r.angle();
        const r1 = r.range(6, 62) * contract,
          r2 = r.range(6, 62) * contract;
        const x1 = T.x + Math.cos(a1) * r1,
          y1 = T.y + (Math.sin(a1) * r1) / 1.7;
        const x2 = T.x + Math.cos(a2) * r2,
          y2 = T.y + (Math.sin(a2) * r2) / 1.7;
        bolt(fb, x1, y1, x2, y2, t, i * 17 + fr, 0.8, (0.35 + wind * 0.6) * build, 0.4);
      }
      // --- bright concentrations rotating in opposition
      for (const co of this.cores) {
        const a = co.ph + co.sp * spin;
        const rr = co.r * contract * build;
        const x = T.x + Math.cos(a) * rr,
          y = T.y + (Math.sin(a) * rr) / 1.8;
        glow(fb, x, y, co.s * (3 + wind * 5), VOLT(0.75), (0.5 + wind) * build);
        fb.add(x, y, CORE[0], CORE[1], CORE[2], build);
      }
      if (rev > 0.3) glow(fb, T.x, T.y, lerp(26, 5, rev), [2.0, 2.4, 3.2], rev * 2.2);
    }

    // --- the spear
    if (post > -0.02) {
      const k = Math.max(0, 1 - post / 0.4);
      if (post < 0.28) {
        const w = lerp(5, 1.2, post / 0.28);
        for (let y = 0; y <= T.y; y++) {
          const n = vnoise(y * 0.2, Math.floor(t * 60) * 0.3);
          const xx = T.x + (n - 0.5) * 3 * (1 - y / T.y);
          for (let dx = -w * 2; dx <= w * 2; dx++) {
            const f = Math.max(0, 1 - Math.abs(dx) / (w * 2));
            const c = VOLT(0.5 + f * 0.5);
            fb.add(xx + dx, y, c[0], c[1], c[2], f * f * (1 - post / 0.4));
          }
          fb.add(xx, y, CORE[0], CORE[1], CORE[2], 1 - post / 0.3);
        }
        fb.flash[0] += 0.26 * k * k;
        fb.flash[1] += 0.3 * k * k;
        fb.flash[2] += 0.42 * k * k;
        fb.exposure *= 1 + k * 0.35;
      }
      // radial electrical fractures
      for (const b of this.fract)
        drawBranch(
          fb,
          b,
          (u, e) => {
            const decay = Math.exp(-Math.max(0, post - 0.4) * 1.1);
            const h = (1 - e) * (1 - u * 0.78) * decay;
            if (h < 0.05) return null;
            return VOLT(clamp(h * 0.78));
          },
          (u, bb) => Math.max(0.5, bb.w * (1 - u * 0.6))
        );
      glow(fb, T.x, T.y, 50 * Math.exp(-post * 1.6), VOLT(0.65), 1.4 * Math.exp(-post * 1.6));
      pulseRing(fb, T.x, T.y, post * 320, 18 * Math.exp(-post * 2), VOLT(0.5), Math.max(0, 1 - post * 1.4) * 0.4, 1.6, 0.22, 3.1);

      // electromagnetic interference: rows of the image shear sideways
      const emi = Math.exp(-post * 2.2);
      if (emi > 0.05) {
        for (let y = 0; y < fb.H; y++) {
          const n = vnoise(y * 0.3, Math.floor(t * 40) * 0.7);
          if (n < 0.86 - emi * 0.25) continue;
          const sh = Math.round((n - 0.5) * 14 * emi);
          if (!sh) continue;
          const row = new Float32Array(fb.W * 3);
          for (let x = 0; x < fb.W; x++) {
            const s = clamp(x + sh, 0, fb.W - 1) | 0;
            row[x * 3] = fb.buf[(y * fb.W + s) * 3];
            row[x * 3 + 1] = fb.buf[(y * fb.W + s) * 3 + 1];
            row[x * 3 + 2] = fb.buf[(y * fb.W + s) * 3 + 2];
          }
          for (let x = 0; x < fb.W; x++) {
            fb.buf[(y * fb.W + x) * 3] = row[x * 3];
            fb.buf[(y * fb.W + x) * 3 + 1] = row[x * 3 + 1];
            fb.buf[(y * fb.W + x) * 3 + 2] = row[x * 3 + 2];
          }
        }
      }
      // delayed miniature re-ignitions
      for (const rl of this.relight) {
        const age = t - rl.t0;
        if (age < 0 || age > 0.18) continue;
        const k2 = 1 - age / 0.18;
        bolt(fb, rl.x, rl.y, rl.x + Math.cos(rl.a) * 16, rl.y + Math.sin(rl.a) * 11, t, rl.t0 * 100, 0.8, k2 * 0.9, 0.5);
      }
    }
  }
}

// ===========================================================================
// 11 — VOLT CAROUSEL
// ===========================================================================
interface Ring {
  r: number;
  squash: number;
  tilt: number;
  sp: number;
  ph: number;
  segs: number;
  gap: number;
  drift: number;
  jump: number;
}
export class VoltCarousel implements SpellInstance {
  rng = new RNG(0xc0de);
  rings: Ring[] = [];
  frags = new Pool();
  SYNC = 5.3;

  constructor() {
    const r = this.rng;
    for (let i = 0; i < 6; i++)
      this.rings.push({
        r: 18 + i * 13 + r.range(-4, 4),
        squash: r.range(1.1, 2.6),
        tilt: r.angle(),
        sp: r.range(0.5, 2.2) * (i % 2 ? 1 : -1),
        ph: r.angle(),
        segs: r.int(3, 7),
        gap: r.range(0.25, 0.6),
        drift: r.range(-10, 10),
        jump: r.range(0, 6),
      });
  }

  segPos(ring: Ring, k: number, t: number, scale: number) {
    const a = ring.ph + ring.sp * t * (1 + 0.4 * Math.sin(t * 0.7 + ring.jump)) + (k / ring.segs) * TAU;
    const rr = (ring.r + Math.sin(t * 0.9 + ring.jump) * ring.drift) * scale;
    const lx = Math.cos(a) * rr,
      ly = (Math.sin(a) * rr) / ring.squash;
    return {
      x: C.x + lx * Math.cos(ring.tilt) - ly * Math.sin(ring.tilt),
      y: C.y + lx * Math.sin(ring.tilt) + ly * Math.cos(ring.tilt),
      a,
      rr,
    };
  }

  update(dt: number, t: number) {
    if (t > this.SYNC + 0.35 && t < this.SYNC + 0.6) {
      for (const ring of this.rings)
        for (let k = 0; k < ring.segs; k++) {
          const p = this.segPos(ring, k, t, 1);
          const a = Math.atan2(p.y - C.y, p.x - C.x);
          this.frags.spawn({
            x: p.x,
            y: p.y,
            vx: Math.cos(a) * 70,
            vy: Math.sin(a) * 50,
            life: 1.6,
            a: a,
            av: this.rng.range(-6, 6),
            size: this.rng.range(2, 6),
            seed: this.rng.next() * 999,
          });
        }
    }
    this.frags.each((p) => {
      p.vx *= Math.exp(-0.9 * dt);
      p.vy *= Math.exp(-0.9 * dt);
    });
    this.frags.step(dt);
  }

  casterLight(t: number) {
    return 0.2 + 0.5 * seg(t, 0, 4) + 1.4 * (1 - seg(t, this.SYNC, this.SYNC + 0.6));
  }

  render(fb: Framebuffer, t: number) {
    const build = seg(t, 0.15, 1.8);
    const energy = seg(t, 1.5, this.SYNC);
    const sync = seg(t, this.SYNC, this.SYNC + 0.55);
    const after = seg(t, this.SYNC + 0.4, this.SYNC + 1.9);
    const scale = easeOut(build, 2) * (1 + sync * 0.1) * (after > 0 ? 1 + after * 0.4 : 1);
    const vis = 1 - clamp(after * 1.6);

    if (vis > 0) {
      // --- the machine: segmented halos of condensed electricity
      for (let ri = 0; ri < this.rings.length; ri++) {
        const ring = this.rings[ri];
        const g = clamp((build - ri * 0.08) * 1.6);
        if (g <= 0) continue;
        for (let k = 0; k < ring.segs; k++) {
          const p = this.segPos(ring, k, t, scale);
          const span = ((1 - ring.gap) / ring.segs) * TAU;
          // draw the arc segment in the ring's tilted frame
          const steps = Math.max(5, Math.ceil(p.rr * span));
          let px = 0,
            py = 0;
          for (let s = 0; s <= steps; s++) {
            const aa = p.a + (s / steps - 0.5) * span;
            const lx = Math.cos(aa) * p.rr,
              ly = (Math.sin(aa) * p.rr) / ring.squash;
            const x = C.x + lx * Math.cos(ring.tilt) - ly * Math.sin(ring.tilt);
            const y = C.y + lx * Math.sin(ring.tilt) + ly * Math.cos(ring.tilt);
            if (s > 0) {
              const c = VOLT(0.45 + 0.3 * Math.sin(s * 0.7 - t * 9 + ri) + energy * 0.2 + sync * 0.3);
              // after synchronisation the machine burns out: thinner, dimmer
              const burn = 1 - sync * 0.6;
              streak(fb, px, py, x, y, 1.4 + sync * 0.6, 1.4 + sync * 0.6, c, (0.4 + energy * 0.35) * g * vis * burn);
              line(fb, px, py, x, y, CORE, 0.45 * g * vis * burn);
            }
            px = x;
            py = y;
          }
          glow(fb, p.x, p.y, 4 + sync * 3, VOLT(0.7), (0.3 + energy * 0.3) * g * vis);
        }
      }

      // --- electric bridges between momentarily aligned segments
      const all: { x: number; y: number; ri: number }[] = [];
      for (let ri = 0; ri < this.rings.length; ri++) {
        if (clamp((build - ri * 0.08) * 1.6) <= 0) continue;
        for (let k = 0; k < this.rings[ri].segs; k++) {
          const p = this.segPos(this.rings[ri], k, t, scale);
          all.push({ x: p.x, y: p.y, ri });
        }
      }
      const thresh = sync > 0 ? 70 : 26 + energy * 24;
      let bi = 0;
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++) {
          if (all[i].ri === all[j].ri) continue;
          const d = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y);
          if (d > thresh) continue;
          const k = sync > 0 ? Math.sin(clamp(sync * 1.4) * Math.PI) * 0.8 : clamp(1 - d / thresh) * (0.4 + energy);
          bolt(fb, all[i].x, all[i].y, all[j].x, all[j].y, t, bi++ * 97, 1.0, k * vis, 0.22);
        }

      // energy accumulating in the hub
      glow(fb, C.x, C.y, 6 + energy * 14 + sync * 26, VOLT(0.6), (0.3 + energy * 0.6 + sync * 0.7) * vis);
    }

    if (sync > 0) {
      const k = Math.sin(clamp(sync) * Math.PI);
      pulseRing(fb, C.x, C.y, sync * 280, 16 * (1 - sync), VOLT(0.6), (1 - sync) * 0.6, 1.3);
      for (let i = 0; i < 12; i++) {
        const a = (i / 18) * TAU + sync;
        const L = easeOut(sync, 2) * 200;
        bolt(fb, C.x, C.y, C.x + Math.cos(a) * L, C.y + (Math.sin(a) * L) / 1.4, t, i * 31, 1.1, k * 0.7, 0.16);
      }
    }

    this.frags.each((p) => {
      const l = p.life / p.max;
      const a = p.a + p.av * (p.max - p.life);
      for (let s = -p.size; s <= p.size; s++) {
        const c = VOLT(0.35 + l * 0.35);
        fb.add(p.x + Math.cos(a) * s, p.y + (Math.sin(a) * s) / 1.5, c[0], c[1], c[2], l * 0.45);
      }
      if (Math.sin(t * 30 + p.seed) > 0.75) {
        const e = p.size;
        bolt(fb, p.x - Math.cos(a) * e, p.y - (Math.sin(a) * e) / 1.5, p.x + Math.cos(a) * e, p.y + (Math.sin(a) * e) / 1.5, t, p.seed, 0.6, l * 0.35, 0.6);
      }
    });
  }
}

// ===========================================================================
// 12 — SKYBREAKER SCRIPT
// ===========================================================================
interface GNode {
  x: number;
  y: number;
}
interface GEdge {
  a: number;
  b: number;
  t0: number;
  instant: boolean;
  seed: number;
  blow: number;
}
export class SkybreakerScript implements SpellInstance {
  rng = new RNG(0x5b12);
  N: GNode[] = [];
  E: GEdge[] = [];
  packets: { e: number; u: number; dir: number; life: number }[] = [];
  CIRCUIT = 4.3;
  RUPTURE = 6.0;

  constructor() {
    const r = this.rng;
    const push = (x: number, y: number) => this.N.push({ x, y }) - 1;
    // outer asymmetric ring
    const outer: number[] = [];
    const nOut = 9;
    for (let i = 0; i < nOut; i++) {
      const a = (i / nOut) * TAU + r.range(-0.12, 0.12);
      const rr = 72 + r.range(-12, 12);
      outer.push(push(C.x + Math.cos(a) * rr, C.y + (Math.sin(a) * rr) / 1.35));
    }
    const inner: number[] = [];
    const nIn = 5;
    for (let i = 0; i < nIn; i++) {
      const a = (i / nIn) * TAU + 0.5;
      const rr = 34 + r.range(-6, 6);
      inner.push(push(C.x + Math.cos(a) * rr, C.y + (Math.sin(a) * rr) / 1.35));
    }
    const ctr = push(C.x, C.y);

    let tt = 0.45;
    const edge = (a: number, b: number, instant: boolean) => {
      this.E.push({ a, b, t0: tt, instant, seed: r.int(0, 9999), blow: 0 });
      tt += instant ? r.range(0.08, 0.16) : r.range(0.17, 0.3);
    };
    // angular characters: chords skipping nodes
    for (let i = 0; i < nOut; i++) edge(outer[i], outer[(i + 3) % nOut], r.next() < 0.5);
    for (let i = 0; i < nOut; i += 2) edge(outer[i], inner[i % nIn], true);
    for (let i = 0; i < nIn; i++) edge(inner[i], inner[(i + 2) % nIn], false);
    for (let i = 0; i < nIn; i++) edge(inner[i], ctr, true);
    // nested sub-diagrams hanging off three outer nodes
    for (let k = 0; k < 3; k++) {
      const base = outer[k * 3];
      const a0 = Math.atan2(this.N[base].y - C.y, this.N[base].x - C.x);
      let prev = base;
      const sub: number[] = [];
      for (let i = 0; i < 4; i++) {
        const a = a0 + (i / 4) * TAU * 0.6 - 0.3;
        const id = push(this.N[base].x + Math.cos(a) * 14, this.N[base].y + Math.sin(a) * 11);
        sub.push(id);
        edge(prev, id, true);
        prev = id;
      }
      edge(prev, base, true);
    }
    this.RUPTURE = Math.max(5.8, tt + 1.9);
    this.CIRCUIT = tt + 0.25;
  }

  update(dt: number, t: number) {
    if (t > this.CIRCUIT && t < this.RUPTURE) {
      if (this.packets.length < 26 && this.rng.next() < 0.5)
        this.packets.push({ e: this.rng.int(0, this.E.length - 1), u: 0, dir: 1, life: 2 });
      for (const p of this.packets) {
        p.u += dt * 2.2 * p.dir;
        p.life -= dt;
        if (p.u > 1 || p.u < 0) {
          // fork at the intersection
          const e = this.E[p.e];
          const node = p.u > 1 ? e.b : e.a;
          const cands = this.E.map((_, i) => i).filter((i) => this.E[i].a === node || this.E[i].b === node);
          if (cands.length) {
            const ni = cands[this.rng.int(0, cands.length - 1)];
            p.e = ni;
            p.dir = this.E[ni].a === node ? 1 : -1;
            p.u = this.E[ni].a === node ? 0 : 1;
          } else p.life = 0;
        }
      }
      this.packets = this.packets.filter((p) => p.life > 0);
    }
    // overload detonations
    if (t > this.RUPTURE - 1.2)
      for (let i = 0; i < this.E.length; i++) {
        const dt0 = this.RUPTURE - 1.2 + (i / this.E.length) * 1.2;
        if (t > dt0 && !this.E[i].blow) this.E[i].blow = t;
      }
  }

  casterLight(t: number) {
    return 0.2 + 0.4 * seg(t, 0, 3) + 1.5 * (1 - seg(t, this.RUPTURE, this.RUPTURE + 0.6));
  }

  render(fb: Framebuffer, t: number) {
    const rupture = seg(t, this.RUPTURE, this.RUPTURE + 1.4);

    for (let i = 0; i < this.E.length; i++) {
      const e = this.E[i];
      const A = this.N[e.a],
        B = this.N[e.b];
      const age = t - e.t0;
      if (age < 0) continue;
      const u = e.instant ? (age > 0 ? 1 : 0) : clamp(age * 2.6);
      if (u <= 0) continue;
      const ex = lerp(A.x, B.x, u),
        ey = lerp(A.y, B.y, u);
      // destruction state
      let k = 1;
      if (e.blow) {
        const ba = t - e.blow;
        k = ba < 0.1 ? 1 + 1.2 * (1 - ba / 0.1) : Math.max(0, 1 - (ba - 0.1) * 1.6);
      }
      if (k <= 0) continue;
      const fresh = e.instant ? Math.max(0, 1 - age * 5) : Math.max(0, 1 - (age - 0.4) * 3);
      // the stroke is current, not an outline
      const flow = 0.5 + 0.5 * Math.sin(u * 20 - t * 14 + i);
      streak(fb, A.x, A.y, ex, ey, 1.2 + fresh * 1.2, 1.2 + fresh * 1.2, VOLT(0.4 + flow * 0.18), (0.35 + fresh * 0.6) * 0.7 * k);
      line(fb, A.x, A.y, ex, ey, VOLT(0.85 + 0.15 * flow), (0.65 + fresh * 0.5) * k);
      // trembling micro-discharges along the mark
      if (Math.floor(t * 24 + i) % 3 === 0) {
        const r = new RNG(Math.floor(t * 24) + i * 13);
        const uu = r.next();
        const mx = lerp(A.x, ex, uu),
          my = lerp(A.y, ey, uu);
        const a = r.angle();
        bolt(fb, mx, my, mx + Math.cos(a) * 6, my + Math.sin(a) * 5, t, i * 7, 0.6, 0.5 * k, 0.6);
      }
      // the stroke being traced by branching filaments
      if (!e.instant && u < 1) {
        const r = new RNG(Math.floor(t * 30) + i);
        for (let s = 0; s < 3; s++) {
          const a = r.angle();
          const l = r.range(4, 12);
          bolt(fb, ex, ey, ex + Math.cos(a) * l, ey + Math.sin(a) * l, t, s * 11 + i, 0.6, 0.6, 0.7);
        }
      }
      if (e.instant && fresh > 0) {
        bolt(fb, A.x, A.y, B.x, B.y, t, e.seed, 2.0, fresh * 1.2, 0.12);
      }
      // detonation flash at the stroke
      if (e.blow && t - e.blow < 0.18) {
        const bk = 1 - (t - e.blow) / 0.18;
        glow(fb, (A.x + B.x) / 2, (A.y + B.y) / 2, 6 + bk * 8, VOLT(0.75), bk * 0.6);
        fb.flash[2] += 0.02 * bk;
      }
    }

    // misfires toward sections that do not exist yet
    if (t < this.CIRCUIT) {
      const fr = Math.floor(t * 9);
      const r = new RNG(fr * 31);
      if (r.next() < 0.6) {
        const done = this.E.filter((e) => t > e.t0);
        const todo = this.E.filter((e) => t <= e.t0);
        if (done.length && todo.length) {
          const a = this.N[done[r.int(0, done.length - 1)].a];
          const b = this.N[todo[r.int(0, todo.length - 1)].b];
          const k = 1 - ((t * 9) % 1);
          bolt(fb, a.x, a.y, b.x, b.y, t, fr, 0.8, k * 0.5, 0.5);
        }
      }
    }

    // circuit packets
    for (const p of this.packets) {
      const e = this.E[p.e];
      const A = this.N[e.a],
        B = this.N[e.b];
      const x = lerp(A.x, B.x, clamp(p.u)),
        y = lerp(A.y, B.y, clamp(p.u));
      glow(fb, x, y, 4.5, VOLT(0.8), 0.9);
      fb.add(x, y, CORE[0], CORE[1], CORE[2], 1);
      const tx = lerp(A.x, B.x, clamp(p.u - 0.08 * p.dir)),
        ty = lerp(A.y, B.y, clamp(p.u - 0.08 * p.dir));
      streak(fb, tx, ty, x, y, 1.2, 0.4, VOLT(0.7), 0.7);
    }

    for (const n of this.N) {
      const near = this.E.some((e) => (this.N[e.a] === n || this.N[e.b] === n) && t > e.t0);
      if (!near) continue;
      fb.add(n.x, n.y, CORE[0], CORE[1], CORE[2], 0.6);
    }

    if (rupture > 0) {
      const k = Math.sin(clamp(rupture * 1.3) * Math.PI);
      pulseRing(fb, C.x, C.y, rupture * 300, 14 * (1 - rupture), VOLT(0.6), (1 - rupture) * 0.7, 1.35);
      for (let i = 0; i < 16; i++) {
        const a = (i / 26) * TAU + rupture * 0.6;
        const L = easeOut(rupture, 2) * 230;
        bolt(fb, C.x, C.y, C.x + Math.cos(a) * L, C.y + (Math.sin(a) * L) / 1.35, t, i * 53, 1.2, k * 0.8, 0.2);
      }
    }
  }
}
