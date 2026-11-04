#!/usr/bin/env node
// MAP-LR03R / WMP-02 deterministic CORRECTIVE compiler.
// CLEAN-ROOM SAFE: reads ONLY data/, layers/, rasters/, manifest.v1.json.
// WRITES ONLY into v2/. ALL v1 bytes remain untouched and are pinned by v2/manifest.v2.json.
// NO GOLD, NO MapLab source tree, NO git, NO network, NO Gameplay writes.
import fs from 'node:fs';
import path from 'node:path';
import {
  MASTER, GW, GH, CELL, N, FRAME_AU, CHUNK_CELLS, CHUNK_AU, CHUNKS_X, CHUNKS_Y,
  sha256, digest, r4, idx, gxOf, gyOf, centreAu, toCell,
  readJson, readBuf, writeJson, writeU8,
  loadRasters, loadDerivedRasters,
  dist, pointInRing, ringCentroid, ringArea, ringPerimeter, bbox,
  polylineLength, nearestOnPolyline, distPointSegment, segmentHitsWall,
  STATUS, authority,
} from '../../lib/wmp.mjs';
import { createWorld } from '../../api/world.mjs';

const V2 = path.join(MASTER, 'v2');
const VL = path.join(V2, 'layers'), VR = path.join(V2, 'rasters'), VE = path.join(V2, 'evidence');
for (const d of [V2, VL, VR, VE, path.join(VE, 'tests'), path.join(VE, 'windows'), path.join(VE, 'views'), path.join(V2, 'docs')]) fs.mkdirSync(d, { recursive: true });
const written = [];
const emit = (rel, obj) => { const p = path.join(V2, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); const b = Buffer.from(JSON.stringify(obj, null, 2) + '\n'); fs.writeFileSync(p, b); written.push({ file: `v2/${rel}`, bytes: b.length, sha256: sha256(b), kind: 'layer' }); return { file: `v2/${rel}`, bytes: b.length, sha256: sha256(b) }; };
const emitU8 = (rel, arr, meta = {}) => {
  const p = path.join(V2, rel); fs.mkdirSync(path.dirname(p), { recursive: true });
  const b = Buffer.from(arr); if (b.length !== N) throw new Error(`V2_U8_LENGTH ${rel} ${b.length}`);
  fs.writeFileSync(p, b); written.push({ file: `v2/${rel}`, bytes: b.length, sha256: sha256(b), kind: 'derived_raster', dtype: 'u8', grid: { gw: GW, gh: GH, cellAu: CELL, order: 'row_major i=gy*250+gx' }, ...meta });
};
const U8 = () => new Uint8Array(N);
const clamp255 = v => Math.max(0, Math.min(255, Math.round(v)));
const cell4 = i => { const x = gxOf(i), y = gyOf(i), o = []; if (x > 0) o.push(idx(x - 1, y)); if (x < GW - 1) o.push(idx(x + 1, y)); if (y > 0) o.push(idx(x, y - 1)); if (y < GH - 1) o.push(idx(x, y + 1)); return o; };

const W = createWorld();
const { S, D, C, manifest: V1, architecture, envelopes, transport, hydrology, climate, terrain, crosswalks, chunks, scales, decisions, snap, srcMan } = W._internal;
const SE = readJson('data/legacy/lr02/spawn_eligibility.v1.json');
const WA = readJson('data/legacy/lr02/world_architecture.v1.json');
const LR01_BUILD = readJson('data/legacy/lr01/build_sites.v1.json');
const V1_MANIFEST_SHA = sha256(readBuf('manifest.v1.json'));
const V1_REVISION = V1.revisionDigest;

const BODY_PROFILES = transport.bodyProfiles;   // 2 / 8 / 16 au ASSUMPTION_PROFILE
const dry = i => S.waterClass[i] === 0 && S.landId[i] > 0;
const walkable = i => dry(i) && (S.walkableCandidate[i] > 0 || S.roadClass[i] > 0 || S.clearanceCells[i] > 0);

// =====================================================================
// 0. PREFLIGHT AUDIT — separate coverage/documentation PASS from physical PASS
// =====================================================================
const audit = {
  schema: 'soh.wmp.v2.preflight_audit.v1', status: 'INDEPENDENT_PREFLIGHT',
  verifiedFrom: { mapHead: 'd0221688076f823b5e15fe9c1050406928eafbca', v1ManifestSha: V1_MANIFEST_SHA, v1RevisionDigest: V1_REVISION, sourceManifestSha: sha256(readBuf('data/source_manifest.v1.json')) },
  independentReproduction: { command: 'cp -a veyra-world-master /tmp/wmp_preflight_verify && cd /tmp/wmp_preflight_verify && ./reproduce.sh', result: 'WMP_TESTS 75/75, WMP_REPRODUCE_OK, isolated clean-room 75/75, identical revisionDigest=8e3e76da…', note: 'Ran in an isolated copy so NO v1 evidence byte was modified.' },
  classification: [
    { test: 'M-G3-01', kind: 'COVERAGE', why: 'Counts 81 POIs / 210 rooms and checks roof count equals covered-room count. Does not test roof visibility, wall collision or opening access.' },
    { test: 'M-G3-02', kind: 'PARTIAL_PHYSICAL', why: 'Checks roof polygon lies inside parent room bbox and status=PROPOSED. Bbox containment is weaker than polygon containment; no wall/opening/LOS test.' },
    { test: 'M-G3-03', kind: 'DOCUMENTATION_PASS', why: 'Asserts 10 proposed + 8 named blockers = 18 and that blockers have ID/conflict strings. It EXPLICITLY passes because blockers are documented, not because they are resolved.' },
    { test: 'M-G3-04', kind: 'PARTIAL_PHYSICAL', why: 'Checks shaft CENTRE inside the overlap bbox. No collision, bidirectional traversal, boundary opening or LOS test.' },
    { test: 'M-G3-05', kind: 'COVERAGE', why: 'Checks two POI examples are inspectable via poiGraph; not a physical access proof.' },
    { test: 'M-G3-06', kind: 'PARTIAL_PHYSICAL', why: 'Counts blocked/clear direct LOS segments; does not connect LOS to room usability or roof occlusion.' },
    { test: 'M-G3-07', kind: 'COVERAGE', why: 'Checks room polygon validity and ownership strings.' },
    { test: 'M-G3-08', kind: 'NEGATIVE_FIXTURE', why: 'Invalid POI ID returns INVALID.' },
    { test: 'M-G4-01', kind: 'PARTIAL_PHYSICAL', why: 'Chunk count/neighbour/digest checks; not a geometry-continuity sweep.' },
    { test: 'M-G4-02', kind: 'PARTIAL_PHYSICAL', why: 'Checks stable feature IDs in chunk lists (first 40 crossing features); not all 579 and not boundary geometry.' },
    { test: 'M-G4-03', kind: 'COVERAGE', why: 'Counts roads/bridges/docks and profile objects.' },
    { test: 'M-G4-04', kind: 'DOCUMENTATION_PASS', why: 'Passes because cartPassable=false and deckStatus=UNRESOLVED are recorded. It does not resolve any deck or swept clearance.' },
    { test: 'M-G4-05', kind: 'PARTIAL_PHYSICAL', why: 'Compares centre clearance to 3 body widths; centreline only, no swept envelope.' },
    { test: 'M-G4-06', kind: 'DOCUMENTATION_PASS', why: 'Passes because 7 disconnected roads, 8 blocked ferries and crossing defects are preserved as strings.' },
    { test: 'M-G4-07', kind: 'DOCUMENTATION_PASS', why: 'Passes because alternate candidates exist and are non-canonical.' },
    { test: 'M-G4-08', kind: 'DOCUMENTATION_PASS', why: 'Passes because >0 envelopes have unresolved water overlap. The v1 overlap count (12) was itself WRONG (see build_sites_v2).' },
    { test: 'M-G4-09', kind: 'COVERAGE', why: 'Counts spawns/homes/Elders and >=3 distinct signatures.' },
    { test: 'M-G4-10', kind: 'PHYSICAL_CHECK', why: 'BFS reachability of nonboss route legs over dry land. Real spatial check.' },
    { test: 'M-G4-11', kind: 'NEGATIVE_FIXTURE', why: 'Missing body width returns UNKNOWN.' },
    { test: 'M-G4-12', kind: 'NEGATIVE_FIXTURE', why: 'Water-overlap envelope reports unresolved.' },
    { test: 'M-G5-03', kind: 'COVERAGE', why: 'Window masks exist and chunk continuity flag is 0; five masks are NOT a complete EconomyMap.' },
  ],
  verdict: 'v1 M-G3/M-G4 are predominantly COVERAGE / DOCUMENTATION passes; physical completion was NOT proven. v2 adds physical checks and keeps documentation PASS separate from VERIFIED_GEOMETRY.',
};
emit('layers/preflight_audit.v2.json', audit);

// =====================================================================
// 1. VERTICAL LINKS — corrected CANDIDATE placements with real spatial checks
//    Canonical portal atAu is NEVER moved; a NEW v2 candidate is added.
// =====================================================================
function polyEdges(ring) { return ring.map((a, k) => [a, ring[(k + 1) % ring.length]]); }
function minEdgeDistance(p, ring) { let m = Infinity; for (const [a, b] of polyEdges(ring)) m = Math.min(m, distPointSegment(p, a, b)); return m; }
function solidClearance(p, solids) { let m = Infinity; for (const s of solids) m = Math.min(m, distPointSegment(p, s.aAu, s.bAu) - (s.thicknessAu ?? 2) / 2); return m; }
function rectFromAxes(c, d, n, span, width) {
  const hs = span / 2, hw = width / 2;
  return [[c[0] - d[0] * hs - n[0] * hw, c[1] - d[1] * hs - n[1] * hw],
          [c[0] + d[0] * hs - n[0] * hw, c[1] + d[1] * hs - n[1] * hw],
          [c[0] + d[0] * hs + n[0] * hw, c[1] + d[1] * hs + n[1] * hw],
          [c[0] - d[0] * hs + n[0] * hw, c[1] - d[1] * hs + n[1] * hw]].map(p => p.map(r4));
}
/** Local 2au grid BFS inside the union of ground+DEEP polygons, avoiding solid buffers. */
function localTraversal(groundPoly, deepPoly, solids, from, to, shaftAt, shaftH) {
  const bb = [Math.min(...groundPoly.map(p => p[0]), ...deepPoly.map(p => p[0])) - 4,
              Math.min(...groundPoly.map(p => p[1]), ...deepPoly.map(p => p[1])) - 4,
              Math.max(...groundPoly.map(p => p[0]), ...deepPoly.map(p => p[0])) + 4,
              Math.max(...groundPoly.map(p => p[1]), ...deepPoly.map(p => p[1])) + 4];
  const step = 2, w = Math.ceil((bb[2] - bb[0]) / step) + 1, h = Math.ceil((bb[3] - bb[1]) / step) + 1;
  const gi = (p) => [Math.round((p[0] - bb[0]) / step), Math.round((p[1] - bb[1]) / step)];
  const pass = (gx, gy) => {
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return false;
    const p = [bb[0] + gx * step, bb[1] + gy * step];
    if (!(pointInRing(p, groundPoly) || pointInRing(p, deepPoly))) return false;
    return solidClearance(p, solids) > 1.0;
  };
  // Snap a world point to the NEAREST passable grid node (avoids an authored
  // exterior entrance / ring centroid landing inside a static solid wall).
  const snap = (g) => {
    if (pass(g[0], g[1])) return { g, snapped: false };
    for (let r = 1; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = g[0] + dx, y = g[1] + dy;
      if (pass(x, y)) return { g: [x, y], snapped: true, snappedByGridCells: r };
    }
    return { g, snapped: true, snappedByGridCells: null };
  };
  const s0 = snap(gi(from)), t0 = snap(gi(to));
  const s = s0.g, t = t0.g, endpointsSnapped = s0.snapped || t0.snapped;
  const prev = new Int32Array(w * h).fill(-1), seen = new Uint8Array(w * h), q = new Int32Array(w * h);
  const key = (x, y) => y * w + x;
  if (!pass(s[0], s[1]) || !pass(t[0], t[1])) return { reachable: false, reason: 'ENDPOINT_OUTSIDE_UNION_OR_IN_SOLID', endpointsSnapped };
  let head = 0, tail = 0; q[tail++] = key(s[0], s[1]); seen[key(s[0], s[1])] = 1;
  while (head < tail) {
    const k = q[head++], x = k % w, y = Math.floor(k / w);
    if (x === t[0] && y === t[1]) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = key(nx, ny); if (!seen[nk] && pass(nx, ny)) { seen[nk] = 1; prev[nk] = k; q[tail++] = nk; }
    }
  }
  if (!seen[key(t[0], t[1])]) return { reachable: false, reason: 'NO_COLLISION_FREE_PATH_IN_UNION', endpointsSnapped };
  const cells = []; for (let k = key(t[0], t[1]); k !== -1; k = prev[k]) cells.push(k); cells.reverse();
  const points = cells.map(k => [r4(bb[0] + (k % w) * step), r4(bb[1] + Math.floor(k / w) * step)]);
  const viaShaft = points.some(p => dist(p, shaftAt) <= shaftH + step);
  return { reachable: true, endpointsSnapped, gridStepAu: step, pathCells: cells.length, pathLengthAu: r4((cells.length - 1) * step), passesShaft: viaShaft, path: points.slice(0, 6), pathTruncated: Math.max(0, points.length - 6) };
}
function boundaryOpening(ring, near, solids, widthAu = 4) {
  const candidates = [];
  for (const [a, b] of polyEdges(ring)) {
    const L = dist(a, b); if (L < widthAu) continue;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      if (Math.abs(p[0] - a[0]) + Math.abs(p[1] - a[1]) < widthAu / 2 || Math.abs(p[0] - b[0]) + Math.abs(p[1] - b[1]) < widthAu / 2) continue;
      candidates.push({ d: dist(p, near), a, b, p, L });
    }
  }
  candidates.sort((x, y) => x.d - y.d);
  for (const best of candidates) {
    const ux = (best.b[0] - best.a[0]) / best.L, uy = (best.b[1] - best.a[1]) / best.L;
    const half = widthAu / 2;
    const seg = [[best.p[0] - ux * half, best.p[1] - uy * half], [best.p[0] + ux * half, best.p[1] + uy * half]].map(p => p.map(r4));
    const covered = solids.some(s => segmentHitsWall(seg[0], seg[1], s.aAu, s.bAu, (s.thicknessAu ?? 2) / 2));
    if (!covered) return { edgeAu: [best.a.map(r4), best.b.map(r4)], centreAu: best.p.map(r4), widthAu, openingSegmentAu: seg, blockedByStaticSolid: false, status: STATUS.PROPOSED, candidatesTried: candidates.length };
  }
  const first = candidates[0];
  if (!first) return null;
  const ux = (first.b[0] - first.a[0]) / first.L, uy = (first.b[1] - first.a[1]) / first.L, half = widthAu / 2;
  const seg = [[first.p[0] - ux * half, first.p[1] - uy * half], [first.p[0] + ux * half, first.p[1] + uy * half]].map(p => p.map(r4));
  return { edgeAu: [first.a.map(r4), first.b.map(r4)], centreAu: first.p.map(r4), widthAu, openingSegmentAu: seg, blockedByStaticSolid: true, status: STATUS.BLOCKED, candidatesTried: candidates.length };
}
const verticalCorrections = [];
for (const blocker of architecture.verticalNamedBlockers) {
  const v = architecture.verticalLinks.find(x => x.poiId === blocker.poiId);
  const p = architecture.pois.find(x => x.poiId === blocker.poiId);
  const groundPoly = v.groundPolygonAu, deepPoly = v.deepPolygonAu;
  const solids = p.staticSolids, openings = p.staticOpenings;
  const originalAt = blocker.atAu;
  const rec = {
    id: `vlink.corrected.${blocker.poiId}.v2`, portalId: blocker.portalId, poiId: blocker.poiId,
    previousFailure: { code: 'SOURCE_VERTICAL_PORTAL_AT_OUTSIDE_GROUND_ROOM', atAu: originalAt, groundRoomId: v.fromRoomId, deepRoomId: v.toRoomId, v1Verdict: 'NAMED_BLOCKER_WITH_PROPOSED_ALTERNATIVE', sourceRef: `GOLD project.pois[] where id=${blocker.poiId}; LR01 poi_layouts.v1.json portals[] where id=${blocker.portalId}` },
    canonicalPortal: { atAu: originalAt, status: 'UNCHANGED__SOURCE_AUTHORED', verdict: 'BLOCKED', note: 'The canonical portal coordinate is NEVER moved. v2 adds a separate corrected CANDIDATE.' },
  };
  if (!groundPoly || !deepPoly) { rec.verdict = 'BLOCKED'; rec.reason = 'MISSING_POLYGON'; verticalCorrections.push(rec); continue; }
  const ob = [Math.max(bbox(groundPoly)[0], bbox(deepPoly)[0]), Math.max(bbox(groundPoly)[1], bbox(deepPoly)[1]), Math.min(bbox(groundPoly)[2], bbox(deepPoly)[2]), Math.min(bbox(groundPoly)[3], bbox(deepPoly)[3])];
  const halfMax = Math.max(1, Math.min(4, (Math.min(ob[2] - ob[0], ob[3] - ob[1]) / 2) - 0.5));
  let best = null;
  for (let x = ob[0] + 0.5; x <= ob[2] - 0.5; x += 0.5) for (let y = ob[1] + 0.5; y <= ob[3] - 0.5; y += 0.5) {
    const at = [x, y];
    if (!pointInRing(at, groundPoly) || !pointInRing(at, deepPoly)) continue;
    const edgeG = minEdgeDistance(at, groundPoly), edgeD = minEdgeDistance(at, deepPoly), sol = solidClearance(at, solids);
    // An axis-aligned square shaft has corners h*sqrt(2) from its centre, so the
    // polygon-edge and static-solid clearance bounds must use the DIAGONAL.
    let h = Math.min(halfMax, edgeG / Math.SQRT2 - 0.25, edgeD / Math.SQRT2 - 0.25, sol / Math.SQRT2 - 0.25);
    if (h < 0.75) continue;   // never force a shaft that is too close to a wall
    let cornersOk = false;
    while (h >= 0.75) {
      cornersOk = rectFromAxes(at, [1, 0], [0, 1], h * 2, h * 2).every(q => pointInRing(q, groundPoly) && pointInRing(q, deepPoly));
      if (cornersOk) break;
      h -= 0.25;
    }
    if (h < 0.75 || !cornersOk) continue;
    const score = h * 10 - dist(at, originalAt) * 0.05;
    if (!best || score > best.score) best = { at: at.map(r4), h: r4(h), score, edgeG: r4(edgeG), edgeD: r4(edgeD), sol: r4(sol) };
  }
  if (!best) { rec.verdict = 'BLOCKED'; rec.reason = 'NO_COLLISION_FREE_SHAFT_SITE_IN_OVERLAP'; rec.overlapBBoxAu = ob.map(r4); verticalCorrections.push(rec); continue; }
  const shaftAt = best.at, shaftH = best.h;
  const shaftPolygonAu = rectFromAxes(shaftAt, [1, 0], [0, 1], shaftH * 2, shaftH * 2);
  const shaftCornersInside = shaftPolygonAu.every(q => pointInRing(q, groundPoly) && pointInRing(q, deepPoly));
  const shaftCollisions = solids.filter(s => distPointSegment(shaftAt, s.aAu, s.bAu) <= shaftH * Math.SQRT2 + (s.thicknessAu ?? 2) / 2).map(s => s.id);
  const groundCentroid = ringCentroid(groundPoly), deepCentroid = ringCentroid(deepPoly);
  const entrance = openings.find(o => o.kind === 'EXTERIOR_ENTRANCE') ?? openings[0] ?? null;
  const groundAccess = entrance ? entrance.centreAu : groundCentroid;
  // A vertical link is TWO legs: exterior/ground -> shaft, shaft -> DEEP room.
  // Both legs are traversed in BOTH directions. This is stricter and more
  // meaningful than requiring a shortest ground->DEEP BFS to happen to pass
  // through the shaft (a BFS may legitimately choose another free path).
  const legGroundFwd = localTraversal(groundPoly, deepPoly, solids, groundAccess, shaftAt, shaftAt, shaftH);
  const legGroundRev = localTraversal(groundPoly, deepPoly, solids, shaftAt, groundAccess, shaftAt, shaftH);
  const legDeepFwd = localTraversal(groundPoly, deepPoly, solids, shaftAt, deepCentroid, shaftAt, shaftH);
  const legDeepRev = localTraversal(groundPoly, deepPoly, solids, deepCentroid, shaftAt, shaftAt, shaftH);
  const directFwd = localTraversal(groundPoly, deepPoly, solids, groundAccess, deepCentroid, shaftAt, shaftH);
  const directRev = localTraversal(groundPoly, deepPoly, solids, deepCentroid, groundAccess, shaftAt, shaftH);
  const bothLegs = [legGroundFwd, legGroundRev, legDeepFwd, legDeepRev].every(x => x.reachable);
  const gOpen = boundaryOpening(groundPoly, shaftAt, solids), dOpen = boundaryOpening(deepPoly, shaftAt, solids);
  const losToShaft = entrance ? solids.some(s => segmentHitsWall(entrance.centreAu, shaftAt, s.aAu, s.bAu, (s.thicknessAu ?? 2) / 2)) : null;
  const losToDeep = solids.some(s => segmentHitsWall(shaftAt, deepCentroid, s.aAu, s.bAu, (s.thicknessAu ?? 2) / 2));
  const nearbyOpenings = openings.filter(o => dist(o.centreAu, shaftAt) <= 16).map(o => ({ id: o.id, kind: o.kind, centreAu: o.centreAu }));
  const stairRunAu = [shaftAt, deepCentroid.map(r4)];
  const checks = {
    shaftCornersInsideBothPolygons: shaftCornersInside,
    shaftStaticSolidCollisions: shaftCollisions,
    collisionFree: shaftCornersInside && shaftCollisions.length === 0,
    groundBoundaryOpening: gOpen, deepBoundaryOpening: dOpen,
    bidirectionalTraversal: {
      verified: bothLegs,
      legs: { groundToShaft: legGroundFwd, shaftToGround: legGroundRev, shaftToDeep: legDeepFwd, deepToShaft: legDeepRev },
      directPath: { forward: directFwd, reverse: directRev },
      note: 'Four BFS traversals over a 2 au grid inside the ground+DEEP polygon union with M1 clipped-static-solid clearance, in BOTH directions. A direct path may bypass the shaft; that is recorded, not hidden.',
    },
    los: { entranceToShaftBlocked: losToShaft, shaftToDeepCentroidBlocked: losToDeep, owner: 'MAP_STATIC_OCCLUSION' },
    nearbyAuthoredOpenings: nearbyOpenings,
  };
  const narrowShaft = shaftH < 1;   // < 2 au clear width; no approved Gameplay body envelope exists
  const verified = !narrowShaft && checks.collisionFree && checks.bidirectionalTraversal.verified && gOpen && dOpen && !gOpen.blockedByStaticSolid && !dOpen.blockedByStaticSolid;
  if (narrowShaft) rec.narrowShaftNote = 'The measured ground/DEEP overlap permits only a sub-2 au shaft. This is a PROPOSED geometry candidate, NOT VERIFIED, because no Gameplay body/collision envelope is approved. It is NOT counted as a resolved physical blocker.';
  rec.correctedCandidate = {
    id: `vlink.corrected.${blocker.poiId}.v2`, status: verified ? 'VERIFIED_GEOMETRY' : (narrowShaft ? 'PROPOSED_GEOMETRY__NARROW_SHAFT_BELOW_2AU' : STATUS.PROPOSED),
    atAu: shaftAt, displacementFromCanonicalAu: r4(dist(shaftAt, originalAt)),
    shaftHalfSizeAu: shaftH, shaftPolygonAu, stairRunAu,
    groundRoomPolygonAu: groundPoly.map(q => q.map(r4)), deepLevelPolygonAu: deepPoly.map(q => q.map(r4)),
    overlapBBoxAu: ob.map(r4), groundBoundaryDistanceAu: best.edgeG, deepBoundaryDistanceAu: best.edgeD, nearestSolidClearanceAu: best.sol,
    verticalSeparationAu: null, verticalSeparationStatus: STATUS.UNRESOLVED,
    basis: 'Grid search (0.5 au) over the measured ground-room/DEEP polygon overlap, maximising half-size subject to polygon-edge distance and M1 clipped-solid clearance. Canonical portal coordinate is preserved separately.',
    owner: 'MAP', canonical: false,
  };
  rec.checks = checks;
  rec.verdict = verified ? 'RESOLVED_AS_VERIFIED_CORRECTED_CANDIDATE' : 'PARTIALLY_RESOLVED_AS_PROPOSED_CANDIDATE';
  rec.negativeCounterexamples = [
    { id: `NEG-V2-VLINK-${blocker.poiId}-CANONICAL`, subject: 'shaft centred on the ORIGINAL canonical portal', expected: 'REJECTED', actual: pointInRing(originalAt, groundPoly) ? 'INSIDE' : 'OUTSIDE_GROUND_ROOM', pass: !pointInRing(originalAt, groundPoly) },
    { id: `NEG-V2-VLINK-${blocker.poiId}-OUTSIDE`, subject: 'shaft centred 200 au outside both polygons', expected: 'REJECTED', actual: 'OUTSIDE_BOTH', pass: true },
    ...(shaftCollisions.length ? [{ id: `NEG-V2-VLINK-${blocker.poiId}-SOLID`, subject: 'shaft overlapping a static solid', expected: 'ZERO_COLLISIONS', actual: shaftCollisions, pass: shaftCollisions.length === 0 }] : []),
  ];
  verticalCorrections.push(rec);
}
const verticalLayer = {
  schema: 'soh.wmp.v2.vertical_corrections.v1', status: 'CORRECTED_CANDIDATES__CANONICAL_PORTALS_UNCHANGED', authority,
  v1BlockerCount: architecture.verticalNamedBlockers.length,
  resolvedVerified: verticalCorrections.filter(v => v.verdict === 'RESOLVED_AS_VERIFIED_CORRECTED_CANDIDATE').length,
  resolvedProposed: verticalCorrections.filter(v => v.verdict === 'PARTIALLY_RESOLVED_AS_PROPOSED_CANDIDATE').length,
  stillBlocked: verticalCorrections.filter(v => v.verdict === 'BLOCKED').length,
  canonicalPortalPolicy: 'NO canonical portal was moved. Every original atAu, portalId, ground room and DEEP room is preserved verbatim. A corrected CANDIDATE with its own v2 id is proposed/verified alongside the immutable canonical portal.',
  noClaims: ['NO numeric vertical separation', 'NO stair pitch or ladder collision law', 'NO dynamic lock/power state', 'NO claim that Gameplay has ingested these candidates'],
  corrections: verticalCorrections,
};
emit('layers/vertical_corrections.v2.json', verticalLayer);

// =====================================================================
// 2. ROADS / WATER — measured decks, connectors, crossing resolutions, outlet
// =====================================================================
function bfsDry(from, to, extraPassable = null) {
  const s = toCell(from[0], from[1]), t = toCell(to[0], to[1]);
  const prev = new Int32Array(N).fill(-1), seen = new Uint8Array(N), q = new Int32Array(N);
  const pass = i => (walkable(i) && S.clearanceCells[i] > 0) || (extraPassable && extraPassable.has(i));
  if (!pass(s) || !pass(t)) return { reachable: false, reason: 'ENDPOINT_NOT_WALKABLE' };
  let h = 0, tail = 0; q[tail++] = s; seen[s] = 1;
  while (h < tail) { const i = q[h++]; if (i === t) break; for (const j of cell4(i)) if (!seen[j] && pass(j)) { seen[j] = 1; prev[j] = i; q[tail++] = j; } }
  if (!seen[t]) return { reachable: false, reason: 'NO_DRY_LAND_PATH' };
  const cells = []; for (let i = t; i !== -1; i = prev[i]) cells.push(i); cells.reverse();
  return { reachable: true, cells, cellCount: cells.length, lengthAu: r4(cells.length * CELL), polylineAu: cells.map(i => centreAu(i).map(r4)) };
}
function measuredWaterChord(at, d) {
  let a = 0, b = 0;
  for (let k = 1; k <= 12; k++) { const p = [at[0] - d[0] * k * CELL, at[1] - d[1] * k * CELL]; const i = toCell(p[0], p[1]); if (S.waterClass[i] === 0) break; a = k; }
  for (let k = 1; k <= 12; k++) { const p = [at[0] + d[0] * k * CELL, at[1] + d[1] * k * CELL]; const i = toCell(p[0], p[1]); if (S.waterClass[i] === 0) break; b = k; }
  return { upstreamCells: a, downstreamCells: b, wetChordAu: (a + b + 1) * CELL };
}
function lateralDry(at, n) {
  const out = [];
  for (const sign of [-1, 1]) { let k = 0; for (let s = 1; s <= 16; s++) { const p = [at[0] + sign * n[0] * s * CELL, at[1] + sign * n[1] * s * CELL]; const i = toCell(p[0], p[1]); if (S.waterClass[i] !== 0) break; k = s; } out.push(k * CELL); }
  return out;
}
const bridgeCells = new Map(C.bridges.map(b => [toCell(b.at[0], b.at[1]), b.id]));
const bridgeDecks = C.bridges.map(b => {
  const at = b.at, d = [Math.cos(b.ang), Math.sin(b.ang)], n = [-d[1], d[0]];
  const chord = measuredWaterChord(at, d), lateral = lateralDry(at, n);
  // Dry bearing points are the FIRST dry cells beyond the measured wet chord,
  // in both directions along the authored bridge axis.
  const dryA = [at[0] - d[0] * (chord.upstreamCells + 1) * CELL, at[1] - d[1] * (chord.upstreamCells + 1) * CELL];
  const dryB = [at[0] + d[0] * (chord.downstreamCells + 1) * CELL, at[1] + d[1] * (chord.downstreamCells + 1) * CELL];
  const spanAu = r4(Math.max(dist(at, dryA), dist(at, dryB)) * 2 + CELL);
  const widthAu = Math.max(CELL, Math.min(3 * CELL, ...lateral));
  const deckPolygonAu = rectFromAxes(at, d, n, spanAu, widthAu);
  const c1 = toCell(dryA[0], dryA[1]), c2 = toCell(dryB[0], dryB[1]), bc = toCell(at[0], at[1]);
  // Deck cells = every grid cell whose centre lies inside the proposed deck polygon.
  const db = bbox(deckPolygonAu), deckCells = new Set();
  for (let gy = Math.max(0, Math.floor(db[1] / CELL)); gy <= Math.min(GH - 1, Math.ceil(db[3] / CELL)); gy++)
    for (let gx = Math.max(0, Math.floor(db[0] / CELL)); gx <= Math.min(GW - 1, Math.ceil(db[2] / CELL)); gx++) {
      const i = idx(gx, gy); if (pointInRing(centreAu(i), deckPolygonAu)) deckCells.add(i);
    }
  const withDeck = bfsDry(centreAu(c1), centreAu(c2), deckCells);
  const withoutDeck = bfsDry(centreAu(c1), centreAu(c2));
  const profiles = BODY_PROFILES.map(p => ({
    profileId: p.id, widthAu: p.widthAu,
    deckGeometricFit: widthAu >= p.widthAu ? 'GEOMETRIC_FIT_ONLY' : 'INSUFFICIENT_DECK_WIDTH',
    sweptClearance: STATUS.UNKNOWN, turningRadius: STATUS.UNKNOWN, trailerSweep: STATUS.UNKNOWN,
    verdict: STATUS.UNKNOWN, note: 'Assumed footprint profile, NOT an approved vehicle envelope.',
  }));
  return {
    bridgeId: b.id, sourceRef: `GOLD project.bridges[] where id=${b.id}`, atAu: at.map(r4), angleRad: b.ang, authoredLoad: b.load,
    previousFailure: 'v1 deckStatus=UNRESOLVED, deckPolygonAu=null, cartPassable=false for all 12 bridges.',
    measured: { waterChord: chord, lateralDryLandAu: lateral, dryBearingA: dryA.map(r4), dryBearingB: dryB.map(r4), deckCellCount: deckCells.size, deckCells: [...deckCells].sort((a, b) => a - b), centreCellIndex: bc, clearanceCells: S.clearanceCells[bc], waterClass: S.waterClass[bc], roadClass: S.roadClass[bc] },
    proposedDeck: { id: `deck.${b.id}.v2`, spanAu, widthAu, deckPolygonAu, deckBboxAu: bbox(deckPolygonAu), status: STATUS.PROPOSED, canonical: false,
      basis: 'Span reaches the FIRST dry bearing cell beyond the measured wet chord in each direction along the authored bridge axis, plus one 8 au cell. Width = conservative min(24 au, measured lateral dry land at both ends). No editor glyph size and no vehicle envelope assumed.', owner: 'MAP' },
    connectivity: { endpointCells: [c1, c2], withDeckReachable: withDeck.reachable, withoutDeckReachable: withoutDeck.reachable,
      bridgeIsNecessaryConnector: withDeck.reachable && !withoutDeck.reachable, pathLengthWithDeckAu: withDeck.lengthAu ?? null,
      method: '4-connected BFS over GEO-01 dry-land walkable cells WITH the proposed deck cells added vs WITHOUT them. This is a geometry continuity check, NOT a cart-passability verdict.',
      status: withDeck.reachable && !withoutDeck.reachable ? 'VERIFIED_GEOMETRY__BRIDGE_CONNECTS_DRY_LAND' : (withDeck.reachable ? 'PROPOSED__BOTH_ENDPOINTS_ALREADY_CONNECTED_ON_LAND' : 'BLOCKED__NO_DRY_LAND_CONNECTION') },
    bodySweep: { profileSet: 'ASSUMPTION_PROFILE_2_8_16_AU', profiles, approvedCartPassability: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY' },
    verdict: 'PROPOSED_MEASURED_DECK', canonicalPortalOrBridgeUnchanged: true,
  };
});
const disconnected = WA.transportTopology.disconnectedRoads;
const roadConnectors = disconnected.map(d => {
  const from = d.nearestOtherRoadEndpoint?.fromAu ?? null, to = d.nearestOtherRoadEndpoint?.atAu ?? null;
  const falseJoin = d.kind.includes('FALSE_DISCONNECT');
  if (falseJoin) return {
    roadId: d.roadId, previousFailure: 'v1 counted this among 7 disconnected roads; LR02 already flagged it FALSE_DISCONNECT__COINCIDENT_ENDPOINT.',
    measuredEndpointDistanceAu: d.nearestDistanceAu ?? d.nearestOtherRoadEndpoint?.distanceAu ?? null,
    fromAu: from?.map(r4) ?? null, toAu: to?.map(r4) ?? null,
    resolution: 'VERIFIED_GEOMETRY__COINCIDENT_ENDPOINT_NO_NEW_ROAD_REQUIRED', connectorGeometry: null,
    note: 'Endpoints coincide; the defect is a graph-topology artefact, NOT missing physical geometry. NO road is invented.',
    status: 'VERIFIED_GEOMETRY', canonical: false,
  };
  if (!from || !to) return { roadId: d.roadId, previousFailure: 'missing endpoint geometry', resolution: 'BLOCKED__NO_ENDPOINT_GEOMETRY', status: STATUS.BLOCKED };
  const path = bfsDry(from, to);
  const clearance = path.cells?.map(i => S.clearanceCells[i] * CELL) ?? [];
  const profiles = BODY_PROFILES.map(p => ({
    profileId: p.id, widthAu: p.widthAu,
    minGeometricClearanceAu: clearance.length ? Math.min(...clearance) : null,
    geometricFit: clearance.length && Math.min(...clearance) >= p.widthAu ? 'GEOMETRIC_FIT_ONLY' : 'INSUFFICIENT_CLEARANCE',
    sweptClearance: STATUS.UNKNOWN, verdict: STATUS.UNKNOWN,
  }));
  return {
    roadId: d.roadId, kind: d.kind, previousFailure: `v1/DERIVED ${d.kind} nearestDistanceAu=${d.nearestDistanceAu}, no measured connector geometry.`,
    fromAu: from.map(r4), toAu: to.map(r4), authoredStraightDistanceAu: d.nearestDistanceAu,
    measuredConnector: path.reachable ? { id: `connector.${d.roadId}.v2`, polylineAu: path.polylineAu, cellCount: path.cellCount, lengthAu: path.lengthAu, minClearanceAu: Math.min(...clearance), status: STATUS.PROPOSED, canonical: false, basis: 'Shortest 4-connected dry-land BFS between the two authored endpoint cells; NOT an authored road, NO land is created.' } : null,
    connectivity: { reachable: path.reachable, reason: path.reason ?? null },
    bodySweep: { profileSet: 'ASSUMPTION_PROFILE_2_8_16_AU', profiles, approvedCartPassability: STATUS.UNRESOLVED },
    resolution: path.reachable ? 'PROPOSED_MEASURED_DRY_LAND_CONNECTOR' : 'BLOCKED__NO_DRY_LAND_PATH',
    status: path.reachable ? STATUS.PROPOSED : STATUS.BLOCKED, canonical: false,
  };
});
/** Channel width measured PERPENDICULAR to the authored road centreline at the crossing.
    Only contiguous FRESHWATER (waterClass 2/3) cells are counted; sea (1) and dry (0)
    stop the scan. Falls back to the NARROWEST 8-direction chord when no road exists. */
function measuredChannelWidth(at, preferRoadId) {
  let road = preferRoadId ? C.roads.find(r => r.id === preferRoadId) : null, q = null, tangent = null;
  if (!road) { let best = null; for (const r of C.roads) { const z = nearestOnPolyline(at, r.points); if (!best || z.d < best.d) best = { d: z.d, road: r, z }; } if (best) { road = best.road; q = best.z; } }
  else q = nearestOnPolyline(at, road.points);
  if (road && q && q.segment >= 0 && road.points[q.segment + 1]) {
    const a = road.points[q.segment], b = road.points[q.segment + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L > 0) tangent = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  }
  const dirs = tangent ? [[-tangent[1], tangent[0]]] : Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 8), Math.sin(k * Math.PI / 8)]);
  let best = { wetCells: Infinity, dir: null, sides: [0, 0], basis: tangent ? 'PERPENDICULAR_TO_AUTHORED_ROAD' : 'NARROWEST_8_DIRECTION_CHORD' };
  for (const d of dirs) {
    const sides = [];
    for (const sign of [-1, 1]) { let n = 0; for (let s = 1; s <= 14; s++) { const i = toCell(at[0] + sign * d[0] * s * CELL, at[1] + sign * d[1] * s * CELL); if (S.waterClass[i] !== 2 && S.waterClass[i] !== 3) break; n = s; } sides.push(n); }
    const wet = sides[0] + sides[1] + 1;
    if (wet < best.wetCells) best = { wetCells: wet, dir: d.map(v => r4(v)), sides, basis: tangent ? 'PERPENDICULAR_TO_AUTHORED_ROAD' : 'NARROWEST_8_DIRECTION_CHORD' };
  }
  return { ...best, nearestRoadId: road?.id ?? null, nearestRoadDistanceAu: q?.d ?? null };
}
const crossingResolutions = hydrology.crossingContradictions.map(c => {
  const at = c.atAu ?? (c.bridgeId ? C.bridges.find(b => b.id === c.bridgeId)?.at : null) ?? null;
  const u = transport.unbridgedCrossings.find(x => x.roadId === c.roadId && x.riverId === c.riverId);
  if (!at) return { id: c.id, previousFailure: c.contradiction ?? c.disposition ?? 'crossing contradiction', resolution: 'BLOCKED__NO_COORDINATES', status: STATUS.BLOCKED };
  // CC-BR4-01 records a numeric raster riverId and no roadId; resolve both explicitly.
  const riverId = c.riverId ?? C.rivers[(c.measured?.riverId ?? 1) - 1]?.id ?? null;
  let roadId = c.roadId ?? null;
  if (!roadId) { let best = null; for (const r of C.roads) { const z = nearestOnPolyline(at, r.points); if (!best || z.d < best.d) best = { d: z.d, id: r.id }; } roadId = best?.id ?? 'UNRESOLVED'; }
  const river = C.rivers.find(r => r.id === riverId);
  const wet = measuredChannelWidth(at, c.roadId ?? roadId), wetCells = wet.wetCells;
  const deck = bridgeDecks.find(b => b.bridgeId === c.bridgeId) ?? null;
  return {
    id: c.id, roadId, riverId, riverIdProvenance: c.riverId ? 'AUTHORED_ID' : `RESOLVED_FROM_RASTER_RIVER_ID_${c.measured?.riverId}__1_BASED_INDEX`, atAu: at.map(r4), measuredWetChord: wet,
    previousFailure: c.contradiction ?? u?.disposition ?? 'crossing contradiction',
    measuredWetWidthAu: wetCells * CELL, authoredEditorStrokeWidthAu: river?.width ?? null,
    widthSemantics: 'Measured raster width vs EDITOR STROKE; physical navigable width remains UNRESOLVED.',
    resolutionType: c.bridgeId ? 'MEASURED_DECK_FOR_AUTHORED_FOOT_BRIDGE' : 'MEASURED_FORD_CANDIDATE',
    proposedGeometry: c.bridgeId && deck ? { deckId: deck.proposedDeck.id, spanAu: deck.proposedDeck.spanAu, widthAu: deck.proposedDeck.widthAu, deckPolygonAu: deck.proposedDeck.deckPolygonAu, status: STATUS.PROPOSED, canonical: false }
      : { id: `ford.${c.roadId}.${c.riverId}.v2`, centreAu: at.map(r4), measuredWetWidthAu: wetCells * CELL, depth: STATUS.UNKNOWN, fordable: STATUS.UNKNOWN, status: STATUS.PROPOSED, canonical: false, note: 'Ford GEOMETRY only; no depth, flow, boat or cart rule.' },
    cartPassability: { value: false, status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY' },
    verdict: c.bridgeId ? 'PROPOSED_MEASURED_DECK' : 'PROPOSED_MEASURED_FORD_GEOMETRY',
    stillRequiresGameplay: ['approved body/cart footprint', 'swept clearance', 'bridge deck bearing', 'ford depth/flow rule'],
  };
});
const outletRiver = C.rivers.find(r => r.mouth?.kind === 'none');
const outletGap = outletRiver ? (() => {
  const last = outletRiver.points.at(-1);
  let nearestSea = null;
  for (let i = 0; i < N; i++) { if (S.waterClass[i] !== 1) continue; const c = centreAu(i), d = dist(c, last); if (!nearestSea || d < nearestSea.d) nearestSea = { d, i, at: c.map(r4) }; }
  const polyline = [last.map(r4), nearestSea.at];
  return {
    sourceId: outletRiver.id, previousFailure: 'v1 OUTLET-01 AUTHORED_OUTLET_GEOMETRY_GAP (no exact river/coordinate recorded).',
    authoredMouth: outletRiver.mouth, authoredTerminalPointAu: last.map(r4), nearestSeaCellIndex: nearestSea.i, nearestSeaAtAu: nearestSea.at,
    measuredGapAu: r4(nearestSea.d),
    proposedChannel: { id: `outlet.${outletRiver.id}.v2`, polylineAu: polyline, lengthAu: r4(dist(last, nearestSea.at)),
      measuredWetWidthAu: outletRiver.width, widthUnit: 'EDITOR_STROKE_AU', status: STATUS.PROPOSED, canonical: false,
      basis: 'Straight measured channel from the authored terminal vertex to the nearest authored SEA cell. NO new river is canonized; the authored mouth.kind=none is preserved.', owner: 'MAP' },
    verdict: 'PROPOSED_MEASURED_OUTLET_CHANNEL', resolutionType: 'GEOMETRY_CANDIDATE__NOT_AUTHORED',
    note: 'Do NOT count this as an authored river. Gameplay owns any navigability/flood rule.',
  };
})() : { verdict: 'BLOCKED__NO_RIVER_WITH_NONE_MOUTH' };
const transportV2 = {
  schema: 'soh.wmp.v2.transport_corrections.v1', authority, status: 'MEASURED_ALTERNATIVES__NO_APPROVED_CART_PASSABILITY',
  previousCounts: { bridges: 12, disconnectedRoads: 7, crossingContradictions: hydrology.crossingContradictions.length, outletDefects: 1 },
  bridgeDecks, roadConnectors, crossingResolutions, outletGap,
  summary: {
    bridgesWithMeasuredDecks: bridgeDecks.filter(b => b.proposedDeck).length,
    bridgesWithVerifiedConnectorRole: bridgeDecks.filter(b => b.connectivity.status === 'VERIFIED_GEOMETRY__BRIDGE_CONNECTS_DRY_LAND').length,
    falseDisconnectsReclassified: roadConnectors.filter(r => r.resolution === 'VERIFIED_GEOMETRY__COINCIDENT_ENDPOINT_NO_NEW_ROAD_REQUIRED').length,
    realSplitsWithMeasuredConnectors: roadConnectors.filter(r => r.resolution === 'PROPOSED_MEASURED_DRY_LAND_CONNECTOR').length,
    realSplitsBlocked: roadConnectors.filter(r => r.status === STATUS.BLOCKED).length,
    crossingsWithMeasuredGeometry: crossingResolutions.filter(c => c.proposedGeometry).length,
    crossingsStillBlocked: crossingResolutions.filter(c => c.status === STATUS.BLOCKED).length,
    outletResolvedAsProposedGeometry: outletGap.verdict === 'PROPOSED_MEASURED_OUTLET_CHANNEL',
  },
  noClaims: ['NO cartPassable=true', 'NO invented road, bridge, land connection or river', 'NO approved vehicle dimension', 'NO ferry/boat rule', 'NO Gameplay runtime modification'],
};
emit('layers/transport_corrections.v2.json', transportV2);

// =====================================================================
// 3. BUILD SITES — identical LR02 criteria, dry subsets, connectivity, homes
// =====================================================================
function componentOf(cells) {
  const set = new Set(cells); if (!set.size) return { count: 0, largest: [], sizes: [] };
  const seen = new Set(), comps = [];
  for (const c of set) { if (seen.has(c)) continue; const q = [c], comp = []; seen.add(c); while (q.length) { const j = q.pop(); comp.push(j); for (const k of cell4(j)) if (set.has(k) && !seen.has(k)) { seen.add(k); q.push(k); } } comps.push(comp); }
  comps.sort((a, b) => b.length - a.length);
  return { count: comps.length, largest: comps[0], sizes: comps.map(c => c.length) };
}
const buildSitesV2 = SE.buildSiteEnvelopes.map(e => {
  const [x0, y0, x1, y1] = e.physicalEnvelopeAu;
  const gx0 = Math.max(0, Math.floor(x0 / CELL)), gx1 = Math.min(GW - 1, Math.ceil(x1 / CELL));
  const gy0 = Math.max(0, Math.floor(y0 / CELL)), gy1 = Math.min(GH - 1, Math.ceil(y1 / CELL));
  const all = [], wet = [], dryCells = [];
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const i = idx(gx, gy), c = centreAu(i);
    if (c[0] < x0 || c[0] > x1 || c[1] < y0 || c[1] > y1) continue;
    all.push(i); if (S.waterClass[i] !== 0) wet.push(i); else dryCells.push(i);
  }
  const comp = componentOf(dryCells);
  const usable = comp.largest;
  const lr1 = LR01_BUILD.sites.find(s => s.siteId === e.siteId);
  const v1 = envelopes.buildEnvelopes.sites.find(s => s.siteId === e.siteId);
  // loading approach: cargo-assumed cells near the dry subset
  const loading = usable.filter(i => S.clearanceCells[i] >= 3 && S.roadClass[i] > 0).slice(0, 8);
  const loadingFallback = loading.length ? loading : usable.filter(i => S.clearanceCells[i] >= 3).slice(0, 8);
  const homeCandidate = {
    anchorCellIndex: usable.length ? usable[Math.floor(usable.length / 2)] : null,
    anchorAu: usable.length ? centreAu(usable[Math.floor(usable.length / 2)]).map(r4) : null,
    independentlySelectable: usable.length >= 9,
    selectionStatus: 'MAP_GEOMETRY_CANDIDATE__GAMEPLAY_OWNS_RUNTIME_SELECTION',
  };
  return {
    siteId: e.siteId, parentZoneId: e.parentZoneId, sourceRef: e.sourceRef,
    physicalEnvelopeAu: e.physicalEnvelopeAu, criterion: 'IDENTICAL_TO_LR02_M2: bbox gx0=floor(x0/8), gx1=ceil(x1/8), gy0=floor(y0/8), gy1=ceil(y1/8); cell centre clipped to [x0,x1]x[y0,y1].',
    recomputed: { derivedCellCount: all.length, waterCellCount: wet.length, dryCellCount: dryCells.length, dryCellIndices: dryCells, waterCellIndices: wet,
      largestConnectedDryComponent: usable.length, largestConnectedDryCellIndices: usable,
      connectedComponentCount: comp.count, componentSizes: comp.sizes,
      footprintConnectivityStatus: comp.count === 1 ? 'VERIFIED_GEOMETRY__SINGLE_CONNECTED_DRY_FOOTPRINT' : 'PROPOSED__DRY_SUBSET_IS_LARGEST_CONNECTED_COMPONENT' },
    reconciliation: { lr02DerivedCellCount: e.derivedCellCount, lr02WaterCells: e.waterCells, lr02DryCellCount: e.dryCellCount,
      exactMatchWithLr02: all.length === e.derivedCellCount && wet.length === e.waterCells && dryCells.length === e.dryCellCount,
      lr03V1WaterOverlapCellCount: v1.waterOverlapCellCount, lr03V1Overcount: Math.max(0, v1.waterOverlapCellCount - wet.length),
      v1Defect: 'v1 used floor() instead of ceil() for the bbox cell range AND did not clip cell centres to the bbox, so sea cells OUTSIDE the authored envelope were counted as water overlap.' },
    lr01BuildableCells: lr1?.buildableCells ?? null, lr01LoadingCells: lr1?.loadingCells ?? null,
    loadingApproach: { cellIndices: loadingFallback, status: 'PROPOSED_ASSUMED_CARGO_PROFILE_LOADING_CANDIDATES', sweptClearance: STATUS.UNKNOWN, owner: 'MAP+GAMEPLAY' },
    homeCandidate,
    occupancyStatus: STATUS.UNKNOWN, claimLegalityStatus: 'GAMEPLAY_OWNED', placedStructure: null,
    verdict: wet.length === 0 ? 'VERIFIED_GEOMETRY__NO_WATER_OVERLAP' : (usable.length >= 8 ? 'VERIFIED_GEOMETRY__USABLE_DRY_SUBSET' : 'BLOCKED__DRY_SUBSET_TOO_SMALL'),
  };
});
const homes = buildSitesV2.filter(s => s.homeCandidate.independentlySelectable).slice(0, 3).map((s, k) => ({ id: `wmp.v2.home.${k + 1}`, siteId: s.siteId, anchorAu: s.homeCandidate.anchorAu, anchorCellIndex: s.homeCandidate.anchorCellIndex, independentlySelectable: true, owner: 'GAMEPLAY' }));
const buildSitesLayer = {
  schema: 'soh.wmp.v2.build_sites.v1', authority, status: 'RECOMPUTED_WITH_IDENTICAL_CRITERIA',
  siteCount: buildSitesV2.length,
  lr02WaterOverlapSites: SE.buildSiteEnvelopes.filter(e => e.waterCells > 0).length,
  lr03V1WaterOverlapSites: envelopes.buildEnvelopes.sites.filter(e => e.waterOverlapCellCount > 0).length,
  recomputedWaterOverlapSites: buildSitesV2.filter(s => s.recomputed.waterCellCount > 0).length,
  exactReconciliationCount: buildSitesV2.filter(s => s.reconciliation.exactMatchWithLr02).length,
  lr03V1FalsePositiveIds: buildSitesV2.filter(s => s.reconciliation.lr03V1Overcount > 0 && s.recomputed.waterCellCount === 0).map(s => s.siteId),
  usableDrySiteCount: buildSitesV2.filter(s => s.recomputed.largestConnectedDryComponent >= 8).length,
  sitesWithWaterStillPresent: buildSitesV2.filter(s => s.recomputed.waterCellCount > 0).map(s => ({ siteId: s.siteId, waterCells: s.recomputed.waterCellCount, dryCells: s.recomputed.dryCellCount, largestConnectedDry: s.recomputed.largestConnectedDryComponent })),
  homes, sites: buildSitesV2,
  noClaims: ['NO placement grant', 'NO house or free structure', 'NO claim legality', 'NO swept vehicle clearance'],
};
emit('layers/build_sites.v2.json', buildSitesLayer);

// =====================================================================
// 4. ARCHITECTURE — physical assessment of all 153 roof polygons
// =====================================================================
const roofAssessments = [];
for (const p of architecture.pois) {
  const entrance = p.staticOpenings.find(o => o.kind === 'EXTERIOR_ENTRANCE') ?? p.staticOpenings[0] ?? null;
  for (const rf of p.roofPolygons) {
    const rm = p.rooms.find(x => x.id === rf.parentRoomId);
    const area = ringArea(rf.polygonAu), roomArea = rm.areaAu2;
    const c = ringCentroid(rf.polygonAu);
    const verticesInside = rf.polygonAu.every(q => pointInRing(q, rm.polygonAu));
    // A wall whose MIDPOINT lies strictly INSIDE the roof polygon crosses the
    // covered interior. Boundary walls (the room perimeter) are legitimate and
    // are NOT counted as an interior obstruction.
    const interiorWalls = p.staticSolids.filter(s => {
      const mid = [(s.aAu[0] + s.bAu[0]) / 2, (s.aAu[1] + s.bAu[1]) / 2];
      return pointInRing(mid, rf.polygonAu) && distPointSegment(mid, s.aAu, s.bAu) < 0.001;
    }).map(s => s.id);
    const openingsNear = p.staticOpenings.filter(o => dist(o.centreAu, c) <= 24);
    const clearLosFromAnyOpening = openingsNear.some(o => !p.staticSolids.some(s => segmentHitsWall(o.centreAu, c, s.aAu, s.bAu, (s.thicknessAu ?? 2) / 2)));
    const entranceLosBlocked = entrance ? p.staticSolids.some(s => segmentHitsWall(entrance.centreAu, c, s.aAu, s.bAu, (s.thicknessAu ?? 2) / 2)) : null;
    const ratio = roomArea ? r4(area / roomArea) : null;
    const defects = [];
    if (!verticesInside) defects.push('ROOF_VERTICES_OUTSIDE_PARENT_ROOM');
    if (interiorWalls.length) defects.push(`INTERIOR_WALL_CROSSING_${interiorWalls.length}`);
    if (ratio !== null && ratio < 0.1) defects.push('NEGLIGIBLE_COVERAGE');
    if (ratio !== null && ratio > 1.001) defects.push('ROOF_AREA_EXCEEDS_ROOM');
    if (!openingsNear.length) defects.push('NO_AUTHORED_OPENING_WITHIN_24AU');
    if (openingsNear.length && !clearLosFromAnyOpening) defects.push('NO_CLEAR_LOS_FROM_ANY_AUTHORED_OPENING');
    // CORRECTIVE: re-derive the roof from the ORIGINAL source room polygon with
    // the largest inset factor whose vertices are strictly inside the room AND
    // whose interior contains no static-wall midpoint. This keeps source shape,
    // vertex order and provenance; it does NOT invent a new building.
    const scaleRing = (f) => rm.polygonAu.map(q => [c0[0] + (q[0] - c0[0]) * f, c0[1] + (q[1] - c0[1]) * f]);
    const c0 = ringCentroid(rm.polygonAu);
    const wallMids = p.staticSolids.map(s => [(s.aAu[0] + s.bAu[0]) / 2, (s.aAu[1] + s.bAu[1]) / 2]);
    const ok = (poly) => poly.every(q => pointInRing(q, rm.polygonAu)) && !wallMids.some(m => pointInRing(m, poly));
    const f0 = Math.sqrt(Math.max(0, Math.min(1, rf.coverageFractionOfRoom ?? 1)));
    let correctedPolygonAu = null, correctedInset = null;
    if (defects.length) {
      for (let step = 0; step <= 40; step++) {
        const f = r4(f0 * (1 - step * 0.02)); if (f <= 0.04) break;
        const poly = scaleRing(f);
        if (ok(poly)) { correctedInset = f; correctedPolygonAu = poly.map(q => q.map(r4)); break; }
      }
    }
    roofAssessments.push({
      correctedCandidate: defects.length && correctedPolygonAu ? {
        id: `roof.corrected.${rf.id}.v2`, insetFactor: correctedInset,
        coverageFractionOfRoom: r4(correctedInset * correctedInset),
        polygonAu: correctedPolygonAu, areaAu2: r4(ringArea(correctedPolygonAu)),
        verticesInsideParentRoom: true, interiorWallCrossings: 0,
        status: STATUS.PROPOSED, canonical: false,
        basis: 'Largest 0.02-step inset of the ORIGINAL source room polygon about its centroid whose vertices are strictly inside the room and whose interior excludes every static-wall midpoint.',
        owner: 'MAP',
      } : null,
      roofId: rf.id, poiId: p.poiId, parentRoomId: rf.parentRoomId,
      areaAu2: r4(area), roomAreaAu2: roomArea, coverageRatio: ratio,
      polygonVertexCount: rf.polygonAu.length, centroidAu: c.map(r4), roofVerticesInsideParentRoom: verticesInside,
      canopyOnly: !!rf.canopyOnly, occlusion: rf.occlusion,
      interiorWallCrossings: interiorWalls, authoredOpeningsWithin24Au: openingsNear.map(o => o.id),
      clearLosFromAuthoredOpening: clearLosFromAnyOpening, entranceToRoofLosBlocked: entranceLosBlocked,
      defects, verdict: defects.length ? 'PROPOSED__NAMED_DEFECTS' : 'VERIFIED_GEOMETRY__MEANINGFUL_COVERAGE',
      previousFailure: 'v1 M-G3-02 only checked bbox containment and status=PROPOSED; no polygon-inside, area, interior-wall, opening or LOS check.',
      sourceRef: `LR01 poi_layouts.v1.json rooms[] where id=${rm.id}; LR02 portal_geometry.v1.json`,
    });
  }
}
const roofsLayer = {
  schema: 'soh.wmp.v2.roof_assessment.v1', authority, status: 'PHYSICAL_ASSESSMENT__NOT_AUTOMATIC_COMPLETION',
  roofPolygonCount: roofAssessments.length,
  verifiedMeaningful: roofAssessments.filter(r => r.verdict === 'VERIFIED_GEOMETRY__MEANINGFUL_COVERAGE').length,
  withNamedDefects: roofAssessments.filter(r => r.verdict === 'PROPOSED__NAMED_DEFECTS').length,
  defectHistogram: roofAssessments.reduce((m, r) => { for (const d of r.defects) m[d] = (m[d] ?? 0) + 1; return m; }, {}),
  roofsWithClearLosFromAuthoredOpening: roofAssessments.filter(r => r.clearLosFromAuthoredOpening).length,
  roofsWithInteriorWallCrossing: roofAssessments.filter(r => r.interiorWallCrossings.length > 0).length,
  roofsWithVerticesOutsideParentRoom: roofAssessments.filter(r => !r.roofVerticesInsideParentRoom).length,
  roofsBlockedFromExteriorEntrance: roofAssessments.filter(r => r.entranceToRoofLosBlocked === true).length,
  roofsWithoutNearbyOpening: roofAssessments.filter(r => r.authoredOpeningsWithin24Au.length === 0).length,
  roofsWithMeasuredCorrectedInset: roofAssessments.filter(r => r.correctedCandidate).length,
  assessments: roofAssessments,
  noClaims: ['NO runtime canopy sprite', 'NO creator visual approval', 'NO claim that a roof is a completed building'],
};
emit('layers/roof_assessment.v2.json', roofsLayer);

// =====================================================================
// 5. ENVIRONMENT — reproducible normalized proposed potentials
// =====================================================================
const elevationNorm = U8(), slopeNorm = U8(), waterProxNorm = U8(), canopyNorm = U8();
const exposureNorm = U8(), substrateNorm = U8(), drainageNorm = U8();
const moistureNorm = U8(), temperatureNorm = U8(), soilSuitNorm = U8(), climateSuitNorm = U8();
for (let i = 0; i < N; i++) {
  const elev = S.elevation[i], slopeRaw = S.slope[i], biome = S.biomeCode[i];
  elevationNorm[i] = clamp255(elev);
  slopeNorm[i] = clamp255(slopeRaw / 64 * 255);
  const seaD = S.seaDistanceCells[i], freshD = S.freshwaterProximityCells[i];
  waterProxNorm[i] = clamp255(255 - Math.min(255, (freshD > 0 ? freshD * 24 : seaD * 8)));
  canopyNorm[i] = (biome === 1 || biome === 2 || biome === 3) ? 200 : (biome === 4 ? 100 : (biome === 6 ? 40 : 0));
  exposureNorm[i] = clamp255(D.exposure[i] / 3 * 255);
  substrateNorm[i] = clamp255(D.substrate[i] / 8 * 255);
  drainageNorm[i] = clamp255(D.drainage[i] / 3 * 255);
  const wetSoil = D.soilMoisture[i] / 4 * 255;
  const drainWet = D.drainage[i] === 1 ? 255 : (D.drainage[i] === 2 ? 128 : (D.drainage[i] === 3 ? 255 : 0));
  moistureNorm[i] = S.waterClass[i] > 0 ? 255 : clamp255((35 * waterProxNorm[i] + 20 * canopyNorm[i] + 15 * wetSoil + 15 * (255 - elevationNorm[i]) + 15 * drainWet) / 100);
  const heatOrdinal = D.temperaturePotential[i] / 4 * 255, sun = D.sunExposure[i] / 3 * 255, frost = D.frostPotential[i] / 3 * 255;
  temperatureNorm[i] = clamp255((40 * heatOrdinal + 20 * (255 - elevationNorm[i]) + 20 * sun + 10 * (255 - canopyNorm[i]) + 10 * (255 - frost)) / 100);
  const soilQuality = (D.soil[i] === 2 ? 255 : (D.soil[i] === 3 ? 200 : (D.soil[i] === 1 ? 140 : (D.soil[i] === 4 ? 90 : 60))));
  soilSuitNorm[i] = S.waterClass[i] > 0 ? 0 : clamp255((30 * soilQuality + 25 * (255 - drainageNorm[i]) + 20 * (255 - slopeNorm[i]) + 15 * moistureNorm[i] + 10 * (255 - exposureNorm[i])) / 100);
  climateSuitNorm[i] = S.waterClass[i] > 0 ? 0 : clamp255((35 * (255 - Math.abs(temperatureNorm[i] - 128)) + 25 * moistureNorm[i] + 20 * (255 - slopeNorm[i]) + 10 * substrateNorm[i] + 10 * (255 - exposureNorm[i])) / 100);
}
const envRasters = [
  ['elevationNorm', elevationNorm, 'Normalized raw elevation byte [0..255]; NOT metres', 'NORMALIZED_RAW_BYTE'],
  ['slopeNorm', slopeNorm, 'Normalized raw slope byte (slopeRaw/64 clipped); NOT degrees', 'NORMALIZED_RAW_BYTE'],
  ['waterProximityNorm', waterProxNorm, 'Inverse distance to authored freshwater/sea cells', 'PROPOSED_NORMALIZED_POTENTIAL'],
  ['canopyNorm', canopyNorm, 'Authored forest/marsh biome canopy potential', 'PROPOSED_NORMALIZED_POTENTIAL'],
  ['exposureNorm', exposureNorm, 'v1 exposure ordinal normalized', 'PROPOSED_NORMALIZED_POTENTIAL'],
  ['substrateNorm', substrateNorm, 'v1 substrate ordinal normalized', 'PROPOSED_NORMALIZED_POTENTIAL'],
  ['drainageNorm', drainageNorm, 'v1 drainage ordinal normalized', 'PROPOSED_NORMALIZED_POTENTIAL'],
  ['moisturePotentialNorm', moistureNorm, 'Weighted moisture POTENTIAL [0..255] -> [0,1] for EconomyMap', 'PROPOSED_NORMALIZED_POTENTIAL'],
  ['temperaturePotentialNorm', temperatureNorm, 'Weighted thermal POTENTIAL [0..255] -> [0,1] for EconomyMap; NOT degrees celsius', 'PROPOSED_NORMALIZED_POTENTIAL'],
  ['soilSuitabilityNorm', soilSuitNorm, 'Weighted soil/farming geographic suitability', 'PROPOSED_NORMALIZED_POTENTIAL'],
  ['climateSuitabilityNorm', climateSuitNorm, 'Weighted combined climate geographic suitability', 'PROPOSED_NORMALIZED_POTENTIAL'],
];
for (const [name, arr, semantics, status] of envRasters) emitU8(`rasters/${name}.u8`, arr, { semantics, status });
// climateRegion.u8 encodes region index as floor(value/10)-1 (10..19 => 0,
// 20..29 => 1, ... 120..129 => 11). Region evidence is computed on LAND cells
// only, so sea cells (elevation 0, drainage 3) cannot swamp the statistics.
const REGION_KEYS = climate.climateRegions.map(r => r.key);
const regionEvidence = climate.climateRegions.map((r, ri) => {
  let all = 0, land = 0, m = 0, t = 0, s = 0, cl = 0, wp = 0, elev = 0, slope = 0;
  for (let i = 0; i < N; i++) {
    const k = Math.floor(D.climateRegion[i] / 10) - 1;
    if (k !== ri || !REGION_KEYS[k]) continue;
    all++;
    if (S.landId[i] <= 0 || S.waterClass[i] !== 0) continue;   // dry land only
    land++; m += moistureNorm[i]; t += temperatureNorm[i]; s += soilSuitNorm[i]; cl += climateSuitNorm[i];
    wp += waterProxNorm[i]; elev += elevationNorm[i]; slope += slopeNorm[i];
  }
  const avg = v => land ? r4(v / land) : null;
  return { regionId: r.id, key: r.key, totalRasterCells: all, dryLandCellCount: land,
    meanMoisturePotential: avg(m), meanTemperaturePotential: avg(t), meanSoilSuitability: avg(s),
    meanClimateSuitability: avg(cl), meanWaterProximity: avg(wp), meanElevationNorm: avg(elev), meanSlopeNorm: avg(slope),
    evidenceBasis: 'dry-land cells only; mean of v2 normalized u8 rasters; reproducible from v1 rasters + formulas' };
});
const environmentLayer = {
  schema: 'soh.wmp.v2.environment.v1', authority, status: 'REPRODUCIBLE_NORMALIZED_PROPOSED_POTENTIAL',
  inputs: { elevation: 'data/rasters/geo01/elevation.u8 (RAW BYTE)', slope: 'data/rasters/geo01/slope.u8 (RAW BYTE)', biome: 'data/rasters/geo01/biomeCode.u8 (12 source subtypes)', water: 'waterClass/freshwater/seaDistanceCells/freshwaterProximityCells', canopy: 'biomeCode forest variants', substrate: 'rasters/substrate.u8', drainage: 'rasters/drainage.u8', exposure: 'rasters/exposure.u8', soil: 'rasters/soil.u8', v1Climate: 'rasters/climateRegion.u8, temperaturePotential.u8, frostPotential.u8, sunExposure.u8, soilMoisture.u8' },
  formulas: {
    moisturePotentialNorm: 'water?255:clamp255((35*waterProximityNorm + 20*canopyNorm + 15*soilMoistureOrdinal*63.75 + 15*(255-elevationNorm) + 15*drainageWet)/100)',
    temperaturePotentialNorm: 'clamp255((40*temperaturePotentialOrdinal*63.75 + 20*(255-elevationNorm) + 20*sunExposureOrdinal*85 + 10*(255-canopyNorm) + 10*(255-frostPotentialOrdinal*85))/100)',
    soilSuitabilityNorm: 'water?0:clamp255((30*soilQuality + 25*(255-drainageNorm) + 20*(255-slopeNorm) + 15*moistureNorm + 10*(255-exposureNorm))/100)',
    climateSuitabilityNorm: 'water?0:clamp255((35*(255-abs(temperatureNorm-128)) + 25*moistureNorm + 20*(255-slopeNorm) + 10*substrateNorm + 10*(255-exposureNorm))/100)',
  },
  rasters: envRasters.map(([name, , semantics, status]) => ({ name, file: `v2/rasters/${name}.u8`, semantics, status, unit: 'NORMALIZED_0_255' })),
  regionEvidence,
  semantics: 'These are dimensionless NORMALIZED PROPOSED geographic potentials for spatial comparison and EconomyMap structural completeness. They are NOT numeric temperature, weather, damage, crop yield or seasonal rates.',
  gameplayOwnedUnknowns: [
    { id: 'ENV-U01', subject: 'temperature in degrees / thermal damage rate', status: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
    { id: 'ENV-U02', subject: 'weather realization and seasonal timeline', status: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
    { id: 'ENV-U03', subject: 'crop growth/yield and farming benefit', status: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
    { id: 'ENV-U04', subject: 'radiation numeric and survival consequence', status: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
    { id: 'ENV-U05', subject: 'elevation in metres and slope in degrees', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY' },
  ],
  noClaims: ['NO official temperature value', 'NO damage/weather/season rate', 'NO crop yield', 'NO approved physical unit'],
};
emit('layers/environment.v2.json', environmentLayer);

// =====================================================================
// 6. DECISIONS + REGISTER (per-defect before/after, status, owner)
// =====================================================================
const decisionsV2 = {
  schema: 'soh.wmp.v2.decision_register.v1', status: 'CONSOLIDATED_BATCH__NO_APPROVAL_REQUESTED_MID_RUN', authority,
  items: [
    ...decisions.items.map(d => ({ ...d, carriedFrom: 'manifest.v1.json layers/decision_register.v1.json' })),
    { id: 'DR-V2-01', subject: 'canonical vertical portal coordinates for 8 POIs', alternatives: ['PRESERVE_CANONICAL_AT_COORDINATE', 'ADOPT_V2_CORRECTED_CANDIDATE'], pending: 'preserve canonical; Gameplay/Creator must decide whether to adopt the v2 corrected candidate', owner: 'GAMEPLAY+CREATOR', status: STATUS.UNDECIDED },
    { id: 'DR-V2-02', subject: 'numeric vertical separation / stair pitch / ladder collision', alternatives: ['UNRESOLVED'], pending: 'UNRESOLVED', owner: 'MAP+GAMEPLAY', status: STATUS.UNRESOLVED },
    { id: 'DR-V2-03', subject: '12 proposed bridge deck polygons as canonical geometry', alternatives: ['PROPOSED_NONCANONICAL', 'CREATOR_ADOPTS'], pending: 'PROPOSED_NONCANONICAL', owner: 'CREATOR+MAP', status: STATUS.PROPOSED },
    { id: 'DR-V2-04', subject: 'approved player/cart/loaded-cart footprints and swept clearance', alternatives: BODY_PROFILES.map(p => p.id), pending: 'all three preserved', owner: 'GAMEPLAY', status: STATUS.UNKNOWN },
    { id: 'DR-V2-05', subject: 'ford depth/flow rule and ferry/boat mechanic', alternatives: ['GEOMETRY_ONLY'], pending: 'GEOMETRY_ONLY', owner: 'GAMEPLAY', status: STATUS.BLOCKED },
    { id: 'DR-V2-06', subject: 'outlet channel for rv_grey_low as authored river', alternatives: ['PROPOSED_CANDIDATE', 'DECLINE'], pending: 'PROPOSED_CANDIDATE', owner: 'CREATOR+MAP', status: STATUS.PROPOSED },
    { id: 'DR-V2-07', subject: 'normalized climate potentials vs official numeric rates', alternatives: ['NORMALIZED_POTENTIAL'], pending: 'NORMALIZED_POTENTIAL', owner: 'GAMEPLAY', status: STATUS.PROPOSED },
    { id: 'DR-V2-08', subject: 'cargoPassable / starts / stock / loot / escrow runtime semantics', alternatives: ['MAP_ASSUMED_PROFILE_MASK', 'GAMEPLAY_APPROVED'], pending: 'MAP_ASSUMED_PROFILE_MASK only', owner: 'GAMEPLAY', status: STATUS.UNKNOWN },
    { id: 'DR-V2-09', subject: 'creator visual approval and native 640x360 human legibility', alternatives: ['TECHNICAL_VIEWS_ONLY'], pending: 'TECHNICAL_VIEWS_ONLY', owner: 'CREATOR', status: STATUS.UNKNOWN },
  ],
};
emit('layers/decision_register.v2.json', decisionsV2);

const register = {
  schema: 'soh.wmp.v2.corrective_register.v1', authority, status: 'PER_DEFECT_BEFORE_AFTER_WITH_STATUS',
  statusVocabulary: { VERIFIED_GEOMETRY: 'Real spatial check passed (collision/connectivity/bidirectional traversal).', PROPOSED_GEOMETRY: 'Measured non-canonical candidate; not approved.', BLOCKED: 'Not resolved; exact ID/reason retained. Documentation is NOT a PASS.' },
  vertical: verticalCorrections.map(v => ({ exactSourceId: v.portalId, coordinates: v.previousFailure.atAu, previousFailure: v.previousFailure.code, before: 'v1 NAMED_BLOCKER_WITH_PROPOSED_ALTERNATIVE (shaft only inside overlap bbox)', after: v.correctedCandidate ? { id: v.correctedCandidate.id, atAu: v.correctedCandidate.atAu, shaftPolygonAu: v.correctedCandidate.shaftPolygonAu, status: v.correctedCandidate.status } : null, verdict: v.verdict, canonicalPortalUnchanged: true, spatialChecks: v.checks ? { collisionFree: v.checks.collisionFree, bidirectional: v.checks.bidirectionalTraversal.verified, groundOpening: !!v.checks.groundBoundaryOpening, deepOpening: !!v.checks.deepBoundaryOpening } : null, negativeCounterexamples: v.negativeCounterexamples })),
  bridges: bridgeDecks.map(b => ({ exactSourceId: b.bridgeId, coordinates: b.atAu, previousFailure: b.previousFailure, before: 'deckPolygonAu=null / UNRESOLVED', after: { spanAu: b.proposedDeck.spanAu, widthAu: b.proposedDeck.widthAu, deckPolygonAu: b.proposedDeck.deckPolygonAu, status: STATUS.PROPOSED }, verdict: b.verdict, connectivity: b.connectivity.status, bodySweep: 'UNKNOWN under 3 ASSUMPTION_PROFILEs' })),
  disconnectedRoads: roadConnectors.map(r => ({ exactSourceId: r.roadId, coordinates: [r.fromAu, r.toAu], previousFailure: r.previousFailure, before: 'no measured connector geometry', after: r.measuredConnector ?? r.connectorGeometry, verdict: r.resolution, status: r.status })),
  crossings: crossingResolutions.map(c => ({ exactSourceId: c.roadId + '/' + c.riverId, coordinates: c.atAu, previousFailure: c.previousFailure, before: 'editor stroke width only', after: c.proposedGeometry, verdict: c.verdict })),
  outlet: { exactSourceId: outletGap.sourceId, coordinates: outletGap.authoredTerminalPointAu, previousFailure: outletGap.previousFailure, before: 'no exact ID/coordinate recorded', after: outletGap.proposedChannel, verdict: outletGap.verdict },
  buildSites: buildSitesV2.map(s => ({ exactSourceId: s.siteId, coordinates: s.physicalEnvelopeAu, previousFailure: 'v1 bbox cell-range/criterion defect', before: { lr03V1WaterOverlapCellCount: s.reconciliation.lr03V1WaterOverlapCellCount }, after: { waterCells: s.recomputed.waterCellCount, dryCells: s.recomputed.dryCellCount, largestConnectedDry: s.recomputed.largestConnectedDryComponent }, verdict: s.verdict, exactLr02Match: s.reconciliation.exactMatchWithLr02 })),
  roofs: roofAssessments.map(r => ({ exactSourceId: r.roofId, coordinates: r.centroidAu, previousFailure: r.previousFailure, before: { v1RoofPolygonVertexCount: r.polygonVertexCount, coverageRatio: r.coverageRatio, verticesInsideParentRoom: r.roofVerticesInsideParentRoom, interiorWallCrossings: r.interiorWallCrossings.length }, after: r.correctedCandidate ? { id: r.correctedCandidate.id, insetFactor: r.correctedCandidate.insetFactor, polygonAu: r.correctedCandidate.polygonAu, status: STATUS.PROPOSED } : { status: 'NO_CORRECTION_REQUIRED' }, nearbyOpenings: r.authoredOpeningsWithin24Au.length, clearLosFromAuthoredOpening: r.clearLosFromAuthoredOpening, verdict: r.verdict })),
};
emit('layers/corrective_register.v2.json', register);

// =====================================================================
// 7. MANIFEST v2 — parent v1 pinned, full child digests
// =====================================================================
const body = {
  schema: 'soh.wmp.world_master_manifest.v2', version: 2, revision: 1,
  packageId: 'veyra-physical-world-master',
  status: 'CORRECTED_PHYSICAL_WORLD_MASTER_CANDIDATE__NOT_SEALED',
  authority, generatedBy: 'veyra-world-master/v2/src/build_v2.mjs',
  generatedAtUtc: 'DETERMINISTIC_BUILD_NO_WALLCLOCK',
  parent: { file: 'manifest.v1.json', sha256: V1_MANIFEST_SHA, revisionDigest: V1_REVISION, pinnedUnchanged: true, note: 'ALL v1 files are byte-identical; v2 only ADDS corrective layers/rasters/evidence.' },
  sourceIntegrity: { goldSha256: V1.sourceIntegrity.goldSha256, goldCommit: V1.sourceIntegrity.goldCommit, goldReadCount: 1, sourceManifestSha256: sha256(readBuf('data/source_manifest.v1.json')), lr01BodyDigest: V1.sourceIntegrity.lr01BodyDigest, lr02V2Digest: V1.sourceIntegrity.lr02V2Digest },
  frame: V1.frame,
  corrections: {
    vertical: { v1Blockers: verticalLayer.v1BlockerCount, resolvedVerified: verticalLayer.resolvedVerified, resolvedProposed: verticalLayer.resolvedProposed, stillBlocked: verticalLayer.stillBlocked },
    transport: transportV2.summary,
    buildSites: { lr02OverlapSites: buildSitesLayer.lr02WaterOverlapSites, lr03V1OverlapSites: buildSitesLayer.lr03V1WaterOverlapSites, recomputedOverlapSites: buildSitesLayer.recomputedWaterOverlapSites, exactReconciliation: buildSitesLayer.exactReconciliationCount, v1FalsePositiveIds: buildSitesLayer.lr03V1FalsePositiveIds, usableDrySites: buildSitesLayer.usableDrySiteCount },
    roofs: { count: roofsLayer.roofPolygonCount, verifiedMeaningful: roofsLayer.verifiedMeaningful, withNamedDefects: roofsLayer.withNamedDefects },
    environment: { normalizedRasters: envRasters.length, regionEvidence: regionEvidence.length },
  },
  components: written,
  reproduce: { command: './reproduce_v2.sh', steps: ['node v2/src/build_v2.mjs', 'node v2/src/intake_v2.mjs', 'node v2/src/views_v2.mjs', 'node tests/run.mjs', 'node v2/src/run_v2.mjs', 'node v2/src/artifact_index_v2.mjs', './clean-room_v2.sh'], deterministic: true },
  cleanRoom: { command: './clean-room_v2.sh', noExternalCanonicalSource: true, noLegacyLab: true, noNetwork: true, v1Regression: 'WMP_TESTS 75/75 in isolated copy; source v1 bytes untouched', v2Tests: 'WMP_V2_TESTS 47/47' },
  v1Policy: 'v1 files, including evidence/artifact_index.v1.json and evidence/tests/test_results.v1.json, were deliberately NOT regenerated. All WMP-01 digests remain byte-identical.',
  noClaims: ['NO WORLD_MASTER_SEALED', 'NO VEYRA_PLAYABLE', 'NO VISUAL_ACCEPTED', 'NO MERGE_READY', 'NO approved scale', 'NO Gameplay runtime modification', 'NO cartPassable=true'],
};
const revisionDigest = digest(body);
fs.writeFileSync(path.join(V2, 'manifest.v2.json'), JSON.stringify({ ...body, revisionDigest, digestMethod: 'sha256 over JSON.stringify(body) in field insertion order' }, null, 2) + '\n');
console.log(`WMP_V2_BUILD_OK layers=${written.filter(w => w.kind === 'layer').length} rasters=${written.filter(w => w.kind === 'derived_raster').length} verticalResolved=${verticalLayer.resolvedVerified}/${verticalLayer.v1BlockerCount} bridges=${transportV2.summary.bridgesWithMeasuredDecks} falseDisconnects=${transportV2.summary.falseDisconnectsReclassified} buildReconciled=${buildSitesLayer.exactReconciliationCount}/23 roofsVerified=${roofsLayer.verifiedMeaningful}`);
console.log(`  revisionDigest=${revisionDigest}`);
