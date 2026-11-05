#!/usr/bin/env node
/** Copy the pinned Gameplay vitest suite verbatim into BOTH the untouched
 *  baseline and the pilot, so the same regression suite can be run on each.
 *  Node fs is used only at build time; tests are never shipped to the browser. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GAMEPLAY_HEAD } from './vendor.mjs';
const PILOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(PILOT, '..');
const sha = b => createHash('sha256').update(b).digest('hex');
// The Gameplay vitest suite validates the FULL pinned LR01 geography payload
// (79 JSON payloads + 21 rasters), so vendor all of web/geography too.
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', `${GAMEPLAY_HEAD}`, '--', 'web/tests', 'web/geography'], { cwd: REPO, encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
const recs = [];
for (const rel of files) {
  const buf = Buffer.from(execFileSync('git', ['show', `${GAMEPLAY_HEAD}:${rel}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }));
  for (const dest of ['web-baseline', 'web-pilot']) {
    const out = path.join(PILOT, dest, rel.replace(/^web\//, ''));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
  }
  recs.push({ file: rel.replace(/^web\//, ''), sourceCommit: GAMEPLAY_HEAD, bytes: buf.length, sha1: execFileSync('git', ['hash-object', '--stdin'], { input: buf, cwd: REPO, encoding: 'utf8' }).trim(), sha256: sha(buf) });
}
fs.writeFileSync(path.join(PILOT, 'TEST_PROVENANCE.json'), JSON.stringify({ gameplayHead: GAMEPLAY_HEAD, files: recs.length, bytes: recs.reduce((a, b) => a + b.bytes, 0), records: recs }, null, 2) + '\n');
console.log(`WMP04R1_VENDOR_TESTS_OK files=${recs.length} bytes=${recs.reduce((a, b) => a + b.bytes, 0)} gameplay=${GAMEPLAY_HEAD.slice(0, 12)}`);
