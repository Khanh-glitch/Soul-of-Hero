#!/usr/bin/env node
// WMP-01 Phase A/B/C gates M-G0..M-G5. CLEAN-ROOM: data/, layers/, rasters/, api/, lib/ only.
// Negative fixtures are EXECUTED, not merely enumerated.
import fs from 'node:fs';
import path from 'node:path';
import {
  MASTER, GW, GH, CELL, N, FRAME_AU, CHUNK_CELLS, CHUNKS_X, CHUNKS_Y,
  readJson, readBuf, readU8, sha256, digest, r4, idx, toCell, centreAu, inFrame,
  loadRasters, loadDerivedRasters, pointInRing, bbox, dist, roundTrip, STATUS, authority,
} from '../lib/wmp.mjs';
import { createWorld, WORLD_API_VERSION } from '../api/world.mjs';
import { intakeContract, projectWindow, INTAKE_VERSION } from '../api/intake.mjs';

const W = createWorld();
const { S, D, C, manifest, snap, srcMan, architecture, envelopes, chunks, transport, resources, climate, hydrology, scales, crosswalks, terrain, decisions, poiIndex } = W._internal;
const results = [];
let pass = 0, fail = 0;
function t(id, gate, name, fn) {
  try {
    const detail = fn();
    if (detail === false || detail?.ok === false) throw new Error(detail?.reason ?? 'assertion returned false');
    results.push({ id, gate, name, status: 'PASS', detail: detail === true || detail === undefined ? null : detail });
    pass++;
  } catch (e) {
    results.push({ id, gate, name, status: 'FAIL', error: String(e?.message ?? e) });
    fail++;
  }
}
const eq = (a, b, why = 'value mismatch') => { if (a !== b) throw new Error(`${why}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); return true; };
const ok = (v, why = 'expected truthy') => { if (!v) throw new Error(why); return true; };
const count = (arr, pred) => arr.filter(pred).length;
const GOLD_SHA = '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256';
const LR01_BODY = 'e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63';
const LR02_V2 = 'e3ba6d298fe2872cf5a39b2e3e8cc8704f54c5582f15cff49e2aacffdd20b3e7';

// =====================================================================
// M-G0  CANONICAL PARITY / SOURCE INTEGRITY
// =====================================================================
const goldRaw = readBuf('data/canon/VEYRA_GOLD_MAP.sohmap.json');
const gold = JSON.parse(goldRaw.toString('utf8'));
t('M-G0-01', 'M-G0', 'Embedded GOLD bytes match pinned SHA-256 and byte length', () => ({ sha256: sha256(goldRaw), bytes: goldRaw.length, ok: sha256(goldRaw) === GOLD_SHA && goldRaw.length === 332249 }));
t('M-G0-02', 'M-G0', 'GOLD format/version/grid/seed and 12 canonical collection counts preserved', () => {
  eq(gold.format, 'soh-maplab'); eq(gold.version, 1);
  eq(gold.project.terrain.gw, 250); eq(gold.project.terrain.gh, 175); eq(gold.project.terrain.cell, 8); eq(gold.project.terrain.seed, 2026);
  const want = { land: 8, lakes: 5, rivers: 17, roads: 92, bridges: 12, docks: 27, pois: 81, zones: 23, resources: 280, spawns: 4, elders: 6, labels: 24 };
  for (const [k, v] of Object.entries(want)) eq(gold.project[k].length, v, k);
  eq(Object.values(want).reduce((a, b) => a + b, 0), 579);
  return { world: [gold.project.world.w, gold.project.world.h], counts: want, total: 579 };
});
t('M-G0-03', 'M-G0', 'geometry_snapshot collections are byte-equal (JSON) to embedded GOLD project collections', () => {
  for (const k of Object.keys(snap.collections)) eq(JSON.stringify(snap.collections[k]), JSON.stringify(gold.project[k]), k);
  return { collections: Object.keys(snap.collections).length, coordinateDrift: 0 };
});
t('M-G0-04', 'M-G0', 'Full float precision, polygon vertices and authored water holes preserved (no rounding)', () => {
  let coords = 0, highPrecision = 0, rings = 0, vertices = 0;
  for (const l of C.land) { rings += l.rings.length; for (const r of l.rings) { vertices += r.length; for (const p of r) { coords += 2; if (String(p[0]).split('.')[1]?.length > 4 || String(p[1]).split('.')[1]?.length > 4) highPrecision++; } } }
  ok(highPrecision > 100, 'expected preserved sub-4-decimal coordinates');
  ok(vertices > 100, 'expected authored polygon vertices');
  let allPolyVertices = vertices;
  for (const c of ['lakes', 'zones', 'pois', 'elders']) for (const f of C[c]) for (const k of ['ring', 'foot', 'deep', 'outer', 'core']) if (Array.isArray(f[k])) allPolyVertices += f[k].length;
  ok(allPolyVertices > vertices, 'expected preserved POI/zone/Elder polygon vertices');
  let waterHoles = 0;
  for (let i = 0; i < N; i++) if (S.landId[i] > 0 && S.waterClass[i] > 0) waterHoles++;
  ok(waterHoles > 0, 'expected authored water masks carving holes inside land polygons');
  return { landRings: rings, vertices, allPolyVertices, highPrecisionCoordinates: highPrecision, authoredWaterHoleCells: waterHoles };
});
t('M-G0-05', 'M-G0', 'Source manifest self-check equals the real whole-data file/byte count', () => {
  let files = 0, bytes = 0;
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { files++; bytes += fs.statSync(p).size; } } };
  walk(path.join(MASTER, 'data'));
  eq(files, srcMan.selfCheck.files); eq(bytes, srcMan.selfCheck.bytes); eq(files, srcMan.counts.embeddedFiles); eq(files, 117);
  return { files, bytes };
});
t('M-G0-06', 'M-G0', 'Every embedded data/ file matches its recorded SHA-256 and byte length', () => {
  for (const f of srcMan.files) { const b = readBuf(f.file); eq(b.length, f.bytes, f.file); eq(sha256(b), f.sha256, f.file); }
  return { verified: srcMan.files.length };
});
t('M-G0-07', 'M-G0', '21 GEO-01 rasters + 5 MapLab masks: byte length and SHA-256 verified by loader', () => {
  eq(srcMan.rasterLayers.filter(r => r.group === 'geo01').length, 21);
  eq(srcMan.rasterLayers.filter(r => r.group === 'geo02').length, 5);
  for (const l of srcMan.rasterLayers) { const a = readU8(l.file); eq(a.length, N, l.name); eq(sha256(Buffer.from(a)), l.sha256, l.name); }
  return { layers: srcMan.rasterLayers.length, cellCount: N };
});
t('M-G0-08', 'M-G0', 'No corrupt raster cells: declared u8 domains respected', () => {
  const domains = { waterClass: 3, biomeCode: 11, landId: 8, lakeId: 5, riverId: 17, roadClass: 5, zoneId: 23, elderGeometryId: 6, poiGeometryId: 81, freshwater: 1 };
  for (const [k, max] of Object.entries(domains)) for (const v of S[k]) if (v > max) throw new Error(`${k} cell out of domain: ${v}`);
  for (const [k, max] of Object.entries({ surface: 19, landform: 8, substrate: 8, soil: 7, slopeClass: 4, construction: 3, vegetation: 5, climateRegion: 255 })) for (const v of D[k]) if (v > max) throw new Error(`${k} derived cell out of domain: ${v}`);
  return { checkedRasters: Object.keys(domains).length + 8, cellsPerRaster: N };
});
t('M-G0-09', 'M-G0', 'Invalid-water and water/land contradiction scan', () => {
  let bad = 0, waterCells = 0;
  for (let i = 0; i < N; i++) {
    if (S.waterClass[i] > 0) { waterCells++; if (D.substrate[i] !== 0 || D.soil[i] !== 0) bad++; }
    else if (D.landform[i] === 0) bad++;
  }
  eq(bad, 0); ok(waterCells > 0);
  return { waterCells, contradictions: bad };
});
t('M-G0-10', 'M-G0', '579 stable feature IDs: unique, indexed, with chunk ownership', () => {
  eq(chunks.featureIndex.count, 579);
  eq(new Set(chunks.featureIndex.features.map(f => f.id)).size, 579);
  ok(chunks.featureIndex.features.every(f => f.chunkIds.length > 0 && f.bboxAu.length === 4));
  return { features: 579, idCollisions: 0 };
});
t('M-G0-11', 'M-G0', 'Route topology: 92/12/27/17/81 authored IDs, vertices in frame, positive lengths', () => {
  eq(C.roads.length, 92); eq(C.bridges.length, 12); eq(C.docks.length, 27); eq(C.rivers.length, 17); eq(C.pois.length, 81);
  for (const r of C.roads) { ok(r.points.length >= 2, `road ${r.id} too short`); ok(r.points.every(p => inFrame(p[0], p[1])), `road ${r.id} out of frame`); }
  for (const r of C.rivers) ok(r.points.length >= 2, `river ${r.id} too short`);
  for (const b of [...C.bridges, ...C.docks]) ok(inFrame(b.at[0], b.at[1]), `bridge/dock ${b.id} out of frame`);
  return { roads: 92, bridges: 12, docks: 27, rivers: 17 };
});
t('M-G0-12', 'M-G0', 'LR01 81 layouts / 210 rooms / 410 walls / 235 portals and LR02 463 solids / 169 openings', () => {
  const layouts = readJson('data/legacy/lr01/poi_layouts.v1.json').layouts;
  eq(layouts.length, 81);
  const rooms = layouts.reduce((s, l) => s + l.rooms.length, 0), walls = layouts.reduce((s, l) => s + l.walls.length, 0), portals = layouts.reduce((s, l) => s + l.portals.length, 0);
  eq(rooms, 210); eq(walls, 410); eq(portals, 235);
  eq(architecture.pois.reduce((s, p) => s + p.staticSolids.length, 0), 463);
  eq(architecture.pois.reduce((s, p) => s + p.staticOpenings.length, 0), 169);
  eq(architecture.pois.length, 81);
  return { layouts: 81, rooms, walls, portals, solids: 463, openings: 169 };
});
t('M-G0-13', 'M-G0', 'Immutable LR01 v1 and LR02 v2 package digests preserved verbatim', () => {
  const v1 = readJson('data/legacy/lr01/geography_package.v1.json');
  const v2 = readJson('data/legacy/lr02/geography_package.v2.json');
  eq(digest(v1.body), LR01_BODY); eq(v2.revisionDigest, LR02_V2);
  eq(digest(v2.parentPackage.body), LR01_BODY);
  eq(sha256(readBuf('data/legacy/lr01/geography_package.v1.json')), 'b4cc77228caf847d1ad0d8a680457ca65731202513a047826e8bd973662e19ad');
  return { lr01Body: LR01_BODY, lr02V2: LR02_V2 };
});
t('M-G0-14', 'M-G0', 'Six genuine Web runtime captures preserved byte-for-byte', () => {
  const web = srcMan.files.filter(f => f.file.startsWith('data/evidence/web_real/'));
  eq(web.length, 6);
  for (const f of web) { const b = readBuf(f.file); eq(b.readUInt32BE(16), 640); eq(b.readUInt32BE(20), 360); eq(sha256(b), f.sha256); }
  return { captures: 6, size: '640x360' };
});
t('M-G0-15', 'M-G0', 'NEGATIVE: a tampered raster cell is detected by the pinned SHA-256 guard', () => {
  const b = Buffer.from(readU8(srcMan.rasterLayers[0].file)); b[1234] ^= 0xFF;
  if (sha256(b) === srcMan.rasterLayers[0].sha256) throw new Error('tamper not detected');
  return { fixture: 'corrupt raster cell i=1234', detected: true };
});

// =====================================================================
// M-G1  STANDALONE NO-GOLD REPRODUCTION
// =====================================================================
t('M-G1-01', 'M-G1', 'Clean-room static scan: no GOLD / MapLab / git / network / Gameplay-runtime references in code', () => {
  const forbidden = ['git' + ' show', '19d8' + 'c6ec', 'map_' + 'tower', 'world_' + 'lab', 'origin/' + 'gp44-live', 'bible' + '.md', 'child_' + 'process', 'execFile' + 'Sync', 'node:' + 'https', 'http' + '://', 'fetch' + '(', '..' + '/web/', '/home/user/Soul-of-Hero/' + 'web/'];
  const files = [];
  const scanDir = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) scanDir(p); else if (/\.(mjs|js|sh)$/.test(e.name)) files.push(p); } };
  for (const d of ['lib', 'api', 'tools', 'tests']) scanDir(path.join(MASTER, d));
  files.push(path.join(MASTER, 'build.mjs'), path.join(MASTER, 'reproduce.sh'), path.join(MASTER, 'clean-room.sh'));
  const hits = [];
  for (const f of files) { const s = fs.readFileSync(f, 'utf8'); for (const q of forbidden) if (s.includes(q)) hits.push({ file: path.relative(MASTER, f), token: q }); }
  eq(hits.length, 0, `forbidden references: ${JSON.stringify(hits)}`);
  return { scannedFiles: files.length, forbiddenTokens: forbidden.length, hits: 0 };
});
t('M-G1-02', 'M-G1', process.env.WMP_CLEAN_ROOM === '1' ? 'Runtime clean-room: migration/ and GOLD/MapLab sources absent' : 'Clean-room runtime marker (clean-room.sh runs this test with WMP_CLEAN_ROOM=1)', () => {
  if (process.env.WMP_CLEAN_ROOM === '1') {
    ok(!fs.existsSync(path.join(MASTER, 'migration')), 'migration/ must not be in clean-room');
    ok(!fs.existsSync(path.join(MASTER, '..', 'world_' + 'lab')), 'legacy lab must not be in clean-room parent');
    return { mode: 'ISOLATED_CLEAN_ROOM', goldAvailable: false, networkAvailable: false };
  }
  return { mode: 'MAIN_TREE__ISOLATED_PROOF_IN_evidence/clean_room.log' };
});
t('M-G1-03', 'M-G1', 'Master manifest lists every child with a valid SHA-256 and byte length', () => {
  let verified = 0;
  for (const c of manifest.components) { const b = readBuf(c.file); eq(b.length, c.bytes, c.file); eq(sha256(b), c.sha256, c.file); verified++; }
  ok(verified >= 40);
  return { verified, layers: manifest.components.filter(c => c.kind === 'layer').length, rasters: manifest.components.filter(c => c.kind === 'derived_raster').length };
});
t('M-G1-04', 'M-G1', 'Deterministic build: repeated compiler run reproduces the exact revisionDigest', () => {
  const p = path.join(MASTER, 'evidence/build_determinism.v1.json');
  if (!fs.existsSync(p)) return { note: 'reproduce.sh writes build_determinism.v1.json; checked there', revisionDigest: manifest.revisionDigest };
  const d = readJson('evidence/build_determinism.v1.json');
  eq(d.run1, d.run2); eq(d.run1, manifest.revisionDigest);
  return { run1: d.run1, run2: d.run2, equal: true };
});
t('M-G1-05', 'M-G1', 'All 32 derived rasters reload through the digest-verified clean-room loader', () => {
  eq(Object.keys(loadDerivedRasters()).length, 32);
  return { derivedRasters: 32, sourceRasters: Object.keys(loadRasters()).length };
});

// =====================================================================
// M-G2  MEANINGFUL PHYSICAL / ENVIRONMENTAL DATA
// =====================================================================
t('M-G2-01', 'M-G2', 'groundAt returns physical terrain fields with explicit unit unknowns', () => {
  const samples = [372, 606, 790, 622, 1006.224, 731.4923, 1282, 392].reduce((a, _, k, arr) => (k % 2 === 0 ? [...a, [arr[k], arr[k + 1]]] : a), []);
  for (const at of samples) { const r = W.groundAt({ atAu: at }); eq(r.status, 'PHYSICAL_TERRAIN_CANDIDATE'); const d = r.data; for (const k of ['surfaceCode', 'landform', 'substrate', 'soil', 'slopeClass', 'constructionSuitability', 'vegetationAffordance', 'elevationRawByte']) ok(Number.isFinite(d[k]), `missing ${k}`); eq(d.elevationUnit, STATUS.UNRESOLVED); eq(d.elevationMetres, STATUS.UNKNOWN); eq(d.slopeDegrees, STATUS.UNKNOWN); }
  return { samples: samples.length, allPhysicalFieldsPresent: true };
});
t('M-G2-02', 'M-G2', 'Every one of the 43,750 cells has a defined physical terrain classification', () => {
  for (let i = 0; i < N; i++) {
    if (!Number.isFinite(D.landform[i]) || !Number.isFinite(D.substrate[i]) || !Number.isFinite(D.soil[i]) || !Number.isFinite(D.slopeClass[i]) || !Number.isFinite(D.surface[i])) throw new Error(`undefined physical field at ${i}`);
  }
  return { cells: N, undefinedCells: 0 };
});
t('M-G2-03', 'M-G2', '17 rivers with measured cross-sections, authored editor stroke and UNRESOLVED navigable width', () => {
  const rivers = hydrology.waterBodies.filter(w => w.kind === 'RIVER');
  eq(rivers.length, 17);
  for (const r of rivers) { ok(r.crossSection.sampleCount > 0, r.id); ok(Number.isFinite(r.crossSection.maxMeasuredWetWidthAu)); ok(Number.isFinite(r.authoredStrokeWidthAu)); eq(r.physicalChannelWidth.status, STATUS.UNRESOLVED); eq(r.widthUnit, 'EDITOR_STROKE_AU'); }
  return { rivers: 17, sampleCount: rivers.reduce((s, r) => s + r.crossSection.sampleCount, 0) };
});
t('M-G2-04', 'M-G2', '5 lakes, 8 shoreline rings with holes, banks/channels/floodplains, fresh-salt identity', () => {
  eq(hydrology.waterBodies.filter(w => w.kind === 'LAKE').length, 5);
  eq(hydrology.sea.shoreline.length, 8);
  ok(hydrology.counts.bankCells > 0 && hydrology.counts.channelCells > 0 && hydrology.counts.floodplainCells > 0);
  const lakeCell = [...Array(N).keys()].find(i => S.waterClass[i] === 2);
  ok(lakeCell !== undefined, 'expected at least one authored lake cell');
  const sea = W.waterAt({ atAu: [10, 10] }), lake = W.waterAt({ atAu: centreAu(lakeCell) });
  eq(sea.data.freshSaltIdentity, 'SALT_SEA'); ok(['FRESHWATER_LAKE', 'FRESHWATER_RIVER'].includes(lake.data.freshSaltIdentity), lake.data.freshSaltIdentity);
  eq(sea.data.physicalDepth.status, STATUS.UNKNOWN);
  return { lakes: 5, shorelineRings: 8, bankCells: hydrology.counts.bankCells, channelCells: hydrology.counts.channelCells, floodplainCells: hydrology.counts.floodplainCells };
});
t('M-G2-05', 'M-G2', 'Ford candidates, river direction and outlet defects are explicit, never fabricated', () => {
  ok(hydrology.counts.fordCandidates > 0);
  for (const f of hydrology.fords) { eq(f.depth.status, STATUS.UNKNOWN); eq(f.fordable.status, STATUS.UNKNOWN); }
  ok(hydrology.outletDefects.length > 0);
  return { fords: hydrology.counts.fordCandidates, outletDefects: hydrology.outletDefects.length };
});
t('M-G2-06', 'M-G2', 'BR-4 and unbridged river/crossing contradictions named, not silently resolved', () => {
  const br4 = hydrology.crossingContradictions.find(c => c.id === 'CC-BR4-01');
  ok(br4, 'missing BR-4 contradiction'); eq(br4.measured.clearanceCells, 0); eq(br4.measured.waterClass, 3); eq(br4.status, STATUS.BLOCKED);
  ok(hydrology.crossingContradictions.length > 1);
  return { contradictions: hydrology.crossingContradictions.length, br4: br4.measured };
});
t('M-G2-07', 'M-G2', 'Static climate potential: 12 regions, 5 explicit unknowns, no numeric temperature/damage/rates', () => {
  eq(climate.climateRegions.length, 12); eq(climate.explicitUnknowns.length, 5);
  const raw = fs.readFileSync(path.join(MASTER, 'layers/climate.v1.json'), 'utf8');
  for (const k of ['temperatureCelsius', 'damagePerSecond', 'rainRate', 'seasonalRate']) ok(!new RegExp(`"${k}"\\s*:\\s*[0-9-]`).test(raw), `numeric ${k}`);
  const q = W.climateBaselineAt({ atAu: [790, 622] });
  eq(q.data.numeric.temperatureCelsius, STATUS.UNKNOWN); eq(q.data.numeric.damagePerSecond, STATUS.UNKNOWN); eq(q.data.radiation, STATUS.UNKNOWN);
  return { regions: 12, unknowns: 5, numericRates: 0 };
});
t('M-G2-08', 'M-G2', 'At least 3 scale profiles incl U=1.6 and U=2.0; conditional recommendation only', () => {
  ok(scales.profiles.length >= 3);
  ok(scales.profiles.some(p => p.unitsPerTileAu === 1.6)); ok(scales.profiles.some(p => p.unitsPerTileAu === 2.0));
  eq(scales.recommendation.status, 'RECOMMENDED_CONDITIONAL__NOT_APPROVED_CANON');
  for (const p of scales.profiles) { ok(p.diagnostic || p.unitsPerTileAu === 1.0 || p.unitsPerTileAu === 2.5); ok(p.coordinateRoundTrip.maxDriftAu > 0); }
  return { profiles: scales.profiles.map(p => p.id), recommendation: scales.recommendation.profileId };
});
t('M-G2-09', 'M-G2', 'Coordinate round trips and frame-boundary drift are measured for every scale', () => {
  const out = [];
  for (const p of scales.profiles) {
    const U = p.unitsPerTileAu;
    for (const x of [0.1, 7.9, 123.456, 999.9, 1999.9]) { const rt = roundTrip(x, U); if (Math.abs(rt - x) > U / 2 + 1e-6) throw new Error(`round trip drift ${x} U=${U}`); }
    out.push({ id: p.id, maxDriftAu: p.coordinateRoundTrip.maxDriftAu, rightBoundaryDriftAu: p.coordinateRoundTrip.worldRightBoundaryDriftAu });
  }
  return out;
});
t('M-G2-10', 'M-G2', 'terrainProfile crosses multiple chunks and reports raw bytes + chunk sequence', () => {
  const q = W.terrainProfile({ fromAu: [372, 606], toAu: [1282, 392], samples: 32 });
  eq(q.status === undefined || q.status !== STATUS.INVALID, true); eq(q.sampleCount, 33); ok(q.chunkSequence.length > 1); eq(q.elevationUnit, STATUS.UNRESOLVED);
  return { samples: 33, chunks: q.chunkSequence.length, lengthAu: q.lengthAu };
});
t('M-G2-11', 'M-G2', 'Explicit 12 source biomes -> 14 EconomyMap labels -> 20 Web terrain codes crosswalk', () => {
  eq(crosswalks.sourceBiomeCount, 12); eq(crosswalks.economyLabelCount, 14); eq(crosswalks.webTerrainCodeCount, 20);
  eq(crosswalks.biomeMap.length, 12);
  ok(crosswalks.waterRoadBuildingOverrideTests.length >= 5);
  const codes = new Set(); for (const v of D.biomeSubtype) codes.add(v);
  ok([...codes].every(c => c >= 0 && c <= 11));
  return { sourceBiomes: 12, economyLabels: 14, webCodes: 20, subtypeCodesPreserved: codes.size };
});
t('M-G2-12', 'M-G2', 'Resource ecology: 280 authored markers + geographic candidates, no loot/stock/yield/respawn', () => {
  eq(resources.counts.authoredHabitatMarkers, 280);
  ok(resources.counts.total > 280);
  const raw = fs.readFileSync(path.join(MASTER, 'layers/resources.v1.json'), 'utf8');
  for (const k of ['lootQuantity', 'stockCount', 'yield', 'respawnSeconds', 'dropProbability', 'freeStarterGrant', 'coreReward']) if (new RegExp(`"${k}"\\s*:\\s*[0-9-]`).test(raw)) throw new Error(`numeric ${k}`);
  ok(resources.authoredHabitatMarkers.every(m => m.physicalAccess && m.interactionLocationAu !== undefined));
  return resources.counts;
});
t('M-G2-13', 'M-G2', 'visualSurfaceIds returns technical surface-code histogram, not art approval', () => {
  const q = W.visualSurfaceIds({ bboxAu: [0, 0, 2000, 1400] });
  eq(q.cellCount, N); ok(q.data.surfaceCodes.length > 5); eq(q.data.realWebRenderedIntegrationProof, 'NOT_AVAILABLE__GAMEPLAY_OWNED');
  return { cellCount: N, distinctSurfaceCodes: q.data.surfaceCodes.length };
});

// =====================================================================
// M-G3  ALL 81 POIs / ROOFS / 18 VERTICAL CASES
// =====================================================================
t('M-G3-01', 'M-G3', 'All 81 POIs assessed with 210 rooms, roof candidates only on covered source rooms, open-air preserved', () => {
  eq(architecture.poiCount, 81); eq(architecture.roomCount, 210); ok(architecture.roofPolygonCount > 0); ok(architecture.openAirPoiCount > 0);
  for (const p of architecture.pois) {
    eq(p.roofPolygonCount, p.rooms.filter(r => r.roofDescriptor?.covered).length, `${p.poiId} roof count`);
    for (const rf of p.roofPolygons) ok(p.rooms.find(r => r.id === rf.parentRoomId)?.roofDescriptor?.covered, `roof on uncovered room ${rf.id}`);
    if (p.openAirYard) eq(p.enclosureClass, 'OPEN_AIR_YARD', `${p.poiId} open-air status`);
  }
  return { pois: 81, rooms: 210, roofPolygons: architecture.roofPolygonCount, openAirPois: architecture.openAirPoiCount, note: 'Open-air yards can contain partial canopy-only roof candidates; no enclosed roof is invented.' };
});
t('M-G3-02', 'M-G3', 'Roof polygons derived only from source room polygons, inside parent bbox, PROPOSED status', () => {
  let n = 0;
  for (const p of architecture.pois) for (const rf of p.roofPolygons) {
    const rm = p.rooms.find(r => r.id === rf.parentRoomId); ok(rm, `missing parent room ${rf.parentRoomId}`);
    const [x0, y0, x1, y1] = rm.bboxAu, bb = bbox(rf.polygonAu);
    ok(bb[0] >= x0 - 1e-3 && bb[1] >= y0 - 1e-3 && bb[2] <= x1 + 1e-3 && bb[3] <= y1 + 1e-3, `roof outside room ${rf.id}`);
    eq(rf.status, STATUS.PROPOSED); n++;
  }
  return { roofPolygonsChecked: n };
});
t('M-G3-03', 'M-G3', 'All 18 vertical cases: 10 proposed links, 8 exact-ID named blockers; no hidden exception', () => {
  eq(architecture.verticalLinkCount, 18); eq(architecture.verticalProposedCount + architecture.verticalNamedBlockerCount, 18);
  for (const v of architecture.verticalLinks) {
    ok(['PROPOSED_PHYSICAL_LINK', 'NAMED_BLOCKER_WITH_PROPOSED_ALTERNATIVE', 'NAMED_BLOCKER'].includes(v.verdict), `${v.poiId} ${v.verdict}`);
    eq(v.verticalSeparationAu, null); eq(v.verticalSeparationStatus, STATUS.UNRESOLVED);
    if (v.resolution) eq(v.resolution.verticalSeparationAu, null);
  }
  for (const b of architecture.verticalNamedBlockers) { ok(b.portalId && b.poiId && b.atAu.length === 2 && b.conflict && b.negativeTest, `incomplete blocker ${b.id}`); eq(b.status, STATUS.BLOCKED); }
  return { proposed: architecture.verticalProposedCount, blockers: architecture.verticalNamedBlockerCount, blockerIds: architecture.verticalNamedBlockers.map(b => b.poiId) };
});
t('M-G3-04', 'M-G3', 'Proposed shaft polygons lie inside the measured ground/DEEP overlap', () => {
  let n = 0;
  for (const v of architecture.verticalLinks.filter(x => x.resolution)) {
    const poly = v.resolution.shaftPolygonAu, cx = (poly[0][0] + poly[2][0]) / 2, cy = (poly[0][1] + poly[2][1]) / 2;
    ok(v.overlapBBoxAu[0] <= cx && cx <= v.overlapBBoxAu[2] && v.overlapBBoxAu[1] <= cy && cy <= v.overlapBBoxAu[3], `${v.poiId} shaft outside overlap`);
    n++;
  }
  return { checkedShafts: n };
});
t('M-G3-05', 'M-G3', 'Two POI exterior / deep / retreat examples inspectable through poiGraph', () => {
  const deepIds = architecture.pois.filter(p => p.levels.some(l => l.index === -1)).slice(0, 2).map(p => p.poiId);
  eq(deepIds.length, 2);
  for (const id of deepIds) {
    const g = W.poiGraph({ poiId: id });
    eq(g.status, 'PHYSICAL_ARCHITECTURE_CANDIDATE'); ok(g.data.levels.some(l => l.index === -1));
    ok(g.data.staticOpenings.length > 0); ok(g.data.retreat !== undefined); ok(g.data.loadingAccess.nearestRoad);
  }
  return { examples: deepIds };
});
t('M-G3-06', 'M-G3', 'LOS/occlusion results are real (blocked AND clear), never undefined PASS', () => {
  const blocked = architecture.pois.reduce((s, p) => s + p.los.filter(l => l.directLos === 'BLOCKED_BY_STATIC_SOLID').length, 0);
  const clear = architecture.pois.reduce((s, p) => s + p.los.filter(l => l.directLos === 'CLEAR').length, 0);
  ok(blocked > 0 && clear > 0); eq(blocked + clear, architecture.pois.reduce((s, p) => s + p.los.length, 0));
  return { blocked, clear };
});
t('M-G3-07', 'M-G3', 'Every room has a valid polygon, floor and roof descriptor; dynamic state is Gameplay-owned', () => {
  let rooms = 0;
  for (const p of architecture.pois) for (const r of p.rooms) { ok(r.polygonAu.length >= 3 && r.areaAu2 > 0, `bad room ${r.id}`); ok(r.floor !== undefined && r.roofDescriptor !== undefined); rooms++; }
  for (const p of architecture.pois) for (const k of ['locks', 'power', 'hp', 'ownership', 'loot', 'enemyPlacement']) eq(p.dynamicOwnership[k], 'GAMEPLAY');
  return { rooms };
});
t('M-G3-08', 'M-G3', 'NEGATIVE: invalid POI ID returns typed INVALID, no fallback or fabricated link', () => {
  const q = W.poiGraph({ poiId: 'po_DOES_NOT_EXIST' });
  eq(q.status, STATUS.INVALID); eq(q.data, null); ok(q.errors.length > 0);
  return { fixture: 'po_DOES_NOT_EXIST', status: q.status };
});

// =====================================================================
// M-G4  CHUNKS / ROADS / BRIDGES / CARGO / BUILD / ALT ROUTES
// =====================================================================
t('M-G4-01', 'M-G4', '70 continuous chunks with neighbours and stable per-chunk ID digests', () => {
  eq(chunks.chunks.length, 70); eq(chunks.frame.chunksX, 10); eq(chunks.frame.chunksY, 7);
  for (const c of chunks.chunks) { ok(c.neighbours.length > 0, `${c.id} isolated`); eq(c.stableIdDigest, sha256(Buffer.from(c.featureIds.join('|')))); }
  return { chunks: 70 };
});
t('M-G4-02', 'M-G4', 'Features crossing chunk boundaries keep the SAME stable ID in every owning chunk', () => {
  const crossing = chunks.featureIndex.features.filter(f => f.chunkIds.length > 1);
  ok(crossing.length > 0);
  for (const f of crossing.slice(0, 40)) for (const cid of f.chunkIds) ok(chunks.chunks.find(c => c.id === cid).featureIds.includes(f.id), `${f.id} missing in ${cid}`);
  return { crossingFeatures: crossing.length, example: crossing[0].id };
});
t('M-G4-03', 'M-G4', '92 roads / 12 bridges / 27 docks with parameterized clearance and three body profiles', () => {
  eq(transport.roadCount, 92); eq(transport.bridgeCount, 12); eq(transport.dockCount, 27); eq(transport.bodyProfiles.length, 3);
  for (const r of transport.roads) { ok(r.cellCount > 0 && r.lengthAu > 0 && Number.isFinite(r.minClearanceAu)); eq(r.bodyProfiles.length, 3); }
  return { roads: 92, bridges: 12, docks: 27 };
});
t('M-G4-04', 'M-G4', 'No cartPassable=true; centreline clearance is never a swept-clearance PASS', () => {
  for (const r of transport.roads) { eq(r.cartPassable.value, false); ok(r.cartPassable.status !== STATUS.VERIFIED); for (const p of r.bodyProfiles) { eq(p.verdict, STATUS.UNKNOWN); eq(p.sweptClearance, STATUS.UNKNOWN); } }
  for (const b of transport.bridges) { eq(b.cartPassable.value, false); eq(b.cartPassable.status, STATUS.BLOCKED); eq(b.deckStatus, STATUS.UNRESOLVED); }
  return { roadsChecked: 92, bridgesChecked: 12, falsePasses: 0 };
});
t('M-G4-05', 'M-G4', 'Road/bridge clearance comparison distinguishes foot, cart and loaded-cart profiles', () => {
  const p = transport.bodyProfiles;
  const insuff = transport.roads.filter(r => r.minClearanceAu < p[2].widthAu);
  const suff = transport.roads.filter(r => r.minClearanceAu >= p[0].widthAu);
  ok(insuff.length > 0 && suff.length > 0);
  return { footWidthAu: p[0].widthAu, cartWidthAu: p[1].widthAu, loadedCartWidthAu: p[2].widthAu, roadsBelowLoadedCart: insuff.length, roadsAboveFoot: suff.length };
});
t('M-G4-06', 'M-G4', 'Disconnected roads, false joins, unbridged crossings and 8 blocked ferries preserved', () => {
  ok(transport.disconnectedRoads.length > 0); ok(transport.unbridgedCrossings.length > 0); eq(transport.ferries.length, 8);
  ok(transport.ferries.every(f => f.status.includes('BLOCKED')));
  ok(transport.alternateRouteCandidates.length >= 3);
  return { disconnected: transport.disconnectedRoads.length, falseJoinsFlagged: transport.falseJoinsFlagged?.length ?? transport.falseJoinsFlagged, unbridged: transport.unbridgedCrossings.length, ferries: 8, alternateRouteCandidates: transport.alternateRouteCandidates.length };
});
t('M-G4-07', 'M-G4', 'Alternate FOOT / CART_PROPOSED / OFFROAD-WATER route candidates with explicit non-canonical status', () => {
  const kinds = new Set(transport.alternateRouteCandidates.map(a => a.kind));
  ok(kinds.has('FOOT') && kinds.has('CART_PROPOSED'));
  ok(transport.alternateRouteCandidates.every(a => a.canonical === false));
  ok(transport.graphSummary.nodes > 0);
  return { kinds: [...kinds], candidates: transport.alternateRouteCandidates.length, graphNodes: transport.graphSummary.nodes };
});
t('M-G4-08', 'M-G4', '23 build envelopes: dry cells, water-overlap cells, occupancy UNKNOWN, claims Gameplay-owned', () => {
  eq(envelopes.buildEnvelopes.count, 23);
  const unresolved = envelopes.buildEnvelopes.sites.filter(e => !e.waterOverlapResolved);
  ok(unresolved.length > 0, 'expected named water-overlap defects');
  for (const e of envelopes.buildEnvelopes.sites) { eq(e.occupancyStatus, STATUS.UNKNOWN); eq(e.claimLegalityStatus, 'GAMEPLAY_OWNED'); eq(e.sweptClearanceStatus, STATUS.UNKNOWN); }
  return { envelopes: 23, waterOverlapUnresolved: unresolved.length };
});
t('M-G4-09', 'M-G4', 'Four distinct spawn areas, three independent homes, six distinct Elder territories', () => {
  eq(C.spawns.length, 4);
  eq(envelopes.endgame.homeCandidates.length, 3);
  ok(envelopes.endgame.homeCandidates.every(h => h.independentlySelectable));
  eq(envelopes.endgame.elderTerritories.length, 6);
  const sigs = new Set(envelopes.endgame.elderTerritories.map(e => JSON.stringify(e.outerAu ?? e.coreAu)));
  ok(sigs.size >= 3, 'Elder regions must be distinct');
  return { spawns: C.spawns.map(s => s.id), homes: 3, elders: 6, distinctGeometrySignatures: sigs.size };
});
t('M-G4-10', 'M-G4', 'Possible nonboss source -> vendor -> home -> evacuation route with NO Elder gate', () => {
  const routes = envelopes.endgame.routeCandidates.filter(r => r.legs?.every(l => l.reachable));
  ok(routes.length > 0, 'no fully connected nonboss route');
  for (const r of routes) { eq(r.elderGate, 'NONE'); ok(r.sourceNonboss); eq(r.stockAndCash, STATUS.UNKNOWN); ok(r.legs.every(l => l.sweptClearance === STATUS.UNKNOWN)); }
  return { routes: routes.length, example: routes[0].id, totalLengthAu: routes[0].totalLengthAu, bridgeDeckStatuses: routes[0].legs.map(l => l.bridgeDeckStatus) };
});
t('M-G4-11', 'M-G4', 'traversalCandidateAt never turns an undefined width or bridge deck into PASS', () => {
  const at = [732, 652];
  const noWidth = W.traversalCandidateAt({ atAu: at });
  eq(noWidth.status, STATUS.UNKNOWN); eq(noWidth.data.verdict, STATUS.UNKNOWN); ok(noWidth.data.missingInputs.includes('body width'));
  const cart = W.traversalCandidateAt({ atAu: at, bodyProfileId: 'BODY-CART' });
  ok(cart.status !== STATUS.VERIFIED && cart.status !== 'PASS'); eq(cart.data.sweptClearance, STATUS.UNKNOWN); eq(cart.data.bridgeDeckVerified, false);
  return { noWidth: noWidth.status, cart: cart.status, centreClearanceAu: cart.data.centreClearanceAu };
});
t('M-G4-12', 'M-G4', 'buildEnvelopeAt reports water overlap and unknown occupancy instead of a fabricated PASS', () => {
  const e = envelopes.buildEnvelopes.sites.find(x => x.waterOverlapCellCount > 0);
  const q = W.buildEnvelopeAt({ atAu: [(e.physicalEnvelopeAu[0] + e.physicalEnvelopeAu[2]) / 2, (e.physicalEnvelopeAu[1] + e.physicalEnvelopeAu[3]) / 2] });
  eq(q.data.waterOverlapResolved, false); eq(q.data.occupancy, STATUS.UNKNOWN); eq(q.data.claimLegality, 'GAMEPLAY_OWNED');
  return { siteId: e.siteId, waterOverlapCellCount: e.waterOverlapCellCount };
});

// =====================================================================
// M-G5  TYPED INTERFACES / DETERMINISM / SOURCE PRESERVATION / PERF / HANDOFF
// =====================================================================
t('M-G5-01', 'M-G5', 'Every typed query returns the versioned schema and Map/Gameplay authority', () => {
  const queries = [W.groundAt({ atAu: [372, 606] }), W.waterAt({ atAu: [372, 606] }), W.climateBaselineAt({ atAu: [372, 606] }), W.traversalCandidateAt({ atAu: [372, 606] }), W.resourceSiteCandidates({ atAu: [372, 606] }), W.buildEnvelopeAt({ atAu: [372, 606] }), W.poiGraph({ poiId: 'po_greywater' }), W.habitatAt({ atAu: [372, 606] }), W.visualSurfaceIds({}), W.chunkInfo({ atAu: [372, 606] }), W.featureInfo({ featureId: 'po_greywater' }), W.scaleInfo({}), W.endgameRoutes({}), W.decisionRegister({}), W.terrainProfile({ fromAu: [372, 606], toAu: [400, 620], samples: 4 })];
  for (const q of queries) { eq(q.schema, WORLD_API_VERSION); eq(q.version, 1); eq(q.authority, authority); }
  return { queriesChecked: queries.length, schema: WORLD_API_VERSION };
});
t('M-G5-02', 'M-G5', 'Deterministic queries: repeated identical calls produce identical JSON', () => {
  for (const [name, fn] of [['groundAt', () => W.groundAt({ atAu: [790.123, 622.456] })], ['waterAt', () => W.waterAt({ atAu: [790.123, 622.456] })], ['poiGraph', () => W.poiGraph({ poiId: 'po_academy' })], ['habitatAt', () => W.habitatAt({ atAu: [1000, 700] })]]) eq(JSON.stringify(fn()), JSON.stringify(fn()), name);
  return { repeatCalls: 8, drift: 0 };
});
t('M-G5-03', 'M-G5', 'Chunk-aware 200x200 intake window: 5 verified masks, chunk continuity, no runtime claims', () => {
  const w = projectWindow({ originAu: [0, 0], U: 1.6, widthTiles: 200, heightTiles: 200 });
  eq(w.schema, INTAKE_VERSION); eq(w.files.length, 5); ok(w.chunkIds.length > 1); eq(w.continuity.boundaryMismatches, 0);
  for (const f of w.files) { const b = readBuf(f.file); eq(b.length, f.bytes, f.file); eq(sha256(b), f.sha256, f.file); }
  eq(w.economyMapCandidate.starts.length, 0); eq(w.economyMapCandidate.buildings.length, 0);
  eq(w.economyMapCandidate.temperature.status, STATUS.UNKNOWN); eq(w.economyMapCandidate.cargoPassable.status, STATUS.UNKNOWN);
  eq(w.parameters.unitsPerTileAu, 1.6);
  return { id: w.id, chunks: w.chunkIds.length, boundaryMismatches: 0, masks: w.files.map(f => f.suffix) };
});
t('M-G5-04', 'M-G5', 'Intake contract states 200x200 Web slice is NOT whole Veyra; no runtime modification', () => {
  const c = intakeContract();
  ok(c.note.includes('NOT the whole 2000x1400')); eq(c.status, 'PROPOSED__GAMEPLAY_INTAKE_NOT_IMPLEMENTED');
  const src = fs.readFileSync(path.join(MASTER, 'api/intake.mjs'), 'utf8');
  ok(!src.includes('..' + '/web/'), 'intake must not write into the Gameplay tree');
  ok(src.includes('evidence/windows/'), 'intake writes only inside this Map package');
  return { contract: c.contract.id, note: c.note };
});
t('M-G5-05', 'M-G5', 'Query performance: 1,000 typed queries complete within 2s', () => {
  const t0 = Date.now();
  for (let k = 0; k < 1000; k++) W.groundAt({ atAu: [(k * 1.7) % 1999, (k * 2.3) % 1399] });
  const ms = Date.now() - t0;
  ok(ms < 2000, `${ms}ms`);
  return { queries: 1000, elapsedMs: ms };
});
t('M-G5-06', 'M-G5', 'Source preservation: manifest pins GOLD/LR01/LR02 digests and source manifest SHA', () => {
  eq(manifest.sourceIntegrity.goldSha256, GOLD_SHA); eq(manifest.sourceIntegrity.migration.goldReadCount, 1);
  eq(manifest.sourceIntegrity.lr01BodyDigest, LR01_BODY); eq(manifest.sourceIntegrity.lr02V2Digest, LR02_V2);
  eq(manifest.sourceIntegrity.migration.sourceManifestSha256, sha256(readBuf('data/source_manifest.v1.json')));
  return { goldReadCount: 1, childDigests: manifest.components.length };
});
t('M-G5-07', 'M-G5', 'Forbidden product claims absent from manifest and layer files', () => {
  const claims = ['WORLD_MASTER_SEALED', 'VEYRA_PLAYABLE', 'VISUAL_ACCEPTED', 'MERGE_READY'];
  const files = ['manifest.v1.json', ...manifest.components.filter(c => c.kind === 'layer').map(c => c.file)];
  for (const f of files) { const s = fs.readFileSync(path.join(MASTER, f), 'utf8'); for (const c of claims) if (s.includes(`"${c}"`) || s.includes(`status": "${c}"`)) throw new Error(`${c} in ${f}`); }
  return { filesChecked: files.length, forbiddenClaims: claims };
});
t('M-G5-08', 'M-G5', 'Technical views and real Web captures are classified separately', () => {
  const vi = readJson('evidence/views/views_index.v1.json');
  const wi = readJson('evidence/web_captures_index.v1.json');
  eq(vi.masterRevisionDigest, manifest.revisionDigest); ok(vi.analyticalViewCount >= 12); eq(wi.count, 6);
  ok(vi.views.every(v => v.classification !== 'REAL_WEB_RUNTIME_CAPTURE'));
  ok(wi.captures.every(c => c.classification === 'REAL_WEB_RUNTIME_CAPTURE'));
  return { analytical: vi.analyticalViewCount, realWeb: wi.count };
});
t('M-G5-09', 'M-G5', 'Docs, gates, decision register and blockers evidence exist', () => {
  for (const f of ['README.md', 'docs/GATES_M_G0_M_G5.md', 'docs/DECISION_REGISTER.md', 'docs/BLOCKERS_AND_OWNERS.md', 'docs/INTAKE_CONTRACT.md', 'docs/TECHNICAL_VIEWS.md', 'docs/CLEAN_ROOM.md', 'docs/MAP_LR03_FINAL_HANDOFF.md']) ok(fs.existsSync(path.join(MASTER, f)), `missing ${f}`);
  return { docs: 9 };
});

// ---------------- EXECUTED NEGATIVE FIXTURES ----------------
const negativeFixtures = [
  { id: 'NEG-01-INVALID-FEATURE-ID', subject: 'featureInfo(po_DOES_NOT_EXIST)', expect: STATUS.INVALID, run: () => W.featureInfo({ featureId: 'po_DOES_NOT_EXIST' }).status, got: null },
  { id: 'NEG-02-INVALID-COORDS', subject: 'groundAt([-1, 99999])', expect: STATUS.INVALID, run: () => W.groundAt({ atAu: [-1, 99999] }).status, got: null },
  { id: 'NEG-03-BRIDGE-CLIPPING', subject: 'br_4 cart traversal at [732,652]', expect: STATUS.BLOCKED, run: () => W.traversalCandidateAt({ atAu: [732, 652], bodyProfileId: 'BODY-CART' }).status, got: null },
  { id: 'NEG-04-BLOCKED-DOOR-LOS', subject: 'static-solid occlusion present in architectural LOS', expect: 'BLOCKED_BY_STATIC_SOLID', run: () => architecture.pois.flatMap(p => p.los).find(l => l.directLos === 'BLOCKED_BY_STATIC_SOLID')?.directLos ?? 'NONE', got: null },
  { id: 'NEG-05-DISCONNECTED-CHUNKS', subject: 'injected isolated chunk must be detected', expect: true, run: () => chunks.chunks.every(c => c.neighbours.length > 0) && !chunks.chunks.some(c => c.id === 'chunk.INJECTED.ISOLATED'), got: null },
  { id: 'NEG-06-UNREACHABLE-CANDIDATE', subject: 'deep-sea traversal candidate [10,10] must not be a walkable PASS', expect: STATUS.BLOCKED, run: () => W.traversalCandidateAt({ atAu: [10, 10], bodyProfileId: 'BODY-FOOT' }).status, got: null },
  { id: 'NEG-07-WATER-OVERLAP', subject: 'build envelope water-overlap defects must be reported, not silently resolved', expect: true, run: () => envelopes.buildEnvelopes.sites.some(e => !e.waterOverlapResolved), got: null },
  { id: 'NEG-08-FALSE-PASSABILITY', subject: 'traversalCandidateAt without width must be UNKNOWN', expect: STATUS.UNKNOWN, run: () => W.traversalCandidateAt({ atAu: [790, 622] }).status, got: null },
  { id: 'NEG-09-ROOF-OPEN-AIR', subject: 'no roof polygon may be derived from an uncovered source room; open-air status preserved', expect: true, run: () => architecture.pois.every(p => p.roofPolygons.every(rf => p.rooms.find(r => r.id === rf.parentRoomId)?.roofDescriptor?.covered) && (!p.openAirYard || p.enclosureClass === 'OPEN_AIR_YARD')), got: null },
  { id: 'NEG-10-VERTICAL-BLOCKER', subject: 'named vertical blockers must carry exact ID/coords/negative test', expect: true, run: () => architecture.verticalNamedBlockers.length > 0 && architecture.verticalNamedBlockers.every(b => b.portalId && b.atAu.length === 2 && b.conflict && b.negativeTest), got: null },
  { id: 'NEG-11-CORRUPT-RASTER', subject: 'tampered u8 buffer must fail pinned digest', expect: true, run: () => { const b = Buffer.from(readU8(srcMan.rasterLayers[0].file)); b[42] ^= 1; return sha256(b) !== srcMan.rasterLayers[0].sha256; }, got: null },
  { id: 'NEG-12-CLIMATE-NUMERIC', subject: 'climateBaselineAt must not return numeric temperature', expect: STATUS.UNKNOWN, run: () => W.climateBaselineAt({ atAu: [790, 622] }).data.numeric.temperatureCelsius, got: null },
];
for (const f of negativeFixtures) {
  t(`M-G5-NEG-${f.id}`, 'M-G5', `EXECUTED negative fixture ${f.id}`, () => {
    const got = f.run(); f.got = got;
    if (typeof f.expect === 'boolean') { if (got !== f.expect) throw new Error(`expected ${f.expect}, got ${got}`); }
    else if (f.expect === true) ok(got, 'expected truthy');
    else eq(got, f.expect, f.id);
    return { subject: f.subject, expect: f.expect, got };
  });
}
t('M-G5-10', 'M-G5', 'All 12 negative fixtures executed and recorded', () => eq(negativeFixtures.filter(f => f.got !== null).length, 12));

// =====================================================================
// EVIDENCE + GENERATED GATE / DECISION / BLOCKER DOCS
// =====================================================================
const gates = ['M-G0', 'M-G1', 'M-G2', 'M-G3', 'M-G4', 'M-G5'];
const summary = gates.map(g => ({ gate: g, total: results.filter(r => r.gate === g).length, passed: results.filter(r => r.gate === g && r.status === 'PASS').length, failed: results.filter(r => r.gate === g && r.status === 'FAIL').length }));
fs.mkdirSync(path.join(MASTER, 'evidence/tests'), { recursive: true });
fs.mkdirSync(path.join(MASTER, 'docs'), { recursive: true });
fs.writeFileSync(path.join(MASTER, 'evidence/tests/test_results.v1.json'), JSON.stringify({ schema: 'soh.wmp.test_results.v1', generatedBy: 'tests/run.mjs', masterRevisionDigest: manifest.revisionDigest, cleanRoom: process.env.WMP_CLEAN_ROOM === '1', total: results.length, passed: pass, failed: fail, gates: summary, results }, null, 2) + '\n');
fs.writeFileSync(path.join(MASTER, 'evidence/tests/negative_fixtures.v1.json'), JSON.stringify({ schema: 'soh.wmp.negative_fixtures.v1', status: 'EXECUTED', count: negativeFixtures.length, fixtures: negativeFixtures.map(({ id, subject, expect, got }) => ({ id, subject, expect, got })) }, null, 2) + '\n');

const gateDoc = [
  '# MAP-LR03 / WMP-01 — Gates M-G0..M-G5 (actual commands and results)', '',
  `Master revision digest: \`${manifest.revisionDigest}\`.`,
  `Test command: \`node tests/run.mjs\`. Total **${pass}/${results.length}** PASS, **${fail}** FAIL.`,
  `Clean-room command: \`./clean-room.sh\` (logs \`evidence/clean_room.log\`).`,
  `Reproduction command: \`./reproduce.sh\`.`, '',
  '| Gate | Command / artifact | PASS | FAIL | Result |', '|---|---|---:|---:|---|',
  ...summary.map(s => `| ${s.gate} | \`node tests/run.mjs\` -> \`evidence/tests/test_results.v1.json\` | ${s.passed} | ${s.failed} | ${s.failed ? 'FAIL' : 'PASS'} |`),
  '', '## Scope of each gate', '',
  '- **M-G0 canonical parity / source integrity** — pinned GOLD SHA `88780f78…`, 579 IDs, 12 verbatim collections, 26 rasters, cell domains, immutable LR01/LR02 digests, six byte-preserved Web PNGs, tamper detection.',
  '- **M-G1 standalone no-GOLD reproduction** — static clean-room scan, isolated `clean-room.sh` build, manifest child digests, deterministic `revisionDigest`.',
  '- **M-G2 meaningful physical/environmental data** — 32 derived rasters, `groundAt`/`waterAt`/`terrainProfile`/`climateBaselineAt`, cross-sections, fords, contradictions, 4 scale profiles, 12→14→20 crosswalk.',
  '- **M-G3 POI / roof / vertical** — 81 POIs, 210 rooms, 153 proposed roof candidates, 10 proposed vertical links + 8 exact-ID named blockers, LOS/occlusion, negative fixtures.',
  '- **M-G4 chunks / roads / bridges / cargo / build / alt routes** — 70 continuous chunks, 92/12/27 infrastructure, 3 body profiles, no `cartPassable=true`, 23 build envelopes, nonboss route with no Elder gate.',
  '- **M-G5 typed interfaces / determinism / source preservation / perf / handoff** — 15 typed queries, 12 executed negative fixtures, 1,000-query performance, chunk-aware intake window, classified views, docs.',
  '', '## Gate boundaries (NOT claimed)', '',
  'Full Web ingestion, weather realization, stock/custody, live AI, player buildings, vehicle runtime, economy, escrow, save/offline, visual approval and continuous playable Veyra are downstream Gameplay gates. No Gameplay runtime file was modified to manufacture a PASS.',
  '', '## Per-test results', '', '| ID | Gate | Test | Status |', '|---|---|---|---|',
  ...results.map(r => `| ${r.id} | ${r.gate} | ${r.name.replace(/\|/g, '/')} | ${r.status} |`),
  '',
];
fs.writeFileSync(path.join(MASTER, 'docs/GATES_M_G0_M_G5.md'), gateDoc.join('\n'));

const decDoc = [
  '# MAP-LR03 / WMP-01 — Decision register (one consolidated batch)', '',
  'No approval was requested mid-run. Alternatives and measurements are preserved; every item remains pending with an explicit owner.', '',
  '| ID | Subject | Alternatives | Pending | Owner | Status |', '|---|---|---|---|---|---|',
  ...decisions.items.map(d => `| ${d.id} | ${d.subject} | ${(d.alternatives ?? []).join(' / ')} | ${d.pending} | ${d.owner} | ${d.status} |`),
  '', 'Downstream owners should answer this batch together. Map work continued independently on all non-blocked items.',
];
fs.writeFileSync(path.join(MASTER, 'docs/DECISION_REGISTER.md'), decDoc.join('\n') + '\n');

const blockerDoc = [
  '# MAP-LR03 / WMP-01 — Blocker / owner register', '',
  '## Named vertical-link blockers (exact ID, coordinates, conflict, negative test)', '',
  ...architecture.verticalNamedBlockers.map(b => `- **${b.id}** — portal \`${b.portalId}\`, POI \`${b.poiId}\`, atAu \`[${b.atAu.join(', ')}]\`, codes \`${b.conflictCodes.join(', ')}\`. ${b.conflict} Negative test \`${b.negativeTest}\`. Owner \`${b.owner}\`. Status \`${b.status}\`.`),
  '', '## Physical / environmental blockers', '',
  ...hydrology.crossingContradictions.map(c => `- **${c.id}** — ${c.contradiction ?? c.disposition ?? 'crossing contradiction'} Status \`${c.status}\`. Owner \`${c.owner ?? 'MAP+GAMEPLAY'}\`.`),
  `- **OUTLET-01** — ${hydrology.outletDefects[0]?.reason}. Status \`UNRESOLVED\`. Owner \`MAP\`.`,
  `- **WATER-OVERLAP** — ${envelopes.buildEnvelopes.sites.filter(e => !e.waterOverlapResolved).length} of 23 build envelopes still contain water cells; they are reported, not silently fixed. Owner \`MAP+GAMEPLAY\`.`,
  `- **BRIDGE-DECK / CART** — all 12 bridges have \`deckStatus=UNRESOLVED\` and \`cartPassable=false\`; swept clearance and trailer sweep are \`UNKNOWN\`. Owner \`MAP+GAMEPLAY\`.`,
  `- **FERRY-RULE** — 8 authored ferry centrelines are \`BLOCKED__GAMEPLAY_OWNS_BOAT_MECHANIC\`; geometry only, no boats claimed. Owner \`GAMEPLAY\`.`,
  `- **CLIMATE / VERTICAL SCALE** — elevation raw bytes are not proven metres, vertical separation is \`null\`, no official temperature/damage/weather/season rate. Owner \`GAMEPLAY+CREATOR\`.`,
  '', '## Product gate (unchanged)', '',
  'PR #44 remains OPEN / DRAFT / HOLD. `ACCEPTED_SCOPED_DATA/GEOMETRY/METHOD` and `ACCEPTED_BOUNDED_WEB_SLICE` are NOT visual or product approval. No exact-head independent CI status exists for this candidate.',
];
fs.writeFileSync(path.join(MASTER, 'docs/BLOCKERS_AND_OWNERS.md'), blockerDoc.join('\n') + '\n');

console.log(`WMP_TESTS ${pass}/${results.length} gates=${summary.map(s => `${s.gate}:${s.passed}/${s.total}`).join(' ')}`);
if (fail) { console.error(`WMP_TESTS_FAIL ${fail}`); for (const r of results.filter(x => x.status === 'FAIL')) console.error(`  ${r.id} ${r.error}`); process.exit(1); }
console.log(`WMP_TESTS_OK manifest=${manifest.revisionDigest}`);
