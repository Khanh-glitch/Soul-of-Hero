#!/usr/bin/env node
// WMP-03 ANALYTICAL TECHNICAL PREVIEWS — deterministic pure-Node PNGs.
// NOT Web runtime renders, NOT creator-approved art, NOT visual acceptance.
import fs from 'node:fs';
import path from 'node:path';
import { createWorld } from '../../api/world.mjs';
import { Canvas } from '../../tools/png.mjs';
import {
  MASTER, GW, GH, CELL, N, sha256, r4, idx, gxOf, gyOf, centreAu, readJson, readBuf,
  V3, writeV3Json, readV3U8, legacyXYPath, correctedPath, v3Path,
} from './lib_v3.mjs';

const W = createWorld(); const { S, D, C } = W._internal;
const OUT = path.join(V3, 'evidence', 'views');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const TERRAIN = readJson('v3/layers/terrain_height_class.v3.json');
const ROADS = readJson('v3/layers/road_rasterization_delta.v3.json');
const WATER = readJson('v3/layers/water_traversal.v3.json');
const CONSTRUCT = readJson('v3/layers/construction_semantics.v3.json');
const STRUCT = readJson('v3/layers/structural_checks.v3.json');
const H = readJson('v3/handoff/map_to_gameplay_v3.json');
const SURFACE_RGB = [
  [10, 30, 70], [24, 72, 110], [194, 178, 120], [92, 140, 74], [110, 158, 82], [42, 96, 58],
  [76, 110, 96], [128, 116, 88], [96, 88, 80], [210, 220, 226], [78, 70, 72], [110, 130, 60],
  [160, 142, 110], [200, 168, 110], [150, 140, 130], [190, 70, 70], [220, 90, 40], [80, 60, 50],
  [170, 210, 230], [40, 110, 150],
];
const HEIGHT_RGB = [[34, 92, 58], [58, 128, 74], [112, 150, 82], [176, 158, 96], [166, 96, 62], [214, 222, 228]];
const records = [];
const save = (cv, name, note) => {
  const f = path.join(OUT, name), meta = cv.png(f);
  const rec = { ...meta, file: `v3/evidence/views/${name}`, sha256: sha256(fs.readFileSync(f)),
    classification: 'MAP_ANALYTICAL_TECHNICAL_PREVIEW',
    status: 'TECHNICAL_PREVIEW__NOT_WEB_RUNTIME_PROOF__NOT_CREATOR_APPROVED_ART__NOT_VISUAL_ACCEPTANCE', note };
  records.push(rec); return rec;
};
const header = (cv, title, sub) => {
  cv.rect(0, 0, cv.w - 1, 17, [12, 16, 24], 0.92); cv.text(title, 5, 4, [235, 240, 248], 2);
  cv.rect(0, cv.h - 14, cv.w - 1, cv.h - 1, [12, 16, 24], 0.92); cv.text(sub, 5, cv.h - 11, [205, 216, 228], 1);
};
const base = (cv, scale = 3, ox = 5, oy = 20) => {
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const c = SURFACE_RGB[D.surface[idx(x, y)]] ?? [40, 40, 40];
    cv.rect(ox + x * scale, oy + y * scale, ox + x * scale + scale - 1, oy + y * scale + scale - 1, c, 0.72);
  }
};

// 1. v3 terrain height classification over the whole frame.
{
  const cv = Canvas(760, 20 + GH * 3 + 14);
  base(cv, 3);
  const hc = readV3U8('rasters/heightClass.v3.u8');
  for (let i = 0; i < N; i++) if (S.waterClass[i] === 0)
    cv.rect(5 + gxOf(i) * 3, 20 + gyOf(i) * 3, 5 + gxOf(i) * 3 + 2, 20 + gyOf(i) * 3 + 2, HEIGHT_RGB[hc[i]], 0.88);
  header(cv, 'WMP03 TERRAIN HEIGHT CLASS', 'OBSERVED QUANTILES / RAW BYTES ONLY / NO METRES OR DEGREES');
  save(cv, 'v3_terrain_height_class.png', 'Six observed-quantile relief classes over dry land; sea left as authored surface. Unit UNRESOLVED.');
}
// 2. cliff BEFORE (v1 threshold > 200 => empty) vs AFTER (v3 connected faces).
{
  const cv = Canvas(760, 20 + GH * 3 + 14);
  base(cv, 3);
  const cl = readV3U8('rasters/cliffCandidate.v3.u8');
  for (let i = 0; i < N; i++) if (D.cliff[i]) cv.rect(5 + gxOf(i) * 3, 20 + gyOf(i) * 3, 5 + gxOf(i) * 3 + 2, 20 + gyOf(i) * 3 + 2, [255, 40, 40], 1);
  for (let i = 0; i < N; i++) if (cl[i]) cv.rect(5 + gxOf(i) * 3, 20 + gyOf(i) * 3, 5 + gxOf(i) * 3 + 2, 20 + gyOf(i) * 3 + 2, [255, 196, 60], 0.95);
  header(cv, 'WMP03 CLIFF BEFORE / AFTER', `V1 THRESHOLD 200 > MAX 150 = 0 CELLS / V3 CONNECTED FACES = ${TERRAIN.cliffCandidateCount}`);
  save(cv, 'v3_cliff_before_after.png', 'Red = WMP-01 cliff.u8 (empty); amber = WMP-03 connected cliff candidates. Same source raster.');
}
// 3. road shape before/after for the 5 worst legacy distortions.
{
  const cv = Canvas(900, 600);
  const SCALE = 2, OX = 20, OY = 30;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const c = SURFACE_RGB[D.surface[idx(x, y)]] ?? [40, 40, 40];
    cv.rect(OX + x * SCALE, OY + y * SCALE, OX + x * SCALE + SCALE - 1, OY + y * SCALE + SCALE - 1, c, 0.75);
  }
  const worst = ROADS.delta.worstLegacy.map(x => x.id);
  for (const id of worst) {
    const r = C.roads.find(x => x.id === id);
    const legacy = legacyXYPath(r.points), corrected = correctedPath(r.points);
    for (const c of legacy) cv.circle(OX + gxOf(c) * SCALE, OY + gyOf(c) * SCALE, 2, [230, 60, 60], 1, 0.9);
    for (const c of corrected) cv.circle(OX + gxOf(c) * SCALE, OY + gyOf(c) * SCALE, 2, [80, 240, 140], 1, 0.9);
    cv.poly(r.points.map(p => [OX + Math.floor(p[0] / CELL * SCALE), OY + Math.floor(p[1] / CELL * SCALE)]), [235, 235, 245], 1, 0.7);
  }
  header(cv, 'WMP03 ROAD RASTERIZATION', `RED = V2 X-THEN-Y / GREEN = V3 SHAPE-PRESERVING / MAX DRIFT ${ROADS.delta.legacyMaxDriftAu.max} -> ${ROADS.delta.correctedMaxDriftAu.max} AU`);
  save(cv, 'v3_road_drift_before_after.png', `Five worst exact road IDs: ${worst.join(', ')}. Authored polylines in white.`);
}
// 4. water traversal classes.
{
  const cv = Canvas(760, 20 + GH * 3 + 14);
  base(cv, 3);
  const wt = readV3U8('rasters/waterTraversalClass.v3.u8');
  const CLS = { 2: [60, 150, 255], 3: [255, 220, 70], 4: [255, 130, 50], 1: [235, 235, 235] };
  for (let i = 0; i < N; i++) if (wt[i]) cv.rect(5 + gxOf(i) * 3, 20 + gyOf(i) * 3, 5 + gxOf(i) * 3 + 2, 20 + gyOf(i) * 3 + 2, CLS[wt[i]], 0.95);
  header(cv, 'WMP03 WATER TRAVERSAL', 'BLUE FERRY / YELLOW BRIDGE PROPOSAL / ORANGE FORD / WHITE LAND ROAD');
  save(cv, 'v3_water_traversal.png', 'ZERO water cells are land-walkable; ZERO active collision permissions; ferry routes are NOT roads.');
}
// 5. construction BEFORE (23 surveyed) vs AFTER (full-world physically possible).
{
  const cv = Canvas(760, 20 + GH * 3 + 14);
  base(cv, 3);
  const suit = readV3U8('rasters/constructionSuitability.v3.u8');
  for (let i = 0; i < N; i++) if (H.economy.buildable[i]) cv.rect(5 + gxOf(i) * 3, 20 + gyOf(i) * 3, 5 + gxOf(i) * 3 + 2, 20 + gyOf(i) * 3 + 2, [80, 220, 130], 0.7);
  for (const s of CONSTRUCT.surveyedSites) {
    const bb = s.physicalEnvelopeAu;
    cv.rect(5 + Math.floor(bb[0] / CELL) * 3, 20 + Math.floor(bb[1] / CELL) * 3, 5 + Math.ceil(bb[2] / CELL) * 3, 20 + Math.ceil(bb[3] / CELL) * 3, [235, 70, 190], 1, 0.95);
  }
  header(cv, 'WMP03 CONSTRUCTION', `GREEN FULL-WORLD POSSIBLE ${CONSTRUCT.concepts.physicallyPossibleFootprints.cellCount} CELLS / MAGENTA 23 SURVEYED SUGGESTIONS`);
  save(cv, 'v3_construction_before_after.png', `v2 buildable=${CONSTRUCT.previousDefect.v2BuildableCellCount}; v3 physical=${CONSTRUCT.concepts.physicallyPossibleFootprints.cellCount}; ${CONSTRUCT.sandboxRestrictionProven.cellsInComponentsWithNoSurveyedZone} cells outside surveyed zones.`);
}
// 6. region geometry evidence (Typhon / Cinder / snow / wetland / lowlands).
{
  const cv = Canvas(760, 20 + GH * 3 + 14);
  base(cv, 3);
  const REGION_RGB = { TYPHON_TERRITORY: [230, 90, 70], CINDER_VOLCANIC: [255, 150, 50], SNOW_BIOME: [220, 235, 255], WETLAND_BIOME: [70, 190, 170], LOWLAND_ZONES: [120, 200, 100], HIGH_ROCK_ZONES: [170, 120, 220] };
  const masks = {
    TYPHON_TERRITORY: i => S.elderGeometryId[i] === 2,
    CINDER_VOLCANIC: i => S.zoneId[i] === 17 || S.biomeCode[i] === 9,
    SNOW_BIOME: i => S.biomeCode[i] === 8,
    WETLAND_BIOME: i => S.biomeCode[i] === 4,
    LOWLAND_ZONES: i => [1, 2, 4, 9, 10, 11, 18, 20].includes(S.zoneId[i]),
    HIGH_ROCK_ZONES: i => [6, 7, 8, 16, 21].includes(S.zoneId[i]),
  };
  for (const [name, f] of Object.entries(masks)) for (let i = 0; i < N; i++) if (S.waterClass[i] === 0 && f(i))
    cv.rect(5 + gxOf(i) * 3, 20 + gyOf(i) * 3, 5 + gxOf(i) * 3 + 2, 20 + gyOf(i) * 3 + 2, REGION_RGB[name], 0.75);
  header(cv, 'WMP03 REGION GEOMETRY', 'TYPHON / CINDER / SNOW / WETLAND / LOWLAND / HIGH ROCK');
  save(cv, 'v3_region_evidence.png', 'Non-exclusive authored region masks used by the terrain classifier; measured statistics in terrain_height_class.v3.json.');
}
// 7. bounded structural checks: POI entrances, host overlaps, roof semantics.
{
  const cv = Canvas(760, 20 + GH * 3 + 14);
  base(cv, 3);
  for (const p of STRUCT.poiRoadEntrances.pois) {
    const x = 5 + Math.floor(p.atAu[0] / CELL) * 3, y = 20 + Math.floor(p.atAu[1] / CELL) * 3;
    const c = p.frontageStatus === 'VERIFIED_ROAD_FRONTAGE_WITHIN_40_AU' ? [90, 230, 130] : [250, 90, 90];
    cv.circle(x, y, 2, c, 1, 1);
  }
  for (const s of STRUCT.overlappingEnvelopes.sites.filter(x => x.hostEnvelopeCount > 0)) {
    const site = CONSTRUCT.surveyedSites.find(x => x.id === s.siteId);
    if (!site) continue;
    const bb = site.physicalEnvelopeAu;
    cv.rect(5 + Math.floor(bb[0] / CELL) * 3, 20 + Math.floor(bb[1] / CELL) * 3, 5 + Math.ceil(bb[2] / CELL) * 3, 20 + Math.ceil(bb[3] / CELL) * 3, [240, 200, 70], 1, 0.9);
  }
  header(cv, 'WMP03 BOUNDED STRUCTURAL CHECKS', 'GREEN POI ROAD FRONTAGE / YELLOW HOST-ENVELOPE OVERLAP / NO ROOF AUTO-SHRINK');
  save(cv, 'v3_structural_checks.png', `81 POI entrances, ${STRUCT.overlappingEnvelopes.sitesWithHostOverlap.length} host overlaps, 153 roofs classified, 0 automatic shrinks, 0 canonical POI changes.`);
}
writeV3Json('evidence/views/views_index.v3.json', {
  schema: 'soh.wmp.v3.views_index', status: 'WMP_V3_VIEWS_OK',
  classification: 'MAP_ANALYTICAL_TECHNICAL_PREVIEW',
  note: 'These PNGs are deterministic technical before/after plots of measured geometry. They are NOT playable Web renders, NOT creator-approved art, NOT visual acceptance.',
  viewCount: records.length, views: records,
});
console.log(`WMP_V3_VIEWS_OK analytical=${records.length} totalBytes=${records.reduce((a, r) => a + r.bytes, 0)}`);
