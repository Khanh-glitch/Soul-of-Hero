import { Effect, sparkle } from '../engine/fx';
import { Renderer, ADD, SET, BLEND, DITHER, MUL, W, H, bayer } from '../engine/renderer';
import {
  Col, RNG, TAU, clamp, lerp, inv, smooth, easeOut, easeIn, easeInOut, easeInExpo, ramp, scale, noise1, noise2, hash, fly, resample, V, pulse,
} from '../engine/math';

export const WATER: Col[] = [[0.01, 0.03, 0.1], [0.03, 0.14, 0.34], [0.1, 0.42, 0.78], [0.42, 1.0, 1.4], [1.5, 1.9, 2.1]];
export const ICE: Col[] = [[0.06, 0.05, 0.2], [0.2, 0.32, 0.75], [0.5, 0.95, 1.4], [1.1, 1.6, 2.0], [2.0, 2.3, 2.6]];
const water = (h: number, k = 1) => scale(ramp(WATER, h), k);
const ice = (h: number, k = 1) => scale(ramp(ICE, h), k);
const FOAM: Col = [1.6, 1.95, 2.1];

// =====================================================================================
// 05 — ABYSSAL BLOOM
// =====================================================================================
type PL = { n: number; start: number; dur: number; L: number; w: number; r0: number; spin: number; off: number };
export const abyssalBloom: Effect = {
  id: 5, name: 'Abyssal Bloom', school: 'TIDE', duration: 9, climax: 4.75,
  blurb: 'An ocean invents a flower of folding membranes, freezes in perfect symmetry, and is shattered by a pressure pulse.',
  setup(r) {
    const rng = new RNG(505);
    const layers: PL[] = [
      { n: 5, start: 2.0, dur: 2.2, L: 92, w: 0.34, r0: 10, spin: 0.12, off: 0.3 },
      { n: 7, start: 0.9, dur: 2.0, L: 66, w: 0.28, r0: 6, spin: -0.22, off: 0 },
      { n: 7, start: 1.5, dur: 1.8, L: 44, w: 0.22, r0: 4, spin: 0.35, off: Math.PI / 7 },
      { n: 14, start: 2.4, dur: 1.4, L: 26, w: 0.12, r0: 3, spin: -0.5, off: 0.1 },
    ];
    const drops = Array.from({ length: 260 }, (_, i) => ({ a: rng.r(0, TAU), r0: rng.r(4, 80), v: rng.r(30, 150), vz: rng.r(40, 200), seed: i }));
    return { layers, drops };
  },
  render(r, t, s) {
    const C = { x: r.target.x - 10, y: r.target.y + 4 };
    const TFZ = 4.4, TP = 5.05;
    const tf = Math.min(t, TFZ);
    const frozen = smooth(TFZ - 0.05, TFZ + 0.1, t) * (t < TP ? 1 : 0);
    const asym = 1 - smooth(3.0, TFZ, tf);
    const e = t - TP;
    const pR = e > 0 ? e * 280 : -1;
    r.light(C.x, C.y, 110, [0.3, 0.8, 1.3], 0.6 + smooth(1, 4, t) * 0.8 - smooth(6, 9, t) * 1.2);
    // ---- surface ring with unnatural slow ripples
    const ringK = 1 - smooth(5, 6, t);
    for (let k = 0; k < 4; k++) {
      const rr = 6 + ((tf * 4 + k * 6) % 24);
      for (let a = 0; a < TAU; a += 0.04) {
        const wob = Math.sin(a * 5 + tf * 2 + k) * 1.4;
        r.px(C.x + Math.cos(a) * (rr + wob), C.y + Math.sin(a) * (rr + wob) * 0.8, water(0.6), 0.5 * ringK * (1 - rr / 30));
      }
    }
    r.disc(C.x, C.y, 9, water(0.15), 0.6 * ringK, BLEND, 0.8);

    // ---- petals (clipped away by the pressure front once it passes)
    if (pR < 140) {
      if (pR > 0) r.clip = (x, y) => Math.hypot(x - C.x, (y - C.y) / 0.82) > pR;
      for (let li = 0; li < s.layers.length; li++) {
        const L: PL = s.layers[li];
        const g = easeOut(inv(L.start, L.start + L.dur, tf));
        if (g <= 0) continue;
        for (let k = 0; k < L.n; k++) {
          const seed = li * 31 + k;
          const len = L.L * g * (1 + asym * (hash(seed) - 0.5) * 0.4);
          // contradictory motion: inner layers fold, outer layers expand & spin opposite
          const a0 = L.off + (k / L.n) * TAU + L.spin * tf + asym * (noise1(tf * 0.6 + seed) - 0.5) * 0.5;
          const fold = li >= 2 ? Math.sin(tf * 1.6 + k) * 0.25 * asym : 0;
          const pts: number[] = [];
          const edge: number[] = [];
          for (let side = 1; side >= -1; side -= 2) {
            for (let q = 0; q <= 14; q++) {
              const u = side > 0 ? q / 14 : 1 - q / 14;
              const half = L.w * Math.sin(Math.PI * Math.pow(u, 0.65)) * (1 - u * 0.25);
              const ripple = (noise1(u * 6 - tf * 1.8 + seed * 3 + side) - 0.5) * 0.12 * (0.4 + asym);
              const a = a0 + fold * u * u + side * (half + ripple);
              const rr = L.r0 + u * len;
              const x = C.x + Math.cos(a) * rr, y = C.y + Math.sin(a) * rr * 0.82;
              pts.push(x, y);
              edge.push(x, y);
            }
          }
          // translucent membrane: floor remains visible through dithered depth
          const depth = 0.12 + li * 0.08;
          r.poly(pts, water(depth), 0.38, BLEND);
          r.poly(pts, frozen > 0 ? ice(0.55) : water(0.45), 0.18 + frozen * 0.35);
          // darker currents flowing along the petal axis
          for (let q = 0; q < len; q += 1.4) {
            const u = q / len;
            const ph = Math.sin(q * 0.35 - tf * 7 + k);
            for (const o of [-0.4, 0, 0.4]) {
              const a = a0 + fold * u * u + o * L.w * Math.sin(Math.PI * u) * 0.8;
              const x = C.x + Math.cos(a) * (L.r0 + q), y = C.y + Math.sin(a) * (L.r0 + q) * 0.82;
              if (ph > 0.55) r.px(x, y, water(0.7), 0.45);
              else if (ph < -0.7) r.px(x, y, [0.6, 0.6, 0.5], 1, MUL);
            }
          }
          // bright, foamy rim
          r.polyline(edge, frozen > 0 ? ice(0.95) : water(0.85), 0.9 + frozen * 0.8, ADD, true);
          // droplets separating and reconnecting at the tip
          const tipA = a0 + fold;
          const det = Math.max(0, Math.sin(tf * 3 + seed)) * 6 * asym;
          const tx = C.x + Math.cos(tipA) * (L.r0 + len + det), ty = C.y + Math.sin(tipA) * (L.r0 + len + det) * 0.82;
          r.disc(tx, ty, 1.2, FOAM, 0.9);
          if (det > 2) r.px(C.x + Math.cos(tipA) * (L.r0 + len + det * 0.5), C.y + Math.sin(tipA) * (L.r0 + len + det * 0.5) * 0.82, water(0.8), 0.6);
        }
      }
      // bubbles circling inside
      for (let k = 0; k < 46; k++) {
        const rr = 6 + hash(k) * 50 * smooth(1, 3.5, tf);
        const a = hash(k + 3) * TAU + tf * (0.8 + 20 / (rr + 10)) * (k % 2 ? 1 : -1);
        const x = C.x + Math.cos(a) * rr, y = C.y + Math.sin(a) * rr * 0.82 - ((tf * 6 + k) % 6);
        if (k % 3 === 0) r.ring(x, y, 1.3, 0.8, FOAM, 0.6);
        else r.px(x, y, FOAM, 0.8);
      }
      // freeze glint sweeping diagonally across the frozen form
      if (frozen > 0) {
        const gl = (t - TFZ) * 300 - 120;
        r.clip = (x, y) => Math.abs((x - C.x) + (y - C.y) - gl) < 3 && Math.hypot(x - C.x, (y - C.y) / 0.82) < 85 && (pR < 0 || Math.hypot(x - C.x, (y - C.y) / 0.82) > pR);
        r.disc(C.x, C.y, 95, [0.5, 0.7, 0.9], 0.12);
      }
      r.clip = null;
    }
    // ---- eruption
    if (e >= 0) {
      if (e < 0.15) r.flash = 0.5 * (1 - e / 0.15);
      if (e < 0.4) { r.shakeX = (hash(t * 33) - 0.5) * 6; r.shakeY = (hash(t * 21) - 0.5) * 5; }
      // pressure front
      if (e < 0.6) {
        r.ring(C.x, C.y, pR, 2.5, FOAM, 1.4 * (1 - e / 0.6), ADD, 0.82);
        r.ring(C.x, C.y, pR * 0.8, 6, water(0.4), 0.4 * (1 - e / 0.6), BLEND, 0.82);
      }
      // roaring curved sheets
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU + 0.2;
        const rr = easeOut(e / 0.9) * (70 + (k % 3) * 22);
        const life = 1 - smooth(0.4, 1.2, e);
        if (life <= 0) break;
        const span = 0.5;
        const pts: number[] = [];
        for (let q = 0; q <= 10; q++) {
          const aa = a - span / 2 + (q / 10) * span;
          pts.push(C.x + Math.cos(aa) * rr, C.y + Math.sin(aa) * rr * 0.82 - Math.sin((q / 10) * Math.PI) * 10 * life);
        }
        for (let q = 10; q >= 0; q--) {
          const aa = a - span / 2 + (q / 10) * span;
          pts.push(C.x + Math.cos(aa) * (rr - 8 * life), C.y + Math.sin(aa) * (rr - 8 * life) * 0.82);
        }
        r.poly(pts, water(0.5), 0.6 * life, BLEND);
        r.polyline(pts.slice(0, 22), FOAM, 1.3 * life);
      }
      // airborne droplets with ballistic z and splash rings
      for (const d of s.drops) {
        const tland = (2 * d.vz) / 300;
        const gx = C.x + Math.cos(d.a) * (d.r0 + fly(0, d.v, 0.8, 0, Math.min(e, tland)));
        const gy = C.y + Math.sin(d.a) * (d.r0 + fly(0, d.v, 0.8, 0, Math.min(e, tland))) * 0.82;
        if (e < tland) {
          const z = d.vz * e - 150 * e * e;
          r.px(gx, gy - z, FOAM, 1.1);
          if (d.seed % 3 === 0) r.px(gx, gy - z + 1, water(0.7), 0.7);
          if (d.seed % 4 === 0) r.px(gx, gy, [0.7, 0.7, 0.7], 1, MUL);
        } else {
          const ee = e - tland;
          if (ee < 0.5) r.ring(gx, gy, 0.5 + ee * 7, 0.7, water(0.8), (1 - ee / 0.5) * 0.8, ADD, 0.6);
          if (ee < 2.5) r.decal(gx, gy, [0.05, 0.1, 0.16], 0.5 * (1 - ee / 2.5));
        }
      }
      // thin streams returning to the centre
      for (let k = 0; k < 12; k++) {
        const st = 1.0 + hash(k) * 1.4;
        const u = (e - st) / 1.6;
        if (u < 0 || u > 1.2) continue;
        for (let m = 0; m < 22; m++) {
          const uu = clamp(u - m * 0.012);
          if (uu <= 0 || uu >= 1) continue;
          const rr = 100 * (1 - easeInOut(uu));
          const a = hash(k + 9) * TAU + uu * 2.4 * (k % 2 ? 1 : -1);
          r.px(C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * 0.82, m === 0 ? FOAM : water(0.75), 1 - m / 22);
        }
      }
      // reformed tiny pool
      const pool = smooth(2.2, 3.2, e) * (1 - smooth(3.4, 4, e));
      if (pool > 0) r.ring(C.x, C.y, 4 + pool * 3, 1, water(0.8), pool, ADD, 0.8);
    }
  },
  post(r, t, s) {
    // refraction: the floor seen through the bloom wavers
    const C = { x: r.target.x - 10, y: r.target.y + 4 };
    const R = 90 * smooth(0.8, 3, t) * (1 - smooth(5.0, 5.4, t));
    if (R < 4) return;
    const tf = Math.min(t, 4.4);
    r.warp(C.x - R, C.y - R, C.x + R, C.y + R, (x, y, o) => {
      const d = Math.hypot(x - C.x, y - C.y) / R;
      if (d > 1) return;
      o[0] = x + Math.sin(y * 0.4 + tf * 5) * 1.6 * (1 - d);
      o[1] = y + Math.cos(x * 0.35 + tf * 4) * 1.2 * (1 - d);
    });
  },
};

// =====================================================================================
// 06 — RIPTIDE CALLIGRAPHY
// =====================================================================================
type Stroke = { p: V[]; len: number[]; total: number; ts: number; dur: number; ease: (u: number) => number; curv: number[]; nrm: V[]; press: number };
export const riptideCalligraphy: Effect = {
  id: 6, name: 'Riptide Calligraphy', school: 'TIDE', duration: 9.5, climax: 6.95,
  blurb: 'An invisible calligrapher writes with the sea. When the last stroke lands, the writing becomes waves.',
  setup(r) {
    const C = r.caster;
    const defs: [number[][], number, number, (u: number) => number, number][] = [
      [[[C.x + 6, C.y - 10], [150, 70], [215, 42], [280, 52], [338, 86]], 0.5, 0.9, easeInOut, 1],
      [[[C.x + 8, C.y + 4], [180, 158], [250, 150], [300, 124], [306, 94], [286, 100]], 1.45, 0.7, (u) => easeOut(u), 1.1],
      [[[160, 112], [214, 82], [252, 104], [240, 134], [208, 116], [236, 84], [296, 66], [348, 60]], 2.2, 1.3, (u) => u, 0.8],
      [[[214, 22], [262, 104], [312, 196]], 3.6, 0.35, (u) => easeInExpo(u), 1.3],
      [[[146, 94], [186, 168], [262, 182], [330, 150], [356, 108], [340, 92]], 4.1, 1.1, easeInOut, 1],
    ];
    const strokes: Stroke[] = defs.map(([pts, ts, dur, ease, press]) => {
      const rs = resample(pts.map(([x, y]) => ({ x, y })), 1.2);
      const n = rs.p.length;
      const nrm: V[] = [], curv: number[] = [];
      for (let i = 0; i < n; i++) {
        const a = rs.p[Math.max(0, i - 2)], b = rs.p[Math.min(n - 1, i + 2)];
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
        nrm.push({ x: -dy / L, y: dx / L });
      }
      for (let i = 0; i < n; i++) {
        const a = nrm[Math.max(0, i - 3)], b = nrm[Math.min(n - 1, i + 3)];
        curv.push(Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)));
      }
      return { p: rs.p, len: rs.len, total: rs.total, ts, dur, ease, curv, nrm, press };
    });
    // intersections between strokes (where currents braid)
    const knots: { x: number; y: number; tk: number }[] = [];
    const passT = (S: Stroke, i: number) => {
      const f = S.len[i] / S.total;
      // invert ease numerically
      let lo = 0, hi = 1;
      for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (S.ease(m) < f) lo = m; else hi = m; }
      return S.ts + lo * S.dur;
    };
    for (let a = 0; a < strokes.length; a++)
      for (let b = a + 1; b < strokes.length; b++) {
        const A = strokes[a], B = strokes[b];
        for (let i = 0; i < A.p.length; i += 3)
          for (let j = 0; j < B.p.length; j += 3) {
            if (Math.hypot(A.p[i].x - B.p[j].x, A.p[i].y - B.p[j].y) < 2.2) {
              if (!knots.some((k) => Math.hypot(k.x - A.p[i].x, k.y - A.p[i].y) < 14))
                knots.push({ x: A.p[i].x, y: A.p[i].y, tk: Math.max(passT(A, i), passT(B, j)) });
            }
          }
      }
    return { strokes, knots };
  },
  render(r, t, s) {
    const TE = 5.6;
    const waves = [6.2, 6.75, 7.3];
    const waveX = (k: number) => -60 + (t - waves[k]) * 330;
    const wx0 = t > waves[0] ? waveX(0) : -999;
    r.light(r.caster.x, r.caster.y - 10, 40, [0.3, 0.8, 1.2], t < 5 ? 0.6 : 0);
    for (const S of s.strokes as Stroke[]) {
      const u = (t - S.ts) / S.dur;
      if (u < 0) continue;
      const head = S.total * S.ease(clamp(u));
      const race = t > TE ? (t - TE) * 420 : -1;
      for (let i = 0; i < S.p.length; i++) {
        const sL = S.len[i];
        if (sL > head) break;
        const p = S.p[i], n = S.nrm[i];
        const prof = Math.pow(Math.sin(Math.PI * (sL / S.total)), 0.6);
        let w = (0.8 + 4.2 * prof * S.press) * (1 + 0.25 * Math.sin(sL * 0.08 + S.ts));
        w *= smooth(0, 14, head - sL) * 0.6 + 0.4;
        // after the first wave passes, strokes dissolve into fading threads
        if (p.x < wx0) {
          const fade = 1 - clamp((wx0 - p.x) / 140);
          if (i % 2 === 0 && hash(i + S.ts * 10) < fade) r.px(p.x, p.y, water(0.8), fade * 0.9);
          continue;
        }
        r.disc(p.x, p.y, w, water(0.2), 0.32, BLEND);
        // flowing texture along arclength
        const flow = Math.sin(sL * 0.45 - t * 13);
        if (flow > 0.6) r.px(p.x + n.x * w * 0.3, p.y + n.y * w * 0.3, water(0.75), 0.7);
        if (flow < -0.85) r.px(p.x - n.x * w * 0.4, p.y - n.y * w * 0.4, water(0.6), 0.6);
        // foam along turbulent edges, denser with curvature
        const foamP = 0.25 + S.curv[i] * 2.5;
        for (const sg of [1, -1]) {
          if (hash(i * 3 + sg + Math.floor(t * 12) * 0.13) < foamP)
            r.px(p.x + n.x * w * sg, p.y + n.y * w * sg, FOAM, 0.9);
          else if (i % 2) r.px(p.x + n.x * w * sg, p.y + n.y * w * sg, water(0.7), 0.5);
        }
        // energy racing through the finished writing
        if (race > 0) {
          const k = Math.exp(-Math.abs(sL - race % (S.total + 80)) * 0.12);
          if (k > 0.05) r.disc(p.x, p.y, w * 0.6, [1.5, 2, 2.4], k * 1.5);
        }
      }
      // brush tip
      if (u < 1) {
        const i = S.len.findIndex((l) => l >= head);
        const p = S.p[i < 0 ? S.p.length - 1 : i];
        r.disc(p.x, p.y, 2.2, FOAM, 1.5);
        r.glow(p.x, p.y, 10, water(0.8), 0.7);
        r.light(p.x, p.y, 40, [0.4, 0.9, 1.3], 0.8);
      }
      // droplets breaking free where curvature is extreme
      for (let i = 0; i < S.p.length; i += 4) {
        if (S.curv[i] < 0.28) continue;
        const tp = S.ts + S.dur * (S.len[i] / S.total);
        const e = t - tp;
        if (e < 0 || e > 0.9) continue;
        for (let m = 0; m < 3; m++) {
          const sg = m % 2 ? 1 : -1;
          const v0 = 25 + hash(i + m) * 40;
          const x = fly(S.p[i].x, S.nrm[i].x * v0 * sg, 2, 0, e), y = fly(S.p[i].y, S.nrm[i].y * v0 * sg - 20, 2, 80, e);
          r.px(x, y, FOAM, 1 - e / 0.9);
        }
      }
    }
    // braided knots where currents cross
    for (const k of s.knots) {
      const e = t - k.tk;
      if (e < 0 || k.x < wx0) continue;
      const g = smooth(0, 0.4, e);
      for (let arm = 0; arm < 3; arm++)
        for (let q = 0; q < 16; q++) {
          const rr = q * 0.45 * g;
          const a = arm * (TAU / 3) + q * 0.4 - t * 6;
          r.px(k.x + Math.cos(a) * rr, k.y + Math.sin(a) * rr, q > 11 ? FOAM : water(0.8), 0.9);
        }
      r.glow(k.x, k.y, 9, water(0.9), (0.5 + 0.3 * Math.sin(t * 8 + k.x)) * g);
    }
    // cutting waves
    waves.forEach((tw, k) => {
      const e = t - tw;
      if (e < 0 || e > 1.6) return;
      const X = waveX(k);
      const life = 1 - smooth(1.1, 1.6, e);
      const pts: number[] = [], back: number[] = [];
      for (let y = -10; y <= H + 10; y += 4) {
        const bend = -Math.pow((y - H / 2) / (H / 2), 2) * 38;
        const crest = X + bend + Math.sin(y * 0.15 + t * 10) * 2;
        pts.push(crest, y);
        back.push(crest - 16 - (k * 4), y);
      }
      for (let q = 0; q + 3 < pts.length; q += 2) {
        for (let y = Math.floor(pts[q + 1]); y < pts[q + 3]; y++) {
          const cx = lerp(pts[q], pts[q + 2], (y - pts[q + 1]) / 4);
          const th = 14 + k * 4;
          for (let x = Math.floor(cx - th); x < cx; x++) r.plot(x, y, 0.08, 0.35, 0.65, BLEND, 0.35 * life * (1 - (cx - x) / th));
        }
      }
      r.polyline(pts, FOAM, 1.5 * life);
      for (let q = 0; q < pts.length; q += 2) {
        r.px(pts[q] - 2 - hash(q + k) * 6, pts[q + 1] + hash(q) * 3, FOAM, 0.8 * life);
        // spray
        const sp = hash(q * 7 + Math.floor(t * 20) + k);
        if (sp > 0.6) r.px(pts[q] + sp * 8, pts[q + 1] - sp * 4, FOAM, life);
      }
    });
    // scattered foam lingering after waves
    if (t > 6.4) {
      for (let q = 0; q < 140; q++) {
        const x = hash(q) * W, y = hash(q + 5) * H;
        if (x > wx0 - 20) continue;
        const life = clamp(1 - (t - 6.4 - hash(q + 1) * 2) / 2);
        if (life > 0) r.px(x + Math.sin(t + q) * 2, y, FOAM, life * 0.6);
      }
    }
  },
  post(r, t, s) {
    const waves = [6.2, 6.75, 7.3];
    for (let k = 0; k < 3; k++) {
      const e = t - waves[k];
      if (e < 0 || e > 1.5) continue;
      const X = -60 + e * 330;
      r.warp(X - 50, 0, X + 4, H - 1, (x, y, o) => {
        const bend = -Math.pow((y - H / 2) / (H / 2), 2) * 38;
        const d = X + bend - x;
        if (d < 0 || d > 30) return;
        o[0] = x - Math.sin(d * 0.3) * 3;
      });
    }
  },
};

// =====================================================================================
// 07 — MIRRORFROST BASILICA
// =====================================================================================
type Facet = { pts: number[]; cx: number; cy: number; shade: number; ta: number; from: V; cracks: number[]; shards: { pts: number[]; cx: number; cy: number; v: V; spin: number }[]; ring: number };
type FrostSeg = { x0: number; y0: number; x1: number; y1: number; tb: number; hex: boolean };
export const mirrorfrostBasilica: Effect = {
  id: 7, name: 'Mirrorfrost Basilica', school: 'TIDE', duration: 10, climax: 6.15,
  blurb: 'Frost grows into a cathedral seen from above, then a single point breaks and the whole architecture lets go.',
  setup(r) {
    const rng = new RNG(707);
    const C = { x: W / 2 + 34, y: H / 2 + 2 };
    const SY = 0.78;
    // ---- frost filaments: hexagonal branching, each sector with its own seed
    const frost: FrostSeg[] = [];
    for (let sec = 0; sec < 6; sec++) {
      const sr = new RNG(900 + sec * 17);
      const grow = (x: number, y: number, a: number, len: number, t0: number, depth: number) => {
        let cx = x, cy = y, tt = t0;
        const n = Math.floor(len / 3);
        for (let i = 0; i < n; i++) {
          const nx = cx + Math.cos(a) * 3, ny = cy + Math.sin(a) * 3 * SY;
          tt += 0.035 + sr.r(0, 0.03);
          frost.push({ x0: cx, y0: cy, x1: nx, y1: ny, tb: tt, hex: depth > 0 && sr.next() < 0.08 });
          cx = nx; cy = ny;
          if (depth < 2 && sr.next() < 0.28) grow(cx, cy, a + sr.sign() * Math.PI / 3, (len - i * 3) * sr.r(0.3, 0.55), tt, depth + 1);
        }
      };
      grow(C.x, C.y, (sec / 6) * TAU + Math.PI / 6, 104 + sr.r(-10, 10), 0.1, 0);
    }
    // ---- architecture: dome, vault ring, chapels
    const facets: Facet[] = [];
    const B = { x: C.x + 74, y: C.y + 22 };
    const add = (pts: number[], ring: number, light: number) => {
      let cx = 0, cy = 0;
      for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; }
      cx /= pts.length / 2; cy /= pts.length / 2;
      const dirA = Math.atan2(cy - C.y, cx - C.x);
      const cracks: number[] = [];
      for (let k = 0; k < 4; k++) {
        const i = rng.i(0, pts.length / 2 - 1) * 2;
        cracks.push(cx + (pts[i] - cx) * 0.1, cy + (pts[i + 1] - cy) * 0.1, lerp(cx, pts[i], rng.r(0.6, 1)), lerp(cy, pts[i + 1], rng.r(0.6, 1)));
      }
      // split into shards for the fracture: fan from centroid to each edge
      const shards: Facet['shards'] = [];
      for (let i = 0; i < pts.length; i += 2) {
        const j = (i + 2) % pts.length;
        const sp = [cx, cy, pts[i], pts[i + 1], pts[j], pts[j + 1]];
        const scx = (cx + pts[i] + pts[j]) / 3, scy = (cy + pts[i + 1] + pts[j + 1]) / 3;
        const da = Math.atan2(scy - B.y, scx - B.x);
        const sp0 = rng.r(30, 90);
        shards.push({ pts: sp, cx: scx, cy: scy, v: { x: Math.cos(da) * sp0 + rng.r(-15, 15), y: Math.sin(da) * sp0 * 0.8 + rng.r(-25, 5) }, spin: rng.r(-8, 8) });
      }
      const d = Math.hypot(cx - C.x, cy - C.y);
      facets.push({
        pts, cx, cy, shade: light, ta: 1.5 + d / 52 + rng.r(0, 0.35),
        from: { x: cx + Math.cos(dirA) * rng.r(20, 40), y: cy + Math.sin(dirA) * rng.r(20, 40) - rng.r(10, 30) }, cracks, shards, ring,
      });
    };
    const LA = -2.3; // light from top-left
    const P = (rr: number, a: number) => [C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * SY];
    // central dome: 6 triangular facets
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * TAU, a1 = ((k + 1) / 6) * TAU;
      add([C.x, C.y - 5, ...P(17, a0), ...P(17, a1)], 0, 0.55 + 0.45 * Math.cos((a0 + a1) / 2 - LA));
    }
    // vault ring: 12 bays, each a ridge roof of two triangles
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * TAU, a1 = ((k + 1) / 12) * TAU, am = (a0 + a1) / 2;
      const ridge = P(31, am);
      ridge[1] -= 4;
      const l1 = 0.5 + 0.45 * Math.cos(am - 0.5 - LA), l2 = 0.5 + 0.45 * Math.cos(am + 0.5 - LA);
      add([...P(21, a0), ...P(42, a0), ...ridge], 1, l1);
      add([...P(42, a0), ...P(42, a1), ...ridge], 1, (l1 + l2) / 2 + 0.1);
      add([...P(21, a1), ...P(21, a0), ...ridge], 1, (l1 + l2) / 2 - 0.15);
      add([...P(42, a1), ...P(21, a1), ...ridge], 1, l2);
    }
    // six chapels: kite roofs
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + Math.PI / 6;
      const tip = P(80, a), l = P(52, a - 0.32), rr = P(52, a + 0.32), base = P(47, a);
      const mid = P(62, a);
      mid[1] -= 6;
      const la = 0.5 + 0.45 * Math.cos(a - 0.6 - LA), lb = 0.5 + 0.45 * Math.cos(a + 0.6 - LA);
      add([...base, ...l, ...mid], 2, la);
      add([...l, ...tip, ...mid], 2, la * 0.8);
      add([...base, ...mid, ...rr], 2, lb);
      add([...mid, ...tip, ...rr], 2, lb * 0.8);
    }
    const spires = Array.from({ length: 6 }, (_, k) => {
      const a = (k / 6) * TAU;
      return { x: C.x + Math.cos(a) * 66, y: C.y + Math.sin(a) * 66 * SY, h: 18 + (k % 2) * 10, ta: 3.4 + k * 0.08 };
    });
    spires.push({ x: C.x, y: C.y, h: 34, ta: 3.9 });
    return { C, SY, frost, facets, spires, B };
  },
  render(r, t, s) {
    const { C, B } = s;
    const TB = 5.95;
    r.ambient = 0.55;
    r.light(C.x, C.y, 130, [0.4, 0.7, 1.3], 0.4 + smooth(1.5, 5, t) * 0.7 - smooth(TB, TB + 2, t) * 0.8);
    // ---- frost filaments (linger as delicate patterns, then dissolve)
    const dissolve = smooth(7.2, 9.5, t);
    for (const f of s.frost as FrostSeg[]) {
      if (t < f.tb) continue;
      if (hash(f.x0 * 3.1 + f.y0) < dissolve) continue;
      const fresh = Math.exp(-(t - f.tb) * 3);
      r.decalLine(f.x0, f.y0, f.x1, f.y1, [0.35, 0.45, 0.6], 0.6);
      r.line(f.x0, f.y0, f.x1, f.y1, ice(0.75 + fresh * 0.25), 0.4 + fresh * 1.2);
      if (f.hex) r.ring(f.x1, f.y1, 2, 0.8, ice(0.9), 0.7);
    }
    const pulseR = t > 4.2 && t < 5.6 ? ((t - 4.2) % 0.7) * 160 : -100;
    // ---- spectral reflections from spires (drawn under roofs)
    for (const sp of s.spires) {
      const g = easeOut(inv(sp.ta, sp.ta + 0.6, t));
      if (g <= 0) continue;
      const brk = t > TB + Math.hypot(sp.x - B.x, sp.y - B.y) / 120;
      if (brk) continue;
      const h = sp.h * g;
      r.poly([sp.x - 2, sp.y, sp.x + 2, sp.y, sp.x + 2 + h * 1.4, sp.y + h * 0.9, sp.x + h * 1.4 - 1, sp.y + h * 0.9 + 2], ice(0.6), 0.25);
    }
    // ---- facets: assemble, glow pulses, cracks, shatter
    for (const f of s.facets as Facet[]) {
      const a = easeInOut(inv(f.ta, f.ta + 0.7, t));
      if (a <= 0) continue;
      const tb = TB + Math.hypot(f.cx - B.x, f.cy - B.y) / 120;
      if (t < tb) {
        const ox = (f.from.x - f.cx) * (1 - a), oy = (f.from.y - f.cy) * (1 - a);
        const pts = f.pts.map((v, i) => v + (i % 2 ? oy : ox));
        const dC = Math.hypot(f.cx - C.x, f.cy - C.y);
        const pl = Math.exp(-Math.pow((dC - pulseR) / 10, 2));
        const h = clamp(f.shade * 0.75 + pl * 0.35 + (1 - a) * 0.3);
        r.poly(pts, ice(h * 0.9 + 0.05), a * 0.85 + 0.15, a < 1 ? DITHER : SET);
        r.polyline(pts, ice(Math.min(1, h + 0.3)), 0.35 + pl, ADD, true);
        // fine internal fractures multiplying
        const cr = smooth(4.8 + hash(f.cx) * 0.6, TB, t + (130 - Math.hypot(f.cx - B.x, f.cy - B.y)) / 400);
        for (let k = 0; k < f.cracks.length; k += 4) {
          if (k / f.cracks.length > cr) break;
          r.line(f.cracks[k], f.cracks[k + 1], f.cracks[k + 2], f.cracks[k + 3], [2.2, 2.4, 2.6], 0.6 + cr);
        }
      } else {
        // chain-reaction fracture: shards fly, glint, scatter
        const e = t - tb;
        if (e < 0.06) r.glow(f.cx, f.cy, 8, [2, 2.3, 2.6], 1.2);
        for (const sh of f.shards) {
          const life = 1 - smooth(1.0, 2.2, e);
          if (life <= 0) continue;
          const x = fly(0, sh.v.x, 1.4, 0, e), y = fly(0, sh.v.y, 1.4, 140, e);
          const rot = sh.spin * e;
          const cs = Math.cos(rot), sn = Math.sin(rot);
          const pts: number[] = [];
          for (let i = 0; i < 6; i += 2) {
            const lx = sh.pts[i] - sh.cx, ly = sh.pts[i + 1] - sh.cy;
            pts.push(sh.cx + x + lx * cs - ly * sn, sh.cy + y + lx * sn + ly * cs);
          }
          const gl = Math.pow(Math.max(0, Math.cos(rot * 2 + f.cx)), 8);
          r.poly(pts, ice(f.shade * 0.7 + gl * 0.3), life, DITHER);
          r.polyline(pts, ice(0.9), 0.4 * life, ADD, true);
          if (gl > 0.6) sparkle(r, sh.cx + x, sh.cy + y, 3, [2, 2.3, 2.6], gl * life);
        }
        // glittering spray of fine fragments
        for (let k = 0; k < 4; k++) {
          const a = hash(f.cx + k) * TAU, v0 = 40 + hash(f.cy + k) * 90;
          const x = fly(f.cx, Math.cos(a) * v0, 2, 0, e), y = fly(f.cy, Math.sin(a) * v0 - 30, 2, 120, e);
          if (e < 1.4) r.px(x, y, FOAM, (1 - e / 1.4) * (flickS(k + f.cx, t) ? 1.6 : 0.4));
        }
      }
    }
    // ---- spires: tall shards rising
    for (const sp of s.spires) {
      const g = easeOut(inv(sp.ta, sp.ta + 0.6, t));
      if (g <= 0) continue;
      const tb = TB + Math.hypot(sp.x - B.x, sp.y - B.y) / 120;
      if (t > tb) continue;
      const h = sp.h * g;
      r.poly([sp.x - 3, sp.y, sp.x, sp.y - h, sp.x, sp.y + 1], ice(0.85), 1, SET);
      r.poly([sp.x, sp.y - h, sp.x + 3, sp.y, sp.x, sp.y + 1], ice(0.45), 1, SET);
      r.px(sp.x, sp.y - h, [2.5, 2.6, 2.8], 1.5);
    }
    // ---- the single point that breaks
    const pb = pulse(TB - 0.35, TB + 0.1, t);
    if (pb > 0) { r.glow(B.x, B.y, 14, [2, 2.4, 2.8], pb * 1.5); sparkle(r, B.x, B.y, 6, [2.5, 2.6, 2.8], pb * 2); }
    if (t > TB && t < TB + 0.12) r.flash = 0.35;
    if (t > TB && t < TB + 1.2) { r.shakeX = (hash(t * 40) - 0.5) * 3; r.shakeY = (hash(t * 47) - 0.5) * 2; }
  },
};
const flickS = (k: number, t: number) => hash(k * 7.7 + Math.floor(t * 20)) > 0.6;

// =====================================================================================
// 08 — UNDERTOW MAW
// =====================================================================================
export const undertowMaw: Effect = {
  id: 8, name: 'Undertow Maw', school: 'TIDE', duration: 8.5, climax: 5.3,
  blurb: 'A whirlpool whose shaft is a log-polar tunnel — deeper than the screen. Then every current stops.',
  setup(r) {
    const rng = new RNG(808);
    const drops = Array.from({ length: 220 }, (_, i) => ({ a: rng.r(0, TAU), v: rng.r(40, 200), vz: rng.r(60, 220), s: i }));
    const tunnels = Array.from({ length: 7 }, () => ({ a: rng.r(0, TAU), d: rng.r(30, 90), t0: rng.r(0.2, 1.2), R: rng.r(6, 12) }));
    return { drops, tunnels };
  },
  render(r, t, s) {
    const C = { x: W / 2 + 26, y: H / 2 + 4 };
    const TS = 4.35, TC = 4.65, TX = 5.05;
    const tf = Math.min(t, TS);
    const violence = smooth(2, TS, tf);
    const open = easeOut(inv(0.9, 3.2, t));
    const contract = 1 - easeIn(inv(TC, TX - 0.1, t));
    const R = 82 * open * contract;
    const e = t - TX;
    r.ambient = 0.62 - violence * 0.15 - (t > TS && t < TX ? 0.2 : 0);
    // ---- early: dark ripples crawling inward & thin spiralling streams
    if (t < 3) {
      const k = 1 - smooth(2, 3, t);
      for (let q = 0; q < 4; q++) {
        const rr = 90 - ((t * 25 + q * 22) % 88);
        r.ring(C.x, C.y, rr, 1, [0.75, 0.8, 0.9], k, MUL, 0.78);
      }
    }
    if (t < TS + 0.01) {
      for (let k = 0; k < 7; k++)
        for (let m = 0; m < 40; m++) {
          const u = ((tf * 0.5 + k / 7 + m * 0.006) % 1);
          const rr = 110 * (1 - u);
          const a = k * 0.9 + u * 5 + tf * 0.5;
          r.px(C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * 0.78, m < 4 ? FOAM : water(0.7), (1 - m / 40) * smooth(0.2, 1, t) * 0.8);
        }
    }
    // ---- the shaft: per-pixel log-polar rendering
    if (R > 1.5) {
      const Rm = R * 1.25;
      const stopped = t > TS;
      for (let y = Math.floor(C.y - Rm); y <= C.y + Rm; y++)
        for (let x = Math.floor(C.x - Rm); x <= C.x + Rm; x++) {
          const dx = x + 0.5 - C.x, dy = (y + 0.5 - C.y) / 0.78;
          const th = Math.atan2(dy, dx);
          const Re = R * (1 + 0.2 * violence * Math.sin(3 * th - tf * 2.2) + 0.06 * Math.sin(7 * th + tf * 3));
          const d = Math.hypot(dx, dy) / Re;
          if (d > 1) continue;
          const depth = -Math.log(d + 0.015) * 3.2 + tf * 1.8;
          const ang = th + tf * (0.6 + 1.6 / (d + 0.12)) * (0.6 + violence);
          const band = depth - Math.floor(depth);
          const bri = Math.pow(d, 0.75);
          const nz = noise2(Math.cos(ang) * 3 + Math.sin(ang) * 2 + depth * 0.0, depth * 1.6 + Math.sin(ang * 3) * 0.5);
          const nz2 = noise2(ang * 4.0 / 1.0 + 20, depth * 2.2);
          let c = water(0.08 + bri * 0.5);
          if (band < 0.1) c = water(0.25 + bri * 0.5);
          if (nz2 > 0.74) c = scale(FOAM, bri * 0.9);
          else if (nz > 0.7) c = water(0.45 + bri * 0.4);
          if (d < 0.07) c = [0, 0, 0.01];
          if (d > 0.93 && bayer(x, y) > (1 - d) * 14) continue; // dithered rim blending
          if (stopped) c = scale(c, 0.8);
          r.plot(x, y, c[0], c[1], c[2], SET, 1);
        }
      // rim foam
      for (let a = 0; a < TAU; a += 0.02) {
        const Re = R * (1 + 0.2 * violence * Math.sin(3 * a - tf * 2.2) + 0.06 * Math.sin(7 * a + tf * 3));
        if (hash(Math.floor(a * 50) + Math.floor(tf * 8)) > 0.45)
          r.px(C.x + Math.cos(a) * Re, C.y + Math.sin(a) * Re * 0.78, FOAM, 0.9);
      }
      // droplets released from the rim accelerating inward
      for (let k = 0; k < 50; k++) {
        const u = (tf * 0.35 + hash(k)) % 1;
        const rr = R * 1.15 * Math.pow(1 - u, 1.6);
        const a = hash(k + 4) * TAU + u * u * 9 + tf * 0.4;
        for (let m = 0; m < 4; m++) {
          const uu = Math.max(0, u - m * 0.01);
          const r2 = R * 1.15 * Math.pow(1 - uu, 1.6), a2 = hash(k + 4) * TAU + uu * uu * 9 + tf * 0.4;
          r.px(C.x + Math.cos(a2) * r2, C.y + Math.sin(a2) * r2 * 0.78, FOAM, (1 - m / 4) * (1 - u));
        }
        void rr; void a;
      }
      // bright streams dragged across the void
      if (violence > 0.3)
        for (let k = 0; k < 3; k++) {
          const a0 = tf * 1.3 + k * 2.1;
          for (let q = 0; q < 50; q++) {
            const u = q / 50;
            const rr = R * (0.95 - u * 0.85);
            const a = a0 + u * 3.2;
            r.px(C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * 0.78, water(0.9), violence * (1 - u) * 1.1);
          }
        }
      r.light(C.x, C.y, R * 1.8, [0.2, 0.5, 1.0], 0.5);
    }
    // stillness: a dark pin
    if (t > TC && t < TX + 0.05) {
      r.disc(C.x, C.y, 1.5, [0, 0, 0], 1, SET);
      r.ring(C.x, C.y, 2.5, 1, FOAM, 1.2);
    }
    // ---- inverse surge
    if (e >= 0) {
      if (e < 0.1) r.flash = 0.6;
      if (e < 0.6) { r.shakeX = (hash(t * 50) - 0.5) * 9 * (1 - e / 0.6); r.shakeY = (hash(t * 55) - 0.5) * 7 * (1 - e / 0.6); }
      // concentric walls of water (heights faked by stacked crests)
      for (let k = 0; k < 3; k++) {
        const rr = fly(4, 260 - k * 60, 1.6 + k * 0.4, 0, e);
        const life = 1 - smooth(0.6 + k * 0.3, 1.6 + k * 0.3, e);
        if (life <= 0) continue;
        const h = 12 * life * (1 - k * 0.25);
        r.ring(C.x, C.y, rr - 4, 9, water(0.3), 0.5 * life, BLEND, 0.78);
        for (let a = 0; a < TAU; a += 0.015) {
          const wob = Math.sin(a * 9 + k * 3 + e * 6) * 2.5;
          const x = C.x + Math.cos(a) * (rr + wob), y = C.y + Math.sin(a) * (rr + wob) * 0.78;
          r.px(x, y, water(0.75), life);
          r.px(x, y - h * (0.6 + 0.4 * Math.sin(a * 5 + k)), FOAM, life * 1.1);
          if (hash(a * 100 + k) > 0.7) r.px(x, y - h * 0.5, water(0.85), life * 0.8);
        }
      }
      // collapsing liquid tunnels
      for (const tn of s.tunnels) {
        const u = (e - tn.t0) / 0.7;
        if (u < 0 || u > 1) continue;
        const x = C.x + Math.cos(tn.a) * tn.d, y = C.y + Math.sin(tn.a) * tn.d * 0.78;
        r.ring(x, y, tn.R * (1 - easeIn(u)), 2, FOAM, 1 - u, ADD, 0.6);
        r.disc(x, y, tn.R * (1 - easeIn(u)) * 0.7, water(0.1), 0.6 * (1 - u), BLEND, 0.6);
      }
      // airborne droplets
      for (const d of s.drops) {
        const tl = (2 * d.vz) / 320;
        const ee = Math.min(e, tl);
        const rr = fly(3, d.v, 0.6, 0, ee);
        const gx = C.x + Math.cos(d.a) * rr, gy = C.y + Math.sin(d.a) * rr * 0.78;
        if (e < tl) {
          const z = d.vz * e - 160 * e * e;
          r.px(gx, gy - z, FOAM, 1);
        } else if (e - tl < 3) r.decal(gx, gy, [0.04, 0.1, 0.16], 0.5 * (1 - (e - tl) / 3));
      }
      // wet floor
      const wet = 1 - smooth(1.5, 3.5, e);
      if (wet > 0) r.light(C.x, C.y, 120, [0.3, 0.7, 1.2], wet * 0.8);
    }
  },
  post(r, t, s) {
    const C = { x: W / 2 + 26, y: H / 2 + 4 };
    const TS = 4.35, TX = 5.05;
    const tf = Math.min(t, TS);
    const amp = smooth(0.2, 3.5, tf) * (1 - smooth(TS + 0.3, TX, t)) * 1.1;
    const R = 140;
    if (amp > 0.02)
      r.warp(C.x - R, C.y - R, C.x + R, C.y + R, (x, y, o) => {
        const dx = x - C.x, dy = (y - C.y) / 0.78, d = Math.hypot(dx, dy) / R;
        if (d > 1 || d < 0.6) return; // only the environment around the maw twists
        const tw = amp * Math.pow(1 - d, 2) * 2.4;
        const a = Math.atan2(dy, dx) + tw, rr = Math.hypot(dx, dy) * (1 - amp * 0.02 * (1 - d));
        o[0] = C.x + Math.cos(a) * rr; o[1] = C.y + Math.sin(a) * rr * 0.78;
      });
    const e = t - TX;
    if (e > 0 && e < 1.2) {
      const rr = e * 240, A = 5 * (1 - e / 1.2);
      r.warp(0, 0, W - 1, H - 1, (x, y, o) => {
        const dx = x - C.x, dy = (y - C.y) / 0.78, d = Math.hypot(dx, dy);
        const k = Math.exp(-Math.pow((d - rr) / 9, 2)) * A;
        if (k < 0.4) return;
        o[0] = x - (dx / d) * k; o[1] = y - (dy / d) * k;
      });
    }
  },
};

export const TIDE = [abyssalBloom, riptideCalligraphy, mirrorfrostBasilica, undertowMaw];
void easeInOut; void SET;
