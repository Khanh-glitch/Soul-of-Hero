/** ARCANA #20 Reality Ripper — C contour/timeline ported from the P0 donor
 *  (AVFX d8d62ec, prototypes/arcana20_web_review/src/arcana_c/fusion20/contour.ts).
 *  Seed 151461, 9 waypoints, PERM restitch order — unchanged source choreography. */
import { Rng, lerp, clamp, inv, easeIn, easeOut } from '../arcana_d19/math';

const PERM = [10, 7, 11, 5, 0, 6, 3, 1, 8, 4, 2, 9];
export const F20_W = 480, F20_H = 270;

export class RipperContour {
  readonly way: { x: number; y: number }[] = [];
  readonly cum: number[] = [0];
  readonly pathLength: number;
  constructor() {
    const rng = new Rng(151461);
    for (let i = 0; i < 9; i++) {
      const u = i / 8;
      let y = lerp(62, 172, u);
      if (i !== 0 && i !== 8) y += rng.r(-11, 11);
      this.way.push({ x: lerp(86, 334, u), y });
    }
    for (let i = 1; i < this.way.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.way[i].x - this.way[i - 1].x, this.way[i].y - this.way[i - 1].y));
    this.pathLength = this.cum[this.cum.length - 1];
  }
  at(s: number) {
    const len = s * this.pathLength;
    let i = 0;
    while (i < this.cum.length - 2 && this.cum[i + 1] < len) i++;
    const u = (len - this.cum[i]) / (this.cum[i + 1] - this.cum[i]);
    const a = this.way[i], b = this.way[i + 1], d = this.cum[i + 1] - this.cum[i];
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), nx: -(b.y - a.y) / d, ny: (b.x - a.x) / d };
  }
  /** Source width profile: opens 3.0s, widens to 6.0s, collision bulge 6.35–6.6,
   *  then per-segment restitch closing from 7.15s in PERM order. */
  width(s: number, t: number): number {
    if (t < 3) return 0;
    let w = 22 * easeOut(inv(3, 6, t), 2) * Math.pow(Math.sin(Math.PI * s), 0.7) * (1 + 0.35 * (noise1(s * 8 + t * 0.6) - 0.5));
    if (t > 6.35 && t < 6.6) w *= 1 + 0.6 * inv(6.35, 6.6, t);
    const k = Math.min(11, Math.floor(s * 12));
    const close = 7.15 + PERM.indexOf(k) * 0.16;
    return w * (1 - easeIn(inv(close, close + 0.22, t), 2));
  }
  /** Source-A warp/debris clock mapped to C open/collision/stitch beats. */
  aTime(t: number): number {
    if (t < 3) return 0.35 + inv(1.6, 3, t) * 0.65;
    if (t < 6.6) return 1 + (t - 3) * 4.3 / 3.6;
    return 5.3 + (t - 6.6) * 0.8 / 0.55;
  }
}

/** Deterministic 1D noise standing in for source noise3 on the width profile. */
function noise1(x: number): number {
  const i = Math.floor(x), f = x - i;
  const h = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  const u = f * f * (3 - 2 * f);
  return h(i) + (h(i + 1) - h(i)) * u;
}

/** Precomputed contour field over the 480x270 source window (uploaded once per cast).
 *  RGBA32F: s (path param, -1 outside), d (signed distance), nx, ny. */
export function buildContourField(c: RipperContour): Float32Array {
  const W = F20_W, H = F20_H;
  const tS = new Float32Array(W * H).fill(-1);
  const tD = new Float32Array(W * H), tNx = new Float32Array(W * H), tNy = new Float32Array(W * H);
  const BX0 = 40, BY0 = 16, BX1 = 380, BY1 = 214;
  for (let y = BY0; y <= BY1; y++) for (let x = BX0; x <= BX1; x++) {
    let best = 1e9, bs = 0, bd = 0, bnx = 0, bny = 0;
    for (let i = 0; i < c.way.length - 1; i++) {
      const a = c.way[i], b = c.way[i + 1], dx = b.x - a.x, dy = b.y - a.y;
      const l2 = dx * dx + dy * dy, l = Math.sqrt(l2);
      const px = x + 0.5 - a.x, py = y + 0.5 - a.y;
      const u = clamp((px * dx + py * dy) / l2);
      const qx = px - dx * u, qy = py - dy * u, d = Math.hypot(qx, qy);
      if (d < best) {
        best = d; bs = (c.cum[i] + u * l) / c.pathLength;
        const sd = dx * py - dy * px >= 0 ? 1 : -1;
        bd = d * sd; bnx = (-dy / l) * sd; bny = (dx / l) * sd;
      }
    }
    if (best < 46) { const k = y * W + x; tS[k] = bs; tD[k] = bd; tNx[k] = bnx; tNy[k] = bny; }
  }
  const out = new Float32Array(W * H * 4);
  for (let k = 0; k < W * H; k++) { out[k * 4] = tS[k]; out[k * 4 + 1] = tD[k]; out[k * 4 + 2] = tNx[k]; out[k * 4 + 3] = tNy[k]; }
  return out;
}

export const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const seg = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
