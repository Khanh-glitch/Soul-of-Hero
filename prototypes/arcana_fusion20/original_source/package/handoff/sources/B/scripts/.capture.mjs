// scripts/capture.ts
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

// src/engine/math.ts
var TAU = Math.PI * 2;
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var lerp = (a, b, t) => a + (b - a) * t;
var inv = (a, b, x) => clamp((x - a) / (b - a));
var smooth = (a, b, x) => {
  const t = inv(a, b, x);
  return t * t * (3 - 2 * t);
};
var easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
var easeIn = (t) => Math.pow(clamp(t), 3);
var easeInOut = (t) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
var easeOutExpo = (t) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t));
var easeInExpo = (t) => t <= 0 ? 0 : Math.pow(2, 10 * clamp(t) - 10);
var easeOutBack = (t) => {
  t = clamp(t);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
var pulse = (a, b, x) => {
  if (x <= a || x >= b) return 0;
  return Math.sin((x - a) / (b - a) * Math.PI);
};
function hash(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
function hash2(a, b) {
  return hash(a * 12.9898 + b * 78.233);
}
var RNG = class {
  s;
  constructor(seed = 1) {
    this.s = seed * 2654435761 >>> 0 || 1;
  }
  next() {
    let t = this.s += 1831565813;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  r(a = 0, b = 1) {
    return a + (b - a) * this.next();
  }
  i(a, b) {
    return Math.floor(this.r(a, b + 1));
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  gauss() {
    return (this.next() + this.next() + this.next() - 1.5) / 1.5;
  }
};
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct = 3) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += noise2(x * f, y * f) * a;
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}
function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u);
}
var dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function catmull(pts, u) {
  const n = pts.length - 1;
  const f = clamp(u) * n;
  const i = Math.min(Math.floor(f), n - 1);
  const t = f - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const t2 = t * t, t3 = t2 * t;
  const k = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: k(p0.x, p1.x, p2.x, p3.x), y: k(p0.y, p1.y, p2.y, p3.y) };
}
function resample(pts, step = 1.5) {
  const dense = [];
  const N2 = pts.length * 40;
  for (let i = 0; i <= N2; i++) dense.push(catmull(pts, i / N2));
  const p = [dense[0]];
  const len = [0];
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
function fly(p0, v0, drag, acc, t) {
  if (drag <= 1e-4) return p0 + v0 * t + 0.5 * acc * t * t;
  const e = Math.exp(-drag * t);
  return p0 + (v0 - acc / drag) * (1 - e) / drag + acc / drag * t;
}
function ramp(stops, t) {
  t = clamp(t) * (stops.length - 1);
  const i = Math.min(Math.floor(t), stops.length - 2);
  const f = t - i;
  const a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
var scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
var mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function shardShape(rng, n = 5, jag = 0.45) {
  const out = [];
  const base = rng.r(0, TAU);
  for (let i = 0; i < n; i++) {
    const a = base + i / n * TAU + rng.r(-0.3, 0.3) * (TAU / n);
    out.push(a, 1 - rng.r(0, jag));
  }
  return out;
}
function shardPts(shape, cx, cy, rad, rot, sx = 1, sy = 1) {
  const p = [];
  for (let i = 0; i < shape.length; i += 2) {
    const a = shape[i] + rot, r = shape[i + 1] * rad;
    p.push(cx + Math.cos(a) * r * sx, cy + Math.sin(a) * r * sy);
  }
  return p;
}

// src/engine/renderer.ts
var W = 384;
var H = 216;
var N = W * H;
var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
var bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
var ADD = 0;
var SET = 1;
var BLEND = 2;
var DITHER = 3;
var MUL = 4;
var SUB = 5;
var Renderer = class {
  c;
  // current colour target (HDR)
  main = new Float32Array(N * 3);
  alt = new Float32Array(N * 3);
  tmp = new Float32Array(N * 3);
  floor = new Float32Array(N * 3);
  // static floor albedo
  alb = new Float32Array(N * 3);
  // per-frame albedo (floor + decals)
  shade = new Float32Array(N);
  mask = new Uint8Array(N);
  lightBuf = new Float32Array(N * 3);
  lights = [];
  ambient = 0.62;
  tint = [0.85, 0.9, 1.15];
  flash = 0;
  flashCol = [1, 1, 1];
  shakeX = 0;
  shakeY = 0;
  // transform & clip
  tx = 0;
  ty = 0;
  ts = 1;
  clip = null;
  caster = { x: 104, y: 132 };
  target = { x: 262, y: 104 };
  anchors = [];
  time = 0;
  // global wall time (for idle animation)
  constructor() {
    this.c = this.main;
    this.buildFloor();
  }
  // ---------------------------------------------------------------- floor
  buildFloor() {
    const f = this.floor;
    const rng = new RNG(77);
    const TS = 16;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const row = Math.floor(y / TS);
        const ox = row % 2 ? 8 : 0;
        const tx = Math.floor((x + ox) / TS), ty = row;
        const lx = (x + ox) % TS, ly = y % TS;
        const th = hash2(tx * 3.1, ty * 7.7);
        let base = 0.16 + th * 0.05;
        const n = fbm(x * 0.09, y * 0.09, 3);
        base += (n - 0.5) * 0.07;
        if (lx === 0 || ly === 0) base *= 0.35;
        else if (lx === 1 || ly === 1) base *= 1.28;
        else if (lx === TS - 1 || ly === TS - 1) base *= 0.7;
        if (hash2(x, y) > 0.985) base *= 0.6;
        let r = base * 0.86, g = base * 0.9, b = base * 1.12;
        const m = noise2(x * 0.05 + 10, y * 0.05);
        if ((lx < 2 || ly < 2) && m > 0.68 && hash2(x * 1.3, y) > 0.4) {
          r = 0.08;
          g = 0.16;
          b = 0.1;
        }
        const i = (y * W + x) * 3;
        f[i] = r;
        f[i + 1] = g;
        f[i + 2] = b;
      }
    }
    for (let k = 0; k < 14; k++) {
      let x = rng.r(0, W), y = rng.r(0, H), a = rng.r(0, 6.28);
      const len = rng.i(10, 34);
      for (let s = 0; s < len; s++) {
        a += rng.r(-0.6, 0.6);
        x += Math.cos(a);
        y += Math.sin(a);
        const ix = x | 0, iy = y | 0;
        if (ix < 0 || iy < 0 || ix >= W || iy >= H) break;
        const i = (iy * W + ix) * 3;
        f[i] *= 0.45;
        f[i + 1] *= 0.45;
        f[i + 2] *= 0.5;
      }
    }
    const cx = W / 2, cy = H / 2 - 4;
    for (let a = 0; a < 6.283; a += 4e-3) {
      for (const rr of [92, 96]) {
        const ix = Math.round(cx + Math.cos(a) * rr), iy = Math.round(cy + Math.sin(a) * rr * 0.62);
        if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
        const i = (iy * W + ix) * 3;
        f[i] *= 1.35;
        f[i + 1] *= 1.3;
        f[i + 2] *= 1.25;
      }
    }
  }
  // ---------------------------------------------------------------- frame
  begin() {
    this.c = this.main;
    this.c.fill(0);
    this.alb.set(this.floor);
    this.shade.fill(1);
    this.mask.fill(0);
    this.lights.length = 0;
    this.ambient = 0.62;
    this.tint = [0.85, 0.9, 1.15];
    this.flash = 0;
    this.flashCol = [1, 1, 1];
    this.shakeX = this.shakeY = 0;
    this.tx = this.ty = 0;
    this.ts = 1;
    this.clip = null;
  }
  setTarget(buf) {
    this.c = buf;
  }
  /** Apply deferred lighting of the albedo layer (floor, decals, sprites). */
  lighting() {
    const L = this.lightBuf;
    L.fill(0);
    for (const l of this.lights) {
      const x0 = Math.max(0, Math.floor(l.x - l.r)), x1 = Math.min(W - 1, Math.ceil(l.x + l.r));
      const y0 = Math.max(0, Math.floor(l.y - l.r)), y1 = Math.min(H - 1, Math.ceil(l.y + l.r));
      const ir = 1 / l.r;
      for (let y = y0; y <= y1; y++) {
        const dy = (y - l.y) * ir;
        for (let x = x0; x <= x1; x++) {
          const dx = (x - l.x) * ir;
          const d2 = dx * dx + dy * dy;
          if (d2 >= 1) continue;
          let f = 1 - Math.sqrt(d2);
          f = f * f;
          f = Math.floor(f * 6 + bayer(x, y)) / 6;
          if (f <= 0) continue;
          const k = f * l.i, i = (y * W + x) * 3;
          L[i] += l.c[0] * k;
          L[i + 1] += l.c[1] * k;
          L[i + 2] += l.c[2] * k;
        }
      }
    }
    const c = this.main, A = this.alb, S = this.shade, M = this.mask;
    const ar = this.ambient * this.tint[0], ag = this.ambient * this.tint[1], ab = this.ambient * this.tint[2];
    for (let p = 0, i = 0; p < N; p++, i += 3) {
      if (M[p]) continue;
      const s = S[p];
      c[i] += A[i] * s * (ar + L[i]);
      c[i + 1] += A[i + 1] * s * (ag + L[i + 1]);
      c[i + 2] += A[i + 2] * s * (ab + L[i + 2]);
    }
  }
  /** Tone-map, dither and posterise into an RGBA byte buffer. */
  finalize(out) {
    const c = this.main;
    const sx = Math.round(this.shakeX), sy = Math.round(this.shakeY);
    const fl = this.flash, fc = this.flashCol;
    const LV = 20;
    for (let y = 0; y < H; y++) {
      const yy = Math.min(H - 1, Math.max(0, y - sy));
      for (let x = 0; x < W; x++) {
        const xx = Math.min(W - 1, Math.max(0, x - sx));
        const i = (yy * W + xx) * 3;
        let r = c[i] + fl * fc[0], g = c[i + 1] + fl * fc[1], b = c[i + 2] + fl * fc[2];
        const mx = Math.max(r, g, b);
        const ex = mx > 1.1 ? (mx - 1.1) * 0.32 : 0;
        r = 1 - Math.exp(-(r + ex) * 1.05);
        g = 1 - Math.exp(-(g + ex) * 1.05);
        b = 1 - Math.exp(-(b + ex) * 1.05);
        const d = bayer(x, y) - 0.5;
        const o = (y * W + x) * 4;
        out[o] = Math.floor(clamp(r * LV + d, 0, LV)) / LV * 255;
        out[o + 1] = Math.floor(clamp(g * LV + d, 0, LV)) / LV * 255;
        out[o + 2] = Math.floor(clamp(b * LV + d, 0, LV)) / LV * 255;
        out[o + 3] = 255;
      }
    }
  }
  // ---------------------------------------------------------------- pixel core
  plot(ix, iy, r, g, b, mode2, a) {
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    if (this.clip && !this.clip(ix, iy)) return;
    const p = iy * W + ix, i = p * 3, c = this.c;
    switch (mode2) {
      case ADD:
        c[i] += r * a;
        c[i + 1] += g * a;
        c[i + 2] += b * a;
        break;
      case SET:
        c[i] = r;
        c[i + 1] = g;
        c[i + 2] = b;
        if (c === this.main) this.mask[p] = 1;
        break;
      case BLEND:
        c[i] += (r - c[i]) * a;
        c[i + 1] += (g - c[i + 1]) * a;
        c[i + 2] += (b - c[i + 2]) * a;
        break;
      case DITHER:
        if (bayer(ix, iy) < a) {
          c[i] = r;
          c[i + 1] = g;
          c[i + 2] = b;
          if (c === this.main) this.mask[p] = 1;
        }
        break;
      case MUL:
        c[i] *= r;
        c[i + 1] *= g;
        c[i + 2] *= b;
        break;
      case SUB:
        c[i] = Math.max(0, c[i] - r * a);
        c[i + 1] = Math.max(0, c[i + 1] - g * a);
        c[i + 2] = Math.max(0, c[i + 2] - b * a);
        break;
    }
  }
  X(x) {
    return x * this.ts + this.tx;
  }
  Y(y) {
    return y * this.ts + this.ty;
  }
  px(x, y, c, i = 1, mode2 = ADD) {
    this.plot(Math.floor(this.X(x)), Math.floor(this.Y(y)), c[0] * (mode2 === ADD ? i : 1), c[1] * (mode2 === ADD ? i : 1), c[2] * (mode2 === ADD ? i : 1), mode2, mode2 === ADD ? 1 : i);
  }
  /** filled disc. In ADD mode `i` is intensity, otherwise it's alpha */
  disc(x, y, rad, c, i = 1, mode2 = ADD, sy = 1) {
    const cx = this.X(x), cy = this.Y(y), R = rad * this.ts;
    if (R < 0.5) {
      this.px(x, y, c, i, mode2);
      return;
    }
    const Ry = R * sy;
    const x0 = Math.floor(cx - R), x1 = Math.ceil(cx + R), y0 = Math.floor(cy - Ry), y1 = Math.ceil(cy + Ry);
    const k = mode2 === ADD ? i : 1, a = mode2 === ADD ? 1 : i;
    const r = c[0] * k, g = c[1] * k, b = c[2] * k;
    const R2 = R * R;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = (yy + 0.5 - cy) / sy;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - cx;
        if (dx * dx + dy * dy <= R2) this.plot(xx, yy, r, g, b, mode2, a);
      }
    }
  }
  /** soft radial glow, additive */
  glow(x, y, rad, c, i = 1, sy = 1) {
    const cx = this.X(x), cy = this.Y(y), R = rad * this.ts;
    if (R < 1) return;
    const x0 = Math.floor(cx - R), x1 = Math.ceil(cx + R), y0 = Math.floor(cy - R * sy), y1 = Math.ceil(cy + R * sy);
    const iR = 1 / R;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = (yy + 0.5 - cy) / sy * iR;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx + 0.5 - cx) * iR;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        let f = 1 - Math.sqrt(d2);
        f *= f * i;
        this.plot(xx, yy, c[0] * f, c[1] * f, c[2] * f, ADD, 1);
      }
    }
  }
  ring(x, y, rad, th, c, i = 1, mode2 = ADD, sy = 1) {
    const cx = this.X(x), cy = this.Y(y), R = rad * this.ts, T = Math.max(0.6, th * this.ts);
    const Ro = R + T / 2, Ri = Math.max(0, R - T / 2);
    const x0 = Math.floor(cx - Ro), x1 = Math.ceil(cx + Ro), y0 = Math.floor(cy - Ro * sy), y1 = Math.ceil(cy + Ro * sy);
    const k = mode2 === ADD ? i : 1, a = mode2 === ADD ? 1 : i;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = (yy + 0.5 - cy) / sy;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - cx;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= Ro && d >= Ri) this.plot(xx, yy, c[0] * k, c[1] * k, c[2] * k, mode2, a);
      }
    }
  }
  line(x0, y0, x1, y1, c, i = 1, mode2 = ADD) {
    let ax = this.X(x0), ay = this.Y(y0);
    const bx = this.X(x1), by = this.Y(y1);
    const dx = bx - ax, dy = by - ay;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    const k = mode2 === ADD ? i : 1, a = mode2 === ADD ? 1 : i;
    const r = c[0] * k, g = c[1] * k, b = c[2] * k;
    let lx = -9999, ly = -9999;
    for (let s = 0; s <= n; s++) {
      const ix = Math.floor(ax + dx * s / n), iy = Math.floor(ay + dy * s / n);
      if (ix === lx && iy === ly) continue;
      lx = ix;
      ly = iy;
      this.plot(ix, iy, r, g, b, mode2, a);
    }
  }
  /** thick line (capsule) */
  thick(x0, y0, x1, y1, w, c, i = 1, mode2 = ADD) {
    if (w <= 1.2) {
      this.line(x0, y0, x1, y1, c, i, mode2);
      return;
    }
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L * w * 0.5, ny = dx / L * w * 0.5;
    this.poly([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny], c, i, mode2);
  }
  polyline(pts, c, i = 1, mode2 = ADD, closed = false) {
    for (let k = 0; k + 3 < pts.length; k += 2) this.line(pts[k], pts[k + 1], pts[k + 2], pts[k + 3], c, i, mode2);
    if (closed && pts.length >= 6) this.line(pts[pts.length - 2], pts[pts.length - 1], pts[0], pts[1], c, i, mode2);
  }
  /** scanline polygon fill (even-odd), flat [x,y,x,y...] */
  poly(pts, c, i = 1, mode2 = ADD) {
    const n = pts.length >> 1;
    if (n < 3) return;
    const P = new Array(pts.length);
    let minY = 1e9, maxY = -1e9;
    for (let k = 0; k < n; k++) {
      P[k * 2] = this.X(pts[k * 2]);
      P[k * 2 + 1] = this.Y(pts[k * 2 + 1]);
      if (P[k * 2 + 1] < minY) minY = P[k * 2 + 1];
      if (P[k * 2 + 1] > maxY) maxY = P[k * 2 + 1];
    }
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.ceil(maxY));
    const k2 = mode2 === ADD ? i : 1, a = mode2 === ADD ? 1 : i;
    const r = c[0] * k2, g = c[1] * k2, b = c[2] * k2;
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let k = 0, j = n - 1; k < n; j = k++) {
        const yi = P[k * 2 + 1], yj = P[j * 2 + 1];
        if (yi > sy !== yj > sy) {
          xs.push(P[k * 2] + (sy - yi) / (yj - yi) * (P[j * 2] - P[k * 2]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let q = 0; q + 1 < xs.length; q += 2) {
        const xa = Math.max(0, Math.round(xs[q])), xb = Math.min(W - 1, Math.round(xs[q + 1]) - 1);
        for (let x = xa; x <= xb; x++) this.plot(x, y, r, g, b, mode2, a);
      }
    }
  }
  /** ribbon from centre points + widths; draws as quads */
  ribbon(pts, widths, c, i = 1, mode2 = ADD) {
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1];
      const w0 = widths[k], w1 = widths[k + 1];
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      this.poly([a.x + nx * w0, a.y + ny * w0, b.x + nx * w1, b.y + ny * w1, b.x - nx * w1, b.y - ny * w1, a.x - nx * w0, a.y - ny * w0], c, i, mode2);
    }
  }
  // ---------------------------------------------------------------- world layers
  light(x, y, r, c, i = 1) {
    if (i <= 1e-3 || r < 2) return;
    this.lights.push({ x: this.X(x), y: this.Y(y), r: r * this.ts, c, i });
  }
  shadow(x, y, rx, ry, amt) {
    const x0 = Math.floor(x - rx), x1 = Math.ceil(x + rx), y0 = Math.floor(y - ry), y1 = Math.ceil(y + ry);
    for (let yy = Math.max(0, y0); yy <= Math.min(H - 1, y1); yy++) {
      const dy = (yy + 0.5 - y) / ry;
      for (let xx = Math.max(0, x0); xx <= Math.min(W - 1, x1); xx++) {
        const dx = (xx + 0.5 - x) / rx;
        const d = dx * dx + dy * dy;
        if (d >= 1) continue;
        const f = (1 - d) * amt;
        if (bayer(xx, yy) < f * 1.6) this.shade[yy * W + xx] *= 1 - Math.min(0.85, f);
      }
    }
  }
  /** draw onto albedo layer (gets lit by the scene lights) */
  decal(x, y, c, a = 1) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    const i = (iy * W + ix) * 3, A = this.alb;
    A[i] += (c[0] - A[i]) * a;
    A[i + 1] += (c[1] - A[i + 1]) * a;
    A[i + 2] += (c[2] - A[i + 2]) * a;
  }
  decalDisc(x, y, rad, c, a = 1, jag = 0) {
    for (let yy = Math.floor(y - rad); yy <= y + rad; yy++)
      for (let xx = Math.floor(x - rad); xx <= x + rad; xx++) {
        const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / rad;
        const lim = 1 - jag * hash2(Math.floor(Math.atan2(yy - y, xx - x) * 6), 3.3);
        if (d < lim) this.decal(xx, yy, c, a * (d < lim * 0.7 ? 1 : bayer(xx, yy) < 0.5 ? 1 : 0.5));
      }
  }
  decalLine(x0, y0, x1, y1, c, a = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let s = 0; s <= n; s++) this.decal(x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n, c, a);
  }
  /** Resample the colour target through a displacement function.
   *  fn receives screen coords and must write the source coordinate into o. */
  warp(x0, y0, x1, y1, fn) {
    x0 = Math.max(0, Math.floor(x0));
    y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W - 1, Math.ceil(x1));
    y1 = Math.min(H - 1, Math.ceil(y1));
    const c = this.c, t = this.tmp;
    t.set(c);
    const o = [0, 0];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        o[0] = x;
        o[1] = y;
        fn(x, y, o);
        let sx = Math.floor(o[0]), sy = Math.floor(o[1]);
        if (sx === x && sy === y) continue;
        sx = sx < 0 ? 0 : sx >= W ? W - 1 : sx;
        sy = sy < 0 ? 0 : sy >= H ? H - 1 : sy;
        const i = (y * W + x) * 3, j = (sy * W + sx) * 3;
        c[i] = t[j];
        c[i + 1] = t[j + 1];
        c[i + 2] = t[j + 2];
      }
  }
  /** read a pixel of current target */
  get(x, y, o) {
    x = Math.max(0, Math.min(W - 1, Math.floor(x)));
    y = Math.max(0, Math.min(H - 1, Math.floor(y)));
    const i = (y * W + x) * 3;
    o[0] = this.c[i];
    o[1] = this.c[i + 1];
    o[2] = this.c[i + 2];
  }
  /** Draw the arena actors into the albedo layer so they are lit by magic. */
  drawActors(t, casting) {
    for (const a of this.anchors) {
      this.shadow(a.x + 2, a.y + 3, 6, 3, 0.7);
      for (let yy = -9; yy <= 1; yy++)
        for (let xx = -2; xx <= 2; xx++) {
          const edge = Math.abs(xx) === 2;
          const top = yy < -6;
          const c = top ? [0.55, 0.42, 0.22] : edge ? [0.08, 0.08, 0.12] : [0.18 - yy * 4e-3, 0.17, 0.24];
          if (top && Math.abs(xx) + (yy + 9) < 1) continue;
          this.decal(a.x + xx, a.y + yy, xx === -1 && !top ? [0.32, 0.32, 0.42] : c);
        }
      const gl = 0.5 + 0.5 * Math.sin(t * 2 + a.x);
      this.plot(Math.floor(a.x), Math.floor(a.y - 5), 0.2 * gl, 0.4 * gl, 0.9 * gl, ADD, 1);
    }
    const cx = Math.floor(this.caster.x), cy = Math.floor(this.caster.y);
    const bob = Math.round(Math.sin(t * 2.2) * 0.6);
    this.shadow(cx + 1, cy + 2, 7, 3, 0.85);
    const S = [
      "...hhh...",
      "..hHHHh..",
      ".hHHHHHh.",
      ".hHfffHh.",
      ".hfeffeh.",
      "..hffffh.",
      ".rrRRRrr.",
      "rrRRRRRrr",
      "rRRgRRRRr",
      "rRRRgRRRr",
      "rRRRRgRRr",
      ".rRRRRRr.",
      ".rrRRRrr.",
      "..bb.bb.."
    ];
    const pal = {
      h: [0.12, 0.08, 0.22],
      H: [0.28, 0.18, 0.46],
      f: [0.05, 0.04, 0.07],
      e: [1, 1, 1],
      r: [0.14, 0.09, 0.26],
      R: [0.32, 0.2, 0.52],
      g: [0.7, 0.55, 0.25],
      b: [0.1, 0.07, 0.1]
    };
    for (let yy = 0; yy < S.length; yy++)
      for (let xx = 0; xx < 9; xx++) {
        const ch = S[yy][xx];
        if (ch === ".") continue;
        const X = cx - 4 + xx, Y = cy - 13 + yy + (yy < 6 ? bob : 0);
        if (ch === "e") {
          const k2 = 0.8 + casting * 2;
          this.plot(X, Y, 0.6 * k2, 0.9 * k2, 1.4 * k2, SET, 1);
        } else this.decal(X, Y, pal[ch]);
      }
    for (let yy = -16; yy <= 0; yy++) this.decal(cx + 5, cy + yy, [0.3, 0.2, 0.12]);
    const k = 0.6 + casting * 2.5 + 0.2 * Math.sin(t * 4);
    this.plot(cx + 5, cy - 17, 0.8 * k, 0.6 * k, 1.6 * k, ADD, 1);
    this.light(cx + 5, cy - 17, 18 + casting * 10, [0.5, 0.45, 1], 0.25 + casting * 0.5);
  }
};

// src/engine/fx.ts
function bolt(rng, x0, y0, x1, y1, rough = 0.32, branch = 0.35, depth = 0, d0 = 0, d1 = 1, out = []) {
  const pts = [x0, y0, x1, y1];
  const len = Math.hypot(x1 - x0, y1 - y0);
  let off = len * rough;
  let cur = pts;
  while (off > 1.2 && cur.length < 400) {
    const nx = [];
    for (let k = 0; k + 2 < cur.length; k += 2) {
      const ax = cur[k], ay = cur[k + 1], bx = cur[k + 2], by = cur[k + 3];
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
      const o = rng.gauss() * off;
      nx.push(ax, ay, mx + -dy / L * o, my + dx / L * o);
    }
    nx.push(cur[cur.length - 2], cur[cur.length - 1]);
    cur = nx;
    off *= 0.52;
  }
  const n = cur.length / 2 - 1;
  for (let k = 0; k < n; k++) {
    const d = d0 + (d1 - d0) * k / n;
    out.push({ x0: cur[k * 2], y0: cur[k * 2 + 1], x1: cur[k * 2 + 2], y1: cur[k * 2 + 3], w: depth, d });
    if (depth < 2 && rng.next() < branch * (depth === 0 ? 0.22 : 0.12)) {
      const ang = Math.atan2(y1 - y0, x1 - x0) + rng.sign() * rng.r(0.4, 1.2);
      const bl = len * rng.r(0.12, 0.35) / (depth + 1);
      const bx = cur[k * 2] + Math.cos(ang) * bl, by = cur[k * 2 + 1] + Math.sin(ang) * bl;
      bolt(rng, cur[k * 2], cur[k * 2 + 1], bx, by, rough * 1.1, branch, depth + 1, d, d + bl / Math.max(1, len) * (d1 - d0), out);
    }
  }
  return out;
}
var ARC_CORE = [2.6, 2.8, 3.4];
var ARC_MID = [0.7, 1.1, 3];
var ARC_GLOW = [0.35, 0.12, 0.9];
function drawBolt(r, segs, k = 1, upto = 1, glow = true, core = ARC_CORE, mid = ARC_MID, gl = ARC_GLOW) {
  for (const s of segs) {
    if (s.d > upto) continue;
    const kk = k * (s.w === 0 ? 1 : s.w === 1 ? 0.6 : 0.35);
    if (glow && s.w === 0 && k > 0.3) r.thick(s.x0, s.y0, s.x1, s.y1, 3, gl, kk * 0.5);
    if (s.w === 0 && k > 0.6) r.thick(s.x0, s.y0, s.x1, s.y1, 2, mid, kk * 0.6);
    r.line(s.x0, s.y0, s.x1, s.y1, s.w === 0 ? core : mid, kk);
  }
}
function crackTree(rng, x, y, arms, len, spread = 0.5, step = 3, out = []) {
  const stack = [];
  const a0 = rng.r(0, TAU);
  for (let k = 0; k < arms; k++) stack.push({ x, y, a: a0 + k / arms * TAU + rng.r(-0.4, 0.4), l: len * rng.r(0.6, 1.1), d: 0, g: 0 });
  while (stack.length) {
    const b = stack.pop();
    let cx = b.x, cy = b.y, a = b.a, d = b.d;
    const n = Math.max(1, Math.floor(b.l / step));
    for (let s = 0; s < n; s++) {
      a += rng.r(-spread, spread);
      const nx = cx + Math.cos(a) * step, ny = cy + Math.sin(a) * step;
      d += step / len;
      out.push({ x0: cx, y0: cy, x1: nx, y1: ny, d, gen: b.g });
      cx = nx;
      cy = ny;
      if (b.g < 3 && rng.next() < 0.13) stack.push({ x: cx, y: cy, a: a + rng.sign() * rng.r(0.5, 1.1), l: (b.l - s * step) * rng.r(0.3, 0.6), d, g: b.g + 1 });
    }
  }
  return out;
}
function sparkle(r, x, y, size, c, k = 1) {
  r.px(x, y, c, k * 1.5);
  for (let s = 1; s <= size; s++) {
    const f = k * (1 - s / (size + 1));
    r.px(x + s, y, c, f);
    r.px(x - s, y, c, f);
    r.px(x, y + s, c, f);
    r.px(x, y - s, c, f);
  }
}
var flick = (seed, t, rate = 18) => hash(seed * 31.7 + Math.floor(t * rate));

// src/effects/pyre.ts
var FIRE = [
  [0, 0, 0],
  [0.3, 0.02, 0.03],
  [0.85, 0.07, 0.04],
  [1.6, 0.48, 0.06],
  [2.2, 1.35, 0.3],
  [3, 2.7, 2]
];
var fire = (h, k = 1) => scale(ramp(FIRE, h), k);
var CHAR = [0.03, 0.02, 0.02];
var ASH = [0.35, 0.32, 0.3];
function tongue(r, x, y, h, w, t, seed, heat = 1, k = 1) {
  if (h < 1) return;
  const sw = (noise1(t * 7 + seed * 13) - 0.5) * w * 2.4;
  const sw2 = (noise1(t * 11 + seed * 7) - 0.5) * w;
  const hh = h * (0.75 + 0.5 * noise1(t * 9 + seed * 3));
  const layer = (s, c, kk) => {
    const ww = w * s, H2 = hh * (0.4 + s * 0.6);
    r.poly([x - ww, y, x - ww * 0.8 + sw2 * 0.5, y - H2 * 0.45, x + sw * s, y - H2, x + ww * 0.7 + sw2, y - H2 * 0.5, x + ww, y], c, kk);
  };
  layer(1, fire(0.4 * heat + 0.1), 0.9 * k);
  layer(0.62, fire(0.65 * heat + 0.1), 0.8 * k);
  layer(0.3, fire(0.95 * heat), 0.8 * k);
}
var cinderCrown = {
  id: 1,
  name: "Cinder Crown",
  school: "PYRE",
  duration: 9,
  climax: 4.66,
  blurb: "An unstable crown of embers swallows its own light, then unfolds into remembered solar petals.",
  setup(r) {
    const rng = new RNG(101);
    const frags = [];
    for (let i = 0; i < 11; i++)
      frags.push({
        a0: i / 11 * TAU + rng.r(-0.15, 0.15),
        w: rng.r(0.7, 1.4) * (i % 2 ? 1 : -1) * (i % 5 === 0 ? 4.5 : 1),
        rad: rng.r(28, 38),
        size: rng.r(5, 9),
        fast: i % 5 === 0,
        tail: i % 3 === 1,
        tilt: rng.r(-0.5, 0.5),
        seed: i
      });
    const embers = Array.from({ length: 110 }, (_, i) => ({
      sx: rng.r(-150, 150),
      sy: rng.r(-100, 100),
      slot: rng.r(0, TAU),
      rr: rng.r(10, 44),
      bend: rng.r(-1, 1) * 60,
      d: rng.r(0, 0.5),
      seed: i
    }));
    const petals = [];
    let a = rng.r(0, TAU);
    for (let i = 0; i < 8; i++) {
      a += rng.r(0.5, 1.15);
      petals.push({ a, L: rng.r(55, 150) * (i % 3 === 0 ? 1.15 : 0.85), w: rng.r(0.18, 0.36), curl: rng.r(-0.7, 0.7), seed: i });
    }
    const shards = Array.from({ length: 70 }, (_, i) => ({
      a: rng.r(0, TAU),
      v: rng.r(60, 230),
      kind: i % 3,
      rot: rng.r(0, TAU),
      spin: rng.r(-12, 12),
      size: rng.r(1.5, 4.5),
      shape: shardShape(rng, rng.i(3, 5)),
      delay: rng.r(0, 0.25),
      seed: i
    }));
    const cracks = crackTree(rng, 0, 0, 11, 70, 0.35, 3);
    return { frags, embers, petals, shards, cracks };
  },
  render(r, t, s) {
    const cx = r.target.x, gy = r.target.y + 6, cy = gy - 20;
    const T0 = 3.7, TX = 4.55;
    const build = smooth(0.9, 1.7, t);
    const swallow = inv(T0, TX, t);
    const e = t - TX;
    const fragPos = (f, tt) => {
      const shrink = 1 - easeIn(inv(T0, TX, tt)) * 0.55;
      const accel = tt > T0 ? (tt - T0) * (tt - T0) * 6 * Math.sign(f.w) : 0;
      const ang = f.a0 + f.w * tt + accel;
      const rr = f.rad * shrink * (1 + 0.07 * Math.sin(tt * 3 + f.seed)) * lerp(1.6, 1, build);
      return { x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr * 0.5, z: Math.sin(ang), ang };
    };
    if (t < TX) {
      r.ambient = 0.62 * (1 - easeIn(swallow) * 0.85);
      r.shadow(cx, gy, 40, 14, 0.5 * build);
      r.light(cx, cy, 80, [1.2, 0.5, 0.15], (0.4 + build * 0.8) * (1 - swallow));
    }
    if (t < 2.2) {
      for (const m of s.embers) {
        const u = easeInOut(inv(m.d, m.d + 1.1, t));
        const ang = m.slot + t * 1.5;
        const tx = cx + Math.cos(ang) * m.rr, ty = cy + Math.sin(ang) * m.rr * 0.5;
        const px = lerp(cx + m.sx, tx, u) + Math.sin(u * Math.PI) * m.bend * 0.3;
        const py = lerp(cy + m.sy, ty, u) - Math.sin(u * Math.PI) * m.bend * 0.2;
        const k = (1 - smooth(1.5, 2.2, t)) * (0.5 + flick(m.seed, t) * 0.8);
        r.px(px, py, fire(0.55 + u * 0.4), k * 1.4);
        if (u > 0.05 && u < 0.95) r.px(px - Math.cos(ang) * 1.5, py, fire(0.4), k * 0.6);
      }
    }
    if (t < TX + 0.02) {
      const frs = s.frags.map((f) => ({ f, p: fragPos(f, t) })).sort((a, b) => a.p.z - b.p.z);
      const arch = smooth(1.6, 2.8, t) * (1 - swallow * 0.6);
      if (arch > 0) {
        for (const { f, p } of frs) {
          const n = 14;
          for (let k = 0; k < n; k++) {
            const u = k / n;
            const x = lerp(cx, p.x, u), y = lerp(cy, p.y, u);
            const pul = Math.pow(0.5 + 0.5 * Math.sin(u * 12 - t * 14 + f.seed), 6);
            if ((k + Math.floor(t * 20)) % 3 || pul > 0.5) r.px(x, y, fire(0.5 + pul * 0.5), arch * (0.4 + pul));
          }
        }
        for (let i = 0; i < s.frags.length; i++) {
          const a = fragPos(s.frags[i], t), b = fragPos(s.frags[(i + 2) % s.frags.length], t);
          for (let k = 0; k <= 20; k++) {
            const u = k / 20;
            const x = lerp(a.x, b.x, u), y = lerp(a.y, b.y, u) + Math.sin(u * Math.PI) * 6;
            r.px(x, y, fire(0.6), arch * 0.5 * flick(i * 40 + k, t, 10));
          }
        }
        for (let k = 0; k < 4; k++) {
          const ang = t * (3 + k) * (k % 2 ? -1 : 1) + k * 1.6;
          const rr = 9 + k * 3;
          const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.5;
          r.disc(x, y, 1.6, fire(0.95), arch * 1.5);
          r.glow(x, y, 6, fire(0.7), arch * 0.6);
        }
      }
      for (const { f, p } of frs) {
        const depthK = 0.55 + 0.45 * (p.z * 0.5 + 0.5);
        const sz = f.size * build;
        if (sz < 0.5) continue;
        if (f.fast && t < T0) {
          for (let k = 0; k < 26; k++) {
            const q = fragPos(f, t - k * 8e-3);
            const kk = (1 - k / 26) * build;
            r.px(q.x, q.y - sz * 0.5, fire(0.9), kk * 1.4 * depthK);
            if (k % 4 === 0) r.px(q.x, q.y - sz * 0.5 - 1, fire(0.7), kk * 0.8);
          }
        }
        if (f.tail) {
          for (let k = 1; k < 18; k++) {
            const q = fragPos(f, t - k * 0.025);
            r.disc(q.x, q.y - 2 + k * 0.4, Math.max(0.5, 2.2 - k * 0.12), fire(0.75 - k * 0.03), (1 - k / 18) * build * depthK);
          }
        }
        const tilt = f.tilt + Math.sin(t * 5 + f.seed) * 0.15;
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        const P = (lx, ly) => [p.x + lx * ct - ly * st, p.y + lx * st + ly * ct];
        const pts = [...P(-sz * 0.55, 0), ...P(-sz * 0.6, -sz * 0.5), ...P(-sz * 0.2, -sz * 0.75), ...P(0, -sz * 1.5), ...P(sz * 0.25, -sz * 0.8), ...P(sz * 0.6, -sz * 0.55), ...P(sz * 0.5, 0)];
        if (swallow > 0) {
          const ink = smooth(0, 0.7, swallow);
          r.poly(pts, mixDark(fire(0.75), ink), 1, SET);
          r.polyline(pts, [3, 2.6, 2.2], 0.5 + swallow * 3, ADD, true);
        } else {
          r.poly(pts, fire(0.45), 1 * depthK);
          const inner = [...P(-sz * 0.3, -sz * 0.1), ...P(0, -sz * 1.1), ...P(sz * 0.25, -sz * 0.1)];
          r.poly(inner, fire(0.85 + 0.15 * flick(f.seed, t)), 1.1 * depthK);
          r.polyline(pts, fire(0.7), 0.7 * depthK, ADD, true);
        }
      }
      if (swallow > 0) {
        for (let k = 0; k < 70; k++) {
          const ph = (hash(k) + t * 1.8) % 1;
          const a = hash(k + 9) * TAU;
          const rr = (1 - ph * ph) * 60 * (1 - swallow * 0.3);
          r.px(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.5, fire(0.8), 0.6 + ph);
        }
        const core = 3 * (1 - swallow) + 0.6;
        r.disc(cx, cy, core, [3, 3, 3], 3);
        r.glow(cx, cy, 10 + swallow * 8, [2, 1.6, 1.2], swallow * 1.5);
      }
    }
    if (e >= 0) {
      r.flash = Math.max(0, 0.9 - e * 9);
      r.flashCol = [1.2, 0.9, 0.7];
      if (e < 0.5) {
        r.shakeX = (hash(t * 99) - 0.5) * 8 * (1 - e * 2);
        r.shakeY = (hash(t * 77) - 0.5) * 6 * (1 - e * 2);
      }
      r.ambient = lerp(0.12, 0.62, smooth(0.2, 3, e));
      const heat = Math.exp(-e * 1.1);
      r.light(cx, cy, 170, [1.4, 0.6, 0.2], 2.2 * heat);
      for (const c of s.cracks) {
        if (c.d > e * 3) continue;
        r.decalLine(cx + c.x0, gy + c.y0 * 0.6, cx + c.x1, gy + c.y1 * 0.6, CHAR, 0.8);
        const g = Math.exp(-e * 1.4) * (1 - c.d * 0.6);
        if (g > 0.05) r.line(cx + c.x0, gy + c.y0 * 0.6, cx + c.x1, gy + c.y1 * 0.6, fire(0.4 + g * 0.6), g * 1.4);
      }
      r.decalDisc(cx, gy, 16, CHAR, 0.7, 0.3);
      for (const p of s.petals) {
        const grow = easeOutExpo(e / 0.45);
        for (let layer = 0; layer < 4; layer++) {
          const peel = Math.max(0, e - 0.25 - layer * 0.18) * (30 + layer * 25) * (layer % 2 ? 1 : 0.6);
          const fade = clamp(1 - Math.max(0, e - 0.6 - layer * 0.35) * 0.9);
          if (fade <= 0) continue;
          const wS = [1, 0.75, 0.5, 0.25][layer], lS = [1, 0.9, 0.75, 0.55][layer];
          const L = p.L * grow * lS;
          const pts = [];
          const side = (sgn) => {
            for (let k = 0; k <= 12; k++) {
              const u = sgn > 0 ? k / 12 : 1 - k / 12;
              const half = p.w * wS * Math.sin(Math.PI * Math.pow(u, 0.6)) * (1 - u * 0.35);
              const jag = (noise1(u * 9 + p.seed * 5 + e * 3 + layer) - 0.5) * 0.18;
              const a = p.a + p.curl * u * u * (0.4 + e) + sgn * (half + jag * wS);
              const rr = 4 + u * L + peel;
              pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.72);
            }
          };
          side(1);
          side(-1);
          const h = clamp(heat * (0.5 + layer * 0.2) + 0.15);
          r.poly(pts, fire(h * 0.85), (layer === 0 ? 0.75 : 0.45) * fade, layer === 0 ? SET : ADD);
        }
      }
      for (const sh of s.shards) {
        const ee = e - sh.delay;
        if (ee < 0) continue;
        let x, y, k = 1;
        if (sh.kind === 0) {
          x = cx + Math.cos(sh.a) * fly(0, sh.v, 2.2, 0, ee);
          y = cy + Math.sin(sh.a) * fly(0, sh.v, 2.2, 0, ee) * 0.72 + fly(0, -20, 0, 70, ee);
          k = clamp(1.8 - ee * 0.7);
        } else if (sh.kind === 1) {
          const ang = sh.a + ee * 2.6 * (sh.seed % 2 ? 1 : -1);
          const rr = Math.sin(clamp(ee / 1.6) * Math.PI) * sh.v * 0.55;
          x = cx + Math.cos(ang) * rr;
          y = cy + Math.sin(ang) * rr * 0.72;
          k = clamp(2 - ee);
        } else {
          const rr = fly(0, sh.v * 0.8, 6, 0, ee);
          x = cx + Math.cos(sh.a) * rr;
          y = cy + Math.sin(sh.a) * rr * 0.72;
          const dis = inv(1 + sh.seed % 7 * 0.12, 2 + sh.seed % 7 * 0.12, ee);
          if (dis > 0) {
            for (let q = 0; q < 6; q++) {
              const ax = x + (hash(sh.seed * 7 + q) - 0.5) * 10 * dis + Math.sin(ee * 3 + q) * 2;
              const ay = y - dis * (8 + q * 4);
              r.px(ax, ay, dis < 0.3 ? fire(0.5) : ASH, (1 - dis) * 0.8);
            }
            k = 1 - dis;
          }
        }
        if (k <= 0) continue;
        const pts = shardPts(sh.shape, x, y, sh.size, sh.rot + sh.spin * ee);
        r.poly(pts, fire(clamp(heat + 0.3)), k);
        r.px(x, y, fire(1), k * 0.8);
      }
      const mem = pulse(0.35, 3.2, e);
      if (mem > 0) {
        for (const f of s.frags) {
          const p = fragPos(f, TX);
          const rr = 1 + e * 0.35;
          const x = cx + (p.x - cx) * rr * 1.8, y = cy + (p.y - cy) * rr * 1.8;
          const sz = f.size * 1.2;
          const pts = [x - sz * 0.55, y, x - sz * 0.6, y - sz * 0.5, x - sz * 0.2, y - sz * 0.75, x, y - sz * 1.5, x + sz * 0.25, y - sz * 0.8, x + sz * 0.6, y - sz * 0.55, x + sz * 0.5, y];
          if (flick(f.seed, t, 12) > 0.25) r.polyline(pts, fire(0.75), mem * 1.1, ADD, true);
        }
        r.ring(cx, cy, 34 * 1.8 * (1 + e * 0.35), 1, fire(0.6), mem * 0.4, ADD, 0.5);
      }
      for (let k = 0; k < 40; k++) {
        const st = 0.3 + hash(k) * 3;
        const ee2 = e - st;
        if (ee2 < 0 || ee2 > 2.5) continue;
        const x = cx + (hash(k + 1) - 0.5) * 140 + Math.sin(ee2 * 2 + k) * 6;
        const y = cy + (hash(k + 2) - 0.5) * 60 - ee2 * 22;
        r.px(x, y, fire(0.7), (1 - ee2 / 2.5) * flick(k, t) * 1.5);
      }
    }
  }
};
function mixDark(c, ink) {
  return [c[0] * (1 - ink) * 0.4, c[1] * (1 - ink) * 0.4, c[2] * (1 - ink) * 0.4];
}
var furnaceWyrm = {
  id: 2,
  name: "Furnace Wyrm",
  school: "PYRE",
  duration: 7.6,
  climax: 5.12,
  blurb: "A serpent assembled from delayed time: every segment is the head, a moment ago.",
  setup(r) {
    const rng = new RNG(202);
    const C = r.caster, T = r.target;
    const orbit = (tt) => {
      const u = tt - 2.1;
      const ang = 2.6 + u * 3.1;
      const rad = 50 - u * 5 + Math.sin(u * 5) * 4;
      return { x: T.x + Math.cos(ang) * rad, y: T.y + Math.sin(ang) * rad * 0.62, z: 16 + Math.sin(ang * 1 + 1) * 11 };
    };
    const o0 = orbit(2.1);
    const ctrl = [
      { x: C.x + 4, y: C.y + 6 },
      { x: C.x - 6, y: C.y - 20 },
      { x: C.x - 30, y: C.y - 62 },
      { x: C.x + 30, y: C.y - 92 },
      { x: C.x + 90, y: C.y - 40 },
      { x: C.x + 70, y: C.y + 30 },
      { x: (C.x + T.x) / 2 + 30, y: T.y + 60 },
      { x: o0.x, y: o0.y }
    ];
    const head = (tt) => {
      if (tt < 0.55) return { x: C.x + 4, y: C.y + 6, z: -4 };
      if (tt < 2.1) {
        const u = (tt - 0.55) / 1.55;
        const p = catmull(ctrl, easeInOut(u) * 0.85 + u * 0.15);
        return { x: p.x, y: p.y, z: Math.min(16, (tt - 0.55) * 40) + Math.sin(u * 9) * 4 };
      }
      if (tt < 4.45) return orbit(tt);
      const o = orbit(4.45);
      const back = easeOut(inv(4.45, 4.8, tt));
      const strike = easeIn(inv(4.8, 4.98, tt));
      const dx = o.x - T.x, dy = o.y - T.y;
      const bx = T.x + dx * (1 + back * 0.6), by = T.y + dy * (1 + back * 0.6) - back * 10;
      return { x: lerp(bx, T.x, strike), y: lerp(by, T.y, strike), z: lerp(o.z + back * 22, 0, strike) };
    };
    const cracks = crackTree(rng, 0, 0, 9, 80, 0.4, 3);
    const debris = Array.from({ length: 60 }, (_, i) => ({ a: rng.r(0, TAU), v: rng.r(30, 170), vz: rng.r(60, 190), s: rng.r(0.5, 2.2), seed: i }));
    return { head, cracks, debris };
  },
  render(r, t, s) {
    const T = r.target, C = r.caster;
    const NSEG = 48;
    const contract = smooth(4.78, 4.98, t);
    const lag = 0.029 * (1 - contract * 0.96);
    const TI = 4.98, e = t - TI;
    const cr = easeOut(t / 0.55);
    if (t < 6) {
      const k = (t < 0.6 ? 1 : 0.4) * (1 - smooth(4, 6, t));
      r.line(C.x - 14 * cr, C.y + 7, C.x + 18 * cr, C.y + 5, fire(0.85), 1.6 * k);
      r.line(C.x - 10 * cr, C.y + 8, C.x + 12 * cr, C.y + 6, fire(0.5), 0.8 * k);
      r.decalLine(C.x - 14 * cr, C.y + 7, C.x + 18 * cr, C.y + 5, CHAR, 0.9);
      r.light(C.x, C.y + 6, 30, [1.3, 0.5, 0.1], 0.8 * k * cr);
    }
    if (t >= 0.5 && t < TI + 0.02) {
      const segs = [];
      for (let i = 0; i < NSEG; i++) {
        const tt = t - i * lag;
        if (tt < 0.55) break;
        const p = s.head(tt), q = s.head(tt - 0.02);
        const spd = Math.hypot(p.x - q.x, p.y - q.y) / 0.02;
        segs.push({ ...p, i, spd, tt, dir: Math.atan2(p.y - q.y - (p.z - q.z), p.x - q.x) });
      }
      for (let k = 0; k < segs.length; k += 3) {
        const g = segs[k];
        r.shadow(g.x, g.y + 2, 5, 2.5, 0.35);
        if (k % 9 === 0) r.light(g.x, g.y - g.z * 0.5, 46, [1.3, 0.45, 0.1], 0.5);
      }
      const order = segs.slice().sort((a, b) => a.z - b.z || a.y - b.y);
      for (const g of order) {
        const n = segs[g.i + 1];
        const taper = 1 - g.i / NSEG;
        const stretch = clamp(g.spd / 260);
        const w = (2.2 + 4.5 * taper) * (1 - 0.45 * stretch) * (1 + contract * 0.6);
        const depthK = 0.75 + clamp(g.z / 30) * 0.35;
        if (n) r.thick(g.x, g.y - g.z, n.x, n.y - n.z, w * 1.5, fire((0.42 + stretch * 0.25) * depthK), 1, SET);
        r.disc(g.x, g.y - g.z, w, fire(0.38 * depthK + 0.05), 1, SET);
        r.disc(g.x, g.y - g.z, w * 0.5, fire((0.62 + (1 - stretch) * 0.2 * flick(g.i, t, 14)) * depthK), 1, SET);
        if (g.i % 4 === 0) r.px(g.x - 1, g.y - g.z - w * 0.5, fire(0.95), 1, SET);
        if (g.i % 2 === 0 && g.i > 1) {
          const ca = Math.cos(g.dir), sa = Math.sin(g.dir);
          const bx = g.x - ca * w * 0.4, by = g.y - g.z - sa * w * 0.4;
          r.line(bx, by, bx - ca * w + -sa * w, by - sa * w + ca * w, fire(0.8 * depthK), 1, SET);
          r.line(bx, by, bx - ca * w - -sa * w, by - sa * w - ca * w, fire(0.8 * depthK), 1, SET);
        }
        if (g.i % 3 === 1) tongue(r, g.x, g.y - g.z - w * 0.4, w * 2.2 * (1 - stretch * 0.5), w * 0.7, t, g.i, 0.8, 0.35);
      }
      for (let k = 0; k < 70; k++) {
        const st = 0.7 + k * 0.06;
        const u = (t - st) / 0.7;
        if (u < 0 || u > 1 || st > TI) continue;
        const j = k * 7 % NSEG;
        const o = s.head(st - j * 0.029);
        const a = hash(k) * TAU;
        for (let m = 0; m < 6; m++) {
          const uu = Math.max(0, u - m * 0.025);
          const px = o.x + Math.cos(a) * uu * 36 - Math.sin(a) * Math.sin(uu * 14) * 3;
          const py = o.y - o.z + Math.sin(a) * uu * 22 + Math.cos(a) * Math.sin(uu * 14) * 3 - uu * 16;
          r.px(px, py, fire(0.9 - m * 0.08), (1 - u) * (1 - m / 6) * 1.6);
        }
      }
      const h0 = segs[0];
      if (h0) {
        const hx = h0.x, hy = h0.y - h0.z;
        const a = h0.dir, ca = Math.cos(a), sa = Math.sin(a);
        const maw = smooth(4.45, 4.85, t);
        const jaw = 0.35 + 0.25 * Math.sin(t * 9) + maw * 0.6;
        const L = 9 + maw * 5;
        const P = (lx, ly) => [hx + lx * ca - ly * sa, hy + lx * sa + ly * ca];
        if (maw > 0) {
          for (let k = 0; k < 11; k++) {
            const ang = a + k / 11 * TAU;
            const len = (10 + k % 2 * 8) * maw * (1 + 0.2 * Math.sin(t * 30 + k));
            const bx = hx + Math.cos(ang) * 5, by = hy + Math.sin(ang) * 5;
            r.poly([bx + Math.cos(ang + 1.5) * 2.5, by + Math.sin(ang + 1.5) * 2.5, hx + Math.cos(ang) * (5 + len), hy + Math.sin(ang) * (5 + len), bx - Math.cos(ang + 1.5) * 2.5, by - Math.sin(ang + 1.5) * 2.5], fire(0.9), 1.2);
          }
          r.glow(hx, hy, 26 * maw, [2.5, 1.4, 0.5], maw * 1.5);
          r.disc(hx, hy, 4 * maw, CHAR, 1, SET);
          r.ring(hx, hy, 4 * maw, 1, [3, 2.6, 2], 2);
        }
        r.poly([...P(-3, -5), ...P(L, -jaw * 7 - 1), ...P(L * 0.7, -1), ...P(-1, 0)], fire(0.55), 1, SET);
        r.poly([...P(-3, 5), ...P(L, jaw * 7 + 1), ...P(L * 0.7, 1), ...P(-1, 0)], fire(0.55), 1, SET);
        r.disc(hx, hy, 4.5, fire(0.42), 1, SET);
        r.disc(hx + Math.cos(a) * 2, hy + Math.sin(a) * 2, 2, fire(0.7), 1, SET);
        r.line(...P(-2, -4), ...P(-11, -9), fire(0.95), 1.4);
        r.line(...P(-2, 4), ...P(-11, 9), fire(0.95), 1.4);
        const ey = P(2, -2.5), ey2 = P(2, 2.5);
        r.px(ey[0], ey[1], [3, 3, 3], 2, SET);
        r.px(ey2[0], ey2[1], [3, 3, 3], 2, SET);
        r.light(hx, hy, 60, [1.4, 0.6, 0.15], 1);
      }
    }
    if (e >= 0) {
      r.flash = Math.max(0, 0.7 - e * 8);
      r.flashCol = [1.2, 0.7, 0.4];
      if (e < 0.4) {
        r.shakeX = (hash(t * 91) - 0.5) * 7 * (1 - e / 0.4);
        r.shakeY = (hash(t * 37) - 0.5) * 7 * (1 - e / 0.4);
      }
      const heat = Math.exp(-e * 0.9);
      r.light(T.x, T.y, 150, [1.4, 0.55, 0.15], 2.2 * heat);
      r.decalDisc(T.x, T.y, 14, CHAR, 0.8, 0.4);
      for (const c of s.cracks) {
        if (c.d > e * 4) continue;
        const x0 = T.x + c.x0, y0 = T.y + c.y0 * 0.6, x1 = T.x + c.x1, y1 = T.y + c.y1 * 0.6;
        r.decalLine(x0, y0, x1, y1, CHAR, 0.9);
        const g = clamp(heat * 1.4 - c.d * 0.5 + 0.2 * Math.sin(e * 6 + c.d * 20));
        if (g > 0.03) {
          r.line(x0, y0, x1, y1, fire(0.3 + g * 0.7), 1.2 * g + 0.2);
          if (c.gen === 0 && g > 0.4) r.line(x0, y0 - 1, x1, y1 - 1, fire(0.45), 0.5 * g);
        }
      }
      const burst = 1 - smooth(0, 1.4, e);
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * TAU + 0.3;
        const rr = 6 + easeOut(e / 0.4) * (16 + k % 3 * 8);
        tongue(r, T.x + Math.cos(a) * rr, T.y + Math.sin(a) * rr * 0.6, (20 + k % 4 * 6) * burst, 4 * burst + 0.5, t, k, burst + 0.2, burst * 0.55);
      }
      for (const d of s.debris) {
        const tb = 2 * d.vz / 320;
        let z, ee = e;
        if (ee < tb) z = d.vz * ee - 160 * ee * ee;
        else {
          const e2 = ee - tb;
          z = Math.max(0, d.vz * 0.3 * e2 - 160 * e2 * e2);
        }
        const gx = T.x + Math.cos(d.a) * fly(0, d.v, 1.2, 0, ee), gy = T.y + Math.sin(d.a) * fly(0, d.v, 1.2, 0, ee) * 0.6;
        const k = clamp(1.6 - e * 0.45);
        if (k <= 0) continue;
        r.disc(gx, gy - z, d.s, fire(clamp(heat + 0.35)), k * 1.3);
        if (ee > tb) r.decal(gx, gy, [0.25, 0.04, 0.02], 0.8);
        r.px(gx, gy, [0, 0, 0], 0, ADD);
      }
      if (e < 0.5) r.ring(T.x, T.y, easeOut(e / 0.5) * 70, 2, fire(0.8), (1 - e / 0.5) * 1.5, ADD, 0.62);
    }
  },
  post(r, t, s) {
    const e = t - 4.98;
    let cx = 0, cy = 0, rad = 0, amp = 0;
    if (e > 0) {
      cx = r.target.x;
      cy = r.target.y - 10;
      rad = 60;
      amp = 1.6 * Math.exp(-e * 0.6);
    } else if (t > 0.6) {
      const h = s.head(t);
      cx = h.x;
      cy = h.y - h.z - 10;
      rad = 22;
      amp = 1;
    }
    if (amp > 0.1)
      r.warp(cx - rad, cy - rad, cx + rad, cy + rad, (x, y, o) => {
        const d = Math.hypot(x - cx, y - cy) / rad;
        if (d > 1) return;
        o[0] = x + Math.sin(y * 0.7 + t * 24) * amp * (1 - d);
        o[1] = y + Math.cos(x * 0.5 + t * 17) * amp * 0.5 * (1 - d);
      });
  }
};
var meteorLoom = {
  id: 3,
  name: "Meteor Loom",
  school: "PYRE",
  duration: 10,
  climax: 7.25,
  blurb: "Burning threads woven across an unseen sky; the scars were a sigil all along.",
  setup(r) {
    const rng = new RNG(303);
    const C = { x: W / 2 + 16, y: H / 2 + 4 };
    const verts = [];
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + k / 7 * TAU;
      verts.push({ x: C.x + Math.cos(a) * 92, y: C.y + Math.sin(a) * 66 });
    }
    const mk = (vi, ti, tt, dir, kind, size) => ({
      P: vi < 0 ? C : verts[vi],
      ti,
      tt,
      D: { x: Math.cos(dir) * 230, y: Math.sin(dir) * 90 },
      z0: 230,
      kind,
      size,
      shape: shardShape(rng, rng.i(5, 7), 0.5),
      spin: rng.r(-4, 4),
      seed: rng.i(0, 999)
    });
    const mets = [
      mk(0, 1.7, 1.6, Math.PI + 0.3, 0, 7),
      mk(3, 2.35, 0.55, -0.4, 2, 5),
      mk(6, 3.2, 1, Math.PI * 1.25, 1, 4),
      mk(2, 3.35, 1.1, Math.PI * 1.25, 0, 4),
      mk(5, 3.5, 1.2, Math.PI * 1.25, 1, 4),
      mk(1, 4.3, 0.8, 0.2, 2, 5),
      mk(4, 4.95, 1.3, Math.PI - 0.6, 1, 6),
      mk(-1, 5.9, 1.4, Math.PI * 1.5 + 0.2, 1, 9)
    ];
    mets[2].split = [3, 4];
    const cracks = mets.map((m, i) => crackTree(rng, 0, 0, 5 + i % 3, 34 + m.size * 2, 0.45, 3));
    const debris = mets.map(() => Array.from({ length: 16 }, () => ({ a: rng.r(0, TAU), v: rng.r(20, 90), vz: rng.r(40, 150), s: rng.r(0.6, 2) })));
    return { C, verts, mets, cracks, debris };
  },
  render(r, t, s) {
    const mets = s.mets;
    const posAt = (m, u) => {
      const gx = m.P.x + m.D.x * (1 - u), gy = m.P.y + m.D.y * (1 - u);
      const z = m.z0 * Math.pow(1 - u, 1.35);
      return { gx, gy, x: gx, y: gy - z * 0.8, z };
    };
    r.ambient = 0.5;
    const SIG = 6.45;
    for (let i = 0; i < mets.length; i++) {
      const m = mets[i];
      const e = t - m.ti;
      if (e < 0) continue;
      let g = Math.exp(-e * 1.3) * 1.3;
      for (let j = 0; j < mets.length; j++) {
        if (j === i) continue;
        const ej = t - mets[j].ti;
        const d = Math.hypot(mets[j].P.x - m.P.x, mets[j].P.y - m.P.y);
        const arr = ej - d / 170;
        if (arr > 0) g += Math.exp(-arr * 2.2) * Math.exp(-d / 95) * 1.4;
      }
      g += pulse(SIG, SIG + 2.2, t) * 0.8;
      const fade = 1 - smooth(8, 10, t) * 0.7;
      g *= fade;
      r.decalDisc(m.P.x, m.P.y, 6 + m.size * 0.8, CHAR, 0.85, 0.35);
      for (const c of s.cracks[i]) {
        if (c.d > e * 3.2) continue;
        const x0 = m.P.x + c.x0, y0 = m.P.y + c.y0 * 0.7, x1 = m.P.x + c.x1, y1 = m.P.y + c.y1 * 0.7;
        r.decalLine(x0, y0, x1, y1, CHAR, 0.9);
        const gg = clamp(g * (1.1 - c.d * 0.7));
        if (gg > 0.04) r.line(x0, y0, x1, y1, fire(0.3 + gg * 0.65), 0.4 + gg);
      }
      r.disc(m.P.x, m.P.y, 3 + m.size * 0.4, fire(0.35 + clamp(g) * 0.6), clamp(g) + 0.15);
      r.light(m.P.x, m.P.y, 50 + m.size * 6, [1.4, 0.5, 0.12], clamp(g) * 1.2);
      if (e < 0.3) {
        r.glow(m.P.x, m.P.y, 40 + m.size * 3, [2.4, 1.6, 0.8], (1 - e / 0.3) * 1.6);
        r.flash = Math.max(r.flash, (0.6 + m.size * 0.06) * (1 - e / 0.12));
        r.shakeX += (hash(t * 50 + i) - 0.5) * m.size * (1 - e / 0.3);
        r.shakeY += (hash(t * 70 + i) - 0.5) * m.size * (1 - e / 0.3);
        r.ring(m.P.x, m.P.y, easeOut(e / 0.3) * (40 + m.size * 5), 1.5, fire(0.8), 1 - e / 0.3, ADD, 0.7);
      }
      for (let k = 0; k < 9; k++) {
        const a = hash(i * 20 + k) * TAU;
        const rr = easeOut(e / 1.8) * (14 + hash(k + i) * 18);
        const x = m.P.x + Math.cos(a) * rr, y = m.P.y + Math.sin(a) * rr * 0.6 - e * 8;
        const life = clamp(1 - e / 2.6);
        if (life <= 0) continue;
        r.disc(x, y, 3 + e * 4, e < 0.5 ? fire(0.6) : [0.12, 0.09, 0.08], life * 0.6, e < 0.5 ? ADD : DITHER);
      }
      for (const d of s.debris[i]) {
        const z = Math.max(0, d.vz * e - 170 * e * e);
        const gx = m.P.x + Math.cos(d.a) * fly(0, d.v, 1.5, 0, e), gy = m.P.y + Math.sin(d.a) * fly(0, d.v, 1.5, 0, e) * 0.65;
        if (z <= 0 && e > 0.3) {
          r.decal(gx, gy, [0.1, 0.05, 0.04]);
          continue;
        }
        r.disc(gx, gy - z, d.s, [0.15, 0.08, 0.06], 1, SET);
        r.px(gx, gy - z - 1, fire(0.8), 1.2 * Math.exp(-e));
      }
    }
    if (t > SIG) {
      const V6 = s.verts;
      const bright = pulse(SIG, SIG + 2.6, t);
      const cool = smooth(SIG + 1.4, 10, t);
      for (let k = 0; k < 7; k++) {
        const a = V6[k], b = V6[(k + 3) % 7];
        const p = easeInOut((t - SIG - k * 0.06) / 0.55);
        if (p <= 0) continue;
        const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
        for (let q = 0; q <= n * p; q++) {
          const u = q / n;
          const j = (noise1(u * 18 + k * 7) - 0.5) * 3;
          const x = a.x + dx * u + -dy / L * j, y = a.y + dy * u + dx / L * j;
          r.decal(x, y, CHAR, 0.9);
          r.decal(x, y + 1, CHAR, 0.5);
          const head = Math.exp(-Math.abs(u - p) * 20) * (p < 1 ? 1 : 0);
          r.px(x, y, fire(0.55 + bright * 0.45 - cool * 0.3 + head * 0.3), 0.5 + bright * 1.3 + head * 2);
          if (bright > 0.4) r.px(x, y - 1, fire(0.5), bright * 0.6);
        }
        if (k % 2 === 0) r.light((a.x + b.x) / 2, (a.y + b.y) / 2, 70, [1.3, 0.5, 0.15], bright * 0.8);
      }
      const rp = easeInOut((t - SIG - 0.3) / 0.8);
      const C = s.C;
      for (let q = 0; q < 700 * rp; q++) {
        const a = -Math.PI / 2 + q / 700 * TAU;
        const x = C.x + Math.cos(a) * 100, y = C.y + Math.sin(a) * 73;
        r.decal(x, y, CHAR, 0.8);
        r.px(x, y, fire(0.6 + bright * 0.35 - cool * 0.3), 0.4 + bright * 1.2);
      }
      r.light(C.x, C.y, 160, [1.2, 0.45, 0.12], bright * 1.4);
      if (t < SIG + 0.6) r.flash = Math.max(r.flash, pulse(SIG + 0.45, SIG + 0.75, t) * 0.8);
    }
    for (let i = 0; i < mets.length; i++) {
      const m = mets[i];
      let start = m.ti - m.tt;
      if (m.split) start = m.ti - m.tt;
      const parent = mets.findIndex((p2) => p2.split && p2.split.includes(i));
      let u = (t - start) / m.tt;
      if (u < 0 || u >= 1) continue;
      if (parent >= 0) {
        const pm = mets[parent];
        const pu = (t - (pm.ti - pm.tt)) / pm.tt;
        if (pu < 0.55) continue;
      }
      if (m.split && u > 0.55) {
        if (u < 0.6) r.glow(posAt(m, u).x, posAt(m, u).y, 14, [2, 1.2, 0.5], 1.5);
      }
      const p = posAt(m, u);
      r.shadow(p.gx, p.gy, 3 + p.z * 0.07, 1.5 + p.z * 0.035, 0.25 + u * 0.6);
      r.light(p.gx, p.gy, 30 + p.z * 0.15, [1.4, 0.6, 0.2], 0.3 + u * 0.9);
      r.light(p.x, p.y, 40, [1.4, 0.6, 0.2], 0.5);
      for (let k = 18; k >= 1; k--) {
        const q = posAt(m, Math.max(0, u - k * 0.011 * (m.kind === 2 ? 1.6 : 1)));
        const w = m.size * (1 - k / 20) * (m.kind === 2 ? 0.8 : 0.6);
        r.disc(q.x, q.y, w, fire(0.95 - k * 0.035), 0.5);
      }
      for (let k = 0; k < 10; k++) {
        const us = k * 0.09 + 0.05;
        if (us > u) break;
        const q0 = posAt(m, us), q1 = posAt(m, us + 0.01);
        const vx2 = (q1.x - q0.x) * 30 + (hash(m.seed + k) - 0.5) * 40, vy2 = (q1.y - q0.y) * 30 + (hash(m.seed + k + 50) - 0.5) * 30;
        const ee = (u - us) * m.tt;
        if (ee > 0.9) continue;
        const x = fly(q0.x, vx2, 1.5, 0, ee), y = fly(q0.y, vy2, 1.5, 90, ee);
        r.px(x, y, fire(0.8 - ee * 0.5), (1 - ee / 0.9) * 1.6);
      }
      const rot = m.spin * t;
      const vx = posAt(m, Math.min(1, u + 0.01)).x - p.x, vy = posAt(m, Math.min(1, u + 0.01)).y - p.y;
      const va = Math.atan2(vy, vx);
      if (m.kind === 2) {
        const ca = Math.cos(va), sa = Math.sin(va), sz = m.size;
        const pts = [];
        for (let k = 0; k < 10; k++) {
          const a = k / 10 * TAU;
          const lx = Math.cos(a) * sz * (Math.cos(a) < 0 ? 3.2 : 1.1) * (1 + (hash(m.seed + k) - 0.5) * 0.4);
          const ly = Math.sin(a) * sz * 0.8;
          pts.push(p.x + lx * ca - ly * sa, p.y + lx * sa + ly * ca);
        }
        r.poly(pts, fire(0.75), 1.2);
        r.disc(p.x, p.y, sz * 0.5, fire(1), 1.5);
      } else {
        const pts = shardPts(m.shape, p.x, p.y, m.size, rot);
        if (m.kind === 0) {
          r.poly(pts, [0.07, 0.03, 0.06], 1, SET);
          r.polyline(pts, fire(0.8), 1.2, ADD, true);
          for (let k = 0; k < 3; k++) {
            const a = rot * 1.3 + k * 2.1;
            r.line(p.x, p.y, p.x + Math.cos(a) * m.size * 0.8, p.y + Math.sin(a) * m.size * 0.8, fire(0.95), 1.2);
          }
        } else {
          r.poly(pts, fire(1), 1.4);
          const rind = shardPts(m.shape, p.x, p.y, m.size, rot);
          for (let k = 0; k < rind.length; k += 4) r.disc(rind[k], rind[k + 1], m.size * 0.35, [0.1, 0.04, 0.03], 1, SET);
        }
        r.glow(p.x, p.y, m.size * 3, fire(0.7), 0.8);
      }
    }
  },
  post(r, t, s) {
    for (const m of s.mets) {
      const e = t - m.ti;
      if (e < 0 || e > 0.8) continue;
      const R = e * 150, amp = 3 * (1 - e / 0.8);
      r.warp(m.P.x - R - 6, m.P.y - R - 6, m.P.x + R + 6, m.P.y + R + 6, (x, y, o) => {
        const dx = x - m.P.x, dy = (y - m.P.y) / 0.7, d = Math.hypot(dx, dy);
        const k = Math.exp(-Math.pow((d - R) / 5, 2)) * amp;
        if (k < 0.3) return;
        o[0] = x - dx / (d || 1) * k;
        o[1] = y - dy / (d || 1) * k * 0.7;
      });
    }
  }
};
var ashenGuillotine = {
  id: 4,
  name: "Ashen Guillotine",
  school: "PYRE",
  duration: 9,
  climax: 4.75,
  blurb: "A slab of compressed combustion falls in one frame. The explosion arrives late, stratum by stratum.",
  setup(r) {
    const rng = new RNG(404);
    const P = { x: r.target.x - 20, y: r.target.y + 40 };
    const ang = -0.17;
    const dir = { x: Math.cos(ang), y: Math.sin(ang) };
    const nrm = { x: -dir.y, y: dir.x };
    const NS = 16;
    const sections = Array.from({ length: NS }, (_, k) => ({ to: 3.95 + rng.r(0, 1.25) + (k === 7 ? -0.2 : 0), w: rng.r(6, 12), jag: Array.from({ length: 6 }, () => rng.r(-1, 1)) }));
    const embers = Array.from({ length: 90 }, (_, i) => ({ x: rng.r(0, W), y: rng.r(0, H), vx: rng.r(-6, 6), vy: rng.r(-10, -3), seed: i, d: rng.r(0.4, 1.4) }));
    const gaps = Array.from({ length: 7 }, () => ({ y: rng.r(0.08, 0.92), x: rng.r(-0.4, 0.4), l: rng.r(0.04, 0.12), w: rng.r(2, 5) }));
    const veins = sections.map((sec, k) => {
      const out = [];
      if (k % 2) return out;
      return crackTree(rng, 0, 0, 2, 26, 0.5, 3, out);
    });
    return { P, ang, dir, nrm, sections, embers, gaps, veins, NS };
  },
  render(r, t, s) {
    const { P, dir, nrm } = s;
    const sx = P.x, top = P.y - 150;
    const TF = 3.3, TL = 3.36;
    const dark = smooth(0.2, 1.6, t) * (1 - smooth(5.5, 8.5, t));
    r.ambient = 0.62 - dark * 0.45;
    for (const m of s.embers) {
      const align = easeInOut(inv(0.5, 0.5 + m.d, t));
      const dx = m.x + m.vx * t, dy = ((m.y + m.vy * t) % H + H) % H;
      const tx = sx + (hash(m.seed) - 0.5) * 6;
      let x = lerp(dx, tx, align * 0.85), y = dy;
      if (t > TF) {
        const e = t - TF;
        x = lerp(dx, tx, 0.85 * Math.exp(-e * 2)) + (hash(m.seed + 3) - 0.5) * e * 40;
        y = dy + e * 30;
      }
      const k = (0.4 + 0.6 * flick(m.seed, t)) * (1 - smooth(TF, TF + 2, t));
      r.px(x, y, fire(0.65 + align * 0.3), k * (0.7 + align));
      if (align > 0.3 && align < 0.95) r.px(x, y - 1, fire(0.5), k * 0.5);
    }
    if (t < TL) {
      const L = easeOut(t / 1.3) * 150;
      const k = 0.8 + smooth(1.4, 3.2, t) * 1.5;
      r.line(sx, P.y - L, sx, P.y, [2.6, 2.3, 1.9], k);
      r.line(sx - 1, P.y - L, sx - 1, P.y, fire(0.6), 0.3 * k);
      r.line(sx + 1, P.y - L, sx + 1, P.y, fire(0.6), 0.3 * k);
      r.light(sx, P.y - L / 2, 50, [1.2, 0.8, 0.5], 0.4 * k);
      const a = smooth(1.5, 3, t);
      if (a > 0) {
        const tremble = Math.sin(t * 60) * 0.4 * smooth(2.6, 3.3, t);
        const bw = 40, x0 = sx - bw / 2 + tremble;
        for (let y = Math.floor(top); y < P.y; y++) {
          const u = (y - top) / (P.y - top);
          const bevel = u > 0.86 ? (u - 0.86) / 0.14 * bw : 0;
          for (let x = Math.floor(x0 + bevel); x < x0 + bw; x++) {
            const band = 0.5 + 0.5 * Math.sin(y * 0.55 - t * 6 + Math.sin(x * 0.3) * 1.5);
            const edge = Math.min(x - (x0 + bevel), x0 + bw - x);
            let h = 0.25 + band * 0.35 + (edge < 2 ? 0.35 : 0) + (u > 0.97 ? 0.4 : 0);
            r.plot(x, y, ...fire(clamp(h)), DITHER, a * (0.75 + 0.25 * flick(x * 31 + y, t, 9)));
          }
          if (flick(y, t, 22) > 0.4) {
            r.px(x0 + bevel - 1 + (flick(y + 3, t) > 0.7 ? -1 : 0), y, fire(0.9), a * 1.2);
            r.px(x0 + bw + (flick(y + 5, t) > 0.7 ? 1 : 0), y, fire(0.9), a * 1.2);
          }
        }
        for (const g of s.gaps) {
          const cy = top + g.y * 150, cx = sx + g.x * bw, hl = g.l * 150;
          const pts = [cx, cy - hl, cx + g.w * 0.6, cy - hl * 0.3, cx + g.w * 0.3, cy + hl * 0.2, cx + g.w * 0.5, cy + hl, cx - g.w * 0.4, cy + hl * 0.4, cx - g.w * 0.5, cy - hl * 0.4];
          r.poly(pts, CHAR, a, DITHER);
          r.line(cx, cy - hl * 0.8, cx + 0.5, cy + hl * 0.8, [3, 3, 2.8], a * 1.5);
        }
        r.light(sx, P.y - 98, 120, [1.3, 0.6, 0.2], a * 0.9);
      }
    }
    if (t >= TF && t < TL) {
      const u = (t - TF) / (TL - TF);
      const a0 = -Math.PI / 2, a1 = s.ang;
      const A = lerp(a0, a1, u);
      const pts = [P.x, P.y];
      for (let k = 0; k <= 10; k++) {
        const a = lerp(a0, A, k / 10);
        pts.push(P.x + Math.cos(a) * 200, P.y + Math.sin(a) * 200);
      }
      r.poly(pts, [2.2, 1.6, 1], 0.9);
      r.flash = 0.6;
    }
    if (t >= TL) {
      const e = t - TL;
      if (e < 0.25) {
        r.shakeY = (hash(t * 41) - 0.5) * 10 * (1 - e / 0.25);
        r.flash = Math.max(0, 1.2 - e * 8);
      }
      for (let q = -260; q <= 260; q++) {
        const x = P.x + dir.x * q, y = P.y + dir.y * q;
        r.decal(x, y, CHAR);
        r.decal(x + nrm.x, y + nrm.y, CHAR, 0.6);
        r.decal(x - nrm.x, y - nrm.y, CHAR, 0.6);
      }
      s.sections.forEach((sec, k) => {
        const ee = t - sec.to;
        if (ee < 0) return;
        const q = ((k + 0.5) / s.NS - 0.5) * 460;
        const x = P.x + dir.x * q, y = P.y + dir.y * q;
        for (const c of s.veins[k]) {
          if (c.d > ee * 3) continue;
          r.decalLine(x + c.x0, y + c.y0, x + c.x1, y + c.y1, CHAR, 0.9);
          const g = Math.exp(-ee * 0.8) * (1 - c.d * 0.5);
          r.line(x + c.x0, y + c.y0, x + c.x1, y + c.y1, fire(0.4 + g * 0.5), g * 1.2);
        }
        r.light(x, y, 50, [1.4, 0.5, 0.12], 1.2 * Math.exp(-ee * 0.5));
        for (let m = 0; m < 22; m++) {
          const st = hash(k * 50 + m) * 0.5;
          const em = ee - st;
          if (em < 0 || em > 1.4) continue;
          const vx = (hash(k * 50 + m + 1) - 0.5) * 30, vy = -60 - hash(k * 50 + m + 2) * 110;
          const ex = fly(x + (hash(m + k) - 0.5) * 10, vx, 1, 0, em), ey = fly(y, vy, 1, 120, em);
          r.px(ex, ey, fire(0.95 - em * 0.4), (1 - em / 1.4) * 1.8);
          r.px(ex, ey + 1, fire(0.6), (1 - em / 1.4) * 0.6);
        }
      });
      for (let m = 0; m < 26; m++) {
        const st = 5 + hash(m) * 2.5;
        const em = t - st;
        if (em < 0 || em > 2.5) continue;
        const q = (hash(m + 7) - 0.5) * 380;
        r.disc(P.x + dir.x * q + Math.sin(em * 2 + m) * 3, P.y + dir.y * q - em * 14, 2 + em * 2.5, [0.12, 0.1, 0.1], 0.5 * (1 - em / 2.5), DITHER);
      }
    }
  },
  post(r, t, s) {
    const TL = 3.36;
    if (t < TL) return;
    const { P, dir, nrm } = s;
    const openW = (q) => {
      const f = (q / 460 + 0.5) * s.NS - 0.5;
      const k = Math.max(0, Math.min(s.NS - 1, Math.round(f)));
      const sec = s.sections[k];
      const ee = t - sec.to;
      if (ee < 0) return 0;
      const open = easeOutBack(clamp(ee / 0.35)) * sec.w;
      const close = 1 - smooth(1.2, 3.4, ee) * 0.75;
      const jj = sec.jag[Math.floor((f - k + 0.5) * 6) % 6] || 0;
      return Math.max(0, open * close + jj * 0.8);
    };
    const wmax = 16;
    r.warp(0, 0, W - 1, H - 1, (x, y, o) => {
      const dx = x - P.x, dy = y - P.y;
      const d = dx * nrm.x + dy * nrm.y;
      if (Math.abs(d) > wmax + 6) return;
      const q = dx * dir.x + dy * dir.y;
      const w = openW(q) * 0.5;
      if (w <= 0) return;
      const sg = Math.sign(d) || 1;
      o[0] = x - nrm.x * sg * w;
      o[1] = y - nrm.y * sg * w;
    });
    const layers = [[1, CHAR, 1], [0.86, fire(0.35), 1], [0.7, fire(0.55), 1], [0.5, fire(0.75), 1], [0.3, fire(0.92), 1.2], [0.1, [3, 2.9, 2.6], 1.5]];
    for (let q = -230; q <= 230; q++) {
      const w = openW(q) * 0.5;
      const x = P.x + dir.x * q, y = P.y + dir.y * q;
      const e = t - TL;
      if (w <= 0.2) {
        const sm = smooth(5.2, 7, t);
        const k = (e < 0.6 ? 2 : 1.2) * (1 - sm);
        r.plot(Math.floor(x), Math.floor(y), 3 * k + sm * 0.5 * flick(q, t, 6), 2.7 * k + sm * 0.05, 2.3 * k, ADD, 1);
        r.plot(Math.floor(x + nrm.x), Math.floor(y + nrm.y), 1.4, 0.4, 0.05, ADD, 1);
        continue;
      }
      const cool = smooth(5.6, 8.5, t);
      for (const [f, c, k] of layers) {
        const ww = w * f + 0.5;
        for (let d = -ww; d <= ww; d += 0.7) {
          const cc = f < 0.9 ? scale(c, 1 - cool * 0.8) : c;
          r.plot(Math.floor(x + nrm.x * d), Math.floor(y + nrm.y * d), cc[0] * k, cc[1] * k, cc[2] * k, SET, 1);
        }
      }
      r.plot(Math.floor(x + nrm.x * (w + 1)), Math.floor(y + nrm.y * (w + 1)), 1.6 * (1 - cool), 0.5 * (1 - cool), 0.06, ADD, 1);
      r.plot(Math.floor(x - nrm.x * (w + 1)), Math.floor(y - nrm.y * (w + 1)), 1.6 * (1 - cool), 0.5 * (1 - cool), 0.06, ADD, 1);
    }
  }
};
var PYRE = [cinderCrown, furnaceWyrm, meteorLoom, ashenGuillotine];

// src/effects/tide.ts
var WATER = [[0.01, 0.03, 0.1], [0.03, 0.14, 0.34], [0.1, 0.42, 0.78], [0.42, 1, 1.4], [1.5, 1.9, 2.1]];
var ICE = [[0.06, 0.05, 0.2], [0.2, 0.32, 0.75], [0.5, 0.95, 1.4], [1.1, 1.6, 2], [2, 2.3, 2.6]];
var water = (h, k = 1) => scale(ramp(WATER, h), k);
var ice = (h, k = 1) => scale(ramp(ICE, h), k);
var FOAM = [1.6, 1.95, 2.1];
var abyssalBloom = {
  id: 5,
  name: "Abyssal Bloom",
  school: "TIDE",
  duration: 9,
  climax: 4.75,
  blurb: "An ocean invents a flower of folding membranes, freezes in perfect symmetry, and is shattered by a pressure pulse.",
  setup(r) {
    const rng = new RNG(505);
    const layers = [
      { n: 5, start: 2, dur: 2.2, L: 92, w: 0.34, r0: 10, spin: 0.12, off: 0.3 },
      { n: 7, start: 0.9, dur: 2, L: 66, w: 0.28, r0: 6, spin: -0.22, off: 0 },
      { n: 7, start: 1.5, dur: 1.8, L: 44, w: 0.22, r0: 4, spin: 0.35, off: Math.PI / 7 },
      { n: 14, start: 2.4, dur: 1.4, L: 26, w: 0.12, r0: 3, spin: -0.5, off: 0.1 }
    ];
    const drops = Array.from({ length: 260 }, (_, i) => ({ a: rng.r(0, TAU), r0: rng.r(4, 80), v: rng.r(30, 150), vz: rng.r(40, 200), seed: i }));
    return { layers, drops };
  },
  render(r, t, s) {
    const C = { x: r.target.x - 10, y: r.target.y + 4 };
    const TFZ = 4.4, TP = 5.05;
    const tf = Math.min(t, TFZ);
    const frozen = smooth(TFZ - 0.05, TFZ + 0.1, t) * (t < TP ? 1 : 0);
    const asym = 1 - smooth(3, TFZ, tf);
    const e = t - TP;
    const pR = e > 0 ? e * 280 : -1;
    r.light(C.x, C.y, 110, [0.3, 0.8, 1.3], 0.6 + smooth(1, 4, t) * 0.8 - smooth(6, 9, t) * 1.2);
    const ringK = 1 - smooth(5, 6, t);
    for (let k = 0; k < 4; k++) {
      const rr = 6 + (tf * 4 + k * 6) % 24;
      for (let a = 0; a < TAU; a += 0.04) {
        const wob = Math.sin(a * 5 + tf * 2 + k) * 1.4;
        r.px(C.x + Math.cos(a) * (rr + wob), C.y + Math.sin(a) * (rr + wob) * 0.8, water(0.6), 0.5 * ringK * (1 - rr / 30));
      }
    }
    r.disc(C.x, C.y, 9, water(0.15), 0.6 * ringK, BLEND, 0.8);
    if (pR < 140) {
      if (pR > 0) r.clip = (x, y) => Math.hypot(x - C.x, (y - C.y) / 0.82) > pR;
      for (let li = 0; li < s.layers.length; li++) {
        const L = s.layers[li];
        const g = easeOut(inv(L.start, L.start + L.dur, tf));
        if (g <= 0) continue;
        for (let k = 0; k < L.n; k++) {
          const seed = li * 31 + k;
          const len = L.L * g * (1 + asym * (hash(seed) - 0.5) * 0.4);
          const a0 = L.off + k / L.n * TAU + L.spin * tf + asym * (noise1(tf * 0.6 + seed) - 0.5) * 0.5;
          const fold = li >= 2 ? Math.sin(tf * 1.6 + k) * 0.25 * asym : 0;
          const pts = [];
          const edge = [];
          for (let side = 1; side >= -1; side -= 2) {
            for (let q = 0; q <= 14; q++) {
              const u = side > 0 ? q / 14 : 1 - q / 14;
              const half = L.w * Math.sin(Math.PI * Math.pow(u, 0.65)) * (1 - u * 0.25);
              const ripple = (noise1(u * 6 - tf * 1.8 + seed * 3 + side) - 0.5) * 0.12 * (0.4 + asym);
              const a = a0 + fold * u * u + side * (half + ripple);
              const rr = L.r0 + u * len;
              const x = C.x + Math.cos(a) * rr, y = C.y + Math.sin(a) * rr * 0.82;
              pts.push(x, y);
              edge.push(x, y);
            }
          }
          const depth = 0.12 + li * 0.08;
          r.poly(pts, water(depth), 0.38, BLEND);
          r.poly(pts, frozen > 0 ? ice(0.55) : water(0.45), 0.18 + frozen * 0.35);
          for (let q = 0; q < len; q += 1.4) {
            const u = q / len;
            const ph = Math.sin(q * 0.35 - tf * 7 + k);
            for (const o of [-0.4, 0, 0.4]) {
              const a = a0 + fold * u * u + o * L.w * Math.sin(Math.PI * u) * 0.8;
              const x = C.x + Math.cos(a) * (L.r0 + q), y = C.y + Math.sin(a) * (L.r0 + q) * 0.82;
              if (ph > 0.55) r.px(x, y, water(0.7), 0.45);
              else if (ph < -0.7) r.px(x, y, [0.6, 0.6, 0.5], 1, MUL);
            }
          }
          r.polyline(edge, frozen > 0 ? ice(0.95) : water(0.85), 0.9 + frozen * 0.8, ADD, true);
          const tipA = a0 + fold;
          const det = Math.max(0, Math.sin(tf * 3 + seed)) * 6 * asym;
          const tx = C.x + Math.cos(tipA) * (L.r0 + len + det), ty = C.y + Math.sin(tipA) * (L.r0 + len + det) * 0.82;
          r.disc(tx, ty, 1.2, FOAM, 0.9);
          if (det > 2) r.px(C.x + Math.cos(tipA) * (L.r0 + len + det * 0.5), C.y + Math.sin(tipA) * (L.r0 + len + det * 0.5) * 0.82, water(0.8), 0.6);
        }
      }
      for (let k = 0; k < 46; k++) {
        const rr = 6 + hash(k) * 50 * smooth(1, 3.5, tf);
        const a = hash(k + 3) * TAU + tf * (0.8 + 20 / (rr + 10)) * (k % 2 ? 1 : -1);
        const x = C.x + Math.cos(a) * rr, y = C.y + Math.sin(a) * rr * 0.82 - (tf * 6 + k) % 6;
        if (k % 3 === 0) r.ring(x, y, 1.3, 0.8, FOAM, 0.6);
        else r.px(x, y, FOAM, 0.8);
      }
      if (frozen > 0) {
        const gl = (t - TFZ) * 300 - 120;
        r.clip = (x, y) => Math.abs(x - C.x + (y - C.y) - gl) < 3 && Math.hypot(x - C.x, (y - C.y) / 0.82) < 85 && (pR < 0 || Math.hypot(x - C.x, (y - C.y) / 0.82) > pR);
        r.disc(C.x, C.y, 95, [0.5, 0.7, 0.9], 0.12);
      }
      r.clip = null;
    }
    if (e >= 0) {
      if (e < 0.15) r.flash = 0.5 * (1 - e / 0.15);
      if (e < 0.4) {
        r.shakeX = (hash(t * 33) - 0.5) * 6;
        r.shakeY = (hash(t * 21) - 0.5) * 5;
      }
      if (e < 0.6) {
        r.ring(C.x, C.y, pR, 2.5, FOAM, 1.4 * (1 - e / 0.6), ADD, 0.82);
        r.ring(C.x, C.y, pR * 0.8, 6, water(0.4), 0.4 * (1 - e / 0.6), BLEND, 0.82);
      }
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * TAU + 0.2;
        const rr = easeOut(e / 0.9) * (70 + k % 3 * 22);
        const life = 1 - smooth(0.4, 1.2, e);
        if (life <= 0) break;
        const span = 0.5;
        const pts = [];
        for (let q = 0; q <= 10; q++) {
          const aa = a - span / 2 + q / 10 * span;
          pts.push(C.x + Math.cos(aa) * rr, C.y + Math.sin(aa) * rr * 0.82 - Math.sin(q / 10 * Math.PI) * 10 * life);
        }
        for (let q = 10; q >= 0; q--) {
          const aa = a - span / 2 + q / 10 * span;
          pts.push(C.x + Math.cos(aa) * (rr - 8 * life), C.y + Math.sin(aa) * (rr - 8 * life) * 0.82);
        }
        r.poly(pts, water(0.5), 0.6 * life, BLEND);
        r.polyline(pts.slice(0, 22), FOAM, 1.3 * life);
      }
      for (const d of s.drops) {
        const tland = 2 * d.vz / 300;
        const gx = C.x + Math.cos(d.a) * (d.r0 + fly(0, d.v, 0.8, 0, Math.min(e, tland)));
        const gy = C.y + Math.sin(d.a) * (d.r0 + fly(0, d.v, 0.8, 0, Math.min(e, tland))) * 0.82;
        if (e < tland) {
          const z = d.vz * e - 150 * e * e;
          r.px(gx, gy - z, FOAM, 1.1);
          if (d.seed % 3 === 0) r.px(gx, gy - z + 1, water(0.7), 0.7);
          if (d.seed % 4 === 0) r.px(gx, gy, [0.7, 0.7, 0.7], 1, MUL);
        } else {
          const ee = e - tland;
          if (ee < 0.5) r.ring(gx, gy, 0.5 + ee * 7, 0.7, water(0.8), (1 - ee / 0.5) * 0.8, ADD, 0.6);
          if (ee < 2.5) r.decal(gx, gy, [0.05, 0.1, 0.16], 0.5 * (1 - ee / 2.5));
        }
      }
      for (let k = 0; k < 12; k++) {
        const st = 1 + hash(k) * 1.4;
        const u = (e - st) / 1.6;
        if (u < 0 || u > 1.2) continue;
        for (let m = 0; m < 22; m++) {
          const uu = clamp(u - m * 0.012);
          if (uu <= 0 || uu >= 1) continue;
          const rr = 100 * (1 - easeInOut(uu));
          const a = hash(k + 9) * TAU + uu * 2.4 * (k % 2 ? 1 : -1);
          r.px(C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * 0.82, m === 0 ? FOAM : water(0.75), 1 - m / 22);
        }
      }
      const pool = smooth(2.2, 3.2, e) * (1 - smooth(3.4, 4, e));
      if (pool > 0) r.ring(C.x, C.y, 4 + pool * 3, 1, water(0.8), pool, ADD, 0.8);
    }
  },
  post(r, t, s) {
    const C = { x: r.target.x - 10, y: r.target.y + 4 };
    const R = 90 * smooth(0.8, 3, t) * (1 - smooth(5, 5.4, t));
    if (R < 4) return;
    const tf = Math.min(t, 4.4);
    r.warp(C.x - R, C.y - R, C.x + R, C.y + R, (x, y, o) => {
      const d = Math.hypot(x - C.x, y - C.y) / R;
      if (d > 1) return;
      o[0] = x + Math.sin(y * 0.4 + tf * 5) * 1.6 * (1 - d);
      o[1] = y + Math.cos(x * 0.35 + tf * 4) * 1.2 * (1 - d);
    });
  }
};
var riptideCalligraphy = {
  id: 6,
  name: "Riptide Calligraphy",
  school: "TIDE",
  duration: 9.5,
  climax: 6.95,
  blurb: "An invisible calligrapher writes with the sea. When the last stroke lands, the writing becomes waves.",
  setup(r) {
    const C = r.caster;
    const defs = [
      [[[C.x + 6, C.y - 10], [150, 70], [215, 42], [280, 52], [338, 86]], 0.5, 0.9, easeInOut, 1],
      [[[C.x + 8, C.y + 4], [180, 158], [250, 150], [300, 124], [306, 94], [286, 100]], 1.45, 0.7, (u) => easeOut(u), 1.1],
      [[[160, 112], [214, 82], [252, 104], [240, 134], [208, 116], [236, 84], [296, 66], [348, 60]], 2.2, 1.3, (u) => u, 0.8],
      [[[214, 22], [262, 104], [312, 196]], 3.6, 0.35, (u) => easeInExpo(u), 1.3],
      [[[146, 94], [186, 168], [262, 182], [330, 150], [356, 108], [340, 92]], 4.1, 1.1, easeInOut, 1]
    ];
    const strokes = defs.map(([pts, ts, dur, ease, press]) => {
      const rs = resample(pts.map(([x, y]) => ({ x, y })), 1.2);
      const n = rs.p.length;
      const nrm = [], curv = [];
      for (let i = 0; i < n; i++) {
        const a = rs.p[Math.max(0, i - 2)], b = rs.p[Math.min(n - 1, i + 2)];
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
        nrm.push({ x: -dy / L, y: dx / L });
      }
      for (let i = 0; i < n; i++) {
        const a = nrm[Math.max(0, i - 3)], b = nrm[Math.min(n - 1, i + 3)];
        curv.push(Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)));
      }
      return { p: rs.p, len: rs.len, total: rs.total, ts, dur, ease, curv, nrm, press };
    });
    const knots = [];
    const passT = (S, i) => {
      const f = S.len[i] / S.total;
      let lo = 0, hi = 1;
      for (let k = 0; k < 20; k++) {
        const m = (lo + hi) / 2;
        if (S.ease(m) < f) lo = m;
        else hi = m;
      }
      return S.ts + lo * S.dur;
    };
    for (let a = 0; a < strokes.length; a++)
      for (let b = a + 1; b < strokes.length; b++) {
        const A = strokes[a], B = strokes[b];
        for (let i = 0; i < A.p.length; i += 3)
          for (let j = 0; j < B.p.length; j += 3) {
            if (Math.hypot(A.p[i].x - B.p[j].x, A.p[i].y - B.p[j].y) < 2.2) {
              if (!knots.some((k) => Math.hypot(k.x - A.p[i].x, k.y - A.p[i].y) < 14))
                knots.push({ x: A.p[i].x, y: A.p[i].y, tk: Math.max(passT(A, i), passT(B, j)) });
            }
          }
      }
    return { strokes, knots };
  },
  render(r, t, s) {
    const TE = 5.6;
    const waves = [6.2, 6.75, 7.3];
    const waveX = (k) => -60 + (t - waves[k]) * 330;
    const wx0 = t > waves[0] ? waveX(0) : -999;
    r.light(r.caster.x, r.caster.y - 10, 40, [0.3, 0.8, 1.2], t < 5 ? 0.6 : 0);
    for (const S of s.strokes) {
      const u = (t - S.ts) / S.dur;
      if (u < 0) continue;
      const head = S.total * S.ease(clamp(u));
      const race = t > TE ? (t - TE) * 420 : -1;
      for (let i = 0; i < S.p.length; i++) {
        const sL = S.len[i];
        if (sL > head) break;
        const p = S.p[i], n = S.nrm[i];
        const prof = Math.pow(Math.sin(Math.PI * (sL / S.total)), 0.6);
        let w = (0.8 + 4.2 * prof * S.press) * (1 + 0.25 * Math.sin(sL * 0.08 + S.ts));
        w *= smooth(0, 14, head - sL) * 0.6 + 0.4;
        if (p.x < wx0) {
          const fade = 1 - clamp((wx0 - p.x) / 140);
          if (i % 2 === 0 && hash(i + S.ts * 10) < fade) r.px(p.x, p.y, water(0.8), fade * 0.9);
          continue;
        }
        r.disc(p.x, p.y, w, water(0.2), 0.32, BLEND);
        const flow = Math.sin(sL * 0.45 - t * 13);
        if (flow > 0.6) r.px(p.x + n.x * w * 0.3, p.y + n.y * w * 0.3, water(0.75), 0.7);
        if (flow < -0.85) r.px(p.x - n.x * w * 0.4, p.y - n.y * w * 0.4, water(0.6), 0.6);
        const foamP = 0.25 + S.curv[i] * 2.5;
        for (const sg of [1, -1]) {
          if (hash(i * 3 + sg + Math.floor(t * 12) * 0.13) < foamP)
            r.px(p.x + n.x * w * sg, p.y + n.y * w * sg, FOAM, 0.9);
          else if (i % 2) r.px(p.x + n.x * w * sg, p.y + n.y * w * sg, water(0.7), 0.5);
        }
        if (race > 0) {
          const k = Math.exp(-Math.abs(sL - race % (S.total + 80)) * 0.12);
          if (k > 0.05) r.disc(p.x, p.y, w * 0.6, [1.5, 2, 2.4], k * 1.5);
        }
      }
      if (u < 1) {
        const i = S.len.findIndex((l) => l >= head);
        const p = S.p[i < 0 ? S.p.length - 1 : i];
        r.disc(p.x, p.y, 2.2, FOAM, 1.5);
        r.glow(p.x, p.y, 10, water(0.8), 0.7);
        r.light(p.x, p.y, 40, [0.4, 0.9, 1.3], 0.8);
      }
      for (let i = 0; i < S.p.length; i += 4) {
        if (S.curv[i] < 0.28) continue;
        const tp = S.ts + S.dur * (S.len[i] / S.total);
        const e = t - tp;
        if (e < 0 || e > 0.9) continue;
        for (let m = 0; m < 3; m++) {
          const sg = m % 2 ? 1 : -1;
          const v0 = 25 + hash(i + m) * 40;
          const x = fly(S.p[i].x, S.nrm[i].x * v0 * sg, 2, 0, e), y = fly(S.p[i].y, S.nrm[i].y * v0 * sg - 20, 2, 80, e);
          r.px(x, y, FOAM, 1 - e / 0.9);
        }
      }
    }
    for (const k of s.knots) {
      const e = t - k.tk;
      if (e < 0 || k.x < wx0) continue;
      const g = smooth(0, 0.4, e);
      for (let arm = 0; arm < 3; arm++)
        for (let q = 0; q < 16; q++) {
          const rr = q * 0.45 * g;
          const a = arm * (TAU / 3) + q * 0.4 - t * 6;
          r.px(k.x + Math.cos(a) * rr, k.y + Math.sin(a) * rr, q > 11 ? FOAM : water(0.8), 0.9);
        }
      r.glow(k.x, k.y, 9, water(0.9), (0.5 + 0.3 * Math.sin(t * 8 + k.x)) * g);
    }
    waves.forEach((tw, k) => {
      const e = t - tw;
      if (e < 0 || e > 1.6) return;
      const X = waveX(k);
      const life = 1 - smooth(1.1, 1.6, e);
      const pts = [], back = [];
      for (let y = -10; y <= H + 10; y += 4) {
        const bend = -Math.pow((y - H / 2) / (H / 2), 2) * 38;
        const crest = X + bend + Math.sin(y * 0.15 + t * 10) * 2;
        pts.push(crest, y);
        back.push(crest - 16 - k * 4, y);
      }
      for (let q = 0; q + 3 < pts.length; q += 2) {
        for (let y = Math.floor(pts[q + 1]); y < pts[q + 3]; y++) {
          const cx = lerp(pts[q], pts[q + 2], (y - pts[q + 1]) / 4);
          const th = 14 + k * 4;
          for (let x = Math.floor(cx - th); x < cx; x++) r.plot(x, y, 0.08, 0.35, 0.65, BLEND, 0.35 * life * (1 - (cx - x) / th));
        }
      }
      r.polyline(pts, FOAM, 1.5 * life);
      for (let q = 0; q < pts.length; q += 2) {
        r.px(pts[q] - 2 - hash(q + k) * 6, pts[q + 1] + hash(q) * 3, FOAM, 0.8 * life);
        const sp = hash(q * 7 + Math.floor(t * 20) + k);
        if (sp > 0.6) r.px(pts[q] + sp * 8, pts[q + 1] - sp * 4, FOAM, life);
      }
    });
    if (t > 6.4) {
      for (let q = 0; q < 140; q++) {
        const x = hash(q) * W, y = hash(q + 5) * H;
        if (x > wx0 - 20) continue;
        const life = clamp(1 - (t - 6.4 - hash(q + 1) * 2) / 2);
        if (life > 0) r.px(x + Math.sin(t + q) * 2, y, FOAM, life * 0.6);
      }
    }
  },
  post(r, t, s) {
    const waves = [6.2, 6.75, 7.3];
    for (let k = 0; k < 3; k++) {
      const e = t - waves[k];
      if (e < 0 || e > 1.5) continue;
      const X = -60 + e * 330;
      r.warp(X - 50, 0, X + 4, H - 1, (x, y, o) => {
        const bend = -Math.pow((y - H / 2) / (H / 2), 2) * 38;
        const d = X + bend - x;
        if (d < 0 || d > 30) return;
        o[0] = x - Math.sin(d * 0.3) * 3;
      });
    }
  }
};
var mirrorfrostBasilica = {
  id: 7,
  name: "Mirrorfrost Basilica",
  school: "TIDE",
  duration: 10,
  climax: 6.15,
  blurb: "Frost grows into a cathedral seen from above, then a single point breaks and the whole architecture lets go.",
  setup(r) {
    const rng = new RNG(707);
    const C = { x: W / 2 + 34, y: H / 2 + 2 };
    const SY = 0.78;
    const frost = [];
    for (let sec = 0; sec < 6; sec++) {
      const sr = new RNG(900 + sec * 17);
      const grow = (x, y, a, len, t0, depth) => {
        let cx = x, cy = y, tt = t0;
        const n = Math.floor(len / 3);
        for (let i = 0; i < n; i++) {
          const nx = cx + Math.cos(a) * 3, ny = cy + Math.sin(a) * 3 * SY;
          tt += 0.035 + sr.r(0, 0.03);
          frost.push({ x0: cx, y0: cy, x1: nx, y1: ny, tb: tt, hex: depth > 0 && sr.next() < 0.08 });
          cx = nx;
          cy = ny;
          if (depth < 2 && sr.next() < 0.28) grow(cx, cy, a + sr.sign() * Math.PI / 3, (len - i * 3) * sr.r(0.3, 0.55), tt, depth + 1);
        }
      };
      grow(C.x, C.y, sec / 6 * TAU + Math.PI / 6, 104 + sr.r(-10, 10), 0.1, 0);
    }
    const facets = [];
    const B = { x: C.x + 74, y: C.y + 22 };
    const add = (pts, ring, light) => {
      let cx = 0, cy = 0;
      for (let i = 0; i < pts.length; i += 2) {
        cx += pts[i];
        cy += pts[i + 1];
      }
      cx /= pts.length / 2;
      cy /= pts.length / 2;
      const dirA = Math.atan2(cy - C.y, cx - C.x);
      const cracks = [];
      for (let k = 0; k < 4; k++) {
        const i = rng.i(0, pts.length / 2 - 1) * 2;
        cracks.push(cx + (pts[i] - cx) * 0.1, cy + (pts[i + 1] - cy) * 0.1, lerp(cx, pts[i], rng.r(0.6, 1)), lerp(cy, pts[i + 1], rng.r(0.6, 1)));
      }
      const shards = [];
      for (let i = 0; i < pts.length; i += 2) {
        const j = (i + 2) % pts.length;
        const sp = [cx, cy, pts[i], pts[i + 1], pts[j], pts[j + 1]];
        const scx = (cx + pts[i] + pts[j]) / 3, scy = (cy + pts[i + 1] + pts[j + 1]) / 3;
        const da = Math.atan2(scy - B.y, scx - B.x);
        const sp0 = rng.r(30, 90);
        shards.push({ pts: sp, cx: scx, cy: scy, v: { x: Math.cos(da) * sp0 + rng.r(-15, 15), y: Math.sin(da) * sp0 * 0.8 + rng.r(-25, 5) }, spin: rng.r(-8, 8) });
      }
      const d = Math.hypot(cx - C.x, cy - C.y);
      facets.push({
        pts,
        cx,
        cy,
        shade: light,
        ta: 1.5 + d / 52 + rng.r(0, 0.35),
        from: { x: cx + Math.cos(dirA) * rng.r(20, 40), y: cy + Math.sin(dirA) * rng.r(20, 40) - rng.r(10, 30) },
        cracks,
        shards,
        ring
      });
    };
    const LA = -2.3;
    const P = (rr, a) => [C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * SY];
    for (let k = 0; k < 6; k++) {
      const a0 = k / 6 * TAU, a1 = (k + 1) / 6 * TAU;
      add([C.x, C.y - 5, ...P(17, a0), ...P(17, a1)], 0, 0.55 + 0.45 * Math.cos((a0 + a1) / 2 - LA));
    }
    for (let k = 0; k < 12; k++) {
      const a0 = k / 12 * TAU, a1 = (k + 1) / 12 * TAU, am = (a0 + a1) / 2;
      const ridge = P(31, am);
      ridge[1] -= 4;
      const l1 = 0.5 + 0.45 * Math.cos(am - 0.5 - LA), l2 = 0.5 + 0.45 * Math.cos(am + 0.5 - LA);
      add([...P(21, a0), ...P(42, a0), ...ridge], 1, l1);
      add([...P(42, a0), ...P(42, a1), ...ridge], 1, (l1 + l2) / 2 + 0.1);
      add([...P(21, a1), ...P(21, a0), ...ridge], 1, (l1 + l2) / 2 - 0.15);
      add([...P(42, a1), ...P(21, a1), ...ridge], 1, l2);
    }
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * TAU + Math.PI / 6;
      const tip = P(80, a), l = P(52, a - 0.32), rr = P(52, a + 0.32), base = P(47, a);
      const mid = P(62, a);
      mid[1] -= 6;
      const la = 0.5 + 0.45 * Math.cos(a - 0.6 - LA), lb = 0.5 + 0.45 * Math.cos(a + 0.6 - LA);
      add([...base, ...l, ...mid], 2, la);
      add([...l, ...tip, ...mid], 2, la * 0.8);
      add([...base, ...mid, ...rr], 2, lb);
      add([...mid, ...tip, ...rr], 2, lb * 0.8);
    }
    const spires = Array.from({ length: 6 }, (_, k) => {
      const a = k / 6 * TAU;
      return { x: C.x + Math.cos(a) * 66, y: C.y + Math.sin(a) * 66 * SY, h: 18 + k % 2 * 10, ta: 3.4 + k * 0.08 };
    });
    spires.push({ x: C.x, y: C.y, h: 34, ta: 3.9 });
    return { C, SY, frost, facets, spires, B };
  },
  render(r, t, s) {
    const { C, B } = s;
    const TB = 5.95;
    r.ambient = 0.55;
    r.light(C.x, C.y, 130, [0.4, 0.7, 1.3], 0.4 + smooth(1.5, 5, t) * 0.7 - smooth(TB, TB + 2, t) * 0.8);
    const dissolve = smooth(7.2, 9.5, t);
    for (const f of s.frost) {
      if (t < f.tb) continue;
      if (hash(f.x0 * 3.1 + f.y0) < dissolve) continue;
      const fresh = Math.exp(-(t - f.tb) * 3);
      r.decalLine(f.x0, f.y0, f.x1, f.y1, [0.35, 0.45, 0.6], 0.6);
      r.line(f.x0, f.y0, f.x1, f.y1, ice(0.75 + fresh * 0.25), 0.4 + fresh * 1.2);
      if (f.hex) r.ring(f.x1, f.y1, 2, 0.8, ice(0.9), 0.7);
    }
    const pulseR = t > 4.2 && t < 5.6 ? (t - 4.2) % 0.7 * 160 : -100;
    for (const sp of s.spires) {
      const g = easeOut(inv(sp.ta, sp.ta + 0.6, t));
      if (g <= 0) continue;
      const brk = t > TB + Math.hypot(sp.x - B.x, sp.y - B.y) / 120;
      if (brk) continue;
      const h = sp.h * g;
      r.poly([sp.x - 2, sp.y, sp.x + 2, sp.y, sp.x + 2 + h * 1.4, sp.y + h * 0.9, sp.x + h * 1.4 - 1, sp.y + h * 0.9 + 2], ice(0.6), 0.25);
    }
    for (const f of s.facets) {
      const a = easeInOut(inv(f.ta, f.ta + 0.7, t));
      if (a <= 0) continue;
      const tb = TB + Math.hypot(f.cx - B.x, f.cy - B.y) / 120;
      if (t < tb) {
        const ox = (f.from.x - f.cx) * (1 - a), oy = (f.from.y - f.cy) * (1 - a);
        const pts = f.pts.map((v, i) => v + (i % 2 ? oy : ox));
        const dC = Math.hypot(f.cx - C.x, f.cy - C.y);
        const pl = Math.exp(-Math.pow((dC - pulseR) / 10, 2));
        const h = clamp(f.shade * 0.75 + pl * 0.35 + (1 - a) * 0.3);
        r.poly(pts, ice(h * 0.9 + 0.05), a * 0.85 + 0.15, a < 1 ? DITHER : SET);
        r.polyline(pts, ice(Math.min(1, h + 0.3)), 0.35 + pl, ADD, true);
        const cr = smooth(4.8 + hash(f.cx) * 0.6, TB, t + (130 - Math.hypot(f.cx - B.x, f.cy - B.y)) / 400);
        for (let k = 0; k < f.cracks.length; k += 4) {
          if (k / f.cracks.length > cr) break;
          r.line(f.cracks[k], f.cracks[k + 1], f.cracks[k + 2], f.cracks[k + 3], [2.2, 2.4, 2.6], 0.6 + cr);
        }
      } else {
        const e = t - tb;
        if (e < 0.06) r.glow(f.cx, f.cy, 8, [2, 2.3, 2.6], 1.2);
        for (const sh of f.shards) {
          const life = 1 - smooth(1, 2.2, e);
          if (life <= 0) continue;
          const x = fly(0, sh.v.x, 1.4, 0, e), y = fly(0, sh.v.y, 1.4, 140, e);
          const rot = sh.spin * e;
          const cs = Math.cos(rot), sn = Math.sin(rot);
          const pts = [];
          for (let i = 0; i < 6; i += 2) {
            const lx = sh.pts[i] - sh.cx, ly = sh.pts[i + 1] - sh.cy;
            pts.push(sh.cx + x + lx * cs - ly * sn, sh.cy + y + lx * sn + ly * cs);
          }
          const gl = Math.pow(Math.max(0, Math.cos(rot * 2 + f.cx)), 8);
          r.poly(pts, ice(f.shade * 0.7 + gl * 0.3), life, DITHER);
          r.polyline(pts, ice(0.9), 0.4 * life, ADD, true);
          if (gl > 0.6) sparkle(r, sh.cx + x, sh.cy + y, 3, [2, 2.3, 2.6], gl * life);
        }
        for (let k = 0; k < 4; k++) {
          const a2 = hash(f.cx + k) * TAU, v0 = 40 + hash(f.cy + k) * 90;
          const x = fly(f.cx, Math.cos(a2) * v0, 2, 0, e), y = fly(f.cy, Math.sin(a2) * v0 - 30, 2, 120, e);
          if (e < 1.4) r.px(x, y, FOAM, (1 - e / 1.4) * (flickS(k + f.cx, t) ? 1.6 : 0.4));
        }
      }
    }
    for (const sp of s.spires) {
      const g = easeOut(inv(sp.ta, sp.ta + 0.6, t));
      if (g <= 0) continue;
      const tb = TB + Math.hypot(sp.x - B.x, sp.y - B.y) / 120;
      if (t > tb) continue;
      const h = sp.h * g;
      r.poly([sp.x - 3, sp.y, sp.x, sp.y - h, sp.x, sp.y + 1], ice(0.85), 1, SET);
      r.poly([sp.x, sp.y - h, sp.x + 3, sp.y, sp.x, sp.y + 1], ice(0.45), 1, SET);
      r.px(sp.x, sp.y - h, [2.5, 2.6, 2.8], 1.5);
    }
    const pb = pulse(TB - 0.35, TB + 0.1, t);
    if (pb > 0) {
      r.glow(B.x, B.y, 14, [2, 2.4, 2.8], pb * 1.5);
      sparkle(r, B.x, B.y, 6, [2.5, 2.6, 2.8], pb * 2);
    }
    if (t > TB && t < TB + 0.12) r.flash = 0.35;
    if (t > TB && t < TB + 1.2) {
      r.shakeX = (hash(t * 40) - 0.5) * 3;
      r.shakeY = (hash(t * 47) - 0.5) * 2;
    }
  }
};
var flickS = (k, t) => hash(k * 7.7 + Math.floor(t * 20)) > 0.6;
var undertowMaw = {
  id: 8,
  name: "Undertow Maw",
  school: "TIDE",
  duration: 8.5,
  climax: 5.3,
  blurb: "A whirlpool whose shaft is a log-polar tunnel \u2014 deeper than the screen. Then every current stops.",
  setup(r) {
    const rng = new RNG(808);
    const drops = Array.from({ length: 220 }, (_, i) => ({ a: rng.r(0, TAU), v: rng.r(40, 200), vz: rng.r(60, 220), s: i }));
    const tunnels = Array.from({ length: 7 }, () => ({ a: rng.r(0, TAU), d: rng.r(30, 90), t0: rng.r(0.2, 1.2), R: rng.r(6, 12) }));
    return { drops, tunnels };
  },
  render(r, t, s) {
    const C = { x: W / 2 + 26, y: H / 2 + 4 };
    const TS = 4.35, TC = 4.65, TX = 5.05;
    const tf = Math.min(t, TS);
    const violence = smooth(2, TS, tf);
    const open = easeOut(inv(0.9, 3.2, t));
    const contract = 1 - easeIn(inv(TC, TX - 0.1, t));
    const R = 82 * open * contract;
    const e = t - TX;
    r.ambient = 0.62 - violence * 0.15 - (t > TS && t < TX ? 0.2 : 0);
    if (t < 3) {
      const k = 1 - smooth(2, 3, t);
      for (let q = 0; q < 4; q++) {
        const rr = 90 - (t * 25 + q * 22) % 88;
        r.ring(C.x, C.y, rr, 1, [0.75, 0.8, 0.9], k, MUL, 0.78);
      }
    }
    if (t < TS + 0.01) {
      for (let k = 0; k < 7; k++)
        for (let m = 0; m < 40; m++) {
          const u = (tf * 0.5 + k / 7 + m * 6e-3) % 1;
          const rr = 110 * (1 - u);
          const a = k * 0.9 + u * 5 + tf * 0.5;
          r.px(C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * 0.78, m < 4 ? FOAM : water(0.7), (1 - m / 40) * smooth(0.2, 1, t) * 0.8);
        }
    }
    if (R > 1.5) {
      const Rm = R * 1.25;
      const stopped = t > TS;
      for (let y = Math.floor(C.y - Rm); y <= C.y + Rm; y++)
        for (let x = Math.floor(C.x - Rm); x <= C.x + Rm; x++) {
          const dx = x + 0.5 - C.x, dy = (y + 0.5 - C.y) / 0.78;
          const th = Math.atan2(dy, dx);
          const Re = R * (1 + 0.2 * violence * Math.sin(3 * th - tf * 2.2) + 0.06 * Math.sin(7 * th + tf * 3));
          const d = Math.hypot(dx, dy) / Re;
          if (d > 1) continue;
          const depth = -Math.log(d + 0.015) * 3.2 + tf * 1.8;
          const ang = th + tf * (0.6 + 1.6 / (d + 0.12)) * (0.6 + violence);
          const band = depth - Math.floor(depth);
          const bri = Math.pow(d, 0.75);
          const nz = noise2(Math.cos(ang) * 3 + Math.sin(ang) * 2 + depth * 0, depth * 1.6 + Math.sin(ang * 3) * 0.5);
          const nz2 = noise2(ang * 4 / 1 + 20, depth * 2.2);
          let c = water(0.08 + bri * 0.5);
          if (band < 0.1) c = water(0.25 + bri * 0.5);
          if (nz2 > 0.74) c = scale(FOAM, bri * 0.9);
          else if (nz > 0.7) c = water(0.45 + bri * 0.4);
          if (d < 0.07) c = [0, 0, 0.01];
          if (d > 0.93 && bayer(x, y) > (1 - d) * 14) continue;
          if (stopped) c = scale(c, 0.8);
          r.plot(x, y, c[0], c[1], c[2], SET, 1);
        }
      for (let a = 0; a < TAU; a += 0.02) {
        const Re = R * (1 + 0.2 * violence * Math.sin(3 * a - tf * 2.2) + 0.06 * Math.sin(7 * a + tf * 3));
        if (hash(Math.floor(a * 50) + Math.floor(tf * 8)) > 0.45)
          r.px(C.x + Math.cos(a) * Re, C.y + Math.sin(a) * Re * 0.78, FOAM, 0.9);
      }
      for (let k = 0; k < 50; k++) {
        const u = (tf * 0.35 + hash(k)) % 1;
        const rr = R * 1.15 * Math.pow(1 - u, 1.6);
        const a = hash(k + 4) * TAU + u * u * 9 + tf * 0.4;
        for (let m = 0; m < 4; m++) {
          const uu = Math.max(0, u - m * 0.01);
          const r2 = R * 1.15 * Math.pow(1 - uu, 1.6), a2 = hash(k + 4) * TAU + uu * uu * 9 + tf * 0.4;
          r.px(C.x + Math.cos(a2) * r2, C.y + Math.sin(a2) * r2 * 0.78, FOAM, (1 - m / 4) * (1 - u));
        }
        void rr;
        void a;
      }
      if (violence > 0.3)
        for (let k = 0; k < 3; k++) {
          const a0 = tf * 1.3 + k * 2.1;
          for (let q = 0; q < 50; q++) {
            const u = q / 50;
            const rr = R * (0.95 - u * 0.85);
            const a = a0 + u * 3.2;
            r.px(C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * 0.78, water(0.9), violence * (1 - u) * 1.1);
          }
        }
      r.light(C.x, C.y, R * 1.8, [0.2, 0.5, 1], 0.5);
    }
    if (t > TC && t < TX + 0.05) {
      r.disc(C.x, C.y, 1.5, [0, 0, 0], 1, SET);
      r.ring(C.x, C.y, 2.5, 1, FOAM, 1.2);
    }
    if (e >= 0) {
      if (e < 0.1) r.flash = 0.6;
      if (e < 0.6) {
        r.shakeX = (hash(t * 50) - 0.5) * 9 * (1 - e / 0.6);
        r.shakeY = (hash(t * 55) - 0.5) * 7 * (1 - e / 0.6);
      }
      for (let k = 0; k < 3; k++) {
        const rr = fly(4, 260 - k * 60, 1.6 + k * 0.4, 0, e);
        const life = 1 - smooth(0.6 + k * 0.3, 1.6 + k * 0.3, e);
        if (life <= 0) continue;
        const h = 12 * life * (1 - k * 0.25);
        r.ring(C.x, C.y, rr - 4, 9, water(0.3), 0.5 * life, BLEND, 0.78);
        for (let a = 0; a < TAU; a += 0.015) {
          const wob = Math.sin(a * 9 + k * 3 + e * 6) * 2.5;
          const x = C.x + Math.cos(a) * (rr + wob), y = C.y + Math.sin(a) * (rr + wob) * 0.78;
          r.px(x, y, water(0.75), life);
          r.px(x, y - h * (0.6 + 0.4 * Math.sin(a * 5 + k)), FOAM, life * 1.1);
          if (hash(a * 100 + k) > 0.7) r.px(x, y - h * 0.5, water(0.85), life * 0.8);
        }
      }
      for (const tn of s.tunnels) {
        const u = (e - tn.t0) / 0.7;
        if (u < 0 || u > 1) continue;
        const x = C.x + Math.cos(tn.a) * tn.d, y = C.y + Math.sin(tn.a) * tn.d * 0.78;
        r.ring(x, y, tn.R * (1 - easeIn(u)), 2, FOAM, 1 - u, ADD, 0.6);
        r.disc(x, y, tn.R * (1 - easeIn(u)) * 0.7, water(0.1), 0.6 * (1 - u), BLEND, 0.6);
      }
      for (const d of s.drops) {
        const tl = 2 * d.vz / 320;
        const ee = Math.min(e, tl);
        const rr = fly(3, d.v, 0.6, 0, ee);
        const gx = C.x + Math.cos(d.a) * rr, gy = C.y + Math.sin(d.a) * rr * 0.78;
        if (e < tl) {
          const z = d.vz * e - 160 * e * e;
          r.px(gx, gy - z, FOAM, 1);
        } else if (e - tl < 3) r.decal(gx, gy, [0.04, 0.1, 0.16], 0.5 * (1 - (e - tl) / 3));
      }
      const wet = 1 - smooth(1.5, 3.5, e);
      if (wet > 0) r.light(C.x, C.y, 120, [0.3, 0.7, 1.2], wet * 0.8);
    }
  },
  post(r, t, s) {
    const C = { x: W / 2 + 26, y: H / 2 + 4 };
    const TS = 4.35, TX = 5.05;
    const tf = Math.min(t, TS);
    const amp = smooth(0.2, 3.5, tf) * (1 - smooth(TS + 0.3, TX, t)) * 1.1;
    const R = 140;
    if (amp > 0.02)
      r.warp(C.x - R, C.y - R, C.x + R, C.y + R, (x, y, o) => {
        const dx = x - C.x, dy = (y - C.y) / 0.78, d = Math.hypot(dx, dy) / R;
        if (d > 1 || d < 0.6) return;
        const tw = amp * Math.pow(1 - d, 2) * 2.4;
        const a = Math.atan2(dy, dx) + tw, rr = Math.hypot(dx, dy) * (1 - amp * 0.02 * (1 - d));
        o[0] = C.x + Math.cos(a) * rr;
        o[1] = C.y + Math.sin(a) * rr * 0.78;
      });
    const e = t - TX;
    if (e > 0 && e < 1.2) {
      const rr = e * 240, A = 5 * (1 - e / 1.2);
      r.warp(0, 0, W - 1, H - 1, (x, y, o) => {
        const dx = x - C.x, dy = (y - C.y) / 0.78, d = Math.hypot(dx, dy);
        const k = Math.exp(-Math.pow((d - rr) / 9, 2)) * A;
        if (k < 0.4) return;
        o[0] = x - dx / d * k;
        o[1] = y - dy / d * k;
      });
    }
  }
};
var TIDE = [abyssalBloom, riptideCalligraphy, mirrorfrostBasilica, undertowMaw];

// src/effects/tempest.ts
var VIOLET = [0.5, 0.2, 1.3];
var SCORCH = [0.05, 0.05, 0.08];
var fr = (t, rate = 30) => Math.floor(t * rate);
function liveBolt(r, seed, t, x0, y0, x1, y1, k = 1, rough = 0.3, branch = 0.4, rate = 30) {
  const segs = bolt(new RNG(seed * 7919 + fr(t, rate)), x0, y0, x1, y1, rough, branch);
  drawBolt(r, segs, k);
  return segs;
}
var chainVerdict = {
  id: 9,
  name: "Chain Verdict",
  school: "TEMPEST",
  duration: 8.5,
  climax: 6.32,
  blurb: "Electricity probes, fails, reroutes and remembers. Every abandoned path returns for the cascade.",
  setup(r) {
    const rng = new RNG(909);
    const nodes = [r.caster, r.anchors[5], r.anchors[3], r.anchors[0], r.anchors[1], r.anchors[2], r.anchors[4]].map((p, i) => ({ x: p.x + (i === 0 ? 5 : 0), y: p.y - (i === 0 ? 17 : 6) }));
    const order = [[0, 1, false], [1, 2, false], [2, 3, true], [3, 4, false], [4, 5, false], [5, 6, true], [6, 3, false], [6, 0, false]];
    const edges = order.map(([a, b, split], k) => {
      const A = nodes[a], B = nodes[b];
      let ghost, ghost2 = [];
      if (split) {
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
        const nx = -dy / L * 26, ny = dx / L * 26;
        ghost = [...bolt(rng, A.x, A.y, mx + nx, my + ny, 0.3, 0.3, 0, 0, 0.5), ...bolt(rng, mx + nx, my + ny, B.x, B.y, 0.3, 0.3, 0, 0.5, 1)];
        ghost2 = [...bolt(rng, A.x, A.y, mx - nx, my - ny, 0.3, 0.3, 0, 0, 0.5), ...bolt(rng, mx - nx, my - ny, B.x, B.y, 0.3, 0.3, 0, 0.5, 1)];
      } else ghost = bolt(rng, A.x, A.y, B.x, B.y, 0.3, 0.5);
      const fails = Array.from({ length: 3 }, () => {
        const ang = Math.atan2(B.y - A.y, B.x - A.x) + rng.r(-0.9, 0.9);
        const L = Math.hypot(B.x - A.x, B.y - A.y) * rng.r(0.8, 1.1);
        return { segs: bolt(rng, A.x, A.y, A.x + Math.cos(ang) * L, A.y + Math.sin(ang) * L, 0.35, 0.6), stop: rng.r(0.35, 0.7) };
      });
      return { a, b, ts: 0.9 + k * 0.55 + (k > 4 ? 0.2 : 0), split, ghost, ghost2, fails };
    });
    return { nodes, edges };
  },
  render(r, t, s) {
    const nodes = s.nodes, edges = s.edges;
    const TC = 5.75, TF = 6.55;
    r.ambient = 0.5;
    const charged = new Array(nodes.length).fill(-1);
    edges.forEach((e) => {
      const tc = e.ts + 0.32;
      if (t > tc) {
        if (charged[e.b] < 0) charged[e.b] = tc;
        if (charged[e.a] < 0) charged[e.a] = tc;
      }
    });
    nodes.forEach((n, i) => {
      if (t > TF + 0.3) return;
      const k = charged[i] >= 0 ? 0.5 : smooth(0, 0.8, t);
      for (let q = 0; q < 3; q++) {
        const sd = i * 13 + q * 101 + fr(t, 14);
        if (hash(sd) > 0.65) continue;
        const a = hash(sd + 1) * TAU, L = 6 + hash(sd + 2) * 14;
        drawBolt(r, bolt(new RNG(sd), n.x, n.y, n.x + Math.cos(a) * L, n.y + Math.sin(a) * L, 0.4, 0.2), 0.7 * k, 1, false);
      }
      for (let q = 0; q < 5; q++) r.px(n.x + (hash(q + fr(t) + i) - 0.5) * 6, n.y + (hash(q * 3 + fr(t) + i) - 0.5) * 6, ARC_MID, k);
      if (charged[i] >= 0) {
        const e = t - charged[i];
        r.ring(n.x, n.y, 3 + Math.sin(t * 20 + i) * 0.6, 1, ARC_MID, 0.8);
        if (e < 0.3) r.glow(n.x, n.y, 20, ARC_MID, 1.5 * (1 - e / 0.3));
        r.light(n.x, n.y, 30, [0.5, 0.6, 1.4], 0.5);
      }
    });
    edges.forEach((e, k) => {
      const lt = t - e.ts;
      if (lt < 0) return;
      const tc = 0.32;
      if (lt < tc) {
        const prog = Math.floor(lt / tc * 9) / 9;
        drawBolt(r, e.ghost, 0.9, prog, false);
        if (e.split) drawBolt(r, e.ghost2, 0.9, prog, false);
        e.fails.forEach((f) => drawBolt(r, f.segs, 0.7, Math.min(prog * 1.2, f.stop), false));
      } else {
        const rs = lt - tc;
        e.fails.forEach((f) => {
          const fk = Math.max(0, 0.6 - rs * 2) + 0.06;
          drawBolt(r, f.segs, fk, f.stop, false);
        });
        if (rs < 0.18) {
          const A = nodes[e.a], B = nodes[e.b];
          if (e.split) {
            drawBolt(r, e.ghost, 2.4);
            drawBolt(r, e.ghost2, 2.4);
          } else liveBolt(r, k + 1, t, A.x, A.y, B.x, B.y, 2.6, 0.3, 0.6);
          r.light((A.x + B.x) / 2, (A.y + B.y) / 2, 110, [0.6, 0.7, 1.6], 1.6);
          r.flash = Math.max(r.flash, 0.25 * (1 - rs / 0.18));
        } else {
          const gk = 0.16 + 0.05 * Math.sin(t * 9 + k);
          drawBolt(r, e.ghost, gk, 1, false, VIOLET, VIOLET, VIOLET);
          if (e.split) drawBolt(r, e.ghost2, gk, 1, false, VIOLET, VIOLET, VIOLET);
        }
      }
    });
    if (t > TC) {
      const all = [];
      edges.forEach((e) => {
        all.push(e.ghost);
        if (e.split) all.push(e.ghost2);
        e.fails.forEach((f) => all.push(f.segs.filter((sg) => sg.d <= f.stop)));
      });
      all.forEach((segs, i) => {
        const ti = TC + i * 0.025;
        const k = Math.exp(-Math.max(0, t - ti) * 9) * (t > ti ? 2.2 : 0) + pulse(TF - 0.25, TF + 0.05, t) * 1.8;
        if (k > 0.05) drawBolt(r, segs, k);
      });
      const web = pulse(TF - 0.3, TF + 0.15, t);
      if (web > 0) {
        r.light(W / 2 + 30, H / 2, 220, [0.5, 0.6, 1.5], web * 1.5);
        r.ambient = 0.5 - web * 0.3;
      }
      if (t > TF && t < TF + 0.1) r.flash = 0.5;
    }
    if (t > TF) {
      const e = t - TF;
      edges.forEach((ed, k) => {
        for (const sg of ed.ghost) r.decalLine(sg.x0, sg.y0, sg.x1, sg.y1, SCORCH, 0.6 * (1 - smooth(1, 2.2, e)));
        for (let q = 0; q < 3; q++) {
          const sd = k * 31 + q + fr(t, 12);
          if (hash(sd) > 0.5 * (1 - e / 2)) continue;
          const sg = ed.ghost[Math.floor(hash(sd + 3) * ed.ghost.length)];
          if (sg) sparkle(r, sg.x0, sg.y0, 2, ARC_CORE, 1.2);
        }
      });
    }
  }
};
var thunderloom = {
  id: 10,
  name: "Thunderloom",
  school: "TEMPEST",
  duration: 8,
  climax: 4.06,
  blurb: "A storm knitted from magnetic torus-knots winds itself up, reverses, and collapses into one white spear.",
  setup(r) {
    const rng = new RNG(1010);
    const C = { x: r.target.x - 20, y: r.target.y + 22 };
    const frac = Array.from({ length: 9 }, (_, k) => {
      const a = k / 9 * TAU + rng.r(-0.3, 0.3), L = rng.r(40, 95);
      return { segs: bolt(rng, C.x, C.y, C.x + Math.cos(a) * L, C.y + Math.sin(a) * L * 0.65, 0.35, 0.7), re: 4.7 + rng.r(0, 2.2) };
    });
    const spear = bolt(rng, C.x + 4, -20, C.x, C.y, 0.06, 0.25);
    return { C, frac, spear };
  },
  render(r, t, s) {
    const C = s.C;
    const TR = 3.25, TK = 3.95;
    const e = t - TK;
    const H0 = 52;
    const omega = (tt) => tt < TR ? 0.4 * tt + 0.55 * tt * tt : 0.4 * TR + 0.55 * TR * TR - 9 * (tt - TR) * (tt - TR) - 2 * (tt - TR);
    const Om = omega(Math.min(t, TK));
    const grow = easeOut(inv(0.4, 2.2, t));
    const collapse = 1 - easeIn(inv(TR + 0.1, TK, t));
    const S = 13 * grow * collapse;
    if (t < TK + 0.3) {
      r.shadow(C.x, C.y, 60 * grow, 26 * grow, 0.6);
      r.ambient = 0.6 - grow * 0.25;
    }
    if (t < TK) {
      for (let q = 0; q < 8; q++) {
        const sd = q + fr(t, 10) * 9;
        if (hash(sd) > 0.4) continue;
        sparkle(r, C.x + (hash(sd + 1) - 0.5) * 120, C.y - H0 + (hash(sd + 2) - 0.5) * 70, 2, ARC_MID, 0.9);
      }
      const knots = [[2, 3, 0], [3, 2, 1.2], [2, 5, 2.1], [3, 4, 0.6], [1, 4, 3]];
      const pts = [];
      knots.forEach(([p, q, ph], k) => {
        const sign = k % 2 ? -1 : 1;
        const rot = Om * sign + ph;
        const arr = [];
        for (let i = 0; i < 150; i++) {
          const u = i / 150 * TAU;
          const rr = 2 + Math.cos(q * u + t * 0.5);
          let x = rr * Math.cos(p * u), y = rr * Math.sin(p * u);
          const z = Math.sin(q * u) * 1.2;
          const xr = x * Math.cos(rot) - y * Math.sin(rot), yr = x * Math.sin(rot) + y * Math.cos(rot);
          arr.push({ x: C.x + xr * S * 1.4, y: C.y - H0 + yr * S * 0.55 - z * S * 0.8, z: yr });
        }
        pts.push(arr);
        const vis = smooth(0.3 + k * 0.25, 1.2 + k * 0.25, t);
        arr.forEach((pt, i) => {
          const pul = Math.pow(0.5 + 0.5 * Math.sin(i * 0.3 - t * 8 * sign), 10);
          const dk = 0.35 + 0.35 * (pt.z / 3 + 0.5);
          if (i % 2 === 0 || pul > 0.3) r.px(pt.x, pt.y, pul > 0.3 ? ARC_CORE : k % 2 ? VIOLET : ARC_MID, vis * dk * (0.6 + pul * 1.5));
        });
      });
      const nJ = Math.floor(2 + grow * 6 + (1 - collapse) * 6);
      for (let q = 0; q < nJ; q++) {
        const sd = q * 17 + fr(t, 20) * 3;
        const a = pts[Math.floor(hash(sd) * pts.length)], b = pts[Math.floor(hash(sd + 1) * pts.length)];
        const i = Math.floor(hash(sd + 2) * 150);
        if (a === b) continue;
        drawBolt(r, bolt(new RNG(sd), a[i].x, a[i].y, b[i].x, b[i].y, 0.4, 0.2), 1.1, 1, false);
      }
      for (let k = 0; k < 3; k++) {
        const a = Om * 1.6 * (k % 2 ? -1 : 1) + k * 2.1;
        const x = C.x + Math.cos(a) * S * 1.6, y = C.y - H0 + Math.sin(a) * S * 0.7;
        r.disc(x, y, 1.5 + grow, ARC_CORE, 1.4);
        r.glow(x, y, 9, ARC_MID, 0.9);
      }
      r.light(C.x, C.y - H0, 70, [0.5, 0.5, 1.4], grow * 0.6);
      if (t > TR) {
        r.glow(C.x, C.y - H0, 18 * (1 - collapse) + 2, ARC_CORE, (1 - collapse) * 2);
      }
    }
    if (e >= 0) {
      if (e < 0.22) {
        const fl = e < 0.04 ? 1 : 0.6 + 0.4 * hash(fr(t, 60));
        drawBolt(r, s.spear, 3.2 * fl);
        for (const sg of s.spear) if (sg.w === 0) r.thick(sg.x0, sg.y0, sg.x1, sg.y1, 3, [3, 3, 3.5], fl, SET);
        r.glow(C.x, C.y, 34, [1.2, 1.4, 2.4], 1.2 * (1 - e / 0.22));
        r.flash = e < 0.035 ? 0.9 : 0;
        r.flashCol = [0.85, 0.9, 1.2];
      }
      if (e < 0.5) {
        r.shakeX = (hash(t * 60) - 0.5) * 8 * (1 - e * 2);
        r.shakeY = (hash(t * 66) - 0.5) * 6 * (1 - e * 2);
      }
      r.light(C.x, C.y, 180, [0.7, 0.8, 1.8], 1.6 * Math.exp(-e * 4));
      r.decalDisc(C.x, C.y, 7, SCORCH, 0.9, 0.3);
      r.ring(C.x, C.y, 3, 1, ARC_CORE, Math.exp(-e * 2) * 2, ADD, 0.65);
      s.frac.forEach((f, k) => {
        const upto = clamp(e * 7);
        for (const sg of f.segs) if (sg.d < upto) r.decalLine(sg.x0, sg.y0, sg.x1, sg.y1, SCORCH, 0.7);
        const main = Math.exp(-e * 2.5) * 1.6;
        const re = t - f.re;
        const reK = re > 0 && re < 0.25 ? (1 - re / 0.25) * 1.8 * (hash(fr(t, 40) + k) > 0.3 ? 1 : 0.2) : 0;
        drawBolt(r, f.segs, Math.max(main, reK, 0.08 * (1 - smooth(5, 8, t))), upto, main > 0.5 || reK > 0, ARC_CORE, ARC_MID, ARC_GLOW);
        if (reK > 0) {
          const end = f.segs[f.segs.length - 1];
          r.light(end.x1, end.y1, 30, [0.6, 0.7, 1.6], reK);
        }
      });
      if (e < 0.7) r.ring(C.x, C.y, easeOut(e / 0.7) * 120, 1, VIOLET, 1 - e / 0.7, ADD, 0.65);
    }
  },
  post(r, t, s) {
    const e = t - 3.95;
    if (e < 0 || e > 0.55) return;
    const amp = 1 - e / 0.55;
    const f = fr(t, 30);
    const c = r.c, tmp = r.tmp;
    tmp.set(c);
    for (let y = 0; y < H; y++) {
      const band = Math.floor(y / 3);
      const hsh = hash(band * 1.7 + f * 13.1);
      const off = hsh > 0.72 ? Math.round((hash(band + f) - 0.5) * 18 * amp) : 0;
      const split = Math.round(2 * amp);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        const sx = Math.min(W - 1, Math.max(0, x - off));
        const sr = Math.min(W - 1, sx + split), sb = Math.max(0, sx - split);
        c[i] = tmp[(y * W + sr) * 3];
        c[i + 1] = tmp[(y * W + sx) * 3 + 1];
        c[i + 2] = tmp[(y * W + sb) * 3 + 2];
      }
    }
  }
};
var voltCarousel = {
  id: 11,
  name: "Volt Carousel",
  school: "TEMPEST",
  duration: 8.5,
  climax: 5.08,
  blurb: "A forbidden engine of eccentric halos. Bridges form only when segments align \u2014 until everything does.",
  setup(r) {
    const rng = new RNG(1111);
    const rings = [
      { R: 14, n: 3, kind: 2, w: 2.4, ecc: 6, ef: 1.3, ph: 0, jumps: [] },
      { R: 26, n: 6, kind: 0, w: -1.5, ecc: 10, ef: -0.9, ph: 1, jumps: [] },
      { R: 38, n: 6, kind: 1, w: 1, ecc: 14, ef: 0.7, ph: 2, jumps: [] },
      { R: 52, n: 12, kind: 0, w: -0.7, ecc: 8, ef: -1.1, ph: 3, jumps: [] },
      { R: 66, n: 6, kind: 2, w: 0.5, ecc: 18, ef: 0.5, ph: 4, jumps: [] }
    ];
    rings.forEach((g) => g.jumps = Array.from({ length: 4 }, () => rng.r(2.4, 4.4)).sort());
    return { rings };
  },
  render(r, t, s) {
    const C = { x: r.caster.x + 58, y: r.caster.y - 24 };
    const TA = 4.95;
    const e = t - TA;
    const rings = s.rings;
    const form = (k) => easeOut(inv(0.2 + k * 0.2, 0.9 + k * 0.2, t));
    const settle = smooth(4.3, TA, t);
    const energy = smooth(1.5, TA, t);
    const frame = (g, k, tt) => {
      let jump = 0, rj = 0;
      g.jumps.forEach((jt, q) => {
        const st = smooth(jt, jt + 0.08, tt);
        jump += st * (q % 2 ? -1.3 : 0.9);
        rj += st * (q % 2 ? -7 : 6);
      });
      const unstable = 1 - settle;
      const A = g.w * (tt - TA) * (1 + energy * 0.6 * unstable) + (jump + g.ph * 0.4) * unstable + (k % 2 ? 0 : Math.PI / g.n) * 0;
      const cx = C.x + Math.cos(tt * g.ef + g.ph) * g.ecc * unstable;
      const cy = C.y + Math.sin(tt * g.ef + g.ph) * g.ecc * 0.6 * unstable;
      return { A, cx, cy, R: (g.R + rj * unstable) * (0.4 + 0.6 * form(k)) };
    };
    const nodesOf = (g, k) => {
      const f = frame(g, k, Math.min(t, TA));
      return Array.from({ length: g.n }, (_, j) => {
        const a = f.A + j / g.n * TAU;
        return { x: f.cx + Math.cos(a) * f.R, y: f.cy + Math.sin(a) * f.R * 0.6, a, f };
      });
    };
    r.ambient = 0.55 - energy * 0.15;
    r.light(C.x, C.y, 90, [0.5, 0.6, 1.5], 0.4 + energy * 0.8);
    if (e < 0) {
      const all = rings.map((g, k) => nodesOf(g, k));
      rings.forEach((g, k) => {
        const fk = form(k);
        if (fk <= 0) return;
        const ns = all[k], f = ns[0].f;
        if (g.kind === 0) {
          for (let j = 0; j < g.n; j += 2) {
            const a0 = f.A + j / g.n * TAU, a1 = f.A + (j + 1) / g.n * TAU;
            for (let a = a0; a < a1; a += 0.03) r.px(f.cx + Math.cos(a) * f.R, f.cy + Math.sin(a) * f.R * 0.6, ARC_MID, fk * (0.7 + energy * 0.5));
          }
        } else if (g.kind === 1) {
          for (let j = 0; j < g.n; j++) {
            const a = ns[j].a;
            r.line(ns[j].x, ns[j].y, ns[j].x + Math.cos(a) * 7, ns[j].y + Math.sin(a) * 4.2 - 4, VIOLET, fk * 1.4);
            const a2 = a + TAU / g.n * 0.5;
            if (j % 3 !== 2) for (let aa = a; aa < a2; aa += 0.04) r.px(f.cx + Math.cos(aa) * f.R, f.cy + Math.sin(aa) * f.R * 0.6, VIOLET, fk);
          }
        } else {
          const pts = [];
          for (let j = 0; j < g.n * 4; j++) {
            const a = f.A + j / (g.n * 4) * TAU;
            const rr = f.R * (j % 4 < 2 ? 1 : 0.82);
            pts.push(f.cx + Math.cos(a) * rr, f.cy + Math.sin(a) * rr * 0.6);
          }
          r.polyline(pts, ARC_MID, fk * 0.8, ADD, true);
        }
        ns.forEach((n) => {
          r.disc(n.x, n.y, 1.2, ARC_CORE, fk * 1.2);
        });
      });
      const thr = 7 + energy * 9;
      let count = 0;
      for (let k = 0; k < rings.length - 1; k++)
        for (const a of all[k])
          for (const b of all[k + 1]) {
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < thr && count < 40) {
              count++;
              liveBolt(r, k * 100 + Math.floor(a.a * 10) + Math.floor(b.a * 7), t, a.x, a.y, b.x, b.y, 1.3 * (1 - d / thr) + 0.3, 0.35, 0.2, 24);
            }
          }
      if (energy > 0.4) {
        for (let q = 0; q < 2; q++) {
          const sd = q * 9 + fr(t, 8) * 5;
          if (hash(sd) > energy * 0.7) continue;
          const A = all[Math.floor(hash(sd + 1) * 5)], B = all[Math.floor(hash(sd + 2) * 5)];
          const a = A[Math.floor(hash(sd + 3) * A.length)], b = B[Math.floor(hash(sd + 4) * B.length)];
          liveBolt(r, sd, t, a.x, a.y, b.x, b.y, 1.5, 0.35, 0.5, 30);
        }
      }
    } else {
      const all = rings.map((g, k) => nodesOf(g, k));
      const blaze = Math.exp(-e * 3);
      if (e < 0.5) {
        for (let k = 0; k < rings.length - 1; k++)
          for (const a of all[k])
            for (const b of all[k + 1]) {
              const da = Math.abs(((a.a - b.a) % TAU + TAU + Math.PI) % TAU - Math.PI);
              if (da < 0.05) liveBolt(r, k * 31 + Math.floor(a.a * 10), t, a.x, a.y, b.x, b.y, 2.4 * blaze + 0.5, 0.25, 0.3, 40);
            }
        rings.forEach((g, k) => {
          const ns = all[k];
          for (let j = 0; j < ns.length; j++) {
            const n2 = ns[(j + 1) % ns.length];
            r.line(ns[j].x, ns[j].y, n2.x, n2.y, ARC_CORE, 1.6 * blaze);
          }
        });
        for (let q = 0; q < 12; q++) {
          const a = q / 12 * TAU;
          const L = 66 + easeOut(e / 0.3) * 80;
          liveBolt(r, 500 + q, t, C.x + Math.cos(a) * 66, C.y + Math.sin(a) * 40, C.x + Math.cos(a) * L, C.y + Math.sin(a) * L * 0.6, 1.8 * blaze, 0.3, 0.5, 30);
        }
        r.glow(C.x, C.y, 28, ARC_CORE, 1 * blaze);
        r.flash = e < 0.06 ? 0.7 : 0;
        r.shakeX = (hash(t * 40) - 0.5) * 6 * blaze;
      }
      r.light(C.x, C.y, 170, [0.6, 0.7, 1.7], 2 * blaze);
      rings.forEach((g, k) => {
        const f = all[k][0].f;
        for (let j = 0; j < g.n; j++) {
          const a0 = j / g.n * TAU + g.w * e * 1.5;
          const rr = f.R + fly(0, 40 + k * 10, 1.5, 0, e);
          const life = 1 - smooth(0.8, 2.2, e);
          if (life <= 0) continue;
          const span = TAU / g.n * 0.55;
          for (let a = a0; a < a0 + span; a += 0.05) r.px(C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * 0.6 + e * e * 10, k % 2 ? VIOLET : ARC_MID, life * 1.2);
          if (hash(j + k * 13 + fr(t, 15)) > 0.75) sparkle(r, C.x + Math.cos(a0) * rr, C.y + Math.sin(a0) * rr * 0.6 + e * e * 10, 2, ARC_CORE, life);
        }
      });
    }
  }
};
var skybreakerScript = {
  id: 12,
  name: "Skybreaker Script",
  school: "TEMPEST",
  duration: 9.5,
  climax: 7,
  blurb: "A spark writes an asymmetric glyph that then behaves like a circuit \u2014 forking, overloading, detonating.",
  setup(r) {
    const rng = new RNG(1212);
    const G = { x: W / 2 + 30, y: H / 2 - 2 };
    const arc = [];
    for (let a = 200; a <= 340; a += 10) arc.push([Math.cos(a * Math.PI / 180) * 76, Math.sin(a * Math.PI / 180) * 76 + 18]);
    const defs = [
      [[[0, -64], [0, 60]], true, 0, 0],
      [[[-54, -18], [-8, -30], [48, -14]], false, 1, 0],
      [[[0, -46], [14, -32], [0, -18], [-14, -32], [0, -46]], false, 1, 2],
      [[[-60, 8], [-36, 28], [-52, 44], [-24, 54]], false, 2, 1],
      [[[0, 10], [30, 20], [52, 4], [66, 28]], true, 1, 0],
      [arc, false, 2, 2],
      [[[18, 38], [40, 56], [60, 44]], true, 2, 1],
      [[[-34, -50], [-22, -64], [-12, -48], [-34, -50]], false, 2, 0],
      [[[-44, 64], [44, 64]], true, 1, 0],
      [[[-74, -26], [-62, -38], [-70, -50], [-56, -62]], false, 3, 2],
      [[[22, -40], [36, -56], [52, -44], [70, -58]], false, 3, 0]
    ];
    let tcur = 0.4;
    const strokes = defs.map(([pts, burst, level, fate]) => {
      const rs = resample(pts.map(([x, y]) => ({ x: G.x + x * 1.05, y: G.y + y * 0.85 })), 1);
      const dur = burst ? 0.06 : 0.25 + rs.total / 260;
      const st = { p: rs.p, len: rs.len, total: rs.total, ts: tcur, dur, burst, level, fate };
      tcur += dur + rng.r(0.08, 0.3);
      return st;
    });
    return { G, strokes, buildEnd: tcur };
  },
  render(r, t, s) {
    const G = s.G, strokes = s.strokes;
    const TCIR = 4.9, TDET = 6.55, TRUP = 7.25;
    r.ambient = 0.5 - smooth(4, 6, t) * 0.12;
    let pen = null;
    strokes.forEach((S, si) => {
      const u = clamp((t - S.ts) / S.dur);
      if (t < S.ts) return;
      const ta = TCIR + S.level * 0.3 + si % 3 * 0.05;
      const act = t - ta;
      const shown = S.total * (S.burst ? 1 : easeInOut(u));
      const fold = S.fate === 2 ? easeIn(inv(ta + 0.4, ta + 1.1, t)) : 0;
      const frac = S.fate === 1 ? smooth(ta + 0.45, ta + 0.5, t) : 0;
      for (let i = 0; i < S.p.length; i++) {
        if (S.len[i] > shown) {
          pen = S.p[i];
          break;
        }
        let x = S.p[i].x, y = S.p[i].y;
        if (fold > 0) {
          const jag = (hash(i >> 3) - 0.5) * 10 * Math.sin(fold * Math.PI);
          x = lerp(x, G.x, fold) + jag;
          y = lerp(y, G.y, fold) - jag * 0.5;
        }
        let fk = 1;
        if (frac > 0) {
          const piece = Math.floor(i / 7);
          const ee = t - (ta + 0.45);
          x += (hash(piece) - 0.5) * ee * 50;
          y += fly(0, -20 - hash(piece + 3) * 30, 0, 120, ee);
          fk = 1 - smooth(0.4, 1.4, ee);
          if (i % 7 === 0) continue;
        }
        if (t > TRUP) fk *= 0;
        if (hash(i * 7 + fr(t, 24)) > 0.9) {
          x += hash(i + fr(t)) > 0.5 ? 1 : -1;
        }
        const flow = Math.pow(0.5 + 0.5 * Math.sin(S.len[i] * 0.35 - t * 22), 8);
        let k = 0.6 + flow * 1.4;
        if (act > 0) {
          const head = act / 0.25 * S.total;
          const hk = Math.exp(-Math.abs(S.len[i] - head) * 0.15);
          k += (S.len[i] < head ? 0.9 : 0) + hk * 2.5;
        }
        const fresh = Math.exp(-(t - S.ts - S.len[i] / S.total * S.dur) * 6);
        r.px(x, y, flow > 0.5 || fresh > 0.3 ? ARC_CORE : ARC_MID, k * fk + fresh * 2);
        if (i % 2 === 0) {
          r.px(x + 1, y, ARC_GLOW, 0.5 * k * fk);
          r.px(x, y + 1, ARC_GLOW, 0.4 * k * fk);
        }
      }
      if (S.burst && t - S.ts < 0.12) {
        drawBolt(r, bolt(new RNG(si * 33 + fr(t, 40)), S.p[0].x, S.p[0].y, S.p[S.p.length - 1].x, S.p[S.p.length - 1].y, 0.12, 0.6), 2);
        r.light(G.x, G.y, 120, [0.6, 0.7, 1.6], 1.2);
      }
      if (u < 1 && !S.burst && pen) {
        sparkle(r, pen.x, pen.y, 3, ARC_CORE, 1.6);
        const prev = strokes[si - 1];
        if (prev) {
          const pe = prev.p[prev.p.length - 1];
          drawBolt(r, bolt(new RNG(si * 7 + fr(t, 30)), pe.x, pe.y, pen.x, pen.y, 0.35, 0.4), 0.5, 1, false);
        }
        r.light(pen.x, pen.y, 40, [0.6, 0.7, 1.6], 0.8);
      }
    });
    if (t < s.buildEnd) {
      const done = strokes.filter((S) => t > S.ts + S.dur), todo = strokes.filter((S) => t < S.ts);
      const sd = fr(t, 5);
      if (done.length && todo.length && hash(sd * 3.3) > 0.4 && t * 5 % 1 < 0.35) {
        const a = done[Math.floor(hash(sd) * done.length)], b = todo[Math.floor(hash(sd + 1) * todo.length)];
        const pa = a.p[Math.floor(hash(sd + 2) * a.p.length)], pb = b.p[Math.floor(hash(sd + 3) * b.p.length)];
        drawBolt(r, bolt(new RNG(sd * 11 + fr(t, 30)), pa.x, pa.y, lerp(pa.x, pb.x, 0.8), lerp(pa.y, pb.y, 0.8), 0.4, 0.4), 1.2);
      }
    }
    if (t > TCIR && t < TRUP) r.light(G.x, G.y, 140, [0.5, 0.6, 1.5], 0.4 + smooth(TCIR, TRUP, t) * 1.2);
    if (t > TDET) {
      strokes.forEach((S, si) => {
        if (S.fate === 1) return;
        for (let i = 0; i < S.p.length; i += 9) {
          const p = S.p[i];
          const d = Math.hypot(p.x - G.x, p.y - G.y);
          const td = TDET + (1 - d / 90) * 0.6 + hash(i + si) * 0.08;
          const ee = t - td;
          if (ee < 0 || ee > 0.35) continue;
          const k = 1 - ee / 0.35;
          r.ring(p.x, p.y, 1 + ee * 22, 1, ARC_CORE, k * 1.4);
          r.disc(p.x, p.y, 2.5 * k, ARC_CORE, k * 2);
          for (let q = 0; q < 5; q++) {
            const a = hash(i * 5 + q) * TAU;
            r.px(p.x + Math.cos(a) * ee * 40, p.y + Math.sin(a) * ee * 40, ARC_MID, k * 1.5);
          }
          r.decalDisc(p.x, p.y, 2.5, SCORCH, 0.7);
        }
      });
    }
    if (t > TRUP) {
      const e = t - TRUP;
      const k = Math.exp(-e * 3);
      if (e < 0.05) r.flash = 0.6;
      if (e < 0.6) {
        r.shakeX = (hash(t * 50) - 0.5) * 10 * (1 - e / 0.6);
        r.shakeY = (hash(t * 57) - 0.5) * 8 * (1 - e / 0.6);
      }
      r.glow(G.x, G.y, 36, ARC_CORE, 1.2 * k);
      r.disc(G.x, G.y, 6 * k, [3, 3, 3.5], 2);
      for (let q = 0; q < 14; q++) {
        const a = q / 14 * TAU + hash(q) * 0.3, L = 50 + hash(q + 1) * 90;
        drawBolt(r, bolt(new RNG(q * 77 + fr(t, 20)), G.x, G.y, G.x + Math.cos(a) * L, G.y + Math.sin(a) * L * 0.7, 0.3, 0.6), 2 * k, clamp(e * 6));
      }
      r.ring(G.x, G.y, easeOut(e / 0.8) * 160, 2, ARC_MID, (1 - clamp(e / 0.8)) * 1.5, ADD, 0.75);
      r.light(G.x, G.y, 220, [0.6, 0.7, 1.7], 1.4 * k);
      strokes.forEach((S) => {
        for (let i = 0; i < S.p.length; i += 1) r.decal(S.p[i].x, S.p[i].y, SCORCH, 0.7 * (1 - smooth(1.2, 2.2, e)));
      });
      for (let i = 0; i < 30; i++) {
        const ee = e - hash(i) * 1.5;
        if (ee < 0 || ee > 0.6) continue;
        const S = strokes[i % strokes.length], p = S.p[Math.floor(hash(i + 4) * S.p.length)];
        sparkle(r, p.x, p.y, 2, ARC_MID, 1 - ee / 0.6);
      }
    }
  },
  post(r, t) {
    const e = t - 7.25;
    if (e < 0 || e > 0.9) return;
    const G = { x: W / 2 + 30, y: H / 2 - 2 };
    const R = easeOut(e / 0.8) * 160, A = 4 * (1 - e / 0.9);
    r.warp(0, 0, W - 1, H - 1, (x, y, o) => {
      const dx = x - G.x, dy = (y - G.y) / 0.75, d = Math.hypot(dx, dy) || 1;
      const k = Math.exp(-Math.pow((d - R) / 7, 2)) * A;
      if (k < 0.4) return;
      o[0] = x - dx / d * k;
      o[1] = y - dy / d * k;
    });
  }
};
var TEMPEST = [chainVerdict, thunderloom, voltCarousel, skybreakerScript];

// src/effects/verdant.ts
var BARK = [0.16, 0.09, 0.05];
var BARK_HI = [0.34, 0.2, 0.09];
var VEIN = [0.3, 1.5, 0.55];
var LIME = [0.95, 1.8, 0.4];
var GOLD = [1.7, 1.15, 0.3];
var TEAL = [0.25, 1.3, 1.2];
var PINK = [1.6, 0.42, 0.8];
var PINK_HI = [2, 1.1, 1.3];
var LEAF_D = [0.07, 0.22, 0.07];
var LEAF = [0.18, 0.5, 0.14];
var LEAF_HI = [0.45, 0.95, 0.3];
var WITHER = [0.2, 0.17, 0.13];
function petal(r, x, y, a, s, c, hi, k = 1) {
  const ca = Math.cos(a), sa = Math.sin(a);
  r.poly([x, y, x + ca * s - sa * s * 0.5, y + sa * s + ca * s * 0.5, x + ca * s * 2, y + sa * s * 2, x + ca * s + sa * s * 0.5, y + sa * s - ca * s * 0.5], c, k, DITHER);
  r.px(x + ca * s, y + sa * s, hi, 1, SET);
}
var rootwake = {
  id: 13,
  name: "Rootwake",
  school: "VERDANT",
  duration: 10,
  climax: 5.75,
  blurb: "Roots explore with a heartbeat; blooms send pulses back that wake new growth, until the network clenches as one.",
  setup(r) {
    const rng = new RNG(1313);
    const C = { x: r.caster.x + 4, y: r.caster.y + 4 };
    const T = r.target;
    const nodes = [];
    const flowers = [];
    const base = Math.atan2(T.y - C.y, T.x - C.x);
    const grow = (pi, x, y, a, len, t0, th, main, d0, gen) => {
      let tt = t0, prev = pi, dist2 = d0;
      const steps = Math.floor(len / 2);
      let phase = rng.r(0, TAU);
      for (let s = 0; s < steps; s++) {
        a += (noise1(s * 0.15 + main * 9 + gen * 3) - 0.5) * 0.5;
        if (gen === 0) a += Math.atan2(Math.sin(base - a), Math.cos(base - a)) * 0.015;
        x += Math.cos(a) * 2;
        y += Math.sin(a) * 2;
        dist2 += 2;
        const sp = 70 * (0.25 + Math.pow(Math.sin(phase + s * 0.12), 2)) * (gen ? 0.8 : 1);
        tt += 2 / sp + (rng.next() < 0.02 ? 0.25 : 0);
        nodes.push({ x, y, tb: tt, p: prev, th: th * (1 - s / steps * 0.7), main: gen === 0 ? main : -1, dist: dist2 });
        prev = nodes.length - 1;
        if (gen < 2 && rng.next() < (gen ? 0.03 : 0.06)) grow(prev, x, y, a + rng.sign() * rng.r(0.5, 1.2), (len - s * 2) * rng.r(0.3, 0.6), tt, th * 0.5, main, dist2, gen + 1);
        if (gen === 0 && s > 18 && s % 22 === 0 && flowers.length < 9) {
          const path = [];
          for (let q = prev; q >= 0; q = nodes[q].p) path.push(q);
          flowers.push({ i: prev, tb: tt + 0.5, path });
        }
      }
    };
    for (let m = 0; m < 6; m++) grow(-1, C.x, C.y, base + (m - 2.5) * 0.42 + rng.r(-0.1, 0.1), rng.r(130, 190), 0.2 + m * 0.08, 3.2, m, 0, 0);
    for (const f of flowers) {
      const n = nodes[f.i];
      for (let k = 0; k < 2; k++) grow(f.i, n.x, n.y, rng.r(0, TAU), rng.r(30, 55), f.tb + 0.35, 1.4, -1, n.dist, 2);
    }
    const tendrils = Array.from({ length: 4 }, (_, k) => {
      const a = base + (k - 1.5) * 0.9 + Math.PI;
      const sx = T.x + Math.cos(a) * 160, sy = T.y + Math.sin(a) * 110;
      return [{ x: sx, y: sy }, { x: lerp(sx, T.x, 0.4) + rng.r(-30, 30), y: lerp(sy, T.y, 0.4) + rng.r(-30, 30) }, { x: lerp(sx, T.x, 0.8) + rng.r(-15, 15), y: lerp(sy, T.y, 0.8) + rng.r(-15, 15) }, { x: T.x, y: T.y }];
    });
    return { C, nodes, flowers, tendrils };
  },
  render(r, t, s) {
    const T = r.target;
    const nodes = s.nodes;
    const TT = 5.2;
    const tight = easeInOut(inv(TT, TT + 0.5, t)) * (1 - smooth(6.5, 8, t) * 0.6);
    const wither = smooth(6.6, 9.4, t);
    const rise = smooth(2.8, 4.2, t);
    r.ambient = 0.55;
    const pos = (n) => ({ x: lerp(n.x, T.x, tight * 0.22), y: lerp(n.y, T.y, tight * 0.22) });
    const pulses = [];
    for (const f of s.flowers) {
      const e = t - f.tb;
      if (e > 0 && e < 1.2) pulses.push({ path: f.path, head: e * 140 });
    }
    const pulseAt = /* @__PURE__ */ new Map();
    for (const p of pulses) {
      const nf = nodes[p.path[0]];
      for (const q of p.path) {
        const d = nf.dist - nodes[q].dist;
        const k = Math.exp(-Math.pow((d - p.head) / 6, 2));
        if (k > 0.05) pulseAt.set(q, Math.max(pulseAt.get(q) || 0, k));
      }
    }
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.tb > t) continue;
      const mat = smooth(n.tb, n.tb + 0.8, t);
      let w = n.th * (0.35 + 0.65 * mat) * (1 - wither * 0.6);
      const P = pos(n);
      const pp = n.p >= 0 ? pos(nodes[n.p]) : P;
      let lift = 0;
      if (n.main >= 0 && n.main % 2 === 0) {
        const u = n.dist % 70 / 70;
        lift = Math.sin(u * Math.PI) * 9 * rise * (n.dist > 30 ? 1 : 0) * (1 - wither);
        w *= 1 + rise * 0.5;
      }
      const lp = n.p >= 0 && nodes[n.p].main === n.main && n.main >= 0 && n.main % 2 === 0 ? Math.sin(nodes[n.p].dist % 70 / 70 * Math.PI) * 9 * rise * (nodes[n.p].dist > 30 ? 1 : 0) * (1 - wither) : lift;
      r.decalLine(pp.x, pp.y, P.x, P.y, [0.07, 0.05, 0.04], 0.7);
      if (lift > 1) r.shadow(P.x + 2, P.y + 2, w + 1, w * 0.6 + 1, 0.5);
      const bark = mixc(BARK, WITHER, wither);
      r.thick(pp.x, pp.y - lp, P.x, P.y - lift, w * 2, bark, 1, SET);
      if (w > 1.2) r.px(P.x - w * 0.4, P.y - lift - w * 0.5, mixc(BARK_HI, WITHER, wither), 1, SET);
      const pk = Math.pow(0.5 + 0.5 * Math.sin(n.dist * 0.18 - t * 9), 6) * (n.main >= 0 ? 1 : 0.5);
      const pul = pulseAt.get(i) || 0;
      const vk = (0.25 + pk * 0.8 + pul * 2) * (1 - wither * 0.7) * mat;
      if (w > 0.9) r.px(P.x, P.y - lift, pul > 0.3 ? GOLD : VEIN, vk);
      const thornWave = n.main >= 0 ? smooth(TT + 0.25 + n.dist / 260, TT + 0.32 + n.dist / 260, t) * (1 - wither) : 0;
      if ((lift > 3 || thornWave > 0) && i % 3 === 0) {
        const dx = P.x - pp.x, dy = P.y - pp.y, L = Math.hypot(dx, dy) || 1;
        const sg = i % 2 ? 1 : -1;
        const len = (lift > 3 ? 3 : 0) + thornWave * 7 * (0.6 + hash(i) * 0.6);
        r.line(P.x, P.y - lift, P.x - dy / L * len * sg + dx / L * len * 0.3, P.y - lift + dx / L * len * sg + dy / L * len * 0.3, mixc([0.5, 0.45, 0.25], WITHER, wither), 1, SET);
      }
      if (t - n.tb < 0.06) {
        r.px(P.x, P.y, LIME, 1.6);
        r.light(P.x, P.y, 14, [0.4, 1, 0.4], 0.4);
      }
      if (wither > 0.3 && n.main >= 0 && i % 2 === 0) r.px(P.x, P.y, VEIN, 0.35 * smooth(0.3, 1, wither) * (0.5 + 0.5 * Math.sin(t * 2 + n.dist * 0.05)));
    }
    if (rise > 0)
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (n.main < 0 || n.main % 2 || n.tb > t || n.dist < 30) continue;
        const P = pos(n);
        const u = n.dist % 70 / 70, lift = Math.sin(u * Math.PI) * 9 * rise * (1 - wither);
        const o = Math.sin(n.dist * 0.35 + t * 1.5) * 3.5 * rise;
        r.px(P.x, P.y - lift + o, mixc(LEAF_HI, WITHER, wither), 1, SET);
        r.px(P.x, P.y - lift - o, mixc(LEAF, WITHER, wither), 1, SET);
      }
    for (const f of s.flowers) {
      const e = t - (f.tb - 0.3);
      if (e < 0) continue;
      const P = pos(nodes[f.i]);
      const op = easeOutBack(clamp(e / 0.5)) * (1 - wither * 0.8);
      for (let k = 0; k < 5; k++) petal(r, P.x, P.y - 2, k / 5 * TAU + f.i, 2.6 * op, mixc(PINK, WITHER, wither), PINK_HI);
      r.disc(P.x, P.y - 2, 1.2, GOLD, 1.2 * (1 - wither));
      if (e < 0.5) r.glow(P.x, P.y, 14, GOLD, 1 - e / 0.5);
      r.light(P.x, P.y, 26, [1.2, 0.6, 0.8], 0.5 * (1 - wither));
    }
    s.tendrils.forEach((ctrl, k) => {
      const st = TT + 0.05 + k * 0.06;
      const u = easeIn(inv(st, st + 0.25, t));
      if (u <= 0) return;
      const ret = 1 - smooth(6.3, 7.8, t);
      if (ret <= 0) return;
      const n = 40;
      for (let q = 0; q < n * u * ret; q++) {
        const p = catmull(ctrl, q / n), p2 = catmull(ctrl, (q + 1) / n);
        const w = (1 - q / n) * 6 + 1.5;
        r.thick(p.x, p.y, p2.x, p2.y, w, BARK, 1, SET);
        r.px(p.x - 1, p.y - w * 0.4, BARK_HI, 1, SET);
        if (q % 3 === 0) r.line(p.x, p.y, p.x + (q % 2 ? 1 : -1) * w * 0.9, p.y - w * 0.9, [0.5, 0.45, 0.25], 1, SET);
        if (q % 2 === 0) r.px(p.x, p.y, VEIN, 0.6);
      }
    });
    if (t > TT + 0.28 && t < TT + 0.36) {
      r.flash = 0.25;
      r.flashCol = [0.6, 1, 0.5];
    }
    if (t > TT + 0.28 && t < TT + 0.8) {
      r.shakeX = (hash(t * 40) - 0.5) * 5;
      r.shakeY = (hash(t * 44) - 0.5) * 4;
    }
    const glow = pulse(TT, TT + 1.2, t);
    r.light(T.x, T.y, 120, [0.5, 1.3, 0.5], glow * 1.2);
    for (let k = 0; k < 70; k++) {
      const st = 5.6 + hash(k) * 1.5;
      const e = t - st;
      if (e < 0) continue;
      const f = s.flowers[k % s.flowers.length];
      const P = pos(nodes[f.i]);
      const x = P.x + Math.sin(e * 1.6 + k) * 10 + e * (8 + hash(k + 1) * 12), y = P.y - 10 + e * 9 + Math.cos(e * 2.3 + k) * 3;
      const life = 1 - smooth(3, 4.3, e);
      if (life <= 0 || x > W) continue;
      r.px(x, y, Math.sin(e * 6 + k) > 0 ? PINK : PINK_HI, life, SET);
      if (Math.sin(e * 6 + k) > 0.3) r.px(x + 1, y, PINK, life, SET);
    }
  }
};
var sporeNebula = {
  id: 14,
  name: "Spore Nebula",
  school: "VERDANT",
  duration: 10,
  climax: 6.45,
  blurb: "Spores find each other, colonies divide, light travels like thought \u2014 then the whole galaxy reproduces.",
  setup(r) {
    const rng = new RNG(1414);
    const C = { x: r.target.x - 20, y: r.target.y + 6 };
    const cols = Array.from({ length: 12 }, (_, k) => {
      const a = k * 2.399 + 0.4, rr = 18 + k * 6.5;
      return { x: C.x + Math.cos(a) * rr * 1.25, y: C.y + Math.sin(a) * rr * 0.72, tc: 1.3 + k * 0.22, hue: k % 3, f: rng.r(1.2, 3), cells: Array.from({ length: 12 }, (_2, j) => ({ a: rng.r(0, TAU), d: 2 + Math.sqrt(j) * 3.6, rr: rng.r(1.6, 3) })) };
    });
    const links = [];
    for (let k = 0; k < cols.length; k++) {
      links.push([k, (k + 1) % cols.length]);
      if (k + 3 < cols.length) links.push([k, k + 3]);
    }
    const spores = Array.from({ length: 72 }, (_, i) => ({ col: i % 12, ph: rng.r(0, TAU), w: rng.r(0.4, 1), orb: rng.r(3, 10), d: rng.r(-0.3, 0.3) }));
    const burst = Array.from({ length: 700 }, (_, i) => ({ col: i % 12, a: rng.r(0, TAU), v: rng.r(15, 110), spin: rng.r(0.6, 2.2) * (i % 2 ? 1 : -1), layer: i % 3, life: rng.r(1.5, 3.5) }));
    return { C, cols, links, spores, burst };
  },
  render(r, t, s) {
    const C = s.C;
    const TR = 6.3;
    r.ambient = 0.45 - smooth(1, 4, t) * 0.18;
    const hues = [VEIN, TEAL, GOLD];
    const dissolve = smooth(TR + 0.3, 8.6, t);
    const waves = [3.9, 4.8, 5.6];
    const lit = (k) => {
      let v = 0;
      for (const w of waves) {
        const e = t - (w + k * 0.11);
        if (e > 0) v += Math.exp(-e * 5) * 1.5;
      }
      return v + pulse(TR - 0.4, TR + 0.2, t) * 1.5;
    };
    const mk = 1 - smooth(TR, 8, t);
    if (mk > 0) {
      const pu = 0.6 + 0.4 * Math.sin(t * 2.4);
      r.shadow(C.x + 1, C.y + 2, 6, 2.5, 0.6);
      r.thick(C.x, C.y, C.x, C.y - 6, 2.5, [0.55, 0.5, 0.4], 1, SET);
      r.disc(C.x, C.y - 7, 5, [0.25, 0.4, 0.3], 1, SET, 0.6);
      r.disc(C.x, C.y - 8, 4, [0.35, 0.65, 0.45], 1, SET, 0.5);
      for (let k = 0; k < 4; k++) r.px(C.x - 3 + k * 2, C.y - 8 + k % 2, TEAL, pu * 2 * mk);
      r.glow(C.x, C.y - 7, 14, TEAL, pu * 0.6 * mk);
      r.light(C.x, C.y - 6, 40, [0.3, 1.1, 0.8], pu * 0.5 * mk);
    }
    const colPos = (k) => {
      const c = s.cols[k];
      const br = 1 + 0.12 * Math.sin(t * c.f);
      return { x: c.x, y: c.y, br };
    };
    for (const [a, b] of s.links) {
      const ca = s.cols[a], cb = s.cols[b];
      const g = smooth(Math.max(ca.tc, cb.tc) + 0.4, Math.max(ca.tc, cb.tc) + 1.2, t) * (1 - dissolve);
      if (g <= 0) continue;
      const mx = (ca.x + cb.x) / 2 + Math.sin(t * 0.7 + a) * 8, my = (ca.y + cb.y) / 2 + Math.cos(t * 0.6 + b) * 6 + 6;
      const lk = (lit(a) + lit(b)) * 0.5;
      for (let q = 0; q <= 30; q++) {
        const u = q / 30;
        const x = (1 - u) * (1 - u) * ca.x + 2 * (1 - u) * u * mx + u * u * cb.x, y = (1 - u) * (1 - u) * ca.y + 2 * (1 - u) * u * my + u * u * cb.y;
        if (q % 2) r.px(x, y, hues[ca.hue], (0.25 + lk * 0.6) * g);
        const pk = (t * 0.5 + a * 0.13) % 1;
        if (Math.abs(u - pk) < 0.03) r.disc(x, y, 1, [1.8, 2, 1.6], g * 1.2);
      }
    }
    const sp = [];
    if (t < TR + 0.2) {
      s.spores.forEach((p, i) => {
        const c = s.cols[p.col];
        const u = easeInOut(inv(0.4 + p.d * 0.5, c.tc, t));
        const drift = { x: Math.sin(t * 0.7 * p.w + p.ph) * 12, y: Math.cos(t * 0.5 * p.w + p.ph * 1.3) * 8 };
        const orbit = { x: Math.cos(t * p.w * 2 + p.ph) * p.orb, y: Math.sin(t * p.w * 2 + p.ph) * p.orb * 0.7 };
        const x = lerp(C.x + drift.x * (1 - u) + Math.cos(p.ph) * 18 * Math.sin(u * Math.PI), c.x + orbit.x, u);
        const y = lerp(C.y - 8 + drift.y * (1 - u), c.y + orbit.y, u);
        if (t > 0.4 + p.d * 0.5) {
          sp.push({ x, y });
          r.px(x, y, hues[c.hue], 1.4);
        }
      });
      for (let i = 0; i < sp.length; i++)
        for (let j = i + 1; j < sp.length; j++) {
          const d = Math.hypot(sp[i].x - sp[j].x, sp[i].y - sp[j].y);
          if (d < 13) r.line(sp[i].x, sp[i].y, sp[j].x, sp[j].y, VEIN, 0.18 * (1 - d / 13));
        }
    }
    s.cols.forEach((c, k) => {
      const P = colPos(k);
      const lk = lit(k);
      const hue = hues[c.hue];
      c.cells.forEach((cell, j) => {
        const born = c.tc + j * 0.22;
        if (t < born) return;
        const div = easeOut(clamp((t - born) / 0.35));
        const par = c.cells[j >> 1];
        const px = P.x + Math.cos(par.a) * par.d * (j ? 1 : 0), py = P.y + Math.sin(par.a) * par.d * 0.7 * (j ? 1 : 0);
        const tx = P.x + Math.cos(cell.a + t * 0.2) * cell.d * P.br, ty = P.y + Math.sin(cell.a + t * 0.2) * cell.d * 0.7 * P.br;
        const x = lerp(px, tx, div), y = lerp(py, ty, div);
        const rr = cell.rr * (0.5 + 0.5 * div) * P.br * (1 - dissolve * 0.6);
        if (dissolve < 0.05) {
          r.disc(x, y, rr, scale(hue, 0.12), 0.6, BLEND);
          r.ring(x, y, rr, 0.9, hue, 0.6 + lk * 0.8);
        } else {
          for (let q = 0; q < 10; q++) {
            if (hash(q + j * 10 + k * 100) < dissolve) continue;
            const a = q / 10 * TAU;
            const o = dissolve * 6 * hash(q + j);
            r.px(x + Math.cos(a) * (rr + o), y + Math.sin(a) * (rr + o) + dissolve * 4, hue, 0.8);
          }
        }
        r.px(x, y, [1.8, 2, 1.6], (0.5 + lk) * (1 - dissolve * 0.5));
      });
      r.glow(P.x, P.y, 16, hue, (0.25 + lk * 0.5) * smooth(c.tc, c.tc + 1, t) * (1 - dissolve));
      r.light(P.x, P.y, 34, scale(hue, 0.6), (0.3 + lk * 0.6) * smooth(c.tc, c.tc + 1, t) * (1 - dissolve));
    });
    if (t > TR) {
      const e = t - TR;
      if (e < 0.15) {
        r.flash = 0.25 * (1 - e / 0.15);
        r.flashCol = [0.5, 1, 0.7];
      }
      for (const b of s.burst) {
        const c = s.cols[b.col];
        const life = 1 - e / b.life;
        if (life <= 0) continue;
        const rr = fly(0, b.v * (1 + b.layer * 0.4), 1.2, 0, e);
        const a = b.a + b.spin * Math.log(1 + e * 2);
        const x = c.x + Math.cos(a) * rr * 1.2, y = c.y + Math.sin(a) * rr * 0.7 - e * 3;
        r.px(x, y, b.layer === 2 ? [1.8, 2, 1.6] : hues[(c.hue + b.layer) % 3], life * (b.layer === 2 ? 1.2 : 0.9));
      }
    }
    if (t > 7) {
      for (let k = 0; k < 14; k++) {
        const x = C.x + (hash(k) - 0.5) * 220 + Math.sin(t * 0.4 + k) * 6, y = C.y + (hash(k + 3) - 0.5) * 140 + Math.cos(t * 0.3 + k) * 4;
        const g = smooth(7, 8, t) * (0.5 + 0.5 * Math.sin(t * 1.5 + k));
        r.px(x, y, hues[k % 3], g * 1.4);
        r.glow(x, y, 4, hues[k % 3], g * 0.4);
      }
    }
  }
};
var thornOpera = {
  id: 15,
  name: "Thorn Opera",
  school: "VERDANT",
  duration: 9.5,
  climax: 6.42,
  blurb: "Five tendrils with five temperaments dance \u2014 tip leads, body follows, base resists \u2014 then become one violent flower.",
  setup(r) {
    const C = r.caster;
    const F = { x: C.x + 96, y: C.y - 22 };
    const tens = Array.from({ length: 5 }, (_, k) => {
      const a = -1.2 + k * 0.6;
      return { bx: C.x + 8 + Math.cos(a) * 9, by: C.y + 2 + Math.sin(a) * 6, base: Math.atan2(F.y - C.y, F.x - C.x) + (k - 2) * 0.45, L: 104 + k % 2 * 14, kind: k, seed: k * 17 };
    });
    return { F, tens };
  },
  render(r, t, s) {
    const F = s.F;
    const TC = 5.1, TO = 6.2;
    const NS = 30;
    const pose = (tn, tt) => {
      let dir = tn.base, curl = 0, wave = 0, wph = 0;
      const k = tn.kind;
      if (k === 0 || k === 3) {
        const seg = Math.floor(tt / 0.85), f = tt / 0.85 - seg;
        const a0 = (hash(seg + tn.seed) - 0.5) * 1.6, a1 = (hash(seg + 1 + tn.seed) - 0.5) * 1.6;
        dir += lerp(a0, a1, smooth(0.7, 0.82, f));
        curl = 0.4 * Math.sin(tt * 2 + k);
      } else if (k === 1) {
        const ph = tt * 0.6 % 1;
        curl = ph < 0.75 ? easeIn(ph / 0.75) * 7 : lerp(7, -1.5, easeOut((ph - 0.75) / 0.25));
        dir += Math.sin(tt * 0.8) * 0.4;
      } else if (k === 2) {
        wave = 1.6;
        wph = tt * 3;
        const hook = pulse(0, 1, (tt * 0.35 % 1 - 0.7) / 0.3);
        curl = hook * 5;
        dir += Math.sin(tt * 0.9) * 0.5;
      } else {
        wave = 0.9;
        wph = tt * 5;
        dir += Math.sin(tt * 1.7) * 0.7;
        curl = Math.sin(tt * 1.1) * 2;
      }
      const sweep = pulse(3.6, 5, tt);
      dir += sweep * Math.sin(tt * 4) * 0.9 * (k % 2 ? 1 : -1);
      return { dir, curl, wave, wph };
    };
    const chain = (tn, tt) => {
      const grow = easeOut(inv(0.2 + tn.kind * 0.1, 1.2 + tn.kind * 0.1, tt));
      const pts = [{ x: tn.bx, y: tn.by, a: tn.base }];
      let x = tn.bx, y = tn.by, ang = 0;
      const ds = tn.L * grow / NS;
      for (let j = 1; j <= NS; j++) {
        const u = j / NS;
        const P = pose(tn, tt - (1 - u) * 0.42);
        const kap = (P.curl * u * u + P.wave * Math.sin(u * 7 - P.wph)) / NS;
        ang += kap;
        let a = P.dir + ang;
        const gather = easeInOut(inv(TC, TO - 0.15, tt)) * (1 - smooth(TO, TO + 0.25, tt));
        if (gather > 0) {
          const toF = Math.atan2(F.y - y, F.x - x) + u * 1.6 * (tn.kind % 2 ? 1 : -1);
          a = lerp(a, toF, gather * u);
        }
        x += Math.cos(a) * ds;
        y += Math.sin(a) * ds;
        pts.push({ x, y, a });
      }
      return pts;
    };
    r.ambient = 0.55;
    const opened = t - TO;
    if (opened > 0) {
      const op = easeOutBack(clamp(opened / 0.3));
      const fade = 1 - smooth(1.6, 3, opened);
      if (fade > 0) {
        for (let k = 0; k < 7; k++) {
          const a = k / 7 * TAU + 0.3 + opened * 0.15;
          const L = 66 * op * fade + 4;
          const wA = 0.22;
          const pts = [F.x, F.y];
          for (let q = 0; q <= 8; q++) {
            const u = q / 8;
            const aa = a - wA + 2 * wA * u;
            const rr = L * (0.75 + 0.25 * Math.sin(u * Math.PI));
            pts.push(F.x + Math.cos(aa) * rr, F.y + Math.sin(aa) * rr * 0.8);
          }
          r.poly(pts, k % 2 ? [0.6, 0.12, 0.25] : [0.8, 0.18, 0.35], 1, SET);
          r.line(F.x, F.y, F.x + Math.cos(a) * L, F.y + Math.sin(a) * L * 0.8, PINK_HI, 0.8);
          for (let q = 2; q < 8; q++) {
            const rr = L * q / 8;
            const bx = F.x + Math.cos(a) * rr, by = F.y + Math.sin(a) * rr * 0.8;
            r.line(bx, by, bx + Math.cos(a + 1.2) * 4, by + Math.sin(a + 1.2) * 4, [0.9, 0.85, 0.6], 1, SET);
          }
        }
        r.disc(F.x, F.y, 7 * op * fade, GOLD, 1.2);
        r.light(F.x, F.y, 90, [1.4, 0.6, 0.8], 1.2 * fade);
      }
      for (let k = 0; k < 4; k++) {
        const st = 0.05 + k * 0.1;
        const e = opened - st;
        if (e < 0 || e > 0.35) continue;
        const a0 = k * 1.7, sweep = easeOut(e / 0.35) * 2.6;
        const R = 50 + k * 12;
        for (let a = a0; a < a0 + sweep; a += 0.02) {
          const tail = (a - a0) / sweep;
          for (let d = -2; d <= 2; d++) r.px(F.x + Math.cos(a) * (R + d), F.y + Math.sin(a) * (R + d) * 0.8, tail > 0.85 ? PINK_HI : [0.9, 1.4, 0.5], (1 - e / 0.35) * tail * (2 - Math.abs(d) * 0.5));
        }
      }
      if (opened < 0.1) r.flash = 0.25;
      if (opened < 0.5) {
        r.shakeX = (hash(t * 33) - 0.5) * 5;
        r.shakeY = (hash(t * 39) - 0.5) * 4;
      }
    }
    for (const tn of s.tens) {
      const pts = chain(tn, t);
      r.disc(tn.bx, tn.by, 2.5, LEAF_D, 1, SET);
      for (let j = 0; j < NS; j++) {
        const a = pts[j], b = pts[j + 1];
        const u = j / NS;
        const w = 3.6 * Math.pow(1 - u, 0.8) + 0.8;
        r.shadow(a.x + 2, a.y + 3, w, w * 0.5, 0.25);
        r.thick(a.x, a.y, b.x, b.y, w * 1.25, LEAF_D, 1, SET);
        r.thick(a.x, a.y, b.x, b.y, w * 0.7, LEAF, 1, SET);
        r.px(a.x - Math.sin(a.a) * w * 0.25, a.y + Math.cos(a.a) * w * 0.25 - 1, LEAF_HI, 1, SET);
        if (j % 3 === 1) {
          const sg = j % 2 ? 1 : -1, na = b.a + sg * 1.25 + 0.35;
          const tl = 2 + w * 0.8;
          r.line(b.x, b.y, b.x + Math.cos(na) * tl, b.y + Math.sin(na) * tl, [0.75, 0.7, 0.45], 1, SET);
        }
      }
      const tip = pts[NS];
      r.px(tip.x, tip.y, LIME, 1.3);
      for (let q = 0; q < 70; q++) {
        const ts = q * 0.12 + tn.kind * 0.03;
        const e = t - ts;
        if (e < 0 || e > 1.6 || ts > TO + 1) continue;
        const p1 = chain(tn, ts)[NS], p0 = chain(tn, ts - 0.04)[NS];
        const vx = (p1.x - p0.x) / 0.04, vy = (p1.y - p0.y) / 0.04;
        if (Math.hypot(vx, vy) < 190) continue;
        const x = fly(p1.x, vx * 0.35, 2.5, 0, e) + Math.sin(e * 7 + q) * 3, y = fly(p1.y, vy * 0.35, 2.5, 18, e);
        const life = 1 - e / 1.6;
        r.px(x, y, q % 2 ? LEAF_HI : PINK, life * 1.2, SET);
        if (Math.sin(e * 9 + q) > 0) r.px(x + 1, y, q % 2 ? LEAF : PINK_HI, life, SET);
      }
    }
    if (opened > 0) {
      for (let k = 0; k < 180; k++) {
        const e = opened - hash(k) * 0.3;
        if (e < 0) continue;
        const a = hash(k + 1) * TAU, v = 40 + hash(k + 2) * 130;
        const x = F.x + Math.cos(a) * fly(0, v, 2.2, 0, e) + Math.sin(e * 2.2 + k) * 6;
        const y = F.y + Math.sin(a) * fly(0, v, 2.2, 0, e) * 0.8 + e * e * 3 + e * 6;
        const life = 1 - smooth(2.4, 3.3, e);
        if (life <= 0) continue;
        const flip = Math.sin(e * (4 + hash(k) * 5) + k);
        r.px(x, y, flip > 0 ? PINK : [0.8, 0.2, 0.4], life, SET);
        if (Math.abs(flip) > 0.5) r.px(x + (flip > 0 ? 1 : 0), y + (flip > 0 ? 0 : 1), PINK_HI, life, SET);
      }
    }
  }
};
var worldseed = {
  id: 16,
  name: "Worldseed",
  school: "VERDANT",
  duration: 11,
  climax: 6.75,
  blurb: "Nothing happens, beautifully. Then a seed unfolds far more geometry than it could ever contain.",
  setup(r) {
    const rng = new RNG(1616);
    const layers = [
      { n: 8, L: 96, w: 0.3, t0: 3.6, t1: 6, col: [0.1, 0.3, 0.12], hi: [0.35, 0.9, 0.35], off: 0.2, tremble: 0, curlTip: true, ret: 9.2 },
      { n: 12, L: 62, w: 0.2, t0: 3.3, t1: 4.9, col: [0.12, 0.42, 0.32], hi: [0.4, 1.3, 1], off: 0, tremble: 0.02, curlTip: false, ret: 8.9 },
      { n: 6, L: 42, w: 0.36, t0: 2.9, t1: 4, col: [0.5, 0.15, 0.32], hi: [1.6, 0.6, 1], off: 0.5, tremble: 0.02, curlTip: false, ret: 8.6 },
      { n: 24, L: 30, w: 0.07, t0: 3.8, t1: 4.6, col: [0.6, 0.55, 0.2], hi: [1.8, 1.5, 0.5], off: 0.1, tremble: 0.12, curlTip: false, ret: 8.3 },
      { n: 3, L: 22, w: 0.5, t0: 2.5, t1: 3.4, col: [0.18, 0.5, 0.15], hi: [0.6, 1.4, 0.4], off: 1, tremble: 0.03, curlTip: false, ret: 8 }
    ];
    const seeds = Array.from({ length: 12 }, (_, i) => ({ a: rng.r(0, TAU), v: rng.r(50, 110), spin: rng.r(-1.5, 1.5) }));
    return { layers, seeds };
  },
  render(r, t, s) {
    const C = { x: W / 2 + 22, y: H / 2 + 8 };
    const hov = Math.sin(t * 1.6) * 1.5;
    const sy = C.y - 12 + hov;
    const TCR = 1.9, TB = 6.6;
    r.ambient = 0.5 - smooth(3, 6, t) * 0.12;
    const waves = [5.35, 5.85, 6.3];
    const wave = (rad) => waves.reduce((acc, w) => acc + Math.exp(-Math.pow((rad - (t - w) * 160) / 12, 2)) * (t > w ? 1 : 0), 0);
    const leaf = (a, L, wA, curlU, cx, cy) => {
      const pts = [];
      const axis = [];
      for (let side = 1; side >= -1; side -= 2)
        for (let q = 0; q <= 12; q++) {
          const u = side > 0 ? q / 12 : 1 - q / 12;
          const uu = u * curlU;
          const half = wA * Math.sin(Math.PI * Math.pow(u, 0.7));
          const aa = a + side * half + (1 - curlU) * u * u * 0.8;
          const rr = 3 + uu * L;
          pts.push(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr * 0.75);
          if (side > 0) axis.push({ x: cx + Math.cos(a + (1 - curlU) * u * u * 0.8) * rr, y: cy + Math.sin(a + (1 - curlU) * u * u * 0.8) * rr * 0.75 });
        }
      return { pts, axis };
    };
    s.layers.forEach((Ly, li) => {
      const g = easeInOut(inv(Ly.t0, Ly.t1, t)) * (1 - easeInOut(inv(Ly.ret, Ly.ret + 0.9, t)));
      if (g <= 0.01) return;
      for (let k = 0; k < Ly.n; k++) {
        const a = Ly.off + k / Ly.n * TAU + Math.sin(t * 13 + k * 3) * Ly.tremble + t * 0.04 * (li % 2 ? 1 : -1);
        const L = Ly.L * (0.85 + 0.15 * hash(k + li * 9));
        const { pts, axis } = leaf(a, L * g, Ly.w * (0.4 + 0.6 * g), Ly.curlTip ? g : 1, C.x, sy);
        const wv = wave(Ly.L * 0.6);
        r.poly(pts, scale(Ly.col, 1 + wv * 1.5), 1, SET);
        r.polyline(pts, scale(Ly.hi, 0.6 + wv), 0.8, ADD, true);
        axis.forEach((p, q) => {
          if (q % 2) r.px(p.x, p.y, Ly.hi, 0.7 + wv);
          const cellWave = Math.exp(-Math.pow(q / 12 - (t * 0.7 + li * 0.2) % 1.4, 2) * 40);
          if (Ly.w > 0.15 && q > 1) {
            const perp = a + Math.PI / 2;
            for (const o of [-1, 1]) {
              const ow = Ly.w * L * g * 0.35 * Math.sin(Math.PI * (q / 12));
              r.px(p.x + Math.cos(perp) * ow * o, p.y + Math.sin(perp) * ow * o * 0.75, Ly.hi, (0.2 + cellWave * 1.4 + wv) * 0.8);
            }
          }
        });
        if (Ly.curlTip && g < 0.97) {
          const tp = axis[axis.length - 1];
          r.ring(tp.x, tp.y, 2 + (1 - g) * 4, 1, Ly.hi, 0.9);
        }
      }
      r.light(C.x, sy, Ly.L * 1.2, scale(Ly.hi, 0.4), 0.4 * g);
    });
    const open = smooth(2.3, 3, t);
    if (open < 1) {
      const rot = Math.sin(t * 0.9) * 0.3;
      for (const side of [-1, 1]) {
        const sep = open * 10, ang = rot + side * open * 0.9;
        const ox = side * sep, oy = open * open * 14;
        const pts = [];
        for (let q = 0; q <= 10; q++) {
          const u = q / 10 * Math.PI;
          const lx = side * Math.sin(u) * 5.5, ly = -Math.cos(u) * 8;
          pts.push(C.x + ox + lx * Math.cos(ang) - ly * Math.sin(ang), sy + oy + lx * Math.sin(ang) + ly * Math.cos(ang));
        }
        r.poly(pts, [0.28, 0.22, 0.1], 1 - open, open > 0 ? DITHER : SET);
        r.polyline(pts, [0.6, 0.5, 0.2], 1 - open, ADD);
      }
      const vk = 0.6 + 0.4 * Math.sin(t * 2.5);
      for (let q = -6; q <= 6; q += 2) r.px(C.x + Math.sin(q * 0.4 + rot) * 2, sy + q, LIME, vk * (1 - open) * 0.6);
      const cr = smooth(TCR, TCR + 0.3, t);
      if (cr > 0) {
        r.line(C.x - 0.5, sy - 7 * cr, C.x + 0.5, sy + 7 * cr, [2.4, 2.2, 1.2], 1.5 * (1 - open * 0.5));
        for (let k = 0; k < 9; k++) {
          const a = k / 9 * TAU + t * 0.3;
          const L = (20 + 14 * hash(k + Math.floor(t * 6))) * cr * (1 - open * 0.5);
          r.line(C.x + Math.cos(a) * 4, sy + Math.sin(a) * 4, C.x + Math.cos(a) * L, sy + Math.sin(a) * L * 0.75, GOLD, 0.35);
        }
        r.light(C.x, sy, 50, [1.4, 1.2, 0.5], cr * 0.8);
      }
      r.shadow(C.x + 2, C.y + 3, 6, 2.5, 0.6);
    }
    for (let k = 0; k < 16; k++) {
      const a = hash(k) * TAU + t * (0.3 + hash(k + 1) * 0.4);
      const rr = 10 + hash(k + 2) * 18 + Math.sin(t + k) * 3;
      r.px(C.x + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.7 - 4, GOLD, 0.6 * (1 - smooth(TB, TB + 1, t)));
    }
    const core = smooth(4.4, 5.6, t) * (1 - smooth(8.9, 9.6, t));
    if (core > 0) {
      const pu = 0.8 + 0.2 * Math.sin(t * 5) + wave(0) * 0.6;
      r.disc(C.x, sy, 4 * core, [2.4, 2.2, 1.2], pu);
      r.glow(C.x, sy, 22 * core, GOLD, pu * core);
      r.light(C.x, sy, 120, [1.2, 1.1, 0.5], core * pu);
    }
    if (t > TB) {
      const e = t - TB;
      if (e < 0.12) {
        r.flash = 0.35;
        r.flashCol = [1, 1, 0.6];
      }
      for (let k = 0; k < 320; k++) {
        const a = hash(k) * TAU, v = 30 + hash(k + 1) * 150;
        const rr = fly(4, v, 1.5, 0, e), sw = a + Math.log(1 + e) * (k % 2 ? 0.8 : -0.8);
        const life = 1 - e / (1.5 + hash(k + 2) * 2);
        if (life <= 0) continue;
        r.px(C.x + Math.cos(sw) * rr, sy + Math.sin(sw) * rr * 0.75 - e * 6, k % 5 ? GOLD : [2, 2, 1.6], life);
      }
      for (let k = 0; k < 36; k++) {
        const a = hash(k + 50) * TAU, v = 50 + hash(k + 51) * 90;
        const x = C.x + Math.cos(a) * fly(0, v, 2, 0, e) + Math.sin(e * 3 + k) * 5, y = sy + Math.sin(a) * fly(0, v, 2, 0, e) * 0.75 + e * 7;
        const life = 1 - smooth(2.5, 3.5, e);
        if (life > 0) petal(r, x, y, e * 3 + k, 1.6, k % 2 ? [0.8, 0.25, 0.5] : [0.3, 0.8, 0.3], PINK_HI, life);
      }
      for (let k = 0; k < 6; k++)
        for (let q = 0; q < 40; q++) {
          const u = q / 40;
          const head = easeOut(e / 0.9);
          if (u > head || e > 1.6) continue;
          const a = k / 6 * TAU + u * 3;
          const rr = u * 110;
          r.px(C.x + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.75, LIME, (1 - e / 1.6) * (u > head - 0.1 ? 2 : 0.6));
        }
    }
    if (t > TB) {
      const e = t - TB;
      s.seeds.forEach((sd, k) => {
        const rr = fly(0, sd.v, 1.6, 0, e);
        const x = C.x + Math.cos(sd.a + sd.spin * Math.min(e, 2) * 0.3) * rr + Math.sin(e * 0.8 + k) * 4;
        const y = sy + Math.sin(sd.a) * rr * 0.6 + Math.cos(e * 1.1 + k) * 3 - Math.min(e, 2) * 4;
        for (let m = 1; m < 6 && e < 2; m++) r.px(x - Math.cos(sd.a) * m * 1.5, y - Math.sin(sd.a) * m, GOLD, (1 - m / 6) * 0.7);
        r.disc(x, y, 1.3, [2.2, 2, 1], 1);
        r.glow(x, y, 6, GOLD, 0.5 + 0.2 * Math.sin(t * 3 + k));
        r.light(x, y, 16, [1.2, 1, 0.4], 0.4);
      });
    }
  }
};
var VERDANT = [rootwake, sporeNebula, thornOpera, worldseed];

// src/effects/astral.ts
var STAR = [2.4, 2.2, 1.7];
var MAG = [1.4, 0.3, 1.3];
var INDIGO = [0.25, 0.1, 0.7];
var CYAN = [0.4, 1.4, 1.8];
var fr2 = (t, r = 30) => Math.floor(t * r);
var eventHorizon = {
  id: 17,
  name: "Event Horizon",
  school: "ASTRAL",
  duration: 9.5,
  climax: 4.8,
  blurb: "A region loses visual information. The floor itself lenses and drags; light piles up in two counter-rotating disks.",
  setup(r) {
    const rng = new RNG(1717);
    const disk = Array.from({ length: 420 }, (_, i) => ({ r: rng.r(1.5, 4.6), a: rng.r(0, TAU), d: i % 3 === 0 ? 1 : 0, s: i }));
    const orb = Array.from({ length: 16 }, (_, i) => ({ r0: rng.r(28, 70), a0: rng.r(0, TAU), e: rng.r(0.1, 0.4), prec: rng.r(0.2, 0.6), fall: i % 4 === 0 ? rng.r(2, 4.5) : 99, dir: i % 3 === 0 ? -1 : 1 }));
    return { disk, orb };
  },
  render(r, t, s) {
    const C = { x: r.target.x - 30, y: r.target.y + 8 };
    const TCmp = 5, TDark = 5.65, TReb = 6;
    const Rh = 13 * smooth(1.2, 3.8, t) * (1 - easeIn(inv(TCmp, TDark - 0.1, t)) * 0.95) + 1.2 * smooth(0, 1.2, t);
    const intensity = smooth(1.5, 4.5, t);
    if (t > TDark) return;
    r.ambient = 0.6 - intensity * 0.2;
    const col = (k) => 1 - smooth(TCmp + k * 0.1, TCmp + 0.3 + k * 0.1, t);
    for (const p of s.disk) {
      const cK = col(p.d ? 1 : 0);
      if (cK <= 0) continue;
      const rr = p.r * Rh * (0.3 + 0.7 * cK);
      const w = (p.d ? -1 : 1) * 3.5 / Math.pow(p.r, 1.5);
      const a = p.a + w * t;
      const tilt = p.d ? -0.55 : 0.18, sq = p.d ? 0.5 : 0.28;
      const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * sq;
      if (Math.sin(a) > 0) continue;
      const x = C.x + lx * Math.cos(tilt) - ly * Math.sin(tilt), y = C.y + lx * Math.sin(tilt) + ly * Math.cos(tilt);
      const dop = 1 + 0.7 * Math.cos(a);
      r.px(x, y, p.d ? CYAN : p.r < 2.5 ? STAR : MAG, 0.5 * dop * intensity);
    }
    for (const o of s.orb) {
      const cK = col(2);
      if (cK <= 0) continue;
      for (let k = 0; k < 14; k++) {
        const tt = t - k * 0.02;
        const fall = clamp((tt - o.fall) / 1.4);
        const rr = o.r0 * (1 - fall) * (0.3 + 0.7 * cK) * (0.5 + 0.5 * smooth(0.5, 2.5, tt));
        if (rr < Rh) break;
        const om = o.dir * 20 / Math.pow(rr, 0.9);
        const a = o.a0 + om * tt;
        const ell = 1 + o.e * Math.cos(a - o.prec * tt);
        const x = C.x + Math.cos(a) * rr * ell, y = C.y + Math.sin(a) * rr * ell * 0.6;
        r.px(x, y, k === 0 ? STAR : MAG, (1 - k / 14) * (k === 0 ? 1.6 : 0.6) * smooth(0.3, 1.5, t));
      }
    }
    [[2.2, 6, 0.6, 1], [3.4, 8, -0.4, 0.5], [5, 5, 0.25, 0.75]].forEach(([k, n, w, sq], i) => {
      const cK = col(3 + i);
      if (cK <= 0) return;
      const rr = Rh * k * cK;
      for (let j = 0; j < n; j++) {
        if ((j + i) % 3 === 0) continue;
        const a0 = w * t + j / n * TAU, a1 = a0 + TAU / n * 0.7;
        r.line(C.x + Math.cos(a0) * rr, C.y + Math.sin(a0) * rr * sq, C.x + Math.cos(a1) * rr, C.y + Math.sin(a1) * rr * sq, i === 1 ? CYAN : INDIGO, 0.8 * intensity * cK + 0.1);
      }
    });
    r.light(C.x, C.y, 80, [0.8, 0.4, 1.2], intensity * 0.6);
  },
  post(r, t, s) {
    const C = { x: r.target.x - 30, y: r.target.y + 8 };
    const TCmp = 5, TDark = 5.65, TReb = 6;
    const Rh = 13 * smooth(1.2, 3.8, t) * (1 - easeIn(inv(TCmp, TDark - 0.1, t)) * 0.95) + 1.2 * smooth(0, 1.2, t);
    const intensity = smooth(1.5, 4.5, t);
    if (t < TDark) {
      const E = Rh * 1.6 + 2;
      const R = E * 7;
      r.warp(C.x - R, C.y - R, C.x + R, C.y + R, (x, y, o) => {
        const dx = x - C.x, dy = (y - C.y) / 0.8, d = Math.hypot(dx, dy);
        if (d > R || d < 0.5) return;
        let sd = d - E * E / d * (1 - d / R);
        sd = Math.round(sd / 2) * 2;
        const a = Math.atan2(dy, dx) + 0.9 * E / (d + 2) * (1 - d / R) * Math.sin(t * 0 + 1);
        const k = sd < 0 ? 0 : sd;
        o[0] = C.x + Math.cos(a) * k;
        o[1] = C.y + Math.sin(a) * k * 0.8;
      });
      r.disc(C.x, C.y, Rh, [0, 0, 0], 1, SET, 0.8);
      r.ring(C.x, C.y, Rh + 1, 1, STAR, 0.6 + intensity * 0.8, ADD, 0.8);
      r.ring(C.x, C.y, Rh + 2.5, 1, MAG, 0.4 * intensity, ADD, 0.8);
      const col = (k) => 1 - smooth(TCmp + k * 0.1, TCmp + 0.3 + k * 0.1, t);
      for (const p of s.disk) {
        const cK = col(p.d ? 1 : 0);
        if (cK <= 0) continue;
        const rr = p.r * Rh * (0.3 + 0.7 * cK);
        const w = (p.d ? -1 : 1) * 3.5 / Math.pow(p.r, 1.5);
        const a = p.a + w * t;
        if (Math.sin(a) <= 0) continue;
        const tilt = p.d ? -0.55 : 0.18, sq = p.d ? 0.5 : 0.28;
        const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * sq;
        const x = C.x + lx * Math.cos(tilt) - ly * Math.sin(tilt), y = C.y + lx * Math.sin(tilt) + ly * Math.cos(tilt);
        const dop = 1 + 0.7 * Math.cos(a);
        r.px(x, y, p.d ? CYAN : p.r < 2.5 ? STAR : MAG, 0.6 * dop * intensity);
      }
      if (t > TCmp) r.disc(C.x, C.y, 1, STAR, 3 * pulse(TCmp, TDark, t));
    } else if (t < TReb) {
      r.c.fill(0);
      if (t > TReb - 0.08) r.disc(C.x, C.y, 1, STAR, 3);
    } else {
      const e = t - TReb;
      const R = e * 170;
      const A = 18 * Math.exp(-e * 1.4);
      r.warp(0, 0, W - 1, H - 1, (x, y, o) => {
        const dx = x - C.x, dy = (y - C.y) / 0.8, d = Math.hypot(dx, dy) || 1;
        const env = Math.exp(-Math.pow((d - R) / 30, 2));
        const k = Math.sin((d - R) * 0.18) * A * env + (d < R ? A * 0.3 * Math.exp(-(R - d) / 40) : 0);
        if (Math.abs(k) < 0.5) return;
        o[0] = x - dx / d * k;
        o[1] = y - dy / d * k * 0.8;
      });
      if (e < 0.1) r.flash = 0.6;
      r.ring(C.x, C.y, R, 1.5, MAG, 1.2 * Math.exp(-e * 1.5), ADD, 0.8);
      r.ring(C.x, C.y, R * 0.85, 1, CYAN, 0.8 * Math.exp(-e * 1.5), ADD, 0.8);
      for (let k = 0; k < 40; k++) {
        const a = hash(k) * TAU, rr = R * (0.7 + hash(k + 1) * 0.5);
        const life = Math.exp(-e * 0.9);
        sparkle(r, C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * 0.8, 1, STAR, life);
      }
      if (e < 0.5) {
        r.shakeX = (hash(t * 30) - 0.5) * 6;
        r.shakeY = (hash(t * 31) - 0.5) * 4;
      }
    }
  }
};
var chronoshard = {
  id: 18,
  name: "Chronoshard",
  school: "ASTRAL",
  duration: 10,
  climax: 5.2,
  blurb: "Time as material: crystals hold the same attack at different moments. Effects arrive before causes.",
  setup(r) {
    const A = { x: r.caster.x + 6, y: r.caster.y - 14 }, B = { x: r.target.x, y: r.target.y - 4 };
    const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 - 6 };
    const rng = new RNG(1818);
    const conf = (k) => Array.from({ length: 5 }, (_, i) => {
      const a = i / 5 * TAU + k * 1.1 + rng.r(-0.3, 0.3);
      return { x: M.x + Math.cos(a) * rng.r(55, 85), y: M.y + Math.sin(a) * rng.r(40, 60) };
    });
    const c0 = conf(0), c1 = conf(1), c2 = conf(2);
    const crys = [
      { tau: 0.3, mode: 0, ta: 3.9 },
      { tau: 1.45, mode: 1, ta: 4.3 },
      { tau: 1.15, mode: 2, ta: 4.75 },
      { tau: 0.65, mode: 3, ta: 5.05 },
      { tau: 0.9, mode: 3, ta: 5.05 }
    ].map((c, i) => ({ ...c, pos: [c0[i], c1[i], c2[i]] }));
    return { A, B, M, crys };
  },
  render(r, t, s) {
    const { A, B, M } = s;
    const crys = s.crys;
    const attack = (tau, tint, k = 1) => {
      if (tau < 0 || tau > 2.2) return;
      if (tau <= 1) {
        const x = lerp(A.x, B.x, tau), y = lerp(A.y, B.y, tau) - Math.sin(tau * Math.PI) * 24;
        for (let m = 1; m < 10; m++) {
          const tt = Math.max(0, tau - m * 0.025);
          r.disc(lerp(A.x, B.x, tt), lerp(A.y, B.y, tt) - Math.sin(tt * Math.PI) * 24, 3 - m * 0.25, tint, k * (1 - m / 10) * 0.7);
        }
        const rot = tau * 20;
        const pts = [];
        for (let q = 0; q < 4; q++) pts.push(x + Math.cos(rot + q * Math.PI / 2) * (q % 2 ? 3 : 6), y + Math.sin(rot + q * Math.PI / 2) * (q % 2 ? 3 : 6));
        r.poly(pts, STAR, k);
        r.glow(x, y, 12, tint, k * 0.8);
      } else {
        const e = tau - 1;
        r.ring(B.x, B.y, easeOut(e / 1.2) * 34, 1.5, tint, k * (1 - e / 1.2) * 1.5, ADD, 0.7);
        r.ring(B.x, B.y, easeOut(e / 0.8) * 18, 1, STAR, k * clamp(1 - e / 0.8) * 1.5, ADD, 0.7);
        for (let q = 0; q < 24; q++) {
          const a = hash(q) * TAU, v = 30 + hash(q + 1) * 50;
          const x = fly(B.x, Math.cos(a) * v, 1.5, 0, e), y = fly(B.y, Math.sin(a) * v * 0.7 - 20, 1.5, 60, e);
          r.px(x, y, q % 3 ? tint : STAR, k * clamp(1.4 - e) * 1.4);
        }
        if (e < 0.3) r.glow(B.x, B.y, 26, tint, k * (1 - e / 0.3) * 1.5);
      }
    };
    const GOLDT = [1.8, 1.3, 0.5], BLUET = [0.5, 0.9, 2], PURE = [1.4, 0.8, 1.8];
    const FREEZE = 3.45, RESUME = 5.15, SYNC = 6;
    const gesture = (g, tint, k) => {
      const a = -2.4 + g * 3.4;
      for (let q = 0; q < 12; q++) {
        const aa = a - q * 0.08;
        r.px(A.x + Math.cos(aa) * 13, A.y + 6 + Math.sin(aa) * 9, tint, k * (1 - q / 12) * 1.4);
      }
      r.disc(A.x + Math.cos(a) * 13, A.y + 6 + Math.sin(a) * 9, 1.5, tint, k * 1.5);
    };
    if (t < 3.2) {
      const g = clamp(t / 1.6);
      const fade = 1 - smooth(2.4, 3.2, t);
      gesture(g, PURE, fade);
      [-0.45, -0.25, 0.25, 0.45].forEach((o) => gesture(clamp(g + o), o < 0 ? BLUET : GOLDT, 0.45 * fade * smooth(0.2, 0.6, t)));
    }
    let tauC = -1;
    if (t > 3) tauC = t < FREEZE ? (t - 3) / 1.1 : t < RESUME ? (FREEZE - 3) / 1.1 : (FREEZE - 3) / 1.1 + (t - RESUME) / 0.35;
    if (t < SYNC + 0.3) attack(tauC, PURE, 1);
    const form = smooth(1.4, 2.4, t);
    if (form > 0 && t < SYNC + 0.05) {
      crys.forEach((c, i) => {
        const u1 = easeInOut(inv(2.6, 3.3, t)), u2 = easeInOut(inv(3.6, 4.2, t));
        let px = lerp(lerp(c.pos[0].x, c.pos[1].x, u1), c.pos[2].x, u2), py = lerp(lerp(c.pos[0].y, c.pos[1].y, u1), c.pos[2].y, u2);
        const sy = easeIn(inv(SYNC - 0.45, SYNC, t));
        px = lerp(px, M.x, sy);
        py = lerp(py, M.y, sy);
        const rot = t * (0.4 + i * 0.15) * (i % 2 ? 1 : -1);
        const R = 17 * form * (1 - sy * 0.5);
        const hex = [];
        for (let q = 0; q < 6; q++) hex.push(px + Math.cos(rot + q / 6 * TAU) * R, py + Math.sin(rot + q / 6 * TAU) * R * 0.85);
        const inHex = (x, y) => {
          let inside = false;
          for (let a = 0, b = 5; a < 6; b = a++) {
            const xa = hex[a * 2], ya = hex[a * 2 + 1], xb = hex[b * 2], yb = hex[b * 2 + 1];
            if (ya > y !== yb > y && x < (xb - xa) * (y - ya) / (yb - ya) + xa) inside = !inside;
          }
          return inside;
        };
        r.poly(hex, [0.03, 0.02, 0.08], 0.75, BLEND);
        let tau = c.tau;
        if (c.mode === 3 && t > c.ta) tau = c.tau + Math.sin((t - c.ta) * 6) * 0.3;
        r.clip = inHex;
        r.ts = 0.42;
        r.tx = px - M.x * 0.42;
        r.ty = py - M.y * 0.42;
        attack(tau, i % 2 ? BLUET : GOLDT, t > c.ta && c.mode < 3 ? 0.3 : 1);
        r.ts = 1;
        r.tx = 0;
        r.ty = 0;
        r.clip = null;
        r.polyline(hex, [1.2, 1.4, 2], 1, ADD, true);
        for (let q = 0; q < 6; q += 2) r.line(px, py, hex[q * 2], hex[q * 2 + 1], [0.6, 0.6, 1.2], 0.35);
        sparkle(r, hex[2], hex[3], 2, STAR, 0.6 + 0.4 * Math.sin(t * 5 + i));
        r.light(px, py, 30, [0.8, 0.7, 1.4], 0.4);
      });
    }
    crys.forEach((c, i) => {
      const e = t - c.ta;
      if (e < 0 || t > SYNC + 0.4) return;
      if (c.mode === 0) attack(c.tau + e * 1.6, GOLDT, 0.9);
      if (c.mode === 1) attack(c.tau - e * 1.5, BLUET, 0.9);
      if (c.mode === 2) {
        for (let q = 0; q < 30; q++) {
          const a = hash(q + 9) * TAU;
          const rr = e < 0.5 ? (1 - e / 0.5) * 30 + 4 : 4 + (e - 0.5) * 90;
          r.px(B.x + Math.cos(a) * rr, B.y + Math.sin(a) * rr * 0.7, q % 2 ? GOLDT : STAR, 1.2 * clamp(1.5 - e));
        }
      }
      if (c.mode === 3) [0.2, 0.5, 0.8, 1.3].forEach((tt, q) => attack(tt + Math.sin(e * 3 + q) * 0.05, q % 2 ? BLUET : GOLDT, 0.45));
    });
    if (t > SYNC) {
      const e = t - SYNC;
      if (e < 0.08) r.flash = 0.5;
      const R = easeOut(e / 1.4) * 260;
      const pts = [];
      for (let q = 0; q < 14; q++) {
        const a = q / 14 * TAU + e;
        const rr = R * (q % 2 ? 0.94 : 1);
        pts.push(M.x + Math.cos(a) * rr, M.y + Math.sin(a) * rr * 0.75);
      }
      r.polyline(pts, [1.4, 1.6, 2.4], 1.6 * (1 - clamp(e / 1.4)), ADD, true);
      for (let q = 0; q < 40; q++) {
        const a = hash(q) * TAU, v = 40 + hash(q + 2) * 120;
        const x = M.x + Math.cos(a) * fly(0, v, 1, 0, e), y = M.y + Math.sin(a) * fly(0, v, 1, 0, e) * 0.75;
        const life = 1 - smooth(1.5, 3, e);
        if (life > 0) r.poly([x, y - 2, x + 1.5, y, x, y + 2, x - 1.5, y], [1.2, 1.4, 2.2], life);
      }
    }
  },
  post(r, t, s) {
    const FREEZE = 3.45, SYNC = 6;
    const k = smooth(FREEZE, FREEZE + 0.15, t);
    if (k <= 0) return;
    const M = s.M;
    const R = t > SYNC ? easeOut((t - SYNC) / 1.4) * 260 : -1;
    const c = r.c;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (R > 0 && Math.hypot(x - M.x, (y - M.y) / 0.75) < R) continue;
        const i = (y * W + x) * 3;
        const l = c[i] * 0.3 + c[i + 1] * 0.55 + c[i + 2] * 0.15;
        c[i] = lerp(c[i], l * 0.8, k);
        c[i + 1] = lerp(c[i + 1], l * 0.9, k);
        c[i + 2] = lerp(c[i + 2], l * 1.25, k);
      }
  }
};
var constellationEngine = {
  id: 19,
  name: "Constellation Engine",
  school: "ASTRAL",
  duration: 10.5,
  climax: 7.3,
  blurb: "Scattered stars search for a solution, slide into nested orbits, synchronise, and forge a crystalline star.",
  setup(r) {
    const rng = new RNG(1919);
    const C = { x: W / 2 + 24, y: H / 2 - 2 };
    const rings = [{ n: 3, R: 24, w: 1.1 }, { n: 4, R: 46, w: -0.7 }, { n: 5, R: 72, w: 0.45 }];
    const nodes = [];
    rings.forEach((g, ri) => {
      for (let j = 0; j < g.n; j++) nodes.push({ ring: ri, j, sx: rng.r(30, W - 30), sy: rng.r(20, H - 20), tm: rng.r(2.5, 3.6), ph: rng.r(0, TAU) });
    });
    return { C, rings, nodes };
  },
  render(r, t, s) {
    const C = s.C;
    const TS = 6.6, TST = 7, TFR = 7.9;
    r.ambient = 0.55 - smooth(0, 3, t) * 0.25;
    const sync = smooth(5.2, TS, t);
    const posOf = (n) => {
      const g = s.rings[n.ring];
      const wob = Math.sin(t * 1.3 + n.ph) * 0.3 * (1 - sync);
      const ang = -Math.PI / 2 + n.j / g.n * TAU + g.w * Math.min(0, t - TS) * (1 + (1 - sync) * 0.5) + wob;
      const ex = C.x + Math.cos(ang) * g.R * 1.25, ey = C.y + Math.sin(ang) * g.R * 0.72;
      const u = easeInOut(inv(n.tm, n.tm + 1.1, t));
      return { x: lerp(n.sx, ex, u) + Math.sin(u * Math.PI) * 20, y: lerp(n.sy, ey, u), ang };
    };
    const P = s.nodes.map(posOf);
    const fr22 = 1 - smooth(TST, TST + 0.1, t);
    if (t > 1 && t < 3.8) {
      const win = Math.floor(t / 0.18);
      for (let q = 0; q < 6; q++) {
        const a = Math.floor(hash(win * 7 + q) * P.length), b = Math.floor(hash(win * 7 + q + 3) * P.length);
        if (a === b) continue;
        const ph = t / 0.18 % 1;
        const n = Math.ceil(Math.hypot(P[b].x - P[a].x, P[b].y - P[a].y) / 3);
        for (let k = 0; k <= n * Math.min(1, ph * 2); k++) r.px(lerp(P[a].x, P[b].x, k / n), lerp(P[a].y, P[b].y, k / n), INDIGO, 0.8 * (1 - ph));
      }
    }
    const eng = smooth(3.4, 4.2, t) * fr22;
    if (eng > 0) {
      let idx = 0;
      const morph = smooth(4.6, 5.2, t);
      s.rings.forEach((g, ri) => {
        const ids2 = Array.from({ length: g.n }, (_, j) => idx + j);
        idx += g.n;
        for (let j = 0; j < g.n; j++) {
          const a = P[ids2[j]];
          for (const [step, wgt] of [[1, 1 - morph * (g.n > 4 ? 1 : 0.4)], [2, g.n > 3 ? morph : 0]]) {
            if (wgt <= 0.02) continue;
            const b = P[ids2[(j + step) % g.n]];
            const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
            const nx = -dy / L, ny = dx / L;
            const sh = Math.sin(t * 3 + j + ri) * 1.2;
            r.line(a.x + nx * sh, a.y + ny * sh, b.x + nx * sh, b.y + ny * sh, ri === 1 ? CYAN : [0.9, 0.7, 1.6], eng * wgt * 0.7);
            r.line(a.x - nx * sh, a.y - ny * sh, b.x - nx * sh, b.y - ny * sh, ri === 1 ? CYAN : [0.9, 0.7, 1.6], eng * wgt * 0.4);
            const pp = (t * 0.9 + j * 0.37 + ri * 0.21) % 1;
            r.disc(lerp(a.x, b.x, pp), lerp(a.y, b.y, pp), 1, STAR, eng * wgt * 1.4);
          }
        }
      });
      for (let i = 0; i < P.length; i++)
        for (let j = i + 1; j < P.length; j++) {
          if (s.nodes[i].ring === s.nodes[j].ring) continue;
          const da = Math.abs(Math.atan2(Math.sin(P[i].ang - P[j].ang), Math.cos(P[i].ang - P[j].ang)));
          if (da < 0.22) r.line(P[i].x, P[i].y, P[j].x, P[j].y, STAR, eng * (1 - da / 0.22) * 1.2);
        }
      s.rings.forEach((g) => {
        for (let a = 0; a < TAU; a += 0.05) if ((a * 20 + t * 3) % 2 < 1) r.px(C.x + Math.cos(a) * g.R * 1.25, C.y + Math.sin(a) * g.R * 0.72, INDIGO, eng * 0.6);
      });
    }
    const conv = smooth(TS - 0.2, TST, t) * fr22;
    if (conv > 0) P.forEach((p) => r.line(p.x, p.y, lerp(p.x, C.x, conv), lerp(p.y, C.y, conv), STAR, 1.2));
    if (t < TST + 0.05)
      P.forEach((p, i) => {
        const tw = smooth(0.1 + i * 0.06, 0.6 + i * 0.06, t) * (0.7 + 0.3 * Math.sin(t * (2 + hash(i) * 3) + i));
        sparkle(r, p.x, p.y, 2 + (s.nodes[i].ring === 2 ? 1 : 0), STAR, tw * 1.4);
        r.light(p.x, p.y, 22, [1, 0.9, 1.3], tw * 0.4);
      });
    if (t > TST) {
      const e = t - TST;
      const g = easeOutBack(clamp(e / 0.35));
      const N2 = 12;
      const verts = [];
      for (let q = 0; q < N2 * 2; q++) {
        const a = q / (N2 * 2) * TAU - Math.PI / 2;
        const rr = (q % 2 ? 6 : q % 4 === 0 ? 24 : 15) * g;
        verts.push({ x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr * 0.9 });
      }
      const frac = t - TFR;
      for (let q = 0; q < verts.length; q++) {
        const a = verts[q], b = verts[(q + 1) % verts.length];
        let ox = 0, oy = 0, rot = 0, life = 1;
        if (frac > 0) {
          const ang = Math.atan2((a.y + b.y) / 2 - C.y, (a.x + b.x) / 2 - C.x);
          const d = fly(0, 18 + hash(q) * 25, 0.8, 0, frac);
          ox = Math.cos(ang) * d;
          oy = Math.sin(ang) * d;
          rot = (hash(q + 4) - 0.5) * frac * 2;
          life = 1 - smooth(1.2, 2.6, frac);
        }
        if (life <= 0) continue;
        const cx = (C.x + a.x + b.x) / 3 + ox, cy = (C.y + a.y + b.y) / 3 + oy;
        const tri = [C.x, C.y, a.x, a.y, b.x, b.y].map((v, k) => k % 2 ? v + oy : v + ox);
        const cs = Math.cos(rot), sn = Math.sin(rot);
        for (let k = 0; k < 6; k += 2) {
          const lx = tri[k] - cx, ly = tri[k + 1] - cy;
          tri[k] = cx + lx * cs - ly * sn;
          tri[k + 1] = cy + lx * sn + ly * cs;
        }
        const sh = q % 2 ? 0.55 : 1;
        r.poly(tri, scale([0.9, 0.85, 1.3], sh), life, frac > 0 ? DITHER : SET);
        r.polyline(tri, STAR, life * 0.8, ADD, true);
        if (frac > 0 && hash(q + fr2(t, 8)) > 0.8) sparkle(r, cx, cy, 2, STAR, life);
      }
      r.glow(C.x, C.y, 20, [1, 0.9, 1.4], (frac > 0 ? 0.25 : 0.5) * g);
      r.light(C.x, C.y, 160, [1.1, 1, 1.5], 1.4 * (1 - smooth(TFR, TFR + 2, t)));
      if (e < TFR - TST + 0.2) {
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * TAU + Math.sin(e * 2.5 + k) * 0.6 * (k % 2 ? 1 : -1) + e * 0.8;
          const L = easeOut(e / 0.3) * 200;
          for (let q = 26; q < L; q += 1) r.px(C.x + Math.cos(a) * q, C.y + Math.sin(a) * q * 0.9, q % 9 < 6 ? STAR : CYAN, 1.3 * (1 - q / 220));
        }
      }
    }
  }
};
var realityRipper = {
  id: 20,
  name: "Reality Ripper",
  school: "ASTRAL",
  duration: 11.5,
  climax: 5.35,
  blurb: "A rendering artifact grows into a wound in the frame itself, exposing another space with its own rules.",
  setup(r) {
    const rng = new RNG(2020);
    const pts = [];
    const a = { x: 70, y: 36 }, b = { x: 336, y: 186 };
    const N2 = 48;
    for (let i = 0; i <= N2; i++) {
      const u = i / N2;
      const j = i === 0 || i === N2 ? 0 : (noise1(u * 7 + 3) - 0.5) * 34 + rng.r(-3, 3);
      pts.push({ x: lerp(a.x, b.x, u) + j * 0.55, y: lerp(a.y, b.y, u) - j * 0.85 });
    }
    const nrm = pts.map((p, i) => {
      const q0 = pts[Math.max(0, i - 1)], q1 = pts[Math.min(N2, i + 1)];
      const dx = q1.x - q0.x, dy = q1.y - q0.y, L = Math.hypot(dx, dy) || 1;
      return { x: -dy / L, y: dx / L };
    });
    const sec = pts.map((_, i) => ({ to: 1.6 + Math.abs(i - N2 * 0.55) / N2 * 2.2 + rng.r(0, 0.4), tc: 6.6 + rng.r(0, 2.6), w: 14 + rng.r(0, 16) * Math.sin(i / N2 * Math.PI) }));
    const shards = Array.from({ length: 70 }, (_, i) => ({ i: rng.i(2, N2 - 2), v: rng.r(40, 160), s: rng.r(2, 6), spin: rng.r(-6, 6), side: rng.sign(), shape: [rng.r(0, TAU), rng.r(0, TAU), rng.r(0, TAU)] }));
    const cubes = Array.from({ length: 4 }, (_, i) => ({ x: rng.r(60, 320), y: rng.r(30, 190), z: rng.r(1, 3), sp: rng.r(-1, 1), s: rng.r(8, 22) }));
    return { pts, nrm, sec, shards, cubes, N: N2, mask: new Float32Array(W * H * 3) };
  },
  render(r, t, s) {
    r.ambient = 0.6 - smooth(2, 5, t) * 0.15 + smooth(8, 10, t) * 0.15;
    if (t < 2.2) {
      const mx = 150 + t * 12, my = 60 + Math.sin(t * 2) * 3;
      r.disc(mx, my, 1, [0.8, 0.8, 1], 0.9);
      if (pulse(0.7, 1, t) > 0) r.disc(mx + 7, my - 1, 1, [0.8, 0.8, 1], 0.9);
    }
    const A = s.pts[18], B = s.pts[36];
    if (t > 2.6 && t < 4) {
      const u = easeIn(inv(2.6, 3.7, t));
      const x = lerp(A.x - 70, A.x, u), y = lerp(A.y + 40, A.y, u);
      if (u < 1) {
        r.disc(x, y, 2.5, CYAN, 1.4);
        r.glow(x, y, 9, CYAN, 0.7);
        r.light(x, y, 30, [0.5, 1.2, 1.6], 0.6);
      }
    }
    if (t > 4.15 && t < 6) {
      const u = easeOut(inv(4.15, 5.6, t));
      const x = lerp(B.x, B.x + 60, u), y = lerp(B.y, B.y - 70, u);
      r.disc(x, y, 2.5, MAG, 1.4);
      r.glow(x, y, 9, MAG, 0.7);
      r.light(x, y, 30, [1.4, 0.4, 1.3], 0.6);
    }
  },
  post(r, t, s) {
    const pts = s.pts, nrm = s.nrm, N2 = s.N;
    const TCOL = 5.65;
    const width = (i) => {
      const sc = s.sec[i];
      const o = easeOut(inv(sc.to, sc.to + 1.4, t)) * sc.w;
      const c = 1 - easeInOut(inv(sc.tc, sc.tc + 0.5 + hash(i) * 0.6, t));
      const pulseW = pulse(TCOL - 0.3, TCOL + 0.4, t) * 6;
      return Math.max(0, o * c + pulseW * c + (hash(i + fr2(t, 12)) - 0.5) * 2 * (o > 1 ? 1 : 0));
    };
    const ws = pts.map((_, i) => width(i));
    const maxW = Math.max(...ws);
    const f = fr2(t, 10);
    if (t < 1.8) {
      const c = r.c, tmp = r.tmp;
      tmp.set(c);
      const p = pts[24];
      if (pulse(0.3, 1.4, t) > 0) {
        const y = Math.floor(p.y);
        const L = Math.floor(10 + t * 30);
        for (let x = Math.floor(p.x - L); x < p.x + L; x++) if (x > 3 && x < W) for (let ch = 0; ch < 3; ch++) c[(y * W + x) * 3 + ch] = tmp[(y * W + x - 3) * 3 + ch];
      }
      if (pulse(1, 1.6, t) > 0) for (let y = 120; y < 132; y++) for (let x = 230; x < 246; x++) for (let ch = 0; ch < 3; ch++) c[(y * W + x) * 3 + ch] = tmp[((y - 2) * W + x + 4) * 3 + ch] * 1.3;
    }
    if (t > 11) return;
    if (maxW > 0.5) {
      const segIdx = (x, y) => {
        let best = 0, bd = 1e9;
        for (let i = 0; i <= N2; i += 2) {
          const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        return best;
      };
      r.warp(0, 0, W - 1, H - 1, (x, y, o) => {
        if (((y >> 2) + f) % 3 === 0) return;
        const i = segIdx(x, y);
        const p = pts[i], n = nrm[i], w = ws[i];
        if (w < 0.5) return;
        const d = (x - p.x) * n.x + (y - p.y) * n.y;
        const ad = Math.abs(d);
        if (ad > 40) return;
        const pull = Math.round((1 - ad / 40) * w * 0.6);
        o[0] = x + n.x * Math.sign(d) * pull;
        o[1] = y + n.y * Math.sign(d) * pull;
      });
      r.setTarget(r.alt);
      const alt = r.alt;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 3;
          const g = 0.5 + 0.5 * Math.sin(x * 0.02 + y * 0.03 + t * 0.6);
          alt[i] = 0.08 + g * 0.18;
          alt[i + 1] = 0.01;
          alt[i + 2] = 0.16 + (1 - g) * 0.2;
          for (let L = 1; L <= 3; L++) {
            const sx = Math.floor((x + t * 14 * L) / (2 + L)), sy = Math.floor((y - t * 5 * L) / (2 + L));
            if (hash2(sx * L, sy) > 0.985) {
              alt[i] += 0.6 * L;
              alt[i + 1] += 0.5 * L;
              alt[i + 2] += 0.8 * L;
            }
          }
        }
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const bx = (x + Math.floor(t * 20) >> 5) + (y >> 5) * 13;
          if (hash(bx) < 0.75) continue;
          const sx = W - 1 - (x * 2 + Math.floor(t * 9)) % W, sy = H - 1 - y * 2 % H;
          const i = (y * W + x) * 3, j = (sy * W + sx) * 3;
          alt[i] += (0.35 - r.floor[j]) * 1.6;
          alt[i + 1] += (0.3 - r.floor[j + 1]) * 0.8;
          alt[i + 2] += (0.35 - r.floor[j + 2]) * 2.2;
        }
      for (const cb of s.cubes) {
        const rx = t * 0.7 * cb.sp + cb.z, ry = t * 0.5 + cb.z * 2;
        const cx = cb.x + Math.sin(t * 0.3 * cb.z) * 30 / cb.z, cy = cb.y + Math.cos(t * 0.2) * 10;
        const V32 = [];
        for (let q = 0; q < 8; q++) {
          let x = q & 1 ? 1 : -1, y = q & 2 ? 1 : -1, z = q & 4 ? 1 : -1;
          [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
          [x, z] = [x * Math.cos(ry) - z * Math.sin(ry), x * Math.sin(ry) + z * Math.cos(ry)];
          const pz = 3 / (3 + z);
          V32.push([cx + x * cb.s * pz, cy + y * cb.s * pz]);
        }
        for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) {
          const b = a | bit;
          if (b !== a) r.line(V32[a][0], V32[a][1], V32[b][0], V32[b][1], cb.z > 2 ? CYAN : MAG, 1.2 / cb.z + 0.3);
        }
      }
      const mk = s.mask;
      mk.fill(0);
      r.setTarget(mk);
      const left = [], right = [];
      for (let i = 0; i <= N2; i++) {
        const w = ws[i] * 0.5;
        left.push(pts[i].x + nrm[i].x * w, pts[i].y + nrm[i].y * w);
        right.push(pts[i].x - nrm[i].x * w, pts[i].y - nrm[i].y * w);
      }
      const poly = [...left];
      for (let i = N2; i >= 0; i--) poly.push(right[i * 2], right[i * 2 + 1]);
      r.poly(poly, [1, 0, 0], 1, SET);
      r.setTarget(r.main);
      const c = r.main;
      for (let p = 0; p < W * H; p++) if (mk[p * 3] > 0) {
        c[p * 3] = alt[p * 3];
        c[p * 3 + 1] = alt[p * 3 + 1];
        c[p * 3 + 2] = alt[p * 3 + 2];
      }
      for (let i = 0; i <= N2; i++) {
        if (ws[i] < 0.5) continue;
        const brk = hash(i * 3 + f) > 0.25;
        if (brk) {
          r.px(left[i * 2], left[i * 2 + 1], MAG, 2);
          r.px(right[i * 2], right[i * 2 + 1], CYAN, 2);
        }
        if (i < N2) {
          r.line(left[i * 2], left[i * 2 + 1], left[i * 2 + 2], left[i * 2 + 3], [1.8, 0.8, 1.8], 0.8);
          r.line(right[i * 2], right[i * 2 + 1], right[i * 2 + 2], right[i * 2 + 3], [0.8, 1.6, 2], 0.8);
        }
        r.light(pts[i].x, pts[i].y, 30, [1, 0.4, 1.3], 0);
      }
      const tmp = r.tmp;
      tmp.set(c);
      for (let q = 0; q < 7; q++) {
        const sd = q * 31 + Math.floor(t * 5) * 7;
        if (hash(sd) > maxW / 18) continue;
        const i = Math.floor(hash(sd + 1) * N2);
        const sx = Math.floor(pts[i].x + (hash(sd + 2) - 0.5) * 40), sy = Math.floor(pts[i].y + (hash(sd + 3) - 0.5) * 40);
        const dx = Math.floor((hash(sd + 4) - 0.5) * 50), dy = Math.floor((hash(sd + 5) - 0.5) * 30);
        for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) {
          const X = sx + x + dx, Y = sy + y + dy, SX = sx + x, SY = sy + y;
          if (X < 0 || Y < 0 || X >= W || Y >= H || SX < 0 || SY < 0 || SX >= W || SY >= H) continue;
          for (let ch = 0; ch < 3; ch++) c[(Y * W + X) * 3 + ch] = tmp[(SY * W + SX) * 3 + ch];
        }
      }
    }
    const e = t - TCOL;
    if (e > 0) {
      if (e < 0.1) r.flash = 0.7;
      if (e < 0.7) {
        r.shakeX = (hash(t * 50) - 0.5) * 10 * (1 - e / 0.7);
        r.shakeY = (hash(t * 53) - 0.5) * 7 * (1 - e / 0.7);
      }
      if (e < 4.6) {
        const c = r.main, tmp = r.tmp;
        tmp.set(c);
        for (let by = 0; by < H; by += 12)
          for (let bx = 0; bx < W; bx += 12) {
            const hb = hash(bx * 0.37 + by * 1.7);
            const snap = 0.15 + hb * 3.5;
            const k = e < snap ? hb > 0.7 ? 1 - easeOut(e / snap) : 1 : 0;
            if (k <= 0) continue;
            const a = hash(bx + by * 3) * TAU;
            const amp = (6 + hb * 20) * k * Math.exp(-e * 0.4);
            const ox = Math.round(Math.cos(a) * amp), oy = Math.round(Math.sin(a) * amp);
            for (let y = by; y < by + 12 && y < H; y++) for (let x = bx; x < bx + 12 && x < W; x++) {
              const sx = Math.min(W - 1, Math.max(0, x - ox)), sy = Math.min(H - 1, Math.max(0, y - oy));
              for (let ch = 0; ch < 3; ch++) c[(y * W + x) * 3 + ch] = tmp[(sy * W + sx) * 3 + ch];
            }
          }
      }
      for (let q = 0; q < 4; q++) {
        const ee = e - q * 0.12;
        if (ee < 0 || ee > 1.2) continue;
        const off = ee * 70;
        for (let i = 0; i < N2; i++) {
          r.line(pts[i].x + nrm[i].x * off, pts[i].y + nrm[i].y * off, pts[i + 1].x + nrm[i + 1].x * off, pts[i + 1].y + nrm[i + 1].y * off, MAG, 1.4 * (1 - ee / 1.2));
          r.line(pts[i].x - nrm[i].x * off, pts[i].y - nrm[i].y * off, pts[i + 1].x - nrm[i + 1].x * off, pts[i + 1].y - nrm[i + 1].y * off, CYAN, 1.4 * (1 - ee / 1.2));
        }
      }
      for (const sh of s.shards) {
        const life = 1 - smooth(1.2, 2.4, e);
        if (life <= 0) break;
        const p = pts[sh.i], n = nrm[sh.i];
        const d = fly(0, sh.v, 1.6, 0, e) * sh.side;
        const x = p.x + n.x * d, y = p.y + n.y * d;
        const rot = sh.spin * e;
        const tri = sh.shape.flatMap((a) => [x + Math.cos(a + rot) * sh.s, y + Math.sin(a + rot) * sh.s]);
        r.poly(tri, sh.side > 0 ? [0.5, 0.1, 0.6] : [0.1, 0.4, 0.6], life, DITHER);
        r.polyline(tri, sh.side > 0 ? MAG : CYAN, life, ADD, true);
        if (sh.i % 3 === 0) sparkle(r, x + 6, y - 4, 2, STAR, life);
      }
    }
    if (t > 9.3 && t < 10.6) {
      const c = r.main, tmp = r.tmp;
      tmp.set(c);
      const p = pts[30];
      const off = t < 10.45 ? 3 : 0;
      for (let y = Math.floor(p.y) - 4; y < p.y + 4; y++) for (let x = Math.floor(p.x) - 4; x < p.x + 4; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        for (let ch = 0; ch < 3; ch++) c[(y * W + x) * 3 + ch] = tmp[((y + 1) * W + x + off) * 3 + (ch + (off ? 1 : 0)) % 3];
      }
    }
    void bayer;
  }
};
var ASTRAL = [eventHorizon, chronoshard, constellationEngine, realityRipper];

// src/effects/index.ts
var EFFECTS = [...PYRE, ...TIDE, ...TEMPEST, ...VERDANT, ...ASTRAL];

// src/engine/scene.ts
function makeRenderer() {
  const r = new Renderer();
  r.anchors = [
    { x: 262, y: 104 },
    { x: 318, y: 62 },
    { x: 330, y: 160 },
    { x: 196, y: 52 },
    { x: 214, y: 176 },
    { x: 150, y: 84 }
  ];
  return r;
}
function renderFrame(r, fx, state, t, wall, out) {
  r.begin();
  r.time = wall;
  const casting = fx ? Math.max(0, 1 - Math.abs(t - 0.3) * 1.5) : 0;
  r.drawActors(wall, casting);
  for (let k = 0; k < 24; k++) {
    const x = (hash(k) * W + wall * (3 + hash(k + 1) * 5)) % W;
    const y = (hash(k + 2) * H + Math.sin(wall * 0.5 + k) * 6 + H) % H;
    r.plot(Math.floor(x), Math.floor(y), 0.12, 0.13, 0.18, 0, 1);
  }
  if (fx && t >= 0) fx.render(r, Math.min(t, fx.duration), state);
  r.lighting();
  if (fx && fx.post && t >= 0) {
    r.setTarget(r.main);
    r.tx = r.ty = 0;
    r.ts = 1;
    r.clip = null;
    fx.post(r, Math.min(t, fx.duration), state);
  }
  r.setTarget(r.main);
  r.finalize(out);
}

// scripts/capture.ts
var crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 4294967295;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function png(w, h, rgba) {
  const chunk = (type, data) => {
    const out2 = new Uint8Array(12 + data.length);
    const dv2 = new DataView(out2.buffer);
    dv2.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out2[4 + i] = type.charCodeAt(i);
    out2.set(data, 8);
    dv2.setUint32(8 + data.length, crc32(out2.subarray(4, 8 + data.length)));
    return out2;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = new Uint8Array((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array())];
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
function bloom(src) {
  const bright = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) {
      const v = src[i * 4 + c] / 255;
      bright[i * 3 + c] = Math.max(0, v - 0.55) * 1.6;
    }
  }
  const blur = (a, dx, dy, R) => {
    const o = new Float32Array(a.length);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s0 = 0, s1 = 0, s2 = 0, n = 0;
        for (let k = -R; k <= R; k++) {
          const xx = Math.min(W - 1, Math.max(0, x + dx * k)), yy = Math.min(H - 1, Math.max(0, y + dy * k));
          const w = 1 - Math.abs(k) / (R + 1);
          const j = (yy * W + xx) * 3;
          s0 += a[j] * w;
          s1 += a[j + 1] * w;
          s2 += a[j + 2] * w;
          n += w;
        }
        const i = (y * W + x) * 3;
        o[i] = s0 / n;
        o[i + 1] = s1 / n;
        o[i + 2] = s2 / n;
      }
    return o;
  };
  const b = blur(blur(bright, 1, 0, 6), 0, 1, 6);
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) out[i * 4 + c] = src[i * 4 + c] + b[i * 3 + c] * 255 * 0.9;
    out[i * 4 + 3] = 255;
  }
  return out;
}
function upscale(src, w, h, s) {
  const out = new Uint8Array(w * s * h * s * 4);
  for (let y = 0; y < h * s; y++)
    for (let x = 0; x < w * s; x++) {
      const i = ((y / s | 0) * w + (x / s | 0)) * 4, o = (y * w * s + x) * 4;
      out[o] = src[i];
      out[o + 1] = src[i + 1];
      out[o + 2] = src[i + 2];
      out[o + 3] = 255;
    }
  return out;
}
var mode = process.argv[2] || "climax";
var ids = process.argv.slice(3).map(Number);
var list = EFFECTS.filter((e) => !ids.length || ids.includes(e.id));
mkdirSync("shots", { recursive: true });
if (mode === "sheet") {
  const cols = 2, rows = Math.ceil(list.length / cols);
  const sheet = new Uint8Array(W * cols * H * rows * 4);
  list.forEach((fx, k) => {
    const r = makeRenderer();
    const st = fx.setup(r);
    const buf = new Uint8ClampedArray(W * H * 4);
    const tt = process.env.T ? fx.climax + Number(process.env.T) : fx.climax;
    renderFrame(r, fx, st, tt, tt, buf);
    const img = bloom(buf);
    const ox = k % cols * W, oy = Math.floor(k / cols) * H;
    for (let y = 0; y < H; y++) sheet.set(img.subarray(y * W * 4, (y + 1) * W * 4), ((oy + y) * W * cols + ox) * 4);
  });
  writeFileSync(`shots/sheet${process.env.V || ""}.png`, png(W * cols, H * rows, sheet));
  console.log("sheet ok");
  process.exit(0);
}
for (const fx of list) {
  const r = makeRenderer();
  const st = fx.setup(r);
  const buf = new Uint8ClampedArray(W * H * 4);
  const name = `${String(fx.id).padStart(2, "0")}-${fx.name.toLowerCase().replace(/\s+/g, "-")}`;
  const t0 = Date.now();
  if (mode === "climax") {
    renderFrame(r, fx, st, fx.climax, fx.climax, buf);
    writeFileSync(`shots/${name}${process.env.V || ""}.png`, png(W * 2, H * 2, upscale(bloom(buf), W, H, 2)));
  } else {
    const times = mode === "strip" ? [0.12, 0.25, 0.4, 0.52, 0.62, 0.75, 0.88, 0.97].map((f) => f * fx.duration) : process.argv.slice(4).map(Number);
    if (mode === "strip") times.push(fx.climax);
    times.sort((a, b) => a - b);
    const cols = 3, rows = Math.ceil(times.length / cols);
    const sheet = new Uint8Array(W * cols * H * rows * 4);
    times.forEach((tt, k) => {
      renderFrame(r, fx, st, tt, tt, buf);
      const img = bloom(buf);
      const ox = k % cols * W, oy = Math.floor(k / cols) * H;
      for (let y = 0; y < H; y++) sheet.set(img.subarray(y * W * 4, (y + 1) * W * 4), ((oy + y) * W * cols + ox) * 4);
    });
    writeFileSync(`shots/strip-${name}${process.env.V || ""}.png`, png(W * cols, H * rows, sheet));
  }
  console.log(name, "ok", Date.now() - t0, "ms");
}
