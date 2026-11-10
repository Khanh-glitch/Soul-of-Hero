/**
 * VEYRA05 PIXEL-CRAFT ENGINE — authentic 1× integer pixel-art raster & shading core.
 *
 * Designed strictly for Soul of Hero's visual grammar:
 *   - Unified deep warm-plum silhouette outline (`OUT = '#140c14'`).
 *   - Single global light vector from Top-Left-Front (`L = normalize(-0.55, -0.75, 0.35)`).
 *   - Hue-shifted 4–5 tone material ramps (cool shadows, warm highlights).
 *   - Ordered 2×2 Bayer dithering only on curved volumes (cylinders, domes, heaps).
 *   - Zero blurred vector strokes, zero fractional rotations, zero programmer-art boxes.
 *   - Separate post-outline ground contact shadow so outlines hug physical silhouettes.
 */
import { hash2 } from '../game/core';
import { hex, outlineCanvas, type Sprite } from '../game/art';

export const SOH_OUTLINE = '#140c14';

export type Ramp = readonly [deep: string, dark: string, mid: string, light: string, hi: string];

/** Cohesive hue-shifted SOH material ramps aligned with render.ts & art.ts. */
export const RAMPS = {
  iron:    ['#1d2029', '#313946', '#4f5c6b', '#7b8a99', '#b8c6d4'] as Ramp,
  steel:   ['#242834', '#3f4859', '#647284', '#94a4b6', '#d2e0ec'] as Ramp,
  rust:    ['#361918', '#5e2c22', '#8f4730', '#bd6d46', '#dea06e'] as Ramp,
  copper:  ['#1b3336', '#285252', '#3d7c77', '#67a89f', '#a6d6cc'] as Ramp,
  brass:   ['#452d14', '#75511f', '#ab7b2d', '#d9ad4e', '#ffe48c'] as Ramp,
  wood:    ['#2b180e', '#4f2f1c', '#7c4d2d', '#a87243', '#d4a36a'] as Ramp,
  timber:  ['#362112', '#613c21', '#8f5d34', '#ba864e', '#e2b87c'] as Ramp,
  sawdust: ['#543a1a', '#855f2a', '#b88a3e', '#deb662', '#f7df96'] as Ramp,
  stone:   ['#2b2932', '#494750', '#6e6c73', '#969393', '#c6c0b6'] as Ramp,
  slate:   ['#202530', '#38414e', '#586472', '#82909c', '#b4c2cc'] as Ramp,
  brick:   ['#321618', '#5c2622', '#8b3d30', '#b85c42', '#df8e6a'] as Ramp,
  basalt:  ['#1a171c', '#2c272e', '#443d44', '#635960', '#8c7f82'] as Ramp,
  obsidian:['#11101a', '#1e2033', '#303652', '#586e8e', '#a4cde0'] as Ramp,
  coal:    ['#100e14', '#1e1d24', '#31313c', '#4b4c5a', '#747888'] as Ramp,
  water:   ['#172d52', '#214d7c', '#3074a6', '#58a6d0', '#b8ecff'] as Ramp,
  turbid:  ['#1f2c32', '#334d4d', '#4b6e68', '#709184', '#a0b8a6'] as Ramp,
  ember:   ['#4a1412', '#942818', '#d4521c', '#ff9c33', '#fff09c'] as Ramp,
  sulfur:  ['#4a3e10', '#826e16', '#bba426', '#e6d64e', '#fff6a6'] as Ramp,
  salt:    ['#68747c', '#98a4aa', '#c6cec8', '#e6e4d2', '#faf8ee'] as Ramp,
  cloth:   ['#3a1924', '#692737', '#9c3b46', '#cc625c', '#f09e86'] as Ramp,
  cream:   ['#4f4438', '#85735c', '#b59f80', '#dbcaa6', '#f7ecd0'] as Ramp,
  moss:    ['#1d381c', '#2d5824', '#487d32', '#70ad48', '#a6d96e'] as Ramp,
  ore:     ['#38211a', '#633726', '#945435', '#c47c48', '#ebaf6e'] as Ramp,
  gold:    ['#543710', '#8c5c16', '#c98a22', '#f2be44', '#fff29e'] as Ramp,
} as const;

const BAYER2 = [
  [0, 2],
  [3, 1],
];

/** Integer pixel canvas buffer that compiles cleanly to a standard HTMLCanvasElement Sprite. */
export class PxBuf {
  readonly w: number;
  readonly h: number;
  readonly rgba: Uint8ClampedArray;
  private readonly palCache = new Map<string, [number, number, number, number]>();

  constructor(w: number, h: number) {
    this.w = w | 0;
    this.h = h | 0;
    this.rgba = new Uint8ClampedArray(this.w * this.h * 4);
  }

  private col(c: string): [number, number, number, number] {
    let hit = this.palCache.get(c);
    if (hit) return hit;
    if (c.startsWith('#')) {
      const [r, g, b] = hex(c.slice(0, 7));
      const a = c.length === 9 ? parseInt(c.slice(7, 9), 16) : 255;
      hit = [r, g, b, a];
    } else {
      hit = [255, 0, 255, 255];
    }
    this.palCache.set(c, hit);
    return hit;
  }

  has(x: number, y: number): boolean {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.rgba[(y * this.w + x) * 4 + 3] > 20;
  }

  p(x: number, y: number, c: string) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = this.col(c);
    const i = (y * this.w + x) * 4;
    if (a >= 254) {
      this.rgba[i] = r; this.rgba[i + 1] = g; this.rgba[i + 2] = b; this.rgba[i + 3] = 255;
    } else if (a > 0) {
      const sa = a / 255, da = this.rgba[i + 3] / 255, oa = sa + da * (1 - sa);
      if (oa <= 0) return;
      this.rgba[i] = Math.round((r * sa + this.rgba[i] * da * (1 - sa)) / oa);
      this.rgba[i + 1] = Math.round((g * sa + this.rgba[i + 1] * da * (1 - sa)) / oa);
      this.rgba[i + 2] = Math.round((b * sa + this.rgba[i + 2] * da * (1 - sa)) / oa);
      this.rgba[i + 3] = Math.round(oa * 255);
    }
  }

  /** Blend rgba directly with explicit opacity (0..1). */
  blend(x: number, y: number, r: number, g: number, b: number, alpha: number) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || alpha <= 0) return;
    const i = (y * this.w + x) * 4;
    const da = this.rgba[i + 3] / 255;
    const oa = alpha + da * (1 - alpha);
    if (oa <= 0) return;
    this.rgba[i] = Math.round((r * alpha + this.rgba[i] * da * (1 - alpha)) / oa);
    this.rgba[i + 1] = Math.round((g * alpha + this.rgba[i + 1] * da * (1 - alpha)) / oa);
    this.rgba[i + 2] = Math.round((b * alpha + this.rgba[i + 2] * da * (1 - alpha)) / oa);
    this.rgba[i + 3] = Math.round(oa * 255);
  }

  rect(x: number, y: number, w: number, h: number, c: string) {
    const x0 = Math.round(x), y0 = Math.round(y);
    const x1 = Math.round(x + w), y1 = Math.round(y + h);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.p(xx, yy, c);
  }

  hline(x: number, y: number, len: number, c: string) {
    this.rect(x, y, len, 1, c);
  }

  vline(x: number, y: number, len: number, c: string) {
    this.rect(x, y, 1, len, c);
  }

  /** Crisp Bresenham integer line (thickness 1 or 2). */
  line(x0: number, y0: number, x1: number, y1: number, c: string, thick = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 512; guard++) {
      this.p(x0, y0, c);
      if (thick >= 2) { this.p(x0 + 1, y0, c); this.p(x0, y0 + 1, c); }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Filled integer ellipse with optional shader callback `(nx, ny, x, y) => color | null`. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string | ((nx: number, ny: number, x: number, y: number) => string | null)) {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const col = typeof c === 'string' ? c : c(nx, ny, x, y);
        if (col) this.p(x, y, col);
      }
    }
  }

  /** Crisp 1px pixel-plotted ellipse ring (no AA smear). */
  ring(cx: number, cy: number, rx: number, ry: number, c: string, thickness = 1) {
    const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d = Math.hypot(nx, ny);
        const inner = Math.max(0.1, 1 - thickness / Math.min(rx, ry));
        if (d <= 1.03 && d >= inner) this.p(x, y, c);
      }
    }
  }

  /** Stamp an ASCII matrix (`'.'` = transparent). */
  matrix(ox: number, oy: number, rows: readonly string[], pal: Record<string, string>, flipX = false) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[flipX ? row.length - 1 - x : x];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (col) this.p(ox + x, oy + y, col);
      }
    }
  }

  /** Apply 4-connected SOH outer outline (`#140c14`) directly on the pixel buffer. */
  outline(col = SOH_OUTLINE) {
    const [r, g, b, a] = this.col(col);
    const mask = new Uint8Array(this.w * this.h);
    for (let i = 0; i < this.w * this.h; i++) mask[i] = this.rgba[i * 4 + 3] > 40 ? 1 : 0;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (mask[i]) continue;
        if ((x > 0 && mask[i - 1]) || (x < this.w - 1 && mask[i + 1]) || (y > 0 && mask[i - this.w]) || (y < this.h - 1 && mask[i + this.w])) {
          const pi = i * 4;
          this.rgba[pi] = r; this.rgba[pi + 1] = g; this.rgba[pi + 2] = b; this.rgba[pi + 3] = a;
        }
      }
    }
  }

  /** Drop a soft translucent dark ground shadow ONLY onto transparent pixels around/below the base. */
  shadowEllipse(cx: number, cy: number, rx: number, ry: number, alpha = 0.34) {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        if (this.has(x, y)) continue;
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.blend(x, y, 10, 8, 20, alpha);
      }
    }
  }

  toCanvas(): Sprite {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    const img = g.createImageData(this.w, this.h);
    img.data.set(this.rgba);
    g.putImageData(img, 0, 0);
    return c;
  }
}

/** Pick tone index [0..4] from normalized luminance t in [0..1] using crisp 2×2 Bayer dither. */
export function ditherTone(ramp: Ramp, t: number, x: number, y: number, ditherAmt = 0.14): string {
  const b = (BAYER2[y & 1][x & 1] / 3 - 0.5) * ditherAmt;
  const v = Math.max(0, Math.min(0.999, t + b));
  if (v < 0.14) return ramp[0];
  if (v < 0.36) return ramp[1];
  if (v < 0.64) return ramp[2];
  if (v < 0.86) return ramp[3];
  return ramp[4];
}

/** Build a SOH sprite with automatic crisp `#140c14` outline around foreground geometry and optional ground shadow underneath. */
export function craftSprite(
  w: number,
  h: number,
  draw: (b: PxBuf) => void,
  shadow?: { cx: number; cy: number; rx: number; ry: number; alpha?: number } | null,
  outlineCol: string | null = SOH_OUTLINE,
): Sprite {
  const b = new PxBuf(w, h);
  draw(b);
  if (outlineCol) b.outline(outlineCol);
  if (shadow) b.shadowEllipse(shadow.cx, shadow.cy, shadow.rx, shadow.ry, shadow.alpha ?? 0.34);
  return b.toCanvas();
}

/** Draw a vertical cylinder (tank, silo, chimney, drum, boiler) with elliptical top cap, NW shading, and optional hoop bands. */
export function drawCylV(
  b: PxBuf,
  x: number,
  y: number,
  w: number,
  h: number,
  ramp: Ramp,
  opts: { topCap?: boolean; hoops?: number[]; seamX?: number; taperTop?: number; dither?: number } = {},
) {
  const taper = opts.taperTop ?? 0;
  const topRy = Math.max(2, Math.round(w * 0.18));
  const dith = opts.dither ?? 0.11;
  for (let py = 0; py < h; py++) {
    const fracY = py / Math.max(1, h - 1);
    const inset = Math.round(taper * (1 - fracY));
    const xStart = x + inset;
    const rowW = Math.max(3, w - inset * 2);
    const botDip = Math.round(Math.sin((0.5) * Math.PI) * 1.4);
    void botDip;
    for (let px = 0; px < rowW; px++) {
      const u = (px + 0.5) / rowW; // 0 left .. 1 right
      // Cylinder normal pointing NW: bright highlight around u ~ 0.25, shadow at u ~ 0.85, subtle bounce at u ~ 0.96
      const angle = (u - 0.5) * Math.PI;
      const nx = Math.sin(angle);
      const nz = Math.cos(angle);
      let lum = 0.52 - nx * 0.42 + (nz - 0.7) * 0.18;
      if (u > 0.88) lum += 0.08; // subtle rim bounce
      if (py >= h - 2) lum -= 0.14; // ground occlusion
      if (py === 0) lum += 0.12;
      const gx = xStart + px, gy = y + py;
      // Round bottom skirt slightly
      if (py >= h - 2 && (px === 0 || px === rowW - 1)) continue;
      if (py === h - 1 && (px <= 1 || px >= rowW - 2)) continue;
      b.p(gx, gy, ditherTone(ramp, lum, gx, gy, dith));
    }
    // Optional vertical seam
    if (opts.seamX !== undefined && py > 2 && py < h - 2) {
      b.p(xStart + Math.round(rowW * opts.seamX), y + py, ramp[1]);
    }
  }
  if (opts.topCap !== false) {
    const cx = x + taper + (w - taper * 2) / 2;
    const rx = Math.max(2, (w - taper * 2) / 2);
    b.ellipse(cx, y + 1, rx, topRy, (nx, ny, gx, gy) => {
      const edge = Math.hypot(nx, ny);
      if (edge > 0.86) return ny < 0 ? ramp[4] : ramp[1];
      return ditherTone(ramp, 0.72 - nx * 0.22 - ny * 0.2, gx, gy, 0.08);
    });
  }
  if (opts.hoops) {
    for (const hy of opts.hoops) {
      const fracY = (hy - y) / Math.max(1, h - 1);
      const inset = Math.round(taper * (1 - fracY));
      const xStart = x + inset;
      const rowW = Math.max(3, w - inset * 2);
      for (let px = 0; px < rowW; px++) {
        const u = (px + 0.5) / rowW;
        b.p(xStart + px, hy, u < 0.45 ? ramp[3] : ramp[1]);
        b.p(xStart + px, hy + 1, ramp[0]);
      }
    }
  }
}

/** Draw a horizontal pipe/log/drum with NW top-lit cylindrical shading and optional bolted flanges. */
export function drawCylH(
  b: PxBuf,
  x: number,
  y: number,
  w: number,
  d: number,
  ramp: Ramp,
  opts: { flanges?: number[]; endCapLeft?: boolean; endCapRight?: boolean; ringEnd?: boolean } = {},
) {
  for (let px = 0; px < w; px++) {
    for (let py = 0; py < d; py++) {
      const v = (py + 0.5) / d; // 0 top .. 1 bottom
      let lum = 0.84 - v * 0.78;
      if (v > 0.14 && v < 0.34) lum += 0.16; // top specular strip
      if (v > 0.86) lum -= 0.12;
      b.p(x + px, y + py, ditherTone(ramp, lum, x + px, y + py, 0.08));
    }
  }
  if (opts.flanges) {
    for (const fx of opts.flanges) {
      for (let py = -1; py <= d; py++) {
        b.p(fx, y + py, py < d * 0.45 ? ramp[4] : ramp[1]);
        b.p(fx + 1, y + py, py < d * 0.45 ? ramp[2] : ramp[0]);
      }
      b.p(fx, y, ramp[0]);
      b.p(fx, y + d - 1, ramp[0]);
    }
  }
  if (opts.endCapRight) {
    const cy = y + d / 2;
    b.ellipse(x + w - 1, cy, Math.max(1.5, d * 0.26), d / 2, (nx, ny) =>
      opts.ringEnd
        ? (Math.hypot(nx, ny) > 0.68 ? ramp[2] : Math.hypot(nx, ny) > 0.34 ? RAMPS.sawdust[3] : RAMPS.timber[2])
        : (ny < 0 ? ramp[3] : ramp[1]),
    );
  }
  if (opts.endCapLeft) {
    const cy = y + d / 2;
    b.ellipse(x, cy, Math.max(1.5, d * 0.26), d / 2, (nx, ny) =>
      opts.ringEnd
        ? (Math.hypot(nx, ny) > 0.72 ? ramp[1] : Math.hypot(nx, ny) > 0.4 ? RAMPS.sawdust[3] : RAMPS.timber[2])
        : (ny < 0 ? ramp[4] : ramp[2]),
    );
  }
}

/** Draw an organic irregular mound/heap (spoil rock, charcoal, sawdust, ore) with dithered facets and base scatter. */
export function drawOrganicHeap(
  b: PxBuf,
  cx: number,
  baseY: number,
  rx: number,
  h: number,
  ramp: Ramp,
  seed: number,
  accent?: { col: string; chance: number; hi?: string },
) {
  for (let py = 0; py <= h; py++) {
    const frac = py / Math.max(1, h); // 0 peak .. 1 base
    const halfW = Math.max(2, rx * Math.pow(frac, 0.72));
    for (let dx = -Math.ceil(halfW); dx <= Math.ceil(halfW); dx++) {
      const gx = Math.round(cx + dx), gy = Math.round(baseY - h + py);
      const nx = dx / Math.max(1, halfW);
      const edgeNoise = (hash2(gx, gy, seed) - 0.5) * 0.28;
      if (Math.abs(nx) > 1 + edgeNoise * (frac > 0.75 ? 0.5 : 0.25)) continue;
      // Faceted directional lighting from NW
      const facet = (hash2(gx >> 1, gy >> 1, seed + 17) - 0.5) * 0.28;
      let lum = 0.62 - nx * 0.34 - (frac - 0.35) * 0.24 + facet;
      if (frac > 0.86) lum -= 0.16;
      b.p(gx, gy, ditherTone(ramp, lum, gx, gy, 0.14));
      if (accent && hash2(gx, gy, seed + 51) < accent.chance && frac > 0.22 && frac < 0.88) {
        b.p(gx, gy, lum > 0.55 && accent.hi ? accent.hi : accent.col);
      }
    }
  }
  // Base scree / crumbs along skirt
  for (let k = 0; k < 10; k++) {
    const sx = Math.round(cx + (hash2(k, seed, 3) - 0.5) * rx * 2.1);
    const sy = Math.round(baseY - 1 + hash2(k, seed, 4) * 3);
    b.p(sx, sy, k % 2 ? ramp[1] : ramp[2]);
  }
}

/** Draw a crisp pixel-plotted spoked wheel (waterwheel, flywheel, handwheel, pulley) with 3/4 thickness. */
export function drawWheel(
  b: PxBuf,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  spokes: number,
  rimRamp: Ramp,
  hubRamp: Ramp,
  opts: { buckets?: number; innerSpokeColor?: string; angleOff?: number } = {},
) {
  const rimThick = Math.max(2, Math.round(Math.min(rx, ry) * 0.24));
  // Radial spokes first
  const off = opts.angleOff ?? 0;
  for (let i = 0; i < spokes; i++) {
    const a = off + (i / spokes) * Math.PI * 2;
    const x1 = cx + Math.cos(a) * (rx - rimThick * 0.5);
    const y1 = cy + Math.sin(a) * (ry - rimThick * 0.5);
    b.line(cx, cy, x1, y1, opts.innerSpokeColor ?? rimRamp[2]);
  }
  // Optional paddle buckets around outer rim
  if (opts.buckets) {
    for (let i = 0; i < opts.buckets; i++) {
      const a = off + (i / opts.buckets) * Math.PI * 2;
      const bx = Math.round(cx + Math.cos(a) * (rx + 1));
      const by = Math.round(cy + Math.sin(a) * (ry + 1));
      b.rect(bx - 1, by - 1, 2, 2, Math.sin(a) < 0 ? rimRamp[3] : rimRamp[1]);
    }
  }
  // Rim ring with NW specular highlight
  const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
  const y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = Math.hypot(nx, ny);
      if (d > 1.03 || d < 1 - rimThick / Math.min(rx, ry)) continue;
      const lum = 0.58 - nx * 0.32 - ny * 0.35;
      b.p(x, y, ditherTone(rimRamp, lum, x, y, 0.08));
    }
  }
  // Center hub & axle pin
  b.ellipse(cx, cy, Math.max(2, rx * 0.24), Math.max(2, ry * 0.24), (nx, ny) =>
    nx + ny < -0.2 ? hubRamp[4] : nx + ny > 0.4 ? hubRamp[1] : hubRamp[2],
  );
  b.p(Math.round(cx), Math.round(cy), hubRamp[0]);
}

/** Draw a 2.5D wooden crate at (x, y) with top bevel, diagonal cross brace, and shadow. */
export function drawCrate25D(b: PxBuf, x: number, y: number, w: number, h: number, ramp: Ramp = RAMPS.timber) {
  const topH = Math.max(3, Math.round(h * 0.38));
  b.rect(x, y, w, h, ramp[1]);
  b.rect(x, y, w, topH, ramp[3]);
  b.hline(x + 1, y + 1, w - 2, ramp[4]);
  b.hline(x, y + topH - 1, w, ramp[0]);
  // Inner recessed panel on front face
  b.rect(x + 1, y + topH + 1, w - 2, h - topH - 2, ramp[2]);
  b.rect(x + 2, y + topH + 2, w - 4, h - topH - 4, ramp[1]);
  // Diagonal brace
  b.line(x + 1, y + topH + 1, x + w - 2, y + h - 2, ramp[3]);
  b.hline(x, y + h - 1, w, ramp[0]);
}

/** Draw a 2.5D wooden barrel at (x, y) with bulged staves & iron hoops. */
export function drawBarrel25D(b: PxBuf, cx: number, y: number, w: number, h: number, wood: Ramp = RAMPS.wood, hoop: Ramp = RAMPS.iron) {
  const rx = w / 2;
  for (let py = 0; py < h; py++) {
    const v = py / Math.max(1, h - 1);
    const bulge = Math.sin(v * Math.PI) * 1.1;
    const hw = Math.max(2, Math.round(rx - 0.8 + bulge));
    for (let dx = -hw; dx <= hw; dx++) {
      const u = (dx + hw) / Math.max(1, hw * 2);
      const isHoop = py === 3 || py === h - 4;
      const r = isHoop ? hoop : wood;
      let lum = 0.72 - u * 0.56;
      if (!isHoop && Math.abs(dx) % 3 === 1) lum -= 0.12; // stave seam
      b.p(Math.round(cx + dx), y + py, ditherTone(r, lum, Math.round(cx + dx), y + py, 0.06));
    }
  }
  b.ellipse(cx, y + 1, rx * 0.75, 1.5, (_, ny) => (ny < 0 ? wood[4] : wood[2]));
}