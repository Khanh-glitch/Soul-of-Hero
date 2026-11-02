// Core math: deterministic RNG, hashing, value noise, easing.

export type V2 = { x: number; y: number };
export const v2 = (x: number, y: number): V2 => ({ x, y });

export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inv = (a: number, b: number, v: number) => clamp((v - a) / (b - a));
export const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOut = (t: number, p = 3) => 1 - Math.pow(1 - clamp(t), p);
export const easeIn = (t: number, p = 3) => Math.pow(clamp(t), p);
export const easeInOut = (t: number) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const backOut = (t: number, s = 1.7) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
export const elastic = (t: number) => { t = clamp(t); return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1; };
/** window: 0 outside [a,b], rises/falls with soft edges */
export const win = (t: number, a: number, b: number, fade = 0.15) => {
  if (t < a || t > b) return 0;
  const f = Math.min(fade, (b - a) / 2);
  return smooth(Math.min((t - a) / f, (b - t) / f, 1));
};
export const angDiff = (a: number, b: number) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);

export class Rng {
  s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 1; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  r(a = 0, b = 1) { return a + (b - a) * this.next(); }
  i(a: number, b: number) { return Math.floor(this.r(a, b + 1)); }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  gauss() { return (this.next() + this.next() + this.next() - 1.5) / 1.5; }
  chance(p: number) { return this.next() < p; }
}

/** integer hash -> [0,1) */
export function hash(n: number): number {
  n = (n | 0) ^ 0x27d4eb2d;
  n = Math.imul(n ^ (n >>> 15), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export const hash2 = (x: number, y: number) => hash(Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263));
export const hash3 = (x: number, y: number, z: number) => hash(Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647));

export function noise2(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function noise3(x: number, y: number, z: number): number {
  const zi = Math.floor(z), zf = z - zi;
  const w = zf * zf * (3 - 2 * zf);
  const a = noise2(x + zi * 17.13, y + zi * 31.7);
  const b = noise2(x + (zi + 1) * 17.13, y + (zi + 1) * 31.7);
  return a + (b - a) * w;
}
export function fbm(x: number, y: number, z = 0, oct = 3): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
/** curl of a noise potential, used for organic drift fields */
export function curl(x: number, y: number, z: number): V2 {
  const e = 0.35;
  const n1 = noise3(x, y + e, z), n2 = noise3(x, y - e, z);
  const n3 = noise3(x + e, y, z), n4 = noise3(x - e, y, z);
  return { x: (n1 - n2) / (2 * e), y: -(n3 - n4) / (2 * e) };
}

/** step time for "animated on twos" stylization */
export const stepT = (t: number, fps = 12) => Math.floor(t * fps) / fps;

export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER4[(y & 3) * 4 + (x & 3)];

export function catmull(pts: V2[], samplesPer: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < samplesPer; s++) {
      const t = s / samplesPer, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}
