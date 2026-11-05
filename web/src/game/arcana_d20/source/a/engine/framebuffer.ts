// ---------------------------------------------------------------------------
// ARCANA :: HDR pixel framebuffer
//   float RGB accumulation -> persistence (trail) -> camera resample with
//   refractive shockwaves + radial chromatic aberration -> bloom -> filmic
//   tonemap -> impact frames -> ordered-dither quantization.
// ---------------------------------------------------------------------------

import { clamp, RGB, vnoise } from "./math";

const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

export interface PostWave {
  x: number;
  y: number;
  age: number;
  speed: number;
  width: number;
  amp: number;
  life: number;
  squash: number;
  tint: RGB;
}

export class Framebuffer {
  W: number;
  H: number;
  buf: Float32Array; // HDR linear
  bg: Float32Array; // static arena layer
  base: Float32Array; // world-before-spell (to isolate spell light)
  trail: Float32Array; // persistence of spell light
  post: Float32Array;
  tmpA: Float32Array;
  bw: number;
  bh: number;
  bloomA: Float32Array;
  bloomB: Float32Array;
  out: ImageData;
  exposure = 1;
  flash: [number, number, number] = [0, 0, 0];
  bloomAmt = 0.75;
  levels = 26;
  warp: ((x: number, y: number) => [number, number, number]) | null = null;
  shear = 0;
  // post params (set by the Lab from the World each frame)
  cam = { x: 0, y: 0, zoom: 1, rot: 0 };
  waves: PostWave[] = [];
  chroma = 0;
  impactFrames = 0;
  impactTint: RGB = [1, 1, 1];

  constructor(W: number, H: number) {
    this.W = W;
    this.H = H;
    const n = W * H * 3;
    this.buf = new Float32Array(n);
    this.bg = new Float32Array(n);
    this.base = new Float32Array(n);
    this.trail = new Float32Array(n);
    this.post = new Float32Array(n);
    this.tmpA = new Float32Array(n);
    this.bw = W >> 2;
    this.bh = H >> 2;
    this.bloomA = new Float32Array(this.bw * this.bh * 3);
    this.bloomB = new Float32Array(this.bw * this.bh * 3);
    this.out = new ImageData(W, H);
  }

  clear() {
    this.buf.fill(0);
    this.exposure = 1;
    this.flash[0] = this.flash[1] = this.flash[2] = 0;
    this.bloomAmt = 0.75;
    this.warp = null;
    this.shear = 0;
  }

  idx(x: number, y: number) {
    return (y * this.W + x) * 3;
  }

  /** sub-pixel additive splat (bilinear). Integer coords hit one pixel exactly. */
  add(x: number, y: number, r: number, g: number, b: number, a = 1) {
    const x0 = Math.floor(x),
      y0 = Math.floor(y);
    const fx = x - x0,
      fy = y - y0;
    const W = this.W,
      H = this.H,
      buf = this.buf;
    if (fx < 0.02 && fy < 0.02) {
      if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
      const i = (y0 * W + x0) * 3;
      buf[i] += r * a;
      buf[i + 1] += g * a;
      buf[i + 2] += b * a;
      return;
    }
    const w00 = (1 - fx) * (1 - fy) * a,
      w10 = fx * (1 - fy) * a,
      w01 = (1 - fx) * fy * a,
      w11 = fx * fy * a;
    if (x0 >= 0 && y0 >= 0 && x0 < W && y0 < H) {
      const i = (y0 * W + x0) * 3;
      buf[i] += r * w00;
      buf[i + 1] += g * w00;
      buf[i + 2] += b * w00;
    }
    if (x0 + 1 >= 0 && y0 >= 0 && x0 + 1 < W && y0 < H) {
      const i = (y0 * W + x0 + 1) * 3;
      buf[i] += r * w10;
      buf[i + 1] += g * w10;
      buf[i + 2] += b * w10;
    }
    if (x0 >= 0 && y0 + 1 >= 0 && x0 < W && y0 + 1 < H) {
      const i = ((y0 + 1) * W + x0) * 3;
      buf[i] += r * w01;
      buf[i + 1] += g * w01;
      buf[i + 2] += b * w01;
    }
    if (x0 + 1 >= 0 && y0 + 1 >= 0 && x0 + 1 < W && y0 + 1 < H) {
      const i = ((y0 + 1) * W + x0 + 1) * 3;
      buf[i] += r * w11;
      buf[i + 1] += g * w11;
      buf[i + 2] += b * w11;
    }
  }

  /** crisp single-pixel write */
  addPx(x: number, y: number, r: number, g: number, b: number, a = 1) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const i = (y * this.W + x) * 3;
    this.buf[i] += r * a;
    this.buf[i + 1] += g * a;
    this.buf[i + 2] += b * a;
  }

  blend(x: number, y: number, r: number, g: number, b: number, a: number) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.W || y >= this.H || a <= 0) return;
    if (a > 1) a = 1;
    const i = (y * this.W + x) * 3;
    this.buf[i] += (r - this.buf[i]) * a;
    this.buf[i + 1] += (g - this.buf[i + 1]) * a;
    this.buf[i + 2] += (b - this.buf[i + 2]) * a;
  }

  mul(x: number, y: number, m: number) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const i = (y * this.W + x) * 3;
    this.buf[i] *= m;
    this.buf[i + 1] *= m;
    this.buf[i + 2] *= m;
  }

  get(x: number, y: number, o: [number, number, number]) {
    x = clamp(x | 0, 0, this.W - 1);
    y = clamp(y | 0, 0, this.H - 1);
    const i = (y * this.W + x) * 3;
    o[0] = this.buf[i];
    o[1] = this.buf[i + 1];
    o[2] = this.buf[i + 2];
    return o;
  }

  drawBackground(warp?: (x: number, y: number) => [number, number, number] | null) {
    const { W, H, bg, buf } = this;
    if (!warp) {
      buf.set(bg);
      return;
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const w = warp(x, y);
        const o = (y * W + x) * 3;
        if (!w) {
          buf[o] = 0;
          buf[o + 1] = 0;
          buf[o + 2] = 0;
          continue;
        }
        let sx = w[0] | 0,
          sy = w[1] | 0;
        const m = w[2];
        if (sx < 0) sx = 0;
        else if (sx >= W) sx = W - 1;
        if (sy < 0) sy = 0;
        else if (sy >= H) sy = H - 1;
        const i = (sy * W + sx) * 3;
        buf[o] = bg[i] * m;
        buf[o + 1] = bg[i + 1] * m;
        buf[o + 2] = bg[i + 2] * m;
      }
    }
  }

  scaleAll(m: number) {
    const b = this.buf;
    for (let i = 0; i < b.length; i++) b[i] *= m;
  }

  markBase() {
    this.base.set(this.buf);
  }

  /** persistence: spell light leaves a decaying afterimage (doctrine 3.4) */
  applyTrail(persist: number, decay: number, advance: boolean) {
    const { buf, base, trail } = this;
    for (let i = 0; i < buf.length; i++) {
      const fx = buf[i] - base[i];
      const tr = trail[i];
      buf[i] += tr * persist;
      if (advance) {
        const d = tr * decay;
        trail[i] = fx > d ? fx : d;
      }
    }
  }

  resetTrail() {
    this.trail.fill(0);
  }

  snapshot(dst: Float32Array) {
    dst.set(this.buf);
  }

  // ---- post -------------------------------------------------------------
  /** camera transform + refraction + chromatic aberration, bilinear on HDR */
  private resample(): Float32Array {
    const { W, H, buf, post } = this;
    const cx = W / 2,
      cy = H / 2;
    const iz = 1 / this.cam.zoom;
    const cr = Math.cos(-this.cam.rot),
      sr = Math.sin(-this.cam.rot);
    const camX = this.cam.x,
      camY = this.cam.y;
    const ca = this.chroma;
    const waves = this.waves;
    const nw = waves.length;
    const wr: number[] = [];
    for (const w of waves) wr.push((w.speed * (1 - Math.exp(-w.age * 3))) / 3);

    const sample = (sx: number, sy: number, c: number) => {
      if (sx < 0) sx = 0;
      else if (sx > W - 1.001) sx = W - 1.001;
      if (sy < 0) sy = 0;
      else if (sy > H - 1.001) sy = H - 1.001;
      const x0 = sx | 0,
        y0 = sy | 0;
      const fx = sx - x0,
        fy = sy - y0;
      const i = (y0 * W + x0) * 3 + c;
      const a = buf[i],
        b = buf[i + 3],
        d = buf[i + W * 3],
        e = buf[i + W * 3 + 3];
      return (a + (b - a) * fx) * (1 - fy) + (d + (e - d) * fx) * fy;
    };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5 - cx) * iz,
          v = (y + 0.5 - cy) * iz;
        let sx = u * cr - v * sr + cx - camX - 0.5;
        let sy = u * sr + v * cr + cy - camY - 0.5;
        let lr = 0,
          lg = 0,
          lb = 0;
        for (let k = 0; k < nw; k++) {
          const w = waves[k];
          const dx = sx - w.x,
            dy = (sy - w.y) * w.squash;
          const d = Math.sqrt(dx * dx + dy * dy) + 1e-4;
          const q = (d - wr[k]) / w.width;
          if (q > 2.6 || q < -2.6) continue;
          const env = 1 - w.age / w.life;
          const prof = q * Math.exp(-q * q * 1.6);
          const off = -prof * w.amp * env * env;
          sx += (dx / d) * off;
          sy += ((dy / d) * off) / w.squash;
          const brk = 0.35 + 0.65 * vnoise(dx * 0.07 + k * 9, dy * 0.07);
          const li = Math.exp(-q * q * 3) * env * 0.05 * brk * (w.amp / 4);
          lr += w.tint[0] * li;
          lg += w.tint[1] * li;
          lb += w.tint[2] * li;
        }
        const o = (y * W + x) * 3;
        if (ca > 0.12) {
          let dx = x - cx,
            dy = y - cy;
          const dl = Math.sqrt(dx * dx + dy * dy) + 1e-4;
          const k = (ca * dl) / (cx * 1.2);
          dx = (dx / dl) * k;
          dy = (dy / dl) * k;
          post[o] = sample(sx + dx, sy + dy, 0) + lr;
          post[o + 1] = sample(sx, sy, 1) + lg;
          post[o + 2] = sample(sx - dx, sy - dy, 2) + lb;
        } else {
          post[o] = sample(sx, sy, 0) + lr;
          post[o + 1] = sample(sx, sy, 1) + lg;
          post[o + 2] = sample(sx, sy, 2) + lb;
        }
      }
    }
    return post;
  }

  present(ctx: CanvasRenderingContext2D) {
    const { W, H, bw, bh, bloomA, bloomB } = this;
    const idle =
      Math.abs(this.cam.x) < 0.01 &&
      Math.abs(this.cam.y) < 0.01 &&
      Math.abs(this.cam.zoom - 1) < 0.0005 &&
      Math.abs(this.cam.rot) < 0.0002 &&
      this.waves.length === 0 &&
      this.chroma <= 0.12;
    const buf = idle ? this.buf : this.resample();

    bloomA.fill(0);
    for (let y = 0; y < H; y++) {
      const by = (y >> 2) * bw;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        const o = (by + (x >> 2)) * 3;
        const l = buf[i] * 0.3 + buf[i + 1] * 0.55 + buf[i + 2] * 0.15;
        if (l > 0.65) {
          const k = ((l - 0.65) / (l + 1e-5)) * 0.0625;
          bloomA[o] += buf[i] * k;
          bloomA[o + 1] += buf[i + 1] * k;
          bloomA[o + 2] += buf[i + 2] * k;
        }
      }
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const o = (y * bw + x) * 3;
          for (let c = 0; c < 3; c++) {
            let s = 0;
            for (let k = -3; k <= 3; k++) {
              const xx = clamp(x + k, 0, bw - 1) | 0;
              s += bloomA[(y * bw + xx) * 3 + c] * W_K[k + 3];
            }
            bloomB[o + c] = s;
          }
        }
      }
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const o = (y * bw + x) * 3;
          for (let c = 0; c < 3; c++) {
            let s = 0;
            for (let k = -3; k <= 3; k++) {
              const yy = clamp(y + k, 0, bh - 1) | 0;
              s += bloomB[(yy * bw + x) * 3 + c] * W_K[k + 3];
            }
            bloomA[o + c] = s;
          }
        }
      }
    }

    const data = this.out.data;
    const q = this.levels - 1;
    let ex = this.exposure;
    const imf = this.impactFrames;
    if (imf === 1) ex *= 1.4;
    const fr = this.flash[0],
      fg = this.flash[1],
      fb2 = this.flash[2];
    const bAmt = this.bloomAmt;
    const cx = W * 0.5,
      cy = H * 0.5;
    const invR = 1 / Math.hypot(cx, cy);
    const it = this.impactTint;
    const itm = Math.max(it[0], it[1], it[2]) || 1;
    const tr = it[0] / itm,
      tg = it[1] / itm,
      tb = it[2] / itm;

    for (let y = 0; y < H; y++) {
      let byf = (y + 0.5) * 0.25 - 0.5;
      if (byf < 0) byf = 0;
      else if (byf > bh - 1.001) byf = bh - 1.001;
      const by0 = byf | 0,
        by1 = Math.min(bh - 1, by0 + 1),
        bfy = byf - by0;
      const bayerRow = BAYER8[y & 7];
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        // bilinear bloom upsample (nearest produced visible 4x4 blocks)
        let bx = (x + 0.5) * 0.25 - 0.5;
        if (bx < 0) bx = 0;
        else if (bx > bw - 1.001) bx = bw - 1.001;
        const bx0 = bx | 0,
          bfx = bx - bx0;
        const i00 = (by0 * bw + bx0) * 3,
          i01 = (by1 * bw + bx0) * 3;
        const w00 = (1 - bfx) * (1 - bfy),
          w10 = bfx * (1 - bfy),
          w01 = (1 - bfx) * bfy,
          w11 = bfx * bfy;
        const br = bloomA[i00] * w00 + bloomA[i00 + 3] * w10 + bloomA[i01] * w01 + bloomA[i01 + 3] * w11;
        const bg2 = bloomA[i00 + 1] * w00 + bloomA[i00 + 4] * w10 + bloomA[i01 + 1] * w01 + bloomA[i01 + 4] * w11;
        const bb = bloomA[i00 + 2] * w00 + bloomA[i00 + 5] * w10 + bloomA[i01 + 2] * w01 + bloomA[i01 + 5] * w11;
        let r = (buf[i] + br * bAmt + fr) * ex;
        let g = (buf[i + 1] + bg2 * bAmt + fg) * ex;
        let b = (buf[i + 2] + bb * bAmt + fb2) * ex;
        const d = Math.hypot(x - cx, y - cy) * invR;
        const vig = 1 - 0.38 * d * d;
        r = tm(r * vig);
        g = tm(g * vig);
        b = tm(b * vig);
        if (imf >= 2) {
          const l = r * 0.3 + g * 0.55 + b * 0.15;
          if (imf === 3) {
            // burn-white: silhouettes against blown-out light
            const v = l > 0.2 ? 1 : 0;
            r = v;
            g = v * 0.97;
            b = v * 0.93;
          } else {
            // tinted negative
            if (l > 0.2) {
              r = 0.02;
              g = 0.015;
              b = 0.03;
            } else {
              r = 0.35 + 0.65 * tr;
              g = 0.35 + 0.65 * tg;
              b = 0.35 + 0.65 * tb;
            }
          }
        }
        const dth = ((bayerRow[x & 7] / 64 - 0.5) * 0.8) / q;
        const o = (y * W + x) << 2;
        data[o] = (((clamp(r + dth) * q + 0.5) | 0) / q) * 255;
        data[o + 1] = (((clamp(g + dth) * q + 0.5) | 0) / q) * 255;
        data[o + 2] = (((clamp(b + dth) * q + 0.5) | 0) / q) * 255;
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(this.out, 0, 0);
  }
}

const W_K = [0.0702, 0.1311, 0.1907, 0.216, 0.1907, 0.1311, 0.0702];

function tm(x: number) {
  if (x <= 0) return 0;
  const a = 2.51,
    b = 0.03,
    c = 2.43,
    d = 0.59,
    e = 0.14;
  const v = (x * (a * x + b)) / (x * (c * x + d) + e);
  return v > 1 ? 1 : Math.pow(v, 1 / 1.42);
}
