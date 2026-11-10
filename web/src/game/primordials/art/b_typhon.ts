import { DC, R } from './kit';
import { rig, RigCfg } from './rig';
import type { Pt } from './raster';

// PURPLE / TYPHON — barrel-chested hunched brute, articulated colossal fists, two living serpent tails, compact wings.
export function drawTyphon(dc: DC) {
  const U = dc.ult, p = dc.p, f = dc.f;
  const c: RigCfg = U
    ? { leg: 30, torso: 46, neck: -6, hipW: 14, shW: 40, arm: 54, stance: 22, bend: 7 }
    : { leg: 15, torso: 23, neck: -3, hipW: 7, shW: 19, arm: 25, stance: 10, bend: 4 };
  const r = rig(dc, c);
  const G = p.glow ?? 0.2;
  const [cx, cy] = r.chest, [hx, hy] = r.hip;
  dc.order = ['back', 'body', 'weapon', 'emit'];
  const k = U ? 2.1 : 1;

  const tail = (sgn: number, lash: number, a0: number, seed: number) => {
    const sx = dc.side ? -r.fwd[0] : sgn;
    let x = hx + (dc.side ? -r.fwd[0] * 3 * k : sgn * c.hipW * 0.4), y = hy - 3 * k;
    let a = a0 - Math.max(0, -lash) * 0.4;
    const n = U ? 13 : 10, segL = (U ? 7.5 : 3.6) * (1 + 0.35 * Math.max(0, lash));
    let rad = U ? 7 : 3.2;
    const pts: Pt[] = [[x, y]];
    for (let i = 0; i < n; i++) {
      const curl = 0.2 + lash * 0.1 + (lash < 0 ? -lash * 0.25 : 0) + Math.sin((f + i + seed) * 0.9) * 0.05;
      const nx = x + sx * Math.cos(a) * segL, ny = y + Math.sin(a) * segL;
      dc.limbS(x, y, nx, ny, rad, rad * 0.9, R.scale);
      if (i % 2 === 0) dc.cur.set((x + nx) / 2, (y + ny) / 2 + rad * 0.5, R.belly[1]);
      if (i % 3 === 1) dc.cur.set((x + nx) / 2 - sx, (y + ny) / 2 - rad * 0.4, R.scale[4]);
      x = nx; y = ny; a += curl; rad = Math.max(U ? 2.2 : 1.1, rad * 0.9); pts.push([x, y]);
    }
    // serpent head with fangs and force eye
    const hr = U ? 5.5 : 2.6, hdx = x + sx * Math.cos(a) * hr, hdy = y + Math.sin(a) * hr;
    dc.part((m) => m.oval(hdx, hdy, hr * 1.3, hr, 1), R.scale);
    dc.layers.emit.set(hdx + sx * hr * 0.3, hdy - hr * 0.4, R.force[4]);
    dc.cur.set(hdx + sx * hr * 1.3, hdy + hr * 0.6, R.claw[2]); if (U) dc.cur.set(hdx + sx * hr * 1.1, hdy + hr * 0.9, R.claw[2]);
    dc.anchorScreen(sgn < 0 ? 'tailA' : 'tailB', hdx, hdy);
    return pts;
  };
  const wings = () => {
    const wo = 0.35 + (p.wing || 0) * 0.65;
    for (const sgn of dc.side ? [-r.fwd[0]] : [-1, 1]) {
      const bx = cx + sgn * c.shW * 0.55, by = cy + 2 * k;
      if (dc.front) {
        // FRONT VIEW: wings are read as low, wide, scalloped masses at the shoulders. Vertical tips
        // behind a round head made Typhon look like a cat; these stay below head height.
        const tip: Pt = [bx + sgn * (11 + 11 * wo) * k, by + (2 + 2 * wo) * k];
        dc.blobS([[bx, by - 2 * k], [bx + sgn * 6 * k, by - 4 * k], [tip[0] * 0.82 + bx * 0.18, by - 1 * k], tip, [bx + sgn * (8 + 8 * wo) * k, by + 6 * k], [bx + sgn * 4 * k, by + 7 * k]], R.hide);
        dc.cur.line(bx, by, tip[0], tip[1], R.plate[3]);
        for (let i2 = 1; i2 <= 3; i2++) { const u = i2 / 4; dc.cur.line(bx + sgn * 4 * k, by + 3 * k, bx + sgn * (6 + 8 * wo) * k * u + tip[0] * (1 - u), by + (4 + 2 * wo) * k + (tip[1] - by) * u * 0.4, R.plate[2]); }
      } else {
        const tip: Pt = [bx + sgn * (10 + 16 * wo) * k, by - (8 + 10 * wo) * k];
        dc.blobS([[bx, by], tip, [bx + sgn * (8 + 10 * wo) * k, by - 2 * k], [bx + sgn * (9 + 12 * wo) * k, by + 5 * k], [bx + sgn * 4 * k, by + 6 * k]], R.hide);
        dc.cur.line(bx, by, tip[0], tip[1], R.plate[3]);
        dc.cur.line(bx, by, bx + sgn * (9 + 12 * wo) * k, by + 5 * k, R.plate[2]);
      }
    }
  };;
  const fist = (sh: Pt, el: Pt, hd: Pt, open: number, power = 0.5) => {
    // Foreshortening by authored anatomy, not runtime sprite scaling: the forearm thickens and the
    // hand gains mass as reach approaches contact. The elbow also bows out on the power line.
    const ex = el[0] + (hd[0] - sh[0]) * Math.max(0, power - 0.55) * 0.12;
    const ey = el[1] + (hd[1] - sh[1]) * Math.max(0, power - 0.55) * 0.08;
    dc.limbS(sh[0], sh[1], ex, ey, (4 + power * 1.1) * k, (4.5 + power * 0.8) * k, R.hide, U ? 2 : 1);
    dc.limbS(ex, ey, hd[0], hd[1], (5 + power * 1.6) * k, (6.5 + power * 2.4) * k, R.plate, U ? 2 : 1);
    dc.cur.line(el[0], el[1] - 1, (el[0] + hd[0]) / 2, (el[1] + hd[1]) / 2 - 1, R.plate[0]); // plate seam
    const fr = (U ? 11 : 5.2) * (0.82 + Math.max(0.2, power) * 0.42);
    const dx = hd[0] - el[0], dy = hd[1] - el[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    if (open > 0.5) {
      for (let i = -2; i <= 2; i++) { const a = Math.atan2(uy, ux) + i * 0.42; dc.limbS(hd[0], hd[1], hd[0] + Math.cos(a) * fr * 1.6, hd[1] + Math.sin(a) * fr * 1.6, U ? 2.6 : 1.2, U ? 2 : 1, R.hide); dc.cur.set(hd[0] + Math.cos(a) * fr * 1.75, hd[1] + Math.sin(a) * fr * 1.75, R.claw[2]); }
      dc.part((m) => m.disc(hd[0], hd[1], fr * 0.8, 1), R.plate);
    } else {
      dc.part((m) => m.disc(hd[0], hd[1], fr, 1), R.plate, U ? 2 : 1);
      for (let i = -1; i <= 2; i++) { const kx = hd[0] + ux * fr * 0.8 - uy * i * fr * 0.4, ky = hd[1] + uy * fr * 0.8 + ux * i * fr * 0.4; dc.cur.set(kx, ky, R.claw[1]); if (U) dc.cur.set(kx + ux, ky + uy, R.claw[2]); }
    }
    if (G > 0.45) { dc.L('emit'); const n = U ? 22 : 14; for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + f * 0.5; if ((i + f) % 4 === 0) continue; dc.cur.set(hd[0] + Math.cos(a) * (fr + 1.5), hd[1] + Math.sin(a) * (fr + 1.5), i % 2 ? R.force[4] : R.force[3]); if (i % 3 === 0) dc.cur.set(hd[0] + Math.cos(a) * (fr + 3.5), hd[1] + Math.sin(a) * (fr + 3.5), R.force[2]); }
      for (let i = -1; i <= 2; i++) dc.cur.set(hd[0] + ux * (fr + 1) - uy * i * fr * 0.4, hd[1] + uy * (fr + 1) + ux * i * fr * 0.4, G > 0.6 ? R.force[5] : R.force[4]); dc.L('body'); }
    return hd;
  };

  // back layer: tails & wings (behind in front/side; tails over body in back view)
  dc.L(dc.backv ? 'body' : 'back');
  if (!dc.backv) { wings(); tail(-1, p.tailA || 0, -0.5, 1); tail(1, p.tailB || 0, dc.side ? 0.25 : -0.5, 5); }
  dc.L('body');
  const legs = () => {
    for (const [h, kn, ft] of [[r.hipL, r.kneeL, r.footL], [r.hipR, r.kneeR, r.footR]] as Pt[][]) {
      dc.limbS(h[0], h[1], kn[0], kn[1], 4.8 * k, 4 * k, R.hide, U ? 2 : 1);
      dc.limbS(kn[0], kn[1], ft[0], ft[1] - 2, 4 * k, 3 * k, R.plate);
      dc.blobS([[ft[0] - 4 * k, ft[1] - 3 * k], [ft[0] + 4 * k, ft[1] - 3 * k], [ft[0] + 5 * k, ft[1]], [ft[0] - 5 * k, ft[1]]], R.plate);
      for (let i = -1; i <= 1; i++) dc.cur.set(ft[0] + i * 3 * k + (dc.side ? r.fwd[0] * 4 * k : 0), ft[1], R.claw[2]);
    }
  };
  const armsBehind = dc.backv;
  if (armsBehind) { fist(r.shW, r.elW, r.handW, p.hands || 0, p.reach ?? 0.5); fist(r.shO, r.elO, r.handO, p.hands || 0, p.offReach ?? 0.5); }
  else if (dc.side) fist(r.shO, r.elO, r.handO, p.hands || 0, p.offReach ?? 0.5);
  legs();
  // loin plates
  dc.blobS([[hx - c.hipW * 1.3, hy - 3 * k], [hx + c.hipW * 1.3, hy - 3 * k], [hx + c.hipW * 0.8, hy + 6 * k], [hx - c.hipW * 0.8, hy + 6 * k]], R.plate);
  // barrel chest
  // Chest compresses during wind-up and opens at contact. This changes the silhouette itself;
  // Typhon no longer looks like a static barrel with arms swapped between frames.
  const thrust = Math.max(p.reach ?? 0.5, p.offReach ?? 0.5), compression = Math.max(0, p.crouch ?? 0);
  const bw = (dc.side ? c.shW * 0.62 : c.shW * 0.92) * (0.92 + thrust * 0.12 + Math.abs(p.twist ?? 0) * 0.04);
  const bh = c.torso * 0.62 * (1 - compression * 0.12 + Math.max(0, thrust - 0.7) * 0.08);
  const bcx = cx + (dc.side ? r.fwd[0] * 2 * k : 0), bcy = cy + c.torso * 0.36;
  dc.part((m) => m.oval(bcx, bcy, bw, bh, 1), R.plate, U ? 3 : 2);
  dc.part((m) => m.oval(bcx + (dc.side ? r.fwd[0] * bw * 0.35 : 0), bcy + bh * 0.45, bw * (dc.side ? 0.5 : 0.62), bh * 0.42, 1), R.hide);
  if (dc.front) { // pectoral plates & cracks
    dc.part((m) => { m.oval(bcx - bw * 0.42, bcy - bh * 0.3, bw * 0.42, bh * 0.32, 1); }, R.plate);
    dc.part((m) => { m.oval(bcx + bw * 0.42, bcy - bh * 0.3, bw * 0.42, bh * 0.32, 1); }, R.plate);
    dc.cur.line(bcx, bcy - bh * 0.6, bcx, bcy + bh * 0.2, R.plate[0]);
    for (let i = 0; i < (U ? 4 : 2); i++) dc.cur.line(bcx - bw * 0.2 * i - 2, bcy + bh * 0.25 + i * 3, bcx - bw * 0.2 * i - 5, bcy + bh * 0.35 + i * 3, R.hide[0]);
    if (G > 0.3) { dc.layers.emit.set(bcx, bcy - bh * 0.1, R.force[3]); dc.layers.emit.line(bcx - 1, bcy, bcx + 1, bcy, R.force[2]); }
  } else if (dc.backv) {
    for (let i = 0; i < (U ? 6 : 4); i++) dc.part((m) => m.disc(bcx, bcy - bh * 0.7 + i * bh * 0.32, (U ? 4 : 2) - i * 0.2, 1), R.plate);
    dc.L('body'); wings(); tail(-1, p.tailA || 0, -0.5, 1); tail(1, p.tailB || 0, -0.5, 5);
  } else {
    for (let i = 0; i < 3; i++) dc.cur.line(bcx - r.fwd[0] * bw * 0.3, bcy - bh * 0.5 + i * bh * 0.4, bcx + r.fwd[0] * bw * 0.4, bcy - bh * 0.45 + i * bh * 0.4, R.plate[1]);
  }
  // shoulder masses
  const shm = (s: Pt) => dc.part((m) => { m.oval(s[0], s[1] + 1, 7 * k, 6 * k, 1); }, R.plate, U ? 2 : 1);
  if (dc.side) shm(r.shW); else { shm(r.shW); shm(r.shO); }
  // hunched head with forward horns
  const [qx, qy] = r.head, hs = U ? 9 : 4.5;
  const hdx = qx + (dc.side ? r.fwd[0] * hs * 0.6 : 0), hdy = qy + (dc.front ? 2 : 0);
  dc.part((m) => m.oval(hdx, hdy, dc.side ? hs * 1.2 : hs, hs * 0.9, 1), R.hide, U ? 2 : 1);
  dc.part((m) => m.oval(hdx, hdy - hs * 0.45, dc.side ? hs : hs * 1.1, hs * 0.35, 1), R.plate);
  // Swept BACK and outward, not vertical: two upright triangles on a round head read as cat ears.
  // Asymmetric too — the right horn is broken short, which kills the mirror symmetry.
  const horn = (sx: number, sgn: number, len: number) => {
    let x = sx, y = hdy + hs * 0.05, a = sgn * (0.12 + (len > 3 ? 0.05 : 0.22)), rr = U ? 3.8 : 2.1;
    for (let i = 0; i < len; i++) { const nx = x + Math.cos(a) * hs * 0.42, ny = y + Math.sin(a) * hs * 0.42; dc.limbS(x, y, nx, ny, rr, rr * 0.78, R.claw); x = nx; y = ny; a += sgn * 0.42; rr *= 0.8; }
    dc.cur.set(x, y, R.claw[1]);
  };
  if (dc.side) horn(hdx + r.fwd[0] * hs * 0.35, r.fwd[0] * 0.9, 3); else { horn(hdx - hs * 0.95, -1, 3); horn(hdx + hs * 0.95, 1, 2); }
  dc.L('emit');
  if (dc.front) { dc.cur.rect(hdx - hs * 0.55, hdy, U ? 3 : 2, 1, R.force[G > 0.5 ? 5 : 4]); dc.cur.rect(hdx + hs * 0.55 - (U ? 2 : 1), hdy, U ? 3 : 2, 1, R.force[G > 0.5 ? 5 : 4]); for (let i = -1; i <= 1; i += 2) dc.layers.body.set(hdx + i * hs * 0.35, hdy + hs * 0.8, R.claw[2]); }
  else if (dc.side) dc.cur.rect(hdx + r.fwd[0] * hs * 0.6, hdy, U ? 2 : 1, 1, R.force[4]);
  dc.L('body');
  if (dc.front) { fist(r.shW, r.elW, r.handW, p.hands || 0, p.reach ?? 0.5); fist(r.shO, r.elO, r.handO, p.hands || 0, p.offReach ?? 0.5); }
  else if (dc.side) fist(r.shW, r.elW, r.handW, p.hands || 0, p.reach ?? 0.5);
  dc.anchorScreen('hand', r.handW[0], r.handW[1]); dc.anchorScreen('handO', r.handO[0], r.handO[1]);
  dc.anchorScreen('weaponTip', r.handW[0], r.handW[1]); dc.anchorScreen('core', bcx, bcy);
  dc.anchorScreen('head', hdx, hdy); dc.anchorScreen('footL', r.footL[0], r.footL[1]); dc.anchorScreen('footR', r.footR[0], r.footR[1]);
}
