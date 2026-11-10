// World-agnostic combat core. NEVER references tiles/textures: only positions, bounds, an optional adapter.
import { mulberry } from '../art/raster';
import type { BossId, Form } from '../art/clips';
import type { Dir } from '../art/kit';
import type { Raster } from '../art/raster';
import type { El } from '../art/vfx';

export interface V { x: number; y: number }
export const v = (x: number, y: number): V => ({ x, y });
export const add = (a: V, b: V) => v(a.x + b.x, a.y + b.y), sub = (a: V, b: V) => v(a.x - b.x, a.y - b.y), mul = (a: V, s: number) => v(a.x * s, a.y * s);
export const len = (a: V) => Math.hypot(a.x, a.y), dist = (a: V, b: V) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: V) => { const l = len(a) || 1; return v(a.x / l, a.y / l); };
export const ang = (a: V) => Math.atan2(a.y, a.x), fromAng = (a: number, l = 1) => v(Math.cos(a) * l, Math.sin(a) * l);
export const rot = (a: V, r: number) => v(a.x * Math.cos(r) - a.y * Math.sin(r), a.x * Math.sin(r) + a.y * Math.cos(r));
export const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
export function dir4(f: V): Dir { return Math.abs(f.x) > Math.abs(f.y) * 1.05 ? (f.x > 0 ? 'right' : 'left') : (f.y > 0 ? 'down' : 'up'); }

// ---------------- shapes / hit tests ----------------
export type Shape =
  | { k: 'circle'; x: number; y: number; r: number }
  | { k: 'sector'; x: number; y: number; r: number; r0?: number; a: number; span: number }
  | { k: 'capsule'; x1: number; y1: number; x2: number; y2: number; r: number }
  | { k: 'ring'; x: number; y: number; r0: number; r1: number };
export function segDist(p: V, a: V, b: V) {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)));
  return dist(p, v(a.x + ab.x * t, a.y + ab.y * t));
}
export function hitTest(s: Shape, p: V, rad: number): boolean {
  switch (s.k) {
    case 'circle': return dist(p, s) <= s.r + rad;
    case 'ring': { const d = dist(p, s); return d >= s.r0 - rad && d <= s.r1 + rad; }
    case 'capsule': return segDist(p, v(s.x1, s.y1), v(s.x2, s.y2)) <= s.r + rad;
    case 'sector': {
      const d = dist(p, s); if (d > s.r + rad || d < (s.r0 || 0) - rad) return false;
      if (d < rad) return true;
      const da = Math.abs(angDiff(s.a, Math.atan2(p.y - s.y, p.x - s.x)));
      return da <= s.span / 2 + Math.asin(Math.min(1, rad / Math.max(d, 1)));
    }
  }
}

// ---------------- map adapter (the ONLY world interface) ----------------
export interface Rect { x: number; y: number; w: number; h: number }
export interface MapAdapter {
  bounds: Rect; obstacles: Rect[];
  queryValidPosition(p: V, r: number): V | null;
  raycast(a: V, b: V): { hit: boolean; p: V };
  onAreaDamage?(s: Shape, dmg: number): void; // optional host hook (structures/props), never required
}
export function makeAdapter(bounds: Rect, obstacles: Rect[] = []): MapAdapter {
  const blocked = (p: V, r: number) => p.x < bounds.x + r || p.y < bounds.y + r || p.x > bounds.x + bounds.w - r || p.y > bounds.y + bounds.h - r ||
    obstacles.some((o) => p.x > o.x - r && p.x < o.x + o.w + r && p.y > o.y - r && p.y < o.y + o.h + r);
  return {
    bounds, obstacles,
    queryValidPosition(p, r) {
      if (!blocked(p, r)) return p;
      for (let ring = 1; ring <= 6; ring++) for (let i = 0; i < 12; i++) { const c = add(p, fromAng((i / 12) * Math.PI * 2, ring * r)); if (!blocked(c, r)) return c; }
      return null;
    },
    raycast(a, b) {
      const n = Math.ceil(dist(a, b) / 4) || 1;
      for (let i = 1; i <= n; i++) { const p = v(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n); if (blocked(p, 1)) return { hit: true, p }; }
      return { hit: false, p: b };
    },
  };
}

// ---------------- actors ----------------
export type Team = 'player' | 'boss';
export interface Actor {
  id: number; kind: 'player' | 'boss' | 'summon' | 'dummy'; team: Team; name: string;
  pos: V; vel: V; kb: V; r: number; hp: number; maxHp: number; alive: boolean; facing: V; speed: number;
  slowMul: number; slowUntil: number; stunUntil: number; ccImmuneUntil: number; iframesUntil: number; hitstopUntil: number;
  grabbedBy: number | null; grabUntil: number; pulls: { src: V; force: number; until: number; max: number }[];
  invincible?: boolean; ccImmune?: boolean; anim: string; animT: number; lastHurt: number;
  bot?: Bot; boss?: BossBrain; summon?: SummonBrain; dodgeCd?: number; atkCd?: number; poise?: number;
  history: { t: number; p: V; v: V }[]; dodgeDirs: V[];
}
export interface Bot { mode: 'stationary' | 'circle' | 'erratic' | 'backpedal' | 'autododge' | 'keyboard'; input?: { x: number; y: number; dodge: boolean; atk: boolean; shoot: boolean; aim: V } ; t: number; seed: number }
export interface SummonBrain { owner: number; until: number; atkCd: number; dmg: number; el: El; variant: number }

// ---------------- attack instances & events ----------------
export interface HitOpts { dmg: number; kb?: number; kbFrom?: V; kbDir?: V; slow?: [number, number]; stun?: number; grab?: boolean; maxHits?: number; rehit?: number; el?: El; stop?: number; poise?: number }
export interface AttackInst { id: number; skill: string; owner: number; hits: Map<number, { n: number; t: number }>; t0: number; landed: number }
export interface CombatEvent { t: number; type: string; skill?: string; att?: number; src?: number; tgt?: number; dmg?: number; note?: string }

// ---------------- world entities (hazards, projectiles, portals, eyes, echoes, decals) ----------------
export interface Cmd { k: 'spr' | 'ghost' | 'beam' | 'chain' | 'zone' | 'tail' | 'ribbon'; key?: string; make?: () => Raster; x: number; y: number; z?: number; layer: 0 | 1 | 2 | 3 | 4; alpha?: number; pts?: V[]; w?: number; el?: El; shape?: Shape; prog?: number; x2?: number; y2?: number }
export interface Ent {
  id: number; kind: string; owner: number; att?: AttackInst; pos: V; t: number; life: number; dead: boolean;
  lethal: boolean; major?: boolean; policy: 'owned' | 'detach'; data: Record<string, unknown>;
  update(w: World, dt: number): void; render(w: World): Cmd[];
  danger?(p: V, horizon: number): boolean; // fairness/heatmap query: will this hurt p within horizon seconds?
}

export interface SkillCtxLike { phase(tag: string): void }
export type SkillGen = Generator<number, void, unknown>;
export interface SkillDef {
  id: string; name: string; boss: BossId; form: Form; signature: boolean; cd: number; range: [number, number];
  score(ai: AIView): { s: number; why: string[] }; run(c: SkillCtx): SkillGen;
  doc: { open: string; active: string; vfx: string; end: string; combo: string; counter: string; target: string; hitbox: string; el: El; lethalCap?: string };
}
export interface AIView { w: World; b: Actor; tgt: Actor; d: number; mem: Record<string, any>; hpFrac: number; last: string[]; lastResult: Record<string, string>; tgtVel: V; dodges: V[]; circling: number; ranged: boolean }

export interface BossBrain {
  bossId: BossId; form: Form; skills: SkillDef[]; cds: Record<string, number>; mem: Record<string, any>;
  state: string; intent: string; target: number | null; runner: Runner | null; recoverUntil: number; nextDecide: number;
  recent: string[]; lastResult: Record<string, string>; decisions: Decision[]; phase2: boolean; forced: string | null; autonomous: boolean;
  spawnUntil: number; deadAt: number; staggerUntil: number; poise: number;
}
export interface Decision { t: number; chosen: string; intent: string; scores: { id: string; s: number; why: string[]; ready: boolean }[] }

export class Runner {
  gen: SkillGen; wait = 0; done = false; animLog: { name: string; t: number }[] = []; endT = 0; skill: SkillDef; att: AttackInst; phases: { t: number; tag: string }[] = []; ctx: SkillCtx; uninterruptible = false;
  constructor(skill: SkillDef, ctx: SkillCtx) { this.skill = skill; this.ctx = ctx; this.att = ctx.att; this.gen = skill.run(ctx); }
  step(dt: number) {
    if (this.done) return;
    this.wait -= dt;
    let guard = 0;
    while (this.wait <= 1e-9 && !this.done && guard++ < 20) {
      const r = this.gen.next();
      if (r.done) { this.done = true; this.endT = this.ctx.w.t; break; }
      this.wait += Math.max(r.value as number, 1e-6);
    }
  }
  cancel() { try { this.gen.return(undefined); } catch { /* noop */ } this.done = true; }
}

export class SkillCtx {
  w: World; b: Actor; att: AttackInst; skill: SkillDef; runner!: Runner; targetId: number | null;
  constructor(w: World, b: Actor, skill: SkillDef, att: AttackInst) { this.w = w; this.b = b; this.skill = skill; this.att = att; this.targetId = b.boss!.target; }
  get t() { return this.w.t; }
  get U() { return this.b.boss!.form === 'ultimate'; }
  tgt(): Actor | null { const a = this.w.actor(this.targetId ?? -1); return a && a.alive ? a : null; }
  tpos(): V { const a = this.tgt(); return a ? v(a.pos.x, a.pos.y) : add(this.b.pos, mul(this.b.facing, 60)); }
  aim(): V { return norm(sub(this.tpos(), this.b.pos)); }
  /** prediction from PAST samples only (no future input access) */
  predict(sec: number, maxD = 160): V { const a = this.tgt(); if (!a) return this.tpos(); const vel = avgVel(a); const off = mul(vel, sec); const l = len(off); return add(a.pos, l > maxD ? mul(off, maxD / l) : off); }
  phase(tag: string) { this.runner.phases.push({ t: +(this.w.t - this.att.t0).toFixed(3), tag }); this.w.ev({ t: this.w.t, type: 'phase', skill: this.skill.id, att: this.att.id, src: this.b.id, note: tag }); this.w.hooks.phase?.(this, tag); }
  anim(name: string) { this.b.anim = name; this.b.animT = 0; this.runner?.animLog.push({ name, t: this.w.t }); }
  face(d: V) { if (len(d) > 0.01) this.b.facing = norm(d); }
  turnToward(p: V, maxRad: number) { const want = ang(sub(p, this.b.pos)), cur = ang(this.b.facing); const d = angDiff(cur, want); this.b.facing = fromAng(cur + Math.max(-maxRad, Math.min(maxRad, d))); }
  move(d: V, speed: number) { this.w.moveActor(this.b, mul(norm(d), speed * this.w.dt)); }
  hit(s: Shape, o: HitOpts): Actor[] { return this.w.hitEnemies(this.b, this.att, s, o); }
  hitbox(shape: Shape | (() => Shape), dur: number, o: HitOpts, look?: (t: number, s: Shape) => Cmd[]) { return this.w.add(mkHitbox(this.w, this.b, this.att, shape, dur, o, look)); }
  spawn(e: Partial<Ent> & { update: Ent['update']; render: Ent['render'] }) { return this.w.add(mkEnt(this.w, this.b.id, this.att, e)); }
  fx(make: () => Raster, key: string, x: number, y: number, life: number, layer: Cmd['layer'] = 3) { return this.w.fx(make, key, x, y, life, layer); }
  shake(a: number) { this.w.addShake(a); }
  rnd() { return this.w.rng(); }
  log(note: string) { this.w.ev({ t: this.w.t, type: 'branch', skill: this.skill.id, att: this.att.id, src: this.b.id, note }); }
  valid(p: V, r = 10) { return this.w.map.queryValidPosition(p, r); }
}
function avgVel(a: Actor): V { const h = a.history; if (h.length < 3) return v(0, 0); const n = Math.min(6, h.length - 1); const p0 = h[h.length - 1 - n], p1 = h[h.length - 1]; const dt = p1.t - p0.t || 1; return v((p1.p.x - p0.p.x) / dt, (p1.p.y - p0.p.y) / dt); }
export { avgVel };

export function mkEnt(w: World, owner: number, att: AttackInst | undefined, e: Partial<Ent> & { update: Ent['update']; render: Ent['render'] }): Ent {
  return { id: w.nextId++, kind: 'fx', owner, att, pos: v(0, 0), t: 0, life: 1, dead: false, lethal: false, policy: 'owned', data: {}, ...e } as Ent;
}
function mkHitbox(w: World, b: Actor, att: AttackInst, shape: Shape | (() => Shape), dur: number, o: HitOpts, look?: (t: number, s: Shape) => Cmd[]): Ent {
  const get = () => (typeof shape === 'function' ? shape() : shape);
  return mkEnt(w, b.id, att, {
    kind: 'hitbox', life: dur, lethal: true, pos: v(b.pos.x, b.pos.y),
    update(w2) { const s = get(); w2.hitEnemies(b, att, s, o); (this as Ent).data.s = s; },
    render(w2) { const s = ((this as Ent).data.s as Shape) || get(); const out: Cmd[] = w2.debug ? [{ k: 'zone', shape: s, x: 0, y: 0, layer: 3, el: o.el, prog: -1 }] : []; return look ? out.concat(look((this as Ent).t, s)) : out; },
    danger(p) { return hitTest(get(), p, 6); },
  });
}

export interface WorldOpts { seed: number; adapter: MapAdapter; difficulty: number; quality: 'art_only' | 'gameplay_vfx' | 'maximum_vfx' }
export class World {
  t = 0; dt = 1 / 60; frame = 0; nextId = 1; rng: () => number; seed: number; map: MapAdapter; actors: Actor[] = []; ents: Ent[] = [];
  events: CombatEvent[] = []; shake = 0; debug = false; difficulty: number; quality: WorldOpts['quality'];
  adapterHooks = true; hazardCap = 60; flash = 0; flashEl: El = 'fire';
  impactPulses: { x: number; y: number; t: number; life: number; r: number; el: El; strength: number }[] = [];
  impactFrame: { t: number; el: El; x: number; y: number } = { t: -9, el: 'fire', x: 0, y: 0 };
  /** Optional structural-wall occlusion predicate (returns true when a solid wall/closed door blocks a -> b). */
  wallRaycast?: (a: V, b: V) => boolean;
  hooks: { phase?: (c: SkillCtx, tag: string) => void; hit?: (w: World, src: Actor, tg: Actor, dmg: number, o: HitOpts) => void; spawnBoss?: (w: World, b: Actor) => void } = {}; stats = { hitTests: 0, peakEnts: 0 };
  constructor(o: WorldOpts) { this.seed = o.seed; this.rng = mulberry(o.seed); this.map = o.adapter; this.difficulty = o.difficulty; this.quality = o.quality; }
  actor(id: number) { return this.actors.find((a) => a.id === id) || null; }
  ev(e: CombatEvent) { this.events.push(e); if (this.events.length > 4000) this.events.splice(0, 500); }
  add(e: Ent) {
    if (e.lethal && this.ents.filter((x) => x.lethal).length >= this.hazardCap) { this.ev({ t: this.t, type: 'budget', note: 'hazard cap reached: spawn rejected ' + e.kind }); e.dead = true; return e; }
    this.ents.push(e); this.stats.peakEnts = Math.max(this.stats.peakEnts, this.ents.length); return e;
  }
  fx(make: () => Raster, key: string, x: number, y: number, life: number, layer: Cmd['layer'] = 3) {
    return this.add(mkEnt(this, 0, undefined, { kind: 'fx', pos: v(x, y), life, update() {}, render() { return [{ k: 'spr', key, make, x, y, layer }]; } }));
  }
  addShake(a: number) { this.shake = Math.min(12, this.shake + a); }
  spawnActor(a: Partial<Actor> & { kind: Actor['kind']; team: Team; pos: V }): Actor {
    const ac: Actor = { id: this.nextId++, name: a.kind, vel: v(0, 0), kb: v(0, 0), r: 7, hp: 100, maxHp: 100, alive: true, facing: v(0, 1), speed: 80, slowMul: 1, slowUntil: 0, stunUntil: 0, ccImmuneUntil: 0, iframesUntil: 0, hitstopUntil: 0, grabbedBy: null, grabUntil: 0, pulls: [], anim: 'idle', animT: 0, lastHurt: -9, history: [], dodgeDirs: [], ...a } as Actor;
    this.actors.push(ac); return ac;
  }
  enemiesOf(a: Actor) { return this.actors.filter((x) => x.alive && x.team !== a.team); }
  moveActor(a: Actor, d: V) {
    const tryP = (p: V) => this.map.queryValidPosition(p, a.r) === p;
    const nx = v(a.pos.x + d.x, a.pos.y), ny = v(a.pos.x, a.pos.y + d.y);
    if (tryP(nx)) a.pos = nx; if (tryP(v(a.pos.x, ny.y))) a.pos = v(a.pos.x, ny.y);
  }
  hitEnemies(src: Actor, att: AttackInst, s: Shape, o: HitOpts): Actor[] {
    const out: Actor[] = [];
    const origin = s.k === 'capsule' ? v(s.x1, s.y1) : v(s.x, s.y);
    for (const tg of this.enemiesOf(src)) {
      this.stats.hitTests++;
      if (!hitTest(s, tg.pos, tg.r)) continue;
      if (this.wallRaycast && this.wallRaycast(origin, tg.pos)) continue;
      if (this.applyHit(src, att, tg, o)) out.push(tg);
    }
    if (out.length && this.adapterHooks && this.map.onAreaDamage) this.map.onAreaDamage(s, o.dmg);
    return out;
  }
  applyHit(src: Actor, att: AttackInst, tg: Actor, o: HitOpts): boolean {
    if (!tg.alive || tg.team === src.team) return false;
    const rec = att.hits.get(tg.id), maxHits = o.maxHits ?? 1;
    if (rec && (rec.n >= maxHits || this.t - rec.t < (o.rehit ?? 0.35))) return false;
    if (tg.iframesUntil > this.t) { if (!rec) { att.hits.set(tg.id, { n: 0, t: this.t }); this.ev({ t: this.t, type: 'evade', skill: att.skill, att: att.id, src: src.id, tgt: tg.id }); } return false; }
    att.hits.set(tg.id, { n: (rec?.n ?? 0) + 1, t: this.t });
    att.landed++;
    const scale = tg.team === 'player' ? this.difficulty : 1;
    const dmg = Math.round(o.dmg * scale);
    if (!tg.invincible) tg.hp -= dmg;
    tg.lastHurt = this.t;
    if (!tg.boss?.runner && tg.anim !== 'stagger' && tg.anim !== 'death') { tg.anim = 'hurt'; tg.animT = 0; }
    const kd = o.kbDir ? norm(o.kbDir) : norm(sub(tg.pos, o.kbFrom ?? src.pos));
    if (o.kb) { tg.kb = add(tg.kb, mul(kd, o.kb)); const l = len(tg.kb); if (l > 420) tg.kb = mul(tg.kb, 420 / l); }
    if (o.slow) { tg.slowMul = Math.min(tg.slowMul, o.slow[0]); tg.slowUntil = Math.max(tg.slowUntil, this.t + Math.min(2.5, o.slow[1])); }
    const ccOk = !tg.ccImmune && tg.ccImmuneUntil <= this.t;
    if (o.stun && ccOk) { tg.stunUntil = Math.max(tg.stunUntil, this.t + Math.min(1.1, o.stun)); tg.ccImmuneUntil = this.t + Math.min(1.1, o.stun) + 1.4; }
    const stop = Math.min(0.09, o.stop ?? 0.05);
    tg.hitstopUntil = this.t + stop; src.hitstopUntil = Math.max(src.hitstopUntil, this.t + stop * 0.6);
    if (tg.boss) { tg.boss.poise -= o.poise ?? dmg; }
    this.ev({ t: this.t, type: 'hit', skill: att.skill, att: att.id, src: src.id, tgt: tg.id, dmg, note: o.grab ? 'grab' : undefined });
    this.hooks.hit?.(this, src, tg, dmg, o);
    if (tg.hp <= 0 && !tg.invincible) this.kill(tg);
    return true;
  }
  /** grab only succeeds on genuine contact + CC eligibility */
  tryGrab(src: Actor, tg: Actor, dur: number) {
    if (!tg.alive || tg.ccImmune || tg.ccImmuneUntil > this.t || tg.iframesUntil > this.t) return false;
    tg.grabbedBy = src.id; tg.grabUntil = this.t + Math.min(1.2, dur); tg.ccImmuneUntil = this.t + Math.min(1.2, dur) + 2; return true;
  }
  release(tg: Actor) { tg.grabbedBy = null; tg.grabUntil = 0; }
  pull(tg: Actor, src: V, force: number, dur: number, max: number) { if (tg.ccImmune) return; tg.pulls.push({ src, force, until: this.t + Math.min(dur, 2.5), max }); }
  kill(a: Actor) {
    a.alive = false; a.hp = 0; a.anim = a.boss ? 'death' : 'death'; a.animT = 0;
    this.ev({ t: this.t, type: 'death', tgt: a.id, note: a.name });
    if (a.boss) this.cleanupOwner(a.id, 'boss death');
    for (const o of this.actors) if (o.grabbedBy === a.id) this.release(o);
    if (a.summon) { const ow = this.actor(a.summon.owner); if (ow?.boss) ow.boss.mem.summons = (ow.boss.mem.summons || []).filter((id: number) => id !== a.id); }
  }
  /** explicit hazard policy: lethal owned entities are removed; detached residue decals keep fading harmlessly */
  cleanupOwner(owner: number, why: string) {
    const b = this.actor(owner);
    if (b?.boss?.runner) { b.boss.runner.cancel(); b.boss.runner = null; }
    let n = 0;
    for (const e of this.ents) if (e.owner === owner && !e.dead) { if (e.lethal || e.policy === 'owned') { e.dead = true; n++; } }
    for (const a of this.actors) { if (a.grabbedBy === owner) this.release(a); a.pulls = []; if (a.summon && a.summon.owner === owner && a.alive) { a.alive = false; this.ev({ t: this.t, type: 'despawn', tgt: a.id, note: 'owner gone' }); } }
    this.ev({ t: this.t, type: 'cleanup', src: owner, note: `${why}: removed ${n} owned entities` });
  }
  /** fairness: fraction of 16 escape directions around p that are threatened within horizon */
  pressure(p: V, radius = 40, horizon = 1.2, extra?: (q: V) => boolean) {
    let bad = 0;
    for (let i = 0; i < 16; i++) { const q = add(p, fromAng((i / 16) * Math.PI * 2, radius)); if ((extra && extra(q)) || this.ents.some((e) => !e.dead && e.lethal && e.danger?.(q, horizon)) || !this.map.queryValidPosition(q, 4)) bad++; }
    return bad / 16;
  }
}
