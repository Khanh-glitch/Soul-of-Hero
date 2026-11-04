#!/usr/bin/env node
// WMP-01 Phase A — ONE-TIME source-preserving migration.
//
// This is the ONLY file allowed to read GOLD / MapLab / LR01 / LR02 source.
// It reads the pinned GOLD git object ONCE, copies the authored rasters and
// verbatim LR01/LR02 artifacts into data/, and writes data/source_manifest.v1.json.
// After it runs, build.mjs, api/, tests/ and tools/ need NOTHING outside data/.
//
// Never modifies GOLD, LR01, LR02, Gameplay, main, or any other branch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const MASTER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(MASTER, '..');
const DATA = path.join(MASTER, 'data');
const sha256 = b => createHash('sha256').update(b).digest('hex');
const GOLD_COMMIT = '19d8c6ec820f324a6ac12733165e43b5e2c6eab2';
const GOLD_PATH = 'map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json';
const GOLD_SHA = '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256';

function put(rel, buf) {
  const p = path.join(DATA, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
  return { file: `data/${rel}`, bytes: buf.length, sha256: sha256(buf) };
}
const entries = [];
const add = (rel, buf) => { const e = put(rel, buf); entries.push(e); return e; };
const readBuf = p => fs.readFileSync(path.join(ROOT, p));

// --- 1. GOLD, read exactly once via the pinned git object -----------------
// Idempotency: once the byte-identical copy is embedded, a rerun reuses it and
// NEVER touches the GOLD git object or MapLab again. The authoritative read is
// the single successful `git show` of the first run.
const embeddedGold = path.join(DATA, 'canon/VEYRA_GOLD_MAP.sohmap.json');
const goldRaw = fs.existsSync(embeddedGold)
  ? fs.readFileSync(embeddedGold)
  : Buffer.from(execFileSync('git', ['show', `${GOLD_COMMIT}:${GOLD_PATH}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }));
if (goldRaw.length !== 332249 || sha256(goldRaw) !== GOLD_SHA) throw new Error('MIGRATION_GOLD_FINGERPRINT_MISMATCH');
add('canon/VEYRA_GOLD_MAP.sohmap.json', goldRaw);
const goldDoc = JSON.parse(goldRaw.toString('utf8'));
if (goldDoc.format !== 'soh-maplab' || goldDoc.version !== 1) throw new Error('MIGRATION_GOLD_FORMAT_MISMATCH');

// Explicit canonical geometry snapshot: ALL authored collections verbatim,
// with polygons-with-holes, vertices, lines, IDs, precision and metadata intact.
const P = goldDoc.project;
const COLLECTIONS = ['land', 'lakes', 'rivers', 'roads', 'bridges', 'docks', 'pois', 'zones', 'resources', 'spawns', 'elders', 'labels'];
const snapshot = {
  schema: 'soh.wmp.canon_geometry_snapshot.v1',
  source: { commit: GOLD_COMMIT, path: GOLD_PATH, sha256: GOLD_SHA, format: goldDoc.format, version: goldDoc.version },
  world: P.world, meta: P.meta, baseId: P.baseId,
  terrainMeta: { gw: P.terrain.gw, gh: P.terrain.gh, cell: P.terrain.cell, seed: P.terrain.seed, elevEncoding: 'base64 uint8 row-major', biomeEncoding: 'base64 uint8 row-major', elevBytes: P.terrain.elev.length, biomeBytes: P.terrain.biome.length, note: 'Original encoded terrain strings are preserved in the embedded GOLD bytes; derived u8 rasters are in data/rasters/geo01.' },
  collections: {},
};
for (const k of COLLECTIONS) snapshot.collections[k] = P[k];
add('canon/geometry_snapshot.v1.json', Buffer.from(JSON.stringify(snapshot, null, 2) + '\n'));

// --- 2. GEO-01 (21) + GEO-02 MapLab (5) rasters, verbatim ----------------
const g1Dir = path.join(ROOT, 'world_lab/geo01/output/rasters');
const g2Dir = path.join(ROOT, 'world_lab/geo02/output/rasters');
const g1Manifest = JSON.parse(fs.readFileSync(path.join(g1Dir, 'manifest.v1.json'), 'utf8'));
const g2Manifest = JSON.parse(fs.readFileSync(path.join(g2Dir, 'manifest.v1.json'), 'utf8'));
add('rasters/geo01_manifest.v1.json', fs.readFileSync(path.join(g1Dir, 'manifest.v1.json')));
add('rasters/geo02_manifest.v1.json', fs.readFileSync(path.join(g2Dir, 'manifest.v1.json')));
const rasterLayers = [];
for (const l of g1Manifest.layers) {
  const b = fs.readFileSync(path.join(ROOT, 'world_lab/geo01/output', l.file));
  if (b.length !== l.bytes || sha256(b) !== l.sha256) throw new Error(`MIGRATION_GEO01_RASTER_MISMATCH ${l.name}`);
  const e = add(`rasters/geo01/${path.basename(l.file)}`, b);
  rasterLayers.push({ group: 'geo01', name: l.name, ...e, dtype: l.dtype ?? 'u8', grid: { gw: 250, gh: 175, cellAu: 8, order: 'row_major i=gy*250+gx' }, semantics: l.semantics ?? null, sourceStatus: 'SOURCE_AUTHORED' });
}
for (const [name, meta] of Object.entries(g2Manifest.files)) {
  const b = fs.readFileSync(path.join(g2Dir, name));
  if (sha256(b) !== meta.sha256) throw new Error(`MIGRATION_GEO02_RASTER_MISMATCH ${name}`);
  const e = add(`rasters/geo02/${name}`, b);
  rasterLayers.push({ group: 'geo02', name: name.replace('.u8', ''), ...e, dtype: 'u8', grid: { gw: 250, gh: 175, cellAu: 8, order: 'row_major i=gy*250+gx' }, semantics: 'MapLab analysis mask', sourceStatus: 'SOURCE_AUTHORED' });
}
if (rasterLayers.filter(r => r.group === 'geo01').length !== 21) throw new Error('MIGRATION_EXPECTED_21_GEO01_RASTERS');
if (rasterLayers.filter(r => r.group === 'geo02').length !== 5) throw new Error('MIGRATION_EXPECTED_5_GEO02_MASKS');

// --- 3. GEO-01/02 metadata + LR01 / LR02 artifacts, verbatim -------------
const docFiles = [
  'world_lab/geo01/output/geography.v1.json', 'world_lab/geo01/output/corridor.v1.json',
  'world_lab/geo02/output/maplab_encoding.v1.json', 'world_lab/geo02/output/corridor_audit.v1.json',
  'world_lab/geo02/output/poi_po_kilns.proposed.v1.json',
];
for (const p of docFiles) add(`legacy/source/${path.basename(path.dirname(p))}_${path.basename(p)}`, readBuf(p));

const lr01Dir = path.join(ROOT, 'world_lab/lr01/output');
const lr01Files = [];
for (const f of fs.readdirSync(lr01Dir)) if (f.endsWith('.json')) lr01Files.push(f);
for (const sub of ['regions', 'poi_examples']) {
  const d = path.join(lr01Dir, sub);
  for (const f of fs.readdirSync(d)) if (f.endsWith('.json')) lr01Files.push(`${sub}/${f}`);
}
for (const f of lr01Files) add(`legacy/lr01/${f}`, readBuf(`world_lab/lr01/output/${f}`));

const lr02Dir = path.join(ROOT, 'world_lab/lr02/output');
for (const f of fs.readdirSync(lr02Dir)) if (f.endsWith('.json')) add(`legacy/lr02/${f}`, readBuf(`world_lab/lr02/output/${f}`));
for (const f of ['GAMEPLAY_HANDOFF.md', 'EVIDENCE_M1_M5.md', 'MILESTONE_M4_VISUAL.md']) add(`legacy/lr02/${f}`, readBuf(`world_lab/lr02/docs/${f}`));

// Six REAL Web runtime captures, preserved byte-for-byte, classified separately.
const webDir = path.join(lr02Dir, 'visual/web_evidence');
for (const f of fs.readdirSync(webDir)) if (f.endsWith('.png')) add(`evidence/web_real/${f}`, fs.readFileSync(path.join(webDir, f)));

// --- 4. source manifest ---------------------------------------------------
const sourceManifest = {
  schema: 'soh.wmp.source_manifest.v1',
  generatedBy: 'veyra-world-master/migration/migrate.mjs',
  status: 'ONE_TIME_MIGRATION_COMPLETE__NOT_A_RUNTIME_DEPENDENCY',
  gold: { commit: GOLD_COMMIT, path: GOLD_PATH, bytes: goldRaw.length, sha256: GOLD_SHA, readCount: 1, note: 'Read once through the pinned git object during the successful first migration. Reruns reuse the embedded byte-identical copy; the clean-room Master NEVER reads GOLD or MapLab again.' },
  canonicalCounts: Object.fromEntries(COLLECTIONS.map(k => [k, P[k].length])),
  world: { wAu: P.world.w, hAu: P.world.h, grid: { gw: 250, gh: 175, cellAu: 8 }, unit: 'authoring_unit', scaleStatus: 'UNDECIDED' },
  rasterLayers,
  counts: { geo01Rasters: 21, geo02Masks: 5, lr01Artifacts: lr01Files.length, embeddedFiles: entries.length + 1 },
  files: entries,
  self: { file: 'data/source_manifest.v1.json', sha256: 'SELF_REFERENTIAL_EXCLUDED', verifyCommand: 'sha256sum data/source_manifest.v1.json', note: 'The manifest cannot contain its own SHA-256; its real digest is pinned by reproduce.sh and the authoritative master manifest.' },
  selfCheck: null,
  prohibitedAfterMigration: ['git show', 'map_tower/veyra_gold', 'world_lab/geo01', 'world_lab/geo02', 'world_lab/lr01', 'world_lab/lr02', 'network'],
  note: 'All files under data/ are self-contained. build.mjs, api/, tests/ and tools/ import ONLY from data/ and each other.',
};
const manifestRel = 'source_manifest.v1.json';
function walk(dir) {
  let files = 0, bytes = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const w = walk(p); files += w.files; bytes += w.bytes; }
    else { files++; bytes += fs.statSync(p).size; }
  }
  return { files, bytes };
}
// Write, then record the exact whole-data/ file+byte check; repeat until stable.
for (let k = 0; k < 4; k++) {
  put(manifestRel, Buffer.from(JSON.stringify(sourceManifest, null, 2) + '\n'));
  const w = walk(DATA);
  if (sourceManifest.selfCheck?.files === w.files && sourceManifest.selfCheck?.bytes === w.bytes) break;
  sourceManifest.selfCheck = { ...w, status: 'WHOLE_DATA_DIR_CHECK' };
}
put(manifestRel, Buffer.from(JSON.stringify(sourceManifest, null, 2) + '\n'));
const check = walk(DATA);
if (check.files !== entries.length + 1) throw new Error(`MIGRATION_FILE_COUNT_MISMATCH ${check.files} != ${entries.length + 1}`);

console.log(`MIGRATION_OK goldSha=${GOLD_SHA.slice(0, 16)} rasters=${rasterLayers.length} files=${check.files} bytes=${check.bytes}`);
console.log(`  canonical=${JSON.stringify(sourceManifest.canonicalCounts)}`);
console.log(`  dataDir=${DATA}`);
