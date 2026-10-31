import { Renderer, ADD } from './renderer';
import { Col, RNG, TAU, clamp, hash } from './math';

export type School = 'PYRE' | 'TIDE' | 'TEMPEST' | 'VERDANT' | 'ASTRAL';

export interface Effect<S = any> {
  id: number;
  name: string;
  school: School;
  duration: number;
  climax: number; // time of the climactic frame (for capture + showcase)
  blurb: string;
  setup(r: Renderer): S;
  /** draw the effect at local time t (pure function of t) */
  render(r: Renderer, t: number, s: S): void;
  /** optional post-lighting pass: warps, screen-space tricks */
  post?(r: Renderer, t: number, s: S): void;
}

// ------------------------------------------------------------- lightning
export type Seg = { x0: number; y0: number; x1: number; y1: number; w: number; d: number };

/**
 * Stepped-leader lightning: midpoint displacement for the main channel,
 * with recursive side leaders that branch off at sharp angles.
 * `d` on each segment = normalised distance along the channel from origin
 * (used to animate leaders growing or return strokes travelling).
 */
export function bolt(rng: RNG, x0: number, y0: number, x1: number, y1: number, rough = 0.32, branch = 0.35, depth = 0, d0 = 0, d1 = 1, out: Seg[] = []): Seg[] {
  const pts: number[] = [x0, y0, x1, y1];
  const len = Math.hypot(x1 - x0, y1 - y0);
  let off = len * rough;
  // midpoint displacement
  let cur = pts;
  while (off > 1.2 && cur.length < 400) {
    const nx: number[] = [];
    for (let k = 0; k + 2 < cur.length; k += 2) {
      const ax = cur[k], ay = cur[k + 1], bx = cur[k + 2], by = cur[k + 3];
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
      const o = rng.gauss() * off;
      nx.push(ax, ay, mx + (-dy / L) * o, my + (dx / L) * o);
    }
    nx.push(cur[cur.length - 2], cur[cur.length - 1]);
    cur = nx;
    off *= 0.52;
  }
  const n = cur.length / 2 - 1;
  for (let k = 0; k < n; k++) {
    const d = d0 + ((d1 - d0) * k) / n;
    out.push({ x0: cur[k * 2], y0: cur[k * 2 + 1], x1: cur[k * 2 + 2], y1: cur[k * 2 + 3], w: depth, d });
    if (depth < 2 && rng.next() < branch * (depth === 0 ? 0.22 : 0.12)) {
      const ang = Math.atan2(y1 - y0, x1 - x0) + rng.sign() * rng.r(0.4, 1.2);
      const bl = len * rng.r(0.12, 0.35) / (depth + 1);
      const bx = cur[k * 2] + Math.cos(ang) * bl, by = cur[k * 2 + 1] + Math.sin(ang) * bl;
      bolt(rng, cur[k * 2], cur[k * 2 + 1], bx, by, rough * 1.1, branch, depth + 1, d, d + (bl / Math.max(1, len)) * (d1 - d0), out);
    }
  }
  return out;
}

export const ARC_CORE: Col = [2.6, 2.8, 3.4];
export const ARC_MID: Col = [0.7, 1.1, 3.0];
export const ARC_GLOW: Col = [0.35, 0.12, 0.9];

/** draw a bolt; `upto` reveals by normalised distance, k = intensity */
export function drawBolt(r: Renderer, segs: Seg[], k = 1, upto = 1, glow = true, core: Col = ARC_CORE, mid: Col = ARC_MID, gl: Col = ARC_GLOW) {
  for (const s of segs) {
    if (s.d > upto) continue;
    const kk = k * (s.w === 0 ? 1 : s.w === 1 ? 0.6 : 0.35);
    if (glow && s.w === 0 && k > 0.3) r.thick(s.x0, s.y0, s.x1, s.y1, 3, gl, kk * 0.5);
    if (s.w === 0 && k > 0.6) r.thick(s.x0, s.y0, s.x1, s.y1, 2, mid, kk * 0.6);
    r.line(s.x0, s.y0, s.x1, s.y1, s.w === 0 ? core : mid, kk);
  }
}

// ------------------------------------------------------------- crack / branching trees
export type Crack = { x0: number; y0: number; x1: number; y1: number; d: number; gen: number };
/** Branching fracture network from a point. d = normalised growth order */
export function crackTree(rng: RNG, x: number, y: number, arms: number, len: number, spread = 0.5, step = 3, out: Crack[] = []): Crack[] {
  const stack: { x: number; y: number; a: number; l: number; d: number; g: number }[] = [];
  const a0 = rng.r(0, TAU);
  for (let k = 0; k < arms; k++) stack.push({ x, y, a: a0 + (k / arms) * TAU + rng.r(-0.4, 0.4), l: len * rng.r(0.6, 1.1), d: 0, g: 0 });
  while (stack.length) {
    const b = stack.pop()!;
    let cx = b.x, cy = b.y, a = b.a, d = b.d;
    const n = Math.max(1, Math.floor(b.l / step));
    for (let s = 0; s < n; s++) {
      a += rng.r(-spread, spread);
      const nx = cx + Math.cos(a) * step, ny = cy + Math.sin(a) * step;
      d += step / len;
      out.push({ x0: cx, y0: cy, x1: nx, y1: ny, d, gen: b.g });
      cx = nx; cy = ny;
      if (b.g < 3 && rng.next() < 0.13) stack.push({ x: cx, y: cy, a: a + rng.sign() * rng.r(0.5, 1.1), l: (b.l - s * step) * rng.r(0.3, 0.6), d, g: b.g + 1 });
    }
  }
  return out;
}

// ------------------------------------------------------------- misc sprites
/** a 4-point star sparkle */
export function sparkle(r: Renderer, x: number, y: number, size: number, c: Col, k = 1) {
  r.px(x, y, c, k * 1.5);
  for (let s = 1; s <= size; s++) {
    const f = k * (1 - s / (size + 1));
    r.px(x + s, y, c, f); r.px(x - s, y, c, f); r.px(x, y + s, c, f); r.px(x, y - s, c, f);
  }
}

/** deterministic ember flicker 0..1 */
export const flick = (seed: number, t: number, rate = 18) => hash(seed * 31.7 + Math.floor(t * rate));

/** smoke puff with dithered alpha */
export function smoke(r: Renderer, x: number, y: number, rad: number, c: Col, a: number) {
  if (a <= 0) return;
  r.disc(x, y, rad, c, clamp(a), 3);
}

export function addLightFlash(r: Renderer, x: number, y: number, rad: number, c: Col, k: number) {
  r.light(x, y, rad, c, k);
  r.glow(x, y, rad * 0.5, c, k * 0.6);
}

export { ADD };
