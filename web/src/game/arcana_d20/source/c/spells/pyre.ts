// I. PYRE — fire as a living catastrophe.
import { Frame, W, H } from '../engine/frame';
import { TAU, clamp, lerp, inv, easeOut, easeInOut, hash, hash2, hash3, noise3, stepT, bayer, angDiff, type V2 } from '../engine/math';
import { P, ramp, type RGB } from '../engine/palette';
import { Particles, growTree, drawTree, shock, haze, randPoly, xform, boltPts, type Seg } from '../engine/kit';
import { CASTER, TARGETS, FOCUS } from '../engine/floor';
import type { SpellDef } from './types';

const fire = (h: number) => ramp(P.fire, h);
const DARK: RGB = [0.09, 0.02, 0.025];

/** a living tongue of flame: wobbling centreline ribbon, heat falls off to the edges and tip */
function tongue(f: Frame, x: number, y: number, ang: number, len: number, wid: number, t: number, seed: number, heat = 1, curl = 0) {
  if (len < 1.5 || heat <= 0.02) return;
  const n = Math.max(3, Math.ceil(len / 3));
  const ts = stepT(t, 15);
  const pts: V2[] = [], ws: number[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = ang + curl * s * s;
    const wob = (noise3(seed * 0.37, s * 2.5 - ts * 5, ts * 0.7) - 0.5) * len * 0.42 * s;
    pts.push({ x: x + Math.cos(a) * len * s - Math.sin(a) * wob, y: y + Math.sin(a) * len * s + Math.cos(a) * wob });
    ws.push(wid * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.5 + 0.12)), 0.8) * (1 - s * 0.55));
  }
  f.ribbon(pts, ws, (px, py, s, e) => {
    const nz = noise3(px * 0.28, py * 0.28 - ts * 7, seed);
    const h = clamp((1 - Math.abs(e)) * 1.15 - s * 0.7 + (nz - 0.5) * 0.6) * heat;
    if (h < 0.1) return;
    f.Lc(px, py, fire(h), 0.4 + h * 0.7);
  });
}

// ===================================================================== 01 CINDER CROWN
const cinderCrown: SpellDef = {
  id: 1, name: 'Cinder Crown', school: 'PYRE', dur: 7.8, climax: 4.82,
  blurb: 'Embers build an unstable crown that swallows its own light, then unfolds into shattered solar petals.',
  make(rng, fx) {
    const C = { x: FOCUS.x - 8, y: FOCUS.y + 4 };
    const LIFT = 28, SY = 0.46;
    const T_SW = 3.15, T_BL = 4.4, T_BU = 4.64;
    const hub = { x: C.x, y: C.y - LIFT };
    const segs = Array.from({ length: 10 }, (_, i) => {
      const fast = i === 3 || i === 8;
      return {
        r: 20 + i * 3.3 + rng.r(-1, 1.5), a0: rng.r(0, TAU), len: rng.r(0.7, 1.7), w: rng.r(2.8, 5.2),
        sp: fast ? rng.sign() * 7.5 : rng.r(0.45, 1.5) * rng.sign(), fast, z: rng.r(-5, 5), tail: i % 3 === 1,
        asm0: 0.6 + i * 0.12 + rng.r(0, 0.3),
        spikes: fast ? [] : Array.from({ length: rng.i(1, 2) }, () => ({ u: rng.r(0.15, 0.85), h: rng.r(7, 17) })),
      };
    });
    const embers = Array.from({ length: 110 }, (_, i) => ({ seg: i % segs.length, u: rng.next(), a: rng.r(0, TAU), rad: rng.r(60, 150), arr: rng.r(0.6, 1.9), spin: rng.r(1.5, 3.5) * rng.sign() }));
    const petals = Array.from({ length: 7 }, (_, i) => ({
      a: (i / 7) * TAU + rng.r(-0.4, 0.4), L: rng.r(48, 118), w: rng.r(9, 20), dur: rng.r(0.16, 0.5), del: rng.r(0, 0.12), curl: rng.r(-0.9, 0.9), seed: i * 13 + 5, peel: rng.r(60, 140),
    }));
    const ps = new Particles();
    let burst = false;
    const angle = (s: (typeof segs)[0], t: number) => {
      const tt = Math.min(t, T_BU);
      return s.a0 + s.sp * tt + s.sp * Math.pow(Math.max(0, tt - T_SW), 2) * 1.6;
    };
    const asm = (s: (typeof segs)[0], t: number) => clamp((t - s.asm0) / 0.8);
    const segPt = (s: (typeof segs)[0], a: number, lift: number) => ({ x: C.x + Math.cos(a) * s.r, y: C.y - lift + s.z + Math.sin(a) * s.r * SY });

    function drawSegs(f: Frame, t: number, front: boolean, mode: 'live' | 'ghost' | 'scar', lift: number, alpha = 1) {
      const dr = mode === 'live' ? inv(T_SW, T_BL, t) : 0;
      const black = mode === 'live' && t >= T_BL;
      const heatG = mode === 'live' ? 0.55 + 0.45 * inv(0.8, 2.8, t) : 1;
      for (const s of segs) {
        const A = mode === 'live' ? asm(s, t) : 1;
        if (A <= 0) continue;
        const a = angle(s, t), cy = C.y - lift + s.z;
        const ext = s.r + s.w;
        if (s.fast) {
          if (mode !== 'live') continue;
          f.ring(C.x, cy, s.r, (x, y, pa) => {
            if ((Math.sin(pa) > 0) !== front) return;
            const on = (((pa / TAU) * 15 - t * s.sp * 0.8) % 1 + 1) % 1 < 0.55 * A;
            if (!on) return;
            if (black) f.L(x, y, 2.2, 2.1, 1.9); else f.Lc(x, y, fire(0.75 + 0.25 * (1 - dr)), (front ? 1.2 : 0.7) * (1 + dr * 1.5));
          }, SY);
          continue;
        }
        const span = s.len * A;
        f.field(C.x - ext - 1, cy - ext * SY - 1, C.x + ext + 1, cy + ext * SY + 1, (x, y) => {
          const dx = x + 0.5 - C.x, dy = (y + 0.5 - cy) / SY;
          const rr = Math.hypot(dx, dy);
          const off = Math.abs(rr - s.r);
          if (off > s.w / 2 + 0.4) return;
          const pa = Math.atan2(dy, dx);
          if ((Math.sin(pa) > 0) !== front) return;
          const d = ((pa - a) % TAU + TAU) % TAU;
          if (d > span) return;
          const edge = off > s.w / 2 - 0.85 || d * rr < 1.3 || (span - d) * rr < 1.3;
          if (mode === 'scar') {
            const cool = Math.exp(-(t - T_BU) * 0.8);
            f.G(x, y, 0.02, 0.01, 0.01, 0.55);
            if (hash2(x, y) > 0.55) f.Lc(x, y, fire(0.2 + 0.5 * cool), cool * 0.9);
            return;
          }
          if (mode === 'ghost') { if (edge && alpha > bayer(x, y)) f.Lc(x, y, fire(0.6), 0.5); return; }
          if (black) { f.I(x, y, 0, 0, 0, 1); if (edge) f.L(x, y, 2.4, 2.2, 2); return; }
          const band = 1 - off / (s.w / 2);
          const n = noise3(pa * 5 + t * 2, rr * 0.3, stepT(t, 12) * 2);
          const h = clamp((0.45 + 0.55 * n) * (0.55 + 0.45 * band) * heatG);
          const k = front ? 1 : 0.55;
          const ic = fire(h * (front ? 0.95 : 0.7) * (edge ? 1.1 : 1));
          const kd = (1 - dr) * (front ? 1 : 0.7);
          f.I(x, y, ic[0] * kd, ic[1] * kd, ic[2] * kd, 1);
          if (edge) f.Lc(x, y, fire(Math.min(1, h + 0.25 + dr)), k * (0.3 + dr * 2.6));
          else f.Lc(x, y, fire(h), k * 0.22 * h * (1 - dr) * (1 - dr));
        });
        // crown spikes
        for (const sp of s.spikes) {
          if (sp.u * s.len > span) continue;
          const pa = a + sp.u * s.len;
          if ((Math.sin(pa) > 0) !== front) continue;
          const B = segPt(s, pa, lift);
          const tx = -Math.sin(pa), ty = Math.cos(pa) * SY, tl = Math.hypot(tx, ty) || 1;
          const hh = sp.h * clamp(A * 1.4 - sp.u * 0.4);
          const tip = { x: B.x + Math.cos(pa) * 2, y: B.y - hh };
          const tri = [{ x: B.x - (tx / tl) * 2.6, y: B.y - (ty / tl) * 2.6 }, { x: B.x + (tx / tl) * 2.6, y: B.y + (ty / tl) * 2.6 }, tip];
          if (mode === 'ghost') { if (alpha > 0.4) f.polyOutlineL(tri, fire(0.6), 0.4 * alpha); continue; }
          if (mode === 'scar') continue;
          if (black) { f.polyI(tri, [0, 0, 0], 1); f.polyOutlineL(tri, [1, 0.95, 0.85], 2.2); continue; }
          f.polyI(tri, DARK, 1);
          f.poly(tri, (x, y) => { const q = 1 - (B.y - y) / Math.max(1, hh); f.Lc(x, y, fire(0.35 + q * 0.5 * heatG), (front ? 1 : 0.55) * (1 - dr) * (1 - dr)); });
          f.polyOutlineL(tri, fire(0.8), (front ? 0.8 : 0.45) * (1 + dr * 2));
        }
        // molten tails
        if (s.tail && mode === 'live' && !black) {
          const dir = Math.sign(s.sp);
          const pts: V2[] = [], ws: number[] = [];
          for (let k = 0; k < 14; k++) {
            const pa = a - dir * k * 0.07 + (dir < 0 ? span : 0);
            if ((Math.sin(pa) > 0) !== front) break;
            const p = segPt(s, pa, lift - k * 0.45);
            pts.push(p); ws.push(1.8 * (1 - k / 14) * A);
          }
          if (pts.length > 1) f.ribbon(pts, ws, (x, y, q) => f.Lc(x, y, fire(0.85 - q * 0.6), (1 - q) * 1.1 * (1 - dr)));
        }
      }
    }

    return {
      update(dt, t) {
        ps.update(dt);
        // dripping molten fragments from tails
        if (t > 1 && t < T_BL) for (const s of segs) if (s.tail && rng.chance(0.25)) {
          const p = segPt(s, angle(s, t) + rng.r(0, s.len), 0);
          ps.add({ x: p.x, y: p.y + LIFT, z: LIFT - s.z, vz: -5, grav: 90, vx: rng.r(-5, 5), max: 1.2, kind: 'ember', k: 0.9 });
        }
        if (!burst && t >= T_BU) {
          burst = true;
          fx.shake(7); fx.flash([1, 0.75, 0.45], 0.4); fx.kick(3);
          for (const s of segs) for (let k = 0; k < (s.fast ? 4 : 7); k++) {
            const pa = angle(s, t) + rng.r(0, s.fast ? TAU : s.len);
            const p = segPt(s, pa, 0);
            const sp = rng.r(40, 190), roll = rng.next();
            const vx = Math.cos(pa) * sp, vy = Math.sin(pa) * sp * 0.6;
            ps.add({
              x: p.x, y: p.y + LIFT, z: LIFT - s.z, vx: roll < 0.2 ? vx * 0.04 : vx, vy: roll < 0.2 ? vy * 0.04 : vy, vz: rng.r(-10, 70), grav: roll < 0.2 ? 0 : 80,
              drag: roll < 0.2 ? 6 : 1.2, kind: 'shard', col: P.fire, size: rng.r(1.6, 3.4), spin: rng.r(-9, 9), max: roll < 0.2 ? rng.r(1.4, 2.2) : rng.r(1, 2.2), k: 1.2,
              home: roll > 0.72 ? { x: C.x + rng.r(-10, 10), y: C.y } : undefined, homeK: 3.5, bounce: 0.3,
            });
          }
          for (let i = 0; i < 240; i++) {
            const a = rng.r(0, TAU), sp = rng.r(30, 270);
            ps.add({ x: C.x, y: C.y, z: LIFT, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.62, vz: rng.r(-30, 90), grav: 70, drag: 2.4, kind: 'ember', max: rng.r(0.5, 1.9), size: rng.chance(0.2) ? 2 : 1, k: 1.2 });
          }
        }
        if (burst && t < 6.8 && rng.chance(0.7)) {
          ps.add({ x: C.x + rng.r(-70, 70), y: C.y + rng.r(-40, 30), z: rng.r(20, 60), grav: 12, vx: rng.r(-6, 6), max: rng.r(2, 3.2), kind: 'ash' });
        }
      },
      render(f, t) {
        const dr = inv(T_SW, T_BL, t);
        // gathering embers (pure function of time)
        if (t < 2.3) for (const e of embers) {
          const s = segs[e.seg];
          const pos = (tt: number) => {
            const p = easeInOut(clamp(tt / e.arr));
            const ang = e.a + (1 - p) * e.spin;
            const ax = C.x + Math.cos(ang) * e.rad, ay = C.y - LIFT + Math.sin(ang) * e.rad * 0.6;
            const tg = segPt(s, angle(s, tt) + e.u * s.len, LIFT);
            return { x: lerp(ax, tg.x, p), y: lerp(ay, tg.y, p), p };
          };
          const a = pos(t);
          if (a.p >= 1) continue;
          const b = pos(t - 0.05);
          f.lineL(b.x, b.y, a.x, a.y, ramp(P.ember, 0.5), 0.6);
          f.Lc(a.x, a.y, ramp(P.ember, 0.9), 1.4);
        }
        if (t < T_BU) {
          // ground: warm light and the crown's shadow
          f.shadeDisc(C.x, C.y, 30, 0.55, SY, 3);
          f.glow(C.x, C.y, 50, fire(0.5), 0.18 * inv(0.5, 2.5, t) * (1 - dr), 4, SY);
          drawSegs(f, t, false, 'live', LIFT);
          // inner architecture
          const arch = inv(1.5, 2.7, t);
          if (arch > 0 && t < T_BL) {
            segs.forEach((s, i) => {
              if (s.fast) return;
              const m = segPt(s, angle(s, t) + s.len * 0.5 * asm(s, t), LIFT);
              const ex = lerp(hub.x, m.x, arch), ey = lerp(hub.y, m.y, arch);
              const fl = 0.5 + 0.5 * hash(i * 7 + Math.floor(t * 15));
              f.line(hub.x, hub.y, ex, ey, (x, y, q) => { if (((x + y) & 1) === 0 || fl > 0.7) f.Lc(x, y, fire(0.55 + q * 0.3), arch * fl * (0.6 + dr * 1.5)); });
              const s2 = segs[(i + 2) % segs.length];
              if (!s2.fast) {
                const m2 = segPt(s2, angle(s2, t) + s2.len * 0.5, LIFT);
                for (let k = 0; k <= 20; k++) {
                  const q = k / 20, cx = hub.x + (Math.random() * 0), bx = lerp(lerp(m.x, cx, q), lerp(cx, m2.x, q), q), by = lerp(lerp(m.y, hub.y - 8, q), lerp(hub.y - 8, m2.y, q), q);
                  const bead = Math.abs(((t * 1.3 + i * 0.17) % 1) - q) < 0.06;
                  if (k % 2 === 0 || bead) f.Lc(bx, by, fire(bead ? 0.95 : 0.5), arch * (bead ? 1.6 : 0.5));
                }
              }
            });
            for (let k = 0; k < 4; k++) {
              const oa = t * (2.6 - k * 0.45) * (k % 2 ? -1 : 1) + k * 1.7;
              const r = 6 + k * 3.2;
              const sx = hub.x + Math.cos(oa) * r, sy = hub.y + Math.sin(oa) * r * SY;
              f.discL(sx, sy, 1.6, fire(1), 1.6 * arch);
              f.ringL(sx, sy, 3.5, fire(0.6), 0.35 * arch, 0.6);
            }
          }
          // core: brightness being swallowed
          if (t >= T_SW) {
            f.glow(hub.x, hub.y, 80, [-1, -0.9, -0.8], 0.42 * dr, 5, 0.75);
            f.shadeDisc(C.x, C.y, 110, 1 - 0.6 * dr, 0.6, 4);
            f.disc(hub.x, hub.y, 64, (x, y, d) => { const k = 2.4 * dr * (1 - d); const dx = hub.x - x, dy = hub.y - y, l = Math.hypot(dx, dy) || 1; f.D(x, y, -dx / l * k, -dy / l * k); });
            for (let k = 0; k < 46; k++) {
              const ph = ((t * 1.5 + hash(k)) % 1);
              const r = 75 * (1 - ph), a = hash(k + 9) * TAU + ph * 2.5;
              const x = hub.x + Math.cos(a) * r, y = hub.y + Math.sin(a) * r * 0.6;
              const r2 = r + 6, x2 = hub.x + Math.cos(a - 0.2) * r2, y2 = hub.y + Math.sin(a - 0.2) * r2 * 0.6;
              f.lineL(x2, y2, x, y, fire(0.9), dr * 0.9 * ph);
            }
            const cr = lerp(6, 1, dr);
            f.discL(hub.x, hub.y, cr, [1, 1, 1], 1 + dr * 3);
          } else f.glow(hub.x, hub.y, 9, fire(0.9), 0.7 * inv(1.2, 2.5, t), 3);
          drawSegs(f, t, true, 'live', LIFT);
          if (t >= T_BL) {
            f.field(0, 0, W - 1, H - 1, (x, y) => f.S(x, y, 0.3));
            f.L(hub.x, hub.y, 3, 3, 3);
            fx.desat = 0.5;
          }
        } else {
          // aftermath memory: scorched crown footprint and a rising ghost
          drawSegs(f, t, false, 'scar', 0); drawSegs(f, t, true, 'scar', 0);
          const tb = t - T_BU;
          if (t > 5.5 && t < 6.9) {
            const g = 1 - inv(5.5, 6.9, t);
            drawSegs(f, T_BU - 0.01, false, 'ghost', LIFT + (t - 5.5) * 12, g * (0.5 + 0.5 * Math.sin(t * 40)));
            drawSegs(f, T_BU - 0.01, true, 'ghost', LIFT + (t - 5.5) * 12, g);
          }
          // shattered solar petals
          for (const p of petals) {
            const q = easeOut((tb - p.del) / p.dur, 4);
            if (q <= 0) continue;
            const fade = 1 - inv(0.25, 1.5, tb);
            if (fade <= 0) continue;
            const a = p.a, dirY = Math.sin(a) * 0.72;
            const ang = Math.atan2(dirY, Math.cos(a));
            tongue(f, hub.x, hub.y, ang, p.L * q, p.w, t, p.seed, 0.85 * fade + 0.1, p.curl * q);
            tongue(f, hub.x, hub.y, ang + 0.05, p.L * q * 0.68, p.w * 0.42, t, p.seed + 3, 1.5 * fade, p.curl * q * 0.6);
            // peeling outer layer, sliding away at its own speed
            const po = tb * p.peel;
            tongue(f, hub.x + Math.cos(ang) * po, hub.y + Math.sin(ang) * po, ang, p.L * 0.4 * q, p.w * 0.5, t, p.seed + 7, 0.7 * fade * (1 - inv(0.1, 0.8, tb)), -p.curl);
          }
          if (tb < 0.15) f.discL(hub.x, hub.y, 12 * (1 - tb / 0.15), [1, 1, 1], 2);
          f.glow(hub.x, hub.y, 70, fire(0.6), Math.max(0, 0.4 - tb * 0.4), 5, 0.8);
          if (tb < 0.7) {
            shock(f, C.x, C.y, tb * 260, 14, 9 * (1 - tb / 0.7), 0.62, 1.5);
            f.ringL(C.x, C.y, tb * 260, fire(0.8), (1 - tb / 0.7) * 1.2, 0.62);
          }
          haze(f, C.x, C.y - 10, 60, t, 2.2 * Math.max(0, 1 - tb * 0.5), 0.8);
        }
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 02 FURNACE WYRM
const furnaceWyrm: SpellDef = {
  id: 2, name: 'Furnace Wyrm', school: 'PYRE', dur: 8.4, climax: 6.02,
  blurb: 'A serpent of interlocking heat crawls from a crack, knots itself around its prey and feeds its whole length into one bite.',
  make(rng, fx) {
    const T0 = TARGETS[0];
    const N = 36;
    const crack = [
      ...growTree(rng, { x: CASTER.x + 6, y: CASTER.y + 3, ang: 0.15, step: 4, steps: 9, speed: 55, branch: 0.3, spread: 0.9, jitter: 0.35, maxDepth: 2 }),
      ...growTree(rng, { x: CASTER.x + 6, y: CASTER.y + 3, ang: Math.PI - 0.2, step: 4, steps: 5, speed: 45, branch: 0.3, spread: 0.9, jitter: 0.35, maxDepth: 1, t0: 0.2 }),
    ];
    const head = { x: CASTER.x + 14, y: CASTER.y + 4, z: -14, ang: -1.1, spd: 0 };
    const hist: { x: number; y: number; z: number }[] = [];
    const ps = new Particles();
    type Serp = { x: number; y: number; a: number; life: number; max: number; ph: number; trail: V2[] };
    const serps: Serp[] = [];
    let contract = 0, impactT = -1, impact: Seg[] = [];
    const goal = (t: number): V2 => {
      if (t < 1.7) return { x: 175, y: 30 };
      if (t < 2.45) return { x: 345, y: 48 };
      if (t < 3.15) return { x: 335, y: 192 };
      if (t < 3.55) return { x: 205, y: 186 };
      if (t < 5.55) { const a = (t - 3.55) * 3.5 + 2.2; return { x: T0.x + Math.cos(a) * 46, y: T0.y + Math.sin(a) * 32 }; }
      if (t < 5.95) return { x: 196, y: 52 };
      return T0;
    };
    return {
      update(dt, t) {
        ps.update(dt);
        if (t >= 0.9 && impactT < 0) {
          const g = goal(t);
          const want = Math.atan2(g.y - head.y, g.x - head.x);
          const orbit = t > 3.55 && t < 5.55;
          const rate = t > 5.95 ? 9 : orbit ? 6.5 : 4.4;
          head.ang += clamp(angDiff(head.ang, want), -rate * dt, rate * dt);
          const ts = t > 5.95 ? 430 : t > 5.55 ? 70 : orbit ? 165 : 128 + 30 * Math.sin(t * 3);
          head.spd = lerp(head.spd, ts, 1 - Math.exp(-dt * (t > 5.95 ? 20 : 4)));
          head.x += Math.cos(head.ang) * head.spd * dt;
          head.y += Math.sin(head.ang) * head.spd * dt;
          const zt = t < 1.4 ? lerp(-14, 12, inv(0.9, 1.4, t)) : orbit ? 13 + 11 * Math.sin((t - 3.55) * 5.2) : 14;
          head.z = lerp(head.z, zt, 1 - Math.exp(-dt * 8));
          hist.unshift({ x: head.x, y: head.y, z: head.z });
          if (hist.length > 400) hist.pop();
          if (t > 5.9) contract = Math.min(1, contract + dt / 0.38);
          // embers that become tiny serpents
          if (hist.length > 20 && rng.chance(0.3)) {
            const h = hist[rng.i(4, Math.min(hist.length - 1, N * 2))];
            serps.push({ x: h.x, y: h.y - h.z, a: rng.r(0, TAU), life: 0, max: rng.r(0.35, 0.8), ph: rng.r(0, TAU), trail: [] });
          }
          if (rng.chance(0.5) && hist.length > 5) { const h = hist[rng.i(2, Math.min(hist.length - 1, 70))]; ps.add({ x: h.x, y: h.y, z: h.z, vz: rng.r(10, 40), grav: 30, vx: rng.r(-15, 15), vy: rng.r(-15, 15), drag: 2, max: rng.r(0.4, 1), kind: 'ember' }); }
          if ((Math.hypot(T0.x - head.x, T0.y - head.y) < 8 && t > 5.95) || t > 6.5) {
            impactT = t;
            fx.shake(9); fx.flash([1, 0.55, 0.2], 0.7); fx.kick(3);
            for (let k = 0; k < 7; k++) impact.push(...growTree(rng, { x: T0.x, y: T0.y, ang: (k / 7) * TAU + rng.r(-0.3, 0.3), step: 4, steps: rng.i(7, 12), speed: 170, branch: 0.4, spread: 0.8, jitter: 0.4, maxDepth: 2, t0: t, sy: 0.7 }));
            for (let i = 0; i < 90; i++) { const a = rng.r(0, TAU), sp = rng.r(30, 150); ps.add({ x: T0.x, y: T0.y, z: 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.65, vz: rng.r(50, 190), grav: 260, bounce: 0.35, kind: 'dust', col: P.ember, k: 1.2, size: rng.chance(0.3) ? 2 : 1, max: rng.r(1.2, 2.6), c: [0.25, 0.05, 0.03] }); }
            for (let i = 0; i < 160; i++) { const a = rng.r(0, TAU), sp = rng.r(40, 280); ps.add({ x: T0.x, y: T0.y, z: 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: rng.r(0, 100), grav: 60, drag: 2.6, max: rng.r(0.4, 1.4), kind: 'ember', k: 1.3 }); }
            for (let i = 0; i < 14; i++) ps.add({ x: T0.x + rng.r(-14, 14), y: T0.y + rng.r(-8, 8), z: rng.r(0, 10), vy: -rng.r(4, 12), vx: rng.r(-6, 6), max: rng.r(1.6, 2.8), kind: 'smoke', size: rng.r(4, 9), k: 0.8, delay: rng.r(0, 0.4) });
            for (const h of hist.slice(0, 80)) if (rng.chance(0.3)) ps.add({ x: h.x, y: h.y, z: h.z, vx: (T0.x - h.x) * 2, vy: (T0.y - h.y) * 2, drag: 4, max: 0.4, kind: 'ember' });
          }
        }
        for (let i = serps.length - 1; i >= 0; i--) {
          const s = serps[i];
          s.life += dt;
          if (s.life > s.max) { serps.splice(i, 1); continue; }
          s.a += Math.sin(s.life * 22 + s.ph) * 0.3;
          s.x += Math.cos(s.a) * 55 * dt; s.y += Math.sin(s.a) * 55 * dt - 12 * dt;
          s.trail.unshift({ x: s.x, y: s.y }); if (s.trail.length > 7) s.trail.pop();
        }
      },
      render(f, t) {
        // molten crack beneath caster
        drawTree(f, crack, t, (x, y, s) => {
          const h = clamp(1 - Math.max(0, t - 1.6) * 0.5 - s.depth * 0.25) * clamp(t * 2);
          f.G(x, y, 0.02, 0.01, 0.01, 0.8);
          f.Lc(x, y, fire(0.35 + h * 0.6), 0.4 + h);
        });
        if (t > 0.6 && t < 2) f.glow(CASTER.x + 8, CASTER.y + 3, 22, fire(0.6), 0.5 * (1 - inv(1.2, 2, t)), 4, 0.5);
        // body
        if (impactT < 0 && hist.length > 2) {
          const step = 2 * (1 - contract * 0.96);
          const nodes: { x: number; y: number; z: number; i: number; gap: number }[] = [];
          for (let i = 0; i < N; i++) {
            const hi = Math.min(hist.length - 1, Math.round(i * step));
            const h = hist[hi], h2 = hist[Math.min(hist.length - 1, hi + 2)];
            nodes.push({ ...h, i, gap: Math.hypot(h.x - h2.x, h.y - h2.y) });
            if (hi === hist.length - 1) break;
          }
          for (const n of nodes) if (n.z > 0 && n.i % 2 === 0) { f.shadeDisc(n.x, n.y, 6 - n.i * 0.1, 0.55, 0.5, 2); if (n.i % 4 === 0) f.glow(n.x, n.y, 14, fire(0.5), 0.14, 3, 0.55); }
          const order = [...nodes].sort((a, b) => a.z - b.z || b.i - a.i);
          const ts = stepT(t, 15);
          for (const n of order) {
            if (n.z < -2) continue;
            const s = n.i / N;
            const comp = clamp(5 / Math.max(1, n.gap), 0.6, 1.5);
            const r = lerp(6.8, 1.3, Math.pow(s, 0.75)) * Math.sqrt(comp) * (1 + contract * 0.4);
            const sx = n.x, sy = n.y - n.z;
            const hot = 0.15 * (comp - 1) + contract * 0.4;
            f.disc(sx, sy, r + 1, (x, y, d) => {
              if (s > 0.62 && hash3(x, y, Math.floor(t * 20)) < (s - 0.62) * 1.8) return;
              if (n.z < 0 && y > n.y) return;
              if (d > r / (r + 1)) { f.Ic(x, y, DARK, 1); f.Lc(x, y, fire(0.25), 0.4); return; }
              const nz = noise3(x * 0.35, y * 0.35 - ts * 5, n.i);
              const plate = n.i % 2 ? 0.08 : 0;
              const h = clamp((1 - d * d) * 0.75 + nz * 0.3 + plate + hot - s * 0.25);
              f.Ic(x, y, fire(h * 0.95), 1);
              f.Lc(x, y, fire(h), 0.08 + h * h * 0.45);
            });
            if (n.i % 3 === 1 && n.i < N - 6) {
              const lean = -Math.cos(head.ang) * 0.5;
              tongue(f, sx, sy - r * 0.5, -Math.PI / 2 + lean, 5 + r * 1.3, r * 0.75, t, n.i * 3.3, 0.95);
            }
          }
          // head
          const h0 = hist[0], h1 = hist[Math.min(hist.length - 1, 3)];
          const da = Math.atan2(h0.y - h1.y, h0.x - h1.x);
          const dx = Math.cos(da), dy = Math.sin(da), px = -dy, py = dx;
          const hx = h0.x, hy = h0.y - h0.z;
          const maw = inv(5.82, 6.12, t);
          if (h0.z > -3) {
            const sc = 1 + maw * 0.8;
            const P2 = (a: number, b: number) => ({ x: hx + (dx * a + px * b) * sc, y: hy + (dy * a + py * b) * sc });
            const headPoly = [P2(10, 0), P2(4, 5), P2(-3, 5), P2(-8, 8), P2(-5, 3), P2(-6, 0), P2(-5, -3), P2(-8, -8), P2(-3, -5), P2(4, -5)];
            f.polyI(headPoly, DARK, 1);
            f.poly(headPoly, (x, y) => { const d = Math.hypot(x - hx, y - hy) / (9 * sc); const hc = clamp(0.95 - d * 0.6 + contract * 0.3); f.Ic(x, y, fire(hc * 0.95), 1); f.Lc(x, y, fire(hc), 0.15 + hc * 0.35); });
            f.polyOutlineL(headPoly, fire(0.6), 0.5);
            if (maw > 0) {
              for (let k = 0; k < 11; k++) {
                const a = da + (k / 10 - 0.5) * 3.4;
                tongue(f, hx + dx * 4, hy + dy * 4, a, (5 + maw * 14) * (k % 2 ? 0.7 : 1), 3, t, k * 7, 1.2);
              }
              f.discI(hx + dx * 6, hy + dy * 6, 1 + maw * 3, [0, 0, 0], 1);
              f.ringL(hx + dx * 6, hy + dy * 6, 1.5 + maw * 3, [1, 0.95, 0.8], 2);
            } else {
              f.L(hx + dx * 3 + px * 2, hy + dy * 3 + py * 2, 2, 2, 1.8);
              f.L(hx + dx * 3 - px * 2, hy + dy * 3 - py * 2, 2, 2, 1.8);
            }
            haze(f, hx, hy, 22, t, 1.6 + contract * 2);
            f.glow(hx, hy, 18, fire(0.7), 0.35 + contract * 0.8, 4);
          }
        }
        for (const s of serps) {
          const u = s.life / s.max;
          if (s.trail.length > 1) f.ribbon(s.trail, s.trail.map((_, i) => 0.9 * (1 - i / 7)), (x, y, q) => f.Lc(x, y, fire(0.9 - q * 0.5 - u * 0.4), 1 - u));
        }
        // impact
        if (impactT >= 0) {
          const tb = t - impactT;
          drawTree(f, impact, t, (x, y, s) => {
            const h = clamp(1.25 - (t - s.t0) * 0.45 - s.depth * 0.2);
            f.G(x, y, 0.02, 0.01, 0.01, 0.85);
            if (h > 0.05) f.Lc(x, y, fire(h), 0.4 + h);
          });
          const cool = Math.exp(-tb * 0.9);
          f.disc(T0.x, T0.y, 9, (x, y, d) => { const n = noise3(x * 0.3, y * 0.3, t * 0.8); f.Ic(x, y, DARK, 1); f.Lc(x, y, fire(clamp((1 - d) * 0.6 + n * 0.5) * cool + 0.1), 0.8 * cool + 0.1); }, 0.7);
          if (tb < 0.12) f.discL(T0.x, T0.y, 10 * (1 - tb / 0.12), [1, 1, 1], 2);
          f.glow(T0.x, T0.y, 60, fire(0.6), 0.7 * cool, 5, 0.75);
          if (tb < 0.6) shock(f, T0.x, T0.y, tb * 230, 12, 8 * (1 - tb / 0.6), 0.7, 1);
          haze(f, T0.x, T0.y - 6, 46, t, 2.6 * Math.max(0, 1 - tb * 0.4), 0.9);
        }
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 03 METEOR LOOM
const meteorLoom: SpellDef = {
  id: 3, name: 'Meteor Loom', school: 'PYRE', dur: 9.2, climax: 6.4,
  blurb: 'Burning threads cross an unseen sky; every impact scar is a stitch in a figure revealed only at the end.',
  make(rng, fx) {
    const G0 = { x: 238, y: 116 }, R = 66, SY = 0.6;
    const V = Array.from({ length: 5 }, (_, k) => { const a = -Math.PI / 2 + (k * TAU) / 5; return { x: G0.x + Math.cos(a) * R * 1.12, y: G0.y + Math.sin(a) * R * SY + 4 }; });
    type Met = { S: V2; I: V2; z0: number; ts: number; ti: number; arc: number; shape: number; size: number; poly: V2[]; spin: number; parent?: number; splitAt?: number; hit: boolean };
    const mets: Met[] = [];
    const mk = (I: V2, ti: number, flight: number, th: number, z0: number, shape: number, size: number, arc = 0) => {
      const D = 240;
      const m: Met = { S: { x: I.x + Math.cos(th) * D, y: I.y + Math.sin(th) * D * 0.6 }, I, z0, ts: ti - flight, ti, arc, shape, size, poly: randPoly(rng, 7, size, 0.55), spin: rng.r(-6, 6), hit: false };
      mets.push(m); return mets.length - 1;
    };
    mk(V[0], 1.95, 1.75, -2.7, 230, 0, 6, 46);
    mk(V[2], 2.65, 0.42, -0.25, 150, 1, 5);
    const sp = mk(V[4], 3.45, 1.15, -1.75, 210, 2, 5, -20);
    mk(V[1], 4.15, 0.95, 0.35, 190, 1, 7, 18);
    mk(V[3], 4.8, 0.8, -2.15, 200, 0, 6, -10);
    // split meteor: children inherit the parent's position at the split moment
    const par = mets[sp]; par.splitAt = par.ts + 0.55 * (par.ti - par.ts);
    const pos = (m: Met, t: number) => {
      const p = clamp((t - m.ts) / (m.ti - m.ts));
      const dx = m.I.x - m.S.x, dy = m.I.y - m.S.y, l = Math.hypot(dx, dy) || 1;
      const arc = Math.sin(Math.PI * p) * m.arc;
      return { x: lerp(m.S.x, m.I.x, p) - (dy / l) * arc, y: lerp(m.S.y, m.I.y, p) + (dx / l) * arc, z: m.z0 * (1 - p) * (1 + 0.2 * Math.sin(Math.PI * p)), p };
    };
    const sPos = pos(par, par.splitAt!);
    [[0, 0, 0], [-15, 7, 0.09], [13, 10, 0.18]].forEach(([ox, oy, dt]) => {
      const I = { x: V[4].x + ox, y: V[4].y + oy };
      mets.push({ S: { x: sPos.x, y: sPos.y }, I, z0: sPos.z, ts: par.splitAt!, ti: par.ti + dt, arc: 0, shape: 2, size: 3.5, poly: randPoly(rng, 6, 3.5, 0.6), spin: rng.r(-8, 8), parent: sp, hit: false });
    });
    type Crater = { x: number; y: number; t: number; size: number; segs: Seg[] };
    const craters: Crater[] = [];
    const ps = new Particles();
    const order = [0, 2, 4, 1, 3, 0];
    const TL = 5.45, TF = 6.22;
    const edges = order.slice(0, 5).map((a, i) => boltPts(31 + i, V[a].x, V[a].y, V[order[i + 1]].x, V[order[i + 1]].y, 0.1, 5));
    let flared = false;
    return {
      update(dt, t) {
        ps.update(dt);
        mets.forEach((m, mi) => {
          const live = t >= m.ts && t < m.ti && !(m.splitAt && t >= m.splitAt);
          if (live) {
            const a = pos(m, t), b = pos(m, t - dt);
            for (let k = 0; k < 2; k++) ps.add({ x: a.x, y: a.y, z: a.z * 0.75, vx: (a.x - b.x) / dt * 0.35 + rng.r(-25, 25), vy: (a.y - b.y) / dt * 0.35 + rng.r(-25, 25), vz: rng.r(-20, 30), grav: 150, drag: 0.6, kind: 'ember', max: rng.r(0.6, 1.6), k: 1.1 });
          }
          if (!m.hit && t >= m.ti && !m.splitAt) {
            m.hit = true;
            const segs: Seg[] = [];
            for (let k = 0; k < 5; k++) segs.push(...growTree(rng, { x: m.I.x, y: m.I.y, ang: rng.r(0, TAU), step: 4, steps: rng.i(6, 11), speed: 150, branch: 0.35, spread: 0.8, jitter: 0.45, maxDepth: 2, t0: t, sy: 0.7 }));
            craters.push({ x: m.I.x, y: m.I.y, t, size: m.size, segs });
            fx.shake(m.size * 0.8); fx.flash([1, 0.6, 0.25], 0.15 + m.size * 0.03);
            for (let i = 0; i < 26 + m.size * 4; i++) { const a = rng.r(0, TAU), s = rng.r(20, 110); ps.add({ x: m.I.x, y: m.I.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rng.r(60, 170), grav: 260, bounce: 0.3, kind: 'dust', col: P.ember, k: 1, size: rng.chance(0.3) ? 2 : 1, max: rng.r(1, 2.2), c: [0.18, 0.08, 0.06] }); }
            for (let i = 0; i < 40; i++) { const a = rng.r(0, TAU), s = rng.r(40, 200); ps.add({ x: m.I.x, y: m.I.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rng.r(0, 60), grav: 60, drag: 3, kind: 'ember', max: rng.r(0.3, 1) }); }
            for (let i = 0; i < 6; i++) ps.add({ x: m.I.x + rng.r(-8, 8), y: m.I.y + rng.r(-5, 5), z: rng.r(2, 10), vx: rng.r(-12, 12), vy: rng.r(-10, 2), max: rng.r(1.2, 2.4), kind: 'smoke', size: rng.r(4, 8), k: 0.75, c: [0.12, 0.05, 0.04] });
            void mi;
          }
        });
        if (!flared && t >= TF) {
          flared = true; fx.shake(6); fx.flash([1, 0.5, 0.2], 0.25); fx.kick(2.5);
        }
        if (flared && t < 8.2) for (let k = 0; k < 3; k++) {
          const e = edges[rng.i(0, 4)], p = e[rng.i(0, e.length - 1)];
          ps.add({ x: p.x, y: p.y, z: 0, vz: rng.r(20, 70), grav: 25, vx: rng.r(-6, 6), max: rng.r(0.8, 1.6), kind: 'ember' });
        }
      },
      render(f, t) {
        const fl = flared ? Math.exp(-(t - TF) * 1.1) : 0;
        // craters and their living cracks
        for (const c of craters) {
          const tb = t - c.t;
          const cool = Math.exp(-tb * 0.75);
          drawTree(f, c.segs, t, (x, y, s) => {
            let h = 1.1 * Math.exp(-(t - s.t0) * 0.7) - s.depth * 0.15;
            for (const o of craters) {
              if (o.t <= c.t || t < o.t) continue;
              const d = Math.hypot(x - o.x, y - o.y);
              if (d > 110) continue;
              const front = (t - o.t) * 140 - d;
              h += Math.exp(-(front * front) / 260) * 1.1 + Math.max(0, 0.35 - (t - o.t) * 0.2) * (front > 0 ? 1 : 0);
            }
            h += fl * 0.6;
            f.G(x, y, 0.03, 0.01, 0.01, 0.85);
            if (h > 0.06) f.Lc(x, y, fire(clamp(h)), 0.3 + clamp(h));
          });
          f.disc(c.x, c.y, c.size * 1.6 + 2, (x, y, d) => {
            if (d > 0.82) { f.Ic(x, y, [0.06, 0.03, 0.03], 1); return; }
            const n = noise3(x * 0.4, y * 0.4, t * 0.6 + c.t);
            f.Ic(x, y, DARK, 1);
            f.Lc(x, y, fire(clamp((1 - d) * 0.5 + n * 0.5) * (cool * 0.9 + 0.15 + fl * 0.5)), 0.4 + cool + fl);
          }, 0.65);
          if (tb < 0.12) f.discL(c.x, c.y, c.size * 3 * (1 - tb / 0.12), [1, 1, 0.9], 3);
          f.glow(c.x, c.y, 26 + c.size * 3, fire(0.6), 0.55 * cool + fl * 0.3, 4, 0.65);
          if (tb < 0.55) shock(f, c.x, c.y, tb * 210, 10, 6 * (1 - tb / 0.55), 0.65, 0.8);
          haze(f, c.x, c.y - 4, 26, t, 1.6 * cool + 0.4);
        }
        // meteors: shadows grow sharper as they fall, then bodies + trails
        for (const m of mets) {
          if (t < m.ts || t >= m.ti || (m.splitAt && t >= m.splitAt)) continue;
          const a = pos(m, t);
          const near = 1 - a.z / Math.max(1, m.z0 * 1.2);
          f.shadeDisc(a.x, a.y, 3 + a.z * 0.07, 1 - 0.6 * Math.pow(near, 1.5), 0.5, 3);
          f.glow(a.x, a.y, 8 + 34 * near, fire(0.55), 0.3 * near * near, 4, 0.55);
          const sx = a.x, sy = a.y - a.z * 0.75;
          const pts: V2[] = [], ws: number[] = [];
          for (let k = 0; k < 18; k++) {
            const b = pos(m, t - k * 0.02 * (m.ti - m.ts) / 1.2 - k * 0.004);
            pts.push({ x: b.x, y: b.y - b.z * 0.75 }); ws.push(m.size * 0.9 * (1 - k / 18) + 0.3);
          }
          f.ribbon(pts, ws, (x, y, s, e) => f.Lc(x, y, fire(clamp(1 - s * 0.9 - Math.abs(e) * 0.4)), 1.2 * (1 - s)));
          const b = pos(m, t - 0.02);
          const va = Math.atan2(a.y - a.z * 0.75 - (b.y - b.z * 0.75), a.x - b.x);
          const poly = m.shape === 2 ? xform(m.poly.map((p) => ({ x: p.x * 1.9, y: p.y * 0.8 })), sx, sy, va) : xform(m.poly, sx, sy, t * m.spin);
          f.polyI(poly, [0.08, 0.03, 0.03], 1);
          const vx = Math.cos(va), vy = Math.sin(va);
          f.poly(poly, (x, y) => {
            const lx = x + 0.5 - sx, ly = y + 0.5 - sy;
            const lead = (lx * vx + ly * vy) / m.size;
            if (m.shape === 0) { const d = Math.hypot(lx, ly) / m.size; if (d < 0.62) f.Lc(x, y, fire(0.75 + 0.25 * noise3(x * 0.5, y * 0.5, t * 4)), 1.4); else if (lead > 0.2) f.Lc(x, y, fire(0.7), 0.8); }
            else if (m.shape === 1) { const cr = Math.abs(Math.sin(lx * 1.3 + ly * 0.7 + m.spin)) < 0.18; if (cr) f.Lc(x, y, fire(0.95), 1.3); if (lead > 0.35) f.Lc(x, y, fire(0.85), 1.1); }
            else { f.Lc(x, y, fire(0.6 + lead * 0.3), 0.6 + Math.max(0, lead)); }
          });
          f.glow(sx, sy, m.size * 3.2, fire(0.7), 0.5, 3);
        }
        // the figure: scars connect into an immense design
        if (t >= TL) {
          edges.forEach((e, i) => {
            const rv = clamp((t - TL - i * 0.09) / 0.2);
            if (rv <= 0) return;
            const k = 0.8 + fl * 1.8;
            const n = Math.max(2, Math.ceil(e.length * rv));
            f.ribbon(e.slice(0, n), 1.4, (x, y, _s, ee) => {
              f.G(x, y, 0.03, 0.01, 0.01, 0.9);
              const h = clamp((1 - Math.abs(ee)) * (0.55 + fl * 0.6 + 0.3 * Math.exp(-(t - TF - 1.5) * 0.4 * (t > TF ? 1 : 0))));
              f.Lc(x, y, fire(h + 0.1), k * h);
            });
            if (rv < 1) f.glow(e[n - 1].x, e[n - 1].y, 8, fire(0.9), 1, 3);
          });
          const cr = clamp((t - TL - 0.4) / 0.35);
          if (cr > 0) {
            const n = Math.floor(160 * cr);
            for (let i = 0; i < n; i++) {
              const a = -Math.PI / 2 + (i / 160) * TAU;
              const x = G0.x + Math.cos(a) * R * 1.32, y = G0.y + 4 + Math.sin(a) * R * SY * 1.32;
              f.G(x, y, 0.03, 0.01, 0.01, 0.8);
              f.Lc(x, y, fire(0.55 + fl * 0.4), 0.6 + fl * 1.5);
            }
          }
          if (flared) {
            const star = order.slice(0, 5).map((k) => V[k]);
            f.polyL(star, fire(0.6), 0.22 * fl);
            haze(f, G0.x, G0.y, 85, t, 1.8 * fl + 0.3, 0.65);
            if (t - TF < 0.5) shock(f, G0.x, G0.y, (t - TF) * 260, 16, 8 * (1 - (t - TF) / 0.5), 0.62, 2);
          }
        }
        ps.render(f);
      },
    };
  },
};

// ===================================================================== 04 ASHEN GUILLOTINE
const ashenGuillotine: SpellDef = {
  id: 4, name: 'Ashen Guillotine', school: 'PYRE', dur: 7.6, climax: 4.25,
  blurb: 'A pale slit, a monumental slab of compressed combustion, one impossibly precise cut — and the explosion arrives late.',
  make(rng, fx) {
    const A = { x: 62, y: 192 }, B = { x: 342, y: 42 };
    const Len = Math.hypot(B.x - A.x, B.y - A.y);
    const dir = { x: (B.x - A.x) / Len, y: (B.y - A.y) / Len }, nrm = { x: -dir.y, y: dir.x };
    const X0 = 206, Yb = A.y + ((X0 - A.x) / (B.x - A.x)) * (B.y - A.y);
    const TC = 2.95, TO = 3.6;
    const NS = 13;
    const perm = Array.from({ length: NS }, (_, i) => i).sort(() => rng.next() - 0.5);
    const secs = Array.from({ length: NS }, (_, i) => ({ to: TO + perm.indexOf(i) * 0.11 + rng.r(0, 0.05), W: rng.r(4, 8.5), veins: [] as Seg[], opened: false }));
    const cols = Array.from({ length: 10 }, () => ({ t: rng.r(3.8, 5.5), u: rng.r(0.08, 0.92), fired: false }));
    type Em = { x: number; y: number; vx: number; vy: number; gone: boolean };
    const ems: Em[] = Array.from({ length: 60 }, () => ({ x: rng.r(20, W - 20), y: rng.r(10, H - 10), vx: rng.r(-4, 4), vy: rng.r(-8, -2), gone: false }));
    const ps = new Particles();
    let cut = false;
    const openK = (i: number, t: number) => easeOut((t - secs[i].to) / 0.3, 3);
    const subside = (t: number) => 1 - 0.78 * inv(5.7, 7.0, t);
    const width = (u: number, t: number) => {
      if (t < TO) return 0.6;
      const fi = u * NS, i = Math.min(NS - 1, Math.floor(fi)), v = fi - i;
      return Math.max(0.6, Math.pow(Math.sin(Math.PI * v), 0.45) * secs[i].W * openK(i, t) * subside(t));
    };
    return {
      update(dt, t) {
        ps.update(dt);
        const frozen = t > TC + 0.03 && t < TO;
        if (!frozen) for (const e of ems) {
          if (e.gone) continue;
          if (t > 0.5 && t < TC) {
            const ny = clamp(e.y, Yb - 130 * inv(0.4, 1.4, t), Yb);
            const dx = X0 - e.x, dy = ny - e.y, l = Math.hypot(dx, dy) || 1;
            const al = inv(0.5, 2.0, t);
            e.vx = lerp(e.vx, (dx / l) * 32, al * 0.06); e.vy = lerp(e.vy, (dy / l) * 32, al * 0.06);
            if (l < 2.5) e.gone = true;
          }
          e.x += e.vx * dt; e.y += e.vy * dt;
        }
        if (!cut && t >= TC) {
          cut = true; fx.shake(3); fx.flash([1, 0.95, 0.85], 0.55); fx.kick(2);
        }
        secs.forEach((s, i) => {
          if (!s.opened && t >= s.to) {
            s.opened = true;
            fx.shake(2.5 + s.W * 0.25);
            const u = (i + 0.5) / NS, mx = A.x + dir.x * u * Len, my = A.y + dir.y * u * Len;
            for (const side of [-1, 1]) s.veins.push(...growTree(rng, { x: mx + nrm.x * side * 3, y: my + nrm.y * side * 3, ang: Math.atan2(nrm.y * side, nrm.x * side) + rng.r(-0.5, 0.5), step: 3, steps: rng.i(4, 9), speed: 75, branch: 0.35, spread: 0.7, jitter: 0.45, maxDepth: 2, t0: t }));
            for (let k = 0; k < 14; k++) ps.add({ x: mx + dir.x * rng.r(-8, 8), y: my + dir.y * rng.r(-8, 8), vz: rng.r(40, 120), grav: 120, vx: rng.r(-20, 20), vy: rng.r(-20, 20), kind: 'ember', max: rng.r(0.5, 1.2) });
          }
        });
        for (const c of cols) if (!c.fired && t >= c.t) {
          c.fired = true;
          const x = A.x + dir.x * c.u * Len, y = A.y + dir.y * c.u * Len;
          for (let k = 0; k < 40; k++) ps.add({ x: x + rng.r(-3, 3), y: y + rng.r(-2, 2), vz: rng.r(90, 230), grav: 110, vx: rng.r(-14, 14), vy: rng.r(-8, 8), drag: 0.8, kind: 'ember', max: rng.r(0.8, 1.8), size: rng.chance(0.3) ? 2 : 1, k: 1.2 });
          fx.shake(2);
        }
        if (t > 5.4 && t < 7.4 && rng.chance(0.5)) {
          const u = rng.next();
          ps.add({ x: A.x + dir.x * u * Len, y: A.y + dir.y * u * Len, z: 2, vz: rng.r(8, 18), vx: rng.r(-4, 4), max: rng.r(1.5, 2.5), kind: 'smoke', size: rng.r(2, 5), k: 0.55, c: [0.08, 0.06, 0.06] });
        }
      },
      render(f, t) {
        // aligned embers
        for (const e of ems) {
          if (e.gone) continue;
          const sp = Math.hypot(e.vx, e.vy) || 1;
          const c = ramp(P.ember, 0.6);
          f.Lc(e.x, e.y, c, 1);
          if (sp > 12) f.lineL(e.x - (e.vx / sp) * 3, e.y - (e.vy / sp) * 3, e.x, e.y, c, 0.5);
        }
        if (t < TC) {
          const hs = 130 * easeOut(inv(0.4, 1.4, t)), dk = inv(0.5, 2.7, t);
          const top = Yb - hs;
          f.field(X0 - 46, 0, X0 + 46, Yb + 16, (x, y) => {
            const dx = Math.abs(x - X0) / 46;
            const vy = y < top ? 1 - (top - y) / 30 : y > Yb ? 1 - (y - Yb) / 16 : 1;
            if (vy <= 0) return;
            const k = -0.45 * dk * Math.pow(1 - dx, 2) * vy;
            f.L(x, y, k, k, k);
            f.S(x, y, 1 - 0.5 * dk * (1 - dx) * vy);
          });
          if (hs > 0) {
            const fl = 0.85 + 0.2 * Math.sin(t * 37);
            for (let y = Math.floor(top); y <= Yb; y++) {
              f.L(X0, y, 1.2 * fl, 1.1 * fl, 0.9 * fl);
              f.Lc(X0 - 1, y, fire(0.7), 0.35 * dk); f.Lc(X0 + 1, y, fire(0.7), 0.35 * dk);
            }
          }
          // the slab
          const rv = inv(1.55, 2.7, t);
          if (rv > 0) {
            const jit = t > 2.35 ? (hash(Math.floor(t * 24)) > 0.5 ? 1 : -1) * (t > 2.7 ? 1 : 0) : 0;
            const xo = X0 + jit, topY = Yb - 168;
            const slab = [{ x: xo - 14, y: topY }, { x: xo + 13, y: topY }, { x: xo + 13, y: Yb - 26 }, { x: xo + 1, y: Yb - 2 }, { x: xo - 14, y: Yb - 12 }];
            const ts = stepT(t, 8);
            f.poly(slab, (x, y) => {
              const vis = Math.abs(x - xo) / 14 < rv * 1.25 - bayer(x, y) * 0.3;
              if (!vis) return;
              const n = noise3(x * 0.12, y * 0.035, 3.1);
              const gap = Math.abs(n - 0.5);
              if (gap < 0.03) {
                f.I(x, y, 0, 0, 0, 1);
                if (gap < 0.011) f.L(x, y, 1.6, 1.5, 1.3);
                return;
              }
              const band = Math.floor((y + noise3(x * 0.1, y * 0.05, ts) * 7) / 5);
              const b = ((band % 3) + 3) % 3;
              f.Ic(x, y, b === 0 ? [0.16, 0.03, 0.03] : DARK, 1);
              f.Lc(x, y, fire(b === 0 ? 0.32 : b === 1 ? 0.5 : 0.22), (b === 1 ? 0.8 : 0.55) * rv);
            });
            if (rv > 0.5) {
              const o = hash(Math.floor(t * 12)) > 0.5 ? 1 : 0;
              f.polyOutlineL(slab.map((p) => ({ x: p.x + o, y: p.y })), fire(0.85), 1.2 * (rv - 0.4));
            }
            f.glow(X0, Yb, 30, fire(0.4), 0.15 * rv, 3, 0.6);
          }
        } else if (t < TC + 0.034) {
          // smear frame: a single instant of swept mass
          f.polyL([{ x: X0, y: Yb }, { x: X0 - 14, y: Yb - 168 }, { x: X0 + 13, y: Yb - 168 }, B], fire(0.9), 1.6);
          f.polyL([{ x: X0, y: Yb }, A, { x: A.x + 30, y: A.y - 40 }], fire(0.8), 1.2);
        } else {
          const H2 = subside(t);
          const heat = t < TO ? 1 : 0.55 + 0.45 * H2;
          // veins
          for (const s of secs) drawTree(f, s.veins, t, (x, y, sg) => {
            const h = clamp((1.1 - (t - sg.t0) * 0.35 - sg.depth * 0.2) * heat);
            f.G(x, y, 0.03, 0.01, 0.01, 0.8);
            if (h > 0.05) f.Lc(x, y, fire(h), 0.3 + h);
          });
          // plates of floor sliding away from the wound
          secs.forEach((s, i) => {
            if (t < s.to) return;
            const o = s.W * openK(i, t) * (0.7 + 0.3 * H2);
            const u0 = i / NS, u1 = (i + 1) / NS;
            for (const side of [-1, 1]) {
              const P0 = (u: number, d: number) => ({ x: A.x + dir.x * u * Len + nrm.x * d * side, y: A.y + dir.y * u * Len + nrm.y * d * side });
              const plate = [P0(u0 + 0.004, o * 0.8), P0(u1 - 0.004, o * 0.8), P0(u1 - 0.01, o * 0.8 + 9), P0(u0 + 0.01, o * 0.8 + 9)];
              f.poly(plate, (x, y) => { const c = f.baseAt(x - nrm.x * side * o * 0.8, y - nrm.y * side * o * 0.8); f.I(x, y, c[0] * 0.8, c[1] * 0.75, c[2] * 0.75, 1); });
              f.lineL(plate[0].x, plate[0].y, plate[1].x, plate[1].y, fire(0.6), 0.9 * heat);
            }
          });
          // the wound: geological strata of fire
          f.field(Math.min(A.x, B.x) - 14, Math.min(A.y, B.y) - 14, Math.max(A.x, B.x) + 14, Math.max(A.y, B.y) + 14, (x, y) => {
            const rx = x + 0.5 - A.x, ry = y + 0.5 - A.y;
            const d = rx * nrm.x + ry * nrm.y;
            if (Math.abs(d) > 13) return;
            const u = (rx * dir.x + ry * dir.y) / Len;
            if (u < 0 || u > 1) return;
            let w = width(u, t);
            if (w > 2) w += (hash2(Math.round(u * Len), d > 0 ? 1 : 2) - 0.5) * 1.6;
            const ad = Math.abs(d);
            if (ad > w + 1.6) return;
            if (ad > w) { f.Ic(x, y, [0.05, 0.02, 0.02], 1); f.Lc(x, y, fire(0.25), 0.3 * heat); return; }
            const depth = 1 - ad / Math.max(w, 0.6);
            if (t < TO) { f.L(x, y, 2.4, 2.2, 1.9); return; }
            const band = depth + 0.13 * Math.sin(u * Len * 0.33 + (d > 0 ? 2 : 0));
            const st = Math.floor(clamp(band) * 5) / 5;
            f.Ic(x, y, [0.03, 0.01, 0.01], 1);
            if (st > 0 || w < 2) f.Lc(x, y, fire((0.25 + st * 0.75) * heat), (0.4 + st * 1.4) * heat);
          });
          if (t < TO) {
            for (let k = -1; k <= 1; k += 2) f.lineL(A.x + nrm.x * k, A.y + nrm.y * k, B.x + nrm.x * k, B.y + nrm.y * k, fire(0.75), 0.6);
            f.field(0, 0, W - 1, H - 1, (x, y) => f.S(x, y, 0.6));
          }
          // ember columns
          for (const c of cols) {
            const q = (t - c.t) / 0.5;
            if (q < 0 || q > 1) continue;
            const x = A.x + dir.x * c.u * Len, y = A.y + dir.y * c.u * Len;
            tongue(f, x, y, -Math.PI / 2, 46 * Math.sin(Math.PI * Math.pow(q, 0.6)), 7, t, c.u * 99, 1.2);
          }
          if (t > 6.4) {
            const q = inv(6.4, 7.2, t);
            f.line(A.x, A.y, B.x, B.y, (x, y) => f.Lc(x, y, fire(0.35), q * (0.35 + 0.1 * Math.sin(t * 3 + x * 0.1))));
          }
          f.glow((A.x + B.x) / 2, (A.y + B.y) / 2, 160, fire(0.45), 0.12 * heat * (t > TO ? 1 : 0.4), 4, 0.6);
        }
        ps.render(f);
      },
    };
  },
};

export const PYRE: SpellDef[] = [cinderCrown, furnaceWyrm, meteorLoom, ashenGuillotine];
