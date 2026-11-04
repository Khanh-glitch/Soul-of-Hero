#!/usr/bin/env node
// MAP-LR01 Milestone C — full transport audit at verified SNAP_TOL=7.
// Outputs: transport.v1.json, route_graph.v1.json, build_sites.v1.json,
// transport_failures.v1.json. Nothing here claims cart passability: physical
// widths / deck spans / swept clearance are PROPOSED or UNKNOWN until measured.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVeyra, loadGeoInputs, writeJson, readJson, r4, dist, nearestOnLine, bbox, pipRings } from './lib/veyra.mjs';
import { buildNets, graphComponents, dijkstra, pathFrom, SNAP_TOL, DEFECT_TOL, ACCESS_R, DOCK_R, BRIDGE_R } from './lib/transport.mjs';
import { STATUS, idx, toCell, centre, GW, GH, CELL, N } from './lib/geo_compile.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.LR01_OUT ? path.resolve(process.env.LR01_OUT) : path.resolve(HERE, '../output');
const V = loadVeyra(), P = V.P, GEO = loadGeoInputs();
const B = readJson(path.join(OUT, 'geography.v1.json'));
const I = {};
for (const [k, v] of Object.entries(GEO.r1)) I[k] = v.data;
for (const [k, v] of Object.entries(GEO.r2)) I[k] = v.data;

const N7 = buildNets(P, SNAP_TOL);
const N8 = buildNets(P, DEFECT_TOL);
const footC = graphComponents(N7.foot, true), cartC = graphComponents(N7.cart, true), allC = graphComponents(N7.all, true);
const footCRaw = graphComponents(N7.foot), cartCRaw = graphComponents(N7.cart);
const nodeRoads = new Map();
for (const e of N7.foot.edges) {
  for (const n of [e.a, e.b]) {
    if (!nodeRoads.has(n)) nodeRoads.set(n, new Set());
    if (e.road) nodeRoads.get(n).add(e.road);
  }
}

// ---------------- 1. tolerance regression (tol 7 vs defective tol 8) ----------------
const compact = N => ({
  tol: N.tol, nodes: N.nodes.length,
  footEdges: N.foot.edges.length, cartEdges: N.cart.edges.length, allEdges: N.all.edges.length,
  roadSamples: N.stats.roadSamples, riverSamples: N.stats.riverSamples,
  selfMergedFootEdges: N.stats.selfMergedFoot, selfMergedCartEdges: N.stats.selfMergedCart,
});
const tolerance = {
  id: 'TOL-01',
  maplabSnapTolAu: SNAP_TOL, geo01JoinToleranceAu: DEFECT_TOL, resampleStepAu: 8,
  sourceRef: 'world_lab/geo02/source_excerpt/graph.ts :: SNAP_TOL=7, Idx.key, addEdge(a===b) return; geom.ts :: resample(...,8)',
  tol7: compact(N7), tol8: compact(N8),
  tol7Components: { foot: footC.count, cart: cartC.count, all: allC.count },
  tol8Components: { foot: graphComponents(N8.foot).count, cart: graphComponents(N8.cart).count },
  verdict: 'GEO01_TOLERANCE_NOT_THE_EDITOR_TOLERANCE__DERIVED_GRAPH_MUST_BE_REDERIVED_AT_7',
  explanation: 'At tol=8 exactly-8 au resample steps merge into one node, so addEdge(a===b) drops road edges. GEO-01 joinToleranceAu=8 defects are NOT preserved; tol=7 is used for every conclusion below.',
  status: STATUS.VALIDATED, owner: 'MAP',
};

// ---------------- 2. disconnected routes / false joins / classifications ----------------
const roadAudit = P.roads.map(r => {
  const ns = N7.roadNodes[r.id];
  const status = N7.roadEdgeStatus.filter(x => x.roadId === r.id);
  const blocked = status.filter(x => x.status === 'FOOT_BLOCKED').length;
  const skipped = status.filter(x => x.status.startsWith('SKIPPED')).length;
  const cartBlocked = status.filter(x => x.blockCart).length;
  const ends = ns ? [ns[0], ns[ns.length - 1]] : [];
  const comps = ends.map(n => footC.compOf.get(n) ?? null);
  const cartComps = ends.map(n => cartC.compOf.get(n) ?? null);
  const crossings = N7.crossings.filter(c => c.roadId === r.id);
  return {
    id: r.id, name: r.name, kind: r.kind, purpose: r.purpose, ford: r.ford ?? null, alt: r.alt ?? null,
    sourceRef: `project.roads[] where id=${r.id}`, status: STATUS.SOURCE,
    centrelineLengthAu: r4(r.points.slice(1).reduce((s, p, k) => s + dist(r.points[k], p), 0)),
    sampleCount: ns?.length ?? 0, edgeCount: status.length,
    footBlockedEdges: blocked, skippedEdges: skipped, cartBlockedEdges: cartBlocked,
    footEndpointComponents: comps, cartEndpointComponents: cartComps,
    footSplit: comps[0] !== null && comps[1] !== null && comps[0] !== comps[1],
    cartSplit: cartComps[0] !== null && cartComps[1] !== null && cartComps[0] !== cartComps[1],
    crossingCount: crossings.length, bridgedCrossings: crossings.filter(c => c.bridgeId).length,
    unbridgedCrossings: crossings.filter(c => !c.bridgeId).length,
    classificationIssues: [],
  };
});
for (const a of roadAudit) {
  if (a.kind === 'cart' && a.cartBlockedEdges > 0) a.classificationIssues.push('CART_ROAD_HAS_BLOCKED_CART_EDGES_AT_UNBRIDGED_OR_FOOT_ONLY_CROSSING');
  if (a.kind === 'cart' && a.cartSplit) a.classificationIssues.push('CART_CLASSIFICATION_BUT_ENDPOINTS_IN_DIFFERENT_CART_COMPONENTS');
  if (a.footSplit) a.classificationIssues.push('FOOT_ROUTE_SPLIT_ACROSS_COMPONENTS');
  if (a.kind === 'ferry' && !a.sampleCount) a.classificationIssues.push('FERRY_CENTRELINE_EXCLUDED_FROM_ROAD_GRAPH__NO_APPROVED_BOAT_RULE');
  if (a.kind === 'trail' && a.cartBlockedEdges === 0 && a.edgeCount > 0) a.classificationIssues.push('TRAIL_IS_NEVER_CART_PASSABLE__NO_PHYSICAL_CLEARANCE_DIMENSION');
}

const falseJoins = [];
for (const [n, roads] of nodeRoads) {
  if (roads.size < 2) continue;
  const q = N7.pos.get(n);
  if (!q) continue;
  const cell = toCell(q[0], q[1]);
  const wc = cell >= 0 ? I.waterClass[cell] : null;
  const clear = cell >= 0 ? I.clearanceCells[cell] : null;
  const land = cell >= 0 ? I.landId[cell] : null;
  let kind = 'JUNCTION_SNAPPED_WITHIN_7au';
  if (wc && wc > 0) kind = 'FALSE_JOIN_CANDIDATE__NODE_ON_WATER_CLASS';
  else if (clear !== null && clear <= 1) kind = 'UNVERIFIED_JUNCTION__CLEARANCE_LE_1_CELL';
  falseJoins.push({
    node: n, atAu: [r4(q[0]), r4(q[1])], roadIds: [...roads], roadCount: roads.size,
    waterClass: wc, clearanceCells: clear, landId: land, kind,
    status: kind.startsWith('FALSE_JOIN') || kind.startsWith('UNVERIFIED') ? STATUS.UNRESOLVED : STATUS.DERIVED,
    note: 'Snap nodes are editor topology, NOT proof of a physical junction. A 7 au snap across a barrier needs a deck/clearance proposal.',
  });
}
falseJoins.sort((a, b) => b.roadCount - a.roadCount);

// ---------------- 3. crossings / bridge placement / physical proposals ----------------
const crossingByBridge = new Map();
for (const c of N7.crossings) if (c.bridgeId) {
  if (!crossingByBridge.has(c.bridgeId)) crossingByBridge.set(c.bridgeId, []);
  crossingByBridge.get(c.bridgeId).push(c);
}
const bridgeAudit = P.bridges.map(b => {
  const cs = crossingByBridge.get(b.id) || [];
  const cell = toCell(b.at[0], b.at[1]);
  const clear = cell >= 0 ? I.clearanceCells[cell] : null;
  const wc = cell >= 0 ? I.waterClass[cell] : null;
  // Measured raster chord: walk the authored bridge axis across waterClass cells.
  const axis = [Math.cos(b.ang), Math.sin(b.ang)];
  let chordCells = 0;
  for (let s = -12; s <= 12; s++) {
    const q = [b.at[0] + axis[0] * s * CELL, b.at[1] + axis[1] * s * CELL];
    const j = toCell(q[0], q[1]);
    if (j >= 0 && I.waterClass[j] === 3) chordCells++;
  }
  const chordAu = chordCells * CELL;
  const availableWidthUpperBoundAu = clear === null ? null : r4(clear * CELL * 2);
  const nearestRoad = P.roads.map(r => ({ id: r.id, kind: r.kind, d: r4(nearestOnLine(r.points, b.at).d) })).sort((a, c) => a.d - c.d)[0];
  const nearestRiver = P.rivers.map(r => ({ id: r.id, d: r4(nearestOnLine(r.points, b.at).d) })).sort((a, c) => a.d - c.d)[0];
  return {
    id: b.id, name: b.name, atAu: b.at, angleRad: b.ang, load: b.load, conf: b.conf,
    sourceRef: `project.bridges[] where id=${b.id}`, status: STATUS.SOURCE,
    displayGlyphAu: { w: 13, h: 7.2 }, displayGlyphStatus: 'EDITOR_DISPLAY_ONLY__NOT_COLLISION_DIMENSION',
    graphCrossingsMatched: cs.length, crossingRoadIds: [...new Set(cs.map(c => c.roadId))], crossingRiverIds: [...new Set(cs.map(c => c.riverId))],
    nearestRoad, nearestRiver, rasterWaterClassAtCentre: wc, clearanceCellsAtCentre: clear,
    measuredRasterRiverChordCells: chordCells, measuredRasterRiverChordAu: chordAu,
    physicalDeckSpanAu: null, physicalDeckWidthAu: null, deckStatus: STATUS.UNRESOLVED,
    proposedDeck: {
      status: STATUS.PROPOSED, proposedSpanAu: chordAu ? r4(chordAu + 2 * CELL) : null,
      proposedWidthUpperBoundAu: availableWidthUpperBoundAu,
      basis: 'Raster river-centreline chord along the authored bridge axis + one 8 au bearing cell each side; width bounded by GEO-01 clearance BFS. PROPOSED geometry, NOT an authored deck.',
      clearanceEvidence: 'NOT_MEASURED__NO_SWEPT_CLEARANCE_ENVELOPE',
    },
    channelFitVerified: false, channelFitStatus: STATUS.UNRESOLVED,
    cartPassable: false, cartPassableStatus: 'NOT_CLAIMED__ROAD_WIDTH_DECK_SPAN_AND_SWEPT_CLEARANCE_UNMEASURED',
  };
});

// Per-road physical surface proposals, bounded by measured raster clearance.
const roadProposals = P.roads.map(r => {
  const samples = r.points;
  let minClear = 255, cells = 0;
  for (const q of samples) { const j = toCell(q[0], q[1]); if (j >= 0) { minClear = Math.min(minClear, I.clearanceCells[j]); cells++; } }
  const a = roadAudit.find(x => x.id === r.id);
  return {
    roadId: r.id, kind: r.kind, sourceRef: `project.roads[] where id=${r.id}`,
    authoredDisplayStrokeAu: r.kind === 'cart' ? 3.4 : 1.6,
    authoredDisplayStrokeStatus: 'EDITOR_DISPLAY_ONLY__NOT_A_PHYSICAL_WIDTH',
    physicalWidthAu: null, physicalWidthStatus: STATUS.UNRESOLVED,
    measuredMinClearanceCellsAtAuthoredVertices: minClear, sampledVertices: cells,
    availableWidthUpperBoundAu: minClear === 255 ? null : r4(minClear * CELL * 2),
    proposedSurface: {
      status: STATUS.PROPOSED, proposedHalfWidthAu: minClear === 255 ? null : r4(Math.min(minClear * CELL, 12)),
      basis: 'PROPOSED centreline buffer bounded by GEO-01 clearance BFS at authored vertices (8 au/cell). Not an authored road width and not a Gameplay collision surface.',
      surfaceStatus: 'PROPOSED_STATIC_GEOMETRY__GAMEPLAY_OWNS_SURFACE_AND_VEHICLE_RULES',
    },
    sweptClearanceAu: null, sweptClearanceStatus: 'UNKNOWN__CART_FOOTPRINT_AND_TRAILER_SWEEP_NOT_DEFINED',
    footBlockedEdges: a?.footBlockedEdges ?? null, cartBlockedEdges: a?.cartBlockedEdges ?? null,
    cartPassable: false, cartPassableStatus: 'NOT_CLAIMED__NO_CLEARANCE_EVIDENCE',
  };
});

// ---------------- 4. alternate routes (centreline connectivity only) ----------------
const nearestFootNode = (pt, maxd = 70) => N7.nearestActiveNode(N7.foot, pt, maxd);
const odPairs = [];
for (const s of P.spawns) {
  const nearZones = B.construction.zones.map(z => ({ id: z.id, d: dist(z.geometry.centroidAu, s.at) })).sort((a, b) => a.d - b.d).slice(0, 2);
  for (const z of nearZones) odPairs.push({ id: `${s.id}->${z.id}`, from: s.id, to: z.id, fromAu: s.at, toAu: B.construction.zones.find(x => x.id === z.id).geometry.centroidAu, priority: 'SPAWN_TO_NEAR_HOME_REGION' });
  const nearPoi = P.pois.map(p => ({ id: p.id, d: dist(p.at, s.at) })).sort((a, b) => a.d - b.d)[0];
  odPairs.push({ id: `${s.id}->${nearPoi.id}`, from: s.id, to: nearPoi.id, fromAu: s.at, toAu: P.pois.find(p => p.id === nearPoi.id).at, priority: 'SPAWN_TO_NEAR_POI' });
}
for (const e of P.elders.slice(0, 3)) {
  odPairs.push({ id: `sp_lake->${e.id}`, from: 'sp_lake', to: e.id, fromAu: P.spawns.find(s => s.id === 'sp_lake').at, toAu: e.approach[0], priority: 'ELDER_APPROACH' });
}
const routes = odPairs.map(od => {
  const src = nearestFootNode(od.fromAu), dst = nearestFootNode(od.toAu);
  if (!src || !dst) return { ...od, status: 'NO_GRAPH_ACCESS_NODE_WITHIN_70au', routeAu: null, alternate: null };
  const d1 = dijkstra(N7.foot, src), cost = d1.d.get(dst) ?? null;
  const p1 = pathFrom(d1.prev, src, dst);
  let alternate = null;
  if (p1 && p1.length > 3) {
    const mid = Math.floor(p1.length / 2);
    const cut = [p1[mid - 1], p1[mid]];
    const avoid = (a, b) => (a === cut[0] && b === cut[1]) || (a === cut[1] && b === cut[0]);
    const d2 = dijkstra(N7.foot, src, Infinity, avoid);
    const c2 = d2.d.get(dst) ?? null;
    alternate = {
      blockedEdge: cut, alternateRouteAu: c2 === null ? null : r4(c2),
      detourRatio: c2 === null || !cost ? null : r4(c2 / cost),
      exists: c2 !== null, status: c2 === null ? 'NO_ALTERNATE__SINGLE_CORRIDOR' : 'ALTERNATE_CENTRELINE_EXISTS',
    };
  }
  return {
    ...od, srcNode: src, dstNode: dst,
    shortestRouteAu: cost === null ? null : r4(cost), pathNodes: p1?.length ?? 0,
    compFrom: footC.compOf.get(src) ?? null, compTo: footC.compOf.get(dst) ?? null,
    sameComponent: (footC.compOf.get(src) ?? -1) === (footC.compOf.get(dst) ?? -2),
    alternate,
    status: cost === null ? 'DISCONNECTED_ON_FOOT_CENTRELINE_GRAPH' : 'CENTRELINE_CONNECTED__PASSABILITY_NOT_ASSESSED',
    note: 'Editor-topology Dijkstra. No ferry rule, bridge deck, slope law, cart clearance or survival cost applied.',
  };
});

// ---------------- 5. build sites (physical space, Gameplay owns placement) ----------------
const buildSites = B.construction.zones.map(z => {
  const ring = z.geometry.ringAu;
  const buildCells = [];
  for (let i = 0; i < N; i++) {
    const c = centre(i);
    if (pipRings(c, [ring]) && I.buildableCandidate[i]) buildCells.push(i);
  }
  const env = buildCells.length ? bbox(buildCells.map(centre)).map(r4) : null;
  const nearestSpawn = P.spawns.map(s => ({ id: s.id, d: r4(dist(z.geometry.centroidAu, s.at)) })).sort((a, b) => a.d - b.d)[0];
  const poiCount = P.pois.filter(p => pipRings(p.at, [ring])).length;
  const elderNear = P.elders.filter(e => nearestOnLine(e.outer, z.geometry.centroidAu, true).d < 200).map(e => e.id);
  const priority = (nearestSpawn ? Math.max(0, 400 - nearestSpawn.d) : 0) + poiCount * 20 + elderNear.length * 10 + z.buildSuitability.buildableCells / 10;
  return {
    siteId: `site.${z.id}`, parentZoneId: z.id, parentZoneName: z.name,
    sourceRef: `project.zones[] where id=${z.id}`, status: STATUS.DERIVED,
    footprintAu: ring, footprintBboxAu: z.geometry.bboxAu, footprintAreaAu2: z.geometry.areaAu2,
    buildableCells: buildCells.length, buildableFraction: z.buildSuitability.buildableFraction,
    proposedBuildEnvelopeAu: env, proposedBuildEnvelopeStatus: STATUS.PROPOSED,
    loadingEnvelopeAu: z.loadingSpace.bboxAu, loadingCells: z.loadingSpace.cells,
    loadingEnvelopeStatus: STATUS.PROPOSED,
    naturalChokeClusterIds: z.naturalChokepoints.clusterIds,
    nearestRoads: z.nearestRoads, nearestSpawn, poiCount, elderTerritoriesWithin200Au: elderNear,
    priorityScore: r4(priority), priorityRank: null,
    occupancyStatus: 'UNKNOWN', claimLegalityStatus: 'GAMEPLAY_OWNED',
    sweptClearanceAu: null, sweptClearanceStatus: 'UNKNOWN',
    owner: 'MAP_SUPPLIES_PHYSICAL_SPACE_AND_CONSTRAINTS__GAMEPLAY_OWNS_BUILDING_RULES_AND_PLACEMENT',
    note: 'A build site is a geometric envelope, NOT a permission to build, NOT a house, NOT a claim radius. A0 occupancy and Gameplay rules are not asserted.',
  };
});
buildSites.sort((a, b) => b.priorityScore - a.priorityScore);
buildSites.forEach((s, i) => { s.priorityRank = i + 1; });

// ---------------- 6. source-linked failure cases ----------------
const kilns = GEO.audit.audit.poiAccess;
const zero = GEO.audit.audit.zeroClearance.zeroClearanceCells[0];
const failures = [
  {
    id: 'F-C-01', featureIds: ['junction_tolerance'], unit: 'authoring_unit', coordinate: null,
    sourceFile: 'world_lab/geo02/source_excerpt/graph.ts; world_lab/geo01/output/geography.v1.json',
    sourceSha: `${GEO.fingerprints.geography.sha256.slice(0, 16)}`,
    expected: `Derived graph uses the Editor SNAP_TOL=${SNAP_TOL}.`,
    actual: `GEO-01 used joinToleranceAu=${DEFECT_TOL}; at tol=8 the ${N8.stats.roadSamples} road samples merge into ${N8.nodes.length} nodes and ${N8.stats.selfMergedFoot} foot edges self-drop, versus ${N7.stats.selfMergedFoot} at tol=7.`,
    owner: 'MAP', status: STATUS.VALIDATED, proposal: 'Use tol=7 for all transport conclusions; retain tol=8 only as a documented regression.',
  },
  {
    id: 'F-C-02', featureIds: ['po_kilns', kilns.nearestCartRoad.roadId, kilns.nearestFootRoad.roadId],
    unit: 'authoring_unit', coordinate: kilns.at,
    sourceFile: 'world_lab/geo02/output/corridor_audit.v1.json :: poiAccess',
    sourceSha: GEO.fingerprints.audit.sha256.slice(0, 16),
    expected: `A POI with cart logistics is within Editor ACCESS_R=${ACCESS_R} au of a cart road.`,
    actual: `nearest cart road ${kilns.nearestCartRoad.roadId} at ${kilns.nearestCartRoad.d} au; nearest foot/trail ${kilns.nearestFootRoad.roadId} at ${kilns.nearestFootRoad.d} au.`,
    owner: 'MAP', status: STATUS.PROPOSED,
    proposal: 'PROPOSED cart connector centreline + measurable surface width, OR retain po_kilns as foot-access-only. Both preserved as alternatives; macro geography unchanged.',
  },
  {
    id: 'F-C-03', featureIds: ['br_a', 'rd_b'], unit: 'authoring_unit', coordinate: P.bridges.find(b => b.id === 'br_a')?.at ?? null,
    sourceFile: 'world_lab/geo02/output/corridor_audit.v1.json :: bridgeCrossings',
    sourceSha: GEO.fingerprints.audit.sha256.slice(0, 16),
    expected: 'A cart-classified road crosses on a cart-load bridge with measured deck and clearance.',
    actual: `br_a load=${P.bridges.find(b => b.id === 'br_a')?.load}; foot-only bridge blocks the cart edge. Road width, deck span and swept clearance are UNDEFINED.`,
    owner: 'MAP', status: STATUS.UNRESOLVED,
    proposal: `Author PROPOSED deck polygon from the measured raster chord; keep cartPassable=false until swept clearance is evidenced.`,
  },
  {
    id: 'F-C-04', featureIds: ['br_4', 'rd_b', 'rv_grey_low'], unit: 'grid cell / authoring_unit',
    coordinate: zero.authoringAu, sourceFile: 'world_lab/geo02/output/corridor_audit.v1.json :: zeroClearance',
    sourceSha: GEO.fingerprints.audit.sha256.slice(0, 16),
    expected: 'A bridge approach has a measured swept-clearance envelope.',
    actual: `clearanceCells=0 at cell ${zero.cell} / ${JSON.stringify(zero.authoringAu)}; road width, channel width, deck span and cart footprint UNDEFINED.`,
    owner: 'MAP', status: STATUS.BLOCKED,
    proposal: 'Author PROPOSED deck span/width and road/river physical widths, then validate. Until then clearance stays UNKNOWN; no cart-passable RT-1 claim.',
  },
  {
    id: 'F-C-05', featureIds: P.roads.filter(r => r.kind === 'ferry').map(r => r.id), unit: 'authoring_unit', coordinate: null,
    sourceFile: 'project.roads[] where kind=ferry; PR44 issue comment 6606283007',
    sourceSha: V.fingerprint.sha256.slice(0, 16),
    expected: 'A ferry has an approved Gameplay boat rule and physical loading geometry.',
    actual: `${P.roads.filter(r => r.kind === 'ferry').length} authored ferry centrelines; PR44 HEAD has NO ferry/boat rule; docks have no berth geometry. ${N7.ferryLinks.filter(f => !f.to || !f.from).length} ferries lack a dock pair within 34 au.`,
    owner: 'GAMEPLAY', status: STATUS.BLOCKED,
    proposal: 'Map supplies dock approach/loading space; traversal stays BLOCKED until Gameplay owns the rule. Do not fabricate a boat.',
  },
  {
    id: 'F-C-06', featureIds: ['rd_13', 'rd_1w', 'rd_16'], unit: 'authoring_unit', coordinate: null,
    sourceFile: 'world_lab/scale01a/output/benchmark.v1.json :: RT-1',
    sourceSha: V.fingerprint.sha256.slice(0, 16),
    expected: 'A cart route is continuous on cart-classified roads.',
    actual: 'RT-1 includes kind=trail segments; trail is never cart-passable without a Gameplay rule and physical clearance.',
    owner: 'GAMEPLAY+MAP', status: STATUS.UNRESOLVED,
    proposal: 'Retain as foot corridor. Any cart scenario stays MODELLED_SCENARIO_ON_FOOT_ROUTE__NOT_CART_PASSABLE.',
  },
  {
    id: 'F-C-07', featureIds: P.rivers.map(r => r.id), unit: 'UNKNOWN_UNIT', coordinate: null,
    sourceFile: 'project.rivers[].width', sourceSha: V.fingerprint.sha256.slice(0, 16),
    expected: 'River width is a physical channel dimension usable for deck span fit.',
    actual: `width values ${Math.min(...P.rivers.map(r => r.width))}–${Math.max(...P.rivers.map(r => r.width))} have NO unit; GEO-01 rasterizes a centreline only.`,
    owner: 'MAP', status: STATUS.UNRESOLVED,
    proposal: 'Keep authored number; physicalChannelWidthAu=null until a creator-approved unit and transform exist.',
  },
];

// ---------------- package ----------------
const transport = {
  schema: 'soh.map.lr01.transport.v1', version: 1,
  status: 'MILESTONE_C__FULL_TRANSPORT_AUDIT_AT_SNAP_TOL_7__NO_CART_PASSABILITY_CLAIM',
  authority: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
  stage: 'STAGE_1_MAP_GEOGRAPHY',
  generatedBy: 'world_lab/lr01/src/c_transport.mjs + src/lib/transport.mjs',
  source: {
    canon: V.fingerprint, geo01Geography: GEO.fingerprints.geography, geo02Audit: GEO.fingerprints.audit,
    geo02Encoding: GEO.fingerprints.encoding, maplabSourceExcerpt: 'world_lab/geo02/source_excerpt/{graph.ts,geom.ts} (SHA256SUMS)',
    geographyPackage: 'world_lab/lr01/output/geography.v1.json @ Milestone B',
    gameplayBenchmark: 'PR44 issue comment 6606283007',
  },
  frame: B.frame,
  constants: { SNAP_TOL, DEFECT_TOL, ACCESS_R, DOCK_R, BRIDGE_R, RESAMPLE_STEP: 8, source: 'verbatim MapStudio graph.ts' },
  toleranceRegression: tolerance,
  graph: {
    tol: SNAP_TOL, nodes: N7.nodes.length,
    footEdges: N7.foot.edges.length, cartEdges: N7.cart.edges.length,
    waterEdges: N7.water.edges.length, allEdges: N7.all.edges.length,
    footComponentsActive: footC.count, cartComponentsActive: cartC.count, allComponentsActive: allC.count,
    footComponentsIncludingIsolatedNodes: footCRaw.count, cartComponentsIncludingIsolatedNodes: cartCRaw.count,
    isolatedNodeInflation: { foot: footCRaw.count - footC.count, cart: cartCRaw.count - cartC.count, note: 'Idx.key inserts every sample into all five graphs; components over active edges are the meaningful transport network.' },
    footComponentSizes: [...footC.sizes].sort((a, b) => b - a).slice(0, 20),
    cartComponentSizes: [...cartC.sizes].sort((a, b) => b - a).slice(0, 20),
    crossingsMatchGeo02: N7.crossings.length === GEO.audit.audit.bridgeCrossings.allCrossings.length,
    crossingsGeo02Count: GEO.audit.audit.bridgeCrossings.allCrossings.length,
    status: STATUS.DERIVED,
  },
  roads: roadAudit,
  roadsWithClassificationIssues: roadAudit.filter(a => a.classificationIssues.length).length,
  disconnectedFootRoads: roadAudit.filter(a => a.footSplit).map(a => a.id),
  disconnectedCartRoads: roadAudit.filter(a => a.cartSplit).map(a => a.id),
  falseJoins: { count: falseJoins.length, flagged: falseJoins.filter(f => f.status !== STATUS.DERIVED).length, top: falseJoins.slice(0, 40) },
  crossings: { count: N7.crossings.length, bridged: N7.crossings.filter(c => c.bridgeId).length, unbridged: N7.crossings.filter(c => !c.bridgeId).length, bridgelessSegments: N7.bridgeless.length, records: N7.crossings },
  bridges: bridgeAudit,
  roadPhysicalProposals: roadProposals,
  ferries: N7.ferryLinks,
  poiAccess: {
    footWithinAccessR: Object.values(N7.poiFoot).filter(Boolean).length,
    cartWithinAccessR: Object.values(N7.poiCart).filter(Boolean).length,
    waterWithin70au: Object.values(N7.poiWater).filter(Boolean).length,
    poiCount: P.pois.length,
    noCartAccess: Object.entries(N7.poiCart).filter(([, v]) => !v).map(([k]) => k),
    status: STATUS.DERIVED,
  },
  alternateRoutes: routes,
  alternateRoutesWithAlternate: routes.filter(r => r.alternate?.exists).length,
  buildSites: { count: buildSites.length, top10: buildSites.slice(0, 10), status: 'DERIVED_GEOMETRY_PLUS_PROPOSED_ENVELOPES' },
  failures,
  proposedChanges: [
    { id: 'PC-C-01', subject: 'physical road surface widths', status: STATUS.PROPOSED, owner: 'MAP', detail: 'Per-road centreline buffers bounded by measured GEO-01 clearance; see roadPhysicalProposals. NOT authored widths.' },
    { id: 'PC-C-02', subject: 'bridge deck polygons', status: STATUS.PROPOSED, owner: 'MAP', detail: '12 PROPOSED deck spans from measured raster river chords; channel fit UNVERIFIED.' },
    { id: 'PC-C-03', subject: 'swept clearance envelope', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY', detail: 'Cart footprint / trailer sweep are Gameplay-owned; Map cannot assert clearance.' },
    { id: 'PC-C-04', subject: 'cart connector to po_kilns', status: STATUS.PROPOSED, owner: 'MAP', detail: 'Alternative A: authored connector; Alternative B: foot-access-only POI. Macro geography unchanged.' },
    { id: 'PC-C-05', subject: 'dock berth / loading geometry', status: STATUS.PROPOSED, owner: 'MAP', detail: 'Map authors loading space; Gameplay owns boat rule.' },
  ],
  unresolved: [
    { id: 'UN-C-01', subject: 'approved ferry/boat rule', status: STATUS.BLOCKED, owner: 'GAMEPLAY' },
    { id: 'UN-C-02', subject: 'physical river channel width unit', status: STATUS.UNRESOLVED, owner: 'MAP' },
    { id: 'UN-C-03', subject: 'swept clearance / cart footprint', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY' },
    { id: 'UN-C-04', subject: '12-code biome to Gameplay terrain mapping', status: STATUS.UNRESOLVED, owner: 'GAMEPLAY' },
    { id: 'UN-C-05', subject: 'runtime au->tile transform', status: STATUS.UNDECIDED, owner: 'CREATOR/GAMEPLAY_INTEGRATION' },
  ],
  noClaims: [
    'NO cart-passable claim without physical clearance evidence', 'NO bridge glyph as collision dimension',
    'NO tolerance-8 defect preserved', 'NO fabricated ferry/boat rule', 'NO building rules or houses',
    'NO runtime resource instances / vehicle speeds / weights', 'NO playable survival acceptance',
    'NO macro-geography rewrite', 'NO canonical Veyra edit',
  ],
};
writeJson(path.join(OUT, 'transport.v1.json'), transport);
writeJson(path.join(OUT, 'route_graph.v1.json'), {
  schema: 'soh.map.lr01.route_graph.v1', tol: SNAP_TOL, status: STATUS.DERIVED,
  nodeCount: N7.nodes.length,
  nodes: N7.nodes.map(n => ({ id: n, atAu: (N7.pos.get(n) || [null, null]).map(r4) })),
  footEdges: N7.foot.edges.map(e => ({ a: e.a, b: e.b, w: r4(e.w), road: e.road ?? null, kind: e.kind ?? null })),
  cartEdges: N7.cart.edges.map(e => ({ a: e.a, b: e.b, w: r4(e.w), road: e.road ?? null, kind: e.kind ?? null })),
  components: { foot: { count: footC.count, sizes: footC.sizes }, cart: { count: cartC.count, sizes: cartC.sizes } },
  note: 'Editor-topology graph rederived at SNAP_TOL=7. Connectivity is NOT passability.',
});
writeJson(path.join(OUT, 'build_sites.v1.json'), {
  schema: 'soh.map.lr01.build_sites.v1', status: 'DERIVED_GEOMETRY_PLUS_PROPOSED_ENVELOPES__GAMEPLAY_OWNS_PLACEMENT',
  sourceSha256: V.fingerprint.sha256, count: buildSites.length, sites: buildSites,
});
writeJson(path.join(OUT, 'transport_failures.v1.json'), {
  schema: 'soh.map.lr01.transport_failures.v1', sourceSha256: V.fingerprint.sha256,
  count: failures.length, failures,
});

console.log(`C_TRANSPORT_OK tol7 nodes=${N7.nodes.length} footEdges=${N7.foot.edges.length} cartEdges=${N7.cart.edges.length} crossings=${N7.crossings.length} bridges=${bridgeAudit.length}`);
console.log(`  tol8 selfMergedFoot=${N8.stats.selfMergedFoot} tol7 selfMergedFoot=${N7.stats.selfMergedFoot} footComps=${footC.count} cartComps=${cartC.count}`);
console.log(`  roadIssues=${transport.roadsWithClassificationIssues} footSplit=${transport.disconnectedFootRoads.length} cartSplit=${transport.disconnectedCartRoads.length} falseJoins=${falseJoins.length} flagged=${transport.falseJoins.flagged}`);
console.log(`  poiFoot=${transport.poiAccess.footWithinAccessR}/81 poiCart=${transport.poiAccess.cartWithinAccessR}/81 altRoutes=${transport.alternateRoutesWithAlternate}/${routes.length} buildSites=${buildSites.length} failures=${failures.length}`);
