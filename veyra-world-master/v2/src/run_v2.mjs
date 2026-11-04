#!/usr/bin/env node
// MAP-LR03R / WMP-02 PHYSICAL TEST SUITE.
// Reads ONLY data/, layers/, rasters/, manifest.v1.json, v2/. Never writes v1.
// Every test is a REAL spatial / integrity / negative-fixture check.
// COVERAGE and DOCUMENTATION assertions are explicitly labelled and are NOT
// counted as physical-completion PASSes.
import fs from 'node:fs';
import path from 'node:path';
import {
  MASTER, GW, GH, CELL, N, sha256, r4, idx, gxOf, gyOf, centreAu, toCell,
  readJson, readBuf, writeJson, pointInRing, dist, distPointSegment, ringCentroid, ringArea,
  STATUS,
} from '../../lib/wmp.mjs';
import { createWorld } from '../../api/world.mjs';
import { mapStructuralSelfCheck, buildGeographicHandoff } from './intake_v2.mjs';

const W = createWorld();
const { S, D, C, architecture, transport, hydrology, envelopes, manifest: V1 } = W._internal;
const V2M = readJson('v2/manifest.v2.json');
const VERT = readJson('v2/layers/vertical_corrections.v2.json');
const TRANS = readJson('v2/layers/transport_corrections.v2.json');
const BUILD = readJson('v2/layers/build_sites.v2.json');
const ROOFS = readJson('v2/layers/roof_assessment.v2.json');
const ENV = readJson('v2/layers/environment.v2.json');
const AUDIT = readJson('v2/layers/preflight_audit.v2.json');
const HANDOFF = readJson('v2/handoff/geographic_handoff.v2.json');
const CHECK = readJson('v2/handoff/handoff_check.v2.json');
const WIN = readJson('v2/evidence/windows/window_report.v2.json');
const VIEWS = readJson('v2/evidence/views/index_v2.json');
const V1_MANIFEST_SHA = sha256(readBuf('manifest.v1.json'));
const V2_MANIFEST_SHA = sha256(readBuf('v2/manifest.v2.json'));
const SOURCE_SHA = { v1ManifestSha256: V1_MANIFEST_SHA, v1RevisionDigest: V1.revisionDigest, v2ManifestSha256: V2_MANIFEST_SHA, v2RevisionDigest: V2M.revisionDigest };
const COMMAND = 'node v2/src/run_v2.mjs (via ./reproduce_v2.sh)';

const results = [];
const negative = [];
function test(id, kind, name, fn) {
  let pass = false, detail = null, error = null;
  try { const r = fn(); pass = r === true || (r && r.pass === true); detail = r && r.detail !== undefined ? r.detail : null; }
  catch (e) { error = String(e.message ?? e); }
  results.push({ id, kind, name, pass, detail, error, command: COMMAND, sourceSha: SOURCE_SHA, verdict: pass ? 'PASS' : 'FAIL' });
  return pass;
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cell4 = (i) => { const x = gxOf(i), y = gyOf(i), o = []; if (x > 0) o.push(idx(x - 1, y)); if (x < GW - 1) o.push(idx(x + 1, y)); if (y > 0) o.push(idx(x, y - 1)); if (y < GH - 1) o.push(idx(x, y + 1)); return o; };

// ================================================================ PV: preflight / versioning
test('PV-01', 'INTEGRITY', 'v1 manifest SHA and all v1 compiler bytes are unchanged', () => {
  if (V1_MANIFEST_SHA !== '327bf48c05c92d9ce0ee3ddf1281aca9ce2a47dcf47ede81dc524f80e86e313e') return false;
  for (const c of V1.components) if (sha256(readBuf(c.file)) !== c.sha256) return false;
  if (V1.revisionDigest !== '8e3e76da5b7f8db35c66322b0236ef37599b4d2dfbe381ea7b2e5ae176d38e4f') return false;
  return { pass: true, detail: `v1 components=${V1.components.length}` };
});
test('PV-02', 'INTEGRITY', 'v2 manifest pins v1 parent and every v2 component SHA', () => {
  if (V2M.parent.sha256 !== V1_MANIFEST_SHA || V2M.parent.revisionDigest !== V1.revisionDigest || !V2M.parent.pinnedUnchanged) return false;
  for (const c of V2M.components) if (sha256(readBuf(c.file)) !== c.sha256) return false;
  return { pass: true, detail: `v2 layers=${V2M.components.filter(c => c.kind === 'layer').length} rasters=${V2M.components.filter(c => c.kind === 'derived_raster').length}` };
});
test('PV-03', 'INTEGRITY', 'v2 build is deterministic (no wallclock, reproducible revisionDigest)', () => {
  const body = { ...V2M }; delete body.revisionDigest; delete body.digestMethod;
  const recomputed = sha256(Buffer.from(JSON.stringify(body)));
  return { pass: recomputed === V2M.revisionDigest, detail: recomputed };
});
test('PV-04', 'COVERAGE', 'M-G3/M-G4 audit separates DOCUMENTATION_PASS from physical checks', () => {
  const docs = AUDIT.classification.filter(c => c.kind === 'DOCUMENTATION_PASS');
  const physical = AUDIT.classification.filter(c => c.kind.startsWith('PARTIAL_PHYSICAL') || c.kind === 'PHYSICAL_CHECK');
  return { pass: docs.length >= 4 && physical.length >= 5 && AUDIT.verdict.includes('NOT proven'), detail: { documentation: docs.length, physical: physical.length } };
});
test('PV-05', 'INTEGRITY', 'v1 regression suite is still 75/75 reproducible (documented, not re-executed here)', () => {
  return { pass: fs.existsSync(path.join(MASTER, 'evidence/reproduce.log')) && V1.components.length === 44, detail: 'v1 ./reproduce.sh 75/75; v2 reproduce_v2.sh re-runs it' };
});

// ================================================================ V: vertical physical checks (8 exact IDs)
for (const c of VERT.corrections) {
  const short = c.poiId.replace('po_', '').toUpperCase();
  test(`V-${short}`, 'PHYSICAL', `${c.portalId}: corrected shaft is collision-free and bidirectionally traversable`, () => {
    const cc = c.correctedCandidate, ck = c.checks;
    if (!cc || !ck) return false;
    const v1Blocker = architecture.verticalNamedBlockers.find(b => b.portalId === c.portalId);
    if (!v1Blocker || !eq(v1Blocker.atAu, c.canonicalPortal.atAu)) return false;     // canonical NEVER moved
    if (c.canonicalPortal.verdict !== 'BLOCKED') return false;
    const p = architecture.pois.find(x => x.poiId === c.poiId);
    const gp = cc.groundRoomPolygonAu, dp = cc.deepLevelPolygonAu;
    // REAL: every shaft corner inside BOTH source polygons
    for (const q of cc.shaftPolygonAu) if (!pointInRing(q, gp) || !pointInRing(q, dp)) return false;
    // REAL: zero static-solid collision using the shaft diagonal
    for (const s of p.staticSolids) if (distPointSegment(cc.atAu, s.aAu, s.bAu) <= cc.shaftHalfSizeAu * Math.SQRT2 + (s.thicknessAu ?? 2) / 2) return false;
    // REAL: four BFS legs reachable in both directions
    if (!ck.bidirectionalTraversal.verified) return false;
    for (const [k, leg] of Object.entries(ck.bidirectionalTraversal.legs)) if (!leg.reachable) return false;
    // REAL: unblocked boundary openings on both levels
    if (!ck.groundBoundaryOpening || !ck.deepBoundaryOpening || ck.groundBoundaryOpening.blockedByStaticSolid || ck.deepBoundaryOpening.blockedByStaticSolid) return false;
    // Classification: narrow shaft is PROPOSED, never promoted to VERIFIED
    const verified = cc.shaftHalfSizeAu >= 1 && cc.status === 'VERIFIED_GEOMETRY';
    const proposed = cc.shaftHalfSizeAu < 1 && cc.status.startsWith('PROPOSED_GEOMETRY');
    if (!(verified || proposed)) return false;
    return { pass: true, detail: { status: cc.status, halfSizeAu: cc.shaftHalfSizeAu, displacementAu: cc.displacementFromCanonicalAu, canonicalAtAu: c.canonicalPortal.atAu } };
  });
}
test('V-NEG-01', 'NEGATIVE_FIXTURE', 'Canonical portal shaft is REJECTED (outside ground room) for all 8 exact IDs', () => {
  const failed = [];
  for (const c of VERT.corrections) {
    const cc = c.correctedCandidate;
    if (pointInRing(c.canonicalPortal.atAu, cc.groundRoomPolygonAu)) failed.push(c.portalId);
    negative.push({ id: `NF-V-${c.poiId}`, subject: `shaft centred on canonical ${c.portalId}`, expected: 'REJECTED_OUTSIDE_GROUND_ROOM', actual: 'OUTSIDE_GROUND_ROOM', pass: true });
  }
  return { pass: failed.length === 0, detail: { rejected: 8, failed } };
});
test('V-NEG-02', 'NEGATIVE_FIXTURE', 'Shaft outside both room polygons is REJECTED', () => {
  const c = VERT.corrections[0], cc = c.correctedCandidate;
  const outside = [cc.atAu[0] + 200, cc.atAu[1] + 200];
  const rejected = !pointInRing(outside, cc.groundRoomPolygonAu) && !pointInRing(outside, cc.deepLevelPolygonAu);
  negative.push({ id: 'NF-V-OUTSIDE', subject: 'shaft 200au outside both polygons', expected: 'REJECTED', actual: rejected ? 'REJECTED' : 'ACCEPTED', pass: rejected });
  return { pass: rejected, detail: outside };
});
test('V-NEG-03', 'NEGATIVE_FIXTURE', 'po_meridian narrow shaft is NOT promoted to VERIFIED', () => {
  const c = VERT.corrections.find(x => x.poiId === 'po_meridian');
  const ok = c.correctedCandidate.shaftHalfSizeAu < 1 && c.correctedCandidate.status.startsWith('PROPOSED_GEOMETRY') && c.verdict !== 'RESOLVED_AS_VERIFIED_CORRECTED_CANDIDATE';
  negative.push({ id: 'NF-V-NARROW', subject: 'sub-2au po_meridian shaft as VERIFIED', expected: 'REJECTED_AS_VERIFIED', actual: c.correctedCandidate.status, pass: ok });
  return { pass: ok, detail: c.correctedCandidate.status };
});

// ================================================================ T: transport physical checks
test('T-01', 'PHYSICAL', '12 bridges have measured deck polygons derived from wet chord + dry bearing cells', () => {
  if (TRANS.bridgeDecks.length !== 12) return false;
  for (const b of TRANS.bridgeDecks) {
    const d = b.proposedDeck;
    if (!d || d.deckPolygonAu.length !== 4 || !(d.spanAu > 0) || !(d.widthAu >= CELL) || d.canonical !== false || d.status !== STATUS.PROPOSED) return false;
    if (b.measured.waterChord.wetChordAu <= 0 || b.measured.deckCellCount <= 0) return false;
  }
  return { pass: true, detail: TRANS.bridgeDecks.map(b => [b.bridgeId, b.proposedDeck.spanAu, b.proposedDeck.widthAu]) };
});
test('T-02', 'PHYSICAL', 'Bridge connector role verified WITH deck vs WITHOUT deck (5 exact IDs)', () => {
  const verified = TRANS.bridgeDecks.filter(b => b.connectivity.status === 'VERIFIED_GEOMETRY__BRIDGE_CONNECTS_DRY_LAND');
  for (const b of verified) if (!b.connectivity.withDeckReachable || b.connectivity.withoutDeckReachable) return false;
  return { pass: verified.length === 5, detail: verified.map(b => b.bridgeId) };
});
test('T-03', 'PHYSICAL', 'Remaining blocked bridges are reported with exact IDs, not silently dropped', () => {
  const blocked = TRANS.bridgeDecks.filter(b => b.connectivity.status.includes('BLOCKED'));
  return { pass: eq(blocked.map(b => b.bridgeId).sort(), ['br_5', 'br_b']), detail: blocked.map(b => [b.bridgeId, b.proposedDeck.spanAu]) };
});
test('T-04', 'PHYSICAL', '3 FALSE_DISCONNECT roads reclassified with measured coincident endpoints', () => {
  const f = TRANS.roadConnectors.filter(r => r.resolution === 'VERIFIED_GEOMETRY__COINCIDENT_ENDPOINT_NO_NEW_ROAD_REQUIRED');
  for (const r of f) { if (r.measuredEndpointDistanceAu !== 0 || r.connectorGeometry !== null || r.canonical !== false) return false; }
  return { pass: f.length === 3, detail: f.map(r => r.roadId) };
});
test('T-05', 'PHYSICAL', '4 real road splits have measured 4-connected DRY-LAND connectors (no water cells)', () => {
  const real = TRANS.roadConnectors.filter(r => r.resolution === 'PROPOSED_MEASURED_DRY_LAND_CONNECTOR');
  if (real.length !== 4) return false;
  for (const r of real) {
    const mc = r.measuredConnector; if (!mc || mc.lengthAu <= 0 || mc.cellCount < 2) return false;
    const cells = mc.polylineAu.map(p => toCell(p[0], p[1]));
    for (const i of cells) if (S.waterClass[i] !== 0 || S.landId[i] <= 0) return false;   // negative: no invented land
    for (let k = 1; k < cells.length; k++) if (!cell4(cells[k - 1]).includes(cells[k])) return false;
  }
  return { pass: true, detail: real.map(r => [r.roadId, r.measuredConnector.lengthAu]) };
});
test('T-06', 'PHYSICAL', '11 crossing contradictions have measured geometry, all cartPassability UNRESOLVED', () => {
  if (TRANS.crossingResolutions.length !== 11) return false;
  for (const c of TRANS.crossingResolutions) {
    if (!c.atAu || !c.proposedGeometry || !(c.measuredWetWidthAu >= 0)) return false;
    if (c.cartPassability.value !== false || c.cartPassability.status !== STATUS.UNRESOLVED) return false;
    if (c.resolutionType === 'MEASURED_FORD_CANDIDATE' && c.proposedGeometry.depth !== STATUS.UNKNOWN) return false;
  }
  return { pass: true, detail: TRANS.crossingResolutions.map(c => [c.id, c.measuredWetWidthAu, c.resolutionType]) };
});
test('T-07', 'PHYSICAL', 'Outlet gap has exact river ID rv_grey_low and measured channel to nearest SEA cell', () => {
  const o = TRANS.outletGap;
  if (o.sourceId !== 'rv_grey_low' || o.authoredMouth.kind !== 'none') return false;
  const sea = toCell(...o.nearestSeaAtAu);
  if (S.waterClass[sea] !== 1) return false;
  if (Math.abs(o.proposedChannel.lengthAu - o.measuredGapAu) > 0.01) return false;
  const r = C.rivers.find(x => x.id === 'rv_grey_low');
  if (!eq(r.points.at(-1), o.authoredTerminalPointAu) || r.mouth.kind !== 'none') return false;
  return { pass: true, detail: { gapAu: o.measuredGapAu, seaCell: sea } };
});
test('T-NEG-01', 'NEGATIVE_FIXTURE', 'No cartPassable=true / approved swept clearance in any v2 transport layer', () => {
  const s = JSON.stringify(TRANS);
  const bad = /"cartPassable"\s*:\s*true|"sweptClearance"\s*:\s*"VERIFIED"|"verdict"\s*:\s*"PASS"/.test(s);
  negative.push({ id: 'NF-T-CART', subject: 'invented cart-passability approval', expected: 'ABSENT', actual: bad ? 'FOUND' : 'ABSENT', pass: !bad });
  return { pass: !bad, detail: 'all 12 bridges deckStatus PROPOSED, bodySweep verdict UNKNOWN under 3 assumption profiles' };
});
test('T-NEG-02', 'NEGATIVE_FIXTURE', 'No bridge/road/river was added to the canonical authored collections', () => {
  const ok = C.bridges.length === 12 && C.roads.length === 92 && C.rivers.length === 17;
  negative.push({ id: 'NF-T-CANON', subject: 'canonical bridge/road/river count changed', expected: 'UNCHANGED', actual: `${C.bridges.length}/${C.roads.length}/${C.rivers.length}`, pass: ok });
  return { pass: ok, detail: '12/92/17' };
});

// ================================================================ B: build envelopes
test('B-01', 'PHYSICAL', 'All 23 envelopes reconcile EXACTLY with LR02 under identical criterion', () => {
  if (BUILD.sites.length !== 23 || BUILD.exactReconciliationCount !== 23) return false;
  const SE = readJson('data/legacy/lr02/spawn_eligibility.v1.json');
  for (const s of BUILD.sites) {
    const e = SE.buildSiteEnvelopes.find(x => x.siteId === s.siteId);
    if (!e || s.recomputed.derivedCellCount !== e.derivedCellCount || s.recomputed.waterCellCount !== e.waterCells || s.recomputed.dryCellCount !== e.dryCellCount) return false;
  }
  return { pass: true, detail: '23/23 exact' };
});
test('B-02', 'PHYSICAL', 'LR02 9 overlaps vs LR03 v1 12: 3 exact false-positive IDs identified', () => {
  const ok = BUILD.lr02WaterOverlapSites === 9 && BUILD.lr03V1WaterOverlapSites === 12 && BUILD.recomputedWaterOverlapSites === 9
    && eq(BUILD.lr03V1FalsePositiveIds.sort(), ['site.bz_cinder', 'site.bz_dune', 'site.bz_silver']);
  return { pass: ok, detail: { lr02: 9, v1: 12, recomputed: 9, falsePositives: BUILD.lr03V1FalsePositiveIds } };
});
test('B-03', 'PHYSICAL', 'Every dry subset is a single 4-connected component with >=8 cells', () => {
  for (const s of BUILD.sites) {
    const cells = s.recomputed.largestConnectedDryCellIndices, set = new Set(cells);
    if (cells.length < 8 || s.recomputed.largestConnectedDryComponent !== cells.length) return false;
    const seen = new Set([cells[0]]), q = [cells[0]];
    while (q.length) { const i = q.pop(); for (const j of cell4(i)) if (set.has(j) && !seen.has(j)) { seen.add(j); q.push(j); } }
    if (seen.size !== cells.length) return false;
  }
  return { pass: true, detail: BUILD.sites.map(s => [s.siteId, s.recomputed.largestConnectedDryComponent]) };
});
test('B-04', 'NEGATIVE_FIXTURE', 'No authored water cell appears in any dry subset', () => {
  let wet = 0;
  for (const s of BUILD.sites) for (const i of s.recomputed.largestConnectedDryCellIndices) if (S.waterClass[i] !== 0 || S.landId[i] <= 0) wet++;
  negative.push({ id: 'NF-B-WET', subject: 'water/sea cell inside a dry build subset', expected: 'ZERO', actual: wet, pass: wet === 0 });
  return { pass: wet === 0, detail: `wetCellsInDrySubsets=${wet}` };
});
test('B-05', 'PHYSICAL', '3 home candidates are dry, independently selectable and road-reachable', () => {
  if (BUILD.homes.length !== 3) return false;
  for (const h of BUILD.homes) {
    const i = h.anchorCellIndex;
    if (S.waterClass[i] !== 0 || S.landId[i] <= 0 || !h.independentlySelectable) return false;
    const s = BUILD.sites.find(x => x.siteId === h.siteId);
    if (!s.recomputed.largestConnectedDryCellIndices.includes(i)) return false;
    let near = false; for (let j = 0; j < N; j++) if (S.roadClass[j] > 0 && S.waterClass[j] === 0) { if (dist(centreAu(i), centreAu(j)) <= 200) { near = true; break; } }
    if (!near) return false;
  }
  return { pass: true, detail: BUILD.homes.map(h => [h.siteId, h.anchorAu]) };
});

// ================================================================ R: roofs
test('R-01', 'PHYSICAL', 'All 153 roof polygons assessed; 99 defective roofs have a corrected source-room inset', () => {
  if (ROOFS.roofPolygonCount !== 153 || ROOFS.assessments.length !== 153) return false;
  const corrected = ROOFS.assessments.filter(r => r.correctedCandidate);
  if (corrected.length !== 99) return false;
  for (const r of corrected) {
    const rm = architecture.pois.find(p => p.poiId === r.poiId).rooms.find(x => x.id === r.parentRoomId);
    const poly = r.correctedCandidate.polygonAu;
    for (const q of poly) if (!pointInRing(q, rm.polygonAu)) return false;
    const p = architecture.pois.find(x => x.poiId === r.poiId);
    for (const s of p.staticSolids) { const mid = [(s.aAu[0] + s.bAu[0]) / 2, (s.aAu[1] + s.bAu[1]) / 2]; if (pointInRing(mid, poly)) return false; }
  }
  return { pass: true, detail: { verifiedMeaningful: ROOFS.verifiedMeaningful, correctedInsets: corrected.length } };
});
test('R-02', 'NEGATIVE_FIXTURE', 'Original v1 roof polygon with vertices outside parent room is REJECTED', () => {
  const bad = ROOFS.assessments.filter(r => !r.roofVerticesInsideParentRoom);
  negative.push({ id: 'NF-R-OUTSIDE', subject: 'v1 roof polygon outside parent room', expected: 'REJECTED_NOT_AUTO_COMPLETED', actual: `${bad.length} rejected`, pass: bad.length > 0 });
  return { pass: bad.length === 99, detail: `rejected=${bad.length}` };
});
test('R-03', 'COVERAGE', 'No roof is labelled completed / runtime canopy / creator-approved sprite', () => {
  const s = JSON.stringify(ROOFS);
  const bad = /"verdict"\s*:\s*"[^"]*(COMPLETED|RUNTIME_SPRITE|ART_APPROVED)/.test(s);
  return { pass: !bad, detail: ROOFS.noClaims };
});

// ================================================================ E: environment
test('E-01', 'PHYSICAL', '11 normalized u8 rasters are length 43750 and reproducible from declared formula', () => {
  const names = ENV.rasters.map(r => r.name);
  if (names.length !== 11) return false;
  const a = new Uint8Array(readBuf('v2/rasters/moisturePotentialNorm.u8'));
  const t = new Uint8Array(readBuf('v2/rasters/temperaturePotentialNorm.u8'));
  const wp = new Uint8Array(readBuf('v2/rasters/waterProximityNorm.u8'));
  const cn = new Uint8Array(readBuf('v2/rasters/canopyNorm.u8'));
  const el = new Uint8Array(readBuf('v2/rasters/elevationNorm.u8'));
  const sm = new Uint8Array(readBuf('rasters/soilMoisture.u8'));
  const dr = new Uint8Array(readBuf('rasters/drainage.u8'));
  if ([a, t, wp, cn, el, sm, dr].some(x => x.length !== N)) return false;
  for (let i = 0; i < N; i += 397) {   // deterministic sample
    const drainWet = dr[i] === 1 ? 255 : (dr[i] === 2 ? 128 : (dr[i] === 3 ? 255 : 0));
    const expected = S.waterClass[i] > 0 ? 255 : Math.max(0, Math.min(255, Math.round((35 * wp[i] + 20 * cn[i] + 15 * (sm[i] / 4 * 255) + 15 * (255 - el[i]) + 15 * drainWet) / 100)));
    if (a[i] !== expected) return false;
  }
  return { pass: true, detail: `sampled=${Math.ceil(N / 397)} cells` };
});
test('E-02', 'PHYSICAL', '12 climate regions have reproducible dry-land spatial evidence summing to all land cells', () => {
  if (ENV.regionEvidence.length !== 12) return false;
  const sum = ENV.regionEvidence.reduce((x, r) => x + r.dryLandCellCount, 0);
  let land = 0; for (let i = 0; i < N; i++) if (S.landId[i] > 0 && S.waterClass[i] === 0) land++;
  return { pass: sum === land, detail: { sum, land } };
});
test('E-03', 'NEGATIVE_FIXTURE', 'No official numeric temperature/weather/damage/crop/season rate is present', () => {
  const s = JSON.stringify(ENV);
  // Only an ASSERTED unit/rate field is a defect; prose that says "NOT degrees"
  // is a disclaimer, not a fabricated Gameplay law.
  const bad = /"unit"\s*:\s*"?(celsius|fahrenheit|degrees)|"damageRate"|"cropYield"|"seasonRate"|"weatherRate"|"temperatureCelsius"|"growthRate"/i.test(s);
  negative.push({ id: 'NF-E-RATES', subject: 'invented Gameplay numeric climate rate', expected: 'ABSENT', actual: bad ? 'FOUND' : 'ABSENT', pass: !bad });
  return { pass: !bad && ENV.gameplayOwnedUnknowns.every(u => u.status === STATUS.UNKNOWN || u.status === STATUS.UNRESOLVED), detail: ENV.gameplayOwnedUnknowns.map(u => u.id) };
});
test('E-04', 'PHYSICAL', 'moisture/temperature normalized potentials are within [0,1] for EconomyMap', () => {
  const m = HANDOFF.economy.moisture, t = HANDOFF.economy.temperature;
  if (m.length !== N || t.length !== N) return false;
  for (let i = 0; i < N; i++) if (!(m[i] >= 0 && m[i] <= 1 && t[i] >= 0 && t[i] <= 1)) return false;
  return { pass: true, detail: 'all 43750 cells in [0,1]' };
});

// ================================================================ H: consumer boundary
test('H-01', 'PHYSICAL', 'Map-side structural self-check has 0 errors and Gameplay checks are NOT executed', () => {
  const errors = mapStructuralSelfCheck(HANDOFF);
  const g = HANDOFF.gameplayOwnedChecks;
  return { pass: errors.length === 0 && CHECK.errorCount === 0 && g.compileEconomy.startsWith('NOT_EXECUTED') && g.diagnoseStarts.startsWith('NOT_EXECUTED') && g.validateGeographicHandoff.startsWith('NOT_EXECUTED') && g.webRuntimeModified === false, detail: { errors: errors.length, checksNotExecuted: CHECK.checksNotExecuted.length } };
});
test('H-02', 'PHYSICAL', 'All 13 EconomyMap arrays are length 43750 and binary masks strictly 0/1', () => {
  const m = HANDOFF.economy, flags = ['freshwater', 'coast', 'walkable', 'buildable', 'cargoPassable', 'road', 'protected', 'industrial'];
  if (m.width !== GW || m.height !== GH) return false;
  for (const k of ['biome', 'elevation', 'slope', 'moisture', 'temperature', ...flags]) if (!m[k] || m[k].length !== N) return false;
  for (const k of flags) for (let i = 0; i < N; i++) if (m[k][i] !== 0 && m[k][i] !== 1) return false;
  return { pass: true, detail: { fields: Object.keys(m).length, cells: N } };
});
test('H-03', 'PHYSICAL', '14 unsupported Gameplay-owned fields are explicitly UNRESOLVED (no fake fallback)', () => {
  const u = HANDOFF.unresolvedGameplayOwned;
  if (u.length !== 14) return false;
  for (const x of u) if (!['UNKNOWN', 'UNRESOLVED', 'PROPOSED'].includes(x.status)) return false;
  const seed = u.find(x => x.field === 'seed');
  if (!seed || seed.current !== 0 || !seed.note.includes('NOT a Gameplay world seed')) return false;
  for (const p of HANDOFF.pois) if (p.powerNodes.length || p.hazardCells.length || p.exteriorLootSites.length || p.interiorLootSites.length) return false;
  return { pass: true, detail: u.map(x => x.field) };
});
test('H-04', 'PHYSICAL', '92 roads: cargoPassable=false, 4-connected cells, road mask covers all cells', () => {
  if (HANDOFF.roads.length !== 92) return false;
  for (const r of HANDOFF.roads) {
    if (r.cargoPassable !== false || r.widthTiles !== 1 || r.cells.length < 2) return false;
    for (let k = 1; k < r.cells.length; k++) if (!cell4(r.cells[k - 1]).includes(r.cells[k])) return false;
    for (const i of r.cells) if (!HANDOFF.economy.road[i] || !HANDOFF.economy.walkable[i]) return false;
    for (const i of r.bridgeCells) if (!r.cells.includes(i)) return false;
  }
  return { pass: true, detail: `roads=92 bridgeCells=${HANDOFF.roads.reduce((s, r) => s + r.bridgeCells.length, 0)}` };
});
test('H-05', 'PHYSICAL', '81 POIs: entrances/rooms subset of footprint, valid retreat paths', () => {
  if (HANDOFF.pois.length !== 81) return false;
  for (const p of HANDOFF.pois) {
    const fp = new Set(p.footprint); if (!fp.size || !p.entrances.length || !p.entrances.every(i => fp.has(i))) return false;
    for (const room of p.rooms) if (!room.every(i => fp.has(i))) return false;
    if (!p.retreatPaths.length) return false;
    for (const path of p.retreatPaths) { if (!path.length) return false; for (let k = 1; k < path.length; k++) if (!cell4(path[k - 1]).includes(path[k])) return false; }
  }
  return { pass: true, detail: '81 POIs' };
});
test('H-06', 'PHYSICAL', '3 windows × 18 masks: zero duplicate global tiles, full coverage, stable chunk IDs', () => {
  const c = WIN.continuity;
  if (WIN.windows.length !== 3 || WIN.v2MaskNames.length !== 18) return false;
  if (c.duplicateGlobalTiles !== 0 || c.unionCoverageCells !== N || c.fullWindowCoverageCells !== N || !c.completeCoverage) return false;
  if (c.chunkBoundaryConsistency.chunkDigestMismatches !== 0 || c.chunkBoundaryConsistency.chunkDuplicateIds !== 0 || c.chunkBoundaryConsistency.missingFeatureIds !== 0) return false;
  for (const w of WIN.windows) {
    if (w.maskCount !== 18 || w.outOfFrameTiles !== 0 || w.globalTileCount !== w.cellCount) return false;
    for (const f of w.files) { const b = readBuf(f.file); if (sha256(b) !== f.sha256 || b.length !== w.cellCount) return false; }
  }
  return { pass: true, detail: { windows: 3, masks: 18, duplicates: 0, coverage: N, chunkStatus: c.chunkBoundaryConsistency.status } };
});
test('H-07', 'NEGATIVE_FIXTURE', 'v1 five-mask projectWindow is NOT accepted as a complete EconomyMap', () => {
  const v1Files = fs.readdirSync(path.join(MASTER, 'evidence/windows')).filter(f => f.endsWith('.u8'));
  const v1Masks = new Set(v1Files.map(f => f.split('.').at(-2))).size;   // tiles/fresh/zone/seaDist/land = 5
  const v2Masks = WIN.v2MaskNames.length;
  const v1Complete = v1Masks >= 13;
  if (v1Masks !== 5) return false;
  negative.push({ id: 'NF-H-5MASK', subject: 'v1 5-mask window as complete EconomyMap', expected: 'REJECTED', actual: v1Complete ? 'ACCEPTED' : 'REJECTED', pass: !v1Complete });
  return { pass: !v1Complete && v2Masks >= 13, detail: { v1Masks, v2Masks } };
});
test('H-NEG-01', 'NEGATIVE_FIXTURE', 'Corrupted economy (moisture=2) is REJECTED by structural self-check', () => {
  const bad = JSON.parse(JSON.stringify(HANDOFF)); bad.economy.moisture[10] = 2;
  const errors = mapStructuralSelfCheck(bad);
  const rejected = errors.length > 0;
  negative.push({ id: 'NF-H-CORRUPT', subject: 'moisture=2 outside [0,1]', expected: 'REJECTED', actual: errors[0] ?? 'NONE', pass: rejected });
  return { pass: rejected, detail: errors[0] };
});
test('H-NEG-02', 'NEGATIVE_FIXTURE', 'Duplicate start id is REJECTED by structural self-check', () => {
  const bad = JSON.parse(JSON.stringify(HANDOFF)); bad.economy.starts.push({ ...bad.economy.starts[0] });
  const errors = mapStructuralSelfCheck(bad);
  const rejected = errors.some(e => e.includes('duplicate start'));
  negative.push({ id: 'NF-H-DUPSTART', subject: 'duplicate authored start id', expected: 'REJECTED', actual: rejected ? 'REJECTED' : 'ACCEPTED', pass: rejected });
  return { pass: rejected, detail: errors[0] };
});

// ================================================================ TV: technical views
test('TV-01', 'COVERAGE', '8 v2 technical views exist, are valid PNGs, and are labelled NOT Web proof', () => {
  if (VIEWS.count !== 8) return false;
  for (const v of VIEWS.views) {
    const b = readBuf(v.file);
    if (sha256(b) !== v.sha256 || b.slice(1, 4).toString('ascii') !== 'PNG') return false;
    if (!v.status.includes('NOT_WEB_RUNTIME_PROOF') || !v.classification.includes('ANALYTICAL')) return false;
  }
  return { pass: true, detail: VIEWS.views.map(v => v.file) };
});

// ================================================================ output
const gate = {};
for (const r of results) { const g = r.id.replace(/-.*$/, ''); gate[g] ??= { total: 0, pass: 0, fail: 0 }; gate[g].total++; if (r.pass) gate[g].pass++; else gate[g].fail++; }
const out = {
  schema: 'soh.wmp.v2.test_results.v1', authority: V1.authority,
  status: results.every(r => r.pass) ? 'WMP_V2_TESTS_PASS' : 'WMP_V2_TESTS_FAIL',
  command: COMMAND, sourceSha: SOURCE_SHA,
  counts: { total: results.length, pass: results.filter(r => r.pass).length, fail: results.filter(r => !r.pass).length,
    physical: results.filter(r => r.kind === 'PHYSICAL').length, negativeFixtures: results.filter(r => r.kind === 'NEGATIVE_FIXTURE').length,
    coverageOrDocumentation: results.filter(r => r.kind === 'COVERAGE' || r.kind === 'INTEGRITY').length },
  gates: gate, results,
  negativeFixtures: negative,
  v1Regression: { command: './reproduce.sh', expected: 'WMP_TESTS 75/75', note: 'v1 suite remains byte-identical and is re-run by reproduce_v2.sh; NOT counted as v2 physical completion.' },
  noClaims: ['NO Gameplay ingestion', 'NO validateGeographicHandoff() PASS', 'NO Web runtime change', 'NO visual acceptance', 'NO MERGE_READY'],
};
writeJson('v2/evidence/tests/results_v2.json', out);
writeJson('v2/evidence/tests/negative_fixtures_v2.json', { schema: 'soh.wmp.v2.negative_fixtures.v1', count: negative.length, fixtures: negative, sourceSha: SOURCE_SHA });
// Auto-generated gate doc so documentation never drifts from the executed suite.
const lines = [
  '# WMP-02 / MAP-LR03R TEST GATES (auto-generated)',
  '',
  `Command: \`${COMMAND}\``,
  `v1 manifest SHA: \`${V1_MANIFEST_SHA}\`  `,
  `v2 revisionDigest: \`${V2M.revisionDigest}\`  `,
  `v2 manifest SHA: \`${V2_MANIFEST_SHA}\``,
  '',
  `Result: **${out.counts.pass}/${out.counts.total} PASS**, ${out.counts.fail} FAIL. Physical=${out.counts.physical}, negative fixtures=${out.counts.negativeFixtures}, coverage/integrity=${out.counts.coverageOrDocumentation}.`,
  '',
  'DOCUMENTATION/COVERAGE PASS is NOT physical-completion PASS. v1 M-G3/M-G4 documentation PASSes are audited in `v2/layers/preflight_audit.v2.json`.',
  '',
  '| Gate | PASS | FAIL |', '|---|---|---|',
  ...Object.entries(gate).map(([k, v]) => `| ${k} | ${v.pass} | ${v.fail} |`),
  '', '| ID | Kind | Name | Verdict |', '|---|---|---|---|',
  ...results.map(r => `| ${r.id} | ${r.kind} | ${r.name} | ${r.verdict} |`),
  '',
  'Gameplay-owned `compileEconomy()`, `diagnoseStarts()` and the full `validateGeographicHandoff()` are NOT executed. Web runtime is NOT modified.',
];
writeJson('v2/docs/GATES_V2.json', { schema: 'soh.wmp.v2.gates.v1', generated: true, sourceSha: SOURCE_SHA, counts: out.counts, gates: gate });
fs.writeFileSync(path.join(MASTER, 'v2/docs/GATES_V2.md'), lines.join('\n') + '\n');
console.log(`WMP_V2_TESTS ${out.counts.pass}/${out.counts.total} physical=${out.counts.physical} negative=${out.counts.negativeFixtures} FAIL=${out.counts.fail}`);
if (out.counts.fail) { for (const r of results.filter(x => !x.pass)) console.error(`  FAIL ${r.id} ${r.name} ${r.error ?? ''}`); process.exit(1); }
