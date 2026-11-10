import { DC, Dir, Pose, LAYERS, LayerName, R, dissolve, Anchors, PALETTE, wScreen } from './kit';
import { Raster, toRGBA, destray, hash2 } from './raster';
import { BossId, Form, buildClips } from './clips';
import type { Clip } from './kit';
import { drawSurtur } from './b_surtur';
import { drawTyphon } from './b_typhon';
import { drawAion } from './b_aion';
import { drawAtlas } from './b_atlas';
import { drawArgus } from './b_argus';
import { drawAnubis } from './b_anubis';

// Canvas sizes are chosen from measured max reach (weapon overhead / lateral sweep) so no pose is ever clipped.
export interface FormArt { size: number; root: [number, number]; outline: number; glow: Record<number, number>; ember: number; draw: (dc: DC) => void; keep: number[]; ramp: number[] }
const mini = (ol: number, glow: Record<number, number>, ember: number, draw: (dc: DC) => void, keep: number[], ramp: number[]): FormArt => ({ size: 160, root: [80, 124], outline: ol, glow, ember, draw, keep, ramp });
const ult = (a: FormArt): FormArt => ({ ...a, size: 320, root: [160, 248] });
const g = (from: number[], to: number) => Object.fromEntries(from.map((k) => [k, to]));
const SURT = mini(R.s_out[0], g([...R.lava.slice(2)], R.lava[0]), R.lava[4], drawSurtur, [...R.lava, ...R.horn], R.lava);
const TYPH = mini(R.t_out[0], g(R.force.slice(2), R.force[0]), R.force[4], drawTyphon, [...R.force, ...R.claw], R.force);
const AION = mini(R.a_out[0], g(R.time.slice(2), R.time[0]), R.time[4], drawAion, [...R.time, ...R.bronze], R.time);
const ATLS = mini(R.b_out[0], g(R.space.slice(2), R.space[0]), R.space[4], drawAtlas, [...R.space, ...R.star], R.space);
const ARGS = mini(R.g_out[0], g(R.mind.slice(2), R.mind[0]), R.mind[4], drawArgus, [...R.mind, ...R.eyew, ...R.iris, ...R.pupil, ...R.gold], R.mind);
const ANUB = mini(R.n_out[0], g(R.soul.slice(2), R.soul[0]), R.soul[4], drawAnubis, [...R.soul, ...R.fgold], R.soul);
export const FORM_ART: Record<BossId, Record<Form, FormArt>> = {
  surtur: { mini: SURT, ultimate: { ...ult(SURT), size: 352, root: [176, 272] } }, typhon: { mini: TYPH, ultimate: ult(TYPH) }, aion: { mini: AION, ultimate: ult(AION) },
  atlas: { mini: ATLS, ultimate: ult(ATLS) }, argus: { mini: ARGS, ultimate: ult(ARGS) }, anubis: { mini: ANUB, ultimate: ult(ANUB) },
};

/** Smear frame: pixel arc between previous and current weapon angle, around the real shoulder anchor. */
function drawSmear(dc: DC, p: Pose, ramp: number[], ult: boolean) {
  const sh = dc.anchors.shoulderW, tip = dc.anchors.weaponTip || dc.anchors.hand, hd = dc.anchors.hand;
  if (!sh || !tip || p.smear === undefined) return;
  let d = wScreen(dc.dir, p.smear) - wScreen(dc.dir, p.wA ?? 0.9);
  while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  d = Math.max(-1.7, Math.min(1.7, d)); if (Math.abs(d) < 0.3) return;
  const sx = dc.ox + sh[0], sy = dc.oy + sh[1], a1 = Math.atan2(tip[1] - sh[1], tip[0] - sh[0]);
  const rOut = Math.hypot(tip[0] - sh[0], tip[1] - sh[1]), rIn = Math.max(2, hd ? Math.hypot(hd[0] - sh[0], hd[1] - sh[1]) * 0.8 : rOut * 0.4);
  // Smear as concentric motion streaks, not a filled wedge. The blade-edge streak is the longest and
  // hottest; inner streaks are shorter and cooler, with 1px gaps so the arc reads as speed. (The old
  // filled fan used dark ramp steps inside and read as a flat red banana attached to the shoulder.)
  // Drawn into the BACK layer: a smear that crosses the torso must never paint over the boss's
  // identity (front-facing weapons are composited after the body, so this used to stripe it).
  const L = dc.layers.back, gap = 2.5, nStreak = 2;
  d *= 0.55; // a wide fan at gameplay scale read as a solid coloured wedge over the body
  for (let k = 0; k < nStreak; k++) {
    const rr = rOut - k * (gap + 1), lenFrac = 1 - k * (0.6 / nStreak), steps = Math.ceil(Math.abs(d) * rr * 1.3 * lenFrac);
    for (let i = 0; i <= steps; i++) {
      const t = i / Math.max(1, steps), along = t * lenFrac; // 0 = current blade, lenFrac = oldest end
      if (k > 0 && hash2(i, k, 5) < along * 0.5) continue;  // inner streaks dissolve toward their tail
      const a = a1 + d * along, ci = k === 0 ? (along < 0.35 ? 4 : along < 0.7 ? 3 : 2) : (along < 0.5 ? 3 : 2);
      const x = Math.round(sx + Math.cos(a) * rr), y = Math.round(sy + Math.sin(a) * rr);
      if (!L.get(x, y)) L.set(x, y, ramp[ci]);
      if (k === 0 && ult && along < 0.6) { const x2 = Math.round(sx + Math.cos(a) * (rr - 1)), y2 = Math.round(sy + Math.sin(a) * (rr - 1)); if (!L.get(x2, y2)) L.set(x2, y2, ramp[4]); }
    }
  }
}

export interface FrameOut { w: number; h: number; layers: Record<LayerName, Raster>; comp: Raster; anchors: Anchors; order: LayerName[] }
export function renderPose(boss: BossId, form: Form, dir: Dir, pose: Pose, f: number): FrameOut {
  const fa = FORM_ART[boss][form];
  const dc = new DC(fa.size, fa.size, fa.root[0], fa.root[1], dir, pose, f, form === 'ultimate');
  fa.draw(dc);
  drawSmear(dc, pose, fa.ramp, form === 'ultimate');
  const keep = new Set(fa.keep);
  for (const n of LAYERS) destray(dc.layers[n], keep);
  if (pose.hurt && pose.hurt > 0.6) for (const n of LAYERS) { const L = dc.layers[n]; for (let i = 0; i < L.d.length; i += 2) if (L.d[i] && (i / fa.size) % 2 < 1) L.d[i] = R.k[1]; }
  const comp = dc.finish(fa.outline, fa.glow);
  if (pose.dissolve) { dissolve(comp, pose.dissolve, 7, fa.ember); for (const n of LAYERS) dissolve(dc.layers[n], pose.dissolve, 7, fa.ember); }
  dc.anchors.root = [0, 0];
  return { w: fa.size, h: fa.size, layers: dc.layers, comp, anchors: dc.anchors, order: dc.order };
}

const clipCache = new Map<string, Record<string, Clip>>();
export function clipsFor(boss: BossId, form: Form) {
  const k = boss + form;
  if (!clipCache.has(k)) clipCache.set(k, buildClips(boss, form));
  return clipCache.get(k)!;
}
/** user edits (pixel overrides & timing) applied on top of procedural recipes; persisted by the lab */
export const OVERRIDES: { px: Record<string, Record<number, number>>; ms: Record<string, number> } = { px: {}, ms: {} };
export function frameKey(boss: BossId, form: Form, anim: string, dir: Dir, i: number) { return `${boss}/${form}/${anim}/${dir}/${i}`; }

export interface LiteFrame { w: number; h: number; comp: Raster; anchors: Anchors; order: LayerName[] }
const frameCache = new Map<string, LiteFrame>();
let cacheBytes = 0; const CACHE_BUDGET = 96 * 1024 * 1024;
function poseOf(boss: BossId, form: Form, anim: string, i: number) {
  const clip = clipsFor(boss, form)[anim] || clipsFor(boss, form).idle;
  const fr = clip.frames[Math.min(i, clip.frames.length - 1)];
  return { p: fr.p, f: fr.p.f ?? i };
}
export function getFrame(boss: BossId, form: Form, anim: string, dir: Dir, i: number): LiteFrame {
  const key = frameKey(boss, form, anim, dir, i);
  let fo = frameCache.get(key);
  if (fo) { frameCache.delete(key); frameCache.set(key, fo); return fo; } // LRU touch
  const { p, f } = poseOf(boss, form, anim, i);
  const full = renderPose(boss, form, dir, p, f);
  fo = { w: full.w, h: full.h, comp: full.comp, anchors: full.anchors, order: full.order };
  const ov = OVERRIDES.px[key];
  if (ov) for (const k in ov) fo.comp.d[+k] = ov[k];
  frameCache.set(key, fo); cacheBytes += fo.comp.d.length;
  while (cacheBytes > CACHE_BUDGET && frameCache.size > 1) { const [k0, v0] = frameCache.entries().next().value as [string, LiteFrame]; frameCache.delete(k0); cacheBytes -= v0.comp.d.length; }
  return fo;
}
/** full layered render (uncached) for the workbench / no-emission views */
export function getFrameLayers(boss: BossId, form: Form, anim: string, dir: Dir, i: number): FrameOut {
  const { p, f } = poseOf(boss, form, anim, i);
  return renderPose(boss, form, dir, p, f);
}
export function invalidateFrame(key?: string) { if (key) { const v = frameCache.get(key); if (v) { cacheBytes -= v.comp.d.length; frameCache.delete(key); } } else { frameCache.clear(); cacheBytes = 0; } }
export function frameRGBA(fo: { comp: Raster }) { return toRGBA(fo.comp, PALETTE); }
export function frameMs(boss: BossId, form: Form, anim: string, i: number) {
  const k = `${boss}/${form}/${anim}/${i}`;
  return OVERRIDES.ms[k] ?? clipsFor(boss, form)[anim].frames[i].ms;
}
