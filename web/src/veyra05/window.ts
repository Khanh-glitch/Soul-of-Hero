/**
 * ENGINE WINDOW MATERIALISER — cuts a bounded 200x200 live-engine `World` out of
 * the streamed U=0.5 frame:
 *   - NO artificial T.CLIFF wall on local window edges (TASK 3): only the true
 *     4000x2800 outer ocean frame edge is bounded; interior window edges carry
 *     the real streamed terrain/roads/POIs so players can cross seamlessly.
 *   - Materialises all canonical POIs intersecting the window via poi-kit.ts:
 *     real T.FLOOR, T.PWALL, T.ROAD, stone masonry zones, clipped w.buildings
 *     (roofs), and unlocked w.statics doors — never inventing loot/cash/bridges.
 *   - Compiles sources with an 8-tile padded neighborhood (216x216 -> 200x200)
 *     using global coordinates so overlapping/slid windows have identical
 *     resource identities right up to the window edge.
 *   - Pre-filters spawnEligible by freshwater reachability so Gameplay's
 *     unmodified chooseLegalSpawn() succeeds fast on every playable region.
 */
import { T, TILE, WW, WH } from '../game/core';
import type { World, Place } from '../game/world';
import { compileEconomy, reachable, type Biome, type EconomyMap } from '../game/world-economy';
import { mapDigest } from '../game/map-package';
import type { VeyraViewIdentity } from '../game/veyra/projection';
import { MAP_SOURCE_SHA, BODY_SHA } from '../game/veyra/intake';
import { WMP04R1_META } from '../game/veyra/wmp04r1';
import { U, FRAME_AU, FRAME_W, FRAME_H, CHUNK, auToTile, windowOriginAu, type WindowSpec } from './frame';
import { getChunk, FL, CL, type Chunk } from './chunks';
import { POIS, GOLD } from './reader';
import { slicePoisForWindow, getPoiLayout, type PoiLandmarkProp } from './poi-kit';
import { layoutIdAt, windowForLayout, U05_WORLD_LAYOUT_ID, type Veyra05Scene } from './scenes';
import { buildFloorStack, type FloorStack } from './floors';

const CODE_BIOME: Biome[] = ['meadow', 'forest', 'forest', 'forest', 'marsh', 'sand', 'hill', 'hill', 'snow', 'ash', 'toxic', 'sand'];
const TILE_BIOME: Partial<Record<number, Biome>> = {
  [T.GRASS]: 'grass', [T.MEADOW]: 'meadow', [T.FOREST]: 'forest', [T.MARSH]: 'marsh',
  [T.SAND]: 'sand', [T.HILL]: 'hill', [T.SNOW]: 'snow', [T.ASH]: 'ash', [T.TOXIC]: 'toxic',
  [T.CLIFF]: 'wall', [T.ROAD]: 'road', [T.FLOOR]: 'floor', [T.PWALL]: 'wall',
};
const INDUSTRIAL_ARCHE = new Set(['quarry', 'powerplant', 'sawmill', 'mill', 'smelter', 'warehouse', 'port', 'mine', 'facility', 'filter']);

export interface WindowWorld {
  world: World;
  win: WindowSpec;
  scene: Veyra05Scene | null;
  chunksTouched: string[];
  buildMs: number;
  poiIds: string[];
  bridgeNodes: { id: string; tx: number; ty: number; tile: number }[];
  landmarks: PoiLandmarkProp[];
  floors: FloorStack;
  reservations: { x: number; y: number; w: number; h: number; label: string }[];
}

/** Read a global tile through the stream, with chunk reuse inside one window build. */
function reader() {
  const local = new Map<string, Chunk>(); const touched: string[] = [];
  const get = (tx: number, ty: number) => {
    const cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK), k = cx + ':' + cy;
    let c = local.get(k);
    if (!c) { c = getChunk(cx, cy); local.set(k, c); touched.push(c.key); }
    return { c, i: (ty - cy * CHUNK) * CHUNK + (tx - cx * CHUNK) };
  };
  return { get, touched };
}

export function buildWindowWorld(layoutId: string): WindowWorld {
  const spec = windowForLayout(layoutId);
  if (!spec) throw Error(`Unknown Veyra U=0.5 layout ${layoutId}`);
  const { win, scene } = spec;
  if (win.w !== WW || win.h !== WH) throw Error('window must match the live engine bounds');
  const t0 = performance.now();
  const n = WW * WH;
  const rd = reader();

  // Slice canonical POIs intersecting the padded window (so edge source thinning sees POI footprints too)
  const PAD = 8, PW = WW + PAD * 2, PH = WH + PAD * 2, PN = PW * PH;
  const paddedWin: WindowSpec = { originTx: win.originTx - PAD, originTy: win.originTy - PAD, w: PW, h: PH };
  const poiSlice = slicePoisForWindow(win);

  // Build padded POI tile overrides for the 216x216 economy compilation
  const paddedPoiTiles = new Map<number, number>();
  for (const pid of poiSlice.poiIds) {
    const l = getPoiLayout(pid);
    for (const [gk, t] of l.tiles) {
      const gx = gk % FRAME_W, gy = (gk / FRAME_W) | 0;
      const px = gx - paddedWin.originTx, py = gy - paddedWin.originTy;
      if (px >= 0 && py >= 0 && px < PW && py < PH) paddedPoiTiles.set(py * PW + px, t);
    }
  }

  const pBiome: Biome[] = new Array(PN);
  const pElev = new Float32Array(PN), pSlope = new Float32Array(PN), pMoist = new Float32Array(PN), pTemp = new Float32Array(PN);
  const pFresh = new Uint8Array(PN), pCoast = new Uint8Array(PN), pWalk = new Uint8Array(PN), pBuild = new Uint8Array(PN);
  const pCargo = new Uint8Array(PN), pRoad = new Uint8Array(PN), pProt = new Uint8Array(PN), pInd = new Uint8Array(PN);

  for (let py = 0; py < PH; py++) {
    for (let px = 0; px < PW; px++) {
      const pi = py * PW + px, gx = paddedWin.originTx + px, gy = paddedWin.originTy + py;
      if (gx <= 0 || gy <= 0 || gx >= FRAME_W - 1 || gy >= FRAME_H - 1) {
        pBiome[pi] = 'wall'; pElev[pi] = 0; pSlope[pi] = 1; pMoist[pi] = 0.5; pTemp[pi] = 0.5; pProt[pi] = 1; continue;
      }
      const { c, i: ci } = rd.get(gx, gy);
      const ov = paddedPoiTiles.get(pi);
      const t = ov !== undefined ? ov : c.tile[ci];
      const fl = c.flags[ci], cl = c.clim[ci], code = c.biome[ci];
      const water = t === T.DEEP || t === T.SHALLOW || t === T.RIVER;
      const isRoad = t === T.ROAD, isCliff = t === T.CLIFF || t === T.PWALL, isFloor = t === T.FLOOR;
      const poi = c.poi[ci] !== 255 || ov !== undefined;
      pFresh[pi] = +(water && !!(fl & FL.LAND));
      pBiome[pi] = water ? 'water' : (TILE_BIOME[t] ?? CODE_BIOME[code] ?? 'meadow');
      pElev[pi] = c.elev[ci] / 255;
      pSlope[pi] = isCliff ? 1 : (t === T.HILL ? 0.3 : 0.05);
      pMoist[pi] = code === 4 ? .8 : code === 1 || code === 2 ? .65 : code === 5 || code === 6 ? .2 : .45;
      if (cl & CL.NEAR_WATER) pMoist[pi] = Math.min(1, pMoist[pi] + .15);
      pTemp[pi] = code === 8 ? .15 : code === 9 ? .8 : code === 3 ? .28 : .55;
      if ((cl & CL.COLD) && code !== 8 && !water) pTemp[pi] = Math.min(pTemp[pi], .28);
      pWalk[pi] = +(!water && !isCliff);
      pRoad[pi] = +isRoad;
      pCoast[pi] = +!!(fl & FL.COAST);
      pProt[pi] = +(poi || isRoad || isFloor);
      pBuild[pi] = +(!water && !isRoad && !poi && !isCliff && !isFloor);
      pCargo[pi] = +(!water && !isCliff);
      if (c.poi[ci] !== 255) {
        const arche = POIS[c.poi[ci]]?.arche;
        if (arche && INDUSTRIAL_ARCHE.has(arche)) pInd[pi] = 1;
      }
    }
  }

  // Extract 200x200 window arrays from the padded grid (NO artificial T.CLIFF on window borders!)
  const tiles = new Uint8Array(n), fresh = new Uint8Array(n), zone = new Uint8Array(n), seaDist = new Uint8Array(n).fill(255);
  const biome: Biome[] = new Array(n), elevation = new Float32Array(n), slope = new Float32Array(n), moisture = new Float32Array(n), temperature = new Float32Array(n);
  const walkable = new Uint8Array(n), buildable = new Uint8Array(n), cargoPassable = new Uint8Array(n), road = new Uint8Array(n), protectedCells = new Uint8Array(n), industrial = new Uint8Array(n), coast = new Uint8Array(n), spawnEligible = new Uint8Array(n);

  for (let y = 0; y < WH; y++) {
    for (let x = 0; x < WW; x++) {
      const i = y * WW + x, pi = (y + PAD) * PW + (x + PAD), gx = win.originTx + x, gy = win.originTy + y;
      if (gx <= 0 || gy <= 0 || gx >= FRAME_W - 1 || gy >= FRAME_H - 1) {
        tiles[i] = T.CLIFF; biome[i] = 'wall'; protectedCells[i] = 1; continue;
      }
      const { c, i: ci } = rd.get(gx, gy);
      const ov = poiSlice.tileOverrides.get(i);
      const t = ov !== undefined ? ov : c.tile[ci];
      tiles[i] = t;
      fresh[i] = pFresh[pi];
      zone[i] = poiSlice.stoneCells.has(i) ? 7 : 0;
      biome[i] = pBiome[pi];
      elevation[i] = pElev[pi];
      slope[i] = pSlope[pi];
      moisture[i] = pMoist[pi];
      temperature[i] = pTemp[pi];
      walkable[i] = pWalk[pi];
      road[i] = pRoad[pi];
      coast[i] = pCoast[pi];
      protectedCells[i] = pProt[pi];
      buildable[i] = pBuild[pi];
      cargoPassable[i] = pCargo[pi];
      industrial[i] = pInd[pi];
    }
  }

  // Spread industrial flag 6 tiles around industrial POIs
  for (let y = 1; y < WH - 1; y++) {
    for (let x = 1; x < WW - 1; x++) {
      const i = y * WW + x;
      if (!industrial[i] || tiles[i] === T.FLOOR || tiles[i] === T.PWALL) continue;
      const { c, i: ci } = rd.get(win.originTx + x, win.originTy + y);
      if (c.poi[ci] === 255) continue;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1) continue;
        const j = ny * WW + nx;
        if (walkable[j] && !protectedCells[j]) industrial[j] = 1;
      }
    }
  }

  // Sea coast distance BFS (for shore foam rendering)
  const queue = new Int32Array(n); let head = 0, tail = 0;
  for (let i = 0; i < n; i++) if (tiles[i] === T.DEEP) { seaDist[i] = 0; queue[tail++] = i; }
  while (head < tail) {
    const i = queue[head++], x = i % WW, y = (i / WW) | 0;
    if (seaDist[i] >= 8) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue;
      const j = ny * WW + nx;
      if (seaDist[j] > seaDist[i] + 1) { seaDist[j] = seaDist[i] + 1; queue[tail++] = j; }
    }
  }

  // Global-chunk-aligned reachability anchors (gx % 32 === 16, gy % 32 === 16) for 100% window-invariant source placement
  const pAnchors: { id: string; x: number; y: number }[] = [];
  for (let py = 8; py < PH - 8; py++) {
    const gy = paddedWin.originTy + py;
    if ((gy & 31) !== 16) continue;
    for (let px = 8; px < PW - 8; px++) {
      const gx = paddedWin.originTx + px;
      if ((gx & 31) !== 16) continue;
      if (pWalk[py * PW + px]) pAnchors.push({ id: `g_${gx}_${gy}`, x: px, y: py });
    }
  }
  if (!pAnchors.length) {
    for (let py = 8; py < PH - 8 && pAnchors.length < 4; py += 7) {
      for (let px = 8; px < PW - 8 && pAnchors.length < 4; px += 7) {
        if (pWalk[py * PW + px]) pAnchors.push({ id: `g_${px}_${py}`, x: px, y: py });
      }
    }
  }

  const anchors: { id: string; x: number; y: number }[] = [];
  for (let y = 20; y < WH - 20; y += 40) {
    for (let x = 20; x < WW - 20; x += 40) {
      if (walkable[y * WW + x]) anchors.push({ id: `compiler_${x}_${y}`, x, y });
    }
  }
  if (!anchors.length) {
    for (let y = 3; y < WH - 3 && anchors.length < 4; y += 7) {
      for (let x = 3; x < WW - 3 && anchors.length < 4; x += 7) {
        if (walkable[y * WW + x]) anchors.push({ id: `compiler_${x}_${y}`, x, y });
      }
    }
  }
  if (!anchors.length) throw Error('No walkable terrain in this Veyra U=0.5 window');

  const economyMap: EconomyMap = {
    id: 'veyra05', revision: 1, seed: 2026, width: WW, height: WH, tileSize: TILE,
    biome, elevation, slope, moisture, temperature, freshwater: fresh, coast,
    walkable, buildable, cargoPassable, road, protected: protectedCells, industrial,
    starts: anchors, origin: { x: win.originTx, y: win.originTy },
  };

  let sourceV3: (string | null)[];
  if (pAnchors.length) {
    const paddedMap: EconomyMap = {
      id: 'veyra05', revision: 1, seed: 2026, width: PW, height: PH, tileSize: TILE,
      biome: pBiome, elevation: pElev, slope: pSlope, moisture: pMoist, temperature: pTemp,
      freshwater: pFresh, coast: pCoast, walkable: pWalk, buildable: pBuild, cargoPassable: pCargo,
      road: pRoad, protected: pProt, industrial: pInd, starts: pAnchors,
      origin: { x: paddedWin.originTx, y: paddedWin.originTy },
    };
    const pCompiled = compileEconomy(paddedMap);
    if (pCompiled.errors.length) throw Error(`Veyra U=0.5 padded compiler: ${pCompiled.errors.join('; ')}`);
    sourceV3 = new Array(n).fill(null);
    // Verify 200x200 reachability so every source inside the window is reachable from window anchors
    const wReached = new Uint8Array(n);
    for (const a of anchors) {
      const d = reachable(economyMap, a.x, a.y);
      for (let i = 0; i < n; i++) if (d[i] >= 0) wReached[i] = 1;
    }
    for (let y = 0; y < WH; y++) {
      for (let x = 0; x < WW; x++) {
        const i = y * WW + x, pi = (y + PAD) * PW + (x + PAD);
        const sk = pCompiled.sources[pi];
        if (sk && wReached[i]) sourceV3[i] = sk;
      }
    }
  } else {
    const compiled = compileEconomy(economyMap);
    if (compiled.errors.length) throw Error(`Veyra U=0.5 source compiler: ${compiled.errors.join('; ')}`);
    sourceV3 = compiled.sources;
  }

  // Fast freshwater-distance prefilter for spawnEligible (so chooseLegalSpawn runs in <5ms)
  const freshDist = new Uint8Array(n).fill(255);
  let fHead = 0, fTail = 0;
  for (let i = 0; i < n; i++) if (fresh[i]) { freshDist[i] = 0; queue[fTail++] = i; }
  while (fHead < fTail) {
    const i = queue[fHead++], x = i % WW, y = (i / WW) | 0;
    if (freshDist[i] >= 28) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue;
      const j = ny * WW + nx;
      if (freshDist[j] > freshDist[i] + 1) { freshDist[j] = freshDist[i] + 1; queue[fTail++] = j; }
    }
  }

  const [fx, fy] = scene ? auToTile(scene.focusAu[0], scene.focusAu[1]) : [win.originTx + WW / 2, win.originTy + WH / 2];
  let nearCount = 0;
  for (let y = 3; y < WH - 3; y++) {
    for (let x = 3; x < WW - 3; x++) {
      const i = y * WW + x, t = tiles[i];
      if (!walkable[i] || freshDist[i] > 27 || t === T.TOXIC || t === T.ASH || t === T.SNOW || t === T.FLOOR || t === T.PWALL) continue;
      const dFocus = Math.hypot(win.originTx + x - fx, win.originTy + y - fy);
      if (dFocus >= 10 && dFocus <= 42) { spawnEligible[i] = 1; nearCount++; }
    }
  }
  if (nearCount < 16) {
    spawnEligible.fill(0);
    let anyWet = 0;
    for (let y = 3; y < WH - 3; y++) {
      for (let x = 3; x < WW - 3; x++) {
        const i = y * WW + x, t = tiles[i];
        if (walkable[i] && freshDist[i] <= 28 && t !== T.TOXIC && t !== T.ASH && t !== T.SNOW && t !== T.FLOOR && t !== T.PWALL) {
          spawnEligible[i] = 1; anyWet++;
        }
      }
    }
    // A window with no viable freshwater-nearby cells can never satisfy
    // chooseLegalSpawn's mandatory 30-step freshwater rule.  Previously this
    // fallback marked ALL 40k cells eligible, causing futile rejection scans
    // (and misleading diagnostics) without creating a single legal spawn.
    // Reject it explicitly; do not mint water or relax the survival contract.
    if (anyWet === 0) spawnEligible.fill(0);
  }

  const originAu = windowOriginAu(win);
  const identity: VeyraViewIdentity = {
    sourceCommit: MAP_SOURCE_SHA, sourceDigest: BODY_SHA, originAu, unitsPerTile: U,
    frameAu: [FRAME_AU[0], FRAME_AU[1]], projection: 'cell-centre-v1',
    worldRevision: 'WMP-04R1', sceneId: layoutId, beforeLayoutId: null, analysisCellAu: 8,
    geometrySource: 'GOLD_LR01_AUTHORED_POLYGONS_AND_CENTRELINES__UNCHANGED',
    biomeSource: 'WMP04R1_BIOME_EFFECTIVE_R1',
    activeRevisionDigest: WMP04R1_META.provenance.manifestR1Sha256,
  };

  // Places: every POI intersecting this window (anchor clamped to interior if envelope straddles edge)
  const places: Place[] = poiSlice.poiIds.map(id => {
    const p = POIS.find(q => q.id === id)!;
    const [tx, ty] = auToTile(p.at[0], p.at[1]);
    return {
      id: p.id, name: p.name,
      tx: Math.max(1, Math.min(WW - 2, tx - win.originTx)),
      ty: Math.max(1, Math.min(WH - 2, ty - win.originTy)),
      kind: 'poi' as const,
    };
  });

  const bridgeNodes = GOLD.project.bridges
    .map(b => { const [tx, ty] = auToTile(b.at[0], b.at[1]); return { id: b.id, tx: tx - win.originTx, ty: ty - win.originTy }; })
    .filter(b => b.tx >= 0 && b.ty >= 0 && b.tx < WW && b.ty < WH)
    .map(b => ({ ...b, tile: tiles[b.ty * WW + b.tx] }));

  const world: World = {
    tiles, fresh, zone, seaDist,
    src: new Int8Array(n).fill(-1),
    sourceOverlayV2: new Int8Array(n).fill(-1),
    buildings: poiSlice.buildings,
    statics: poiSlice.statics,
    places,
    starts: [],
    elders: [],
    economyMap,
    vehicleGeometry: {
      version: 'vehicle-geometry-v1',
      mapId: economyMap.id,
      mapRevision: economyMap.revision,
      width: WW,
      height: WH,
      tileSize: TILE,
      passable: economyMap.cargoPassable,
      road: economyMap.road,
      slope: economyMap.slope,
      parking: economyMap.cargoPassable,
      exit: economyMap.walkable,
    },
    sourceV3,
    veyra: identity,
    randomSpawn: true,
    spawnEligible,
    enforceMasks: true,
    zoneNames: [scene ? `Veyra · ${scene.short}` : layoutId === U05_WORLD_LAYOUT_ID ? 'VEYRA · Unified World' : 'VEYRA · U=0.5'],
  };

  const ww: WindowWorld = {
    world, win, scene, chunksTouched: rd.touched, buildMs: performance.now() - t0,
    poiIds: poiSlice.poiIds, bridgeNodes, landmarks: poiSlice.landmarks, reservations: poiSlice.reservations,
    floors: null as unknown as FloorStack,
  };
  ww.floors = buildFloorStack(ww);
  resetWindowToGround(ww);
  // Pin ground-level mapDigest in map-package WeakMap so storey switches never alter mapDigest(world).
  mapDigest(world);
  return ww;
}

export function resetWindowToGround(ww: WindowWorld) {
  const { world } = ww;
  const g = ww.floors.ground;
  const n = WW * WH;
  world.tiles.set(g.tiles); world.zone.set(g.zone);
  (world.economyMap.walkable as Uint8Array).set(g.walkable);
  (world.economyMap.protected as Uint8Array).set(g.protectedCells);
  (world.economyMap.buildable as Uint8Array).set(g.buildable);
  for (let i = 0; i < n; i++) world.sourceV3[i] = g.sources[i];
  world.buildings = g.buildings; world.statics = g.statics.slice();
}

const cache = new Map<string, WindowWorld>();
export function getWindowWorld(layoutId: string): WindowWorld {
  let w = cache.get(layoutId);
  if (!w) {
    w = buildWindowWorld(layoutId);
    cache.set(layoutId, w);
    if (cache.size > 16) cache.delete(cache.keys().next().value!);
  }
  return w;
}

/** Resolve a canonical cached `WindowWorld` covering global tile `(gx, gy)` so offscreen
 *  homesteads read the exact same Map-owned `economyMap`, `floors`, `sources`, and `solidProps`
 *  as when onscreen, while sharing one cached window per 64-tile region. */
export function getWindowWorldForGlobalTile(gx: number, gy: number): WindowWorld {
  const ox = Math.max(0, Math.min(FRAME_W - WW, Math.floor((gx - 68) / 64) * 64));
  const oy = Math.max(0, Math.min(FRAME_H - WH, Math.floor((gy - 68) / 64) * 64));
  return getWindowWorld(layoutIdAt(ox, oy));
}
