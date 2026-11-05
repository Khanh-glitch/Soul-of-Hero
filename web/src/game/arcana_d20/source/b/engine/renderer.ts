import { Col, clamp, hash2, RNG, fbm, noise2 } from './math';

export const W = 384;
export const H = 216;
const N = W * H;

// 4x4 Bayer matrix, normalized (0..1)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

export const ADD = 0, SET = 1, BLEND = 2, DITHER = 3, MUL = 4, SUB = 5;

type Light = { x: number; y: number; r: number; c: Col; i: number };

/**
 * A deterministic, CPU-side pixel renderer. Everything draws at native
 * 384x216 into an HDR float buffer that is tone-mapped, ordered-dithered and
 * posterised at the end so that all magic resolves into honest pixel clusters.
 */
export class Renderer {
  c: Float32Array; // current colour target (HDR)
  main = new Float32Array(N * 3);
  alt = new Float32Array(N * 3);
  tmp = new Float32Array(N * 3);
  floor = new Float32Array(N * 3); // static floor albedo
  alb = new Float32Array(N * 3); // per-frame albedo (floor + decals)
  shade = new Float32Array(N);
  mask = new Uint8Array(N);
  lightBuf = new Float32Array(N * 3);
  lights: Light[] = [];
  ambient = 0.62;
  tint: Col = [0.85, 0.9, 1.15];
  flash = 0;
  flashCol: Col = [1, 1, 1];
  shakeX = 0;
  shakeY = 0;
  // transform & clip
  tx = 0;
  ty = 0;
  ts = 1;
  clip: ((x: number, y: number) => boolean) | null = null;
  caster = { x: 104, y: 132 };
  target = { x: 262, y: 104 };
  anchors: { x: number; y: number }[] = [];
  time = 0; // global wall time (for idle animation)

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
        // grout
        if (lx === 0 || ly === 0) base *= 0.35;
        else if (lx === 1 || ly === 1) base *= 1.28; // bevel highlight
        else if (lx === TS - 1 || ly === TS - 1) base *= 0.7;
        // pits
        if (hash2(x, y) > 0.985) base *= 0.6;
        let r = base * 0.86, g = base * 0.9, b = base * 1.12;
        // moss in grout lines near noise
        const m = noise2(x * 0.05 + 10, y * 0.05);
        if ((lx < 2 || ly < 2) && m > 0.68 && hash2(x * 1.3, y) > 0.4) {
          r = 0.08; g = 0.16; b = 0.1;
        }
        const i = (y * W + x) * 3;
        f[i] = r; f[i + 1] = g; f[i + 2] = b;
      }
    }
    // cracks
    for (let k = 0; k < 14; k++) {
      let x = rng.r(0, W), y = rng.r(0, H), a = rng.r(0, 6.28);
      const len = rng.i(10, 34);
      for (let s = 0; s < len; s++) {
        a += rng.r(-0.6, 0.6);
        x += Math.cos(a); y += Math.sin(a);
        const ix = x | 0, iy = y | 0;
        if (ix < 0 || iy < 0 || ix >= W || iy >= H) break;
        const i = (iy * W + ix) * 3;
        f[i] *= 0.45; f[i + 1] *= 0.45; f[i + 2] *= 0.5;
      }
    }
    // faint inlaid ritual circle under the arena centre
    const cx = W / 2, cy = H / 2 - 4;
    for (let a = 0; a < 6.283; a += 0.004) {
      for (const rr of [92, 96]) {
        const ix = Math.round(cx + Math.cos(a) * rr), iy = Math.round(cy + Math.sin(a) * rr * 0.62);
        if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
        const i = (iy * W + ix) * 3;
        f[i] *= 1.35; f[i + 1] *= 1.3; f[i + 2] *= 1.25;
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

  setTarget(buf: Float32Array) {
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
          // banded falloff with dithered band edges = pixel-art lighting
          f = Math.floor(f * 6 + bayer(x, y)) / 6;
          if (f <= 0) continue;
          const k = f * l.i, i = (y * W + x) * 3;
          L[i] += l.c[0] * k; L[i + 1] += l.c[1] * k; L[i + 2] += l.c[2] * k;
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
  finalize(out: Uint8ClampedArray) {
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
        const ex = mx > 1.1 ? (mx - 1.1) * 0.32 : 0; // hot colours burn toward white
        r = 1 - Math.exp(-(r + ex) * 1.05);
        g = 1 - Math.exp(-(g + ex) * 1.05);
        b = 1 - Math.exp(-(b + ex) * 1.05);
        const d = bayer(x, y) - 0.5;
        const o = (y * W + x) * 4;
        out[o] = (Math.floor(clamp(r * LV + d, 0, LV)) / LV) * 255;
        out[o + 1] = (Math.floor(clamp(g * LV + d, 0, LV)) / LV) * 255;
        out[o + 2] = (Math.floor(clamp(b * LV + d, 0, LV)) / LV) * 255;
        out[o + 3] = 255;
      }
    }
  }

  // ---------------------------------------------------------------- pixel core
  plot(ix: number, iy: number, r: number, g: number, b: number, mode: number, a: number) {
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    if (this.clip && !this.clip(ix, iy)) return;
    const p = iy * W + ix, i = p * 3, c = this.c;
    switch (mode) {
      case ADD:
        c[i] += r * a; c[i + 1] += g * a; c[i + 2] += b * a;
        break;
      case SET:
        c[i] = r; c[i + 1] = g; c[i + 2] = b;
        if (c === this.main) this.mask[p] = 1;
        break;
      case BLEND:
        c[i] += (r - c[i]) * a; c[i + 1] += (g - c[i + 1]) * a; c[i + 2] += (b - c[i + 2]) * a;
        break;
      case DITHER:
        if (bayer(ix, iy) < a) {
          c[i] = r; c[i + 1] = g; c[i + 2] = b;
          if (c === this.main) this.mask[p] = 1;
        }
        break;
      case MUL:
        c[i] *= r; c[i + 1] *= g; c[i + 2] *= b;
        break;
      case SUB:
        c[i] = Math.max(0, c[i] - r * a); c[i + 1] = Math.max(0, c[i + 1] - g * a); c[i + 2] = Math.max(0, c[i + 2] - b * a);
        break;
    }
  }

  X(x: number) { return x * this.ts + this.tx; }
  Y(y: number) { return y * this.ts + this.ty; }

  px(x: number, y: number, c: Col, i = 1, mode = ADD) {
    this.plot(Math.floor(this.X(x)), Math.floor(this.Y(y)), c[0] * (mode === ADD ? i : 1), c[1] * (mode === ADD ? i : 1), c[2] * (mode === ADD ? i : 1), mode, mode === ADD ? 1 : i);
  }

  /** filled disc. In ADD mode `i` is intensity, otherwise it's alpha */
  disc(x: number, y: number, rad: number, c: Col, i = 1, mode = ADD, sy = 1) {
    const cx = this.X(x), cy = this.Y(y), R = rad * this.ts;
    if (R < 0.5) { this.px(x, y, c, i, mode); return; }
    const Ry = R * sy;
    const x0 = Math.floor(cx - R), x1 = Math.ceil(cx + R), y0 = Math.floor(cy - Ry), y1 = Math.ceil(cy + Ry);
    const k = mode === ADD ? i : 1, a = mode === ADD ? 1 : i;
    const r = c[0] * k, g = c[1] * k, b = c[2] * k;
    const R2 = R * R;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = (yy + 0.5 - cy) / sy;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - cx;
        if (dx * dx + dy * dy <= R2) this.plot(xx, yy, r, g, b, mode, a);
      }
    }
  }

  /** soft radial glow, additive */
  glow(x: number, y: number, rad: number, c: Col, i = 1, sy = 1) {
    const cx = this.X(x), cy = this.Y(y), R = rad * this.ts;
    if (R < 1) return;
    const x0 = Math.floor(cx - R), x1 = Math.ceil(cx + R), y0 = Math.floor(cy - R * sy), y1 = Math.ceil(cy + R * sy);
    const iR = 1 / R;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = ((yy + 0.5 - cy) / sy) * iR;
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

  ring(x: number, y: number, rad: number, th: number, c: Col, i = 1, mode = ADD, sy = 1) {
    const cx = this.X(x), cy = this.Y(y), R = rad * this.ts, T = Math.max(0.6, th * this.ts);
    const Ro = R + T / 2, Ri = Math.max(0, R - T / 2);
    const x0 = Math.floor(cx - Ro), x1 = Math.ceil(cx + Ro), y0 = Math.floor(cy - Ro * sy), y1 = Math.ceil(cy + Ro * sy);
    const k = mode === ADD ? i : 1, a = mode === ADD ? 1 : i;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = (yy + 0.5 - cy) / sy;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - cx;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= Ro && d >= Ri) this.plot(xx, yy, c[0] * k, c[1] * k, c[2] * k, mode, a);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Col, i = 1, mode = ADD) {
    let ax = this.X(x0), ay = this.Y(y0);
    const bx = this.X(x1), by = this.Y(y1);
    const dx = bx - ax, dy = by - ay;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    const k = mode === ADD ? i : 1, a = mode === ADD ? 1 : i;
    const r = c[0] * k, g = c[1] * k, b = c[2] * k;
    let lx = -9999, ly = -9999;
    for (let s = 0; s <= n; s++) {
      const ix = Math.floor(ax + (dx * s) / n), iy = Math.floor(ay + (dy * s) / n);
      if (ix === lx && iy === ly) continue;
      lx = ix; ly = iy;
      this.plot(ix, iy, r, g, b, mode, a);
    }
  }

  /** thick line (capsule) */
  thick(x0: number, y0: number, x1: number, y1: number, w: number, c: Col, i = 1, mode = ADD) {
    if (w <= 1.2) { this.line(x0, y0, x1, y1, c, i, mode); return; }
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const nx = (-dy / L) * w * 0.5, ny = (dx / L) * w * 0.5;
    this.poly([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny], c, i, mode);
  }

  polyline(pts: number[], c: Col, i = 1, mode = ADD, closed = false) {
    for (let k = 0; k + 3 < pts.length; k += 2) this.line(pts[k], pts[k + 1], pts[k + 2], pts[k + 3], c, i, mode);
    if (closed && pts.length >= 6) this.line(pts[pts.length - 2], pts[pts.length - 1], pts[0], pts[1], c, i, mode);
  }

  /** scanline polygon fill (even-odd), flat [x,y,x,y...] */
  poly(pts: number[], c: Col, i = 1, mode = ADD) {
    const n = pts.length >> 1;
    if (n < 3) return;
    const P = new Array<number>(pts.length);
    let minY = 1e9, maxY = -1e9;
    for (let k = 0; k < n; k++) {
      P[k * 2] = this.X(pts[k * 2]);
      P[k * 2 + 1] = this.Y(pts[k * 2 + 1]);
      if (P[k * 2 + 1] < minY) minY = P[k * 2 + 1];
      if (P[k * 2 + 1] > maxY) maxY = P[k * 2 + 1];
    }
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.ceil(maxY));
    const k2 = mode === ADD ? i : 1, a = mode === ADD ? 1 : i;
    const r = c[0] * k2, g = c[1] * k2, b = c[2] * k2;
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let k = 0, j = n - 1; k < n; j = k++) {
        const yi = P[k * 2 + 1], yj = P[j * 2 + 1];
        if ((yi > sy) !== (yj > sy)) {
          xs.push(P[k * 2] + ((sy - yi) / (yj - yi)) * (P[j * 2] - P[k * 2]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let q = 0; q + 1 < xs.length; q += 2) {
        const xa = Math.max(0, Math.round(xs[q])), xb = Math.min(W - 1, Math.round(xs[q + 1]) - 1);
        for (let x = xa; x <= xb; x++) this.plot(x, y, r, g, b, mode, a);
      }
    }
  }

  /** ribbon from centre points + widths; draws as quads */
  ribbon(pts: { x: number; y: number }[], widths: number[], c: Col, i = 1, mode = ADD) {
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1];
      const w0 = widths[k], w1 = widths[k + 1];
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      this.poly([a.x + nx * w0, a.y + ny * w0, b.x + nx * w1, b.y + ny * w1, b.x - nx * w1, b.y - ny * w1, a.x - nx * w0, a.y - ny * w0], c, i, mode);
    }
  }

  // ---------------------------------------------------------------- world layers
  light(x: number, y: number, r: number, c: Col, i = 1) {
    if (i <= 0.001 || r < 2) return;
    this.lights.push({ x: this.X(x), y: this.Y(y), r: r * this.ts, c, i });
  }

  shadow(x: number, y: number, rx: number, ry: number, amt: number) {
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
  decal(x: number, y: number, c: Col, a = 1) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    const i = (iy * W + ix) * 3, A = this.alb;
    A[i] += (c[0] - A[i]) * a; A[i + 1] += (c[1] - A[i + 1]) * a; A[i + 2] += (c[2] - A[i + 2]) * a;
  }
  decalDisc(x: number, y: number, rad: number, c: Col, a = 1, jag = 0) {
    for (let yy = Math.floor(y - rad); yy <= y + rad; yy++)
      for (let xx = Math.floor(x - rad); xx <= x + rad; xx++) {
        const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / rad;
        const lim = 1 - jag * hash2(Math.floor(Math.atan2(yy - y, xx - x) * 6), 3.3);
        if (d < lim) this.decal(xx, yy, c, a * (d < lim * 0.7 ? 1 : bayer(xx, yy) < 0.5 ? 1 : 0.5));
      }
  }
  decalLine(x0: number, y0: number, x1: number, y1: number, c: Col, a = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let s = 0; s <= n; s++) this.decal(x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, c, a);
  }

  /** Resample the colour target through a displacement function.
   *  fn receives screen coords and must write the source coordinate into o. */
  warp(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, o: number[]) => void) {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
    const c = this.c, t = this.tmp;
    t.set(c);
    const o = [0, 0];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        o[0] = x; o[1] = y;
        fn(x, y, o);
        let sx = Math.floor(o[0]), sy = Math.floor(o[1]);
        if (sx === x && sy === y) continue;
        sx = sx < 0 ? 0 : sx >= W ? W - 1 : sx;
        sy = sy < 0 ? 0 : sy >= H ? H - 1 : sy;
        const i = (y * W + x) * 3, j = (sy * W + sx) * 3;
        c[i] = t[j]; c[i + 1] = t[j + 1]; c[i + 2] = t[j + 2];
      }
  }

  /** read a pixel of current target */
  get(x: number, y: number, o: number[]) {
    x = Math.max(0, Math.min(W - 1, Math.floor(x)));
    y = Math.max(0, Math.min(H - 1, Math.floor(y)));
    const i = (y * W + x) * 3;
    o[0] = this.c[i]; o[1] = this.c[i + 1]; o[2] = this.c[i + 2];
  }

  /** Draw the arena actors into the albedo layer so they are lit by magic. */
  drawActors(t: number, casting: number) {
    // anchors: small obsidian pylons with brass caps
    for (const a of this.anchors) {
      this.shadow(a.x + 2, a.y + 3, 6, 3, 0.7);
      for (let yy = -9; yy <= 1; yy++)
        for (let xx = -2; xx <= 2; xx++) {
          const edge = Math.abs(xx) === 2;
          const top = yy < -6;
          const c: Col = top ? [0.55, 0.42, 0.22] : edge ? [0.08, 0.08, 0.12] : [0.18 - yy * 0.004, 0.17, 0.24];
          if (top && Math.abs(xx) + (yy + 9) < 1) continue;
          this.decal(a.x + xx, a.y + yy, xx === -1 && !top ? [0.32, 0.32, 0.42] : c);
        }
      const gl = 0.5 + 0.5 * Math.sin(t * 2 + a.x);
      this.plot(Math.floor(a.x), Math.floor(a.y - 5), 0.2 * gl, 0.4 * gl, 0.9 * gl, ADD, 1);
    }
    // caster: hooded mage, 9x14
    const cx = Math.floor(this.caster.x), cy = Math.floor(this.caster.y);
    const bob = Math.round(Math.sin(t * 2.2) * 0.6);
    this.shadow(cx + 1, cy + 2, 7, 3, 0.85);
    const S = [
      '...hhh...',
      '..hHHHh..',
      '.hHHHHHh.',
      '.hHfffHh.',
      '.hfeffeh.',
      '..hffffh.',
      '.rrRRRrr.',
      'rrRRRRRrr',
      'rRRgRRRRr',
      'rRRRgRRRr',
      'rRRRRgRRr',
      '.rRRRRRr.',
      '.rrRRRrr.',
      '..bb.bb..',
    ];
    const pal: Record<string, Col> = {
      h: [0.12, 0.08, 0.22], H: [0.28, 0.18, 0.46], f: [0.05, 0.04, 0.07], e: [1, 1, 1],
      r: [0.14, 0.09, 0.26], R: [0.32, 0.2, 0.52], g: [0.7, 0.55, 0.25], b: [0.1, 0.07, 0.1],
    };
    for (let yy = 0; yy < S.length; yy++)
      for (let xx = 0; xx < 9; xx++) {
        const ch = S[yy][xx];
        if (ch === '.') continue;
        const X = cx - 4 + xx, Y = cy - 13 + yy + (yy < 6 ? bob : 0);
        if (ch === 'e') {
          const k = 0.8 + casting * 2;
          this.plot(X, Y, 0.6 * k, 0.9 * k, 1.4 * k, SET, 1);
        } else this.decal(X, Y, pal[ch]);
      }
    // staff
    for (let yy = -16; yy <= 0; yy++) this.decal(cx + 5, cy + yy, [0.3, 0.2, 0.12]);
    const k = 0.6 + casting * 2.5 + 0.2 * Math.sin(t * 4);
    this.plot(cx + 5, cy - 17, 0.8 * k, 0.6 * k, 1.6 * k, ADD, 1);
    this.light(cx + 5, cy - 17, 18 + casting * 10, [0.5, 0.45, 1], 0.25 + casting * 0.5);
  }
}
