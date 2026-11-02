/** #01 source-A crown lead, mechanically adapted from original A pyre.ts.
 * This component alone is not the voted A+C fusion or visual acceptance. */
import {Framebuffer} from './engine/framebuffer';
import {Pool,streakP} from './engine/particles';
import {field,fieldMul,glow,streak,ribbon,pulseRing,line,type RibbonPt} from './engine/draw';
import {RNG,R,TAU,clamp,lerp,seg,smoothstep,easeOut,fbm,vnoise} from './engine/math';
import {heatShimmer} from './heatShimmer';
const C={x:232,y:124};
const fireCol=(h:number,steps=9)=>R('fire',Math.floor(clamp(h)*steps)/steps);
export class CinderCrown {
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

