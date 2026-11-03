#!/usr/bin/env node
// MAP-GEO-01 milestone A: reproducible derived geography export.
// The canonical .sohmap.json is READ ONLY. Every authored id / coordinate is
// copied verbatim into `objects`; every derived number is additive.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadSource, CANON } from './lib/source.mjs';
import { buildLayers, LAYER_SEMANTICS } from './lib/raster.mjs';
import { buildRouteGraph } from './lib/routegraph.mjs';
import {
  landTopology, waterConnectivity, transportTopology, zoneAccess,
  poiSpatial, elderTerritories, resourceSuitability, confidenceRegister, spawnRegions,
} from './lib/topology.mjs';
import { parseArgs, ensureOut, writeJson, DEFAULT_OUT } from './lib/cli.mjs';

const TOOL = { name: 'MAP-GEO-01', tool: 'world_lab/geo01/src/export.mjs', schema: 'soh.map.geography.v1', version: 1 };
const sha = b => createHash('sha256').update(b).digest('hex');

function histogram(u8) {
  const h = new Map(); for (const v of u8) h.set(v, (h.get(v) || 0) + 1);
  return Object.fromEntries([...h.entries()].sort((a, b) => a[0] - b[0]));
}
function stats(u8) {
  let mn = Infinity, mx = -Infinity, sum = 0, nonzero = 0;
  for (const v of u8) { mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; if (v) nonzero++; }
  return { count: u8.length, min: mn, max: mx, mean: +(sum / u8.length).toFixed(4), nonzero, zero: u8.length - nonzero, distinct: new Set(u8).size };
}

export function buildExport(source) {
  const P = source.project;
  const { grid, layers } = buildLayers(P);
  const graph = buildRouteGraph(P, { joinToleranceAu: 8 });

  const verbatim = {};
  for (const k of ['land', 'lakes', 'rivers', 'roads', 'bridges', 'docks', 'pois', 'zones', 'resources', 'spawns', 'elders', 'labels']) {
    verbatim[k] = JSON.parse(JSON.stringify(P[k]));
  }

  const biomeCodes = [...new Set(layers.biomeCode)].sort((a, b) => a - b).map(code => {
    let count = 0, e0 = 0, eMin = Infinity, eMax = -Infinity, eSum = 0;
    for (let i = 0; i < layers.biomeCode.length; i++) if (layers.biomeCode[i] === code) {
      count++; const e = layers.elevation[i];
      if (e === 0) e0++; else { eMin = Math.min(eMin, e); eMax = Math.max(eMax, e); eSum += e; }
    }
    return {
      code, count, elevationZeroCells: e0,
      elevationMin: eMin === Infinity ? null : eMin,
      elevationMax: eMax === -Infinity ? null : eMax,
      elevationMean: e0 === count ? null : +(eSum / (count - e0)).toFixed(4),
      semantics: 'UNKNOWN — no biome legend is committed in the Veyra source',
      status: 'RAW_SOURCE_CODE',
    };
  });

  // Landmask agreement: elevation>0 vs authored land polygons (a factual check,
  // not a reinterpretation of the elevation byte).
  let agree = 0, landCells = 0, elevPosOutside = 0, landWithZero = 0;
  for (let i = 0; i < layers.landId.length; i++) {
    const isLand = layers.landId[i] !== 0, isPos = layers.elevation[i] > 0;
    if (isLand) landCells++;
    if (isLand === isPos) agree++;
    if (!isLand && isPos) elevPosOutside++;
    if (isLand && !isPos) landWithZero++;
  }

  const doc = {
    schema: TOOL.schema,
    generatedBy: TOOL,
    canonicalSource: {
      ...source.fingerprint,
      derivedDataOnly: true,
      statement: 'This file is reproducible DERIVED data. The original .sohmap.json at the pinned commit remains the canonical world source; this export is not a competing world source.',
    },
    authority: {
      rule: 'MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.',
      mapOwns: ['terrain', 'biome geometry', 'elevation', 'slope geometry', 'water/coast geometry', 'road/bridge/dock/ferry topology', 'buildable region geometry', 'POI spatial shells', 'Elder territory geometry', 'resource suitability areas', 'source ids', 'confidence flags'],
      gameplayOwns: ['harvestable instances', 'stock/yield/respawn/depletion', 'tree/rock/monster selection and density', 'loot/cash/powered doors/generators', 'locked conditions', 'economy', 'ambient audio events', 'survival rules', 'boss behaviour', 'hazard intensity', 'travel-time measurement'],
      jointlyValidated: ['walkable under a Gameplay slope rule', 'buildable under A0 protection/collision/occupancy', 'cargo passable under loaded-cart rules', 'POI entrances/rooms/sockets against archetype contracts'],
      note: 'No gameplay law, loot table, stock, price, door state, boss mapping or climate value was invented.',
    },
    frame: {
      authoring: { w: P.world.w, h: P.world.h, unit: 'authoring_unit', source: 'project.world' },
      grid: { ...grid, toCell: 'gx=floor(x/cell), gy=floor(y/cell); i=gy*gw+gx', cellCentre: '[(gx+0.5)*cell,(gy+0.5)*cell]' },
      transform: {
        status: 'UNDECIDED',
        mode: 'NONE_APPLIED',
        configurable: true,
        config: { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, authoringUnitsPerCell: P.terrain.cell },
        runtimeReference: { source: 'PR #44 a956c9e web/src/game/core.ts', WW: 200, WH: 200, TILE: 16, requiredCells: 40000 },
        sourceGridCells: grid.cells,
        rule: 'Every coordinate in this export remains in Veyra authoring units. No rescale, crop, pad or warp to the 200x200 runtime island was performed. toCell() is the ONLY coordinate conversion used and it is a deterministic index lookup, not a world-scale decision.',
        requiredDecision: 'An explicit, approved authoring-unit -> runtime-tile transform with measured journey times (t_foot, t_cart_loaded, exposure_time).',
      },
    },
    terrainEncoding: {
      container: 'base64', compression: 'NONE', element: 'uint8', count: grid.cells,
      seed: P.terrain.seed, gw: P.terrain.gw, gh: P.terrain.gh, cell: P.terrain.cell,
      elevBase64Length: P.terrain.elev.length, biomeBase64Length: P.terrain.biome.length,
      elevDecodedBytes: layers.elevation.length, biomeDecodedBytes: layers.biomeCode.length,
      canonicalBase64Roundtrip: true,
      elevation: { rawLayer: 'elevation', unit: 'UNKNOWN_SOURCE_BYTE', stats: stats(layers.elevation), zeroSemantics: 'sea/no-land (verified against land polygons)', physicalScale: 'UNDEFINED' },
      biome: { rawLayer: 'biomeCode', unit: 'RAW_SOURCE_CODE', stats: stats(layers.biomeCode), legendStatus: 'NOT_COMMITTED_IN_SOURCE', codes: biomeCodes },
      slope: { rawLayer: 'slope', unit: 'RAW_BYTE_DELTA_PER_GRID_CELL', stats: stats(layers.slope), normalization: 'UNDEFINED (Gameplay threshold not supplied)' },
      landmaskAgreement: { cells: layers.landId.length, agreement: agree, agreementRatio: +(agree / layers.landId.length).toFixed(6), landCells, elevationPositiveOutsideLand: elevPosOutside, landCellsWithZeroElevation: landWithZero, note: 'Factual cross-check of the raw elevation byte against authored land polygons; not a semantic reinterpretation.' },
    },
    layers: {
      manifest: 'rasters/manifest.v1.json',
      count: Object.keys(layers).length,
      names: Object.keys(layers).sort(),
      dtype: 'uint8', grid: grid,
      semantics: LAYER_SEMANTICS,
      allLayersAreDerivedOrVerbatimDecodes: true,
    },
    objects: verbatim,
    confidence: confidenceRegister(P),
    climate: {
      status: 'UNDEFINED_IN_SOURCE',
      moisture: { value: null, status: 'UNKNOWN', reason: 'Veyra has no climate/moisture array. PR44 EconomyMap requires finite 0..1 per cell; supplying one would be fabrication.' },
      temperature: { value: null, status: 'UNKNOWN', reason: 'Veyra has no temperature array.' },
      hazardIntensity: { value: null, status: 'UNKNOWN', reason: 'Hazard intensity is a Gameplay rule.' },
      spatialPotentialOnly: [
        { layer: 'freshwaterProximityCells', meaning: 'BFS cell distance to authored lake/river geometry', note: 'geometric potential, NOT a moisture value' },
        { layer: 'seaDistanceCells', meaning: 'BFS cell distance to sea', note: 'geometric exposure potential, NOT a climate value' },
        { layer: 'elevation', meaning: 'raw source elevation byte', note: 'no physical unit established' },
        { layer: 'slope', meaning: 'raw byte gradient', note: 'no physical grade established' },
      ],
    },
    physicalClassification: {
      walkable: { layer: 'walkableCandidate', status: 'DERIVED_CANDIDATE', basis: 'land polygon minus authored lake/river geometry', excludes: 'slope threshold, collision, hazard, dynamic occupancy (Gameplay)' },
      blocked: { layer: 'waterClass', status: 'DERIVED_CANDIDATE', basis: 'sea / lake polygon / river centreline', note: 'River width unit unestablished; only centreline cells are blocked.' },
      constrained: { layer: 'slope', status: 'RAW_GRADIENT_ONLY', note: 'No passable slope threshold supplied.' },
      buildable: { layer: 'buildableCandidate', status: 'DERIVED_CANDIDATE', basis: 'walkableCandidate ∩ zones[].ring', note: 'A0 legality NOT asserted.' },
      protected: { layer: 'protectedGeometryCandidate', status: 'GEOMETRY_OVERLAP_ONLY', note: 'NOT the A0 protected mask.' },
      cargoAccess: { layer: 'cargoCandidate', status: 'SPATIAL_CANDIDATE_ONLY', cargoPassable: 'UNDEFINED', reason: 'loaded-cart slope/width/bridge-span rules are Gameplay-owned' },
      crossings: { layer: 'crossingCandidate', status: 'AUTHORED_POSITIONS_ONLY', channelFitVerified: false },
      clearance: { layer: 'clearanceCells', status: 'DERIVED', unit: 'grid cells (x8 = authoring units)' },
      transitions: { status: 'DERIVABLE', note: 'Biome-code / land / water neighbour changes are computable from the supplied layers; no authored material transition atlas exists in Veyra.' },
    },
    topology: {
      land: landTopology(P, layers, grid),
      water: waterConnectivity(P, layers, grid),
      transport: transportTopology(P, graph),
      zones: zoneAccess(P, layers, grid),
      pois: poiSpatial(P, layers, grid),
      elders: elderTerritories(P),
      resources: resourceSuitability(P, layers, grid),
      spawns: spawnRegions(P, layers, grid),
    },
    unknowns: [
      'Semantic legend for biome codes 0..11 (no legend committed in source).',
      'Physical unit and vertical scale of the elevation byte.',
      'Physical unit of rivers[].width and roads width/slope limits.',
      'Climate: moisture, temperature, season, weather and hazard intensity.',
      'Loaded-cart capability, bridge span fit, ferry/boat boarding and portage rules.',
      'POI rooms, door openings, interior circulation, functional placement sockets.',
      'A0 protected mask, build legality, occupancy and dynamic state.',
      'World-scale transform from 2000x1400 authoring units to runtime tiles.',
      'Creator visual approval and any native Godot/Web runtime intake.',
    ],
    integration: {
      status: 'EXPORT_ONLY_NO_RUNTIME_INTAKE',
      runtimeIntakeBlockedBy: [
        'PR44 validateRuntimeMapPackage requires exactly 200x200 cells of TILE=16; Veyra source grid is 250x175 at cell=8 authoring units.',
        'EconomyMap.biome requires one of 14 Gameplay Biome strings; Veyra supplies 12 raw codes with no committed legend.',
        'EconomyMap.moisture / temperature require finite 0..1 values; Veyra defines no climate.',
        'GeographicHandoff requires rooms, doors, power nodes, loot sites, cash/vendor/evac sites and criticalPaths; those are Gameplay-owned and not in Veyra.',
        'validateGeographicHandoff runs compileEconomy + diagnoseStarts, i.e. Gameplay population, which Map must not perform.',
      ],
      contractDeltaFile: 'CONTRACT_DELTA.md / contract_boundary.v1.json',
    },
  };
  return { doc, grid, layers, graph };
}

function main() {
  const args = parseArgs();
  const out = ensureOut(args.out ? path.resolve(args.out) : DEFAULT_OUT);
  const source = loadSource({ sourcePath: args.source || null });
  const { doc, grid, layers } = buildExport(source);

  const manifest = { schema: 'soh.map.rasters.v1', grid, canonicalSourceSha256: source.fingerprint.sha256, layers: [] };
  for (const name of Object.keys(layers).sort()) {
    const buf = Buffer.from(layers[name]);
    const file = `rasters/${name}.u8`;
    fs.writeFileSync(path.join(out, file), buf);
    manifest.layers.push({
      name, file, bytes: buf.length, sha256: sha(buf), dtype: 'uint8',
      histogram: (name === 'elevation' || name === 'biomeCode') ? histogram(layers[name]) : undefined,
      semantics: LAYER_SEMANTICS[name] || null,
    });
  }
  writeJson(path.join(out, 'rasters', 'manifest.v1.json'), manifest);
  writeJson(path.join(out, 'geography.v1.json'), doc);
  const geoPath = path.join(out, 'geography.v1.json');
  console.log(`GEO_OK source=${source.fingerprint.sha256.slice(0, 16)} cells=${grid.cells} layers=${Object.keys(layers).length} objects=${Object.values(doc.objects).reduce((s, a) => s + a.length, 0)}`);
  console.log(`  ${path.relative(process.cwd(), geoPath)} ${fs.statSync(geoPath).size} bytes sha=${sha(fs.readFileSync(geoPath)).slice(0, 16)}`);
  console.log(`  rasters/manifest.v1.json ${manifest.layers.length} layers`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
