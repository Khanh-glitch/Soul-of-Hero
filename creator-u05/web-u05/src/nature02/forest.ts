/**
 * NATURE-02 placement + draw. ONE temperate-forest window, THREE compositions.
 *
 * Differences from NATURE-01 (the defect being corrected):
 *  - coherent STANDS (species decided per stand) instead of per-tile scatter;
 *  - explicit CLEARINGS with a dense rim and a genuinely empty interior;
 *  - zero-density deliberate ROUTE corridors (no painted path, no new geometry);
 *  - 3-tile road/bridge buffer; minimal semantic-risk palette;
 *  - sprite sizes are NEVER changed; canopy mass comes from overlapping 24px
 *    crowns on 16px tiles plus y-sorted depth, not from scaling.
 *
 * Decorative only: no collision, no reward, no stock, no depletion, no owner.
 */
import { getArt } from '../game/art';
import { hash2 } from '../game/core';
import { TILE } from '../u05/contract';
import { sampleTile } from '../u05/world';
import { fbm } from '../u05/lw-fbm';
import type { NatureKind, NatureObject } from '../nature01/nature-types';
import {
  FOREST_BOUNDS, FOREST_CHUNK, MAX_RESIDENT_FOREST_CHUNKS,
  ROAD_BUFFER_TILES, TREE_WATER_BUFFER_TILES, STANDS, CLEARINGS, ROUTES,
  SPECIES, ZONE_RULES, UNDERGROWTH, COMPOSITIONS, COMPOSITION_ORDER,
  FOREST_PALETTE, OWNER_DEPENDENCY
} from './forest-sites';

const TALL = new Set<NatureKind>(['oak', 'pine', 'snowpine', 'willow', 'dead']);
const PAD = 3;
const N = FOREST_CHUNK + 2 * PAD;
const cache = new Map<string, { objects: NatureObject[]; used: number }>();
let clock = 0, chunksBuilt = 0, evictions = 0, emptyChunks = 0;
let enabled = true;

interface Flag {
  ok: boolean; land: boolean; water: boolean; road: boolean; bridge: boolean;
  coast: boolean; river: boolean; lake: boolean; sourceTile: boolean;
  biome: string; cliff: number; height: number; walkable: number;
  roadDist: number; waterDist: number;
}
interface Design { zone: string; stand: number; clearing: number; route: number; standId: string | null }

function inWindow(tx: number, ty: number) {
  return tx >= FOREST_BOUNDS[0] && tx < FOREST_BOUNDS[2] && ty >= FOREST_BOUNDS[1] && ty < FOREST_BOUNDS[3];
}
function chunkTouchesWindow(cx: number, cy: number) {
  const x0 = cx * FOREST_CHUNK, y0 = cy * FOREST_CHUNK;
  return x0 < FOREST_BOUNDS[2] && x0 + FOREST_CHUNK > FOREST_BOUNDS[0] &&
         y0 < FOREST_BOUNDS[3] && y0 + FOREST_CHUNK > FOREST_BOUNDS[1];
}
function ellipse(c: [number, number], r: [number, number], x: number, y: number) {
  const dx = (x - c[0]) / r[0], dy = (y - c[1]) / r[1];
  return Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
}
function pointSeg(px: number, py: number, a: [number, number], b: [number, number]) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / l2));
  return Math.hypot(px - (a[0] + t * vx), py - (a[1] + t * vy));
}
export function designAt(tx: number, ty: number): Design {
  let stand = 0, standId: string | null = null;
  for (const s of STANDS) {
    const v = ellipse(s.c, s.r, tx, ty);
    if (v > stand) { stand = v; standId = s.id; }
  }
  let clearing = 0;
  for (const c of CLEARINGS) clearing = Math.max(clearing, ellipse(c.c, c.r, tx, ty));
  let route = 0;
  for (const r of ROUTES) {
    for (let i = 0; i < r.points.length - 1; i++)
      if (pointSeg(tx, ty, r.points[i], r.points[i + 1]) <= r.width) { route = 1; break; }
    if (route) break;
  }
  let zone = 'exterior';
  if (route) zone = 'route';
  else if (clearing >= 0.40) zone = 'clearing_interior';
  else if (clearing >= 0.15) zone = 'clearing_rim';
  else if (stand >= 0.55) zone = 'core';
  else if (stand >= 0.18) zone = 'edge';
  return { zone, stand, clearing, route, standId };
}

function buildFlags(cx: number, cy: number): Flag[] {
  const x0 = cx * FOREST_CHUNK - PAD, y0 = cy * FOREST_CHUNK - PAD;
  const f: Flag[] = new Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const s = sampleTile(x0 + i, y0 + j);
    f[j * N + i] = s ? {
      ok: true, land: s.authoredLand, water: s.water, road: s.road, bridge: s.bridge,
      coast: s.coast, river: s.river, lake: s.lake, sourceTile: s.sourceTile,
      biome: s.biome, cliff: s.cliffCandidate, height: s.heightClass,
      walkable: s.walkableCandidate, roadDist: 9, waterDist: 9
    } : {
      ok: false, land: false, water: true, road: false, bridge: false, coast: false,
      river: false, lake: false, sourceTile: false, biome: 'unknown', cliff: 0,
      height: 0, walkable: 0, roadDist: 9, waterDist: 9
    };
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const t = f[j * N + i];
    for (let d = 1; d <= PAD; d++) {
      let road = false, water = false;
      for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        const jj = j + dy, ii = i + dx;
        if (jj < 0 || ii < 0 || jj >= N || ii >= N) continue;
        const q = f[jj * N + ii];
        if (q.road || q.bridge) road = true;
        if (q.water) water = true;
      }
      if (road && t.roadDist === 9) t.roadDist = d;
      if (water && t.waterDist === 9) t.waterDist = d;
    }
    if (t.road || t.bridge) t.roadDist = 0;
    if (t.water) t.waterDist = 0;
  }
  return f;
}

function weighted(list: [NatureKind, number][], h: number): NatureKind {
  let a = 0;
  for (const [k, w] of list) { a += w; if (h < a) return k; }
  return list[list.length - 1][0];
}
function makeObject(tx: number, ty: number, kind: NatureKind, zone: string, standId: string | null, jx = 0, jy = 0): NatureObject {
  const tall = TALL.has(kind);
  const arr = getArt().src[kind];
  return {
    tx, ty, wx: tx * TILE, wy: ty * TILE,
    dx: (tall ? -4 : 0) + jx, dy: (tall ? -16 : 0) + jy,
    w: tall ? 24 : 16, h: tall ? 32 : 16,
    y: ty * TILE + 14, kind,
    variant: Math.floor(hash2(tx, ty, 0x5a17) * arr.length) % arr.length,
    site: 'temperate_forest', biome: zone, decorativeOnly: true, gameplayOwned: false
  };
}

function buildChunk(cx: number, cy: number): NatureObject[] {
  if (!chunkTouchesWindow(cx, cy)) { emptyChunks++; return []; }
  const f = buildFlags(cx, cy);
  const out: NatureObject[] = [];
  for (let j = PAD; j < PAD + FOREST_CHUNK; j++) for (let i = PAD; i < PAD + FOREST_CHUNK; i++) {
    const tx = cx * FOREST_CHUNK + (i - PAD), ty = cy * FOREST_CHUNK + (j - PAD);
    if (!inWindow(tx, ty)) continue;
    const t = f[j * N + i];
    if (!t.ok || !t.land || t.water || t.road || t.bridge || t.river || t.lake || t.coast) continue;
    if (t.sourceTile) continue;
    if (t.roadDist <= ROAD_BUFFER_TILES) continue;
    if (t.cliff >= 2) continue;
    const d = designAt(tx, ty);
    if (d.zone === 'route') continue;
    const rule = ZONE_RULES[d.zone];
    // Low-frequency clump field => thickets and small gaps INSIDE a stand,
    // never a uniform per-tile probability across the whole biome.
    const clump = fbm(tx / 512, ty / 512, 0x5eed);
    const pTree = Math.min(0.92, rule.tree * (0.55 + 0.90 * clump));
    const pUnder = Math.min(0.92, rule.under * (0.60 + 0.80 * clump));

    const hTree = hash2(tx, ty, 0x7101);
    let placed = false;
    if (hTree < pTree && t.waterDist >= TREE_WATER_BUFFER_TILES) {
      const stand = STANDS.find(s => s.id === d.standId);
      const weights = SPECIES[stand?.species || 'oak'];
      let kind = weighted(weights, hash2(tx, ty, 0x7102));
      if (d.zone === 'edge' && hash2(tx, ty, 0x7103) < 0.14) kind = 'dead'; // snags at the mantle
      if (t.waterDist <= 3 && kind === 'oak' && hash2(tx, ty, 0x7104) < 0.45) kind = 'willow';
      const jx = Math.round((hash2(tx, ty, 0x7105) - 0.5) * 4);
      const jy = Math.round((hash2(tx, ty, 0x7106) - 0.5) * 6);
      out.push(makeObject(tx, ty, kind, d.zone, d.standId, jx, jy));
      placed = true;
    }
    if (!placed && d.zone !== 'clearing_interior' && d.zone !== 'exterior') {
      if (hash2(tx, ty, 0x7107) < pUnder && t.waterDist >= 1) {
        const kind = weighted(UNDERGROWTH, hash2(tx, ty, 0x7108));
        const jx = Math.round((hash2(tx, ty, 0x7109) - 0.5) * 2);
        out.push(makeObject(tx, ty, kind, d.zone, d.standId, jx, 0));
      }
    } else if (!placed && (d.zone === 'clearing_interior' || d.zone === 'exterior')) {
      // Sparse floor: independent per-tile probability (NOT a lattice — a
      // jittered 2x2 lattice produced a visibly regular tuft grid in review).
      if (hash2(tx, ty, 0x7112) < pUnder * 0.42 && t.waterDist >= 1) {
        const kind: NatureKind = hash2(tx, ty, 0x7113) < 0.78 ? 'grass' : 'rock';
        out.push(makeObject(tx, ty, kind, d.zone, d.standId));
      }
    }
  }
  return out;
}

function forestChunk(cx: number, cy: number): NatureObject[] {
  const k = `${cx}:${cy}`;
  const hit = cache.get(k);
  if (hit) { hit.used = ++clock; return hit.objects; }
  const objects = buildChunk(cx, cy);
  chunksBuilt++;
  cache.set(k, { objects, used: ++clock });
  while (cache.size > MAX_RESIDENT_FOREST_CHUNKS) {
    let oldest: string | null = null, best = Infinity;
    for (const [kk, v] of cache) if (v.used < best) { best = v.used; oldest = kk; }
    if (!oldest) break;
    cache.delete(oldest); evictions++;
  }
  return objects;
}

export function forestObjectsInRect(camX: number, camY: number, w: number, h: number): NatureObject[] {
  const c0 = Math.floor((Math.floor(camX / TILE) - 2) / FOREST_CHUNK);
  const c1 = Math.floor((Math.floor((camX + w) / TILE) + 2) / FOREST_CHUNK);
  const r0 = Math.floor((Math.floor(camY / TILE) - 2) / FOREST_CHUNK);
  const r1 = Math.floor((Math.floor((camY + h) / TILE) + 2) / FOREST_CHUNK);
  const out: NatureObject[] = [];
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++)
    for (const o of forestChunk(cx, cy)) {
      const l = o.wx + o.dx, t = o.wy + o.dy;
      if (l + o.w < camX || l > camX + w || t + o.h < camY || t > camY + h) continue;
      out.push(o);
    }
  return out;
}

export function drawForestObject(g: CanvasRenderingContext2D, o: NatureObject, camX: number, camY: number) {
  const arr = getArt().src[o.kind];
  const spr = arr[o.variant % arr.length];
  if (!spr) return;
  if (o.h > 16) {
    g.fillStyle = 'rgba(8,12,10,0.22)';
    g.beginPath();
    g.ellipse(Math.round(o.wx + 8 - camX), Math.round(o.wy + 13 - camY), 6, 2.4, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.drawImage(spr, Math.round(o.wx + o.dx - camX), Math.round(o.wy + o.dy - camY));
}

interface FrameInfo {
  objectsInFrame: number; drawnThisFrame: number; kindCounts: Record<string, number>;
  zoneCounts: Record<string, number>; behindHero: number; inFrontOfHero: number;
  drawOrderSorted: boolean; heroY: number; firstY: number; lastY: number;
}
let lastFrame: FrameInfo = {
  objectsInFrame: 0, drawnThisFrame: 0, kindCounts: {}, zoneCounts: {},
  behindHero: 0, inFrontOfHero: 0, drawOrderSorted: true, heroY: 0, firstY: 0, lastY: 0
};
export function recordFrame(objects: NatureObject[], heroY: number) {
  const sorted = objects.slice().sort((a, b) => a.y - b.y);
  const kindCounts: Record<string, number> = {}, zoneCounts: Record<string, number> = {};
  for (const o of sorted) {
    kindCounts[o.kind] = (kindCounts[o.kind] || 0) + 1;
    zoneCounts[o.biome] = (zoneCounts[o.biome] || 0) + 1;
  }
  const ys = sorted.map(o => o.y);
  lastFrame = {
    objectsInFrame: sorted.length, drawnThisFrame: sorted.length, kindCounts, zoneCounts,
    behindHero: sorted.filter(o => o.y <= heroY).length,
    inFrontOfHero: sorted.filter(o => o.y > heroY).length,
    drawOrderSorted: ys.every((v, i) => i === 0 || ys[i - 1] <= v),
    heroY, firstY: ys.length ? ys[0] : 0, lastY: ys.length ? ys[ys.length - 1] : 0
  };
}

export function auditForest() {
  const byZone: Record<string, number> = {};
  const kinds: Record<string, number> = {};
  const violations = {
    road: 0, bridge: 0, water: 0, river: 0, lake: 0, coast: 0,
    sourceTile: 0, roadBuffer: 0, outsideWindow: 0, route: 0,
    nonDecorative: 0, gameplayOwned: 0, scaledSprite: 0
  };
  const all: NatureObject[] = [];
  const tileSet = new Set<string>();
  for (let cy = Math.floor(FOREST_BOUNDS[1] / FOREST_CHUNK); cy <= Math.floor((FOREST_BOUNDS[3] - 1) / FOREST_CHUNK); cy++)
    for (let cx = Math.floor(FOREST_BOUNDS[0] / FOREST_CHUNK); cx <= Math.floor((FOREST_BOUNDS[2] - 1) / FOREST_CHUNK); cx++)
      for (const o of forestChunk(cx, cy)) {
        byZone[o.biome] = (byZone[o.biome] || 0) + 1;
        kinds[o.kind] = (kinds[o.kind] || 0) + 1;
        all.push(o); tileSet.add(`${o.tx},${o.ty}`);
        const s = sampleTile(o.tx, o.ty);
        if (!s) continue;
        if (s.road) violations.road++;
        if (s.bridge) violations.bridge++;
        if (s.water) violations.water++;
        if (s.river) violations.river++;
        if (s.lake) violations.lake++;
        if (s.coast) violations.coast++;
        if (s.sourceTile) violations.sourceTile++;
        const d = designAt(o.tx, o.ty);
        if (d.route || d.zone === 'route') violations.route++;
        if (!inWindow(o.tx, o.ty)) violations.outsideWindow++;
        if (!o.decorativeOnly) violations.nonDecorative++;
        if (o.gameplayOwned) violations.gameplayOwned++;
        if ((o.w === 24 && o.h !== 32) || (o.w === 16 && o.h !== 16)) violations.scaledSprite++;
      }
  // Road buffer is measured independently over the whole window.
  for (let ty = FOREST_BOUNDS[1]; ty < FOREST_BOUNDS[3]; ty++) for (let tx = FOREST_BOUNDS[0]; tx < FOREST_BOUNDS[2]; tx++) {
    const s = sampleTile(tx, ty);
    if (s && (s.road || s.bridge)) {
      for (let dy = -ROAD_BUFFER_TILES; dy <= ROAD_BUFFER_TILES; dy++) for (let dx = -ROAD_BUFFER_TILES; dx <= ROAD_BUFFER_TILES; dx++)
        if (tileSet.has(`${tx + dx},${ty + dy}`)) violations.roadBuffer++;
    }
  }
  // Per-composition open ground over a native 40x23-tile viewport.
  const openGround: Record<string, number> = {};
  const compositionObjects: Record<string, number> = {};
  for (const k of COMPOSITION_ORDER) {
    const [cx, cy] = COMPOSITIONS[k].shotTile;
    let n = 0, obj = 0;
    for (let ty = cy - 11; ty < cy + 12; ty++) for (let tx = cx - 20; tx < cx + 20; tx++) {
      const s = sampleTile(tx, ty);
      if (!s || !s.authoredLand || s.water || s.road || s.bridge || s.river || s.lake || s.coast || s.sourceTile) continue;
      n++;
      if (tileSet.has(`${tx},${ty}`)) obj++;
    }
    compositionObjects[k] = obj;
    openGround[k] = n ? +(1 - obj / n).toFixed(4) : 0;
  }
  let hash = 0x811c9dc5;
  for (const k of all.map(o => `${o.tx},${o.ty},${o.kind},${o.variant},${o.biome},${o.dx},${o.dy}`).sort())
    for (let i = 0; i < k.length; i++) { hash ^= k.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return {
    window: FOREST_BOUNDS, totalObjects: all.length, byZone, kinds,
    compositionObjects, openGround, violations,
    stabilityHash: ('00000000' + hash.toString(16)).slice(-8),
    stands: STANDS.length, clearings: CLEARINGS.length, routes: ROUTES.length,
    allObjects: all.map(o => ({ tx: o.tx, ty: o.ty, kind: o.kind, variant: o.variant, zone: o.biome, y: o.y, dx: o.dx, dy: o.dy }))
  };
}

export function objectsInTileWindow(tx0: number, ty0: number, tx1: number, ty1: number) {
  const out: { tx: number; ty: number; kind: string; variant: number; y: number }[] = [];
  for (let cy = Math.floor(ty0 / FOREST_CHUNK); cy <= Math.floor((ty1 - 1) / FOREST_CHUNK); cy++)
    for (let cx = Math.floor(tx0 / FOREST_CHUNK); cx <= Math.floor((tx1 - 1) / FOREST_CHUNK); cx++)
      for (const o of forestChunk(cx, cy))
        if (o.tx >= tx0 && o.tx < tx1 && o.ty >= ty0 && o.ty < ty1)
          out.push({ tx: o.tx, ty: o.ty, kind: o.kind, variant: o.variant, y: o.y });
  return out.sort((a, b) => a.ty - b.ty || a.tx - b.tx);
}

export function forestStats() {
  return {
    enabled, biome: 'temperate_forest', oneBiomeOnly: true,
    residentChunks: cache.size, maxResidentChunks: MAX_RESIDENT_FOREST_CHUNKS,
    chunksBuilt, evictions, emptyChunks,
    objectsInFrame: lastFrame.objectsInFrame, drawnThisFrame: lastFrame.drawnThisFrame,
    kindCountsInFrame: { ...lastFrame.kindCounts }, zoneCountsInFrame: { ...lastFrame.zoneCounts },
    behindHero: lastFrame.behindHero, inFrontOfHero: lastFrame.inFrontOfHero,
    drawOrderSorted: lastFrame.drawOrderSorted,
    heroY: lastFrame.heroY, firstY: lastFrame.firstY, lastY: lastFrame.lastY,
    palette: FOREST_PALETTE, roadBufferTiles: ROAD_BUFFER_TILES,
    decorativeOnly: true, gameplayOwned: false,
    blocksMovement: false, collisionChanged: false,
    hasInteraction: false, hasRewards: false, hasDepletion: false, hasOwnership: false,
    spriteScaling: false, noNewArt: true, fullWorldPropagation: false,
    otherNature01WindowsHaveZeroObjects: true,
    productionApproved: false,
    ownerDependency: OWNER_DEPENDENCY.pilotStatus,
    geographySource: 'GOLD + WMP-04R1 via sampleTile() — READ ONLY'
  };
}
export function setForestEnabled(on: boolean) { enabled = !!on; return enabled; }
export function isForestEnabled() { return enabled; }
export function resetForestCaches() { cache.clear(); clock = 0; chunksBuilt = 0; evictions = 0; emptyChunks = 0; }
