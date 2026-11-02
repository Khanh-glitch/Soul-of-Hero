// Restrained arena: hand-tuned procedural flagstones, faint engraved circle, caster + target pylons.
import { Frame, W, H } from './frame';
import { hash2, noise2, fbm, type V2 } from './math';
import type { RGB } from './palette';

export const CASTER: V2 = { x: 112, y: 126 };
export const TARGETS: V2[] = [
  { x: 262, y: 106 },
  { x: 306, y: 156 },
  { x: 214, y: 164 },
  { x: 312, y: 62 },
];
export const FOCUS: V2 = { x: 252, y: 112 };

const STONE: RGB[] = [[0.075, 0.078, 0.11], [0.093, 0.098, 0.135], [0.11, 0.118, 0.158], [0.13, 0.14, 0.185], [0.16, 0.172, 0.22]];
const MORTAR: RGB = [0.035, 0.035, 0.055];

export function buildFloor(f: Frame) {
  const b = f.base;
  const bh = 14;
  for (let y = 0; y < H; y++) {
    const row = Math.floor(y / bh);
    const off = (hash2(row, 7) * 24) | 0;
    for (let x = 0; x < W; x++) {
      const bwRow = 20 + ((hash2(row, 3) * 10) | 0);
      const col = Math.floor((x + off) / bwRow);
      const lx = (x + off) % bwRow, ly = y % bh;
      const id = hash2(col, row);
      let c: RGB;
      const edge = lx === 0 || ly === 0;
      if (edge) c = MORTAR;
      else {
        let tone = 1 + Math.floor(id * 2.2);
        const n = fbm(x * 0.09, y * 0.09, id * 10, 2);
        if (n > 0.62) tone++;
        if (n < 0.33) tone--;
        if (ly === 1 || lx === 1) tone++;
        if (ly === bh - 1 || lx === bwRow - 1) tone--;
        if (hash2(x * 3 + 1, y * 5 + 2) > 0.985) tone++;
        if (hash2(x * 7 + 9, y * 2 + 1) > 0.975) tone--;
        c = STONE[Math.max(0, Math.min(STONE.length - 1, tone))];
        // occasional chipped corners
        if (id > 0.8 && lx + ly < 4) c = MORTAR;
      }
      // hairline cracks
      const cr = noise2(x * 0.05 + 40, y * 0.05);
      if (Math.abs(cr - 0.5) < 0.012 && fbm(x * 0.02, y * 0.02, 3) > 0.55) c = MORTAR;
      const i = (y * W + x) * 4;
      b[i] = c[0] * 255; b[i + 1] = c[1] * 255; b[i + 2] = c[2] * 255; b[i + 3] = 255;
    }
  }
  // engraved arena circle, barely visible
  const cx = W / 2 + 10, cy = H / 2 + 4;
  for (let a = 0; a < 2400; a++) {
    const t = (a / 2400) * Math.PI * 2;
    for (const [r, k] of [[96, 0.8], [99, 0.6]] as const) {
      const x = Math.floor(cx + Math.cos(t) * r * 1.35), y = Math.floor(cy + Math.sin(t) * r * 0.82);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      b[i] *= k; b[i + 1] *= k; b[i + 2] *= k;
    }
  }
  // vignette darkening baked into stone
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
    const v = 1 - 0.35 * Math.min(1, (dx * dx + dy * dy) * 0.6);
    const i = (y * W + x) * 4;
    b[i] *= v; b[i + 1] *= v; b[i + 2] *= v;
  }
}

const CASTER_SPR = [
  '....hh....',
  '...hHHh...',
  '..hHHHHh..',
  '..hfeefh..',
  '..hffffh..',
  '.rRRRRRRr.',
  '.rRRMRRRr.',
  'rRRRMRRRRr',
  'rRRRMRRRRr',
  'rRRRRRRRRr',
  '.rrRRRRrr.',
  '..rr..rr..',
];
const CPAL: Record<string, RGB> = {
  h: [0.13, 0.1, 0.2], H: [0.25, 0.2, 0.36], f: [0.05, 0.04, 0.08], e: [0.95, 0.9, 0.7],
  R: [0.22, 0.17, 0.33], r: [0.11, 0.08, 0.17], M: [0.55, 0.45, 0.25],
};

export function drawCaster(f: Frame, gem: RGB, t: number, pose = 0) {
  const ox = Math.round(CASTER.x - 5), oy = Math.round(CASTER.y - 12 - (Math.sin(t * 2) > 0.6 ? 1 : 0) * 0);
  // shadow
  f.disc(CASTER.x, CASTER.y, 6, (x, y) => f.S(x, y, 0.45), 0.4);
  CASTER_SPR.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      f.Ic(ox + i, oy + j, CPAL[ch]);
    }
  });
  // staff
  const sx = ox + 11, top = oy - 3 - Math.round(pose * 3);
  for (let y = top + 2; y <= oy + 11; y++) f.I(sx, y, 0.35, 0.24, 0.14, 1);
  f.I(sx - 1, top + 1, 0.5, 0.36, 0.2, 1); f.I(sx + 1, top + 1, 0.5, 0.36, 0.2, 1);
  const pulse = 0.8 + 0.4 * Math.sin(t * 5);
  f.Lc(sx, top, gem, 1.6 * pulse);
  f.Lc(sx, top - 1, gem, 0.7 * pulse); f.Lc(sx - 1, top, gem, 0.5 * pulse); f.Lc(sx + 1, top, gem, 0.5 * pulse);
  f.glow(sx, top, 7, gem, 0.25 * pulse, 3);
}

const PYLON = [
  '..a..',
  '.aAb.',
  '.aAb.',
  'aAAbb',
  'aAAbb',
  '.aAb.',
  '.aAb.',
  'ccccc',
];
const PPAL: Record<string, RGB> = { a: [0.2, 0.2, 0.3], A: [0.34, 0.34, 0.46], b: [0.1, 0.1, 0.16], c: [0.07, 0.07, 0.1] };

export function drawTargets(f: Frame, t: number, alpha = 1) {
  if (alpha <= 0) return;
  TARGETS.forEach((p, k) => {
    const bob = Math.round(Math.sin(t * 1.3 + k * 2) * 1);
    f.disc(p.x, p.y, 5, (x, y) => f.S(x, y, 0.55), 0.4);
    f.ring(p.x, p.y, 8, (x, y) => f.S(x, y, 0.8), 0.45);
    PYLON.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        f.Ic(p.x - 2 + i, p.y - 9 + j + (j < 7 ? bob - 1 : 0), PPAL[ch], alpha);
      }
    });
    f.L(p.x, p.y - 7 + bob, 0.25, 0.22, 0.4);
  });
}
