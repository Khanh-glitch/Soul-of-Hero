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
import { compileEconomy, reachableUnion, type Biome, type EconomyMap } from '../game/world-economy';
import { mapDigest } from '../game/map-package';
import type { VeyraViewIdentity } from '../game/veyra/projection';
import { MAP_SOURCE_SHA, BODY_SHA } from '../game/veyra/intake';
import { WMP04R1_META } from '../game/veyra/wmp04r1';
import { U, FRAME_AU, FRAME_W, FRAME_H, CHUNK, auToTile, windowOriginAu, type WindowSpec } from './frame';
import { getChunk, FL, CL, type Chunk } from './chunks';
import { POIS, GOLD } from './reader';
import { slicePoisForWindow, getPoiLayout, type PoiLandmarkProp } from './poi-kit';
import { layoutIdAt, windowForLayout, isVeyra05Layout, U05_WORLD_LAYOUT_ID, type Veyra05Scene } from './scenes';
import { hash2 } from '../game/core';
import { SOURCES, isIndustrialSalvage } from '../game/catalog';
import { pickWeighted } from '../game/world-economy';
import { buildFloorStack, type FloorStack, type FloorLayer } from './floors';

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
  /** G1A: index into POIS of the site that owns each cell (-1 = open world). Read-only census/placement aid. */
  poiAt?: Int16Array;
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

/* ---------------------------------------------------------------------------------------------
 * G1A — versioned salvage placement.
 * rules 3: frozen legacy placement (`scrap` / `wreck`), pinned by the digest of every existing save.
 * rules 4: the three industrial salvage archetypes replace the legacy salvage share on the roadside,
 *          plus a few archetype-matched slots inside industrial POI yards.
 * A run pins its rules in `sourceMap.rules`; the window cache is keyed by (layout, rules) so an old
 * save and a new run never share a compiled source layer.
 * ------------------------------------------------------------------------------------------- */
export type VeyraPlacementRules = 3 | 4;
let placementRules: VeyraPlacementRules = 4;
export const getVeyraPlacementRules = (): VeyraPlacementRules => placementRules;
export function setVeyraPlacementRules(v: VeyraPlacementRules) { placementRules = v === 3 ? 3 : 4; }
/** Point the window builder at the placement a run was created under. Cheap; call wherever a run becomes the active one. */
export function syncVeyraPlacement(r: { layoutId?: string; sourceMap?: { rules: number } } | null | undefined) {
  if (r && r.layoutId && isVeyra05Layout(r.layoutId) && r.sourceMap) placementRules = r.sourceMap.rules === 4 ? 4 : 3;
}

/** POI context: which archetypes fit which existing site archetype (weights). Sites not listed get none. */
export const G1A_POI_WEIGHTS: Readonly<Record<string, readonly [string, number][]>> = {
  warehouse: [['road_salvage_bale', 4], ['road_relay_wreck', 1]],
  port: [['road_salvage_bale', 3], ['road_fuel_rack', 2]],
  pier: [['road_salvage_bale', 3], ['road_fuel_rack', 1]],
  quarry: [['road_salvage_bale', 4], ['road_fuel_rack', 1]],
  sawmill: [['road_salvage_bale', 4], ['road_fuel_rack', 1]],
  mill: [['road_salvage_bale', 1]],
  mine: [['road_salvage_bale', 3], ['road_relay_wreck', 1], ['road_fuel_rack', 1]],
  ruins: [['road_salvage_bale', 3], ['road_relay_wreck', 1]],
  facility: [['road_relay_wreck', 4], ['road_salvage_bale', 1]],
  research: [['road_relay_wreck', 1]],
  observatory: [['road_relay_wreck', 1]],
  smelter: [['road_relay_wreck', 2], ['road_salvage_bale', 2], ['road_fuel_rack', 1]],
  filter: [['road_relay_wreck', 2], ['road_fuel_rack', 2]],
  powerplant: [['road_fuel_rack', 3], ['road_relay_wreck', 2]],
  roadstop: [['road_fuel_rack', 3], ['road_salvage_bale', 1]],
  evac: [['road_fuel_rack', 2], ['road_salvage_bale', 1]],
};
const G1A_POI_RATE = 0.05, G1A_POI_SPACING = 4, G1A_POI_SALT = 0x61a7;

/** G1A-R1: a solid salvage node must never cost the player a walkable cell. Compare what can be walked to with and
 *  without the G1A nodes; wherever a cell is lost, withdraw the node(s) that close it in. Never adds or moves anything. */
function unplugSalvage(ww: WindowWorld): number {
  const g = ww.floors.ground, n = WW * WH; let removed = 0;
  const base = (i: number) => !g.walkable[i] || !!g.solidProps[i] || !!(g.sources[i] && !isIndustrialSalvage(g.sources[i]) && SOURCES[g.sources[i]!]?.block);
  const flood = (solid: (i: number) => boolean) => {
    const r = new Uint8Array(n), q = new Int32Array(n); let h = 0, t = 0;
    for (const a of ww.world.economyMap.starts) { const i = a.y * WW + a.x; if (!solid(i) && !r[i]) { r[i] = 1; q[t++] = i; } }
    // The window rim continues into the next window: an open rim cell counts as reached, so a node is never withdrawn (or kept)
    // because of where the window edge happens to fall.
    for (let i = 0; i < n; i++) { const x = i % WW, y = (i / WW) | 0; if ((x === 0 || y === 0 || x === WW - 1 || y === WH - 1) && !solid(i) && !r[i]) { r[i] = 1; q[t++] = i; } }
    while (h < t) { const i = q[h++], x = i % WW, y = (i / WW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue; const j = ny * WW + nx; if (!r[j] && !solid(j)) { r[j] = 1; q[t++] = j; } } }
    return r;
  };
  const open = flood(base);
  for (let pass = 0; pass < 6; pass++) {
    const now = flood(i => base(i) || isIndustrialSalvage(g.sources[i])); let cut = 0;
    for (let i = 0; i < n; i++) {
      if (!open[i] || now[i] || isIndustrialSalvage(g.sources[i])) continue;
      const x = i % WW, y = (i / WW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue; const j = ny * WW + nx; if (isIndustrialSalvage(g.sources[j])) { g.sources[j] = null; cut++; } }
    }
    removed += cut; if (!cut) break;
  }
  return removed;
}

/** Stand archetype-matched salvage in the open yard of industrial POIs (ground storey only).
 *  Reads the authored layer, never writes masks/tiles/props: a slot must be open yard ground beside a
 *  building, clear of every authored object, with all eight neighbours free so it can always be walked round. */
function placePoiSalvage(ww: WindowWorld, poiAt: Int16Array) {
  const g = ww.floors.ground, ox = ww.win.originTx, oy = ww.win.originTy, n = WW * WH, road = ww.world.economyMap.road;
  const busy = new Uint8Array(n);
  const mark = (x: number, y: number, rad: number) => { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < WW && ny < WH) busy[ny * WW + nx] = 1; } };
  for (const st of g.statics) mark(st.tx, st.ty, 2);
  for (const st of g.lootStatics) mark(st.tx, st.ty, 2);
  for (const st of g.stairs as unknown as { tx?: number; ty?: number; x?: number; y?: number }[]) mark(st.tx ?? st.x ?? -9, st.ty ?? st.y ?? -9, 2);
  for (const p of g.props) mark(Math.floor(p.x), Math.floor(p.y), 1);
  const solid = (i: number) => !g.walkable[i] || !!g.solidProps[i] || !!(g.sources[i] && SOURCES[g.sources[i]!]?.block);
  // ground reachability with every existing obstacle in place
  const reach = new Uint8Array(n), q = new Int32Array(n); let h = 0, t = 0;
  for (const a of ww.world.economyMap.starts) { const i = a.y * WW + a.x; if (!solid(i) && !reach[i]) { reach[i] = 1; q[t++] = i; } }
  while (h < t) { const i = q[h++], x = i % WW, y = (i / WW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue; const j = ny * WW + nx; if (!reach[j] && !solid(j)) { reach[j] = 1; q[t++] = j; } } }
  const cand = new Float32Array(n).fill(2);
  for (let y = 1; y < WH - 1; y++) for (let x = 1; x < WW - 1; x++) {
    const i = y * WW + x, pi = poiAt[i]; if (pi < 0) continue;
    const weights = G1A_POI_WEIGHTS[POIS[pi]?.arche ?? '']; if (!weights) continue;
    const u = hash2(ox + x, oy + y, G1A_POI_SALT); if (u >= G1A_POI_RATE) continue;
    const tl = g.tiles[i];
    if (tl === T.FLOOR || tl === T.ROAD || tl === T.PWALL || tl === T.CLIFF || tl === T.DEEP || tl === T.SHALLOW || tl === T.RIVER || tl === T.MARSH) continue;
    if (!reach[i] || busy[i] || g.sources[i] || road[i]) continue;
    let open = true, roadNear = false;
    for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (y + dy) * WW + x + dx; if (solid(j) || (j !== i && g.sources[j])) { open = false; break; } if (g.tiles[j] === T.ROAD || road[j]) roadNear = true; }
    if (!open || roadNear) continue;
    // "by a building": 2..5 tiles from a wall/floor of the site
    let near = false, tooClose = false;
    for (let dy = -5; dy <= 5 && !tooClose; dy++) for (let dx = -5; dx <= 5; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue; const tt = g.tiles[ny * WW + nx]; if (tt === T.PWALL || tt === T.FLOOR) { if (Math.max(Math.abs(dx), Math.abs(dy)) < 2) { tooClose = true; break; } near = true; } }
    if (!near || tooClose) continue;
    cand[i] = u;
  }
  let placed = 0;
  for (let y = 1; y < WH - 1; y++) for (let x = 1; x < WW - 1; x++) {
    const i = y * WW + x, u = cand[i]; if (u >= 2) continue;
    let best = true;
    for (let dy = -G1A_POI_SPACING; dy <= G1A_POI_SPACING && best; dy++) for (let dx = -G1A_POI_SPACING; dx <= G1A_POI_SPACING; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= WW || ny >= WH || (!dx && !dy)) continue; const v = cand[ny * WW + nx]; if (v < u || (v === u && ny * WW + nx < i)) { best = false; break; } }
    if (!best) continue;
    g.sources[i] = pickWeighted(G1A_POI_WEIGHTS[POIS[poiAt[i]].arche], hash2(ox + x, oy + y, G1A_POI_SALT ^ 0x55));
    placed++;
  }
  return placed;
}

export function buildWindowWorld(layoutId: string, rules: VeyraPlacementRules = placementRules): WindowWorld {
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
  const poiAt = new Int16Array(n).fill(-1);
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
      poiAt[i] = c.poi[ci] !== 255 ? c.poi[ci] : -1;
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
    const pCompiled = compileEconomy(paddedMap, rules);
    if (pCompiled.errors.length) throw Error(`Veyra U=0.5 padded compiler: ${pCompiled.errors.join('; ')}`);
    sourceV3 = new Array(n).fill(null);
    // Verify 200x200 reachability so every source inside the window is reachable from window anchors
    const wReached=reachableUnion(economyMap);
    for (let y = 0; y < WH; y++) {
      for (let x = 0; x < WW; x++) {
        const i = y * WW + x, pi = (y + PAD) * PW + (x + PAD);
        const sk = pCompiled.sources[pi];
        if (sk && wReached[i]) sourceV3[i] = sk;
      }
    }
  } else {
    const compiled = compileEconomy(economyMap, rules);
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
    floors: null as unknown as FloorStack, poiAt,
  };
  ww.floors = buildFloorStack(ww);
  if (rules === 4) { placePoiSalvage(ww, poiAt); unplugSalvage(ww); }
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
export function getWindowWorld(layoutId: string, rules: VeyraPlacementRules = placementRules): WindowWorld {
  const key = rules === 3 ? layoutId : `${layoutId}|r${rules}`;
  let w = cache.get(key);
  if (!w) {
    w = buildWindowWorld(layoutId, rules);
    cache.set(key, w);
    if (cache.size > 16) cache.delete(cache.keys().next().value!);
  }
  return w;
}

/** Resolve a canonical cached `WindowWorld` covering global tile `(gx, gy)` so offscreen
 *  homesteads read the exact same Map-owned `economyMap`, `floors`, `sources`, and `solidProps`
 *  as when onscreen, while sharing one cached window per 64-tile region. */
export function getWindowWorldForGlobalTile(gx: number, gy: number, rules: VeyraPlacementRules = placementRules): WindowWorld {
  const ox = Math.max(0, Math.min(FRAME_W - WW, Math.floor((gx - 68) / 64) * 64));
  const oy = Math.max(0, Math.min(FRAME_H - WH, Math.floor((gy - 68) / 64) * 64));
  return getWindowWorld(layoutIdAt(ox, oy),rules);
}

interface GlobalBaseCell {
  originTx:number;originTy:number;tile:number;walkable:boolean;source:string|null;
  solidProp:boolean;fresh:boolean;statics:FloorLayer['statics'];
}
interface GeometryRegion {
  originTx:number;originTy:number;tiles:Uint8Array;walkable:Uint8Array;solidProps:Uint8Array;
  fresh?:Uint8Array;sources:Map<number,string>;statics:Map<number,FloorLayer['statics']>;
}
// Only query geometry, NOT compiled render/economy worlds, is retained. Three
// masks + sparse source/static records per queried floor; bounded128 regions.
// This avoids the 16-view render cache thrashing across81 inhabited sites.
const geometryRegions=new Map<string,GeometryRegion|null>();
/** Immutable compiler output only. All door/source/terrain/entity deltas remain
 * RunState reads in the caller. Never cache a mutable stock or access decision. */
export function globalBaseGeometry(gx:number,gy:number,floor:number,rules:VeyraPlacementRules,layout?:string):GlobalBaseCell|null {
  const ox=Math.max(0,Math.min(FRAME_W-WW,Math.floor((gx-68)/64)*64));
  const oy=Math.max(0,Math.min(FRAME_H-WH,Math.floor((gy-68)/64)*64));
  const id=layout??layoutIdAt(ox,oy),key=`${rules}:${id}:${floor}`;
  let region=geometryRegions.get(key);
  if(region===undefined){
    const w=getWindowWorld(id,rules),layer=floor===0?w.floors.ground:w.floors.layers.get(floor as -1|0|1|2);
    region=null;
    if(layer){
      const sources=new Map<number,string>(),statics=new Map<number,FloorLayer['statics']>();
      for(let i=0;i<layer.sources.length;i++)if(layer.sources[i])sources.set(i,layer.sources[i]!);
      for(const s of layer.statics){const k=s.ty*WW+s.tx,list=statics.get(k);if(list)list.push(s);else statics.set(k,[s]);}
      region={originTx:w.win.originTx,originTy:w.win.originTy,tiles:layer.tiles.slice(),walkable:layer.walkable.slice(),solidProps:layer.solidProps.slice(),fresh:floor===0?w.world.fresh.slice():undefined,sources,statics};
    }
    geometryRegions.set(key,region);
    if(geometryRegions.size>128)geometryRegions.delete(geometryRegions.keys().next().value!);
  } else {geometryRegions.delete(key);geometryRegions.set(key,region);}
  if(!region)return null;
  const x=gx-region.originTx,y=gy-region.originTy;
  if(x<0||y<0||x>=WW||y>=WH)return null;
  const i=y*WW+x;
  return {originTx:region.originTx,originTy:region.originTy,tile:region.tiles[i],walkable:!!region.walkable[i],source:region.sources.get(i)??null,solidProp:!!region.solidProps[i],fresh:!!region.fresh?.[i],statics:region.statics.get(i)??[]};
}
/** Same compiler freshwater mask as player; transient ice is read by engine. */
export function globalBaseWaterCell(gx:number,gy:number,rules:VeyraPlacementRules): {fresh:boolean;tile:number} {
  if(gx<0||gy<0||gx>=FRAME_W||gy>=FRAME_H)return {fresh:false,tile:T.CLIFF};
  const cell=globalBaseGeometry(gx,gy,0,rules);
  return {fresh:cell?.fresh??false,tile:cell?.tile??T.CLIFF};
}
