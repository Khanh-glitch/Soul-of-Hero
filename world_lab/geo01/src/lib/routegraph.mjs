// Deterministic route graph built ONLY from authored road/bridge geometry.
// It is a derived geographic structure, not a Gameplay traversal law: ferry
// boarding, cart load, slope cost and bridge span fit remain UNDEFINED.
import { dist, pathLength, segmentIntersection, pathDistance, round } from './geometry.mjs';

export function buildRouteGraph(P, { joinToleranceAu = 8 } = {}) {
  const roads = P.roads.map((r, idx) => ({ r, idx, points: r.points, length: pathLength(r.points) }));
  const segments = [];
  for (const rd of roads) {
    let pos = 0;
    for (let s = 0; s < rd.points.length - 1; s++) {
      const a = rd.points[s], b = rd.points[s + 1], L = dist(a, b);
      segments.push({ road: rd.idx, seg: s, a, b, pos, L });
      pos += L;
    }
  }

  // Exact proper intersections between segments of DIFFERENT roads.
  const stops = roads.map(rd => ([
    { pos: 0, pt: rd.points[0], kind: 'endpoint' },
    { pos: rd.length, pt: rd.points[rd.points.length - 1], kind: 'endpoint' },
  ]));
  let intersections = 0;
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const A = segments[i], B = segments[j];
    if (A.road === B.road) continue;
    const p = segmentIntersection(A.a, A.b, B.a, B.b);
    if (!p) continue;
    intersections++;
    stops[A.road].push({ pos: A.pos + dist(A.a, p), pt: p, kind: 'intersection' });
    stops[B.road].push({ pos: B.pos + dist(B.a, p), pt: p, kind: 'intersection' });
  }

  // Cluster stop points into nodes. Tolerance is an EXPLICIT configurable
  // derived transform parameter (default = one source grid cell = 8 au).
  const all = [];
  stops.forEach((list, ri) => list.forEach(s => { s.road = ri; all.push(s); }));
  all.sort((a, b) => a.pt[0] - b.pt[0] || a.pt[1] - b.pt[1] || a.pos - b.pos);
  const nodes = [];
  const assign = new Map();
  for (let k = 0; k < all.length; k++) {
    const s = all[k];
    let best = -1;
    for (let n = 0; n < nodes.length; n++) if (dist(nodes[n], s.pt) <= joinToleranceAu) { best = n; break; }
    if (best < 0) { best = nodes.length; nodes.push(s.pt); }
    assign.set(k, best);
  }
  // Rebind: assign keys were built over sorted `all`, keep a direct lookup.
  const nodeOf = new Map();
  for (let k = 0; k < all.length; k++) nodeOf.set(all[k], assign.get(k));

  const edges = [];
  roads.forEach((rd, ri) => {
    const list = stops[ri].slice().sort((a, b) => a.pos - b.pos);
    const dedup = [];
    for (const s of list) if (!dedup.length || s.pos - dedup[dedup.length - 1].pos > 1e-6) dedup.push(s);
    for (let k = 0; k < dedup.length - 1; k++) {
      const a = dedup[k], b = dedup[k + 1];
      const from = nodeOf.get(a), to = nodeOf.get(b);
      if (from === undefined || to === undefined || from === to) continue;
      // Preserve authored vertices that lie strictly between the two stops.
      let acc = 0; const inner = [];
      for (let s = 0; s < rd.points.length; s++) {
        if (s > 0) acc += dist(rd.points[s - 1], rd.points[s]);
        if (acc > a.pos + 1e-6 && acc < b.pos - 1e-6) inner.push(rd.points[s]);
      }
      edges.push({
        id: `rg_${edges.length}`,
        roadId: rd.r.id, roadKind: rd.r.kind, conf: rd.r.conf,
        from, to, lengthAu: round(b.pos - a.pos, 6),
        points: [a.pt, ...inner, b.pt],
        widthAu: null, widthStatus: 'NOT_IN_SOURCE',
        ferry: rd.r.kind === 'ferry',
        ford: !!rd.r.ford, alt: !!rd.r.alt,
        derived: false,
      });
    }
  });

  const adj = nodes.map(() => []);
  edges.forEach((e, i) => { adj[e.from].push(i); adj[e.to].push(i); });
  return {
    config: { joinToleranceAu, intersectionJoins: intersections, stopCount: all.length, nodeCount: nodes.length, edgeCount: edges.length },
    nodes: nodes.map((p, i) => ({ id: i, at: [round(p[0], 6), round(p[1], 6)], degree: adj[i].length })),
    edges, adj,
  };
}

/** Dijkstra over graph edges. `bannedRoadIds` enables a genuinely different
 *  alternative route instead of a cosmetic re-ordering of the same roads. */
export function shortestPath(graph, fromNode, toNode, { bannedRoadIds = new Set(), bannedEdgeIds = new Set() } = {}) {
  const n = graph.nodes.length;
  const d = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), prevEdge = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  d[fromNode] = 0;
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && d[i] < best) { best = d[i]; u = i; }
    if (u < 0 || u === toNode) break;
    done[u] = 1;
    for (const ei of graph.adj[u]) {
      const e = graph.edges[ei];
      if (bannedEdgeIds.has(ei) || bannedRoadIds.has(e.roadId)) continue;
      const v = e.from === u ? e.to : e.from;
      const nd = d[u] + e.lengthAu;
      if (nd < d[v] - 1e-9) { d[v] = nd; prev[v] = u; prevEdge[v] = ei; }
    }
  }
  if (!Number.isFinite(d[toNode])) return null;
  const edgeIds = [], nodeIds = [toNode];
  for (let v = toNode; v !== fromNode;) { const ei = prevEdge[v]; if (ei < 0) return null; edgeIds.push(ei); v = prev[v]; nodeIds.push(v); }
  edgeIds.reverse(); nodeIds.reverse();
  return { distanceAu: round(d[toNode], 6), edgeIds, nodeIds, edges: edgeIds.map(i => graph.edges[i]) };
}

/** Attach a point outside the graph with derived connector edges. */
export function connectPoint(graph, pt, maxDistanceAu = 200) {
  const links = [];
  graph.nodes.forEach((n, i) => {
    const d = dist(pt, n.at);
    if (d <= maxDistanceAu) links.push({ node: i, distanceAu: round(d, 6), at: n.at });
  });
  links.sort((a, b) => a.distanceAu - b.distanceAu);
  return links;
}

/** Nearest authored road polyline (used for factual proximity, not a path). */
export function nearestRoad(P, pt) {
  let best = null;
  for (const r of P.roads) {
    const d = pathDistance(pt, r.points);
    if (!best || d < best.distanceAu) best = { id: r.id, kind: r.kind, conf: r.conf, distanceAu: round(d, 6) };
  }
  return best;
}
