/**
 * SOH — MAP-GEO-REJOIN-02 — LIVE HEAD / CUSTODY PREFLIGHT.
 * Read-only. Records exact Map / Gameplay / main SHAs, PR44 state, protected
 * baseline SHAs, painter-block provenance and Gameplay source drift.
 * Output: creator-u05/evidence/mapgeo02-preflight.json
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(REPO, 'creator-u05');
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
const gitBytes = (...a) => execFileSync('git', a, { cwd: REPO, maxBuffer: 32 * 1024 * 1024 });
const gh = (...a) => execFileSync('gh', a, { cwd: REPO, encoding: 'utf8' }).trim();
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const shaFile = p => sha(fs.readFileSync(p));

const PINNED = {
  map: '3e02fde05a24f6d645ea00ed5ab78900655e1272',
  gameplayObserved: '6e7d116b4400ea3c24373fe884b7fad258f4f7bc',
  main: '5214788933b1a827f3a177d11ff486433dfe5e8a',
  creatorVerified: '5b3e683402bbc8540dea9404576164097e753f97',
  u05Pin: 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9',
  mapgeo01ObservedGameplay: '2f0836587b76a4a98fffedf8c202fb37cbb2a67c'
};
const remote = {};
for (const line of git('ls-remote', 'origin',
  'refs/heads/arena/2e3cfbd2-soul-of-hero',
  'refs/heads/arena/d4bfcfff-soul-of-hero',
  'refs/heads/main', 'refs/pull/44/head').split('\n')) {
  const [oid, ref] = line.split('\t'); remote[ref] = oid;
}
const mapLive = remote['refs/heads/arena/2e3cfbd2-soul-of-hero'];
const gameplayLive = remote['refs/heads/arena/d4bfcfff-soul-of-hero'];
const mainLive = remote['refs/heads/main'];
const prHead = remote['refs/pull/44/head'];
if (mapLive !== PINNED.map) throw Error('MAPGEO02_MAP_LIVE_REF_MOVED ' + mapLive);
if (mainLive !== PINNED.main) throw Error('MAPGEO02_MAIN_REF_MOVED ' + mainLive);

const local = {
  head: git('rev-parse', 'HEAD'),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  headMatchesPinned: git('rev-parse', 'HEAD') === PINNED.map,
  note: 'Worktree file list is intentionally NOT frozen here (it is a live snapshot); immutable custody is proven by the three protected baseline SHAs and the GOLD/painter digests below.'
};
if (local.head !== PINNED.map || local.branch !== 'arena/2e3cfbd2-soul-of-hero')
  throw Error('MAPGEO02_LOCAL_HEAD_OR_BRANCH_MISMATCH');

const pr = JSON.parse(gh('pr', 'view', '44', '--json', 'state,headRefOid,headRefName,updatedAt'));
const painter = h => {
  const src = gitBytes('cat-file', '-p', `${h}:web/src/game/render.ts`).toString('utf8');
  const a = src.indexOf('// ---------- terrain palette ----------');
  const b = src.indexOf('function getChunk(');
  const block = src.slice(a, b);
  return { bytes: Buffer.byteLength(block), sha256: sha(Buffer.from(block)) };
};
const painterHeads = Object.fromEntries(Object.entries({
  u05Pin: PINNED.u05Pin, mapgeo01Observed: PINNED.mapgeo01ObservedGameplay,
  mapgeo02Pinned: PINNED.gameplayObserved, pr44LiveNow: pr.headRefOid
}).map(([k, h]) => [k, painter(h)]));
const painterSha = 'f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803';
const painterIdentical = Object.values(painterHeads).every(p => p.sha256 === painterSha && p.bytes === 8276);

const artBlobs = Object.fromEntries(Object.entries({
  u05Pin: PINNED.u05Pin, mapgeo01Observed: PINNED.mapgeo01ObservedGameplay,
  mapgeo02Pinned: PINNED.gameplayObserved, pr44LiveNow: pr.headRefOid
}).map(([k, h]) => [k, git('rev-parse', `${h}:web/src/game/art.ts`)]));
const bible = Object.fromEntries(Object.entries({
  u05Pin: PINNED.u05Pin, mapgeo02Pinned: PINNED.gameplayObserved, pr44LiveNow: pr.headRefOid
}).map(([k, h]) => [k, {
  blob: git('rev-parse', `${h}:web/ref/bible.md`),
  fileSha256: sha(gitBytes('cat-file', '-p', `${h}:web/ref/bible.md`))
}]));

const protectedFiles = {
  terrainOnly: { file: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html', expected: '540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0' },
  nature01: { file: 'creator-u05/SoulOfHero_Nature01_U05.html', expected: 'ac4d54e310f0f3cf7e0e12d728bc5e9ad62f801994be37ce64f76b099af4a0a7' },
  nature02: { file: 'creator-u05/SoulOfHero_Nature02_ForestSlice.html', expected: '6e1e897a0e365412f6bc92d65390dc10bf7b0352e6ad8ef4a1c38e57f4f30fa6' }
};
for (const v of Object.values(protectedFiles)) {
  v.sha256 = shaFile(path.join(REPO, v.file));
  v.unchanged = v.sha256 === v.expected;
  if (!v.unchanged) throw Error('MAPGEO02_PROTECTED_BASELINE_CHANGED ' + v.file);
}

const WMP = JSON.parse(fs.readFileSync(path.join(REPO, 'veyra-world-master/CURRENT_WORLD_MASTER.json'), 'utf8'));
const goldSha = shaFile(path.join(REPO, 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json'));
const out = {
  schema: 'soh.mapgeo02.preflight.v1',
  task: 'SOH — MAP-GEO-REJOIN-02',
  generatedAt: new Date().toISOString(),
  pinnedHeads: PINNED,
  liveRefs: { map: mapLive, gameplayBranch: gameplayLive, main: mainLive, pr44Head: prHead },
  gameplayDrift: {
    pinnedObserved: PINNED.gameplayObserved,
    liveNow: pr.headRefOid,
    movedDuringTask: PINNED.gameplayObserved !== pr.headRefOid,
    note: 'Gameplay/PR44 moved AFTER the MAP-GEO-02 request pinned 6e7d116b…; both SHAs are reported. PR44 was NOT edited, merged or closed.',
    changedFilesCount: Number(git('diff', '--name-only', PINNED.gameplayObserved, pr.headRefOid).split('\n').filter(Boolean).length)
  },
  pr44: pr,
  local,
  protectedExecutables: protectedFiles,
  activeAuthority: {
    activeRevision: WMP.activeRevision, activeManifest: WMP.activeManifest,
    status: WMP.status, activeRuntimeReader: WMP.activeRuntimeReader,
    basePhysicalRevision: WMP.basePhysicalRevision,
    productionAtlas: WMP.artDirection?.productionAtlas ?? 'NOT_AUTHORIZED',
    creatorVisualApproval: WMP.artDirection?.creatorVisualApproval ?? 'NOT_REQUESTED',
    artDirection: WMP.artDirection
  },
  goldSha256: goldSha,
  gameplaySourceProvenance: {
    painterExpectedSha256: painterSha, painterHeads, painterIdenticalAcrossAllHeads: painterIdentical,
    note: 'Painter block byte-identical at U05 pin / MAP-GEO-01 observed / MAP-GEO-02 pinned / new PR44 head. NO re-vendoring.',
    artTs: { ...artBlobs, vendoredBlob: git('rev-parse', 'HEAD:creator-u05/web-u05/src/game/art.ts'),
      note: 'Live art.ts added S.claim; vendored U05 art.ts stays at the U05 pin. Do NOT silently re-vendor.' },
    bible: { ...bible,
      worktreePathPresent: fs.existsSync(path.join(REPO, 'web/ref/bible.md')),
      vendoredCopySha256: shaFile(path.join(ROOT, 'web-u05/ref/bible.md')),
      vendoredDiffersFromLive: shaFile(path.join(ROOT, 'web-u05/ref/bible.md')) !== bible.pr44LiveNow.fileSha256 }
  },
  scope: {
    task: 'Correct MGP-D01 (bridge projection) and MGP-D10 (cliff projection); no new geography',
    not: ['another world', 'geography viewer', 'POI audition', 'nature system', 'product roadmap',
      'GOLD amendment', 'resource placement', 'POI architecture', 'production gameplay', 'PR44 edit/merge']
  }
};
fs.mkdirSync(path.join(ROOT, 'evidence'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'evidence/mapgeo02-preflight.json'), JSON.stringify(out, null, 2));
console.log(`U05_MAPGEO02_PREFLIGHT_OK map=${mapLive.slice(0, 8)} gameplayPinned=${PINNED.gameplayObserved.slice(0, 8)} ` +
  `gameplayLive=${pr.headRefOid.slice(0, 8)} drift=${out.gameplayDrift.movedDuringTask} painterIdentical=${painterIdentical} ` +
  `pr44=${pr.state} baselines=${Object.values(protectedFiles).every(v => v.unchanged)}`);
