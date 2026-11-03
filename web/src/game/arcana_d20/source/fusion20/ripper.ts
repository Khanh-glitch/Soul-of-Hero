/** Experimental translation of P0 CRealityRipperFusion, preserving C contour,
 * A world-pull and debris. Dev diagnostic only; not P0 or art acceptance. */
import { Frame,W,H } from '../engine/frame';
import { TAU,clamp,lerp,inv,easeOut,easeIn,easeInOut,hash,hash2,hash3,noise3,bayer,type V2 } from '../engine/math';
import { P,ramp,rampD,type RGB } from '../engine/palette';
import { Particles,shock } from '../engine/kit';
import type { SpellDef } from '../engine/types';
import { hash2 as aHash,smoothstep,seg as aSeg,R as aRamp } from '../aMath';
import { RipperContour } from './contour';
import { RipperDebris } from './debris';
const WHITE:RGB=[1,1,1],CYAN:RGB=[.45,.95,1],MAG:RGB=[1,.35,.85],GOLDW:RGB=[1,.9,.6],VOID_INK:RGB=[.02,.01,.05];
type ContourFields={indices:Uint32Array;tS:Float32Array;tD:Float32Array;tNx:Float32Array;tNy:Float32Array;tTx:Float32Array;tTy:Float32Array};
let contourCache:ContourFields|null=null;
const roundG=(x:number)=>x<0?-Math.round(-x):Math.round(x);
export const ripperFusion: SpellDef = {
  id: 20, name: 'Reality Ripper', school: 'ASTRAL', dur: 10.4, climax: 6.3,
  blurb: 'A rendering artifact becomes a wound: the world separates onto another space, collides with it, and stitches itself back out of order.',
  make(rng, fx) {
    // P0 fixes this cast seed; cached contour cannot depend on caller RNG.
    rng.s=151461;
    const way: V2[] = Array.from({ length: 9 }, (_, i) => { const u = i / 8; return { x: lerp(86, 334, u), y: lerp(62, 172, u) + (i && i < 8 ? rng.r(-11, 11) : 0) }; });
    const cum = [0]; for (let i = 1; i < way.length; i++) cum.push(cum[i - 1] + Math.hypot(way[i].x - way[i - 1].x, way[i].y - way[i - 1].y));
    const LEN = cum[cum.length - 1];
    const N = W * H;
    const tS = contourCache?.tS.slice() ?? new Float32Array(N).fill(-1), tD = contourCache?.tD.slice() ?? new Float32Array(N), tNx = contourCache?.tNx.slice() ?? new Float32Array(N), tNy = contourCache?.tNy.slice() ?? new Float32Array(N), tTx = contourCache?.tTx.slice() ?? new Float32Array(N), tTy = contourCache?.tTy.slice() ?? new Float32Array(N);
    const BX0 = 40, BY0 = 16, BX1 = 380, BY1 = 214;
    if (!contourCache) for (let y = BY0; y <= BY1; y++) for (let x = BX0; x <= BX1; x++) {
      let best = 1e9, bs = 0, bd = 0, bnx = 0, bny = 0, btx = 0, bty = 0;
      for (let i = 0; i < way.length - 1; i++) {
        const a = way[i], b = way[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, l = Math.sqrt(l2);
        const px = x + 0.5 - a.x, py = y + 0.5 - a.y;
        const u = clamp((px * dx + py * dy) / l2);
        const qx = px - dx * u, qy = py - dy * u, d = Math.hypot(qx, qy);
        if (d < best) { best = d; bs = (cum[i] + u * l) / LEN; const sd = dx * py - dy * px >= 0 ? 1 : -1; bd = d * sd; bnx = (-dy / l) * sd; bny = (dx / l) * sd; btx = dx / l; bty = dy / l; }
      }
      if (best < 46) { const k = y * W + x; tS[k] = bs; tD[k] = bd; tNx[k] = bnx; tNy[k] = bny; tTx[k] = btx; tTy[k] = bty; }
    }
    if(!contourCache){const indices:number[]=[];for(let i=0;i<N;i++)if(tS[i]>=0)indices.push(i);contourCache={indices:new Uint32Array(indices),tS:tS.slice(),tD:tD.slice(),tNx:tNx.slice(),tNy:tNy.slice(),tTx:tTx.slice(),tTy:tTy.slice()};}
    const contourIndices=contourCache.indices;
    const at = (s: number) => { const L = s * LEN; let i = 0; while (i < cum.length - 2 && cum[i + 1] < L) i++; const u = (L - cum[i]) / (cum[i + 1] - cum[i]); return { x: lerp(way[i].x, way[i + 1].x, u), y: lerp(way[i].y, way[i + 1].y, u), nx: -(way[i + 1].y - way[i].y) / (cum[i + 1] - cum[i]), ny: (way[i + 1].x - way[i].x) / (cum[i + 1] - cum[i]) }; };
    const TOPEN = 3.0, TCOL = 6.6;
    // P0 records V8's source sort permutation and post-sort RNG state explicitly.
    const perm = [10,7,11,5,0,6,3,1,8,4,2,9]; rng.s=1512011289;
    const contour=new RipperContour(),debris=new RipperDebris();
    const width = (s: number, t: number) => {
      if (t < TOPEN) return 0;
      let w = 22 * easeOut(inv(TOPEN, 6.0, t), 2) * Math.pow(Math.sin(Math.PI * s), 0.7) * (1 + 0.35 * (noise3(s * 8, t * 0.6, 1) - 0.5));
      if (t > 6.35 && t < TCOL) w *= 1 + 0.6 * inv(6.35, TCOL, t);
      const k = Math.min(11, Math.floor(s * 12)), tc = 7.15 + perm.indexOf(k) * 0.16;
      return w * (1 - easeIn(inv(tc, tc + 0.22, t), 2));
    };
    const mask = new Uint8Array(N);
    const polys = [
      { v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], e: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] },
      { v: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], e: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]] },
      { v: [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]], e: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] },
    ];
    const proj = (p: number[], ax: number, ay: number, s: number) => { let [x, y, z] = p; let c = Math.cos(ay), si = Math.sin(ay); [x, z] = [x * c + z * si, -x * si + z * c]; c = Math.cos(ax); si = Math.sin(ax); [y, z] = [y * c - z * si, y * si + z * c]; return { x: x * s, y: y * s, z }; };
    const blocks = Array.from({ length: 56 }, (_, i) => { const s = rng.r(0.08, 0.92), side = rng.sign(), d = rng.r(8, 38), p = at(s); const sz = rng.i(5, 9); return { hx: Math.round(p.x + p.nx * d * side - sz / 2), hy: Math.round(p.y + p.ny * d * side - sz / 2), sz, vx: p.nx * side * rng.r(60, 170) + rng.r(-40, 40), vy: p.ny * side * rng.r(60, 170) + rng.r(-40, 40), ret: rng.r(7.3, 9.1), mode: i % 4, mx: p.nx * d * side * 2 }; });
    const ps = new Particles();
    let collided = false;
    return {
      update(dt, t) {
        debris.advanceTo(contour.aTime(t),contour);
        ps.update(dt);
        if (t > TOPEN + 0.4 && t < 7.2 && rng.chance(0.6)) { const s = rng.r(0.1, 0.9), p = at(s), w = width(s, t), sd = rng.sign(); ps.add({ x: p.x + p.nx * (w + 1) * sd, y: p.y + p.ny * (w + 1) * sd, vx: -p.nx * sd * rng.r(4, 14), vy: -p.ny * sd * rng.r(4, 14), kind: 'pix', c: rng.chance(0.5) ? MAG : CYAN, k: 1.2, max: rng.r(0.4, 0.9) }); }
        if (!collided && t >= TCOL) {
          collided = true; fx.shake(10); fx.kick(6); fx.flash([1, 0.5, 1], 0.35);
          for (let i = 0; i < 100; i++) { const s = rng.r(0.05, 0.95), p = at(s), sd = rng.sign(); ps.add({ x: p.x, y: p.y, vx: p.nx * sd * rng.r(40, 200), vy: p.ny * sd * rng.r(40, 200), drag: 1.4, kind: 'star', col: P.star, c: rng.chance(0.3) ? MAG : undefined, max: rng.r(0.6, 1.6), k: 1.2 }); }
        }
      },
      render(f, t) {
        const slot = Math.floor(t * 20);
        if (t >= TCOL && t < TCOL + 0.05) fx.invert = 1;
        // the first wrongness: artifacts that look like bugs
        if (t > 0.3 && t < 0.45) for (let x = 130; x < 230; x++) { f.D(x, 92, 3, 0); f.D(x, 93, 3, 0); }
        if (t > 0.6 && t < 0.9) { const x = 180 + t * 20, y = 120 - t * 6; f.Lc(x, y, [0.5, 0.45, 0.6], 1); f.Lc(x + 5, y, [0.5, 0.45, 0.6], 1); }
        if (t > 0.95 && t < 1.2) f.field(232, 120, 246, 128, (x, y) => { f.D(x, y, (hash(slot) - 0.5) * 6, (hash(slot + 1) - 0.5) * 3); f.C(x, y, 2); });
        if (t > 1.2 && t < 1.6) for (let k = 0; k < 24; k++) { const p = at(0.4 + hash(k * 7) * 0.2); if (hash(k + slot * 3) > 0.5) f.L(p.x, p.y, 0.8, 0.8, 0.9); else f.L(p.x, p.y, -0.3, -0.3, -0.3); }
        const span = inv(1.6, TOPEN, t);
        const blocksOut = t >= TCOL;
        if (t >= 1.6 && t < 9.4) {
          mask.fill(0);
          const ts = Math.floor(t * 12), atime=contour.aTime(t);
          const pull=smoothstep(1.2,5.3,atime)*(atime>6.1?1-aSeg(atime,6.1,8.3):1);
          const wt = new Float32Array(257);
          for (let i = 0; i <= 256; i++) wt[i] = width(i / 256, t);
          // Same fixed row-major valid-contour subset as P0; no samples or
          // branches are omitted. The field arrays were immutable per cast.
          const pixel = (x:number,y:number) => {
            const k = y * W + x, s = tS[k];
            if (s < 0) return;
            const d = tD[k], ad = Math.abs(d);
            if (t < TOPEN) {
              if(atime>.35&&ad<1.2)f.D(x,y,roundG((aHash(Math.floor(s*120),Math.floor(atime*18))-.5)*5),0);
              if (Math.abs(s-.5)<=span*.5) { if (ad < .8) f.L(x,y,1.6,1.6,1.8); else if(ad<3)f.C(x,y,2); }
              return;
            }
            if (Math.abs(s - 0.5) > span / 2) return;
            const w = wt[Math.round(s * 256)];
            const wj = w + (w > 1 ? (hash3(x, y, ts) - 0.5) * 3.2 : 0);
            if (ad < wj) {
              mask[k] = 1;
              // the other space
              const gy = (y - 60) / 150;
              const base = rampD(P.void, 0.12 + gy * 0.2, bayer(x, y));
              const n = noise3(x * 0.05, y * 0.05, t * 0.25);
              if(n>.62)f.worldSample(x,y,420-x+Math.sin(t*.7)*10,232-y,1);
              else f.Ic(x,y,base,1);
              if (hash2(Math.floor(x - t * 10), y) > 0.985) f.Lc(x, y, ramp(P.star, 0.8), 0.7);
              if (hash2(Math.floor((x + t * 26) / 2), Math.floor((y + t * 6) / 2)) > 0.965) f.Lc(x, y, WHITE, 1);
              if (((x * 0.7 + y * 0.3 + t * 22) % 37 + 37) % 37 < 1) f.Lc(x, y, CYAN, 0.35);
              f.L(x, y, 0.02, 0, 0.05);
              return;
            }
            if (ad < wj + 1.6 && w > 0.5) { const c = hash3(x, y, ts + 5) > 0.5 ? MAG : CYAN; f.Ic(x, y, c, 1); f.Lc(x, y, c, 1); return; }
            if (w > 1 && ad < 44) {
              const bh=aHash(Math.floor(y/3),77),nearestX=x+.5-tNx[k]*ad,dirX=x<nearestX?-1:1,distance=ad-w;
              let shift=Math.trunc(pull*46*Math.exp(-distance/34));if(bh>.78)shift=roundG(shift*(1+bh));
              let sx=x-dirX*shift,sy=y;
              if(bh>.93&&distance<40&&pull>.4){sx=nearestX+(nearestX-x)*1.1;sy+=roundG((bh-.93)*120);}
              f.D(x,y,sx-x,sy-y);f.S(x,y,1+1.6*Math.exp(-distance/3));
              if(hash(Math.floor(s*48)+31)>.9)f.C(x,y,1.5);
            }
          };
          for(const k of contourIndices)pixel(k%W,Math.floor(k/W));
          // impossible geometry inside the tear (clipped by the mask)
          polys.forEach((pl, i) => {
            const s0 = ((0.2 + i * 0.27 + t * 0.035) % 0.8) + 0.1, p = at(s0);
            const ex = blocksOut ? clamp((t - TCOL) / 0.7) : 0;
            const sc = (6 + i * 1.5) * (1 + ex * 4);
            const cx = p.x + p.nx * (i - 1) * 6, cy = p.y + p.ny * (i - 1) * 6;
            const vs = pl.v.map((v) => proj(v, t * (0.7 + i * 0.3), t * (1.1 - i * 0.2), sc));
            for (const [a, b] of pl.e) f.line(cx + vs[a].x, cy + vs[a].y, cx + vs[b].x, cy + vs[b].y, (x, y) => {
              const inside = mask[y * W + x] === 1;
              if (!inside && !ex) return;
              f.Lc(x, y, i === 1 ? MAG : CYAN, ex ? 1.2 * (1 - ex) : 1);
            });
            // the passage: what enters here leaves elsewhere
            if (t > 3.8 && t < 6.4 && i === 0) {
              const sp = 0.15 + (t - 3.8) * 0.12, q = at(sp), q2 = at(1 - sp);
              f.ring(q.x, q.y, 3, (x, y) => { if (mask[y * W + x]) f.Lc(x, y, GOLDW, 1.2); });
              const out = 8 + (t - 3.8) * 6;
              f.ringL(q2.x + q2.nx * (width(1 - sp, t) + out), q2.y + q2.ny * (width(1 - sp, t) + out), 3, GOLDW, 1.2);
            }
          });
        }
        // world fragments flung out by the collision, returning by impossible routes
        if (blocksOut) {
          const a = t - TCOL;
          for (const b of blocks) {
            const oa = Math.min(a, 1.3), out = { x: b.hx + b.vx * oa * (1 - oa / 2.6), y: b.hy + b.vy * oa * (1 - oa / 2.6) };
            let p = out;
            if (t >= b.ret) {
              const q = clamp((t - b.ret) / 0.6);
              if (q >= 1) continue;
              if (b.mode === 0) p = { x: lerp(out.x, b.hx, easeInOut(q)), y: lerp(out.y, b.hy, easeInOut(q)) };
              else if (b.mode === 1) p = { x: lerp(b.hx - b.mx * 3, b.hx, q), y: b.hy };
              else if (b.mode === 2) { const ang = q * TAU * 2, r = (1 - q); p = { x: b.hx + ((out.x - b.hx) * Math.cos(ang) - (out.y - b.hy) * Math.sin(ang)) * r, y: b.hy + ((out.x - b.hx) * Math.sin(ang) + (out.y - b.hy) * Math.cos(ang)) * r }; }
              else continue;
            }
            for (let y = 0; y < b.sz; y++) for (let x = 0; x < b.sz; x++) { f.I(b.hx + x, b.hy + y, VOID_INK[0], VOID_INK[1], VOID_INK[2], 1); if (hash2(b.hx + x, b.hy + y) > 0.95) f.Lc(b.hx + x, b.hy + y, ramp(P.star, 0.8), 0.7); }
            f.blitBase(b.hx, b.hy, b.sz, b.sz, Math.round(p.x), Math.round(p.y));
            f.Lc(p.x, p.y, b.mode % 2 ? MAG : CYAN, 0.8); f.Lc(p.x + b.sz - 1, p.y + b.sz - 1, b.mode % 2 ? CYAN : MAG, 0.8);
          }
          if (a < 0.7) for (let k = 0; k < 5; k++) { const p = at(0.1 + k * 0.2); shock(f, p.x, p.y, a * 190, 14, 9 * (1 - a / 0.7), 1, 3); }
        }
        // one stubborn region stays wrong a moment longer
        if (t > 9.3 && t < 9.85) {
          const p = at(0.62), bx = Math.round(p.x + p.nx * 7), by = Math.round(p.y + p.ny * 7);
          for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) { if(hash(slot+x)>.2)f.worldSample(bx+x,by+y,bx+x+2,by+y,2); f.C(bx+x,by+y,2); }
        }
        if (t >= 9.85 && t < 9.9) { const p = at(0.62); f.L(p.x + p.nx * 7 + 3, p.y + p.ny * 7 + 2, 2, 2, 2); }
        ps.render(f);
        if(t<9.4)for(const p of debris.particles){const life=p.life/p.max,sx=Math.floor(p.px+.5),sy=Math.floor(p.py+.5),gain=(2.2+p.k*3.4)*life;
          for(let yy=0;yy<p.size;yy++)for(let xx=0;xx<p.size;xx++)f.addLiveWorldLight(p.x+xx,p.y+yy,clamp(sx+xx,0,W-1),clamp(sy+yy,0,H-1),gain);
          if(p.k>.6){const c=aRamp('astral',Math.floor(clamp(.55+life*.4)*9)/9);f.addBilinearLight(p.x,p.y,[c[0]*.5*life*.8,c[1]*.5*life*.8,c[2]*.6*life*.8]);}
        }
      },
    };
  },
};

