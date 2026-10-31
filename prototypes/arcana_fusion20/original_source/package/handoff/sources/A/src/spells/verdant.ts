// ---------------------------------------------------------------------------
// IV. VERDANT — life as a supernatural force
// ---------------------------------------------------------------------------

import { Framebuffer } from "../engine/framebuffer";
import { SpellInstance } from "../engine/types";
import { Pool } from "../engine/particles";
import { field, glow, streak, line, pulseRing, ribbon, RibbonPt } from "../engine/draw";
import {
  RNG,
  TAU,
  clamp,
  lerp,
  seg,
  smoothstep,
  easeOut,
  backOut,
  fbm,
  curl,
} from "../engine/math";
import { ARENA_C, CASTER } from "../engine/arena";
import { W } from "../engine/world";
import { rampStep, growBranches, updateBranches, drawBranch, Branch } from "./common";
import { sheet } from "./tide";

const C = ARENA_C;
const SQ = 1.45;
const GRN = (h: number) => rampStep("verdant", h, 8);
const BIO = (h: number) => rampStep("bio", h, 8);

// ===========================================================================
// 13 — ROOTWAKE
// ===========================================================================
export class Rootwake implements SpellInstance {
  rng = new RNG(0x7001);
  roots: Branch[] = [];
  risers: { b: Branch; lift: number; phase: number; seed: number }[] = [];
  flowers: { x: number; y: number; t0: number; r: number; seed: number }[] = [];
  petals = new Pool();
  SNAP = 5.4;

  constructor() {
    const r = this.rng;
    for (let i = 0; i < 6; i++) {
      const a = -0.9 + (i / 5) * 2.0 + r.range(-0.2, 0.2);
      this.roots.push(
        ...growBranches(r, CASTER.x + 10, CASTER.y + 2, a, 2.6, {
          steps: 15,
          step: 9,
          wander: 0.3,
          branchChance: 0.15,
          maxDepth: 2,
          widthFalloff: 0.62,
          speed: 0.55,
          bias: (x, y) => {
            // the network leans toward the arena centre, like it is hunting
            const want = Math.atan2(C.y - y, C.x - x);
            return Math.sin(want) * 0.2;
          },
        })
      );
    }
    // the thickest roots rise from the ground
    const majors = this.roots.filter((b) => b.depth === 0).slice(0, 6);
    for (const b of majors) this.risers.push({ b, lift: r.range(16, 34), phase: r.angle(), seed: r.int(0, 999) });
    for (let i = 0; i < 16; i++) {
      const b = this.roots[r.int(0, this.roots.length - 1)];
      const p = b.pts[Math.min(b.pts.length - 1, r.int(2, b.pts.length - 1))];
      this.flowers.push({ x: p.x, y: p.y, t0: 2.0 + r.range(0, 2.6), r: r.range(2.5, 5), seed: r.int(0, 999) });
    }
  }

  update(dt: number, t: number) {
    // growth has a biological rhythm: pauses and sudden accelerations
    const beat = t + 0.35 * Math.sin(t * 2.6) + 0.18 * Math.sin(t * 6.1);
    updateBranches(this.roots, beat);
    if (t > this.SNAP && t < this.SNAP + 0.5) {
      for (let i = 0; i < 12; i++) {
        const f = this.flowers[this.rng.int(0, this.flowers.length - 1)];
        const a = this.rng.angle();
        this.petals.spawn({
          x: f.x,
          y: f.y,
          vx: Math.cos(a) * this.rng.range(20, 90),
          vy: Math.sin(a) * this.rng.range(20, 70) - 30,
          life: this.rng.range(1.4, 3.2),
          a: this.rng.angle(),
          av: this.rng.range(-3, 3),
          size: this.rng.range(1.2, 2.6),
          seed: this.rng.next() * 999,
        });
      }
    }
    this.petals.each((p) => {
      p.vx += Math.sin(t * 2 + p.seed) * 14 * dt;
      p.vy += 16 * dt;
      p.vx *= Math.exp(-0.8 * dt);
      p.vy *= Math.exp(-0.8 * dt);
    });
    this.petals.step(dt);
  }

  casterLight(t: number) {
    return 0.25 + 0.4 * seg(t, 0, 3) + 1.0 * (1 - seg(t, this.SNAP, this.SNAP + 0.8));
  }

  render(fb: Framebuffer, t: number) {
    const snap = seg(t, this.SNAP, this.SNAP + 0.45);
    const wither = seg(t, this.SNAP + 0.7, 7.4);
    const tight = Math.sin(clamp(snap) * Math.PI) * 6;

    // --- ground fractures + the root network
    for (const b of this.roots) {
      const isRiser = this.risers.find((r) => r.b === b);
      const lift = isRiser ? isRiser.lift * smoothstep(2.2, 4.0, t) : 0;
      const bend = isRiser ? Math.sin(t * 1.4 + isRiser.phase) * 5 : 0;
      drawBranch(
        fb,
        b,
        (u, e) => {
          // dark bark silhouette with a luminescent vein running inside
          const vein = Math.exp(-Math.pow((e - 0.0) * 3.2, 2));
          const pulse = 0.5 + 0.5 * Math.sin(u * 14 - t * 5 + b.seed * 0.1);
          let h = 0.12 + vein * (0.25 + pulse * 0.42);
          h *= 1 - wither * 0.85;
          h *= 1 + snap * 0.5;
          const rim = e > 0.82 ? 0.1 : 0;
          const c = GRN(clamp(h + rim));
          return [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55];
        },
        (u, bb) => Math.max(0.6, bb.w * (1 - u * 0.7) * (1 + lift * 0.012) * (1 - wither * 0.4)),
        false
      );
      if (lift > 1) {
        // the risen tendril: shadow beneath, thorns along the body
        const n = b.pts.length;
        const lim = Math.floor(b.grow * (n - 1));
        for (let i = 1; i < lim; i++) {
          const p = b.pts[i];
          const li = lift * Math.sin((i / n) * Math.PI);
          fb.mul(p.x + 2, p.y + 3, 0.75);
          const yy = p.y - li + bend * Math.sin((i / n) * 3);
          const w = Math.max(1, b.w * (1 - i / n) * 1.3);
          for (let k = -w; k <= w; k++) {
            const e = Math.abs(k) / w;
            const h = (0.16 + (1 - e) * 0.4) * (1 - wither * 0.8);
            const c = GRN(h);
            fb.add(p.x, yy + k, c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, 1);
          }
          if (i % 4 === 0) {
            const ta = Math.sin(i * 1.7 + b.seed) > 0 ? -1 : 1;
            const tl = 3 + Math.sin(i + t * 3) * 1 + snap * 3;
            const c = GRN(0.55);
            streak(fb, p.x, yy, p.x + ta * 1.5, yy + ta * tl, 1.1, 0.3, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], 0.9);
          }
        }
      }
    }

    // --- flowers trigger further growth when they bloom
    for (const f of this.flowers) {
      const u = clamp((t - f.t0) * 1.6);
      if (u <= 0) continue;
      const open = backOut(u, 2.6) * (1 - wither * 0.9);
      const rr = f.r * open * (1 + snap * 0.6);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + f.seed * 0.01 + t * 0.2;
        const px = f.x + Math.cos(a) * rr,
          py = f.y + (Math.sin(a) * rr) / SQ;
        const c = rampStep("bloom", 0.55 + 0.3 * Math.sin(t * 3 + k), 7);
        streak(fb, f.x, f.y, px, py, 1.6, 0.8, [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5], 0.9 * open);
      }
      glow(fb, f.x, f.y, 4 * open, [1.3, 1.0, 1.4], 0.5 * open);
      // the bloom sends a pulse back through the roots
      const pulseAge = (t - f.t0) % 1.6;
      if (pulseAge < 0.5) {
        const pr = pulseAge * 90;
        pulseRing(fb, f.x, f.y, pr, 5, [0.3, 0.9, 0.4], (1 - pulseAge / 0.5) * 0.18, SQ);
      }
    }

    // --- the network answers as one entity
    if (snap > 0) {
      const k = Math.sin(clamp(snap) * Math.PI);
      pulseRing(fb, CASTER.x + 10, CASTER.y, snap * 260, 14 * (1 - snap), GRN(0.7), k * 0.8, SQ);
      fb.flash[1] += 0.14 * k * k;
      for (const b of this.roots) {
        if (b.depth > 1) continue;
        const p = b.pts[Math.floor(b.pts.length * 0.7)];
        if (!p) continue;
        const a = Math.atan2(p.y - CASTER.y, p.x - CASTER.x);
        const L = tight * 3;
        const c = GRN(0.8);
        streak(fb, p.x, p.y, p.x - Math.cos(a) * L, p.y - Math.sin(a) * L, 2 * k, 0.5, c, k);
      }
    }

    this.petals.each((p) => {
      const l = p.life / p.max;
      const a = p.a + p.av * (p.max - p.life);
      const c = rampStep("bloom", 0.4 + l * 0.4, 6);
      const w = p.size * Math.abs(Math.cos(a * 1.3));
      for (let k = -w; k <= w; k++)
        fb.add(p.x + Math.cos(a) * k, p.y + (Math.sin(a) * k) / 1.4, c[0] * 0.6, c[1] * 0.6, c[2] * 0.6, l * 0.9);
    });

    // residual organic markings
    if (wither > 0.4) {
      for (const b of this.roots) {
        if (b.depth > 0) continue;
        const k = (wither - 0.4) * 0.2;
        for (let i = 0; i < b.pts.length; i += 3) {
          const p = b.pts[i];
          fb.add(p.x, p.y, 0.18, 0.3, 0.22, k);
        }
      }
    }
  }
}

// ===========================================================================
// 14 — SPORE NEBULA
// ===========================================================================
interface Colony {
  x: number;
  y: number;
  r: number;
  born: number;
  ph: number;
  sp: number;
  hue: number;
  cells: { dx: number; dy: number; r: number; ph: number }[];
  act: number;
  links: number[];
}
export class SporeNebula implements SpellInstance {
  rng = new RNG(0x59e0);
  spores = new Pool();
  colonies: Colony[] = [];
  released = new Pool();
  BLOOM = 5.6;

  constructor() {
    this.colonies.push(this.mkColony(C.x, C.y, 0));
  }

  mkColony(x: number, y: number, born: number): Colony {
    const r = this.rng;
    const cells: Colony["cells"] = [];
    const n = r.int(4, 9);
    for (let i = 0; i < n; i++) {
      const a = r.angle(),
        d = r.range(0, 7);
      cells.push({ dx: Math.cos(a) * d, dy: (Math.sin(a) * d) / SQ, r: r.range(1, 2.8), ph: r.angle() });
    }
    return {
      x,
      y,
      r: r.range(5, 10),
      born,
      ph: r.angle(),
      sp: r.range(0.5, 1.6),
      hue: r.next(),
      cells,
      act: -1,
      links: [],
    };
  }

  update(dt: number, t: number) {
    // release spores from colonies
    if (t < this.BLOOM && this.spores.count() < 90 && this.rng.next() < 0.6) {
      const c = this.colonies[this.rng.int(0, this.colonies.length - 1)];
      const a = this.rng.angle();
      this.spores.spawn({
        x: c.x + Math.cos(a) * c.r,
        y: c.y + (Math.sin(a) * c.r) / SQ,
        vx: Math.cos(a) * 8,
        vy: Math.sin(a) * 6,
        life: 6,
        seed: this.rng.next() * 999,
        k: this.rng.next(),
      });
    }
    // drift on slow currents; meeting spores found colonies
    const alive = this.spores.alive;
    for (const p of alive) {
      const [cx, cy] = curl(p.x * 0.02, p.y * 0.02, t * 0.1, 0.7);
      p.vx += cx * 70 * dt;
      p.vy += cy * 55 * dt;
      p.vx *= Math.exp(-0.7 * dt);
      p.vy *= Math.exp(-0.7 * dt);
    }
    this.spores.step(dt);
    if (t < this.BLOOM && this.colonies.length < 16) {
      for (let i = 0; i < alive.length; i++)
        for (let j = i + 1; j < alive.length; j++) {
          const a = alive[i],
            b = alive[j];
          if (a.dead || b.dead) continue;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 4 && t > 0.8) {
            const x = (a.x + b.x) / 2,
              y = (a.y + b.y) / 2;
            if (this.colonies.some((c) => Math.hypot(c.x - x, c.y - y) < 22)) continue;
            if (x < 40 || x > 380 || y < 30 || y > 210) continue;
            const col = this.mkColony(x, y, t);
            // link to the two nearest existing colonies
            const idx = this.colonies
              .map((c, k) => ({ k, d: Math.hypot(c.x - x, c.y - y) }))
              .sort((p1, p2) => p1.d - p2.d)
              .slice(0, 2);
            col.links = idx.map((o) => o.k);
            this.colonies.push(col);
            a.dead = true;
            b.dead = true;
          }
        }
    }
    // waves of synchronised bioluminescence
    if (t > 3.2 && t < this.BLOOM) {
      const period = 1.5;
      const phase = (t - 3.2) % period;
      if (phase < dt) this.colonies[0].act = t;
      for (const c of this.colonies) {
        if (c.act < 0) continue;
        for (const li of c.links) {
          const o = this.colonies[li];
          if (!o) continue;
          const delay = Math.hypot(c.x - o.x, c.y - o.y) * 0.004;
          if (o.act < c.act && t > c.act + delay) o.act = c.act + delay;
        }
      }
    }
    if (t > this.BLOOM && t < this.BLOOM + 0.6 && this.released.count() < 620) {
      for (const c of this.colonies)
        for (let i = 0; i < 4; i++) {
          const a = this.rng.angle();
          const sp = this.rng.range(20, 130);
          this.released.spawn({
            x: c.x,
            y: c.y,
            vx: Math.cos(a) * sp,
            vy: (Math.sin(a) * sp) / SQ,
            life: this.rng.range(1.2, 2.8),
            a: a,
            k: c.hue,
            seed: this.rng.next() * 999,
          });
        }
    }
    this.released.each((p) => {
      // layered swirling clouds
      const a = Math.atan2(p.y - C.y, p.x - C.x) + 1.5;
      const d = Math.hypot(p.x - C.x, p.y - C.y) + 1;
      p.vx += Math.cos(a) * (900 / d) * dt;
      p.vy += (Math.sin(a) * (900 / d) * dt) / SQ;
      p.vx *= Math.exp(-0.9 * dt);
      p.vy *= Math.exp(-0.9 * dt);
    });
    this.released.step(dt);
  }

  casterLight(t: number) {
    return 0.15 + 0.3 * seg(t, 0, 4) + 0.9 * (1 - seg(t, this.BLOOM, this.BLOOM + 0.8));
  }

  render(fb: Framebuffer, t: number) {
    const dissolve = seg(t, this.BLOOM + 0.3, 7.4);
    const vis = 1 - dissolve * 0.92;

    // --- filaments between colonies
    for (let i = 0; i < this.colonies.length; i++) {
      const c = this.colonies[i];
      for (const li of c.links) {
        const o = this.colonies[li];
        if (!o) continue;
        const grow = clamp((t - c.born) * 1.1);
        const n = 14;
        for (let s = 0; s <= n * grow; s++) {
          const u = s / n;
          const mx = lerp(c.x, o.x, u) + Math.sin(u * Math.PI) * Math.sin(t * 0.8 + i) * 5;
          const my = lerp(c.y, o.y, u) + Math.cos(u * Math.PI + i) * Math.sin(t * 0.6 + i) * 4;
          // packets of information travelling the nervous system
          const pk = Math.max(0, Math.sin(u * 9 - t * 3 + i * 2));
          const h = 0.22 + pk * 0.4;
          const col = BIO(h);
          fb.add(mx, my, col[0] * 0.5 * vis, col[1] * 0.5 * vis, col[2] * 0.5 * vis, 1);
        }
      }
    }

    // --- colonies
    for (const c of this.colonies) {
      const g = clamp((t - c.born) * 0.9);
      if (g <= 0) continue;
      const breathe = 0.82 + 0.18 * Math.sin(t * c.sp * 1.7 + c.ph);
      const actK = c.act >= 0 ? Math.max(0, 1 - (t - c.act) * 1.6) : 0;
      for (const cell of c.cells) {
        const rr = cell.r * g * breathe * (1 + actK * 0.5) * (1 - dissolve);
        if (rr <= 0.3) continue;
        const px = c.x + cell.dx * g * breathe;
        const py = c.y + cell.dy * g * breathe;
        const lum = 0.35 + 0.3 * Math.sin(t * c.sp * 2.4 + cell.ph) + actK * 0.55;
        const col = c.hue < 0.33 ? BIO(lum) : c.hue < 0.72 ? GRN(lum) : rampStep("gold", lum, 7);
        field(fb, px - rr, py - rr, px + rr, py + rr, (x, y, o) => {
          const d = Math.hypot(x - px, (y - py) * 1.1) / rr;
          if (d > 1) return;
          const f = (1 - d * d) * 0.85;
          o[0] = col[0] * f * vis;
          o[1] = col[1] * f * vis;
          o[2] = col[2] * f * vis;
        });
      }
      glow(fb, c.x, c.y, c.r * 2.2 * g * (1 + actK), BIO(0.6), (0.14 + actK * 0.5) * vis);
    }

    // --- drifting spores
    this.spores.each((p) => {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + p.seed));
      const col = BIO(0.45 + p.k * 0.4);
      fb.add(p.x, p.y, col[0] * 0.7 * tw, col[1] * 0.7 * tw, col[2] * 0.7 * tw, vis);
      // faint connections when spores approach each other
      this.spores.each((q) => {
        if (q === p) return;
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < 16 && d > 0.5)
          line(fb, p.x, p.y, q.x, q.y, BIO(0.4), 0.1 * (1 - d / 16) * vis);
      });
    });

    if (t > this.BLOOM && t < this.BLOOM + 0.4) {
      const k = 1 - (t - this.BLOOM) / 0.4;
      fb.flash[1] += 0.1 * k * k;
      pulseRing(fb, C.x, C.y, (t - this.BLOOM) * 400, 16, BIO(0.6), k * 0.5, SQ);
    }

    this.released.each((p) => {
      const l = p.life / p.max;
      const col = p.k < 0.4 ? BIO(0.4 + l * 0.5) : p.k < 0.75 ? GRN(0.4 + l * 0.5) : rampStep("gold", 0.4 + l * 0.4, 7);
      const tw = 0.5 + 0.5 * Math.sin(t * 8 + p.seed);
      fb.add(p.x, p.y, col[0] * 0.65, col[1] * 0.65, col[2] * 0.65, l * (0.5 + tw * 0.5));
    });
  }
}

// ===========================================================================
// 15 — THORN OPERA
// ===========================================================================
interface Tendril {
  pts: { x: number; y: number; vx: number; vy: number }[];
  base: { x: number; y: number };
  seglen: number;
  moves: { t: number; x: number; y: number; sp: number }[];
  seed: number;
  style: number;
}
export class ThornOpera implements SpellInstance {
  rng = new RNG(0x7b01);
  tendrils: Tendril[] = [];
  petals = new Pool();
  CURL = 4.9;
  OPEN = 5.6;

  constructor() {
    const r = new RNG(0x7b01);
    this.rng = r;
    const N = 7;
    for (let i = 0; i < N; i++) {
      const a = -Math.PI * 0.9 + (i / (N - 1)) * Math.PI * 1.8;
      const base = { x: CASTER.x + 12 + Math.cos(a) * 6, y: CASTER.y - 2 + Math.sin(a) * 4 };
      const pts = [];
      const nseg = 22;
      for (let s = 0; s < nseg; s++) pts.push({ x: base.x, y: base.y, vx: 0, vy: 0 });
      const style = i % 3;
      const moves: Tendril["moves"] = [];
      let tt = 0.6 + i * 0.12;
      for (let m = 0; m < 7; m++) {
        const ang = r.angle();
        const d = r.range(60, 150);
        // every other beat the tendril hunts a body instead of empty air
        const prey = (m + i) % 2 === 0 && W.enemies.length ? W.enemies[(i * 3 + m) % W.enemies.length] : null;
        moves.push({
          t: tt,
          x: prey ? prey.hx + r.range(-6, 6) : C.x + Math.cos(ang) * d * 0.8,
          y: prey ? prey.hy - 6 + r.range(-4, 4) : C.y + Math.sin(ang) * d * 0.55,
          sp: style === 0 ? 1600 : style === 1 ? 700 : 1050,
        });
        tt += style === 0 ? r.range(0.4, 0.6) : r.range(0.55, 0.85);
      }
      this.tendrils.push({ pts, base, seglen: 5.2, moves, seed: r.int(0, 999), style });
    }
  }

  target(td: Tendril, t: number) {
    if (t > this.OPEN) {
      // violent opening: lash outward along intersecting arcs
      const u = seg(t, this.OPEN, this.OPEN + 0.9);
      const a = td.seed * 0.9 + u * 2.2 * (td.style === 1 ? -1 : 1);
      const d = 60 + easeOut(u, 2) * 150;
      return { x: C.x + Math.cos(a) * d, y: C.y + (Math.sin(a) * d) / SQ, sp: 2600 };
    }
    if (t > this.CURL) {
      // curl inward into a giant flower
      const u = seg(t, this.CURL, this.OPEN);
      const a = (this.tendrils.indexOf(td) / this.tendrils.length) * TAU + u * 3.4;
      const d = lerp(70, 16, easeOut(u, 2));
      return { x: C.x + Math.cos(a) * d, y: C.y + (Math.sin(a) * d) / SQ - 6, sp: 1100 };
    }
    let m = td.moves[0];
    for (const mv of td.moves) if (t >= mv.t) m = mv;
    const k = td.style === 2 ? Math.sin(t * 2.4 + td.seed) * 22 : 0;
    return { x: m.x + k, y: m.y + Math.cos(t * 2 + td.seed) * k * 0.5, sp: m.sp };
  }

  update(dt: number, t: number) {
    for (const td of this.tendrils) {
      const grow = clamp(t * 1.1);
      const tg = this.target(td, t);
      const head = td.pts[0];
      // the tip initiates the movement
      const dx = tg.x - head.x,
        dy = tg.y - head.y;
      const d = Math.hypot(dx, dy) || 1;
      let acc = tg.sp;
      if (td.style === 0) acc *= 0.6 + 0.8 * (Math.sin(t * 5 + td.seed) > 0.4 ? 2.4 : 0.2); // aggressive bursts
      head.vx += (dx / d) * acc * dt;
      head.vy += (dy / d) * acc * dt;
      head.vx *= Math.exp(-4.4 * dt);
      head.vy *= Math.exp(-4.4 * dt);
      head.x += head.vx * dt;
      head.y += head.vy * dt;
      // the body follows with delayed curvature, anchored at the base
      const L = td.seglen * grow;
      for (let i = 1; i < td.pts.length; i++) {
        const p = td.pts[i],
          q = td.pts[i - 1];
        const ddx = p.x - q.x,
          ddy = p.y - q.y;
        const dd = Math.hypot(ddx, ddy) || 1;
        const tx = q.x + (ddx / dd) * L,
          ty = q.y + (ddy / dd) * L;
        const follow = 1 - Math.exp(-26 * dt);
        p.x += (tx - p.x) * follow;
        p.y += (ty - p.y) * follow;
      }
      // tension at the base
      const last = td.pts[td.pts.length - 1];
      last.x += (td.base.x - last.x) * 0.25;
      last.y += (td.base.y - last.y) * 0.25;

      // shed leaves when the movement is forceful
      const spd = Math.hypot(head.vx, head.vy);
      if (spd > 220 && this.rng.next() < 0.5) {
        const a = Math.atan2(head.vy, head.vx) + this.rng.range(-2, 2);
        this.petals.spawn({
          x: head.x,
          y: head.y,
          vx: Math.cos(a) * this.rng.range(20, 70),
          vy: Math.sin(a) * this.rng.range(20, 60),
          life: this.rng.range(1, 2.6),
          a: this.rng.angle(),
          av: this.rng.range(-4, 4),
          size: this.rng.range(1.2, 2.4),
          seed: this.rng.next() * 999,
        });
      }
    }
    if (t > this.OPEN && t < this.OPEN + 0.5) {
      for (let i = 0; i < 16; i++) {
        const a = this.rng.angle();
        this.petals.spawn({
          x: C.x + Math.cos(a) * 14,
          y: C.y + (Math.sin(a) * 14) / SQ,
          vx: Math.cos(a) * this.rng.range(40, 170),
          vy: Math.sin(a) * this.rng.range(30, 120) - 20,
          life: this.rng.range(1.6, 3.4),
          a: this.rng.angle(),
          av: this.rng.range(-5, 5),
          size: this.rng.range(1.4, 3),
          seed: this.rng.next() * 999,
        });
      }
    }
    this.petals.each((p) => {
      p.vx += Math.sin(t * 1.6 + p.seed) * 18 * dt;
      p.vy += 26 * dt;
      p.vx *= Math.exp(-1.0 * dt);
      p.vy *= Math.exp(-1.0 * dt);
    });
    this.petals.step(dt);
  }

  casterLight(t: number) {
    return 0.3 + 0.5 * seg(t, 0, 2) + 0.9 * (1 - seg(t, this.OPEN, this.OPEN + 0.6));
  }

  render(fb: Framebuffer, t: number) {
    const open = seg(t, this.OPEN, this.OPEN + 0.35);
    const curl0 = seg(t, this.CURL, this.OPEN);

    // the giant flower forming
    if (curl0 > 0 && t < this.OPEN + 0.5) {
      const k = curl0 * (1 - seg(t, this.OPEN, this.OPEN + 0.4));
      glow(fb, C.x, C.y - 4, 10 + curl0 * 24, [0.8, 1.2, 0.5], 0.4 * k);
    }

    for (const td of this.tendrils) {
      const pts: RibbonPt[] = td.pts.map((p) => ({ x: p.x, y: p.y }));
      // shadow on the floor
      for (let i = 0; i < pts.length; i += 2) fb.mul(pts[i].x + 2, pts[i].y + 4, 0.8);
      ribbon(
        fb,
        pts,
        (u) => Math.max(0.7, (1 - u * 0.55) * 2.9 * clamp(t * 1.3)),
        (u, _i, e) => {
          const pulse = 0.5 + 0.5 * Math.sin(u * 12 - t * 6 + td.seed);
          let h = 0.1 + (1 - e) * (0.26 + pulse * 0.3);
          if (e > 0.8) h = 0.07;
          h *= 1 + open * 0.8;
          const c = GRN(clamp(h));
          return [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6];
        }
      );
      // thorns that bend with the body
      for (let i = 2; i < td.pts.length - 1; i += 2) {
        const p = td.pts[i],
          q = td.pts[i - 1];
        const a = Math.atan2(p.y - q.y, p.x - q.x);
        const side = i % 4 === 0 ? 1 : -1;
        const len = (2.6 + 2.2 * (1 - i / td.pts.length)) * (1 + open * 1.4);
        const na = a + side * 1.25;
        const c = GRN(0.52 + open * 0.3);
        streak(
          fb,
          p.x,
          p.y,
          p.x + Math.cos(na) * len,
          p.y + Math.sin(na) * len,
          1.0,
          0.25,
          [c[0] * 0.75, c[1] * 0.75, c[2] * 0.7],
          0.95
        );
      }
      // the tip
      const h0 = td.pts[0];
      glow(fb, h0.x, h0.y, 3.4, [0.6, 1.4, 0.6], 0.5);
    }

    if (open > 0) {
      const k = Math.sin(clamp(open) * Math.PI);
      pulseRing(fb, C.x, C.y, open * 230, 12 * (1 - open), GRN(0.7), k * 0.9, SQ);
      fb.flash[1] += 0.12 * k * k;
    }

    this.petals.each((p) => {
      const l = p.life / p.max;
      const a = p.a + p.av * (p.max - p.life);
      const c = rampStep("bloom", 0.35 + l * 0.45, 6);
      const w = p.size * Math.abs(Math.cos(a * 1.1)) + 0.5;
      for (let k = -w; k <= w; k++)
        fb.add(p.x + Math.cos(a) * k, p.y + (Math.sin(a) * k) / 1.4, c[0] * 0.55, c[1] * 0.55, c[2] * 0.55, l * 0.9);
    });
  }
}

// ===========================================================================
// 16 — WORLDSEED
// ===========================================================================
export class Worldseed implements SpellInstance {
  rng = new RNG(0x5eed);
  layers: {
    count: number;
    len: number;
    w: number;
    t0: number;
    sp: number;
    tilt: number;
    hue: number;
    tremble: number;
  }[] = [];
  pollen = new Pool();
  CRACK = 2.0;
  BLOOM = 5.3;
  FOLD = 6.8;

  constructor() {
    const r = this.rng;
    const specs = [
      { count: 5, len: 26, w: 0.55, t0: 2.1, sp: 1.1, hue: 0.35, tremble: 2 },
      { count: 8, len: 46, w: 0.42, t0: 2.5, sp: 0.75, hue: 0.55, tremble: 1.2 },
      { count: 12, len: 74, w: 0.3, t0: 3.0, sp: 0.5, hue: 0.72, tremble: 0.6 },
      { count: 16, len: 104, w: 0.22, t0: 3.6, sp: 0.36, hue: 0.9, tremble: 0.3 },
    ];
    for (const s of specs) this.layers.push({ ...s, tilt: r.angle() });
  }

  update(dt: number, t: number) {
    if (t < this.CRACK && this.pollen.count() < 40 && this.rng.next() < 0.4) {
      const a = this.rng.angle();
      this.pollen.spawn({
        x: C.x + Math.cos(a) * this.rng.range(8, 22),
        y: C.y + (Math.sin(a) * this.rng.range(6, 16)) / SQ,
        vx: this.rng.range(-5, 5),
        vy: this.rng.range(-8, 2),
        life: 3,
        k: 0,
        seed: this.rng.next() * 999,
      });
    }
    if (t > this.BLOOM && t < this.BLOOM + 0.7 && this.pollen.count() < 520) {
      for (let i = 0; i < 24; i++) {
        const a = this.rng.angle();
        const sp = this.rng.range(30, 230);
        this.pollen.spawn({
          x: C.x,
          y: C.y,
          vx: Math.cos(a) * sp,
          vy: (Math.sin(a) * sp) / SQ,
          life: this.rng.range(1.2, 3.0),
          k: this.rng.next(),
          a: this.rng.angle(),
          av: this.rng.range(-4, 4),
          size: this.rng.range(0.8, 2.4),
          seed: this.rng.next() * 999,
        });
      }
    }
    this.pollen.each((p) => {
      p.vx *= Math.exp(-1.1 * dt);
      p.vy *= Math.exp(-1.1 * dt);
      p.vy -= 8 * dt;
    });
    this.pollen.step(dt);
  }

  casterLight(t: number) {
    return 0.15 + 0.5 * seg(t, 2, 5) + 1.1 * (1 - seg(t, this.BLOOM, this.BLOOM + 0.9));
  }

  render(fb: Framebuffer, t: number) {
    const crack = seg(t, this.CRACK, this.CRACK + 0.5);
    const fold = seg(t, this.FOLD, 8.0);
    const bloomK = seg(t, this.BLOOM, this.BLOOM + 0.5);

    // --- the seed
    const seedR = lerp(7, 10, Math.sin(t * 1.4) * 0.5 + 0.5) * (1 - crack * 0.35) * (1 - fold);
    if (seedR > 0.5) {
      const rot = t * 0.7;
      field(fb, C.x - seedR * 1.4, C.y - seedR * 1.4, C.x + seedR * 1.4, C.y + seedR * 1.4, (x, y, o) => {
        const dx = x - C.x,
          dy = (y - C.y) * 1.2;
        const d = Math.hypot(dx, dy);
        if (d > seedR) return;
        const a = Math.atan2(dy, dx) + rot;
        const veins = Math.abs(Math.sin(a * 3 + d * 0.5));
        let h = 0.22 + (1 - d / seedR) * 0.2 + veins * 0.35 * (1 - d / seedR);
        if (d > seedR - 1.2) h = 0.62;
        const c = rampStep("gold", clamp(h), 7);
        o[0] = c[0] * 0.55;
        o[1] = c[1] * 0.55;
        o[2] = c[2] * 0.55;
      });
      glow(fb, C.x, C.y, seedR * 2.4, [1.0, 0.85, 0.4], 0.3 + crack * 0.6);
      if (crack > 0) {
        for (let i = -seedR; i <= seedR; i++) {
          const k = 1 - Math.abs(i) / seedR;
          fb.add(C.x + i * 0.3, C.y + i, 2.4 * k * crack, 2.2 * k * crack, 1.6 * k * crack, 1);
        }
      }
    }

    // --- the unfolding: each layer is a sheet of petals with its own speed
    for (let li = 0; li < this.layers.length; li++) {
      const L = this.layers[li];
      let u = easeOut(seg(t, L.t0, L.t0 + 1 / L.sp), 2);
      if (fold > 0) u *= 1 - easeOut(fold, 1.6);
      if (u <= 0.01) continue;
      const pulse = bloomK > 0 ? 1 + 0.18 * Math.sin(t * 7 - li * 1.2) * Math.max(0, 1 - (t - this.BLOOM) * 0.6) : 1;
      for (let i = 0; i < L.count; i++) {
        const a0 = L.tilt + (i / L.count) * TAU;
        const len = L.len * u * pulse;
        const tremble = Math.sin(t * (3 + L.tremble * 3) + i) * L.tremble * 0.02;
        sheet(
          fb,
          Math.max(6, Math.ceil(len * 1.0)),
          Math.max(4, Math.ceil(len * L.w * 0.9)),
          (uu, v) => {
            const a = a0 + tremble * uu + Math.sin(uu * 2.5) * 0.12;
            const rr = (5 + li * 5) * u + len * uu;
            const wid = len * L.w * Math.sin(Math.pow(uu, 0.6) * Math.PI);
            return [
              C.x + Math.cos(a) * rr - Math.sin(a) * v * wid,
              C.y + (Math.sin(a) * rr + Math.cos(a) * v * wid) / SQ - uu * uu * 10 * u,
            ];
          },
          (uu, v) => {
            const av = Math.abs(v);
            if (av > 1) return null;
            // cellular patterns propagating across the surfaces
            const cell = fbm(uu * 7 + i * 2, av * 5 - t * 1.1, 3);
            const vein = Math.exp(-Math.pow(av * 4, 2)) * 0.3;
            let h = 0.16 + cell * 0.26 + vein;
            h += Math.pow(av, 4) * 0.5;
            const wave = Math.max(0, Math.sin(uu * 8 - t * 5 + li * 1.5));
            h += wave * 0.2 * (bloomK > 0 ? 1.6 : 0.6);
            h *= 1 - uu * 0.2;
            h *= smoothstep(0.02, 0.26, uu);
            if (h < 0.05) return null;
            const c = L.hue < 0.5 ? rampStep("bloom", clamp(h), 8) : li === 3 ? GRN(clamp(h)) : rampStep("bio", clamp(h), 8);
            return [c[0] * 0.42, c[1] * 0.42, c[2] * 0.42];
          }
        );
      }
    }

    // --- the luminous core deep inside
    const coreU = seg(t, 4.0, this.BLOOM);
    if (coreU > 0 && fold < 1) {
      const rr = (3 + coreU * 9) * (1 + bloomK * 1.4) * (1 - fold);
      glow(fb, C.x, C.y - 4, rr * 1.9, [1.3, 1.2, 0.7], 0.3 + bloomK * 0.55);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + t * 0.8;
        const c = rampStep("gold", 0.8, 6);
        streak(fb, C.x, C.y - 4, C.x + Math.cos(a) * rr, C.y - 4 + (Math.sin(a) * rr) / SQ, 1.4, 0.4, c, 0.8);
      }
    }

    if (bloomK > 0 && bloomK < 1) {
      const k = Math.sin(bloomK * Math.PI);
      pulseRing(fb, C.x, C.y, bloomK * 120, 30 * (1 - bloomK) + 6, rampStep("bloom", 0.5, 6), k * 0.22, SQ, 0.14, 1.3);
      fb.flash[0] += 0.1 * k * k;
      fb.flash[1] += 0.09 * k * k;
    }

    this.pollen.each((p) => {
      const l = p.life / p.max;
      const tw = 0.55 + 0.45 * Math.sin(t * 7 + p.seed);
      const c = p.k < 0.5 ? rampStep("gold", 0.5 + l * 0.4, 6) : rampStep("bloom", 0.5 + l * 0.4, 6);
      fb.add(p.x, p.y, c[0] * 0.6 * tw, c[1] * 0.6 * tw, c[2] * 0.6 * tw, l);
      if (p.size > 1.8) {
        const a = p.a + p.av * (p.max - p.life);
        fb.add(p.x + Math.cos(a) * 1.4, p.y + Math.sin(a), c[0] * 0.4, c[1] * 0.4, c[2] * 0.4, l * 0.7);
      }
    });
  }
}
