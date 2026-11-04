// MAP-LR02 M3 — broader physical world architecture from REAL source geometry.
// Proposals are explicit, grounded in surrounding raster/vector evidence and
// always labelled PROPOSED. Nothing here is canonized, and no forced land
// bridge, ferry rule, cart-passable verdict or swept clearance is invented.
import path from 'node:path';
import fs from 'node:fs';
import { LR01, CONST, r4, dist, readJson, norm, perp, lerp2 } from './lr02.mjs';
import { compileLocalContext, CELL, GW, GH, N } from './spawn_eligibility.mjs';

export { CELL, GW, GH };
export const idx = (gx, gy) => gy * GW + gx;
export const cellCentre = i => [(i % GW + 0.5) * CELL, (Math.floor(i / GW) + 0.5) * CELL];
export const bboxOf = ring => { const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r4); };
const inFrame = p => p[0] >= 0 && p[0] <= 2000 && p[1] >= 0 && p[1] <= 1400;

function rasterAt(I, p) {
  const gx = Math.floor(p[0] / CELL), gy = Math.floor(p[1] / CELL);
  if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) return null;
  const i = idx(gx, gy);
  return { cellIndex: i, gx, gy, centreAu: cellCentre(i), landId: I.landId[i], waterClass: I.waterClass[i], clearanceCells: I.clearanceCells[i], roadClass: I.roadClass[i], elevation: I.elevation[i], slope: I.slope[i], biomeCode: I.biomeCode[i], zoneId: I.zoneId[i], poiGeometryId: I.poiGeometryId[i], elderGeometryId: I.elderGeometryId[i] };
}
function nearestOnPolyline(p, points) {
  let best = { d: Infinity, at: null, segment: -1, t: 0 };
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k], b = points[k + 1], v = [b[0] - a[0], b[1] - a[1]], L2 = v[0] * v[0] + v[1] * v[1];
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / L2)) : 0;
    const q = [a[0] + v[0] * t, a[1] + v[1] * t], d = dist(p, q);
    if (d < best.d) best = { d: r4(d), at: q.map(r4), segment: k, t: r4(t) };
  }
  return best;
}
function polylineLength(points) { let s = 0; for (let k = 1; k < points.length; k++) s += dist(points[k - 1], points[k]); return r4(s); }

/** [732,652] br_4 / rd_b / rv_silver zero-clearance approach. */
export function bridgeApproachGeometry(sources, lr) {
  const { I, P } = sources;
  const t = lr.transport;
  const br = t.bridges.find(b => b.id === 'br_4');
  const crossing = t.crossings.records.find(c => c.bridgeId === 'br_4');
  const failure = t.failures.find(f => f.id === 'F-C-04');
  const river = P.rivers.find(r => r.id === crossing.riverId);
  const road = P.roads.find(r => r.id === crossing.roadId);
  const centre = br.atAu;
  const axis = [Math.cos(br.angleRad), Math.sin(br.angleRad)];
  const n = perp(axis);
  const zero = rasterAt(I, [732, 652]);
  // Measure dry-bank width at both deck ends from the real water raster.
  const bank = [];
  for (const sign of [-1, 1]) {
    const end = [centre[0] + axis[0] * 12 * sign, centre[1] + axis[1] * 12 * sign];
    let dry = 0;
    for (const side of [-1, 1]) {
      let k = 0;
      for (; k < 6; k++) {
        const q = [end[0] + n[0] * (k + 1) * CELL * side, end[1] + n[1] * (k + 1) * CELL * side];
        const r = rasterAt(I, q);
        if (!r || r.waterClass !== 0) break;
      }
      dry += k;
    }
    bank.push({ endAu: end.map(r4), dryBankCellsAcross: dry, dryBankWidthAu: dry * CELL, raster: rasterAt(I, end) });
  }
  const measuredLateralDryLandAu = bank.map(b => b.dryBankWidthAu);
  // Conservative PROPOSED static envelope: 3 x 8au cells wide, deliberately
  // BELOW the measured lateral dry land, never a vehicle/swept-clearance claim.
  const proposedWidthAu = Math.min(3 * CELL, Math.min(...measuredLateralDryLandAu));
  const halfW = proposedWidthAu / 2, halfS = br.proposedDeck.proposedSpanAu / 2;
  const deckPolygon = [[-halfS, -halfW], [halfS, -halfW], [halfS, halfW], [-halfS, halfW]]
    .map(([s, w]) => [r4(centre[0] + axis[0] * s + n[0] * w), r4(centre[1] + axis[1] * s + n[1] * w)]);
  const rdProps = t.roadPhysicalProposals.find(r => r.roadId === crossing.roadId);
  // Explicit approach centrelines on both banks, taken from REAL authored road
  // vertices nearest the crossing (no invented land bridge).
  const rv = road.points;
  const near = rv.map((p, k) => ({ p, k, d: dist(p, centre) })).sort((a, b) => a.d - b.d).slice(0, 4).sort((a, b) => a.k - b.k).map(x => x.p);
  return {
    id: 'arch.bridge.br_4.v1',
    subject: '[732,652] river / bridge approach clearance',
    status: 'DERIVED_DEFECT_PLUS_PROPOSED_GEOMETRY',
    sourceRefs: { bridge: br.sourceRef, road: road.sourceRef ?? `project.roads[] where id=${road.id}`, river: `project.rivers[] where id=${river.id}`, failure: failure.sourceFile, crossing: 'world_lab/lr01/output/transport.v1.json :: crossings.records[]' },
    authored: { bridgeId: br.id, bridgeName: br.name, atAu: centre, angleRad: br.angleRad, load: br.load, displayGlyphAu: br.displayGlyphAu, displayGlyphStatus: br.displayGlyphStatus, crossingAtAu: crossing.atAu, riverWidthAuthored: crossing.riverWidthAuthored, riverWidthUnit: 'UNDEFINED__EDITOR_STROKE', roadId: road.id, roadKind: road.kind, nearestRoadAu: br.nearestRoad.d, nearestRiverAu: br.nearestRiver.d },
    measured: {
      zeroClearanceCell: zero, zeroClearanceFailure: failure,
      rasterWaterClassAtBridgeCentre: br.rasterWaterClassAtCentre,
      clearanceCellsAtBridgeCentre: br.clearanceCellsAtCentre,
      measuredRasterRiverChordCells: br.measuredRasterRiverChordCells,
      measuredRasterRiverChordAu: br.measuredRasterRiverChordAu,
      bankMeasurements: bank,
      roadDisplayStrokeAu: rdProps.authoredDisplayStrokeAu,
      roadPhysicalWidthAu: rdProps.physicalWidthAu, roadPhysicalWidthStatus: rdProps.physicalWidthStatus,
      availableWidthUpperBoundAu: rdProps.availableWidthUpperBoundAu,
      sweptClearanceAu: rdProps.sweptClearanceAu, sweptClearanceStatus: rdProps.sweptClearanceStatus,
      cartPassable: br.cartPassable, cartPassableStatus: br.cartPassableStatus,
      channelFitVerified: br.channelFitVerified, channelFitStatus: br.channelFitStatus,
    },
    proposedGeometry: {
      status: 'PROPOSED', canonical: false,
      deckPolygonAu: deckPolygon, deckBboxAu: bboxOf(deckPolygon),
      proposedSpanAu: br.proposedDeck.proposedSpanAu, proposedWidthAu,
      measuredLateralDryLandAu,
      basis: `Measured ${br.measuredRasterRiverChordAu} au river-centreline chord along the authored bridge axis + one 8 au bearing cell each side (span=24 au). Width is a deliberately conservative 24 au (3 cells), bounded ABOVE by measured lateral dry land at both ends (${measuredLateralDryLandAu.join('/') } au), not by the 13x7.2 au editor glyph and not by any vehicle envelope.`,
      approachCentrelineAu: near.map(p => p.map(r4)), approachLengthAu: near.length > 1 ? polylineLength(near) : null,
      approachSource: `Authored ${road.id} vertices nearest ${br.id}; no new road is canonized.`,
      sweptClearanceAu: null, sweptClearanceStatus: 'UNKNOWN__CART_FOOTPRINT_AND_TRAILER_SWEEP_NOT_DEFINED',
      vehiclePassable: null, vehiclePassableStatus: 'JOINT_MAP_GAMEPLAY__NOT_ASSERTED',
      owner: 'MAP (static geometry) + GAMEPLAY (vehicle rules)',
    },
    physicalIssues: [
      { id: 'ISS-BR4-01', subject: 'zero raster clearance at [732,652]', evidence: { clearanceCells: zero?.clearanceCells, waterClass: zero?.waterClass, roadClass: zero?.roadClass }, status: 'BLOCKED', owner: 'MAP+GAMEPLAY' },
      { id: 'ISS-BR4-02', subject: 'bridge approach overlaps Elder protected geometry', evidence: { elderGeometryId: zero?.elderGeometryId, elderId: P.elders[(zero?.elderGeometryId ?? 1) - 1]?.id ?? null }, status: 'DERIVED_CONFLICT__GAMEPLAY_OWNS_ELDER_RULES', owner: 'MAP+GAMEPLAY', note: 'GEO-01 elderGeometryId>0 marks Elder outer/core/arena geometry overlap; no Elder rule is asserted.' },
    ],
    unresolved: [
      { id: 'U-BR4-01', subject: 'physical river channel width unit', status: 'UNRESOLVED', owner: 'MAP' },
      { id: 'U-BR4-02', subject: 'deck bearing / collision surface', status: 'UNRESOLVED', owner: 'GAMEPLAY' },
      { id: 'U-BR4-03', subject: 'swept clearance for loaded cart + trailer', status: 'UNKNOWN', owner: 'MAP+GAMEPLAY' },
      { id: 'U-BR4-04', subject: 'cart-passable verdict', status: 'BLOCKED', owner: 'GAMEPLAY' },
      { id: 'U-BR4-05', subject: 'Elder-territory traversal / building rule at the approach', status: 'UNKNOWN', owner: 'GAMEPLAY' },
    ],
    noClaims: ['NO cart-passable bridge', 'NO forced land bridge', 'NO physical width canonized', 'NO ferry/boat rule'],
  };
}

/** Road/trail topology defects with real coordinates, and only evidenced connectors. */
export function transportTopology(sources, lr) {
  const { I, P } = sources;
  const t = lr.transport;
  const roadById = new Map(P.roads.map(r => [r.id, r]));
  const allEndpoints = [];
  for (const r of P.roads) if (r.points?.length) for (const e of [r.points[0], r.points[r.points.length - 1]]) allEndpoints.push({ roadId: r.id, p: e });
  const disconnected = [];
  for (const id of [...new Set([...t.disconnectedFootRoads, ...t.disconnectedCartRoads])]) {
    const r = roadById.get(id);
    if (!r?.points?.length) continue;
    const pts = r.points, bbox = bboxOf(pts);
    let nearest = null;
    for (const e of allEndpoints) if (e.roadId !== id) {
      const d = dist(pts[0], e.p) < dist(pts[pts.length - 1], e.p) ? { d: dist(pts[0], e.p), from: pts[0] } : { d: dist(pts[pts.length - 1], e.p), from: pts[pts.length - 1] };
      if (!nearest || d.d < nearest.distanceAu) nearest = { roadId: e.roadId, atAu: e.p.map(r4), distanceAu: r4(d.d), fromAu: d.from.map(r4) };
    }
    const dry = nearest ? [rasterAt(I, nearest.fromAu), rasterAt(I, nearest.atAu)] : [];
    const coincident = !!(nearest && nearest.distanceAu < 1);
    const evidenced = !coincident && !!(nearest && nearest.distanceAu <= 40 && dry.every(x => x && x.landId > 0 && x.waterClass === 0));
    const proposedConnection = coincident
      ? { status: 'COINCIDENT_ENDPOINT__GRAPH_TOPOLOGY_DEFECT', canonical: false, geometryAu: null, basis: `The authored endpoint already coincides (${nearest.distanceAu} au) with ${nearest.roadId}; the SNAP_TOL=7 graph still reports a separate component. This is a FALSE DISCONNECT in editor topology, not a physical gap. No connector is needed or invented.`, owner: 'MAP' }
      : evidenced
        ? { status: 'PROPOSED', canonical: false, polylineAu: [nearest.fromAu, nearest.atAu], lengthAu: nearest.distanceAu, basis: 'Both endpoints are on dry land in the GEO-01 raster and within one 40 au join; editor SNAP_TOL=7 is NOT proof of a physical junction.', owner: 'MAP+GAMEPLAY' }
        : { status: 'NO_EVIDENCED_CONNECTION', note: 'No forced land bridge or ferry connector invented to make a graph test pass.', owner: 'MAP+GAMEPLAY' };
    disconnected.push({
      roadId: id, roadKind: r.kind, kind: coincident ? 'FALSE_DISCONNECT__COINCIDENT_ENDPOINT' : (t.disconnectedCartRoads.includes(id) ? 'CART_COMPONENT_SPLIT' : 'FOOT_COMPONENT_SPLIT'),
      bboxAu: bbox, vertexCount: pts.length, centrelineLengthAu: polylineLength(pts),
      nearestOtherRoadEndpoint: nearest, dryEndpointEvidence: dry.map(x => x ? { landId: x.landId, waterClass: x.waterClass, clearanceCells: x.clearanceCells } : null),
      proposedConnection, status: 'DERIVED_DEFECT',
    });
  }
  const falseJoins = t.falseJoins.top.map(j => ({
    node: j.node, atAu: j.atAu, roadIds: j.roadIds, roadCount: j.roadCount,
    waterClass: j.waterClass, clearanceCells: j.clearanceCells, landId: j.landId,
    kind: j.kind, status: 'EDITOR_SNAP_TOPOLOGY_ONLY__NOT_A_PHYSICAL_JUNCTION',
    note: 'A 7 au snap across a barrier needs an explicit deck/clearance proposal; none is asserted here.',
  }));
  const unbridged = t.crossings.records.filter(c => c.disposition !== 'BRIDGE_CART_LOAD').map(c => ({
    roadId: c.roadId, roadKind: c.roadKind, riverId: c.riverId, atAu: c.atAu,
    bridgeId: c.bridgeId, bridgeLoad: c.bridgeLoad, disposition: c.disposition,
    riverWidthAuthored: c.riverWidthAuthored, unit: 'UNDEFINED__EDITOR_STROKE',
    status: 'DERIVED_DEFECT', owner: 'MAP+GAMEPLAY',
  }));
  const bridges = t.bridges.map(b => ({
    id: b.id, atAu: b.atAu, load: b.load, displayGlyphAu: b.displayGlyphAu,
    measuredRasterRiverChordAu: b.measuredRasterRiverChordAu,
    proposedSpanAu: b.proposedDeck?.proposedSpanAu ?? null,
    channelFitVerified: b.channelFitVerified, cartPassable: b.cartPassable,
    status: 'PROPOSED_DECK__NOT_CANONICAL', owner: 'MAP+GAMEPLAY',
  }));
  const chokeClusters = lr.geography.connectivity.chokeClusters.top.map(c => ({ cluster: c.cluster, centroidAu: c.centroidAu, cells: c.cells, areaAu2: c.areaAu2, landIds: c.landIds, status: 'DERIVED_SPATIAL_NARROWNESS__NOT_A_COMBAT_CLAIM' }));
  return {
    id: 'arch.transport_topology.v1', status: 'DERIVED_TOPOLOGY_PLUS_PROPOSED_CONNECTORS',
    graph: t.graph, disconnectedRoads: disconnected,
    falseDisconnects: disconnected.filter(d => d.kind === 'FALSE_DISCONNECT__COINCIDENT_ENDPOINT').map(d => ({ roadId: d.roadId, coincidentWith: d.nearestOtherRoadEndpoint?.roadId, distanceAu: d.nearestOtherRoadEndpoint?.distanceAu, status: 'DERIVED_GRAPH_DEFECT__NO_PHYSICAL_GAP' })),
    evidencedConnectorProposals: disconnected.filter(d => d.proposedConnection.status === 'PROPOSED').length,
    noEvidenceConnections: disconnected.filter(d => d.proposedConnection.status === 'NO_EVIDENCED_CONNECTION').length,
    falseJoins, falseJoinCount: t.falseJoins.count, falseJoinFlagged: t.falseJoins.flagged,
    unbridgedCrossings: unbridged, crossingSummary: { count: t.crossings.count, bridged: t.crossings.bridged, unbridged: t.crossings.unbridged, bridgelessSegments: t.crossings.bridgelessSegments },
    bridges, chokeClusters,
    ferries: t.ferries.map(f => ({ ...f, status: 'BLOCKED__GAMEPLAY_OWNS_BOAT_MECHANIC', note: 'Source-authored centreline only; no approved ferry/boat rule, no forced land bridge.' })),
    alternateRoutes: { total: t.alternateRoutes.length, withAlternate: t.alternateRoutesWithAlternate, status: 'DERIVED', note: 'Alternative route existence is graph topology, not a physical swept-clearance claim.' },
    proposalPolicy: 'Physical widths, deck spans and connectors are PROPOSED only where surrounding raster/vector evidence supports them. Editor strokes, SNAP_TOL and display glyphs are NOT collision/passability laws. Vehicle swept clearance is joint with Gameplay and never asserted from editor strokes.',
    noClaims: ['NO forced land bridge', 'NO approved ferry/boat rule', 'NO cart-passable road or bridge verdict', 'NO physical road width canonized', 'NO swept clearance assertion'],
  };
}

/** po_kilns cart-access defect + two explicit, non-canonical alternatives. */
export function kilnsAccessGeometry(sources, lr) {
  const { I, P } = sources;
  const t = lr.transport;
  const poi = P.pois.find(p => p.id === 'po_kilns');
  const foot = poi.foot;
  const centroid = foot.reduce((a, p) => [a[0] + p[0] / foot.length, a[1] + p[1] / foot.length], [0, 0]).map(r4);
  const cartRoads = P.roads.filter(r => r.kind === 'cart' && r.points?.length);
  const nearestCart = cartRoads.map(r => ({ roadId: r.id, ...nearestOnPolyline(poi.at, r.points) })).sort((a, b) => a.d - b.d)[0];
  const footRoads = P.roads.filter(r => r.kind !== 'cart' && r.points?.length);
  const nearestFoot = footRoads.map(r => ({ roadId: r.id, ...nearestOnPolyline(poi.at, r.points) })).sort((a, b) => a.d - b.d)[0];
  const failure = t.failures.find(f => f.id === 'F-C-02');
  const rp = t.roadPhysicalProposals.find(r => r.roadId === nearestCart.roadId);
  const mid = lerp2(nearestCart.at, poi.at, 0.5);
  const connectorAu = [nearestCart.at, mid.map(r4), poi.at.map(r4)];
  const local = connectorAu.map(p => rasterAt(I, p));
  return {
    id: 'arch.po_kilns_access.v1', poiId: poi.id, arche: poi.arche, atAu: poi.at,
    footBboxAu: bboxOf(foot), footCentroidAu: centroid,
    status: 'DERIVED_DEFECT_PLUS_PROPOSED_ALTERNATIVES',
    sourceRefs: { poi: `project.pois[] where id=${poi.id}`, failure: failure.sourceFile, transport: 'world_lab/lr01/output/transport.v1.json' },
    measured: {
      nearestCartRoad: nearestCart, editorAccessRAu: 48, distanceOverAccessRAu: r4(nearestCart.d - 48),
      lr01ReportedNearestCartAu: 56.8792, lr01ReportedRoadId: 'rd_n',
      distanceMeasurementNote: 'This module measures to the authored polyline vertices (57.1604 au). LR01 C measured to its SNAP_TOL=7 smoothed sample nodes (56.8792 au). Both are editor-geometry distances; neither is a physical road width or cart clearance.',
      nearestFootOrTrailRoad: nearestFoot,
      authoredFailure: failure,
      roadPhysicalWidthAu: rp.physicalWidthAu, roadPhysicalWidthStatus: rp.physicalWidthStatus,
      proposedHalfWidthAu: rp.proposedSurface.proposedHalfWidthAu,
      sweptClearanceStatus: rp.sweptClearanceStatus,
      connectorRasterEvidence: local.map(x => x ? { gx: x.gx, gy: x.gy, landId: x.landId, waterClass: x.waterClass, clearanceCells: x.clearanceCells, roadClass: x.roadClass } : null),
    },
    alternatives: [
      { id: 'ALT-A', status: 'PROPOSED', canonical: false, name: 'cart connector centreline', polylineAu: connectorAu, lengthAu: polylineLength(connectorAu), proposedHalfWidthAu: rp.proposedSurface.proposedHalfWidthAu, basis: `Shortest dry-land connector from ${nearestCart.roadId} (measured ${nearestCart.d} au) to the ${poi.id} footprint; half-width bounded by GEO-01 clearance at ${nearestCart.roadId} vertices. NOT an authored road.`, owner: 'MAP+GAMEPLAY' },
      { id: 'ALT-B', status: 'PROPOSED', canonical: false, name: 'foot-access-only', geometryAu: null, basis: `${nearestFoot.roadId} already reaches the POI at ${nearestFoot.d} au; keep ${poi.id} as a foot/trail logistics site and do not invent a cart road.`, owner: 'MAP+GAMEPLAY' },
    ],
    decision: 'UNDECIDED__BOTH_ALTERNATIVES_PRESERVED',
    noClaims: ['NO canonical cart road added', 'NO cart-passable verdict', 'NO swept clearance', 'NO altered macro geography'],
  };
}

/** Dock / road approaches and usable loading areas from real envelopes. */
export function dockApproachGeometry(sources, lr) {
  const { I, P } = sources;
  const sites = readJson(path.join(LR01, 'output/build_sites.v1.json')).sites;
  const cart = P.roads.filter(r => r.kind === 'cart' && r.points?.length);
  const out = P.docks.map(d => {
    const nearestCart = cart.map(r => ({ roadId: r.id, ...nearestOnPolyline(d.at, r.points) })).sort((a, b) => a.d - b.d)[0];
    const r = rasterAt(I, d.at);
    const nearestSite = sites.map(s => ({ siteId: s.siteId, d: r4(dist(d.at, [(s.footprintBboxAu[0] + s.footprintBboxAu[2]) / 2, (s.footprintBboxAu[1] + s.footprintBboxAu[3]) / 2])) })).sort((a, b) => a.d - b.d)[0];
    const site = sites.find(s => s.siteId === nearestSite?.siteId);
    return {
      dockId: d.id, name: d.name, kind: d.kind, water: d.water, atAu: d.at,
      rasterAtDock: r, nearestCartRoad: nearestCart,
      nearestBuildSiteId: nearestSite?.siteId ?? null, nearestBuildSiteDistanceAu: nearestSite?.d ?? null,
      proposedLoadingAreaAu: site?.loadingEnvelopeAu ?? null,
      proposedLoadingAreaStatus: site ? 'PROPOSED_SPATIAL_CANDIDATE__NOT_A_PLATFORM_OR_PLACEMENT_GRANT' : 'NONE',
      approachStatus: nearestCart.d <= 48 ? 'CART_APPROACH_WITHIN_EDITOR_ACCESS_R' : 'NO_CLOSE_CART_APPROACH',
      owner: 'MAP_SUPPLIES_SPACE__GAMEPLAY_OWNS_PLACEMENT_AND_VEHICLES',
    };
  });
  const loading = sites.map(s => ({
    siteId: s.siteId, parentZoneId: s.parentZoneId,
    loadingEnvelopeAu: s.loadingEnvelopeAu, loadingCells: s.loadingCells,
    proposedBuildEnvelopeAu: s.proposedBuildEnvelopeAu, nearestCartRoad: s.nearestRoads?.[0] ?? null,
    status: 'PROPOSED_USABLE_LOADING_AREA__NOT_CANONICAL',
  }));
  return {
    id: 'arch.dock_approaches.v1', status: 'DERIVED_APPROACH_MEASUREMENTS_PLUS_PROPOSED_LOADING_AREAS',
    dockCount: out.length, docks: out,
    cartApproachWithin48Au: out.filter(d => d.approachStatus === 'CART_APPROACH_WITHIN_EDITOR_ACCESS_R').length,
    noCloseCartApproach: out.filter(d => d.approachStatus === 'NO_CLOSE_CART_APPROACH').length,
    loadingAreas: loading,
    note: 'Editor ACCESS_R=48 au is a diagnostic, NOT a physical frontage law. Loading envelopes are spatial candidates, not platforms, placement grants or swept-clearance proofs.',
    noClaims: ['NO dock platform canonized', 'NO placement grant', 'NO vehicle swept clearance'],
  };
}

/** Per-archetype physical access pattern from real POI/road geometry. */
export function archetypeAccess(sources, lr) {
  const { P } = sources;
  const t = lr.transport;
  const noCart = new Set(t.poiAccess.noCartAccess);
  const groups = {};
  for (const p of P.pois) {
    const k = p.arche || 'unknown';
    groups[k] = groups[k] || { arche: k, poiCount: 0, cartAccessCount: 0, footOnlyPoiIds: [], poiIds: [] };
    groups[k].poiCount++; groups[k].poiIds.push(p.id);
    if (!noCart.has(p.id)) groups[k].cartAccessCount++; else groups[k].footOnlyPoiIds.push(p.id);
  }
  return {
    id: 'arch.archetype_access.v1', status: 'DERIVED_ACCESS_PATTERN__NOT_A_GAMEPLAY_RULE',
    footWithinEditorAccessR: t.poiAccess.footWithinAccessR, cartWithinEditorAccessR: t.poiAccess.cartWithinAccessR,
    poiCount: t.poiAccess.poiCount, noCartAccessCount: t.poiAccess.noCartAccess.length,
    archetypes: Object.values(groups).sort((a, b) => a.arche.localeCompare(b.arche)),
    note: 'ACCESS_R=48 au is an editor diagnostic. Cart access is graph proximity, NOT a loaded-cart swept-clearance or delivery claim.',
  };
}

/** Representative coast / island / wetland / industrial / Elder regions. */
export function representativeRegions(sources, lr, portalPackage) {
  const specs = [
    { id: 'zone_bz_hook', kind: 'COAST', label: 'Hook coast and port approaches', pad: 90 },
    { id: 'land_ld_saltwick', kind: 'ISLAND', label: 'Saltwick island / sea separation', pad: 70 },
    { id: 'zone_bz_delta', kind: 'WETLAND', label: 'Delta wetland / river mouth', pad: 70 },
    { id: 'zone_bz_slag', kind: 'INDUSTRIAL', label: 'Slag industrial terrace', pad: 70 },
    { id: 'elder_el_typhon', kind: 'ELDER_TERRITORY', label: 'Typhon Elder outer / core / arenas', pad: 60 },
    { id: 'land_ld_ironholm', kind: 'ISLAND', label: 'Ironholm island / southern approach', pad: 70 },
  ];
  const regionFile = id => path.join(LR01, 'output/regions', `${id}.v1.json`);
  const allSites = readJson(path.join(LR01, 'output/build_sites.v1.json')).sites;
  const out = specs.map(sp => {
    const j = readJson(regionFile(sp.id));
    let b = j.geometry?.bboxAu;
    if (!b) {
      const ring = j.geometry?.ringsAu?.[0] || j.geometry?.outerAu || j.geometry?.ringAu;
      if (ring?.length) b = bboxOf(ring);
    }
    if (!b) return { id: sp.id, kind: sp.kind, status: 'BLOCKED__NO_REGION_GEOMETRY' };
    const windowAu = [Math.max(0, b[0] - sp.pad), Math.max(0, b[1] - sp.pad), Math.min(2000, b[2] + sp.pad), Math.min(1400, b[3] + sp.pad)].map(r4);
    const ctx = compileLocalContext(sources, lr, { id: sp.id, label: sp.label, windowAu });
    const poisIn = (portalPackage?.acceptance?.perPoi ?? []).filter(p => {
      const lay = portalPackage?.pois?.find(x => x.poiId === p.poiId);
      if (!lay) return false;
      const fb = lay.entryGeometry?.entryCentreAu;
      return fb && fb[0] >= windowAu[0] && fb[0] <= windowAu[2] && fb[1] >= windowAu[1] && fb[1] <= windowAu[3];
    }).map(p => ({ poiId: p.poiId, arche: p.arche, verdict: p.verdict, staticSolids: p.staticSolids, staticOpenings: p.staticOpenings, exceptions: p.exceptions.length }));
    const proposals = [];
    for (const s of allSites) {
      const c = [(s.footprintBboxAu[0] + s.footprintBboxAu[2]) / 2, (s.footprintBboxAu[1] + s.footprintBboxAu[3]) / 2];
      if (c[0] >= windowAu[0] && c[0] <= windowAu[2] && c[1] >= windowAu[1] && c[1] <= windowAu[3]) proposals.push({
        id: `proposal.${sp.id}.${s.siteId}`, kind: 'USABLE_LOADING_AREA', geometryAu: s.loadingEnvelopeAu,
        parentZoneId: s.parentZoneId, status: 'PROPOSED', canonical: false,
        basis: 'LR01 build-site loading envelope derived from cart-road/dock cargo candidates; spatial candidate only.',
      });
    }
    for (const r of ctx.canonicalFeatures.roads.filter(x => x.kind === 'cart').slice(0, 3)) proposals.push({
      id: `proposal.${sp.id}.${r.id}`, kind: 'ROAD_APPROACH_CENTRELINE', geometryAu: r.bboxAu,
      status: 'SOURCE_AUTHORED_CENTRELINE__NO_PHYSICAL_WIDTH', canonical: true,
      basis: `Authored ${r.id} centreline within the region window; width remains UNRESOLVED.`,
    });
    for (const c of (lr.geography.connectivity.chokeClusters.top ?? [])) if (c.centroidAu[0] >= windowAu[0] && c.centroidAu[0] <= windowAu[2] && c.centroidAu[1] >= windowAu[1] && c.centroidAu[1] <= windowAu[3]) proposals.push({
      id: `proposal.${sp.id}.choke.${c.cluster}`, kind: 'SPATIAL_CHOKEPOINT', atAu: c.centroidAu, areaAu2: c.areaAu2,
      status: 'DERIVED_SPATIAL_NARROWNESS', canonical: false, basis: 'GEO-01 clearanceCells <= 2 cluster; geometric narrowness, not a combat or route claim.',
    });
    return {
      id: sp.id, kind: sp.kind, label: sp.label, regionKind: j.kind,
      regionBboxAu: b, windowAu,
      sourceRef: j.sourceRef ?? `world_lab/lr01/output/regions/${sp.id}.v1.json`,
      regionGeometrySummary: {
        bboxAu: b, areaAu2: j.geometry?.areaAu2 ?? null, centroidAu: j.geometry?.centroidAu ?? null,
        ringCount: j.geometry?.ringCount ?? null, outerVertexCount: j.geometry?.outerVertexCount ?? null,
        holeCount: j.geometry?.holeCount ?? null, approachLengthAu: j.geometry?.approachLengthAu ?? null,
        fullGeometryRef: `$.lr01RegionSummary.geometry or world_lab/lr01/output/regions/${sp.id}.v1.json`,
      },
      rasterCellStats: ctx.cellStats,
      canonicalFeatures: ctx.canonicalFeatures,
      lr01RegionSummary: ctx.lr01Region,
      poiGeometry: poisIn, poiCount: poisIn.length,
      proposedGeometries: proposals,
      physicalIssues: [
        { id: `ISS.${sp.id}.width`, subject: 'physical road / channel width', status: 'UNRESOLVED', owner: 'MAP' },
        { id: `ISS.${sp.id}.swept`, subject: 'vehicle swept clearance', status: 'UNKNOWN', owner: 'MAP+GAMEPLAY' },
        { id: `ISS.${sp.id}.ferry`, subject: 'ferry / boat rule', status: 'BLOCKED', owner: 'GAMEPLAY' },
      ],
      status: 'DERIVED_REGIONAL_SPATIAL_STRUCTURE__PROPOSALS_NOT_CANONIZED',
    };
  });
  return {
    id: 'arch.representative_regions.v1', status: 'DERIVED_MULTI_REGION_COVERAGE',
    regionCount: out.length, kinds: [...new Set(out.map(r => r.kind))],
    regions: out,
    note: 'Each region has real source raster, canonical vectors, POI geometry, loading/approach/chokes and explicit unresolved owners. No region is reduced to a feature-count row; no forced land bridge or unapproved ferry rule.',
  };
}

/** Terrain suitability near multiple build areas, measured independently. */
export function buildAreaSuitability(sources, lr, eligibility) {
  const { I, P } = sources;
  const sites = readJson(path.join(LR01, 'output/build_sites.v1.json')).sites;
  const regions = eligibility.candidateRegions;
  const regionCellSets = regions.map(r => ({ id: r.candidateId, set: new Set(r.geometry.cellIndices), bbox: r.geometry.bboxAu, support: r.support }));
  const rows = sites.map(s => {
    const c = [(s.footprintBboxAu[0] + s.footprintBboxAu[2]) / 2, (s.footprintBboxAu[1] + s.footprintBboxAu[3]) / 2];
    let nearest = null;
    for (const r of regionCellSets) {
      const dx = Math.max(r.bbox[0] - c[0], 0, c[0] - r.bbox[2]), dy = Math.max(r.bbox[1] - c[1], 0, c[1] - r.bbox[3]);
      const d = Math.hypot(dx, dy);
      if (!nearest || d < nearest.distanceAu) nearest = { candidateId: r.id, distanceAu: r4(d), cellCount: r.set.size, support: r.support };
    }
    const gx = Math.floor(c[0] / CELL), gy = Math.floor(c[1] / CELL), i = idx(gx, gy);
    return {
      siteId: s.siteId, parentZoneId: s.parentZoneId, centroidAu: c.map(r4),
      footprintAreaAu2: s.footprintAreaAu2, buildableCells: s.buildableCells,
      nearestEligibleCandidateRegion: nearest,
      localTerrain: { landId: I.landId[i], waterClass: I.waterClass[i], elevationRawByte: I.elevation[i], slopeRawDelta: I.slope[i], clearanceCells: I.clearanceCells[i], biomeCode: I.biomeCode[i] },
      roadFrontageAu: s.nearestRoads?.[0]?.d ?? null,
      status: 'DERIVED_TERRAIN_SUITABILITY__NOT_A_BUILD_GRANT',
    };
  });
  return {
    id: 'arch.build_area_suitability.v1', status: 'DERIVED_MULTI_AREA_TERRAIN_EVIDENCE',
    siteCount: rows.length, distinctCandidateRegionsReferenced: [...new Set(rows.map(r => r.nearestEligibleCandidateRegion?.candidateId).filter(Boolean))].length,
    rows,
    note: 'Terrain suitability is measured near multiple real build areas using source raster bytes, eligibility candidate regions and road frontage. No placement grant, claim legality or starter resource is asserted.',
  };
}

export function compileArchitecture(sources, lr, portalPackage, eligibility) {
  return {
    bridgeApproach: bridgeApproachGeometry(sources, lr),
    transportTopology: transportTopology(sources, lr),
    kilnsAccess: kilnsAccessGeometry(sources, lr),
    dockApproaches: dockApproachGeometry(sources, lr),
    archetypeAccess: archetypeAccess(sources, lr),
    buildAreaSuitability: buildAreaSuitability(sources, lr, eligibility),
    representativeRegions: representativeRegions(sources, lr, portalPackage),
  };
}
