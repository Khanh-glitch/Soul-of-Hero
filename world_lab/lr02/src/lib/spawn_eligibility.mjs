// MAP-LR02 M2 — deterministic GEOGRAPHY-ONLY spawn/build eligibility compiler.
// Map supplies real candidate AREAS + a machine-readable sampling contract.
// It does NOT choose runtime spawn coordinates, build compounds, occupancy,
// claims, creature-free distances, starter resources or survival fairness.
import { CONST, LR01, r4, dist, readJson, sha256 } from './lr02.mjs';
import path from 'node:path';
import fs from 'node:fs';

export const GW = 250, GH = 175, CELL = 8, N = GW * GH;
const idx = (gx, gy) => gy * GW + gx;
const centre = i => [(i % GW + 0.5) * CELL, (Math.floor(i / GW) + 0.5) * CELL];
const landName = (P, id) => P.land[id - 1]?.id ?? null;
const zoneName = (P, id) => P.zones[id - 1]?.id ?? null;
const poiName = (P, id) => P.pois[id - 1]?.id ?? null;
const elderName = (P, id) => P.elders[id - 1]?.id ?? null;
const riverName = (P, id) => P.rivers[id - 1]?.id ?? null;
const lakeName = (P, id) => P.lakes[id - 1]?.id ?? null;
const roadName = (P, id) => P.roads[id - 1]?.id ?? null;

function convexHull(points) {
  const p = [...new Map(points.map(q => [q.join(','), q])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length <= 2) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let k = p.length - 1; k >= 0; k--) { const q = p[k]; while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function multiSourceDistance(seedMask, cap = 60) {
  const d = new Int16Array(N).fill(-1);
  const q = [];
  for (let i = 0; i < N; i++) if (seedMask[i]) { d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], gx = i % GW, gy = Math.floor(i / GW);
    if (d[i] >= cap) continue;
    for (const j of [gx > 0 ? i - 1 : -1, gx < GW - 1 ? i + 1 : -1, gy > 0 ? i - GW : -1, gy < GH - 1 ? i + GW : -1]) {
      if (j >= 0 && d[j] < 0) { d[j] = d[i] + 1; q.push(j); }
    }
  }
  return d;
}

/** Explicit, source-derived static criteria. NOT a Gameplay passability law. */
export function eligibilityCriteria(I) {
  const landElev = [];
  for (let i = 0; i < N; i++) if (I.landId[i] > 0) landElev.push(I.elevation[i]);
  landElev.sort((a, b) => a - b);
  const p = q => landElev[Math.min(landElev.length - 1, Math.floor(q * landElev.length))];
  const band = [p(0.05), p(0.95)];
  return {
    schema: 'soh.map.lr02.spawn_eligibility_criteria.v1',
    authority: 'MAP_DERIVED_STATIC_GEOGRAPHY__GAMEPLAY_OWNS_RUNTIME_LEGALITY',
    grid: { gw: GW, gh: GH, cellAu: CELL, cells: N, order: 'row_major i=gy*gw+gx', centre: '[(gx+0.5)*8,(gy+0.5)*8] au' },
    include: [
      { id: 'C01', field: 'landId', rule: '>0', meaning: 'cell inside one of the 8 canonical land polygons (holes honoured)' },
      { id: 'C02', field: 'waterClass', rule: '===0', meaning: 'not sea, not lake, not river centreline' },
      { id: 'C03', field: 'walkableCandidate', rule: '===1', meaning: 'GEO-01 derived land minus lake/river geometry' },
      { id: 'C04', field: 'lakeId / riverId / freshwater', rule: '===0', meaning: 'no freshwater geometry overlap' },
      { id: 'C05', field: 'protectedGeometryCandidate / poiGeometryId / elderGeometryId', rule: '===0', meaning: 'outside POI foot/deep and Elder outer/core/arena geometry' },
      { id: 'C06', field: 'coast', rule: '===0', meaning: 'not the shoreline rim cell (land cell with a sea neighbour)' },
      { id: 'C07', field: 'clearanceCells', rule: '>=3', meaning: '>=24 au static clearance from GEO-01 blocked geometry' },
      { id: 'C08', field: 'slope', rule: `<=4`, meaning: 'editor-derived raw-byte relief preference; NOT a Gameplay slope/passability threshold' },
      { id: 'C09', field: 'elevation', rule: `in [${band[0]},${band[1]}]`, meaning: 'source land-height 5th..95th percentile band; excludes raw-byte extremes, no approved physical unit' },
    ],
    reliefBandRawByte: band,
    biomePolicy: 'Biome code is recorded as a DESCRIPTOR and suitability rank; no biome is canonically banned for spawning. Editor badBuildBiomeCodes [4,8,9,10] are used ONLY in build-site envelope assessment, never as a runtime law.',
    unknownConditions: [
      { id: 'U01', name: 'dynamic_occupancy', status: 'UNKNOWN', owner: 'GAMEPLAY' },
      { id: 'U02', name: 'claim_legality', status: 'UNKNOWN', owner: 'GAMEPLAY' },
      { id: 'U03', name: 'hazard_and_creature_exposure', status: 'UNKNOWN', owner: 'GAMEPLAY' },
      { id: 'U04', name: 'actor_separation_and_population', status: 'UNKNOWN', owner: 'GAMEPLAY' },
      { id: 'U05', name: 'runtime_collision_and_swept_clearance', status: 'UNKNOWN', owner: 'GAMEPLAY' },
      { id: 'U06', name: 'authoring_unit_to_runtime_tile_transform', status: 'UNDECIDED', owner: 'GAMEPLAY+MAP' },
      { id: 'U07', name: 'seeded_random_seed_and_final_position', status: 'UNKNOWN', owner: 'GAMEPLAY' },
      { id: 'U08', name: 'starter_resources_inventory_and_items', status: 'GAMEPLAY_OWNED', owner: 'GAMEPLAY' },
    ],
    notAsserted: ['No runtime spawn point', 'No spawn compound/hub', 'No pre-placed house', 'No cleared corridor', 'No beacon', 'No free shelter', 'No starter crate', 'No creature-free distance', 'No occupancy/claim verdict', 'No starter-resource stock'],
  };
}

function rejectionFor(I, i, band) {
  if (I.landId[i] === 0) return 'SEA_OR_NO_LAND';
  if (I.waterClass[i] !== 0) return ['NONE', 'SEA', 'LAKE', 'RIVER_CENTRELINE'][I.waterClass[i]] || 'WATER';
  if (I.walkableCandidate[i] !== 1) return 'NOT_WALKABLE_GEOMETRY';
  if (I.lakeId[i] || I.riverId[i] || I.freshwater[i]) return 'FRESHWATER_GEOMETRY';
  if (I.protectedGeometryCandidate[i] || I.poiGeometryId[i] || I.elderGeometryId[i]) return 'POI_OR_ELDER_PROTECTED_GEOMETRY';
  if (I.coast[i]) return 'SHORELINE_RIM';
  if (I.clearanceCells[i] < 3) return 'INSUFFICIENT_STATIC_CLEARANCE';
  if (I.slope[i] > 4) return 'STEEP_RELIEF_EDITOR_HEURISTIC';
  if (I.elevation[i] < band[0] || I.elevation[i] > band[1]) return 'ELEVATION_RAW_EXTREME';
  return null;
}

/** Whole-Veyra candidate regions from real geographic raster evidence. */
export function compileEligibility(sources, lr01) {
  const { I, P, V, GEO } = sources;
  const criteria = eligibilityCriteria(I);
  const band = criteria.reliefBandRawByte;
  const eligible = new Uint8Array(N);
  const rejection = new Array(N).fill(null);
  let landCells = 0;
  for (let i = 0; i < N; i++) {
    if (I.landId[i] > 0) landCells++;
    const r = rejectionFor(I, i, band);
    if (!r) eligible[i] = 1; else rejection[i] = r;
  }
  // 4-neighbour connected components
  const comp = new Int32Array(N).fill(-1);
  const comps = [];
  for (let i = 0; i < N; i++) {
    if (!eligible[i] || comp[i] >= 0) continue;
    const id = comps.length, cells = [];
    const q = [i]; comp[i] = id;
    for (let h = 0; h < q.length; h++) {
      const c = q[h]; cells.push(c);
      const gx = c % GW, gy = Math.floor(c / GW);
      for (const j of [gx > 0 ? c - 1 : -1, gx < GW - 1 ? c + 1 : -1, gy > 0 ? c - GW : -1, gy < GH - 1 ? c + GW : -1]) {
        if (j >= 0 && eligible[j] && comp[j] < 0) { comp[j] = id; q.push(j); }
      }
    }
    comps.push(cells);
  }
  const MIN_CELLS = 12; // >= 768 au2: reject isolated single cells as candidate AREAS
  const eligibleMaskForDistance = new Uint8Array(N);
  const cartSeed = new Uint8Array(N);
  for (let i = 0; i < N; i++) { if (I.roadClass[i] === 1) cartSeed[i] = 1; }
  const cartDist = multiSourceDistance(cartSeed, 60);

  const regions = [];
  comps.forEach((cells, ci) => {
    if (cells.length < MIN_CELLS) return;
    const landIds = [...new Set(cells.map(i => I.landId[i]))];
    const zones = [...new Set(cells.map(i => I.zoneId[i]).filter(Boolean))];
    const biomes = {};
    let clMin = Infinity, clSum = 0, elMin = Infinity, elMax = -Infinity, elSum = 0, slMin = Infinity, slMax = -Infinity, slSum = 0;
    const corners = [];
    for (const i of cells) {
      const c = centre(i);
      corners.push([c[0] - CELL / 2, c[1] - CELL / 2], [c[0] + CELL / 2, c[1] + CELL / 2]);
      biomes[I.biomeCode[i]] = (biomes[I.biomeCode[i]] || 0) + 1;
      clMin = Math.min(clMin, I.clearanceCells[i]); clSum += I.clearanceCells[i];
      elMin = Math.min(elMin, I.elevation[i]); elMax = Math.max(elMax, I.elevation[i]); elSum += I.elevation[i];
      slMin = Math.min(slMin, I.slope[i]); slMax = Math.max(slMax, I.slope[i]); slSum += I.slope[i];
    }
    const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
    const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r4);
    const cx = cells.reduce((s, i) => s + centre(i)[0], 0) / cells.length;
    const cy = cells.reduce((s, i) => s + centre(i)[1], 0) / cells.length;
    const hull = convexHull(corners).map(p => p.map(r4));
    const minCart = Math.min(...cells.map(i => cartDist[i] < 0 ? 60 : cartDist[i]));
    const nearbyPois = [...new Set(cells.map(i => I.poiGeometryId[i]).filter(Boolean))].slice(0, 8);
    const nearbyRivers = [...new Set(cells.map(i => I.riverId[i]).filter(Boolean))];
    regions.push({
      candidateId: `se.${landIds[0]}.${String(ci).padStart(3, '0')}`,
      parentGeographicIds: {
        landmassIds: landIds.map(id => landName(P, id)).filter(Boolean),
        sourceLandIndices: landIds,
        zoneIds: zones.map(id => zoneName(P, id)).filter(Boolean),
        biomeCodes: biomes,
        nearbyPoiIds: nearbyPois.map(id => poiName(P, id)).filter(Boolean),
        nearbyRiverIds: nearbyRivers.map(id => riverName(P, id)).filter(Boolean),
      },
      provenance: { sourceRef: 'GEO-01 250x175 uint8 raster layers, canonical Veyra GOLD project.land/zones/pois/rivers', canonSha256: V.fingerprint.sha256, rasterManifestRef: '$.inputDigests.rasterLayers' },
      geometry: {
        unit: 'authoring_unit', sourceResolutionAu: CELL,
        cellCount: cells.length, cellIndices: cells,
        cellCentresFormula: '[(i%250+0.5)*8,(floor(i/250)+0.5)*8]',
        areaAu2: r4(cells.length * CELL * CELL),
        bboxAu: bbox, centroidAu: [r4(cx), r4(cy)],
        convexHullAu: hull,
        convexHullStatus: 'CONVEX_HULL_OF_ELIGIBLE_CELL_CORNERS__MAY_INCLUDE_INELIGIBLE_INTERIOR',
        note: 'Authoritative membership is cellIndices, NOT the hull. No warp/crop/rescale.',
      },
      support: {
        localClearanceAu: { min: r4(clMin * CELL), mean: r4(clSum / cells.length * CELL), status: 'DERIVED_STATIC' },
        reliefRawByte: { min: elMin, max: elMax, mean: r4(elSum / cells.length), unit: 'UNKNOWN_SOURCE_BYTE' },
        slopeRawDelta: { min: slMin, max: slMax, mean: r4(slSum / cells.length), unit: 'RAW_BYTE_DELTA_PER_8au_CELL' },
        nearestCartRoadCells: minCart, nearestCartRoadAu: r4(minCart * CELL),
      },
      status: 'DERIVED_STATIC_ELIGIBILITY__NOT_A_RUNTIME_SPAWN_POINT',
      gameplayValidationRequired: criteria.unknownConditions.map(u => u.id),
    });
  });

  // rejection evidence
  const hist = {};
  for (let i = 0; i < N; i++) { const r = rejection[i]; if (r) hist[r] = (hist[r] || 0) + 1; }
  const rejectedByLand = P.land.map((l, k) => {
    const id = k + 1; let land = 0, ok = 0;
    for (let i = 0; i < N; i++) if (I.landId[i] === id) { land++; if (eligible[i]) ok++; }
    return { landId: l.id, landCells: land, eligibleCells: ok, rejectedCells: land - ok, status: 'DERIVED' };
  });
  const rejectedNamedAreas = [];
  for (const [kind, arr, idKey] of [['lake', P.lakes, 'id'], ['elder', P.elders, 'id'], ['poi', P.pois, 'id']]) {
    for (const o of arr) {
      const ring = o.ring || o.outer || o.foot;
      if (!ring?.length) continue;
      const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
      rejectedNamedAreas.push({ kind, id: o[idKey], bboxAu: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r4), reason: kind === 'lake' ? 'FRESHWATER_GEOMETRY' : 'POI_OR_ELDER_PROTECTED_GEOMETRY' });
    }
  }

  // build-site physical envelopes, validated separately from spawn eligibility
  const buildSites = readJson(path.join(LR01, 'output/build_sites.v1.json'));
  const siteEnvelopes = buildSites.sites.map(s => {
    const [x0, y0, x1, y1] = s.footprintBboxAu;
    const gx0 = Math.max(0, Math.floor(x0 / CELL)), gx1 = Math.min(GW - 1, Math.ceil(x1 / CELL));
    const gy0 = Math.max(0, Math.floor(y0 / CELL)), gy1 = Math.min(GH - 1, Math.ceil(y1 / CELL));
    let cells = 0, slSum = 0, elSum = 0, clMin = Infinity, cartMin = Infinity, badBiome = 0, water = 0;
    const biomes = {};
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const i = idx(gx, gy), c = centre(i);
      if (c[0] < x0 || c[0] > x1 || c[1] < y0 || c[1] > y1) continue;
      cells++; slSum += I.slope[i]; elSum += I.elevation[i];
      clMin = Math.min(clMin, I.clearanceCells[i]);
      cartMin = Math.min(cartMin, cartDist[i] < 0 ? 60 : cartDist[i]);
      if ([4, 8, 9, 10].includes(I.biomeCode[i])) badBiome++;
      if (I.waterClass[i] !== 0) water++;
      biomes[I.biomeCode[i]] = (biomes[I.biomeCode[i]] || 0) + 1;
    }
    const frontage = s.nearestRoads?.[0]?.d ?? null;
    return {
      siteId: s.siteId, parentZoneId: s.parentZoneId, sourceRef: s.sourceRef,
      physicalEnvelopeAu: s.footprintBboxAu, footprintAreaAu2: s.footprintAreaAu2,
      derivedCellCount: cells,
      roadFrontage: { nearestCartRoadId: s.nearestRoads?.[0]?.id ?? null, distanceAu: frontage, derivedCartRoadCellDistance: cartMin === Infinity ? null : cartMin, status: frontage !== null ? 'MEASURED_FROM_SOURCE_ROAD_GEOMETRY' : 'UNKNOWN' },
      slopeRawDeltaMean: cells ? r4(slSum / cells) : null,
      elevationRawByteMean: cells ? r4(elSum / cells) : null,
      minStaticClearanceAu: clMin === Infinity ? null : r4(clMin * CELL),
      biomeHistogram: biomes, editorBadBuildBiomeCells: badBiome, waterCells: water, dryCellCount: cells - water,
      geometricEnvelopeStatus: cells >= 8 && water > 0 ? 'PARTIAL_WATER_OVERLAP__DRY_SUBSET_REQUIRED'
        : (cells >= 8 && frontage !== null ? 'VERIFIED_GEOMETRIC_ENVELOPE' : 'BLOCKED_OR_INCOMPLETE'),
      occupancyStatus: 'UNKNOWN', claimLegalityStatus: 'GAMEPLAY_OWNED', sweptClearanceAu: null, sweptClearanceStatus: 'UNKNOWN',
      note: 'Physical envelope + terrain only. NOT a placement grant, house, claim radius or swept vehicle clearance.',
    };
  });

  const distinctLands = [...new Set(regions.flatMap(r => r.parentGeographicIds.landmassIds))];
  const distinctZones = [...new Set(regions.flatMap(r => r.parentGeographicIds.zoneIds))];
  const coverage = {
    frame: CONST.frame, totalLandCells: landCells,
    staticallyEligibleCells: regions.reduce((s, r) => s + r.geometry.cellCount, 0),
    eligibleFractionOfLand: r4(regions.reduce((s, r) => s + r.geometry.cellCount, 0) / landCells),
    candidateRegions: regions.length,
    distinctLandmasses: distinctLands.length, distinctLandmassIds: distinctLands,
    distinctSourceZones: distinctZones.length,
    rejectedLandCells: landCells - regions.reduce((s, r) => s + r.geometry.cellCount, 0),
    rejectionHistogram: hist,
    rejectedByLandmass: rejectedByLand,
    smallComponentsDiscarded: comps.filter(c => c.length < MIN_CELLS).length,
    status: 'DERIVED_COVERAGE__NO_RUNTIME_SPAWN_AUTHORITY',
  };
  return {
    schema: 'soh.map.lr02.spawn_eligibility.v1',
    authority: 'MAP_GEOGRAPHY_ONLY__GAMEPLAY_POPULATES_AND_SIMULATES',
    status: 'DERIVED_STATIC_ELIGIBILITY',
    frame: { authoring: CONST.frame, transformStatus: 'UNDECIDED', fullFrameRetained: true },
    inputDigests: {
      canonSha256: V.fingerprint.sha256,
      geo01GeographySha256: GEO.fingerprints.geography.sha256,
      rasterLayers: Object.fromEntries(Object.entries(GEO.r1).map(([k, v]) => [k, v.sha256])),
      lr01ParentDigest: CONST.lr01Digest,
    },
    criteria, coverage,
    candidateRegions: regions,
    rejectedAreas: { histogram: hist, byLandmass: rejectedByLand, namedAreas: rejectedNamedAreas, status: 'DERIVED_REJECTION_EVIDENCE' },
    buildSiteEnvelopes: siteEnvelopes,
    spLandmarkPolicy: {
      ids: P.spawns.map(s => s.id),
      status: 'SOURCE_AUTHORED_PROVENANCE_LANDMARK_ONLY',
      note: 'sp_* anchors remain canonical provenance landmarks. They are NOT runtime spawn coordinates, NOT spawn compounds, NOT final seeded positions.',
    },
    gameplayContract: {
      schema: 'soh.map.lr02.spawn_eligibility_contract.v1',
      consumer: 'GAMEPLAY',
      decision: 'SEEDED_RANDOM_LEGAL_POSITION_SAMPLING',
      mapProvides: ['staticEligibleCells', 'candidateRegionGeometry', 'parentGeographicIds', 'sourceResolutionAu', 'localClearanceAu', 'reliefAndSlopeDescriptors', 'rejectionEvidence'],
      gameplayMustProvide: ['seed', 'runtime tile transform', 'runtime collision test', 'dynamic occupancy', 'claim legality', 'hazard/creature exposure', 'actor separation', 'final position persistence', 'starter resource policy'],
      algorithm: 'Choose a candidate region by Gameplay-owned policy, then seed a uniform sample over its cellIndices; project with the Gameplay-approved transform; reject on runtime collision/occupancy/claim/hazard; resample. Map never pre-selects the final point.',
      unknowns: criteria.unknownConditions,
      forbidden: criteria.notAsserted,
    },
    noClaims: [
      'NO predetermined runtime spawn coordinate', 'NO spawn compound/hub/beacon/cleared corridor',
      'NO pre-placed house, free shelter, starter crate or starting installation',
      'NO occupancy/claim legality', 'NO creature-free distance', 'NO starter resource stock or item list',
      'NO Gameplay runtime collision or swept clearance verdict', 'NO approved au->tile scale',
    ],
  };
}

/** Source-raster + canonical-vector context for one bounded region (M0/M3). */
export function compileLocalContext(sources, lr01, spec) {
  const { I, P, V, GEO } = sources;
  const { id, windowAu, label } = spec;
  const [x0, y0, x1, y1] = windowAu;
  const gx0 = Math.max(0, Math.floor(x0 / CELL)), gx1 = Math.min(GW - 1, Math.ceil(x1 / CELL));
  const gy0 = Math.max(0, Math.floor(y0 / CELL)), gy1 = Math.min(GH - 1, Math.ceil(y1 / CELL));
  const cellStats = { cells: 0, waterClass: {}, biomeCode: {}, elevationRawByte: {}, slopeRawDelta: {}, roadClass: {}, zoneId: {}, poiGeometryId: {}, clearanceCells: {}, landId: {}, buildableCandidate: 0, walkableCandidate: 0, protectedGeometryCandidate: 0 };
  const bump = (obj, k) => { obj[k] = (obj[k] || 0) + 1; };
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const i = idx(gx, gy), c = centre(i);
    if (c[0] < x0 || c[0] > x1 || c[1] < y0 || c[1] > y1) continue;
    cellStats.cells++;
    for (const k of ['waterClass', 'biomeCode', 'elevationRawByte', 'slopeRawDelta', 'roadClass', 'zoneId', 'poiGeometryId', 'clearanceCells', 'landId']) {
      const field = k === 'elevationRawByte' ? 'elevation' : k === 'slopeRawDelta' ? 'slope' : k;
      bump(cellStats[k], I[field][i]);
    }
    if (I.buildableCandidate[i]) cellStats.buildableCandidate++;
    if (I.walkableCandidate[i]) cellStats.walkableCandidate++;
    if (I.protectedGeometryCandidate[i]) cellStats.protectedGeometryCandidate++;
  }
  const bboxOf = ring => { const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r4); };
  const overlaps = b => b && b[0] <= x1 && b[2] >= x0 && b[1] <= y1 && b[3] >= y0;
  const pointList = arr => ({
    land: 'rings', zones: 'ring', pois: 'foot', lakes: 'ring', rivers: 'points', roads: 'points', elders: 'outer',
  })[arr];
  const feature = (kind, arr) => arr.map(o => {
    const key = pointList(kind);
    const raw = key ? o[key] : null;
    const first = Array.isArray(raw) && raw.length ? raw[0] : null;
    const ring = Array.isArray(first) && typeof first[0] === 'number' ? raw
      : (Array.isArray(first) && Array.isArray(first[0]) ? first : null);
    const b = ring?.length ? bboxOf(ring) : (o.points?.length ? bboxOf(o.points) : (o.at ? [o.at[0], o.at[1], o.at[0], o.at[1]].map(r4) : null));
    return { id: o.id, name: o.name ?? null, kind: o.kind ?? kind, atAu: o.at ? o.at.map(r4) : null, bboxAu: b, sourceRef: `project.${kind}[] where id=${o.id}` };
  }).filter(o => overlaps(o.bboxAu));
  const nearby = {
    landmasses: feature('land', P.land), zones: feature('zones', P.zones), pois: feature('pois', P.pois),
    lakes: feature('lakes', P.lakes), rivers: feature('rivers', P.rivers), roads: feature('roads', P.roads),
    bridges: feature('bridges', P.bridges), docks: feature('docks', P.docks),
    spawns: feature('spawns', P.spawns), elders: feature('elders', P.elders),
  };
  const regionFile = path.join(LR01, 'output/regions', `${id}.v1.json`);
  const region = fs.existsSync(regionFile) ? readJson(regionFile) : null;
  return {
    id, label, windowAu: windowAu.map(r4), unit: 'authoring_unit',
    frame: { authoring: CONST.frame, transformStatus: 'UNDECIDED' },
    sourceRaster: { grid: { gw: GW, gh: GH, cellAu: CELL }, sha256s: Object.fromEntries(Object.entries(GEO.r1).map(([k, v]) => [k, v.sha256])), encoding: 'world_lab/geo01/output/geography.v1.json :: layers.semantics', note: 'uint8 source bytes; no approved physical scale' },
    cellStats,
    canonicalFeatures: nearby,
    lr01Region: region ? {
      id: region.id, name: region.name, sourceRef: region.sourceRef, status: region.status,
      geometry: region.geometry, rasterCells: region.rasterCells,
      buildSuitability: region.buildSuitability, loadingSpace: region.loadingSpace,
      nearestRoads: region.nearestRoads, walkableComponentIds: region.walkableComponentIds,
    } : null,
    note: 'Real source raster + canonical vectors + LR01 derived region. No flat-map artwork, no invented terrain, no runtime transform.',
  };
}
