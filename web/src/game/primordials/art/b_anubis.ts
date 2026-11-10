import { DC, R } from './kit';
import { rig, RigCfg, along, perp, weaponLen } from './rig';
import type { Pt } from './raster';

// ORANGE / ANUBIS — jackal-headed executioner: long ears, striped nemes, broad collar, linen kilt,
// crescent soul-scythe, chain coiled from the off hand, hollow amber soul wisps.
export function drawAnubis(dc: DC) {
  const U = dc.ult, p = dc.p, f = dc.f;
  const c: RigCfg = U
    ? { leg: 46, torso: 42, neck: 12, hipW: 10, shW: 26, arm: 40, stance: 12, bend: 5 }
    : { leg: 23, torso: 21, neck: 6, hipW: 5, shW: 12, arm: 19, stance: 6 };
  const r = rig(dc, c), k = U ? 2 : 1, G = p.glow ?? 0.3;
  const [cx, cy] = r.chest, [hx, hy] = r.hip;
  const weaponBehind = dc.dir === 'up' || dc.dir === 'left';
  dc.order = weaponBehind ? ['weapon', 'back', 'body', 'emit'] : ['back', 'body', 'weapon', 'emit'];
  const so = (b: number) => R.soul[Math.max(0, Math.min(5, Math.round(b + G * 2)))];

  // hollow soul wisp: contour + ivory core, distinct from Surtur's filled flame tongues
  const wisp = (wx: number, wy: number, s: number, seed: number) => {
    const m = dc.mask();
    const pts: Pt[] = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.283; const rr = s * (i === 6 ? 2.2 : 1) * (0.9 + 0.2 * Math.sin(f + seed + i)); pts.push([wx + Math.cos(a) * rr * 0.8, wy + Math.sin(a) * rr * (a > 3.5 && a < 6 ? 1.8 : 1)]); }
    m.poly(pts, 1);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y)) { const edge = !m.get(x - 1, y) || !m.get(x + 1, y) || !m.get(x, y - 1) || !m.get(x, y + 1); if (edge) dc.layers.emit.set(x, y, so(1)); }
    dc.layers.emit.set(wx, wy, R.soul[5]); dc.layers.emit.set(wx - 1, wy + 1, R.soul[4]);
  };
  for (let i = 0; i < (U ? 5 : 2); i++) wisp(cx + (i % 2 ? 1 : -1) * (c.shW + (6 + i * 3) * k), cy - (10 + i * 6) * k + Math.sin(f * 0.8 + i) * 2, (U ? 3.5 : 2), i * 3);
  const scythe = () => {
    dc.L('weapon');
    const L = weaponLen(dc, r.wAng, U ? 104 : 46), u = r.uW, n = perp(u);
    const bot = along(r.handW, u, -L * 0.25), top = along(r.handW, u, L * 0.75);
    dc.limbS(bot[0], bot[1], top[0], top[1], U ? 2.2 : 1.1, U ? 2.2 : 1.1, R.jet);
    for (let i = 1; i < 5; i++) { const b = along(bot, u, L * 0.2 * i); dc.cur.set(b[0], b[1], R.fgold[3]); dc.cur.set(b[0] + u[0], b[1] + u[1], R.fgold[2]); }
    const side = dc.dir === 'left' || dc.dir === 'up' ? -1 : 1, bl = U ? 38 : 17;
    const outer: Pt[] = [], inner: Pt[] = [];
    for (let i = 0; i <= 9; i++) {
      const t = i / 9, cw = Math.sin(Math.min(1, t * 1.25) * Math.PI) * (U ? 10 : 4.5) + 1;
      const bx = top[0] + n[0] * side * bl * t - u[0] * bl * (0.8 * t * t - 0.25 * t), by = top[1] + n[1] * side * bl * t - u[1] * bl * (0.8 * t * t - 0.25 * t);
      outer.push([bx + u[0] * cw * 0.6, by + u[1] * cw * 0.6]); inner.unshift([bx - u[0] * cw * 0.4, by - u[1] * cw * 0.4]);
    }
    dc.blobS([...outer, ...inner], R.jet, U ? 2 : 1);
    for (let i = 1; i < outer.length; i++) dc.layers.emit.line(outer[i - 1][0], outer[i - 1][1], outer[i][0], outer[i][1], so(i % 3 === 0 ? 3 : 2));
    dc.part((m) => m.disc(top[0], top[1], U ? 3.5 : 1.8, 1), R.fgold);
    const tip = outer[outer.length - 1];
    dc.anchorScreen('hand', r.handW[0], r.handW[1]); dc.anchorScreen('weaponTip', tip[0], tip[1]); dc.anchorScreen('weaponBase', top[0], top[1]);
    dc.limbS(r.shW[0], r.shW[1], r.elW[0], r.elW[1], 2.4 * k, 2 * k, R.jet);
    dc.limbS(r.elW[0], r.elW[1], r.handW[0], r.handW[1], 2 * k, 1.8 * k, R.jet);
    dc.cur.line(r.elW[0], r.elW[1], (r.elW[0] + r.handW[0]) / 2, (r.elW[1] + r.handW[1]) / 2, R.fgold[3]);
    dc.part((m) => m.disc(r.handW[0], r.handW[1], 2 * k, 1), R.jet);
    dc.L('body');
  };
  const offArm = () => {
    dc.limbS(r.shO[0], r.shO[1], r.elO[0], r.elO[1], 2.4 * k, 2 * k, R.jet);
    dc.limbS(r.elO[0], r.elO[1], r.handO[0], r.handO[1], 2 * k, 1.8 * k, R.jet);
    dc.part((m) => m.disc(r.handO[0], r.handO[1], 1.8 * k, 1), R.jet);
    // soul chain hanging & coiling from the off hand (links alternate orientation)
    const end: Pt = [r.handO[0] + (dc.side ? -r.fwd[0] * 6 : 6) * k, dc.oy - 1];
    const n = U ? 22 : 12;
    for (let i = 0; i <= n; i++) {
      const t = i / n, sag = Math.sin(t * Math.PI) * 6 * k;
      const x = r.handO[0] + (end[0] - r.handO[0]) * t + sag * 0.4, y = r.handO[1] + (end[1] - r.handO[1]) * t + sag * 0.3;
      if (i % 2) { dc.layers.weapon.set(x, y, R.fgold[3]); dc.layers.weapon.set(x + 1, y, R.fgold[1]); } else { dc.layers.weapon.set(x, y, R.fgold[2]); dc.layers.weapon.set(x, y + 1, R.fgold[1]); }
    }
    dc.anchorScreen('chainHand', r.handO[0], r.handO[1]);
  };
  if (weaponBehind) scythe();
  dc.L('back');
  if (U) { // spectral cape: translucent-hardened hollow cloth with soul hem
    const cw = dc.side ? 14 : c.shW + 8;
    const pts: Pt[] = [[cx - cw * 0.7, cy - 2], [cx + cw * 0.7, cy - 2]];
    for (let i = 8; i >= 0; i--) pts.push([cx - cw + (i / 8) * cw * 2 - (dc.side ? r.fwd[0] * 14 : 0), dc.oy - 8 - ((i + f) % 3) * 4]);
    dc.blobS(pts, R.jet, 3);
    for (let i = 0; i < 9; i++) dc.layers.emit.set(cx - cw + (i / 8) * cw * 2 - (dc.side ? r.fwd[0] * 14 : 0), dc.oy - 9 - ((i + f) % 3) * 4, so(2));
  }
  dc.L('body');
  if (dc.side && dc.dir === 'right' || dc.backv) offArm();
  for (const [h, kn, ft] of [[r.hipL, r.kneeL, r.footL], [r.hipR, r.kneeR, r.footR]] as Pt[][]) {
    dc.limbS(h[0], h[1], kn[0], kn[1], 2.4 * k, 2 * k, R.jet);
    dc.limbS(kn[0], kn[1], ft[0], ft[1] - 2, 2 * k, 1.6 * k, R.jet);
    dc.limbS(kn[0], kn[1] + 2 * k, (kn[0] + ft[0]) / 2, (kn[1] + ft[1]) / 2, 1.6 * k, 1.4 * k, R.fgold);
    dc.blobS([[ft[0] - 2 * k, ft[1] - 2 * k], [ft[0] + 2 * k, ft[1] - 2 * k], [ft[0] + 2.5 * k + (dc.side ? r.fwd[0] * 3 * k : 0), ft[1]], [ft[0] - 2.5 * k, ft[1]]], R.jet);
  }
  // linen kilt with gold front panel
  const kw = (dc.side ? 5 : c.hipW + 1.5) * k;
  dc.blobS([[hx - kw, hy - 3 * k], [hx + kw, hy - 3 * k], [hx + kw + 2 * k + (p.legL || 0) * 0.3, hy + 9 * k], [hx - kw - 2 * k + (p.legL || 0) * 0.3, hy + 9 * k]], R.linen);
  if (!dc.backv) dc.blobS([[hx - 2 * k + (dc.side ? r.fwd[0] * 3 * k : 0), hy - 2 * k], [hx + 2 * k + (dc.side ? r.fwd[0] * 3 * k : 0), hy - 2 * k], [hx + 1.5 * k + (dc.side ? r.fwd[0] * 4 * k : 0), hy + 9 * k], [hx - 1.5 * k + (dc.side ? r.fwd[0] * 4 * k : 0), hy + 9 * k]], R.fgold);
  // pleated kilt with alternating lit/shadow strips
  for (let i = -3; i <= 3; i++) { const fx = hx + i * kw * 0.3 + (p.legL || 0) * 0.2; dc.cur.line(fx, hy - 1 * k, fx + Math.sign(i) * 1.5, hy + 8 * k, i % 2 ? R.linen[0] : R.linen[2]); }
  dc.cur.line(hx - kw, hy - 3 * k, hx + kw, hy - 3 * k, R.fgold[3]);
  // athletic torso
  const tw = dc.side ? 6 * k : c.shW - k;
  dc.blobS([[cx - tw, cy - k], [cx + tw, cy - k], [hx + c.hipW * 0.9, hy - 3 * k], [hx - c.hipW * 0.9, hy - 3 * k]], R.jet, U ? 2 : 1);
  // wrapped torso bands + sternum gold seam keep the dark anatomy readable
  for (let i = 0; i < 3; i++) { const y = cy + (hy - cy) * (0.25 + i * 0.24); dc.cur.line(cx - tw * (0.9 - i * 0.08), y, cx + tw * (0.9 - i * 0.08), y, i === 1 ? R.fgold[2] : R.jet[3]); }
  dc.cur.line(cx, cy + 2 * k, cx, hy - 4 * k, R.fgold[3]);
  // broad collar (usekh): concentric gold/lapis bands
  if (!dc.backv) for (let b = 0; b < (U ? 5 : 3); b++) { const rr = (dc.side ? 5 : c.shW * 0.75) * 1 + b * k * 1.2; const col = b % 2 ? R.lapis[1] : R.fgold[3]; for (let a = 0.15; a < Math.PI - 0.15; a += 0.08) dc.cur.set(cx + Math.cos(a) * rr * (dc.side ? 0.6 : 1) + (dc.side ? r.fwd[0] * 2 * k : 0), cy - 2 * k + Math.sin(a) * rr * 0.55, col); }
  // jackal head: nemes lappets, long ears, snout
  const [qx, qy] = r.head, hs = U ? 7 : 3.6;
  const nemes = (sg: number) => { const x0 = qx + sg * hs * 0.9; dc.blobS([[x0 - 1.5 * k, qy - hs * 0.4], [x0 + 1.5 * k, qy - hs * 0.4], [x0 + 2.5 * k * sg + 1, cy + 4 * k], [x0 - 0.5 * k * sg, cy + 4 * k]], R.lapis); for (let y = qy; y < cy + 4 * k; y += 2 * k) dc.cur.line(x0 - k, y, x0 + 1.5 * k, y, R.fgold[3]); };
  if (!dc.side) { nemes(-1); nemes(1); } else { const x0 = qx - r.fwd[0] * hs * 0.6; dc.blobS([[x0 - 2 * k, qy - hs * 0.5], [x0 + 2 * k, qy - hs * 0.5], [x0 - r.fwd[0] * 3 * k, cy + 5 * k], [x0 + r.fwd[0] * k, cy + 5 * k]], R.lapis); for (let y = qy; y < cy + 4 * k; y += 2 * k) dc.cur.line(x0 - k, y, x0 + k, y, R.fgold[3]); }
  const ear = (ex: number, lean: number) => { const eh = U ? 22 : 11; dc.blobS([[ex - 2.2 * k, qy - hs * 0.4], [ex + lean * eh * 0.25, qy - hs * 0.4 - eh], [ex + 2.2 * k, qy - hs * 0.4]], R.jet); dc.cur.line(ex, qy - hs * 0.6, ex + lean * eh * 0.2, qy - hs * 0.4 - eh * 0.75, R.fgold[2]); };
  if (dc.side) ear(qx - r.fwd[0] * hs * 0.2, -r.fwd[0] * 0.6); else { ear(qx - hs * 0.55, -0.35); ear(qx + hs * 0.55, 0.35); }
  dc.part((m) => m.oval(qx, qy, hs, hs * 0.95, 1), R.jet, U ? 2 : 1);
  if (dc.side) dc.blobS([[qx + r.fwd[0] * hs * 0.4, qy - hs * 0.3], [qx + r.fwd[0] * hs * 2.3, qy + hs * 0.35], [qx + r.fwd[0] * hs * 2.2, qy + hs * 0.8], [qx + r.fwd[0] * hs * 0.3, qy + hs * 0.9]], R.jet);
  else if (dc.front) dc.blobS([[qx - hs * 0.45, qy + hs * 0.3], [qx + hs * 0.45, qy + hs * 0.3], [qx + hs * 0.25, qy + hs * 1.5], [qx - hs * 0.25, qy + hs * 1.5]], R.jet);
  dc.L('emit');
  if (dc.front) { dc.cur.rect(qx - hs * 0.6, qy, U ? 3 : 2, 1, so(3)); dc.cur.rect(qx + hs * 0.6 - (U ? 2 : 1), qy, U ? 3 : 2, 1, so(3)); }
  else if (dc.side) dc.cur.rect(qx + r.fwd[0] * hs * 0.5, qy - 1, U ? 2 : 1, 1, so(3));
  dc.L('body');
  dc.part((m) => m.disc(r.shW[0], r.shW[1], 2.6 * k, 1), R.fgold);
  if (!dc.side) dc.part((m) => m.disc(r.shO[0], r.shO[1], 2.6 * k, 1), R.fgold);
  if (dc.front || dc.dir === 'left') offArm();
  if (!weaponBehind) scythe();
  dc.anchorScreen('core', cx, cy + 4 * k); dc.anchorScreen('head', qx, qy);
  dc.anchorScreen('footL', r.footL[0], r.footL[1]); dc.anchorScreen('footR', r.footR[0], r.footR[1]);
}
