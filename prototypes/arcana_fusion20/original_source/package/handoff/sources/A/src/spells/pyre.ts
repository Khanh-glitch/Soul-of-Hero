// ---------------------------------------------------------------------------
// I. PYRE — fire as a living catastrophe
// ---------------------------------------------------------------------------

import { Framebuffer } from "../engine/framebuffer";
import { SpellInstance } from "../engine/types";
import { Pool, streakP } from "../engine/particles";
import {
  field,
  fieldMul,
  glow,
  streak,
  ribbon,
  pulseRing,
  line,
  RibbonPt,
} from "../engine/draw";
import {
  RNG,
  R,
  TAU,
  clamp,
  lerp,
  seg,
  smoothstep,
  easeOut,
  fbm,
  vnoise,
  hash2,
} from "../engine/math";
import { ARENA_C, CASTER, ANCHORS } from "../engine/arena";
import { fireCol, flameBlob, heatShimmer, growBranches, updateBranches, drawBranch, Branch, scarDecal } from "./common";

const C = ARENA_C;

// ===========================================================================
// 01 — CINDER CROWN
// ===========================================================================
export class CinderCrown implements SpellInstance {
  rng = new RNG(0xc01d);
  frags: {
    a: number;
    r: number;
    sp: number;
    size: number;
    sx: number;
    sy: number;
    x: number;
    y: number;
    px: number;
    py: number;
    spike: number;
    w: number;
    tail: number;
    delay: number;
  }[] = [];
  suns: { r: number; sp: number; ph: number; s: number }[] = [];
  petals: { a: number; len: number; curve: number; delay: number; sp: number; w: number; back: number }[] = [];
  ash = new Pool();
  t = 0;

  constructor() {
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.rng.range(-0.08, 0.08);
      const sa = this.rng.angle();
      this.frags.push({
        a,
        r: 30 + this.rng.range(-4, 5),
        sp: this.rng.range(-1.5, 1.5) * (i % 3 === 0 ? 2.4 : 1),
        size: this.rng.range(1.6, 4.2),
        sx: C.x + Math.cos(sa) * this.rng.range(150, 260),
        sy: C.y + Math.sin(sa) * this.rng.range(110, 190),
        x: 0,
        y: 0,
        px: 0,
        py: 0,
        spike: this.rng.range(8, 26) * (i % 2 ? 1 : 0.62),
        w: this.rng.range(0.1, 0.26),
        tail: this.rng.next() < 0.45 ? 1 : 0,
        delay: this.rng.range(0, 0.55),
      });
    }
    for (let i = 0; i < 3; i++)
      this.suns.push({
        r: 9 + i * 5.5,
        sp: this.rng.range(1.4, 3.4) * this.rng.sign(),
        ph: this.rng.angle(),
        s: this.rng.range(1.4, 2.6),
      });
    for (let i = 0; i < 11; i++) {
      this.petals.push({
        a: (i / 11) * TAU + this.rng.range(-0.22, 0.22),
        len: this.rng.range(46, 148),
        curve: this.rng.range(-1.5, 1.5),
        delay: this.rng.range(0, 0.42),
        sp: this.rng.range(0.7, 1.9),
        w: this.rng.range(7, 20),
        back: this.rng.next() < 0.28 ? 1 : 0,
      });
    }
  }

  update(dt: number, t: number) {
    this.t = t;
    // ash / embers
    if (t > 3.95 && t < 5.6 && this.ash.count() < 260) {
      for (let i = 0; i < 7; i++) {
        const a = this.rng.angle();
        const sp = this.rng.range(20, 150);
        this.ash.spawn({
          x: C.x + Math.cos(a) * this.rng.range(0, 24),
          y: C.y + Math.sin(a) * this.rng.range(0, 18),
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp * 0.7 - 12,
          life: this.rng.range(0.7, 2.4),
          size: this.rng.range(0.6, 1.8),
          k: this.rng.range(0.5, 1),
          seed: this.rng.next() * 1000,
        });
      }
    }
    if (t > 1.0 && t < 3.3 && this.ash.count() < 150 && this.rng.next() < 0.55) {
      const a = this.rng.angle();
      this.ash.spawn({
        x: C.x + Math.cos(a) * 60,
        y: C.y + Math.sin(a) * 46,
        vx: -Math.cos(a) * 34,
        vy: -Math.sin(a) * 28,
        life: 1.4,
        size: 1,
        k: 0.6,
        seed: this.rng.next() * 1000,
      });
    }
    this.ash.each((p) => {
      p.vy -= 26 * dt;
      p.vx *= Math.exp(-1.1 * dt);
      p.vy *= Math.exp(-0.9 * dt);
    });
    this.ash.step(dt, 0);

    const gather = seg(t, 0, 1.55);
    for (const f of this.frags) {
      f.px = f.x;
      f.py = f.y;
      const g = easeOut(clamp((gather - f.delay * 0.3) / 0.9), 2.6);
      const ang = f.a + f.sp * t;
      const collapse = 1 - 0.92 * smoothstep(3.0, 3.8, t);
      const tx = C.x + Math.cos(ang) * f.r * collapse;
      const ty = C.y + (Math.sin(ang) * f.r * collapse) / 1.25;
      f.x = lerp(f.sx, tx, g);
      f.y = lerp(f.sy, ty, g);
    }
  }

  casterLight(t: number) {
    return 0.3 + 0.9 * smoothstep(3.9, 4.1, t) * (1 - seg(t, 4.1, 5.5)) + 0.3 * seg(t, 0, 3);
  }

  render(fb: Framebuffer, t: number) {
    const build = seg(t, 1.1, 3.0);
    const inhale = seg(t, 3.0, 3.86);
    const blackout = smoothstep(3.78, 3.9, t) * (1 - smoothstep(3.93, 3.99, t));
    const burst = seg(t, 3.95, 5.4);
    const after = seg(t, 5.2, 6.4);

    // --- gathering trails
    for (const f of this.frags) {
      const d = Math.hypot(f.x - f.px, f.y - f.py);
      if (d > 0.5 && t < 3.9) {
        const c = fireCol(0.55 + clamp(d / 14) * 0.45);
        streak(fb, f.px, f.py, f.x, f.y, f.size * 0.5, f.size * 0.9, c, 0.9);
      }
    }

    // --- crown body (polar silhouette with spikes + hollow interior)
    if (build > 0 && burst < 1) {
      const open = 1 - inhale * 0.55;
      const base = 26 * open;
      const bright = 1 - blackout * 0.98;
      const rMax = 60;
      const frags = this.frags;
      field(fb, C.x - rMax, C.y - rMax / 1.2, C.x + rMax, C.y + rMax / 1.2, (x, y, o) => {
        const dx = x + 0.5 - C.x,
          dy = (y + 0.5 - C.y) * 1.2;
        const d = Math.hypot(dx, dy);
        if (d > rMax) return;
        const a = Math.atan2(dy, dx);
        // spike profile
        let surf = base;
        for (const f of frags) {
          const ang = f.a + f.sp * t;
          let da = Math.abs(((a - ang + Math.PI * 3) % TAU) - Math.PI);
          const g = Math.exp(-(da * da) / (f.w * f.w * 2));
          surf += f.spike * g * build * (1 - inhale * 0.72);
        }
        const flick = fbm(Math.cos(a) * 3 + 11, Math.sin(a) * 3 - t * 2.2, 3);
        surf *= 0.82 + flick * 0.34;
        const inner = base * 0.52 * (1 - inhale * 0.9);
        if (d > surf || d < inner) return;
        let h = Math.min((surf - d) / 9, (d - inner) / 5);
        h = clamp(h) * build;
        // edge rim stays incandescent while the interior is swallowed
        const rim = clamp(1 - Math.abs(d - surf) / 2.1);
        let heat = lerp(h * 0.85, 0.08, inhale * 0.85) * bright;
        heat += rim * (0.55 + inhale * 0.9);
        const c = fireCol(clamp(heat));
        o[0] = c[0];
        o[1] = c[1];
        o[2] = c[2];
      });

      // inner architecture : heated spokes + filaments
      const spokeK = build * (1 - inhale * 0.3);
      for (let i = 0; i < this.frags.length; i++) {
        const f = this.frags[i];
        const ang = f.a + f.sp * t;
        const r1 = (base * 0.52 + (f.spike * build) / 2) * (1 - inhale * 0.6);
        const c = fireCol(0.55 + 0.35 * Math.sin(t * 7 + i) * (1 - blackout));
        line(
          fb,
          C.x + Math.cos(ang) * base * 0.5,
          C.y + (Math.sin(ang) * base * 0.5) / 1.2,
          C.x + Math.cos(ang) * (base + r1 * 0.6),
          C.y + (Math.sin(ang) * (base + r1 * 0.6)) / 1.2,
          c,
          spokeK * 0.75 * (1 - blackout)
        );
      }
      // revolving suns
      for (const s of this.suns) {
        const a = s.ph + s.sp * t;
        const rr = s.r * (1 - inhale * 0.8);
        const sx = C.x + Math.cos(a) * rr,
          sy = C.y + (Math.sin(a) * rr) / 1.2;
        glow(fb, sx, sy, s.s * 2.6 * (1 - blackout * 0.9), R("fire", 0.92), 1.1 * build);
        fb.add(sx, sy, 3, 2.6, 2, build * (1 - blackout * 0.8));
      }
      // the core swallowing light
      const coreR = lerp(3, 10, inhale) * (1 - blackout * 0.5);
      glow(fb, C.x, C.y, coreR * 1.5, R("fire", 0.9), 0.4 + inhale * 1.1);
      if (inhale > 0.2) {
        fieldMul(fb, C.x - 46, C.y - 40, C.x + 46, C.y + 40, (x, y) => {
          const d = Math.hypot(x - C.x, (y - C.y) * 1.2);
          return d < 30 ? lerp(1, 0.2, inhale * clamp(1 - d / 30)) : 1;
        });
      }
    }

    // --- collapse flash & petal unfolding
    if (burst > 0 && burst < 1) {
      const e = burst;
      for (const p of this.petals) {
        const u = clamp((e - p.delay * 0.3) * p.sp);
        if (u <= 0) continue;
        const grow = easeOut(u, 4.5);
        const len = p.len * grow * (p.back ? 0.6 + 0.4 * Math.sin(u * 3) : 1);
        const pts: RibbonPt[] = [];
        const steps = 12;
        const r0 = 14 + u * 26;
        for (let i = 0; i <= steps; i++) {
          const s = i / steps;
          const a = p.a + p.curve * s * s * 0.75 * (p.back ? -1.5 : 1);
          const rr = r0 + len * s;
          pts.push({ x: C.x + Math.cos(a) * rr, y: C.y + (Math.sin(a) * rr) / 1.22 });
        }
        const fade = 1 - clamp((u - 0.55) / 0.45);
        ribbon(
          fb,
          pts,
          (s) => p.w * (0.2 + Math.sin(Math.pow(s, 0.8) * Math.PI) * 0.95) * (1 - u * 0.3),
          (s, _i, edge) => {
            const n = fbm(s * 7 + p.a * 4, edge * 4 - t * 3.4, 3);
            let h = (1 - edge) * (1 - s * 0.5) * (0.35 + n * 0.75) * fade * 0.95;
            if (h < 0.06) return null;
            return fireCol(clamp(h));
          }
        );
      }
      // asymmetric shock + flash
      const fl = Math.pow(1 - clamp(burst * 9), 2);
      fb.flash[0] += 0.45 * fl;
      fb.flash[1] += 0.22 * fl;
      fb.flash[2] += 0.08 * fl;
      pulseRing(fb, C.x, C.y, 10 + easeOut(burst, 2) * 210, 5 * (1 - burst), R("fire", 0.62), 0.45 * (1 - burst) ** 2, 1.25);
      heatShimmer(fb, C.x, C.y, 70 + burst * 60, t, 3 * (1 - burst));
    }

    // --- aftermath: the explosion remembers the crown
    if (after > 0) {
      const k = (1 - after) * 0.9;
      for (const f of this.frags) {
        const ang = f.a + f.sp * 3.9;
        const rr = (26 + f.spike * 0.8) * (1 + after * 0.25);
        const x = C.x + Math.cos(ang) * rr,
          y = C.y + (Math.sin(ang) * rr) / 1.2;
        const flick = 0.5 + 0.5 * vnoise(f.a * 9, t * 5);
        glow(fb, x, y, 3.4, fireCol(0.42 * flick), k * 1.2);
      }
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * TAU;
        const rr = 26 * (1 + after * 0.25);
        const f = 0.5 + 0.5 * Math.sin(a * 7 + t * 2);
        fb.add(
          C.x + Math.cos(a) * rr,
          C.y + (Math.sin(a) * rr) / 1.2,
          0.6,
          0.18,
          0.05,
          k * f * 0.8
        );
      }
    }

    // --- embers
    this.ash.each((p) => {
      const l = p.life / p.max;
      const c = fireCol(l * 0.95 * p.k + 0.05);
      streakP(fb, p, c, l * 0.9);
      if (p.size > 1.3) fb.add(p.x, p.y, c[0], c[1], c[2], l);
    });
  }
}

// ===========================================================================
// 02 — FURNACE WYRM
// ===========================================================================
interface Hist {
  x: number;
  y: number;
}
export class FurnaceWyrm implements SpellInstance {
  rng = new RNG(0x7a31);
  hist: Hist[] = [];
  head = { x: CASTER.x + 8, y: CASTER.y - 6, a: -1.2, v: 0 };
  waypoints: { x: number; y: number }[] = [];
  wi = 0;
  embers = new Pool();
  minis: { h: Hist[]; life: number; max: number }[] = [];
  impactT = -1;
  t = 0;
  SEGS = 72;

  constructor() {
    const tgt = ANCHORS[0];
    const r = this.rng;
    this.waypoints = [
      { x: CASTER.x + 30, y: CASTER.y - 30 },
      { x: 180, y: 56 },
      { x: 300, y: 48 },
      { x: 370, y: 120 },
      { x: 300, y: 180 },
      { x: 200, y: 180 },
      { x: 150, y: 120 },
      { x: 240, y: 78 },
      { x: 340, y: 150 },
      { x: 280, y: 196 },
      { x: tgt.x - 70, y: tgt.y + 40 },
      { x: tgt.x, y: tgt.y },
    ].map((p) => ({ x: p.x + r.range(-6, 6), y: p.y + r.range(-6, 6) }));
    for (let i = 0; i < 400; i++) this.hist.push({ x: this.head.x, y: this.head.y });
  }

  update(dt: number, t: number) {
    this.t = t;
    const emerge = seg(t, 0.35, 1.0);
    const strike = t > 4.55;
    if (t < 0.35) return;

    // steering
    const speed = strike ? 520 : lerp(60, 340, emerge) * (1 + 0.35 * Math.sin(t * 3.3));
    let tgt = this.waypoints[Math.min(this.wi, this.waypoints.length - 1)];
    if (strike) tgt = ANCHORS[0];
    if (this.impactT > 0) return;
    const want = Math.atan2(tgt.y - this.head.y, tgt.x - this.head.x);
    let da = ((want - this.head.a + Math.PI * 3) % TAU) - Math.PI;
    if (strike) this.head.a = want;
    else this.head.a += clamp(da, -4.2 * dt, 4.2 * dt);
    // serpentine wobble
    const wob = Math.sin(t * 7.5) * (strike ? 0.05 : 0.55);
    const ax = Math.cos(this.head.a + wob) * speed;
    const ay = Math.sin(this.head.a + wob) * speed;
    this.head.x = clamp(this.head.x + ax * dt, 26, 392);
    this.head.y = clamp(this.head.y + ay * dt, 24, 212);
    if (Math.hypot(tgt.x - this.head.x, tgt.y - this.head.y) < 26 && !strike)
      this.wi = Math.min(this.wi + 1, this.waypoints.length - 1);

    const steps = Math.max(1, Math.round(dt / (1 / 120)));
    for (let i = 0; i < steps; i++) this.hist.unshift({ x: this.head.x, y: this.head.y });
    this.hist.length = 400;

    if (strike && this.impactT < 0 && Math.hypot(ANCHORS[0].x - this.head.x, ANCHORS[0].y - this.head.y) < 22) {
      this.impactT = t;
      this.head.x = ANCHORS[0].x;
      this.head.y = ANCHORS[0].y;
    }

    // shed embers
    if (t > 0.9 && t < 5.2) {
      for (let i = 0; i < 3; i++) {
        const idx = this.rng.int(2, 120);
        const h = this.hist[idx];
        this.embers.spawn({
          x: h.x + this.rng.range(-3, 3),
          y: h.y + this.rng.range(-3, 3),
          vx: this.rng.range(-30, 30),
          vy: this.rng.range(-50, 10),
          life: this.rng.range(0.4, 1.3),
          size: this.rng.range(0.5, 1.6),
          seed: this.rng.next() * 999,
        });
      }
      if (this.rng.next() < 0.06 && this.minis.length < 8) {
        const idx = this.rng.int(20, 180);
        const h = this.hist[idx];
        const a = this.rng.angle();
        const pts: Hist[] = [];
        for (let i = 0; i < 26; i++)
          pts.push({ x: h.x + Math.cos(a) * i * 1.2, y: h.y + Math.sin(a) * i * 1.2 });
        this.minis.push({ h: pts, life: 1.1, max: 1.1 });
      }
    }
    for (const m of this.minis) {
      m.life -= dt;
      const head = m.h[0];
      const a = Math.atan2(head.y - m.h[1].y, head.x - m.h[1].x) + Math.sin(t * 11 + m.max * 7) * 0.5;
      m.h.unshift({ x: head.x + Math.cos(a) * 2.4, y: head.y + Math.sin(a) * 2.4 });
      m.h.length = 26;
    }
    this.minis = this.minis.filter((m) => m.life > 0);

    this.embers.each((p) => {
      p.vy -= 40 * dt;
      p.vx *= Math.exp(-1.6 * dt);
    });
    this.embers.step(dt);
  }

  casterLight(t: number) {
    return 0.25 + 0.6 * seg(t, 0, 1) + (this.impactT > 0 ? 1.4 * (1 - seg(t, this.impactT, this.impactT + 0.5)) : 0);
  }

  render(fb: Framebuffer, t: number) {
    const emerge = seg(t, 0.0, 1.0);
    const strike = t > 4.55;
    const imp = this.impactT > 0 ? seg(t, this.impactT, this.impactT + 1.6) : 0;

    // molten crack under the caster
    if (t < 2.4) {
      const k = (1 - seg(t, 1.4, 2.6)) * easeOut(seg(t, 0, 0.35), 2);
      for (let i = -18; i <= 18; i++) {
        const n = vnoise(i * 0.3, 3.1);
        const h = (1 - Math.abs(i) / 19) * k * (0.5 + n * 0.8);
        const c = fireCol(h);
        fb.add(CASTER.x + 10 + i, CASTER.y + 3 + Math.round(n * 2 - 1), c[0], c[1], c[2], 1);
      }
      glow(fb, CASTER.x + 10, CASTER.y + 3, 16 * k, R("fire", 0.6), 0.8 * k);
    }
    if (t < 0.35) return;

    // --- body: sample history with delay; the head leads, body lags in waves
    const n = this.SEGS;
    const eaten = this.impactT > 0 ? easeOut(seg(t, this.impactT, this.impactT + 0.26), 2) : 0;
    const bodyLen =
      lerp(40, 235, easeOut(emerge, 2)) *
      (strike ? lerp(1, 0.3, easeOut(seg(t, 4.55, 5.0), 2)) : 1) *
      (1 - eaten);
    if (bodyLen < 2) return this.renderImpact(fb, t, imp);
    const pts: RibbonPt[] = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const idx = Math.min(399, Math.floor(u * bodyLen));
      const h = this.hist[idx];
      pts.push({ x: h.x, y: h.y });
    }
    // measure local stretch to brighten fast turns
    const widthAt = (u: number) => {
      const headBulge = Math.exp(-u * u * 170) * (strike ? 14 * easeOut(seg(t, 4.75, 5.1)) : 0);
      const taper = Math.pow(1 - u, 0.85);
      const bulge = 1 + 0.3 * Math.sin(u * 22 - t * 9);
      return (1.1 + 11.5 * taper * bulge) * (0.4 + 0.6 * emerge) + headBulge;
    };

    // outer heat haze
    ribbon(
      fb,
      pts,
      (u) => widthAt(u) * 1.8,
      (u, _i, e) => {
        const f = (1 - e) * (1 - e) * 0.085 * (1 - u * 0.6);
        return [f * 1.0, f * 0.2, f * 0.04];
      }
    );
    // molten body
    ribbon(
      fb,
      pts,
      (u) => widthAt(u),
      (u, i, e) => {
        const nz = fbm(u * 26 + t * 2.2, e * 3 + i * 0.3, 3);
        // deep crimson skin, orange flesh, only the spine is white-hot
        let h = Math.pow(1 - e * e, 1.7) * (0.34 + nz * 0.42) * (1 - u * 0.5) + 0.07 * (1 - e);
        const scale = Math.sin(u * 150 - t * 16) > 0.8 ? 0.16 : 0;
        h += scale * (1 - e) * (1 - u);
        if (h < 0.05) return null;
        return fireCol(clamp(h * (0.45 + 0.55 * emerge)));
      }
    );
    // white-hot spine
    ribbon(
      fb,
      pts,
      (u) => Math.max(0.35, widthAt(u) * 0.16),
      (u, _i, e) => {
        const h = (1 - e) * (1 - u * 0.9) * (0.55 + 0.45 * vnoise(u * 30, t * 6));
        if (h < 0.12) return null;
        return R("fire", 0.74 + h * 0.26);
      }
    );

    // head / maw
    const hd = pts[0];
    const a0 = Math.atan2(hd.y - pts[2].y, hd.x - pts[2].x);
    const mawOpen = strike ? easeOut(seg(t, 4.7, 5.05), 2) : 0.08 + 0.06 * Math.sin(t * 6);
    for (let j = 0; j < 7; j++) {
      const sp = (j / 6 - 0.5) * mawOpen * 2.6;
      const len = 9 + mawOpen * 26;
      const ex = hd.x + Math.cos(a0 + sp) * len,
        ey = hd.y + Math.sin(a0 + sp) * len;
      streak(fb, hd.x, hd.y, ex, ey, 3.0 * (1 - mawOpen * 0.3), 0.7, fireCol(0.66), 0.8);
    }
    flameBlob(fb, hd.x, hd.y, 7 + mawOpen * 9, t, 3.7, 0.85);
    glow(fb, hd.x, hd.y, 16 + mawOpen * 22, R("fire", 0.55), 0.3);
    // eyes
    fb.add(hd.x + Math.cos(a0 + 1.3) * 4, hd.y + Math.sin(a0 + 1.3) * 4, 3, 3, 2.6, 1);
    fb.add(hd.x + Math.cos(a0 - 1.3) * 4, hd.y + Math.sin(a0 - 1.3) * 4, 3, 3, 2.6, 1);

    // mini serpents
    for (const m of this.minis) {
      const k = clamp(m.life / m.max);
      ribbon(
        fb,
        m.h,
        (u) => 1.6 * (1 - u) * k,
        (u, _i, e) => fireCol((1 - e) * (1 - u) * k * 1.1)
      );
    }

    // embers
    this.embers.each((p) => {
      const l = p.life / p.max;
      streakP(fb, p, fireCol(l * 0.9), l * 0.8);
    });

    this.renderImpact(fb, t, imp);
  }

  renderImpact(fb: Framebuffer, t: number, imp: number) {
    {
      const A = ANCHORS[0];
      if (imp <= 0) return;
      const e = imp;
      fb.flash[0] += 0.55 * Math.pow(1 - clamp(e * 6), 2);
      fb.flash[1] += 0.22 * Math.pow(1 - clamp(e * 6), 2);
      // a single turbulent shock front of incandescent dust
      {
        const u = clamp(e * 1.6);
        if (u < 1) {
          pulseRing(fb, A.x, A.y, 8 + easeOut(u, 2) * 150, 18 * (1 - u) + 3, R("fire", 0.42), 0.22 * Math.pow(1 - u, 2.2), 1.4, 0.4, 1.7);
          pulseRing(fb, A.x, A.y, 4 + easeOut(u, 2) * 96, 7 * (1 - u) + 2, R("fire", 0.72), 0.3 * Math.pow(1 - u, 2.2), 1.4, 0.3, 4.3);
        }
      }
      // molten debris streams, irregular and short-lived
      for (let i = 0; i < 20; i++) {
        const a = hash2(i, 7) * TAU;
        const sp = 40 + hash2(i, 9) * 130;
        const u = clamp(e * (0.8 + hash2(i, 11) * 1.4));
        const rr = easeOut(u, 2) * sp;
        const k = Math.pow(1 - u, 1.6);
        streak(
          fb,
          A.x + Math.cos(a) * rr * 0.72,
          A.y + (Math.sin(a) * rr * 0.72) / 1.5,
          A.x + Math.cos(a) * rr,
          A.y + (Math.sin(a) * rr) / 1.5,
          2.4 * k,
          0.5,
          fireCol(0.3 + 0.5 * k),
          0.9
        );
      }
      flameBlob(fb, A.x, A.y, 36 * Math.pow(1 - e, 0.8), t, 9.1, 1.1 * Math.pow(1 - e, 1.6), 1.5);
      heatShimmer(fb, A.x, A.y, 70, t, 4 * Math.pow(1 - e, 2));
    }
  }
}

// ===========================================================================
// 03 — METEOR LOOM
// ===========================================================================
interface Meteor {
  x: number;
  y: number;
  tx: number;
  ty: number;
  t0: number;
  dur: number;
  size: number;
  seed: number;
  arc: number;
  split: number;
  hit: number;
}
export class MeteorLoom implements SpellInstance {
  rng = new RNG(0x3eed);
  ms: Meteor[] = [];
  frags = new Pool();
  dust = new Pool();
  scars: { x: number; y: number; bs: Branch[]; t0: number }[] = [];
  t = 0;

  constructor() {
    const r = this.rng;
    const targets = [
      { x: 150, y: 150, t0: 0.5, dur: 1.5, s: 11, arc: 1 },
      { x: 300, y: 90, t0: 1.6, dur: 0.6, s: 8, arc: -1.4 },
      { x: 240, y: 180, t0: 2.2, dur: 0.9, s: 13, arc: 0.6 },
      { x: 330, y: 160, t0: 2.9, dur: 0.55, s: 7, arc: -0.7 },
      { x: 196, y: 82, t0: 3.3, dur: 0.7, s: 9, arc: 1.2 },
      { x: 268, y: 124, t0: 3.9, dur: 0.6, s: 16, arc: 0.2 },
    ];
    for (const T of targets) {
      const a = r.angle();
      this.ms.push({
        x: T.x + Math.cos(a) * 420,
        y: T.y - 300 - r.range(0, 80),
        tx: T.x,
        ty: T.y,
        t0: T.t0,
        dur: T.dur,
        size: T.s,
        seed: r.int(0, 9999),
        arc: T.arc,
        split: r.next() < 0.5 ? 1 : 0,
        hit: 0,
      });
    }
  }

  update(dt: number, t: number) {
    this.t = t;
    for (const m of this.ms) {
      const u = seg(t, m.t0, m.t0 + m.dur);
      if (u >= 1 && !m.hit) {
        m.hit = 1;
        const rng = new RNG(m.seed);
        const bs: Branch[] = [];
        for (let i = 0; i < 5 + Math.floor(m.size / 3); i++)
          bs.push(
            ...growBranches(rng, m.tx, m.ty, rng.angle(), m.size * 0.22, {
              steps: 7,
              step: m.size * 0.55,
              wander: 0.5,
              branchChance: 0.14,
              maxDepth: 2,
              widthFalloff: 0.55,
              speed: 2.2,
            })
          );
        this.scars.push({ x: m.tx, y: m.ty, bs, t0: t });
        for (let i = 0; i < 44; i++) {
          const a = rng.angle();
          const sp = rng.range(30, 210) * (m.size / 10);
          this.dust.spawn({
            x: m.tx,
            y: m.ty,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp * 0.55 - rng.range(0, 70),
            life: rng.range(0.6, 2.2),
            size: rng.range(0.6, 2.4),
            k: rng.next(),
            seed: rng.next() * 999,
          });
        }
      }
      // shed burning fragments on the way down
      if (u > 0 && u < 1 && this.rng.next() < 0.4) {
        const p = this.pos(m, u);
        this.frags.spawn({
          x: p.x,
          y: p.y,
          vx: this.rng.range(-50, 50),
          vy: this.rng.range(40, 150),
          life: this.rng.range(0.4, 1.1),
          size: this.rng.range(0.7, 2),
          seed: this.rng.next() * 999,
        });
      }
    }
    this.frags.each((p) => (p.vy += 160 * dt));
    this.frags.step(dt);
    this.dust.each((p) => {
      p.vy -= 30 * dt;
      p.vx *= Math.exp(-1.4 * dt);
      p.vy *= Math.exp(-1.2 * dt);
    });
    this.dust.step(dt);
    for (const s of this.scars) updateBranches(s.bs, t - s.t0);
  }

  pos(m: Meteor, u: number) {
    const e = u * u * (3 - 2 * u) * 0.25 + u * 0.75;
    const x = lerp(m.x, m.tx, e);
    const y = lerp(m.y, m.ty, e) + Math.sin(u * Math.PI) * m.arc * 30;
    return { x, y };
  }

  casterLight(t: number) {
    let k = 0.2;
    for (const s of this.scars) k += 0.5 * (1 - seg(t, s.t0, s.t0 + 0.6));
    return clamp(k, 0, 2);
  }

  render(fb: Framebuffer, t: number) {
    // --- scars (molten fractures) : older ones reheat when neighbours land
    for (const s of this.scars) {
      const age = t - s.t0;
      let heat = 0.95 * Math.exp(-age * 0.55);
      for (const o of this.scars)
        if (o !== s && o.t0 > s.t0) heat += 0.75 * Math.exp(-Math.abs(t - o.t0) * 2.4);
      scarDecal(fb, s.bs, clamp(heat, 0, 1.3), t);
      glow(fb, s.x, s.y, 13 * clamp(heat), R("fire", 0.32), 0.2 * clamp(heat));
      heatShimmer(fb, s.x, s.y, 34, t, 1.6 * clamp(heat));
    }

    // --- meteors + ground shadows + approach light
    for (const m of this.ms) {
      const u = seg(t, m.t0, m.t0 + m.dur);
      if (u <= 0 || u >= 1) continue;
      const p = this.pos(m, u);
      // ground shadow and rising light tell the story of the unseen sky
      const sr = lerp(m.size * 2.6, m.size * 0.9, u);
      for (let y = -sr; y <= sr; y++)
        for (let x = -sr * 1.6; x <= sr * 1.6; x++) {
          const d = Math.hypot(x / (sr * 1.6), y / sr);
          if (d > 1) continue;
          fb.mul(m.tx + x, m.ty + y + 4, lerp(0.45, 1, d * d));
        }
      glow(fb, m.tx, m.ty, lerp(10, 44, u * u), R("fire", 0.45), 0.25 + u * u * 0.9);

      // trail
      for (let i = 1; i < 16; i++) {
        const uu = Math.max(0, u - i * 0.012);
        const q = this.pos(m, uu);
        const k = (1 - i / 16) * 0.8;
        glow(fb, q.x, q.y, m.size * (0.9 - i * 0.04), fireCol(0.75 - i * 0.035), k);
      }
      // irregular body: fractured volcanic glass with a luminous interior
      const sz = m.size;
      field(fb, p.x - sz * 1.6, p.y - sz * 1.6, p.x + sz * 1.6, p.y + sz * 1.6, (x, y, o) => {
        const dx = x - p.x,
          dy = y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > sz * 1.6) return;
        const a = Math.atan2(dy, dx);
        const surf = sz * (0.6 + 0.45 * vnoise(Math.cos(a) * 2 + m.seed, Math.sin(a) * 2));
        if (d > surf) return;
        const crack = vnoise(x * 0.5 + m.seed, y * 0.5);
        const core = 1 - d / surf;
        let h = core * 0.5 + (crack > 0.62 ? core * 0.9 : 0) + 0.06;
        const c = fireCol(clamp(h));
        o[0] = c[0];
        o[1] = c[1];
        o[2] = c[2];
      });
    }

    this.frags.each((p) => {
      const l = p.life / p.max;
      streakP(fb, p, fireCol(0.45 + l * 0.5), l);
    });
    this.dust.each((p) => {
      const l = p.life / p.max;
      const c = fireCol(l * l * 0.75 * (0.4 + p.k));
      fb.add(p.x, p.y, c[0] * 0.8, c[1] * 0.7, c[2] * 0.7, l * 0.85);
    });

    // --- climax: the impact scars were tracing one enormous sigil
    const sig = seg(t, 4.75, 6.4);
    if (sig > 0 && this.scars.length >= 5) {
      const pts = this.scars.map((s) => ({ x: s.x, y: s.y }));
      const order = [0, 3, 1, 4, 2, 5, 0];
      const k = Math.sin(clamp(sig * 1.4) * Math.PI) * 1.4;
      for (let i = 0; i < order.length - 1; i++) {
        const a = pts[order[i] % pts.length],
          b = pts[order[i + 1] % pts.length];
        const draw = clamp((sig * 5.2 - i) * 1.6);
        if (draw <= 0) continue;
        const ex = lerp(a.x, b.x, draw),
          ey = lerp(a.y, b.y, draw);
        streak(fb, a.x, a.y, ex, ey, 2.0, 2.0, R("fire", 0.5), k * 0.5);
        line(fb, a.x, a.y, ex, ey, R("fire", 0.88), k * 0.9);
      }
      if (sig > 0.45) {
        const f = Math.sin(clamp(seg(t, 5.4, 6.0)) * Math.PI);
        for (const s of this.scars) glow(fb, s.x, s.y, 9 + f * 12, R("fire", 0.72), f * 0.5);
        pulseRing(fb, C.x, C.y, 40 + f * 190, 26, R("fire", 0.3), f * 0.12, 1.5, 0.16, 2.7);
        fb.flash[0] += f * 0.1;
        fb.flash[1] += f * 0.035;
      }
    }
  }
}

// ===========================================================================
// 04 — ASHEN GUILLOTINE
// ===========================================================================
export class AshenGuillotine implements SpellInstance {
  rng = new RNG(0xa5e1);
  embers = new Pool();
  sections: { x0: number; x1: number; delay: number; depth: number; seed: number }[] = [];
  plates: { x: number; y: number; vx: number; vy: number; r: number; a: number; av: number; seed: number }[] = [];
  veins: Branch[] = [];
  cutY = 132;
  cutA = -0.17;
  CUT_T = 3.52;

  constructor() {
    const r = this.rng;
    let x = 24;
    while (x < 404) {
      const w = r.range(18, 52);
      this.sections.push({
        x0: x,
        x1: Math.min(404, x + w),
        delay: r.range(0, 0.75),
        depth: r.range(0.5, 1),
        seed: r.int(0, 9999),
      });
      x += w;
    }
    for (let i = 0; i < 26; i++) {
      const px = r.range(30, 390);
      this.plates.push({
        x: px,
        y: this.cutY + (px - 208) * Math.tan(this.cutA) + r.range(-6, 6),
        vx: r.range(-20, 20),
        vy: r.sign() * r.range(18, 70),
        r: r.range(4, 13),
        a: r.angle(),
        av: r.range(-2, 2),
        seed: r.int(0, 9999),
      });
    }
    const vr = new RNG(991);
    for (let i = 0; i < 16; i++) {
      const px = vr.range(40, 380);
      const py = this.cutY + (px - 208) * Math.tan(this.cutA);
      this.veins.push(
        ...growBranches(vr, px, py, vr.sign() * (Math.PI / 2) + vr.range(-0.5, 0.5), 1.4, {
          steps: 6,
          step: 5,
          wander: 0.55,
          branchChance: 0.2,
          maxDepth: 2,
          widthFalloff: 0.6,
          speed: 1.1,
        })
      );
    }
  }

  lineY(x: number) {
    return this.cutY + (x - 208) * Math.tan(this.cutA);
  }

  update(dt: number, t: number) {
    const post = t - this.CUT_T;
    if (post > 0) updateBranches(this.veins, post - 0.35);
    if (post > 0.1 && post < 2.0) {
      for (const s of this.sections) {
        if (post < 0.35 + s.delay) continue;
        if (this.rng.next() < 0.25) {
          const x = this.rng.range(s.x0, s.x1);
          this.embers.spawn({
            x,
            y: this.lineY(x),
            vx: this.rng.range(-18, 18),
            vy: -this.rng.range(30, 150) * s.depth,
            life: this.rng.range(0.6, 1.8),
            size: this.rng.range(0.6, 2),
            k: s.depth,
            seed: this.rng.next() * 999,
          });
        }
      }
    }
    // pre-cut: embers aligning toward the slit
    if (t < this.CUT_T && t > 0.25) {
      if (this.rng.next() < 0.7) {
        const a = this.rng.angle();
        const d = this.rng.range(30, 150);
        this.embers.spawn({
          x: 208 + Math.cos(a) * d,
          y: this.cutY + Math.sin(a) * d * 0.7,
          vx: 0,
          vy: 0,
          life: 2.2,
          size: 1,
          k: 0.4,
          tag: 1,
          seed: this.rng.next() * 999,
        });
      }
    }
    this.embers.each((p) => {
      if (p.tag === 1) {
        const dx = 208 - p.x,
          dy = this.cutY - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * 26 * dt;
        p.vy += (dy / d) * 26 * dt;
        p.vx *= Math.exp(-0.9 * dt);
        p.vy *= Math.exp(-0.9 * dt);
      } else {
        p.vy += 24 * dt;
        p.vx *= Math.exp(-1.2 * dt);
      }
    });
    this.embers.step(dt);
    if (post > 0) {
      for (const pl of this.plates) {
        const k = clamp(post / 0.6);
        pl.x += pl.vx * dt * k;
        pl.y += pl.vy * dt * k * 0.5;
        pl.a += pl.av * dt * k;
        pl.vx *= Math.exp(-1.6 * dt);
        pl.vy *= Math.exp(-1.6 * dt);
      }
    }
  }

  casterLight(t: number) {
    return 0.1 + 0.3 * seg(t, 2.2, 3.4) + 1.3 * (1 - seg(t, this.CUT_T, this.CUT_T + 0.5));
  }

  render(fb: Framebuffer, t: number) {
    const pre = seg(t, 0.2, 2.2);
    const mass = seg(t, 2.15, this.CUT_T);
    const post = t - this.CUT_T;

    // --- light draining out of the air around the slit
    if (t < this.CUT_T + 0.2) {
      const k = pre * 0.8;
      fieldMul(fb, 100, 20, 320, 230, (x, y) => {
        const d = Math.hypot((x - 208) / 110, (y - this.cutY) / 100);
        return lerp(1, lerp(0.25, 1, clamp(d)), k);
      });
    }

    // --- phase 1 : a thin vertical slit of pale heat
    if (t < this.CUT_T) {
      const h = lerp(14, 150, easeOut(pre, 2));
      const w = lerp(0.55, 2.2, mass);
      for (let y = -h / 2; y <= h / 2; y++) {
        const f = (1 - Math.abs(y) / (h / 2)) * (0.55 + pre * 0.9);
        const flick = 0.7 + 0.3 * vnoise(y * 0.3, t * 9);
        const c = R("fire", 0.88 + 0.12 * flick);
        for (let x = -w; x <= w; x++)
          fb.add(208 + x, this.cutY + y, c[0], c[1], c[2], f * (1 - Math.abs(x) / (w + 1)) * flick);
      }
      glow(fb, 208, this.cutY, 12 + pre * 26, R("fire", 0.72), 0.25 + pre * 0.4);
    }

    // --- phase 2 : the monumental blade becomes perceptible
    if (mass > 0 && t < this.CUT_T) {
      const m = easeOut(mass, 1.6);
      const halfLen = 190 * m;
      const halfW = lerp(1, 26, m);
      const cy = this.cutY - lerp(0, 0, 0);
      field(fb, 208 - halfLen - 8, cy - halfW - 10, 208 + halfLen + 8, cy + halfW + 10, (x, y, o) => {
        // local frame along the cut axis
        const dx = x - 208,
          dy = y - cy - dx * Math.tan(this.cutA);
        if (Math.abs(dx) > halfLen) return;
        const edge = Math.abs(dy) / halfW;
        if (edge > 1) return;
        const taper = 1 - Math.pow(Math.abs(dx) / halfLen, 2.4);
        const bandn = vnoise(dx * 0.06, dy * 0.3 + t * 1.4);
        // layered thermal bands with jagged black gaps
        const bandv = Math.abs(Math.sin(dy * 0.5 + bandn * 3.4 + dx * 0.012));
        const gap = vnoise(dx * 0.1 + 20, dy * 0.08 - t * 0.7) > 0.58 ? 0 : 1;
        let h = (1 - edge * edge) * taper * (0.35 + bandv * 0.55) * gap;
        // compressed white fire visible through the gaps
        if (!gap && Math.abs(dy) < halfW * 0.4) h = taper * 0.95 * (0.4 + 0.6 * bandn);
        h *= m * 1.15;
        if (h < 0.05) return;
        const c = fireCol(clamp(h));
        o[0] = c[0];
        o[1] = c[1];
        o[2] = c[2];
      });
      // molten outline
      for (let dx = -halfLen; dx <= halfLen; dx += 1) {
        const taper = 1 - Math.pow(Math.abs(dx) / halfLen, 2.4);
        const yy = cy + dx * Math.tan(this.cutA);
        const hw = halfW * taper + vnoise(dx * 0.2, t * 2) * 2;
        const c = R("fire", 0.95);
        fb.add(208 + dx, yy - hw, c[0], c[1], c[2], 0.7 * m);
        fb.add(208 + dx, yy + hw, c[0], c[1], c[2], 0.7 * m);
      }
      // anticipation: everything holds absolutely still, then —
      if (t > this.CUT_T - 0.18) {
        fb.exposure *= lerp(1, 0.45, seg(t, this.CUT_T - 0.18, this.CUT_T));
      }
    }

    // --- the cut: a razor-thin incandescent line, the after-silhouette held
    //     by the hit-stop. Thin and sharp, never a soft band.
    if (post > 0 && post < 0.3) {
      const k = 1 - post / 0.3;
      for (let dx = -200; dx <= 200; dx++) {
        const yy = this.lineY(208 + dx);
        const taper = 1 - Math.pow(Math.abs(dx) / 200, 3);
        const w = (1 + 5 * k) * taper;
        for (let o = -w; o <= w; o += 0.5) {
          const f = Math.pow(1 - Math.abs(o) / (w + 0.5), 2) * k * taper;
          const c = R("fire", 0.8 + 0.2 * f);
          fb.add(208 + dx, yy + o, c[0], c[1], c[2], f * 0.6);
        }
        fb.add(208 + dx, yy, 3, 2.8, 2.4, k * taper);
      }
    }

    // --- the wound (explosion arrives late, opening in sections)
    if (post > 0) {
      for (const s of this.sections) {
        const open = clamp((post - 0.12 - s.delay) * 1.5);
        if (open <= 0) continue;
        const decay = Math.exp(-Math.max(0, post - 1.2 - s.delay) * 0.7);
        const w = open * 9 * s.depth * decay + 1;
        for (let x = s.x0; x <= s.x1; x++) {
          const yy = this.lineY(x);
          const nz = vnoise(x * 0.14 + s.seed, t * 0.6);
          const ww = w * (0.6 + nz * 0.8);
          for (let dy = -ww; dy <= ww; dy++) {
            const e = Math.abs(dy) / ww;
            // deeper strata revealed toward the centre of the wound
            const strat = 1 - e;
            const deep = vnoise(x * 0.3 + s.seed, dy * 0.4 - t * 2.2);
            let h = strat * (0.55 + deep * 0.7) * decay * s.depth * 1.25;
            if (e > 0.88) h *= 0.25; // charred lip
            const c = fireCol(clamp(h));
            fb.add(x, yy + dy, c[0], c[1], c[2], 1);
          }
        }
        if (open > 0.4)
          glow(fb, (s.x0 + s.x1) / 2, this.lineY((s.x0 + s.x1) / 2), 16 * s.depth * decay, R("fire", 0.5), 0.5 * decay);
      }
      // lateral molten veins
      for (const b of this.veins)
        drawBranch(
          fb,
          b,
          (u, e) => {
            const decay = Math.exp(-Math.max(0, post - 1.6) * 0.8);
            const flick = 0.72 + 0.28 * vnoise(u * 20 + b.seed, post * 4);
            const h = Math.pow(1 - e, 1.4) * (1 - u * 0.75) * decay * 1.05 * flick;
            if (h < 0.04) return null;
            return fireCol(h);
          },
          (u, bb) => Math.max(0.5, bb.w * (1 - u * 0.7))
        );
      // separating burning plates
      for (const pl of this.plates) {
        const k = clamp(post / 0.5) * Math.exp(-Math.max(0, post - 1.4) * 0.9);
        if (k < 0.03) continue;
        field(fb, pl.x - pl.r, pl.y - pl.r, pl.x + pl.r, pl.y + pl.r, (x, y, o) => {
          const dx = x - pl.x,
            dy = y - pl.y;
          const d = Math.hypot(dx, dy);
          if (d > pl.r) return;
          const a = Math.atan2(dy, dx) + pl.a;
          const surf = pl.r * (0.55 + 0.42 * vnoise(Math.cos(a) * 2 + pl.seed, Math.sin(a) * 2));
          if (d > surf) return;
          const crust = vnoise(x * 0.5 + pl.seed, y * 0.5);
          // charred plate: dark crust, molten light only through broken cracks
          // and on the leading (lower) lip — no closed outline ring
          const lip = clamp(1 - (surf - d) / 1.6) * (dy > 0 ? 1 : 0) * (crust > 0.45 ? 1 : 0);
          let h = 0.04 + lip * 0.3 + (crust > 0.68 ? 0.3 : 0) * (1 - d / surf);
          const c = fireCol(h * k);
          o[0] = c[0] * 0.85;
          o[1] = c[1] * 0.8;
          o[2] = c[2] * 0.8;
        });
      }
      heatShimmer(fb, 208, this.cutY, 170, t, 3.4 * Math.exp(-post * 0.8));

      // --- final scar
      const sc = Math.exp(-Math.max(0, post - 2.0) * 0.45);
      for (let x = 24; x < 404; x++) {
        const yy = this.lineY(x);
        const nz = vnoise(x * 0.2, 5);
        const c = fireCol(0.28 * sc * (0.5 + nz));
        fb.add(x, yy + Math.round(nz * 1.6 - 0.8), c[0], c[1], c[2], 0.9);
        fb.mul(x, yy + 2, lerp(0.5, 1, 1 - sc));
      }
    }

    this.embers.each((p) => {
      const l = p.life / p.max;
      const c = fireCol(l * (0.4 + p.k * 0.7));
      streakP(fb, p, c, l * 0.9);
    });
  }
}
