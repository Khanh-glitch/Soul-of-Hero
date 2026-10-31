// The Frame: a low-resolution software raster with four layers that the GPU compositor fuses.
//  ground : RGBA8, the floor + decals. Sampled THROUGH the displacement field (so it can be bent, torn, lensed).
//  ink    : premultiplied RGBA float, opaque / translucent pixel art drawn over the ground (not displaced).
//  light  : HDR additive RGB. May be NEGATIVE: spells can literally subtract light from the world.
//  disp   : (dx, dy, shade, chroma) per pixel. dx/dy displace ground sampling, shade multiplies ground.
import { bayer, clamp, type V2 } from './math';
import type { RGB } from './palette';

export const W = 384;
export const H = 216;
const N = W * H;

export class Frame {
  base = new Uint8ClampedArray(N * 4);
  ground = new Uint8ClampedArray(N * 4);
  ink = new Float32Array(N * 4);
  light = new Float32Array(N * 4);
  disp = new Float32Array(N * 4);
  private mark = new Uint32Array(N);
  private gen = 1;
  t = 0;

  clear() {
    this.ground.set(this.base);
    this.ink.fill(0);
    this.light.fill(0);
    const d = this.disp;
    for (let i = 0; i < N * 4; i += 4) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 1; d[i + 3] = 0; }
  }

  // ---------- single pixel ops ----------
  L(x: number, y: number, r: number, g: number, b: number) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4, l = this.light;
    l[i] += r; l[i + 1] += g; l[i + 2] += b;
  }
  Lc(x: number, y: number, c: RGB, k = 1) { this.L(x, y, c[0] * k, c[1] * k, c[2] * k); }
  /** ink over (straight colour, alpha) */
  I(x: number, y: number, r: number, g: number, b: number, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    if (a > 1) a = 1;
    const i = (y * W + x) * 4, k = this.ink, ia = 1 - a;
    k[i] = r * a + k[i] * ia; k[i + 1] = g * a + k[i + 1] * ia; k[i + 2] = b * a + k[i + 2] * ia; k[i + 3] = a + k[i + 3] * ia;
  }
  Ic(x: number, y: number, c: RGB, a = 1) { this.I(x, y, c[0], c[1], c[2], a); }
  /** dithered ink: alpha becomes a bayer coverage pattern (hard pixels, no blending) */
  Id(x: number, y: number, c: RGB, a: number) { if (a > bayer(x | 0, y | 0)) this.I(x, y, c[0], c[1], c[2], 1); }
  G(x: number, y: number, r: number, g: number, b: number, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4, gr = this.ground, ia = 1 - a;
    gr[i] = gr[i] * ia + r * 255 * a; gr[i + 1] = gr[i + 1] * ia + g * 255 * a; gr[i + 2] = gr[i + 2] * ia + b * 255 * a;
  }
  Gc(x: number, y: number, c: RGB, a = 1) { this.G(x, y, c[0], c[1], c[2], a); }
  D(x: number, y: number, dx: number, dy: number) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4; this.disp[i] += dx; this.disp[i + 1] += dy;
  }
  S(x: number, y: number, m: number) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.disp[(y * W + x) * 4 + 2] *= m;
  }
  C(x: number, y: number, v: number) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.disp[(y * W + x) * 4 + 3] += v;
  }
  baseAt(x: number, y: number): RGB {
    x = clamp(x | 0, 0, W - 1); y = clamp(y | 0, 0, H - 1);
    const i = (y * W + x) * 4;
    return [this.base[i] / 255, this.base[i + 1] / 255, this.base[i + 2] / 255];
  }

  // ---------- iteration helpers ----------
  field(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void) {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y);
  }
  line(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, s: number) => void) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, n = Math.max(dx, -dy), k = 0;
    if (n > 2000) return;
    for (;;) {
      fn(x0, y0, n ? k / n : 0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
      k++;
    }
  }
  lineL(x0: number, y0: number, x1: number, y1: number, c: RGB, k = 1) {
    this.line(x0, y0, x1, y1, (x, y) => this.L(x, y, c[0] * k, c[1] * k, c[2] * k));
  }
  lineI(x0: number, y0: number, x1: number, y1: number, c: RGB, a = 1) {
    this.line(x0, y0, x1, y1, (x, y) => this.I(x, y, c[0], c[1], c[2], a));
  }
  polylineL(pts: V2[], c: RGB, k = 1) {
    for (let i = 0; i < pts.length - 1; i++) this.lineL(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, c, k);
  }
  /** filled disc; fn receives normalized radius 0..1 */
  disc(cx: number, cy: number, r: number, fn: (x: number, y: number, d: number) => void, sy = 1) {
    if (r <= 0) return;
    const ry = r * sy;
    this.field(cx - r - 1, cy - ry - 1, cx + r + 1, cy + ry + 1, (x, y) => {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d <= 1) fn(x, y, Math.sqrt(d));
    });
  }
  discL(cx: number, cy: number, r: number, c: RGB, k = 1, sy = 1) {
    if (r < 0.7) { this.L(cx, cy, c[0] * k, c[1] * k, c[2] * k); return; }
    this.disc(cx, cy, r, (x, y) => this.L(x, y, c[0] * k, c[1] * k, c[2] * k), sy);
  }
  discI(cx: number, cy: number, r: number, c: RGB, a = 1, sy = 1) {
    if (r < 0.7) { this.I(cx, cy, c[0], c[1], c[2], a); return; }
    this.disc(cx, cy, r, (x, y) => this.I(x, y, c[0], c[1], c[2], a), sy);
  }
  /** pixel-perfect ring (1px) */
  ring(cx: number, cy: number, r: number, fn: (x: number, y: number, a: number) => void, sy = 1) {
    if (r < 0.5) { fn(Math.floor(cx), Math.floor(cy), 0); return; }
    const n = Math.max(8, Math.ceil(r * 7));
    let lx = -9999, ly = -9999;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.floor(cx + Math.cos(a) * r), y = Math.floor(cy + Math.sin(a) * r * sy);
      if (x === lx && y === ly) continue;
      lx = x; ly = y; fn(x, y, a);
    }
  }
  ringL(cx: number, cy: number, r: number, c: RGB, k = 1, sy = 1) {
    this.ring(cx, cy, r, (x, y) => this.L(x, y, c[0] * k, c[1] * k, c[2] * k), sy);
  }
  /** banded radial glow - quantized falloff gives pixel-art light pools */
  glow(cx: number, cy: number, r: number, c: RGB, k = 1, bands = 4, sy = 1) {
    if (r <= 0 || k === 0) return;
    this.disc(cx, cy, r, (x, y, d) => {
      const f = Math.ceil((1 - d) * bands) / bands;
      const v = f * f * k;
      this.L(x, y, c[0] * v, c[1] * v, c[2] * v);
    }, sy);
  }
  shadeDisc(cx: number, cy: number, r: number, m: number, sy = 1, bands = 3) {
    this.disc(cx, cy, r, (x, y, d) => {
      const f = Math.ceil((1 - d) * bands) / bands;
      this.S(x, y, 1 - (1 - m) * f);
    }, sy);
  }
  /** scanline polygon fill */
  poly(pts: V2[], fn: (x: number, y: number) => void) {
    if (pts.length < 3) return;
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.ceil(maxY));
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if ((a.y <= sy && b.y > sy) || (b.y <= sy && a.y > sy)) xs.push(a.x + ((sy - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.round(xs[k])), xb = Math.min(W - 1, Math.round(xs[k + 1]) - 1);
        for (let x = xa; x <= xb; x++) fn(x, y);
      }
    }
  }
  polyL(pts: V2[], c: RGB, k = 1) { this.poly(pts, (x, y) => this.L(x, y, c[0] * k, c[1] * k, c[2] * k)); }
  polyI(pts: V2[], c: RGB, a = 1) { this.poly(pts, (x, y) => this.I(x, y, c[0], c[1], c[2], a)); }
  polyOutlineL(pts: V2[], c: RGB, k = 1) {
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; this.lineL(a.x, a.y, b.x, b.y, c, k); }
  }
  /**
   * Capsule-ribbon raster. Each pixel is visited once per call (coverage mask),
   * fn gets s = arc position (0..1) and e = signed cross-section (-1..1).
   */
  ribbon(pts: V2[], widths: number[] | number, fn: (x: number, y: number, s: number, e: number) => void) {
    if (pts.length < 2) return;
    const g = ++this.gen, mark = this.mark;
    const n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[i + 1];
      const wa = typeof widths === 'number' ? widths : widths[i], wb = typeof widths === 'number' ? widths : widths[i + 1];
      if (wa <= 0 && wb <= 0) continue;
      const mw = Math.max(wa, wb) + 1;
      const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - mw)), x1 = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x) + mw));
      const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - mw)), y1 = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y) + mw));
      const dx = b.x - a.x, dy = b.y - a.y, ll = dx * dx + dy * dy || 1e-6;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const idx = y * W + x;
        if (mark[idx] === g) continue;
        const px = x + 0.5 - a.x, py = y + 0.5 - a.y;
        let u = (px * dx + py * dy) / ll; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const qx = px - dx * u, qy = py - dy * u;
        const d = Math.sqrt(qx * qx + qy * qy), w = wa + (wb - wa) * u;
        if (d <= w + 0.001 && w > 0.25) {
          mark[idx] = g;
          const side = dx * py - dy * px >= 0 ? 1 : -1;
          fn(x, y, (i + u) / n, (d / Math.max(w, 0.5)) * side);
        }
      }
    }
  }
  /** copy a block of the pristine floor into ink (used for world-fragments flying around) */
  blitBase(sx: number, sy: number, w: number, h: number, dx: number, dy: number, a = 1, tint?: (c: RGB) => RGB) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = this.baseAt(sx + x, sy + y);
      if (tint) c = tint(c);
      this.I(dx + x, dy + y, c[0], c[1], c[2], a);
    }
  }
}
