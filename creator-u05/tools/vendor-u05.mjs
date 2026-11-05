/**
 * U05 SOURCE CUSTODY — reproducible vendor step.
 *
 * P4 requires an isolated SOH renderer audition AGAINST THE VERIFIED LATEST
 * Gameplay SHA, not a silent fork of the older source vendored by LW-01. This
 * script therefore:
 *   1. re-verifies the pinned Map worktree / active WMP-04R1 pointer;
 *   2. extracts a VERBATIM subset of `web/` from the verified Gameplay commit
 *      (large non-imported evidence/geography/VFX atlases are excluded to stay
 *      inside the artifact budget; every included byte is SHA-256 recorded);
 *   3. copies four LW-01 chunk-method modules (explicitly permitted reuse) with
 *      a recorded, minimal import-path rewrite;
 *   4. GENERATES `src/u05/terrain.ts` from the LIVE Gameplay `render.ts`
 *      terrain block (PAL / PRIO / texel / renderChunk) with a documented list
 *      of substitutions for the U=0.5 sampler;
 *   5. writes `evidence/source-custody.json` with all digests and drift.
 *
 * No gameplay law is imported. No old Gameplay source is presented as latest.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const U05 = path.join(ROOT, 'creator-u05');
const DEST = path.join(U05, 'web-u05');
const GAMEPLAY_SHA = 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9';
const LW01_GAMEPLAY_SHA = 'e11a9b4471a0832cd6d039b5510725b10ee0275c';
const LW01_CODE_SHA = '38d13514d20b089b6fcbf0fa78d605086c50385c';
const EXCLUDE = ['evidence/*', 'geography/*', 'src/game/pixelfx/pilot-assets/*'];
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
const read = (p) => fs.readFileSync(p);

function gitShow(spec) { return git('show', spec); }

// ---- 0. pinned refs / active authority ------------------------------------
const head = git('rev-parse', 'HEAD').toString().trim();
const branch = git('rev-parse', '--abbrev-ref', 'HEAD').toString().trim();
for (const s of [GAMEPLAY_SHA, LW01_GAMEPLAY_SHA, LW01_CODE_SHA]) {
  const t = git('cat-file', '-t', s).toString().trim();
  if (t !== 'commit') throw Error('U05_VENDOR_MISSING_COMMIT ' + s + ' ' + t);
}
const pointer = JSON.parse(read(path.join(ROOT, 'veyra-world-master/CURRENT_WORLD_MASTER.json')));
if (pointer.activeRevision !== 'WMP-04R1') throw Error('U05_VENDOR_ACTIVE_REVISION_NOT_WMP04R1');

// ---- 1. verbatim live Gameplay web/ subset --------------------------------
fs.mkdirSync(DEST, { recursive: true });
const tarArgs = ['-x', '-C', DEST, ...EXCLUDE.flatMap((e) => ['--exclude', e])];
const archive = git('archive', `${GAMEPLAY_SHA}:web`);
execFileSync('tar', tarArgs, { input: archive, cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });

function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(abs, rel));
    else if (e.isFile()) out.push(rel);
  }
  return out.sort();
}
const liveNames = new Set(git('ls-tree', '-r', '--name-only', `${GAMEPLAY_SHA}:web`).toString().trim().split('\n').filter(Boolean));
// U05 additive files are excluded from the verbatim comparison; they are
// generated below and are recorded separately as `additiveFiles`.
const vendored = walk(DEST).filter((r) => liveNames.has(r));
const digests = {};
let bytes = 0;
for (const rel of vendored) {
  const b = read(path.join(DEST, rel));
  digests[rel] = sha(b); bytes += b.length;
}
// Confirm every included byte really equals the live SHA object.
let mismatches = 0;
for (const rel of vendored) {
  const live = gitShow(`${GAMEPLAY_SHA}:web/${rel}`);
  if (sha(live) !== digests[rel]) { mismatches++; console.error('U05_VENDOR_MISMATCH', rel); }
}
if (mismatches) throw Error('U05_VENDOR_VERBATIM_CHECK_FAILED ' + mismatches);

const renderLive = gitShow(`${GAMEPLAY_SHA}:web/src/game/render.ts`).toString('utf8');
const renderOld = gitShow(`${LW01_GAMEPLAY_SHA}:web/src/game/render.ts`).toString('utf8');
const worldLive = gitShow(`${GAMEPLAY_SHA}:web/src/game/world.ts`).toString('utf8');
const artLive = gitShow(`${GAMEPLAY_SHA}:web/src/game/art.ts`).toString('utf8');
const coreLive = gitShow(`${GAMEPLAY_SHA}:web/src/game/core.ts`).toString('utf8');
const wmpLive = gitShow(`${GAMEPLAY_SHA}:web/src/game/veyra/wmp04r1.generated.ts`).toString('utf8');

// ---- 2. LW-01 chunk method (explicit reuse, never presented as live) ------
const LW_SRC = path.join(ROOT, 'large-world-01/web-large/src/game/large');
const LW_DST = path.join(DEST, 'src/u05/lw');
fs.mkdirSync(LW_DST, { recursive: true });
const lwFiles = ['geometry.ts', 'coords.ts', 'profile.ts', 'sources.generated.ts'];
const lwCustody = {};
for (const f of lwFiles) {
  const src = read(path.join(LW_SRC, f)).toString('utf8');
  // Only the relative import of core.ts changes: lw/ lives one level deeper.
  const out = f === 'geometry.ts' ? src.replace("from '../core'", "from '../../game/core'") : src;
  fs.writeFileSync(path.join(LW_DST, f), out);
  lwCustody[f] = { sourceSha256: sha(Buffer.from(src)), emittedSha256: sha(Buffer.from(out)), rewritten: out !== src, rewrite: out !== src ? ["from '../core' -> from '../../game/core'"] : [] };
}

// ---- 3. generated terrain module from LIVE render.ts ---------------------
function sliceTerrain(src) {
  const a = src.indexOf('// ---------- terrain palette ----------');
  const b = src.indexOf('function getChunk(');
  if (a < 0 || b < 0 || b <= a) throw Error('U05_TERRAIN_BLOCK_NOT_FOUND');
  return src.slice(a, b);
}
const block = sliceTerrain(renderLive);
const oldBlock = sliceTerrain(renderOld);
const terrainIdentical = sha(Buffer.from(block)) === sha(Buffer.from(oldBlock));
if (!terrainIdentical) throw Error('U05_LIVE_TERRAIN_BLOCK_DIFFERS_FROM_LW01_BENCHMARK');

// Documented substitutions: the live terrain code is left byte-identical
// except for the six lookups that must bind to the U=0.5 additive sampler.
const subs = [
  ['const tt = (x: number, y: number) => (x < 0 || y < 0 || x >= WW || y >= WH) ? T.DEEP : effTile(r, x, y);',
   'const tt = (x: number, y: number) => (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) ? T.DEEP : u05Tile(x, y);'],
  ['  const img = g.createImageData(cv.width, cv.height); const buf = new Uint32Array(img.data.buffer); const w = getWorld();\n',
   '  const img = g.createImageData(cv.width, cv.height); const buf = new Uint32Array(img.data.buffer);\n'],
  ['zone: w.zone[ty * WW + tx] ?? 0, sea: w.seaDist[ty * WW + tx] ?? 9', 'zone: 0, sea: 9'],
  ["getWorld().fresh[ty * WW + tx]", 'false'],
  ['function renderChunk(r: RunState, cx: number, cy: number) {', 'export function renderChunk(cx: number, cy: number) {'],
  ['r: RunState, ctx:', '_r: unknown, ctx:'],
  ['texel(use, wx, wy, tx, ty, r, uc)', 'texel(use, wx, wy, tx, ty, undefined, uc)'],
];
let gen = block;
for (const [from, to] of subs) {
  if (!gen.includes(from)) throw Error('U05_TERRAIN_SUBSTITUTION_MISSING ' + from.slice(0, 60));
  gen = gen.replace(from, to);
}
const header = `/**
 * AUTO-GENERATED by creator-u05/tools/vendor-u05.mjs — DO NOT HAND-EDIT.
 * Terrain palette / priority / texel / 16x16 chunk painter are an EXTRACT of
 * the VERIFIED LATEST Gameplay source:
 *   ${GAMEPLAY_SHA}:web/src/game/render.ts
 *   terrain block sha256 = ${sha(Buffer.from(block))}
 * The same block in LW-01's vendored ${LW01_GAMEPLAY_SHA} render.ts is byte-identical,
 * which is why the Creator-liked U=0.5 Beacon road reproduction is exact.
 *
 * Seven documented substitutions bind the painter to the U=0.5 additive
 * sampler; every other byte of the extracted block is verbatim:
 *   1. tt(): effTile(r,x,y) -> u05Tile(x,y) and WW/WH -> FRAME_W/FRAME_H;
 *   2. renderChunk's unused 'const w = getWorld()' declaration removed;
 *   3. zone/seaDist lookups -> literal 0/9 (matches LW-01 compat zero proxy);
 *   4. getWorld().fresh[...] -> literal false (matches LW-01 compat zero proxy);
 *   5. 'renderChunk(r: RunState, cx, cy)' -> 'export function renderChunk(cx, cy)';
 *   6. texel's unused RunState parameter becomes '_r: unknown';
 *   7. texel's call site passes 'undefined' for that parameter.
 * No palette value, road edge rule, pixel size or bit of material language was
 * changed. No new atlas. No nearest-neighbour 8 AU square land.
 */
import { T, TILE, hash2 } from '../game/core';
import { u05Tile, FRAME_W, FRAME_H } from './world';
import { fbm } from './lw-fbm';

const CH = 16;

`;
fs.writeFileSync(path.join(DEST, 'src/u05/terrain.ts'), header + gen);
// LW-01 compat fbm is used (not live world.ts fbm) so the locked Beacon U=0.5
// benchmark reproduces exactly. Both implementations are recorded verbatim.
const compat = read(path.join(LW_SRC, 'compat.ts')).toString('utf8');
const m = compat.match(/export function fbm\(x: number, y: number, s: number, _oct = 4\) \{[\s\S]*?\n\}/);
if (!m) throw Error('U05_LW01_FBM_NOT_FOUND');
fs.writeFileSync(path.join(DEST, 'src/u05/lw-fbm.ts'),
  `/** LW-01 compat.ts fbm (verbatim body) — reproduces the locked U=0.5 Beacon benchmark.\n *  Source: large-world-01/web-large/src/game/large/compat.ts @ ${LW01_CODE_SHA}\n *  Live Gameplay world.ts fbm differs; it is recorded but NOT used here because the\n *  Creator-approved visual reference was produced with this compat implementation. */\nimport { hash2 } from '../game/core';\n\n${m[0]}\n`);

// ---- 4. custody record -----------------------------------------------------
const liveTree = git('ls-tree', '-r', `${GAMEPLAY_SHA}:web`).toString().trim().split('\n');
const custody = {
  schema: 'soh.u05.source-custody.v1',
  generatedAt: new Date().toISOString(),
  branch, head,
  disclosure: 'ARENA_BRANCH_PINNED__NO_ISOLATED_BRANCH_CREATED',
  activeWorldMaster: { file: 'veyra-world-master/CURRENT_WORLD_MASTER.json', activeRevision: pointer.activeRevision, activeManifest: pointer.activeManifest, activeRuntimeReader: pointer.activeRuntimeReader, activeBiomeRaster: pointer.activeBiomeRaster, sha256: sha(read(path.join(ROOT, 'veyra-world-master/CURRENT_WORLD_MASTER.json'))) },
  goldMap: { file: 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json', sha256: sha(read(path.join(ROOT, 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json'))) },
  gameplay: {
    verifiedLatestSha: GAMEPLAY_SHA,
    webTreeSha: git('rev-parse', `${GAMEPLAY_SHA}:web`).toString().trim(),
    webTreeFiles: liveTree.length,
    vendoredFiles: vendored.length,
    vendoredBytes: bytes,
    verbatimMismatches: mismatches,
    exclusions: EXCLUDE,
    exclusionReason: 'Evidence PNGs, legacy geography JSON dumps and VFX pilot atlases are not imported by the U05 audition; excluding them keeps the deliverable inside the artifact budget. Their live-SHA identities remain in webTreeSha.',
    keyDigests: {
      'src/game/render.ts': sha(Buffer.from(renderLive)),
      'src/game/art.ts': sha(Buffer.from(artLive)),
      'src/game/core.ts': sha(Buffer.from(coreLive)),
      'src/game/world.ts': sha(Buffer.from(worldLive)),
      'src/game/veyra/wmp04r1.generated.ts': sha(Buffer.from(wmpLive)),
    },
  },
  lw01Reuse: {
    derivedFromGameplaySha: LW01_GAMEPLAY_SHA,
    codeCommit: LW01_CODE_SHA,
    note: 'LW-01 chunk method only (geometry/coords/profile/sources). NOT presented as the latest Gameplay source.',
    terrainBlockSha256: sha(Buffer.from(block)),
    terrainBlockIdenticalToLive: terrainIdentical,
    modules: lwCustody,
  },
  drift: {
    note: 'Live Gameplay HEAD has 4 commits of WMP04R1/Gameplay drift beyond LW-01 vendored source. The audition does NOT discard them: live render.ts/art.ts/core.ts/wmp04r1.generated.ts are vendored verbatim; drifted Gameplay modules are not invoked by the isolated U05 entry and are listed as an integration blocker.',
    commits: ['b5c8004ca4e77be62484fb3cd296fe296d7de4c9', '4d2a9bbf', 'b1072835', '65df55b7'],
  },
  includedFileDigests: digests,
  additiveFiles: walk(path.join(DEST, 'src/u05')).filter((r) => r.startsWith('lw/') || r === 'terrain.ts' || r === 'lw-fbm.ts')
    .map((r) => ({ path: `src/u05/${r}`, sha256: sha(read(path.join(DEST, 'src/u05', r))) })),
};
fs.writeFileSync(path.join(U05, 'evidence/source-custody.json'), JSON.stringify(custody, null, 2) + '\n');
console.log(`U05_VENDOR_OK liveSha=${GAMEPLAY_SHA} vendoredFiles=${vendored.length} bytes=${bytes} mismatches=${mismatches} terrainIdentical=${terrainIdentical}`);
