// The six Ultimate catastrophes, redesigned to be ARENA-WIDE events with internal rhythm.
// Kept legal: every lethal window is telegraphed, finite, capped per target, and the rings/lanes
// always carry gaps. The design rule is "one event, many beats": each catastrophe opens with a
// stage ring that owns the space, then three escalating movements, then a visible exhaustion.
import { SkillDef, SkillCtx, SkillGen, SkillDef as SD, AIView, ang, sub, add, mul, fromAng, v, hitTest } from './core';
import type { BossId } from '../art/clips';
import { zone, burst, debris, lockAim } from './helpers';
import { vFieldRing, vBlade, vGhostV2, vPortalV2 } from '../art/vfx';
import type { El } from '../art/vfx';

export const CEL: Record<BossId, El> = { surtur: 'fire', typhon: 'force', aion: 'time', atlas: 'space', argus: 'mind', anubis: 'soul' };
type FieldKind = 'surtur' | 'typhon' | 'aion' | 'atlas' | 'argus' | 'anubis';
const FK: Record<El, FieldKind> = { fire: 'surtur', force: 'typhon', time: 'aion', space: 'atlas', mind: 'argus', soul: 'anubis' };

/**
 * The stage: one world-space boundary that owns the whole catastrophe. Every later movement
 * (rings, lanes, meteors) happens INSIDE this ring, so the event reads as one thing, not six.
 */
function stage(c: SkillCtx, radius: number, life: number, kind: FieldKind) {
  return c.spawn({
    kind: 'ult-stage', pos: c.b.pos, life, lethal: false, policy: 'owned', data: { r: radius, beat: 0 },
    update() { },
    render() { const e = this as import('./core').Ent, beat = (e.data.beat as number) || 0; return [{ k: 'spr', key: `us${kind}${radius}${Math.floor(e.t * 12) % 24}${beat}`, make: () => vFieldRing(kind, radius, e.t, 0.75 + beat * 0.15, Math.min(1, e.t / 0.5)), x: c.b.pos.x, y: c.b.pos.y + 3, layer: 0 }]; },
  });
}
const pulse = (s: import('./core').Ent | undefined) => { if (s) s.data.beat = ((s.data.beat as number) || 0) + 1; };

/** Ring of lethal sectors with N deliberate gaps. The gaps are the counterplay. */
function ringVolley(c: SkillCtx, el: El, r0: number, r1: number, n: number, gapCount: number, dmg: number, warn: number, major = true) {
  const gaps = new Set<number>(); let guard = 0; while (gaps.size < gapCount && guard++ < 64) gaps.add(Math.floor(c.rnd() * n));
  const spin = c.rnd() * 6.283;
  for (let i = 0; i < n; i++) {
    if (gaps.has(i)) continue;
    const a = spin + (i / n) * 6.283;
    zone(c, { shape: { k: 'sector', x: c.b.pos.x, y: c.b.pos.y, r: r1, r0, a, span: (6.283 / n) * 0.9 }, warn, active: 0.2, o: { dmg, kb: 260, el }, el, look: 'burst', major, onActive: () => { burst(c.w, el, c.b.pos.x + Math.cos(a) * (r0 + r1) / 2, c.b.pos.y + Math.sin(a) * (r0 + r1) / 2, 16, 0.3); debris(c.w, el, c.b.pos.x + Math.cos(a) * r1, c.b.pos.y + Math.sin(a) * r1, 4, 70); } });
  }
  return gaps;
}
/** A line of parallel lanes along `dir`, with keepGaps lane indices spared. */
function laneVolley(c: SkillCtx, el: El, dir: number, count: number, spacing: number, len: number, wid: number, dmg: number, warn: number, keepGaps: number[] = [], target: { x: number; y: number } = c.tpos()) {
  const u = fromAng(dir), n = fromAng(dir + Math.PI / 2);
  for (let i = 0; i < count; i++) {
    if (keepGaps.includes(i)) continue;
    const off = (i - (count - 1) / 2) * spacing, mid = add(add(c.b.pos, mul(n, off)), mul(u, len * 0.35));
    const a = add(mid, mul(u, -len / 2)), b = add(mid, mul(u, len / 2));
    const pValid = c.valid(mid, 4); if (!pValid) continue;
    zone(c, { shape: { k: 'capsule', x1: a.x, y1: a.y, x2: b.x, y2: b.y, r: wid }, warn, active: 0.18, o: { dmg, kb: 180, el }, el, look: 'burst', major: true });
  }
  void target;
}
/** Staggered fall: separate impacts with independent, readable descent timing. */
function fallVolley(c: SkillCtx, el: El, count: number, radius: number, dmg: number, warn: number, spread: number) {
  for (let i = 0; i < count; i++) {
    const base = add(c.tpos(), fromAng(c.rnd() * 6.283, c.rnd() * spread));
    const p = c.valid(base, radius); if (!p) continue;
    const P = v(p.x, p.y);
    zone(c, { shape: { k: 'circle', x: P.x, y: P.y, r: radius }, warn: warn + i * 0.08, active: 0.16, o: { dmg, kb: 200, el }, el, look: 'burst', major: true, decalSize: [radius * 2, radius], onActive: () => { burst(c.w, el, P.x, P.y, radius * 0.9); debris(c.w, el, P.x, P.y, 8, 110, 3); } });
  }
}

const doc = (el: El, open: string, active: string, vfx: string, end: string, counter: string): SD['doc'] =>
  ({ open, active, vfx, end, combo: 'part of the catastrophe chain', counter, target: 'per movement, locked at its own telegraph', hitbox: 'arena-wide rings, lanes and falls — always with gaps', el });

const base = (boss: BossId, id: string, name: string, run: (c: SkillCtx) => SkillGen, d: SD['doc']): SkillDef =>
  ({ id, name, boss, form: 'ultimate', signature: true, cd: 28, range: [0, 900], score: (ai: AIView) => ({ s: ai.hpFrac < 0.85 ? 0.95 : 0.4, why: [`catastrophe authored for the whole arena (hp ${(ai.hpFrac * 100).toFixed(0)}%)`, 'three escalating movements'] }), run, doc: d });

// ---------------------------------------------------------------- SURTUR
const surtur = base('surtur', 'ragnarok', 'Ragnarök — The Incineration', function* (c) {
  c.phase('OPEN'); c.anim('ragnarok_open'); lockAim(c);
  const el: El = 'fire', st = stage(c, 500, 9, 'surtur');
  yield 1.0;
  c.phase('COMMIT'); c.log('PERIMETER: the arena border itself ignites'); pulse(st); c.shake(5);
  ringVolley(c, el, 300, 520, 14, 4, 22, 0.75);
  yield 0.9;
  c.phase('ACTIVE'); c.log('FISSURES: three cross-arena seams'); pulse(st);
  const aim = ang(sub(c.tpos(), c.b.pos));
  for (const off of [0, 0.75, -0.75]) {
    const a = aim + off, s = add(c.b.pos, fromAng(a, -520)), e = add(c.b.pos, fromAng(a, 520));
    zone(c, { shape: { k: 'capsule', x1: s.x, y1: s.y, x2: e.x, y2: e.y, r: 16 }, warn: 0.7, active: 0.24, o: { dmg: 24, kb: 220, el }, el, look: 'burst', major: true, decalSize: [70, 34] });
    yield 0.16;
  }
  yield 0.5;
  c.log('RAIN: molten swords converge on the target prediction'); pulse(st);
  fallVolley(c, el, 5, 48, 26, 0.8, 150);
  yield 1.1;
  c.phase('RECOVERY'); c.anim('ragnarok_recover'); c.shake(3);
  yield 1.3; c.phase('END');
}, doc('fire', 'THE TITAN PLANTS THE SWORD: a 500px stage-ring ignites around him and the sky turns to cinders', 'MOVEMENT 1 perimeter ring (300–520px, 14 sectors, 4 gaps) · MOVEMENT 2 three cross-arena fissures · MOVEMENT 3 five molten swords on the predicted position', 'stage ring breathes; each movement pulses it; ember rain and cross-arena scorch decals', '1.3s exhaustion, the stage ring cools and fades', 'stand in a perimeter gap, then leave the fissure line; swords are 0.8s apart'));

// ---------------------------------------------------------------- TYPHON
const typhon = base('typhon', 'worldbreaker_descent', 'Worldbreaker: Skyfall', function* (c) {
  c.phase('OPEN'); c.anim('worldbreaker_descent_open'); lockAim(c);
  const el: El = 'force', st = stage(c, 480, 9, 'typhon');
  yield 0.9;
  c.phase('COMMIT'); c.log('DESCENT: a single impact, then the arena answers'); pulse(st); c.shake(6);
  zone(c, { shape: { k: 'circle', x: c.tpos().x, y: c.tpos().y, r: 90 }, warn: 0.7, active: 0.2, o: { dmg: 30, kb: 320, el }, el, look: 'burst', major: true, decalSize: [140, 60], onActive: () => { c.b.pos = v(c.tpos().x, c.tpos().y); c.shake(8); debris(c.w, el, c.tpos().x, c.tpos().y, 18, 170, 4); } });
  yield 0.5;
  c.phase('ACTIVE'); c.log('WAVEFRONTS: two separated outward rings'); pulse(st);
  zone(c, { shape: { k: 'ring', x: c.b.pos.x, y: c.b.pos.y, r0: 120, r1: 170 }, warn: 0.9, active: 0.18, o: { dmg: 18, kb: 260, el }, el, look: 'none', major: true });
  zone(c, { shape: { k: 'ring', x: c.b.pos.x, y: c.b.pos.y, r0: 300, r1: 350 }, warn: 1.5, active: 0.18, o: { dmg: 16, kb: 240, el }, el, look: 'none', major: true });
  yield 0.9;
  c.log('SHOCK LANES: four pressure corridors with a safe seam'); pulse(st);
  laneVolley(c, el, c.rnd() * 6.283, 5, 72, 900, 22, 20, 0.7, [Math.floor(c.rnd() * 5)]);
  yield 0.8;
  c.log('DEBRIS: the sky gives back the ground'); pulse(st);
  fallVolley(c, el, 6, 42, 22, 0.75, 260);
  yield 1.2;
  c.phase('RECOVERY'); c.anim('worldbreaker_descent_recover');
  yield 1.4; c.phase('END');
}, doc('force', 'the titan crouches and leaves the ground; a 480px pressure stage locks around him', 'MOVEMENT 1 descending impact · MOVEMENT 2 two non-continuous wavefronts then four pressure lanes with a seam · MOVEMENT 3 six boulders', 'pressure stage ring, shock banding, ballistic chips, skid decals', '1.4s two-beat recovery', 'cross the lane seam, then step between the two wavefronts; boulders are individually telegraphed'));

// ---------------------------------------------------------------- AION
const aion = base('aion', 'zero_hour', 'Zero Hour', function* (c) {
  c.phase('OPEN'); c.anim('zero_hour_open'); lockAim(c);
  const el: El = 'time', st = stage(c, 470, 9, 'aion');
  yield 1.1;
  c.phase('COMMIT'); c.log('THE HOUR HAND: four sectors fall in clock order'); pulse(st);
  const start = ang(sub(c.tpos(), c.b.pos));
  for (let i = 0; i < 4; i++) {
    const a = start + i * 1.5708;
    zone(c, { shape: { k: 'sector', x: c.b.pos.x, y: c.b.pos.y, r: 470, a, span: 1.15 }, warn: 0.65, active: 0.16, o: { dmg: 20, kb: 200, el }, el, look: 'burst', major: true });
    yield 0.16;
  }
  yield 0.4;
  c.phase('ACTIVE'); c.log('SUSPENDED BLADES: eight lanes, two safe'); pulse(st);
  laneVolley(c, el, c.rnd() * 6.283, 8, 62, 880, 14, 16, 0.7, [1, 5]);
  for (let i = 0; i < 8; i++) { const p = add(c.b.pos, fromAng(i * 0.785, 220)); if (c.valid(p, 6)) c.spawn({ kind: 'fx', pos: p, life: 1.4, update() { }, render() { const e = this as import('./core').Ent; return [{ k: 'spr', key: `zbl${i}${Math.floor(e.t * 10) % 4}`, make: () => vBlade('time', i * 0.785, 14, true), x: p.x, y: p.y, layer: 2 }]; } }); }
  yield 0.9;
  c.log('COLLAPSE: the dial contracts, the rim is lethal, the centre is safe'); pulse(st);
  zone(c, { shape: { k: 'ring', x: c.b.pos.x, y: c.b.pos.y, r0: 210, r1: 470 }, warn: 1.0, active: 0.2, o: { dmg: 26, kb: 260, el }, el, look: 'none', major: true });
  yield 0.4;
  c.phase('RECOVERY'); c.anim('zero_hour_recover');
  yield 1.4; c.phase('END');
}, doc('time', 'a giant working clock face locks over the arena; the stage ring is its bezel', 'MOVEMENT 1 four sectors in clock order · MOVEMENT 2 eight suspended-blade lanes with two safe lanes · MOVEMENT 3 the dial contracts inward (safe centre)', 'hands accelerate with the slow strength; suspended blades flash before release; world desaturation', '1.4s exhaustion while the hands wind down', 'read the hand order, take a safe lane, then move INTO the contracting dial'));

// ---------------------------------------------------------------- ATLAS
const atlas = base('atlas', 'worldfold', "Worldfold — Heaven's Rupture", function* (c) {
  c.phase('OPEN'); c.anim('worldfold_open');
  const el: El = 'space', st = stage(c, 500, 9, 'atlas');
  const P = c.b.pos, R1 = add(P, fromAng(2.4, 380)), R2 = add(P, fromAng(-0.8, 380));
  for (const [i, pos] of [R1, R2].entries()) c.spawn({ kind: 'fx', pos, life: 6, update() { }, render() { const e = this as import('./core').Ent; return [{ k: 'spr', key: `uwp${i}${Math.floor(e.t * 10) % 8}`, make: () => vPortalV2(52, Math.min(1, e.t / 0.4) * Math.min(1, (6 - e.t) / 0.4), Math.floor(e.t * 10), i + 1), x: pos.x, y: pos.y, layer: 1 }]; } });
  yield 1.0;
  c.phase('COMMIT'); c.log('HANDS: four strikes out of four different mouths'); pulse(st);
  for (let i = 0; i < 4; i++) {
    const p = add(c.tpos(), fromAng(i * 1.5708 + c.rnd(), 30 + c.rnd() * 70)); const q = c.valid(p, 12); if (!q) continue;
    zone(c, { shape: { k: 'circle', x: q.x, y: q.y, r: 56 }, warn: 0.55, active: 0.16, o: { dmg: 22, kb: 240, el }, el, look: 'burst', major: true, onActive: () => debris(c.w, el, q.x, q.y, 6, 110) });
    yield 0.1;
  }
  yield 0.5;
  c.phase('ACTIVE'); c.log('CUTS: three dimensional slices across the arena'); pulse(st);
  for (let i = 0; i < 3; i++) { const a = c.rnd() * 3.14, s = add(P, fromAng(a, -560)), e = add(P, fromAng(a, 560)); zone(c, { shape: { k: 'capsule', x1: s.x, y1: s.y, x2: e.x, y2: e.y, r: 12 }, warn: 0.7, active: 0.18, o: { dmg: 24, kb: 200, el }, el, look: 'none', major: true }); yield 0.12; }
  yield 0.4;
  c.log('SHEAR + STARS: the rifts empty into the arena'); pulse(st);
  laneVolley(c, el, ang(sub(c.tpos(), P)), 4, 110, 900, 18, 20, 0.7, [1]);
  fallVolley(c, el, 5, 40, 20, 0.8, 280);
  yield 1.2;
  c.phase('RECOVERY'); c.anim('worldfold_recover');
  yield 1.4; c.phase('END');
}, doc('space', 'two 380px rifts tear open and a 500px stage ring measures the space between', 'MOVEMENT 1 four portal fists · MOVEMENT 2 three arena-crossing cuts · MOVEMENT 3 four shear lanes with a seam plus five meteors', 'rift depth on the stage ring, portal mouths breathing, debris and scorch', '1.4s fatigue, rifts close', 'watch each portal lip; the cuts are 0.7s apart; one shear lane is always empty'));

// ---------------------------------------------------------------- ARGUS
const argus = base('argus', 'omniscient_judgment', 'Omniscient Judgment', function* (c) {
  c.phase('OPEN'); c.anim('omniscient_judgment_open'); lockAim(c);
  const el: El = 'mind', st = stage(c, 490, 9, 'argus');
  yield 1.1;
  c.phase('COMMIT'); c.log('THE GRID: seven columns of sight, two spared'); pulse(st);
  laneVolley(c, el, -Math.PI / 2, 9, 58, 1000, 16, 20, 0.8, [1, 6]);
  yield 0.9;
  c.phase('ACTIVE'); c.log('THE SWEEP: the eye turns, three times'); pulse(st);
  for (let i = 0; i < 3; i++) {
    const a = ang(sub(c.tpos(), c.b.pos)) + (i - 1) * 1.6;
    zone(c, { shape: { k: 'sector', x: c.b.pos.x, y: c.b.pos.y, r: 480, a, span: 1.7 }, warn: 0.6, active: 0.2, o: { dmg: 18, kb: 180, el }, el, look: 'none', major: true });
    yield 0.45;
  }
  c.log('THE VERDICT: one fixed vector, two flank lances'); pulse(st);
  const dir = ang(sub(c.tpos(), c.b.pos));
  zone(c, { shape: { k: 'capsule', x1: c.b.pos.x, y1: c.b.pos.y, x2: c.b.pos.x + Math.cos(dir) * 560, y2: c.b.pos.y + Math.sin(dir) * 560, r: 26 }, warn: 1.0, active: 0.3, o: { dmg: 34, kb: 300, el }, el, look: 'burst', major: true });
  fallVolley(c, el, 4, 36, 18, 0.8, 240);
  yield 1.2;
  c.phase('RECOVERY'); c.anim('omniscient_judgment_recover');
  yield 1.4; c.phase('END');
}, doc('mind', 'the sky eye opens; a 490px iris stage tightens around the arena', 'MOVEMENT 1 nine vertical sight columns (two safe) · MOVEMENT 2 three lighthouse sweeps · MOVEMENT 3 a 26px fixed verdict lane plus flanking falls', 'iris ring tightens with lock; each column flares from above; sky eye tracks', '1.4s blindness/exhaustion', 'use the two spared columns, then rotate behind the sweep as it passes'));

// ---------------------------------------------------------------- ANUBIS
const anubis = base('anubis', 'final_passage', 'The Final Passage', function* (c) {
  c.phase('OPEN'); c.anim('final_passage_open'); lockAim(c);
  const el: El = 'soul', st = stage(c, 485, 9, 'anubis');
  const giantP = add(c.b.pos, fromAng(ang(sub(c.tpos(), c.b.pos)), 165));
  c.spawn({ kind: 'fx', pos: giantP, life: 7, update() { }, render() { const e = this as import('./core').Ent; return [{ k: 'spr', key: `ugia${Math.floor(e.t * 6) % 4}`, make: () => vGhostV2(Math.floor(e.t * 6), 1, 'soul'), x: giantP.x, y: giantP.y - 130, layer: 1, z: giantP.y - 4, w: 3, alpha: 0.34 }]; } });
  yield 1.1;
  c.phase('COMMIT'); c.log('THE PROCESSION: three ranks with real gaps'); pulse(st);
  for (let i = 0; i < 3; i++) {
    const gap = (c.rnd() - 0.5) * 260, dir = ang(sub(c.tpos(), c.b.pos)) + Math.PI / 2;
    laneVolley(c, el, dir, 3, 150, 900, 30, 18, 0.7 + i * 0.35, [0], c.tpos());
    const a = dir, n = fromAng(a + Math.PI / 2);
    for (const side of [-1, 1]) { const ctr = add(add(c.b.pos, mul(n, side * 210)), mul(fromAng(a), gap * (i === 1 ? -1 : 1))); if (c.valid(ctr, 20)) zone(c, { shape: { k: 'capsule', x1: ctr.x - Math.cos(a) * 430, y1: ctr.y - Math.sin(a) * 430, x2: ctr.x + Math.cos(a) * 430, y2: ctr.y + Math.sin(a) * 430, r: 26 }, warn: 0.75 + i * 0.3, active: 0.2, o: { dmg: 18, kb: 200, el }, el, look: 'none', major: true }); }
    yield 0.5;
  }
  c.phase('ACTIVE'); c.log('CHAINS: four anchors drag inward'); pulse(st);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.5708 + c.rnd(), p = add(c.b.pos, fromAng(a, 300)); if (!c.valid(p, 16)) continue;
    c.spawn({ kind: 'ult-chain', pos: p, life: 1.2, lethal: true, update(w) { const e = this as import('./core').Ent; if (e.t > 0.3 && e.t < 0.5) for (const t of w.enemiesOf(c.b)) if (hitTest({ k: 'circle', x: p.x, y: p.y, r: 46 }, t.pos, t.r)) { w.pull(t, p, 240, 0.35, 240); w.hitEnemies(c.b, c.att, { k: 'circle', x: p.x, y: p.y, r: 46 }, { dmg: 12, el, kb: 0 }); } }, render() { const e = this as import('./core').Ent; return [{ k: 'chain', x: c.b.pos.x, y: c.b.pos.y, x2: p.x, y2: p.y, el: 'soul', layer: 3, alpha: Math.min(1, e.t * 3) }, { k: 'spr', key: `uca${i}`, make: () => vFieldRing('anubis', 46, e.t, 1, Math.min(1, e.t / 0.3)), x: p.x, y: p.y + 2, layer: 0 }]; } });
  }
  yield 1.2;
  c.phase('RECOVERY'); c.log('THE LAST SWING: two arcs from the giant double'); c.shake(5);
  zone(c, { shape: { k: 'circle', x: c.b.pos.x, y: c.b.pos.y, r: 190 }, warn: 0.8, active: 0.22, o: { dmg: 28, kb: 300, el }, el, look: 'burst', major: true });
  zone(c, { shape: { k: 'sector', x: giantP.x, y: giantP.y, r: 520, a: ang(sub(c.tpos(), giantP)), span: 2.2 }, warn: 0.9, active: 0.2, o: { dmg: 22, kb: 220, el }, el, look: 'none', major: true });
  yield 1.2; c.anim('final_passage_recover');
  yield 1.4; c.phase('END');
}, doc('soul', 'a spectral double rises and a 485px funeral stage closes around the arena', 'MOVEMENT 1 three procession ranks with gaps · MOVEMENT 2 four chain anchors that drag inward · MOVEMENT 3 last swing: radial blast + giant double arc', 'soul stage ring, giant double at 6x, chain links, funeral glyphs', '1.4s recovery, all chains released', 'walk through the rank gaps, break the chain axis, then leave the double arc sector'));

export const CATASTROPHE: Record<BossId, SkillDef> = { surtur, typhon, aion, atlas, argus, anubis };
export { FK, pulse };
