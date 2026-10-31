// V. ASTRAL — magic that breaks the renderer's own rules.
import { Frame, W, H } from '../engine/frame';
import { TAU, clamp, lerp, inv, easeOut, easeIn, easeInOut, hash, hash2, hash3, noise3, bayer, angDiff, type V2, Rng } from '../engine/math';
import { P, ramp, rampD, type RGB } from '../engine/palette';
import { Particles, shock, pip, xform } from '../engine/kit';
import { CASTER, TARGETS } from '../engine/floor';
import type { SpellDef } from './types';

const WHITE: RGB = [1, 1, 1];
const CYAN: RGB = [0.45, 0.95, 1];
const MAG: RGB = [1, 0.35, 0.85];
const GOLDW: RGB = [1, 0.9, 0.6];
const VOID_INK: RGB = [0.02, 0.01, 0.05];

// ===================================================================== 17 EVENT HORIZON
const eventHorizon: SpellDef = {
  id: 17, name: 'Event Horizon', school: 'ASTRAL', dur: 8.8, climax: 6.45,
  blurb: 'A region of the arena loses information: light bends, the floor slides inward along warped bands, and space finally rebounds.',
  make(rng, fx) {
    const E = { x: 250, y: 106 };
    const TD = 5.9, TR = 6.25;
    const mass = (t: number) => easeInOut(inv(0.2, 3.0, t));
    const Rh = (t: number) => (t < 5.2 ? 13 * easeOut(inv(1.0, 2.6, t)) : lerp(13, 1.2, easeIn(inv(5.2, TD, t))));
    const thE = (t: number) => 23 * mass(t) * (t > 5.2 ? 1 + inv(5.2, TD, t) * 0.6 : 1);
    type Fr = { x: number; y: number; vx: number; vy: number; tr: V2[]; hue: number };
    const frs: Fr[] = [];
    const blocks = Array.from({ length: 46 }, () => { const a = rng.r(0, TAU), r = rng.r(14, 80); const s = rng.i(5, 10); return { hx: Math.round(E.x + Math.cos(a) * r * 1.2 - s / 2), hy: Math.round(E.y + Math.sin(a) * r * 0.8 - s / 2), s, a, A: rng.r(30, 95), w: rng.r(0.8, 1.6) }; });
    const ps = new Particles();
    let rebound = false;
    const ringScale = (k: number, t: number) => 1 - easeIn(inv(5.25 + k * 0.14, 5.45 + k * 0.14, t));
    function disk(f: Frame, t: number, front: boolean, tilt: number, rot: number, sy: number, pal: 'A' | 'B', k0: number) {
      const rh = Rh(t);
      if (rh < 1.5 || k0 <= 0) return;
      const r0 = rh * 1.5, r1 = rh * 4.6 * ringScale(pal === 'A' ? 3 : 4, t);
      const ext = r1 + 2;
      const c = Math.cos(tilt), s = Math.sin(tilt);
      f.field(E.x - ext, E.y - ext, E.x + ext, E.y + ext, (x, y) => {
        const dx = x + 0.5 - E.x, dy = y + 0.5 - E.y;
        const ux = dx * c + dy * s, uy = (-dx * s + dy * c) / sy;
        const rd = Math.hypot(ux, uy);
        if (rd < r0 || rd > r1) return;
        if ((uy > 0) !== front) return;
        if (!front && Math.hypot(dx, dy) < rh + 1) return;
        const ad = Math.atan2(uy, ux);
        const om = rot * 5 * Math.pow(r0 / rd, 1.5);
        const ph = ad - om * t;
        const n = noise3(rd * 0.28, Math.cos(ph) * 2.2 + 5, Math.sin(ph) * 2.2 + t * 0.15);
        let v = clamp((n - 0.35) * 1.8) * (1 - (rd - r0) / (r1 - r0)) ;
        for (let k = 0; k < 3; k++) {
          const rk = rh * (1.9 + k * 0.95) * ringScale(k, t);
          if (Math.abs(rd - rk) < 0.75 && (((ph * (k + 2)) / TAU) % 1 + 1) % 1 < 0.62) v = Math.max(v, 1.1);
        }
        if (v < 0.08) return;
        const dop = 1 + 0.55 * Math.cos(ad + (pal === 'A' ? 0 : Math.PI));
        const col = pal === 'A' ? rampD(P.void, 0.5 + v * 0.45, bayer(x, y)) : [MAG[0] * 0.8, MAG[1] * 0.6, MAG[2]] as RGB;
        f.Lc(x, y, col, v * dop * k0 * (pal === 'A' ? 0.75 : 0.45));
      });
    }
    return {
      update(dt, t) {
        ps.update(dt);
        const m = mass(t), GM = 8000 * m * (t > 5.2 ? 1 + inv(5.2, TD, t) * 5 : 1), rh = Rh(t);
        if (t > 1.2 && t < 5.3 && rng.chance(0.35)) {
          const a = rng.r(0, TAU), r = rng.r(45, 95);
          const v = Math.sqrt(GM / r) * rng.r(0.65, 0.95) * (rng.chance(0.75) ? 1 : -1);
          frs.push({ x: E.x + Math.cos(a) * r, y: E.y + Math.sin(a) * r * 0.75, vx: -Math.sin(a) * v, vy: Math.cos(a) * v * 0.75, tr: [], hue: rng.next() });
        }
        if (t < TD) for (let i = frs.length - 1; i >= 0; i--) {
          const p = frs[i];
          const dx = E.x - p.x, dy = E.y - p.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1;
          const a = GM / (d2 + 40);
          p.vx += (dx / d) * a * dt; p.vy += (dy / d) * a * dt;
          p.vx *= Math.exp(-dt * 0.22); p.vy *= Math.exp(-dt * 0.22);
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.tr.unshift({ x: p.x, y: p.y }); if (p.tr.length > 9) p.tr.pop();
          if (d < rh + 1.5) { ps.add({ x: p.x, y: p.y, kind: 'pix', c: WHITE, k: 2, max: 0.12 }); frs.splice(i, 1); }
        } else frs.length = 0;
        if (!rebound && t >= TR) { rebound = true; fx.shake(8); fx.kick(4); fx.flash([0.6, 0.4, 1], 0.4);
          for (let i = 0; i < 90; i++) { const a = rng.r(0, TAU), s = rng.r(60, 220); ps.add({ x: E.x, y: E.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.75, drag: 1.6, kind: 'star', col: P.star, max: rng.r(0.8, 1.8), k: 1 }); } }
      },
      render(f, t) {
        if (t >= TD && t < TR) {
          f.field(0, 0, W - 1, H - 1, (x, y) => f.I(x, y, 0, 0, 0, 1));
          f.L(E.x, E.y, 1.4, 1.4, 1.6);
          return;
        }
        if (t < TD) {
          const m = mass(t), te = thE(t), rh = Rh(t);
          const band = inv(2.4, 3.4, t) * (1 - inv(5.2, TD, t));
          f.field(E.x - 125, E.y - 110, E.x + 125, E.y + 110, (x, y) => {
            const dx = x + 0.5 - E.x, dy = (y + 0.5 - E.y) / 0.85, d = Math.hypot(dx, dy) || 0.01;
            if (d > 125) return;
            const fall = clamp(1 - d / 125);
            const amt = Math.min(70, (te * te) / Math.max(d, 2)) * fall;
            const b = Math.floor(d / 7);
            const off = (((t * 10 + b * 2.7) % 7) + 7) % 7 * band * fall;
            f.D(x, y, (-dx / d) * amt + (dx / d) * off, ((-dy / d) * amt + (dy / d) * off) * 0.85);
            const dark = m * Math.exp(-d / (16 + rh));
            f.S(x, y, 1 - 0.85 * dark);
            if (d < rh + 7) f.L(x, y, -0.25 * m, -0.25 * m, -0.2 * m);
          });
          disk(f, t, false, 0.12, 1, 0.3, 'A', inv(1.5, 2.6, t));
          disk(f, t, false, -0.62, -1, 0.5, 'B', inv(2.8, 3.8, t));
          if (rh > 0.5) {
            f.disc(E.x, E.y, rh, (x, y) => f.I(x, y, 0, 0, 0, 1));
            f.ring(E.x, E.y, rh + 0.6, (x, y, a) => f.Lc(x, y, ramp(P.star, 0.9), (1.1 + 0.6 * Math.cos(a)) * m));
            // lensed back of the disk arching over the top
            for (let i = 0; i <= 50; i++) { const a = Math.PI + (i / 50) * Math.PI; f.Lc(E.x + Math.cos(a) * rh * 1.45, E.y + Math.sin(a) * rh * 1.2, ramp(P.void, 0.85), 0.7 * inv(1.6, 2.8, t) * ringScale(0, t) * (0.6 + 0.4 * Math.sin(a * 3 + t * 2))); }
          }
          disk(f, t, true, 0.12, 1, 0.3, 'A', inv(1.5, 2.6, t));
          disk(f, t, true, -0.62, -1, 0.5, 'B', inv(2.8, 3.8, t));
          for (const p of frs) {
            for (let j = 0; j < p.tr.length - 1; j++) f.lineL(p.tr[j].x, p.tr[j].y, p.tr[j + 1].x, p.tr[j + 1].y, p.hue > 0.7 ? CYAN : ramp(P.star, 0.85), 0.9 * (1 - j / p.tr.length));
            f.Lc(p.x, p.y, WHITE, 1.2);
          }
          if (t > 5.2) f.discL(E.x, E.y, 1, WHITE, inv(5.6, TD, t) * 2);
        } else {
          const a = t - TR;
          for (let k = 0; k < 2; k++) {
            const r = (a - k * 0.18) * 230;
            if (r > 0 && r < 320) { shock(f, E.x, E.y, r, 22, 13 * (1 - r / 320), 0.85, 3); f.ringL(E.x, E.y, r, ramp(P.void, 0.8), 0.6 * (1 - r / 320), 0.85); }
          }
          const wob = 8 * Math.exp(-a * 2) * Math.cos(a * 12);
          if (Math.abs(wob) > 0.3) f.disc(E.x, E.y, 50, (x, y, d) => { const dx = x - E.x, dy = y - E.y, l = Math.hypot(dx, dy) || 1; f.D(x, y, (dx / l) * wob * (1 - d), (dy / l) * wob * (1 - d)); });
          for (const b of blocks) {
            const q = a / 1.7;
            if (q >= 1) continue;
            const o = b.A * Math.sin(Math.PI * q) * Math.exp(-q * 0.8);
            const bx = b.hx + Math.cos(b.a) * o, by = b.hy + Math.sin(b.a) * o * 0.8;
            for (let y = 0; y < b.s; y++) for (let x = 0; x < b.s; x++) { f.I(b.hx + x, b.hy + y, VOID_INK[0], VOID_INK[1], VOID_INK[2], 1); if (hash2(b.hx + x, b.hy + y) > 0.96) f.Lc(b.hx + x, b.hy + y, ramp(P.star, 0.9), 0.8); }
            f.blitBase(b.hx, b.hy, b.s, b.s, Math.round(bx), Math.round(by));
            f.polyOutlineL([{ x: bx, y: by }, { x: bx + b.s - 1, y: by }, { x: bx + b.s - 1, y: by + b.s - 1 }, { x: bx, y: by + b.s - 1 }], ramp(P.void, 0.85), 0.4 * (1 - q));
          }
          f.glow(E.x, E.y, 50, ramp(P.void, 0.7), 0.45 * Math.exp(-a * 3), 5);
        }
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 18 CHRONOSHARD
const chronoshard: SpellDef = {
  id: 18, name: 'Chronoshard', school: 'ASTRAL', dur: 9.2, climax: 6.52,
  blurb: 'Time fractures into crystals that store moments of one attack; they release forwards, backwards and out of order, then synchronise.',
  make(rng, fx) {
    const S = { x: CASTER.x + 6, y: CASTER.y - 16 }, T = { x: TARGETS[0].x, y: TARGETS[0].y - 8 };
    const M = { x: (S.x + T.x) / 2, y: 96 };
    const TSTOP = 4.4, TSYNC = 7.2;
    const orbAt = (tau: number) => { const q = clamp((tau - 0.15) / 0.4); return { x: lerp(S.x, T.x, q), y: lerp(S.y, T.y, q) - Math.sin(Math.PI * q) * 18 }; };
    /** the attack as a pure function of its own time */
    function attack(f: Frame, tau: number, tint: RGB, k: number, map?: (x: number, y: number) => V2, clip?: V2[]) {
      const plot = (x: number, y: number, kk: number, c: RGB = tint) => { let X = x, Y = y; if (map) { const p = map(x, y); X = p.x; Y = p.y; } if (clip && !pip(clip, X + 0.5, Y + 0.5)) return; f.Lc(X, Y, c, kk * k); };
      if (tau < 0) return;
      if (tau < 0.15) {
        const q = tau / 0.15;
        for (let j = 0; j < 10; j++) { const a = j * 0.63 + q * 2, r = 16 * (1 - q); plot(S.x + Math.cos(a) * r, S.y + Math.sin(a) * r * 0.7, 0.9); }
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= q * 6) plot(S.x + dx, S.y + dy, 1.2, WHITE);
      } else if (tau < 0.55) {
        const o = orbAt(tau);
        for (let j = 1; j < 16; j++) { const p = orbAt(tau - j * 0.011); plot(p.x, p.y, 0.9 * (1 - j / 16)); }
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) plot(o.x + dx, o.y + dy, dx * dx + dy * dy < 2 ? 1.6 : 0.9, dx * dx + dy * dy < 2 ? WHITE : tint);
      } else if (tau <= 1) {
        const q = (tau - 0.55) / 0.45;
        const r = 4 + easeOut(q) * 34;
        for (let j = 0; j < 40; j++) { const a = (j / 40) * TAU; plot(T.x + Math.cos(a) * r, T.y + Math.sin(a) * r * 0.7, 1 - q); }
        for (let j = 0; j < 16; j++) { const a = (j / 16) * TAU + hash(j) * 0.3, d = easeOut(q) * (16 + hash(j + 5) * 24); plot(T.x + Math.cos(a) * d, T.y + Math.sin(a) * d * 0.7, 1.3 * (1 - q), WHITE); plot(T.x + Math.cos(a) * d * 0.8, T.y + Math.sin(a) * d * 0.56, 0.6 * (1 - q)); }
        const cr = 6 * (1 - q) * (1 - q);
        for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (dx * dx + dy * dy <= cr * cr) plot(T.x + dx, T.y + dy, 1.2, WHITE);
      }
    }
    const taus = [0.1, 0.38, 0.5, 0.72, 0.88];
    const act = [6.3, 4.8, 6.0, 6.3, 5.5];
    const hex = [{ x: 0, y: -18 }, { x: 10, y: -8 }, { x: 10, y: 8 }, { x: 0, y: 18 }, { x: -10, y: 8 }, { x: -10, y: -8 }];
    const confs = [
      (i: number, t: number) => { const a = (i / 5) * TAU + t * 0.4; return { x: M.x + Math.cos(a) * 62, y: M.y + Math.sin(a) * 36 }; },
      (i: number) => { const q = 0.12 + i * 0.19; return { x: lerp(S.x, T.x, q), y: lerp(S.y, T.y, q) - 34 + (i % 2) * 20 }; },
      (i: number, t: number) => { const a = (i / 5) * TAU - t * 0.6; return { x: M.x + Math.cos(a) * 44, y: M.y - 6 + Math.sin(a) * 44 * 0.5 + (i - 2) * 4 }; },
    ];
    const cpos = (i: number, t: number) => {
      if (t < 3.0) return confs[0](i, t);
      if (t < 3.8) { const q = easeInOut((t - 3.0) / 0.6); const a = confs[0](i, 3.0), b = confs[1](i, t); return { x: lerp(a.x, b.x, q), y: lerp(a.y, b.y, q) }; }
      const q = easeInOut((t - 3.8) / 0.6); const a = confs[1](i, t), b = confs[2](i, t); return { x: lerp(a.x, b.x, q), y: lerp(a.y, b.y, q) };
    };
    const ps = new Particles();
    const done = new Set<string>();
    const mainTau = (t: number) => (t < 1.2 ? -1 : t < TSTOP ? Math.floor(inv(1.2, TSTOP, t) * 0.32 * 40) / 40 : t < TSYNC ? 0.32 : 0.6 + (t - TSYNC) * 0.4 / 1.4);
    return {
      update(dt, t) {
        ps.update(dt);
        fx.ambient = t < 1 ? 1 : t < TSTOP ? 0.25 : t < TSYNC ? 0 : 1;
        fx.ambientEcho = t > 1 && t < TSYNC ? 1 : 0;
        taus.forEach((_, i) => {
          if (t >= act[i] && !done.has('c' + i)) {
            done.add('c' + i); fx.shake(2); fx.kick(1.5);
            const p = cpos(i, act[i]);
            for (let k = 0; k < 14; k++) ps.add({ x: p.x, y: p.y, vx: rng.r(-60, 60), vy: rng.r(-50, 50), drag: 2.2, kind: 'shard', col: P.star, size: rng.r(1.5, 3), spin: rng.r(-8, 8), max: rng.r(0.5, 1.1), k: 1 });
            if (i === 2) for (let k = 0; k < 40; k++) ps.add({ x: p.x + rng.r(-4, 4), y: p.y + rng.r(-8, 8), vx: rng.r(-80, 80), vy: rng.r(-80, 40), home: T, homeK: 3, drag: 1.5, kind: 'star', col: P.star, c: k % 2 ? MAG : GOLDW, max: rng.r(1, 1.6), k: 1.2 });
          }
        });
        if (t >= TSYNC && !done.has('s')) { done.add('s'); fx.shake(5); fx.flash([0.8, 0.9, 1], 0.4); fx.kick(4); }
      },
      render(f, t) {
        fx.desat = t > 1 && t < TSYNC ? 0.65 * inv(1, 2, t) : t >= TSYNC ? 0.65 * (1 - inv(TSYNC, TSYNC + 0.6, t)) : 0;
        // echoes of the caster's gesture: past (cyan) and future (magenta)
        if (t < 2.4) {
          const g = Math.min(inv(0, 0.4, t), 1 - inv(1.6, 2.4, t));
          for (let k = -3; k <= 3; k++) {
            if (!k) continue;
            const ox = CASTER.x + k * 10, oy = CASTER.y, c = k < 0 ? CYAN : MAG, pose = clamp(t * 2 + k * 0.25);
            const a = g * (1 - Math.abs(k) * 0.22);
            for (let y = -11; y <= 0; y++) for (let x = -4; x <= 4; x++) { const w = y < -7 ? 2 : 2 + (y + 7) * 0.4; if (Math.abs(x) <= w && (x + y) % 2 === 0) f.Lc(ox + x, oy + y, c, 0.35 * a); }
            f.lineL(ox + 6, oy - 2 - pose * 4, ox + 6, oy - 14 - pose * 4, c, 0.6 * a);
          }
        }
        // the clock of fractured time
        if (t > 1 && t < TSYNC + 0.3) {
          const g = inv(1, 2, t) * (1 - inv(TSYNC, TSYNC + 0.3, t));
          for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU, r0 = 92, r1 = k % 6 ? 95 : 99; f.lineL(M.x + Math.cos(a) * r0, M.y + 4 + Math.sin(a) * r0 * 0.55, M.x + Math.cos(a) * r1, M.y + 4 + Math.sin(a) * r1 * 0.55, ramp(P.star, 0.6), 0.25 * g); }
          const ha = Math.floor(t * 2) * (TAU / 24) * (t > TSTOP ? 0 : 1) + (t > TSTOP ? TSTOP * 2 * (TAU / 24) : 0) - Math.PI / 2;
          f.lineL(M.x, M.y + 4, M.x + Math.cos(ha) * 80, M.y + 4 + Math.sin(ha) * 44, ramp(P.star, 0.7), 0.2 * g);
        }
        // main attack, stuttering then stopped mid-air, with displaced echoes
        const mt = mainTau(t);
        if (mt >= 0) {
          attack(f, mt, GOLDW, 1);
          if (t < TSYNC) { attack(f, mt - 0.045, CYAN, 0.45); attack(f, mt + 0.06, MAG, 0.45); }
        }
        // crystals holding moments
        taus.forEach((tau, i) => {
          const t0 = 1.0 + i * 0.22;
          if (t < t0) return;
          const p = cpos(i, t);
          const rot = Math.sin(t * 0.8 + i) * 0.25;
          const poly = xform(hex, p.x, p.y, rot);
          if (t < act[i]) {
            const mat = clamp((t - t0) / 0.6);
            if (mat >= 1) {
              f.poly(poly, (x, y) => f.I(x, y, 0.06, 0.03, 0.14, 0.55));
              const fc = tau < 0.55 ? orbAt(tau) : T;
              attack(f, tau, i % 2 ? MAG : CYAN, 1.3, (x, y) => ({ x: p.x + (x - fc.x) * 0.3, y: p.y + (y - fc.y) * 0.3 }), poly);
              f.lineL(poly[0].x, poly[0].y, p.x, p.y, ramp(P.star, 0.6), 0.25); f.lineL(poly[2].x, poly[2].y, p.x, p.y, ramp(P.star, 0.6), 0.2); f.lineL(poly[4].x, poly[4].y, p.x, p.y, ramp(P.star, 0.6), 0.2);
            }
            const n = Math.ceil(6 * mat);
            for (let k = 0; k < n; k++) { const a = poly[k], b = poly[(k + 1) % 6]; f.lineL(a.x, a.y, b.x, b.y, ramp(P.star, 0.9), 0.7 + 0.3 * Math.sin(t * 6 + i)); }
            f.S(p.x, p.y + 24, 0.7);
            return;
          }
          // released moments
          const a = t - act[i];
          const fc = tau < 0.55 ? orbAt(tau) : T;
          const sc = clamp(a / 0.15);
          const map = (x: number, y: number) => ({ x: lerp(p.x + (x - fc.x) * 0.2, x, sc), y: lerp(p.y + (y - fc.y) * 0.2, y, sc) });
          if (i === 1 && a < 0.9) attack(f, tau + (a / 0.9) * (1 - tau), CYAN, 1.1, map);
          if (i === 4 && a < 0.7) attack(f, tau - (a / 0.7) * (tau - 0.56), MAG, 1.1, map);
          if (i === 0 && a < 0.6) attack(f, 0.15 + (a / 0.6) * 0.39, CYAN, 1.1, map);
          if (i === 3 && a < 0.6) attack(f, 0.54 - (a / 0.6) * 0.39, MAG, 1.1, map);
        });
        // synchronisation: every version converges on one moment
        if (t > 6.8 && t < TSYNC) {
          const q = inv(6.8, TSYNC, t);
          [0.7, 0.8, 0.92, 0.62].forEach((tt, k) => attack(f, lerp(tt, 0.6, q), [CYAN, MAG, GOLDW, CYAN][k], 0.6));
        }
        if (t >= TSYNC) {
          const a = t - TSYNC, r = a * 200;
          if (r < 260) {
            for (let k = 0; k < 28; k++) {
              const an = (k / 28) * TAU, x = T.x + Math.cos(an) * r, y = T.y + Math.sin(an) * r * 0.7;
              const tri = xform([{ x: 0, y: -4 }, { x: 2.5, y: 2 }, { x: -2.5, y: 2 }], x, y, an + a * 6);
              f.polyI(tri, ramp(P.star, 0.7), clamp(1 - r / 260));
              f.Lc(tri[0].x, tri[0].y, WHITE, 1.2 * (1 - r / 260));
            }
            shock(f, T.x, T.y, r, 14, 8 * (1 - r / 260), 0.7, 2);
          }
        }
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 19 CONSTELLATION ENGINE
const constellationEngine: SpellDef = {
  id: 19, name: 'Constellation Engine', school: 'ASTRAL', dur: 9.8, climax: 7.72,
  blurb: 'Scattered stars search for a mathematical solution, assemble into a nested orbital machine, synchronise, and forge a crystal star.',
  make(rng, fx) {
    const K = { x: 244, y: 108 }, SYc = 0.62;
    const rings = [{ n: 1, r: 0, w: 0 }, { n: 3, r: 22, w: 1.2 }, { n: 4, r: 44, w: -0.8 }, { n: 5, r: 70, w: 0.5 }];
    const nodes: { ring: number; k: number; sx: number; sy: number; t0: number; ph: number }[] = [];
    rings.forEach((r, ri) => { for (let k = 0; k < r.n; k++) nodes.push({ ring: ri, k, sx: rng.r(40, 344), sy: rng.r(22, 190), t0: 0.1 + nodes.length * 0.07, ph: rng.r(0, TAU) }); });
    const phi = [0, rng.r(0, TAU), rng.r(0, TAU), rng.r(0, TAU)];
    let phiSnap: number[] | null = null;
    let star2 = false, star3 = false, lastToggle = 0;
    type Pk = { a: number; b: number; p: number; hops: number };
    let pks: Pk[] = [];
    const TS = 7.6;
    const streams = [...TARGETS, { x: 40, y: 40 }, { x: 60, y: 190 }].map((p, j) => ({ p, t0: 7.9 + j * 0.1, side: j % 2 ? 1 : -1 }));
    const shards: { pts: V2[]; x: number; y: number; vx: number; vy: number; spin: number; rot: number }[] = [];
    const ps = new Particles();
    const ev = new Set<string>();
    const idx = (ri: number, k: number) => nodes.findIndex((n) => n.ring === ri && n.k === ((k % rings[ri].n) + rings[ri].n) % rings[ri].n);
    const mech = (n: (typeof nodes)[0]) => { const r = rings[n.ring]; const a = phi[n.ring] + (n.k * TAU) / r.n - Math.PI / 2; return { x: K.x + Math.cos(a) * r.r * 1.3, y: K.y + Math.sin(a) * r.r * SYc * 1.3, a }; };
    const pos = (i: number, t: number) => { const n = nodes[i], m = mech(n), q = easeInOut(inv(2.4 + i * 0.1, 3.4 + i * 0.1, t)); return { x: lerp(n.sx, m.x, q), y: lerp(n.sy, m.y, q) }; };
    const edges = (t: number): [number, number][] => {
      const e: [number, number][] = [];
      for (let k = 0; k < 3; k++) { e.push([idx(1, k), idx(1, k + 1)]); e.push([0, idx(1, k)]); }
      for (let k = 0; k < 4; k++) e.push([idx(2, k), idx(2, k + (star2 ? 2 : 1))]);
      for (let k = 0; k < 5; k++) e.push([idx(3, k), idx(3, k + (star3 ? 2 : 1))]);
      if (t > 3.4) for (let ri = 1; ri < 3; ri++) for (let a = 0; a < rings[ri].n; a++) for (let b = 0; b < rings[ri + 1].n; b++) {
        const A = mech(nodes[idx(ri, a)]), B = mech(nodes[idx(ri + 1, b)]);
        if (Math.abs(angDiff(A.a, B.a)) < 0.28) e.push([idx(ri, a), idx(ri + 1, b)]);
      }
      return e.filter(([a, b]) => a !== b);
    };
    const solution = edges(0);
    return {
      update(dt, t) {
        ps.update(dt);
        if (t < 6.0) { const g = inv(3.3, 3.9, t); for (let r = 1; r < 4; r++) phi[r] += rings[r].w * g * dt * (1 + inv(4.5, 6, t)); }
        else if (t < TS) {
          if (!phiSnap) phiSnap = [...phi];
          const q = easeInOut(inv(6.0, 7.3, t));
          for (let r = 1; r < 4; r++) { const st = TAU / rings[r].n; phi[r] = lerp(phiSnap[r], Math.round(phiSnap[r] / st) * st, q); }
        }
        if (t > 3.8 && t < 7.4) {
          const E = edges(t);
          if (hash(Math.floor(t * 4)) > 0.2 && Math.floor(t * 60) % 15 === 0) { const e = E[rng.i(0, E.length - 1)]; pks.push({ a: e[0], b: e[1], p: 0, hops: 0 }); }
          if (t > 6.5 && Math.floor(t * 60) % 18 === 0) for (let k = 0; k < 5; k++) pks.push({ a: idx(3, k), b: idx(2, k % 4), p: 0, hops: 3 });
          const next: Pk[] = [];
          for (const p of pks) {
            const A = pos(p.a, t), B = pos(p.b, t), l = Math.hypot(B.x - A.x, B.y - A.y) || 1;
            p.p += (110 * dt) / l;
            if (p.p < 1) { next.push(p); continue; }
            if (p.b === 0 && t - lastToggle > 0.8) { lastToggle = t; if (rng.chance(0.5)) star2 = !star2; else star3 = !star3; fx.shake(1.5); }
            if (p.hops >= 6) continue;
            const out = E.filter((e) => e[0] === p.b || e[1] === p.b).map((e) => (e[0] === p.b ? e[1] : e[0])).filter((n) => n !== p.a);
            if (!out.length) continue;
            const n1 = rng.pick(out); next.push({ a: p.b, b: n1, p: 0, hops: p.hops + 1 });
            if (rng.chance(0.3) && out.length > 1) next.push({ a: p.b, b: rng.pick(out), p: 0, hops: p.hops + 1 });
          }
          pks = next.slice(0, 60);
        } else pks = [];
        if (t >= TS && !ev.has('s')) { ev.add('s'); fx.shake(4); fx.flash([0.8, 0.75, 1], 0.35); fx.kick(2); }
        for (const s of streams) if (t >= s.t0 + 0.35 && !ev.has('st' + s.t0)) { ev.add('st' + s.t0); for (let k = 0; k < 14; k++) ps.add({ x: s.p.x, y: s.p.y, vx: rng.r(-70, 70), vy: rng.r(-50, 50), drag: 2.5, kind: 'star', col: P.star, max: rng.r(0.4, 1), k: 1.2 }); fx.shake(1.5); }
        if (t >= 8.7 && !ev.has('f')) {
          ev.add('f');
          for (let k = 0; k < 16; k++) {
            const a0 = (k / 16) * TAU, a1 = ((k + 1) / 16) * TAU, ro = k % 2 ? 9 : 28, ri = k % 2 ? 28 : 9;
            const pts = [{ x: 0, y: 0 }, { x: Math.cos(a0) * ro, y: Math.sin(a0) * ro * 0.8 }, { x: Math.cos(a1) * ri, y: Math.sin(a1) * ri * 0.8 }];
            const cx = (pts[1].x + pts[2].x) / 3, cy = (pts[1].y + pts[2].y) / 3;
            shards.push({ pts: pts.map((p) => ({ x: p.x - cx, y: p.y - cy })), x: K.x + cx, y: K.y + cy, vx: cx * rng.r(0.8, 1.6), vy: cy * rng.r(0.8, 1.6), spin: rng.r(-1.5, 1.5), rot: 0 });
          }
        }
        for (const s of shards) { s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.spin * dt; s.vx *= Math.exp(-dt * 0.6); s.vy *= Math.exp(-dt * 0.6); }
      },
      render(f, t) {
        const dim = 1 - inv(8.8, 9.7, t);
        f.glow(K.x, K.y, 160, [-1, -1, -0.8], 0.12 * inv(0.3, 2, t) * dim, 5, 0.7);
        const sync = inv(6.0, 7.4, t);
        // searching
        if (t > 1.0 && t < 3.6) {
          const slot = Math.floor(t * 8);
          for (let k = 0; k < 6; k++) {
            const a = Math.floor(hash(slot * 13 + k) * nodes.length), b = Math.floor(hash(slot * 7 + k * 3) * nodes.length);
            if (a === b) continue;
            const A = pos(a, t), B = pos(b, t);
            f.line(A.x, A.y, B.x, B.y, (x, y, s) => { if ((x + y) % 3 === 0 && s < (t * 8 % 1) * 2) f.Lc(x, y, ramp(P.star, 0.6), 0.35); });
          }
        }
        // solution edges: found, then ribboned
        const E = t > 3.4 ? edges(t) : solution;
        E.forEach(([a, b], ei) => {
          const found = t > 3.4 ? 1 : clamp((t - (1.4 + hash(ei * 3 + a) * 1.8)) / 0.3);
          if (found <= 0) return;
          const A = pos(a, t), B = pos(b, t);
          const k = (0.3 + 0.5 * sync) * found * dim * (t > 8.6 ? 1 - inv(8.6, 9.4, t) : 1);
          if (t > 3.6) {
            const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
            const n = Math.ceil(l);
            for (let j = 0; j <= n; j++) {
              const s = j / n, w = Math.sin(s * Math.PI * 3 + t * 4 + ei) * 1.8 * Math.sin(Math.PI * s);
              const x = lerp(A.x, B.x, s), y = lerp(A.y, B.y, s);
              f.Lc(x + nx * w, y + ny * w, ramp(P.star, 0.8), k);
              f.Lc(x - nx * w, y - ny * w, j % 2 ? CYAN : ramp(P.void, 0.8), k * 0.8);
            }
          } else f.lineL(A.x, A.y, B.x, B.y, ramp(P.star, 0.7), k);
        });
        for (const p of pks) {
          const A = pos(p.a, t), B = pos(p.b, t);
          const x = lerp(A.x, B.x, p.p), y = lerp(A.y, B.y, p.p);
          f.glow(x, y, 4, WHITE, 1, 2); f.Lc(x, y, WHITE, 1.6);
        }
        // stars and their tiny moons
        nodes.forEach((n, i) => {
          if (t < n.t0) return;
          const p = pos(i, t);
          const tw = 0.6 + 0.4 * Math.sin(t * (2 + hash(i) * 3) + n.ph);
          const g = clamp((t - n.t0) / 0.3) * dim;
          const big = n.ring === 0 ? 2 : 1;
          f.Lc(p.x, p.y, WHITE, (1.4 + sync) * g * tw);
          for (let d = 1; d <= big + (tw > 0.85 ? 1 : 0); d++) { const kk = 0.6 * g / d; f.Lc(p.x + d, p.y, ramp(P.star, 0.8), kk); f.Lc(p.x - d, p.y, ramp(P.star, 0.8), kk); f.Lc(p.x, p.y + d, ramp(P.star, 0.8), kk); f.Lc(p.x, p.y - d, ramp(P.star, 0.8), kk); }
          f.glow(p.x, p.y, 6, ramp(P.star, 0.7), 0.25 * g, 2);
          if (n.ring === 3 && t > 3.6) for (let m = 0; m < 2; m++) { const a = t * (3 + m * 2) + i; f.Lc(p.x + Math.cos(a) * (5 + m * 3), p.y + Math.sin(a) * (3 + m * 2), CYAN, 0.7 * g); }
        });
        // convergence into the crystalline star
        if (t > 7.35 && t < 8.75) {
          const q = inv(7.35, TS, t);
          nodes.forEach((_, i) => { const p = pos(i, t); f.lineL(p.x, p.y, lerp(p.x, K.x, q), lerp(p.y, K.y, q), ramp(P.star, 0.9), 0.8 * (1 - inv(8.2, 8.75, t))); });
        }
        if (t >= TS && t < 8.7) {
          const g = easeOut(inv(TS, TS + 0.3, t), 3);
          const pts: V2[] = Array.from({ length: 16 }, (_, k) => { const a = (k / 16) * TAU + t * 0.2, r = (k % 2 ? 9 : 28) * g; return { x: K.x + Math.cos(a) * r, y: K.y + Math.sin(a) * r * 0.8 }; });
          for (let k = 0; k < 16; k++) { const tri = [K, pts[k], pts[(k + 1) % 16]]; f.polyI(tri, ramp(P.star, k % 2 ? 0.75 : 0.35), 1); }
          f.polyOutlineL(pts, WHITE, 0.8);
          f.discL(K.x, K.y, 2, WHITE, 1.2);
          f.glow(K.x, K.y, 46, ramp(P.void, 0.8), 0.3 * g, 4);
          for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + t * 0.6; f.lineL(K.x, K.y, K.x + Math.cos(a) * 60 * g, K.y + Math.sin(a) * 40 * g, ramp(P.star, 0.9), 0.5); }
          for (const s of streams) {
            const q = (t - s.t0) / 0.35;
            if (q < 0 || q > 1.4) continue;
            const ctl = { x: (K.x + s.p.x) / 2 + (s.p.y - K.y) * 0.3 * s.side, y: (K.y + s.p.y) / 2 - (s.p.x - K.x) * 0.3 * s.side };
            for (let j = 0; j < 24; j++) {
              const u = clamp(q - j * 0.012);
              if (u <= 0 || u > 1 || (q > 1 && u < q - 0.4)) continue;
              const x = lerp(lerp(K.x, ctl.x, u), lerp(ctl.x, s.p.x, u), u), y = lerp(lerp(K.y, ctl.y, u), lerp(ctl.y, s.p.y, u), u);
              f.Lc(x, y, j < 2 ? WHITE : ramp(P.star, 0.85), (1.5 - j / 16) * (q > 1 ? 1.4 - q : 1));
            }
          }
        }
        for (const s of shards) {
          const c = Math.cos(s.rot), si = Math.sin(s.rot);
          const pts = s.pts.map((p) => ({ x: s.x + p.x * c - p.y * si, y: s.y + p.x * si + p.y * c }));
          const g = 1 - inv(8.8, 9.8, t);
          f.poly(pts, (x, y) => f.Id(x, y, ramp(P.star, 0.6 + 0.3 * Math.sin(s.rot * 3)), g));
          f.Lc(pts[1].x, pts[1].y, WHITE, g * (0.6 + 0.6 * Math.sin(t * 7 + s.x)));
        }
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 20 REALITY RIPPER
const realityRipper: SpellDef = {
  id: 20, name: 'Reality Ripper', school: 'ASTRAL', dur: 10.4, climax: 6.3,
  blurb: 'A rendering artifact becomes a wound: the world separates onto another space, collides with it, and stitches itself back out of order.',
  make(rng, fx) {
    const way: V2[] = Array.from({ length: 9 }, (_, i) => { const u = i / 8; return { x: lerp(86, 334, u), y: lerp(62, 172, u) + (i && i < 8 ? rng.r(-11, 11) : 0) }; });
    const cum = [0]; for (let i = 1; i < way.length; i++) cum.push(cum[i - 1] + Math.hypot(way[i].x - way[i - 1].x, way[i].y - way[i - 1].y));
    const LEN = cum[cum.length - 1];
    const N = W * H;
    const tS = new Float32Array(N).fill(-1), tD = new Float32Array(N), tNx = new Float32Array(N), tNy = new Float32Array(N), tTx = new Float32Array(N), tTy = new Float32Array(N);
    const BX0 = 40, BY0 = 16, BX1 = 380, BY1 = 214;
    for (let y = BY0; y <= BY1; y++) for (let x = BX0; x <= BX1; x++) {
      let best = 1e9, bs = 0, bd = 0, bnx = 0, bny = 0, btx = 0, bty = 0;
      for (let i = 0; i < way.length - 1; i++) {
        const a = way[i], b = way[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, l = Math.sqrt(l2);
        const px = x + 0.5 - a.x, py = y + 0.5 - a.y;
        const u = clamp((px * dx + py * dy) / l2);
        const qx = px - dx * u, qy = py - dy * u, d = Math.hypot(qx, qy);
        if (d < best) { best = d; bs = (cum[i] + u * l) / LEN; const sd = dx * py - dy * px >= 0 ? 1 : -1; bd = d * sd; bnx = (-dy / l) * sd; bny = (dx / l) * sd; btx = dx / l; bty = dy / l; }
      }
      if (best < 46) { const k = y * W + x; tS[k] = bs; tD[k] = bd; tNx[k] = bnx; tNy[k] = bny; tTx[k] = btx; tTy[k] = bty; }
    }
    const at = (s: number) => { const L = s * LEN; let i = 0; while (i < cum.length - 2 && cum[i + 1] < L) i++; const u = (L - cum[i]) / (cum[i + 1] - cum[i]); return { x: lerp(way[i].x, way[i + 1].x, u), y: lerp(way[i].y, way[i + 1].y, u), nx: -(way[i + 1].y - way[i].y) / (cum[i + 1] - cum[i]), ny: (way[i + 1].x - way[i].x) / (cum[i + 1] - cum[i]) }; };
    const TOPEN = 3.0, TCOL = 6.6;
    const perm = Array.from({ length: 12 }, (_, i) => i).sort(() => rng.next() - 0.5);
    const width = (s: number, t: number) => {
      if (t < TOPEN) return 0;
      let w = 22 * easeOut(inv(TOPEN, 6.0, t), 2) * Math.pow(Math.sin(Math.PI * s), 0.7) * (1 + 0.35 * (noise3(s * 8, t * 0.6, 1) - 0.5));
      if (t > 6.35 && t < TCOL) w *= 1 + 0.6 * inv(6.35, TCOL, t);
      const k = Math.min(11, Math.floor(s * 12)), tc = 7.15 + perm.indexOf(k) * 0.16;
      return w * (1 - easeIn(inv(tc, tc + 0.22, t), 2));
    };
    const mask = new Uint8Array(N);
    const polys = [
      { v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], e: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] },
      { v: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], e: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]] },
      { v: [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]], e: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] },
    ];
    const proj = (p: number[], ax: number, ay: number, s: number) => { let [x, y, z] = p; let c = Math.cos(ay), si = Math.sin(ay); [x, z] = [x * c + z * si, -x * si + z * c]; c = Math.cos(ax); si = Math.sin(ax); [y, z] = [y * c - z * si, y * si + z * c]; return { x: x * s, y: y * s, z }; };
    const blocks = Array.from({ length: 56 }, (_, i) => { const s = rng.r(0.08, 0.92), side = rng.sign(), d = rng.r(8, 38), p = at(s); const sz = rng.i(5, 9); return { hx: Math.round(p.x + p.nx * d * side - sz / 2), hy: Math.round(p.y + p.ny * d * side - sz / 2), sz, vx: p.nx * side * rng.r(60, 170) + rng.r(-40, 40), vy: p.ny * side * rng.r(60, 170) + rng.r(-40, 40), ret: rng.r(7.3, 9.1), mode: i % 4, mx: p.nx * d * side * 2 }; });
    const ps = new Particles();
    let collided = false;
    const rng2 = new Rng(77);
    void rng2;
    return {
      update(dt, t) {
        ps.update(dt);
        if (t > TOPEN + 0.4 && t < 7.2 && rng.chance(0.6)) { const s = rng.r(0.1, 0.9), p = at(s), w = width(s, t), sd = rng.sign(); ps.add({ x: p.x + p.nx * (w + 1) * sd, y: p.y + p.ny * (w + 1) * sd, vx: -p.nx * sd * rng.r(4, 14), vy: -p.ny * sd * rng.r(4, 14), kind: 'pix', c: rng.chance(0.5) ? MAG : CYAN, k: 1.2, max: rng.r(0.4, 0.9) }); }
        if (!collided && t >= TCOL) {
          collided = true; fx.shake(10); fx.kick(6); fx.flash([1, 0.5, 1], 0.35);
          for (let i = 0; i < 100; i++) { const s = rng.r(0.05, 0.95), p = at(s), sd = rng.sign(); ps.add({ x: p.x, y: p.y, vx: p.nx * sd * rng.r(40, 200), vy: p.ny * sd * rng.r(40, 200), drag: 1.4, kind: 'star', col: P.star, c: rng.chance(0.3) ? MAG : undefined, max: rng.r(0.6, 1.6), k: 1.2 }); }
        }
      },
      render(f, t) {
        const slot = Math.floor(t * 20);
        if (t >= TCOL && t < TCOL + 0.05) fx.invert = 1;
        // the first wrongness: artifacts that look like bugs
        if (t > 0.3 && t < 0.45) for (let x = 130; x < 230; x++) { f.D(x, 92, 3, 0); f.D(x, 93, 3, 0); }
        if (t > 0.6 && t < 0.9) { const x = 180 + t * 20, y = 120 - t * 6; f.Lc(x, y, [0.5, 0.45, 0.6], 1); f.Lc(x + 5, y, [0.5, 0.45, 0.6], 1); }
        if (t > 0.95 && t < 1.2) f.field(232, 120, 246, 128, (x, y) => { f.D(x, y, (hash(slot) - 0.5) * 6, (hash(slot + 1) - 0.5) * 3); f.C(x, y, 2); });
        if (t > 1.2 && t < 1.6) for (let k = 0; k < 24; k++) { const p = at(0.4 + hash(k * 7) * 0.2); if (hash(k + slot * 3) > 0.5) f.L(p.x, p.y, 0.8, 0.8, 0.9); else f.L(p.x, p.y, -0.3, -0.3, -0.3); }
        const span = inv(1.6, TOPEN, t);
        const blocksOut = t >= TCOL;
        if (t >= 1.6 && t < 9.4) {
          mask.fill(0);
          const ts = Math.floor(t * 12);
          const wt = new Float32Array(257);
          for (let i = 0; i <= 256; i++) wt[i] = width(i / 256, t);
          f.field(BX0, BY0, BX1, BY1, (x, y) => {
            const k = y * W + x, s = tS[k];
            if (s < 0) return;
            if (Math.abs(s - 0.5) > span / 2) return;
            const d = tD[k], ad = Math.abs(d), w = wt[Math.round(s * 256)];
            if (t < TOPEN) {
              if (ad < 0.8) f.L(x, y, 1.6, 1.6, 1.8);
              else if (ad < 3) f.C(x, y, 2);
              return;
            }
            const wj = w + (w > 1 ? (hash3(x, y, ts) - 0.5) * 3.2 : 0);
            if (ad < wj) {
              mask[k] = 1;
              // the other space
              const gy = (y - 60) / 150;
              const base = rampD(P.void, 0.12 + gy * 0.2, bayer(x, y));
              let c: RGB = base;
              const n = noise3(x * 0.05, y * 0.05, t * 0.25);
              if (n > 0.62) {
                const bx = 2 * 210 - x + Math.sin(t * 0.7) * 10, by = 2 * 116 - y;
                const bc = f.baseAt(bx, by);
                c = [clamp(1 - bc[0] * 3) * 0.45 + 0.2, clamp(1 - bc[1] * 3) * 0.2, clamp(1 - bc[2] * 3) * 0.5 + 0.15];
              }
              f.Ic(x, y, c, 1);
              if (hash2(Math.floor(x - t * 10), y) > 0.985) f.Lc(x, y, ramp(P.star, 0.8), 0.7);
              if (hash2(Math.floor((x + t * 26) / 2), Math.floor((y + t * 6) / 2)) > 0.965) f.Lc(x, y, WHITE, 1);
              if (((x * 0.7 + y * 0.3 + t * 22) % 37 + 37) % 37 < 1) f.Lc(x, y, CYAN, 0.35);
              f.L(x, y, 0.02, 0, 0.05);
              return;
            }
            if (ad < wj + 1.6 && w > 0.5) { const c = hash3(x, y, ts + 5) > 0.5 ? MAG : CYAN; f.Ic(x, y, c, 1); f.Lc(x, y, c, 1); return; }
            if (w > 1 && ad < 44) {
              const st = Math.floor(s * 48), fall = Math.pow(1 - ad / 44, 2);
              const amp = w * 0.75 * fall * (0.5 + 0.9 * hash(st));
              const sd = d > 0 ? 1 : -1;
              let dx = tNx[k] * sd * amp * 0 + tNx[k] * amp, dy = tNy[k] * amp;
              void sd;
              if (hash(st + 77) > 0.86) { const off = (hash(st + 9) - 0.5) * 44 * fall; dx += tTx[k] * off; dy += tTy[k] * off; }
              f.D(x, y, dx, dy);
              if (hash(st + 31) > 0.9) f.C(x, y, 1.5);
            }
          });
          // impossible geometry inside the tear (clipped by the mask)
          polys.forEach((pl, i) => {
            const s0 = ((0.2 + i * 0.27 + t * 0.035) % 0.8) + 0.1, p = at(s0);
            const ex = blocksOut ? clamp((t - TCOL) / 0.7) : 0;
            const sc = (6 + i * 1.5) * (1 + ex * 4);
            const cx = p.x + p.nx * (i - 1) * 6, cy = p.y + p.ny * (i - 1) * 6;
            const vs = pl.v.map((v) => proj(v, t * (0.7 + i * 0.3), t * (1.1 - i * 0.2), sc));
            for (const [a, b] of pl.e) f.line(cx + vs[a].x, cy + vs[a].y, cx + vs[b].x, cy + vs[b].y, (x, y) => {
              const inside = mask[y * W + x] === 1;
              if (!inside && !ex) return;
              f.Lc(x, y, i === 1 ? MAG : CYAN, ex ? 1.2 * (1 - ex) : 1);
            });
            // the passage: what enters here leaves elsewhere
            if (t > 3.8 && t < 6.4 && i === 0) {
              const sp = 0.15 + (t - 3.8) * 0.12, q = at(sp), q2 = at(1 - sp);
              f.ring(q.x, q.y, 3, (x, y) => { if (mask[y * W + x]) f.Lc(x, y, GOLDW, 1.2); });
              const out = 8 + (t - 3.8) * 6;
              f.ringL(q2.x + q2.nx * (width(1 - sp, t) + out), q2.y + q2.ny * (width(1 - sp, t) + out), 3, GOLDW, 1.2);
            }
          });
        }
        // world fragments flung out by the collision, returning by impossible routes
        if (blocksOut) {
          const a = t - TCOL;
          for (const b of blocks) {
            const oa = Math.min(a, 1.3), out = { x: b.hx + b.vx * oa * (1 - oa / 2.6), y: b.hy + b.vy * oa * (1 - oa / 2.6) };
            let p = out;
            if (t >= b.ret) {
              const q = clamp((t - b.ret) / 0.6);
              if (q >= 1) continue;
              if (b.mode === 0) p = { x: lerp(out.x, b.hx, easeInOut(q)), y: lerp(out.y, b.hy, easeInOut(q)) };
              else if (b.mode === 1) p = { x: lerp(b.hx - b.mx * 3, b.hx, q), y: b.hy };
              else if (b.mode === 2) { const ang = q * TAU * 2, r = (1 - q); p = { x: b.hx + ((out.x - b.hx) * Math.cos(ang) - (out.y - b.hy) * Math.sin(ang)) * r, y: b.hy + ((out.x - b.hx) * Math.sin(ang) + (out.y - b.hy) * Math.cos(ang)) * r }; }
              else continue;
            }
            for (let y = 0; y < b.sz; y++) for (let x = 0; x < b.sz; x++) { f.I(b.hx + x, b.hy + y, VOID_INK[0], VOID_INK[1], VOID_INK[2], 1); if (hash2(b.hx + x, b.hy + y) > 0.95) f.Lc(b.hx + x, b.hy + y, ramp(P.star, 0.8), 0.7); }
            f.blitBase(b.hx, b.hy, b.sz, b.sz, Math.round(p.x), Math.round(p.y));
            f.Lc(p.x, p.y, b.mode % 2 ? MAG : CYAN, 0.8); f.Lc(p.x + b.sz - 1, p.y + b.sz - 1, b.mode % 2 ? CYAN : MAG, 0.8);
          }
          if (a < 0.7) for (let k = 0; k < 5; k++) { const p = at(0.1 + k * 0.2); shock(f, p.x, p.y, a * 190, 14, 9 * (1 - a / 0.7), 1, 3); }
        }
        // one stubborn region stays wrong a moment longer
        if (t > 9.3 && t < 9.85) {
          const p = at(0.62), bx = Math.round(p.x + p.nx * 7), by = Math.round(p.y + p.ny * 7);
          for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) { const c = f.baseAt(bx + x + 2, by + y); f.I(bx + x, by + y, 1 - c[0] * 2.5, 1 - c[1] * 3, 1 - c[2] * 2, hash(slot + x) > 0.2 ? 1 : 0); f.C(bx + x, by + y, 2); }
        }
        if (t >= 9.85 && t < 9.9) { const p = at(0.62); f.L(p.x + p.nx * 7 + 3, p.y + p.ny * 7 + 2, 2, 2, 2); }
        ps.render(f);
      },
    };
  },
};

export const ASTRAL: SpellDef[] = [eventHorizon, chronoshard, constellationEngine, realityRipper];
void H; void hash3; void easeIn;
