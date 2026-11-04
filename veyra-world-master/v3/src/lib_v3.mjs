#!/usr/bin/env node
// SOH MAP AGENT — WMP-03 PHYSICAL SEMANTICS CORRECTIVE
// Shared deterministic helpers. ADDITIVE ONLY: v1/v2 files are never written.
// All quantities derived from observed RAW source bytes or authored geometry.
// No invented metres, degrees, seconds, rates, collision law or Gameplay balance.
import fs from 'node:fs';
import path from 'node:path';
import { MASTER, GW, GH, CELL, N, FRAME_AU, sha256, digest, r4, idx, gxOf, gyOf, centreAu, toCell,
  readJson, readBuf, dist, distPointSegment, pointInRing } from '../../lib/wmp.mjs';

export const V3 = path.join(MASTER, 'v3');
export const GW3 = GW, GH3 = GH, CELL3 = CELL, N3 = N;
export { MASTER, GW, GH, CELL, N, FRAME_AU, sha256, digest, r4, idx, gxOf, gyOf, centreAu, toCell,
  readJson, readBuf, dist, distPointSegment, pointInRing };

export const v3Path = rel => path.join(V3, rel);
export function writeV3Json(rel, obj) {
  const f = v3Path(rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(obj, null, 2) + '\n');
}
export function writeV3U8(rel, arr) {
  const f = v3Path(rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, Buffer.from(arr));
}
export function readV3Json(rel) { return JSON.parse(fs.readFileSync(v3Path(rel), 'utf8')); }
export function readV3U8(rel) { return new Uint8Array(fs.readFileSync(v3Path(rel))); }
export const shaV3 = rel => sha256(fs.readFileSync(v3Path(rel)));
export const shaMaster = rel => sha256(readBuf(rel));

// ------------------------------------------------------------------ statistics
/** Deterministic empirical quantile. p in [0,1]. Uses floor(p*n), never interpolation. */
export function quantile(values, p) {
  const a = Array.from(values).sort((x, y) => x - y);
  if (!a.length) throw new Error('QUANTILE_EMPTY');
  return a[Math.min(a.length - 1, Math.floor(p * a.length))];
}
/** Returns a deterministic mid-rank empirical CDF closure over `values`. */
export function rankCdf(values) {
  const a = Array.from(values).sort((x, y) => x - y);
  return v => {
    let lo = 0, hi = a.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; }
    let end = lo;
    while (end < a.length && a[end] === v) end++;
    return (lo + end) / (2 * a.length);
  };
}

// ------------------------------------------------------------------ neighbourhood
/** 8-neighbour cell indices in deterministic order, clipped at the frame. */
export function neighbours8(i) {
  const x = gxOf(i), y = gyOf(i), out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
    out.push(idx(nx, ny));
  }
  return out;
}
export function neighbours4(i) {
  const x = gxOf(i), y = gyOf(i), out = [];
  if (x > 0) out.push(idx(x - 1, y));
  if (x < GW - 1) out.push(idx(x + 1, y));
  if (y > 0) out.push(idx(x, y - 1));
  if (y < GH - 1) out.push(idx(x, y + 1));
  return out;
}
/** True when `b` is a 4-neighbour of `a` (no row wrap). */
export const adjacent4 = (a, b) => {
  const dx = Math.abs(gxOf(a) - gxOf(b)), dy = Math.abs(gyOf(a) - gyOf(b));
  return dx + dy === 1;
};

// ------------------------------------------------------------------ road rasterization
/**
 * WMP-02 defect: `rasterPath()` walked all X first, then all Y, producing an
 * L-shaped staircase that can sit arbitrarily far from a diagonal authored
 * segment. This is kept ONLY as the measured "before" fixture.
 */
export function legacyXYPath(points) {
  const out = [];
  const push = c => { if (out[out.length - 1] !== c) out.push(c); };
  const first = toCell(points[0][0], points[0][1]);
  out.push(first);
  for (let s = 1; s < points.length; s++) {
    const a = points[s - 1], b = points[s];
    let c = toCell(b[0], b[1]);
    let cx = gxOf(out[out.length - 1]), cy = gyOf(out[out.length - 1]);
    const tx = gxOf(c), ty = gyOf(c);
    while (cx !== tx) { cx += Math.sign(tx - cx); push(idx(cx, cy)); }
    while (cy !== ty) { cy += Math.sign(ty - cy); push(idx(cx, cy)); }
  }
  return out;
}

/**
 * WMP-03 corrected rasterization: a 4-connected chain that hugs the authored
 * straight segment. Dense samples (<= CELL/4 apart) are connected with a
 * shape-preserving Bresenham-style stepper; diagonal cell jumps insert the
 * intermediate cell whose centre is nearer the authored segment. No X-then-Y
 * ordering, no fabricated vertices, no change of authored endpoints.
 */
export function correctedSegmentCells(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(len / (CELL / 4)));
  const samples = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    samples.push(toCell(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
  }
  const out = [samples[0]];
  for (let k = 1; k < samples.length; k++) {
    const cur = samples[k];
    let prev = out[out.length - 1];
    if (cur === prev) continue;
    let px = gxOf(prev), py = gyOf(prev);
    const cx = gxOf(cur), cy = gyOf(cur);
    let guard = 0;
    while ((px !== cx || py !== cy) && ++guard < 16) {
      const needX = cx - px, needY = cy - py;
      if (needX !== 0 && needY !== 0) {
        const ca = idx(px + Math.sign(needX), py), cb = idx(px, py + Math.sign(needY));
        const da = distPointSegment(centreAu(ca), a, b), db = distPointSegment(centreAu(cb), a, b);
        const next = da <= db ? ca : cb;
        out.push(next); px = gxOf(next); py = gyOf(next);
      } else if (needX !== 0) { px += Math.sign(needX); out.push(idx(px, py)); }
      else { py += Math.sign(needY); out.push(idx(px, py)); }
    }
  }
  return out;
}
export function correctedPath(points) {
  if (!points || points.length < 2) return [toCell(points[0][0], points[0][1])];
  const out = [];
  for (let s = 1; s < points.length; s++) {
    const seg = correctedSegmentCells(points[s - 1], points[s]);
    for (const c of seg) if (out[out.length - 1] !== c) out.push(c);
  }
  return out;
}
/** Max/mean perpendicular distance (au) from path cell centres to authored polyline. */
export function pathDrift(points, cells) {
  let max = 0, sum = 0;
  for (const c of cells) {
    const p = centreAu(c);
    let d = Infinity;
    for (let s = 1; s < points.length; s++) d = Math.min(d, distPointSegment(p, points[s - 1], points[s]));
    max = Math.max(max, d); sum += d;
  }
  return { maxDriftAu: r4(max), meanDriftAu: r4(sum / Math.max(1, cells.length)), cellCount: cells.length };
}
export const polylineLengthAu = pts => {
  let s = 0; for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return r4(s);
};

// ------------------------------------------------------------------ polygon cells
/** Cell centres inside a ring, using the exact same bbox/centre criterion as LR02 M2. */
export function polygonCells(ring) {
  if (!ring || ring.length < 3) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of ring) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const gx0 = Math.max(0, Math.floor(x0 / CELL)), gx1 = Math.min(GW - 1, Math.ceil(x1 / CELL));
  const gy0 = Math.max(0, Math.floor(y0 / CELL)), gy1 = Math.min(GH - 1, Math.ceil(y1 / CELL));
  const out = [];
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const p = centreAu(idx(gx, gy));
    if (p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1 && pointInRing(p, ring)) out.push(idx(gx, gy));
  }
  return out;
}

// ------------------------------------------------------------------ connected components
export function components(seedMask) {
  const seen = new Uint8Array(N), out = [];
  for (let i = 0; i < N; i++) {
    if (!seedMask[i] || seen[i]) continue;
    const q = [i], comp = []; seen[i] = 1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h]; comp.push(c);
      for (const n of neighbours4(c)) if (seedMask[n] && !seen[n]) { seen[n] = 1; q.push(n); }
    }
    out.push(comp);
  }
  return out;
}
export function bboxOfCells(cells) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cells) { const p = centreAu(c); x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return [r4(x0 - CELL / 2), r4(y0 - CELL / 2), r4(x1 + CELL / 2), r4(y1 + CELL / 2)];
}

// ------------------------------------------------------------------ P0 CLASSIFIERS (pure; used by build_v3 AND by independent fixtures)
const DEFAULT_REGION_OPTS = { highRockZoneCodes: [], lowlandZoneCodes: [], typhonCode: 2, rockBiomes: [7, 8, 9] };
export const TERRAIN_WEIGHTS = Object.freeze({ slope: 0.40, relief: 0.25, elevation: 0.20, convexity: 0.10, region: 0.05 });
export const TERRAIN_CLASS_CUT_QUANTILES = Object.freeze([0.5, 0.75, 0.9, 0.97, 0.995]);

/**
 * P0-01 classifier. Pure function of the SOURCE rasters and authored region
 * geometry codes. Every boundary is an OBSERVED quantile, so it is invariant to
 * a uniform byte offset (unlike WMP-01's absolute `slopeRaw > 200`).
 * Returns u8 rasters plus the exact measured quantiles/cuts that produced them.
 */
export function classifyTerrain(S, opts = {}) {
  const o = { ...DEFAULT_REGION_OPTS, ...opts };
  const dryCells = [];
  for (let i = 0; i < N; i++) if (S.waterClass[i] === 0) dryCells.push(i);
  const relief = new Uint8Array(N), convexity = new Int16Array(N), steepNeighbours = new Uint8Array(N);
  const slopeQuantiles = Object.fromEntries([0.5, 0.75, 0.9, 0.95, 0.97, 0.99, 1].map(p => [`p${Math.round(p * 100)}`, quantile(dryCells.map(i => S.slope[i]), p)]));
  const steepSlope = slopeQuantiles.p90;
  for (let i = 0; i < N; i++) {
    let mn = 255, mx = 0, sum = 0, n = 0;
    for (const j of neighbours8(i)) {
      mn = Math.min(mn, S.elevation[j]); mx = Math.max(mx, S.elevation[j]);
      sum += S.elevation[j]; n++;
    }
    relief[i] = mx - mn;
    convexity[i] = n ? Math.round(S.elevation[i] - sum / n) : 0;
    steepNeighbours[i] = neighbours8(i).filter(j => S.slope[j] >= steepSlope).length;
  }
  const drySlope = dryCells.map(i => S.slope[i]), dryRelief = dryCells.map(i => relief[i]), dryElevation = dryCells.map(i => S.elevation[i]);
  const Q = {
    slope: slopeQuantiles,
    relief: Object.fromEntries([0.5, 0.75, 0.9, 0.95, 0.97, 0.99, 1].map(p => [`p${Math.round(p * 100)}`, quantile(dryRelief, p)])),
    elevation: Object.fromEntries([0.5, 0.75, 0.9, 0.95, 0.99, 1].map(p => [`p${Math.round(p * 100)}`, quantile(dryElevation, p)])),
  };
  const inCodes = (v, a) => a.includes(v);
  const regionPrior = i =>
    (inCodes(S.zoneId[i], o.highRockZoneCodes) ? 0.6 : 0) +
    (S.elderGeometryId[i] > 0 ? 0.2 : 0) +
    (o.rockBiomes.includes(S.biomeCode[i]) ? 0.2 : 0);
  const slopeCdf = rankCdf(drySlope), reliefCdf = rankCdf(dryRelief), elevCdf = rankCdf(dryElevation), convCdf = rankCdf(dryCells.map(i => convexity[i]));
  const score = new Float64Array(N);
  for (const i of dryCells) score[i] =
    TERRAIN_WEIGHTS.slope * slopeCdf(S.slope[i]) + TERRAIN_WEIGHTS.relief * reliefCdf(relief[i]) +
    TERRAIN_WEIGHTS.elevation * elevCdf(S.elevation[i]) + TERRAIN_WEIGHTS.convexity * convCdf(convexity[i]) +
    TERRAIN_WEIGHTS.region * regionPrior(i);
  const CLASS_CUTS = TERRAIN_CLASS_CUT_QUANTILES.map(p => r4(quantile(dryCells.map(i => score[i]), p)));
  const heightClass = new Uint8Array(N), cliff = new Uint8Array(N), terrace = new Uint8Array(N), slopeClass = new Uint8Array(N);
  const cliffSlope = Q.slope.p95, cliffRelief = Q.relief.p90;
  // Degenerate (perfectly flat / zero-spread) input has NO relief ordering and
  // therefore NO steep faces. Absolute-zero quantile thresholds must never make
  // every cell a cliff. This guard is physical, not a test accommodation.
  const degenerateInput = (Q.slope.p95 - Q.slope.p50) <= 0 || (Q.relief.p90 - Q.relief.p50) <= 0 || cliffSlope <= 0 || cliffRelief <= 0;
  for (const i of dryCells) {
    if (degenerateInput) { heightClass[i] = 0; slopeClass[i] = 0; continue; }
    let k = 0; while (k < CLASS_CUTS.length && score[i] > CLASS_CUTS[k]) k++;
    heightClass[i] = k;
    if (k >= 4 && S.slope[i] >= cliffSlope && relief[i] >= cliffRelief && steepNeighbours[i] >= 2) cliff[i] = 1;
    if (k === 3 && S.slope[i] >= Q.slope.p75 && relief[i] >= Q.relief.p75) terrace[i] = 1;
    const s = S.slope[i];
    slopeClass[i] = s < Q.slope.p50 ? 0 : s < Q.slope.p75 ? 1 : s < Q.slope.p90 ? 2 : s < Q.slope.p97 ? 3 : 4;
  }
  const heightHistogram = {}, slopeHistogram = {};
  for (const i of dryCells) { heightHistogram[heightClass[i]] = (heightHistogram[heightClass[i]] || 0) + 1; slopeHistogram[slopeClass[i]] = (slopeHistogram[slopeClass[i]] || 0) + 1; }
  return {
    dryCells, Q, WEIGHTS: TERRAIN_WEIGHTS, CLASS_CUTS, score, heightClass, cliff, terrace, slopeClass,
    relief, convexity, steepNeighbours, steepSlope, cliffSlope, cliffRelief,
    heightHistogram, slopeHistogram,
    cliffCount: Array.from(cliff).reduce((a, b) => a + b, 0), terraceCount: Array.from(terrace).reduce((a, b) => a + b, 0),
    degenerateInput,
  };
}

/**
 * P0-03 classifier. Pure. A road polyline over water is NEVER land-walkable;
 * ferry / bridge-deck proposal / ford proposal / water are distinct; NO cell
 * ever gets an active collision permission (only Gameplay can grant that).
 */
export function classifyWaterTraversal(roadCellMap, ferryIds, bridgeCellIds, S, roadPointsById = {}) {
  const waterTraversalClass = new Uint8Array(N), roadSurface = new Uint8Array(N), activeCollisionPermission = new Uint8Array(N);
  const classification = [], ferryRouteRecords = [], bridgeProposals = new Map(), fordProposals = new Map();
  let waterRoadCellCount = 0;
  for (const [i, rid] of [...roadCellMap.entries()].sort((a, b) => a[0] - b[0])) {
    const wet = S.waterClass[i] > 0;
    let kind, status, owner, surfaceKind;
    if (wet && ferryIds.has(rid)) {
      kind = 2; surfaceKind = 'FERRY_ROUTE'; status = 'BLOCKED__GAMEPLAY_OWNS_BOAT_MECHANIC'; owner = OWNER.GAMEPLAY;
      let f = ferryRouteRecords.find(x => x.id === rid);
      if (!f) {
        f = { id: rid, kind: 'ferry', sourceRef: 'GOLD project.roads[kind=ferry]', cells: [], landWalkable: false, activeCollisionPermission: false, traversalStatus: status, owner, status: 'SOURCE_AUTHORED_GEOMETRY__NOT_A_LAND_ROAD' };
        if (roadPointsById[rid]) f.authoredLengthAu = polylineLengthAu(roadPointsById[rid]);
        ferryRouteRecords.push(f);
      }
      f.cells.push(i);
    } else if (wet && bridgeCellIds.has(i)) {
      kind = 3; surfaceKind = 'BRIDGE_DECK_PROPOSAL'; status = 'PROPOSED__DECK_GEOMETRY_ONLY'; owner = OWNER.MAP_GAMEPLAY;
      const bid = bridgeCellIds.get(i);
      if (!bridgeProposals.has(bid)) bridgeProposals.set(bid, { id: bid, kind: 'BRIDGE_DECK_PROPOSAL', cells: [], landWalkable: false, activeCollisionPermission: false, traversalStatus: status, owner, status: 'PROPOSED' });
      bridgeProposals.get(bid).cells.push(i);
    } else if (wet) {
      kind = 4; surfaceKind = 'FORD_PROPOSAL'; status = 'PROPOSED__DEPTH_AND_FLOW_UNKNOWN'; owner = OWNER.MAP_GAMEPLAY;
      if (!fordProposals.has(rid)) fordProposals.set(rid, { id: `ford.${rid}.v3`, roadId: rid, kind: 'FORD_PROPOSAL', cells: [], landWalkable: false, activeCollisionPermission: false, traversalStatus: status, owner, status: 'PROPOSED' });
      fordProposals.get(rid).cells.push(i);
    } else { kind = 1; surfaceKind = 'DRY_LAND_ROAD'; status = 'VERIFIED_GEOMETRY__AUTHORED_DRY_LAND_ROAD_SURFACE'; owner = OWNER.MAP; }
    waterTraversalClass[i] = kind; roadSurface[i] = kind;
    if (wet) {
      waterRoadCellCount++;
      classification.push({ cellIndex: i, atAu: centreAu(i), waterClass: S.waterClass[i], roadId: rid, surfaceKind, landWalkable: false, activeCollisionPermission: false, traversalStatus: status, owner, status: 'PROPOSED' });
    }
  }
  return {
    waterTraversalClass, roadSurface, activeCollisionPermission, classification,
    ferryRouteRecords, bridgeProposals, fordProposals, waterRoadCellCount,
    ferryCellCount: ferryRouteRecords.reduce((a, f) => a + f.cells.length, 0),
    bridgeCellCount: [...bridgeProposals.values()].reduce((a, b) => a + b.cells.length, 0),
    fordCellCount: [...fordProposals.values()].reduce((a, f) => a + f.cells.length, 0),
  };
}

/** P0-04 classifier. Pure. Full-world physical suitability, NOT legal placement. */
export function classifyConstruction(S, T) {
  const suitability = new Uint8Array(N);
  for (const i of T.dryCells) {
    if (S.protectedGeometryCandidate[i] > 0 || T.cliff[i] === 1 || T.heightClass[i] >= 4 || S.coast[i] > 0) { suitability[i] = 0; continue; }
    // On a zero-spread source, `slope >= p75` is trivially true (0 >= 0) and
    // would mislabel flat land as marginal. Only apply spread-based penalties
    // when the observed distribution actually HAS spread.
    if (!T.degenerateInput && (T.heightClass[i] === 3 || S.slope[i] >= T.Q.slope.p75 || T.relief[i] >= T.Q.relief.p90)) { suitability[i] = 1; continue; }
    suitability[i] = (T.heightClass[i] <= 1 && S.slope[i] <= T.Q.slope.p50 && S.clearanceCells[i] > 0) ? 3 : 2;
  }
  return suitability;
}
export function footprintsFrom(suitability, S, zoneNames = [], minCells = 9, T = null) {
  const seed = new Uint8Array(N);
  for (let i = 0; i < N; i++) seed[i] = suitability[i] >= 2 ? 1 : 0;
  const comps = components(seed);
  return comps.filter(c => c.length >= minCells).map((cells, k) => ({
    id: `footprint.v3.${String(k + 1).padStart(3, '0')}`, cells,
    cellCount: cells.length, bboxAu: bboxOfCells(cells),
    zoneIds: [...new Set(cells.map(i => S.zoneId[i]).filter(Boolean))].map(code => zoneNames[code - 1] ?? `zoneCode.${code}`),
    outsideSurveyedZoneCells: cells.filter(i => S.zoneId[i] === 0).length,
    meanHeightClass: T ? r4(cells.reduce((a, c) => a + T.heightClass[c], 0) / cells.length) : null,
    protectedOverlapCells: cells.filter(i => S.protectedGeometryCandidate[i] > 0).length,
    cliffOverlapCells: T ? cells.filter(c => T.cliff[c] === 1).length : 0,
    status: 'VERIFIED_GEOMETRY__PHYSICALLY_POSSIBLE_FOOTPRINT', owner: OWNER.MAP,
    legalPlacement: { status: VOCAB.UNKNOWN, owner: OWNER.GAMEPLAY },
  }));
}

// ------------------------------------------------------------------ vocabulary
export const VOCAB = Object.freeze({
  UNKNOWN: 'UNKNOWN', PROPOSED: 'PROPOSED', VERIFIED: 'VERIFIED', UNRESOLVED: 'UNRESOLVED',
  BLOCKED: 'BLOCKED', SOURCE_AUTHORED: 'SOURCE_AUTHORED',
});
export const OWNER = Object.freeze({ MAP: 'MAP', GAMEPLAY: 'GAMEPLAY', MAP_GAMEPLAY: 'MAP+GAMEPLAY', CREATOR: 'CREATOR' });
