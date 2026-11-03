#!/usr/bin/env node
// MAP-GEO-01 tests: determinism, source fidelity, no-rescale, no-invention.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadSource } from './lib/source.mjs';
import { buildLayers } from './lib/raster.mjs';
import { buildExport } from './export.mjs';
import { parseArgs, ROOT, DEFAULT_OUT } from './lib/cli.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const results = [];
const t = (name, fn) => {
  try { const m = fn(); results.push({ name, status: 'PASS', measured: m ?? null }); }
  catch (e) { results.push({ name, status: 'FAIL', error: String(e.message || e) }); }
};
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), msg);

const args = parseArgs();
const out = args.out ? path.resolve(args.out) : DEFAULT_OUT;
const source = loadSource({ sourcePath: args.source || null });
const P = source.project;
const geo = JSON.parse(fs.readFileSync(path.join(out, 'geography.v1.json'), 'utf8'));
const verify = JSON.parse(fs.readFileSync(path.join(out, 'source_verification.v1.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(out, 'rasters', 'manifest.v1.json'), 'utf8'));

t('source fingerprint matches pinned git blob', () => {
  const git = Buffer.from(execFileSync('git', ['show', `${source.fingerprint.commit}:${source.fingerprint.path}`], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }));
  assert(sha(git) === source.fingerprint.sha256, 'git blob sha mismatch');
  assert(geo.canonicalSource.sha256 === source.fingerprint.sha256, 'export fingerprint mismatch');
  assert(verify.canonicalSource.sha256 === source.fingerprint.sha256, 'verify fingerprint mismatch');
  return { sha256: source.fingerprint.sha256, bytes: source.fingerprint.bytes };
});

t('all 579+ authored source ids and coordinates are preserved verbatim', () => {
  const keys = ['land', 'lakes', 'rivers', 'roads', 'bridges', 'docks', 'pois', 'zones', 'resources', 'spawns', 'elders', 'labels'];
  const counts = {};
  for (const k of keys) { eq(geo.objects[k], P[k], `objects.${k} differs from source`); counts[k] = P[k].length; }
  return counts;
});

t('every source id appears in its derived topology section', () => {
  const map = {
    land: geo.topology.land.landmasses, lakes: geo.topology.water.lakes, rivers: geo.topology.water.rivers,
    roads: geo.topology.transport.roads, bridges: geo.topology.transport.bridges, docks: geo.topology.transport.docks,
    pois: geo.topology.pois.pois, zones: geo.topology.zones.buildableRegions, resources: geo.topology.resources.annotations,
    spawns: geo.topology.spawns.spawns, elders: geo.topology.elders.elders,
  };
  for (const [k, arr] of Object.entries(map)) {
    const ids = new Set(arr.map(o => o.id));
    for (const o of P[k]) assert(ids.has(o.id), `missing derived id ${k}:${o.id}`);
  }
  return Object.fromEntries(Object.entries(map).map(([k, a]) => [k, a.length]));
});

t('terrain decode is byte-exact and both arrays have 43,750 cells', () => {
  const { layers } = buildLayers(P);
  assert(P.terrain.elev.length === P.terrain.biome.length, 'base64 lengths differ');
  assert(Buffer.from(layers.elevation).toString('base64') === P.terrain.elev, 'elev not canonical');
  assert(Buffer.from(layers.biomeCode).toString('base64') === P.terrain.biome, 'biome not canonical');
  assert(layers.elevation.length === 43750 && layers.biomeCode.length === 43750, 'cell count');
  for (const l of manifest.layers) {
    const buf = fs.readFileSync(path.join(out, l.file));
    assert(buf.length === l.bytes && sha(buf) === l.sha256, `raster mismatch ${l.name}`);
    assert(buf.length === 43750, `raster cell count ${l.name}`);
    assert(sha(Buffer.from(layers[l.name])) === l.sha256, `layer mismatch ${l.name}`);
  }
  return { layers: manifest.layers.length, cells: 43750, sha256: manifest.layers.find(l => l.name === 'elevation').sha256 };
});

t('export is deterministic across two independent regenerations', () => {
  const a = path.join(os.tmpdir(), `geo01-a-${process.pid}`), b = path.join(os.tmpdir(), `geo01-b-${process.pid}`);
  for (const d of [a, b]) {
    execFileSync(process.execPath, [path.join(ROOT, 'src', 'export.mjs'), `--out=${d}`], { cwd: ROOT, stdio: 'pipe' });
  }
  for (const f of ['geography.v1.json', 'rasters/manifest.v1.json']) {
    assert(sha(fs.readFileSync(path.join(a, f))) === sha(fs.readFileSync(path.join(b, f))), `non-deterministic ${f}`);
    assert(sha(fs.readFileSync(path.join(a, f))) === sha(fs.readFileSync(path.join(out, f))), `committed ${f} differs from regeneration`);
  }
  const d1 = JSON.stringify(buildExport(source).doc), d2 = JSON.stringify(buildExport(source).doc);
  assert(d1 === d2, 'buildExport not pure');
  fs.rmSync(a, { recursive: true, force: true }); fs.rmSync(b, { recursive: true, force: true });
  return { regenerations: 2, geographySha: sha(fs.readFileSync(path.join(out, 'geography.v1.json'))) };
});

t('verification report is reproducible', () => {
  const d = path.join(os.tmpdir(), `geo01-v-${process.pid}`);
  execFileSync(process.execPath, [path.join(ROOT, 'src', 'verify.mjs'), `--out=${d}`], { cwd: ROOT, stdio: 'pipe' });
  assert(sha(fs.readFileSync(path.join(d, 'source_verification.v1.json'))) === sha(fs.readFileSync(path.join(out, 'source_verification.v1.json'))), 'verification report not deterministic');
  fs.rmSync(d, { recursive: true, force: true });
  assert(verify.verdict === 'PASS', `verification verdict ${verify.verdict}`);
  return { verdict: verify.verdict, checks: verify.summary.total };
});

t('no rescale to the 200x200 runtime island', () => {
  assert(geo.frame.transform.status === 'UNDECIDED', 'transform status');
  assert(geo.frame.transform.mode === 'NONE_APPLIED', 'transform mode');
  assert(geo.frame.authoring.w === 2000 && geo.frame.authoring.h === 1400, 'authoring canvas');
  assert(geo.frame.grid.gw === 250 && geo.frame.grid.gh === 175 && geo.frame.grid.cell === 8, 'source grid');
  eq(geo.objects.spawns.map(s => s.at), P.spawns.map(s => s.at), 'spawn coords changed');
  eq(geo.objects.land.map(l => l.rings), P.land.map(l => l.rings), 'land rings changed');
  assert(!('tiles' in geo) && !('statics' in geo) && !('buildings' in geo) && !('places' in geo), 'runtime package fields present');
  return { status: geo.frame.transform.status, runtimeReference: geo.frame.transform.runtimeReference };
});

t('undefined fields are explicitly UNKNOWN / NOT_IN_SOURCE, never fabricated', () => {
  assert(geo.climate.status === 'UNDEFINED_IN_SOURCE', 'climate status');
  assert(geo.climate.moisture.value === null && geo.climate.moisture.status === 'UNKNOWN', 'moisture fabricated');
  assert(geo.climate.temperature.value === null && geo.climate.temperature.status === 'UNKNOWN', 'temperature fabricated');
  assert(geo.climate.hazardIntensity.value === null, 'hazard fabricated');
  assert(geo.terrainEncoding.biome.legendStatus === 'NOT_COMMITTED_IN_SOURCE', 'biome legend claimed');
  assert(geo.physicalClassification.cargoAccess.cargoPassable === 'UNDEFINED', 'cargo verdict invented');
  assert(geo.topology.transport.roads.every(r => r.widthAu === null && r.widthStatus === 'NOT_IN_SOURCE'), 'road width invented');
  assert(geo.topology.transport.bridges.every(b => b.channelSpanFitVerified === false), 'bridge fit claimed');
  return { unknownCount: geo.unknowns.length, climate: geo.climate.status };
});

t('280 resources stay annotations; no gameplay population was performed', () => {
  const a = geo.topology.resources.annotations;
  assert(a.length === 280, 'annotation count');
  assert(a.every(x => x.status === 'CANDIDATE_GEOGRAPHIC_ANNOTATION' && x.finalHarvestableInstances === 'NOT_SUPPLIED' && x.stock === 'NOT_SUPPLIED' && x.yield === 'NOT_SUPPLIED' && x.respawn === 'NOT_SUPPLIED'), 'source node invented');
  assert(geo.topology.resources.suitabilityWeights === 'UNDEFINED (Gameplay-owned)', 'weights invented');
  assert(!('loot' in geo) && !('cash' in geo) && !('statics' in geo), 'loot/cash/static invented');
  return { count: a.length, kinds: Object.keys(geo.topology.resources.kindCounts).length };
});

t('no fake RuntimeMapPackage / Elder mapping / POI gameplay fields', () => {
  assert(geo.integration.status === 'EXPORT_ONLY_NO_RUNTIME_INTAKE', 'runtime intake claimed');
  assert(geo.topology.elders.elders.every(e => e.mappingStatus === 'NO_GAMEPLAY_ELDER_MAPPING_CREATED'), 'elder mapping invented');
  for (const p of geo.topology.pois.pois) {
    assert(p.spatial.rooms.status === 'NOT_IN_SOURCE', `rooms invented ${p.id}`);
    assert(p.spatial.entrances.status === 'NOT_IN_SOURCE', `entrances invented ${p.id}`);
    assert(p.spatial.doors.status === 'GAMEPLAY_OWNED', `doors invented ${p.id}`);
    assert(p.spatial.lootSites.status === 'GAMEPLAY_OWNED', `loot invented ${p.id}`);
  }
  return { pois: geo.topology.pois.pois.length, runtimeIntakeBlockers: geo.integration.runtimeIntakeBlockedBy.length };
});

t('confidence flags are preserved on every source object', () => {
  const c = geo.confidence;
  assert(c.totals.proposal > 0 && c.totals.assumption > 0, 'confidence totals');
  const total = ['land', 'lakes', 'rivers', 'roads', 'bridges', 'docks', 'pois', 'zones', 'resources', 'spawns', 'elders', 'labels'].reduce((s, k) => s + P[k].length, 0);
  const counted = Object.values(c.totals).reduce((s, v) => s + v, 0);
  assert(counted === total, `confidence counted ${counted} of ${total}`);
  return c.totals;
});

const failed = results.filter(r => r.status === 'FAIL');
for (const r of results) console.log(`${r.status} ${r.name}${r.error ? ' :: ' + r.error : ''}`);
console.log(`\nGEO_TESTS ${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
