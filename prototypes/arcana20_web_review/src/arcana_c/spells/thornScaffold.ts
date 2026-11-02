/** Source-C #15 Thorn Opera scaffold from original TS and P0 live-caster/focus
 * adaptation. Not registered: owner binding, sparse tile submission, mapped combat and
 * source/world validation are still required. */
import {Frame} from '../engine/frame';
import {TAU,clamp,lerp,inv,easeOut,easeInOut,backOut,hash,hash2,hash3,angDiff,bayer,catmull,type V2} from '../engine/math';
import {P,ramp,rampD,type RGB,type Ramp} from '../engine/palette';
import {Particles,shock,drawPt} from '../engine/kit';import {CASTER,TARGETS,FOCUS} from '../engine/floor';import type {SpellDef} from './types';
const GOLD:RGB=[1,.85,.4];
function flower(f: Frame, x: number, y: number, g: number, rot: number, size = 4, pal: Ramp = P.bloom) {
  if (g <= 0) return;
  for (let k = 0; k < 5; k++) {
    const a = rot + (k / 5) * TAU;
    f.ribbon([{ x, y }, { x: x + Math.cos(a) * size * g, y: y + Math.sin(a) * size * g * 0.8 }], [0.6, 1.7 * g], (px, py, _s, e) => f.Ic(px, py, ramp(pal, Math.abs(e) > 0.6 ? 0.45 : 0.75), 1));
  }
  f.Ic(x, y, ramp(P.gold, 0.8), 1); f.Lc(x, y, GOLD, 0.5 * g);
  f.glow(x, y, size * 2.5, ramp(pal, 0.7), 0.25 * g, 3);
}

export const thornOpera: SpellDef = {
  id: 15, name: 'Thorn Opera', school: 'VERDANT', dur: 8.4, climax: 6.0,
  blurb: 'Five tendrils with five temperaments perform a dangerous dance, curl into a single bud, and open into a thorned catastrophe.',
  make(rng, fx) {
    const M = 24, LS = 6.2;
    const FOCUS_LOCAL = { x: FOCUS.x, y: FOCUS.y };
    const Fz=FOCUS_LOCAL;
    let liveCaster = { ...CASTER };
    let heightAxis:V2={x:0,y:-1},renderOffset:V2={x:0,y:0};
    const targets = TARGETS.map(p => ({ ...p }));
    const TB = 5.85;
    const tds = [-1.15, -0.55, 0.05, 0.6, 1.2].map((a, i) => {
      const base = { x: liveCaster.x + 4 + Math.cos(a) * 6, y: liveCaster.y + Math.sin(a) * 4 + 1 };
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
        if (i === 0) return q < 0.35 ? { x: targets[0].x, y: targets[0].y - 6 } : rest;
        if (i === 1) { if (q < 0.3) { const a = q * 34; return { x: b.x + 26 + Math.cos(a) * 14, y: b.y - 4 + Math.sin(a) * 10 }; } return { x: targets[2].x, y: targets[2].y - 5 }; }
        if (i === 2) { if (q < 0.45) { const u = q / 0.45; return { x: lerp(rest.x, targets[1].x, u), y: lerp(rest.y, targets[1].y, u) + Math.sin(u * 14) * 22 }; } return { x: targets[1].x - 34, y: targets[1].y - 30 }; }
        if (i === 3) { if (q < 0.5) { const a = lerp(-1.1, 1.0, q / 0.5); return { x: liveCaster.x + Math.cos(a) * 112, y: liveCaster.y + Math.sin(a) * 80 }; } return { x: liveCaster.x + 60, y: liveCaster.y - 44 }; }
        if (q < 0.45) { const u = q * 9; return { x: rest.x + Math.sin(u) * 22, y: rest.y + Math.sin(u * 2) * 12 }; }
        return { x: targets[3].x, y: targets[3].y - 6 };
      }
      if (t < 3.9) {
        const u = easeInOut(clamp((t - 2.7 - (i >> 1) * 0.16) / 0.75));
        const a = i % 2 ? lerp(1.1, -1.1, u) : lerp(-1.1, 1.1, u);
        return { x: liveCaster.x + Math.cos(a) * 118, y: liveCaster.y + Math.sin(a) * 86 };
      }
      if (t < 4.7) { const a = (i - 2) * 0.42, r = 72 + 52 * Math.abs(Math.sin((t - 3.9) * Math.PI * 2.5)); return { x: liveCaster.x + Math.cos(a) * r, y: liveCaster.y + Math.sin(a) * r * 0.8 }; }
      if (t < TB) { const q = inv(4.7, 5.6, t); const a = (i / 5) * TAU + (t - 4.7) * 3.2; const r = 18 * (1 - q * 0.6); return { x: Fz.x + Math.cos(a) * r, y: Fz.y + Math.sin(a) * r * 0.75 }; }
      if (t < 6.5) { const a = (i / 5) * TAU + 0.3; return { x: Fz.x + Math.cos(a) * 85, y: Fz.y + Math.sin(a) * 62 }; }
      return { x: b.x + Math.cos(td.a) * 30, y: b.y + Math.sin(td.a) * 18 + 10 };
    };
    return {
      // The actor owner supplies a real, inverse-transformed live position.
      setLiveCaster(p: V2) { liveCaster = {...p}; for (const td of tds) td.base = {x:p.x+4+Math.cos(td.a)*6, y:p.y+Math.sin(td.a)*4+1}; },
      setLiveFocus(p: V2) { Fz.x=p.x; Fz.y=p.y; for(let i=0;i<targets.length;i++){ targets[i].x=TARGETS[i].x+p.x-FOCUS.x; targets[i].y=TARGETS[i].y+p.y-FOCUS.y; } },
      setHeightAxis(p: V2) { heightAxis={...p}; },
      setRenderOffset(p: V2) { renderOffset={...p}; },
      debugParticles() { return ps.list.map(p=>({...p})); },
      debugFocus() { return {...Fz}; },
      debugBases() { return tds.map(td => ({...td.base})); },
      debugRoots() { return tds.map(td => td.pos.map(p=>({...p}))); },
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
        const Fz={x:FOCUS_LOCAL.x+renderOffset.x,y:FOCUS_LOCAL.y+renderOffset.y};
        for (const td of tds) {
          const positions=td.pos.map(p=>({x:p.x+renderOffset.x,y:p.y+renderOffset.y}));
          const pts = catmull(positions, 2);
          const n = pts.length;
          const ws = pts.map((_, j) => lerp(3.6, 0.7, j / (n - 1)));
          f.ribbon(pts.map((p) => ({ x: p.x + 1, y: p.y + 2 })), ws, (x, y) => f.S(x, y, 0.62));
          f.ribbon(pts, ws, (x, y, _s, e) => {
            const tone = Math.abs(e) > 0.82 ? 0.08 : e < -0.4 ? 0.68 : e > 0.45 ? 0.3 : 0.5;
            f.Ic(x, y, ramp(P.leaf, tone), 1);
            if (Math.abs(e) < 0.2) f.Lc(x, y, ramp(P.leaf, 0.85), 0.1);
          });
          for (let j = 2; j < M - 1; j += 2) {
            const p = positions[j], a = positions[j - 1], b = positions[j + 1];
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
          f.Lc(positions[M - 1].x, positions[M - 1].y, ramp(P.leaf, 1), 0.7);
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
        if(renderOffset.x===0&&renderOffset.y===0)ps.render(f,heightAxis);
        else for(const p of ps.list)if(p.delay<=0)drawPt(f,{...p,x:p.x+renderOffset.x,y:p.y+renderOffset.y,px:p.px+renderOffset.x,py:p.py+renderOffset.y},heightAxis);
      },
    };
  },
};

