// Pixel-baked VFX generators. Deterministic (seeded hash), integer raster only, cached by quantised key.
import { Raster, hash2 } from './raster';
import { cluster, impactStar, jagMass, groundEllipse, lobe } from './detail';
import { R } from './kit';
import { renderPose } from './sprites';
import type { BossId, Form } from './clips';
import type { Dir } from './kit';

export type El = 'fire' | 'force' | 'time' | 'space' | 'mind' | 'soul';
export const ELR: Record<El, string> = { fire: 'lava', force: 'force', time: 'time', space: 'space', mind: 'mind', soul: 'soul' };
const ramp = (e: El) => R[ELR[e]];
const cache = new Map<string, Raster>();
export const VFX_STATS = { generated: 0 };
export function cached(key: string, make: () => Raster) {
  let r = cache.get(key);
  if (!r) { r = make(); cache.set(key, r); VFX_STATS.generated++; if (cache.size > 3000) { const k = cache.keys().next().value; if (k) cache.delete(k); } }
  return r;
}
export const q = (v: number, s: number) => Math.round(v / s) * s;
export const qa = (a: number, n = 16) => ((Math.round((a / (Math.PI * 2)) * n) % n) + n) % n;

/** impact focal burst: core + jagged rays + fragment ring; fr 0..5 */
export function vBurst(e: El, rad: number, fr: number, seed = 1) {
  rad = q(rad, 4);
  return cached(`burst/${e}/${rad}/${fr}/${seed % 4}`, () => {
    const s = rad * 2 + 6, r = new Raster(s, s), c = s / 2, rp = ramp(e), t = fr / 5;
    const core = rad * 0.45 * (1 - t);
    if (core > 0.5) { r.disc(c, c, core + 1, rp[3]); r.disc(c, c, core, rp[4]); r.disc(c, c, core * 0.5, rp[5]); }
    const n = 9 + (seed % 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + hash2(i, seed, 3) * 0.5, L = rad * (0.5 + hash2(i, seed, 5) * 0.5) * Math.min(1, 0.4 + t * 1.2);
      const st = rad * t * 0.6;
      if (t < 0.85) r.line(c + Math.cos(a) * st, c + Math.sin(a) * st, c + Math.cos(a) * L, c + Math.sin(a) * L, t < 0.4 ? rp[4] : rp[2]);
      if (t > 0.3) r.set(c + Math.cos(a) * (L + 2), c + Math.sin(a) * (L + 2), rp[t > 0.7 ? 1 : 3]);
    }
    return r;
  });
}
/** irregular broken shockwave ring, authored as pixel clusters */
export function vRing(e: El, rad: number, seed = 1, thick = 2) {
  rad = q(rad, 3);
  return cached(`ring/${e}/${rad}/${seed % 5}/${thick}`, () => {
    const s = rad * 2 + 10, r = new Raster(s, s), c = s / 2, rp = ramp(e), n = Math.max(24, Math.round(rad * 3));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283; if (hash2(i >> 2, seed, 9) < 0.18) continue;
      const rr = rad + (hash2(i >> 1, seed, 2) - 0.5) * 3;
      for (let k = 0; k < thick; k++) r.set(c + Math.cos(a) * (rr - k), c + Math.sin(a) * (rr - k) * 0.6, k === 0 ? rp[4] : rp[2]);
      if (hash2(i, seed, 4) < 0.12) r.set(c + Math.cos(a) * (rr + 2), c + Math.sin(a) * (rr + 2) * 0.6, rp[3]);
    }
    return r;
  });
}
/** flame / jet column with root, body and collapsing tips; soul element renders hollow contour wisps */
export function vFlame(e: El, w: number, h: number, fr: number, seed = 1) {
  w = q(w, 2); h = q(h, 2);
  return cached(`flame/${e}/${w}/${h}/${fr % 6}/${seed % 6}`, () => {
    const r = new Raster(w + 2, h + 2), rp = ramp(e);
    for (let x = 0; x < w; x++) {
      const u = x / Math.max(1, w - 1), env = Math.sin(Math.PI * u) ** 0.7;
      const n = hash2(x >> 1, fr, seed) * 0.5 + hash2(x >> 2, fr + 9, seed) * 0.5, hh = Math.round(h * env * (0.4 + 0.75 * n));
      for (let j = 0; j < hh; j++) {
        const t = j / Math.max(1, hh);
        if (t > 0.68 && hash2(x, j + fr * 5, seed) < 0.4) continue;
        const ci = t < 0.2 ? 5 : t < 0.42 ? 4 : t < 0.7 ? 3 : t < 0.88 ? 2 : 1;
        r.set(x + 1, h - j, rp[ci]);
      }
    }
    if (e === 'soul') { const s = r.clone(); for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const i = y * r.w + x; if (s.d[i] && s.get(x - 1, y) && s.get(x + 1, y) && s.get(x, y - 1) && s.get(x, y + 1) && hash2(x, y, 3) > 0.08) r.d[i] = 0; } }
    return r;
  });
}
/** world decal: scorched ground with cracks; heat 3→0 cools glowing pixels to charcoal */
export function vScorch(e: El, w: number, h: number, heat: number, seed = 1) {
  w = q(w, 4); h = q(h, 4);
  return cached(`scorch/${e}/${w}/${h}/${heat}/${seed % 6}`, () => {
    const r = new Raster(w, h), rp = ramp(e), dark = e === 'fire' ? R.ash : e === 'soul' ? [R.jet[1], R.jet[2], R.linen[0]] : e === 'space' ? [R.void[0], R.void[1], R.space[0]] : e === 'force' ? [R.rock[1], R.rock[2], R.rock[3]] : e === 'time' ? [R.robe[1], R.robe[2], R.time[0]] : [R.regal[1], R.regal[2], R.gold[0]];
    const cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2)) + (hash2(x >> 1, y >> 1, seed) - 0.5) * 0.35;
      if (d < 0.95) r.set(x, y, d < 0.5 ? dark[0] : d < 0.8 ? dark[1] : hash2(x, y, seed) < 0.5 ? dark[1] : 0);
    }
    for (let i = 0; i < 6; i++) { let x = cx, y = cy, a = hash2(i, seed, 7) * 6.283; for (let j = 0; j < w / 4; j++) { x += Math.cos(a) * 1.5; y += Math.sin(a) * 0.9; a += (hash2(i, j, seed) - 0.5) * 0.9; r.set(x, y, heat >= 2 ? rp[heat + 1] : heat === 1 ? rp[1] : dark[2]); } }
    if (heat >= 1) for (let i = 0; i < w / 3; i++) if (hash2(i, seed, 11) < 0.6) r.set(cx + (hash2(i, 1, seed) - 0.5) * w * 0.7, cy + (hash2(i, 2, seed) - 0.5) * h * 0.7, rp[Math.min(5, heat + 1)]);
    return r;
  });
}
/** slash wedge trail along an arc (angles quantised to 32 steps; rasterised per angle, never rotated) */
export function vSlash(e: El, rad: number, a0: number, a1: number, wid: number, fr: number) {
  rad = q(rad, 4); const A0 = qa(a0, 32), A1 = qa(a1, 32);
  return cached(`slash/${e}/${rad}/${A0}/${A1}/${wid}/${fr}`, () => {
    const s = rad * 2 + 8, r = new Raster(s, s), c = s / 2, rp = ramp(e);
    let s0 = (A0 / 32) * 6.283, s1 = (A1 / 32) * 6.283; let span = s1 - s0; while (span > Math.PI) span -= 6.283; while (span < -Math.PI) span += 6.283;
    const steps = Math.max(8, Math.round(Math.abs(span) * rad));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = s0 + span * t, ww = Math.max(1, wid * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (1 - fr * 0.18));
      for (let k = 0; k < ww; k++) {
        const rr = rad - k; const ci = k === 0 ? 5 : k < ww * 0.35 ? 4 : k < ww * 0.7 ? 3 : 2;
        if (fr > 1 && hash2(i, k + fr, 3) < fr * 0.15) continue;
        r.set(c + Math.cos(a) * rr, c + Math.sin(a) * rr, rp[Math.max(1, ci - fr)]);
      }
    }
    return r;
  });
}
/** ground seal/glyph (time: fractured arcs, soul: funeral glyph blocks, mind: chevrons) */
export function vSeal(e: El, rad: number, fr: number, seed = 1) {
  rad = q(rad, 4);
  return cached(`seal/${e}/${rad}/${fr % 4}/${seed % 3}`, () => {
    const s = rad * 2 + 6, r = new Raster(s, s), c = s / 2, rp = ramp(e);
    for (let ring = 0; ring < 3; ring++) {
      const rr = rad * (1 - ring * 0.28), n = Math.round(rr * 4);
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + ring * 0.4 + fr * 0.05 * (ring % 2 ? -1 : 1); if (hash2(Math.floor(i / 5), ring, seed) < 0.3) continue; r.set(c + Math.cos(a) * rr, c + Math.sin(a) * rr * 0.6, rp[ring === 0 ? 3 : 2]); }
    }
    const g = e === 'soul' ? 8 : e === 'time' ? 6 : 5;
    for (let i = 0; i < g; i++) { const a = (i / g) * 6.283 + fr * 0.03, gx = c + Math.cos(a) * rad * 0.86, gy = c + Math.sin(a) * rad * 0.52; for (let k = 0; k < 9; k++) if (hash2(i * 9 + k, seed, 17) < 0.55) r.set(gx + (k % 3) - 1, gy + Math.floor(k / 3) - 1, rp[4]); }
    return r;
  });
}
/** portal: torn jagged rim, layered interior depth, lightless core, star specks. open 0..1 */
export function vPortal(rad: number, open: number, fr: number, seed = 1, e: El = 'space') {
  rad = q(rad, 2); const O = Math.round(open * 4);
  return cached(`portal/${e}/${rad}/${O}/${fr % 6}/${seed % 4}`, () => {
    const rx = rad, ry = Math.max(2, rad * 0.55 * (O / 4)), s = rad * 2 + 8, r = new Raster(s, s), c = s / 2, rp = ramp(e);
    if (O === 0) { r.line(c - rx, c, c + rx, c, rp[4]); return r; }
    for (let y = -ry - 2; y <= ry + 2; y++) for (let x = -rx - 2; x <= rx + 2; x++) {
      const a = Math.atan2(y, x), jag = 1 + (hash2(Math.round(a * 6 + fr * 0.5), seed, 3) - 0.5) * 0.18;
      const d = Math.hypot(x / rx, y / ry) / jag;
      if (d > 1.05) continue;
      let ci: number;
      if (d > 0.9) ci = (Math.round(a * 8 + fr) % 3 === 0) ? rp[5] : rp[4];
      else if (d > 0.72) ci = rp[3]; else if (d > 0.52) ci = rp[2]; else if (d > 0.32) ci = rp[1]; else ci = e === 'space' ? R.void[d > 0.16 ? 1 : 0] : R.jet[0];
      r.set(c + x, c + y, ci);
    }
    for (let i = 0; i < 6; i++) { const a = hash2(i, fr >> 1, seed) * 6.283, d = 0.2 + hash2(i, 5, seed) * 0.45; r.set(c + Math.cos(a) * rx * d, c + Math.sin(a) * ry * d, e === 'space' ? R.star[0] : rp[4]); }
    return r;
  });
}
/** eye node with eyelids; real=true shows contracted pupil + white-hot core when charging */
export function vEye(size: number, open: number, lx: number, ly: number, charge: number, real: boolean) {
  size = q(size, 2); const O = Math.round(open * 4), LX = Math.round(lx * 2), LY = Math.round(ly * 2), C = Math.round(charge * 3);
  return cached(`eye/${size}/${O}/${LX}/${LY}/${C}/${real ? 1 : 0}`, () => {
    const rx = size, ry = Math.round(size * 0.6), s = size * 2 + 6, r = new Raster(s, s), c = s / 2;
    r.oval(c, c, rx + 1, ry + 2, R.gold[1]); r.oval(c, c, rx, ry + 1, R.gold[3]);
    r.oval(c, c, rx - 1, ry, R.eyew[1]);
    const ir = Math.max(1, ry * 0.8), ix = c + LX * (rx - ir) * 0.3, iy = c + LY * (ry - ir) * 0.3;
    r.disc(ix, iy, ir, real && C >= 2 ? R.mind[3] : R.iris[1]);
    const pr = real ? Math.max(0.6, ir * (0.55 - C * 0.12)) : ir * 0.55;
    r.disc(ix, iy, pr, R.pupil[0]);
    if (real && C >= 2) { r.set(ix, iy, R.mind[5]); r.set(ix + 1, iy, R.mind[4]); r.set(ix - 1, iy, R.mind[4]); r.set(ix, iy - 1, R.mind[4]); r.set(ix, iy + 1, R.mind[4]); }
    else if (!real && C >= 2) r.disc(ix, iy, ir * 0.3, R.mind[2]); // flat imitation: no white core, no contraction
    const lid = Math.round((ry * 2 + 2) * (1 - O / 4));
    for (let j = 0; j < lid; j++) for (let x = -rx; x <= rx; x++) if (r.get(c + x, c - ry - 1 + j)) r.set(c + x, c - ry - 1 + j, j === lid - 1 ? R.gold[4] : R.flesh[1]);
    for (let i = -2; i <= 2; i++) r.set(c + i * rx * 0.4, c - ry - 3, R.gold[2]); // lashes
    return r;
  });
}
/** small hollow spectral soldier (Anubis legions); variant 0 spear, 1 horned, 2 hooded */
export function vGhost(fr: number, variant: number, e: El = 'soul') {
  return cached(`ghost/${e}/${fr % 4}/${variant % 3}`, () => {
    const r = new Raster(16, 22), rp = ramp(e), m = new Raster(16, 22), b = (fr % 2);
    m.oval(8, 5, 3, 3, 1); if (variant === 1) { m.line(5, 3, 3, 0, 1); m.line(11, 3, 13, 0, 1); } if (variant === 2) m.poly([[4, 6], [8, 0], [12, 6]], 1);
    m.poly([[4, 8], [12, 8], [13, 17], [3, 17]], 1);
    m.line(5 - b, 17, 4 - b, 21, 1); m.line(11 + b, 17, 12 + b, 21, 1);
    m.line(13, 6, 14, 20, 1);
    for (let y = 0; y < 22; y++) for (let x = 0; x < 16; x++) if (m.get(x, y)) { const edge = !m.get(x - 1, y) || !m.get(x + 1, y) || !m.get(x, y - 1) || !m.get(x, y + 1); r.set(x, y, edge ? rp[3] : (hash2(x, y + fr, 2) < 0.12 ? rp[2] : 0)); }
    r.set(7, 5, rp[5]); r.set(9, 5, rp[5]); r.set(14, 5, rp[4]);
    return r;
  });
}
/** oriented spear / lance projectile (32 directions, each re-rasterised) */
export function vLance(e: El, ang: number, len: number, fr = 0) {
  const A = qa(ang, 32); len = q(len, 4);
  return cached(`lance/${e}/${A}/${len}/${fr % 2}`, () => {
    const a = (A / 32) * 6.283, s = len + 8, r = new Raster(s, s), c = s / 2, rp = ramp(e), ux = Math.cos(a), uy = Math.sin(a);
    const t0x = c - ux * len / 2, t0y = c - uy * len / 2, tx = c + ux * len / 2, ty = c + uy * len / 2;
    for (let i = 0; i < len * 0.75; i += 3) r.set(t0x + ux * i, t0y + uy * i, rp[2 + ((i / 3 + fr) % 2)]);
    r.line(t0x + ux * len * 0.3, t0y + uy * len * 0.3, tx, ty, rp[4]);
    r.poly([[tx + ux * 3, ty + uy * 3], [tx - ux * 4 - uy * 2.5, ty - uy * 4 + ux * 2.5], [tx - ux * 4 + uy * 2.5, ty - uy * 4 - ux * 2.5]], rp[4]);
    r.set(tx, ty, rp[5]);
    return r;
  });
}
/** suspended/thrown scythe-blade shard (time) or generic curved blade */
export function vBlade(e: El, ang: number, size: number, frozen: boolean) {
  const A = qa(ang, 32); size = q(size, 2);
  return cached(`blade/${e}/${A}/${size}/${frozen ? 1 : 0}`, () => {
    const a = (A / 32) * 6.283, s = size * 2 + 6, r = new Raster(s, s), c = s / 2, rp = ramp(e), ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6 - 0.5; pts.push([c + ux * t * size * 2 + nx * (1 - 4 * t * t) * size * 0.45, c + uy * t * size * 2 + ny * (1 - 4 * t * t) * size * 0.45]); }
    for (let i = 6; i >= 0; i--) { const t = i / 6 - 0.5; pts.push([c + ux * t * size * 2 + nx * (1 - 4 * t * t) * size * 0.15, c + uy * t * size * 2 + ny * (1 - 4 * t * t) * size * 0.15]); }
    r.poly(pts, frozen ? rp[2] : rp[3]);
    for (let i = 0; i < 7; i++) r.set(pts[i][0], pts[i][1], frozen ? rp[4] : rp[5]);
    r.set(c + ux * size, c + uy * size, rp[5]);
    return r;
  });
}
export function vRock(size: number, seed: number, e: El = 'force') {
  size = Math.max(2, Math.round(size));
  return cached(`rock/${e}/${size}/${seed % 8}`, () => {
    const s = size * 2 + 4, r = new Raster(s, s), c = s / 2, pts: [number, number][] = [];
    for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.283, rr = size * (0.7 + hash2(i, seed, 1) * 0.4); pts.push([c + Math.cos(a) * rr, c + Math.sin(a) * rr * 0.85]); }
    const m = new Raster(s, s); m.poly(pts, 1);
    const rk = e === 'space' ? R.astone : e === 'fire' ? R.obs : R.rock;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) if (m.get(x, y)) r.set(x, y, !m.get(x + 1, y + 1) ? rk[1] : !m.get(x - 1, y - 1) ? rk[3] : rk[2]);
    if (size > 3) r.set(c, c, e === 'space' ? R.star[0] : e === 'fire' ? R.lava[3] : R.force[3]);
    return r;
  });
}
/** giant fist sprite (Atlas rift fists / Typhon continental fist), 16 directions */
export function vFist(e: El, size: number, ang: number) {
  const A = qa(ang, 16); size = q(size, 4);
  return cached(`fist/${e}/${size}/${A}`, () => {
    const a = (A / 16) * 6.283, s = size * 3, r = new Raster(s, s), c = s / 2, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const arm = e === 'space' ? R.armor : R.plate, m = new Raster(s, s);
    m.taper(c - ux * size * 1.3, c - uy * size * 1.3, c + ux * size * 0.2, c + uy * size * 0.2, size * 0.35, size * 0.45, 1);
    m.disc(c + ux * size * 0.45, c + uy * size * 0.45, size * 0.55, 1);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) if (m.get(x, y)) r.set(x, y, !m.get(x + 1, y + 1) || !m.get(x + 1, y) ? arm[1] : !m.get(x - 1, y - 1) ? arm[4] : arm[2]);
    for (let i = -1; i <= 2; i++) r.set(c + ux * size * 0.9 + nx * i * size * 0.22, c + uy * size * 0.9 + ny * i * size * 0.22, e === 'space' ? R.space[4] : R.claw[2]);
    if (e === 'space') for (let i = 0; i < 4; i++) r.set(c - ux * size * (0.2 + i * 0.25) + nx * (i % 2), c - uy * size * (0.2 + i * 0.25) + ny * (i % 2), R.star[0]);
    return r;
  });
}
/** falling molten sword (Surtur U3), vertical foreshortened; stage 0..3 grows */
export function vFallSword(stage: number) {
  return cached(`fsword/${stage}`, () => {
    const L = 14 + stage * 10, w = 2 + stage, r = new Raster(w * 2 + 8, L + 8), c = w + 4;
    r.poly([[c - w, 2], [c + w, 2], [c + w * 0.8, L], [c, L + 4], [c - w * 0.8, L]], R.obs[2]);
    r.line(c, 3, c, L + 2, R.lava[stage > 1 ? 5 : 4]); r.line(c - w + 1, 4, c - w * 0.7, L, R.lava[3]);
    r.line(c - w - 2, 4, c + w + 2, 4, R.horn[3]);
    return r;
  });
}
/** compression orb / singularity with chipped contour */
export function vOrb(e: El, rad: number, fr: number) {
  rad = q(rad, 2);
  return cached(`orb/${e}/${rad}/${fr % 4}`, () => {
    const s = rad * 2 + 6, r = new Raster(s, s), c = s / 2, rp = ramp(e);
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const d = Math.hypot(x, y) / rad, a = Math.atan2(y, x); if (d > 1 - (hash2(Math.round(a * 5) + fr, 1, 2) < 0.25 ? 0.15 : 0)) continue; r.set(c + x, c + y, d < 0.3 ? rp[5] : d < 0.55 ? rp[4] : d < 0.8 ? rp[3] : rp[2]); }
    for (let i = 0; i < 8; i++) { const a = i * 0.785 + fr * 0.4; r.set(c + Math.cos(a) * (rad + 2), c + Math.sin(a) * (rad + 2), rp[4]); }
    return r;
  });
}
export function vDot(e: El, w: number, fr: number) {
  return cached(`dot/${e}/${w}/${fr % 3}`, () => { const s = w * 2 + 3, r = new Raster(s, s), c = s / 2, rp = ramp(e); r.disc(c, c, w, rp[3]); r.disc(c, c, Math.max(0.5, w * 0.55), rp[4 + (fr % 2)]); if (w >= 2) r.set(c, c, rp[5]); return r; });
}
export function vLink(e: El, horiz: boolean) {
  return cached(`link/${e}/${horiz}`, () => { const r = new Raster(5, 5), m = e === 'soul' ? R.fgold : R.astone; if (horiz) { r.rect(0, 1, 5, 3, m[2]); r.rect(1, 2, 3, 1, 0); r.set(0, 1, m[4]); } else { r.rect(1, 0, 3, 5, m[2]); r.rect(2, 1, 1, 3, 0); r.set(1, 0, m[4]); } r.set(2, 2, ramp(e)[3]); return r; });
}
/** spectral recolour of an actual boss frame (echoes, afterimages, the giant Anubis double) */
export function vGhostOf(boss: BossId, form: Form, dir: Dir, pose: import('./kit').Pose, f: number, e: El, key: string) {
  return cached(`gof/${boss}/${form}/${dir}/${key}/${e}`, () => {
    const fo = renderPose(boss, form, dir, pose, f), r = new Raster(fo.w, fo.h), rp = ramp(e), src = fo.comp;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const c = src.get(x, y); if (!c) continue; const edge = !src.get(x - 1, y) || !src.get(x + 1, y) || !src.get(x, y - 1) || !src.get(x, y + 1); if (edge) r.set(x, y, rp[4]); else if ((x + y) % 2 === 0) r.set(x, y, rp[(c % 3) + 1]); }
    return r;
  });
}
/** telegraph outlines (pixel-dotted, quantised) */
export function vZoneCircle(e: El, rad: number, prog: number) {
  rad = q(rad, 4); const P = Math.round(prog * 4);
  return cached(`zc/${e}/${rad}/${P}`, () => { const s = rad * 2 + 4, r = new Raster(s, s), c = s / 2, rp = ramp(e), n = Math.round(rad * 6); for (let i = 0; i < n; i++) { if (i % 3 === 2) continue; const a = (i / n) * 6.283; r.set(c + Math.cos(a) * rad, c + Math.sin(a) * rad, rp[P >= 3 ? 4 : 2]); } if (P > 0) { const ir = rad * P / 4; for (let i = 0; i < n; i += 4) { const a = (i / n) * 6.283; r.set(c + Math.cos(a) * ir, c + Math.sin(a) * ir, rp[1]); } } return r; });
}

// ======================= CINEMATIC LAYER GENERATORS (pixel-only) =======================
const GLYPH: string[][] = [
  ['.#.', '#.#', '.#.', '###', '.#.'], ['...', '###', '#.#', '###', '..#'], ['##.', '#..', '##.', '#..', '#..'], ['#.#', '.#.', '.#.', '.#.', '##.'],
  ['###', '.#.', '###', '.#.', '###'], ['#..', '##.', '###', '##.', '#..'], ['.#.', '###', '.#.', '.#.', '#.#'], ['###', '#.#', '#.#', '#.#', '###'],
];
function glyph(r: Raster, x: number, y: number, g: string[], c: number) { g.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') r.set(x + i - 1, y + j - 2, c); }); }
function star4(r: Raster, x: number, y: number, s: number, cHot: number, cMid: number) { for (let k = 1; k <= s; k++) { const c = k === 1 ? cHot : cMid; r.set(x + k, y, c); r.set(x - k, y, c); r.set(x, y + k * 0.6, c); r.set(x, y - k * 0.6, c); } r.set(x, y, cHot); }
export const SIGIL_PERIOD: Record<string, number> = { surtur: 48, typhon: 32, aion: 144, atlas: 64, argus: 48, anubis: 48 };
/** Boss-specific ground sigil on the ground plane (y squashed 0.5). step ∈ [0, SIGIL_PERIOD). hot 0..2 brightens on commit. */
export function vSigil(boss: string, rad: number, step: number, hot: number) {
  rad = q(rad, 2);
  return cached(`sigil/${boss}/${rad}/${step}/${hot}`, () => {
    const W = rad * 2 + 16, H = rad + 16, r = new Raster(W, H), cx = W / 2, cy = H / 2, sq = 0.5;
    const P = (a: number, rr: number): [number, number] => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sq];
    const ring = (rr: number, c: number, gap = (_i: number) => false) => { const n = Math.max(24, Math.round(rr * 6.5)); for (let i = 0; i < n; i++) { if (gap(i)) continue; const [x, y] = P((i / n) * 6.283, rr); r.set(x, y, c); } };
    const ln = (a: number, r0: number, r1: number, c: number) => { const [x0, y0] = P(a, r0), [x1, y1] = P(a, r1); r.line(x0, y0, x1, y1, c); };
    const per = SIGIL_PERIOD[boss] || 48, rot = (step / per) * Math.PI * 2;
    const pick = (rp: number[], base: number) => rp[Math.min(rp.length - 1, base + hot)];
    if (boss === 'surtur') {
      const rp = R.lava; ring(rad, pick(rp, 2)); ring(rad - 3, pick(rp, 1), (i) => i % 7 === 0); ring(rad * 0.62, pick(rp, 2));
      for (let i = 0; i < 16; i++) { const a = rot + (i / 16) * 6.283, [bx0, by0] = P(a - 0.09, rad), [bx1, by1] = P(a + 0.09, rad), [tx, ty] = P(a, rad + 6 + (i % 2) * 3); r.line(bx0, by0, tx, ty, pick(rp, 3)); r.line(bx1, by1, tx, ty, pick(rp, 2)); r.set(tx, ty, pick(rp, 3)); }
      for (let i = 0; i < 8; i++) { const a = -rot * 1.5 + (i / 8) * 6.283, [x, y] = P(a, rad * 0.81); glyph(r, x, y, GLYPH[(i * 3) % GLYPH.length], pick(rp, 3)); }
      for (let i = 0; i < 3; i++) { const a = rot * 0.5 + (i / 3) * 6.283; const [x0, y0] = P(a, rad * 0.62), [x1, y1] = P(a + 2.094, rad * 0.62); r.line(x0, y0, x1, y1, pick(rp, 1)); }
    } else if (boss === 'typhon') {
      const rp = R.force; ring(rad, pick(rp, 2), (i) => Math.floor(i / 9 + step / 4) % 5 === 0); ring(rad * 0.45, pick(rp, 3), (i) => Math.floor(i / 4 - step / 3) % 3 === 0);
      for (let i = 0; i < 10; i++) { let a = (i / 10) * 6.283 + hash2(i, 3, 7) * 0.4, rr = rad * 0.3; let [x, y] = P(a, rr); while (rr < rad * 1.18) { rr += 3; a += (hash2(i, rr | 0, 2) - 0.5) * 0.25; const [nx, ny] = P(a, rr); r.line(x, y, nx, ny, rr > rad ? pick(rp, 1) : pick(rp, 2)); x = nx; y = ny; } }
      for (let i = 0; i < 6; i++) { const a = rot + (i / 6) * 6.283, [x, y] = P(a, rad * 0.72); r.rect(x - 1, y - 1, 3, 2, pick(rp, 3)); }
    } else if (boss === 'aion') {
      const rp = R.time, br = R.bronze;
      for (let i = 0; i < 36; i++) { const a = -rot / 6 + (i / 36) * 6.283; const [x, y] = P(a, rad + 4); r.set(x, y, br[2 + Math.min(2, hot)]); if (i % 2 === 0) { const [x2, y2] = P(a, rad + 6); r.set(x2, y2, br[3]); } }
      ring(rad, pick(rp, 2)); ring(rad - 2, pick(rp, 1)); ring(rad * 0.3, pick(rp, 2));
      for (let i = 0; i < 60; i++) { const a = (i / 60) * 6.283 - Math.PI / 2; if (i % 5 === 0) ln(a, rad - 7, rad - 3, pick(rp, 3)); else if (rad > 28) { const [x, y] = P(a, rad - 4); r.set(x, y, pick(rp, 1)); } }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283 - Math.PI / 2, [x, y] = P(a, rad * 0.72), n = (i % 4) + 1; for (let k = 0; k < n; k++) r.line(x - n + k * 2, y - 1, x - n + k * 2, y + 1, pick(rp, 2)); }
      const mA = (step / 12) * 6.283 - Math.PI / 2, hA = (step / per) * 6.283 - Math.PI / 2;
      ln(hA, 0, rad * 0.45, pick(br, 3)); ln(hA + 0.06, 0, rad * 0.42, pick(br, 2));
      ln(mA, 0, rad * 0.78, pick(rp, 3)); const [tx, ty] = P(mA, rad * 0.78); r.set(tx, ty, rp[5]);
      r.disc(cx, cy, 1.5, br[4]);
    } else if (boss === 'atlas') {
      const rp = R.space; ring(rad, pick(rp, 1), (i) => i % 3 === 2); ring(rad * 0.6, pick(rp, 1), (i) => i % 4 === 3);
      const stars: [number, number][] = [];
      for (let i = 0; i < 9; i++) { const rr = i % 2 ? rad * 0.6 : rad * (0.88 + hash2(i, 1, 4) * 0.1), a = (i % 2 ? -rot : rot) + (i / 9) * 6.283 + hash2(i, 2, 4); stars.push(P(a, rr)); }
      for (let i = 0; i < stars.length; i++) { const j = (i + 2) % stars.length; if (i % 3 !== 2) r.line(stars[i][0], stars[i][1], stars[j][0], stars[j][1], pick(rp, 1)); }
      stars.forEach(([x, y], i) => star4(r, x, y, 1 + (i % 3 === 0 ? 2 : 1) + (hot > 0 ? 1 : 0), R.star[0], pick(rp, 3)));
      r.oval(cx, cy, 3, 2, R.void[0]); r.set(cx, cy - 1, rp[4]);
    } else if (boss === 'argus') {
      const rp = R.mind; ring(rad, pick(rp, 2)); ring(rad * 0.86, pick(rp, 1), (i) => i % 2 === 1);
      for (let i = 0; i < 16; i++) { const a = rot + (i / 16) * 6.283; ln(a, rad * 0.55, rad * (i % 2 ? 0.75 : 0.82), pick(rp, i % 2 ? 1 : 2)); }
      const ew = rad * 0.5; for (let x = -ew; x <= ew; x++) { const yy = Math.sqrt(Math.max(0, 1 - (x * x) / (ew * ew))) * rad * 0.16; r.set(cx + x, cy - yy, pick(rp, 3)); r.set(cx + x, cy + yy, pick(rp, 3)); }
      r.disc(cx, cy, Math.max(1.5, rad * 0.09), pick(R.iris, 0)); r.set(cx, cy, R.pupil[0]); if (hot) r.set(cx, cy, R.mind[5]);
      for (let i = 0; i < 8; i++) { const a = -rot * 0.7 + (i / 8) * 6.283, [x, y] = P(a, rad * 0.93); r.rect(x - 1, y, 3, 1, pick(rp, 3)); r.set(x, y, R.pupil[0]); }
    } else {
      const rp = R.soul, gd = R.fgold; ring(rad, pick(gd, 2)); ring(rad * 0.78, pick(gd, 2)); ring(rad * 0.45, pick(rp, 2), (i) => i % 3 === 1);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + 0.3, [x, y] = P(a, rad * 0.82); r.set(x, y, i % 2 ? rp[3] : rp[2]); r.set(x + 1, y, rp[2]); }
      for (let i = 0; i < 4; i++) { const a = -rot + (i / 4) * 6.283; ln(a, rad * 0.12, rad * 0.45, pick(gd, 1)); }
      r.poly([[cx, cy - 4], [cx + 3, cy], [cx, cy + 4], [cx - 3, cy]], pick(rp, 3));
    }
    return r;
  });
}
export function vGlint(e: El, s: number) { return cached(`glint/${e}/${s}`, () => { const n = s * 2 + 5, r = new Raster(n, n), c = (n / 2) | 0, rp = ramp(e); for (let k = 1; k <= s; k++) { const col = k < s * 0.35 ? rp[5] : k < s * 0.7 ? rp[4] : rp[3]; r.set(c + k, c, col); r.set(c - k, c, col); r.set(c, c + k, col); r.set(c, c - k, col); if (k < s * 0.45) { r.set(c + k * 0.7, c + k * 0.7, rp[3]); r.set(c - k * 0.7, c - k * 0.7, rp[3]); r.set(c + k * 0.7, c - k * 0.7, rp[3]); r.set(c - k * 0.7, c + k * 0.7, rp[3]); } } r.disc(c, c, 1, rp[5]); return r; }); }
/** big impact star: white-hot core, 8 tapering rays, shards flying out; fr 0..3 */
export function vImpact(e: El, size: number, fr: number, seed = 1) {
  size = q(size, 2);
  return cached(`imp/${e}/${size}/${fr}/${seed % 3}`, () => {
    const n = size * 2 + 8, r = new Raster(n, n), c = n / 2, rp = ramp(e), t = fr / 3;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + 0.2 + hash2(i, seed, 1) * 0.3, L = size * (i % 2 ? 0.55 : 1) * (0.6 + 0.4 * t), s0 = size * t * 0.5; for (let k = s0; k < L; k++) { const w = (1 - k / L) * (i % 2 ? 1 : 2) * (1 - t * 0.6); const col = k < L * 0.4 ? rp[5] : k < L * 0.75 ? rp[4] : rp[3]; for (let j = -w; j <= w; j++) r.set(c + Math.cos(a) * k - Math.sin(a) * j, c + Math.sin(a) * k + Math.cos(a) * j, col); } }
    if (t < 0.7) { r.disc(c, c, size * 0.32 * (1 - t), rp[4]); r.disc(c, c, size * 0.18 * (1 - t), rp[5]); }
    if (t > 0.2) for (let i = 0; i < 10; i++) { const a = hash2(i, seed, 9) * 6.283, d = size * (0.7 + t * 0.6) * (0.6 + hash2(i, 4, seed) * 0.5); r.set(c + Math.cos(a) * d, c + Math.sin(a) * d, rp[t > 0.6 ? 2 : 4]); r.set(c + Math.cos(a) * (d - 1), c + Math.sin(a) * (d - 1), rp[3]); }
    return r;
  });
}
/** dithered smoke / ash puff, grows & thins over 6 frames */
export function vSmoke(size: number, fr: number, seed: number, dark = true) {
  size = q(size, 2);
  return cached(`smk/${size}/${fr}/${seed % 4}/${dark}`, () => {
    const n = size * 3 + 4, r = new Raster(n, n), c = n / 2, t = fr / 5, rr = size * (0.6 + t * 0.8), cols = dark ? R.ash : [R.rock[3], R.rock[4], R.belly[2]];
    for (let k = 0; k < 5; k++) { const bx = c + (hash2(k, seed, 1) - 0.5) * size, by = c + (hash2(k, seed, 2) - 0.5) * size * 0.6 - t * size * 0.4, br = rr * (0.45 + hash2(k, seed, 3) * 0.35);
      for (let y = -br; y <= br; y++) for (let x = -br; x <= br; x++) { const d = Math.hypot(x, y) / br; if (d > 1) continue; const th = t * 0.9 + d * 0.35; if (hash2(Math.round(bx + x), Math.round(by + y), seed + fr) < th) continue; r.set(bx + x, by + y, cols[d < 0.4 ? 2 : d < 0.75 ? 1 : 0]); } }
    return r;
  });
}
/** radial ground crack decal (force/fire/space); heat 0..2 glowing seams */
export function vCrack(e: El, rad: number, seed: number, heat: number) {
  rad = q(rad, 4);
  return cached(`crk/${e}/${rad}/${seed % 6}/${heat}`, () => {
    const W = rad * 2 + 6, H = rad + 6, r = new Raster(W, H), cx = W / 2, cy = H / 2, rp = ramp(e), dk = e === 'space' ? R.void[0] : e === 'fire' ? R.ash[0] : R.rock[0];
    const nb = 7 + (seed % 3);
    for (let i = 0; i < nb; i++) { let a = (i / nb) * 6.283 + hash2(i, seed, 1) * 0.5, d = 2, x = cx, y = cy; const L = rad * (0.6 + hash2(i, seed, 2) * 0.4);
      while (d < L) { d += 2; a += (hash2(i, d, seed) - 0.5) * 0.5; const nx = cx + Math.cos(a) * d, ny = cy + Math.sin(a) * d * 0.5;
        // 2px dark fissure with a hot inner seam and raised lip highlights
        r.line(x, y, nx, ny, dk); r.line(x, y + 1, nx, ny + 1, dk); r.set(nx, ny - 1, R.rock[3]);
        if (heat > 0 && d < L * (0.45 + heat * 0.25)) { r.set(nx, ny, rp[Math.min(5, 1 + heat)]); r.set(nx - Math.sin(a) * 0, ny + 1, rp[Math.max(1, heat)]); }
        if (hash2(i, d, seed + 11) < 0.2) r.set(nx + 1, ny + 2, R.rock[4]);
        x = nx; y = ny;
        if (hash2(i, d, seed + 3) < 0.12) { const ba = a + (hash2(d, i, 1) - 0.5) * 1.6; r.line(nx, ny, nx + Math.cos(ba) * 5, ny + Math.sin(ba) * 2.5, dk); } } }
    r.oval(cx, cy, 3, 1.5, dk); if (heat) r.set(cx, cy, rp[4]);
    return r;
  });
}
/** trail stamp: age 0 (white-hot) .. 3 (cool, sparse) */
export function vTrailDot(e: El, w: number, age: number) {
  return cached(`td/${e}/${w}/${age}`, () => { const n = w * 2 + 3, r = new Raster(n, n), c = n / 2, rp = ramp(e); const cols = [[5, 4, 3], [4, 3, 2], [3, 2, 1], [2, 1, 1]][age]; r.disc(c, c, w, rp[cols[2]]); if (w >= 1.5) r.disc(c, c, w * 0.6, rp[cols[1]]); r.disc(c, c, Math.max(0.5, w * 0.25), rp[cols[0]]); if (age >= 2) for (let i = 0; i < r.d.length; i += 2) if (r.d[i] && hash2(i, age, 2) < 0.35) r.d[i] = 0; return r; });
}
const FONT: Record<string, string[]> = { '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'], '3': ['###', '..#', '.##', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'], '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '###'] };
/** pixel damage number with 1px dark outline */
export function vDigits(n: number, col: number) {
  return cached(`dig/${n}/${col}`, () => { const s = String(Math.max(0, Math.round(n))), r = new Raster(s.length * 4 + 3, 8); [...s].forEach((ch, k) => glyph(r, 2 + k * 4, 3, FONT[ch] || FONT['0'], col)); const src = r.clone(); for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (!src.get(x, y) && (src.get(x - 1, y) || src.get(x + 1, y) || src.get(x, y - 1) || src.get(x, y + 1))) r.set(x, y, R.k[0]); return r; });
}
/** tiny clock-gear shard (time motes) and generic 4-point twinkle */
export function vGear(s: number, step: number) { return cached(`gear/${s}/${step % 4}`, () => { const n = s * 2 + 5, r = new Raster(n, n), c = n / 2; r.disc(c, c, s, R.bronze[3]); r.disc(c, c, Math.max(0.5, s * 0.4), 0); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + step * 0.26; r.set(c + Math.cos(a) * (s + 1), c + Math.sin(a) * (s + 1), R.bronze[4]); } r.set(c, c, R.time[4]); return r; }); }
export function vTwinkle(e: El, s: number) { return cached(`tw/${e}/${s}`, () => { const n = s * 2 + 3, r = new Raster(n, n), c = (n / 2) | 0, rp = ramp(e); star4(r, c, c, s, e === 'space' ? R.star[0] : rp[5], rp[3]); return r; }); }

// ============================ V2: IMPACT-FIRST EFFECT DESIGN ============================
// Techniques from the research pass: uneven frame timing (impact frames fast, decay slow), a white-hot core
// surrounded by a darker silhouette ring, jagged asymmetric tongues, dark smoke reading as volume, sparse bright
// sparks for contrast, and a clear focal point. Everything stays palette-indexed pixels.
function jagRing(r: Raster, cx: number, cy: number, rad: number, n: number, amp: number, seed: number, c: number, fill = false) {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, rr = rad * (1 - amp * 0.5 + hash2(i, seed, 5) * amp); pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  if (fill) for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
    let inside = false; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } if (inside) r.set(x, y, c);
  } else for (let i = 0; i < n; i++) { const j = (i + 1) % n; r.line(pts[i * 2], pts[i * 2 + 1], pts[j * 2], pts[j * 2 + 1], c); }
}
function ditherDisc(r: Raster, cx: number, cy: number, rad: number, c: number, seed: number, density: number) {
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { if (x * x + y * y > rad * rad) continue; if (hash2(x + cx | 0, y + cy | 0, seed) > density) continue; if (((x + y + (seed & 1)) & 1) && density > 0.5) continue; r.set(cx + x, cy + y, c); }
}
/** PREMIUM EXPLOSION: 6 phases (flash → corona → fragmentation → smoke → ash). Bigger, asymmetric, 3 depth layers. */
export function vNova(e: El, rad: number, fr: number, seed = 1) {
  rad = q(rad, 4);
  return cached(`nova/${e}/${rad}/${fr}/${seed % 4}`, () => {
    const s = rad * 2 + 14, r = new Raster(s, s), c = s / 2, rp = ramp(e), dark = e === 'space' ? R.void[0] : e === 'soul' ? R.jet[0] : e === 'mind' ? R.regal[0] : e === 'time' ? R.robe[0] : e === 'force' ? R.rock[0] : R.obs[0], t = fr / 5;
    const core = fr === 0 ? rad * 0.16 : fr === 1 ? rad * 0.3 : Math.max(0, rad * (0.26 - (fr - 2) * 0.06));
    if (fr === 0) {
      // impact frame: a sharp white-hot slit + 6 long razor spikes, NOT a colored disc
      const spikes0 = 6;
      for (let i = 0; i < spikes0; i++) { const a = (i / spikes0) * 6.283 + hash2(i, seed, 3) * 0.4, L = rad * (0.75 + hash2(i, seed, 4) * 0.45); for (let d = rad * 0.1; d < L; d += 0.8) { const w = Math.max(0, 1.6 - (d / L) * 1.3); for (let j = -w; j <= w; j += 0.7) r.set(c + Math.cos(a) * d - Math.sin(a) * j, c + Math.sin(a) * d + Math.cos(a) * j, d < L * 0.45 ? rp[5] : d < L * 0.8 ? rp[4] : rp[3]); } r.set(c + Math.cos(a) * L, c + Math.sin(a) * L, rp[5]); }
      r.disc(c, c, Math.max(1.2, rad * 0.16), rp[5]); r.disc(c, c, Math.max(0.7, rad * 0.08), R.k[1]);
      for (let i = 0; i < 10; i++) { const a = hash2(i, seed, 7) * 6.283, d = rad * (0.35 + hash2(i, seed, 8) * 0.75); r.set(c + Math.cos(a) * d, c + Math.sin(a) * d, i % 2 ? rp[4] : rp[5]); }
      return r;
    }
    // dark offset volume behind the blast (reads as depth even on bright floors)
    if (fr >= 2) for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.283 + hash2(k, seed, 4) + 0.6, d = rad * (0.45 + t * 0.5) * (0.6 + hash2(k, seed, 6) * 0.4); cluster(r, c + Math.cos(a) * d, c + Math.sin(a) * d * 0.8, rad * (0.24 + t * 0.26), k % 2 ? dark : rp[1], dark, k % 2 ? rp[2] : rp[1], seed + k, t * 0.8, 3); }
    // corona tongues (asymmetric spikes, hot at base, dark tips)
    const spikes = 11 + (seed % 3);
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * 6.283 + hash2(i, seed, 1) * 0.35, L = rad * (0.6 + hash2(i, seed, 2) * 0.45) * (fr <= 1 ? 0.55 + fr * 0.5 : 1 - (fr - 2) * 0.07), base = rad * (fr <= 1 ? 0.14 + fr * 0.1 : 0.12 + t * 0.25);
      for (let d = base; d < L; d += 0.8) {
        const u = d / L, spread = (1 - u) * rad * 0.09 + 1.4, hot = u < 0.3 ? rp[5] : u < 0.55 ? rp[4] : u < 0.8 ? rp[3] : rp[2];
        for (let j = -spread; j <= spread; j += 0.9) { if (hash2(i * 7 + Math.round(d), Math.round(j * 2), seed + fr) < 0.18 + u * 0.18) continue; r.set(c + Math.cos(a) * d - Math.sin(a) * j, c + Math.sin(a) * d + Math.cos(a) * j * 0.85, hot); }
      }
    }
    // shock lens: thin bright irregular ring snapping outward on the first frames
    if (fr <= 4) { const rr = rad * (0.5 + fr * 0.3); jagRing(r, c, c, rr, 30, 0.2, seed, rp[4]); if (fr <= 2) for (let i = 0; i < 30; i++) { if (i % 3 === 0) continue; const a = (i / 30) * 6.283, x = c + Math.cos(a) * (rr - 1), y = c + Math.sin(a) * (rr - 1); r.set(x, y, rp[5]); } }
    // hot core
    if (core > 0.4) { jagMass(r, c, c, core + 2, rp[4], rp[3], seed + 2, 0.34); jagMass(r, c, c, core * 0.72, rp[5], R.k[1], seed + 3, 0.4); }
    // embers / sparks
    for (let i = 0; i < 12; i++) { const a = hash2(i, seed, 8) * 6.283, d = rad * (0.5 + t * 0.7) * (0.5 + hash2(i, seed, 9) * 0.7), x = c + Math.cos(a) * d, y = c + Math.sin(a) * d * 0.9 - t * 6 * hash2(i, 3, 2); r.set(x, y, i % 3 === 0 ? rp[5] : rp[4]); if (fr > 2 && hash2(i, 1, 4) < 0.4) r.set(x + Math.cos(a), y + Math.sin(a), rp[2]); }
    if (fr >= 4) for (let i = 0; i < 6; i++) { const a = hash2(i, seed, 13) * 6.283, d = rad * 0.7; r.set(c + Math.cos(a) * d, c + Math.sin(a) * d - (fr - 3) * 4, R.ash[1 + (i % 2)]); }
    return r;
  });
}
/** SHOCKWAVE V2: leading white edge, hot band, dark dust underside, broken into arcs so it reads as volume. */
export function vShock(e: El, rad: number, fr = 0, thick = 3, seed = 1) {
  rad = q(rad, 4);
  return cached(`shock2/${e}/${rad}/${fr}/${thick}/${seed % 4}`, () => {
    const s = rad * 2 + 12, r = new Raster(s, s), c = s / 2, rp = ramp(e), cy = c + rad * 0.06, n = Math.round(rad * 4.2), T = Math.max(3, thick + 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283, gap = hash2(Math.floor(i / 7), seed, 3) < 0.13; if (gap) continue;
      const wob = (hash2(i, seed, 2) - 0.5) * 3.2, rr = rad + wob;
      for (let k = 0; k < T; k++) {
        const d = rr - k, x = c + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.62;
        // leading 1px white edge, then hot band, then dust underside that breaks into ticks
        const col = k === 0 ? rp[5] : k === 1 ? rp[4] : k === 2 ? rp[Math.max(2, fr - 1)] : (hash2(i, k, seed) < 0.6 ? rp[1] : 0);
        r.set(x, y, col);
        if (k === 0 && (i & 3) === 0) { r.set(x + Math.cos(a), y + Math.sin(a) * 0.62, rp[4]); r.set(x + Math.cos(a) * 2, y + Math.sin(a) * 1.24, rp[3]); }
      }
      if (hash2(i, seed, 4) < 0.2) { const d = rr + 2 + hash2(i, seed, 9) * 3; r.set(c + Math.cos(a) * d, cy + Math.sin(a) * d * 0.62, rp[4]); r.set(c + Math.cos(a) * (d + 1), cy + Math.sin(a) * (d + 1) * 0.62, rp[3]); }
    }
    return r;
  });
}
/** SLASH V2: tapered crescent with a white-hot cutting edge, colored body and spark fringe. */
export function vSlashV2(e: El, rad: number, a0: number, a1: number, wid: number, fr = 0) {
  rad = q(rad, 4); const A0 = qa(a0, 32), A1 = qa(a1, 32);
  return cached(`slash2/${e}/${rad}/${A0}/${A1}/${wid}/${fr}`, () => {
    const s = rad * 2 + 12, r = new Raster(s, s), c = s / 2, rp = ramp(e);
    let s0 = (A0 / 32) * 6.283, s1 = (A1 / 32) * 6.283, span = s1 - s0; while (span > Math.PI) span -= 6.283; while (span < -Math.PI) span += 6.283;
    const steps = Math.max(12, Math.round(Math.abs(span) * rad * 1.6));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, env = Math.sin(Math.PI * Math.min(1, t)) ** 0.5, a = s0 + span * t;
      const W = Math.max(1, wid * env * (1 - fr * 0.2));
      for (let k = 0; k < W; k++) {
        const u = k / W, x = c + Math.cos(a) * (rad - k), y = c + Math.sin(a) * (rad - k);
        if (k === 0) r.set(x, y, rp[5]);
        else if (u < 0.35) r.set(x, y, rp[4]);
        else if (u < 0.7) r.set(x, y, rp[3]);
        else if (hash2(i, k, 3) > fr * 0.2) r.set(x, y, rp[2]);
      }
      if (hash2(i, 7, 5) < 0.14) { const rr = rad + 2; r.set(c + Math.cos(a) * rr, c + Math.sin(a) * rr, rp[4]); r.set(c + Math.cos(a) * (rr + 1), c + Math.sin(a) * (rr + 1), rp[3]); }
    }
    return r;
  });
}
/** FIRE V2: dark breakup shell, orange body, white core line, rising embers. */
export function vFlameV2(e: El, w: number, h: number, fr: number, seed = 1) {
  w = q(w, 2); h = q(h, 2);
  return cached(`flame2/${e}/${w}/${h}/${fr % 8}/${seed % 6}`, () => {
    const r = new Raster(w + 4, h + 4), rp = ramp(e), dark = e === 'soul' ? R.jet[1] : e === 'fire' ? R.ash[0] : rp[0];
    for (let x = 0; x < w; x++) {
      const u = x / Math.max(1, w - 1), env = Math.sin(Math.PI * u) ** 0.65;
      const n = hash2(x >> 1, fr, seed) * 0.45 + hash2(x >> 2, fr + 9, seed) * 0.45 + hash2(x >> 3, fr + 3, seed + 2) * 0.1;
      const hh = Math.round(h * env * (0.5 + 0.85 * n));
      for (let j = 0; j < hh; j++) {
        const t = j / Math.max(1, hh), sway = Math.round(Math.sin(j * 0.5 + fr * 0.9 + seed) * (t * 1.6));
        const X = x + 2 + sway, Y = h + 2 - j;
        if (t > 0.62 && hash2(x, j + fr * 5, seed) < 0.42) continue;
        if (t > 0.92) continue;
        const ci = t < 0.16 ? 5 : t < 0.34 ? 4 : t < 0.58 ? 3 : t < 0.8 ? 2 : 1;
        r.set(X, Y, rp[ci]);
        if (t < 0.42 && u > 0.28 && u < 0.72) { r.set(X + 1, Y, rp[4]); if (u > 0.4 && u < 0.6) r.set(X, Y, rp[5]); } // inner hot column
        if (t > 0.7 && t < 0.86 && hash2(x, j, seed) < 0.5) { r.set(X + 1, Y, dark); r.set(X - 1, Y, dark); }
      }
    }
    for (let i = 0; i < Math.max(2, Math.round(w / 6)); i++) { const ex = 2 + ((hash2(i, fr, seed) * w) | 0), ey = Math.max(0, h + 2 - ((fr * 3 + i * 5) % Math.max(4, h))); r.set(ex, ey, i % 2 ? rp[5] : rp[4]); }
    return r;
  });
}
/** PORTAL V2: torn double rim, folded interior depth bands, starfield/glyph depth, bright lip. */
export function vPortalV2(rad: number, open: number, fr: number, seed = 1, e: El = 'space') {
  rad = q(rad, 2); const O = Math.round(open * 4);
  return cached(`portal2/${e}/${rad}/${O}/${fr % 8}/${seed % 4}`, () => {
    const rx = rad, ry = Math.max(2, rad * 0.58 * (O / 4)), s = rad * 2 + 12, r = new Raster(s, s), c = s / 2, rp = ramp(e);
    if (O === 0) { for (let x = -rx; x <= rx; x++) { const y = Math.sin(x * 0.5 + fr) * 1.2; r.set(c + x, c + y, rp[4]); if (x % 3 === 0) r.set(c + x, c + y - 1, rp[3]); } return r; }
    const rim = (k: number, col: number, jag: number) => { const n = Math.round(rx * 5); for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, wob = 1 + (hash2(Math.round(a * 7 + fr * 0.4), seed + k, 3) - 0.5) * jag; r.set(c + Math.cos(a) * (rx + k) * wob, c + Math.sin(a) * (ry + k) * wob, rp[col]); } };
    // folded interior: nested depth folds converging on a lightless throat, brighter toward the lip
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const a = Math.atan2(y, x), jag = 1 + (hash2(Math.round(a * 6 + fr * 0.5), seed, 3) - 0.5) * 0.2, d = Math.hypot(x / rx, y / ry) / jag;
      if (d > 1.02) continue;
      const fold = Math.floor((a / 6.283 + 0.5) * 7 + Math.sin(fr * 0.6) * 0.7 + d * 2) % 7;
      let ci: number;
      if (d > 0.88) ci = fold % 3 === 0 ? 4 : 3;
      else if (d > 0.62) ci = fold % 2 ? 3 : 2;
      else if (d > 0.36) ci = fold % 3 === 0 ? 3 : 1;
      else if (d > 0.16) ci = 1;
      else ci = e === 'space' ? R.void[0] : R.jet[0];
      if (Math.abs(d - 0.62) < 0.03 || Math.abs(d - 0.88) < 0.03) ci = Math.max(ci, 4);
      r.set(c + x, c + y, ci);
    }
    // thick torn lip: dark outer band, mid rim, white-hot inner edge, flicking shards. The previous
    // lip was a single bright hairline, so a 52px rift read as a pale bubble instead of a tear.
    rim(5, 0, 0.36); rim(4, 1, 0.32); rim(3, 2, 0.28); rim(2, 3, 0.22); rim(1, 4, 0.16); rim(0, 5, 0.1);
    for (let i = 0; i < 12; i++) { const a = hash2(i, fr, seed + 6) * 6.283, d = 1.04 + hash2(i, 3, seed) * 0.22; r.set(c + Math.cos(a) * rx * d, c + Math.sin(a) * ry * d, i % 3 === 0 ? R.k[1] : rp[4]); }
    // depth lights + energy veins crawling on the aperture
    for (let i = 0; i < 9; i++) { const a = hash2(i, fr >> 1, seed) * 6.283, d = 0.25 + hash2(i, 5, seed) * 0.5; r.set(c + Math.cos(a) * rx * d, c + Math.sin(a) * ry * d, e === 'space' ? R.star[0] : rp[5]); if (i % 2 === 0) r.set(c + Math.cos(a) * rx * d + 1, c + Math.sin(a) * ry * d, rp[3]); }
    for (let i = 0; i < 3; i++) { const a = hash2(i, seed, 21) * 6.283; for (let d = 0.2; d < 0.9; d += 0.05) r.set(c + Math.cos(a + d * 2 + fr * 0.1) * rx * d, c + Math.sin(a + d * 2 + fr * 0.1) * ry * d, rp[4]); }
    // fringe interference arcs flicking off the lip
    for (let i = 0; i < 5; i++) { const a = hash2(i, fr, seed + 4) * 6.283, d0 = 1.02 + hash2(i, 2, seed) * 0.18; for (let k = 0; k < 4; k++) r.set(c + Math.cos(a) * rx * (d0 + k * 0.06), c + Math.sin(a) * ry * (d0 + k * 0.06), k < 2 ? rp[5] : rp[3]); }
    return r;
  });
}
/** EYE V2: shaded sclera, radial iris streaks, refractive pupil, heavy gold lids; real=true contracts + white cross core. */
export function vEyeV2(size: number, open: number, lx: number, ly: number, charge: number, real: boolean) {
  size = q(size, 2); const O = Math.round(open * 4), LX = Math.round(lx * 2), LY = Math.round(ly * 2), C = Math.round(charge * 3);
  return cached(`eye2/${size}/${O}/${LX}/${LY}/${C}/${real ? 1 : 0}`, () => {
    const rx = size, ry = Math.round(size * 0.62), s = size * 2 + 10, r = new Raster(s, s), c = s / 2;
    // gold socket + lashes
    r.oval(c, c, rx + 3, ry + 3, R.gold[0]); r.oval(c, c, rx + 2, ry + 2, R.gold[2]); r.oval(c, c, rx + 1, ry + 1, R.gold[4]);
    r.oval(c, c, rx, ry + 1, R.eyew[0]); r.oval(c, c, rx - 1, ry, R.eyew[1]);
    for (let x = -rx; x <= rx; x++) { const yy = Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx))) * ry; r.set(c + x, c - yy - 1, R.gold[3]); r.set(c + x, c + yy + 1, R.gold[1]); if ((x + rx) % 5 === 0) { r.set(c + x, c - yy - 3, R.gold[4]); r.set(c + x + 1, c - yy - 4, R.gold[3]); } }
    const ir = Math.max(1, ry * 0.82), ix = c + LX * (rx - ir) * 0.35, iy = c + LY * (ry - ir) * 0.3;
    r.disc(ix, iy, ir + 1, R.gold[1]);
    r.disc(ix, iy, ir, R.iris[1]);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283; r.set(ix + Math.cos(a) * ir * 0.75, iy + Math.sin(a) * ir * 0.75, i % 2 ? R.iris[2] : R.iris[0]); }
    const pr = real ? Math.max(0.9, ir * (0.5 - C * 0.1)) : ir * 0.62;
    r.disc(ix, iy, pr, R.pupil[0]);
    if (real && C >= 2) { for (let k = 0; k <= 3; k++) { r.set(ix + k, iy, k ? R.mind[4] : R.mind[5]); r.set(ix - k, iy, k ? R.mind[4] : R.mind[5]); r.set(ix, iy + k, R.mind[4]); r.set(ix, iy - k, R.mind[4]); } r.set(ix + 1, iy + 1, R.mind[3]); r.set(ix - 1, iy - 1, R.mind[3]); }
    else if (!real && C >= 2) { r.disc(ix, iy, ir * 0.4, R.mind[1]); r.rect(ix - ir * 0.5, iy - 1, ir, 2, R.mind[2]); r.set(ix, iy, R.iris[1]); }
    else { r.set(ix - pr * 0.4, iy - pr * 0.4, R.eyew[2]); r.set(ix - pr * 0.3, iy - pr * 0.5, R.k[1]); r.set(ix + pr * 0.5, iy + pr * 0.5, R.iris[0]); }
    const lid = Math.round((ry * 2 + 3) * (1 - O / 4));
    for (let j = 0; j < lid; j++) for (let x = -rx - 2; x <= rx + 2; x++) { const Y = c - ry - 2 + j; if (r.get(c + x, Y)) r.set(c + x, Y, j === lid - 1 ? R.flesh[2] : j === lid - 2 ? R.gold[2] : R.flesh[1]); }
    return r;
  });
}
/** GHOST / SPECTRAL SOLDIER V2: hollow torso, tattered banner, weapon per variant, foot wisps. */
export function vGhostV2(fr: number, variant: number, e: El = 'soul') {
  return cached(`ghost2/${e}/${fr % 4}/${variant % 3}`, () => {
    const r = new Raster(22, 26), rp = ramp(e), m = new Raster(22, 26), b = fr % 2;
    const cx = 11, hy = 6;
    m.oval(cx, hy, 3.4, 3.2, 1);
    if (variant === 0) { m.poly([[cx - 2, hy - 2], [cx - 4, hy - 7], [cx - 1, hy - 3]], 1); m.poly([[cx + 2, hy - 2], [cx + 4, hy - 7], [cx + 1, hy - 3]], 1); }
    if (variant === 1) { m.poly([[cx - 3, hy - 2], [cx - 6, hy - 9], [cx - 1, hy - 3]], 1); m.poly([[cx + 3, hy - 2], [cx + 7, hy - 8], [cx + 1, hy - 3]], 1); m.oval(cx, hy, 4, 3.6, 1); }
    if (variant === 2) m.poly([[cx - 4, hy + 1], [cx, hy - 6], [cx + 4, hy + 1]], 1);
    m.poly([[cx - 4, hy + 3], [cx + 4, hy + 3], [cx + 5, hy + 15], [cx + 2, hy + 13], [cx - 1, hy + 17], [cx - 4, hy + 14], [cx - 5, hy + 17]], 1);
    m.line(cx - 4 - b, hy + 16, cx - 6 - b, hy + 23, 1); m.line(cx + 4 + b, hy + 16, cx + 6 + b, hy + 22, 1);
    if (variant === 1) { m.line(cx - 6, hy + 4, cx - 9, hy + 12, 1); m.line(cx + 6, hy + 4, cx + 9, hy + 11, 1); }
    m.line(cx + 7, hy - 1, cx + 9, hy + 24, 1); m.line(cx + 8, hy + 2, cx + 12, hy + 2, 1); // spear
    for (let y = 0; y < 26; y++) for (let x = 0; x < 22; x++) if (m.get(x, y)) {
      const edge = !m.get(x - 1, y) || !m.get(x + 1, y) || !m.get(x, y - 1) || !m.get(x, y + 1);
      if (edge) r.set(x, y, y < 10 ? rp[4] : rp[3]); else if (y < 9) r.set(x, y, rp[2]); else if (hash2(x >> 1, (y + fr) >> 1, 3) < 0.35) r.set(x, y, rp[1]);
    }
    r.set(cx - 1, hy, rp[5]); r.set(cx + 2, hy, rp[5]); r.set(cx, hy + 6, rp[4]); r.set(cx + 9, hy - 2, rp[5]);
    for (let i = 0; i < 3; i++) r.set(cx - 4 + i * 3, hy + 18 + ((fr + i) % 3), rp[3]);
    return r;
  });
}
/** hit spark V2: core + 4 long axis rays + 4 short diagonals + sparks, 4 stages */
export function vHitV2(e: El, size: number, fr: number, seed = 1) {
  return cached(`hit2/${e}/${size}/${fr}/${seed % 3}`, () => {
    const n = size * 2 + 10, r = new Raster(n, n), c = n / 2, rp = ramp(e), t = fr / 3;
    const rays = 8;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * 6.283 + hash2(i, seed, 1) * 0.2, L = size * (i % 2 ? 0.7 : 1.35) * (0.75 + t * 0.5), w0 = size * 0.22 * (1 - t * 0.55);
      for (let d = size * t * 0.4; d < L; d++) { const w = w0 * (1 - d / L); for (let j = -w; j <= w; j += 0.8) r.set(c + Math.cos(a) * d - Math.sin(a) * j, c + Math.sin(a) * d + Math.cos(a) * j, d < L * 0.35 ? rp[5] : d < L * 0.7 ? rp[4] : rp[2]); }
    }
    contactStar(r, c, c, size * (1 - t * 0.35), rp[4], rp[2], rp[1], seed + 5);
    for (let i = 0; i < 8; i++) { const a = hash2(i, seed, 6) * 6.283, d = size * (0.6 + t * 0.8) * (0.6 + hash2(i, 2, seed) * 0.6); r.set(c + Math.cos(a) * d, c + Math.sin(a) * d, i % 2 ? rp[4] : rp[2]); }
    return r;
  });
}
/** dust/impact ground ring: puffs at the contact line, lighter at the top of each puff */
export function vDustRing(rad: number, fr: number, seed = 1) {
  rad = q(rad, 4);
  return cached(`dust/${rad}/${fr}/${seed % 4}`, () => {
    const s = rad * 2 + 14, r = new Raster(s, s), c = s / 2, n = Math.round(rad * 1.1), t = fr / 3;
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, d = rad * (0.4 + t * 0.55), x = c + Math.cos(a) * d, y = c + Math.sin(a) * d * 0.42 - t * 3, sz = 3 + hash2(i, seed, 2) * 4 * (1 - t * 0.35);
      smokePuff(r, x, y, sz, R.ash[1], R.ash[0], R.ash[2], seed + i * 3, t * 0.9, t > 0.4); }
    return r;
  });
}
/** speed lines radiating from a point (used on commit / catastrophe) */
export function vSpeedLines(e: El, rad: number, fr: number, seed = 1) {
  rad = q(rad, 4);
  return cached(`speed/${e}/${rad}/${fr}/${seed % 3}`, () => {
    const s = rad * 2 + 8, r = new Raster(s, s), c = s / 2, rp = ramp(e), n = 18;
    for (let i = 0; i < n; i++) {
      if (hash2(i, seed, 1) < 0.35) continue;
      const a = (i / n) * 6.283 + hash2(i, seed, 2) * 0.2, r0 = rad * (0.35 + hash2(i, seed, 3) * 0.25), L = rad * (0.25 + hash2(i, seed, 4) * 0.45);
      for (let d = r0; d < r0 + L; d += 1.2) { if (hash2(Math.round(d), i, fr) < 0.2) continue; r.set(c + Math.cos(a) * d, c + Math.sin(a) * d * 0.75, d < r0 + L * 0.4 ? rp[4] : rp[2]); }
    }
    return r;
  });
}

// ======================= V5: MATERIAL TELEGRAPHS, FOREGROUND, PIXEL TYPE =======================
/** Element-specific ground material under a circular warning: reads as the attack's substance, not generic UI. */
export function vWarnDecal(e: El, rad: number, prog: number, seed = 1) {
  rad = q(rad, 4); const P = Math.round(prog * 5);
  return cached(`wd/${e}/${rad}/${P}/${seed % 3}`, () => {
    const W = rad * 2 + 12, H = rad + 12, r = new Raster(W, H), cx = W / 2, cy = H / 2, rp = ramp(e), sq = 0.5, t = Math.min(1, prog);
    const at = (a: number, rr: number): [number, number] => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sq];
    if (e === 'fire') {
      for (let i = 0; i < 10; i++) { let a = (i / 10) * 6.283 + hash2(i, seed, 3) * 0.4, d = rad * 0.15, x = cx, y = cy; const L = rad * (0.65 + 0.3 * t);
        while (d < L) { d += 2; a += (hash2(i, d | 0, seed) - 0.5) * 0.5; const nx = cx + Math.cos(a) * d, ny = cy + Math.sin(a) * d * sq; r.line(x, y, nx, ny, R.ash[0]); r.set(nx, ny - 1, P > 2 ? rp[4] : rp[2]); x = nx; y = ny; }
        const [ex, ey] = at(a, rad * 0.9); r.set(ex, ey, rp[3]); }
      for (let i = 0; i < 12; i++) { const a = hash2(i, seed, 6) * 6.283, d = rad * (0.3 + hash2(i, 2, seed) * 0.6); r.set(cx + Math.cos(a) * d, cy + Math.sin(a) * d * sq, i % 2 ? rp[4] : rp[3]); }
    } else if (e === 'force') {
      for (const rr of [0.92, 0.68, 0.42]) { const n = Math.round(rad * 3), gap = Math.floor(hash2(rr * 10, seed, 2) * n * 0.4); for (let i = 0; i < n; i++) { if (i > gap && i < gap + n * 0.18) continue; const [x, y] = at((i / n) * 6.283, rad * rr); r.set(x, y, rr > 0.8 ? rp[3] : rp[2]); } }
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + 0.2; for (let k = 0; k < 4; k++) { const [x, y] = at(a, rad * (0.98 - k * 0.05)); r.set(x, y, rp[4 - Math.min(2, k)]); } }
      for (let i = 0; i < 6; i++) { const a = hash2(i, seed, 8) * 6.283, d = rad * (0.4 + hash2(i, 3, seed) * 0.4), [x, y] = at(a, d); r.set(x, y, R.rock[4]); r.set(x + 1, y, R.rock[2]); }
    } else if (e === 'time') {
      const n = Math.round(rad * 4); for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; const [x, y] = at(a, rad * 0.95); if (i % 3 === 0) { r.set(x, y, R.bronze[4]); r.set(x, y + 1, R.bronze[2]); } else r.set(x, y, rp[1]); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283 - 1.57; for (let k = 0; k < (i % 3) + 1; k++) { const [x, y] = at(a, rad * (0.82 + k * 0.03)); r.set(x, y, rp[3]); } }
      const hA = prog * 6.283 - 1.57, mA = ((prog * 4) % 1) * 6.283 - 1.57;
      for (let d = 2; d < rad * 0.6; d++) { const [x, y] = at(hA, d); r.set(x, y, rp[4]); }
      for (let d = 2; d < rad * 0.82; d++) { const [x, y] = at(mA, d); r.set(x, y, rp[3]); }
      for (let i = 0; i < 5; i++) { const a = hash2(i, seed, 4) * 6.283, [x, y] = at(a, rad * 0.45); for (let k = 0; k < 4; k++) r.set(x + (k % 2), y + (k > 1 ? 1 : 0), R.bronze[3]); }
    } else if (e === 'space') {
      for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.283, wob = 1 + (hash2(i, seed, 5) - 0.5) * 0.22, [x, y] = at(a, rad * wob); r.set(x, y, i % 3 === 0 ? rp[4] : rp[2]); r.set(x + 1, y, rp[1]); }
      const stars: [number, number][] = []; for (let i = 0; i < 7; i++) stars.push(at(hash2(i, seed, 7) * 6.283, rad * (0.3 + hash2(i, 1, seed) * 0.5)));
      for (let i = 0; i < stars.length - 1; i++) r.line(stars[i][0], stars[i][1], stars[i + 1][0], stars[i + 1][1], rp[1]);
      for (const [x, y] of stars) { r.set(x, y, R.star[0]); r.set(x + 1, y, rp[4]); r.set(x, y, R.k[1]); }
    } else if (e === 'mind') {
      const ew = rad * 0.9; for (let x = -ew; x <= ew; x++) { const yy = Math.sqrt(Math.max(0, 1 - (x * x) / (ew * ew))) * rad * 0.3; r.set(cx + x, cy - yy, rp[2]); r.set(cx + x, cy + yy, rp[2]); if ((x + ew) % 4 === 0) { r.set(cx + x, cy - yy - 1, rp[3]); r.set(cx + x, cy + yy + 1, rp[1]); } }
      for (let d = 3; d < rad * 0.65; d++) { const [x, y] = at(0, d); r.set(x, y, rp[2]); }
      for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.283; if (i % 2 === 0) { const [x, y] = at(a, rad * 0.55); r.set(x, y, rp[3]); } }
      const ir = rad * 0.22; for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283 + prog; r.set(cx + Math.cos(a) * ir, cy + Math.sin(a) * ir * 0.7, i % 2 ? rp[4] : rp[2]); }
      r.disc(cx, cy, Math.max(1, rad * 0.06), rp[3]);
    } else {
      const n = Math.round(rad * 2.6); for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, [x, y] = at(a, rad * 0.88); r.set(x, y, i % 2 ? R.fgold[3] : R.fgold[1]); }
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + 0.3, [x, y] = at(a, rad * 0.82); r.set(x, y, i % 2 ? rp[3] : rp[2]); r.set(x + 1, y, rp[2]); }
      for (let i = 0; i < 4; i++) { const a = -prog * 1.2 + (i / 4) * 6.283; const [x0, y0] = at(a, rad * 0.2), [x1, y1] = at(a, rad * 0.4); for (let k = 0; k < 4; k++) r.set(x0 + (x1 - x0) * k / 4, y0 + (y1 - y0) * k / 4, k % 2 ? R.fgold[2] : R.fgold[4]); }
      r.disc(cx, cy, Math.max(1, rad * 0.08), rp[3]);
    }
    return r;
  });
}
/** small material mark stamped along non-circular warning outlines */
export function vMark(e: El, seed = 1) {
  return cached(`mk2/${e}/${seed % 3}`, () => {
    const r = new Raster(7, 7), c = 3, rp = ramp(e);
    if (e === 'fire') { r.set(c, 1, rp[4]); r.set(c, 2, rp[3]); r.set(c - 1, 3, rp[2]); r.set(c + 1, 3, rp[2]); r.set(c, 4, R.ash[1]); }
    else if (e === 'force') { r.line(1, 5, 3, 1, rp[3]); r.line(5, 5, 3, 1, rp[2]); r.set(3, 3, rp[4]); }
    else if (e === 'time') { r.disc(c, c, 1.6, R.bronze[3]); r.set(c, c, R.time[4]); r.line(c, c, c, c - 2, R.bronze[4]); r.line(c, c, c + 2, c, R.bronze[2]); }
    else if (e === 'space') { r.set(c, 0, R.star[0]); r.set(c, 1, rp[4]); r.set(c - 1, c, rp[3]); r.set(c + 1, c, rp[3]); r.set(c, c + 1, rp[2]); }
    else if (e === 'mind') { r.oval(c, c, 2.4, 1.4, rp[3]); r.set(c, c, R.pupil[0]); }
    else { r.set(c, 1, R.fgold[4]); r.set(c - 1, 2, R.fgold[3]); r.set(c + 1, 2, R.fgold[3]); r.set(c, 3, R.fgold[2]); r.set(c, 4, rp[3]); r.set(c, 5, rp[2]); }
    return r;
  });
}
/** foreground depth motes (drawn above everything, scaled 2x by the renderer) */
export function vForeground(e: El, s: number, fr: number) {
  return cached(`fg/${e}/${s}/${fr % 4}`, () => {
    const n = s * 2 + 4, r = new Raster(n, n), c = n / 2, rp = ramp(e);
    if (e === 'fire' || e === 'soul') { r.disc(c, c, s, rp[2]); r.disc(c, c + 1, s * 0.7, rp[3]); r.disc(c, c + 1, s * 0.35, rp[4]); }
    else if (e === 'force' || e === 'space') { r.set(c, c - s, rp[4]); r.set(c, c + s, rp[2]); r.line(c - s, c, c + s, c, rp[3]); r.set(c, c, R.k[1]); }
    else if (e === 'time') { r.disc(c, c, s * 0.8, R.bronze[3]); r.set(c, c, R.time[4]); for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.283 + fr; r.set(c + Math.cos(a) * (s + 1), c + Math.sin(a) * (s + 1), R.bronze[4]); } }
    else { r.oval(c, c, s * 0.8, s * 0.5, R.eyew[1]); r.disc(c, c, s * 0.35, R.pupil[0]); r.set(c - 1, c - 1, R.mind[4]); }
    return r;
  });
}
// 3x5 pixel type
const F3: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'], G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['#.#', '###', '###', '###', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '###', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'], '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'], '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '###'], ' ': ['...', '...', '...', '...', '...'], '-': ['...', '...', '###', '...', '...'],
  '.': ['...', '...', '...', '...', '.#.'], "'": ['.#.', '.#.', '...', '...', '...'], '!': ['.#.', '.#.', '.#.', '...', '.#.'], ':': ['...', '.#.', '...', '.#.', '...'],
};
export function vText(str: string, col: number, scale = 1, outline: number | null = 0) {
  const key = `txt/${str}/${col}/${scale}/${outline}`;
  return cached(key, () => {
    const s = str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const n = Math.max(1, s.length), r = new Raster(n * 4 * scale + 2, 5 * scale + 2);
    [...s].forEach((ch, i) => { const g = F3[ch] || F3[' ']; g.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') for (let j = 0; j < scale; j++) for (let k = 0; k < scale; k++) r.set(1 + i * 4 * scale + x * scale + k, 1 + y * scale + j, col); })); });
    if (outline !== null) { const src = r.clone(); for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (!src.get(x, y) && (src.get(x - 1, y) || src.get(x + 1, y) || src.get(x, y - 1) || src.get(x, y + 1))) r.set(x, y, outline); }
    return r;
  });
}

// ======================= V6: REFERENCE-DRIVEN SHAPES (observed in CC0 sheets) =======================
/** Slash V3: frame 0 is ONE solid flat crescent (white-hot), later frames split into parallel strands that retract. */
export function vSlashV3(e: El, rad: number, a0: number, a1: number, wid: number, fr: number) {
  rad = q(rad, 4); const A0 = qa(a0, 32), A1 = qa(a1, 32); fr = Math.max(0, Math.min(4, fr));
  return cached(`slash3/${e}/${rad}/${A0}/${A1}/${wid}/${fr}`, () => {
    const s2 = rad * 2 + 12, r = new Raster(s2, s2), c = s2 / 2, rp = ramp(e);
    let s0 = (A0 / 32) * 6.283, span = (A1 / 32) * 6.283 - s0; while (span > Math.PI) span -= 6.283; while (span < -Math.PI) span += 6.283;
    const steps = Math.max(20, Math.round(Math.abs(span) * rad * 2));
    const arc = (k: number, thick: number, col: (u: number, th: number) => number, keepFrom: number, taperAt: 'head' | 'tail') => {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // retract from the tail end, so the surviving arc is always a real blade segment
        if (taperAt === 'tail' && t < keepFrom) continue;
        const a = s0 + span * t;
        const env = Math.pow(Math.sin(Math.PI * Math.min(1, (t - keepFrom) / (1 - keepFrom + 1e-6) * 0.96 + 0.04)), 0.45);
        const th = Math.max(1, thick * env);
        for (let j = 0; j < th; j += 0.7) r.set(c + Math.cos(a) * (rad - k - j), c + Math.sin(a) * (rad - k - j), col(t, j / th));
      }
    };
    if (fr === 0) {
      // ONE solid flat crescent: bright leading edge, hot body, cold underside, tapered at the tail
      arc(0, wid * 1.3, (_u, th) => (th < 0.12 ? R.k[1] : th < 0.5 ? rp[5] : th < 0.82 ? rp[4] : rp[3]), 0, 'tail');
      for (let i = 0; i < 8; i++) { const a = s0 + span * (0.12 + i * 0.1); r.set(c + Math.cos(a) * (rad + 2), c + Math.sin(a) * (rad + 2), rp[4]); }
    } else {
      // separate parallel strands at distinct radius offsets with a real gap between them
      const strands = fr === 1 ? 2 : fr === 2 ? 3 : 4, gap = Math.max(2, wid * 1.25 / strands);
      const keepFrom = (fr - 1) * 0.17;
      for (let si = 0; si < strands; si++) {
        const k = si * gap, bright = si === 0;
        arc(k, 1 + (bright ? 1 : 0), () => (bright ? rp[5] : fr >= 3 ? rp[3] : rp[4]), keepFrom + si * 0.04, 'tail');
      }
    }
    return r;
  });
}
/** Blast: value alternation (light → dark flip → big light) → fire core crowded by chunky blocks → hollow block ring → scatter. 8 frames. */

/**
 * Authored smoke puff: 2–4 overlapping lobes with a jagged polygon contour (never a rectangle),
 * a lit top edge, a dark underside and interior holes that open up as the puff ages. Each lobe
 * carries its own seed so the cluster silhouette is stable frame-to-frame and reads as one mass.
 */
function smokePuff(r: Raster, x: number, y: number, rad: number, hot: number, dark: number, lit: number, seed: number, age: number, holes = true) {
  const lobes = 3;
  for (let l = 0; l < lobes; l++) {
    const ox = x + (hash2(l, seed, 1) - 0.5) * rad * 1.1, oy = y + (hash2(l, seed, 2) - 0.5) * rad * 0.7 - age * rad * 0.1;
    const lr = rad * (0.62 + hash2(l, seed, 3) * 0.42) * (1 - age * 0.28);
    if (lr < 1.2) continue;
    const n = 9, pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + hash2(l * 7 + i, seed, 4) * 0.5;
      const rr = lr * (0.72 + hash2(l * 3 + i, seed, 5) * 0.5);
      pts.push([ox + Math.cos(a) * rr, oy + Math.sin(a) * rr * 0.86]);
    }
    const m = new Raster(r.w, r.h); m.poly(pts, 1);
    for (let yy = Math.max(0, Math.floor(oy - lr)); yy <= Math.min(r.h - 1, Math.ceil(oy + lr)); yy++) for (let xx = Math.max(0, Math.floor(ox - lr)); xx <= Math.min(r.w - 1, Math.ceil(ox + lr)); xx++) {
      if (!m.get(xx, yy)) continue;
      // interior holes grow with age and stay clustered, never salt-and-pepper
      if (age > 0.25 && hash2((xx - ox) >> 1, (yy - oy) >> 1, seed + l) < age * 0.42) continue;
      const top = !m.get(xx, yy - 1) && yy < oy, bot = !m.get(xx, yy + 1) && yy > oy;
      r.set(xx, yy, top ? lit : bot ? hot : (hash2(xx, yy, seed) < 0.5 ? hot : dark));
    }
  }
}
/** Contact star: irregular 7–9 lobe burst with a hard white core and broken fringe. Not a bullseye. */
function contactStar(r: Raster, x: number, y: number, rad: number, hot: number, mid: number, cold: number, seed: number) {
  const n = 7 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + hash2(i, seed, 1) * 0.4, L = rad * (0.55 + hash2(i, seed, 2) * 0.65), w0 = rad * (0.12 + hash2(i, seed, 7) * 0.1);
    for (let d = rad * 0.12; d < L; d += 0.75) {
      const u = d / L, w = Math.max(0.4, w0 * (1 - u) * (1 - u * 0.4)), col = u < 0.3 ? R.k[1] : u < 0.55 ? hot : u < 0.82 ? mid : cold;
      for (let j = -w; j <= w; j += 0.7) r.set(x + Math.cos(a) * d - Math.sin(a) * j, y + Math.sin(a) * d + Math.cos(a) * j, col);
    }
    if (hash2(i, seed, 6) < 0.5) r.set(x + Math.cos(a) * (L + 1), y + Math.sin(a) * (L + 1), mid);
  }
  const lobe = (rr: number, col: number, dx: number, dy: number) => { const m = new Raster(r.w, r.h); const pts: [number, number][] = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.283, q2 = rr * (0.75 + hash2(i, seed, 9) * 0.4); pts.push([x + dx + Math.cos(a) * q2, y + dy + Math.sin(a) * q2]); } m.poly(pts, 1); for (let yy = 0; yy < r.h; yy++) for (let xx = 0; xx < r.w; xx++) if (m.get(xx, yy)) r.set(xx, yy, col); };
  lobe(rad * 0.36, hot, rad * 0.06, rad * 0.05); lobe(rad * 0.2, R.k[1], 0, 0);
}

export function vBlast(e: El, rad: number, fr: number, seed = 1) {
  rad = q(rad, 4); fr = Math.max(0, Math.min(7, fr));
  return cached(`blast/${e}/${rad}/${fr}/${seed % 4}`, () => {
    const s = rad * 2 + 16, r = new Raster(s, s), c = s / 2, rp = ramp(e);
    const dark = e === 'space' ? [R.void[0], R.space[0], R.space[1]] : e === 'soul' ? [R.jet[1], R.soul[0], R.soul[1]] : e === 'mind' ? [R.regal[1], R.mind[0], R.mind[1]] : e === 'time' ? [R.robe[1], R.time[0], R.robe[3]] : e === 'force' ? [R.rock[1], R.force[0], R.plate[2]] : [R.obs[1], R.lava[0], R.lava[1]];
    if (fr === 0) { r.disc(c, c, rad * 0.32, rp[5]); r.disc(c, c, rad * 0.14, R.k[1]); return r; }
    if (fr === 1) { r.disc(c, c, rad * 0.42, rp[1]); r.disc(c, c, rad * 0.3, rp[2]); return r; } // value flip frame
    if (fr === 2) { r.disc(c, c, rad * 0.62, rp[5]); r.disc(c, c, rad * 0.4, R.k[1]); for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.2; r.line(c + Math.cos(a) * rad * 0.66, c + Math.sin(a) * rad * 0.66, c + Math.cos(a) * rad * 0.95, c + Math.sin(a) * rad * 0.95, rp[5]); } return r; }
    const t = (fr - 3) / 4; // 0..1
    if (fr === 3) { r.disc(c, c, rad * 0.62, rp[3]); r.disc(c, c, rad * 0.42, rp[4]); r.disc(c - rad * 0.08, c - rad * 0.1, rad * 0.2, rp[5]); }
    else if (fr === 4) for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.283 + hash2(k, seed, 3); cluster(r, c + Math.cos(a) * rad * 0.45, c + Math.sin(a) * rad * 0.4, rad * 0.28, rp[3], rp[1], rp[4], seed + k, 0.55, 3); }
    // chunky rectangular smoke blocks: crowd → hollow from the centre → scatter & shrink
    const n = 26, ringR = rad * (0.32 + t * 0.62), bs = Math.max(2, Math.round(rad * 0.16 * (1 - t * 0.55)));
    for (let i = 0; i < n; i++) {
      if (fr >= 5 && hash2(i, seed, 13) < t * 0.6) continue;
      const a = (i / n) * 6.283 + hash2(i, seed, 1) * 0.4, d = ringR * (0.6 + hash2(i, seed, 2) * (0.5 + t * 0.3)) * (fr === 3 ? 0.7 : 1);
      const bx = Math.round(c + Math.cos(a) * d), by = Math.round(c + Math.sin(a) * d * 0.9 - t * rad * 0.15), w0 = bs + Math.round(hash2(i, 3, seed) * bs), h0 = Math.max(2, Math.round(bs * (0.6 + hash2(i, 4, seed) * 0.5)));
      const fresh = fr <= 4;
      // authored puff cluster instead of a filled rectangle; hot rim only on the freshly born side
      smokePuff(r, bx, by, Math.max(3, (w0 + h0) / 2), fresh ? dark[1] : dark[2], dark[0], fresh ? rp[3] : dark[1], seed + i, t, fr >= 5);
    }
    if (fr === 3 || fr === 4) for (let i = 0; i < 6; i++) { const a = hash2(i, seed, 9) * 6.283; r.set(c + Math.cos(a) * rad * 0.7, c + Math.sin(a) * rad * 0.7, rp[4]); }
    return r;
  });
}
/** Flat ground ellipse ring (top-down perspective), layered dust bands; fr 0..3 expands & thins. */
export function vGroundRing(e: El, rad: number, fr: number) {
  rad = q(rad, 4); fr = Math.max(0, Math.min(3, fr));
  return cached(`gring/${e}/${rad}/${fr}`, () => {
    const s2 = rad * 2 + 16, r = new Raster(s2, Math.round(rad * 0.95 + 16)), rp = ramp(e);
    const cx = s2 / 2, cy = r.h / 2, rr = rad * (0.55 + fr * 0.16), ry = rr * 0.42;
    const ash = e === 'fire' ? R.ash : e === 'soul' ? R.jet : e === 'force' ? R.rock : e === 'space' ? R.void : R.robe;
    // inner scoured field: erodes from the outside in, so it never reads as a filled disc
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rr); x <= Math.ceil(cx + rr); x++) {
      const d = Math.hypot((x - cx) / rr, (y - cy) / ry); if (d > 1) continue;
      if (hash2(x >> 1, y >> 1, seed2(fr)) < d * 0.55 + fr * 0.12) continue;
      r.set(x, y, d > 0.86 ? rp[3] : d > 0.62 ? ash[1] : ash[0]);
    }
    // near lip: a broken bright rim (hot on the side facing the camera), dark far rim
    const n = Math.round(rr * 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283, near = Math.sin(a) > 0;
      if (!near && hash2(i >> 2, fr, 3) < 0.3) continue;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * ry;
      r.set(x, y, near ? (fr === 0 ? R.k[1] : rp[4]) : ash[2]);
      if (near && fr < 2) r.set(x, y + 1, ash[1]);
      if (near && hash2(i, fr, 5) < 0.14) r.set(x + Math.cos(a) * 2, y + Math.sin(a) * 2, rp[3]);
    }
    // dust lobes lifting off the rim, tallest at the sides, gone by fr 3
    if (fr < 3) for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + hash2(i, 4, 2) * 0.4; cluster(r, cx + Math.cos(a) * rr * 0.94, cy + Math.sin(a) * ry * 0.94 - fr * 3, rad * (0.15 - fr * 0.02), ash[1], ash[0], ash[2], 7 + i * 3, 0.2 + fr * 0.28, 2); }
    return r;
  });
}
function seed2(fr: number) { return 11 + fr * 17; }
/** Mushroom column for catastrophic impacts: rising stem + layered banded cap. fr 0..5. */
export function vMushroom(e: El, size: number, fr: number, seed = 1) {
  size = q(size, 4); fr = Math.max(0, Math.min(5, fr));
  return cached(`mush/${e}/${size}/${fr}/${seed % 3}`, () => {
    const W = size * 2 + 18, H = size * 3 + 16, r = new Raster(W, H), cx = W / 2, base = H - 6, rp = ramp(e), t = fr / 5;
    const dark = e === 'fire' ? R.lava[0] : e === 'force' ? R.plate[1] : e === 'soul' ? R.soul[0] : rp[0];
    // THICK turbulent stem: overlapping clusters wider than before, narrowing upward
    const stemTop = base - size * (0.85 + t * 1.25);
    const stemR = size * 0.3;
    for (let y = base; y > stemTop; y -= Math.max(2, stemR * 0.7)) {
      const u = (base - y) / Math.max(1, base - stemTop);
      const wob = Math.sin(y * 0.45 + fr * 1.3 + seed) * stemR * 0.28;
      const rr = stemR * (1 - u * 0.45);
      // three lobes across the stem so it reads as a column with volume, not a line
      for (let k = -1; k <= 1; k++) cluster(r, cx + wob + k * rr * 0.55, y, rr * 0.62, t < 0.4 ? rp[3] : rp[2], dark, t < 0.25 ? rp[4] : rp[3], seed + (base - y) + k * 3, u * 0.45, 2);
    }
    // CAP: a tall round billowing mass, interior filled, not a horizontal bar
    const capY = stemTop - size * 0.55, capRX = size * (0.72 + t * 0.16), capRY = size * (0.62 + t * 0.2);
    // fill interior on a coarse grid so the cap has real volume
    for (let gy = -capRY; gy <= capRY; gy += capRY * 0.42) for (let gx = -capRX; gx <= capRX; gx += capRX * 0.42) {
      if ((gx * gx) / (capRX * capRX) + (gy * gy) / (capRY * capRY) > 1) continue;
      const i = Math.round(gx * 7 + gy * 13), u = (gy + capRY) / (2 * capRY);
      cluster(r, cx + gx, capY + gy, size * 0.3, u > 0.66 ? rp[2] : rp[3], dark, u < 0.34 ? R.k[1] : rp[4], seed + i, t * 0.7 + (1 - u) * 0.15, 3);
    }
    // rim billows curling under the widest line
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.05 + (i / 8) * 0.9); cluster(r, cx + Math.cos(a) * capRX, capY + Math.abs(Math.sin(a)) * capRY * 0.86, size * 0.26, rp[2], dark, rp[3], seed + 40 + i, t * 0.85 + 0.1, 3); }
    // hot inner column visible through the cap
    cluster(r, cx, capY + capRY * 0.25, size * 0.24, rp[5], rp[3], R.k[1], seed + 99, t * 0.3, 3);
    // embers flung from the cap rim
    for (let i = 0; i < 12; i++) { const a = hash2(i, seed, 4) * 6.283, d = capRX * (1.05 + t * 0.5); r.set(cx + Math.cos(a) * d, capY + Math.sin(a) * capRY * 0.85 - t * 9, i % 3 ? rp[4] : R.k[1]); }
    return r;
  });
}
/** Front-facing foreshortened fist: knuckles toward the camera (Typhon down-facing punches). */
export function vFistFront(size: number, glow: number) {
  size = q(size, 2); const G = Math.round(glow * 2);
  return cached(`ffront/${size}/${G}`, () => {
    const s2 = size * 2 + 14, r = new Raster(s2, s2), c = s2 / 2, P = R.plate;
    // rim of compression around the fist
    for (let i = 0; i < 26; i++) { if (i % 5 === 3) continue; const a = (i / 26) * 6.283; r.set(c + Math.cos(a) * (size + 4), c + Math.sin(a) * (size + 4) * 0.94, G ? R.force[3 + Math.min(2, G)] : R.force[2]); }
    // wrist: a short tapering block below the mass
    lobe(r, c, c + size * 0.72, size * 0.5, size * 0.34, P[1], 31, 0.2, 7);
    lobe(r, c, c + size * 0.62, size * 0.44, size * 0.26, P[2], 32, 0.2, 7);
    // palm: a wide irregular mass, not a ball
    jagMass(r, c, c + size * 0.1, size * 0.8, P[2], P[0], 4, 0.22);
    lobe(r, c - size * 0.15, c - size * 0.1, size * 0.62, size * 0.5, P[3], 9, 0.3, 11);
    // FOUR knuckles as separate finger masses with real gaps between them
    for (let k = 0; k < 4; k++) {
      const kx = c - size * 0.62 + k * size * 0.41, ky = c - size * 0.46 - (k === 1 || k === 2 ? size * 0.08 : 0);
      lobe(r, kx, ky, size * 0.21, size * 0.24, P[3], k + 2, 0.28, 9);
      r.line(kx - size * 0.16, ky - size * 0.2, kx + size * 0.16, ky - size * 0.2, P[4]);   // knuckle highlight
      r.line(kx - size * 0.14, ky + size * 0.24, kx + size * 0.14, ky + size * 0.24, P[1]); // finger crease
      r.set(kx + size * 0.12, ky - size * 0.04, R.claw[2]);
    }
    // thumb crossing the near side of the fist
    lobe(r, c - size * 0.5, c + size * 0.2, size * 0.3, size * 0.22, P[3], 15, 0.3, 9);
    r.line(c - size * 0.72, c + size * 0.28, c - size * 0.26, c + size * 0.12, P[1]);
    return r;
  });
}

// ======================= V8: SEMANTIC FIELDS =======================
// A ring is never decoration. Each ring states the mechanic inside it:
//   aion    → a working clock: hand speed is proportional to the slow strength
//   typhon  → pressure: chevrons travelling INWARD at the pull speed
//   atlas   → a rift boundary: depth layers + orbiting shards, "space is cut here"
//   argus   → a gaze lock: iris ring that contracts as the lock completes
//   anubis  → a chain boundary: links + rising souls, "souls are bound here"
//   surtur  → a burn boundary: cooling crust with ember tongues facing inward
export type FieldKind = 'aion' | 'typhon' | 'atlas' | 'argus' | 'anubis' | 'surtur';
export function vFieldRing(kind: FieldKind, radius: number, t: number, strength = 1, prog = 1) {
  const rad = Math.max(12, q(radius, 4)), S = Math.round(prog * 4);
  const big = rad > 240; // arena-scale fields draw a rim only; inner detail at this size becomes soap bubbles
  return cached(`field/${kind}/${rad}/${(t * 12 | 0) % 24}/${Math.round(strength * 4)}/${S}`, () => {
    const W = rad * 2 + 30, H = Math.round(rad * 1.34) + 30, r = new Raster(W, H), cx = W / 2, cy = H / 2, sq = 0.48;
    const P = (a: number, rr: number): [number, number] => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sq];
    const arc = (rr: number, a0: number, a1: number, th: number, colFn: (u: number, k: number) => number) => {
      const steps = Math.max(8, Math.round(Math.abs(a1 - a0) * rr));
      for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * (i / steps); for (let k = 0; k < th; k++) r.set(...P(a, rr - k), colFn(i / steps, k)); }
    };
    const ditherBand = (r0: number, r1: number, col: number, dens: number, seed: number) => {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = (x - cx) / 1, dy = (y - cy) / sq, d = Math.hypot(dx, dy);
        if (d < r0 || d > r1) continue;
        if (hash2(x >> 1, y >> 1, seed) > dens) continue;
        if (!r.get(x, y)) r.set(x, y, col);
      }
    };
    if (kind === 'aion') {
      const rp = R.time, br = R.bronze;
      // no interior dither: a 500px field filled with 2x2 noise read as screen-wide static.
      ditherBand(rad - 10, rad - 2, rp[1], 0.28, 4);
      arc(rad, 0, 6.283, 9, (u, k) => (k === 0 ? rp[4] : k < 2 ? br[4] : k < 4 ? br[3] : k < 7 ? br[1] : br[0])); // bronze bezel (no white edge)
      for (let i = 0; i < 60; i++) {                                               // minute ticks
        const a = (i / 60) * 6.283 - 1.5708, len = i % 5 === 0 ? (rad > 60 ? 7 : 4) : 2.5, [x, y] = P(a, rad - 3);
        const [x2, y2] = P(a, rad - 3 - len); r.line(x, y, x2, y2, len > 3 ? br[4] : br[2]);
      }
      for (let i = 0; i < 12; i++) { const [x, y] = P((i / 12) * 6.283, rad + 2); const c2 = i % 3 === 0 ? rp[4] : br[3]; r.set(x, y, c2); r.set(x + 1, y, c2); r.set(x, y - 1, br[4]); } // hour studs outside
      if (!big) arc(rad - 9, 0, 6.283, 1, () => rp[1]);                                      // inner hairline
      const fast = t * (1.2 + 5.5 * strength), slow = t * (0.35 + 0.6 * strength);  // ← speed = slow strength
      for (const [ang2, len, col] of [[fast, rad * 0.62, rp[5]], [slow, rad * 0.42, br[4]]] as [number, number, number][]) {
        const [ex, ey] = P(ang2 - 1.5708, len), [sx2, sy2] = P(ang2 - 1.5708, -rad * 0.1);
        r.line(sx2, sy2, ex, ey, col); r.line(sx2 + 1, sy2, ex + 1, ey, col);
        for (let k = 1; k < len; k += 3) { const u = k / len; r.set(sx2 + (ex - sx2) * u, sy2 + (ey - sy2) * u, col); }
      }
      if (!big) for (let g = 0; g < 3; g++) { const gr = rad * (0.26 + g * 0.08), gearA = t * (g % 2 ? -1.6 : 2.2) * strength; // gears turn with the slow
        for (let i = 0; i < 10; i++) { const a = gearA + (i / 10) * 6.283, [x, y] = P(a, gr); r.set(x, y, br[4]); r.set(x + Math.cos(a), y + Math.sin(a) * sq, br[2]); } }
      const [px, py] = P(0, 0); r.disc(px, py, Math.max(1.5, rad * 0.035), br[4]); r.set(px, py, rp[5]);
      // frozen frames: little squares at the rim that are *not* moving while the hands are
      for (let i = 0; i < 6; i++) { const [x, y] = P((i / 6) * 6.283 + slow * 0.2, rad + 7); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) r.set(x + dx, y + dy, rp[3]); r.set(x, y, rp[5]); }
    } else if (kind === 'typhon') {
      const rp = R.force, dk = R.rock;
      arc(rad, 0, 6.283, 9, (u, k) => (k === 0 ? rp[3] : k < 2 ? rp[2] : k < 4 ? dk[3] : k < 7 ? dk[1] : dk[0]));
      for (let i = 0; i < 20; i++) { const a = (i / 20) * 6.283 + t * 0.15, [x, y] = P(a, rad + 2); const c2 = i % 2 ? rp[3] : dk[3]; r.set(x, y, c2); r.set(x + 1, y, c2); r.set(x, y + 1, dk[2]); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283, ph = (t * 1.6 + i / 12) % 1, d = rad * (0.95 - ph * 0.7), [x, y] = P(a, d); // inward chevrons
        r.set(x, y, rp[4]); r.set(x - Math.cos(a) * 2, y - Math.sin(a) * sq * 2, rp[3]); r.set(x - Math.cos(a) * 4, y - Math.sin(a) * sq * 4, rp[2]); r.set(x, y - 1, R.k[1]); }
      for (let i = 0; i < 7; i++) { const a = hash2(i, 5, 3) * 6.283 + t * 0.6, d = rad * (0.4 + hash2(i, 6, 3) * 0.5), [x, y] = P(a, d); jagMass(r, x, y, 2 + (i % 3), dk[2], dk[1], i + 3, 0.4); }
    } else if (kind === 'atlas') {
      const rp = R.space, st = R.astone;
      // heavy torn rim: dark outer mass, stone mid-band, white-hot inner edge, so a rift ring reads
      // as cut space rather than a pale bubble outline
      for (let i = 0; i < 44; i++) {
        const a0 = (i / 44) * 6.283, [x, y] = P(a0, rad), gap = hash2(i >> 1, 3, 4) < 0.16;
        if (gap) continue;
        for (let k = 0; k < 5; k++) { const [xa, ya] = P(a0, rad + k - 1); r.set(xa, ya, k === 0 ? R.k[1] : k === 1 ? rp[5] : k === 2 ? rp[3] : k === 3 ? st[3] : R.void[0]); }
        void x; void y;
      }
      for (let i = 0; i < 6; i++) { const a0 = (i / 6) * 6.283 + t * 0.2, [x0, y0] = P(a0, rad * 0.55), [x1, y1] = P(a0, rad - 3); r.line(x0, y0, x1, y1, rp[1]); }
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + t * 0.3, [x, y] = P(a, rad * 0.62); star4(r, Math.round(x), Math.round(y), 2, R.star[0], rp[3]); }
      for (let i = 0; i < 5; i++) { const a = -t * 0.5 + i * 1.256, [x0, y0] = P(a, rad + 5), [x1, y1] = P(a + 0.42, rad + 5); for (let k2 = 0; k2 <= 3; k2++) r.line(x0 + (x1 - x0) * k2 / 3, y0 + (y1 - y0) * k2 / 3, x0 + (x1 - x0) * (k2 + 1) / 3, y0 + (y1 - y0) * (k2 + 1) / 3, k2 % 2 ? rp[5] : rp[3]); }
    } else if (kind === 'argus') {
      const rp = R.mind, gd = R.gold;
      const tight = 1 - 0.28 * Math.min(1, prog);
      arc(rad * tight, 0, 6.283, 8, (u, k) => (k === 0 ? gd[3] : k < 2 ? gd[2] : k < 4 ? gd[1] : gd[0]));
      for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283; if (i % 2) continue; const [x, y] = P(a, rad * tight - 4), [x2, y2] = P(a, rad * tight - 8); r.line(x, y, x2, y2, gd[3]); }
      // (gears draw above, only for non-arena-scale fields)
      // no filled eye at the centre: the centre is where the boss stands, and a pale blob there read
      // as a misplaced UI plate. The aperture is implied by the contracting iris rings instead.
      for (let i = 0; i < 3; i++) arc(rad * tight - 16, 0, 6.283, 1, () => gd[1]);
    } else if (kind === 'anubis') {
      const rp = R.soul, gd = R.fgold;
      const step = (2 * Math.PI * rad) / 18, links = 18;
      for (let i = 0; i < links; i++) { const a = (i / links) * 6.283 + t * 0.12, [x, y] = P(a, rad);
        if (i % 2 === 0) { r.oval(x, y, 4, 3, gd[2]); r.oval(x, y, 2, 1.5, R.k[0]); } else { const [dx, dy] = P(a + 0.13, rad); for (let k2 = 0; k2 <= 3; k2++) r.line(x + (dx - x) * k2 / 3, y + (dy - y) * k2 / 3, x + (dx - x) * (k2 + 1) / 3, y + (dy - y) * (k2 + 1) / 3, k2 % 2 ? gd[4] : gd[2]); }
        r.set(x, y - 1, rp[4]); }
      for (let i = 0; i < 3; i++) { const a = -t * 0.4 + i * 2.1, [x, y] = P(a, rad * 0.78); for (let k = 0; k < 4; k++) { r.set(x + Math.sin(k * 1.4 + i) * 2, y - k, k < 2 ? rp[4] : rp[2]); } }
      arc(rad - 6, 0, 6.283, 1, (u) => (Math.sin(u * 40) > 0 ? rp[2] : 0));
    } else {
      const rp = R.lava, dk = R.obs;
      arc(rad, 0, 6.283, 10, (u, k) => (k === 0 ? rp[2] : k < 2 ? rp[1] : k < 4 ? dk[2] : k < 7 ? dk[1] : dk[0]));
      // jagged crust teeth of irregular height (evenly spaced vertical tongues read as candles)
      for (let i = 0; i < 42; i++) { const a = (i / 42) * 6.283, [x, y] = P(a, rad - 2), hgt = 1 + Math.floor(hash2(i, 3, 8) * 4); for (let k = 1; k <= hgt; k++) r.set(x + (hash2(i, k, 4) > 0.6 ? 1 : 0), y - k, k === hgt ? rp[2] : rp[1]); }
      ditherBand(rad - 12, rad - 2, rp[1], 0.3, 6);
    }
    return r;
  });
}
