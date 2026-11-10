/**
 * VEYRA05 ARCHITECTURAL POI BUILDER & KIT (Global U=0.5 Tile Authority).
 *
 * Replaces uniform cookie-cutter boxes and removes all `(x+y)%5` arbitrary
 * perimeter rules. Every POI responds to its settlement history, physical
 * function, real GOLD terrain, roads, water access, and WMP-03 architecture:
 *   - Hand-authored bespoke plans for flagship locations:
 *       * po_greywater (Greywater Hamlet): lakeside fishing & cart village
 *         with cobbled Market Square, central well, North Lakefront Lane,
 *         and 6 distinct dwellings/workshops with timber verandas & yards.
 *       * po_academy (Argus Academy): formal highland stone research compound
 *         with Twin-Pylon South Gatehouse, flagged Ceremonial Avenue, central
 *         Astrolabe Quadrangle, cloister walks, and 4 collegiate wings.
 *       * po_ironmine (Ironholm Mine): industrial riverbank mining & smelting
 *         works with dressed-stone river quay, open-air ore sluice yard,
 *         haulage trunk, Adit Headhouse, and Foundry Forge.
 *   - Archetype-tailored spatial plans for all remaining 78 canonical POIs.
 *   - Zero arbitrary modulo fences; zero water overwrites (MGP-D09); zero
 *     invented doors/roofs on the 25 open-air POIs (MGP-D04); preserves
 *     Beacon grounded helicopter reservation (MGP-D07).
 */
import { T, WW, WH } from '../game/core';
import type { Building, StaticEnt } from '../game/world';
import { POIS, sampleTile, type GoldPoi } from './reader';
import { POI_ARCH, type PoiArchSpec } from './poi-arch.generated';
import { auToTile, FRAME_W, FRAME_H, type WindowSpec } from './frame';
import { AUTHORED_SITES } from './arch/sites';

export type PoiBuildMode = 'PILOT_U05' | 'KIT_ENCLOSED' | 'KIT_OPEN_AIR';

export interface GlobalBuilding {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  roof: 'thatch' | 'tile' | 'tin' | 'wood' | 'light' | 'hull';
  material: 'wood' | 'stone';
  doorTx: number;
  doorTy: number;
}

export interface GlobalDoor {
  tx: number;
  ty: number;
  poi: string;
  label: string;
}

export interface PoiLandmarkProp {
  tx: number;
  ty: number;
  kind: 'well' | 'lantern' | 'sundial' | 'forge' | 'ore_cart' | 'bollard' | 'bench';
}

export interface GlobalPoiLayout {
  id: string;
  name: string;
  arche: string;
  mode: PoiBuildMode;
  atTile: [number, number];
  bbox: [number, number, number, number];
  tiles: Map<number, number>;
  stoneTiles: Set<number>;
  buildings: GlobalBuilding[];
  doors: GlobalDoor[];
  landmarks: PoiLandmarkProp[];
  reservationBox?: { x: number; y: number; w: number; h: number; label: string };
  conflicts: string[];
  metrics: {
    floorCells: number;
    wallCells: number;
    buildingCount: number;
    roofCount: number;
    roofTiles: number;
    doorCount: number;
    walkableApproach: boolean;
    accessibleInteriors: number;
  };
}

const gKey = (tx: number, ty: number) => ty * FRAME_W + tx;
const isDry = (tx: number, ty: number) => {
  if (tx < 1 || ty < 1 || tx >= FRAME_W - 1 || ty >= FRAME_H - 1) return false;
  const s = sampleTile(tx, ty);
  return s.land && !s.river && !s.lake;
};
const isWaterTile = (tx: number, ty: number) => {
  if (tx < 0 || ty < 0 || tx >= FRAME_W || ty >= FRAME_H) return true;
  const s = sampleTile(tx, ty);
  return !s.land || s.river || s.lake;
};

const STONE_ARCHES = new Set([
  'research', 'observatory', 'facility', 'powerplant', 'smelter',
  'warehouse', 'mine', 'quarry', 'ruins', 'elder_site', 'tomb', 'gate',
  'filter', 'ragnarok_cache', 'evac',
]);

function roofStyleFor(arche: string, idx: number, u05Roof: string | null): GlobalBuilding['roof'] {
  if (u05Roof && ['thatch', 'tile', 'tin', 'wood', 'light', 'hull'].includes(u05Roof)) {
    return u05Roof as GlobalBuilding['roof'];
  }
  switch (arche) {
    case 'village': return (['thatch', 'tile', 'tin', 'wood', 'thatch', 'tile'] as const)[idx % 6];
    case 'hamlet': return (['thatch', 'wood'] as const)[idx % 2];
    case 'roadstop': return (['wood', 'thatch'] as const)[idx % 2];
    case 'port': return (['wood', 'tin'] as const)[idx % 2];
    case 'research': return (['tile', 'tin'] as const)[idx % 2];
    case 'observatory': return idx === 0 ? 'light' : 'tile';
    case 'facility':
    case 'powerplant':
    case 'warehouse':
    case 'smelter':
    case 'mine':
    case 'ragnarok_cache': return 'tin';
    case 'sawmill':
    case 'mill': return (['wood', 'thatch'] as const)[idx % 2];
    case 'tomb':
    case 'gate':
    case 'chest_vendor': return 'tile';
    default: return 'wood';
  }
}

function buildingLabel(poiName: string, arche: string, idx: number, total: number): string {
  if (poiName === 'Greywater Hamlet') {
    return [
      'Lakeside Net Cottage',
      'Greywater Gatehouse & Commons',
      'East Salt & Timber Barn',
      'Cartwright & Smithy Workshop',
      'Hamlet Elder Hearth House',
      'South Granary & Loft',
    ][idx] || `${poiName} Dwelling ${idx + 1}`;
  }
  if (poiName === 'Argus Academy') {
    return [
      'West Lecture & Astrolabe Hall',
      'East Arcana & Alchemical Lab',
      'Scriptorium & Vault Archive',
      'Scholars Refectory & Quarters',
    ][idx] || `${poiName} Wing ${idx + 1}`;
  }
  if (poiName === 'Ironholm Mine') {
    return [
      'Ironholm Adit Headhouse',
      'Ironholm Foundry & Forge',
    ][idx] || `${poiName} Works ${idx + 1}`;
  }
  if (arche === 'observatory' && idx === 0) return `${poiName} Tower`;
  if (total === 1) return poiName;
  const suffix: Record<string, string[]> = {
    village: ['North Cottage', 'Gatehouse', 'East Dwelling', 'West Shed', 'Commons', 'Storehouse'],
    hamlet: ['Main Homestead', 'Timber Shed'],
    research: ['West Hall', 'East Laboratory', 'Archive Wing', 'Commons Wing'],
    facility: ['West Block', 'North Block', 'East Block', 'South Block'],
    port: ['Harbour Shed', 'Freight Canopy'],
    sawmill: ['Mill Hall', 'Timber Shed', 'Drying Barn', 'Tool House'],
    smelter: ['Kiln Hall', 'Foundry Shed', 'Coal Store', 'Forge Annex'],
    warehouse: ['West Depot', 'Central Bay', 'East Depot'],
    mine: ['Adit Headhouse', 'Smelting Forge'],
  };
  return `${poiName} · ${(suffix[arche] && suffix[arche][idx]) || `Building ${idx + 1}`}`;
}

function connectedDrySet(seed: [number, number], minX: number, minY: number, maxX: number, maxY: number): Set<number> {
  const vis = new Set<number>();
  if (!isDry(seed[0], seed[1])) return vis;
  const q: number[] = [gKey(seed[0], seed[1])];
  vis.add(q[0]);
  for (let head = 0; head < q.length && vis.size < 20000; head++) {
    const cur = q[head], x = cur % FRAME_W, y = (cur / FRAME_W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const nk = gKey(nx, ny);
      if (!vis.has(nk) && isDry(nx, ny)) { vis.add(nk); q.push(nk); }
    }
  }
  return vis;
}

function canPlaceBuilding(x0: number, y0: number, w: number, h: number, existing: GlobalBuilding[], dryReach?: Set<number>): boolean {
  for (const b of existing) {
    if (x0 < b.x + b.w + 2 && x0 + w + 2 > b.x && y0 < b.y + b.h + 2 && y0 + h + 2 > b.y) return false;
  }
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (!isDry(x, y)) return false;
      if (dryReach && dryReach.size > 0 && !dryReach.has(gKey(x, y))) return false;
    }
  }
  return true;
}

/** Paint a rectangular plaza / porch / yard apron on dry tiles without overwriting existing buildings. */
function paintApron(layout: GlobalPoiLayout, x0: number, y0: number, w: number, h: number, tileType: number, stone = false) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (!isDry(x, y)) continue;
      const k = gKey(x, y);
      const cur = layout.tiles.get(k);
      if (cur === T.PWALL || cur === T.FLOOR) continue;
      layout.tiles.set(k, tileType);
      if (stone) layout.stoneTiles.add(k);
    }
  }
}

/** Place a dressed-stone pier/pylon (2x2 or 1x1) on dry land without overwriting roads/floors. */
function stampPylon(layout: GlobalPoiLayout, x0: number, y0: number, w: number, h: number, stone = true) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (!isDry(x, y)) continue;
      const k = gKey(x, y);
      if (layout.tiles.get(k) === T.FLOOR) continue;
      layout.tiles.set(k, T.PWALL);
      if (stone) layout.stoneTiles.add(k);
    }
  }
}

function stampBuilding(
  layout: GlobalPoiLayout,
  id: string,
  name: string,
  cx: number,
  cy: number,
  targetW: number,
  targetH: number,
  roof: GlobalBuilding['roof'],
  material: 'wood' | 'stone',
  faceTarget: [number, number],
  dryReach?: Set<number>,
  porchSpec?: { side: 'south' | 'north' | 'west' | 'east'; tileType: number; stone?: boolean },
): GlobalBuilding | null {
  let w = Math.max(5, Math.min(15, targetW));
  let h = Math.max(5, Math.min(12, targetH));
  let x0 = Math.round(cx - w / 2);
  let y0 = Math.round(cy - h / 2);

  let placed = false;
  for (let shrink = 0; shrink <= 4 && !placed; shrink++) {
    const cw = Math.max(5, w - shrink);
    const ch = Math.max(5, h - shrink);
    for (const [ox, oy] of [[0, 0], [0, -2], [0, 2], [-2, 0], [2, 0], [-3, -3], [3, 3], [0, -4], [0, 4]]) {
      const tx0 = Math.round(cx - cw / 2) + ox;
      const ty0 = Math.round(cy - ch / 2) + oy;
      if (canPlaceBuilding(tx0, ty0, cw, ch, layout.buildings, dryReach)) {
        x0 = tx0; y0 = ty0; w = cw; h = ch; placed = true; break;
      }
    }
  }
  if (!placed) return null;

  const candidates: { tx: number; ty: number; dx: number; dy: number; side: 'south' | 'north' | 'east' | 'west' }[] = [
    { tx: x0 + (w >> 1), ty: y0 + h - 1, dx: 0, dy: 1, side: 'south' },
    { tx: x0 + (w >> 1), ty: y0, dx: 0, dy: -1, side: 'north' },
    { tx: x0 + w - 1, ty: y0 + (h >> 1), dx: 1, dy: 0, side: 'east' },
    { tx: x0, ty: y0 + (h >> 1), dx: -1, dy: 0, side: 'west' },
  ];
  candidates.sort((a, b) =>
    Math.hypot(a.tx + a.dx - faceTarget[0], a.ty + a.dy - faceTarget[1]) -
    Math.hypot(b.tx + b.dx - faceTarget[0], b.ty + b.dy - faceTarget[1]),
  );
  const door = candidates.find(d => isDry(d.tx + d.dx, d.ty + d.dy) && isDry(d.tx - d.dx, d.ty - d.dy) && (!dryReach || !dryReach.size || dryReach.has(gKey(d.tx + d.dx, d.ty + d.dy)))) || candidates[0];

  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      const k = gKey(x, y);
      layout.tiles.set(k, edge ? T.PWALL : T.FLOOR);
      if (material === 'stone') layout.stoneTiles.add(k);
    }
  }
  layout.doors.push({ tx: door.tx, ty: door.ty, poi: layout.id, label: `${name} Door` });

  // Optional attached porch / veranda / loading apron
  if (porchSpec) {
    if (porchSpec.side === 'south') paintApron(layout, x0 + 1, y0 + h, w - 2, 2, porchSpec.tileType, porchSpec.stone);
    else if (porchSpec.side === 'north') paintApron(layout, x0 + 1, y0 - 2, w - 2, 2, porchSpec.tileType, porchSpec.stone);
    else if (porchSpec.side === 'west') paintApron(layout, x0 - 2, y0 + 1, 2, h - 2, porchSpec.tileType, porchSpec.stone);
    else if (porchSpec.side === 'east') paintApron(layout, x0 + w, y0 + 1, 2, h - 2, porchSpec.tileType, porchSpec.stone);
  }

  for (let step = 1; step <= 2; step++) {
    const ax = door.tx + door.dx * step, ay = door.ty + door.dy * step;
    if (isDry(ax, ay) && !layout.tiles.has(gKey(ax, ay))) {
      layout.tiles.set(gKey(ax, ay), T.ROAD);
      if (material === 'stone') layout.stoneTiles.add(gKey(ax, ay));
    }
  }

  const b: GlobalBuilding = { id, name, x: x0, y: y0, w, h, roof, material, doorTx: door.tx, doorTy: door.ty };
  layout.buildings.push(b);
  return b;
}

function pavePath(layout: GlobalPoiLayout, ax: number, ay: number, bx: number, by: number, stone = false) {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(ax + (bx - ax) * t);
    const cy = Math.round(ay + (by - ay) * t);
    for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy;
      if (!isDry(x, y)) continue;
      const k = gKey(x, y);
      if (!layout.tiles.has(k)) {
        layout.tiles.set(k, T.ROAD);
        if (stone) layout.stoneTiles.add(k);
      }
    }
  }
}

function paveWalkablePath(layout: GlobalPoiLayout, sx: number, sy: number, gx: number, gy: number, minX: number, minY: number, maxX: number, maxY: number, stone = false) {
  if (!isDry(sx, sy) || !isDry(gx, gy)) { pavePath(layout, sx, sy, gx, gy, stone); return; }
  const start = gKey(sx, sy), goal = gKey(gx, gy);
  const prev = new Map<number, number>();
  const q: number[] = [start];
  prev.set(start, -1);
  let found = false;
  for (let head = 0; head < q.length && prev.size < 12000; head++) {
    const cur = q[head];
    if (cur === goal) { found = true; break; }
    const x = cur % FRAME_W, y = (cur / FRAME_W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const nk = gKey(nx, ny);
      if (prev.has(nk)) continue;
      const ov = layout.tiles.get(nk);
      if (ov === T.PWALL || ov === T.SHALLOW) continue;
      if (!isDry(nx, ny)) continue;
      prev.set(nk, cur);
      q.push(nk);
    }
  }
  if (!found) { pavePath(layout, sx, sy, gx, gy, stone); return; }
  for (let cur = goal; cur !== -1; cur = prev.get(cur) ?? -1) {
    const x = cur % FRAME_W, y = (cur / FRAME_W) | 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy, nk = gKey(nx, ny);
      if (isDry(nx, ny) && !layout.tiles.has(nk)) {
        layout.tiles.set(nk, T.ROAD);
        if (stone) layout.stoneTiles.add(nk);
      }
    }
  }
}

/** Bespoke architectural composition for flagship POIs (Greywater Hamlet, Argus Academy, Ironholm Mine). */
function buildFlagshipPoi(layout: GlobalPoiLayout, gp: GoldPoi, arch: PoiArchSpec, dryReach: Set<number>, bounds: [number, number, number, number]): boolean {
  const [minTx, minTy, maxTx, maxTy] = bounds;

  if (gp.id === 'po_greywater') {
    // 1. GREYWATER HAMLET — Lakeside fishing & cart village around a cobbled Market Square & North Lakefront Lane
    const sqX = 1618, sqY = 1180;
    // Central cobbled Market Square + stone well apron
    paintApron(layout, sqX, sqY, 11, 8, T.ROAD, true);
    paintApron(layout, sqX + 3, sqY + 2, 4, 4, T.FLOOR, true);
    layout.landmarks.push(
      { tx: sqX + 5, ty: sqY + 4, kind: 'well' },
      { tx: sqX + 1, ty: sqY + 1, kind: 'lantern' },
      { tx: sqX + 9, ty: sqY + 6, kind: 'lantern' },
      { tx: sqX + 2, ty: sqY + 6, kind: 'bench' },
      { tx: 1632, ty: 1157, kind: 'lantern' },
      { tx: 1636, ty: 1157, kind: 'lantern' },
    );

    // 6 distinct village cottages, commons, workshops & storehouses with varied proportions & porches
    const specs: { cx: number; cy: number; w: number; h: number; roof: GlobalBuilding['roof']; mat: 'wood' | 'stone'; face: [number, number]; porch?: { side: 'south' | 'north' | 'west' | 'east'; tileType: number; stone?: boolean } }[] = [
      // 1. Lakeside Net & Boat Cottage (NW) — thatch cottage with south timber veranda overlooking the street
      { cx: 1603, cy: 1162, w: 11, h: 9, roof: 'thatch', mat: 'wood', face: [1614, 1175], porch: { side: 'south', tileType: T.FLOOR } },
      // 2. Greywater Gatehouse & Parish Commons (North) — red tile hall with stone portico flanking the north road
      { cx: 1627, cy: 1168, w: 12, h: 9, roof: 'tile', mat: 'stone', face: [1624, 1182], porch: { side: 'south', tileType: T.FLOOR, stone: true } },
      // 3. East Salt & Timber Barn (NE) — weathered tin barn with west loading deck
      { cx: 1653, cy: 1178, w: 10, h: 9, roof: 'tin', mat: 'wood', face: [1636, 1182], porch: { side: 'west', tileType: T.FLOOR } },
      // 4. Cartwright & Smithy Workshop (SW) — wood-shake workshop with open-air stone forge yard
      { cx: 1595, cy: 1188, w: 10, h: 9, roof: 'wood', mat: 'wood', face: [1606, 1184], porch: { side: 'east', tileType: T.ROAD, stone: true } },
      // 5. Hamlet Elder's Hearth House (South-Central) — flagship 13x9 thatch house with broad north veranda onto the square
      { cx: 1619, cy: 1197, w: 13, h: 9, roof: 'thatch', mat: 'wood', face: [1622, 1184], porch: { side: 'north', tileType: T.FLOOR } },
      // 6. South Granary & Drying Loft (SE) — compact tile storehouse with stone threshing pad
      { cx: 1645, cy: 1204, w: 9, h: 8, roof: 'tile', mat: 'wood', face: [1632, 1192], porch: { side: 'north', tileType: T.ROAD, stone: true } },
    ];

    specs.forEach((sp, idx) => {
      stampBuilding(
        layout,
        `b_po_greywater_${idx + 1}`,
        buildingLabel(gp.name, gp.arche, idx, specs.length),
        sp.cx, sp.cy, sp.w, sp.h, sp.roof, sp.mat, sp.face, dryReach, sp.porch,
      );
    });

    // Forge anvil prop in the Cartwright yard
    layout.landmarks.push({ tx: 1601, ty: 1188, kind: 'forge' });

    // Street network: wide 4-tile North Lakefront Avenue (from square through north gate 1634,1157) + SW/SE avenues
    paintApron(layout, 1633, 1146, 4, 38, T.ROAD, false);
    paveWalkablePath(layout, 1623, 1182, 1634, 1157, minTx - 4, minTy - 4, maxTx + 4, maxTy + 4, true);
    paveWalkablePath(layout, 1634, 1157, 1634, 1150, minTx - 4, minTy - 4, maxTx + 4, maxTy + 4, false);
    paveWalkablePath(layout, 1620, 1184, 1584, 1188, minTx - 4, minTy - 4, maxTx + 4, maxTy + 4, false);
    for (const b of layout.buildings) {
      paveWalkablePath(layout, b.doorTx, b.doorTy, 1622, 1183, minTx - 4, minTy - 4, maxTx + 4, maxTy + 4, true);
    }
    return true;
  }

  if (gp.id === 'po_academy') {
    // 2. ARGUS ACADEMY — Symmetrical Highland Stone Collegiate Quadrangle with Ceremonial Avenue & Cloisters
    const qx = 1865, qy = 517;
    // Central Astrolabe Quadrangle + Ceremonial North-South Avenue
    paintApron(layout, qx, qy, 14, 15, T.ROAD, true);
    paintApron(layout, qx + 4, qy + 4, 6, 7, T.FLOOR, true);
    paintApron(layout, 1870, 495, 4, 58, T.ROAD, true);

    // Twin dressed-stone South Gatehouse Pylons & North Ridge Pylons framing the open 5-tile avenue
    stampPylon(layout, 1867, 549, 2, 2, true);
    stampPylon(layout, 1875, 549, 2, 2, true);
    stampPylon(layout, 1867, 498, 2, 2, true);
    stampPylon(layout, 1875, 498, 2, 2, true);

    layout.landmarks.push(
      { tx: 1872, ty: 524, kind: 'sundial' },
      { tx: 1869, ty: 548, kind: 'lantern' },
      { tx: 1874, ty: 548, kind: 'lantern' },
      { tx: 1868, ty: 520, kind: 'bench' },
      { tx: 1875, ty: 528, kind: 'bench' },
    );

    const wings: { cx: number; cy: number; w: number; h: number; roof: GlobalBuilding['roof']; porch: 'east' | 'west' }[] = [
      { cx: 1854, cy: 509, w: 13, h: 10, roof: 'tile', porch: 'east' },
      { cx: 1891, cy: 511, w: 13, h: 11, roof: 'tin',  porch: 'west' },
      { cx: 1853, cy: 536, w: 12, h: 10, roof: 'tile', porch: 'east' },
      { cx: 1890, cy: 538, w: 12, h: 10, roof: 'tin',  porch: 'west' },
    ];
    wings.forEach((wg, idx) => {
      stampBuilding(
        layout,
        `b_po_academy_${idx + 1}`,
        buildingLabel(gp.name, gp.arche, idx, wings.length),
        wg.cx, wg.cy, wg.w, wg.h, wg.roof, 'stone', [1872, 524], dryReach,
        { side: wg.porch, tileType: T.FLOOR, stone: true },
      );
    });

    for (const b of layout.buildings) {
      paveWalkablePath(layout, b.doorTx, b.doorTy, 1872, 524, minTx - 4, minTy - 4, maxTx + 4, maxTy + 4, true);
    }
    return true;
  }

  if (gp.id === 'po_ironmine') {
    // 3. IRONHOLM MINE — Riverbank Stone Quay, Open-Air Ore Sluice Yard & Dual-Building Freight Complex
    // West Riverbank Quay & Open-Air Ore Yard (honors WMP-03 room 1.1 uncovered open-air material handling)
    paintApron(layout, 2350, 2566, 16, 22, T.ROAD, true);
    paintApron(layout, 2354, 2569, 8, 8, T.FLOOR, true); // timber/stone ore-sorting deck
    // Dressed-stone river retaining curb along the dry east bank (strictly isDry — never overwrites river tiles!)
    for (let y = 2568; y <= 2588; y++) {
      for (let x = 2346; x <= 2354; x++) {
        if (isDry(x, y) && (isWaterTile(x - 1, y) || isWaterTile(x - 2, y))) {
          const k = gKey(x, y);
          layout.tiles.set(k, T.PWALL);
          layout.stoneTiles.add(k);
          break;
        }
      }
    }
    // Wide East-West Freight Haulage Trunk through the center
    paintApron(layout, 2350, 2578, 52, 4, T.ROAD, true);

    layout.landmarks.push(
      { tx: 2358, ty: 2573, kind: 'ore_cart' },
      { tx: 2364, ty: 2581, kind: 'ore_cart' },
      { tx: 2382, ty: 2589, kind: 'forge' },
      { tx: 2376, ty: 2577, kind: 'lantern' },
      { tx: 2396, ty: 2577, kind: 'lantern' },
    );

    // North Adit Headhouse & South Foundry Forge straddling the freight trunk
    stampBuilding(
      layout, 'b_po_ironmine_1', buildingLabel(gp.name, gp.arche, 0, 2),
      2388, 2568, 13, 10, 'tin', 'stone', [2388, 2579], dryReach,
      { side: 'south', tileType: T.FLOOR, stone: true },
    );
    stampBuilding(
      layout, 'b_po_ironmine_2', buildingLabel(gp.name, gp.arche, 1, 2),
      2390, 2592, 11, 8, 'tin', 'stone', [2390, 2580], dryReach,
      { side: 'west', tileType: T.ROAD, stone: true },
    );

    for (const b of layout.buildings) {
      paveWalkablePath(layout, b.doorTx, b.doorTy, 2372, 2579, minTx - 4, minTy - 4, maxTx + 4, maxTy + 4, true);
    }
    return true;
  }

  return false;
}

function buildPoiLayout(gp: GoldPoi, arch: PoiArchSpec): GlobalPoiLayout {
  const footTiles: [number, number][] = (gp.foot && gp.foot.length >= 3)
    ? gp.foot.map(([ax, ay]) => auToTile(ax, ay))
    : [[arch.atTile[0] - 12, arch.atTile[1] - 12], [arch.atTile[0] + 12, arch.atTile[1] - 12], [arch.atTile[0] + 12, arch.atTile[1] + 12], [arch.atTile[0] - 12, arch.atTile[1] + 12]];

  const minTx = Math.max(1, Math.floor(Math.min(...footTiles.map(p => p[0]))) - 4);
  const minTy = Math.max(1, Math.floor(Math.min(...footTiles.map(p => p[1]))) - 4);
  const maxTx = Math.min(FRAME_W - 2, Math.ceil(Math.max(...footTiles.map(p => p[0]))) + 4);
  const maxTy = Math.min(FRAME_H - 2, Math.ceil(Math.max(...footTiles.map(p => p[1]))) + 4);

  const mode: PoiBuildMode = arch.isPilot ? 'PILOT_U05' : arch.hasExt ? 'KIT_ENCLOSED' : 'KIT_OPEN_AIR';
  const material: 'wood' | 'stone' = STONE_ARCHES.has(gp.arche) ? 'stone' : 'wood';
  const conflicts: string[] = [];
  if (!arch.hasExt) conflicts.push('MGP-D04: no authored EXTERIOR_ENTRANCE record (modeled open-air; no fake door invented)');
  if (gp.id === 'po_beacon') conflicts.push('MGP-D07: grounded helicopter reservation outline (no sprite/relocation)');
  if (['po_timberyard', 'po_mill', 'po_rapids'].includes(gp.id)) conflicts.push('MGP-D09: GOLD anchor on/near river channel (water preserved; buildings on dry bank)');

  const layout: GlobalPoiLayout = {
    id: gp.id,
    name: gp.name,
    arche: gp.arche,
    mode,
    atTile: arch.atTile,
    bbox: [minTx, minTy, maxTx, maxTy],
    tiles: new Map(),
    stoneTiles: new Set(),
    buildings: [],
    doors: [],
    landmarks: [],
    conflicts,
    metrics: { floorCells: 0, wallCells: 0, buildingCount: 0, roofCount: 0, roofTiles: 0, doorCount: 0, walkableApproach: false, accessibleInteriors: 0 },
  };

  if (gp.id === 'po_beacon') {
    layout.reservationBox = { x: 541, y: 1301, w: 6, h: 6, label: 'Grounded Helicopter Reservation (MGP-D07)' };
  }

  if (arch.hasExt) {
    let landSeed: [number, number] | null = arch.extTile && isDry(arch.extTile[0], arch.extTile[1]) ? arch.extTile : null;
    if (!landSeed) {
      for (let r = 1; r <= 24 && !landSeed; r++) {
        for (let dy = -r; dy <= r && !landSeed; dy++) for (let dx = -r; dx <= r && !landSeed; dx++) {
          const tx = arch.atTile[0] + dx, ty = arch.atTile[1] + dy;
          if (isDry(tx, ty)) landSeed = [tx, ty];
        }
      }
    }
    const dryReach = landSeed ? connectedDrySet(landSeed, minTx - 6, minTy - 6, maxTx + 6, maxTy + 6) : new Set<number>();

    // Use bespoke hand-authored layout for Greywater Hamlet, Argus Academy, and Ironholm Mine
    const bespokeDone = buildFlagshipPoi(layout, gp, arch, dryReach, [minTx, minTy, maxTx, maxTy]);

    if (!bespokeDone) {
      const faceTarget: [number, number] = arch.extTile && isDry(arch.extTile[0], arch.extTile[1]) ? arch.extTile : (landSeed || arch.atTile);
      let roomsToBuild = arch.rooms;
      if (gp.id === 'po_beacon') roomsToBuild = arch.rooms.slice(0, 1);

      // Courtyard plaza for multi-building compounds
      if (roomsToBuild.length >= 2 && isDry(arch.atTile[0], arch.atTile[1])) {
        paintApron(layout, arch.atTile[0] - 3, arch.atTile[1] - 3, 7, 7, T.ROAD, material === 'stone');
        if (gp.arche === 'village') layout.landmarks.push({ tx: arch.atTile[0], ty: arch.atTile[1], kind: 'well' });
        else if (gp.arche === 'research') layout.landmarks.push({ tx: arch.atTile[0], ty: arch.atTile[1], kind: 'sundial' });
      }

      roomsToBuild.forEach((rm, idx) => {
        let tw = Math.max(6, Math.min(13, Math.round(rm.wTiles * 0.52)));
        let th = Math.max(6, Math.min(11, Math.round(rm.hTiles * 0.44)));
        if (gp.id === 'po_beacon') { tw = 8; th = 8; }
        else if (gp.arche === 'warehouse') { tw = 12; th = 8; }
        else if (gp.arche === 'port') { tw = 11; th = 8; }
        const roof = roofStyleFor(gp.arche, idx, rm.u05Roof);
        const bName = buildingLabel(gp.name, gp.arche, idx, roomsToBuild.length);
        const porch = (gp.arche === 'port' || gp.arche === 'warehouse' || gp.arche === 'sawmill')
          ? { side: 'south' as const, tileType: T.FLOOR, stone: material === 'stone' }
          : undefined;
        stampBuilding(layout, `b_${gp.id}_${idx + 1}`, bName, rm.cx, rm.cy, tw, th, roof, material, faceTarget, dryReach, porch);
      });

      const hubX = isDry(arch.atTile[0], arch.atTile[1]) ? arch.atTile[0] : (layout.buildings[0] ? layout.buildings[0].doorTx : arch.atTile[0]);
      const hubY = isDry(arch.atTile[0], arch.atTile[1]) ? arch.atTile[1] : (layout.buildings[0] ? layout.buildings[0].doorTy + 2 : arch.atTile[1]);
      const entryTarget = (arch.extTile && isDry(arch.extTile[0], arch.extTile[1])) ? arch.extTile : [hubX, hubY];
      for (const b of layout.buildings) {
        paveWalkablePath(layout, b.doorTx, b.doorTy, entryTarget[0], entryTarget[1], minTx - 4, minTy - 4, maxTx + 4, maxTy + 4, material === 'stone');
      }
      if (arch.extTile) {
        paveWalkablePath(layout, hubX, hubY, arch.extTile[0], arch.extTile[1], minTx - 4, minTy - 4, maxTx + 4, maxTy + 4, material === 'stone');
        const dx = Math.sign(arch.extTile[0] - hubX), dy = Math.sign(arch.extTile[1] - hubY);
        pavePath(layout, arch.extTile[0], arch.extTile[1], arch.extTile[0] + dx * 5, arch.extTile[1] + dy * 5, material === 'stone');
      }
    }
  } else {
    // 25 Open-Air / Specialized Sites without EXTERIOR_ENTRANCE (MGP-D04: zero invented doors or roofs)
    const [cx, cy] = arch.atTile;
    switch (gp.arche) {
      case 'elder_site': {
        const rad = gp.id === 'po_typhon' ? 16 : 12;
        for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
          const d = Math.hypot(dx, dy);
          const x = cx + dx, y = cy + dy;
          if (!isDry(x, y)) continue;
          const k = gKey(x, y);
          if (d <= 2.5) { layout.tiles.set(k, T.FLOOR); layout.stoneTiles.add(k); }
          else if (d <= rad - 2) { layout.tiles.set(k, T.ROAD); layout.stoneTiles.add(k); }
        }
        // 8 symmetrical standing stone monolith piers around the ceremonial ring (leaving wide cardinal avenues)
        for (const [mx, my] of [[-8, -8], [8, -8], [-8, 8], [8, 8], [-11, -4], [11, -4], [-11, 4], [11, 4]]) {
          stampPylon(layout, cx + mx, cy + my, 1, 1, true);
        }
        layout.landmarks.push({ tx: cx, ty: cy, kind: 'sundial' });
        break;
      }
      case 'ruins': {
        for (const rm of arch.rooms.slice(0, 4)) {
          const rw = 7, rh = 6, rx0 = rm.cx - 3, ry0 = rm.cy - 3;
          for (let y = ry0; y < ry0 + rh; y++) for (let x = rx0; x < rx0 + rw; x++) {
            if (!isDry(x, y)) continue;
            const k = gKey(x, y);
            const cornerWall = (y === ry0 && x < rx0 + 4) || (x === rx0 && y < ry0 + 4);
            layout.tiles.set(k, cornerWall ? T.PWALL : T.FLOOR);
            layout.stoneTiles.add(k);
          }
        }
        pavePath(layout, cx - 6, cy, cx + 6, cy, true);
        break;
      }
      case 'quarry': {
        for (let dy = -9; dy <= 9; dy++) for (let dx = -11; dx <= 11; dx++) {
          const x = cx + dx, y = cy + dy;
          if (!isDry(x, y)) continue;
          const k = gKey(x, y);
          if (dy <= -7 && Math.abs(dx) <= 9) layout.tiles.set(k, T.PWALL);
          else if (Math.hypot(dx / 1.2, dy) <= 9) layout.tiles.set(k, Math.abs(dx) + Math.abs(dy) < 6 ? T.FLOOR : T.ROAD);
          layout.stoneTiles.add(k);
        }
        layout.landmarks.push({ tx: cx - 3, ty: cy + 2, kind: 'ore_cart' });
        break;
      }
      case 'filter': {
        for (const side of [-5, 5]) {
          for (let dy = -5; dy <= 5; dy++) for (let dx = -4; dx <= 4; dx++) {
            const x = cx + side + dx, y = cy + dy;
            if (!isDry(x, y)) continue;
            const k = gKey(x, y);
            const rim = Math.abs(dx) === 4 || Math.abs(dy) === 5;
            layout.tiles.set(k, rim ? T.PWALL : T.SHALLOW);
            layout.stoneTiles.add(k);
          }
        }
        pavePath(layout, cx, cy - 8, cx, cy + 8, true);
        break;
      }
      case 'pier': {
        paintApron(layout, cx - 6, cy - 5, 13, 11, T.FLOOR, false);
        layout.landmarks.push({ tx: cx - 4, ty: cy - 3, kind: 'bollard' }, { tx: cx + 4, ty: cy - 3, kind: 'bollard' });
        break;
      }
      case 'evac': {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx, y = cy + dy;
          if (!isDry(x, y)) continue;
          const k = gKey(x, y);
          const corner = Math.abs(dx) === 4 && Math.abs(dy) === 4;
          layout.tiles.set(k, corner ? T.PWALL : T.FLOOR);
          layout.stoneTiles.add(k);
        }
        break;
      }
      case 'grove':
      default: {
        paintApron(layout, cx - 2, cy - 2, 5, 5, T.ROAD, true);
        layout.landmarks.push({ tx: cx, ty: cy, kind: 'bench' });
        break;
      }
    }
  }

  let floorCells = 0, wallCells = 0;
  for (const t of layout.tiles.values()) {
    if (t === T.FLOOR) floorCells++;
    else if (t === T.PWALL) wallCells++;
  }
  const roofTiles = layout.buildings.reduce((s, b) => s + b.w * b.h, 0);

  let approachSeed: [number, number] | null = (arch.extTile && isDry(arch.extTile[0], arch.extTile[1]) && layout.tiles.get(gKey(arch.extTile[0], arch.extTile[1])) !== T.PWALL) ? arch.extTile : null;
  for (let y = minTy - 2; y <= maxTy + 2 && !approachSeed; y++) {
    for (let x = minTx - 2; x <= maxTx + 2 && !approachSeed; x++) {
      if (x >= minTx + 2 && x <= maxTx - 2 && y >= minTy + 2 && y <= maxTy - 2) continue;
      const t = layout.tiles.get(gKey(x, y));
      if (t !== T.PWALL && isDry(x, y)) approachSeed = [x, y];
    }
  }
  let accessibleInteriors = 0;
  if (approachSeed) {
    const doorSet = new Set(layout.doors.map(d => gKey(d.tx, d.ty)));
    const visited = new Set<number>();
    const q: number[] = [gKey(approachSeed[0], approachSeed[1])];
    visited.add(q[0]);
    for (let head = 0; head < q.length && visited.size < 16000; head++) {
      const cur = q[head];
      const x = cur % FRAME_W, y = (cur / FRAME_W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < minTx - 4 || nx > maxTx + 4 || ny < minTy - 4 || ny > maxTy + 4) continue;
        const nk = gKey(nx, ny);
        if (visited.has(nk)) continue;
        const ov = layout.tiles.get(nk);
        const pass = doorSet.has(nk) || (ov !== undefined ? (ov !== T.PWALL && ov !== T.SHALLOW) : isDry(nx, ny));
        if (pass) { visited.add(nk); q.push(nk); }
      }
    }
    for (const b of layout.buildings) {
      const midK = gKey(b.x + (b.w >> 1), b.y + (b.h >> 1));
      if (visited.has(midK)) accessibleInteriors++;
    }
  }

  layout.metrics = {
    floorCells,
    wallCells,
    buildingCount: layout.buildings.length,
    roofCount: layout.buildings.length,
    roofTiles,
    doorCount: layout.doors.length,
    walkableApproach: !!approachSeed,
    accessibleInteriors,
  };
  return layout;
}

const CACHE = new Map<string, GlobalPoiLayout>();
export function getPoiLayout(id: string): GlobalPoiLayout {
  let l = CACHE.get(id);
  if (!l) {
    const gp = POIS.find(p => p.id === id);
    const arch = POI_ARCH[id];
    if (!gp || !arch) throw Error(`Unknown canonical POI ${id}`);
    l = buildPoiLayout(gp, arch);
    CACHE.set(id, l);
  }
  return l;
}

export function getAllPoiLayouts(): GlobalPoiLayout[] {
  return POIS.map(p => getPoiLayout(p.id));
}

export function slicePoisForWindow(win: WindowSpec): {
  tileOverrides: Map<number, number>;
  stoneCells: Set<number>;
  buildings: Building[];
  statics: StaticEnt[];
  poiIds: string[];
  landmarks: PoiLandmarkProp[];
  reservations: { x: number; y: number; w: number; h: number; label: string }[];
} {
  const tileOverrides = new Map<number, number>();
  const stoneCells = new Set<number>();
  const buildings: Building[] = [];
  const statics: StaticEnt[] = [];
  const poiIds: string[] = [];
  const landmarks: PoiLandmarkProp[] = [];
  const reservations: { x: number; y: number; w: number; h: number; label: string }[] = [];

  const wx0 = win.originTx, wy0 = win.originTy, wx1 = wx0 + WW, wy1 = wy0 + WH;
  for (const gp of POIS) {
    const [tx, ty] = auToTile(gp.at[0], gp.at[1]);
    if (tx + 55 < wx0 || tx - 55 >= wx1 || ty + 55 < wy0 || ty - 55 >= wy1) continue;
    const l = getPoiLayout(gp.id);
    if (l.bbox[2] < wx0 || l.bbox[0] >= wx1 || l.bbox[3] < wy0 || l.bbox[1] >= wy1) continue;
    poiIds.push(l.id);
    if (AUTHORED_SITES[l.id]) continue; // hand-authored multi-level compound: geometry comes from floors.ts

    for (const [gk, t] of l.tiles) {
      const gx = gk % FRAME_W, gy = (gk / FRAME_W) | 0;
      const lx = gx - wx0, ly = gy - wy0;
      if (lx < 0 || ly < 0 || lx >= WW || ly >= WH) continue;
      const li = ly * WW + lx;
      tileOverrides.set(li, t);
      if (l.stoneTiles.has(gk)) stoneCells.add(li);
    }

    for (const b of l.buildings) {
      const x0 = Math.max(0, b.x - wx0);
      const y0 = Math.max(0, b.y - wy0);
      const x1 = Math.min(WW, b.x + b.w - wx0);
      const y1 = Math.min(WH, b.y + b.h - wy0);
      if (x1 > x0 && y1 > y0) {
        buildings.push({ id: b.id, name: b.name, x: x0, y: y0, w: x1 - x0, h: y1 - y0, roof: b.roof });
      }
    }

    for (const d of l.doors) {
      const lx = d.tx - wx0, ly = d.ty - wy0;
      if (lx >= 1 && ly >= 1 && lx < WW - 1 && ly < WH - 1) {
        statics.push({ kind: 'door', tx: lx, ty: ly, poi: d.poi, label: d.label });
      }
    }

    for (const lm of l.landmarks) {
      const lx = lm.tx - wx0, ly = lm.ty - wy0;
      if (lx >= 0 && ly >= 0 && lx < WW && ly < WH) {
        landmarks.push({ tx: lx, ty: ly, kind: lm.kind });
      }
    }

    if (l.reservationBox) {
      const rx = l.reservationBox.x - wx0, ry = l.reservationBox.y - wy0;
      if (rx + l.reservationBox.w > 0 && ry + l.reservationBox.h > 0 && rx < WW && ry < WH) {
        reservations.push({ x: rx, y: ry, w: l.reservationBox.w, h: l.reservationBox.h, label: l.reservationBox.label });
      }
    }
  }
  return { tileOverrides, stoneCells, buildings, statics, poiIds, landmarks, reservations };
}
