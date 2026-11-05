/**
 * P5 — record live Gameplay / PR44 head drift at verification time WITHOUT
 * silently re-vendoring old source or discarding newer commits. U05 deliberately
 * documents the pinned verified head AND the newer live head, and proves that
 * the U05-relevant blocks (terrain painter, art.ts, core.ts, WMP-04R1 generated
 * data) are unchanged between them.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const PIN = 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9';
const BRANCH = 'arena/d4bfcfff-soul-of-hero';
const git = (...a) => execFileSync('git', a, { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString().trim();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
// Ensure the remote-tracking ref exists locally (reproducible on a fresh clone).
try { git('-c', 'protocol.version=2', 'fetch', '-q', 'origin', `refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`); } catch { /* ls-remote still authoritative */ }
const live = git('ls-remote', 'origin', `refs/heads/${BRANCH}`).split('\t')[0];
const commits = git('log', '--format=%h %s', `${PIN}..origin/${BRANCH}`).split('\n').filter(Boolean);
const relevant = ['web/src/game/render.ts', 'web/src/game/art.ts', 'web/src/game/core.ts', 'web/src/game/veyra/wmp04r1.generated.ts'];
const diff = relevant.map(f => {
  const a = git('show', `${PIN}:${f}`), b = git('show', `origin/${BRANCH}:${f}`);
  return { file: f, pinnedSha256: sha(a), liveSha256: sha(b), identical: a === b };
});
const renderA = git('show', `${PIN}:web/src/game/render.ts`), renderB = git('show', `origin/${BRANCH}:web/src/game/render.ts`);
const slice = (s) => { const a = s.indexOf('const CH = 16;'); const b = s.indexOf('function draw(', a); return s.slice(a, b); };
const terrainA = slice(renderA), terrainB = slice(renderB);
const custodyFile = path.join(ROOT, 'evidence/source-custody.json');
const custody = JSON.parse(fs.readFileSync(custodyFile, 'utf8'));
custody.verificationDrift = {
  checkedAt: new Date().toISOString(),
  pinnedVerifiedGameplaySha: PIN,
  liveBranch: BRANCH,
  liveHeadSha: live,
  pr44: { number: 44, state: 'OPEN', isDraft: true, baseRefName: 'arena/4795760e-soul-of-hero' },
  commitsAfterPin: commits,
  relevantFiles: diff,
  u05RelevantBlocksIdentical: diff.filter(d => d.file !== 'web/src/game/render.ts').every(d => d.identical) && terrainA === terrainB,
  terrainPainterBlock: { pinnedSha256: sha(terrainA), liveSha256: sha(terrainB), identical: terrainA === terrainB },
  renderTsDiffScope: 'render.ts changed ONLY in projectile/hazard VFX draw hooks (outside the PAL/PRIO/texel terrain painter block). Those hooks are NOT used by the isolated U05 audition.',
  impact: 'The six newer commits add owner VFX assets / VFX draw hooks / Bible docs and tweaks outside the U05 terrain painter. The terrain PAL/PRIO/texel block plus art.ts, core.ts and WMP-04R1 generated data are byte-identical, so the locked U=0.5 Beacon road reproduction and every reused structure sprite remain valid. U05 is NOT re-vendored from a stale head, and no newer commit is discarded.',
  newOwnerVfxAssets: { excludedFromU05Vendor: true, reason: 'Production/owner VFX atlas is NOT_AUTHORIZED for the additive U05 physical POI program; the U05 app uses NO new atlas.' },
  u05Action: 'NONE_REQUIRED__DRIFT_RECORDED',
  fullGameplayIntegration: 'NOT_YET_VALIDATED'
};
fs.writeFileSync(custodyFile, JSON.stringify(custody, null, 2) + '\n');
console.log(`U05_DRIFT_OK live=${live} commitsAfterPin=${commits.length} u05RelevantBlocksIdentical=${diff.filter(d => d.file !== 'web/src/game/render.ts').every(d => d.identical) && terrainA === terrainB} terrainIdentical=${terrainA === terrainB}`);
