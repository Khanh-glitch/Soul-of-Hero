// Deterministic math helpers. Every effect is a pure function of time,
// so all randomness flows through seeded hashes.

export const TAU = Math.PI * 2;
export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inv = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
export const smooth = (a: number, b: number, x: number) => {
  const t = inv(a, b, x);
  return t * t * (3 - 2 * t);
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t: number) => Math.pow(clamp(t), 3);
export const easeInOut = (t: number) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
export const easeInExpo = (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * clamp(t) - 10));
export const easeOutBack = (t: number) => {
  t = clamp(t);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** 0 → 1 → 0 window */
export const pulse = (a: number, b: number, x: number) => {
  if (x <= a || x >= b) return 0;
  return Math.sin(((x - a) / (b - a)) * Math.PI);
};

export function hash(n: number): number {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
export function hash2(a: number, b: number): number {
  return hash(a * 12.9898 + b * 78.233);
}

export class RNG {
  s: number;
  constructor(seed = 1) {
    this.s = (seed * 2654435761) >>> 0 || 1;
  }
  next(): number {
    // mulberry32
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  r(a = 0, b = 1) {
    return a + (b - a) * this.next();
  }
  i(a: number, b: number) {
    return Math.floor(this.r(a, b + 1));
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  gauss() {
    return (this.next() + this.next() + this.next() - 1.5) / 1.5;
  }
}

// value noise
export function noise2(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x: number, y: number, oct = 3): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += noise2(x * f, y * f) * a;
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}
export function noise1(x: number): number {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u);
}

export type V = { x: number; y: number };
export const v = (x: number, y: number): V => ({ x, y });
export const dist = (a: V, b: V) => Math.hypot(a.x - b.x, a.y - b.y);

/** Catmull-Rom sample along a point list, u in [0,1] */
export function catmull(pts: V[], u: number): V {
  const n = pts.length - 1;
  const f = clamp(u) * n;
  const i = Math.min(Math.floor(f), n - 1);
  const t = f - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const t2 = t * t, t3 = t2 * t;
  const k = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: k(p0.x, p1.x, p2.x, p3.x), y: k(p0.y, p1.y, p2.y, p3.y) };
}

/** Resample a spline into evenly spaced points with cumulative arclength. */
export function resample(pts: V[], step = 1.5): { p: V[]; len: number[]; total: number } {
  const dense: V[] = [];
  const N = pts.length * 40;
  for (let i = 0; i <= N; i++) dense.push(catmull(pts, i / N));
  const p: V[] = [dense[0]];
  const len: number[] = [0];
  let acc = 0, carry = 0;
  for (let i = 1; i < dense.length; i++) {
    const d = dist(dense[i], dense[i - 1]);
    carry += d;
    acc += d;
    if (carry >= step) {
      p.push(dense[i]);
      len.push(acc);
      carry = 0;
    }
  }
  return { p, len, total: acc };
}

/** Analytic ballistic flight with linear drag. */
export function fly(p0: number, v0: number, drag: number, acc: number, t: number): number {
  if (drag <= 0.0001) return p0 + v0 * t + 0.5 * acc * t * t;
  const e = Math.exp(-drag * t);
  return p0 + (v0 - acc / drag) * (1 - e) / drag + (acc / drag) * t;
}

export type Col = [number, number, number];
export function ramp(stops: Col[], t: number): Col {
  t = clamp(t) * (stops.length - 1);
  const i = Math.min(Math.floor(t), stops.length - 2);
  const f = t - i;
  const a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
export const scale = (c: Col, k: number): Col => [c[0] * k, c[1] * k, c[2] * k];
export const mixc = (a: Col, b: Col, t: number): Col => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Random jagged convex-ish polygon (unit radius), returns flat array of angles/radii */
export function shardShape(rng: RNG, n = 5, jag = 0.45): number[] {
  const out: number[] = [];
  const base = rng.r(0, TAU);
  for (let i = 0; i < n; i++) {
    const a = base + (i / n) * TAU + rng.r(-0.3, 0.3) * (TAU / n);
    out.push(a, 1 - rng.r(0, jag));
  }
  return out;
}
export function shardPts(shape: number[], cx: number, cy: number, rad: number, rot: number, sx = 1, sy = 1): number[] {
  const p: number[] = [];
  for (let i = 0; i < shape.length; i += 2) {
    const a = shape[i] + rot, r = shape[i + 1] * rad;
    p.push(cx + Math.cos(a) * r * sx, cy + Math.sin(a) * r * sy);
  }
  return p;
}
