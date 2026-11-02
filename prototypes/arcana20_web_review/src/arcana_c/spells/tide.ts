// II. TIDE — water, ice and the architecture of pressure.
import { Frame, W, H } from '../engine/frame';
import { TAU, clamp, lerp, inv, easeOut, easeIn, easeInOut, backOut, hash, hash2, hash3, noise3, bayer, angDiff, catmull, type V2 } from '../engine/math';
import { P, ramp, rampD, type RGB } from '../engine/palette';
import { Particles, growTree, drawTree, shock, segIntersect, pip, type Seg } from '../engine/kit';
import { CASTER, FOCUS } from '../engine/floor';
import type { SpellDef } from './types';

const WHITE: RGB = [1, 1, 1];
const FOAM: RGB = [0.86, 0.97, 1];

type Ripple = { x: number; y: number; t: number; r: number };
function drawRipples(f: Frame, rs: Ripple[], t: number) {
  for (const r of rs) {
    const a = t - r.t;
    if (a < 0 || a > 0.6) continue;
    f.ring(r.x, r.y, 1 + a * r.r, (x, y) => { f.I(x, y, 0.5, 0.8, 0.9, 0.5 * (1 - a / 0.6)); }, 0.55);
  }
}

// ===================================================================== 05 ABYSSAL BLOOM
const abyssalBloom: SpellDef = {
  id: 5, name: 'Abyssal Bloom', school: 'TIDE', dur: 8.6, climax: 5.4,
  blurb: 'Translucent membranes fold out of a pool like an ocean inventing a flower — then freeze in perfect symmetry and burst.',
  make(rng, fx) {
    const C = { x: FOCUS.x, y: FOCUS.y }, SY = 0.72;
    const TF = 5.0, TP = 5.6;
    type Pet = { ang: number; L: number; w: number; t0: number; dur: number; twist: number; seed: number };
    const pets: Pet[] = [];
    for (let k = 0; k < 6; k++) pets.push({ ang: (k / 6) * TAU, L: 30, w: 6, t0: 0.9 + k * 0.05, dur: 1.3, twist: 0.9, seed: k });
    for (let k = 0; k < 6; k++) pets.push({ ang: ((k + 0.5) / 6) * TAU, L: 56, w: 14, t0: 1.8 + k * 0.07, dur: 1.7, twist: -0.35, seed: k + 10 });
    for (let k = 0; k < 12; k++) pets.push({ ang: ((k + 0.25) / 12) * TAU, L: 76, w: 3.4, t0: 3.0 + (k % 3) * 0.08, dur: 1.4, twist: 0.25, seed: k + 20 });
    const minis = Array.from({ length: 6 }, (_, k) => ({ a: (k / 6) * TAU, r: 40, t0: 2.6 + k * 0.06 }));
    const bubbles = Array.from({ length: 30 }, () => ({ a: rng.r(0, TAU), r: rng.r(6, 40), w: rng.r(0.6, 1.6) * rng.sign(), ph: rng.r(0, TAU) }));
    const ps = new Particles();
    const rip: Ripple[] = [];
    let erupted = false;
    const mt = (t: number) => Math.min(t, TF);
    const sym = (t: number) => inv(4.3, TF, t);
    const petLen = (p: Pet, t: number) => p.L * easeOut((mt(t) - p.t0) / p.dur, 3) * (1 + 0.06 * Math.sin(mt(t) * 2 + p.seed) * (1 - sym(t)));
    /** coverage + edge proximity for polar point */
    // per-frame lookup tables (petal shape sampled per integer radius)
    let tabT = -1;
    const tabs = pets.map(() => ({ len: 0, ang: new Float32Array(84), hw: new Float32Array(84) }));
    const build = (t: number) => {
      if (tabT === t) return; tabT = t;
      const tp = mt(t), s = 1 - sym(t), fold = inv(2.4, 4.6, tp);
      pets.forEach((p, i) => {
        const T = tabs[i]; T.len = petLen(p, t);
        for (let r = 0; r < 84; r++) {
          T.ang[r] = p.ang + p.twist * fold * (r / p.L) + Math.sin(r * 0.12 - tp * 2.4 + p.seed) * 0.13 * s;
          T.hw[r] = r > T.len || T.len < 1 ? 0 : p.w * Math.pow(Math.sin(Math.PI * Math.min(1, r / T.len)), 0.6) * (1 + 0.16 * Math.sin(r * 0.5 - tp * 5 + p.seed) * s);
        }
      });
    };
    const sample = (r: number, pa: number, t: number) => {
      build(t);
      const ri = Math.min(83, Math.round(r));
      let cov = 0, edge = 99;
      for (const T of tabs) {
        if (T.len < 1 || r > T.len) continue;
        const m = T.hw[ri] - Math.abs(angDiff(T.ang[ri], pa)) * r;
        if (m > 0) { cov++; if (m < edge) edge = m; }
      }
      return { cov, edge };
    };
    return {
      update(dt, t) {
        ps.update(dt);
        if (t > 1.5 && t < TF && rng.chance(0.25)) {
          const p = pets[rng.i(0, pets.length - 1)], len = petLen(p, t);
          if (len > 10) { const a = p.ang; ps.add({ x: C.x + Math.cos(a) * len, y: C.y + Math.sin(a) * len * SY, z: 2, vx: Math.cos(a) * 18, vy: Math.sin(a) * 12, vz: rng.r(20, 50), grav: 160, kind: 'drop', max: 2, onLand: (q) => rip.push({ x: q.x, y: q.y, t: q.life + t, r: 6 }) }); }
        }
        if (!erupted && t >= TP) {
          erupted = true;
          fx.shake(5); fx.flash([0.5, 0.85, 1], 0.5); fx.kick(2);
          const land = (q: { x: number; y: number }) => rip.push({ x: q.x, y: q.y, t: 0, r: rng.r(5, 9) });
          for (let i = 0; i < 700; i++) {
            const r = rng.r(2, 78), a = rng.r(0, TAU);
            if (sample(r, a, TF).cov === 0) continue;
            const sp = rng.r(30, 120);
            ps.add({ x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r * SY, z: 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * SY, vz: rng.r(50, 210), grav: 250, kind: 'drop', size: rng.chance(0.3) ? 2 : 1, max: 3, delay: r / 240, onLand: land });
          }
          for (let i = 0; i < 160; i++) { const a = rng.r(0, TAU), sp = rng.r(5, 40); ps.add({ x: C.x, y: C.y, z: 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * SY, vz: rng.r(220, 430), grav: 300, kind: 'drop', size: rng.chance(0.4) ? 2 : 1, max: 3.5, onLand: land, c: [0.75, 0.95, 1] }); }
          for (let i = 0; i < 70; i++) { const a = rng.r(0, TAU), sp = rng.r(20, 90); ps.add({ x: C.x + Math.cos(a) * 6, y: C.y + Math.sin(a) * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * SY, drag: 2, kind: 'foam', max: rng.r(0.8, 1.6) }); }
        }
        // ripples registered with relative time get stamped
        for (const r of rip) if (r.t === 0) r.t = t;
        if (erupted && t > 6.3 && t < 7.8 && rng.chance(0.6)) {
          const a = rng.r(0, TAU), r = rng.r(50, 90);
          ps.add({ x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r * SY, vx: -Math.sin(a) * 50, vy: Math.cos(a) * 35, home: { x: C.x, y: C.y }, homeK: 2.4, drag: 1.6, kind: 'spore', col: P.water, c: [0.4, 0.8, 0.95], k: 0.9, max: rng.r(1.2, 1.8) });
        }
      },
      render(f, t) {
        const tp = mt(t), frozen = t >= TF && t < TP;
        // the pool
        const pr = 15 * easeOut(inv(0, 0.9, t)) * (1 - 0.4 * inv(7.6, 8.6, t));
        f.disc(C.x, C.y, pr + 26, (x, y, dd) => {
          const d = dd * (pr + 26);
          if (d > pr) { const k = Math.sin(d * 0.9 - tp * 4) * (1 - (d - pr) / 26); f.D(x, y, 0, k * 1.2); f.S(x, y, 1 - Math.max(0, k) * 0.15); return; }
          const wv = Math.sin(d * 1.1 - tp * 5 + Math.sin(x * 0.3) * 0.5);
          const c = rampD(P.water, 0.3 + 0.12 * wv + (1 - d / pr) * 0.1, bayer(x, y));
          f.Ic(x, y, c, 0.72);
          if (wv > 0.85) f.Lc(x, y, FOAM, 0.25);
          if (d > pr - 1.2) f.Lc(x, y, FOAM, 0.35);
        }, SY);
        // bloom membranes
        const pulseR = t >= TP ? (t - TP) * 240 : -1;
        if (t < TP + 0.5) {
          f.field(C.x - 82, C.y - 82 * SY, C.x + 82, C.y + 82 * SY, (x, y) => {
            const dx = x + 0.5 - C.x, dy = (y + 0.5 - C.y) / SY;
            const r = Math.hypot(dx, dy);
            if (r > 80) return;
            if (pulseR >= 0 && r < pulseR) return;
            const pa = Math.atan2(dy, dx);
            const { cov, edge } = sample(r, pa, t);
            if (!cov) return;
            const th = bayer(x, y);
            const n = noise3(r * 0.11 - tp * 1.3, pa * 2.6, 1 + tp * 0.25);
            let c = rampD(P.water, 0.3 + cov * 0.11 + (1 - r / 80) * 0.12, th);
            let a = 0.32 + 0.12 * cov;
            if (n > 0.63) { c = ramp(P.deep, 0.6); a = 0.55; }
            f.Ic(x, y, c, a);
            f.D(x, y, Math.cos(pa) * cov * 0.8, Math.sin(pa) * cov * 0.8);
            if (edge < 1.15) { f.Ic(x, y, FOAM, 0.7); f.Lc(x, y, FOAM, frozen ? 0.6 : 0.3); }
            else if (hash3(x, y, Math.floor(tp * 8)) > 0.987) f.Lc(x, y, WHITE, 0.6);
            if (frozen) { const g = ((x + y * 0.6 - (t - TF) * 420) % 60 + 60) % 60; if (g < 2) f.Lc(x, y, WHITE, 0.5); }
            if (pulseR >= 0 && r - pulseR < 4) f.Lc(x, y, WHITE, 1.2);
          });
          // mini blooms between sheets
          for (const m of minis) {
            const g = easeOut((tp - m.t0) / 0.9);
            if (g <= 0) continue;
            const mx = C.x + Math.cos(m.a) * m.r, my = C.y + Math.sin(m.a) * m.r * SY;
            if (pulseR >= 0 && m.r < pulseR) continue;
            for (let k = 0; k < 5; k++) {
              const a = (k / 5) * TAU + tp * 0.8;
              f.ribbon([{ x: mx, y: my }, { x: mx + Math.cos(a) * 8 * g, y: my + Math.sin(a) * 6 * g }], [0.5, 2.4 * g], (x, y, _s, e) => {
                f.Ic(x, y, ramp(P.water, 0.62), 0.55);
                if (Math.abs(e) > 0.6) f.Lc(x, y, FOAM, 0.35);
              });
            }
            f.Lc(mx, my, WHITE, 0.8 * g);
          }
          // bubbles circling inside
          for (const b of bubbles) {
            const a = b.a + tp * b.w, r = b.r + Math.sin(tp * 2 + b.ph) * 3;
            const g = inv(1.5, 2.5, tp);
            if (g <= 0 || (pulseR >= 0 && r < pulseR)) continue;
            const bx = C.x + Math.cos(a) * r, by = C.y + Math.sin(a) * r * SY - ((tp * 6 + b.ph * 3) % 8);
            f.Lc(bx - 1, by, FOAM, 0.35 * g); f.Lc(bx + 1, by, FOAM, 0.35 * g); f.Lc(bx, by - 1, FOAM, 0.35 * g); f.Lc(bx, by + 1, FOAM, 0.2 * g);
            f.Lc(bx - 1, by - 1, WHITE, 0.4 * g);
          }
          f.glow(C.x, C.y, 70, ramp(P.water, 0.6), 0.12 * inv(1, 4, t), 4, SY);
        }
        if (t >= TP) {
          const a = t - TP;
          if (a < 0.6) { shock(f, C.x, C.y, a * 240, 14, 9 * (1 - a / 0.6), SY, 1.5); f.ringL(C.x, C.y, a * 240, FOAM, 1 - a / 0.6, SY); }
          if (a < 1.2) {
            // the roaring column
            const hcol = 70 * Math.sin(Math.min(1, a / 1.2) * Math.PI);
            f.ribbon([{ x: C.x, y: C.y }, { x: C.x, y: C.y - hcol }], [9 * (1 - a), 3], (x, y, s, e) => {
              const n = noise3(x * 0.3, y * 0.2 + t * 12, 2);
              f.Ic(x, y, rampD(P.water, 0.45 + n * 0.4 + s * 0.2, bayer(x, y)), 0.75);
              if (Math.abs(e) > 0.7 || n > 0.7) f.Lc(x, y, FOAM, 0.5);
            });
          }
        }
        drawRipples(f, rip, t);
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 06 RIPTIDE CALLIGRAPHY
const riptideCalligraphy: SpellDef = {
  id: 6, name: 'Riptide Calligraphy', school: 'TIDE', dur: 8.8, climax: 6.15,
  blurb: 'An invisible master paints the arena with living water; the finished script turns into a procession of cutting waves.',
  make(rng, fx) {
    const defs: { pts: V2[]; t0: number; dur: number }[] = [
      { pts: [{ x: 124, y: 112 }, { x: 160, y: 72 }, { x: 225, y: 52 }, { x: 290, y: 66 }, { x: 318, y: 96 }], t0: 0.3, dur: 0.95 },
      { pts: [{ x: 148, y: 168 }, { x: 222, y: 158 }, { x: 282, y: 136 }, { x: 286, y: 104 }, { x: 262, y: 100 }, { x: 258, y: 116 }], t0: 1.45, dur: 0.75 },
      { pts: [{ x: 178, y: 84 }, { x: 206, y: 128 }, { x: 244, y: 128 }, { x: 238, y: 92 }, { x: 206, y: 104 }, { x: 236, y: 166 }, { x: 304, y: 178 }], t0: 2.35, dur: 1.15 },
      { pts: [{ x: 336, y: 40 }, { x: 260, y: 112 }, { x: 186, y: 190 }], t0: 3.75, dur: 0.24 },
      { pts: [{ x: 296, y: 128 }, { x: 302, y: 122 }, { x: 314, y: 132 }, { x: 344, y: 140 }], t0: 4.25, dur: 0.38 },
    ];
    const TE = 4.95, TWV = 5.75;
    const strokes = defs.map((d, i) => ({ ...d, path: catmull(d.pts, 30), head: { x: d.pts[0].x, y: d.pts[0].y, vx: 0, vy: 0 }, rec: [] as { x: number; y: number; w: number }[], done: false, sign: 1, tw: TWV + i * 0.32, i }));
    const crossings: { x: number; y: number; t: number }[] = [];
    const ps = new Particles();
    const rip: Ripple[] = [];
    const normals = (pts: V2[]) => pts.map((_, i) => {
      const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)];
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      return { x: -dy / l, y: dx / l };
    });
    return {
      update(dt, t) {
        ps.update(dt);
        for (const s of strokes) {
          if (t < s.t0 || s.done) continue;
          const u = clamp((t - s.t0) / s.dur);
          const tg = s.path[Math.min(s.path.length - 1, Math.floor(easeInOut(u) * (s.path.length - 1)))];
          const h = s.head;
          if (s.rec.length === 0) { h.x = tg.x; h.y = tg.y; }
          const K = s.dur < 0.3 ? 2600 : 950, D = s.dur < 0.3 ? 70 : 38;
          h.vx += ((tg.x - h.x) * K - h.vx * D) * dt; h.vy += ((tg.y - h.y) * K - h.vy * D) * dt;
          h.x += h.vx * dt; h.y += h.vy * dt;
          const sp = Math.hypot(h.vx, h.vy);
          const env = Math.min(1, u * 3.2 + 0.08, (1 - u) * 5 + 0.25);
          s.rec.push({ x: h.x, y: h.y, w: clamp(5.8 - sp * 0.011, 1.3, 5.8) * env });
          const n = s.rec.length;
          if (n > 3) {
            const a = s.rec[n - 3], b = s.rec[n - 2], c = s.rec[n - 1];
            const turn = Math.abs(angDiff(Math.atan2(b.y - a.y, b.x - a.x), Math.atan2(c.y - b.y, c.x - b.x)));
            if (turn > 0.12 && sp > 90) for (let k = 0; k < 3; k++) ps.add({ x: c.x, y: c.y, z: 2, vx: h.vx * 0.4 + rng.r(-30, 30), vy: h.vy * 0.4 + rng.r(-30, 30), vz: rng.r(30, 90), grav: 260, kind: 'drop', max: 2, onLand: (q) => rip.push({ x: q.x, y: q.y, t: -1, r: 5 }) });
          }
          if (u >= 1 && sp < 20) {
            s.done = true;
            const cx = s.rec.reduce((a, p) => a + p.x, 0) / s.rec.length, cy = s.rec.reduce((a, p) => a + p.y, 0) / s.rec.length;
            const nn = normals(s.rec);
            let dot = 0; s.rec.forEach((p, i) => (dot += nn[i].x * (p.x - CASTER.x) + nn[i].y * (p.y - CASTER.y)));
            s.sign = dot >= 0 ? 1 : -1; void cx; void cy;
            for (const o of strokes) {
              if (o === s || !o.done) continue;
              for (let i = 0; i < s.rec.length - 3; i += 3) for (let j = 0; j < o.rec.length - 3; j += 3) {
                const p = segIntersect(s.rec[i], s.rec[i + 3], o.rec[j], o.rec[j + 3]);
                if (p && !crossings.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 8)) crossings.push({ ...p, t });
              }
            }
          }
        }
        for (const r of rip) if (r.t === -1) r.t = t;
        if (t > TWV) for (const s of strokes) {
          const q = (t - s.tw) / 1.6;
          if (q < 0 || q > 1 || !s.rec.length) continue;
          const nn = normals(s.rec);
          for (let k = 0; k < 3; k++) {
            const i = rng.i(0, s.rec.length - 1), D = easeIn(q, 2) * 230 * s.sign;
            ps.add({ x: s.rec[i].x + nn[i].x * D, y: s.rec[i].y + nn[i].y * D, vx: nn[i].x * s.sign * rng.r(10, 40), vy: nn[i].y * s.sign * rng.r(10, 40), drag: 2, kind: 'foam', max: rng.r(0.5, 1.2) });
          }
          if (Math.abs(q - 0.05) < 0.011) fx.shake(3);
        }
      },
      render(f, t) {
        for (const s of strokes) {
          if (s.rec.length < 2) continue;
          const q = clamp((t - s.tw) / 1.6);
          const nn = normals(s.rec);
          // fading threads left behind
          if (t > s.tw) {
            const g = 1 - inv(s.tw, s.tw + 2.2, t);
            for (let i = 0; i < s.rec.length; i += 2) if (g > bayer(Math.round(s.rec[i].x), Math.round(s.rec[i].y))) f.Lc(s.rec[i].x, s.rec[i].y, ramp(P.water, 0.7), 0.35 * g);
          }
          if (q >= 1) continue;
          const D = easeIn(q, 2) * 230 * s.sign;
          const nrec = s.rec.length;
          const pts = s.rec.map((p, i) => { const bow = 0.55 + 0.45 * Math.sin(Math.PI * i / Math.max(1, nrec - 1)); return { x: p.x + nn[i].x * D * bow, y: p.y + nn[i].y * D * bow }; });
          const ws = s.rec.map((p, i) => (q > 0 ? 1.5 + 5 * Math.sin(Math.PI * Math.min(1, q * 1.4)) * Math.sin(Math.PI * i / Math.max(1, nrec - 1)) : p.w));
          const fade = 1 - q;
          const ts = Math.floor(t * 12) / 12;
          const len = s.rec.length;
          const pulse = (t - TE - s.i * 0.1) / 0.5;
          f.ribbon(pts, ws, (x, y, sp, e) => {
            const flow = noise3(sp * len * 0.09 - ts * 5, e * 1.6, s.i * 3.3);
            const crest = e * s.sign;
            let c = rampD(P.water, 0.38 + flow * 0.32, bayer(x, y));
            if (q > 0 && crest > 0.35) c = flow > 0.35 ? FOAM : ramp(P.water, 0.8);
            const back = q > 0 ? clamp((crest + 1) / 1.4) : 1;
            if (q > 0 && back < bayer(x, y) * 0.9) return;
            f.Ic(x, y, c, (0.62 + (q > 0 ? 0.25 : 0)) * (q > 0 ? fade : 1));
            if (Math.abs(e) > 0.7 && flow > 0.42) { f.Ic(x, y, FOAM, 0.85 * (q > 0 ? fade : 1)); f.Lc(x, y, FOAM, 0.15); }
            if (e > -0.55 && e < -0.2) f.Lc(x, y, ramp(P.water, 0.9), 0.18);
            if (q === 0) f.D(x, y, e * 1.6, 0);
            else f.D(x, y, (pts[0].x - x) * 0 + nnSign(s.sign) * 2.5 * fade, 0);
            if (pulse > 0 && pulse < 1.2 && Math.abs(sp - pulse) < 0.05) f.Lc(x, y, WHITE, 1.4);
          });
          if (!s.done && t > s.t0) { const h = s.head; f.glow(h.x, h.y, 9, FOAM, 0.6, 3); f.Lc(h.x, h.y, WHITE, 1.5); }
        }
        // braided knots where currents meet
        for (const c of crossings) {
          const a = t - c.t;
          const g = Math.min(1, a / 0.6) * (1 - inv(TWV, TWV + 0.6, t));
          if (g <= 0) continue;
          const pr = 1 + 0.25 * Math.sin(t * 9);
          for (let k = 0; k < 3; k++) for (let j = 0; j < 16; j++) {
            const r = (1 + j * 0.62) * g * pr, an = (k * TAU) / 3 + j * 0.42 + t * 5.5;
            f.Lc(c.x + Math.cos(an) * r, c.y + Math.sin(an) * r * 0.8, j % 3 ? ramp(P.water, 0.8) : WHITE, 0.9 * (1 - j / 16) * g);
          }
          f.ring(c.x, c.y, 6 + Math.sin(t * 7) * 1.5, (x, y, an) => { if (Math.sin(an * 5 + t * 6) > 0.2) f.Ic(x, y, FOAM, 0.8 * g); }, 0.8);
          f.D(c.x, c.y, 0, 0);
          f.glow(c.x, c.y, 10, ramp(P.water, 0.7), 0.3 * g, 3);
        }
        drawRipples(f, rip, t);
        ps.render(f);
      },
    };
  },
};
const nnSign = (s: number) => s;

// ===================================================================== 07 MIRRORFROST BASILICA
const mirrorfrost: SpellDef = {
  id: 7, name: 'Mirrorfrost Basilica', school: 'TIDE', dur: 9.2, climax: 6.62,
  blurb: 'Frost grows a cathedral of faceted roofs and spectral spires — until one point breaks and the whole architecture fails in sequence.',
  make(rng, fx) {
    const Q = { x: 244, y: 112 }, SY = 0.72, LA = -2.3, TB = 6.4;
    const P2 = (r: number, a: number, h = 0) => ({ x: Q.x + Math.cos(a) * r * 1.08, y: Q.y + Math.sin(a) * r * SY - h });
    type Fct = { pts: V2[]; shade: number; birth: number; cx: number; cy: number; seed: number; hole?: V2[]; tb: number; broke: boolean; spire?: { base: V2; tip: V2 } };
    const fcts: Fct[] = [];
    const sec = Array.from({ length: 6 }, () => rng.r(0, 0.35));
    const add = (pts: V2[], shade: number, birth: number, extra: Partial<Fct> = {}) => {
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      fcts.push({ pts, shade: clamp(shade), birth, cx, cy, seed: fcts.length * 7 + 3, tb: 0, broke: false, ...extra });
    };
    const sh = (a: number) => 0.5 + 0.42 * Math.cos(a - LA);
    // central dome
    const apex = P2(0, 0, 9);
    for (let k = 0; k < 12; k++) { const a0 = (k / 12) * TAU, a1 = ((k + 1) / 12) * TAU; add([apex, P2(17, a0), P2(17, a1)], sh((a0 + a1) / 2), 1.3 + k * 0.05 + rng.r(0, 0.05)); }
    // vaults with arches in negative space
    for (let k = 0; k < 6; k++) {
      const a = ((k + 0.5) / 6) * TAU, b = 2.0 + k * 0.12 + sec[k];
      const in1 = P2(19, a - 0.22), in2 = P2(19, a + 0.22), s1 = P2(33, a - 0.3), s2 = P2(33, a + 0.3), tip = P2(48, a), ridge = P2(30, a, 6);
      add([in1, ridge, tip, s1], sh(a - 0.5), b, { hole: [P2(24, a - 0.13), P2(29, a - 0.04, 3), P2(29, a - 0.17)] });
      add([in2, s2, tip, ridge], sh(a + 0.5), b + 0.06, { hole: [P2(24, a + 0.13), P2(29, a + 0.17), P2(29, a + 0.04, 3)] });
    }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; add([P2(24, a), P2(38, a - 0.13), P2(41, a, 4), P2(38, a + 0.13)], sh(a), 2.8 + k * 0.05 + sec[k] * 0.5); }
    // spires
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU + 0.12, h = rng.r(12, 22), r1 = rng.r(64, 76), b = 3.2 + k * 0.07 + sec[k % 6] * 0.6;
      const bl = P2(48, a - 0.07), br = P2(48, a + 0.07), m = P2(51, a, 3), tip = P2(r1, a, h);
      add([bl, m, tip], sh(a - 0.6), b, { spire: { base: P2(50, a), tip: P2(r1, a) } });
      add([m, br, tip], sh(a + 0.6), b + 0.04);
    }
    for (let k = 0; k < 20; k++) { const a = (k / 20) * TAU + 0.05, c = P2(84 + (k % 2) * 4, a); add(Array.from({ length: 6 }, (_, i) => ({ x: c.x + Math.cos(i * TAU / 6) * 3, y: c.y + Math.sin(i * TAU / 6) * 2.4 })), sh(a + 1), 3.7 + rng.r(0, 0.6)); }
    const frost: Seg[] = [];
    for (let k = 0; k < 6; k++) frost.push(...growTree(rng, { x: Q.x, y: Q.y, ang: (k / 6) * TAU + 0.26, step: 3.6, steps: 18, speed: 48 + rng.r(0, 18), branch: 0.42, spread: Math.PI / 3, jitter: 0.2, maxDepth: 2, sy: SY, snap: Math.PI / 6 }));
    const Bp = fcts.find((f) => f.spire)!.spire!.tip;
    const bpt = fcts.filter((f) => f.spire)[3].spire!.tip;
    for (const fc of fcts) fc.tb = TB + Math.hypot(fc.cx - bpt.x, fc.cy - bpt.y) / 165 + hash(fc.seed) * 0.05;
    void Bp;
    type Shard = { pts: V2[]; x: number; y: number; z: number; vx: number; vy: number; vz: number; rot: number; spin: number; shade: number; life: number; max: number };
    const shards: Shard[] = [];
    const ps = new Particles();
    let broke = false;
    const pulse = (x: number, y: number, t: number) => {
      let v = 0;
      for (const p0 of [4.4, 4.95, 5.5]) { const r = (t - p0) * 150; if (r < 0 || r > 120) continue; const d = Math.hypot(x - Q.x, (y - Q.y) / SY) - r; v += Math.exp(-(d * d) / 40) * (1 - r / 120); }
      return v;
    };
    return {
      update(dt, t) {
        ps.update(dt);
        if (!broke && t >= TB) { broke = true; fx.shake(3); fx.kick(2); fx.flash([0.7, 0.9, 1], 0.3); }
        for (const fc of fcts) if (!fc.broke && t >= fc.tb) {
          fc.broke = true;
          const n = fc.pts.length;
          const dx = fc.cx - bpt.x, dy = fc.cy - bpt.y, l = Math.hypot(dx, dy) || 1;
          for (let i = 0; i < n; i++) {
            const a = fc.pts[i], b = fc.pts[(i + 1) % n];
            const cx = (a.x + b.x + fc.cx) / 3, cy = (a.y + b.y + fc.cy) / 3;
            const sp = rng.r(25, 95), out = { x: cx - Q.x, y: cy - Q.y }, ol = Math.hypot(out.x, out.y) || 1;
            shards.push({
              pts: [a, b, { x: fc.cx, y: fc.cy }].map((p) => ({ x: p.x - cx, y: p.y - cy })), x: cx, y: cy + (fc.spire ? 0 : 0), z: 0,
              vx: (dx / l) * sp * 0.6 + (out.x / ol) * sp * 0.6, vy: (dy / l) * sp * 0.5 + (out.y / ol) * sp * 0.5, vz: rng.r(20, 100), rot: 0, spin: rng.r(-7, 7), shade: fc.shade, life: 0, max: rng.r(1.4, 2.4),
            });
          }
          for (let k = 0; k < 4; k++) ps.add({ x: fc.cx, y: fc.cy, vx: rng.r(-60, 60), vy: rng.r(-50, 30), drag: 2.5, kind: 'star', col: P.ice, max: rng.r(0.5, 1.3), k: 1 });
          if (rng.chance(0.15)) fx.shake(2);
        }
        for (let i = shards.length - 1; i >= 0; i--) {
          const s = shards[i];
          s.life += dt;
          if (s.life > s.max) { shards.splice(i, 1); continue; }
          s.vz -= 230 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.rot += s.spin * dt;
          if (s.z < 0) { s.z = 0; s.vz = -s.vz * 0.25; s.vx *= 0.5; s.vy *= 0.5; s.spin *= 0.5; }
        }
      },
      render(f, t) {
        const dis = 1 - inv(6.7, 7.9, t);
        // frost lattice on the floor
        drawTree(f, frost, t, (x, y, s) => {
          if (dis < bayer(x, y)) return;
          f.Gc(x, y, [0.55, 0.75, 0.9], 0.35);
          f.Lc(x, y, ramp(P.ice, 0.75 - s.depth * 0.15), 0.32 * (1 - s.depth * 0.25));
        });
        for (const s of frost) if (t > s.t1 && hash(Math.round(s.x1 * 7 + s.y1)) > 0.8 && dis > 0.4) {
          f.Lc(s.x1, s.y1, WHITE, 0.6); f.Lc(s.x1 + 1, s.y1, ramp(P.ice, 0.7), 0.3); f.Lc(s.x1 - 1, s.y1, ramp(P.ice, 0.7), 0.3); f.Lc(s.x1, s.y1 - 1, ramp(P.ice, 0.7), 0.3); f.Lc(s.x1, s.y1 + 1, ramp(P.ice, 0.7), 0.3);
        }
        f.glow(Q.x, Q.y, 100, ramp(P.ice, 0.55), 0.1 * inv(0.5, 4, t) * dis, 4, SY);
        // shadows and spectral reflections of spires
        for (const fc of fcts) {
          if (!fc.spire || fc.broke || t < fc.birth) continue;
          const g = clamp((t - fc.birth) / 0.4);
          const b = fc.spire.base, tp = fc.spire.tip;
          const ex = tp.x + (tp.x - b.x) * 0.4 + 10, ey = tp.y + (tp.y - b.y) * 0.4 + 14;
          f.poly([{ x: b.x - 2, y: b.y }, { x: b.x + 2, y: b.y }, { x: lerp(b.x, ex, g), y: lerp(b.y, ey, g) }], (x, y) => f.S(x, y, 0.62));
          f.line(b.x, b.y + 2, b.x + (tp.x - b.x) * 0.3 * g + 6, b.y + 26 * g, (x, y, s) => { if ((1 - s) * 0.8 > bayer(x, y)) f.Lc(x, y, ramp(P.ice, 0.8), 0.25); });
        }
        // facets (sorted back to front)
        const order = fcts.filter((fc) => t >= fc.birth - 0.3 && !fc.broke).sort((a, b) => a.cy - b.cy);
        const crackL = inv(4.9, TB, t);
        for (const fc of order) {
          if (t < fc.birth) {
            const q = 1 - (fc.birth - t) / 0.3;
            const x = lerp(Q.x, fc.cx, q), y = lerp(Q.y, fc.cy, q);
            f.lineL(lerp(Q.x, fc.cx, q * 0.7), lerp(Q.y, fc.cy, q * 0.7), x, y, ramp(P.ice, 0.9), 0.8);
            continue;
          }
          const sc = backOut(clamp((t - fc.birth) / 0.32), 2.2);
          const pts = fc.pts.map((p) => ({ x: fc.cx + (p.x - fc.cx) * sc, y: fc.cy + (p.y - fc.cy) * sc }));
          const flash = Math.max(0, 1 - (t - fc.birth) / 0.25);
          const warn = t > fc.tb - 0.25 ? 1 : 0;
          f.poly(pts, (x, y) => {
            if (fc.hole && sc > 0.95 && pip(fc.hole, x + 0.5, y + 0.5)) { f.S(x, y, 0.55); return; }
            const pv = pulse(x, y, t);
            const sheen = ((x * 2 + y * 3 + fc.seed) % 13 === 0) ? 0.18 : 0;
            const c = rampD(P.ice, fc.shade * 0.72 + 0.1 + sheen + pv * 0.35 + flash * 0.4, bayer(x, y));
            f.Ic(x, y, c, 0.88);
            if (pv > 0.1) f.Lc(x, y, ramp(P.ice, 0.85), pv * 0.6);
          });
          f.polyOutlineL(pts, ramp(P.ice, 0.95), 0.32 + flash + warn * 0.6);
          if (fc.hole && sc > 0.95) f.polyOutlineL(fc.hole, ramp(P.ice, 0.9), 0.5);
          const nc = Math.floor(crackL * (2 + 4 * hash(fc.seed)));
          for (let k = 0; k < nc; k++) {
            const n = pts.length, e1 = Math.floor(hash(fc.seed + k * 3) * n), e2 = (e1 + 1 + Math.floor(hash(fc.seed + k * 5) * (n - 1))) % n;
            const u1 = hash(fc.seed + k * 7), u2 = hash(fc.seed + k * 11);
            const a = { x: lerp(pts[e1].x, pts[(e1 + 1) % n].x, u1), y: lerp(pts[e1].y, pts[(e1 + 1) % n].y, u1) };
            const b = { x: lerp(pts[e2].x, pts[(e2 + 1) % n].x, u2), y: lerp(pts[e2].y, pts[(e2 + 1) % n].y, u2) };
            f.lineL(a.x, a.y, b.x, b.y, WHITE, 0.35 + warn * 0.8 + 0.2 * Math.sin(t * 30 + k));
          }
        }
        // fracture front
        if (t >= TB) {
          const r = (t - TB) * 165;
          if (r < 220) { f.ringL(bpt.x, bpt.y, r, WHITE, 0.8, 0.8); shock(f, bpt.x, bpt.y, r, 8, 4, 0.8, 1.5); }
          if (t - TB < 0.15) f.glow(bpt.x, bpt.y, 14, WHITE, 2, 3);
        }
        for (const s of shards) {
          const u = s.life / s.max;
          const sq = Math.cos(s.rot * 0.7);
          const pts = s.pts.map((p) => { const c = Math.cos(s.rot), si = Math.sin(s.rot); return { x: s.x + (p.x * c - p.y * si), y: s.y - s.z + (p.x * si + p.y * c) * sq }; });
          if (s.z > 1) f.S(s.x, s.y, 0.6);
          const gl = Math.max(0, Math.sin(s.rot * 2.3));
          f.poly(pts, (x, y) => f.Id(x, y, rampD(P.ice, s.shade * 0.6 + 0.2 + gl * 0.4, bayer(x, y)), 1 - u * u));
          if (gl > 0.8) f.Lc(pts[0].x, pts[0].y, WHITE, 1.2 * (1 - u));
        }
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 08 UNDERTOW MAW
const undertowMaw: SpellDef = {
  id: 8, name: 'Undertow Maw', school: 'TIDE', dur: 8.6, climax: 6.3,
  blurb: 'A whirlpool deeper than the screen: currents descend an endless shaft, stop dead, compress to a point — and the ocean comes back.',
  make(rng, fx) {
    const V = { x: 250, y: 114 }, SY = 0.7;
    const TS = 5.4, TC0 = 5.65, TC1 = 5.92, TU = 6.15;
    const ft = (t: number) => Math.min(t, TS);
    const Rv = (t: number) => 60 * easeOut(inv(1.1, 3.0, t)) * (t < TC0 ? 1 : 1 - easeIn(inv(TC0, TC1, t), 2));
    type Dp = { r: number; a: number; pr: number; pa: number };
    const drops: Dp[] = [];
    const sheets = Array.from({ length: 7 }, (_, k) => ({ a: (k / 7) * TAU + rng.r(-0.2, 0.2), span: rng.r(0.6, 1.0), sp: rng.r(170, 250), curl: rng.r(0.003, 0.008) * rng.sign() }));
    const ps = new Particles();
    let surged = false;
    return {
      update(dt, t) {
        ps.update(dt);
        const R = Rv(t);
        if (t < TS) {
          if (R > 10 && rng.chance(0.8)) drops.push({ r: R * rng.r(1.0, 1.2), a: rng.r(0, TAU), pr: 0, pa: 0 });
          for (let i = drops.length - 1; i >= 0; i--) {
            const d = drops[i];
            d.pr = d.r; d.pa = d.a;
            d.r -= (14 + 420 / (d.r + 6)) * dt; d.a += (70 / (d.r + 5)) * dt;
            if (d.r < R * 0.15 || R < 4) drops.splice(i, 1);
          }
        } else if (t > TC0) drops.length = 0;
        if (!surged && t >= TU) {
          surged = true;
          fx.shake(9); fx.flash([0.6, 0.9, 1], 0.6); fx.kick(3.5);
          for (let i = 0; i < 360; i++) { const a = rng.r(0, TAU), sp = rng.r(40, 240); ps.add({ x: V.x, y: V.y, z: 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * SY, vz: rng.r(40, 260), grav: 260, drag: 0.4, kind: 'drop', size: rng.chance(0.3) ? 2 : 1, max: 3 }); }
          for (let i = 0; i < 120; i++) { const a = rng.r(0, TAU), sp = rng.r(60, 200); ps.add({ x: V.x + Math.cos(a) * 10, y: V.y + Math.sin(a) * 7, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * SY, drag: 2.2, kind: 'foam', max: rng.r(0.8, 1.8) }); }
        }
      },
      render(f, t) {
        const tf = ft(t), R = Rv(t);
        const arm = inv(3.4, 5.2, tf);
        // the floor begins to move before water appears
        const pre = inv(0, 1.2, t) * (1 - inv(TU, TU + 0.5, t));
        f.disc(V.x, V.y, 95, (x, y, d) => {
          const k = pre * (1 - d);
          f.D(x, y, Math.sin(y * 0.11 + tf * 1.7 + Math.sin(x * 0.07)) * 2 * k, Math.sin(x * 0.09 - tf * 1.3 + Math.sin(y * 0.08)) * 2 * k);
          const rr = d * 95;
          f.S(x, y, 1 - 0.18 * k * Math.max(0, Math.sin(rr * 0.35 - tf * 4)));
        }, SY);
        if (t < 2.2) for (let s = 0; s < 6; s++) for (let j = 0; j < 30; j++) {
          const p = ((tf * 0.35 + j / 30 + s * 0.13) % 1);
          const r = 90 * (1 - p), a = s * 1.05 + p * 4;
          f.Lc(V.x + Math.cos(a) * r, V.y + Math.sin(a) * r * SY, ramp(P.water, 0.6), 0.35 * pre * (1 - inv(1.6, 2.2, t)) * Math.sin(Math.PI * p));
        }
        if (R > 0.5) {
          const ext = R * 1.75;
          f.field(V.x - ext, V.y - ext * SY, V.x + ext, V.y + ext * SY, (x, y) => {
            const dx = x + 0.5 - V.x, dy = (y + 0.5 - V.y) / SY;
            const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
            const Ra = R * (1 + arm * 0.2 * Math.sin(3 * a - tf * 2.2 + r * 0.05) + arm * 0.07 * Math.sin(5 * a + tf * 3));
            const rn = r / Ra;
            if (rn >= 1) {
              if (rn > 1.75) return;
              const k = (1.75 - rn) / 0.75 * Math.min(1, R / 30);
              const amp = 7 * k * k;
              f.D(x, y, -Math.sin(a) * amp - Math.cos(a) * amp * 0.3, (Math.cos(a) * amp - Math.sin(a) * amp * 0.3) * SY);
              f.S(x, y, 1 - 0.25 * k);
              return;
            }
            const th = bayer(x, y);
            if (rn < 0.15) { f.I(x, y, 0, 0.005, 0.02, 1); f.L(x, y, -0.1, -0.1, -0.1); return; }
            const u = Math.log(rn + 0.015);
            const band = ((u * 1.7 + (a / TAU) * 2 + tf * 1.25) % 1 + 1) % 1;
            const om = 2.6 / (rn + 0.12);
            const tone = 0.02 + 0.6 * Math.pow(rn, 1.35) + (band < 0.45 ? 0.13 : -0.04) * (0.4 + rn);
            f.Ic(x, y, rampD(P.water, tone, th), clamp((1 - rn) * 10));
            const cell = hash2(Math.floor(u * 9), Math.floor((((a + tf * om * 0.35) / TAU) * 44 % 44 + 44) % 44));
            if (cell > 0.9 && band > 0.35 && band < 0.55) f.Ic(x, y, FOAM, clamp(rn * 1.4));
            const st = (((a / TAU) * 26 + tf * om * 0.5) % 1 + 1) % 1;
            if (st < 0.05 && noise3(u * 4, a * 2, 1) > 0.55) f.Lc(x, y, ramp(P.water, 0.9), 0.5 * rn);
            if (rn > 0.955) { f.Ic(x, y, FOAM, 0.85); f.Lc(x, y, FOAM, 0.15); } else if (rn > 0.86 && hash2(x, Math.floor(y + tf * 9)) > 0.6) f.Ic(x, y, ramp(P.water, 0.85), 0.7);
          });
          // bright streams pulled across the void
          if (arm > 0.2 && t < TS) for (let k = 0; k < 3; k++) {
            const a0 = tf * 1.7 + k * 2.1;
            for (let j = 0; j <= 30; j++) {
              const q = j / 30, a = a0 + q * 2.6, r = R * (0.95 - Math.sin(q * Math.PI) * 0.75);
              f.Lc(V.x + Math.cos(a) * r, V.y + Math.sin(a) * r * SY, FOAM, 0.6 * arm * Math.sin(q * Math.PI));
            }
          }
          for (const d of drops) {
            const x0 = V.x + Math.cos(d.pa) * d.pr, y0 = V.y + Math.sin(d.pa) * d.pr * SY;
            const x1 = V.x + Math.cos(d.a) * d.r, y1 = V.y + Math.sin(d.a) * d.r * SY;
            f.lineL(x0, y0, x1, y1, FOAM, 0.6);
            f.Ic(x1, y1, WHITE, 0.9);
          }
        }
        if (t >= TC1 && t < TU) {
          // a held breath: the entire mass in one pixel
          f.field(0, 0, W - 1, H - 1, (x, y) => { const dx = V.x - x, dy = V.y - y, l = Math.hypot(dx, dy) || 1; f.D(x, y, (-dx / l) * 2.5, (-dy / l) * 2.5); f.S(x, y, 0.7); });
          f.L(V.x, V.y, 3, 3, 3);
          f.ringL(V.x, V.y, 3, [-0.5, -0.5, -0.4], 1);
        }
        if (t >= TU) {
          const a = t - TU;
          const p = clamp(a / 1.5);
          if (a < 1.5) {
            let mr = 0;
            for (const s of sheets) mr = Math.max(mr, s.sp * 1.3);
            const rmax = 250 * easeOut(p, 2.5) + 12;
            f.field(V.x - rmax, V.y - rmax * SY, V.x + rmax, V.y + rmax * SY, (x, y) => {
              const dx = x + 0.5 - V.x, dy = (y + 0.5 - V.y) / SY;
              const r = Math.hypot(dx, dy);
              const ee = easeOut(p, 2.5);
              if (r < 170 * 1.15 * ee - 11 || r > 255 * 1.15 * ee + 6) return;
              const pa = Math.atan2(dy, dx);
              for (const s of sheets) {
                const rk = s.sp * 1.15 * easeOut(p, 2.5);
                const th = 8 * (1 - p) + 2;
                const dr = r - rk;
                if (dr < -th || dr > th * 0.5) continue;
                if (Math.abs(angDiff(s.a + r * s.curl, pa)) > s.span * (1 - p * 0.4) / 2) continue;
                const crest = dr > -th * 0.35;
                f.Ic(x, y, crest ? FOAM : rampD(P.water, 0.45 + 0.3 * (dr + th) / th, bayer(x, y)), 0.9 * (1 - p));
                if (crest) f.Lc(x, y, FOAM, 0.3 * (1 - p));
                return;
              }
            });
            for (let k = 0; k < 3; k++) { const rr = a * (180 + k * 50); if (rr < 230) { f.ringL(V.x, V.y, rr, FOAM, (1 - a / 1.3) * 0.9, SY); shock(f, V.x, V.y, rr, 12, 8 * (1 - p), SY, k === 0 ? 2 : 0); } }
            for (let k = 0; k < 5; k++) {
              const rr = 22 * (1 - a / 0.6) + k;
              if (rr > 0) f.ring(V.x + Math.cos(k * 1.3) * 26, V.y + Math.sin(k * 1.3) * 18, rr * 0.5, (x, y, an) => { if (Math.sin(an * 3) > 0) f.Ic(x, y, FOAM, 0.8); }, 0.6);
            }
          }
          // wet floor with glints
          const wet = 1 - inv(TU + 0.6, 8.6, t);
          f.disc(V.x, V.y, 120, (x, y, d) => {
            f.S(x, y, 1 - 0.3 * wet * (1 - d));
            if (hash3(x, y, Math.floor(t * 5)) > 0.992) f.Lc(x, y, FOAM, 0.6 * wet);
          }, SY);
          if (a < 0.2) f.glow(V.x, V.y, 30, WHITE, 2 * (1 - a / 0.2), 3, SY);
        }
        ps.render(f);
      },
    };
  },
};

export const TIDE: SpellDef[] = [abyssalBloom, riptideCalligraphy, mirrorfrost, undertowMaw];
void hash; void H;
