#!/usr/bin/env node
// WMP-04R1 REAL WORLD VISUAL PILOT — pinned-source vendor.
// Copies ONLY the versioned assets needed to run the real SOH Web renderer,
// from the verified live Gameplay and Map HEADs. Every copied byte carries its
// source commit, git blob SHA-1 and SHA-256, and is re-verified on disk.
// No Gameplay or Map owner file is modified: this script writes ONLY into
// wmp04r1-pilot/.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PILOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(PILOT, '..');
export const GAMEPLAY_HEAD = 'f8fcde910c330aa953dd5c65b80a51792945d35e';
export const MAP_HEAD = 'caccf21613aa57a55491ec44f687cc44c569f79e';
const sha256 = b => createHash('sha256').update(b).digest('hex');
const git = args => execFileSync('git', args, { cwd: REPO, maxBuffer: 32 * 1024 * 1024 });

function blob(commit, rel) {
  const buf = Buffer.from(git(['cat-file', '-p', `${commit}:${rel}`]));
  const sha1 = git(['rev-parse', `${commit}:${rel}`]).toString('utf8').trim();
  return { buf, sha1 };
}
function put(destRel, buf, sha1, commit, sourceRel) {
  const dest = path.join(PILOT, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  const onDisk = fs.readFileSync(dest);
  if (sha256(onDisk) !== sha256(buf)) throw new Error(`VENDOR_WRITE_MISMATCH ${destRel}`);
  if (git(['hash-object', dest]).toString('utf8').trim() !== sha1) throw new Error(`VENDOR_BLOB_MISMATCH ${destRel}`);
  return { file: destRel, sourceCommit: commit, sourcePath: sourceRel, bytes: onDisk.length, sha1, sha256: sha256(onDisk) };
}

const WEB_CONFIG = ['package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'tsconfig.json'];
const WEB_SRC = [
  'App.tsx', 'index.css', 'main.tsx', 'utils/cn.ts',
  'game/access-corridors.ts', 'game/art.ts', 'game/audio.ts', 'game/balance.v1.json',
  'game/catalog.ts', 'game/content.ts', 'game/core.ts', 'game/economy-adapter.ts',
  'game/engine.ts', 'game/geography-contract.ts', 'game/map-package.ts', 'game/persist.ts',
  'game/render.ts', 'game/sim.ts', 'game/world-economy.ts', 'game/world.ts', 'game/wreck-economy.ts',
  'game/veyra/eligibility.ts', 'game/veyra/intake.ts', 'game/veyra/lr02.ts', 'game/veyra/projection.ts',
  'map-packages/README.md', 'ui/Game.tsx', 'ui/Title.tsx', 'ui/common.tsx', 'ui/panels.tsx',
];
const WEB_GEOGRAPHY = [
  'geography/veyra-lr01/world_lab/lr01/output/geography_package.v1.json',
  'geography/veyra-lr01/map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json',
  'geography/veyra-lr02/spawn_eligibility.v1.json',
  'geography/veyra-lr02/greywater_spatial_patch.v1.json',
];
// Map static geography consumed by the pilot. NOT GOLD, NOT a Gameplay runtime file.
const MAP_DATA = [
  'veyra-world-master/CURRENT_WORLD_MASTER.json',
  'veyra-world-master/v4/manifest.v4.json',
  'veyra-world-master/v4/r1/manifest.r1.json',
  'veyra-world-master/v4/r1/layers/geography_design.r1.json',
  'veyra-world-master/v4/layers/marine_sites.v4.json',
  'veyra-world-master/v4/layers/marine_navigation.v4.json',
  'veyra-world-master/v4/r1/data/biomeEffective.r1.u8',
  'veyra-world-master/v4/r1/data/coldTransition.r1.u8',
  'veyra-world-master/v4/data/marineRegion.v4.u8',
  'veyra-world-master/v3/rasters/cliffCandidate.v3.u8',
  'veyra-world-master/v3/rasters/heightClass.v3.u8',
  'veyra-world-master/data/rasters/geo01/biomeCode.u8',
  'veyra-world-master/data/rasters/geo01/landId.u8',
  'veyra-world-master/data/rasters/geo01/waterClass.u8',
  'veyra-world-master/data/rasters/geo01/elevation.u8',
  'veyra-world-master/data/rasters/geo01/slope.u8',
];

export function vendor() {
  // Verify the two pinned commits are present and are the objects we expect.
  for (const [name, sha] of [['Gameplay', GAMEPLAY_HEAD], ['Map', MAP_HEAD]]) {
    const type = git(['cat-file', '-t', sha]).toString('utf8').trim();
    if (type !== 'commit') throw new Error(`${name} pinned HEAD ${sha} is not a commit`);
  }
  const records = [];
  for (const tree of ['web-baseline', 'web-pilot']) {
    for (const rel of WEB_CONFIG) {
      const src = `web/${rel}`;
      const { buf, sha1 } = blob(GAMEPLAY_HEAD, src);
      records.push(put(`${tree}/${rel}`, buf, sha1, GAMEPLAY_HEAD, src));
    }
    for (const rel of WEB_SRC) {
      const src = `web/src/${rel}`;
      const { buf, sha1 } = blob(GAMEPLAY_HEAD, src);
      records.push(put(`${tree}/src/${rel}`, buf, sha1, GAMEPLAY_HEAD, src));
    }
    for (const rel of WEB_GEOGRAPHY) {
      const src = `web/${rel}`;
      const { buf, sha1 } = blob(GAMEPLAY_HEAD, src);
      records.push(put(`${tree}/${rel}`, buf, sha1, GAMEPLAY_HEAD, src));
    }
  }
  for (const rel of MAP_DATA) {
    const { buf, sha1 } = blob(MAP_HEAD, rel);
    records.push(put(`map-data/${path.basename(rel)}`, buf, sha1, MAP_HEAD, rel));
  }
  const doc = {
    schema: 'soh.wmp04r1.pilot.asset_provenance.v1',
    status: 'PINNED_SOURCE_COPIES__DIGEST_VERIFIED',
    generatedBy: 'wmp04r1-pilot/tools/vendor.mjs',
    gameplayHead: GAMEPLAY_HEAD, mapHead: MAP_HEAD,
    policy: 'Verbatim copies only. No GOLD import, no owner-branch edit, no runtime fs in the browser.',
    fileCount: records.length,
    totalBytes: records.reduce((a, r) => a + r.bytes, 0),
    files: records,
  };
  fs.writeFileSync(path.join(PILOT, 'ASSET_PROVENANCE.json'), JSON.stringify(doc, null, 2) + '\n');
  return doc;
}

if (process.argv[1] && process.argv[1].endsWith('vendor.mjs')) {
  const doc = vendor();
  console.log(`WMP04R1_VENDOR_OK files=${doc.fileCount} bytes=${doc.totalBytes} gameplay=${GAMEPLAY_HEAD.slice(0, 12)} map=${MAP_HEAD.slice(0, 12)}`);
}
