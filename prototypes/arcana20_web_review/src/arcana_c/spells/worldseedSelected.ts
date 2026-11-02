/** Selected original C16 membranes, organism, leaflets, core and burst particles.
 * Source-role extraction for the P0 fusion, not a finished or approved skill. */
import {TAU,lerp,inv,easeOut,easeInOut,backOut,hash2,bayer,angDiff} from '../engine/math';
import {P,ramp,rampD,type RGB} from '../engine/palette';
import {Particles,growTree,drawTree,type Seg} from '../engine/kit';
import type {SpellDef} from './types';
const GOLD:RGB=[1,0.85,0.4];
export const worldseedSelected: SpellDef = {
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
    // Same authored pixel centers and angles, cached without sampling changes.
    const radii=new Float64Array(161*127),directions=new Float64Array(161*127);
    for(let y=43;y<170;y++)for(let x=164;x<325;x++){const dx=x+.5-C.x,dy=(y+.5-C.y)/SYW,at=(y-43)*161+x-164;radii[at]=Math.hypot(dx,dy);directions[at]=Math.atan2(dy,dx);}
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
        if (t < TOP) { ps.render(f); return; }
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
        const R = 80,foldShift=(1-fold(t,0.2))*1.6;
        const angles=lay.map(l=>Array.from({length:l.n},(_,k)=>((k+l.off)/l.n)*TAU+(l.kind===1?t*.05:0)+Math.sin(t*31+k*1.7)*l.tw+foldShift));
        f.field(C.x - R, C.y - R * SYW, C.x + R, C.y + R * SYW, (x, y) => {
          const at=(y-43)*161+x-164,r=radii[at];
          if (r > R) return;
          const pa = directions[at];
          for (let layer=0;layer<lay.length;layer++) {const l=lay[layer];
            if (l.L < 1 || r > l.L) continue;
            const u = r / l.L, hw = l.Wd * Math.pow(Math.sin(Math.PI * Math.min(1, u)), 0.8) * (1 - 0.25 * u);
            for (let k = 0; k < l.n; k++) {
              const ang=angles[layer][k];
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
        ps.render(f);
      },
    };
  },
};

