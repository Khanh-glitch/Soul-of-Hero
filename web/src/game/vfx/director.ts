// ============================================================================
// SOH VFX Director — choreography for the 7 Creator Cores (21 skills) and the
// 4 optional side bosses (12 moves). PRESENTATION ONLY: reads sim state/events,
// never writes gameplay. Every radius / range / tell / duration below is taken
// from the live hazard, projectile or balance value, so art lands where and
// when the damage does.
// ============================================================================
import * as S from './stage';
import type { Inst, Pt } from './stage';
import { BAL, VIEW_W, VIEW_H } from '../core';

type Any = any;
const TAU = Math.PI * 2;
const HUE = { fire: 28, ice: 198, nature: 105, storm: 215, spirit: 274, gold: 46, steel: 200 };
const CORE_HUE: Record<string, number> = { blast: HUE.fire, meteor: HUE.fire, dragon: HUE.fire, elsa: HUE.ice, earthmother: HUE.nature, mjolnir: HUE.storm, demon: HUE.spirit };
const css = (h: number, l = 72) => `hsl(${h} 95% ${l}%)`;
const W = (id: string) => { const f = S.def(id); return f.core[2] - f.core[0]; };
/** keep side-view "eruption line" art upright: mirror for leftward aims, clamp tilt */
function upr(a: number) { const left = Math.cos(a) < 0; let t = left ? Math.PI - a : a; t = Math.atan2(Math.sin(t), Math.cos(t)); t = Math.max(-0.7, Math.min(0.7, t)); return { angle: left ? -t : t, flipX: left }; }
const slam = (x: number, y: number, px: number, to = 1500) => S.fx('impacts/ground-slam', { x, y, layer: 'floor', scale: S.fit('impacts/ground-slam', px), to, fadeOut: 450 });
const impactFrame = (a: number) => S.fx('impacts/impact-frame', { x: VIEW_W / 2, y: VIEW_H / 2, layer: 'screen', scale: 2, alpha: a });

// ---- tracked state --------------------------------------------------------------
interface ProjT { kind: string; x: number; y: number; vx: number; vy: number; seen: number; own: boolean; insts: Inst[]; done: boolean; gone: boolean; next: number }
interface HazT { own: boolean; kind: string; tag: object; seen: number; next: number; n: number; born: number; dur: number; cancel: boolean; a: number; end: Pt | null }
interface MobT { state: string; phase: number; frozen: boolean; rooted: boolean; rootAt: number; vuln: Inst | null; tag: object; tx: number; ty: number; slam: boolean; dash: boolean; dashNext: number }
const projT = new Map<Any, ProjT>(), hazT = new Map<Any, HazT>(), mobT = new Map<string, MobT>(), trees = new Map<Any, Pt>();
let frame = 0, lastRun: Any = null, player: Any = null;
let bInst: Inst | null = null, bUntil = 0, bAng = 0, bLen = 60;
let iceOn = false, iceTag: object = {}, transit = false, meteorN = 0, strikeN = 0;
let dive: { tag: object; phase: string; index: number; x: number; y: number; ang: number; pos: Pt; inst: Inst | null } | null = null;
const storms: { x: number; y: number; at: number }[] = [], burnPts: { x: number; y: number; at: number }[] = [];
const P = () => player as Pt | null;

export function init() { S.preload(); }
export function reset() { S.clear(); projT.clear(); hazT.clear(); mobT.clear(); trees.clear(); bInst = null; dive = null; iceOn = false; transit = false; storms.length = 0; burnPts.length = 0; }
export function update(dt: number) { S.update(dt); }
export const ownsProj = (pr: Any) => projT.get(pr)?.own === true;
export const ownsHaz = (h: Any) => hazT.get(h)?.own === true;
export const ownsDragon = () => true;

// =================================================================================
// EVENTS
// =================================================================================
export function onEvent(e: Any, gs: Any): boolean {
  try { return route(e, gs); } catch (err) { if (!(onEvent as Any).warned) { (onEvent as Any).warned = true; console.warn('[vfx] director event error', e?.type, err); } return false; }
}
function route(e: Any, gs: Any): boolean {
  const r = gs?.run;
  switch (e.type) {
    case 'windup': if (!e.ck) return false; windup(e); return true;
    case 'cast': if (!e.ck) return false; if (e.sub === 'shard') shardHit(e.x, e.y, e.a ?? 0); else if (!e.sub) cast(e); return true;
    case 'rockhit': rockHit(e.x, e.y); return true;
    case 'bolt': bolt(e); return true;
    case 'boom': boom(e); return true;
    case 'spiritDepart': depart(e, r); return true;
    case 'spiritArrive': arrive(e); return true;
    case 'spiritHit': if (e.x !== undefined) S.fx('impacts/hit-spark', { x: e.x, y: e.y, lift: 6, anchor: 'focal', layer: 'over', scale: 0.34, hueTo: HUE.spirit }); return true;
    case 'mdeath': if (typeof e.type2 === 'string') bossDeath(e.type2, e.x, e.y); return false;
    default: return false;
  }
}

// ---- wind-up: 300 ms of gathering, coloured by the Core's element -----------------
function windup(e: Any) {
  const hue = CORE_HUE[e.ck] ?? HUE.spirit, big = e.mode === 'signature';
  S.fx('arcane/rune-circle', { follow: P, x: e.x, y: e.y, dy: 5, layer: 'floor', scale: big ? 0.62 : 0.44, grow: [0.4, 1, 280], loop: true, life: 440, fadeIn: 80, fadeOut: 160, hueTo: hue, rate: 2.4 });
  S.fx('arcane/spell-charge', { follow: P, x: e.x, y: e.y, dy: 6, layer: 'over', scale: big ? 0.6 : 0.46, loop: true, life: 320, fadeIn: 50, fadeOut: 90, hueTo: hue, flipX: Math.cos(e.a ?? 0) < 0, rate: 1.7 });
  if (e.ck === 'mjolnir') S.fx('lightning/electrified', { follow: P, x: e.x, y: e.y, dy: 6, layer: 'over', scale: 0.42, loop: true, life: 380, fadeOut: 110 });
  if (e.ck === 'dragon' && big) S.fx('status/rage', { follow: P, x: e.x, y: e.y, dy: 6, layer: 'over', scale: 0.56, loop: true, life: 430, fadeOut: 130, hueTo: HUE.fire });
  if (big) S.ring(P, 30, 5, 300, css(hue), { a: 0.75, flat: 0.62 });
}

// ---- release: the muzzle moment of each skill --------------------------------------
function cast(e: Any) {
  const a = e.a ?? 0, p: Pt = player ?? e, h = { x: e.x, y: e.y };
  const muzzle = (scale: number, to: number) => S.fx('projectiles/muzzle-shotgun', { ...h, lift: 6, anchor: 'axis', angle: a, upright: true, layer: 'over', scale, to, fadeOut: to * 0.4 });
  const fireRing = (px: number) => S.fx('fire/fire-ring', { x: p.x, y: p.y + 5, layer: 'floor', scale: S.fit('fire/fire-ring', px), from: 250, to: 1600, fadeOut: 350 });
  switch (`${e.ck}.${e.mode}`) {
    case 'blast.basic': S.fx('projectiles/muzzle-smg', { ...h, lift: 6, anchor: 'focal', angle: a, upright: true, layer: 'over', scale: 0.34, loop: true, life: 110, fadeOut: 50 }); break;
    case 'blast.refined': muzzle(0.38, 900); S.kick(1); break;
    case 'blast.signature': muzzle(0.64, 1300); fireRing(56); S.kick(3, 0.12); break;
    case 'meteor.basic': muzzle(0.3, 600); break;
    case 'meteor.refined': S.fx('impacts/hit-spark', { ...h, lift: 9, anchor: 'focal', layer: 'over', scale: 0.42 }); break;
    case 'meteor.signature': {
      const m = BAL.creatorCoreMeteor; S.tint('#5a1408', 0.26, 250, m.tellMs + m.stormCount * m.staggerMs, 800);
      S.fx('arcane/rune-circle', { follow: P, x: p.x, y: p.y, dy: 5, layer: 'floor', scale: 0.9, loop: true, life: 2400, fadeIn: 150, fadeOut: 450, hueTo: HUE.fire, rate: 1.6 });
      fireRing(76); S.kick(2.5, 0.1); break;
    }
    case 'dragon.refined': S.fx('fire/fire-ring', { x: e.x, y: e.y + 4, layer: 'floor', scale: S.fit('fire/fire-ring', 46), from: 250, to: 1400, fadeOut: 300 }); break;
    case 'dragon.signature': fireRing(84); S.tint('#6a1c06', 0.2, 150, 1000, 700); S.kick(3, 0.15); break;
    case 'elsa.basic': S.fx('ice/frost-breath', { ...h, lift: 6, angle: a, upright: true, layer: 'over', scale: 0.2, loop: true, life: 240, fadeIn: 40, fadeOut: 130 }); break;
    case 'elsa.signature': glacier(p); break;
    case 'earthmother.basic': S.fx('spawn/poof', { ...h, lift: 3, layer: 'over', scale: 0.26, from: 60 }); break;
    case 'earthmother.refined': S.fx('holy/heal-aoe', { x: p.x, y: p.y + 5, layer: 'floor', scale: S.fit('holy/heal-aoe', 48), from: 200 }); break;
    case 'mjolnir.basic': { const x = p.x + Math.cos(a) * 15, y = p.y + Math.sin(a) * 15; S.fx('impacts/blunt-hit', { x, y, lift: 6, anchor: 'focal', layer: 'over', scale: 0.42 }); S.fx('lightning/zap-hit', { x, y, lift: 6, angle: a, layer: 'over', scale: 0.36 }); S.kick(1.2); break; }
    case 'demon.basic': S.fx('impacts/hit-spark', { ...h, lift: 6, anchor: 'focal', angle: a, layer: 'over', scale: 0.36, hueTo: HUE.spirit }); break;
  }
}
/** Elsa signature — the whole viewport seizes: clock stops, nova sweeps, blades erupt. */
function glacier(p: Pt) {
  S.kick(4, 0.4); S.tint('#bfe9ff', 0.3, 80, 500, 2300);
  S.fx('arcane/time-stop', { x: p.x, y: p.y + 4, layer: 'over', scale: 0.8, hueTo: HUE.ice, alpha: 0.9, to: 2500, fadeOut: 500 });
  S.fx('ice/frost-nova', { x: p.x, y: p.y + 5, layer: 'floor', scale: 1.5, from: 300, fadeOut: 700 });
  S.ring(p, 10, 330, 700, '#e8fbff', { a: 0.9, w: 2 });
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.25, u = upr(a); S.fx('ice/ice-spikes', { x: p.x + Math.cos(a) * 16, y: p.y + 5 + Math.sin(a) * 12, ...u, layer: 'world', scale: 0.55, delay: 60 + k * 40, to: 2700, fadeOut: 500 }); }
  for (let k = 0; k < 10; k++) { const a = k * TAU / 10 + 0.6, d = 90 + (k % 3) * 45; S.fx('ice/snowflake-burst', { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.6, layer: 'over', scale: 0.5, delay: 180 + k * 45 }); }
}
// Impacts driven by sim events, so they play even when a shot lands on its very first tick (point blank).
function shardHit(x: number, y: number, a: number) { S.fx('ice/snowflake-burst', { x, y: y + 4, scale: 0.36 }); S.fx('ice/ice-shatter', { x, y: y + 4, scale: 0.2, from: 600, flipX: Math.cos(a) < 0 }); S.ring({ x, y: y + 2 }, 3, 22, 380, '#d8f4ff', { a: 0.85 }); }
function rockHit(x: number, y: number) { const R = BAL.creatorCoreEarthmother.rockRadius; S.fx('explosions/dirt-explosion', { x, y: y + 4, scale: 0.27, to: 2400, fadeOut: 500 }); slam(x, y + 4, R * 2.4, 1300); S.ring({ x, y }, 4, R, 260, '#e2cfa6', { a: 0.8 }); S.kick(1.8); }
function bolt(e: Any) {
  if (e.x0 === undefined) return; const a = Math.atan2(e.y1 - e.y0, e.x1 - e.x0);
  S.arc({ x: e.x0, y: e.y0 - 6 }, { x: e.x1, y: e.y1 - 6 }, 170);
  S.fx('lightning/zap-hit', { x: e.x1, y: e.y1, lift: 6, angle: a, layer: 'over', scale: 0.4 });
  S.fx('lightning/electrified', { x: e.x1, y: e.y1 + 5, layer: 'over', scale: 0.4, loop: true, life: 420, fadeOut: 160 });
}
function boom(e: Any) {
  if (e.x === undefined) return; const x = e.x, y = e.y;
  if (dive && Math.hypot(x - dive.x, y - dive.y) < 56) { diveImpact(x, y); return; }
  let kind = '';
  for (const t of projT.values()) if (!t.done && (t.kind === 'blast_signature' || t.kind === 'blast_bomb' || t.kind === 'fireball') && Math.hypot(t.x - x, t.y - y) < 32) { kind = t.kind; t.done = true; break; }
  if (kind === 'blast_signature') { // "Vụ nổ lớn": anime impact frame -> three-beat mushroom blast -> ring of fire
    impactFrame(0.5);
    S.fx('explosions/big-explosion', { x, y: y + 4, scale: 0.5, to: 5400, fadeOut: 1300, sortY: 6 });
    slam(x, y + 4, 124, 1700);
    S.fx('fire/fire-ring', { x, y: y + 4, layer: 'floor', scale: S.fit('fire/fire-ring', 112), from: 250, to: 1700, fadeOut: 400 });
    S.kick(6, 0.4);
  } else if (kind === 'blast_bomb') { S.fx('explosions/small-explosion', { x, y: y + 3, scale: 0.44, to: 3200, fadeOut: 700 }); slam(x, y + 3, 72, 1300); S.kick(2.5, 0.12); }
  else if (kind === 'fireball') { S.fx('explosions/small-explosion', { x, y: y + 3, scale: 0.34, to: 2800, fadeOut: 700 }); S.fx('impacts/crit-hit', { x, y, lift: 6, anchor: 'focal', layer: 'over', scale: 0.34 }); S.kick(1.6, 0.06); }
  else S.fx('explosions/small-explosion', { x, y: y + 3, scale: e.small ? 0.26 : 0.4, to: 3000, fadeOut: 700 });
}
function depart(e: Any, r: Any) {
  if (e.x === undefined) return;
  S.fx('arcane/blink-out', { x: e.x, y: e.y + 6, layer: 'over', scale: 0.62, from: 250 });
  S.fx('arcane/rune-circle', { x: e.x, y: e.y + 5, layer: 'floor', scale: 0.55, loop: true, life: 750, fadeOut: 450, rate: 2.6 });
  const tr = r?.spiritTransit; if (!tr) return; const ms = BAL.creatorCoreDemon.teleportMs;
  S.fx('arcane/rune-circle', { x: tr.x, y: tr.y + 5, layer: 'floor', scale: 0.55, loop: true, life: ms + 520, fadeIn: 200, fadeOut: 320, rate: 2.6 });
  S.fx('arcane/portal', { x: tr.x, y: tr.y + 6, layer: 'over', scale: 0.5, grow: [0.15, 1, 320], loop: true, life: ms + 240, fadeIn: 120, fadeOut: 220 });
}
function arrive(e: Any) {
  if (e.x === undefined) return;
  S.fx('arcane/blink-in', { x: e.x, y: e.y + 6, layer: 'over', scale: 0.62, from: 320 });
  S.fx('arcane/mana-burst', { x: e.x, y: e.y + 4, layer: 'over', scale: 0.36, from: 220 }); S.kick(1.5, 0.1);
}

// =================================================================================
// PROJECTILES — one live follower each, an honest impact where it actually died
// =================================================================================
function nearBoss(r: Any, x: number, y: number, d: number) { for (const m of r.creatures) if (m.sideBoss && m.state !== 'dead' && Math.hypot(m.x - x, m.y - y) < d) return m; return null; }
function startProj(pr: Any, r: Any): ProjT {
  const t: ProjT = { kind: pr.kind, x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, seen: frame, own: false, insts: [], done: false, gone: false, next: 0 };
  const F = (id: string, o: S.FxOpts) => { const i = S.fx(id, { follow: pr, aim: () => Math.atan2(pr.vy, pr.vx), layer: 'world', sortY: 4, lift: 6, loop: true, ...o }); if (i) t.insts.push(i); t.own = true; };
  if (pr.from === 'player') switch (pr.kind) {
    case 'blast_round': F('projectiles/bullet-tracer', { scale: 0.24, fadeIn: 30 }); break;
    case 'blast_bomb': F('projectiles/rocket', { scale: 0.2 }); break;
    case 'blast_signature': F('fire/fireball', { scale: 0.92, lift: 8 }); break;
    case 'fireball': F('fire/fireball', { scale: 0.6 }); break;
    case 'elsa_shard': F('ice/ice-lance', { scale: 0.3 }); break;
    case 'spirit_ray': F('projectiles/laser-bolt', { scale: 0.5, hueTo: HUE.spirit }); break;
    case 'fire_tornado': { const i = S.fx('fire/fire-tornado', { follow: pr, layer: 'world', sortY: 6, scale: 0.74, grow: [0.3, 1, 380], loop: true, fadeIn: 120 }); if (i) t.insts.push(i); t.own = true; break; }
    case 'nature_rock': // a tumbling shaded boulder (no library clip can follow a live rock)
      t.own = true;
      S.prim('world', 1500, pr.y + 6, (g, age) => { if (t.gone) return; g.translate(Math.round(pr.x), Math.round(pr.y - 6 - Math.sin(Math.min(1, age / 800) * Math.PI) * 4)); g.rotate(age / 75); g.fillStyle = '#3a332b'; g.fillRect(-5, -4, 10, 9); g.fillStyle = '#7d7466'; g.fillRect(-4, -5, 8, 8); g.fillStyle = '#a79d8c'; g.fillRect(-3, -5, 5, 3); g.fillStyle = '#d2c9b7'; g.fillRect(-2, -4, 2, 1); g.fillStyle = '#4f473c'; g.fillRect(0, 1, 3, 2); });
      break;
  } else if (pr.kind === 'shard' || pr.kind === 'bolt') {
    const b = nearBoss(r, pr.x, pr.y + 6, 22);
    if (b?.type === 'boss_ronin') { F('projectiles/energy-disc', { scale: 0.52 }); t.kind = 'ronin_blade'; }
    else if (b?.type === 'boss_custodian') { F('projectiles/laser-bolt', { scale: 0.46, hueTo: HUE.gold }); t.kind = 'ward_shard'; }
    else if (b?.type === 'boss_tidemarshal') { const i = S.fx('water/water-orb', { follow: pr, layer: 'world', sortY: 4, lift: -4, scale: 0.2, loop: true }); if (i) t.insts.push(i); t.own = true; t.kind = 'tide_orb'; }
  }
  return t;
}
function tickProj(t: ProjT) {
  const now = S.clockMs(); if (now < t.next) return;
  if (t.kind === 'nature_rock') { t.next = now + 110; S.fx('spawn/poof', { x: t.x, y: t.y, lift: 3, scale: 0.14, from: 60, alpha: 0.7 }); }
  else if (t.kind === 'fire_tornado') { t.next = now + 380; S.fx('status/burning', { x: t.x + Math.sin(now) * 8, y: t.y + 4, layer: 'floor', scale: 0.3, loop: true, life: 900, fadeIn: 100, fadeOut: 400 }); }
  else if (t.kind === 'blast_signature') { t.next = now + 90; S.fx('spawn/poof', { x: t.x, y: t.y, lift: 8, scale: 0.2, from: 60, alpha: 0.5 }); }
}
function endProj(t: ProjT) {
  t.gone = true; for (const i of t.insts) S.release(i, t.kind === 'fire_tornado' ? 320 : 60);
  if (!t.own) return; const a = Math.atan2(t.vy, t.vx), x = t.x, y = t.y;
  switch (t.kind) {
    case 'blast_round': S.fx('impacts/bullet-impact', { x, y, lift: 6, anchor: 'axis', angle: a, upright: true, layer: 'over', scale: 0.3 }); break;
    case 'fire_tornado': S.fx('spawn/poof', { x, y: y + 4, scale: 0.62, alpha: 0.85 }); S.fx('fire/fire-ring', { x, y: y + 4, layer: 'floor', scale: S.fit('fire/fire-ring', 52), from: 300, to: 1500, fadeOut: 300 }); break;
    case 'spirit_ray': S.fx('arcane/mana-burst', { x, y: y + 2, layer: 'over', scale: 0.2, from: 200 }); break;
    case 'ronin_blade': S.fx('impacts/hit-spark', { x, y, lift: 6, anchor: 'focal', angle: a, layer: 'over', scale: 0.4, hueTo: HUE.steel }); break;
    case 'ward_shard': S.fx('impacts/hit-spark', { x, y, lift: 6, anchor: 'focal', angle: a, layer: 'over', scale: 0.38, hueTo: HUE.gold }); break;
    case 'tide_orb': S.fx('water/splash', { x, y: y + 4, scale: 0.24, from: 120 }); break;
  }
}

// =================================================================================
// HAZARDS — player skills
// =================================================================================
function startHaz(h: Any, r: Any): HazT {
  const t: HazT = { own: false, kind: '', tag: {}, seen: frame, next: 0, n: 0, born: S.clockMs(), dur: Math.max(0, (h.tell || 0) + (h.dur || 0) - (h.t || 0)), cancel: false, a: 0, end: null };
  const left = Math.max(0, (h.tell || 0) - (h.t || 0)); // ms until the hazard actually fires
  if (h.owner === 'player') {
    t.own = true;
    if (h.effect === 'flameLine') { t.kind = 'flame'; flame(h); }
    else if (h.effect === 'meteorBurn') { t.kind = 'meteor'; meteor(h, left, t); }
    else if (h.effect === 'mjolnirStrike') { if ((h.r || 0) > 40) t.kind = 'burst'; else { t.kind = 'strike'; mjStrike(h, left); } }
    else if (h.effect === 'mjolnirPull') { t.kind = 'pull'; mjPull(h, t, r); }
    else if (h.effect === 'natureRoot') { t.kind = 'roots'; roots(h, t); }
    else if (h.effect === 'spiritBeam') { t.kind = 'beam'; beam(h, t); }
    else if (h.style === 'burn' && h.kind === 'pool') { t.kind = 'burn'; burnPool(h, t); }
    else t.own = false;
  } else if (typeof h.owner === 'string') {
    const m = r.creatures.find((c: Any) => c.id === h.owner);
    if (m?.sideBoss) { t.own = true; t.kind = 'boss'; bossHaz(h, m, left); }
  }
  return t;
}
function tickHaz(h: Any, t: HazT, r: Any) {
  const now = S.clockMs(); if (now < t.next) return;
  if (t.kind === 'pull') { // live arcs: the core visibly drags every body inside the field
    t.next = now + 140; const c = { x: h.x, y: h.y - 8 };
    for (const m of r.creatures) if (m.state !== 'dead' && Math.hypot(m.x - h.x, m.y - h.y) < (h.r || 65) + 4) S.arc(c, { x: m.x, y: m.y - 5 }, 120);
  } else if (t.kind === 'roots') { // one pulse per damage tick
    t.next = now + (BAL.creatorCoreEarthmother.rootTickMs || 1000); t.n++; const R = h.r || 55;
    for (let k = 0; k < 3; k++) thorn(h.x, h.y, t.n * 2.4 + k * 2.1, R, k * 70);
    S.ring({ x: h.x, y: h.y }, R * 0.3, R, 420, '#b6f08a', { a: 0.5 });
  } else if (t.kind === 'beam' && t.end) { // one spark per beam tick at the terminus
    t.next = now + (BAL.creatorCoreDemon.beamTickMs || 250);
    S.fx('impacts/hit-spark', { x: t.end.x, y: t.end.y, lift: 6, anchor: 'focal', angle: t.a + Math.PI, layer: 'over', scale: 0.4, hueTo: HUE.spirit });
  }
}
function endHaz(t: HazT) { if (S.clockMs() - t.born < t.dur - 120) t.cancel = true; S.releaseTag(t.tag, t.kind === 'burn' ? 350 : 160); }

/** Dragon basic — ONE sustained breath while flame hazards keep arriving (held attack). */
function flame(h: Any) {
  bAng = h.angle; bLen = Math.max(24, h.len || 60); bUntil = S.clockMs() + 340;
  if (bInst && !bInst.dead) return;
  const reach = (S.def('fire/fire-breath').core[2] - S.def('fire/fire-breath').px) * 0.5;
  bInst = S.fx('fire/fire-breath', { follow: () => player ? { x: player.x + Math.cos(bAng) * 7, y: player.y - 3 + Math.sin(bAng) * 4 } : null, x: h.x, y: h.y, anchor: 'axis', aim: () => bAng, len: () => bLen * 1.12 / reach, upright: true, layer: 'over', scale: 0.5, loop: true, fadeIn: 90 });
}
/** Meteor — reticle closes during the tell, rock lands on the exact fire frame, crater burns. */
function meteor(h: Any, left: number, t: HazT) {
  const x = h.x, y = h.y, R = h.r || 20, n = meteorN++;
  S.fx('arcane/rune-circle', { x, y, layer: 'floor', scale: S.fit('arcane/rune-circle', R * 2.3), loop: true, life: left + 120, fadeIn: 140, fadeOut: 160, hueTo: HUE.fire, rate: 1.8, tag: t.tag });
  S.ring({ x, y }, R * 1.5, R * 0.3, Math.max(120, left), '#ffb060', { a: 0.8 });
  S.strike('fire/meteor', S.def('fire/meteor').flash, left, { x, y, flipX: n % 2 === 1, scale: 0.44, to: 3300, fadeOut: 700, sortY: 2 });
  S.after(left, () => { slam(x, y, R * 3.2); S.ring({ x, y }, 4, R, 240, '#ffe2a8', { a: 0.9 }); S.kick(2.6, 0.1); });
}
function burnPool(h: Any, t: HazT) {
  const now = S.clockMs(), life = Math.max(300, (h.dur || 3000) - (h.t || 0));
  if ((h.r || 8) < 14) { // signature trail: thin the per-12px pools into a readable line of fire
    for (const q of burnPts) if (now - q.at < 2600 && Math.hypot(q.x - h.x, q.y - h.y) < 9) return;
    burnPts.push({ x: h.x, y: h.y, at: now }); if (burnPts.length > 70) burnPts.shift();
    S.fx('status/burning', { x: h.x, y: h.y + 3, scale: 0.34, loop: true, life, fadeIn: 120, fadeOut: 500, rate: 0.85 + (Math.abs(h.x) % 7) / 20, tag: t.tag });
  } else for (let k = 0; k < 4; k++) { const a = k * 1.7 + h.x, d = k ? h.r * 0.55 : 0; S.fx('status/burning', { x: h.x + Math.cos(a) * d, y: h.y + 3 + Math.sin(a) * d * 0.6, scale: k ? 0.36 : 0.5, loop: true, life, delay: k * 90, fadeIn: 150, fadeOut: 600, tag: t.tag }); }
}
/** Mjolnir refined — a storm cell forms over the mark; five bolts, each on its own fire frame. */
function mjStrike(h: Any, left: number) {
  const x = h.x, y = h.y, R = h.r || 26, now = S.clockMs(), e = BAL.creatorCoreMjolnir;
  if (!storms.some(s => now - s.at < 1900 && Math.hypot(s.x - x, s.y - y) < 12)) {
    storms.push({ x, y, at: now }); if (storms.length > 8) storms.shift();
    const span = 250 + e.strikeCount * e.strikeIntervalMs + 250;
    S.fx('lightning/storm-cloud', { x, y: y + 2, layer: 'over', scale: 0.5, grow: [0.7, 1, 400], loop: true, life: span, fadeIn: 220, fadeOut: 350 });
    S.fx('arcane/rune-circle', { x, y, layer: 'floor', scale: S.fit('arcane/rune-circle', R * 2.3), loop: true, life: span - 150, fadeIn: 150, fadeOut: 250, hueTo: HUE.storm, rate: 2 });
    S.ring({ x, y }, R, R, span - 150, '#cfe6ff', { dash: [3, 4], a: 0.55, pulse: true });
  }
  const j = strikeN++ * 2.4;
  S.strike('lightning/lightning-strike', S.def('lightning/lightning-strike').flash, left, { x: x + Math.cos(j) * R * 0.38, y: y + Math.sin(j) * R * 0.24, scale: 0.4, from: 560, to: 1900, fadeOut: 300, flipX: strikeN % 2 === 0 });
  S.after(left, () => S.kick(2.2, 0.16));
}
/** Mjolnir signature — a growing plasma core drags everything in, then detonates. */
function mjPull(h: Any, t: HazT, r: Any) {
  const x = h.x, y = h.y, R = h.r || 65, dur = Math.max(200, (h.dur || 2000) - (h.t || 0)), im = S.fit('explosions/implosion', R * 2.1), beat = S.def('explosions/implosion').flash;
  S.fx('arcane/rune-circle', { x, y, layer: 'floor', scale: S.fit('arcane/rune-circle', R * 2), loop: true, life: dur, fadeIn: 200, fadeOut: 200, hueTo: HUE.storm, rate: 2.6, alpha: 0.85, tag: t.tag });
  S.ring({ x, y }, R, R, dur, '#bfe2ff', { dash: [3, 4], a: 0.6, pulse: true, tag: t.tag });
  S.fx('lightning/ball-lightning', { x, y: y + 2, lift: 4, sortY: 6, scale: 0.55, grow: [0.45, 1.1, dur], loop: true, life: dur + 60, fadeIn: 150, fadeOut: 80, tag: t.tag });
  S.strike('explosions/implosion', beat, dur * 0.5, { x, y, lift: 8, layer: 'over', scale: im, alpha: 0.8, to: beat + 70, fadeOut: 70, tag: t.tag });
  S.strike('explosions/implosion', beat, dur, { x, y, lift: 8, layer: 'over', scale: im, alpha: 0.9, to: beat + 60, fadeOut: 60, tag: t.tag });
  S.after(dur, () => {
    if (t.cancel) return;
    impactFrame(0.4);
    S.fx('lightning/thunderclap', { x, y: y + 2, scale: S.fit('lightning/thunderclap', R * 2.3), from: 100 });
    S.fx('explosions/plasma-explosion', { x, y, lift: 8, layer: 'over', scale: 0.55 });
    slam(x, y, R * 2.2);
    for (const m of r.creatures) if (m.state !== 'dead' && Math.hypot(m.x - x, m.y - y) < R + 6) S.fx('lightning/electrified', { follow: m, x: m.x, y: m.y, dy: 5, layer: 'over', scale: 0.42, loop: true, life: 650, fadeOut: 200 });
    S.kick(5, 0.35);
  });
}
function thorn(x: number, y: number, a: number, R: number, delay: number) { S.fx('nature/thorns', { x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 4, ...upr(a), scale: S.fit('nature/thorns', R * 0.9), delay, to: 2200, fadeOut: 350, sortY: Math.sin(a) * 8 }); }
/** Earthmother signature — the ground wakes: green wave, thorn seams outward, living field. */
function roots(h: Any, t: HazT) {
  const x = h.x, y = h.y, R = h.r || 55, dur = Math.max(500, (h.dur || 10000) - (h.t || 0));
  S.fx('holy/heal-aoe', { x, y, layer: 'floor', scale: S.fit('holy/heal-aoe', R * 2.1), from: 150, to: 2600, fadeOut: 500 });
  S.ring({ x, y }, 6, R, 500, '#b6f08a', { a: 0.85 });
  S.ring({ x, y }, R, R, dur, '#9bd06a', { dash: [2, 5], a: 0.45, pulse: true, tag: t.tag });
  S.fx('nature/leaf-storm', { x, y: y + 2, layer: 'over', scale: 0.62, loop: true, life: dur, fadeIn: 400, fadeOut: 600, alpha: 0.75, tag: t.tag });
  for (let k = 0; k < 8; k++) thorn(x, y, k * TAU / 8 + 0.3, R, 40 + k * 45);
  for (const [ox, oy, d] of [[0, -0.62, 120], [0, 0.62, 200], [-0.3, -0.42, 280], [0.3, 0.42, 360]]) S.fx('nature/root-snare', { x: x + ox * R, y: y + oy * R, scale: 0.42, delay: d, sortY: 2 });
  t.next = S.clockMs() + (BAL.creatorCoreEarthmother.rootTickMs || 1000);
}
/** Demon refined — a held beam from the hand, sized to the real blocked length. */
function beam(h: Any, t: HazT) {
  const a = h.angle, dur = Math.max(200, (h.dur || 2000) - (h.t || 0)), s = 0.5, L = S.def('arcane/arcane-beam');
  S.fx('arcane/arcane-beam', { x: h.x + Math.cos(a) * 6, y: h.y - 6 + Math.sin(a) * 3, anchor: 'axis', angle: a, upright: true, sx: Math.max(0.2, ((h.len || 60) - 4) / ((L.core[2] - L.px) * s)), layer: 'over', scale: s, loop: true, life: dur, fadeIn: 90, fadeOut: 160, tag: t.tag });
  S.fx('arcane/rune-circle', { x: h.x, y: h.y + 5, layer: 'floor', scale: 0.5, loop: true, life: dur, fadeIn: 120, fadeOut: 250, rate: 1.8, tag: t.tag });
  S.fx('arcane/spell-charge', { x: h.x, y: h.y + 6, layer: 'over', scale: 0.5, loop: true, life: dur, fadeIn: 80, fadeOut: 150, flipX: Math.cos(a) < 0, rate: 1.5, tag: t.tag });
  t.a = a; t.end = { x: h.x + Math.cos(a) * (h.len || 60), y: h.y + Math.sin(a) * (h.len || 60) };
}

// =================================================================================
// SIDE BOSSES — hazards (the game's own ground telegraph stays during the tell)
// =================================================================================
function bossHaz(h: Any, m: Any, left: number) {
  const x = h.x, y = h.y, R = h.r || 0, dur = h.dur || 300;
  if (h.kind === 'sweep') { // Oathless Ronin · nodachi sweep: glint -> ember crescent on the fire frame -> blue after-cut
    const a = (h.a0 + h.a1) / 2, L = S.def('melee/heavy-cleave'), s = ((h.len || 56) + 6) / (L.core[2] - L.px);
    S.strike('melee/heavy-cleave', L.flash, left, { follow: m, x, y, dy: -2, anchor: 'axis', angle: a, upright: true, layer: 'over', scale: s });
    const sp = S.def('melee/spin-slash'); S.strike('melee/spin-slash', sp.flash, left + 40, { follow: m, x, y, dy: 3, layer: 'over', scale: ((h.len || 56) * 2) / (sp.core[2] - sp.core[0]), flipX: Math.cos(a) < 0, alpha: 0.95 });
    S.after(left, () => S.kick(1.5));
  } else if (h.kind === 'line' && h.style === 'quake') { // Greyback · fault line: rift tears along the real line, spikes march down it
    const a = h.angle, L = h.len || 124;
    S.strike('nature/quake', S.def('nature/quake').flash, left, { x: x + Math.cos(a) * L / 2, y: y + Math.sin(a) * L / 2, angle: a, upright: true, layer: 'floor', scale: (L * 1.05) / W('nature/quake'), to: 2300, fadeOut: 500 });
    for (let k = 0; k < 3; k++) { const d = L * (0.28 + k * 0.3); S.strike('nature/earth-spike', S.def('nature/earth-spike').flash, left + k * 70, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scale: 0.22, to: 2300, fadeOut: 400 }); }
    S.after(left, () => S.kick(3, 0.05));
  } else if (h.kind === 'ring' && h.style === 'quake') { // Greyback P2 · tectonic shockwave: slam, then spikes ride the expanding front
    S.after(left, () => { slam(x, y + 4, R * 2.2, 1800); S.fx('explosions/dirt-explosion', { x, y: y + 4, scale: 0.4, to: 2600, fadeOut: 500 }); S.ring({ x, y }, 8, R, dur, '#e8c890', { a: 0.95, w: 2 }); S.kick(4, 0.1); });
    for (let k = 0; k < 14; k++) { const inner = k < 5, a = inner ? k * TAU / 5 : (k - 5) * TAU / 9 + 0.3, d = inner ? R * 0.45 : R * 0.9; S.strike('nature/earth-spike', S.def('nature/earth-spike').flash, left + (inner ? 0.42 : 0.88) * dur, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scale: 0.2, to: 2000, fadeOut: 400 }); }
  } else if (h.kind === 'circle' && h.style === 'erupt') { // Greyback P2 · eruption
    S.strike('nature/earth-spike', S.def('nature/earth-spike').flash, left, { x, y, scale: 0.26, to: 2100, fadeOut: 400 });
    S.after(left, () => { S.fx('explosions/dirt-explosion', { x, y: y + 3, scale: 0.2, to: 2000, fadeOut: 400 }); S.kick(1.5); });
  } else if (h.kind === 'ring' && h.style === 'beam') { // Pale Custodian · ward lantern: gold sigil charges, light bursts along the ring
    S.fx('arcane/rune-circle', { x, y: y + 3, layer: 'floor', scale: S.fit('arcane/rune-circle', R * 1.9), loop: true, life: left + dur, fadeIn: 350, fadeOut: 300, hueTo: HUE.gold, rate: 1.5, alpha: 0.9 });
    S.strike('arcane/mana-burst', S.def('arcane/mana-burst').flash, left, { x, y: y + 2, layer: 'over', scale: S.fit('arcane/mana-burst', R * 1.5), hueTo: HUE.gold });
    S.after(left, () => { S.ring({ x, y }, 6, R, dur, '#ffe9a8', { a: 0.95, w: 2 }); S.kick(2.5, 0.12); });
  } else if (h.style === 'tide' && h.kind === 'wave') { // Tidemarshal · tide wall: a marching rank of splashes on the real wave front
    const a = h.angle, nx = -Math.sin(a), ny = Math.cos(a), steps = Math.ceil(dur / 140), beat = S.def('water/splash').flash;
    S.fx('water/ripples', { x, y: y + 4, layer: 'floor', scale: 0.5, loop: true, life: left + 250, fadeIn: 200, fadeOut: 200 });
    for (let k = 0; k <= steps; k++) for (let j = -1; j <= 1; j++) { const d = 130 * k * 0.14, w = j * (h.len || 58) * 0.36; S.strike('water/splash', beat, left + k * 140 + (j ? 30 : 0), { x: x + Math.cos(a) * d + nx * w, y: y + Math.sin(a) * d + ny * w + 3, scale: 0.3, to: 1500, fadeOut: 300 }); }
  } else if (h.style === 'tide' && h.kind === 'circle') { // Tidemarshal · whirlpool: fades in with the tell, bites on the fire frame
    S.fx('water/whirlpool', { x, y, layer: 'floor', scale: S.fit('water/whirlpool', R * 2.4), grow: [0.5, 1, Math.max(1, left)], loop: true, life: left + dur, fadeIn: Math.max(1, left * 0.8), fadeOut: 350 });
    S.strike('water/splash', S.def('water/splash').flash, left, { x, y: y + 3, scale: 0.36 });
  } else if (h.style === 'tide' && h.kind === 'ring') { // Tidemarshal P2 · maelstrom surge: vortex -> geyser on the fire frame -> splash rings on the front
    S.fx('water/whirlpool', { x, y, layer: 'floor', scale: S.fit('water/whirlpool', R * 1.9), grow: [0.4, 1, Math.max(1, left)], loop: true, life: left + dur + 200, fadeIn: 450, fadeOut: 400, rate: 1.6 });
    S.strike('water/geyser', S.def('water/geyser').flash, left, { x, y: y + 3, scale: 0.55, to: 3600, fadeOut: 600 });
    S.after(left, () => { S.ring({ x, y }, 8, R, dur, '#bfeaff', { a: 0.95, w: 2 }); S.kick(3, 0.08); });
    for (let k = 0; k < 18; k++) { const inner = k < 7, a2 = inner ? k * TAU / 7 : (k - 7) * TAU / 11 + 0.2, d = inner ? R * 0.5 : R * 0.92; S.strike('water/splash', S.def('water/splash').flash, left + (inner ? 0.45 : 0.9) * dur, { x: x + Math.cos(a2) * d, y: y + Math.sin(a2) * d + 3, scale: 0.3, to: 1500, fadeOut: 300 }); }
  }
}

// ---- side bosses: state machine (moves with no hazard, phases, stagger, death) ------
function boss(m: Any, t: MobT, r: Any) {
  const mv = m.atk?.move ?? 0, st = m.state as string, ty = m.type as string, a = m.angle || 0, now = S.clockMs();
  const B = (id: string, o: S.FxOpts) => S.fx(id, { follow: m, x: m.x, y: m.y, layer: 'over', ...o });
  if ((m.sideBoss.phase || 0) > t.phase) { // phase 2 — each boss "breaks" in its own material
    t.phase = m.sideBoss.phase; B('status/rage', { dy: 6, scale: 0.7, loop: true, life: 1900, fadeOut: 300 }); S.kick(3, 0.15);
    if (ty === 'boss_greyback') { slam(m.x, m.y + 4, 110); S.fx('explosions/dirt-explosion', { x: m.x, y: m.y + 4, scale: 0.45, to: 2600, fadeOut: 500 }); }
    else if (ty === 'boss_ronin') B('melee/spin-slash', { dy: 2, scale: 0.7 });
    else if (ty === 'boss_tidemarshal') S.fx('water/geyser', { x: m.x, y: m.y + 4, scale: 0.5, from: 950, to: 3600, fadeOut: 600 });
    else { B('arcane/mana-burst', { dy: 2, scale: 0.6, hueTo: HUE.gold, from: 150 }); S.fx('arcane/rune-circle', { x: m.x, y: m.y + 4, layer: 'floor', scale: 0.9, loop: true, life: 1500, fadeIn: 150, fadeOut: 400, hueTo: HUE.gold }); }
  }
  if (st !== t.state) {
    if (st === 'tell') { // the wind-up reads the boss's element before anything lands
      t.tx = m.x; t.ty = m.y;
      if (ty === 'boss_ronin') S.fx('impacts/hit-spark', { x: m.x + Math.cos(a) * 8, y: m.y, lift: 10, anchor: 'focal', layer: 'over', scale: 0.42, hueTo: HUE.steel });
      else if (ty === 'boss_greyback') { S.fx('spawn/poof', { x: m.x, y: m.y + 6, scale: 0.5, alpha: 0.8 }); if (mv === 0) { S.ring(m, 38, 38, 700, '#ffb37a', { dash: [3, 3], a: 0.7, pulse: true }); S.ring(m, 4, 38, 700, '#ffd9a8', { a: 0.6 }); } }
      else if (ty === 'boss_tidemarshal') S.fx('water/ripples', { follow: m, x: m.x, y: m.y, dy: 6, layer: 'floor', scale: 0.55, loop: true, life: 650, fadeIn: 150, fadeOut: 200 });
      else B('arcane/spell-charge', { dy: 6, scale: 0.55, loop: true, life: 620, fadeIn: 80, fadeOut: 120, hueTo: HUE.gold, flipX: Math.cos(a) < 0, rate: 1.5 });
    } else if (st === 'attack') {
      t.dash = (ty === 'boss_ronin' && mv === 0) || (ty === 'boss_custodian' && mv === 0) || (ty === 'boss_tidemarshal' && mv === 2); t.dashNext = 0;
      if (ty === 'boss_ronin' && mv === 0) B('melee/thrust', { dy: -2, anchor: 'axis', angle: a, upright: true, scale: 0.56 });
      else if (ty === 'boss_ronin' && mv === 2) B('melee/double-slash', { dy: -2, anchor: 'axis', angle: a, upright: true, scale: 0.6 });
      else if (ty === 'boss_custodian' && mv === 0) B('melee/thrust', { dy: -2, anchor: 'axis', angle: a, upright: true, scale: 0.5, hueTo: HUE.gold });
      else if (ty === 'boss_custodian' && mv === 1) B('arcane/mana-burst', { dy: 0, scale: 0.26, from: 200, hueTo: HUE.gold });
      else if (ty === 'boss_custodian' && mv === 2 && Math.hypot(m.x - t.tx, m.y - t.ty) > 10) { S.fx('arcane/blink-out', { x: t.tx, y: t.ty + 6, layer: 'over', scale: 0.6, from: 250, hueTo: HUE.gold }); S.fx('arcane/blink-in', { x: m.x, y: m.y + 6, layer: 'over', scale: 0.6, from: 320, hueTo: HUE.gold }); }
      else if (ty === 'boss_tidemarshal') S.fx('water/splash', { x: m.x + Math.cos(a) * 8, y: m.y + 5 + Math.sin(a) * 6, scale: 0.3, from: 120 });
      else if (ty === 'boss_greyback' && mv !== 0) S.fx('spawn/poof', { x: m.x, y: m.y + 6, scale: 0.55, alpha: 0.85 });
    } else if (st === 'recover' && t.state === 'attack') {
      if (ty === 'boss_ronin' && mv === 0) B('melee/sword-slash', { dy: -2, anchor: 'axis', angle: a, upright: true, scale: 0.62 });
      else if (ty === 'boss_custodian' && mv === 0) B('melee/dagger-flurry', { dy: -2, anchor: 'axis', angle: a, upright: true, scale: 0.5, from: 250 });
    }
    if (st !== 'attack') { t.dash = false; t.slam = false; }
    t.state = st;
  }
  if (st === 'attack' && ty === 'boss_greyback' && mv === 0 && !t.slam && m.atk?.hit) { // Greyback slam: lands on the real hit frame
    t.slam = true; slam(m.x, m.y + 5, 38 * 2.4); S.fx('explosions/dirt-explosion', { x: m.x + Math.cos(a) * 10, y: m.y + 5 + Math.sin(a) * 8, scale: 0.32, to: 2400, fadeOut: 500 }); S.ring({ x: m.x, y: m.y }, 6, 38, 260, '#ffe2b8', { a: 0.95, w: 2 }); S.kick(3.5, 0.08);
  }
  if (st === 'attack' && t.dash && now >= t.dashNext) { t.dashNext = now + 70; if (ty === 'boss_tidemarshal') S.fx('water/splash', { x: m.x, y: m.y + 5, scale: 0.22, from: 150, to: 1200, fadeOut: 300 }); else S.fx('spawn/poof', { x: m.x, y: m.y + 6, scale: 0.26, from: 60, alpha: 0.6 }); }
  const vuln = (m.atk?.vuln || 0) > 0 && st !== 'dead';
  if (vuln && !t.vuln) t.vuln = B('status/stunned', { dy: 8, scale: 0.7, loop: true, fadeIn: 100 });
  else if (!vuln && t.vuln) { S.release(t.vuln, 160); t.vuln = null; }
}
function bossDeath(ty: string, x: number, y: number) {
  if (!ty.startsWith('boss_') || x === undefined) return;
  S.fx('spawn/poof', { x, y: y + 6, scale: 0.8 }); S.kick(4, 0.2);
  if (ty === 'boss_greyback') { slam(x, y + 4, 130, 1900); S.fx('explosions/dirt-explosion', { x, y: y + 4, scale: 0.55, to: 3000, fadeOut: 600 }); }
  else if (ty === 'boss_ronin') { S.fx('melee/double-slash', { x, y: y - 2, anchor: 'axis', layer: 'over', scale: 0.7 }); S.fx('impacts/crit-hit', { x, y, lift: 8, anchor: 'focal', layer: 'over', scale: 0.5 }); }
  else if (ty === 'boss_tidemarshal') { S.fx('water/geyser', { x, y: y + 4, scale: 0.55, from: 1000, to: 3800, fadeOut: 700 }); for (let k = 0; k < 8; k++) S.fx('water/splash', { x: x + Math.cos(k * TAU / 8) * 30, y: y + 4 + Math.sin(k * TAU / 8) * 20, scale: 0.3, delay: 150 + k * 30 }); }
  else if (ty === 'boss_custodian') { S.fx('arcane/blink-out', { x, y: y + 6, layer: 'over', scale: 0.7, hueTo: HUE.gold }); S.fx('arcane/mana-burst', { x, y: y + 2, layer: 'over', scale: 0.6, hueTo: HUE.gold, delay: 250 }); }
}

// =================================================================================
// PER-FRAME SYNC
// =================================================================================
function syncMobs(r: Any, now: number) {
  for (const m of r.creatures) {
    let t = mobT.get(m.id);
    if (m.state === 'dead') { if (t) { if (m.sideBoss) bossDeath(m.type, m.x, m.y); if (t.vuln) S.release(t.vuln, 120); mobT.delete(m.id); } continue; }
    const frozen = (m.frozenUntil || 0) > now, rooted = (m.rootedUntil || 0) > now;
    if (!t) { if (!m.sideBoss && !frozen && !rooted) continue; t = { state: m.state, phase: m.sideBoss?.phase ?? 0, frozen: false, rooted: false, rootAt: 0, vuln: null, tag: {}, tx: m.x, ty: m.y, slam: false, dash: false, dashNext: 0 }; mobT.set(m.id, t); }
    if (frozen && !t.frozen) { S.fx('ice/snowflake-burst', { x: m.x, y: m.y + 5, scale: 0.3, from: 100, layer: 'over' }); S.ring({ x: m.x, y: m.y + 2 }, 3, 14, 300, '#d8f4ff', { a: 0.8 }); }
    if (!frozen && t.frozen) S.fx('ice/ice-shatter', { x: m.x, y: m.y + 6, scale: 0.22, from: 600, layer: 'over' });
    t.frozen = frozen;
    if (rooted && (!t.rooted || S.clockMs() - t.rootAt > 2500)) { t.rootAt = S.clockMs(); S.fx('nature/root-snare', { follow: m, x: m.x, y: m.y, dy: 6, scale: 0.36, sortY: 2 }); }
    t.rooted = rooted;
    if (m.sideBoss) boss(m, t, r); else if (!frozen && !rooted) mobT.delete(m.id);
  }
}
function diveImpact(x: number, y: number) { // Dragon signature finale
  impactFrame(0.5);
  S.fx('fire/flame-pillar', { x, y: y + 4, scale: 0.5, from: 500, to: 3200, fadeOut: 700, sortY: 4 });
  S.fx('fire/fire-ring', { x, y: y + 4, layer: 'floor', scale: S.fit('fire/fire-ring', 124), from: 260, to: 1900, fadeOut: 400 });
  slam(x, y + 4, 112, 1700); S.kick(6, 0.4);
}
function syncPlayer(r: Any, now: number) {
  const p = r.player; player = p;
  // Elsa refined — one second inside the ice: block forms, aura nova, block bursts on thaw
  const ice = (p.iceUntil || 0) > now, aura = BAL.creatorCoreElsa.auraRadius;
  if (ice && !iceOn) { iceTag = {}; S.fx('ice/freeze', { follow: p, x: p.x, y: p.y, dy: 6, layer: 'over', scale: 0.5, to: 2300, tag: iceTag }); S.fx('ice/frost-nova', { x: p.x, y: p.y + 5, layer: 'floor', scale: S.fit('ice/frost-nova', aura * 2.6), from: 250, fadeOut: 500 }); S.ring(p, 4, aura, 420, '#d8f4ff', { a: 0.9 }); S.kick(1.5, 0.1); }
  if (!ice && iceOn) { S.releaseTag(iceTag, 40); S.fx('ice/freeze', { x: p.x, y: p.y + 6, layer: 'over', scale: 0.5, from: 2430 }); S.kick(1.5, 0.08); }
  iceOn = ice;
  // Earthmother refined — every real tree blooms in, and leaves burst when it is harvested
  const live = r.natureTrees || []; let k = 0;
  for (const q of live) if (!trees.has(q)) { const x = q.tx * 16 + 8, y = q.ty * 16 + 14; trees.set(q, { x, y }); S.fx('nature/healing-bloom', { x, y, scale: 0.42, from: 450, delay: k * 45, sortY: 3 }); S.fx('spawn/poof', { x, y, scale: 0.36, delay: k * 45, alpha: 0.8, sortY: 4 }); k++; }
  if (trees.size) for (const [q, pos] of trees) if (!live.includes(q)) { trees.delete(q); S.fx('nature/leaf-storm', { x: pos.x, y: pos.y, layer: 'over', scale: 0.5, loop: true, life: 750, fadeOut: 350 }); S.fx('spawn/poof', { x: pos.x, y: pos.y, scale: 0.42, alpha: 0.8 }); }
  // Dragon signature — fire-serpent streaks target to target, vortex gathers them, comet dive
  const d = r.dragonDive;
  if (d && !dive) { const pos = { x: d.dragonX ?? p.x, y: d.dragonY ?? p.y }; const st = { tag: {}, phase: '', index: -1, x: d.x, y: d.y, ang: p.aim || 0, pos, inst: null as Inst | null }; dive = st; st.inst = S.fx('fire/fireball', { follow: pos, aim: () => st.ang, lift: 12, layer: 'over', scale: 1.15, loop: true, fadeIn: 120, tag: st.tag }); }
  if (d && dive) {
    dive.x = d.x; dive.y = d.y;
    if (d.dragonX !== undefined) { const dx = d.dragonX - dive.pos.x, dy = d.dragonY - dive.pos.y; if (Math.hypot(dx, dy) > 0.5) dive.ang = Math.atan2(dy, dx); dive.pos.x = d.dragonX; dive.pos.y = d.dragonY; }
    if (d.index !== undefined && d.index !== dive.index) { const q = dive.index >= 0 ? d.route?.[dive.index] : null; if (q) { S.fx('impacts/crit-hit', { x: q.x, y: q.y, lift: 6, anchor: 'focal', layer: 'over', scale: 0.42 }); S.fx('status/burning', { x: q.x, y: q.y + 4, layer: 'over', scale: 0.42, loop: true, life: 1300, fadeOut: 400 }); S.kick(1.5); } dive.index = d.index; }
    if (d.phase !== dive.phase) {
      const left = Math.max(60, d.left || 0), b = BAL.creatorCoreDragon;
      if (d.phase === 'gather') { S.release(dive.inst, 250); S.fx('arcane/rune-circle', { x: d.x, y: d.y + 3, layer: 'floor', scale: 0.8, loop: true, life: left + b.diveMs + 100, fadeIn: 200, fadeOut: 200, hueTo: HUE.fire, rate: 2.2, tag: dive.tag }); S.fx('fire/fire-tornado', { x: d.x, y: d.y + 4, scale: 0.5, grow: [0.4, 1.15, left], loop: true, life: left + b.diveMs, fadeIn: 200, fadeOut: 120, alpha: 0.9, tag: dive.tag }); S.ring({ x: d.x, y: d.y }, 80, 10, left, '#ffb060', { a: 0.6 }); }
      if (d.phase === 'dive') { S.strike('fire/meteor', S.def('fire/meteor').flash, left, { x: d.x, y: d.y + 3, layer: 'over', scale: 0.62, to: 2600, fadeOut: 600, flipX: p.x > d.x }); S.tint('#ff5a10', 0.14, left, 80, 500); }
      dive.phase = d.phase;
    }
  }
  if (!d && dive) { S.releaseTag(dive.tag, 200); dive = null; }
  transit = !!r.spiritTransit;
}
let lastFloor = 0;
export function sync(gs: Any, now: number, HAZ: Any[], PROJ: Any[]) {
  const r = gs?.run; if (!r) return;
  const fl = r.veyraFloor ?? 0;
  if (r !== lastRun || fl !== lastFloor) { reset(); lastRun = r; lastFloor = fl; }
  frame++;
  try {
    syncPlayer(r, now);
    for (const pr of PROJ) { if (pr.delay && pr.delay > 0) continue; let t = projT.get(pr); if (!t) { t = startProj(pr, r); projT.set(pr, t); } t.x = pr.x; t.y = pr.y; t.vx = pr.vx; t.vy = pr.vy; t.seen = frame; if (t.own) tickProj(t); }
    for (const [pr, t] of projT) if (t.seen !== frame) { endProj(t); projT.delete(pr); }
    for (const h of HAZ) { let t = hazT.get(h); if (!t) { t = startHaz(h, r); hazT.set(h, t); } t.seen = frame; if (t.own) tickHaz(h, t, r); }
    for (const [h, t] of hazT) if (t.seen !== frame) { endHaz(t); hazT.delete(h); }
    if (bInst && S.clockMs() > bUntil) { S.release(bInst, 170); bInst = null; }
    syncMobs(r, now);
  } catch (err) { if (!(sync as Any).warned) { (sync as Any).warned = true; console.warn('[vfx] director sync error', err); } }
  void transit;
}

// ---- VFX test kit helpers (used only by the test build's hotkeys) ---------------------
export function sideBosses(gs: Any): Any[] { return (gs?.run?.creatures || []).filter((m: Any) => m.sideBoss && m.state !== 'dead'); }
