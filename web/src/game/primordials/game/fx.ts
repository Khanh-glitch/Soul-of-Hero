// Cinematic presentation layer. Pure pixel rasters; driven by the SAME gameplay events (phase tags, hits, sprite anchors).
// Never alters combat: no hitboxes are created here.
import { World, Actor, SkillCtx, Ent, Cmd, V, v, dir4, HitOpts, mkEnt, dist, norm, sub, ang } from './core';
import { clipsFor, getFrame, FORM_ART } from '../art/sprites';
import { frameAt, BossId } from '../art/clips';
import { R } from '../art/kit';
import { hash2 } from '../art/raster';
import { El, vSigil, SIGIL_PERIOD, vGlint, vDigits, vTrailDot, vFlameV2 as vFlame, vGear, vTwinkle, vRock, vEyeV2 as vEye, vGhostV2, vGhostOf, vDot, vSmoke, vNova, vDustRing, vSpeedLines, vHitV2, vShock, vPortalV2, vForeground, vFist, vBlade, vLance, vCrack, vFistFront } from '../art/vfx';

export const BOSS_EL: Record<BossId, El> = { surtur: 'fire', typhon: 'force', aion: 'time', atlas: 'space', argus: 'mind', anubis: 'soul' };
const BOSS_INFO_ID = (b: BossId) => b;
const EMIT: Record<BossId, string> = { surtur: 'weaponTip', typhon: 'hand', aion: 'weaponTip', atlas: 'weaponTip', argus: 'eye', anubis: 'weaponTip' };
const hq = (w: World) => w.quality === 'maximum_vfx', on = (w: World) => w.quality !== 'art_only';

/** world position of a named sprite anchor on the frame the renderer is showing right now */
export function anchorWorld(b: Actor, name: string): V | null {
  const B = b.boss; if (!B) return null;
  const clips = clipsFor(B.bossId, B.form), clip = clips[b.anim] || clips.idle, fi = frameAt(clip, b.animT * 1000);
  const a = getFrame(B.bossId, B.form, clip.name, dir4(b.facing), fi).anchors[name] || getFrame(B.bossId, B.form, clip.name, dir4(b.facing), fi).anchors.hand;
  return a ? v(b.pos.x + a[0], b.pos.y + a[1]) : null;
}
const owned = (w: World, b: Actor, e: Partial<Ent> & { update: Ent['update']; render: Ent['render'] }) => w.add(mkEnt(w, b.id, undefined, { policy: 'owned', lethal: false, ...e }));

// ---------------- ambient aura (always on, per boss) ----------------
function aura(w: World, b: Actor) {
  const B = b.boss!, U = B.form === 'ultimate', H = U ? 130 : 62;
  owned(w, b, { kind: 'aura', life: 1e9, pos: b.pos, update() { if (!b.alive && w.t - b.lastHurt > 0) (this as Ent).life = Math.min((this as Ent).life, (this as Ent).t + 1.5); },
    render() {
      if (!on(w) || !b.alive) return [];
      const out: Cmd[] = [], t = w.t, P = b.pos, n = (U ? 14 : 7) * (hq(w) ? 1 : 0.5), busy = !!B.runner;
      const push = (key: string, make: () => import('../art/raster').Raster, x: number, y: number, layer: Cmd['layer'], z?: number, alpha?: number) => out.push({ k: 'spr', key, make, x, y, layer, z, alpha });
      for (let i = 0; i < n; i++) {
        const ph = (t * (0.35 + hash2(i, 1, 3) * 0.3) + hash2(i, 2, 3)) % 1, sx = (hash2(i, 3, 3) - 0.5) * (U ? 120 : 56);
        if (B.bossId === 'surtur') { const x = P.x + sx + Math.sin(t * 3 + i) * 3, y = P.y - 6 - ph * H * 1.5; push(`em${ph > 0.6 ? 2 : 4}`, () => vDot('fire', ph > 0.6 ? 0 : 1, 0), x, y, 3, undefined, 1 - ph * 0.5); }
        else if (B.bossId === 'typhon') { const a = t * 0.8 + i * 0.9, rr = (U ? 60 : 28) + (i % 3) * 6, x = P.x + Math.cos(a) * rr, y = P.y - 4 - Math.abs(Math.sin(t * 2 + i)) * (busy ? 18 : 8) + Math.sin(a) * rr * 0.35; push(`rk${U ? 3 : 2}${i % 8}`, () => vRock(U ? 3 : 2, i, 'force'), x, y, 2, P.y + Math.sin(a) * 10); }
        else if (B.bossId === 'aion') { const a = -t * 0.5 + i * 0.9, rr = (U ? 70 : 34), x = P.x + Math.cos(a) * rr, y = P.y - H * 0.55 + Math.sin(a) * rr * 0.4 - Math.sin(t + i) * 6; push(`gr${U ? 2 : 1}${Math.floor(t * 4 + i) % 4}`, () => vGear(U ? 2 : 1, Math.floor(t * 4 + i)), x, y, 2, P.y + Math.sin(a) * 10); }
        else if (B.bossId === 'atlas') { const a = t * 0.6 + i * 0.8, rr = (U ? 80 : 38) + (i % 2) * 8, x = P.x + Math.cos(a) * rr, y = P.y - H * 0.5 + Math.sin(a) * rr * 0.45; push(`tw${(i + Math.floor(t * 3)) % 3 === 0 ? 2 : 1}`, () => vTwinkle('space', (i + Math.floor(t * 3)) % 3 === 0 ? 2 : 1), x, y, 2, P.y + Math.sin(a) * 12); }
        else if (B.bossId === 'argus') { const a = t * 0.9 + (i / n) * 6.283, x = P.x + Math.cos(a) * (U ? 46 : 22), y = P.y - H - 6 + Math.sin(a) * (U ? 10 : 5); push(`ag${i % 2}`, () => vTwinkle('mind', 1 + (i % 2)), x, y, 2, P.y + Math.sin(a) * 4); }
        else { const a = t * 0.7 + i * 0.9, rr = (U ? 64 : 30), x = P.x + Math.cos(a) * rr, y = P.y - H * 0.45 + Math.sin(a) * rr * 0.4 - ph * 10; push(`ws${Math.floor(t * 8 + i) % 6}`, () => vFlame('soul', 6, 10, Math.floor(t * 8 + i), i), x, y, 2, P.y + Math.sin(a) * 10, 0.85); }
      }
      if (B.bossId === 'typhon' && dir4(b.facing) === 'down' && /(_active|light_attack|heavy_attack)$/.test(b.anim)) {
        // a punch toward the camera cannot read in profile: show the fist head-on, oversized by foreshortening
        const h1 = anchorWorld(b, 'hand'), h2 = anchorWorld(b, 'handO'), hd = h1 && h2 ? (h1.y > h2.y ? h1 : h2) : h1 || h2;
        if (hd) { const k = Math.min(1, b.animT / 0.12), sz = Math.round((U ? 15 : 8) * (0.7 + 0.5 * k));
          push(`ffl${U}${Math.floor(t * 20) % 3}`, () => vSpeedLines('force', U ? 64 : 34, Math.floor(t * 20) % 3, 3), hd.x, hd.y, 3, undefined, 0.8);
          push(`ff${sz}${k > 0.6 ? 2 : 1}`, () => vFistFront(sz, k > 0.6 ? 1 : 0.5), hd.x, hd.y + sz * 0.3, 3); }
      }
      if (busy) push(`ag${BOSS_INFO_ID(B.bossId)}${Math.floor(t * 8) % 4}`, () => vSpeedLines(BOSS_EL[B.bossId], U ? 60 : 30, Math.floor(t * 8) % 3, 2), P.x, P.y - 8, 0, undefined, 0.5);
      if (U || busy) { // ground signature under feet: Surtur heat glow, Aion faint slow clock (signature), Anubis amber fog
        if (B.bossId === 'aion' && U) push(`sgA${Math.floor(t * 2) % 144}`, () => vSigil('aion', 64, Math.floor(t * 2) % 144, 0), P.x, P.y, 0, undefined, 0.45);
        if (B.bossId === 'surtur' && U) for (let k = 0; k < 4; k++) { const a = t * 0.4 + k * 1.57; push(`gf${Math.floor(t * 10 + k) % 6}`, () => vFlame('fire', 10, 16, Math.floor(t * 10 + k), k + 3), P.x + Math.cos(a) * 34, P.y + Math.sin(a) * 10 - 8, 2, P.y + Math.sin(a) * 10); }
      }
      return out;
    } });
}

// ---------------- skill phase choreography ----------------
function sigil(c: SkillCtx, big: boolean) {
  const b = c.b, B = b.boss!, U = c.U, rad = (U ? 70 : 32) * (big ? 1.45 : 1), per = SIGIL_PERIOD[B.bossId], runner = c.runner, rate = B.bossId === 'aion' ? 10 : 7;
  let endT = -1;
  return owned(c.w, b, { kind: 'sigil', life: 60, pos: b.pos, data: { hot: -9 }, update() { const e = this as Ent; if (endT < 0 && (runner.done || B.runner !== runner)) endT = e.t; if (endT >= 0 && e.t - endT > 0.45) e.dead = true; },
    render(w) { if (!on(w)) return []; const e = this as Ent, grow = Math.min(1, e.t / 0.3), fade = endT >= 0 ? 1 - (e.t - endT) / 0.45 : 1, hot = w.t - (e.data.hot as number) < 0.18 ? 2 : w.t - (e.data.hot as number) < 0.45 ? 1 : 0;
      const rr = Math.max(8, Math.round(rad * (0.35 + 0.65 * grow))), st = Math.floor(e.t * rate) % per;
      return [{ k: 'spr', key: `sg${B.bossId}${rr}${st}${hot}`, make: () => vSigil(B.bossId, rr, st, hot), x: b.pos.x, y: b.pos.y, layer: 0, alpha: Math.max(0, fade) * (0.75 + 0.25 * grow) }]; } });
}
function gather(c: SkillCtx) {
  const b = c.b, B = b.boss!, el = BOSS_EL[B.bossId], U = c.U, runner = c.runner;
  return owned(c.w, b, { kind: 'gather', life: 4, pos: b.pos, update() { const e = this as Ent; if (runner.done || e.data.stop) e.dead = true; },
    render(w) { if (!on(w)) return []; const e = this as Ent, A = anchorWorld(b, EMIT[B.bossId]) || v(b.pos.x, b.pos.y - 40), out: Cmd[] = [], n = hq(w) ? 14 : 7;
      for (let i = 0; i < n; i++) { const ph = (e.t * 1.8 + i / n) % 1, a = i * 2.39 + e.t * 2, rr = (U ? 90 : 44) * (1 - ph) ** 1.4; const x = A.x + Math.cos(a) * rr, y = A.y + Math.sin(a) * rr * 0.7; out.push({ k: 'spr', key: `ga${el}${ph > 0.7 ? 1 : 0}`, make: () => vDot(el, ph > 0.7 ? 1 : 0, 1), x, y, layer: 3 }); }
      if (Math.floor(e.t * 12) % 3 === 0) out.push({ k: 'spr', key: `gl${el}${U ? 6 : 3}`, make: () => vGlint(el, U ? 6 : 3), x: A.x, y: A.y, layer: 3, alpha: 0.8 });
      return out; } });
}
function trail(c: SkillCtx) {
  const b = c.b, B = b.boss!, el = BOSS_EL[B.bossId], U = c.U, runner = c.runner, pts: { x: number; y: number; t: number }[] = [], ghosts: { x: number; y: number; t: number; key: string; dir: ReturnType<typeof dir4>; pose: any }[] = [];
  let lastG = -1, lastPos = v(b.pos.x, b.pos.y);
  return owned(c.w, b, { kind: 'trail', life: 30, pos: b.pos, update(w) {
      const e = this as Ent; const live = !e.data.stop && !runner.done && B.runner === runner;
      if (live) { const A = anchorWorld(b, EMIT[B.bossId]); if (A) { const L = pts[pts.length - 1]; if (L && dist(L, A) > 3) { const n = Math.ceil(dist(L, A) / 3); for (let k = 1; k < n; k++) pts.push({ x: L.x + (A.x - L.x) * k / n, y: L.y + (A.y - L.y) * k / n, t: w.t }); } pts.push({ x: A.x, y: A.y, t: w.t }); } }
      const moved = dist(lastPos, b.pos) / w.dt; lastPos = v(b.pos.x, b.pos.y);
      if (live && hq(w) && el === 'time' && w.t - lastG > 0.07) { // temporal afterimages are Aion's identity; other bosses must never be recoloured by their own trail
        lastG = w.t; const clips = clipsFor(B.bossId, B.form), clip = clips[b.anim] || clips.idle, fi = frameAt(clip, b.animT * 1000), d = dir4(b.facing);
        ghosts.push({ x: b.pos.x, y: b.pos.y, t: w.t, key: `${clip.name}${fi}`, dir: d, pose: clip.frames[fi].p });
      }
      while (pts.length && w.t - pts[0].t > 0.32) pts.shift(); while (ghosts.length && w.t - ghosts[0].t > 0.4) ghosts.shift();
      if (!live && !pts.length && !ghosts.length) e.dead = true;
    },
    render(w) {
      if (!on(w)) return []; const out: Cmd[] = [], fa = FORM_ART[B.bossId][B.form];
      for (const g of ghosts) { const age = (w.t - g.t) / 0.4; out.push({ k: 'spr', key: `ag${B.bossId}${B.form}${g.dir}${g.key}${el}`, make: () => vGhostOf(B.bossId, B.form, g.dir, g.pose, g.pose.f ?? 0, el, `tr${g.key}`), x: g.x - fa.root[0] + fa.size / 2, y: g.y - fa.root[1] + fa.size / 2, layer: 2, z: g.y - 0.5, alpha: 0.5 * (1 - age) }); }
      const W = U ? 4 : 3;
      // one continuous aged ribbon (tapers by index = age)
      if (pts.length > 1) out.push({ k: 'ribbon', pts, x: 0, y: 0, w: W, el, layer: 3, alpha: 0.95 });
      pts.forEach((p, i) => { const age = Math.min(3, Math.floor(((w.t - p.t) / 0.32) * 4)), wd = Math.max(1, Math.round(W * (1 - age * 0.18))); void wd; // disc stamps removed: uniform discs along the path re-formed the smooth tube
        if (hq(w) && i % 3 === 0 && age >= 1) { const rise = (w.t - p.t) * 40;
          if (el === 'fire') out.push({ k: 'spr', key: `tf${Math.floor(w.t * 14 + i) % 6}`, make: () => vFlame('fire', U ? 8 : 5, U ? 14 : 9, Math.floor(w.t * 14 + i), i), x: p.x, y: p.y - rise - 4, layer: 3 });
          else if (el === 'soul') out.push({ k: 'spr', key: `ts${Math.floor(w.t * 10 + i) % 6}`, make: () => vFlame('soul', 6, 10, Math.floor(w.t * 10 + i), i), x: p.x, y: p.y - rise - 4, layer: 3, alpha: 0.85 });
          else if (el === 'time') out.push({ k: 'spr', key: `tg${i % 4}`, make: () => vGear(1, i), x: p.x + Math.sin(i) * 4, y: p.y - rise * 0.5, layer: 3 });
          else if (el === 'space') out.push({ k: 'spr', key: `tt${i % 2}`, make: () => vTwinkle('space', 1 + (i % 2)), x: p.x, y: p.y, layer: 3 });
          else if (el === 'mind') out.push({ k: 'spr', key: `tm`, make: () => vTwinkle('mind', 2), x: p.x, y: p.y, layer: 3 });
          else out.push({ k: 'spr', key: `tk${i % 8}`, make: () => vRock(1, i, 'force'), x: p.x + Math.sin(i * 3) * rise * 0.4, y: p.y + rise * 0.3, layer: 3 });
        } });
      return out;
    } });
}
/** catastrophic ritual ring: 8 element pillars orbiting the boss while charging */
function ritual(c: SkillCtx) {
  const b = c.b, B = b.boss!, el = BOSS_EL[B.bossId], runner = c.runner, R0 = 120;
  return owned(c.w, b, { kind: 'ritual', life: 6, pos: b.pos, update() { const e = this as Ent; if (runner.done || e.data.stop) e.dead = true; },
    render(w) { if (!on(w)) return []; const e = this as Ent, out: Cmd[] = [], grow = Math.min(1, e.t / 0.8);
      for (let i = 0; i < 8; i++) { const a = e.t * 0.6 * (i % 2 ? 1 : -1) * 0 + e.t * 0.5 + (i / 8) * 6.283, x = b.pos.x + Math.cos(a) * R0 * grow, y = b.pos.y + Math.sin(a) * R0 * 0.45 * grow, f = Math.floor(w.t * 12 + i);
        if (el === 'fire' || el === 'soul') out.push({ k: 'spr', key: `rp${el}${f % 6}`, make: () => vFlame(el, 12, 30, f, i), x, y: y - 14, layer: 2, z: y });
        else if (el === 'force') out.push({ k: 'spr', key: `rr${i % 8}`, make: () => vRock(5, i, 'force'), x, y: y - 20 - Math.sin(w.t * 3 + i) * 8, layer: 2, z: y });
        else if (el === 'time') out.push({ k: 'spr', key: `rg${f % 4}`, make: () => vGear(4, f), x, y: y - 24, layer: 2, z: y });
        else if (el === 'space') out.push({ k: 'spr', key: `rt${f % 3}`, make: () => vTwinkle('space', 3 + (f % 3)), x, y: y - 24, layer: 2, z: y });
        else out.push({ k: 'spr', key: `re${Math.floor(e.t * 3) % 2}`, make: () => vEye(6, Math.floor(e.t * 3) % 2 ? 1 : 0.5, 0, 0.5, 0.6, true), x, y: y - 26, layer: 2, z: y }); }
      return out; } });
}
function glint(c: SkillCtx) {
  const b = c.b, B = b.boss!, el = BOSS_EL[B.bossId], A = anchorWorld(b, EMIT[B.bossId]); if (!A) return;
  const s = c.U ? 9 : 5;
  c.w.add(mkEnt(c.w, 0, undefined, { kind: 'fx', life: 0.18, pos: A, update() {}, render(w) { const e = this as Ent; return on(w) ? [{ k: 'spr', key: `cg${el}${s}${e.t > 0.09 ? 1 : 0}`, make: () => vGlint(el, e.t > 0.09 ? Math.max(2, s - 3) : s), x: A.x, y: A.y, layer: 3 }] : []; } }));
}

/**
 * Boss-specific anticipation language. Shared particles were readable but made six very different
 * bosses feel authored by the same effect template. This entity gives each boss a different spatial
 * composition while staying presentation-only and attached to the real body/weapon anchors.
 */
function bespokeOpen(c: SkillCtx) {
  const w = c.w, b = c.b, B = b.boss!, id = c.skill.id, U = c.U, runner = c.runner, T = c.tpos();
  return owned(w, b, { kind: 'bespoke-open', life: 8, pos: b.pos,
    update() { const e = this as Ent; if (runner.done || e.data.stop || B.runner !== runner) e.dead = true; },
    render() {
      if (!on(w)) return [];
      const e = this as Ent, t = e.t, out: Cmd[] = [], P = b.pos;
      const A = anchorWorld(b, EMIT[B.bossId]) || v(P.x, P.y - (U ? 70 : 36));
      const H = anchorWorld(b, 'hand') || A, HO = anchorWorld(b, 'handO') || v(P.x + (U ? 24 : 12), P.y - (U ? 55 : 27));
      if (B.bossId === 'surtur') {
        // Three coherent fire waves crawl from hilt to tip. Each keeps its silhouette while cooling.
        for (let wave = 0; wave < 3; wave++) {
          const ph = (t * 1.45 - wave * 0.24 + 1) % 1, x = H.x + (A.x - H.x) * ph, y = H.y + (A.y - H.y) * ph;
          out.push({ k: 'spr', key: `sfw${wave}${Math.floor(t * 14) % 8}`, make: () => vFlame('fire', U ? 14 : 9, U ? 28 : 17, Math.floor(t * 14) + wave * 2, wave + 2), x, y: y - (U ? 11 : 6), layer: 2, z: P.y + 30, alpha: 0.8 + wave * 0.08 });
        }
        const rr = U ? 58 : 28, f = Math.floor(t * 8) % 4;
        out.push({ k: 'spr', key: `sheat${rr}${f}`, make: () => vCrack('fire', rr, 3, f < 2 ? 2 : 1), x: P.x, y: P.y, layer: 0, alpha: 0.75 });
      } else if (B.bossId === 'typhon') {
        // Compression plates collapse toward both fists instead of orbiting like magic particles.
        for (const [hand, side] of [[H, -1], [HO, 1]] as [V, number][]) {
          const pulse = 1 - ((t * 1.8 + (side > 0 ? 0.25 : 0)) % 1), rr = Math.max(7, (U ? 44 : 23) * pulse);
          out.push({ k: 'spr', key: `tcp${rr}${side}`, make: () => vShock('force', Math.round(rr / 4) * 4, 5, U ? 5 : 3, side + 3), x: hand.x, y: hand.y, layer: 1, alpha: 0.35 + (1 - pulse) * 0.3 });
          if (hq(w)) for (let i = 0; i < 3; i++) { const a = i * 2.1 + t * side, d = rr * 0.7; out.push({ k: 'spr', key: `trock${i}`, make: () => vRock(U ? 3 : 2, i + side + 4, 'force'), x: hand.x + Math.cos(a) * d, y: hand.y + Math.sin(a) * d * 0.6, layer: 3 }); }
        }
      } else if (B.bossId === 'aion') {
        // The body occupies three nearby instants while the local clock deliberately runs backward.
        const clips = clipsFor('aion', B.form), clip = clips[b.anim] || clips.idle, fi = frameAt(clip, b.animT * 1000), d = dir4(b.facing), pose = clip.frames[fi].p;
        for (const k of [-1, 1]) out.push({ k: 'spr', key: `aexp${B.form}${d}${clip.name}${fi}${k}`, make: () => vGhostOf('aion', B.form, d, pose, pose.f ?? fi, 'time', `open${clip.name}${fi}${k}`), x: P.x - FORM_ART.aion[B.form].root[0] + FORM_ART.aion[B.form].size / 2 + k * (U ? 22 : 11), y: P.y - FORM_ART.aion[B.form].root[1] + FORM_ART.aion[B.form].size / 2, layer: 2, z: P.y - 1, alpha: 0.22 + 0.08 * Math.sin(t * 9 + k) });
        for (let i = 0; i < (U ? 8 : 4); i++) { const a = -t * 1.8 + i * 0.9, rr = U ? 72 : 36; out.push({ k: 'spr', key: `agear${i}${Math.floor(t * 8) % 4}`, make: () => vGear(U ? 3 : 2, Math.floor(t * 8) + i), x: P.x + Math.cos(a) * rr, y: P.y - (U ? 64 : 32) + Math.sin(a) * rr * 0.45, layer: 2, z: P.y + Math.sin(a) * 8 }); }
      } else if (B.bossId === 'atlas') {
        // Two anatomical rifts sit behind the hands and deepen during the wind-up.
        const op = Math.min(1, t / 0.3), sz = U ? 30 : 16;
        out.push({ k: 'spr', key: `apr${sz}${op.toFixed(1)}${Math.floor(t * 10) % 8}`, make: () => vPortalV2(sz, op, Math.floor(t * 10), 1), x: H.x, y: H.y, layer: 2, z: H.y - 1 });
        out.push({ k: 'spr', key: `apl${sz}${op.toFixed(1)}${Math.floor(t * 10 + 4) % 8}`, make: () => vPortalV2(sz, op, Math.floor(t * 10 + 4), 2), x: HO.x, y: HO.y, layer: 2, z: HO.y - 1 });
        for (let i = 0; i < (U ? 10 : 5); i++) { const a = t * 0.7 + i * 0.7, rr = (U ? 95 : 46) * (0.7 + (i % 2) * 0.2); out.push({ k: 'spr', key: `ashard${i % 3}`, make: () => vTwinkle('space', 1 + i % 3), x: P.x + Math.cos(a) * rr, y: P.y - (U ? 64 : 31) + Math.sin(a) * rr * 0.4, layer: 2 }); }
      } else if (B.bossId === 'argus') {
        // Ordered ocular battery: nodes are disciplined, not a random yellow particle cloud.
        const n = U ? 7 : 4, rr = U ? 99 : 47;
        for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + Math.sin(t * 0.7) * 0.08, x = P.x + Math.cos(a) * rr, y = P.y - (U ? 72 : 36) + Math.sin(a) * rr * 0.38, charge = Math.min(1, t / 0.7); out.push({ k: 'spr', key: `aeye${U}${i}${charge.toFixed(1)}`, make: () => vEye(U ? 12 : 8, Math.min(1, t / 0.3) * (0.55 + 0.45 * Math.sin(t * 3 + i) ** 2), -Math.cos(a), -Math.sin(a), charge, true), x, y, layer: 2, z: P.y + Math.sin(a) * 8 }); if (i % 2 === 0 && t > 0.35) out.push({ k: 'beam', x, y, x2: A.x, y2: A.y, w: 0, el: 'mind', layer: 2, alpha: 0.5 }); }
      } else {
        // Funeral court: individual spectres rise in ordered depth planes; a chain corona binds the tableau.
        const n = U ? 8 : 4, rr = U ? 100 : 46;
        for (let i = 0; i < n; i++) { const a = Math.PI + (i / Math.max(1, n - 1)) * Math.PI, x = P.x + Math.cos(a) * rr, y = P.y - (U ? 62 : 30) + Math.sin(a) * rr * 0.38; out.push({ k: 'spr', key: `court${i}${Math.floor(t * 7) % 4}`, make: () => vGhostV2(Math.floor(t * 7) + i, i % 3, 'soul'), x, y, layer: 2, z: P.y + Math.sin(a) * 8, alpha: 0.45 + 0.25 * Math.min(1, t / 0.5) }); }
        if (U) out.push({ k: 'chain', x: P.x - rr, y: P.y - 35, x2: P.x + rr, y2: P.y - 35, el: 'soul', layer: 2, alpha: 0.8 });
      }
      // Mechanism accent. This differentiates each skill family inside the same boss language.
      if (/pursuit|rampage|skip|step|rewind/.test(id)) {
        const d = b.facing, n = U ? 7 : 4;
        for (let i = 1; i <= n; i++) out.push({ k: 'spr', key: `dash${B.bossId}${i}${Math.floor(t * 9) % 3}`, make: () => vSpeedLines(BOSS_EL[B.bossId], U ? 34 : 18, Math.floor(t * 9) % 3, i), x: P.x - d.x * i * (U ? 17 : 9), y: P.y - d.y * i * (U ? 17 : 9) - (U ? 35 : 17), layer: 2, alpha: 0.7 - i / (n * 2) });
      }
      if (/rain|descent|spearfield|orbital|ruin/.test(id)) {
        const n = U ? 8 : 5;
        for (let i = 0; i < n; i++) { const x = T.x + (hash2(i, 4, 7) - 0.5) * (U ? 180 : 90), y = T.y - (U ? 150 : 75) + ((t * (U ? 75 : 48) + i * 23) % (U ? 140 : 70)); const a = Math.PI / 2 + (hash2(i, 6, 2) - 0.5) * 0.35; out.push({ k: 'spr', key: `sky${B.bossId}${i}`, make: () => B.bossId === 'argus' ? vLance('mind', a, U ? 28 : 15) : B.bossId === 'aion' ? vBlade('time', a, U ? 18 : 9, true) : vTwinkle(BOSS_EL[B.bossId], 2 + i % 3), x, y, layer: 3, alpha: 0.45 + 0.4 * Math.min(1, t / 0.5) }); }
      }
      if (/trap|hour|snare|array|gates|field|moment/.test(id)) {
        for (let i = 0; i < (U ? 4 : 2); i++) { const a = i * (U ? 1.57 : 3.14) + t * (i % 2 ? -0.25 : 0.25), qx = T.x + Math.cos(a) * (U ? 85 : 42), qy = T.y + Math.sin(a) * (U ? 45 : 23); out.push({ k: 'spr', key: `node${B.bossId}${i}${Math.floor(t * 5)}`, make: () => vSigil(B.bossId, U ? 22 : 12, Math.floor(t * 5 + i * 7) % SIGIL_PERIOD[B.bossId], 0), x: qx, y: qy, layer: 0, alpha: 0.55 }); }
      }
      if (/chain|grasp|grip|command|vortex/.test(id)) {
        const n = U ? 3 : 2;
        for (let i = 0; i < n; i++) { const a = t * (i % 2 ? -1 : 1) + i * 2.1, qx = T.x + Math.cos(a) * (U ? 70 : 34), qy = T.y + Math.sin(a) * (U ? 36 : 18); if (B.bossId === 'anubis') out.push({ k: 'chain', x: qx, y: qy, x2: T.x, y2: T.y, el: 'soul', layer: 2, alpha: 0.4 }); }
      }
      if (/gaze|sight|witness|judgment|eyes/.test(id)) {
        const n = U ? 6 : 3;
        for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + t * 0.2, qx = T.x + Math.cos(a) * (U ? 100 : 50), qy = T.y + Math.sin(a) * (U ? 52 : 26); out.push({ k: 'spr', key: `watch${i}${Math.floor(t * 5)}`, make: () => vEye(U ? 6 : 4, 0.65 + 0.35 * Math.min(1, t / 0.4), -Math.cos(a), -Math.sin(a), Math.min(1, t / 0.8), i % 3 !== 1), x: qx, y: qy, layer: 2, z: T.y + Math.sin(a) * 8 }); }
      }
      if (/summon|hunt|procession|epoch|split|passage/.test(id)) {
        const n = U ? 8 : 4;
        for (let i = 0; i < n; i++) { const a = Math.PI + (i / Math.max(1, n - 1)) * Math.PI, qx = P.x + Math.cos(a) * (U ? 130 : 60), qy = P.y - (U ? 45 : 22) + Math.sin(a) * (U ? 65 : 32); out.push({ k: 'spr', key: `host${B.bossId}${i}${Math.floor(t * 6)}`, make: () => B.bossId === 'anubis' ? vGhostV2(Math.floor(t * 6) + i, i % 3, 'soul') : vGhostOf(B.bossId, B.form, dir4(b.facing), { wA: -1.5 + (i % 3) * 0.7, reach: 1, glow: 0.8 }, i, BOSS_EL[B.bossId], `host${id}${i}`), x: B.bossId === 'anubis' ? qx : qx - FORM_ART[B.bossId][B.form].root[0] + FORM_ART[B.bossId][B.form].size / 2, y: B.bossId === 'anubis' ? qy : qy - FORM_ART[B.bossId][B.form].root[1] + FORM_ART[B.bossId][B.form].size / 2, layer: 2, z: qy, alpha: 0.3 + 0.15 * Math.sin(t * 5 + i) }); }
      }
      // Skill-specific accent: high-cooldown signatures get a second, counter-rotating motif.
      if (c.skill.cd >= 20) out.push({ k: 'spr', key: `cat2${B.bossId}${Math.floor(t * 5)}`, make: () => vSigil(B.bossId, U ? 118 : 58, (SIGIL_PERIOD[B.bossId] - Math.floor(t * 5)) % SIGIL_PERIOD[B.bossId], 1), x: P.x, y: P.y, layer: 0, alpha: 0.45 });
      void id;
      return out;
    } });
}

/** Boss-specific release frame: one unmistakable silhouette per primordial. */
function bespokeCommit(c: SkillCtx) {
  const w = c.w, b = c.b, B = b.boss!, U = c.U, P = b.pos, A = anchorWorld(b, EMIT[B.bossId]) || P, target = c.tpos();
  const life = U ? 0.62 : 0.42;
  if (w.quality === 'maximum_vfx') w.impactPulses.push({ x: A.x, y: A.y, t: 0, life: U ? 0.32 : 0.2, r: U ? 88 : 42, el: BOSS_EL[B.bossId], strength: U ? 4 : 2 });
  w.add(mkEnt(w, 0, undefined, { kind: 'bespoke-release', life, pos: A, update() {}, render() {
    if (!on(w)) return [];
    const e = this as Ent, u = e.t / life, f = Math.min(5, Math.floor(Math.pow(u, 0.55) * 6)), out: Cmd[] = [];
    if (B.bossId === 'surtur') {
      out.push({ k: 'spr', key: `srel${f}`, make: () => vNova('fire', U ? 42 : 22, f, 3), x: A.x, y: A.y, layer: 3 });
      for (let i = 0; i < 3; i++) out.push({ k: 'spr', key: `srf${i}${f}`, make: () => vFlame('fire', U ? 18 : 10, U ? 38 : 22, f + i, i), x: A.x + (i - 1) * (U ? 14 : 8), y: A.y - (U ? 22 : 12), layer: 3 });
    } else if (B.bossId === 'typhon') {
      out.push({ k: 'spr', key: `trel${f}`, make: () => vFist('force', U ? 25 : 13, Math.atan2(b.facing.y, b.facing.x)), x: A.x, y: A.y, layer: 3 });
      out.push({ k: 'spr', key: `trsh${f}`, make: () => vShock('force', (U ? 56 : 30) + f * 4, 5 - Math.min(3, f), U ? 6 : 4, 1), x: A.x, y: A.y, layer: 3 });
    } else if (B.bossId === 'aion') {
      for (let k = -1; k <= 1; k++) out.push({ k: 'spr', key: `arel${k}${f}`, make: () => vBlade('time', Math.atan2(b.facing.y, b.facing.x) + k * 0.45, U ? 20 : 10, f < 2), x: A.x + k * (U ? 18 : 9), y: A.y - Math.abs(k) * 5, layer: 3, alpha: 1 - u * 0.45 });
    } else if (B.bossId === 'atlas') {
      out.push({ k: 'spr', key: `atrel${f}`, make: () => vPortalV2(U ? 40 : 22, Math.min(1, u * 3), f, 2), x: A.x, y: A.y, layer: 3 });
      for (let i = 0; i < 6; i++) { const a = i * 1.047; out.push({ k: 'spr', key: `atw${i}${f}`, make: () => vTwinkle('space', 2 + (i % 2)), x: A.x + Math.cos(a) * (U ? 48 : 25) * (0.4 + u), y: A.y + Math.sin(a) * (U ? 28 : 15) * (0.4 + u), layer: 3 }); }
    } else if (B.bossId === 'argus') {
      out.push({ k: 'spr', key: `agrel${f}`, make: () => vEye(U ? 22 : 12, 1, b.facing.x, b.facing.y, 1, true), x: A.x, y: A.y, layer: 3 });
      for (let i = 0; i < (U ? 8 : 4); i++) { const a = i * (6.283 / (U ? 8 : 4)); out.push({ k: 'spr', key: `agl${i}`, make: () => vLance('mind', a, U ? 30 : 16), x: A.x + Math.cos(a) * (U ? 45 : 23) * u, y: A.y + Math.sin(a) * (U ? 45 : 23) * u, layer: 3 }); }
    } else {
      for (let i = 0; i < (U ? 8 : 4); i++) { const a = (i / (U ? 8 : 4)) * 6.283 + u, rr = (U ? 58 : 30) * (0.6 + u); out.push({ k: 'spr', key: `anrel${i}${f}`, make: () => vGhostV2(f + i, i % 3, 'soul'), x: A.x + Math.cos(a) * rr, y: A.y + Math.sin(a) * rr * 0.65, layer: 3, alpha: 1 - u * 0.55 }); }
    }
    return out;
  } }));
  // One force axis per release. It connects source → committed destination, so every secondary
  // spark, dust band and camera response supports a single readable direction instead of orbiting.
  const d = v(target.x - A.x, target.y - A.y), L = Math.hypot(d.x, d.y) || 1, ux = d.x / L, uy = d.y / L, nx = -uy, ny = ux;
  // A short, thick directional burst at the emitter instead of 1–3px rails that crossed the screen.
  // (The rails read as stray laser scratches and added no force information.)
  const fdir = norm(sub(target, A)), reach = U ? 46 : 24;
  w.add(mkEnt(w, 0, undefined, { kind: 'force-axis', life: U ? 0.3 : 0.22, pos: A, update() {}, render() {
    if (!on(w)) return [];
    const e = this as Ent, q = e.t / e.life, el2 = BOSS_EL[B.bossId], out: Cmd[] = [], rr = reach * (0.35 + q * 0.8);
    for (let i2 = 0; i2 < 7; i2++) {
      const a = ang(fdir) + (i2 - 3) * 0.16, L = rr * (0.6 + hash2(i2, 2, 5) * 0.7);
      for (let d = 6; d < L; d += 1) for (let wdt = -1; wdt <= 1; wdt++) { if (Math.abs(wdt) === 1 && q > 0.5) continue; out.push({ k: 'spr', key: `fb${el2}${i2}${Math.floor(q * 4)}`, make: () => vTwinkle(el2, Math.abs(wdt) ? 1 : 2), x: A.x + Math.cos(a) * d - Math.sin(a) * wdt, y: A.y + Math.sin(a) * d + Math.cos(a) * wdt, layer: 3, alpha: 1 - q }); }
    }
    return out;
  } }));

}


/** Foreground occlusion: huge, fast motes that pass *in front of* the camera. Adds depth to big attacks. */
function foreground(c: SkillCtx) {
  // REMOVED: screen-space foreground motes. At gameplay scale the 2x white cores read as floating
  // UI squares, not depth. Return an immediately-dead entity so the call site stays intact.
  return owned(c.w, c.b, { kind: 'foreground', life: 0.01, pos: c.b.pos, update() { (this as Ent).dead = true; }, render() { return []; } });
  // eslint-disable-next-line no-unreachable
  const b = c.b, B = b.boss!, el = BOSS_EL[B.bossId], U = c.U, runner = c.runner, bits: { x: number; y: number; t: number; vx: number; vy: number; s: number; seed: number }[] = [];
  let last = -9;
  return owned(c.w, b, { kind: 'foreground', life: 12, pos: b.pos, update(w) {
      const e = this as Ent; const live = !e.data.stop && !runner.done && B.runner === runner;
      const n = w.quality === 'maximum_vfx' ? 3 : 1;
      if (live && w.t - last > 0.07) { last = w.t; for (let i = 0; i < n; i++) { const a = w.rng() * 6.283, sp = 70 + w.rng() * 130; bits.push({ x: b.pos.x + Math.cos(a) * (80 + w.rng() * 90), y: b.pos.y - 20 + Math.sin(a) * 40, t: w.t, vx: Math.cos(a) * sp * 0.5, vy: 20 + w.rng() * 50, s: 2 + Math.floor(w.rng() * 2), seed: Math.floor(w.rng() * 99) }); } }
      for (const p of bits) { p.x += p.vx * w.dt; p.y += p.vy * w.dt; p.vy += 26 * w.dt; }
      while (bits.length && w.t - bits[0].t > 0.9) bits.shift();
      if (!live && !bits.length) e.dead = true;
    },
    render(w) { if (!on(w)) return []; const out: Cmd[] = []; for (const p of bits) { const age = (w.t - p.t) / 0.9; if (age > 1) continue; out.push({ k: 'spr', key: `fg${el}${p.s}${Math.floor(w.t * 12 + p.seed) % 4}`, make: () => vForeground(el, p.s, Math.floor(w.t * 12 + p.seed)), x: p.x, y: p.y, layer: 4, w: 2 + (p.s - 1), alpha: 1 - age }); } return out; } });
}

function phaseHook(c: SkillCtx, tag: string) {
  const w = c.w, b = c.b, B = b.boss; if (!B) return;
  const cat = c.skill.cd >= 20, mem = c.runner as unknown as { fx?: Record<string, Ent> }, fx = (mem.fx ||= {});
  if (tag === 'OPEN') { if (c.skill.signature) { fx.sigil = sigil(c, cat); fx.gather = gather(c); fx.bespoke = bespokeOpen(c); } if (cat) { fx.ritual = ritual(c); w.flashEl = BOSS_EL[B.bossId]; } }
  else if (tag === 'COMMIT') { if (fx.sigil) fx.sigil.data.hot = w.t; glint(c); if (cat) w.flash = Math.max(w.flash, 0.35);
    const el = BOSS_EL[B.bossId], A = anchorWorld(b, EMIT[B.bossId]) || b.pos;
    w.add(mkEnt(w, 0, undefined, { kind: 'fx', life: 0.45, pos: A, update() {}, render() { const e = this as Ent, u = e.t / 0.45; return on(w) ? [{ k: 'spr', key: `cl${el}${Math.round(u * 3)}`, make: () => vSpeedLines(el, c.U ? 96 : 48, Math.round(u * 3), 2), x: A.x, y: A.y, layer: 3, alpha: 1 - u }, { k: 'spr', key: `cd${el}${Math.round(u * 3)}`, make: () => vDustRing(c.U ? 60 : 30, Math.round(u * 3), 1), x: b.pos.x, y: b.pos.y, layer: 2, z: b.pos.y + 2, alpha: 1 - u }] : []; } }));
    // Two visual freeze frames before the active window: this is anticipation punctuation, not post-hit lag.
    if (c.skill.signature && c.skill.cd >= 10) b.hitstopUntil = Math.max(b.hitstopUntil, w.t + (cat ? 0.05 : 0.033));
    bespokeCommit(c);
    if (cat) w.addShake(3); }
  else if (tag === 'ACTIVE') { if (fx.gather) fx.gather.data.stop = 1; if (fx.ritual) fx.ritual.data.stop = 1; if (fx.sigil && !fx.sigil.data.hot) fx.sigil.data.hot = w.t; fx.trail = trail(c); if (c.U || cat) fx.fg = foreground(c); if (c.U) w.addShake(1.5); if (!c.skill.signature) glint(c); }
  else if (tag === 'RECOVERY' || tag === 'END') { if (fx.trail) fx.trail.data.stop = 1; if (fx.gather) fx.gather.data.stop = 1; if (fx.bespoke) fx.bespoke.data.stop = 1; if (fx.fg) fx.fg.data.stop = 1; }
}
function hitHook(w: World, src: Actor, tg: Actor, dmg: number, o: HitOpts) {
  const el: El = o.el ?? (src.boss ? BOSS_EL[src.boss.bossId] : 'mind'), big = dmg >= 18, P = v(tg.pos.x, tg.pos.y - (tg.boss ? (tg.boss.form === 'ultimate' ? 60 : 30) : 9));
  const sz = big ? 18 : dmg >= 9 ? 11 : 7, seed = (w.frame % 3) + 1, col = tg.team === 'player' ? R.lava[3] : tg.boss ? R.mind[4] : R.k[1];
  w.add(mkEnt(w, 0, undefined, { kind: 'fx', life: 0.34, pos: P, update() {}, render(ww) { const e = this as Ent, u = Math.min(1, e.t / 0.34), f = Math.min(3, Math.floor(Math.pow(u, 0.55) * 4)); return on(ww) ? [{ k: 'spr', key: `ih2${el}${sz}${f}${seed}`, make: () => vHitV2(el, sz, f, seed), x: P.x, y: P.y, layer: 3 }, { k: 'spr', key: `ihn${el}${sz}${f}`, make: () => vNova(el, Math.max(8, sz), Math.min(5, f + 1), seed), x: P.x, y: P.y, layer: 3, alpha: 1 - u }] : []; } }));
  if (w.quality === 'maximum_vfx') { w.add(mkEnt(w, 0, undefined, { kind: 'fx', life: 0.5, pos: P, update() {}, render() { const e = this as Ent; return [{ k: 'spr', key: `hd${sz}`, make: () => vDustRing(sz * 2, Math.min(3, Math.floor(e.t * 10)), seed), x: P.x, y: tg.pos.y + 2, layer: 2, z: tg.pos.y + 3, alpha: 0.9 - e.t * 1.4 }]; } })); w.add(mkEnt(w, 0, undefined, { kind: 'fx', life: 0.22, pos: P, update() {}, render() { return [{ k: 'spr', key: `hs${el}${sz}`, make: () => vSpeedLines(el, Math.max(12, sz * 2), 1, seed), x: P.x, y: P.y, layer: 3 }]; } })); }
  if (big) { w.flash = Math.max(w.flash, tg.team === 'player' ? 0.28 : 0.16); w.flashEl = el; }
  if (dmg >= 24) w.impactFrame = { t: w.t, el, x: tg.pos.x, y: tg.pos.y - 8 };
  if (w.quality === 'maximum_vfx') w.impactPulses.push({ x: tg.pos.x, y: tg.pos.y - 6, t: 0, life: big ? 0.28 : 0.16, r: big ? 48 : 26, el, strength: big ? 4 : 2 });
  if (big && hq(w)) for (let k = 0; k < 2; k++) { const sx = P.x + (k ? 6 : -6); w.add(mkEnt(w, 0, undefined, { kind: 'fx', life: 0.6, pos: P, update() {}, render() { const e = this as Ent, f = Math.min(5, Math.floor(e.t * 10)); return [{ k: 'spr', key: `hs${f}${k}`, make: () => vSmoke(5, f, k + 2, el === 'fire'), x: sx, y: P.y - e.t * 20, layer: 3 }]; } })); }
  const jitter = (w.frame % 5) - 2;
  w.add(mkEnt(w, 0, undefined, { kind: 'fx', life: 0.75, pos: P, update() {}, render() { const e = this as Ent, up = e.t < 0.15 ? e.t * 120 : 18 + (e.t - 0.15) * 12; return [{ k: 'spr', key: `dn${dmg}${col}`, make: () => vDigits(dmg, col), x: P.x + jitter * 2, y: P.y - 6 - up, layer: 3, alpha: e.t > 0.55 ? (0.75 - e.t) * 5 : 1 }]; } }));
  if (tg.team === 'player' && big) w.addShake(2);
}
export function installFx(w: World) { w.hooks.phase = phaseHook; w.hooks.hit = hitHook; w.hooks.spawnBoss = aura; }
