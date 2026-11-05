/**
 * Deterministic geographic sampling with a TYPED BOUNDARY.
 *
 *  - 8 AU analytical cells (250x175) are ANALYSIS DATA, never runtime tiles.
 *  - Coastline / lakes / rivers / road centrelines / POI footprints / resource
 *    nodes / zone rings come from AUTHORED GOLD polygons & polylines evaluated
 *    at the exact runtime tile centre. No nearest-neighbour 8 AU square land.
 *  - The WMP-04R1 biome raster selects GROUND MATERIAL on authored land using a
 *    deterministic dithered 1-AU boundary (no 8 AU blocky outline).
 *  - WMP-03 walkable/cargo/buildable/cliff layers are CANDIDATES. They never
 *    mint Gameplay legality: foot/boat/cart/build permission is explicit.
 */
import { T, hash2 } from '../core';
import { LW_SOURCES } from './sources.generated';
import { tileToAu, index } from './coords';
import type { WorldProfile } from './profile';

type Pt = [number, number];
type Seg = { a: Pt; b: Pt; id: string; width: number; kind: string };

const W = LW_SOURCES.analysisGrid.w, H = LW_SOURCES.analysisGrid.h, CELL_AU = LW_SOURCES.analysisGrid.cellAu;
const BUCKET = 64;

function decode(name: string): Uint8Array {
  const rec: any = (LW_SOURCES.rasters as any)[name];
  const bin = atob(rec.base64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  if (out.length !== W * H) throw Error(`LW01_RASTER_DECODE_BAD ${name} ${out.length}`);
  return out;
}
export const RASTERS: Record<string, Uint8Array> = {};
for (const k of Object.keys(LW_SOURCES.rasters)) RASTERS[k] = decode(k);
export const rasterAt = (name: string, auX: number, auY: number): number => {
  const cx = Math.min(W - 1, Math.max(0, Math.floor(auX / CELL_AU)));
  const cy = Math.min(H - 1, Math.max(0, Math.floor(auY / CELL_AU)));
  return RASTERS[name][cy * W + cx];
};

// ---------- authored GOLD geometry ----------
const G: any = LW_SOURCES.gold;
interface Ring { id: string; name: string; pts: Pt[]; minX: number; minY: number; maxX: number; maxY: number }
function ring(id: string, name: string, pts: Pt[]): Ring {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  return { id, name, pts, minX, minY, maxX, maxY };
}
const LAND: Ring[] = [];
for (const l of G.land) for (let k = 0; k < l.rings.length; k++) LAND.push(ring(l.id, l.name, l.rings[k]));
const LAKES: Ring[] = G.lakes.map((l: any) => ring(l.id, l.name, l.ring));
const POIS: Ring[] = G.pois.filter((p: any) => p.foot && p.foot.length >= 3).map((p: any) => ring(p.id, p.name, p.foot));
const ZONES: Ring[] = G.zones.map((z: any) => ring(z.id, z.name, z.ring));

const SEGMENTS: Seg[] = [];
function addPolyline(id: string, kind: string, pts: Pt[], width: number) {
  for (let i = 0; i < pts.length - 1; i++) SEGMENTS.push({ a: pts[i], b: pts[i + 1], id, width, kind });
}
for (const r of G.roads) addPolyline(r.id, 'road', r.points, 3.0);
for (const r of G.rivers) addPolyline(r.id, 'river', r.points, r.width || 4);
const BUCKETS = new Map<string, Seg[]>();
const bkey = (x: number, y: number) => `${Math.floor(x / BUCKET)}:${Math.floor(y / BUCKET)}`;
for (const s of SEGMENTS) {
  const x0 = Math.min(s.a[0], s.b[0]) - s.width, y0 = Math.min(s.a[1], s.b[1]) - s.width;
  const x1 = Math.max(s.a[0], s.b[0]) + s.width, y1 = Math.max(s.a[1], s.b[1]) + s.width;
  for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++)
    for (let by = Math.floor(y0 / BUCKET); by <= Math.floor(y1 / BUCKET); by++) {
      const k = `${bx}:${by}`; let a = BUCKETS.get(k); if (!a) { a = []; BUCKETS.set(k, a); } a.push(s);
    }
}
function strHash(v: string) { let h = 0x811c9dc5; for (let i = 0; i < v.length; i++) { h ^= v.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
const NODES: { id: string; kind: string; x: number; y: number; r: number; dens: number; seed: number }[] = [];
for (const r of G.resources) NODES.push({ id: r.id, kind: r.kind, x: r.at[0], y: r.at[1], r: r.r || 12, dens: r.dens ?? 1, seed: strHash(r.id) });
for (const d of G.docks) NODES.push({ id: d.id, kind: 'dock', x: d.at[0], y: d.at[1], r: 10, dens: 0, seed: strHash(d.id) });
for (const b of G.bridges) NODES.push({ id: b.id, kind: 'bridge', x: b.at[0], y: b.at[1], r: 12, dens: 0, seed: strHash(b.id) });
const NODE_BUCKETS = new Map<string, typeof NODES>();
// A GOLD resource is an AREA of radius r: index every bucket its footprint
// touches, not just the bucket holding its centre (same rule as SEGMENTS).
for (const n of NODES) {
  for (let bx = Math.floor((n.x - n.r) / BUCKET); bx <= Math.floor((n.x + n.r) / BUCKET); bx++)
    for (let by = Math.floor((n.y - n.r) / BUCKET); by <= Math.floor((n.y + n.r) / BUCKET); by++) {
      const k = `${bx}:${by}`; let a = NODE_BUCKETS.get(k); if (!a) { a = []; NODE_BUCKETS.set(k, a); } a.push(n);
    }
}

function insidePolygon(pts: Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inRing = (r: Ring, x: number, y: number) => x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY && insidePolygon(r.pts, x, y);
function distSeg(x: number, y: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]; const l2 = dx * dx + dy * dy;
  let t = l2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
const COAST_BAND_AU = 3.2;
function distanceToCoast(x: number, y: number): number {
  let best = Infinity;
  for (const r of LAND) {
    if (x < r.minX - 40 || x > r.maxX + 40 || y < r.minY - 40 || y > r.maxY + 40) continue;
    for (let i = 0, j = r.pts.length - 1; i < r.pts.length; j = i++) {
      const d = distSeg(x, y, r.pts[j], r.pts[i]); if (d < best) best = d;
    }
  }
  return best;
}

export const BIOME_NAMES = ['meadow','forest','ancient','conifer','marsh','desert','scrub_dry_steppe','rock','snow','volcanic','toxic','beach'] as const;
/** WMP-04R1 biome code -> existing SOH art tile. No new tileset. */
const BIOME_TILE: number[] = [T.MEADOW, T.FOREST, T.FOREST, T.FOREST, T.MARSH, T.SAND, T.HILL, T.HILL, T.SNOW, T.ASH, T.TOXIC, T.SAND];

export interface TileSample {
  tile: number; au: [number, number]; globalIndex: number;
  authoredLand: boolean; coast: boolean; water: boolean; lake: boolean; river: boolean; road: boolean; bridge: boolean; dock: boolean;
  poiId: string | null; zoneId: string | null; sourceId: string | null; sourceKind: string | null;
  /** Deterministic visual/harvest instance inside an AUTHORED GOLD resource area. */
  sourceTile: boolean; sourceInstanceId: string | null;
  biomeCode: number; biome: string; marineRegion: number; coldClass: number;
  elevation: number; heightClass: number; cliffCandidate: number;
  walkableCandidate: number; cargoCandidate: number; buildableCandidate: number;
  waterClass: number; landId: number; clearance: number; waterTraversalClass: number;
  /** TYPED BOUNDARY — Map candidates NEVER mint Gameplay permission. */
  permissions: {
    foot: boolean; cart: boolean; build: boolean;
    boat: false; swim: false; ferryFoot: false;
    buildReason: string; cartReason: string;
    gameplayAuthority: 'GAMEPLAY_ONLY__NOT_APPROVED';
  };
}

/** Deterministic dithered 1-AU sampling of the 8-AU analysis raster: irregular
 *  material boundary, never a square 8-AU land outline. */
export function biomeCodeAt(auX: number, auY: number, tx: number, ty: number): number {
  const jx = (hash2(tx, ty, 0x51f1) - 0.5) * 5.2;
  const jy = (hash2(tx, ty, 0x51f2) - 0.5) * 5.2;
  const cx = Math.min(W - 1, Math.max(0, Math.floor((auX + jx) / CELL_AU)));
  const cy = Math.min(H - 1, Math.max(0, Math.floor((auY + jy) / CELL_AU)));
  return RASTERS.biomeEffective[cy * W + cx];
}

export function sampleAuthored(p: WorldProfile, tx: number, ty: number): TileSample {
  const [auX, auY] = tileToAu(p, tx, ty);
  const land = LAND.some(r => inRing(r, auX, auY));
  const lake = land ? LAKES.some(r => inRing(r, auX, auY)) : false;
  const near = BUCKETS.get(bkey(auX, auY)) || [];
  let river = false, road = false, riverId: string | null = null, roadId: string | null = null;
  for (const s of near) {
    if (distSeg(auX, auY, s.a, s.b) > s.width / 2 + (s.kind === 'road' ? 0.9 : 0)) continue;
    if (s.kind === 'river') { river = true; riverId = s.id; } else { road = true; roadId = s.id; }
  }
  const poi = POIS.find(r => inRing(r, auX, auY)) || null;
  const zone = ZONES.find(r => inRing(r, auX, auY)) || null;
  const coastDist = distanceToCoast(auX, auY);
  const coast = coastDist < COAST_BAND_AU;
  const water = !land || lake || river;
  const biomeCode = biomeCodeAt(auX, auY, tx, ty);
  const waterClass = rasterAt('waterClass', auX, auY);
  const marine = rasterAt('marineRegion', auX, auY);
  const cold = rasterAt('coldTransition', auX, auY);
  const elev = rasterAt('elevation', auX, auY);
  const hClass = rasterAt('heightClass', auX, auY);
  const cliff = rasterAt('cliffCandidate', auX, auY);
  const walkC = rasterAt('walkableCandidate', auX, auY);
  const cargoC = rasterAt('cargoCandidate', auX, auY);
  const buildC = rasterAt('buildableCandidate', auX, auY);
  const clearance = rasterAt('clearanceCells', auX, auY);
  const wtc = rasterAt('waterTraversalClass', auX, auY);
  const landId = rasterAt('landId', auX, auY);
  let node: typeof NODES[number] | null = null;
  for (const n of (NODE_BUCKETS.get(bkey(auX, auY)) || [])) if (Math.hypot(auX - n.x, auY - n.y) <= n.r) { node = n; break; }
  const bridge = !!node && node.kind === 'bridge';
  const dock = !!node && node.kind === 'dock';
  // Authored resource AREAS (radius r, dens) are instanced at 1-AU tile centres.
  // This reuses existing SOH source art; it does NOT mint new POIs, loot, prices
  // or Gameplay legality. Instances are deterministic and globally identified.
  let sourceTile = false, sourceInstanceId: string | null = null;
  const cliffBlocked = cliff >= 2 && hClass >= 2 && !bridge;
  const blockedCrossing = wtc >= 2 && !bridge;
  const foot = land && !water && !cliffBlocked && !blockedCrossing;
  let tile: number;
  // Ocean is authored by the GOLD land polygon, NOT by an 8 AU square.
  if (!land) tile = coast ? T.SHALLOW : T.DEEP;
  else if (lake || river) tile = T.RIVER;
  else if (cliffBlocked) tile = T.CLIFF;
  else if (bridge) tile = T.BRIDGE;
  else if (road) tile = T.ROAD;
  else if (coast) tile = T.SAND;
  else tile = BIOME_TILE[biomeCode] ?? T.MEADOW;
  if (node && node.kind !== 'bridge' && node.kind !== 'dock') {
    const aquatic = node.kind === 'fish' || node.kind === 'fresh_water';
    const chance = aquatic ? 0.02 : Math.min(0.04, Math.max(0.012, 0.012 + node.dens * 0.008));
    const onDryOpenGround = !water && !road && !bridge && tile !== T.CLIFF;
    if ((aquatic ? water : onDryOpenGround) && hash2(tx, ty, node.seed) < chance) {
      sourceTile = true;
      sourceInstanceId = `${node.kind}:${node.id}@${Math.round(node.x)},${Math.round(node.y)}#${tx},${ty}`;
    }
  }
  return {
    tile, au: [auX, auY], globalIndex: index(p, tx, ty),
    authoredLand: land, coast, water, lake, river, road, bridge, dock,
    poiId: poi?.id ?? null, zoneId: zone?.id ?? null,
    sourceId: node ? `${node.kind}:${node.id}@${Math.round(node.x)},${Math.round(node.y)}` : null,
    sourceKind: node?.kind ?? null, sourceTile, sourceInstanceId,
    biomeCode, biome: BIOME_NAMES[biomeCode] ?? 'meadow', marineRegion: marine, coldClass: cold,
    elevation: elev, heightClass: hClass, cliffCandidate: cliff,
    walkableCandidate: walkC, cargoCandidate: cargoC, buildableCandidate: buildC,
    waterClass, landId, clearance, waterTraversalClass: wtc,
    permissions: {
      foot, cart: foot && cargoC > 0 && !cliffBlocked,
      build: false, boat: false, swim: false, ferryFoot: false,
      buildReason: 'MAP_BUILDABLE_CANDIDATE_ONLY__GAMEPLAY_PERMISSION_NOT_APPROVED',
      cartReason: 'MAP_CARGO_CANDIDATE_ONLY__GAMEPLAY_CART_LEGALITY_NOT_APPROVED',
      gameplayAuthority: 'GAMEPLAY_ONLY__NOT_APPROVED',
    },
  };
}

/** Synthetic NON-CANON capacity fixture. Never mistaken for Veyra geography. */
export function sampleCapacity(p: WorldProfile, tx: number, ty: number): TileSample {
  const n = hash2(tx >> 3, ty >> 3, 0x0caf);
  const land = n > 0.34;
  const water = !land;
  const biomeCode = n > 0.78 ? 1 : n > 0.6 ? 7 : n > 0.5 ? 8 : 0;
  const tile = water ? T.DEEP : BIOME_TILE[biomeCode];
  const [auX, auY] = tileToAu(p, tx, ty);
  return {
    tile, au: [auX, auY], globalIndex: index(p, tx, ty),
    authoredLand: false, coast: false, water, lake: false, river: false, road: false, bridge: false, dock: false,
    poiId: null, zoneId: null, sourceId: null, sourceKind: null, sourceTile: false, sourceInstanceId: null,
    biomeCode, biome: BIOME_NAMES[biomeCode], marineRegion: 0, coldClass: 0,
    elevation: 0, heightClass: 0, cliffCandidate: 0, walkableCandidate: 0, cargoCandidate: 0, buildableCandidate: 0,
    waterClass: water ? 1 : 0, landId: 0, clearance: 0, waterTraversalClass: 0,
    permissions: { foot: land, cart: land, build: false, boat: false, swim: false, ferryFoot: false,
      buildReason: 'CAPACITY_FIXTURE__NO_GAMEPLAY_AUTHORITY', cartReason: 'CAPACITY_FIXTURE__NO_GAMEPLAY_AUTHORITY', gameplayAuthority: 'GAMEPLAY_ONLY__NOT_APPROVED' },
  };
}
export function sampleAt(p: WorldProfile, tx: number, ty: number): TileSample {
  return p.kind === 'CAPACITY_FIXTURE' ? sampleCapacity(p, tx, ty) : sampleAuthored(p, tx, ty);
}
export const GOLD_GEOMETRY_STATS = {
  landRings: LAND.length, lakes: LAKES.length, poiFootprints: POIS.length, zoneRings: ZONES.length,
  segments: SEGMENTS.length, buckets: BUCKETS.size, nodes: NODES.length,
  landRingPoints: LAND.reduce((a, r) => a + r.pts.length, 0),
};
