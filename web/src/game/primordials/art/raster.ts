// Indexed-palette raster toolkit. Every visible boss/VFX pixel in the lab is produced here
// with integer rasterisation (Bresenham lines, scanline polygon fill, integer disc tests).
// No canvas vector primitives, no blur, no antialiasing. Index 0 = transparent.
export type Pt = [number, number];

export function hash2(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Raster {
  w: number; h: number; d: Uint8Array; bx0 = 1e9; by0 = 1e9; bx1 = -1; by1 = -1;
  constructor(w: number, h: number) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); }
  clearBox() { if (this.bx1 >= 0) for (let y = this.by0; y <= this.by1; y++) this.d.fill(0, y * this.w + this.bx0, y * this.w + this.bx1 + 1); this.bx0 = this.by0 = 1e9; this.bx1 = this.by1 = -1; }
  get(x: number, y: number) { x |= 0; y |= 0; return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x]; }
  set(x: number, y: number, c: number) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c;
    if (c) { if (x < this.bx0) this.bx0 = x; if (x > this.bx1) this.bx1 = x; if (y < this.by0) this.by0 = y; if (y > this.by1) this.by1 = y; }
  }
  /** set only onto existing opaque pixels */
  over(x: number, y: number, c: number) { if (this.get(Math.round(x), Math.round(y))) this.set(x, y, c); }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, n = 0;
    for (;;) {
      this.set(x0, y0, c);
      if ((x0 === x1 && y0 === y1) || n++ > 2000) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  disc(cx: number, cy: number, r: number, c: number) {
    if (r < 0.6) { this.set(cx, cy, c); return; }
    const R = Math.ceil(r), rr = r * r + r * 0.6;
    const ix = Math.round(cx), iy = Math.round(cy);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= rr) this.set(ix + dx, iy + dy, c);
  }
  oval(cx: number, cy: number, rx: number, ry: number, c: number) {
    const ix = Math.round(cx), iy = Math.round(cy), RX = Math.ceil(rx), RY = Math.ceil(ry);
    for (let dy = -RY; dy <= RY; dy++) for (let dx = -RX; dx <= RX; dx++) {
      const v = (dx * dx) / (rx * rx + 0.3) + (dy * dy) / (ry * ry + 0.3);
      if (v <= 1.0) this.set(ix + dx, iy + dy, c);
    }
  }
  /** tapered capsule from r0 to r1 */
  taper(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, c: number) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) { const t = i / n; this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t, c); }
  }
  poly(pts: Pt[], c: number) {
    if (pts.length < 3) return;
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5, xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.set(x, y, c);
    }
  }
  blit(src: Raster, ox: number, oy: number, map?: (c: number) => number) {
    ox = Math.round(ox); oy = Math.round(oy);
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.d[y * src.w + x];
      if (c) this.set(ox + x, oy + y, map ? map(c) : c);
    }
  }
  clone() { const r = new Raster(this.w, this.h); r.d.set(this.d); return r; }
  bbox() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[y * this.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  count() { let n = 0; for (let i = 0; i < this.d.length; i++) if (this.d[i]) n++; return n; }
}

/**
 * Directional ramp shading of a mask (light from top-left). ramp = [deep, dark, mid, light, hi].
 * Produces pixel-cluster volume: lit rim top-left, 1-2px shadow band bottom-right, sparse speculars.
 */
export function volume(dst: Raster, mask: Raster, ramp: number[], band = 1, seed = 0) {
  const m = (x: number, y: number) => mask.get(x, y) !== 0;
  if (mask.bx1 < 0) return;
  for (let y = mask.by0; y <= mask.by1; y++) for (let x = mask.bx0; x <= mask.bx1; x++) {
    if (!mask.d[y * mask.w + x]) continue;
    let c = ramp[2];
    const br = !m(x + 1, y + 1), r = !m(x + 1, y), b = !m(x, y + 1);
    const tl = !m(x - 1, y - 1), l = !m(x - 1, y), t = !m(x, y - 1);
    if (br || r || b) c = (r && b) ? ramp[0] : ramp[1];
    else if (band > 1 && (!m(x + 2, y + 2) || !m(x + 2, y))) c = ramp[1];
    else if (tl || l || t) c = (l && t && ramp[4] !== undefined && hash2(x, y, seed) < 0.55) ? ramp[4] : ramp[3];
    dst.set(x, y, c);
  }
}

/** Outer selective outline: empty pixels touching art get an outline colour chosen by the neighbour. */
export function outline(dst: Raster, base: number, glowMap?: Record<number, number>) {
  const src = dst.clone();
  for (let y = 0; y < dst.h; y++) for (let x = 0; x < dst.w; x++) {
    if (src.d[y * dst.w + x]) continue;
    const n = src.get(x, y - 1) || src.get(x - 1, y) || src.get(x + 1, y) || src.get(x, y + 1);
    if (!n) continue;
    dst.d[y * dst.w + x] = glowMap && glowMap[n] !== undefined ? glowMap[n] : base;
  }
}

/** Remove isolated single pixels (De-Stray idea, Pixelbolt) except emissive whitelist. */
export function destray(dst: Raster, keep: Set<number>) {
  const src = dst.clone();
  for (let y = 0; y < dst.h; y++) for (let x = 0; x < dst.w; x++) {
    const c = src.d[y * dst.w + x];
    if (!c || keep.has(c)) continue;
    if (!src.get(x - 1, y) && !src.get(x + 1, y) && !src.get(x, y - 1) && !src.get(x, y + 1)) dst.d[y * dst.w + x] = 0;
  }
}

export type RGBA = [number, number, number, number];
export function hex(h: string, a = 255): RGBA {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}
export function toRGBA(r: Raster, pal: RGBA[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(r.w * r.h * 4);
  for (let i = 0; i < r.d.length; i++) {
    const c = r.d[i]; if (!c) continue;
    const p = pal[c] || [255, 0, 255, 255];
    out[i * 4] = p[0]; out[i * 4 + 1] = p[1]; out[i * 4 + 2] = p[2]; out[i * 4 + 3] = p[3];
  }
  return out;
}
export function fnv(data: ArrayLike<number>): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) { h ^= data[i]; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
