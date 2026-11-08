/**
 * AUTHORITATIVE MAP READER (U=0.5) — the ONLY place that touches source geography.
 *
 *  - GOLD canon (VEYRA_GOLD_MAP.sohmap.json, sha256 88780f78…) is read through the
 *    SAME `?raw` import the live runtime verifies (CANON_SHA in veyra/intake.ts).
 *  - WMP-04R1 rasters come from the live runtime's SHA-256-verified decoder
 *    (veyra/wmp04r1.generated.ts). Each cell is an 8 AU ANALYSIS cell.
 *  - Coastline / lakes / rivers / roads / POI footprints / zones are evaluated
 *    from the authored polygons & centrelines AT THE EXACT 0.5 AU TILE CENTRE
 *    (never nearest-neighbour 8 AU squares). Biome material on authored land is
 *    picked from the 8 AU raster through the U05 deterministic 1 AU dither so the
 *    boundary is irregular but NO authored detail is invented.
 *  - Nothing here mints Gameplay permission. Bridges/docks are NODES, not decks.
 *
 * Method reused from the Map branch (LW-01 geometry.ts / U05 world.ts), re-hosted
 * on the live runtime's own verified payloads so Gameplay and Map read one truth.
 */
import canonRaw from '../../geography/veyra-lr01/map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json?raw';
import pkgRaw from '../../geography/veyra-lr01/world_lab/lr01/output/geography_package.v1.json?raw';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { CANON_SHA, BODY_SHA, expandRle, type GeographyStage1 } from '../game/veyra/intake';
import { wmp04Raster, WMP04R1_META } from '../game/veyra/wmp04r1';
import { T, hash2 } from '../game/core';
import { tileToAu, ANALYSIS_CELL_AU, ANALYSIS_W, ANALYSIS_H, FRAME_AU } from './frame';

type Pt = [number, number];
export interface GoldPoi { id: string; name: string; at: Pt; arche: string; foot: Pt[]; deep?: Pt[]; access?: string; rot?: number }
export interface GoldNode { id: string; name: string; kind: string; at: Pt; r: number; dens?: number }
interface Gold { project: {
  land: { id: string; name: string; rings: Pt[][] }[]; lakes: { id: string; name: string; ring: Pt[] }[];
  rivers: { id: string; name: string; points: Pt[]; width?: number }[]; roads: { id: string; name: string; points: Pt[]; kind: string }[];
  bridges: { id: string; name: string; at: Pt; ang: number; load: string }[]; docks: { id: string; name: string; at: Pt }[];
  pois: GoldPoi[]; zones: { id: string; name: string; ring: Pt[] }[]; resources: { id: string; name: string; at: Pt; kind: string; r?: number; dens?: number }[];
  spawns: { id: string; name: string; at: Pt; region: string }[]; elders: { id: string; name: string; elder: string; outer: Pt[]; at?: Pt }[]; labels: { id?: string; text?: string; name?: string; at: Pt }[];
} }

const hash = (s: string) => bytesToHex(sha256(s));
if (hash(canonRaw) !== CANON_SHA) throw Error('VEYRA05_GOLD_CANON_INTEGRITY_FAILED');
export const GOLD: Gold = JSON.parse(canonRaw);
const pkg = JSON.parse(pkgRaw) as GeographyStage1;
if (pkg.revisionDigest !== BODY_SHA) throw Error('VEYRA05_LR01_PACKAGE_INTEGRITY_FAILED');
const ELEVATION = expandRle((pkg.body as any).compactMasks.elevationRle, 255);

// ---------- verified rasters (lazy; each decode is SHA-256 checked by the live reader) ----------
const R: Record<string, Uint8Array> = {};
const raster = (name: string) => R[name] || (R[name] = wmp04Raster(name as any));
export const rasterAt = (name: string, ax: number, ay: number) => {
  const cx = Math.min(ANALYSIS_W - 1, Math.max(0, Math.floor(ax / ANALYSIS_CELL_AU)));
  const cy = Math.min(ANALYSIS_H - 1, Math.max(0, Math.floor(ay / ANALYSIS_CELL_AU)));
  return raster(name)[cy * ANALYSIS_W + cx];
};
const elevationAt = (ax: number, ay: number) => {
  const cx = Math.min(ANALYSIS_W - 1, Math.max(0, Math.floor(ax / ANALYSIS_CELL_AU))), cy = Math.min(ANALYSIS_H - 1, Math.max(0, Math.floor(ay / ANALYSIS_CELL_AU)));
  return ELEVATION[cy * ANALYSIS_W + cx];
};

// ---------- authored geometry with bounding boxes + bucket index ----------
interface Ring { id: string; name: string; pts: Pt[]; minX: number; minY: number; maxX: number; maxY: number; idx: number }
function ring(id: string, name: string, pts: Pt[], idx = 0): Ring {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  return { id, name, pts, minX, minY, maxX, maxY, idx };
}
const P = GOLD.project;
const LAND_OUTER: Ring[] = [], LAND_HOLES: Ring[] = [];
P.land.forEach((l, li) => l.rings.forEach((r, k) => (k === 0 ? LAND_OUTER : LAND_HOLES).push(ring(l.id, l.name, r, li))));
const LAKES = P.lakes.map((l, i) => ring(l.id, l.name, l.ring, i));
export const POIS: GoldPoi[] = P.pois;
const POI_RINGS = P.pois.map((p, i) => p.foot && p.foot.length >= 3 ? ring(p.id, p.name, p.foot, i) : null).filter((r): r is Ring => !!r);
const ZONES = P.zones.map((z, i) => ring(z.id, z.name, z.ring, i));
const ELDER_RINGS = P.elders.map((e, i) => ring(e.id, e.name, e.outer, i));

interface Seg { a: Pt; b: Pt; id: string; w: number; kind: 'road' | 'river'; idx: number; roadKind?: string }
const SEGS: Seg[] = [];
// 9 AU is the MapLab analytical stroke, not an approved physical width. The live
// runtime projects rivers/roads with radius 4.5 AU; U05 used road 3.0 (±0.9) and
// river width 4. We keep the live-runtime 4.5 AU half-width for RIVERS (channel
// continuity is measured 17/17 at that width) and a 1.5 AU half-width for ROADS
// (a 3-tile visible road at U=0.5, matching the U05 measured mean of ~3 tiles).
// PHYSICAL widths follow the Map team's U05 measurement (MAPGEO-01): river half-width = GOLD width/2
// (default 4 AU channel = 8 tiles at U=0.5; 17/17 centrelines continuous, only po_timberyard's anchor sits in a channel),
// cart roads 1.0 AU half-width (4 visible tiles), other roads 0.75 AU (3 tiles). Ferries are suggestions, never dry roads.
P.rivers.forEach((r, i) => { for (let k = 0; k < r.points.length - 1; k++) SEGS.push({ a: r.points[k], b: r.points[k + 1], id: r.id, w: (r.width || 4) / 2, kind: 'river', idx: i }); });
P.roads.forEach((r, i) => { if (r.kind === 'ferry') return; for (let k = 0; k < r.points.length - 1; k++) SEGS.push({ a: r.points[k], b: r.points[k + 1], id: r.id, w: r.kind === 'cart' ? 1.0 : 0.75, kind: 'road', idx: i, roadKind: r.kind }); });
export const FERRY_ROUTES = P.roads.filter(r => r.kind === 'ferry');
const BUCKET = 32;
const SEG_BUCKETS = new Map<number, Seg[]>();
const bk = (bx: number, by: number) => by * 1000 + bx;
for (const s of SEGS) {
  const x0 = Math.min(s.a[0], s.b[0]) - s.w - 1, y0 = Math.min(s.a[1], s.b[1]) - s.w - 1, x1 = Math.max(s.a[0], s.b[0]) + s.w + 1, y1 = Math.max(s.a[1], s.b[1]) + s.w + 1;
  for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++) for (let by = Math.floor(y0 / BUCKET); by <= Math.floor(y1 / BUCKET); by++) { const k = bk(bx, by); let a = SEG_BUCKETS.get(k); if (!a) SEG_BUCKETS.set(k, a = []); a.push(s); }
}
export const NODES: GoldNode[] = [
  ...P.resources.map(r => ({ id: r.id, name: r.name, kind: r.kind, at: r.at, r: r.r || 12, dens: r.dens ?? 1 })),
  ...P.docks.map(d => ({ id: d.id, name: d.name, kind: 'dock', at: d.at, r: 6 })),
  ...P.bridges.map(b => ({ id: b.id, name: b.name, kind: 'bridge', at: b.at, r: 6 })),
];
const NODE_BUCKETS = new Map<number, GoldNode[]>();
for (const n of NODES) for (let bx = Math.floor((n.at[0] - n.r) / BUCKET); bx <= Math.floor((n.at[0] + n.r) / BUCKET); bx++) for (let by = Math.floor((n.at[1] - n.r) / BUCKET); by <= Math.floor((n.at[1] + n.r) / BUCKET); by++) { const k = bk(bx, by); let a = NODE_BUCKETS.get(k); if (!a) NODE_BUCKETS.set(k, a = []); a.push(n); }
// land edge segments bucketed for coast distance
const COAST_BUCKETS = new Map<number, [Pt, Pt][]>();
for (const r of [...LAND_OUTER, ...LAND_HOLES]) for (let i = 0, j = r.pts.length - 1; i < r.pts.length; j = i++) {
  const a = r.pts[j], b = r.pts[i]; const x0 = Math.min(a[0], b[0]) - 8, y0 = Math.min(a[1], b[1]) - 8, x1 = Math.max(a[0], b[0]) + 8, y1 = Math.max(a[1], b[1]) + 8;
  for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++) for (let by = Math.floor(y0 / BUCKET); by <= Math.floor(y1 / BUCKET); by++) { const k = bk(bx, by); let c = COAST_BUCKETS.get(k); if (!c) COAST_BUCKETS.set(k, c = []); c.push([a, b]); }
}

function inside(pts: Pt[], x: number, y: number) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
const inRing = (r: Ring, x: number, y: number) => x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY && inside(r.pts, x, y);
function dSeg(x: number, y: number, a: Pt, b: Pt) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)); }
function coastDistance(x: number, y: number) { let best = Infinity; const bx = Math.floor(x / BUCKET), by = Math.floor(y / BUCKET); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const c = COAST_BUCKETS.get(bk(bx + i, by + j)); if (!c) continue; for (const [a, b] of c) { const d = dSeg(x, y, a, b); if (d < best) best = d; } } return best; }

export const BIOME_NAMES = ['meadow', 'forest', 'ancient', 'conifer', 'marsh', 'desert', 'scrub_dry_steppe', 'rock', 'snow', 'volcanic', 'toxic', 'beach'] as const;
/** WMP-04R1 code -> existing SOH tile. Same mapping as the live WMP-04R1 scenes (no new tileset). */
export const BIOME_TILE = [T.MEADOW, T.FOREST, T.FOREST, T.FOREST, T.MARSH, T.SAND, T.HILL, T.HILL, T.SNOW, T.ASH, T.TOXIC, T.SAND];
/** Deterministic dithered 1 AU sample of the 8 AU raster (U05 rule, same constants). */
export function biomeCodeAt(ax: number, ay: number, tx: number, ty: number) {
  const jx = (hash2(tx, ty, 0x51f1) - 0.5) * 5.2, jy = (hash2(tx, ty, 0x51f2) - 0.5) * 5.2;
  const cx = Math.min(ANALYSIS_W - 1, Math.max(0, Math.floor((ax + jx) / ANALYSIS_CELL_AU))), cy = Math.min(ANALYSIS_H - 1, Math.max(0, Math.floor((ay + jy) / ANALYSIS_CELL_AU)));
  return raster('biomeEffective')[cy * ANALYSIS_W + cx];
}

export interface TileSample {
  tile: number; land: boolean; lake: boolean; river: boolean; road: boolean; roadKind: string | null; coast: boolean; coastDist: number;
  poi: number; zone: number; elder: number; biome: number; cold: number; marine: number; cliff: number; height: number; elevation: number;
  node: GoldNode | null; bridgeNode: GoldNode | null; dockNode: GoldNode | null; landIdx: number; seaWater: boolean;
}
/** EXACT authored sample at the tile centre. Pure & deterministic. */
export function sampleTile(tx: number, ty: number): TileSample {
  const [ax, ay] = tileToAu(tx, ty);
  let landIdx = -1; for (const r of LAND_OUTER) if (inRing(r, ax, ay)) { landIdx = r.idx; break; }
  if (landIdx >= 0) for (const h of LAND_HOLES) if (h.idx === landIdx && inRing(h, ax, ay)) { landIdx = -1; break; }
  const land = landIdx >= 0;
  let lake = false; if (land) for (const r of LAKES) if (inRing(r, ax, ay)) { lake = true; break; }
  let river = false, road = false, roadKind: string | null = null;
  const segs = SEG_BUCKETS.get(bk(Math.floor(ax / BUCKET), Math.floor(ay / BUCKET)));
  if (segs && land) for (const s of segs) { if (dSeg(ax, ay, s.a, s.b) > s.w) continue; if (s.kind === 'river') river = true; else { road = true; roadKind = s.roadKind || 'road'; } }
  let poi = -1; for (const r of POI_RINGS) if (inRing(r, ax, ay)) { poi = r.idx; break; }
  let zone = -1; for (const r of ZONES) if (inRing(r, ax, ay)) { zone = r.idx; break; }
  let elder = -1; for (const r of ELDER_RINGS) if (inRing(r, ax, ay)) { elder = r.idx; break; }
  const coastDist = coastDistance(ax, ay);
  const biome = biomeCodeAt(ax, ay, tx, ty);
  let node: GoldNode | null = null, bridgeNode: GoldNode | null = null, dockNode: GoldNode | null = null;
  const nodes = NODE_BUCKETS.get(bk(Math.floor(ax / BUCKET), Math.floor(ay / BUCKET)));
  if (nodes) for (const n of nodes) { if (Math.hypot(n.at[0] - ax, n.at[1] - ay) > n.r) continue; if (n.kind === 'bridge') bridgeNode = n; else if (n.kind === 'dock') dockNode = n; else if (!node) node = n; }
  // Water geometry: sea outside land rings; lakes/rivers are fresh. Rivers win over roads (MGP-D01: no deck is invented).
  const seaWater = !land;
  let tile: number;
  if (!land) tile = T.DEEP; else if (lake || river) tile = T.SHALLOW; else if (road) tile = T.ROAD; else tile = BIOME_TILE[biome] ?? T.MEADOW;
  return { tile, land, lake, river, road: road && !river && !lake, roadKind, coast: land && coastDist < 3.2, coastDist, poi, zone, elder, biome,
    cold: rasterAt('coldTransition', ax, ay), marine: rasterAt('marineRegion', ax, ay), cliff: rasterAt('cliffCandidate', ax, ay), height: rasterAt('heightClass', ax, ay),
    elevation: elevationAt(ax, ay), node, bridgeNode, dockNode, landIdx, seaWater };
}
export const SOURCE = Object.freeze({
  goldSha256: CANON_SHA, lr01BodySha256: BODY_SHA, wmp04r1: WMP04R1_META.activeRevision, wmp04r1Manifest: WMP04R1_META.provenance?.manifestR1Sha256,
  frameAu: FRAME_AU, counts: { land: P.land.length, lakes: P.lakes.length, rivers: P.rivers.length, roads: P.roads.length, bridges: P.bridges.length, docks: P.docks.length, pois: P.pois.length, zones: P.zones.length, resources: P.resources.length, spawns: P.spawns.length, elders: P.elders.length, labels: P.labels.length },
  roadHalfWidthAu: { cart: 1.0, other: 0.75 }, riverHalfWidthRule: 'GOLD width / 2 (default 2 AU)', ferryRoutesExcluded: FERRY_ROUTES.length,
});
