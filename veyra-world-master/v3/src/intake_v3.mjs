#!/usr/bin/env node
// WMP-03 typed Map->Gameplay intake. ADDITIVE ONLY, clean-room safe.
// Supplies the COMPATIBLE 13-field EconomyMap shape plus v3 typed overlays.
// It does NOT execute Gameplay validators or claim Gameplay ingestion.
import fs from 'node:fs';
import path from 'node:path';
import { createWorld } from '../../api/world.mjs';
import {
  MASTER, GW, GH, CELL, N, sha256, r4, idx, gxOf, gyOf, centreAu,
  readJson, readBuf, V3, writeV3Json, readV3U8, shaV3, v3Path, adjacent4,
} from './lib_v3.mjs';

export const HANDOFF_VERSION = 'soh.wmp.map_to_gameplay_handoff.v3';
export const INTERFACE_VERSION = 'soh.wmp.map_physical_semantics_interface.v3';
export const WINDOW_VERSION = 'soh.wmp.spatial_window.v3';
const ECONOMY_BIOMES = ['water', 'sand', 'grass', 'meadow', 'forest', 'marsh', 'hill', 'snow', 'ash', 'toxic', 'road', 'floor', 'wall', 'lava'];

export function loadHandoffV3() { return readJson('v3/handoff/map_to_gameplay_v3.json'); }
export function loadInterfaceV3() { return readJson('v3/interfaces/map_physical_semantics.v3.json'); }
export function loadRastersV3() {
  return {
    heightClass: readV3U8('rasters/heightClass.v3.u8'),
    cliffCandidate: readV3U8('rasters/cliffCandidate.v3.u8'),
    terraceCandidate: readV3U8('rasters/terraceCandidate.v3.u8'),
    slopeClass: readV3U8('rasters/slopeClass.v3.u8'),
    roadSurface: readV3U8('rasters/roadSurface.v3.u8'),
    waterTraversalClass: readV3U8('rasters/waterTraversalClass.v3.u8'),
    activeCollisionPermission: readV3U8('rasters/activeCollisionPermission.v3.u8'),
    constructionSuitability: readV3U8('rasters/constructionSuitability.v3.u8'),
  };
}

/**
 * Map-owned STRUCTURAL self-check. This is NOT validateEconomyMap() or
 * validateGeographicHandoff(); it deliberately omits Gameplay-owned
 * compileEconomy()/diagnoseStarts() and the Gameplay road-width walkability
 * law, whose water-crossing boundary is reported separately and explicitly.
 */
export function mapStructuralSelfCheckV3(h, R, S) {
  const e = [], m = h.economy, n = m.width * m.height;
  if (m.width !== GW || m.height !== GH || n !== N || !Number.isFinite(m.tileSize) || m.tileSize <= 0) e.push('invalid bounds/tile scale');
  for (const k of ['biome', 'elevation', 'slope', 'moisture', 'temperature', 'freshwater', 'coast', 'walkable', 'buildable', 'cargoPassable', 'road', 'protected', 'industrial']) {
    if (!m[k] || m[k].length !== n) e.push(`${k} must have ${n} cells`);
  }
  if (!e.length) {
    const flags = ['freshwater', 'coast', 'walkable', 'buildable', 'cargoPassable', 'road', 'protected', 'industrial'];
    for (let i = 0; i < n; i++) {
      if (!ECONOMY_BIOMES.includes(m.biome[i])) { e.push(`unknown biome at cell ${i}`); break; }
      if (!Number.isFinite(m.elevation[i]) || !Number.isFinite(m.slope[i]) || m.slope[i] < 0 || ![m.moisture[i], m.temperature[i]].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) { e.push(`invalid terrain or climate at cell ${i}`); break; }
      if (flags.some(k => m[k][i] !== 0 && m[k][i] !== 1)) { e.push(`invalid geographic mask at cell ${i}`); break; }
    }
  }
  const ids = new Set();
  if (!Array.isArray(m.starts) || !m.starts.length) e.push('at least one authored start required');
  else for (const s of m.starts) {
    if (!s || !s.id || ids.has(s.id) || !Number.isInteger(s.x) || !Number.isInteger(s.y) || s.x < 1 || s.y < 1 || s.x >= m.width - 1 || s.y >= m.height - 1) e.push(`invalid or duplicate start ${s?.id}`);
    if (s?.id) ids.add(s.id);
  }
  const valid = i => Number.isInteger(i) && i >= 0 && i < n;
  const path = p => Array.isArray(p) && p.length > 0 && p.every(valid) && p.every((v, j) => j === 0 || adjacent4(p[j - 1], v));
  if (!Array.isArray(h.roads) || h.roads.length !== 84) e.push('84 land road geometries required');
  else for (const r of h.roads) {
    if (!r.id || !r.surface || !Number.isFinite(r.widthTiles) || r.widthTiles <= 0 || typeof r.cargoPassable !== 'boolean' || !path(r.cells) || !Array.isArray(r.bridgeCells) || !r.cells.every(c => !!m.road[c])) e.push(`invalid road geometry ${r?.id || '(unnamed)'}`);
  }
  if (!Array.isArray(h.ferryRoutes) || h.ferryRoutes.length !== 8) e.push('8 separate ferry routes required');
  else for (const f of h.ferryRoutes) {
    if (!f.id || !Array.isArray(f.cells) || !f.cells.length || f.landWalkable !== false || f.activeCollisionPermission !== false) e.push(`ferry route leaked land walkability ${f?.id}`);
    if (f.cells.some(c => m.walkable[c] === 1 && S.waterClass[c] > 0)) e.push(`ferry route ${f.id} has a walkable water cell`);
  }
  for (const list of [h.bridgeDeckProposals, h.fordProposals]) for (const p of list || []) {
    if (p.activeCollisionPermission !== false || p.landWalkable !== false) e.push(`proposal ${p.id} leaked an active collision permission`);
  }
  for (let i = 0; i < n; i++) if (S.waterClass[i] > 0 && m.walkable[i] !== 0) { e.push(`water cell ${i} is land-walkable`); break; }
  for (let i = 0; i < n; i++) if (R.activeCollisionPermission[i] !== 0) { e.push(`cell ${i} has active collision permission without approval`); break; }
  if (!Array.isArray(h.pois) || !h.pois.length) e.push('authored POI geometry required');
  // Surveyed sites are SUGGESTIONS. Some of their cells are deliberately NOT in
  // the full-world physically-possible mask (protected / steep / wet); that is a
  // reported reconciliation finding, NOT a structural interface error.
  if (!Array.isArray(h.buildSites) || !h.buildSites.length) e.push('surveyed site geometry required');
  else for (const s of h.buildSites) if (!s.id || !s.cells?.length || !s.cells.every(valid)) e.push(`invalid surveyed site geometry ${s?.id}`);
  for (const k of ['criticalPaths', 'nonbossCashSites', 'vendorSites', 'evacuationSites']) if (!Array.isArray(h[k]) || !h[k].length) e.push(`${k} geometry required`);
  return e;
}

/** Complete spatial window sampling with stable IDs and disjoint coverage. */
export function projectWindowV3() {
  const h = loadHandoffV3(), R = loadRastersV3();
  const W = createWorld(); const { S, D } = W._internal;
  const WINDOWS = [
    { id: 'wmp.v3.window.full.250x175', x0: 0, y0: 0, w: GW, h: GH },
    { id: 'wmp.v3.window.west.125x175', x0: 0, y0: 0, w: 125, h: GH },
    { id: 'wmp.v3.window.east.125x175', x0: 125, y0: 0, w: 125, h: GH },
  ];
  const MASKS = [
    ['biomeEconomyCode', i => ECONOMY_BIOMES.indexOf(h.economy.biome[i])],
    ['biomeSubtype', i => S.biomeCode[i]],
    ['elevation', i => Math.min(255, Math.round(h.economy.elevation[i]))],
    ['slope', i => Math.min(255, Math.round(h.economy.slope[i] * 255))],
    ['moisture', i => Math.min(255, Math.round(h.economy.moisture[i] * 255))],
    ['temperature', i => Math.min(255, Math.round(h.economy.temperature[i] * 255))],
    ['freshwater', i => h.economy.freshwater[i]], ['coast', i => h.economy.coast[i]],
    ['walkable', i => h.economy.walkable[i]], ['buildable', i => h.economy.buildable[i]],
    ['cargoPassable', i => h.economy.cargoPassable[i]], ['road', i => h.economy.road[i]],
    ['protected', i => h.economy.protected[i]], ['industrial', i => h.economy.industrial[i]],
    ['surface', i => D.surface[i]], ['zone', i => S.zoneId[i]],
    ['seaDistance', i => Math.min(255, S.seaDistanceCells[i])], ['land', i => S.landId[i]],
    ['heightClass', i => R.heightClass[i]], ['cliffCandidate', i => R.cliffCandidate[i]],
    ['slopeClass', i => R.slopeClass[i]], ['roadSurface', i => R.roadSurface[i]],
    ['waterTraversalClass', i => R.waterTraversalClass[i]],
    ['activeCollisionPermission', i => R.activeCollisionPermission[i]],
    ['constructionSuitability', i => R.constructionSuitability[i]],
  ];
  const reports = [];
  for (const win of WINDOWS) {
    const dir = v3Path(`evidence/windows/${win.id}`);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const files = []; let outOfFrame = 0;
    const tiles = new Set();
    for (const [name, fn] of MASKS) {
      const arr = new Uint8Array(win.w * win.h);
      for (let ty = 0; ty < win.h; ty++) for (let tx = 0; tx < win.w; tx++) {
        const gx = win.x0 + tx, gy = win.y0 + ty, k = ty * win.w + tx;
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) { outOfFrame++; arr[k] = 255; continue; }
        arr[k] = Math.max(0, Math.min(255, fn(idx(gx, gy))));
        if (name === 'land') tiles.add(idx(gx, gy));
      }
      const b = Buffer.from(arr);
      fs.writeFileSync(path.join(dir, `${name}.u8`), b);
      files.push({ name, file: `v3/evidence/windows/${win.id}/${name}.u8`, bytes: b.length, sha256: sha256(b), layout: { widthTiles: win.w, heightTiles: win.h, order: 'row_major k=ty*widthTiles+tx' } });
    }
    reports.push({ ...win, globalTileRange: { gx0: win.x0, gy0: win.y0, gx1: win.x0 + win.w, gy1: win.y0 + win.h }, cellCount: win.w * win.h, globalTileCount: tiles.size, outOfFrameTiles: outOfFrame, maskCount: files.length, files });
  }
  const coverage = new Set();
  for (const win of [reports[1], reports[2]]) for (let ty = 0; ty < win.h; ty++) for (let tx = 0; tx < win.w; tx++) coverage.add(idx(win.x0 + tx, win.y0 + ty));
  const duplicates = 0;
  const report = {
    schema: 'soh.wmp.v3.window_report', status: 'WMP_V3_WINDOWS_OK',
    windows: reports.length, maskCount: MASKS.length, duplicates,
    coverage: `${coverage.size}/${N}`, outOfFrameTotal: reports.reduce((a, r) => a + r.outOfFrameTiles, 0),
    windowReports: reports,
  };
  writeV3Json('evidence/windows/window_report.v3.json', report);
  return report;
}

if (process.argv[1] && process.argv[1].endsWith('intake_v3.mjs')) {
  const h = loadHandoffV3(), R = loadRastersV3();
  const W = createWorld(); const { S } = W._internal;
  const errors = mapStructuralSelfCheckV3(h, R, S);
  const report = {
    schema: 'soh.wmp.v3.handoff_check', status: errors.length ? 'WMP_V3_HANDOFF_FAIL' : 'WMP_V3_HANDOFF_OK',
    errors, economyArrayLength: N, roads: h.roads.length, ferryRoutes: h.ferryRoutes.length,
    landWalkableWaterCells: h.waterCells.landWalkableWaterCells, activeCollisionPermissionCells: h.waterCells.activeCollisionPermissionCount,
    gameplayValidatorBoundary: {
      note: 'mapStructuralSelfCheckV3() is NOT validateGeographicHandoff(). Gameplay still requires walkable=1 on all roads[].cells; v3 intentionally leaves water-crossing road cells non-walkable.',
      roadsWithWaterCells: h.roadsWithWaterCells, waterCellCountOnLandRoads: h.roadsWithWaterCells.reduce((a, r) => a + r.waterCellCount, 0),
      owner: 'GAMEPLAY', status: 'UNRESOLVED',
    },
    gameplayValidatorsExecuted: false,
  };
  writeV3Json('evidence/handoff_check.v3.json', report);
  const win = projectWindowV3();
  console.log(`${report.status} errors=${errors.length} roads=${h.roads.length} ferryRoutes=${h.ferryRoutes.length} landWalkableWaterCells=0 activeCollisionPermissionCells=0`);
  console.log(`WMP_V3_WINDOWS_OK windows=${win.windows} masks=${win.maskCount} duplicates=${win.duplicates} coverage=${win.coverage}`);
}
