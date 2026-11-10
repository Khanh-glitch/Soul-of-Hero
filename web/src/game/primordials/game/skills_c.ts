import { SkillDef, SkillCtx, Cmd, Ent, V, v, add, mul, norm, sub, dist, fromAng, ang, rot, angDiff, hitTest } from './core';
import { zone, burst, debris, decal, sweep, proj, lockAim, rangeFit, sm, beam, tele } from './helpers';
import { mk } from './skills_a';
import { vEyeV2 as vEye, vLance, vGhostV2 as vGhost, vSeal, vPortalV2 as vPortal, vGhostOf, vDot, vFieldRing } from '../art/vfx';
import { dir4 } from './core';

const W = (s: number, ...why: string[]) => ({ s, why });
const lance = (a: number) => vLance('mind', a, 18);

// ---------- ARGUS: eye nodes with explicit roles ----------
function eyeNode(c: SkillCtx, p: V, role: 'real' | 'fake' | 'surveil', fireAt: number, fire: (e: Ent, dir: V) => void, life: number, size = 6, teleLen = 260) {
  const mem = c.b.boss!.mem; mem.eyes = (mem.eyes || []).filter((e: any) => e.until > c.t);
  if (mem.eyes.length >= (c.U ? 10 : 5)) { c.log('ocular budget reached: node skipped'); return null; }
  const id = Math.floor(c.rnd() * 1e9); mem.eyes.push({ id, role, until: c.t + life, x: p.x | 0, y: p.y | 0 });
  let look = norm(sub(c.tpos(), p)), locked = false;
  return c.spawn({ kind: 'eye', pos: p, life, lethal: role === 'real', data: { role }, update() { const e = this as Ent; if (!locked) look = norm(sub(c.tpos(), p)); if (e.t >= fireAt - 0.12 && !locked) locked = true; if (e.t >= fireAt && !e.data.f) { e.data.f = 1; if (role === 'real') fire(e, look); else { c.w.ev({ t: c.w.t, type: 'branch', skill: c.skill.id, note: `fake eye #${id} fizzles (no hitbox)` }); } } },
    render() { const e = this as Ent, open = Math.min(1, e.t / 0.3) * (e.t > life - 0.25 ? Math.max(0, (life - e.t) / 0.25) : 1), ch = Math.max(0, Math.min(1, (e.t - (fireAt - 0.6)) / 0.6)) * (e.data.f ? 0 : 1); const out: Cmd[] = [{ k: 'spr', key: `ey${size}${open.toFixed(1)}${look.x.toFixed(1)}${look.y.toFixed(1)}${ch.toFixed(1)}${role === 'real'}`, make: () => vEye(size, open, look.x, look.y, ch, role === 'real'), x: p.x, y: p.y, layer: 3 }]; if (role === 'real' && teleLen > 0 && !e.data.f && e.t > fireAt - 0.6) out.push({ k: 'zone', shape: { k: 'capsule', x1: p.x, y1: p.y, x2: p.x + look.x * teleLen, y2: p.y + look.y * teleLen, r: 4 }, x: p.x, y: p.y, layer: 1, el: 'mind', prog: (e.t - (fireAt - 0.6)) / 0.6 }); return out; },
    danger(q, h) { const e = this as Ent; return role === 'real' && !e.data.f && e.t + h > fireAt && Math.abs((q.x - p.x) * look.y - (q.y - p.y) * look.x) < 10; } });
}
const gm_ = mk('argus', 'mini');
export const ARGUS_MINI: SkillDef[] = [
  gm_('piercing_gaze', 'Piercing Gaze', 6, [0, 320], (ai) => W(0.55 + 0.3 * sm(ai.d, 60, 200), 'line-of-sight beam'), function* (c) {
    c.phase('OPEN'); c.anim('piercing_gaze_open'); let dir = lockAim(c); const eye = () => add(c.b.pos, v(0, -30));
    c.spawn({ kind: 'glimmer', pos: c.b.pos, life: 0.4, update() { dir = norm(sub(c.predict(0.15), eye())); c.face(dir); }, render() { const e = this as Ent, p = eye(), q = add(p, mul(dir, 320)); return Math.floor(e.t * 20) % 2 ? [{ k: 'beam', x: p.x, y: p.y, x2: q.x, y2: q.y, w: 0, el: 'mind', layer: 3 }] : []; } }); yield 0.4;
    c.phase('COMMIT'); const locked = v(dir.x, dir.y); c.log('gaze vector locked'); yield 0.06;
    c.anim('piercing_gaze_active'); c.phase('ACTIVE'); beam(c, eye(), locked, 320, 8, 0.22, { dmg: 16, kb: 100, el: 'mind', maxHits: 1 }, 'mind'); yield 0.24;
    c.phase('RECOVERY'); c.anim('piercing_gaze_recover'); yield 0.32; c.phase('END');
  }, { open: 'central eye dilates; thin flickering pupil glimmer tracks predicted position (non-damaging)', active: 'vector locks, 0.06s beat, then a 0.22s razor beam along the committed line (raycast-clipped by obstacles)', vfx: 'stepped core beam stamps, contact flash', end: 'iris contracts, fatigue blink', combo: 'forces target toward Oracle Lances', counter: 'sidestep after lock; obstacles block', target: 'locked_on_commit', hitbox: 'capsule r4 × 320', el: 'mind' }),
  gm_('oracle_lances', 'Oracle Lances', 8, [60, 420], (ai) => W(0.5 + 0.3 * sm(ai.d, 80, 240) + (ai.lastResult.piercing_gaze === 'miss' ? 0.15 : 0), 'staged waves current/predicted/flank'), function* (c) {
    c.phase('OPEN'); c.anim('oracle_lances_open'); lockAim(c); const early = c.predict(0.6); yield 0.22; c.phase('COMMIT'); c.anim('oracle_lances_active'); c.phase('ACTIVE');
    const fire = (from: V, to: V, delay: number) => proj(c, { pos: from, vel: mul(norm(sub(to, from)), 280), r: 4, ttl: 1.5, delay, o: { dmg: 9, kb: 90, el: 'mind' }, el: 'mind', trail: true, sprite: (a) => ({ key: `ol${a.toFixed(1)}`, make: () => lance(a) }) });
    const B = c.b.pos; for (let i = 0; i < 2; i++) fire(add(B, v((i - 0.5) * 16, -20)), c.tpos(), i * 0.08); c.log('wave 1 → current position'); yield 0.3;
    for (let i = 0; i < 2; i++) fire(add(B, v((i - 0.5) * 22, -26)), early, i * 0.08); c.log('wave 2 → path predicted at OPEN'); yield 0.3;
    const T = c.tpos(), lat = fromAng(ang(sub(T, B)) + Math.PI / 2); for (const s of [1, -1]) { const p = c.valid(add(T, mul(lat, 70 * s)), 4); if (p) fire(p, T, 0.15); } c.log('wave 3 → flank crossfire');
    yield 0.3; c.phase('RECOVERY'); c.anim('oracle_lances_recover'); yield 0.3; c.phase('END');
  }, { open: 'golden lances assemble behind Argus', active: '3 waves: current position, path predicted at OPEN (past samples), flank crossfire from lateral offsets; each a real projectile with its own spawn time', vfx: 'line-by-line crystallisation, launch snap, shard burst', end: 'energy fades', combo: 'after a gaze lock', counter: 'use wave gaps; no indefinite homing', target: 'locked per wave', hitbox: 'projectiles r4', el: 'mind' }),
  gm_('false_witnesses', 'False Witnesses', 11, [0, 420], (ai) => W(0.55, 'divide attention'), function* (c) {
    c.phase('OPEN'); c.anim('false_witnesses_open'); lockAim(c); yield 0.22; c.phase('COMMIT'); c.anim('false_witnesses_active'); c.phase('ACTIVE');
    const T = c.tpos(), roles = (['real', 'real', 'fake', 'fake'] as const).slice().sort(() => c.rnd() - 0.5);
    roles.forEach((role, i) => { const p = c.valid(add(T, fromAng(i * 1.57 + c.rnd() * 0.6, 90)), 6); if (!p) return; eyeNode(c, p, role, 0.9 + i * 0.25, (e, d) => { beam(c, e.pos, d, 260, 7, 0.2, { dmg: 12, kb: 90, el: 'mind', maxHits: 1 }, 'mind'); }, 1.6 + i * 0.25); });
    c.log(`roles: ${roles.join(',')} (real = pupil contracts + white core)`); yield 1.9;
    c.phase('RECOVERY'); c.anim('false_witnesses_recover'); yield 0.3; c.phase('END');
  }, { open: 'crown/shoulder clusters unfold', active: '4 nodes, 2 real/2 fake (seeded). Real tell: contracting pupil + white-hot cross core; fakes show flat iris; only real nodes fire beams', vfx: 'eyelid lashes, layered aperture, brittle breakup', end: 'all nodes time out; fake cues removed with them', combo: 'precedes lances', counter: 'learn the genuine charge cue', target: 'locked 0.12s before fire', hitbox: 'beams r3.5', el: 'mind' }),
  gm_('psychic_command', 'Psychic Command', 9, [0, 230], (ai) => W(0.45 + 0.3 * rangeFit(ai.d, 30, 160), 'push / short slow to open a firing window'), function* (c) {
    c.phase('OPEN'); c.anim('psychic_command_open'); const a = lockAim(c); const end = c.tpos();
    c.spawn({ kind: 'ribbon', pos: c.b.pos, life: 0.3, update() {}, render() { const p = add(c.b.pos, v(0, -20)); return [{ k: 'beam', x: p.x, y: p.y, x2: end.x, y2: end.y, w: 0, el: 'mind', layer: 3 }, { k: 'spr', key: 'pce', make: () => vDot('mind', 2, 0), x: end.x, y: end.y, layer: 3 }]; } }); yield 0.3;
    c.phase('COMMIT'); c.anim('psychic_command_active'); c.phase('ACTIVE');
    zone(c, { shape: { k: 'sector', x: c.b.pos.x, y: c.b.pos.y, r: 170, a: ang(a), span: 0.6 }, warn: 0.05, active: 0.12, o: { dmg: 6, kb: 160, slow: [0.6, 1.0], el: 'mind' }, el: 'mind', look: 'none', silentWarn: true });
    burst(c, 'mind', end.x, end.y, 14); yield 0.18; c.phase('RECOVERY'); c.anim('psychic_command_recover'); yield 0.3; c.phase('END');
  }, { open: 'secondary eye projects a narrow targeting ribbon with endpoint', active: 'narrow amber fan r170: push + slow ×0.6 for ≤1.0s (no control inversion, no sticky debuffs)', vfx: 'directional fan, thought fractals, halo fragments', end: 'slow expires, eye blinks shut', combo: 'opens a window; follow-ups have their own anticipation', counter: 'dodge the ribbon line', target: 'locked at OPEN end', hitbox: 'sector', el: 'mind' }),
];
const gu_ = mk('argus', 'ultimate');
export const ARGUS_ULT: SkillDef[] = [
  gu_('eyes_of_heaven', 'Eyes of Heaven', 12, [0, 1000], (ai) => W(0.6, 'distributed ocular battery'), function* (c) {
    c.phase('OPEN'); c.anim('eyes_of_heaven_open'); lockAim(c); yield 0.3; c.phase('COMMIT'); c.anim('eyes_of_heaven_active'); c.phase('ACTIVE');
    for (let i = 0; i < 6; i++) { const p = c.valid(add(c.tpos(), fromAng(c.rnd() * 6.28, 160 + c.rnd() * 100)), 8); if (!p) continue; const pulse = i % 3 === 2; eyeNode(c, p, 'real', 0.8 + i * 0.45, (e, d) => { if (pulse) zone(c, { shape: { k: 'circle', x: e.pos.x, y: e.pos.y, r: 40 }, warn: 0.3, active: 0.12, o: { dmg: 12, el: 'mind' }, el: 'mind', look: 'burst' }); else beam(c, e.pos, d, 420, 10, 0.3, { dmg: 16, kb: 120, el: 'mind', maxHits: 1 }, 'mind'); }, 1.4 + i * 0.45, 10, pulse ? 0 : 420); }
    yield 3.2; c.phase('RECOVERY'); c.anim('eyes_of_heaven_recover'); yield 0.5; c.phase('END');
  }, { open: 'colossal eyes unfurl in an irregular constellation', active: '6 nodes fire coordinated beams/pulses 0.45s apart, each vector locked 0.12s before firing', vfx: 'eyelid fold-open, golden slit, thick ray stamps', end: 'staggered shut', combo: 'with Spearfield', counter: 'move between channels', target: 'per node lock', hitbox: 'beam r5 / pulse r40', el: 'mind' }),
  gu_('sovereign_spearfield', 'Sovereign Spearfield', 14, [0, 1000], (ai) => W(0.55, 'area + line denial'), function* (c) {
    c.phase('OPEN'); c.anim('sovereign_spearfield_open'); lockAim(c); yield 0.3; c.phase('COMMIT'); c.anim('sovereign_spearfield_active'); c.phase('ACTIVE');
    for (let k = 0; k < 4; k++) {
      const T = c.predict(0.5);
      if (k % 2 === 0) { const safe = Math.floor(c.rnd() * 9); for (let i = 0; i < 9; i++) { if (i === safe) continue; const p = add(T, v(((i % 3) - 1) * 34, (Math.floor(i / 3) - 1) * 34)); if (c.valid(p, 4)) zone(c, { shape: { k: 'circle', x: p.x, y: p.y, r: 15 }, warn: 0.7, active: 0.1, o: { dmg: 14, el: 'mind' }, el: 'mind', look: 'burst', decalSize: [18, 10] }); } c.log(`plunge grid, safe cell ${safe}`); }
      else { const a = c.rnd() * 6.28, d = fromAng(a), n = fromAng(a + Math.PI / 2), gap = Math.floor(c.rnd() * 6); for (let i = 0; i < 6; i++) { if (i === gap) continue; const from = add(add(T, mul(d, -260)), mul(n, (i - 2.5) * 30)); proj(c, { pos: from, vel: mul(d, 260), r: 4, ttl: 2.2, o: { dmg: 14, el: 'mind' }, el: 'mind', trail: true, sprite: (aa) => ({ key: `sl${aa.toFixed(1)}`, make: () => lance(aa) }) }); } c.log(`horizontal barrage, gap ${gap}`); }
      yield 0.9;
    }
    c.phase('RECOVERY'); c.anim('sovereign_spearfield_recover'); yield 0.5; c.phase('END');
  }, { open: 'spear tranches form in the sky', active: 'alternating vertical plunge grids (one safe cell) and horizontal lance walls (one gap); schedule from observed running, committed spears never reassigned', vfx: 'engraved spears, impact light, shard decals', end: 'next formation only after lanes clear', combo: 'eyes pressure while spears land', counter: 'read formation, use the gap', target: 'predicted lane per barrage', hitbox: 'circles r15 / projectiles', el: 'mind' }),
  gu_('dominion_of_sight', 'Dominion of Sight', 15, [0, 800], (ai) => W(0.5 + 0.2 * sm(ai.d, 100, 400), 'surveillance lock-on'), function* (c) {
    c.phase('OPEN'); c.anim('dominion_of_sight_open'); lockAim(c); yield 0.3; c.phase('COMMIT'); c.anim('dominion_of_sight_active'); c.phase('ACTIVE');
    let lockT = 0, fa = ang(c.b.facing), fired = 0;
    for (let t = 0; t < 3.2; t += c.w.dt) {
      const want = ang(sub(c.tpos(), c.b.pos)); fa += Math.max(-0.6 * c.w.dt, Math.min(0.6 * c.w.dt, angDiff(fa, want))); c.face(fromAng(fa));
      const cone = { k: 'sector' as const, x: c.b.pos.x, y: c.b.pos.y, r: 320, a: fa, span: 0.8 }, tg = c.tgt();
      const seen = tg && hitTest(cone, tg.pos, tg.r) && !c.w.map.raycast(c.b.pos, tg.pos).hit;
      lockT = seen ? lockT + c.w.dt : Math.max(0, lockT - c.w.dt * 2);
      if (lockT > 1.0 && fired < 3) { fired++; lockT = 0.4; c.log(`target marked → support eye ${fired}`); const p = c.valid(add(c.tpos(), fromAng(c.rnd() * 6.28, 120)), 6); if (p) eyeNode(c, p, 'real', 0.6, (e, d) => beam(c, e.pos, d, 300, 8, 0.25, { dmg: 15, el: 'mind', maxHits: 1 }, 'mind'), 1.0, 8, 300); }
      if (Math.floor(t * 10) !== Math.floor((t - c.w.dt) * 10)) c.w.add({ id: -9, kind: 'cone', owner: c.b.id, pos: c.b.pos, t: 0, life: 0.1, dead: false, lethal: false, policy: 'owned', data: {}, update() {}, render() { const out: Cmd[] = [{ k: 'zone', shape: cone, x: 0, y: 0, layer: 1, el: 'mind', prog: Math.min(1, lockT) }]; if (tg) out.push({ k: 'spr', key: `dgr${Math.floor(c.w.t * 12) % 24}`, make: () => vFieldRing('argus', 34, c.w.t, 0.6 + lockT, Math.min(1, lockT)), x: tg.pos.x, y: tg.pos.y + 2, layer: 0 }); return out; } } as Ent);
      yield 0;
    }
    c.log('lock expired explicitly'); c.phase('RECOVERY'); c.anim('dominion_of_sight_recover'); yield 0.5; c.phase('END');
  }, { open: 'immense eye opens; mobile cone', active: 'cone turns ≤0.6 rad/s; lock accrues only while target is inside AND unobstructed; at 1.0s lock a support eye fires at the position locked 0.12s before; breaking sight decays lock ×2', vfx: 'gaze curtain outline, stepped pupil, chevron eyes', end: 'explicit lock expiry', combo: 'setup for Judgment', counter: 'leave the cone / break line of sight', target: 'cone tracking (explicit)', hitbox: 'support beams', el: 'mind', sustained: true } as SkillDef['doc']),
  gu_('omniscient_judgment', 'Omniscient Judgment', 28, [0, 900], (ai) => W(ai.hpFrac < 0.7 ? 0.9 : 0.3, 'catastrophe gated by hp'), function* (c) {
    c.phase('OPEN'); c.anim('omniscient_judgment_open'); lockAim(c); yield 1.14; c.runner.uninterruptible = true; c.phase('COMMIT'); c.anim('omniscient_judgment_active'); c.phase('ACTIVE');
    for (let i = 0; i < 8; i++) { const T = c.tpos(), p = add(T, fromAng((i / 8) * 6.283, 210)); proj(c, { pos: p, vel: mul(norm(sub(T, p)), 230), r: 5, ttl: 1.6, delay: i * 0.1, major: true, o: { dmg: 12, el: 'mind' }, el: 'mind', trail: true, sprite: (aa) => ({ key: `oj${aa.toFixed(1)}`, make: () => lance(aa) }) }); }
    c.log('PHASE 1 peripheral volley'); yield 1.2;
    const C = c.tpos(), angs = [0, 1, 2].map((i) => i * 1.05 + c.rnd() * 0.3); for (let i = 0; i < 3; i++) { const d = fromAng(angs[i], 280), from = add(C, mul(d, -1)); tele(c, { k: 'capsule', x1: from.x, y1: from.y, x2: C.x + d.x, y2: C.y + d.y, r: 5 }, 0.7, 'mind', true); }
    yield 0.7; for (let i = 0; i < 3; i++) { const d = fromAng(angs[i], 280), from = add(C, mul(d, -1)); beam(c, from, d, 560, 10, 1.2, { dmg: 9, rehit: 0.45, maxHits: 2, el: 'mind' }, 'mind'); }
    c.log('PHASE 2 intersecting sustained lanes (capped cadence)'); yield 1.3;
    const eye = add(c.b.pos, v(0, -50)), d = norm(sub(c.tpos(), eye)); tele(c, { k: 'capsule', x1: eye.x, y1: eye.y, x2: eye.x + d.x * 700, y2: eye.y + d.y * 700, r: 20 }, 1.0, 'mind', true); yield 1.0;
    beam(c, eye, d, 700, 40, 0.4, { dmg: 45, kb: 300, maxHits: 1, el: 'mind' }, 'mind'); c.shake(8); c.log('PHASE 3 central laser on fixed vector'); yield 0.5;
    c.phase('RECOVERY'); c.anim('omniscient_judgment_recover'); yield 1.4; c.phase('END');
  }, { open: 'all eyes close, central eye swells to eclipse (1.14s)', active: 'P1 8 peripheral lances from distinct directions; P2 three telegraphed sustained lanes (rehit 0.45, max 2); P3 1.0s-telegraphed 40px central laser on a fixed vector', vfx: 'iris contractions, filament beams, final blink', end: '1.4s recovery', combo: 'may use existing nodes but never assumes them', counter: 'take the flank of the last central lock', target: 'per phase lock', hitbox: 'projectiles, capsules', el: 'mind' }),
];

// ---------- ANUBIS ----------
function chainShot(c: SkillCtx, from: () => V, dir: V, range: number, speed: number, onHit: (t: import('./core').Actor) => void, anchorStatic?: V) {
  const att = c.att; let head = anchorStatic ? v(anchorStatic.x, anchorStatic.y) : from(), out = 0, state: 'out' | 'back' = 'out', hitDone = false;
  return c.spawn({ kind: 'chain', pos: head, life: (range / speed) * 2 + 0.5, lethal: true,
    update(w, dt) { const e = this as Ent; const o = anchorStatic ?? from(); if (state === 'out') { out += speed * dt; if (out >= range) state = 'back'; } else { out -= speed * 1.5 * dt; if (out <= 0) e.dead = true; } head = add(o, mul(dir, out)); e.pos = head; if (w.map.raycast(o, head).hit) state = 'back';
      if (state === 'out' && !hitDone) { const hs = w.hitEnemies(c.b, att, { k: 'circle', x: head.x, y: head.y, r: 6 }, { dmg: 7, el: 'soul' }); if (hs.length) { hitDone = true; state = 'back'; onHit(hs[0]); } } },
    render() { const o = anchorStatic ?? from(); return [{ k: 'chain', x: o.x, y: o.y, x2: head.x, y2: head.y, el: 'soul', layer: 3 }]; },
    danger(q, h) { const o = anchorStatic ?? from(); const far = add(o, mul(dir, range)); return h > 0.1 && Math.abs((q.x - o.x) * dir.y - (q.y - o.y) * dir.x) < 10 && dist(q, o) < dist(far, o); } });
}
function summonWraith(c: SkillCtx, near: V, cap: number): boolean {
  const mem = c.b.boss!.mem; mem.summons = (mem.summons || []).filter((id: number) => c.w.actor(id)?.alive);
  if (mem.summons.length >= cap) { c.log(`summon cap ${cap} reached`); return false; }
  const p = c.valid(add(near, fromAng(c.rnd() * 6.28, 34)), 7); if (!p || c.w.map.raycast(near, p).hit) { c.log('summon spawn rejected (blocked)'); return false; }
  const P = v(p.x, p.y); const variant = Math.floor(c.rnd() * 3);
  c.spawn({ kind: 'birth', pos: P, life: 0.6, update() {}, render() { const e = this as Ent, st = Math.floor(e.t / 0.2); return st === 0 ? [{ k: 'spr', key: 'wb0', make: () => vDot('soul', 2, 0), x: P.x, y: P.y - 6, layer: 3 }] : [{ k: 'spr', key: `wb${st}${variant}`, make: () => vGhost(st, variant), x: P.x, y: P.y - 10, layer: 3, alpha: st === 1 ? 0.5 : 1 }]; } });
  const s = c.w.spawnActor({ kind: 'summon', team: 'boss', pos: P, name: 'wraith', r: 6, hp: 30, maxHp: 30, speed: 70, summon: { owner: c.b.id, until: c.t + 10.6, atkCd: 1.2, dmg: 6, el: 'soul', variant } });
  s.stunUntil = c.t + 0.6; mem.summons.push(s.id); c.w.ev({ t: c.t, type: 'summon', src: c.b.id, tgt: s.id, note: `wraith (${mem.summons.length}/${cap})` });
  return true;
}
function wavefront(c: SkillCtx, start: V, dir: V, span: number, travel: number, speed: number, gapAt: number, gapW: number, dmg: number, delay: number) {
  const n = fromAng(ang(dir) + Math.PI / 2), att = { id: Math.floor(c.rnd() * 1e9), skill: c.skill.id + ':wave', owner: c.b.id, hits: new Map(), t0: c.t, landed: 0 };
  const segs: [number, number][] = [[-span / 2, gapAt - gapW / 2], [gapAt + gapW / 2, span / 2]];
  return c.w.add({ id: att.id, kind: 'wave', owner: c.b.id, att, pos: start, t: 0, life: delay + travel / speed, dead: false, lethal: true, major: true, policy: 'owned', data: {},
    update(w) { const e = this as Ent; if (e.t < delay) return; const ctr = add(start, mul(dir, (e.t - delay) * speed)); e.pos = ctr; for (const [a, b] of segs) { const p1 = add(ctr, mul(n, a)), p2 = add(ctr, mul(n, b)); w.hitEnemies(c.b, att, { k: 'capsule', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, r: 10 }, { dmg, kb: 130, kbDir: dir, el: 'soul' }); } },
    render(w) { const e = this as Ent, out: Cmd[] = []; const ctr = add(start, mul(dir, Math.max(0, e.t - delay) * speed)); const fr = Math.floor(e.t * 8); for (const [a, b] of segs) for (let s = a; s <= b; s += 12) for (let rank = 0; rank < (w.quality === 'maximum_vfx' ? 3 : 1); rank++) { const p = add(add(ctr, mul(n, s)), mul(dir, -rank * 14)); out.push({ k: 'spr', key: `wg${(fr + rank) % 4}${(Math.round(s) + rank) % 3}`, make: () => vGhost(fr + rank, Math.abs(Math.round(s / 12) + rank) % 3), x: p.x, y: p.y - 10, layer: 2, z: p.y, alpha: e.t < delay ? 0.35 : rank ? 0.6 : 1 }); } return out; },
    danger(q, h) { const e = this as Ent; for (let t = e.t; t < e.t + h; t += 0.1) { const ctr = add(start, mul(dir, Math.max(0, t - delay) * speed)); for (const [a, b] of segs) { const p1 = add(ctr, mul(n, a)), p2 = add(ctr, mul(n, b)); if (hitTest({ k: 'capsule', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, r: 12 }, q, 4)) return true; } } return false; } } as Ent);
}
const nm_ = mk('anubis', 'mini');
export const ANUBIS_MINI: SkillDef[] = [
  nm_('reapers_dance', "Reaper's Dance", 6, [0, 75], (ai) => W(0.9 * rangeFit(ai.d, 0, 55), 'three-hit scythe chain'), function* (c) {
    c.phase('OPEN'); c.anim('reapers_dance_open'); const a = ang(lockAim(c)); yield 0.17; c.phase('COMMIT'); c.anim('reapers_dance_active'); c.phase('ACTIVE');
    sweep(c, 42, a - 1.0, a + 0.6, 0.1, { dmg: 8, kb: -60, el: 'soul' }, 'soul', 5); yield 0.12;
    sweep(c, 44, a + 1.2, a - 1.2, 0.1, { dmg: 9, kb: 100, el: 'soul' }, 'soul', 5); yield 0.12;
    if (dist(c.tpos(), c.b.pos) < 40) { c.log('branch: close → spinning 360'); sweep(c, 44, a, a + 6.2, 0.18, { dmg: 12, kb: 160, el: 'soul' }, 'soul', 6); }
    else { c.log('branch: far → forward lunge'); const d = fromAng(a), st = v(c.b.pos.x, c.b.pos.y); c.hitbox(() => ({ k: 'capsule', x1: st.x, y1: st.y, x2: c.b.pos.x + d.x * 20, y2: c.b.pos.y + d.y * 20, r: 8 }), 0.14, { dmg: 13, kb: 150, el: 'soul' }); for (let t = 0; t < 0.12; t += c.w.dt) { c.move(d, 380); yield 0; } }
    yield 0.14; c.phase('RECOVERY'); c.anim('reapers_dance_recover'); yield c.att.landed ? 0.36 : 0.56; c.phase('END');
  }, { open: 'foot planted, jackal shoulders twist', active: 'diagonal pull → waist sweep → spin (dist<40) or lunge; distinct contact frames and hitboxes', vfx: 'orange ribbon + ghost silhouettes trailing blade', end: '0.56s if all miss', combo: 'then chains or summons', counter: 'dodge inside/outside individual arcs', target: 'locked_on_commit', hitbox: 'sectors + lunge capsule', el: 'soul' }),
  nm_('soul_chains', 'Soul Chains', 8, [40, 250], (ai) => W(0.45 + 0.4 * sm(ai.d, 50, 160) + (ai.ranged ? 0.15 : 0), 'reel in a kiting target'), function* (c) {
    c.phase('OPEN'); c.anim('soul_chains_open'); const a = lockAim(c); tele(c, { k: 'capsule', x1: c.b.pos.x, y1: c.b.pos.y, x2: c.b.pos.x + a.x * 200, y2: c.b.pos.y + a.y * 200, r: 6 }, 0.3, 'soul'); yield 0.3; c.phase('COMMIT'); c.anim('soul_chains_active'); c.phase('ACTIVE');
    let caught: import('./core').Actor | null = null;
    chainShot(c, () => add(c.b.pos, v(0, -8)), a, 200, 320, (t) => { if (!t.ccImmune && t.ccImmuneUntil <= c.t) { caught = t; c.w.pull(t, c.b.pos, 260, 0.5, 260); t.ccImmuneUntil = c.t + 2; c.log('chain snagged: bounded pull 0.5s'); } else c.log('target CC-immune: chain hit without pull'); });
    for (let t = 0; t < 0.9; t += c.w.dt) { if (caught && dist((caught as any).pos, c.b.pos) < 36) break; yield 0; }
    if (caught && dist((caught as any).pos, c.b.pos) < 44) { const aa = ang(sub((caught as any).pos, c.b.pos)); sweep(c, 40, aa - 1.1, aa + 1.1, 0.1, { dmg: 12, kb: 160, el: 'soul' }, 'soul', 6); yield 0.14; }
    c.phase('RECOVERY'); c.anim('soul_chains_recover'); yield 0.3; c.phase('END');
  }, { open: 'free hand rises, links grow from palm', active: 'articulated chain head travels a committed line (200px); genuine hit → bounded pull ≤0.5s (CC immunity after); optional follow-up only if within 44px', vfx: 'linked jagged amber chain stamps, snag ripples', end: 'retracts link by link', combo: 'Reaper’s Dance', counter: 'sidestep before extension; CC immunity window', target: 'locked_on_commit', hitbox: 'chain head r6', el: 'soul' }),
  nm_('grave_step', 'Grave Step', 7, [30, 190], (ai) => W(0.45 + 0.3 * sm(ai.d, 40, 120) + (ai.dodges.length > 1 ? 0.15 : 0), 'dash + delayed old-position echo'), function* (c) {
    c.phase('OPEN'); c.anim('grave_step_open'); const d = lockAim(c), old = v(c.b.pos.x, c.b.pos.y); yield 0.16;
    const echoAtt = { id: Math.floor(c.rnd() * 1e9), skill: 'grave_step:echo', owner: c.b.id, hits: new Map(), t0: c.t, landed: 0 }; const dn = dir4(d);
    c.w.add({ id: echoAtt.id, kind: 'echo', owner: c.b.id, att: echoAtt, pos: old, t: 0, life: 0.8, dead: false, lethal: true, policy: 'owned', data: {}, update(w) { const e = this as Ent; if (e.t >= 0.45 && e.t < 0.55) { const tip = add(old, mul(d, 90)); w.hitEnemies(c.b, echoAtt, { k: 'capsule', x1: old.x, y1: old.y, x2: tip.x, y2: tip.y, r: 7 }, { dmg: 10, kb: 120, el: 'soul' }); } },
      render() { const e = this as Ent, out: Cmd[] = [{ k: 'spr', key: `gse${dn}${e.t >= 0.45}`, make: () => vGhostOf('anubis', 'mini', dn, e.t >= 0.45 ? { wA: 1.2, reach: 1, lean: 6 } : { wA: -1.4, crouch: 0.4 }, 0, 'soul', e.t >= 0.45 ? 'gs1' : 'gs0'), x: old.x, y: old.y, layer: 2, z: old.y, alpha: 0.6 }]; if (e.t > 0.25 && e.t < 0.45) { const tip = add(old, mul(d, 90)); out.push({ k: 'zone', shape: { k: 'capsule', x1: old.x, y1: old.y, x2: tip.x, y2: tip.y, r: 7 }, x: 0, y: 0, layer: 1, el: 'soul', prog: (e.t - 0.25) / 0.2 }); } return out; },
      danger(q, h) { const e = this as Ent; const tip = add(old, mul(d, 90)); return e.t + h > 0.4 && hitTest({ k: 'capsule', x1: old.x, y1: old.y, x2: tip.x, y2: tip.y, r: 9 }, q, 4); } } as Ent);
    c.phase('COMMIT'); c.anim('grave_step_active'); c.phase('ACTIVE');
    for (let t = 0; t < 0.14; t += c.w.dt) { c.move(d, 620); yield 0; }
    const a = ang(lockAim(c)); sweep(c, 40, a - 1.2, a + 1.2, 0.1, { dmg: 12, kb: 140, el: 'soul' }, 'soul', 5); yield 0.16;
    c.phase('RECOVERY'); c.anim('grave_step_recover'); yield 0.36; c.phase('END');
  }, { open: 'leans, body splits into spectral layers; thin echo stays', active: 'real dash (hurtbox stays active) + ending strike; old-position echo performs ONE slash down a visible lane at +0.45s (lane shown 0.2s before)', vfx: 'shredded cloak, hollow jackal echo, opposite soul stream', end: 'echo expires 0.8s; foot-plant recovery', combo: 'echo catches retreaters', counter: 'avoid both positions', target: 'locked', hitbox: 'sweep + echo capsule', el: 'soul' }),
  nm_('wraith_hunt', 'Wraith Hunt', 14, [0, 420], (ai) => W(((ai.mem.summons || []).length < 2 ? 0.6 : 0), `summons ${(ai.mem.summons || []).length}/2`), function* (c) {
    c.phase('OPEN'); c.anim('wraith_hunt_open'); lockAim(c); const G = c.tpos(); c.spawn({ kind: 'glyph', pos: G, life: 1.2, policy: 'detach', update() {}, render() { const e = this as Ent; return [{ k: 'spr', key: `wh${Math.floor(e.t * 6) % 4}`, make: () => vSeal('soul', 30, Math.floor(e.t * 6), 2), x: G.x, y: G.y, layer: 0 }]; } }); yield 0.24;
    c.phase('COMMIT'); c.anim('wraith_hunt_active'); c.phase('ACTIVE'); summonWraith(c, G, 2); yield 0.2; summonWraith(c, G, 2); yield 0.5;
    c.phase('RECOVERY'); c.anim('wraith_hunt_recover'); yield 0.3; c.phase('END');
  }, { open: 'scythe raised, funeral glyph on world floor', active: '≤2 real summon actors (30hp, 10.6s, 6 dmg) born in 3 stages (spark→silhouette→armed); spawn validated vs obstacles', vfx: 'vortex birth, hollow soldiers', end: 'summons persist independently; die on lifetime or boss death (owner policy)', combo: 'summons pressure rear while chains land', counter: 'kill summons (30hp) or bait ritual recovery', target: 'near target', hitbox: 'summon melee sector r20', el: 'soul' }),
];
const nu_ = mk('anubis', 'ultimate');
export const ANUBIS_ULT: SkillDef[] = [
  nu_('death_procession', 'Death Procession', 13, [0, 1000], (ai) => W(0.6, 'sweeping spectral wavefronts'), function* (c) {
    c.phase('OPEN'); c.anim('death_procession_open'); lockAim(c); yield 0.6; c.phase('COMMIT'); c.anim('death_procession_active'); c.phase('ACTIVE');
    const T = c.tpos(), dir = fromAng(c.rnd() * 6.28), start = add(T, mul(dir, -280));
    for (let k = 0; k < 3; k++) { const gap = (c.rnd() - 0.5) * 160; wavefront(c, start, dir, 260, 560, 180, gap, 46, 14, k * 0.8); c.log(`wave ${k + 1} gap at ${gap.toFixed(0)}`); }
    yield 0.8; c.phase('RECOVERY'); c.anim('death_procession_recover'); yield 0.5; c.phase('END');
  }, { open: 'funeral gesture; ranks appear behind', active: '3 finite moving wavefronts (capsule colliders, 260 wide) each with a 46px gap; VFX ranks, not NPCs', vfx: 'ghost soldier ranks at depth, residue', end: 'colliders removed with last rank', combo: 'chains cut lanes', counter: 'enter the gap of each rank', target: 'route through target', hitbox: 'two capsules per wave', el: 'soul' }),
  nu_('gates_of_underworld', 'Gates of the Underworld', 16, [0, 1000], (ai) => W(0.55, 'persistent gates'), function* (c) {
    c.phase('OPEN'); c.anim('gates_of_underworld_open'); lockAim(c); yield 0.3; c.phase('COMMIT'); c.anim('gates_of_underworld_active'); c.phase('ACTIVE');
    for (let g = 0; g < 3; g++) { const p = c.valid(add(c.tpos(), fromAng(g * 2.1 + c.rnd(), 130)), 10); if (!p) { c.log('gate rejected'); continue; } const P = v(p.x, p.y), spawner = g === 0;
      c.spawn({ kind: 'gate', pos: P, life: 5, lethal: true, data: { next: 0.8 }, update() { const e = this as Ent; if (e.t > (e.data.next as number) && e.t < 4.6) { e.data.next = (e.data.next as number) + 1.2; if (spawner && c.w.rng() < 0.5) summonWraith(c, P, 4); else { const T = c.tpos(); proj(c, { pos: P, vel: mul(norm(sub(T, P)), 190), r: 5, ttl: 1.8, o: { dmg: 10, el: 'soul' }, el: 'soul', trail: true, sprite: (_a, t) => ({ key: `gsp${Math.floor(t * 8) % 4}`, make: () => vGhost(Math.floor(t * 8), 2) }) }); } } },
        render() { const e = this as Ent, open = Math.min(1, e.t / 0.4) * (e.t > 4.6 ? Math.max(0, (5 - e.t) / 0.4) : 1); return [{ k: 'spr', key: `gt${open.toFixed(1)}${Math.floor(e.t * 8) % 6}`, make: () => vPortal(20, open, Math.floor(e.t * 8), 2, 'soul'), x: P.x, y: P.y, layer: 1 }, { k: 'spr', key: `gtr${Math.floor(e.t * 12) % 24}`, make: () => vFieldRing('anubis', 44, e.t, open, open), x: P.x, y: P.y + 2, layer: 0 }]; } }); }
    yield 0.8; c.phase('RECOVERY'); c.anim('gates_of_underworld_recover'); yield 0.4; c.phase('END');
  }, { open: 'jackal/glyph gates rip open on blank ground', active: '3 gates sustain 5s independently; eject spirit projectiles every 1.2s; one gate may summon (cap 4 total)', vfx: 'black-amber chasm, soul mist', end: 'independent closure; summons expire by lifetime', combo: 'Procession through open lanes', counter: 'read charged gate, use clear lane', target: 'per projectile lock', hitbox: 'projectiles r5 + summons', el: 'soul' }),
  nu_('judgment_chains', 'Judgment Chains', 13, [0, 800], (ai) => W(0.55, 'bind region with chains'), function* (c) {
    c.phase('OPEN'); c.anim('judgment_chains_open'); lockAim(c); yield 0.3; c.phase('COMMIT'); c.anim('judgment_chains_active'); c.phase('ACTIVE');
    const anchors: V[] = []; for (let i = 0; i < 5; i++) { const p = c.valid(add(c.tpos(), fromAng(i * 1.25 + c.rnd() * 0.5, 100 + c.rnd() * 60)), 8); if (p) anchors.push(v(p.x, p.y)); }
    for (const A of anchors) c.spawn({ kind: 'anchor', pos: A, life: 2.8, update() {}, render() { return [{ k: 'spr', key: 'ja', make: () => vSeal('soul', 8, 0, 1), x: A.x, y: A.y, layer: 0 }]; } });
    for (const A of anchors) { const lock = add(c.tpos(), fromAng(c.rnd() * 6.28, 10)), cd = norm(sub(lock, A)); tele(c, { k: 'capsule', x1: A.x, y1: A.y, x2: A.x + cd.x * 230, y2: A.y + cd.y * 230, r: 6 }, 0.4, 'soul'); yield 0.4; chainShot(c, () => A, cd, 230, 360, (t) => { if (!t.ccImmune && t.ccImmuneUntil <= c.t) { c.w.pull(t, A, 160, 0.3, 160); t.ccImmuneUntil = c.t + 1.5; } }, A); }
    yield 1.0; c.phase('RECOVERY'); c.anim('judgment_chains_recover'); yield 0.4; c.phase('END');
  }, { open: 'arms raised; irregular anchor seals on blank floor', active: '5 anchors fire committed chains 0.35s apart toward points locked at fire; hit → 0.3s pull toward anchor (CC capped)', vfx: 'glowing links, anchor seals', end: 'chains retract; grab state cleared', combo: 'gates flank', counter: 'escape the chain axis', target: 'per chain lock', hitbox: 'chain head r6', el: 'soul' }),
  nu_('final_passage', 'The Final Passage', 28, [0, 900], (ai) => W(ai.hpFrac < 0.7 ? 0.9 : 0.3, 'catastrophe gated by hp'), function* (c) {
    c.phase('OPEN'); c.anim('final_passage_open'); const a0 = ang(lockAim(c)); const B0 = v(c.b.pos.x, c.b.pos.y); let pose = 0;
    c.spawn({ kind: 'specter', pos: B0, life: 4.8, update() {}, render() { const e = this as Ent, dn = dir4(c.b.facing), st = Math.min(4, Math.floor(e.t / 0.42)), p = e.t > 4.3 ? { dissolve: (e.t - 4.3) * 2 } : {}; return [{ k: 'ghost', key: `fp${dn}${st}${pose}${Math.floor((e.t > 4.3 ? (e.t - 4.3) * 10 : 0))}`, make: () => vGhostOf('anubis', 'ultimate', dn, { ...[{ crouch: 0.6 }, { wA: -1.6, reach: 1 }, { wA: -2.9, reach: 1 }, { wA: 1.5, reach: 1, twist: 1 }, { wA: -1.5, reach: 1, twist: -1 }][Math.max(st, pose)], ...p }, 0, 'soul', `fp${Math.max(st, pose)}${Math.floor((e.t > 4.3 ? (e.t - 4.3) * 10 : 0))}`), x: B0.x, y: B0.y - 132, layer: 2, z: B0.y - 2, alpha: 0.55 }]; } });
    yield 1.26; c.runner.uninterruptible = true; c.phase('COMMIT'); c.anim('final_passage_active'); c.phase('ACTIVE');
    sweep(c, 110, a0 - 1.4, a0 + 1.4, 0.2, { dmg: 18, kb: 200, el: 'soul' }, 'soul', 10); c.log('PHASE 1 physical scythe wave'); yield 0.4;
    for (let k = 0; k < 2; k++) { pose = 3 + k; const aa = ang(sub(c.tpos(), B0)) + (k ? 0.5 : -0.5); zone(c, { shape: { k: 'sector', x: B0.x, y: B0.y, r: 220, r0: 40, a: aa, span: 2.0 }, warn: 0.6, active: 0.14, o: { dmg: 24, kb: 220, el: 'soul' }, el: 'soul', look: 'none', major: true }); yield 0.75; }
    c.log('PHASE 3 rolling storm ranks'); const dir = norm(sub(c.tpos(), B0));
    for (let k = 0; k < 3; k++) wavefront(c, add(B0, mul(dir, 30)), dir, 220, 380, 200, (c.rnd() - 0.5) * 140, 44, 12, k * 0.5);
    yield 1.4; const fa = ang(sub(c.tpos(), B0)); zone(c, { shape: { k: 'sector', x: B0.x, y: B0.y, r: 260, a: fa, span: 0.7 }, warn: 0.8, active: 0.15, o: { dmg: 30, kb: 260, el: 'soul' }, el: 'soul', look: 'none', major: true }); c.log('final frontal blast');
    yield 1.0; c.phase('RECOVERY'); c.anim('final_passage_recover'); yield 1.4; c.phase('END');
  }, { open: 'scythe planted; giant jackal double rises in 3 staged poses behind (spectral recolour of the real Ultimate rig, 2× integer blit)', active: 'P1 physical sweep r110; P2 double performs two 0.6s-telegraphed 2.0-rad arcs from different directions; P3 three storm ranks with gaps; final 0.8s-telegraphed frontal blast', vfx: 'hollow specter layers, ranks, glyph dust, pixel dissolve blade→head→body', end: 'specter dissolves, 1.4s recovery', combo: 'may use remaining gates', counter: 'wave gaps, flank the final blast', target: 'per phase lock', hitbox: 'sectors + waves', el: 'soul' }),
];
export { rot, debris, decal, proj };
