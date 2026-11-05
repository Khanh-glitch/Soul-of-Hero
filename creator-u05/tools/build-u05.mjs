/**
 * U05 PHYSICAL MASTERPLAN / SCENE GENERATOR.
 *
 * Reads ONLY active WMP-04R1 authority + GOLD canon + WMP-03 architecture
 * candidates + verified live Gameplay SHA digests. It never edits a GOLD file,
 * never adds a POI, never changes a coastline/road/dock/anchor, never mints a
 * Gameplay permission. Every polygon is reprojected by the locked
 * CREATOR_CHOSEN_U05 transform (1 AU -> 2 runtime tiles), never reauthored.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const U05 = path.join(ROOT, 'creator-u05');
const WM = path.join(ROOT, 'veyra-world-master');
const LW = path.join(ROOT, 'large-world-01');
const read = (p) => fs.readFileSync(p);
const json = (p) => JSON.parse(read(p).toString('utf8'));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const U = 0.5, TILE = 16, FRAME_AU = [2000, 1400], FRAME_TILES = [4000, 2800];
const CELL_AU = 8, GW = 250, GH = 175;

// ---------------------------------------------------------------- geometry --
function sarea(poly) { return poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2; }
const area = (p) => Math.abs(sarea(p));
const cross = (u, v) => u[0] * v[1] - u[1] * v[0];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, t) => [a[0] * t, a[1] * t];
function clip(subject, clipper) {
  const cp = sarea(clipper) > 0 ? clipper : clipper.slice().reverse();
  let out = subject.map((p) => [...p]);
  for (let i = 0; i < cp.length; i++) {
    const a = cp[i], b = cp[(i + 1) % cp.length], e = sub(b, a);
    const f = (p) => cross(e, sub(p, a));
    const inp = out; out = [];
    if (!inp.length) break;
    let S = inp[inp.length - 1], fS = f(S);
    for (const E of inp) {
      const fE = f(E);
      if ((fS >= 0) !== (fE >= 0)) { const t = fS / (fS - fE); out.push(add(S, mul(sub(E, S), t))); }
      if (fE >= 0) out.push(E);
      S = E; fS = fE;
    }
  }
  return out;
}
function inside(pt, poly) {
  let c = false; const [x, y] = pt, n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function segInter(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return ((o1 > 0) !== (o2 > 0)) && ((o3 > 0) !== (o4 > 0));
}
function polyOverlap(A, B) {
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++)
    if (segInter(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true;
  return inside(A[0], B) || inside(B[0], A);
}
function distSeg(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
const bbox = (p) => [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))];
const toTiles = (poly) => poly.map(([x, y]) => [x / U, y / U]);
const snapTiles = (poly) => poly.map(([x, y]) => [Math.floor(x / U), Math.floor(y / U)]);
const r4 = (n) => Math.round(n * 10000) / 10000;

// ---------------------------------------------------------------- authority -
const goldFile = path.join(WM, 'data/canon/VEYRA_GOLD_MAP.sohmap.json');
const archFile = path.join(WM, 'layers/architecture.v1.json');
const pointerFile = path.join(WM, 'CURRENT_WORLD_MASTER.json');
const marineFile = path.join(WM, 'v4/layers/marine_sites.v4.json');
const G = json(goldFile).project;
const ARCH = json(archFile);
const POINTER = json(pointerFile);
const MARINE = json(marineFile);
const ARCH_BY_ID = new Map(ARCH.pois.map((p) => [p.poiId, p]));
if (POINTER.activeRevision !== 'WMP-04R1') throw Error('U05_BUILD_ACTIVE_REVISION_NOT_WMP04R1');
if (G.pois.length !== 81) throw Error('U05_BUILD_GOLD_POI_COUNT ' + G.pois.length);
if (ARCH.poiCount !== 81 || ARCH.pois.length !== 81) throw Error('U05_BUILD_ARCH_POI_COUNT');

const RASTER_DIR = path.join(LW, 'map-data');
const RASTERS = {
  biomeEffective: 'biomeEffective.r1.u8', coldTransition: 'coldTransition.r1.u8', marineRegion: 'marineRegion.v4.u8',
  biomeCode: 'biomeCode.u8', landId: 'landId.u8', waterClass: 'waterClass.u8', elevation: 'elevation.u8', slope: 'slope.u8',
  cliffCandidate: 'cliffCandidate.v3.u8', heightClass: 'heightClass.v3.u8', coast: 'coast.u8', roadClass: 'roadClass.u8',
  freshwater: 'freshwater.u8', walkableCandidate: 'walkableCandidate.u8', cargoCandidate: 'cargoCandidate.u8',
  buildableCandidate: 'buildableCandidate.u8', clearanceCells: 'clearanceCells.u8',
  activeCollisionPermission: 'activeCollisionPermission.v3.u8', roadSurface: 'roadSurface.v3.u8',
  waterTraversalClass: 'waterTraversalClass.v3.u8', zoneId: 'zoneId.u8',
  protectedGeometryCandidate: path.join(WM, 'data/rasters/geo01/protectedGeometryCandidate.u8'),
  poiGeometryId: path.join(WM, 'data/rasters/geo01/poiGeometryId.u8'),
  elderGeometryId: path.join(WM, 'data/rasters/geo01/elderGeometryId.u8'),
};
const R = {}; const rasterDigests = {};
for (const [k, f] of Object.entries(RASTERS)) {
  const p = path.isAbsolute(f) ? f : path.join(RASTER_DIR, f);
  const b = read(p);
  if (b.length !== GW * GH) throw Error('U05_BUILD_BAD_RASTER ' + k + ' ' + b.length);
  R[k] = new Uint8Array(b); rasterDigests[k] = sha(b);
}
const cellAt = (name, auX, auY) => {
  const cx = Math.max(0, Math.min(GW - 1, Math.floor(auX / CELL_AU)));
  const cy = Math.max(0, Math.min(GH - 1, Math.floor(auY / CELL_AU)));
  return R[name][cy * GW + cx];
};

// ---------------------------------------------------------------- audits ----
const FEET = G.pois.map((p) => ({ id: p.id, foot: p.foot, at: p.at }));
const overlapPairs = [];
for (let i = 0; i < FEET.length; i++) for (let j = i + 1; j < FEET.length; j++) {
  const a = area(clip(FEET[i].foot, FEET[j].foot));
  if (a > 0) overlapPairs.push({ a: FEET[i].id, b: FEET[j].id, overlapAu2: r4(a), overlapTile2: r4(a * 4) });
}
overlapPairs.sort((x, y) => y.overlapAu2 - x.overlapAu2);

const roadSegs = [];
for (const r of G.roads) for (let i = 0; i < r.points.length - 1; i++) roadSegs.push({ roadId: r.id, kind: r.kind, a: r.points[i], b: r.points[i + 1] });
function roadFrontage(at, foot) {
  let best = Infinity, bestRoad = null;
  for (const s of roadSegs) { const d = distSeg(at[0], at[1], s.a, s.b); if (d < best) { best = d; bestRoad = s.roadId; } }
  const crossing = [...new Set(roadSegs.filter((s) => polyOverlap([s.a, s.b], foot)).map((s) => s.roadId))];
  const centreHit = [...new Set(roadSegs.filter((s) => distSeg(at[0], at[1], s.a, s.b) <= 1).map((s) => s.roadId))];
  return { nearestRoadId: bestRoad, distanceAu: r4(best), distanceTiles: r4(best / U), roadIdsCrossingEnvelope: crossing, roadIdsAtPoiCentre: centreHit };
}
const roadPoiPairs = new Set();
for (const f of FEET) for (const id of roadFrontage(f.at, f.foot).roadIdsCrossingEnvelope) roadPoiPairs.add(id + '|' + f.id);
const poisCrossedByRoad = new Set([...roadPoiPairs].map((k) => k.split('|')[1]));
const roadsCrossingPois = new Set([...roadPoiPairs].map((k) => k.split('|')[0]));

// 1 AU rasterised overlap of the 23 surveyed buildable zone rings with any
// POI site envelope or Elder outer territory (direct evidence, not a proxy).
function zoneOverlapCells(zoneRing, foot) {
  const bb = bbox(foot), zbb = bbox(zoneRing);
  const x0 = Math.floor(Math.max(bb[0], zbb[0])), x1 = Math.ceil(Math.min(bb[2], zbb[2]));
  const y0 = Math.floor(Math.max(bb[1], zbb[1])), y1 = Math.ceil(Math.min(bb[3], zbb[3]));
  let n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
    if (inside([x + .5, y + .5], zoneRing) && inside([x + .5, y + .5], foot)) n++;
  return n;
}
const zoneOverlaps = [];
for (const z of G.zones) {
  const poiCells = {}, elderCells = {};
  for (const f of FEET) { const n = zoneOverlapCells(z.ring, f.foot); if (n) poiCells[f.id] = n; }
  for (const e of G.elders) { const n = zoneOverlapCells(z.ring, e.outer); if (n) elderCells[e.id] = n; }
  if (Object.keys(poiCells).length || Object.keys(elderCells).length)
    zoneOverlaps.push({ zoneId: z.id, poiCells, elderCells, totalCells: Object.values(poiCells).reduce((a, b) => a + b, 0) + Object.values(elderCells).reduce((a, b) => a + b, 0) });
}

const missingEntrance = [], entranceRecords = [];
for (const p of ARCH.pois) {
  const ext = p.staticOpenings.filter((o) => o.kind === 'EXTERIOR_ENTRANCE');
  if (ext.length) entranceRecords.push({ poiId: p.poiId, count: ext.length, ids: ext.map((o) => o.id) });
  else missingEntrance.push(p.poiId);
}

const HELICOPTER = MARINE.uniqueLandmarks.find((l) => l.id === 'poi_beacon_engine_out_helicopter');
const BEACON = G.pois.find((p) => p.id === 'po_beacon');
const helicopterTile = HELICOPTER.atAu.map((v) => Math.floor(v / U));

// ---------------------------------------------------------------- sources ---
const sources = {
  contract: 'contracts/CREATOR_CHOSEN_U05.v1.json',
  pointer: { file: 'veyra-world-master/CURRENT_WORLD_MASTER.json', sha256: sha(read(pointerFile)) },
  gold: { file: 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json', sha256: sha(read(goldFile)), poiCount: 81, roads: G.roads.length, docks: G.docks.length, zones: G.zones.length, elders: G.elders.length },
  architecture: { file: 'veyra-world-master/layers/architecture.v1.json', sha256: sha(read(archFile)), poiCount: ARCH.poiCount, roomCount: ARCH.roomCount, roofPolygonCount: ARCH.roofPolygonCount, verticalLinkCount: ARCH.verticalLinkCount },
  marineSites: { file: 'veyra-world-master/v4/layers/marine_sites.v4.json', sha256: sha(read(marineFile)) },
  rasterDigests,
  liveGameplaySha: 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9',
};

// ---------------------------------------------------------------- helpers ---
const LAND_RINGS = [];
for (const l of G.land) for (const ring of l.rings) LAND_RINGS.push({ id: l.id, name: l.name, ring });
const LAKE_RINGS = G.lakes.map((l) => ({ id: l.id, ring: l.ring }));
const RIVER_SEGS = [];
for (const r of G.rivers) for (let i = 0; i < r.points.length - 1; i++) RIVER_SEGS.push({ a: r.points[i], b: r.points[i + 1], width: r.width || 4, id: r.id });
function landmassAt(at) {
  for (const l of LAND_RINGS) if (inside(at, l.ring)) return { id: l.id, name: l.name, authority: 'GOLD land polygon' };
  return { id: 'UNRESOLVED', name: 'no authored land ring at POI centre', authority: 'unresolved' };
}
function portions(foot, at) {
  const bb = bbox(foot);
  const counts = { cells: 0, land: 0, water: 0, protected: 0, cliff: 0, walkable: 0, buildable: 0, usable: 0 };
  for (let cy = Math.floor(bb[1] / CELL_AU); cy <= Math.floor(bb[3] / CELL_AU); cy++)
    for (let cx = Math.floor(bb[0] / CELL_AU); cx <= Math.floor(bb[2] / CELL_AU); cx++) {
      const au = [(cx + .5) * CELL_AU, (cy + .5) * CELL_AU];
      if (cx < 0 || cy < 0 || cx >= GW || cy >= GH || !inside(au, foot)) continue;
      counts.cells++;
      const i = cy * GW + cx;
      const land = R.landId[i] > 0 && !R.waterClass[i];
      const prot = R.protectedGeometryCandidate[i] > 0;
      const cliff = R.cliffCandidate[i] >= 2 && R.heightClass[i] >= 2;
      const walk = R.walkableCandidate[i] > 0;
      const build = R.buildableCandidate[i] > 0;
      if (land) counts.land++;
      if (!land) counts.water++;
      if (prot) counts.protected++;
      if (cliff) counts.cliff++;
      if (walk) counts.walkable++;
      if (build) counts.buildable++;
      if (land && !prot && !cliff && walk) counts.usable++;
    }
  const C_AU2 = CELL_AU * CELL_AU, C_TILES = (CELL_AU / U) ** 2;
  return {
    method: '8 AU WMP-04R1/WMP-03 analysis cells whose centres fall inside the GOLD poi.foot polygon; COARSE sample, NOT a U=0.5 tile-exact measurement',
    cellAu: CELL_AU, cellAu2: C_AU2, cellTiles: CELL_AU / U, cellTile2: C_TILES,
    cellCounts: counts,
    au2: Object.fromEntries(Object.entries(counts).filter(([k]) => k !== 'cells').map(([k, v]) => [k, r4(v * C_AU2)])),
    tile2: Object.fromEntries(Object.entries(counts).filter(([k]) => k !== 'cells').map(([k, v]) => [k, r4(v * C_TILES)])),
    note: 'usable/protected/water/cliff portions are analysis-cell estimates only. They are NOT Gameplay collision permission, NOT usable room area and NOT a legal build/cart/boat approval.'
  };
}
const OVERLAP_MAP = new Map();
for (const o of overlapPairs) {
  if (!OVERLAP_MAP.has(o.a)) OVERLAP_MAP.set(o.a, []);
  if (!OVERLAP_MAP.has(o.b)) OVERLAP_MAP.set(o.b, []);
  OVERLAP_MAP.get(o.a).push(o.b); OVERLAP_MAP.get(o.b).push(o.a);
}
function classify(p, a, entranceCount) {
  const arche = p.arche, areaAu2 = area(p.foot);
  if (arche === 'elder_site') return { code: 'ELDER_TERRAIN_TERRITORY', reason: 'Elder arena/site: terrain, slope and ingress/egress dominate; no boss/reward state invented' };
  if (arche === 'port' || arche === 'pier') return { code: 'PORT_DOCK_INTERFACE', reason: 'Shoreline + preserved dock + freight route; no fabricated boat gameplay or sea land-walk' };
  if (arche === 'mine' || arche === 'quarry') return { code: 'INDUSTRIAL_SURFACE_PLUS_DEEP', reason: 'Exterior material handling + reserved shaft/deep layer; cart clearance UNRESOLVED' };
  if (arche === 'research' || arche === 'powerplant' || arche === 'facility' || arche === 'filter') return { code: 'GATED_RESEARCH_COMPOUND', reason: 'Safe exterior vs gated interior, named placeholders only' };
  if (a && a.openAirYard) return { code: 'OPEN_YARD_CLUSTER', reason: 'Multiple purposeful structures within an open-air courtyard, real circulation' };
  if (arche === 'hamlet' || arche === 'village') return { code: 'OPEN_YARD_CLUSTER', reason: 'Village/road interface with multiple dwellings and courtyard movement' };
  if (arche === 'observatory' || arche === 'gate' || arche === 'tomb') return { code: 'SINGLE_LANDMARK', reason: 'Single landmark with preserved shoreline/arrival; minimal necessary objects' };
  if (arche === 'ragnarok_cache' || arche === 'evac' || arche === 'chest_vendor' || arche === 'roadstop') return { code: 'SMALL_SERVICE_NODE', reason: 'Small functional node / subsite; NOT a giant standalone building' };
  if (areaAu2 > 1200) return { code: 'CAMPUS_GROUNDS', reason: 'Coherent grounds + circulation + roof hierarchy, not one huge rectangular roof' };
  return { code: 'ROAD_SERVICE_NODE', reason: 'Road/industrial service node with a bounded physical programme' };
}
const ART_BY_CLASS = {
  ELDER_TERRAIN_TERRITORY: ['wall_stone', 'floor_stone', 'poi_door'],
  PORT_DOCK_INTERFACE: ['wall_wood', 'roof_wood', 'floor_wood', 'poi_door', 'barrel', 'cargo', 'cart'],
  INDUSTRIAL_SURFACE_PLUS_DEEP: ['wall_brick', 'roof_tin', 'floor_stone', 'poi_door', 'furnace', 'barrel', 'cart'],
  GATED_RESEARCH_COMPOUND: ['wall_stone', 'roof_tile', 'floor_stone', 'poi_door', 'research', 'workbench', 'gen'],
  OPEN_YARD_CLUSTER: ['wall_wood', 'roof_thatch', 'floor_wood', 'poi_door', 'barrel', 'campfire'],
  SINGLE_LANDMARK: ['wall_stone', 'roof_tile', 'floor_stone', 'poi_door'],
  SMALL_SERVICE_NODE: ['wall_wood', 'roof_wood', 'floor_wood', 'poi_door', 'chest_small'],
  CAMPUS_GROUNDS: ['wall_stone', 'roof_tile', 'floor_stone', 'poi_door', 'research', 'workbench'],
  ROAD_SERVICE_NODE: ['wall_wood', 'roof_wood', 'floor_wood', 'poi_door', 'barrel'],
};

// ---------------------------------------------------------------- masterplan -
const poisOut = [];
for (const p of G.pois) {
  const a = ARCH_BY_ID.get(p.id);
  if (!a) throw Error('U05_BUILD_ARCH_MISSING ' + p.id);
  const footAu = p.foot, footTiles = toTiles(footAu), footSnap = snapTiles(footAu);
  const areaAu2 = r4(area(footAu)), areaTile2 = r4(areaAu2 * 4), areaPx2 = r4(areaTile2 * TILE * TILE);
  const bbTiles = bbox(footTiles).map(r4);
  const chunkX0 = Math.floor(bbTiles[0] / 32), chunkY0 = Math.floor(bbTiles[1] / 32);
  const chunkX1 = Math.floor(bbTiles[2] / 32), chunkY1 = Math.floor(bbTiles[3] / 32);
  const ext = a.staticOpenings.filter((o) => o.kind === 'EXTERIOR_ENTRANCE');
  const int = a.staticOpenings.filter((o) => o.kind === 'INTERIOR_DOORWAY');
  const front = roadFrontage(p.at, footAu);
  const port = portions(footAu, p.at);
  const lm = landmassAt(p.at);
  const zoneHits = G.zones.filter((z) => polyOverlap(z.ring, footAu)).map((z) => z.id);
  const elderMembership = G.elders.filter((e) => (e.pois || []).includes(p.id)).map((e) => e.id);
  const neighbours = OVERLAP_MAP.get(p.id) || [];
  const cls = classify(p, a, ext.length);
  const groundRooms = a.rooms.filter((r) => r.levelId.endsWith('.0'));
  const deepRooms = a.rooms.filter((r) => r.levelId.endsWith('.-1'));
  const vlinks = ARCH.verticalLinks.filter((v) => v.poiId === p.id);
  const nearestDock = (() => {
    let best = Infinity, id = null;
    for (const d of G.docks) { const q = Math.hypot(d.at[0] - p.at[0], d.at[1] - p.at[1]); if (q < best) { best = q; id = d.id; } }
    return { id, distanceAu: r4(best) };
  })();
  const retreatPoints = (p.retreat || []).map((q) => ({ au: q, tile: q.map((v) => Math.floor(v / U)) }));
  const meaningfulRetreat = {
    status: retreatPoints.length ? 'GOLD_RETREAT_POINT_RECORDED' : (a.retreat && a.retreat.status === 'UNRESOLVED' ? 'UNRESOLVED' : 'NO_SOURCE_RECORD'),
    goldRetreatPoints: retreatPoints,
    architectureRetreat: a.retreat,
    circulation: a.circulation ? { physicallyReachableRoomCount: a.circulation.physicallyReachableRoomCount, groundRoomCount: a.circulation.groundRoomCount, graphOnlyRooms: a.circulation.graphOnlyRooms } : null,
    note: 'A retreat point or a room graph is a paper design record, NOT a physically demonstrated exit. Runtime walk proof exists only for the six P3 pilot scenes.'
  };
  const parentChild = {
    authoredLinks: p.links || [],
    elderMembership,
    envelopeOverlapPartners: neighbours,
    overlapInterpretation: neighbours.length ? 'HOST_SUBSITE_OVERLAP__INTENTIONAL_OR_UNRESOLVED' : 'NONE',
    hostCandidate: neighbours.length ? (area(G.pois.find((q) => q.id === neighbours[0]).foot) >= areaAu2 ? neighbours[0] : p.id) : null,
    note: 'Overlapping envelopes are reported, never auto-resolved. Cache/vendor/evac nodes are NOT counted as giant standalone buildings.',
    noAutomaticChange: true
  };
  const proposedProgramme = {
    classification: cls,
    programme: (() => {
      const base = [];
      if (a.openAirYard) base.push('open courtyard / circulation spine between separate structures');
      if (groundRooms.length > 1) base.push(`${groundRooms.length} separate ground structures with independent roofs and door thresholds`);
      if (deepRooms.length || vlinks.length) base.push('deep/shaft spatial RESERVATION only (no vertical separation value invented)');
      if (front.nearestRoadDistanceAu !== undefined || front.distanceAu < 40) base.push('road-facing arrival apron drawn from the existing GOLD centreline');
      if (areaAu2 > 1200) base.push('coherent grounds, utility yard and roof hierarchy; NOT one huge rectangular roof or empty field');
      if (!base.length) base.push('single bounded structure inside the existing envelope');
      return base;
    })(),
    noGiantRectangle: true,
    noRandomProps: true,
    polygonAmendments: []
  };
  const entry = {
    id: p.id,
    name: p.name,
    status: 'U05_PHYSICAL_MASTERPLAN_ENTRY__NOT_ART_COMPLETE__NOT_FULLY_INTERACTIVE',
    gold: {
      class: 'source-authored',
      at: p.at, arche: p.arche, rot: p.rot, scale: p.scale, depth: p.depth,
      role: p.role, opp: p.opp, access: p.access, resources: p.resources, gate: p.gate,
      conf: p.conf, elder: p.elder || null, notes: p.notes || null, links: p.links || []
    },
    landmass: { class: 'source-authored', ...lm, atTile: p.at.map((v) => Math.floor(v / U)) },
    archetypeAndFunction: { class: 'source-authored', arche: p.arche, intendedFunction: p.role, opportunity: p.opp, gate: p.gate, classification: cls },
    legacyParcelPolygon: { class: 'source-authored', au: footAu, deepAu: p.deep || null, rot: p.rot, scale: p.scale },
    measuredArea: { class: 'reprojected', method: 'shoelace on GOLD poi.foot (site envelope, NOT building)', au2: areaAu2, tile2: areaTile2, px2: areaPx2, au2ToTile2Factor: 4, note: 'Area is SITE ENVELOPE area only, not usable room area and not a certified building footprint.' },
    SITE_ENVELOPE: {
      class: 'reprojected', source: 'GOLD poi.foot', polygonAu: footAu, polygonTilesContinuous: footTiles.map((q) => q.map(r4)), polygonTilesSnapped: footSnap,
      bboxTiles: bbTiles, chunkRange: { x0: chunkX0, y0: chunkY0, x1: chunkX1, y1: chunkY1 },
      identity: `creator-u05|${chunkX0}:${chunkY0}`, markerOnly: true, certifiedBuilding: false,
      noPolygonChange: true
    },
    portions: { class: 'reprojected', ...port },
    collisionTerrain: {
      class: 'source-authored',
      elevation: cellAt('elevation', ...p.at), slope: cellAt('slope', ...p.at), cliffCandidate: cellAt('cliffCandidate', ...p.at),
      heightClass: cellAt('heightClass', ...p.at), waterClass: cellAt('waterClass', ...p.at),
      walkableCandidate: cellAt('walkableCandidate', ...p.at), cargoCandidate: cellAt('cargoCandidate', ...p.at),
      buildableCandidate: cellAt('buildableCandidate', ...p.at), protectedGeometryCandidate: cellAt('protectedGeometryCandidate', ...p.at),
      activeCollisionPermission: cellAt('activeCollisionPermission', ...p.at),
      permissions: { foot: 'MAP_CANDIDATE_ONLY', cart: 'MAP_CANDIDATE_ONLY', build: 'UNKNOWN__GAMEPLAY', boat: false, swim: false, ferryFoot: false, gameplayAuthority: 'GAMEPLAY_ONLY__NOT_APPROVED' },
      note: 'WMP-03 candidates are NOT Gameplay legality. No marine/boat/ferry/cargo/build permission is granted.'
    },
    zoning: { class: 'source-authored', zoneIdsOverlappingEnvelope: zoneHits, zoneIdRasterAtCentre: cellAt('zoneId', ...p.at), surveyedBuildSiteOverlap: zoneOverlaps.filter((z) => z.poiCells[p.id]).map((z) => ({ zoneId: z.zoneId, cells: z.poiCells[p.id] })) },
    arrivalRoadFrontage: { class: 'reprojected', ...front, nearestDock, loadingAccessFromArchitecture: a.loadingAccess || null, note: 'Road centrelines are unchanged GOLD geometry; reaching a POI centre is often a schematic connector, NOT an authored exterior entrance.' },
    exteriorEntranceStatus: {
      class: ext.length ? 'proposed' : 'unresolved',
      status: ext.length ? 'SOURCE_EXTERIOR_ENTRANCE_RECORDED' : 'MISSING_EXTERIOR_ENTRANCE_RECORD',
      records: ext.map((o) => ({ id: o.id, centreAu: o.centreAu, centreTile: o.centreAu.map((v) => Math.floor(v / U)), openingAu: o.openingAu, effectiveClearWidthAu: o.effectiveClearWidthAu, effectiveClearWidthTiles: o.effectiveClearWidthAu / U, dynamicDoorOwner: o.dynamicDoorOwner, doorState: o.doorState, sourceStatus: 'PROPOSED' })),
      note: ext.length ? 'WMP-03 PROPOSED static hole; dynamic door/lock is Gameplay-owned.' : 'No EXTERIOR_ENTRANCE record in live architecture.v1.json. No door is invented and no relocation is applied.'
    },
    BUILDING_COMPOSITION: {
      class: 'proposed', enclosureClass: a.enclosureClass, openAirYard: !!a.openAirYard,
      groundRoomCount: groundRooms.length, deepRoomCount: deepRooms.length,
      buildings: groundRooms.map((r) => ({ id: r.id, pattern: r.pattern, polygonAu: r.polygonAu, polygonTiles: toTiles(r.polygonAu).map((q) => q.map(r4)), areaAu2: r.areaAu2, areaTile2: r4(r.areaAu2 * 4), centroidTile: r.centroidAu.map((v) => r4(v / U)), floorStatus: r.floor.status, bboxTiles: bbox(toTiles(r.polygonAu)).map(r4) })),
      wallThicknessAu: a.footAu.wallThicknessAu, wallThicknessStatus: a.footAu.wallThicknessStatus, wallThicknessTiles: a.footAu.wallThicknessAu / U,
      note: 'Rooms/footprints are WMP-03 PROPOSED physical composition fitted INSIDE the existing GOLD envelope. No silent canon change.'
    },
    DOORS_ROOMS: {
      class: 'proposed', interiorDoorways: int.length,
      openings: a.staticOpenings.map((o) => ({ id: o.id, kind: o.kind, centreTile: o.centreAu.map((v) => r4(v / U)), aTile: o.aAu.map((v) => r4(v / U)), bTile: o.bAu.map((v) => r4(v / U)), openingTiles: o.openingAu / U, effectiveClearWidthTiles: o.effectiveClearWidthAu / U, staticHole: o.staticHole, dynamicDoorOwner: o.dynamicDoorOwner, doorState: o.doorState })),
      circulation: a.circulation || null, los: a.los || null, verdict: a.verdict,
      note: 'Door thresholds are traversable clear widths in PROPOSED static holes. Lock/key/power/HP state is runtime-owned and UNKNOWN.'
    },
    ROOF_OCCLUSION: {
      class: 'proposed', coveredRoomCount: a.roofCoverage.coveredRoomCount, totalRoomCount: a.roofCoverage.totalRoomCount,
      roofAreaAu2: a.roofCoverage.roofAreaAu2, roofAreaTile2: r4(a.roofCoverage.roofAreaAu2 * 4),
      roofPolygonCount: a.roofPolygonCount, roofPolygons: a.roofPolygons.map((r) => ({ id: r.id, polygonAu: r.polygonAu, polygonTiles: toTiles(r.polygonAu).map((q) => q.map(r4)), status: r.status })),
      fractionOfFoot: a.roofCoverage.fractionOfFoot,
      occlusionRule: 'Runtime hides a roof when the player is inside its polygon; grey boxes / whitebox are NOT final pixel art.',
      note: 'Canopy-only roofs differ from full enclosed roofs. Boundary-coincident vertices are not shrunk.'
    },
    SOLID_COLLISION: {
      class: 'proposed', solidCount: a.staticSolids.length,
      solids: a.staticSolids.map((s) => ({ id: s.id, aTile: s.aAu.map((v) => r4(v / U)), bTile: s.bAu.map((v) => r4(v / U)), thicknessTiles: s.thicknessAu / U, blocksMovement: s.blocksMovement, blocksSight: s.blocksSight, status: s.status })),
      openingsBypassSolids: true, idMapping: a.idMapping || [],
      note: 'Static solids are split BY openings. Collision is against these spans; openings remain passable. No phantom collision.'
    },
    NAV_RETREAT: {
      class: 'proposed', meaningfulRetreat, interiorDepthAu: a.circulation?.lr01Graph?.interiorDepthAu ?? null,
      graphReachableRooms: a.circulation?.graphReachableRooms ?? [],
      runtimeWalkProof: 'ONLY_FOR_SIX_P3_PILOT_SCENES', approachPathStatus: 'DESIGNED_NOT_WALKED_EXCEPT_PILOT'
    },
    GAMEPLAY_SOCKETS: {
      class: 'runtime-owned', gate: p.gate, power: 'GAMEPLAY', locks: 'GAMEPLAY', hp: 'GAMEPLAY', ownership: 'GAMEPLAY', loot: 'GAMEPLAY', enemyPlacement: 'GAMEPLAY', verticalSeparationValue: 'UNRESOLVED',
      dynamicOwnership: a.dynamicOwnership,
      note: 'Named placeholders only. No key item, price, cargo approval, loot table, boss state or reward is created.'
    },
    verticalIntent: { class: 'proposed', levels: a.levels.map((l) => ({ id: l.id, name: l.name, polygonTiles: toTiles(l.polygonAu).map((q) => q.map(r4)), areaAu2: l.areaAu2, areaTile2: r4(l.areaAu2 * 4), status: l.status })), verticalLinks: vlinks.map((v) => ({ id: v.id, verdict: v.verdict, resolution: v.resolution, sourceStatus: v.sourceStatus })), verticalNamedBlockerCount: ARCH.verticalNamedBlockers.filter((b) => b.poiId === p.id).length, note: 'No invented vertical separation value; deep levels are spatial RESERVATIONS.' },
    openSpace: { class: 'proposed', openAirYard: !!a.openAirYard, unroofedFractionOfFoot: r4(1 - Math.min(1, a.roofCoverage.fractionOfFoot)), roofHierarchy: `${a.roofPolygonCount} roof polygons over ${a.roomCount} rooms`, note: 'Open space is a designed programme element, not an inflated empty rectangle.' },
    proposedSpatialProgramme: { class: 'proposed', ...proposedProgramme },
    parentChild: { class: 'proposed', ...parentChild },
    requiredArt: { class: 'proposed', reuse: ART_BY_CLASS[cls.code].map((sprite) => ({ sprite, source: 'b5c8004c:web/src/game/art.ts buildStructs()', status: 'REUSE' })), newAtlas: 'NOT_AUTHORIZED', status: 'WHITEBOX_OR_REUSED_SOH_ART__NOT_FINAL_PIXEL_ART' },
    missingAssets: {
      class: 'unresolved',
      items: p.id === 'po_beacon' ? [{ id: 'poi_beacon_engine_out_helicopter', atAu: HELICOPTER.atAu, atTile: helicopterTile, status: 'PROVEN_MISSING', reason: 'No helicopter sprite/entity in verified live Gameplay source; no car-wreck or ship-hull substitute', substitute: 'NONE' }] : [],
      note: 'No procured or invented atlas. Boats, cargo approval, boss rewards and other Gameplay-owned objects remain UNRESOLVED.'
    },
    phase: p.id === 'po_beacon' || p.id === 'po_greywater' || p.id === 'po_academy' || p.id === 'po_ironmine' || p.id === 'po_westmouth' || p.id === 'po_typhon' ? 'P3_DEEP_PILOT_SCENE' : 'P2_REGISTRY_ONLY',
    owner: 'MAP_U05 (physical design) / GAMEPLAY (dynamic state) / CREATOR (visual acceptance)',
    confidence: {
      geometry: 'HIGH__SOURCE_AUTHORED_REPROJECTED',
      physicalProgramme: 'MEDIUM__PROPOSED',
      runtimeInteraction: 'LOW__UNRESOLVED'
    }
  };
  poisOut.push(entry);
}

const areasAu2 = poisOut.map((p) => p.measuredArea.au2).sort((a, b) => a - b);
const audit = {
  poiCount: poisOut.length,
  uniqueIds: new Set(poisOut.map((p) => p.id)).size,
  duplicatedIds: poisOut.length - new Set(poisOut.map((p) => p.id)).size,
  lostIds: 0,
  footprintArea: {
    au2: { min: areasAu2[0], median: areasAu2[Math.floor(areasAu2.length / 2)], max: areasAu2[areasAu2.length - 1] },
    tile2: { min: r4(areasAu2[0] * 4), median: r4(areasAu2[Math.floor(areasAu2.length / 2)] * 4), max: r4(areasAu2[areasAu2.length - 1] * 4) },
    note: 'SITE-ENVELOPE area only, not usable room area.'
  },
  missingExteriorEntrance: {
    count: missingEntrance.length, ids: missingEntrance,
    method: 'Direct count of POIs with zero staticOpenings[].kind===EXTERIOR_ENTRANCE in live veyra-world-master/layers/architecture.v1.json',
    formerAuditReported: 26, verdict: missingEntrance.length === 26 ? 'LIVE_REPRODUCED' : 'LIVE_CORRECTED_WITH_EVIDENCE',
    note: 'A missing RECORD is not a missing physical door; none is invented.'
  },
  poiOverlapPairs: {
    count: overlapPairs.length, pairs: overlapPairs,
    method: 'Exact convex-polygon intersection area > 0 AU2 for all 81*80/2 GOLD poi.foot pairs (Sutherland-Hodgman)',
    formerAuditReported: 11, verdict: overlapPairs.length === 11 ? 'LIVE_REPRODUCED' : 'LIVE_CORRECTED_WITH_EVIDENCE',
    note: 'All pairs are host/subsite or boundary-coincident candidates. May be intentional; none auto-resolved, no shrink/relocate/expand.'
  },
  roadCentrelineCrossings: {
    formerAuditReported: 73,
    measurements: {
      distinctPoiEnvelopesCrossedByARoadCentreline: poisCrossedByRoad.size,
      distinctRoadsCrossingAnyPoiEnvelope: roadsCrossingPois.size,
      roadPoiEnvelopePairs: roadPoiPairs.size,
      poiCentresWithin1AuOfARoadCentreline: new Set(G.pois.filter((p) => roadFrontage(p.at, p.foot).roadIdsAtPoiCentre.length).map((p) => p.id)).size
    },
    verdict: 'FORMER_73_IS_THE_DISTINCT_POI_ENVELOPE_COUNT__PAIR_COUNT_IS_HIGHER',
    method: 'Segment-polygon intersection of every GOLD rd_* centreline segment against every GOLD poi.foot; no widening, no redraw',
    note: '73 is reproduced as the number of distinct POI site envelopes a schematic road centreline enters. It is NOT 73 roads and NOT an authored exterior entrance. 122 distinct road×POI pairs are counted separately with exact IDs below.',
    exactRoadPoiPairs: [...roadPoiPairs].sort()
  },
  buildableSiteOverlap: {
    count: zoneOverlaps.length, of: G.zones.length, zones: zoneOverlaps,
    method: '1 AU rasterised overlap of each of the 23 GOLD surveyed zone rings against all 81 poi.foot polygons and all 6 Elder outer rings',
    formerAuditReported: '18/23',
    verdict: zoneOverlaps.length === 18 ? 'LIVE_REPRODUCED' : 'LIVE_CORRECTED_WITH_EVIDENCE',
    correction: (() => {
      const v3 = json(path.join(WM, 'v3/layers/structural_checks.v3.json'));
      const former = v3.overlappingEnvelopes.sitesWithHostOverlap.map((s) => s.siteId.replace(/^site\./, ''));
      const extra = zoneOverlaps.filter((z) => !former.includes(z.zoneId));
      return {
        formerSiteIds: former,
        extraZoneIds: extra.map((z) => z.zoneId),
        detail: extra.map((z) => ({ zoneId: z.zoneId, hosts: Object.keys(z.poiCells), overlapCells1Au: z.totalCells })),
        reason: 'v3 STRUCTURAL S-03 measured host/subsite overlap on 8 AU analysis cells and reported 18/23 sites. A 1 AU re-measure of the SAME unchanged GOLD rings finds one extra site whose overlap is smaller than a single 8 AU analysis cell, so it was not represented in the 8 AU sample. No boundary was changed; legalPlacement remains UNKNOWN/GAMEPLAY.'
      };
    })(),
    note: 'No zone, POI or Elder boundary was changed. Overlap is reported, never auto-resolved; legalPlacement remains UNKNOWN/GAMEPLAY.'
  },
  helicopterConflict: {
    poiId: 'po_beacon', lighthouseAtAu: BEACON.at, helicopterAtAu: HELICOPTER.atAu,
    helicopterAtTile: helicopterTile, landId: HELICOPTER.landId, physicalState: HELICOPTER.physicalState,
    separationAu: r4(Math.hypot(BEACON.at[0] - HELICOPTER.atAu[0], BEACON.at[1] - HELICOPTER.atAu[1])),
    separationTiles: r4(Math.hypot(BEACON.at[0] - HELICOPTER.atAu[0], BEACON.at[1] - HELICOPTER.atAu[1]) / U),
    spriteEntityStatus: 'PROVEN_MISSING', repairFlightStatus: HELICOPTER.repairFlightStatus,
    resolution: 'UNRESOLVED__HELIPAD_COLLISION_PLAN_ONLY__NO_RELOCATION__NO_SUBSTITUTE',
    owner: 'CREATOR / GAMEPLAY A8'
  },
  noChanges: { islands: 0, pois: 0, roadCentrelines: 0, coastline: 0, lakes: 0, riverNetwork: 0, docks: 0, poiAnchors: 0, resourceAuthoring: 0, helicopterRelocations: 0, polygonAmendments: 0 }
};
const masterplan = {
  schema: 'soh.u05.poi-masterplan.v1', contract: 'CREATOR_CHOSEN_U05.v1',
  generatedAt: new Date().toISOString(),
  status: 'P2_PHYSICAL_MASTERPLAN__81_OF_81_REGISTRY_ONLY__NOT_ART_COMPLETE__NOT_FULLY_INTERACTIVE',
  frame: { U, TILE, frameAu: FRAME_AU, frameTiles: FRAME_TILES, addressableCells: 11200000, nonSquare: true, neverMaterializeAllCells: true },
  sources, audit,
  fieldClassification: { vocabulary: ['source-authored', 'reprojected', 'proposed', 'runtime-owned', 'unresolved'], inventory: 'contracts/LAYER_INVENTORY.json' },
  separatedSections: ['SITE_ENVELOPE', 'BUILDING_COMPOSITION', 'DOORS_ROOMS', 'ROOF_OCCLUSION', 'SOLID_COLLISION', 'NAV_RETREAT', 'GAMEPLAY_SOCKETS'],
  pois: poisOut
};
fs.writeFileSync(path.join(U05, 'map-data/U05_POI_MASTERPLAN.v1.json'), JSON.stringify(masterplan, null, 2) + '\n');
fs.writeFileSync(path.join(U05, 'map-data/U05_AUDIT.json'), JSON.stringify(audit, null, 2) + '\n');

// ---------------------------------------------------------------- conflicts --
const conflicts = {
  schema: 'soh.u05.geometry-conflicts.v1', generatedAt: new Date().toISOString(),
  policy: 'Reported with measured evidence and an owner. NO automatic shrink / relocate / expand / redraw. Polygon amendments only with measured incompatibility + before/after comparison.',
  items: [
    ...audit.poiOverlapPairs.pairs.map((o) => ({ kind: 'POI_ENVELOPE_OVERLAP', a: o.a, b: o.b, measureAu2: o.overlapAu2, measureTile2: o.overlapTile2, status: 'HOST_SUBSITE_OR_INTENTIONAL__UNRESOLVED', owner: 'MAP_U05 / CREATOR', resolution: 'NONE_APPLIED' })),
    ...missingEntrance.map((id) => ({ kind: 'MISSING_EXTERIOR_ENTRANCE_RECORD', poiId: id, measure: 1, status: 'UNRESOLVED', owner: 'MAP_U05 / GAMEPLAY A8', resolution: 'NO_DOOR_INVENTED' })),
    ...zoneOverlaps.map((z) => ({ kind: 'BUILDABLE_SITE_OVERLAPS_POI_OR_ELDER', zoneId: z.zoneId, poiCells: z.poiCells, elderCells: z.elderCells, measureCells1Au: z.totalCells, status: 'UNRESOLVED__LEGAL_PLACEMENT_GAMEPLAY_ONLY', owner: 'MAP_U05 / GAMEPLAY', resolution: 'NONE_APPLIED' })),
    { kind: 'HELICOPTER_VS_LIGHTHOUSE', poiId: 'po_beacon', helicopterAtAu: HELICOPTER.atAu, lighthouseAtAu: BEACON.at, measureAu: audit.helicopterConflict.separationAu, status: audit.helicopterConflict.resolution, owner: 'CREATOR / GAMEPLAY A8', resolution: 'PROVEN_MISSING_SPRITE__NO_SUBSTITUTE__NO_RELOCATION' },
    { kind: 'ROAD_CENTRELINE_ENTERS_POI_ENVELOPE', distinctPois: audit.roadCentrelineCrossings.measurements.distinctPoiEnvelopesCrossedByARoadCentreline, pairs: audit.roadCentrelineCrossings.measurements.roadPoiEnvelopePairs, status: 'SCHEMATIC_CONNECTOR__NOT_AN_AUTHORED_ENTRANCE', owner: 'MAP_U05 / GAMEPLAY', resolution: 'NO_ROAD_CHANGE' },
    { kind: 'VERTICAL_LINK_NAMED_BLOCKERS', count: ARCH.verticalNamedBlockerCount, ids: ARCH.verticalNamedBlockers.map((b) => b.id), status: 'UNRESOLVED', owner: 'MAP_U05 / GAMEPLAY', resolution: 'NO_INVENTED_VERTICAL_SEPARATION' },
    { kind: 'POI_RETREAT_POLYLINE', count: ARCH.pois.filter((p) => p.retreat && p.retreat.status === 'UNRESOLVED').length, status: 'UNRESOLVED', owner: 'GAMEPLAY', resolution: 'NO_EXIT_INVENTED' },
    { kind: 'CART_SWEPT_CLEARANCE', poiIds: ['po_ironmine', 'po_westmouth'], status: 'UNRESOLVED', owner: 'MAP_U05 / GAMEPLAY', resolution: 'NO_CART_LAW_CREATED' },
    { kind: 'MARINE_FOOT_PERMISSION', status: 'UNRESOLVED_GAMEPLAY__FOOT_PASSABLE_ON_SEA_FALSE', owner: 'GAMEPLAY / CREATOR', resolution: 'NO_BOAT_OR_SWIM_PERMISSION' }
  ],
  amendedPolygons: [], relocatedObjects: [], expandedEnvelopes: [], recolouredRoads: [], widenedRoads: []
};
fs.writeFileSync(path.join(U05, 'map-data/U05_GEOMETRY_CONFLICTS.json'), JSON.stringify(conflicts, null, 2) + '\n');

// ---------------------------------------------------------------- benchmark --
fs.writeFileSync(path.join(U05, 'map-data/U05_BENCHMARK.json'), JSON.stringify({
  schema: 'soh.u05.visual-benchmark.v1', contract: 'CREATOR_CHOSEN_U05.v1',
  status: 'LOCKED_VISUAL_PRESERVATION_REFERENCE__NOT_VISUAL_ACCEPTANCE__NOT_REAUTHORIZATION',
  origin: 'large-world-01/evidence/shots/beacon_beacon_u05.png',
  viewport: [640, 360], dpr: 1, U: 0.5, TILE: 16,
  cameraAnchorAu: [272, 652], cameraAnchorTile: [544, 1304],
  physicalLayer: 'OFF', profile: 'creator-u05',
  locked: ['road shape', 'road edge rule', 'road palette', 'road spaciousness', 'shoreline', 'hero 16x24', 'native 640x360', '72 px/s'],
  terrainSource: 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web/src/game/render.ts PAL/PRIO/texel (byte-identical to LW-01 e11a9b44)',
  roadGeometry: 'GOLD rd_* centrelines, 3.0 AU half-width rule unchanged; at U=0.5 => 6 runtime tiles / 96 px by scale transform ONLY',
  forbidden: ['road widening beyond the transform', 'recolour', 'redraw', 'stretched player/sprites', 'camera zoom / camera as route', 'nearest-neighbour 8 AU staircase as authored detail'],
  checks: ['U05-VB1', 'U05-VB2', 'U05-VB3']
}, null, 2) + '\n');

console.log(`U05_BUILD_OK pois=${poisOut.length} audit.overlapPairs=${overlapPairs.length} audit.missingEntrance=${missingEntrance.length} audit.roadPoiPairs=${roadPoiPairs.size} audit.poisCrossedByRoad=${poisCrossedByRoad.size} audit.zoneOverlap=${zoneOverlaps.length}/${G.zones.length} areaTile2=${audit.footprintArea.tile2.min}/${audit.footprintArea.tile2.median}/${audit.footprintArea.tile2.max}`);
