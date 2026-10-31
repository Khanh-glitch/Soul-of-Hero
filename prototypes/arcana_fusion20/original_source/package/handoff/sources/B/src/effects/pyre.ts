import { Effect, crackTree, Crack, flick, sparkle } from '../engine/fx';
import { Renderer, ADD, SET, DITHER, W, H } from '../engine/renderer';
import {
  Col, RNG, TAU, clamp, lerp, inv, smooth, easeOut, easeIn, easeInOut, easeOutExpo, easeOutBack, ramp, scale,
  noise1, hash, fly, catmull, shardShape, shardPts, V, pulse,
} from '../engine/math';

export const FIRE: Col[] = [
  [0.0, 0.0, 0.0], [0.3, 0.02, 0.03], [0.85, 0.07, 0.04], [1.6, 0.48, 0.06], [2.2, 1.35, 0.3], [3.0, 2.7, 2.0],
];
const fire = (h: number, k = 1) => scale(ramp(FIRE, h), k);
const CHAR: Col = [0.03, 0.02, 0.02];
const ASH: Col = [0.35, 0.32, 0.3];

/** living tongue of flame: layered polygon with independent sway */
function tongue(r: Renderer, x: number, y: number, h: number, w: number, t: number, seed: number, heat = 1, k = 1) {
  if (h < 1) return;
  const sw = (noise1(t * 7 + seed * 13) - 0.5) * w * 2.4;
  const sw2 = (noise1(t * 11 + seed * 7) - 0.5) * w;
  const hh = h * (0.75 + 0.5 * noise1(t * 9 + seed * 3));
  const layer = (s: number, c: Col, kk: number) => {
    const ww = w * s, H2 = hh * (0.4 + s * 0.6);
    r.poly([x - ww, y, x - ww * 0.8 + sw2 * 0.5, y - H2 * 0.45, x + sw * s, y - H2, x + ww * 0.7 + sw2, y - H2 * 0.5, x + ww, y], c, kk);
  };
  layer(1, fire(0.4 * heat + 0.1), 0.9 * k);
  layer(0.62, fire(0.65 * heat + 0.1), 0.8 * k);
  layer(0.3, fire(0.95 * heat), 0.8 * k);
}

// =====================================================================================
// 01 — CINDER CROWN
// =====================================================================================
type Frag = { a0: number; w: number; rad: number; size: number; fast: boolean; tail: boolean; tilt: number; seed: number };
type Petal = { a: number; L: number; w: number; curl: number; seed: number };
type Shard = { a: number; v: number; kind: number; rot: number; spin: number; size: number; shape: number[]; delay: number; seed: number };

export const cinderCrown: Effect = {
  id: 1, name: 'Cinder Crown', school: 'PYRE', duration: 9, climax: 4.66,
  blurb: 'An unstable crown of embers swallows its own light, then unfolds into remembered solar petals.',
  setup(r) {
    const rng = new RNG(101);
    const frags: Frag[] = [];
    for (let i = 0; i < 11; i++)
      frags.push({
        a0: (i / 11) * TAU + rng.r(-0.15, 0.15), w: rng.r(0.7, 1.4) * (i % 2 ? 1 : -1) * (i % 5 === 0 ? 4.5 : 1),
        rad: rng.r(28, 38), size: rng.r(5, 9), fast: i % 5 === 0, tail: i % 3 === 1, tilt: rng.r(-0.5, 0.5), seed: i,
      });
    const embers = Array.from({ length: 110 }, (_, i) => ({
      sx: rng.r(-150, 150), sy: rng.r(-100, 100), slot: rng.r(0, TAU), rr: rng.r(10, 44), bend: rng.r(-1, 1) * 60, d: rng.r(0, 0.5), seed: i,
    }));
    const petals: Petal[] = [];
    let a = rng.r(0, TAU);
    for (let i = 0; i < 8; i++) {
      a += rng.r(0.5, 1.15);
      petals.push({ a, L: rng.r(55, 150) * (i % 3 === 0 ? 1.15 : 0.85), w: rng.r(0.18, 0.36), curl: rng.r(-0.7, 0.7), seed: i });
    }
    const shards: Shard[] = Array.from({ length: 70 }, (_, i) => ({
      a: rng.r(0, TAU), v: rng.r(60, 230), kind: i % 3, rot: rng.r(0, TAU), spin: rng.r(-12, 12), size: rng.r(1.5, 4.5),
      shape: shardShape(rng, rng.i(3, 5)), delay: rng.r(0, 0.25), seed: i,
    }));
    const cracks: Crack[] = crackTree(rng, 0, 0, 11, 70, 0.35, 3);
    return { frags, embers, petals, shards, cracks };
  },
  render(r, t, s) {
    const cx = r.target.x, gy = r.target.y + 6, cy = gy - 20;
    const T0 = 3.7, TX = 4.55;
    const build = smooth(0.9, 1.7, t);
    const swallow = inv(T0, TX, t);
    const e = t - TX;
    const fragPos = (f: Frag, tt: number) => {
      const shrink = 1 - easeIn(inv(T0, TX, tt)) * 0.55;
      const accel = tt > T0 ? (tt - T0) * (tt - T0) * 6 * Math.sign(f.w) : 0;
      const ang = f.a0 + f.w * tt + accel;
      const rr = f.rad * shrink * (1 + 0.07 * Math.sin(tt * 3 + f.seed)) * lerp(1.6, 1, build);
      return { x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr * 0.5, z: Math.sin(ang), ang };
    };

    // ---- ground: crown shadow & lights
    if (t < TX) {
      r.ambient = 0.62 * (1 - easeIn(swallow) * 0.85);
      r.shadow(cx, gy, 40, 14, 0.5 * build);
      r.light(cx, cy, 80, [1.2, 0.5, 0.15], (0.4 + build * 0.8) * (1 - swallow));
    }

    // ---- gather phase: embers spiral into orbit slots
    if (t < 2.2) {
      for (const m of s.embers) {
        const u = easeInOut(inv(m.d, m.d + 1.1, t));
        const ang = m.slot + t * 1.5;
        const tx = cx + Math.cos(ang) * m.rr, ty = cy + Math.sin(ang) * m.rr * 0.5;
        const px = lerp(cx + m.sx, tx, u) + Math.sin(u * Math.PI) * m.bend * 0.3;
        const py = lerp(cy + m.sy, ty, u) - Math.sin(u * Math.PI) * m.bend * 0.2;
        const k = (1 - smooth(1.5, 2.2, t)) * (0.5 + flick(m.seed, t) * 0.8);
        r.px(px, py, fire(0.55 + u * 0.4), k * 1.4);
        if (u > 0.05 && u < 0.95) r.px(px - Math.cos(ang) * 1.5, py, fire(0.4), k * 0.6);
      }
    }

    // ---- crown
    if (t < TX + 0.02) {
      const frs = s.frags.map((f: Frag) => ({ f, p: fragPos(f, t) })).sort((a: any, b: any) => a.p.z - b.p.z);
      // inner architecture
      const arch = smooth(1.6, 2.8, t) * (1 - swallow * 0.6);
      if (arch > 0) {
        for (const { f, p } of frs) {
          // heated spokes with travelling pulses
          const n = 14;
          for (let k = 0; k < n; k++) {
            const u = k / n;
            const x = lerp(cx, p.x, u), y = lerp(cy, p.y, u);
            const pul = Math.pow(0.5 + 0.5 * Math.sin(u * 12 - t * 14 + f.seed), 6);
            if ((k + Math.floor(t * 20)) % 3 || pul > 0.5) r.px(x, y, fire(0.5 + pul * 0.5), arch * (0.4 + pul));
          }
        }
        // burning filaments between neighbours, sagging
        for (let i = 0; i < s.frags.length; i++) {
          const a = fragPos(s.frags[i], t), b = fragPos(s.frags[(i + 2) % s.frags.length], t);
          for (let k = 0; k <= 20; k++) {
            const u = k / 20;
            const x = lerp(a.x, b.x, u), y = lerp(a.y, b.y, u) + Math.sin(u * Math.PI) * 6;
            r.px(x, y, fire(0.6), arch * 0.5 * flick(i * 40 + k, t, 10));
          }
        }
        // tiny revolving suns
        for (let k = 0; k < 4; k++) {
          const ang = t * (3 + k) * (k % 2 ? -1 : 1) + k * 1.6;
          const rr = 9 + k * 3;
          const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.5;
          r.disc(x, y, 1.6, fire(0.95), arch * 1.5);
          r.glow(x, y, 6, fire(0.7), arch * 0.6);
        }
      }
      // fragments
      for (const { f, p } of frs) {
        const depthK = 0.55 + 0.45 * (p.z * 0.5 + 0.5);
        const sz = f.size * build;
        if (sz < 0.5) continue;
        if (f.fast && t < T0) {
          // stroboscopic ring of light
          for (let k = 0; k < 26; k++) {
            const q = fragPos(f, t - k * 0.008);
            const kk = (1 - k / 26) * build;
            r.px(q.x, q.y - sz * 0.5, fire(0.9), kk * 1.4 * depthK);
            if (k % 4 === 0) r.px(q.x, q.y - sz * 0.5 - 1, fire(0.7), kk * 0.8);
          }
        }
        if (f.tail) {
          for (let k = 1; k < 18; k++) {
            const q = fragPos(f, t - k * 0.025);
            r.disc(q.x, q.y - 2 + k * 0.4, Math.max(0.5, 2.2 - k * 0.12), fire(0.75 - k * 0.03), (1 - k / 18) * build * depthK);
          }
        }
        // crown tooth (points up), local tilt wobble
        const tilt = f.tilt + Math.sin(t * 5 + f.seed) * 0.15;
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        const P = (lx: number, ly: number) => [p.x + lx * ct - ly * st, p.y + lx * st + ly * ct];
        const pts = [...P(-sz * 0.55, 0), ...P(-sz * 0.6, -sz * 0.5), ...P(-sz * 0.2, -sz * 0.75), ...P(0, -sz * 1.5), ...P(sz * 0.25, -sz * 0.8), ...P(sz * 0.6, -sz * 0.55), ...P(sz * 0.5, 0)];
        if (swallow > 0) {
          // swallowing: interior goes black, outline becomes impossible
          const ink = smooth(0, 0.7, swallow);
          r.poly(pts, mixDark(fire(0.75), ink), 1, SET);
          r.polyline(pts, [3, 2.6, 2.2], 0.5 + swallow * 3, ADD, true);
        } else {
          r.poly(pts, fire(0.45), 1.0 * depthK);
          const inner = [...P(-sz * 0.3, -sz * 0.1), ...P(0, -sz * 1.1), ...P(sz * 0.25, -sz * 0.1)];
          r.poly(inner, fire(0.85 + 0.15 * flick(f.seed, t)), 1.1 * depthK);
          r.polyline(pts, fire(0.7), 0.7 * depthK, ADD, true);
        }
      }
      // swallow: light being dragged into the shrinking centre
      if (swallow > 0) {
        for (let k = 0; k < 70; k++) {
          const ph = (hash(k) + t * 1.8) % 1;
          const a = hash(k + 9) * TAU;
          const rr = (1 - ph * ph) * 60 * (1 - swallow * 0.3);
          r.px(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.5, fire(0.8), 0.6 + ph);
        }
        const core = 3 * (1 - swallow) + 0.6;
        r.disc(cx, cy, core, [3, 3, 3], 3);
        r.glow(cx, cy, 10 + swallow * 8, [2, 1.6, 1.2], swallow * 1.5);
      }
    }

    // ---- release
    if (e >= 0) {
      r.flash = Math.max(0, 0.9 - e * 9);
      r.flashCol = [1.2, 0.9, 0.7];
      if (e < 0.5) { r.shakeX = (hash(t * 99) - 0.5) * 8 * (1 - e * 2); r.shakeY = (hash(t * 77) - 0.5) * 6 * (1 - e * 2); }
      r.ambient = lerp(0.12, 0.62, smooth(0.2, 3, e));
      const heat = Math.exp(-e * 1.1);
      r.light(cx, cy, 170, [1.4, 0.6, 0.2], 2.2 * heat);
      // scorch memory: crown-teeth burnt into floor + fractures
      for (const c of s.cracks as Crack[]) {
        if (c.d > e * 3) continue;
        r.decalLine(cx + c.x0, gy + c.y0 * 0.6, cx + c.x1, gy + c.y1 * 0.6, CHAR, 0.8);
        const g = Math.exp(-e * 1.4) * (1 - c.d * 0.6);
        if (g > 0.05) r.line(cx + c.x0, gy + c.y0 * 0.6, cx + c.x1, gy + c.y1 * 0.6, fire(0.4 + g * 0.6), g * 1.4);
      }
      r.decalDisc(cx, gy, 16, CHAR, 0.7, 0.3);
      // solar petals: layered, peeling, curling, asymmetrical
      for (const p of s.petals as Petal[]) {
        const grow = easeOutExpo(e / 0.45);
        for (let layer = 0; layer < 4; layer++) {
          const peel = Math.max(0, e - 0.25 - layer * 0.18) * (30 + layer * 25) * (layer % 2 ? 1 : 0.6);
          const fade = clamp(1 - Math.max(0, e - 0.6 - layer * 0.35) * 0.9);
          if (fade <= 0) continue;
          const wS = [1, 0.75, 0.5, 0.25][layer], lS = [1, 0.9, 0.75, 0.55][layer];
          const L = p.L * grow * lS;
          const pts: number[] = [];
          const side = (sgn: number) => {
            for (let k = 0; k <= 12; k++) {
              const u = sgn > 0 ? k / 12 : 1 - k / 12;
              const half = p.w * wS * Math.sin(Math.PI * Math.pow(u, 0.6)) * (1 - u * 0.35);
              const jag = (noise1(u * 9 + p.seed * 5 + e * 3 + layer) - 0.5) * 0.18;
              const a = p.a + p.curl * u * u * (0.4 + e) + sgn * (half + jag * wS);
              const rr = 4 + u * L + peel;
              pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.72);
            }
          };
          side(1); side(-1);
          const h = clamp(heat * (0.5 + layer * 0.2) + 0.15);
          r.poly(pts, fire(h * 0.85), (layer === 0 ? 0.75 : 0.45) * fade, layer === 0 ? SET : ADD);
        }
      }
      // shards: outward / curving back / suspended → ash
      for (const sh of s.shards as Shard[]) {
        const ee = e - sh.delay;
        if (ee < 0) continue;
        let x: number, y: number, k = 1;
        if (sh.kind === 0) {
          x = cx + Math.cos(sh.a) * fly(0, sh.v, 2.2, 0, ee);
          y = cy + Math.sin(sh.a) * fly(0, sh.v, 2.2, 0, ee) * 0.72 + fly(0, -20, 0, 70, ee);
          k = clamp(1.8 - ee * 0.7);
        } else if (sh.kind === 1) {
          const ang = sh.a + ee * 2.6 * (sh.seed % 2 ? 1 : -1);
          const rr = Math.sin(clamp(ee / 1.6) * Math.PI) * sh.v * 0.55;
          x = cx + Math.cos(ang) * rr; y = cy + Math.sin(ang) * rr * 0.72;
          k = clamp(2 - ee);
        } else {
          const rr = fly(0, sh.v * 0.8, 6, 0, ee);
          x = cx + Math.cos(sh.a) * rr; y = cy + Math.sin(sh.a) * rr * 0.72;
          const dis = inv(1.0 + (sh.seed % 7) * 0.12, 2.0 + (sh.seed % 7) * 0.12, ee);
          if (dis > 0) {
            for (let q = 0; q < 6; q++) {
              const ax = x + (hash(sh.seed * 7 + q) - 0.5) * 10 * dis + Math.sin(ee * 3 + q) * 2;
              const ay = y - dis * (8 + q * 4);
              r.px(ax, ay, dis < 0.3 ? fire(0.5) : ASH, (1 - dis) * 0.8);
            }
            k = 1 - dis;
          }
        }
        if (k <= 0) continue;
        const pts = shardPts(sh.shape, x, y, sh.size, sh.rot + sh.spin * ee);
        r.poly(pts, fire(clamp(heat + 0.3)), k);
        r.px(x, y, fire(1), k * 0.8);
      }
      // the explosion remembers the crown: ghost teeth at frozen positions
      const mem = pulse(0.35, 3.2, e);
      if (mem > 0) {
        for (const f of s.frags as Frag[]) {
          const p = fragPos(f, TX);
          const rr = 1 + e * 0.35;
          const x = cx + (p.x - cx) * rr * 1.8, y = cy + (p.y - cy) * rr * 1.8;
          const sz = f.size * 1.2;
          const pts = [x - sz * 0.55, y, x - sz * 0.6, y - sz * 0.5, x - sz * 0.2, y - sz * 0.75, x, y - sz * 1.5, x + sz * 0.25, y - sz * 0.8, x + sz * 0.6, y - sz * 0.55, x + sz * 0.5, y];
          if (flick(f.seed, t, 12) > 0.25) r.polyline(pts, fire(0.75), mem * 1.1, ADD, true);
        }
        r.ring(cx, cy, 34 * 1.8 * (1 + e * 0.35), 1, fire(0.6), mem * 0.4, ADD, 0.5);
      }
      // rising embers in aftermath
      for (let k = 0; k < 40; k++) {
        const st = 0.3 + hash(k) * 3;
        const ee2 = e - st;
        if (ee2 < 0 || ee2 > 2.5) continue;
        const x = cx + (hash(k + 1) - 0.5) * 140 + Math.sin(ee2 * 2 + k) * 6;
        const y = cy + (hash(k + 2) - 0.5) * 60 - ee2 * 22;
        r.px(x, y, fire(0.7), (1 - ee2 / 2.5) * flick(k, t) * 1.5);
      }
    }
  },
};
function mixDark(c: Col, ink: number): Col {
  return [c[0] * (1 - ink) * 0.4, c[1] * (1 - ink) * 0.4, c[2] * (1 - ink) * 0.4];
}

// =====================================================================================
// 02 — FURNACE WYRM
// =====================================================================================
export const furnaceWyrm: Effect = {
  id: 2, name: 'Furnace Wyrm', school: 'PYRE', duration: 7.6, climax: 5.12,
  blurb: 'A serpent assembled from delayed time: every segment is the head, a moment ago.',
  setup(r) {
    const rng = new RNG(202);
    const C = r.caster, T = r.target;
    const orbit = (tt: number) => {
      const u = tt - 2.1;
      const ang = 2.6 + u * 3.1;
      const rad = 50 - u * 5 + Math.sin(u * 5) * 4;
      return { x: T.x + Math.cos(ang) * rad, y: T.y + Math.sin(ang) * rad * 0.62, z: 16 + Math.sin(ang * 1.0 + 1) * 11 };
    };
    const o0 = orbit(2.1);
    const ctrl: V[] = [
      { x: C.x + 4, y: C.y + 6 }, { x: C.x - 6, y: C.y - 20 }, { x: C.x - 30, y: C.y - 62 }, { x: C.x + 30, y: C.y - 92 },
      { x: C.x + 90, y: C.y - 40 }, { x: C.x + 70, y: C.y + 30 }, { x: (C.x + T.x) / 2 + 30, y: T.y + 60 }, { x: o0.x, y: o0.y },
    ];
    const head = (tt: number) => {
      if (tt < 0.55) return { x: C.x + 4, y: C.y + 6, z: -4 };
      if (tt < 2.1) {
        const u = (tt - 0.55) / 1.55;
        const p = catmull(ctrl, easeInOut(u) * 0.85 + u * 0.15);
        return { x: p.x, y: p.y, z: Math.min(16, (tt - 0.55) * 40) + Math.sin(u * 9) * 4 };
      }
      if (tt < 4.45) return orbit(tt);
      // wind-up: rear back, then strike
      const o = orbit(4.45);
      const back = easeOut(inv(4.45, 4.8, tt));
      const strike = easeIn(inv(4.8, 4.98, tt));
      const dx = o.x - T.x, dy = o.y - T.y;
      const bx = T.x + dx * (1 + back * 0.6), by = T.y + dy * (1 + back * 0.6) - back * 10;
      return { x: lerp(bx, T.x, strike), y: lerp(by, T.y, strike), z: lerp(o.z + back * 22, 0, strike) };
    };
    const cracks = crackTree(rng, 0, 0, 9, 80, 0.4, 3);
    const debris = Array.from({ length: 60 }, (_, i) => ({ a: rng.r(0, TAU), v: rng.r(30, 170), vz: rng.r(60, 190), s: rng.r(0.5, 2.2), seed: i }));
    return { head, cracks, debris };
  },
  render(r, t, s) {
    const T = r.target, C = r.caster;
    const NSEG = 48;
    const contract = smooth(4.78, 4.98, t);
    const lag = 0.029 * (1 - contract * 0.96);
    const TI = 4.98, e = t - TI;
    // crack under caster
    const cr = easeOut(t / 0.55);
    if (t < 6) {
      const k = (t < 0.6 ? 1 : 0.4) * (1 - smooth(4, 6, t));
      r.line(C.x - 14 * cr, C.y + 7, C.x + 18 * cr, C.y + 5, fire(0.85), 1.6 * k);
      r.line(C.x - 10 * cr, C.y + 8, C.x + 12 * cr, C.y + 6, fire(0.5), 0.8 * k);
      r.decalLine(C.x - 14 * cr, C.y + 7, C.x + 18 * cr, C.y + 5, CHAR, 0.9);
      r.light(C.x, C.y + 6, 30, [1.3, 0.5, 0.1], 0.8 * k * cr);
    }
    if (t >= 0.5 && t < TI + 0.02) {
      const segs: { x: number; y: number; z: number; i: number; spd: number; tt: number; dir: number }[] = [];
      for (let i = 0; i < NSEG; i++) {
        const tt = t - i * lag;
        if (tt < 0.55) break;
        const p = s.head(tt), q = s.head(tt - 0.02);
        const spd = Math.hypot(p.x - q.x, p.y - q.y) / 0.02;
        segs.push({ ...p, i, spd, tt, dir: Math.atan2(p.y - q.y - (p.z - q.z), p.x - q.x) });
      }
      // shadows + lights
      for (let k = 0; k < segs.length; k += 3) {
        const g = segs[k];
        r.shadow(g.x, g.y + 2, 5, 2.5, 0.35);
        if (k % 9 === 0) r.light(g.x, g.y - g.z * 0.5, 46, [1.3, 0.45, 0.1], 0.5);
      }
      // ribbons between neighbours first (liquid fire when stretched)
      const order = segs.slice().sort((a, b) => a.z - b.z || a.y - b.y);
      for (const g of order) {
        const n = segs[g.i + 1];
        const taper = 1 - g.i / NSEG;
        const stretch = clamp(g.spd / 260);
        const w = (2.2 + 4.5 * taper) * (1 - 0.45 * stretch) * (1 + contract * 0.6);
        const depthK = 0.75 + clamp(g.z / 30) * 0.35;
        if (n) r.thick(g.x, g.y - g.z, n.x, n.y - n.z, w * 1.5, fire((0.42 + stretch * 0.25) * depthK), 1, SET);
        r.disc(g.x, g.y - g.z, w, fire(0.38 * depthK + 0.05), 1, SET);
        r.disc(g.x, g.y - g.z, w * 0.5, fire((0.62 + (1 - stretch) * 0.2 * flick(g.i, t, 14)) * depthK), 1, SET);
        if (g.i % 4 === 0) r.px(g.x - 1, g.y - g.z - w * 0.5, fire(0.95), 1, SET);
        // incandescent scales: chevrons pointing back
        if (g.i % 2 === 0 && g.i > 1) {
          const ca = Math.cos(g.dir), sa = Math.sin(g.dir);
          const bx = g.x - ca * w * 0.4, by = g.y - g.z - sa * w * 0.4;
          r.line(bx, by, bx - ca * w + -sa * w, by - sa * w + ca * w, fire(0.8 * depthK), 1, SET);
          r.line(bx, by, bx - ca * w - -sa * w, by - sa * w - ca * w, fire(0.8 * depthK), 1, SET);
        }
        // dorsal tongues rising
        if (g.i % 3 === 1) tongue(r, g.x, g.y - g.z - w * 0.4, w * 2.2 * (1 - stretch * 0.5), w * 0.7, t, g.i, 0.8, 0.35);
      }
      // detached embers become miniature serpents
      for (let k = 0; k < 70; k++) {
        const st = 0.7 + k * 0.06;
        const u = (t - st) / 0.7;
        if (u < 0 || u > 1 || st > TI) continue;
        const j = (k * 7) % NSEG;
        const o = s.head(st - j * 0.029);
        const a = hash(k) * TAU;
        for (let m = 0; m < 6; m++) {
          const uu = Math.max(0, u - m * 0.025);
          const px = o.x + Math.cos(a) * uu * 36 - Math.sin(a) * Math.sin(uu * 14) * 3;
          const py = o.y - o.z + Math.sin(a) * uu * 22 + Math.cos(a) * Math.sin(uu * 14) * 3 - uu * 16;
          r.px(px, py, fire(0.9 - m * 0.08), (1 - u) * (1 - m / 6) * 1.6);
        }
      }
      // head + maw
      const h0 = segs[0];
      if (h0) {
        const hx = h0.x, hy = h0.y - h0.z;
        const a = h0.dir, ca = Math.cos(a), sa = Math.sin(a);
        const maw = smooth(4.45, 4.85, t);
        const jaw = 0.35 + 0.25 * Math.sin(t * 9) + maw * 0.6;
        const L = 9 + maw * 5;
        const P = (lx: number, ly: number) => [hx + lx * ca - ly * sa, hy + lx * sa + ly * ca];
        // crown-like maw spikes
        if (maw > 0) {
          for (let k = 0; k < 11; k++) {
            const ang = a + (k / 11) * TAU;
            const len = (10 + (k % 2) * 8) * maw * (1 + 0.2 * Math.sin(t * 30 + k));
            const bx = hx + Math.cos(ang) * 5, by = hy + Math.sin(ang) * 5;
            r.poly([bx + Math.cos(ang + 1.5) * 2.5, by + Math.sin(ang + 1.5) * 2.5, hx + Math.cos(ang) * (5 + len), hy + Math.sin(ang) * (5 + len), bx - Math.cos(ang + 1.5) * 2.5, by - Math.sin(ang + 1.5) * 2.5], fire(0.9), 1.2);
          }
          r.glow(hx, hy, 26 * maw, [2.5, 1.4, 0.5], maw * 1.5);
          r.disc(hx, hy, 4 * maw, CHAR, 1, SET);
          r.ring(hx, hy, 4 * maw, 1, [3, 2.6, 2], 2);
        }
        r.poly([...P(-3, -5), ...P(L, -jaw * 7 - 1), ...P(L * 0.7, -1), ...P(-1, 0)], fire(0.55), 1, SET);
        r.poly([...P(-3, 5), ...P(L, jaw * 7 + 1), ...P(L * 0.7, 1), ...P(-1, 0)], fire(0.55), 1, SET);
        r.disc(hx, hy, 4.5, fire(0.42), 1, SET);
        r.disc(hx + Math.cos(a) * 2, hy + Math.sin(a) * 2, 2, fire(0.7), 1, SET);
        // horns
        r.line(...(P(-2, -4) as [number, number]), ...(P(-11, -9) as [number, number]), fire(0.95), 1.4);
        r.line(...(P(-2, 4) as [number, number]), ...(P(-11, 9) as [number, number]), fire(0.95), 1.4);
        const ey = P(2, -2.5), ey2 = P(2, 2.5);
        r.px(ey[0], ey[1], [3, 3, 3], 2, SET);
        r.px(ey2[0], ey2[1], [3, 3, 3], 2, SET);
        r.light(hx, hy, 60, [1.4, 0.6, 0.15], 1);
      }
    }
    // ---- impact
    if (e >= 0) {
      r.flash = Math.max(0, 0.7 - e * 8);
      r.flashCol = [1.2, 0.7, 0.4];
      if (e < 0.4) { r.shakeX = (hash(t * 91) - 0.5) * 7 * (1 - e / 0.4); r.shakeY = (hash(t * 37) - 0.5) * 7 * (1 - e / 0.4); }
      const heat = Math.exp(-e * 0.9);
      r.light(T.x, T.y, 150, [1.4, 0.55, 0.15], 2.2 * heat);
      r.decalDisc(T.x, T.y, 14, CHAR, 0.8, 0.4);
      for (const c of s.cracks as Crack[]) {
        if (c.d > e * 4) continue;
        const x0 = T.x + c.x0, y0 = T.y + c.y0 * 0.6, x1 = T.x + c.x1, y1 = T.y + c.y1 * 0.6;
        r.decalLine(x0, y0, x1, y1, CHAR, 0.9);
        const g = clamp(heat * 1.4 - c.d * 0.5 + 0.2 * Math.sin(e * 6 + c.d * 20));
        if (g > 0.03) {
          r.line(x0, y0, x1, y1, fire(0.3 + g * 0.7), 1.2 * g + 0.2);
          if (c.gen === 0 && g > 0.4) r.line(x0, y0 - 1, x1, y1 - 1, fire(0.45), 0.5 * g);
        }
      }
      // blast tongues ring
      const burst = 1 - smooth(0, 1.4, e);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU + 0.3;
        const rr = 6 + easeOut(e / 0.4) * (16 + (k % 3) * 8);
        tongue(r, T.x + Math.cos(a) * rr, T.y + Math.sin(a) * rr * 0.6, (20 + (k % 4) * 6) * burst, 4 * burst + 0.5, t, k, burst + 0.2, burst * 0.55);
      }
      // molten debris with z + bounce, leaving drips
      for (const d of s.debris) {
        const tb = (2 * d.vz) / 320;
        let z: number, ee = e;
        if (ee < tb) z = d.vz * ee - 160 * ee * ee;
        else { const e2 = ee - tb; z = Math.max(0, d.vz * 0.3 * e2 - 160 * e2 * e2); }
        const gx = T.x + Math.cos(d.a) * fly(0, d.v, 1.2, 0, ee), gy = T.y + Math.sin(d.a) * fly(0, d.v, 1.2, 0, ee) * 0.6;
        const k = clamp(1.6 - e * 0.45);
        if (k <= 0) continue;
        r.disc(gx, gy - z, d.s, fire(clamp(heat + 0.35)), k * 1.3);
        if (ee > tb) r.decal(gx, gy, [0.25, 0.04, 0.02], 0.8);
        r.px(gx, gy, [0, 0, 0], 0, ADD);
      }
      // pressure ring
      if (e < 0.5) r.ring(T.x, T.y, easeOut(e / 0.5) * 70, 2, fire(0.8), (1 - e / 0.5) * 1.5, ADD, 0.62);
    }
  },
  post(r, t, s) {
    // heat shimmer around head & impact
    const e = t - 4.98;
    let cx = 0, cy = 0, rad = 0, amp = 0;
    if (e > 0) { cx = r.target.x; cy = r.target.y - 10; rad = 60; amp = 1.6 * Math.exp(-e * 0.6); }
    else if (t > 0.6) { const h = s.head(t); cx = h.x; cy = h.y - h.z - 10; rad = 22; amp = 1; }
    if (amp > 0.1)
      r.warp(cx - rad, cy - rad, cx + rad, cy + rad, (x, y, o) => {
        const d = Math.hypot(x - cx, y - cy) / rad;
        if (d > 1) return;
        o[0] = x + Math.sin(y * 0.7 + t * 24) * amp * (1 - d);
        o[1] = y + Math.cos(x * 0.5 + t * 17) * amp * 0.5 * (1 - d);
      });
  },
};

// =====================================================================================
// 03 — METEOR LOOM
// =====================================================================================
type Met = { P: V; ti: number; tt: number; D: V; z0: number; kind: number; size: number; shape: number[]; spin: number; seed: number; split?: number[] };
export const meteorLoom: Effect = {
  id: 3, name: 'Meteor Loom', school: 'PYRE', duration: 10, climax: 7.25,
  blurb: 'Burning threads woven across an unseen sky; the scars were a sigil all along.',
  setup(r) {
    const rng = new RNG(303);
    const C = { x: W / 2 + 16, y: H / 2 + 4 };
    const verts: V[] = [];
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k / 7) * TAU;
      verts.push({ x: C.x + Math.cos(a) * 92, y: C.y + Math.sin(a) * 66 });
    }
    const mk = (vi: number, ti: number, tt: number, dir: number, kind: number, size: number): Met => ({
      P: vi < 0 ? C : verts[vi], ti, tt, D: { x: Math.cos(dir) * 230, y: Math.sin(dir) * 90 }, z0: 230, kind, size,
      shape: shardShape(rng, rng.i(5, 7), 0.5), spin: rng.r(-4, 4), seed: rng.i(0, 999),
    });
    const mets: Met[] = [
      mk(0, 1.7, 1.6, Math.PI + 0.3, 0, 7),
      mk(3, 2.35, 0.55, -0.4, 2, 5),
      mk(6, 3.2, 1.0, Math.PI * 1.25, 1, 4), mk(2, 3.35, 1.1, Math.PI * 1.25, 0, 4), mk(5, 3.5, 1.2, Math.PI * 1.25, 1, 4),
      mk(1, 4.3, 0.8, 0.2, 2, 5),
      mk(4, 4.95, 1.3, Math.PI - 0.6, 1, 6),
      mk(-1, 5.9, 1.4, Math.PI * 1.5 + 0.2, 1, 9),
    ];
    mets[2].split = [3, 4];
    const cracks = mets.map((m, i) => crackTree(rng, 0, 0, 5 + (i % 3), 34 + m.size * 2, 0.45, 3));
    const debris = mets.map(() => Array.from({ length: 16 }, () => ({ a: rng.r(0, TAU), v: rng.r(20, 90), vz: rng.r(40, 150), s: rng.r(0.6, 2) })));
    return { C, verts, mets, cracks, debris };
  },
  render(r, t, s) {
    const mets: Met[] = s.mets;
    const posAt = (m: Met, u: number) => {
      const gx = m.P.x + m.D.x * (1 - u), gy = m.P.y + m.D.y * (1 - u);
      const z = m.z0 * Math.pow(1 - u, 1.35);
      return { gx, gy, x: gx, y: gy - z * 0.8, z };
    };
    r.ambient = 0.5;
    // ---- impacts (ground first)
    const SIG = 6.45;
    for (let i = 0; i < mets.length; i++) {
      const m = mets[i];
      const e = t - m.ti;
      if (e < 0) continue;
      // reactivation: energy from any later impact reaches this scar with a delay
      let g = Math.exp(-e * 1.3) * 1.3;
      for (let j = 0; j < mets.length; j++) {
        if (j === i) continue;
        const ej = t - mets[j].ti;
        const d = Math.hypot(mets[j].P.x - m.P.x, mets[j].P.y - m.P.y);
        const arr = ej - d / 170;
        if (arr > 0) g += Math.exp(-arr * 2.2) * Math.exp(-d / 95) * 1.4;
      }
      g += pulse(SIG, SIG + 2.2, t) * 0.8;
      const fade = 1 - smooth(8, 10, t) * 0.7;
      g *= fade;
      r.decalDisc(m.P.x, m.P.y, 6 + m.size * 0.8, CHAR, 0.85, 0.35);
      for (const c of s.cracks[i] as Crack[]) {
        if (c.d > e * 3.2) continue;
        const x0 = m.P.x + c.x0, y0 = m.P.y + c.y0 * 0.7, x1 = m.P.x + c.x1, y1 = m.P.y + c.y1 * 0.7;
        r.decalLine(x0, y0, x1, y1, CHAR, 0.9);
        const gg = clamp(g * (1.1 - c.d * 0.7));
        if (gg > 0.04) r.line(x0, y0, x1, y1, fire(0.3 + gg * 0.65), 0.4 + gg);
      }
      r.disc(m.P.x, m.P.y, 3 + m.size * 0.4, fire(0.35 + clamp(g) * 0.6), clamp(g) + 0.15);
      r.light(m.P.x, m.P.y, 50 + m.size * 6, [1.4, 0.5, 0.12], clamp(g) * 1.2);
      // flash + shake
      if (e < 0.3) {
        r.glow(m.P.x, m.P.y, 40 + m.size * 3, [2.4, 1.6, 0.8], (1 - e / 0.3) * 1.6);
        r.flash = Math.max(r.flash, (0.6 + m.size * 0.06) * (1 - e / 0.12));
        r.shakeX += (hash(t * 50 + i) - 0.5) * m.size * (1 - e / 0.3);
        r.shakeY += (hash(t * 70 + i) - 0.5) * m.size * (1 - e / 0.3);
        r.ring(m.P.x, m.P.y, easeOut(e / 0.3) * (40 + m.size * 5), 1.5, fire(0.8), 1 - e / 0.3, ADD, 0.7);
      }
      // incandescent dust
      for (let k = 0; k < 9; k++) {
        const a = hash(i * 20 + k) * TAU;
        const rr = easeOut(e / 1.8) * (14 + hash(k + i) * 18);
        const x = m.P.x + Math.cos(a) * rr, y = m.P.y + Math.sin(a) * rr * 0.6 - e * 8;
        const life = clamp(1 - e / 2.6);
        if (life <= 0) continue;
        r.disc(x, y, 3 + e * 4, e < 0.5 ? fire(0.6) : [0.12, 0.09, 0.08], life * 0.6, e < 0.5 ? ADD : DITHER);
      }
      // debris
      for (const d of s.debris[i]) {
        const z = Math.max(0, d.vz * e - 170 * e * e);
        const gx = m.P.x + Math.cos(d.a) * fly(0, d.v, 1.5, 0, e), gy = m.P.y + Math.sin(d.a) * fly(0, d.v, 1.5, 0, e) * 0.65;
        if (z <= 0 && e > 0.3) { r.decal(gx, gy, [0.1, 0.05, 0.04]); continue; }
        r.disc(gx, gy - z, d.s, [0.15, 0.08, 0.06], 1, SET);
        r.px(gx, gy - z - 1, fire(0.8), 1.2 * Math.exp(-e));
      }
    }
    // ---- sigil: scars connect into the heptagram
    if (t > SIG) {
      const V: V[] = s.verts;
      const bright = pulse(SIG, SIG + 2.6, t);
      const cool = smooth(SIG + 1.4, 10, t);
      for (let k = 0; k < 7; k++) {
        const a = V[k], b = V[(k + 3) % 7];
        const p = easeInOut((t - SIG - k * 0.06) / 0.55);
        if (p <= 0) continue;
        const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
        for (let q = 0; q <= n * p; q++) {
          const u = q / n;
          const j = (noise1(u * 18 + k * 7) - 0.5) * 3;
          const x = a.x + dx * u + (-dy / L) * j, y = a.y + dy * u + (dx / L) * j;
          r.decal(x, y, CHAR, 0.9);
          r.decal(x, y + 1, CHAR, 0.5);
          const head = Math.exp(-Math.abs(u - p) * 20) * (p < 1 ? 1 : 0);
          r.px(x, y, fire(0.55 + bright * 0.45 - cool * 0.3 + head * 0.3), 0.5 + bright * 1.3 + head * 2);
          if (bright > 0.4) r.px(x, y - 1, fire(0.5), bright * 0.6);
        }
        if (k % 2 === 0) r.light((a.x + b.x) / 2, (a.y + b.y) / 2, 70, [1.3, 0.5, 0.15], bright * 0.8);
      }
      // encircling ring traced from the top vertex
      const rp = easeInOut((t - SIG - 0.3) / 0.8);
      const C = s.C;
      for (let q = 0; q < 700 * rp; q++) {
        const a = -Math.PI / 2 + (q / 700) * TAU;
        const x = C.x + Math.cos(a) * 100, y = C.y + Math.sin(a) * 73;
        r.decal(x, y, CHAR, 0.8);
        r.px(x, y, fire(0.6 + bright * 0.35 - cool * 0.3), 0.4 + bright * 1.2);
      }
      r.light(C.x, C.y, 160, [1.2, 0.45, 0.12], bright * 1.4);
      if (t < SIG + 0.6) r.flash = Math.max(r.flash, pulse(SIG + 0.45, SIG + 0.75, t) * 0.8);
    }
    // ---- meteors in flight (on top)
    for (let i = 0; i < mets.length; i++) {
      const m = mets[i];
      let start = m.ti - m.tt;
      if (m.split) start = m.ti - m.tt;
      // children of split meteor appear after the split point
      const parent = mets.findIndex((p) => p.split && p.split.includes(i));
      let u = (t - start) / m.tt;
      if (u < 0 || u >= 1) continue;
      if (parent >= 0) {
        const pm = mets[parent];
        const pu = (t - (pm.ti - pm.tt)) / pm.tt;
        if (pu < 0.55) continue;
      }
      if (m.split && u > 0.55) {
        // the parent becomes the first child; flash at split
        if (u < 0.6) r.glow(posAt(m, u).x, posAt(m, u).y, 14, [2, 1.2, 0.5], 1.5);
      }
      const p = posAt(m, u);
      // ground shadow sharpening as it approaches + falling light
      r.shadow(p.gx, p.gy, 3 + p.z * 0.07, 1.5 + p.z * 0.035, 0.25 + u * 0.6);
      r.light(p.gx, p.gy, 30 + p.z * 0.15, [1.4, 0.6, 0.2], 0.3 + u * 0.9);
      r.light(p.x, p.y, 40, [1.4, 0.6, 0.2], 0.5);
      // tail: analytic past positions
      for (let k = 18; k >= 1; k--) {
        const q = posAt(m, Math.max(0, u - k * 0.011 * (m.kind === 2 ? 1.6 : 1)));
        const w = m.size * (1 - k / 20) * (m.kind === 2 ? 0.8 : 0.6);
        r.disc(q.x, q.y, w, fire(0.95 - k * 0.035), 0.5);
      }
      // shed fragments on their own ballistic paths
      for (let k = 0; k < 10; k++) {
        const us = k * 0.09 + 0.05;
        if (us > u) break;
        const q0 = posAt(m, us), q1 = posAt(m, us + 0.01);
        const vx = (q1.x - q0.x) * 30 + (hash(m.seed + k) - 0.5) * 40, vy = (q1.y - q0.y) * 30 + (hash(m.seed + k + 50) - 0.5) * 30;
        const ee = (u - us) * m.tt;
        if (ee > 0.9) continue;
        const x = fly(q0.x, vx, 1.5, 0, ee), y = fly(q0.y, vy, 1.5, 90, ee);
        r.px(x, y, fire(0.8 - ee * 0.5), (1 - ee / 0.9) * 1.6);
      }
      // body
      const rot = m.spin * t;
      const vx = posAt(m, Math.min(1, u + 0.01)).x - p.x, vy = posAt(m, Math.min(1, u + 0.01)).y - p.y;
      const va = Math.atan2(vy, vx);
      if (m.kind === 2) {
        // comet: stretched silhouette along velocity
        const ca = Math.cos(va), sa = Math.sin(va), sz = m.size;
        const pts: number[] = [];
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU;
          const lx = Math.cos(a) * sz * (Math.cos(a) < 0 ? 3.2 : 1.1) * (1 + (hash(m.seed + k) - 0.5) * 0.4);
          const ly = Math.sin(a) * sz * 0.8;
          pts.push(p.x + lx * ca - ly * sa, p.y + lx * sa + ly * ca);
        }
        r.poly(pts, fire(0.75), 1.2);
        r.disc(p.x, p.y, sz * 0.5, fire(1), 1.5);
      } else {
        const pts = shardPts(m.shape, p.x, p.y, m.size, rot);
        if (m.kind === 0) {
          // fractured volcanic glass: dark body, glowing fissures
          r.poly(pts, [0.07, 0.03, 0.06], 1, SET);
          r.polyline(pts, fire(0.8), 1.2, ADD, true);
          for (let k = 0; k < 3; k++) {
            const a = rot * 1.3 + k * 2.1;
            r.line(p.x, p.y, p.x + Math.cos(a) * m.size * 0.8, p.y + Math.sin(a) * m.size * 0.8, fire(0.95), 1.2);
          }
        } else {
          // luminous interior visible through rind gaps
          r.poly(pts, fire(1), 1.4);
          const rind = shardPts(m.shape, p.x, p.y, m.size, rot);
          for (let k = 0; k < rind.length; k += 4) r.disc(rind[k], rind[k + 1], m.size * 0.35, [0.1, 0.04, 0.03], 1, SET);
        }
        r.glow(p.x, p.y, m.size * 3, fire(0.7), 0.8);
      }
    }
  },
  post(r, t, s) {
    // heat waves from impacts
    for (const m of s.mets as Met[]) {
      const e = t - m.ti;
      if (e < 0 || e > 0.8) continue;
      const R = e * 150, amp = 3 * (1 - e / 0.8);
      r.warp(m.P.x - R - 6, m.P.y - R - 6, m.P.x + R + 6, m.P.y + R + 6, (x, y, o) => {
        const dx = x - m.P.x, dy = (y - m.P.y) / 0.7, d = Math.hypot(dx, dy);
        const k = Math.exp(-Math.pow((d - R) / 5, 2)) * amp;
        if (k < 0.3) return;
        o[0] = x - (dx / (d || 1)) * k; o[1] = y - (dy / (d || 1)) * k * 0.7;
      });
    }
  },
};

// =====================================================================================
// 04 — ASHEN GUILLOTINE
// =====================================================================================
export const ashenGuillotine: Effect = {
  id: 4, name: 'Ashen Guillotine', school: 'PYRE', duration: 9, climax: 4.75,
  blurb: 'A slab of compressed combustion falls in one frame. The explosion arrives late, stratum by stratum.',
  setup(r) {
    const rng = new RNG(404);
    const P = { x: r.target.x - 20, y: r.target.y + 40 };
    const ang = -0.17;
    const dir = { x: Math.cos(ang), y: Math.sin(ang) };
    const nrm = { x: -dir.y, y: dir.x };
    const NS = 16;
    const sections = Array.from({ length: NS }, (_, k) => ({ to: 3.95 + rng.r(0, 1.25) + (k === 7 ? -0.2 : 0), w: rng.r(6, 12), jag: Array.from({ length: 6 }, () => rng.r(-1, 1)) }));
    const embers = Array.from({ length: 90 }, (_, i) => ({ x: rng.r(0, W), y: rng.r(0, H), vx: rng.r(-6, 6), vy: rng.r(-10, -3), seed: i, d: rng.r(0.4, 1.4) }));
    const gaps = Array.from({ length: 7 }, () => ({ y: rng.r(0.08, 0.92), x: rng.r(-0.4, 0.4), l: rng.r(0.04, 0.12), w: rng.r(2, 5) }));
    const veins = sections.map((sec, k) => {
      const out: Crack[] = [];
      if (k % 2) return out;
      return crackTree(rng, 0, 0, 2, 26, 0.5, 3, out);
    });
    return { P, ang, dir, nrm, sections, embers, gaps, veins, NS };
  },
  render(r, t, s) {
    const { P, dir, nrm } = s;
    const sx = P.x, top = P.y - 150;
    const TF = 3.3, TL = 3.36;
    const dark = smooth(0.2, 1.6, t) * (1 - smooth(5.5, 8.5, t));
    r.ambient = 0.62 - dark * 0.45;
    // ---- drifting embers → align to the slit
    for (const m of s.embers) {
      const align = easeInOut(inv(0.5, 0.5 + m.d, t));
      const dx = m.x + m.vx * t, dy = ((m.y + m.vy * t) % H + H) % H;
      const tx = sx + (hash(m.seed) - 0.5) * 6;
      let x = lerp(dx, tx, align * 0.85), y = dy;
      if (t > TF) {
        const e = t - TF;
        x = lerp(dx, tx, 0.85 * Math.exp(-e * 2)) + (hash(m.seed + 3) - 0.5) * e * 40;
        y = dy + e * 30;
      }
      const k = (0.4 + 0.6 * flick(m.seed, t)) * (1 - smooth(TF, TF + 2, t));
      r.px(x, y, fire(0.65 + align * 0.3), k * (0.7 + align));
      if (align > 0.3 && align < 0.95) r.px(x, y - 1, fire(0.5), k * 0.5);
    }
    // ---- slit
    if (t < TL) {
      const L = easeOut(t / 1.3) * 150;
      const k = 0.8 + smooth(1.4, 3.2, t) * 1.5;
      r.line(sx, P.y - L, sx, P.y, [2.6, 2.3, 1.9], k);
      r.line(sx - 1, P.y - L, sx - 1, P.y, fire(0.6), 0.3 * k);
      r.line(sx + 1, P.y - L, sx + 1, P.y, fire(0.6), 0.3 * k);
      r.light(sx, P.y - L / 2, 50, [1.2, 0.8, 0.5], 0.4 * k);
      // the blade becomes perceptible
      const a = smooth(1.5, 3.0, t);
      if (a > 0) {
        const tremble = Math.sin(t * 60) * 0.4 * smooth(2.6, 3.3, t);
        const bw = 40, x0 = sx - bw / 2 + tremble;
        for (let y = Math.floor(top); y < P.y; y++) {
          const u = (y - top) / (P.y - top);
          const bevel = u > 0.86 ? (u - 0.86) / 0.14 * bw : 0; // slanted guillotine edge
          for (let x = Math.floor(x0 + bevel); x < x0 + bw; x++) {
            const band = 0.5 + 0.5 * Math.sin(y * 0.55 - t * 6 + Math.sin(x * 0.3) * 1.5);
            const edge = Math.min(x - (x0 + bevel), x0 + bw - x);
            let h = 0.25 + band * 0.35 + (edge < 2 ? 0.35 : 0) + (u > 0.97 ? 0.4 : 0);
            r.plot(x, y, ...(fire(clamp(h)) as [number, number, number]), DITHER, a * (0.75 + 0.25 * flick(x * 31 + y, t, 9)));
          }
          // molten outline jitter
          if (flick(y, t, 22) > 0.4) {
            r.px(x0 + bevel - 1 + (flick(y + 3, t) > 0.7 ? -1 : 0), y, fire(0.9), a * 1.2);
            r.px(x0 + bw + (flick(y + 5, t) > 0.7 ? 1 : 0), y, fire(0.9), a * 1.2);
          }
        }
        // jagged black gaps exposing compressed white fire
        for (const g of s.gaps) {
          const cy = top + g.y * 150, cx = sx + g.x * bw, hl = g.l * 150;
          const pts = [cx, cy - hl, cx + g.w * 0.6, cy - hl * 0.3, cx + g.w * 0.3, cy + hl * 0.2, cx + g.w * 0.5, cy + hl, cx - g.w * 0.4, cy + hl * 0.4, cx - g.w * 0.5, cy - hl * 0.4];
          r.poly(pts, CHAR, a, DITHER);
          r.line(cx, cy - hl * 0.8, cx + 0.5, cy + hl * 0.8, [3, 3, 2.8], a * 1.5);
        }
        r.light(sx, P.y - 98, 120, [1.3, 0.6, 0.2], a * 0.9);
      }
    }
    // ---- the fall (one smear frame)
    if (t >= TF && t < TL) {
      const u = (t - TF) / (TL - TF);
      const a0 = -Math.PI / 2, a1 = s.ang;
      const A = lerp(a0, a1, u);
      const pts = [P.x, P.y];
      for (let k = 0; k <= 10; k++) {
        const a = lerp(a0, A, k / 10);
        pts.push(P.x + Math.cos(a) * 200, P.y + Math.sin(a) * 200);
      }
      r.poly(pts, [2.2, 1.6, 1.0], 0.9);
      r.flash = 0.6;
    }
    // ---- wound + late explosion
    if (t >= TL) {
      const e = t - TL;
      if (e < 0.25) { r.shakeY = (hash(t * 41) - 0.5) * 10 * (1 - e / 0.25); r.flash = Math.max(0, 1.2 - e * 8); }
      for (let q = -260; q <= 260; q++) {
        const x = P.x + dir.x * q, y = P.y + dir.y * q;
        r.decal(x, y, CHAR);
        r.decal(x + nrm.x, y + nrm.y, CHAR, 0.6);
        r.decal(x - nrm.x, y - nrm.y, CHAR, 0.6);
      }
      // molten veins once sections open
      s.sections.forEach((sec: any, k: number) => {
        const ee = t - sec.to;
        if (ee < 0) return;
        const q = ((k + 0.5) / s.NS - 0.5) * 460;
        const x = P.x + dir.x * q, y = P.y + dir.y * q;
        for (const c of s.veins[k] as Crack[]) {
          if (c.d > ee * 3) continue;
          r.decalLine(x + c.x0, y + c.y0, x + c.x1, y + c.y1, CHAR, 0.9);
          const g = Math.exp(-ee * 0.8) * (1 - c.d * 0.5);
          r.line(x + c.x0, y + c.y0, x + c.x1, y + c.y1, fire(0.4 + g * 0.5), g * 1.2);
        }
        r.light(x, y, 50, [1.4, 0.5, 0.12], 1.2 * Math.exp(-ee * 0.5));
        // ember columns erupting
        for (let m = 0; m < 22; m++) {
          const st = (hash(k * 50 + m) * 0.5);
          const em = ee - st;
          if (em < 0 || em > 1.4) continue;
          const vx = (hash(k * 50 + m + 1) - 0.5) * 30, vy = -60 - hash(k * 50 + m + 2) * 110;
          const ex = fly(x + (hash(m + k) - 0.5) * 10, vx, 1, 0, em), ey = fly(y, vy, 1, 120, em);
          r.px(ex, ey, fire(0.95 - em * 0.4), (1 - em / 1.4) * 1.8);
          r.px(ex, ey + 1, fire(0.6), (1 - em / 1.4) * 0.6);
        }
      });
      // smoke in aftermath
      for (let m = 0; m < 26; m++) {
        const st = 5 + hash(m) * 2.5;
        const em = t - st;
        if (em < 0 || em > 2.5) continue;
        const q = (hash(m + 7) - 0.5) * 380;
        r.disc(P.x + dir.x * q + Math.sin(em * 2 + m) * 3, P.y + dir.y * q - em * 14, 2 + em * 2.5, [0.12, 0.1, 0.1], 0.5 * (1 - em / 2.5), DITHER);
      }
    }
  },
  post(r, t, s) {
    const TL = 3.36;
    if (t < TL) return;
    const { P, dir, nrm } = s;
    const openW = (q: number) => {
      const f = (q / 460 + 0.5) * s.NS - 0.5;
      const k = Math.max(0, Math.min(s.NS - 1, Math.round(f)));
      const sec = s.sections[k];
      const ee = t - sec.to;
      if (ee < 0) return 0;
      const open = easeOutBack(clamp(ee / 0.35)) * sec.w;
      const close = 1 - smooth(1.2, 3.4, ee) * 0.75;
      const jj = sec.jag[Math.floor(((f - k + 0.5) * 6)) % 6] || 0;
      return Math.max(0, open * close + jj * 0.8);
    };
    // the floor plates physically separate along the cut
    const wmax = 16;
    r.warp(0, 0, W - 1, H - 1, (x, y, o) => {
      const dx = x - P.x, dy = y - P.y;
      const d = dx * nrm.x + dy * nrm.y;
      if (Math.abs(d) > wmax + 6) return;
      const q = dx * dir.x + dy * dir.y;
      const w = openW(q) * 0.5;
      if (w <= 0) return;
      const sg = Math.sign(d) || 1;
      o[0] = x - nrm.x * sg * w; o[1] = y - nrm.y * sg * w;
    });
    // geological strata revealed inside the wound
    const layers: [number, Col, number][] = [[1, CHAR, 1], [0.86, fire(0.35), 1], [0.7, fire(0.55), 1], [0.5, fire(0.75), 1], [0.3, fire(0.92), 1.2], [0.1, [3, 2.9, 2.6], 1.5]];
    for (let q = -230; q <= 230; q++) {
      const w = openW(q) * 0.5;
      const x = P.x + dir.x * q, y = P.y + dir.y * q;
      const e = t - TL;
      if (w <= 0.2) {
        // the thin incandescent wound before opening
        const sm = smooth(5.2, 7, t);
        const k = (e < 0.6 ? 2 : 1.2) * (1 - sm) ;
        r.plot(Math.floor(x), Math.floor(y), 3 * k + sm * 0.5 * flick(q, t, 6), 2.7 * k + sm * 0.05, 2.3 * k, ADD, 1);
        r.plot(Math.floor(x + nrm.x), Math.floor(y + nrm.y), 1.4, 0.4, 0.05, ADD, 1);
        continue;
      }
      const cool = smooth(5.6, 8.5, t);
      for (const [f, c, k] of layers) {
        const ww = w * f + 0.5;
        for (let d = -ww; d <= ww; d += 0.7) {
          const cc: Col = f < 0.9 ? scale(c, 1 - cool * 0.8) : c;
          r.plot(Math.floor(x + nrm.x * d), Math.floor(y + nrm.y * d), cc[0] * k, cc[1] * k, cc[2] * k, SET, 1);
        }
      }
      // plate edges lit from below
      r.plot(Math.floor(x + nrm.x * (w + 1)), Math.floor(y + nrm.y * (w + 1)), 1.6 * (1 - cool), 0.5 * (1 - cool), 0.06, ADD, 1);
      r.plot(Math.floor(x - nrm.x * (w + 1)), Math.floor(y - nrm.y * (w + 1)), 1.6 * (1 - cool), 0.5 * (1 - cool), 0.06, ADD, 1);
    }
  },
};

export const PYRE = [cinderCrown, furnaceWyrm, meteorLoom, ashenGuillotine];
// silence unused import warnings for helpers kept for future use
void sparkle; void easeOutBack; void TAU;
