// Authored pixel-cluster primitives. These exist to replace geometric primitives (filled discs,
// rectangles, concentric rings) that read as "shapes" rather than drawn pixel art. Everything is
// palette-indexed, integer rasterised, seeded and cached by the callers in vfx.ts.
import { Raster, hash2 } from './raster';
import { R } from './kit';

/** Irregular lobe: polygon with a jagged seeded contour. The unit of smoke, dust and cloud mass. */
export function lobe(r: Raster, cx: number, cy: number, rx: number, ry: number, c: number, seed: number, jag = 0.42, n = 11) {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + hash2(i, seed, 1) * 0.35;
    const k = 1 - jag * 0.5 + hash2(i, seed, 2) * jag;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  r.poly(pts, c);
}
/**
 * Billowing cluster: 3–5 overlapping lobes sharing one silhouette, lit on top, dark underneath,
 * with interior holes that open as `age` grows. Holes are clustered (seeded by coarse cell), never
 * salt-and-pepper noise.
 */
export function cluster(r: Raster, cx: number, cy: number, rad: number, hot: number, dark: number, lit: number, seed: number, age = 0, lobes = 4) {
  const cells = new Set<number>();
  for (let l = 0; l < lobes; l++) {
    const a = hash2(l, seed, 3) * 6.283, d = rad * (0.25 + hash2(l, seed, 4) * 0.5);
    const lx = cx + Math.cos(a) * d, ly = cy + Math.sin(a) * d * 0.62 - age * rad * 0.16;
    const rr = rad * (0.45 + hash2(l, seed, 5) * 0.4) * (1 - age * 0.3);
    if (rr < 0.8) continue;
    const m = new Raster(r.w, r.h); lobe(m, lx, ly, rr, rr * 0.82, 1, seed + l * 17, 0.5, 9);
    const x0 = Math.max(0, Math.floor(lx - rr * 1.6)), x1 = Math.min(r.w - 1, Math.ceil(lx + rr * 1.6));
    const y0 = Math.max(0, Math.floor(ly - rr * 1.8)), y1 = Math.min(r.h - 1, Math.ceil(ly + rr * 1.8));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!m.get(x, y)) continue;
      if (age > 0.22) { const cell = ((x >> 2) * 73 + (y >> 2) * 131 + seed * 7) | 0; const d2 = Math.hypot(x - lx, y - ly) / rr; if (hash2(cell & 63, seed, 9) < age * 0.5 * d2 && !cells.has(cell)) cells.add(cell); if (cells.has(cell)) continue; }
      const up = !m.get(x, y - 1) && y < ly, dn = !m.get(x, y + 1) && y > ly;
      r.set(x, y, up ? lit : dn ? dark : hot);
    }
  }
}
/** Asymmetric impact star: 7–9 rays of unequal length, hard white core, broken fringe. */
export function impactStar(r: Raster, cx: number, cy: number, rad: number, hot: number, mid: number, seed: number) {
  const n = 7 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + hash2(i, seed, 1) * 0.3, L = rad * (0.5 + hash2(i, seed, 2) * 0.65);
    for (let d = rad * 0.12; d < L; d += 0.85) {
      const u = d / L, w = Math.max(0.6, (1 - u) * rad * 0.13), c = u < 0.32 ? R.k[1] : u < 0.62 ? hot : mid;
      for (let j = -w; j <= w; j += 0.8) r.set(cx + Math.cos(a) * d - Math.sin(a) * j, cy + Math.sin(a) * d + Math.cos(a) * j, c);
    }
  }
  lobe(r, cx, cy, rad * 0.3, rad * 0.24, R.k[1], seed + 4, 0.5, 9);
  lobe(r, cx, cy, rad * 0.19, rad * 0.15, hot, seed + 8, 0.5, 9);
}
/** Jagged mass: irregular filled blob with a bitten edge and interior notches. Not a disc. */
export function jagMass(r: Raster, cx: number, cy: number, rad: number, fill: number, edge: number, seed: number, bite = 0.28) {
  const n = 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283, k = 1 - bite * 0.5 + hash2(i, seed, 1) * bite;
    const rr = rad * k;
    for (let d = 0; d < rr; d += 0.8) r.set(cx + Math.cos(a) * d, cy + Math.sin(a) * d, d > rr - 1.6 ? edge : fill);
  }
  // interior notches so the mass never reads as a smooth filled circle
  for (let i = 0; i < 5; i++) { const a = hash2(i, seed, 3) * 6.283, d = rad * (0.3 + hash2(i, seed, 4) * 0.4); lobe(r, cx + Math.cos(a) * d, cy + Math.sin(a) * d, rad * 0.16, rad * 0.13, 0, seed + i * 5, 0.6, 7); }
}
/** Flat ground ellipse that is NOT a wireframe: banded fill, dust lobes on the far rim, hot lip. */
export function groundEllipse(r: Raster, cx: number, cy: number, rx: number, ry: number, rp: number[], dark: number, lit: number, seed: number, fr: number) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry); if (d > 1) continue;
    const band = Math.floor((d + hash2(x, y, seed) * 0.12) * 4);
    if (fr >= 2 && hash2(x >> 1, y >> 1, seed + fr) < (fr - 1) * 0.22 * d) continue; // erode from the outside
    r.set(x, y, band <= 0 ? rp[2] : band === 1 ? dark : band === 2 ? dark : lit);
  }
  for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283 + hash2(i, seed, 5) * 0.4; cluster(r, cx + Math.cos(a) * rx * 0.92, cy + Math.sin(a) * ry * 0.92, rx * 0.13, lit, dark, rp[3], seed + i * 3, 0.15 + fr * 0.2, 2); }
}
