import { DC, R } from './kit';
import { rig, RigCfg, along, perp, weaponLen } from './rig';
import type { Pt } from './raster';
import { hash2 } from './raster';

// BLUE / ATLAS — celestial titan, torn starfield mantle, constellation armour, twin astral anchors, rift-ring forearms.
export function drawAtlas(dc: DC) {
  const U = dc.ult, p = dc.p, f = dc.f;
  const c: RigCfg = U
    ? { leg: 40, torso: 48, neck: 9, hipW: 15, shW: 36, arm: 42, stance: 17, bend: 6 }
    : { leg: 20, torso: 24, neck: 5, hipW: 7, shW: 17, arm: 20, stance: 8 };
  const r = rig(dc, c), k = U ? 2 : 1, G = p.glow ?? 0.3;
  const [cx, cy] = r.chest, [hx, hy] = r.hip;
  dc.order = ['back', 'body', 'weapon', 'emit'];
  const sc = (b: number) => R.space[Math.max(0, Math.min(5, Math.round(b + G * 2)))];

  const mantle = (layer: 'back' | 'body') => {
    dc.L(layer);
    // Two separate torn panels leave a clear central gap: the titan's torso/legs stay readable behind the cloak.
    const w = c.shW + 8, bot = dc.oy - (U ? 14 : 7), gapW = U ? 15 : 8;
    const panel = (sgn: number) => {
      const inner = cx + sgn * gapW * 0.7, outer = cx + sgn * (dc.side ? 15 * k : w);
      const pts: Pt[] = [[cx + sgn * (dc.side ? 4 * k : 6 * k), cy - 3 * k], [inner, cy + 2 * k]];
      const n = U ? 9 : 6;
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push([inner + (outer - inner) * t, bot - (hash2(i + (sgn > 0 ? 9 : 0), 3, 9) * 10 + (i % 2) * 5) * k + Math.sin(f * 0.8 + i + sgn) * k]); }
      pts.push([cx + sgn * (dc.side ? 5 * k : 8 * k), cy - 1]);
      return pts;
    };
    for (const sgn of [-1, 1]) {
      const inner = cx + sgn * gapW * 0.7;
      const m = dc.blobS(panel(sgn), R.mantle, U ? 3 : 2);
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) && m.get(x + 2, y + 2) && m.get(x - 2, y - 2)) { const h = hash2(x, y, 31); if (h < 0.03) dc.cur.set(x, y, h < 0.01 ? R.star[0] : R.space[3]); else if (h > 0.984) dc.cur.set(x, y, R.void[1]); }
      // constellation seam along the torn inner edge
      for (let y = 0; y < (dc.oy - cy); y += 4) dc.layers.emit.set(Math.round(inner) + (sgn > 0 ? 1 : -1), cy + 4 + y, y % 8 ? R.space[3] : R.star[0]);
    }
  };
  const anchor = (hd: Pt, ang: number, len: number, tag: string) => {
    const L = weaponLen(dc, ang, len), u: Pt = [Math.cos(ang), Math.sin(ang)], n = perp(u);
    const ring = along(hd, u, -3 * k);
    dc.part((m) => { m.disc(ring[0], ring[1], 2.5 * k, 1); }, R.astone);
    dc.cur.set(ring[0], ring[1], R.void[0]);
    const end = along(hd, u, L);
    dc.limbS(hd[0], hd[1], end[0], end[1], 1.6 * k, 2 * k, R.astone, U ? 2 : 1);
    const st = along(hd, u, 4 * k); dc.limbS(st[0] - n[0] * 5 * k, st[1] - n[1] * 5 * k, st[0] + n[0] * 5 * k, st[1] + n[1] * 5 * k, 1.2 * k, 1.2 * k, R.astone);
    for (const sg of [-1, 1]) {
      const arc: Pt[] = [];
      for (let i = 0; i <= 5; i++) { const t = i / 5; arc.push([end[0] + n[0] * sg * 9 * k * Math.sin(t * 1.4) - u[0] * 8 * k * t * t, end[1] + n[1] * sg * 9 * k * Math.sin(t * 1.4) - u[1] * 8 * k * t * t]); }
      for (let i = 0; i < arc.length - 1; i++) dc.limbS(arc[i][0], arc[i][1], arc[i + 1][0], arc[i + 1][1], 1.6 * k, 1.5 * k, R.astone);
      const tp = arc[arc.length - 1];
      dc.blobS([[tp[0] - u[0] * 3 * k, tp[1] - u[1] * 3 * k], [tp[0] + n[0] * sg * 3 * k, tp[1] + n[1] * sg * 3 * k], [tp[0] + u[0] * 2 * k, tp[1] + u[1] * 2 * k]], R.astone);
    }
    dc.L('emit'); dc.cur.line(along(hd, u, 5 * k)[0], along(hd, u, 5 * k)[1], end[0], end[1], sc(1)); dc.cur.set(end[0], end[1], sc(3)); dc.L('body');
    dc.anchorScreen(tag, end[0], end[1]);
  };
  const arm = (sh: Pt, el: Pt, hd: Pt) => {
    dc.limbS(sh[0], sh[1], el[0], el[1], 3.4 * k, 3 * k, R.armor, U ? 2 : 1);
    dc.limbS(el[0], el[1], hd[0], hd[1], 3 * k, 3.4 * k, R.armor);
    // rift ring at elbow: forearm reads as emerging from a tear
    dc.L('emit'); for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283 + f * 0.3; if (i % 3 !== 2) dc.cur.set(el[0] + Math.cos(a) * 4 * k, el[1] + Math.sin(a) * 2.5 * k, i % 2 ? sc(2) : sc(1)); } dc.L('body');
    dc.part((m) => m.disc(hd[0], hd[1], 2.8 * k, 1), R.armor);
  };
  const uO: Pt = [Math.cos(r.oAng), Math.sin(r.oAng)];
  const hands = () => { arm(r.shO, r.elO, r.handO); anchor(r.handO, r.oAng, U ? 54 : 24, 'weaponTipO'); arm(r.shW, r.elW, r.handW); anchor(r.handW, r.wAng, U ? 58 : 26, 'weaponTip'); };
  if (!dc.backv) mantle('back');
  dc.L('body');
  if (dc.backv) hands();
  else if (dc.side) { arm(r.shO, r.elO, r.handO); anchor(r.handO, r.oAng, U ? 54 : 24, 'weaponTipO'); }
  for (const [h, kn, ft] of [[r.hipL, r.kneeL, r.footL], [r.hipR, r.kneeR, r.footR]] as Pt[][]) {
    dc.limbS(h[0], h[1], kn[0], kn[1], 3.6 * k, 3.2 * k, R.armor, U ? 2 : 1);
    dc.limbS(kn[0], kn[1], ft[0], ft[1] - 2, 3.4 * k, 3 * k, R.astone);
    dc.part((m) => m.oval(kn[0], kn[1], 3 * k, 2.4 * k, 1), R.armor);
    dc.blobS([[ft[0] - 3.5 * k, ft[1] - 3 * k], [ft[0] + 3.5 * k, ft[1] - 3 * k], [ft[0] + 4 * k + (dc.side ? r.fwd[0] * 2 * k : 0), ft[1]], [ft[0] - 4 * k, ft[1]]], R.armor);
  }
  // fauld & torso
  dc.blobS([[hx - c.hipW - 3 * k, hy - 3 * k], [hx + c.hipW + 3 * k, hy - 3 * k], [hx + c.hipW + 4 * k, hy + 6 * k], [hx - c.hipW - 4 * k, hy + 6 * k]], R.armor);
  const tw = dc.side ? 9 * k : c.shW - 2 * k;
  dc.blobS([[cx - tw, cy - 2 * k], [cx + tw, cy - 2 * k], [cx + tw * 0.75, hy - 2 * k], [cx - tw * 0.75, hy - 2 * k]], R.armor, U ? 3 : 2);
  if (dc.front || dc.backv) { for (let i = -1; i <= 1; i++) dc.cur.line(cx + i * tw * 0.45, cy + 2 * k, cx + i * tw * 0.32, hy - 3 * k, R.astone[3]); dc.cur.line(cx - tw * 0.8, cy + (hy - cy) * 0.55, cx + tw * 0.8, cy + (hy - cy) * 0.55, R.astone[4]); }
  if (U) { // exposed star core in the sternum, brightest pixel identity of the celestial titan
    const sy = cy + (hy - cy) * 0.3; dc.L('emit'); dc.cur.disc(cx, sy, 4, R.space[1]); dc.cur.disc(cx, sy, 2.5, R.space[3]); dc.cur.set(cx, sy, R.star[0]); for (let i = 0; i < 6; i++) { const a = i * 1.047 + f * 0.3; dc.cur.set(cx + Math.cos(a) * 6, sy + Math.sin(a) * 5, i % 2 ? R.space[4] : R.star[0]); } dc.L('body');
  }
  if (dc.front || dc.backv) { // constellation on the cuirass
    const stars: Pt[] = [[-0.5, 0.2], [0.1, 0.1], [0.45, 0.35], [0.0, 0.6], [-0.35, 0.8], [0.3, 0.85]].map(([a, b]) => [cx + a * tw, cy + b * (hy - cy)] as Pt);
    dc.L('emit');
    for (let i = 0; i < stars.length - 1; i++) if (i !== 2) dc.cur.line(stars[i][0], stars[i][1], stars[i + 1][0], stars[i + 1][1], R.space[1]);
    for (const s of stars) { dc.cur.set(s[0], s[1], R.star[0]); if (U) { dc.cur.set(s[0] + 1, s[1], R.space[4]); dc.cur.set(s[0], s[1] + 1, R.space[3]); } }
    dc.L('body');
  }
  if (dc.backv) mantle('body');
  const paul = (s: Pt) => { dc.part((m) => m.oval(s[0], s[1], 6 * k, 4.5 * k, 1), R.armor, U ? 2 : 1); dc.layers.emit.set(s[0] - k, s[1] - k, R.star[0]); };
  if (dc.side) paul(r.shW); else { paul(r.shW); paul(r.shO); }
  // helm with visor slit and floating crest shards
  const [qx, qy] = r.head, hs = U ? 8 : 4;
  dc.part((m) => m.oval(qx + (dc.side ? r.fwd[0] : 0), qy, dc.side ? hs * 1.1 : hs, hs * 1.1, 1), R.armor, U ? 2 : 1);
  dc.L('emit');
  if (dc.front) dc.cur.rect(qx - hs * 0.6, qy, hs * 1.2 + 1, U ? 2 : 1, sc(2));
  else if (dc.side) dc.cur.rect(qx + r.fwd[0] * hs * 0.3, qy, hs * 0.8, U ? 2 : 1, sc(2));
  dc.L('back');
  for (let i = 0; i < (U ? 5 : 3); i++) { const a = -Math.PI / 2 + (i - (U ? 2 : 1)) * 0.5, d = hs * 1.8 + Math.sin(f * 0.7 + i) * k; const sx = qx + Math.cos(a) * d, sy = qy + Math.sin(a) * d; dc.blobS([[sx, sy - 3 * k], [sx + 1.5 * k, sy], [sx, sy + 2 * k], [sx - 1.5 * k, sy]], R.astone); dc.layers.emit.set(sx, sy, sc(2)); }
  dc.L('body');
  if (dc.front) hands();
  else if (dc.side) { arm(r.shW, r.elW, r.handW); anchor(r.handW, r.wAng, U ? 58 : 26, 'weaponTip'); }
  if (p.hands) { dc.L('emit'); const sp = along(r.handO, uO, 4 * k); dc.cur.disc(sp[0], sp[1], 2 * k, R.space[2]); dc.cur.set(sp[0], sp[1], R.k[1]); dc.L('body'); }
  dc.anchorScreen('hand', r.handW[0], r.handW[1]); dc.anchorScreen('handO', r.handO[0], r.handO[1]);
  dc.anchorScreen('core', cx, cy + 8 * k); dc.anchorScreen('head', qx, qy);
  dc.anchorScreen('footL', r.footL[0], r.footL[1]); dc.anchorScreen('footR', r.footR[0], r.footR[1]);
}
