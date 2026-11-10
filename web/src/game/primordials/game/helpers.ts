import { SkillCtx, Shape, HitOpts, Cmd, V, v, add, mul, norm, sub, dist, segDist, hitTest, fromAng, ang, Ent, World, mkEnt, SkillDef, AIView, SkillGen } from './core';
import { vFlame, vScorch, vSlash, vZoneCircle, vRock, El, vDot, q, vSmoke, vCrack, vGear, vTwinkle, vImpact, vNova, vShock, vSlashV2, vFlameV2, vDustRing, vSpeedLines, vHitV2, vSlashV3, vBlast, vGroundRing, vMushroom } from '../art/vfx';
import type { BossId, Form } from '../art/clips';

export const QN = (w: World, n: number) => (w.quality === 'art_only' ? 0 : w.quality === 'gameplay_vfx' ? Math.ceil(n * 0.5) : n);

/** animated focal burst, world-fixed */
export function burst(c: SkillCtx | World, el: El, x: number, y: number, rad: number, life = 0.3, ring = true) {
  const w = c instanceof World ? c : c.w;
  // If the blast is centred on a body, render its body layers behind that actor: the hit star stays in front.
  const host = w.actors.find((a) => a.alive && Math.hypot(a.pos.x - x, a.pos.y - y) < (a.boss ? (a.boss.form === 'ultimate' ? 46 : 24) : 14));
  const bodyLayer: Cmd['layer'] = host ? 1 : 3;
  const L = rad >= 14 ? Math.max(life, 0.55) : life;
  w.add(mkEnt(w, 0, undefined, { kind: 'fx', pos: v(x, y), life: L, update() {}, render() {
    const u = Math.min(1, (this as Ent).t / L), f = Math.min(5, Math.floor(Math.pow(u, 0.62) * 6)), seed = (x | 0) % 7, out: Cmd[] = [];
    // timing from the CC0 reference: 3 very fast value-flash frames, then slower chunky decay
    const bf = u < 0.06 ? 0 : u < 0.12 ? 1 : u < 0.2 ? 2 : Math.min(7, 3 + Math.floor((u - 0.2) / 0.8 * 5));
    if (rad >= 14) { out.push({ k: 'spr', key: `bl${el}${rad}${bf}${seed % 4}`, make: () => vBlast(el, rad, bf, seed), x, y, layer: bodyLayer, alpha: host ? 0.82 : 1 }); if (bf >= 3 && bf <= 5) out.push({ k: 'spr', key: `nvc${el}${rad}${f}`, make: () => vNova(el, Math.max(10, Math.round(rad * 0.6)), Math.min(5, f), seed), x, y, layer: bodyLayer, alpha: 0.7 }); }
    else if (rad >= 10) out.push({ k: 'spr', key: `nv${el}${rad}${f}${seed}`, make: () => vNova(el, rad, f, seed), x, y, layer: bodyLayer, alpha: host ? 0.78 : 1 });
    if (rad >= 14 && w.quality !== 'art_only') out.push({ k: 'spr', key: `gr${el}${q(rad * 1.6, 4)}${Math.min(3, Math.floor(u * 4))}`, make: () => vGroundRing(el, q(rad * 1.6, 4), Math.min(3, Math.floor(u * 4))), x, y: y + 2, layer: 0 });
    if (rad >= 28 && w.quality === 'maximum_vfx' && u > 0.12) { const mf = Math.min(5, Math.floor((u - 0.12) / 0.88 * 6)); out.push({ k: 'spr', key: `mu${el}${q(rad, 4)}${mf}`, make: () => vMushroom(el, q(rad * 0.9, 4), mf, seed), x, y: y - rad * 1.2, layer: 2, z: y + 1, alpha: 1 - Math.max(0, u - 0.7) * 2 }); }
    else out.push({ k: 'spr', key: `hv${el}${rad}${Math.min(3, f)}${seed}`, make: () => vHitV2(el, Math.max(3, rad), Math.min(3, f), seed), x, y, layer: bodyLayer });
    const rr = q(rad * (0.7 + u * 1.5), 4);
    if (ring && w.quality !== 'art_only') out.push({ k: 'spr', key: `r2${el}${rr}`, make: () => vShock(el, rr, u > 0.5 ? 3 : 5, u > 0.5 ? 2 : 4, seed), x, y, layer: host ? 0 : 1 });
    if (w.quality === 'maximum_vfx' && rad >= 10) out.push({ k: 'spr', key: `du${rr}${f}`, make: () => vDustRing(rad * 1.6, Math.min(3, Math.floor(u * 4)), seed), x, y: y + 4, layer: 2, z: y + 5 });
    return out;
  } }));
  if (w.quality !== 'art_only') burstExtra(w, el, x, y, rad);
}
function burstExtra(w: World, el: El, x: number, y: number, rad: number) {
  if (w.quality === 'maximum_vfx' && rad >= 12) w.add(mkEnt(w, 0, undefined, { kind: 'fx', pos: v(x, y), life: 0.4, update() {}, render() { const e = this as Ent; return [{ k: 'spr', key: `sl${el}${rad}`, make: () => vSpeedLines(el, q(rad * 2.2, 4), Math.min(2, Math.floor(e.t * 10))), x, y, layer: 3, alpha: 1 - e.t / 0.4 }]; } }));
  const big = rad >= 14, n = w.quality === 'maximum_vfx' ? (big ? 4 : 2) : 1;
  if (el === 'force' || (el === 'fire' && big) || (el === 'space' && big)) { const cr = Math.min(64, rad * 2.2); w.add(mkEnt(w, 0, undefined, { kind: 'decal', policy: 'detach', pos: v(x, y), life: 3.5, update() {}, render() { const e = this as Ent, heat = e.t < 0.4 ? 2 : e.t < 1.2 ? 1 : 0; return [{ k: 'spr', key: `ck${el}${cr}${(x | 0) % 6}${heat}`, make: () => vCrack(el, cr, x | 0, heat), x, y, layer: 0 }]; } })); }
  for (let k = 0; k < n; k++) {
    const sx = x + (k - (n - 1) / 2) * rad * 0.5, seed = k + ((x | 0) % 5);
    if (el === 'fire' || el === 'force') w.add(mkEnt(w, 0, undefined, { kind: 'fx', pos: v(sx, y), life: 0.9, update() {}, render() { const e = this as Ent, f = Math.min(5, Math.floor(e.t / 0.15)); return [{ k: 'spr', key: `bs${el}${Math.round(rad / 3)}${f}${seed % 4}`, make: () => vSmoke(Math.max(3, Math.round(rad / 3)), f, seed, el === 'fire'), x: sx, y: y - 6 - e.t * 26, layer: 3, alpha: 0.85 }]; } }));
    else if (el === 'time') w.add(mkEnt(w, 0, undefined, { kind: 'fx', pos: v(sx, y), life: 0.6, update() {}, render() { const e = this as Ent, a = k * 1.7 + e.t * 3; return [{ k: 'spr', key: `bg${Math.floor(e.t * 10) % 4}`, make: () => vGear(2, Math.floor(e.t * 10)), x: x + Math.cos(a) * rad * (0.5 + e.t), y: y + Math.sin(a) * rad * 0.5 * (0.5 + e.t), layer: 3 }]; } }));
    else if (el === 'space' || el === 'mind') w.add(mkEnt(w, 0, undefined, { kind: 'fx', pos: v(sx, y), life: 0.45, update() {}, render() { const e = this as Ent, a = k * 2.1; return [{ k: 'spr', key: `bt${el}${e.t < 0.2 ? 3 : 1}`, make: () => vTwinkle(el, e.t < 0.2 ? 3 : 1), x: x + Math.cos(a) * rad * 0.8, y: y + Math.sin(a) * rad * 0.5, layer: 3 }]; } }));
    else w.add(mkEnt(w, 0, undefined, { kind: 'fx', pos: v(sx, y), life: 0.9, update() {}, render() { const e = this as Ent, f = Math.floor(e.t * 12); return [{ k: 'spr', key: `bw${f % 6}${k % 3}`, make: () => vFlame('soul', 7, 12, f, k), x: sx + Math.sin(e.t * 6 + k) * 3, y: y - 8 - e.t * 40, layer: 3, alpha: 1 - e.t }]; } }));
  }
  if (big) w.add(mkEnt(w, 0, undefined, { kind: 'fx', pos: v(x, y), life: 0.2, update() {}, render() { const e = this as Ent, f = Math.min(3, Math.floor(e.t / 0.05)); return [{ k: 'spr', key: `bi${el}${Math.min(24, rad)}${f}`, make: () => vImpact(el, Math.min(24, rad), f, 2), x, y: y - 4, layer: 3 }]; } }));
}
/** ballistic debris chunks with independent motion (visual only, pooled per spawn) */
export function debris(c: SkillCtx | World, el: El, x: number, y: number, n: number, spd = 90, size = 2) {
  const w = c instanceof World ? c : c.w; n = QN(w, n); if (!n) return;
  const parts = Array.from({ length: n }, (_, i) => ({ x, y, z: 0, vx: Math.cos(i * 2.39) * spd * (0.4 + w.rng() * 0.8), vy: Math.sin(i * 2.39) * spd * 0.6 * (0.4 + w.rng() * 0.8), vz: 60 + w.rng() * 120, s: Math.max(1, Math.round(size * (0.5 + w.rng()))), seed: i }));
  w.add(mkEnt(w, 0, undefined, { kind: 'debris', pos: v(x, y), life: 1.4, update(_w, dt) { for (const p of parts) { if (p.z <= 0 && p.vz < 0) { p.vx *= 0.8; p.vy *= 0.8; p.z = 0; continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 400 * dt; } },
    render() { return parts.map((p) => ({ k: 'spr' as const, key: `rk${el}${p.s}${p.seed % 8}`, make: () => vRock(p.s, p.seed, el === 'fire' ? 'fire' : el === 'space' ? 'space' : 'force'), x: p.x, y: p.y - Math.max(0, p.z), layer: 3 as const })); } }));
}
/** detached cooling decal: stays at world coords after the boss moves or dies */
export function decal(c: SkillCtx | World, el: El, x: number, y: number, w0: number, h0: number, life: number) {
  const w = c instanceof World ? c : c.w;
  w.add(mkEnt(w, 0, undefined, { kind: 'decal', pos: v(x, y), life, policy: 'detach', update() {}, render() { const heat = Math.max(0, 3 - Math.floor(((this as Ent).t / life) * 4)); return [{ k: 'spr', key: `sc${el}${w0}${h0}${heat}`, make: () => vScorch(el, w0, h0, heat, (x | 0) % 6), x, y, layer: 0 }]; } }));
}
export interface ZoneOpts { shape: Shape; warn: number; active: number; linger?: number; o: HitOpts; el: El; look?: 'jet' | 'burst' | 'none'; major?: boolean; lingerHit?: HitOpts; decalSize?: [number, number]; onActive?: () => void; silentWarn?: boolean }
/** telegraphed hazard: warn (no damage) → active (real hitbox) → linger (optional low damage) → decal */
export function zone(c: SkillCtx, z: ZoneOpts) {
  const s = z.shape, cx = 'x' in s ? s.x : (s.x1 + s.x2) / 2, cy = 'y' in s ? s.y : (s.y1 + s.y2) / 2;
  let fired = false;
  return c.spawn({
    kind: 'zone', pos: v(cx, cy), life: z.warn + z.active + (z.linger ?? 0), lethal: true, major: z.major,
    update(w) {
      const e = this as Ent;
      if (e.t >= z.warn && !fired) { fired = true; z.onActive?.(); if (z.major && z.o.dmg >= 14) w.impactFrame = { t: w.t, el: z.el, x: cx, y: cy }; if (z.look !== 'none') { burst(w, z.el, cx, cy, 'r' in s ? Math.min(40, s.r) : 14, 0.3); } if (z.decalSize) decal(w, z.el, cx, cy, z.decalSize[0], z.decalSize[1], 4 + (z.linger ?? 0)); }
      if (e.t >= z.warn && e.t < z.warn + z.active && z.o.dmg > 0) w.hitEnemies(w.actor(e.owner)!, e.att!, s, z.o);
      else if (z.lingerHit && e.t >= z.warn + z.active) w.hitEnemies(w.actor(e.owner)!, e.att!, s, z.lingerHit);
    },
    render(w) {
      const e = this as Ent, out: Cmd[] = [];
      if (e.t < z.warn && !z.silentWarn) out.push({ k: 'zone', shape: s, x: cx, y: cy, layer: 1, el: z.el, prog: e.t / z.warn });
      if (e.t >= z.warn && e.t < z.warn + z.active + (z.linger ?? 0) && z.look === 'jet' && 'r' in s) {
        const f = Math.floor(e.t * 12), hh = e.t < z.warn + z.active ? 28 : Math.max(4, 16 * (1 - (e.t - z.warn - z.active) / (z.linger || 1)));
        out.push({ k: 'spr', key: `fl2${z.el}${q(s.r, 2)}${q(hh, 2)}${f % 8}`, make: () => vFlameV2(z.el, Math.max(6, s.r * 1.4), hh, f, e.id), x: cx, y: cy - hh / 2, layer: 2, z: cy });
      }
      if (z.lingerHit && e.t >= z.warn + z.active && 'r' in s) out.push({ k: 'zone', shape: s, x: cx, y: cy, layer: 1, el: z.el, prog: 1 });
      if (w.debug && e.t >= z.warn && e.t < z.warn + z.active) out.push({ k: 'zone', shape: s, x: cx, y: cy, layer: 3, prog: -1 });
      return out;
    },
    danger(p, horizon) { const e = this as Ent; return (z.o.dmg > 0 || !!z.lingerHit) && e.t + horizon >= z.warn && (e.t < z.warn + z.active || !!z.lingerHit) && hitTest(s, p, 6); },
  });
}
/** pure telegraph (never deals damage, never consumes the attack's hit budget) */
export function tele(c: SkillCtx, shape: Shape, warn: number, el: El, major = false) { return zone(c, { shape, warn, active: 0.01, o: { dmg: 0 }, el, look: 'none', major }); }
export interface ProjOpts { pos: V; vel: V; r: number; ttl: number; o: HitOpts; el: El; sprite: (a: number, t: number) => { key: string; make: () => import('../art/raster').Raster }; hops?: number; pierce?: boolean; delay?: number; trail?: boolean; onEnd?: (p: V, hit: boolean) => void; major?: boolean }
/** real travelling projectile: committed velocity (no homing), obstacle collision, portal hops (capped) */
export function proj(c: SkillCtx, p: ProjOpts) {
  let pos = v(p.pos.x, p.pos.y), vel = v(p.vel.x, p.vel.y), hops = 0;
  const spawnPt = p.hops ? c.w.ents.find((x) => !x.dead && x.kind === 'portal' && x.owner === c.b.id && dist(x.pos, pos) <= ((x.data.r as number) || 12) + 2) : undefined;
  let lastPortal = spawnPt ? spawnPt.id : -1;
  if (c.w.wallRaycast && dist(pos, c.b.pos) <= 44 && !c.w.map.queryValidPosition(pos, 2)) {
    pos = v(c.b.pos.x, c.b.pos.y);
  } else if (c.w.wallRaycast && c.w.wallRaycast(c.b.pos, pos)) {
    // Peripheral volley spawns (e.g. Omniscient Judgment / Spearfield horizontal barrage): pull start onto room rim
    const dirIn = norm(vel);
    for (let step = 16; step <= 260; step += 12) {
      const cand = add(pos, mul(dirIn, step));
      if (!c.w.wallRaycast(c.b.pos, cand) && c.w.map.queryValidPosition(cand, 2)) {
        pos = cand;
        break;
      }
    }
  }
  const e = c.spawn({
    kind: 'projectile', pos, life: p.ttl + (p.delay ?? 0), lethal: true, major: p.major,
    update(w, dt) {
      const me = this as Ent;
      if (me.t < (p.delay ?? 0)) return;
      const slowF = (w.ents.find((z) => !z.dead && z.kind === 'timefield' && dist(z.pos, pos) < (z.data.r as number)) ? 0.4 : 1);
      const prev = v(pos.x, pos.y);
      const np = add(pos, mul(vel, dt * slowF));
      if (w.map.raycast(pos, np).hit) { burst(w, p.el, np.x, np.y, 8, 0.2, false); me.dead = true; p.onEnd?.(np, false); return; }
      pos = np; me.pos = pos;
      // portal transit: entering an owned portal mouth moving inward, exit from linked portal with preserved speed
      if (p.hops) for (const pt of w.ents) {
        if (pt.dead || pt.kind !== 'portal' || pt.owner !== me.owner || pt.id === lastPortal || !pt.data.armed || (pt.data.link as number) <= 0) continue;
        if (segDist(prev, pos, pt.pos) < (pt.data.r as number) * 0.85) {
          const exit = w.ents.find((x) => x.id === pt.data.link && !x.dead && x.data.armed);
          if (!exit) { burst(w, 'space', pos.x, pos.y, 10, 0.25, false); me.dead = true; w.ev({ t: w.t, type: 'portal', note: 'projectile fizzled: exit closed' }); return; }
          if (hops >= p.hops) continue;
          hops++; lastPortal = exit.id; const spd = Math.hypot(vel.x, vel.y);
          vel = fromAng(exit.data.ang as number, spd); pos = add(exit.pos, fromAng(exit.data.ang as number, 6)); me.pos = pos;
          exit.data.flash = w.t; pt.data.flash = w.t;
          w.ev({ t: w.t, type: 'portal', note: `hop ${pt.id}->${exit.id} (${hops}/${p.hops})` });
          break;
        }
      }
      const hitShape: Shape = dist(prev, pos) > 0.5 && lastPortal === -1
        ? { k: 'capsule', x1: prev.x, y1: prev.y, x2: pos.x, y2: pos.y, r: p.r }
        : { k: 'circle', x: pos.x, y: pos.y, r: p.r };
      const hit = w.hitEnemies(w.actor(me.owner)!, me.att!, hitShape, { ...p.o, kbDir: vel });
      if (hit.length && !p.pierce) { burst(w, p.el, pos.x, pos.y, 12, 0.25); me.dead = true; p.onEnd?.(pos, true); }
      if (me.t >= me.life - dt) p.onEnd?.(pos, false);
    },
    render() { const me = this as Ent, a = ang(vel), sp = p.sprite(a, me.t), out: Cmd[] = [{ k: 'spr', key: sp.key, make: sp.make, x: pos.x, y: pos.y, layer: 3 }]; if (p.trail && me.t > (p.delay ?? 0)) for (let i = 1; i < 4; i++) out.push({ k: 'spr', key: `d${p.el}1${i}`, make: () => vDot(p.el, 1, i), x: pos.x - vel.x * 0.012 * i * 2, y: pos.y - vel.y * 0.012 * i * 2, layer: 3 }); return out; },
    danger(q2, h) { for (let t = 0; t <= h; t += 0.1) if (dist(add(pos, mul(vel, t)), q2) < p.r + 6) return true; return false; },
  });
  return e;
}
/** committed beam: capsule hitbox along a locked vector + stamped pixel beam */
export function beam(c: SkillCtx, from: V, dir: V, length: number, width: number, dur: number, o: HitOpts, el: El, fromFn?: () => V) {
  let d = norm(dir);
  const resolveFrom = () => {
    const raw = fromFn ? fromFn() : from;
    if (c.w.wallRaycast && dist(raw, c.b.pos) <= 56 && (c.w.wallRaycast(c.b.pos, raw) || !c.w.map.queryValidPosition(raw, 2))) {
      return v(c.b.pos.x, c.b.pos.y);
    }
    return raw;
  };
  const f0 = resolveFrom();
  if (c.w.wallRaycast && dist(fromFn ? fromFn() : from, f0) > 1 && c.tgt()) {
    d = norm(sub(c.tpos(), f0));
  }
  const shape = () => { const f = resolveFrom(); const r = c.w.map.raycast(f, add(f, mul(d, length))); return { k: 'capsule' as const, x1: f.x, y1: f.y, x2: r.p.x, y2: r.p.y, r: width / 2 }; };
  return c.hitbox(shape, dur, { maxHits: 3, rehit: 0.25, ...o, kbDir: d }, (_t, s) => s.k === 'capsule' ? [{ k: 'beam', x: s.x1, y: s.y1, x2: s.x2, y2: s.y2, w: Math.max(1, Math.round(width / 3)), el, layer: 3 }] : []);
}
export function slashLook(el: El, rad: number, a0: number, a1: number, wid: number, at: () => V) {
  return (t: number) => { const p = at(), f = Math.min(3, Math.floor(t * 20)); return [{ k: 'spr' as const, key: `sl${el}${rad}${a0.toFixed(2)}${a1.toFixed(2)}${wid}${f}`, make: () => vSlash(el, rad, a0, a1, wid, f), x: p.x, y: p.y, layer: 3 as const }]; };
}
/** sweeping arc hitbox: a sector whose leading edge travels from a0 to a1 over dur (tied to the blade path) */
export function sweep(c: SkillCtx, rad: number, a0: number, a1: number, dur: number, o: HitOpts, el: El, wid = 6, r0 = 0) {
  const t0 = c.w.t, at = () => c.b.pos;
  let span = a1 - a0; while (span > Math.PI) span -= 2 * Math.PI; while (span < -Math.PI) span += 2 * Math.PI;
  const look = (t: number) => { const k = Math.min(1, t / dur), cur = a0 + span * k, p = at(); return Math.abs(cur - a0) < 0.08 ? [] : [{ k: 'spr' as const, key: `sw2${el}${rad}${a0.toFixed(2)}${cur.toFixed(2)}${wid}`, make: () => vSlashV3(el, rad, a0, cur, wid, 0), x: p.x, y: p.y, layer: 3 as const }]; };
  c.w.add(mkEnt(c.w, c.b.id, undefined, { kind: 'fx', life: dur + 0.24, pos: c.b.pos, update() {}, render(w) { const e = this as Ent; if (e.t < dur || !w.quality || w.quality === 'art_only') return []; const f = Math.min(4, 1 + Math.floor((e.t - dur) / 0.06)), p = at(); return [{ k: 'spr', key: `sf3${el}${rad}${a0.toFixed(2)}${a1.toFixed(2)}${wid}${f}`, make: () => vSlashV3(el, rad, a0, a1, wid, f), x: p.x, y: p.y, layer: 3 }]; } }));
  return c.hitbox(() => { const k = Math.min(1, (c.w.t - t0) / dur), cur = a0 + span * k; const width = Math.max(0.5, Math.abs(span) * Math.min(k, 0.35)); return { k: 'sector', x: c.b.pos.x, y: c.b.pos.y, r: rad, r0, a: cur - Math.sign(span) * width / 2, span: width }; }, dur + 0.02, o, look);
}
export function lockAim(c: SkillCtx) { const a = c.aim(); c.face(a); return a; }
export const deg = (d: number) => (d * Math.PI) / 180;
export function sm(x: number, a: number, b: number) { return Math.max(0, Math.min(1, (x - a) / (b - a))); }
export function rangeFit(d: number, lo: number, hi: number) { return d < lo ? sm(d, lo * 0.5, lo) : d > hi ? 1 - sm(d, hi, hi * 1.4) : 1; }

/** a basic (non-signature) attack per form so the AI has a cheap poke; separate from the 48 */
export function basicAttack(boss: BossId, form: Form, el: El, reach: number, dmg: number): SkillDef {
  return {
    id: `${boss}_${form}_light`, name: 'Light Attack', boss, form, signature: false, cd: form === 'mini' ? 1.6 : 2.4, range: [0, reach * 1.1],
    score(ai: AIView) { const s = rangeFit(ai.d, 0, reach) * 0.5; return { s, why: [`basic poke, dist ${ai.d.toFixed(0)} vs reach ${reach}`] }; },
    *run(c: SkillCtx): SkillGen {
      c.phase('OPEN'); c.anim('light_attack'); const a = lockAim(c); yield 0.18;
      c.phase('ACTIVE'); sweep(c, reach, ang(a) - 1, ang(a) + 1.1, 0.12, { dmg, kb: 120, el }, el, 4); yield 0.2;
      c.phase('RECOVERY'); yield 0.2; c.phase('END');
    },
    doc: { open: 'short windup', active: 'small arc', vfx: 'element slash', end: 'short recovery', combo: '-', counter: 'step out', target: 'locked_on_commit', hitbox: 'sector', el },
  };
}
export { sub, dist, add, mul, norm, fromAng, ang, v, vZoneCircle };
