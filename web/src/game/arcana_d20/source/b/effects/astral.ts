import { Effect, sparkle } from '../engine/fx';
import { Renderer, ADD, SET, BLEND, DITHER, W, H, bayer } from '../engine/renderer';
import { Col, RNG, TAU, clamp, lerp, inv, smooth, easeOut, easeIn, easeInOut, easeOutBack, hash, hash2, fly, V, pulse, scale, noise1 } from '../engine/math';

const STAR: Col = [2.4, 2.2, 1.7];
const MAG: Col = [1.4, 0.3, 1.3];
const INDIGO: Col = [0.25, 0.1, 0.7];
const CYAN: Col = [0.4, 1.4, 1.8];
const fr = (t: number, r = 30) => Math.floor(t * r);

// =====================================================================================
// 17 — EVENT HORIZON
// =====================================================================================
export const eventHorizon: Effect = {
  id: 17, name: 'Event Horizon', school: 'ASTRAL', duration: 9.5, climax: 4.8,
  blurb: 'A region loses visual information. The floor itself lenses and drags; light piles up in two counter-rotating disks.',
  setup(r) {
    const rng = new RNG(1717);
    const disk = Array.from({ length: 420 }, (_, i) => ({ r: rng.r(1.5, 4.6), a: rng.r(0, TAU), d: i % 3 === 0 ? 1 : 0, s: i }));
    const orb = Array.from({ length: 16 }, (_, i) => ({ r0: rng.r(28, 70), a0: rng.r(0, TAU), e: rng.r(0.1, 0.4), prec: rng.r(0.2, 0.6), fall: i % 4 === 0 ? rng.r(2, 4.5) : 99, dir: i % 3 === 0 ? -1 : 1 }));
    return { disk, orb };
  },
  render(r, t, s) {
    const C = { x: r.target.x - 30, y: r.target.y + 8 };
    const TCmp = 5.0, TDark = 5.65, TReb = 6.0;
    const Rh = 13 * smooth(1.2, 3.8, t) * (1 - easeIn(inv(TCmp, TDark - 0.1, t)) * 0.95) + 1.2 * smooth(0, 1.2, t);
    const intensity = smooth(1.5, 4.5, t);
    if (t > TDark) return;
    r.ambient = 0.6 - intensity * 0.2;
    const col = (k: number) => 1 - smooth(TCmp + k * 0.1, TCmp + 0.3 + k * 0.1, t);
    // back halves of the accretion disks (get lensed in post)
    for (const p of s.disk) {
      const cK = col(p.d ? 1 : 0);
      if (cK <= 0) continue;
      const rr = p.r * Rh * (0.3 + 0.7 * cK);
      const w = (p.d ? -1 : 1) * 3.5 / Math.pow(p.r, 1.5);
      const a = p.a + w * t;
      const tilt = p.d ? -0.55 : 0.18, sq = p.d ? 0.5 : 0.28;
      const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * sq;
      if (Math.sin(a) > 0) continue; // front half drawn in post
      const x = C.x + lx * Math.cos(tilt) - ly * Math.sin(tilt), y = C.y + lx * Math.sin(tilt) + ly * Math.cos(tilt);
      const dop = 1 + 0.7 * Math.cos(a);
      r.px(x, y, p.d ? CYAN : p.r < 2.5 ? STAR : MAG, 0.5 * dop * intensity);
    }
    // stellar fragments on precessing, accelerating orbits — some spiral in
    for (const o of s.orb) {
      const cK = col(2);
      if (cK <= 0) continue;
      for (let k = 0; k < 14; k++) {
        const tt = t - k * 0.02;
        const fall = clamp((tt - o.fall) / 1.4);
        const rr = o.r0 * (1 - fall) * (0.3 + 0.7 * cK) * (0.5 + 0.5 * smooth(0.5, 2.5, tt));
        if (rr < Rh) break;
        const om = o.dir * 20 / Math.pow(rr, 0.9);
        const a = o.a0 + om * tt;
        const ell = 1 + o.e * Math.cos(a - o.prec * tt);
        const x = C.x + Math.cos(a) * rr * ell, y = C.y + Math.sin(a) * rr * ell * 0.6;
        r.px(x, y, k === 0 ? STAR : MAG, (1 - k / 14) * (k === 0 ? 1.6 : 0.6) * smooth(0.3, 1.5, t));
      }
    }
    // fragmented geometric rings at different depths
    [[2.2, 6, 0.6, 1], [3.4, 8, -0.4, 0.5], [5, 5, 0.25, 0.75]].forEach(([k, n, w, sq], i) => {
      const cK = col(3 + i);
      if (cK <= 0) return;
      const rr = Rh * k * cK;
      for (let j = 0; j < n; j++) {
        if ((j + i) % 3 === 0) continue;
        const a0 = w * t + (j / n) * TAU, a1 = a0 + (TAU / n) * 0.7;
        r.line(C.x + Math.cos(a0) * rr, C.y + Math.sin(a0) * rr * sq, C.x + Math.cos(a1) * rr, C.y + Math.sin(a1) * rr * sq, i === 1 ? CYAN : INDIGO, 0.8 * intensity * cK + 0.1);
      }
    });
    r.light(C.x, C.y, 80, [0.8, 0.4, 1.2], intensity * 0.6);
  },
  post(r, t, s) {
    const C = { x: r.target.x - 30, y: r.target.y + 8 };
    const TCmp = 5.0, TDark = 5.65, TReb = 6.0;
    const Rh = 13 * smooth(1.2, 3.8, t) * (1 - easeIn(inv(TCmp, TDark - 0.1, t)) * 0.95) + 1.2 * smooth(0, 1.2, t);
    const intensity = smooth(1.5, 4.5, t);
    if (t < TDark) {
      // gravitational lens with frame-dragging, quantised into pixel bands
      const E = Rh * 1.6 + 2;
      const R = E * 7;
      r.warp(C.x - R, C.y - R, C.x + R, C.y + R, (x, y, o) => {
        const dx = x - C.x, dy = (y - C.y) / 0.8, d = Math.hypot(dx, dy);
        if (d > R || d < 0.5) return;
        let sd = d - (E * E) / d * (1 - d / R);
        sd = Math.round(sd / 2) * 2;
        const a = Math.atan2(dy, dx) + (0.9 * E / (d + 2)) * (1 - d / R) * Math.sin(t * 0.0 + 1);
        const k = sd < 0 ? 0 : sd;
        o[0] = C.x + Math.cos(a) * k; o[1] = C.y + Math.sin(a) * k * 0.8;
      });
      // the absence + einstein ring
      r.disc(C.x, C.y, Rh, [0, 0, 0], 1, SET, 0.8);
      r.ring(C.x, C.y, Rh + 1, 1, STAR, 0.6 + intensity * 0.8, ADD, 0.8);
      r.ring(C.x, C.y, Rh + 2.5, 1, MAG, 0.4 * intensity, ADD, 0.8);
      // front halves pass over the hole
      const col = (k: number) => 1 - smooth(TCmp + k * 0.1, TCmp + 0.3 + k * 0.1, t);
      for (const p of s.disk) {
        const cK = col(p.d ? 1 : 0);
        if (cK <= 0) continue;
        const rr = p.r * Rh * (0.3 + 0.7 * cK);
        const w = (p.d ? -1 : 1) * 3.5 / Math.pow(p.r, 1.5);
        const a = p.a + w * t;
        if (Math.sin(a) <= 0) continue;
        const tilt = p.d ? -0.55 : 0.18, sq = p.d ? 0.5 : 0.28;
        const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * sq;
        const x = C.x + lx * Math.cos(tilt) - ly * Math.sin(tilt), y = C.y + lx * Math.sin(tilt) + ly * Math.cos(tilt);
        const dop = 1 + 0.7 * Math.cos(a);
        r.px(x, y, p.d ? CYAN : p.r < 2.5 ? STAR : MAG, 0.6 * dop * intensity);
      }
      if (t > TCmp) r.disc(C.x, C.y, 1, STAR, 3 * pulse(TCmp, TDark, t));
    } else if (t < TReb) {
      // absolute darkness
      r.c.fill(0);
      if (t > TReb - 0.08) r.disc(C.x, C.y, 1, STAR, 3);
    } else {
      // rebound: a gravitational wave carries the world's pixels outward, then they settle
      const e = t - TReb;
      const R = e * 170;
      const A = 18 * Math.exp(-e * 1.4);
      r.warp(0, 0, W - 1, H - 1, (x, y, o) => {
        const dx = x - C.x, dy = (y - C.y) / 0.8, d = Math.hypot(dx, dy) || 1;
        const env = Math.exp(-Math.pow((d - R) / 30, 2));
        const k = Math.sin((d - R) * 0.18) * A * env + (d < R ? A * 0.3 * Math.exp(-(R - d) / 40) : 0);
        if (Math.abs(k) < 0.5) return;
        o[0] = x - (dx / d) * k; o[1] = y - (dy / d) * k * 0.8;
      });
      if (e < 0.1) r.flash = 0.6;
      r.ring(C.x, C.y, R, 1.5, MAG, 1.2 * Math.exp(-e * 1.5), ADD, 0.8);
      r.ring(C.x, C.y, R * 0.85, 1, CYAN, 0.8 * Math.exp(-e * 1.5), ADD, 0.8);
      for (let k = 0; k < 40; k++) {
        const a = hash(k) * TAU, rr = R * (0.7 + hash(k + 1) * 0.5);
        const life = Math.exp(-e * 0.9);
        sparkle(r, C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * 0.8, 1, STAR, life);
      }
      if (e < 0.5) { r.shakeX = (hash(t * 30) - 0.5) * 6; r.shakeY = (hash(t * 31) - 0.5) * 4; }
    }
  },
};

// =====================================================================================
// 18 — CHRONOSHARD
// =====================================================================================
type Cry = { tau: number; pos: V[]; mode: number; ta: number };
export const chronoshard: Effect = {
  id: 18, name: 'Chronoshard', school: 'ASTRAL', duration: 10, climax: 5.2,
  blurb: 'Time as material: crystals hold the same attack at different moments. Effects arrive before causes.',
  setup(r) {
    const A = { x: r.caster.x + 6, y: r.caster.y - 14 }, B = { x: r.target.x, y: r.target.y - 4 };
    const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 - 6 };
    const rng = new RNG(1818);
    const conf = (k: number) => Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * TAU + k * 1.1 + rng.r(-0.3, 0.3);
      return { x: M.x + Math.cos(a) * rng.r(55, 85), y: M.y + Math.sin(a) * rng.r(40, 60) };
    });
    const c0 = conf(0), c1 = conf(1), c2 = conf(2);
    const crys: Cry[] = [
      { tau: 0.3, mode: 0, ta: 3.9 }, { tau: 1.45, mode: 1, ta: 4.3 }, { tau: 1.15, mode: 2, ta: 4.75 }, { tau: 0.65, mode: 3, ta: 5.05 }, { tau: 0.9, mode: 3, ta: 5.05 },
    ].map((c, i) => ({ ...c, pos: [c0[i], c1[i], c2[i]] }));
    return { A, B, M, crys };
  },
  render(r, t, s) {
    const { A, B, M } = s;
    const crys: Cry[] = s.crys;
    // the attack as a pure function of its own time τ: projectile 0..1, impact 1..2
    const attack = (tau: number, tint: Col, k = 1) => {
      if (tau < 0 || tau > 2.2) return;
      if (tau <= 1) {
        const x = lerp(A.x, B.x, tau), y = lerp(A.y, B.y, tau) - Math.sin(tau * Math.PI) * 24;
        for (let m = 1; m < 10; m++) {
          const tt = Math.max(0, tau - m * 0.025);
          r.disc(lerp(A.x, B.x, tt), lerp(A.y, B.y, tt) - Math.sin(tt * Math.PI) * 24, 3 - m * 0.25, tint, k * (1 - m / 10) * 0.7);
        }
        const rot = tau * 20;
        const pts: number[] = [];
        for (let q = 0; q < 4; q++) pts.push(x + Math.cos(rot + q * Math.PI / 2) * (q % 2 ? 3 : 6), y + Math.sin(rot + q * Math.PI / 2) * (q % 2 ? 3 : 6));
        r.poly(pts, STAR, k);
        r.glow(x, y, 12, tint, k * 0.8);
      } else {
        const e = tau - 1;
        r.ring(B.x, B.y, easeOut(e / 1.2) * 34, 1.5, tint, k * (1 - e / 1.2) * 1.5, ADD, 0.7);
        r.ring(B.x, B.y, easeOut(e / 0.8) * 18, 1, STAR, k * clamp(1 - e / 0.8) * 1.5, ADD, 0.7);
        for (let q = 0; q < 24; q++) {
          const a = hash(q) * TAU, v = 30 + hash(q + 1) * 50;
          const x = fly(B.x, Math.cos(a) * v, 1.5, 0, e), y = fly(B.y, Math.sin(a) * v * 0.7 - 20, 1.5, 60, e);
          r.px(x, y, q % 3 ? tint : STAR, k * clamp(1.4 - e) * 1.4);
        }
        if (e < 0.3) r.glow(B.x, B.y, 26, tint, k * (1 - e / 0.3) * 1.5);
      }
    };
    const GOLDT: Col = [1.8, 1.3, 0.5], BLUET: Col = [0.5, 0.9, 2.0], PURE: Col = [1.4, 0.8, 1.8];
    const FREEZE = 3.45, RESUME = 5.15, SYNC = 6.0;
    // ---- caster gesture with echoes of past and future
    const gesture = (g: number, tint: Col, k: number) => {
      const a = -2.4 + g * 3.4;
      for (let q = 0; q < 12; q++) {
        const aa = a - q * 0.08;
        r.px(A.x + Math.cos(aa) * 13, A.y + 6 + Math.sin(aa) * 9, tint, k * (1 - q / 12) * 1.4);
      }
      r.disc(A.x + Math.cos(a) * 13, A.y + 6 + Math.sin(a) * 9, 1.5, tint, k * 1.5);
    };
    if (t < 3.2) {
      const g = clamp(t / 1.6);
      const fade = 1 - smooth(2.4, 3.2, t);
      gesture(g, PURE, fade);
      [-0.45, -0.25, 0.25, 0.45].forEach((o) => gesture(clamp(g + o), o < 0 ? BLUET : GOLDT, 0.45 * fade * smooth(0.2, 0.6, t)));
    }
    // ---- central attack: launched, frozen mid-flight, resumed late
    let tauC = -1;
    if (t > 3.0) tauC = t < FREEZE ? (t - 3.0) / 1.1 : t < RESUME ? (FREEZE - 3.0) / 1.1 : (FREEZE - 3.0) / 1.1 + (t - RESUME) / 0.35;
    if (t < SYNC + 0.3) attack(tauC, PURE, 1);
    // ---- crystals holding frozen moments
    const form = smooth(1.4, 2.4, t);
    if (form > 0 && t < SYNC + 0.05) {
      crys.forEach((c, i) => {
        const u1 = easeInOut(inv(2.6, 3.3, t)), u2 = easeInOut(inv(3.6, 4.2, t));
        let px = lerp(lerp(c.pos[0].x, c.pos[1].x, u1), c.pos[2].x, u2), py = lerp(lerp(c.pos[0].y, c.pos[1].y, u1), c.pos[2].y, u2);
        const sy = easeIn(inv(SYNC - 0.45, SYNC, t));
        px = lerp(px, M.x, sy); py = lerp(py, M.y, sy);
        const rot = t * (0.4 + i * 0.15) * (i % 2 ? 1 : -1);
        const R = 17 * form * (1 - sy * 0.5);
        const hex: number[] = [];
        for (let q = 0; q < 6; q++) hex.push(px + Math.cos(rot + (q / 6) * TAU) * R, py + Math.sin(rot + (q / 6) * TAU) * R * 0.85);
        const inHex = (x: number, y: number) => {
          let inside = false;
          for (let a = 0, b = 5; a < 6; b = a++) {
            const xa = hex[a * 2], ya = hex[a * 2 + 1], xb = hex[b * 2], yb = hex[b * 2 + 1];
            if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
          }
          return inside;
        };
        r.poly(hex, [0.03, 0.02, 0.08], 0.75, BLEND);
        // contents: the same attack at the crystal's stored instant, transformed and clipped
        let tau = c.tau;
        if (c.mode === 3 && t > c.ta) tau = c.tau + Math.sin((t - c.ta) * 6) * 0.3;
        r.clip = inHex;
        r.ts = 0.42; r.tx = px - M.x * 0.42; r.ty = py - M.y * 0.42;
        attack(tau, i % 2 ? BLUET : GOLDT, t > c.ta && c.mode < 3 ? 0.3 : 1);
        r.ts = 1; r.tx = 0; r.ty = 0; r.clip = null;
        // faceted frame
        r.polyline(hex, [1.2, 1.4, 2.0], 1, ADD, true);
        for (let q = 0; q < 6; q += 2) r.line(px, py, hex[q * 2], hex[q * 2 + 1], [0.6, 0.6, 1.2], 0.35);
        sparkle(r, hex[2], hex[3], 2, STAR, 0.6 + 0.4 * Math.sin(t * 5 + i));
        r.light(px, py, 30, [0.8, 0.7, 1.4], 0.4);
      });
    }
    // ---- cascade of displaced causes & effects
    crys.forEach((c, i) => {
      const e = t - c.ta;
      if (e < 0 || t > SYNC + 0.4) return;
      if (c.mode === 0) attack(c.tau + e * 1.6, GOLDT, 0.9); // completes a movement that should have happened earlier
      if (c.mode === 1) attack(c.tau - e * 1.5, BLUET, 0.9); // runs in reverse: impact un-happens
      if (c.mode === 2) {
        // releases trapped particles into the present; they reconstruct their shape, then go
        for (let q = 0; q < 30; q++) {
          const a = hash(q + 9) * TAU;
          const rr = e < 0.5 ? (1 - e / 0.5) * 30 + 4 : 4 + (e - 0.5) * 90;
          r.px(B.x + Math.cos(a) * rr, B.y + Math.sin(a) * rr * 0.7, q % 2 ? GOLDT : STAR, 1.2 * clamp(1.5 - e));
        }
      }
      if (c.mode === 3) [0.2, 0.5, 0.8, 1.3].forEach((tt, q) => attack(tt + Math.sin(e * 3 + q) * 0.05, q % 2 ? BLUET : GOLDT, 0.45));
    });
    // ---- synchronisation: crystalline shockwave restores time
    if (t > SYNC) {
      const e = t - SYNC;
      if (e < 0.08) r.flash = 0.5;
      const R = easeOut(e / 1.4) * 260;
      const pts: number[] = [];
      for (let q = 0; q < 14; q++) { const a = (q / 14) * TAU + e; const rr = R * (q % 2 ? 0.94 : 1); pts.push(M.x + Math.cos(a) * rr, M.y + Math.sin(a) * rr * 0.75); }
      r.polyline(pts, [1.4, 1.6, 2.4], 1.6 * (1 - clamp(e / 1.4)), ADD, true);
      for (let q = 0; q < 40; q++) {
        const a = hash(q) * TAU, v = 40 + hash(q + 2) * 120;
        const x = M.x + Math.cos(a) * fly(0, v, 1, 0, e), y = M.y + Math.sin(a) * fly(0, v, 1, 0, e) * 0.75;
        const life = 1 - smooth(1.5, 3, e);
        if (life > 0) r.poly([x, y - 2, x + 1.5, y, x, y + 2, x - 1.5, y], [1.2, 1.4, 2.2], life);
      }
    }
  },
  post(r, t, s) {
    // frozen time: the world drains of colour; the shockwave restores it
    const FREEZE = 3.45, SYNC = 6.0;
    const k = smooth(FREEZE, FREEZE + 0.15, t);
    if (k <= 0) return;
    const M = s.M;
    const R = t > SYNC ? easeOut((t - SYNC) / 1.4) * 260 : -1;
    const c = r.c;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (R > 0 && Math.hypot(x - M.x, (y - M.y) / 0.75) < R) continue;
        const i = (y * W + x) * 3;
        const l = c[i] * 0.3 + c[i + 1] * 0.55 + c[i + 2] * 0.15;
        c[i] = lerp(c[i], l * 0.8, k); c[i + 1] = lerp(c[i + 1], l * 0.9, k); c[i + 2] = lerp(c[i + 2], l * 1.25, k);
      }
  },
};

// =====================================================================================
// 19 — CONSTELLATION ENGINE
// =====================================================================================
export const constellationEngine: Effect = {
  id: 19, name: 'Constellation Engine', school: 'ASTRAL', duration: 10.5, climax: 7.3,
  blurb: 'Scattered stars search for a solution, slide into nested orbits, synchronise, and forge a crystalline star.',
  setup(r) {
    const rng = new RNG(1919);
    const C = { x: W / 2 + 24, y: H / 2 - 2 };
    const rings = [{ n: 3, R: 24, w: 1.1 }, { n: 4, R: 46, w: -0.7 }, { n: 5, R: 72, w: 0.45 }];
    const nodes: { ring: number; j: number; sx: number; sy: number; tm: number; ph: number }[] = [];
    rings.forEach((g, ri) => { for (let j = 0; j < g.n; j++) nodes.push({ ring: ri, j, sx: rng.r(30, W - 30), sy: rng.r(20, H - 20), tm: rng.r(2.5, 3.6), ph: rng.r(0, TAU) }); });
    return { C, rings, nodes };
  },
  render(r, t, s) {
    const C = s.C;
    const TS = 6.6, TST = 7.0, TFR = 7.9;
    r.ambient = 0.55 - smooth(0, 3, t) * 0.25;
    const sync = smooth(5.2, TS, t);
    const posOf = (n: any) => {
      const g = s.rings[n.ring];
      const wob = Math.sin(t * 1.3 + n.ph) * 0.3 * (1 - sync);
      const ang = -Math.PI / 2 + (n.j / g.n) * TAU + g.w * Math.min(0, t - TS) * (1 + (1 - sync) * 0.5) + wob;
      const ex = C.x + Math.cos(ang) * g.R * 1.25, ey = C.y + Math.sin(ang) * g.R * 0.72;
      const u = easeInOut(inv(n.tm, n.tm + 1.1, t));
      // nodes slide along a curved path from scattered to orbital
      return { x: lerp(n.sx, ex, u) + Math.sin(u * Math.PI) * 20, y: lerp(n.sy, ey, u), ang };
    };
    const P = s.nodes.map(posOf);
    const fr2 = 1 - smooth(TST, TST + 0.1, t);
    // search: flickering hypotheses of connection
    if (t > 1.0 && t < 3.8) {
      const win = Math.floor(t / 0.18);
      for (let q = 0; q < 6; q++) {
        const a = Math.floor(hash(win * 7 + q) * P.length), b = Math.floor(hash(win * 7 + q + 3) * P.length);
        if (a === b) continue;
        const ph = (t / 0.18) % 1;
        const n = Math.ceil(Math.hypot(P[b].x - P[a].x, P[b].y - P[a].y) / 3);
        for (let k = 0; k <= n * Math.min(1, ph * 2); k++) r.px(lerp(P[a].x, P[b].x, k / n), lerp(P[a].y, P[b].y, k / n), INDIGO, 0.8 * (1 - ph));
      }
    }
    // engine: ribbons within rings, transforming polygons → star polygons
    const eng = smooth(3.4, 4.2, t) * fr2;
    if (eng > 0) {
      let idx = 0;
      const morph = smooth(4.6, 5.2, t);
      s.rings.forEach((g: any, ri: number) => {
        const ids = Array.from({ length: g.n }, (_, j) => idx + j);
        idx += g.n;
        for (let j = 0; j < g.n; j++) {
          const a = P[ids[j]];
          for (const [step, wgt] of [[1, 1 - morph * (g.n > 4 ? 1 : 0.4)], [2, g.n > 3 ? morph : 0]] as [number, number][]) {
            if (wgt <= 0.02) continue;
            const b = P[ids[(j + step) % g.n]];
            const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
            const nx = -dy / L, ny = dx / L;
            const sh = Math.sin(t * 3 + j + ri) * 1.2;
            r.line(a.x + nx * sh, a.y + ny * sh, b.x + nx * sh, b.y + ny * sh, ri === 1 ? CYAN : [0.9, 0.7, 1.6], eng * wgt * 0.7);
            r.line(a.x - nx * sh, a.y - ny * sh, b.x - nx * sh, b.y - ny * sh, ri === 1 ? CYAN : [0.9, 0.7, 1.6], eng * wgt * 0.4);
            // pulses travelling, splitting at nodes
            const pp = ((t * 0.9 + j * 0.37 + ri * 0.21) % 1);
            r.disc(lerp(a.x, b.x, pp), lerp(a.y, b.y, pp), 1, STAR, eng * wgt * 1.4);
          }
        }
      });
      // cross-ring bridges when angular alignment occurs
      for (let i = 0; i < P.length; i++)
        for (let j = i + 1; j < P.length; j++) {
          if (s.nodes[i].ring === s.nodes[j].ring) continue;
          const da = Math.abs(Math.atan2(Math.sin(P[i].ang - P[j].ang), Math.cos(P[i].ang - P[j].ang)));
          if (da < 0.22) r.line(P[i].x, P[i].y, P[j].x, P[j].y, STAR, eng * (1 - da / 0.22) * 1.2);
        }
      // nested orbit guides
      s.rings.forEach((g: any) => { for (let a = 0; a < TAU; a += 0.05) if ((a * 20 + t * 3) % 2 < 1) r.px(C.x + Math.cos(a) * g.R * 1.25, C.y + Math.sin(a) * g.R * 0.72, INDIGO, eng * 0.6); });
    }
    // convergence lines
    const conv = smooth(TS - 0.2, TST, t) * fr2;
    if (conv > 0) P.forEach((p: any) => r.line(p.x, p.y, lerp(p.x, C.x, conv), lerp(p.y, C.y, conv), STAR, 1.2));
    // nodes themselves
    if (t < TST + 0.05)
      P.forEach((p: any, i: number) => {
        const tw = smooth(0.1 + i * 0.06, 0.6 + i * 0.06, t) * (0.7 + 0.3 * Math.sin(t * (2 + hash(i) * 3) + i));
        sparkle(r, p.x, p.y, 2 + (s.nodes[i].ring === 2 ? 1 : 0), STAR, tw * 1.4);
        r.light(p.x, p.y, 22, [1, 0.9, 1.3], tw * 0.4);
      });
    // the crystalline star
    if (t > TST) {
      const e = t - TST;
      const g = easeOutBack(clamp(e / 0.35));
      const N = 12;
      const verts: V[] = [];
      for (let q = 0; q < N * 2; q++) { const a = (q / (N * 2)) * TAU - Math.PI / 2; const rr = (q % 2 ? 6 : q % 4 === 0 ? 24 : 15) * g; verts.push({ x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr * 0.9 }); }
      const frac = t - TFR;
      for (let q = 0; q < verts.length; q++) {
        const a = verts[q], b = verts[(q + 1) % verts.length];
        let ox = 0, oy = 0, rot = 0, life = 1;
        if (frac > 0) {
          const ang = Math.atan2((a.y + b.y) / 2 - C.y, (a.x + b.x) / 2 - C.x);
          const d = fly(0, 18 + hash(q) * 25, 0.8, 0, frac);
          ox = Math.cos(ang) * d; oy = Math.sin(ang) * d; rot = (hash(q + 4) - 0.5) * frac * 2;
          life = 1 - smooth(1.2, 2.6, frac);
        }
        if (life <= 0) continue;
        const cx = (C.x + a.x + b.x) / 3 + ox, cy = (C.y + a.y + b.y) / 3 + oy;
        const tri = [C.x, C.y, a.x, a.y, b.x, b.y].map((v, k) => (k % 2 ? v + oy : v + ox));
        const cs = Math.cos(rot), sn = Math.sin(rot);
        for (let k = 0; k < 6; k += 2) { const lx = tri[k] - cx, ly = tri[k + 1] - cy; tri[k] = cx + lx * cs - ly * sn; tri[k + 1] = cy + lx * sn + ly * cs; }
        const sh = q % 2 ? 0.55 : 1;
        r.poly(tri, scale([0.9, 0.85, 1.3], sh), life, frac > 0 ? DITHER : SET);
        r.polyline(tri, STAR, life * 0.8, ADD, true);
        if (frac > 0 && hash(q + fr(t, 8)) > 0.8) sparkle(r, cx, cy, 2, STAR, life);
      }
      r.glow(C.x, C.y, 20, [1.0, 0.9, 1.4], (frac > 0 ? 0.25 : 0.5) * g);
      r.light(C.x, C.y, 160, [1.1, 1, 1.5], 1.4 * (1 - smooth(TFR, TFR + 2, t)));
      // choreographed streams of light
      if (e < TFR - TST + 0.2) {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + Math.sin(e * 2.5 + k) * 0.6 * (k % 2 ? 1 : -1) + e * 0.8;
          const L = easeOut(e / 0.3) * 200;
          for (let q = 26; q < L; q += 1) r.px(C.x + Math.cos(a) * q, C.y + Math.sin(a) * q * 0.9, q % 9 < 6 ? STAR : CYAN, 1.3 * (1 - q / 220));
        }
      }
    }
  },
};

// =====================================================================================
// 20 — REALITY RIPPER
// =====================================================================================
export const realityRipper: Effect = {
  id: 20, name: 'Reality Ripper', school: 'ASTRAL', duration: 11.5, climax: 5.35,
  blurb: 'A rendering artifact grows into a wound in the frame itself, exposing another space with its own rules.',
  setup(r) {
    const rng = new RNG(2020);
    const pts: V[] = [];
    const a = { x: 70, y: 36 }, b = { x: 336, y: 186 };
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const j = i === 0 || i === N ? 0 : (noise1(u * 7 + 3) - 0.5) * 34 + rng.r(-3, 3);
      pts.push({ x: lerp(a.x, b.x, u) + j * 0.55, y: lerp(a.y, b.y, u) - j * 0.85 });
    }
    const nrm = pts.map((p, i) => {
      const q0 = pts[Math.max(0, i - 1)], q1 = pts[Math.min(N, i + 1)];
      const dx = q1.x - q0.x, dy = q1.y - q0.y, L = Math.hypot(dx, dy) || 1;
      return { x: -dy / L, y: dx / L };
    });
    const sec = pts.map((_, i) => ({ to: 1.6 + Math.abs(i - N * 0.55) / N * 2.2 + rng.r(0, 0.4), tc: 6.6 + rng.r(0, 2.6), w: 14 + rng.r(0, 16) * Math.sin((i / N) * Math.PI) }));
    const shards = Array.from({ length: 70 }, (_, i) => ({ i: rng.i(2, N - 2), v: rng.r(40, 160), s: rng.r(2, 6), spin: rng.r(-6, 6), side: rng.sign(), shape: [rng.r(0, TAU), rng.r(0, TAU), rng.r(0, TAU)] }));
    const cubes = Array.from({ length: 4 }, (_, i) => ({ x: rng.r(60, 320), y: rng.r(30, 190), z: rng.r(1, 3), sp: rng.r(-1, 1), s: rng.r(8, 22) }));
    return { pts, nrm, sec, shards, cubes, N, mask: new Float32Array(W * H * 3) };
  },
  render(r, t, s) {
    r.ambient = 0.6 - smooth(2, 5, t) * 0.15 + smooth(8, 10, t) * 0.15;
    // first: a single drifting mote that briefly duplicates
    if (t < 2.2) {
      const mx = 150 + t * 12, my = 60 + Math.sin(t * 2) * 3;
      r.disc(mx, my, 1, [0.8, 0.8, 1], 0.9);
      if (pulse(0.7, 1.0, t) > 0) r.disc(mx + 7, my - 1, 1, [0.8, 0.8, 1], 0.9);
    }
    // a luminous wanderer that enters the tear at one point and exits elsewhere
    const A = s.pts[18], B = s.pts[36];
    if (t > 2.6 && t < 4.0) {
      const u = easeIn(inv(2.6, 3.7, t));
      const x = lerp(A.x - 70, A.x, u), y = lerp(A.y + 40, A.y, u);
      if (u < 1) { r.disc(x, y, 2.5, CYAN, 1.4); r.glow(x, y, 9, CYAN, 0.7); r.light(x, y, 30, [0.5, 1.2, 1.6], 0.6); }
    }
    if (t > 4.15 && t < 6) {
      const u = easeOut(inv(4.15, 5.6, t));
      const x = lerp(B.x, B.x + 60, u), y = lerp(B.y, B.y - 70, u);
      r.disc(x, y, 2.5, MAG, 1.4); r.glow(x, y, 9, MAG, 0.7); r.light(x, y, 30, [1.4, 0.4, 1.3], 0.6);
    }
  },
  post(r, t, s) {
    const pts: V[] = s.pts, nrm: V[] = s.nrm, N = s.N;
    const TCOL = 5.65;
    const width = (i: number) => {
      const sc = s.sec[i];
      const o = easeOut(inv(sc.to, sc.to + 1.4, t)) * sc.w;
      const c = 1 - easeInOut(inv(sc.tc, sc.tc + 0.5 + hash(i) * 0.6, t));
      const pulseW = pulse(TCOL - 0.3, TCOL + 0.4, t) * 6;
      return Math.max(0, o * c + pulseW * c + (hash(i + fr(t, 12)) - 0.5) * 2 * (o > 1 ? 1 : 0));
    };
    const ws = pts.map((_, i) => width(i));
    const maxW = Math.max(...ws);
    const f = fr(t, 10);
    // ---- early artifacts: displaced row, out-of-sync region
    if (t < 1.8) {
      const c = r.c, tmp = r.tmp;
      tmp.set(c);
      const p = pts[24];
      if (pulse(0.3, 1.4, t) > 0) {
        const y = Math.floor(p.y);
        const L = Math.floor(10 + t * 30);
        for (let x = Math.floor(p.x - L); x < p.x + L; x++) if (x > 3 && x < W) for (let ch = 0; ch < 3; ch++) c[(y * W + x) * 3 + ch] = tmp[(y * W + x - 3) * 3 + ch];
      }
      if (pulse(1.0, 1.6, t) > 0) for (let y = 120; y < 132; y++) for (let x = 230; x < 246; x++) for (let ch = 0; ch < 3; ch++) c[(y * W + x) * 3 + ch] = tmp[((y - 2) * W + x + 4) * 3 + ch] * 1.3;
    }
    if (t > 11) return;
    // ---- pull background strips toward the opening (banded)
    if (maxW > 0.5) {
      const segIdx = (x: number, y: number) => {
        // nearest point along the tear (coarse)
        let best = 0, bd = 1e9;
        for (let i = 0; i <= N; i += 2) { const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2; if (d < bd) { bd = d; best = i; } }
        return best;
      };
      r.warp(0, 0, W - 1, H - 1, (x, y, o) => {
        if (((y >> 2) + f) % 3 === 0) return;
        const i = segIdx(x, y);
        const p = pts[i], n = nrm[i], w = ws[i];
        if (w < 0.5) return;
        const d = (x - p.x) * n.x + (y - p.y) * n.y;
        const ad = Math.abs(d);
        if (ad > 40) return;
        const pull = Math.round((1 - ad / 40) * w * 0.6);
        o[0] = x + n.x * Math.sign(d) * pull; o[1] = y + n.y * Math.sign(d) * pull;
      });
      // ---- render the alternate dimension into the alt buffer
      r.setTarget(r.alt);
      const alt = r.alt;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 3;
          const g = 0.5 + 0.5 * Math.sin(x * 0.02 + y * 0.03 + t * 0.6);
          alt[i] = 0.08 + g * 0.18; alt[i + 1] = 0.01; alt[i + 2] = 0.16 + (1 - g) * 0.2;
          // parallax star layers moving against the arena
          for (let L = 1; L <= 3; L++) {
            const sx = Math.floor((x + t * 14 * L) / (2 + L)), sy = Math.floor((y - t * 5 * L) / (2 + L));
            if (hash2(sx * L, sy) > 0.985) { alt[i] += 0.6 * L; alt[i + 1] += 0.5 * L; alt[i + 2] += 0.8 * L; }
          }
        }
      // fragments of the battlefield, rearranged and inverted (reversed shadows)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const bx = ((x + Math.floor(t * 20)) >> 5) + (y >> 5) * 13;
          if (hash(bx) < 0.75) continue;
          const sx = W - 1 - ((x * 2 + Math.floor(t * 9)) % W), sy = H - 1 - ((y * 2) % H);
          const i = (y * W + x) * 3, j = (sy * W + sx) * 3;
          alt[i] += (0.35 - r.floor[j]) * 1.6; alt[i + 1] += (0.3 - r.floor[j + 1]) * 0.8; alt[i + 2] += (0.35 - r.floor[j + 2]) * 2.2;
        }
      // impossible wireframe geometry at contradictory depths
      for (const cb of s.cubes) {
        const rx = t * 0.7 * cb.sp + cb.z, ry = t * 0.5 + cb.z * 2;
        const cx = cb.x + Math.sin(t * 0.3 * cb.z) * 30 / cb.z, cy = cb.y + Math.cos(t * 0.2) * 10;
        const V3: number[][] = [];
        for (let q = 0; q < 8; q++) {
          let x = q & 1 ? 1 : -1, y = q & 2 ? 1 : -1, z = q & 4 ? 1 : -1;
          [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
          [x, z] = [x * Math.cos(ry) - z * Math.sin(ry), x * Math.sin(ry) + z * Math.cos(ry)];
          const pz = 3 / (3 + z);
          V3.push([cx + x * cb.s * pz, cy + y * cb.s * pz]);
        }
        for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) { const b = a | bit; if (b !== a) r.line(V3[a][0], V3[a][1], V3[b][0], V3[b][1], cb.z > 2 ? CYAN : MAG, 1.2 / cb.z + 0.3); }
      }
      // ---- mask of the tear
      const mk = s.mask as Float32Array;
      mk.fill(0);
      r.setTarget(mk);
      const left: number[] = [], right: number[] = [];
      for (let i = 0; i <= N; i++) {
        const w = ws[i] * 0.5;
        left.push(pts[i].x + nrm[i].x * w, pts[i].y + nrm[i].y * w);
        right.push(pts[i].x - nrm[i].x * w, pts[i].y - nrm[i].y * w);
      }
      const poly = [...left];
      for (let i = N; i >= 0; i--) poly.push(right[i * 2], right[i * 2 + 1]);
      r.poly(poly, [1, 0, 0], 1, SET);
      r.setTarget(r.main);
      const c = r.main;
      for (let p = 0; p < W * H; p++) if (mk[p * 3] > 0) { c[p * 3] = alt[p * 3]; c[p * 3 + 1] = alt[p * 3 + 1]; c[p * 3 + 2] = alt[p * 3 + 2]; }
      // jagged pixel edges constantly breaking and reconstructing, chromatic split
      for (let i = 0; i <= N; i++) {
        if (ws[i] < 0.5) continue;
        const brk = hash(i * 3 + f) > 0.25;
        if (brk) {
          r.px(left[i * 2], left[i * 2 + 1], MAG, 2);
          r.px(right[i * 2], right[i * 2 + 1], CYAN, 2);
        }
        if (i < N) {
          r.line(left[i * 2], left[i * 2 + 1], left[i * 2 + 2], left[i * 2 + 3], [1.8, 0.8, 1.8], 0.8);
          r.line(right[i * 2], right[i * 2 + 1], right[i * 2 + 2], right[i * 2 + 3], [0.8, 1.6, 2.0], 0.8);
        }
        r.light(pts[i].x, pts[i].y, 30, [1.0, 0.4, 1.3], 0.0);
      }
      // blocks of the scene folded back at incorrect positions
      const tmp = r.tmp;
      tmp.set(c);
      for (let q = 0; q < 7; q++) {
        const sd = q * 31 + Math.floor(t * 5) * 7;
        if (hash(sd) > maxW / 18) continue;
        const i = Math.floor(hash(sd + 1) * N);
        const sx = Math.floor(pts[i].x + (hash(sd + 2) - 0.5) * 40), sy = Math.floor(pts[i].y + (hash(sd + 3) - 0.5) * 40);
        const dx = Math.floor((hash(sd + 4) - 0.5) * 50), dy = Math.floor((hash(sd + 5) - 0.5) * 30);
        for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) {
          const X = sx + x + dx, Y = sy + y + dy, SX = sx + x, SY = sy + y;
          if (X < 0 || Y < 0 || X >= W || Y >= H || SX < 0 || SY < 0 || SX >= W || SY >= H) continue;
          for (let ch = 0; ch < 3; ch++) c[(Y * W + X) * 3 + ch] = tmp[(SY * W + SX) * 3 + ch];
        }
      }
    }
    // ---- the two spaces collide
    const e = t - TCOL;
    if (e > 0) {
      if (e < 0.1) r.flash = 0.7;
      if (e < 0.7) { r.shakeX = (hash(t * 50) - 0.5) * 10 * (1 - e / 0.7); r.shakeY = (hash(t * 53) - 0.5) * 7 * (1 - e / 0.7); }
      // displaced ground blocks drifting back, each with its own patience
      if (e < 4.6) {
        const c = r.main, tmp = r.tmp;
        tmp.set(c);
        for (let by = 0; by < H; by += 12)
          for (let bx = 0; bx < W; bx += 12) {
            const hb = hash(bx * 0.37 + by * 1.7);
            const snap = 0.15 + hb * 3.5;
            const k = e < snap ? (hb > 0.7 ? 1 - easeOut(e / snap) : 1) : 0;
            if (k <= 0) continue;
            const a = hash(bx + by * 3) * TAU;
            const amp = (6 + hb * 20) * k * Math.exp(-e * 0.4);
            const ox = Math.round(Math.cos(a) * amp), oy = Math.round(Math.sin(a) * amp);
            for (let y = by; y < by + 12 && y < H; y++) for (let x = bx; x < bx + 12 && x < W; x++) {
              const sx = Math.min(W - 1, Math.max(0, x - ox)), sy = Math.min(H - 1, Math.max(0, y - oy));
              for (let ch = 0; ch < 3; ch++) c[(y * W + x) * 3 + ch] = tmp[(sy * W + sx) * 3 + ch];
            }
          }
      }
      // spatial echoes of the tear outline
      for (let q = 0; q < 4; q++) {
        const ee = e - q * 0.12;
        if (ee < 0 || ee > 1.2) continue;
        const off = ee * 70;
        for (let i = 0; i < N; i++) {
          r.line(pts[i].x + nrm[i].x * off, pts[i].y + nrm[i].y * off, pts[i + 1].x + nrm[i + 1].x * off, pts[i + 1].y + nrm[i + 1].y * off, MAG, 1.4 * (1 - ee / 1.2));
          r.line(pts[i].x - nrm[i].x * off, pts[i].y - nrm[i].y * off, pts[i + 1].x - nrm[i + 1].x * off, pts[i + 1].y - nrm[i + 1].y * off, CYAN, 1.4 * (1 - ee / 1.2));
        }
      }
      // broken geometry & fragmented stars
      for (const sh of s.shards) {
        const life = 1 - smooth(1.2, 2.4, e);
        if (life <= 0) break;
        const p = pts[sh.i], n = nrm[sh.i];
        const d = fly(0, sh.v, 1.6, 0, e) * sh.side;
        const x = p.x + n.x * d, y = p.y + n.y * d;
        const rot = sh.spin * e;
        const tri = sh.shape.flatMap((a: number) => [x + Math.cos(a + rot) * sh.s, y + Math.sin(a + rot) * sh.s]);
        r.poly(tri, sh.side > 0 ? [0.5, 0.1, 0.6] : [0.1, 0.4, 0.6], life, DITHER);
        r.polyline(tri, sh.side > 0 ? MAG : CYAN, life, ADD, true);
        if (sh.i % 3 === 0) sparkle(r, x + 6, y - 4, 2, STAR, life);
      }
    }
    // ---- the last stubborn region corrects itself late
    if (t > 9.3 && t < 10.6) {
      const c = r.main, tmp = r.tmp;
      tmp.set(c);
      const p = pts[30];
      const off = t < 10.45 ? 3 : 0;
      for (let y = Math.floor(p.y) - 4; y < p.y + 4; y++) for (let x = Math.floor(p.x) - 4; x < p.x + 4; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        for (let ch = 0; ch < 3; ch++) c[(y * W + x) * 3 + ch] = tmp[((y + 1) * W + x + off) * 3 + (ch + (off ? 1 : 0)) % 3];
      }
    }
    void bayer;
  },
};

export const ASTRAL = [eventHorizon, chronoshard, constellationEngine, realityRipper];
void BLEND; void easeOutBack;
