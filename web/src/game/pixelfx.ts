// ============================================================================
// PixelFX presentation compositor for Soul of Hero (web prototype) — v2.
// PRESENTATION ONLY: this module never mutates game state; all gameplay
// authority stays in sim.ts/engine.ts.
//
// Universal pipeline:
//   official PixelFX art (combined channel, drawn byte-faithful)
//   -> world placement (family profile: ground/hover/body/proj/screen)
//   -> depth/occlusion (joins the game's y-sorted world list; roofs occlude)
//   -> warp scene response (black hole distorts the REAL scene, art undistorted)
//   -> colored environmental radiance (soft light, derived from source metadata)
//   -> night-safe emission (bounded incremental light-channel boost post-night)
//   -> lifecycle -> cleanup
//
// Rules: combined channel already includes upstream light — drawn as-is, never
// dimmed/cropped/redrawn; extraShapes:false (no generic rings/circles drawn);
// the light channel is only a bounded post-night incremental boost; radiance is
// a soft illumination falloff, not a drawn geometric decoration.
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
export type PfxFamily = 'ground' | 'hover' | 'body' | 'screen' | 'proj';
export interface PfxOpts {
  x: number; y: number; family?: PfxFamily; scale?: number; scaleMul?: number; angle?: number; stretch?: number;
  loop?: boolean; delayMs?: number; maxAgeMs?: number; lift?: number; body?: { x: number; y: number };
  follow?: { x: number; y: number; vx?: number; vy?: number }; // proj: live position source
}
export interface PfxInst {
  id: string; entry: PfxEntry; family: PfxFamily; x: number; y: number; scale: number; stretch: number;
  angle: number; loop: boolean; t: number; dur: number; maxAgeMs: number; lift: number;
  body: { x: number; y: number } | null; follow: PfxOpts['follow'] | null; born: number; warp: boolean;
  warpCache: { cv: HTMLCanvasElement | null; at: number; x: number; y: number; r: number };
}

// ---- declarative presentation data (not per-effect renderers) --------------
// Curated scale overrides for pilot/gameplay ids; generic default below derives
// from core bounds so the system works for any registered id.
const SCALE: Record<string, number> = {
  'fire/fireball': 0.72, 'nature/quake': 0.5, 'lightning/chain-lightning': 0.55,
  'ice/frost-nova': 0.5, 'shadow/black-hole': 0.62, 'arcane/arcane-orb': 0.8,
  'ice/ice-lance': 0.85, 'moves/ice-lance-throw': 0.7, 'impacts/impact-frame': 0.4,
  'arcane/spell-charge': 1.0, 'explosions/small-explosion': 0.5,
};
// Radiance tint per category (soft illumination color); override per id here.
const TINT_CAT: Record<string, string> = {
  fire: '#ff9a3a', ice: '#7ad0ff', arcane: '#b060ff', shadow: '#a050e0', lightning: '#cfe8ff',
  nature: '#d8a050', holy: '#ffe9a0', explosions: '#ff7a3a', critters: '#a0e060', moves: '#9ad0ff',
};
const TINT: Record<string, string> = { 'shadow/black-hole': '#b050ff', 'arcane/arcane-orb': '#a050ff', 'ice/ice-lance': '#6ac8ff' };
function tintOf(e: PfxEntry) { return TINT[e.id] ?? TINT_CAT[e.category] ?? '#c0d0ff'; }
// Generic scale default: fit the visual core to a family-appropriate world
// footprint (world is 640x360, tiles 16px, player 16px tall).
function defaultScale(entry: PfxEntry, family: PfxFamily): number {
  const [x0, y0, x1, y1] = entry.export.coreBounds;
  const coreH = Math.max(4, y1 - y0), coreW = Math.max(4, x1 - x0);
  const targetH = family === 'proj' ? 20 : family === 'screen' ? 90 : family === 'hover' ? 34 : 44;
  const targetW = family === 'proj' ? 64 : 999;
  let s = targetH / coreH;
  if (targetW < 999) s = Math.min(s, targetW / coreW);
  return Math.min(2.2, Math.max(0.18, s));
}
const MAX_INSTANCES = 48;
const MAX_CACHED_PAGES = 40; // LRU budget for fetch-based atlas pages (pilot data-URLs never evicted)

type Quality = 'high' | 'balanced' | 'performance';
const quality: { name: Quality; warpSlices: number; warpMs: number; radiance: boolean; emissionCap: number } = {
  name: 'high', warpSlices: 22, warpMs: 80, radiance: true, emissionCap: 0.6,
};
export function setQuality(q: Quality) {
  quality.name = q;
  if (q === 'high') { quality.warpSlices = 22; quality.warpMs = 80; quality.radiance = true; quality.emissionCap = 0.6; }
  else if (q === 'balanced') { quality.warpSlices = 14; quality.warpMs = 140; quality.radiance = true; quality.emissionCap = 0.55; }
  else { quality.warpSlices = 10; quality.warpMs = 220; quality.radiance = false; quality.emissionCap = 0.5; }
}
export function getQuality() { return quality.name; }

// ---- manifest + lazy page cache ----------------------------------------------
const manifest = new Map<string, PfxEntry>();
let fullManifest: Promise<boolean> | null = null;
let base = 'pixelfx-assets/';
interface ImgState { img: HTMLImageElement | null; err: boolean; p: Promise<HTMLImageElement | null>; pilot: boolean; last: number; }
const imgs = new Map<string, ImgState>();
const pageOrder: string[] = [];
function loadImg(path: string, pilot: boolean): Promise<HTMLImageElement | null> {
  let st = imgs.get(path);
  if (!st) {
    const ns: ImgState = { img: null, err: false, p: null as any, pilot, last: 0 };
    imgs.set(path, ns); pageOrder.push(path); st = ns;
    ns.p = new Promise(res => {
      if (typeof Image === 'undefined') { res(null); return; }
      const im = new Image();
      im.onload = () => { ns.img = im; res(im); };
      im.onerror = () => { ns.err = true; res(null); };
      im.src = path.startsWith('data:') ? path : base + path;
    });
    evictIfNeeded();
  }
  if (st) st.last = performance.now();
  return st ? st.p : Promise.resolve(null);
}
function evictIfNeeded() {
  const fetchPages = pageOrder.filter(p => !imgs.get(p)!.pilot);
  while (fetchPages.length > MAX_CACHED_PAGES) {
    const victim = fetchPages.shift()!;
    const st = imgs.get(victim);
    if (st && !st.pilot) { imgs.delete(victim); const i = pageOrder.indexOf(victim); if (i >= 0) pageOrder.splice(i, 1); }
    else break;
  }
}
export function pageLoaded(entry: PfxEntry): boolean {
  return entry.export.pages.combined.every(p => { const s = imgs.get(p.path); return !!(s && (s.img || s.err)); });
}
export function isFailed(id: string): boolean {
  const e = manifest.get(id); if (!e) return true;
  return e.export.pages.combined.some(p => imgs.get(p.path)?.err);
}
export function hasEntry(id: string) { return manifest.has(id); }

export function initPfx(): Promise<boolean> {
  const pilotList: PfxEntry[] = ((PILOT_MANIFEST as any).effects ?? PILOT_MANIFEST) as PfxEntry[];
  for (const e of pilotList) manifest.set(e.id, e);
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('pfxbase') : null;
  if (q) base = q.endsWith('/') ? q : q + '/';
  if (typeof location !== 'undefined' && location.protocol === 'file:') return (fullManifest = Promise.resolve(false)); // offline single-file: pilot only, no fetch noise
  fullManifest = (typeof fetch === 'undefined' ? Promise.reject(new Error('no fetch')) : fetch(base + 'index.json').then(r => { if (!r.ok) throw new Error('no full pack'); return r.json(); }))
    .then((j: any) => { for (const e of j.effects as PfxEntry[]) if (!manifest.has(e.id)) manifest.set(e.id, e); return true; })
    .catch(() => false);
  return fullManifest;
}
export function fullMode(): Promise<boolean> { return fullManifest ?? Promise.resolve(false); }
export function catalog(): { id: string; name: string; category: string; state: string; loaded: boolean; pilot: boolean }[] {
  const pilotIds = new Set(((PILOT_MANIFEST as any).effects ?? PILOT_MANIFEST).map((p: any) => p.id));
  return [...manifest.values()].sort((a, b) => a.id.localeCompare(b.id)).map(e => ({
    id: e.id, name: e.name, category: e.category, state: e.export.state,
    loaded: pageLoaded(e), pilot: pilotIds.has(e.id),
  }));
}

// ---- instances -----------------------------------------------------------------
const instances: PfxInst[] = [];
let seenHaz = new WeakSet<object>();
let nowMs = 0;
let paused = false;

export function spawn(id: string, o: PfxOpts): PfxInst | null {
  const entry = manifest.get(id);
  if (!entry) return null;
  if (instances.length >= MAX_INSTANCES) {
    const i = instances.findIndex(x => !x.loop);
    if (i >= 0) instances.splice(i, 1); else instances.shift();
  }
  const e = entry.export;
  const family: PfxFamily = o.family ?? (entry.presentation.anchor === 'screen' ? 'screen' : entry.presentation.anchor === 'act' ? 'body' : 'ground');
  const inst: PfxInst = {
    id, entry, family, x: o.x, y: o.y,
    scale: (o.scale ?? SCALE[id] ?? defaultScale(entry, family)) * (o.scaleMul ?? 1),
    stretch: o.stretch ?? 1, angle: o.angle ?? 0,
    loop: o.loop ?? entry.meta.loop, t: -(o.delayMs ?? 0), dur: (e.frames / e.fps) * 1000,
    maxAgeMs: o.maxAgeMs ?? 0, lift: o.lift ?? 0, body: o.body ?? null, follow: o.follow ?? null,
    born: nowMs, warp: entry.presentation.sceneInteraction === 'warp',
    warpCache: { cv: null, at: -1, x: 0, y: 0, r: 0 },
  };
  instances.push(inst);
  const pilot = (PILOT_MANIFEST as any).effects?.some((p: any) => p.id === id) ?? false;
  for (const chan of ['combined', 'light'] as const) for (const p of entry.export.pages[chan]) loadImg(p.path, pilot);
  return inst;
}
export function clear() { instances.length = 0; seenHaz = new WeakSet(); }
export function listInstances() { return instances.slice(); }
export function setPaused(p: boolean) { paused = p; }
export function isPaused() { return paused; }
export function scrub(ms: number) { for (const i of instances) i.t += ms; }

export function update(dtMs: number, now: number) {
  nowMs = now;
  if (!paused) for (const inst of instances) inst.t += dtMs;
  for (let i = instances.length - 1; i >= 0; i--) {
    const inst = instances[i];
    if (inst.follow) { inst.x = inst.follow.x; inst.y = inst.follow.y; if (inst.follow.vx !== undefined) inst.angle = Math.atan2(inst.follow.vy ?? 0, inst.follow.vx); }
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

// ---- unified placement (one geometry path for every pass) ------------------------
// offX/offY convert world->screen in post passes. Returns dest rect + rotation pivot.
export function destRect(inst: PfxInst, offX = 0, offY = 0) {
  const e = inst.entry.export;
  const [fw, fh] = e.frameSize; const s = inst.scale; const [x0, y0, x1, y1] = e.coreBounds;
  const coreCx = (x0 + x1) / 2, coreH = y1 - y0;
  const x = inst.x + offX, y = inst.y + offY;
  let dx: number, dy: number, rotX: number, rotY: number;
  if (inst.family === 'ground') {
    const sink = Math.max(2, coreH * s * 0.08); // grounded: core bottom + small sink
    dx = x - coreCx * s; dy = y - y1 * s + sink; rotX = x; rotY = y;
  } else if (inst.family === 'screen') {
    dx = x - e.pivot[0] * s; dy = y - e.pivot[1] * s; rotX = x; rotY = y;
  } else { // hover / body / proj
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
  if (chan === 'combined') g.imageSmoothingEnabled = false; // crisp pixel art, matches the rest of the game
  if (inst.angle) { g.translate(r.rotX, r.rotY); g.rotate(inst.angle); g.translate(-r.rotX, -r.rotY); }
  g.drawImage(cell.img, cell.sx, cell.sy, cell.sw, cell.sh, Math.round(r.dx), Math.round(r.dy), Math.round(r.dw), Math.round(r.dh));
  g.restore();
}

// ---- soft radiance sprite (illumination falloff, cached per tint) -----------------
const radCache = new Map<string, HTMLCanvasElement>();
function radianceSprite(tint: string): HTMLCanvasElement {
  let cv = radCache.get(tint);
  if (!cv) {
    cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d')!;
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, tint + 'ff'); gr.addColorStop(0.35, tint + '88'); gr.addColorStop(1, tint + '00');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    if (radCache.size > 24) radCache.clear();
    radCache.set(tint, cv);
  }
  return cv;
}
// toggleable presentation layers (lab QA; defaults on)
export const layers = { art: true, emission: true, radiance: true, warp: true };

// ---- passes called by render.ts ----------------------------------------------------
// Depth items for the y-sorted world draw list (ground/proj FX — these keep
// correct occlusion by walls/roofs/trees). Hover/body auras (windup, orb) are
// drawn separately ABOVE the world (drawAuras) so they are never cropped.
export function depthItems(g: CanvasRenderingContext2D): { y: number; f: () => void }[] {
  const out: { y: number; f: () => void }[] = [];
  for (const inst of instances) {
    if (inst.warp || inst.family === 'screen' || inst.t < 0) continue;
    if (inst.family === 'hover' || inst.family === 'body') continue; // drawn in drawAuras
    out.push({ y: inst.family === 'ground' ? inst.y : inst.y - 6, f: () => { if (layers.art) drawFrame(g, inst, 'combined', 1, 'source-over'); } });
  }
  return out;
}

// Aura FX (hover/body) drawn after the whole world incl. roofs — always fully
// visible, never cropped by the player sprite or structures. Presentation-only.
export function drawAuras(g: CanvasRenderingContext2D, cam: { x: number; y: number }) {
  for (const inst of instances) {
    if (inst.family !== 'hover' && inst.family !== 'body') continue;
    if (inst.t < 0) continue;
    if (layers.art) drawFrame(g, inst, 'combined', 1, 'source-over', -cam.x, -cam.y);
  }
}

// Warp pass (screen space, after g.restore()): each warp instance has its OWN
// cache; it samples the real scene already on the canvas, displaces slices
// toward the focal point, then draws the source art undistorted on top.
export function drawWarpPass(g: CanvasRenderingContext2D, cam: { x: number; y: number }, now: number) {
  if (!layers.warp) { for (const inst of instances) if (inst.warp && inst.t >= 0) drawFrame(g, inst, 'combined', layers.art ? 1 : 0, 'source-over', -cam.x, -cam.y); return; }
  for (const inst of instances) {
    if (!inst.warp || inst.t < 0) continue;
    const r0 = destRect(inst, -cam.x, -cam.y);
    const cx = r0.rotX, cy = r0.rotY;
    const rad = Math.max(r0.dw, r0.dh) * 0.62 + 14;
    const wc = inst.warpCache;
    if (!wc.cv) { wc.cv = document.createElement('canvas'); }
    if (now - wc.at > quality.warpMs || wc.r !== rad || Math.abs(wc.x - cx) > 4 || Math.abs(wc.y - cy) > 4) {
      const W = Math.ceil(rad * 2), H = Math.ceil(rad * 2);
      if (wc.cv.width !== W || wc.cv.height !== H) { wc.cv.width = W; wc.cv.height = H; }
      const wg = wc.cv.getContext('2d')!;
      wg.clearRect(0, 0, W, H);
      wg.drawImage(g.canvas, Math.round(cx - rad), Math.round(cy - rad), W, H, 0, 0, W, H);
      wc.at = now; wc.x = cx; wc.y = cy; wc.r = rad;
    }
    const focal = inst.entry.export.focalPoint;
    const fy = cy + (focal[1] - inst.entry.export.frameSize[1] / 2) * inst.scale;
    const slices = quality.warpSlices, sliceH = (rad * 2) / slices;
    const t01 = Math.min(1, inst.t / 900);
    for (let i = 0; i < slices; i++) {
      const sy = i * sliceH;
      const midY = cy - rad + sy + sliceH / 2;
      const fall = Math.max(0, 1 - Math.abs(midY - cy) / rad);
      const pinch = (6 + 26 * fall * fall) * t01 * Math.max(0, 1 - Math.abs(midY - fy) / (rad * 1.2));
      g.drawImage(wc.cv, 0, Math.round(sy), wc.cv.width, Math.ceil(sliceH),
        Math.round(cx - rad + pinch), Math.round(wc.y - rad + sy), Math.round(rad * 2 - pinch * 2), Math.ceil(sliceH));
    }
    if (layers.art) {
      // SAME transform as emission/radiance/ground contact: destRect (r0), not a
      // separate pivot-based position — art, light and warp focal stay aligned.
      const cell = pageCell(inst.entry, 'combined', frameOf(inst.entry, inst.t));
      if (cell?.img) {
        g.save();
        if (inst.angle) { g.translate(r0.rotX, r0.rotY); g.rotate(inst.angle); g.translate(-r0.rotX, -r0.rotY); }
        g.drawImage(cell.img, cell.sx, cell.sy, cell.sw, cell.sh,
          Math.round(r0.dx), Math.round(r0.dy), Math.round(r0.dw), Math.round(r0.dh));
        g.restore();
      }
    }
  }
}

// Screen-anchored instances (screen space, after restore).
export function drawScreen(g: CanvasRenderingContext2D) {
  for (const inst of instances) {
    if (inst.family !== 'screen' || inst.warp || inst.t < 0) continue;
    if (layers.art) drawFrame(g, inst, 'combined', 1, 'source-over');
  }
}

// Post-night pass (screen space, after drawLight): colored environmental
// radiance + bounded incremental light-channel emission. The base combined
// frame is never redrawn here. Radiance lights the (darkened) terrain around
// the effect; emission keeps the emissive core vivid at night.
export function drawPostNight(g: CanvasRenderingContext2D, cam: { x: number; y: number }, dark: number) {
  for (const inst of instances) {
    if (inst.t < 0) continue;
    const sOff = inst.family === 'screen' ? 0 : -cam.x; // screen-space instances: no camera offset
    const sOffY = inst.family === 'screen' ? 0 : -cam.y;
    const r = destRect(inst, sOff, sOffY);
    const le = inst.entry.export.lightEnergy;
    // colored radiance (soft falloff illumination of the nearby scene) — drawn UNDER the art
    if (layers.radiance && quality.radiance) {
      const energy = Math.min(1.6, le / 8);
      const a = (dark > 0.02 ? Math.min(0.28, 0.08 + dark * 0.3) : 0.05) * energy;
      if (a > 0.01) {
        const rad = Math.max(r.dw, r.dh) * 0.5 + 10;
        const spr = radianceSprite(tintOf(inst.entry));
        g.save();
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(0.3, a);
        g.drawImage(spr, Math.round(r.rotX - rad), Math.round(r.rotY - rad), Math.round(rad * 2), Math.round(rad * 2));
        g.restore();
      }
    }
    // bounded night-safe emission (light channel only, kept subtle so it reads as
    // glow behind the core instead of a fog layer over it)
    if (layers.emission && dark > 0.02 && le >= 0.5) {
      const alpha = Math.min(quality.emissionCap, 0.12 + dark * 0.34) * Math.min(1, le / 6);
      drawFrame(g, inst, 'light', alpha, 'lighter', sOff, sOffY);
    }
    // re-draw the crisp art core ON TOP of its glow so the shape stays sharp
    // (day: undoes the radiance wash; night: keeps the core vivid and crisp over
    // the additive emission instead of reading as haze). For warp instances this
    // paints the same destRect as drawWarpPass, so the night-dimmed copy underneath
    // is fully covered — no ghosting, single crisp shape. Screen-space instances
    // must NOT get the camera offset here (drawScreen draws them without it).
    if (layers.art) {
      if (inst.family === 'screen') drawFrame(g, inst, 'combined', 1, 'source-over');
      else drawFrame(g, inst, 'combined', 1, 'source-over', sOff, sOffY);
    }
  }
}

// ---- gameplay hooks (presentation only) --------------------------------------------
export function syncHazards(hazards: any[], player: { x: number; y: number; aim: number }) {
  for (const h of hazards) {
    if (seenHaz.has(h)) continue;
    seenHaz.add(h);
    if (h.effect === 'quake') spawn('nature/quake', { x: h.x, y: h.y, family: 'ground', angle: player.aim, delayMs: h.tell ?? 0, scale: 0.46 });
    else if (h.style === 'frostnova') spawn('ice/frost-nova', { x: h.x, y: h.y, family: 'ground', delayMs: h.tell ?? 0 });
  }
}
// Fireball: one real instance following the actual projectile (single visual,
// depth-sorted, night-safe via the shared post-night pass).
const projInst = new Map<object, PfxInst>();
export function syncProjFx(projs: any[], now: number) {
  for (const pr of projs) {
    if (pr.kind !== 'fireball') continue;
    let inst = projInst.get(pr);
    if (!inst) { inst = spawn('fire/fireball', { x: pr.x, y: pr.y, family: 'proj', loop: true, follow: pr, scale: SCALE['fire/fireball'] })!; projInst.set(pr, inst); }
  }
  for (const [pr, inst] of [...projInst]) if (!projs.includes(pr) || !instances.includes(inst)) projInst.delete(pr);
  void now;
}

// ---- QA/dev: per-frame mean luminance of the combined channel ----------------------
// Used by the QA harness to pick deliberate anticipation/peak/decay source frames.
export async function frameLuma(id: string): Promise<number[]> {
  const e = manifest.get(id); if (!e || typeof document === 'undefined') return [];
  const pilot = ((PILOT_MANIFEST as any).effects ?? PILOT_MANIFEST).some((p: any) => p.id === id);
  for (const p of e.export.pages.combined) await loadImg(p.path, pilot); // ensure decoded before measuring
  const out: number[] = [];
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  for (let f = 0; f < e.export.frames; f++) {
    const cell = pageCell(e, 'combined', f);
    if (!cell?.img) { out.push(0); continue; }
    g.clearRect(0, 0, 16, 16);
    g.drawImage(cell.img, cell.sx, cell.sy, cell.sw, cell.sh, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data;
    let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; s += a * (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); n += a; }
    out.push(n > 0.5 ? s / n : 0);
  }
  return out;
}

// ---- stats (ring buffer for p50/p95) ------------------------------------------------
const dtRing: number[] = [];
export function tickStats(dtMs: number) {
  dtRing.push(dtMs); if (dtRing.length > 240) dtRing.shift();
}
export function getStats() {
  const s = [...dtRing].sort((a, b) => a - b);
  const pick = (q: number) => s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
  const avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
  return { fps: avg ? 1000 / avg : 0, frameMs: avg, p50: pick(0.5), p95: pick(0.95), instances: instances.length };
}
