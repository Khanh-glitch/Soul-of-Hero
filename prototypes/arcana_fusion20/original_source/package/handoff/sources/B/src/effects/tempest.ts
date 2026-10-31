import { Effect, bolt, drawBolt, Seg, ARC_CORE, ARC_MID, ARC_GLOW, sparkle } from '../engine/fx';
import { Renderer, ADD, SET, MUL, W, H } from '../engine/renderer';
import { Col, RNG, TAU, clamp, lerp, inv, smooth, easeOut, easeIn, easeInOut, hash, resample, V, pulse, fly } from '../engine/math';

const VIOLET: Col = [0.5, 0.2, 1.3];
const SCORCH: Col = [0.05, 0.05, 0.08];
const fr = (t: number, rate = 30) => Math.floor(t * rate);

/** flickering bolt, re-seeded every frame quantum */
function liveBolt(r: Renderer, seed: number, t: number, x0: number, y0: number, x1: number, y1: number, k = 1, rough = 0.3, branch = 0.4, rate = 30) {
  const segs = bolt(new RNG(seed * 7919 + fr(t, rate)), x0, y0, x1, y1, rough, branch);
  drawBolt(r, segs, k);
  return segs;
}

// =====================================================================================
// 09 — CHAIN VERDICT
// =====================================================================================
type Edge = { a: number; b: number; ts: number; split: boolean; ghost: Seg[]; ghost2: Seg[]; fails: { segs: Seg[]; stop: number }[] };
export const chainVerdict: Effect = {
  id: 9, name: 'Chain Verdict', school: 'TEMPEST', duration: 8.5, climax: 6.32,
  blurb: 'Electricity probes, fails, reroutes and remembers. Every abandoned path returns for the cascade.',
  setup(r) {
    const rng = new RNG(909);
    const nodes: V[] = [r.caster, r.anchors[5], r.anchors[3], r.anchors[0], r.anchors[1], r.anchors[2], r.anchors[4]].map((p, i) => ({ x: p.x + (i === 0 ? 5 : 0), y: p.y - (i === 0 ? 17 : 6) }));
    const order: [number, number, boolean][] = [[0, 1, false], [1, 2, false], [2, 3, true], [3, 4, false], [4, 5, false], [5, 6, true], [6, 3, false], [6, 0, false]];
    const edges: Edge[] = order.map(([a, b, split], k) => {
      const A = nodes[a], B = nodes[b];
      let ghost: Seg[], ghost2: Seg[] = [];
      if (split) {
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
        const nx = -dy / L * 26, ny = dx / L * 26;
        ghost = [...bolt(rng, A.x, A.y, mx + nx, my + ny, 0.3, 0.3, 0, 0, 0.5), ...bolt(rng, mx + nx, my + ny, B.x, B.y, 0.3, 0.3, 0, 0.5, 1)];
        ghost2 = [...bolt(rng, A.x, A.y, mx - nx, my - ny, 0.3, 0.3, 0, 0, 0.5), ...bolt(rng, mx - nx, my - ny, B.x, B.y, 0.3, 0.3, 0, 0.5, 1)];
      } else ghost = bolt(rng, A.x, A.y, B.x, B.y, 0.3, 0.5);
      const fails = Array.from({ length: 3 }, () => {
        const ang = Math.atan2(B.y - A.y, B.x - A.x) + rng.r(-0.9, 0.9);
        const L = Math.hypot(B.x - A.x, B.y - A.y) * rng.r(0.8, 1.1);
        return { segs: bolt(rng, A.x, A.y, A.x + Math.cos(ang) * L, A.y + Math.sin(ang) * L, 0.35, 0.6), stop: rng.r(0.35, 0.7) };
      });
      return { a, b, ts: 0.9 + k * 0.55 + (k > 4 ? 0.2 : 0), split, ghost, ghost2, fails };
    });
    return { nodes, edges };
  },
  render(r, t, s) {
    const nodes: V[] = s.nodes, edges: Edge[] = s.edges;
    const TC = 5.75, TF = 6.55;
    r.ambient = 0.5;
    const charged = new Array(nodes.length).fill(-1);
    edges.forEach((e) => { const tc = e.ts + 0.32; if (t > tc) { if (charged[e.b] < 0) charged[e.b] = tc; if (charged[e.a] < 0) charged[e.a] = tc; } });
    // probing discharges searching for valid paths
    nodes.forEach((n, i) => {
      if (t > TF + 0.3) return;
      const k = charged[i] >= 0 ? 0.5 : smooth(0, 0.8, t);
      for (let q = 0; q < 3; q++) {
        const sd = i * 13 + q * 101 + fr(t, 14);
        if (hash(sd) > 0.65) continue;
        const a = hash(sd + 1) * TAU, L = 6 + hash(sd + 2) * 14;
        drawBolt(r, bolt(new RNG(sd), n.x, n.y, n.x + Math.cos(a) * L, n.y + Math.sin(a) * L, 0.4, 0.2), 0.7 * k, 1, false);
      }
      // crawling surface sparks
      for (let q = 0; q < 5; q++) r.px(n.x + (hash(q + fr(t) + i) - 0.5) * 6, n.y + (hash(q * 3 + fr(t) + i) - 0.5) * 6, ARC_MID, k);
      if (charged[i] >= 0) {
        const e = t - charged[i];
        r.ring(n.x, n.y, 3 + Math.sin(t * 20 + i) * 0.6, 1, ARC_MID, 0.8);
        if (e < 0.3) r.glow(n.x, n.y, 20, ARC_MID, 1.5 * (1 - e / 0.3));
        r.light(n.x, n.y, 30, [0.5, 0.6, 1.4], 0.5);
      }
    });
    // edges: stepped leaders → return stroke → ghost
    edges.forEach((e, k) => {
      const lt = t - e.ts;
      if (lt < 0) return;
      const tc = 0.32;
      if (lt < tc) {
        const prog = Math.floor((lt / tc) * 9) / 9; // stepped leader advance
        drawBolt(r, e.ghost, 0.9, prog, false);
        if (e.split) drawBolt(r, e.ghost2, 0.9, prog, false);
        e.fails.forEach((f) => drawBolt(r, f.segs, 0.7, Math.min(prog * 1.2, f.stop), false));
      } else {
        const rs = lt - tc;
        // failed leaders collapse and leave faint filaments
        e.fails.forEach((f) => { const fk = Math.max(0, 0.6 - rs * 2) + 0.06; drawBolt(r, f.segs, fk, f.stop, false); });
        if (rs < 0.18) {
          const A = nodes[e.a], B = nodes[e.b];
          if (e.split) { drawBolt(r, e.ghost, 2.4); drawBolt(r, e.ghost2, 2.4); }
          else liveBolt(r, k + 1, t, A.x, A.y, B.x, B.y, 2.6, 0.3, 0.6);
          r.light((A.x + B.x) / 2, (A.y + B.y) / 2, 110, [0.6, 0.7, 1.6], 1.6);
          r.flash = Math.max(r.flash, 0.25 * (1 - rs / 0.18));
        } else {
          const gk = 0.16 + 0.05 * Math.sin(t * 9 + k);
          drawBolt(r, e.ghost, gk, 1, false, VIOLET, VIOLET, VIOLET);
          if (e.split) drawBolt(r, e.ghost2, gk, 1, false, VIOLET, VIOLET, VIOLET);
        }
      }
    });
    // cascading network failure: every channel (even failures) re-fires in sequence
    if (t > TC) {
      const all: Seg[][] = [];
      edges.forEach((e) => { all.push(e.ghost); if (e.split) all.push(e.ghost2); e.fails.forEach((f) => all.push(f.segs.filter((sg) => sg.d <= f.stop))); });
      all.forEach((segs, i) => {
        const ti = TC + i * 0.025;
        const k = Math.exp(-Math.max(0, t - ti) * 9) * (t > ti ? 2.2 : 0) + pulse(TF - 0.25, TF + 0.05, t) * 1.8;
        if (k > 0.05) drawBolt(r, segs, k);
      });
      const web = pulse(TF - 0.3, TF + 0.15, t);
      if (web > 0) { r.light(W / 2 + 30, H / 2, 220, [0.5, 0.6, 1.5], web * 1.5); r.ambient = 0.5 - web * 0.3; }
      if (t > TF && t < TF + 0.1) r.flash = 0.5;
    }
    // collapse: isolated sparks crawling along the scars
    if (t > TF) {
      const e = t - TF;
      edges.forEach((ed, k) => {
        for (const sg of ed.ghost) r.decalLine(sg.x0, sg.y0, sg.x1, sg.y1, SCORCH, 0.6 * (1 - smooth(1, 2.2, e)));
        for (let q = 0; q < 3; q++) {
          const sd = k * 31 + q + fr(t, 12);
          if (hash(sd) > 0.5 * (1 - e / 2)) continue;
          const sg = ed.ghost[Math.floor(hash(sd + 3) * ed.ghost.length)];
          if (sg) sparkle(r, sg.x0, sg.y0, 2, ARC_CORE, 1.2);
        }
      });
    }
  },
};

// =====================================================================================
// 10 — THUNDERLOOM
// =====================================================================================
export const thunderloom: Effect = {
  id: 10, name: 'Thunderloom', school: 'TEMPEST', duration: 8, climax: 4.06,
  blurb: 'A storm knitted from magnetic torus-knots winds itself up, reverses, and collapses into one white spear.',
  setup(r) {
    const rng = new RNG(1010);
    const C = { x: r.target.x - 20, y: r.target.y + 22 };
    const frac = Array.from({ length: 9 }, (_, k) => {
      const a = (k / 9) * TAU + rng.r(-0.3, 0.3), L = rng.r(40, 95);
      return { segs: bolt(rng, C.x, C.y, C.x + Math.cos(a) * L, C.y + Math.sin(a) * L * 0.65, 0.35, 0.7), re: 4.7 + rng.r(0, 2.2) };
    });
    const spear = bolt(rng, C.x + 4, -20, C.x, C.y, 0.06, 0.25);
    return { C, frac, spear };
  },
  render(r, t, s) {
    const C = s.C;
    const TR = 3.25, TK = 3.95;
    const e = t - TK;
    const H0 = 52;
    // rotation: accelerating wind-up, then violent reversal
    const omega = (tt: number) => (tt < TR ? 0.4 * tt + 0.55 * tt * tt : 0.4 * TR + 0.55 * TR * TR - 9 * (tt - TR) * (tt - TR) - 2 * (tt - TR));
    const Om = omega(Math.min(t, TK));
    const grow = easeOut(inv(0.4, 2.2, t));
    const collapse = 1 - easeIn(inv(TR + 0.1, TK, t));
    const S = 13 * grow * collapse;
    // gathering shadow over the point
    if (t < TK + 0.3) {
      r.shadow(C.x, C.y, 60 * grow, 26 * grow, 0.6);
      r.ambient = 0.6 - grow * 0.25;
    }
    if (t < TK) {
      // isolated sparks flashing in empty space
      for (let q = 0; q < 8; q++) {
        const sd = q + fr(t, 10) * 9;
        if (hash(sd) > 0.4) continue;
        sparkle(r, C.x + (hash(sd + 1) - 0.5) * 120, C.y - H0 + (hash(sd + 2) - 0.5) * 70, 2, ARC_MID, 0.9);
      }
      // magnetic threads: torus knots with counter-rotating families
      const knots = [[2, 3, 0], [3, 2, 1.2], [2, 5, 2.1], [3, 4, 0.6], [1, 4, 3]];
      const pts: { x: number; y: number; z: number }[][] = [];
      knots.forEach(([p, q, ph], k) => {
        const sign = k % 2 ? -1 : 1;
        const rot = Om * sign + ph;
        const arr: { x: number; y: number; z: number }[] = [];
        for (let i = 0; i < 150; i++) {
          const u = (i / 150) * TAU;
          const rr = 2 + Math.cos(q * u + t * 0.5);
          let x = rr * Math.cos(p * u), y = rr * Math.sin(p * u);
          const z = Math.sin(q * u) * 1.2;
          const xr = x * Math.cos(rot) - y * Math.sin(rot), yr = x * Math.sin(rot) + y * Math.cos(rot);
          arr.push({ x: C.x + xr * S * 1.4, y: C.y - H0 + yr * S * 0.55 - z * S * 0.8, z: yr });
        }
        pts.push(arr);
        const vis = smooth(0.3 + k * 0.25, 1.2 + k * 0.25, t);
        arr.forEach((pt, i) => {
          const pul = Math.pow(0.5 + 0.5 * Math.sin(i * 0.3 - t * 8 * sign), 10);
          const dk = 0.35 + 0.35 * (pt.z / 3 + 0.5);
          if (i % 2 === 0 || pul > 0.3) r.px(pt.x, pt.y, pul > 0.3 ? ARC_CORE : k % 2 ? VIOLET : ARC_MID, vis * dk * (0.6 + pul * 1.5));
        });
      });
      // discharges leaping between threads reveal the hidden architecture
      const nJ = Math.floor(2 + grow * 6 + (1 - collapse) * 6);
      for (let q = 0; q < nJ; q++) {
        const sd = q * 17 + fr(t, 20) * 3;
        const a = pts[Math.floor(hash(sd) * pts.length)], b = pts[Math.floor(hash(sd + 1) * pts.length)];
        const i = Math.floor(hash(sd + 2) * 150);
        if (a === b) continue;
        drawBolt(r, bolt(new RNG(sd), a[i].x, a[i].y, b[i].x, b[i].y, 0.4, 0.2), 1.1, 1, false);
      }
      // bright concentrations rotating in opposition
      for (let k = 0; k < 3; k++) {
        const a = Om * 1.6 * (k % 2 ? -1 : 1) + k * 2.1;
        const x = C.x + Math.cos(a) * S * 1.6, y = C.y - H0 + Math.sin(a) * S * 0.7;
        r.disc(x, y, 1.5 + grow, ARC_CORE, 1.4);
        r.glow(x, y, 9, ARC_MID, 0.9);
      }
      r.light(C.x, C.y - H0, 70, [0.5, 0.5, 1.4], grow * 0.6);
      if (t > TR) { r.glow(C.x, C.y - H0, 18 * (1 - collapse) + 2, ARC_CORE, (1 - collapse) * 2); }
    }
    // ---- the spear
    if (e >= 0) {
      if (e < 0.22) {
        const fl = e < 0.04 ? 1 : 0.6 + 0.4 * hash(fr(t, 60));
        drawBolt(r, s.spear, 3.2 * fl);
        for (const sg of s.spear) if (sg.w === 0) r.thick(sg.x0, sg.y0, sg.x1, sg.y1, 3, [3, 3, 3.5], fl, SET);
        r.glow(C.x, C.y, 34, [1.2, 1.4, 2.4], 1.2 * (1 - e / 0.22));
        r.flash = e < 0.035 ? 0.9 : 0;
        r.flashCol = [0.85, 0.9, 1.2];
      }
      if (e < 0.5) { r.shakeX = (hash(t * 60) - 0.5) * 8 * (1 - e * 2); r.shakeY = (hash(t * 66) - 0.5) * 6 * (1 - e * 2); }
      r.light(C.x, C.y, 180, [0.7, 0.8, 1.8], 1.6 * Math.exp(-e * 4));
      r.decalDisc(C.x, C.y, 7, SCORCH, 0.9, 0.3);
      r.ring(C.x, C.y, 3, 1, ARC_CORE, Math.exp(-e * 2) * 2, ADD, 0.65);
      // radial fractures of charge across the ground
      s.frac.forEach((f: { segs: Seg[]; re: number }, k: number) => {
        const upto = clamp(e * 7);
        for (const sg of f.segs) if (sg.d < upto) r.decalLine(sg.x0, sg.y0, sg.x1, sg.y1, SCORCH, 0.7);
        const main = Math.exp(-e * 2.5) * 1.6;
        const re = t - f.re;
        const reK = re > 0 && re < 0.25 ? (1 - re / 0.25) * 1.8 * (hash(fr(t, 40) + k) > 0.3 ? 1 : 0.2) : 0;
        drawBolt(r, f.segs, Math.max(main, reK, 0.08 * (1 - smooth(5, 8, t))), upto, main > 0.5 || reK > 0, ARC_CORE, ARC_MID, ARC_GLOW);
        if (reK > 0) { const end = f.segs[f.segs.length - 1]; r.light(end.x1, end.y1, 30, [0.6, 0.7, 1.6], reK); }
      });
      // expanding EM ring
      if (e < 0.7) r.ring(C.x, C.y, easeOut(e / 0.7) * 120, 1, VIOLET, 1 - e / 0.7, ADD, 0.65);
    }
  },
  post(r, t, s) {
    const e = t - 3.95;
    if (e < 0 || e > 0.55) return;
    const amp = 1 - e / 0.55;
    const f = fr(t, 30);
    // electromagnetic interference: torn scanline bands + channel split
    const c = r.c, tmp = r.tmp;
    tmp.set(c);
    for (let y = 0; y < H; y++) {
      const band = Math.floor(y / 3);
      const hsh = hash(band * 1.7 + f * 13.1);
      const off = hsh > 0.72 ? Math.round((hash(band + f) - 0.5) * 18 * amp) : 0;
      const split = Math.round(2 * amp);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        const sx = Math.min(W - 1, Math.max(0, x - off));
        const sr = Math.min(W - 1, sx + split), sb = Math.max(0, sx - split);
        c[i] = tmp[(y * W + sr) * 3];
        c[i + 1] = tmp[(y * W + sx) * 3 + 1];
        c[i + 2] = tmp[(y * W + sb) * 3 + 2];
      }
    }
  },
};

// =====================================================================================
// 11 — VOLT CAROUSEL
// =====================================================================================
type Ring = { R: number; n: number; kind: number; w: number; ecc: number; ef: number; ph: number; jumps: number[] };
export const voltCarousel: Effect = {
  id: 11, name: 'Volt Carousel', school: 'TEMPEST', duration: 8.5, climax: 5.08,
  blurb: 'A forbidden engine of eccentric halos. Bridges form only when segments align — until everything does.',
  setup(r) {
    const rng = new RNG(1111);
    const rings: Ring[] = [
      { R: 14, n: 3, kind: 2, w: 2.4, ecc: 6, ef: 1.3, ph: 0, jumps: [] },
      { R: 26, n: 6, kind: 0, w: -1.5, ecc: 10, ef: -0.9, ph: 1, jumps: [] },
      { R: 38, n: 6, kind: 1, w: 1.0, ecc: 14, ef: 0.7, ph: 2, jumps: [] },
      { R: 52, n: 12, kind: 0, w: -0.7, ecc: 8, ef: -1.1, ph: 3, jumps: [] },
      { R: 66, n: 6, kind: 2, w: 0.5, ecc: 18, ef: 0.5, ph: 4, jumps: [] },
    ];
    rings.forEach((g) => (g.jumps = Array.from({ length: 4 }, () => rng.r(2.4, 4.4)).sort()));
    return { rings };
  },
  render(r, t, s) {
    const C = { x: r.caster.x + 58, y: r.caster.y - 24 };
    const TA = 4.95;
    const e = t - TA;
    const rings: Ring[] = s.rings;
    const form = (k: number) => easeOut(inv(0.2 + k * 0.2, 0.9 + k * 0.2, t));
    const settle = smooth(4.3, TA, t);
    const energy = smooth(1.5, TA, t);
    const frame = (g: Ring, k: number, tt: number) => {
      let jump = 0, rj = 0;
      g.jumps.forEach((jt, q) => { const st = smooth(jt, jt + 0.08, tt); jump += st * (q % 2 ? -1.3 : 0.9); rj += st * (q % 2 ? -7 : 6); });
      const unstable = 1 - settle;
      const A = g.w * (tt - TA) * (1 + energy * 0.6 * unstable) + (jump + g.ph * 0.4) * unstable + (k % 2 ? 0 : Math.PI / g.n) * 0;
      const cx = C.x + Math.cos(tt * g.ef + g.ph) * g.ecc * unstable;
      const cy = C.y + Math.sin(tt * g.ef + g.ph) * g.ecc * 0.6 * unstable;
      return { A, cx, cy, R: (g.R + rj * unstable) * (0.4 + 0.6 * form(k)) };
    };
    const nodesOf = (g: Ring, k: number) => {
      const f = frame(g, k, Math.min(t, TA));
      return Array.from({ length: g.n }, (_, j) => {
        const a = f.A + (j / g.n) * TAU;
        return { x: f.cx + Math.cos(a) * f.R, y: f.cy + Math.sin(a) * f.R * 0.6, a, f };
      });
    };
    r.ambient = 0.55 - energy * 0.15;
    r.light(C.x, C.y, 90, [0.5, 0.6, 1.5], 0.4 + energy * 0.8);
    if (e < 0) {
      const all = rings.map((g, k) => nodesOf(g, k));
      // the machine's bodies
      rings.forEach((g, k) => {
        const fk = form(k);
        if (fk <= 0) return;
        const ns = all[k], f = ns[0].f;
        if (g.kind === 0) {
          // segmented halo: arcs between alternate nodes
          for (let j = 0; j < g.n; j += 2) {
            const a0 = f.A + (j / g.n) * TAU, a1 = f.A + ((j + 1) / g.n) * TAU;
            for (let a = a0; a < a1; a += 0.03) r.px(f.cx + Math.cos(a) * f.R, f.cy + Math.sin(a) * f.R * 0.6, ARC_MID, fk * (0.7 + energy * 0.5));
          }
        } else if (g.kind === 1) {
          // broken crown: teeth spikes outward
          for (let j = 0; j < g.n; j++) {
            const a = ns[j].a;
            r.line(ns[j].x, ns[j].y, ns[j].x + Math.cos(a) * 7, ns[j].y + Math.sin(a) * 4.2 - 4, VIOLET, fk * 1.4);
            const a2 = a + TAU / g.n * 0.5;
            if (j % 3 !== 2) for (let aa = a; aa < a2; aa += 0.04) r.px(f.cx + Math.cos(aa) * f.R, f.cy + Math.sin(aa) * f.R * 0.6, VIOLET, fk);
          }
        } else {
          // gear polygon with notches
          const pts: number[] = [];
          for (let j = 0; j < g.n * 4; j++) {
            const a = f.A + (j / (g.n * 4)) * TAU;
            const rr = f.R * (j % 4 < 2 ? 1 : 0.82);
            pts.push(f.cx + Math.cos(a) * rr, f.cy + Math.sin(a) * rr * 0.6);
          }
          r.polyline(pts, ARC_MID, fk * 0.8, ADD, true);
        }
        ns.forEach((n) => { r.disc(n.x, n.y, 1.2, ARC_CORE, fk * 1.2); });
      });
      // bridges whenever compatible segments align
      const thr = 7 + energy * 9;
      let count = 0;
      for (let k = 0; k < rings.length - 1; k++)
        for (const a of all[k])
          for (const b of all[k + 1]) {
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < thr && count < 40) {
              count++;
              liveBolt(r, k * 100 + Math.floor(a.a * 10) + Math.floor(b.a * 7), t, a.x, a.y, b.x, b.y, 1.3 * (1 - d / thr) + 0.3, 0.35, 0.2, 24);
            }
          }
      // longer discharges as the engine destabilises
      if (energy > 0.4) {
        for (let q = 0; q < 2; q++) {
          const sd = q * 9 + fr(t, 8) * 5;
          if (hash(sd) > energy * 0.7) continue;
          const A = all[Math.floor(hash(sd + 1) * 5)], B = all[Math.floor(hash(sd + 2) * 5)];
          const a = A[Math.floor(hash(sd + 3) * A.length)], b = B[Math.floor(hash(sd + 4) * B.length)];
          liveBolt(r, sd, t, a.x, a.y, b.x, b.y, 1.5, 0.35, 0.5, 30);
        }
      }
    } else {
      // ---- critical synchronisation
      const all = rings.map((g, k) => nodesOf(g, k));
      const blaze = Math.exp(-e * 3);
      if (e < 0.5) {
        for (let k = 0; k < rings.length - 1; k++)
          for (const a of all[k])
            for (const b of all[k + 1]) {
              const da = Math.abs(((a.a - b.a) % TAU + TAU + Math.PI) % TAU - Math.PI);
              if (da < 0.05) liveBolt(r, k * 31 + Math.floor(a.a * 10), t, a.x, a.y, b.x, b.y, 2.4 * blaze + 0.5, 0.25, 0.3, 40);
            }
        rings.forEach((g, k) => { const ns = all[k]; for (let j = 0; j < ns.length; j++) { const n2 = ns[(j + 1) % ns.length]; r.line(ns[j].x, ns[j].y, n2.x, n2.y, ARC_CORE, 1.6 * blaze); } });
        // interlocking burst discharges outward
        for (let q = 0; q < 12; q++) {
          const a = (q / 12) * TAU;
          const L = 66 + easeOut(e / 0.3) * 80;
          liveBolt(r, 500 + q, t, C.x + Math.cos(a) * 66, C.y + Math.sin(a) * 40, C.x + Math.cos(a) * L, C.y + Math.sin(a) * L * 0.6, 1.8 * blaze, 0.3, 0.5, 30);
        }
        r.glow(C.x, C.y, 28, ARC_CORE, 1.0 * blaze);
        r.flash = e < 0.06 ? 0.7 : 0;
        r.shakeX = (hash(t * 40) - 0.5) * 6 * blaze;
      }
      r.light(C.x, C.y, 170, [0.6, 0.7, 1.7], 2 * blaze);
      // components fracture into charged fragments still rotating
      rings.forEach((g, k) => {
        const f = all[k][0].f;
        for (let j = 0; j < g.n; j++) {
          const a0 = (j / g.n) * TAU + g.w * e * 1.5;
          const rr = f.R + fly(0, 40 + k * 10, 1.5, 0, e);
          const life = 1 - smooth(0.8, 2.2, e);
          if (life <= 0) continue;
          const span = (TAU / g.n) * 0.55;
          for (let a = a0; a < a0 + span; a += 0.05) r.px(C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * 0.6 + e * e * 10, k % 2 ? VIOLET : ARC_MID, life * 1.2);
          if (hash(j + k * 13 + fr(t, 15)) > 0.75) sparkle(r, C.x + Math.cos(a0) * rr, C.y + Math.sin(a0) * rr * 0.6 + e * e * 10, 2, ARC_CORE, life);
        }
      });
    }
  },
};

// =====================================================================================
// 12 — SKYBREAKER SCRIPT
// =====================================================================================
type Stroke = { p: V[]; len: number[]; total: number; ts: number; dur: number; burst: boolean; level: number; fate: number };
export const skybreakerScript: Effect = {
  id: 12, name: 'Skybreaker Script', school: 'TEMPEST', duration: 9.5, climax: 7.0,
  blurb: 'A spark writes an asymmetric glyph that then behaves like a circuit — forking, overloading, detonating.',
  setup(r) {
    const rng = new RNG(1212);
    const G = { x: W / 2 + 30, y: H / 2 - 2 };
    const arc: number[][] = [];
    for (let a = 200; a <= 340; a += 10) arc.push([Math.cos((a * Math.PI) / 180) * 76, Math.sin((a * Math.PI) / 180) * 76 + 18]);
    const defs: [number[][], boolean, number, number][] = [
      [[[0, -64], [0, 60]], true, 0, 0],
      [[[-54, -18], [-8, -30], [48, -14]], false, 1, 0],
      [[[0, -46], [14, -32], [0, -18], [-14, -32], [0, -46]], false, 1, 2],
      [[[-60, 8], [-36, 28], [-52, 44], [-24, 54]], false, 2, 1],
      [[[0, 10], [30, 20], [52, 4], [66, 28]], true, 1, 0],
      [arc, false, 2, 2],
      [[[18, 38], [40, 56], [60, 44]], true, 2, 1],
      [[[-34, -50], [-22, -64], [-12, -48], [-34, -50]], false, 2, 0],
      [[[-44, 64], [44, 64]], true, 1, 0],
      [[[-74, -26], [-62, -38], [-70, -50], [-56, -62]], false, 3, 2],
      [[[22, -40], [36, -56], [52, -44], [70, -58]], false, 3, 0],
    ];
    let tcur = 0.4;
    const strokes: Stroke[] = defs.map(([pts, burst, level, fate]) => {
      const rs = resample(pts.map(([x, y]) => ({ x: G.x + x * 1.05, y: G.y + y * 0.85 })), 1);
      const dur = burst ? 0.06 : 0.25 + rs.total / 260;
      const st: Stroke = { p: rs.p, len: rs.len, total: rs.total, ts: tcur, dur, burst, level, fate };
      tcur += dur + rng.r(0.08, 0.3);
      return st;
    });
    return { G, strokes, buildEnd: tcur };
  },
  render(r, t, s) {
    const G = s.G, strokes: Stroke[] = s.strokes;
    const TCIR = 4.9, TDET = 6.55, TRUP = 7.25;
    r.ambient = 0.5 - smooth(4, 6, t) * 0.12;
    let pen: V | null = null;
    strokes.forEach((S, si) => {
      const u = clamp((t - S.ts) / S.dur);
      if (t < S.ts) return;
      const ta = TCIR + S.level * 0.3 + (si % 3) * 0.05;
      const act = t - ta;
      const shown = S.total * (S.burst ? 1 : easeInOut(u));
      // fates after activation: 1 = overload & fracture, 2 = fold inward along jagged path
      const fold = S.fate === 2 ? easeIn(inv(ta + 0.4, ta + 1.1, t)) : 0;
      const frac = S.fate === 1 ? smooth(ta + 0.45, ta + 0.5, t) : 0;
      for (let i = 0; i < S.p.length; i++) {
        if (S.len[i] > shown) { pen = S.p[i]; break; }
        let x = S.p[i].x, y = S.p[i].y;
        if (fold > 0) {
          const jag = (hash(i >> 3) - 0.5) * 10 * Math.sin(fold * Math.PI);
          x = lerp(x, G.x, fold) + jag; y = lerp(y, G.y, fold) - jag * 0.5;
        }
        let fk = 1;
        if (frac > 0) {
          const piece = Math.floor(i / 7);
          const ee = t - (ta + 0.45);
          x += (hash(piece) - 0.5) * ee * 50; y += fly(0, -20 - hash(piece + 3) * 30, 0, 120, ee);
          fk = 1 - smooth(0.4, 1.4, ee);
          if (i % 7 === 0) continue;
        }
        if (t > TRUP) fk *= 0;
        // trembling micro-discharges on the stroke edges
        if (hash(i * 7 + fr(t, 24)) > 0.9) { x += hash(i + fr(t)) > 0.5 ? 1 : -1; }
        const flow = Math.pow(0.5 + 0.5 * Math.sin(S.len[i] * 0.35 - t * 22), 8);
        let k = 0.6 + flow * 1.4;
        if (act > 0) {
          const head = (act / 0.25) * S.total;
          const hk = Math.exp(-Math.abs(S.len[i] - head) * 0.15);
          k += (S.len[i] < head ? 0.9 : 0) + hk * 2.5;
        }
        const fresh = Math.exp(-(t - S.ts - (S.len[i] / S.total) * S.dur) * 6);
        r.px(x, y, flow > 0.5 || fresh > 0.3 ? ARC_CORE : ARC_MID, k * fk + fresh * 2);
        if (i % 2 === 0) { r.px(x + 1, y, ARC_GLOW, 0.5 * k * fk); r.px(x, y + 1, ARC_GLOW, 0.4 * k * fk); }
      }
      if (S.burst && t - S.ts < 0.12) {
        drawBolt(r, bolt(new RNG(si * 33 + fr(t, 40)), S.p[0].x, S.p[0].y, S.p[S.p.length - 1].x, S.p[S.p.length - 1].y, 0.12, 0.6), 2);
        r.light(G.x, G.y, 120, [0.6, 0.7, 1.6], 1.2);
      }
      if (u < 1 && !S.burst && pen) {
        // slow trace: branching filament from the pen
        sparkle(r, pen.x, pen.y, 3, ARC_CORE, 1.6);
        const prev = strokes[si - 1];
        if (prev) { const pe = prev.p[prev.p.length - 1]; drawBolt(r, bolt(new RNG(si * 7 + fr(t, 30)), pe.x, pe.y, pen.x, pen.y, 0.35, 0.4), 0.5, 1, false); }
        r.light(pen.x, pen.y, 40, [0.6, 0.7, 1.6], 0.8);
      }
    });
    // misfires toward unformed sections
    if (t < s.buildEnd) {
      const done = strokes.filter((S) => t > S.ts + S.dur), todo = strokes.filter((S) => t < S.ts);
      const sd = fr(t, 5);
      if (done.length && todo.length && hash(sd * 3.3) > 0.4 && (t * 5) % 1 < 0.35) {
        const a = done[Math.floor(hash(sd) * done.length)], b = todo[Math.floor(hash(sd + 1) * todo.length)];
        const pa = a.p[Math.floor(hash(sd + 2) * a.p.length)], pb = b.p[Math.floor(hash(sd + 3) * b.p.length)];
        drawBolt(r, bolt(new RNG(sd * 11 + fr(t, 30)), pa.x, pa.y, lerp(pa.x, pb.x, 0.8), lerp(pa.y, pb.y, 0.8), 0.4, 0.4), 1.2);
      }
    }
    // circuit glow
    if (t > TCIR && t < TRUP) r.light(G.x, G.y, 140, [0.5, 0.6, 1.5], 0.4 + smooth(TCIR, TRUP, t) * 1.2);
    // local detonation sequence from outside in
    if (t > TDET) {
      strokes.forEach((S, si) => {
        if (S.fate === 1) return;
        for (let i = 0; i < S.p.length; i += 9) {
          const p = S.p[i];
          const d = Math.hypot(p.x - G.x, p.y - G.y);
          const td = TDET + (1 - d / 90) * 0.6 + hash(i + si) * 0.08;
          const ee = t - td;
          if (ee < 0 || ee > 0.35) continue;
          const k = 1 - ee / 0.35;
          r.ring(p.x, p.y, 1 + ee * 22, 1, ARC_CORE, k * 1.4);
          r.disc(p.x, p.y, 2.5 * k, ARC_CORE, k * 2);
          for (let q = 0; q < 5; q++) { const a = hash(i * 5 + q) * TAU; r.px(p.x + Math.cos(a) * ee * 40, p.y + Math.sin(a) * ee * 40, ARC_MID, k * 1.5); }
          r.decalDisc(p.x, p.y, 2.5, SCORCH, 0.7);
        }
      });
    }
    // overwhelming rupture
    if (t > TRUP) {
      const e = t - TRUP;
      const k = Math.exp(-e * 3);
      if (e < 0.05) r.flash = 0.6;
      if (e < 0.6) { r.shakeX = (hash(t * 50) - 0.5) * 10 * (1 - e / 0.6); r.shakeY = (hash(t * 57) - 0.5) * 8 * (1 - e / 0.6); }
      r.glow(G.x, G.y, 36, ARC_CORE, 1.2 * k);
      r.disc(G.x, G.y, 6 * k, [3, 3, 3.5], 2);
      for (let q = 0; q < 14; q++) {
        const a = (q / 14) * TAU + hash(q) * 0.3, L = 50 + hash(q + 1) * 90;
        drawBolt(r, bolt(new RNG(q * 77 + fr(t, 20)), G.x, G.y, G.x + Math.cos(a) * L, G.y + Math.sin(a) * L * 0.7, 0.3, 0.6), 2 * k, clamp(e * 6));
      }
      r.ring(G.x, G.y, easeOut(e / 0.8) * 160, 2, ARC_MID, (1 - clamp(e / 0.8)) * 1.5, ADD, 0.75);
      r.light(G.x, G.y, 220, [0.6, 0.7, 1.7], 1.4 * k);
      // the glyph remains, burnt into the floor
      strokes.forEach((S) => { for (let i = 0; i < S.p.length; i += 1) r.decal(S.p[i].x, S.p[i].y, SCORCH, 0.7 * (1 - smooth(1.2, 2.2, e))); });
      for (let i = 0; i < 30; i++) {
        const ee = e - hash(i) * 1.5;
        if (ee < 0 || ee > 0.6) continue;
        const S = strokes[i % strokes.length], p = S.p[Math.floor(hash(i + 4) * S.p.length)];
        sparkle(r, p.x, p.y, 2, ARC_MID, 1 - ee / 0.6);
      }
    }
  },
  post(r, t) {
    const e = t - 7.25;
    if (e < 0 || e > 0.9) return;
    const G = { x: W / 2 + 30, y: H / 2 - 2 };
    const R = easeOut(e / 0.8) * 160, A = 4 * (1 - e / 0.9);
    r.warp(0, 0, W - 1, H - 1, (x, y, o) => {
      const dx = x - G.x, dy = (y - G.y) / 0.75, d = Math.hypot(dx, dy) || 1;
      const k = Math.exp(-Math.pow((d - R) / 7, 2)) * A;
      if (k < 0.4) return;
      o[0] = x - (dx / d) * k; o[1] = y - (dy / d) * k;
    });
  },
};

export const TEMPEST = [chainVerdict, thunderloom, voltCarousel, skybreakerScript];
void MUL; void easeInOut;
