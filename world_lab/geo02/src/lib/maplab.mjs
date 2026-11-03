// MAP-GEO-02: faithful pure-JS ports of the Map Lab Studio v3 geometry that
// produced Veyra. Every constant/algorithm below is traceable to the pinned
// verbatim source in ../source_excerpt; nothing is invented here.
//
// These are EDITOR/ANALYSIS semantics. They are NOT Gameplay passability laws,
// NOT a world-scale transform, and NOT physical swept-clearance dimensions.
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function projSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
  return { pt: [a[0] + dx * t, a[1] + dy * t], t };
}

export function nearestOnLine(pts, p, closed = false) {
  let best = { pt: pts[0], i: 0, t: 0, d: Infinity };
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], pr = projSeg(p, a, b), d = dist(p, pr.pt);
    if (d < best.d) best = { pt: pr.pt, i, t: pr.t, d };
  }
  return best;
}

/** geom.ts catmull(): control polyline -> smoothed polyline (source of every drawn road/river). */
export function catmull(pts) {
  if (pts.length < 3) return { pts: pts.slice(), idx: pts.map((_, i) => Math.min(i, Math.max(0, pts.length - 2))) };
  const out = [], idx = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const n = clamp(Math.ceil(dist(p1, p2) / 9), 2, 28);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
      idx.push(i);
    }
  }
  out.push(pts[pts.length - 1]);
  idx.push(pts.length - 2);
  return { pts: out, idx };
}

/** geom.ts resample(): arc-length resampling at `step` authoring units. */
export function resample(pts, step, idx) {
  if (pts.length < 2) return { pts: pts.slice(), idx: idx ? idx.slice() : [0] };
  const out = [pts[0]], oidx = [idx ? idx[0] : 0];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], seg = dist(a, b);
    if (seg === 0) continue;
    let pos = step - carry;
    while (pos <= seg) {
      const t = pos / seg;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      oidx.push(idx ? idx[i - 1] : 0);
      pos += step;
    }
    carry = seg - (pos - step);
  }
  const last = pts[pts.length - 1];
  if (dist(out[out.length - 1], last) > 0.01) { out.push(last); oidx.push(idx ? idx[idx.length - 1] : 0); }
  else out[out.length - 1] = last;
  return { pts: out, idx: oidx };
}

/** geom.ts segInt(): proper segment intersection. */
export function segInt(a, b, c, d) {
  const r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = d[0] - c[0], s1 = d[1] - c[1];
  const den = r0 * s1 - r1 * s0;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s1 - (c[1] - a[1]) * s0) / den;
  const u = ((c[0] - a[0]) * r1 - (c[1] - a[1]) * r0) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { p: [a[0] + r0 * t, a[1] + r1 * t], t, u };
}

export function pip(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
/** even-odd fill over several rings (canvas g.fill("evenodd")). */
export function pipRings(p, rings) {
  let n = 0;
  for (const r of rings) if (pip(p, r)) n++;
  return n % 2 === 1;
}

/** Analytic cell-centre reproduction of terrain.ts maskFromDraw() stroked paths.
 *  A cell centre is inside the stroked corridor iff its distance to the polyline
 *  (including round end caps) is <= width/2. Canvas antialiasing can differ by
 *  at most one boundary cell; this is documented in the audit output. */
export function strokeMask(gw, gh, cell, polylines, width) {
  const out = new Uint8Array(gw * gh);
  const r = width / 2, r2 = r * r;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const p = [(i + 0.5) * cell, (j + 0.5) * cell];
    let hit = false;
    for (const pts of polylines) {
      for (let k = 0; k < pts.length - 1 && !hit; k++) {
        const q = projSeg(p, pts[k], pts[k + 1]).pt;
        const dx = p[0] - q[0], dy = p[1] - q[1];
        if (dx * dx + dy * dy <= r2) hit = true;
      }
      if (!hit && pts[0] && pts[pts.length - 1]) {
        for (const q of [pts[0], pts[pts.length - 1]]) {
          const dx = p[0] - q[0], dy = p[1] - q[1];
          if (dx * dx + dy * dy <= r2) { hit = true; break; }
        }
      }
      if (hit) break;
    }
    out[j * gw + i] = hit ? 1 : 0;
  }
  return out;
}

export function landMask(p) {
  const t = p.terrain, out = new Uint8Array(t.gw * t.gh);
  for (let j = 0; j < t.gh; j++) for (let i = 0; i < t.gw; i++) {
    const q = [(i + 0.5) * t.cell, (j + 0.5) * t.cell];
    out[j * t.gw + i] = p.land.some(l => pipRings(q, l.rings)) ? 1 : 0;
  }
  return out;
}
export function lakeMask(p) {
  const t = p.terrain, out = new Uint8Array(t.gw * t.gh);
  for (let j = 0; j < t.gh; j++) for (let i = 0; i < t.gw; i++) {
    const q = [(i + 0.5) * t.cell, (j + 0.5) * t.cell];
    out[j * t.gw + i] = p.lakes.some(l => pip(q, l.ring)) ? 1 : 0;
  }
  return out;
}
const smooth = r => catmull(r.points).pts;
export function riverMask(p, minAu = 9) { return perRiverMask(p, minAu); }
function perRiverMask(p, minAu) {
  const t = p.terrain, out = new Uint8Array(t.gw * t.gh);
  for (const r of p.rivers) {
    const m = strokeMask(t.gw, t.gh, t.cell, [smooth(r)], Math.max(r.width, minAu));
    for (let k = 0; k < out.length; k++) out[k] |= m[k];
  }
  return out;
}
export function roadFootMask(p, widthAu = 9) {
  return strokeMask(p.terrain.gw, p.terrain.gh, p.terrain.cell,
    p.roads.filter(r => r.kind !== 'ferry').map(smooth), widthAu);
}
export function roadCartMask(p, widthAu = 9) {
  return strokeMask(p.terrain.gw, p.terrain.gh, p.terrain.cell,
    p.roads.filter(r => r.kind === 'cart').map(smooth), widthAu);
}

/** terrain.ts chamfer(): chamfer distance transform in authoring units. */
export function chamfer(src, gw, gh, cell) {
  const INF = 1e9, d = new Float32Array(gw * gh);
  for (let i = 0; i < d.length; i++) d[i] = src[i] ? 0 : INF;
  const W1 = 1, W2 = Math.SQRT2;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const k = j * gw + i; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + W1);
    if (j > 0) { v = Math.min(v, d[k - gw] + W1); if (i > 0) v = Math.min(v, d[k - gw - 1] + W2); if (i < gw - 1) v = Math.min(v, d[k - gw + 1] + W2); }
    d[k] = v;
  }
  for (let j = gh - 1; j >= 0; j--) for (let i = gw - 1; i >= 0; i--) {
    const k = j * gw + i; let v = d[k];
    if (i < gw - 1) v = Math.min(v, d[k + 1] + W1);
    if (j < gh - 1) { v = Math.min(v, d[k + gw] + W1); if (i < gw - 1) v = Math.min(v, d[k + gw + 1] + W2); if (i > 0) v = Math.min(v, d[k + gw - 1] + W2); }
    d[k] = v;
  }
  for (let i = 0; i < d.length; i++) d[i] = d[i] >= INF ? 99999 : d[i] * cell;
  return d;
}

/** analysis.ts computeFields(): normalized elevation + relative steepness index. */
export function computeFields(p) {
  const t = p.terrain, gw = t.gw, gh = t.gh, cell = t.cell, n = gw * gh;
  const elev = Uint8Array.from(Buffer.from(t.elev, 'base64'));
  const biome = Uint8Array.from(Buffer.from(t.biome, 'base64'));
  const e = new Float32Array(n);
  for (let k = 0; k < n; k++) e[k] = elev[k] / 255;
  const slope = new Float32Array(n);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(gw - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(gh - 1, j + 1);
    const dx = (e[j * gw + i1] - e[j * gw + i0]) / ((i1 - i0) * cell);
    const dy = (e[j1 * gw + i] - e[j0 * gw + i]) / ((j1 - j0) * cell);
    slope[j * gw + i] = Math.hypot(dx, dy) * 100;
  }
  return { gw, gh, cell, elev, biome, e, slope };
}

export const cellOf = (p, q) => clamp(Math.floor(q[1] / p.terrain.cell), 0, p.terrain.gh - 1) * p.terrain.gw
  + clamp(Math.floor(q[0] / p.terrain.cell), 0, p.terrain.gw - 1);
export const cellCenter = (p, k) => [((k % p.terrain.gw) + 0.5) * p.terrain.cell, (Math.floor(k / p.terrain.gw) + 0.5) * p.terrain.cell];

/** analysis.ts stepMult(): EDITOR heuristic terrain cost, never a Gameplay law. */
export function stepMult(fields, masks, k, mode, sem) {
  const { RULES, FOOT_B, CART_B } = sem;
  if (!masks.land[k] || masks.lake[k]) return Infinity;
  const s = fields.slope[k], b = fields.biome[k];
  let m;
  if (mode === 'cart') { if (s > RULES.cartSlopeMax) return Infinity; m = (1 + 7 * (s / 0.45) ** 2) * CART_B[b]; }
  else { if (s > RULES.footSlopeMax) return Infinity; m = (1 + 2.5 * (s / 0.6) ** 2) * FOOT_B[b]; }
  if (masks.river[k]) m += mode === 'cart' ? 80 : 50;
  if (mode === 'cart' && masks.roadCart[k]) m *= 0.3;
  else if (mode === 'foot') { if (masks.roadCart[k]) m *= 0.3; else if (masks.roadFoot[k]) m *= 0.4; }
  return m;
}

/** 8-neighbour Dijkstra over the raster using MapLab's own stepMult heuristic. */
export function rasterDijkstra(p, fields, masks, sem, from, to, mode) {
  const gw = fields.gw, gh = fields.gh, n = gw * gh;
  const s = cellOf(p, from), t = cellOf(p, to);
  const g = new Float32Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const heap = [[0, s]]; g[s] = 0;
  const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let m = i, l = 2 * i + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (heap.length) {
    const [c, k] = pop();
    if (done[k]) continue; done[k] = 1;
    if (k === t) break;
    const x = k % gw, y = Math.floor(k / gw);
    for (const [dx, dy] of NB) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
      const nk = ny * gw + nx;
      const mult = stepMult(fields, masks, nk, mode, sem);
      if (!Number.isFinite(mult)) continue;
      const w = (dx && dy ? Math.SQRT2 : 1) * fields.cell * mult;
      if (c + w < g[nk]) { g[nk] = c + w; prev[nk] = k; push([c + w, nk]); }
    }
  }
  if (!Number.isFinite(g[t])) return { connected: false, costAu: null, cells: [], minClearanceAu: null };
  const cells = []; for (let k = t; k !== -1; k = prev[k]) { cells.push(k); if (k === s) break; }
  cells.reverse();
  return { connected: true, costAu: +g[t].toFixed(4), cells, steps: cells.length - 1 };
}
