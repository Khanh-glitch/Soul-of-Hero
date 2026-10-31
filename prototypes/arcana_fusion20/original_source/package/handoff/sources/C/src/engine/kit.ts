// Shared procedural machinery: height-aware particles, lightning, timed branch growth, shards, shockwaves.
import { Frame } from './frame';
import { hash, clamp, lerp, noise3, TAU, type V2, Rng, bayer } from './math';
import { P, ramp, type RGB, type Ramp } from './palette';

// ---------------------------------------------------------------- particles
export type Kind = 'ember' | 'spark' | 'drop' | 'shard' | 'petal' | 'spore' | 'ash' | 'smoke' | 'star' | 'dust' | 'pix' | 'foam' | 'seed';
export interface Pt {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  life: number; max: number; drag: number; grav: number; kind: Kind;
  col: Ramp; k: number; size: number; seed: number; rot: number; spin: number;
  px: number; py: number; pz: number; delay: number; ax: number; ay: number; c?: RGB;
  onLand?: (p: Pt) => void; bounce?: number; home?: V2; homeK?: number;
}
export class Particles {
  list: Pt[] = [];
  add(o: Partial<Pt> & { x: number; y: number }): Pt {
    const p: Pt = {
      z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, drag: 0, grav: 0, kind: 'ember', col: P.ember, k: 1, size: 1,
      seed: Math.floor(Math.random() * 1e6), rot: 0, spin: 0, px: o.x, py: o.y, pz: o.z ?? 0, delay: 0, ax: 0, ay: 0, ...o,
    } as Pt;
    p.px = p.x; p.py = p.y; p.pz = p.z;
    this.list.push(p);
    return p;
  }
  update(dt: number) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.life += dt;
      if (p.life >= p.max) { L[i] = L[L.length - 1]; L.pop(); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx = (p.vx + p.ax * dt) * d; p.vy = (p.vy + p.ay * dt) * d;
      if (p.home) { const k = p.homeK ?? 4; p.vx += (p.home.x - p.x) * k * dt; p.vy += (p.home.y - p.y) * k * dt; }
      p.vz -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.spin * dt;
      if (p.z < 0 && p.grav > 0) {
        p.z = 0;
        if (p.onLand) p.onLand(p);
        if (p.bounce) { p.vz = -p.vz * p.bounce; p.vx *= 0.6; p.vy *= 0.6; if (Math.abs(p.vz) < 8) { p.vz = 0; p.grav = 0; } }
        else if (p.kind === 'drop') { p.life = p.max; }
        else { p.vz = 0; p.grav = 0; p.vx *= 0.3; p.vy *= 0.3; }
      }
    }
  }
  render(f: Frame) {
    for (const p of this.list) if (p.delay <= 0) drawPt(f, p);
  }
}

export function drawPt(f: Frame, p: Pt) {
  const u = p.life / p.max, sx = p.x, sy = p.y - p.z;
  if (p.z > 1.5) f.S(sx, p.y, 0.6);
  switch (p.kind) {
    case 'ember': {
      const c = ramp(p.col, 1 - u * 0.9);
      const sp = Math.hypot(p.vx, p.vy - p.vz);
      if (sp > 50) f.lineL(sx, sy, p.px, p.py - p.pz, c, p.k * 0.8);
      f.Lc(sx, sy, c, p.k * 1.3);
      if (p.size > 1) { f.Lc(sx + 1, sy, c, p.k * 0.6); f.Lc(sx, sy + 1, c, p.k * 0.6); }
      break;
    }
    case 'spark': {
      const c = ramp(p.col, 1 - u);
      f.lineL(sx, sy, p.px - (p.x - p.px), p.py - p.pz - (p.y - p.z - (p.py - p.pz)), c, p.k);
      f.Lc(sx, sy, [1, 1, 1], p.k * (1 - u));
      break;
    }
    case 'drop': {
      const c = p.c ?? [0.55, 0.85, 0.95];
      f.I(sx, sy, c[0] * 0.5, c[1] * 0.6, c[2] * 0.8, 0.85);
      if (p.size > 1) { f.I(sx, sy - 1, c[0], c[1], c[2], 0.9); f.L(sx, sy - 1, 0.25, 0.4, 0.45); }
      else f.L(sx, sy, c[0] * 0.4, c[1] * 0.5, c[2] * 0.6);
      if (Math.abs(p.vz) > 60) f.I(sx, sy + Math.sign(p.vz), c[0] * 0.3, c[1] * 0.5, c[2] * 0.7, 0.6);
      break;
    }
    case 'foam': {
      const a = 1 - u;
      if (a > bayer(sx | 0, sy | 0) * 0.9) { f.I(sx, sy, 0.85, 0.97, 1, 1); f.L(sx, sy, 0.1, 0.18, 0.2); }
      break;
    }
    case 'shard': {
      const s = p.size * (u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1);
      const pts: V2[] = [0, 1, 2].map((i) => ({ x: sx + Math.cos(p.rot + i * 2.2 + (i === 1 ? 0.5 : 0)) * s, y: sy + Math.sin(p.rot + i * 2.2) * s * 0.8 }));
      const c = p.c ?? ramp(p.col, 0.5 + 0.5 * Math.sin(p.rot * 2));
      f.polyI(pts, c, 1);
      const gl = Math.max(0, Math.sin(p.rot * 3 + p.seed));
      f.Lc(pts[0].x, pts[0].y, ramp(p.col, 1), p.k * (0.4 + gl));
      break;
    }
    case 'petal': {
      const c = ramp(p.col, 0.45 + 0.4 * Math.abs(Math.sin(p.rot)));
      const a = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1;
      f.Ic(sx, sy, c, a);
      const fl = Math.cos(p.rot);
      if (fl > 0.2) f.Ic(sx + 1, sy, c, a); else if (fl < -0.2) f.Ic(sx, sy + 1, ramp(p.col, 0.3), a);
      if (p.k > 0) f.Lc(sx, sy, c, 0.15 * p.k);
      break;
    }
    case 'spore': case 'seed': {
      const tw = 0.6 + 0.4 * Math.sin(p.life * 7 + p.seed);
      const fade = u < 0.1 ? u / 0.1 : u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
      const c = p.c ?? ramp(p.col, 0.8);
      f.Lc(sx, sy, c, p.k * tw * fade);
      if (p.kind === 'seed') { f.Lc(sx + 1, sy, c, p.k * 0.4 * fade); f.Lc(sx, sy + 1, c, p.k * 0.4 * fade); f.Lc(p.px, p.py - p.pz, c, p.k * 0.3 * fade); }
      break;
    }
    case 'ash': {
      const c = ramp(P.ash, 0.3 + 0.5 * hash(p.seed));
      const a = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      f.Id(sx, sy, c, a);
      if (u < 0.25) f.Lc(sx, sy, ramp(P.ember, 0.6), (0.25 - u) * 3);
      break;
    }
    case 'smoke': {
      const r = p.size * (0.5 + u);
      const a = (1 - u) * p.k;
      const c = p.c ?? [0.06, 0.05, 0.06];
      f.disc(sx, sy, r, (x, y, d) => { if (a * (1 - d * 0.6) > bayer(x, y)) f.I(x, y, c[0], c[1], c[2], 0.85); });
      break;
    }
    case 'star': {
      const tw = (0.5 + 0.5 * Math.sin(p.life * 9 + p.seed)) * (1 - u);
      const c = p.c ?? ramp(p.col, 0.9);
      f.Lc(sx, sy, c, p.k * (0.6 + tw));
      if (tw > 0.6) { f.Lc(sx + 1, sy, c, p.k * 0.5); f.Lc(sx - 1, sy, c, p.k * 0.5); f.Lc(sx, sy + 1, c, p.k * 0.5); f.Lc(sx, sy - 1, c, p.k * 0.5); }
      break;
    }
    case 'dust': {
      const c = p.c ?? [0.12, 0.1, 0.1];
      f.Ic(sx, sy, c, 1);
      if (p.size > 1) f.Ic(sx + 1, sy, c, 1);
      if (p.k > 0) f.Lc(sx, sy, ramp(p.col, 1 - u), p.k * (1 - u));
      break;
    }
    case 'pix': {
      const c = p.c ?? [1, 1, 1];
      f.Lc(sx, sy, c, p.k * (1 - u));
      break;
    }
  }
}

// ---------------------------------------------------------------- lightning
/** midpoint-displaced path, deterministic for (seed) */
export function boltPts(seed: number, ax: number, ay: number, bx: number, by: number, rough = 0.28, minLen = 3): V2[] {
  const out: V2[] = [{ x: ax, y: ay }];
  let k = 0;
  const rec = (x0: number, y0: number, x1: number, y1: number, depth: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < minLen || depth > 10) { out.push({ x: x1, y: y1 }); return; }
    const off = (hash(seed * 131 + k++ * 7) - 0.5) * len * rough * 2;
    const mx = (x0 + x1) / 2 + (-(y1 - y0) / len) * off, my = (y0 + y1) / 2 + ((x1 - x0) / len) * off;
    rec(x0, y0, mx, my, depth + 1); rec(mx, my, x1, y1, depth + 1);
  };
  rec(ax, ay, bx, by, 0);
  return out;
}
export interface Branch { pts: V2[]; w: number; depth: number }
export function boltTree(seed: number, ax: number, ay: number, bx: number, by: number, branches = 4, rough = 0.28, depth = 0): Branch[] {
  const main = boltPts(seed, ax, ay, bx, by, rough);
  const res: Branch[] = [{ pts: main, w: 1 / (1 + depth * 1.4), depth }];
  if (depth > 1) return res;
  const len = Math.hypot(bx - ax, by - ay);
  for (let i = 0; i < branches; i++) {
    const h = hash(seed * 17 + i * 101 + depth * 7);
    const idx = Math.floor((0.15 + h * 0.7) * (main.length - 1));
    const p = main[idx], q = main[Math.min(main.length - 1, idx + 1)];
    const ang = Math.atan2(q.y - p.y, q.x - p.x) + (hash(seed + i * 3) - 0.5) * 2.0;
    const bl = len * (0.15 + 0.3 * hash(seed * 3 + i)) / (1 + depth);
    res.push(...boltTree(seed * 7 + i * 13 + 1, p.x, p.y, p.x + Math.cos(ang) * bl, p.y + Math.sin(ang) * bl, Math.max(0, branches - 2), rough * 1.1, depth + 1));
  }
  return res;
}
/** draw a bolt polyline with core + halo; reveal 0..1 draws partial */
export function drawBolt(f: Frame, pts: V2[], k: number, core: RGB = [1, 1, 1], halo: RGB = [0.35, 0.5, 1], width = 1.4, reveal = 1) {
  if (k <= 0.01) return;
  const n = Math.max(2, Math.ceil(pts.length * clamp(reveal)));
  const sub = pts.slice(0, n);
  f.ribbon(sub, width, (x, y, _s, e) => {
    const a = Math.abs(e);
    if (a < 0.45) f.L(x, y, core[0] * k * 1.3, core[1] * k * 1.3, core[2] * k * 1.3);
    else f.L(x, y, halo[0] * k * (1.2 - a), halo[1] * k * (1.2 - a), halo[2] * k * (1.2 - a));
  });
}
export function drawBoltTree(f: Frame, tree: Branch[], k: number, core?: RGB, halo?: RGB, reveal = 1) {
  for (const b of tree) drawBolt(f, b.pts, k * b.w, core, halo, b.depth ? 1 : 1.6, b.depth ? clamp(reveal * 1.5 - 0.3) : reveal);
}

// ---------------------------------------------------------------- timed branching growth
export interface Seg { x0: number; y0: number; x1: number; y1: number; t0: number; t1: number; depth: number; w: number }
export interface TreeOpts { x: number; y: number; ang: number; step: number; steps: number; speed: number; branch: number; spread: number; jitter: number; maxDepth: number; t0?: number; decay?: number; sy?: number; snap?: number }
export function growTree(rng: Rng, o: TreeOpts): Seg[] {
  const segs: Seg[] = [];
  const sy = o.sy ?? 1;
  const go = (x: number, y: number, ang: number, steps: number, t: number, depth: number, w: number) => {
    for (let i = 0; i < steps; i++) {
      ang += rng.gauss() * o.jitter;
      let a = ang;
      if (o.snap) a = Math.round(a / o.snap) * o.snap;
      const st = o.step * (0.6 + rng.next() * 0.8);
      const nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st * sy;
      const t1 = t + st / o.speed;
      segs.push({ x0: x, y0: y, x1: nx, y1: ny, t0: t, t1, depth, w });
      if (depth < o.maxDepth && rng.chance(o.branch)) go(nx, ny, ang + rng.sign() * o.spread * (0.6 + rng.next() * 0.6), Math.floor((steps - i) * 0.6), t1, depth + 1, w * 0.6);
      x = nx; y = ny; t = t1; w *= o.decay ?? 0.97;
    }
  };
  go(o.x, o.y, o.ang, o.steps, o.t0 ?? 0, 0, 1);
  return segs;
}
export function drawTree(f: Frame, segs: Seg[], t: number, fn: (x: number, y: number, s: Seg, age: number) => void) {
  for (const s of segs) {
    if (t < s.t0) continue;
    const u = clamp((t - s.t0) / (s.t1 - s.t0));
    f.line(s.x0, s.y0, lerp(s.x0, s.x1, u), lerp(s.y0, s.y1, u), (x, y) => fn(x, y, s, t - s.t0));
  }
}

// ---------------------------------------------------------------- displacement helpers
/** expanding ring of radial displacement (pressure / gravity wave) */
export function shock(f: Frame, cx: number, cy: number, r: number, width: number, amp: number, sy = 1, chroma = 0) {
  if (amp === 0 || r <= 0) return;
  const R = r + width;
  f.field(cx - R, cy - R * sy, cx + R, cy + R * sy, (x, y) => {
    const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) / sy;
    const d = Math.hypot(dx, dy);
    const b = (d - r) / width;
    if (b < -1 || b > 1) return;
    const w = Math.cos(b * Math.PI / 2);
    const s = -amp * w * Math.sin(b * Math.PI) / (d || 1);
    f.D(x, y, dx * s, dy * s * sy);
    if (chroma) f.C(x, y, chroma * w);
  });
}
export function haze(f: Frame, cx: number, cy: number, r: number, t: number, amp: number, sy = 1) {
  if (amp <= 0.05) return;
  f.disc(cx, cy, r, (x, y, d) => {
    const k = amp * (1 - d);
    f.D(x, y, (noise3(x * 0.15, y * 0.3 + t * 3, t) - 0.5) * k * 2, (noise3(x * 0.2 + 9, y * 0.15 - t * 4, t) - 0.5) * k * 2);
  }, sy);
}

// ---------------------------------------------------------------- misc geometry
export function randPoly(rng: Rng, n: number, r: number, irr = 0.4): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rng.r(-0.2, 0.2); const rr = r * (1 - irr / 2 + rng.next() * irr); pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr }); }
  return pts;
}
export function xform(pts: V2[], x: number, y: number, rot: number, s = 1, sy = 1): V2[] {
  const c = Math.cos(rot), si = Math.sin(rot);
  return pts.map((p) => ({ x: x + (p.x * c - p.y * si) * s, y: y + (p.x * si + p.y * c) * s * sy }));
}
export function pip(pts: V2[], x: number, y: number) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
export function segIntersect(a: V2, b: V2, c: V2, d: V2): V2 | null {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return { x: a.x + r.x * t, y: a.y + r.y * t };
  return null;
}
/** follow-the-leader chain from a recorded head history */
export class Spine {
  hist: V2[] = [];
  push(p: V2) { this.hist.unshift({ x: p.x, y: p.y }); if (this.hist.length > 1200) this.hist.pop(); }
  /** sample points spaced by arc length along history */
  sample(n: number, spacing: number): V2[] {
    const out: V2[] = [];
    if (!this.hist.length) return out;
    out.push(this.hist[0]);
    let acc = 0, j = 0;
    for (let i = 1; i < n; i++) {
      const want = i * spacing;
      while (j < this.hist.length - 1) {
        const a = this.hist[j], b = this.hist[j + 1];
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        if (acc + l >= want) { const u = l ? (want - acc) / l : 0; out.push({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) }); break; }
        acc += l; j++;
      }
      if (j >= this.hist.length - 1) out.push(this.hist[this.hist.length - 1]);
    }
    return out;
  }
}
