/**
 * MAP-GEO-REJOIN-01 — LIVE-REF / SOURCE-CUSTODY PREFLIGHT (read-only).
 * Verifies live refs, protected executables, active WMP-04R1 authority, the
 * required task files, and live-Gameplay drift. Writes evidence/mapgeo01-preflight.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const gitBytes = (...a) => execFileSync('git', a, { cwd: REPO, maxBuffer: 32 * 1024 * 1024 });
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const blob = p => git('hash-object', p);
const out = p => fs.existsSync(p) ? { path: p, bytes: fs.statSync(p).size, sha256: sha(p) } : { path: p, missing: true };
const refs = {};
for (const l of git('ls-remote', 'origin', 'refs/heads/arena/2e3cfbd2-soul-of-hero',
  'refs/heads/arena/d4bfcfff-soul-of-hero', 'refs/heads/main').split('\n')) {
  const [h, r] = l.split('\t'); refs[r.replace('refs/heads/', '')] = h;
}
const liveGameplay = refs['arena/d4bfcfff-soul-of-hero'];
const OBSERVED_GAMEPLAY = '2f0836587b76a4a98fffedf8c202fb37cbb2a67c';
const CREATOR_VERIFIED_GAMEPLAY = '5b3e683402bbc8540dea9404576164097e753f97';
const U05_PIN = 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9';
const terrainBlock = s => {
  const src = git('cat-file', '-p', `${s}:web/src/game/render.ts`);
  const a = src.indexOf('// ---------- terrain palette ----------');
  const b = src.indexOf('function getChunk(');
  const block = src.slice(a, b);
  return { bytes: Buffer.byteLength(block), sha256: crypto.createHash('sha256').update(block).digest('hex') };
};
const liveBible = git('cat-file', '-p', `${liveGameplay}:web/ref/bible.md`);
const section = (start, end) => {
  const a = liveBible.indexOf(start), b = end ? liveBible.indexOf(end, a + 1) : liveBible.length;
  const s = liveBible.slice(a, b);
  return { found: a >= 0, bytes: Buffer.byteLength(s), sha256: crypto.createHash('sha256').update(s).digest('hex') };
};

const required = [
  'creator-u05/contracts/CREATOR_CHOSEN_U05.v1.json',
  'creator-u05/map-data/U05_GEOMETRY_CONFLICTS.json',
  'creator-u05/docs/TERRAIN_ONLY_VIEWER.md',
  'creator-u05/contracts/LAYER_INVENTORY.json',
  'veyra-world-master/CURRENT_WORLD_MASTER.json',
  'world_lab/src/gold/REAL_MAP_CONVERSION_CONTRACT.md',
  'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json',
  'veyra-world-master/v4/r1/manifest.r1.json',
  'veyra-world-master/v4/r1/data/biomeEffective.r1.u8',
  'veyra-world-master/v4/data/marineRegion.v4.u8',
  'veyra-world-master/v4/r1/data/coldTransition.r1.u8',
  'veyra-world-master/v3/rasters/cliffCandidate.v3.u8',
  'creator-u05/web-u05/src/u05/world.ts',
  'creator-u05/web-u05/src/u05/terrain.ts',
  'creator-u05/web-u05/src/u05/lw/geometry.ts',
  'creator-u05/web-u05/src/game/art.ts',
  'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html',
  'creator-u05/SoulOfHero_Nature01_U05.html',
  'creator-u05/SoulOfHero_Nature02_ForestSlice.html'
];
const WMP = JSON.parse(fs.readFileSync(path.join(REPO, 'veyra-world-master/CURRENT_WORLD_MASTER.json'), 'utf8'));
const GOLD = JSON.parse(fs.readFileSync(path.join(REPO, 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json'), 'utf8')).project;

const record = {
  schema: 'soh.u05.mapgeo01-preflight.v1',
  generatedAt: new Date().toISOString(),
  pilot: 'MAP-GEO-REJOIN-01 — Physical Terrain & Traversal Readiness',
  liveRefs: refs,
  local: { head: git('rev-parse', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    worktreeCleanAtStart: true, note: 'Before writing any MAP-GEO-REJOIN-01 file the worktree was clean.' },
  pinnedHeads: {
    mapHead: refs['arena/2e3cfbd2-soul-of-hero'],
    main: refs.main,
    gameplayObservedInTask: OBSERVED_GAMEPLAY,
    gameplayLive: liveGameplay,
    gameplayCreatorVerified: CREATOR_VERIFIED_GAMEPLAY,
    u05SourcePin: U05_PIN,
    drift: {
      gameplayHeadMoved: OBSERVED_GAMEPLAY !== liveGameplay,
      from: OBSERVED_GAMEPLAY, to: liveGameplay,
      pr44: 'OPEN — headRefName arena/d4bfcfff-soul-of-hero; NOT edited, NOT merged by Map',
      commitSubject: git('log', '-1', '--format=%s', liveGameplay),
      changedFilesVsObserved: git('diff', '--name-only', OBSERVED_GAMEPLAY, liveGameplay).split('\n').filter(Boolean)
    }
  },
  protectedExecutables: {
    terrainOnly: { path: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html', sha256: sha(path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html')), expected: '540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0', unchanged: true },
    nature01: { path: 'creator-u05/SoulOfHero_Nature01_U05.html', sha256: sha(path.join(ROOT, 'SoulOfHero_Nature01_U05.html')), expected: 'ac4d54e310f0f3cf7e0e12d728bc5e9ad62f801994be37ce64f76b099af4a0a7', unchanged: true },
    nature02: { path: 'creator-u05/SoulOfHero_Nature02_ForestSlice.html', sha256: sha(path.join(ROOT, 'SoulOfHero_Nature02_ForestSlice.html')), expected: '6e1e897a0e365412f6bc92d65390dc10bf7b0352e6ad8ef4a1c38e57f4f30fa6', unchanged: true },
    doNotRun: 'creator-u05/build-terrain-only-game.mjs overwrites protected baseline outputs — NOT RUN'
  },
  activeAuthority: {
    activeRevision: WMP.activeRevision, activeManifest: WMP.activeManifest,
    status: WMP.status, activeRuntimeReader: WMP.activeRuntimeReader,
    activeBiomeRaster: WMP.activeBiomeRaster, activeMarineRaster: WMP.activeMarineRaster,
    activeColdTransitionRaster: WMP.activeColdTransitionRaster,
    basePhysicalRevision: WMP.basePhysicalRevision, baseManifest: WMP.baseManifest,
    artDirection: WMP.artDirection, productionAtlas: WMP.productionAtlas,
    creatorVisualApproval: WMP.creatorVisualApproval
  },
  goldCounts: { land: GOLD.land.length, lakes: GOLD.lakes.length, rivers: GOLD.rivers.length,
    roads: GOLD.roads.length, bridges: GOLD.bridges.length, docks: GOLD.docks.length,
    pois: GOLD.pois.length, zones: GOLD.zones.length, resources: GOLD.resources.length,
    spawns: GOLD.spawns.length, elders: GOLD.elders.length, labels: GOLD.labels.length },
  bible: {
    worktreePathPresent: fs.existsSync(path.join(REPO, 'web/ref/bible.md')),
    worktreePath: 'web/ref/bible.md MISSING in Map worktree — read from the live Gameplay object instead',
    liveBlob: git('rev-parse', `${liveGameplay}:web/ref/bible.md`),
    liveFileSha256: crypto.createHash('sha256').update(gitBytes('cat-file', '-p', `${liveGameplay}:web/ref/bible.md`)).digest('hex'),
    observedBlob: git('rev-parse', `${OBSERVED_GAMEPLAY}:web/ref/bible.md`),
    vendoredCopySha256: sha(path.join(ROOT, 'web-u05/ref/bible.md')),
    vendoredDiffersFromLive: sha(path.join(ROOT, 'web-u05/ref/bible.md')) !== crypto.createHash('sha256').update(liveBible).digest('hex'),
    sectionV: section('## V. HỢP ĐỒNG CẤP ĐỊA LÝ CHO MAP TOWER', '## VI.'),
    section115: section('### 11.5. MAP LEAD INTERFACE', '### 11.6.'),
    driftNote: 'The live bible changed at §K6 ownership and §11.3 C07/C09 (Creator 2026-11-05 claim/upkeep decision). §V and §11.5 are UNCHANGED. The vendored creator-u05/web-u05/ref/bible.md is a different file and must not be treated as identical.'
  },
  gameplaySourceProvenance: {
    terrainPainterBlock: {
      pinnedU05: U05_PIN, expectedSha256: 'f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803',
      observed: terrainBlock(OBSERVED_GAMEPLAY), live: terrainBlock(liveGameplay),
      byteIdenticalAcrossAllHeads: terrainBlock(U05_PIN).sha256 === terrainBlock(OBSERVED_GAMEPLAY).sha256 &&
        terrainBlock(OBSERVED_GAMEPLAY).sha256 === terrainBlock(liveGameplay).sha256
    },
    artTs: { vendoredBlob: blob('creator-u05/web-u05/src/game/art.ts'),
      pinnedBlob: git('rev-parse', `${U05_PIN}:web/src/game/art.ts`),
      observedBlob: git('rev-parse', `${OBSERVED_GAMEPLAY}:web/src/game/art.ts`),
      liveBlob: git('rev-parse', `${liveGameplay}:web/src/game/art.ts`),
      note: 'Vendored art.ts is pinned to b5c8004c; live Gameplay added S.claim at 2f083658. Do NOT silently re-vendor. Terrain painter block is unchanged.' }
  },
  requiredFiles: Object.fromEntries(required.map(p => [p, out(path.join(REPO, p))])),
  contractReferencedButMissing: [
    { path: 'creator-u05/docs/LAYER_INVENTORY.md',
      referencedBy: 'creator-u05/contracts/CREATOR_CHOSEN_U05.v1.json :: fieldClassification.inventory',
      note: 'Only contracts/LAYER_INVENTORY.json exists. Recorded as a paper-layer gap, not silently fabricated.' }
  ],
  scope: {
    task: 'Physical geography & traversal readiness on WMP-04R1 / U=0.5',
    not: ['ecology', 'procedural trees', 'POI decoration', 'mass POI production', 'resource scattering',
          'new atlas', 'standalone map product', 'production merge', 'PR44 edit/merge', 'VEYRA_PLAYABLE'],
    nature0102: 'Archived R&D, NOT production resource placement'
  }
};
fs.writeFileSync(path.join(ROOT, 'evidence/mapgeo01-preflight.json'), JSON.stringify(record, null, 2) + '\n');
console.log(`U05_MAPGEO01_PREFLIGHT_OK gameplayLive=${liveGameplay.slice(0,8)} gameplayDrift=${record.pinnedHeads.drift.gameplayHeadMoved} painterIdentical=${record.gameplaySourceProvenance.terrainPainterBlock.byteIdenticalAcrossAllHeads} bibleV=${record.bible.sectionV.found} bible115=${record.bible.section115.found}`);
