// ============================================================================
// SOH VFX Stage — precise sprite staging for the PixelFX library.
// PRESENTATION ONLY: never mutates game state. Source atlases are drawn
// untouched (nearest-neighbour); hue variants are runtime copies, never files.
//
// Every instance is placed by an explicit ANCHOR in the art's own frame:
//   pivot : the clip's authored origin (floor point / emitter mouth)
//   axis  : (pivot.x, focal.y)  -> rotate acted clips about the actor's hand line
//   focal : light-weighted centre of the clip (impacts)
//   core  : centre of the visual core bounds   base : core bottom-centre
// plus rotation, uniform scale, x-stretch, clip window [from,to], playback
// rate, delay, loop, life, fades, grow, live follow / aim / length.
// Layers: floor (decals under actors) · world (y-sorted) · over (above the
// world) · screen (HUD space).
// ============================================================================
import { LIB, type LibFx } from './library';
import './vfx-pack.css';

export interface Pt { x: number; y: number }
type Src = Pt | (() => Pt | null | undefined);
export type Layer = 'floor' | 'world' | 'over' | 'screen';
export interface FxOpts {
  x?: number; y?: number; follow?: Src; dx?: number; dy?: number;
  anchor?: 'pivot' | 'axis' | 'focal' | 'core' | 'base';
  scale?: number; sx?: number; angle?: number; flipX?: boolean; upright?: boolean;
  aim?: () => number; len?: () => number;
  layer?: Layer; sortY?: number; lift?: number;
  delay?: number; from?: number; to?: number; rate?: number;
  loop?: boolean; life?: number; fadeIn?: number; fadeOut?: number; alpha?: number;
  grow?: [number, number, number];
  hueTo?: number; add?: boolean; tag?: unknown;
}
export interface Inst { fx: LibFx; o: FxOpts; age: number; x: number; y: number; ang: number; end: number; fadeOut: number; dead: boolean; layer: Layer; rot: number }
interface Prim { layer: Layer; age: number; life: number; draw: (g: CanvasRenderingContext2D, t: number, k: number) => void; y: number; dead: boolean; tag?: unknown }

const MAX = 220;
const insts: Inst[] = [];
const prims: Prim[] = [];
let timers: { at: number; fn: () => void }[] = [];
let clock = 0;
let kickCb: (shake: number, flash: number) => void = () => { };
const tints: { col: string; a: number; tin: number; hold: number; out: number; age: number }[] = [];

export const clockMs = () => clock;
export function onKick(cb: (shake: number, flash: number) => void) { kickCb = cb; }
export function kick(shake: number, flash = 0) { kickCb(shake, flash); }
export function after(ms: number, fn: () => void) { timers.push({ at: clock + Math.max(0, ms), fn }); }
export function tint(col: string, a: number, tin: number, hold: number, out: number) { tints.push({ col, a, tin, hold, out, age: 0 }); }
export function has(id: string) { return !!LIB[id]; }
export function def(id: string): LibFx { return LIB[id]; }
/** scale that makes the clip's visual core `px` wide */
export function fit(id: string, px: number) { const f = LIB[id]; return f ? px / Math.max(8, f.core[2] - f.core[0]) : 0.5; }
export function count() { return insts.length + prims.length; }

// ---- images (+ runtime hue variants) --------------------------------------
interface Rec { img: HTMLImageElement; ok: boolean; v: Map<number, HTMLCanvasElement> }
const recs = new Map<string, Rec>();
function rec(u: string): Rec | null {
  let r = recs.get(u);
  if (!r) {
    if (typeof Image === 'undefined') return null;
    const img = new Image(); const nr: Rec = { img, ok: false, v: new Map() }; r = nr;
    img.onload = () => { nr.ok = true; (img as any).decode?.().catch(() => { }); };
    recs.set(u, nr);
    if (u.charCodeAt(0) === 35) { const b64 = packed(u.slice(1)); if (b64) img.src = 'data:image/png;base64,' + b64; }
    else img.src = u;
  }
  return r;
}
/** '#key' pages: base64 of the untouched PNG, stored as `--key:"..."` inside the #vfx-pack rule of
 *  vfx-pack.css. Primary read = scan the inlined <style> text once (independent of any CSSOM
 *  custom-property size limit); fallback = getComputedStyle on the inert #vfx-pack element. */
let packText = '', packIndex: Map<string, [number, number]> | null = null, packStyle: CSSStyleDeclaration | null = null;
export function indexPack(text: string): Map<string, [number, number]> {
  const idx = new Map<string, [number, number]>(), at = text.indexOf('#vfx-pack'); if (at < 0) return idx;
  const re = /--([a-z0-9_-]+):\s*(["'])/g; re.lastIndex = at; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) { const start = re.lastIndex, end = text.indexOf(m[2], start); if (end < 0) break; idx.set(m[1], [start, end]); re.lastIndex = end + 1; }
  return idx;
}
export function packed(key: string): string {
  if (typeof document === 'undefined') return '';
  if (!packIndex) {
    const chunks: string[] = [];
    for (const st of Array.from(document.querySelectorAll('style'))) {
      const t = st.textContent || '';
      if (t.indexOf('#vfx-pack') >= 0) chunks.push(t);
    }
    if (chunks.length) {
      packText = chunks.join('\n');
      packIndex = indexPack(packText);
    } else {
      packIndex = new Map();
    }
  }
  const hit = packIndex.get(key); if (hit) return packText.slice(hit[0], hit[1]);
  if (!packStyle) { let el = document.getElementById('vfx-pack'); if (!el) { el = document.createElement('div'); el.id = 'vfx-pack'; el.hidden = true; document.body.appendChild(el); } packStyle = getComputedStyle(el); }
  return packStyle.getPropertyValue('--' + key).trim().replace(/^["']|["']$/g, '');
}
function hueCopy(img: HTMLImageElement, deg: number): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const g = cv.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, cv.width, cv.height), d = id.data, a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const m0 = 0.213 + 0.787 * c - 0.213 * s, m1 = 0.715 - 0.715 * c - 0.715 * s, m2 = 0.072 - 0.072 * c + 0.928 * s;
  const m3 = 0.213 - 0.213 * c + 0.143 * s, m4 = 0.715 + 0.285 * c + 0.140 * s, m5 = 0.072 - 0.072 * c - 0.283 * s;
  const m6 = 0.213 - 0.213 * c - 0.787 * s, m7 = 0.715 - 0.715 * c + 0.715 * s, m8 = 0.072 + 0.928 * c + 0.072 * s;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const r = d[i], gg = d[i + 1], b = d[i + 2]; d[i] = r * m0 + gg * m1 + b * m2; d[i + 1] = r * m3 + gg * m4 + b * m5; d[i + 2] = r * m6 + gg * m7 + b * m8; }
  g.putImageData(id, 0, 0); return cv;
}
function image(u: string, rot: number): CanvasImageSource | null {
  const r = rec(u); if (!r || !r.ok) return null; if (!rot) return r.img;
  let v = r.v.get(rot); if (!v) { v = hueCopy(r.img, rot); r.v.set(rot, v); } return v;
}
function rotFor(f: LibFx, hueTo?: number) { if (hueTo === undefined) return 0; let d = ((hueTo - f.hue + 540) % 360) - 180; d = Math.round(d / 15) * 15; return Math.abs(d) < 20 ? 0 : d; }
/** Warm every atlas page a few at a time so first casts never hitch. */
export function preload() {
  const all: string[] = []; for (const f of Object.values(LIB)) if (f.fw * f.fh * f.frames < 2_600_000) for (const p of f.pages) all.push(p.u);
  let i = 0; const step = () => { for (let k = 0; k < 3 && i < all.length; k++, i++) rec(all[i]); if (i < all.length) setTimeout(step, 30); }; step();
}

// ---- instances --------------------------------------------------------------
function at(s: Src | undefined): Pt | null { if (!s) return null; const p = typeof s === 'function' ? s() : s; return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null; }
export function fx(id: string, o: FxOpts): Inst | null {
  const f = LIB[id]; if (!f) return null;
  if (insts.length >= MAX) { const i = insts.findIndex(q => q.end !== Infinity); insts.splice(i < 0 ? 0 : i, 1); }
  const rate = o.rate ?? 1, from = o.from ?? 0, to = o.to ?? (f.frames / f.fps) * 1000;
  const clip = Math.max(1, (to - from) / rate);
  const end = o.life !== undefined ? (o.loop ? o.life : Math.min(o.life, clip)) : (o.loop ? Infinity : clip);
  const p = at(o.follow);
  const it: Inst = { fx: f, o, age: 0, x: (p ? p.x : o.x ?? 0) + (o.dx ?? 0), y: (p ? p.y : o.y ?? 0) + (o.dy ?? 0), ang: o.aim ? o.aim() : o.angle ?? 0, end, fadeOut: o.fadeOut ?? 0, dead: false, layer: o.layer ?? 'world', rot: rotFor(f, o.hueTo) };
  insts.push(it); for (const pg of f.pages) rec(pg.u);
  return it;
}
/** Land the clip's own `beat` (ms into the clip) exactly `atMs` from now. */
export function strike(id: string, beat: number, atMs: number, o: FxOpts): Inst | null {
  const rate = o.rate ?? 1, from = o.from ?? 0, lead = Math.max(0, beat - from) / rate;
  return atMs >= lead ? fx(id, { ...o, delay: atMs - lead, from }) : fx(id, { ...o, delay: 0, from: Math.max(from, beat - atMs * rate) });
}
export function release(it: Inst | null | undefined, fade = 180) {
  if (!it || it.dead) return; const el = it.age - (it.o.delay ?? 0);
  if (el < 0) { it.dead = true; return; }
  if (el + fade < it.end) { it.end = el + fade; it.fadeOut = fade; }
}
export function releaseTag(tag: unknown, fade = 180) { for (const it of insts) if (it.o.tag === tag) release(it, fade); for (const p of prims) if (p.tag === tag) p.life = Math.min(p.life, p.age + fade); }
export function prim(layer: Layer, life: number, y: number, draw: Prim['draw'], tag?: unknown) { if (prims.length < 160) prims.push({ layer, age: 0, life, draw, y, dead: false, tag }); }
export function clear() { insts.length = 0; prims.length = 0; timers = []; tints.length = 0; }

export function update(dt: number) {
  clock += dt;
  if (timers.length) { const due = timers.filter(t => t.at <= clock); if (due.length) { timers = timers.filter(t => t.at > clock); for (const t of due) { try { t.fn(); } catch { /* presentation must never break the loop */ } } } }
  for (let i = insts.length - 1; i >= 0; i--) {
    const it = insts[i]; it.age += dt;
    const p = at(it.o.follow); if (p) { it.x = p.x + (it.o.dx ?? 0); it.y = p.y + (it.o.dy ?? 0); }
    if (it.o.aim) it.ang = it.o.aim();
    if (it.dead || it.age - (it.o.delay ?? 0) >= it.end) { it.dead = true; insts.splice(i, 1); }
  }
  for (let i = prims.length - 1; i >= 0; i--) { const p = prims[i]; p.age += dt; if (p.age >= p.life) prims.splice(i, 1); }
  for (let i = tints.length - 1; i >= 0; i--) { const t = tints[i]; t.age += dt; if (t.age >= t.tin + t.hold + t.out) tints.splice(i, 1); }
}

const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
function drawInst(g: CanvasRenderingContext2D, it: Inst, ox: number, oy: number) {
  const o = it.o, f = it.fx, el = it.age - (o.delay ?? 0); if (el < 0) return;
  let a = o.alpha ?? 1; if (o.fadeIn) a *= clamp01(el / o.fadeIn); if (it.fadeOut > 0 && it.end !== Infinity) a *= clamp01((it.end - el) / it.fadeOut);
  if (a <= 0.01) return;
  const rate = o.rate ?? 1, from = o.from ?? 0, to = o.to ?? (f.frames / f.fps) * 1000, span = Math.max(1, to - from);
  const t = from + (o.loop ? (el * rate) % span : Math.min(el * rate, span - 1));
  const frame = Math.max(0, Math.min(f.frames - 1, Math.floor(t * f.fps / 1000)));
  const pg = f.pages.find(p => frame >= p.f && frame < p.f + p.n); if (!pg) return;
  const img = image(pg.u, it.rot); if (!img) return;
  const i = frame - pg.f, sx = (i % pg.c) * f.fw, sy = Math.floor(i / pg.c) * f.fh;
  let s = o.scale ?? 0.5; if (o.grow) { const k = clamp01(el / o.grow[2]); s *= o.grow[0] + (o.grow[1] - o.grow[0]) * (1 - (1 - k) * (1 - k)); }
  const an = o.anchor ?? 'pivot';
  const ax = an === 'focal' ? f.focal[0] : an === 'core' || an === 'base' ? (f.core[0] + f.core[2]) / 2 : f.px;
  const ay = an === 'focal' || an === 'axis' ? f.focal[1] : an === 'core' ? (f.core[1] + f.core[3]) / 2 : an === 'base' ? f.core[3] : f.py;
  const stretch = o.len ? o.len() : o.sx ?? 1;
  g.save(); g.globalAlpha = a; if (o.add) g.globalCompositeOperation = 'lighter'; g.imageSmoothingEnabled = false;
  g.translate(Math.round(it.x + ox), Math.round(it.y - (o.lift ?? 0) + oy)); if (it.ang) g.rotate(it.ang);
  g.scale(s * stretch * (o.flipX ? -1 : 1), s * (o.upright && Math.cos(it.ang) < 0 ? -1 : 1));
  g.drawImage(img, sx, sy, f.fw, f.fh, -ax, -ay, f.fw, f.fh);
  g.restore();
}
function drawLayer(g: CanvasRenderingContext2D, layer: Layer, ox: number, oy: number) {
  for (const p of prims) if (p.layer === layer) { g.save(); if (ox || oy) g.translate(ox, oy); p.draw(g, p.age, p.age / p.life); g.restore(); }
  for (const it of insts) if (it.layer === layer) drawInst(g, it, ox, oy);
}

// ---- compositor hooks ---------------------------------------------------------
/** floor decals: call in world space right after ground telegraphs */
export function drawFloor(g: CanvasRenderingContext2D) { drawLayer(g, 'floor', 0, 0); }
export function depthItems(g: CanvasRenderingContext2D): { y: number; f: () => void }[] {
  const out: { y: number; f: () => void }[] = [];
  for (const it of insts) if (it.layer === 'world' && it.age >= (it.o.delay ?? 0)) out.push({ y: it.y + (it.o.sortY ?? 0), f: () => drawInst(g, it, 0, 0) });
  for (const p of prims) if (p.layer === 'world') out.push({ y: p.y, f: () => { g.save(); p.draw(g, p.age, p.age / p.life); g.restore(); } });
  return out;
}
export function drawOver(g: CanvasRenderingContext2D, cam: Pt) { drawLayer(g, 'over', -Math.round(cam.x), -Math.round(cam.y)); }
export function drawScreen(g: CanvasRenderingContext2D) {
  for (const t of tints) { const k = t.age < t.tin ? t.age / Math.max(1, t.tin) : t.age < t.tin + t.hold ? 1 : 1 - (t.age - t.tin - t.hold) / Math.max(1, t.out); g.save(); g.globalAlpha = clamp01(k) * t.a; g.fillStyle = t.col; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore(); }
  drawLayer(g, 'screen', 0, 0);
}
/** Night: emissive art is re-drawn above the darkness so spells stay vivid. */
export function drawPostNight(g: CanvasRenderingContext2D, cam: Pt, dark: number) {
  if (dark <= 0.05) return; const ox = -Math.round(cam.x), oy = -Math.round(cam.y), k = clamp01(dark * 1.4);
  g.save(); g.globalAlpha = k;
  for (const it of insts) if (it.layer !== 'screen') { const keep = it.o.alpha ?? 1; it.o.alpha = keep * k; drawInst(g, it, ox, oy); it.o.alpha = keep; }
  g.restore();
}

// ---- procedural helpers (crisp pixel lines, used sparingly) --------------------
/** flickering forked arc between two live points */
export function arc(a: Src, b: Src, life: number, col = '#eaf6ff', glow = 'rgba(120,190,255,0.55)', layer: Layer = 'over') {
  prim(layer, life, 1e9, (g, t) => {
    const p0 = at(a), p1 = at(b); if (!p0 || !p1) return;
    const seed = Math.floor(t / 45), dx = p1.x - p0.x, dy = p1.y - p0.y, L = Math.hypot(dx, dy) || 1, n = Math.max(3, Math.round(L / 9)), nx = -dy / L, ny = dx / L;
    const pts: number[] = [p0.x, p0.y];
    for (let i = 1; i < n; i++) { const h = Math.sin((i * 12.9898 + seed * 78.233) * 43758.5453) % 1; const off = h * Math.min(9, L * 0.16); pts.push(p0.x + dx * i / n + nx * off, p0.y + dy * i / n + ny * off); }
    pts.push(p1.x, p1.y);
    for (const [w, c] of [[3, glow], [1, col]] as [number, string][]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(Math.round(pts[0]), Math.round(pts[1])); for (let i = 2; i < pts.length; i += 2) g.lineTo(Math.round(pts[i]), Math.round(pts[i + 1])); g.stroke(); }
  });
}
/** ground ring: r0 -> r1 over life (flattened 0.62 for the top-down floor plane) */
export function ring(p: Src, r0: number, r1: number, life: number, col: string, o: { dash?: number[]; a?: number; w?: number; layer?: Layer; tag?: unknown; flat?: number; pulse?: boolean } = {}) {
  prim(o.layer ?? 'floor', life, -1e9, (g, _t, k) => {
    const c = at(p); if (!c) return; const r = r0 + (r1 - r0) * (1 - (1 - k) * (1 - k));
    g.globalAlpha = (o.a ?? 0.8) * (o.pulse ? 0.55 + 0.45 * Math.sin(k * life / 90) : Math.min(1, (1 - k) * 2.5));
    g.strokeStyle = col; g.lineWidth = o.w ?? 1; if (o.dash) { g.setLineDash(o.dash); g.lineDashOffset = -k * life / 40; }
    g.beginPath(); g.ellipse(Math.round(c.x), Math.round(c.y), Math.max(1, r), Math.max(1, r * (o.flat ?? 1)), 0, 0, Math.PI * 2); g.stroke();
  }, o.tag);
}
