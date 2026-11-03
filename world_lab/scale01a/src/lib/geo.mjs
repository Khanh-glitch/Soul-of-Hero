// MAP-SCALE-01A — source-linked Veyra measurements from the ACCEPTED GEO-01/02
// outputs. No new POIs, no canonical edits, no invented passability rules.
// All coordinates stay in the unchanged 2000x1400 authoring space.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { catmull, resample } from '../../../geo02/src/lib/maplab.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LAB = path.resolve(HERE, '../../..');
export const sha256 = buf => createHash('sha256').update(buf).digest('hex');

const G1 = path.join(LAB, 'geo01/output');
const G2 = path.join(LAB, 'geo02/output');

// Only full 64-character SHAs that are actually recorded are asserted here.
// All other inputs are fingerprinted (not guessed) and checked against their
// own committed manifests.
const EXPECTED = {
  'geo01/geography.v1.json': '13ae97272edc47b063bb4a2ffde5dcf9f92f0f34dc3fd35b6ab3bee7f26c29dd',
  'geo01/corridor.v1.json': 'e9212633b277ec0cd7ee932a0d9b1266532e805a2816e23e092edce3582db63e',
};

function readJson(p) { const b = fs.readFileSync(p); return { doc: JSON.parse(b.toString('utf8')), bytes: b.length, sha256: sha256(b) }; }
function readU8(p) { const b = fs.readFileSync(p); return { data: new Uint8Array(b.buffer, b.byteOffset, b.length), bytes: b.length, sha256: sha256(b) }; }

export function loadInputs() {
  const geography = readJson(path.join(G1, 'geography.v1.json'));
  const corridor = readJson(path.join(G1, 'corridor.v1.json'));
  const encoding = readJson(path.join(G2, 'maplab_encoding.v1.json'));
  const audit = readJson(path.join(G2, 'corridor_audit.v1.json'));
  const proposed = readJson(path.join(G2, 'poi_po_kilns.proposed.v1.json'));
  const rasterManifest = readJson(path.join(G1, 'rasters/manifest.v1.json'));
  const maplabManifest = readJson(path.join(G2, 'rasters/manifest.v1.json'));

  // Hard fidelity gate on the two files whose SHAs are fully recorded.
  if (geography.sha256 !== EXPECTED['geo01/geography.v1.json']) throw new Error('GEO-01 geography.v1.json fingerprint changed');
  if (corridor.sha256 !== EXPECTED['geo01/corridor.v1.json']) throw new Error('GEO-01 corridor.v1.json fingerprint changed');

  const r1 = {};
  for (const l of rasterManifest.doc.layers) r1[l.name] = readU8(path.join(G1, l.file));
  const r2 = {};
  for (const [name, meta] of Object.entries(maplabManifest.doc.files)) {
    r2[name.replace('.u8', '')] = readU8(path.join(G2, 'rasters', name));
    if (r2[name.replace('.u8', '')].sha256 !== meta.sha256) throw new Error(`GEO-02 raster ${name} SHA mismatch`);
  }
  for (const l of rasterManifest.doc.layers) if (r1[l.name].sha256 !== l.sha256) throw new Error(`GEO-01 raster ${l.name} SHA mismatch`);

  return {
    geography: geography.doc, corridor: corridor.doc, encoding: encoding.doc,
    audit: audit.doc, proposed: proposed.doc,
    rasterManifest: rasterManifest.doc, maplabManifest: maplabManifest.doc,
    r1, r2,
    fingerprints: {
      geography: { bytes: geography.bytes, sha256: geography.sha256 },
      corridor: { bytes: corridor.bytes, sha256: corridor.sha256 },
      encoding: { bytes: encoding.bytes, sha256: encoding.sha256 },
      audit: { bytes: audit.bytes, sha256: audit.sha256 },
      proposed: { bytes: proposed.bytes, sha256: proposed.sha256 },
      rasterManifest: { bytes: rasterManifest.bytes, sha256: rasterManifest.sha256 },
      maplabRasterManifest: { bytes: maplabManifest.bytes, sha256: maplabManifest.sha256 },
    },
  };
}

/** Verified Veyra feature sizes, all in the unchanged authoring unit. */
export function featureSizes(I) {
  const pois = I.geography.objects.pois;
  let minArea = Infinity, maxArea = 0, minEdge = Infinity, maxEdge = 0;
  const areas = [];
  for (const q of pois) {
    const f = q.foot || [];
    let a = 0;
    for (let i = 0; i < f.length; i++) {
      const u = f[i], v = f[(i + 1) % f.length];
      a += u[0] * v[1] - v[0] * u[1];
      const e = Math.hypot(v[0] - u[0], v[1] - u[1]);
      minEdge = Math.min(minEdge, e); maxEdge = Math.max(maxEdge, e);
    }
    a = Math.abs(a) / 2; areas.push(a); minArea = Math.min(minArea, a); maxArea = Math.max(maxArea, a);
  }
  areas.sort((a, b) => a - b);
  const enc = I.encoding;
  const proposedOpenings = (I.proposed.proposed?.entranceOptions || []).map(e => ({
    id: e.id, label: e.label, face: e.face, openingWidthAu: e.openingWidthAu,
    openingAu: e.openingAu, midpointAu: e.midpointAu,
    widthStatus: e.widthStatus, status: e.status, canonical: e.canonical,
  }));
  const proposedSpaces = (I.proposed.proposed?.interiorWorkingSpaces || []).map(s => ({
    id: s.id, label: s.label, areaAu2: s.areaAu2, status: s.status, canonical: s.canonical,
  }));
  return {
    authoringSpace: [I.geography.frame.authoring.w, I.geography.frame.authoring.h],
    sourceGrid: { ...I.geography.frame.grid },
    transform: I.geography.frame.transform,
    counts: {
      land: I.geography.objects.land.length, lakes: I.geography.objects.lakes.length,
      rivers: I.geography.objects.rivers.length, roads: I.geography.objects.roads.length,
      bridges: I.geography.objects.bridges.length, docks: I.geography.objects.docks.length,
      zones: I.geography.objects.zones.length, pois: pois.length,
      resources: I.geography.objects.resources.length, spawns: I.geography.objects.spawns.length,
      elders: I.geography.objects.elders.length,
    },
    poiFoot: {
      count: pois.length, minAreaAu2: +minArea.toFixed(4), medianAreaAu2: +areas[Math.floor(areas.length / 2)].toFixed(4),
      maxAreaAu2: +maxArea.toFixed(4), minEdgeAu: +minEdge.toFixed(4), maxEdgeAu: +maxEdge.toFixed(4),
      footAreasAu2: areas.map(a => +a.toFixed(4)),
      authoredDoorCount: pois.filter(q => q.doors || q.entry || q.rooms).length,
      authoredRetreatGeometryCount: pois.filter(q => (q.retreat || []).length > 0).length,
      note: 'Veyra canonical POIs have a foot/deep polygon and textual access label; NO authored door openings, rooms, corridors or workspaces exist.',
    },
    road: {
      analysisStrokeAu: enc.widthSemantics.roads.analysisStrokeAu,
      authoredWidthField: enc.widthSemantics.roads.authoredWidthField,
      physicalRoadWidth: enc.widthSemantics.roads.physicalRoadWidth,
      sweptClearance: enc.widthSemantics.roads.sweptClearance,
      displayStrokesAu: enc.widthSemantics.roads.displayStrokesAu,
    },
    river: { maskStrokeAu: 9, minAuthoredWidthAu: Math.min(...enc.widthSemantics.rivers.map(r => r.widthAu)), physicalChannelWidth: 'UNDEFINED__NOT_AUTHORED' },
    bridge: { displayGlyphAu: enc.widthSemantics.roads.bridgeDisplayGlyphAu, note: enc.widthSemantics.roads.bridgeDisplayNote },
    proposedEntrances: proposedOpenings,
    proposedWorkingSpaces: proposedSpaces,
    proposedEntranceWestAu: proposedOpenings.find(e => e.face === 'west')?.openingWidthAu ?? 3.696,
    proposedEntranceWestSource: 'world_lab/geo02/output/poi_po_kilns.proposed.v1.json :: proposed.entranceOptions[face=west].openingWidthAu (NON-CANONICAL, worked scale test only)',
    coastCells: I.r1.coast.data.reduce((s, v) => s + (v ? 1 : 0), 0),
  };
}

/** DOCUMENTED ASSUMPTION: 12 MapLab biome codes -> PR44 terrainSpeed keys.
 *  This is NOT an approved Gameplay mapping (GEO-02 explicitly left it open). */
export const BIOME_TO_SPEED_KEY = Object.freeze({
  0: 'meadow', 1: 'forest', 2: 'forest', 3: 'forest', 4: 'marsh', 5: 'sand',
  6: 'grass', 7: 'hill', 8: 'snow', 9: 'ash', 10: 'toxic', 11: 'sand',
});
export const ROUGH_SPEED_KEYS = Object.freeze(['forest', 'marsh', 'hill', 'snow']);

export function makeModel(I, C) {
  const gw = I.geography.frame.grid.gw, gh = I.geography.frame.grid.gh, cell = I.geography.frame.grid.cell;
  const n = gw * gh;
  const X = i => (i % gw + 0.5) * cell;
  const Y = i => (Math.floor(i / gw) + 0.5) * cell;
  const idx = (x, y) => Math.max(0, Math.min(gh - 1, Math.floor(y / cell))) * gw + Math.max(0, Math.min(gw - 1, Math.floor(x / cell)));

  const land = I.r2.landMaplab.data, lake = I.r2.lakeMaplab.data, river = I.r2.riverMaplab.data;
  const roadFoot = I.r2.roadFootMaplab.data, roadCart = I.r2.roadCartMaplab.data;
  const walkable = I.r1.walkableCandidate.data, crossing = I.r1.crossingCandidate.data;
  const biome = I.r1.biomeCode.data, coast = I.r1.coast.data;
  const cargo = I.r1.cargoCandidate.data;
  const seaDistCells = I.r1.seaDistanceCells.data;
  const TS = C.balance.terrainSpeed, CART = C.balance.cart;

  const footPassable = new Uint8Array(n), cartRoadPassable = new Uint8Array(n);
  const footMult = new Float64Array(n), cartMult = new Float64Array(n);
  const cellClass = new Uint8Array(n); // 0 offroad, 1 foot road, 2 cart road, 3 trail, 4 bridge, 5 ford, 6 water
  for (let i = 0; i < n; i++) {
    const water = !land[i] || lake[i] || river[i];
    const cross = crossing[i];
    const passFoot = (walkable[i] === 1) || cross > 0;
    footPassable[i] = passFoot ? 1 : 0;
    const cartBridge = cross === 2;
    cartRoadPassable[i] = (roadCart[i] === 1 || cartBridge) && !water ? 1 : 0;

    let fm;
    if (cross === 3) { fm = TS.shallow; cellClass[i] = 5; }
    else if (cross === 1 || cross === 2) { fm = TS.bridge; cellClass[i] = 4; }
    else if (roadCart[i]) { fm = TS.road; cellClass[i] = 2; }
    else if (roadFoot[i]) { fm = TS.road; cellClass[i] = 1; }
    else if (water) { fm = TS.shallow; cellClass[i] = 6; }
    else { fm = TS[BIOME_TO_SPEED_KEY[biome[i]]] ?? 1; cellClass[i] = 0; }
    footMult[i] = passFoot ? fm : 0;

    let cm;
    if (cartBridge || roadCart[i]) cm = CART.speedOnRoad;
    else if (roadFoot[i]) cm = CART.speedOffRoad;          // trail: NOT a cart road, modelled off-road only
    else if (ROUGH_SPEED_KEYS.includes(BIOME_TO_SPEED_KEY[biome[i]])) cm = CART.speedRough;
    else cm = CART.speedOffRoad;
    // Carts cannot ford water unless the tile is a cart-load bridge (Gameplay: "carts cannot ford water").
    cartMult[i] = (water && !cartBridge) ? 0 : cm;
  }

  return { gw, gh, cell, n, X, Y, idx, land, lake, river, roadFoot, roadCart, walkable, crossing, biome, coast, cargo, seaDistCells, footPassable, cartRoadPassable, footMult, cartMult, cellClass, TS, CART };
}

function nearestPassable(M, pt, passable) {
  const gx = Math.floor(pt[0] / M.cell), gy = Math.floor(pt[1] / M.cell);
  for (let r = 0; r <= 12; r++) {
    let best = -1, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = gx + dx, y = gy + dy;
      if (x < 0 || y < 0 || x >= M.gw || y >= M.gh) continue;
      const i = y * M.gw + x;
      if (!passable[i]) continue;
      const d = Math.hypot(M.X(i) - pt[0], M.Y(i) - pt[1]);
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) return { cell: best, snapAu: +bd.toFixed(4) };
  }
  return { cell: -1, snapAu: null };
}

// Binary min-heap keyed on accumulated cost.
class Heap {
  constructor() { this.a = []; }
  push(cost, node) { const a = this.a; a.push([cost, node]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < a.length && a[l][0] < a[s][0]) s = l; if (r < a.length && a[r][0] < a[s][0]) s = r; if (s === i) break; [a[s], a[i]] = [a[i], a[s]]; i = s; } } return top; }
  get size() { return this.a.length; }
}

const NEIGH = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

/** Dijkstra FROM a target cell: dist[i] = grass-equivalent cost from i to target. */
function dijkstraFrom(M, target, mode) {
  const n = M.n, dist = new Float64Array(n).fill(Infinity), next = new Int32Array(n).fill(-1);
  const passable = mode === 'cartRoad' ? M.cartRoadPassable : M.footPassable;
  const mult = mode === 'cartRoad' ? M.cartMult : M.footMult;
  if (!passable[target]) return { dist, next, mode, target };
  const h = new Heap(); dist[target] = 0; h.push(0, target);
  while (h.size) {
    const [d, i] = h.pop();
    if (d > dist[i] + 1e-9) continue;
    const gx = i % M.gw, gy = Math.floor(i / M.gw);
    for (const [dx, dy, w] of NEIGH) {
      const nx = gx + dx, ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= M.gw || ny >= M.gh) continue;
      const j = ny * M.gw + nx;
      if (!passable[j] || !mult[i]) continue;
      // diagonal corner-cutting guard
      if (dx && dy && (!passable[gy * M.gw + nx] || !passable[ny * M.gw + gx])) continue;
      const nd = d + (M.cell * w) / mult[i];
      if (nd < dist[j] - 1e-9) { dist[j] = nd; next[j] = i; h.push(nd, j); }
    }
  }
  return { dist, next, mode, target };
}

function reconstruct(M, start, dij) {
  if (!Number.isFinite(dij.dist[start])) return null;
  const cells = []; let i = start, guard = 0;
  while (i !== -1 && guard++ < M.n) {
    cells.push(i);
    if (i === dij.target) return cells;
    i = dij.next[i];
  }
  return null;
}

/** Connected components of any 0/1 raster (8-neighbour). */
export function components(M, mask) {
  const n = M.n, comp = new Int32Array(n).fill(-1), sizes = [];
  const stack = [];
  for (let s = 0; s < n; s++) {
    if (!mask[s] || comp[s] >= 0) continue;
    const id = sizes.length; let cnt = 0; comp[s] = id; stack.push(s);
    while (stack.length) {
      const i = stack.pop(); cnt++;
      const gx = i % M.gw, gy = Math.floor(i / M.gw);
      for (const [dx, dy] of NEIGH) {
        const nx = gx + dx, ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= M.gw || ny >= M.gh) continue;
        const j = ny * M.gw + nx;
        if (mask[j] && comp[j] < 0) { comp[j] = id; stack.push(j); }
      }
    }
    sizes.push(cnt);
  }
  const order = sizes.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
  return { comp, sizes, componentCount: sizes.length, largest: { id: order[0][1], cells: order[0][0] }, top: order.slice(0, 8).map(([cells, id]) => ({ id, cells })) };
}

export const cartNetwork = M => components(M, M.cartRoadPassable);
export const footNetwork = M => components(M, M.footPassable);

/** Sea-distance semantic coverage: world.ts stops its BFS at 6 hops. */
export function seaDistanceCoverage(M, U, stopTiles) {
  const tilesPerSourceCell = 8 / U;
  let covered = 0, landTotal = 0;
  for (let i = 0; i < M.n; i++) {
    if (!M.land[i]) continue;
    landTotal++;
    if (M.seaDistCells[i] * tilesPerSourceCell <= stopTiles) covered++;
  }
  return { tilesPerSourceCell, stopTiles, landCellsWithMeaningfulSeaDist: covered, landCells: landTotal, fraction: +(covered / landTotal).toFixed(6) };
}

/** Road-bend curvature from the GEO-02 verbatim catmull()+resample() geometry. */
export function roadBends(I) {
  const out = [];
  for (const r of I.geography.objects.roads) {
    const pts = r.points || [];
    if (pts.length < 3 || r.kind === 'ferry') continue;
    const sm = catmull(pts);
    const rs = resample(sm.pts, 8, sm.idx);
    for (let i = 1; i < rs.pts.length - 1; i++) {
      const a = rs.pts[i - 1], b = rs.pts[i], c = rs.pts[i + 1];
      const A = Math.hypot(b[0] - a[0], b[1] - a[1]), B = Math.hypot(c[0] - b[0], c[1] - b[1]), Cc = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
      const radius = area2 < 1e-9 ? Infinity : (A * B * Cc) / (2 * area2);
      const turn = Math.abs(((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) / (A * B || 1));
      out.push({ roadId: r.id, kind: r.kind, at: [+b[0].toFixed(3), +b[1].toFixed(3)], radiusAu: Number.isFinite(radius) ? +radius.toFixed(4) : null, turnCos: +turn.toFixed(4) });
    }
  }
  return out;
}

const CAT = {
  STARTER_WATER: 'MAP-SPAWN-04', STARTER_FOOD: 'MAP-SPAWN-04', STARTER_TOOL: 'MAP-SPAWN-04',
  STARTER_BUILD: 'MAP-SPAWN-04', NEAR_POI: 'MAP-SPAWN-04 / MAP-POI-02', FAR_POI: 'MAP-SPAWN-04 / MAP-LOG-03',
  ELDER_APPROACH: 'MAP-U5', CART_CORRIDOR: 'MAP-LOG-03', HOME_ALTERNATIVE: 'MAP-HOME-03',
  LOG_FOOT_VS_CART: 'MAP-LOG-03', CASH_ROUTE: 'MAP-U4', ELDER_SITE: 'MAP-U5',
  CORRIDOR: 'MAP-LOG-03', RESOURCE_AREA: 'MAP-SPAWN-04',
};

function nearestBy(from, list, filter = () => true) {
  let best = null, bd = Infinity;
  for (const o of list) {
    if (!filter(o)) continue;
    const d = Math.hypot(o.at[0] - from[0], o.at[1] - from[1]);
    if (d < bd) { bd = d; best = o; }
  }
  return best ? { object: best, straightAu: +bd.toFixed(4) } : null;
}

/** Builds the explicit journey list. Every OD is a pair of CANONICAL source IDs. */
export function buildJourneys(I) {
  const O = I.geography.objects, C = I.corridor;
  const J = [];
  const add = (id, category, from, to, note) => J.push({
    id, category, mapTest: CAT[category] || null,
    from, to, note: note || null, sourceRefs: [from.sourceRef, to.sourceRef].filter(Boolean),
  });
  const pt = (id, at, sourceRef, extra = {}) => ({ id, at, sourceRef, ...extra });
  const zoneCentroid = z => {
    const r = z.ring || []; let x = 0, y = 0;
    for (const p of r) { x += p[0]; y += p[1]; }
    return [+(x / r.length).toFixed(4), +(y / r.length).toFixed(4)];
  };
  const zones = O.zones.map(z => ({ ...z, at: zoneCentroid(z), areaAu2: Math.abs(z.ring.reduce((s, p, i) => { const q = z.ring[(i + 1) % z.ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2 }));
  const spawns = O.spawns;
  const pois = O.pois;
  const elders = O.elders;
  const resources = O.resources;

  for (const s of spawns) {
    const from = pt(s.id, s.at, `spawns[${s.id}].at`, { region: s.region });
    const water = nearestBy(s.at, resources, r => r.kind === 'fresh_water');
    const food = nearestBy(s.at, resources, r => ['food', 'fish', 'herbs'].includes(r.kind));
    const tool = nearestBy(s.at, resources, r => ['wood', 'stone', 'ore'].includes(r.kind));
    const build = nearestBy(s.at, zones);
    const nearPoi = nearestBy(s.at, pois);
    const farPoi = pois.reduce((a, b) => Math.hypot(b.at[0] - s.at[0], b.at[1] - s.at[1]) > Math.hypot(a.at[0] - s.at[0], a.at[1] - s.at[1]) ? b : a);
    const elderAp = (() => {
      let best = null, bd = Infinity;
      for (const e of elders) for (const p of (e.approach || [])) {
        const d = Math.hypot(p[0] - s.at[0], p[1] - s.at[1]);
        if (d < bd) { bd = d; best = { elderId: e.id, at: p }; }
      }
      return best;
    })();
    const nearestCartRoad = (() => {
      let best = null, bd = Infinity;
      for (const r of O.roads) if (r.kind === 'cart') for (const p of (r.points || [])) {
        const d = Math.hypot(p[0] - s.at[0], p[1] - s.at[1]);
        if (d < bd) { bd = d; best = { roadId: r.id, at: p }; }
      }
      return best;
    })();
    const base = `${s.id}`;
    add(`${base}.starterWater`, 'STARTER_WATER', from, pt(water.object.id, water.object.at, `resources[${water.object.id}].at`, { kind: water.object.kind }), 'nearest authored fresh_water source');
    add(`${base}.starterFood`, 'STARTER_FOOD', from, pt(food.object.id, food.object.at, `resources[${food.object.id}].at`, { kind: food.object.kind }), 'nearest authored food/fish/herbs source');
    add(`${base}.starterToolMaterial`, 'STARTER_TOOL', from, pt(tool.object.id, tool.object.at, `resources[${tool.object.id}].at`, { kind: tool.object.kind }), 'nearest authored wood/stone/ore source');
    add(`${base}.starterBuildZone`, 'STARTER_BUILD', from, pt(build.object.id, build.object.at, `zones[${build.object.id}].ring centroid`, { areaAu2: +build.object.areaAu2.toFixed(4) }), 'nearest authored build-zone centroid');
    add(`${base}.nearPOI`, 'NEAR_POI', from, pt(nearPoi.object.id, nearPoi.object.at, `pois[${nearPoi.object.id}].at`, { arche: nearPoi.object.arche }), 'nearest authored POI');
    add(`${base}.farPOI`, 'FAR_POI', from, pt(farPoi.id, farPoi.at, `pois[${farPoi.id}].at`, { arche: farPoi.arche }), 'most distant authored POI by straight-line distance');
    add(`${base}.elderApproach`, 'ELDER_APPROACH', from, pt(elderAp.elderId, elderAp.at, `elders[${elderAp.elderId}].approach[]`), 'nearest authored Elder approach point');
    add(`${base}.cartCorridor`, 'CART_CORRIDOR', from, pt(nearestCartRoad.roadId, nearestCartRoad.at, `roads[${nearestCartRoad.roadId}].points[]`, { kind: 'cart' }), 'nearest authored cart-road vertex (trails are excluded)');
  }

  // MAP-HOME-03: three deliberately DIFFERENT candidate homes from one spawn.
  const home = spawns.find(s => s.id === C.spawnSelection.chosen) || spawns[0];
  const homeFrom = pt(home.id, home.at, `spawns[${home.id}].at / corridor.v1.json spawnSelection.chosen`);
  const altIds = ['bz_silver', 'bz_hook', 'bz_ironholm'];
  for (const id of altIds) {
    const z = zones.find(q => q.id === id);
    if (z) add(`home.${id}`, 'HOME_ALTERNATIVE', homeFrom, pt(z.id, z.at, `zones[${z.id}].ring centroid`, { areaAu2: +z.areaAu2.toFixed(4) }), 'one of three alternative player-chosen home zones; legality NOT asserted');
  }

  // MAP-LOG-03: one source POI with a foot trail and a separate cart-road access.
  const kilns = pois.find(p => p.id === 'po_kilns');
  const kilnsFrom = pt(kilns.id, kilns.at, `pois[${kilns.id}].at`);
  const warehouse = pois.find(p => p.arche === 'warehouse');
  const ironwh = pois.find(p => p.id === 'po_ironwh') || warehouse;
  add('log.kilnsToFarWarehouse', 'LOG_FOOT_VS_CART', kilnsFrom, pt(ironwh.id, ironwh.at, `pois[${ironwh.id}].at`, { arche: ironwh.arche }), 'far warehouse whose value should increase after a cart is obtained (Bible MAP-LOG-03)');
  add('log.kilnsToSpawnLake', 'LOG_FOOT_VS_CART', kilnsFrom, homeFrom, 'RT-1 reverse: source POI -> chosen spawn');
  const rd16 = O.roads.find(r => r.id === 'rd_16');
  const rdn = O.roads.find(r => r.id === 'rd_n');
  if (rd16) add('log.kilnsToFootTrail', 'LOG_FOOT_VS_CART', kilnsFrom, pt(rd16.id, rd16.points[0], `roads[${rd16.id}].points[0]`, { kind: rd16.kind }), 'authored foot/trail access (kind=trail — NEVER cart-passable)');
  if (rdn) add('log.kilnsToCartRoad', 'LOG_FOOT_VS_CART', kilnsFrom, pt(rdn.id, rdn.points[0], `roads[${rdn.id}].points[0]`, { kind: rdn.kind }), 'nearest cart road from GEO-02 audit (56.8792 au, > ACCESS_R=48)');

  // MAP-U5: six distinct Elder territories / approaches, no shared arena.
  for (const e of elders) {
    const p = (e.approach || [])[0] || (e.outer || [])[0];
    add(`u5.${e.id}`, 'ELDER_SITE', homeFrom, pt(e.id, p, `elders[${e.id}].approach[0]`, { elder: e.elder, pois: e.pois }), 'distinct Elder region + no-boss approach; six sites required by geography-contract.ts');
  }

  // MAP-U4: finite cash -> chest vendor -> home claim -> evacuation. Seller route is PROPOSED only.
  const vendor = pois.find(p => p.arche === 'chest_vendor');
  const cache = pois.find(p => p.arche === 'ragnarok_cache');
  const evac = pois.find(p => p.arche === 'evac');
  if (vendor && cache) add('u4.vendorToCache', 'CASH_ROUTE', pt(vendor.id, vendor.at, `pois[${vendor.id}].at`), pt(cache.id, cache.at, `pois[${cache.id}].at`), 'PROPOSED seller route; price/stock/distance NOT approved');
  if (cache) add('u4.cacheToHome', 'CASH_ROUTE', pt(cache.id, cache.at, `pois[${cache.id}].at`), pt('bz_greywater', zones.find(z => z.id === 'bz_greywater').at, 'zones[bz_greywater].ring centroid'), 'physical cash carried back to claim; NO teleport');
  if (evac) add('u4.homeToEvac', 'CASH_ROUTE', pt('bz_greywater', zones.find(z => z.id === 'bz_greywater').at, 'zones[bz_greywater].ring centroid'), pt(evac.id, evac.at, `pois[${evac.id}].at`), 'optional no-boss evacuation');

  // GEO-01 authored transport corridors (source-linked lengths retained separately).
  const corridorRoutes = [C.routes.primary, ...(Array.isArray(C.routes.alternatives) ? C.routes.alternatives : [])].filter(Boolean);
  for (const r of corridorRoutes) {
    const g = r.geometryAu || [];
    if (g.length < 2) continue;
    add(`corridor.${r.id}`, 'CORRIDOR', pt(r.id, g[0], `corridor.v1.json routes.${r.id}.geometryAu[0]`), pt(r.id, g[g.length - 1], `corridor.v1.json routes.${r.id}.geometryAu[last]`), `authored corridor length ${r.totalDistanceAu} au; roadIds ${(r.sourceIds || []).join(',')}`);
  }
  return J;
}

/** Computes straight-line + terrain-weighted raster route for every journey. */
export function measureJourneys(I, M, journeys, network, footNet) {
  const cache = new Map();
  const cartCont = j => {
    const a = nearestPassable(M, j.from.at, M.cartRoadPassable);
    const b = nearestPassable(M, j.to.at, M.cartRoadPassable);
    if (a.cell < 0 || b.cell < 0) return { continuous: false, fromCell: a.cell, toCell: b.cell, reason: 'ENDPOINT_NOT_ON_CART_ROAD' };
    return {
      continuous: network.comp[a.cell] >= 0 && network.comp[a.cell] === network.comp[b.cell],
      fromComponent: network.comp[a.cell], toComponent: network.comp[b.cell],
      fromSnapAu: a.snapAu, toSnapAu: b.snapAu,
      reason: network.comp[a.cell] === network.comp[b.cell] ? 'SAME_CART_ROAD_COMPONENT' : 'CART_ROAD_NETWORK_IS_FRAGMENTED',
    };
  };
  const getDij = (cell, mode) => {
    const k = `${mode}:${cell}`;
    if (!cache.has(k)) cache.set(k, dijkstraFrom(M, cell, mode));
    return cache.get(k);
  };
  const out = [];
  for (const j of journeys) {
    const s = nearestPassable(M, j.from.at, M.footPassable);
    const t = nearestPassable(M, j.to.at, M.footPassable);
    const straightAu = +Math.hypot(j.to.at[0] - j.from.at[0], j.to.at[1] - j.from.at[1]).toFixed(4);
    const cont = cartCont(j);
    const rec = {
      ...j, straightAu, fromSnapAu: s.snapAu, toSnapAu: t.snapAu,
      fromCell: s.cell, toCell: t.cell,
      routeStatus: null, routeAu: null, effectiveFootAu: null, effectiveCartAu: null,
      cartScenarioApplicable: false, cartRoadContinuous: cont.continuous, cartRoadContinuity: cont,
      fromFootComponent: footNet.comp[s.cell], toFootComponent: footNet.comp[t.cell],
      cartPassable: false, // no Veyra authored route is proven cart-passable by this benchmark
      composition: null, physicalClearance: [], evidence: [],
    };
    rec.sameWalkableLandComponent = rec.fromFootComponent >= 0 && rec.fromFootComponent === rec.toFootComponent;
    if (s.cell < 0 || t.cell < 0) { rec.routeStatus = 'NO_PASSABLE_ENDPOINT'; out.push(rec); continue; }
    const dij = getDij(t.cell, 'foot');
    const cells = reconstruct(M, s.cell, dij);
    if (!cells) {
      rec.routeStatus = rec.sameWalkableLandComponent
        ? 'NO_GEOGRAPHIC_ROUTE__DISCONNECTED_WITHIN_SAME_COMPONENT'
        : 'NO_GEOGRAPHIC_ROUTE__SEPARATE_LAND_COMPONENT__FERRY_OR_BRIDGE_RULE_REQUIRED';
      rec.routeNote = 'GEO-01 records 8 landmasses, 12 bridges and roads of kind=ferry. No Gameplay ferry/boat/cargo rule is approved in PR44 HEAD, so this OD is UNRESOLVED and must not be given a fabricated travel time.';
      out.push(rec); continue;
    }
    // Snap legs from the exact authored coordinate to the first/last passable
    // cell centre are off-road legs; neutral (1.0) for foot, off-road for cart.
    const snapFrom = s.snapAu || 0, snapTo = t.snapAu || 0;
    let routeAu = snapFrom + snapTo, effFoot = snapFrom + snapTo, effCart = (snapFrom + snapTo) / M.CART.speedOffRoad;
    const comp = { footRoadCells: 0, cartRoadCells: 0, trailOnlyCells: 0, bridgeCells: 0, fordCells: 0, offRoadCells: 0, waterCells: 0, coastCells: 0, totalCells: cells.length };
    let cartBlocked = false;
    for (let k = 0; k < cells.length; k++) {
      const i = cells[k], cls = M.cellClass[i];
      if (cls === 1) comp.footRoadCells++;
      else if (cls === 2) comp.cartRoadCells++;
      else if (cls === 4) comp.bridgeCells++;
      else if (cls === 5) comp.fordCells++;
      else if (cls === 6) comp.waterCells++;
      else comp.offRoadCells++;
      if (M.roadFoot[i] && !M.roadCart[i] && cls !== 4) comp.trailOnlyCells++;
      if (M.coast[i]) comp.coastCells++;
      if (k > 0) {
        const prev = cells[k - 1];
        const dxy = Math.abs((i % M.gw) - (prev % M.gw)) + Math.abs(Math.floor(i / M.gw) - Math.floor(prev / M.gw));
        const step = M.cell * (dxy === 2 ? Math.SQRT2 : 1);
        routeAu += step;
        effFoot += step / M.footMult[i];
        if (!M.cartMult[i]) cartBlocked = true;
        else effCart += step / M.cartMult[i];
      }
    }
    rec.routeStatus = 'GEOGRAPHIC_ROUTE_ESTIMATE__ACCEPTED_RASTER_DIJKSTRA';
    rec.routeAu = +routeAu.toFixed(4);
    rec.effectiveFootAu = +effFoot.toFixed(4);
    rec.effectiveCartAu = cartBlocked ? null : +effCart.toFixed(4);
    rec.cartScenarioApplicable = !cartBlocked;
    rec.composition = comp;
    rec.detourRatio = straightAu > 0 ? +(routeAu / straightAu).toFixed(4) : null;
    // Never label an incomplete trail as cart-passable.
    const reasons = [];
    if (comp.trailOnlyCells > 0) reasons.push('AUTHORED_TRAIL_SEGMENTS__NOT_CART_PASSABLE');
    if (comp.bridgeCells > 0) reasons.push('BRIDGE_SWEPT_CLEARANCE_UNVALIDATED');
    if (comp.fordCells > 0) reasons.push('FORD_IS_EDITOR_HEURISTIC__CART_CANNOT_FORD_WATER');
    if (comp.waterCells > 0) reasons.push('WATER_CELL_ON_ROUTE__CART_CANNOT_FORD');
    reasons.push('NO_SWEPT_CLEARANCE_DIMENSION_EXISTS_IN_VEYRA_SOURCE');
    rec.physicalClearance = reasons;
    rec.cartPassable = false; // no candidate may be asserted from this benchmark
    rec.evidence = [
      'world_lab/geo01/output/rasters/{walkableCandidate,crossingCandidate,biomeCode,coast}.u8',
      'world_lab/geo02/output/rasters/{landMaplab,lakeMaplab,riverMaplab,roadFootMaplab,roadCartMaplab}.u8',
      'world_lab/geo02/output/maplab_encoding.v1.json :: widthSemantics.roads.sweptClearance = UNVALIDATED',
    ];
    out.push(rec);
  }
  return out;
}

/** Basic-resource suitability areas around each spawn (measured, not asserted legal). */
export function resourceSuitability(I, M) {
  const O = I.geography.objects;
  const radii = [100, 200, 300];
  const out = [];
  for (const s of O.spawns) {
    const byKind = {};
    for (const kind of ['fresh_water', 'food', 'fish', 'herbs', 'wood', 'stone', 'ore', 'clay']) {
      const rs = O.resources.filter(r => r.kind === kind);
      byKind[kind] = { total: rs.length, withinRadius: {}, nearestAu: +Math.min(...rs.map(r => Math.hypot(r.at[0] - s.at[0], r.at[1] - s.at[1]))).toFixed(4) };
      for (const R of radii) byKind[kind].withinRadius[R] = rs.filter(r => Math.hypot(r.at[0] - s.at[0], r.at[1] - s.at[1]) <= R).length;
    }
    let buildableWithin300 = 0, landWithin300 = 0;
    for (let i = 0; i < M.n; i++) {
      if (Math.hypot(M.X(i) - s.at[0], M.Y(i) - s.at[1]) > 300) continue;
      if (M.land[i]) landWithin300++;
      if (I.r1.buildableCandidate.data[i]) buildableWithin300++;
    }
    out.push({
      spawnId: s.id, region: s.region, at: s.at, byKind,
      radiiAu: radii, landCellsWithin300: landWithin300,
      buildableCandidateCellsWithin300: buildableWithin300,
      note: 'SOURCE_ANNOTATION_GEOMETRY_ONLY: conf=proposal; Gameplay source IDs, stock, respawn, slope/collision legality are NOT asserted.',
    });
  }
  return out;
}
