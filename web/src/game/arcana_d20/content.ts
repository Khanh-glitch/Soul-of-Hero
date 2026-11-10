/** ARCANA #20 restored A+C content: per-tick source VFX command stream, ported
 *  from the fused P0 donor (e41ae670, arcana_c/fusion20/ripper.ts + debris.ts).
 *  Translated from the donor's CPU Frame API (f.D/f.Lc/f.line/...) into DCommand
 *  sprite/line/poly lists that the presenter's vendor raster (DRaster) draws
 *  additively into the light FBO. Timeline/choreography = source: glitches
 *  0.3-1.6s, opening 1.6-3s, tear+geometry+passage 3-6.4s, collision 6.6s
 *  (flash/shock/100 stars), blocks flung + irregular return 6.6-9.1s,
 *  debris 5.3-5.7s(aTime), residual anomalous pixels 9.3-9.9s. */
import { Rng, TAU, clamp, lerp, easeInOut } from '../arcana_d19/math';
import { RipperContour, F20_W, F20_H } from './contour';
import type { DCommand } from '../arcana_d19/commands';

type Col = [number, number, number, number];
const WHITE: Col = [1, 1, 1, 1], CYAN: Col = [.45, .95, 1, 1], MAG: Col = [1, .35, .85, 1], GOLDW: Col = [1, .9, .6, 1];
const astral = (t: number): Col => { const x = clamp(t) * 5, i = Math.min(4, Math.floor(x)), f = x - i; const P = [[.02, .01, .05], [.1, .03, .2], [.3, .08, .44], [.62, .22, .78], [.95, .62, .98], [1, .96, 1]]; const a = P[i], b = P[i + 1]; return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f), 1]; };
const h2 = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const h3 = (a: number, b: number, c: number) => { const s = Math.sin(a * 127.1 + b * 269.5 + c * 183.3) * 43758.5453; return s - Math.floor(s); };

const PERM = [10, 7, 11, 5, 0, 6, 3, 1, 8, 4, 2, 9];

// small RNG range helpers on top of math.Rng
class RngX extends Rng {
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(a: number, b: number) { return Math.floor(this.range(a, b + 1)); }
  angle() { return this.next() * TAU; }
}

type Block = { hx: number; hy: number; sz: number; vx: number; vy: number; ret: number; mode: number; mx: number };
type Particle = { x: number; y: number; px: number; py: number; vx: number; vy: number; life: number; max: number; size: number; seed: number; k: number };

export class RipperContent {
  private contour: RipperContour;
  private rng = new Rng(1512011289);
  private blocks: Block[] = [];
  private particles: Particle[] = [];
  private prng = new RngX(0x7ea4);
  private tick = 0;
  private collided = false;
  private lastT = 0;
  private impact: Particle[] = [];
  constructor() {
    this.contour = new RipperContour();
    // P0 fixes cast seed 151461 for contour; blocks use the post-sort rng state
    const rng = new Rng(151461);
    const way = this.contour.way;
    const at = (s: number) => this.contour.at(s);
    rng.s = 1512011289;
    this.blocks = Array.from({ length: 56 }, (_, i) => {
      const s = rng.r(0.08, 0.92), side = rng.sign(), d = rng.r(8, 38), p = at(s); const sz = rng.i(5, 9);
      return { hx: Math.round(p.x + p.nx * d * side - sz / 2), hy: Math.round(p.y + p.ny * d * side - sz / 2), sz, vx: p.nx * side * rng.r(60, 170) + rng.r(-40, 40), vy: p.ny * side * rng.r(60, 170) + rng.r(-40, 40), ret: rng.r(7.3, 9.1), mode: i % 4, mx: p.nx * d * side * 2 };
    });
    void way;
    for (let i = 0; i < 27; i++) { this.prng.range(-5, 5); this.prng.range(-7, 7); }
    for (let i = 0; i < 64; i++) { this.prng.range(0, 1); this.prng.range(-1, 1); this.prng.int(0, 9999); }
  }
  get c() { return this.contour; }

  /** Reset all cast-owned state (donor debris sim demands monotonic time and
   *  must be reset on backwards seek / new cast — same rule ported here). */
  reset() {
    this.tick = 0; this.collided = false; this.lastT = 0;
    this.particles = []; this.impact = [];
    this.rng.s = 1512011289;
  }

  private advanceDebris(sourceTime: number) {
    const target = Math.floor(sourceTime * 60 + 1e-6);
    while (this.tick < target) {
      this.tick++;
      const dt = 1 / 60, t = this.tick * dt;
      if (t > 5.3 && t < 5.7 && this.particles.length < 320) {
        for (let i = 0; i < 24; i++) {
          const u = this.prng.next(), anchor = this.contour.at(Math.floor(u * 26) / 26), angle = this.prng.angle(), speed = this.prng.range(60, 340), life = this.prng.range(.5, 1.8), size = this.prng.int(1, 4), seed = this.prng.int(0, 9999), k = this.prng.next();
          this.particles.push({ x: anchor.x, y: anchor.y, px: anchor.x, py: anchor.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed / 1.4, life, max: life, size, seed, k });
        }
      }
      const decay = Math.exp(-1.8 * dt);
      for (const p of this.particles) { p.px = p.x; p.py = p.y; p.vx *= decay; p.vy *= decay; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
      this.particles = this.particles.filter(p => p.life > 0);
    }
  }

  /** Build the source command stream for source time t (seconds). */
  commands(t: number): { cmds: DCommand[]; flash: number; shake: number } {
    if (t < this.lastT - 1e-6) this.reset(); // backwards seek / new cast
    const cmds: DCommand[] = [];
    const sprite = (x: number, y: number, size: number, shape: number, color: Col, rot = 0, glow = .3) => cmds.push({ kind: 'sprite', x, y, size, shape, color, opt: { rot, hard: 1, glow }, role: 'f20' });
    const line = (pts: number[], w: number, color: Col, glow = 1) => cmds.push({ kind: 'line', points: pts, width: w, color, opt: { hard: 1, glow }, role: 'f20' });
    const ring = (cx: number, cy: number, r: number, color: Col, w = 1, glow = 1) => { const pts: number[] = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU; pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } line(pts, w, color, glow); };
    const at = (s: number) => this.contour.at(s);
    const width = (s: number, tt = t) => this.contour.width(s, tt);
    const TOPEN = 3.0, TCOL = 6.6;
    let flash = 0, shake = 0;
    const slot = Math.floor(t * 20);

    // --- early renderer glitches (source beats 0.3-1.6s) ---
    if (t > 0.3 && t < 0.45) line([130, 92, 230, 92], 1, [.5, .45, .6, 1]);
    if (t > 0.3 && t < 0.45) line([130, 93, 230, 93], 1, [.5, .45, .6, 1]);
    if (t > 0.6 && t < 0.9) { const x = 180 + t * 20, y = 120 - t * 6; line([x, y, x + 5, y], 1, [.5, .45, .6, 1]); line([x + 5, y, x + 10, y], 1, [.5, .45, .6, 1]); }
    if (t > 0.95 && t < 1.2) for (let x = 232; x < 246; x++) sprite(x + (h2(slot, 0) - .5) * 6, 120 + (h2(slot, 1) - .5) * 3, 1, 10, [1, 1, 1, .8], 0, .5);
    if (t > 1.2 && t < 1.6) for (let k = 0; k < 24; k++) { const p = at(0.4 + h2(k * 7, 0) * 0.2); sprite(p.x, p.y, 1, 4, h2(k + slot * 3, 0) > 0.5 ? [.8, .8, .9, 1] : [.2, .2, .25, 1], 0, .8); }

    const span = clamp((t - 1.6) / (TOPEN - 1.6));
    // --- opening glint at contour center ---
    if (t >= 1.6 && t < TOPEN + 0.4) { const w0 = width(0.5); const p = at(0.5); sprite(p.x, p.y, Math.max(1, w0 * .5), 4, [1.6, 1.6, 1.8, 1], 0, 1.4); void w0; }

    if (t >= 1.6 && t < 9.4) {
      // --- interior sparkles + rim (C) ---
      const ts = Math.floor(t * 12);
      for (let i = 0; i < 40; i++) { const s = h2(i, slot); if (s < 0.4) continue; const p = at(s), d = h2(i, slot + 1) * 20 - 10, w = width(s); if (Math.abs(d) < w) sprite(p.x + p.nx * d, p.y + p.ny * d, 1, h2(i, slot + 2) > .5 ? 4 : 1, h2(i, slot + 3) > .985 ? [1, .96, 1, .7] : (h2(i, slot + 4) > .965 ? WHITE : CYAN), 0, .8); }
      // --- rotating impossible geometry (3 polyhedra) clipped to tear ---
      const polys = [
        { v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], e: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] },
        { v: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], e: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]] },
        { v: [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]], e: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] },
      ];
      const proj = (p: number[], ax: number, ay: number, sc: number) => { let [x, y, z] = p; let c = Math.cos(ay), si = Math.sin(ay); [x, z] = [x * c + z * si, -x * si + z * c]; c = Math.cos(ax); si = Math.sin(ax); [y, z] = [y * c - z * si, y * si + z * c]; return { x: x * sc, y: y * sc }; };
      const blocksOut = t >= TCOL;
      polys.forEach((pl, i) => {
        const s0 = ((0.2 + i * 0.27 + t * 0.035) % 0.8) + 0.1, p = at(s0);
        const ex = blocksOut ? clamp((t - TCOL) / 0.7) : 0;
        const sc = (6 + i * 1.5) * (1 + ex * 4);
        const cx = p.x + p.nx * (i - 1) * 6, cy = p.y + p.ny * (i - 1) * 6;
        const vs = pl.v.map(v => proj(v, t * (0.7 + i * 0.3), t * (1.1 - i * 0.2), sc));
        const col: Col = i === 1 ? MAG : CYAN;
        for (const [a, b] of pl.e) line([cx + vs[a].x, cy + vs[a].y, cx + vs[b].x, cy + vs[b].y], 1, [...col.slice(0, 3), ex ? 1.2 * (1 - ex) : 1] as Col, 1);
        // passage rings (what enters here leaves elsewhere)
        if (t > 3.8 && t < 6.4 && i === 0) {
          const sp = 0.15 + (t - 3.8) * 0.12, q = at(sp), q2 = at(1 - sp);
          ring(q.x, q.y, 3, GOLDW, 1, 1.2);
          const out = 8 + (t - 3.8) * 6;
          ring(q2.x + q2.nx * (width(1 - sp) + out), q2.y + q2.ny * (width(1 - sp) + out), 3, GOLDW, 1, 1.2);
        }
      });
    }

    // --- advance cast-owned sims monotonically from lastT to t (1/60 steps) ---
    if (t > this.lastT) {
      this.advanceDebris(this.contour.aTime(Math.min(t, 10.4)));
      let tt = this.lastT;
      while (tt < t - 1e-9) {
        tt = Math.min(t, tt + 1 / 60);
        const dt = 1 / 60;
        if (!this.collided && tt >= TCOL) {
          this.collided = true; flash = 0.35; shake = 10;
          const rng = this.rng;
          for (let i = 0; i < 100; i++) { const s = rng.r(0.05, 0.95), p = at(s), sd = rng.sign(); this.impact.push({ x: p.x, y: p.y, px: p.x, py: p.y, vx: p.nx * sd * rng.r(40, 200), vy: p.ny * sd * rng.r(40, 200), life: rng.r(0.6, 1.6), max: 0, size: rng.r(1, 3), seed: 0, k: rng.chance(0.3) ? 1 : 0 }); this.impact[this.impact.length - 1].max = this.impact[this.impact.length - 1].life; }
        }
        const drag = Math.exp(-1.4 * dt);
        for (const q of this.impact) { q.px = q.x; q.py = q.y; q.vx *= drag; q.vy *= drag; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
        this.impact = this.impact.filter(q => q.life > 0);
      }
      this.lastT = t;
    }
    // --- debris particles (A sim, aTime clock) ---
    if (t < 9.4) for (const p of this.particles) { const life = p.life / p.max; const gain = (2.2 + p.k * 3.4) * life; const c = astral(clamp(.55 + life * .4)); sprite(p.x, p.y, Math.max(1, p.size), p.k > .6 ? 4 : 1, [c[0] * .5 * life * .8 * gain / 2, c[1] * .5 * life * .8 * gain / 2, c[2] * .6 * life * .8 * gain / 2, clamp(gain, 0, 1)], 0, .8); }
    // --- 100 impact stars flying outward after the collision beat (source ps sim) ---
    for (const q of this.impact) { const life = clamp(q.life / (q.max || 1)); cmds.push({ kind: 'sprite', x: q.x, y: q.y, size: q.size * (0.6 + life * 0.8), shape: 4, color: q.k ? MAG : astral(0.9), opt: { hard: 1, glow: 1.2 }, role: 'impact' }); void life; }
    if (blocksOutNow(t)) {
      const a = t - TCOL;
      for (let k = 0; k < 5 && a < 0.7; k++) { const p = at(0.1 + k * 0.2); ring(p.x, p.y, a * 190 / 20, GOLDW, Math.max(1, 9 * (1 - a / 0.7)), 1); }
    }

    // --- 56 displaced world blocks, flung at collision, irregular return ---
    if (t >= TCOL) {
      const a = t - TCOL;
      for (const b of this.blocks) {
        const oa = Math.min(a, 1.3);
        const out = { x: b.hx + b.vx * oa * (1 - oa / 2.6), y: b.hy + b.vy * oa * (1 - oa / 2.6) };
        let p = out;
        if (t >= b.ret) {
          const q = clamp((t - b.ret) / 0.6);
          if (q >= 1) continue;
          if (b.mode === 0) p = { x: lerp(out.x, b.hx, easeInOut(q)), y: lerp(out.y, b.hy, easeInOut(q)) };
          else if (b.mode === 1) p = { x: lerp(b.hx - b.mx * 3, b.hx, q), y: b.hy };
          else if (b.mode === 2) { const ang = q * TAU * 2, r = 1 - q; p = { x: b.hx + ((out.x - b.hx) * Math.cos(ang) - (out.y - b.hy) * Math.sin(ang)) * r, y: b.hy + ((out.x - b.hx) * Math.sin(ang) + (out.y - b.hy) * Math.cos(ang)) * r }; }
          else continue;
        }
        // world-sampled shard position is handed to the blit pass (real world
        // pixels copied, source f.blitBase); here only the colored corner sparks
        void p;
        sprite(Math.round(p.x), Math.round(p.y), 1, 4, b.mode % 2 ? MAG : CYAN, 0, .8);
        sprite(Math.round(p.x) + b.sz - 1, Math.round(p.y) + b.sz - 1, 1, 4, b.mode % 2 ? CYAN : MAG, 0, .8);
      }
    }

    // --- final anomalous pixels 9.3-9.9s (stubborn wrong region) ---
    if (t > 9.3 && t < 9.85) { const p = at(0.62), bx = Math.round(p.x + p.nx * 7), by = Math.round(p.y + p.ny * 7); for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) if (h2(slot + x, y) > .2) sprite(bx + x, by + y, 1, 10, [1, 1, 1, .9], 0, .9); }
    if (t >= 9.85 && t < 9.9) { const p = at(0.62); sprite(p.x + p.nx * 7 + 3, p.y + p.ny * 7 + 2, 1, 4, [2, 2, 2, 1], 0, 1); }
    return { cmds, flash, shake };
  }

  /** World-sampled fragment blocks for the blit pass (source f.blitBase):
   *  dst = 56*4 (px,py,sz,active), home = 56*2 (hx,hy), region-local px. */
  blockData(t: number): { dst: Float32Array; home: Float32Array } {
    const TCOL = 6.6;
    const dst = new Float32Array(56 * 4), home = new Float32Array(56 * 2);
    if (t < TCOL) return { dst, home };
    const a = t - TCOL;
    this.blocks.forEach((b, i) => {
      home[i * 2] = b.hx; home[i * 2 + 1] = b.hy;
      const oa = Math.min(a, 1.3);
      const out = { x: b.hx + b.vx * oa * (1 - oa / 2.6), y: b.hy + b.vy * oa * (1 - oa / 2.6) };
      let p = out, active = 1;
      if (t >= b.ret) {
        const q = clamp((t - b.ret) / 0.6);
        if (q >= 1) active = 0;
        else if (b.mode === 0) p = { x: lerp(out.x, b.hx, easeInOut(q)), y: lerp(out.y, b.hy, easeInOut(q)) };
        else if (b.mode === 1) p = { x: lerp(b.hx - b.mx * 3, b.hx, q), y: b.hy };
        else if (b.mode === 2) { const ang = q * TAU * 2, r = 1 - q; p = { x: b.hx + ((out.x - b.hx) * Math.cos(ang) - (out.y - b.hy) * Math.sin(ang)) * r, y: b.hy + ((out.x - b.hx) * Math.sin(ang) + (out.y - b.hy) * Math.cos(ang)) * r }; }
        else active = 0;
      }
      dst[i * 4] = Math.round(p.x); dst[i * 4 + 1] = Math.round(p.y); dst[i * 4 + 2] = b.sz; dst[i * 4 + 3] = active;
    });
    return { dst, home };
  }
}

function blocksOutNow(t: number) { return t >= 6.6; }

