// ---------------------------------------------------------------------------
// ARCANA :: shared procedural machinery used by several schools.
// ---------------------------------------------------------------------------

import { Framebuffer } from "../engine/framebuffer";
import { field } from "../engine/draw";
import { R, RGB, RNG, clamp, fbm, lerp, TAU, vnoise, hash2 } from "../engine/math";

/** stepped fire ramp lookup -> chunky pixel-art heat bands */
export function fireCol(h: number, steps = 9): RGB {
  return R("fire", Math.floor(clamp(h) * steps) / steps);
}
export function rampStep(name: Parameters<typeof R>[0], h: number, steps = 8): RGB {
  return R(name, Math.floor(clamp(h) * steps) / steps);
}

/** turbulent flame body: polar silhouette + noise interior */
export function flameBlob(
  fb: Framebuffer,
  cx: number,
  cy: number,
  radius: number,
  t: number,
  seedOff: number,
  k: number,
  squash = 1,
  steps = 9
) {
  const rr = radius * 1.35;
  field(fb, cx - rr, cy - rr / squash, cx + rr, cy + rr / squash, (x, y, o) => {
    const dx = x + 0.5 - cx,
      dy = (y + 0.5 - cy) * squash;
    const d = Math.hypot(dx, dy);
    if (d > rr) return;
    const a = Math.atan2(dy, dx);
    const n = fbm(Math.cos(a) * 2.4 + seedOff, Math.sin(a) * 2.4 - t * 1.7, 3);
    const surf = radius * (0.62 + n * 0.62);
    let h = 1 - d / surf;
    if (h <= 0) return;
    h *= k;
    const c = fireCol(h, steps);
    o[0] = c[0];
    o[1] = c[1];
    o[2] = c[2];
  });
}

// --- branching crack / root / frost generator -------------------------------
export interface Branch {
  pts: { x: number; y: number }[];
  w: number;
  depth: number;
  grow: number; // 0..1 how much is drawn
  speed: number;
  delay: number;
  seed: number;
}

export interface GrowOpts {
  steps: number;
  step: number;
  wander: number;
  branchChance: number;
  maxDepth: number;
  widthFalloff: number;
  speed: number;
  bias?: (x: number, y: number, a: number, depth: number) => number;
}

export function growBranches(
  rng: RNG,
  x0: number,
  y0: number,
  a0: number,
  w0: number,
  opts: GrowOpts
): Branch[] {
  const out: Branch[] = [];
  const queue: { x: number; y: number; a: number; w: number; d: number; delay: number }[] = [
    { x: x0, y: y0, a: a0, w: w0, d: 0, delay: 0 },
  ];
  let guard = 0;
  while (queue.length && guard++ < 400) {
    const q = queue.shift()!;
    const pts = [{ x: q.x, y: q.y }];
    let x = q.x,
      y = q.y,
      a = q.a;
    const n = Math.max(3, Math.round(opts.steps * (1 - q.d * 0.18) * rng.range(0.6, 1.25)));
    for (let i = 0; i < n; i++) {
      a += rng.gauss(opts.wander) * 0.5;
      if (opts.bias) a += opts.bias(x, y, a, q.d) * 0.3;
      const s = opts.step * rng.range(0.7, 1.35);
      x += Math.cos(a) * s;
      y += Math.sin(a) * s;
      pts.push({ x, y });
      if (q.d < opts.maxDepth && rng.next() < opts.branchChance) {
        queue.push({
          x,
          y,
          a: a + rng.sign() * rng.range(0.4, 1.3),
          w: q.w * opts.widthFalloff,
          d: q.d + 1,
          delay: q.delay + (i / n) * (1 / opts.speed) * 0.9,
        });
      }
    }
    out.push({
      pts,
      w: q.w,
      depth: q.d,
      grow: 0,
      speed: opts.speed * rng.range(0.8, 1.4),
      delay: q.delay,
      seed: rng.int(0, 9999),
    });
  }
  return out;
}

export function updateBranches(bs: Branch[], t: number) {
  for (const b of bs) b.grow = clamp((t - b.delay) * b.speed);
}

/** draw a branch polyline up to its grow fraction */
export function drawBranch(
  fb: Framebuffer,
  b: Branch,
  colFn: (u: number, edge: number, b: Branch) => RGB | null,
  widthFn: (u: number, b: Branch) => number,
  blend = false
) {
  const n = b.pts.length;
  const limit = b.grow * (n - 1);
  if (limit <= 0) return;
  for (let i = 0; i < Math.min(n - 1, Math.ceil(limit)); i++) {
    const p = b.pts[i],
      q = b.pts[i + 1];
    const f = clamp(limit - i);
    const u0 = i / (n - 1);
    const ex = p.x + (q.x - p.x) * f,
      ey = p.y + (q.y - p.y) * f;
    const dx = ex - p.x,
      dy = ey - p.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    for (let s = 0; s <= len; s++) {
      const u = u0 + (s / len / (n - 1)) * 1;
      const cx = p.x + (dx * s) / len,
        cy = p.y + (dy * s) / len;
      const w = widthFn(u, b);
      let nx = -dy / len,
        ny = dx / len;
      const iw = Math.ceil(w);
      for (let kk = -iw; kk <= iw; kk++) {
        const e = Math.abs(kk) / (w || 1);
        if (e > 1) continue;
        const c = colFn(u, e, b);
        if (!c) continue;
        if (blend) fb.blend(cx + nx * kk, cy + ny * kk, c[0], c[1], c[2], 1);
        else fb.add(cx + nx * kk, cy + ny * kk, c[0], c[1], c[2], 1);
      }
    }
  }
}

/** molten floor scar decal: dark crust with glowing veins */
export function scarDecal(
  fb: Framebuffer,
  bs: Branch[],
  heat: number,
  t: number,
  tint: RGB = [1, 0.35, 0.08]
) {
  for (const b of bs) {
    drawBranch(
      fb,
      b,
      (u, e) => {
        const flick = 0.75 + 0.25 * vnoise(u * 18 + b.seed, t * 3);
        const h = (1 - e) * heat * flick * (1 - u * 0.45);
        if (h <= 0.02) return null;
        const c = fireCol(h * 0.95);
        return [c[0] * tint[0], c[1] * tint[1] * 1.6, c[2] * tint[2] * 2.2];
      },
      (u, bb) => Math.max(0.6, bb.w * (1 - u * 0.75))
    );
  }
}

/** crisp crystalline shard polygon */
export function shard(
  fb: Framebuffer,
  cx: number,
  cy: number,
  r: number,
  a: number,
  sides: number,
  seed: number,
  colFn: (u: number, d: number) => RGB | null,
  squash = 1
) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const ang = a + (i / sides) * TAU;
    const rr = r * (0.55 + hash2(seed, i) * 0.8);
    pts.push({ x: cx + Math.cos(ang) * rr, y: cy + (Math.sin(ang) * rr) / squash });
  }
  // scanline
  let minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(fb.H - 1, Math.ceil(maxY)); y++) {
    const xs: number[] = [];
    const yc = y + 0.5;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i],
        q = pts[(i + 1) % pts.length];
      if (p.y === q.y) continue;
      if ((yc >= p.y && yc < q.y) || (yc >= q.y && yc < p.y))
        xs.push(p.x + ((yc - p.y) / (q.y - p.y)) * (q.x - p.x));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.ceil(xs[k]),
        xb = Math.floor(xs[k + 1]);
      for (let x = xa; x <= xb; x++) {
        const d = Math.hypot(x - cx, (y - cy) * squash) / (r || 1);
        const edge = Math.min(x - xs[k], xs[k + 1] - x);
        const c = colFn(clamp(d), edge);
        if (c) fb.add(x, y, c[0], c[1], c[2], 1);
      }
    }
  }
}

/** screen-space heat shimmer: displaces already-drawn pixels locally */
export function heatShimmer(
  fb: Framebuffer,
  cx: number,
  cy: number,
  r: number,
  t: number,
  amp: number
) {
  const x0 = Math.max(1, Math.floor(cx - r)),
    x1 = Math.min(fb.W - 2, Math.ceil(cx + r));
  const y0 = Math.max(1, Math.floor(cy - r)),
    y1 = Math.min(fb.H - 2, Math.ceil(cy + r));
  if (x1 <= x0 || y1 <= y0) return;
  const w = x1 - x0 + 1,
    h = y1 - y0 + 1;
  const tmp = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = ((y + y0) * fb.W + (x + x0)) * 3;
      const o = (y * w + x) * 3;
      tmp[o] = fb.buf[i];
      tmp[o + 1] = fb.buf[i + 1];
      tmp[o + 2] = fb.buf[i + 2];
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const gx = x + x0,
        gy = y + y0;
      const d = Math.hypot(gx - cx, gy - cy) / r;
      if (d > 1) continue;
      const f = (1 - d) * amp;
      const dy = Math.round(
        (vnoise((gx + 0.5) * 0.18, (gy + 0.5) * 0.1 - t * 6) - 0.5) * 2 * f
      );
      const dx = Math.round((vnoise(gx * 0.12 + 40, gy * 0.14 - t * 4) - 0.5) * 1.4 * f);
      const sx = clamp(x + dx, 0, w - 1) | 0,
        sy = clamp(y + dy, 0, h - 1) | 0;
      const s = (sy * w + sx) * 3;
      const i = (gy * fb.W + gx) * 3;
      fb.buf[i] = tmp[s];
      fb.buf[i + 1] = tmp[s + 1];
      fb.buf[i + 2] = tmp[s + 2];
    }
}

export const lp = lerp;
