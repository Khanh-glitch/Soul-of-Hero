import { DC, R } from './kit';
import { rig, RigCfg, along, perp, weaponLen } from './rig';
import type { Pt } from './raster';

// RED / SURTUR — charred obsidian skeleton-giant, furnace ribcage, uneven crown horns, molten greatsword.
export function drawSurtur(dc: DC) {
  const U = dc.ult, p = dc.p, f = dc.f;
  const c: RigCfg = U
    ? { leg: 42, torso: 40, neck: 12, hipW: 12, shW: 31, arm: 38, stance: 17, bend: 6 }
    : { leg: 22, torso: 24, neck: 8, hipW: 6, shW: 16, arm: 19, stance: 8 };
  const r = rig(dc, c);
  const G = Math.min(1, p.glow ?? 0.25);
  const hot = (b: number) => R.lava[Math.max(0, Math.min(5, Math.round(b + G * 2)))];
  const [cx, cy] = r.chest, [hx, hy] = r.hip;
  const weaponBehind = dc.dir === 'up' || dc.dir === 'left';
  const offFar = dc.dir === 'right';
  dc.order = weaponBehind ? ['weapon', 'back', 'body', 'emit'] : ['back', 'body', 'weapon', 'emit'];

  // ---- ragged flame mantle (boss-bound emission, follows anchors) ----
  const mH = U ? 40 : 19, mW = c.shW + (U ? 12 : 6);
  const mantleLayer = dc.layers.back;
  if (dc.side) dc.flames(cx - r.fwd[0] * (mW * 0.9), cx + r.fwd[0] * 3, cy + (U ? 6 : 2), mH, R.lava, 11, mantleLayer);
  else dc.flames(cx - mW, cx + mW, cy - (U ? 2 : 1), mH, R.lava, 11, mantleLayer);
  if (dc.backv) dc.flames(cx - mW * 0.6, cx + mW * 0.6, cy + (hy - cy) * 0.7, U ? 26 : 12, R.lava, 5, dc.layers.emit);
  if (U) dc.flames(hx - c.hipW * 2, hx + c.hipW * 2, hy + 6, 18, R.lava, 23, dc.layers.back);

  const leg = (h: Pt, k: Pt, ft: Pt) => {
    dc.L('body');
    dc.limbS(h[0], h[1], k[0], k[1], U ? 7 : 3.2, U ? 5 : 2.4, R.obs, U ? 2 : 1);
    dc.limbS(k[0], k[1], ft[0], ft[1] - 1, U ? 5 : 2, U ? 4 : 1.6, R.obs, U ? 2 : 1);
    dc.part((m) => m.oval(k[0], k[1], U ? 6 : 2.6, U ? 5 : 2, 1), R.char);
    dc.cur.set(k[0], k[1], hot(2));
    if (U) { dc.cur.set(k[0] + 1, k[1] + 1, hot(1)); dc.cur.line(k[0], k[1] + 3, ft[0], ft[1] - 3, hot(0)); }
    const fl = U ? 7 : 3;
    if (dc.side) dc.blobS([[ft[0] - r.fwd[0] * 2, ft[1] - (U ? 6 : 3)], [ft[0] + r.fwd[0] * fl, ft[1] - 1], [ft[0] + r.fwd[0] * (fl + 1), ft[1]], [ft[0] - r.fwd[0] * 2, ft[1]]], R.char);
    else dc.blobS([[ft[0] - fl * 0.6, ft[1] - (U ? 5 : 2)], [ft[0] + fl * 0.6, ft[1] - (U ? 5 : 2)], [ft[0] + fl * 0.8, ft[1]], [ft[0] - fl * 0.8, ft[1]]], R.char);
    dc.cur.set(ft[0] + (dc.side ? r.fwd[0] * (fl + 1) : -fl * 0.7), ft[1], R.horn[3]);
  };
  const arm = (sh: Pt, el: Pt, hd: Pt) => {
    dc.limbS(sh[0], sh[1], el[0], el[1], U ? 7 : 3.2, U ? 5 : 2.6, R.obs, U ? 2 : 1);
    dc.limbS(el[0], el[1], hd[0], hd[1], U ? 5 : 2.2, U ? 4.5 : 2, R.char, U ? 2 : 1);
    dc.cur.line(el[0], el[1], hd[0], hd[1], hot(0));
    dc.part((m) => m.disc(hd[0], hd[1], U ? 5 : 2.4, 1), R.obs);
  };
  const sword = () => {
    dc.L('weapon');
    const L = weaponLen(dc, r.wAng, U ? 98 : 42), w = U ? 6 : 2.5, u = r.uW, n = perp(u);
    const base = along(r.handW, u, U ? 6 : 3), tip = along(r.handW, u, L);
    const mid = along(base, u, L * 0.8);
    const pts: Pt[] = [[base[0] + n[0] * w, base[1] + n[1] * w], [mid[0] + n[0] * w * 0.9, mid[1] + n[1] * w * 0.9], tip, [mid[0] - n[0] * w * 0.9, mid[1] - n[1] * w * 0.9], [base[0] - n[0] * w, base[1] - n[1] * w]];
    if (U) { // serrated volcanic edge teeth
      for (let i = 1; i < 6; i++) { const q = along(base, u, L * 0.13 * i); pts.splice(1 + (i - 1) * 2, 0, [q[0] + n[0] * (w + 3), q[1] + n[1] * (w + 3)], [q[0] + n[0] * w + u[0] * 4, q[1] + n[1] * w + u[1] * 4]); }
    }
    dc.blobS(pts, R.obs, U ? 2 : 1);
    const ch = p.charge || 0;
    const ex = along(base, u, L * 0.92);
    dc.cur.line(base[0] - n[0] * (w - 1), base[1] - n[1] * (w - 1), ex[0], ex[1], hot(1)); // molten edge
    dc.cur.line(base[0], base[1], ex[0], ex[1], R.lava[1]); // fuller
    if (ch > 0) { const e = along(base, u, L * Math.min(1, ch)); dc.L('emit'); dc.cur.line(base[0], base[1], e[0], e[1], R.lava[5]); dc.cur.line(base[0] - n[0], base[1] - n[1], e[0] - n[0], e[1] - n[1], R.lava[4]); if (U) dc.cur.line(base[0] + n[0], base[1] + n[1], e[0] + n[0], e[1] + n[1], R.lava[4]); dc.L('weapon'); }
    const g = along(r.handW, u, U ? 4 : 2), gw = U ? 11 : 5;
    dc.limbS(g[0] - n[0] * gw, g[1] - n[1] * gw, g[0] + n[0] * gw, g[1] + n[1] * gw, U ? 2.5 : 1, U ? 2.5 : 1, R.horn);
    const pm = along(r.handW, u, U ? -8 : -4);
    dc.limbS(r.handW[0], r.handW[1], pm[0], pm[1], U ? 2.5 : 1, U ? 2.5 : 1, R.char);
    dc.cur.set(pm[0], pm[1], R.lava[3]);
    dc.anchorScreen('hand', r.handW[0], r.handW[1]); dc.anchorScreen('weaponTip', tip[0], tip[1]); dc.anchorScreen('weaponBase', base[0], base[1]);
    arm(r.shW, r.elW, r.handW);
  };

  if (weaponBehind) sword();
  dc.L('body');
  if (offFar || dc.backv) arm(r.shO, r.elO, r.handO);
  // legs (far first)
  if (dc.side) { leg(r.hipL, r.kneeL, r.footL); leg(r.hipR, r.kneeR, r.footR); } else { leg(r.hipL, r.kneeL, r.footL); leg(r.hipR, r.kneeR, r.footR); }
  // charred tassets
  const tw = c.hipW + (U ? 8 : 3);
  for (let i = -2; i <= 2; i++) {
    const tx = hx + (dc.side ? r.fwd[0] * i * (U ? 3 : 1.5) : i * tw * 0.42), ty = hy - (U ? 4 : 2);
    const tl = (U ? 16 : 7) - Math.abs(i) * (U ? 2 : 1) + (i * 7 + f) % 2;
    dc.blobS([[tx - (U ? 4 : 2), ty], [tx + (U ? 4 : 2), ty], [tx + 1, ty + tl], [tx - 1, ty + tl - 1]], R.char);
  }
  dc.part((m) => m.oval(hx, hy - 1, tw, U ? 6 : 3, 1), R.obs);
  // ribcage torso
  const cw = dc.side ? (U ? 18 : 8) : c.shW - (U ? 3 : 1), ww = dc.side ? (U ? 12 : 5) : c.hipW + (U ? 3 : 1);
  const tp: Pt[] = [[cx - cw, cy - 1], [cx - cw * 0.6, cy - (U ? 8 : 4)], [cx + cw * 0.6, cy - (U ? 8 : 4)], [cx + cw, cy - 1], [cx + cw * 0.8, cy + (hy - cy) * 0.55], [hx + ww, hy - 2], [hx - ww, hy - 2], [cx - cw * 0.8, cy + (hy - cy) * 0.55]];
  dc.blobS(tp, R.obs, U ? 2 : 1);
  if (dc.front || dc.side) {
    const fx = dc.side ? cx + r.fwd[0] * (cw * 0.45) : cx, fy = cy + (hy - cy) * 0.38;
    const rx = dc.side ? (U ? 5 : 2) : (U ? 12 : 5), ry = U ? 13 : 6;
    dc.L('emit');
    dc.cur.oval(fx, fy, rx, ry, hot(0)); dc.cur.oval(fx, fy, rx - 1, ry - 1, hot(1)); dc.cur.oval(fx, fy + 1, rx * 0.6, ry * 0.6, hot(2)); dc.cur.oval(fx, fy + 1, rx * 0.3, ry * 0.35, hot(3));
    dc.L('body');
    for (let i = -2; i <= 2; i++) { const y = fy + i * (U ? 5 : 2.5); dc.layers.emit.line(fx - rx, y, fx - 1, y, R.obs[1]); dc.layers.emit.line(fx + 1, y, fx + rx, y, R.obs[1]); }
    if (!dc.side) dc.layers.emit.line(fx, fy - ry, fx, fy + ry, R.obs[2]);
  } else {
    for (let y = cy - 2; y < hy - 2; y += U ? 4 : 2) { dc.part((m) => m.disc(cx + ((y >> 1) % 2), y, U ? 2.5 : 1, 1), R.obs); dc.layers.emit.set(cx + 2 - ((y >> 2) % 3), y + 1, hot(1)); }
  }
  // pauldrons: jagged obsidian with molten seams
  const paul = (s: Pt, sgn: number) => {
    const a = U ? 15 : 7;
    dc.blobS([[s[0] - a, s[1] + a * 0.6], [s[0] - a * 0.8, s[1] - a * 0.5], [s[0] - a * 0.2 * sgn, s[1] - a * 1.3], [s[0] + a * 0.3, s[1] - a * 0.6], [s[0] + a, s[1] - a * 0.9], [s[0] + a, s[1] + a * 0.5]], R.char, U ? 2 : 1);
    dc.cur.line(s[0] - a * 0.5, s[1], s[0] + a * 0.4, s[1] - a * 0.3, hot(0));
  };
  if (dc.side) paul(r.shW, r.fwd[0]); else { paul(r.shW, -1); paul(r.shO, 1); }
  // head: horned skull
  const [qx, qy] = r.head, hs = U ? 10 : 5;
  dc.blobS([[qx - hs, qy - hs * 0.6], [qx + hs, qy - hs * 0.6], [qx + hs * 0.8, qy + hs * 0.5], [qx + hs * 0.3, qy + hs * 1.1], [qx - hs * 0.3, qy + hs * 1.1], [qx - hs * 0.8, qy + hs * 0.5]], R.obs, U ? 2 : 1);
  const horn = (bx: number, by: number, dx: number, len: number, seg: number) => {
    let x = bx, y = by, rr = U ? 4.5 : 2, ang = -Math.PI / 2 + dx * 0.9;
    for (let i = 0; i < seg; i++) {
      const nx = x + Math.cos(ang) * len / seg, ny = y + Math.sin(ang) * len / seg;
      dc.limbS(x, y, nx, ny, rr, rr * 0.75, R.horn); x = nx; y = ny; rr *= 0.72; ang -= dx * 0.38;
    }
    dc.layers.emit.set(x, y - 1, R.lava[4]);
    return [x, y] as Pt;
  };
  if (dc.side) { horn(qx - r.fwd[0] * 2, qy - hs * 0.5, -r.fwd[0] * 1.0, U ? 40 : 19, 4); if (U) horn(qx, qy - hs * 0.6, -r.fwd[0] * 0.5, 20, 3); }
  else {
    horn(qx - hs * 0.7, qy - hs * 0.5, -1, U ? 46 : 22, 4); // left horn taller
    horn(qx + hs * 0.7, qy - hs * 0.5, 1.1, U ? 32 : 14, 3); // right horn shorter, broken
    if (U) { horn(qx - hs * 0.2, qy - hs * 0.7, -0.35, 16, 3); horn(qx + hs * 0.25, qy - hs * 0.7, 0.4, 13, 3); }
  }
  dc.L('emit');
  if (dc.front) { dc.cur.rect(qx - hs * 0.55, qy, U ? 4 : 2, 1, hot(2)); dc.cur.rect(qx + hs * 0.55 - (U ? 3 : 1), qy, U ? 4 : 2, 1, hot(2)); dc.cur.line(qx - hs * 0.3, qy + hs * 0.8, qx + hs * 0.3, qy + hs * 0.8, hot(1)); }
  else if (dc.side) { dc.cur.rect(qx + r.fwd[0] * hs * 0.5, qy, U ? 3 : 1, 1, hot(2)); }
  if (U) dc.flames(qx - hs, qx + hs, qy - hs * 0.5, 24, R.lava, 31, dc.layers.back);
  { // molten crack network (more on the titan)
    for (let i = 0; i < (U ? 11 : 5); i++) {
      const sx = cx + ((i * 37) % 23 - 11) * (dc.side ? 0.6 : 1.4) * (U ? 1 : 0.6), sy = cy + ((i * 53) % (U ? 30 : 14));
      let x = sx, y = sy;
      for (let j = 0; j < (U ? 6 : 4); j++) { const nx = x + ((i + j) % 3 - 1) * (U ? 2 : 1), ny = y + (U ? 3 : 2); dc.layers.body.over(nx, ny, hot(1)); dc.layers.body.over(x, y, hot(0)); x = nx; y = ny; }
    }
  }
  // embers
  for (let i = 0; i < (U ? 10 : 4); i++) { const ex = cx + ((i * 29 + f * 3) % (c.shW * 2)) - c.shW, ey = cy - ((f * 2 + i * 11) % (U ? 50 : 20)) - 4; dc.layers.emit.set(ex, ey, i % 2 ? R.lava[4] : R.lava[3]); }
  dc.L('body');
  if (!offFar && !dc.backv) arm(r.shO, r.elO, r.handO);
  if (!weaponBehind) sword();
  dc.anchorScreen('core', cx, cy + (hy - cy) * 0.38); dc.anchorScreen('head', qx, qy);
  dc.anchorScreen('footL', r.footL[0], r.footL[1]); dc.anchorScreen('footR', r.footR[0], r.footR[1]);
}
