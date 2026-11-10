/**
 * VEYRA Living Art — redrawn vegetation & rocks (original art, height-field painted).
 * Trees are 32x44 (old 24x32 blobs). Each sprite also records `canopyTop/trunkTop`
 * so the wind system can bend canopies while roots stay planted.
 */
import { type Sprite } from '../../game/art';
import { HField, D, h2, vn } from './hpaint';

export interface TreeArt { spr: Sprite; trunkTop: number; species: string; stiff: number }
export const TREE_W = 32, TREE_H = 44;

function canopy(f: HField, clusters: [number, number, number, number][], mat: string, seed: number, snow = false) {
  // back clusters first (lower z) then front ones; each cluster lit as a sphere with leaf noise and notched rims
  clusters.forEach(([cx, cy, r, z], k) => {
    f.base = z;
    f.blob(cx, cy, r, r * 0.86, r * 0.9, mat, (x, y, zz, nx, ny) => {
      const leaf = h2(x >> 1, (y + (x & 1)) >> 1, seed + k);
      let d = leaf > 0.82 ? 0.16 : leaf < 0.16 ? -0.2 : 0;
      if (ny > 0.45) d -= 0.12; // underside self-shadow
      if (snow && ny < -0.25 && vn(x * 0.5, y * 0.5, seed) > 0.35) return { d: d + 0.2, mat: 'snow' };
      return { d };
    }, 0.32, seed * 7 + k);
  });
  f.base = 0;
}

export function oakArt(v: number, snow = false): TreeArt {
  const f = new HField(TREE_W, TREE_H); const s = v * 13 + 3;
  // roots and trunk with a fork
  f.stroke([[8, 43], [12, 41], [14, 38]], 1.6, 1.2, 1, 'bark', D.bark(s));
  f.stroke([[25, 43], [20, 41], [18, 38]], 1.6, 1.2, 1, 'bark', D.bark(s));
  f.column(16, 22, 42, 2.4, 3.6, 2, 'bark', D.bark(s));
  f.stroke([[16, 28], [11 - v, 21], [8 - v, 17]], 1.6, 1, 3, 'bark', D.bark(s));
  f.stroke([[16, 27], [21 + v, 19], [24, 15]], 1.6, 1, 3, 'bark', D.bark(s));
  f.stroke([[16, 24], [16, 14]], 1.5, 1, 3, 'bark', D.bark(s));
  const C: [number, number, number, number][] = [
    [9 - v, 17, 6, 2], [23 + (v & 1), 16, 6, 2], [16, 9, 7, 3], [10, 10, 6, 4], [22, 9, 6, 4],
    [16, 18, 7, 5], [7, 21 - v, 4.5, 6], [25, 21, 4.5, 6], [13, 4, 5, 7], [20, 4 + v, 4.5, 7],
  ];
  canopy(f, C, 'leaf', s, snow);
  // punch light gaps through the canopy (sky holes) for dappled shadows
  for (let k = 0; k < 4; k++) { const x = 8 + (h2(k, v, 41) * 16 | 0), y = 6 + (h2(k, v, 42) * 12 | 0); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) { const i = (y + dy) * TREE_W + x + dx; if (f.m[i] >= 0 && f.mats[f.m[i]] === 'leaf') { f.m[i] = -1; f.z[i] = -1; } } }
  return { spr: f.render(), trunkTop: 26, species: 'oak', stiff: 1 };
}

export function pineArt(v: number, snow: boolean): TreeArt {
  const f = new HField(TREE_W, TREE_H); const s = v * 17 + 5;
  f.column(16, 30, 43, 1.6, 2.4, 1, 'bark', D.bark(s));
  f.stroke([[13, 43], [15, 41]], 1.2, 0.8, 1, 'bark'); f.stroke([[19, 43], [17, 41]], 1.2, 0.8, 1, 'bark');
  const tiers = 5;
  for (let t = 0; t < tiers; t++) {
    const y0 = 2 + t * 6.2, w = 3.5 + t * 2.4 + (v ? 0.6 : 0), hgt = 9;
    const pts: [number, number][] = [[16, y0], [16 + w * 0.5, y0 + hgt * 0.55], [16 + w + 1, y0 + hgt], [16 + w * 0.3, y0 + hgt - 1.5], [16, y0 + hgt + 0.5], [16 - w * 0.3, y0 + hgt - 1.5], [16 - w - 1, y0 + hgt], [16 - w * 0.5, y0 + hgt * 0.55]];
    f.poly(pts, 6 + t, 3 + t, 'pineleaf', (x, y, z, nx) => {
      const dd = (x - 16) / (w + 1); const needle = h2(x, y >> 1, s + t) > 0.7 ? 0.12 : 0; const lowRow = y > y0 + hgt - 2.5;
      if (snow && (y < y0 + 3 + Math.abs(dd) * 4) && h2(x, y, s) > 0.2) return { d: 0.3 - dd * 0.25, mat: 'snow' };
      return { d: -dd * 0.38 + needle - (lowRow ? 0.22 : 0) + (nx < 0 ? 0.05 : 0) };
    });
  }
  return { spr: f.render(), trunkTop: 32, species: snow ? 'snowpine' : 'pine', stiff: 2.2 };
}

export function palmArt(v: number): TreeArt {
  const f = new HField(TREE_W, TREE_H); const s = v * 23 + 9;
  const pts: [number, number][] = []; for (let y = 43; y >= 14; y -= 3) pts.push([15 + Math.sin((43 - y) / 14 + v) * 3, y]);
  f.stroke(pts, 2.2, 1.5, 1, 'bark', (x, y) => ({ d: y % 3 === 0 ? -0.25 : 0.05 }));
  const [cx, cy] = pts[pts.length - 1];
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k - 3) * 0.62 + (h2(k, v, 3) - 0.5) * 0.3; const L = 11 + h2(k, v, 4) * 3; const fr: [number, number][] = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; fr.push([cx + Math.cos(a) * L * t * 1.15, cy + Math.sin(a) * L * t * 0.7 + t * t * 9]); }
    f.stroke(fr, 1.6, 0.7, 6 + (k % 3), 'leaf', (x, y) => ({ d: (h2(x, y, s + k) > 0.6 ? 0.1 : -0.06) + ((x + y) % 3 === 0 ? -0.15 : 0) }));
  }
  f.blob(cx, cy + 1, 2.4, 2, 2, 'bark', D.noise(0.2, s));
  return { spr: f.render(), trunkTop: 18, species: 'palm', stiff: 0.7 };
}

export function willowArt(v: number): TreeArt {
  const f = new HField(TREE_W, TREE_H); const s = v * 29 + 11;
  f.column(16, 20, 43, 2.2, 3.4, 1, 'bark', D.bark(s)); f.stroke([[16, 26], [9, 16]], 1.4, 0.9, 2, 'bark'); f.stroke([[16, 25], [23, 15]], 1.4, 0.9, 2, 'bark');
  canopy(f, [[16, 11, 9, 2], [9, 13, 6, 4], [23, 13, 6, 4], [16, 6, 6, 6]], 'moss', s);
  // hanging curtains — separate strands that the wind sways most at their tips
  for (let x = 5; x < 28; x += 2) { const L = 10 + (h2(x, v, 5) * 14 | 0); for (let y = 14; y < Math.min(42, 14 + L); y++) f.put(x + (y > 30 ? 1 : 0), y, 9 - (y - 14) * 0.1, f.mats.length, true); }
  (f as any).mats.push('moss'); (f as any).det.push(D.leaves(s));
  return { spr: f.render(), trunkTop: 16, species: 'willow', stiff: 0.45 };
}

/** Faceted boulder with strata, a crack and moss on its lit crown. 16x16, same anchor as old rocks. */
export function rockArt(v: number, mossy = true) {
  const f = new HField(16, 16); const s = v * 31 + 1;
  f.blob(8, 10, 6.6, 5, 7, 'stone', (x, y, z, nx, ny) => { const st = D.strata(s, 0.9)(x, y, z, nx, ny) as any; if (mossy && ny < -0.35 && vn(x * 0.6, y * 0.6, s) > 0.45) return { d: 0.05, mat: 'moss' }; return st; }, 0.28, s);
  f.blob(4.5 + v, 12, 3.4, 2.6, 4, 'stone', D.facets(s + 2), 0.3, s + 1);
  return f.render();
}
export function bushArt(v: number, berries: boolean) {
  const f = new HField(16, 16); const s = v * 37 + 2;
  canopy(f, [[8, 10, 5.5, 1], [4.5, 11, 3.5, 2], [11.5, 11, 3.5, 2], [8, 7, 4, 3]], 'leaf', s);
  const spr = f.render();
  if (berries) { const g = spr.getContext('2d')!; for (let k = 0; k < 6; k++) { const x = 3 + (h2(k, v, 9) * 10 | 0), y = 5 + (h2(k, v, 8) * 8 | 0); g.fillStyle = '#5a0e1e'; g.fillRect(x, y + 1, 2, 1); g.fillStyle = '#c8304a'; g.fillRect(x, y, 2, 1); g.fillStyle = '#ffb0b8'; g.fillRect(x, y, 1, 1); } }
  return spr;
}
