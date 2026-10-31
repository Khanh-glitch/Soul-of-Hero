import { Effect, sparkle } from '../engine/fx';
import { Renderer, ADD, SET, BLEND, DITHER, W, H } from '../engine/renderer';
import { Col, RNG, TAU, clamp, lerp, inv, smooth, easeOut, easeIn, easeInOut, easeOutBack, hash, fly, noise1, catmull, V, pulse, mixc, scale } from '../engine/math';

const BARK: Col = [0.16, 0.09, 0.05];
const BARK_HI: Col = [0.34, 0.2, 0.09];
const VEIN: Col = [0.3, 1.5, 0.55];
const LIME: Col = [0.95, 1.8, 0.4];
const GOLD: Col = [1.7, 1.15, 0.3];
const TEAL: Col = [0.25, 1.3, 1.2];
const PINK: Col = [1.6, 0.42, 0.8];
const PINK_HI: Col = [2.0, 1.1, 1.3];
const LEAF_D: Col = [0.07, 0.22, 0.07];
const LEAF: Col = [0.18, 0.5, 0.14];
const LEAF_HI: Col = [0.45, 0.95, 0.3];
const WITHER: Col = [0.2, 0.17, 0.13];

function petal(r: Renderer, x: number, y: number, a: number, s: number, c: Col, hi: Col, k = 1) {
  const ca = Math.cos(a), sa = Math.sin(a);
  r.poly([x, y, x + ca * s - sa * s * 0.5, y + sa * s + ca * s * 0.5, x + ca * s * 2, y + sa * s * 2, x + ca * s + sa * s * 0.5, y + sa * s - ca * s * 0.5], c, k, DITHER);
  r.px(x + ca * s, y + sa * s, hi, 1, SET);
}

// =====================================================================================
// 13 — ROOTWAKE
// =====================================================================================
type RNode = { x: number; y: number; tb: number; p: number; th: number; main: number; dist: number };
export const rootwake: Effect = {
  id: 13, name: 'Rootwake', school: 'VERDANT', duration: 10, climax: 5.75,
  blurb: 'Roots explore with a heartbeat; blooms send pulses back that wake new growth, until the network clenches as one.',
  setup(r) {
    const rng = new RNG(1313);
    const C = { x: r.caster.x + 4, y: r.caster.y + 4 };
    const T = r.target;
    const nodes: RNode[] = [];
    const flowers: { i: number; tb: number; path: number[] }[] = [];
    const base = Math.atan2(T.y - C.y, T.x - C.x);
    const grow = (pi: number, x: number, y: number, a: number, len: number, t0: number, th: number, main: number, d0: number, gen: number) => {
      let tt = t0, prev = pi, dist = d0;
      const steps = Math.floor(len / 2);
      let phase = rng.r(0, TAU);
      for (let s = 0; s < steps; s++) {
        a += (noise1(s * 0.15 + main * 9 + gen * 3) - 0.5) * 0.5;
        if (gen === 0) a += Math.atan2(Math.sin(base - a), Math.cos(base - a)) * 0.015;
        x += Math.cos(a) * 2; y += Math.sin(a) * 2;
        dist += 2;
        // biological rhythm: surges and pauses
        const sp = 70 * (0.25 + Math.pow(Math.sin(phase + s * 0.12), 2)) * (gen ? 0.8 : 1);
        tt += 2 / sp + (rng.next() < 0.02 ? 0.25 : 0);
        nodes.push({ x, y, tb: tt, p: prev, th: th * (1 - s / steps * 0.7), main: gen === 0 ? main : -1, dist });
        prev = nodes.length - 1;
        if (gen < 2 && rng.next() < (gen ? 0.03 : 0.06)) grow(prev, x, y, a + rng.sign() * rng.r(0.5, 1.2), (len - s * 2) * rng.r(0.3, 0.6), tt, th * 0.5, main, dist, gen + 1);
        if (gen === 0 && s > 18 && s % 22 === 0 && flowers.length < 9) {
          const path: number[] = [];
          for (let q = prev; q >= 0; q = nodes[q].p) path.push(q);
          flowers.push({ i: prev, tb: tt + 0.5, path });
        }
      }
    };
    for (let m = 0; m < 6; m++) grow(-1, C.x, C.y, base + (m - 2.5) * 0.42 + rng.r(-0.1, 0.1), rng.r(130, 190), 0.2 + m * 0.08, 3.2, m, 0, 0);
    // flowers trigger secondary growth: new shoots start when their pulse returns
    for (const f of flowers) {
      const n = nodes[f.i];
      for (let k = 0; k < 2; k++) grow(f.i, n.x, n.y, rng.r(0, TAU), rng.r(30, 55), f.tb + 0.35, 1.4, -1, n.dist, 2);
    }
    const tendrils = Array.from({ length: 4 }, (_, k) => {
      const a = base + (k - 1.5) * 0.9 + Math.PI;
      const sx = T.x + Math.cos(a) * 160, sy = T.y + Math.sin(a) * 110;
      return [{ x: sx, y: sy }, { x: lerp(sx, T.x, 0.4) + rng.r(-30, 30), y: lerp(sy, T.y, 0.4) + rng.r(-30, 30) }, { x: lerp(sx, T.x, 0.8) + rng.r(-15, 15), y: lerp(sy, T.y, 0.8) + rng.r(-15, 15) }, { x: T.x, y: T.y }];
    });
    return { C, nodes, flowers, tendrils };
  },
  render(r, t, s) {
    const T = r.target;
    const nodes: RNode[] = s.nodes;
    const TT = 5.2;
    const tight = easeInOut(inv(TT, TT + 0.5, t)) * (1 - smooth(6.5, 8, t) * 0.6);
    const wither = smooth(6.6, 9.4, t);
    const rise = smooth(2.8, 4.2, t);
    r.ambient = 0.55;
    const pos = (n: RNode) => ({ x: lerp(n.x, T.x, tight * 0.22), y: lerp(n.y, T.y, tight * 0.22) });
    // flower pulses travelling home
    const pulses: { path: number[]; head: number }[] = [];
    for (const f of s.flowers) { const e = t - f.tb; if (e > 0 && e < 1.2) pulses.push({ path: f.path, head: e * 140 }); }
    const pulseAt = new Map<number, number>();
    for (const p of pulses) {
      const nf = nodes[p.path[0]];
      for (const q of p.path) { const d = nf.dist - nodes[q].dist; const k = Math.exp(-Math.pow((d - p.head) / 6, 2)); if (k > 0.05) pulseAt.set(q, Math.max(pulseAt.get(q) || 0, k)); }
    }
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.tb > t) continue;
      const mat = smooth(n.tb, n.tb + 0.8, t);
      let w = n.th * (0.35 + 0.65 * mat) * (1 - wither * 0.6);
      const P = pos(n);
      const pp = n.p >= 0 ? pos(nodes[n.p]) : P;
      // raised tendril arches along main roots
      let lift = 0;
      if (n.main >= 0 && n.main % 2 === 0) {
        const u = (n.dist % 70) / 70;
        lift = Math.sin(u * Math.PI) * 9 * rise * (n.dist > 30 ? 1 : 0) * (1 - wither);
        w *= 1 + rise * 0.5;
      }
      const lp = n.p >= 0 && nodes[n.p].main === n.main && n.main >= 0 && n.main % 2 === 0 ? Math.sin(((nodes[n.p].dist % 70) / 70) * Math.PI) * 9 * rise * (nodes[n.p].dist > 30 ? 1 : 0) * (1 - wither) : lift;
      r.decalLine(pp.x, pp.y, P.x, P.y, [0.07, 0.05, 0.04], 0.7);
      if (lift > 1) r.shadow(P.x + 2, P.y + 2, w + 1, w * 0.6 + 1, 0.5);
      const bark = mixc(BARK, WITHER, wither);
      r.thick(pp.x, pp.y - lp, P.x, P.y - lift, w * 2, bark, 1, SET);
      if (w > 1.2) r.px(P.x - w * 0.4, P.y - lift - w * 0.5, mixc(BARK_HI, WITHER, wither), 1, SET);
      // luminescent vein with packets of energy
      const pk = Math.pow(0.5 + 0.5 * Math.sin(n.dist * 0.18 - t * 9), 6) * (n.main >= 0 ? 1 : 0.5);
      const pul = pulseAt.get(i) || 0;
      const vk = (0.25 + pk * 0.8 + pul * 2) * (1 - wither * 0.7) * mat;
      if (w > 0.9) r.px(P.x, P.y - lift, pul > 0.3 ? GOLD : VEIN, vk);
      // thorns on raised arches and in the climactic wave
      const thornWave = n.main >= 0 ? smooth(TT + 0.25 + n.dist / 260, TT + 0.32 + n.dist / 260, t) * (1 - wither) : 0;
      if ((lift > 3 || thornWave > 0) && i % 3 === 0) {
        const dx = P.x - pp.x, dy = P.y - pp.y, L = Math.hypot(dx, dy) || 1;
        const sg = i % 2 ? 1 : -1;
        const len = (lift > 3 ? 3 : 0) + thornWave * 7 * (0.6 + hash(i) * 0.6);
        r.line(P.x, P.y - lift, P.x - (dy / L) * len * sg + (dx / L) * len * 0.3, P.y - lift + (dx / L) * len * sg + (dy / L) * len * 0.3, mixc([0.5, 0.45, 0.25], WITHER, wither), 1, SET);
      }
      // growing tips
      if (t - n.tb < 0.06) { r.px(P.x, P.y, LIME, 1.6); r.light(P.x, P.y, 14, [0.4, 1, 0.4], 0.4); }
      // crystallized residual markings
      if (wither > 0.3 && n.main >= 0 && i % 2 === 0) r.px(P.x, P.y, VEIN, 0.35 * smooth(0.3, 1, wither) * (0.5 + 0.5 * Math.sin(t * 2 + n.dist * 0.05)));
    }
    // twisting vines spiralling around the raised mains
    if (rise > 0)
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (n.main < 0 || n.main % 2 || n.tb > t || n.dist < 30) continue;
        const P = pos(n);
        const u = (n.dist % 70) / 70, lift = Math.sin(u * Math.PI) * 9 * rise * (1 - wither);
        const o = Math.sin(n.dist * 0.35 + t * 1.5) * 3.5 * rise;
        r.px(P.x, P.y - lift + o, mixc(LEAF_HI, WITHER, wither), 1, SET);
        r.px(P.x, P.y - lift - o, mixc(LEAF, WITHER, wither), 1, SET);
      }
    // flowers erupting along selected paths
    for (const f of s.flowers) {
      const e = t - (f.tb - 0.3);
      if (e < 0) continue;
      const P = pos(nodes[f.i]);
      const op = easeOutBack(clamp(e / 0.5)) * (1 - wither * 0.8);
      for (let k = 0; k < 5; k++) petal(r, P.x, P.y - 2, (k / 5) * TAU + f.i, 2.6 * op, mixc(PINK, WITHER, wither), PINK_HI);
      r.disc(P.x, P.y - 2, 1.2, GOLD, 1.2 * (1 - wither));
      if (e < 0.5) r.glow(P.x, P.y, 14, GOLD, 1 - e / 0.5);
      r.light(P.x, P.y, 26, [1.2, 0.6, 0.8], 0.5 * (1 - wither));
    }
    // towering tendrils snapping inward from the edges
    s.tendrils.forEach((ctrl: V[], k: number) => {
      const st = TT + 0.05 + k * 0.06;
      const u = easeIn(inv(st, st + 0.25, t));
      if (u <= 0) return;
      const ret = 1 - smooth(6.3, 7.8, t);
      if (ret <= 0) return;
      const n = 40;
      for (let q = 0; q < n * u * ret; q++) {
        const p = catmull(ctrl, q / n), p2 = catmull(ctrl, (q + 1) / n);
        const w = (1 - q / n) * 6 + 1.5;
        r.thick(p.x, p.y, p2.x, p2.y, w, BARK, 1, SET);
        r.px(p.x - 1, p.y - w * 0.4, BARK_HI, 1, SET);
        if (q % 3 === 0) r.line(p.x, p.y, p.x + (q % 2 ? 1 : -1) * w * 0.9, p.y - w * 0.9, [0.5, 0.45, 0.25], 1, SET);
        if (q % 2 === 0) r.px(p.x, p.y, VEIN, 0.6);
      }
    });
    if (t > TT + 0.28 && t < TT + 0.36) { r.flash = 0.25; r.flashCol = [0.6, 1, 0.5]; }
    if (t > TT + 0.28 && t < TT + 0.8) { r.shakeX = (hash(t * 40) - 0.5) * 5; r.shakeY = (hash(t * 44) - 0.5) * 4; }
    const glow = pulse(TT, TT + 1.2, t);
    r.light(T.x, T.y, 120, [0.5, 1.3, 0.5], glow * 1.2);
    // drifting petals in the aftermath
    for (let k = 0; k < 70; k++) {
      const st = 5.6 + hash(k) * 1.5;
      const e = t - st;
      if (e < 0) continue;
      const f = s.flowers[k % s.flowers.length];
      const P = pos(nodes[f.i]);
      const x = P.x + Math.sin(e * 1.6 + k) * 10 + e * (8 + hash(k + 1) * 12), y = P.y - 10 + e * 9 + Math.cos(e * 2.3 + k) * 3;
      const life = 1 - smooth(3, 4.3, e);
      if (life <= 0 || x > W) continue;
      r.px(x, y, Math.sin(e * 6 + k) > 0 ? PINK : PINK_HI, life, SET);
      if (Math.sin(e * 6 + k) > 0.3) r.px(x + 1, y, PINK, life, SET);
    }
  },
};

// =====================================================================================
// 14 — SPORE NEBULA
// =====================================================================================
export const sporeNebula: Effect = {
  id: 14, name: 'Spore Nebula', school: 'VERDANT', duration: 10, climax: 6.45,
  blurb: 'Spores find each other, colonies divide, light travels like thought — then the whole galaxy reproduces.',
  setup(r) {
    const rng = new RNG(1414);
    const C = { x: r.target.x - 20, y: r.target.y + 6 };
    const cols = Array.from({ length: 12 }, (_, k) => {
      const a = k * 2.399 + 0.4, rr = 18 + k * 6.5;
      return { x: C.x + Math.cos(a) * rr * 1.25, y: C.y + Math.sin(a) * rr * 0.72, tc: 1.3 + k * 0.22, hue: k % 3, f: rng.r(1.2, 3), cells: Array.from({ length: 12 }, (_, j) => ({ a: rng.r(0, TAU), d: 2 + Math.sqrt(j) * 3.6, rr: rng.r(1.6, 3) })) };
    });
    const links: [number, number][] = [];
    for (let k = 0; k < cols.length; k++) { links.push([k, (k + 1) % cols.length]); if (k + 3 < cols.length) links.push([k, k + 3]); }
    const spores = Array.from({ length: 72 }, (_, i) => ({ col: i % 12, ph: rng.r(0, TAU), w: rng.r(0.4, 1), orb: rng.r(3, 10), d: rng.r(-0.3, 0.3) }));
    const burst = Array.from({ length: 700 }, (_, i) => ({ col: i % 12, a: rng.r(0, TAU), v: rng.r(15, 110), spin: rng.r(0.6, 2.2) * (i % 2 ? 1 : -1), layer: i % 3, life: rng.r(1.5, 3.5) }));
    return { C, cols, links, spores, burst };
  },
  render(r, t, s) {
    const C = s.C;
    const TR = 6.3;
    r.ambient = 0.45 - smooth(1, 4, t) * 0.18;
    const hues: Col[] = [VEIN, TEAL, GOLD];
    const dissolve = smooth(TR + 0.3, 8.6, t);
    // light waves propagating colony to colony
    const waves = [3.9, 4.8, 5.6];
    const lit = (k: number) => {
      let v = 0;
      for (const w of waves) { const e = t - (w + k * 0.11); if (e > 0) v += Math.exp(-e * 5) * 1.5; }
      return v + pulse(TR - 0.4, TR + 0.2, t) * 1.5;
    };
    // mushroom
    const mk = 1 - smooth(TR, 8, t);
    if (mk > 0) {
      const pu = 0.6 + 0.4 * Math.sin(t * 2.4);
      r.shadow(C.x + 1, C.y + 2, 6, 2.5, 0.6);
      r.thick(C.x, C.y, C.x, C.y - 6, 2.5, [0.55, 0.5, 0.4], 1, SET);
      r.disc(C.x, C.y - 7, 5, [0.25, 0.4, 0.3], 1, SET, 0.6);
      r.disc(C.x, C.y - 8, 4, [0.35, 0.65, 0.45], 1, SET, 0.5);
      for (let k = 0; k < 4; k++) r.px(C.x - 3 + k * 2, C.y - 8 + (k % 2), TEAL, pu * 2 * mk);
      r.glow(C.x, C.y - 7, 14, TEAL, pu * 0.6 * mk);
      r.light(C.x, C.y - 6, 40, [0.3, 1.1, 0.8], pu * 0.5 * mk);
    }
    const colPos = (k: number) => { const c = s.cols[k]; const br = 1 + 0.12 * Math.sin(t * c.f); return { x: c.x, y: c.y, br }; };
    // filaments with travelling packets
    for (const [a, b] of s.links as [number, number][]) {
      const ca = s.cols[a], cb = s.cols[b];
      const g = smooth(Math.max(ca.tc, cb.tc) + 0.4, Math.max(ca.tc, cb.tc) + 1.2, t) * (1 - dissolve);
      if (g <= 0) continue;
      const mx = (ca.x + cb.x) / 2 + Math.sin(t * 0.7 + a) * 8, my = (ca.y + cb.y) / 2 + Math.cos(t * 0.6 + b) * 6 + 6;
      const lk = (lit(a) + lit(b)) * 0.5;
      for (let q = 0; q <= 30; q++) {
        const u = q / 30;
        const x = (1 - u) * (1 - u) * ca.x + 2 * (1 - u) * u * mx + u * u * cb.x, y = (1 - u) * (1 - u) * ca.y + 2 * (1 - u) * u * my + u * u * cb.y;
        if (q % 2) r.px(x, y, hues[ca.hue], (0.25 + lk * 0.6) * g);
        const pk = ((t * 0.5 + a * 0.13) % 1);
        if (Math.abs(u - pk) < 0.03) r.disc(x, y, 1, [1.8, 2, 1.6], g * 1.2);
      }
    }
    // drifting spores, finding each other
    const sp: V[] = [];
    if (t < TR + 0.2) {
      s.spores.forEach((p: any, i: number) => {
        const c = s.cols[p.col];
        const u = easeInOut(inv(0.4 + p.d * 0.5, c.tc, t));
        const drift = { x: Math.sin(t * 0.7 * p.w + p.ph) * 12, y: Math.cos(t * 0.5 * p.w + p.ph * 1.3) * 8 };
        const orbit = { x: Math.cos(t * p.w * 2 + p.ph) * p.orb, y: Math.sin(t * p.w * 2 + p.ph) * p.orb * 0.7 };
        const x = lerp(C.x + drift.x * (1 - u) + (Math.cos(p.ph) * 18 * Math.sin(u * Math.PI)), c.x + orbit.x, u);
        const y = lerp(C.y - 8 + drift.y * (1 - u), c.y + orbit.y, u);
        if (t > 0.4 + p.d * 0.5) { sp.push({ x, y }); r.px(x, y, hues[c.hue], 1.4); }
      });
      for (let i = 0; i < sp.length; i++)
        for (let j = i + 1; j < sp.length; j++) {
          const d = Math.hypot(sp[i].x - sp[j].x, sp[i].y - sp[j].y);
          if (d < 13) r.line(sp[i].x, sp[i].y, sp[j].x, sp[j].y, VEIN, 0.18 * (1 - d / 13));
        }
    }
    // colonies of dividing cells
    s.cols.forEach((c: any, k: number) => {
      const P = colPos(k);
      const lk = lit(k);
      const hue: Col = hues[c.hue];
      c.cells.forEach((cell: any, j: number) => {
        const born = c.tc + j * 0.22;
        if (t < born) return;
        const div = easeOut(clamp((t - born) / 0.35));
        const par = c.cells[j >> 1];
        const px = P.x + Math.cos(par.a) * par.d * (j ? 1 : 0), py = P.y + Math.sin(par.a) * par.d * 0.7 * (j ? 1 : 0);
        const tx = P.x + Math.cos(cell.a + t * 0.2) * cell.d * P.br, ty = P.y + Math.sin(cell.a + t * 0.2) * cell.d * 0.7 * P.br;
        const x = lerp(px, tx, div), y = lerp(py, ty, div);
        const rr = cell.rr * (0.5 + 0.5 * div) * P.br * (1 - dissolve * 0.6);
        // membrane breaking into dots as it dissolves
        if (dissolve < 0.05) {
          r.disc(x, y, rr, scale(hue, 0.12), 0.6, BLEND);
          r.ring(x, y, rr, 0.9, hue, 0.6 + lk * 0.8);
        } else {
          for (let q = 0; q < 10; q++) {
            if (hash(q + j * 10 + k * 100) < dissolve) continue;
            const a = (q / 10) * TAU;
            const o = dissolve * 6 * hash(q + j);
            r.px(x + Math.cos(a) * (rr + o), y + Math.sin(a) * (rr + o) + dissolve * 4, hue, 0.8);
          }
        }
        r.px(x, y, [1.8, 2, 1.6], (0.5 + lk) * (1 - dissolve * 0.5));
      });
      r.glow(P.x, P.y, 16, hue, (0.25 + lk * 0.5) * smooth(c.tc, c.tc + 1, t) * (1 - dissolve));
      r.light(P.x, P.y, 34, scale(hue, 0.6), (0.3 + lk * 0.6) * smooth(c.tc, c.tc + 1, t) * (1 - dissolve));
    });
    // reproductive event: swirling layered spore clouds
    if (t > TR) {
      const e = t - TR;
      if (e < 0.15) { r.flash = 0.25 * (1 - e / 0.15); r.flashCol = [0.5, 1, 0.7]; }
      for (const b of s.burst) {
        const c = s.cols[b.col];
        const life = 1 - e / b.life;
        if (life <= 0) continue;
        const rr = fly(0, b.v * (1 + b.layer * 0.4), 1.2, 0, e);
        const a = b.a + b.spin * Math.log(1 + e * 2);
        const x = c.x + Math.cos(a) * rr * 1.2, y = c.y + Math.sin(a) * rr * 0.7 - e * 3;
        r.px(x, y, b.layer === 2 ? [1.8, 2, 1.6] : hues[(c.hue + b.layer) % 3], life * (b.layer === 2 ? 1.2 : 0.9));
      }
    }
    // isolated survivors floating in darkness
    if (t > 7) {
      for (let k = 0; k < 14; k++) {
        const x = C.x + (hash(k) - 0.5) * 220 + Math.sin(t * 0.4 + k) * 6, y = C.y + (hash(k + 3) - 0.5) * 140 + Math.cos(t * 0.3 + k) * 4;
        const g = smooth(7, 8, t) * (0.5 + 0.5 * Math.sin(t * 1.5 + k));
        r.px(x, y, hues[k % 3], g * 1.4);
        r.glow(x, y, 4, hues[k % 3], g * 0.4);
      }
    }
  },
};

// =====================================================================================
// 15 — THORN OPERA
// =====================================================================================
type Ten = { bx: number; by: number; base: number; L: number; kind: number; seed: number };
export const thornOpera: Effect = {
  id: 15, name: 'Thorn Opera', school: 'VERDANT', duration: 9.5, climax: 6.42,
  blurb: 'Five tendrils with five temperaments dance — tip leads, body follows, base resists — then become one violent flower.',
  setup(r) {
    const C = r.caster;
    const F = { x: C.x + 96, y: C.y - 22 };
    const tens: Ten[] = Array.from({ length: 5 }, (_, k) => {
      const a = -1.2 + k * 0.6;
      return { bx: C.x + 8 + Math.cos(a) * 9, by: C.y + 2 + Math.sin(a) * 6, base: Math.atan2(F.y - C.y, F.x - C.x) + (k - 2) * 0.45, L: 104 + (k % 2) * 14, kind: k, seed: k * 17 };
    });
    return { F, tens };
  },
  render(r, t, s) {
    const F = s.F;
    const TC = 5.1, TO = 6.2;
    const NS = 30;
    // personality-driven pose: (direction, curl, wave) at a time
    const pose = (tn: Ten, tt: number) => {
      let dir = tn.base, curl = 0, wave = 0, wph = 0;
      const k = tn.kind;
      if (k === 0 || k === 3) {
        // striker: holds, then snaps to a new heading
        const seg = Math.floor(tt / 0.85), f = tt / 0.85 - seg;
        const a0 = (hash(seg + tn.seed) - 0.5) * 1.6, a1 = (hash(seg + 1 + tn.seed) - 0.5) * 1.6;
        dir += lerp(a0, a1, smooth(0.7, 0.82, f));
        curl = 0.4 * Math.sin(tt * 2 + k);
      } else if (k === 1) {
        // coiler: winds up a spiral, then whips
        const ph = (tt * 0.6) % 1;
        curl = ph < 0.75 ? easeIn(ph / 0.75) * 7 : lerp(7, -1.5, easeOut((ph - 0.75) / 0.25));
        dir += Math.sin(tt * 0.8) * 0.4;
      } else if (k === 2) {
        // drifter: elegant S-curves that snap into a vicious hook
        wave = 1.6; wph = tt * 3;
        const hook = pulse(0, 1, ((tt * 0.35) % 1 - 0.7) / 0.3);
        curl = hook * 5;
        dir += Math.sin(tt * 0.9) * 0.5;
      } else {
        wave = 0.9; wph = tt * 5;
        dir += Math.sin(tt * 1.7) * 0.7;
        curl = Math.sin(tt * 1.1) * 2;
      }
      // ensemble: crossing sweeps
      const sweep = pulse(3.6, 5.0, tt);
      dir += sweep * Math.sin(tt * 4) * 0.9 * (k % 2 ? 1 : -1);
      return { dir, curl, wave, wph };
    };
    const chain = (tn: Ten, tt: number) => {
      const grow = easeOut(inv(0.2 + tn.kind * 0.1, 1.2 + tn.kind * 0.1, tt));
      const pts: { x: number; y: number; a: number }[] = [{ x: tn.bx, y: tn.by, a: tn.base }];
      let x = tn.bx, y = tn.by, ang = 0;
      const ds = (tn.L * grow) / NS;
      for (let j = 1; j <= NS; j++) {
        const u = j / NS;
        // tip initiates: base segments read the pose from the past
        const P = pose(tn, tt - (1 - u) * 0.42);
        const kap = (P.curl * u * u + P.wave * Math.sin(u * 7 - P.wph)) / NS;
        ang += kap;
        let a = P.dir + ang;
        // gathering into the bud: tips seek the flower centre
        const gather = easeInOut(inv(TC, TO - 0.15, tt)) * (1 - smooth(TO, TO + 0.25, tt));
        if (gather > 0) {
          const toF = Math.atan2(F.y - y, F.x - x) + u * 1.6 * (tn.kind % 2 ? 1 : -1);
          a = lerp(a, toF, gather * u);
        }
        x += Math.cos(a) * ds; y += Math.sin(a) * ds;
        pts.push({ x, y, a });
      }
      return pts;
    };
    r.ambient = 0.55;
    const opened = t - TO;
    // flower structure (behind tendrils)
    if (opened > 0) {
      const op = easeOutBack(clamp(opened / 0.3));
      const fade = 1 - smooth(1.6, 3, opened);
      if (fade > 0) {
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * TAU + 0.3 + opened * 0.15;
          const L = 66 * op * fade + 4;
          const wA = 0.22;
          const pts: number[] = [F.x, F.y];
          for (let q = 0; q <= 8; q++) { const u = q / 8; const aa = a - wA + 2 * wA * u; const rr = L * (0.75 + 0.25 * Math.sin(u * Math.PI)); pts.push(F.x + Math.cos(aa) * rr, F.y + Math.sin(aa) * rr * 0.8); }
          r.poly(pts, k % 2 ? [0.6, 0.12, 0.25] : [0.8, 0.18, 0.35], 1, SET);
          r.line(F.x, F.y, F.x + Math.cos(a) * L, F.y + Math.sin(a) * L * 0.8, PINK_HI, 0.8);
          // thorn row along each blade
          for (let q = 2; q < 8; q++) { const rr = (L * q) / 8; const bx = F.x + Math.cos(a) * rr, by = F.y + Math.sin(a) * rr * 0.8; r.line(bx, by, bx + Math.cos(a + 1.2) * 4, by + Math.sin(a + 1.2) * 4, [0.9, 0.85, 0.6], 1, SET); }
        }
        r.disc(F.x, F.y, 7 * op * fade, GOLD, 1.2);
        r.light(F.x, F.y, 90, [1.4, 0.6, 0.8], 1.2 * fade);
      }
      // intersecting lash arcs
      for (let k = 0; k < 4; k++) {
        const st = 0.05 + k * 0.1;
        const e = opened - st;
        if (e < 0 || e > 0.35) continue;
        const a0 = k * 1.7, sweep = easeOut(e / 0.35) * 2.6;
        const R = 50 + k * 12;
        for (let a = a0; a < a0 + sweep; a += 0.02) {
          const tail = (a - a0) / sweep;
          for (let d = -2; d <= 2; d++) r.px(F.x + Math.cos(a) * (R + d), F.y + Math.sin(a) * (R + d) * 0.8, tail > 0.85 ? PINK_HI : [0.9, 1.4, 0.5], (1 - e / 0.35) * tail * (2 - Math.abs(d) * 0.5));
        }
      }
      if (opened < 0.1) r.flash = 0.25;
      if (opened < 0.5) { r.shakeX = (hash(t * 33) - 0.5) * 5; r.shakeY = (hash(t * 39) - 0.5) * 4; }
    }
    // tendrils
    for (const tn of s.tens as Ten[]) {
      const pts = chain(tn, t);
      r.disc(tn.bx, tn.by, 2.5, LEAF_D, 1, SET);
      for (let j = 0; j < NS; j++) {
        const a = pts[j], b = pts[j + 1];
        const u = j / NS;
        const w = 3.6 * Math.pow(1 - u, 0.8) + 0.8;
        r.shadow(a.x + 2, a.y + 3, w, w * 0.5, 0.25);
        r.thick(a.x, a.y, b.x, b.y, w * 1.25, LEAF_D, 1, SET);
        r.thick(a.x, a.y, b.x, b.y, w * 0.7, LEAF, 1, SET);
        r.px(a.x - Math.sin(a.a) * w * 0.25, a.y + Math.cos(a.a) * w * 0.25 - 1, LEAF_HI, 1, SET);
        // thorns bend with the body
        if (j % 3 === 1) {
          const sg = j % 2 ? 1 : -1, na = b.a + sg * 1.25 + 0.35;
          const tl = 2 + w * 0.8;
          r.line(b.x, b.y, b.x + Math.cos(na) * tl, b.y + Math.sin(na) * tl, [0.75, 0.7, 0.45], 1, SET);
        }
      }
      const tip = pts[NS];
      r.px(tip.x, tip.y, LIME, 1.3);
      // leaves and petals released by forceful motion
      for (let q = 0; q < 70; q++) {
        const ts = q * 0.12 + (tn.kind * 0.03);
        const e = t - ts;
        if (e < 0 || e > 1.6 || ts > TO + 1) continue;
        const p1 = chain(tn, ts)[NS], p0 = chain(tn, ts - 0.04)[NS];
        const vx = (p1.x - p0.x) / 0.04, vy = (p1.y - p0.y) / 0.04;
        if (Math.hypot(vx, vy) < 190) continue;
        const x = fly(p1.x, vx * 0.35, 2.5, 0, e) + Math.sin(e * 7 + q) * 3, y = fly(p1.y, vy * 0.35, 2.5, 18, e);
        const life = 1 - e / 1.6;
        r.px(x, y, q % 2 ? LEAF_HI : PINK, life * 1.2, SET);
        if (Math.sin(e * 9 + q) > 0) r.px(x + 1, y, q % 2 ? LEAF : PINK_HI, life, SET);
      }
    }
    // torn-petal shower: gentle against the brutality
    if (opened > 0) {
      for (let k = 0; k < 180; k++) {
        const e = opened - hash(k) * 0.3;
        if (e < 0) continue;
        const a = hash(k + 1) * TAU, v = 40 + hash(k + 2) * 130;
        const x = F.x + Math.cos(a) * fly(0, v, 2.2, 0, e) + Math.sin(e * 2.2 + k) * 6;
        const y = F.y + Math.sin(a) * fly(0, v, 2.2, 0, e) * 0.8 + e * e * 3 + e * 6;
        const life = 1 - smooth(2.4, 3.3, e);
        if (life <= 0) continue;
        const flip = Math.sin(e * (4 + hash(k) * 5) + k);
        r.px(x, y, flip > 0 ? PINK : [0.8, 0.2, 0.4], life, SET);
        if (Math.abs(flip) > 0.5) r.px(x + (flip > 0 ? 1 : 0), y + (flip > 0 ? 0 : 1), PINK_HI, life, SET);
      }
    }
  },
};

// =====================================================================================
// 16 — WORLDSEED
// =====================================================================================
type Lay = { n: number; L: number; w: number; t0: number; t1: number; col: Col; hi: Col; off: number; tremble: number; curlTip: boolean; ret: number };
export const worldseed: Effect = {
  id: 16, name: 'Worldseed', school: 'VERDANT', duration: 11, climax: 6.75,
  blurb: 'Nothing happens, beautifully. Then a seed unfolds far more geometry than it could ever contain.',
  setup(r) {
    const rng = new RNG(1616);
    const layers: Lay[] = [
      { n: 8, L: 96, w: 0.3, t0: 3.6, t1: 6.0, col: [0.1, 0.3, 0.12], hi: [0.35, 0.9, 0.35], off: 0.2, tremble: 0, curlTip: true, ret: 9.2 },
      { n: 12, L: 62, w: 0.2, t0: 3.3, t1: 4.9, col: [0.12, 0.42, 0.32], hi: [0.4, 1.3, 1.0], off: 0, tremble: 0.02, curlTip: false, ret: 8.9 },
      { n: 6, L: 42, w: 0.36, t0: 2.9, t1: 4.0, col: [0.5, 0.15, 0.32], hi: [1.6, 0.6, 1.0], off: 0.5, tremble: 0.02, curlTip: false, ret: 8.6 },
      { n: 24, L: 30, w: 0.07, t0: 3.8, t1: 4.6, col: [0.6, 0.55, 0.2], hi: [1.8, 1.5, 0.5], off: 0.1, tremble: 0.12, curlTip: false, ret: 8.3 },
      { n: 3, L: 22, w: 0.5, t0: 2.5, t1: 3.4, col: [0.18, 0.5, 0.15], hi: [0.6, 1.4, 0.4], off: 1, tremble: 0.03, curlTip: false, ret: 8.0 },
    ];
    const seeds = Array.from({ length: 12 }, (_, i) => ({ a: rng.r(0, TAU), v: rng.r(50, 110), spin: rng.r(-1.5, 1.5) }));
    return { layers, seeds };
  },
  render(r, t, s) {
    const C = { x: W / 2 + 22, y: H / 2 + 8 };
    const hov = Math.sin(t * 1.6) * 1.5;
    const sy = C.y - 12 + hov;
    const TCR = 1.9, TB = 6.6;
    r.ambient = 0.5 - smooth(3, 6, t) * 0.12;
    const waves = [5.35, 5.85, 6.3];
    const wave = (rad: number) => waves.reduce((acc, w) => acc + Math.exp(-Math.pow((rad - (t - w) * 160) / 12, 2)) * (t > w ? 1 : 0), 0);
    const leaf = (a: number, L: number, wA: number, curlU: number, cx: number, cy: number) => {
      const pts: number[] = [];
      const axis: V[] = [];
      for (let side = 1; side >= -1; side -= 2)
        for (let q = 0; q <= 12; q++) {
          const u = side > 0 ? q / 12 : 1 - q / 12;
          const uu = u * curlU;
          const half = wA * Math.sin(Math.PI * Math.pow(u, 0.7));
          const aa = a + side * half + (1 - curlU) * u * u * 0.8;
          const rr = 3 + uu * L;
          pts.push(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr * 0.75);
          if (side > 0) axis.push({ x: cx + Math.cos(a + (1 - curlU) * u * u * 0.8) * rr, y: cy + Math.sin(a + (1 - curlU) * u * u * 0.8) * rr * 0.75 });
        }
      return { pts, axis };
    };
    // ---- the great bloom (outer layers first)
    s.layers.forEach((Ly: Lay, li: number) => {
      const g = easeInOut(inv(Ly.t0, Ly.t1, t)) * (1 - easeInOut(inv(Ly.ret, Ly.ret + 0.9, t)));
      if (g <= 0.01) return;
      for (let k = 0; k < Ly.n; k++) {
        const a = Ly.off + (k / Ly.n) * TAU + Math.sin(t * 13 + k * 3) * Ly.tremble + t * 0.04 * (li % 2 ? 1 : -1);
        const L = Ly.L * (0.85 + 0.15 * hash(k + li * 9));
        const { pts, axis } = leaf(a, L * g, Ly.w * (0.4 + 0.6 * g), Ly.curlTip ? g : 1, C.x, sy);
        const wv = wave(Ly.L * 0.6);
        r.poly(pts, scale(Ly.col, 1 + wv * 1.5), 1, SET);
        r.polyline(pts, scale(Ly.hi, 0.6 + wv), 0.8, ADD, true);
        // midrib and cellular patterns propagating across the surface
        axis.forEach((p, q) => {
          if (q % 2) r.px(p.x, p.y, Ly.hi, 0.7 + wv);
          const cellWave = Math.exp(-Math.pow(q / 12 - ((t * 0.7 + li * 0.2) % 1.4), 2) * 40);
          if (Ly.w > 0.15 && q > 1) {
            const perp = a + Math.PI / 2;
            for (const o of [-1, 1]) {
              const ow = Ly.w * L * g * 0.35 * Math.sin(Math.PI * (q / 12));
              r.px(p.x + Math.cos(perp) * ow * o, p.y + Math.sin(perp) * ow * o * 0.75, Ly.hi, (0.2 + cellWave * 1.4 + wv) * 0.8);
            }
          }
        });
        // curled tip still rolled up
        if (Ly.curlTip && g < 0.97) {
          const tp = axis[axis.length - 1];
          r.ring(tp.x, tp.y, 2 + (1 - g) * 4, 1, Ly.hi, 0.9);
        }
      }
      r.light(C.x, sy, Ly.L * 1.2, scale(Ly.hi, 0.4), 0.4 * g);
    });
    // ---- the seed and shell halves
    const open = smooth(2.3, 3.0, t);
    if (open < 1) {
      const rot = Math.sin(t * 0.9) * 0.3;
      for (const side of [-1, 1]) {
        const sep = open * 10, ang = rot + side * open * 0.9;
        const ox = side * sep, oy = open * open * 14;
        const pts: number[] = [];
        for (let q = 0; q <= 10; q++) {
          const u = (q / 10) * Math.PI;
          const lx = side * Math.sin(u) * 5.5, ly = -Math.cos(u) * 8;
          pts.push(C.x + ox + lx * Math.cos(ang) - ly * Math.sin(ang), sy + oy + lx * Math.sin(ang) + ly * Math.cos(ang));
        }
        r.poly(pts, [0.28, 0.22, 0.1], 1 - open, open > 0 ? DITHER : SET);
        r.polyline(pts, [0.6, 0.5, 0.2], 1 - open, ADD);
      }
      // faint internal veins
      const vk = 0.6 + 0.4 * Math.sin(t * 2.5);
      for (let q = -6; q <= 6; q += 2) r.px(C.x + Math.sin(q * 0.4 + rot) * 2, sy + q, LIME, vk * (1 - open) * 0.6);
      // the crack: light leaking through rays
      const cr = smooth(TCR, TCR + 0.3, t);
      if (cr > 0) {
        r.line(C.x - 0.5, sy - 7 * cr, C.x + 0.5, sy + 7 * cr, [2.4, 2.2, 1.2], 1.5 * (1 - open * 0.5));
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * TAU + t * 0.3;
          const L = (20 + 14 * hash(k + Math.floor(t * 6))) * cr * (1 - open * 0.5);
          r.line(C.x + Math.cos(a) * 4, sy + Math.sin(a) * 4, C.x + Math.cos(a) * L, sy + Math.sin(a) * L * 0.75, GOLD, 0.35);
        }
        r.light(C.x, sy, 50, [1.4, 1.2, 0.5], cr * 0.8);
      }
      r.shadow(C.x + 2, C.y + 3, 6, 2.5, 0.6);
    }
    // drifting pollen motes, emphasising fragility
    for (let k = 0; k < 16; k++) {
      const a = hash(k) * TAU + t * (0.3 + hash(k + 1) * 0.4);
      const rr = 10 + hash(k + 2) * 18 + Math.sin(t + k) * 3;
      r.px(C.x + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.7 - 4, GOLD, 0.6 * (1 - smooth(TB, TB + 1, t)));
    }
    // luminous core
    const core = smooth(4.4, 5.6, t) * (1 - smooth(8.9, 9.6, t));
    if (core > 0) {
      const pu = 0.8 + 0.2 * Math.sin(t * 5) + wave(0) * 0.6;
      r.disc(C.x, sy, 4 * core, [2.4, 2.2, 1.2], pu);
      r.glow(C.x, sy, 22 * core, GOLD, pu * core);
      r.light(C.x, sy, 120, [1.2, 1.1, 0.5], core * pu);
    }
    // ---- climax release
    if (t > TB) {
      const e = t - TB;
      if (e < 0.12) { r.flash = 0.35; r.flashCol = [1, 1, 0.6]; }
      for (let k = 0; k < 320; k++) {
        const a = hash(k) * TAU, v = 30 + hash(k + 1) * 150;
        const rr = fly(4, v, 1.5, 0, e), sw = a + Math.log(1 + e) * (k % 2 ? 0.8 : -0.8);
        const life = 1 - e / (1.5 + hash(k + 2) * 2);
        if (life <= 0) continue;
        r.px(C.x + Math.cos(sw) * rr, sy + Math.sin(sw) * rr * 0.75 - e * 6, k % 5 ? GOLD : [2, 2, 1.6], life);
      }
      for (let k = 0; k < 36; k++) {
        const a = hash(k + 50) * TAU, v = 50 + hash(k + 51) * 90;
        const x = C.x + Math.cos(a) * fly(0, v, 2, 0, e) + Math.sin(e * 3 + k) * 5, y = sy + Math.sin(a) * fly(0, v, 2, 0, e) * 0.75 + e * 7;
        const life = 1 - smooth(2.5, 3.5, e);
        if (life > 0) petal(r, x, y, e * 3 + k, 1.6, k % 2 ? [0.8, 0.25, 0.5] : [0.3, 0.8, 0.3], PINK_HI, life);
      }
      // energy streams spiralling out
      for (let k = 0; k < 6; k++)
        for (let q = 0; q < 40; q++) {
          const u = q / 40;
          const head = easeOut(e / 0.9);
          if (u > head || e > 1.6) continue;
          const a = (k / 6) * TAU + u * 3;
          const rr = u * 110;
          r.px(C.x + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.75, LIME, (1 - e / 1.6) * (u > head - 0.1 ? 2 : 0.6));
        }
    }
    // luminous seeds that outlive the parent
    if (t > TB) {
      const e = t - TB;
      s.seeds.forEach((sd: any, k: number) => {
        const rr = fly(0, sd.v, 1.6, 0, e);
        const x = C.x + Math.cos(sd.a + sd.spin * Math.min(e, 2) * 0.3) * rr + Math.sin(e * 0.8 + k) * 4;
        const y = sy + Math.sin(sd.a) * rr * 0.6 + Math.cos(e * 1.1 + k) * 3 - Math.min(e, 2) * 4;
        for (let m = 1; m < 6 && e < 2; m++) r.px(x - Math.cos(sd.a) * m * 1.5, y - Math.sin(sd.a) * m, GOLD, (1 - m / 6) * 0.7);
        r.disc(x, y, 1.3, [2.2, 2, 1], 1);
        r.glow(x, y, 6, GOLD, 0.5 + 0.2 * Math.sin(t * 3 + k));
        r.light(x, y, 16, [1.2, 1, 0.4], 0.4);
      });
    }
  },
};

export const VERDANT = [rootwake, sporeNebula, thornOpera, worldseed];
void easeIn; void ADD; void sparkle; void H; void noise1;
