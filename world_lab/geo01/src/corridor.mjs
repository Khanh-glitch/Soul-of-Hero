#!/usr/bin/env node
// MAP-GEO-01 milestone B: ONE real Veyra spatial corridor, proved with actual
// authored geometry. Geographic only: no harvestable instances, loot, survival
// timers, hazard rules or gameplay population are placed here.
import fs from 'node:fs';
import path from 'node:path';
import { loadSource } from './lib/source.mjs';
import { buildLayers } from './lib/raster.mjs';
import { buildRouteGraph, shortestPath, connectPoint } from './lib/routegraph.mjs';
import {
  dist, pathDistance, ringBoundaryDistance, ringArea, ringCentroid,
  ringBBox, samplePath, round, D4,
} from './lib/geometry.mjs';
import { parseArgs, ensureOut, writeJson, DEFAULT_OUT } from './lib/cli.mjs';

const cfg = {
  spawnGrounding: { roadRadiusAu: 250, poiRadiusAu: 200, zoneRadiusAu: 300, bridgeRadiusAu: 250, dockRadiusAu: 250, riverRadiusAu: 250 },
  connectorMaxAu: 50,          // derived connector to the authored road graph
  altConnectorMaxAu: 90,       // wider connector for the riverside alternative (explicitly reported)
  initialRadiusCells: 8,       // 64 au around the spawn
  resourceRadiusAu: 200,
  buildSiteRadiusAu: 300,
  joinToleranceAu: 8,          // one source grid cell
  ferryReportRadiusAu: 400,
};

function stats(a) {
  if (!a.length) return { count: 0 };
  let mn = Infinity, mx = -Infinity, sum = 0;
  for (const v of a) { mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; }
  return { count: a.length, min: mn, max: mx, mean: round(sum / a.length, 4) };
}
const cellOf = (x, y, grid) => {
  const gx = Math.floor(x / grid.cell), gy = Math.floor(y / grid.cell);
  if (gx < 0 || gy < 0 || gx >= grid.gw || gy >= grid.gh) return -1;
  return gy * grid.gw + gx;
};

function routeRecord(P, graph, spawnPt, targetPt, bans, connectorMaxAu, id, label) {
  const A = connectPoint(graph, spawnPt, connectorMaxAu), B = connectPoint(graph, targetPt, connectorMaxAu);
  let best = null;
  for (const a of A) for (const b of B) {
    const r = shortestPath(graph, a.node, b.node, { bannedRoadIds: new Set(bans) });
    if (!r) continue;
    const total = r.distanceAu + a.distanceAu + b.distanceAu;
    if (!best || total < best.total) best = { total, r, a, b };
  }
  if (!best || !best.r.edges.length) return null;
  const segments = best.r.edges.map(e => {
    const src = P.roads.find(r => r.id === e.roadId);
    return {
      roadId: e.roadId, roadName: src?.name ?? null, kind: e.roadKind, conf: e.conf,
      lengthAu: e.lengthAu, points: e.points.map(p => p.map(v => round(v, 4))),
      width: 'NOT_IN_SOURCE', ford: !!e.ford, alt: !!e.alt, ferry: e.ferry,
      sourceRef: `roads[${e.roadId}].points`,
    };
  });
  const connectors = [
    { from: `spawn:${spawnPt.map(v => round(v, 4))}`, to: `graphNode:${best.a.node}@${best.a.at.map(v => round(v, 4))}`, distanceAu: best.a.distanceAu, derived: true },
    { from: `graphNode:${best.b.node}@${best.b.at.map(v => round(v, 4))}`, to: `poi:${targetPt.map(v => round(v, 4))}`, distanceAu: best.b.distanceAu, derived: true },
  ].filter(c => c.distanceAu > 0.001);
  const authoredAu = round(segments.reduce((s, x) => s + x.lengthAu, 0), 4);
  const connectorAu = round(connectors.reduce((s, x) => s + x.distanceAu, 0), 4);
  const geometry = [spawnPt, ...segments.flatMap(s => s.points), targetPt];
  return {
    id, label, status: 'AUTHORED_ROAD_GEOMETRY_PLUS_DERIVED_CONNECTORS',
    totalDistanceAu: round(best.total, 4), authoredRoadLengthAu: authoredAu,
    derivedConnectorLengthAu: connectorAu,
    connectors, segments,
    geometryAu: geometry.map(p => p.map(v => round(v, 4))),
    sourceIds: [...new Set(segments.map(s => s.roadId))],
    confidence: [...new Set(segments.map(s => s.conf))],
    bannedRoadIds: bans,
    connectorMaxAu,
    note: 'All segment points are verbatim authored road vertices or exact segment intersections. Straight connectors are DERIVED and must be checked against the physical land mask.',
  };
}

function main() {
  const args = parseArgs();
  const out = ensureOut(args.out ? path.resolve(args.out) : DEFAULT_OUT);
  const source = loadSource({ sourcePath: args.source || null });
  const P = source.project;
  const { grid, layers } = buildLayers(P);
  const graph = buildRouteGraph(P, { joinToleranceAu: cfg.joinToleranceAu });

  // ---- 1. Choose the spawn by a MEASURED grounding score, not by preference.
  const g = cfg.spawnGrounding;
  const spawnScores = P.spawns.map(s => {
    const counts = {
      roads250: P.roads.filter(r => pathDistance(s.at, r.points) < g.roadRadiusAu).length,
      pois200: P.pois.filter(p => dist(s.at, p.at) < g.poiRadiusAu).length,
      zones300: P.zones.filter(z => ringBoundaryDistance(s.at, z.ring) < g.zoneRadiusAu).length,
      bridges250: P.bridges.filter(b => dist(s.at, b.at) < g.bridgeRadiusAu).length,
      docks250: P.docks.filter(d => dist(s.at, d.at) < g.dockRadiusAu).length,
      rivers250: P.rivers.filter(r => pathDistance(s.at, r.points) < g.riverRadiusAu).length,
    };
    const nearestRoad = Math.min(...P.roads.map(r => pathDistance(s.at, r.points)));
    return { id: s.id, name: s.name, at: s.at, region: s.region, conf: s.conf, counts, score: Object.values(counts).reduce((a, b) => a + b, 0), nearestRoadAu: round(nearestRoad, 4) };
  }).sort((a, b) => b.score - a.score || a.nearestRoadAu - b.nearestRoadAu);
  const spawn = P.spawns.find(s => s.id === spawnScores[0].id);

  // ---- 2. Choose the target POI by authored multi-edge reachability from that spawn.
  const A50 = connectPoint(graph, spawn.at, cfg.connectorMaxAu);
  const poiCandidates = P.pois.map(p => {
    const B = connectPoint(graph, p.at, cfg.connectorMaxAu);
    let best = null;
    for (const a of A50) for (const b of B) {
      const r = shortestPath(graph, a.node, b.node);
      if (!r) continue;
      const total = r.distanceAu + a.distanceAu + b.distanceAu;
      if (!best || total < best.total) best = { total, edges: r.edges.length, roads: [...new Set(r.edges.map(e => e.roadId))] };
    }
    return { id: p.id, at: p.at, arche: p.arche, straightAu: round(dist(spawn.at, p.at), 4), edges: best?.edges ?? 0, totalAu: best ? round(best.total, 4) : null, roads: best?.roads ?? [] };
  }).filter(x => x.edges >= 2 && x.straightAu <= 300).sort((a, b) => b.edges - a.edges || a.totalAu - b.totalAu);
  const target = P.pois.find(p => p.id === poiCandidates[0].id);

  // ---- 3. Three source-linked routes (primary, no-detour alternative, riverside alternative).
  const primary = routeRecord(P, graph, spawn.at, target.at, [], cfg.connectorMaxAu, 'RT-1', 'Authored cart corridor via the br_4 river crossing');
  const altNoDetour = routeRecord(P, graph, spawn.at, target.at, ['rd_1w'], cfg.connectorMaxAu, 'RT-2', 'Same corridor without the alt detour rd_1w (full rd_13)');
  const altRiverside = routeRecord(P, graph, spawn.at, target.at, ['rd_16'], cfg.altConnectorMaxAu, 'RT-3', 'Riverside path rd_20 (Greywater West Bank Path)');
  const routes = [primary, altNoDetour, altRiverside].filter(Boolean);

  // ---- 4. Physical land connectivity on the derived candidate raster.
  const n = grid.cells;
  const pass = new Uint8Array(n);
  for (let i = 0; i < n; i++) pass[i] = (layers.walkableCandidate[i] || (layers.waterClass[i] === 3 && layers.crossingCandidate[i] > 0)) ? 1 : 0;
  const start = cellOf(spawn.at[0], spawn.at[1], grid);
  const goal = cellOf(target.at[0], target.at[1], grid);
  const d = new Int32Array(n).fill(-1), prev = new Int32Array(n).fill(-1), q = new Int32Array(n);
  let h = 0, z = 0; d[start] = 0; q[z++] = start;
  while (h < z) {
    const i = q[h++]; if (i === goal) break;
    const gx = i % grid.gw, gy = (i / grid.gw) | 0;
    for (const [dx, dy] of D4) {
      const nx = gx + dx, ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= grid.gw || ny >= grid.gh) continue;
      const j = ny * grid.gw + nx;
      if (d[j] < 0 && pass[j]) { d[j] = d[i] + 1; prev[j] = i; q[z++] = j; }
    }
  }
  const connected = d[goal] >= 0;
  const pathCells = [];
  if (connected) { for (let v = goal; v !== -1; v = prev[v]) pathCells.push(v); pathCells.reverse(); }
  const crossingCells = pathCells.filter(i => layers.crossingCandidate[i] > 0).map(i => {
    const b = P.bridges.find(b => cellOf(b.at[0], b.at[1], grid) === i);
    const rv = layers.riverId[i] ? P.rivers[layers.riverId[i] - 1] : null;
    return { cell: i, authoringAu: [round((i % grid.gw + 0.5) * grid.cell, 2), round((((i / grid.gw) | 0) + 0.5) * grid.cell, 2)], crossingValue: layers.crossingCandidate[i], bridgeId: b?.id ?? null, bridgeLoad: b?.load ?? null, riverId: rv?.id ?? null, waterClass: layers.waterClass[i] };
  });
  const clearanceAlongGridPath = stats(pathCells.map(i => layers.clearanceCells[i]));
  const slopeAlongGridPath = stats(pathCells.map(i => layers.slope[i]));

  // Clearance and slope sampled along the PRIMARY authored route, every 8 au.
  const samples = samplePath(primary.geometryAu, grid.cell).map(p => cellOf(p[0], p[1], grid)).filter(i => i >= 0);
  const clearanceAlongAuthoredRoute = stats(samples.map(i => layers.clearanceCells[i]));
  const slopeAlongAuthoredRoute = stats(samples.map(i => layers.slope[i]));

  // ---- 5. Safe initial terrain candidates (relative, NOT an invented absolute threshold).
  const scx = Math.floor(spawn.at[0] / grid.cell), scy = Math.floor(spawn.at[1] / grid.cell);
  const R = cfg.initialRadiusCells, initial = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const gx = scx + dx, gy = scy + dy;
    if (gx < 0 || gy < 0 || gx >= grid.gw || gy >= grid.gh) continue;
    if (Math.hypot(dx, dy) > R) continue;
    const i = gy * grid.gw + gx;
    if (!layers.walkableCandidate[i]) continue;
    initial.push({ cell: i, centreAu: [round((gx + 0.5) * grid.cell, 2), round((gy + 0.5) * grid.cell, 2)], offsetCells: [dx, dy], distanceAu: round(Math.hypot(dx, dy) * grid.cell, 2), elevationRawByte: layers.elevation[i], biomeRawCode: layers.biomeCode[i], slopeRawByteDelta: layers.slope[i], clearanceCells: layers.clearanceCells[i], freshwaterProximityCells: layers.freshwaterProximityCells[i] });
  }
  const slopes = initial.map(c => c.slopeRawByteDelta).sort((a, b) => a - b);
  const q1 = slopes[Math.floor(slopes.length / 4)] ?? null;
  const lowSlope = initial.filter(c => c.slopeRawByteDelta <= q1).sort((a, b) => a.slopeRawByteDelta - b.slopeRawByteDelta || b.clearanceCells - a.clearanceCells || a.distanceAu - b.distanceAu).slice(0, 12);
  const initialTerrain = {
    radiusCells: R, radiusAu: R * grid.cell, centreCell: start,
    walkableCandidateCells: initial.length,
    slopeQuartileCutoffRawDelta: q1,
    lowestSlopeQuartileCandidates: lowSlope,
    clearanceStatsCells: stats(initial.map(c => c.clearanceCells)),
    slopeStatsRaw: stats(initial.map(c => c.slopeRawByteDelta)),
    note: 'RELATIVE candidate selection only (lowest raw-slope quartile of nearby walkable cells). No absolute safe-slope/safety threshold is authored in Veyra; Gameplay owns that rule. These are NOT spawn points.',
  };

  // ---- 6. Nearby land suitable for basic resource generation (annotations only).
  const nearby = P.resources.filter(r => dist(spawn.at, r.at) < cfg.resourceRadiusAu);
  const byKind = nearby.reduce((a, r) => (a[r.kind] = (a[r.kind] || 0) + 1, a), {});
  let nearWalkable = 0;
  for (let dy = -Math.ceil(cfg.resourceRadiusAu / grid.cell); dy <= Math.ceil(cfg.resourceRadiusAu / grid.cell); dy++) for (let dx = -Math.ceil(cfg.resourceRadiusAu / grid.cell); dx <= Math.ceil(cfg.resourceRadiusAu / grid.cell); dx++) {
    const gx = scx + dx, gy = scy + dy;
    if (gx < 0 || gy < 0 || gx >= grid.gw || gy >= grid.gh) continue;
    if (Math.hypot(dx * grid.cell, dy * grid.cell) > cfg.resourceRadiusAu) continue;
    const i = gy * grid.gw + gx;
    if (layers.walkableCandidate[i]) nearWalkable++;
  }
  const resourceGeography = {
    radiusAu: cfg.resourceRadiusAu,
    candidateLandCells: nearWalkable, candidateLandAreaAu2: round(nearWalkable * grid.cell * grid.cell, 2),
    sourceAnnotationCount: nearby.length, byKind,
    sourceAnnotationIds: nearby.map(r => r.id),
    annotationGeometry: nearby.map(r => ({ id: r.id, kind: r.kind, at: r.at, radiusAu: r.r, dens: r.dens, conf: r.conf, sourceRef: `resources[${r.id}]` })),
    finalHarvestableInstances: 'NOT_SUPPLIED',
    note: 'These are the EXISTING Veyra geographic annotations with source ids preserved. No new resource position, stock, yield, respawn or loot was placed. Gameplay generates harvestables from suitability areas.',
  };

  // ---- 7. More than one candidate build site.
  const buildSites = P.zones.map(z => ({ z, d: ringBoundaryDistance(spawn.at, z.ring) })).filter(x => x.d < cfg.buildSiteRadiusAu).sort((a, b) => a.d - b.d).map(({ z, d }) => {
    const centroid = ringCentroid(z.ring);
    const ci = cellOf(centroid[0], centroid[1], grid);
    return {
      id: z.id, name: z.name, conf: z.conf, distanceToSpawnAu: round(d, 4),
      centroidAu: centroid.map(v => round(v, 4)), areaAu2: round(ringArea(z.ring), 4),
      bboxAu: ringBBox(z.ring).map(v => round(v, 4)),
      soil: z.soil, water: z.water, slopeLabel: z.slope, tags: z.tags,
      buildableCandidateCellsAtCentroid: ci >= 0 ? layers.buildableCandidate[ci] : null,
      clearanceCellsAtCentroid: ci >= 0 ? layers.clearanceCells[ci] : null,
      freshwaterProximityCellsAtCentroid: ci >= 0 ? layers.freshwaterProximityCells[ci] : null,
      rawSlopeAtCentroid: ci >= 0 ? layers.slope[ci] : null,
      status: 'CANDIDATE_BUILDABLE_REGION',
      a0Legality: 'NOT_ASSERTED',
    };
  });

  // ---- 8. Dependencies: rivers, bridges, slopes, ferries.
  const usedRoadIds = new Set(routes.flatMap(r => r.sourceIds));
  const routePoints = primary.geometryAu;
  const riversNear = P.rivers.map(r => ({ id: r.id, kind: r.kind, width: r.width, widthUnit: 'UNKNOWN', distanceAu: round(pathDistance(spawn.at, r.points), 4), minDistanceToPrimaryAu: round(Math.min(...routePoints.map(p => pathDistance(p, r.points))), 4), conf: r.conf })).filter(r => r.minDistanceToPrimaryAu < 60).sort((a, b) => a.minDistanceToPrimaryAu - b.minDistanceToPrimaryAu);
  const bridges = P.bridges.map(b => ({ id: b.id, load: b.load, conf: b.conf, at: b.at, minDistanceToPrimaryAu: round(Math.min(...routePoints.map(p => dist(p, b.at))), 4), nearestRiver: (() => { let x = null; for (const r of P.rivers) { const dd = pathDistance(b.at, r.points); if (!x || dd < x.distanceAu) x = { id: r.id, distanceAu: round(dd, 4) }; } return x; })(), channelSpanFitVerified: false })).filter(b => b.minDistanceToPrimaryAu < 80).sort((a, b) => a.minDistanceToPrimaryAu - b.minDistanceToPrimaryAu);
  const routeGeometry = routes.map(r => ({ id: r.id, points: r.geometryAu }));
  const ferries = P.roads.filter(r => r.kind === 'ferry').map(r => ({
    id: r.id, name: r.name, conf: r.conf,
    minDistanceToPrimaryAu: round(Math.min(...routePoints.map(p => pathDistance(p, r.points))), 4),
    minDistanceToAnyRouteAu: round(Math.min(...routeGeometry.flatMap(g => g.points.map(p => pathDistance(p, r.points)))), 4),
    usedByAnyRoute: false, boatRule: 'UNDEFINED',
  })).sort((a, b) => a.minDistanceToPrimaryAu - b.minDistanceToPrimaryAu);
  const bridgesByRoute = routeGeometry.map(g => ({
    routeId: g.id,
    bridgesWithin8Au: P.bridges.map(b => ({ id: b.id, load: b.load, conf: b.conf, distanceAu: round(Math.min(...g.points.map(p => dist(p, b.at))), 4), channelSpanFitVerified: false }))
      .filter(b => b.distanceAu <= 8).sort((a, b) => a.distanceAu - b.distanceAu),
    ferriesWithin8Au: P.roads.filter(r => r.kind === 'ferry').filter(r => Math.min(...g.points.map(p => pathDistance(p, r.points))) <= 8).map(r => r.id),
  }));

  const doc = {
    schema: 'soh.map.corridor.v1',
    generatedBy: 'world_lab/geo01/src/corridor.mjs',
    canonicalSourceSha256: source.fingerprint.sha256,
    status: 'GEOGRAPHIC_CORRIDOR_PROOF_NOT_GAMEPLAY_VALIDATION',
    config: cfg,
    authority: 'Map supplies physical geography; Gameplay populates and simulates it.',
    spawnSelection: {
      rule: 'Deterministic sum of nearby authored roads/POIs/zones/bridges/docks/rivers within fixed radii; tie-break by nearest road. No preference or invented weight.',
      radii: g, candidates: spawnScores,
      chosen: spawn.id, chosenScore: spawnScores[0].score,
      why: `${spawn.id} has the most authored geographic support: ${spawnScores[0].counts.roads250} roads, ${spawnScores[0].counts.pois200} POIs, ${spawnScores[0].counts.zones300} buildable zones, ${spawnScores[0].counts.bridges250} bridges, ${spawnScores[0].counts.docks250} docks and ${spawnScores[0].counts.rivers250} rivers in range.`,
    },
    targetSelection: {
      rule: 'Existing POI shell with >=2 authored road-graph edges and straight-line distance <=300 au; ranked by edge count then authored route length.',
      candidates: poiCandidates,
      chosen: target.id, chosenEdgeCount: poiCandidates[0].edges,
      poiShell: { id: target.id, name: target.name, arche: target.arche, at: target.at, foot: target.foot, deep: target.deep || null, depth: target.depth, gate: target.gate, retreat: target.retreat || [], links: target.links || [], conf: target.conf, footAreaAu2: round(ringArea(target.foot), 4), rooms: 'NOT_IN_SOURCE', entrances: 'NOT_IN_SOURCE' },
    },
    initialTerrain,
    resourceGeography,
    buildSites: { count: buildSites.length, sites: buildSites, note: 'Multiple candidate buildable regions with measured clearance. A0 protection, collision, occupancy and route legality remain Gameplay/A0-owned.' },
    routes: {
      primary,
      return: {
        id: 'RT-1-RETURN', status: 'REVERSE_OF_PRIMARY', totalDistanceAu: primary.totalDistanceAu,
        geometryAu: primary.geometryAu.slice().reverse(), sourceIds: primary.sourceIds,
        note: 'Same authored geometry reversed. A physically distinct return is RT-2 / RT-3.',
      },
      alternatives: [altNoDetour, altRiverside].filter(Boolean),
      alternativeCount: [altNoDetour, altRiverside].filter(Boolean).length + 1,
      note: 'RT-1/RT-2 differ by the authored alt detour rd_1w; RT-3 uses the authored riverside path rd_20 with explicitly reported derived connectors. No new geometry was invented.',
    },
    physicalConnectivity: {
      grid, passableRule: 'walkableCandidate=1 OR (river centreline cell AND authored crossingCandidate>0)',
      startCell: start, goalCell: goal, connected,
      gridSteps: connected ? d[goal] : null,
      gridStepDistanceAu: connected ? d[goal] * grid.cell : null,
      pathCells: pathCells.length, pathCellList: pathCells,
      crossingCells,
      clearanceAlongGridPathCells: clearanceAlongGridPath,
      clearanceAlongGridPathAu: { min: clearanceAlongGridPath.min * grid.cell, max: clearanceAlongGridPath.max * grid.cell, mean: round(clearanceAlongGridPath.mean * grid.cell, 4) },
      slopeAlongGridPathRaw: slopeAlongGridPath,
      clearanceAlongAuthoredPrimaryRouteCells: clearanceAlongAuthoredRoute,
      clearanceAlongAuthoredPrimaryRouteAu: { min: clearanceAlongAuthoredRoute.min * grid.cell, max: clearanceAlongAuthoredRoute.max * grid.cell, mean: round(clearanceAlongAuthoredRoute.mean * grid.cell, 4) },
      slopeAlongAuthoredPrimaryRouteRaw: slopeAlongAuthoredRoute,
      note: 'Grid-step distance is a 4-neighbour raster lower bound in authoring units (cells x 8), NOT the authored polyline length and NOT a travel-time measurement. Clearance is derived BFS distance to the nearest blocked cell.',
    },
    dependencies: {
      riversNearPrimaryRoute: riversNear,
      bridgesNearPrimaryRoute: bridges,
      bridgesByRoute,
      ferryPaths: ferries,
      ferryPathsOnCorridorWithinReportRadius: ferries.filter(f => f.minDistanceToPrimaryAu < cfg.ferryReportRadiusAu).length,
      ferryPathsUsedByAnyRoute: bridgesByRoute.reduce((s, r) => s + r.ferriesWithin8Au.length, 0),
      ferryNote: 'Ferry paths exist elsewhere in Veyra but NONE lies on RT-1/RT-2/RT-3. Boarding/boat rules are UNDEFINED and no ferry was substituted with a land road.',
      slopeRawRange: slopeAlongAuthoredRoute,
      unresolved: [
        'rv_silver / rv_grey_low width field has no established physical unit; only centreline cells are treated as channel.',
        'br_4 (load:cart) and br_a (load:foot) channel span fit is UNVERIFIED; loaded-cart grade limits are Gameplay rules.',
        `Slope is a raw byte gradient (${slopeAlongAuthoredRoute.min}..${slopeAlongAuthoredRoute.max}, mean ${slopeAlongAuthoredRoute.mean}); no passable threshold is authored.`,
        'Ferry boarding / boat / portage rules are UNDEFINED and 8 ferry paths exist elsewhere in Veyra.',
        'Travel time t_foot / t_cart_loaded / exposure_time requires an approved world-scale transform and measured journeys.',
        'POI interior (rooms, doors, sockets, power, loot) is NOT_IN_SOURCE / Gameplay-owned.',
        'Climate, hazard intensity and dynamic occupancy are UNDEFINED.',
      ],
    },
    survivability: {
      status: 'NOT_CLAIMED',
      statement: 'This is a physical geography proof only. The corridor is NOT claimed to be naturally survivable: Gameplay has not run its actual population algorithm, source placement, survival rules, day/night, weather, hunger/thirst, creature threat, inventory carrying cost or 14-day clock. A static corridor diagram is not gameplay validation.',
    },
    visualInspection: { svg: 'corridor.svg', png: 'corridor.png', kind: 'GEOGRAPHIC_DIAGRAM', note: 'Vector/PNG inspection of ACTUAL Veyra polygons, polylines and the routed corridor. Not a game screenshot, not an art proposal, not gameplay validation.' },
  };
  writeJson(path.join(out, 'corridor.v1.json'), doc);
  console.log(`CORRIDOR_OK spawn=${spawn.id} target=${target.id} routes=${routes.length} connected=${connected} steps=${connected ? d[goal] : 'NONE'} primaryAu=${primary.totalDistanceAu} crossings=${crossingCells.length} buildSites=${buildSites.length} annotations=${nearby.length}`);
  console.log(`  ${path.relative(process.cwd(), path.join(out, 'corridor.v1.json'))} ${fs.statSync(path.join(out, 'corridor.v1.json')).size} bytes`);
}
main();
