import { DC, R } from './kit';
import { rig, RigCfg, along, perp, weaponLen } from './rig';
import type { Pt } from './raster';

// GREEN / AION — maned ancient reaper in floor-length robe, sharp bone face, long scythe, asymmetric bronze clockwork shards.
export function drawAion(dc: DC) {
  const U = dc.ult, p = dc.p, f = dc.f;
  const c: RigCfg = U
    ? { leg: 44, torso: 44, neck: 12, hipW: 10, shW: 24, arm: 40, stance: 10, bend: 5 }
    : { leg: 22, torso: 22, neck: 6, hipW: 5, shW: 11, arm: 19, stance: 5 };
  const r = rig(dc, c), k = U ? 2 : 1, G = p.glow ?? 0.3;
  const [cx, cy] = r.chest, [hx, hy] = r.hip;
  const weaponBehind = dc.dir === 'up' || dc.dir === 'left';
  dc.order = weaponBehind ? ['weapon', 'back', 'body', 'emit'] : ['back', 'body', 'weapon', 'emit'];
  const tcol = (b: number) => R.time[Math.max(0, Math.min(5, Math.round(b + G * 2)))];

  const gear = (gx: number, gy: number, rad: number, ph: number, broken: number) => {
    const m = dc.mask();
    m.disc(gx, gy, rad, 1);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + ph; if (i / 8 < broken) continue; m.disc(gx + Math.cos(a) * (rad + 1), gy + Math.sin(a) * (rad + 1), U ? 1.4 : 0.7, 1); }
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) && Math.hypot(x - gx, y - gy) < rad * 0.45) m.set(x, y, 0);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) && Math.atan2(y - gy, x - gx) + 3.1416 < broken * 6.283) m.set(x, y, 0);
    const save = dc.cur; dc.cur = dc.layers.back; dc.part((mm) => mm.blit(m, 0, 0), R.bronze); dc.cur = save;
  };
  const scythe = () => {
    dc.L('weapon');
    const L = weaponLen(dc, r.wAng, U ? 100 : 46), u = r.uW, n = perp(u);
    const bot = along(r.handW, u, -L * 0.3), top = along(r.handW, u, L * 0.7);
    dc.limbS(bot[0], bot[1], top[0], top[1], U ? 2.6 : 1.5, U ? 2.2 : 1.3, R.steel); dc.cur.line(bot[0] + 1, bot[1], top[0] + 1, top[1], R.steel[4]); dc.cur.line(bot[0], bot[1] + 1, top[0], top[1] + 1, R.steel[0]);
    for (let i = 1; i < 4; i++) { const b = along(bot, u, L * 0.25 * i); dc.cur.set(b[0], b[1], R.bronze[3]); }
    const bl = U ? 34 : 15, side = dc.dir === 'left' || dc.dir === 'up' ? -1 : 1;
    const outer: Pt[] = [], inner: Pt[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, cw = Math.sin(t * Math.PI) * (U ? 7 : 3) + (U ? 2 : 1);
      const bx = top[0] + n[0] * side * bl * t - u[0] * bl * 0.55 * t * t, by = top[1] + n[1] * side * bl * t - u[1] * bl * 0.55 * t * t;
      outer.push([bx + u[0] * cw * 0.5, by + u[1] * cw * 0.5]); inner.unshift([bx - u[0] * cw * 0.5, by - u[1] * cw * 0.5]);
    }
    dc.blobS([...outer, ...inner], R.steel); for (let i = 0; i < outer.length; i++) dc.cur.set(outer[i][0], outer[i][1], R.steel[4]); for (let i = 1; i < inner.length - 1; i++) dc.cur.set(inner[i][0], inner[i][1], R.time[3]);
    for (let i = 1; i < inner.length - 1; i++) dc.layers.emit.set(inner[i][0], inner[i][1], tcol(2));
    const tip = outer[outer.length - 1];
    dc.anchorScreen('hand', r.handW[0], r.handW[1]); dc.anchorScreen('weaponTip', tip[0], tip[1]); dc.anchorScreen('weaponBase', top[0], top[1]);
    dc.limbS(r.shW[0], r.shW[1], r.elW[0], r.elW[1], 3 * k, 4.2 * k, R.robe);
    dc.limbS(r.elW[0], r.elW[1], r.handW[0], r.handW[1], 1.4 * k, 1.2 * k, R.bone);
    dc.part((m) => m.disc(r.handW[0], r.handW[1], 1.8 * k, 1), R.bone);
    dc.L('body');
  };
  // broken temporal halo (ultimate) and mane back
  if (U) { dc.L('back'); for (let i = 0; i < 14; i++) { if (i % 4 === 3) continue; const a0 = (i / 14) * 6.283 + f * 0.05; for (let j = 0; j < 5; j++) { const a = a0 + j * 0.06; dc.cur.set(r.head[0] + Math.cos(a) * 34, r.head[1] - 6 + Math.sin(a) * 26, tcol(i % 3 === 0 ? 2 : 1)); } } }
  if (weaponBehind) scythe();
  dc.L('back');
  // asymmetric clockwork shards near off-shoulder
  const so = dc.side ? -r.fwd[0] : 1;
  gear(cx + so * (c.shW + 6 * k), cy - 6 * k, 3.5 * k, f * 0.4, 0.3);
  gear(cx + so * (c.shW + 2 * k), cy - 14 * k, 2.2 * k, -f * 0.5, 0.55);
  if (U) { gear(cx - so * (c.shW + 8), cy - 22, 7, f * 0.3, 0.2); gear(cx + so * (c.shW + 16), cy + 8, 5, -f * 0.3, 0.45); }
  dc.L('body');
  if (dc.side || dc.backv) { dc.limbS(r.shO[0], r.shO[1], r.elO[0], r.elO[1], 3 * k, 4 * k, R.robe); dc.limbS(r.elO[0], r.elO[1], r.handO[0], r.handO[1], 1.3 * k, 1.2 * k, R.bone); }
  // feet peeking under hem
  for (const ft of [r.footL, r.footR]) dc.blobS([[ft[0] - 2 * k, ft[1] - 2 * k], [ft[0] + 2 * k, ft[1] - 2 * k], [ft[0] + 2.5 * k + (dc.side ? r.fwd[0] * 2 * k : 0), ft[1]], [ft[0] - 2.5 * k, ft[1]]], R.bronze);
  // floor-length robe with ragged animated hem
  const hemY = dc.oy - 2 * k, hemW = (dc.side ? 10 : 15) * k, sw = (p.legL || 0) * 0.5;
  const robe: Pt[] = [[cx - (dc.side ? 6 * k : c.shW), cy]];
  const teeth = U ? 9 : 6;
  for (let i = 0; i <= teeth; i++) { const t = i / teeth; robe.push([hx - hemW + sw + t * hemW * 2, hemY + ((i + f) % 2 ? 0 : -2 * k) + (i === 0 || i === teeth ? -1 : 0)]); }
  robe.push([cx + (dc.side ? 6 * k : c.shW), cy]);
  dc.blobS(robe, R.robe, U ? 3 : 2);
  // cloth structure: vertical folds, lit inner edges and animated sway at the hem (never a flat slab)
  for (let i = -3; i <= 3; i++) {
    const fx = hx + sw * 0.4 + i * hemW * 0.26, sway = Math.sin(f * 0.9 + i) * (U ? 2.2 : 1.1);
    dc.cur.line(fx, hy + 3 * k, fx + i * 1.5 + sway, hemY - 2 * k + (Math.abs(i) % 2), i % 2 ? R.robe[1] : R.robe[3]);
    if (i % 2 === 0) dc.cur.line(fx + 1, hy + 5 * k, fx + 1 + i * 1.5 + sway, hemY - 4 * k, R.robe[4]);
  }
  dc.cur.line(hx - hemW + sw, hemY - 1, hx + hemW + sw, hemY - 1, R.bronze[3]);
  dc.cur.line(hx - hemW + sw, hemY - 2, hx + hemW + sw, hemY - 2, R.time[2]);
  // ceremonial border glyphs down both front edges
  for (let y = hy + 5 * k; y < hemY - 3; y += 4 * k) { dc.layers.emit.set(hx - hemW * 0.55 + sw * 0.5, y, R.time[3]); dc.layers.emit.set(hx + hemW * 0.55 + sw * 0.5, y + 2, R.time[2]); }
  // ceremonial cloth strip with green glyph pixels (not clock faces)
  if (!dc.side) {
    dc.blobS([[hx - 2.5 * k, hy - 4 * k], [hx + 2.5 * k, hy - 4 * k], [hx + 2 * k + sw * 0.3, hemY - 1], [hx - 2 * k + sw * 0.3, hemY - 1]], R.bronze);
    for (let y = hy; y < hemY - 3; y += 3 * k) dc.layers.emit.set(hx + ((y >> 1) % 2 ? 1 : -1), y, tcol(1));
  }
  dc.cur.line(hx - c.hipW - 2 * k, hy - 4 * k, hx + c.hipW + 2 * k, hy - 4 * k, R.bronze[3]);
  // layered shoulder mantle + one bronze pauldron (asymmetry)
  dc.blobS([[cx - c.shW - 3 * k, cy + 4 * k], [cx - c.shW * 0.4, cy - 4 * k], [cx + c.shW * 0.4, cy - 4 * k], [cx + c.shW + 3 * k, cy + 4 * k], [cx, cy + 9 * k]], R.robe);
  dc.part((m) => m.oval(r.shW[0], r.shW[1] - 1, 4.5 * k, 3.5 * k, 1), R.bronze);
  dc.cur.set(r.shW[0], r.shW[1] - 1, tcol(2));
  // maned head with sharp bone face
  const [qx, qy] = r.head, hs = U ? 8 : 4;
  const mane: Pt[] = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.283, rr = (i % 2 ? hs * 1.35 : hs * 1.95) + (i === 3 ? hs * 0.3 : 0); mane.push([qx + Math.cos(a) * rr * (dc.side ? 0.85 : 1) - (dc.side ? r.fwd[0] * hs * 0.4 : 0), qy + Math.sin(a) * rr * 0.95 + hs * 0.3]); }
  dc.blobS(mane, R.mane, U ? 2 : 1);
  if (!dc.backv) {
    const fx = qx + (dc.side ? r.fwd[0] * hs * 0.5 : 0);
    if (dc.side) dc.blobS([[fx - r.fwd[0] * hs * 0.4, qy - hs * 0.7], [fx + r.fwd[0] * hs * 1.1, qy + hs * 0.2], [fx + r.fwd[0] * hs * 0.5, qy + hs * 1.1], [fx - r.fwd[0] * hs * 0.4, qy + hs * 0.8]], R.bone);
    else dc.blobS([[fx - hs * 0.8, qy - hs * 0.7], [fx + hs * 0.8, qy - hs * 0.7], [fx + hs * 0.45, qy + hs * 0.6], [fx, qy + hs * 1.3], [fx - hs * 0.45, qy + hs * 0.6]], R.bone);
    dc.L('emit');
    if (dc.side) dc.cur.rect(fx + r.fwd[0] * hs * 0.3, qy, U ? 2 : 1, 1, tcol(3));
    else { dc.cur.rect(fx - hs * 0.5, qy, U ? 3 : 2, 1, tcol(3)); dc.cur.rect(fx + hs * 0.5 - (U ? 2 : 1), qy, U ? 3 : 2, 1, tcol(3)); dc.layers.body.line(fx, qy + 2, fx, qy + hs * 0.8, R.bone[0]); }
    dc.L('body');
  }
  if (dc.front) { dc.limbS(r.shO[0], r.shO[1], r.elO[0], r.elO[1], 3 * k, 4 * k, R.robe); dc.limbS(r.elO[0], r.elO[1], r.handO[0], r.handO[1], 1.3 * k, 1.2 * k, R.bone); }
  if (!weaponBehind) scythe();
  dc.anchorScreen('core', cx, cy + 6 * k); dc.anchorScreen('head', qx, qy);
  dc.anchorScreen('footL', r.footL[0], r.footL[1]); dc.anchorScreen('footR', r.footR[0], r.footR[1]);
}
