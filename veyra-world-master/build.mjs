#!/usr/bin/env node
// WMP-01 deterministic CLEAN-ROOM compiler.
// INPUT:  data/ only (self-contained migration output).
// OUTPUT: layers/*.v1.json, rasters/*.u8, manifest.v1.json.
// NO GOLD, NO MapLab, NO git, NO network, NO legacy source tree, NO Gameplay writes.
import fs from 'node:fs';
import path from 'node:path';
import {
  MASTER, DATA, LAYERS, DERIVED, EVIDENCE, DOCS, GW, GH, CELL, N, FRAME_AU,
  CHUNK_CELLS, CHUNK_AU, CHUNKS_X, CHUNKS_Y,
  sha256, digest, r4, idx, gxOf, gyOf, centreAu, toCell,
  readJson, readBuf, readU8, writeJson, writeU8, loadRasters,
  dist, pointInRing, pointInRings, ringArea, ringCentroid, ringPerimeter, bbox,
  scaleRingAbout, polylineLength, nearestOnPolyline, distPointSegment, segmentHitsWall,
  roundTrip, STATUS, authority,
} from './lib/wmp.mjs';

const t0 = Date.now();
const written = [];
const emit = (rel, obj) => { const e = writeJson(rel, obj); written.push({ ...e, kind: 'layer' }); return e; };
const emitU8 = (rel, arr, meta = {}) => { const e = writeU8(rel, arr); written.push({ ...e, kind: 'derived_raster', ...meta }); return e; };
const U8 = () => new Uint8Array(N);
const cell4 = i => {
  const x = gxOf(i), y = gyOf(i), out = [];
  if (x > 0) out.push(idx(x - 1, y)); if (x < GW - 1) out.push(idx(x + 1, y));
  if (y > 0) out.push(idx(x, y - 1)); if (y < GH - 1) out.push(idx(x, y + 1));
  return out;
};

const srcMan = readJson('data/source_manifest.v1.json');
const snap = readJson('data/canon/geometry_snapshot.v1.json');
const C = snap.collections;
const R = loadRasters();
const PG = readJson('data/legacy/lr02/portal_geometry.v1.json');
const SE = readJson('data/legacy/lr02/spawn_eligibility.v1.json');
const WA = readJson('data/legacy/lr02/world_architecture.v1.json');
const RG = readJson('data/legacy/lr02/region_static_geometry.v1.json');
const LAYOUTS = readJson('data/legacy/lr01/poi_layouts.v1.json').layouts;
const B = readJson('data/legacy/lr01/geography.v1.json');
const TR = readJson('data/legacy/lr01/transport.v1.json');
const SCALE = readJson('data/legacy/lr01/scale_corrected.v1.json');
const FEATURE_STATUS = readJson('data/legacy/lr01/feature_status.v1.json');
const V2 = readJson('data/legacy/lr02/geography_package.v2.json');

const pgByPoi = new Map(PG.pois.map(p => [p.poiId, p]));
const layoutByPoi = new Map(LAYOUTS.map(l => [l.poiId, l]));

// ======================================================================
// 0. CANONICAL FEATURE INDEX (579) — preserves every authored ID.
// ======================================================================
const COLLECTION_META = {
  land: { kind: 'LANDMASS', geometry: 'rings' }, lakes: { kind: 'LAKE', geometry: 'ring' },
  rivers: { kind: 'RIVER', geometry: 'points' }, roads: { kind: 'ROAD', geometry: 'points' },
  bridges: { kind: 'BRIDGE', geometry: 'point' }, docks: { kind: 'DOCK', geometry: 'point' },
  pois: { kind: 'POI', geometry: 'foot+deep' }, zones: { kind: 'ZONE', geometry: 'ring' },
  resources: { kind: 'HABITAT_MARKER', geometry: 'point' }, spawns: { kind: 'SPAWN_LANDMARK', geometry: 'point' },
  elders: { kind: 'ELDER_TERRITORY', geometry: 'outer+core+arenas+approach' }, labels: { kind: 'LABEL', geometry: 'point' },
};
const features = [];
for (const [coll, meta] of Object.entries(COLLECTION_META)) {
  for (const f of C[coll]) {
    features.push({
      id: f.id, collection: coll, kind: meta.kind, name: f.name ?? null,
      sourceRef: `GOLD project.${coll}[] where id=${f.id}`,
      geometryKind: meta.geometry,
      geometryPreserved: true, coordinatePrecision: 'FULL_SOURCE_FLOAT',
      status: STATUS.SOURCE_AUTHORED,
      sourceConf: f.conf ?? null,
      chunkIds: null, // filled by the chunk builder
    });
  }
}
if (features.length !== 579) throw new Error(`FEATURE_COUNT_MISMATCH ${features.length}`);
const featureIds = new Set(features.map(f => f.id));
if (featureIds.size !== features.length) throw new Error('FEATURE_ID_COLLISION');

// ======================================================================
// 1. CROSSWALK: 12 source biomes -> 14 EconomyMap -> 20 Web terrain codes
// ======================================================================
const SOURCE_BIOMES = B.terrain.biomeLegend.map(x => ({ code: x.code, key: x.key, name: x.name, sourceColor: x.sourceColor, sourceRef: x.sourceRef }));
const ECONOMY_LABELS = ['water', 'sand', 'grass', 'meadow', 'forest', 'marsh', 'hill', 'snow', 'ash', 'toxic', 'road', 'floor', 'wall', 'lava'];
const WEB_T = [
  ['DEEP', 0], ['SHALLOW', 1], ['SAND', 2], ['GRASS', 3], ['MEADOW', 4], ['FOREST', 5], ['MARSH', 6],
  ['HILL', 7], ['CLIFF', 8], ['SNOW', 9], ['ASH', 10], ['TOXIC', 11], ['ROAD', 12], ['BRIDGE', 13],
  ['FLOOR', 14], ['PWALL', 15], ['LAVA', 16], ['BURNT', 17], ['ICE', 18], ['RIVER', 19],
].map(([name, code]) => ({ name, code }));
const BIOME_MAP = {
  0: { economy: 'meadow', web: 'MEADOW', webCode: 4, substrate: 2, soil: 2, vegetation: 2, climateGroup: 'TEMPERATE' },
  1: { economy: 'forest', web: 'FOREST', webCode: 5, substrate: 2, soil: 2, vegetation: 4, climateGroup: 'CANOPY' },
  2: { economy: 'forest', web: 'FOREST', webCode: 5, substrate: 2, soil: 2, vegetation: 5, climateGroup: 'ANCIENT_CANOPY' },
  3: { economy: 'forest', web: 'FOREST', webCode: 5, substrate: 2, soil: 2, vegetation: 4, climateGroup: 'CONIFER' },
  4: { economy: 'marsh', web: 'MARSH', webCode: 6, substrate: 8, soil: 3, vegetation: 3, climateGroup: 'WETLAND' },
  5: { economy: 'sand', web: 'SAND', webCode: 2, substrate: 1, soil: 1, vegetation: 0, climateGroup: 'ARID' },
  6: { economy: 'grass', web: 'GRASS', webCode: 3, substrate: 2, soil: 2, vegetation: 2, climateGroup: 'SCRUB' },
  7: { economy: 'hill', web: 'HILL', webCode: 7, substrate: 4, soil: 7, vegetation: 1, climateGroup: 'ROCK' },
  8: { economy: 'snow', web: 'SNOW', webCode: 9, substrate: 6, soil: 4, vegetation: 0, climateGroup: 'COLD' },
  9: { economy: 'ash', web: 'ASH', webCode: 10, substrate: 5, soil: 7, vegetation: 0, climateGroup: 'VOLCANIC' },
  10: { economy: 'toxic', web: 'TOXIC', webCode: 11, substrate: 7, soil: 6, vegetation: 0, climateGroup: 'TOXIC' },
  11: { economy: 'sand', web: 'SAND', webCode: 2, substrate: 1, soil: 5, vegetation: 0, climateGroup: 'LITTORAL' },
};
const OVERRIDES = [
  { id: 'OV-WATER-SEA', test: 'waterClass===1', economy: 'water', web: (i) => R.seaDistanceCells[i] >= 4 ? 'DEEP' : 'SHALLOW', reason: 'Authored sea mask; deep/shallow split from authored seaDistanceCells, NOT a depth measurement.' },
  { id: 'OV-WATER-LAKE', test: 'waterClass===2', economy: 'water', web: (i) => R.freshwater[i] ? 'SHALLOW' : 'RIVER', reason: 'Authored lake mask; freshwater flag decides shallow vs river colour, no depth claim.' },
  { id: 'OV-WATER-RIVER', test: 'waterClass===3', economy: 'water', web: 'RIVER', reason: 'Authored river centreline mask.' },
  { id: 'OV-ROAD', test: 'roadClass>0 && waterClass===0', economy: 'road', web: 'ROAD', reason: 'Authored road mask on dry land; width is NOT authored.' },
  { id: 'OV-BRIDGE', test: 'waterClass>0 && roadClass>0 && authoredBridgeAtCell', economy: 'road', web: 'BRIDGE', reason: 'Only cells carrying an authored bridge centre are BRIDGE; no land connection is invented.' },
  { id: 'OV-PWALL', test: 'M1 staticSolid footprint', economy: 'wall', web: 'PWALL', reason: 'LR02 clipped solid spans; applied by the consumer at runtime, not baked into the 8au raster.' },
  { id: 'OV-FLOOR', test: 'POI room floor footprint', economy: 'floor', web: 'FLOOR', reason: 'LR01 PROPOSED room floors; consumer override only.' },
  { id: 'OV-LAVA', test: 'volcanic biome && hazard authored', economy: 'lava', web: 'LAVA', reason: 'Hazard cell override; no damage rate supplied.' },
  { id: 'OV-ICE', test: 'snow biome && frozen surface', economy: 'snow', web: 'ICE', reason: 'Surface phase candidate, Gameplay owns realization.' },
];
const crosswalk = {
  schema: 'soh.wmp.crosswalks.v1', status: 'EXPLICIT_CROSSWALK__NO_SILENT_HEURISTIC',
  authority, sourceBiomeCount: SOURCE_BIOMES.length, economyLabelCount: ECONOMY_LABELS.length, webTerrainCodeCount: WEB_T.length,
  sourceBiomes: SOURCE_BIOMES, economyLabels: ECONOMY_LABELS, webTerrainCodes: WEB_T,
  biomeMap: Object.entries(BIOME_MAP).map(([code, m]) => ({ sourceBiomeCode: +code, sourceBiomeKey: SOURCE_BIOMES[+code].key, ...m, status: STATUS.PROPOSED, subtypePreserved: true, note: 'Original subtype ID is retained in rasters/biomeSubtype.u8; the 14-label and 20-code projections are LOSSY intentional crosswalks.' })),
  overrides: OVERRIDES.map(o => ({ id: o.id, test: o.test, economy: o.economy, web: typeof o.web === 'function' ? 'CELL_DEPENDENT' : o.web, reason: o.reason, status: STATUS.PROPOSED })),
  waterRoadBuildingOverrideTests: ['waterClass overrides biome', 'roadClass overrides biome on dry land only', 'bridge override requires authored bridge centre', 'wall/floor overrides are consumer-side, not baked into the 8au raster', 'building occupancy is GAMEPLAY_OWNED'],
  noClaims: ['NO approved au-to-tile scale', 'NO claim that the 200x200 Web window is the whole Veyra world', 'NO implied Gameplay Biome semantic equivalence'],
};
emit('layers/crosswalks.v1.json', crosswalk);

// ======================================================================
// 2. TERRAIN / SURFACE / SOIL — indexed u8 rasters + physical description
// ======================================================================
const surface = U8(), biomeSubtype = U8(), landform = U8(), substrate = U8(), soil = U8();
const construction = U8(), vegetation = U8(), cliff = U8(), terrace = U8();
const slopeClass = U8(), biomeTransition = U8(), exposure = U8(), shade = U8();
const drainage = U8(), fireFuel = U8(), firebreak = U8(), footprint = U8();
const floodplain = U8(), bank = U8(), channel = U8(), buildable = U8();
const climateRegion = U8(), tempPot = U8(), humidPot = U8(), rainPot = U8(), sunPot = U8();
const windPot = U8(), frostPot = U8(), soilMoistPot = U8(), evapPot = U8();
const fireProp = U8(), farming = U8();

// Authored bridge centres -> cells, used by the BRIDGE override only.
const bridgeCells = new Set(C.bridges.map(b => toCell(b.at[0], b.at[1])));
for (let i = 0; i < N; i++) {
  const wc = R.waterClass[i], biome = R.biomeCode[i], road = R.roadClass[i], slopeRaw = R.slope[i], elev = R.elevation[i];
  const seaD = R.seaDistanceCells[i], clearance = R.clearanceCells[i];
  const land = R.landId[i] > 0, coast = R.coast[i];
  biomeSubtype[i] = biome;
  const bm = BIOME_MAP[biome] ?? BIOME_MAP[0];

  // ---- surface / Web T code ----
  if (wc === 1) surface[i] = seaD >= 4 ? 0 : 1;                 // DEEP / SHALLOW
  else if (wc === 2) surface[i] = R.freshwater[i] ? 1 : 19;     // SHALLOW / RIVER
  else if (wc === 3) surface[i] = 19;                            // RIVER
  else if (bridgeCells.has(i) && road > 0) surface[i] = 13;     // BRIDGE (authored centre only)
  else if (road > 0) surface[i] = 12;                            // ROAD
  else surface[i] = bm.webCode;
  if (wc === 0 && slopeRaw > 200 && biome === 7) surface[i] = 8; // CLIFF candidate

  // ---- landform / substrate / soil ----
  if (wc > 0) { landform[i] = wc === 1 ? 1 : wc === 2 ? 6 : 7; substrate[i] = 0; soil[i] = 0; }
  else {
    landform[i] = coast ? 8 : (biome === 4 ? 5 : biome === 7 || biome === 10 ? 3 : (slopeRaw > 200 ? 4 : 2));
    substrate[i] = bm.substrate;
    soil[i] = bm.soil;
    if (biome === 11) soil[i] = 5; // saline littoral
  }
  cliff[i] = wc === 0 && slopeRaw > 200 ? 1 : 0;
  terrace[i] = wc === 0 && slopeRaw > 120 && slopeRaw <= 200 ? 1 : 0;
  slopeClass[i] = slopeRaw < 40 ? 0 : slopeRaw < 100 ? 1 : slopeRaw < 180 ? 2 : slopeRaw < 220 ? 3 : 4;
  const nb = cell4(i);
  biomeTransition[i] = nb.some(j => R.waterClass[j] === 0 && wc === 0 && R.biomeCode[j] !== biome) ? 1 : 0;

  // ---- construction / vegetation / exposure / drainage ----
  const protectedGeom = R.protectedGeometryCandidate[i] > 0 || R.elderGeometryId[i] > 0 || R.poiGeometryId[i] > 0;
  if (wc > 0 || protectedGeom) construction[i] = 0;
  else if (slopeClass[i] >= 3 || clearance === 0) construction[i] = 1;
  else if (R.buildableCandidate[i] > 0 && slopeClass[i] <= 1) construction[i] = 3;
  else construction[i] = 2;
  buildable[i] = construction[i] >= 2 && wc === 0 ? 1 : 0;
  vegetation[i] = bm.vegetation;
  exposure[i] = wc > 0 ? 3 : (coast ? 3 : (elev > 170 ? 3 : (biome === 1 || biome === 2 || biome === 3 ? 1 : 2)));
  shade[i] = (biome === 1 || biome === 2 || biome === 3) ? 2 : (slopeClass[i] >= 3 ? 1 : 0);
  drainage[i] = wc > 0 ? 3 : (biome === 4 ? 1 : (soil[i] === 4 || soil[i] === 7 ? 0 : 2));
  fireFuel[i] = wc > 0 ? 0 : (biome === 1 || biome === 2 || biome === 3 ? 3 : (biome === 6 || biome === 0 ? 2 : (biome === 8 || biome === 9 || biome === 10 ? 0 : 1)));
  firebreak[i] = wc > 0 ? 2 : (road > 0 ? 1 : 0);
  footprint[i] = wc > 0 ? 0 : (biome === 4 || biome === 11 || biome === 8 ? 3 : (biome === 0 || biome === 6 ? 2 : 1));

  // ---- hydrology derived masks ----
  bank[i] = wc === 0 && nb.some(j => R.waterClass[j] > 0) ? (nb.some(j => R.waterClass[j] === 1) ? 1 : nb.some(j => R.waterClass[j] === 2) ? 2 : 3) : 0;
  channel[i] = wc === 3 || R.riverId[i] > 0 ? 1 : 0;
  floodplain[i] = wc === 0 && nb.some(j => R.waterClass[j] > 0) && elev < 90 ? 1 : 0;

  // ---- climate potentials (categorical, NO numeric temperature/rate) ----
  const cg = bm.climateGroup;
  climateRegion[i] = Math.min(255, ({ TEMPERATE: 1, CANOPY: 2, ANCIENT_CANOPY: 3, CONIFER: 4, WETLAND: 5, ARID: 6, SCRUB: 7, ROCK: 8, COLD: 9, VOLCANIC: 10, TOXIC: 11, LITTORAL: 12 })[cg] * 10 + Math.min(9, slopeClass[i] * 2 + (wc > 0 ? 1 : 0)));
  tempPot[i] = cg === 'COLD' ? 0 : cg === 'VOLCANIC' ? 4 : (cg === 'ARID' ? 3 : (cg === 'CANOPY' || cg === 'ANCIENT_CANOPY' ? 1 : 2));
  humidPot[i] = wc > 0 ? 4 : (cg === 'WETLAND' ? 4 : (cg === 'CANOPY' || cg === 'ANCIENT_CANOPY' ? 3 : (cg === 'ARID' || cg === 'VOLCANIC' ? 0 : 2)));
  rainPot[i] = exposure[i] === 3 ? 3 : shade[i] === 2 ? 1 : 2;
  sunPot[i] = shade[i] === 2 ? 0 : (cg === 'ARID' ? 3 : 2);
  windPot[i] = coast || elev > 170 ? 3 : (shade[i] === 2 ? 1 : 2);
  frostPot[i] = cg === 'COLD' ? 3 : (elev > 190 ? 2 : (cg === 'CONIFER' ? 1 : 0));
  soilMoistPot[i] = wc > 0 ? 4 : (drainage[i] === 1 ? 3 : (drainage[i] === 0 ? 1 : 2));
  evapPot[i] = sunPot[i] === 3 ? 3 : (cg === 'WETLAND' ? 1 : 2);
  fireProp[i] = firebreak[i] === 2 ? 0 : (fireFuel[i] === 3 && windPot[i] === 3 ? 3 : (fireFuel[i] >= 2 ? 2 : 1));
  farming[i] = wc > 0 || protectedGeom ? 0 : (soil[i] === 2 && soilMoistPot[i] >= 2 && slopeClass[i] <= 1 ? 3 : (soil[i] === 2 ? 2 : 1));
}

const derivedRasters = [
  ['surface', surface, 'Web T terrain code (0..19) from explicit crosswalk + overrides', STATUS.PROPOSED],
  ['biomeSubtype', biomeSubtype, 'Verbatim 12-code source biome; preserves forest variants', STATUS.SOURCE_AUTHORED],
  ['landform', landform, '0 sea,1 coast,2 plain,3 hill,4 cliff,5 wetland,6 lake,7 river,8 beach', STATUS.PROPOSED],
  ['substrate', substrate, '0 water,1 sand,2 loam,3 clay,4 rock,5 ash,6 snow/ice,7 toxic sludge,8 peat', STATUS.PROPOSED],
  ['soil', soil, '0 none,1 dry sand,2 moist loam,3 waterlogged peat,4 frozen,5 saline,6 contaminated,7 regolith', STATUS.PROPOSED],
  ['construction', construction, '0 unsuited,1 marginal,2 suitable,3 preferred (geometry only)', STATUS.PROPOSED],
  ['vegetation', vegetation, '0 none,1 sparse,2 grass,3 wetland,4 forest,5 ancient forest', STATUS.PROPOSED],
  ['cliff', cliff, '1 = steep raw-slope candidate', STATUS.PROPOSED],
  ['terrace', terrace, '1 = intermediate raw-slope band', STATUS.PROPOSED],
  ['slopeClass', slopeClass, '0..4 ordinal classes over RAW slope byte, NOT proven degrees', STATUS.PROPOSED],
  ['biomeTransition', biomeTransition, '1 = 4-neighbour authored biome change on land', STATUS.DERIVED],
  ['exposure', exposure, '0..3 ordinal exposure (coast/altitude/canopy)', STATUS.PROPOSED],
  ['shade', shade, '0..2 canopy/shade potential', STATUS.PROPOSED],
  ['drainage', drainage, '0 poor,1 waterlogged,2 moderate,3 free water', STATUS.PROPOSED],
  ['fireFuel', fireFuel, '0..3 fuel load potential, NO damage rate', STATUS.PROPOSED],
  ['firebreak', firebreak, '0 none,1 road,2 water', STATUS.PROPOSED],
  ['footprint', footprint, '0 none,1 hard,2 loam,3 soft/wet/snow (trace retention potential)', STATUS.PROPOSED],
  ['floodplain', floodplain, '1 = low raw-elevation land adjacent to water', STATUS.PROPOSED],
  ['bank', bank, '0 none,1 sea bank,2 lake bank,3 river bank', STATUS.DERIVED],
  ['channel', channel, '1 = authored river centreline cell', STATUS.DERIVED],
  ['buildable', buildable, '1 = geometric build candidate (NOT occupancy/claim legality)', STATUS.PROPOSED],
  ['climateRegion', climateRegion, 'Climate-region index; decode via layers/climate.v1.json', STATUS.PROPOSED],
  ['temperaturePotential', tempPot, '0 cold .. 4 hot ORDINAL; NO temperature value', STATUS.PROPOSED],
  ['humidityPotential', humidPot, '0..4 ORDINAL; NO humidity value', STATUS.PROPOSED],
  ['rainExposure', rainPot, '0..3 ORDINAL', STATUS.PROPOSED],
  ['sunExposure', sunPot, '0..3 ORDINAL', STATUS.PROPOSED],
  ['windExposure', windPot, '0..3 ORDINAL', STATUS.PROPOSED],
  ['frostPotential', frostPot, '0..3 ORDINAL', STATUS.PROPOSED],
  ['soilMoisture', soilMoistPot, '0..4 ORDINAL; NO numeric moisture', STATUS.PROPOSED],
  ['evaporation', evapPot, '0..3 ORDINAL', STATUS.PROPOSED],
  ['firePropagation', fireProp, '0..3 ORDINAL; NO spread/damage rate', STATUS.PROPOSED],
  ['farmingAffordance', farming, '0..3 ORDINAL geographic suitability', STATUS.PROPOSED],
];
const derivedIndex = [];
for (const [name, arr, semantics, status] of derivedRasters) {
  const e = emitU8(`rasters/${name}.u8`, arr, { semantics, status });
  derivedIndex.push({ name, ...e, semantics, status, unit: name === 'biomeSubtype' ? 'SOURCE_CODE' : 'ORDINAL_CLASS', grid: { gw: GW, gh: GH, cellAu: CELL } });
}

const terrainLayer = {
  schema: 'soh.wmp.terrain.v1', status: 'PHYSICAL_TERRAIN_CANDIDATES__NOT_APPROVED_CANON', authority,
  frame: { authoring: FRAME_AU, unit: 'authoring_unit', grid: { gw: GW, gh: GH, cellAu: CELL }, transformStatus: 'UNDECIDED' },
  sourceRasters: srcMan.rasterLayers.filter(r => r.group === 'geo01').map(r => r.name),
  elevation: { sourceLayer: 'elevation', dtype: 'u8 RAW BYTE', unit: 'UNRESOLVED', metresProof: false, status: STATUS.UNRESOLVED, note: 'Existing source elevation values are raw bytes, NOT proven metres. No vertical scale is asserted.' },
  slope: { sourceLayer: 'slope', dtype: 'u8 RAW BYTE', unit: 'UNRESOLVED', status: STATUS.UNRESOLVED, note: 'Slope classes are ordinal over raw bytes, not degrees or climb rules.' },
  physicalDimensions: { landform: true, substrate: true, surface: true, soil: true, slopeClass: true, cliffs: true, terraces: true, constructionSuitability: true, vegetationAffordance: true, biomeTransitions: true },
  derivedRasters: derivedIndex,
  biomeLegend: SOURCE_BIOMES,
  constructionRule: 'Derived from authored landId/waterClass/protectedGeometryCandidate/elderGeometryId/poiGeometryId/clearanceCells/buildableCandidate and RAW slope. It is a GEOMETRIC candidate, never occupancy or claim legality.',
  noClaims: ['NO proven metres or degrees', 'NO official temperature/damage/weather/season rates', 'NO collision law', 'NO approved runtime scale'],
};
emit('layers/terrain.v1.json', terrainLayer);

// ======================================================================
// 3. HYDROLOGY — banks, channels, cross-sections, fords, shoreline, defects
// ======================================================================
const riverById = new Map(C.rivers.map(r => [r.id, r]));
const lakeById = new Map(C.lakes.map(l => [l.id, l]));
const bridgeCellList = [...bridgeCells];
function riverCrossSection(r) {
  const pts = r.points, samples = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    let cells = 0; const p = pts[k];
    for (let s = -10; s <= 10; s++) { const i = toCell(p[0] + nx * s * CELL, p[1] + ny * s * CELL); if (R.waterClass[i] === 3 || R.waterClass[i] === 2) cells++; }
    samples.push({ atAu: [r4(p[0]), r4(p[1])], waterCellsAcross: cells, measuredWetWidthAu: r4(cells * CELL), authoredStrokeWidthAu: r.width, physicalNavigableWidthStatus: STATUS.UNRESOLVED });
  }
  return { sampleCount: samples.length, maxMeasuredWetWidthAu: Math.max(...samples.map(s => s.measuredWetWidthAu)), minMeasuredWetWidthAu: Math.min(...samples.map(s => s.measuredWetWidthAu)), samples: samples.slice(0, 4), note: 'Perpendicular raster sampling at 8au resolution. Authored width is an EDITOR STROKE, not a physical channel width.' };
}
const waterBodies = [];
for (const l of C.lakes) waterBodies.push({ id: l.id, kind: 'LAKE', name: l.name, ringAu: l.ring, ringVertexCount: l.ring.length, areaAu2: r4(ringArea(l.ring)), perimeterAu: r4(ringPerimeter(l.ring)), centroidAu: ringCentroid(l.ring).map(r4), freshwater: true, status: STATUS.SOURCE_AUTHORED });
for (const r of C.rivers) waterBodies.push({
  id: r.id, kind: 'RIVER', name: r.name, polylineAu: r.points, pointCount: r.points.length,
  lengthAu: polylineLength(r.points), authoredStrokeWidthAu: r.width, widthUnit: 'EDITOR_STROKE_AU',
  physicalChannelWidth: { status: STATUS.UNRESOLVED, valueAu: null },
  direction: { source: r.source ?? null, mouth: r.mouth ?? null, status: r.source && r.mouth ? STATUS.SOURCE_AUTHORED : STATUS.UNRESOLVED },
  navFlags: r.nav ?? null, features: r.feats ?? [], crossSection: riverCrossSection(r), status: STATUS.SOURCE_AUTHORED,
});
const sea = { id: 'sea_veyra', kind: 'SEA', coastCells: [...Array(N).keys()].filter(i => R.coast[i] > 0).length, shoreline: C.land.map(l => ({ landId: l.id, ringCount: l.rings.length, outerVertexCount: l.rings[0].length, holeRingCount: l.rings.length - 1, perimeterAu: r4(ringPerimeter(l.rings[0])), areaAu2: r4(ringArea(l.rings[0])), status: STATUS.SOURCE_AUTHORED })), freshwater: false, status: STATUS.SOURCE_AUTHORED };

const fords = [];
for (let i = 0; i < N; i++) {
  if (!(R.waterClass[i] === 3 && R.roadClass[i] > 0)) continue;
  const nearBridge = bridgeCellList.some(c => Math.abs(gxOf(c) - gxOf(i)) <= 2 && Math.abs(gyOf(c) - gyOf(i)) <= 2);
  if (nearBridge) continue;
  fords.push({ cellIndex: i, atAu: centreAu(i).map(r4), depth: { status: STATUS.UNKNOWN, value: null }, fordable: { status: STATUS.UNKNOWN }, sourceRef: 'authored road centreline crossing authored river centreline without a bridge' });
}
const outletDefects = [];
for (const r of C.rivers) {
  const m = r.mouth;
  if (m && m.kind === 'lake' && !lakeById.has(m.ref)) outletDefects.push({ riverId: r.id, ref: m.ref, reason: 'MOUTH_REFERENCES_UNKNOWN_LAKE' });
}
// LR01 reported one authored outlet gap; preserve with exact source reference.
if (B.hydrography?.watershed) outletDefects.push({ id: 'OUTLET-01', sourceRef: 'LR01 geography.v1.json :: hydrography.watershed (embedded at data/legacy/source/)', reason: 'AUTHORED_OUTLET_GEOMETRY_GAP', status: STATUS.UNRESOLVED, owner: 'MAP' });

const crossingContradictions = [];
const br4 = C.bridges.find(b => b.id === 'br_4');
if (br4) {
  const i = toCell(br4.at[0], br4.at[1]);
  crossingContradictions.push({
    id: 'CC-BR4-01', bridgeId: 'br_4', atAu: br4.at.map(r4), cellIndex: i,
    measured: { clearanceCells: R.clearanceCells[i], waterClass: R.waterClass[i], roadClass: R.roadClass[i], elderGeometryId: R.elderGeometryId[i], riverId: R.riverId[i] },
    authoredRiverStrokeWidthAu: riverById.get('rv_silver')?.width ?? null,
    contradiction: 'Authored river stroke width (4) is an EDITOR value; the same cell has clearanceCells=0, waterClass=3 (river) and roadClass=1, inside Elder geometry el_aion. There is no authored physical channel width, deck bearing or swept cart clearance, so a cart-passable bridge cannot be derived.',
    status: STATUS.BLOCKED, owner: 'MAP+GAMEPLAY',
  });
}
for (const u of WA.transportTopology.unbridgedCrossings) crossingContradictions.push({ id: `CC-${u.roadId}-${u.riverId}`, ...u, contradiction: 'Road and river centrelines intersect but no authored bridge (or only a foot-load bridge) exists; physical width undefined.', status: STATUS.UNRESOLVED });

const hydrology = {
  schema: 'soh.wmp.hydrology.v1', status: 'PHYSICAL_HYDROLOGY_CANDIDATES__CONTRADICTIONS_NAMED', authority,
  frame: { authoring: FRAME_AU, unit: 'authoring_unit', grid: { gw: GW, gh: GH, cellAu: CELL } },
  waterClassLegend: { 0: 'LAND', 1: 'SEA', 2: 'LAKE', 3: 'RIVER' },
  sea, waterBodies,
  counts: { lakes: C.lakes.length, rivers: C.rivers.length, bankCells: bank.reduce((s, v) => s + (v ? 1 : 0), 0), channelCells: channel.reduce((s, v) => s + v, 0), floodplainCells: floodplain.reduce((s, v) => s + v, 0), fordCandidates: fords.length, shorelineRings: C.land.length },
  banks: { sea: bank.reduce((s, v) => s + (v === 1 ? 1 : 0), 0), lake: bank.reduce((s, v) => s + (v === 2 ? 1 : 0), 0), river: bank.reduce((s, v) => s + (v === 3 ? 1 : 0), 0), status: STATUS.DERIVED },
  fords: fords.slice(0, 40), fordsTruncated: Math.max(0, fords.length - 40),
  floodplainRaster: 'rasters/floodplain.u8', bankRaster: 'rasters/bank.u8', channelRaster: 'rasters/channel.u8',
  outletDefects, crossingContradictions,
  widthSemantics: { authoredStrokeUnit: 'editor stroke in abstract authoring units', physicalNavigableWidth: STATUS.UNRESOLVED, sweptClearance: STATUS.UNKNOWN, owner: 'MAP+GAMEPLAY' },
  noClaims: ['NO fabricated river, bridge or land connection', 'NO invented channel depth or flow rate', 'NO approved ferry/boat rule', 'NO cart-passability verdict'],
};
emit('layers/hydrology.v1.json', hydrology);

// ======================================================================
// 4. CLIMATE / ENVIRONMENT — static spatial potential, no rates
// ======================================================================
const REGION_NAMES = { 1: 'TEMPERATE', 2: 'CANOPY', 3: 'ANCIENT_CANOPY', 4: 'CONIFER', 5: 'WETLAND', 6: 'ARID', 7: 'SCRUB', 8: 'ROCK', 9: 'COLD', 10: 'VOLCANIC', 11: 'TOXIC', 12: 'LITTORAL' };
const regionCounts = new Map();
for (let i = 0; i < N; i++) { const g = Math.floor(climateRegion[i] / 10), k = Math.max(1, Math.min(12, g)); regionCounts.set(k, (regionCounts.get(k) ?? 0) + 1); }
const climateRegions = [...regionCounts.entries()].sort((a, b) => a[0] - b[0]).map(([g, cells]) => ({
  id: `clim.${REGION_NAMES[g].toLowerCase()}.v1`, key: REGION_NAMES[g], cellCount: cells,
  areaAu2: cells * CELL * CELL,
  temperaturePotential: STATUS.PROPOSED, humidityPotential: STATUS.PROPOSED,
  hot: g === 6 || g === 10 ? 'ELEVATED_POTENTIAL' : 'BASELINE', cold: g === 9 || g === 4 ? 'ELEVATED_POTENTIAL' : 'BASELINE',
  wetland: g === 5 ? 'ELEVATED_POTENTIAL' : 'BASELINE', snow: g === 9 ? 'ELEVATED_POTENTIAL' : 'BASELINE',
  toxic: g === 11 ? 'ELEVATED_POTENTIAL' : 'BASELINE', radiation: STATUS.UNKNOWN,
  numericValues: { temperatureCelsius: STATUS.UNKNOWN, damagePerSecond: STATUS.UNKNOWN, rainRate: STATUS.UNKNOWN, seasonalRate: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
  status: STATUS.PROPOSED,
}));
const climate = {
  schema: 'soh.wmp.climate.v1', status: 'STATIC_SPATIAL_POTENTIAL_ONLY__GAMEPLAY_OWNS_REALIZATION', authority,
  frame: { authoring: FRAME_AU, unit: 'authoring_unit', grid: { gw: GW, gh: GH, cellAu: CELL } },
  ownership: { map: ['terrain', 'height proxy', 'water', 'canopy', 'shade', 'drainage', 'exposure', 'spatial climate baseline'], gameplay: ['actual weather realization', 'thermal effects', 'seasons', 'survival consequences', 'timeline', 'all numeric rates'] },
  regionCount: climateRegions.length, climateRegions,
  environmentalProperties: ['temperaturePotential', 'humidityPotential', 'hot', 'cold', 'wetland', 'snow', 'toxic', 'radiation', 'rainExposure', 'sun', 'wind', 'frost', 'soilMoisture', 'evaporation', 'drainage', 'firePropagationPotential', 'naturalFirebreak', 'vegetationAffordance', 'farmingAffordance', 'footprintRetention'],
  derivedRasters: derivedIndex.filter(d => ['climateRegion', 'temperaturePotential', 'humidityPotential', 'rainExposure', 'sunExposure', 'windExposure', 'frostPotential', 'soilMoisture', 'evaporation', 'firePropagation', 'fireFuel', 'firebreak', 'farmingAffordance', 'footprint', 'drainage', 'shade', 'exposure'].includes(d.name)),
  explicitUnknowns: [
    { id: 'CL-U01', subject: 'official temperature values', status: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
    { id: 'CL-U02', subject: 'damage / weather / seasonal rates', status: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
    { id: 'CL-U03', subject: 'radiation numeric field', status: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
    { id: 'CL-U04', subject: 'water depth / flow rate', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY' },
    { id: 'CL-U05', subject: 'vertical elevation in metres', status: STATUS.UNRESOLVED, owner: 'JOINT' },
  ],
  noClaims: ['NO invented official temperature', 'NO invented damage/weather/season rates', 'NO claim that climate potential is a survival rule'],
};
emit('layers/climate.v1.json', climate);

// ======================================================================
// 5. RESOURCE ECOLOGY — geographic candidate opportunities only
// ======================================================================
function nearestRoad(at) {
  let best = null;
  for (const r of C.roads) { const n = nearestOnPolyline(at, r.points); if (!best || n.d < best.d) best = { roadId: r.id, kind: r.kind, ...n }; }
  return best;
}
function nearestDock(at) { let best = null; for (const d of C.docks) { const dd = dist(at, d.at); if (!best || dd < best.d) best = { dockId: d.id, atAu: d.at.map(r4), d: r4(dd) }; } return best; }
function nearestPoi(at) { let best = null; for (const p of C.pois) { const dd = dist(at, p.at); if (!best || dd < best.d) best = { poiId: p.id, arche: p.arche, d: r4(dd) }; } return best; }
function dryInteractionPoint(at) {
  let i = toCell(at[0], at[1]);
  if (R.waterClass[i] === 0 && R.landId[i] > 0) return { atAu: at.map(r4), cellIndex: i, adjusted: false };
  let best = null;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = gxOf(i) + dx, y = gyOf(i) + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
    const j = idx(x, y); if (R.waterClass[j] !== 0 || R.landId[j] <= 0) continue;
    const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { j, d };
  }
  return best ? { atAu: centreAu(best.j).map(r4), cellIndex: best.j, adjusted: true } : { atAu: null, cellIndex: null, adjusted: true, status: STATUS.BLOCKED };
}
const markerSites = C.resources.map((m, k) => {
  const at = m.at, cell = toCell(at[0], at[1]), road = nearestRoad(at), poi = nearestPoi(at), dock = nearestDock(at);
  const interaction = dryInteractionPoint(at);
  const siteClass = m.gate === 'none' ? 'NATURAL' : (m.kind === 'scrap' || m.kind === 'wreck' ? 'ROAD' : 'RARE');
  return {
    siteId: `wsc.habitat.${m.id}`, sourceRef: `GOLD project.resources[] where id=${m.id}`,
    kind: m.kind, siteClass, atAu: at.map(r4), radiusAu: m.r, sourceDensity: m.dens, sourceGate: m.gate,
    cellIndex: cell, interactionLocationAu: interaction.atAu, interactionCellIndex: interaction.cellIndex,
    interactionAdjusted: interaction.adjusted, interactionStatus: interaction.status ?? STATUS.DERIVED,
    physicalAccess: { nearestRoad: road, nearestPoi: poi, nearestDock: dock, routeRef: road ? `road:${road.roadId}` : null, chunkId: interaction.cellIndex !== null ? `chunk.${Math.floor(gxOf(interaction.cellIndex) / CHUNK_CELLS)}.${Math.floor(gyOf(interaction.cellIndex) / CHUNK_CELLS)}` : null },
    possibleActionTags: ['EXAMINE_SITE', 'PHYSICALLY_REACH', 'CARRY_FROM_SITE'],
    physicalHazardTags: [surface[cell] === 0 ? 'DEEP_WATER' : surface[cell] === 19 ? 'RIVER' : null, climateRegion[cell] >= 90 ? 'COLD_POTENTIAL' : null, R.elderGeometryId[cell] > 0 ? 'ELDER_GEOMETRY' : null].filter(Boolean),
    status: 'CANDIDATE_GEOMETRY__NO_STOCK_OR_LOOT',
  };
});
const roadsideSites = [];
for (const r of C.roads) {
  const L = polylineLength(r.points);
  const step = Math.max(1, Math.floor(L / 48));
  for (let s = step; s < r.points.length - 1; s += step) {
    const at = r.points[s], cell = toCell(at[0], at[1]);
    if (R.waterClass[cell] !== 0) continue;
    roadsideSites.push({ siteId: `wsc.roadside.${r.id}.${s}`, sourceRef: `GOLD project.roads[] where id=${r.id} :: vertex ${s}`, kind: 'roadside_salvage', siteClass: 'ROAD', atAu: at.map(r4), interactionLocationAu: centreAu(cell).map(r4), cellIndex: cell, routeRef: `road:${r.id}`, possibleActionTags: ['EXAMINE_SITE', 'PHYSICALLY_REACH'], status: 'PROPOSED_GEOMETRY__NO_LOOT_TABLE' });
  }
}
const industrialSites = C.zones.map(z => ({
  siteId: `wsc.zone.${z.id}`, sourceRef: `GOLD project.zones[] where id=${z.id}`, kind: 'zone_opportunity', siteClass: 'INDUSTRIAL',
  ringAu: z.ring, bboxAu: bbox(z.ring), atAu: ringCentroid(z.ring).map(r4), soil: z.soil, water: z.water, slope: z.slope, tags: z.tags,
  physicalAccess: { nearestRoad: nearestRoad(ringCentroid(z.ring)), nearestDock: nearestDock(ringCentroid(z.ring)) },
  possibleActionTags: ['EXAMINE_SITE', 'PHYSICALLY_REACH', 'HAUL_TO_SITE'], status: 'CANDIDATE_GEOMETRY__NO_STOCK_OR_LOOT',
}));
const poiSites = C.pois.map(p => {
  const l = layoutByPoi.get(p.id), at = p.at;
  return { siteId: `wsc.poi.${p.id}`, sourceRef: `GOLD project.pois[] where id=${p.id}`, kind: 'poi_opportunity', siteClass: p.elder ? 'RARE' : 'INDUSTRIAL', atAu: at.map(r4), footAu: p.foot, deepAu: p.deep ?? null, arche: p.arche, levels: l?.levels?.length ?? 0, physicalAccess: { nearestRoad: nearestRoad(at), nearestDock: nearestDock(at), nearestPoi: { poiId: p.id, d: 0 } }, possibleActionTags: ['EXAMINE_SITE', 'PHYSICALLY_REACH', 'RETREAT'], status: 'CANDIDATE_GEOMETRY__NO_STOCK_OR_LOOT' };
});
const rareSites = C.elders.map(e => ({ siteId: `wsc.elder.${e.id}`, sourceRef: `GOLD project.elders[] where id=${e.id}`, kind: 'endgame_opportunity', siteClass: 'RARE', elder: e.elder, outerAu: e.outer, coreAu: e.core, arenasAu: e.arenas, approachAu: e.approach, poiIds: e.pois, status: 'CANDIDATE_GEOMETRY__NO_STOCK_OR_LOOT' }));
const resources = {
  schema: 'soh.wmp.resources.v1', status: 'GEOGRAPHIC_CANDIDATE_OPPORTUNITIES_ONLY', authority,
  frame: { authoring: FRAME_AU, unit: 'authoring_unit', grid: { gw: GW, gh: GH, cellAu: CELL } },
  ownership: { map: ['candidate geometry', 'physical access/interaction location', 'identifiable route'], gameplay: ['loot tables', 'stocks', 'yield', 'drop probability', 'respawn', 'free starter grants', 'Core rewards'] },
  counts: { authoredHabitatMarkers: markerSites.length, roadsideCandidates: roadsideSites.length, industrialZones: industrialSites.length, poiOpportunities: poiSites.length, rareEndgame: rareSites.length, total: markerSites.length + roadsideSites.length + industrialSites.length + poiSites.length + rareSites.length },
  authoredHabitatMarkers: markerSites, roadsideCandidates: roadsideSites.slice(0, 250), roadsideTruncated: Math.max(0, roadsideSites.length - 250),
  industrialZones: industrialSites, poiOpportunities: poiSites, rareEndgame: rareSites,
  interactionContract: 'Every candidate has an interactionLocationAu on dry land (or an explicit BLOCKED status) and an identifiable routeRef. No item ID, stock, yield, drop, respawn or free grant is supplied.',
  noClaims: ['NO loot table', 'NO stock/yield/drop probability', 'NO respawn policy', 'NO starter grant', 'NO Core reward'],
};
emit('layers/resources.v1.json', resources);

// ======================================================================
// 6. TRANSPORT — roads, bridges, docks, clearance profiles, defects
// ======================================================================
const BODY_PROFILES = [
  { id: 'BODY-FOOT', widthAu: 2, heightAu: null, status: 'ASSUMPTION_PROFILE', owner: 'GAMEPLAY', note: 'Diagnostic foot proxy, NOT approved player body.' },
  { id: 'BODY-CART', widthAu: 8, heightAu: null, status: 'ASSUMPTION_PROFILE', owner: 'GAMEPLAY', note: 'Diagnostic single cart proxy, NOT approved vehicle.' },
  { id: 'BODY-LOADED-CART', widthAu: 16, heightAu: null, status: 'ASSUMPTION_PROFILE', owner: 'GAMEPLAY', note: 'Diagnostic loaded cart + trailer sweep proxy, NOT approved vehicle.' },
];
function roadCells(points) {
  const out = new Set();
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1], b = points[k], L = dist(a, b), steps = Math.max(1, Math.ceil(L / (CELL / 2)));
    for (let s = 0; s <= steps; s++) out.add(toCell(a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps));
  }
  return [...out];
}
function cornerAngles(points) {
  const out = [];
  for (let k = 1; k < points.length - 1; k++) {
    const a = points[k - 1], b = points[k], c = points[k + 1];
    const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
    const cos = l1 && l2 ? (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2) : 1;
    out.push(r4(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI));
  }
  return out;
}
function roadRecord(r) {
  const cells = roadCells(r.points);
  const clear = cells.map(i => R.clearanceCells[i]);
  const slopes = cells.map(i => R.slope[i]);
  const minClearAu = Math.min(...clear) * CELL, meanClearAu = r4(clear.reduce((s, v) => s + v, 0) / clear.length * CELL);
  const choke = cells.filter(i => R.clearanceCells[i] === 0);
  const angles = cornerAngles(r.points);
  const profiles = BODY_PROFILES.map(p => ({
    profileId: p.id, widthAu: p.widthAu,
    geometricFit: minClearAu >= p.widthAu ? 'GEOMETRIC_FIT_ONLY' : 'INSUFFICIENT_CENTRE_CLEARANCE',
    sweptClearance: STATUS.UNKNOWN, turningRadius: STATUS.UNKNOWN,
    bridgeDeckVerified: false, verdict: STATUS.UNKNOWN,
    reason: 'A centreline clearance comparison is NOT a swept clearance test; no bridge deck or vehicle turning envelope is verified.',
  }));
  return {
    id: r.id, name: r.name, kind: r.kind, purpose: r.purpose ?? null, pointsAu: r.points, vertexCount: r.points.length,
    lengthAu: polylineLength(r.points), bboxAu: bbox(r.points), cellCount: cells.length,
    minClearanceAu: minClearAu, meanClearanceAu: meanClearAu, chokeCellCount: choke.length,
    gradeRawMean: r4(slopes.reduce((s, v) => s + v, 0) / slopes.length), gradeRawMax: Math.max(...slopes),
    gradeUnit: 'RAW_BYTE__NOT_DEGREES', cornerAnglesDeg: angles.slice(0, 12), sharpestCornerDeg: angles.length ? Math.max(...angles) : null,
    turningAreaStatus: STATUS.UNKNOWN,
    approach: { start: nearestRoad(r.points[0]), end: nearestRoad(r.points[r.points.length - 1]), nearestDock: nearestDock(r.points[Math.floor(r.points.length / 2)]) },
    bodyProfiles: profiles,
    cartPassable: { value: false, status: STATUS.UNKNOWN, reason: 'No swept clearance, vehicle footprint, trailer sweep, bridge deck or grade limit is approved. Never true from a centreline connection.' },
    status: STATUS.DERIVED,
  };
}
const roadRecords = C.roads.map(roadRecord);
const bridgeRecords = C.bridges.map(b => {
  const i = toCell(b.at[0], b.at[1]);
  return {
    id: b.id, name: b.name, atAu: b.at.map(r4), angleRad: b.ang, authoredLoad: b.load, cellIndex: i,
    clearanceCellsAtCentre: R.clearanceCells[i], waterClassAtCentre: R.waterClass[i],
    elderGeometryIdAtCentre: R.elderGeometryId[i], deckPolygonAu: null, deckStatus: STATUS.UNRESOLVED,
    cartPassable: { value: false, status: STATUS.BLOCKED, reason: 'LR01/LR02 record cartPassable=false and deckStatus=UNRESOLVED; no swept clearance or bearing is authored.' },
    proposedGeometry: b.id === 'br_4' ? WA.bridgeApproach.proposedGeometry : null,
    status: STATUS.DERIVED,
  };
});
const dockRecords = C.docks.map(d => {
  const i = toCell(d.at[0], d.at[1]);
  return {
    id: d.id, name: d.name, atAu: d.at.map(r4), kind: d.kind, water: d.water, cellIndex: i,
    waterClassAtCentre: R.waterClass[i], nearestCartRoad: nearestRoad(d.at),
    loadingPositionAu: [r4(d.at[0] + CELL), r4(d.at[1])], loadingCellIndex: toCell(d.at[0] + CELL, d.at[1]),
    approachGeometryStatus: STATUS.PROPOSED, sweptClearance: STATUS.UNKNOWN,
    status: STATUS.DERIVED,
  };
});
const transport = {
  schema: 'soh.wmp.transport.v1', status: 'PARAMETERIZED_CLEARANCE_EVIDENCE__NO_CART_PASSABILITY_VERDICT', authority,
  frame: { authoring: FRAME_AU, unit: 'authoring_unit', grid: { gw: GW, gh: GH, cellAu: CELL } },
  bodyProfiles: BODY_PROFILES, roadCount: roadRecords.length, bridgeCount: bridgeRecords.length, dockCount: dockRecords.length,
  roads: roadRecords, bridges: bridgeRecords, docks: dockRecords,
  disconnectedRoads: WA.transportTopology.disconnectedRoads.map(d => ({ roadId: d.roadId, kind: d.kind, nearestDistanceAu: d.nearestOtherRoadEndpoint?.distanceAu ?? null, proposedConnection: d.proposedConnection.status, status: STATUS.DERIVED })),
  falseDisconnects: WA.transportTopology.falseDisconnects,
  falseJoinsFlagged: WA.transportTopology.falseJoinFlagged,
  unbridgedCrossings: WA.transportTopology.unbridgedCrossings,
  alternateRoutes: WA.transportTopology.alternateRoutes,
  graphSummary: { ...WA.transportTopology.graph, footComponentSizes: WA.transportTopology.graph.footComponentSizes, cartComponentSizes: WA.transportTopology.graph.cartComponentSizes },
  alternateRouteCandidates: [
    { id: 'ALT-FOOT-KILNS-B', kind: 'FOOT', sourceRef: 'LR02 world_architecture.v1.json kilnsAccess.alternatives ALT-B', status: STATUS.PROPOSED, canonical: false, note: 'rd_16 already reaches po_kilns at 0 au; keep foot/trail logistics, do NOT invent a cart road.' },
    { id: 'ALT-CART-KILNS-A', kind: 'CART_PROPOSED', sourceRef: 'LR02 world_architecture.v1.json kilnsAccess.alternatives ALT-A', polylineAu: WA.kilnsAccess.alternatives[0]?.polylineAu ?? null, lengthAu: WA.kilnsAccess.alternatives[0]?.lengthAu ?? null, status: STATUS.PROPOSED, canonical: false, note: 'Shortest dry-land centreline candidate, NOT an authored road and NOT a swept-clearance claim.' },
    ...WA.transportTopology.ferries.slice(0, 3).map(f => ({ id: `ALT-WATER-${f.roadId}`, kind: 'WATER_GEOMETRY_ONLY', sourceRef: 'LR02 transportTopology.ferries', polylineAu: null, lengthAu: f.lengthAu, status: STATUS.BLOCKED, canonical: false, note: f.note })),
  ],
  dockApproaches: { cartApproachWithin48Au: WA.dockApproaches.cartApproachWithin48Au, noCloseCartApproach: WA.dockApproaches.noCloseCartApproach, loadingAreas: WA.dockApproaches.loadingAreas?.length ?? null },
  kilnsAlternatives: WA.kilnsAccess.alternatives, kilnsDecision: WA.kilnsAccess.decision,
  ferries: WA.transportTopology.ferries,
  unresolved: [
    { id: 'TR-U01', subject: 'physical road width', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY' },
    { id: 'TR-U02', subject: 'physical river channel width', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY' },
    { id: 'TR-U03', subject: 'cart / loaded-cart swept clearance and trailer sweep', status: STATUS.UNKNOWN, owner: 'MAP+GAMEPLAY' },
    { id: 'TR-U04', subject: 'bridge deck bearing and span', status: STATUS.UNRESOLVED, owner: 'MAP+GAMEPLAY' },
    { id: 'TR-U05', subject: 'ferry/boat rule', status: STATUS.BLOCKED, owner: 'GAMEPLAY' },
    { id: 'TR-U06', subject: 'grade/climb limit', status: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
  ],
  noClaims: ['NO cartPassable=true', 'NO forced land bridge', 'NO approved vehicle dimension', 'NO approved ferry rule'],
};
emit('layers/transport.v1.json', transport);

// ======================================================================
// 7. ARCHITECTURE — 81 POIs, roofs, 18 vertical links, LOS, retreat
// ======================================================================
function polygonOverlapBBox(a, b) {
  const [ax0, ay0, ax1, ay1] = bbox(a), [bx0, by0, bx1, by1] = bbox(b);
  const x0 = Math.max(ax0, bx0), y0 = Math.max(ay0, by0), x1 = Math.min(ax1, bx1), y1 = Math.min(ay1, by1);
  return x1 > x0 && y1 > y0 ? [r4(x0), r4(y0), r4(x1), r4(y1)] : null;
}
const architectureRecords = [];
const verticalRecords = [];
const namedBlockers = [];
for (const l of LAYOUTS) {
  const pg = pgByPoi.get(l.poiId);
  if (!pg) throw new Error(`MISSING_M1_POI ${l.poiId}`);
  const rooms = l.rooms.map(rm => ({
    id: rm.id, levelId: rm.levelId, row: rm.row, col: rm.col, pattern: rm.pattern,
    enclosureClass: rm.enclosureClass, polygonAu: rm.polygonAu, centroidAu: rm.centroidAu, areaAu2: rm.areaAu2, bboxAu: rm.bboxAu,
    floor: { polygonAu: rm.floor?.polygonAu ?? null, status: rm.floor?.status ?? STATUS.UNRESOLVED },
    roofDescriptor: rm.roof ?? null,
  }));
  const roofs = [];
  for (const rm of rooms) {
    const ro = rm.roofDescriptor;
    if (!ro?.covered) continue;
    const f = Math.sqrt(Math.max(0, Math.min(1, ro.coverageFractionOfRoom ?? 1)));
    const c = ringCentroid(rm.polygonAu);
    roofs.push({
      id: `roof.${rm.id}`, parentRoomId: rm.id, parentPoiId: l.poiId, levelId: rm.levelId,
      polygonAu: scaleRingAbout(rm.polygonAu, c, f), coverageFractionOfRoom: ro.coverageFractionOfRoom,
      canopyOnly: !!ro.canopyOnly, occlusion: ro.canopyOnly ? 'PARTIAL_CANOPY' : 'FULL_ROOF_CANDIDATE',
      derivation: 'Source room polygon scaled about its centroid by sqrt(coverageFractionOfRoom); preserves exact source vertex order and shape. This is a PROPOSED physical roof CANDIDATE, not authored coverage and not a runtime canopy sprite.',
      status: STATUS.PROPOSED, owner: 'MAP',
    });
  }
  const openAir = l.enclosureClass === 'OPEN_AIR_YARD' || rooms.every(r => !r.roofDescriptor?.covered);
  // LOS from the exterior entrance to each ground room centroid against M1 solids.
  const entrance = pg.staticOpenings.find(o => o.kind === 'EXTERIOR_ENTRANCE') ?? pg.staticOpenings[0] ?? null;
  const los = [];
  if (entrance) {
    for (const rm of rooms.filter(r => !r.levelId.includes('deep'))) {
      let blocked = false;
      for (const s of pg.staticSolids) {
        if (segmentHitsWall(entrance.centreAu, rm.centroidAu, s.aAu, s.bAu, (s.thicknessAu ?? 2) / 2)) { blocked = true; break; }
      }
      los.push({ roomId: rm.id, fromAu: entrance.centreAu, toAu: rm.centroidAu, directLos: blocked ? 'BLOCKED_BY_STATIC_SOLID' : 'CLEAR', staticHoleAvailable: pg.staticOpenings.length > 0, status: STATUS.DERIVED });
    }
  }
  // Vertical links.
  for (const p of l.portals.filter(x => x.kind === 'VERTICAL_LINK')) {
    const from = rooms.find(r => r.id === p.fromRoomId), deepLevel = l.levels.find(x => x.index === -1);
    const deepPoly = deepLevel?.polygonAu ?? null;
    const overlap = from && deepPoly ? polygonOverlapBBox(from.polygonAu, deepPoly) : null;
    const atInsideFrom = from ? pointInRing(p.atAu, from.polygonAu) : false;
    const atInsideDeep = deepPoly ? pointInRing(p.atAu, deepPoly) : false;
    const rec = {
      id: p.id, poiId: l.poiId, fromRoomId: p.fromRoomId, toRoomId: p.toRoomId, atAu: p.atAu,
      sourceStatus: p.status, verticalSeparationAu: p.verticalSeparationAu, verticalSeparationStatus: p.verticalSeparationStatus,
      groundPolygonAu: from?.polygonAu ?? null, deepPolygonAu: deepPoly,
      atInsideGroundRoom: atInsideFrom, atInsideDeepLevel: atInsideDeep, overlapBBoxAu: overlap,
      deepRoom: l.rooms.find(r => r.id === p.toRoomId)?.polygonAu ?? null,
    };
    if (overlap && deepPoly) {
      const hx = Math.min(6, (overlap[2] - overlap[0]) / 2), hy = Math.min(6, (overlap[3] - overlap[1]) / 2);
      const cx = Math.max(overlap[0] + hx, Math.min(overlap[2] - hx, p.atAu[0]));
      const cy = Math.max(overlap[1] + hy, Math.min(overlap[3] - hy, p.atAu[1]));
      const geometry = {
        id: `vlink.${l.poiId}.proposed`, status: STATUS.PROPOSED, owner: 'MAP',
        shaftPolygonAu: [[r4(cx - hx), r4(cy - hy)], [r4(cx + hx), r4(cy - hy)], [r4(cx + hx), r4(cy + hy)], [r4(cx - hx), r4(cy + hy)]],
        stairRunAu: [[r4(cx), r4(cy)], ringCentroid(deepPoly).map(r4)],
        openingAu: { ground: [r4(cx - hx), r4(cy - hy), r4(cx + hx), r4(cy + hy)], deep: [r4(cx - hx), r4(cy - hy), r4(cx + hx), r4(cy + hy)] },
        verticalSeparationAu: null, verticalSeparationStatus: STATUS.UNRESOLVED,
        basis: 'Ground-room polygon and authored DEEP level polygon have a positive overlap bbox; a shaft/stair/opening CANDIDATE is placed inside that overlap. NO numeric floor height, stair pitch or vertical unit is invented.',
        gameplayMustProvide: ['vertical separation', 'stair/ladder collision', 'door/lock/power state', 'destruction'],
      };
      const conflicts = [];
      if (!atInsideFrom) conflicts.push({ code: 'SOURCE_VERTICAL_PORTAL_AT_OUTSIDE_GROUND_ROOM', detail: `portal ${p.id} atAu=[${p.atAu.join(', ')}] is NOT inside source ground room ${p.fromRoomId}; the proposed shaft is placed in the measured overlap instead, which is a DIFFERENT position than the source portal.` });
      if (!atInsideDeep) conflicts.push({ code: 'SOURCE_VERTICAL_PORTAL_AT_OUTSIDE_DEEP_LEVEL', detail: `portal ${p.id} atAu=[${p.atAu.join(', ')}] is NOT inside the authored DEEP level polygon.` });
      if (conflicts.length) {
        rec.verdict = 'NAMED_BLOCKER_WITH_PROPOSED_ALTERNATIVE';
        rec.resolution = { ...geometry, status: STATUS.PROPOSED, note: 'This is a NON-CANONICAL alternative inside the measured overlap. It does NOT repair the source portal position; Gameplay must not treat the source portal as validated.' };
        rec.conflicts = conflicts;
        namedBlockers.push({
          id: `blocker.${p.id}`, portalId: p.id, poiId: l.poiId, atAu: p.atAu,
          conflictCodes: conflicts.map(c => c.code), conflict: conflicts.map(c => c.detail).join(' '),
          groundRoomId: p.fromRoomId, groundRoomPolygonAu: from?.polygonAu ?? null, deepPolygonAu: deepPoly,
          measuredOverlapBBoxAu: overlap, proposedAlternativeShaft: rec.resolution.shaftPolygonAu,
          status: STATUS.BLOCKED, owner: 'MAP+GAMEPLAY',
          negativeTest: `NEG-VLINK-${l.poiId}`,
          resolutionPolicy: 'NO fabricated link at the source portal coordinate and NO hidden exception; the exact ID/coordinates/conflict are preserved.',
        });
      } else {
        rec.verdict = 'PROPOSED_PHYSICAL_LINK';
        rec.resolution = geometry;
      }
    } else {
      rec.verdict = 'NAMED_BLOCKER';
      rec.resolution = null;
      namedBlockers.push({ id: `blocker.${p.id}`, portalId: p.id, poiId: l.poiId, atAu: p.atAu, conflictCodes: ['NO_POSITIVE_OVERLAP_BBOX'], conflict: 'Ground room polygon and DEEP level polygon have NO positive overlap bbox (or a required polygon is missing); a shaft cannot be placed without contradicting authored geometry.', status: STATUS.BLOCKED, owner: 'MAP', negativeTest: `NEG-VLINK-${l.poiId}` });
    }
    verticalRecords.push(rec);
  }
  architectureRecords.push({
    poiId: l.poiId, name: l.name, arche: l.arche, atAu: l.atAu, footAu: l.footprint?.polygonAu ?? l.footprint ?? C.pois.find(p => p.id === l.poiId)?.foot ?? null,
    deepAu: C.pois.find(p => p.id === l.poiId)?.deep ?? null,
    enclosureClass: l.enclosureClass, openAirYard: openAir,
    levels: l.levels.map(x => ({ id: x.id, index: x.index, name: x.name, polygonAu: x.polygonAu, areaAu2: x.areaAu2, status: x.status })),
    roomCount: rooms.length, rooms,
    roofCoverage: pg.roofCoverage, roofPolygonCount: roofs.length, roofPolygons: roofs,
    staticSolids: pg.staticSolids.map(s => ({ id: s.id, aAu: s.aAu, bAu: s.bAu, thicknessAu: s.thicknessAu, blocksMovement: s.blocksMovement, blocksSight: s.blocksSight, status: s.status })),
    staticOpenings: pg.staticOpenings.map(o => ({ id: o.id, kind: o.kind, centreAu: o.centreAu, aAu: o.aAu, bAu: o.bAu, openingAu: o.openingAu, effectiveClearWidthAu: o.effectiveClearWidthAu, staticHole: o.staticHole, dynamicDoorOwner: o.dynamicDoorOwner, doorState: o.doorState })),
    idMapping: pg.idMapping, circulation: pg.circulation, retreat: l.retreat ?? pg.retreat ?? null,
    loadingAccess: { nearestRoad: nearestRoad(l.atAu), nearestDock: nearestDock(l.atAu), sweptClearance: STATUS.UNKNOWN },
    los, verdict: pg.verdict, exceptions: pg.exceptions,
    dynamicOwnership: { locks: 'GAMEPLAY', power: 'GAMEPLAY', hp: 'GAMEPLAY', ownership: 'GAMEPLAY', loot: 'GAMEPLAY', enemyPlacement: 'GAMEPLAY' },
    status: 'PHYSICAL_ARCHITECTURE_CANDIDATE',
  });
}
const architecture = {
  schema: 'soh.wmp.architecture.v1', status: 'ALL_81_POIS_ASSESSED__ROOFS_AND_VERTICAL_LINKS_PROPOSED_OR_NAMED_BLOCKERS', authority,
  frame: { authoring: FRAME_AU, unit: 'authoring_unit' },
  poiCount: architectureRecords.length, roomCount: architectureRecords.reduce((s, p) => s + p.roomCount, 0),
  coveredRoomCount: architectureRecords.reduce((s, p) => s + p.rooms.filter(r => r.roofDescriptor?.covered).length, 0),
  roofPolygonCount: architectureRecords.reduce((s, p) => s + p.roofPolygonCount, 0),
  openAirPoiCount: architectureRecords.filter(p => p.openAirYard).length,
  verticalLinkCount: verticalRecords.length,
  verticalProposedCount: verticalRecords.filter(v => v.verdict === 'PROPOSED_PHYSICAL_LINK').length,
  verticalNamedBlockerCount: namedBlockers.length,
  verticalNamedBlockers: namedBlockers,
  pois: architectureRecords, verticalLinks: verticalRecords,
  losRule: 'Direct segment from exterior entrance centre to each ground room centroid is tested against every M1 clipped solid span using a 1au sampled thick-segment intersection. BLOCKED_BY_STATIC_SOLID is a real occlusion result; it does NOT claim the room is unreachable through an opening.',
  roofRule: 'PROPOSED physical roof candidates are derived ONLY from source room polygons and source coverageFractionOfRoom. Open-air POIs stay open air. canopyOnly is preserved. No runtime canopy sprite or invented coverage.',
  verticalRule: 'A vertical case is PROPOSED_PHYSICAL_LINK only when the source portal atAu lies inside BOTH the source ground room and the authored DEEP level AND their polygons have a positive overlap. Where the source portal lies outside the ground room, the case is a NAMED_BLOCKER_WITH_PROPOSED_ALTERNATIVE: the exact ID/coordinates/conflict and a non-canonical alternative shaft in the measured overlap are preserved, but the source portal is NOT silently repaired. verticalSeparationAu remains null/UNRESOLVED in every case.',
  noClaims: ['NO invented vertical separation value', 'NO fabricated link where geometry conflicts', 'NO dynamic lock/power/HP/loot/enemy', 'NO creator visual approval'],
};
emit('layers/architecture.v1.json', architecture);

// ======================================================================
// 8. BUILD ENVELOPES / HABITATS / ENDGAME
// ======================================================================
function dryCellsInBBox(bb) {
  const x0 = Math.max(0, Math.floor(bb[0] / CELL)), y0 = Math.max(0, Math.floor(bb[1] / CELL));
  const x1 = Math.min(GW - 1, Math.floor(bb[2] / CELL)), y1 = Math.min(GH - 1, Math.floor(bb[3] / CELL));
  const dry = [], wet = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = idx(x, y); (R.waterClass[i] === 0 && R.landId[i] > 0 ? dry : wet).push(i); }
  return { dry, wet };
}
const buildEnvelopes = SE.buildSiteEnvelopes.map(e => {
  const { dry, wet } = dryCellsInBBox(e.physicalEnvelopeAu);
  return {
    siteId: e.siteId, parentZoneId: e.parentZoneId, sourceRef: e.sourceRef,
    physicalEnvelopeAu: e.physicalEnvelopeAu, footprintAreaAu2: e.footprintAreaAu2,
    derivedCellCount: e.derivedCellCount, dryCellIndices: dry, waterOverlapCellIndices: wet,
    dryCellCount: dry.length, waterOverlapCellCount: wet.length,
    geometricEnvelopeStatus: e.geometricEnvelopeStatus, waterOverlapResolved: wet.length === 0,
    roadFrontage: e.roadFrontage, slopeRawDeltaMean: e.slopeRawDeltaMean, elevationRawByteMean: e.elevationRawByteMean,
    minStaticClearanceAu: e.minStaticClearanceAu, sweptClearanceStatus: e.sweptClearanceStatus,
    nearestSourceRoutes: resources.authoredHabitatMarkers.filter(m => m.physicalAccess?.nearestRoad?.roadId === e.roadFrontage?.nearestCartRoadId).slice(0, 3).map(m => m.siteId),
    habitatPathIntersections: STATUS.UNKNOWN, traceSurface: e.biomeHistogram ? 'MIXED_SEE_BIOME_HISTOGRAM' : STATUS.UNKNOWN,
    retreatRoutes: { nearestRoad: nearestRoad([(e.physicalEnvelopeAu[0] + e.physicalEnvelopeAu[2]) / 2, (e.physicalEnvelopeAu[1] + e.physicalEnvelopeAu[3]) / 2]), status: STATUS.DERIVED },
    occupancyStatus: STATUS.UNKNOWN, claimLegalityStatus: 'GAMEPLAY_OWNED', ownerLegality: 'GAMEPLAY', placedStructure: null,
    status: 'GEOMETRIC_ENVELOPE_ONLY',
  };
});
const habitatRegions = [];
for (const [g, name] of Object.entries(REGION_NAMES)) {
  const cells = [...Array(N).keys()].filter(i => Math.floor(climateRegion[i] / 10) === +g);
  if (!cells.length) continue;
  const cx = cells.reduce((s, i) => s + gxOf(i), 0) / cells.length, cy = cells.reduce((s, i) => s + gyOf(i), 0) / cells.length;
  habitatRegions.push({
    id: `hab.${name.toLowerCase()}.v1`, biomeGroup: name, cellCount: cells.length, centroidAu: [r4(cx * CELL), r4(cy * CELL)],
    visibilityBarriers: [name === 'CANOPY' || name === 'ANCIENT_CANOPY' || name === 'CONIFER' ? 'CANOPY' : null, 'CLIFF', 'POI_STATIC_WALL'].filter(Boolean),
    footprintSensitiveSurfaces: ['SNOW', 'MARSH', 'BEACH', 'ASH', 'TOXIC'],
    roamingCorridors: WA.kilnsAccess.alternatives.map(a => ({ id: `corridor.${a.id}`, kind: a.id === 'ALT-A' ? 'CART_PROPOSED_NONCANONICAL' : 'FOOT', status: STATUS.PROPOSED, canonical: false })),
    elderTerritoryIds: C.elders.filter(e => pointInRing([cx * CELL, cy * CELL], e.outer)).map(e => e.id),
    spawnCounts: STATUS.UNKNOWN, raidPercentages: STATUS.UNKNOWN, aiBehaviour: 'GAMEPLAY_OWNED',
    status: STATUS.PROPOSED,
  });
}
const elderOuter = C.elders.map(e => ({ id: e.id, ring: e.outer }));
const nonbossSourceSites = architectureRecords.filter(p => p.levels.some(l => l.index === -1) && !elderOuter.some(e => pointInRing(p.atAu, e.ring))).slice(0, 12).map(p => ({ siteId: `wmp.nonboss.${p.poiId}`, poiId: p.poiId, atAu: p.atAu, elderGate: 'NONE', deepLevelIds: p.levels.filter(l => l.index === -1).map(l => l.id), physicalAccess: { nearestRoad: nearestRoad(p.atAu) }, cashItem: null, status: 'CANDIDATE_GEOMETRY__NO_CASH_OR_LOOT' }));
const vendorCandidates = roadRecords.filter(r => r.kind === 'cart').slice(0, 3).map((r, k) => ({ siteId: `wmp.vendor.${k + 1}`, roadId: r.id, atAu: r.pointsAu[Math.floor(r.pointsAu.length / 2)], nearestPoi: nearestPoi(r.pointsAu[Math.floor(r.pointsAu.length / 2)]), stock: null, price: null, status: 'PROPOSED_VENDOR_SITE_GEOMETRY__STOCK_AND_PRICE_GAMEPLAY_OWNED' }));
const homeCandidates = SE.candidateRegions.slice(0, 3).map((r, k) => {
  const dry = r.geometry.cellIndices.filter(i => R.waterClass[i] === 0 && R.landId[i] > 0);
  const anchor = dry.length ? centreAu(dry[0]).map(r4) : null;
  return { siteId: `wmp.home.${k + 1}`, candidateRegionId: r.candidateId, cellCount: r.geometry.cellCount, bboxAu: r.geometry.bboxAu, anchorAu: anchor, dryCellCount: dry.length, independentlySelectable: true, ownedHomeLegality: 'GAMEPLAY', escrowPlacementCandidate: { cells: r.geometry.cellIndices.slice(0, 4), status: 'GEOMETRY_ONLY' }, status: 'CANDIDATE_GEOMETRY__NO_HOUSE_OR_FREE_STRUCTURE' };
});
const evacuationCandidates = C.docks.filter(d => d.kind === 'coastal').slice(0, 4).map(d => {
  const dry = dryInteractionPoint(d.at);
  return { siteId: `wmp.evac.${d.id}`, dockId: d.id, atAu: d.at.map(r4), anchorAu: dry.atAu, anchorCellIndex: dry.cellIndex, independentOfElder: true, status: 'CANDIDATE_GEOMETRY__NO_TIMER_OR_RECEIPT' };
});
// Physical route candidates over the authored dry-land mask. Authored bridge
// centre cells are allowed ONLY as geometry candidates (deck unverified).
function bfsPath(from, to, avoidElder) {
  const s = toCell(from[0], from[1]), t = toCell(to[0], to[1]);
  const prev = new Int32Array(N).fill(-1), seen = new Uint8Array(N), q = new Int32Array(N);
  const pass = i => (R.waterClass[i] === 0 && R.landId[i] > 0 || bridgeCells.has(i)) && (!avoidElder || R.elderGeometryId[i] === 0);
  if (!from.every(Number.isFinite) || !to.every(Number.isFinite)) return { reachable: false, reason: 'MISSING_ANCHOR' };
  if (!pass(s) || !pass(t)) return { reachable: false, reason: 'ENDPOINT_NOT_WALKABLE' };
  let h = 0, tail = 0; q[tail++] = s; seen[s] = 1;
  while (h < tail) { const i = q[h++]; if (i === t) break; for (const j of cell4(i)) if (!seen[j] && pass(j)) { seen[j] = 1; prev[j] = i; q[tail++] = j; } }
  if (!seen[t]) return { reachable: false, reason: 'NO_PHYSICAL_LAND_PATH' };
  const path = []; for (let i = t; i !== -1; i = prev[i]) path.push(i); path.reverse();
  const bcells = path.filter(i => bridgeCells.has(i));
  return { reachable: true, cellCount: path.length, lengthAu: r4(path.length * CELL), elderGate: avoidElder ? 'NONE' : 'POSSIBLE_ELDER_GATE', bridgeGeometryCellsUsed: bcells.length, bridgeDeckStatus: bcells.length ? STATUS.UNRESOLVED : 'NOT_REQUIRED', sweptClearance: STATUS.UNKNOWN, status: bcells.length ? 'PHYSICAL_GEOMETRY_PATH_CANDIDATE__BRIDGE_DECK_UNVERIFIED' : 'PHYSICAL_GEOMETRY_PATH_CANDIDATE' };
}
// Search the authored candidate geometry for a fully connected nonboss
// source -> vendor -> home -> evacuation route with NO Elder gate.
const srcAnchor = s => dryInteractionPoint(s.atAu).atAu ?? s.atAu;
const venAnchor = v => dryInteractionPoint(v.atAu).atAu ?? v.atAu;
const routeCandidates = [];
outer:
for (const src of nonbossSourceSites) for (const ven of vendorCandidates) for (const home of homeCandidates) for (const evac of evacuationCandidates) {
  const a = srcAnchor(src), b = venAnchor(ven), c = home.anchorAu, d = evac.anchorAu;
  if (!a || !b || !c || !d) continue;
  const l1 = bfsPath(a, b, true), l2 = bfsPath(b, c, true), l3 = bfsPath(c, d, true);
  if (!l1.reachable || !l2.reachable || !l3.reachable) continue;
  routeCandidates.push({
    id: `route.nonboss.${src.poiId}.${ven.siteId}.${home.siteId}.${evac.dockId}.v1`,
    legs: [{ from: src.siteId, to: ven.siteId, ...l1 }, { from: ven.siteId, to: home.siteId, ...l2 }, { from: home.siteId, to: evac.siteId, ...l3 }],
    totalLengthAu: r4(l1.lengthAu + l2.lengthAu + l3.lengthAu), elderGate: 'NONE',
    sourceNonboss: true, economicFeasibility: 'GAMEPLAY_OWNED', stockAndCash: STATUS.UNKNOWN,
    status: 'PHYSICAL_ROUTE_CANDIDATES_ONLY__NO_CASH_OR_RECEIPT', owner: 'GAMEPLAY',
  });
  if (routeCandidates.length >= 2) break outer;
}
if (!routeCandidates.length) routeCandidates.push({ id: 'route.nonboss.UNRESOLVED', status: STATUS.BLOCKED, conflict: 'No fully connected dry-land geometry path exists among the preserved nonboss source, vendor, home and evacuation candidate anchors without an Elder gate.', owner: 'MAP+GAMEPLAY', negativeTest: 'NEG-ROUTE-NONBOSS' });
const envelopes = {
  schema: 'soh.wmp.build_habitat_endgame.v1', authority,
  status: 'GEOMETRIC_CANDIDATES_ONLY__NO_POPULATION_OR_ECONOMY',
  buildEnvelopes: { count: buildEnvelopes.length, waterOverlapResolvedCount: buildEnvelopes.filter(e => e.waterOverlapResolved).length, sites: buildEnvelopes, occupancy: STATUS.UNKNOWN, claims: 'GAMEPLAY_OWNED' },
  habitatRegions: { count: habitatRegions.length, regions: habitatRegions, spawnCounts: STATUS.UNKNOWN, raidPercentages: STATUS.UNKNOWN },
  endgame: { elderTerritories: C.elders.map(e => ({ id: e.id, elder: e.elder, outerAu: e.outer, outerVertexCount: e.outer.length, coreAu: e.core, arenaCount: e.arenas?.length ?? 0, approachAu: e.approach, distinctive: true })), nonbossSourceSites, vendorCandidates, homeCandidates, evacuationCandidates, routeCandidates },
  noClaims: ['NO loot/stock/price/cash/receipt', 'NO house/shelter/structure placement', 'NO spawn counts or raid percentages', 'NO escrow placement receipt', 'NO claim of survival/economy proof'],
};
emit('layers/build_habitat_endgame.v1.json', envelopes);

// ======================================================================
// 9. CHUNKS / SPATIAL INDEX / STABLE IDS
// ======================================================================
function chunksForBBox(bb) {
  const x0 = Math.max(0, Math.floor(bb[0] / CHUNK_AU)), y0 = Math.max(0, Math.floor(bb[1] / CHUNK_AU));
  const x1 = Math.min(CHUNKS_X - 1, Math.floor(bb[2] / CHUNK_AU)), y1 = Math.min(CHUNKS_Y - 1, Math.floor(bb[3] / CHUNK_AU));
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(`chunk.${x}.${y}`);
  return out;
}
const featurePoints = {
  land: f => f.rings.flat(), lakes: f => f.ring, rivers: f => f.points, roads: f => f.points,
  bridges: f => [f.at], docks: f => [f.at], pois: f => [...(f.foot ?? []), ...(f.deep ?? []), f.at],
  zones: f => f.ring, resources: f => [f.at], spawns: f => [f.at],
  elders: f => [...f.outer, ...(f.core ?? []), ...(f.arenas ?? []).flat(), ...(f.approach ?? [])], labels: f => [f.at],
};
for (const f of features) {
  const pts = featurePoints[f.collection](C[f.collection].find(x => x.id === f.id));
  f.bboxAu = bbox(pts.filter(Array.isArray));
  f.chunkIds = chunksForBBox(f.bboxAu);
}
const chunkRecords = [];
for (let cy = 0; cy < CHUNKS_Y; cy++) for (let cx = 0; cx < CHUNKS_X; cx++) {
  const id = `chunk.${cx}.${cy}`;
  const owners = features.filter(f => f.chunkIds.includes(id));
  chunkRecords.push({
    id, cx, cy, bboxAu: [cx * CHUNK_AU, cy * CHUNK_AU, Math.min(FRAME_AU[0], (cx + 1) * CHUNK_AU), Math.min(FRAME_AU[1], (cy + 1) * CHUNK_AU)],
    cellRange: { gx0: cx * CHUNK_CELLS, gy0: cy * CHUNK_CELLS, gx1: Math.min(GW, (cx + 1) * CHUNK_CELLS), gy1: Math.min(GH, (cy + 1) * CHUNK_CELLS) },
    neighbours: [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]].filter(([x, y]) => x >= 0 && y >= 0 && x < CHUNKS_X && y < CHUNKS_Y).map(([x, y]) => `chunk.${x}.${y}`),
    featureCount: owners.length, featureIds: owners.map(f => f.id),
    stableIdDigest: sha256(Buffer.from(owners.map(f => f.id).join('|'))),
    status: STATUS.DERIVED,
  });
}
const chunks = {
  schema: 'soh.wmp.chunks.v1', status: 'CONTINUOUS_FEATURE_IDS_ACROSS_CHUNK_BOUNDARIES', authority,
  frame: { authoring: FRAME_AU, chunkAu: CHUNK_AU, chunkCells: CHUNK_CELLS, chunksX: CHUNKS_X, chunksY: CHUNKS_Y, chunkCount: chunkRecords.length },
  featureIndex: { schema: 'soh.wmp.feature_index.v1', count: features.length, idCollisionCount: 0, features },
  chunks: chunkRecords,
  integrationContract: {
    id: 'soh.wmp.chunk_intake_contract.v1', status: 'PROPOSED__GAMEPLAY_INTAKE_NOT_IMPLEMENTED',
    consumer: 'GAMEPLAY', forbidden: ['modifying Gameplay runtime in this task', 'assuming the 200x200 Web window is the whole world'],
    requiredSteps: ['pin manifest.v1.json SHA-256', 'select a window (originAu, U, widthTiles, heightTiles)', 'call api/intake.mjs projectWindow()', 'apply water/road/wall/floor overrides from layers/crosswalks.v1.json', 'supply Gameplay-owned starts, occupancy, claims, hazards, weather, stock and persistence', 'validate with web/src/game/world-economy.ts validateEconomyMap and geography-contract.ts validateGeographicHandoff'],
    unknowns: ['approved U', 'runtime tile transform', 'streaming chunk size', 'cross-window transition policy'],
  },
  noClaims: ['NO runtime streaming implementation', 'NO claim that 200x200 Web window equals Veyra', 'NO Gameplay runtime file modified'],
};
emit('layers/chunks.v1.json', chunks);
emit('layers/feature_index.v1.json', { schema: 'soh.wmp.feature_index.v1', status: STATUS.SOURCE_AUTHORED, count: features.length, features });

// ======================================================================
// 10. SCALE PROFILES — at least three, U=1.6 / U=2.0 diagnostic only
// ======================================================================
const ROUTE_AU = 1180; // Greywater -> Hook representative straight-distance proxy, measured from authored bboxes
const gwPoi = C.pois.find(p => p.id === 'po_greywater');
const hookZone = C.zones.find(z => z.id === 'bz_hook');
const measuredRouteAu = gwPoi && hookZone ? r4(dist(gwPoi.at, ringCentroid(hookZone.ring))) : ROUTE_AU;
const scaleProfiles = [1.0, 1.6, 2.0, 2.5].map(U => {
  const worldTiles = [r4(FRAME_AU[0] / U), r4(FRAME_AU[1] / U)];
  const worldPx = [r4(worldTiles[0] * 16), r4(worldTiles[1] * 16)];
  const poiFootAu = gwPoi ? polylineLength([...gwPoi.foot, gwPoi.foot[0]]) : 39.1 * 4;
  const openingPx = r4(4 / U * 16), wallPx = r4(2 / U * 16), footPx = r4(16);
  const cameraAu = [40 * U, 22.5 * U], cameraTiles = [40, 22.5];
  const chunkTiles = 16, chunksForWorld = Math.ceil(worldTiles[0] / chunkTiles) * Math.ceil(worldTiles[1] / chunkTiles);
  const travelTiles = r4(measuredRouteAu / U);
  const roundTripDriftAu = r4(U / 2);
  const boundaryDriftAu = r4(FRAME_AU[0] - Math.floor(FRAME_AU[0] / U) * U);
  return {
    id: `scale.U${U.toFixed(1).replace('.', '')}`, unitsPerTileAu: U, tilePx: 16,
    worldTiles, worldPx, camera: { viewPx: [640, 360], viewTiles: cameraTiles, visibleAu: cameraAu, legibleOpeningPx: openingPx, legibleWallPx: wallPx, playerProxyPx: [8, 10] },
    poi: { footPerimeterAu: r4(poiFootAu), footPerimeterTiles: r4(poiFootAu / U), wallThicknessTiles: r4(2 / U), openingTiles: r4(4 / U), openingPx },
    bodies: BODY_PROFILES.map(p => ({ profileId: p.id, widthTiles: r4(p.widthAu / U), widthPx: r4(p.widthAu / U * 16), sweptClearance: STATUS.UNKNOWN })),
    terrain: { steepnessDegrees: STATUS.UNRESOLVED, climbRule: 'GAMEPLAY_OWNED', note: 'Raw slope bytes are not degrees.' },
    travel: { routeAu: measuredRouteAu, routeTiles: travelTiles, loadedVsUnloadedRatio: STATUS.UNKNOWN, haulCost: 'GAMEPLAY_OWNED' },
    streaming: { chunkTiles, chunkCountAtThisScale: chunksForWorld, bytesPerChunkRastersApprox: r4(chunkTiles * chunkTiles * 4), note: 'Approximate raster budget only; no runtime streaming implementation.' },
    coordinateRoundTrip: { maxDriftAu: roundTripDriftAu, worldRightBoundaryDriftAu: boundaryDriftAu, bottomBoundaryDriftAu: r4(FRAME_AU[1] - Math.floor(FRAME_AU[1] / U) * U), transform: 'cell-centre-v1' },
    diagnostic: U === 1.6 || U === 2.0, status: 'COMPARISON_PROFILE__NOT_APPROVED_CANON',
  };
});
const recommended = scaleProfiles.find(p => p.unitsPerTileAu === 2.0);
const scales = {
  schema: 'soh.wmp.scale_profiles.v1', status: 'COMPARISON_AND_CONDITIONAL_RECOMMENDATION__NOT_APPROVED_CANON', authority,
  evaluated: ['player and vehicle body geometry', 'doors, walls, roofs and interiors', 'steepness and climbable terrain', 'cart/loaded-cart clearance', 'world and POI dimensions', 'travel and hauling costs', '640x360 1x camera legibility', 'streaming/chunk memory', 'coordinate round trips and boundary drift'],
  measuredRouteAu, profiles: scaleProfiles,
  recommendation: {
    profileId: recommended.id, unitsPerTileAu: 2.0, status: 'RECOMMENDED_CONDITIONAL__NOT_APPROVED_CANON',
    evidence: `At U=2.0 the 4au effective opening is ${recommended.poi.openingPx}px and the 2au wall ${recommended.poi.wallPx}px at native 1x (integer-pixel friendly), the full 2000x1400 frame is ${recommended.worldTiles.join('x')} tiles, and the representative ${measuredRouteAu}au route is ${recommended.travel.routeTiles} tiles. U=1.6 gives a wider opening in px but ${scaleProfiles[1].worldTiles.join('x')} tiles and larger streaming budget; U=2.5 gives fewer tiles but a ${scaleProfiles[3].poi.openingPx}px opening.`,
    conditions: ['Gameplay confirms body/cart dimensions', 'swept clearance and turning radius measured', 'approved runtime transform', 'native 640x360 human legibility evidence', 'creator scale approval'],
    alternativesPreserved: scaleProfiles.filter(p => p.id !== recommended.id).map(p => p.id),
  },
  noClaims: ['NO approved canon scale', 'NO invented metres or km/minutes', 'NO approved cart dimension', 'NO playable Veyra'],
};
emit('layers/scales.v1.json', scales);

// ======================================================================
// 11. DECISION REGISTER
// ======================================================================
const decisions = {
  schema: 'soh.wmp.decision_register.v1', status: 'ONE_CONSOLIDATED_BATCH__NO_APPROVAL_REQUESTED_MID_RUN',
  authority,
  items: [
    { id: 'DR-01', subject: 'approved au-to-runtime-tile scale', alternatives: scaleProfiles.map(p => p.id), pending: scales.recommendation.profileId, owner: 'GAMEPLAY+CREATOR', status: STATUS.UNDECIDED },
    { id: 'DR-02', subject: 'physical river channel width unit and depth', alternatives: ['AUTHORED_EDITOR_STROKE_ONLY', 'MEASURED_RASTER_CROSS_SECTION'], pending: 'both preserved, neither canonical', owner: 'MAP+GAMEPLAY', status: STATUS.UNRESOLVED },
    { id: 'DR-03', subject: 'vertical separation / stair pitch between GROUND and DEEP levels', alternatives: ['UNRESOLVED_NUMERIC', 'PROPOSED_SHAFT_GEOMETRY_ONLY'], pending: 'PROPOSED_SHAFT_GEOMETRY_ONLY', owner: 'MAP+GAMEPLAY', status: STATUS.UNRESOLVED },
    { id: 'DR-04', subject: 'player / cart / loaded-cart body dimensions and swept clearance', alternatives: BODY_PROFILES.map(p => p.id), pending: 'all three preserved', owner: 'GAMEPLAY', status: STATUS.UNKNOWN },
    { id: 'DR-05', subject: 'bridge deck bearing / span / cart passability', alternatives: ['BR4_PROPOSED_DECK', 'UNRESOLVED'], pending: 'both preserved', owner: 'MAP+GAMEPLAY', status: STATUS.UNRESOLVED },
    { id: 'DR-06', subject: 'ferry/boat rule for 8 blocked ferries', alternatives: ['GEOMETRY_ONLY', 'BLOCKED'], pending: 'GEOMETRY_ONLY', owner: 'GAMEPLAY', status: STATUS.BLOCKED },
    { id: 'DR-07', subject: 'official temperature, damage, weather and seasonal rates', alternatives: ['CATEGORICAL_POTENTIAL_ONLY'], pending: 'CATEGORICAL_POTENTIAL_ONLY', owner: 'GAMEPLAY', status: STATUS.UNKNOWN },
    { id: 'DR-08', subject: 'roof/canopy occlusion semantics and runtime sprite', alternatives: ['PROPOSED_ROOF_POLYGON', 'CANOPY_ONLY', 'UNRESOLVED'], pending: 'PROPOSED_ROOF_POLYGON', owner: 'MAP+GAMEPLAY', status: STATUS.PROPOSED },
    { id: 'DR-09', subject: 'po_kilns access connector ALT-A vs ALT-B', alternatives: WA.kilnsAccess.alternatives.map(a => a.id ?? a.status), pending: WA.kilnsAccess.decision, owner: 'MAP+GAMEPLAY', status: STATUS.UNDECIDED },
    { id: 'DR-10', subject: 'resource stock / loot / yield / respawn / starter grant', alternatives: ['CANDIDATE_GEOMETRY_ONLY'], pending: 'CANDIDATE_GEOMETRY_ONLY', owner: 'GAMEPLAY', status: STATUS.UNKNOWN },
    { id: 'DR-11', subject: 'escrow price, seller stock, cash quantity, receipts', alternatives: ['GEOMETRY_ONLY'], pending: 'GEOMETRY_ONLY', owner: 'GAMEPLAY+CREATOR', status: STATUS.UNKNOWN },
    { id: 'DR-12', subject: 'chunk streaming, cross-window transition, duplicate-free source authority', alternatives: ['CHUNK_AWARE_CONTRACT_ONLY'], pending: 'CHUNK_AWARE_CONTRACT_ONLY', owner: 'GAMEPLAY', status: STATUS.UNKNOWN },
    { id: 'DR-13', subject: 'creator visual approval and native 640x360 human legibility', alternatives: ['TECHNICAL_VIEWS_ONLY'], pending: 'TECHNICAL_VIEWS_ONLY', owner: 'CREATOR', status: STATUS.UNKNOWN },
    { id: 'DR-14', subject: 'roofless stair-step wall rendering observed in Web Greywater', alternatives: ['M1_CLIPPED_SOLIDS', 'WEB_TILE_CENTRE_PROJECTION'], pending: 'both recorded', owner: 'GAMEPLAY', status: STATUS.UNKNOWN },
    { id: 'DR-15', subject: 'Veyra industrial Recycler POI requested by Gameplay M-CORE-03R / CT 6623791963', alternatives: ['DECLINE_PLACEMENT_THIS_ROUND', 'AUTHOR_NEW_POI_ONLY_ON_CREATOR_DISPATCH', 'SELECT_EXISTING_INDUSTRIAL_ZONE_AS_CANDIDATE_GEOMETRY_ONLY'], pending: 'DECLINE_PLACEMENT_THIS_ROUND; existing industrial ZONE/POI candidate geometry is provided without machine placement', owner: 'MAP+CREATOR+GAMEPLAY', status: STATUS.UNDECIDED, note: 'WMP-01 does not fabricate a Recycler, does not hand-place a Gameplay machine and does not claim reachable approach/clear LOS within 2.8 tiles for an unauthored site. The stable map revision, POI identity, footprint, collision, LOS, finite source reachability and route/risk validation would require a separate creator Map dispatch.' },
  ],
};
emit('layers/decision_register.v1.json', decisions);

// ======================================================================
// 12. MANIFEST — ONE authoritative manifest with full child digests
// ======================================================================
const sourceDigests = {
  goldSha256: srcMan.gold.sha256, goldCommit: srcMan.gold.commit, goldBytes: srcMan.gold.bytes,
  lr01BodyDigest: 'e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63',
  lr01PackageRawSha: 'b4cc77228caf847d1ad0d8a680457ca65731202513a047826e8bd973662e19ad',
  lr02M0Digest: 'db5bcc3dcf28210fa63e9a68cdf2128a7f76213bead7d1e975bbb901b50cfe1a',
  lr02V2Digest: V2.revisionDigest,
  lr02M1Digest: PG.revisionDigest, lr02M2Digest: SE.revisionDigest,
};
const body = {
  schema: 'soh.wmp.world_master_manifest.v1', version: 1, revision: 1,
  packageId: 'veyra-physical-world-master',
  status: 'SELF_CONTAINED_PHYSICAL_WORLD_MASTER_CANDIDATE__NOT_SEALED',
  authority, generatedBy: 'veyra-world-master/build.mjs',
  generatedAtUtc: 'DETERMINISTIC_BUILD_NO_WALLCLOCK',
  frame: { authoring: FRAME_AU, unit: 'authoring_unit', grid: { gw: GW, gh: GH, cellAu: CELL }, chunkAu: CHUNK_AU, chunksX: CHUNKS_X, chunksY: CHUNKS_Y },
  sourceIntegrity: {
    ...sourceDigests,
    migration: { tool: 'migration/migrate.mjs', sourceManifest: 'data/source_manifest.v1.json', sourceManifestSha256: sha256(readBuf('data/source_manifest.v1.json')), goldReadCount: 1 },
    note: 'GOLD was read ONCE by the migration tool. This manifest, all layers, readers, queries, views and tests are generated from data/ only.',
  },
  canonicalCounts: { ...srcMan.canonicalCounts, features: features.length, sourceBiomes: SOURCE_BIOMES.length, economyLabels: ECONOMY_LABELS.length, webTerrainCodes: WEB_T.length, geo01Rasters: 21, geo02Masks: 5 },
  layerCounts: {
    pois: architectureRecords.length, rooms: architecture.roomCount, roofPolygons: architecture.roofPolygonCount,
    openAirPois: architecture.openAirPoiCount, verticalLinks: verticalRecords.length,
    verticalProposed: architecture.verticalProposedCount, verticalNamedBlockers: namedBlockers.length,
    roads: roadRecords.length, bridges: bridgeRecords.length, docks: dockRecords.length,
    chunks: chunkRecords.length, buildEnvelopes: buildEnvelopes.length, habitatRegions: habitatRegions.length,
    resourceCandidates: resources.counts.total, scaleProfiles: scaleProfiles.length,
    derivedRasters: derivedIndex.length, fordCandidates: fords.length,
    crossingContradictions: crossingContradictions.length, outletDefects: outletDefects.length,
  },
  components: written,
  cleanRoom: { command: './clean-room.sh', forbidden: srcMan.prohibitedAfterMigration, noGold: true, noNetwork: true, noMapLab: true },
  reproduce: { command: './reproduce.sh', steps: ['node build.mjs', 'node tests/run.mjs', 'node tools/views.mjs'], deterministic: true },
  gates: { 'M-G0': 'tests/run.mjs', 'M-G1': 'clean-room.sh', 'M-G2': 'layers/terrain.v1.json + hydrology + climate', 'M-G3': 'layers/architecture.v1.json', 'M-G4': 'layers/chunks.v1.json + transport + build_habitat_endgame', 'M-G5': 'api/ + tests/ + docs/' },
  noClaims: ['NO WORLD_MASTER_SEALED', 'NO VEYRA_PLAYABLE', 'NO VISUAL_ACCEPTED', 'NO MERGE_READY', 'NO approved scale', 'NO Gameplay runtime modification'],
};
const revisionDigest = digest(body);
const manifestPath = path.join(MASTER, 'manifest.v1.json');
fs.writeFileSync(manifestPath, JSON.stringify({ ...body, revisionDigest, digestMethod: 'sha256 over JSON.stringify(body) in field insertion order' }, null, 2) + '\n');
console.log(`WMP_BUILD_OK layers=${written.filter(w => w.kind === 'layer').length} derivedRasters=${derivedIndex.length} features=${features.length} pois=${architectureRecords.length} roofs=${architecture.roofPolygonCount} vertical=${verticalRecords.length} proposed=${architecture.verticalProposedCount} blockers=${namedBlockers.length} chunks=${chunkRecords.length}`);
console.log(`  revisionDigest=${revisionDigest}`);
