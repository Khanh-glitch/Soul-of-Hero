#!/usr/bin/env node
// MAP-GEO-02 step 3: sp_lake -> po_kilns spatial geometry audit.
//
// FOUR SEPARATE CONNECTIVITY LAYERS, never conflated:
//   1 SOURCE_AUTHORED          explicit refs + exact coincident endpoints + bridge at/load
//   2 DERIVED_ROAD_GRAPH       endpoint/intersection graph (GEO-01 tol=8) vs MapLab SNAP_TOL=7
//   3 RASTER_CANDIDATE         walkable-candidate BFS + MapLab stepMult Dijkstra (editor heuristic)
//   4 PHYSICAL_CLEARANCE       UNPROVEN: no road/river width, no swept envelope, no span fit
//
// No passability rule is invented. MapLab's own heuristics are quoted with
// MAPLAB_EDITOR_HEURISTIC__NOT_GAMEPLAY_PASSABILITY_LAW authority.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadMapLabSource } from './lib/maplab_source.mjs';
import {
  dist, catmull, resample, segInt, nearestOnLine, pip, pipRings,
  landMask, lakeMask, riverMask, roadFootMask, roadCartMask, chamfer,
  computeFields, cellOf, cellCenter, rasterDijkstra, stepMult,
} from './lib/maplab.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const GEO01 = path.resolve(ROOT, '../geo01/output');
const OUT = path.join(ROOT, 'output');
const RAS = path.join(OUT, 'rasters');
const sha = b => createHash('sha256').update(b).digest('hex');
const json = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
const r4 = v => +v.toFixed(4);

function canon() {
  const raw = Buffer.from(execFileSync('git', ['show',
    '19d8c6ec820f324a6ac12733165e43b5e2c6eab2:map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json'],
    { cwd: path.resolve(ROOT, '../..'), maxBuffer: 32 * 1024 * 1024 }));
  return { raw, p: JSON.parse(raw.toString('utf8')).project, sha256: sha(raw) };
}

/** graph.ts Idx: spatial-hash node merging at `tol`. */
class Idx {
  constructor(tol) { this.tol = tol; this.nodes = new Map(); this.buckets = new Map(); }
  key(pt) {
    const bx = Math.floor(pt[0] / this.tol), by = Math.floor(pt[1] / this.tol);
    let best = null, bd = this.tol;
    for (let i = bx - 1; i <= bx + 1; i++) for (let j = by - 1; j <= by + 1; j++) {
      const b = this.buckets.get(i + ',' + j);
      if (!b) continue;
      for (const k of b) { const d = dist(this.nodes.get(k), pt); if (d <= bd) { bd = d; best = k; } }
    }
    if (best) return best;
    const id = 'n' + this.nodes.size;
    this.nodes.set(id, [pt[0], pt[1]]);
    const bk = bx + ',' + by;
    if (!this.buckets.has(bk)) this.buckets.set(bk, []);
    this.buckets.get(bk).push(id);
    return id;
  }
}

/** Feed resampled smoothed river + road curves exactly in graph.ts order.
 *  Also count consecutive samples that collapse into ONE node: graph.ts calls
 *  addEdge(ns[i-1], ns[i]) and addEdge() drops a===b, so a tolerance >= the
 *  8u resample step DELETES road edges. */
function maplabNodeCount(p, tol, sem) {
  const idx = new Idx(tol);
  let selfMerges = 0, samples = 0;
  const feed = pts => {
    let prev = null;
    for (const q of pts) {
      const id = idx.key(q);
      if (prev !== null && id === prev) selfMerges++;
      prev = id; samples++;
    }
  };
  for (const r of p.rivers) { const c = catmull(r.points); feed(resample(c.pts, sem.GRAPH.resampleStepAu, c.idx).pts); }
  for (const r of p.roads) { if (r.kind === 'ferry' || r.points.length < 2) continue; feed(resample(catmull(r.points).pts, sem.GRAPH.roadResampleStepAu).pts); }
  return { nodes: idx.nodes.size, samples, consecutiveSampleSelfMerges: selfMerges };
}

/** Endpoint and segment-intersection junctions; tolerance-dependent pairs. */
function junctionTolerances(p, sem) {
  const roads = p.roads.filter(r => r.kind !== 'ferry' && r.points.length >= 2);
  const ends = [];
  for (const r of roads) {
    ends.push({ roadId: r.id, kind: r.kind, which: 'start', pt: r.points[0] });
    ends.push({ roadId: r.id, kind: r.kind, which: 'end', pt: r.points[r.points.length - 1] });
  }
  const exact = [], geo01Only = [], editorOnly = [];
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
    if (ends[i].roadId === ends[j].roadId) continue;
    const d = dist(ends[i].pt, ends[j].pt);
    if (d > 8) continue;
    const rec = { a: `${ends[i].roadId}:${ends[i].which}`, b: `${ends[j].roadId}:${ends[j].which}`, distanceAu: r4(d) };
    if (d === 0) exact.push(rec);
    else if (d <= sem.GRAPH.SNAP_TOL) editorOnly.push(rec);
    else geo01Only.push(rec); // 7 < d <= 8 : GEO-01 merged, editor SNAP_TOL=7 would NOT
  }
  // road/road exact geometric intersections (GEO-01 graph nodes)
  let intersections = 0;
  const nearEndpoint = [];
  for (let i = 0; i < roads.length; i++) for (let j = i + 1; j < roads.length; j++) {
    const A = roads[i].points, B = roads[j].points;
    for (let a = 0; a < A.length - 1; a++) for (let b = 0; b < B.length - 1; b++) {
      const h = segInt(A[a], A[a + 1], B[b], B[b + 1]);
      if (!h) continue;
      intersections++;
      for (const e of ends) {
        const d = dist(e.pt, h.p);
        if (d > 0 && d > sem.GRAPH.SNAP_TOL && d <= 8) nearEndpoint.push({ roads: [roads[i].id, roads[j].id], at: h.p.map(r4), endpoint: `${e.roadId}:${e.which}`, distanceAu: r4(d) });
      }
    }
  }
  return {
    geo01JoinToleranceAu: 8,
    maplabSnapTolAu: sem.GRAPH.SNAP_TOL,
    sourceRef: 'source_excerpt/graph.ts :: SNAP_TOL = 7 ("merge tolerance for graph nodes, same value the editor uses to attach endpoints")',
    roadEndpoints: ends.length,
    exactCoincidentEndpointPairs: exact.length,
    pairsMergedByBoth: { count: editorOnly.length, items: editorOnly.slice(0, 20) },
    pairsMergedOnlyByGeo01Tolerance8: { count: geo01Only.length, items: geo01Only.slice(0, 20), note: 'these joins exist in the GEO-01 derived graph but NOT under the editor\'s own SNAP_TOL=7' },
    roadRoadSegmentIntersections: intersections,
    intersectionsToleranceDependentNearAnEndpoint: { count: nearEndpoint.length, items: nearEndpoint.slice(0, 20) },
    maplabResampledGraphNodes: {
      atSnapTol7: maplabNodeCount(p, 7, sem), atTolerance8: maplabNodeCount(p, 8, sem),
      note: 'Idx over Catmull-Rom smoothed rivers+roads resampled at 8u, graph.ts order. At tol=8 the merge radius equals the 8u resample step, so consecutive samples collapse into one node and graph.ts addEdge(a,a) would DROP those road edges. This is not a harmless 1u difference.',
    },
    geo01DerivedGraph: { nodes: 131, edges: 105, method: 'road endpoints + exact segment intersections, joinToleranceAu=8' },
    verdict: 'GEO-01_TOLERANCE_NOT_THE_EDITOR_TOLERANCE__DERIVED_GRAPH_MUST_BE_REDERIVED_AT_7',
  };
}

/** graph.ts bridge coverage over road/river intersection points. */
function bridgeCrossings(p, sem) {
  const rsegs = [];
  for (const r of p.rivers) {
    const c = catmull(r.points), s = resample(c.pts, sem.GRAPH.resampleStepAu, c.idx);
    for (let i = 1; i < s.pts.length; i++) rsegs.push({ a: s.pts[i - 1], b: s.pts[i], r });
  }
  const hash = new Map();
  rsegs.forEach((s, i) => {
    const x0 = Math.floor(Math.min(s.a[0], s.b[0]) / 40), x1 = Math.floor(Math.max(s.a[0], s.b[0]) / 40);
    const y0 = Math.floor(Math.min(s.a[1], s.b[1]) / 40), y1 = Math.floor(Math.max(s.a[1], s.b[1]) / 40);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const k = x + ',' + y; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i);
    }
  });
  const crossings = [];
  for (const rd of p.roads) {
    if (rd.kind === 'ferry' || rd.points.length < 2) continue;
    const S = resample(catmull(rd.points).pts, sem.GRAPH.roadResampleStepAu).pts;
    for (let i = 1; i < S.length; i++) {
      const a = S[i - 1], b = S[i], seen = new Set();
      const x0 = Math.floor(Math.min(a[0], b[0]) / 40), x1 = Math.floor(Math.max(a[0], b[0]) / 40);
      const y0 = Math.floor(Math.min(a[1], b[1]) / 40), y1 = Math.floor(Math.max(a[1], b[1]) / 40);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (const si of hash.get(x + ',' + y) || []) {
        if (seen.has(si)) continue; seen.add(si);
        const h = segInt(a, b, rsegs[si].a, rsegs[si].b);
        if (!h) continue;
        const riv = rsegs[si].r;
        let best = null, bd = sem.GRAPH.BRIDGE_R;
        for (const br of p.bridges) { const d = dist(br.at, h.p); if (d < bd) { bd = d; best = br; } }
        const brValidRoad = Math.min(...p.roads.filter(q => q.kind !== 'ferry').map(q => nearestOnLine(catmull(q.points).pts, best ? best.at : h.p).d));
        const brValidRiver = best ? Math.min(...p.rivers.map(q => nearestOnLine(catmull(q.points).pts, best.at).d)) : Infinity;
        crossings.push({
          roadId: rd.id, roadKind: rd.kind, riverId: riv.id, riverWidthAu: riv.width,
          intersectionAu: h.p.map(r4), bridgeId: best ? best.id : null,
          bridgeLoad: best ? best.load : null, bridgeDistanceAu: best ? r4(bd) : null,
          bridgeWithinBridgeR22: !!best,
          fordWidthHeuristic: riv.kind !== 'canal' && riv.width <= sem.RIVER.fordWidthThresholdAu,
          cartBlocked: !(best && best.load === 'cart'),
          footBlocked: !(best || rd.ford || riv.fordable || (riv.kind !== 'canal' && riv.width <= 3)),
          bridgeValidWithin14u: best ? brValidRoad < sem.GRAPH.bridgeValidRadiusAu && brValidRiver < sem.GRAPH.bridgeValidRadiusAu : false,
          roadDistanceToBridgeAu: r4(brValidRoad), riverDistanceToBridgeAu: r4(brValidRiver),
        });
      }
    }
  }
  const focus = ['br_4', 'br_a'].map(id => {
    const br = p.bridges.find(b => b.id === id);
    const related = crossings.filter(c => c.bridgeId === id);
    return {
      bridgeId: id, source: br ? { at: br.at, ang: br.ang, load: br.load, conf: br.conf || null, name: br.name } : null,
      coveredIntersections: related,
      riverWidths: related.map(c => {
        const r = p.rivers.find(q => q.id === c.riverId);
        return { riverId: r.id, widthAu: r.width, maskStrokeAu: Math.max(r.width, sem.RIVER.maskMinAu), carveRadiusAu: r.kind === 'canal' ? sem.RIVER.carveCanalAu : Math.max(sem.RIVER.carveMinAu, r.width * sem.RIVER.carveWidthFactor) };
      }),
      displayGlyphAu: sem.DISPLAY_ONLY.bridgeGlyphAu,
      channelSpanFitVerified: false,
      physicalDeckSpan: 'UNDEFINED__DISPLAY_GLYPH_ONLY',
    };
  });
  return { method: 'graph.ts road/river segment intersections over Catmull-Rom curves resampled at 8u; BRIDGE_R=22, BRIDGE-VALID radius 14', allCrossings: crossings, focusBridges: focus };
}

/** Source-authored vs derived vs raster vs unproven clearance along the corridor. */
function routeSurface(p, sem, fields, masks, corridor) {
  const obstacle = new Uint8Array(masks.land.length);
  for (let k = 0; k < obstacle.length; k++) obstacle[k] = (!masks.land[k] || masks.lake[k] || masks.river[k]) ? 1 : 0;
  const clearanceAu = chamfer(obstacle, fields.gw, fields.gh, fields.cell);
  const routes = [];
  const all = [corridor.routes.primary, ...(corridor.routes.alternatives || [])];
  for (const r of all) {
    if (!r || !r.id) continue;
    const control = r.segments.flatMap(s => s.points);
    const smoothed = resample(catmull(control).pts, 8).pts;
    const samples = smoothed.map(q => {
      const k = cellOf(p, q);
      return { at: q.map(r4), cell: k, land: masks.land[k], lake: masks.lake[k], river: masks.river[k], roadFoot: masks.roadFoot[k], roadCart: masks.roadCart[k], elevationScalar: r4(fields.e[k]), slopeMaplabIndex: r4(fields.slope[k]), biomeCode: fields.biome[k], clearanceAu: r4(clearanceAu[k]) };
    });
    const offLand = samples.filter(s => !s.land);
    const inLake = samples.filter(s => !!s.lake);
    const inRiver = samples.filter(s => !!s.river);
    const uncovered = samples.filter(s => !s.roadFoot);
    const slopes = samples.map(s => s.slopeMaplabIndex);
    const kinds = [...new Set(r.segments.map(s => s.kind))];
    routes.push({
      routeId: r.id, label: r.label, totalDistanceAu: r.totalDistanceAu,
      status: r.status, roadIds: [...new Set(r.segments.map(s => s.roadId))], roadKinds: kinds,
      cartRouteContinuous: kinds.every(k => k === 'cart'),
      controlPointCount: control.length, smoothedSampleCount: smoothed.length,
      surface: {
        offLandSamples: offLand.length, inLakeSamples: inLake.length, inRiverSamples: inRiver.length,
        outside9uRoadAnalysisStroke: uncovered.length,
        minClearanceAu: Math.min(...samples.map(s => s.clearanceAu)),
        meanClearanceAu: r4(samples.reduce((a, s) => a + s.clearanceAu, 0) / samples.length),
        slopeMaplabIndexMin: Math.min(...slopes), slopeMaplabIndexMax: Math.max(...slopes),
        samplesAboveCartSlopeHeuristic: samples.filter(s => s.slopeMaplabIndex > sem.RULES.cartSlopeMax).length,
        authority: 'MAPLAB_EDITOR_HEURISTIC__NOT_GAMEPLAY_PASSABILITY_LAW',
      },
      samples: samples.filter((_, i) => i % 4 === 0),
    });
  }
  return { routes, obstacleDefinition: 'sea (not land) | lake | river (MapLab 9u-min river mask); chamfer distance in authoring units' };
}

/** GEO-01 raster BFS path: zero-clearance cells + au clearance with MapLab masks. */
function zeroClearance(p, sem, corridor, masks) {
  const geo01Clearance = Uint8Array.from(fs.readFileSync(path.join(GEO01, 'rasters/clearanceCells.u8')));
  const obstacle = new Uint8Array(masks.land.length);
  for (let k = 0; k < obstacle.length; k++) obstacle[k] = (!masks.land[k] || masks.lake[k] || masks.river[k]) ? 1 : 0;
  const clearanceAu = chamfer(obstacle, p.terrain.gw, p.terrain.gh, p.terrain.cell);
  const cells = corridor.physicalConnectivity.pathCellList || [];
  const zeros = cells.filter(k => geo01Clearance[k] === 0).map(k => ({
    cell: k, authoringAu: cellCenter(p, k).map(r4), geo01ClearanceCells: 0,
    maplabClearanceAu: r4(clearanceAu[k]), land: masks.land[k], lake: masks.lake[k], river: masks.river[k],
    crossingCandidate: Uint8Array.from(fs.readFileSync(path.join(GEO01, 'rasters/crossingCandidate.u8')))[k],
    bridgeId: (corridor.physicalConnectivity.crossingCells.find(c => c.cell === k) || {}).bridgeId || null,
  }));
  return {
    geo01PathCellCount: cells.length,
    geo01ClearanceSummary: corridor.physicalConnectivity.clearanceAlongGridPathCells,
    geo01ClearanceAuAlongPath: {
      min: r4(Math.min(...cells.map(k => clearanceAu[k]))), max: r4(Math.max(...cells.map(k => clearanceAu[k]))),
      mean: r4(cells.reduce((a, k) => a + clearanceAu[k], 0) / cells.length),
    },
    zeroClearanceCellCount: zeros.length,
    zeroClearanceCells: zeros,
    interpretation: 'Zero clearance is NOT a failure by itself: at br_4 the path must enter the river corridor. It means there is no free buffer around the centreline. With NO authored road width, river channel width, bridge deck span or cart footprint, swept clearance CANNOT be validated.',
    physicalClearanceStatus: 'UNPROVEN',
  };
}

function derivedConnectors(p, sem, corridor, masks, fields) {
  const out = [];
  const all = [corridor.routes.primary, ...(corridor.routes.alternatives || [])];
  for (const r of all) {
    if (!r || !r.id) continue;
    for (const c of r.connectors || []) {
      const from = c.from.startsWith('spawn:') ? c.from.slice(6).split(',').map(Number)
        : c.from.startsWith('graphNode:') ? c.from.split('@')[1].split(',').map(Number) : null;
      const to = c.to.startsWith('poi:') ? c.to.slice(4).split(',').map(Number)
        : c.to.startsWith('graphNode:') ? c.to.split('@')[1].split(',').map(Number) : null;
      if (!from || !to) continue;
      const n = Math.max(2, Math.ceil(dist(from, to) / 2));
      const sampled = [];
      for (let i = 0; i <= n; i++) {
        const q = [from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n];
        const k = cellOf(p, q);
        sampled.push({ at: q.map(r4), cell: k, land: masks.land[k], lake: masks.lake[k], river: masks.river[k], roadFoot: masks.roadFoot[k], slopeMaplabIndex: r4(fields.slope[k]), biomeCode: fields.biome[k] });
      }
      out.push({
        routeId: r.id, from: c.from, to: c.to, distanceAu: c.distanceAu,
        status: 'DERIVED_STRAIGHT_LINE__NOT_AUTHORED_ROAD',
        onLandFraction: r4(sampled.filter(s => s.land).length / sampled.length),
        offLandSamples: sampled.filter(s => !s.land).length,
        lakeSamples: sampled.filter(s => s.lake).length,
        riverSamples: sampled.filter(s => s.river).length,
        within9uRoadAnalysisStrokeSamples: sampled.filter(s => s.roadFoot).length,
        exceedsEditorAccessR48: c.distanceAu > sem.GRAPH.ACCESS_R,
        needsMapSpatialAuthoring: true,
        physicalWidth: 'UNDEFINED__NOT_AUTHORED',
        note: 'A straight derived connector has no authored centreline, width, surface or clearance envelope. It is NOT a road.',
      });
    }
  }
  return out;
}

/** POI cart/foot access under the editor's own ACCESS_R=48. */
function poiAccess(p, sem) {
  const poi = p.pois.find(q => q.id === 'po_kilns');
  const cartPts = p.roads.filter(r => r.kind === 'cart').map(r => catmull(r.points).pts);
  const footPts = p.roads.filter(r => r.kind !== 'ferry').map(r => catmull(r.points).pts);
  const nearestCart = p.roads.filter(r => r.kind === 'cart').reduce((best, r) => {
    const d = nearestOnLine(catmull(r.points).pts, poi.at).d;
    return d < best.d ? { d: r4(d), roadId: r.id } : best;
  }, { d: Infinity, roadId: null });
  const nearestFoot = p.roads.filter(r => r.kind !== 'ferry').reduce((best, r) => {
    const d = nearestOnLine(catmull(r.points).pts, poi.at).d;
    return d < best.d ? { d: r4(d), roadId: r.id } : best;
  }, { d: Infinity, roadId: null });
  return {
    poiId: poi.id, at: poi.at, arche: poi.arche, depth: poi.depth, gate: poi.gate,
    conf: poi.conf || null, foot: poi.foot, deep: poi.deep || null, retreat: poi.retreat, links: poi.links,
    editorAccessRAu: sem.GRAPH.ACCESS_R,
    nearestCartRoad: nearestCart, cartAccessWithinAccessR: nearestCart.d < sem.GRAPH.ACCESS_R,
    nearestFootRoad: nearestFoot, footAccessWithinAccessR: nearestFoot.d < sem.GRAPH.ACCESS_R,
    verdict: nearestCart.d < sem.GRAPH.ACCESS_R ? 'CART_ACCESS_PRESENT' : 'NO_CART_ACCESS_WITHIN_EDITOR_ACCESS_R__CART_ROUTE_TO_POI_NOT_ESTABLISHED',
  };
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { raw, p, sha256 } = canon();
  const src = loadMapLabSource();
  const sem = src.semantics;
  const enc = JSON.parse(fs.readFileSync(path.join(OUT, 'maplab_encoding.v1.json'), 'utf8'));
  const corridor = JSON.parse(fs.readFileSync(path.join(GEO01, 'corridor.v1.json'), 'utf8'));
  const geo = JSON.parse(fs.readFileSync(path.join(GEO01, 'geography.v1.json'), 'utf8'));

  const readMask = f => Uint8Array.from(fs.readFileSync(path.join(RAS, f)));
  const masks = {
    land: readMask('landMaplab.u8'), lake: readMask('lakeMaplab.u8'), river: readMask('riverMaplab.u8'),
    roadFoot: readMask('roadFootMaplab.u8'), roadCart: readMask('roadCartMaplab.u8'),
  };
  const fields = computeFields(p);

  const junctions = junctionTolerances(p, sem);
  const bridges = bridgeCrossings(p, sem);
  const surface = routeSurface(p, sem, fields, masks, corridor);
  const clearance = zeroClearance(p, sem, corridor, masks);
  const connectors = derivedConnectors(p, sem, corridor, masks, fields);
  const access = poiAccess(p, sem);

  // raster candidate connectivity: GEO-01 BFS + MapLab stepMult Dijkstra
  const spawn = corridor.spawnSelection.chosen;
  const spawnAt = p.spawns.find(s => s.id === spawn).at;
  const targetAt = p.pois.find(q => q.id === 'po_kilns').at;
  const raster = {
    geo01WalkableCandidateBFS: {
      connected: corridor.physicalConnectivity.connected,
      gridSteps: corridor.physicalConnectivity.gridSteps,
      rule: corridor.physicalConnectivity.passableRule,
      authority: 'GEO01_DERIVED_CANDIDATE__NOT_A_GAMEPLAY_PASSABILITY_LAW',
    },
    maplabStepMultDijkstra: {},
  };
  for (const mode of ['foot', 'cart']) {
    const d = rasterDijkstra(p, fields, masks, sem, spawnAt, targetAt, mode);
    const cells = d.cells || [];
    const riverCells = cells.filter(k => masks.river[k]);
    const bridgeCells = cells.filter(k => corridor.physicalConnectivity.crossingCells.some(c => c.cell === k));
    const onRoadCart = cells.filter(k => masks.roadCart[k]);
    raster.maplabStepMultDijkstra[mode] = {
      connected: d.connected, costAu: d.costAu, steps: d.steps ?? null,
      pathCells: cells.length, riverCellsOnPath: riverCells.length,
      bridgeCoveredCellsOnPath: bridgeCells.length, on9uCartRoadRasterCells: onRoadCart.length,
      offCartRoadCells: cells.length - onRoadCart.length,
      note: `Dijkstra over 8-neighbour cells using analysis.ts stepMult (slope limit ${sem.RULES[mode === 'cart' ? 'cartSlopeMax' : 'footSlopeMax']}, biome multipliers, 9u road stroke DISCOUNT only — NOT a requirement). stepMult adds +80 (cart) / +50 (foot) on river cells but does NOT require a bridge. This is the EDITOR's own analysis heuristic and a RASTER CANDIDATE, NOT an authored road, NOT a Gameplay law and NOT a physically traversable cart route.`,
      authority: 'MAPLAB_EDITOR_HEURISTIC__NOT_GAMEPLAY_PASSABILITY_LAW',
      notAPhysicallyTraversableCartRoute: true,
    };
  }
  raster.neverConflatedWithRoadGraph = 'The Dijkstra raster candidates are NOT the authored corridor: they take 0 river cells (no bridge at all), and roughly half their cells are outside even the 9u cart-road analysis raster. stepMult does not require a bridge or a road. The only authored cart bridge in this corridor is br_4 on rd_b, and no cart road reaches po_kilns within ACCESS_R=48. A connected raster candidate therefore proves NOTHING about a physically traversable cart route.';

  // source-authored connectivity
  const authored = {
    explicitRiverMouthSourceRefs: p.rivers.map(r => ({ id: r.id, mouth: r.mouth, source: r.source })),
    bridges: p.bridges.map(b => ({ id: b.id, at: b.at, load: b.load, ang: b.ang })),
    exactCoincidentRoadEndpoints: junctions.exactCoincidentEndpointPairs,
    poiLinks: p.pois.filter(q => (q.links || []).length).map(q => ({ id: q.id, links: q.links })),
    statement: 'Veyra authors NO explicit road-to-road junction table. Junctions are geometric coincidences/intersections of control polylines. Explicit authored connectivity is limited to river mouth/source refs, bridge at/load, POI links and exact coincident endpoints.',
  };

  // mark rivers actually crossed by the corridor roads
  const corridorRoadIds = new Set([corridor.routes.primary, ...(corridor.routes.alternatives || [])].flatMap(r => (r.segments || []).map(s => s.roadId)));
  const usedRivers = new Set(bridges.allCrossings.filter(c => corridorRoadIds.has(c.roadId)).map(c => c.riverId));
  const riverWidths = enc.widthSemantics.rivers.map(r => ({ ...r, crossedByCorridor: usedRivers.has(r.id) }));

  const failing = [
    { id: 'F-01', severity: 'FAIL', subject: 'RT-1 / RT-2 label "Authored cart corridor"', evidence: 'Only rd_b is kind:cart; rd_13, rd_1w, rd_16 are kind:trail. br_4 is a cart bridge but that does not make the route a cart route.', resolution: 'Re-label as a FOOT/TRAIL corridor with one cart segment. Do not claim cart traversability.' },
    { id: 'F-02', severity: 'FAIL', subject: 'po_kilns cart access', evidence: `nearest cart road ${access.nearestCartRoad.roadId} is ${access.nearestCartRoad.d}au away; editor ACCESS_R=${sem.GRAPH.ACCESS_R}au.`, resolution: 'No cart route to po_kilns is established. Either author a cart road (Map geometry, separate PROPOSED work) or keep the POI foot-access-only.' },
    { id: 'F-03', severity: 'NEEDS_AUTHORING', subject: 'GEO-01 derived connectors', evidence: `${connectors.length} straight connectors (37.20au, 55.14au, 62.57au x2) are not authored roads; ${connectors.filter(c => c.exceedsEditorAccessR48).length} exceed editor ACCESS_R=48.`, resolution: 'Map must author centreline + surface + width before any of these becomes a physical path.' },
    { id: 'F-04', severity: 'UNPROVEN', subject: 'Swept clearance at br_4', evidence: `${clearance.zeroClearanceCellCount} zero-clearance cells on the GEO-01 BFS path; road width, river channel width, bridge deck span and cart footprint are all UNDEFINED.`, resolution: 'Validate dimensions and swept clearance before any cart-route claim. channelSpanFitVerified remains false.' },
    { id: 'F-05', severity: 'NEEDS_REDERIVATION', subject: 'Road junction tolerance', evidence: `GEO-01 joinToleranceAu=8 vs editor SNAP_TOL=${sem.GRAPH.SNAP_TOL}; ${junctions.pairsMergedOnlyByGeo01Tolerance8.count} endpoint joins exist only at 8; resampled graph nodes ${junctions.maplabResampledGraphNodes.atSnapTol7.nodes} @7 vs ${junctions.maplabResampledGraphNodes.atTolerance8.nodes} @8, with ${junctions.maplabResampledGraphNodes.atTolerance8.consecutiveSampleSelfMerges} consecutive-sample self-merges at 8 that would delete road edges in graph.ts.`, resolution: 'Re-derive the road graph at SNAP_TOL=7 on Catmull-Rom smoothed curves.' },
    { id: 'F-06', severity: 'NEEDS_AUTHORING', subject: 'po_kilns physical shell', evidence: 'rooms/entrances/passages/doorOpenings/circulation/retreatPaths are NOT_IN_SOURCE (now correctly MAP_OWNED).', resolution: 'A PROPOSED, non-canonical Map-owned candidate is in output/poi_po_kilns.proposed.v1.json.' },
    { id: 'F-07', severity: 'UNPROVEN', subject: 'Bridge span fit for both crossings', evidence: 'br_4 (cart) and br_a (foot) are covered by BRIDGE_R=22, but the 13x7.2u exporter rectangle is a display glyph, not a physical deck span. River mask stroke is max(width,9)u.', resolution: 'Author/approve physical channel width and deck span; do not infer span from the glyph.' },
  ];
  for (const br of bridges.focusBridges) if (br.bridgeId === 'br_a') {
    failing.push({ id: 'F-08', severity: 'FAIL_FOR_CART', subject: 'br_a / rd_20 crossing (RT-3)', evidence: `bridge load=${br.source ? br.source.load : 'foot'}; rd_20 is kind:riverside. graph.ts blocks cart at any foot-load bridge.`, resolution: 'RT-3 is a FOOT candidate only. Never present it as a cart alternative.' });
  }

  const out = {
    schema: 'soh.map.geo02.corridor_audit.v1',
    generatedBy: 'world_lab/geo02/src/audit.mjs',
    authority: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
    frame: { authoringSpace: [p.world.w, p.world.h], grid: { gw: p.terrain.gw, gh: p.terrain.gh, cell: p.terrain.cell, cells: p.terrain.gw * p.terrain.gh }, transform: geo.frame.transform },
    sourceEvidence: {
      veyra: { commit: '19d8c6ec820f324a6ac12733165e43b5e2c6eab2', bytes: raw.length, sha256 },
      maplab: { commit: src.provenance.commit, innerZipSha256: src.provenance.innerZipSha256, excerptVerification: 'all MATCH', zipChain: src.zipChain.status },
      geo01: {
        corridor: { file: '../geo01/output/corridor.v1.json', sha256: sha(fs.readFileSync(path.join(GEO01, 'corridor.v1.json'))) },
        geography: { file: '../geo01/output/geography.v1.json', sha256: sha(fs.readFileSync(path.join(GEO01, 'geography.v1.json'))) },
      },
    },
    sourceIds: {
      spawn, spawnAt, poi: 'po_kilns', poiAt: targetAt,
      roads: [...corridorRoadIds],
      bridges: ['br_4', 'br_a'], rivers: [...usedRivers],
      nearestFerryRoadId: 'rd_2j', nearestFerryDistanceAu: 187.1,
    },
    connectivityLayers: {
      SOURCE_AUTHORED: authored,
      DERIVED_ROAD_GRAPH: junctions,
      RASTER_CANDIDATE: raster,
      PHYSICAL_CLEARANCE: { status: 'UNPROVEN', ...clearance },
      neverConflated: true,
    },
    audit: {
      junctionTolerances: junctions,
      bridgeCrossings: bridges,
      zeroClearance: clearance,
      riverWidths,
      surfaceContinuity: surface,
      derivedConnectors: connectors,
      poiAccess: access,
    },
    failingOrNeedsAuthoring: failing,
    correctionsToGeo01: [
      'RT-1 is NOT an "Authored cart corridor": only rd_b is cart; the rest are trails.',
      'joinToleranceAu=8 is not the editor tolerance (SNAP_TOL=7).',
      'The 50-step BFS path is a RASTER CANDIDATE, not a physically traversable cart route.',
      'Zero clearance is reported explicitly with au distances from MapLab masks, not hidden behind a mean.',
      'Physical POI rooms/entrances/passages/door openings are MAP_OWNED, not Gameplay-owned.',
    ],
    noClaim: 'NO_CLAIM_OF_PHYSICALLY_TRAVERSABLE_CART_ROUTES_UNTIL_DIMENSIONS_AND_SWEPT_CLEARANCE_ARE_VALIDATED',
    noInventedPassabilityRules: true,
    noRuntimeMerge: true,
    noGameplayPopulation: true,
  };
  json(path.join(OUT, 'corridor_audit.v1.json'), out);
  console.log(`AUDIT_OK routes=${surface.routes.length} crossings=${bridges.allCrossings.length} focusBridges=${bridges.focusBridges.length} zeroClearanceCells=${clearance.zeroClearanceCellCount} connectors=${connectors.length} failing=${failing.length}`);
  console.log(`  junctions: tol7nodes=${junctions.maplabResampledGraphNodes.atSnapTol7.nodes} tol8nodes=${junctions.maplabResampledGraphNodes.atTolerance8.nodes} selfMergesAt8=${junctions.maplabResampledGraphNodes.atTolerance8.consecutiveSampleSelfMerges} geo01Only=${junctions.pairsMergedOnlyByGeo01Tolerance8.count}`);
  console.log(`  raster foot=${raster.maplabStepMultDijkstra.foot.connected} cart=${raster.maplabStepMultDijkstra.cart.connected}; poi cart access=${access.cartAccessWithinAccessR}`);
}
main();
