// MAP-LR01 Milestone D — reusable POI spatial authoring system.
// SOURCE-AUTHORED: the 81 canonical foot quads, 18 deep polygons, at/rot/scale,
// arche, gate, links, retreat polylines, access text.
// PROPOSED (never written to canon): walls, rooms, floors, entrances, door
// openings, portals, circulation, sockets, roofs, vertical levels.
// Map exports STATIC layout / portals / sockets. Gameplay owns dynamic door
// states, destruction, construction, devices, locks, power, loot, recipes,
// quests and machines. A socket is WHERE an object CAN fit, not an object.
import { dist, nearestOnLine, ringSignedArea, ringArea, ringCentroid, bbox, pip, r4, segInt } from './veyra.mjs';

export const STATUS = Object.freeze({
  SOURCE: 'SOURCE_AUTHORED', DERIVED: 'DERIVED', PROPOSED: 'PROPOSED',
  UNRESOLVED: 'UNRESOLVED', UNKNOWN: 'UNKNOWN',
});

/** 24 canonical archetypes, each with its OWN spatial template. */
export const ARCHETYPE_TEMPLATES = Object.freeze({
  research: { family: 'enclosed', grid: [2, 2], roof: 1.0, sockets: 6, pattern: 'cells_and_core', note: 'study cells around a core hall' },
  observatory: { family: 'enclosed', grid: [1, 2], roof: 0.85, sockets: 4, pattern: 'tower_base_and_dome', note: 'instrument base + open observation half' },
  facility: { family: 'enclosed', grid: [2, 2], roof: 0.95, sockets: 6, pattern: 'service_corridor', note: 'central corridor with service cells' },
  elder_site: { family: 'open', grid: [1, 1], roof: 0.2, sockets: 8, pattern: 'arena_ring', note: 'open arena ring with radial approach sockets' },
  roadstop: { family: 'mixed', grid: [1, 2], roof: 0.55, sockets: 4, pattern: 'shelter_and_yard', note: 'shelter beside a loading yard' },
  ruins: { family: 'open', grid: [2, 2], roof: 0.15, sockets: 5, pattern: 'broken_cells', note: 'partial walls, broken room cells' },
  quarry: { family: 'open', grid: [1, 1], roof: 0, sockets: 5, pattern: 'terraced_pit', note: 'open pit with terrace levels, no roof' },
  powerplant: { family: 'enclosed', grid: [2, 2], roof: 0.9, sockets: 6, pattern: 'hall_and_bays', note: 'main hall plus machinery-scale bays (NO machines authored)' },
  village: { family: 'mixed', grid: [2, 3], roof: 0.7, sockets: 9, pattern: 'dwelling_cluster', note: 'cluster of small cells with lanes' },
  filter: { family: 'open', grid: [1, 2], roof: 0.35, sockets: 4, pattern: 'basin_pair', note: 'two open basins with a walkway' },
  sawmill: { family: 'mixed', grid: [2, 2], roof: 0.6, sockets: 6, pattern: 'covered_bay_and_yard', note: 'covered work bay opening onto a timber yard' },
  mill: { family: 'enclosed', grid: [2, 2], roof: 0.9, sockets: 5, pattern: 'wheel_bay_and_loft', note: 'ground bay plus loft relationship' },
  smelter: { family: 'enclosed', grid: [2, 2], roof: 0.85, sockets: 6, pattern: 'hot_bay_and_yard', note: 'enclosed hot bay with external yard' },
  hamlet: { family: 'mixed', grid: [2, 2], roof: 0.65, sockets: 7, pattern: 'dwelling_cluster', note: 'small dwelling cells around a shared yard' },
  grove: { family: 'open', grid: [1, 1], roof: 0, sockets: 4, pattern: 'clearing', note: 'unroofed clearing; habitat geometry only' },
  warehouse: { family: 'enclosed', grid: [1, 3], roof: 1.0, sockets: 9, pattern: 'long_aisle', note: 'long roofed aisle with repeated bays' },
  port: { family: 'mixed', grid: [1, 2], roof: 0.3, sockets: 7, pattern: 'dockside_loading', note: 'dock-side loading strip + shed' },
  mine: { family: 'enclosed', grid: [1, 2], roof: 0.45, sockets: 5, pattern: 'adit_and_vault', note: 'adit mouth plus deep vault' },
  pier: { family: 'open', grid: [1, 1], roof: 0.1, sockets: 4, pattern: 'linear_deck', note: 'linear deck with berth-side sockets' },
  tomb: { family: 'enclosed', grid: [1, 2], roof: 1.0, sockets: 4, pattern: 'antechamber_and_vault', note: 'antechamber -> sealed-depth vault geometry' },
  gate: { family: 'mixed', grid: [1, 1], roof: 0.2, sockets: 3, pattern: 'threshold', note: 'single threshold passage' },
  ragnarok_cache: { family: 'enclosed', grid: [1, 2], roof: 1.0, sockets: 5, pattern: 'antechamber_and_vault', note: 'deep cache vault; NO loot authored' },
  chest_vendor: { family: 'enclosed', grid: [1, 1], roof: 0.8, sockets: 4, pattern: 'counter_cell', note: 'single counter cell; NO vendor/economy authored' },
  evac: { family: 'open', grid: [1, 1], roof: 0.2, sockets: 4, pattern: 'mustering_yard', note: 'open mustering yard with two exits' },
});

const local = (obb, p) => {
  const dx = p[0] - obb.centre[0], dy = p[1] - obb.centre[1];
  return [dx * obb.ux[0] + dy * obb.ux[1], dx * obb.uy[0] + dy * obb.uy[1]];
};
const world = (obb, u, v) => [
  obb.centre[0] + u * obb.ux[0] + v * obb.uy[0],
  obb.centre[1] + u * obb.ux[1] + v * obb.uy[1],
];
const bounds = (ring, obb) => {
  const ls = ring.map(p => local(obb, p));
  return {
    u0: Math.min(...ls.map(l => l[0])), u1: Math.max(...ls.map(l => l[0])),
    v0: Math.min(...ls.map(l => l[1])), v1: Math.max(...ls.map(l => l[1])),
  };
};
const quad = (obb, u0, v0, u1, v1) => [
  world(obb, u0, v0), world(obb, u1, v0), world(obb, u1, v1), world(obb, u0, v1),
].map(p => p.map(r4));

/** Inset a convex ring by d along inward normals (line-line intersection). */
export function insetConvex(ring, d) {
  const ccw = ringSignedArea(ring) > 0;
  const lines = ring.map((p, i) => {
    const q = ring[(i + 1) % ring.length];
    const vx = q[0] - p[0], vy = q[1] - p[1], L = Math.hypot(vx, vy) || 1;
    const nx = ccw ? -vy / L : vy / L, ny = ccw ? vx / L : -vx / L;
    return { p: [p[0] + nx * d, p[1] + ny * d], v: [vx, vy] };
  });
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = lines[(i - 1 + ring.length) % ring.length], b = lines[i];
    const den = a.v[0] * b.v[1] - a.v[1] * b.v[0];
    if (Math.abs(den) < 1e-9) { out.push(b.p.map(r4)); continue; }
    const qp = [b.p[0] - a.p[0], b.p[1] - a.p[1]];
    const t = (qp[0] * b.v[1] - qp[1] * b.v[0]) / den;
    out.push([a.p[0] + t * a.v[0], a.p[1] + t * a.v[1]].map(r4));
  }
  return out;
}

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * Build one POI layout. `geo` = output/poi_geometry.v1.json row.
 * `ctx` = { roads, docks, P, I, toCell } for context/approach derivation.
 */
export function authorPoi(geo, ctx) {
  const { P, I, toCell } = ctx;
  const tpl = ARCHETYPE_TEMPLATES[geo.arche] || ARCHETYPE_TEMPLATES.ruins;
  const footRing = ctx.footRings[geo.id];
  const obb = geo.foot.obb;
  const B = bounds(footRing, obb);
  const wAu = r4(B.u1 - B.u0), hAu = r4(B.v1 - B.v0);
  const footArea = ringArea(footRing);
  // PROPOSED wall thickness, bounded by this POI's own shortest edge (per-POI, NOT global).
  const wallAu = r4(Math.min(2, geo.foot.minEdgeAu * 0.08));
  const enclosed = geo.enclosure.startsWith('ENCLOSED');
  const rows = Math.max(1, Math.min(tpl.grid[0], Math.floor(hAu / 8) || 1));
  const cols = Math.max(1, Math.min(tpl.grid[1], Math.floor(wAu / 8) || 1));

  // ---- static shell ----
  const walls = footRing.map((p, i) => {
    const q = footRing[(i + 1) % footRing.length];
    return {
      id: `wall.${geo.id}.${i + 1}`, parentPoiId: geo.id, kind: 'EXTERIOR',
      aAu: p.map(r4), bAu: q.map(r4), lengthAu: r4(dist(p, q)),
      thicknessAu: wallAu, thicknessStatus: STATUS.PROPOSED,
      sourceRef: `project.pois[] where id=${geo.id} :: foot edge ${i + 1} (geometry SOURCE_AUTHORED, thickness PROPOSED)`,
      status: STATUS.PROPOSED, opaqueSight: true,
      note: 'Map-authors static wall geometry; Gameplay owns dynamic collision/destruction.',
    };
  });

  // ---- rooms from the archetype's OWN grid ----
  const rooms = [], interiorWalls = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const u0 = B.u0 + (B.u1 - B.u0) * c / cols, u1 = B.u0 + (B.u1 - B.u0) * (c + 1) / cols;
    const v0 = B.v0 + (B.v1 - B.v0) * r / rows, v1 = B.v0 + (B.v1 - B.v0) * (r + 1) / rows;
    const outer = quad(obb, u0, v0, u1, v1);
    const inner = insetConvex(outer, wallAu / 2);
    const area = ringArea(inner);
    // Enclosure class (Milestone A) decides whether a room is ENCLOSED; the
    // archetype template still drives a partial CANOPY for open/mixed yards.
    const roofed = tpl.roof >= 0.5 || (tpl.family === 'mixed' && tpl.roof > 0 && (r + c) % 2 === 0);
    rooms.push({
      id: `room.${geo.id}.${r + 1}.${c + 1}`, parentPoiId: geo.id, levelId: `level.${geo.id}.0`,
      row: r + 1, col: c + 1, pattern: tpl.pattern, enclosureClass: geo.enclosure,
      polygonAu: inner, centroidAu: ringCentroid(inner).map(r4),
      areaAu2: r4(area), bboxAu: bbox(inner).map(r4),
      floor: { polygonAu: inner, status: STATUS.PROPOSED, floorLevelId: `floor.${geo.id}.${r + 1}.${c + 1}` },
      roof: { covered: roofed, coverageFractionOfRoom: roofed ? (enclosed ? 1 : 0.5) : 0, canopyOnly: !enclosed, status: STATUS.PROPOSED, note: !enclosed ? 'Partial canopy over an open yard cell; NOT an enclosed room.' : 'Full roof over an enclosed room.' },
      surface: enclosed ? 'ENCLOSURE_INTERIOR' : 'YARD_OR_OPEN_CELL',
      status: STATUS.PROPOSED,
    });
  }
  for (let c = 1; c < cols; c++) {
    const u = B.u0 + (B.u1 - B.u0) * c / cols;
    interiorWalls.push({ id: `wall.${geo.id}.split.v.${c}`, parentPoiId: geo.id, kind: 'INTERIOR_PARTITION', aAu: world(obb, u, B.v0).map(r4), bAu: world(obb, u, B.v1).map(r4), thicknessAu: wallAu, status: STATUS.PROPOSED, opaqueSight: true });
  }
  for (let r = 1; r < rows; r++) {
    const v = B.v0 + (B.v1 - B.v0) * r / rows;
    interiorWalls.push({ id: `wall.${geo.id}.split.h.${r}`, parentPoiId: geo.id, kind: 'INTERIOR_PARTITION', aAu: world(obb, B.u0, v).map(r4), bAu: world(obb, B.u1, v).map(r4), thicknessAu: wallAu, status: STATUS.PROPOSED, opaqueSight: true });
  }

  // ---- approach + entrance (edge nearest an authored road) ----
  const roadDist = P.roads.filter(r => r.kind !== 'ferry').map(r => ({ id: r.id, kind: r.kind, q: nearestOnLine(r.points, geo.at), d: r4(nearestOnLine(r.points, geo.at).d) })).sort((a, b) => a.d - b.d)[0];
  const edgeChoices = footRing.map((p, i) => {
    const q = footRing[(i + 1) % footRing.length], m = mid(p, q);
    const d = P.roads.filter(r => r.kind !== 'ferry').reduce((s, r) => Math.min(s, nearestOnLine(r.points, m).d), Infinity);
    return { i, p, q, m, edgeLengthAu: r4(dist(p, q)), roadDistanceAu: r4(d) };
  });
  let chosen = edgeChoices.slice().sort((a, b) => a.roadDistanceAu - b.roadDistanceAu)[0];
  const isKilns = geo.id === 'po_kilns';
  if (isKilns) chosen = edgeChoices.slice().sort((a, b) => a.m[0] - b.m[0])[0]; // GEO-02 PROPOSED WEST opening
  const openingAu = isKilns ? 3.696 : r4(Math.min(6, chosen.edgeLengthAu * 0.28));
  const entrance = {
    id: `entrance.${geo.id}.1`, parentPoiId: geo.id, kind: 'PRIMARY_ENTRANCE',
    onWallId: `wall.${geo.id}.${chosen.i + 1}`, atAu: chosen.m.map(r4),
    openingAu, openingStatus: isKilns ? 'GEO02_PROPOSED_WEST_OPENING__NON_CANONICAL' : STATUS.PROPOSED,
    sourceRef: isKilns ? 'world_lab/geo02/output/poi_po_kilns.proposed.v1.json :: westOpeningAu=3.696' : `project.pois[] where id=${geo.id} :: no authored entrance; edge ${chosen.i + 1} chosen by nearest road`,
    capacityUpperBoundAu: chosen.edgeLengthAu,
    doorStateOwner: 'GAMEPLAY', lockedState: STATUS.UNKNOWN, powerRequirement: STATUS.UNKNOWN,
    note: 'STATIC opening geometry only. No lock, key, power, quest or device rule is authored.',
  };

  // ---- portals between adjacent rooms + entrance portal ----
  const portals = [];
  const roomAt = (r, c) => rooms.find(x => x.row === r + 1 && x.col === c + 1);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = roomAt(r, c);
    if (c + 1 < cols) {
      const b = roomAt(r, c + 1);
      portals.push({ id: `portal.${geo.id}.h.${r + 1}.${c + 1}`, parentPoiId: geo.id, kind: 'INTERIOR_DOORWAY', fromRoomId: a.id, toRoomId: b.id, atAu: mid(a.centroidAu, b.centroidAu).map(r4), openingAu: 6, status: STATUS.PROPOSED });
    }
    if (r + 1 < rows) {
      const b = roomAt(r + 1, c);
      portals.push({ id: `portal.${geo.id}.v.${r + 1}.${c + 1}`, parentPoiId: geo.id, kind: 'INTERIOR_DOORWAY', fromRoomId: a.id, toRoomId: b.id, atAu: mid(a.centroidAu, b.centroidAu).map(r4), openingAu: 6, status: STATUS.PROPOSED });
    }
  }
  // Fix opening widths to a per-POI bounded value (never exceed own shortest edge).
  for (const p of portals) { p.openingAu = r4(Math.min(6, geo.foot.minEdgeAu * 0.25)); p.openingStatus = STATUS.PROPOSED; p.doorStateOwner = 'GAMEPLAY'; p.lockedState = STATUS.UNKNOWN; p.powerRequirement = STATUS.UNKNOWN; p.note = 'Static portal geometry. Gameplay owns dynamic door state, destruction and devices.'; }
  const entranceRoom = rooms.slice().sort((a, b) => dist(a.centroidAu, entrance.atAu) - dist(b.centroidAu, entrance.atAu))[0];
  portals.unshift({
    id: `portal.${geo.id}.entrance`, parentPoiId: geo.id, kind: 'EXTERIOR_PORTAL',
    fromRoomId: null, toRoomId: entranceRoom.id, atAu: entrance.atAu,
    openingAu, openingStatus: entrance.openingStatus, status: STATUS.PROPOSED,
    doorStateOwner: 'GAMEPLAY', lockedState: STATUS.UNKNOWN, powerRequirement: STATUS.UNKNOWN,
    note: 'Static entrance portal. NO door rule, lock, key or power requirement.',
  });

  // ---- circulation graph (rooms connected by interior portals) ----
  const adj = new Map(rooms.map(r => [r.id, []]));
  for (const p of portals) if (p.fromRoomId && p.toRoomId) { adj.get(p.fromRoomId).push(p.toRoomId); adj.get(p.toRoomId).push(p.fromRoomId); }
  const depth = new Map([[entranceRoom.id, 0]]), q = [entranceRoom.id];
  for (let h = 0; h < q.length; h++) for (const o of adj.get(q[h]) || []) if (!depth.has(o)) { depth.set(o, depth.get(q[h]) + 1); q.push(o); }
  const circulation = {
    entranceRoomId: entranceRoom.id, reachableRooms: depth.size, totalRooms: rooms.length,
    maxDepth: Math.max(...depth.values()),
    depthByRoomId: Object.fromEntries(depth),
    interiorDepthAu: r4(Math.max(...rooms.map(r => dist(entrance.atAu, r.centroidAu)))),
    status: STATUS.DERIVED,
  };
  const authoredRetreat = ctx.retreats[geo.id] || null;
  const retreat = authoredRetreat ? {
    status: 'SOURCE_AUTHORED_WAYPOINTS_PLUS_DERIVED_ANCHOR_PREFIX',
    waypointCount: authoredRetreat.length,
    pathAu: [geo.at, ...authoredRetreat].map(p => p.map(r4)),
    lengthAu: r4([geo.at, ...authoredRetreat].slice(1).reduce((s, p, k) => s + dist([geo.at, ...authoredRetreat][k], p), 0)),
    exitAtAu: authoredRetreat[authoredRetreat.length - 1].map(r4),
    note: 'Canonical retreat is a set of waypoints (often one). The segment from the POI anchor is DERIVED; no full retreat corridor is invented.',
  } : {
    status: STATUS.UNRESOLVED, pathAu: null, lengthAu: null, exitAtAu: null,
    note: 'No authored retreat polyline. An exit is NOT invented; Gameplay may route through static portals.',
  };

  // ---- spatial sockets: WHERE an object can fit, NOT an object ----
  const sockets = [];
  for (let k = 0; k < tpl.sockets; k++) {
    const room = rooms[k % rooms.length];
    const f = 0.25 + 0.5 * ((k * 7) % 3) / 2;
    const u = local(obb, room.centroidAu);
    const off = Math.min(wAu, hAu) * 0.12;
    const at = world(obb, u[0] + (k % 2 ? off : -off), u[1] + (k % 3 ? off : -off)).map(r4);
    sockets.push({
      id: `socket.${geo.id}.${k + 1}`, parentPoiId: geo.id, parentRoomId: room.id,
      levelId: `level.${geo.id}.0`, atAu: at,
      fitEnvelopeAu: { w: r4(Math.min(6, wAu / cols * 0.5)), h: r4(Math.min(6, hAu / rows * 0.5)), height: null },
      heightStatus: STATUS.UNRESOLVED,
      surface: enclosed ? 'INTERIOR_FLOOR_OR_WALL' : 'YARD_OR_DECK',
      kind: tpl.pattern.includes('dock') ? 'DOCKSIDE_FIT' : (enclosed ? 'INTERIOR_FIT' : 'OPEN_YARD_FIT'),
      gameplayObject: null, purpose: 'SPATIAL_FIT_ONLY',
      status: STATUS.PROPOSED,
      note: 'A socket says where something could fit. It does NOT assert a generator, loot chest, lock, vendor, machine, recipe or quest.',
    });
  }

  // ---- deep / vertical level (18 canonical deep polygons) ----
  const levels = [{ id: `level.${geo.id}.0`, parentPoiId: geo.id, index: 0, name: 'GROUND', polygonAu: footRing.map(p => p.map(r4)), areaAu2: r4(footArea), status: [STATUS.SOURCE, STATUS.DERIVED] }];
  let deepRooms = [];
  if (geo.deep?.obb) {
    const deepRing = ctx.deepRings[geo.id];
    if (deepRing) {
      const db = bounds(deepRing, geo.deep.obb);
      const dr = insetConvex(deepRing, wallAu);
      deepRooms = [{
        id: `room.${geo.id}.deep.1`, parentPoiId: geo.id, levelId: `level.${geo.id}.-1`,
        row: 1, col: 1, pattern: 'DEEP_VAULT', enclosureClass: 'ENCLOSED_MULTI_LAYER',
        polygonAu: dr, centroidAu: ringCentroid(dr).map(r4), areaAu2: r4(ringArea(dr)),
        bboxAu: bbox(dr).map(r4),
        floor: { polygonAu: dr, status: STATUS.PROPOSED, floorLevelId: `floor.${geo.id}.deep.1` },
        roof: { covered: true, coverageFractionOfRoom: 1, status: STATUS.PROPOSED },
        surface: 'DEEP_INTERIOR', status: STATUS.PROPOSED,
      }];
      levels.push({ id: `level.${geo.id}.-1`, parentPoiId: geo.id, index: -1, name: 'DEEP', polygonAu: deepRing.map(p => p.map(r4)), areaAu2: geo.deep.areaAu2, status: [STATUS.SOURCE, STATUS.DERIVED] });
      portals.push({
        id: `portal.${geo.id}.vertical`, parentPoiId: geo.id, kind: 'VERTICAL_LINK',
        fromRoomId: entranceRoom.id, toRoomId: deepRooms[0].id,
        atAu: geo.deep.centroidAu, verticalSeparationAu: null, verticalSeparationStatus: STATUS.UNRESOLVED,
        status: STATUS.PROPOSED, doorStateOwner: 'GAMEPLAY', lockedState: STATUS.UNKNOWN, powerRequirement: STATUS.UNKNOWN,
        note: 'Canonical deep polygon exists, but NO approved vertical unit / stair / ladder geometry is authored. Vertical separation stays UNKNOWN.',
      });
    }
  }

  // ---- context (region / biome / road / dock / Elder) ----
  const cell = toCell(geo.at[0], geo.at[1]);
  const context = {
    landId: cell >= 0 && I.landId[cell] ? P.land[I.landId[cell] - 1]?.id ?? null : null,
    biomeCode: cell >= 0 ? I.biomeCode[cell] : null,
    zoneId: cell >= 0 && I.zoneId[cell] ? P.zones[I.zoneId[cell] - 1]?.id ?? null : null,
    elderGeometryId: cell >= 0 && I.elderGeometryId[cell] ? P.elders[I.elderGeometryId[cell] - 1]?.id ?? null : null,
    seaDistanceCells: cell >= 0 ? I.seaDistanceCells[cell] : null,
    clearanceCells: cell >= 0 ? I.clearanceCells[cell] : null,
    nearestRoad: roadDist ? { id: roadDist.id, kind: roadDist.kind, distanceAu: roadDist.d } : null,
    nearestDock: P.docks.map(d => ({ id: d.id, d: r4(dist(d.at, geo.at)) })).sort((a, b) => a.d - b.d)[0],
    status: STATUS.DERIVED,
  };
  const modifiers = [];
  if (context.seaDistanceCells !== null && context.seaDistanceCells <= 3) modifiers.push({ id: 'MOD-COAST', effect: 'Adds a dockside/coastal loading envelope to the yard', status: STATUS.DERIVED });
  if (context.elderGeometryId) modifiers.push({ id: 'MOD-ELDER', effect: 'Arena ring radial sockets retained; approach kept source-authored', status: STATUS.DERIVED });
  if (context.nearestRoad?.kind === 'cart') modifiers.push({ id: 'MOD-CART-FRONTAGE', effect: 'Entrance edge chosen toward a cart-road centreline; NO cart clearance claim', status: STATUS.DERIVED });
  if (context.zoneId) modifiers.push({ id: 'MOD-ZONE', effect: 'Layout sits inside a candidate construction zone; occupancy still UNKNOWN', status: STATUS.DERIVED });

  // ---- roof coverage measured over authored polygons ----
  const roofCells = rooms.concat(deepRooms).filter(r => r.roof.covered);
  const roofArea = roofCells.reduce((s, r) => s + ringArea(r.polygonAu) * r.roof.coverageFractionOfRoom, 0);
  const roofCoverage = {
    coveredRoomCount: roofCells.length, totalRoomCount: rooms.length + deepRooms.length,
    roofAreaAu2: r4(roofArea), footAreaAu2: r4(footArea),
    roofAreaToFootAreaRatioAcrossLevels: r4(roofArea / footArea),
    fractionOfFoot: r4(Math.min(1, roofArea / footArea)),
    status: STATUS.DERIVED,
    note: 'Measured over PROPOSED room/canopy polygons weighted by coverageFractionOfRoom. The across-levels ratio can exceed 1 when a DEEP level adds roofed area; it is NOT a single-plane coverage fraction.',
  };

  const allWalls = walls.concat(interiorWalls);
  const enclosedArea = rooms.filter(r => r.surface !== 'YARD_OR_OPEN_CELL').reduce((s, r) => s + r.areaAu2, 0) + deepRooms.reduce((s, r) => s + r.areaAu2, 0);

  // ---- six geometry adapters toward the shared spatial-kernel TARGET ----
  const geometryAdapters = {
    collision: {
      staticWalls: allWalls.map(w => w.id), staticWallCount: allWalls.length,
      wallThicknessAu: wallAu, thicknessStatus: STATUS.PROPOSED,
      dynamicCollisionOwner: 'GAMEPLAY', destructionOwner: 'GAMEPLAY',
      status: 'PROPOSED_STATIC_COLLISION_GEOMETRY__NOT_RUNTIME_COLLISION_DATA',
    },
    enclosure: {
      enclosedAreaAu2: r4(enclosedArea), footAreaAu2: r4(footArea),
      enclosureFraction: r4(enclosedArea / footArea), enclosureClass: geo.enclosure,
      classificationStatus: 'DERIVED_HEURISTIC__NOT_CANONICAL',
      status: STATUS.DERIVED,
    },
    reach: {
      maxInteriorDistanceAu: circulation.interiorDepthAu,
      nearestRoadAu: context.nearestRoad?.distanceAu ?? null,
      approachLengthAu: r4(dist(entrance.atAu, roadDist?.q?.pt ?? entrance.atAu)),
      minPortalOpeningAu: r4(Math.min(...portals.map(p => p.openingAu))),
      status: STATUS.DERIVED, note: 'Geometric reach only. Interaction radius / Gameplay reach rules are NOT asserted.',
    },
    lineOfSight: {
      opaqueWallIds: allWalls.filter(w => w.opaqueSight).map(w => w.id),
      transparentPortalIds: portals.map(p => p.id),
      portalSightOwner: 'GAMEPLAY', status: STATUS.PROPOSED,
      note: 'Static opaque walls + portal gaps. Dynamic door opacity is Gameplay-owned.',
    },
    roofCoverage,
    portalPassability: {
      portals: portals.map(p => ({ id: p.id, openingAu: p.openingAu, kind: p.kind })),
      passabilityRuleOwner: 'GAMEPLAY',
      status: 'UNKNOWN__DYNAMIC_DOOR_STATE_DESTRUCTION_AND_DEVICES_OWNED_BY_GAMEPLAY',
      note: 'Map asserts only that a geometric opening exists. No lock, power, key, weight or vehicle rule.',
    },
  };

  return {
    schema: 'soh.map.lr01.poi_layout.v1',
    poiId: geo.id, name: geo.name, arche: geo.arche, atAu: geo.at, rot: geo.rot, scale: geo.scale,
    sourceRef: `project.pois[] where id=${geo.id}`,
    status: 'PROPOSED_INTERIOR_AND_CIRCULATION__CANONICAL_FOOTPRINT_ONLY',
    ownership: 'MAP owns static layout / portals / sockets; GAMEPLAY owns dynamic door states, destruction, construction, devices, locks, power, loot, recipes, quests and machines.',
    enclosureClass: geo.enclosure, enclosureClassificationStatus: geo.classificationStatus,
    canonical: { footPolygonAu: footRing.map(p => p.map(r4)), footAreaAu2: r4(footArea), minEdgeAu: geo.foot.minEdgeAu, deepPolygonAu: ctx.deepRings[geo.id]?.map(p => p.map(r4)) ?? null, gate: geo.gate, links: geo.links, accessText: geo.accessText, conf: geo.conf },
    template: { archetype: geo.arche, ...tpl, instantiatedRows: rows, instantiatedCols: cols, family: tpl.family },
    context, contextModifiers: modifiers,
    levels,
    footprint: { obb, widthAu: wAu, heightAu: hAu, wallThicknessAu: wallAu, wallThicknessStatus: STATUS.PROPOSED },
    walls: allWalls, rooms: rooms.concat(deepRooms), floors: rooms.concat(deepRooms).map(r => r.floor),
    entrance, portals, circulation, retreat, sockets, roofCoverage,
    geometryAdapters,
    stableIds: {
      rooms: rooms.concat(deepRooms).map(r => r.id), walls: allWalls.map(w => w.id),
      entrances: [entrance.id], portals: portals.map(p => p.id), sockets: sockets.map(s => s.id),
      levels: levels.map(l => l.id), floors: rooms.concat(deepRooms).map(r => r.floor.floorLevelId),
    },
    noClaims: [
      'NO loot, loot table, chest contents or reward', 'NO locked-door rule, key, card or power requirement',
      'NO generator, machine, recipe, quest, vendor inventory or economy', 'NO dynamic door state or destruction',
      'NO authored entrance in source (all openings PROPOSED)', 'NO approved vertical unit or stair geometry',
      'NO runtime collision data (static geometry only)', 'NO playable survival acceptance',
    ],
  };
}
