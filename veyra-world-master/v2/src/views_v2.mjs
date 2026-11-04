#!/usr/bin/env node
// MAP-LR03R / WMP-02 TECHNICAL VIEWS — deterministic pure-Node PNGs.
// These are ANALYTICAL BEFORE/AFTER PREVIEWS derived from authored geometry.
// They are NOT playable Web renders, NOT creator-approved art, NOT visual acceptance.
import fs from 'node:fs';
import path from 'node:path';
import { MASTER, GW, GH, CELL, CHUNK_AU, CHUNKS_X, CHUNKS_Y, readJson, readBuf, sha256, r4, idx, centreAu, toCell, pointInRing } from '../../lib/wmp.mjs';
import { createWorld } from '../../api/world.mjs';
import { Canvas } from '../../tools/png.mjs';

const W = createWorld();
const { S, D, C, architecture, chunks } = W._internal;
const V2 = path.join(MASTER, 'v2'), OUT = path.join(V2, 'evidence', 'views');
fs.mkdirSync(OUT, { recursive: true });
const vertical = readJson('v2/layers/vertical_corrections.v2.json');
const transport = readJson('v2/layers/transport_corrections.v2.json');
const buildSites = readJson('v2/layers/build_sites.v2.json');
const roofs = readJson('v2/layers/roof_assessment.v2.json');
const env = readJson('v2/layers/environment.v2.json');
const win = readJson('v2/evidence/windows/window_report.v2.json');
const records = [];
const save = (cv, name, note) => {
  const f = path.join(OUT, name), meta = cv.png(f);
  const rec = { ...meta, file: `v2/evidence/views/${name}`, sha256: sha256(readBuf(`v2/evidence/views/${name}`)),
    classification: 'MAP_ANALYTICAL_BEFORE_AFTER_PREVIEW', status: 'TECHNICAL_VIEW__NOT_WEB_RUNTIME_PROOF__NOT_CREATOR_APPROVED_ART', note };
  records.push(rec); return rec;
};
const header = (cv, title, sub) => {
  cv.rect(0, 0, cv.w - 1, 17, [12, 16, 24], 0.9); cv.text(title, 5, 4, [235, 240, 248], 2);
  cv.rect(0, cv.h - 14, cv.w - 1, cv.h - 1, [12, 16, 24], 0.88); cv.text(sub, 5, cv.h - 11, [205, 216, 228], 1);
};
const SURFACE_RGB = [
  [10, 30, 70], [24, 72, 110], [194, 178, 120], [92, 140, 74], [110, 158, 82], [42, 96, 58],
  [76, 110, 96], [128, 116, 88], [96, 88, 80], [210, 220, 226], [78, 70, 72], [110, 130, 60],
  [160, 142, 110], [200, 168, 110], [150, 140, 130], [190, 70, 70], [220, 90, 40], [80, 60, 50],
  [170, 210, 230], [40, 110, 150],
];
const fullBase = (cv, scale = 4) => {
  for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) {
    const i = idx(Math.floor(x / scale), Math.floor(y / scale));
    cv.set(x, y, SURFACE_RGB[D.surface[i]] ?? [40, 40, 40]);
  }
};
// ---------------------------------------------------------------- 1. vertical before/after (8 panels)
{
  const cv = Canvas(1000, 390);
  const pw = 250, ph = 180;
  for (let k = 0; k < vertical.corrections.length; k++) {
    const c = vertical.corrections[k], ox = (k % 4) * pw, oy = Math.floor(k / 4) * ph;
    const cc = c.correctedCandidate;
    const bb = cc?.overlapBBoxAu ?? [c.previousFailure.atAu[0] - 20, c.previousFailure.atAu[1] - 20, c.previousFailure.atAu[0] + 20, c.previousFailure.atAu[1] + 20];
    const span = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * 1.6;
    const mid = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
    const P = (p) => [ox + pw / 2 + (p[0] - mid[0]) / span * 200, oy + ph / 2 + (p[1] - mid[1]) / span * 140];
    cv.rect(ox, oy, ox + pw - 1, oy + ph - 1, [22, 27, 36], 1);
    for (const s of architecture.pois.find(p => p.poiId === c.poiId)?.staticSolids ?? []) cv.line(...P(s.aAu), ...P(s.bAu), [110, 118, 132], 2, 0.8);
    if (cc) {
      cv.poly(cc.groundRoomPolygonAu.map(P), [90, 150, 220], 2, 0.85);
      cv.poly(cc.deepLevelPolygonAu.map(P), [160, 110, 210], 2, 0.85);
      cv.poly(cc.shaftPolygonAu.map(P), [70, 235, 130], 2, 1);
      for (const o of [c.checks?.groundBoundaryOpening, c.checks?.deepBoundaryOpening]) if (o) cv.line(...P(o.openingSegmentAu[0]), ...P(o.openingSegmentAu[1]), [250, 210, 80], 3, 1);
      cv.circle(...P(cc.stairRunAu[1]), 3, [250, 210, 80], 1, 1);
    }
    cv.circle(...P(c.previousFailure.atAu), 4, [240, 70, 70], 2, 1);   // canonical portal UNCHANGED
    cv.text(`${c.poiId} ${cc?.status ?? 'BLOCKED'}`, ox + 5, oy + 22, [235, 240, 248], 1);
    cv.text('RED=canonical (unchanged) GREEN=corrected shaft', ox + 5, oy + ph - 22, [190, 200, 215], 1);
  }
  header(cv, 'WMP-02 VERTICAL LINK BEFORE/AFTER / 8 EXACT IDs', 'ANALYTICAL PREVIEW / canonical portals NEVER moved / NOT Web render');
  save(cv, 'v2_vertical_before_after.png', '8 panels: blue=ground room, purple=DEEP level, red=original canonical portal (unchanged), green=measured corrected shaft, yellow=boundary openings and DEEP centroid.');
}
// ---------------------------------------------------------------- 2. bridge decks full world
{
  const cv = Canvas(1000, 700); fullBase(cv);
  for (let cx = 1; cx < CHUNKS_X; cx++) cv.line(cx * 100, 0, cx * 100, 699, [255, 255, 255], 1, 0.22);
  for (let cy = 1; cy < CHUNKS_Y; cy++) cv.line(0, cy * 100, 999, cy * 100, [255, 255, 255], 1, 0.22);
  for (const b of transport.bridgeDecks) {
    const col = b.connectivity.status === 'VERIFIED_GEOMETRY__BRIDGE_CONNECTS_DRY_LAND' ? [70, 235, 130]
      : b.connectivity.status.includes('BLOCKED') ? [240, 70, 70] : [250, 200, 80];
    cv.poly(b.proposedDeck.deckPolygonAu.map(p => [p[0] / 2, p[1] / 2]), col, 2, 1);
    cv.circle(b.atAu[0] / 2, b.atAu[1] / 2, 3, col, 1, 1);
    cv.text(b.bridgeId, b.atAu[0] / 2 + 4, b.atAu[1] / 2 - 4, [255, 255, 255], 1);
  }
  header(cv, 'WMP-02 12 MEASURED BRIDGE DECKS / 2000X1400 AU', 'GREEN=verified dry-land connector AMBER=proposed RED=blocked / cartPassability UNRESOLVED');
  save(cv, 'v2_bridge_decks_full.png', '12 proposed non-canonical deck polygons from measured wet chord + dry bearing cells. No approved cart passability.');
}
// ---------------------------------------------------------------- 3. build envelopes LR02 vs v1 vs v2
{
  const cv = Canvas(1000, 700); fullBase(cv);
  for (const s of buildSites.sites) {
    const bb = s.physicalEnvelopeAu;
    for (const i of s.recomputed.largestConnectedDryCellIndices) { const c = centreAu(i); cv.rect(c[0] / 2 - 1, c[1] / 2 - 1, c[0] / 2 + 1, c[1] / 2 + 1, [70, 235, 130], 0.62); }
    for (const i of s.recomputed.waterCellIndices) { const c = centreAu(i); cv.rect(c[0] / 2 - 1, c[1] / 2 - 1, c[0] / 2 + 1, c[1] / 2 + 1, [240, 70, 70], 0.9); }
    cv.poly([[bb[0] / 2, bb[1] / 2], [bb[2] / 2, bb[1] / 2], [bb[2] / 2, bb[3] / 2], [bb[0] / 2, bb[3] / 2]], [250, 210, 80], 1, 0.95);
  }
  header(cv, 'WMP-02 23 BUILD ENVELOPES / LR02-IDENTICAL CRITERION', 'GREEN=largest connected DRY subset RED=authored water AMBER=physical envelope / v1 12 overlaps -> 9');
  save(cv, 'v2_build_envelopes.png', 'Recomputed with the exact LR02 M2 criterion. 3 v1 false-positive IDs eliminated: site.bz_silver, site.bz_dune, site.bz_cinder.');
}
// ---------------------------------------------------------------- 4..6 normalized environment rasters
for (const [name, file, title] of [
  ['v2_env_moisture.png', 'moisturePotentialNorm.u8', 'NORMALIZED MOISTURE POTENTIAL'],
  ['v2_env_temperature.png', 'temperaturePotentialNorm.u8', 'NORMALIZED THERMAL POTENTIAL'],
  ['v2_env_soil.png', 'soilSuitabilityNorm.u8', 'NORMALIZED SOIL SUITABILITY'],
]) {
  const a = new Uint8Array(readBuf(`v2/rasters/${file}`));
  const cv = Canvas(1000, 700);
  for (let y = 0; y < 700; y++) for (let x = 0; x < 1000; x++) {
    const v = a[idx(Math.floor(x / 4), Math.floor(y / 4))];
    cv.set(x, y, [Math.round(v * 0.35), Math.round(v * 0.75), Math.round(255 - v * 0.55)]);
  }
  for (let cx = 1; cx < CHUNKS_X; cx++) cv.line(cx * 100, 0, cx * 100, 699, [255, 255, 255], 1, 0.2);
  header(cv, `WMP-02 ${title} / 0..255`, 'PROPOSED DIMENSIONLESS POTENTIAL / NOT degrees / NOT weather rate / NOT crop yield');
  save(cv, name, `${title}: reproducible weighted combination of elevation, canopy, water proximity, drainage, substrate, exposure and v1 climatic ordinals. No numeric Gameplay rate.`);
}
// ---------------------------------------------------------------- 7. adjacent spatial windows
{
  const cv = Canvas(1000, 700);
  const west = new Uint8Array(readBuf('v2/evidence/windows/wmp.v2.window.west.125x175/road.u8'));
  const east = new Uint8Array(readBuf('v2/evidence/windows/wmp.v2.window.east.125x175/road.u8'));
  for (let y = 0; y < 175; y++) for (let x = 0; x < 125; x++) {
    const wx = 250 + x * 2, ex = 500 + x * 2, py = 30 + y * 2;
    for (let d = 0; d < 2; d++) for (let e = 0; e < 2; e++) {
      cv.set(wx + d, py + e, west[y * 125 + x] ? [250, 200, 80] : [28, 40, 56]);
      cv.set(ex + d, py + e, east[y * 125 + x] ? [80, 220, 160] : [28, 40, 56]);
    }
  }
  cv.line(499, 30, 499, 379, [255, 90, 90], 2, 1);
  cv.text('WEST 125x175', 255, 20, [235, 240, 248], 2); cv.text('EAST 125x175', 505, 20, [235, 240, 248], 2);
  cv.text('DISJOINT GLOBAL TILES / UNION 43750 CELLS / 18 MASKS EACH', 255, 400, [200, 215, 230], 2);
  cv.text('v1 projectWindow(): 5 masks (tiles/fresh/zone/seaDist/land) - NOT a complete EconomyMap', 255, 430, [240, 180, 120], 1);
  cv.text('v2 projectWindowV2(): 18 masks including all 13 EconomyMap fields + authored layers', 255, 450, [140, 230, 170], 1);
  cv.text('TECHNICAL WINDOW DIAGRAM - NOT PLAYABLE WEB / NOT VISUAL ACCEPTANCE', 255, 670, [190, 200, 215], 1);
  save(cv, 'v2_windows_adjacent.png', 'West/east window road masks on disjoint global tile ranges; union covers all 43750 source cells with zero duplicates.');
}
// ---------------------------------------------------------------- 8. roof inset corrections (sample)
{
  const cv = Canvas(1000, 700);
  const sample = roofs.assessments.filter(r => r.correctedCandidate).slice(0, 6);
  for (let k = 0; k < sample.length; k++) {
    const r = sample[k], ox = (k % 3) * 333, oy = Math.floor(k / 3) * 350;
    const rm = architecture.pois.find(p => p.poiId === r.poiId).rooms.find(x => x.id === r.parentRoomId);
    const bb = rm.bboxAu, span = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * 1.4, mid = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
    const P = (p) => [ox + 165 + (p[0] - mid[0]) / span * 260, oy + 175 + (p[1] - mid[1]) / span * 260];
    cv.rect(ox, oy, ox + 332, oy + 349, [22, 27, 36], 1);
    cv.poly(rm.polygonAu.map(P), [110, 150, 210], 2, 0.9);
    cv.poly(r.correctedCandidate.polygonAu.map(P), [70, 235, 130], 2, 1);
    cv.text(`${r.roofId}`, ox + 5, oy + 5, [235, 240, 248], 1);
    cv.text(`inset=${r.correctedCandidate.insetFactor}`, ox + 5, oy + 20, [200, 215, 230], 1);
    cv.text('BLUE=source room GREEN=corrected inset', ox + 5, oy + 335, [190, 200, 215], 1);
  }
  header(cv, 'WMP-02 ROOF INSET CORRECTIONS / 99 OF 153 WITH NAMED DEFECTS', 'ANALYTICAL PREVIEW / source polygon clipping is NOT automatic roof completion');
  save(cv, 'v2_roof_corrections.png', 'Corrected roof polygons are the largest source-room inset whose vertices are strictly inside the room and whose interior excludes static-wall midpoints.');
}
writeJson('v2/evidence/views/index_v2.json', {
  schema: 'soh.wmp.v2.technical_views.v1', authority: W._internal.manifest.authority ?? 'MAP',
  status: 'TECHNICAL_ANALYTICAL_PREVIEWS__NOT_WEB_RUNTIME_PROOF__NOT_CREATOR_APPROVED_ART',
  count: records.length, views: records,
  v1ViewsPreserved: 'evidence/views/ (15 analytical PNGs) unchanged; v2 adds a separate set.',
  noClaims: ['NO playable Web', 'NO visual acceptance', 'NO art approval'],
});
console.log(`WMP_V2_VIEWS_OK analytical=${records.length} classification=TECHNICAL_PREVIEW_NOT_WEB_RENDER`);
function writeJson(rel, obj) {
  const p = path.join(MASTER, rel); fs.mkdirSync(path.dirname(p), { recursive: true });
  const b = Buffer.from(JSON.stringify(obj, null, 2) + '\n'); fs.writeFileSync(p, b);
  return { file: rel, bytes: b.length, sha256: sha256(b) };
}
