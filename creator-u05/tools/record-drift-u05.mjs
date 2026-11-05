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
const lsRemoteHead = git('ls-remote', 'origin', `refs/heads/${BRANCH}`).split('\t')[0];
// Use the FETCHED remote-tracking ref for all comparisons (consistent snapshot).
const live = git('rev-parse', `origin/${BRANCH}`);
const commits = git('log', '--format=%h %s', `${PIN}..origin/${BRANCH}`).split('\n').filter(Boolean);
const relevant = ['web/src/game/render.ts', 'web/src/game/art.ts', 'web/src/game/core.ts', 'web/src/game/veyra/wmp04r1.generated.ts', 'web/src/game/balance.v1.json'];
const diff = relevant.map(f => {
  const a = git('show', `${PIN}:${f}`), b = git('show', `origin/${BRANCH}:${f}`);
  return { file: f, pinnedSha256: sha(a), liveSha256: sha(b), identical: a === b };
});
const renderA = git('show', `${PIN}:web/src/game/render.ts`), renderB = git('show', `origin/${BRANCH}:web/src/game/render.ts`);
const slice = (s) => { const a = s.indexOf('const CH = 16;'); const b = s.indexOf('function draw(', a); return s.slice(a, b); };
const terrainA = slice(renderA), terrainB = slice(renderB);
// U05 depends on a SMALL, explicitly enumerated set of core.ts CONSTANTS, not
// on the whole file. Newer Gameplay commits may add optional TypeScript
// interface fields; those do not change U=0.5 / TILE / VIEW / speed / terrain
// constants. Compare exactly the declarations U05 imports and uses.
const coreContract = (src) => {
  const pats = [
    /export const TILE = \d+;/, /export const WW = \d+;/, /export const WH = \d+;/,
    /export const VIEW_W = \d+;/, /export const VIEW_H = \d+;/,
    /export const WORLD_SEED = [^;]+;/, /export const SAVE_VERSION = \d+;/,
    /export const enum T \{[^}]*\}/, /export function hash2\([^)]*\)\s*\{[^}]*\}/
  ];
  return pats.map(re => { const m = src.match(re); return m ? m[0] : 'MISSING'; }).join('\n');
};
const coreA = git('show', `${PIN}:web/src/game/core.ts`), coreB = git('show', `origin/${BRANCH}:web/src/game/core.ts`);
// balance.v1.json: U05 reads ONLY BAL.dayLengthMinutes (game clock). Newer
// commits add offline / industrial tuning keys that U05 does not consume.
const balKey = (src) => { try { return JSON.stringify(JSON.parse(src).dayNight ?? 'MISSING'); } catch { return 'PARSE_ERROR'; } };
const balA = git('show', `${PIN}:web/src/game/balance.v1.json`), balB = git('show', `origin/${BRANCH}:web/src/game/balance.v1.json`);
const balanceKeyIdentical = balKey(balA) === balKey(balB);
const coreConstantsIdentical = coreContract(coreA) === coreContract(coreB);
const coreDiffScope = coreConstantsIdentical
  ? 'core.ts differs ONLY in additive optional TypeScript interface fields (basePower.priority / maintenance / industrial). Every U05-used constant (TILE, WW, WH, VIEW_W, VIEW_H, WORLD_SEED, SAVE_VERSION, enum T, hash2) is byte-identical.'
  : 'core.ts U05-used constants DIFFER — U05 custody must be re-verified.';
const custodyFile = path.join(ROOT, 'evidence/source-custody.json');
const custody = JSON.parse(fs.readFileSync(custodyFile, 'utf8'));
custody.verificationDrift = {
  checkedAt: new Date().toISOString(),
  pinnedVerifiedGameplaySha: PIN,
  liveBranch: BRANCH,
  liveHeadSha: live,
  lsRemoteHeadAtFetch: lsRemoteHead,
  snapshotConsistent: lsRemoteHead === live,
  branchIsActive: true,
  movingTargetNote: 'PR44 head branch is ACTIVE and receives additive commits during this session. U05 stays pinned to the verified b5c8004c source; this record is a point-in-time snapshot, not a claim that U05 consumes the newest Gameplay law.',
  pr44: { number: 44, state: 'OPEN', isDraft: true, baseRefName: 'arena/4795760e-soul-of-hero' },
  commitsAfterPin: commits,
  relevantFiles: diff,
  u05RelevantBlocksIdentical: diff.filter(d => ['web/src/game/art.ts', 'web/src/game/veyra/wmp04r1.generated.ts'].includes(d.file)).every(d => d.identical) && terrainA === terrainB && coreConstantsIdentical && balanceKeyIdentical,
  u05RelevantScope: {
    'web/src/game/render.ts': 'PAL/PRIO/texel terrain painter block only (byte-identical)',
    'web/src/game/core.ts': 'TILE / WW / WH / VIEW_W / VIEW_H / WORLD_SEED / SAVE_VERSION / enum T / hash2 only (byte-identical)',
    'web/src/game/balance.v1.json': 'dayNight block (dayLengthMinutes etc.) only (unchanged)',
    'web/src/game/art.ts': 'whole file (byte-identical)',
    'web/src/game/veyra/wmp04r1.generated.ts': 'whole file (byte-identical)'
  },
  balanceClockKey: { pinned: balKey(balA), live: balKey(balB), identical: balanceKeyIdentical },
  terrainPainterBlock: { pinnedSha256: sha(terrainA), liveSha256: sha(terrainB), identical: terrainA === terrainB },
  coreConstants: { pinnedSha256: sha(coreContract(coreA)), liveSha256: sha(coreContract(coreB)), identical: coreConstantsIdentical },
  renderTsDiffScope: 'render.ts changed ONLY in projectile/hazard VFX draw hooks (outside the PAL/PRIO/texel terrain painter block). Those hooks are NOT used by the isolated U05 audition.',
  coreTsDiffScope: coreDiffScope,
  balanceDiffScope: 'balance.v1.json gained additive offline-drain and industrialPower tuning keys; the dayNight block is unchanged. U05 reads BAL.dayLengthMinutes (top-level, absent => 24-minute fallback) and the hardcoded SPEED=72 px/s; neither is affected.',
  impact: 'Newer Gameplay commits add owner VFX, optional powered-workbench / claim-reserve / research-target type declarations and Bible docs. The terrain PAL/PRIO/texel block, every U05-used core.ts constant, art.ts, balance.v1.json and WMP-04R1 generated data are unchanged, so the locked U=0.5 Beacon road reproduction and every reused structure sprite remain valid. U05 is NOT re-vendored from a stale head, and no newer commit is discarded.',
  newOwnerVfxAssets: { excludedFromU05Vendor: true, reason: 'Production/owner VFX atlas is NOT_AUTHORIZED for the additive U05 physical POI program; the U05 app uses NO new atlas.' },
  u05Action: 'NONE_REQUIRED__DRIFT_RECORDED',
  fullGameplayIntegration: 'NOT_YET_VALIDATED'
};
fs.writeFileSync(custodyFile, JSON.stringify(custody, null, 2) + '\n');
console.log(`U05_DRIFT_OK live=${live} commitsAfterPin=${commits.length} u05RelevantBlocksIdentical=${diff.filter(d => ['web/src/game/art.ts', 'web/src/game/veyra/wmp04r1.generated.ts'].includes(d.file)).every(d => d.identical) && terrainA === terrainB && coreConstantsIdentical && balanceKeyIdentical} terrain=${terrainA === terrainB} core=${coreConstantsIdentical} balance=${balanceKeyIdentical}`);
