import { SkillDef, SkillCtx, SkillGen, AIView, Shape, v, add, mul, norm, sub, dist, fromAng, ang, angDiff, rot, len, Cmd, Ent, hitTest } from './core';
import { zone, burst, debris, decal, sweep, proj, lockAim, rangeFit, sm, QN, tele } from './helpers';
import { vFallSword, vOrb, vFist, vRock, vFlameV2 as vFlame, vShock as vRing, vDot, vFieldRing } from '../art/vfx';
import type { BossId, Form } from '../art/clips';

type Doc = SkillDef['doc'];
export const mk = (boss: BossId, form: Form) => (id: string, name: string, cd: number, range: [number, number], score: (ai: AIView) => { s: number; why: string[] }, run: (c: SkillCtx) => SkillGen, doc: Doc): SkillDef => ({ id, name, boss, form, signature: true, cd, range, score, run, doc });
const W = (s: number, ...why: string[]) => ({ s, why });

// =============================== SURTUR ===============================
const sm_ = mk('surtur', 'mini');
export const SURTUR_MINI: SkillDef[] = [
  sm_('kings_cleave', "King's Cleave", 5, [0, 75], (ai) => W(0.95 * rangeFit(ai.d, 0, 55) + (ai.d < 30 ? 0.15 : 0), `close range ${ai.d.toFixed(0)}px favours cleave`), function* (c) {
    c.phase('OPEN'); c.anim('kings_cleave_open'); const a0 = ang(lockAim(c)); const start = c.tpos(); tele(c, { k: 'sector', x: c.b.pos.x, y: c.b.pos.y, r: 46, a: a0, span: 2.5 }, 0.34, 'fire'); yield 0.34;
    c.phase('COMMIT'); c.anim('kings_cleave_active'); c.phase('ACTIVE');
    sweep(c, 46, a0 - 1.3, a0 + 1.2, 0.12, { dmg: 14, kb: 150, el: 'fire', poise: 0 }, 'fire', 7); yield 0.15;
    decal(c, 'fire', c.b.pos.x + Math.cos(a0) * 28, c.b.pos.y + Math.sin(a0) * 28, 36, 14, 3);
    sweep(c, 42, a0 + 1.2, a0 - 1.2, 0.12, { dmg: 10, kb: 120, el: 'fire' }, 'fire', 5); yield 0.14;
    // branch locked here from last-known direction (before final swing)
    const rel = sub(c.tpos(), c.b.pos), front = Math.abs(angDiff(a0, ang(rel))) < 0.9;
    const lateral = Math.abs(((c.tpos().x - start.x) * -Math.sin(a0) + (c.tpos().y - start.y) * Math.cos(a0)));
    if (lateral > 18) c.b.boss!.mem.lateralEscapes = (c.b.boss!.mem.lateralEscapes || 0) + 1;
    if (front) { c.log('branch: forward vertical chop'); const tip = add(c.b.pos, fromAng(a0, 58)); c.hitbox({ k: 'capsule', x1: c.b.pos.x, y1: c.b.pos.y, x2: tip.x, y2: tip.y, r: 8 }, 0.08, { dmg: 18, kb: 200, el: 'fire' }); burst(c, 'fire', tip.x, tip.y, 16); debris(c, 'fire', tip.x, tip.y, 8); }
    else { c.log('branch: backward return sweep'); sweep(c, 40, a0 + Math.PI - 1.2, a0 + Math.PI + 1.2, 0.12, { dmg: 12, kb: 160, el: 'fire' }, 'fire', 6); }
    yield 0.2; c.phase('RECOVERY'); c.anim('kings_cleave_recover'); yield 0.36; c.phase('END');
  }, { open: 'Shoulder twist & blade recoil; hip silhouette shows two follow-up pose sets', active: 'Broad slash + opposite return; finisher branch (vertical chop | back sweep) locked from last known direction before the final swing', vfx: 'sword-tip flame wedges (vSlash per 32 angles), sparks burst, arc scorch decal', end: 'heavy follow-through recovery 0.36s', combo: 'lateral escapes counted → Furnace Trap bonus', counter: 'dodge to a flank, punish recovery', target: 'locked_on_commit (aim at OPEN)', hitbox: 'sweeping sector r46/42 + capsule chop', el: 'fire' }),
  sm_('furnace_trap', 'Furnace Trap', 9, [20, 230], (ai) => W(0.55 + (ai.mem.lateralEscapes > 0 ? 0.35 : 0) + 0.2 * sm(ai.d, 50, 120) - 0.15 * (ai.mem.burns?.length || 0), `lateral escapes ${ai.mem.lateralEscapes || 0}`, 'deny retreat corridors'), function* (c) {
    c.phase('OPEN'); c.anim('furnace_trap_open'); lockAim(c); yield 0.36;
    c.phase('COMMIT'); const pred = c.predict(0.8), cur = c.tpos();
    const a1 = ang(sub(pred, c.b.pos)) + 0.38, a2 = ang(sub(cur, c.b.pos)) - 0.38; // two branches bracketing likely retreat, centre left open
    c.anim('furnace_trap_active'); c.phase('ACTIVE');
    const heads = [{ a: a1, p: v(c.b.pos.x, c.b.pos.y), alive: true }, { a: a2, p: v(c.b.pos.x, c.b.pos.y), alive: true }];
    for (let i = 0; i < 9; i++) {
      for (const h of heads) {
        if (!h.alive) continue;
        h.a += (c.rnd() - 0.5) * 0.25; const np = add(h.p, fromAng(h.a, 16));
        if (c.w.map.raycast(h.p, np).hit) { h.alive = false; continue; }
        if (c.w.pressure(c.tpos(), 36, 1.0) > 0.7) { h.alive = false; c.log('fairness: stream stopped to keep an escape lane'); continue; }
        h.p = np;
        zone(c, { shape: { k: 'circle', x: np.x, y: np.y, r: 9 }, warn: 0.28, active: 0.18, linger: 1.6, o: { dmg: 10, kb: 90, el: 'fire' }, lingerHit: { dmg: 2, rehit: 0.5, maxHits: 4, el: 'fire' }, el: 'fire', look: 'jet', decalSize: [20, 12] });
      }
      c.b.boss!.mem.burns = [...(c.b.boss!.mem.burns || []).filter((t: number) => t > c.t), c.t + 2.2];
      yield 0.07;
    }
    yield 0.2; c.phase('RECOVERY'); c.anim('furnace_trap_recover'); yield 0.36; c.phase('END');
  }, { open: 'sword planted, cracks climb arms', active: 'two boss-origin fissure streams propagate in discrete segments; each erupts only when its seam animation reaches it (warn 0.28s)', vfx: 'seam→fissure→orange-white jets→debris→charcoal decal', end: 'streams finite (1.6s linger) then fade', combo: 'lanes constrain space for King’s Cleave', counter: 'cross the seam before eruption; centre lane deliberately left open', target: 'snapshot + 0.8s velocity prediction (past samples only)', hitbox: '9px circles per segment + low linger burn', el: 'fire' }),
  sm_('burning_pursuit', 'Burning Pursuit', 7, [60, 280], (ai) => W(0.45 + 0.45 * sm(ai.d, 60, 160) + (ai.ranged ? 0.2 : 0), `gap ${ai.d.toFixed(0)}px`, ai.ranged ? 'punish ranged kiting' : 'close distance'), function* (c) {
    c.phase('OPEN'); c.anim('burning_pursuit_open'); let dir = lockAim(c); tele(c, { k: 'capsule', x1: c.b.pos.x, y1: c.b.pos.y, x2: c.b.pos.x + dir.x * 130, y2: c.b.pos.y + dir.y * 130, r: 14 }, 0.32, 'fire'); yield 0.32;
    c.phase('COMMIT'); c.anim('burning_pursuit_active'); c.phase('ACTIVE');
    c.hitbox(() => ({ k: 'circle', x: c.b.pos.x, y: c.b.pos.y, r: 14 }), 0.55, { dmg: 12, kb: 220, el: 'fire' });
    let braked = false;
    for (let t = 0; t < 0.55; t += c.w.dt) {
      c.turnToward(c.tpos(), 1.2 * c.w.dt); dir = c.b.facing; c.move(dir, 230);
      if (Math.floor(t / 0.06) !== Math.floor((t - c.w.dt) / 0.06)) zone(c, { shape: { k: 'circle', x: c.b.pos.x, y: c.b.pos.y, r: 7 }, warn: 0.01, active: 0.01, linger: 1.0, o: { dmg: 0, el: 'fire' }, lingerHit: { dmg: 2, rehit: 0.5, maxHits: 3, el: 'fire' }, el: 'fire', look: 'jet', silentWarn: true });
      if (t > 0.28 && !braked && c.tgt() && c.w.events.slice(-12).some((e) => e.type === 'dodge' && e.src === c.targetId && c.t - e.t < 0.35)) { braked = true; break; }
      yield 0;
    }
    if (braked) { c.log('branch: brake — punish premature roll'); c.anim('burning_pursuit_recover'); yield 0.12; sweep(c, 44, ang(dir) - 2.6, ang(dir) + 2.6, 0.16, { dmg: 14, kb: 180, el: 'fire' }, 'fire', 6); yield 0.3; }
    else { c.log('branch: continue → spinning cleave'); sweep(c, 48, ang(dir), ang(dir) + 6.2, 0.22, { dmg: 13, kb: 200, el: 'fire', maxHits: 1 }, 'fire', 7); burst(c, 'fire', c.b.pos.x + dir.x * 20, c.b.pos.y + dir.y * 20, 18); yield 0.3; }
    c.phase('RECOVERY'); c.anim('burning_pursuit_recover'); yield c.att.landed ? 0.3 : 0.5; c.phase('END');
  }, { open: 'heel digs in, sword drags, target vector sampled before dash', active: 'charge with 1.2 rad/s turn limit, body hitbox, finite burning trail; decision point at 0.28s: brake-sweep (if target rolled early) or spinning cleave', vfx: 'drag sparks, flame ribbon trail, ash kicks, directional burst', end: 'skid recovery longer on miss', combo: 'start after trap lane burns', counter: 'lateral dodge at commitment, punish overshoot', target: 'limited steering (explicit tracking rule)', hitbox: 'r14 body circle; sector sweeps', el: 'fire' }),
  sm_('executioner', 'Executioner', 8, [0, 95], (ai) => W(0.7 * rangeFit(ai.d, 10, 70) + (ai.tgt.slowUntil > ai.w.t ? 0.3 : 0) + (ai.last.at(-1) === 'furnace_trap' ? 0.2 : 0), 'high-damage when target pressured'), function* (c) {
    c.phase('OPEN'); c.anim('executioner_open'); const a = lockAim(c); yield 0.2;
    const p = add(c.b.pos, mul(norm(sub(c.tpos(), c.b.pos)), Math.min(62, dist(c.tpos(), c.b.pos)))); c.face(sub(p, c.b.pos));
    c.phase('COMMIT'); zone(c, { shape: { k: 'capsule', x1: c.b.pos.x, y1: c.b.pos.y, x2: p.x, y2: p.y, r: 9 }, warn: 0.24, active: 0.08, o: { dmg: 26, kb: 120, stun: 0.4, el: 'fire', poise: 0 }, el: 'fire', look: 'none' }); yield 0.24;
    c.anim('executioner_active'); c.phase('ACTIVE'); c.shake(4); burst(c, 'fire', p.x, p.y, 22); debris(c, 'fire', p.x, p.y, 12, 110, 3); decal(c, 'fire', p.x, p.y, 40, 24, 5);
    zone(c, { shape: { k: 'ring', x: p.x, y: p.y, r0: 12, r1: 34 }, warn: 0.12, active: 0.1, o: { dmg: 7, kb: 140, el: 'fire' }, el: 'fire', look: 'none' });
    for (let i = 0; i < 6; i++) { const q = add(p, fromAng(c.rnd() * 6.28, 16 + c.rnd() * 18)); zone(c, { shape: { k: 'circle', x: q.x, y: q.y, r: 5 }, warn: 0.35, active: 0.12, o: { dmg: 5, el: 'fire' }, el: 'fire', look: 'jet' }); }
    yield 0.16; c.phase('RECOVERY'); c.anim('executioner_recover');
    if (!c.att.landed) { c.log('blade stuck in floor: extended extraction'); yield 0.66; } else yield 0.4;
    c.phase('END'); void a;
  }, { open: 'greatsword overhead, furnace flares; target point locked before strike', active: 'vertical chop capsule (26 dmg, capped 0.4s stun) + lava droplet fan + ring shock', vfx: 'white-hot contact burst, stone fragments, scorch with cooldown', end: 'empty-floor hit → 0.66s extraction punish window', combo: 'after trap lanes (never auto-locks)', counter: 'late sideways dodge then punish', target: 'locked_on_commit point', hitbox: 'capsule r9 + ring 12–34 + 5px droplets', el: 'fire' }),
];
const su_ = mk('surtur', 'ultimate');
export const SURTUR_ULT: SkillDef[] = [
  su_('worldcleaver', 'Worldcleaver', 10, [0, 280], (ai) => W(0.85 * rangeFit(ai.d, 40, 200), 'sweep covers wide arc at mid range'), function* (c) {
    c.phase('OPEN'); c.anim('worldcleaver_open'); const a = ang(lockAim(c)); yield 0.6;
    zone(c, { shape: { k: 'sector', x: c.b.pos.x, y: c.b.pos.y, r: 160, a, span: 3.2 }, warn: 0.2, active: 0.01, o: { dmg: 0 }, el: 'fire', look: 'none', major: true }); yield 0.2;
    c.phase('COMMIT'); c.anim('worldcleaver_active'); c.phase('ACTIVE'); c.shake(6);
    sweep(c, 160, a - 1.6, a + 1.6, 0.36, { dmg: 30, kb: 320, el: 'fire', poise: 0 }, 'fire', 14, 20);
    for (let k = 0; k < 5; k++) {
      const ra = a - 1.25 + k * 0.62; if (c.w.pressure(c.tpos(), 50, 1) > 0.6 && k % 2) { c.log(`ribbon ${k} skipped for safe lane`); continue; }
      for (let r = 60; r <= 230; r += 22) { const p = add(c.b.pos, fromAng(ra, r)); if (!c.valid(p, 4)) break; zone(c, { shape: { k: 'circle', x: p.x, y: p.y, r: 11 }, warn: 0.35 + r / 900, active: 0.12, linger: 3.6, o: { dmg: 8, el: 'fire' }, lingerHit: { dmg: 3, rehit: 0.5, maxHits: 6, el: 'fire' }, el: 'fire', look: 'jet', decalSize: [24, 14] }); }
      yield 0.07;
    }
    yield 0.1; c.phase('RECOVERY'); c.anim('worldcleaver_recover'); yield 0.78; c.phase('END');
  }, { open: 'torso rotates, blade ignites hilt→tip over 0.6s, wide sector warning', active: 'massive moving front (sweeping sector r160) + 5 trailing lava ribbons with independent timers', vfx: 'blade wedge, breaking tongues, plasma shards, ribbons crust over 4 heat stages', end: 'slow 0.78s follow-through', combo: 'Caldera March while lanes cool', counter: 'cross behind the titan or use ribbon gaps', target: 'locked_on_commit', hitbox: 'sweeping sector + ribbon circles', el: 'fire' }),
  su_('caldera_march', 'Caldera March', 12, [0, 700], (ai) => W(0.5 + 0.3 * sm(ai.d, 100, 300), 'force movement across flame fronts'), function* (c) {
    c.phase('OPEN'); c.anim('caldera_march_open'); lockAim(c); yield 0.52; c.phase('COMMIT');
    c.anim('caldera_march_active'); c.phase('ACTIVE');
    for (let step = 0; step < 6; step++) {
      for (let t = 0; t < 0.3; t += c.w.dt) { c.turnToward(c.tpos(), 0.9 * c.w.dt); c.move(c.b.facing, 120); yield 0; }
      const side = step % 2 ? 1 : -1, foot = add(c.b.pos, rot(mul(c.b.facing, 10), side * Math.PI / 2));
      zone(c, { shape: { k: 'circle', x: foot.x, y: foot.y, r: 38 }, warn: 0.24, active: 0.1, o: { dmg: 16, kb: 220, el: 'fire' }, el: 'fire', look: 'jet', decalSize: [44, 24] });
      const pat = add(foot, fromAng(c.rnd() * 6.28, 40));
      if (c.valid(pat, 6)) zone(c, { shape: { k: 'circle', x: pat.x, y: pat.y, r: 16 }, warn: 0.3, active: 0.05, linger: 2.6, o: { dmg: 4, el: 'fire' }, lingerHit: { dmg: 2, rehit: 0.6, maxHits: 4, el: 'fire' }, el: 'fire', look: 'jet' });
      c.shake(4); debris(c, 'fire', foot.x, foot.y, 6, 120, 3);
      if (dist(c.tpos(), c.b.pos) < 80) { c.log('upper-body swipe between footfalls'); sweep(c, 80, ang(c.b.facing) - 1.2, ang(c.b.facing) + 1.2, 0.14, { dmg: 14, kb: 200, el: 'fire' }, 'fire', 10); }
      yield 0.12;
    }
    c.phase('RECOVERY'); c.anim('caldera_march_recover'); yield 0.52; c.phase('END');
  }, { open: 'first heel lifts, glow beneath feet', active: 'persistent march: 6 footfalls each spawn a contact-synchronised burst (not constant aura) + detached smoulder patches; optional swipes', vfx: 'molten plates, fire pillars, footprint decals alternating L/R', end: 'planted stance; patches fade independently', combo: 'push into Worldcleaver lanes', counter: 'move during the 0.42s interval, wide side arcs', target: 'turn-limited 0.9 rad/s', hitbox: 'r38 footfall circles', el: 'fire', sustained: true } as Doc),
  su_('rain_of_ruin', 'Rain of Ruin', 11, [0, 900], (ai) => W(0.55 + 0.35 * sm(ai.d, 150, 400), 'long range bombardment'), function* (c) {
    c.phase('OPEN'); c.anim('rain_of_ruin_open'); lockAim(c); yield 0.52; c.phase('COMMIT'); c.anim('rain_of_ruin_active'); c.phase('ACTIVE');
    for (let i = 0; i < 7; i++) {
      const mix = c.rnd(); let p = add(mul(c.tpos(), 1 - mix), mul(c.predict(1.1), mix)); p = add(p, fromAng(c.rnd() * 6.28, c.rnd() * 30));
      if (c.w.pressure(c.tpos(), 40, 1.3) > 0.6) p = add(c.tpos(), fromAng(c.rnd() * 6.28, 90));
      const vp = c.valid(p, 10); if (!vp) { c.log('sword spawn rejected by map adapter'); continue; }
      const P = vp, t0 = c.t;
      c.spawn({ kind: 'fallsword', pos: P, life: 1.25, lethal: true, major: true, update(w) { const e = this as Ent; if (!e.data.hit && e.t >= 1.0) { e.data.hit = 1; w.hitEnemies(c.b, c.att, { k: 'circle', x: P.x, y: P.y, r: 30 }, { dmg: 24, kb: 180, el: 'fire' }); burst(w, 'fire', P.x, P.y, 28); debris(w, 'fire', P.x, P.y, 10, 120, 3); decal(w, 'fire', P.x, P.y, 48, 28, 5); w.addShake(3); } },
        render() { const e = this as Ent, k = Math.min(1, e.t / 1.0), st = Math.min(3, Math.floor(k * 4)), out: Cmd[] = [{ k: 'zone', shape: { k: 'circle', x: P.x, y: P.y, r: 30 }, x: P.x, y: P.y, layer: 1, el: 'fire', prog: k }]; if (k < 1) { const fsR = vFallSword(st); out.push({ k: 'spr', key: `fs${st}`, make: () => fsR, x: P.x, y: P.y - (1 - k) * 220 - (fsR.h / 2 - 4), layer: 3 }); } return out; },
        danger(q, h) { return (this as Ent).t + h >= 1.0 && dist(q, P) < 36; } });
      void t0; yield 0.28;
    }
    c.phase('RECOVERY'); c.anim('rain_of_ruin_recover'); yield 0.48; c.phase('END');
  }, { open: 'sword raised, sparks spiral up into sword silhouettes', active: '7 molten swords; each centre = mix(current, predicted) locked before its 1.0s descent; growing shadow + off-screen arrows', vfx: 'foreshortened falling sword stages, eruption, debris, cooling scorch', end: 'boss acts before marks cool', combo: 'with march to cut routes', counter: 'read descent shadow, move between targets', target: 'per-sword lock at spawn', hitbox: 'r30 impact circle at t=1.0s', el: 'fire' }),
  su_('ragnarok', 'Ragnarök — Final Incineration', 26, [0, 520], (ai) => W(ai.hpFrac < 0.7 ? 0.9 : 0.35, `hp ${(ai.hpFrac * 100).toFixed(0)}% gates the catastrophe`), function* (c) {
    c.phase('OPEN'); c.anim('ragnarok_open'); lockAim(c); c.log('ritual: interruptible charge (poise break cancels)'); yield 1.26; c.anim('skill_loop'); yield 0.8;
    c.runner.uninterruptible = true; c.phase('COMMIT'); c.phase('ACTIVE');
    zone(c, { shape: { k: 'circle', x: c.b.pos.x, y: c.b.pos.y, r: 92 }, warn: 0.5, active: 0.22, o: { dmg: 20, kb: 400, el: 'fire' }, el: 'fire', look: 'burst', major: true, decalSize: [120, 64] }); yield 0.75;
    const a = ang(lockAim(c)), end = add(c.b.pos, fromAng(a, 280)); c.anim('ragnarok_active');
    zone(c, { shape: { k: 'capsule', x1: c.b.pos.x, y1: c.b.pos.y, x2: end.x, y2: end.y, r: 18 }, warn: 0.45, active: 0.14, o: { dmg: 40, kb: 260, el: 'fire', poise: 0 }, el: 'fire', look: 'none', major: true }); yield 0.45;
    c.shake(10); for (let r = 30; r < 280; r += 24) { const p = add(c.b.pos, fromAng(a, r)); burst(c, 'fire', p.x, p.y, 14, 0.4, false); decal(c, 'fire', p.x, p.y, 30, 16, 7); }
    for (let k = 0; k < 4; k++) {
      const off = (k % 2 ? 1 : -1) * (42 + k * 18), n = fromAng(a + Math.PI / 2, off), s = add(c.b.pos, n), e2 = add(end, n);
      zone(c, { shape: { k: 'capsule', x1: s.x, y1: s.y, x2: e2.x, y2: e2.y, r: 10 }, warn: 0.42, active: 0.12, o: { dmg: 18, kb: 200, el: 'fire' }, el: 'fire', look: 'none', major: true }); yield 0.36;
    }
    c.phase('RECOVERY'); c.anim('ragnarok_recover'); c.log('titan exhaustion window'); yield 1.2; c.phase('END');
  }, { open: '1.26s ritual + 0.8s channel (interruptible), cracks/horns ignite', active: 'P1 heat curtain r92 push; P2 descending blade fissure capsule 280px; P3 four alternating shock lanes beside the fissure with gaps', vfx: 'palette build, plasma bursts along fissure, crack decals 7s, smoke stages', end: '1.2s exhaustion', combo: 'finisher', counter: 'leave r92 early, avoid fissure axis, step between alternating lanes; poise-break during ritual', target: 'locked per phase', hitbox: 'circle, capsule, 4 lane capsules', el: 'fire' }),
];

// =============================== TYPHON ===============================
const tm_ = mk('typhon', 'mini');
function tailEnt(c: SkillCtx, side: number, delay: number, dur: number, reach: number) {
  const base = ang(c.b.facing);
  return c.spawn({ kind: 'tail', pos: c.b.pos, life: delay + dur + 0.25, lethal: true,
    update(w) { const e = this as Ent; if (e.t < delay || e.t > delay + dur) return; const pts = tailPts(c, base, side, (e.t - delay) / dur, reach); for (const p of pts.slice(3)) w.hitEnemies(c.b, c.att, { k: 'circle', x: p.x, y: p.y, r: 6 }, { dmg: 11, kb: 170, kbDir: fromAng(base + side * 0.5), el: 'force' }); e.data.pts = pts; },
    render(w) { const e = this as Ent; const k = e.t < delay ? 0 : Math.min(1, (e.t - delay) / dur); const pts = tailPts(c, base, side, k, reach); const out: Cmd[] = [{ k: 'tail', pts, x: 0, y: 0, layer: 2, el: 'force', w: 3 }]; if (e.t < delay) { const root = tailPts(c, base, side, 0, reach)[0], t0 = tailPts(c, base, side, 0, reach)[9], t1 = tailPts(c, base, side, 1, reach)[9]; const a0 = Math.atan2(t0.y - root.y, t0.x - root.x), a1 = Math.atan2(t1.y - root.y, t1.x - root.x); let sp = a1 - a0; while (sp > Math.PI) sp -= 2 * Math.PI; while (sp < -Math.PI) sp += 2 * Math.PI; out.push({ k: 'zone', shape: { k: 'sector', x: root.x, y: root.y, r: reach + 4, r0: reach * 0.3, a: a0 + sp / 2, span: Math.abs(sp) + 0.25 }, x: root.x, y: root.y, layer: 1, el: 'force', prog: Math.min(1, e.t / Math.max(0.01, delay)) }); } if (w.debug) for (const p of pts.slice(3)) out.push({ k: 'zone', shape: { k: 'circle', x: p.x, y: p.y, r: 6 }, x: 0, y: 0, layer: 3, prog: -1 }); return out; },
    danger(q, h) { const e = this as Ent; if (e.t + h < delay) return false; return tailPts(c, base, side, 0.5, reach).some((p) => dist(p, q) < 12); } });
}
function tailPts(c: SkillCtx, base: number, side: number, k: number, reach: number) {
  const pts = []; const root = add(c.b.pos, fromAng(base + Math.PI, 6)); let a = base + side * (2.6 - k * 2.4), p = root;
  for (let i = 0; i < 10; i++) { pts.push(p); a -= side * (0.1 + 0.08 * Math.sin(k * Math.PI)); p = add(p, fromAng(a, reach / 10)); }
  return pts;
}
export const TYPHON_MINI: SkillDef[] = [
  tm_('titanic_onslaught', 'Titanic Onslaught', 5, [0, 65], (ai) => W(0.9 * rangeFit(ai.d, 0, 45), 'close brawl range'), function* (c) {
    c.phase('OPEN'); c.anim('titanic_onslaught_open'); const a = ang(lockAim(c)); yield 0.2; c.phase('COMMIT'); c.anim('titanic_onslaught_active'); c.phase('ACTIVE');
    const tip = add(c.b.pos, fromAng(a, 30)); c.hitbox({ k: 'capsule', x1: c.b.pos.x, y1: c.b.pos.y, x2: tip.x, y2: tip.y, r: 8 }, 0.08, { dmg: 9, kb: 80, el: 'force' }); burst(c, 'force', tip.x, tip.y, 8, 0.2, false); yield 0.11;
    c.hitbox({ k: 'sector', x: c.b.pos.x, y: c.b.pos.y, r: 32, a: a - 0.3, span: 1.4 }, 0.08, { dmg: 10, kb: 140, el: 'force' }); yield 0.11;
    if (dist(c.tpos(), c.b.pos) < 45) { c.log('branch: target still close → stepping uppercut'); for (let t = 0; t < 0.1; t += c.w.dt) { c.move(fromAng(a), 200); yield 0; } const up = add(c.b.pos, fromAng(a, 16)); c.hitbox({ k: 'circle', x: up.x, y: up.y, r: 15 }, 0.08, { dmg: 14, kb: 260, stun: 0.3, el: 'force' }); burst(c, 'force', up.x, up.y, 14); debris(c, 'force', c.b.pos.x, c.b.pos.y, 5, 60); }
    else c.log('branch: target out of reach → no uppercut');
    yield 0.12; c.phase('RECOVERY'); c.anim('titanic_onslaught_recover'); if (!c.att.landed) { c.b.boss!.poise -= 15; c.log('miss: off-balance (poise −15)'); yield 0.5; } else yield 0.3; c.phase('END');
  }, { open: 'weight shifts to rear claws, off-hand rises', active: 'body punch → hook → optional stepping uppercut chosen from distance after punch 1; distinct reach/impulse', vfx: 'knuckle compression wake, short impact plate, foot dust', end: 'miss = off-balance (poise loss) 0.5s', combo: 'close → Crushing Grasp, long → Vortex Reversal', counter: 'bait the uppercut and hit the flank', target: 'locked_on_commit', hitbox: 'capsule 30 / sector 32 / circle 15', el: 'force' }),
  tm_('serpent_ambush', 'Serpent Ambush', 7, [0, 90], (ai) => W(0.45 + Math.min(0.5, Math.abs(ai.circling) * 1.5), `circling rate ${ai.circling.toFixed(2)} rad/s`), function* (c) {
    c.phase('OPEN'); c.anim('serpent_ambush_open'); lockAim(c); const first = (c.b.boss!.mem.lastCircle ?? 1) > 0 ? -1 : 1; c.log(`first tail: ${first < 0 ? 'left' : 'right'}`); yield 0.2;
    c.phase('COMMIT'); c.anim('serpent_ambush_active'); c.phase('ACTIVE');
    tailEnt(c, first, 0.28, 0.26, 70); tailEnt(c, -first, 0.58, 0.26, 70); yield 0.9;
    c.phase('RECOVERY'); c.anim('serpent_ambush_recover'); yield 0.3; c.phase('END');
  }, { open: 'coil behind torso; first tail coils visibly first', active: 'two tails whip with offset beat; collision circles ride the physical tail polyline (10 segments)', vfx: 'compression ribbon, sheared dust, tip flecks', end: 'tails uncoil & retract', combo: 'catches circlers', counter: 'watch which tail coils, enter gap at 0.3s offset', target: 'locked facing', hitbox: 'circles on tail points', el: 'force' }),
  tm_('crushing_grasp', 'Crushing Grasp', 8, [0, 50], (ai) => W(0.85 * rangeFit(ai.d, 0, 32) + (ai.tgt.ccImmuneUntil > ai.w.t ? -0.6 : 0), 'grab only at short range', ai.tgt.ccImmuneUntil > ai.w.t ? 'target CC-immune → low' : 'grab eligible'), function* (c) {
    c.phase('OPEN'); c.anim('crushing_grasp_open'); const a = ang(lockAim(c)); yield 0.22; c.phase('COMMIT'); c.anim('crushing_grasp_active'); c.phase('ACTIVE');
    let victim = null as null | import('./core').Actor;
    for (let t = 0; t < 0.14 && !victim; t += c.w.dt) { const hits = c.hit({ k: 'sector', x: c.b.pos.x, y: c.b.pos.y, r: 30, a, span: 1.0 }, { dmg: 2, el: 'force', grab: true }); for (const h of hits) if (c.w.tryGrab(c.b, h, 1.0)) { victim = h; break; } yield 0; }
    if (victim) {
      c.log('grab success: lift then slam'); for (let t = 0; t < 0.4; t += c.w.dt) { (c.b as any).liftH = (t / 0.4) * 14; if (victim.grabbedBy !== c.b.id) break; yield 0; }
      (c.b as any).liftH = 0; const held = victim.grabbedBy === c.b.id; c.w.release(victim);
      if (held && victim.alive) { c.w.applyHit(c.b, { ...c.att, hits: new Map() }, victim, { dmg: 18, kb: 60, stun: 0.5, el: 'force' }); burst(c, 'force', victim.pos.x, victim.pos.y, 18); debris(c, 'force', victim.pos.x, victim.pos.y, 10, 100); decal(c, 'force', victim.pos.x, victim.pos.y, 30, 16, 3); c.shake(4); }
      c.phase('RECOVERY'); yield 0.32;
    } else { c.log('grab missed: full reach, vulnerable'); c.phase('RECOVERY'); c.anim('crushing_grasp_recover'); c.b.boss!.poise -= 20; yield 0.62; }
    c.phase('END');
  }, { open: 'fingers open, hunch, palm aura', active: 'short directional grab sector; ONLY genuine collision + CC eligibility creates grabbed state; lift 0.4s then slam (capped 0.5s stun, 2s CC immunity)', vfx: 'clenched fingers, constriction sparks, floor shards', end: 'forced release on interrupt/death/scene change (World.cleanupOwner)', combo: 'after vortex pull; never repeated grab lock', counter: 'evade reach; miss gives 0.62s + poise loss', target: 'locked_on_commit', hitbox: 'sector r30 span 1.0', el: 'force' }),
  tm_('vortex_reversal', 'Vortex Reversal', 9, [0, 120], (ai) => W(0.4 + 0.4 * sm(ai.d, 40, 90) + (ai.ranged ? 0.15 : 0), 'mid range pull to reposition target'), function* (c) {
    c.phase('OPEN'); c.anim('vortex_reversal_open'); lockAim(c); yield 0.2; c.phase('COMMIT'); c.anim('vortex_reversal_active'); c.phase('ACTIVE');
    zone(c, { shape: { k: 'circle', x: c.b.pos.x, y: c.b.pos.y, r: 50 }, warn: 0.01, active: 0.1, o: { dmg: 6, kb: 280, el: 'force' }, el: 'force', look: 'burst', silentWarn: true }); yield 0.35;
    const P = v(c.b.pos.x, c.b.pos.y);
    c.spawn({ kind: 'pullfield', pos: P, life: 0.7, lethal: true, update(w) { const e = this as Ent; for (const a of w.enemiesOf(c.b)) if (dist(a.pos, P) < 110 && !a.pulls.length) w.pull(a, P, 120, 0.7 - e.t, 120); }, render() { const e = this as Ent; return [{ k: 'spr', key: `vrf${Math.floor(e.t * 12) % 24}`, make: () => vFieldRing('typhon', 110, e.t, 0.9, Math.min(1, e.t / 0.5)), x: P.x, y: P.y + 2, layer: 0 }]; }, danger(q) { return dist(q, P) < 110; } });
    debris(c, 'force', P.x, P.y, 10, -80); yield 0.7;
    if (dist(c.tpos(), c.b.pos) < 34) { c.log('target in reach → finisher'); const tip = add(c.b.pos, mul(c.aim(), 30)); c.hitbox({ k: 'capsule', x1: c.b.pos.x, y1: c.b.pos.y, x2: tip.x, y2: tip.y, r: 9 }, 0.08, { dmg: 14, kb: 220, el: 'force' }); burst(c, 'force', tip.x, tip.y, 12); } else c.log('target escaped field → no finisher');
    c.phase('RECOVERY'); c.anim('vortex_reversal_recover'); yield 0.32; c.phase('END');
  }, { open: 'palms clash then open, inhale', active: 'push blast r50 → 0.35s inhale gap → bounded pull field r110 (max 120px/s, 0.7s) → finisher ONLY if target within 34px', vfx: 'uneven raster turbulence ring shrinking, debris reversing', end: 'all impulses stop with field (pull until clamp)', combo: 'positions for punch/grab', counter: 'dash out during inhale gap', target: 'boss-centred', hitbox: 'circle + pull field + capsule', el: 'force' }),
];
const tu_ = mk('typhon', 'ultimate');
export const TYPHON_ULT: SkillDef[] = [
  tu_('continental_fist', 'Continental Fist', 10, [0, 340], (ai) => W(0.8 * rangeFit(ai.d, 30, 240), 'ground strike at target region'), function* (c) {
    c.phase('OPEN'); c.anim('continental_fist_open'); lockAim(c); yield 0.3;
    const d = Math.min(220, dist(c.tpos(), c.b.pos)), P = add(c.b.pos, mul(c.aim(), d)); c.phase('COMMIT');
    zone(c, { shape: { k: 'circle', x: P.x, y: P.y, r: 42 }, warn: 0.6, active: 0.12, o: { dmg: 30, kb: 280, el: 'force', poise: 0 }, el: 'force', look: 'burst', major: true, decalSize: [64, 34], onActive: () => { c.shake(8); debris(c.w, 'force', P.x, P.y, 26, 160, 3); } });
    c.spawn({ kind: 'fistshadow', pos: P, life: 0.75, update() {}, render() { const e = this as Ent, k = Math.min(1, e.t / 0.6); return [{ k: 'spr', key: `cf${Math.round(k * 4)}`, make: () => vFist('force', 24, Math.PI / 2), x: P.x, y: P.y - (1 - k) * 120 - 10, layer: 3 }]; } });
    yield 0.6; c.anim('continental_fist_active'); c.phase('ACTIVE');
    zone(c, { shape: { k: 'ring', x: P.x, y: P.y, r0: 52, r1: 70 }, warn: 0.35, active: 0.1, o: { dmg: 14, kb: 200, el: 'force' }, el: 'force', look: 'none' });
    zone(c, { shape: { k: 'ring', x: P.x, y: P.y, r0: 104, r1: 122 }, warn: 0.85, active: 0.1, o: { dmg: 12, kb: 180, el: 'force' }, el: 'force', look: 'none' });
    yield 0.4; c.phase('RECOVERY'); c.anim('continental_fist_recover'); yield 0.64; c.phase('END');
  }, { open: 'arm retracts, shoulder twists, fist shadow eclipses region', active: 'impact r42 at locked point, then two separated wavefront rings (52–70 @+0.35s, 104–122 @+0.85s) — roll between them', vfx: 'pressure petals, 26 ballistic chips, settling dust decal', end: 'arm unsticks 0.64s', combo: 'Rampage to punish passivity', counter: 'avoid fist, traverse wave gap', target: 'locked_on_commit point', hitbox: 'circle + 2 rings', el: 'force' }),
  tu_('titans_rampage', "Titan's Rampage", 12, [80, 900], (ai) => W(0.4 + 0.5 * sm(ai.d, 150, 400), `long range ${ai.d.toFixed(0)}px → rush`), function* (c) {
    c.phase('OPEN'); c.anim('titans_rampage_open'); let head = ang(lockAim(c)); yield 0.26; c.phase('COMMIT'); c.anim('titans_rampage_active'); c.phase('ACTIVE');
    const legs = c.b.boss!.phase2 ? 4 : 3;
    for (let l = 0; l < legs; l++) {
      const want = ang(sub(c.tpos(), c.b.pos)), d = angDiff(head, want); head += Math.max(-0.9, Math.min(0.9, d)); c.log(`leg ${l + 1}: checkpoint turn ${(Math.max(-0.9, Math.min(0.9, d))).toFixed(2)} rad`);
      c.face(fromAng(head)); { const hd = fromAng(head); tele(c, { k: 'capsule', x1: c.b.pos.x, y1: c.b.pos.y, x2: c.b.pos.x + hd.x * 180, y2: c.b.pos.y + hd.y * 180, r: 30 }, 0.22, 'force', true); } yield 0.22; c.hitbox(() => ({ k: 'circle', x: c.b.pos.x, y: c.b.pos.y, r: 30 }), 0.6, { dmg: 20, kb: 320, maxHits: 2, rehit: 0.6, el: 'force' });
      for (let t = 0; t < 0.6; t += c.w.dt) { c.move(fromAng(head), 300); if (Math.floor(t * 10) !== Math.floor((t - c.w.dt) * 10)) decal(c, 'force', c.b.pos.x, c.b.pos.y + 10, 20, 10, 2.5); yield 0; }
      zone(c, { shape: { k: 'circle', x: c.b.pos.x, y: c.b.pos.y, r: 54 }, warn: 0.1, active: 0.1, o: { dmg: 10, kb: 200, el: 'force' }, el: 'force', look: 'burst' }); c.shake(5); yield 0.15;
    }
    c.phase('RECOVERY'); c.anim('titans_rampage_recover'); yield c.att.landed ? 0.5 : 1.0; c.phase('END');
  }, { open: 'stomping acceleration, tail coil, heading chosen', active: '3–4 charge legs; heading changes only at checkpoints, ±0.9 rad max (can misjudge)', vfx: 'pressure contrails, heel-crack decals, skid spray', end: '1.0s punish if last leg misses', combo: 'leaves target in Continental Fist range (no auto-aim)', counter: 'change direction after a leg commits', target: 'checkpoint steering', hitbox: 'r30 body + r54 leg-end burst', el: 'force' }),
  tu_('maelstrom_grip', 'Maelstrom Grip', 14, [0, 420], (ai) => W(0.45 + 0.35 * sm(ai.d, 80, 250), 'trap setup at range'), function* (c) {
    c.phase('OPEN'); c.anim('maelstrom_grip_open'); const a = lockAim(c); yield 0.3; c.phase('COMMIT'); c.phase('ACTIVE'); c.anim('maelstrom_grip_active');
    const P = add(c.b.pos, mul(a, 130));
    c.spawn({ kind: 'pullfield', pos: P, life: 1.6, lethal: true, update(w) { for (const t of w.enemiesOf(c.b)) if (dist(t.pos, P) < 160 && !t.pulls.length) w.pull(t, P, 70, 0.3, 70); }, render() { const e = this as Ent; return [{ k: 'spr', key: `mgf${Math.floor(e.t * 12) % 24}`, make: () => vFieldRing('typhon', 160, e.t, 1, Math.min(1, e.t / 0.6)), x: P.x, y: P.y + 2, layer: 0 }]; }, danger(q) { return dist(q, P) < 120; } });
    yield 1.2; const lock = c.tpos(); c.log('orb hurled at locked point');
    proj(c, { pos: add(c.b.pos, v(0, -40)), vel: mul(norm(sub(lock, c.b.pos)), 260), r: 12, ttl: Math.min(2, dist(lock, c.b.pos) / 260), o: { dmg: 22, kb: 260, el: 'force' }, el: 'force', sprite: (_a, t) => ({ key: `mo${Math.floor(t * 10) % 4}`, make: () => vOrb('force', 12, Math.floor(t * 10)) }), onEnd: (p) => { zone(c, { shape: { k: 'circle', x: p.x, y: p.y, r: 48 }, warn: 0.01, active: 0.12, o: { dmg: 20, kb: 240, el: 'force' }, el: 'force', look: 'burst', silentWarn: true, decalSize: [60, 30] }); debris(c.w, 'force', p.x, p.y, 20, 140, 3); } });
    yield 0.6; c.phase('RECOVERY'); c.anim('maelstrom_grip_recover'); yield 0.56; c.phase('END');
  }, { open: 'hands spread, vortex condenses; inward debris shows pull vector', active: 'bounded attraction field r160 (≤70px/s, 1.6s); orb condensed and hurled at point locked at 1.5s', vfx: 'non-circular dust bands, chipped violet orb, breakup', end: 'field ends before orb impact', combo: 'setup for Worldbreaker', counter: 'outrun edge, dodge orb after lock', target: 'lock at throw', hitbox: 'pull field + projectile r12 + impact r48', el: 'force' }),
  tu_('worldbreaker_descent', 'Worldbreaker Descent', 22, [0, 800], (ai) => W(ai.hpFrac < 0.75 ? 0.8 : 0.3, 'finisher gated by hp'), function* (c) {
    c.phase('OPEN'); c.anim('worldbreaker_descent_open'); lockAim(c); yield 0.64; c.phase('COMMIT'); c.anim('worldbreaker_descent_active'); c.phase('ACTIVE');
    (c.b as any).air = 1; c.runner.uninterruptible = true; yield 0.4;
    const P = c.valid(c.tpos(), c.b.r) || c.b.pos; c.log('impact area locked');
    zone(c, { shape: { k: 'circle', x: P.x, y: P.y, r: 70 }, warn: 1.3, active: 0.14, o: { dmg: 40, kb: 340, el: 'force', poise: 0 }, el: 'force', look: 'burst', major: true, decalSize: [110, 56], onActive: () => { c.b.pos = v(P.x, P.y); (c.b as any).air = 0; c.shake(12); debris(c.w, 'force', P.x, P.y, 36, 200, 4); } });
    yield 1.44;
    for (let i = 0; i < 3; i++) zone(c, { shape: { k: 'ring', x: P.x, y: P.y, r0: 90 + i * 60, r1: 110 + i * 60 }, warn: 0.4 + i * 0.5, active: 0.1, o: { dmg: 14, kb: 200, el: 'force' }, el: 'force', look: 'none', major: true });
    for (let i = 0; i < 8; i++) { const q = add(P, fromAng(c.rnd() * 6.28, 60 + c.rnd() * 170)); if (c.valid(q, 8) && c.w.pressure(c.tpos(), 40, 1) < 0.6) zone(c, { shape: { k: 'circle', x: q.x, y: q.y, r: 16 }, warn: 0.9 + i * 0.12, active: 0.1, o: { dmg: 12, el: 'force' }, el: 'force', look: 'burst', decalSize: [24, 12] }); }
    c.phase('RECOVERY'); c.anim('worldbreaker_descent_recover'); yield 1.2; c.phase('END');
  }, { open: 'crouch, tails coil, launch distortion', active: 'airborne (no body collision), impact area locked 0.4s after launch, 1.3s growing shadow; impact r70 → 3 separated rings → 8 boulders each with own time', vfx: 'takeoff, falling silhouette, ballistic debris, fracture decal settles', end: 'two-beat 1.2s recovery', combo: 'finisher', counter: 'vacate shadow, read ring timings', target: 'locked area', hitbox: 'circle, rings, boulder circles', el: 'force' }),
];
export { vFlame, vRock, vDot, hitTest, len, QN };
export type { Shape };
