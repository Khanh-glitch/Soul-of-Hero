// ---------------------------------------------------------------------------
// ARCANA :: the arena. A restrained stone floor rendered once into fb.bg,
// plus the caster marker and target anchors drawn live.
// ---------------------------------------------------------------------------

import { Framebuffer } from "./framebuffer";
import { glow, arcPx } from "./draw";
import { RGB, fbm, hash2, clamp, TAU, lerp, smoothstep } from "./math";

export const VIEW_W = 416;
export const VIEW_H = 234;

export const CASTER = { x: 104, y: 150 };
export const ARENA_C = { x: 232, y: 124 };
export const ANCHORS = [
  { x: 316, y: 86 },
  { x: 348, y: 162 },
  { x: 236, y: 196 },
  { x: 196, y: 70 },
];

/** Build the static arena layer. Dark, desaturated, deliberately quiet. */
export function buildFloor(fb: Framebuffer) {
  const { W, H, bg } = fb;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      // perspective-ish darkening toward the top of the arena
      const depth = y / H;
      let base = 0.030 + depth * 0.016;

      // stone grain
      const n = fbm(x * 0.09, y * 0.12, 4);
      base += (n - 0.5) * 0.016;

      // tile grid, 26x18, with slightly broken mortar lines
      const tx = x % 26,
        ty = y % 18;
      const jitter = hash2(Math.floor(x / 26), Math.floor(y / 18));
      if (tx === 0 || ty === 0) base *= 0.62 + jitter * 0.16;
      if (tx === 1 || ty === 1) base *= 0.86;

      // occasional cracked / missing tiles
      const tileN = hash2(Math.floor(x / 26) * 7 + 3, Math.floor(y / 18) * 13 + 5);
      if (tileN > 0.9) base *= 0.82;
      else if (tileN < 0.07) base *= 1.14;

      // the laboratory's cold ambient fill, slightly blue-violet
      let r = base * 0.95,
        g = base * 1.0,
        b = base * 1.35;

      // faint warm pool near the caster plinth
      const dC = Math.hypot(x - CASTER.x, (y - CASTER.y) * 1.3);
      const warm = Math.max(0, 1 - dC / 70) * 0.018;
      r += warm * 1.2;
      g += warm * 0.8;
      b += warm * 0.5;

      bg[i] = r;
      bg[i + 1] = g;
      bg[i + 2] = b;
    }
  }

  // measurement circle etched in the floor
  etchCircle(fb, ARENA_C.x, ARENA_C.y, 96, 0.013, 1.65);
  etchCircle(fb, ARENA_C.x, ARENA_C.y, 62, 0.009, 1.65);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU;
    const r0 = k % 6 === 0 ? 88 : 92;
    for (let r = r0; r < 96; r += 0.6) {
      const x = Math.round(ARENA_C.x + Math.cos(a) * r);
      const y = Math.round(ARENA_C.y + (Math.sin(a) * r) / 1.65);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 3;
      bg[i] += 0.009;
      bg[i + 1] += 0.011;
      bg[i + 2] += 0.018;
    }
  }
}

function etchCircle(fb: Framebuffer, cx: number, cy: number, r: number, k: number, squash: number) {
  const steps = Math.ceil(r * 7);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + (Math.sin(a) * r) / squash);
    if (x < 0 || y < 0 || x >= fb.W || y >= fb.H) continue;
    const idx = (y * fb.W + x) * 3;
    fb.bg[idx] += k * 0.8;
    fb.bg[idx + 1] += k * 0.9;
    fb.bg[idx + 2] += k * 1.4;
  }
}

// --- caster -----------------------------------------------------------------
// 11x17 hooded figure, hand-authored pixel mask. '.'=empty
const CASTER_SPR = [
  "....ooo....",
  "...o222o...",
  "..o23332o..",
  "..o23332o..",
  "..o21112o..",
  ".o2211122o.",
  ".o221112 o.",
  "o22111112 o",
  "o22111112 o",
  ".o2111112o.",
  ".o211111 o.",
  "..o21112o..",
  "..o2111o...",
  "..o211o....",
  "...oo o....",
  "..o11 o....",
  "..ooo oo...",
];

const CASTER_PAL: Record<string, RGB> = {
  o: [0.012, 0.012, 0.022],
  "1": [0.1, 0.1, 0.15],
  "2": [0.17, 0.17, 0.26],
  "3": [0.26, 0.27, 0.4],
};

export function drawCaster(fb: Framebuffer, t: number, accent: RGB, intensity: number, kick = 0) {
  const bx = Math.round(CASTER.x - 5 + kick * 0.5);
  const by = Math.round(CASTER.y - 14 + Math.sin(t * 2.1) * 0.5);

  // ground shadow
  for (let y = -4; y <= 5; y++)
    for (let x = -9; x <= 9; x++) {
      const d = Math.hypot(x / 9, (y - 1) / 3.6);
      if (d > 1) continue;
      fb.mul(CASTER.x + x, CASTER.y + y, lerp(0.35, 1, d));
    }

  for (let y = 0; y < CASTER_SPR.length; y++) {
    const row = CASTER_SPR[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "." || ch === " ") continue;
      const c = CASTER_PAL[ch];
      if (!c) continue;
      fb.blend(bx + x, by + y, c[0], c[1], c[2], 1);
    }
  }
  // rim light from the spell
  const k = 0.5 + intensity;
  for (let y = 0; y < CASTER_SPR.length; y++) {
    const row = CASTER_SPR[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "." || row[x] === " ") continue;
      const right = x + 1 >= row.length || row[x + 1] === "." || row[x + 1] === " ";
      if (right)
        fb.add(bx + x, by + y, accent[0], accent[1], accent[2], 0.22 * k);
    }
  }
  // the focus spark held in front of the caster
  const fx = CASTER.x + 7 + kick * 0.8,
    fy = CASTER.y - 8;
  const ik = Math.min(1.1, intensity);
  glow(fb, fx, fy, 2.5 + ik * 3.4, accent, 0.2 + ik * 0.28);
  fb.add(fx, fy, accent[0], accent[1], accent[2], 0.5 + ik * 0.5);
}

export function drawAnchors(fb: Framebuffer, t: number, accent: RGB) {
  for (let i = 0; i < ANCHORS.length; i++) {
    const a = ANCHORS[i];
    const ph = t * 1.1 + i * 1.7;
    const pulse = 0.5 + 0.5 * Math.sin(ph);
    const c: RGB = [
      lerp(0.14, accent[0] * 0.35, pulse * 0.6),
      lerp(0.16, accent[1] * 0.35, pulse * 0.6),
      lerp(0.24, accent[2] * 0.35, pulse * 0.6),
    ];
    arcPx(fb, a.x, a.y, 7, 0, TAU, c, 0.26, 1.65);
    for (let k = 0; k < 3; k++) {
      const ang = ph * 0.5 + (k / 3) * TAU;
      fb.add(
        a.x + Math.cos(ang) * 7,
        a.y + (Math.sin(ang) * 7) / 1.65,
        c[0] * 2.0,
        c[1] * 2.0,
        c[2] * 2.0,
        0.45
      );
    }
  }
}

/** ambient dust motes drifting in the lab, keeps the idle frame alive */
export function drawDust(fb: Framebuffer, t: number) {
  for (let i = 0; i < 44; i++) {
    const s = hash2(i * 3 + 1, 7);
    const s2 = hash2(i * 5 + 2, 11);
    const sp = 0.3 + s2 * 0.6;
    const x = (s * VIEW_W + t * 7 * sp) % VIEW_W;
    const y = (s2 * VIEW_H + Math.sin(t * 0.6 + i) * 6 + VIEW_H) % VIEW_H;
    const a = 0.03 + 0.045 * (0.5 + 0.5 * Math.sin(t * 2 + i * 2.3));
    fb.add(x, y, 0.5, 0.56, 0.8, a);
  }
}

export function vignetteFrame(_fb: Framebuffer) {
  /* handled in post */
}

export const smooth = smoothstep;
export const cl = clamp;
