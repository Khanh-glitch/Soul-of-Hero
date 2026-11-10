import { DC, Dir, wScreen } from './kit';
import type { Pt } from './raster';
export type { Pt };

export function wOff(dir: Dir, phi: number) {
  switch (dir) {
    case 'right': return phi;
    case 'left': return Math.PI - phi;
    case 'down': return Math.PI / 2 + phi;
    case 'up': return phi >= -Math.PI / 2 ? -Math.PI / 2 + phi : -1.5 * Math.PI - phi;
  }
}
export const FWD: Record<Dir, Pt> = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

export interface RigCfg { leg: number; torso: number; neck: number; hipW: number; shW: number; arm: number; stance: number; bend?: number }
export interface Rig {
  fwd: Pt; hip: Pt; chest: Pt; head: Pt; shW: Pt; shO: Pt; elW: Pt; elO: Pt; handW: Pt; handO: Pt;
  hipL: Pt; hipR: Pt; kneeL: Pt; kneeR: Pt; footL: Pt; footR: Pt; wAng: number; oAng: number; uW: Pt; drop: number;
}

export function rig(dc: DC, c: RigCfg): Rig {
  const p = dc.p, dir = dc.dir, fwd = FWD[dir];
  const cr = p.crouch || 0, kn = p.kneel || 0, fa = p.fall || 0, lean = p.lean || 0;
  const drop = c.leg * (0.25 * cr + 0.45 * kn + 0.25 * fa) + (p.bob || 0);
  const hx = dc.ox + fwd[0] * lean * 0.5, hy = dc.oy - c.leg + drop + fwd[1] * lean * 0.2;
  const tl = c.torso * (1 - 0.12 * kn);
  const chest: Pt = [hx + fwd[0] * (lean * 0.8 + fa * c.torso * 0.7), hy - tl + Math.abs(fwd[1]) * fa * c.torso * 0.45 + fwd[1] * lean * 0.25 + (dc.side ? fa * c.torso * 0.35 : 0)];
  const head: Pt = [chest[0] + fwd[0] * (lean * 0.25 + fa * 3), chest[1] - c.neck + (p.head || 0) + fa * c.neck * 0.8];
  // shoulders
  const tw = p.twist || 0;
  let shW: Pt, shO: Pt;
  if (dir === 'down') { shW = [chest[0] - c.shW, chest[1] + tw * 2]; shO = [chest[0] + c.shW, chest[1] - tw * 2]; }
  else if (dir === 'up') { shW = [chest[0] + c.shW, chest[1] + tw * 2]; shO = [chest[0] - c.shW, chest[1] - tw * 2]; }
  else { shW = [chest[0] - fwd[0] * (1 + tw * 3), chest[1] + 1]; shO = [chest[0] + fwd[0] * (1 + tw * 2), chest[1] - 1]; }
  const wAng = wScreen(dir, p.wA ?? 0.9), oAng = wOff(dir, p.wB ?? 0.9);
  const uW: Pt = [Math.cos(wAng), Math.sin(wAng)];
  const handW: Pt = [shW[0] + uW[0] * c.arm * (0.6 + 0.4 * (p.reach ?? 0.5)), shW[1] + uW[1] * c.arm * (0.6 + 0.4 * (p.reach ?? 0.5))];
  let handO: Pt;
  if (p.grip2) handO = [handW[0] - uW[0] * 3, handW[1] - uW[1] * 3];
  else handO = [shO[0] + Math.cos(oAng) * c.arm * (0.6 + 0.4 * (p.offReach ?? 0.5)), shO[1] + Math.sin(oAng) * c.arm * (0.6 + 0.4 * (p.offReach ?? 0.5))];
  const bend = c.bend ?? 3;
  const elbow = (a: Pt, b: Pt, out: number): Pt => {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L; if (ny < 0) { nx = -nx; ny = -ny; }
    const reachF = Math.max(0, 1 - L / (c.arm * 1.05));
    return [mx + nx * bend * reachF * 2 + out * reachF * 2, my + ny * bend * reachF * 2];
  };
  const elW = elbow(shW, handW, dir === 'down' ? -1 : dir === 'up' ? 1 : 0);
  const elO = elbow(shO, handO, dir === 'down' ? 1 : dir === 'up' ? -1 : 0);
  // legs / feet (planted: feet are placed in ground space, hips move above them)
  const legL = p.legL || 0, legR = p.legR || 0, liftL = p.liftL || 0, liftR = p.liftR || 0, sp = c.stance + (p.spread || 0);
  let footL: Pt, footR: Pt, hipL: Pt, hipR: Pt;
  if (dc.side) {
    footL = [dc.ox + fwd[0] * legL - fwd[0] * 1, dc.oy - liftL];
    footR = [dc.ox + fwd[0] * legR + fwd[0] * 1, dc.oy - liftR];
    if (kn > 0) footR = [dc.ox - fwd[0] * (c.leg * 0.5 * kn), dc.oy];
    hipL = [hx - fwd[0], hy]; hipR = [hx + fwd[0], hy];
  } else {
    const fy = fwd[1];
    footL = [dc.ox - sp, dc.oy + fy * legL * 0.4 - liftL];
    footR = [dc.ox + sp, dc.oy + fy * legR * 0.4 - liftR];
    if (kn > 0) footR = [footR[0], dc.oy - fy * kn * 3];
    hipL = [hx - c.hipW, hy]; hipR = [hx + c.hipW, hy];
  }
  const knee = (h: Pt, f: Pt, side: number, kneeling: boolean): Pt => {
    const mx = (h[0] + f[0]) / 2, my = (h[1] + f[1]) / 2;
    const L = Math.hypot(f[0] - h[0], f[1] - h[1]), slack = Math.max(0, c.leg - L);
    if (kneeling) return [dc.side ? mx + fwd[0] * 3 : mx + side, dc.oy - 2];
    if (dc.side) return [mx + fwd[0] * (1 + slack * 0.9), my - slack * 0.2];
    return [mx + side * (0.6 + slack * 0.5), my + fwd[1] * slack * 0.3];
  };
  const kneeL = knee(hipL, footL, -1, false), kneeR = knee(hipR, footR, 1, kn > 0.5);
  dc.anchorScreen('shoulderW', shW[0], shW[1]);
  return { fwd, hip: [hx, hy], chest, head, shW, shO, elW, elO, handW, handO, hipL, hipR, kneeL, kneeR, footL, footR, wAng, oAng, uW, drop };
}

export function along(a: Pt, u: Pt, d: number): Pt { return [a[0] + u[0] * d, a[1] + u[1] * d]; }
export function perp(u: Pt): Pt { return [-u[1], u[0]]; }
export function weaponLen(dc: DC, ang: number, len: number) {
  return dc.side ? len : len * (1 - 0.22 * Math.abs(Math.sin(ang)));
}
