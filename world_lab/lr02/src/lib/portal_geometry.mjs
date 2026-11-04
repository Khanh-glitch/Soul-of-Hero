// MAP-LR02 M1 — reusable opening-aware static geometry compiler.
// Consumes LR01 POI layouts (pinned by parent digest) and emits TRUE clipped
// solid wall spans + explicit geometric opening intervals. Portals are grounded
// on the actual wall/room boundary, not a centroid midpoint. LR01 is never
// modified; parent wall/room/portal/entrance IDs are preserved, new span IDs
// are deterministic and mapped old -> new.
// Map authors STATIC solids/holes only. Gameplay owns dynamic door state,
// locks, power, destruction, collision rules and runtime passability.
import { pip, ringArea, segInt } from '../../../lr01/src/lib/veyra.mjs';
import { CONST, r4, dist, sub, dot, norm, perp, lerp2, distPointSegment, projectOnWall } from './lr02.mjs';

export const STATUS = Object.freeze({
  PROPOSED: 'PROPOSED', DERIVED: 'DERIVED', VERIFIED: 'VERIFIED',
  INVALID: 'INVALID', UNRESOLVED: 'UNRESOLVED', BLOCKED: 'BLOCKED', UNKNOWN: 'UNKNOWN',
});

const local = (obb, p) => { const d = sub(p, obb.centre); return [dot(d, obb.ux), dot(d, obb.uy)]; };
const world = (obb, u, v) => [obb.centre[0] + u * obb.ux[0] + v * obb.uy[0], obb.centre[1] + u * obb.ux[1] + v * obb.uy[1]];

function parseRoom(id) {
  const p = id.split('.');
  if (p[0] !== 'room') return null;
  if (p[2] === 'deep') return { deep: true, row: null, col: null };
  return { deep: false, row: +p[2], col: +p[3] };
}

/** Enclosure policy stops open yards / piers becoming arbitrary closed compounds. */
export function enclosurePolicy(layout) {
  const family = layout.template.family;
  if (family === 'open') return { id: 'OPEN_YARD', continuousExteriorWalls: false, reason: `family=${family}: open-air POI keeps a non-solid yard boundary` };
  if (family === 'mixed') return { id: 'PARTIAL_CLUSTER', continuousExteriorWalls: true, reason: `family=${family}: partly roofed cluster; exterior walls are solid but carry a real entrance opening and interior doorways` };
  return { id: 'FULL_ENCLOSURE', continuousExteriorWalls: true, reason: `family=${family}: enclosed POI with cut exterior/interior openings` };
}

/** Shared wall boundary segment between two adjacent grid rooms, in world au. */
function sharedBoundary(layout, fromId, toId, wallById) {
  const a = parseRoom(fromId), b = parseRoom(toId);
  if (!a || !b || a.deep || b.deep) return null;
  const rows = layout.template.instantiatedRows, cols = layout.template.instantiatedCols;
  const obb = layout.footprint.obb;
  const ls = layout.canonical.footPolygonAu.map(p => local(obb, p));
  const u0 = Math.min(...ls.map(x => x[0])), u1 = Math.max(...ls.map(x => x[0]));
  const v0 = Math.min(...ls.map(x => x[1])), v1 = Math.max(...ls.map(x => x[1]));
  let wallId, segA, segB;
  if (a.row === b.row && Math.abs(a.col - b.col) === 1) {
    const k = Math.min(a.col, b.col);
    wallId = `wall.${layout.poiId}.split.v.${k}`;
    const w = wallById.get(wallId); if (!w) return null;
    const f0 = (a.row - 1) / rows, f1 = a.row / rows;
    segA = lerp2(w.aAu, w.bAu, f0); segB = lerp2(w.aAu, w.bAu, f1);
  } else if (a.col === b.col && Math.abs(a.row - b.row) === 1) {
    const k = Math.min(a.row, b.row);
    wallId = `wall.${layout.poiId}.split.h.${k}`;
    const w = wallById.get(wallId); if (!w) return null;
    const f0 = (a.col - 1) / cols, f1 = a.col / cols;
    segA = lerp2(w.aAu, w.bAu, f0); segB = lerp2(w.aAu, w.bAu, f1);
  } else return null;
  const w = wallById.get(wallId);
  const prA = projectOnWall(segA, w.aAu, w.bAu), prB = projectOnWall(segB, w.aAu, w.bAu);
  const centre = lerp2(prA.pt, prB.pt, 0.5);
  return { wallId, wall: w, segTAu: [Math.min(prA.t, prB.t), Math.max(prA.t, prB.t)], centre, boundarySegmentAu: [segA.map(r4), segB.map(r4)] };
}

/** Validate one opening interval on one wall. */
function validateInterval(wall, t0, t1, margin, segT) {
  const L = projectOnWall(wall.aAu, wall.aAu, wall.bAu).L;
  if (!(t1 > t0)) return { valid: false, reason: 'NON_POSITIVE_OPENING_WIDTH' };
  if (t1 - t0 <= margin) return { valid: false, reason: `OPENING_NOT_WIDER_THAN_WALL_THICKNESS__NO_PHYSICAL_PLAYER_CLEARANCE (width=${r4(t1 - t0)}, thickness=${margin})` };
  if (t0 < margin || t1 > L - margin) return { valid: false, reason: `OPENING_OUTSIDE_WALL_SAFE_MARGIN (t0=${r4(t0)}, t1=${r4(t1)}, L=${r4(L)}, margin=${margin})` };
  if (segT && (t0 < segT[0] + margin || t1 > segT[1] - margin)) return { valid: false, reason: `OPENING_OUTSIDE_SHARED_ROOM_BOUNDARY (seg=${segT.map(r4)})` };
  return { valid: true, reason: null };
}

/** Build the physical occupancy grid for one POI (POI walls only, not terrain). */
function buildField(solids, openings, foot, thickness, opts = {}) {
  const step = opts.step ?? 1;
  const pad = opts.pad ?? (thickness * 3 + 8);
  const xs = foot.map(p => p[0]), ys = foot.map(p => p[1]);
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  const x1 = Math.max(...xs) + pad, y1 = Math.max(...ys) + pad;
  const nx = Math.ceil((x1 - x0) / step) + 1, ny = Math.ceil((y1 - y0) / step) + 1;
  const blocked = new Uint8Array(nx * ny);
  const gi = (x, y) => Math.round((x - x0) / step) + Math.round((y - y0) / step) * nx;
  const cellCentre = i => [x0 + (i % nx) * step, y0 + Math.floor(i / nx) * step];
  // Solid spans: capsule of radius thickness/2 around the clipped segment.
  for (const s of solids) {
    const bx0 = Math.min(s.aAu[0], s.bAu[0]) - thickness, bx1 = Math.max(s.aAu[0], s.bAu[0]) + thickness;
    const by0 = Math.min(s.aAu[1], s.bAu[1]) - thickness, by1 = Math.max(s.aAu[1], s.bAu[1]) + thickness;
    const ix0 = Math.max(0, Math.floor((bx0 - x0) / step)), ix1 = Math.min(nx - 1, Math.ceil((bx1 - x0) / step));
    const iy0 = Math.max(0, Math.floor((by0 - y0) / step)), iy1 = Math.min(ny - 1, Math.ceil((by1 - y0) / step));
    for (let gy = iy0; gy <= iy1; gy++) for (let gx = ix0; gx <= ix1; gx++) {
      const p = [x0 + gx * step, y0 + gy * step];
      if (distPointSegment(p, s.aAu, s.bAu).d <= thickness / 2 + 1e-6) blocked[gy * nx + gx] = 1;
    }
  }
  // Explicit holes: clear the opening rectangle (guards against capsule ends
  // from the two adjoining spans narrowing the gap below physical clearance).
  for (const o of openings) {
    const u = norm(sub(o.bAu, o.aAu)), n = perp(u), halfT = thickness / 2 + 0.75;
    for (let s = -o.openingAu / 2; s <= o.openingAu / 2; s += step / 2) for (let q = -halfT; q <= halfT; q += step / 2) {
      const p = [o.centreAu[0] + u[0] * s + n[0] * q, o.centreAu[1] + u[1] * s + n[1] * q];
      const i = gi(p[0], p[1]);
      if (i >= 0 && i < blocked.length) blocked[i] = 0;
    }
  }
  return { blocked, nx, ny, x0, y0, step, gi, cellCentre };
}

function bfs(field, start, diagonal = false) {
  const seen = new Uint8Array(field.blocked.length);
  const q = [];
  const s = field.gi(start[0], start[1]);
  if (s < 0 || s >= seen.length || field.blocked[s]) return { seen, start: s, ok: false };
  seen[s] = 1; q.push(s);
  for (let h = 0; h < q.length; h++) {
    const i = q[h], gx = i % field.nx, gy = Math.floor(i / field.nx);
    const nb = [gx > 0 ? i - 1 : -1, gx < field.nx - 1 ? i + 1 : -1, gy > 0 ? i - field.nx : -1, gy < field.ny - 1 ? i + field.nx : -1];
    if (diagonal) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = gx + dx, y = gy + dy;
      if (x >= 0 && x < field.nx && y >= 0 && y < field.ny) nb.push(y * field.nx + x);
    }
    for (const j of nb) if (j >= 0 && !seen[j] && !field.blocked[j]) { seen[j] = 1; q.push(j); }
  }
  return { seen, start: s, ok: true, count: q.length };
}

function rayHitsSolid(field, a, b, samples = 120) {
  for (let k = 0; k <= samples; k++) {
    const p = lerp2(a, b, k / samples), i = field.gi(p[0], p[1]);
    if (i >= 0 && i < field.blocked.length && field.blocked[i]) return { hit: true, at: p.map(r4), k };
  }
  return { hit: false };
}

export { buildField, bfs, rayHitsSolid };

/** Compile one LR01 layout into corrected static solids / holes + tests. */
export function compilePoi(layout, opts = {}) {
  const poiId = layout.poiId;
  const policy = enclosurePolicy(layout);
  const wallById = new Map(layout.walls.map(w => [w.id, w]));
  const thickness = layout.footprint.wallThicknessAu;
  const margin = thickness; // 2 au: keeps a solid post at every corner/junction
  const exceptions = [];
  const openBoundary = [];
  const staticSolids = [];
  const staticOpenings = [];
  const portalRecords = [];
  const idMapping = [];
  const wallClipAudit = [];
  const yardPassageIds = [];

  if (!policy.continuousExteriorWalls) {
    for (const w of layout.walls) {
      idMapping.push({ oldId: w.id, newIds: [w.id], kind: 'UNCHANGED_NON_SOLID_BOUNDARY', openingCount: 0 });
      openBoundary.push({
        id: w.id, parentPoiId: poiId, kind: w.kind, aAu: w.aAu, bAu: w.bAu,
        thicknessAu: thickness, blocksMovement: false, blocksSight: false,
        status: STATUS.DERIVED, note: 'NON_SOLID_YARD_BOUNDARY: open-air POI is NOT an arbitrary closed compound.',
      });
    }
    for (const p of layout.portals) {
      const vertical = p.kind === 'VERTICAL_LINK';
      const ok = !vertical;
      if (ok) yardPassageIds.push(p.id);
      portalRecords.push({
        id: p.id, parentPoiId: poiId, kind: p.kind, wallId: null,
        fromRoomId: p.fromRoomId, toRoomId: p.toRoomId,
        physicalOpening: false, connectionValid: ok, yardPassage: ok,
        status: vertical ? STATUS.UNRESOLVED : 'OPEN_AIR_YARD_PASSAGE__NO_WALL_TO_CUT',
        note: vertical ? 'Canonical deep polygon exists, but no approved vertical geometry.' : 'No solid wall exists to clip; yard circulation is open. Gameplay owns dynamic state.',
      });
      if (vertical) exceptions.push({ id: `EX.${poiId}.vertical`, portalId: p.id, reason: 'VERTICAL_LINK_HAS_NO_PHYSICAL_OPENING', owner: 'MAP+GAMEPLAY' });
    }
  } else {
    // ---- collect openings grounded on real wall segments ----
    const byWall = new Map();
    const addOpening = rec => { if (!byWall.has(rec.wallId)) byWall.set(rec.wallId, []); byWall.get(rec.wallId).push(rec); };

    for (const p of layout.portals) {
      if (p.kind === 'VERTICAL_LINK') {
        portalRecords.push({
          id: p.id, parentPoiId: poiId, kind: p.kind, wallId: null,
          fromRoomId: p.fromRoomId, toRoomId: p.toRoomId,
          physicalOpening: false, connectionValid: false,
          status: STATUS.UNRESOLVED,
          note: 'Canonical deep polygon exists but NO approved vertical unit / stair geometry. Not a physical opening.',
        });
        exceptions.push({ id: `EX.${poiId}.vertical`, portalId: p.id, reason: 'VERTICAL_LINK_HAS_NO_PHYSICAL_OPENING', owner: 'MAP+GAMEPLAY' });
        continue;
      }
      let rec;
      if (p.kind === 'EXTERIOR_PORTAL') {
        const w = wallById.get(layout.entrance.onWallId);
        if (!w) { exceptions.push({ id: `EX.${poiId}.entranceWall`, portalId: p.id, reason: 'ENTRANCE_WALL_NOT_FOUND', owner: 'MAP' }); continue; }
        const pr = projectOnWall(layout.entrance.atAu, w.aAu, w.bAu);
        const half = layout.entrance.openingAu / 2;
        rec = { portal: p, wallId: w.id, wall: w, t0: pr.t - half, t1: pr.t + half, centreT: pr.t, segT: null, kind: 'EXTERIOR_ENTRANCE', fromRoomId: p.fromRoomId, toRoomId: p.toRoomId };
      } else {
        const sb = sharedBoundary(layout, p.fromRoomId, p.toRoomId, wallById);
        if (!sb) {
          exceptions.push({ id: `EX.${poiId}.${p.id}`, portalId: p.id, reason: 'NO_SHARED_WALL_BOUNDARY_FOUND', owner: 'MAP' });
          portalRecords.push({ id: p.id, parentPoiId: poiId, kind: p.kind, wallId: null, fromRoomId: p.fromRoomId, toRoomId: p.toRoomId, physicalOpening: false, connectionValid: false, status: STATUS.INVALID, reason: 'NO_SHARED_WALL_BOUNDARY_FOUND' });
          continue;
        }
        const pr = projectOnWall(sb.centre, sb.wall.aAu, sb.wall.bAu);
        const half = p.openingAu / 2;
        rec = { portal: p, wallId: sb.wallId, wall: sb.wall, t0: pr.t - half, t1: pr.t + half, centreT: pr.t, segT: sb.segTAu, kind: 'INTERIOR_DOORWAY', fromRoomId: p.fromRoomId, toRoomId: p.toRoomId, boundarySegmentAu: sb.boundarySegmentAu };
      }
      rec.openingAu = rec.portal.openingAu;
      const v = validateInterval(rec.wall, rec.t0, rec.t1, margin, rec.segT);
      rec.valid = v.valid; rec.reason = v.reason;
      if (!v.valid) {
        exceptions.push({ id: `EX.${poiId}.${p.id}`, portalId: p.id, wallId: rec.wallId, reason: v.reason, owner: 'MAP' });
        portalRecords.push({ id: p.id, parentPoiId: poiId, kind: p.kind, wallId: rec.wallId, fromRoomId: p.fromRoomId, toRoomId: p.toRoomId, physicalOpening: false, connectionValid: false, status: STATUS.INVALID, reason: v.reason });
        continue;
      }
      addOpening(rec);
    }

    // ---- per-wall overlap check, then clip ----
    for (const [wallId, recs] of byWall) {
      recs.sort((a, b) => a.t0 - b.t0);
      let prevT1 = -Infinity;
      for (const rec of recs) {
        if (rec.t0 - prevT1 < thickness) {
          rec.valid = false; rec.reason = `OPENINGS_TOO_CLOSE__SOLID_POST_REQUIRES_${thickness}au (prevEnd=${r4(prevT1)}, t0=${r4(rec.t0)})`;
          exceptions.push({ id: `EX.${poiId}.${rec.portal.id}`, portalId: rec.portal.id, wallId, reason: rec.reason, owner: 'MAP' });
          portalRecords.push({ id: rec.portal.id, parentPoiId: poiId, kind: rec.kind, wallId, fromRoomId: rec.fromRoomId, toRoomId: rec.toRoomId, physicalOpening: false, connectionValid: false, status: STATUS.INVALID, reason: rec.reason });
          continue;
        }
        prevT1 = rec.t1;
        const u = norm(sub(rec.wall.bAu, rec.wall.aAu));
        const aAu = [rec.wall.aAu[0] + u[0] * rec.t0, rec.wall.aAu[1] + u[1] * rec.t0];
        const bAu = [rec.wall.aAu[0] + u[0] * rec.t1, rec.wall.aAu[1] + u[1] * rec.t1];
        const centreAu = lerp2(aAu, bAu, 0.5).map(r4);
        staticOpenings.push({
          id: rec.portal.id, parentPoiId: poiId, kind: rec.kind, wallId,
          aAu: aAu.map(r4), bAu: bAu.map(r4), centreAu,
          intervalAu: [r4(rec.t0), r4(rec.t1)], openingAu: r4(rec.openingAu),
          effectiveClearWidthAu: r4(rec.openingAu - thickness),
          thicknessAu: thickness, unit: 'authoring_unit',
          orientationRad: r4(Math.atan2(u[1], u[0])),
          normalAu: perp(u).map(r4),
          fromRoomId: rec.fromRoomId, toRoomId: rec.toRoomId,
          levelId: rec.kind === 'EXTERIOR_ENTRANCE' ? `level.${poiId}.0` : null,
          boundarySegmentAu: rec.boundarySegmentAu ?? null,
          staticHole: true, blocksMovement: false, blocksSight: false,
          dynamicDoorOwner: 'GAMEPLAY', doorState: STATUS.UNKNOWN, lockedState: STATUS.UNKNOWN, powerRequirement: STATUS.UNKNOWN,
          status: STATUS.PROPOSED,
          note: 'STATIC geometric hole only. No lock, key, power, device, door state or destruction rule.',
        });
        portalRecords.push({
          id: rec.portal.id, parentPoiId: poiId, kind: rec.kind, wallId,
          fromRoomId: rec.fromRoomId, toRoomId: rec.toRoomId,
          physicalOpening: true, connectionValid: true, status: STATUS.PROPOSED,
          openingAu: r4(rec.openingAu), intervalAu: [r4(rec.t0), r4(rec.t1)], centreAu,
        });
      }
    }

    // ---- clip each wall into true solid spans ----
    for (const w of layout.walls) {
      const recs = (byWall.get(w.id) || []).filter(r => r.valid).sort((a, b) => a.t0 - b.t0);
      const pr = projectOnWall(w.aAu, w.aAu, w.bAu), L = pr.L, u = pr.u;
      const cuts = [];
      let cur = 0;
      for (const r of recs) { if (r.t0 > cur + 1e-6) cuts.push([cur, r.t0]); cur = Math.max(cur, r.t1); }
      if (cur < L - 1e-6) cuts.push([cur, L]);
      const openIv = recs.map(r => [r4(r.t0), r4(r.t1)]);
      const solidIv = cuts.map(([a, b]) => [r4(a), r4(b)]);
      const covered = solidIv.reduce((s, [a, b]) => s + (b - a), 0) + openIv.reduce((s, [a, b]) => s + (b - a), 0);
      const overlaps = openIv.some((iv, i) => i > 0 && iv[0] < openIv[i - 1][1] - 1e-6);
      wallClipAudit.push({ wallId: w.id, lengthAu: r4(L), openingIntervalsAu: openIv, solidIntervalsAu: solidIv, coveredAu: r4(covered), overlap: overlaps, status: !overlaps && Math.abs(covered - L) < 0.02 ? 'EXACT_COVERAGE' : 'COVERAGE_DEFECT' });
      const newIds = [];
      if (!recs.length) {
        newIds.push(w.id);
        staticSolids.push({ id: w.id, parentWallId: w.id, parentPoiId: poiId, kind: w.kind, aAu: w.aAu, bAu: w.bAu, lengthAu: r4(L), thicknessAu: thickness, orientationRad: r4(Math.atan2(u[1], u[0])), unit: 'authoring_unit', blocksMovement: true, blocksSight: true, status: STATUS.PROPOSED, sourceRef: `LR01 ${w.id} (unchanged: no opening intersects this wall)` });
      } else cuts.forEach(([t0, t1], k) => {
        const id = `${w.id}.span.${k + 1}`;
        newIds.push(id);
        const aAu = [w.aAu[0] + u[0] * t0, w.aAu[1] + u[1] * t0], bAu = [w.aAu[0] + u[0] * t1, w.aAu[1] + u[1] * t1];
        staticSolids.push({ id, parentWallId: w.id, parentPoiId: poiId, kind: w.kind, spanIndex: k + 1, aAu: aAu.map(r4), bAu: bAu.map(r4), lengthAu: r4(t1 - t0), thicknessAu: thickness, orientationRad: r4(Math.atan2(u[1], u[0])), unit: 'authoring_unit', blocksMovement: true, blocksSight: true, status: STATUS.PROPOSED, sourceRef: `LR01 ${w.id} clipped by opening intervals`, openingIds: recs.map(r => r.portal.id) });
      });
      idMapping.push({ oldId: w.id, newIds, kind: recs.length ? 'SPLIT_BY_OPENINGS' : 'UNCHANGED', openingCount: recs.length });
    }
  }

  // ---- physical field + positive/negative spatial tests ----
  const NA = 'NOT_APPLICABLE';
  const entranceWall = wallById.get(layout.entrance.onWallId);
  // Wall thickness is POI-specific (1.056..2+ au): never sample a coarse 1-au
  // grid that could step straight over a thin wall.
  const fieldStep = opts.step ?? Math.min(0.5, thickness / 2);
  const field = buildField(staticSolids, staticOpenings, layout.canonical.footPolygonAu, thickness, { step: fieldStep });
  const centroid = layout.footprint.obb.centre;
  let exteriorStart = null;
  if (entranceWall) {
    const u = norm(sub(entranceWall.bAu, entranceWall.aAu));
    let n = perp(u);
    const m = lerp2(entranceWall.aAu, entranceWall.bAu, 0.5);
    if (dot(n, sub(m, centroid)) < 0) n = [-n[0], -n[1]];
    exteriorStart = [layout.entrance.atAu[0] + n[0] * (thickness / 2 + 5), layout.entrance.atAu[1] + n[1] * (thickness / 2 + 5)];
  }
  const entranceOpening = staticOpenings.find(o => o.kind === 'EXTERIOR_ENTRANCE') || null;
  const entryCentre = entranceOpening ? entranceOpening.centreAu : layout.entrance.atAu;
  const reach = exteriorStart ? bfs(field, exteriorStart) : { seen: new Uint8Array(field.blocked.length), ok: false, start: -1 };
  const groundRooms = layout.rooms.filter(r => parseRoom(r.id) && !parseRoom(r.id).deep);
  const roomReach = {};
  for (const r of groundRooms) {
    const i = field.gi(r.centroidAu[0], r.centroidAu[1]);
    roomReach[r.id] = !!(i >= 0 && i < field.blocked.length && reach.seen[i]);
  }
  // Physical room graph: only VALID connections (cut openings OR open-yard
  // passages) connect rooms. Graph BFS is NEVER substituted for the grid BFS.
  const adjacency = new Map(groundRooms.map(r => [r.id, []]));
  for (const p of portalRecords) if (p.connectionValid && p.fromRoomId && p.toRoomId && adjacency.has(p.fromRoomId) && adjacency.has(p.toRoomId)) {
    adjacency.get(p.fromRoomId).push(p.toRoomId); adjacency.get(p.toRoomId).push(p.fromRoomId);
  }
  const graphSeen = new Set();
  const startRoom = layout.circulation.entranceRoomId;
  if (adjacency.has(startRoom)) { const q = [startRoom]; graphSeen.add(startRoom); for (let h = 0; h < q.length; h++) for (const o of adjacency.get(q[h])) if (!graphSeen.has(o)) { graphSeen.add(o); q.push(o); } }
  const graphOnly = [...graphSeen].filter(id => !roomReach[id]);
  const physicalOnly = Object.entries(roomReach).filter(([id, v]) => v && !graphSeen.has(id)).map(([id]) => id);

  const tests = {};
  const notApplicableTests = [];
  // Pick the LONGEST intact solid span, avoiding a 1-au post between two holes.
  const sortedSolids = [...staticSolids].sort((a, b) => b.lengthAu - a.lengthAu);
  const anySolid = sortedSolids[0] || null;
  const solidMid = anySolid ? lerp2(anySolid.aAu, anySolid.bAu, 0.5) : null;
  tests.validExteriorEntry = !!(exteriorStart && reach.ok && !rayHitsSolid(field, exteriorStart, entryCentre).hit);
  tests.openDoorwayHasUnblockedStaticGeometry = !field.blocked[field.gi(entryCentre[0], entryCentre[1])];
  tests.losThroughRealGap = !!(exteriorStart && !rayHitsSolid(field, exteriorStart, entryCentre).hit);
  tests.multiRoomMovementThroughLegitimatePortals = groundRooms.length > 1 ? Object.values(roomReach).filter(Boolean).length >= 2 : true;
  tests.physicalConnectivityMatchesGraph = graphOnly.length === 0 && physicalOnly.length === 0;
  tests.sourceStableIds = layout.walls.every(w => idMapping.some(m => m.oldId === w.id))
    && layout.portals.every(p => portalRecords.some(r => r.id === p.id))
    && layout.rooms.every(r => r.id)
    && !!layout.entrance.id;
  // Corner-shortcut test: DIAGONAL grid movement must NOT unlock any room that
  // 4-neighbour (physically honest) movement cannot reach. Aligned legitimate
  // doorways are legal; diagonal-vs-orthogonal reachability is the real check.
  const reach8 = exteriorStart ? bfs(field, exteriorStart, true) : null;
  const diagonalExtraRooms = [];
  if (reach8) for (const r of groundRooms) {
    const i = field.gi(r.centroidAu[0], r.centroidAu[1]);
    if (i >= 0 && i < field.blocked.length && reach8.seen[i] && !reach.seen[i]) diagonalExtraRooms.push(r.id);
  }
  tests.noCornerShortcut = diagonalExtraRooms.length === 0;
  if (policy.continuousExteriorWalls) {
    // EXACT algebraic proof: solid spans + opening intervals tile each wall
    // with no overlap and no uncovered gap. Grid sampling alone is too coarse.
    tests.noInvisibleSolidWallOverDoorway = wallClipAudit.every(a => a.status === 'EXACT_COVERAGE')
      && staticOpenings.every(o => !field.blocked[field.gi(o.centreAu[0], o.centreAu[1])]);
    tests.noAccidentalGapInClosedWall = wallClipAudit.every(a => a.status === 'EXACT_COVERAGE');
    tests.blockedMovementThroughIntactSolidSpan = !!(solidMid && field.blocked[field.gi(solidMid[0], solidMid[1])]);
    tests.losBlockedBySolidSpan = !!(solidMid && exteriorStart && rayHitsSolid(field, exteriorStart, solidMid).hit);
    tests.noNonphysicalCornerShortcutOrCrossRoomWall = tests.noCornerShortcut && tests.noAccidentalGapInClosedWall;
  } else {
    for (const k of ['noInvisibleSolidWallOverDoorway', 'noAccidentalGapInClosedWall', 'blockedMovementThroughIntactSolidSpan', 'losBlockedBySolidSpan', 'noNonphysicalCornerShortcutOrCrossRoomWall']) {
      tests[k] = NA; notApplicableTests.push(k);
    }
  }

  // diagnostic U=1.6 / U=2 fits
  const minOpen = staticOpenings.length ? Math.min(...staticOpenings.map(o => o.openingAu)) : layout.entrance.openingAu;
  const effClear = minOpen - thickness;
  const roomW = layout.footprint.widthAu / Math.max(1, layout.template.instantiatedCols);
  const roomH = layout.footprint.heightAu / Math.max(1, layout.template.instantiatedRows);
  const fitAtU = CONST.diagnosticU.map(U => ({
    U, frameTiles: [r4(CONST.frame.w / U), r4(CONST.frame.h / U)],
    openingTiles: r4(minOpen / U), effectiveClearTiles: r4(effClear / U),
    wallThicknessTiles: r4(thickness / U), minRoomDimensionTiles: r4(Math.min(roomW, roomH) / U),
    playerProxyTiles: r4(Math.max(...CONST.playerProxyPx) / CONST.tilePx),
    verdict: effClear / U >= Math.max(...CONST.playerProxyPx) / CONST.tilePx && Math.min(roomW, roomH) / U >= 2 ? 'FIT' : 'FAIL',
    status: 'DIAGNOSTIC_ONLY__NOT_APPROVED_SCALE',
  }));
  tests.fitAtDiagnosticU = fitAtU.every(f => f.verdict === 'FIT');

  // Entrance / circulation / roof / retreat / collision / sight adapters must
  // agree with the corrected physical geometry; UNRESOLVED stays UNRESOLVED.
  const roomIds = new Set(layout.rooms.map(r => r.id));
  const wallIds = new Set(layout.walls.map(w => w.id));
  const solidIds = new Set(staticSolids.map(s => s.id));
  const adapterDefects = [];
  if (!wallById.has(layout.entrance.onWallId)) adapterDefects.push('ENTRANCE_PARENT_WALL_MISSING');
  if (entranceOpening && entranceOpening.id !== layout.entrance.id && !layout.portals.some(p => p.id === entranceOpening.id)) adapterDefects.push('ENTRANCE_OPENING_ID_NOT_IN_PARENT_PORTALS');
  for (const id of Object.keys(layout.circulation.depthByRoomId || {})) if (!roomIds.has(id)) adapterDefects.push(`CIRCULATION_UNKNOWN_ROOM_${id}`);
  if (layout.circulation.reachableRooms !== layout.circulation.totalRooms) adapterDefects.push('CIRCULATION_INCOMPLETE_IN_PARENT');
  if (layout.roofCoverage.coveredRoomCount > layout.rooms.length) adapterDefects.push('ROOM_COVERED_ROOM_COUNT_EXCEEDS_ROOMS');
  if (layout.retreat.pathAu === null && layout.retreat.status !== 'UNRESOLVED') adapterDefects.push('RETREAT_NULL_WITHOUT_UNRESOLVED_STATUS');
  if (layout.retreat.pathAu && layout.retreat.pathAu.some(p => p[0] < 0 || p[0] > 2000 || p[1] < 0 || p[1] > 1400)) adapterDefects.push('RETREAT_WAYPOINT_OUTSIDE_FRAME');
  if (solidIds.size !== staticSolids.length) adapterDefects.push('COLLISION_SOLID_ID_COLLISION');
  if (staticSolids.some(s => !wallIds.has(s.parentWallId))) adapterDefects.push('COLLISION_SOLID_WITHOUT_PARENT_WALL');
  if (staticOpenings.some(o => !wallIds.has(o.wallId))) adapterDefects.push('OPENING_WITHOUT_PARENT_WALL');
  if (staticOpenings.some(o => solidIds.has(o.id))) adapterDefects.push('OPENING_ID_COLLIDES_WITH_SOLID');
  if (layout.stableIds.sockets.some(id => !layout.sockets.some(s => s.id === id))) adapterDefects.push('SOCKET_PARENT_ID_LOST');
  if (layout.stableIds.levels.some(id => !layout.levels.some(l => l.id === id))) adapterDefects.push('LEVEL_PARENT_ID_LOST');
  const adapterConsistency = {
    entranceParentWallId: layout.entrance.onWallId,
    entranceOpeningId: entranceOpening ? entranceOpening.id : null,
    circulationRoomIdsResolved: Object.keys(layout.circulation.depthByRoomId || {}).every(id => roomIds.has(id)),
    roofCoveredRoomCount: layout.roofCoverage.coveredRoomCount,
    retreatStatus: layout.retreat.status, retreatPathInvented: false,
    collisionSolidIds: staticSolids.length, sightOpaqueIds: staticSolids.filter(s => s.blocksSight).length,
    staticOpeningIds: staticOpenings.length,
    parentSocketsRetained: layout.stableIds.sockets.length, parentLevelsRetained: layout.stableIds.levels.length,
    defects: adapterDefects, status: adapterDefects.length ? 'INCONSISTENT' : 'CONSISTENT',
    note: 'Retreat UNRESOLVED is preserved, not replaced by an invented corridor. No new socket/level or Gameplay object is authored.',
  };
  tests.adapterConsistency = adapterDefects.length === 0;

  const failedTests = Object.entries(tests).filter(([, v]) => v === false).map(([k]) => k);
  const verdict = failedTests.length ? 'FAIL' : (exceptions.length ? 'VERIFIED_WITH_EXCEPTIONS' : 'VERIFIED');

  return {
    poiId, arche: layout.arche, enclosureClass: layout.enclosureClass, policy,
    sourceRef: layout.sourceRef, parentLayoutSchema: 'soh.map.lr01.poi_layout.v1',
    status: STATUS.PROPOSED,
    ownership: 'MAP owns static solids/openings; GAMEPLAY owns dynamic door state, locks, power, destruction, collision rules and runtime passability.',
    frame: { authoring: CONST.frame, unit: 'authoring_unit', transformStatus: 'UNDECIDED' },
    wallThicknessAu: thickness, wallThicknessStatus: STATUS.PROPOSED,
    openingMarginAu: margin,
    parentIds: { walls: layout.stableIds.walls, rooms: layout.stableIds.rooms, portals: layout.stableIds.portals, entrances: layout.stableIds.entrances, sockets: layout.stableIds.sockets, levels: layout.stableIds.levels },
    idMapping, wallClipAudit, yardPassageIds,
    staticSolids, staticOpenings, openBoundary, portalRecords,
    entryGeometry: { entryCentreAu: entryCentre, exteriorApproachStartAu: exteriorStart ? exteriorStart.map(r4) : null, entranceOpeningId: entranceOpening ? entranceOpening.id : null, fieldStepAu: r4(fieldStep) },
    circulation: {
      lr01Graph: layout.circulation, roomGraphStart: startRoom,
      physicalRoomReach: roomReach, graphReachableRooms: [...graphSeen],
      graphOnlyRooms: graphOnly, physicalOnlyRooms: physicalOnly,
      diagonalOnlyReachableRooms: diagonalExtraRooms,
      physicallyReachableRoomCount: Object.values(roomReach).filter(Boolean).length,
      groundRoomCount: groundRooms.length,
      note: 'Graph BFS is NOT substituted for physical clearance: both are computed and compared.',
    },
    roofCoverage: layout.roofCoverage,
    retreat: { lr01: layout.retreat, consistency: 'RETREAT_WAYPOINTS_RETAINED__NO_NEW_CORRIDOR_INVENTED', status: layout.retreat.status },
    collisionAdapter: {
      staticSolidIds: staticSolids.map(s => s.id), staticOpeningIds: staticOpenings.map(o => o.id),
      nonSolidBoundaryIds: openBoundary.map(b => b.id),
      dynamicCollisionOwner: 'GAMEPLAY',
      status: 'PROPOSED_STATIC_COLLISION_GEOMETRY__NO_RUNTIME_COLLISION_DATA',
    },
    losAdapter: { opaqueSolidIds: staticSolids.filter(s => s.blocksSight).map(s => s.id), transparentOpeningIds: staticOpenings.map(o => o.id), portalSightOwner: 'GAMEPLAY', status: STATUS.PROPOSED },
    fitAtDiagnosticU: fitAtU, adapterConsistency,
    tests, failedTests, notApplicableTests, exceptions, verdict,
    noClaims: [
      'NO dynamic door state, lock, key, power, device or destruction rule',
      'NO runtime resource, loot, cash, vendor, weather or AI',
      'NO approved runtime scale (U=1.6 / U=2 diagnostic only)',
      'NO canonical Veyra rewrite', 'NO playable survival acceptance',
      'NO claim that graph BFS equals physical player clearance',
    ],
  };
}

export function compileAll(layouts, opts = {}) {
  const out = layouts.layouts.map(l => compilePoi(l, opts));
  const counts = {
    pois: out.length,
    verified: out.filter(x => x.verdict === 'VERIFIED').length,
    verifiedWithExceptions: out.filter(x => x.verdict === 'VERIFIED_WITH_EXCEPTIONS').length,
    failed: out.filter(x => x.verdict === 'FAIL').length,
    openYard: out.filter(x => x.policy.id === 'OPEN_YARD').length,
    partialCluster: out.filter(x => x.verdict !== 'FAIL' && x.policy.id === 'PARTIAL_CLUSTER').length,
    fullEnclosure: out.filter(x => x.policy.id === 'FULL_ENCLOSURE').length,
    staticSolids: out.reduce((s, x) => s + x.staticSolids.length, 0),
    staticOpenings: out.reduce((s, x) => s + x.staticOpenings.length, 0),
    invalidPortals: out.reduce((s, x) => s + x.portalRecords.filter(p => p.status === STATUS.INVALID).length, 0),
    unresolvedVerticalLinks: out.reduce((s, x) => s + x.portalRecords.filter(p => p.kind === 'VERTICAL_LINK').length, 0),
    exceptions: out.reduce((s, x) => s + x.exceptions.length, 0),
    testsPass: out.reduce((s, x) => s + Object.values(x.tests).filter(v => v === true).length, 0),
    testsApplicable: out.reduce((s, x) => s + Object.values(x.tests).filter(v => v === true || v === false).length, 0),
    testsNotApplicable: out.reduce((s, x) => s + x.notApplicableTests.length, 0),
    testsTotal: out.reduce((s, x) => s + Object.keys(x.tests).length, 0),
    fitFailPois: out.filter(x => x.fitAtDiagnosticU.some(f => f.verdict === 'FAIL')).map(x => x.poiId),
    missingFit: [],
  };
  counts.missingFit = counts.fitFailPois.length;
  return { pois: out, counts };
}
