#!/usr/bin/env node
// WMP-01 supplementary artifact index. CLEAN-ROOM SAFE.
// The authoritative manifest.v1.json already carries EVERY compiler child digest.
// This index additionally pins the evidence, docs, API, tests, tools and lib files
// that are produced/consumed around that manifest, for the final handoff.
import fs from 'node:fs';
import path from 'node:path';
import { MASTER, sha256 } from '../lib/wmp.mjs';

const SELF = 'evidence/artifact_index.v1.json';
const roots = ['evidence', 'docs', 'api', 'tests', 'tools', 'lib'];
const single = ['manifest.v1.json', 'build.mjs', 'reproduce.sh', 'clean-room.sh', 'README.md', 'data/source_manifest.v1.json'];
const files = [];
function walk(relDir) {
  const d = path.join(MASTER, relDir);
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = `${relDir}/${e.name}`;
    if (e.isDirectory()) walk(rel);
    else if (rel !== SELF && !rel.endsWith('.log')) files.push(rel);
  }
}
for (const r of roots) walk(r);
for (const f of single) if (fs.existsSync(path.join(MASTER, f))) files.push(f);
files.sort();
const entries = files.map(f => { const b = fs.readFileSync(path.join(MASTER, f)); return { file: f, bytes: b.length, sha256: sha256(b) }; });
const manifest = JSON.parse(fs.readFileSync(path.join(MASTER, 'manifest.v1.json'), 'utf8'));
const doc = {
  schema: 'soh.wmp.artifact_index.v1', status: 'SUPPLEMENTARY__AUTHORITATIVE_MANIFEST_IS_manifest.v1.json',
  masterRevisionDigest: manifest.revisionDigest,
  manifestSha256: sha256(fs.readFileSync(path.join(MASTER, 'manifest.v1.json'))),
  count: entries.length, totalBytes: entries.reduce((s, e) => s + e.bytes, 0),
  excluded: [SELF, '*.log runtime transcripts (evidence/reproduce.log, evidence/clean_room.log)'], files: entries,
};
fs.writeFileSync(path.join(MASTER, SELF), JSON.stringify(doc, null, 2) + '\n');
console.log(`WMP_ARTIFACT_INDEX_OK files=${entries.length} bytes=${doc.totalBytes} manifest=${doc.manifestSha256.slice(0, 16)}`);
