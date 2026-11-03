// IV. VERDANT — life as a supernatural force. Growth by internal rules, not emission.
import { Frame, W, H } from '../engine/frame';
import { TAU, clamp, lerp, inv, easeOut, easeIn, easeInOut, backOut, hash, hash2, hash3, noise3, curl, bayer, angDiff, catmull, type V2 } from '../engine/math';
import { P, ramp, rampD, type RGB, type Ramp } from '../engine/palette';
import { Particles, growTree, drawTree, shock, type Seg } from '../engine/kit';
import { CASTER, TARGETS, FOCUS } from '../engine/floor';
import type { SpellDef } from './types';

const GOLD: RGB = [1, 0.85, 0.4];

function flower(f: Frame, x: number, y: number, g: number, rot: number, size = 4, pal: Ramp = P.bloom) {
  if (g <= 0) return;
  for (let k = 0; k < 5; k++) {
    const a = rot + (k / 5) * TAU;
    f.ribbon([{ x, y }, { x: x + Math.cos(a) * size * g, y: y + Math.sin(a) * size * g * 0.8 }], [0.6, 1.7 * g], (px, py, _s, e) => f.Ic(px, py, ramp(pal, Math.abs(e) > 0.6 ? 0.45 : 0.75), 1));
  }
  f.Ic(x, y, ramp(P.gold, 0.8), 1); f.Lc(x, y, GOLD, 0.5 * g);
  f.glow(x, y, size * 2.5, ramp(pal, 0.7), 0.25 * g, 3);
}

// ===================================================================== 13 ROOTWAKE
const rootwake: SpellDef = {
  id: 13, name: 'Rootwake', school: 'VERDANT', dur: 9.4, climax: 6.72,
  blurb: 'Roots explore with a pulse of their own; blossoms feed growth back down the network until it tightens as one creature.',
  make(rng, fx) {
    const O = { x: CASTER.x + 2, y: CASTER.y + 2 };
    type Pt = { x: number; y: number; t: number; w: number; cum: number };
    type Tip = { x: number; y: number; ang: number; bias: number; w: number; base: number; ph: number; depth: number; pts: Pt[]; alive: boolean; cum: number; max: number; t0: number; parent: number; seed: number };
    const tips: Tip[] = [];
    const addTip = (x: number, y: number, ang: number, w: number, depth: number, cum: number, t0: number, parent: number, max: number) => {
      tips.push({ x, y, ang, bias: ang, w, base: depth ? 50 : 74, ph: rng.r(0, TAU), depth, pts: [{ x, y, t: t0, w, cum }], alive: true, cum, max, t0, parent, seed: rng.r(0, 99) });
    };
    const mains = [...TARGETS.map((p) => Math.atan2(p.y - O.y, p.x - O.x)), Math.PI + 0.5, Math.PI - 0.4, -1.9];
    mains.forEach((a, i) => addTip(O.x + Math.cos(a) * 3, O.y + Math.sin(a) * 2, a + rng.r(-0.15, 0.15), 3.2, 0, 0, 0.2 + i * 0.09, -1, i < 4 ? 250 : 100));
    type Fl = { x: number; y: number; t0: number; tip: number; cum: number; rot: number; fed: boolean };
    const fls: Fl[] = [];
    type Arch = { A: V2; B: V2; t0: number; seed: number };
    const arches: Arch[] = [];
    const ps = new Particles();
    const TT = 6.6;
    let snapped = false, archesMade = false;
    const flowerTimes = Array.from({ length: 9 }, (_, k) => 2.3 + k * 0.26 + rng.r(0, 0.1));
    return {
      update(dt, t) {
        ps.update(dt);
        for (let i = 0; i < tips.length; i++) {
          const p = tips[i];
          if (!p.alive || t < p.t0) continue;
          const pulse = Math.pow(Math.max(0, Math.sin(t * 4.3 + p.ph)), 3);
          const sp = p.base * (0.1 + 1.7 * pulse) * (t > TT ? 0 : 1);
          p.ang += ((noise3(p.x * 0.03, p.y * 0.03, p.seed) - 0.5) * 3 + angDiff(p.ang, p.bias) * 0.9) * dt;
          p.x += Math.cos(p.ang) * sp * dt; p.y += Math.sin(p.ang) * sp * dt * 0.8; p.cum += sp * dt;
          const last = p.pts[p.pts.length - 1];
          if (Math.hypot(p.x - last.x, p.y - last.y) > 2) p.pts.push({ x: p.x, y: p.y, t, w: p.w * (1 - 0.6 * (p.cum - p.pts[0].cum) / p.max), cum: p.cum });
          if (p.depth < 3 && tips.length < 80 && rng.chance(dt * 1.3 * pulse / (p.depth + 0.6))) {
            const a = p.ang + rng.sign() * rng.r(0.55, 1.1);
            addTip(p.x, p.y, a, p.w * 0.55, p.depth + 1, p.cum, t, i, 70 / (p.depth + 1));
          }
          if (p.cum - p.pts[0].cum > p.max || p.x < 4 || p.y < 4 || p.x > W - 4 || p.y > H - 4) p.alive = false;
        }
        for (const ft of flowerTimes) if (t >= ft && fls.length < flowerTimes.length && fls.length === flowerTimes.indexOf(ft)) {
          const cand = tips.map((p, i) => ({ p, i })).filter(({ p }) => p.pts.length > 12);
          if (cand.length) { const { p, i } = cand[rng.i(0, cand.length - 1)]; const q = p.pts[rng.i(Math.floor(p.pts.length * 0.5), p.pts.length - 1)]; fls.push({ x: q.x, y: q.y, t0: t, tip: i, cum: q.cum, rot: rng.r(0, TAU), fed: false }); }
        }
        for (const fl of fls) if (!fl.fed && t > fl.t0 + 0.5) {
          fl.fed = true;
          for (let k = 0; k < 2; k++) addTip(fl.x, fl.y, rng.r(0, TAU), 1.4, 2, fl.cum, t, fl.tip, 40);
        }
        if (!archesMade && t >= 3.3) {
          archesMade = true;
          for (let k = 0; k < 4; k++) {
            const p = tips[k], q = tips[(k + 1) % 4];
            const a = p.pts[Math.floor(p.pts.length * 0.4)] || p.pts[0], b = q.pts[Math.floor(q.pts.length * 0.85)] || q.pts[0];
            arches.push({ A: { x: a.x, y: a.y }, B: { x: b.x, y: b.y }, t0: 3.4 + k * 0.25, seed: k });
          }
        }
        if (!snapped && t >= TT) {
          snapped = true; fx.shake(5); fx.kick(1.5);
          for (const fl of fls) for (let k = 0; k < 16; k++) ps.add({ x: fl.x, y: fl.y, z: rng.r(2, 10), vx: rng.r(-30, 50), vy: rng.r(-30, 20), vz: rng.r(10, 50), grav: 14, drag: 0.6, spin: rng.r(-6, 6), kind: 'petal', col: P.bloom, max: rng.r(2.2, 3.4), k: 1 });
          for (let k = 0; k < 60; k++) { const p = tips[rng.i(0, 3)], q = p.pts[rng.i(0, p.pts.length - 1)]; ps.add({ x: q.x, y: q.y, z: 2, vx: rng.r(-20, 20), vy: rng.r(-20, 10), vz: rng.r(20, 70), grav: 30, drag: 0.6, spin: rng.r(-8, 8), kind: 'petal', col: P.leaf, max: rng.r(1.5, 3) }); }
        }
      },
      render(f, t) {
        const wither = inv(7.1, 9.0, t);
        // roots
        tips.forEach((p, i) => {
          if (p.pts.length < 2) return;
          const crys = hash(i * 7) > 0.55;
          let pts = p.pts;
          if (!crys && wither > 0) pts = pts.slice(0, Math.max(2, Math.ceil(pts.length * (1 - wither * 0.95))));
          const ws = pts.map((q) => Math.max(0.5, q.w * clamp((t - q.t) * 1.6 + 0.35)) * (crys ? 1 - wither * 0.6 : 1));
          f.ribbon(pts.map((q) => ({ x: q.x + 1, y: q.y + 1.5 })), ws, (x, y) => f.S(x, y, 0.6));
          f.ribbon(pts, ws, (x, y, s, e) => {
            const cum = lerp(pts[0].cum, pts[pts.length - 1].cum, s);
            if (crys && wither > 0) {
              f.Ic(x, y, rampD(P.leaf, lerp(0.45, 0.85, wither), bayer(x, y)), 1);
              if (hash3(x, y, Math.floor(t * 6)) > 0.9) f.Lc(x, y, ramp(P.leaf, 1), 0.6 * wither);
              return;
            }
            const tone = Math.abs(e) > 0.85 ? 0.05 : e < -0.35 ? 0.85 : e > 0.45 ? 0.3 : 0.58;
            let c = ramp(P.bark, tone);
            if (wither > 0) c = ramp(P.ash, tone * 0.8 + 0.1);
            f.Ic(x, y, c, 1);
            if (Math.abs(e) < 0.35 && ws[0] > 1.2 && wither < 0.6) {
              const ph = ((cum - t * 78) % 52 + 52) % 52;
              f.Lc(x, y, ramp(P.leaf, 0.85), (ph < 6 ? 0.9 : 0.12) * (1 - wither));
            }
          });
        });
        // blossoms send light back down their root
        for (const fl of fls) {
          const g = backOut(clamp((t - fl.t0) / 0.5), 2) * (1 - inv(TT + 0.1, TT + 0.6, t));
          flower(f, fl.x, fl.y, g, fl.rot + t * 0.3, 4.5);
          const q = t - fl.t0 - 0.45;
          if (q > 0 && q < 1.5) {
            const want = fl.cum - q * 130;
            let tp = tips[fl.tip];
            for (let lv = 0; lv < 3 && tp; lv++) {
              const hit = tp.pts.find((p) => Math.abs(p.cum - want) < 2.5);
              if (hit) { f.glow(hit.x, hit.y, 5, ramp(P.leaf, 0.9), 1.2, 2); f.Lc(hit.x, hit.y, [1, 1, 0.9], 1.2); break; }
              tp = tips[tp.parent];
            }
          }
        }
        // towering thorned tendrils, twisting around each other
        for (const a of arches) {
          const rise = easeOut((t - a.t0) / 1.2, 3);
          if (rise <= 0) continue;
          const q = easeIn(inv(TT, TT + 0.22, t), 2);
          const fall = 1 - easeInOut(inv(TT + 0.3, 7.8, t));
          if (fall <= 0) continue;
          const A = { x: lerp(a.A.x, FOCUS.x, q * 0.55), y: lerp(a.A.y, FOCUS.y, q * 0.55) }, B = { x: lerp(a.B.x, FOCUS.x, q * 0.55), y: lerp(a.B.y, FOCUS.y, q * 0.55) };
          const h = (32 + a.seed * 4) * rise * (1 + 0.5 * q) * fall;
          const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
          for (let s = 0; s <= 30; s++) { const u = s / 30; f.S(lerp(A.x, B.x, u), lerp(A.y, B.y, u) + 2, 0.6); }
          for (let k = 0; k < 3; k++) {
            const pts: V2[] = [], dep: number[] = [];
            for (let s = 0; s <= 36; s++) {
              const u = s / 36, ph = u * 11 + (k * TAU) / 3 + t * 1.6;
              const o = Math.sin(ph) * 3.2 * Math.sin(Math.PI * u);
              pts.push({ x: lerp(A.x, B.x, u) + nx * o, y: lerp(A.y, B.y, u) + ny * o - Math.sin(Math.PI * u) * h });
              dep.push(Math.cos(ph));
            }
            f.ribbon(pts, pts.map((_, s) => 1.1 + 1.2 * Math.abs(s / 36 - 0.5)), (x, y, s, e) => {
              const d = dep[Math.round(s * 36)];
              f.Ic(x, y, ramp(P.leaf, (e < -0.3 ? 0.5 : 0.3) * (d > 0 ? 1 : 0.6)), 1);
              const ph = ((s * 60 - t * 50) % 20 + 20) % 20;
              if (Math.abs(e) < 0.4 && ph < 2) f.Lc(x, y, ramp(P.leaf, 0.9), 0.8);
            });
            for (let s = 3; s < 34; s += 4) {
              const p = pts[s], pn = pts[s + 1], tx = pn.x - p.x, ty = pn.y - p.y, tl = Math.hypot(tx, ty) || 1;
              const sd = s % 8 < 4 ? 1 : -1, ux = -ty / tl * sd, uy = tx / tl * sd;
              f.polyI([{ x: p.x - tx / tl, y: p.y - ty / tl }, { x: p.x + tx / tl, y: p.y + ty / tl }, { x: p.x + ux * 3 - tx / tl * 1.5, y: p.y + uy * 3 - ty / tl * 1.5 }], ramp(P.bark, 0.15), 1);
              f.Lc(p.x + ux * 3 - tx / tl * 1.5, p.y + uy * 3 - ty / tl * 1.5, ramp(P.leaf, 0.9), 0.4);
            }
          }
        }
        // coordinated thorn eruption along the main roots
        if (t >= TT) for (let i = 0; i < 6; i++) {
          const p = tips[i];
          for (let j = 2; j < p.pts.length - 1; j += 3) {
            const q = p.pts[j];
            const te = TT + (q.cum - p.pts[0].cum) / 230;
            const a = t - te;
            if (a < 0 || a > 1) continue;
            const hgt = (5 + 4 * hash(i * 100 + j)) * backOut(clamp(a / 0.14), 2.5) * (1 - inv(0.5, 1, a)) * (1 - j / p.pts.length * 0.5);
            const n = p.pts[j + 1], tx = n.x - q.x, ty = n.y - q.y, tl = Math.hypot(tx, ty) || 1;
            const sd = j % 2 ? 1 : -1;
            const tip = { x: q.x - ty / tl * sd * hgt * 0.5, y: q.y + tx / tl * sd * hgt * 0.3 - hgt };
            const tri = [{ x: q.x - tx / tl * 2, y: q.y - ty / tl * 2 }, { x: q.x + tx / tl * 2, y: q.y + ty / tl * 2 }, tip];
            f.polyI(tri, ramp(P.bark, 0.3), 1);
            f.lineL(tri[0].x, tri[0].y, tip.x, tip.y, ramp(P.leaf, 0.8), 0.35);
            f.Lc(tip.x, tip.y, ramp(P.leaf, 1), 0.8);
          }
        }
        if (t >= TT && t < TT + 0.6) shock(f, FOCUS.x, FOCUS.y, (t - TT) * 200, 12, 5, 0.7);
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 14 SPORE NEBULA
const sporeNebula: SpellDef = {
  id: 14, name: 'Spore Nebula', school: 'VERDANT', dur: 9.4, climax: 7.12,
  blurb: 'A pulsing fungus releases spores that court each other in slow currents, found colonies, wire a nervous galaxy, and reproduce.',
  make(rng, fx) {
    const N = { x: 248, y: 112 };
    type Sp = { x: number; y: number; vx: number; vy: number };
    const spores: Sp[] = [];
    type Col = { x: number; y: number; t0: number; type: number; max: number; ph: number; rate: number; ta: number[]; id: number };
    const cols: Col[] = [];
    const bond = new Map<string, number>();
    const pals: Ramp[] = [P.leaf, P.spore, P.gold];
    const ps = new Particles();
    let released = false, waves = false, burst = false;
    const mkCol = (x: number, y: number, t: number) => cols.push({ x, y, t0: t, type: cols.length % 3, max: rng.i(16, 32), ph: rng.r(0, TAU), rate: rng.r(1.5, 3.5), ta: [], id: cols.length });
    const nearest = (c: Col, k: number) => cols.filter((o) => o !== c).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)).slice(0, k);
    return {
      update(dt, t) {
        ps.update(dt);
        if (!released && t >= 1.0) {
          released = true;
          for (let i = 0; i < 16; i++) { const a = rng.r(0, TAU), s = rng.r(22, 42); spores.push({ x: N.x + Math.cos(a) * 3, y: N.y - 4 + Math.sin(a) * 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 }); }
        }
        if (t < 7.0) for (const s of spores) {
          const c = curl(s.x * 0.018, s.y * 0.018, t * 0.12);
          const dx = s.x - N.x, dy = s.y - N.y, d = Math.hypot(dx, dy) || 1;
          s.vx += (c.x * 38 + (dx / d) * 9 - (d > 115 ? dx * 0.08 : 0)) * dt;
          s.vy += (c.y * 28 + (dy / d) * 6 - (Math.abs(dy) > 72 ? dy * 0.1 : 0)) * dt;
          s.vx *= Math.exp(-dt * 0.9); s.vy *= Math.exp(-dt * 0.9);
          s.x += s.vx * dt; s.y += s.vy * dt;
        }
        for (let i = 0; i < spores.length; i++) for (let j = i + 1; j < spores.length; j++) {
          const a = spores[i], b = spores[j], key = i + '-' + j, d = Math.hypot(a.x - b.x, a.y - b.y);
          let v = bond.get(key) ?? 0;
          v = d < 26 ? v + dt : Math.max(0, v - dt * 0.5);
          bond.set(key, v);
          if (v > 0.45 && cols.length < 11 && t < 5.5) {
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            if (!cols.some((c) => Math.hypot(c.x - mx, c.y - my) < 22)) { mkCol(mx, my, t); bond.set(key, -99); }
          }
        }
        if (t > 3.6 && t < 3.62 && cols.length < 8) for (const s of spores) if (cols.length < 8 && !cols.some((c) => Math.hypot(c.x - s.x, c.y - s.y) < 22)) mkCol(s.x, s.y, t);
        for (const c of cols) { const cu = curl(c.x * 0.015 + 9, c.y * 0.015, t * 0.1); if (t < 7) { c.x += cu.x * 5 * dt; c.y += cu.y * 4 * dt; } }
        if (!waves && t >= 5.0 && cols.length) {
          waves = true;
          const dist = new Map<Col, number>([[cols[0], 0]]), q = [cols[0]];
          while (q.length) { const c = q.shift()!; for (const n of nearest(c, 2)) if (!dist.has(n)) { dist.set(n, dist.get(c)! + 1); q.push(n); } }
          for (const c of cols) { const d = dist.get(c) ?? 4; c.ta = [5.0 + d * 0.32, 6.1 + d * 0.26]; }
        }
        if (!burst && t >= 7.0) {
          burst = true; fx.flash([0.5, 1, 0.7], 0.25); fx.shake(2);
          for (const c of cols) for (let i = 0; i < 70; i++) {
            const a = rng.r(0, TAU), layer = i % 3, s = [18, 38, 64][layer] * rng.r(0.7, 1.3);
            ps.add({ x: c.x + Math.cos(a) * 3, y: c.y + Math.sin(a) * 3, vx: Math.cos(a) * s - Math.sin(a) * s * 0.6, vy: (Math.sin(a) * s + Math.cos(a) * s * 0.6) * 0.75, drag: 0.8 + layer * 0.3, kind: 'spore', col: pals[c.type], c: ramp(pals[c.type], 0.85), max: rng.r(1.8, 3.4), k: 1 });
          }
        }
      },
      render(f, t) {
        const dk = inv(1.5, 3, t) * (1 - inv(8.4, 9.4, t));
        f.glow(N.x, N.y, 140, [-1, -0.8, -0.6], 0.14 * dk, 5, 0.75);
        // the fungus
        const wil = inv(7.2, 8.5, t);
        const br = 0.5 + 0.5 * Math.sin(t * 3);
        for (let y = 0; y < 5; y++) f.I(N.x, N.y - y, 0.7, 0.7, 0.6, 1);
        f.I(N.x + 1, N.y - 1, 0.5, 0.5, 0.45, 1);
        for (let dx = -4; dx <= 4; dx++) for (let dy = 0; dy < 3; dy++) {
          if (Math.abs(dx) > 4 - dy * 1.2 + (dy === 0 ? 0 : 0)) continue;
          if (dy === 0 || Math.abs(dx) <= 4 - dy) f.Ic(N.x + dx, N.y - 5 - dy, rampD(P.spore, (0.35 + (dx < 0 ? 0.1 : 0) - wil * 0.3), bayer(dx, dy)), 1);
        }
        f.Lc(N.x - 2, N.y - 6, ramp(P.spore, 0.9), (0.6 + br * 0.6) * (1 - wil)); f.Lc(N.x + 2, N.y - 6, ramp(P.spore, 0.9), (0.6 + br * 0.6) * (1 - wil)); f.Lc(N.x, N.y - 7, ramp(P.spore, 0.9), (0.6 + br * 0.6) * (1 - wil));
        f.glow(N.x, N.y - 5, 12, ramp(P.spore, 0.8), (0.25 + 0.2 * br) * (1 - wil), 3);
        // connections between drifting spores
        if (t < 7) {
          for (let i = 0; i < spores.length; i++) for (let j = i + 1; j < spores.length; j++) {
            const v = bond.get(i + '-' + j) ?? 0;
            if (v <= 0.02) continue;
            const a = spores[i], b = spores[j];
            f.line(a.x, a.y, b.x, b.y, (x, y) => { if ((x + y) % 2 === 0) f.Lc(x, y, ramp(P.spore, 0.8), clamp(v * 1.5) * 0.5); });
          }
          for (const s of spores) { f.Lc(s.x, s.y, ramp(P.spore, 1), 1.1); f.Lc(s.x + 1, s.y, ramp(P.spore, 0.7), 0.3); }
        }
        // filaments: a drifting nervous system
        const actK = (c: Col) => c.ta.reduce((a, ta) => a + Math.exp(-Math.pow((t - ta) * 6, 2)) * 2, 0);
        const dis = inv(7.2, 8.4, t);
        const drawn = new Set<string>();
        for (const c of cols) for (const n of nearest(c, 2)) {
          const key = Math.min(c.id, n.id) + '-' + Math.max(c.id, n.id);
          if (drawn.has(key)) continue; drawn.add(key);
          const age = Math.min(t - c.t0, t - n.t0);
          if (age < 0.3) continue;
          const hh = hash(c.id * 31 + n.id);
          const mx = (c.x + n.x) / 2, my = (c.y + n.y) / 2, dx = n.x - c.x, dy = n.y - c.y, l = Math.hypot(dx, dy) || 1;
          const off = Math.sin(t * 0.8 + hh * 6) * 9;
          const cx = mx - (dy / l) * off, cy = my + (dx / l) * off;
          const flow = (actK(c) + actK(n)) * 0.5;
          for (let j = 0; j <= 28; j++) {
            const q = j / 28;
            if (dis > 0 && hash(j * 13 + c.id * 7 + n.id) < dis) continue;
            const x = lerp(lerp(c.x, cx, q), lerp(cx, n.x, q), q), y = lerp(lerp(c.y, cy, q), lerp(cy, n.y, q), q);
            const pk = Math.abs(((t * 0.45 + hh) % 1) - q) < 0.04;
            if ((j + Math.floor(t * 8)) % 3 === 0 || pk) f.Lc(x, y, pk ? [1, 1, 0.9] : ramp(P.spore, 0.6), (pk ? 1.2 : 0.3 + flow * 0.5) * clamp(age));
          }
        }
        // colonies of glowing cells
        for (const c of cols) {
          const age = t - c.t0;
          const n = Math.min(c.max, Math.floor(age * 13) + 1);
          const pal = pals[c.type];
          const a = actK(c);
          if (a > 0.2) f.ringL(c.x, c.y, 4 + (1 - Math.min(1, a / 2)) * 18, ramp(pal, 0.9), a * 0.4, 0.85);
          f.glow(c.x, c.y, 16, ramp(pal, 0.7), 0.15 + a * 0.35, 3, 0.85);
          for (let k = 0; k < n; k++) {
            const r = 2.4 * Math.sqrt(k + 0.5), an = k * 2.39996 + t * 0.15;
            const b = 1 + 0.14 * Math.sin(t * c.rate + c.ph + k * 0.35);
            const x = c.x + Math.cos(an) * r * b, y = c.y + Math.sin(an) * r * b * 0.85;
            const tp = 7.2 + hash(k * 17 + c.id) * 1.3;
            if (t > tp) {
              const q = t - tp;
              if (q < 0.35) f.ring(x, y, 1.5 + q * 9, (px, py) => f.Lc(px, py, ramp(pal, 0.8), (1 - q / 0.35) * 0.6));
              if (q < 1.8) f.Lc(x, y, ramp(pal, 0.9), 0.6 * (1 - q / 1.8));
              continue;
            }
            const fresh = clamp((age - k / 13) * 3);
            f.Lc(x + 1, y, ramp(pal, 0.55), 0.35 * fresh); f.Lc(x - 1, y, ramp(pal, 0.55), 0.35 * fresh); f.Lc(x, y + 1, ramp(pal, 0.55), 0.35 * fresh); f.Lc(x, y - 1, ramp(pal, 0.55), 0.35 * fresh);
            f.Ic(x, y, ramp(pal, 0.2), 0.8);
            f.Lc(x, y, ramp(pal, 0.95), (0.8 + a * 0.8) * fresh);
          }
        }
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 15 THORN OPERA
const thornOpera: SpellDef = {
  id: 15, name: 'Thorn Opera', school: 'VERDANT', dur: 8.4, climax: 6.0,
  blurb: 'Five tendrils with five temperaments perform a dangerous dance, curl into a single bud, and open into a thorned catastrophe.',
  make(rng, fx) {
    const M = 24, LS = 6.2;
    const Fz = { x: FOCUS.x, y: FOCUS.y };
    const TB = 5.85;
    const tds = [-1.15, -0.55, 0.05, 0.6, 1.2].map((a, i) => {
      const base = { x: CASTER.x + 4 + Math.cos(a) * 6, y: CASTER.y + Math.sin(a) * 4 + 1 };
      return { a, i, base, pos: Array.from({ length: M }, () => ({ ...base })), prev: Array.from({ length: M }, () => ({ ...base })), tip: { ...base }, k: [26, 13, 9, 17, 5.5][i] };
    });
    const lashes = [0, 1, 2].map((k) => ({ t: TB + 0.04 + k * 0.1, a0: -2.4 + k * 1.9 + rng.r(-0.3, 0.3), dir: k % 2 ? -1 : 1, r: 50 + k * 10 }));
    const ps = new Particles();
    let bloomed = false;
    const cho = (i: number, t: number): V2 => {
      const td = tds[i], b = td.base;
      const rest = { x: b.x + Math.cos(td.a) * 55 + Math.sin(t * 1.3 + i) * 8, y: b.y + Math.sin(td.a) * 40 + Math.cos(t * 1.1 + i * 2) * 6 };
      if (t < 0.75) { const g = easeOut(t / 0.75); const a = td.a + (1 - g) * 2.5; return { x: b.x + Math.cos(a) * 34 * g, y: b.y + Math.sin(a) * 26 * g }; }
      if (t < 2.7) {
        const q = (t - 0.75 - i * 0.37) / 0.55;
        if (q < 0 || q > 1) return rest;
        if (i === 0) return q < 0.35 ? { x: TARGETS[0].x, y: TARGETS[0].y - 6 } : rest;
        if (i === 1) { if (q < 0.3) { const a = q * 34; return { x: b.x + 26 + Math.cos(a) * 14, y: b.y - 4 + Math.sin(a) * 10 }; } return { x: TARGETS[2].x, y: TARGETS[2].y - 5 }; }
        if (i === 2) { if (q < 0.45) { const u = q / 0.45; return { x: lerp(rest.x, TARGETS[1].x, u), y: lerp(rest.y, TARGETS[1].y, u) + Math.sin(u * 14) * 22 }; } return { x: TARGETS[1].x - 34, y: TARGETS[1].y - 30 }; }
        if (i === 3) { if (q < 0.5) { const a = lerp(-1.1, 1.0, q / 0.5); return { x: CASTER.x + Math.cos(a) * 112, y: CASTER.y + Math.sin(a) * 80 }; } return { x: CASTER.x + 60, y: CASTER.y - 44 }; }
        if (q < 0.45) { const u = q * 9; return { x: rest.x + Math.sin(u) * 22, y: rest.y + Math.sin(u * 2) * 12 }; }
        return { x: TARGETS[3].x, y: TARGETS[3].y - 6 };
      }
      if (t < 3.9) {
        const u = easeInOut(clamp((t - 2.7 - (i >> 1) * 0.16) / 0.75));
        const a = i % 2 ? lerp(1.1, -1.1, u) : lerp(-1.1, 1.1, u);
        return { x: CASTER.x + Math.cos(a) * 118, y: CASTER.y + Math.sin(a) * 86 };
      }
      if (t < 4.7) { const a = (i - 2) * 0.42, r = 72 + 52 * Math.abs(Math.sin((t - 3.9) * Math.PI * 2.5)); return { x: CASTER.x + Math.cos(a) * r, y: CASTER.y + Math.sin(a) * r * 0.8 }; }
      if (t < TB) { const q = inv(4.7, 5.6, t); const a = (i / 5) * TAU + (t - 4.7) * 3.2; const r = 18 * (1 - q * 0.6); return { x: Fz.x + Math.cos(a) * r, y: Fz.y + Math.sin(a) * r * 0.75 }; }
      if (t < 6.5) { const a = (i / 5) * TAU + 0.3; return { x: Fz.x + Math.cos(a) * 85, y: Fz.y + Math.sin(a) * 62 }; }
      return { x: b.x + Math.cos(td.a) * 30, y: b.y + Math.sin(td.a) * 18 + 10 };
    };
    return {
      update(dt, t) {
        ps.update(dt);
        const grow = easeOut(inv(0.05, 0.8, t)) * (1 - 0.88 * inv(6.6, 8.0, t));
        const rl = LS * (0.12 + 0.88 * grow);
        for (const td of tds) {
          const tg = cho(td.i, t);
          const k = t > 0.75 && t < 2.7 ? td.k * 1.6 : t > TB && t < 6.2 ? 30 : td.k;
          td.tip.x += (tg.x - td.tip.x) * (1 - Math.exp(-dt * k)); td.tip.y += (tg.y - td.tip.y) * (1 - Math.exp(-dt * k));
          const P2 = td.pos, PV = td.prev;
          for (let j = 1; j < M; j++) { const vx = (P2[j].x - PV[j].x) * 0.93, vy = (P2[j].y - PV[j].y) * 0.93; PV[j].x = P2[j].x; PV[j].y = P2[j].y; P2[j].x += vx; P2[j].y += vy; }
          const tipPrev = { x: PV[M - 1].x, y: PV[M - 1].y };
          P2[M - 1].x += (td.tip.x - P2[M - 1].x) * 0.3; P2[M - 1].y += (td.tip.y - P2[M - 1].y) * 0.3;
          for (let it = 0; it < 10; it++) {
            P2[0].x = td.base.x; P2[0].y = td.base.y;
            for (let j = 0; j < M - 1; j++) {
              const a = P2[j], b = P2[j + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-4, df = (d - rl) / d;
              if (j === 0) { b.x -= dx * df; b.y -= dy * df; } else { a.x += dx * df * 0.5; a.y += dy * df * 0.5; b.x -= dx * df * 0.5; b.y -= dy * df * 0.5; }
            }
            for (let j = 0; j < M - 2; j++) {
              const a = P2[j], c = P2[j + 2], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1e-4;
              if (d < rl * 1.55) { const df = (d - rl * 1.55) / d * 0.25; if (j > 0) { a.x += dx * df; a.y += dy * df; } c.x -= dx * df; c.y -= dy * df; }
            }
          }
          const sp = Math.hypot(P2[M - 1].x - tipPrev.x, P2[M - 1].y - tipPrev.y) / dt;
          if (sp > 230 && rng.chance(0.5)) ps.add({ x: P2[M - 2].x, y: P2[M - 2].y, z: 3, vx: (P2[M - 1].x - tipPrev.x) / dt * 0.25 + rng.r(-20, 20), vy: (P2[M - 1].y - tipPrev.y) / dt * 0.25 + rng.r(-20, 20), vz: rng.r(10, 40), grav: 18, drag: 1.2, spin: rng.r(-8, 8), kind: 'petal', col: rng.chance(0.5) ? P.leaf : P.bloom, max: rng.r(1.2, 2.2) });
        }
        if (!bloomed && t >= TB) {
          bloomed = true; fx.shake(7); fx.kick(2); fx.flash([1, 0.6, 0.8], 0.25);
          for (let i = 0; i < 230; i++) { const a = rng.r(0, TAU), s = rng.r(20, 150); ps.add({ x: Fz.x + Math.cos(a) * 6, y: Fz.y + Math.sin(a) * 4, z: rng.r(4, 14), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rng.r(10, 60), grav: 16, drag: 1.4, spin: rng.r(-9, 9), kind: 'petal', col: P.bloom, max: rng.r(1.8, 3.4), k: 1, delay: rng.r(0, 0.3) }); }
        }
      },
      render(f, t) {
        for (const td of tds) {
          const pts = catmull(td.pos, 2);
          const n = pts.length;
          const ws = pts.map((_, j) => lerp(3.6, 0.7, j / (n - 1)));
          f.ribbon(pts.map((p) => ({ x: p.x + 1, y: p.y + 2 })), ws, (x, y) => f.S(x, y, 0.62));
          f.ribbon(pts, ws, (x, y, _s, e) => {
            const tone = Math.abs(e) > 0.82 ? 0.08 : e < -0.4 ? 0.68 : e > 0.45 ? 0.3 : 0.5;
            f.Ic(x, y, ramp(P.leaf, tone), 1);
            if (Math.abs(e) < 0.2) f.Lc(x, y, ramp(P.leaf, 0.85), 0.1);
          });
          for (let j = 2; j < M - 1; j += 2) {
            const p = td.pos[j], a = td.pos[j - 1], b = td.pos[j + 1];
            const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl;
            const sd = j % 4 < 2 ? 1 : -1, nx = -uy * sd, ny = ux * sd;
            const w = lerp(3.6, 0.7, j / (M - 1));
            const len = 2.4 + 2 * (1 - j / M);
            const bx = p.x + nx * w * 0.8, by = p.y + ny * w * 0.8;
            const tip = { x: bx + (nx * 0.85 - ux * 0.55) * len, y: by + (ny * 0.85 - uy * 0.55) * len };
            f.polyI([{ x: bx - ux * 1.3, y: by - uy * 1.3 }, { x: bx + ux * 1.3, y: by + uy * 1.3 }, tip], ramp(P.bark, 0.25), 1);
            f.Lc(tip.x, tip.y, ramp(P.leaf, 0.95), 0.45);
            if (j % 6 === 4) flower(f, p.x - nx * w, p.y - ny * w, 0.35, j + t, 3, P.leaf);
          }
          f.Lc(td.pos[M - 1].x, td.pos[M - 1].y, ramp(P.leaf, 1), 0.7);
        }
        // the bud, then the catastrophe flower
        if (t > 4.9 && t < TB) {
          const g = inv(4.9, 5.7, t);
          f.disc(Fz.x, Fz.y - 2, 3 + g * 8, (x, y, d) => { f.Ic(x, y, ramp(P.bloom, 0.25 + (1 - d) * 0.35), 1); if (Math.abs(Math.sin(Math.atan2(y - Fz.y, x - Fz.x) * 3 + t)) < 0.15) f.Lc(x, y, ramp(P.bloom, 0.9), 0.8 * g); }, 0.8);
          f.glow(Fz.x, Fz.y, 24, ramp(P.bloom, 0.7), 0.4 * g, 4);
        }
        if (t >= TB) {
          const op = backOut(inv(TB, TB + 0.28, t), 2.2), fade = 1 - inv(6.6, 7.6, t);
          if (fade > 0) {
            const R = 44 * op;
            f.field(Fz.x - R - 2, Fz.y - R - 2, Fz.x + R + 2, Fz.y + R + 2, (x, y) => {
              const dx = x + 0.5 - Fz.x, dy = (y + 0.5 - Fz.y) / 0.78, r = Math.hypot(dx, dy), pa = Math.atan2(dy, dx);
              if (r > R) return;
              for (let k = 0; k < 7; k++) {
                const ang = (k / 7) * TAU + 0.2 + (1 - op) * 0.8;
                const u = r / R, hw = 13 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.7) * op;
                const m = hw - Math.abs(angDiff(ang, pa)) * r;
                if (m <= 0) continue;
                const serr = m < 1.6 && hash2(Math.floor(r * 0.8), k) > 0.45;
                if (serr) { f.Ic(x, y, ramp(P.bark, 0.2), fade > bayer(x, y) ? 1 : 0); return; }
                if (fade < bayer(x, y)) return;
                f.Ic(x, y, rampD(P.bloom, 0.25 + (1 - u) * 0.45 + (m > hw * 0.8 ? 0.1 : 0), bayer(x, y)), 1);
                if (Math.abs(angDiff(ang, pa)) * r < 0.6) f.Lc(x, y, ramp(P.bloom, 0.9), 0.4);
                return;
              }
            });
            f.disc(Fz.x, Fz.y, 6 * op, (x, y, d) => { f.Ic(x, y, ramp(P.gold, 0.4 + (1 - d) * 0.5), fade); }, 0.8);
            f.glow(Fz.x, Fz.y, 60, ramp(P.bloom, 0.7), 0.35 * fade * Math.exp(-(t - TB) * 1.5) + 0.05, 4, 0.8);
          }
          for (const l of lashes) {
            const q = (t - l.t) / 0.34;
            if (q < 0 || q > 1) continue;
            const span = 2.6, head = l.a0 + l.dir * span * easeOut(Math.min(1, q * 1.6));
            const pts: V2[] = [];
            for (let j = 0; j <= 30; j++) { const a = lerp(l.a0, head, j / 30); pts.push({ x: Fz.x + Math.cos(a) * l.r * 1.1, y: Fz.y + Math.sin(a) * l.r * 0.75 }); }
            const fade2 = 1 - q;
            f.ribbon(pts, pts.map((_, j) => (j / 30) * 4.5 * fade2 + 0.4), (x, y, s, e) => {
              if (fade2 * (0.4 + s) < bayer(x, y)) return;
              f.Ic(x, y, ramp(P.leaf, e * l.dir > 0.3 ? 0.75 : 0.45), 1);
              if (s > 0.85) f.Lc(x, y, ramp(P.leaf, 1), 0.8);
            });
            for (let j = 4; j < 30; j += 3) { const p = pts[j], a = lerp(l.a0, head, j / 30); f.lineI(p.x, p.y, p.x + Math.cos(a) * 4, p.y + Math.sin(a) * 3, ramp(P.bark, 0.2), fade2); }
            shock(f, pts[30].x, pts[30].y, 6 + q * 10, 5, 3 * fade2, 1);
          }
        }
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 16 WORLDSEED
const worldseed: SpellDef = {
  id: 16, name: 'Worldseed', school: 'VERDANT', dur: 10.2, climax: 7.72,
  blurb: 'A fragile seed cracks to reveal far more geometry than it could hold: leaves, membranes, cellular petals, a living core.',
  make(rng, fx) {
    const Wc = { x: 244, y: 118 };
    const C = { x: Wc.x, y: Wc.y - 12 }, SYW = 0.78;
    const TCR = 2.0, TOP = 2.5, TBU = 7.6;
    const fold = (t: number, d: number) => 1 - easeInOut(inv(8.0 + d, 9.3 + d, t));
    const membr: Seg[][] = Array.from({ length: 7 }, (_, k) => growTree(rng, { x: C.x, y: C.y, ang: ((k + 0.5) / 7) * TAU + 0.2, step: 4, steps: 11, speed: 22, branch: 0.45, spread: 0.45, jitter: 0.25, maxDepth: 2, t0: 3.4, sy: SYW }));
    const pulses = [6.0, 6.35, 6.7, 7.05];
    const pw = (t: number, j: number, r: number) => { const a = t - pulses[j]; if (a < 0 || a > 0.7) return 0; const rw = a * 140; return Math.exp(-Math.pow(r - rw, 2) / 30) * (1 - a / 0.7); };
    const ps = new Particles();
    const motes = Array.from({ length: 14 }, () => ({ a: rng.r(0, TAU), r: rng.r(8, 22), w: rng.r(0.3, 0.9) * rng.sign(), h: rng.r(-6, 6) }));
    let burst = false;
    return {
      update(dt, t) {
        ps.update(dt);
        if (!burst && t >= TBU) {
          burst = true; fx.shake(4); fx.flash([1, 0.9, 0.5], 0.3); fx.kick(1.5);
          for (let i = 0; i < 420; i++) { const a = rng.r(0, TAU), s = rng.r(15, 130); ps.add({ x: C.x, y: C.y, vx: Math.cos(a) * s - Math.sin(a) * s * 0.4, vy: (Math.sin(a) * s + Math.cos(a) * s * 0.4) * 0.75, drag: 1.1, kind: 'spore', col: P.gold, c: ramp(P.gold, 0.9), max: rng.r(1.6, 3.2), k: 0.9 }); }
          for (let i = 0; i < 90; i++) { const a = rng.r(0, TAU), s = rng.r(20, 90); ps.add({ x: C.x, y: C.y + 10, z: 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rng.r(10, 50), grav: 14, drag: 1, spin: rng.r(-8, 8), kind: 'petal', col: P.bloom, max: rng.r(2, 3.5), k: 1 }); }
          for (let i = 0; i < 26; i++) { const a = rng.r(0, TAU), s = rng.r(14, 60); ps.add({ x: C.x, y: C.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, drag: 0.55, kind: 'seed', c: [0.85, 1, 0.55], max: rng.r(3.5, 5.5), k: 1.3 }); }
        }
      },
      render(f, t) {
        if (t < TOP + 0.9) {
          // the seed, fragile and nearly still
          const bob = Math.sin(t * 1.6) * 1.5;
          const sx = C.x, sy = C.y - bob, rot = Math.sin(t * 0.7) * 0.25;
          f.shadeDisc(Wc.x, Wc.y + 6, 7, 0.6, 0.45, 2);
          const open = clamp((t - TOP) / 0.9);
          const crack = inv(TCR, TOP, t);
          for (const side of [-1, 1]) {
            const ox = side * easeOut(open) * 16, oy = open * open * 24;
            f.field(sx - 8 + ox, sy - 10 + oy, sx + 8 + ox, sy + 10 + oy, (x, y) => {
              const lx = x + 0.5 - sx - ox, ly = y + 0.5 - sy - oy;
              const rx = lx * Math.cos(rot) + ly * Math.sin(rot), ry = -lx * Math.sin(rot) + ly * Math.cos(rot);
              if ((rx * rx) / 25 + (ry * ry) / 49 > 1) return;
              if (Math.sign(rx + 0.001) !== side) return;
              if (open > 0 && (1 - open) < bayer(x, y)) return;
              f.Ic(x, y, rampD(P.leaf, 0.12 + (rx < 0 ? 0.12 : 0) + (ry < -3 ? 0.06 : 0), bayer(x, y)), 1);
              const vn = Math.abs(noise3(rx * 0.5, ry * 0.4, 1) - 0.5);
              if (vn < 0.05) f.Lc(x, y, ramp(P.gold, 0.85), 0.35 + 0.3 * Math.sin(t * 2.5));
              const zig = Math.sin(ry * 1.4) * 1.2;
              if (crack > 0 && open === 0 && Math.abs(rx - zig) < 0.5 + crack * 0.6 && Math.abs(ry) < 7 * crack) f.L(x, y, 1.5, 1.4, 1);
            });
          }
          if (crack > 0 && open < 0.5) for (let k = 0; k < 4; k++) {
            const a = -Math.PI / 2 + (k - 1.5) * 0.5 + Math.sin(t * 20 + k) * 0.05, l = (10 + 10 * hash(k + Math.floor(t * 15))) * crack;
            f.lineL(sx, sy, sx + Math.cos(a) * l, sy + Math.sin(a) * l, GOLD, 0.6 * (1 - open * 2));
          }
          f.glow(sx, sy, 12, ramp(P.gold, 0.8), 0.2 + crack * 0.8, 3);
          for (const m of motes) { const a = m.a + t * m.w; f.Lc(C.x + Math.cos(a) * m.r, C.y + Math.sin(a) * m.r * 0.6 + m.h, ramp(P.gold, 0.9), 0.6 * (1 - open)); }
        }
        if (t < TOP) { ps.render(f); return; }
        f.shadeDisc(Wc.x, Wc.y + 8, 70 * inv(TOP, 6, t) * fold(t, 0.2) + 4, 0.6, 0.45, 3);
        // luminous membranes with branching veins
        const mg = inv(3.3, 5.0, t) * fold(t, 0.1);
        if (mg > 0) for (let k = 0; k < 7; k++) {
          const a0 = (k / 7) * TAU + 0.2, a1 = ((k + 1) / 7) * TAU + 0.2, R = 50 * mg;
          const wedge = [C, ...Array.from({ length: 6 }, (_, i) => { const a = lerp(a0 + 0.15, a1 - 0.15, i / 5); return { x: C.x + Math.cos(a) * R, y: C.y + Math.sin(a) * R * SYW }; })];
          f.poly(wedge, (x, y) => { const r = Math.hypot(x - C.x, (y - C.y) / SYW); f.Lc(x, y, ramp(P.spore, 0.7), 0.07 + pw(t, 1, r) * 0.8); });
          drawTree(f, membr[k], t, (x, y) => { const r = Math.hypot(x - C.x, (y - C.y) / SYW); if (r < R) f.Lc(x, y, ramp(P.spore, 0.85), 0.3 + pw(t, 1, r) * 1.2); });
        }
        // layered organism: leaves (slow), petals (cellular), inner petals (trembling)
        const lay = [
          { n: 12, off: 0, L: 18 * easeOut(inv(3.8, 5.0, t)) * fold(t, 0), Wd: 3.4, tw: 0.045, kind: 2 },
          { n: 9, off: 0.5, L: 38 * backOut(inv(3.2, 4.6, t), 1.4) * fold(t, 0.15), Wd: 9, tw: 0, kind: 1 },
          { n: 7, off: 0.2, L: 76 * easeOut(inv(2.6, 6.0, t), 2) * fold(t, 0.35), Wd: 17, tw: 0, kind: 0 },
        ];
        const R = 80;
        f.field(C.x - R, C.y - R * SYW, C.x + R, C.y + R * SYW, (x, y) => {
          const dx = x + 0.5 - C.x, dy = (y + 0.5 - C.y) / SYW, r = Math.hypot(dx, dy);
          if (r > R) return;
          const pa = Math.atan2(dy, dx);
          for (const l of lay) {
            if (l.L < 1 || r > l.L) continue;
            for (let k = 0; k < l.n; k++) {
              const ang = ((k + l.off) / l.n) * TAU + (l.kind === 1 ? t * 0.05 : 0) + Math.sin(t * 31 + k * 1.7) * l.tw + (1 - fold(t, 0.2)) * 1.6;
              const u = r / l.L, hw = l.Wd * Math.pow(Math.sin(Math.PI * Math.min(1, u)), 0.8) * (1 - 0.25 * u);
              const v = (angDiff(ang, pa) * r) / Math.max(hw, 0.3);
              if (Math.abs(v) >= 1) continue;
              const th = bayer(x, y), av = Math.abs(v);
              if (l.kind === 0) {
                const unf = easeOut(inv(2.6, 6.0, t), 2);
                let tone = 0.28 + 0.2 * (1 - av);
                if (av < 0.1) tone += 0.25;
                if (((u * 9 - av * 1.5) % 1 + 1) % 1 < 0.12) tone += 0.12;
                if (unf < 1 && u > 0.86) tone += 0.25;
                if (av > 0.86) tone = 0.12;
                f.Ic(x, y, rampD(P.leaf, tone, th), 1);
                const p0 = pw(t, 0, r);
                if (p0 > 0.05 && (((u * 18 + av * 3) % 1) < 0.14 || av < 0.12)) f.Lc(x, y, ramp(P.leaf, 1), p0 * 1.4);
              } else if (l.kind === 1) {
                const cu = u * 7 + hash2(k, Math.floor(u * 7)) * 0.3, cv = (v + 1) * 2.5;
                const wall = cu % 1 < 0.16 || cv % 1 < 0.16;
                const lit = u < (t - 4.3) * 0.55;
                f.Ic(x, y, rampD(P.bloom, 0.25 + 0.42 * (1 - av) + (wall ? 0.15 : 0), th), 1);
                if (lit && !wall) f.Lc(x, y, ramp(P.bloom, 0.8), 0.12 + pw(t, 2, r) * 1.2);
                if (av > 0.85) f.Ic(x, y, ramp(P.bloom, 0.15), 1);
              } else {
                f.Ic(x, y, rampD(P.gold, 0.55 + 0.4 * (1 - av), th), 1);
                f.Lc(x, y, ramp(P.gold, 0.9), 0.25 + pw(t, 3, r) * 1.5);
              }
              return;
            }
          }
        });
        // leaflets: more geometry sprouting from geometry
        const lg = inv(5.0, 6.0, t) * fold(t, 0.35);
        if (lg > 0) for (let k = 0; k < 7; k++) {
          const a = (k / 7 + 0.2 / 7) * TAU + 0.2 - 0.2 + (0.2 / 7) * 0, bp = { x: C.x + Math.cos(a + 0.0) * 76 * 0.7 * fold(t, 0.35), y: C.y + Math.sin(a) * 76 * 0.7 * SYW * fold(t, 0.35) };
          for (const s of [-1, 1]) {
            const aa = a + s * 0.7;
            f.ribbon([bp, { x: bp.x + Math.cos(aa) * 14 * lg, y: bp.y + Math.sin(aa) * 14 * lg * SYW }], [0.6, 2.6 * lg], (x, y, _q, e) => f.Ic(x, y, ramp(P.leaf, Math.abs(e) < 0.2 ? 0.7 : 0.45), 1));
          }
        }
        // luminous core
        const cg = inv(4.2, 6.0, t) * fold(t, -0.1);
        if (cg > 0) {
          const pr = 1 + 0.15 * Math.sin(t * 6);
          f.discL(C.x, C.y, (3 + cg * 4) * pr, [1, 0.9, 0.6], 0.45 + pw(t, 3, 0) * 1.5);
          for (let k = 0; k < 22; k++) { const r = 1.6 * Math.sqrt(k) * cg, a = k * 2.39996 - t * 1.2; f.Lc(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r * SYW, GOLD, 0.6); }
          f.glow(C.x, C.y, 30, ramp(P.gold, 0.8), 0.22 * cg, 4);
        }
        if (t >= TBU) {
          const a = t - TBU;
          if (a < 1.1) for (let k = 0; k < 6; k++) for (let j = 0; j < 40; j++) {
            const r = j * 3.2, rr = a * 150;
            if (r > rr) break;
            const an = (k / 6) * TAU + r * 0.035;
            f.Lc(C.x + Math.cos(an) * r, C.y + Math.sin(an) * r * SYW, ramp(P.leaf, 0.95), (1 - a / 1.1) * (1 - (rr - r) / 120));
          }
          if (a < 0.5) shock(f, C.x, C.y, a * 220, 14, 6 * (1 - a / 0.5), SYW);
          if (a < 0.12) f.glow(C.x, C.y, 26, [1, 1, 0.8], 1.6, 3);
        }
        ps.render(f);
      },
    };
  },
};

export const VERDANT: SpellDef[] = [rootwake, sporeNebula, thornOpera, worldseed];
void hash3; void easeIn; void H;
