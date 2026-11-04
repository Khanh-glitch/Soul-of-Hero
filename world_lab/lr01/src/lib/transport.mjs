// MAP-LR01 Milestone C — verified MapLab transport graph rederivation.
// Ported semantics from world_lab/geo02/source_excerpt/{graph.ts,geom.ts}
// (verbatim source excerpt with SHA256SUMS). SNAP_TOL=7 is the EDITOR value.
// GEO-01's joinToleranceAu=8 is a DEFECT: resample(...,8) + Idx.key(8)
// self-merges consecutive samples and drops road edges. We reproduce both so
// the defect is visible, but ONLY tol=7 is used for transport conclusions.
// Editor strokes, RULES, ford heuristics and display glyphs are NOT physical
// widths or Gameplay passability laws. No cart-passable claim is made.
import { pip, pipRings, dist, segInt, nearestOnLine, bbox, r4 } from './veyra.mjs';

export const SNAP_TOL = 7;
export const DEFECT_TOL = 8;
export const ACCESS_R = 48;
export const DOCK_R = 40;
export const BRIDGE_R = 22;
export const RESAMPLE_STEP = 8;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Verbatim MapStudio geom.ts catmull (9 au target, 2..28 samples/segment). */
export function catmull(pts) {
  if (pts.length < 3) return { pts: pts.slice(), idx: pts.map((_, i) => clamp(i, 0, pts.length - 2)) };
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

/** Verbatim MapStudio geom.ts resample. */
export function resample(pts, step = RESAMPLE_STEP, idx = null) {
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

/** Verbatim MapStudio graph.ts Idx — spatial hash snap, merge when d <= tol. */
class Idx {
  constructor(tol) { this.tol = tol; this.nodes = new Map(); this.buckets = new Map(); }
  key(p, onNew) {
    const bx = Math.floor(p[0] / this.tol), by = Math.floor(p[1] / this.tol);
    let best = null, bd = this.tol;
    for (let i = bx - 1; i <= bx + 1; i++) for (let j = by - 1; j <= by + 1; j++) {
      const b = this.buckets.get(i + ',' + j);
      if (!b) continue;
      for (const k of b) { const d = dist(this.nodes.get(k), p); if (d <= bd) { bd = d; best = k; } }
    }
    if (best !== null) return best;
    const id = 'n' + this.nodes.size;
    this.nodes.set(id, [p[0], p[1]]);
    const bk = bx + ',' + by;
    if (!this.buckets.has(bk)) this.buckets.set(bk, []);
    this.buckets.get(bk).push(id);
    if (onNew) onNew(id);
    return id;
  }
}

function makeGraph() { return { adj: new Map(), edges: [] }; }
function ensureNode(g, n) { if (!g.adj.has(n)) g.adj.set(n, new Map()); }
function addEdge(g, a, b, w, attrs) {
  if (a === b) return 'SELF_MERGED';
  ensureNode(g, a); ensureNode(g, b);
  const prev = g.adj.get(a).get(b);
  if (prev) { if (w < prev.w) { prev.w = w; } return 'DEDUP'; }
  const e = { a, b, w, ...attrs };
  g.adj.get(a).set(b, e);
  g.adj.get(b).set(a, e);
  g.edges.push(e);
  return 'ADDED';
}

/**
 * Rebuild MapLab buildNets semantics from canonical Veyra, at a chosen snap tol.
 * tol=7 is authoritative; tol=8 reproduces the GEO-01 tolerance defect.
 */
export function buildNets(P, tol = SNAP_TOL) {
  const stats = { tol, selfMergedFoot: 0, selfMergedCart: 0, selfMergedAll: 0, roadSamples: 0, riverSamples: 0 };
  const foot = makeGraph(), cart = makeGraph(), water = makeGraph(), riverNet = makeGraph(), all = makeGraph();
  const G = [foot, cart, water, riverNet, all];
  const idx = new Idx(tol);
  const pos = idx.nodes;
  const onNew = n => { for (const g of G) ensureNode(g, n); };
  // Idx.key needs onNew on every new node.
  const key = p => idx.key(p, onNew);
  const onLand = q => P.land.some(l => pipRings(q, l.rings));
  const lakeRings = P.lakes.map(l => l.ring);

  // ---- hydrology ----
  const rsegs = [], riverNodes = {};
  const riverById = Object.fromEntries(P.rivers.map(r => [r.id, r]));
  for (const r of P.rivers) {
    const c = catmull(r.points), s = resample(c.pts, RESAMPLE_STEP, c.idx);
    stats.riverSamples += s.pts.length;
    const ns = s.pts.map(q => key(q));
    riverNodes[r.id] = ns;
    for (let i = 1; i < s.pts.length; i++) {
      const w = dist(s.pts[i - 1], s.pts[i]);
      rsegs.push({ a: s.pts[i - 1], b: s.pts[i], r });
      const nav = r.nav[Math.min(s.idx[i], r.nav.length - 1)] === 1;
      const mid = [(s.pts[i - 1][0] + s.pts[i][0]) / 2, (s.pts[i - 1][1] + s.pts[i][1]) / 2];
      const fall = (r.feats || []).some(f => f.kind === 'waterfall' && dist(f.at, mid) < 14);
      const rap = (r.feats || []).some(f => (f.kind === 'rapids' || f.kind === 'weir') && dist(f.at, mid) < 24);
      addEdge(riverNet, ns[i - 1], ns[i], w, { river: r.id, nav, fall });
      if (nav && !fall) { addEdge(water, ns[i - 1], ns[i], w * (rap ? 3 : 1), { river: r.id, rap }); addEdge(all, ns[i - 1], ns[i], w * (rap ? 3 : 1), { river: r.id }); }
    }
  }
  const lakeNode = id => 'L:' + id;
  for (const lk of P.lakes) {
    for (const g of [riverNet, water, all]) ensureNode(g, lakeNode(lk.id));
    pos.set(lakeNode(lk.id), lk.ring.reduce((a, q) => [a[0] + q[0] / lk.ring.length, a[1] + q[1] / lk.ring.length], [0, 0]));
  }
  for (const r of P.rivers) {
    const ns = riverNodes[r.id];
    if (!ns) continue;
    for (const lk of P.lakes) {
      const cen = pos.get(lakeNode(lk.id));
      for (const k of ns) {
        const q = pos.get(k);
        if (!(pip(q, lk.ring) || nearestOnLine(lk.ring, q, true).d < 9)) continue;
        const w = Math.max(4, dist(q, cen) * 0.5);
        addEdge(riverNet, k, lakeNode(lk.id), w, { lake: lk.id });
        if (water.adj.has(k) && water.adj.get(k).size > 0) { addEdge(water, k, lakeNode(lk.id), w, { lake: lk.id }); addEdge(all, k, lakeNode(lk.id), w, { lake: lk.id }); }
      }
    }
    if (r.mouth?.kind === 'sea') {
      const k = ns[ns.length - 1];
      for (const g of [riverNet, water, all]) ensureNode(g, 'SEA');
      addEdge(riverNet, k, 'SEA', 0.5, { sea: 1 });
      if (water.adj.has(k) && water.adj.get(k).size > 0) { addEdge(water, k, 'SEA', 0.5, {}); addEdge(all, k, 'SEA', 0.5, {}); }
    }
  }

  // ---- roads ----
  const hash = new Map();
  rsegs.forEach((s, i) => {
    const x0 = Math.floor(Math.min(s.a[0], s.b[0]) / 40), x1 = Math.floor(Math.max(s.a[0], s.b[0]) / 40);
    const y0 = Math.floor(Math.min(s.a[1], s.b[1]) / 40), y1 = Math.floor(Math.max(s.a[1], s.b[1]) / 40);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x + ',' + y; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i); }
  });
  const roadNodes = {}, bridgeless = [], crossings = [], roadEdgeStatus = [];
  for (const rd of P.roads) {
    if (rd.kind === 'ferry' || rd.points.length < 2) continue;
    const c = catmull(rd.points), s = resample(c.pts, RESAMPLE_STEP);
    stats.roadSamples += s.pts.length;
    const ns = s.pts.map(q => key(q));
    roadNodes[rd.id] = ns;
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1], b = s.pts[i], w = dist(a, b);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (lakeRings.some(r => pip(mid, r)) || !onLand(mid)) {
        roadEdgeStatus.push({ roadId: rd.id, i, status: 'SKIPPED_NOT_ON_LAND_OR_IN_LAKE' });
        continue;
      }
      let blockFoot = false, blockCart = false, fordCost = 1;
      const seen = new Set();
      const x0 = Math.floor(Math.min(a[0], b[0]) / 40), x1 = Math.floor(Math.max(a[0], b[0]) / 40);
      const y0 = Math.floor(Math.min(a[1], b[1]) / 40), y1 = Math.floor(Math.max(a[1], b[1]) / 40);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (const si of hash.get(x + ',' + y) || []) {
        if (seen.has(si)) continue;
        seen.add(si);
        const h = segInt(a, b, rsegs[si].a, rsegs[si].b);
        if (!h) continue;
        const riv = rsegs[si].r;
        const br = P.bridges.find(bb => dist(bb.at, h.p) < BRIDGE_R);
        const rec = {
          roadId: rd.id, roadKind: rd.kind, riverId: riv.id, atAu: h.p.map(r4),
          bridgeId: br?.id ?? null, bridgeLoad: br?.load ?? null,
          roadSampleIndex: i, riverWidthAuthored: riv.width,
          riverKind: riv.kind, riverFordableFlag: riv.fordable ?? null, roadFordFlag: rd.ford ?? null,
          crossingStatus: 'EDITOR_CENTRELINE_INTERSECTION__NOT_A_PHYSICAL_CHANNEL_MEASUREMENT',
        };
        crossings.push(rec);
        if (br) {
          if (br.load !== 'cart') blockCart = true;
          rec.disposition = br.load === 'cart' ? 'BRIDGE_CART_LOAD' : 'BRIDGE_FOOT_ONLY';
          continue;
        }
        blockCart = true;
        const fordable = !!(rd.ford || riv.fordable || (riv.kind !== 'canal' && riv.width <= 3));
        if (fordable) { fordCost = 3; rec.disposition = 'FORD_EDITOR_HEURISTIC'; }
        else { blockFoot = true; rec.disposition = 'UNBRIDGED_NO_FORD'; }
        bridgeless.push({ road: rd.id, river: riv.id, at: h.p.map(r4), cart: rd.kind === 'cart' });
      }
      // EXACT MapLab order: decide blocking FIRST, then add edges.
      if (!blockFoot) {
        const rf = addEdge(foot, ns[i - 1], ns[i], w * fordCost, { road: rd.id, kind: rd.kind });
        if (rf === 'SELF_MERGED') stats.selfMergedFoot++;
        const ra = addEdge(all, ns[i - 1], ns[i], w * fordCost, { road: rd.id });
        if (ra === 'SELF_MERGED') stats.selfMergedAll++;
      }
      if (rd.kind === 'cart' && !blockCart) {
        const rc = addEdge(cart, ns[i - 1], ns[i], w, { road: rd.id, kind: rd.kind });
        if (rc === 'SELF_MERGED') stats.selfMergedCart++;
      }
      roadEdgeStatus.push({ roadId: rd.id, i, status: blockFoot ? 'FOOT_BLOCKED' : 'FOOT_OK', cart: rd.kind === 'cart' && !blockCart, fordCost, blockCart });
    }
  }

  // ---- docks & ferries ----
  const dockNode = {};
  for (const d of P.docks) {
    const k = 'D:' + d.id;
    pos.set(k, d.at);
    for (const g of G) ensureNode(g, k);
    dockNode[d.id] = k;
    if (d.water === 'sea') { for (const g of [water, all, riverNet]) { ensureNode(g, 'SEA'); addEdge(g, k, 'SEA', 4, {}); } }
    else if (P.lakes.some(l => l.id === d.water)) { for (const g of [water, all, riverNet]) addEdge(g, k, lakeNode(d.water), 6, {}); }
    else {
      const ns = riverNodes[d.water];
      if (ns) {
        let best = null, bd = DOCK_R;
        for (const n of ns) { const q = dist(pos.get(n), d.at); if (q < bd && water.adj.get(n)?.size > 0) { bd = q; best = n; } }
        if (best) { addEdge(water, k, best, bd, {}); addEdge(all, k, best, bd, {}); }
        let b2 = null, bd2 = DOCK_R;
        for (const n of ns) { const q = dist(pos.get(n), d.at); if (q < bd2) { bd2 = q; b2 = n; } }
        if (b2) addEdge(riverNet, k, b2, bd2, {});
      }
    }
    for (const [g, gk] of [[foot, 'foot'], [cart, 'cart']]) {
      let best = null, bd = DOCK_R;
      for (const [n, ed] of g.adj) {
        if (n.startsWith('D:') || n.startsWith('L:') || n === 'SEA') continue;
        if (!pos.has(n)) continue;
        const q = dist(pos.get(n), d.at);
        if (q < bd) { bd = q; best = n; }
      }
      if (best) { addEdge(g, k, best, bd, { dock: 1 }); if (gk === 'foot') addEdge(all, k, best, bd, {}); }
    }
  }
  const ferryLinks = [];
  for (const rd of P.roads) {
    if (rd.kind !== 'ferry' || rd.points.length < 2) continue;
    const ends = [rd.points[0], rd.points[rd.points.length - 1]];
    const ks = ends.map(e => {
      let best = null, bd = 34;
      for (const d of P.docks) { const q = dist(d.at, e); if (q < bd) { bd = q; best = 'D:' + d.id; } }
      return best;
    });
    if (ks[0] && ks[1]) {
      let len = 0; const c = catmull(rd.points).pts;
      for (let i = 1; i < c.length; i++) len += dist(c[i - 1], c[i]);
      addEdge(water, ks[0], ks[1], len, { ferry: rd.id });
      addEdge(all, ks[0], ks[1], len, { ferry: rd.id });
      addEdge(riverNet, ks[0], ks[1], len, { ferry: rd.id });
      ferryLinks.push({ roadId: rd.id, from: ks[0], to: ks[1], lengthAu: r4(len), status: 'SOURCE_AUTHORED_FERRY_CENTRELINE__NO_APPROVED_GAMEPLAY_BOAT_RULE' });
    } else ferryLinks.push({ roadId: rd.id, from: ks[0], to: ks[1], lengthAu: null, status: 'UNRESOLVED__FERRY_END_NOT_WITHIN_34au_OF_A_DOCK' });
  }

  const nearestNode = (g, pt, maxd) => {
    let best = null, bd = maxd;
    for (const [n] of g.adj) { const q = pos.get(n); if (!q) continue; const d = dist(q, pt); if (d < bd) { bd = d; best = n; } }
    return best;
  };
  // Only nodes incident to at least one real edge count as network access.
  // MapLab's nearestNode() scans ALL nodes (including isolated river samples);
  // GEO-02's poiAccess instead measured distance to real cart ROADS. Use the
  // active-edge variant so POI access is not inflated by isolated samples.
  const nearestActiveNode = (g, pt, maxd) => {
    let best = null, bd = maxd;
    for (const [n, ed] of g.adj) { if (ed.size === 0) continue; const q = pos.get(n); if (!q) continue; const d = dist(q, pt); if (d < bd) { bd = d; best = n; } }
    return best;
  };
  const poiFoot = {}, poiCart = {}, poiWater = {};
  for (const po of P.pois) {
    poiFoot[po.id] = nearestActiveNode(foot, po.at, ACCESS_R);
    poiCart[po.id] = nearestActiveNode(cart, po.at, ACCESS_R);
    let best = null, bd = 70;
    for (const d of P.docks) { const q = dist(d.at, po.at); if (q < bd && dockNode[d.id]) { bd = q; best = dockNode[d.id]; } }
    poiWater[po.id] = best;
  }
  return {
    tol, stats, pos, nodes: [...pos.keys()],
    foot, cart, water, riverNet, all, roadNodes, riverNodes, dockNode,
    bridgeless, crossings, roadEdgeStatus, ferryLinks, poiFoot, poiCart, poiWater,
    rsegs, nearestNode, nearestActiveNode, constants: { SNAP_TOL, DEFECT_TOL, ACCESS_R, DOCK_R, BRIDGE_R, RESAMPLE_STEP },
  };
}

/** Connected components of an undirected adjacency map.
 * activeOnly=true ignores isolated nodes that Idx.key inserted into every graph
 * (river/dock samples), which otherwise inflate component counts. */
export function graphComponents(g, activeOnly = false) {
  const seen = new Set(), comps = [], compOf = new Map();
  for (const [n, ed] of g.adj) {
    if (seen.has(n)) continue;
    if (activeOnly && ed.size === 0) continue;
    const c = comps.length, q = [n]; seen.add(n);
    for (let h = 0; h < q.length; h++) {
      const x = q[h]; compOf.set(x, c);
      for (const [o] of g.adj.get(x) || []) if (!seen.has(o)) { seen.add(o); q.push(o); }
    }
    comps.push(q);
  }
  return { comps, compOf, count: comps.length, sizes: comps.map(c => c.length), largest: Math.max(0, ...comps.map(c => c.length)) };
}

/** Dijkstra over the graph (heap), optional edge-avoid predicate. */
export function dijkstra(g, src, maxCost = Infinity, avoid = null) {
  const d = new Map([[src, 0]]), prev = new Map(), done = new Set();
  const heap = [[0, src]];
  const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let m = i, l = 2 * i + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [c, n] = pop();
    if (done.has(n)) continue;
    done.add(n);
    if (c > maxCost) break;
    for (const [o, e] of g.adj.get(n) || []) {
      if (avoid && avoid(n, o, e)) continue;
      const nc = c + e.w;
      if (nc < (d.get(o) ?? Infinity)) { d.set(o, nc); prev.set(o, n); push([nc, o]); }
    }
  }
  return { d, prev };
}

export function pathFrom(prev, src, dst) {
  if (src !== dst && !prev.has(dst)) return null;
  const p = [dst];
  while (p[0] !== src && prev.has(p[0])) p.unshift(prev.get(p[0]));
  return p[0] === src ? p : null;
}
