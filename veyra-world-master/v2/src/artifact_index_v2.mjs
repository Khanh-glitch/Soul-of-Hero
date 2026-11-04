#!/usr/bin/env node
// WMP-02 supplementary artifact index. Pins EVERY v2 file (except runtime logs
// and this index itself), and explicitly separates the untouched v1 index.
import fs from 'node:fs';
import path from 'node:path';
import { MASTER, sha256 } from '../../lib/wmp.mjs';

const ROOT = path.join(MASTER, 'v2');
const SELF = 'v2/evidence/artifact_index.v2.json';
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name), rel = `v2/${path.relative(ROOT, p).split(path.sep).join('/')}`;
    if (e.isDirectory()) walk(p);
    else if (rel !== SELF && !rel.endsWith('.log')) files.push(rel);
  }
}
walk(ROOT);
files.sort();
const entries = files.map(f => { const b = fs.readFileSync(path.join(MASTER, f)); return { file: f, bytes: b.length, sha256: sha256(b) }; });
const v1 = JSON.parse(fs.readFileSync(path.join(MASTER, 'manifest.v1.json'), 'utf8'));
const v2 = JSON.parse(fs.readFileSync(path.join(MASTER, 'v2/manifest.v2.json'), 'utf8'));
const h = p => { const b = fs.readFileSync(path.join(MASTER, p)); return { file: p, bytes: b.length, sha256: sha256(b) }; };
const key = {
  v1Manifest: h('manifest.v1.json'),
  v1ArtifactIndex: h('evidence/artifact_index.v1.json'),
  v2Manifest: h('v2/manifest.v2.json'),
  geographicHandoff: h('v2/handoff/geographic_handoff.v2.json'),
  handoffStructuralCheck: h('v2/handoff/handoff_check.v2.json'),
  windowReport: h('v2/evidence/windows/window_report.v2.json'),
  technicalViewsIndex: h('v2/evidence/views/index_v2.json'),
  testResults: h('v2/evidence/tests/results_v2.json'),
  negativeFixtures: h('v2/evidence/tests/negative_fixtures_v2.json'),
};
const doc = {
  schema: 'soh.wmp.v2.artifact_index.v1',
  status: 'SUPPLEMENTARY__AUTHORITATIVE_V2_MANIFEST_IS_v2/manifest.v2.json',
  v1Policy: 'evidence/artifact_index.v1.json is a PINNED WMP-01 index and was deliberately NOT regenerated: v2 source lives under v2/, so all v1 digests and the v1 index remain byte-identical.',
  v1RevisionDigest: v1.revisionDigest,
  v1ManifestSha256: sha256(fs.readFileSync(path.join(MASTER, 'manifest.v1.json'))),
  v2RevisionDigest: v2.revisionDigest,
  v2ManifestSha256: sha256(fs.readFileSync(path.join(MASTER, 'v2/manifest.v2.json'))),
  count: entries.length, totalBytes: entries.reduce((s, e) => s + e.bytes, 0),
  excluded: [SELF, '*.log runtime transcripts'],
  keyArtifacts: key,
  files: entries,
};
const out = path.join(MASTER, SELF);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
console.log(`WMP_V2_ARTIFACT_INDEX_OK files=${entries.length} bytes=${doc.totalBytes} v1Manifest=${doc.v1ManifestSha256.slice(0, 16)} v2Manifest=${doc.v2ManifestSha256.slice(0, 16)}`);
