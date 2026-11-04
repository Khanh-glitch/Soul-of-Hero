// WMP-01 typed, versioned physical-world query API. CLEAN-ROOM: reads ONLY data/, layers/, rasters/.
// Every response is typed and versioned. Undefined width / temperature / collision is NEVER a PASS.
import path from 'node:path';
import {
  MASTER, GW, GH, CELL, N, FRAME_AU, CHUNK_CELLS, CHUNK_AU, CHUNKS_X, CHUNKS_Y,
  readJson, readU8, readBuf, sha256, digest, r4, idx, gxOf, gyOf, centreAu, toCell, inFrame,
  loadRasters, loadDerivedRasters, pointInRing, pointInRings, bbox, dist, STATUS, authority,
} from '../lib/wmp.mjs';

export const WORLD_API_VERSION = 'soh.wmp.query.v1';
const OK = (kind, extra) => ({ schema: WORLD_API_VERSION, query: kind, version: 1, authority, ...extra });
const ERR = (kind, errors) => ({ schema: WORLD_API_VERSION, query: kind, version: 1, authority, status: STATUS.INVALID, errors, data: null });
function atOf(q) {
  const p = q?.atAu;
  if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) return null;
  if (!inFrame(p[0], p[1])) return null;
  return p;
}
function wrap(kind, q, fn) {
  const p = atOf(q);
  if (!p) return ERR(kind, ['atAu must be a finite [xAu,yAu] inside [0,2000)x[0,1400)']);
  try { return fn(p, q); } catch (e) { return ERR(kind, [String(e?.message ?? e)]); }
}

export function createWorld() {
  const manifest = readJson('manifest.v1.json');
  const srcMan = readJson('data/source_manifest.v1.json');
  const snap = readJson('data/canon/geometry_snapshot.v1.json');
  const terrain = readJson('layers/terrain.v1.json');
  const hydrology = readJson('layers/hydrology.v1.json');
  const climate = readJson('layers/climate.v1.json');
  const resources = readJson('layers/resources.v1.json');
  const transport = readJson('layers/transport.v1.json');
  const architecture = readJson('layers/architecture.v1.json');
  const envelopes = readJson('layers/build_habitat_endgame.v1.json');
  const chunks = readJson('layers/chunks.v1.json');
  const scales = readJson('layers/scales.v1.json');
  const crosswalks = readJson('layers/crosswalks.v1.json');
  const decisions = readJson('layers/decision_register.v1.json');
  const S = loadRasters();
  const D = loadDerivedRasters();
  const C = snap.collections;
  const idIndex = new Map(chunks.featureIndex.features.map(f => [f.id, f]));
  const chunkIndex = new Map(chunks.chunks.map(c => [c.id, c]));
  const poiIndex = new Map(architecture.pois.map(p => [p.poiId, p]));
  const verticalIndex = new Map(architecture.verticalLinks.map(v => [v.poiId, v]));
  const envIndex = new Map(envelopes.buildEnvelopes.sites.map(e => [e.siteId, e]));
  const roadIndex = new Map(transport.roads.map(r => [r.id, r]));
  const bodyIndex = new Map(transport.bodyProfiles.map(p => [p.id, p]));
  const resourceSites = [...resources.authoredHabitatMarkers, ...resources.roadsideCandidates, ...resources.industrialZones, ...resources.poiOpportunities, ...resources.rareEndgame];
  const regionByKey = new Map(climate.climateRegions.map(r => [r.key, r]));
  const chunkAt = i => `chunk.${Math.floor(gxOf(i) / CHUNK_CELLS)}.${Math.floor(gyOf(i) / CHUNK_CELLS)}`;
  const surfaceLegend = new Map(crosswalks.webTerrainCodes.map(t => [t.code, t.name]));

  function featuresAtCell(i) {
    const out = [];
    if (S.landId[i] > 0) out.push(`land:${S.landId[i]}`);
    if (S.lakeId[i] > 0) out.push(`lake:${S.lakeId[i]}`);
    if (S.riverId[i] > 0) out.push(`river:${S.riverId[i]}`);
    if (S.poiGeometryId[i] > 0) out.push(`poiGeometry:${S.poiGeometryId[i]}`);
    if (S.zoneId[i] > 0) out.push(`zone:${S.zoneId[i]}`);
    if (S.elderGeometryId[i] > 0) out.push(`elderGeometry:${S.elderGeometryId[i]}`);
    return out;
  }
  function elderAt(p) {
    const e = C.elders.find(x => pointInRing(p, x.outer));
    if (!e) return { elderTerritoryId: null, status: 'NO_ELDER_TERRITORY' };
    return { elderTerritoryId: e.id, elder: e.elder, core: pointInRing(p, e.core), arenaCount: e.arenas?.length ?? 0, approachAu: e.approach, status: STATUS.SOURCE_AUTHORED };
  }

  // ---------------------------- typed queries ----------------------------
  function groundAt(q) {
    return wrap('groundAt', q, (p) => {
      const i = toCell(p[0], p[1]);
      return OK('groundAt', {
        atAu: p.map(r4), cellIndex: i, chunkId: chunkAt(i), sourceCellCentreAu: centreAu(i).map(r4),
        status: 'PHYSICAL_TERRAIN_CANDIDATE',
        data: {
          surfaceCode: D.surface[i], surfaceName: surfaceLegend.get(D.surface[i]) ?? 'UNKNOWN',
          landform: D.landform[i], substrate: D.substrate[i], soil: D.soil[i],
          slopeClass: D.slopeClass[i], cliff: !!D.cliff[i], terrace: !!D.terrace[i],
          constructionSuitability: D.construction[i], vegetationAffordance: D.vegetation[i],
          biomeSubtypeCode: D.biomeSubtype[i], biomeTransition: !!D.biomeTransition[i],
          footprintRetention: D.footprint[i], exposure: D.exposure[i], shade: D.shade[i], drainage: D.drainage[i],
          elevationRawByte: S.elevation[i], elevationUnit: STATUS.UNRESOLVED, elevationMetres: STATUS.UNKNOWN,
          slopeRawByte: S.slope[i], slopeUnit: STATUS.UNRESOLVED, slopeDegrees: STATUS.UNKNOWN,
          landId: S.landId[i], zoneId: S.zoneId[i], featureRefs: featuresAtCell(i),
        },
        unknowns: ['elevation in metres', 'slope in degrees', 'approved runtime scale', 'collision law'],
      });
    });
  }
  function waterAt(q) {
    return wrap('waterAt', q, (p) => {
      const i = toCell(p[0], p[1]);
      const wc = S.waterClass[i];
      const river = wc === 3 && S.riverId[i] > 0 ? C.rivers.find(r => r.id === `rv_${S.riverId[i]}`) ?? hydrology.waterBodies.find(w => w.id.startsWith('rv_')) : null;
      return OK('waterAt', {
        atAu: p.map(r4), cellIndex: i, chunkId: chunkAt(i), status: wc === 0 ? 'DRY_LAND' : 'WATER_PRESENT',
        data: {
          waterClass: wc, waterClassName: ['LAND', 'SEA', 'LAKE', 'RIVER'][wc],
          freshwater: !!S.freshwater[i], bank: D.bank[i], channel: !!D.channel[i], floodplain: !!D.floodplain[i],
          seaDistanceCells: S.seaDistanceCells[i], freshwaterProximityCells: S.freshwaterProximityCells[i],
          lakeId: S.lakeId[i], riverId: S.riverId[i],
          physicalDepth: { value: null, status: STATUS.UNKNOWN, owner: 'MAP+GAMEPLAY' },
          physicalNavigableWidth: { value: null, status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY' },
          authoredEditorStrokeWidthAu: river?.authoredStrokeWidthAu ?? null,
          flowRate: { value: null, status: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
          freshSaltIdentity: wc === 1 ? 'SALT_SEA' : (wc === 2 ? 'FRESHWATER_LAKE' : (wc === 3 ? 'FRESHWATER_RIVER' : 'NOT_WATER')),
          direction: river?.direction ?? { status: STATUS.UNRESOLVED },
        },
        unknowns: ['depth', 'navigable width', 'flow rate', 'fordability', 'ferry/boat rule'],
      });
    });
  }
  function terrainProfile(q) {
    const from = q?.fromAu, to = q?.toAu, samples = Math.max(2, Math.min(256, Number(q?.samples ?? 16) || 16));
    if (!Array.isArray(from) || !Array.isArray(to) || from.length !== 2 || to.length !== 2 || ![...from, ...to].every(Number.isFinite) || !inFrame(from[0], from[1]) || !inFrame(to[0], to[1])) return ERR('terrainProfile', ['fromAu/toAu must be finite points inside the authoring frame']);
    const pts = [];
    for (let k = 0; k <= samples; k++) {
      const t = k / samples, p = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
      const g = groundAt({ atAu: p }), i = toCell(p[0], p[1]);
      if (g.status === STATUS.INVALID) return ERR('terrainProfile', g.errors);
      pts.push({ t: r4(t), atAu: p.map(r4), elevationRawByte: S.elevation[i], slopeRawByte: S.slope[i], surfaceCode: D.surface[i], landform: D.landform[i], soil: D.soil[i], substrate: D.substrate[i], construction: D.construction[i], chunkId: chunkAt(i) });
    }
    return OK('terrainProfile', { fromAu: from.map(r4), toAu: to.map(r4), sampleCount: pts.length, lengthAu: r4(dist(from, to)), unit: 'authoring_unit', data: pts, elevationUnit: STATUS.UNRESOLVED, slopeUnit: STATUS.UNRESOLVED, chunkSequence: [...new Set(pts.map(p => p.chunkId))], unknowns: ['elevation in metres', 'slope in degrees', 'climbable grade limit'] });
  }
  function climateBaselineAt(q) {
    return wrap('climateBaselineAt', q, (p) => {
      const i = toCell(p[0], p[1]);
      const g = Math.max(1, Math.min(12, Math.floor(D.climateRegion[i] / 10)));
      const region = climate.climateRegions.find(r => r.key === ['', 'TEMPERATE', 'CANOPY', 'ANCIENT_CANOPY', 'CONIFER', 'WETLAND', 'ARID', 'SCRUB', 'ROCK', 'COLD', 'VOLCANIC', 'TOXIC', 'LITTORAL'][g]) ?? null;
      return OK('climateBaselineAt', {
        atAu: p.map(r4), cellIndex: i, status: 'STATIC_SPATIAL_CLIMATE_POTENTIAL_ONLY',
        data: {
          climateRegionId: region?.id ?? null, climateRegionKey: region?.key ?? 'UNMAPPED',
          temperaturePotentialOrdinal: D.temperaturePotential[i], humidityPotentialOrdinal: D.humidityPotential[i],
          rainExposureOrdinal: D.rainExposure[i], sunExposureOrdinal: D.sunExposure[i], windExposureOrdinal: D.windExposure[i],
          frostPotentialOrdinal: D.frostPotential[i], soilMoistureOrdinal: D.soilMoisture[i], evaporationOrdinal: D.evaporation[i],
          firePropagationPotentialOrdinal: D.firePropagation[i], fireFuelOrdinal: D.fireFuel[i], naturalFirebreak: D.firebreak[i],
          vegetationAffordance: D.vegetation[i], farmingAffordance: D.farmingAffordance[i],
          hot: region?.hot ?? STATUS.UNKNOWN, cold: region?.cold ?? STATUS.UNKNOWN, wetland: region?.wetland ?? STATUS.UNKNOWN,
          snow: region?.snow ?? STATUS.UNKNOWN, toxic: region?.toxic ?? STATUS.UNKNOWN, radiation: STATUS.UNKNOWN,
          numeric: { temperatureCelsius: STATUS.UNKNOWN, damagePerSecond: STATUS.UNKNOWN, rainRate: STATUS.UNKNOWN, seasonalRate: STATUS.UNKNOWN, weatherRealization: 'GAMEPLAY_OWNED', thermalEffect: 'GAMEPLAY_OWNED', survivalConsequence: 'GAMEPLAY_OWNED' },
        },
        unknowns: climate.explicitUnknowns.map(u => u.id),
      });
    });
  }
  function traversalCandidateAt(q) {
    return wrap('traversalCandidateAt', q, (p, qq) => {
      const i = toCell(p[0], p[1]);
      const profileId = qq?.bodyProfileId ?? null;
      const profile = profileId ? bodyIndex.get(profileId) : null;
      const widthAu = Number.isFinite(qq?.widthAu) ? qq.widthAu : (profile?.widthAu ?? null);
      const clearanceAu = S.clearanceCells[i] * CELL;
      const water = S.waterClass[i] > 0;
      const missing = [];
      if (widthAu === null) missing.push('body width');
      if (!profileId) missing.push('explicit bodyProfileId');
      const geometricFit = widthAu !== null ? clearanceAu >= widthAu : null;
      const verdict = widthAu === null ? STATUS.UNKNOWN : (water || clearanceAu < widthAu ? STATUS.BLOCKED : STATUS.UNKNOWN);
      return OK('traversalCandidateAt', {
        atAu: p.map(r4), cellIndex: i, chunkId: chunkAt(i), status: verdict,
        data: {
          bodyProfileId: profileId, bodyProfileStatus: profile?.status ?? (profileId ? 'UNKNOWN_PROFILE_ID' : 'NOT_SUPPLIED'),
          widthAu, clearanceCells: S.clearanceCells[i], centreClearanceAu: clearanceAu,
          waterClass: S.waterClass[i], roadClass: S.roadClass[i], surfaceCode: D.surface[i], slopeRawByte: S.slope[i],
          geometricCentreFit: geometricFit === null ? STATUS.UNKNOWN : (geometricFit ? 'GEOMETRIC_FIT_ONLY' : 'INSUFFICIENT_CLEARANCE'),
          sweptClearance: STATUS.UNKNOWN, turningRadius: STATUS.UNKNOWN, trailerSweep: STATUS.UNKNOWN,
          bridgeDeckVerified: false, gradeLimit: STATUS.UNKNOWN, dynamicCollision: 'GAMEPLAY_OWNED',
          verdict,
          reason: 'A centreline clearance comparison is NOT a swept clearance, turning-radius, grade or bridge-deck test. With any missing input the verdict is UNKNOWN, never PASS.',
          missingInputs: missing,
        },
        unknowns: ['swept clearance', 'turning radius', 'trailer sweep', 'grade limit', 'bridge deck', 'dynamic collision'],
      });
    });
  }
  function resourceSiteCandidates(q) {
    const p = atOf(q);
    if (!p) return ERR('resourceSiteCandidates', ['atAu must be a finite [xAu,yAu] inside the authoring frame']);
    const radius = Number.isFinite(q?.radiusAu) ? Math.max(1, Math.min(2000, q.radiusAu)) : 200;
    const siteClass = q?.siteClass ?? null;
    const out = resourceSites.filter(s => {
      const a = s.atAu ?? s.interactionLocationAu;
      if (!Array.isArray(a)) return false;
      if (siteClass && s.siteClass !== siteClass) return false;
      return dist(a, p) <= radius;
    }).slice(0, 64);
    return OK('resourceSiteCandidates', { atAu: p.map(r4), radiusAu: radius, siteClass, count: out.length, truncated: out.length === 64, data: out, ownership: resources.ownership, noClaims: ['NO stock', 'NO loot table', 'NO yield', 'NO respawn', 'NO free starter grant', 'NO Core reward'] });
  }
  function buildEnvelopeAt(q) {
    return wrap('buildEnvelopeAt', q, (p) => {
      const i = toCell(p[0], p[1]);
      const sites = envelopes.buildEnvelopes.sites.filter(e => p[0] >= e.physicalEnvelopeAu[0] && p[0] <= e.physicalEnvelopeAu[2] && p[1] >= e.physicalEnvelopeAu[1] && p[1] <= e.physicalEnvelopeAu[3]);
      return OK('buildEnvelopeAt', {
        atAu: p.map(r4), cellIndex: i, chunkId: chunkAt(i), status: sites.length ? 'ENVELOPE_PRESENT' : 'NO_AUTHORED_ENVELOPE',
        data: {
          siteIds: sites.map(s => s.siteId), envelopes: sites,
          geometricBuildCandidate: !!D.buildable[i], constructionSuitability: D.construction[i],
          waterClass: S.waterClass[i], waterOverlapResolved: sites.length ? sites.every(s => s.waterOverlapResolved) : null,
          occupancy: STATUS.UNKNOWN, claimLegality: 'GAMEPLAY_OWNED', sweptClearance: STATUS.UNKNOWN,
          placedStructure: null, playerBuilding: 'GAMEPLAY_OWNED',
        },
        unknowns: ['occupancy', 'claims', 'swept clearance', 'placed structures'],
      });
    });
  }
  function poiGraph(q) {
    const poiId = q?.poiId;
    const p = poiIndex.get(poiId);
    if (!p) return ERR('poiGraph', [`unknown poiId ${JSON.stringify(poiId)}`, 'Use one of layers/architecture.v1.json pois[].poiId']);
    const v = verticalIndex.get(poiId) ?? null;
    return OK('poiGraph', {
      poiId, status: 'PHYSICAL_ARCHITECTURE_CANDIDATE', authority,
      data: {
        name: p.name, arche: p.arche, atAu: p.atAu, enclosureClass: p.enclosureClass, openAirYard: p.openAirYard,
        levels: p.levels, roomCount: p.roomCount, rooms: p.rooms, roofCoverage: p.roofCoverage,
        roofPolygonCount: p.roofPolygonCount, roofPolygons: p.roofPolygons,
        staticSolids: p.staticSolids, staticOpenings: p.staticOpenings,
        circulation: p.circulation, retreat: p.retreat, loadingAccess: p.loadingAccess,
        los: p.los, verticalLink: v, idMapping: p.idMapping, exceptions: p.exceptions,
        dynamicOwnership: p.dynamicOwnership,
      },
      unknowns: ['vertical separation', 'lock/power/HP/ownership', 'loot', 'enemy placement', 'runtime collision'],
    });
  }
  function habitatAt(q) {
    return wrap('habitatAt', q, (p) => {
      const i = toCell(p[0], p[1]);
      const g = Math.max(1, Math.min(12, Math.floor(D.climateRegion[i] / 10)));
      const key = ['', 'TEMPERATE', 'CANOPY', 'ANCIENT_CANOPY', 'CONIFER', 'WETLAND', 'ARID', 'SCRUB', 'ROCK', 'COLD', 'VOLCANIC', 'TOXIC', 'LITTORAL'][g];
      const region = envelopes.habitatRegions.regions.find(r => r.biomeGroup === key) ?? null;
      return OK('habitatAt', {
        atAu: p.map(r4), cellIndex: i, chunkId: chunkAt(i), status: 'HABITAT_GEOMETRY_ONLY',
        data: {
          habitatRegionId: region?.id ?? null, biomeGroup: key,
          visibilityBarriers: region?.visibilityBarriers ?? [], footprintSensitiveSurfaces: region?.footprintSensitiveSurfaces ?? [],
          roamingCorridors: region?.roamingCorridors ?? [], elderTerritory: elderAt(p),
          biomeSubtypeCode: D.biomeSubtype[i], vegetationAffordance: D.vegetation[i], shade: D.shade[i], cliff: !!D.cliff[i],
          spawnCounts: STATUS.UNKNOWN, raidPercentages: STATUS.UNKNOWN, aiBehaviour: 'GAMEPLAY_OWNED', enemyPlacement: 'GAMEPLAY_OWNED',
        },
        unknowns: ['spawn counts', 'raid percentages', 'AI behaviour', 'enemy placement'],
      });
    });
  }
  function visualSurfaceIds(q) {
    const bb = q?.bboxAu ?? [0, 0, FRAME_AU[0], FRAME_AU[1]];
    if (!Array.isArray(bb) || bb.length !== 4 || !bb.every(Number.isFinite)) return ERR('visualSurfaceIds', ['bboxAu must be [x0,y0,x1,y1]']);
    const x0 = Math.max(0, Math.floor(Math.min(bb[0], bb[2]) / CELL)), x1 = Math.min(GW - 1, Math.floor(Math.max(bb[0], bb[2]) / CELL));
    const y0 = Math.max(0, Math.floor(Math.min(bb[1], bb[3]) / CELL)), y1 = Math.min(GH - 1, Math.floor(Math.max(bb[1], bb[3]) / CELL));
    const counts = new Map();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = D.surface[idx(x, y)]; counts.set(c, (counts.get(c) ?? 0) + 1); }
    return OK('visualSurfaceIds', {
      bboxAu: bb.map(r4), cellRange: { x0, y0, x1, y1 }, cellCount: (x1 - x0 + 1) * (y1 - y0 + 1),
      status: 'TECHNICAL_SURFACE_IDS__NOT_ART_DIRECTION',
      data: {
        surfaceCodes: [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([code, cells]) => ({ code, name: surfaceLegend.get(code) ?? 'UNKNOWN', cells })),
        derivedRasterIds: Object.keys(D), sourceRasterIds: Object.keys(S),
        palette: terrain.biomeLegend.map(b => ({ code: b.code, key: b.key, sourceColor: b.sourceColor, status: 'SOURCE_PALETTE_REFERENCE_ONLY' })),
        analyticalViews: 'evidence/views/views_index.v1.json',
        realWebCaptures: 'evidence/web_captures_index.v1.json',
        realWebRenderedIntegrationProof: 'NOT_AVAILABLE__GAMEPLAY_OWNED',
      },
      unknowns: ['creator visual approval', 'runtime tileset', 'animated shore glints'],
    });
  }
  function chunkInfo(q) {
    return wrap('chunkInfo', q, (p) => {
      const i = toCell(p[0], p[1]), id = chunkAt(i);
      const c = chunkIndex.get(id);
      return OK('chunkInfo', { atAu: p.map(r4), cellIndex: i, chunkId: id, status: 'CHUNK_AWARE_INDEX', data: { chunk: c, neighbours: c.neighbours.map(n => chunkIndex.get(n)?.id), featureIds: c.featureIds, stableIdDigest: c.stableIdDigest } });
    });
  }
  function featureInfo(q) {
    const id = q?.featureId;
    const f = idIndex.get(id);
    if (!f) return ERR('featureInfo', [`unknown featureId ${JSON.stringify(id)}`]);
    return OK('featureInfo', { featureId: id, status: STATUS.SOURCE_AUTHORED, data: f });
  }
  function scaleInfo(q) {
    const id = q?.profileId ?? null;
    const p = id ? scales.profiles.find(x => x.id === id) : null;
    return OK('scaleInfo', { profileId: id, status: 'COMPARISON_PROFILE__NOT_APPROVED_CANON', data: { profiles: scales.profiles, recommendation: scales.recommendation, selected: p }, unknowns: ['approved canon scale', 'body dimensions', 'swept clearance'] });
  }
  function endgameRoutes(q) {
    return OK('endgameRoutes', { status: 'PHYSICAL_ROUTE_CANDIDATES_ONLY', data: envelopes.endgame, unknowns: ['stock', 'cash', 'receipts', 'escrow placement', 'evac timer', 'survival/economy proof'] });
  }
  function decisionRegister() {
    return OK('decisionRegister', { status: 'PENDING_BATCH', data: decisions.items });
  }

  return Object.freeze({
    version: WORLD_API_VERSION, manifest: { revisionDigest: manifest.revisionDigest, status: manifest.status, frame: manifest.frame },
    sourceManifestSha: sha256(readBuf('data/source_manifest.v1.json')),
    groundAt, waterAt, terrainProfile, climateBaselineAt, traversalCandidateAt, resourceSiteCandidates,
    buildEnvelopeAt, poiGraph, habitatAt, visualSurfaceIds, chunkInfo, featureInfo, scaleInfo,
    endgameRoutes, decisionRegister,
    _internal: { S, D, C, manifest, snap, srcMan, architecture, envelopes, chunks, transport, resources, climate, hydrology, scales, crosswalks, terrain, decisions, chunkAt, pointInRing, poiIndex, roadIndex, bodyIndex },
  });
}
