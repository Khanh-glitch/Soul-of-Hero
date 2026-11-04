// WMP-01 chunk-aware Gameplay INTAKE CONTRACT (candidate geometry only).
// CLEAN-ROOM: reads ONLY data/, layers/, rasters/, manifest.
// This file NEVER edits Gameplay runtime. It emits a bounded, chunk-aware
// window projection for a downstream consumer to validate at its own SHA.
import fs from 'node:fs';
import {
  MASTER, GW, GH, CELL, FRAME_AU, CHUNK_CELLS, CHUNK_AU, CHUNKS_X, CHUNKS_Y,
  readJson, writeJson, sha256, digest, r4, idx, toCell, inFrame, loadRasters, loadDerivedRasters,
  STATUS, authority,
} from '../lib/wmp.mjs';

export const INTAKE_VERSION = 'soh.wmp.chunk_intake_contract.v1';
export const OUT_OF_FRAME = 255;

export function intakeContract() {
  const c = readJson('layers/chunks.v1.json');
  return {
    schema: INTAKE_VERSION, version: 1, authority, status: 'PROPOSED__GAMEPLAY_INTAKE_NOT_IMPLEMENTED',
    contract: c.integrationContract,
    worldAuthority: 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT',
    frame: c.frame,
    note: 'The 200x200 Web window is a PLAYABLE_WEB_SLICE, NOT the whole 2000x1400 Veyra authoring frame.',
  };
}

/**
 * Project a bounded window from the full-world physical rasters.
 * Returns a compact descriptor + deterministic u8 mask files; no 40,000-element
 * decorative JSON array is produced.
 */
export function projectWindow(opts = {}) {
  const originAu = Array.isArray(opts.originAu) && opts.originAu.length === 2 && opts.originAu.every(Number.isFinite) ? opts.originAu : [0, 0];
  const U = Number.isFinite(opts.U) && opts.U > 0 ? opts.U : 1.6;
  const widthTiles = Math.max(1, Math.min(512, Math.floor(opts.widthTiles ?? 200)));
  const heightTiles = Math.max(1, Math.min(512, Math.floor(opts.heightTiles ?? 200)));
  const id = `window.U${String(U).replace('.', '')}.${widthTiles}x${heightTiles}.${originAu[0]}x${originAu[1]}`;
  const S = loadRasters(), D = loadDerivedRasters();
  const n = widthTiles * heightTiles;
  const tiles = new Uint8Array(n), fresh = new Uint8Array(n), zone = new Uint8Array(n), seaDist = new Uint8Array(n), land = new Uint8Array(n);
  let outOfFrame = 0;
  for (let ty = 0; ty < heightTiles; ty++) for (let tx = 0; tx < widthTiles; tx++) {
    const x = originAu[0] + (tx + 0.5) * U, y = originAu[1] + (ty + 0.5) * U;
    const k = ty * widthTiles + tx;
    if (!inFrame(x, y)) { tiles[k] = OUT_OF_FRAME; seaDist[k] = OUT_OF_FRAME; outOfFrame++; continue; }
    const i = toCell(x, y);
    tiles[k] = D.surface[i]; fresh[k] = (S.waterClass[i] > 0 && S.freshwater[i] > 0) ? 1 : 0;
    zone[k] = S.zoneId[i]; seaDist[k] = Math.min(255, S.seaDistanceCells[i]); land[k] = S.landId[i];
  }
  // Chunk-aware window descriptor.
  const x0 = Math.max(0, Math.floor(originAu[0] / CHUNK_AU)), y0 = Math.max(0, Math.floor(originAu[1] / CHUNK_AU));
  const x1 = Math.min(CHUNKS_X - 1, Math.floor((originAu[0] + widthTiles * U) / CHUNK_AU));
  const y1 = Math.min(CHUNKS_Y - 1, Math.floor((originAu[1] + heightTiles * U) / CHUNK_AU));
  const chunkIds = [];
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) chunkIds.push(`chunk.${cx}.${cy}`);
  // Continuity: adjacent tiles inside the same chunk and across chunk borders
  // must sample the same authored cell when their AU positions coincide.
  let boundarySamples = 0, boundaryMismatches = 0;
  for (let ty = 0; ty < heightTiles; ty++) for (let tx = 1; tx < widthTiles; tx++) {
    const ax = originAu[0] + (tx - 0.5) * U, bx = originAu[0] + (tx + 0.5) * U, y = originAu[1] + (ty + 0.5) * U;
    const ca = Math.floor(ax / CHUNK_AU), cb = Math.floor(bx / CHUNK_AU);
    if (ca === cb || !inFrame(ax, y) || !inFrame(bx, y)) continue;
    boundarySamples++;
    if (toCell(ax, y) === toCell(bx, y) && tiles[ty * widthTiles + tx - 1] !== tiles[ty * widthTiles + tx]) boundaryMismatches++;
  }
  const files = [];
  for (const [suffix, arr, dtype] of [['tiles', tiles, 'Web T surface code'], ['fresh', fresh, 'freshwater mask'], ['zone', zone, 'authored zone id'], ['seaDist', seaDist, 'authored sea distance cells'], ['land', land, 'authored land id']]) {
    const p = `${MASTER}/evidence/windows/${id}.${suffix}.u8`;
    files.push({ suffix, file: `evidence/windows/${id}.${suffix}.u8`, bytes: arr.length, sha256: sha256(Buffer.from(arr)), dtype, layout: { widthTiles, heightTiles, order: 'row_major k=ty*widthTiles+tx' } });
    fs.mkdirSync(MASTER + '/evidence/windows', { recursive: true }); fs.writeFileSync(p, Buffer.from(arr));
  }
  const m = readJson('manifest.v1.json');
  const places = readJson('data/canon/geometry_snapshot.v1.json').collections.pois
    .filter(p => p.at[0] >= originAu[0] && p.at[0] < originAu[0] + widthTiles * U && p.at[1] >= originAu[1] && p.at[1] < originAu[1] + heightTiles * U)
    .map(p => ({ poiId: p.id, atAu: p.at.map(r4), tile: [r4((p.at[0] - originAu[0]) / U), r4((p.at[1] - originAu[1]) / U)], arche: p.arche, elder: p.elder ?? null }));
  const elderIds = readJson('data/canon/geometry_snapshot.v1.json').collections.elders.map(e => e.id);
  return {
    schema: INTAKE_VERSION, version: 1, authority, id,
    status: 'PROPOSED_CHUNK_AWARE_WINDOW_CANDIDATE__NOT_RUNTIME_INGESTED',
    parameters: { originAu, unitsPerTileAu: U, widthTiles, heightTiles, tilePx: 16, viewPx: [640, 360] },
    master: { revisionDigest: m.revisionDigest, frame: m.frame, note: 'Full 2000x1400 authoring frame; this window is a bounded slice.' },
    files, chunkIds, chunkCount: chunkIds.length,
    continuity: { boundarySamples, boundaryMismatches, status: boundaryMismatches === 0 ? 'CONTINUOUS_AT_SAMPLED_BOUNDARIES' : 'DISCONTINUITY_DETECTED' },
    economyMapCandidate: {
      schema: 'soh.wmp.economy_map_candidate.v1', widthTiles, heightTiles,
      biomeLabels: readJson('layers/crosswalks.v1.json').economyLabels.length,
      fields: ['biome', 'elevation', 'slope', 'moisture', 'temperature', 'freshwater', 'coast', 'walkable', 'buildable', 'cargoPassable', 'road', 'protected', 'industrial'],
      providedRasters: files.map(f => f.suffix),
      temperature: { status: STATUS.UNKNOWN, owner: 'GAMEPLAY' }, moisture: { status: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
      cargoPassable: { status: STATUS.UNKNOWN, owner: 'GAMEPLAY' }, industrial: { status: STATUS.UNKNOWN, owner: 'GAMEPLAY' },
      starts: [], buildings: [], statics: [], places,
      note: 'Geometry-only candidate. Numeric climate, cargo passability, stock, starts, buildings, statics and runtime safety are GAMEPLAY_OWNED.',
    },
    runtimeMapPackageFields: { buildings: [], statics: [], places, elders: elderIds.map(id => ({ elderTerritoryId: id, runtimeEntity: 'GAMEPLAY_OWNED' })), starts: [], note: 'Six Elder TERRITORY ids are supplied as geometry; runtime Elder entities are not.' },
    overrides: readJson('layers/crosswalks.v1.json').overrides,
    outOfFrameTiles: outOfFrame,
    consumerValidation: ['pin manifest.v1.json SHA-256', 'call web/src/game/world-economy.ts validateEconomyMap', 'call geography-contract.ts validateGeographicHandoff', 'supply Gameplay-owned starts/occupancy/claims/hazards/weather/stock/persistence', 'do NOT assume this 200x200 window is the whole world'],
    noClaims: ['NO Gameplay runtime file modified', 'NO full Web ingestion proof', 'NO survival/economy/combat/save/offline/escrow proof', 'NO approved U', 'NO playable Veyra'],
  };
}
export function economyMapFieldSemantics() {
  const c = readJson('layers/crosswalks.v1.json');
  return {
    schema: 'soh.wmp.economy_map_field_semantics.v1', authority,
    labels: c.economyLabels, webTerrainCodes: c.webTerrainCodes,
    mapping: 'layers/crosswalks.v1.json biomeMap + overrides',
    status: 'EXPLICIT_CROSSWALK__NO_SILENT_HEURISTIC',
  };
}
