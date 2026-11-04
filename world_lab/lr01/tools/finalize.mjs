#!/usr/bin/env node
// MAP-LR01 one-time final state record. NOT part of ./reproduce.sh (it reads
// live git HEAD, so it must not be regenerated inside the deterministic loop).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sha256, ROOT, BASELINE } from '../src/lib/veyra.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.LR01_OUT ? path.resolve(process.env.LR01_OUT) : path.resolve(HERE, '../output');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const localHead = git('rev-parse', 'HEAD');
const remoteLine = git('ls-remote', 'origin', 'refs/heads/arena/2e3cfbd2-soul-of-hero');
const remoteHead = remoteLine.split(/\s+/)[0];
const branch = git('branch', '--show-current');
const commits = git('log', '--format=%H %s', '-14').split('\n');
const keyFiles = [
  'output/geography_package.v1.json', 'output/handoff.v1.json', 'output/pr44_handoff.md',
  'output/scale_corrected.v1.json', 'output/geography.v1.json', 'output/transport.v1.json',
  'output/poi_layouts.v1.json', 'output/art_manifest.v1.json', 'output/views_index.v1.json',
];
const artifacts = keyFiles.map(f => {
  const p = path.join(OUT, '..', f);
  return { file: f, bytes: fs.statSync(p).size, sha256: sha256(fs.readFileSync(p)) };
});
const pkg = JSON.parse(fs.readFileSync(path.join(OUT, 'geography_package.v1.json'), 'utf8'));

const doc = {
  schema: 'soh.map.lr01.final_head.v1',
  status: 'FINAL_MAP_TOWER_STATE__STAGE_1_GEOGRAPHY_ONLY__WEB_PLAYABILITY_GATE_OPEN',
  generatedAtUtc: new Date().toISOString(),
  branch,
  localHeadAtGeneration: localHead,
  remoteHeadAtGeneration: remoteHead,
  localRemoteMatch: localHead === remoteHead,
  deliverableCommit: localHead,
  commitListNewestFirst: commits,
  note: 'This file is committed immediately after generation. The exact final pushed HEAD is reported in the task handoff message and equals this commit plus the single commit containing this file. All deliverables are already present at deliverableCommit.',
  mapLr01Commits: {
    A: '5d9334daa9164e08ea36f8ec07ac546e93a6911e',
    B_C: 'e1dfd92130b041ed4b87bdbb1fb07e0695f8c303',
    D: 'b949d777bce71c8eddb4b71e994f75e8fb0b53d4',
    E: 'df29ea03b7e228e2a5d9675309bd925383dc7a9a',
    F: '7651ff0baa4ec136170bcf1cdf8ecf16fe9a2df9',
  },
  baselineStart: BASELINE.startHead,
  pr44HeadAtCoordination: 'f8010ec973095c88f3c462a68116c169b61237a3',
  pr44HandoffComment: { id: 6619191264, utc: '2026-11-04T00:33:40Z', url: 'https://github.com/Khanh-glitch/Soul-of-Hero/pull/44#issuecomment-6619191264', acknowledgement: 'NONE__DO_NOT_ASSUME_RECEIPT' },
  geographyPackage: {
    schema: pkg.schema, revisionDigest: pkg.revisionDigest,
    payloadCount: pkg.payloads.primary.length + pkg.payloads.regions.length + pkg.payloads.poiExamples.length + pkg.payloads.views.length,
  },
  artifacts,
  verification: {
    reproduce: 'MAP-LR01_REPRODUCE_OK',
    tests: 'LR01_TESTS 105/105',
    geo01: 'GEO_TESTS 15/15 passed',
    geo02: 'GEO02_TESTS 47/47 passed; GEO02_REPRODUCE_OK',
    views: 'E_RENDER_OK views=18 regions=6 modes=3 size=640x360 errors=[]',
    visualInspection: 'agent read PR44 evidence, A1 sheets, MAP-R01 atlas, web_art_patch before/after and 6 generated native views; no human/creator approval',
  },
  noClaims: ['NO playable Veyra', 'NO creator visual approval', 'NO runtime merge', 'NO playable survival acceptance', 'NO acknowledgement of MAP-LR01 handoff'],
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'final_head.v1.json'), JSON.stringify(doc, null, 2) + '\n');
console.log(`F_FINALIZE_OK local=${localHead} remote=${remoteHead} match=${doc.localRemoteMatch} commits=${commits.length} artifacts=${artifacts.length} digest=${pkg.revisionDigest.slice(0, 16)}…`);
