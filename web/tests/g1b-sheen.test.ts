/** G1B batch 2 — Surface Sheen Sweep is driven by the studio mask's material / plane / bevel channels, per sprite pixel. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { resolve } from 'node:path';
import { g1bSheenStep } from '../src/game/g1b-art';

/** Minimal PNG reader (8-bit, colour type 2 / 6 / 3 with tRNS-free palettes are not needed here: the mask is RGBA). */
function png(file: string) {
  const b = readFileSync(file); let p = 8, w = 0, h = 0, ct = 0; const idat: Buffer[] = [];
  while (p < b.length) { const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len); if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; expect(d[8]).toBe(8); } if (type === 'IDAT') idat.push(d); p += 12 + len; }
  expect(ct).toBe(6); const bpp = 4, raw = inflateSync(Buffer.concat(idat)), out = new Uint8Array(w * h * bpp), stride = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) { const x = raw[y * (stride + 1) + 1 + i], a = i >= bpp ? out[y * stride + i - bpp] : 0, u = y ? out[(y - 1) * stride + i] : 0, c = y && i >= bpp ? out[(y - 1) * stride + i - bpp] : 0;
      const pa = Math.abs(u - c), pb = Math.abs(a - c), pc = Math.abs(a + u - 2 * c), pae = pa <= pb && pa <= pc ? a : pb <= pc ? u : c;
      out[y * stride + i] = (x + (f === 0 ? 0 : f === 1 ? a : f === 2 ? u : f === 3 ? (a + u) >> 1 : pae)) & 255; } }
  return { w, h, at: (x: number, y: number) => { const o = (y * w + x) * 4; return [out[o], out[o + 1], out[o + 2], out[o + 3]] as [number, number, number, number]; } };
}
const M = png(resolve(__dirname, '../public/assets/g1b/chests/soh_crates_surface_mask_5x3.png'));

describe('G1B surface sheen', () => {
  it('reads the mask it was built for: 240×144, five 48px families, material / plane ids on the CLOSED row', () => {
    expect([M.w, M.h]).toEqual([240, 144]);
    for (let col = 0; col < 5; col++) { const mats = new Set<number>(), planes = new Set<number>(); for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const [r, g, , a] = M.at(col * 48 + x, y); if (a) { mats.add(Math.round(r / 28)); planes.add(Math.round(g / 28)); } }
      expect(mats.has(0), 'outline material').toBe(true); expect(mats.size, `family ${col} has more than one material`).toBeGreaterThan(1); expect(planes.size, `family ${col} has more than one plane`).toBeGreaterThan(2); }
  });
  it('never lights the outline or a pixel outside the object, in any family at any moment of the sweep', () => {
    for (let col = 0; col < 5; col++) for (let s = 0; s <= 30; s++) for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const [r, g, b, a] = M.at(col * 48 + x, y); const st = g1bSheenStep(r, g, b, a, x, y, s / 30, 1.12);
      if (a < 128 || Math.round(r / 28) === 0) expect(st).toBe(0);
    }
  });
  it('responds to the surface: metal out-shines timber, the lid and the front are lit at different moments, bevel raises the step', () => {
    // same place, same moment, same bevel: only the material differs
    expect(g1bSheenStep(6 * 28, 4 * 28, 200, 255, 24, 24, 0.5, 1)).toBeGreaterThan(g1bSheenStep(1 * 28, 4 * 28, 200, 255, 24, 24, 0.5, 1));
    // same material, same place: a curved bevel catches more than a flat one
    expect(g1bSheenStep(6 * 28, 5 * 28, 255, 255, 24, 24, 0.5, 1)).toBeGreaterThanOrEqual(g1bSheenStep(6 * 28, 5 * 28, 0, 255, 24, 24, 0.5, 1));
    expect(g1bSheenStep(1 * 28, 1 * 28, 255, 255, 24, 20, 0.5, 1)).toBeGreaterThan(g1bSheenStep(1 * 28, 1 * 28, 0, 255, 24, 20, 0.5, 0.48));
    // the band crosses the lid plane and the front plane on different columns of the same row offset: it bends at the lid edge
    const lit = (plane: number, y: number, phase: number) => { const xs: number[] = []; for (let x = 0; x < 48; x++) if (g1bSheenStep(6 * 28, plane * 28, 255, 255, x, y, phase, 1)) xs.push(x); return xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : -1; };
    const lidTop = lit(1, 16, 0.5), lidLow = lit(1, 24, 0.5), frontTop = lit(4, 26, 0.5), frontLow = lit(4, 38, 0.5);
    expect(lidLow).toBeGreaterThan(lidTop); expect(frontLow).toBeLessThan(frontTop);   // opposite lean on the two planes
    // it is a moving band, not a full-sprite flash: at any moment most of the object is unlit, and over the sweep most of it gets lit once
    for (let col = 0; col < 5; col++) {
      let obj = 0; const ever = new Set<number>(); let maxNow = 0;
      for (let s = 0; s < 30; s++) { let now = 0; for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const [r, g, b, a] = M.at(col * 48 + x, y); if (a < 128 || Math.round(r / 28) === 0) continue; if (s === 0) obj++; if (g1bSheenStep(r, g, b, a, x, y, s / 29, 1.12)) { now++; ever.add(y * 48 + x); } } maxNow = Math.max(maxNow, now); }
      expect(maxNow / obj, `family ${col}: share lit at once`).toBeLessThan(0.45); expect(ever.size / obj, `family ${col}: share lit during the sweep`).toBeGreaterThan(0.6);
    }
    // starts and ends off the sprite: nothing is lit at the very start or the very end
    for (let col = 0; col < 5; col++) for (const ph of [0, 1]) { let n = 0; for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const [r, g, b, a] = M.at(col * 48 + x, y); if (g1bSheenStep(r, g, b, a, x, y, ph, 1.12)) n++; } expect(n, `family ${col} phase ${ph}`).toBe(0); }
  });
});
