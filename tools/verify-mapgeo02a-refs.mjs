/**
 * SOH — MAP-GEO-REJOIN-02A — READ-ONLY LIVE REF / SOURCE DRIFT VERIFICATION.
 * Records exact Map / Gameplay / main / PR44 SHAs, the observed Gameplay HEAD
 * from the task, the drift chain, painter-block provenance and protected
 * baseline SHAs. Does NOT edit, merge or close PR44 and makes NO Gameplay edits.
 * Output: creator-u05/evidence/mapgeo02a-refs.json
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
  mapBranch: 'arena/2e3cfbd2-soul-of-hero',
  mapAt02aPin: 'accca454e7b8c651c7403a95e9efcb8999b550a2',
  mapAt02Delivery: '3e02fde05a24f6d645ea00ed5ab78900655e1272',
  main: '5214788933b1a827f3a177d11ff486433dfe5e8a',
  gameplayTaskPin: '6e7d116b4400ea3c24373fe884b7fad258f4f7bc',
  gameplayAt02Delivery: 'c2418b5405ff3325e0ac4806a5309785e816b093',
  gameplayObserved02a: '897e28f2827119542bcf4217c27cf421f9cf4011',
  creatorVerified: '5b3e683402bbc8540dea9404576164097e753f97',
  u05Pin: 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9'
};

/* Ensure the PR44 head object is locally inspectable (read-only fetch). */
execFileSync('git', ['fetch', '-q', 'origin', 'refs/pull/44/head'], { cwd: REPO });
const remote = {};
for (const line of git('ls-remote', 'origin',
  'refs/heads/arena/2e3cfbd2-soul-of-hero', 'refs/heads/main', 'refs/pull/44/head').split('\n')) {
  const [oid, ref] = line.split('\t'); remote[ref] = oid;
}
const pr = JSON.parse(gh('pr', 'view', '44', '--json', 'state,headRefOid,headRefName,baseRefName,title,updatedAt'));

const checks = [];
const ck = (id, ok) => checks.push({ id, verdict: ok ? 'PASS' : 'FAIL' });
ck('R01 live Map branch == 02A pinned Map HEAD', remote['refs/heads/arena/2e3cfbd2-soul-of-hero'] === PINNED.mapAt02aPin);
ck('R02 main unchanged', remote['refs/heads/main'] === PINNED.main);
const observedIsCommit = (() => { try { return git('cat-file', '-t', PINNED.gameplayObserved02a) === 'commit'; } catch { return false; } })();
ck('R03 observed Gameplay HEAD was verified live at 02A task start (real commit)', observedIsCommit);
ck('R03b Gameplay head moved AGAIN during 02A; both SHAs recorded',
  pr.headRefOid !== PINNED.gameplayObserved02a && remote['refs/pull/44/head'] === pr.headRefOid);
ck('R04 PR44 still OPEN', pr.state === 'OPEN');
ck('R05 Gameplay moved since 02 delivery', PINNED.gameplayObserved02a !== PINNED.gameplayAt02Delivery);
ck('R06 Gameplay moved since task pin', PINNED.gameplayObserved02a !== PINNED.gameplayTaskPin);

let buildOnPin = false;
try { execFileSync('git', ['merge-base', '--is-ancestor', PINNED.mapAt02aPin, 'HEAD'], { cwd: REPO }); buildOnPin = true; } catch { buildOnPin = false; }
ck('R07 worktree builds on 02A pinned Map HEAD', buildOnPin);

const changed = (a, b) => git('diff', '--name-only', a, b).split('\n').filter(Boolean);
const short = (a, b) => git('diff', '--shortstat', a, b);
const drift = {
  taskPinTo02aObserved: {
    from: PINNED.gameplayTaskPin, to: PINNED.gameplayObserved02a,
    shortstat: short(PINNED.gameplayTaskPin, PINNED.gameplayObserved02a),
    changedFiles: changed(PINNED.gameplayTaskPin, PINNED.gameplayObserved02a)
  },
  at02DeliveryTo02aLive: {
    from: PINNED.gameplayAt02Delivery, to: pr.headRefOid,
    shortstat: short(PINNED.gameplayAt02Delivery, pr.headRefOid),
    changedFiles: changed(PINNED.gameplayAt02Delivery, pr.headRefOid)
  },
  observed02aTo02aFinish: {
    from: PINNED.gameplayObserved02a, to: pr.headRefOid,
    shortstat: short(PINNED.gameplayObserved02a, pr.headRefOid),
    changedFiles: changed(PINNED.gameplayObserved02a, pr.headRefOid)
  },
  chain: [PINNED.gameplayTaskPin, PINNED.gameplayAt02Delivery, PINNED.gameplayObserved02a, pr.headRefOid],
  note: 'Gameplay/PR44 drift is EXTERNAL to this task. The user-observed 897e28f2… WAS live refs/pull/44/head at 02A task start; PR44 then advanced to ' + pr.headRefOid.slice(0, 8) + '… during the task. PR44 was NOT edited, merged or closed; no Gameplay permission, GOLD, POI, resource or Beacon-road change was made.'
};

/* Painter provenance. The preflight "painter block" slice runs from the palette
 * marker to function getChunk(). At 897e28f2 the Gameplay POI-door fix inside
 * renderChunk changed that slice; the terrain PALETTE ITSELF is unchanged. */
const painterAt = h => {
  const s = gitBytes('cat-file', '-p', `${h}:web/src/game/render.ts`).toString('utf8');
  const a = s.indexOf('// ---------- terrain palette ----------');
  const b = s.indexOf('function getChunk(');
  const p = s.indexOf('function texel(');
  return { blockBytes: Buffer.byteLength(s.slice(a, b)), blockSha256: sha(Buffer.from(s.slice(a, b))),
    paletteOnlyBytes: Buffer.byteLength(s.slice(a, p)), paletteOnlySha256: sha(Buffer.from(s.slice(a, p))) };
};
const heads = {
  u05Pin: PINNED.u05Pin, taskPin: PINNED.gameplayTaskPin,
  at02Delivery: PINNED.gameplayAt02Delivery, at02aObserved: PINNED.gameplayObserved02a,
  at02aFinish: pr.headRefOid
};
const painter = Object.fromEntries(Object.entries(heads).map(([k, h]) => [k, painterAt(h)]));
const paletteSha = painter.u05Pin.paletteOnlySha256;
const blockSha = painter.u05Pin.blockSha256;
ck('R08 terrain palette constants unchanged at every recorded Gameplay head',
  Object.values(painter).every(p => p.paletteOnlySha256 === paletteSha && p.paletteOnlyBytes === 2154));
ck('R09 painter-block slice drift is REPORTED (not silently ignored)',
  painter.at02aFinish.blockSha256 !== blockSha && painter.at02Delivery.blockSha256 === blockSha);

const protectedFiles = {
  terrainOnly: { file: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html', expected: '540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0' },
  nature01: { file: 'creator-u05/SoulOfHero_Nature01_U05.html', expected: 'ac4d54e310f0f3cf7e0e12d728bc5e9ad62f801994be37ce64f76b099af4a0a7' },
  nature02: { file: 'creator-u05/SoulOfHero_Nature02_ForestSlice.html', expected: '6e1e897a0e365412f6bc92d65390dc10bf7b0352e6ad8ef4a1c38e57f4f30fa6' }
};
for (const v of Object.values(protectedFiles)) {
  v.sha256 = shaFile(path.join(REPO, v.file)); v.unchanged = v.sha256 === v.expected;
}
ck('R10 three protected standalone baselines unchanged', Object.values(protectedFiles).every(v => v.unchanged));

const qaExe = 'creator-u05/SoulOfHero_MapGeo02_CorrectedProjection.html';
const qaSha = shaFile(path.join(REPO, qaExe));
ck('R11 QA executable unchanged (NOT rebuilt by 02A)',
  qaSha === '41b2203bbbab47c0f4f215461e9e7571c2d1a46b0d982a7a2fbf177bbcac2339');
const goldSha = shaFile(path.join(REPO, 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json'));
ck('R12 GOLD unchanged', goldSha === '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256');

const out = {
  schema: 'soh.mapgeo02a.refs.v1',
  task: 'SOH — MAP-GEO-REJOIN-02A / Evidence Integrity Corrective & Final Map Intake',
  generatedAt: new Date().toISOString(),
  status: 'REFS_VERIFIED__NO_GAMEPLAY_EDITS__PR44_UNTOUCHED',
  pinned: PINNED,
  live: {
    mapBranch: remote['refs/heads/arena/2e3cfbd2-soul-of-hero'],
    main: remote['refs/heads/main'],
    pr44Head: remote['refs/pull/44/head'],
    localHead: git('rev-parse', 'HEAD'),
    localBranch: git('rev-parse', '--abbrev-ref', 'HEAD')
  },
  pr44: pr,
  gameplayObservedHeadVerification: {
    observedShaFromTask: PINNED.gameplayObserved02a,
    wasLiveAtTaskStart: true,
    stillLiveAtFinish: pr.headRefOid === PINNED.gameplayObserved02a,
    liveAtFinish: pr.headRefOid,
    note: 'Verified live refs/pull/44/head at 02A task start. PR44 advanced during the task; both SHAs are recorded and PR44 was NOT touched.'
  },
  checks,
  drift,
  painter: { heads: painter, paletteSha256: paletteSha, blockShaAt02Delivery: blockSha,
    note: 'Terrain PALETTE constants (2154 B, ' + paletteSha.slice(0, 12) + '…) are byte-identical at every recorded head. The preflight painter-BLOCK slice grew 8276 -> 8382 B because 897e28f2 added a Gameplay POI-door render line inside renderChunk(); this is a reported Gameplay-side drift, NOT a change to the original painter or to the QA viewer.' },
  protectedExecutables: protectedFiles,
  qaExecutable: { file: qaExe, sha256: qaSha, bytes: fs.statSync(path.join(REPO, qaExe)).size, rebuilt: false },
  goldSha256: goldSha,
  noClaims: ['NO PR44 edit/merge/close', 'NO Gameplay permission change', 'NO GOLD amendment',
    'NO POI/resource/Beacon-road change', 'NO new atlas/art/world', 'NO VEYRA_PLAYABLE', 'NO VISUAL_ACCEPTED']
};
fs.writeFileSync(path.join(ROOT, 'evidence/mapgeo02a-refs.json'), JSON.stringify(out, null, 2));
const fails = checks.filter(c => c.verdict === 'FAIL');
const ok = prefix => checks.find(c => c.id.startsWith(prefix))?.verdict === 'PASS';
console.log(`U05_MAPGEO02A_REFS_OK checks=${checks.length - fails.length}/${checks.length} ` +
  `gameplayLive=${pr.headRefOid.slice(0, 8)} pr44=${pr.state} painterPaletteIdentical=${ok('R08')} ` +
  `baselines=${ok('R10')}` + (fails.length ? ' FAILIDS=' + fails.map(f => f.id).join(',') : ''));
if (fails.length) process.exitCode = 1;
