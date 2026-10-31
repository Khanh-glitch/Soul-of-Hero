// ---------------------------------------------------------------------------
// ARCANA :: enemies — bodies that receive force.
// Physics (knockback, launch, bounce, slide, recover), 7-layer hit reaction,
// elemental statuses rendered on the sprite itself, and per-element deaths in
// which every sprite pixel becomes an analytic (scrub-safe) particle.
// ---------------------------------------------------------------------------

import { Framebuffer } from "./framebuffer";
import { RGB, R, clamp, lerp, hash2, vnoise, TAU, easeOut, easeIn, backOut } from "./math";
import { boltPath, line, glow, streak } from "./draw";
import { VIEW_W, VIEW_H } from "./arena";
import type { World, HitOpts, Element } from "./world";
import { ELEMENT_TINT } from "./world";

export type EnemyType = "husk" | "brute" | "crawler";
export type DeathKind = Element | "cut";

interface Sprite {
  rows: string[];
  w: number;
  h: number;
  pal: Record<string, RGB>;
  mass: number;
  hp: number;
}

function mirror(half: string[]): string[] {
  const shade: Record<string, string> = { "3": "2", "2": "1" };
  return half.map(
    (h) =>
      h +
      h
        .slice(0, h.length - 1)
        .split("")
        .reverse()
        .map((c) => shade[c] ?? c)
        .join("")
  );
}
function mk(half: string[], pal: Record<string, RGB>, mass: number, hp: number): Sprite {
  const rows = mirror(half);
  return { rows, w: Math.max(...rows.map((r) => r.length)), h: rows.length, pal, mass, hp };
}

const OUT: RGB = [0.006, 0.004, 0.01];
const SPR: Record<EnemyType, Sprite> = {
  brute: mk(
    [
      ".h........",
      ".hh...oooo",
      "..hhoo3333",
      "...ho33322",
      "...o3e2222",
      "..oo322222",
      ".o33o32222",
      "o332o32222",
      "o32oo32222",
      "o2o.o32222",
      ".oo.o32222",
      ".....o3222",
      "....o3221o",
      "....o221o.",
      "....o11o..",
      "....ooo...",
    ],
    { o: OUT, "1": [0.06, 0.075, 0.1], "2": [0.13, 0.15, 0.2], "3": [0.26, 0.28, 0.33], h: [0.6, 0.53, 0.42], e: [2.4, 0.45, 0.2] },
    2.6,
    260
  ),
  husk: mk(
    [
      "....ooo",
      "...o333",
      "..o3322",
      "..o3e22",
      "..o3222",
      "...o322",
      "..oo222",
      ".o3o222",
      "o32o222",
      "o2.o222",
      "...o221",
      "...o21o",
      "...o1o.",
      "...oo..",
    ],
    { o: OUT, "1": [0.1, 0.065, 0.09], "2": [0.19, 0.125, 0.16], "3": [0.32, 0.22, 0.25], h: [0.55, 0.47, 0.38], e: [2.4, 1.6, 0.3] },
    1.0,
    100
  ),
  crawler: mk(
    ["o..o..oo", ".o.o.o33", "..o.o333", "oo.o3e32", "..oo3222", ".o.o2222", "o...oooo"],
    { o: OUT, "1": [0.06, 0.1, 0.065], "2": [0.12, 0.19, 0.11], "3": [0.23, 0.32, 0.16], h: [0.5, 0.5, 0.38], e: [1.2, 2.4, 0.4] },
    0.7,
    70
  ),
};

export interface Enemy {
  id: number;
  type: EnemyType;
  spr: Sprite;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  hx: number;
  hy: number;
  hp: number;
  maxHp: number;
  lag: number;
  lagDelay: number;
  mass: number;
  flash: number;
  flashTint: RGB;
  sq: number;
  sqv: number;
  lean: number;
  stagger: number;
  burn: number;
  char: number;
  wet: number;
  freeze: number;
  shock: number;
  root: number;
  warp: number;
  spore: number;
  dead: boolean;
  deathT: number;
  kind: DeathKind;
  cutAng: number;
  kdx: number;
  kdy: number;
  hpShow: number;
  seed: number;
}

const FORMATION: [EnemyType, number, number][] = [
  ["brute", 228, 136],
  ["husk", 316, 90],
  ["crawler", 348, 165],
  ["husk", 272, 115],
  ["crawler", 190, 82],
  ["husk", 258, 194],
  ["crawler", 166, 166],
];

export function makeFormation(): Enemy[] {
  return FORMATION.map(([type, x, y], id) => {
    const spr = SPR[type];
    return {
      id,
      type,
      spr,
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      hx: x,
      hy: y,
      hp: spr.hp,
      maxHp: spr.hp,
      lag: spr.hp,
      lagDelay: 0,
      mass: spr.mass,
      flash: 0,
      flashTint: [1, 1, 1],
      sq: 0,
      sqv: 0,
      lean: 0,
      stagger: 0,
      burn: 0,
      char: 0,
      wet: 0,
      freeze: 0,
      shock: 0,
      root: 0,
      warp: 0,
      spore: 0,
      dead: false,
      deathT: 0,
      kind: "fire" as DeathKind,
      cutAng: 0,
      kdx: 0,
      kdy: 0,
      hpShow: 0,
      seed: id * 97 + 13,
    };
  });
}

// ---------------------------------------------------------------- helpers
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const dith = (x: number, y: number, a: number) => a > (B4[(((y | 0) & 3) << 2) | ((x | 0) & 3)] + 0.5) / 16;
const fireCol = (h: number): RGB => R("fire", Math.floor(clamp(h) * 9) / 9);
const voltCol = (h: number): RGB => R("volt", Math.floor(clamp(h) * 8) / 8);
const empty = (ch: string | undefined) => !ch || ch === " " || ch === ".";

// ---------------------------------------------------------------- simulation
export function updateEnemy(e: Enemy, dt: number, W: World) {
  if (e.dead) return;
  const s = e.spr;
  if (e.burn > 0) {
    e.hp -= e.burn * 10 * dt;
    e.lagDelay = Math.max(e.lagDelay, 0.2);
    e.char = Math.min(1, e.char + e.burn * dt * 0.45);
    e.burn = Math.max(0, e.burn - dt * 0.2);
    if (W.rand() < e.burn * 0.6)
      W.emit({ x: e.x + (W.rand() - 0.5) * s.w, y: e.y, z: s.h * W.rand(), vx: (W.rand() - 0.5) * 20, vy: -8 - W.rand() * 24, vz: 0, life: 0.5 + W.rand() * 0.8, kind: 0 });
  }
  e.wet = Math.max(0, e.wet - dt * 0.25);
  if (e.wet > 0.3 && W.rand() < 0.12)
    W.emit({ x: e.x + (W.rand() - 0.5) * s.w * 0.8, y: e.y, z: s.h * (0.3 + W.rand() * 0.6), vx: 0, vy: 0, vz: 0, life: 0.6, kind: 4 });
  e.freeze = Math.max(0, e.freeze - dt * 0.1);
  e.shock = Math.max(0, e.shock - dt * 0.8);
  if (e.shock > 0.3 && W.rand() < 0.3)
    W.emit({ x: e.x + (W.rand() - 0.5) * s.w, y: e.y, z: s.h * W.rand(), vx: (W.rand() - 0.5) * 140, vy: (W.rand() - 0.5) * 60, vz: 40, life: 0.2, kind: 2 });
  e.root = Math.max(0, e.root - dt * 0.16);
  e.warp = Math.max(0, e.warp - dt * 0.7);
  e.spore = Math.max(0, e.spore - dt * 0.08);
  if (e.spore > 0.2 && W.rand() < 0.15)
    W.emit({ x: e.x + (W.rand() - 0.5) * s.w, y: e.y, z: s.h * W.rand(), vx: (W.rand() - 0.5) * 10, vy: -6, vz: 0, life: 1.2, kind: 3 });
  e.flash -= dt;
  e.stagger -= dt;
  e.hpShow -= dt;
  if (e.lag > e.hp) {
    e.lagDelay -= dt;
    if (e.lagDelay <= 0) e.lag = Math.max(e.hp, e.lag - e.maxHp * dt * 0.9);
  }
  if (e.hp <= 0) {
    killEnemy(e, "fire", W);
    return;
  }

  const frozen = e.freeze > 0.5;
  if (e.z > 0 || e.vz > 0) {
    e.vz -= 560 * dt;
    e.z += e.vz * dt;
    if (e.z <= 0) {
      e.z = 0;
      if (e.vz < -110) {
        e.sq = -0.34 * Math.min(1, -e.vz / 320);
        e.sqv = 0;
        W.shake(0.035 * e.mass);
        for (let i = 0; i < 7; i++) {
          const a = W.rand() * TAU;
          W.emit({ x: e.x, y: e.y, z: 0, vx: Math.cos(a) * 50, vy: Math.sin(a) * 22, vz: 0, life: 0.6, kind: 1 });
        }
      }
      e.vz = e.vz < -170 ? -e.vz * 0.28 : 0;
    }
  }
  const grounded = e.z <= 0.01;
  const fr = grounded ? (frozen ? 1.1 : 6.5) : 0.5;
  e.vx *= Math.exp(-fr * dt);
  e.vy *= Math.exp(-fr * dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  if (e.x < 18 || e.x > VIEW_W - 18) {
    e.x = clamp(e.x, 18, VIEW_W - 18);
    e.vx *= -0.4;
    e.sq = -0.2;
  }
  if (e.y < 34 || e.y > VIEW_H - 6) {
    e.y = clamp(e.y, 34, VIEW_H - 6);
    e.vy *= -0.4;
    e.sq = -0.2;
  }
  const spd = Math.hypot(e.vx, e.vy);
  if (grounded && spd > 70 && W.rand() < 0.6)
    W.emit({ x: e.x, y: e.y, z: 0, vx: -e.vx * 0.2 + (W.rand() - 0.5) * 20, vy: -e.vy * 0.2, vz: 0, life: 0.5, kind: frozen ? 5 : 1 });
  if (!frozen) {
    e.sqv += (-260 * e.sq - 12 * e.sqv) * dt;
    e.sq += e.sqv * dt;
    const lt = clamp(e.vx * 0.005, -0.55, 0.55);
    e.lean += (lt - e.lean) * Math.min(1, dt * 10);
  }
  if (grounded && e.stagger <= 0 && !frozen && e.root < 0.3) {
    const dx = e.hx - e.x,
      dy = e.hy - e.y;
    const d = Math.hypot(dx, dy);
    if (d > 1.5 && spd < 20) {
      e.vx += (dx / d) * 60 * dt;
      e.vy += (dy / d) * 60 * dt;
    }
  }
}

export function damageEnemy(e: Enemy, o: HitOpts, W: World) {
  if (e.dead) return;
  const f = o.force ?? 0.4;
  let dmg = o.dmg ?? 8;
  let shatter = false;
  if (e.freeze > 0.55 && f > 0.45) {
    shatter = true;
    dmg *= 1.8;
    e.freeze = 0;
  }
  if (o.element === "volt" && e.wet > 0.3) dmg *= 1.5;
  if (o.element === "verdant" && e.spore > 0.3) {
    dmg += 40 * e.spore;
    for (let i = 0; i < 24; i++) {
      const a = W.rand() * TAU;
      W.emit({ x: e.x, y: e.y, z: e.spr.h * 0.5, vx: Math.cos(a) * 70, vy: Math.sin(a) * 40, vz: 0, life: 1.4, kind: 3 });
    }
    e.spore = 0;
  }
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  e.lagDelay = 0.4;
  e.hpShow = 2.4;
  W.popup(e.x + (W.rand() - 0.5) * 8, e.y - e.z - e.spr.h - 4, dmg, o.element, dmg >= 80);
  e.flash = 0.1;
  e.flashTint = ELEMENT_TINT[o.element];
  const hold = e.root > 0.4 ? 0.25 : 1;
  const kb = ((f * 240) / e.mass) * hold;
  e.vx += (o.dirx ?? 0) * kb;
  e.vy += (o.diry ?? 0) * kb * 0.7;
  const lift = (o.lift ?? f * 0.35) * hold;
  if (lift > 0) {
    e.vz += (lift * 230) / Math.sqrt(e.mass);
    if (e.z <= 0) e.z = 0.01;
  }
  e.sq = -0.38 * Math.min(1, f + 0.25);
  e.sqv = 0;
  e.stagger = Math.max(e.stagger, 0.25 + f * 0.6);
  e.lean = clamp(e.lean + (o.dirx ?? 0) * f * 0.8, -0.7, 0.7);
  const amt = o.status ?? 0.3 + f * 0.5;
  if (!shatter)
    switch (o.element) {
      case "fire":
        e.burn = Math.min(1.2, e.burn + amt);
        break;
      case "water":
        e.wet = 1;
        break;
      case "ice":
        e.freeze = Math.min(1, e.freeze + amt);
        break;
      case "volt":
        e.shock = Math.min(1, e.shock + amt);
        break;
      case "verdant":
        e.root = Math.min(1, e.root + amt * 0.8);
        break;
      case "astral":
        e.warp = Math.min(1, e.warp + amt);
        break;
    }
  if (e.hp <= 0) killEnemy(e, shatter ? "ice" : o.cut !== undefined ? "cut" : o.element, W, o);
}

export function killEnemy(e: Enemy, kind: DeathKind, W: World, o?: HitOpts) {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  e.deathT = W.simT;
  e.kind = kind;
  e.cutAng = o?.cut ?? 0;
  e.kdx = o?.dirx ?? 0;
  e.kdy = o?.diry ?? 0;
  W.freeze(0.05, W.stopDelay > 0 ? W.stopDelay : 0.03);
  W.shake(0.12);
  W.chroma = Math.max(W.chroma, 1.5);
}

// ---------------------------------------------------------------- sprite raster
interface DrawOpts {
  ox?: number;
  oy?: number;
  scaleX?: number;
  scaleY?: number;
  lean?: number;
  additive?: boolean;
  alpha?: number;
  rowShift?: (row: number) => number;
  tint?: (base: RGB, ch: string, col: number, row: number, X: number, Y: number) => RGB | null;
}

function drawSprite(fb: Framebuffer, e: Enemy, o: DrawOpts) {
  const s = e.spr;
  const sX = o.scaleX ?? 1,
    sY = o.scaleY ?? 1,
    ln = o.lean ?? 0;
  const fx0 = e.x + (o.ox ?? 0),
    fy0 = e.y - e.z + (o.oy ?? 0);
  const hh = Math.ceil(s.h * sY) + 2;
  const hw = Math.ceil((s.w * sX) / 2 + Math.abs(ln) * s.h * sY) + 3;
  const a = o.alpha ?? 1;
  for (let Y = Math.floor(fy0 - hh); Y <= Math.ceil(fy0); Y++) {
    if (Y < 0 || Y >= fb.H) continue;
    const ly = fy0 - (Y + 0.5);
    if (ly < 0) continue;
    const hy = ly / sY;
    const row = Math.floor(s.h - hy);
    if (row < 0 || row >= s.h) continue;
    const str = s.rows[row];
    const shift = o.rowShift ? o.rowShift(row) : 0;
    for (let X = Math.floor(fx0 - hw); X <= Math.ceil(fx0 + hw); X++) {
      if (X < 0 || X >= fb.W) continue;
      const lx = X + 0.5 - fx0;
      const col = Math.floor((lx - ln * hy * sY) / sX + s.w / 2 - shift);
      if (col < 0 || col >= str.length) continue;
      const ch = str[col];
      if (empty(ch)) continue;
      const base = s.pal[ch];
      if (!base) continue;
      const c = o.tint ? o.tint(base, ch, col, row, X, Y) : base;
      if (!c) continue;
      const i = (Y * fb.W + X) * 3;
      if (o.additive) {
        fb.buf[i] += c[0] * a;
        fb.buf[i + 1] += c[1] * a;
        fb.buf[i + 2] += c[2] * a;
      } else {
        fb.buf[i] = c[0];
        fb.buf[i + 1] = c[1];
        fb.buf[i + 2] = c[2];
      }
    }
  }
}

function eachPixel(e: Enemy, fn: (col: number, row: number, ch: string, base: RGB) => void) {
  const s = e.spr;
  for (let row = 0; row < s.h; row++) {
    const str = s.rows[row];
    for (let col = 0; col < str.length; col++) {
      const ch = str[col];
      if (empty(ch)) continue;
      const base = s.pal[ch];
      if (base) fn(col, row, ch, base);
    }
  }
}

function sampleLight(fb: Framebuffer, e: Enemy): RGB {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  const cx = e.x,
    cy = e.y - e.z - e.spr.h * 0.5;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    for (const rad of [7, 15, 24]) {
      const x = Math.round(cx + Math.cos(a) * rad),
        y = Math.round(cy + Math.sin(a) * rad * 0.8);
      if (x < 0 || y < 0 || x >= fb.W || y >= fb.H) continue;
      const i = (y * fb.W + x) * 3;
      r += Math.max(0, fb.buf[i] - fb.base[i]);
      g += Math.max(0, fb.buf[i + 1] - fb.base[i + 1]);
      b += Math.max(0, fb.buf[i + 2] - fb.base[i + 2]);
      n++;
    }
  }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}

// ---------------------------------------------------------------- render
export function renderEnemies(fb: Framebuffer, W: World) {
  const order = [...W.enemies].sort((a, b) => a.y - b.y);
  for (const e of order) if (e.dead) drawResidue(fb, e, W);
  for (const e of order) {
    if (e.dead) continue;
    const s = e.spr;
    const rx = s.w * 0.55 * (1 - Math.min(0.55, e.z / 70)),
      ry = rx / 2.6;
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++)
      for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
        const d = Math.hypot(x / rx, y / ry);
        if (d < 1) fb.mul(e.x + x, e.y + 1 + y, lerp(0.35, 1, d * d));
      }
  }
  const lights = new Map<number, RGB>();
  for (const e of order) if (!e.dead) lights.set(e.id, sampleLight(fb, e));
  for (const e of order) {
    if (e.dead) drawDeath(fb, e, W);
    else drawAlive(fb, e, W, lights.get(e.id)!);
  }
  drawFx(fb, W);
}

function drawAlive(fb: Framebuffer, e: Enemy, W: World, L: RGB) {
  const s = e.spr;
  const t = W.simT;
  const frame = Math.floor(W.clock * 30);
  const frozen = e.freeze > 0.5;
  const breathe = frozen ? 0 : Math.sin(t * 3 + e.seed) * 0.035;
  const air = e.z > 0 ? clamp(e.vz * 0.0012, -0.15, 0.25) : 0;
  const scaleY = 1 + e.sq + breathe + air;
  const scaleX = 1 - e.sq * 0.6 - breathe * 0.5 - air * 0.4;
  const jit = e.shock > 0.15 && hash2(frame, e.id) > 0.5 ? (hash2(frame, e.id + 9) > 0.5 ? 1 : -1) : 0;
  const xray = e.shock > 0.15 && hash2(frame * 3, e.id * 7) < e.shock * 0.45;
  const lit: RGB = [Math.min(9, 0.85 + L[0] * 5), Math.min(9, 0.85 + L[1] * 5), Math.min(9, 0.85 + L[2] * 5)];

  if (e.warp > 0.05) {
    const off = e.warp * (4 + 2 * Math.sin(t * 9));
    drawSprite(fb, e, { ox: -off, scaleX, scaleY, lean: e.lean, additive: true, alpha: e.warp * 0.8, tint: () => [0.9, 0.05, 0.35] });
    drawSprite(fb, e, { ox: off, oy: -1, scaleX, scaleY, lean: e.lean, additive: true, alpha: e.warp * 0.8, tint: () => [0.15, 0.35, 1.2] });
  }
  const rowShift =
    e.warp > 0.1 ? (row: number) => (hash2(row + frame * 13, e.id) > 0.8 ? Math.round((hash2(row, frame) - 0.5) * e.warp * 8) : 0) : undefined;

  drawSprite(fb, e, {
    ox: jit,
    scaleX,
    scaleY,
    lean: e.lean,
    rowShift,
    tint: (base, ch, col, row, X, Y) => {
      const i = (Y * fb.W + X) * 3;
      const fr = Math.max(0, fb.buf[i] - fb.base[i]) * 0.4,
        fg = Math.max(0, fb.buf[i + 1] - fb.base[i + 1]) * 0.4,
        fbb = Math.max(0, fb.buf[i + 2] - fb.base[i + 2]) * 0.4;
      if (e.flash > 0) {
        if (e.flash > 0.05) return [1.5, 1.5, 1.5];
        return [e.flashTint[0] * 0.8, e.flashTint[1] * 0.8, e.flashTint[2] * 0.8];
      }
      if (xray) {
        if (ch === "o") return [1.0, 1.3, 2.9];
        if (ch === "e") return [3, 3, 3];
        return [0.02, 0.02, 0.06];
      }
      let r = base[0],
        g = base[1],
        b = base[2];
      if (ch === "e") {
        const k = frozen ? 0.25 : 1;
        return [r * k + fr, g * k + fg, b * k + fbb];
      }
      if (e.char > 0) {
        const k = 1 - e.char * 0.85;
        r *= k;
        g *= k;
        b *= k;
      }
      if (e.wet > 0) {
        r *= 1 - e.wet * 0.3;
        g *= 1 - e.wet * 0.12;
        b += e.wet * 0.03;
      }
      if (e.freeze > 0) {
        const f = Math.min(1, e.freeze) * 0.8;
        const lightness = ch === "o" ? 0.05 : ch === "3" ? 0.42 : ch === "2" ? 0.3 : 0.2;
        r = lerp(r, lightness * 0.55, f);
        g = lerp(g, lightness * 0.85, f);
        b = lerp(b, lightness * 1.3, f);
      }
      r *= lit[0];
      g *= lit[1];
      b *= lit[2];
      const above = row > 0 ? s.rows[row - 1][col] : undefined;
      if (empty(above)) {
        r += 0.06;
        g += 0.07;
        b += 0.11;
      }
      if (ch === "o") {
        r += L[0] * 1.4;
        g += L[1] * 1.4;
        b += L[2] * 1.4;
      }
      if (e.burn > 0.05 && hash2(col * 3 + e.seed, row * 5) > 0.76) {
        const c = fireCol(e.burn * (0.45 + 0.4 * Math.sin(t * 9 + col + row)));
        r += c[0] * 0.6;
        g += c[1] * 0.6;
        b += c[2] * 0.6;
      }
      if (e.spore > 0.05 && hash2(col + e.seed, row * 3) > 0.84) {
        const k = e.spore * (0.5 + 0.5 * Math.sin(t * 4 + col));
        r += 0.2 * k;
        g += 0.9 * k;
        b += 0.6 * k;
      }
      return [r + fr, g + fg, b + fbb];
    },
  });

  const fy0 = e.y - e.z;
  // --- burn: tongues of flame rising from the silhouette's top edge
  if (e.burn > 0.05) {
    for (let col = 0; col < s.w; col++) {
      let top = -1;
      for (let r = 0; r < s.h; r++)
        if (!empty(s.rows[r][col])) {
          top = r;
          break;
        }
      if (top < 0) continue;
      const hy = s.h - top;
      const X = e.x + (col - s.w / 2 + 0.5) * scaleX + e.lean * hy * scaleY + jit;
      const Y = fy0 - hy * scaleY;
      const Lf = Math.min(1.2, e.burn) * (2 + 6 * vnoise(col * 0.6 + e.seed, t * 7));
      for (let k = 0; k < Lf; k++) {
        const u = k / Lf;
        const c = fireCol((1 - u) * Math.min(1, e.burn) * 0.95 + 0.05);
        fb.add(X + Math.sin(t * 11 + col + k * 0.7) * u * 1.3, Y - k, c[0], c[1], c[2], 0.85 * (1 - u * 0.4));
      }
    }
    glow(fb, e.x, fy0 - s.h * 0.5, s.w, [1.2, 0.4, 0.1], 0.12 * Math.min(1, e.burn));
  }
  // --- root: vines wrapping the body
  if (e.root > 0.08) {
    for (let v = 0; v < 2; v++) {
      const baseRow = s.h * (0.5 + v * 0.3);
      const reach = clamp(e.root * 1.5);
      for (let x = -s.w / 2; x <= s.w / 2; x += 0.5) {
        if ((x + s.w / 2) / s.w > reach) break;
        const Y = fy0 - (s.h - baseRow) * scaleY + Math.sin(x * 0.9 + e.seed + v * 2) * 1.6;
        const X = e.x + x * scaleX + jit;
        fb.blend(X, Y, 0.07, 0.3 + 0.1 * v, 0.08, 1);
        if (Math.abs((x * 2) % 6) < 0.5) {
          fb.add(X, Y - 1, 0.3, 0.6, 0.25, 0.8);
          fb.add(X + 1, Y - 2, 0.25, 0.7, 0.25, 0.6 * e.root);
        }
      }
    }
  }
  // --- freeze: a crystalline shell
  if (e.freeze > 0.3) {
    const k = clamp((e.freeze - 0.3) / 0.35);
    const cx = e.x,
      cy = fy0 - s.h * 0.5,
      rx = s.w * 0.62 + 2,
      ry = s.h * 0.62 + 2;
    const sides = 7;
    for (let Y = Math.floor(cy - ry - 1); Y <= Math.ceil(cy + ry + 1); Y++)
      for (let X = Math.floor(cx - rx - 1); X <= Math.ceil(cx + rx + 1); X++) {
        const dx = (X + 0.5 - cx) / rx,
          dy = (Y + 0.5 - cy) / ry;
        const a = Math.atan2(dy, dx) + Math.PI;
        const st = TAU / sides;
        const si = Math.floor(a / st) % sides;
        const fr = a / st - Math.floor(a / st);
        const rad = lerp(0.82 + hash2(e.seed, si) * 0.3, 0.82 + hash2(e.seed, (si + 1) % sides) * 0.3, fr);
        const d = Math.hypot(dx, dy);
        if (d > rad) continue;
        const shade = 0.5 + 0.5 * hash2(si, e.seed + 3);
        if (rad - d < 0.1) fb.add(X, Y, 0.55 * k, 0.85 * k, 1.25 * k, 1);
        else fb.add(X, Y, 0.035 * k * shade, 0.07 * k * shade, 0.12 * k * shade, 1);
      }
    const gl = (W.clock * 0.7 + e.seed) % 1;
    fb.add(cx - rx * 0.4 + gl * rx * 0.8, cy - ry * 0.5 + gl * ry * 0.4, 2, 2.4, 2.8, 0.6 * k);
  }
  // --- shock: arcs running over the body
  if (e.shock > 0.2 && hash2(frame, e.id * 3) > 0.4) {
    const r1 = hash2(frame, e.id + 1),
      r2 = hash2(frame + 7, e.id + 2);
    const x0 = e.x + (r1 - 0.5) * s.w,
      y0 = fy0 - s.h * (0.2 + 0.6 * r2);
    const x1 = e.x + (r2 - 0.5) * s.w,
      y1 = fy0 - s.h * (0.2 + 0.6 * r1);
    const pts = boltPath(x0, y0, x1, y1, 5, frame * 31 + e.id, 3);
    for (let i = 0; i < pts.length - 1; i++) line(fb, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, [1.6, 1.9, 3.2], e.shock);
  }
}

// ---------------------------------------------------------------- deaths
function drawDeath(fb: Framebuffer, e: Enemy, W: World) {
  const age = W.simT - e.deathT;
  const s = e.spr;
  const fy0 = e.y - e.z;
  const ox = e.x - s.w / 2,
    oy = fy0 - s.h;
  const frame = Math.floor(W.clock * 30);
  switch (e.kind) {
    case "fire": {
      const D = 1.5,
        u = age / D;
      if (u > 1.7) return;
      if (u < 1) glow(fb, e.x, fy0 - s.h * 0.5, s.w * 1.1, [1.4, 0.5, 0.12], 0.45 * (1 - u));
      eachPixel(e, (col, row, _ch, base) => {
        const thr = (row / s.h) * 0.45 + hash2(col * 3 + e.seed, row * 7) * 0.5;
        const local = u * 1.3 - thr;
        const px = ox + col,
          py = oy + row;
        if (local < 0) {
          const k = clamp(u * 2.4);
          let r = base[0] * (1 - k * 0.92),
            g = base[1] * (1 - k * 0.92),
            b = base[2] * (1 - k * 0.92);
          if (local > -0.1) {
            const fc = fireCol(0.45 + (1 + local / 0.1) * 0.55);
            r += fc[0];
            g += fc[1];
            b += fc[2];
          }
          fb.blend(px, py, r, g, b, 1);
        } else {
          const a = local * D;
          if (a > 1.0) return;
          const hx = hash2(col + e.seed * 3, row) - 0.5;
          const qx = px + hx * 16 * a + Math.sin(a * 5 + col) * 1.5 + e.kdx * a * 14;
          const qy = py - a * 14 - a * a * 12;
          const heat = 0.8 - a * 1.8;
          const c: RGB = heat > 0.1 ? fireCol(heat) : [0.08, 0.065, 0.065];
          if (dith(qx, qy, 1 - a)) fb.add(qx, qy, c[0], c[1], c[2], 1);
        }
      });
      return;
    }
    case "water": {
      if (age < 0.13) {
        const k = age / 0.13;
        drawSprite(fb, e, { scaleX: 1 + 0.5 * k, scaleY: 1 - 0.45 * k, tint: (b) => [b[0] * 0.6 + 0.1 * k, b[1] * 0.7 + 0.3 * k, b[2] + 0.7 * k] });
        return;
      }
      const a = age - 0.13;
      if (a > 1.3) return;
      eachPixel(e, (col, row) => {
        const hx = hash2(col + e.seed, row * 3) - 0.5,
          hy = hash2(col * 5, row + e.seed) - 0.5;
        const lx = col - s.w / 2,
          lz = (s.h - row) * 0.55;
        const vx = lx * 9 + hx * 60 + e.kdx * 50,
          vy = hy * 40 + e.kdy * 30,
          vz = 40 + hash2(row, col + e.seed) * 120;
        const tl = (vz + Math.sqrt(vz * vz + 1200 * lz)) / 600;
        const aa = Math.min(a, tl);
        const z = Math.max(0, lz + vz * aa - 300 * aa * aa);
        const qx = e.x + lx * 1.45 + vx * aa,
          qy = e.y + vy * aa * 0.6 - z;
        const br = 0.6 + 0.4 * hx;
        if (dith(qx, qy, 1 - a / 1.3)) fb.add(qx, qy, 0.32 * br, 0.75 * br, 1.5 * br, 1);
      });
      return;
    }
    case "ice": {
      if (age < 0.06) {
        drawSprite(fb, e, { tint: () => [1.8, 2.3, 2.8] });
        return;
      }
      const a = age - 0.06;
      if (a > 2.4) return;
      const N = 6;
      const sx: number[] = [],
        sy: number[] = [];
      for (let k = 0; k < N; k++) {
        sx.push(hash2(e.seed, k) * s.w);
        sy.push(hash2(k, e.seed) * s.h);
      }
      const melt = 1 - clamp((a - 1.3) / 1.1);
      eachPixel(e, (col, row, ch, base) => {
        let k = 0,
          bd = 1e9;
        for (let j = 0; j < N; j++) {
          const d = (col - sx[j]) ** 2 + (row - sy[j]) ** 2;
          if (d < bd) {
            bd = d;
            k = j;
          }
        }
        let dx = sx[k] - s.w / 2,
          dy = sy[k] - s.h / 2;
        const dl = Math.hypot(dx, dy) || 1;
        dx /= dl;
        dy /= dl;
        const sp = 45 + hash2(k, 3) * 70;
        const vx = dx * sp + e.kdx * 70,
          vy = dy * sp * 0.4 + e.kdy * 40;
        const vz = 50 + hash2(k, 5 + e.seed) * 110,
          z0 = s.h - sy[k];
        const tl = (vz + Math.sqrt(vz * vz + 1400 * z0)) / 700;
        const aa = Math.min(a, tl);
        const z = Math.max(0, z0 + vz * aa - 350 * aa * aa);
        const ang = (hash2(k, 7) - 0.5) * 12 * aa;
        const rx = col - sx[k],
          ry = row - sy[k];
        const qx = e.x + (sx[k] - s.w / 2) + vx * aa + rx * Math.cos(ang) - ry * Math.sin(ang);
        const qy = e.y + vy * aa - z + rx * Math.sin(ang) + ry * Math.cos(ang);
        if (!dith(qx, qy, melt)) return;
        const lum = ch === "o" ? 0.12 : base[0] + base[1] + base[2];
        let c: RGB = [0.18 + lum * 0.6, 0.32 + lum * 0.9, 0.55 + lum * 1.3];
        if (hash2(k, Math.floor(W.clock * 12)) > 0.86) c = [1.4, 1.9, 2.5];
        fb.blend(qx, qy, c[0], c[1], c[2], 1);
      });
      return;
    }
    case "volt": {
      if (age < 0.12) {
        drawSprite(fb, e, { tint: (_b, ch) => (ch === "o" ? [1.4, 1.7, 3.2] : ch === "e" ? [3, 3, 3] : [0.02, 0.02, 0.07]) });
        glow(fb, e.x, fy0 - s.h * 0.5, s.w * 1.4, [0.6, 0.8, 2], 0.8);
        return;
      }
      const a = age - 0.12;
      if (a > 0.9) return;
      eachPixel(e, (col, row, ch, base) => {
        const thr = (row / s.h) * 0.35 + hash2(col, row + e.seed) * 0.25;
        const rel = a * 1.6 - thr;
        const px = ox + col,
          py = oy + row;
        if (rel < 0) {
          const xr = hash2(frame, row + e.id) > 0.6;
          const c: RGB = xr ? (ch === "o" ? [1.2, 1.5, 3] : [0.02, 0.02, 0.06]) : [base[0] * 1.6, base[1] * 1.6, base[2] * 2];
          fb.blend(px, py, c[0], c[1], c[2], 1);
        } else {
          if (rel > 0.4) return;
          const dir = hash2(row, e.seed) > 0.5 ? 1 : -1;
          const qx = px + dir * (rel * 260 + hash2(col, row) * 20);
          const len = 2 + rel * 12;
          const c = voltCol(0.95 - rel * 1.2);
          for (let k = 0; k < len; k++) {
            const f = (1 - k / len) * (1 - rel / 0.4);
            fb.add(qx - dir * k, py, c[0] * f, c[1] * f, c[2] * f, 1);
          }
        }
      });
      return;
    }
    case "verdant": {
      const D = 1.7,
        u = age / D;
      if (u > 1) return;
      const sink = easeIn(u, 2.2) * s.h;
      const k = clamp(age * 1.6);
      eachPixel(e, (col, row, _ch, base) => {
        const py = oy + row + sink;
        if (py > e.y + 0.5) return;
        let r = lerp(base[0], 0.06, k),
          g = lerp(base[1], 0.26, k),
          b = lerp(base[2], 0.07, k);
        if (hash2(col + e.seed, row) > 0.82) {
          g += 0.35 * k * (0.5 + 0.5 * Math.sin(age * 8 + col));
          r += 0.1 * k;
        }
        fb.blend(ox + col, py, r, g, b, 1);
      });
      return;
    }
    case "astral": {
      const yy = fy0 - 2;
      if (age < 0.2) {
        const rs = (row: number) => (hash2(row + frame * 7, e.id) > 0.5 ? Math.round((hash2(row, frame) - 0.5) * 14) : 0);
        drawSprite(fb, e, { ox: -3, additive: true, alpha: 0.9, rowShift: rs, tint: () => [1.0, 0.05, 0.4] });
        drawSprite(fb, e, { ox: 3, additive: true, alpha: 0.9, rowShift: rs, tint: () => [0.15, 0.4, 1.3] });
        drawSprite(fb, e, { rowShift: rs, tint: (b) => [b[0] + 0.5, b[1] + 0.3, b[2] + 0.8] });
        return;
      }
      if (age < 0.42) {
        const k = (age - 0.2) / 0.22;
        drawSprite(fb, e, {
          scaleX: lerp(1, 1.9, k),
          scaleY: lerp(1, 0.07, easeIn(k, 2)),
          tint: (b) => [b[0] + 1.4 * k, b[1] + 0.8 * k, b[2] + 2 * k],
        });
        return;
      }
      if (age < 0.58) {
        const k = (age - 0.42) / 0.16;
        const L = lerp(s.w * 0.95, 0, easeIn(k, 2));
        for (let x = -L; x <= L; x++) fb.add(e.x + x, yy, 2.4, 1.6, 3, 1);
        glow(fb, e.x, yy, 6, [1.4, 0.8, 2.2], 0.6);
        return;
      }
      if (age < 0.8) {
        const k = (age - 0.58) / 0.22;
        glow(fb, e.x, yy, 4 * (1 - k) + 1, [2, 1.3, 2.8], 1.6 * (1 - k));
        for (let d = 1; d < 7 * (1 - k); d++) {
          fb.add(e.x + d, yy, 1.5, 1, 2, 1 - k);
          fb.add(e.x - d, yy, 1.5, 1, 2, 1 - k);
          fb.add(e.x, yy + d * 0.6, 1.5, 1, 2, 1 - k);
          fb.add(e.x, yy - d * 0.6, 1.5, 1, 2, 1 - k);
        }
      }
      return;
    }
    case "cut": {
      const a = age;
      if (a > 1.7) return;
      const ca = Math.cos(e.cutAng),
        sa = Math.sin(e.cutAng);
      const sep = easeOut(clamp(a / 0.55), 3);
      eachPixel(e, (col, row, _ch, base) => {
        const lx = col - s.w / 2 + 0.5,
          ly = row - s.h * 0.55;
        const dist = -lx * sa + ly * ca;
        const side = dist >= 0 ? 1 : -1;
        const slide = side * sep * 7;
        let qx = ox + col + ca * slide - sa * side * sep * 2;
        let qy = oy + row + sa * slide + ca * side * sep * 2 + (side > 0 ? sep * 2 : 0);
        const local = (a - 0.6) / 0.9 - hash2(col + e.seed, row) * 0.8;
        if (local > 0) {
          if (local > 0.35) return;
          qy -= local * 24;
          qx += (hash2(row, col) - 0.5) * local * 20;
          if (dith(qx, qy, 1 - local / 0.35)) fb.add(qx, qy, 0.5, 0.18, 0.06, 1);
          return;
        }
        const ch = clamp(a * 1.4);
        let r = base[0] * (1 - ch * 0.8),
          g = base[1] * (1 - ch * 0.8),
          b = base[2] * (1 - ch * 0.8);
        if (Math.abs(dist) < 1.4) {
          const fc = fireCol(1 - a * 0.7);
          r += fc[0];
          g += fc[1];
          b += fc[2];
        }
        fb.blend(qx, qy, r, g, b, 1);
      });
      return;
    }
  }
}

/** what remains on the floor: the closing detail of every kill */
function drawResidue(fb: Framebuffer, e: Enemy, W: World) {
  const age = W.simT - e.deathT;
  const t = W.simT;
  const ellipse = (rx: number, ry: number, m: number) => {
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++)
      for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
        const d = Math.hypot(x / rx, y / ry);
        if (d < 1) fb.mul(e.x + x, e.y + y, lerp(m, 1, d * d));
      }
  };
  switch (e.kind) {
    case "fire":
    case "cut": {
      if (age < 0.7) return;
      const k = clamp((age - 0.7) * 2);
      ellipse(7, 2.6, lerp(1, 0.45, k));
      for (let i = 0; i < 16; i++) {
        const x = e.x + (hash2(i, e.seed) - 0.5) * 12,
          y = e.y + (hash2(e.seed, i) - 0.5) * 4;
        fb.add(x, y, 0.07, 0.06, 0.06, k);
        const fl = vnoise(i * 3.1, t * 2.5);
        if (fl > 0.6) {
          const c = fireCol((fl - 0.6) * 1.6 * Math.max(0, 1 - (age - 0.7) / 6));
          fb.add(x, y, c[0], c[1], c[2], 1);
        }
      }
      return;
    }
    case "water": {
      const k = clamp(age * 3) * Math.max(0, 1 - age / 5);
      ellipse(9, 3.4, lerp(1, 0.6, k));
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        fb.add(e.x + Math.cos(a) * 9, e.y + Math.sin(a) * 3.4, 0.05, 0.12, 0.22, k * 0.8);
      }
      return;
    }
    case "ice": {
      if (age < 0.6) return;
      const k = Math.max(0, 1 - (age - 0.6) / 3.5);
      for (let i = 0; i < 12; i++) {
        const x = e.x + (hash2(i, e.seed + 1) - 0.5) * 34,
          y = e.y + (hash2(e.seed + 1, i) - 0.5) * 12;
        if (dith(x, y, k)) fb.add(x, y, 0.35, 0.6, 0.95, 1);
      }
      return;
    }
    case "volt": {
      const k = Math.max(0, 1 - age / 5);
      ellipse(8, 3, lerp(1, 0.5, k));
      if (age < 3 && hash2(Math.floor(W.clock * 20), e.id) > 0.7) {
        const a = hash2(Math.floor(W.clock * 20), 3) * TAU;
        streak(fb, e.x, e.y, e.x + Math.cos(a) * 5, e.y + Math.sin(a) * 2, 0.8, 0.3, [0.8, 1.1, 2.6], k);
      }
      return;
    }
    case "verdant": {
      for (let i = 0; i < 6; i++) {
        const g = backOut(clamp((age - 0.6 - i * 0.12) * 2.2), 2.4);
        if (g <= 0) continue;
        const x = e.x + (hash2(i, e.seed) - 0.5) * 14,
          y = e.y + (hash2(e.seed, i) - 0.5) * 4;
        const hgt = (3 + hash2(i, 9) * 4) * g;
        for (let k = 0; k < hgt; k++) fb.blend(x + Math.sin(t * 2 + i) * k * 0.08, y - k, 0.05, 0.25, 0.06, 1);
        const fx = x + Math.sin(t * 2 + i) * hgt * 0.08,
          fy = y - hgt;
        const pc: RGB = i % 2 ? [1.6, 0.55, 0.9] : [1.8, 1.4, 0.45];
        for (const [dx, dy] of [
          [0, -1],
          [1, 0],
          [-1, 0],
          [0, 1],
        ])
          fb.blend(fx + dx * g, fy + dy * g, pc[0] * 0.5, pc[1] * 0.5, pc[2] * 0.5, 1);
        fb.add(fx, fy, 2, 1.8, 0.8, 1);
      }
      return;
    }
    case "astral": {
      if (age < 0.8 || age > 1.9) return;
      if (hash2(Math.floor(W.clock * 15), e.id) < 0.25) return;
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++) {
          const sx = clamp(Math.round(e.x + x + 9), 0, fb.W - 1),
            sy = clamp(Math.round(e.y + y - 14), 0, fb.H - 1);
          const i = (sy * fb.W + sx) * 3;
          const dx = Math.round(e.x - 2 + x),
            dy = Math.round(e.y - 4 + y);
          fb.blend(dx, dy, fb.bg[i] * 1.6 + 0.04, fb.bg[i + 1] * 1.3, fb.bg[i + 2] * 1.9 + 0.06, 1);
        }
      return;
    }
  }
}

// ---------------------------------------------------------------- world fx
function drawFx(fb: Framebuffer, W: World) {
  for (const p of W.fx) {
    const l = p.life / p.max;
    const x = p.x,
      y = p.y - p.z;
    switch (p.kind) {
      case 0: {
        const c = fireCol(l * 0.9);
        fb.add(x, y, c[0], c[1], c[2], 1);
        break;
      }
      case 1:
        if (dith(x, y, l * 0.8)) fb.add(x, y, 0.07, 0.065, 0.075, 1);
        break;
      case 2: {
        const c = voltCol(0.6 + l * 0.4);
        fb.add(x, y, c[0], c[1], c[2], l);
        break;
      }
      case 3: {
        const tw = 0.5 + 0.5 * Math.sin(W.clock * 9 + p.seed);
        fb.add(x, y, 0.25 * tw, 1.0 * tw, 0.7 * tw, l);
        break;
      }
      case 4:
        fb.add(x, y, 0.3, 0.7, 1.4, l);
        break;
      case 5:
        fb.add(x, y, 0.8, 1.2, 1.7, l);
        break;
    }
  }
  for (const z of W.zaps) {
    const k = z.life / z.max;
    const d = Math.hypot(z.x1 - z.x0, z.y1 - z.y0);
    const pts = boltPath(z.x0, z.y0, z.x1, z.y1, d * 0.3, z.seed * 131 + Math.floor(W.clock * 30) * 7, 4);
    for (let i = 0; i < pts.length - 1; i++) {
      streak(fb, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 1.4, 1.4, [z.tint[0] * 0.4, z.tint[1] * 0.4, z.tint[2] * 0.4], k);
      line(fb, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, [2.6, 2.8, 3.2], k);
    }
  }
}

// ---------------------------------------------------------------- UI layer
const DIG = [
  "111101101101111",
  "010110010010111",
  "111001111100111",
  "111001111001111",
  "101101111001001",
  "111100111001111",
  "111100111101111",
  "111001001010010",
  "111101111101111",
  "111101111001111",
];

function drawNum(fb: Framebuffer, x: number, y: number, val: number, col: RGB, scale: number, alpha: number) {
  const str = String(val);
  const w = str.length * 4 * scale - scale;
  const x0 = Math.round(x - w / 2),
    y0 = Math.round(y);
  for (let pass = 0; pass < 2; pass++)
    for (let d = 0; d < str.length; d++) {
      const g = DIG[str.charCodeAt(d) - 48];
      if (!g) continue;
      for (let py = 0; py < 5; py++)
        for (let px = 0; px < 3; px++) {
          if (g[py * 3 + px] !== "1") continue;
          for (let sy = 0; sy < scale; sy++)
            for (let sx = 0; sx < scale; sx++) {
              const X = x0 + d * 4 * scale + px * scale + sx,
                Y = y0 + py * scale + sy;
              if (!dith(X, Y, alpha)) continue;
              if (pass === 0) {
                for (const [ox, oy] of [
                  [1, 0],
                  [-1, 0],
                  [0, 1],
                  [0, -1],
                  [1, 1],
                ])
                  fb.blend(X + ox, Y + oy, 0.005, 0.004, 0.01, 1);
              } else fb.blend(X, Y, col[0], col[1], col[2], 1);
            }
        }
    }
}

export function renderOverlay(fb: Framebuffer, W: World) {
  for (const e of W.enemies) {
    if (e.dead || e.hpShow <= 0) continue;
    const s = e.spr;
    const w = e.type === "brute" ? 22 : 14;
    const y = Math.round(e.y - e.z - s.h * (1 + e.sq) - 5);
    const x0 = Math.round(e.x - w / 2);
    const a = clamp(e.hpShow / 0.5);
    for (let x = -1; x <= w; x++)
      for (let yy = -1; yy <= 1; yy++) if (dith(x0 + x, y + yy, a)) fb.blend(x0 + x, y + yy, 0.008, 0.005, 0.012, 1);
    const hpW = Math.round((Math.max(0, e.hp) / e.maxHp) * w);
    const lagW = Math.round((Math.max(0, e.lag) / e.maxHp) * w);
    for (let x = 0; x < lagW; x++) if (dith(x0 + x, y, a)) fb.blend(x0 + x, y, x < hpW ? 0.75 : 0.7, x < hpW ? 0.1 : 0.6, x < hpW ? 0.08 : 0.5, 1);
  }
  for (const p of W.popups) {
    const a = p.age;
    const rise = easeOut(Math.min(1, a / 0.22), 3) * 10 + a * 6;
    const scale = p.big ? 2 : 1;
    const m = Math.max(p.col[0], p.col[1], p.col[2]);
    // kept under the bloom threshold so the UI layer stays crisp
    const col: RGB = a < 0.08 ? [0.62, 0.62, 0.62] : [(p.col[0] / m) * 0.55 + 0.18, (p.col[1] / m) * 0.55 + 0.18, (p.col[2] / m) * 0.55 + 0.18];
    drawNum(fb, p.x, p.y - rise, p.val, col, scale, 1 - clamp((a - 0.6) / 0.4));
  }
}
