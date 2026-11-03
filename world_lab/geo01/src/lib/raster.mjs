// Reproducible derived raster layers. Every layer is a uint8 grid at the SOURCE
// grid resolution (250 x 175, cell = 8 authoring units). No resampling to the
// runtime's 200 x 200 tiles happens here or anywhere else in MAP-GEO-01.
import { pointInPolygon, pointInClosedRing, segDistance, D4 } from './geometry.mjs';

export const GRID_ORDER = 'row_major: i = gy*gw + gx; cell centre = [(gx+0.5)*cell, (gy+0.5)*cell]';

export function decodeLayer(b64, expected) {
  const buf = Buffer.from(b64, 'base64');
  if (buf.length !== expected) throw new Error(`decoded ${buf.length} bytes, expected ${expected}`);
  // Canonical base64 roundtrip: the source string must be exactly reproducible.
  if (buf.toString('base64') !== b64) throw new Error('base64 is not canonical roundtrip');
  return new Uint8Array(buf);
}

export function gridIndex(x, y, cell, gw, gh) {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
  if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return -1;
  return gy * gw + gx;
}

export function cellCenter(gx, gy, cell) { return [(gx + 0.5) * cell, (gy + 0.5) * cell]; }

/** Rasterize an open polyline's centre cells. `width` is preserved, NOT applied:
 *  river.width has no established physical unit in the source. */
export function rasterizePolyline(pts, out, gw, gh, cell, value) {
  for (let s = 0; s < pts.length - 1; s++) {
    const a = pts[s], b = pts[s + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / (cell * 0.5)));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const i = gridIndex(x, y, cell, gw, gh);
      if (i >= 0 && out[i] === 0) out[i] = value;
    }
  }
}

/** Multi-source 4-neighbour BFS distance in CELLS, capped at 255. */
export function bfsDistance(sources, gw, gh, passable = null) {
  const n = gw * gh, d = new Uint8Array(n).fill(255);
  const q = new Int32Array(n); let h = 0, t = 0;
  for (const i of sources) if (i >= 0 && i < n && d[i] === 255) { d[i] = 0; q[t++] = i; }
  while (h < t) {
    const i = q[h++], nd = d[i] + 1;
    if (nd > 255) continue;
    const gx = i % gw, gy = (i / gw) | 0;
    for (const [dx, dy] of D4) {
      const nx = gx + dx, ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const j = ny * gw + nx;
      if (d[j] !== 255 || (passable && !passable[j])) continue;
      d[j] = nd; q[t++] = j;
    }
  }
  return d;
}

export function buildLayers(P) {
  const t = P.terrain, gw = t.gw, gh = t.gh, cell = t.cell, n = gw * gh;
  const elevation = decodeLayer(t.elev, n);
  const biomeCode = decodeLayer(t.biome, n);

  // --- raw elevation gradient, in SOURCE RAW BYTE DELTAS PER GRID CELL.
  // No normalization: Gameplay's slope threshold (world-economy.ts uses >0.6)
  // is a Gameplay rule and is NOT defined by the Veyra source.
  const slope = new Uint8Array(n);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = gy * gw + gx;
    const xl = elevation[gy * gw + Math.max(0, gx - 1)], xr = elevation[gy * gw + Math.min(gw - 1, gx + 1)];
    const yu = elevation[Math.max(0, gy - 1) * gw + gx], yd = elevation[Math.min(gh - 1, gy + 1) * gw + gx];
    const g = Math.hypot((xr - xl) / 2, (yd - yu) / 2);
    slope[i] = Math.min(255, Math.round(g));
  }

  const landId = new Uint8Array(n);       // 0 = sea, 1..8 = P.land index+1
  const lakeId = new Uint8Array(n);       // 0 = none
  const riverId = new Uint8Array(n);      // 0 = none
  const zoneId = new Uint8Array(n);       // 0 = none
  const poiGeometryId = new Uint8Array(n); // 0 = none (foot/deep polygons)
  const elderGeometryId = new Uint8Array(n); // 0 = none
  const roadClass = new Uint8Array(n);    // 0 none, 1 cart, 2 trail, 3 foot, 4 riverside, 5 ferry
  const cargoCandidate = new Uint8Array(n);

  const classByKind = { cart: 1, trail: 2, foot: 3, riverside: 4, ferry: 5 };

  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = gy * gw + gx, c = cellCenter(gx, gy, cell);
    for (let k = 0; k < P.land.length; k++) if (pointInPolygon(c, P.land[k].rings)) { landId[i] = k + 1; break; }
    for (let k = 0; k < P.lakes.length; k++) if (pointInClosedRing(c, P.lakes[k].ring)) { lakeId[i] = k + 1; break; }
    for (let k = 0; k < P.zones.length; k++) if (pointInClosedRing(c, P.zones[k].ring)) { zoneId[i] = k + 1; break; }
    for (let k = 0; k < P.pois.length; k++) {
      const p = P.pois[k];
      if ((p.foot && pointInClosedRing(c, p.foot)) || (p.deep && pointInClosedRing(c, p.deep))) { poiGeometryId[i] = k + 1; break; }
    }
    for (let k = 0; k < P.elders.length; k++) {
      const e = P.elders[k];
      if (pointInClosedRing(c, e.outer) || (e.core && pointInClosedRing(c, e.core)) ||
          (e.arenas || []).some(a => pointInClosedRing(c, a))) { elderGeometryId[i] = k + 1; break; }
    }
  }
  for (let k = 0; k < P.rivers.length; k++) rasterizePolyline(P.rivers[k].points, riverId, gw, gh, cell, k + 1);
  for (let k = 0; k < P.roads.length; k++) {
    const r = P.roads[k], v = classByKind[r.kind] || 0;
    rasterizePolyline(r.points, roadClass, gw, gh, cell, v);
  }
  // cargo candidates: authored cart roads + cart-load bridges + docks. This is a
  // SPATIAL CANDIDATE, not a cargoPassable verdict.
  for (let i = 0; i < n; i++) if (roadClass[i] === 1) cargoCandidate[i] = 1;
  for (const b of P.bridges) if (b.load === 'cart') { const i = gridIndex(b.at[0], b.at[1], cell, gw, gh); if (i >= 0) cargoCandidate[i] = 1; }
  for (const d of P.docks) { const i = gridIndex(d.at[0], d.at[1], cell, gw, gh); if (i >= 0) cargoCandidate[i] = 1; }

  // waterClass: 0 none, 1 sea, 2 lake, 3 river centreline.
  const waterClass = new Uint8Array(n);
  for (let i = 0; i < n; i++) waterClass[i] = landId[i] === 0 ? 1 : lakeId[i] ? 2 : riverId[i] ? 3 : 0;

  const coast = new Uint8Array(n);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = gy * gw + gx;
    if (landId[i] === 0) continue;
    let edge = false;
    for (const [dx, dy] of D4) {
      const nx = gx + dx, ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh || landId[ny * gw + nx] === 0) { edge = true; break; }
    }
    if (edge) coast[i] = 1;
  }

  const freshwater = new Uint8Array(n);
  for (let i = 0; i < n; i++) freshwater[i] = (lakeId[i] || riverId[i]) ? 1 : 0;

  // walkableCandidate: authored land polygon minus authored lake/river geometry.
  // SLOPE IS NOT APPLIED: the passable slope threshold belongs to Gameplay.
  const walkableCandidate = new Uint8Array(n);
  for (let i = 0; i < n; i++) walkableCandidate[i] = landId[i] !== 0 && waterClass[i] === 0 ? 1 : 0;

  const buildableCandidate = new Uint8Array(n);
  for (let i = 0; i < n; i++) buildableCandidate[i] = walkableCandidate[i] && zoneId[i] ? 1 : 0;

  // "protected" here means ONLY authored POI/Elder geometry overlap. A0's
  // protection policy is a Gameplay rule and is NOT asserted.
  const protectedGeometryCandidate = new Uint8Array(n);
  for (let i = 0; i < n; i++) protectedGeometryCandidate[i] = poiGeometryId[i] || elderGeometryId[i] ? 1 : 0;

  const seaSources = [], freshSources = [], blockedSources = [];
  for (let i = 0; i < n; i++) {
    if (waterClass[i] === 1) seaSources.push(i);
    if (freshwater[i]) freshSources.push(i);
    if (!walkableCandidate[i]) blockedSources.push(i);
  }
  const seaDistanceCells = bfsDistance(seaSources, gw, gh);
  const freshwaterProximityCells = bfsDistance(freshSources, gw, gh);
  const clearanceCells = bfsDistance(blockedSources, gw, gh);

  // Crossings: authored bridge cells are the ONLY cells that may be treated as
  // crossing-capable in the corridor proof. Their channel fit is unverified.
  const crossingCandidate = new Uint8Array(n);
  for (const b of P.bridges) { const i = gridIndex(b.at[0], b.at[1], cell, gw, gh); if (i >= 0) crossingCandidate[i] = b.load === 'cart' ? 2 : 1; }
  for (const r of P.roads) if (r.ford) for (const p of r.points) { const i = gridIndex(p[0], p[1], cell, gw, gh); if (i >= 0 && !crossingCandidate[i]) crossingCandidate[i] = 3; }

  return {
    grid: { gw, gh, cell, cells: n, order: GRID_ORDER },
    layers: {
      elevation, biomeCode, slope, landId, lakeId, riverId, zoneId,
      poiGeometryId, elderGeometryId, roadClass, cargoCandidate,
      waterClass, coast, freshwater, walkableCandidate, buildableCandidate,
      protectedGeometryCandidate, crossingCandidate,
      seaDistanceCells, freshwaterProximityCells, clearanceCells,
    },
  };
}

export const LAYER_SEMANTICS = {
  elevation: { source: 'project.terrain.elev', unit: 'UNKNOWN_SOURCE_BYTE', note: '0 = sea/no-land (verified against land polygons); 1..243 = land height in unspecified source units.' },
  biomeCode: { source: 'project.terrain.biome', unit: 'RAW_SOURCE_CODE', note: '0..11. Semantic legend is NOT committed in the source; do not map to Gameplay Biome strings without an approved transform.' },
  slope: { derived: 'central difference of raw elevation bytes', unit: 'RAW_BYTE_DELTA_PER_GRID_CELL', note: 'Not normalized. Gameplay slope threshold is UNDEFINED here.' },
  landId: { derived: 'point-in-polygon on land[].rings (holes honoured)', unit: '0=sea, 1..8=land array index+1' },
  lakeId: { derived: 'point-in-ring on lakes[].ring', unit: '0=none, 1..5=lake index+1' },
  riverId: { derived: 'centre-cell rasterization of rivers[].points', unit: '0=none, 1..17=river index+1', note: 'river.width is preserved but NOT applied as a physical channel width (unit unestablished).' },
  zoneId: { derived: 'point-in-ring on zones[].ring', unit: '0=none, 1..23=zone index+1' },
  poiGeometryId: { derived: 'point-in-ring on pois[].foot / pois[].deep', unit: '0=none, 1..81=poi index+1' },
  elderGeometryId: { derived: 'point-in-ring on elders[].outer/core/arenas', unit: '0=none, 1..6=elder index+1' },
  roadClass: { derived: 'centre-cell rasterization of roads[].points', unit: '0 none, 1 cart, 2 trail, 3 foot, 4 riverside, 5 ferry' },
  cargoCandidate: { derived: 'cart roads + cart-load bridges + docks', unit: '0/1 SPATIAL CANDIDATE ONLY', note: 'cargoPassable verdict requires Gameplay loaded-cart rules; UNDEFINED.' },
  waterClass: { derived: 'sea / lake / river precedence', unit: '0 none, 1 sea, 2 lake, 3 river centreline' },
  coast: { derived: 'land cell with a 4-neighbour sea cell', unit: '0/1' },
  freshwater: { derived: 'lake or river geometry', unit: '0/1' },
  walkableCandidate: { derived: 'land polygon minus lake/river geometry', unit: '0/1', note: 'Slope, collision and hazard rules are NOT applied.' },
  buildableCandidate: { derived: 'walkableCandidate ∩ zones[].ring', unit: '0/1', note: 'A0 protection / occupancy / route legality is NOT asserted.' },
  protectedGeometryCandidate: { derived: 'POI foot/deep or Elder outer/core/arena geometry', unit: '0/1', note: 'Geometry overlap only; NOT the A0 protected mask.' },
  crossingCandidate: { derived: 'bridges[].at (load) and roads[].ford points', unit: '0 none, 1 foot bridge, 2 cart bridge, 3 ford', note: 'Bridge-to-channel fit is UNVERIFIED.' },
  seaDistanceCells: { derived: '4-neighbour BFS from sea cells', unit: 'grid cells (x8 = authoring units), capped 255' },
  freshwaterProximityCells: { derived: '4-neighbour BFS from lake/river cells', unit: 'grid cells (x8 = authoring units), capped 255', note: 'Geometric potential ONLY; NOT a climate/moisture value.' },
  clearanceCells: { derived: '4-neighbour BFS from blocked cells', unit: 'grid cells (x8 = authoring units), capped 255' },
};
