// DOM-free native-resolution compositor: rasters → RGBA framebuffer. Browser scales with nearest-neighbour only.
import { Raster, hash2 } from '../art/raster';
import { PALETTE, R } from '../art/kit';
import type { Dir } from '../art/kit';
import { getFrame, clipsFor, FORM_ART } from '../art/sprites';
import { frameAt } from '../art/clips';
import { World, Actor, Cmd, Shape, dir4, Ent } from '../game/core';
import { cached, vGhostV2 as vGhost, vDot, vLink, El, ELR, vWarnDecal, vMark, vText } from '../art/vfx';

const P32 = new Uint32Array(PALETTE.length); const PA = new Uint8Array(PALETTE.length);
PALETTE.forEach((c, i) => { P32[i] = (c[3] << 24) | (c[2] << 16) | (c[1] << 8) | c[0]; PA[i] = c[3]; });

export class FB {
  w: number; h: number; data: Uint8ClampedArray; px: Uint32Array;
  constructor(w: number, h: number) { this.w = w; this.h = h; this.data = new Uint8ClampedArray(w * h * 4); this.px = new Uint32Array(this.data.buffer); }
  clearTransparent() { this.px.fill(0); }
  blend(i: number, c: number, a: number) {
    if (a <= 0.002) return;
    if (a >= 0.999) { this.px[i] = c; return; }
    const d = this.px[i], da = ((d >>> 24) & 255) / 255;
    if (da <= 0.002) {
      const oa = Math.min(255, Math.max(0, Math.round(a * 255)));
      this.px[i] = (oa << 24) | (c & 0x00ffffff);
      return;
    }
    const outA = a + da * (1 - a);
    const k = a / outA, ik = 1 - k;
    const r = (c & 255) * k + (d & 255) * ik, g = ((c >> 8) & 255) * k + ((d >> 8) & 255) * ik, b = ((c >> 16) & 255) * k + ((d >> 16) & 255) * ik;
    this.px[i] = (Math.min(255, Math.round(outA * 255)) << 24) | (b << 16) | (g << 8) | r;
  }
  set(x: number, y: number, idx: number, alpha = 1) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.blend(y * this.w + x, P32[idx], alpha * PA[idx] / 255); }
  raster(r: Raster, x: number, y: number, alpha = 1, scale = 1, map?: (c: number) => number) {
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < r.h; j++) { const yy0 = y + j * scale; if (yy0 >= this.h || yy0 + scale <= 0) continue;
      for (let i = 0; i < r.w; i++) { let c = r.d[j * r.w + i]; if (!c) continue; if (map) c = map(c); const a = alpha * PA[c] / 255; const col = P32[c];
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) { const X = x + i * scale + sx, Y = yy0 + sy; if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.blend(Y * this.w + X, col, a); } } }
  }
}

// ---------- floor themes (render-only; core logic never sees them) ----------
export type Floor = 'empty' | 'grass' | 'stone' | 'dark' | 'checker' | 'sand';
const FLOOR_COL: Record<Floor, number[][]> = {
  empty: [[80, 82, 92], [86, 88, 98], [74, 76, 86]],
  grass: [[38, 52, 36], [43, 58, 40], [33, 45, 31], [64, 57, 40]],
  stone: [[60, 60, 68], [68, 68, 76], [52, 52, 60], [40, 40, 48]],
  dark: [[32, 29, 40], [38, 34, 47], [26, 23, 33]],
  checker: [[88, 90, 98], [78, 80, 88]],
  sand: [[132, 112, 78], [142, 120, 84], [122, 102, 70]],
};
const floorTiles = new Map<Floor, Uint32Array>();
/**
 * Floors are authored at 2x2 pixel clusters with a narrow value range. Per-pixel noise at native
 * scale reads as television static and buried every effect; a coarse texture reads as ground and
 * leaves the foreground legible.
 */
function floorTile(f: Floor) {
  if (floorTiles.has(f)) return floorTiles.get(f)!;
  const t = new Uint32Array(64 * 64), C = FLOOR_COL[f];
  const cell = (x: number, y: number, k: number) => hash2((x >> 2) + k * 13, (y >> 3), 9 + k);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    let c = C[0];
    const quiet = f === 'grass' || f === 'sand' || f === 'empty' || f === 'dark';
    if (quiet) { c = C[cell(x, y, 2) < 0.55 ? 0 : 1]; if (cell(x, y, 5) < 0.04) c = C[2]; t[y * 64 + x] = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]; continue; }
    if (f === 'checker') {
      const base = ((x >> 4) ^ (y >> 4)) & 1;
      c = C[base];
      if ((x & 15) < 2 || (y & 15) < 2) c = C[0].map((v2) => Math.max(0, v2 - 10));        // grout
      else if (cell(x, y, base) < 0.09) c = C[1 - base];                                     // worn tiles
    } else if (f === 'stone') {
      const slab = ((y >> 4) & 1) ? 0 : 16;                                                   // offset bond
      if (x % 32 === 0 || y % 16 === 0) c = C[3];                                            // mortar
      else c = C[cell(x + slab, y, 1) < 0.5 ? 0 : 1];
      if (cell(x, y, 4) < 0.05) c = C[2];
    } else if (f === 'grass') {
      c = C[cell(x, y, 2) < 0.45 ? 0 : 1];
      if (cell(x, y, 5) < 0.07) c = C[2];                                                    // patches
      if (cell(x, y, 6) < 0.035) c = C[3];                                                   // dry tufts
    } else if (f === 'sand') {
      c = C[cell(x, y, 3) < 0.4 ? 0 : 1];
      if ((y + (x >> 3)) % 11 === 0) c = C[2];                                               // wind ripples
    } else if (f === 'empty') { c = C[cell(x, y, 7) < 0.3 ? 1 : 0]; if ((x & 31) === 0 || (y & 31) === 0) c = C[2]; }
    else { c = C[cell(x, y, 8) < 0.5 ? 0 : 1]; if (cell(x, y, 9) < 0.04) c = C[2]; }
    t[y * 64 + x] = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
  }
  floorTiles.set(f, t); return t;
}

// ---------- small actor sprites (player/dummy) ----------
function playerSprite(dir: Dir, fr: number, flash: boolean) {
  return cached(`pl/${dir}/${fr}/${flash}`, () => {
    const r = new Raster(16, 22), P = R.pl, b = fr % 2;
    r.oval(8, 20, 5, 1.5, R.shadow[0]);
    r.rect(5 - (dir === 'left' ? 1 : 0), 15, 2, 5 - b, P[1]); r.rect(9 + (dir === 'right' ? 1 : 0), 15, 2, 4 + b, P[1]);
    r.rect(4, 8, 8, 8, P[2]); r.rect(4, 8, 8, 1, P[3]); r.line(4, 15, 11, 15, P[1]);
    r.oval(8, 5, 3.5, 3.5, P[2]);
    if (dir === 'down') { r.rect(6, 5, 4, 2, P[4]); r.set(7, 5, P[0]); r.set(9, 5, P[0]); } else if (dir === 'left') r.rect(4, 5, 3, 2, P[4]); else if (dir === 'right') r.rect(9, 5, 3, 2, P[4]);
    r.rect(5, 2, 6, 1, P[5]);
    const sx = dir === 'left' ? 2 : 13; r.line(sx, 9, sx, 16, P[6]); r.set(sx, 8, P[3]);
    if (flash) for (let i = 0; i < r.d.length; i++) if (r.d[i] && r.d[i] !== R.shadow[0]) r.d[i] = R.k[1];
    for (let y = 0; y < 22; y++) for (let x = 0; x < 16; x++) if (!r.get(x, y) && (r.get(x + 1, y) && r.get(x + 1, y) !== R.shadow[0] || r.get(x - 1, y) && r.get(x - 1, y) !== R.shadow[0] || r.get(x, y + 1) && r.get(x, y + 1) !== R.shadow[0] || r.get(x, y - 1) && r.get(x, y - 1) !== R.shadow[0])) r.set(x, y, P[0]);
    return r;
  });
}
function dummySprite() { return cached('dummy', () => { const r = new Raster(16, 24), D = R.dummy; r.oval(8, 22, 5, 1.5, R.shadow[0]); r.rect(7, 6, 2, 16, D[1]); r.rect(3, 9, 10, 2, D[2]); r.oval(8, 5, 3, 3, D[3]); r.rect(5, 12, 6, 6, D[2]); r.line(5, 14, 10, 14, D[0]); return r; }); }
function shadowRaster(w: number) { return cached(`sh/${w}`, () => { const r = new Raster(w * 2 + 2, w + 2); r.oval(w + 1, w / 2 + 1, w, w / 2.6, R.shadow[0]); return r; }); }

export interface RenderOpts { overlay?: (fb: FB, cx: number, cy: number) => void; reduced?: boolean; floor: Floor; transparentBg?: boolean; hidePlayerProxy?: boolean; layers: { ground: boolean; hazards: boolean; actors: boolean; fx: boolean }; hitboxes: boolean; heatmap: boolean; silhouette: boolean; noVfx: boolean; warnings: boolean; shake: number; selectedBoss?: number }
const rimCache = new Map<string, Raster>();
/** Contour-only copy of a frame in one colour: a hit flash outlines the body, it must not repaint it. */
function rimOnly(src: Raster, col: number): Raster {
  const key = `${src.w}x${src.h}:${col}`;
  const hit = rimCache.get(key);
  const out = new Raster(src.w, src.h);
  for (let y = 1; y < src.h - 1; y++) for (let x = 1; x < src.w - 1; x++) {
    if (!src.get(x, y)) continue;
    if (!src.get(x - 1, y) || !src.get(x + 1, y) || !src.get(x, y - 1) || !src.get(x, y + 1)) out.set(x, y, col);
  }
  if (hit) return out;
  rimCache.set(key, out); if (rimCache.size > 400) rimCache.clear();
  return out;
}
const BEL: Record<string, El> = { surtur: 'fire', typhon: 'force', aion: 'time', atlas: 'space', argus: 'mind', anubis: 'soul' };
const ELC: Record<El, number> = { fire: R.lava[3], force: R.force[3], time: R.time[3], space: R.space[3], mind: R.mind[3], soul: R.soul[3] };
let heatCache: { f: number; cells: Float32Array; cw: number; ch: number } | null = null;

export function renderWorld(fb: FB, w: World, camX: number, camY: number, o: RenderOpts) {
  let shX = 0, shY = 0;
  if (o.shake > 0 && w.shake > 0.2) {
    const s2 = (w.shake * w.shake) * o.shake, a1 = w.t * 21, a2 = w.t * 21 * 1.37 + 2.1;
    shX = Math.round((Math.sin(a1) * 0.6 + Math.sin(a1 * 2.3 + 1.1) * 0.4) * 4 * s2);
    shY = Math.round((Math.sin(a2) * 0.6 + Math.sin(a2 * 2.1 + 0.7) * 0.4) * 6 * s2);
  }
  const cx = Math.round(camX) + shX, cy = Math.round(camY) + shY;
  // floor (or transparent clear when compositing over Veyra's world map!)
  if (o.transparentBg) {
    fb.clearTransparent();
  } else {
    const tile = floorTile(o.floor);
    // never assume the framebuffer is larger than a tile: modulo the source, not the destination
    for (let y = 0; y < fb.h; y++) { const ty = ((((y + cy) % 64) + 64) % 64) * 64; for (let x = 0; x < fb.w; x++) fb.px[y * fb.w + x] = tile[ty + ((((x + cx) % 64) + 64) % 64)]; }
    const b = w.map.bounds; if (b.w < 4000) for (let y = 0; y < fb.h; y++) for (let x = 0; x < fb.w; x++) { const X = x + cx, Y = y + cy; if (X < b.x || Y < b.y || X >= b.x + b.w || Y >= b.y + b.h) fb.px[y * fb.w + x] = 0xff100c0c; }
    for (const ob of w.map.obstacles) for (let y = ob.y; y < ob.y + ob.h; y++) for (let x = ob.x; x < ob.x + ob.w; x++) { const X = x - cx, Y = y - cy; if (X >= 0 && Y >= 0 && X < fb.w && Y < fb.h) fb.px[Y * fb.w + X] = y === ob.y ? 0xff8a8278 : (x === ob.x || x === ob.x + ob.w - 1 || y === ob.y + ob.h - 1) ? 0xff2a2628 : 0xff5a5450; }
  }
  // exact floor snapshot (only while an impact frame is live) so the impact frame can flatten the ground
  const ifLive = !o.reduced && w.quality !== 'art_only' && w.t - w.impactFrame.t >= 0 && w.t - w.impactFrame.t <= 0.05;
  const floorSnap = ifLive ? fb.px.slice() : null;
  const cmds: Cmd[] = [];
  for (const e of w.ents) if (!e.dead) { const cs = e.render(w); for (const c of cs) cmds.push(c); }
  const vis = (x: number, y: number, m = 200) => x - cx > -m && x - cx < fb.w + m && y - cy > -m && y - cy < fb.h + m;
  const draw = (c: Cmd) => {
    if (o.noVfx && c.k !== 'zone') return;
    if (!vis(c.x, c.y, 2000)) return;
    if (c.k === 'spr' || c.k === 'ghost') { const r = c.make!(); const s = c.w || 1; if (!vis(c.x, c.y, Math.max(r.w, r.h) * s * 0.5 + 4)) return; fb.raster(r, c.x - cx - (r.w * s) / 2, c.y - cy - (r.h * s) / 2, c.alpha ?? 1, s); }
    else if (c.k === 'beam') drawBeam(fb, c.x - cx, c.y - cy, c.x2! - cx, c.y2! - cy, c.w ?? 1, c.el ?? 'mind', w.frame);
    else if (c.k === 'chain') drawChain(fb, c.x - cx, c.y - cy, c.x2! - cx, c.y2! - cy, c.el ?? 'soul');
    else if (c.k === 'tail') { const pts = c.pts!; pts.forEach((p, i) => { const rr = Math.max(1, 4 - i * 0.3); const sp = cached(`tl${Math.round(rr)}`, () => { const r = new Raster(12, 12); r.disc(6, 6, rr, R.scale[2]); r.disc(5, 5, rr * 0.5, R.scale[3]); r.set(6, 6 + Math.round(rr * 0.6), R.belly[1]); return r; }); fb.raster(sp, p.x - cx - 6, p.y - cy - 6); }); const tp = pts[pts.length - 1]; fb.raster(cached('tlh', () => { const r = new Raster(8, 8); r.oval(4, 4, 3, 2, R.scale[3]); r.set(5, 3, R.force[4]); return r; }), tp.x - cx - 4, tp.y - cy - 4); }
    else if (c.k === 'ribbon' && c.pts) { drawRibbon(fb, c.pts, cx, cy, c.w ?? 2, c.el ?? 'fire', c.alpha ?? 1); }
    else if (c.k === 'zone' && c.shape) {
      const prog = c.prog ?? 0, col = c.el ? ELC[c.el] : R.k[1];
      if (prog >= 0) {
        zoneFill(fb, c.shape, cx, cy, prog, col, w.frame, c.el);
        if (c.el && c.shape.k === 'circle' && c.shape.r > 6) { const d = vWarnDecal(c.el, Math.round(c.shape.r / 4) * 4, prog, 2); fb.raster(d, c.shape.x - cx - d.w / 2, c.shape.y - cy - d.h / 2, 0.9); }
      }
      zoneOutline(fb, c.shape, cx, cy, prog, col, w.frame, 1, c.el);
    }
  };
  if (o.layers.ground) for (const c of cmds) if (c.layer === 0) draw(c);
  if (o.layers.hazards) for (const c of cmds) if (c.layer === 1) draw(c);
  // sorted actors + layer2
  type S = { y: number; f: () => void };
  const sorted: S[] = [];
  if (o.layers.actors) for (const a of w.actors) { if (!vis(a.pos.x, a.pos.y, a.boss ? FORM_ART[a.boss.bossId][a.boss.form].size : 40)) continue; sorted.push({ y: a.pos.y, f: () => drawActor(fb, w, a, cx, cy, o) }); }
  if (o.layers.fx) for (const c of cmds) if (c.layer === 2) sorted.push({ y: c.z ?? c.y, f: () => draw(c) });
  sorted.sort((p, q) => p.y - q.y); for (const s of sorted) s.f();
  if (o.layers.hazards) for (const c of cmds) if (c.k === 'zone' && c.shape && (c.prog ?? 0) >= 0 && c.layer === 1) zoneOutline(fb, c.shape, cx, cy, c.prog ?? 0, c.el ? ELC[c.el] : R.k[1], w.frame, 0.4, c.el);
  if (o.layers.fx) for (const c of cmds) if (c.layer === 3) draw(c);
  // Reassert only the bosses' outer contour and identity lights after front VFX. This is not a
  // second opaque body render: trails still cross the body, but the silhouette can never disappear.
  if (!o.reduced && w.quality === 'maximum_vfx' && w.impactPulses.length) pixelMaterialResponse(fb, w, cx, cy);
  if (o.overlay && w.quality !== 'art_only' && !o.noVfx) o.overlay(fb, cx, cy);
  if (floorSnap) impactFrame(fb, w, cx, cy);
  // cinematic: flash on catastrophic commit + dithered vignette while any catastrophic skill is running
  const cine = w.actors.some((a) => a.alive && a.boss?.runner && a.boss.runner.skill.cd >= 20) ? 1 : 0;
  if (!o.reduced && w.quality !== 'art_only') {
    if (cine) { const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; for (let y = 0; y < fb.h; y++) for (let x = 0; x < fb.w; x++) { const dx = (x / fb.w - 0.5) * 2, dy = (y / fb.h - 0.5) * 2, d = Math.max(Math.abs(dx), Math.abs(dy)); if (d < 0.72) continue; if ((d - 0.72) * 3.6 * 16 > B4[(y & 3) * 4 + (x & 3)]) fb.blend(y * fb.w + x, 0xff0a0608, 0.55); } }
    if (w.flash > 0.02) { const p2 = R[ELR[w.flashEl]], c = PALETTE[p2[Math.min(2, p2.length - 1)]], col = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0], a = Math.min(0.12, w.flash * 0.25); for (let i = 0; i < fb.px.length; i += 1) fb.blend(i, col, a); }
  }
  if (o.layers.fx) for (const c of cmds) if (c.layer === 4) draw(c);
  if (o.hitboxes) { for (const a of w.actors) if (a.alive) zoneOutline(fb, { k: 'circle', x: a.pos.x, y: a.pos.y, r: a.r }, cx, cy, -2, R.k[1], 0); for (const c of cmds) if (c.prog === -1 && c.shape) zoneOutline(fb, c.shape, cx, cy, -1, R.k[1], 0); for (const e of w.ents) if (e.kind === 'hitbox' && e.data.s) zoneOutline(fb, e.data.s as Shape, cx, cy, -1, R.k[1], 0); }
  if (o.heatmap) heat(fb, w, cx, cy);
  if (o.warnings) for (const e of w.ents) if (e.major && !e.dead && (e.pos.x < cx || e.pos.y < cy || e.pos.x > cx + fb.w || e.pos.y > cy + fb.h)) arrow(fb, e, cx, cy);
}

/**
 * Integer-only local screen response. Pixels are copied from a frozen framebuffer snapshot; no
 * interpolation, blur, vector path or shader. Each element displaces pixels differently so impacts
 * alter the material read without hiding the gameplay silhouette.
 */
function pixelMaterialResponse(fb: FB, w: World, cx: number, cy: number) {
  const src = fb.px.slice();
  for (const p of w.impactPulses.slice(-3)) {
    const u = p.t / p.life, wave = 1 - u, R0 = p.r * (0.35 + u * 0.9), band = Math.max(3, p.r * 0.18);
    const sx = Math.round(p.x - cx), sy = Math.round(p.y - cy), x0 = Math.max(1, Math.floor(sx - p.r - 8)), x1 = Math.min(fb.w - 2, Math.ceil(sx + p.r + 8)), y0 = Math.max(1, Math.floor(sy - p.r - 8)), y1 = Math.min(fb.h - 2, Math.ceil(sy + p.r + 8));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy); if (Math.abs(d - R0) > band) continue;
      const env = (1 - Math.abs(d - R0) / band) * wave, q = Math.max(1, Math.round(p.strength * env));
      let ox = 0, oy = 0;
      if (p.el === 'fire') ox = Math.round(Math.sin((y + w.frame) * 0.7) * q);                 // rising heat ripple
      else if (p.el === 'force') { ox = Math.round((dx / (d || 1)) * q); oy = Math.round((dy / (d || 1)) * q); } // radial shove
      else if (p.el === 'time') { ox = (Math.floor(y / 2 + w.frame) & 1) ? -q : q; }          // staggered exposure
      else if (p.el === 'space') { ox = ((y + w.frame) & 3) < 2 ? q * 2 : -q * 2; oy = (x & 1) ? 1 : -1; } // torn rows
      else if (p.el === 'mind') { ox = (y % 3 === 0) ? q * 2 : 0; }                           // ocular scanline shear
      else { oy = (x & 1) ? -q : q; ox = Math.round(Math.sin(y * 0.4) * q); }                  // soul separation
      const X = Math.max(0, Math.min(fb.w - 1, x + ox)), Y = Math.max(0, Math.min(fb.h - 1, y + oy));
      fb.px[y * fb.w + x] = src[Y * fb.w + X];
    }
  }
}

function drawClarity(fb: FB, a: Actor, cx: number, cy: number) {
  const B = a.boss!, clips = clipsFor(B.bossId, B.form), clip = clips[a.anim] || clips.idle, fi = frameAt(clip, a.animT * 1000), d = dir4(a.facing), fo = getFrame(B.bossId, B.form, clip.name, d, fi), fa = FORM_ART[B.bossId][B.form], el = BEL[B.bossId] || 'mind';
  const key = `clar/${B.bossId}/${B.form}/${clip.name}/${d}/${fi}`;
  const r = cached(key, () => {
    const o = new Raster(fo.w, fo.h), s = fo.comp, hot = R[ELR[el]][4];
    for (let y = 1; y < s.h - 1; y++) for (let x = 1; x < s.w - 1; x++) {
      const c = s.get(x, y); if (!c) continue;
      const edge = !s.get(x - 1, y) || !s.get(x + 1, y) || !s.get(x, y - 1) || !s.get(x, y + 1);
      if (edge) { const upper = !s.get(x, y - 1) || !s.get(x - 1, y); o.set(x, y, upper ? hot : R.k[0]); continue; }
      const p = PALETTE[c]; if (p && p[0] + p[1] + p[2] > 620) o.set(x, y, c); // eyes, core, blade edge, stars
    }
    return o;
  });
  fb.raster(r, a.pos.x - cx - fa.root[0], a.pos.y - cy - fa.root[1], 0.9);
}
function drawRibbon(fb: FB, pts: { x: number; y: number }[], cx: number, cy: number, width: number, el: El, alpha: number) {
  // Aged, tapered blade wake: thread-thin at the tail, full width at the blade; jagged tongue edge on
  // the outer side that breaks into separate pixels where it is older; dark 1px underside; palette
  // cools with age. (Was a uniform tube along the whole path -> read as a smooth flat banana.)
  const pal = R[ELR[el]], N = pts.length; if (N < 2) return;
  for (let i = 1; i < N; i++) {
    const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const n = Math.max(1, Math.ceil(L));
    for (let s2 = 0; s2 <= n; s2++) {
      const age = 1 - (i - 1 + s2 / n) / (N - 1), head = 1 - age, x = a.x + dx * (s2 / n), y = a.y + dy * (s2 / n);
      const wd = Math.max(0.6, width * (0.12 + 0.88 * Math.pow(head, 0.7)));
      const seg = Math.round(x * 0.37 + y * 0.53) >> 1;
      const tooth = wd * 0.9 * hash2(seg, 5, 7) * head;   // outer tongue length varies per segment
      const cool = age > 0.66 ? 2 : age > 0.33 ? 1 : 0;
      for (let k = -wd - 1; k <= wd + tooth; k += 0.7) {
        const out = k > wd, u = Math.min(1, Math.abs(k) / Math.max(1, wd));
        if (out && age > 0.35 && hash2(seg, Math.round(k * 3), 9) < age) continue;     // older tongues break up
        if (k < -wd) { fb.set(x + nx * k, y + ny * k, pal[1], alpha * 0.8); continue; } // dark underside
        let ci = out ? 3 : u < 0.18 && head > 0.4 ? 5 : u < 0.5 ? 4 : u < 0.85 ? 3 : 2;
        ci = Math.max(1, ci - cool);
        fb.set(x + nx * k, y + ny * k, pal[ci], alpha);
      }
    }
  }
}
function stampLine(fb: FB, x0: number, y0: number, x1: number, y1: number, st: Raster | null, el: El, step: number) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.floor(L / step));
  for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; if (st) fb.raster(st, x - st.w / 2, y - st.h / 2); else if (i % 2 === 0) fb.set(x, y, R[ELR[el]][4]); }
}
/**
 * Beam as a drawn object, not a stamped dot line: white core, hot body, broken jagged outer edge
 * that changes per segment, energy knots travelling along the axis, and a flare at the origin.
 */
function drawBeam(fb: FB, x0: number, y0: number, x1: number, y1: number, w: number, el: El, frame: number) {
  const rp = R[ELR[el]], L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux;
  if (w <= 0) { // aim / tracking line: capped at 150px so it can never cross the screen
    const Lc = Math.min(L, 150); x1 = x0 + ux * Lc; y1 = y0 + uy * Lc;
    for (let d = 0; d < L; d += 1) { if (((d + frame) >> 1) % 3 === 2) continue; const x = x0 + ux * d, y = y0 + uy * d; fb.set(x, y + 1, R.k[0], 0.4); fb.set(x, y, rp[3], 0.9); }
    return;
  }
  const hw = w + 1.5;
  for (let d = 0; d < L; d += 0.7) {
    const seg = Math.floor(d / 5), jag = (hash2(seg, Math.floor(frame / 2), 7) - 0.5) * 2.2, x = x0 + ux * d, y = y0 + uy * d;
    const knot = Math.abs(((d - frame * 3) % 16 + 16) % 16 - 8) < 2 ? 1 : 0; // bright pulses running down the beam
    const edge = hw + jag * 0.6 + knot;
    for (let j = -edge - 1; j <= edge + 1; j += 0.6) {
      const a = Math.abs(j), X = x + nx * j, Y = y + ny * j;
      let c: number;
      if (a > edge) { if (hash2(seg, Math.round(j * 2), 3) < 0.55) continue; c = rp[1]; }       // broken dark fringe
      else if (a > edge - 1.2) c = rp[2];
      else if (a > hw * 0.55) c = rp[3];
      else if (a > hw * 0.22) c = rp[4];
      else c = knot ? R.k[1] : rp[5];
      fb.set(X, Y, c);
    }
  }
  // origin flare: a small irregular burst where the beam leaves the emitter
  for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.283 + frame * 0.4, rr = hw * (1.6 + (i % 2) * 0.9); for (let k = 0; k < rr; k++) fb.set(x0 + Math.cos(a) * k, y0 + Math.sin(a) * k, k < rr * 0.4 ? R.k[1] : rp[4]); }
}
/** Chain of real links: alternating face-on rings and edge-on bars oriented along the chain, with a cast shadow. */
function drawChain(fb: FB, x0: number, y0: number, x1: number, y1: number, el: El) {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux, step = 5, metal = el === 'soul' ? R.fgold : R.astone, glow = R[ELR[el]];
  for (let pass = 0; pass < 2; pass++) for (let d = 0, i = 0; d <= L; d += step, i++) {
    const cx = x0 + ux * d, cy = y0 + uy * d + (pass === 0 ? 1 : 0);
    if (i % 2 === 0) { // face-on ring: hollow oval, lit on top
      for (let t = 0; t < 16; t++) { const a = (t / 16) * 6.283, X = cx + ux * Math.cos(a) * 3.2 + nx * Math.sin(a) * 2.2, Y = cy + uy * Math.cos(a) * 3.2 + ny * Math.sin(a) * 2.2; fb.set(X, Y, pass === 0 ? R.k[0] : Math.sin(a) < 0 ? metal[4] : metal[2], pass === 0 ? 0.5 : 1); }
    } else { // edge-on bar: 2px thick with a highlight line
      for (let k = -3; k <= 3; k++) for (let j = 0; j <= 1; j++) fb.set(cx + ux * k + nx * (j - 0.5), cy + uy * k + ny * (j - 0.5), pass === 0 ? R.k[0] : j === 0 ? metal[3] : metal[1], pass === 0 ? 0.5 : 1);
    }
    if (pass === 1 && i % 3 === 1) fb.set(cx, cy, glow[4]);
  }
}
interface ZoneMask { x0: number; y0: number; w: number; h: number; inside: Uint8Array; u: Float32Array }
/** Exact membership of the damage shape plus a 0..1 "charge coordinate" (centre → rim / start → end). */
function zoneMask(s: Shape, cx: number, cy: number, fbw: number, fbh: number): ZoneMask | null {
  const bb = s.k === 'capsule' ? { x0: Math.min(s.x1, s.x2) - s.r, y0: Math.min(s.y1, s.y2) - s.r, x1: Math.max(s.x1, s.x2) + s.r, y1: Math.max(s.y1, s.y2) + s.r } : s.k === 'ring' ? { x0: s.x - s.r1, y0: s.y - s.r1, x1: s.x + s.r1, y1: s.y + s.r1 } : { x0: s.x - s.r, y0: s.y - s.r, x1: s.x + s.r, y1: s.y + s.r };
  const X0 = Math.max(Math.floor(bb.x0) - 1, cx - 1), Y0 = Math.max(Math.floor(bb.y0) - 1, cy - 1), X1 = Math.min(Math.ceil(bb.x1) + 1, cx + fbw), Y1 = Math.min(Math.ceil(bb.y1) + 1, cy + fbh);
  const w = X1 - X0 + 1, h = Y1 - Y0 + 1; if (w <= 0 || h <= 0 || w * h > 600000) return null;
  const inside = new Uint8Array(w * h), u = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = X0 + x, Y = Y0 + y; let ins = false, uu = 0;
    if (s.k === 'circle') { const d = Math.hypot(X - s.x, Y - s.y); ins = d <= s.r; uu = d / s.r; }
    else if (s.k === 'ring') { const d = Math.hypot(X - s.x, Y - s.y); ins = d >= s.r0 && d <= s.r1; uu = (d - s.r0) / Math.max(1, s.r1 - s.r0); }
    else if (s.k === 'sector') { const d = Math.hypot(X - s.x, Y - s.y); let da = Math.atan2(Y - s.y, X - s.x) - s.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; ins = d <= s.r && d >= (s.r0 || 0) && Math.abs(da) <= s.span / 2; uu = (d - (s.r0 || 0)) / Math.max(1, s.r - (s.r0 || 0)); }
    else { const dx = s.x2 - s.x1, dy = s.y2 - s.y1, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((X - s.x1) * dx + (Y - s.y1) * dy) / L2)); ins = Math.hypot(X - (s.x1 + dx * t), Y - (s.y1 + dy * t)) <= s.r; uu = t; }
    if (ins) { inside[y * w + x] = 1; u[y * w + x] = uu; }
  }
  return { x0: X0, y0: Y0, w, h, inside, u };
}
const zoneRamp = (el: El | undefined, col: number) => (el ? R[ELR[el]] : [col, col, col, col, col, R.k[1]]);
/**
 * Material telegraph: the ground itself charges. Clustered 2x2 dither in the element's DARK tones,
 * a bright charge front that travels centre→rim (start→end for lines) and reaches the edge exactly
 * at impact, then the whole area brightens in the last 18%. No hatching, no arrows, no dots.
 */
function zoneFill(fb: FB, s: Shape, cx: number, cy: number, prog: number, col: number, frame = 0, el?: El) {
  const m = zoneMask(s, cx, cy, fb.w, fb.h); if (!m) return;
  const rp = zoneRamp(el, col), P = Math.min(1, Math.max(0, prog)), final = P > 0.82, flick = final && (frame >> 1) % 2 === 1;
  const line = s.k === 'capsule';
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = y * m.w + x; if (!m.inside[i]) continue;
    const X = m.x0 + x, Y = m.y0 + y, uu = m.u[i];
    // organic grain: seeded per 2x2 cell (never an ordered checker)
    const g = hash2(X >> 1, Y >> 1, 41);
    // Only the OUTER band of the shape carries the material grain, so the centre stays readable and
    // the telegraph reads as a boundary, not a painted disc.
    const outer = s.k === 'circle' ? uu > 0.72 : s.k === 'sector' ? uu > 0.7 : s.k === 'ring' ? (uu > 0.6 || uu < 0.14) : true;
    if (!line) {
      // thin jagged charge front, 2px, wobbling per angle so it is never a compass arc
      const ang = s.k === 'circle' || s.k === 'ring' || s.k === 'sector' ? Math.atan2(Y - (s as { y: number }).y, X - (s as { x: number }).x) : 0;
      const wob = (hash2(Math.round(ang * 14), Math.floor(frame / 3), 5) - 0.5) * 0.05;
      const front = Math.abs(uu - (P + wob)) * Math.max(8, (s as { r: number }).r ?? 20);
      if (uu <= P + wob && front < 2) { fb.set(X - cx, Y - cy, final ? R.k[1] : rp[4], 0.95); continue; }
      const charged = uu <= P, dens = outer ? 0.2 + 0.22 * P + (flick ? 0.12 : 0) : 0.035;
      if (g >= dens) continue;
      fb.set(X - cx, Y - cy, charged ? (final ? rp[3] : rp[2]) : rp[1], charged ? 0.5 + 0.25 * P : 0.35);
    } else {
      // lines: faint dark grain only; the energy is drawn as a crackling spine below
      if (g < 0.1 + (flick ? 0.12 : 0)) fb.set(X - cx, Y - cy, uu <= P ? rp[2] : rp[1], 0.45);
    }
  }
  if (line) {
    const L2 = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    // crackling spine for SHORT lanes only. A 900px rail is a screen-crossing dotted white line;
    // arena-length lanes rely on their trench/chevrons instead.
    const sx = s.x1, sy = s.y1, dx = s.x2 - s.x1, dy = s.y2 - s.y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    let ox = 0;
    for (let d = 0; L2 <= 360 && d <= L * P; d += 1) {
      if ((d | 0) % 3 === 0) ox = Math.max(-s.r * 0.35, Math.min(s.r * 0.35, ox + (hash2(d | 0, Math.floor(frame / 3), 3) - 0.5) * 2.2));
      const x = sx + ux * d + nx * ox, y = sy + uy * d + ny * ox, head = d > L * P - 3;
      const far = L > 380 && d < L * P - 90;
      fb.set(x - cx, y - cy, head || final ? R.k[1] : far ? rp[1] : rp[3], far ? 0.4 : 0.95); fb.set(x - cx, y - cy + 1, rp[1], 0.5);
      if (L2 <= 360 && (d | 0) % 7 === 0 && hash2(d | 0, 2, 11) < 0.7) { const sg = hash2(d | 0, 3, 13) < 0.5 ? -1 : 1, ln = 2 + hash2(d | 0, 4, 2) * s.r * 0.6; for (let k = 1; k < ln; k++) fb.set(x + nx * sg * k + ux * (k >> 1) - cx, y + ny * sg * k + uy * (k >> 1) - cy, rp[3], 0.8); }
    }
  }
}
/** Solid contour traced from the real damage mask, with a dark 1px rim outside for any floor. */
function zoneOutline(fb: FB, s: Shape, cx: number, cy: number, prog: number, col: number, frame: number, mul = 1, el?: El) {
  const m = zoneMask(s, cx, cy, fb.w, fb.h); if (!m) return;
  const rp = zoneRamp(el, col), dbg = prog < 0, P = Math.min(1, Math.max(0, prog)), blink = P > 0.82 && (frame >> 1) % 2 === 0;
  const huge = (s.k === 'capsule' ? Math.hypot(s.x2 - s.x1, s.y2 - s.y1) : s.k === 'ring' ? s.r1 : s.r) > 300;
  if (huge && !dbg) return; // a 900px contour is a screen-crossing line, not a telegraph
  const ec = dbg ? (prog === -2 ? R.space[4] : R.k[1]) : blink ? R.k[1] : huge ? rp[2] : P > 0.6 ? rp[4] : rp[3]; // a 900px contour is a screen-crossing line, not a telegraph
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.inside[y * m.w + x] === 1;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (at(x, y)) { if (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)) fb.set(m.x0 + x - cx, m.y0 + y - cy, ec, (dbg ? 0.85 : 0.75 + 0.25 * P) * mul); }
    else if (!dbg && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) fb.set(m.x0 + x - cx, m.y0 + y - cy, R.k[0], 0.45 * mul);
  }
  // approach arcs (circles only): four short solid arcs closing onto the rim exactly at impact
  if (!dbg && s.k === 'circle' && P < 1 && mul >= 1) { const ar = s.r * (1.6 - 0.6 * P); for (let q2 = 0; q2 < 4; q2++) for (let t = -0.38; t <= 0.38; t += 1 / ar) { const a = q2 * 1.5708 + 0.785 + t; fb.set(s.x + Math.cos(a) * ar - cx, s.y + Math.sin(a) * ar - cy, P > 0.82 ? R.k[1] : rp[4], 0.85); } }
}
function P0(prog: number) { return Math.min(1, prog); }
function heat(fb: FB, w: World, cx: number, cy: number) {
  const cs = 16;
  if (!heatCache || w.frame - heatCache.f > 8) { const cw = Math.ceil(fb.w / cs), ch = Math.ceil(fb.h / cs), cells = new Float32Array(cw * ch); const ents = w.ents.filter((e) => e.lethal && e.danger); for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) { const p = { x: cx + i * cs + cs / 2, y: cy + j * cs + cs / 2 }; let n = 0; for (const e of ents) if (e.danger!(p, 0.8)) n++; cells[j * cw + i] = n; } heatCache = { f: w.frame, cells, cw, ch }; }
  const { cells, cw } = heatCache; for (let y = 0; y < fb.h; y++) for (let x = 0; x < fb.w; x++) { const n = cells[Math.floor(y / cs) * cw + Math.floor(x / cs)]; if (n > 0 && ((x + y) & 1)) fb.blend(y * fb.w + x, 0xff2020ff, Math.min(0.55, 0.18 * n)); }
}
function arrow(fb: FB, e: Ent, cx: number, cy: number) {
  const mx = cx + fb.w / 2, my = cy + fb.h / 2, a = Math.atan2(e.pos.y - my, e.pos.x - mx);
  const ex = Math.max(8, Math.min(fb.w - 8, fb.w / 2 + Math.cos(a) * fb.w)), ey = Math.max(8, Math.min(fb.h - 8, fb.h / 2 + Math.sin(a) * fb.h));
  for (let i = 0; i < 7; i++) for (let k = -Math.floor((7 - i) / 2); k <= Math.floor((7 - i) / 2); k++) fb.set(ex + Math.cos(a) * (i - 3) + Math.cos(a + 1.57) * k, ey + Math.sin(a) * (i - 3) + Math.sin(a + 1.57) * k, i > 4 ? R.k[1] : R.lava[3]);
}
const U2 = (a: Actor) => a.boss?.form === 'ultimate';
function drawActor(fb: FB, w: World, a: Actor, cx: number, cy: number, o: RenderOpts) {
  const flash = w.t - a.lastHurt < 0.075, bigFlash = w.t - a.lastHurt < 0.045;
  if (a.boss) {
    const B = a.boss, fa = FORM_ART[B.bossId][B.form], clips = clipsFor(B.bossId, B.form);
    const clip = clips[a.anim] || clips.idle, fi = frameAt(clip, a.animT * 1000), d = dir4(a.facing);
    const fo = getFrame(B.bossId, B.form, clip.name, d, fi);
    const air = (a as any).air ? 1 : 0;
    fb.raster(shadowRaster(Math.round(a.r * 1.3)), a.pos.x - cx - a.r * 1.3 - 1, a.pos.y - cy - a.r * 0.5);
    if (air) return; // airborne / in transit: only the shadow (and skill VFX) is visible
    const ox = a.pos.x - cx - fa.root[0], oy = a.pos.y - cy - fa.root[1], el = BEL[B.bossId] || 'mind';
    // ground separation: dark contact pool + element pool ring, so dark bodies read on dark floors and on checkerboards
    fb.raster(shadowRaster(Math.round(a.r * (U2(a) ? 2.1 : 1.35))), a.pos.x - cx - a.r * (U2(a) ? 2.1 : 1.35), a.pos.y - cy - a.r * 0.5 + 1, 0.9);
    if (!o.silhouette && w.quality !== 'art_only') {
      const glow = 0.3 + 0.08 * Math.sin(w.t * 4 + a.id) + ((clips[a.anim] || clips.idle).frames[fi]?.p.glow ?? 0.3) * 0.16;
      const rim = (c: number) => (c === 0 ? 0 : R[ELR[el]][4]);
      // dark contour at 2px then bright element rim at 1px: separation on ANY floor, checkerboards included
      for (const d of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, 1], [-1, 1], [1, -1]]) fb.raster(fo.comp, ox + d[0], oy + d[1], 0.9, 1, () => R.k[0]);
      for (const d of [[0, -1], [-1, -1], [1, -1]]) fb.raster(fo.comp, ox + d[0], oy + d[1], glow * 0.62, 1, rim);
      
    }
    // hit reaction never erases the sprite: 1-in-9 palette sparks + a hot outline pass
    // hit feedback keeps the palette: a % of pixels going pure white bleached dark bodies (Anubis).
    const map = o.silhouette ? () => R.k[0] : flash ? (c: number) => (c % 7 === 0 ? R[ELR[el]][5] : c) : undefined;
    fb.raster(fo.comp, ox, oy, 1, 1, map);
    // hit feedback = palette sparkle only; any outline pass turns a thin-limbed silhouette solid.
    return;
  }
  if (!a.alive && a.kind !== 'boss') return;
  if (a.kind === 'summon') { const r = vGhost(Math.floor(a.animT * 6), a.summon!.variant); fb.raster(r, a.pos.x - cx - 8, a.pos.y - cy - 18, flash ? 0.5 : 1); return; }
  if (a.kind === 'dummy') { fb.raster(dummySprite(), a.pos.x - cx - 8, a.pos.y - cy - 21); return; }
  if (o.hidePlayerProxy && a.kind === 'player') {
    if (a.slowUntil > w.t) fb.set(a.pos.x - cx, a.pos.y - cy - 22, R.time[4]);
    return;
  }
  const roll = a.iframesUntil > w.t; const r = playerSprite(dir4(a.facing), a.anim === 'walk' ? Math.floor(a.animT * 8) : 0, flash);
  
  fb.raster(r, a.pos.x - cx - 8, a.pos.y - cy - 19 + (a.grabbedBy ? -6 : 0), roll ? 0.5 : 1);
  if (a.slowUntil > w.t) fb.set(a.pos.x - cx, a.pos.y - cy - 22, R.time[4]);
}
export { getFrame };


/** Integer-only camera punch: render a smaller world window, then nearest-neighbour upscale. Never smooth. */
let zoomScratch: FB | null = null;
export function renderWorldZoom(out: FB, w: World, centerX: number, centerY: number, zoom: number, o: RenderOpts) {
  const z = Math.max(1, Math.min(3, Math.round(zoom)));
  if (z === 1) { renderWorld(out, w, centerX - out.w / 2, centerY - out.h / 2, o); return; }
  const iw = Math.max(1, Math.floor(out.w / z)), ih = Math.max(1, Math.floor(out.h / z));
  if (!zoomScratch || zoomScratch.w !== iw || zoomScratch.h !== ih) zoomScratch = new FB(iw, ih);
  renderWorld(zoomScratch, w, centerX - iw / 2, centerY - ih / 2, o);
  for (let y = 0; y < out.h; y++) { const sy = Math.min(ih - 1, Math.floor(y / z)); for (let x = 0; x < out.w; x++) { const sx = Math.min(iw - 1, Math.floor(x / z)); out.px[y * out.w + x] = zoomScratch.px[sy * iw + sx]; } }
}
/** Element-coloured pixel skill banner with a small subtitle. Drawn after the zoom so type stays crisp. */
export function drawBanner(fb: FB, title: string, sub: string, el: El, dark = 0.72, padTop = 4) {
  const rp = R[ELR[el]];
  const fit = Math.max(1, Math.min(3, Math.floor((fb.w - 34) / Math.max(1, title.length * 12))));
  const titleR = vText(title, rp[5], fit, R.k[0]), subR = vText(sub, rp[3], Math.max(1, fit - 1), R.k[0]);
  const barH = Math.min(fb.h - 4, titleR.h + subR.h + 12), y0 = Math.min(fb.h - barH - 4, Math.max(2, padTop)), w = Math.min(fb.w - 8, Math.max(titleR.w, subR.w) + 20);
  for (let y = 0; y < barH; y++) for (let x = 0; x < w; x++) { const checker = ((x + y) & 1) && y > barH - 3; fb.blend(y0 * fb.w + 4 + x, 0xff0c0a10, checker ? 0.35 : dark); }
  for (let x = 0; x < w; x++) { const px = PALETTE[ELC[el]], col = (255 << 24) | (px[2] << 16) | (px[1] << 8) | px[0]; fb.blend(y0 * fb.w + 4 + x, col, 0.9); fb.blend((y0 + barH - 1) * fb.w + 4 + x, col, 0.35); }
  for (let y = 0; y < titleR.h; y++) for (let x = 0; x < titleR.w; x++) { const c = titleR.d[y * titleR.w + x]; if (c) fb.set(4 + 10 + x, y0 + 4 + y, c); }
  for (let y = 0; y < subR.h; y++) for (let x = 0; x < subR.w; x++) { const c = subR.d[y * subR.w + x]; if (c) fb.set(4 + 10 + x, y0 + 6 + titleR.h + y, c); }
}
export function drawLetterbox(fb: FB, px: number) {
  for (let y = 0; y < px; y++) for (let x = 0; x < fb.w; x++) { fb.blend(y * fb.w + x, 0xff07060a, 0.92); fb.blend((fb.h - 1 - y) * fb.w + x, 0xff07060a, 0.92); }
}

/** Impact frame (anime / fighting-game technique): 1 frame of 3-tone silhouette on black, then 1 frame of
 *  inverted silhouette on the element colour, with jagged white spikes from the contact point. Palette-only,
 *  integer, no blur. Disabled by reduced-effects mode. */
function impactFrame(fb: FB, w: World, cx: number, cy: number) {
  const dt = w.t - w.impactFrame.t; if (dt < 0 || dt > 0.06) return;
  const pal = R[ELR[w.impactFrame.el]], sx = Math.round(w.impactFrame.x - cx), sy = Math.round(w.impactFrame.y - cy);
  const k = dt < 0.03 ? 0 : 1, rad = 14 - k * 4;
  // focal: irregular 3-tone star, palette only, no full-frame posterise (that flattened the boss body
  // to one colour and hid gameplay — rejected after viewing the in-world sheet)
  for (let i2 = 0; i2 < 9; i2++) {
    const a = (i2 / 9) * 6.283 + hash2(i2, Math.floor(w.impactFrame.t * 60), 4) * 0.4, L = rad * (0.5 + hash2(i2, 2, 6) * 0.7);
    for (let d = 2; d < L; d += 0.9) { const c = d < L * 0.4 ? R.k[1] : d < L * 0.75 ? pal[5] : pal[3]; fb.set(sx + Math.cos(a) * d, sy + Math.sin(a) * d, c, k ? 0.75 : 1); }
  }
  // (actor outline removed: it filled thin silhouettes with solid colour)

}
