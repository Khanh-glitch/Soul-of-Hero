/**
 * VEYRA Living World layer — world-owned motion, light and material behaviour.
 * Everything here is driven by a cause in the world (wind field, sun angle, water body type,
 * lava flow, heat, light sources and walls) and is culled to the camera view.
 * Rendering only: never mutates game state.
 */
import { WW, WH, VIEW_W, VIEW_H, T, type RunState } from '../../game/core';
import { effTile, dayTime } from '../../game/engine';
import { getWorld } from '../../game/world';
import { mk, type Sprite } from '../../game/art';
import { activeFloor } from '../floors';
import { getWindowWorld } from '../window';
import { h2, vn, fbm2, bayer, MAT, EMISSIVE } from './hpaint';
import { type TreeArt } from './flora';

type G = CanvasRenderingContext2D;
const isWater = (t: number) => t === T.DEEP || t === T.SHALLOW || t === T.RIVER;
const isWall = (t: number) => t === T.PWALL || t === T.CLIFF;

// ───────────────────────── wind & sun ─────────────────────────
/** Prevailing westerly with travelling gust fronts (world-space waves) — trees downwind bend a moment later. */
export function wind(x: number, y: number, t: number) {
  const base = 0.32 + 0.18 * Math.sin(t / 23000) + 0.08 * Math.sin(t / 7100);
  const front = Math.sin((x * 0.0035 + y * 0.0012) - t * 0.0011) ;
  const gust = Math.pow(Math.max(0, front), 6) * (0.75 + 0.25 * Math.sin(t / 13000 + 1));
  return base + gust + (vn(x * 0.02, t * 0.0007, 3) - 0.5) * 0.15;
}
export interface Sun { kx: number; ky: number; alpha: number; warm: number }
export function sun(r: RunState, now: number): Sun {
  const t = dayTime(r, now); const off = t - 0.5; const up = Math.cos(off * Math.PI * 2);
  return { kx: Math.max(-1.6, Math.min(0.9, -(0.35 + off * 3))), ky: Math.min(1.1, 0.42 + Math.abs(off) * 1.4), alpha: Math.max(0, Math.min(0.3, (up + 0.15) * 0.3)), warm: Math.max(0, 1 - Math.abs(Math.abs(off) - 0.2) * 8) };
}

// ───────────────────────── frame state ─────────────────────────
let F = { time: 0, dt: 16, cx: 0, cy: 0, sun: { kx: -0.4, ky: 0.5, alpha: 0.25, warm: 0 } as Sun, px: 0, py: 0, pmoving: false, floor: 0 };
const canopies: { x: number; y: number; ground: number; sp: string }[] = [];
const lavaInView: number[] = []; const snowInView: number[] = []; const ashInView: number[] = [];
let lastPX = 0, lastPY = 0;
export function beginFrame(r: RunState, now: number, time: number, cx: number, cy: number, dt: number) {
  F.time = time; F.dt = Math.min(50, dt); F.cx = cx; F.cy = cy; F.sun = sun(r, now); F.floor = activeFloor(r);
  const p = r.player; F.pmoving = Math.hypot(p.x - lastPX, p.y - lastPY) > 0.2; lastPX = p.x; lastPY = p.y; F.px = p.x; F.py = p.y;
  canopies.length = 0; sceneLights.length = 0; lavaInView.length = 0; snowInView.length = 0; ashInView.length = 0;
}
export function resetLife() { waterKind.clear(); elderCells = null; elderTileCache.clear(); }

// ───────────────────────── wind-bent trees + cast shadows ─────────────────────────
const bentCache = new Map<Sprite, Map<number, Sprite>>();
function bent(spr: Sprite, trunkTop: number, k: number, droop: boolean): Sprite {
  let m = bentCache.get(spr); if (!m) { m = new Map(); bentCache.set(spr, m); }
  let b = m.get(k); if (b) return b;
  b = mk(spr.width + 8, spr.height, g => { for (let y = 0; y < spr.height; y++) { const t = droop ? Math.min(1, Math.max(0, (y - trunkTop * 0.4) / (spr.height - trunkTop * 0.4))) : Math.max(0, (trunkTop - y) / trunkTop); const off = Math.round(k * Math.pow(t, droop ? 1.2 : 1.4)); g.drawImage(spr, 0, y, spr.width, 1, 3 + off, y, spr.width, 1); } }, null);
  m.set(k, b); return b;
}
const silCache = new WeakMap<Sprite, Sprite>();
function silhouette(s: Sprite) { let o = silCache.get(s); if (!o) { o = mk(s.width, s.height, g => { g.drawImage(s, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#0a0814'; g.fillRect(0, 0, s.width, s.height); }, null); silCache.set(s, o); } return o; }
/** Sun-cast silhouette: anchored at the object's base, skewed by sun azimuth and flattened by elevation. */
export function castShadow(g: G, spr: Sprite, baseX: number, baseY: number, ax: number, scale = 1) {
  const s = F.sun; if (s.alpha <= 0.01 || F.floor < 0) return;
  g.save(); g.globalAlpha = s.alpha * scale; g.translate(Math.round(baseX), Math.round(baseY)); g.transform(1, 0, s.kx * 0.9, s.ky, 0, 0);
  g.drawImage(silhouette(spr), -ax, -spr.height); g.restore();
}
/** Draw a tree whose canopy responds to the local wind; its shadow sways with it (dappled light through canopy gaps). */
export function drawLivingTree(g: G, art: TreeArt, baseX: number, baseY: number, seed: number, alpha: number, burning: boolean) {
  const w = wind(baseX, baseY, F.time);
  const flutter = Math.sin(F.time / (260 + art.stiff * 140) + seed) * (0.6 / art.stiff);
  const k = Math.max(-2, Math.min(5, Math.round((w * 2.6) / art.stiff + flutter)));
  const spr = bent(art.spr, art.trunkTop, k, art.species === 'willow');
  castShadow(g, spr, baseX, baseY, (spr.width >> 1), 1);
  if (alpha < 1) g.globalAlpha = alpha; g.drawImage(spr, Math.round(baseX - (spr.width >> 1)), Math.round(baseY - spr.height)); g.globalAlpha = 1;
  if (!burning && art.species !== 'palm') canopies.push({ x: baseX + k, y: baseY - spr.height + 12, ground: baseY, sp: art.species });
}

// ───────────────────────── particles (world-owned) ─────────────────────────
interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; kind: number; c: number; ground: number; seed: number }
const PS: P[] = []; const CAP = 260;
const LEAF_COL: Record<string, string[]> = { oak: ['#78a943', '#4a8738', '#b4cc5c', '#c08a3a'], willow: ['#7a933d', '#527230'], pine: ['#347042'], snowpine: ['#ffffff', '#e6eef6'] };
function emit(p: P) { if (PS.length < CAP) PS.push(p); }

export function drawAir(g: G) {
  const dt = F.dt / 1000; const t = F.time;
  // leaves: only visible canopies, only when the gust reaching them is strong
  for (const c of canopies) { const w = wind(c.x, c.y, t); const rate = Math.max(0, w - 0.55) * (c.sp === 'pine' ? 0.15 : 1); if (Math.random() < rate * dt * 1.6) emit({ x: c.x + (Math.random() - 0.5) * 18, y: c.y + Math.random() * 10, vx: 0, vy: 6, life: 0, max: 9000, kind: 0, c: (Math.random() * 4) | 0, ground: c.ground + (Math.random() * 10 - 6), seed: Math.random() * 6.28 }); }
  // embers from lava in view
  for (let i = 0; i < lavaInView.length; i++) if (Math.random() < 0.012) { const k = lavaInView[i]; emit({ x: (k % WW) * 16 + Math.random() * 16, y: ((k / WW) | 0) * 16 + Math.random() * 16, vx: 0, vy: -14 - Math.random() * 10, life: 0, max: 1600 + Math.random() * 1600, kind: 1, c: 0, ground: 0, seed: Math.random() * 6 }); }
  // spindrift over snow & ice, proportional to wind
  for (let i = 0; i < snowInView.length; i++) { const k = snowInView[i]; const x = (k % WW) * 16, y = ((k / WW) | 0) * 16; if (Math.random() < Math.max(0, wind(x, y, t) - 0.35) * 0.05) emit({ x, y: y + Math.random() * 16, vx: 0, vy: 0, life: 0, max: 900 + Math.random() * 800, kind: 2, c: 0, ground: 0, seed: Math.random() * 6 }); }
  // ash fall
  for (let i = 0; i < ashInView.length; i++) if (Math.random() < 0.004) { const k = ashInView[i]; emit({ x: (k % WW) * 16 + Math.random() * 16, y: ((k / WW) | 0) * 16 - 30, vx: 0, vy: 8, life: 0, max: 3500, kind: 3, c: 0, ground: ((k / WW) | 0) * 16 + Math.random() * 16, seed: Math.random() * 6 }); }
  for (let i = PS.length - 1; i >= 0; i--) {
    const p = PS[i]; p.life += F.dt; if (p.life > p.max) { PS.splice(i, 1); continue; }
    const w = wind(p.x, p.y, t); const a = 1 - p.life / p.max;
    if (p.kind === 0 || p.kind === 3) { // leaf / ash: flutter-fall, then rest on the ground and fade
      if (p.y < p.ground) { p.vx += ((w * 26) - p.vx) * dt * 2; p.x += (p.vx + Math.sin(t / 240 + p.seed) * 10) * dt; p.y += (p.vy + Math.cos(t / 300 + p.seed) * 5) * dt; }
      else if (p.max - p.life > 2600) p.life = p.max - 2600;
      const resting = p.y >= p.ground; const cols = LEAF_COL.oak; g.globalAlpha = Math.min(1, a * 3);
      g.fillStyle = p.kind === 3 ? '#8a8288' : cols[p.c % cols.length];
      const flip = Math.sin(t / 120 + p.seed) > 0; g.fillRect(Math.round(p.x), Math.round(p.y), resting || flip ? 2 : 1, 1);
    } else if (p.kind === 1) { // ember rising in the heat column, bent by wind
      p.vx += ((w * 18) - p.vx) * dt; p.x += (p.vx + Math.sin(t / 150 + p.seed) * 6) * dt; p.y += p.vy * dt;
      const L = EMISSIVE.lava; g.globalAlpha = 1; g.fillStyle = a > 0.7 ? L[5] : a > 0.4 ? L[4] : a > 0.2 ? L[3] : L[1]; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    } else if (p.kind === 2) { // spindrift: skims the ground downwind
      p.x += (30 + w * 70) * dt; p.y += Math.sin(t / 200 + p.seed) * 4 * dt; g.globalAlpha = Math.sin(a * Math.PI) * 0.75; g.fillStyle = '#ffffff'; g.fillRect(Math.round(p.x), Math.round(p.y), 3, 1);
    } else if (p.kind === 4) { // water ring (wake / rise / bubble pop)
      const R = 1 + (1 - a) * (p.c || 5); g.globalAlpha = a * 0.8; g.fillStyle = '#d8f0ff'; const n = Math.max(8, R * 5);
      for (let k = 0; k < n; k++) { const ang = k / n * 6.283; g.fillRect(Math.round(p.x + Math.cos(ang) * R), Math.round(p.y + Math.sin(ang) * R * 0.55), 1, 1); }
    }
  }
  g.globalAlpha = 1;
  // player wake: walking through shallows leaves rings
  if (F.pmoving) { const t0 = effTile(stateRun!, Math.floor(F.px / 16), Math.floor(F.py / 16)); if ((t0 === T.SHALLOW || t0 === T.RIVER || t0 === T.MARSH) && Math.random() < 0.25) emit({ x: F.px, y: F.py + 3, vx: 0, vy: 0, life: 0, max: 900, kind: 4, c: 7, ground: 0, seed: 0 }); }
}
let stateRun: RunState | null = null;
export function setRun(r: RunState) { stateRun = r; }

// ───────────────────────── water bodies ─────────────────────────
const waterKind = new Map<number, number>(); // 1 sea, 2 river-h, 3 river-v, 4 lake
function classify(r: RunState, tx: number, ty: number) {
  const i = ty * WW + tx; let k = waterKind.get(i); if (k !== undefined) return k;
  const w = getWorld(); const fresh = w.fresh[i];
  if (!fresh) k = 1; else {
    let n = 0, h = 0, v = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { if (isWater(effTile(r, tx + dx, ty + dy))) { n++; if (dy === 0) h++; if (dx === 0) v++; } }
    k = n >= 21 ? 4 : h >= v ? 2 : 3;
  }
  waterKind.set(i, k); return k;
}
export function drawWaterTile(g: G, r: RunState, tx: number, ty: number, t: number) {
  const X = tx * 16, Y = ty * 16, time = F.time; const kind = classify(r, tx, ty);
  const land = (dx: number, dy: number) => { const n = effTile(r, tx + dx, ty + dy); return !isWater(n) && n !== T.ICE; };
  if (kind === 1) {
    // ocean swell: moving crest + trough lines, warped by noise, deep water darker and slower
    const sp = t === T.DEEP ? 0.0045 : 0.007;
    for (let k = 0; k < 2; k++) { const ph = (time * sp + vn(tx * 0.3, ty * 0.3 + k, 5) * 24 + k * 16) % 32; const yy = Math.floor(ph - (ty * 16 % 32)); for (const off of [yy, yy + 32, yy - 32]) if (off >= 0 && off < 16) {
      const x0 = (h2(tx, ty, k + 7) * 8) | 0, len = 5 + ((h2(tx, ty, k + 9) * 7) | 0); g.fillStyle = 'rgba(190,230,255,0.55)'; g.fillRect(X + x0, Y + off, len, 1); g.fillStyle = 'rgba(10,30,70,0.25)'; g.fillRect(X + x0 + 1, Y + off + 1, len - 1, 1); } }
  } else if (kind === 2 || kind === 3) {
    // river current: streaks travel downstream; faster mid-channel; foam where banks pinch
    const hor = kind === 2; const sp = 0.028;
    for (let k = 0; k < 3; k++) { const lat = 2 + ((h2(tx, ty, k) * 12) | 0); const along = Math.floor((time * sp * (0.8 + h2(tx, ty, k + 3) * 0.5) + h2(tx, ty, k + 5) * 16 + (hor ? tx : ty) * 16) % 16); const L = 3 + k;
      g.fillStyle = k === 0 ? 'rgba(220,245,255,0.6)' : 'rgba(150,205,235,0.45)'; if (hor) g.fillRect(X + along, Y + lat, Math.min(L, 16 - along), 1); else g.fillRect(X + lat, Y + along, 1, Math.min(L, 16 - along)); }
    if ((hor && (land(0, -1) || land(0, 1))) || (!hor && (land(-1, 0) || land(1, 0)))) { g.fillStyle = 'rgba(240,250,255,0.75)'; for (let k = 0; k < 3; k++) if (h2(tx * 3 + k, ty, Math.floor(time / 180)) > 0.55) g.fillRect(X + ((h2(k, tx, Math.floor(time / 180)) * 15) | 0), Y + ((h2(ty, k, Math.floor(time / 180)) * 15) | 0), 1, 1); }
  } else {
    // still lake: slow glassy sky reflection bands; rare rings from rising fish
    const drift = Math.floor(time / 900 + h2(tx, ty, 1) * 8) % 16; g.fillStyle = 'rgba(200,230,255,0.22)'; g.fillRect(X + drift, Y + ((h2(tx, ty, 2) * 14) | 0), 4, 1);
    if (h2(tx, ty, Math.floor(time / 5000)) > 0.985 && (time % 5000) < 40) emit({ x: X + 8, y: Y + 8, vx: 0, vy: 0, life: 0, max: 2200, kind: 4, c: 9, ground: 0, seed: 0 });
  }
  // shoreline: foam runs up & recedes; the sand it leaves behind is wet and darker
  const cyc = Math.sin(time / (kind === 1 ? 1700 : 2600) + tx * 0.35 + ty * 0.21); const reach = kind === 1 ? Math.round(2.5 + cyc * 2.5) : 1;
  const sides: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const [dx, dy] of sides) { if (!land(dx, dy)) continue; const nt = effTile(r, tx + dx, ty + dy);
    g.fillStyle = kind === 1 ? 'rgba(240,250,255,0.82)' : 'rgba(225,240,250,0.5)';
    for (let k = 0; k < 16; k++) { if (h2(tx * 16 + k, ty * 7 + dx + dy * 3, Math.floor(time / 700)) < 0.22) continue; const d = reach - ((h2(k, tx + ty, 4) * 2) | 0); if (d < 0) continue;
      if (dy === -1) g.fillRect(X + k, Y + d, 1, 1); else if (dy === 1) g.fillRect(X + k, Y + 15 - d, 1, 1); else if (dx === -1) g.fillRect(X + d, Y + k, 1, 1); else g.fillRect(X + 15 - d, Y + k, 1, 1); }
    if (kind === 1 && (nt === T.SAND || nt === T.ROAD || nt === T.GRASS)) { const wet = 0.1 + Math.max(0, -cyc) * 0.14; g.fillStyle = `rgba(40,30,20,${wet})`; const W = 3; if (dy === -1) g.fillRect(X, Y - W, 16, W); else if (dy === 1) g.fillRect(X, Y + 16, 16, W); else if (dx === -1) g.fillRect(X - W, Y, W, 16); else g.fillRect(X + 16, Y, W, 16); }
  }
}

// ───────────────────────── lava ─────────────────────────
let lavaFrames: Sprite[] | null = null;
function lavaTex(): Sprite[] {
  if (lavaFrames) return lavaFrames; const L = EMISSIVE.lava, R = MAT.lavarock; const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  lavaFrames = [];
  for (let f = 0; f < 12; f++) { const th = f / 12 * Math.PI * 2; lavaFrames.push(mk(64, 64, g => { const img = g.createImageData(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      // flow field: molten core advects along +x+y; crust plates drift slower and crack at their rims
      const u = x / 64 * 6.283, v = y / 64 * 6.283;
      const flow = (Math.sin(u + th + Math.sin(v * 2 + th) * 0.8) + Math.sin(v * 2 - th + Math.cos(u * 2) * 0.7) + 2) / 4;
      const crust = (Math.sin(u * 2 + th * 0.5) * Math.cos(v * 2 - th * 0.5) + Math.sin(u * 3 - v + th) * 0.5 + 1.5) / 3;
      let c: number[];
      if (crust > 0.6) { const e = crust - 0.6; c = hex(e < 0.025 ? L[3] : R[Math.min(R.length - 1, ((1 - flow) * 3 + bayer(x, y)) | 0)]); }
      else { const ii = Math.min(L.length - 1, Math.max(1, (flow * 5.2 + bayer(x, y) * 0.8) | 0)); c = hex(L[ii]); }
      const i = (y * 64 + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); }, null)); }
  return lavaFrames;
}
export function drawLavaTile(g: G, r: RunState, tx: number, ty: number) {
  const X = tx * 16, Y = ty * 16; const fr = lavaTex()[Math.floor(F.time / 140) % 12];
  g.drawImage(fr, (X % 64), (Y % 64), 16, 16, X, Y, 16, 16); lavaInView.push(ty * WW + tx);
  // cooled crust rim where the flow meets rock, and radiant glow licking the bank
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) { const n = effTile(r, tx + dx, ty + dy); if (n === T.LAVA) continue;
    g.fillStyle = '#1d1012'; const W = 2; if (dy === -1) g.fillRect(X, Y, 16, W); else if (dy === 1) g.fillRect(X, Y + 16 - W, 16, W); else if (dx === -1) g.fillRect(X, Y, W, 16); else g.fillRect(X + 16 - W, Y, W, 16);
    const a = 0.16 + Math.sin(F.time / 500 + tx + ty) * 0.06; g.fillStyle = `rgba(255,110,30,${a})`; const G2 = 4; if (dy === -1) g.fillRect(X, Y - G2, 16, G2); else if (dy === 1) g.fillRect(X, Y + 16, 16, G2); else if (dx === -1) g.fillRect(X - G2, Y, G2, 16); else g.fillRect(X + 16, Y, G2, 16); }
}
/** Real refraction of what is behind hot air: scanlines above lava/forges are displaced in the framebuffer. */
export function heatShimmer(g: G) {
  if (!lavaInView.length && !forges.length) return; const cv = g.canvas as HTMLCanvasElement; if (!cv || !cv.width) return;
  const rows = new Map<number, [number, number]>();
  const addSrc = (sx: number, sy: number, w: number, hgt: number) => { for (let y = Math.max(0, sy - hgt); y < Math.min(VIEW_H, sy + 6); y++) { const cur = rows.get(y); const x0 = Math.max(0, sx - 4), x1 = Math.min(VIEW_W, sx + w + 4); rows.set(y, cur ? [Math.min(cur[0], x0), Math.max(cur[1], x1)] : [x0, x1]); } };
  for (const k of lavaInView) addSrc((k % WW) * 16 - F.cx, ((k / WW) | 0) * 16 - F.cy, 16, 26);
  for (const [x, y] of forges) addSrc(x - F.cx - 30, y - F.cy - 30, 60, 50);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  for (const [y, [x0, x1]] of rows) { const off = Math.round(Math.sin(y * 0.55 + F.time * 0.009) * 0.9 + Math.sin(y * 0.21 - F.time * 0.004) * 0.6); if (!off || x1 <= x0) continue; g.drawImage(cv, x0, y, x1 - x0, 1, x0 + off, y, x1 - x0, 1); }
  g.restore(); forges.length = 0;
}
const forges: [number, number][] = [];
export function noteHeatSource(x: number, y: number) { forges.push([x, y]); }

// ───────────────────────── ground-level life (marsh, snow, ice, ash) ─────────────────────────
let fogTex: Sprite | null = null;
function fog(): Sprite { return fogTex ??= mk(144, 64, g => { for (let y = 0; y < 64; y++) for (let x = 0; x < 144; x++) { const n = fbm2((x % 128) / 22, y / 14, 7, 3); const a = Math.max(0, n - 0.48) * 0.9; if (a > 0.02 && bayer(x, y) < a * 2.2) { g.fillStyle = 'rgba(200,220,210,0.22)'; g.fillRect(x, y, 1, 1); } } }, null); }
export function drawGroundTile(g: G, tx: number, ty: number, t: number) {
  const X = tx * 16, Y = ty * 16, time = F.time;
  if (t === T.MARSH) {
    const ph = (time + h2(tx, ty, 3) * 5000) % 5000; if (h2(tx, ty, 2) > 0.7 && ph < 1400) { const bx = X + 3 + ((h2(tx, ty, 4) * 10) | 0), by = Y + 4 + ((h2(tx, ty, 5) * 8) | 0); const s = ph < 1100 ? (ph < 500 ? 1 : 2) : 0; if (s) { g.fillStyle = '#6a8a6a'; g.fillRect(bx, by, s, s); g.fillStyle = '#c8e0c0'; g.fillRect(bx, by, 1, 1); } else if (ph < 1140) emit({ x: bx, y: by, vx: 0, vy: 0, life: 0, max: 700, kind: 4, c: 4, ground: 0, seed: 0 }); }
    const off = Math.floor(time * 0.006 + wind(X, Y, time) * 10); const u = ((X + off) % 128 + 128) % 128; g.drawImage(fog(), u, Y % 64, 16, 16, X, Y, 16, 16);
  } else if (t === T.SNOW || t === T.ICE) {
    snowInView.push(ty * WW + tx);
    if (t === T.ICE) { // specular glints depend on view position: they wink as you walk past
      const ph = ((X - F.cx * 0.6 + h2(tx, ty, 1) * 60) % 60 + 60) % 60; if (ph < 2 && h2(tx, ty, 2) > 0.5) { const gx = X + ((h2(tx, ty, 3) * 12) | 0) + 2, gy = Y + ((h2(tx, ty, 4) * 12) | 0) + 2; g.fillStyle = '#ffffff'; g.fillRect(gx, gy, 1, 1); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(gx - 1, gy, 3, 1); g.fillRect(gx, gy - 1, 1, 3); }
      g.fillStyle = 'rgba(255,255,255,0.10)'; const s2 = ((tx * 7 + ty * 3) % 16); g.fillRect(X + s2, Y + ((s2 * 3) % 16), 3, 1); }
  } else if (t === T.ASH || t === T.BURNT) ashInView.push(ty * WW + tx);
}

// ───────────────────────── occluded light ─────────────────────────
/** 2D shadowcasting: rays marched against wall/cliff tiles produce the area a light can actually reach. */
export function lightPolygon(r: RunState, x: number, y: number, rad: number): [number, number][] {
  const pts: [number, number][] = []; const N = rad > 50 ? 72 : 48; const step = 3;
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; const ca = Math.cos(a), sa = Math.sin(a); let d = 0;
    for (; d < rad; d += step) { const px = x + ca * d, py = y + sa * d; const tt = effTile(r, Math.floor(px / 16), Math.floor(py / 16)); if (isWall(tt)) { d += 4; break; } }
    pts.push([x + ca * Math.min(rad, d), y + sa * Math.min(rad, d)]); }
  return pts;
}
export function clipTo(l: G, pts: [number, number][], ox: number, oy: number) { l.beginPath(); pts.forEach(([x, y], i) => i ? l.lineTo(Math.round(x - ox), Math.round(y - oy)) : l.moveTo(Math.round(x - ox), Math.round(y - oy))); l.closePath(); l.clip(); }

// ───────────────────────── Elder domains: painted ground & walls ─────────────────────────
const ELDER_IDS: Record<string, string> = { po_elderwood: 'aion', po_typhon: 'typhon', po_gate: 'atlas', po_surtur: 'surtur', po_necropolis: 'anubis', po_hall_eyes: 'argus' };
let elderCells: { floor: number; layout: string; cells: Map<number, string>; center: Record<string, [number, number]>; open: Set<number> } | null = null;
function elderMap(r: RunState) {
  const fl = activeFloor(r); const lay = r.layoutId || '';
  if (elderCells && elderCells.floor === fl && elderCells.layout === lay) return elderCells;
  const cells = new Map<number, string>(); const center: Record<string, [number, number]> = {}; const open = new Set<number>();
  try { const ww = getWindowWorld(lay); const layer = ww.floors.layers.get(fl);
    if (layer && fl < 0) for (const rr of layer.rooms as any[]) for (const [ax, ay, aw, ah] of (rr.rects || []) as [number, number, number, number][]) for (let y = ay - 1; y < ay + ah + 1; y++) for (let x = ax - 1; x < ax + aw + 1; x++) open.add(y * WW + x);
    if (layer) for (const rr of layer.rooms as any[]) { const pid = String(rr.id).split('.')[0]; const k = ELDER_IDS[pid]; if (!k) continue; for (const [ax, ay, aw, ah] of rr.rects as [number, number, number, number][]) for (let y = ay - 1; y < ay + ah + 1; y++) for (let x = ax - 1; x < ax + aw + 1; x++) if (x >= 0 && y >= 0 && x < WW && y < WH) cells.set(y * WW + x, k); }
    for (const p of getWorld().places) { const k = ELDER_IDS[p.id]; if (k) center[k] = [p.tx, p.ty]; }
  } catch { /* non-VEYRA layouts */ }
  elderCells = { floor: fl, layout: lay, cells, center, open }; return elderCells;
}
const elderTileCache = new Map<string, { base: Sprite; glow?: Sprite }>();
type Painter = (x: number, y: number, wx: number, wy: number, wall: number) => { c: string; e?: string };
const pick = (ramp: string[], v: number, x: number, y: number) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length + (bayer(x, y) - 0.5) * 0.6)))];
const PAINT: Record<string, Painter> = {
  aion: (x, y, wx, wy, wall) => { if (wall) { const strand = Math.sin(wx * 0.7 + Math.sin(wy * 0.2) * 3); const v = 0.35 + strand * 0.25 + (wall === 2 ? 0.15 : -0.05) - (wall === 2 && y > 12 ? 0.25 : 0); return { c: pick(MAT.bark, v + (h2(wx, wy) - 0.5) * 0.1, x, y) }; }
    // dark loam, leaf litter and moss; roots appear as sparse, clustered runs that surface and dive again
    const run = vn(wx * 0.035, wy * 0.035, 11); const root = 1 - Math.abs(vn(wx * 0.06 + vn(wy * 0.05, wx * 0.02, 4) * 2.5, wy * 0.06, 3) - 0.5) * 2;
    if (run > 0.5 && root > 0.93) { const rv = (root - 0.93) * 9; return { c: pick(MAT.heartwood, 0.25 + rv * 0.45 + (h2(wx, wy) > 0.9 ? 0.1 : 0), x, y), e: root > 0.99 && run > 0.66 ? '#57c27a' : undefined }; }
    if (run > 0.5 && root > 0.9) return { c: '#0d080b' }; // contact shadow either side of a root
    const loam = vn(wx * 0.25, wy * 0.25, 2); const litter = h2(wx >> 1, wy >> 1, 9);
    if (litter > 0.93) return { c: litter > 0.97 ? '#6e4a24' : '#4a3a1c' };
    if (vn(wx * 0.09, wy * 0.09, 6) > 0.66) return { c: pick(MAT.moss, 0.15 + loam * 0.35, x, y) };
    return { c: pick(['#140e10', '#1b1414', '#231a17', '#2c211b'], loam * 0.9 + 0.05, x, y) }; },
  typhon: (x, y, wx, wy, wall) => { if (wall) { const band = Math.sin(wy * 0.45 + vn(wx * 0.1, wy * 0.1, 4) * 5); const icicle = wall === 2 && y > 11 && h2(wx, 0, 3) > 0.5 && y - 11 < h2(wx, 1, 2) * 5; if (wall === 1 && y < 5) return { c: pick(MAT.snow, 0.7 + h2(wx, wy) * 0.2, x, y) }; return { c: icicle ? MAT.ice[5] : pick(MAT.ice, 0.35 + band * 0.18 + (wall === 2 ? 0.1 : 0), x, y) }; }
    const slab = ((wx >> 4) + (wy >> 4)) & 1; const crack = Math.abs(vn(wx * 0.05, wy * 0.05, 5) - 0.5) < 0.009 && vn(wx * 0.02, wy * 0.02, 8) > 0.45; const deep = vn(wx * 0.05, wy * 0.05, 9); const rime = vn(wx * 0.3, wy * 0.3, 14) > 0.8;
    return { c: crack ? MAT.ice[5] : rime ? pick(MAT.ice, 0.62, x, y) : pick(MAT.ice, 0.22 + deep * 0.3 + slab * 0.04, x, y) }; },
  atlas: (x, y, wx, wy, wall) => { if (wall) { const flute = (wx % 4); const v = 0.45 + (flute === 0 ? -0.2 : flute === 1 ? 0.15 : 0) + (wall === 1 ? 0.15 : 0); if (wall === 2 && y > 10 && vn(wx * 0.3, wy * 0.3, 3) > 0.4) return { c: pick(MAT.jade, 0.4, x, y) }; return { c: pick(MAT.marble, v, x, y) }; }
    // large drowned marble slabs (32px), offset courses, silt in the joints, veining, all under a thin film of water
    const course = Math.floor(wy / 24); const lx = (wx + (course % 2) * 16) % 32, ly = wy % 24; const joint = lx === 0 || ly === 0 || lx === 31;
    const slab = h2(Math.floor((wx + (course % 2) * 16) / 32), course, 3); const vein = Math.abs(vn(wx * 0.07 + slab * 9, wy * 0.07, 12) - 0.5) < 0.02;
    const silt = vn(wx * 0.05, wy * 0.05, 13);
    if (joint) return { c: silt > 0.55 ? '#1b3a34' : '#0f1c2a' };
    return { c: pick(['#1a2c40', '#22384e', '#2c4860', '#3a5a70', '#4e7284'], 0.3 + slab * 0.35 + (vein ? 0.25 : 0) - (silt > 0.62 ? 0.18 : 0) + (ly === 1 ? 0.1 : 0), x, y) }; },
  surtur: (x, y, wx, wy, wall) => { if (wall) { const col = wx % 6; return { c: pick(MAT.basalt, 0.45 + (col === 0 ? -0.3 : col === 1 ? 0.2 : 0) + (wy % 18 === 0 ? -0.2 : 0) - (wall === 2 && y > 12 ? 0.2 : 0), x, y), e: col === 3 && wall === 2 && vn(wx * 0.2, wy * 0.1, 2) > 0.62 ? '#ff7a2a' : undefined }; }
    // columnar-jointed basalt: irregular polygon tops (jittered Voronoi), bevelled toward the light; a few joints carry live lava
    const v = voro(wx, wy, 13); const hot = vn(wx * 0.025, wy * 0.025, 3) > 0.66; const gap = v.d2 - v.d1;
    if (gap < 1.3) return { c: hot ? '#2a0e08' : '#09070b', e: hot && gap < 0.8 ? '#ff6a1e' : undefined };
    const bev = gap < 3 ? (v.dy > 0 || v.dx > 0 ? 0.2 : -0.24) : 0; const pit = h2(wx, wy, 5) > 0.95 ? -0.15 : 0;
    return { c: pick(MAT.basalt, 0.3 + v.id * 0.25 + bev + pit + (hot ? 0.06 : 0), x, y) }; },
  anubis: (x, y, wx, wy, wall) => { if (wall) { if (wall === 1) return { c: pick(MAT.sandstone, 0.62 + h2(wx, wy) * 0.1 - (y > 13 ? 0.25 : 0), x, y) }; const band = (wy % 16); const glyph = band > 4 && band < 11 && h2(wx >> 1, (wy >> 1) + 3, 7) > 0.6; return { c: pick(MAT.sandstone, 0.48 + (band === 3 || band === 12 ? -0.25 : 0) + (glyph ? -0.18 : 0), x, y), e: band === 4 && (wx % 8) < 2 ? '#e0a830' : undefined }; }
    const lx = wx % 12, ly = (wy + ((wx / 12) | 0) * 5) % 9; const joint = lx === 0 || ly === 0; const drift = vn(wx * 0.06, wy * 0.09, 5); return { c: drift > 0.78 ? pick(MAT.sandstone, 0.55 + (drift - 0.78) * 0.8, x, y) : joint ? MAT.sandstone[2] : pick(MAT.sandstone, 0.45 + h2(Math.floor(wx / 12), Math.floor(wy / 9), 1) * 0.15, x, y) }; },
  argus: (x, y, wx, wy, wall) => { if (wall) { if (wall === 1) return { c: pick(MAT.slate, 0.5 + (y === 0 ? 0.3 : 0), x, y) }; const shelf = y % 6; if (shelf === 0) return { c: MAT.book[3] }; const spine = h2(wx, (wy / 6) | 0, 4); return { c: pick([MAT.book, MAT.cloth, MAT.jade, MAT.slate][(spine * 4) | 0], 0.3 + (wx % 2) * 0.15 + (shelf === 1 ? 0.2 : 0), x, y) }; }
    const lx = wx % 8, ly = wy % 8; return { c: (lx === 0 || ly === 0) ? '#0f1220' : pick(['#151a2c', '#1c2338', '#252e48', '#33405e'], 0.35 + ((lx + ly) < 5 ? 0.25 : 0) + h2(wx >> 3, wy >> 3, 2) * 0.15, x, y) }; },
};
function elderTile(kind: string, tx: number, ty: number, wall: number, cx: number, cy: number) {
  const key = kind + ':' + tx + ':' + ty + ':' + wall; let c = elderTileCache.get(key); if (c) return c;
  if (elderTileCache.size > 3000) elderTileCache.clear();
  const P = PAINT[kind]; let glowPx = 0; const glowBuf: [number, number, string][] = [];
  const base = mk(16, 16, g => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const wx = tx * 16 + x, wy = ty * 16 + y; const o = P(x, y, wx, wy, wall);
    // Argus: brass meridian rings inlaid around the oculus centre
    if (kind === 'argus' && !wall) { const d = Math.hypot(wx - cx * 16 - 8, wy - cy * 16 - 8); const ring = Math.round(d / 16); if ((ring === 4 || ring === 8 || ring === 13) && Math.abs(d - ring * 16) < 0.6) { g.fillStyle = MAT.brass[3]; g.fillRect(x, y, 1, 1); glowBuf.push([x, y, '#ffe07a']); glowPx++; continue; } }
    g.fillStyle = o.c; g.fillRect(x, y, 1, 1); if (o.e) { glowBuf.push([x, y, o.e]); glowPx++; } } }, null);
  const glow = glowPx ? mk(16, 16, g => { for (const [x, y, col] of glowBuf) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }, null) : undefined;
  c = { base, glow }; elderTileCache.set(key, c); return c;
}
/** Paints Elder sanctuary floors/walls with their domain material and drives each domain's own rhythm. */
export function drawElderGround(g: G, r: RunState, vx0: number, vx1: number, vy0: number, vy1: number) {
  const em = elderMap(r); if (!em.cells.size) return; const time = F.time;
  for (let ty = vy0; ty <= vy1; ty++) for (let tx = vx0; tx <= vx1; tx++) {
    const kind = em.cells.get(ty * WW + tx); if (!kind) continue; const t = effTile(r, tx, ty); if (isWater(t) || t === T.LAVA) continue;
    const wall = isWall(t) ? (isWall(effTile(r, tx, ty + 1)) ? 1 : 2) : 0; const c0 = em.center[kind] || [tx, ty];
    const tile = elderTile(kind, tx, ty, wall, c0[0], c0[1]); g.drawImage(tile.base, tx * 16, ty * 16);
    if (tile.glow) {
      const dist = Math.hypot(tx - c0[0], ty - c0[1]); let a = 0.6;
      if (kind === 'aion') a = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(dist * 0.55 - time * 0.0016)), 3);       // sap pulses outward from the heart: the rhythm of Time
      else if (kind === 'surtur') a = 0.55 + 0.45 * Math.sin(time * 0.002 + vn(tx * 0.3, ty * 0.3, 1) * 6);        // seams breathe with the forge
      else if (kind === 'atlas') a = 0.2 + 0.8 * Math.max(0, Math.sin(time * 0.0012 + (tx + ty) * 0.25));          // lattice light shifts across the span
      else if (kind === 'argus') a = 0.15 + 0.5 * Math.pow(Math.max(0, Math.cos(Math.atan2(ty - c0[1], tx - c0[0]) - time * 0.0004)), 8);  // a slow observation sweep rotates around the oculus                     // observation sweep travels the meridian rings
      else if (kind === 'anubis') a = 0.5 + 0.2 * Math.sin(time * 0.001);
      g.globalAlpha = a; g.drawImage(tile.glow, tx * 16, ty * 16); g.globalAlpha = 1;
    }
    if (kind === 'atlas' && !wall) { const fr = caustics()[Math.floor(time / 160) % 8]; g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.16; g.drawImage(fr, (tx * 16) % 32, (ty * 16) % 32, 16, 16, tx * 16, ty * 16, 16, 16); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    if (kind === 'typhon' && !wall) drawGroundTile(g, tx, ty, T.ICE);
    if (kind === 'anubis' && wall === 2 && h2(tx, ty, 5) > 0.8) { const ph = (time + h2(tx, ty, 6) * 4000) % 4000; if (ph < 1600) { g.fillStyle = 'rgba(225,190,120,0.7)'; const sx = tx * 16 + 4 + ((h2(tx, ty, 7) * 8) | 0); for (let k = 0; k < 4; k++) g.fillRect(sx + (k & 1), ty * 16 + 16 + ((ph / 40 + k * 5) % 22), 1, 1); } } // sand sifting from cracked lintels
  }
}
let causticFrames: Sprite[] | null = null;
function caustics(): Sprite[] { return causticFrames ??= Array.from({ length: 8 }, (_, f) => mk(32, 32, g => { const th = f / 8 * 6.283; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const u = x / 32 * 6.283, v = y / 32 * 6.283; const c = Math.abs(Math.sin(u + Math.sin(v + th) * 1.3) + Math.sin(v * 2 - th + Math.cos(u * 2 + th))); if (c < 0.18) { g.fillStyle = '#8ad8ff'; g.fillRect(x, y, 1, 1); } } }, null)); }
/** Lights carried by Elder monuments in view (world positions), consumed by drawLight. */
export const sceneLights: [number, number, number, string][] = [];

/** Jittered-grid Voronoi: distance to nearest/second seed, seed id and direction to seed. */
function voro(x: number, y: number, cell: number) {
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell); let d1 = 1e9, d2 = 1e9, id = 0, dx = 0, dy = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const gx = cx + i, gy = cy + j; const sx = (gx + 0.15 + h2(gx, gy, 71) * 0.7) * cell, sy = (gy + 0.15 + h2(gx, gy, 72) * 0.7) * cell; const d = Math.hypot(x - sx, y - sy);
    if (d < d1) { d2 = d1; d1 = d; id = h2(gx, gy, 73); dx = sx - x; dy = sy - y; } else if (d < d2) d2 = d; }
  return { d1, d2, id, dx, dy };
}

// ───────────────────────── underground: bedrock outside authored chambers ─────────────────────────
const rockTiles: Sprite[] = [];
function bedrock(v: number): Sprite {
  if (rockTiles[v]) return rockTiles[v];
  return rockTiles[v] = mk(16, 16, g => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const wx = v * 16 + x, wy = y;
    const band = Math.sin((wy + vn(wx * 0.15, wy * 0.1, 21) * 5) * 0.8); const stone = vn(wx * 0.3, wy * 0.3, 22) > 0.8; const root = Math.abs(vn(wx * 0.12, wy * 0.3, 23) - 0.5) < 0.03;
    g.fillStyle = root ? '#2a1a14' : stone ? pick(MAT.stone, 0.3 + (y < 8 ? 0.1 : 0), x, y) : pick(['#08070a', '#0e0b0e', '#141013', '#1a1517'], 0.45 + band * 0.12, x, y); g.fillRect(x, y, 1, 1); } }, null);
}
/** Below ground the world outside the authored rooms is rock, not the sunlit surface. Display only. */
export function drawUnderground(g: G, r: RunState, vx0: number, vx1: number, vy0: number, vy1: number) {
  const em = elderMap(r); if (em.floor >= 0 || !em.open.size) return;
  for (let ty = vy0; ty <= vy1; ty++) for (let tx = vx0; tx <= vx1; tx++) { const i = ty * WW + tx;
    if (!em.open.has(i)) { g.drawImage(bedrock((h2(tx, ty, 31) * 6) | 0), tx * 16, ty * 16); continue; }
    // contact occlusion where a chamber meets the rock mass
    g.fillStyle = 'rgba(4,3,6,0.45)'; if (!em.open.has(i - WW)) g.fillRect(tx * 16, ty * 16, 16, 3); if (!em.open.has(i - 1)) g.fillRect(tx * 16, ty * 16, 3, 16); if (!em.open.has(i + 1)) g.fillRect(tx * 16 + 13, ty * 16, 3, 16); if (!em.open.has(i + WW)) g.fillRect(tx * 16, ty * 16 + 14, 16, 2); }
}
export function undergroundHides(r: RunState, x: number, y: number) { const em = elderMap(r); return em.floor < 0 && em.open.size > 0 && !em.open.has(Math.floor(y / 16) * WW + Math.floor(x / 16)); }
