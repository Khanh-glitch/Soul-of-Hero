// MAP-LR01 Milestone B — reusable deterministic whole-Veyra geography compiler.
// All geometry is in the UNCHANGED 2000x1400 authoring frame.
// The 250x175 raster supplies geography but NOT final detail: features remain
// authored polygons / polylines / points with stable canonical IDs.
// Status vocabulary is explicit on every important feature.
import { pipRings, ringArea, ringCentroid, ringPerimeter, bbox, dist, nearestOnLine, r4 } from './veyra.mjs';

export const GW = 250, GH = 175, CELL = 8, N = GW * GH;
export const STATUS = Object.freeze({
  SOURCE: 'SOURCE_AUTHORED', DERIVED: 'DERIVED', PROPOSED: 'PROPOSED',
  VALIDATED: 'VALIDATED', UNRESOLVED: 'UNRESOLVED', BLOCKED: 'BLOCKED',
});
export const sourceRef = (collection, id) => `project.${collection}[] where id=${id}`;
export const idx = (gx, gy) => gy * GW + gx;
export const toCell = (x, y) => {
  const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
  return (gx >= 0 && gx < GW && gy >= 0 && gy < GH) ? idx(gx, gy) : -1;
};
export const centre = i => [(i % GW + 0.5) * CELL, (Math.floor(i / GW) + 0.5) * CELL];
const mean = a => a.length ? r4(a.reduce((s, x) => s + x, 0) / a.length) : null;
const pct = (a, p) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return r4(s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]);
};
const hist = a => { const m = {}; for (const v of a) m[v] = (m[v] || 0) + 1; return m; };

/** 4-neighbour connected components of a binary u8 raster. */
export function components(mask) {
  const comp = new Int32Array(N).fill(-1);
  const sizes = [];
  for (let i = 0; i < N; i++) {
    if (!mask[i] || comp[i] !== -1) continue;
    const c = sizes.length, q = [i]; comp[i] = c;
    let n = 0;
    for (let h = 0; h < q.length; h++) {
      const j = q[h]; n++;
      const gx = j % GW, gy = (j / GW) | 0;
      const nb = [gx > 0 ? j - 1 : -1, gx < GW - 1 ? j + 1 : -1, gy > 0 ? j - GW : -1, gy < GH - 1 ? j + GW : -1];
      for (const k of nb) if (k >= 0 && mask[k] && comp[k] === -1) { comp[k] = c; q.push(k); }
    }
    sizes.push(n);
  }
  return { comp, sizes, count: sizes.length };
}

/** 4-neighbour BFS distances (in cells) from a set of seed cells. */
export function bfsDistance(mask, seeds) {
  const d = new Int32Array(N).fill(-1), q = [];
  for (const s of seeds) if (s >= 0 && s < N && mask[s]) { d[s] = 0; q.push(s); }
  for (let h = 0; h < q.length; h++) {
    const j = q[h], gx = j % GW, gy = (j / GW) | 0;
    const nb = [gx > 0 ? j - 1 : -1, gx < GW - 1 ? j + 1 : -1, gy > 0 ? j - GW : -1, gy < GH - 1 ? j + GW : -1];
    for (const k of nb) if (k >= 0 && mask[k] && d[k] === -1) { d[k] = d[j] + 1; q.push(k); }
  }
  return d;
}

/** Polygon metrics for canonical rings (outer ring + optional holes). */
export function ringMetrics(rings) {
  const areas = rings.map(ringArea);
  const area = areas[0] - areas.slice(1).reduce((s, x) => s + x, 0);
  const perim = rings.reduce((s, r) => s + ringPerimeter(r, true), 0);
  const all = rings.flat();
  return {
    ringCount: rings.length, areaAu2: r4(area), perimeterAu: r4(perim),
    bboxAu: bbox(all).map(r4), centroidAu: ringCentroid(rings[0]).map(r4),
    outerVertexCount: rings[0].length, holeCount: rings.length - 1,
  };
}
export function polyMetrics(ring) { return ringMetrics([ring]); }

/** Per-cell statistics restricted to a predicate. */
export function cellStats(I, keep) {
  const elev = [], slope = [], sea = [], fresh = [], clear = [], biomes = {}, roadClasses = {};
  let n = 0, coast = 0, buildable = 0, walkable = 0, water = 0, cargo = 0, crossing = 0;
  for (let i = 0; i < N; i++) {
    if (!keep(i)) continue;
    n++;
    elev.push(I.elevation[i]);
    slope.push(I.slope[i]);
    sea.push(I.seaDistanceCells[i]); fresh.push(I.freshwaterProximityCells[i]); clear.push(I.clearanceCells[i]);
    const b = I.biomeCode[i]; biomes[b] = (biomes[b] || 0) + 1;
    const rc = I.roadClass[i]; roadClasses[rc] = (roadClasses[rc] || 0) + 1;
    if (I.coast[i]) coast++;
    if (I.buildableCandidate[i]) buildable++;
    if (I.walkableCandidate[i]) walkable++;
    if (I.waterClass[i]) water++;
    if (I.cargoCandidate[i]) cargo++;
    if (I.crossingCandidate[i]) crossing++;
  }
  return {
    cells: n, areaAu2: n * CELL * CELL,
    elevationRawByte: { min: elev.length ? Math.min(...elev) : null, max: elev.length ? Math.max(...elev) : null, mean: mean(elev), p25: pct(elev, .25), p50: pct(elev, .5), p75: pct(elev, .75), p95: pct(elev, .95), unit: 'UNKNOWN_SOURCE_BYTE__NO_APPROVED_PHYSICAL_SCALE' },
    slopeRawDelta: { min: slope.length ? Math.min(...slope) : null, max: slope.length ? Math.max(...slope) : null, mean: mean(slope), p50: pct(slope, .5), p95: pct(slope, .95), unit: 'RAW_BYTE_DELTA_PER_8au_CELL__NOT_A_GAMEPLAY_THRESHOLD' },
    seaDistanceCellsMean: mean(sea), freshwaterProximityCellsMean: mean(fresh), clearanceCellsMean: mean(clear),
    biomeHistogram: biomes, roadClassHistogram: roadClasses,
    coastCells: coast, coastBandLengthAuApprox: coast * CELL,
    buildableCells: buildable, walkableCells: walkable, waterCells: water, cargoCells: cargo, crossingCells: crossing,
  };
}

/** Biome transition counts between 4-neighbour land cells, plus land<->water. */
export function biomeTransitions(I, legend) {
  const pairs = {}, landWater = { count: 0 };
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const i = idx(gx, gy);
    const land = I.landId[i] > 0;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = gx + dx, ny = gy + dy;
      if (nx >= GW || ny >= GH) continue;
      const j = idx(nx, ny), land2 = I.landId[j] > 0;
      if (land !== land2) { landWater.count++; continue; }
      if (!land) continue;
      const a = I.biomeCode[i], b = I.biomeCode[j];
      if (a === b) continue;
      const k = `${a}->${b}`;
      pairs[k] = (pairs[k] || 0) + 1;
    }
  }
  const top = Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 24)
    .map(([k, v]) => ({ pair: k, from: legend[+k.split('->')[0]]?.name ?? null, to: legend[+k.split('->')[1]]?.name ?? null, edges: v }));
  return { landWaterBoundaryEdges: landWater.count, distinctTransitions: Object.keys(pairs).length, totalTransitionEdges: Object.values(pairs).reduce((s, x) => s + x, 0), top, status: STATUS.DERIVED, note: 'Biome code legend comes from verified GEO-02 MapStudio source excerpt; 12-code -> 14-string Gameplay mapping remains UNRESOLVED.' };
}

/** Authored hydrography graph from rivers[].source / rivers[].mouth / lakes / sea. */
export function watershed(V) {
  const lakes = new Map(V.P.lakes.map(l => [l.id, l]));
  const rivers = new Map(V.P.rivers.map(r => [r.id, r]));
  const nodes = [], edges = [], issues = [];
  for (const l of V.P.lakes) nodes.push({ id: l.id, kind: 'lake', name: l.name, status: STATUS.SOURCE });
  nodes.push({ id: 'sea', kind: 'sea', status: STATUS.SOURCE });
  nodes.push({ id: 'spring', kind: 'spring', status: STATUS.SOURCE, note: 'Generic unnamed spring source used by 8 rivers; individual spring coordinates are NOT authored.' });
  for (const r of V.P.rivers) {
    const s = r.source, m = r.mouth;
    const sid = s?.ref ?? s?.kind ?? 'UNKNOWN';
    const mid = m?.ref ?? m?.kind ?? 'UNKNOWN';
    for (const [role, id] of [['source', sid], ['mouth', mid]]) {
      if (id !== 'sea' && id !== 'spring' && id !== 'none' && !lakes.has(id) && !rivers.has(id)) issues.push({ riverId: r.id, role, ref: id, problem: 'DANGLING_REFERENCE' });
    }
    if (sid !== 'none' && sid !== 'UNKNOWN') edges.push({ from: sid, to: r.id, kind: 'source', riverId: r.id, status: STATUS.SOURCE });
    if (mid !== 'none' && mid !== 'UNKNOWN') edges.push({ from: r.id, to: mid, kind: 'mouth', riverId: r.id, status: STATUS.SOURCE });
    if (mid === 'none') issues.push({ riverId: r.id, role: 'mouth', problem: 'MOUTH_NONE__NO_SEA_OR_LAKE_OUTLET_AUTHORED', note: 'rv_grey_low ends at kind=none; downstream distributaries reference it as a source.' });
  }
  for (const r of V.P.rivers) nodes.push({ id: r.id, kind: r.kind, name: r.name, widthAu: r.width, nav: r.nav, status: STATUS.SOURCE, widthUnit: 'UNESTABLISHED' });
  // Undirected connectivity through authored refs.
  const adj = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) { if (adj.has(e.from) && adj.has(e.to)) { adj.get(e.from).push(e.to); adj.get(e.to).push(e.from); } }
  const seen = new Set(), comps = [];
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    const q = [n.id], c = []; seen.add(n.id);
    for (let h = 0; h < q.length; h++) { const x = q[h]; c.push(x); for (const y of adj.get(x) || []) if (!seen.has(y)) { seen.add(y); q.push(y); } }
    comps.push(c.sort());
  }
  return {
    nodes, edges, components: comps.map(c => ({ ids: c, size: c.length })),
    issues, danglingReferenceCount: issues.filter(i => i.problem === 'DANGLING_REFERENCE').length,
    authoredOutletGaps: issues.filter(i => i.problem !== 'DANGLING_REFERENCE'), status: STATUS.DERIVED,
    navFlags: [...rivers.values()].map(r => ({ id: r.id, nav: r.nav, note: 'Authored navigation flags; NO Gameplay ferry/boat rule is approved.' })),
    note: 'Watershed connectivity is derived ONLY from authored source/mouth references. It does not assert hydrological flow direction or physical channel width.',
  };
}

/** Whole-world compiler. I = raster layer map (u8 arrays). */
export function compileGeography(V, GEO) {
  const P = V.P;
  const I = {};
  for (const [k, v] of Object.entries(GEO.r1)) I[k] = v.data;
  for (const [k, v] of Object.entries(GEO.r2)) I[k] = v.data;
  const legend = Object.fromEntries(GEO.encoding.biomeLegend.map(x => [x.code, x]));
  const walkComp = components(I.walkableCandidate);
  const cargoComp = components(I.cargoCandidate);
  const landNames = Object.fromEntries(P.land.map((l, i) => [i + 1, l]));

  const landmasses = P.land.map((l, li) => {
    const idNum = li + 1;
    const keep = i => I.landId[i] === idNum;
    const stats = cellStats(I, keep);
    const biomeNames = Object.fromEntries(Object.entries(stats.biomeHistogram).map(([c, n]) => [c, { name: legend[c]?.name ?? null, cells: n }]));
    const roadNames = Object.fromEntries(Object.entries(stats.roadClassHistogram).map(([c, n]) => [c, { cls: ({ 0: 'none', 1: 'cart', 2: 'trail', 3: 'foot', 4: 'riverside', 5: 'ferry' })[c] ?? 'unknown', cells: n }]));
    const riversInside = [...new Set(Array.from({ length: N }, (_, i) => keep(i) ? I.riverId[i] : 0).filter(Boolean))].map(n => P.rivers[n - 1].id);
    const lakesInside = [...new Set(Array.from({ length: N }, (_, i) => keep(i) ? I.lakeId[i] : 0).filter(Boolean))].map(n => P.lakes[n - 1].id);
    const zonesInside = [...new Set(Array.from({ length: N }, (_, i) => keep(i) ? I.zoneId[i] : 0).filter(Boolean))].map(n => P.zones[n - 1].id);
    const eldersInside = [...new Set(Array.from({ length: N }, (_, i) => keep(i) ? I.elderGeometryId[i] : 0).filter(Boolean))].map(n => P.elders[n - 1].id);
    const poiCells = [...new Set(Array.from({ length: N }, (_, i) => keep(i) ? I.poiGeometryId[i] : 0).filter(Boolean))].map(n => P.pois[n - 1].id);
    const beachCells = (() => { let n = 0; for (let i = 0; i < N; i++) if (keep(i) && I.seaDistanceCells[i] <= 2) n++; return n; })();
    const wetlandCells = (() => { let n = 0; for (let i = 0; i < N; i++) if (keep(i) && (I.biomeCode[i] === 4 || I.freshwaterProximityCells[i] <= 1)) n++; return n; })();
    const highlandCells = (() => { let n = 0; for (let i = 0; i < N; i++) if (keep(i) && I.elevation[i] >= 100) n++; return n; })();
    const steepCells = (() => { let n = 0; for (let i = 0; i < N; i++) if (keep(i) && I.slope[i] >= 40) n++; return n; })();
    return {
      id: l.id, name: l.name, kind: l.kind, sourceRef: sourceRef('land', l.id),
      status: [STATUS.SOURCE, STATUS.DERIVED], conf: l.conf,
      geometry: { ringsAu: l.rings, ...ringMetrics(l.rings) },
      rasterCells: stats,
      biomeNames, roadNames,
      coastline: { coastCells: stats.coastCells, approximateLengthAu: stats.coastBandLengthAuApprox, beachBandCells: beachCells, beachBandAu2: beachCells * 64, status: STATUS.DERIVED, note: 'beachBand = land cells within 2 grid cells (16 au) of sea; derived, not an authored beach polygon.' },
      wetlands: { cells: wetlandCells, areaAu2: wetlandCells * 64, status: STATUS.DERIVED, note: 'biomeCode 4 (marsh) OR within 1 cell (8 au) of authored freshwater geometry; approximation only.' },
      relief: { highlandCells, steepCells, status: STATUS.DERIVED, note: 'highland = raw elevation byte >= 100, steep = raw slope delta >= 40. Raw byte thresholds are descriptive, NOT approved gameplay slope laws.' },
      contains: { rivers: riversInside, lakes: lakesInside, zones: zonesInside, elders: eldersInside, pois: poiCells },
      walkableComponents: [...new Set(Array.from({ length: N }, (_, i) => keep(i) && I.walkableCandidate[i] ? walkComp.comp[i] : -1).filter(x => x >= 0))],
    };
  });

  // ---- coastline / islands summary ----
  const coastline = {
    totalCoastCells: landmasses.reduce((s, l) => s + l.coastline.coastCells, 0),
    approximateCoastLengthAu: landmasses.reduce((s, l) => s + l.coastline.approximateLengthAu, 0),
    islands: landmasses.filter(l => l.kind !== 'main').map(l => ({ id: l.id, name: l.name, kind: l.kind, areaAu2: l.geometry.areaAu2, coastCells: l.coastline.coastCells })),
    status: STATUS.DERIVED,
    note: 'Coast length is coast-cell count x 8 au (4-neighbour boundary approximation), not a true shoreline integral.',
  };

  // ---- hydrography ----
  const lakes = P.lakes.map(l => ({
    id: l.id, name: l.name, oasis: l.oasis, conf: l.conf, sourceRef: sourceRef('lakes', l.id),
    status: [STATUS.SOURCE, STATUS.DERIVED], geometry: { ringAu: l.ring, ...polyMetrics(l.ring) },
    cells: (() => { let n = 0; for (let i = 0; i < N; i++) if (I.lakeId[i] === P.lakes.indexOf(l) + 1) n++; return n; })(),
  }));
  const rivers = P.rivers.map(r => {
    const len = r.points.slice(1).reduce((s, p, k) => s + dist(r.points[k], p), 0);
    const cells = (() => { let n = 0; for (let i = 0; i < N; i++) if (I.riverId[i] === P.rivers.indexOf(r) + 1) n++; return n; })();
    return {
      id: r.id, name: r.name, kind: r.kind, widthAu: r.width, nav: r.nav,
      source: r.source, mouth: r.mouth, feats: r.feats || [], conf: r.conf,
      sourceRef: sourceRef('rivers', r.id), status: [STATUS.SOURCE, STATUS.DERIVED],
      geometry: { pointsAu: r.points, centrelineLengthAu: r4(len), bboxAu: bbox(r.points).map(r4), rasterCells: cells },
      widthUnit: 'UNESTABLISHED__AUTHORED_NUMBER_ONLY',
      physicalChannelWidthAu: null, physicalChannelWidthStatus: STATUS.UNRESOLVED,
    };
  });

  // ---- terrain / landforms ----
  const landElev = [];
  for (let i = 0; i < N; i++) if (I.landId[i] > 0 && I.elevation[i] > 0) landElev.push(I.elevation[i]);
  const landSlope = [];
  for (let i = 0; i < N; i++) if (I.landId[i] > 0) landSlope.push(I.slope[i]);
  const terrain = {
    elevation: { ...cellStats(I, i => I.landId[i] > 0).elevationRawByte, physicalScale: 'UNDEFINED', status: STATUS.SOURCE, note: 'Canonical terrain.elev raw bytes decoded verbatim by GEO-01; byteToScalar=elev/255 is verified MapStudio Editor encoding, NOT an approved real-world height.' },
    slope: { ...cellStats(I, i => I.landId[i] > 0).slopeRawDelta, status: STATUS.DERIVED, editorThresholds: GEO.encoding.slope.thresholds, editorThresholdStatus: 'EDITOR_HEURISTIC__NOT_GAMEPLAY_PASSABILITY_LAW' },
    landforms: {
      lowlandCells: landElev.filter(e => e < 40).length,
      highlandCells: landElev.filter(e => e >= 100 && e < 160).length,
      mountainCells: landElev.filter(e => e >= 160).length,
      cliffCandidateCells: landSlope.filter(s => s >= 40).length,
      status: STATUS.DERIVED,
      note: 'Descriptive bins over raw elevation/slope bytes. No approved metre/degree conversion or Gameplay cliff rule exists.',
    },
    biomeTransitions: biomeTransitions(I, legend),
    biomeLegend: GEO.encoding.biomeLegend.map(x => ({ code: x.code, key: x.key, name: x.name, sourceColor: x.sourceColor, sourceRef: x.sourceRef })),
    noMoistureOrTemperature: GEO.geography.climate,
  };

  // ---- transport geometry (owned by Map; classification source-authored) ----
  const roadClassById = Object.fromEntries(P.roads.map(r => [r.id, r.kind]));
  const roads = P.roads.map(r => {
    const len = r.points.slice(1).reduce((s, p, k) => s + dist(r.points[k], p), 0);
    return {
      id: r.id, name: r.name, kind: r.kind, purpose: r.purpose, ford: r.ford ?? null, alt: r.alt ?? null,
      conf: r.conf, sourceRef: sourceRef('roads', r.id), status: STATUS.SOURCE,
      geometry: { pointsAu: r.points, centrelineLengthAu: r4(len), bboxAu: bbox(r.points).map(r4), endpointCount: r.points.length },
      authoredDisplayStrokeAu: r.kind === 'cart' ? 3.4 : 1.6,
      authoredDisplayStrokeStatus: 'EDITOR_DISPLAY_ONLY__NOT_A_PHYSICAL_WIDTH',
      physicalWidthAu: null, physicalWidthStatus: STATUS.UNRESOLVED,
      sweptClearanceAu: null, sweptClearanceStatus: STATUS.UNRESOLVED,
    };
  });
  const bridges = P.bridges.map(b => ({
    id: b.id, name: b.name, atAu: b.at, angleRad: b.ang, load: b.load, conf: b.conf,
    sourceRef: sourceRef('bridges', b.id), status: STATUS.SOURCE,
    displayGlyphAu: { w: 13, h: 7.2 }, displayGlyphStatus: 'EDITOR_DISPLAY_GLYPH__NOT_A_PHYSICAL_DECK',
    physicalDeckSpanAu: null, physicalDeckWidthAu: null, deckStatus: STATUS.UNRESOLVED,
    channelFitVerified: false, channelFitStatus: STATUS.UNRESOLVED,
  }));
  const docks = P.docks.map(d => ({
    id: d.id, name: d.name, atAu: d.at, kind: d.kind, water: d.water, conf: d.conf,
    sourceRef: sourceRef('docks', d.id), status: STATUS.SOURCE,
    berthGeometryAu: null, berthGeometryStatus: STATUS.UNRESOLVED,
  }));

  // ---- construction zones / loading / chokepoints ----
  const cargoSeed = [];
  for (let i = 0; i < N; i++) if (I.cargoCandidate[i]) cargoSeed.push(i);
  const cargoDist = bfsDistance(I.walkableCandidate, cargoSeed);
  const chokeCells = [];
  for (let i = 0; i < N; i++) if (I.walkableCandidate[i] && I.clearanceCells[i] <= 2) chokeCells.push(i);
  const chokeComp = components(Uint8Array.from({ length: N }, (_, i) => (I.walkableCandidate[i] && I.clearanceCells[i] <= 2) ? 1 : 0));
  const chokeClusters = [];
  for (let c = 0; c < chokeComp.count; c++) {
    const cells = [];
    for (let i = 0; i < N; i++) if (chokeComp.comp[i] === c) cells.push(i);
    const pts = cells.map(centre);
    chokeClusters.push({ cluster: c, cells: cells.length, areaAu2: cells.length * 64, centroidAu: [r4(pts.reduce((s, p) => s + p[0], 0) / pts.length), r4(pts.reduce((s, p) => s + p[1], 0) / pts.length)], landIds: [...new Set(cells.map(i => I.landId[i]))].filter(Boolean).map(n => landNames[n]?.id) });
  }
  chokeClusters.sort((a, b) => b.cells - a.cells);

  const zones = P.zones.map((z, zi) => {
    const keep = i => I.zoneId[i] === zi + 1;
    const stats = cellStats(I, keep);
    const loadCells = [];
    for (let i = 0; i < N; i++) if (keep(i) && I.buildableCandidate[i] && cargoDist[i] >= 0 && cargoDist[i] <= 3) loadCells.push(i);
    const insideChokes = chokeClusters.filter(c => {
      const j = toCell(c.centroidAu[0], c.centroidAu[1]);
      return j >= 0 && keep(j);
    }).map(c => c.cluster);
    const cAu = polyMetrics(z.ring).centroidAu;
    const nearRoad = P.roads.map(r => ({ id: r.id, kind: r.kind, d: nearestOnLine(r.points, cAu).d })).sort((a, b) => a.d - b.d).slice(0, 3).map(x => ({ ...x, d: r4(x.d) }));
    return {
      id: z.id, name: z.name, soil: z.soil, water: z.water, slope: z.slope, tags: z.tags, notes: z.notes, conf: z.conf,
      sourceRef: sourceRef('zones', z.id), status: [STATUS.SOURCE, STATUS.DERIVED, STATUS.PROPOSED],
      geometry: { ringAu: z.ring, ...polyMetrics(z.ring) },
      rasterCells: stats,
      buildSuitability: {
        buildableCells: stats.buildableCells, buildableFraction: r4(stats.buildableCells / Math.max(1, stats.cells)),
        meanSlopeRaw: stats.slopeRawDelta.mean, meanFreshwaterProximityCells: stats.freshwaterProximityCellsMean,
        status: STATUS.DERIVED, note: 'Geometric suitability only. A0 occupancy, claim legality and Gameplay building rules are NOT asserted.',
      },
      loadingSpace: {
        cells: loadCells.length, areaAu2: loadCells.length * 64,
        bboxAu: loadCells.length ? bbox(loadCells.map(centre)).map(r4) : null,
        status: STATUS.PROPOSED, note: 'PROPOSED spatial candidate: buildable cells within 3 grid cells (24 au) of a cart-road/cart-bridge/dock cargo candidate. NOT a loading platform or a Gameplay placement grant.',
      },
      naturalChokepoints: { clusterIds: insideChokes, status: STATUS.DERIVED, note: 'clearanceCells <= 2 (<=16 au from blocked geometry); geometric narrowness, not a combat chokepoint claim.' },
      nearestRoads: nearRoad,
      walkableComponentIds: [...new Set(Array.from({ length: N }, (_, i) => keep(i) && I.walkableCandidate[i] ? walkComp.comp[i] : -1).filter(x => x >= 0))],
    };
  });

  // ---- spawns ----
  const buildableMask = I.buildableCandidate;
  const spawns = P.spawns.map(s => {
    const cell = toCell(s.at[0], s.at[1]);
    const nearest = (arr, pt) => arr.map(o => ({ id: o.id ?? o.name, d: r4(dist(o.at ?? o.atAu ?? o.centroidAu, pt)) })).sort((a, b) => a.d - b.d)[0] ?? null;
    const zoneDist = zones.map(z => ({ id: z.id, d: r4(dist(z.geometry.centroidAu, s.at)) })).sort((a, b) => a.d - b.d)[0];
    return {
      id: s.id, name: s.name, region: s.region, atAu: s.at, conf: s.conf,
      sourceRef: sourceRef('spawns', s.id), status: [STATUS.SOURCE, STATUS.DERIVED],
      cell, landId: cell >= 0 && I.landId[cell] ? landNames[I.landId[cell]].id : null,
      walkableAtSpawn: cell >= 0 ? !!I.walkableCandidate[cell] : false,
      walkableComponent: cell >= 0 ? walkComp.comp[cell] : null,
      seaDistanceCells: cell >= 0 ? I.seaDistanceCells[cell] : null,
      freshwaterProximityCells: cell >= 0 ? I.freshwaterProximityCells[cell] : null,
      clearanceCells: cell >= 0 ? I.clearanceCells[cell] : null,
      nearestDock: nearest(P.docks, s.at), nearestPoi: nearest(P.pois.map(p => ({ id: p.id, at: p.at })), s.at),
      nearestBuildableZone: zoneDist,
      nearestCartRoad: (() => {
        let best = null;
        for (const r of P.roads.filter(x => x.kind === 'cart')) { const n = nearestOnLine(r.points, s.at); if (!best || n.d < best.d) best = { id: r.id, d: r4(n.d) }; }
        return best;
      })(),
      statusNote: 'Spawn accessibility is geometric only. Survival fairness, loot and creature exposure are Gameplay-owned.',
    };
  });

  // ---- habitat markers (source geography; NO stock / loot / spawn instances) ----
  const byKind = {};
  for (const r of P.resources) {
    byKind[r.kind] = byKind[r.kind] || { count: 0, radiusAu: {}, gates: {}, density: {} };
    const g = byKind[r.kind]; g.count++;
    g.radiusAu[r.r] = (g.radiusAu[r.r] || 0) + 1; g.gates[r.gate] = (g.gates[r.gate] || 0) + 1; g.density[r.dens] = (g.density[r.dens] || 0) + 1;
  }
  const habitats = {
    markerCount: P.resources.length, byKind,
    status: STATUS.SOURCE,
    ownership: 'MAP records WHERE source-authored habitat markers are. Gameplay owns resource instances, source stock, respawn, loot, locks and economic simulation.',
    noFabrication: 'No runtime resource instance, quantity, stock, loot table, lock state or spawn rate is produced here.',
  };

  // ---- Elder territories ----
  const elders = P.elders.map(e => {
    const outer = e.outer, core = e.core;
    const arenas = e.arenas.map(a => polyMetrics(a));
    const approachLen = e.approach.slice(1).reduce((s, p, k) => s + dist(e.approach[k], p), 0);
    return {
      id: e.id, name: e.name, elder: e.elder, conf: e.conf,
      sourceRef: sourceRef('elders', e.id), status: [STATUS.SOURCE, STATUS.DERIVED],
      geometry: {
        outerAu: outer, coreAu: core, arenasAu: e.arenas, approachAu: e.approach,
        outer: polyMetrics(outer), core: polyMetrics(core), arenas,
        approachLengthAu: r4(approachLen),
      },
      linkedPoiIds: e.pois, ragnarok: e.ragnarok,
      arenaCount: e.arenas.length,
      approachStatus: STATUS.SOURCE,
      separationStatus: STATUS.DERIVED,
    };
  });
  const separation = [];
  for (let i = 0; i < elders.length; i++) for (let j = i + 1; j < elders.length; j++) {
    let best = Infinity;
    for (const p of P.elders[i].outer) { const n = nearestOnLine(P.elders[j].outer, p, true); if (n.d < best) best = n.d; }
    separation.push({ a: elders[i].id, b: elders[j].id, minOuterDistanceAu: r4(best), status: STATUS.DERIVED });
  }
  separation.sort((a, b) => a.minOuterDistanceAu - b.minOuterDistanceAu);

  // ---- connectivity / practical corridors ----
  const corridor = {};
  for (const s of spawns) {
    const start = s.cell;
    const d = start >= 0 && I.walkableCandidate[start] ? bfsDistance(I.walkableCandidate, [start]) : null;
    const reach = d ? zones.map(z => {
      const j = toCell(z.geometry.centroidAu[0], z.geometry.centroidAu[1]);
      return { zoneId: z.id, reachable: j >= 0 && d[j] >= 0, steps: j >= 0 && d[j] >= 0 ? d[j] : null, routeAuLowerBound: j >= 0 && d[j] >= 0 ? d[j] * CELL : null };
    }) : [];
    corridor[s.id] = {
      spawnId: s.id, walkableComponent: s.walkableComponent, componentCells: s.walkableComponent >= 0 ? walkComp.sizes[s.walkableComponent] : 0,
      zonesReachable: reach.filter(r => r.reachable).length, zonesTotal: reach.length,
      nearestReachableZone: reach.filter(r => r.reachable).sort((a, b) => a.steps - b.steps)[0] ?? null,
      unreachableZones: reach.filter(r => !r.reachable).map(r => r.zoneId),
      status: STATUS.DERIVED,
      note: '4-neighbour BFS on GEO-01 walkableCandidate. Reachability is geometric only; no ferry, bridge deck, slope law, cart clearance or survival cost is applied.',
    };
  }

  // ---- connected components summary ----
  const cartLab = components(I.roadCartMaplab);
  const cartGeo = components(Uint8Array.from({ length: N }, (_, i) => I.roadClass[i] === 1 ? 1 : 0));
  const connectivity = {
    walkable: { componentCount: walkComp.count, largestCells: Math.max(...walkComp.sizes), sizesTop10: [...walkComp.sizes].sort((a, b) => b - a).slice(0, 10), status: STATUS.DERIVED },
    cartRoadMaplab: { componentCount: cartLab.count, largestCells: Math.max(...cartLab.sizes), sizesTop10: [...cartLab.sizes].sort((a, b) => b - a).slice(0, 10), status: STATUS.DERIVED, note: 'GEO-02 verified roadCartMaplab mask. GEO-02 audit reported 6 cart-road components; this is a fresh 4-neighbour rederivation.' },
    cartRoadGeo01: { componentCount: cartGeo.count, largestCells: Math.max(...cartGeo.sizes), sizesTop10: [...cartGeo.sizes].sort((a, b) => b - a).slice(0, 10), status: STATUS.DERIVED },
    cargo: { componentCount: cargoComp.count, largestCells: Math.max(...cargoComp.sizes), sizesTop10: [...cargoComp.sizes].sort((a, b) => b - a).slice(0, 10), status: STATUS.DERIVED, note: 'cargoCandidate = cart roads + cart-load bridges + DOCKS; the high component count is dominated by isolated dock centre cells, NOT by 152 separate cart networks. Passability NOT asserted.' },
    chokeClusters: { count: chokeComp.count, totalCells: chokeCells.length, top: chokeClusters.slice(0, 20), status: STATUS.DERIVED },
  };

  return {
    landmasses, coastline, lakes, rivers, watershed: watershed(V), terrain,
    roads, bridges, docks, zones, spawns, habitats, elders, elderSeparation: separation,
    corridors: corridor, connectivity,
    layerNames: Object.keys(I),
    legend, roadClassById,
  };
}
