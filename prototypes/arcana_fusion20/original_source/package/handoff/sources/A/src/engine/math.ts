// ---------------------------------------------------------------------------
// ARCANA :: math + noise + color utilities
// ---------------------------------------------------------------------------

export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix = lerp;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6));
  return t * t * (3 - 2 * t);
};
export const smootherstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
/** normalized progress inside [a,b] of a timeline, clamped */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a || 1e-6));
/** un-clamped segment */
export const segu = (t: number, a: number, b: number) => (t - a) / (b - a || 1e-6);
/** 0 -> 1 -> 0 bump */
export const bump = (t: number) => {
  const x = clamp(t);
  return Math.sin(x * Math.PI);
};
export const easeOut = (t: number, p = 3) => 1 - Math.pow(1 - clamp(t), p);
export const easeIn = (t: number, p = 3) => Math.pow(clamp(t), p);
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const elasticOut = (t: number) => {
  const x = clamp(t);
  if (x === 0 || x === 1) return x;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};
export const backOut = (t: number, s = 1.7) => {
  const x = clamp(t) - 1;
  return x * x * ((s + 1) * x + s) + 1;
};

// --- deterministic RNG -----------------------------------------------------
export class RNG {
  private s: number;
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }
  next() {
    // xorshift32
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number) {
    return Math.floor(this.range(a, b + 1));
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length];
  }
  angle() {
    return this.next() * TAU;
  }
  gauss(sd = 1) {
    let u = 0,
      v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v) * sd;
  }
}

// --- hash noise ------------------------------------------------------------
export function hash2(x: number, y: number) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}
export function hash3(x: number, y: number, z: number) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export function vnoise(x: number, y: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi),
    b = hash2(xi + 1, yi),
    c = hash2(xi, yi + 1),
    d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function vnoise3(x: number, y: number, z: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const xf = x - xi,
    yf = y - yi,
    zf = z - zi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf),
    w = zf * zf * (3 - 2 * zf);
  const n = (i: number, j: number, k: number) => hash3(xi + i, yi + j, zi + k);
  const x00 = lerp(n(0, 0, 0), n(1, 0, 0), u);
  const x10 = lerp(n(0, 1, 0), n(1, 1, 0), u);
  const x01 = lerp(n(0, 0, 1), n(1, 0, 1), u);
  const x11 = lerp(n(0, 1, 1), n(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

export function fbm(x: number, y: number, oct = 4, lac = 2, gain = 0.5) {
  let a = 0.5,
    s = 0,
    n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x, y);
    n += a;
    x *= lac;
    y *= lac;
    a *= gain;
  }
  return s / n;
}
export function fbm3(x: number, y: number, z: number, oct = 3) {
  let a = 0.5,
    s = 0,
    n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise3(x, y, z);
    n += a;
    x *= 2;
    y *= 2;
    z *= 2;
    a *= 0.5;
  }
  return s / n;
}

// curl-ish flow field from value noise gradient
export function curl(x: number, y: number, t: number, e = 0.6): [number, number] {
  const n1 = vnoise3(x + e, y, t) - vnoise3(x - e, y, t);
  const n2 = vnoise3(x, y + e, t) - vnoise3(x, y - e, t);
  return [n2 / (2 * e), -n1 / (2 * e)];
}

// --- color -----------------------------------------------------------------
export type RGB = [number, number, number];

export function hsv(h: number, s: number, v: number): RGB {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const u = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      return [v, u, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, u];
    case 3:
      return [p, q, v];
    case 4:
      return [u, p, v];
    default:
      return [v, p, q];
  }
}

/** sample a color ramp defined by stops [[pos, r,g,b], ...] */
export function ramp(stops: number[][], t: number): RGB {
  t = clamp(t);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i],
      b = stops[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0] || 1e-6);
      return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];
    }
  }
  const l = stops[stops.length - 1];
  return [l[1], l[2], l[3]];
}

export const RAMPS = {
  // fire: black -> deep crimson -> orange -> gold -> white hot
  fire: [
    [0.0, 0.05, 0.01, 0.02],
    [0.18, 0.42, 0.04, 0.08],
    [0.38, 0.95, 0.17, 0.06],
    [0.6, 1.5, 0.6, 0.1],
    [0.82, 2.2, 1.5, 0.5],
    [1.0, 3.0, 2.8, 2.2],
  ],
  ash: [
    [0.0, 0.03, 0.02, 0.03],
    [0.5, 0.18, 0.12, 0.14],
    [1.0, 0.42, 0.3, 0.3],
  ],
  water: [
    [0.0, 0.01, 0.04, 0.1],
    [0.25, 0.03, 0.18, 0.42],
    [0.5, 0.08, 0.45, 0.8],
    [0.75, 0.4, 0.86, 1.1],
    [1.0, 1.6, 2.0, 2.2],
  ],
  frost: [
    [0.0, 0.03, 0.08, 0.16],
    [0.3, 0.12, 0.3, 0.55],
    [0.6, 0.45, 0.75, 1.0],
    [0.85, 0.9, 1.3, 1.6],
    [1.0, 2.2, 2.6, 3.0],
  ],
  volt: [
    [0.0, 0.03, 0.03, 0.12],
    [0.22, 0.18, 0.1, 0.55],
    [0.45, 0.35, 0.5, 1.4],
    [0.7, 0.8, 1.2, 2.2],
    [1.0, 2.6, 2.9, 3.2],
  ],
  verdant: [
    [0.0, 0.03, 0.06, 0.04],
    [0.22, 0.08, 0.22, 0.1],
    [0.45, 0.16, 0.5, 0.2],
    [0.68, 0.5, 1.0, 0.35],
    [0.86, 1.1, 1.7, 0.7],
    [1.0, 2.2, 2.6, 1.8],
  ],
  bio: [
    [0.0, 0.04, 0.08, 0.1],
    [0.3, 0.06, 0.4, 0.38],
    [0.55, 0.2, 0.9, 0.7],
    [0.8, 0.9, 1.6, 1.0],
    [1.0, 2.0, 2.4, 1.8],
  ],
  astral: [
    [0.0, 0.03, 0.02, 0.07],
    [0.25, 0.22, 0.08, 0.35],
    [0.5, 0.55, 0.25, 0.85],
    [0.72, 0.9, 0.7, 1.5],
    [0.9, 1.6, 1.5, 2.4],
    [1.0, 3.0, 2.9, 3.0],
  ],
  gold: [
    [0.0, 0.08, 0.04, 0.01],
    [0.4, 0.6, 0.28, 0.05],
    [0.7, 1.3, 0.9, 0.25],
    [1.0, 2.6, 2.3, 1.4],
  ],
  bloom: [
    [0.0, 0.1, 0.02, 0.08],
    [0.35, 0.5, 0.1, 0.3],
    [0.65, 1.1, 0.4, 0.6],
    [0.85, 1.8, 1.0, 1.1],
    [1.0, 2.6, 2.2, 2.2],
  ],
} as const;

export type RampName = keyof typeof RAMPS;
export const R = (name: RampName, t: number): RGB => ramp(RAMPS[name] as unknown as number[][], t);

// --- small vector helpers --------------------------------------------------
export interface V2 {
  x: number;
  y: number;
}
export const v2 = (x = 0, y = 0): V2 => ({ x, y });
export const dist = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);
export const angTo = (ax: number, ay: number, bx: number, by: number) =>
  Math.atan2(by - ay, bx - ax);
export const angLerp = (a: number, b: number, t: number) => {
  let d = ((b - a + Math.PI * 3) % TAU) - Math.PI;
  return a + d * t;
};

/** Catmull-Rom spline point sampling on a list of points */
export function catmull(pts: { x: number; y: number }[], u: number) {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return pts[0];
  const f = clamp(u) * (n - 1);
  const i = Math.min(Math.floor(f), n - 2);
  const t = f - i;
  const p0 = pts[Math.max(0, i - 1)],
    p1 = pts[i],
    p2 = pts[i + 1],
    p3 = pts[Math.min(n - 1, i + 2)];
  const t2 = t * t,
    t3 = t2 * t;
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}
