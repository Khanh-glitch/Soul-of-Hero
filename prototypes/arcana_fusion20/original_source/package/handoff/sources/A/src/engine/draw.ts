// ---------------------------------------------------------------------------
// ARCANA :: drawing primitives. Everything here writes into the HDR buffer.
// The "field" helper is our CPU fragment-shader: iterate a bbox, evaluate a
// function per pixel, accumulate colour. Most spells are built from it.
// ---------------------------------------------------------------------------

import { Framebuffer } from "./framebuffer";
import { RGB, clamp, lerp, TAU, hash2, vnoise } from "./math";

export type ShaderFn = (
  x: number,
  y: number,
  out: [number, number, number]
) => number | void;

/** Run a per-pixel shader over a bounding box (additive). */
export function field(
  fb: Framebuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fn: ShaderFn
) {
  const xa = Math.max(0, Math.floor(x0));
  const ya = Math.max(0, Math.floor(y0));
  const xb = Math.min(fb.W - 1, Math.ceil(x1));
  const yb = Math.min(fb.H - 1, Math.ceil(y1));
  const o: [number, number, number] = [0, 0, 0];
  const buf = fb.buf;
  for (let y = ya; y <= yb; y++) {
    let i = (y * fb.W + xa) * 3;
    for (let x = xa; x <= xb; x++, i += 3) {
      o[0] = 0;
      o[1] = 0;
      o[2] = 0;
      fn(x, y, o);
      if (o[0] !== 0 || o[1] !== 0 || o[2] !== 0) {
        buf[i] += o[0];
        buf[i + 1] += o[1];
        buf[i + 2] += o[2];
      }
    }
  }
}

/** Multiplicative per-pixel pass (shadows, voids, absorption). */
export function fieldMul(
  fb: Framebuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fn: (x: number, y: number) => number
) {
  const xa = Math.max(0, Math.floor(x0));
  const ya = Math.max(0, Math.floor(y0));
  const xb = Math.min(fb.W - 1, Math.ceil(x1));
  const yb = Math.min(fb.H - 1, Math.ceil(y1));
  const buf = fb.buf;
  for (let y = ya; y <= yb; y++) {
    let i = (y * fb.W + xa) * 3;
    for (let x = xa; x <= xb; x++, i += 3) {
      const m = fn(x, y);
      if (m !== 1) {
        buf[i] *= m;
        buf[i + 1] *= m;
        buf[i + 2] *= m;
      }
    }
  }
}

export function px(fb: Framebuffer, x: number, y: number, c: RGB, a = 1) {
  fb.add(x, y, c[0], c[1], c[2], a);
}

/** soft additive light blob — C2-smooth kernel (1-d^2)^3: no cusp, no visible disc edge */
export function glow(fb: Framebuffer, cx: number, cy: number, r: number, c: RGB, k = 1, _pow = 2) {
  if (r <= 0 || k <= 0) return;
  const inv = 1 / r;
  field(fb, cx - r, cy - r, cx + r, cy + r, (x, y, o) => {
    const dx = (x + 0.5 - cx) * inv,
      dy = (y + 0.5 - cy) * inv;
    const d2 = dx * dx + dy * dy;
    if (d2 >= 1) return;
    const m = 1 - d2;
    const f = m * m * m * k;
    o[0] = c[0] * f;
    o[1] = c[1] * f;
    o[2] = c[2] * f;
  });
}

/** hard-edged filled disc (pixel silhouette) */
export function disc(fb: Framebuffer, cx: number, cy: number, r: number, c: RGB, a = 1) {
  const r2 = r * r;
  field(fb, cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (x, y, o) => {
    const dx = x + 0.5 - cx,
      dy = y + 0.5 - cy;
    if (dx * dx + dy * dy > r2) return;
    o[0] = c[0] * a;
    o[1] = c[1] * a;
    o[2] = c[2] * a;
  });
}

export function discBlend(fb: Framebuffer, cx: number, cy: number, r: number, c: RGB, a = 1) {
  const r2 = r * r;
  const xa = Math.max(0, Math.floor(cx - r - 1)),
    xb = Math.min(fb.W - 1, Math.ceil(cx + r + 1));
  const ya = Math.max(0, Math.floor(cy - r - 1)),
    yb = Math.min(fb.H - 1, Math.ceil(cy + r + 1));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const dx = x + 0.5 - cx,
        dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r2) continue;
      fb.blend(x, y, c[0], c[1], c[2], a);
    }
}

export function ringShape(
  fb: Framebuffer,
  cx: number,
  cy: number,
  r: number,
  w: number,
  c: RGB,
  a = 1
) {
  const ro = r + w * 0.5,
    ri = Math.max(0, r - w * 0.5);
  field(fb, cx - ro - 1, cy - ro - 1, cx + ro + 1, cy + ro + 1, (x, y, o) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > ro || d < ri) return;
    o[0] = c[0] * a;
    o[1] = c[1] * a;
    o[2] = c[2] * a;
  });
}

/**
 * Shock-front ring (doctrine 3.3): sharp leading edge, long trailing wake,
 * multi-frequency radius perturbation, fbm breakup of intensity. Never a
 * clean geometric circle. The real force is carried by refraction (World).
 */
export function pulseRing(
  fb: Framebuffer,
  cx: number,
  cy: number,
  r: number,
  w: number,
  c: RGB,
  k = 1,
  squash = 1,
  rough = 0.22,
  seed = 0
) {
  if (k <= 0.003 || w <= 0) return;
  k *= 0.5;
  const ro = r * (1 + rough) + w * 3;
  field(fb, cx - ro - 1, cy - ro / squash - 1, cx + ro + 1, cy + ro / squash + 1, (x, y, o) => {
    const dx = x + 0.5 - cx,
      dy = (y + 0.5 - cy) * squash;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const rr =
      r *
      (1 +
        rough *
          (Math.sin(a * 3 + seed) * 0.34 + Math.sin(a * 7 - seed * 1.7) * 0.2 + Math.sin(a * 13 + seed * 0.6) * 0.1));
    const q = (d - rr) / w;
    let f: number;
    if (q > 0) f = Math.exp(-q * q * 9); // sharp front
    else f = Math.exp(q * 2.4) * 0.55; // short trailing wake
    if (f < 0.02) return;
    const brk = 0.3 + 0.7 * vnoise(Math.cos(a) * 3.5 + seed * 3 + r * 0.02, Math.sin(a) * 3.5 + r * 0.03);
    const ff = f * f * k * brk;
    o[0] = c[0] * ff;
    o[1] = c[1] * ff;
    o[2] = c[2] * ff;
  });
}

/** additive thick line with tapered ends */
export function streak(
  fb: Framebuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  c: RGB,
  k = 1
) {
  const dx = x1 - x0,
    dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) {
    glow(fb, x0, y0, Math.max(w0, 0.8), c, k);
    return;
  }
  const wMax = Math.max(w0, w1) + 1;
  const minX = Math.min(x0, x1) - wMax,
    maxX = Math.max(x0, x1) + wMax;
  const minY = Math.min(y0, y1) - wMax,
    maxY = Math.max(y0, y1) + wMax;
  const il2 = 1 / (len * len);
  field(fb, minX, minY, maxX, maxY, (x, y, o) => {
    const px0 = x + 0.5 - x0,
      py0 = y + 0.5 - y0;
    let t = (px0 * dx + py0 * dy) * il2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = px0 - dx * t,
      qy = py0 - dy * t;
    const d = Math.hypot(qx, qy);
    const w = lerp(w0, w1, t);
    if (d > w) return;
    let f = 1 - d / w;
    f = f * f * k;
    o[0] = c[0] * f;
    o[1] = c[1] * f;
    o[2] = c[2] * f;
  });
}

/** crisp 1px bresenham line, additive */
export function line(fb: Framebuffer, x0: number, y0: number, x1: number, y1: number, c: RGB, a = 1) {
  x0 |= 0;
  y0 |= 0;
  x1 |= 0;
  y1 |= 0;
  const dx = Math.abs(x1 - x0),
    sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0),
    sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let guard = 0;
  for (;;) {
    fb.add(x0, y0, c[0], c[1], c[2], a);
    if ((x0 === x1 && y0 === y1) || guard++ > 4000) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export interface RibbonPt {
  x: number;
  y: number;
}

/**
 * Articulated ribbon renderer. Draws a polyline as a quad-strip with a
 * per-position width and colour, plus an optional inner core line.
 */
export function ribbon(
  fb: Framebuffer,
  pts: RibbonPt[],
  widthFn: (t: number, i: number) => number,
  colFn: (t: number, i: number, edge: number) => RGB | null,
  opts: { blend?: boolean; alpha?: number } = {}
) {
  const n = pts.length;
  if (n < 2) return;
  const alpha = opts.alpha ?? 1;
  for (let i = 0; i < n - 1; i++) {
    const t0 = i / (n - 1),
      t1 = (i + 1) / (n - 1);
    const p0 = pts[i],
      p1 = pts[i + 1];
    let nx = -(p1.y - p0.y),
      ny = p1.x - p0.x;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const w0 = widthFn(t0, i),
      w1 = widthFn(t1, i + 1);
    const segLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const steps = Math.max(1, Math.ceil(segLen));
    for (let s = 0; s < steps; s++) {
      const u = s / steps;
      const t = lerp(t0, t1, u);
      const cx = lerp(p0.x, p1.x, u),
        cy = lerp(p0.y, p1.y, u);
      const w = lerp(w0, w1, u);
      const iw = Math.ceil(w);
      for (let k = -iw; k <= iw; k++) {
        const e = Math.abs(k) / (w || 1);
        if (e > 1) continue;
        const c = colFn(t, i, e);
        if (!c) continue;
        const x = cx + nx * k,
          y = cy + ny * k;
        if (opts.blend) fb.blend(x, y, c[0], c[1], c[2], alpha);
        else fb.add(x, y, c[0], c[1], c[2], alpha);
      }
    }
  }
}

/** convex/simple polygon scanline fill */
export function polyFill(
  fb: Framebuffer,
  pts: RibbonPt[],
  colFn: (x: number, y: number) => RGB | null,
  blend = false,
  alpha = 1
) {
  const n = pts.length;
  if (n < 3) return;
  let minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(fb.H - 1, Math.ceil(maxY));
  const xs: number[] = [];
  for (let y = minY; y <= maxY; y++) {
    xs.length = 0;
    const yc = y + 0.5;
    for (let i = 0; i < n; i++) {
      const a = pts[i],
        b = pts[(i + 1) % n];
      if (a.y === b.y) continue;
      if ((yc >= a.y && yc < b.y) || (yc >= b.y && yc < a.y)) {
        xs.push(a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5));
      const xb = Math.min(fb.W - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) {
        const c = colFn(x, y);
        if (!c) continue;
        if (blend) fb.blend(x, y, c[0], c[1], c[2], alpha);
        else fb.add(x, y, c[0], c[1], c[2], alpha);
      }
    }
  }
}

/** recursive lightning path generator */
export function boltPath(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  chaos: number,
  seed: number,
  depth = 5
): RibbonPt[] {
  let pts: RibbonPt[] = [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
  ];
  let amp = chaos;
  let s = seed;
  for (let d = 0; d < depth; d++) {
    const next: RibbonPt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i],
        b = pts[i + 1];
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2;
      let nx = -(b.y - a.y),
        ny = b.x - a.x;
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
      const r = hash2(s++, i * 31 + d * 7) - 0.5;
      next.push({ x: mx + nx * r * amp, y: my + ny * r * amp });
      next.push(b);
    }
    pts = next;
    amp *= 0.55;
  }
  return pts;
}

/** draw a lightning channel: dark outline + coloured sheath + white core */
export function boltDraw(
  fb: Framebuffer,
  pts: RibbonPt[],
  w: number,
  sheath: RGB,
  core: RGB,
  k = 1
) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i],
      b = pts[i + 1];
    streak(fb, a.x, a.y, b.x, b.y, w, w, sheath, k * 0.9);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i],
      b = pts[i + 1];
    line(fb, a.x, a.y, b.x, b.y, core, k);
  }
}

/** value in [0,1] -> stepped, gives chunky pixel-art banding */
export function band(v: number, steps: number) {
  return Math.floor(clamp(v) * steps) / steps;
}

/** draws an arc of a circle as crisp pixels */
export function arcPx(
  fb: Framebuffer,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  c: RGB,
  a = 1,
  squash = 1
) {
  const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) * r));
  for (let i = 0; i <= steps; i++) {
    const ang = lerp(a0, a1, i / steps);
    fb.add(cx + Math.cos(ang) * r, cy + (Math.sin(ang) * r) / squash, c[0], c[1], c[2], a);
  }
}

export const TAU2 = TAU;
