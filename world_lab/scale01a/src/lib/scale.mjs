// MAP-SCALE-01A — diagnostic scale candidates. NOT approved world sizes.
// U = Veyra authoring units per ONE runtime tile. TILE stays 16 px (PR44 core.ts).
// Every number is derived from measured source features + pinned runtime code.
import { seaDistanceCoverage } from './geo.mjs';

export const CANDIDATES = Object.freeze([1, 2, 4, 8]);

const r4 = v => +v.toFixed(4);

export function buildCandidates(C, F, M, bends, network) {
  const { TILE, WW, WH, VIEW_W, VIEW_H, runtimeCells, HOUR_MS } = C.runtime;
  const bal = C.balance;
  const baseTilesPerSec = bal.player.speed / TILE;              // 72 px/s / 16 px = 4.5 tiles/s
  const minRoomTiles = C.minBuilding.w * C.minBuilding.h;        // smallest authored runtime building (5x4)
  const minRoomSide = Math.min(C.minBuilding.w, C.minBuilding.h);
  const playerDiameterTiles = (2 * C.movementEvidence.collisionRadiiPx.player) / TILE;
  const cartDiameterTiles = (2 * C.movementEvidence.collisionRadiiPx.cart) / TILE;
  const roadStrokeAu = F.road.analysisStrokeAu;                 // 9 au, EDITOR analysis stroke
  const riverMaskAu = F.river.maskStrokeAu;                     // 9 au min mask
  const bridgeAu = F.bridge.displayGlyphAu;                     // 13 x 7.2 au DISPLAY glyph
  const entranceAu = F.proposedEntranceWestAu;                  // 3.696 au PROPOSED, non-canonical
  const workspaceAu2 = (F.proposedWorkingSpaces[0] || {}).areaAu2 ?? null;

  const out = [];
  for (const u of CANDIDATES) {
    const W = F.authoringSpace[0] / u, H = F.authoringSpace[1] / u;
    const cells = W * H;
    const worldPx = [W * TILE, H * TILE];
    const pxPerAu = TILE / u;
    const speedAuPerSec = r4(baseTilesPerSec * u);
    const chunkCols = Math.ceil(W / C.chunk.CH), chunkRows = Math.ceil(H / C.chunk.CH);
    const chunkKeyCollisionFree = chunkCols <= C.chunk.keyStride;
    const sea = seaDistanceCoverage(M, u, C.seaDistBfsStopTiles + 1);

    const memory = {
      model: 'LOWER-BOUND MODEL, NOT MEASURED RUNTIME MEMORY. Assumes 1-byte typed arrays for World/BlockGrid, 8-byte JS number slots for EconomyMap/package arrays and sourceV3; strings are counted as one reference each. No streaming/LOD implementation exists in PR44 HEAD.',
      worldTypedArrays: 6 * cells,
      blockGrid: cells,
      economyNumericArrays: C.economyLimit.arrayCount * cells * 8,
      sourceV3: cells * 8,
      packageArrays: 4 * cells * 8,
      renderChunkCacheUpperBoundBytes: chunkCols * chunkRows * C.chunk.canvasPxPerChunk[0] * C.chunk.canvasPxPerChunk[1] * 4,
      compileEconomyNeighbourhoodChecksWorstCase: cells * 49,
      mapDigestArrayValuesAtLeast: cells * (C.economyLimit.arrayCount + 4 + 6),
      totalBytesLowerBound: null,
      totalMBLowerBound: null,
    };
    memory.totalBytesLowerBound = memory.worldTypedArrays + memory.blockGrid + memory.economyNumericArrays + memory.sourceV3 + memory.packageArrays;
    memory.totalMBLowerBound = r4(memory.totalBytesLowerBound / 1048576);
    memory.renderChunkCacheUpperBoundMB = r4(memory.renderChunkCacheUpperBoundBytes / 1048576);

    const s = {
      u, unit: 'authoring_units_per_runtime_tile',
      status: 'DIAGNOSTIC_CANDIDATE__NOT_APPROVED',
      worldTiles: [W, H], cells, worldPx,
      tilePx: TILE, pxPerAu: r4(pxPerAu), auPerPx: r4(1 / pxPerAu),
      integerDimensionsConvenienceOnly: true,
      authoredRaster: {
        sourceCellAu: F.sourceGrid.cell, sourceCells: F.sourceGrid.cells,
        tilesPerSourceCell: r4(F.sourceGrid.cell / u),
        upsampleFactor: (F.sourceGrid.cell / u) ** 2,
        newAuthoredDetail: 'NONE — Veyra raster is 8 au/cell; U<8 only duplicates/interpolates cells, U=8 is 1:1.',
      },
      traversal: {
        baseTilesPerSec, baseSpeedPxPerSec: bal.player.speed, baseSpeedAuPerSec: speedAuPerSec,
        runClock: { maxRunHours: bal.run.maxRunHours, runSeconds: bal.run.maxRunHours * 3600, ragnarokFinalHours: bal.run.ragnarokFinalHours, HOUR_MS },
        fictionalDaySeconds: bal.dayNight.dayLengthMinutes * 60,
        crossWorldWidthSeconds: r4(F.authoringSpace[0] / speedAuPerSec),
        crossWorldWidthGameHours: r4(F.authoringSpace[0] / speedAuPerSec / 3600),
        crossWorldWidthFractionOfFictionalDay: r4(F.authoringSpace[0] / speedAuPerSec / (bal.dayNight.dayLengthMinutes * 60)),
      },
      camera: {
        viewportPx: [VIEW_W, VIEW_H], viewportTiles: [VIEW_W / TILE, VIEW_H / TILE],
        screensAcross: [r4(W / (VIEW_W / TILE)), r4(H / (VIEW_H / TILE))],
        fractionOfWorldWidthVisible: r4(VIEW_W / worldPx[0]),
        sightDayAu: r4(bal.ai.sightDay * u / TILE), sightNightAu: r4(bal.ai.sightNight * u / TILE),
        activeRadiusAu: r4(bal.ai.activeRadiusTiles * u),
      },
      engineLimits: {
        exactPackageValidator: {
          required: C.exactValidator.required,
          fits: W === WW && H === WH && TILE === C.runtime.TILE,
          note: 'validateRuntimeMapPackage() rejects ANY resize: e.width===WW, e.height===WH, e.tileSize===TILE; arrays must be exactly 40000.',
        },
        economyValidator: {
          maxCells: C.economyLimit.maxCells, fits: cells <= C.economyLimit.maxCells,
          arrayCount: C.economyLimit.arrayCount,
          note: 'validateEconomyMap() rejects >1,000,000 cells; all 13 equal-length cell arrays still required.',
        },
        coreFixedGrid: { WW, WH, runtimeCells, fits: cells === runtimeCells, note: 'core.ts WW/WH and Uint8Array(WW*WH) blockGrid are compile-time constants.' },
        renderChunkCache: {
          CH: C.chunk.CH, keyStride: C.chunk.keyStride, chunkCols, chunkRows,
          keyCollisionFree: chunkKeyCollisionFree,
          collisionFreeMaxWorldTilesW: C.chunk.collisionFreeMaxWorldTilesW,
          note: chunkKeyCollisionFree ? 'k=cy*100+cx is collision-free.' : `k=cy*100+cx COLLIDES: ${chunkCols} chunk columns > stride 100.`,
        },
        seaDistSemantic: { bfsStopTiles: C.seaDistBfsStopTiles + 1, ...sea },
        streaming: 'NO world streaming / LOD loader found in PR44 HEAD web/src/game. render.ts has a 16-tile terrain CHUNK CACHE only; core.ts/camera clamps still use fixed WW/WH.',
      },
      memory,
      spatial: {
        thresholds: {
          playerDiameterTiles: r4(playerDiameterTiles), cartDiameterTiles: r4(cartDiameterTiles),
          smallestRuntimeBuildingTiles: [C.minBuilding.w, C.minBuilding.h], smallestRoomTiles: minRoomTiles, smallestRoomSideTiles: minRoomSide,
          claimRadiusTiles: bal.economy.claimRadius, claimMinDistFromPoiTiles: C.physicalLimits.claimMinDistFromPoiTiles,
          tenderLinkTiles: C.physicalLimits.tenderLinkTiles,
          nearInteractionTiles: C.physicalLimits.nearInteractionWorkbenchTiles,
          buildRangeTiles: C.physicalLimits.buildRangeTiles,
          nearInteractionDefaultTiles: C.physicalLimits.nearInteractionDefaultTiles,
        },
        featureTiles: {
          minPOIAreaAu2: F.poiFoot.minAreaAu2, minPOIAreaTiles: r4(F.poiFoot.minAreaAu2 / (u * u)),
          medianPOIAreaTiles: r4(F.poiFoot.medianAreaAu2 / (u * u)),
          minPOIEdgeTiles: r4(F.poiFoot.minEdgeAu / u),
          proposedEntranceWestTiles: r4(entranceAu / u),
          proposedWorkspaceAreaTiles: workspaceAu2 === null ? null : r4(workspaceAu2 / (u * u)),
          roadAnalysisStrokeTiles: r4(roadStrokeAu / u),
          riverMaskTiles: r4(riverMaskAu / u),
          bridgeGlyphTiles: [r4(bridgeAu.w / u), r4(bridgeAu.h / u)],
          claimRadiusAu: r4(bal.economy.claimRadius * u),
          claimMinDistFromPoiAu: r4(bal.economy.claimMinDistFromPoi * u),
          tenderLinkAu: r4(bal.garden.tenderLinkTiles * u),
        },
        poiFeetUnableToHostSmallestRoom: F.poiFoot.footAreasAu2.filter(a => a / (u * u) < minRoomTiles || F.poiFoot.minEdgeAu / u < minRoomSide).length,
        poiFeetUnableToHost5x5Square: F.poiFoot.footAreasAu2.filter(a => a / (u * u) < 25 || F.poiFoot.minEdgeAu / u < 5).length,
        coastCellsSource: F.coastCells,
        coastDetailNote: u < 8 ? `coast stays an 8-au staircase repeated ${F.sourceGrid.cell / u}x per axis; NO new shoreline detail.` : '1 authored raster cell = 1 tile; coastline is representable at native resolution.',
        roadBendsRadiusUnderOneTile: bends.filter(b => b.radiusAu !== null && b.radiusAu < u).length,
        roadBendsRadiusUnderTwoTiles: bends.filter(b => b.radiusAu !== null && b.radiusAu < 2 * u).length,
        roadBendsMeasured: bends.length,
      },
      feasibility: null,
    };

    const f = s.spatial.featureTiles;
    // Tile quantization: an authored opening/width smaller than one tile becomes
    // ZERO open tiles at runtime. This is the physical gate, not a cosmetic one.
    const q = {
      entranceOpenTiles: Math.floor(entranceAu / u),
      roadOpenTiles: Math.floor(roadStrokeAu / u),
      riverOpenTiles: Math.floor(riverMaskAu / u),
      bridgeOpenTiles: [Math.floor(bridgeAu.w / u), Math.floor(bridgeAu.h / u)],
    };
    s.spatial.quantizedOpenTiles = q;
    const minWorkspaceTiles = C.physicalLimits.nearInteractionWorkbenchTiles ** 2; // 3x3 envelope from engine.ts near(r,e,3); derived minimum, NOT an approved dimension
    const tests = [
      { id: 'ENTRY_CART', gating: true, ok: q.entranceOpenTiles >= 1 && 1 >= cartDiameterTiles, measured: `${q.entranceOpenTiles} open tile(s); cart diameter ${cartDiameterTiles} tile`, basis: 'GEO-02 PROPOSED 3.696 au west opening; PR44 moveBody cart radius 5 px; one open floor tile is the atomic unit' },
      { id: 'ENTRY_ONE_FLOOR_TILE', gating: true, ok: q.entranceOpenTiles >= 1, measured: `${q.entranceOpenTiles} open tile(s)`, basis: 'PR44 structures occupy one tile centre; a sub-tile opening quantizes to ZERO open tiles' },
      { id: 'MIN_POI_ROOM', gating: true, ok: f.minPOIAreaTiles >= minRoomTiles && f.minPOIEdgeTiles >= minRoomSide, measured: `${f.minPOIAreaTiles} tiles², ${f.minPOIEdgeTiles} tile edge vs ${minRoomTiles} tiles²/${minRoomSide} side`, basis: 'smallest authored PR44 building (world.ts stamp); canonical Veyra smallest POI foot' },
      { id: 'MEDIAN_POI_ROOM', gating: true, ok: f.medianPOIAreaTiles >= 25 && F.poiFoot.minEdgeAu / u >= 5, measured: `${f.medianPOIAreaTiles} tiles²`, basis: 'canonical Veyra median foot; a multi-room POI needs >=5x5 tiles' },
      { id: 'PROPOSED_WORKSPACE', gating: true, ok: f.proposedWorkspaceAreaTiles >= minWorkspaceTiles, measured: `${f.proposedWorkspaceAreaTiles} tiles² vs derived ${minWorkspaceTiles} tiles²`, basis: 'GEO-02 PROPOSED working space 57.4232 au²; PR44 near(r,e,3) interaction envelope + 640x360 camera' },
      { id: 'ROAD_ONE_TILE', gating: true, ok: q.roadOpenTiles >= 1, measured: `${q.roadOpenTiles} open tile(s)`, basis: 'MapLab 9 au analysis stroke (NOT an authored physical width)' },
      { id: 'ROAD_TWO_TILES_CART_CLEARANCE', gating: false, ok: q.roadOpenTiles >= 2, measured: `${q.roadOpenTiles} open tile(s)`, basis: 'cargoPassable cross-section + cart swept clearance (UNVALIDATED in source); reported, not gating' },
      { id: 'RIVER_BARRIER_ONE_TILE', gating: true, ok: q.riverOpenTiles >= 1, measured: `${q.riverOpenTiles} open tile(s)`, basis: '9 au river mask; a sub-tile channel cannot be a distinct water tile' },
      { id: 'BRIDGE_GLYPH_BOTH_AXES', gating: true, ok: q.bridgeOpenTiles[0] >= 1 && q.bridgeOpenTiles[1] >= 1, measured: `${q.bridgeOpenTiles[0]}x${q.bridgeOpenTiles[1]} tiles`, basis: '13x7.2 au DISPLAY glyph; a zero-height deck loses the crossing' },
      { id: 'CHUNK_KEY_COLLISION_FREE', gating: true, ok: chunkKeyCollisionFree, measured: `${chunkCols} chunk columns vs stride ${C.chunk.keyStride}`, basis: 'render.ts getChunk k=cy*100+cx' },
      { id: 'ECONOMY_CELL_LIMIT', gating: true, ok: cells <= C.economyLimit.maxCells, measured: `${cells} cells vs ${C.economyLimit.maxCells}`, basis: 'validateEconomyMap() rejects >1,000,000' },
      { id: 'EXACT_PACKAGE_VALIDATOR', gating: false, ok: s.engineLimits.exactPackageValidator.fits, measured: `${W}x${H} vs ${WW}x${WH}`, basis: 'validateRuntimeMapPackage() — applies to ALL candidates; requires the same runtime change, not a differentiator' },
      { id: 'SEA_DIST_SEMANTIC_COVERAGE', gating: false, ok: true, measuredOnly: true, measured: `${(sea.fraction * 100).toFixed(2)}% land cells with meaningful seaDist`, basis: `world.ts seaDist BFS stops at ${C.seaDistBfsStopTiles} hops — measured semantic loss, not a hard gate` },
      { id: 'SHORELINE_DETAIL', gating: false, ok: true, measuredOnly: true, measured: `${F.coastCells} authored coast cells; ${r4(F.sourceGrid.cell / u)} tile(s) per 8 au source cell`, basis: 'Veyra raster is 8 au/cell. U<8 repeats the same 8-au coastline staircase; NO new shoreline indentation, bay or isthmus detail is authored.' },
      { id: 'CARGO_CORRIDOR_AUTHORING', gating: false, ok: false, measured: `${network.componentCount} disconnected cart-road components; RT-1 has 226.4759 au of kind=trail segments`, basis: 'MAP-LOG-03 needs a distinct, physically verified cart road. This blocker is SCALE-INDEPENDENT: no U fixes an incomplete authored trail, and no trail may be labelled cart-passable.' },
    ];
    s.feasibility = {
      tests, passed: tests.filter(t => t.ok).length,
      failed: tests.filter(t => !t.ok).map(t => t.id),
      gatingFailures: tests.filter(t => !t.ok && t.gating).map(t => t.id),
      hardRejections: tests.filter(t => !t.ok && t.gating).map(t => t.id),
      note: 'A scale is NOT approved merely because travel times are attractive or because dimensions are round integers. Gating spatial/engine failures are hard rejections; non-gating rows are global runtime changes or measured semantic losses.',
    };
    out.push(s);
  }
  return out;
}
