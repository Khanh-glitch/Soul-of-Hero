import { SkillDef, SkillCtx, Cmd, Ent, V, v, add, mul, norm, sub, dist, fromAng, ang, rot, Actor } from './core';
import { zone, burst, debris, decal, sweep, proj, lockAim, rangeFit, sm, beam } from './helpers';
import { mk } from './skills_a';
import { vBlade, vGhostOf, vSeal, vPortalV2 as vPortal, vFist, vRock, vOrb, vSlash, vFieldRing } from '../art/vfx';
import { dir4 } from './core';

const W = (s: number, ...why: string[]) => ({ s, why });

// ---------- AION helpers: bounded echo registry & ghost rendering ----------
function echoSlash(c: SkillCtx, at: V, a0: number, a1: number, rad: number, delay: number, dmg: number, form: 'mini' | 'ultimate', tag: string) {
  const mem = c.b.boss!.mem; mem.echoes = (mem.echoes || []).filter((e: any) => e.fire > c.t);
  if (mem.echoes.length >= (form === 'mini' ? 4 : 8)) { c.log('echo registry full: echo skipped'); return null; }
  const P = v(at.x, at.y), fire = c.t + delay, id = Math.floor(c.rnd() * 1e6);
  mem.echoes.push({ id, fire, a0, a1, x: P.x, y: P.y, owner: c.b.id, target: c.targetId });
  const att = { id, skill: c.skill.id + ':echo', owner: c.b.id, hits: new Map(), t0: c.t, landed: 0 };
  const dirName = dir4(fromAng((a0 + a1) / 2));
  return c.w.add({ id, kind: 'echo', owner: c.b.id, att, pos: P, t: 0, life: delay + 0.35, dead: false, lethal: true, policy: 'owned', data: {},
    update(w) { const e = this as Ent; if (e.t >= delay && e.t < delay + 0.14) { const k = (e.t - delay) / 0.14, cur = a0 + (a1 - a0) * k; w.hitEnemies(c.b, att, { k: 'sector', x: P.x, y: P.y, r: rad, a: cur, span: 0.7 }, { dmg, kb: 140, el: 'time' }); if (!e.data.fx) { e.data.fx = 1; burst(w, 'time', P.x + Math.cos(a1) * rad * 0.6, P.y + Math.sin(a1) * rad * 0.6, 10, 0.25, false); } } },
    render() { const e = this as Ent, out: Cmd[] = [], cue = e.t > delay - 0.25 && e.t < delay; const f = e.t >= delay ? Math.min(3, Math.floor((e.t - delay) * 20)) : 3;
      out.push({ k: 'spr', key: `es${rad}${a0.toFixed(2)}${a1.toFixed(2)}${f}`, make: () => vSlash('time', rad, a0, a1, form === 'mini' ? 5 : 9, f), x: P.x, y: P.y, layer: 3, alpha: e.t < delay ? (cue && Math.floor(e.t * 30) % 2 ? 0.9 : 0.35) : 1 });
      out.push({ k: 'spr', key: `eg${form}${dirName}${tag}`, make: () => vGhostOf('aion', form, dirName, { wA: e.t >= delay ? 1.5 : -2.2, reach: 1, twist: e.t >= delay ? 1 : -1 }, 0, 'time', tag + (e.t >= delay ? 'b' : 'a')), x: P.x, y: P.y, layer: 2, z: P.y, alpha: 0.55 });
      return out; },
    danger(q, h) { const e = this as Ent; return e.t + h >= delay - 0.1 && dist(q, P) < rad + 6; } } as Ent);
}

const am_ = mk('aion', 'mini');
export const AION_MINI: SkillDef[] = [
  am_('pendulum_reap', 'Pendulum Reap', 6, [0, 75], (ai) => W(0.85 * rangeFit(ai.d, 0, 55) + ((ai.mem.echoes?.length || 0) > 0 ? 0.1 : 0), 'reap and leave a future threat'), function* (c) {
    c.phase('OPEN'); c.anim('pendulum_reap_open'); const a = ang(lockAim(c));
    zone(c, { shape: { k: 'sector', x: c.b.pos.x, y: c.b.pos.y, r: 46, a, span: 2.8 }, warn: 0.36, active: 0.01, o: { dmg: 0 }, el: 'time', look: 'none' }); yield 0.36;
    c.phase('COMMIT'); c.anim('pendulum_reap_active'); c.phase('ACTIVE'); sweep(c, 46, a - 1.4, a + 1.4, 0.12, { dmg: 13, kb: 130, el: 'time' }, 'time', 6); yield 0.14;
    let delay = 0.9 + c.rnd() * 0.7; if (c.w.pressure(c.tpos(), 40, delay + 0.3) > 0.7) { delay += 0.4; c.log('pressure budget: echo delayed +0.4s'); }
    echoSlash(c, c.b.pos, a - 1.4, a + 1.4, 46, delay, 11, 'mini', 'pr'); c.log(`echo scheduled in ${delay.toFixed(2)}s`);
    yield 0.08; c.phase('RECOVERY'); c.anim('pendulum_reap_recover'); yield 0.32; c.phase('END');
  }, { open: 'long windup; green marks exactly along the imminent arc', active: 'scythe sweep, then fixed-position echo replays the same committed path after 0.9–1.6s (bounded registry ≤4)', vfx: 'lime edge flash, translucent stationary trace that flickers 0.25s before re-ignition', end: 'body recovers while echo runs with its own owner/attack id', combo: 'other skills drive target into the repeat lane', counter: 'remember the lane, watch the reactivation flicker', target: 'locked_on_commit', hitbox: 'sweep r46; echo sector r46', el: 'time' }),
  am_('time_skip', 'Time Skip', 7, [40, 230], (ai) => W(0.5 + 0.35 * sm(ai.d, 50, 140) + (ai.ranged ? 0.15 : 0), 'relocate to flank'), function* (c) {
    c.phase('OPEN'); c.anim('time_skip_open'); lockAim(c); yield 0.24; c.phase('COMMIT');
    const T = c.tpos(), back = norm(sub(T, c.b.pos)); const cands = [rot(back, 0.9), rot(back, -0.9), back].map((d) => add(T, mul(d, 40)));
    let dest: V | null = null; for (const p of cands.sort(() => c.rnd() - 0.5)) { const q = c.valid(p, c.b.r); if (q && c.w.map.raycast(T, q).hit === false) { dest = q; break; } }
    if (!dest) { c.log('no legal flank: skip aborted, lunge from current spot'); dest = c.b.pos; }
    const from = v(c.b.pos.x, c.b.pos.y);
    for (let i = 0; i < 3; i++) { const p = add(from, mul(sub(dest, from), i / 3)); const dn = dir4(sub(dest, from)); c.w.add({ id: -1 - i, kind: 'afterimage', owner: c.b.id, pos: p, t: 0, life: 0.5 + i * 0.1, dead: false, lethal: false, policy: 'detach', data: {}, update() {}, render() { return [{ k: 'spr', key: `ts${dn}`, make: () => vGhostOf('aion', 'mini', dn, { crouch: 0.4, wB: -1.4, offReach: 1 }, 0, 'time', 'ts'), x: p.x, y: p.y, layer: 2, z: p.y, alpha: 0.5 }]; } } as Ent); }
    burst(c, 'time', from.x, from.y, 12, 0.25, false); c.b.pos = v(dest.x, dest.y); burst(c, 'time', dest.x, dest.y, 12, 0.25, false);
    c.anim('time_skip_active'); const a = lockAim(c); c.phase('ACTIVE'); yield 0.16; // clear preparation frame before the lunge
    const st = v(c.b.pos.x, c.b.pos.y); c.hitbox(() => ({ k: 'capsule', x1: st.x, y1: st.y, x2: c.b.pos.x + a.x * 14, y2: c.b.pos.y + a.y * 14, r: 9 }), 0.16, { dmg: 14, kb: 160, el: 'time' });
    for (let t = 0; t < 0.14; t += c.w.dt) { c.move(a, 420); yield 0; }
    c.phase('RECOVERY'); c.anim('time_skip_recover'); yield 0.32; c.phase('END');
  }, { open: 'hand flick, scythe fractures, body compresses', active: 'relocate to a sampled legal flank/back spot (raycast-validated), visible 0.16s prep frame, then committed lunge', vfx: '3 staggered frozen silhouettes, departure/arrival flashes', end: 'lunge decelerates; misses are real', combo: 'pairs with Pendulum echoes', counter: 'sidestep the committed lunge line after rematerialisation', target: 'flank sampled from current position only', hitbox: 'capsule lunge', el: 'time' }),
  am_('suspended_blades', 'Suspended Blades', 9, [40, 280], (ai) => W(0.5 + 0.3 * sm(ai.d, 60, 180), 'deny lanes at range'), function* (c) {
    c.phase('OPEN'); c.anim('suspended_blades_open'); lockAim(c); yield 0.36; c.phase('COMMIT'); c.anim('suspended_blades_active'); c.phase('ACTIVE');
    const n = 5, T = c.tpos(), mid = add(mul(c.b.pos, 0.6), mul(T, 0.4)), blades: Ent[] = [];
    for (let i = 0; i < n; i++) {
      const p = add(mid, fromAng((i / n) * 6.283 + c.rnd() * 0.4, 50)); if (!c.valid(p, 4)) continue;
      const head = ang(sub(T, p)) + (i - 2) * 0.12;
      const e = c.spawn({ kind: 'suspended', pos: p, life: 4, lethal: false, data: { head }, update() {}, render() { const me = this as Ent, fl = me.data.arm && Math.floor(c.w.t * 30) % 2; return [{ k: 'spr', key: `sb${head.toFixed(2)}${fl}`, make: () => vBlade('time', head, 7, !fl), x: p.x, y: p.y, layer: 3 }]; } });
      blades.push(e); yield 0.06;
    }
    const burstFire = c.b.boss!.phase2; c.log(burstFire ? 'fire mode: burst' : 'fire mode: one-by-one');
    for (const e of blades) {
      if (e.dead) continue; e.data.arm = 1; yield 0.2; // activation flicker
      const h = e.data.head as number, P = e.pos; e.dead = true;
      proj(c, { pos: P, vel: fromAng(h, 280), r: 5, ttl: 1.2, o: { dmg: 9, kb: 90, el: 'time' }, el: 'time', trail: true, sprite: (a) => ({ key: `sbf${a.toFixed(1)}`, make: () => vBlade('time', a, 7, false) }) });
      yield burstFire ? 0.02 : 0.2;
    }
    c.phase('RECOVERY'); c.anim('suspended_blades_recover'); yield 0.3; c.phase('END');
  }, { open: 'scythe rotates overhead; blades manifest at staggered angles', active: 'non-damaging suspended blades with frozen headings; each flickers 0.2s then becomes a real travelling projectile (no homing)', vfx: 'icy green-white contour, launch tear, fading wake', end: 'blades expire by firing/timeout/owner death', combo: 'Time Skip pressures a lane while blades fire', counter: 'relocate before launch, use gaps', target: 'heading frozen at manifest', hitbox: 'projectile r5', el: 'time' }),
  am_('broken_hour', 'Broken Hour', 11, [0, 170], (ai) => W(0.45 + 0.35 * rangeFit(ai.d, 30, 130), 'slow field then lunge'), function* (c) {
    c.phase('OPEN'); c.anim('broken_hour_open'); lockAim(c); yield 0.24;
    const C = add(c.b.pos, mul(c.aim(), Math.min(70, dist(c.tpos(), c.b.pos)))), R = 70;
    c.spawn({ kind: 'timefield', pos: C, life: 2.2, lethal: false, data: { r: R }, update(w) { for (const a of w.enemiesOf(c.b)) if (dist(a.pos, C) < R) { a.slowMul = Math.min(a.slowMul, 0.55); a.slowUntil = Math.max(a.slowUntil, w.t + 0.12); } }, render() { const e = this as Ent; const inside = c.w.enemiesOf(c.b).filter((a) => dist(a.pos, C) < R).length; const strength = 0.45 + Math.min(1, inside) * 0.45; return [{ k: 'spr', key: `bhf${Math.round(R)}${Math.floor(e.t * 12) % 24}${Math.round(strength * 4)}`, make: () => vFieldRing('aion', R, e.t, strength, Math.min(1, e.t / 0.4)), x: C.x, y: C.y + 2, layer: 0 }]; } });
    yield 0.2; c.phase('COMMIT'); c.anim('broken_hour_active'); c.phase('ACTIVE'); yield 0.3;
    const dir = norm(sub(c.tpos(), c.b.pos)), st = v(c.b.pos.x, c.b.pos.y);
    c.hitbox(() => ({ k: 'capsule', x1: st.x, y1: st.y, x2: c.b.pos.x, y2: c.b.pos.y, r: 10 }), 0.24, { dmg: 16, kb: 180, el: 'time' });
    for (let t = 0; t < 0.22; t += c.w.dt) { c.move(dir, 600); yield 0; }
    c.phase('RECOVERY'); c.anim('broken_hour_recover'); yield 0.36; burst(c, 'time', C.x, C.y, 20, 0.3); c.phase('END');
  }, { open: 'scythe planted; fractured chronal seal expands (not a ring)', active: 'local slow ×0.55 refreshed per tick only while inside (no global time change; projectiles inside move ×0.4) + one committed lunge across the zone', vfx: 'seal of fractured arcs + glyph clusters, release pop', end: 'slow expires within 0.12s of leaving/boss death', combo: 'sets up Reap/Skip', counter: 'exit early; interrupt during plant', target: 'lunge direction locked at ACTIVE+0.3s', hitbox: 'field + lunge capsule', el: 'time' }),
];
const au_ = mk('aion', 'ultimate');
export const AION_ULT: SkillDef[] = [
  au_('epoch_split', 'Epoch Split', 12, [0, 420], (ai) => W(0.55 + 0.3 * sm(ai.d, 60, 200), 'three moments at once'), function* (c) {
    c.phase('OPEN'); c.anim('epoch_split_open'); const a = lockAim(c); yield 0.52; c.phase('COMMIT'); c.phase('ACTIVE'); c.anim('epoch_split_active');
    const T = c.tpos(), lat = fromAng(ang(a) + Math.PI / 2), order = [0.4, 0.85, 1.3].sort(() => c.rnd() - 0.5);
    const spots = [add(c.b.pos, mul(a, 30)), add(T, mul(lat, 80)), add(T, mul(lat, -80))];
    spots.forEach((p0, i) => { const p = c.valid(p0, 10); if (!p) { c.log(`echo ${i} spawn rejected`); return; } const aa = ang(sub(T, p)); echoSlash(c, p, aa - 1.3, aa + 1.3, 92, order[i], 22, 'ultimate', 'ep' + i); });
    c.log(`echo order ${order.map((x) => x.toFixed(2)).join(',')}`); yield 1.5; c.phase('RECOVERY'); c.anim('epoch_split_recover'); yield 0.48; c.phase('END');
  }, { open: 'raises scythe; splits into 3 specters', active: '3 attack-only temporal entities (not AI agents) each sweeping r92 at its own distinct delay', vfx: 'ghost exposures, nonidentical wakes', end: 'specters dissolve on completion; original recovers', combo: 'route target across an echo path', counter: 'track the timing order, use gaps', target: 'per-echo heading locked at spawn', hitbox: 'echo sectors', el: 'time' }),
  au_('still_moment', 'Still Moment', 14, [0, 650], (ai) => W(0.5 + 0.2 * sm(ai.d, 100, 300), 'occupy lanes'), function* (c) {
    c.phase('OPEN'); c.anim('still_moment_open'); lockAim(c); yield 0.52; c.phase('COMMIT'); c.anim('still_moment_active'); c.phase('ACTIVE');
    const T = c.tpos(), held: Ent[][] = [[], [], []];
    for (let i = 0; i < 12; i++) { const p = add(T, fromAng((i / 12) * 6.283, 90 + (i % 3) * 30)); if (!c.valid(p, 4)) continue; const h = ang(sub(T, p)) + (i % 3 === 0 ? 0 : i % 3 === 1 ? 0.28 : -0.28); held[i % 3].push(c.spawn({ kind: 'crystal', pos: p, life: 4, data: { h }, update() {}, render() { const me = this as Ent, fl = me.data.arm && Math.floor(c.w.t * 30) % 2; return [{ k: 'spr', key: `cr${h.toFixed(1)}${fl}`, make: () => vBlade('time', h, 9, !fl), x: p.x, y: p.y, layer: 3 }]; } })); }
    yield 0.6;
    for (let g = 0; g < 3; g++) { for (const e of held[g]) e.data.arm = 1; yield 0.3; for (const e of held[g]) { if (e.dead) continue; e.dead = true; proj(c, { pos: e.pos, vel: fromAng(e.data.h as number, 220), r: 6, ttl: 1.6, o: { dmg: 12, kb: 100, el: 'time' }, el: 'time', trail: true, sprite: (a) => ({ key: `crf${a.toFixed(1)}`, make: () => vBlade('time', a, 9, false) }) }); } yield 0.35; }
    c.phase('RECOVERY'); c.anim('still_moment_recover'); yield 0.5; c.phase('END');
  }, { open: 'stasis field grows, crystals created', active: '12 held crystals in 3 groups; each group flickers 0.3s then releases with heading frozen at creation (±0.25 offsets leave gaps)', vfx: 'suspended crystal cels, release fracture, trails from rest', end: 'all held objects expire ≤4s', combo: 'lanes for other attacks', counter: 'thread between projected headings', target: 'frozen at creation', hitbox: 'projectiles r6', el: 'time' }),
  au_('requiem_rewind', 'Requiem Rewind', 13, [0, 520], (ai) => W(0.45 + 0.35 * rangeFit(ai.d, 40, 220), 'replay a route'), function* (c) {
    c.phase('OPEN'); c.anim('requiem_rewind_open'); const anchors: V[] = [v(c.b.pos.x, c.b.pos.y)];
    for (let i = 0; i < 3; i++) { const d = norm(sub(c.tpos(), c.b.pos)); for (let t = 0; t < 0.2; t += c.w.dt) { c.move(rot(d, (i - 1) * 0.6), 300); yield 0; } anchors.push(v(c.b.pos.x, c.b.pos.y)); const aa = ang(d); sweep(c, 70, aa - 1.2, aa + 1.2, 0.12, { dmg: 12, kb: 120, el: 'time' }, 'time', 8); yield 0.14; }
    c.phase('COMMIT'); c.anim('requiem_rewind_active'); yield 0.3; c.phase('ACTIVE');
    const back = c.valid(anchors[0], c.b.r) || anchors[0]; burst(c, 'time', c.b.pos.x, c.b.pos.y, 14, 0.3, false); c.b.pos = v(back.x, back.y); burst(c, 'time', back.x, back.y, 14, 0.3, false); c.log('Aion alone snaps back to anchor 0 (no world rewind)');
    anchors.slice(1).reverse().forEach((p, i) => { const aa = ang(sub(c.tpos(), p)); echoSlash(c, p, aa - 1.2, aa + 1.2, 70, 0.35 + i * 0.3, 10, 'ultimate', 'rr' + i); });
    yield 1.3; c.phase('RECOVERY'); c.anim('requiem_rewind_recover'); yield 0.5; c.phase('END');
  }, { open: 'short attack route leaving anchors', active: 'only Aion snaps back to an earlier legal anchor; afterimages replay slashes in reverse order', vfx: 'reverse motes, spectral footprints, re-ignite clusters', end: 'echoes fade on schedule; rematerialisation recovery', combo: 'with Still Moment under pressure budget', counter: 'identify anchors, leave replay lanes', target: 'per-anchor heading at replay', hitbox: 'sweeps + echo sectors', el: 'time' }),
  au_('zero_hour', 'Zero Hour', 26, [0, 650], (ai) => W(ai.hpFrac < 0.7 ? 0.9 : 0.3, 'catastrophe gated by hp'), function* (c) {
    c.phase('OPEN'); c.anim('zero_hour_open'); lockAim(c); const C = v(c.b.pos.x, c.b.pos.y); c.spawn({ kind: 'dome', pos: C, life: 5.5, update() {}, render() { const e = this as Ent; return [{ k: 'spr', key: `zh${Math.floor(e.t * 4) % 4}`, make: () => vSeal('time', 160, Math.floor(e.t * 4), 2), x: C.x, y: C.y, layer: 0 }]; } }); yield 1.14;
    c.runner.uninterruptible = true; c.phase('COMMIT'); c.phase('ACTIVE');
    const blades: Ent[] = []; const gapA = c.rnd() * 6.28;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283; if (Math.abs(((a - gapA + 9.42) % 6.283) - 3.14) < 0.45) continue; const p = add(C, fromAng(a, 150)); if (!c.valid(p, 4)) continue; const h = a + Math.PI; blades.push(c.spawn({ kind: 'crystal', pos: p, life: 5, data: { h }, update() {}, render() { return [{ k: 'spr', key: `zb${h.toFixed(1)}`, make: () => vBlade('time', h, 8, true), x: p.x, y: p.y, layer: 3 }]; } })); }
    c.log('PHASE 1 suspended blades with a visible gap wedge'); yield 0.5;
    for (let k = 0; k < 3; k++) { const a = c.rnd() * 6.28, p = add(C, fromAng(a, 40)); const aa = ang(sub(c.tpos(), p)); echoSlash(c, p, aa - 1.0, aa + 1.0, 140, 0.4, 22, 'ultimate', 'zh' + k); yield 0.6; }
    c.log('PHASE 3 stored blades release in sequence');
    for (const e of blades) { if (e.dead) continue; e.dead = true; proj(c, { pos: e.pos, vel: fromAng(e.data.h as number, 240), r: 6, ttl: 1.3, o: { dmg: 12, el: 'time' }, el: 'time', trail: true, sprite: (a) => ({ key: `zbf${a.toFixed(1)}`, make: () => vBlade('time', a, 8, false) }) }); yield 0.07; }
    c.log('PHASE 4 chronal burst with three gap wedges'); const gaps = [0, 1, 2].map(() => Math.floor(c.rnd() * 8));
    for (let s = 0; s < 8; s++) if (!gaps.includes(s)) zone(c, { shape: { k: 'sector', x: C.x, y: C.y, r: 165, r0: 30, a: (s / 8) * 6.283, span: 0.78 }, warn: 0.7, active: 0.14, o: { dmg: 24, kb: 220, el: 'time' }, el: 'time', look: 'none', major: true });
    yield 0.9; c.phase('RECOVERY'); c.anim('zero_hour_recover'); yield 1.4; c.phase('END');
  }, { open: '1.14s ritual + fractured dome seal', active: 'P1 suspended ring with gap wedge; P2 three giant echo crossings 0.6s apart; P3 sequential blade release; P4 chronal burst in 8 sectors with ≥3 gaps', vfx: 'frozen exposures, temporal shear, world afterimages dissolve', end: 'all temporal entities expire; 1.4s exhaustion', combo: '—', counter: 'learn safe timing, use dome gaps, punish recovery', target: 'per phase', hitbox: 'echo sectors, projectiles, sector burst', el: 'time' }),
];

// ---------- ATLAS: portal network (graph nodes with id, orientation, link, armed state, lifetime, cooldown) ----------
export function openPortal(c: SkillCtx, p: V, a: number, life: number, r = 14): Ent {
  const mem = c.b.boss!.mem; mem.portals = (mem.portals || []).filter((id: number) => c.w.ents.some((e) => e.id === id && !e.dead));
  if (mem.portals.length >= (c.U ? 8 : 4)) { const old = c.w.ents.find((e) => e.id === mem.portals[0]); if (old) old.life = Math.min(old.life, old.t + 0.25); }
  const e = c.spawn({ kind: 'portal', pos: v(p.x, p.y), life, lethal: false, policy: 'owned', data: { r, ang: a, armed: false, link: -1, uses: 0, cdUntil: 0, flash: -9 },
    update() { const me = this as Ent; me.data.armed = me.t > 0.18 && me.t < me.life - 0.2; },
    render(w) { const me = this as Ent, open = me.t < 0.18 ? me.t / 0.18 : me.t > me.life - 0.2 ? Math.max(0, (me.life - me.t) / 0.2) : 1, hot = w.t - (me.data.flash as number) < 0.3; return [{ k: 'spr', key: `po${r}${open.toFixed(1)}${Math.floor(me.t * 10) % 6}${hot}`, make: () => vPortal(hot ? r + 2 : r, open, Math.floor(me.t * 10), me.id % 4), x: me.pos.x, y: me.pos.y, layer: 1 }]; } });
  mem.portals.push(e.id); c.w.ev({ t: c.t, type: 'portal', note: `open #${e.id} @(${p.x | 0},${p.y | 0}) ang ${a.toFixed(2)}` });
  return e;
}
function link(a: Ent, b: Ent) { a.data.link = b.id; }
function portalArm(c: SkillCtx, pt: Ent, lock: V, delay: number, len: number, wid: number, dmg: number, el: 'space' = 'space', fistSize = 10) {
  const att = { id: Math.floor(c.rnd() * 1e9), skill: c.skill.id + ':arm', owner: c.b.id, hits: new Map(), t0: c.t, landed: 0 };
  let a = ang(sub(lock, pt.pos));
  return c.w.add({ id: att.id, kind: 'portalarm', owner: c.b.id, att, pos: pt.pos, t: 0, life: delay + 0.45, dead: false, lethal: true, policy: 'owned', data: {},
    update(w) { const e = this as Ent; if (pt.dead) { e.dead = true; return; } if (e.t < delay - 0.12 && e.t < 0.05) a = ang(sub(lock, pt.pos)); pt.data.flash = e.t > delay - 0.26 && e.t < delay ? w.t : pt.data.flash; const k = e.t < delay ? 0 : e.t < delay + 0.14 ? (e.t - delay) / 0.14 : e.t < delay + 0.24 ? 1 : Math.max(0, 1 - (e.t - delay - 0.24) / 0.12); e.data.k = k; if (k > 0.1 && e.t < delay + 0.24) { const tip = add(pt.pos, fromAng(a, len * k)); w.hitEnemies(c.b, att, { k: 'capsule', x1: pt.pos.x, y1: pt.pos.y, x2: tip.x, y2: tip.y, r: wid }, { dmg, kb: 200, kbDir: fromAng(a), el }); if (!e.data.b && k >= 1) { e.data.b = 1; burst(w, el, tip.x, tip.y, 12, 0.25); } } },
    render() { const e = this as Ent, k = (e.data.k as number) || 0, tw = Math.min(delay, 0.4); const out: Cmd[] = []; if (e.t < delay && e.t > delay - tw) { const tip = add(pt.pos, fromAng(a, len)); out.push({ k: 'zone', shape: { k: 'capsule', x1: pt.pos.x, y1: pt.pos.y, x2: tip.x, y2: tip.y, r: wid }, x: pt.pos.x, y: pt.pos.y, layer: 1, el, prog: (e.t - (delay - tw)) / tw }); } if (k <= 0) return out; const n = Math.max(1, Math.floor(len * k / (fistSize * 1.4))); for (let i = 1; i <= n; i++) { const p = add(pt.pos, fromAng(a, (len * k * i) / n)); out.push({ k: 'spr', key: `pf${fistSize}${a.toFixed(1)}`, make: () => vFist(el, fistSize, a), x: p.x, y: p.y, layer: 3 }); } return out; },
    danger(q, h) { const e = this as Ent; if (e.t + h < delay) return false; const tip = add(pt.pos, fromAng(a, len)); return dist(q, pt.pos) < len + 6 && Math.abs((q.x - pt.pos.x) * Math.sin(a) - (q.y - pt.pos.y) * Math.cos(a)) < wid + 6 && dist(q, tip) <= len; } } as Ent);
}
function flankSpots(c: SkillCtx, d: number) {
  const T = c.tpos(), a = c.aim(), tv = c.predict(0.5);
  const raw = [add(T, mul(rot(a, Math.PI / 2), d)), add(T, mul(rot(a, -Math.PI / 2), d)), add(T, mul(a, d)), add(tv, mul(norm(sub(tv, T)), d * 0.8))];
  return raw.map((p) => c.valid(p, 8)).filter((p): p is V => !!p && !c.w.map.raycast(p, T).hit);
}
const tm_ = mk('atlas', 'mini');
export const ATLAS_MINI: SkillDef[] = [
  tm_('blindside_gate', 'Blindside Gate', 6, [0, 280], (ai) => W(0.6 + 0.25 * sm(ai.d, 30, 120) + (ai.dodges.length ? 0.1 : 0), 'portal flank pressure', `${ai.dodges.length} recent dodges inform side`), function* (c) {
    c.phase('OPEN'); c.anim('blindside_gate_open'); lockAim(c);
    const spots = flankSpots(c, 46); if (!spots.length) { c.log('no valid portal spot: abort to recovery'); yield 0.3; c.phase('END'); return; }
    const P = spots[Math.floor(c.rnd() * spots.length)]; yield 0.18;
    const pt = openPortal(c, P, ang(sub(c.tpos(), P)), 4.2, 12); c.log(`portal #${pt.id} chosen (unpredictable spawn; lip cue is the read)`);
    yield 0.2; c.phase('COMMIT'); const lock = c.tpos(); c.anim('blindside_gate_active'); c.phase('ACTIVE');
    portalArm(c, pt, lock, 0.32, 62, 6, 13); yield 0.7;
    c.phase('RECOVERY'); c.anim('blindside_gate_recover'); yield 0.3; c.phase('END');
  }, { open: 'anchor pivot; portal tears open at a sampled flank/back/escape spot', active: 'lip ignites ~0.26s, heading locked, foreshortened arm/spear extends from the mouth with its own capsule hitbox; body stays with Atlas', vfx: 'torn seam → layered interior → arm sprites over mouth → splinters', end: 'arm retracts, hitbox off; portal persists 4.2s in the network', combo: 'Folded Lance reuses the portal', counter: 'roll perpendicular to the mouth when the lip lights', target: 'locked at COMMIT', hitbox: 'capsule from mouth, r6, 62px', el: 'space' }),
  tm_('folded_lance', 'Folded Lance', 7, [60, 420], (ai) => W(0.45 + 0.35 * sm(ai.d, 80, 220) + ((ai.mem.portals || []).length ? 0.2 : 0), 'ranged; reuses network'), function* (c) {
    c.phase('OPEN'); c.anim('folded_lance_open'); const a = lockAim(c); yield 0.4; c.phase('COMMIT');
    const entry = openPortal(c, add(c.b.pos, mul(a, 22)), ang(a), 1.6, 10);
    const exist = (c.b.boss!.mem.portals as number[]).map((id) => c.w.ents.find((e) => e.id === id && !e.dead && e.id !== entry.id && e.data.armed)).filter(Boolean) as Ent[];
    let exit = exist[0]; if (exit) { exit.data.ang = ang(sub(c.tpos(), exit.pos)); c.log(`reusing portal #${exit.id} as exit`); } else { const sp = flankSpots(c, 80)[0]; if (!sp) { c.log('no exit spot: direct throw'); } else { exit = openPortal(c, sp, ang(sub(c.tpos(), sp)), 1.6, 10); } }
    if (exit) link(entry, exit);
    yield 0.2; c.anim('folded_lance_active'); c.phase('ACTIVE');
    proj(c, { pos: add(c.b.pos, mul(a, 6)), vel: mul(a, 300), r: 4, ttl: 1.4, hops: 2, o: { dmg: 14, kb: 140, el: 'space' }, el: 'space', trail: true, sprite: (aa) => ({ key: `fl${aa.toFixed(1)}`, make: () => import_vLance(aa) }) });
    yield 0.4; c.phase('RECOVERY'); c.anim('folded_lance_recover'); yield 0.3; c.phase('END');
  }, { open: 'lance built between hands; entrance opens beside Atlas', active: 'projectile enters entrance and exits linked (existing or new) portal with preserved speed; heading fixed once out (≤2 hops)', vfx: 'segmented glow, portal compression flash, crystal trail, splinter', end: 'closed exit → projectile fizzles (documented rule)', combo: 'forks pressure across Blindside Gate', counter: 'watch exit mouth glow and travel line', target: 'exit faces target at link time; no homing', hitbox: 'projectile r4', el: 'space' }),
  tm_('rift_pursuit', 'Rift Pursuit', 8, [60, 320], (ai) => W(0.5 + 0.35 * sm(ai.d, 80, 200), 'close distance via transit'), function* (c) {
    c.phase('OPEN'); c.anim('rift_pursuit_open'); lockAim(c); const ent = openPortal(c, c.b.pos, ang(c.b.facing), 0.9, 14); yield 0.32;
    c.phase('COMMIT'); (c.b as any).air = 1; const pr = c.predict(0.5), tv = norm(sub(pr, c.tpos())); yield 0.12;
    const cands = [add(pr, mul(tv, -34)), add(pr, mul(rot(tv, 1.6), 34)), add(pr, mul(rot(tv, -1.6), 34))];
    let dest: V | null = null; for (const p of cands) { const q = c.valid(p, c.b.r); if (q) { dest = q; break; } }
    if (!dest) { dest = v(ent.pos.x, ent.pos.y); c.log('exit blocked: fallback to origin (no clipping)'); }
    const ex = openPortal(c, dest, 0, 0.9, 14); link(ent, ex); yield 0.18; c.b.pos = v(dest.x, dest.y); (c.b as any).air = 0;
    c.anim('rift_pursuit_active'); c.phase('ACTIVE'); const a = ang(lockAim(c)); sweep(c, 46, a - 1.5, a + 1.5, 0.14, { dmg: 15, kb: 180, el: 'space' }, 'space', 7); yield 0.2;
    c.phase('RECOVERY'); c.anim('rift_pursuit_recover'); yield c.att.landed ? 0.3 : 0.5; c.phase('END');
  }, { open: 'steps into a portal, anchor pulled behind shoulders', active: 'hidden transit state; exit chosen near predicted position, validated by queryValidPosition; blocked → fallback to origin; materialise + committed anchor sweep', vfx: 'disassembly/reassembly via portal wake', end: 'missed sweep recoil 0.5s', combo: 'after Folded Lance', counter: 'exit ripple is the read', target: 'prediction from past velocity', hitbox: 'sweep r46', el: 'space' }),
  tm_('gravity_snare', 'Gravity Snare', 9, [40, 280], (ai) => W(0.45 + 0.3 * sm(ai.d, 50, 160), 'hold a lane'), function* (c) {
    c.phase('OPEN'); c.anim('gravity_snare_open'); lockAim(c); yield 0.4; c.phase('COMMIT');
    const P = c.valid(c.predict(0.5), 6) || c.tpos(), S = v(c.b.pos.x, c.b.pos.y); c.anim('gravity_snare_active'); c.phase('ACTIVE');
    c.spawn({ kind: 'snare', pos: P, life: 1.5, lethal: true, update(w) { const e = this as Ent; if (e.t > 0.4 && e.t < 1.3) for (const t of w.enemiesOf(c.b)) if (dist(t.pos, P) < 80 && !t.pulls.length) w.pull(t, P, 90, Math.min(0.2, 1.3 - e.t), 90); if (e.t >= 1.3 && !e.data.b) { e.data.b = 1; w.hitEnemies(c.b, c.att, { k: 'circle', x: P.x, y: P.y, r: 50 }, { dmg: 15, kb: 200, el: 'space' }); burst(w, 'space', P.x, P.y, 22); debris(w, 'space', P.x, P.y, 12, 120); } },
      render() { const e = this as Ent, k = Math.min(1, e.t / 0.4), p = add(S, mul(sub(P, S), k)); return [{ k: 'spr', key: `gs${Math.floor(e.t * 10) % 4}`, make: () => vOrb('space', 6, Math.floor(e.t * 10)), x: p.x, y: p.y, layer: 3 }, ...(e.t > 0.4 ? [{ k: 'spr' as const, key: `gsr${Math.floor(e.t * 12) % 24}`, make: () => vFieldRing('atlas', 80, e.t, 1, (e.t - 0.4) / 0.5), x: P.x, y: P.y + 2, layer: 0 as const }] : [])]; },
      danger(q, h) { return (this as Ent).t + h > 1.2 && dist(q, P) < 56; } });
    yield 0.5; c.phase('RECOVERY'); c.anim('gravity_snare_recover'); yield 0.3; c.phase('END');
  }, { open: 'singularity cupped in hand', active: 'flicked to predicted point (0.4s travel), bounded pull r80 ≤90px/s for 0.9s, then one shatter hit r50', vfx: 'inward shards, prism core, ragged breakup', end: 'pull stops exactly at collapse', combo: 'holds a lane for portal spear', counter: 'evade centre / dash out', target: 'predicted point locked at throw', hitbox: 'pull + circle r50', el: 'space' }),
];
import { vLance } from '../art/vfx';
const import_vLance = (a: number) => vLance('space', a, 16);

const tu_ = mk('atlas', 'ultimate');
export const ATLAS_ULT: SkillDef[] = [
  tu_('titan_through_rift', 'Titan Through the Rift', 10, [0, 900], (ai) => W(0.65, 'remote fists from portals'), function* (c) {
    c.phase('OPEN'); c.anim('titan_through_rift_open'); lockAim(c); yield 0.3; c.phase('COMMIT'); c.anim('titan_through_rift_active'); c.phase('ACTIVE');
    for (let i = 0; i < 3; i++) { const T = c.tpos(), a = c.rnd() * 6.28, p = c.valid(add(T, fromAng(a, 100 + c.rnd() * 30)), 10); if (!p) continue; const pt = openPortal(c, p, ang(sub(T, p)), 1.6, 22); portalArm(c, pt, c.tpos(), 0.55, 130, 16, 26, 'space', 20); yield 0.45; }
    yield 0.6; c.phase('RECOVERY'); c.anim('titan_through_rift_recover'); yield 0.56; c.phase('END');
  }, { open: 'limb raised; remote rifts open with lip glow', active: '3 sequential colossal fists from independent portals, each locked ~0.12s before emerging, one-time hit', vfx: 'foreshortened fist chain, iris crack, blue debris', end: 'arms withdraw, hitbox off before retreat', combo: 'rifts reused by Horizon Array', counter: 'see which portal charges, leave its line', target: 'locked per portal', hitbox: 'capsule 130×16', el: 'space' }),
  tu_('horizon_array', 'Horizon Array', 16, [0, 1000], (ai) => W(0.55 + 0.2 * sm(ai.d, 150, 400), 'sustained crossfire network'), function* (c) {
    c.phase('OPEN'); c.anim('horizon_array_open'); lockAim(c); yield 0.3; c.phase('COMMIT');
    const n = c.b.boss!.phase2 ? 6 : 4, nodes: Ent[] = [];
    for (let i = 0; i < n; i++) { const T = c.tpos(), p = c.valid(add(T, fromAng(i * (6.283 / n) + c.rnd() * 0.8, 150 + c.rnd() * 70)), 10); if (p) nodes.push(openPortal(c, p, ang(sub(T, p)), 6, 16)); }
    for (let i = 0; i < nodes.length; i++) link(nodes[i], nodes[(i + 1) % nodes.length]);
    c.anim('horizon_array_active'); c.phase('ACTIVE');
    for (let t = 0; t < 4; t += 0.5) {
      const pr = c.predict(0.4); const ready = nodes.filter((p) => !p.dead && p.data.armed && (p.data.cdUntil as number) <= c.t);
      if (ready.length) { ready.sort((a, b) => dist(a.pos, pr) - dist(b.pos, pr)); const pt = ready[Math.floor(c.rnd() * Math.min(2, ready.length))]; pt.data.cdUntil = c.t + 1.2; pt.data.flash = c.t; pt.data.ang = ang(sub(pr, pt.pos)); c.log(`node #${pt.id} fires at predicted lane`);
        proj(c, { pos: add(pt.pos, fromAng(pt.data.ang as number, 8)), vel: fromAng(pt.data.ang as number, 260), r: 5, ttl: 1.8, hops: 1, o: { dmg: 13, kb: 130, el: 'space' }, el: 'space', trail: true, sprite: (aa) => ({ key: `ha${aa.toFixed(1)}`, make: () => import_vLance(aa) }) }); }
      yield 0.5;
    }
    c.log('orderly shutdown: in-flight lances continue until TTL'); for (const p of nodes) p.life = Math.min(p.life, p.t + 0.3 + c.rnd() * 0.4);
    c.phase('RECOVERY'); c.anim('horizon_array_recover'); yield 0.56; c.phase('END');
  }, { open: 'arms extended, 4–6 linked rifts assembled asymmetrically', active: 'sustained 4s: AI picks a ready node near the predicted lane every 0.5s (per-node 1.2s recharge); lances may hop once through the ring-linked network', vfx: 'per-portal rim cels, flash on fire', end: 'staggered shutdown, in-flight continue', combo: 'orchestrates U1/U3/U4', counter: 'leave crossfire lanes, exploit recharge gaps', target: 'per-shot prediction lock', hitbox: 'projectiles r5', el: 'space', sustained: true } as SkillDef['doc']),
  tu_('orbital_transference', 'Orbital Transference', 14, [0, 1000], (ai) => W(0.55, 'geographic meteor pressure'), function* (c) {
    c.phase('OPEN'); c.anim('orbital_transference_open'); lockAim(c); const sky = openPortal(c, add(c.b.pos, v(0, -70)), -Math.PI / 2, 3.6, 18); yield 0.32; c.phase('COMMIT');
    const T0 = c.tpos(), lows: Ent[] = [];
    for (let i = 0; i < 3; i++) { const p = c.valid(add(T0, fromAng(i * 2.1 + c.rnd(), 140)), 10); if (p) lows.push(openPortal(c, p, ang(sub(T0, p)), 3.4, 14)); }
    for (let i = 0; i < lows.length; i++) link(lows[i], lows[(i + 1) % lows.length]);
    c.anim('orbital_transference_active'); c.phase('ACTIVE');
    for (let w = 0; w < 3; w++) { for (const pt of lows) { if (pt.dead) continue; const lock = add(c.tpos(), fromAng(c.rnd() * 6.28, c.rnd() * 14)); pt.data.flash = c.t; const a = ang(sub(lock, pt.pos)); proj(c, { pos: add(pt.pos, fromAng(a, 10)), vel: fromAng(a, 200), r: 9, ttl: 1.6, hops: 1, major: true, o: { dmg: 18, kb: 150, el: 'space' }, el: 'space', trail: true, sprite: (_a, t) => ({ key: `me${Math.floor(t * 8) % 8}`, make: () => vRock(7, Math.floor(t * 8), 'space') }), onEnd: (p) => { burst(c.w, 'space', p.x, p.y, 16); decal(c.w, 'space', p.x, p.y, 28, 14, 3); } }); } yield 0.7; }
    void sky; c.phase('RECOVERY'); c.anim('orbital_transference_recover'); yield 0.56; c.phase('END');
  }, { open: 'celestial bodies form above Atlas into an upper sky portal', active: '3 waves of meteors from lower portals at varied angles; may redirect once through the next portal (cap 1)', vfx: 'constellation-stone meteors, trail separation, impact + dissolving decal', end: 'final meteors expire; portals cool', combo: 'with Horizon Array', counter: 'track mouths, not Atlas', target: 'per-meteor lock at emission', hitbox: 'projectile r9', el: 'space' }),
  tu_('worldfold', "Worldfold — Heaven's Rupture", 26, [0, 1000], (ai) => W(ai.hpFrac < 0.7 ? 0.9 : 0.3, 'catastrophe gated by hp'), function* (c) {
    c.phase('OPEN'); c.anim('worldfold_open'); const a0 = lockAim(c); const T = c.tpos(), lat = fromAng(ang(a0) + Math.PI / 2);
    const A = openPortal(c, c.valid(add(T, mul(lat, 260)), 10) || add(T, mul(lat, 120)), 0, 6, 30), B = openPortal(c, c.valid(add(T, mul(lat, -260)), 10) || add(T, mul(lat, -120)), 0, 6, 30); yield 0.84;
    c.runner.uninterruptible = true; c.phase('COMMIT'); c.anim('worldfold_active'); c.phase('ACTIVE');
    for (let i = 0; i < 4; i++) { const p = c.valid(add(c.tpos(), fromAng(c.rnd() * 6.28, 90 + c.rnd() * 60)), 10); if (p) { const pt = openPortal(c, p, 0, 1.4, 18); portalArm(c, pt, c.tpos(), 0.5, 110, 14, 20, 'space', 16); } yield 0.3; }
    c.log('STAGE 2 dimensional cuts');
    for (let i = 0; i < 3; i++) { const aa = c.rnd() * Math.PI, ctr = c.tpos(), d = fromAng(aa, 260); zone(c, { shape: { k: 'capsule', x1: ctr.x - d.x, y1: ctr.y - d.y, x2: ctr.x + d.x, y2: ctr.y + d.y, r: 9 }, warn: 0.6, active: 0.15, o: { dmg: 22, kb: 160, el: 'space' }, el: 'space', look: 'none', major: true }); yield 0.5; }
    c.log('STAGE 3 crossing shear between the two main rifts');
    const X = c.tpos(); for (const R of [A, B]) { const d = norm(sub(X, R.pos)); R.data.flash = c.t; zone(c, { shape: { k: 'capsule', x1: R.pos.x, y1: R.pos.y, x2: R.pos.x + d.x * 520, y2: R.pos.y + d.y * 520, r: 13 }, warn: 0.9, active: 0.3, o: { dmg: 30, kb: 240, maxHits: 1, el: 'space' }, el: 'space', look: 'none', major: true }); }
    yield 1.3; c.phase('RECOVERY'); c.anim('worldfold_recover'); yield 1.4; c.phase('END');
  }, { open: 'two nonidentical distant rifts widen; armour separates', active: 'S1 4 surprise minor portals release fists (lip cue 0.5s); S2 three 0.6s-telegraphed dimensional cuts; S3 two shears from the main rifts crossing at the target point (r13 each, everything else open)', vfx: 'nested rips, void holes, fragmented edges, cyan tear', end: '1.4s fatigue, all portals expire', combo: '—', counter: 'reposition between vectors; crossing is not arena-wide', target: 'per stage lock', hitbox: 'arms, capsules', el: 'space' }),
];
export type { Actor };
