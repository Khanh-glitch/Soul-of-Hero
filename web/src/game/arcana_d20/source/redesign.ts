// ============================================================================
// REDESIGN implementations for the 6 creator-rejected slots (#04 #06 #12 #13
// #14 #18). These are NEW authored compositions built from the vendored C
// engine primitives (Frame ink/light/disp, kit bolts/trees/particles) — NOT
// copies of the rejected A/B/C spells and NOT RGB blends. Each has a distinct
// identity, anticipation -> execution -> peak -> impact -> aftermath -> OUT,
// ground contact, and returns the world unchanged at the end.
// Visual-only; still candidates until creator approval.
// ============================================================================
import { Frame, W, H } from './c/engine/frame';
import { Rng, clamp, lerp, smooth, easeOut, easeIn, easeInOut, TAU, type V2 } from './c/engine/math';
import { P, ramp, type RGB } from './c/engine/palette';
import { Particles, boltPts, boltTree, drawBolt, drawBoltTree, growTree, drawTree, shock, haze, randPoly, xform, type Pt } from './c/engine/kit';
import type { FX, Inst, SpellDef } from './c/spells/types';

const CX = 192, CY = 128, GY = 176; // cast center + ground line

const seg = (t: number, a: number, b: number) => clamp((t - a) / Math.max(b - a, 1e-6), 0, 1);

// ---------------------------------------------------------------- #04 Ashen Guillotine
// diagonal world-space cut: thin slit telegraph -> white blade -> delayed
// rupture with directional ground cracks and embers. (creator note: diagonal,
// readable, C fire column + A crack as study material)
const ashen: SpellDef = {
  id: 4, name: 'Ashen Guillotine', school: 'PYRE', dur: 7.2, climax: 4.1, blurb: 'redesign',
  make: (rng, fx) => ({
    update(dt, t) { if (t > 1.55 && t < 1.75) fx.shake(6); if (t > 4.0 && t < 4.25) { fx.flash([1, 0.5, 0.2], 0.5); fx.kick(2); } },
    render(f, t) {
      const a0 = -0.62, x0 = CX - 130 * Math.cos(a0), y0 = CY - 60 - 130 * Math.sin(a0) * 0.62;
      const x1 = CX + 130 * Math.cos(a0), y1 = CY - 60 + 130 * Math.sin(a0) * 0.62;
      const tele = seg(t, 0.2, 1.1);           // slit telegraph
      if (tele > 0) f.line(x0, y0, lerp(x0, x1, tele), lerp(y0, y1, tele), (x, y) => f.Id(x, y, [0.05, 0.03, 0.02], 0.85));
      const blade = seg(t, 1.15, 1.5);         // the cut itself
      if (blade > 0) {
        const bx = lerp(x0, x1, easeOut(blade)), by = lerp(y0, y1, easeOut(blade));
        const burn = 1 - seg(t, 4.6, 6.2);      // blade cools after the rupture
        if (burn > 0) f.line(x0, y0, bx, by, (x, y) => { f.L(x, y, 3.2 * burn, 2.6 * burn, 1.6 * burn); f.I(x, y, 1, 0.92, 0.7, 0.9 * burn); });
        shock(f, CX, CY - 40, 40 + 120 * blade, 7, 5 * (1 - blade * 0.5), 0.62);
      }
      const rup = seg(t, 4.0, 4.35) * (1 - seg(t, 5.9, 7.1)); // delayed rupture, then cools
      if (rup > 0) {
        f.ribbon([{ x: x0, y: y0 }, { x: CX, y: CY - 40 }, { x: x1, y: y1 }], 5 * rup + 1.5, (x, y, _s, e) => {
          if (Math.abs(e) > 0.5) return;
          f.Lc(x, y, ramp(P.fire, 1 - Math.abs(e)), 2.4 * rup * (1 - Math.abs(e)));
        });
        // directional ground cracks from the cut line
        for (let k = 0; k < 5; k++) {
          const px = lerp(x0, x1, (k + 0.5) / 5), py = lerp(y0, y1, (k + 0.5) / 5) + 26;
          drawBoltTree(f, boltTree(rng.next() * 999 | 0, px, GY - 4, px + (rng.next() - 0.5) * 60, GY + 8 + rng.next() * 10, 2, 0.4), rup * 1.2, [1, 0.55, 0.2], [1, 0.3, 0.1]);
        }
      }
      const fade = 1 - seg(t, 5.6, 7.0);        // scorch + cooling embers
      if (fade > 0) {
        f.line(x0, y0, x1, y1, (x, y) => f.Gc(x, y + 24, [0.09, 0.05, 0.04], 0.55 * fade));
        for (let k = 0; k < 26 * fade; k++) {
          const px = lerp(x0, x1, rng.next()), py = lerp(y0, y1, rng.next()) + 20 + rng.next() * 10;
          f.Lc(px | 0, py | 0, ramp(P.fire, rng.next()), 0.5 * fade);
        }
      }
    },
  }),
};

// ---------------------------------------------------------------- #06 Riptide Calligraphy
// water-brush strokes: flowing calligraphic curves that draw themselves across
// the ground, pool at the end, foam droplets; readable glyph-like swirl at peak.
const riptide: SpellDef = {
  id: 6, name: 'Riptide Calligraphy', school: 'TIDE', dur: 7.6, climax: 5.2, blurb: 'redesign',
  make: (rng, fx) => {
    const ps = new Particles();
    return {
      update(dt, t) { ps.update(dt); if (t > 5.2 && t < 5.4) { fx.shake(4); fx.flash([0.4, 0.8, 1.2], 0.3); } },
      render(f, t) {
        const draw = seg(t, 0.4, 4.6) * (1 - seg(t, 6.7, 7.5)); // strokes draw themselves, then dissolve
        const strokes: V2[][] = [
          Array.from({ length: 24 }, (_, i) => { const u = i / 23; return { x: CX - 150 + 300 * u, y: GY - 6 - Math.sin(u * Math.PI) * 34 - u * 10 }; }),
          Array.from({ length: 24 }, (_, i) => { const u = i / 23; return { x: CX - 120 + 240 * u, y: GY + 8 - Math.sin(u * Math.PI * 2) * 16 }; }),
          Array.from({ length: 20 }, (_, i) => { const u = i / 19, a = -2.2 + u * 3.6; return { x: CX + Math.cos(a) * 52 * u, y: CY + 6 + Math.sin(a) * 30 * u }; }),
        ];
        const water = P.water;
        for (const st of strokes) {
          const n = Math.max(2, Math.floor(st.length * draw));
          f.ribbon(st.slice(0, n), 3.2, (x, y, _s, e) => {
            if (Math.abs(e) > 0.55) return;
            f.Lc(x, y, ramp(water, 1 - Math.abs(e) * 0.8), 1.5 * (1 - Math.abs(e)));
            if (Math.abs(e) < 0.2) f.Ic(x, y, [0.75, 0.9, 1.0], 0.5);
          });
        }
        const peak = seg(t, 4.6, 5.2) * (1 - seg(t, 6.4, 7.4)); // glyph swirl + pool
        if (peak > 0) {
          f.glow(CX, CY + 4, 60 * peak, ramp(water, 0.4), 1.2 * peak, 5, 0.7);
          haze(f, CX, CY, 90 * peak, t, 0.5 * peak, 0.62);
          for (let k = 0; k < 40; k++) { const a = rng.next() * TAU, r = rng.next() * 46 * peak; f.Lc(CX + Math.cos(a) * r, CY + 8 + Math.sin(a) * r * 0.6, ramp(water, rng.next()), 0.8 * peak); }
          f.Gc(CX, GY + 12, [0.06, 0.12, 0.18], 0.5 * peak); // pool darkening on ground
        }
        for (let k = 0; k < 30; k++) { // foam droplets
          const u = rng.next() * draw;
          ps.add({ x: CX - 150 + 300 * u, y: GY - 10 - rng.next() * 26, vx: (rng.next() - 0.5) * 14, vy: -18 - rng.next() * 22, max: 1.2, kind: 'foam', size: 1 + rng.next() * 2, seed: rng.next() * 99 } as Pt);
        }
        for (const p of ps.list) { const lf = p.max ? clamp(p.life / p.max, 0, 1) : 0; if (p.y < GY + 14) f.Lc(p.x | 0, p.y | 0, [0.8, 0.92, 1], (1 - lf) * 0.8); }
      },
    };
  },
};

// ---------------------------------------------------------------- #12 Skybreaker Script
// arcane script burned into the sky: rune ring draws stroke by stroke, then the
// sky splits and a verdict bolt falls; runes fade as aftermath.
const skybreaker: SpellDef = {
  id: 12, name: 'Skybreaker Script', school: 'TEMPEST', dur: 8.8, climax: 7.14, blurb: 'redesign',
  make: (rng, fx) => ({
    update(dt, t) { if (t > 6.9 && t < 7.15) { fx.shake(7); fx.flash([0.7, 0.7, 1.2], 0.6); fx.kick(3); } },
    render(f, t) {
      const ring = seg(t, 0.5, 3.4); // rune ring strokes
      if (ring > 0) {
        const rr = 62;
        for (let k = 0; k < 8; k++) {
          const a0 = k / 8 * TAU, a1 = a0 + TAU / 8 * 0.82 * ring;
          const pts = Array.from({ length: 12 }, (_, i) => { const a = lerp(a0, a1, i / 11); return { x: CX + Math.cos(a) * rr, y: CY - 26 + Math.sin(a) * rr * 0.5 }; });
          f.ribbon(pts, 1.6, (x, y) => f.Lc(x, y, ramp(P.volt, 0.6), 1.8));
          // glyph ticks
          const am = (a0 + a1) / 2;
          f.line(CX + Math.cos(am) * rr, CY - 26 + Math.sin(am) * rr * 0.5, CX + Math.cos(am) * (rr + 9), CY - 26 + Math.sin(am) * (rr + 9) * 0.5, (x, y) => f.L(x, y, 0.6, 0.6, 1.4));
        }
        f.glow(CX, CY - 26, 70 * ring * (1 - seg(t, 6.4, 7.6)), [0.5, 0.5, 1], 0.5, 4, 0.5);
      }
      const fall = seg(t, 6.9, 7.3); // the sky breaks: main bolt + branching
      if (fall > 0) {
        drawBolt(f, boltPts(7, CX, -4, CX + 6, GY, 0.06, 3), 2.6, [1, 1, 1], [0.55, 0.6, 1.3], 2.2, fall);
        drawBoltTree(f, boltTree(11, CX + 6, GY * 0.5, CX - 60, GY - 8, 4, 0.3, 1), 1.4 * fall, [0.8, 0.85, 1.4], [0.4, 0.5, 1.1]);
        drawBoltTree(f, boltTree(23, CX + 6, GY * 0.6, CX + 70, GY - 4, 4, 0.3, 1), 1.2 * fall, [0.8, 0.85, 1.4], [0.4, 0.5, 1.1]);
        shock(f, CX, GY - 6, 30 + 90 * fall, 6, 4 * (1 - fall * 0.4), 0.5);
      }
      const fade = 1 - seg(t, 7.6, 8.6); // aftermath: cracks + fading runes
      if (fall > 0 && fade > 0) {
        for (let k = 0; k < 4; k++) drawBoltTree(f, boltTree(31 + k, CX + (rng.next() - 0.5) * 40, GY - 2, CX + (rng.next() - 0.5) * 130, GY + 6, 2, 0.45), fade * 0.9, [0.75, 0.8, 1.2], [0.35, 0.42, 0.9]);
      }
    },
  }),
};

// ---------------------------------------------------------------- #13 Rootwake
// roots burst from the ground and branch into a thorned canopy with glowing
// tips, then sink back. Directional, grounded, verdant.
const rootwake: SpellDef = {
  id: 13, name: 'Rootwake', school: 'VERDANT', dur: 7.4, climax: 4.6, blurb: 'redesign',
  make: (rng, fx) => {
    const ps = new Particles();
    const trees = Array.from({ length: 5 }, (_, k) => growTree(rng, { x: CX + (k - 2) * 26 + rng.r(-8, 8), y: GY + 2, ang: -Math.PI / 2 + rng.r(-0.5, 0.5), step: 7, steps: 12, speed: 420, branch: 0.5, spread: 0.8, jitter: 0.5, maxDepth: 3, t0: 0.5 + k * 0.22 }));
    return {
      update(dt, t) { ps.update(dt); if (t > 4.6 && t < 4.8) { fx.shake(5); fx.flash([0.5, 1, 0.5], 0.25); } },
      render(f, t) {
        const grow = seg(t, 0.4, 4.4);
        for (const segs of trees) drawTree(f, segs, t, (x, y, s, age) => {
          const g = clamp(age * 2, 0, 1);
          f.Ic(x, y, [0.07, 0.09, 0.04], 0.95); // woody ink
          if (s.depth >= 2) f.Lc(x, y, ramp(P.leaf, rng.next()), (0.5 + 0.5 * g) * grow * (1 - seg(t, 6.2, 7.2))); // glowing tips
        });
        const pulse = seg(t, 4.4, 4.8) * (1 - seg(t, 6.0, 7.2));
        if (pulse > 0) { f.glow(CX, GY - 40, 90 * pulse, ramp(P.leaf, 0.5), 1.0 * pulse, 5, 0.6); shock(f, CX, GY, 60 * pulse + 20, 5, 3, 0.5); }
        for (let k = 0; k < 22; k++) ps.add({ x: CX + rng.r(-70, 70), y: GY - rng.next() * 60, vx: rng.r(-8, 8), vy: 10 + rng.next() * 16, max: 1.6, kind: 'petal', size: 1 + rng.next() * 2, seed: rng.next() * 99 } as Pt);
        for (const p of ps.list) { const lf = p.max ? clamp(p.life / p.max, 0, 1) : 0; f.Lc(p.x | 0, p.y | 0, ramp(P.leaf, rng.next()), (1 - lf) * 0.7 * (1 - seg(t, 6.4, 7.3))); }
        const sink = seg(t, 6.0, 7.3); // roots sink: ground darkens briefly then releases
        if (sink > 0 && sink < 1) f.Gc(CX, GY + 4, [0.05, 0.08, 0.03], 0.4 * (1 - sink));
      },
    };
  },
};

// ---------------------------------------------------------------- #14 Spore Nebula
// a drifting nebula of spores that condenses, blooms at peak, and settles as
// glowing motes. Soft haze + discrete pixel spores (no generic glow ball).
const spore: SpellDef = {
  id: 14, name: 'Spore Nebula', school: 'VERDANT', dur: 8.0, climax: 5.6, blurb: 'redesign',
  make: (rng, fx) => {
    const ps = new Particles();
    const blobs = Array.from({ length: 7 }, (_, k) => ({ x: CX + rng.r(-90, 90), y: CY - 10 + rng.r(-40, 30), r: rng.r(22, 46), ph: rng.next() * TAU }));
    return {
      update(dt, t) { ps.update(dt); if (t > 5.6 && t < 5.8) { fx.flash([0.7, 1, 0.6], 0.35); fx.kick(1.5); } },
      render(f, t) {
        const condense = seg(t, 0.3, 3.6);
        for (const b of blobs) { // nebula haze condensing toward center
          const bx = lerp(b.x, CX, easeInOut(condense)), by = lerp(b.y, CY - 6, easeInOut(condense));
          haze(f, bx, by, b.r * (0.6 + 0.4 * condense), t * 0.7 + b.ph, 0.34 * condense * (1 - seg(t, 6.6, 7.8)), 0.62);
        }
        for (let k = 0; k < 60; k++) { // discrete spore motes orbiting
          const a = t * (0.4 + rng.next() * 0.5) + rng.next() * TAU, r = (30 + rng.next() * 80) * (1 - seg(t, 6.6, 7.8) * 0.5);
          ps.add({ x: CX + Math.cos(a) * r, y: CY - 6 + Math.sin(a) * r * 0.55, vx: 0, vy: -4, max: 2.2, kind: 'spore', size: 1 + rng.next() * 2, seed: rng.next() * 99 } as Pt);
        }
        for (const p of ps.list) { const lf = p.max ? clamp(p.life / p.max, 0, 1) : 0; f.Lc(p.x | 0, p.y | 0, ramp(P.spore, rng.next()), (1 - lf) * 0.85); }
        const bloom = seg(t, 5.4, 5.9) * (1 - seg(t, 6.8, 7.9)); // peak bloom
        if (bloom > 0) { f.glow(CX, CY - 6, 110 * bloom, ramp(P.leaf, 0.35), 1.4 * bloom, 6, 0.6); shock(f, CX, CY - 6, 40 + 110 * bloom, 8, 5 * bloom, 0.6, 1.5); }
        const settle = 1 - seg(t, 7.0, 7.9);
        if (settle > 0) for (let k = 0; k < 20 * settle; k++) f.Lc(CX + rng.r(-60, 60) | 0, GY - rng.next() * 8, ramp(P.leaf, rng.next()), 0.5 * settle); // motes settle on ground
      },
    };
  },
};

// ---------------------------------------------------------------- #18 Chronoshard
// a crystalline shard falls, splits on impact into temporal fragments, sweeps a
// clock-hand across the arena, then dissolves into star motes.
const chrono: SpellDef = {
  id: 18, name: 'Chronoshard', school: 'ASTRAL', dur: 8.2, climax: 4.4, blurb: 'redesign',
  make: (rng, fx) => {
    const ps = new Particles();
    const shard = randPoly(rng, 7, 26, 0.35);
    return {
      update(dt, t) { ps.update(dt); if (t > 4.3 && t < 4.5) { fx.shake(6); fx.flash([0.8, 0.7, 1.3], 0.5); fx.kick(2.5); } },
      render(f, t) {
        const fall = seg(t, 0.4, 2.6); // shard descends with trail
        const sy = lerp(CY - 120, GY - 30, easeIn(fall));
        if (fall > 0 && fall < 1) {
          const pts = xform(shard, CX, sy, t * 2.2, 1, 0.9);
          f.poly(pts, (x, y) => { f.I(x, y, 0.75, 0.7, 1.0, 0.85); f.L(x, y, 0.9, 0.8, 1.6); });
          for (let k = 0; k < 10; k++) f.Lc(CX + rng.r(-6, 6) | 0, sy - 12 - rng.next() * 26 * (1 - fall), [0.7, 0.6, 1.2], 0.5);
        }
        const split = seg(t, 4.3, 4.7); // impact split into 3 temporal fragments
        if (split > 0) {
          f.glow(CX, GY - 26, 42 * split, [0.8, 0.7, 1.3], 0.7 * split, 5, 0.7);
          shock(f, CX, GY - 10, 26 + 60 * split, 6, 3 * (1 - split * 0.5), 0.55);
          for (let k = 0; k < 3; k++) {
            const a = -Math.PI / 2 + (k - 1) * 0.9, d = 26 * split;
            const pts = xform(shard, CX + Math.cos(a) * d, GY - 26 + Math.sin(a) * d * 0.6, t * 3 + k, 0.38, 0.62);
            f.poly(pts, (x, y) => { f.I(x, y, 0.7, 0.65, 0.95, 0.55 * split); f.L(x, y, 0.5 * split, 0.45 * split, 1.0 * split); });
          }
        }
        const sweep = seg(t, 4.7, 6.4) * (1 - seg(t, 7.2, 8.0)); // clock-hand sweep
        if (sweep > 0) {
          const a = -Math.PI / 2 + sweep * TAU * 1.5;
          f.line(CX, GY - 26, CX + Math.cos(a) * 110, GY - 26 + Math.sin(a) * 60, (x, y) => f.L(x, y, 0.8 * sweep, 0.7 * sweep, 1.3 * sweep));
          f.glow(CX, GY - 26, 30, [0.75, 0.7, 1.2], 0.5 * sweep, 4, 0.6);
        }
        for (let k = 0; k < 24; k++) ps.add({ x: CX + rng.r(-80, 80), y: GY - 30 - rng.next() * 40, vx: rng.r(-6, 6), vy: rng.r(-14, -4), max: 1.8, kind: 'star', size: 1 + rng.next(), seed: rng.next() * 99 } as Pt);
        const fade = 1 - seg(t, 7.0, 8.1);
        for (const p of ps.list) { const lf = p.max ? clamp(p.life / p.max, 0, 1) : 0; f.Lc(p.x | 0, p.y | 0, [0.85, 0.8, 1.4], (1 - lf) * 0.8 * fade); }
      },
    };
  },
};

export const REDESIGNS: Record<number, SpellDef> = { 4: ashen, 6: riptide, 12: skybreaker, 13: rootwake, 14: spore, 18: chrono };

// effect-local OUT gate: at/after the declared duration a redesign draws
// NOTHING, so the compositor output equals the no-effect baseline exactly.
for (const [idStr, def] of Object.entries(REDESIGNS)) {
  const id = Number(idStr);
  const origMake = def.make;
  def.make = (rng, fx) => {
    const inst = origMake(rng, fx);
    const origRender = inst.render.bind(inst);
    inst.render = (f, t) => { if (t >= def.dur) return; origRender(f, t); };
    return inst;
  };
  void id;
}

/** Runner for redesign slots: same C Frame + source composite equation. */
import { CRunner } from './cRunner';

export class RedesignRunner {
  private core = new CRunner();
  private id = -1;
  constructor() { for (const [id, def] of Object.entries(REDESIGNS)) this.core.registerCustom(Number(id), def); }
  /** cast only when the spell changes — no per-frame re-cast, fixed seed per id */
  cast(id: number) { if (this.id === id) return; const d = REDESIGNS[id]; if (!d) throw new Error(`no redesign for #${id}`); this.id = id; this.core.castCustom(id); }
  get currentId() { return this.id; }
  get duration() { return REDESIGNS[this.id]?.dur ?? 7.5; }
  get climax() { return REDESIGNS[this.id]?.climax ?? 0; }
  setWorld(rgba: Uint8ClampedArray) { this.core.setWorld(rgba); }
  seek(t: number) { this.core.seek(Math.min(t, this.duration + 1.0)); }
  async seekAsync(t: number) { await this.core.seekAsync(Math.min(t, this.duration + 1.0)); }
  get out() { return this.core.out; }
  /** effect-local influence mask from the live source Frame channels (see CRunner) */
  influenceMask(dilate = 3): Uint8Array { return this.core.influenceMask(dilate); }
}
