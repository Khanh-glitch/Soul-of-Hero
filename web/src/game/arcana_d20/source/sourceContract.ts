// ============================================================================
// Source-contribution contract — ONE reusable mechanism for semantic fusion.
//
// A recipe component declares `extract: 'arc' | 'light'` and a role. The engine:
//  - 'arc': captures the source spell's AUTHORED bolt draw events (polyline +
//    probed core/halo light, see CRunner.extractArcs), then REMAPS each arc's
//    endpoints onto the LEAD spell's MOVING anchors (e.g. A#11 ring connectors)
//    and replays the geometry with the lead engine's own line primitive.
//    No complete source imagery is composited; no decorative extra arcs.
//  - 'light': the source spell's pure HDR LIGHT channel on a black world,
//    added into the lead frame's light buffer (never an RGB frame delta).
// ============================================================================
import type { ArcPacket } from './cRunner';
import type { Framebuffer } from './a/engine/framebuffer';
import { line } from './a/engine/draw';
import { clamp } from './a/engine/math';

export interface Contribution {
  arcs?: ArcPacket[];
  light?: Float32Array; // W*H*3 HDR light channel of the secondary source
  lightW?: number; lightH?: number;
  anchorSkillId?: number; // lead skill whose moving anchors bind the arcs
}

/** Capability declaration: which source semantics the contract preserves.
 *  ink / displacement / masks / fragments are NOT supported by the current
 *  adapters and must never be silently approximated as RGB imagery. */
export const CAPABILITIES = {
  signedHdrLight: true,   // light channel added signed (incl. negative-only)
  arcPackets: true,       // authored bolt draw events, remapped to anchors
  ink: false, displacement: false, mask: false, fragments: false, fullScene: false,
} as const;

/** similarity-transform an arc's authored polyline so its endpoints land on
 *  moving anchors a→b (translate + rotate + uniform scale, shape preserved).
 *  FAIL CLOSED on a degenerate pair — never map both endpoints to one point. */
export function remapArc(p: ArcPacket, a: { x: number; y: number }, b: { x: number; y: number }) {
  const pts = p.pts;
  if (pts.length < 2) throw new Error('remapArc: arc packet has fewer than 2 points');
  if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-3) throw new Error('remapArc: degenerate anchor pair (both endpoints identical)');
  const p0 = pts[0], p1 = pts[pts.length - 1];
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = b.x - a.x, uy = b.y - a.y;
  const nl = Math.hypot(ux, uy) || 1;
  const s = nl / len;
  const cos = (dx * ux + dy * uy) / (len * nl);
  const sin = (dx * uy - dy * ux) / (len * nl);
  return pts.map(q => {
    const rx = q.x - p0.x, ry = q.y - p0.y;
    return { x: a.x + (rx * cos - ry * sin) * s, y: a.y + (rx * sin + ry * cos) * s };
  });
}

const norm = (c: [number, number, number]): [number, number, number] => {
  const m = Math.max(c[0], c[1], c[2], 1e-6);
  return [c[0] / m, c[1] / m, c[2] / m];
};

/** Replay one remapped arc into the lead A framebuffer using A's own line(). */
export function drawArc(fb: Framebuffer, p: ArcPacket, a: { x: number; y: number }, b: { x: number; y: number }) {
  const pts = remapArc(p, a, b);
  const core = norm(p.core), halo = norm(p.halo);
  const kc = Math.max(p.core[0], p.core[1], p.core[2]);
  const kh = Math.max(p.halo[0], p.halo[1], p.halo[2]);
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i].x, y0 = pts[i].y, x1 = pts[i + 1].x, y1 = pts[i + 1].y;
    line(fb, x0, y0, x1, y1, halo, clamp(kh, 0, 4) * 0.5);
    line(fb, x0, y0, x1, y1, core, clamp(kc, 0, 4));
  }
}

/** Apply a whole contribution set to the lead framebuffer. */
export function applyContribution(fb: Framebuffer, c: Contribution, anchors: { x: number; y: number }[]) {
  if (c.arcs && c.arcs.length) {
    if (anchors.length < 2) throw new Error('applyContribution: arc contribution requires >= 2 distinct anchors');
    const n = anchors.length;
    c.arcs.forEach((p, i) => {
      drawArc(fb, p, anchors[(2 * i) % n], anchors[(2 * i + 1) % n]);
    });
  }
  if (c.light && c.lightW && c.lightH) {
    const W = fb.W, H = fb.H;
    const ox = Math.round((W - c.lightW) / 2), oy = Math.round((H - c.lightH) / 2);
    for (let y = 0; y < c.lightH; y++) {
      const ty = y + oy; if (ty < 0 || ty >= H) continue;
      for (let x = 0; x < c.lightW; x++) {
        const tx = x + ox; if (tx < 0 || tx >= W) continue;
        const si = (y * c.lightW + x) * 3, di = (ty * W + tx) * 3;
        // signed HDR light preserved — negative-only samples darken, not skipped
        const r = c.light[si], g = c.light[si + 1], b = c.light[si + 2];
        fb.buf[di] += r; fb.buf[di + 1] += g; fb.buf[di + 2] += b;
      }
    }
  }
}
