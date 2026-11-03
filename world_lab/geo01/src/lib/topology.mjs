// Derived topology. Every record keeps the original source id and the original
// authored coordinates; derived numbers are additive and labelled as derived.
// Nothing here decides spawn positions, yields, loot, doors, hazards or economy.
import {
  dist, pathDistance, pathLength, ringBoundaryDistance, ringArea, ringBBox,
  ringCentroid, ringPerimeter, samplePath, round, D4,
} from './geometry.mjs';

const stats = a => {
  if (!a.length) return { count: 0 };
  let mn = Infinity, mx = -Infinity, sum = 0;
  for (const v of a) { mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; }
  return { count: a.length, min: mn, max: mx, mean: round(sum / a.length, 4) };
};

function gridAt(x, y, grid) {
  const gx = Math.floor(x / grid.cell), gy = Math.floor(y / grid.cell);
  if (gx < 0 || gy < 0 || gx >= grid.gw || gy >= grid.gh) return -1;
  return gy * grid.gw + gx;
}

/* ---------------------------------------------------------- land / coast */
export function landTopology(P, layers, grid) {
  const { landId, coast, elevation } = layers;
  const out = P.land.map((l, k) => {
    const outer = l.rings[0], holes = l.rings.slice(1);
    const cells = [];
    for (let i = 0; i < landId.length; i++) if (landId[i] === k + 1) cells.push(i);
    const coastCells = cells.filter(i => coast[i]).length;
    const e = cells.map(i => elevation[i]);
    let distToNearest = null;
    for (let m = 0; m < P.land.length; m++) {
      if (m === k) continue;
      let best = Infinity;
      for (const a of outer) for (const b of P.land[m].rings[0]) best = Math.min(best, dist(a, b));
      const cand = { to: P.land[m].id, distanceAu: round(best, 4), sampled: 'ring vertices' };
      if (!distToNearest || cand.distanceAu < distToNearest.distanceAu) distToNearest = cand;
    }
    return {
      id: l.id, name: l.name, kind: l.kind, conf: l.conf,
      ringCount: l.rings.length, holeCount: holes.length,
      outerVertexCount: outer.length,
      areaAu2: round(ringArea(outer) - holes.reduce((s, h) => s + ringArea(h), 0), 4),
      perimeterAu: round(ringPerimeter(outer) + holes.reduce((s, h) => s + ringPerimeter(h), 0), 4),
      bboxAu: ringBBox(outer).map(v => round(v, 4)),
      centroidAu: ringCentroid(outer).map(v => round(v, 4)),
      derivedCellCount: cells.length, derivedCoastCells: coastCells,
      derivedElevation: stats(e),
      nearestOtherLandmass: distToNearest,
    };
  });
  // 8-connected coastline components (coastline topology, not gameplay zones).
  const seen = new Uint8Array(coast.length); let components = 0; const sizes = [];
  for (let i = 0; i < coast.length; i++) {
    if (!coast[i] || seen[i]) continue;
    components++; let size = 0; const q = [i]; seen[i] = 1;
    while (q.length) {
      const j = q.pop(); size++;
      const gx = j % grid.gw, gy = (j / grid.gw) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = gx + dx, ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= grid.gw || ny >= grid.gh) continue;
        const n = ny * grid.gw + nx;
        if (!seen[n] && coast[n]) { seen[n] = 1; q.push(n); }
      }
    }
    sizes.push(size);
  }
  return {
    landmasses: out,
    coastline: {
      totalCoastCells: coast.reduce((s, v) => s + v, 0),
      connectedComponents8: components,
      componentSizes: sizes.sort((a, b) => b - a),
      note: 'Coast cells are land cells with a 4-neighbour sea cell; component count is a derived 8-connected topology metric, not a gameplay boundary.',
    },
  };
}

/* ---------------------------------------------------------- water / rivers */
export function waterConnectivity(P, layers, grid) {
  const { elevation, slope } = layers;
  const lakeIds = new Set(P.lakes.map(l => l.id));
  const riverIds = new Set(P.rivers.map(r => r.id));
  const nodes = new Set(['sea']);
  for (const id of lakeIds) nodes.add(id);
  for (const id of riverIds) nodes.add(id);
  const edges = [], unresolved = [];
  const resolve = (ref, riverId, side) => {
    if (!ref) return null;
    if (ref.kind === 'sea') return 'sea';
    if (ref.kind === 'none') return null;
    if (ref.kind === 'spring') { const n = `spring:${riverId}`; nodes.add(n); return n; }
    if (ref.kind === 'lake' && lakeIds.has(ref.ref)) return ref.ref;
    if (ref.kind === 'river' && riverIds.has(ref.ref)) return ref.ref;
    unresolved.push({ riverId, side, ref });
    return null;
  };
  for (const r of P.rivers) {
    const from = resolve(r.source, r.id, 'source'), to = resolve(r.mouth, r.id, 'mouth');
    if (from) edges.push({ from, to: r.id, kind: 'source_to_river', riverId: r.id });
    if (to) edges.push({ from: r.id, to, kind: 'river_to_mouth', riverId: r.id });
  }
  // undirected connected components, for physical water continuity only
  const adj = new Map([...nodes].map(n => [n, []]));
  for (const e of edges) { adj.get(e.from).push(e.to); adj.get(e.to).push(e.from); }
  const comp = new Map(); let ci = 0; const components = [];
  for (const n of nodes) {
    if (comp.has(n)) continue;
    const q = [n]; comp.set(n, ci); const members = [];
    while (q.length) { const x = q.pop(); members.push(x); for (const y of adj.get(x) || []) if (!comp.has(y)) { comp.set(y, ci); q.push(y); } }
    components.push({ id: ci, members: members.sort(), reachesSea: members.includes('sea') }); ci++;
  }
  const rivers = P.rivers.map(r => {
    const samples = samplePath(r.points, grid.cell);
    const es = [], ss = [];
    for (const p of samples) {
      const i = gridAt(p[0], p[1], grid);
      if (i >= 0) { es.push(elevation[i]); ss.push(slope[i]); }
    }
    const nav = r.nav || [];
    return {
      id: r.id, name: r.name, kind: r.kind, width: r.width,
      widthUnit: 'UNKNOWN (source field width; physical channel unit not established)',
      conf: r.conf, points: r.points,
      source: r.source || null, mouth: r.mouth || null,
      navSegments: nav.length, navigableSegments: nav.filter(v => v === 1).length,
      nonNavigableSegments: nav.filter(v => v === 0).length,
      features: (r.feats || []).map(f => ({ kind: f.kind, at: f.at })),
      derivedLengthAu: round(pathLength(r.points), 4),
      derivedElevationProfile: stats(es),
      derivedSlopeProfile: stats(ss),
      derivedDescendsSourceToMouth: es.length > 1 ? es[es.length - 1] < es[0] : null,
      component: comp.get(r.id) ?? null,
      notes: r.notes || null, reason: r.reason || null,
    };
  });
  return {
    directedEdges: edges, unresolvedRefs: unresolved,
    components, seaConnectedLakes: components.filter(c => c.reachesSea).flatMap(c => c.members.filter(m => lakeIds.has(m))),
    lakes: P.lakes.map(l => ({
      id: l.id, name: l.name, ring: l.ring, oasis: !!l.oasis, conf: l.conf,
      derivedAreaAu2: round(ringArea(l.ring), 4), derivedPerimeterAu: round(ringPerimeter(l.ring), 4),
      derivedBBoxAu: ringBBox(l.ring).map(v => round(v, 4)),
      derivedCentroidAu: ringCentroid(l.ring).map(v => round(v, 4)),
      component: comp.get(l.id) ?? null,
    })),
    rivers,
    mouthSummary: {
      toSea: P.rivers.filter(r => r.mouth?.kind === 'sea').map(r => r.id),
      toLake: P.rivers.filter(r => r.mouth?.kind === 'lake').map(r => ({ id: r.id, ref: r.mouth.ref })),
      toRiver: P.rivers.filter(r => r.mouth?.kind === 'river').map(r => ({ id: r.id, ref: r.mouth.ref })),
      none: P.rivers.filter(r => r.mouth?.kind === 'none').map(r => r.id),
    },
    note: 'nav[] flags and waterfall/rapids/weir/lock features are source proposals, NOT navigability law. Boat/portage rules are Gameplay-owned and UNDEFINED.',
  };
}

/* ---------------------------------------------------------- roads / crossings */
export function transportTopology(P, graph) {
  const kinds = {};
  for (const r of P.roads) { kinds[r.kind] = kinds[r.kind] || { count: 0, lengthAu: 0 }; kinds[r.kind].count++; kinds[r.kind].lengthAu += pathLength(r.points); }
  for (const k of Object.keys(kinds)) kinds[k].lengthAu = round(kinds[k].lengthAu, 4);
  const connected = new Set(graph.edges.filter(e => !e.ferry).flatMap(e => [e.from, e.to]));
  const bridges = P.bridges.map(b => {
    let nearestRiver = null;
    for (const r of P.rivers) { const d = pathDistance(b.at, r.points); if (!nearestRiver || d < nearestRiver.distanceAu) nearestRiver = { id: r.id, distanceAu: round(d, 4) }; }
    return {
      id: b.id, name: b.name, at: b.at, ang: b.ang, load: b.load, conf: b.conf,
      nearestRiver, nearestRoad: (() => { let x = null; for (const r of P.roads) { const d = pathDistance(b.at, r.points); if (!x || d < x.distanceAu) x = { id: r.id, distanceAu: round(d, 4) }; } return x; })(),
      channelSpanFitVerified: false,
      widthAu: null, widthStatus: 'NOT_IN_SOURCE',
    };
  });
  const docks = P.docks.map(d => {
    const known = d.water === 'sea' || lakeIds(P).has(d.water) || riverIds(P).has(d.water);
    return {
      id: d.id, name: d.name, at: d.at, kind: d.kind, water: d.water, conf: d.conf,
      waterRefResolves: known,
      boardingRule: 'UNDEFINED (Gameplay/boat owner)',
      functionalBoatOrPierArt: 'NOT_STAGED (ASSET_STAGING_STATUS.md STAGING_PARTIAL)',
    };
  });
  return {
    roadKinds: kinds,
    roads: P.roads.map(r => ({
      id: r.id, name: r.name, kind: r.kind, conf: r.conf, points: r.points,
      lengthAu: round(pathLength(r.points), 4), widthAu: null, widthStatus: 'NOT_IN_SOURCE',
      slopes: 'DERIVED_IN_LAYER slope (raw byte gradient); physical gradient UNDEFINED',
      alt: !!r.alt, ford: !!r.ford, purpose: r.purpose || null,
      ferryBoatRule: r.kind === 'ferry' ? 'UNDEFINED (Gameplay)' : null,
    })),
    routeGraph: {
      config: graph.config, nodeCount: graph.nodes.length, edgeCount: graph.edges.length,
      landRoadNodes: connected.size,
      isolatedStopNodes: graph.nodes.filter(n => n.degree === 0).length,
      note: 'Edges are authored road sub-polylines. Endpoint joins within joinToleranceAu and exact segment intersections are DERIVED; ferry edges are present but NOT land roads.',
    },
    bridges, docks,
    ferryPaths: P.roads.filter(r => r.kind === 'ferry').map(r => ({ id: r.id, points: r.points, conf: r.conf, boatRule: 'UNDEFINED' })),
    unresolved: [
      'Road width (and therefore road widthTiles / turning clearance) is not authored in Veyra.',
      'Loaded-cart slope/grade limits, bridge span fit and ferry boarding rules are Gameplay decisions.',
      'Travel time (t_foot, t_cart_loaded, exposure_time) requires measured journey times at an approved world scale.',
    ],
  };
}
const lakeIds = P => new Set(P.lakes.map(l => l.id));
const riverIds = P => new Set(P.rivers.map(r => r.id));

/* ---------------------------------------------------------- zones / build */
export function zoneAccess(P, layers, grid) {
  const { zoneId, buildableCandidate, walkableCandidate, freshwaterProximityCells, seaDistanceCells, slope } = layers;
  return {
    buildableRegions: P.zones.map((z, k) => {
      const cells = [];
      for (let i = 0; i < zoneId.length; i++) if (zoneId[i] === k + 1) cells.push(i);
      const c = ringCentroid(z.ring);
      let road = null;
      for (const r of P.roads) { const d = pathDistance(c, r.points); if (!road || d < road.distanceAu) road = { id: r.id, kind: r.kind, distanceAu: round(d, 4) }; }
      let poi = null;
      for (const p of P.pois) { const d = dist(c, p.at); if (!poi || d < poi.distanceAu) poi = { id: p.id, distanceAu: round(d, 4) }; }
      const gi = gridAt(c[0], c[1], grid);
      return {
        id: z.id, name: z.name, conf: z.conf, ring: z.ring,
        soil: z.soil, water: z.water, slopeLabel: z.slope, tags: z.tags, notes: z.notes,
        derivedAreaAu2: round(ringArea(z.ring), 4), derivedPerimeterAu: round(ringPerimeter(z.ring), 4),
        derivedCentroidAu: c.map(v => round(v, 4)), derivedBBoxAu: ringBBox(z.ring).map(v => round(v, 4)),
        derivedCells: cells.length,
        derivedWalkableCells: cells.filter(i => walkableCandidate[i]).length,
        derivedBuildableCells: cells.filter(i => buildableCandidate[i]).length,
        nearestRoad: road, nearestPoi: poi,
        freshwaterProximityCells: gi >= 0 ? freshwaterProximityCells[gi] : null,
        seaDistanceCells: gi >= 0 ? seaDistanceCells[gi] : null,
        meanRawSlope: cells.length ? round(cells.reduce((s, i) => s + slope[i], 0) / cells.length, 4) : null,
        physicalAccess: 'DERIVED candidate only; A0 protection, occupancy, route clearance and collision are NOT asserted',
      };
    }),
    note: 'Zones are candidate buildable polygons. Map supplies geometry; Gameplay/A0 supplies legality.',
  };
}

/* ---------------------------------------------------------- POI spatial */
export function poiSpatial(P, layers, grid) {
  const { poiGeometryId, clearanceCells } = layers;
  const perPoi = new Map();
  for (let i = 0; i < poiGeometryId.length; i++) {
    const k = poiGeometryId[i]; if (!k) continue;
    if (!perPoi.has(k)) perPoi.set(k, []);
    perPoi.get(k).push(i);
  }
  return {
    pois: P.pois.map((p, k) => {
      const cells = perPoi.get(k + 1) || [];
      let road = null;
      for (const r of P.roads) { const d = pathDistance(p.at, r.points); if (!road || d < road.distanceAu) road = { id: r.id, kind: r.kind, distanceAu: round(d, 4) }; }
      let water = null;
      for (const l of P.lakes) { const d = ringBoundaryDistance(p.at, l.ring); if (!water || d < water.distanceAu) water = { kind: 'lake', id: l.id, distanceAu: round(d, 4) }; }
      for (const r of P.rivers) { const d = pathDistance(p.at, r.points); if (!water || d < water.distanceAu) water = { kind: 'river', id: r.id, distanceAu: round(d, 4) }; }
      const gi = gridAt(p.at[0], p.at[1], grid);
      return {
        id: p.id, name: p.name, conf: p.conf, arche: p.arche,
        at: p.at, rot: p.rot, scale: p.scale, foot: p.foot, deep: p.deep || null,
        depth: p.depth, role: p.role, opp: p.opp, access: p.access,
        gate: p.gate, retreat: p.retreat || [], links: p.links || [], elder: p.elder || null,
        notes: p.notes || null, resources: p.resources || [],
        derivedFootAreaAu2: p.foot ? round(ringArea(p.foot), 4) : null,
        derivedFootBBoxAu: p.foot ? ringBBox(p.foot).map(v => round(v, 4)) : null,
        derivedFootCentroidAu: p.foot ? ringCentroid(p.foot).map(v => round(v, 4)) : null,
        derivedDeepAreaAu2: p.deep ? round(ringArea(p.deep), 4) : null,
        derivedFootprintCells: cells,
        clearanceCellsAtAnchor: gi >= 0 ? clearanceCells[gi] : null,
        nearestRoad: road, nearestWater: water,
        spatial: {
          footprint: { status: 'SUPPLIED', source: 'pois[].foot / pois[].deep', cells: cells.length },
          outerDeepRegions: { status: p.deep ? 'SUPPLIED' : 'NOT_IN_SOURCE', geometry: p.deep || null },
          rooms: { status: 'NOT_IN_SOURCE', owner: 'Gameplay / level design' },
          entrances: { status: 'NOT_IN_SOURCE', note: 'No door opening coordinates are authored in Veyra.' },
          passages: { status: p.links?.length ? 'PARTIAL_SOURCE_LINKS' : 'NOT_IN_SOURCE', links: p.links || [] },
          entranceExitSockets: { status: 'UNDEFINED', note: 'Functional placement sockets need an approved POI archetype contract.' },
          retreatCandidates: { status: p.retreat?.length ? 'SUPPLIED' : 'NOT_IN_SOURCE', points: p.retreat || [] },
          doors: { status: 'GAMEPLAY_OWNED', note: 'gate/access are provisional source notes, NOT a locked-door law.' },
          powerNodes: { status: 'GAMEPLAY_OWNED' },
          hazardCells: { status: 'GAMEPLAY_OWNED' },
          lootSites: { status: 'GAMEPLAY_OWNED' },
          circulation: { status: 'UNDEFINED', note: 'No interior circulation geometry in source.' },
        },
      };
    }),
    note: 'POI shells are geometry. Locked state, power/fuel, loot, NPCs, interactions and progression are Gameplay-owned.',
  };
}

/* ---------------------------------------------------------- Elder territory */
export function elderTerritories(P) {
  return {
    elders: P.elders.map(e => ({
      id: e.id, elder: e.elder, name: e.name, conf: e.conf,
      outer: e.outer, core: e.core, arenas: e.arenas, approach: e.approach,
      pois: e.pois, ragnarok: e.ragnarok,
      derivedOuterAreaAu2: round(ringArea(e.outer), 4),
      derivedOuterBBoxAu: ringBBox(e.outer).map(v => round(v, 4)),
      derivedOuterCentroidAu: ringCentroid(e.outer).map(v => round(v, 4)),
      derivedCoreAreaAu2: e.core ? round(ringArea(e.core), 4) : null,
      derivedCoreCentroidAu: e.core ? ringCentroid(e.core).map(v => round(v, 4)) : null,
      derivedArenaAreasAu2: (e.arenas || []).map(a => round(ringArea(a), 4)),
      derivedArenaCentroidsAu: (e.arenas || []).map(a => ringCentroid(a).map(v => round(v, 4))),
      approachPoints: e.approach,
      spatial: {
        territory: 'outer', core: 'core', arena: 'arenas', approach: 'approach',
        escapeTopology: { status: 'PARTIAL', source: 'ragnarok prose note + approach points', note: 'Prose is a design note (conf=proposal), not a validated escape graph.' },
      },
      gameplayOwned: ['boss behaviour', 'hazards/effects', 'activation', 'rewards', 'dynamic state'],
      mappingStatus: 'NO_GAMEPLAY_ELDER_MAPPING_CREATED',
    })),
    note: 'Six DISTINCT authored territories are preserved by source id. No mapping to the runtime ELDERS catalog was invented.',
  };
}

/* ---------------------------------------------------------- resource geography */
export function resourceSuitability(P, layers, grid) {
  const { elevation, biomeCode, slope, freshwaterProximityCells, seaDistanceCells, landId, zoneId, walkableCandidate } = layers;
  const annotations = P.resources.map(r => {
    const i = gridAt(r.at[0], r.at[1], grid);
    return {
      id: r.id, name: r.name, conf: r.conf, kind: r.kind,
      at: r.at, r: r.r, dens: r.dens, gate: r.gate,
      suitabilityArea: { shape: 'circle', centreAu: r.at, radiusAu: r.r, areaAu2: round(Math.PI * r.r * r.r, 4) },
      terrainContext: i < 0 ? null : {
        cell: i, landId: landId[i], zoneId: zoneId[i],
        elevationRawByte: elevation[i], biomeRawCode: biomeCode[i], slopeRawByteDelta: slope[i],
        freshwaterProximityCells: freshwaterProximityCells[i], seaDistanceCells: seaDistanceCells[i],
        walkableCandidate: walkableCandidate[i],
      },
      status: 'CANDIDATE_GEOGRAPHIC_ANNOTATION',
      finalHarvestableInstances: 'NOT_SUPPLIED',
      stock: 'NOT_SUPPLIED', yield: 'NOT_SUPPLIED', respawn: 'NOT_SUPPLIED',
      owner: 'Gameplay population algorithm',
    };
  });
  const kinds = {};
  for (const r of P.resources) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
  return {
    annotations, kindCounts: kinds, count: annotations.length,
    suitabilityContextLayers: ['elevation', 'biomeCode', 'slope', 'freshwaterProximityCells', 'seaDistanceCells', 'landId', 'zoneId'],
    suitabilityWeights: 'UNDEFINED (Gameplay-owned)',
    biomeLegend: 'UNKNOWN (raw source codes 0..11; no committed semantic legend)',
    note: 'The 280 Veyra resource objects are geographic annotations with IDs preserved. They are NOT 280 fixed authoritative gameplay source nodes. No final harvestable instance, stock, yield or depletion was generated.',
  };
}

/* ---------------------------------------------------------- confidence */
export function confidenceRegister(P) {
  const arrays = ['land', 'lakes', 'rivers', 'roads', 'bridges', 'docks', 'pois', 'zones', 'resources', 'spawns', 'elders', 'labels'];
  const byArray = {}, totals = {};
  for (const k of arrays) {
    const c = {};
    for (const o of P[k]) { const v = o.conf ?? 'ABSENT'; c[v] = (c[v] || 0) + 1; totals[v] = (totals[v] || 0) + 1; }
    byArray[k] = c;
  }
  return {
    byArray, totals,
    rule: 'proposal / assumption flags are preserved verbatim on every object. No provisional design note is promoted to a gameplay law.',
    authority: 'MAP_DESIGNS_PHYSICAL_WORLD; GAMEPLAY_POPULATES_AND_SIMULATES_IT',
  };
}

/* ---------------------------------------------------------- spawn regions */
export function spawnRegions(P, layers, grid) {
  const { elevation, biomeCode, slope, walkableCandidate, clearanceCells, freshwaterProximityCells, seaDistanceCells } = layers;
  return {
    spawns: P.spawns.map(s => {
      const i = gridAt(s.at[0], s.at[1], grid);
      let road = null;
      for (const r of P.roads) { const d = pathDistance(s.at, r.points); if (!road || d < road.distanceAu) road = { id: r.id, kind: r.kind, distanceAu: round(d, 4) }; }
      return {
        id: s.id, name: s.name, region: s.region, conf: s.conf, at: s.at,
        derivedCell: i,
        terrainContext: i < 0 ? null : {
          walkableCandidate: walkableCandidate[i], elevationRawByte: elevation[i],
          biomeRawCode: biomeCode[i], slopeRawByteDelta: slope[i],
          clearanceCells: clearanceCells[i], freshwaterProximityCells: freshwaterProximityCells[i],
          seaDistanceCells: seaDistanceCells[i],
        },
        nearestRoad: road,
        safeInitialTerrainCandidates: 'DERIVED in corridor proof (walkable + low raw slope + clearance); survivability NOT asserted',
      };
    }),
    note: 'Four authored spawn regions preserved verbatim. Player size, safety, survival timers and spawn randomisation are Gameplay-owned.',
  };
}
