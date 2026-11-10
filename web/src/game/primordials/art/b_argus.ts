import { DC, R } from './kit';
import { rig, RigCfg } from './rig';
import { hash2 } from './raster';
import type { Pt } from './raster';

// YELLOW / ARGUS — regal tyrant whose head is one dominant eye in a gold crown; organised crown and shoulder eye clusters;
// self-manifested golden lances fan behind the shoulders.
export function drawArgus(dc: DC) {
  const U = dc.ult, p = dc.p, f = dc.f;
  const c: RigCfg = U
    ? { leg: 40, torso: 50, neck: 8, hipW: 14, shW: 30, arm: 38, stance: 14, bend: 5 }
    : { leg: 20, torso: 24, neck: 4, hipW: 6, shW: 13, arm: 18, stance: 6 };
  const r = rig(dc, c), k = U ? 2 : 1, G = p.glow ?? 0.3, CH = p.charge ?? 0, OPEN = p.open ?? 1;
  const [cx, cy] = r.chest, [hx, hy] = r.hip;
  dc.order = ['back', 'body', 'weapon', 'emit'];
  const look: Pt = dc.front ? [0, 0.6] : dc.side ? [r.fwd[0], 0.2] : [0, -1];
  const eye = (ex: number, ey: number, rx: number, ry: number, open: number, layer = dc.cur) => {
    const save = dc.cur; dc.cur = layer;
    dc.part((m) => m.oval(ex, ey, rx + 1, ry + 1, 1), R.gold);
    dc.cur.oval(ex, ey, rx, ry, R.eyew[1]);
    if (rx >= 3) dc.cur.line(ex - rx + 1, ey + ry - 1, ex + rx - 1, ey + ry - 1, R.eyew[0]);
    const ir = Math.max(0.6, ry * 0.75);
    const sac = rx < 4 ? (hash2(Math.round(ex), Math.floor(f / 3), 11) - 0.5) * 2 : 0, sacY = rx < 4 ? (hash2(Math.round(ey), Math.floor(f / 3), 12) - 0.5) : 0;
    const ix = ex + (look[0] + sac) * (rx - ir) * 0.7, iy = ey + (look[1] + sacY) * (ry - ir) * 0.5;
    if (ir >= 1.5) { dc.cur.disc(ix, iy, ir, R.iris[1]); dc.cur.disc(ix, iy, ir * 0.55, R.pupil[0]); dc.cur.set(ix - ir * 0.4, iy - ir * 0.4, R.eyew[2]); }
    else dc.cur.set(ix, iy, R.pupil[0]);
    if (open < 1) { const lid = Math.round((ry * 2 + 1) * (1 - open)); for (let j = 0; j < lid; j++) dc.cur.line(ex - rx, ey - ry + j, ex + rx, ey - ry + j, j === lid - 1 ? R.flesh[0] : R.flesh[2]); }
    dc.cur = save;
  };
  // lance fan (boss-local manifested weapons)
  dc.L('back');
  const nL = U ? 8 : 4;
  for (let i = 0; i < nL; i++) {
    const a = -Math.PI / 2 + (i - (nL - 1) / 2) * (U ? 0.28 : 0.42) + Math.sin(f * 0.6 + i) * 0.05, len = (U ? 56 : 24) * (0.75 + CH * 0.25) * (i % 2 ? 0.85 : 1);
    const bx = cx + Math.cos(a) * 6 * k, by = cy - 2 * k + Math.sin(a) * 4 * k, tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
    dc.limbS(bx, by, tx, ty, U ? 1.2 : 0.6, U ? 1.2 : 0.6, R.gold);
    const n: Pt = [-Math.sin(a), Math.cos(a)], hl = U ? 9 : 4, hw = U ? 3 : 1.6;
    dc.blobS([[tx, ty], [tx + Math.cos(a) * hl * 0.4 + n[0] * hw, ty + Math.sin(a) * hl * 0.4 + n[1] * hw], [tx + Math.cos(a) * hl, ty + Math.sin(a) * hl], [tx + Math.cos(a) * hl * 0.4 - n[0] * hw, ty + Math.sin(a) * hl * 0.4 - n[1] * hw]], R.gold);
    if (CH > 0.4) dc.layers.emit.line(tx, ty, tx + Math.cos(a) * hl, ty + Math.sin(a) * hl, R.mind[CH > 0.8 ? 5 : 4]);
  }
  dc.L('body');
  const arm = (sh: Pt, el: Pt, hd: Pt) => {
    dc.limbS(sh[0], sh[1], el[0], el[1], 3.2 * k, 3.6 * k, R.regal);
    dc.limbS(el[0], el[1], hd[0], hd[1], 2 * k, 1.7 * k, R.gold);
    dc.cur.line(el[0], el[1], hd[0], hd[1], R.gold[4]);
    dc.part((m) => m.disc(el[0], el[1], 2.2 * k, 1), R.gold);
    dc.cur.disc(el[0], el[1], 1, R.regal[0]);
    for (let i = -1; i <= 2; i++) dc.cur.set(hd[0] + i * k * 0.9, hd[1] + 2 * k, R.gold[4]);
  };
  if (dc.backv) { arm(r.shW, r.elW, r.handW); arm(r.shO, r.elO, r.handO); } else if (dc.side) { arm(r.shO, r.elO, r.handO); arm(r.shW, r.elW, r.handW); }
  for (const ft of [r.footL, r.footR]) dc.blobS([[ft[0] - 2.5 * k, ft[1] - 2 * k], [ft[0] + 2.5 * k, ft[1] - 2 * k], [ft[0] + 3 * k + (dc.side ? r.fwd[0] * 2 * k : 0), ft[1]], [ft[0] - 3 * k, ft[1]]], R.gold);
  // regal robe (ultimate: siege dais with eye panels)
  const hemW = (dc.side ? 10 : U ? 15 : 11) * k, hemY = dc.oy - 2 * k, sw = (p.legL || 0) * 0.4;
  // tapered A-line robe: one continuous flared skirt with a centre slit; no vertical rectangle edges
  const topW = (dc.side ? 8 : c.shW - 3) * (U ? 1.15 : 1), hem = hemW + sw;
  const skirtL: Pt[] = [[cx - topW, cy + 2 * k], [hx - hem * 0.55, hy], [hx - hem, hemY], [hx - hem * 0.22, hemY + 1], [hx - hem * 0.1, hy + 4 * k]];
  const skirtR: Pt[] = [[cx + topW, cy + 2 * k], [hx + hem * 0.55, hy], [hx + hem, hemY], [hx + hem * 0.22, hemY + 1], [hx + hem * 0.1, hy + 4 * k]];
  for (const [sg, pts] of [[-1, skirtL], [1, skirtR]] as [number, Pt[]][]) {
    dc.blobS(pts, R.regal, U ? 3 : 2);
    // sparse shadow folds (2 per panel, short) instead of full-height stripes
    for (let i = 0; i < 2; i++) dc.cur.line(hx + sg * hem * (0.3 + i * 0.32), hy + 1 * k, hx + sg * hem * (0.45 + i * 0.3), hemY - 3 * k, R.regal[1]);
    dc.cur.line(hx + sg * hem * 0.22, hy + 2 * k, hx + sg * hem * 0.3, hemY - 2 * k, R.regal[4]);
    dc.layers.emit.line(cx + sg * topW * 0.75, cy + 8 * k, hx + sg * hem * 0.7, hemY - 3, R.gold[2]);
    if (!dc.backv) for (let i = 0; i < 3; i++) eye(hx + sg * (hem * 0.35 + i * 4 * k), hy + (U ? 12 : 8) + i * 3 * k, U ? 2 : 1.1, U ? 1.3 : 0.85, 0.8);
  }
  // boots: dark greaves with gold toe caps, planted under the skirt
  for (const [side, ft] of [[-1, r.footL], [1, r.footR]] as [number, Pt][]) {
    const lx = hx + side * (dc.side ? 2 : U ? 6 : 3.5) * k;
    dc.limbS(lx, hy + 3 * k, lx + side, ft[1] - 5, 2 * k, 1.7 * k, R.regal);
    dc.limbS(lx + side, ft[1] - 6, ft[0], ft[1] - 2, 1.7 * k, 1.5 * k, R.gold);
    dc.blobS([[ft[0] - 2.6 * k, ft[1] - 2 * k], [ft[0] + 2.6 * k, ft[1] - 2 * k], [ft[0] + 3 * k + (dc.side ? r.fwd[0] * 2.5 : 0), ft[1]], [ft[0] - 3 * k, ft[1]]], R.regal);
    dc.cur.set(ft[0] + 1, ft[1] - 1, R.gold[4]);
  }
  // structured regal robe: centre lapels, side panels, animated hem and a row of small votive eyes
  for (let i = -2; i <= 2; i++) { const fx = hx + sw * 0.5 + i * hemW * 0.36, sway = Math.sin(f * 0.8 + i) * (U ? 2 : 1); if (i) dc.cur.line(fx, cy + 4 * k, fx + i + sway, hemY - 2 * k, i % 2 ? R.regal[1] : R.regal[3]); }
  for (let y = hy + 6 * k; y < hemY - 2; y += 3 * k) { dc.cur.set(hx - 2 * k + sw * 0.4, y, R.gold[3]); dc.cur.set(hx + 2 * k + sw * 0.4, y, R.gold[2]); }
  if (!dc.backv) for (let i = -2; i <= 2; i++) eye(hx + sw * 0.5 + i * hemW * 0.32, hy + (U ? 16 : 8) + Math.abs(i) * 2, U ? 3 : 1.6, U ? 1.8 : 1, 0.9);
  dc.cur.line(hx - hemW + sw, hemY, hx + hemW + sw, hemY, R.gold[3]);
  dc.cur.line(hx - hemW + sw, hemY - 1, hx + hemW + sw, hemY - 1, R.gold[2]);
  if (!dc.side) { dc.cur.line(hx, cy + 4 * k, hx + sw, hemY, R.gold[2]); dc.cur.line(hx + 1, cy + 4 * k, hx + 1 + sw, hemY, R.gold[3]); }
  if (U && !dc.backv) for (let i = 0; i < 3; i++) { const ey = hy + 4 + i * 16; eye(hx + sw * 0.5 + (dc.side ? r.fwd[0] * 4 : 0) + (i === 1 ? 0 : 0), ey, i === 1 ? 6 : 4, i === 1 ? 3 : 2, OPEN); }
  dc.cur.line(hx - c.hipW - 2 * k, hy - 4 * k, hx + c.hipW + 2 * k, hy - 4 * k, R.gold[3]);
  // high shoulders with organised eye triads
  const shoulder = (s: Pt, sg: number) => {
    dc.blobS([[s[0] - 6 * k, s[1] + 4 * k], [s[0] - 5 * k, s[1] - 3 * k], [s[0] + sg * 2 * k, s[1] - 8 * k], [s[0] + 6 * k, s[1] - 3 * k], [s[0] + 6 * k, s[1] + 4 * k]], R.gold, U ? 2 : 1);
    if (!dc.backv || true) { const ex = U ? 3 : 1.6, ey = U ? 2 : 1; eye(s[0] - 2.5 * k, s[1] - 1 * k, ex, ey, OPEN); eye(s[0] + 2.5 * k, s[1] - 1 * k, ex, ey, OPEN); eye(s[0], s[1] - 4.5 * k, ex, ey, OPEN); }
  };
  if (dc.side) shoulder(r.shW, r.fwd[0]); else { shoulder(r.shW, -1); shoulder(r.shO, 1); }
  // central eye head in crown
  const [qx, qy] = r.head, hs = U ? 11 : 5.5;
  const crownN = U ? 9 : 5;
  for (let i = 0; i < crownN; i++) { const a = -Math.PI + (i + 0.5) * (Math.PI / crownN); const sx = qx + Math.cos(a) * hs * 1.5, sy = qy + Math.sin(a) * hs * 1.35; dc.blobS([[sx - 1.5 * k, sy], [sx, sy - 5 * k], [sx + 1.5 * k, sy]], R.gold); }
  dc.part((m) => m.oval(qx, qy, (dc.side ? 0.8 : 1) * hs * 1.25, hs * 1.15, 1), R.gold, U ? 2 : 1);
  if (!dc.backv) {
    const ex = qx + (dc.side ? r.fwd[0] * hs * 0.35 : 0);
    eye(ex, qy, (dc.side ? 0.6 : 1) * hs * 0.95, hs * 0.72, OPEN);
    if (G > 0.6 && OPEN > 0.5) { dc.L('emit'); const ix = ex + look[0] * hs * 0.25, iy = qy + look[1] * hs * 0.2; dc.cur.set(ix, iy, R.mind[5]); dc.cur.set(ix + 1, iy, R.mind[4]); dc.cur.set(ix - 1, iy, R.mind[4]); dc.cur.set(ix, iy - 1, R.mind[4]); dc.L('body'); }
    dc.anchorScreen('eye', ex, qy);
  } else { for (let i = -1; i <= 1; i++) eye(qx + i * hs * 0.7, qy, U ? 3 : 1.6, U ? 2 : 1, OPEN); dc.anchorScreen('eye', qx, qy); }
  // crown eye cluster: arc of smaller eyes above the main eye
  for (let i = 0; i < crownN; i += 2) { const a = -Math.PI + (i + 0.5) * (Math.PI / crownN); eye(qx + Math.cos(a) * hs * 1.15, qy + Math.sin(a) * hs * 1.05, U ? 2.4 : 1.2, U ? 1.6 : 1, Math.min(OPEN, CH > 0.2 ? 1 : 0.6)); }
  if (dc.front) { arm(r.shW, r.elW, r.handW); arm(r.shO, r.elO, r.handO); } else if (dc.side) arm(r.shW, r.elW, r.handW);
  dc.anchorScreen('hand', r.handW[0], r.handW[1]); dc.anchorScreen('handO', r.handO[0], r.handO[1]); dc.anchorScreen('weaponTip', r.handW[0], r.handW[1] - 4);
  dc.anchorScreen('core', cx, cy + 6 * k); dc.anchorScreen('head', qx, qy);
  dc.anchorScreen('footL', r.footL[0], r.footL[1]); dc.anchorScreen('footR', r.footR[0], r.footR[1]);
  void f;
}
