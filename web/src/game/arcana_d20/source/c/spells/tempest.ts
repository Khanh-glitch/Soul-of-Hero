// III. TEMPEST — electricity as unstable intelligence.
import { Frame, W, H } from '../engine/frame';
import { TAU, clamp, lerp, inv, easeInOut, easeIn, hash, hash2, hash3, noise3, bayer, type V2 } from '../engine/math';
import { P, ramp, type RGB } from '../engine/palette';
import { Particles, boltPts, boltTree, drawBolt, drawBoltTree, growTree, shock, type Branch, type Seg } from '../engine/kit';
import { CASTER, TARGETS } from '../engine/floor';
import type { SpellDef } from './types';

const CORE: RGB = [0.92, 0.96, 1];
const HALO: RGB = [0.28, 0.4, 1];
const GHOST: RGB = [0.34, 0.2, 0.7];
const VIO: RGB = [0.6, 0.4, 1];

const spark = (ps: Particles, x: number, y: number, n: number, sp = 120, z = 0) => {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = sp * (0.3 + Math.random());
    ps.add({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: z ? 30 : 0, grav: z ? 120 : 0, drag: 3.5, kind: 'spark', col: P.volt, max: 0.2 + Math.random() * 0.4, k: 1.1 });
  }
};
const flick = (seed: number, t: number, fps = 30) => hash(seed * 97 + Math.floor(t * fps));

// ===================================================================== 09 CHAIN VERDICT
const chainVerdict: SpellDef = {
  id: 9, name: 'Chain Verdict', school: 'TEMPEST', dur: 7.8, climax: 6.08,
  blurb: 'Probing filaments search for valid paths; the discharge reasons, fails, reconnects — then the whole network fires in sequence and dies.',
  make(rng, fx) {
    const S0 = { x: CASTER.x + 6, y: CASTER.y - 16 };
    const N = [TARGETS[0], TARGETS[2], TARGETS[1], TARGETS[3]].map((p) => ({ x: p.x, y: p.y - 8 }));
    const nodes = [S0, ...N];
    type Ch = { pts: V2[]; vars: Branch[][]; t0: number; tc: number; ok: boolean; seed: number };
    const chans: Ch[] = [];
    const mk = (way: V2[], t0: number, tc: number, ok: boolean) => {
      const seed = rng.i(1, 99999);
      const pts: V2[] = [];
      for (let i = 0; i < way.length - 1; i++) pts.push(...boltPts(seed + i, way[i].x, way[i].y, way[i + 1].x, way[i + 1].y, 0.32, 3).slice(i ? 1 : 0));
      const vars = [0, 1, 2].map((v) => {
        const br: Branch[] = [{ pts: pts.map((p, j) => (j === 0 || j === pts.length - 1 ? p : { x: p.x + (hash(seed + v * 31 + j) - 0.5) * 3, y: p.y + (hash(seed + v * 17 + j * 3) - 0.5) * 3 })), w: 1, depth: 0 }];
        for (let b = 0; b < (ok ? 5 : 3); b++) {
          const j = Math.floor(hash(seed + v * 7 + b * 13) * (pts.length - 2)) + 1, p = pts[j];
          const a = hash(seed + b * 5 + v) * TAU, l = 6 + hash(seed + b) * 18;
          br.push(...boltTree(seed + v * 100 + b, p.x, p.y, p.x + Math.cos(a) * l, p.y + Math.sin(a) * l, 1, 0.35, 1));
        }
        return br;
      });
      chans.push({ pts, vars, t0, tc, ok, seed });
    };
    const [N1, N2, N3, N4] = N;
    const deadEnd = { x: 332, y: 108 };
    mk([S0, N1], 1.5, 2.0, true);
    mk([S0, { x: 168, y: 34 }], 1.5, 1.92, false);
    mk([S0, { x: 150, y: 196 }], 1.55, 1.88, false);
    mk([S0, { x: 190, y: 150 }], 1.6, 1.95, false);
    mk([N1, N2], 2.35, 2.85, true);
    mk([N1, N4], 2.35, 2.98, true);
    mk([N1, deadEnd], 2.4, 2.78, false);
    mk([N2, { x: 258, y: 194 }, N3], 3.3, 3.8, true);
    mk([N2, { x: 262, y: 128 }, N3], 3.32, 3.86, true);
    mk([N4, deadEnd, N3], 4.1, 4.52, true);
    const okc = chans.filter((c) => c.ok);
    const TCA = 5.4, TALL = 6.05, TEND = 6.25;
    const ps = new Particles();
    const fired = new Set<number>();
    let ended = false;
    return {
      update(dt, t) {
        ps.update(dt);
        chans.forEach((c, i) => {
          if (c.ok && !fired.has(i) && t >= c.tc) {
            fired.add(i);
            fx.shake(2.5); fx.flash([0.6, 0.7, 1], 0.25); fx.kick(1.2);
            const e = c.pts[c.pts.length - 1];
            spark(ps, e.x, e.y, 24, 140);
          }
        });
        if (!fired.has(-1) && t >= TALL) { fired.add(-1); fx.shake(5); fx.flash([0.7, 0.8, 1], 0.6); fx.kick(3); }
        if (!ended && t >= TEND) {
          ended = true;
          for (const c of okc) for (let j = 0; j < c.pts.length; j += 2) if (rng.chance(0.4)) ps.add({ x: c.pts[j].x, y: c.pts[j].y, vx: rng.r(-30, 30), vy: rng.r(-30, 30), drag: 3, kind: 'spark', col: P.volt, max: rng.r(0.3, 1.2), k: 0.9 });
        }
      },
      render(f, t) {
        // nodes: sparks crawling, filaments probing for a path
        nodes.forEach((n, ni) => {
          const act = inv(0.1, 1.5, t) * (1 - inv(TEND, TEND + 1, t));
          if (act <= 0) return;
          const slot = Math.floor(t * 24);
          for (let k = 0; k < 3; k++) {
            const a = hash(slot * 7 + ni * 31 + k) * TAU, b = a + 0.8 + hash(slot + k) * 1.4;
            drawBolt(f, boltPts(slot * 13 + k + ni * 100, n.x + Math.cos(a) * 3, n.y + Math.sin(a) * 2, n.x + Math.cos(b) * 6, n.y + Math.sin(b) * 4, 0.5, 2), 0.7 * act, CORE, HALO, 0.9);
          }
          if (t < 4.6 && hash(slot * 3 + ni * 11) > 0.55) {
            const a = hash(slot * 5 + ni) * TAU, l = 8 + hash(slot * 9 + ni) * 22;
            drawBolt(f, boltPts(slot + ni * 77, n.x, n.y, n.x + Math.cos(a) * l, n.y + Math.sin(a) * l * 0.7, 0.4, 3), 0.8 * act, CORE, HALO, 1);
          }
          f.glow(n.x, n.y, 10, HALO, 0.35 * act, 3);
          f.Lc(n.x, n.y, CORE, 1.2 * act);
        });
        // channels
        chans.forEach((c, i) => {
          if (t < c.t0) return;
          const v = c.vars[Math.floor(t * 30) % 3];
          if (t < c.tc) {
            const p = (t - c.t0) / (c.tc - c.t0);
            const stepped = Math.floor(p * 8) / 8 + 0.06;
            drawBoltTree(f, v, 0.55 + 0.4 * flick(c.seed, t), CORE, HALO, stepped);
            const tip = v[0].pts[Math.min(v[0].pts.length - 1, Math.floor(v[0].pts.length * stepped))];
            f.glow(tip.x, tip.y, 6, HALO, 0.8, 2);
            return;
          }
          if (!c.ok) {
            const q = (t - c.tc) / 0.3;
            if (q < 1) drawBoltTree(f, v, 0.6 * (1 - q), GHOST, GHOST, 1 - q);
            return;
          }
          const a = t - c.tc;
          let k = 0;
          if (a < 0.3) k = 2.6 * Math.exp(-a * 7) + 0.5 * flick(c.seed, t);
          const ci = okc.indexOf(c);
          const ct = TCA + ci * 0.1;
          if (t >= ct && t < ct + 0.14) k = Math.max(k, 2);
          if (t >= TALL && t < TEND) k = 2.8;
          if (k > 0.05) {
            drawBoltTree(f, v, k, CORE, HALO);
            if (a < 0.08) f.field(0, 0, W - 1, H - 1, (x, y) => f.S(x, y, 0.7));
          } else if (t < TEND) {
            const g = 0.18 + 0.12 * flick(c.seed + 1, t, 12);
            f.polylineL(c.pts, GHOST, g);
          }
          if (t >= TEND) {
            const g = 1 - inv(TEND, TEND + 1.6, t);
            for (const p of c.pts) { f.G(p.x, p.y, 0.03, 0.03, 0.06, 0.7); if (g > 0 && hash2(Math.round(p.x), Math.round(p.y)) < g) f.Lc(p.x, p.y, GHOST, 0.5 * g); }
          }
        });
        if (t >= TALL && t < TEND + 0.1) { f.field(0, 0, W - 1, H - 1, (x, y) => f.S(x, y, 0.55)); for (const n of nodes) f.glow(n.x, n.y, 22, CORE, 1.2, 3); }
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 10 THUNDERLOOM
const thunderloom: SpellDef = {
  id: 10, name: 'Thunderloom', school: 'TEMPEST', dur: 7.4, climax: 4.84,
  blurb: 'A storm is woven from magnetic thread, wound tighter and tighter around an invisible axis — then reversed into a single white spear.',
  make(rng, fx) {
    const Tg = TARGETS[0];
    const Sc = { x: Tg.x - 4, y: 62 };
    const TSP = 4.8;
    const threads = [[2, 3], [3, 2], [1, 3], [3, 4], [2, 5], [1, 2]].map(([p, q], k) => ({ p, q, R: 17 + k * 4.5, r: 5 + k * 1.3, ph: rng.r(0, TAU), dir: k % 2 ? 1 : -1, t0: 0.6 + k * 0.28 }));
    const orbs = Array.from({ length: 4 }, (_, k) => ({ r: 9 + k * 5, a: rng.r(0, TAU), dir: k % 2 ? 1 : -1 }));
    let Om = 0, scale = 1;
    const fract: Branch[][] = Array.from({ length: 11 }, (_, k) => { const a = (k / 11) * TAU + rng.r(-0.2, 0.2), l = rng.r(18, 48); return boltTree(rng.i(1, 9999), Tg.x, Tg.y, Tg.x + Math.cos(a) * l, Tg.y + Math.sin(a) * l * 0.65, 2, 0.3); });
    const chans: Seg[][] = Array.from({ length: 9 }, (_, k) => growTree(rng, { x: Tg.x, y: Tg.y, ang: (k / 9) * TAU + rng.r(-0.3, 0.3), step: 6, steps: 14, speed: 520, branch: 0.35, spread: 0.7, jitter: 0.5, maxDepth: 2, t0: TSP + 0.02, sy: 0.7 }));
    const reig = [0.55, 0.85, 1.2, 1.5, 1.9, 2.3].map((d) => ({ t: TSP + d, c: rng.i(0, 8), s: 0, done: false }));
    const ps = new Particles();
    let struck = false;
    const tp = (th: (typeof threads)[0], s: number, t: number) => {
      const rr = th.R + th.r * Math.cos(th.q * s);
      const a = th.p * s + th.ph + th.dir * t * 0.4;
      let x = rr * Math.cos(a), y = rr * Math.sin(a);
      const z = th.r * Math.sin(th.q * s);
      const c = Math.cos(Om), si = Math.sin(Om);
      [x, y] = [x * c - y * si, x * si + y * c];
      return { x: Sc.x + x * scale * 1.75, y: Sc.y + y * 0.6 * scale - z * 1.1 * scale, z: y };
    };
    return {
      update(dt, t) {
        ps.update(dt);
        let w = 0.6 + 7.5 * Math.pow(inv(1.8, 4.2, t), 2);
        if (t > 4.2) w = lerp(w, -14, inv(4.2, 4.38, t));
        Om += w * dt;
        for (const o of orbs) o.a += o.dir * (2 + 9 * Math.pow(inv(2, 4.2, t), 2)) * dt * (t > 4.25 ? -1.5 : 1);
        scale = 1 - easeIn(inv(4.38, 4.78, t), 2.5);
        if (!struck && t >= TSP) {
          struck = true; fx.shake(9); fx.flash([0.85, 0.9, 1], 0.6); fx.kick(4.5);
          spark(ps, Tg.x, Tg.y, 60, 200, 2);
          for (let i = 0; i < 40; i++) ps.add({ x: Tg.x, y: Tg.y, vx: rng.r(-80, 80), vy: rng.r(-60, 60), vz: rng.r(40, 140), grav: 260, bounce: 0.3, kind: 'dust', col: P.volt, k: 0.8, c: [0.1, 0.1, 0.15], max: rng.r(1, 2) });
        }
        for (const r of reig) if (!r.done && t >= r.t) { r.done = true; const s = chans[r.c][rng.i(0, chans[r.c].length - 1)]; r.s = chans[r.c].indexOf(s); spark(ps, s.x1, s.y1, 10, 70); }
      },
      render(f, t) {
        const dark = inv(0, 1.4, t) * (1 - inv(TSP, TSP + 0.4, t));
        f.shadeDisc(Tg.x, Tg.y, 46 * dark + 2, 1 - 0.55 * dark, 0.55, 4);
        if (t < TSP) {
          const cl = dark * (0.75 + 0.25 * inv(4.3, 4.75, t));
          f.disc(Sc.x, Sc.y, 92 * Math.max(scale, 0.3), (x, y, d) => {
            const n = noise3(x * 0.08, y * 0.12, t * 0.4);
            if (clamp((1 - d) * 1.6) * (0.5 + n * 0.6) * cl > bayer(x, y)) f.I(x, y, 0.025, 0.025, 0.06, 0.9);
          }, 0.6);
          if (t > 4.38) f.field(0, 0, W - 1, H - 1, (x, y) => f.S(x, y, 1 - 0.6 * inv(4.38, 4.75, t)));
          const slot = Math.floor(t * 20);
          const disch = hash(slot * 3) > 0.5 ? 1 : 0;
          for (const th of threads) {
            const rv = clamp((t - th.t0) / 0.8);
            if (rv <= 0) continue;
            const n = Math.floor(140 * rv);
            for (let j = 0; j < n; j++) {
              const p = tp(th, (j / 140) * TAU, t);
              const dash = (j + Math.floor(t * 24)) % 5 < 3;
              const bead = j % 18 === 0;
              const depth = p.z > 0 ? 1 : 0.5;
              if (dash || bead) f.Lc(p.x, p.y, bead ? CORE : j % 2 ? HALO : VIO, (bead ? 1.1 : 0.5 + disch * 0.5) * depth * (0.5 + inv(1, 4, t) * 0.8));
            }
          }
          // discharges between threads reveal the architecture
          for (let k = 0; k < 3; k++) {
            if (hash(slot * 7 + k) < 0.45 || scale < 0.3) continue;
            const A = threads[Math.floor(hash(slot + k * 3) * 6)], B = threads[Math.floor(hash(slot * 2 + k) * 6)];
            const pa = tp(A, hash(slot * 5 + k) * TAU, t), pb = tp(B, hash(slot * 11 + k) * TAU, t);
            if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > 34) continue;
            drawBolt(f, boltPts(slot * 31 + k, pa.x, pa.y, pb.x, pb.y, 0.4, 2), 1.3, CORE, HALO, 1.2);
            f.glow((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, 12, HALO, 0.6, 3);
          }
          for (const o of orbs) {
            const g = inv(2, 2.6, t);
            if (g <= 0) continue;
            const x = Sc.x + Math.cos(o.a) * o.r * scale * 1.75, y = Sc.y + Math.sin(o.a) * o.r * 0.6 * scale;
            f.discL(x, y, 1.6, CORE, 1.5 * g); f.glow(x, y, 8, HALO, 0.6 * g, 3);
          }
          if (Math.floor(t * 30) % 2 === 0 && hash(Math.floor(t * 30)) > 0.6) {
            const x = Sc.x + (hash(slot * 13) - 0.5) * 100, y = Sc.y + (hash(slot * 17) - 0.5) * 40;
            f.L(x, y, 1.5, 1.6, 2); f.Lc(x + 1, y, HALO, 0.6); f.Lc(x - 1, y, HALO, 0.6); f.Lc(x, y + 1, HALO, 0.6); f.Lc(x, y - 1, HALO, 0.6);
          }
          if (t > 4.38) { const g = inv(4.38, 4.78, t); f.discL(Sc.x, Sc.y, 1 + g * 2, CORE, 1 + g * 3); f.glow(Sc.x, Sc.y, 6 + g * 14, CORE, g * 1.5, 3); }
        } else {
          const a = t - TSP;
          if (a < 0.45) {
            const k = a < 0.08 ? 5 : 4 * Math.exp(-(a - 0.08) * 9);
            drawBolt(f, boltPts(9 + Math.floor(t * 30) % 2, Tg.x, -4, Tg.x, Tg.y - 1, 0.035, 3), k, CORE, HALO, 2.4);
            if (a < 0.1) f.field(0, 0, W - 1, H - 1, (x, y) => f.S(x, y, 0.4));
          }
          if (a < 0.15) f.discL(Tg.x, Tg.y, 8, CORE, 3); else if (a < 0.6) f.ringL(Tg.x, Tg.y, 8 + (a - 0.15) * 140, CORE, 1.2 * (1 - a / 0.6), 0.65);
          f.glow(Tg.x, Tg.y, 60, HALO, 1.6 * Math.exp(-a * 3), 5, 0.7);
          for (const fr of fract) drawBoltTree(f, fr, 1.8 * Math.exp(-a * 2.2) + 0.15 * flick(fr.length, t, 15), CORE, HALO, clamp(a * 8));
          if (a < 0.6) {
            const slot = Math.floor(t * 30), dec = 1 - a / 0.6;
            for (let y = 0; y < H; y++) { const h = hash(((y >> 2) + slot * 57) | 0); if (h > 0.82) { const dx = (hash(y * 3 + slot) - 0.5) * 16 * dec; for (let x = 0; x < W; x++) { f.D(x, y, dx, 0); if (h > 0.95) f.C(x, y, 3 * dec); } } }
            shock(f, Tg.x, Tg.y, a * 220, 14, 7 * dec, 0.7, 2);
          }
          const g = Math.exp(-a * 1.1);
          chans.forEach((ch) => {
            for (const s of ch) {
              if (t < s.t0) continue;
              const u = clamp((t - s.t0) / (s.t1 - s.t0));
              f.line(s.x0, s.y0, lerp(s.x0, s.x1, u), lerp(s.y0, s.y1, u), (x, y) => { f.G(x, y, 0.04, 0.04, 0.08, 0.5); if (hash2(x, y + Math.floor(t * 10)) < g) f.Lc(x, y, s.depth ? GHOST : VIO, 0.5 * g); });
            }
          });
          for (const r of reig) {
            const q = t - r.t;
            if (q < 0 || q > 0.12 || !r.done) continue;
            const ch = chans[r.c], s0 = Math.max(0, r.s - 4);
            const pts = ch.slice(s0, r.s + 1).filter((s) => s.depth === ch[r.s].depth).map((s) => ({ x: s.x1, y: s.y1 }));
            if (pts.length > 1) drawBolt(f, pts, 1.6, CORE, HALO, 1.2);
            f.glow(ch[r.s].x1, ch[r.s].y1, 10, HALO, 0.8, 3);
          }
        }
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 11 VOLT CAROUSEL
const voltCarousel: SpellDef = {
  id: 11, name: 'Volt Carousel', school: 'TEMPEST', dur: 8.2, climax: 6.12,
  blurb: 'Conductive halos and broken crowns orbit the caster, bridging whenever they align — until a forbidden configuration synchronises.',
  make(rng, fx) {
    const Cc = { x: CASTER.x + 4, y: CASTER.y - 10 }, SY = 0.6;
    const TA0 = 5.4, TA = 6.0, TF = 6.4;
    type St = { pieces: V2[][]; terms: V2[]; R: number; Rt: number; th: number; w: number; ph: number; sw: number; t0: number; snapPh: number; snapTh: number | null; a0?: { th: number; ph: number; R: number } };
    const arc = (r: number, a0: number, a1: number, n = 8) => Array.from({ length: n + 1 }, (_, i) => { const a = lerp(a0, a1, i / n); return { x: Math.cos(a) * r, y: Math.sin(a) * r }; });
    const sts: St[] = [];
    { const pieces: V2[][] = [], terms: V2[] = [];
      for (let k = 0; k < 6; k++) { const a0 = (k / 6) * TAU, a1 = a0 + TAU / 6 - 0.32; pieces.push(arc(20, a0, a1)); terms.push(pieces[k][0], pieces[k][8]); }
      sts.push({ pieces, terms, R: 0, Rt: 0, th: 0, w: 0, ph: 0, sw: 0.9, t0: 0.2, snapPh: TAU / 6, snapTh: null }); }
    { const pieces: V2[][] = [], terms: V2[] = [];
      for (let g = 0; g < 3; g++) { const pc: V2[] = []; for (let j = 0; j <= 6; j++) { const i = g * 9 + j * 1, a = (i / 27) * TAU; const r = j % 2 ? 38 : 31; pc.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); if (j % 2) terms.push(pc[pc.length - 1]); } pieces.push(pc); }
      sts.push({ pieces, terms, R: 0, Rt: 0, th: 0, w: 0, ph: 0.5, sw: -0.55, t0: 0.45, snapPh: TAU / 3, snapTh: null }); }
    const poly = (n: number, r: number) => Array.from({ length: n }, (_, i) => ({ x: Math.cos((i / n) * TAU - Math.PI / 2) * r, y: Math.sin((i / n) * TAU - Math.PI / 2) * r }));
    { const v = poly(3, 9); sts.push({ pieces: v.map((p, i) => [p, v[(i + 1) % 3]]), terms: v, R: 44, Rt: 44, th: 1, w: 1.3, ph: 0, sw: 2.2, t0: 0.7, snapPh: TAU / 3, snapTh: -Math.PI / 2 }); }
    { const v = poly(4, 8); const pieces = v.map((p, i) => { const q = v[(i + 1) % 4]; const m = { x: (p.x + q.x) / 2 * 1.5, y: (p.y + q.y) / 2 * 1.5 }; return [p, m, q]; }); sts.push({ pieces, terms: v, R: 56, Rt: 56, th: 3, w: -0.9, ph: 0, sw: -1.6, t0: 0.9, snapPh: TAU / 4, snapTh: Math.PI / 2 }); }
    { const v = poly(3, 3.5); sts.push({ pieces: v.map((p) => [p, { x: p.x * 0.4, y: p.y * 0.4 }]), terms: v, R: 66, Rt: 66, th: 5, w: 2.2, ph: 0, sw: 4, t0: 1.1, snapPh: TAU / 3, snapTh: 0 }); }
    const W2 = (s: St, p: V2) => {
      const c = Math.cos(s.ph), si = Math.sin(s.ph);
      const lx = (p.x * c - p.y * si) * 1.3, ly = (p.x * si + p.y * c) * 1.3;
      return { x: Cc.x + Math.cos(s.th) * s.R * 1.35 + lx, y: Cc.y + Math.sin(s.th) * s.R * SY * 1.2 + ly * SY };
    };
    type Fr = { pts: V2[]; cx: number; cy: number; ang: number; rad: number; w: number; spin: number; rot: number; out: number; life: number };
    const frags: Fr[] = [];
    const ps = new Particles();
    const ev = new Set<string>();
    const once = (k: string, t: number, at: number) => { if (t >= at && !ev.has(k)) { ev.add(k); return true; } return false; };
    return {
      update(dt, t) {
        ps.update(dt);
        if (once('a', t, 3.6)) { sts[2].Rt = 28; fx.shake(1.5); }
        if (once('b', t, 4.0)) sts[3].w *= -1.8;
        if (once('c', t, 4.3)) sts[0].sw *= 2.6;
        if (once('d', t, 4.7)) { sts[4].Rt = 76; sts[4].w *= -1.3; }
        if (once('e', t, 5.0)) sts[1].sw *= -1.8;
        if (t < TA0) for (const s of sts) {
          const acc = 1 + 1.4 * inv(2, 5.4, t);
          s.th += s.w * acc * dt; s.ph += s.sw * acc * dt; s.R = lerp(s.R, s.Rt, 1 - Math.exp(-dt * 9));
        } else if (t < TF) {
          const q = easeInOut(inv(TA0, TA, t));
          for (const s of sts) {
            if (!s.a0) s.a0 = { th: s.th, ph: s.ph, R: s.R };
            const phT = Math.round(s.a0.ph / s.snapPh) * s.snapPh;
            const thT = s.snapTh === null ? s.a0.th : s.snapTh + Math.round((s.a0.th - s.snapTh) / TAU) * TAU;
            const RT = [0, 0, 40, 52, 66][sts.indexOf(s)];
            s.th = lerp(s.a0.th, thT, q); s.ph = lerp(s.a0.ph, phT, q) + (t > TA ? (t - TA) * 0.5 : 0); s.R = lerp(s.a0.R, RT, q);
          }
        }
        if (once('sync', t, TA)) { fx.shake(6); fx.flash([0.7, 0.8, 1], 0.35); fx.kick(3.5); spark(ps, Cc.x, Cc.y, 50, 220); }
        if (once('frac', t, TF)) {
          sts.forEach((s, si) => s.pieces.forEach((pc) => {
            const wp = pc.map((p) => W2(s, p));
            const cx = wp.reduce((a, p) => a + p.x, 0) / wp.length, cy = wp.reduce((a, p) => a + p.y, 0) / wp.length;
            const dx = cx - Cc.x, dy = (cy - Cc.y) / SY;
            frags.push({ pts: wp.map((p) => ({ x: p.x - cx, y: p.y - cy })), cx, cy, ang: Math.atan2(dy, dx), rad: Math.hypot(dx, dy), w: (si % 2 ? -1 : 1) * rng.r(1.5, 3.5), spin: rng.r(-5, 5), rot: 0, out: rng.r(15, 50), life: rng.r(1.1, 1.8) });
          }));
          fx.shake(4);
        }
        for (const fr of frags) { fr.ang += fr.w * dt; fr.rad += fr.out * dt; fr.w *= Math.exp(-dt * 0.8); fr.rot += fr.spin * dt; fr.life -= dt; }
      },
      render(f, t) {
        const charge = inv(0.5, 5.8, t);
        const all = t >= TA && t < TF;
        if (t < TF) {
          f.glow(Cc.x, Cc.y, 80, HALO, 0.08 + 0.12 * charge, 4, SY);
          const terms: { p: V2; s: number }[] = [];
          sts.forEach((s, si) => {
            const g = clamp((t - s.t0) / 0.5);
            if (g <= 0) return;
            for (const pc of s.pieces) {
              const wp = pc.map((p) => W2(s, p));
              f.ribbon(wp, 1.25, (x, y, _q, e) => {
                if (g < bayer(x, y)) return;
                f.Ic(x, y, ramp(P.steel, e < -0.2 ? 0.9 : e > 0.4 ? 0.3 : 0.6), 1);
                if (e < -0.3) f.Lc(x, y, ramp(P.volt, 0.7), 0.2 + 0.5 * charge + (all ? 1 : 0));
              });
            }
            for (const p of s.terms) { const w = W2(s, p); terms.push({ p: w, s: si }); f.Lc(w.x, w.y, CORE, (0.5 + charge) * g); f.Lc(w.x + 1, w.y, HALO, 0.4 * g); f.Lc(w.x - 1, w.y, HALO, 0.4 * g); }
            if (g < 1) spark(ps, Cc.x, Cc.y, 0);
          });
          // bridges between aligned terminals
          const thr = 9 + 9 * charge;
          const adj = new Map<number, Set<number>>();
          const slot = Math.floor(t * 20);
          let tris = 0;
          for (let i = 0; i < terms.length; i++) for (let j = i + 1; j < terms.length; j++) {
            if (terms[i].s === terms[j].s) continue;
            const a = terms[i].p, b = terms[j].p, d = Math.hypot(a.x - b.x, a.y - b.y);
            let near = Infinity;
            if (all) { for (let k = 0; k < terms.length; k++) if (terms[k].s === terms[j].s) near = Math.min(near, Math.hypot(a.x - terms[k].p.x, a.y - terms[k].p.y)); }
            const allOn = all && d <= near + 0.01 && d < 60;
            if (d > thr && !allOn) continue;
            const k = allOn ? 1.05 : (1 - d / thr) * 1.6 + 0.2;
            drawBolt(f, boltPts(i * 131 + j * 7 + slot * 3, a.x, a.y, b.x, b.y, 0.35, 2), k, CORE, HALO, 1);
            if (!adj.has(i)) adj.set(i, new Set()); if (!adj.has(j)) adj.set(j, new Set());
            for (const n of adj.get(i)!) if (adj.get(j)!.has(n) && tris < 12) { tris++; f.polyL([a, b, terms[n].p], HALO, 0.18); }
            adj.get(i)!.add(j); adj.get(j)!.add(i);
          }
          // long unstable discharges
          if (t > 3.6 && t < TA && hash(Math.floor(t * 9) * 7) > 0.45 && terms.length > 4) {
            const i = Math.floor(hash(Math.floor(t * 9)) * terms.length), j = Math.floor(hash(Math.floor(t * 9) + 99) * terms.length);
            if (terms[i].s !== terms[j].s) drawBoltTree(f, boltTree(Math.floor(t * 9) * 13, terms[i].p.x, terms[i].p.y, terms[j].p.x, terms[j].p.y, 2, 0.35), 1.2, CORE, HALO);
          }
          if (all) {
            const a = t - TA;
            f.glow(Cc.x, Cc.y, 40, HALO, 0.6 * Math.exp(-a * 4), 4, SY);
            if (a < 0.35) for (let k = 0; k < 14; k++) {
              const an = (k / 14) * TAU + 0.2, l = 70 + hash(k) * 70;
              drawBoltTree(f, boltTree(k * 77 + Math.floor(t * 30), Cc.x + Math.cos(an) * 20, Cc.y + Math.sin(an) * 20 * SY, Cc.x + Math.cos(an) * l, Cc.y + Math.sin(an) * l * SY, 2, 0.3), 1.1 * (1 - a / 0.35), CORE, HALO, clamp(a * 10));
            }
          }
        }
        for (const fr of frags) {
          if (fr.life <= 0) continue;
          const cx = Cc.x + Math.cos(fr.ang) * fr.rad * 1.1, cy = Cc.y + Math.sin(fr.ang) * fr.rad * SY;
          const c = Math.cos(fr.rot), s = Math.sin(fr.rot);
          const wp = fr.pts.map((p) => ({ x: cx + p.x * c - p.y * s, y: cy + p.x * s + p.y * c }));
          const g = clamp(fr.life / 0.6);
          f.ribbon(wp, 1.1, (x, y) => { if (g > bayer(x, y)) { f.Ic(x, y, ramp(P.steel, 0.7), 1); f.Lc(x, y, ramp(P.volt, 0.6), 0.5 * g); } });
          if (flick(Math.round(fr.cx * 3), t, 20) > 0.6) drawBolt(f, boltPts(Math.floor(t * 20) + Math.round(fr.cy), wp[0].x, wp[0].y, wp[wp.length - 1].x, wp[wp.length - 1].y, 0.6, 2), 0.9 * g, CORE, HALO, 1);
        }
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 12 SKYBREAKER SCRIPT
const skybreaker: SpellDef = {
  id: 12, name: 'Skybreaker Script', school: 'TEMPEST', dur: 8.8, climax: 7.14,
  blurb: 'A spark writes an enormous arcane character stroke by stroke; once complete it behaves like a circuit — and detonates as one.',
  make(rng, fx) {
    const G = { x: 238, y: 110 };
    const raw: { p: number[][]; mode: 0 | 1; ts: number; dur: number }[] = [
      { p: [[0, -52], [0, 48]], mode: 1, ts: 0.3, dur: 0.6 },
      { p: [[-40, -14], [42, -23]], mode: 0, ts: 1.05, dur: 0 },
      { p: [[0, -31], [23, -6], [0, 19], [-23, -6], [0, -31]], mode: 1, ts: 1.35, dur: 0.75 },
      { p: [[0, -17], [10, -6], [0, 5], [-10, -6], [0, -17]], mode: 0, ts: 2.2, dur: 0 },
      { p: [[-23, -6], [-47, 10], [-53, 34], [-44, 40]], mode: 1, ts: 2.45, dur: 0.45 },
      { p: [[23, -6], [50, 4], [58, -18], [70, -12]], mode: 0, ts: 3.0, dur: 0 },
      { p: Array.from({ length: 13 }, (_, i) => { const a = 0.35 + (i / 12) * 2.45; return [Math.cos(a) * 31, 8 + Math.sin(a) * 31]; }), mode: 1, ts: 3.2, dur: 0.6 },
      { p: [[-50, -42], [-30, -42], [-39, -29], [-26, -24]], mode: 0, ts: 3.9, dur: 0 },
      { p: [[30, -46], [30, -31], [45, -37]], mode: 1, ts: 4.05, dur: 0.25 },
      { p: [[-13, 48], [13, 48]], mode: 0, ts: 4.35, dur: 0 },
      { p: [[34, 26], [45, 34], [38, 41], [54, 47]], mode: 1, ts: 4.45, dur: 0.25 },
      { p: [[-62, -6], [-62, 22], [-56, 26]], mode: 0, ts: 4.75, dur: 0 },
    ];
    const toW = (p: number[]) => ({ x: G.x + p[0] * 1.3, y: G.y + p[1] * 0.95 });
    const strokes = raw.map((r, i) => {
      const way = r.p.map(toW);
      const pts: V2[] = [];
      for (let k = 0; k < way.length - 1; k++) { const a = way[k], b = way[k + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1.5)); for (let j = 0; j < n; j++) pts.push({ x: lerp(a.x, b.x, j / n), y: lerp(a.y, b.y, j / n) }); }
      pts.push(way[way.length - 1]);
      return { ...r, i, way, pts, te: 0, depth: -1 };
    });
    // circuit graph: breadth-first energisation from the spine
    const adj = strokes.map((a) => strokes.filter((b) => b !== a && a.pts.some((p) => b.pts.some((q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y) < 3.5))).map((b) => b.i));
    strokes[0].depth = 0;
    const qu = [0];
    while (qu.length) { const i = qu.shift()!; for (const j of adj[i]) if (strokes[j].depth < 0) { strokes[j].depth = strokes[i].depth + 1; qu.push(j); } }
    let md = 0; for (const s of strokes) { if (s.depth < 0) s.depth = 3; md = Math.max(md, s.depth); s.te = 5.0 + s.depth * 0.3 + hash(s.i) * 0.08; }
    const OVER = [5, 10], FOLD = [7, 8, 11];
    const nodes: { p: V2; td: number; done: boolean }[] = [];
    strokes.forEach((s) => [s.way[0], s.way[s.way.length - 1]].forEach((p) => { if (!nodes.some((n) => Math.hypot(n.p.x - p.x, n.p.y - p.y) < 3)) nodes.push({ p, td: 0, done: false }); }));
    nodes.sort((a, b) => a.p.y - b.p.y).forEach((n, k) => (n.td = 6.25 + k * 0.035));
    const TR = 7.0;
    const ps = new Particles();
    const done = new Set<string>();
    const shown = (s: (typeof strokes)[0], t: number) => (s.mode === 0 ? (t >= s.ts ? 1 : 0) : clamp((t - s.ts) / s.dur));
    return {
      update(dt, t) {
        ps.update(dt);
        for (const s of strokes) {
          if (s.mode === 0 && t >= s.ts && !done.has('b' + s.i)) { done.add('b' + s.i); fx.shake(1.5); fx.flash([0.6, 0.7, 1], 0.15); for (const p of s.way) spark(ps, p.x, p.y, 6, 80); }
          if (t >= s.te && !done.has('e' + s.i)) { done.add('e' + s.i); spark(ps, s.way[0].x, s.way[0].y, 8, 90); }
          if (OVER.includes(s.i) && t >= s.te + 0.5 && !done.has('o' + s.i)) { done.add('o' + s.i); fx.shake(2); for (const p of s.pts) if (rng.chance(0.3)) spark(ps, p.x, p.y, 1, 60); }
        }
        for (const n of nodes) if (!n.done && t >= n.td) { n.done = true; spark(ps, n.p.x, n.p.y, 10, 110); fx.shake(1.2); }
        if (!done.has('R') && t >= TR) {
          done.add('R'); fx.shake(10); fx.flash([0.85, 0.9, 1], 0.45); fx.kick(4.5);
          spark(ps, G.x, G.y, 120, 260);
        }
      },
      render(f, t) {
        const slot = Math.floor(t * 24);
        if (t >= TR - 0.5 && t < TR + 0.06) fx.invert = t >= TR && t < TR + 0.05 ? 1 : 0;
        for (const s of strokes) {
          const rv = shown(s, t);
          if (rv <= 0) continue;
          let pts = s.pts.slice(0, Math.max(2, Math.ceil(s.pts.length * rv)));
          let k = 0.75;
          if (s.mode === 0) k += 2.4 * Math.exp(-(t - s.ts) * 9);
          if (t >= s.te) k = 1.2 + 1.8 * Math.exp(-(t - s.te) * 5);
          let off: V2 = { x: 0, y: 0 }, alpha = 1;
          if (FOLD.includes(s.i) && t > s.te + 0.3) {
            const q = easeInOut(inv(s.te + 0.3, s.te + 1, t));
            pts = pts.map((p, j) => ({ x: lerp(p.x, G.x, q * 0.55) + (hash3(j, s.i, slot) - 0.5) * 5 * q, y: lerp(p.y, G.y, q * 0.55) + (hash3(j + 9, s.i, slot) - 0.5) * 5 * q }));
          }
          if (t >= TR) {
            const q = t - TR;
            const dx = s.way[0].x - G.x, dy = s.way[0].y - G.y, l = Math.hypot(dx, dy) || 1;
            off = { x: (dx / l) * q * (70 + hash(s.i) * 90), y: (dy / l) * q * (50 + hash(s.i) * 60) };
            alpha = 1 - q / 0.7;
            if (alpha <= 0) continue;
            k = 2 * alpha;
          }
          // trembling edges: points jump a pixel at random
          const jp = pts.map((p, j) => (hash3(j, s.i, slot) > 0.86 ? { x: p.x + (hash3(j, 5, slot) > 0.5 ? 1 : -1), y: p.y + off.y } : { x: p.x, y: p.y + off.y })).map((p) => ({ x: p.x + off.x, y: p.y }));
          if (OVER.includes(s.i) && t > s.te + 0.5 && t < TR) {
            const q = t - s.te - 0.5;
            for (let c = 0; c < jp.length - 1; c += 6) {
              const ch = jp.slice(c, c + 6);
              const mx = ch[0].x - G.x, my = ch[0].y - G.y, l = Math.hypot(mx, my) || 1;
              const o = Math.min(6, q * 14) + hash(c) * 2;
              drawBolt(f, ch.map((p) => ({ x: p.x + (mx / l) * o + (hash3(c, s.i, slot) - 0.5) * 2, y: p.y + (my / l) * o })), 0.9 + flick(c, t), CORE, VIO, 1.1);
            }
            continue;
          }
          const n = jp.length;
          f.ribbon(jp, 1.25, (x, y, sp, e) => {
            const pk = Math.max(0, 1 - Math.abs((((sp * 2.6 - t * 1.9 + s.i * 0.37) % 1) + 1) % 1 - 0.5) * 9);
            const a = Math.abs(e);
            if (a < 0.45) f.L(x, y, CORE[0] * (k + pk), CORE[1] * (k + pk), CORE[2] * (k + pk));
            else f.Lc(x, y, HALO, (k * 0.5 + pk * 0.4) * (1.2 - a));
          });
          // microscopic discharges
          if (t < TR && hash(slot * 3 + s.i) > 0.55) {
            const j = Math.floor(hash(slot + s.i * 7) * n), p = jp[j], q = jp[Math.min(n - 1, j + 1)];
            const nx = -(q.y - p.y), ny = q.x - p.x, l = Math.hypot(nx, ny) || 1, sg = hash(slot * 5 + s.i) > 0.5 ? 1 : -1;
            drawBolt(f, boltPts(slot * 7 + s.i, p.x, p.y, p.x + (nx / l) * 5 * sg, p.y + (ny / l) * 5 * sg, 0.6, 1.5), 0.8, CORE, HALO, 0.9);
          }
          // tracing head with filaments searching ahead
          if (s.mode === 1 && rv < 1) {
            const h = jp[n - 1];
            f.glow(h.x, h.y, 8, CORE, 1.1, 3);
            for (let b = 0; b < 2; b++) {
              const a = hash(slot * 3 + b + s.i) * TAU;
              drawBoltTree(f, boltTree(slot * 17 + b, h.x, h.y, h.x + Math.cos(a) * 12, h.y + Math.sin(a) * 10, 1, 0.4), 0.9, CORE, HALO);
            }
          }
        }
        // misfires toward unformed parts
        if (t > 0.6 && t < 4.9 && hash(Math.floor(t * 10) * 13) > 0.7) {
          const sl = Math.floor(t * 10);
          const fin = strokes.filter((s) => shown(s, t) >= 1), fut = strokes.filter((s) => shown(s, t) <= 0);
          if (fin.length && fut.length) {
            const a = fin[Math.floor(hash(sl) * fin.length)], b = fut[Math.floor(hash(sl + 1) * fut.length)];
            const pa = a.pts[Math.floor(hash(sl + 2) * a.pts.length)], pb = b.pts[Math.floor(hash(sl + 3) * b.pts.length)];
            drawBoltTree(f, boltTree(sl * 7, pa.x, pa.y, pb.x, pb.y, 2, 0.3), 1.1, CORE, VIO);
            f.glow(pb.x, pb.y, 8, VIO, 0.6, 3);
          }
        }
        for (const n of nodes) {
          const q = t - n.td;
          if (q < 0 || q > 0.35 || t >= TR) continue;
          f.ringL(n.p.x, n.p.y, 2 + q * 40, CORE, 1.4 * (1 - q / 0.35), 0.8);
          f.glow(n.p.x, n.p.y, 12, CORE, 1.4 * (1 - q / 0.35), 3);
        }
        if (t > 5) f.glow(G.x, G.y, 90, HALO, 0.18 * inv(5, 6.8, t) * (t < TR ? 1 : Math.exp(-(t - TR) * 2)), 4);
        if (t >= TR) {
          const q = t - TR;
          if (q < 0.12) f.discL(G.x, G.y, 12 * (1 - q / 0.12) + 3, CORE, 2.5);
          f.glow(G.x, G.y, 110, HALO, 0.8 * Math.exp(-q * 4), 5);
          if (q < 0.4) for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU + 0.1, l = 90 + hash(k + 3) * 90; drawBoltTree(f, boltTree(k * 51 + Math.floor(t * 30), G.x, G.y, G.x + Math.cos(a) * l, G.y + Math.sin(a) * l * 0.75, 2, 0.28), 2 * (1 - q / 0.4), CORE, HALO, clamp(q * 9)); }
          if (q < 0.8) shock(f, G.x, G.y, q * 260, 18, 10 * (1 - q / 0.8), 0.8, 2.5);
          const g = 1 - inv(TR + 0.5, TR + 1.8, t) * 0.6;
          for (const s of strokes) for (const p of s.pts) { f.G(p.x, p.y, 0.03, 0.03, 0.07, 0.75 * g); if (hash2(Math.round(p.x), Math.round(p.y) + Math.floor(t * 8)) > 0.8) f.Lc(p.x, p.y, VIO, 0.4 * g * Math.exp(-q * 0.8)); }
        }
        ps.render(f);
      },
    };
  },
};

export const TEMPEST: SpellDef[] = [chainVerdict, thunderloom, voltCarousel, skybreaker];
void noise3; void easeIn;
