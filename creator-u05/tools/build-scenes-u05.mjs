/**
 * U05 SIX DEEP PHYSICAL SCENE DESIGNS — generated at true U=0.5.
 *
 * All geometry comes from GOLD poi.foot + WMP-03 architecture.v1.json
 * (PROPOSED physical composition). Nothing is reauthored: polygons are
 * reprojected by 1 AU -> 2 runtime tiles. Additional grounds / circulation /
 * utility yards are PROPOSED rectangles expressed in the SOURCE OBB frame and
 * always kept INSIDE the existing site envelope. No random props, no new
 * islands, no boat/boss/loot/cargo/cash law, no helicopter relocation.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const U05 = path.join(ROOT, 'creator-u05');
const WM = path.join(ROOT, 'veyra-world-master');
const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const U = 0.5, TILE = 16;
const G = json(path.join(WM, 'data/canon/VEYRA_GOLD_MAP.sohmap.json')).project;
const ARCH = json(path.join(WM, 'layers/architecture.v1.json'));
const MP = json(path.join(U05, 'map-data/U05_POI_MASTERPLAN.v1.json'));
const MP_BY_ID = new Map(MP.pois.map((p) => [p.id, p]));
const ARCH_BY_ID = new Map(ARCH.pois.map((p) => [p.poiId, p]));
const r4 = (n) => Math.round(n * 10000) / 10000;
const toTiles = (poly) => poly.map(([x, y]) => [r4(x / U), r4(y / U)]);
const bbox = (p) => [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))];

function inside(pt, poly) {
  let c = false; const [x, y] = pt, n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function closestOnSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return [a[0] + t * dx, a[1] + t * dy];
}
const onLand = (p) => G.land.some((l) => l.rings.some((r) => inside(p, r)));
/** Road segment that carries the POI centre (schematic connector), and the
 *  outward point on that SAME unchanged centreline used as the approach start. */
function roadApproach(at, foot) {
  let best = null;
  for (const r of G.roads) for (let i = 0; i < r.points.length - 1; i++) {
    const a = r.points[i], b = r.points[i + 1], q = closestOnSeg(at, a, b);
    const d = Math.hypot(at[0] - q[0], at[1] - q[1]);
    if (!best || d < best.d) best = { d, roadId: r.id, a, b, q };
  }
  const dx = best.b[0] - best.a[0], dy = best.b[1] - best.a[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  const candidates = [[1, 24], [-1, 24], [1, 32], [-1, 32], [0, 0]];
  let start = null;
  for (const [s, dist] of candidates) {
    const p = s === 0 ? best.q.slice() : [best.q[0] + s * ux * dist, best.q[1] + s * uy * dist];
    if (onLand(p) && !inside(p, foot)) { start = p; break; }
  }
  if (!start) start = [best.q[0] + ux * 24, best.q[1] + uy * 24];
  return { roadId: best.roadId, roadSegmentAu: [best.a, best.b], schematicCentrePointAu: best.q.map(r4), startAu: start.map(r4), startTile: start.map((v) => Math.floor(v / U)), centrelineChanged: false };
}

/** OBB-local rectangle -> authored AU polygon -> U=0.5 tile polygon.
 *  u,v are NORMALISED [-0.5,0.5] inside the SOURCE envelope. */
function obbRect(obb, u0, v0, u1, v1) {
  const { centre, ux, uy, wAu, hAu } = obb;
  const P = (u, v) => [centre[0] + ux[0] * u * wAu + uy[0] * v * hAu, centre[1] + ux[1] * u * wAu + uy[1] * v * hAu];
  return [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
}
function areaPoly(p) { return Math.abs(p.reduce((a, q, i) => { const n = p[(i + 1) % p.length]; return a + q[0] * n[1] - n[0] * q[1]; }, 0) / 2); }

// ---------------------------------------------------------------- programmes -
const PROGRAMMES = {
  po_beacon: {
    intent: 'Preserve the Creator-liked Beacon road, shoreline and arrival. Lighthouse site plus a grounded helicopter/helipad collision-plan conflict at AU [272,652]. Open rock yard, minimal necessary objects.',
    art: { wall: 'wall_stone', roof: 'roof_tile', floor: 'floor_stone', door: 'poi_door', doorOpen: 'poi_door_open' },
    states: { exterior: 'ARRIVAL_APRON_AND_ROAD_FREE', interior: 'TWO_TOWER_ROOMS_WITH_THRESHOLDS', inaccessible: 'DEEP_NONE' },
    areas: [
      { id: 'shore_arrival_apron', kind: 'OPEN_SPACE', role: 'shoreline arrival, no new props', rect: [-0.49, 0.18, -0.10, 0.49], art: 'none' },
      { id: 'preserved_road_frontage', kind: 'CIRCULATION', role: 'GOLD rd_27 centreline — UNCHANGED, no widening/recolour/redraw', rect: [-0.49, -0.49, 0.49, -0.34], art: 'none', sourceAuthored: true },
      { id: 'open_rock_yard', kind: 'OPEN_SPACE', role: 'spacious open rock; deliberately empty', rect: [0.12, -0.30, 0.49, 0.30], art: 'none' },
      { id: 'lighthouse_court', kind: 'CIRCULATION', role: 'short approach to the tower threshold', rect: [-0.10, 0.00, 0.12, 0.18], art: 'floor_stone' }
    ],
    markers: [
      { id: 'poi_beacon_engine_out_helicopter', kind: 'PROVEN_MISSING', atAu: [272, 652], atTile: [544, 1304], reason: 'Ground-stationary helicopter landmark has NO sprite/entity in verified live Gameplay; no car-wreck or ship-hull substitute; NOT relocated' },
      { id: 'lighthouse_vs_helicopter_conflict', kind: 'GEOMETRY_CONFLICT', status: 'UNRESOLVED', owner: 'CREATOR / GAMEPLAY A8' }
    ],
    sightlines: ['road -> lighthouse threshold', 'helipad reservation -> open rock yard'],
    placeholders: [], subScenes: [], terrainConstraints: { shoreline: 'GOLD coast preserved', cliff: 'candidate only', seaLandWalk: false, boatGameplay: false }
  },
  po_greywater: {
    intent: 'Multiple meaningful dwellings with independent roofs and doors, a real village/road interface, and courtyard movement between separate structures — not one giant rectangular roof.',
    art: { wall: 'wall_wood', roof: 'roof_thatch', floor: 'floor_wood', door: 'poi_door', doorOpen: 'poi_door_open' },
    states: { exterior: 'VILLAGE_ROAD_AND_COURTYARD_FREE', interior: 'SIX_DWELLING_ROOMS_WITH_THRESHOLDS', inaccessible: 'DEEP_NONE' },
    areas: [
      { id: 'road_interface', kind: 'CIRCULATION', role: 'GOLD rd_9 village frontage — UNCHANGED', rect: [-0.49, -0.49, 0.49, -0.40], art: 'none', sourceAuthored: true },
      { id: 'village_courtyard', kind: 'OPEN_SPACE', role: 'shared courtyard between dwellings', rect: [-0.26, -0.10, 0.26, 0.36], art: 'none' },
      { id: 'circulation_spine', kind: 'CIRCULATION', role: 'north-south courtyard movement', rect: [-0.06, -0.40, 0.06, 0.40], art: 'floor_wood' },
      { id: 'retreat_lane', kind: 'NAV_RETREAT', role: 'physical way back to the road', rect: [0.34, -0.40, 0.49, 0.40], art: 'none' }
    ],
    markers: [], sightlines: ['road -> courtyard -> dwelling thresholds'], placeholders: [], subScenes: [],
    terrainConstraints: { shoreline: 'n/a', cliff: 'candidate only', seaLandWalk: false, boatGameplay: false }
  },
  po_academy: {
    intent: 'Believable research compound: safe, useful exterior/lecture perimeter versus a gated interior core. Physical retreat to the road. Named placeholders ONLY — no key item, power, loot or ownership law.',
    art: { wall: 'wall_stone', roof: 'roof_tile', floor: 'floor_stone', door: 'poi_door', doorOpen: 'poi_door_open' },
    states: { exterior: 'SAFE_COMPOUND_GROUNDS_AND_LECTURE_PERIMETER', interior: 'GATED_RESEARCH_CORE__ACCESS_UNRESOLVED', inaccessible: 'DEEP_LEVEL_RESERVATION_ONLY' },
    areas: [
      { id: 'compound_grounds', kind: 'OPEN_SPACE', role: 'coherent grounds between separate wings', rect: [-0.48, -0.30, 0.48, 0.30], art: 'none' },
      { id: 'gate_threshold', kind: 'DOORS_ROOMS', role: 'exterior threshold to the gated core; no lock state created', rect: [-0.10, 0.34, 0.10, 0.49], art: 'floor_stone' },
      { id: 'utility_yard', kind: 'UTILITY_YARD', role: 'service yard with sightline hierarchy', rect: [0.28, -0.48, 0.49, -0.20], art: 'none' },
      { id: 'sightline_axis', kind: 'CIRCULATION', role: 'main compound axis', rect: [-0.05, -0.48, 0.05, 0.48], art: 'floor_stone' },
      { id: 'retreat_path', kind: 'NAV_RETREAT', role: 'gate -> grounds -> road', rect: [-0.49, 0.28, -0.30, 0.49], art: 'none' }
    ],
    markers: [
      { id: 'KEY_CARD_PLACEHOLDER', kind: 'NAMED_PLACEHOLDER', status: 'UNRESOLVED__GAMEPLAY_OWNED', owner: 'GAMEPLAY A8' },
      { id: 'POWER_PLACEHOLDER', kind: 'NAMED_PLACEHOLDER', status: 'UNRESOLVED__GAMEPLAY_OWNED', owner: 'GAMEPLAY A8' }
    ],
    sightlines: ['road -> gate threshold', 'lecture perimeter -> utility yard', 'core roof above side wings'],
    placeholders: ['KEY_CARD_PLACEHOLDER', 'POWER_PLACEHOLDER'], subScenes: [],
    terrainConstraints: { shoreline: 'n/a', cliff: 'candidate only', seaLandWalk: false, boatGameplay: false }
  },
  po_ironmine: {
    intent: 'Exterior material handling, a real adit entrance and a reserved shaft/multi-layer spatial programme. Road/cart clearance stays UNRESOLVED unless approved — no cart law created.',
    art: { wall: 'wall_brick', roof: 'roof_tin', floor: 'floor_stone', door: 'poi_door', doorOpen: 'poi_door_open' },
    states: { exterior: 'MATERIAL_HANDLING_YARD_AND_ROAD_FREE', interior: 'ADIT_HEADHOUSE_WITH_THRESHOLD', inaccessible: 'DEEP_SHAFT_RESERVATION_ONLY' },
    areas: [
      { id: 'ore_stockpile_yard', kind: 'UTILITY_YARD', role: 'exterior material handling; existing barrel/cargo/cart art only', rect: [-0.49, -0.20, -0.12, 0.38], art: 'barrel' },
      { id: 'cart_approach', kind: 'CIRCULATION', role: 'GOLD rd_11 approach — UNCHANGED', rect: [-0.49, -0.49, 0.49, -0.38], art: 'none', sourceAuthored: true },
      { id: 'adit_apron', kind: 'OPEN_SPACE', role: 'threshold apron before the shaft headhouse', rect: [-0.12, 0.10, 0.22, 0.42], art: 'floor_stone' },
      { id: 'shaft_reservation', kind: 'RESERVATION', role: 'multi-layer spatial reservation; NO invented vertical separation value', rect: [0.22, -0.30, 0.49, 0.30], art: 'none' },
      { id: 'cart_clearance', kind: 'UNRESOLVED', role: 'swept cart clearance has no approved number', rect: [-0.12, -0.38, 0.22, -0.20], art: 'none', owner: 'MAP_U05 / GAMEPLAY' }
    ],
    markers: [], sightlines: ['road -> stockpile yard -> adit threshold'], placeholders: [], subScenes: [],
    terrainConstraints: { shoreline: 'n/a', cliff: 'WMP-03 cliff candidate, no gameplay slope law', seaLandWalk: false, boatGameplay: false, cartClearance: 'UNRESOLVED' }
  },
  po_westmouth: {
    intent: 'Preserve the shoreline and GOLD dock, keep a real freight route, and place harbour buildings without fabricated boat gameplay or bogus sea land-walk.',
    art: { wall: 'wall_wood', roof: 'roof_wood', floor: 'floor_wood', door: 'poi_door', doorOpen: 'poi_door_open' },
    states: { exterior: 'HARBOUR_APRON_AND_FREIGHT_ROUTE_FREE', interior: 'DOCKSIDE_CANOPY_AND_FREIGHT_SHED', inaccessible: 'SEA_IS_NOT_LAND_WALKABLE' },
    areas: [
      { id: 'harbour_apron', kind: 'OPEN_SPACE', role: 'open apron between shed, canopy and dock', rect: [-0.30, -0.20, 0.30, 0.30], art: 'none' },
      { id: 'freight_route', kind: 'CIRCULATION', role: 'road -> apron -> preserved dock; no cargo approval', rect: [-0.49, 0.28, 0.49, 0.49], art: 'floor_wood' },
      { id: 'shoreline_preserved', kind: 'SOURCE_AUTHORED', role: 'GOLD coast unchanged; no sea land-walk', rect: [-0.49, -0.49, 0.49, -0.38], art: 'none', sourceAuthored: true },
      { id: 'sea_boundary', kind: 'UNRESOLVED', role: 'footPassableOnSea=false; boat/swim permission UNRESOLVED_GAMEPLAY', rect: [-0.49, 0.42, -0.30, 0.49], art: 'none', owner: 'GAMEPLAY / CREATOR' }
    ],
    markers: [{ id: 'dk_westmouth', kind: 'PRESERVED_DOCK', atAu: G.docks.find((d) => d.id === 'dk_westmouth').at, sourceAuthored: true }],
    sightlines: ['road -> apron -> dock'], placeholders: [], subScenes: [],
    terrainConstraints: { shoreline: 'GOLD coast preserved', cliff: 'candidate only', seaLandWalk: false, boatGameplay: false, cargoPermission: false }
  },
  po_typhon: {
    intent: 'Grand multi-scene Elder territory with terrain/slope constraints and explicit ingress/egress. Open arena ring, reserved deep vault, three physical sub-scenes. NO invented combat rewards, boss state or score.',
    art: { wall: 'wall_stone', roof: 'roof_tin', floor: 'floor_stone', door: 'poi_door', doorOpen: 'poi_door_open' },
    states: { exterior: 'THREE_TERRAIN_APPROACHES_FREE', interior: 'OPEN_ARENA_RING', inaccessible: 'DEEP_VAULT_RESERVATION_ONLY' },
    areas: [
      { id: 'arena_ring', kind: 'OPEN_SPACE', role: 'large open ring; deliberately NOT one huge roof', rect: [-0.44, -0.42, 0.44, 0.42], art: 'floor_stone' },
      { id: 'slope_ingress_north', kind: 'CIRCULATION', role: 'north terrain ingress', rect: [-0.12, -0.49, 0.12, -0.38], art: 'none' },
      { id: 'slope_ingress_south', kind: 'CIRCULATION', role: 'south terrain ingress', rect: [-0.12, 0.38, 0.12, 0.49], art: 'none' },
      { id: 'egress_west', kind: 'NAV_RETREAT', role: 'west egress back to rd_18', rect: [-0.49, -0.10, -0.38, 0.10], art: 'none' },
      { id: 'deep_vault_reservation', kind: 'RESERVATION', role: 'deep polygon reservation; no vertical separation value', rect: [-0.18, -0.16, 0.18, 0.16], art: 'none' },
      { id: 'terrain_scarp', kind: 'TERRAIN_CONSTRAINT', role: 'WMP-03 cliff/slope candidate constrains circulation; no slope law', rect: [0.34, -0.49, 0.49, -0.20], art: 'none' }
    ],
    markers: [
      { id: 'NO_EXTERIOR_ENTRANCE_RECORD', kind: 'UNRESOLVED', status: 'MISSING_EXTERIOR_ENTRANCE_RECORD__NO_DOOR_INVENTED', owner: 'MAP_U05 / GAMEPLAY A8' },
      { id: 'NO_BOSS_OR_REWARD_STATE', kind: 'NO_CLAIM', status: 'NOT_CREATED', owner: 'GAMEPLAY' }
    ],
    sightlines: ['north ingress -> arena centre -> west egress', 'south ingress -> arena centre'],
    placeholders: [],
    subScenes: [
      { id: 'typhon_north_approach', role: 'terrain ingress view', atAu: 'GOLD road rd_18 + north ingress rect' },
      { id: 'typhon_arena_floor', role: 'open arena floor view', atAu: 'OBB centre' },
      { id: 'typhon_deep_threshold', role: 'deep reservation boundary view (no vertical law)', atAu: 'deep polygon centroid' }
    ],
    terrainConstraints: { shoreline: 'n/a', cliff: 'WMP-03 cliff/slope candidate', slope: 'no Gameplay slope law', ingress: ['north', 'south'], egress: ['west'], seaLandWalk: false, boatGameplay: false, bossState: 'NOT_CREATED', rewards: 'NOT_CREATED' }
  }
};

/** PROPOSED physical composition INSIDE the unchanged GOLD envelope.
 *  WMP-03 rooms are full-envelope PROPOSALS, not certified buildings. Fitting
 *  smaller purposeful footprints leaves real open space/courtyards; the source
 *  room polygon and the measured before/after coverage are kept verbatim. */
const COMPOSITION = {
  po_beacon: { inset: 0.45, keepRoomIndexes: [0], floor: 'floor_stone', roofMode: 'full', roofPalette: ['roof_tile'], reason: 'WMP-03 two rooms cover ~82% of the small Beacon envelope; Creator requires open space / minimal necessary objects. One reduced lighthouse tower + open rock yard is PROPOSED.', overrideNote: 'One of two WMP-03 enclosed rooms is left as open rock yard; GOLD poi.foot unchanged.' },
  po_greywater: { inset: 0.56, keepRoomIndexes: [0, 1, 2, 3, 4, 5], floor: 'floor_wood', roofMode: 'full', roofPalette: ['roof_thatch', 'roof_tile', 'roof_tin', 'roof_wood', 'roof_thatch', 'roof_tile'], reason: 'Six separate inset dwellings with a shared courtyard; not one giant roof.', overrideNote: 'WMP-03 marked these six cells canopy-only open yard cells (NOT enclosed rooms). U05 PROPOSES six enclosed dwellings with full roofs to satisfy the requested village physical programme; before/after recorded, GOLD unchanged.' },
  po_academy: { inset: 0.60, keepRoomIndexes: [0, 1, 2, 3], floor: 'floor_stone', roofMode: 'source', roofPalette: ['roof_tile', 'roof_tin', 'roof_tile', 'roof_tin'], reason: 'Four separate compound wings + grounds + utility yard + retreat path.', overrideNote: 'Source enclosed rooms retained, inset only.' },
  po_ironmine: { inset: 0.55, keepRoomIndexes: [0, 1], floor: 'none', roofMode: 'source', roofPalette: ['roof_tin'], reason: 'Ground is OPEN-AIR material handling (WMP-03 covered=false); only the deep vault roof is a reservation. No invented ground roof.', overrideNote: 'Ground floors/roofs are NOT drawn because source rooms are uncovered open yards; the deep vault roof remains a RESERVATION only.' },
  po_westmouth: { inset: 0.56, keepRoomIndexes: [0, 1], floor: 'floor_wood', roofMode: 'full', roofPalette: ['roof_wood', 'roof_tin'], reason: 'Two separate dockside structures with an open harbour apron; no fabricated boat gameplay.', overrideNote: 'Source room 2 was uncovered; U05 PROPOSES a second enclosed freight shed. GOLD unchanged.' },
  po_typhon: { inset: 1.0, keepRoomIndexes: [0], floor: 'none', roofMode: 'source', roofPalette: ['roof_tin'], arenaBoundarySolids: true, reason: 'Arena ring stays OPEN TERRAIN; only the deep vault roof polygon is reserved. No boss/reward state.', overrideNote: 'Arena floor is open terrain; no roof over the ring, no invented boss/reward state.' }
};
function insetPoly(poly, f) {
  if (f >= 1) return poly.map((p) => [...p]);
  const c = [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];
  return poly.map(([x, y]) => [c[0] + (x - c[0]) * f, c[1] + (y - c[1]) * f]);
}

// ---------------------------------------------------------------- build ------
const SCENE_IDS = ['po_beacon', 'po_greywater', 'po_academy', 'po_ironmine', 'po_westmouth', 'po_typhon'];
const scenes = [];
for (const id of SCENE_IDS) {
  const gold = G.pois.find((p) => p.id === id);
  const a = ARCH_BY_ID.get(id);
  const mp = MP_BY_ID.get(id);
  if (!gold || !a || !mp) throw Error('U05_SCENE_SOURCE_MISSING ' + id);
  const prog = PROGRAMMES[id];
  const footAu = gold.foot, footTiles = toTiles(footAu);
  const bbTiles = bbox(footTiles).map(r4);
  const obb = a.footAu.obb;
  const road = roadApproach(gold.at, footAu);
  const ext = a.staticOpenings.filter((o) => o.kind === 'EXTERIOR_ENTRANCE');
  const goalAu = ext.length ? ext[0].centreAu : a.levels[0].polygonAu.reduce((acc, q) => [acc[0] + q[0] / 4, acc[1] + q[1] / 4], [0, 0]);
  const goalTile = goalAu.map((v) => Math.floor(v / U));
  const groundRooms = a.rooms.filter((r) => r.levelId.endsWith('.0'));
  const deepRooms = a.rooms.filter((r) => r.levelId.endsWith('.-1'));
  const camAu = [272, 652];
  const anchorAu = id === 'po_beacon' ? camAu : gold.at;
  const areas = prog.areas.map((ar) => {
    const polyAu = obbRect(obb, ...ar.rect);
    return {
      id: ar.id, kind: ar.kind, role: ar.role, status: ar.sourceAuthored ? 'source-authored' : 'proposed',
      obbRectNormalised: ar.rect, polygonAu: polyAu.map((q) => q.map(r4)), polygonTiles: toTiles(polyAu),
      bboxTiles: bbox(toTiles(polyAu)).map(r4), areaAu2: r4(areaPoly(polyAu)), areaTile2: r4(areaPoly(polyAu) * 4),
      art: ar.art || 'none', insideExistingEnvelope: true, owner: ar.owner || 'MAP_U05'
    };
  });
  const comp = COMPOSITION[id];
  const keptRooms = groundRooms.filter((_, i) => comp.keepRoomIndexes.includes(i));
  const keptRoomIds = new Set(keptRooms.map((r) => r.id));
  // WMP-03 authored Typhon as an OPEN-AIR arena with ZERO static solids and
  // ZERO static openings. U05 PROPOSES a perimeter barrier (with one real
  // entrance gap) so SOLID_COLLISION is a separate, provable layer in this
  // scene too. This is a PROPOSED physical composition, NOT GOLD canon, NOT a
  // gameplay law, NOT a boss/reward/loot state.
  const proposedSolids = [], proposedOpenings = [];
  if (comp.arenaBoundarySolids) {
    const ring = toTiles(groundRooms[0].polygonAu);
    const lerp = (a1, b1, t) => [r4(a1[0] + (b1[0] - a1[0]) * t), r4(a1[1] + (b1[1] - a1[1]) * t)];
    for (let i = 0; i < ring.length; i++) {
      const a1 = ring[i], b1 = ring[(i + 1) % ring.length];
      const spans = i === 0 ? [[a1, lerp(a1, b1, 0.39)], [lerp(a1, b1, 0.61), b1]] : [[a1, b1]];
      spans.forEach(([q1, q2], j) => proposedSolids.push({
        id: `wall.u05.${id}.arena.${i + 1}.span.${j + 1}`, aTile: q1, bTile: q2,
        thicknessTiles: 2, blocksMovement: true, blocksSight: true, sprite: prog.art.wall,
        status: 'PROPOSED_ARENA_PERIMETER_BARRIER__NOT_SOURCE_AUTHORED', provenance: 'U05 physical composition proposal inside the unchanged GOLD poi.foot'
      }));
    }
    const gapMid = [(ring[0][0] + ring[1][0]) / 2, (ring[0][1] + ring[1][1]) / 2];
    proposedOpenings.push({
      id: `portal.u05.${id}.arena.entrance`, kind: 'EXTERIOR_ENTRANCE', centreTile: gapMid.map(r4),
      openingTiles: 8, effectiveClearWidthTiles: 8, traversable: true, staticHole: true,
      doorSprite: prog.art.door, dynamicDoorOwner: 'GAMEPLAY', doorState: 'UNRESOLVED_GAMEPLAY',
      status: 'PROPOSED_ARENA_ENTRANCE_GAP__NOT_SOURCE_AUTHORED'
    });
  }
  const allSolids = [...a.staticSolids.map((s) => ({ id: s.id, aTile: s.aAu.map((v) => r4(v / U)), bTile: s.bAu.map((v) => r4(v / U)), thicknessTiles: s.thicknessAu / U, blocksMovement: s.blocksMovement, blocksSight: s.blocksSight, sprite: prog.art.wall, status: 'SOURCE_AUTHORED' })), ...proposedSolids];
  const allOpenings = [...a.staticOpenings.map((o) => ({ id: o.id, kind: o.kind, centreTile: o.centreAu.map((v) => r4(v / U)), aTile: o.aAu.map((v) => r4(v / U)), bTile: o.bAu.map((v) => r4(v / U)), openingTiles: o.openingAu / U, effectiveClearWidthTiles: o.effectiveClearWidthAu / U, traversable: o.staticHole, doorSprite: o.kind === 'EXTERIOR_ENTRANCE' ? prog.art.door : prog.art.doorOpen, dynamicDoorOwner: o.dynamicDoorOwner, doorState: o.doorState, status: 'SOURCE_AUTHORED' })), ...proposedOpenings];
  const buildings = keptRooms.map((r, i) => {
    const srcTiles = toTiles(r.polygonAu);
    const fp = insetPoly(srcTiles, comp.inset).map((q) => q.map(r4));
    const fpAreaTile2 = r4(areaPoly(fp.map((q) => q.map((v) => v * U))) * 4);
    const covered = !!r.roofDescriptor?.covered, canopyOnly = !!r.roofDescriptor?.canopyOnly;
    const floor = comp.floor === 'none' ? 'none' : (comp.roofMode === 'full' || (covered && !canopyOnly) ? comp.floor : 'none');
    return {
      id: r.id, role: `${prog.intent.split('.')[0]} / structure ${i + 1} of ${keptRooms.length}`, pattern: r.pattern,
      status: 'PROPOSED__WHITEBOX_PHYSICAL_PROOF__NOT_FINAL_PIXEL_ART',
      polygonAu: r.polygonAu, polygonTiles: srcTiles, bboxTiles: bbox(srcTiles).map(r4),
      sourceRoomPolygonTiles: srcTiles, sourceRoomAreaTile2: r4(r.areaAu2 * 4),
      sourceRoof: { covered, canopyOnly, coverageFractionOfRoom: r.roofDescriptor?.coverageFractionOfRoom ?? 0 },
      footprintTiles: fp, footprintBboxTiles: bbox(fp).map(r4), insetFactor: comp.inset,
      footprintAreaTile2: fpAreaTile2,
      areaAu2: r.areaAu2, areaTile2: r4(r.areaAu2 * 4), centroidTile: r.centroidAu.map((v) => r4(v / U)),
      wallSprite: prog.art.wall, floorSprite: floor,
      roofSprite: comp.roofPalette[i % comp.roofPalette.length],
      roofMode: comp.roofMode,
      note: 'Inset footprint is PROPOSED physical composition INSIDE the unchanged GOLD poi.foot. Source room polygon and source roof descriptor are preserved verbatim.'
    };
  });
  // Roofs: FULL mode proposes one enclosed roof per inset footprint (explicit
  // design override, recorded); SOURCE mode keeps WMP-03 roof polygons inset,
  // plus deep-level reservations. Canopy-only source roofs are reduced.
  const roofs = [];
  if (comp.roofMode === 'full') {
    buildings.forEach((b, i) => roofs.push({
      id: `roof.u05.${id}.${i + 1}`, parentRoomId: b.id,
      polygonAu: b.polygonAu, sourcePolygonTiles: b.polygonTiles,
      polygonTiles: insetPoly(b.footprintTiles, 0.70).map((q) => q.map(r4)),
      footprintTiles: b.footprintTiles,
      status: 'PROPOSED_FULL_ROOF_OVER_INSET_FOOTPRINT', sprite: comp.roofPalette[i % comp.roofPalette.length],
      insetFactor: r4(comp.inset * 0.70), roofInnerInset: 0.70, overrideNote: comp.overrideNote
    }));
  } else {
    for (const rp of a.roofPolygons) {
      const room = a.rooms.find((r) => r.id === rp.parentRoomId);
      const isGroundKept = keptRoomIds.has(rp.parentRoomId) && room && room.levelId.endsWith('.0');
      const isDeep = !!room && room.levelId.endsWith('.-1');
      if (!isGroundKept && !isDeep) continue;
      const src = toTiles(rp.polygonAu);
      let factor = 1;
      if (isGroundKept) factor = comp.inset * (room.roofDescriptor?.canopyOnly ? Math.sqrt(room.roofDescriptor?.coverageFractionOfRoom || 0.5) : 1);
      else factor = 0.55;
      const poly = insetPoly(src, factor).map((q) => q.map(r4));
      roofs.push({
        id: rp.id, parentRoomId: rp.parentRoomId, polygonAu: rp.polygonAu,
        sourcePolygonTiles: src, polygonTiles: poly,
        status: isDeep ? 'DEEP_RESERVATION_ROOF__NOT_A_GROUND_ROOF' : rp.status,
        sprite: comp.roofPalette[roofs.length % comp.roofPalette.length], insetFactor: factor,
        note: isDeep ? 'Deep-level spatial reservation only; NO invented vertical separation value.' : undefined
      });
    }
  }
  const sourceRoomCoverage = r4(groundRooms.reduce((acc, r) => acc + r.areaAu2, 0) / areaPoly(footAu));
  const footprintCoverage = r4(buildings.reduce((acc, b) => acc + b.footprintAreaTile2, 0) / (areaPoly(footAu) * 4));
  const roofCoverage = r4(roofs.reduce((acc, r) => acc + areaPoly(r.polygonTiles.map((q) => q.map((v) => v * U))) * 4, 0) / (areaPoly(footAu) * 4));
  const drawnCoverage = r4(Math.max(buildings.filter((b) => b.floorSprite !== 'none').reduce((acc, b) => acc + b.footprintAreaTile2, 0) / (areaPoly(footAu) * 4), roofCoverage));
  const compositionBeforeAfter = {
    sourceRoomPolygonCount: groundRooms.length,
    sourceRoomCoverageFractionOfEnvelope: sourceRoomCoverage,
    proposedSeparateStructures: buildings.length,
    proposedRoofPolygons: roofs.length,
    proposedFootprintCoverageFractionOfEnvelope: footprintCoverage,
    drawnRoofCoverageFractionOfEnvelope: roofCoverage,
    drawnCoverageFractionOfEnvelope: drawnCoverage,
    openSpaceFractionAfter: r4(1 - drawnCoverage),
    openTerrainArena: comp.floor === 'none',
    goldEnvelopeChanged: false, goldPolygonAmended: false,
    reason: comp.reason, overrideNote: comp.overrideNote,
    note: 'Before = WMP-03 PROPOSED full rooms/roof descriptors. After = U05 PROPOSED inset footprints and roof hierarchy. Both are DESIGN states, NOT GOLD canon changes; measured incompatibility and before/after comparison are explicit.'
  };
  const scene = {
    schema: 'soh.u05.deep-physical-scene.v1', id, name: gold.name, contract: 'CREATOR_CHOSEN_U05.v1',
    generatedAt: new Date().toISOString(),
    status: 'P3_DEEP_PHYSICAL_DESIGN__ART_INCOMPLETE_WHITEBOX__REQUIRES_RUNTIME_WALK_PROOF',
    intent: prog.intent,
    sourceCustody: {
      goldPoiIdSha256: sha(Buffer.from(JSON.stringify(gold))), architecturePoiSha256: sha(Buffer.from(JSON.stringify(a))),
      masterplanEntrySha256: sha(Buffer.from(JSON.stringify(mp))),
      liveGameplaySha: 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9',
      noGOLDFileModified: true, noRoadRedraw: true, noAtlasAdded: true
    },
    camera: { viewport: [640, 360], dpr: 1, zoom: 1, cameraTrick: false, anchorAu: anchorAu.map(r4), anchorTile: anchorAu.map((v) => Math.floor(v / U)), U, TILE, heroSpritePx: [16, 24], speedPxPerSec: 72 },
    states: prog.states,
    beforeAfter: { globalCoordsAu: anchorAu.map(r4), cameraTile: anchorAu.map((v) => Math.floor(v / U)), beforePhysicalLayer: false, afterPhysicalLayer: true, sameCamera: true, sameGlobalCoordinates: true, note: 'Before = live-SHA terrain + GOLD roads, physical layer OFF. After = identical camera/global coords, physical layer ON.' },
    SITE_ENVELOPE: {
      class: 'reprojected', source: 'GOLD poi.foot', markerOnly: true, certifiedBuilding: false,
      polygonAu: footAu, polygonTiles: footTiles, polygonTilesSnapped: footAu.map((q) => q.map((v) => Math.floor(v / U))),
      bboxTiles: bbTiles, areaAu2: mp.measuredArea.au2, areaTile2: mp.measuredArea.tile2,
      chunkRange: { x0: Math.floor(bbTiles[0] / 32), y0: Math.floor(bbTiles[1] / 32), x1: Math.floor(bbTiles[2] / 32), y1: Math.floor(bbTiles[3] / 32) },
      chunkIdentity: `creator-u05|${Math.floor(bbTiles[0] / 32)}:${Math.floor(bbTiles[1] / 32)}`,
      obb: { centre: obb.centre, ux: obb.ux, uy: obb.uy, wAu: obb.wAu, hAu: obb.hAu, angleRad: obb.angleRad, wTiles: obb.wAu / U, hTiles: obb.hAu / U },
      noPolygonAmendment: true, noShrinkRelocateExpand: true
    },
    BUILDING_COMPOSITION: {
      class: 'proposed', separateStructureCount: buildings.length, deepReservationCount: deepRooms.length,
      buildings,
      deepReservations: deepRooms.map((r) => ({ id: r.id, polygonTiles: toTiles(r.polygonAu), areaTile2: r4(r.areaAu2 * 4), status: 'SPATIAL_RESERVATION_ONLY__NO_VERTICAL_SEPARATION_VALUE' })),
      spatialProgrammeAreas: areas, sightlines: prog.sightlines, roofHierarchy: `${roofs.length} roof polygons over ${buildings.length} separate structures`,
      compositionBeforeAfter,
      coherentGrounds: true, oneHugeRectangularRoof: false, emptyInflatedRectangle: false, randomProps: 0
    },
    DOORS_ROOMS: {
      class: 'proposed', roomCount: a.roomCount, hall: a.enclosureClass,
      exteriorEntrance: ext.length ? { id: ext[0].id, centreAu: ext[0].centreAu, centreTile: ext[0].centreAu.map((v) => r4(v / U)), openingTiles: ext[0].openingAu / U, effectiveClearWidthTiles: ext[0].effectiveClearWidthAu / U, staticHole: true, dynamicDoorOwner: 'GAMEPLAY', doorState: 'UNKNOWN' } : { status: 'MISSING_EXTERIOR_ENTRANCE_RECORD', noDoorInvented: true, owner: 'MAP_U05 / GAMEPLAY A8' },
      openings: allOpenings,
      thresholds: allOpenings.filter((o) => o.traversable).map((o) => ({ id: o.id, minClearWidthTiles: o.effectiveClearWidthTiles, heroWidthPx: 16, heroWidthTiles: 1, passable: true, note: 'Physically meaningful clear width; player 16x24 px is NOT stretched.' })),
      namedPlaceholders: prog.placeholders
    },
    ROOF_OCCLUSION: {
      class: 'proposed', roofPolygonCount: roofs.length, sourceRoofPolygonCount: a.roofPolygonCount, roofs,
      rule: 'Runtime draws a roof ABOVE the player, then HIDES it when the player centre is inside that roof polygon. This is real occlusion, not a POI text label.',
      whiteboxNote: 'Reused SOH roof sprites are physical proof, NOT final pixel art / art-complete.'
    },
    SOLID_COLLISION: {
      class: 'proposed', mesh: 'line-segment spans split BY static openings; thickness in U=0.5 tiles',
      solidCount: allSolids.length,
      solids: allSolids,
      sourceSolidCount: a.staticSolids.length, proposedSolidCount: proposedSolids.length,
      proposedSolidsNote: proposedSolids.length ? 'Typhon source has ZERO static solids/openings (open-air arena). U05 PROPOSES a perimeter barrier with one entrance gap for SOLID_COLLISION proof. NOT GOLD canon, NOT a Gameplay law.' : 'None.',
      openingsBypassSolids: true, idMapping: a.idMapping || [],
      terrainCollision: 'GOLD land/water/cliff candidates from LW-01 sampleAt(); NO artificial marine permission',
      walkabilitySample: { boundsTiles: [Math.floor(bbTiles[0]) - 12, Math.floor(bbTiles[1]) - 12, Math.ceil(bbTiles[2]) + 12, Math.ceil(bbTiles[3]) + 12], method: 'runtime BFS using the SAME collision function as real WASD input', status: 'TO_BE_MEASURED_IN_BROWSER' }
    },
    NAV_RETREAT: {
      class: 'proposed', circulation: a.circulation, architectureRetreat: a.retreat, goldRetreatPoints: (gold.retreat || []).map((q) => ({ au: q, tile: q.map((v) => Math.floor(v / U)) })),
      roadApproach: road, approachPathAu: [road.startAu, goalAu.map(r4)], approachPathTiles: [road.startTile, goalTile],
      reentryPathAu: [goalAu.map(r4), road.startAu, goalAu.map(r4)],
      walkTest: { method: 'Browser BFS on runtime collision -> REAL keyboard WASD/arrow events at 72 px/s -> measured global pixel positions', teleportUsed: false, camUsedAsRoute: false, status: 'TO_BE_PROVEN_IN_BROWSER' },
      meaningfulRetreat: mp.NAV_RETREAT.meaningfulRetreat
    },
    GAMEPLAY_SOCKETS: {
      class: 'runtime-owned', gate: gold.gate, power: 'GAMEPLAY', locks: 'GAMEPLAY', hp: 'GAMEPLAY', ownership: 'GAMEPLAY', loot: 'GAMEPLAY', enemyPlacement: 'GAMEPLAY',
      fabricatedLoot: false, fabricatedOwnershipOrCash: false, bossState: false, combatRewards: false, vendorEconomics: false, boatGameplay: false,
      marinePermission: 'UNRESOLVED_GAMEPLAY', buildPermission: 'UNKNOWN__GAMEPLAY', cargoApproval: false
    },
    terrainConstraints: prog.terrainConstraints,
    markers: prog.markers,
    subScenes: prog.subScenes,
    physicalProof: {
      artComplete: false, whiteboxPhysicalProof: true, runtimeWalkProof: 'PENDING_P4_QA',
      distinguish: 'Grey boxes / reused SOH sprites prove geometry, collision, doors, roof occlusion and walkability. They are NOT final pixel art and NOT visual acceptance.',
      captureRequirement: ['before', 'after', 'approach', 'reentry', 'roof_occlusion']
    },
    conflicts: (() => {
      const c = [];
      if (!ext.length) c.push({ kind: 'MISSING_EXTERIOR_ENTRANCE_RECORD', status: 'UNRESOLVED', owner: 'MAP_U05 / GAMEPLAY A8' });
      if (id === 'po_beacon') c.push({ kind: 'HELICOPTER_PROVEN_MISSING', atAu: [272, 652], status: 'PROVEN_MISSING__NO_SUBSTITUTE__NO_RELOCATION', owner: 'CREATOR / GAMEPLAY A8' });
      if (id === 'po_ironmine') c.push({ kind: 'CART_SWEPT_CLEARANCE', status: 'UNRESOLVED', owner: 'MAP_U05 / GAMEPLAY' });
      if (id === 'po_westmouth') c.push({ kind: 'MARINE_FOOT_PERMISSION', status: 'UNRESOLVED_GAMEPLAY', owner: 'GAMEPLAY / CREATOR' });
      return c;
    })()
  };
  scenes.push(scene);
  fs.writeFileSync(path.join(U05, `scenes/${id}.u05.json`), JSON.stringify(scene, null, 2) + '\n');
}

// Browser module: one generated object, no runtime JSON fetch, no network.
const out = `/* AUTO-GENERATED by creator-u05/tools/build-scenes-u05.mjs — DO NOT HAND-EDIT.\n * Six deep U=0.5 physical scene designs. Polygons are REPROJECTIONS of GOLD\n * poi.foot + WMP-03 PROPOSED architecture; grounds are PROPOSED OBB-local\n * rectangles inside the existing envelope. No Gameplay law, no new atlas. */\nexport const U05_SCENES: any[] = ${JSON.stringify(scenes, null, 2)};\nexport const U05_SCENE_IDS: string[] = ${JSON.stringify(SCENE_IDS)};\n`;
fs.writeFileSync(path.join(U05, 'web-u05/src/u05/scenes.generated.ts'), out);
console.log(`U05_SCENES_OK count=${scenes.length} ids=${SCENE_IDS.join(',')} moduleBytes=${Buffer.byteLength(out)}`);
