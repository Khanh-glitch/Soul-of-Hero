// ============================================================================
// PixelFX adapter for Soul of Hero (web prototype) — PRESENTATION ONLY.
//
// Renders the accepted PixelFX Foundry pack (244 effects, upstream
// github.com/patch-gg/pixelfx @ a84159688af3..., MIT) inside the real SOH
// Canvas2D renderer. This module NEVER mutates game state: it only reads
// world coordinates and draws. All gameplay authority stays in sim/engine.
//
// Pipeline: gameplay event -> FX id (pixelfxMap) -> presentation profile ->
// world anchor -> instance -> depth/night composition -> cleanup.
//
// Art rules: combined frames already include light (drawn as-is, never
// dimmed/cropped/redrawn); extraShapes:false (no generic shapes added); the
// light channel is ONLY a bounded incremental post-night emission boost.
// ============================================================================
import { PILOT_MANIFEST } from './pixelfx/pilot';

export interface PfxPage { path: string; first: number; count: number; columns: number; rows: number; dimensions: [number, number]; }
export interface PfxEntry {
  id: string; category: string; name: string; desc?: string;
  meta: { fps: number; duration: number; loop: boolean; size: [number, number]; origin: [number, number]; bg: string };
  presentation: { anchor: string; sceneInteraction?: string; emissiveNight?: string; extraShapes?: boolean };
  export: {
    state: string; frames: number; fps: number; frameSize: [number, number]; pivot: [number, number];
    coreBounds: [number, number, number, number]; focalPoint: [number, number]; lightEnergy: number;
    pages: { combined: PfxPage[]; light: PfxPage[] };
  };
}
export type PfxAnchor = 'ground' | 'hover' | 'body' | 'screen';
export interface PfxOpts {
  x: number; y: number; anchor?: PfxAnchor; scale?: number; angle?: number; stretch?: number;
  loop?: boolean; delayMs?: number; maxAgeMs?: number; lift?: number; body?: { x: number; y: number };
}
export interface PfxInst {
  id: string; entry: PfxEntry; x: number; y: number; anchor: PfxAnchor; scale: number; stretch: number;
  angle: number; loop: boolean; t: number; dur: number; maxAgeMs: number; lift: number;
  body: { x: number; y: number } | null; born: number; warp: boolean;
}

// Per-effect world scale. View is 640x360 with a 16px player; atlas frames
// are 64..320px, so every effect gets an authored scale — NO single global
// scale, no raw atlas size on screen.
const SCALE: Record<string, number> = {
  'fire/fireball': 0.72, 'nature/quake': 0.5, 'lightning/chain-lightning': 0.55,
  'ice/frost-nova': 0.5, 'shadow/black-hole': 0.55, 'arcane/arcane-orb': 0.45,
  'ice/ice-lance': 0.8, 'moves/ice-lance-throw': 0.7, 'impacts/impact-frame': 0.35,
  'arcane/spell-charge': 0.6, 'explosions/small-explosion': 0.5,
};
const DEFAULT_SCALE = 0.6;
const MAX_INSTANCES = 48;

const manifest = new Map<string, PfxEntry>();
let fullManifest: Promise<boolean> | null = null;
let base = 'pixelfx-assets/'; // full 244 pack (dev middleware / static host)

// ---- image cache (lazy per atlas page) --------------------------------------
interface ImgState { img: HTMLImageElement | null; err: boolean; p: Promise<HTMLImageElement | null>; }
const imgs = new Map<string, ImgState>();
function loadImg(path: string): Promise<HTMLImageElement | null> {
  let st = imgs.get(path);
  if (!st) {
    const ns: ImgState = { img: null, err: false, p: null as any };
    imgs.set(path, ns);
    ns.p = new Promise(res => {
      if (typeof Image === 'undefined') { res(null); return; } // non-DOM (tests)
      const im = new Image();
      im.onload = () => { ns.img = im; res(im); };
      im.onerror = () => { ns.err = true; res(null); };
      im.src = path.startsWith('data:') ? path : base + path;
    });
    st = ns;
  }
  return st.p;
}
export function pageLoaded(entry: PfxEntry): boolean {
  return entry.export.pages.combined.every(p => { const s = imgs.get(p.path); return !!(s && (s.img || s.err)); });
}
export function isFailed(id: string): boolean {
  const e = manifest.get(id); if (!e) return true;
  return e.export.pages.combined.some(p => imgs.get(p.path)?.err);
}
export function hasEntry(id: string) { return manifest.has(id); }

// ---- init ---------------------------------------------------------------------
export function initPfx(): Promise<boolean> {
  const pilotList: PfxEntry[] = ((PILOT_MANIFEST as any).effects ?? PILOT_MANIFEST) as PfxEntry[];
  for (const e of pilotList) manifest.set(e.id, e);
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('pfxbase') : null;
  if (q) base = q.endsWith('/') ? q : q + '/';
  fullManifest = (typeof fetch === 'undefined' ? Promise.reject(new Error('no fetch')) : fetch(base + 'index.json').then(r => { if (!r.ok) throw new Error('no full pack'); return r.json(); }))
    .then((j: any) => { for (const e of j.effects as PfxEntry[]) if (!manifest.has(e.id)) manifest.set(e.id, e); return true; })
    .catch(() => false);
  return fullManifest;
}
export function fullMode(): Promise<boolean> { return fullManifest ?? Promise.resolve(false); }
export function catalog(): { id: string; name: string; category: string; state: string; loaded: boolean; pilot: boolean }[] {
  const pilotList: PfxEntry[] = ((PILOT_MANIFEST as any).effects ?? PILOT_MANIFEST) as PfxEntry[];
  const pilotIds = new Set(pilotList.map((p: PfxEntry) => p.id));
  return [...manifest.values()].sort((a, b) => a.id.localeCompare(b.id)).map(e => ({
    id: e.id, name: e.name, category: e.category, state: e.export.state,
    loaded: pageLoaded(e), pilot: pilotIds.has(e.id),
  }));
}

// ---- instances ------------------------------------------------------------------
const instances: PfxInst[] = [];
let seenHaz = new WeakSet<object>();
let nowMs = 0;

export function spawn(id: string, o: PfxOpts): PfxInst | null {
  const entry = manifest.get(id);
  if (!entry) return null;
  if (instances.length >= MAX_INSTANCES) {
    const i = instances.findIndex(x => !x.loop);
    if (i >= 0) instances.splice(i, 1); else instances.shift();
  }
  const e = entry.export;
  const inst: PfxInst = {
    id, entry, x: o.x, y: o.y, anchor: o.anchor ?? (entry.presentation.anchor === 'screen' ? 'screen' : 'ground'),
    scale: o.scale ?? SCALE[id] ?? DEFAULT_SCALE, stretch: o.stretch ?? 1, angle: o.angle ?? 0,
    loop: o.loop ?? entry.meta.loop, t: -(o.delayMs ?? 0), dur: (e.frames / e.fps) * 1000,
    maxAgeMs: o.maxAgeMs ?? 0, lift: o.lift ?? 0, body: o.body ?? null,
    born: nowMs, warp: entry.presentation.sceneInteraction === 'warp',
  };
  instances.push(inst);
  for (const chan of ['combined', 'light'] as const) for (const p of entry.export.pages[chan]) loadImg(p.path);
  return inst;
}
export function clear() { instances.length = 0; seenHaz = new WeakSet(); }
export function listInstances() { return instances.slice(); }

export function update(dtMs: number, now: number) {
  nowMs = now;
  for (let i = instances.length - 1; i >= 0; i--) {
    const inst = instances[i];
    inst.t += dtMs;
    if (inst.body) { inst.x = inst.body.x; inst.y = inst.body.y; }
    if (inst.t < 0) continue;
    if ((inst.t >= inst.dur && !inst.loop) || (inst.maxAgeMs > 0 && now - inst.born >= inst.maxAgeMs)) instances.splice(i, 1);
  }
}

// ---- frame lookup ---------------------------------------------------------------
export function frameOf(entry: PfxEntry, tMs: number): number {
  const e = entry.export;
  const f = Math.floor((tMs / 1000) * e.fps);
  return entry.meta.loop ? ((f % e.frames) + e.frames) % e.frames : Math.min(e.frames - 1, Math.max(0, f));
}
function pageCell(entry: PfxEntry, chan: 'combined' | 'light', frame: number):
  { img: HTMLImageElement | null; sx: number; sy: number; sw: number; sh: number } | null {
  for (const p of entry.export.pages[chan]) {
    if (frame >= p.first && frame < p.first + p.count) {
      const local = frame - p.first;
      const cw = p.dimensions[0] / p.columns, ch = p.dimensions[1] / p.rows;
      const col = local % p.columns, row = Math.floor(local / p.columns);
      return { img: imgs.get(p.path)?.img ?? null, sx: col * cw, sy: row * ch, sw: cw, sh: ch };
    }
  }
  return null;
}

// ---- placement --------------------------------------------------------------------
// Dest rect (px, unrotated) for an instance frame; offX/offY shift the whole
// placement (used to convert world->screen in the post-night pass).
function destRect(inst: PfxInst, offX = 0, offY = 0) {
  const e = inst.entry.export;
  const [fw, fh] = e.frameSize; const s = inst.scale; const [x0, y0, x1, y1] = e.coreBounds;
  const coreCx = (x0 + x1) / 2, coreH = y1 - y0;
  const x = inst.x + offX, y = inst.y + offY;
  let dx: number, dy: number, rotX: number, rotY: number;
  if (inst.anchor === 'ground') {
    const sink = Math.max(2, coreH * s * 0.08); // grounded: core bottom + small sink
    dx = x - coreCx * s; dy = y - y1 * s + sink; rotX = x; rotY = y;
  } else if (inst.anchor === 'screen') {
    dx = x - e.pivot[0] * s; dy = y - e.pivot[1] * s; rotX = x; rotY = y;
  } else { // hover / body
    const lift = inst.lift || coreH * s * 0.6;
    dx = x - e.pivot[0] * s; dy = (y - lift) - e.pivot[1] * s; rotX = x; rotY = y - lift;
  }
  return { dx, dy, dw: fw * s * inst.stretch, dh: fh * s, rotX, rotY };
}

function drawFrame(g: CanvasRenderingContext2D, inst: PfxInst, chan: 'combined' | 'light', alpha: number,
  comp: GlobalCompositeOperation, offX = 0, offY = 0) {
  if (inst.t < 0 || alpha <= 0.001) return;
  const cell = pageCell(inst.entry, chan, frameOf(inst.entry, inst.t));
  if (!cell || !cell.img) return;
  const r = destRect(inst, offX, offY);
  g.save();
  g.globalAlpha = alpha; g.globalCompositeOperation = comp;
  if (inst.angle) { g.translate(r.rotX, r.rotY); g.rotate(inst.angle); g.translate(-r.rotX, -r.rotY); }
  g.drawImage(cell.img, cell.sx, cell.sy, cell.sw, cell.sh, Math.round(r.dx), Math.round(r.dy), Math.round(r.dw), Math.round(r.dh));
  g.restore();
}

// ---- passes called by render.ts ---------------------------------------------------
// Depth items for the y-sorted world draw list (non-warp, non-screen, visible).
export function depthItems(g: CanvasRenderingContext2D): { y: number; f: () => void }[] {
  const out: { y: number; f: () => void }[] = [];
  for (const inst of instances) {
    if (inst.warp || inst.anchor === 'screen' || inst.t < 0) continue;
    out.push({ y: inst.anchor === 'ground' ? inst.y : inst.y - 6, f: () => drawFrame(g, inst, 'combined', 1, 'source-over') });
  }
  return out;
}

// Warp pass (black hole): distort a localized cached snapshot of what is
// already on the canvas (terrain, structures, actors, other FX), then draw
// the effect art on top. SCREEN space, called after g.restore().
const warpCache = { cv: (typeof document !== 'undefined' ? document.createElement('canvas') : null) as HTMLCanvasElement | null, at: -1, x: 0, y: 0, r: 0 };
export function drawWarpPass(g: CanvasRenderingContext2D, cam: { x: number; y: number }, now: number) {
  const warps = instances.filter(i => i.warp && i.t >= 0);
  if (!warps.length) return;
  for (const inst of warps) {
    const r0 = destRect(inst);
    const cx = r0.rotX - cam.x, cy = r0.rotY - cam.y;
    const rad = Math.max(r0.dw, r0.dh) * 0.62 + 14;
    if (!warpCache.cv) return;
    if (now - warpCache.at > 80 || warpCache.r !== rad || Math.abs(warpCache.x - cx) > 4 || Math.abs(warpCache.y - cy) > 4) {
      const W = Math.ceil(rad * 2), H = Math.ceil(rad * 2);
      if (warpCache.cv.width !== W || warpCache.cv.height !== H) { warpCache.cv.width = W; warpCache.cv.height = H; }
      const wg = warpCache.cv.getContext('2d')!;
      wg.clearRect(0, 0, W, H);
      wg.drawImage(g.canvas, Math.round(cx - rad), Math.round(cy - rad), W, H, 0, 0, W, H);
      warpCache.at = now; warpCache.x = cx; warpCache.y = cy; warpCache.r = rad;
    }
    // radial pull toward the focal point, in horizontal slices (cached, localized)
    const focal = inst.entry.export.focalPoint;
    const fy = cy + (focal[1] - inst.entry.export.frameSize[1] / 2) * inst.scale;
    const slices = 22, sliceH = (rad * 2) / slices;
    const t01 = Math.min(1, inst.t / 900);
    for (let i = 0; i < slices; i++) {
      const sy = i * sliceH;
      const midY = cy - rad + sy + sliceH / 2;
      const fall = Math.max(0, 1 - Math.abs(midY - cy) / rad);
      const pinch = (6 + 26 * fall * fall) * t01 * Math.max(0, 1 - Math.abs(midY - fy) / (rad * 1.2));
      g.drawImage(warpCache.cv, 0, Math.round(sy), warpCache.cv.width, Math.ceil(sliceH),
        Math.round(cx - rad + pinch), Math.round(warpCache.y - rad + sy), Math.round(rad * 2 - pinch * 2), Math.ceil(sliceH));
    }
    // the effect art itself
    const cell = pageCell(inst.entry, 'combined', frameOf(inst.entry, inst.t));
    if (cell?.img) {
      g.save();
      g.drawImage(cell.img, cell.sx, cell.sy, cell.sw, cell.sh,
        Math.round(cx - inst.entry.export.pivot[0] * inst.scale), Math.round(cy - inst.entry.export.pivot[1] * inst.scale),
        Math.round(r0.dw), Math.round(r0.dh));
      g.restore();
    }
  }
}

// Screen-anchored instances (screen space, after restore).
export function drawScreen(g: CanvasRenderingContext2D) {
  for (const inst of instances) {
    if (inst.anchor !== 'screen' || inst.warp || inst.t < 0) continue;
    drawFrame(g, inst, 'combined', 1, 'source-over');
  }
}

// Post-night bounded emission: light channel ONLY, additive, alpha bounded by
// night darkness — incremental boost so skill art stays luminous after the
// night overlay. The base frame is never redrawn here.
export function drawEmission(g: CanvasRenderingContext2D, cam: { x: number; y: number }, dark: number) {
  if (dark <= 0.02) return;
  for (const inst of instances) {
    if (inst.t < 0 || inst.warp) continue;
    const le = inst.entry.export.lightEnergy;
    if (le < 0.5) continue;
    const alpha = Math.min(0.55, 0.18 + dark * 0.5) * Math.min(1, le / 6);
    drawFrame(g, inst, 'light', alpha, 'lighter', -cam.x, -cam.y);
  }
}

// ---- gameplay hooks (presentation only) -------------------------------------------
const projFx = new Map<object, number>();
export function cleanupProjFx(projs: any[]) {
  for (const k of [...projFx.keys()]) if (!projs.includes(k)) projFx.delete(k);
}
// Fireball: authored directional FX riding the REAL projectile each frame.
export function drawProjFx(g: CanvasRenderingContext2D, pr: any, now: number) {
  if (pr.kind !== 'fireball') return;
  if (!projFx.has(pr)) projFx.set(pr, now);
  const entry = manifest.get('fire/fireball');
  if (!entry) return;
  const t = now - (projFx.get(pr) ?? now);
  const fake: PfxInst = {
    id: 'fire/fireball', entry, x: pr.x, y: pr.y, anchor: 'hover', scale: SCALE['fire/fireball'], stretch: 1,
    angle: Math.atan2(pr.vy, pr.vx), loop: true, t, dur: 1e9, maxAgeMs: 0, lift: 0, body: null, born: now, warp: false,
  };
  drawFrame(g, fake, 'combined', 1, 'source-over');
}

// Hazard -> FX sync (reads HAZ, never writes). Called once per frame from render.
export function syncHazards(hazards: any[], player: { x: number; y: number; aim: number }) {
  for (const h of hazards) {
    if (seenHaz.has(h)) continue;
    seenHaz.add(h);
    if (h.effect === 'quake') spawn('nature/quake', { x: h.x, y: h.y, anchor: 'ground', angle: player.aim, delayMs: h.tell ?? 0, scale: 0.46 });
    else if (h.style === 'frostnova') spawn('ice/frost-nova', { x: h.x, y: h.y, anchor: 'ground', delayMs: h.tell ?? 0 });
  }
}

// ---- stats --------------------------------------------------------------------------
const stats = { fps: 0, frameMs: 0, instances: 0 };
let ema = 16.7;
export function tickStats(dtMs: number) { ema = ema * 0.9 + dtMs * 0.1; stats.fps = 1000 / ema; stats.frameMs = ema; stats.instances = instances.length; }
export function getStats() { return { ...stats }; }
