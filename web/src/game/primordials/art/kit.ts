import { Raster, volume, hex, RGBA, Pt, hash2, outline } from './raster';

// ---------------- Global indexed palette (all bosses + VFX share one index space) -------------
const PAL: RGBA[] = [[0, 0, 0, 0]];
export const R: Record<string, number[]> = {};
function ramp(name: string, cols: string[], alpha = 255) { R[name] = cols.map((c) => { PAL.push(hex(c, alpha)); return PAL.length - 1; }); }
// SURTUR (red / volcanic)
ramp('s_out', ['#0a0608']);
ramp('obs', ['#0d0b14', '#1a1726', '#2a2639', '#3f3a54', '#5d5878']);
ramp('char', ['#1b0f0f', '#33191a', '#4d2420', '#6b3528', '#8a4a34']);
ramp('lava', ['#4a0a0e', '#8e1410', '#d23a10', '#ff7b1c', '#ffc23d', '#fff4c4']);
ramp('horn', ['#1e1614', '#3a2c26', '#5e4a3e', '#8c765f', '#bfa888']);
ramp('ash', ['#2a2426', '#463c3c', '#6a5c58']);
// TYPHON (purple / force)
ramp('t_out', ['#0a0612']);
ramp('plate', ['#120c1c', '#24183a', '#3a2858', '#584080', '#8068b0']);
ramp('hide', ['#170e1e', '#2b1a36', '#452a52', '#664274', '#8c66a0']);
ramp('scale', ['#100c24', '#221a48', '#38307a', '#5a4ea8', '#8c80d0']);
ramp('belly', ['#5a4a6a', '#8a78a0', '#b8a6d0']);
ramp('force', ['#2a0e4a', '#5a1a96', '#9a3ce0', '#c77cff', '#ecc8ff', '#ffffff']);
ramp('claw', ['#6a6056', '#b0a490', '#e8dfcc']);
ramp('rock', ['#16121c', '#2a2430', '#433a48', '#635868', '#8a7e8c']);
// AION (green / time)
ramp('a_out', ['#040a06']);
ramp('robe', ['#07110c', '#0f2219', '#1a3828', '#2a543c', '#3f7454']);
ramp('bronze', ['#2a1d0c', '#4d3614', '#7a5a22', '#b08a3a', '#e8c878']);
ramp('mane', ['#221c12', '#3e3420', '#625434', '#8c7c50', '#bcac7c']);
ramp('time', ['#0a2a14', '#127a3a', '#2fc060', '#7af59a', '#c8ffd8', '#f4fff6']);
ramp('bone', ['#5a564a', '#8a8474', '#bab4a0', '#e4dfcc']);
ramp('steel', ['#20282a', '#3a4644', '#647672', '#a2b4ae', '#e0f0ea']);
// ATLAS (blue / space)
ramp('b_out', ['#03050e']);
ramp('armor', ['#0a0f24', '#141d42', '#20305f', '#33498a', '#5470b8']);
ramp('mantle', ['#0e0820', '#1c123e', '#2c1f60', '#423488', '#5e50ae']);
ramp('astone', ['#14182a', '#262c44', '#3e4664', '#646e90', '#9aa4c4']);
ramp('space', ['#050a30', '#1238a0', '#2a78e8', '#5ec0ff', '#b8ecff', '#ffffff']);
ramp('void', ['#020208', '#080a1c']);
ramp('star', ['#fff4c0']);
// ARGUS (yellow / mind)
ramp('g_out', ['#0a0702']);
ramp('regal', ['#100c05', '#211a0b', '#362a11', '#524018', '#765c24']);
ramp('gold', ['#3a2808', '#6e4e0e', '#b08418', '#e8bc30', '#fff07a']);
ramp('eyew', ['#9a8e70', '#d8ceb0', '#fffbe8']);
ramp('iris', ['#5a2604', '#b85a08', '#f09a20']);
ramp('pupil', ['#0a0604']);
ramp('mind', ['#3a2a04', '#8a6408', '#e0a810', '#ffd84a', '#fff2a8', '#ffffff']);
ramp('flesh', ['#3a2418', '#5e3c28', '#86583a']);
// ANUBIS (orange / soul)
ramp('n_out', ['#050508']);
ramp('jet', ['#08080c', '#14141c', '#22222e', '#363646', '#54546e']);
ramp('fgold', ['#2e1c06', '#5a3a0c', '#8e6216', '#c89428', '#f4cc64']);
ramp('lapis', ['#0e1a44', '#1e3478', '#3a5cb8']);
ramp('soul', ['#2a0e02', '#7a3204', '#d06a0a', '#ffa22a', '#ffd890', '#fff8e8']);
ramp('linen', ['#4a3e32', '#6e5e4a', '#a89878', '#d8ccb0']);
// shared / misc
ramp('k', ['#000000', '#ffffff']);
ramp('pl', ['#141420', '#26385e', '#3e64a8', '#78a8e8', '#e8d4a8', '#b02828', '#f0e8d0']);
ramp('dummy', ['#2a2018', '#5a4228', '#8a6a40', '#c0a070']);
ramp('shadow', ['#000000'], 90);
ramp('ghostA', ['#ffa22a', '#ffd890'], 150);
ramp('ghostT', ['#2fc060', '#c8ffd8'], 140);
ramp('ghostS', ['#2a78e8', '#b8ecff'], 150);
export const PALETTE = PAL;

// ---------------- Pose & clip model ----------------
export type Dir = 'down' | 'up' | 'left' | 'right';
export const DIRS: Dir[] = ['down', 'left', 'right', 'up'];
export interface Pose {
  bob?: number; lean?: number; crouch?: number; twist?: number;
  legL?: number; legR?: number; liftL?: number; liftR?: number; spread?: number;
  wA?: number; reach?: number; wB?: number; offReach?: number; grip2?: number;
  glow?: number; charge?: number; open?: number; smear?: number;
  kneel?: number; fall?: number; dissolve?: number; hurt?: number;
  tailA?: number; tailB?: number; punchL?: number; punchR?: number; hands?: number;
  head?: number; wing?: number; manifest?: number; spec?: string; f?: number;
}
export interface ClipFrame { p: Pose; ms: number; ev?: string; root?: [number, number] }
export interface Clip { name: string; frames: ClipFrame[]; loop: boolean; events: { frame: number; tag: string }[] }

export const FACE_ANG: Record<Dir, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
/** Map facing-local weapon angle (0 forward, -PI/2 raised/out, -PI overhead-behind, +PI/2 follow-through) to screen angle. */
export function wScreen(dir: Dir, phi: number) {
  switch (dir) {
    case 'right': return phi;
    case 'left': return Math.PI - phi;
    case 'down': return Math.PI / 2 - phi;
    case 'up': return phi >= -Math.PI / 2 ? -Math.PI / 2 - phi : Math.PI / 2 + phi;
  }
}

// ---------------- Draw context ----------------
export type LayerName = 'back' | 'body' | 'weapon' | 'emit';
export const LAYERS: LayerName[] = ['back', 'body', 'weapon', 'emit'];
export interface Anchors { [k: string]: [number, number] }

export class DC {
  layers: Record<LayerName, Raster>;
  cur: Raster;
  dir: Dir; s: number; side: boolean; front: boolean; backv: boolean;
  ox: number; oy: number; p: Pose; f: number; anchors: Anchors = {};
  w: number; h: number; ult: boolean; order: LayerName[] = ['back', 'body', 'weapon', 'emit'];
  constructor(w: number, h: number, ox: number, oy: number, dir: Dir, p: Pose, f: number, ult: boolean) {
    this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.dir = dir; this.p = p; this.f = f; this.ult = ult;
    this.layers = { back: new Raster(w, h), body: new Raster(w, h), weapon: new Raster(w, h), emit: new Raster(w, h) };
    this.cur = this.layers.body;
    this.s = dir === 'left' ? -1 : 1;
    this.side = dir === 'left' || dir === 'right';
    this.front = dir === 'down'; this.backv = dir === 'up';
  }
  L(n: LayerName) { this.cur = this.layers[n]; return this; }
  X(x: number) { return this.ox + this.s * x; }
  Y(y: number) { return this.oy + y; }
  pt(x: number, y: number): Pt { return [this.X(x), this.Y(y)]; }
  anchor(name: string, x: number, y: number) { this.anchors[name] = [Math.round(this.X(x) - this.ox), Math.round(this.Y(y) - this.oy)]; }
  anchorScreen(name: string, sx: number, sy: number) { this.anchors[name] = [Math.round(sx - this.ox), Math.round(sy - this.oy)]; }
  mask() { return new Raster(this.w, this.h); }
  /** volume-shaded part from a mask-drawing callback in local coords */
  part(draw: (m: Raster) => void, rp: number[], band = 1) { const m = scratch(this.w, this.h); m.clearBox(); draw(m); volume(this.cur, m, rp, band, this.f); return m; }
  limb(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, rp: number[], band = 1) {
    return this.part((m) => m.taper(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), r0, r1, 1), rp, band);
  }
  /** limb in screen coords (already transformed) */
  limbS(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, rp: number[], band = 1) {
    return this.part((m) => m.taper(x0, y0, x1, y1, r0, r1, 1), rp, band);
  }
  blob(pts: Pt[], rp: number[], band = 1) { return this.part((m) => m.poly(pts.map(([x, y]) => this.pt(x, y)), 1), rp, band); }
  blobS(pts: Pt[], rp: number[], band = 1) { return this.part((m) => m.poly(pts, 1), rp, band); }
  ov(cx: number, cy: number, rx: number, ry: number, rp: number[], band = 1) { return this.part((m) => m.oval(this.X(cx), this.Y(cy), rx, ry, 1), rp, band); }
  px(x: number, y: number, c: number) { this.cur.set(this.X(x), this.Y(y), c); }
  pxo(x: number, y: number, c: number) { this.cur.over(this.X(x), this.Y(y), c); }
  ln(x0: number, y0: number, x1: number, y1: number, c: number) { this.cur.line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), c); }
  /** jagged animated flame tongues rising from a base line (screen coords). */
  flames(x0: number, x1: number, by: number, hgt: number, rp: number[], seed: number, layer: Raster = this.cur) {
    const fr = this.f;
    for (let x = Math.round(Math.min(x0, x1)); x <= Math.round(Math.max(x0, x1)); x++) {
      const u = (x - x0) / Math.max(1, x1 - x0);
      const env = Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 0.6;
      const n = hash2(x >> 1, (fr + seed) >> 0, seed) * 0.55 + hash2(x >> 2, fr + 7, seed + 3) * 0.45;
      const hh = Math.round(hgt * env * (0.35 + n * 0.85));
      for (let j = 0; j < hh; j++) {
        const t = j / Math.max(1, hh);
        const k = t < 0.25 ? rp.length - 1 : t < 0.5 ? rp.length - 2 : t < 0.78 ? rp.length - 3 : rp.length - 4;
        if (t > 0.7 && hash2(x, j + fr * 3, seed) < 0.35) continue; // tongue breakup
        layer.set(x, by - j, rp[Math.max(0, k)]);
      }
    }
  }
  finish(outC: number, glow: Record<number, number>) {
    // merge back < body < weapon < emit into body for outline evaluation (layers kept separately too)
    return outlineLayers(this, outC, glow);
  }
}

const SCR = new Map<number, Raster>();
function scratch(w: number, h: number) { const k = w * 10000 + h; let r = SCR.get(k); if (!r) { r = new Raster(w, h); SCR.set(k, r); } return r; }
function outlineLayers(dc: DC, outC: number, glow: Record<number, number>) {
  const comp = new Raster(dc.w, dc.h);
  for (const n of dc.order) comp.blit(dc.layers[n], 0, 0);
  outline(comp, outC, glow);
  // write outline pixels (those not in any layer) into the back layer so layered export stays faithful
  for (let i = 0; i < comp.d.length; i++) {
    if (!comp.d[i]) continue;
    let inLayer = false;
    for (const n of LAYERS) if (dc.layers[n].d[i]) { inLayer = true; break; }
    if (!inLayer) dc.layers.back.d[i] = comp.d[i];
  }
  return comp;
}

/** pixel dissolve: removes pixels by hashed threshold (death), returns removed count */
export function dissolve(r: Raster, amt: number, seed: number, emberC: number) {
  if (amt <= 0) return;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const i = y * r.w + x; if (!r.d[i]) continue;
    const h = hash2(x >> 1, y >> 1, seed) * 0.7 + (1 - y / r.h) * 0.3;
    if (h < amt) r.d[i] = h > amt - 0.04 ? emberC : 0;
  }
}
