/**
 * NATURE-01 — first natural-environment layer over the U=0.5 terrain-only game.
 *
 * HARD RULES (Creator brief):
 *  - U=0.5, TILE=16, hero 16x24, camera 640x360 @1x. Unchanged.
 *  - ONLY existing `getArt().src` decorative sprites. No new art, no new atlas.
 *  - ONLY five bounded pilot windows. NOT whole-world propagation.
 *  - Placement is DETERMINISTIC and biome/terrain-aware: never generic scatter.
 *  - Roads / bridges / rivers / lakes / sea / shoreline / GOLD polygons are
 *    READ but never written. Road corridors get a 2-tile object-free buffer.
 *  - Nature objects are DECORATIVE ONLY. They are NOT harvestable resources,
 *    have no stock / depletion / reward / ownership / interaction / collision.
 *  - No buildings, walls, roofs, doors, fences, POI structures or ruins.
 *  - OFF path draws EXACTLY the terrain-only baseline (no nature code runs).
 */
import { getArt } from '../game/art';
import { hash2 } from '../game/core';
import { TILE } from '../u05/contract';
import { sampleTile } from '../u05/world';
import { fbm } from '../u05/lw-fbm';
import type { NatureKind, NatureObject } from './nature-types';
import {
  SITES, SITE_ORDER, BIOME_RULES, PILOT_CHUNK, MAX_RESIDENT_NATURE_CHUNKS,
  ROAD_BUFFER_TILES, TREE_WATER_BUFFER_TILES, siteAt
} from './sites';

const TALL = new Set<NatureKind>(['oak', 'pine', 'snowpine', 'willow', 'dead']);
const PAD = 3;                       // enough for a 2-tile road/water buffer
const N = PILOT_CHUNK + 2 * PAD;     // 38x38 flag grid per chunk
const ROCKY = new Set(['rock', 'volcanic']);

interface Flag {
  ok: boolean; land: boolean; water: boolean; road: boolean; bridge: boolean;
  coast: boolean; river: boolean; lake: boolean; sourceTile: boolean;
  biome: string; cold: number; height: number; cliff: number; walkable: number;
  roadDist: number; waterDist: number;
}

const cache = new Map<string, { objects: NatureObject[]; used: number }>();
let clock = 0, chunksBuilt = 0, evictions = 0, emptyChunks = 0;
let enabled = true;

interface FrameInfo {
  objectsInFrame: number; drawnThisFrame: number; kindCounts: Record<string, number>;
  behindHero: number; inFrontOfHero: number; drawOrderSorted: boolean;
  heroY: number; firstY: number; lastY: number;
}
let lastFrame: FrameInfo = {
  objectsInFrame: 0, drawnThisFrame: 0, kindCounts: {}, behindHero: 0,
  inFrontOfHero: 0, drawOrderSorted: true, heroY: 0, firstY: 0, lastY: 0
};

/* ------------------------------------------------------------------ *
 * Bounded chunk build
 * ------------------------------------------------------------------ */
function chunkTouchesPilot(cx: number, cy: number): boolean {
  const bx0 = cx * PILOT_CHUNK, by0 = cy * PILOT_CHUNK;
  const bx1 = bx0 + PILOT_CHUNK, by1 = by0 + PILOT_CHUNK;
  for (const k of SITE_ORDER) {
    const [x0, y0, x1, y1] = SITES[k].boundsTile;
    if (bx0 < x1 && bx1 > x0 && by0 < y1 && by1 > y0) return true;
  }
  return false;
}

function buildFlags(cx: number, cy: number): Flag[] {
  const x0 = cx * PILOT_CHUNK - PAD, y0 = cy * PILOT_CHUNK - PAD;
  const f: Flag[] = new Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const s = sampleTile(x0 + i, y0 + j);
    f[j * N + i] = s ? {
      ok: true, land: s.authoredLand, water: s.water, road: s.road, bridge: s.bridge,
      coast: s.coast, river: s.river, lake: s.lake, sourceTile: s.sourceTile,
      biome: s.biome, cold: s.coldClass, height: s.heightClass,
      cliff: s.cliffCandidate, walkable: s.walkableCandidate,
      roadDist: 9, waterDist: 9
    } : {
      ok: false, land: false, water: true, road: false, bridge: false, coast: false,
      river: false, lake: false, sourceTile: false, biome: 'unknown', cold: 0,
      height: 0, cliff: 0, walkable: 0, roadDist: 9, waterDist: 9
    };
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const t = f[j * N + i];
    for (let d = 1; d <= PAD; d++) {
      let foundRoad = false, foundWater = false;
      for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        const jj = j + dy, ii = i + dx;
        if (jj < 0 || ii < 0 || jj >= N || ii >= N) continue;
        const q = f[jj * N + ii];
        if (q.road || q.bridge) foundRoad = true;
        if (q.water) foundWater = true;
      }
      if (foundRoad && t.roadDist === 9) t.roadDist = d;
      if (foundWater && t.waterDist === 9) t.waterDist = d;
    }
    if (t.road || t.bridge) t.roadDist = 0;
    if (t.water) t.waterDist = 0;
  }
  return f;
}

function pick(weights: { kind: NatureKind; w: number }[], h: number): NatureKind {
  let acc = 0;
  for (const e of weights) { acc += e.w; if (h < acc) return e.kind; }
  return weights[weights.length - 1].kind;
}

function latticeAnchor(tx: number, ty: number, cell: number, s1: number, s2: number): boolean {
  const cx = Math.floor(tx / cell), cy = Math.floor(ty / cell);
  const ax = cx * cell + (Math.floor(hash2(cx, cy, s1) * cell) % cell);
  const ay = cy * cell + (Math.floor(hash2(cx, cy, s2) * cell) % cell);
  return tx === ax && ty === ay;
}

function makeObject(tx: number, ty: number, kind: NatureKind, site: string, biome: string, jx = 0, jy = 0): NatureObject {
  const tall = TALL.has(kind);
  const arr = getArt().src[kind];
  return {
    tx, ty, wx: tx * TILE, wy: ty * TILE,
    dx: (tall ? -4 : 0) + jx, dy: (tall ? -16 : 0) + jy,
    w: tall ? 24 : 16, h: tall ? 32 : 16,
    y: ty * TILE + 14, kind,
    variant: Math.floor(hash2(tx, ty, 0xc17a) * arr.length) % arr.length,
    site, biome, decorativeOnly: true, gameplayOwned: false
  };
}

function buildChunk(cx: number, cy: number): NatureObject[] {
  if (!chunkTouchesPilot(cx, cy)) { emptyChunks++; return []; }
  const f = buildFlags(cx, cy);
  const out: NatureObject[] = [];
  const occupied = new Set<number>();
  for (let j = PAD; j < PAD + PILOT_CHUNK; j++) for (let i = PAD; i < PAD + PILOT_CHUNK; i++) {
    const tx = cx * PILOT_CHUNK + (i - PAD), ty = cy * PILOT_CHUNK + (j - PAD);
    const site = siteAt(tx, ty);
    if (!site) continue;
    const t = f[j * N + i];
    // Base authority exclusions — never draw nature on authored transport or water.
    if (!t.ok || !t.land || t.water || t.road || t.bridge || t.river || t.lake || t.coast) continue;
    // Never on a GOLD resource instance (Gameplay-owned candidate).
    if (t.sourceTile) continue;
    // Access: roads and bridges keep a 2-tile object-free corridor.
    if (t.roadDist <= ROAD_BUFFER_TILES) continue;
    const rule = BIOME_RULES[t.biome];
    if (!rule) continue;
    const spec = SITES[site];
    const field = fbm(tx / 1024, ty / 1024, spec.seed & 0xffff); // ~16-tile clearings / clusters
    const seed = spec.seed;

    /* ---- tall / volume objects (jittered 3x3 lattice, never a grid) ---- */
    let placed = false;
    if (!occupied.has(ty * 100000 + tx)
        && latticeAnchor(tx, ty, 3, 0xa101 ^ seed, 0xa202 ^ seed)
        && hash2(tx, ty, 0xb103 ^ seed) < rule.bigChance) {
      let ok = t.waterDist >= (rule.bigWaterMin ?? 1);
      if (ok && rule.clearingFloor !== undefined && field < rule.clearingFloor) ok = false; // forest clearing
      if (ok && rule.openGapCeiling !== undefined && field > rule.openGapCeiling) ok = false; // dry open gap
      if (ok && rule.clusterFloor !== undefined && field < rule.clusterFloor) ok = false; // rock cluster
      if (ok && rule.bigWaterMax !== undefined && t.waterDist > rule.bigWaterMax) ok = false; // willow behind reeds
      if (ok && t.cliff >= 2 && !ROCKY.has(t.biome)) ok = false; // no trees on cliffs
      if (ok) {
        let kind = pick(rule.big, hash2(tx, ty, 0xd104 ^ seed));
        // Meaningful snow / conifer vegetation transition from the WMP cold raster.
        if (t.biome === 'conifer' && t.cold >= 2 && kind === 'pine' && hash2(tx, ty, 0xe115) < 0.55) kind = 'snowpine';
        if (t.biome === 'snow' && t.cold <= 1 && kind === 'snowpine' && hash2(tx, ty, 0xe116) < 0.55) kind = 'pine';
        if (kind === 'willow' && t.waterDist > 4) kind = 'oak'; // willow only near water
        out.push(makeObject(tx, ty, kind, site, t.biome));
        occupied.add(ty * 100000 + tx);
        // Natural rock FORMATIONS: adjacent rocks with y-sorted overlap, not
        // isolated boulders. Only in high cluster-field areas; each extra rock
        // must pass the same authority / access exclusions.
        if (kind === 'rock' && rule.formationFloor !== undefined && field >= rule.formationFloor) {
          const neighbours: [number, number][] = [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, 1]];
          const count = 1 + (Math.floor(hash2(tx, ty, 0xf301 ^ seed) * 3) % 3);
          for (let q = 0; q < count; q++) {
            const [ox, oy] = neighbours[(q + Math.floor(hash2(tx, ty, 0xf302) * neighbours.length)) % neighbours.length];
            const nx = tx + ox, ny = ty + oy;
            const gi = i + ox, gj = j + oy;
            if (gi < 0 || gj < 0 || gi >= N || gj >= N) continue;
            const nf = f[gj * N + gi];
            if (!nf.ok || !nf.land || nf.water || nf.road || nf.bridge || nf.river || nf.lake || nf.coast || nf.sourceTile) continue;
            if (nf.roadDist <= ROAD_BUFFER_TILES) continue;
            if (occupied.has(ny * 100000 + nx)) continue;
            // Extra rocks stay inside the owning chunk: no duplicate objects
            // across a chunk boundary, so positions are stable at every camera x.
            if (Math.floor(nx / PILOT_CHUNK) !== cx || Math.floor(ny / PILOT_CHUNK) !== cy) continue;
            if (siteAt(nx, ny) !== site) continue;
            const jx = Math.round((hash2(nx, ny, 0xf303) - 0.5) * 3);
            const jy = Math.round((hash2(nx, ny, 0xf304) - 0.5) * 3);
            out.push(makeObject(nx, ny, 'rock', site, nf.biome, jx, jy));
            occupied.add(ny * 100000 + nx);
          }
        }
        placed = true;
      }
    }

    /* ---- ground cover (jittered 2x2 lattice + explicit shoreline reeds) ---- */
    if (!placed) {
      let kind: NatureKind | null = null;
      if (rule.waterEdgeGround && t.waterDist <= 2
          && hash2(tx, ty, 0xe207 ^ seed) < (t.waterDist === 1 ? 0.74 : 0.38)) {
        kind = 'reed'; // legible LAND-side fringe of a water boundary; never in the water
      } else if (latticeAnchor(tx, ty, 2, 0xa308 ^ seed, 0xa409 ^ seed)
                 && hash2(tx, ty, 0xb20a ^ seed) < rule.smallChance
                 && t.waterDist >= 1) {
        kind = rule.small[0] ? pick(rule.small, hash2(tx, ty, 0xd20b ^ seed)) : null;
      }
      if (kind && !(t.cliff >= 2 && !ROCKY.has(t.biome) && TALL.has(kind)) && !occupied.has(ty * 100000 + tx)) {
        out.push(makeObject(tx, ty, kind, site, t.biome));
        occupied.add(ty * 100000 + tx);
      }
    }
  }
  return out;
}

function natureChunk(cx: number, cy: number): NatureObject[] {
  const k = `${cx}:${cy}`;
  const hit = cache.get(k);
  if (hit) { hit.used = ++clock; return hit.objects; }
  const objects = buildChunk(cx, cy);
  chunksBuilt++;
  cache.set(k, { objects, used: ++clock });
  while (cache.size > MAX_RESIDENT_NATURE_CHUNKS) {
    let oldest: string | null = null, best = Infinity;
    for (const [kk, v] of cache) if (v.used < best) { best = v.used; oldest = kk; }
    if (!oldest) break;
    cache.delete(oldest); evictions++;
  }
  return objects;
}

/* ------------------------------------------------------------------ *
 * Frame collection / drawing
 * ------------------------------------------------------------------ */
export function natureObjectsInRect(camX: number, camY: number, w: number, h: number): NatureObject[] {
  const t0x = Math.floor(camX / TILE) - 2, t1x = Math.floor((camX + w) / TILE) + 2;
  const t0y = Math.floor(camY / TILE) - 2, t1y = Math.floor((camY + h) / TILE) + 2;
  const c0 = Math.floor(t0x / PILOT_CHUNK), c1 = Math.floor(t1x / PILOT_CHUNK);
  const r0 = Math.floor(t0y / PILOT_CHUNK), r1 = Math.floor(t1y / PILOT_CHUNK);
  const out: NatureObject[] = [];
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    for (const o of natureChunk(cx, cy)) {
      const l = o.wx + o.dx, t = o.wy + o.dy;
      if (l + o.w < camX || l > camX + w || t + o.h < camY || t > camY + h) continue;
      out.push(o);
    }
  }
  return out;
}

/** Shadow is a canvas primitive, NOT a new sprite / atlas / art asset. */
export function drawNatureObject(g: CanvasRenderingContext2D, o: NatureObject, camX: number, camY: number) {
  const arr = getArt().src[o.kind];
  const spr = arr[o.variant % arr.length];
  if (!spr) return;
  if (o.h > 16) {
    g.fillStyle = 'rgba(8,10,16,0.20)';
    g.beginPath();
    g.ellipse(Math.round(o.wx + 8 - camX), Math.round(o.wy + 13 - camY), 6, 2.4, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.drawImage(spr, Math.round(o.wx + o.dx - camX), Math.round(o.wy + o.dy - camY));
}

/** Record the y-sorted draw list for QA (drawing order / hero occlusion proof). */
export function recordFrame(objects: NatureObject[], heroY: number) {
  const sorted = objects.slice().sort((a, b) => a.y - b.y);
  const kindCounts: Record<string, number> = {};
  for (const o of sorted) kindCounts[o.kind] = (kindCounts[o.kind] || 0) + 1;
  const ys = sorted.map(o => o.y);
  lastFrame = {
    objectsInFrame: sorted.length, drawnThisFrame: sorted.length, kindCounts,
    behindHero: sorted.filter(o => o.y <= heroY).length,
    inFrontOfHero: sorted.filter(o => o.y > heroY).length,
    drawOrderSorted: ys.every((v, i) => i === 0 || ys[i - 1] <= v),
    heroY, firstY: ys.length ? ys[0] : 0, lastY: ys.length ? ys[ys.length - 1] : 0
  };
}

/* ------------------------------------------------------------------ *
 * QA audit — bounded to the five pilot windows only
 * ------------------------------------------------------------------ */
export function auditPilot() {
  const bySite: Record<string, { objects: number; kinds: Record<string, number>; biomes: Record<string, number> }> = {};
  const violations = { road: 0, bridge: 0, water: 0, river: 0, lake: 0, coast: 0, sourceTile: 0, roadBuffer: 0, outsideSites: 0, nonDecorative: 0, gameplayOwned: 0 };
  const all: NatureObject[] = [];
  for (const k of SITE_ORDER) {
    const [x0, y0, x1, y1] = SITES[k].boundsTile;
    const acc = { objects: 0, kinds: {} as Record<string, number>, biomes: {} as Record<string, number> };
    for (let cy = Math.floor(y0 / PILOT_CHUNK); cy <= Math.floor((y1 - 1) / PILOT_CHUNK); cy++)
      for (let cx = Math.floor(x0 / PILOT_CHUNK); cx <= Math.floor((x1 - 1) / PILOT_CHUNK); cx++)
        for (const o of natureChunk(cx, cy)) {
          if (o.site !== k) continue;
          acc.objects++; acc.kinds[o.kind] = (acc.kinds[o.kind] || 0) + 1;
          acc.biomes[o.biome] = (acc.biomes[o.biome] || 0) + 1;
          all.push(o);
          const s = sampleTile(o.tx, o.ty);
          if (!s) continue;
          if (s.road) violations.road++;
          if (s.bridge) violations.bridge++;
          if (s.water) violations.water++;
          if (s.river) violations.river++;
          if (s.lake) violations.lake++;
          if (s.coast) violations.coast++;
          if (s.sourceTile) violations.sourceTile++;
          if (s.road || s.bridge) violations.roadBuffer++;
          if (!siteAt(o.tx, o.ty)) violations.outsideSites++;
          if (!o.decorativeOnly) violations.nonDecorative++;
          if (o.gameplayOwned) violations.gameplayOwned++;
        }
    bySite[k] = acc;
  }
  // Eligible land tiles = tiles the rules may legally use (open-ground denominator).
  const eligible: Record<string, number> = {};
  for (const k of SITE_ORDER) {
    const [x0, y0, x1, y1] = SITES[k].boundsTile;
    let n = 0;
    for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
      const s = sampleTile(tx, ty);
      if (!s || !s.authoredLand || s.water || s.road || s.bridge || s.river || s.lake || s.coast || s.sourceTile) continue;
      n++;
    }
    eligible[k] = n;
  }
  const openGround: Record<string, number> = {};
  for (const k of SITE_ORDER) openGround[k] = eligible[k] ? +(1 - bySite[k].objects / eligible[k]).toFixed(4) : 0;
  // Deterministic content hash over every pilot object.
  let hash = 0x811c9dc5;
  const keys = all.map(o => `${o.tx},${o.ty},${o.kind},${o.variant},${o.site}`).sort();
  for (const k of keys) for (let i = 0; i < k.length; i++) { hash ^= k.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return {
    sites: SITE_ORDER.length, totalObjects: all.length,
    bySite, eligible, openGround, violations,
    stabilityHash: ('00000000' + hash.toString(16)).slice(-8),
    allObjects: all.map(o => ({ tx: o.tx, ty: o.ty, kind: o.kind, variant: o.variant, site: o.site, biome: o.biome, y: o.y }))
  };
}

/** Objects inside a tile window — used for chunk-boundary continuity checks. */
export function objectsInTileWindow(tx0: number, ty0: number, tx1: number, ty1: number) {
  const out: { tx: number; ty: number; kind: string; variant: number; y: number }[] = [];
  for (let cy = Math.floor(ty0 / PILOT_CHUNK); cy <= Math.floor((ty1 - 1) / PILOT_CHUNK); cy++)
    for (let cx = Math.floor(tx0 / PILOT_CHUNK); cx <= Math.floor((tx1 - 1) / PILOT_CHUNK); cx++)
      for (const o of natureChunk(cx, cy))
        if (o.tx >= tx0 && o.tx < tx1 && o.ty >= ty0 && o.ty < ty1)
          out.push({ tx: o.tx, ty: o.ty, kind: o.kind, variant: o.variant, y: o.y });
  return out.sort((a, b) => a.ty - b.ty || a.tx - b.tx);
}

export function natureStats() {
  return {
    enabled, residentChunks: cache.size, maxResidentChunks: MAX_RESIDENT_NATURE_CHUNKS,
    chunksBuilt, evictions, emptyChunks,
    objectsInFrame: lastFrame.objectsInFrame, drawnThisFrame: lastFrame.drawnThisFrame,
    kindCountsInFrame: { ...lastFrame.kindCounts },
    behindHero: lastFrame.behindHero, inFrontOfHero: lastFrame.inFrontOfHero,
    drawOrderSorted: lastFrame.drawOrderSorted,
    heroY: lastFrame.heroY, firstY: lastFrame.firstY, lastY: lastFrame.lastY,
    decorativeOnly: true, gameplayOwned: false,
    blocksMovement: false, collisionChanged: false,
    hasInteraction: false, hasRewards: false, hasDepletion: false, hasOwnership: false,
    noNewArt: true, boundedToFivePilotSites: true,
    roadBufferTiles: ROAD_BUFFER_TILES, treeWaterBufferTiles: TREE_WATER_BUFFER_TILES,
    artSource: 'getArt().src (existing SOH pixel art)',
    geographySource: 'GOLD + WMP-04R1 via sampleTile() — READ ONLY'
  };
}

export function setNatureEnabled(on: boolean) { enabled = !!on; return enabled; }
export function isNatureEnabled() { return enabled; }
export function resetNatureCaches() { cache.clear(); clock = 0; chunksBuilt = 0; evictions = 0; emptyChunks = 0; }
