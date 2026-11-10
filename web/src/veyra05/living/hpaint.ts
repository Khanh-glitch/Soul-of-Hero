/**
 * VEYRA Living Art — height-field pixel painter.
 *
 * Every upgraded asset is authored as primitives that carry real HEIGHT and a MATERIAL,
 * then shaded once with the world's single key light (upper-left sun), hue-shifted ramps,
 * 4x4 ordered dither on ramp boundaries and selective (coloured, not black) outlines.
 * This is the same idea as Laigter / Sprite Illuminator normal generation, but baked at
 * author time so every new sprite shares one lighting language with the terrain.
 */
import { mk, type Sprite } from '../../game/art';

export type Ramp = string[]; // dark -> light, 5..7 tones, hue shifted
const hex = (c: string) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** Hue-shifted ramps: shadows drift toward violet/teal, lights toward warm yellow. */
export const MAT: Record<string, Ramp> = {
  bark: ['#1d1214', '#33201c', '#4e3125', '#6c462f', '#8c623d', '#ad8452'],
  heartwood: ['#170f17', '#2c1a22', '#4a2b2b', '#6e4231', '#95613b', '#c08a4c', '#e2b86a'],
  leaf: ['#0e1e1c', '#16332a', '#1f4a2e', '#2e6633', '#4a8738', '#78a943', '#b4cc5c'],
  pineleaf: ['#0b1a1e', '#11292b', '#173c33', '#22543a', '#347042', '#5a8c4c'],
  moss: ['#152218', '#22381f', '#355326', '#527230', '#7a933d'],
  stone: ['#16141e', '#2a2731', '#3f3c45', '#59565c', '#77736f', '#9b958a', '#c4bba8'],
  basalt: ['#0c0a10', '#17141b', '#221e25', '#302a30', '#433a3d', '#5d5050'],
  ice: ['#14243e', '#1f3d63', '#2f6290', '#4c8fba', '#7dbfdc', '#b6e4f0', '#effcff'],
  snow: ['#4c5b7e', '#6f82a6', '#98abc8', '#c3d2e4', '#e6eef6', '#ffffff'],
  sandstone: ['#2a1a1c', '#4b2f27', '#73492f', '#9c6c3f', '#c39558', '#e1bd7c', '#f4dfa6'],
  marble: ['#141c2a', '#26344a', '#3e5068', '#5e7488', '#8aa0ac', '#bccbcc', '#eaf0e6'],
  brass: ['#1e130e', '#3e2614', '#6a431b', '#9a6a24', '#c8992f', '#ecc957', '#fff1a0'],
  iron: ['#0f1016', '#1c1e27', '#2c2f3a', '#41464f', '#5d6469', '#868d8c'],
  slate: ['#121521', '#1f2433', '#2f3647', '#414b5d', '#5a6577', '#7c8798'],
  bone: ['#2a2228', '#4a3e3e', '#76675c', '#a6967f', '#d2c4a6', '#f1e8cf'],
  obsidian: ['#08060d', '#120e1a', '#1e1830', '#2c2547', '#453b6a', '#6b5f96'],
  crystal: ['#101a3a', '#1c3266', '#2a5596', '#3f86c4', '#6ec3e6', '#bff0ff', '#ffffff'],
  jade: ['#0b1a19', '#123029', '#1c4b3a', '#2a6a4c', '#3f8c5c', '#69b277', '#a8daa0'],
  lavarock: ['#0e080a', '#1d1012', '#2e1814', '#432217', '#5c2d18'],
  cloth: ['#1c0e1e', '#36163a', '#561f58', '#7b2f74', '#a3468c', '#c96ea6'],
  book: ['#1a0e10', '#3a1a1a', '#5e2a22', '#84432c', '#a86a3c'],
};
export const EMISSIVE: Record<string, string[]> = {
  lava: ['#5a1208', '#a8260c', '#e2531a', '#ff8c2a', '#ffc35a', '#fff0b0'],
  sap: ['#173a2a', '#2a7a4c', '#57c27a', '#a8f0a0', '#efffd8'],
  rune: ['#13304a', '#1f6a94', '#3fb0d8', '#9ae8f6', '#f0ffff'],
  gold: ['#4a2a10', '#9a6418', '#e0a830', '#ffe07a', '#fff8d0'],
  void: ['#1a0f3a', '#3a228a', '#6a4ad8', '#a890ff', '#efe6ff'],
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
export function h2(x: number, y: number, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vn(x: number, y: number, s = 0) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm2(x: number, y: number, s = 0, o = 3) { let f = 0, a = 0.5, n = 0, fr = 1; for (let i = 0; i < o; i++) { f += vn(x * fr, y * fr, s + i * 31) * a; n += a; a *= 0.5; fr *= 2; } return f / n; }

/** Detail callback: returns brightness offset (-1..1) and optional emissive override. */
export type Detail = (x: number, y: number, z: number, nx: number, ny: number) => { d?: number; emit?: [string, number]; mat?: string } | void;

export class HField {
  w: number; h: number; z: Float32Array; m: Int16Array; det: (Detail | null)[] = []; mats: string[] = []; emitA: Float32Array; emitK: Int16Array;
  constructor(w: number, h: number) { this.w = w; this.h = h; this.z = new Float32Array(w * h).fill(-1); this.m = new Int16Array(w * h).fill(-1); this.emitA = new Float32Array(w * h); this.emitK = new Int16Array(w * h).fill(-1); }
  private mid(mat: string, det?: Detail) { this.mats.push(mat); this.det.push(det || null); return this.mats.length - 1; }
  put(x: number, y: number, z: number, id: number, over = false) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x; if (over || z >= this.z[i]) { this.z[i] = z; this.m[i] = id; } }
  /** Axis box seen in 3/4 view: a top face (flat, height top) and a front face (vertical) of depth `fh`. */
  box(x: number, y: number, w: number, top: number, fh: number, z: number, mat: string, det?: Detail, bevel = 1) {
    const id = this.mid(mat, det);
    for (let yy = 0; yy < top; yy++) for (let xx = 0; xx < w; xx++) { const e = Math.min(xx, w - 1 - xx, yy); this.put(x + xx, y + yy, z + Math.min(e, bevel) * 1.6, id, true); }
    for (let yy = 0; yy < fh; yy++) for (let xx = 0; xx < w; xx++) { const e = Math.min(xx, w - 1 - xx); this.put(x + xx, y + top + yy, z - 4 - yy * 0.02 + Math.min(e, bevel) * 1.2, id, true); this.fronts.add((y + top + yy) * this.w + x + xx); }
  }
  fronts = new Set<number>();
  /** Ellipsoid blob (rocks, foliage clusters, boulders). */
  blob(cx: number, cy: number, rx: number, ry: number, height: number, mat: string, det?: Detail, rough = 0.18, seed = 1) {
    const id = this.mid(mat, det);
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry; const wob = 1 + (vn(x * 0.45, y * 0.45, seed) - 0.5) * rough * 2;
      const d = nx * nx + ny * ny; if (d > wob * wob) continue; const zz = Math.sqrt(Math.max(0, 1 - d / (wob * wob))) * height + (cy - y) * 0.05;
      this.put(x, y, zz + (this.base || 0), id);
    }
  }
  base = 0;
  /** Vertical cylinder / column (trunks, pillars). */
  column(cx: number, y0: number, y1: number, r0: number, r1: number, z: number, mat: string, det?: Detail) {
    const id = this.mid(mat, det);
    for (let y = y0; y <= y1; y++) { const t = (y - y0) / Math.max(1, y1 - y0); const r = r0 + (r1 - r0) * t; for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) { const nx = (x + 0.5 - cx) / r; if (Math.abs(nx) > 1) continue; this.put(x, y, z + Math.sqrt(1 - nx * nx) * r, id); this.colN.set(y * this.w + x, nx); } }
  }
  colN = new Map<number, number>();
  /** Thick curved stroke along points (roots, branches, cables). */
  stroke(pts: [number, number][], r0: number, r1: number, z: number, mat: string, det?: Detail) {
    const id = this.mid(mat, det); const total = pts.length - 1;
    for (let s = 0; s < total; s++) { const [ax, ay] = pts[s], [bx, by] = pts[s + 1]; const L = Math.max(1, Math.hypot(bx - ax, by - ay)); const n = Math.ceil(L * 2);
      for (let k = 0; k <= n; k++) { const t = k / n; const px = ax + (bx - ax) * t, py = ay + (by - ay) * t; const r = r0 + (r1 - r0) * ((s + t) / total);
        for (let y = Math.floor(py - r - 1); y <= py + r + 1; y++) for (let x = Math.floor(px - r - 1); x <= px + r + 1; x++) { const d = Math.hypot(x + 0.5 - px, y + 0.5 - py) / r; if (d > 1) continue; this.put(x, y, z + Math.sqrt(1 - d * d) * r * 1.2, id); } } }
  }
  poly(pts: [number, number][], z0: number, z1: number, mat: string, det?: Detail) {
    const id = this.mid(mat, det); let minY = 1e9, maxY = -1e9; for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.floor(minY); y <= maxY; y++) { const xs: number[] = []; for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + (y + 0.5 - ay) / (by - ay) * (bx - ax)); } xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) { const t = (y - minY) / Math.max(1, maxY - minY); this.put(x, y, z0 + (z1 - z0) * t, id); } }
  }
  glow(x: number, y: number, kind: string, a: number) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x; const k = Object.keys(EMISSIVE).indexOf(kind); if (a > this.emitA[i]) { this.emitA[i] = a; this.emitK[i] = k; } }

  /** Shade into a sprite. Light from upper-left, slightly in front. */
  render(opts: { outline?: boolean; ao?: boolean; light?: [number, number, number] } = {}): Sprite {
    const { w, h } = this; const L = opts.light || [-0.55, -0.62, 0.56]; const ll = Math.hypot(...L); const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
    const keys = Object.keys(EMISSIVE);
    return mk(w, h, g => {
      const img = g.createImageData(w, h); const d = img.data;
      const Z = (x: number, y: number, dz: number) => { if (x < 0 || y < 0 || x >= w || y >= h) return dz - 6; const v = this.z[y * w + x]; return v < 0 ? dz - 6 : v; };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; const id = this.m[i]; if (id < 0) continue; const z = this.z[i];
        let nx = (Z(x - 1, y, z) - Z(x + 1, y, z)) * 0.5, ny = (Z(x, y - 1, z) - Z(x, y + 1, z)) * 0.5; const cn = this.colN.get(i);
        if (cn !== undefined && Math.abs(nx) < 1.5) nx = -cn * 2.2;
        let nz = 1.4; if (this.fronts.has(i)) { ny = Math.max(ny, 0) + 1.1; nz = 0.5; }
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        let lit = -(nx * lx + ny * ly) + nz * lz; // lambert with flipped screen y
        lit = lit * 0.75 + 0.18;
        // ambient occlusion: pixels lower than neighbourhood darker
        if (opts.ao !== false) { let occ = 0; for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2]]) { const zz = Z(x + ox, y + oy, z); if (zz > z + 1.5) occ += Math.min(1, (zz - z) / 6); } lit -= occ * 0.07; }
        const mat = this.mats[id]; let ramp = MAT[mat] || MAT.stone; const det = this.det[id]; let emit: [string, number] | undefined;
        if (det) { const r = det(x, y, z, nx, ny); if (r) { if (r.d) lit += r.d; if (r.emit) emit = r.emit; if (r.mat) ramp = MAT[r.mat] || ramp; } }
        let idx = Math.max(0, Math.min(ramp.length - 1, Math.floor(lit * ramp.length + (bayer(x, y) - 0.5) * 0.55)));
        let col = hex(ramp[idx]);
        const ea = this.emitA[i]; const ek = this.emitK[i];
        if (emit || ea > 0) { const k = emit ? emit[0] : keys[ek]; const a = emit ? emit[1] : ea; const er = EMISSIVE[k]; const ei = Math.max(0, Math.min(er.length - 1, Math.floor(a * er.length + (bayer(x, y) - 0.5) * 0.6))); if (a > 0.08) col = hex(er[ei]); }
        d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
      }
      if (opts.outline !== false) {
        // selective outline: darkest ramp tone of the material, only where silhouette meets air; lit side lighter
        const out = new Uint8ClampedArray(d);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (this.m[i] < 0) continue;
          const air = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= w || yy >= h || this.m[yy * w + xx] < 0;
          if (air(x - 1, y) || air(x + 1, y) || air(x, y - 1) || air(x, y + 1)) { const ramp = MAT[this.mats[this.m[i]]] || MAT.stone; const topLeft = air(x - 1, y) || air(x, y - 1); const c = hex(topLeft && !air(x, y + 1) ? ramp[1] : ramp[0]); if (this.emitA[i] > 0.3) continue; out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; }
          else { const zz = this.z[i]; const below = this.z[(y + 1) * w + x]; if (y + 1 < h && below >= 0 && zz - below > 7) { const ramp = MAT[this.mats[this.m[i]]] || MAT.stone; const c = hex(ramp[0]); out[(i + w) * 4] = c[0]; out[(i + w) * 4 + 1] = c[1]; out[(i + w) * 4 + 2] = c[2]; } } }
        d.set(out);
      }
      g.putImageData(img, 0, 0);
    });
  }
}

/** Generic material detail generators (all deterministic). */
export const D = {
  bark: (s = 0): Detail => (x, y) => { const g = vn(x * 0.9, y * 0.18, s); return { d: (g > 0.62 ? -0.22 : g < 0.25 ? 0.08 : 0) + (h2(x, y, s) > 0.93 ? -0.15 : 0) }; },
  strata: (s = 0, k = 0.5): Detail => (x, y) => { const band = Math.sin((y + vn(x * 0.2, y * 0.1, s) * 6) * k); const crack = Math.abs(vn(x * 0.25, y * 0.25, s + 7) - 0.5) < 0.025; return { d: (band > 0.85 ? 0.1 : band < -0.9 ? -0.12 : 0) + (crack ? -0.35 : 0) + (h2(x, y, s) - 0.5) * 0.08 }; },
  bricks: (bw: number, bh: number, s = 0, worn = 0.2): Detail => (x, y) => { const row = Math.floor(y / bh); const off = (row % 2) * (bw >> 1); const lx = (x + off) % bw, ly = y % bh; const mortar = lx === 0 || ly === 0; const chip = h2(Math.floor((x + off) / bw), row, s) < worn && vn(x * 0.7, y * 0.7, s) > 0.6; return { d: mortar ? -0.3 : chip ? -0.16 : ly === 1 ? 0.07 : (h2(Math.floor((x + off) / bw), row, s + 3) - 0.5) * 0.12 }; },
  facets: (s = 0): Detail => (x, y) => { const v = vn(x * 0.35 + y * 0.12, y * 0.35, s); const e = Math.abs(v - 0.5) < 0.04; return { d: e ? 0.32 : (v - 0.5) * 0.35 }; },
  grain: (s = 0): Detail => (x, y) => { const r = Math.sin((x * 0.3 + Math.sin(y * 0.15 + s) * 3) * 1.3); return { d: r > 0.8 ? -0.12 : r < -0.85 ? 0.08 : 0 }; },
  leaves: (s = 0): Detail => (x, y) => { const v = h2(x >> 1, y >> 1, s); const lf = h2(x, y, s + 5); return { d: (v > 0.8 ? 0.14 : v < 0.18 ? -0.16 : 0) + (lf > 0.94 ? 0.18 : 0) }; },
  noise: (amt = 0.1, s = 0): Detail => (x, y) => ({ d: (h2(x, y, s) - 0.5) * amt }),
};
