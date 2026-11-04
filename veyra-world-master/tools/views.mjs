#!/usr/bin/env node
// WMP-01 technical views. DETERMINISTIC, CLEAN-ROOM, data/ + layers/ + rasters/ only.
// These are MAP ANALYTICAL VIEWS, not art direction and not Web runtime proof.
// Real Web runtime captures are preserved byte-for-byte and classified separately.
import fs from 'node:fs';
import path from 'node:path';
import { MASTER, EVIDENCE, GW, GH, CELL, CHUNK_AU, CHUNKS_X, CHUNKS_Y, readJson, readBuf, sha256, r4, idx, toCell, pointInRing } from '../lib/wmp.mjs';
import { createWorld } from '../api/world.mjs';
import { Canvas } from './png.mjs';

const W = createWorld();
const { S, D, C, architecture, hydrology, chunks, transport, resources, envelopes, scales } = W._internal;
const VIEWS = path.join(EVIDENCE, 'views');
fs.mkdirSync(VIEWS, { recursive: true });
const records = [];
const save = (cv, name, kind, note) => {
  const f = path.join(VIEWS, name);
  const meta = cv.png(f);
  const rec = { file: `evidence/views/${name}`, ...meta, sha256: sha256(readBuf(`evidence/views/${name}`)), classification: kind, status: 'MAP_ANALYTICAL_VIEW__NOT_WEB_RUNTIME_PROOF', note };
  records.push(rec); return rec;
};
const SURFACE_RGB = [
  [10, 30, 70], [24, 72, 110], [194, 178, 120], [92, 140, 74], [110, 158, 82], [42, 96, 58],
  [76, 110, 96], [128, 116, 88], [96, 88, 80], [210, 220, 226], [78, 70, 72], [110, 130, 60],
  [160, 142, 110], [200, 168, 110], [150, 140, 130], [190, 70, 70], [220, 90, 40], [80, 60, 50],
  [170, 210, 230], [40, 110, 150],
];
const header = (cv, title, sub) => {
  cv.rect(0, 0, cv.w - 1, 17, [12, 16, 24], 0.88);
  cv.text(title, 5, 4, [235, 240, 248], 2);
  cv.rect(0, cv.h - 14, cv.w - 1, cv.h - 1, [12, 16, 24], 0.86);
  cv.text(sub, 5, cv.h - 11, [205, 216, 228], 1);
};
const inBB = (p, bb) => p[0] >= bb[0] && p[0] <= bb[2] && p[1] >= bb[1] && p[1] <= bb[3];

// ---------------------------------------------------------------- FULL WORLD (1000x700)
function fullWorld(name, title, sub, colour, overlays) {
  const cv = Canvas(1000, 700);
  for (let y = 0; y < 700; y++) for (let x = 0; x < 1000; x++) {
    const i = idx(Math.floor(x / 4), Math.floor(y / 4));
    cv.set(x, y, colour(i, x, y));
  }
  overlays?.(cv);
  header(cv, title, sub);
  return save(cv, name, 'FULL_WORLD_ANALYTICAL', `${title}. 250x175 authored grid at 4px per 8au cell; not an art-direction tileset.`);
}
fullWorld('world_terrain_full.png', 'VEYRA PHYSICAL SURFACE / 2000X1400 AU',
  'MAP ANALYTICAL / WEB T CODES / CHUNK GRID / NOT WEB RENDER PROOF',
  i => SURFACE_RGB[D.surface[i]] ?? [40, 40, 40],
  cv => {
    for (let cx = 1; cx < CHUNKS_X; cx++) cv.line(cx * 100, 0, cx * 100, 699, [255, 255, 255], 1, 0.28);
    for (let cy = 1; cy < CHUNKS_Y; cy++) cv.line(0, cy * 100, 999, cy * 100, [255, 255, 255], 1, 0.28);
    for (const p of C.pois) cv.circle(Math.floor(p.at[0] / 2), Math.floor(p.at[1] / 2), 2, [255, 232, 120], 1, 0.9);
    cv.text('2000 AU', 900, 680, [255, 255, 255], 1);
  });
fullWorld('world_elevation_slope_full.png', 'RAW ELEVATION BYTE + SLOPE ORDINAL',
  'MAP ANALYTICAL / RAW BYTES ARE NOT METRES OR DEGREES',
  i => { const e = S.elevation[i], s = D.slopeClass[i]; return [Math.min(255, e + s * 12), Math.min(255, 40 + e), Math.max(20, 200 - s * 34)]; },
  cv => { for (let cx = 1; cx < CHUNKS_X; cx++) cv.line(cx * 100, 0, cx * 100, 699, [255, 255, 255], 1, 0.2); });
fullWorld('world_water_transport_full.png', 'WATER / ROADS / BRIDGES / DOCKS / POIS',
  'MAP ANALYTICAL / AUTHORED CENTRELINES / WIDTH UNRESOLVED',
  i => SURFACE_RGB[D.surface[i]] ?? [30, 34, 40],
  cv => {
    for (const r of C.rivers) for (let k = 1; k < r.points.length; k++) cv.line(r.points[k - 1][0] / 2, r.points[k - 1][1] / 2, r.points[k][0] / 2, r.points[k][1] / 2, [30, 150, 220], 2, 0.85);
    for (const r of C.roads) for (let k = 1; k < r.points.length; k++) cv.line(r.points[k - 1][0] / 2, r.points[k - 1][1] / 2, r.points[k][0] / 2, r.points[k][1] / 2, r.kind === 'cart' ? [240, 220, 170] : [170, 160, 145], 1, 0.8);
    for (const b of C.bridges) cv.circle(b.at[0] / 2, b.at[1] / 2, 4, [255, 90, 90], 2);
    for (const d of C.docks) cv.rect(d.at[0] / 2 - 2, d.at[1] / 2 - 2, d.at[0] / 2 + 2, d.at[1] / 2 + 2, [120, 240, 220]);
    for (const p of C.pois) cv.circle(p.at[0] / 2, p.at[1] / 2, 2, [255, 232, 120]);
  });
fullWorld('world_climate_regions_full.png', 'STATIC CLIMATE POTENTIAL REGIONS',
  'MAP ANALYTICAL / CATEGORICAL POTENTIAL ONLY / NO TEMPERATURE OR DAMAGE RATES',
  i => { const g = Math.floor(D.climateRegion[i] / 10), h = D.climateRegion[i] % 10; return [(g * 19) % 256, (g * 41 + h * 6) % 256, (g * 73) % 256]; });
fullWorld('world_chunks_full.png', '70 CHUNKS / 25X25 CELLS / STABLE FEATURE IDS',
  'MAP ANALYTICAL / CHUNK BOUNDARIES ARE INDEXING ONLY / GEOMETRY IS CONTINUOUS',
  i => { const cx = Math.floor((i % GW) / 25), cy = Math.floor(Math.floor(i / GW) / 25); return [30 + (cx * 37) % 200, 30 + (cy * 53) % 200, 40 + ((cx + cy) * 29) % 200]; },
  cv => {
    for (let cx = 1; cx < CHUNKS_X; cx++) cv.line(cx * 100, 0, cx * 100, 699, [255, 255, 255], 2, 0.7);
    for (let cy = 1; cy < CHUNKS_Y; cy++) cv.line(0, cy * 100, 999, cy * 100, [255, 255, 255], 2, 0.7);
    for (let cy = 0; cy < CHUNKS_Y; cy++) for (let cx = 0; cx < CHUNKS_X; cx++) cv.text(`${cx}.${cy}`, cx * 100 + 4, cy * 100 + 4, [255, 255, 255], 1);
  });
fullWorld('world_resources_zones_full.png', '280 HABITAT MARKERS / 23 ZONES / 6 ELDERS',
  'MAP ANALYTICAL / CANDIDATE OPPORTUNITIES / NO LOOT STOCK OR YIELD',
  i => SURFACE_RGB[D.surface[i]] ?? [30, 34, 40],
  cv => {
    for (const z of C.zones) cv.poly(z.ring.map(p => [p[0] / 2, p[1] / 2]), [255, 190, 90], 1, 0.7);
    for (const e of C.elders) { cv.poly(e.outer.map(p => [p[0] / 2, p[1] / 2]), [235, 90, 200], 2, 0.9); cv.poly(e.core.map(p => [p[0] / 2, p[1] / 2]), [255, 170, 240], 2, 0.9); }
    for (const m of C.resources) cv.circle(m.at[0] / 2, m.at[1] / 2, 1, [120, 255, 160]);
  });

// ---------------------------------------------------------------- DETAIL VIEWS (640x360)
function detail(name, title, bb, sub, overlays) {
  const cv = Canvas(640, 360);
  const sx = 640 / (bb[2] - bb[0]), sy = 360 / (bb[3] - bb[1]);
  const M = p => [(p[0] - bb[0]) * sx, (p[1] - bb[1]) * sy];
  for (let y = 0; y < 360; y++) for (let x = 0; x < 640; x++) {
    const ax = bb[0] + x / sx, ay = bb[1] + y / sy, i = toCell(ax, ay);
    const c = SURFACE_RGB[D.surface[i]] ?? [30, 34, 40];
    cv.set(x, y, [Math.round(c[0] * 0.82), Math.round(c[1] * 0.82), Math.round(c[2] * 0.82)]);
  }
  // chunk boundary reference (if any)
  for (let cx = 1; cx < CHUNKS_X; cx++) { const x = (cx * CHUNK_AU - bb[0]) * sx; if (x > 0 && x < 640) cv.line(x, 0, x, 359, [255, 255, 255], 1, 0.22); }
  for (let cy = 1; cy < CHUNKS_Y; cy++) { const y = (cy * CHUNK_AU - bb[1]) * sy; if (y > 0 && y < 360) cv.line(0, y, 639, y, [255, 255, 255], 1, 0.22); }
  // authored water/transport centrelines within window
  for (const r of C.rivers) for (let k = 1; k < r.points.length; k++) if (inBB(r.points[k], bb) || inBB(r.points[k - 1], bb)) cv.line(...M(r.points[k - 1]), ...M(r.points[k]), [30, 160, 230], 2, 0.75);
  for (const r of C.roads) for (let k = 1; k < r.points.length; k++) if (inBB(r.points[k], bb) || inBB(r.points[k - 1], bb)) cv.line(...M(r.points[k - 1]), ...M(r.points[k]), r.kind === 'cart' ? [240, 220, 170] : [180, 172, 158], 1, 0.7);
  overlays?.(cv, M);
  header(cv, title, sub);
  return save(cv, name, 'DETAIL_ANALYTICAL', `${title}. ${sub}`);
}
const poiDetail = (poiId, name, span = 160) => {
  const p = architecture.pois.find(x => x.poiId === poiId);
  if (!p) throw new Error(`MISSING_POI ${poiId}`);
  const cx = p.atAu[0], cy = p.atAu[1], bb = [cx - span / 2, cy - span * 9 / 32, cx + span / 2, cy + span * 9 / 32];
  const gold = C.pois.find(g => g.id === poiId);
  detail(name, `POI ${poiId.toUpperCase()} / ${p.arche.toUpperCase()}`, bb,
    `ROOMS ${p.roomCount} ROOFS ${p.roofPolygonCount} OPENINGS ${p.staticOpenings.length} VERTICAL ${architecture.verticalLinks.filter(v => v.poiId === poiId).length}`,
    (cv, M) => {
      if (gold?.foot) cv.poly(gold.foot.map(M), [255, 226, 110], 2, 0.95);
      if (gold?.deep) { cv.fillPoly(gold.deep.map(M), [150, 90, 220], 0.16); cv.poly(gold.deep.map(M), [180, 120, 250], 2, 0.9); }
      for (const rm of p.rooms) cv.poly(rm.polygonAu.map(M), [90, 210, 235], 1, 0.8);
      for (const rf of p.roofPolygons) { cv.fillPoly(rf.polygonAu.map(M), [245, 165, 60], 0.3); cv.poly(rf.polygonAu.map(M), [255, 190, 80], 1, 0.9); }
      for (const s of p.staticSolids) cv.line(...M(s.aAu), ...M(s.bAu), [240, 70, 70], 2, 0.95);
      for (const o of p.staticOpenings) { cv.line(...M(o.aAu), ...M(o.bAu), [90, 245, 130], 2, 0.95); cv.circle(...M(o.centreAu), 3, [120, 255, 160], 1); }
      for (const v of architecture.verticalLinks.filter(x => x.poiId === poiId)) {
        cv.circle(...M(v.atAu), 5, [255, 100, 220], 2);
        if (v.resolution?.shaftPolygonAu) { cv.fillPoly(v.resolution.shaftPolygonAu.map(M), [255, 80, 220], 0.4); cv.poly(v.resolution.shaftPolygonAu.map(M), [255, 140, 240], 2); }
        if (v.resolution?.stairRunAu) cv.line(...M(v.resolution.stairRunAu[0]), ...M(v.resolution.stairRunAu[1]), [255, 140, 240], 1, 0.9);
      }
      cv.circle(...M(p.atAu), 3, [255, 255, 255], 1);
    });
};
poiDetail('po_greywater', 'detail_po_greywater.png', 170);
poiDetail('po_academy', 'detail_po_academy.png', 150);
poiDetail('po_kilns', 'detail_po_kilns.png', 170);

// Bridge BR-4 contradiction detail
const br4 = C.bridges.find(b => b.id === 'br_4');
const br4bb = [br4.at[0] - 100, br4.at[1] - 56.25, br4.at[0] + 100, br4.at[1] + 56.25];
detail('detail_br4_crossing.png', 'BRIDGE BR_4 / RIVER-CROSSING CONTRADICTION', br4bb,
  'CLEARANCE 0 / WATER 3 / ROAD 1 / ELDER GEOMETRY / NO CART PASSABILITY',
  (cv, M) => {
    for (const r of C.rivers) for (let k = 1; k < r.points.length; k++) cv.line(...M(r.points[k - 1]), ...M(r.points[k]), [40, 170, 240], 3, 0.9);
    for (const r of C.roads) for (let k = 1; k < r.points.length; k++) cv.line(...M(r.points[k - 1]), ...M(r.points[k]), [245, 225, 170], 2, 0.9);
    for (const e of C.elders) if (e.outer.some(p => inBB(p, br4bb))) cv.poly(e.outer.map(M), [235, 90, 200], 2, 0.8);
    for (const b of C.bridges) if (inBB(b.at, br4bb)) cv.circle(...M(b.at), 6, [255, 90, 90], 2);
    const a = WAproposed();
    if (a) { cv.fillPoly(a.deckPolygonAu.map(M), [255, 180, 60], 0.35); cv.poly(a.deckPolygonAu.map(M), [255, 200, 90], 2); }
    cv.text('BLOCKED', 8, 26, [255, 120, 120], 2);
  });
function WAproposed() { return readJson('layers/transport.v1.json').bridges.find(b => b.id === 'br_4')?.proposedGeometry?.deckPolygonAu ? { deckPolygonAu: readJson('layers/transport.v1.json').bridges.find(b => b.id === 'br_4').proposedGeometry.deckPolygonAu } : null; }

// Build envelope / water overlap detail
const env = envelopes.buildEnvelopes.sites.find(e => e.waterOverlapCellCount > 0) ?? envelopes.buildEnvelopes.sites[0];
const envbb = [env.physicalEnvelopeAu[0] - 45, env.physicalEnvelopeAu[1] - 25, env.physicalEnvelopeAu[2] + 45, env.physicalEnvelopeAu[3] + 25];
detail('detail_build_envelope_water_overlap.png', `BUILD ENVELOPE ${env.siteId.toUpperCase()}`, envbb,
  `DRY ${env.dryCellCount} / WATER OVERLAP ${env.waterOverlapCellCount} / CLAIMS GAMEPLAY OWNED`,
  (cv, M) => {
    cv.poly([[env.physicalEnvelopeAu[0], env.physicalEnvelopeAu[1]], [env.physicalEnvelopeAu[2], env.physicalEnvelopeAu[1]], [env.physicalEnvelopeAu[2], env.physicalEnvelopeAu[3]], [env.physicalEnvelopeAu[0], env.physicalEnvelopeAu[3]]].map(M), [255, 220, 100], 2);
    for (const i of env.dryCellIndices) cv.circle(...M([(i % GW + 0.5) * CELL, (Math.floor(i / GW) + 0.5) * CELL]), 1, [110, 230, 140]);
    for (const i of env.waterOverlapCellIndices) cv.circle(...M([(i % GW + 0.5) * CELL, (Math.floor(i / GW) + 0.5) * CELL]), 2, [255, 100, 100]);
  });

// Elder territories detail (full frame at 640x360)
(() => {
  const cv = Canvas(640, 360), sx = 640 / 2000, sy = 360 / 1400, M = p => [p[0] * sx, p[1] * sy];
  for (let y = 0; y < 360; y++) for (let x = 0; x < 640; x++) { const i = toCell(x / sx, y / sy), c = SURFACE_RGB[D.surface[i]] ?? [30, 34, 40]; cv.set(x, y, [Math.round(c[0] * 0.7), Math.round(c[1] * 0.7), Math.round(c[2] * 0.7)]); }
  const cols = [[255, 90, 160], [255, 170, 60], [120, 240, 130], [90, 190, 255], [200, 120, 255], [255, 230, 100]];
  C.elders.forEach((e, k) => { cv.fillPoly(e.outer.map(M), cols[k], 0.22); cv.poly(e.outer.map(M), cols[k], 2, 0.95); cv.poly(e.core.map(M), cols[k], 2, 0.9); cv.text(e.id.replace('el_', '').toUpperCase(), ...M(e.approach?.[0] ?? e.core[0]), cols[k], 1); });
  header(cv, 'SIX DISTINCT ELDER TERRITORIES / OUTER CORE APPROACH', 'MAP ANALYTICAL / NO SPAWN COUNTS OR RAID PERCENTAGES');
  save(cv, 'detail_elder_territories.png', 'DETAIL_ANALYTICAL', 'Six authored distinct Elder territories with outer/core/approach geometry; no uniform regions or spawn counts.');
})();

// ---------------------------------------------------------------- SCALE COMPARISON (640x360 each)
for (const prof of scales.profiles.filter(p => p.unitsPerTileAu === 1.6 || p.unitsPerTileAu === 2.0 || p.unitsPerTileAu === 2.5)) {
  const U = prof.unitsPerTileAu, gwPoi = C.pois.find(p => p.id === 'po_greywater');
  const camAu = [40 * U, 22.5 * U], bb = [gwPoi.at[0] - camAu[0] / 2, gwPoi.at[1] - camAu[1] / 2, gwPoi.at[0] + camAu[0] / 2, gwPoi.at[1] + camAu[1] / 2];
  const cv = Canvas(640, 360), sx = 640 / (bb[2] - bb[0]), sy = 360 / (bb[3] - bb[1]), M = p => [(p[0] - bb[0]) * sx, (p[1] - bb[1]) * sy];
  for (let y = 0; y < 360; y++) for (let x = 0; x < 640; x++) { const i = toCell(bb[0] + x / sx, bb[1] + y / sy), c = SURFACE_RGB[D.surface[i]] ?? [30, 34, 40]; cv.set(x, y, c); }
  const p = architecture.pois.find(x => x.poiId === 'po_greywater');
  for (const rm of p.rooms) cv.poly(rm.polygonAu.map(M), [90, 210, 235], 1, 0.75);
  for (const rf of p.roofPolygons) cv.fillPoly(rf.polygonAu.map(M), [245, 165, 60], 0.28);
  for (const s of p.staticSolids) cv.line(...M(s.aAu), ...M(s.bAu), [240, 70, 70], 2, 0.95);
  for (const o of p.staticOpenings) cv.line(...M(o.aAu), ...M(o.bAu), [90, 245, 130], 2, 0.95);
  // 16px tile grid overlay (native 1x pixel scale)
  for (let x = 0; x < 640; x += 16) cv.line(x, 0, x, 359, [255, 255, 255], 1, 0.12);
  for (let y = 0; y < 360; y += 16) cv.line(0, y, 639, y, [255, 255, 255], 1, 0.12);
  header(cv, `SCALE U=${U} / 640X360 NATIVE 1X / DIAGNOSTIC`, `OPENING ${prof.poi.openingPx}PX / WALL ${prof.poi.wallPx}PX / WORLD ${prof.worldTiles.join('X')} TILES / NOT APPROVED CANON`);
  save(cv, `scale_${prof.id.replace('scale.', '')}_camera.png`, 'SCALE_DIAGNOSTIC', `Diagnostic U=${U} scale profile; 640x360 1x camera; not approved canon.`);
}

// ---------------------------------------------------------------- REAL WEB CAPTURES (byte-preserved)
const webSrc = path.join(MASTER, 'data/evidence/web_real');
const webOut = path.join(EVIDENCE, 'web_real');
fs.mkdirSync(webOut, { recursive: true });
const webRecords = [];
for (const f of fs.readdirSync(webSrc).filter(x => x.endsWith('.png')).sort()) {
  const b = fs.readFileSync(path.join(webSrc, f)); fs.writeFileSync(path.join(webOut, f), b);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  webRecords.push({ file: `evidence/web_real/${f}`, bytes: b.length, sha256: sha256(b), width: w, height: h, classification: 'REAL_WEB_RUNTIME_CAPTURE', source: 'Gameplay LR02 M4 byte-preserved evidence', status: 'ACTUAL_WEB_RENDERED_INTEGRATION_PROOF=NOT_AVAILABLE__GAMEPLAY_OWNED', note: 'These are genuine Web runtime captures, NOT Map analytical views. They do not prove WMP layer ingestion.' });
}
const webIndex = { schema: 'soh.wmp.web_captures_index.v1', status: 'REAL_WEB_CAPTURES_CLASSIFIED_SEPARATELY', authority: W.manifest.status, count: webRecords.length, captures: webRecords, actualWebRenderedIntegrationProof: 'NOT_AVAILABLE__GAMEPLAY_OWNED' };
fs.writeFileSync(path.join(EVIDENCE, 'web_captures_index.v1.json'), JSON.stringify(webIndex, null, 2) + '\n');

const index = {
  schema: 'soh.wmp.views_index.v1', status: 'MAP_ANALYTICAL_VIEWS__NOT_VISUAL_APPROVAL', authority: 'MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT',
  masterRevisionDigest: W.manifest.revisionDigest,
  classification: { MAP_ANALYTICAL_VIEW: 'Generated here from physical rasters + authored vector geometry. Schematic/technical, NOT a Web render, NOT art direction.', SCALE_DIAGNOSTIC: 'Diagnostic camera comparison at U=1.6/2.0/2.5.', REAL_WEB_RUNTIME_CAPTURE: 'Byte-preserved genuine Web runtime capture from Gameplay LR02 M4, classified in evidence/web_captures_index.v1.json.' },
  views: records, analyticalViewCount: records.length, realWebCaptureCount: webRecords.length,
  noClaims: ['NO VISUAL_ACCEPTED', 'NO creator visual approval', 'NO new art-direction exercise', 'NO unverified replacement tileset', 'NO Web-rendered WMP integration proof'],
};
fs.writeFileSync(path.join(VIEWS, 'views_index.v1.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`WMP_VIEWS_OK analytical=${records.length} realWebCaptures=${webRecords.length} fullWorld=6 detail=6 scale=3`);
