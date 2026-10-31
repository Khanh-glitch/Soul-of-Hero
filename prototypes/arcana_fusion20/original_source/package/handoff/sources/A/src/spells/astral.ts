// ---------------------------------------------------------------------------
// V. ASTRAL — magic that breaks reality
// ---------------------------------------------------------------------------

import { Framebuffer } from "../engine/framebuffer";
import { SpellInstance } from "../engine/types";
import { Pool } from "../engine/particles";
import { field, glow, streak, line, pulseRing } from "../engine/draw";
import {
  RNG,
  RGB,
  TAU,
  clamp,
  lerp,
  seg,
  smoothstep,
  easeOut,
  easeInOut,
  fbm,
  hash2,
} from "../engine/math";
import { ARENA_C, CASTER, ANCHORS } from "../engine/arena";
import { rampStep, shard } from "./common";

const C = ARENA_C;
const AST = (h: number) => rampStep("astral", h, 9);

// ===========================================================================
// 17 — EVENT HORIZON
// ===========================================================================
export class EventHorizon implements SpellInstance {
  rng = new RNG(0xe401);
  orbs: { a: number; r: number; sp: number; s: number; plane: number; ecc: number }[] = [];
  chunks = new Pool();
  COLLAPSE = 5.1;
  REBOUND = 5.55;

  constructor() {
    for (let i = 0; i < 70; i++)
      this.orbs.push({
        a: this.rng.angle(),
        r: this.rng.range(20, 120),
        sp: this.rng.range(0.4, 1.6) * (i % 5 === 0 ? -1 : 1),
        s: this.rng.range(0.4, 1.8),
        plane: this.rng.int(0, 2),
        ecc: this.rng.range(0.5, 1),
      });
  }

  rh(t: number) {
    const grow = seg(t, 0.4, 4.2);
    const col = seg(t, this.COLLAPSE, this.REBOUND);
    return lerp(2, 26, easeOut(grow, 2)) * (1 - easeInOut(col) * 0.98);
  }

  update(dt: number, t: number) {
    const rh = this.rh(t);
    for (const o of this.orbs) {
      const pull = 1 + (rh * 2.2) / Math.max(6, o.r);
      o.a += o.sp * dt * pull * (t > this.COLLAPSE ? 4 : 1);
      o.r -= dt * (2 + 60 / Math.max(8, o.r)) * (t > this.COLLAPSE ? 9 : 1);
      if (o.r < rh + 1) {
        o.r = this.rng.range(90, 135);
        o.a = this.rng.angle();
      }
    }
    if (t > this.REBOUND && t < this.REBOUND + 0.25 && this.chunks.count() < 300) {
      for (let i = 0; i < 40; i++) {
        const a = this.rng.angle();
        const sp = this.rng.range(80, 420);
        this.chunks.spawn({
          x: C.x,
          y: C.y,
          vx: Math.cos(a) * sp,
          vy: (Math.sin(a) * sp) / 1.5,
          life: this.rng.range(0.5, 1.6),
          size: this.rng.int(1, 4),
          seed: this.rng.int(0, 9999),
          k: this.rng.next(),
        });
      }
    }
    this.chunks.each((p) => {
      p.vx *= Math.exp(-1.7 * dt);
      p.vy *= Math.exp(-1.7 * dt);
    });
    this.chunks.step(dt);
  }

  bgWarp(t: number) {
    const rh = this.rh(t);
    const k = seg(t, 0.2, 4.0);
    if (k <= 0 && t < this.REBOUND) return null;
    const reb = seg(t, this.REBOUND, this.REBOUND + 1.4);
    const str = (1 - reb) * (0.6 + k * 2.4);
    return (x: number, y: number): [number, number, number] | null => {
      const dx = x - C.x,
        dy = (y - C.y) * 1.5;
      const r = Math.hypot(dx, dy);
      if (r < rh) return null; // the world is simply gone here
      const a = Math.atan2(dy, dx);
      // gravitational lensing + frame dragging, quantised into pixel bands
      const lens = (str * (rh * rh + 90)) / (r + 4);
      const swirl = (str * 26) / (r + 10);
      const sr = r + lens;
      const sa = a + swirl * 0.05;
      const bands = Math.round(sr / 2) * 2;
      const sx = C.x + Math.cos(sa) * bands;
      const sy = C.y + (Math.sin(sa) * bands) / 1.5;
      const mul = smoothstep(rh, rh * 1.9 + 6, r) * (1 + lens * 0.004);
      return [sx, sy, mul];
    };
  }

  casterLight(t: number) {
    return 0.15 + 0.3 * seg(t, 0, 4) + 1.0 * (1 - seg(t, this.REBOUND, this.REBOUND + 0.6));
  }

  render(fb: Framebuffer, t: number) {
    const rh = this.rh(t);
    const k = seg(t, 0.3, 4.2);
    const dark = smoothstep(this.COLLAPSE + 0.2, this.REBOUND, t) * (1 - smoothstep(this.REBOUND, this.REBOUND + 0.06, t));
    const reb = seg(t, this.REBOUND, this.REBOUND + 1.5);

    // --- accretion structure at several apparent depths
    if (reb < 0.3) {
      const vis = 1 - reb * 3;
      for (let plane = 0; plane < 3; plane++) {
        const tilt = plane * 0.9 + t * 0.1;
        const sq = [1.5, 2.8, 1.15][plane];
        const dir = plane === 1 ? -1 : 1;
        for (let ri = 0; ri < 3; ri++) {
          const rr = (rh + 10 + ri * 9 + plane * 6) * (1 + 0.05 * Math.sin(t * 2 + ri));
          const steps = 120;
          for (let s = 0; s < steps; s++) {
            const a = (s / steps) * TAU + dir * t * (0.4 + ri * 0.12);
            const lx = Math.cos(a) * rr,
              ly = (Math.sin(a) * rr) / sq;
            const x = C.x + lx * Math.cos(tilt) - ly * Math.sin(tilt);
            const y = C.y + lx * Math.sin(tilt) + ly * Math.cos(tilt);
            const doppler = 0.35 + 0.45 * (0.5 + 0.5 * Math.cos(a + tilt));
            const nz = fbm(a * 3 + ri, t * 0.6 + plane, 2);
            const c = AST(clamp(doppler * (0.5 + nz) * k * 1.3));
            fb.add(x, y, c[0] * 0.55 * vis, c[1] * 0.55 * vis, c[2] * 0.6 * vis, 1);
          }
        }
      }
      // orbiting fragments stretched by velocity
      for (const o of this.orbs) {
        if (o.r < rh) continue;
        const sq = [1.5, 2.8, 1.15][o.plane];
        const tilt = o.plane * 0.9 + t * 0.1;
        const pos = (aa: number, rr: number) => {
          const lx = Math.cos(aa) * rr,
            ly = (Math.sin(aa) * rr) / sq;
          return [C.x + lx * Math.cos(tilt) - ly * Math.sin(tilt), C.y + lx * Math.sin(tilt) + ly * Math.cos(tilt)];
        };
        const p1 = pos(o.a, o.r);
        const trail = 0.05 + (rh * 1.4) / Math.max(10, o.r);
        const p0 = pos(o.a - trail, o.r + 1.5);
        const bright = clamp(0.3 + (rh * 1.5) / Math.max(8, o.r)) * k;
        streak(fb, p0[0], p0[1], p1[0], p1[1], o.s, o.s * 0.4, AST(0.55 + bright * 0.4), bright * vis);
      }
      // photon ring
      if (rh > 1)
        for (let s = 0; s < 200; s++) {
          const a = (s / 200) * TAU;
          const rr = rh * 1.45 + Math.sin(a * 5 + t * 3) * 0.6;
          fb.add(C.x + Math.cos(a) * rr, C.y + (Math.sin(a) * rr) / 1.5, 1.8 * k, 1.5 * k, 2.6 * k, 0.8 * vis);
        }
    }

    // --- absolute darkness
    if (dark > 0) fb.exposure *= 1 - dark * 0.96;

    // --- rebound: the arena's own pixels thrown outward
    if (reb > 0) {
      const e = reb;
      fb.flash[0] += 0.4 * Math.pow(1 - clamp(e * 7), 2);
      fb.flash[2] += 0.6 * Math.pow(1 - clamp(e * 7), 2);
      pulseRing(fb, C.x, C.y, 4 + easeOut(e, 2) * 300, 12 * (1 - e) + 2, AST(0.7), (1 - e) * 0.6, 1.5, 0.3, 1.1);
      pulseRing(fb, C.x, C.y, 2 + easeOut(e, 2) * 190, 7 * (1 - e), AST(0.92), (1 - e) * 1.0, 1.5);
      this.chunks.each((p) => {
        const l = p.life / p.max;
        // each chunk carries a square of the original floor pattern
        const sx = Math.round(C.x + (p.x - C.x) * 0.35);
        const sy = Math.round(C.y + (p.y - C.y) * 0.35);
        for (let yy = 0; yy < p.size; yy++)
          for (let xx = 0; xx < p.size; xx++) {
            const i = (clamp(sy + yy, 0, fb.H - 1) * fb.W + clamp(sx + xx, 0, fb.W - 1)) * 3;
            const br = 2.5 + p.k * 3;
            fb.add(p.x + xx, p.y + yy, fb.bg[i] * br, fb.bg[i + 1] * br, fb.bg[i + 2] * br, l);
          }
        const c = AST(0.5 + l * 0.4);
        fb.add(p.x, p.y, c[0] * 0.4, c[1] * 0.4, c[2] * 0.4, l * 0.7);
      });
      // space settling back
      const settle = seg(t, this.REBOUND + 0.8, this.REBOUND + 1.8);
      if (settle > 0 && settle < 1)
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * TAU;
          const rr = (1 - settle) * 120;
          fb.add(C.x + Math.cos(a) * rr, C.y + (Math.sin(a) * rr) / 1.5, 0.6, 0.4, 1.0, (1 - settle) * 0.5);
        }
    }
  }
}

// ===========================================================================
// 18 — CHRONOSHARD
// ===========================================================================
type Clip = ((x: number, y: number) => boolean) | null;

export class Chronoshard implements SpellInstance {
  rng = new RNG(0xc710);
  P0 = { x: CASTER.x + 12, y: CASTER.y - 8 };
  P1 = ANCHORS[1];
  crystals: {
    x: number;
    y: number;
    r: number;
    a: number;
    av: number;
    seed: number;
    s: number; // the moment of time trapped inside
    born: number;
    fire: number; // activation time
    mode: number; // 0 forward 1 reverse 2 release
    ox: number;
    oy: number;
  }[] = [];
  freed = new Pool();
  FREEZE = 3.5;
  SYNC = 6.0;

  constructor() {
    const r = this.rng;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + r.range(-0.2, 0.2);
      const d = r.range(46, 86);
      this.crystals.push({
        x: C.x + Math.cos(a) * d,
        y: C.y + (Math.sin(a) * d) / 1.5,
        r: r.range(13, 22),
        a: r.angle(),
        av: r.range(-0.6, 0.6),
        seed: r.int(0, 9999),
        s: r.range(0.1, 0.95),
        born: 1.4 + i * 0.22,
        fire: 4.1 + i * 0.24,
        mode: i % 3,
        ox: 0,
        oy: 0,
      });
    }
  }

  /** the attack itself, as a pure function of its own local time s */
  attack(fb: Framebuffer, s: number, k: number, clip: Clip, ox = 0, oy = 0, scale = 1) {
    if (s < 0 || k <= 0) return;
    const put = (x: number, y: number, c: RGB, a: number) => {
      const px = C.x + (x - C.x) * scale + ox;
      const py = C.y + (y - C.y) * scale + oy;
      if (clip && !clip(px, py)) return;
      fb.add(px, py, c[0], c[1], c[2], a * k);
    };
    const u = clamp(s);
    const hx = lerp(this.P0.x, this.P1.x, easeOut(u, 1.6));
    const hy = lerp(this.P0.y, this.P1.y, easeOut(u, 1.6)) - Math.sin(u * Math.PI) * 18;
    // lance
    if (u < 1) {
      for (let i = 0; i < 20; i++) {
        const uu = Math.max(0, u - i * 0.012);
        const x = lerp(this.P0.x, this.P1.x, easeOut(uu, 1.6));
        const y = lerp(this.P0.y, this.P1.y, easeOut(uu, 1.6)) - Math.sin(uu * Math.PI) * 18;
        const f = (1 - i / 20) * 1.1;
        const c = AST(0.45 + f * 0.45);
        for (let w = -2; w <= 2; w++) put(x, y + w, c, f * (1 - Math.abs(w) / 3) * 0.8);
      }
      const c = AST(0.95);
      for (let dx = -2; dx <= 2; dx++)
        for (let dy = -2; dy <= 2; dy++)
          if (dx * dx + dy * dy <= 4) put(hx + dx, hy + dy, c, 1);
    }
    // impact
    if (s > 1) {
      const e = clamp((s - 1) / 0.9);
      const rr = easeOut(e, 2) * 46;
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU;
        const r2 = rr * (0.9 + 0.12 * Math.sin(a * 6));
        put(this.P1.x + Math.cos(a) * r2, this.P1.y + (Math.sin(a) * r2) / 1.5, AST(0.8), (1 - e) * 0.9);
      }
      for (let i = 0; i < 34; i++) {
        const a = hash2(i, 3) * TAU;
        const sp = 20 + hash2(i, 9) * 90;
        const d = easeOut(e, 2) * sp;
        put(this.P1.x + Math.cos(a) * d, this.P1.y + (Math.sin(a) * d) / 1.5, AST(0.6 + hash2(i, 5) * 0.4), (1 - e) * 0.9);
      }
    }
  }

  update(dt: number, t: number) {
    for (const c of this.crystals) {
      c.a += c.av * dt;
      // the fragments rearrange into increasingly complex configurations
      const u = seg(t, c.born, this.SYNC);
      const a = Math.atan2(c.y - C.y, c.x - C.x) + u * 1.1;
      const d = Math.hypot(c.x - C.x, (c.y - C.y) * 1.5);
      c.ox = Math.cos(a) * d - (c.x - C.x) + Math.sin(t * 1.3 + c.seed) * 5;
      c.oy = (Math.sin(a) * d) / 1.5 - (c.y - C.y) + Math.cos(t * 1.1 + c.seed) * 4;
      if (c.mode === 2 && t > c.fire && t < c.fire + 0.1 && this.freed.count() < 300) {
        for (let i = 0; i < 24; i++) {
          const aa = this.rng.angle();
          const sp = this.rng.range(30, 160);
          this.freed.spawn({
            x: c.x + c.ox,
            y: c.y + c.oy,
            vx: Math.cos(aa) * sp,
            vy: (Math.sin(aa) * sp) / 1.5,
            life: this.rng.range(0.5, 1.6),
            seed: this.rng.next() * 999,
            k: this.rng.next(),
          });
        }
      }
    }
    this.freed.each((p) => {
      p.vx *= Math.exp(-1.6 * dt);
      p.vy *= Math.exp(-1.6 * dt);
    });
    this.freed.step(dt);
  }

  casterLight(t: number) {
    return 0.25 + 0.4 * seg(t, 0, 2) + 1.1 * (1 - seg(t, this.SYNC, this.SYNC + 0.7));
  }

  render(fb: Framebuffer, t: number) {
    const main = t * 0.55;
    const frozen = t > this.FREEZE;
    const sMain = frozen ? this.FREEZE * 0.55 : main;
    const sync = seg(t, this.SYNC, this.SYNC + 1.2);

    // --- echoes: some behind the gesture, some ahead of it
    if (!frozen || sync > 0) {
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const s = sMain + i * 0.16;
        const k = (0.3 - Math.abs(i) * 0.06) * (i > 0 ? 0.8 : 1);
        this.attack(fb, s, k, null, i * 1.5, -Math.abs(i) * 1.2, 1);
      }
    }
    // the present attack
    this.attack(fb, sMain, frozen ? 0.85 : 1, null);
    if (frozen && sync <= 0) {
      // suspended: trembling stillness
      const j = Math.sin(t * 40) * 0.5;
      this.attack(fb, sMain, 0.25, null, j, -j);
    }

    // --- crystals: each one stores a different instant
    for (const c of this.crystals) {
      const g = clamp((t - c.born) * 1.7);
      if (g <= 0) continue;
      const cx = c.x + c.ox,
        cy = c.y + c.oy;
      const rr = c.r * g * (sync > 0 ? 1 - sync : 1);
      if (rr < 1) continue;
      const clip: Clip = (x, y) => Math.hypot(x - cx, (y - cy) * 1.4) < rr * 0.92;

      // the instant trapped inside, drawn small and clipped to the facet
      let inner = c.s;
      const act = t - c.fire;
      if (act > 0) {
        if (c.mode === 0) inner = c.s + act * 0.9;
        else if (c.mode === 1) inner = c.s - act * 1.1;
      }
      this.attack(fb, inner, 0.85, clip, cx - C.x - (this.P1.x - C.x) * 0.0, cy - C.y, 0.42);

      // the crystal shell
      shard(
        fb,
        cx,
        cy,
        rr,
        c.a,
        6,
        c.seed,
        (d, edge) => {
          if (edge < 1.1) return AST(0.85);
          const facet = 0.1 + 0.16 * (1 - d) + 0.1 * Math.sin(d * 9 + c.a * 4);
          const live = act > 0 && act < 0.5 ? 0.3 * (1 - act / 0.5) : 0;
          const cc = AST(clamp(facet + live));
          return [cc[0] * 0.5, cc[1] * 0.5, cc[2] * 0.55];
        },
        1.4
      );
      if (act > 0 && act < 0.35) {
        const k = 1 - act / 0.35;
        glow(fb, cx, cy, rr * 1.6, AST(0.75), k * 0.9);
      }
      // temporal thread back to the present
      if (g > 0.6)
        for (let i = 0; i < 10; i++) {
          const u = i / 10;
          const x = lerp(cx, C.x, u),
            y = lerp(cy, C.y, u);
          if (hash2(Math.floor(x), Math.floor(y + t * 10)) > 0.75)
            fb.add(x, y, 0.4, 0.3, 0.8, 0.35 * g);
        }
    }

    // --- displaced causes and effects
    for (const c of this.crystals) {
      const act = t - c.fire;
      if (act < 0 || act > 1.2) continue;
      const k = Math.max(0, 1 - act / 1.2);
      if (c.mode === 0) this.attack(fb, c.s + act * 0.9, k * 0.8, null);
      if (c.mode === 1) this.attack(fb, Math.max(0, c.s - act * 1.1), k * 0.7, null);
    }

    this.freed.each((p) => {
      const l = p.life / p.max;
      // particles briefly reconstruct their previous shapes
      const back = Math.max(0, Math.sin(l * Math.PI * 2)) * 0.4;
      const x = lerp(p.x, p.px * 0.5 + p.x * 0.5, back);
      const c = AST(0.5 + l * 0.45);
      fb.add(x, p.y, c[0], c[1], c[2], l * 0.9);
    });

    // --- synchronisation
    if (sync > 0 && sync < 1) {
      const k = Math.sin(clamp(sync * 1.5) * Math.PI);
      fb.flash[2] += 0.35 * k * k;
      fb.flash[0] += 0.2 * k * k;
      for (let i = 0; i < 2; i++) {
        pulseRing(fb, C.x, C.y, easeOut(sync, 2) * (300 - i * 90), 7, AST(0.75 - i * 0.1), (1 - sync) * 0.55, 1.5, 0.3, i * 2.3);
      }
      // every version of the attack resolves at once
      this.attack(fb, 1.0 + sync * 0.8, (1 - sync) * 1.2, null);
    }
  }
}

// ===========================================================================
// 19 — CONSTELLATION ENGINE
// ===========================================================================
export class ConstellationEngine implements SpellInstance {
  rng = new RNG(0xc057);
  stars: { x: number; y: number; bx: number; by: number; ph: number; s: number; orb: number }[] = [];
  pulses: { a: number; b: number; u: number; sp: number; life: number }[] = [];
  frags = new Pool();
  FINAL = 6.1;

  constructor() {
    const r = this.rng;
    for (let i = 0; i < 18; i++) {
      const x = r.range(70, 400),
        y = r.range(30, 210);
      this.stars.push({ x, y, bx: x, by: y, ph: r.angle(), s: r.range(0.6, 1.8), orb: r.range(0.4, 1.6) });
    }
  }

  /** the engine's node positions evolve through phases */
  pos(i: number, t: number) {
    const s = this.stars[i];
    const ph1 = smoothstep(1.6, 3.0, t);
    const ph2 = smoothstep(3.0, 4.6, t);
    const ph3 = smoothstep(4.6, this.FINAL, t);
    const fin = smoothstep(this.FINAL, this.FINAL + 0.6, t);
    // phase 1: orbit temporary geometric centres
    const gc = i % 3;
    const cxs = [C.x - 62, C.x + 64, C.x];
    const cys = [C.y - 28, C.y + 26, C.y];
    const a1 = s.ph + t * s.orb * 0.7;
    const r1 = 32 + (i % 5) * 7;
    const p1x = cxs[gc] + Math.cos(a1) * r1,
      p1y = cys[gc] + (Math.sin(a1) * r1) / 1.5;
    // phase 2: nested polygon rings
    const ring = i < 6 ? 0 : i < 12 ? 1 : 2;
    const idx = i < 6 ? i : i < 12 ? i - 6 : i - 12;
    const cnt = [6, 6, 6][ring];
    const a2 = (idx / cnt) * TAU + t * (0.4 - ring * 0.15) + ring * 0.5;
    const r2 = [34, 62, 92][ring];
    const p2x = C.x + Math.cos(a2) * r2,
      p2y = C.y + (Math.sin(a2) * r2) / 1.5;
    // phase 3 / final alignment: precise nested star figure
    const a3 = (idx / cnt) * TAU + ring * (Math.PI / 6);
    const r3 = [30, 58, 86][ring];
    const p3x = C.x + Math.cos(a3) * r3,
      p3y = C.y + (Math.sin(a3) * r3) / 1.5;
    let x = lerp(s.bx, p1x, ph1);
    let y = lerp(s.by, p1y, ph1);
    x = lerp(x, p2x, ph2);
    y = lerp(y, p2y, ph2);
    x = lerp(x, p3x, ph3);
    y = lerp(y, p3y, ph3);
    // converge to the crystalline star
    x = lerp(x, C.x, fin * 0.55);
    y = lerp(y, C.y, fin * 0.55);
    return { x, y };
  }

  /** the "search" for a mathematical solution: candidate edge sets */
  edges(t: number): [number, number, number][] {
    const out: [number, number, number][] = [];
    const n = this.stars.length;
    if (t < 1.4) {
      // flickering trial connections
      const fr = Math.floor(t * 5);
      const r = new RNG(fr * 131 + 7);
      for (let i = 0; i < 9; i++) {
        const a = r.int(0, n - 1),
          b = r.int(0, n - 1);
        if (a !== b) out.push([a, b, 0.35 * (1 - ((t * 5) % 1)) * smoothstep(0.4, 1.0, t)]);
      }
      return out;
    }
    const lock = smoothstep(1.4, 2.4, t);
    if (t < 3.0) {
      for (let i = 0; i < n; i++) out.push([i, (i + 5) % n, lock * 0.7]);
      for (let i = 0; i < n; i += 2) out.push([i, (i + 9) % n, lock * 0.5]);
      return out;
    }
    // ring structure
    for (let ring = 0; ring < 3; ring++)
      for (let k = 0; k < 6; k++) {
        const a = ring * 6 + k,
          b = ring * 6 + ((k + (ring === 1 ? 2 : 1)) % 6);
        out.push([a, b, 0.85]);
      }
    for (let k = 0; k < 6; k++) {
      out.push([k, 6 + k, 0.6]);
      out.push([6 + k, 12 + ((k + 3) % 6), 0.55]);
    }
    return out;
  }

  update(dt: number, t: number) {
    if (t > 3.2 && t < this.FINAL + 0.3 && this.pulses.length < 22 && this.rng.next() < 0.6) {
      const es = this.edges(t);
      const e = es[this.rng.int(0, es.length - 1)];
      this.pulses.push({ a: e[0], b: e[1], u: 0, sp: this.rng.range(0.8, 2.2), life: 2.5 });
    }
    for (const p of this.pulses) {
      p.u += p.sp * dt;
      p.life -= dt;
      if (p.u >= 1) {
        // pulses split and reflect at the nodes
        const es = this.edges(t).filter((e) => e[0] === p.b || e[1] === p.b);
        if (es.length && this.rng.next() < 0.8) {
          const e = es[this.rng.int(0, es.length - 1)];
          p.a = p.b;
          p.b = e[0] === p.a ? e[1] : e[0];
          p.u = 0;
        } else p.life = 0;
      }
    }
    this.pulses = this.pulses.filter((p) => p.life > 0);
    if (t > this.FINAL + 0.9 && t < this.FINAL + 1.2 && this.frags.count() < 200) {
      for (let i = 0; i < 30; i++) {
        const a = this.rng.angle();
        const sp = this.rng.range(20, 130);
        this.frags.spawn({
          x: C.x,
          y: C.y,
          vx: Math.cos(a) * sp,
          vy: (Math.sin(a) * sp) / 1.5,
          life: this.rng.range(1, 2.4),
          seed: this.rng.next() * 999,
          size: this.rng.range(0.8, 2),
        });
      }
    }
    this.frags.each((p) => {
      p.vx *= Math.exp(-0.9 * dt);
      p.vy *= Math.exp(-0.9 * dt);
    });
    this.frags.step(dt);
  }

  casterLight(t: number) {
    return 0.15 + 0.35 * seg(t, 0, 5) + 1.2 * (1 - seg(t, this.FINAL + 0.5, this.FINAL + 1.3));
  }

  render(fb: Framebuffer, t: number) {
    const fin = seg(t, this.FINAL, this.FINAL + 0.9);
    const burst = seg(t, this.FINAL + 0.85, this.FINAL + 1.9);
    const P = this.stars.map((_, i) => this.pos(i, t));

    // --- connections, drawn as luminous ribbons that pass through one another
    for (const [a, b, k0] of this.edges(t)) {
      const A = P[a],
        B = P[b];
      if (!A || !B) continue;
      const k = k0 * (1 - burst);
      if (k <= 0.01) continue;
      const n = Math.max(4, Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) / 2));
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = lerp(A.x, B.x, u),
          y = lerp(A.y, B.y, u);
        const sh = Math.sin(u * Math.PI) * 1.4;
        const c = AST(0.42 + 0.22 * Math.sin(u * 10 - t * 3));
        fb.add(x, y + sh * 0, c[0] * 0.5, c[1] * 0.5, c[2] * 0.55, k * 0.75);
      }
    }

    // --- pulses
    for (const p of this.pulses) {
      const A = P[p.a],
        B = P[p.b];
      if (!A || !B) continue;
      const x = lerp(A.x, B.x, clamp(p.u)),
        y = lerp(A.y, B.y, clamp(p.u));
      glow(fb, x, y, 4, AST(0.8), 0.8 * (1 - burst));
      fb.add(x, y, 2.6, 2.4, 3.0, 1 - burst);
    }

    // --- the stars
    for (let i = 0; i < P.length; i++) {
      const s = this.stars[i];
      const p = P[i];
      const tw = 0.6 + 0.4 * Math.sin(t * (1.4 + s.s) + s.ph);
      const k = (0.5 + tw * 0.6) * (1 - burst * 0.9) * (1 + fin * 1.2);
      glow(fb, p.x, p.y, 3 + s.s * 2.4 + fin * 4, AST(0.7), k * 0.8);
      fb.add(p.x, p.y, 2.4 * k, 2.2 * k, 3.0 * k, 1);
      // diffraction spikes
      const sp = (2 + s.s * 2) * (1 + fin * 2.2);
      for (let d = 1; d <= sp; d++) {
        const f = (1 - d / sp) * 0.5 * k;
        fb.add(p.x + d, p.y, 1.2 * f, 1.1 * f, 1.8 * f, 1);
        fb.add(p.x - d, p.y, 1.2 * f, 1.1 * f, 1.8 * f, 1);
        fb.add(p.x, p.y + d * 0.7, 1.2 * f, 1.1 * f, 1.8 * f, 1);
        fb.add(p.x, p.y - d * 0.7, 1.2 * f, 1.1 * f, 1.8 * f, 1);
      }
    }

    // --- the crystalline star
    if (fin > 0) {
      const rr = fin * 16 * (1 - burst * 0.6);
      shard(fb, C.x, C.y, rr, t * 0.5, 8, 11, (d, edge) => {
        if (edge < 1) return [3, 2.8, 3.4];
        const h = 0.4 + (1 - d) * 0.6;
        const c = AST(clamp(h));
        return [c[0] * 0.8, c[1] * 0.8, c[2] * 0.9];
      }, 1.3);
      glow(fb, C.x, C.y, 20 + fin * 34, AST(0.85), fin * 1.6);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 0.3;
        const L = fin * 60;
        streak(fb, C.x, C.y, C.x + Math.cos(a) * L, C.y + (Math.sin(a) * L) / 1.5, 2, 0.4, AST(0.9), fin);
      }
    }

    // --- precisely choreographed streams, then fracture
    if (burst > 0) {
      const e = burst;
      for (let i = 0; i < 5; i++) {
        const u = clamp((e - i * 0.07) * 2.4);
        if (u <= 0 || u >= 1) continue;
        const a = (i / 5) * TAU + 0.4;
        const L = easeOut(u, 2) * 260;
        const k = Math.sin(u * Math.PI);
        for (let s = 0; s < L; s += 1) {
          const sx = C.x + Math.cos(a) * s,
            sy = C.y + (Math.sin(a) * s) / 1.5;
          const f = (1 - s / L) * k;
          const c = AST(0.6 + f * 0.4);
          for (let w = -2; w <= 2; w++)
            fb.add(sx, sy + w, c[0] * 0.6, c[1] * 0.6, c[2] * 0.7, f * (1 - Math.abs(w) / 3));
        }
      }
      fb.flash[2] += 0.3 * Math.pow(1 - clamp(e * 5), 2);
      pulseRing(fb, C.x, C.y, e * 300, 12 * (1 - e), AST(0.7), (1 - e) * 1.1, 1.5);
    }

    this.frags.each((p) => {
      const l = p.life / p.max;
      const tw = 0.5 + 0.5 * Math.sin(t * 9 + p.seed);
      const c = AST(0.5 + l * 0.4);
      fb.add(p.x, p.y, c[0] * tw, c[1] * tw, c[2] * tw, l * 0.9);
    });
  }
}

// ===========================================================================
// 20 — REALITY RIPPER
// ===========================================================================
export class RealityRipper implements SpellInstance {
  rng = new RNG(0x7ea4);
  path: { x: number; y: number }[] = [];
  bands: { close: number; drift: number; seed: number }[] = [];
  debris = new Pool();
  OPEN = 1.0;
  COLLIDE = 5.3;
  CLOSE = 6.1;

  constructor() {
    const r = this.rng;
    // the tear's spine: an irregular line crossing the arena
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      this.path.push({
        x: lerp(56, 380, u) + r.range(-5, 5),
        y: lerp(188, 52, u) + Math.sin(u * 5.3) * 22 + r.range(-7, 7),
      });
    }
    for (let i = 0; i < 64; i++)
      this.bands.push({ close: r.range(0, 1), drift: r.range(-1, 1), seed: r.int(0, 9999) });
  }

  /** signed distance-ish helper: nearest point on the tear spine */
  near(x: number, y: number) {
    let best = 1e9,
      bu = 0,
      bx = 0,
      by = 0;
    for (let i = 0; i < this.path.length - 1; i++) {
      const a = this.path[i],
        b = this.path[i + 1];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      let u = ((x - a.x) * dx + (y - a.y) * dy) / l2;
      u = clamp(u);
      const px = a.x + dx * u,
        py = a.y + dy * u;
      const d = Math.hypot(x - px, y - py);
      if (d < best) {
        best = d;
        bu = (i + u) / (this.path.length - 1);
        bx = px;
        by = py;
      }
    }
    return { d: best, u: bu, px: bx, py: by };
  }

  /** half-width of the opening at parameter u and time t */
  halfW(u: number, t: number) {
    const len = smoothstep(this.OPEN, 3.0, t); // the line lengthens
    const within = clamp((len - Math.abs(u - 0.5) * 1.1) * 3);
    let w = within * lerp(0.6, 15, smoothstep(1.4, this.COLLIDE, t));
    if (t > this.COLLIDE) w *= 1 + 0.5 * Math.sin((t - this.COLLIDE) * 14) * Math.exp(-(t - this.COLLIDE) * 2);
    if (t > this.CLOSE) {
      const bi = Math.floor(u * this.bands.length) % this.bands.length;
      const b = this.bands[bi];
      const ct = this.CLOSE + 0.25 + b.close * 1.5;
      w *= 1 - clamp((t - ct) * (b.close > 0.9 ? 0.8 : 3.4));
      // one tiny region insists on staying open
      if (bi === 41) w *= 1 - clamp((t - this.CLOSE - 2.3) * 2.2);
    }
    // jagged pixel edges constantly breaking apart
    const fr = Math.floor(t * 20);
    w += (hash2(Math.floor(u * 160), fr) - 0.5) * 3.2 * clamp(w * 0.4);
    return Math.max(0, w);
  }

  update(dt: number, t: number) {
    if (t > this.COLLIDE && t < this.COLLIDE + 0.4 && this.debris.count() < 320) {
      for (let i = 0; i < 24; i++) {
        const u = this.rng.next();
        const p = this.path[Math.floor(u * (this.path.length - 1))];
        const a = this.rng.angle();
        const sp = this.rng.range(60, 340);
        this.debris.spawn({
          x: p.x,
          y: p.y,
          vx: Math.cos(a) * sp,
          vy: (Math.sin(a) * sp) / 1.4,
          life: this.rng.range(0.5, 1.8),
          size: this.rng.int(1, 4),
          seed: this.rng.int(0, 9999),
          k: this.rng.next(),
        });
      }
    }
    this.debris.each((p) => {
      p.vx *= Math.exp(-1.8 * dt);
      p.vy *= Math.exp(-1.8 * dt);
    });
    this.debris.step(dt);
  }

  bgWarp(t: number) {
    const pre = t < this.OPEN;
    const fr = Math.floor(t * 18);
    const pull = smoothstep(1.2, this.COLLIDE, t) * (t > this.CLOSE ? 1 - seg(t, this.CLOSE, this.CLOSE + 2.2) : 1);
    return (x: number, y: number): [number, number, number] | null => {
      // opening act: a single row of pixels looks displaced, one frame out of sync
      if (pre) {
        const n = this.near(x, y);
        if (n.d < 1.2 && t > 0.35) {
          const off = Math.round((hash2(Math.floor(n.u * 120), fr) - 0.5) * 5);
          return [x + off, y, 1];
        }
        return [x, y, 1];
      }
      const n = this.near(x, y);
      const hw = this.halfW(n.u, t);
      if (n.d < hw) return null; // the world is separated here
      // strips of the background pulled toward the opening and fractured
      const band = Math.floor(y / 3);
      const bh = hash2(band, 77);
      const dirx = x < n.px ? -1 : 1;
      let s = (pull * 46 * Math.exp(-(n.d - hw) / 34)) | 0;
      if (bh > 0.78) s = Math.round(s * (1 + bh)); // some bands stretch much further
      let sx = x - dirx * s;
      let sy = y;
      // occasionally a band is folded back into the scene at the wrong place
      if (bh > 0.93 && n.d - hw < 40 && pull > 0.4) {
        sx = n.px + (n.px - x) * 1.1;
        sy = y + Math.round((bh - 0.93) * 120);
      }
      const edgeGlow = 1 + 1.6 * Math.exp(-(n.d - hw) / 3);
      return [sx, sy, edgeGlow];
    };
  }

  casterLight(t: number) {
    return 0.1 + 0.4 * seg(t, 1, 4) + 1.2 * (1 - seg(t, this.COLLIDE, this.COLLIDE + 0.7));
  }

  render(fb: Framebuffer, t: number) {
    const live = t > this.OPEN;
    const coll = seg(t, this.COLLIDE, this.COLLIDE + 1.2);

    if (live) {
      // --- the other space, drawn only inside the opening
      const parallax = t * 20;
      field(fb, 20, 20, fb.W - 20, fb.H - 20, (x, y, o) => {
        const n = this.near(x, y);
        const hw = this.halfW(n.u, t);
        if (n.d > hw) return;
        // three parallax layers of impossible architecture; nearer layers
        // occlude farther ones, so the hole really has depth
        let r = 0.012,
          g = 0.004,
          b = 0.03;
        for (let L = 2; L >= 0; L--) {
          const sp = 0.35 + L * 1.4;
          const sc = 0.1 - L * 0.028;
          const sx = (x + parallax * sp * 2.2) * sc;
          const sy = (y - parallax * sp * 0.7) * sc + L * 7;
          const cell = Math.floor(sx) * 31 + Math.floor(sy) * 7;
          const occ = hash2(Math.floor(sx), Math.floor(sy) + L * 13);
          if (occ < 0.52 - L * 0.1) continue; // empty space: see through
          const fx = sx - Math.floor(sx),
            fy = sy - Math.floor(sy);
          const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
          const face = 0.06 + 0.16 * hash2(cell, 3) + (L === 0 ? 0.1 : 0);
          let h = face;
          if (edge < 0.07) h = 0.52 + 0.3 * hash2(cell, 9); // luminous structural edges
          const c = AST(clamp(h * (1 + coll * 0.5)));
          const f = 0.46 - L * 0.1;
          r = c[0] * f;
          g = c[1] * f;
          b = c[2] * f;
          break;
        }
        // drifting luminous debris, independent of everything
        if (hash2(Math.floor(x * 0.7 - parallax * 0.9), Math.floor(y * 0.7 + parallax * 0.3)) > 0.993) {
          r += 1.1;
          g += 0.7;
          b += 1.6;
        }
        // a horizon that should not exist
        const hz = Math.exp(-Math.pow((y - 118 + Math.sin(x * 0.04 + t) * 7) / 2.2, 2));
        r += hz * 0.4;
        g += hz * 0.18;
        b += hz * 0.75;
        // reversed shadow: the deeper you look, the brighter it gets
        const deep = clamp(1 - n.d / (hw + 0.001));
        const shade = 0.25 + deep * 0.85;
        r *= shade;
        g *= shade;
        b *= shade;
        // fragments of the battlefield reappear inside, rearranged
        const fxp = (x * 2 + Math.floor(t * 12)) % fb.W;
        const fyp = (fb.H - y + 60) % fb.H;
        const i = (fyp * fb.W + fxp) * 3;
        r += fb.bg[i] * 1.6 * deep;
        g += fb.bg[i + 1] * 1.4 * deep;
        b += fb.bg[i + 2] * 2.0 * deep;
        o[0] = r;
        o[1] = g;
        o[2] = b;
      });

      // --- the jagged luminous edge, constantly reconstructing itself
      const steps = 460;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const fi = u * (this.path.length - 1);
        const k = Math.floor(fi),
          f = fi - k;
        const a = this.path[Math.min(k, this.path.length - 2)];
        const b2 = this.path[Math.min(k + 1, this.path.length - 1)];
        const px = lerp(a.x, b2.x, f),
          py = lerp(a.y, b2.y, f);
        let nx = -(b2.y - a.y),
          ny = b2.x - a.x;
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        const hw = this.halfW(u, t);
        if (hw <= 0.05) continue;
        for (const side of [-1, 1]) {
          const ex = px + nx * hw * side,
            ey = py + ny * hw * side;
          const flick = 0.6 + 0.4 * hash2(i, Math.floor(t * 24));
          const c = AST(0.7 + 0.3 * flick);
          fb.add(ex, ey, c[0], c[1], c[2], 0.9 * flick);
          fb.add(ex + nx * side, ey + ny * side, c[0] * 0.4, c[1] * 0.4, c[2] * 0.5, 0.6);
          // pixel teeth
          if (hash2(i, Math.floor(t * 12) + side) > 0.86) {
            const tl = 1 + hash2(i, 5) * 3;
            for (let s = 1; s <= tl; s++)
              fb.add(ex + nx * side * s, ey + ny * side * s, c[0] * 0.5, c[1] * 0.5, c[2] * 0.6, 0.5);
          }
        }
      }
    } else {
      // --- opening act : it reads as a rendering artifact
      const n = Math.floor(t * 18);
      const r = new RNG(n);
      if (t > 0.3)
        for (let i = 0; i < 3; i++) {
          const u = r.next();
          const fi = u * (this.path.length - 1);
          const p = this.path[Math.floor(fi)];
          const c = AST(0.6);
          const w = r.int(1, 5);
          for (let k = 0; k < w; k++) fb.add(p.x + k, p.y, c[0] * 0.6, c[1] * 0.6, c[2] * 0.7, 0.5);
        }
    }

    // --- collision
    if (coll > 0 && coll < 1) {
      const e = coll;
      fb.flash[0] += 0.4 * Math.pow(1 - clamp(e * 7), 2);
      fb.flash[2] += 0.5 * Math.pow(1 - clamp(e * 7), 2);
      const mid = this.path[Math.floor(this.path.length / 2)];
      pulseRing(fb, mid.x, mid.y, easeOut(e, 2) * 320, 14 * (1 - e), AST(0.7), (1 - e) * 1.2, 1.4);
      // spatial echoes: ghost copies of the tear offset in space
      for (let i = 1; i <= 3; i++) {
        const k = (1 - e) * 0.3 / i;
        const ox = i * 9 * Math.sin(t * 7 + i),
          oy = i * -6;
        for (let s = 0; s < this.path.length - 1; s++)
          line(
            fb,
            this.path[s].x + ox,
            this.path[s].y + oy,
            this.path[s + 1].x + ox,
            this.path[s + 1].y + oy,
            AST(0.6),
            k
          );
      }
    }

    // --- displaced ground textures flung out of the wound
    this.debris.each((p) => {
      const l = p.life / p.max;
      const sx = Math.round(p.px),
        sy = Math.round(p.py);
      for (let yy = 0; yy < p.size; yy++)
        for (let xx = 0; xx < p.size; xx++) {
          const i = (clamp(sy + yy, 0, fb.H - 1) * fb.W + clamp(sx + xx, 0, fb.W - 1)) * 3;
          const br = 2.2 + p.k * 3.4;
          fb.add(p.x + xx, p.y + yy, fb.bg[i] * br, fb.bg[i + 1] * br, fb.bg[i + 2] * br, l);
        }
      if (p.k > 0.6) {
        const c = AST(0.55 + l * 0.4);
        fb.add(p.x, p.y, c[0] * 0.5, c[1] * 0.5, c[2] * 0.6, l * 0.8);
      }
    });

    // --- stitching: some pixels snap, others drift into alignment
    const st = seg(t, this.CLOSE, this.CLOSE + 2.6);
    if (st > 0 && st < 1) {
      for (let i = 0; i < 90; i++) {
        const b = this.bands[i % this.bands.length];
        const u = (i * 37) % 100 / 100;
        const fi = u * (this.path.length - 1);
        const p = this.path[Math.floor(fi)];
        const ct = b.close;
        const k = clamp((st - ct * 0.6) * 3);
        if (k <= 0 || k >= 1) continue;
        const off = (1 - k) * 22 * b.drift;
        const c = AST(0.55);
        fb.add(p.x + off, p.y + off * 0.3, c[0] * 0.7, c[1] * 0.7, c[2] * 0.8, (1 - k) * 0.8);
      }
    }
  }
}
