import { World, Actor, v, add, sub, mul, norm, len, dist, fromAng, ang, angDiff, avgVel, SkillCtx, Runner, AIView, SkillDef, Decision, dir4, makeAdapter, Rect, mkEnt, Ent } from './core';
import { burst } from './helpers';
import { skillsFor } from './registry';
import type { BossId, Form } from '../art/clips';
import { vLance, vDustRing, vDot } from '../art/vfx';
import { BOSS_EL } from './fx';
import { installFx } from './fx';

export function spawnBoss(w: World, bossId: BossId, form: Form, pos: { x: number; y: number }, autonomous = true): Actor {
  const U = form === 'ultimate';
  const hp = U ? 1400 : 420;
  const b = w.spawnActor({ kind: 'boss', team: 'boss', pos: v(pos.x, pos.y), name: `${bossId}:${form}`, r: U ? 26 : 12, hp, maxHp: hp, speed: U ? 52 : 62 });
  b.boss = { bossId, form, skills: skillsFor(bossId, form), cds: {}, mem: { summons: [], portals: [], echoes: [], eyes: [], burns: [] }, state: 'Dormant/Spawn', intent: 'manifesting', target: null, runner: null, recoverUntil: 0, nextDecide: 0, recent: [], lastResult: {}, decisions: [], phase2: false, forced: null, autonomous, spawnUntil: w.t + 0.7, deadAt: 0, staggerUntil: 0, poise: U ? 260 : 90 };
  b.anim = 'spawn'; b.animT = 0;
  for (const s of b.boss.skills) b.boss.cds[s.id] = w.t + (s.signature ? 1 + w.rng() * 2 : 0.5);
  w.ev({ t: w.t, type: 'spawn', src: b.id, note: b.name });
  w.hooks.spawnBoss?.(w, b);
  return b;
}
export function spawnPlayer(w: World, pos: { x: number; y: number }, mode: 'keyboard' | 'stationary' | 'circle' | 'erratic' | 'backpedal' | 'autododge' = 'keyboard', name = 'player') {
  return w.spawnActor({ kind: 'player', team: 'player', pos: v(pos.x, pos.y), name, r: 6, hp: 100, maxHp: 100, speed: 92, bot: { mode, t: 0, seed: Math.floor(w.rng() * 1e6), input: { x: 0, y: 0, dodge: false, atk: false, shoot: false, aim: v(0, 1) } }, dodgeCd: 0, atkCd: 0 });
}
export function spawnDummy(w: World, pos: { x: number; y: number }) { return w.spawnActor({ kind: 'dummy', team: 'player', pos: v(pos.x, pos.y), name: 'dummy', r: 7, hp: 300, maxHp: 300, speed: 0 }); }

export function startSkill(w: World, b: Actor, s: SkillDef, why: string) {
  const B = b.boss!;
  const att = { id: Math.floor(w.rng() * 1e9), skill: s.id, owner: b.id, hits: new Map(), t0: w.t, landed: 0 };
  const ctx = new SkillCtx(w, b, s, att);
  const r = new Runner(s, ctx); ctx.runner = r; B.runner = r;
  B.cds[s.id] = w.t + s.cd * (B.phase2 ? 0.8 : 1);
  B.recent.push(s.id); if (B.recent.length > 6) B.recent.shift();
  w.ev({ t: w.t, type: 'select', skill: s.id, src: b.id, att: att.id, note: why });
  return r;
}

function aiView(w: World, b: Actor, tg: Actor): AIView {
  const B = b.boss!, tv = avgVel(tg), rel = sub(tg.pos, b.pos), d = len(rel);
  const tang = d > 1 ? (rel.x * tv.y - rel.y * tv.x) / (d * d) : 0;
  B.mem.lastCircle = tang;
  return { w, b, tgt: tg, d, mem: B.mem, hpFrac: b.hp / b.maxHp, last: B.recent, lastResult: B.lastResult, tgtVel: tv, dodges: tg.dodgeDirs.slice(-4), circling: tang, ranged: (w.t - ((tg as any).lastShot ?? -9)) < 2.5 };
}

export function updateBoss(w: World, b: Actor) {
  const B = b.boss!, dt = w.dt, U = B.form === 'ultimate';
  if (!b.alive) { B.state = 'Death'; return; }
  if (w.t < B.spawnUntil) { B.state = 'Dormant/Spawn'; return; }
  if (B.poise <= 0) {
    B.poise = b.boss!.form === 'ultimate' ? 260 : 90;
    if (B.runner && !B.runner.uninterruptible) { B.runner.cancel(); w.cleanupOwner(b.id, 'stagger interrupt'); B.runner = null; }
    B.staggerUntil = w.t + 0.9; b.anim = 'stagger'; b.animT = 0; w.ev({ t: w.t, type: 'stagger', tgt: b.id, note: 'poise broken' });
  }
  if (w.t < B.staggerUntil) { B.state = 'Interrupt/Stagger'; return; }
  if (!B.phase2 && b.hp < b.maxHp * 0.5) { B.phase2 = true; B.state = 'Enrage/Phase'; w.ev({ t: w.t, type: 'phase', src: b.id, note: 'phase 2: faster cooldowns, combo preference' }); }
  // target acquisition with hysteresis (multiplayer aware)
  if (!B.mem.nextTgt || w.t > B.mem.nextTgt) {
    B.mem.nextTgt = w.t + 0.5;
    const cands = w.enemiesOf(b).filter((a) => dist(a.pos, b.pos) < (B.form === 'ultimate' ? 1400 : 520));
    let best: Actor | null = null, bs = -1e9;
    for (const a of cands) { let s = -dist(a.pos, b.pos) + (a.id === B.target ? 60 : 0) + (a.kind === 'player' ? 40 : 0); if (w.t - ((a as any).lastHitBoss ?? -9) < 3) s += 80; if (s > bs) { bs = s; best = a; } }
    if ((best?.id ?? null) !== B.target) w.ev({ t: w.t, type: 'target', src: b.id, tgt: best?.id, note: best ? `acquire ${best.name}` : 'target lost' });
    B.target = best?.id ?? null;
  }
  const tg = B.target != null ? w.actor(B.target) : null;
  if (B.runner) {
    B.state = (B.runner.skill.doc as any).sustained ? 'SustainedControl' : 'Attack/Combo';
    B.runner.step(dt);
    if (B.runner.done) {
      const res = B.runner.att.landed > 0 ? 'hit' : 'miss';
      B.lastResult[B.runner.skill.id] = res; B.mem.lastSkill = B.runner.skill.id; B.mem.lastRes = res;
      B.recoverUntil = w.t + (res === 'miss' ? 0.5 : 0.28) * (B.form === 'ultimate' ? 1.4 : 1);
      w.ev({ t: w.t, type: 'end', skill: B.runner.skill.id, src: b.id, note: res });
      B.runner = null; if (b.anim.endsWith('_recover') === false) { b.anim = 'recover'; b.animT = 0; }
    }
    return;
  }
  if (w.t < B.recoverUntil) { B.state = 'Recover'; return; }
  if (!tg || !tg.alive) { B.state = 'Patrol_or_Hold'; B.intent = 'no valid target: hold position'; if (b.anim !== 'idle') { b.anim = 'idle'; b.animT = 0; } return; }
  if (B.forced) { const s = B.skills.find((x) => x.id === B.forced); B.forced = null; if (s) { b.facing = norm(sub(tg.pos, b.pos)); startSkill(w, b, s, 'FORCED by lab (not autonomous evidence)'); B.decisions.unshift({ t: w.t, chosen: s.id, intent: 'forced', scores: [] }); return; } }
  if (B.autonomous && w.t >= B.nextDecide) {
    B.nextDecide = w.t + 0.15;
    const av = aiView(w, b, tg);
    const scores: Decision['scores'] = [];
    for (const s of B.skills) {
      const ready = w.t >= (B.cds[s.id] ?? 0);
      let { s: sc, why } = s.score(av); why = [...why];
      if (!ready) { why.push('cooldown'); sc = 0; }
      if (av.d < s.range[0] * 0.8 || av.d > s.range[1] * 1.15) { why.push(`out of range [${s.range}]`); sc *= 0.05; }
      const rep = B.recent.slice(-3).filter((x) => x === s.id).length; if (rep) { sc *= rep >= 2 ? 0.25 : 0.55; why.push(`recently used x${rep}`); }
      if (B.phase2 && s.signature) { sc *= 1.15; }
      const j = 0.85 + w.rng() * 0.3; sc *= j; why.push(`jitter ${j.toFixed(2)}`);
      scores.push({ id: s.id, s: +sc.toFixed(3), why, ready });
    }
    scores.sort((a, c) => c.s - a.s);
    const top = scores[0];
    if (top && top.s > 0.32) {
      const s = B.skills.find((x) => x.id === top.id)!;
      B.decisions.unshift({ t: +w.t.toFixed(2), chosen: s.id, intent: 'attack', scores: scores.slice(0, 5) }); if (B.decisions.length > 30) B.decisions.pop();
      B.intent = `${s.name}: ${top.why[0] ?? ''}`;
      startSkill(w, b, s, top.why.join('; '));
      return;
    }
    B.mem.lastScores = scores.slice(0, 5);
  }
  // positioning
  const pref = (B.mem.prefRange as number) ?? (B.form === 'ultimate' ? 120 : 40);
  const rel = sub(tg.pos, b.pos), d = len(rel), dirT = norm(rel);
  let mv = v(0, 0);
  const strafe = fromAng(ang(dirT) + Math.PI / 2 * (Math.sin(w.t * 0.7 + b.id) > 0 ? 1 : -1));
  if (d > pref * 1.25) mv = add(dirT, mul(strafe, 0.25)); else if (d < pref * 0.6) mv = add(mul(dirT, -0.7), mul(strafe, 0.6)); else mv = mul(strafe, 0.55);
  const run = d > pref * 2.5;
  B.state = 'Chase/Position'; B.intent = d > pref * 1.25 ? `close distance to ${pref}px` : 'circle at preferred range';
  const before = v(b.pos.x, b.pos.y);
  w.moveActor(b, mul(norm(mv), b.speed * (run ? 1.5 : 1) * dt * Math.min(1, len(mv) + 0.2)));
  // footfall weight: stride dust emitted in world space as the body actually covers ground
  const moved = dist(before, b.pos); B.mem.stepAcc = (B.mem.stepAcc || 0) + moved;
  const stride = B.form === 'ultimate' ? 34 : 18;
  if (B.mem.stepAcc > stride && w.quality === 'maximum_vfx') {
    B.mem.stepAcc = 0;
    const el = BOSS_EL[B.bossId];
    w.add(mkEnt(w, b.id, undefined, { kind: 'fx', policy: 'detach', life: 0.5, pos: v(b.pos.x, b.pos.y), update() {}, render() { const e = this as Ent, f = Math.min(3, Math.floor(e.t * 8)); return [{ k: 'spr', key: `step${B.bossId}${f}`, make: () => vDustRing(U ? 16 : 8, f, 2), x: b.pos.x, y: b.pos.y, layer: 0, alpha: 0.7 - e.t }]; } }));
    if (B.bossId === 'surtur' || B.bossId === 'anubis') w.add(mkEnt(w, b.id, undefined, { kind: 'fx', policy: 'detach', life: 0.5, pos: v(b.pos.x, b.pos.y), update() {}, render() { const e = this as Ent; return [{ k: 'spr', key: `stp${el}${Math.floor(e.t * 12) % 3}`, make: () => vDot(el, 1, Math.floor(e.t * 12)), x: b.pos.x + Math.sin(e.t * 13) * 5, y: b.pos.y - 6 - e.t * 16, layer: 3, alpha: 0.8 - e.t }]; } }));
  }
  b.facing = norm(add(mul(b.facing, 0.85), mul(dirT, 0.15)));
  const want = run ? 'run' : 'walk'; if (b.anim !== want) { b.anim = want; b.animT = 0; }
}

function updatePlayer(w: World, a: Actor) {
  const bt = a.bot!, inp = bt.input!, dt = w.dt; bt.t += dt;
  const foes = w.enemiesOf(a), foe = foes.sort((x, y) => dist(x.pos, a.pos) - dist(y.pos, a.pos))[0];
  if (bt.mode !== 'keyboard') {
    inp.dodge = false; inp.atk = false; inp.shoot = false;
    const rel = foe ? sub(foe.pos, a.pos) : v(0, 1), d = len(rel), n = norm(rel);
    inp.aim = n;
    if (bt.mode === 'stationary') { inp.x = 0; inp.y = 0; }
    else if (bt.mode === 'circle') { const t = fromAng(ang(n) + Math.PI / 2); const k = d < 70 ? -0.6 : d > 110 ? 0.6 : 0; inp.x = t.x + n.x * k; inp.y = t.y + n.y * k; inp.shoot = Math.sin(bt.t * 3) > 0.7; }
    else if (bt.mode === 'backpedal') { inp.x = -n.x; inp.y = -n.y; inp.shoot = Math.sin(bt.t * 2) > 0.8; }
    else if (bt.mode === 'erratic') { if (Math.floor(bt.t * 1.7) !== Math.floor((bt.t - dt) * 1.7)) { const r = fromAng(w.rng() * 6.283); inp.x = r.x; inp.y = r.y; inp.dodge = w.rng() < 0.35; } inp.atk = d < 30; }
    else if (bt.mode === 'autododge') {
      const danger = (p: { x: number; y: number }, h: number) => w.ents.some((e) => !e.dead && e.lethal && e.owner !== a.id && e.danger?.(p, h));
      if (danger(a.pos, 0.35)) {
        let best = v(0, 0), bs = 1e9;
        for (let i = 0; i < 8; i++) { const dd = fromAng(i * 0.785), p = add(a.pos, mul(dd, 48)); if (!w.map.queryValidPosition(p, 6)) continue; const s = (danger(p, 0.6) ? 100 : 0) + (dist(p, foe?.pos ?? p) < 30 ? 20 : 0) + w.rng(); if (s < bs) { bs = s; best = dd; } }
        inp.x = best.x; inp.y = best.y; inp.dodge = bs < 50;
      } else { const t = fromAng(ang(n) + Math.PI / 2); const k = d > 40 ? 0.8 : -0.3; inp.x = t.x * 0.6 + n.x * k; inp.y = t.y * 0.6 + n.y * k; inp.atk = d < 34; inp.shoot = d > 80 && Math.sin(bt.t * 4) > 0.6; }
    }
  }
  if (w.t < a.stunUntil || a.grabbedBy !== null) return;
  const mvd = v(inp.x, inp.y), ml = len(mvd);
  const slow = w.t < a.slowUntil ? a.slowMul : 1;
  if (a.iframesUntil > w.t - 0.08 && (a as any).rollDir) { w.moveActor(a, mul((a as any).rollDir, 230 * dt)); }
  else if (ml > 0.05) { w.moveActor(a, mul(norm(mvd), a.speed * slow * dt)); a.facing = norm(mvd); }
  a.anim = ml > 0.05 ? 'walk' : 'idle';
  a.dodgeCd = Math.max(0, (a.dodgeCd ?? 0) - dt); a.atkCd = Math.max(0, (a.atkCd ?? 0) - dt);
  if (inp.dodge && a.dodgeCd === 0) {
    const rd = ml > 0.05 ? norm(mvd) : mul(a.facing, -1); (a as any).rollDir = rd; a.iframesUntil = w.t + 0.26; a.dodgeCd = 0.75;
    a.dodgeDirs.push(rd); if (a.dodgeDirs.length > 8) a.dodgeDirs.shift(); w.ev({ t: w.t, type: 'dodge', src: a.id });
  }
  if (inp.atk && a.atkCd === 0 && foe) {
    a.atkCd = 0.38; const att = { id: -1, skill: 'player_slash', owner: a.id, hits: new Map(), t0: w.t, landed: 0 }; const aa = ang(inp.aim);
    const hit = w.hitEnemies(a, att, { k: 'sector', x: a.pos.x, y: a.pos.y, r: 30 + (foe.r - 7), a: aa, span: 1.8 }, { dmg: 9, kb: 20, el: 'mind', stop: 0.04 });
    for (const h of hit) (a as any).lastHitBoss = w.t, void h;
    burst(w, 'mind', a.pos.x + Math.cos(aa) * 16, a.pos.y + Math.sin(aa) * 16, 6, 0.15, false);
  }
  if (inp.shoot && a.atkCd === 0) {
    a.atkCd = 0.3; (a as any).lastShot = w.t; const dir = norm(inp.aim);
    let pos = add(a.pos, mul(dir, 8)); const att = { id: -2, skill: 'player_bolt', owner: a.id, hits: new Map(), t0: w.t, landed: 0 };
    w.add(mkEnt(w, a.id, att, { kind: 'pbolt', life: 1.2, pos, update(w2, dt2) { const e = this as Ent; const np = add(pos, mul(dir, 260 * dt2)); if (w2.map.raycast(pos, np).hit) { e.dead = true; return; } pos = np; e.pos = pos; if (w2.hitEnemies(a, att, { k: 'circle', x: pos.x, y: pos.y, r: 3 }, { dmg: 4, el: 'space', stop: 0.02 }).length) { e.dead = true; (a as any).lastHitBoss = w2.t; } }, render() { return [{ k: 'spr', key: `pb${Math.round(ang(dir) * 5)}`, make: () => vLance('space', ang(dir), 8), x: pos.x, y: pos.y, layer: 3 }]; } }));
  }
}

function updateSummon(w: World, a: Actor) {
  const S = a.summon!, dt = w.dt;
  if (w.t > S.until) { w.kill(a); w.ev({ t: w.t, type: 'despawn', tgt: a.id, note: 'summon lifetime ended' }); return; }
  if (w.t < a.stunUntil) return;
  const foe = w.enemiesOf(a).sort((x, y) => dist(x.pos, a.pos) - dist(y.pos, a.pos))[0]; if (!foe) return;
  const rel = sub(foe.pos, a.pos), d = len(rel); a.facing = norm(rel);
  S.atkCd -= dt;
  if (d > 16) { w.moveActor(a, mul(norm(rel), a.speed * dt)); a.anim = 'walk'; }
  else if (S.atkCd <= 0) { S.atkCd = 1.1; const att = { id: a.id * 7, skill: 'wraith_slash', owner: a.id, hits: new Map(), t0: w.t, landed: 0 }; w.hitEnemies(a, att, { k: 'sector', x: a.pos.x, y: a.pos.y, r: 20, a: ang(rel), span: 1.6 }, { dmg: S.dmg, kb: 60, el: 'soul' }); burst(w, 'soul', a.pos.x + a.facing.x * 10, a.pos.y + a.facing.y * 10, 6, 0.2, false); a.anim = 'attack'; }
}

export function stepWorld(w: World) {
  const dt = w.dt; w.t += dt; w.frame++;
  for (const a of w.actors) {
    if (!a.alive) { a.animT += dt; continue; }
    if (a.hitstopUntil > w.t) continue; // bounded per-actor hit-stop (animation freezes with gameplay); others keep simulating
    a.animT += dt;
    if (w.t > a.slowUntil) a.slowMul = 1;
    if (a.grabbedBy !== null) {
      const g = w.actor(a.grabbedBy);
      if (!g || !g.alive || w.t > a.grabUntil) w.release(a);
      else { const hp = add(g.pos, mul(g.facing, g.r + 6)); a.pos = v(hp.x, hp.y - ((g as any).liftH ?? 0)); continue; }
    }
    let pv = v(0, 0); a.pulls = a.pulls.filter((p) => p.until > w.t);
    for (const p of a.pulls) { const d = sub(p.src, a.pos), l = len(d); if (l > 6) pv = add(pv, mul(norm(d), Math.min(p.max, p.force))); }
    if (len(pv) > 0) w.moveActor(a, mul(pv, dt));
    if (len(a.kb) > 1) { w.moveActor(a, mul(a.kb, dt)); a.kb = mul(a.kb, Math.pow(0.0015, dt)); } else a.kb = v(0, 0);
    if (a.bot) updatePlayer(w, a);
    if (a.boss) updateBoss(w, a);
    if (a.summon) updateSummon(w, a);
    if (w.frame % 6 === 0) { a.history.push({ t: w.t, p: v(a.pos.x, a.pos.y), v: v(0, 0) }); if (a.history.length > 24) a.history.shift(); }
  }
  for (const e of w.ents) { if (e.dead) continue; e.t += dt; e.update(w, dt); if (e.t >= e.life) e.dead = true; }
  w.ents = w.ents.filter((e) => !e.dead);
  w.shake *= Math.pow(0.02, dt); w.flash = Math.max(0, w.flash - dt * 2.5);
  for (const p of w.impactPulses) p.t += dt;
  w.impactPulses = w.impactPulses.filter((p) => p.t < p.life);
}

export function makeMiniRoom(): { bounds: Rect; obstacles: Rect[] } {
  return { bounds: { x: 0, y: 0, w: 480, h: 320 }, obstacles: [{ x: 96, y: 80, w: 24, h: 24 }, { x: 360, y: 80, w: 24, h: 24 }, { x: 228, y: 230, w: 24, h: 20 }] };
}
export function makeOpenWorld(): { bounds: Rect; obstacles: Rect[] } { return { bounds: { x: 0, y: 0, w: 2400, h: 1600 }, obstacles: [] }; }
export function newWorld(kind: 'mini' | 'open', seed: number, difficulty = 1, quality: World['quality'] = 'maximum_vfx') {
  const m = kind === 'mini' ? makeMiniRoom() : makeOpenWorld();
  const w = new World({ seed, adapter: makeAdapter(m.bounds, m.obstacles), difficulty, quality });
  installFx(w); return w;
}
export { dir4, angDiff };
