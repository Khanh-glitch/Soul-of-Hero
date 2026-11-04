#!/usr/bin/env node
// WMP-03 supplementary artifact index. Pins EVERY v3 file (except runtime logs
// and this index itself). v1/v2 indices are deliberately NOT regenerated.
import fs from 'node:fs';
import path from 'node:path';
import { MASTER, sha256 } from '../../lib/wmp.mjs';

const ROOT = path.join(MASTER, 'v3');
const SELF = 'v3/evidence/artifact_index.v3.json';
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name), rel = `v3/${path.relative(ROOT, p).split(path.sep).join('/')}`;
    if (e.isDirectory()) walk(p);
    else if (rel !== SELF && !rel.endsWith('.log')) files.push(rel);
  }
}
walk(ROOT);
files.sort();
const entries = files.map(f => { const b = fs.readFileSync(path.join(MASTER, f)); return { file: f, bytes: b.length, sha256: sha256(b) }; });
const v1 = JSON.parse(fs.readFileSync(path.join(MASTER, 'manifest.v1.json'), 'utf8'));
const v2 = JSON.parse(fs.readFileSync(path.join(MASTER, 'v2/manifest.v2.json'), 'utf8'));
const v3 = JSON.parse(fs.readFileSync(path.join(MASTER, 'v3/manifest.v3.json'), 'utf8'));
const h = p => { const b = fs.readFileSync(path.join(MASTER, p)); return { file: p, bytes: b.length, sha256: sha256(b) }; };
const key = {
  v1Manifest: h('manifest.v1.json'),
  v1ArtifactIndex: h('evidence/artifact_index.v1.json'),
  v2Manifest: h('v2/manifest.v2.json'),
  v2ArtifactIndex: h('v2/evidence/artifact_index.v2.json'),
  v2GeographicHandoff: h('v2/handoff/geographic_handoff.v2.json'),
  v3Manifest: h('v3/manifest.v3.json'),
  v3TypedHandoff: h('v3/handoff/map_to_gameplay_v3.json'),
  v3Interface: h('v3/interfaces/map_physical_semantics.v3.json'),
  v3MeasuredDelta: h('v3/layers/measured_delta.v3.json'),
  v3HandoffCheck: h('v3/evidence/handoff_check.v3.json'),
  v3WindowReport: h('v3/evidence/windows/window_report.v3.json'),
  v3ViewsIndex: h('v3/evidence/views/views_index.v3.json'),
  v3TestResults: h('v3/evidence/tests/test_results.v3.json'),
  v3NegativeFixtures: h('v3/evidence/tests/negative_fixtures.v3.json'),
  v3CleanRoom: h('v3/evidence/clean_room_v3.json'),
  v3Determinism: h('v3/evidence/build_determinism_v3.json'),
};
const doc = {
  schema: 'soh.wmp.v3.artifact_index.v1',
  status: 'SUPPLEMENTARY__AUTHORITATIVE_V3_MANIFEST_IS_v3/manifest.v3.json',
  policy: 'v1 and v2 tracked bytes (including both artifact indices) are byte-for-byte unchanged; v3 is ADDITIVE ONLY.',
  v1RevisionDigest: v1.revisionDigest,
  v2RevisionDigest: v2.revisionDigest,
  v3RevisionDigest: v3.revisionDigest,
  v1ManifestSha256: sha256(fs.readFileSync(path.join(MASTER, 'manifest.v1.json'))),
  v2ManifestSha256: sha256(fs.readFileSync(path.join(MASTER, 'v2/manifest.v2.json'))),
  v3ManifestSha256: sha256(fs.readFileSync(path.join(MASTER, 'v3/manifest.v3.json'))),
  count: entries.length, totalBytes: entries.reduce((s, e) => s + e.bytes, 0),
  excluded: [SELF, '*.log runtime transcripts'],
  keyArtifacts: key,
  files: entries,
};
const out = path.join(MASTER, SELF);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
console.log(`WMP_V3_ARTIFACT_INDEX_OK files=${entries.length} bytes=${doc.totalBytes} v1Manifest=${doc.v1ManifestSha256.slice(0, 16)} v2Manifest=${doc.v2ManifestSha256.slice(0, 16)} v3Manifest=${doc.v3ManifestSha256.slice(0, 16)}`);
