// MAP-GEO-01 deterministic geometry helpers. Pure functions only: no rendering,
// no gameplay, no coordinate rescaling. All coordinates stay in Veyra authoring
// units (project.world = 2000 x 1400).
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const round = (v, n = 4) => +v.toFixed(n);

/** Even-odd point-in-ring. A ring is an array of [x,y] authoring points. */
export function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (((a[1] > pt[1]) !== (b[1] > pt[1])) &&
        (pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside;
  }
  return inside;
}

/** `rings[0]` is the outer boundary; any further rings are holes. */
export function pointInPolygon(pt, rings) {
  if (!rings || !rings.length || !pointInRing(pt, rings[0])) return false;
  for (let k = 1; k < rings.length; k++) if (pointInRing(pt, rings[k])) return false;
  return true;
}

/** Closed ring only (`ring` of a lake / zone / POI foot / Elder area). */
export function pointInClosedRing(pt, ring) { return pointInRing(pt, ring); }

export function ringBBox(ring) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of ring) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return [x0, y0, x1, y1];
}

export function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(a) / 2;
}

export function ringSignedArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return a / 2;
}

export function ringPerimeter(ring) {
  let L = 0;
  for (let i = 0; i < ring.length; i++) L += dist(ring[i], ring[(i + 1) % ring.length]);
  return L;
}

export function ringCentroid(ring) {
  const A = ringSignedArea(ring);
  if (Math.abs(A) < 1e-9) {
    let x = 0, y = 0; for (const p of ring) { x += p[0]; y += p[1]; }
    return [x / ring.length, y / ring.length];
  }
  let cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
  }
  return [cx / (6 * A), cy / (6 * A)];
}

/** Shortest distance from point to a finite segment. */
export function segDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Point -> open polyline. */
export function pathDistance(p, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, segDistance(p, pts[i], pts[i + 1]));
  return pts.length === 1 ? dist(p, pts[0]) : best;
}

/** Point -> closed ring boundary. */
export function ringBoundaryDistance(p, ring) {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) best = Math.min(best, segDistance(p, ring[i], ring[(i + 1) % ring.length]));
  return best;
}

export function pathLength(pts) {
  let L = 0; for (let i = 0; i < pts.length - 1; i++) L += dist(pts[i], pts[i + 1]);
  return L;
}

/** Proper (non-endpoint) segment intersection point, or null. */
export function segmentIntersection(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const qp = [c[0] - a[0], c[1] - a[1]];
  const t = (qp[0] * s[1] - qp[1] * s[0]) / den;
  const u = (qp[0] * r[1] - qp[1] * r[0]) / den;
  if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
  return [a[0] + t * r[0], a[1] + t * r[1]];
}

/** Sample a polyline at a fixed authoring-unit spacing; always includes the last point. */
export function samplePath(pts, stepAu) {
  if (pts.length < 2) return pts.map(p => [p[0], p[1]]);
  const out = [[pts[0][0], pts[0][1]]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = dist(a, b);
    const n = Math.max(1, Math.ceil(L / stepAu));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}

export const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
