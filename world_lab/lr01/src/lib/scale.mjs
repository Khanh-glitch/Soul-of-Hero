// MAP-LR01 Milestone A — CORRECTED per-POI geometry / scale tool.
// Defect fixed: SCALE-01A used the GLOBAL minimum POI edge (11 au) and a global
// area threshold for EVERY POI. Here each POI is measured with its OWN quad,
// its OWN edges, its OWN deep polygon, and is classified open-air vs enclosed.
// Fractional transforms are measured with explicit raster/tile coverage.
// No U is canonized. 200x200 / 1M-cell / chunk stride are TEMPORARY engine
// constants (Gameplay ACK 6608030530), NOT Veyra design laws.
import fs from 'node:fs';
import path from 'node:path';
import { quadOBB, ringArea, ringCentroid, ringEdges, bbox, r4, readJson, LAB } from './veyra.mjs';

export const CANDIDATE_U = Object.freeze([1, 1.25, 1.5, 1.6, 1.68, 1.75, 1.8, 2, 2.25, 2.5, 3, 4, 8]);
export const FOCUS_U = Object.freeze([1.68, 1.75, 1.8, 2, 2.25]);

export const OPEN_AIR_ARCHES = Object.freeze([
  'quarry', 'mine', 'grove', 'port', 'pier', 'elder_site', 'evac', 'ruins',
  'roadstop', 'village', 'hamlet', 'filter',
]);
export const ENCLOSED_ARCHES = Object.freeze([
  'research', 'observatory', 'facility', 'powerplant', 'warehouse', 'tomb',
  'gate', 'ragnarok_cache', 'chest_vendor', 'mill', 'smelter', 'sawmill',
]);

/** Enclosure class is DERIVED (not canonical) from explicit source fields. */
export function classifyEnclosure(poi) {
  const hasDeep = Array.isArray(poi.deep) && poi.deep.length >= 3;
  const signals = {
    depth: poi.depth ?? null, deepPolygon: hasDeep, gate: poi.gate ?? null,
    arche: poi.arche ?? null, retreatCount: (poi.retreat || []).length,
  };
  let enclosure, basis;
  if (poi.depth === 'multi' && hasDeep) { enclosure = 'ENCLOSED_MULTI_LAYER'; basis = 'depth=multi AND deep polygon present'; }
  else if (OPEN_AIR_ARCHES.includes(poi.arche)) { enclosure = 'OPEN_AIR_YARD'; basis = `arche=${poi.arche} in explicit open-air set; depth=${poi.depth}`; }
  else if (ENCLOSED_ARCHES.includes(poi.arche)) { enclosure = 'ENCLOSED_SINGLE'; basis = `arche=${poi.arche} in explicit enclosed set; depth=${poi.depth}`; }
  else { enclosure = 'UNRESOLVED'; basis = `arche=${poi.arche} not in either explicit set`; }
  return { enclosure, basis, signals, gated: (poi.gate || 'none') !== 'none', status: 'DERIVED_HEURISTIC__NOT_CANONICAL' };
}

/** Full per-POI geometry record using THIS POI's own polygon(s). */
export function poiGeometry(poi) {
  const foot = poi.foot || [], deep = Array.isArray(poi.deep) && poi.deep.length >= 3 ? poi.deep : null;
  const obb = quadOBB(foot);
  const edges = ringEdges(foot).map(r4);
  const deepObb = deep ? quadOBB(deep) : null;
  const cls = classifyEnclosure(poi);
  return {
    id: poi.id, name: poi.name, arche: poi.arche, at: poi.at,
    rot: poi.rot ?? null, scale: poi.scale ?? null,
    enclosure: cls.enclosure, enclosureBasis: cls.basis, enclosureSignals: cls.signals,
    gated: cls.gated, classificationStatus: cls.status,
    depth: poi.depth ?? null, gate: poi.gate ?? null,
    accessText: poi.access ?? null, retreatCount: (poi.retreat || []).length,
    links: poi.links || [], conf: poi.conf ?? null,
    foot: {
      vertexCount: foot.length, bboxAu: bbox(foot).map(r4),
      areaAu2: r4(ringArea(foot)), centroidAu: ringCentroid(foot).map(r4),
      edgesAu: edges, minEdgeAu: r4(Math.min(...edges)), maxEdgeAu: r4(Math.max(...edges)),
      obb,
    },
    deep: deep ? {
      vertexCount: deep.length, areaAu2: r4(ringArea(deep)), centroidAu: ringCentroid(deep).map(r4),
      edgesAu: ringEdges(deep).map(r4), minEdgeAu: r4(Math.min(...ringEdges(deep))),
      obb: deepObb,
    } : null,
    entrance: {
      authored: false, status: 'NOT_IN_SOURCE',
      note: 'Canonical Veyra POIs have NO authored door/entrance width. GEO-02 PROPOSED a 3.696 au west opening for po_kilns ONLY (non-canonical).',
      capacityUpperBoundAu: r4(Math.min(...edges)),
      capacityBasis: 'Upper bound only: an opening cannot be wider than this POI\'s own shortest foot edge. NOT an authored opening.',
    },
  };
}

/** Per-POI fit at one candidate U. Walls = 1 runtime tile (DOCUMENTED ASSUMPTION). */
export function poiFit(g, U) {
  const foot = g.foot, obb = foot.obb;
  const fw = obb.wAu / U, fh = obb.hAu / U;
  const iw = Math.max(0, Math.floor(fw) - 2), ih = Math.max(0, Math.floor(fh) - 2);
  const deep = g.deep?.obb;
  const dw = deep ? deep.wAu / U : 0, dh = deep ? deep.hAu / U : 0;
  const diw = deep ? Math.max(0, Math.floor(dw) - 2) : 0, dih = deep ? Math.max(0, Math.floor(dh) - 2) : 0;
  const fits = (w, h) => (w >= 5 && h >= 4) || (w >= 4 && h >= 5);
  const entranceOpenTiles = Math.floor(foot.minEdgeAu / U);
  const deepEntranceOpenTiles = g.deep ? Math.floor(g.deep.minEdgeAu / U) : null;
  const proposedEntranceOpenTiles = Math.floor(3.696 / U);
  const yardTiles = Math.floor(fw) * Math.floor(fh);
  const o = {
    id: g.id, arche: g.arche, enclosure: g.enclosure, U,
    footAreaTiles: r4(foot.areaAu2 / (U * U)),
    footTiles: [r4(fw), r4(fh)], footWholeTiles: [Math.floor(fw), Math.floor(fh)],
    interiorTilesAfter1TileWalls: [iw, ih],
    fitsRoom5x4: fits(iw, ih), fitsRoom5x5: iw >= 5 && ih >= 5,
    deepTiles: deep ? [r4(dw), r4(dh)] : null,
    deepInteriorTiles: deep ? [diw, dih] : null,
    deepFitsRoom5x4: deep ? fits(diw, dih) : null,
    entranceCapacityAu: foot.minEdgeAu,
    entranceOpenTiles, entranceCapacityStatus: 'UPPER_BOUND_ONLY__NO_AUTHORED_OPENING_IN_SOURCE',
    entranceFitsCart: entranceOpenTiles >= 1 && 1 >= 0.625,
    proposedEntranceOpenTiles, proposedEntranceAu: 3.696,
    proposedEntranceStatus: 'GEO-02 PROPOSED po_kilns west opening, NON-CANONICAL worked example',
    deepEntranceOpenTiles,
    yardTiles, yardFits3x3Envelope: yardTiles >= 9 && foot.minEdgeAu / U >= 3,
    minFeatureExtentAu: foot.minEdgeAu,
  };
  if (g.enclosure.startsWith('ENCLOSED')) {
    o.verdict = (o.fitsRoom5x4 && o.entranceOpenTiles >= 1) ? 'FIT' : 'FAIL';
    o.verdictBasis = 'enclosed POI needs a >=5x4 tile room after 1-tile walls and >=1 open entrance tile';
  } else if (g.enclosure === 'OPEN_AIR_YARD') {
    o.verdict = o.yardFits3x3Envelope ? 'FIT' : 'FAIL';
    o.verdictBasis = 'open-air POI is judged on usable yard/approach, NOT an enclosed room';
  } else {
    o.verdict = 'UNRESOLVED';
    o.verdictBasis = 'enclosure class unresolved; both room and yard metrics reported, no verdict';
  }
  return o;
}

/** Corrected aggregate — the SCALE-01A defect is reproduced here for contrast. */
export function aggregateFit(geoms, fits, U) {
  const enclosed = fits.filter(f => f.enclosure.startsWith('ENCLOSED'));
  const openAir = fits.filter(f => f.enclosure === 'OPEN_AIR_YARD');
  const unresolved = fits.filter(f => f.enclosure === 'UNRESOLVED');
  // SCALE-01A defect: global min edge applied to every POI + flat area threshold.
  const globalMinEdge = Math.min(...geoms.map(g => g.foot.minEdgeAu));
  const flawedAllFail = fits.filter(f => f.footAreaTiles < 20 || globalMinEdge / U < 4).length;
  return {
    U, poiCount: fits.length,
    enclosedCount: enclosed.length, enclosedWithRoom5x4: enclosed.filter(f => f.fitsRoom5x4).length,
    enclosedWithRoomAndEntrance: enclosed.filter(f => f.fitsRoom5x4 && f.entranceOpenTiles >= 1).length,
    enclosedFail: enclosed.filter(f => f.verdict === 'FAIL').length,
    openAirCount: openAir.length, openAirWithYard: openAir.filter(f => f.yardFits3x3Envelope).length,
    openAirFail: openAir.filter(f => f.verdict === 'FAIL').length,
    unresolvedCount: unresolved.length,
    entranceCapacityZeroOpenTiles: enclosed.filter(f => f.entranceOpenTiles === 0).length,
    entranceCapacityStatus: 'NOT an authored opening: canonical POIs have zero door dimensions; this is each POI\'s own shortest-edge UPPER BOUND.',
    proposedEntranceLostCount: fits.filter(f => f.proposedEntranceOpenTiles === 0).length,
    proposedEntranceStatus: '3.696 au GEO-02 PROPOSED po_kilns opening; NON-CANONICAL worked example only.',
    entranceZeroOpenTiles: enclosed.filter(f => f.entranceOpenTiles === 0).length,
    poiFeetUnableToHostSmallestRoom_CORRECTED: enclosed.filter(f => !f.fitsRoom5x4).length,
    scale01aDefectReproduction: {
      flawedRule: 'footAreaAu2/U^2 < 20 || GLOBAL_minEdgeAu/U < 4, applied to all 81 POIs',
      flawedFailCount: flawedAllFail,
      note: 'SCALE-01A reported 81/81 at U=4 and U=8 because it used the global 11 au minimum edge for every POI. The corrected count only considers ENCLOSED POIs and each POI\'s own quad.',
    },
  };
}

/** Explicit fractional-transform + raster coverage measurement. */
export function transformProfile(U) {
  const W = 2000 / U, H = 1400 / U;
  const floorW = Math.floor(W), ceilW = Math.ceil(W), floorH = Math.floor(H), ceilH = Math.ceil(H);
  const remW = W - floorW, remH = H - floorH;
  const exact = Math.abs(remW) < 1e-9 && Math.abs(remH) < 1e-9;
  const wholeAreaAu2 = floorW * U * floorH * U;
  const ceilAreaAu2 = ceilW * U * ceilH * U;
  const frameAreaAu2 = 2000 * 1400;
  // Source raster: 250x175 cells of 8 au. Count cells split by runtime tile boundaries.
  const gw = 250, gh = 175, cell = 8;
  const tileBoundaries = (extent, count) => {
    const bs = [];
    for (let k = 1; k < count; k++) { const b = k * U; if (b > 0 && b < extent) bs.push(b); }
    return bs;
  };
  const bx = tileBoundaries(2000, ceilW), by = tileBoundaries(1400, ceilH);
  // A boundary coincident with an 8 au source-cell edge is an EXACT alignment,
  // not a split. Epsilon guards binary float error (e.g. 5 * 1.6 = 8.000000000000002).
  const EPS = 1e-6;
  const alignedToSourceEdge = b => Math.abs(b - Math.round(b / cell) * cell) < EPS;
  const splitX = new Set(), splitY = new Set();
  for (const b of bx) { if (alignedToSourceEdge(b)) continue; const g = Math.floor(b / cell); if (b > g * cell + EPS && b < (g + 1) * cell - EPS) splitX.add(g); }
  for (const b of by) { if (alignedToSourceEdge(b)) continue; const g = Math.floor(b / cell); if (b > g * cell + EPS && b < (g + 1) * cell - EPS) splitY.add(g); }
  const sourceCellsSplit2D = (() => {
    const set = new Set();
    for (const gx of splitX) for (let gy = 0; gy < gh; gy++) set.add(`${gx},${gy}`);
    for (const gy of splitY) for (let gx = 0; gx < gw; gx++) set.add(`${gx},${gy}`);
    return set.size;
  })();
  const tileStraddle = (() => {
    const set = new Set();
    for (let m = 1; m < gw; m++) { const b = m * cell; if (b >= 2000) break; const k = Math.floor(b / U + EPS); if (b > k * U + EPS && b < (k + 1) * U - EPS) set.add(`x${k}`); }
    for (let m = 1; m < gh; m++) { const b = m * cell; if (b >= 1400) break; const k = Math.floor(b / U + EPS); if (b > k * U + EPS && b < (k + 1) * U - EPS) set.add(`y${k}`); }
    return set.size;
  })();
  const tilesPerSourceCell = cell / U;
  const exactRasterAlignment = Math.abs(tilesPerSourceCell - Math.round(tilesPerSourceCell)) < 1e-9;
  return {
    U, unit: 'authoring_units_per_runtime_tile', exactIntegerDims: exact,
    worldTilesExact: [r4(W), r4(H)], floorTiles: [floorW, floorH], ceilTiles: [ceilW, ceilH],
    remainderTiles: [r4(remW), r4(remH)],
    fractionalEdge: !exact,
    coverage: {
      frameAu2: frameAreaAu2,
      wholeTileAreaAu2: r4(wholeAreaAu2), wholeTileCoverageFraction: r4(wholeAreaAu2 / frameAreaAu2),
      ceilTileAreaAu2: r4(ceilAreaAu2), ceilOverhangFraction: r4((ceilAreaAu2 - frameAreaAu2) / frameAreaAu2),
      unrepresentedAu2WithFloor: r4(frameAreaAu2 - wholeAreaAu2),
      partialEdgeTileCount: ceilW * ceilH - floorW * floorH,
      transformModes: exact ? ['EXACT_1:1_TILE_GRID'] : ['FLOOR_DROPS_PARTIAL_EDGE_STRIP', 'CEIL_PADS_BEYOND_FRAME', 'NONUNIFORM_RESAMPLE_REQUIRED'],
      note: 'For fractional U the last runtime row/column is partial. Any runtime intake must choose one documented mode; none is approved.',
    },
    raster: {
      sourceGrid: { gw, gh, cellAu: cell, cells: gw * gh },
      tilesPerSourceCellAxis: r4(tilesPerSourceCell), exactRasterAlignment,
      sourceCellsWithTileBoundaryInsideX: splitX.size,
      sourceCellsWithTileBoundaryInsideY: splitY.size,
      sourceCellsWithTileBoundaryInside2D: sourceCellsSplit2D,
      sourceCellsWithTileBoundaryInsideMeaning: 'Upsampling count: a tile boundary inside an 8 au source cell. When 8/U is an INTEGER the clip is exact and costs no resampling.',
      fractionalSourceCellsRequiringResampling: exactRasterAlignment ? 0 : gw * gh,
      runtimeTileColumnsRowsStraddlingSourceCellBoundary: tileStraddle,
      runtimeTileStraddleMeaning: 'A source-cell EDGE falling strictly inside a runtime tile. This is the explicit fractional-coverage cost and is ZERO when 8/U is an integer.',
      sourceCellsExactlyAligned: exactRasterAlignment ? gw * gh : 0,
      note: 'Fractional U needs a documented FLOOR/CEIL/NONUNIFORM mode for partial edge tiles AND a resampling rule for 8 au source cells cut mid-tile.',
    },
  };
}

const FEATURES = [
  { id: 'road_display_stroke_other', au: 1.6, source: 'geo02 maplab_encoding.widthSemantics.roads.displayStrokesAu.other' },
  { id: 'river_authored_width_min', au: 2.5, source: 'canon rivers[].width min' },
  { id: 'road_display_stroke_cart', au: 3.4, source: 'geo02 maplab_encoding.widthSemantics.roads.displayStrokesAu.cart' },
  { id: 'proposed_po_kilns_west_opening', au: 3.696, source: 'geo02 poi_po_kilns.proposed.v1.json PROPOSED' },
  { id: 'bridge_display_glyph_short_axis', au: 7.2, source: 'geo02 widthSemantics.roads.bridgeDisplayGlyphAu.h' },
  { id: 'source_raster_cell', au: 8, source: 'canon terrain.cell' },
  { id: 'road_analysis_stroke', au: 9, source: 'geo02 widthSemantics.roads.analysisStrokeAu' },
  { id: 'river_mask_min_stroke', au: 9, source: 'geo02 widthSemantics.rivers.maskStrokeAu' },
  { id: 'bridge_display_glyph_long_axis', au: 13, source: 'geo02 widthSemantics.roads.bridgeDisplayGlyphAu.w' },
  { id: 'po_kilns_cart_road_gap', au: 56.8792, source: 'geo02 corridor_audit nearest cart road rd_n' },
];

export function featureQuantization(U) {
  const rows = FEATURES.map(f => ({ ...f, tiles: r4(f.au / U), openTiles: Math.floor(f.au / U), lostAtThisU: Math.floor(f.au / U) === 0 }));
  return { U, features: rows, lostCount: rows.filter(r => r.lostAtThisU).length, note: 'Editor strokes / display glyphs are NOT authored physical widths. lostAtThisU means the feature quantizes to ZERO whole runtime tiles.' };
}

/** Source-linked modelled travel from SCALE-01A + fractional-U interpolation by formula. */
export function travelAt(U, scale01a) {
  const j = scale01a.benchmark.journeys.find(x => x.id === 'corridor.RT-1');
  const bal = scale01a.sources.constants.balance;
  const speedAuPerSec = bal.player.speed * U / 16;
  const w = bal.cart.weightPenaltyPer100, cw = bal.cart.maxWeight;
  const wp = Math.max(0.25, 1 - cw / 100 * w);
  const f = x => x === null ? null : r4(x);
  return {
    U, speedAuPerSec: r4(speedAuPerSec),
    basis: 'PR44 balance.player.speed=72 px/s; k=16/U px per authoring unit; 1 game hour=3600 real s',
    rt1: {
      straightAu: j.straightAu, routeAu: j.routeAu, effectiveFootAu: j.effectiveFootAu, effectiveCartAu: j.effectiveCartAu,
      straightLineTheoreticalSeconds: f(j.straightAu / speedAuPerSec),
      geographicRouteSeconds: f(j.effectiveFootAu / speedAuPerSec),
      loadedCartScenarioSeconds: f(j.effectiveCartAu / (speedAuPerSec * wp)),
      cartStatus: 'MODELLED_SCENARIO_ON_FOOT_ROUTE__NOT_CART_PASSABLE',
    },
    crossWorldWidthSeconds: f(2000 / speedAuPerSec),
    crossWorldFractionOfFictionalDay: f(2000 / speedAuPerSec / (bal.dayNight.dayLengthMinutes * 60)),
    uncertainty: 'Times are modelled from pinned movement constants; they are NOT native-input measured times. Physical clearance, trail cart-passability, ferry rules and exposure are UNRESOLVED.',
  };
}

/** Lower-bound memory model (assumption-heavy, explicitly labelled). */
export function memoryAt(U) {
  const ceilW = Math.ceil(2000 / U), ceilH = Math.ceil(1400 / U);
  const cells = ceilW * ceilH;
  const worldTyped = 6 * cells, blockGrid = cells, economy = 13 * cells * 8, sourceV3 = cells * 8, pkg = 4 * cells * 8;
  const total = worldTyped + blockGrid + economy + sourceV3 + pkg;
  const chunkCols = Math.ceil(ceilW / 16), chunkRows = Math.ceil(ceilH / 16);
  return {
    cells, worldTypedArraysBytes: worldTyped, blockGridBytes: blockGrid,
    economyNumericArraysBytes: economy, sourceV3Bytes: sourceV3, packageArraysBytes: pkg,
    totalBytesLowerBound: total, totalMBLowerBound: r4(total / 1048576),
    renderChunkCacheUpperBoundMB: r4(chunkCols * chunkRows * 256 * 256 * 4 / 1048576),
    compileEconomyNeighbourhoodChecksWorstCase: cells * 49,
    model: 'LOWER-BOUND MODEL, NOT MEASURED. Assumes 1-byte typed arrays for World/BlockGrid and 8-byte slots for JS arrays. Chunk key stride 100 and 1M-cell cap are TEMPORARY engine constants, not design limits.',
  };
}

export function loadScale01a() {
  const base = path.join(LAB, 'scale01a/output');
  const benchmark = readJson(path.join(base, 'benchmark.v1.json'));
  const sources = readJson(path.join(base, 'gameplay_sources.v1.json'));
  const metrics = readJson(path.join(base, 'metrics.v1.json'));
  return { benchmark, sources, metrics };
}
