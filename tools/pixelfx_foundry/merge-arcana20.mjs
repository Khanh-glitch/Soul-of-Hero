// Merge the ARCANA20 pilot-selected effect set (the full-res PNGs embedded in the game at
// web/src/game/pixelfx/pilot-assets + ids from pilot.ts) into the shared PixelFX-244
// library as a first-class batch: web/releases/pixelfx244-batches/arcana20.zip
// (full-res, byte-identical to the game's own assets) + an "arcana20" entry appended to
// BATCHES-MANIFEST.json. Ids are cross-checked against the 244 pack (/tmp/pfx244).
// Usage: node tools/pixelfx_foundry/merge-arcana20.mjs --pack /tmp/pfx244
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const web = join(repo, 'web');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const packDir = resolve(flag('--pack', '/tmp/pfx244'));
const outDir = join(web, 'releases/pixelfx244-batches');

const pilotSrc = readFileSync(join(web, 'src/game/pixelfx/pilot.ts'), 'utf8');
const ids = [...pilotSrc.matchAll(/"id": "([^"]+)"/g)].map(m => m[1]);
if (!ids.length) throw new Error('no pilot ids found in pilot.ts');
const pack = JSON.parse(readFileSync(join(packDir, 'index.json'), 'utf8'));
const packIds = new Set(pack.effects.map(e => e.id));
const missing = ids.filter(id => !packIds.has(id));
console.log('arcana20 pilot ids:', ids.length, '| not in 244 pack:', missing.length ? missing : 'none (all overlap)');

// stage zip from the GAME's own full-res pilot assets (byte-identical source of truth)
const stage = join(outDir, '.stage-arcana20');
execFileSync('rm', ['-rf', stage]);
mkdirSync(join(stage, 'assets'), { recursive: true });
const effects = [];
for (const id of ids) {
  const [cat, name] = id.split('/');
  const srcDir = join(web, 'src/game/pixelfx/pilot-assets', cat, name);
  const entry = pack.effects.find(e => e.id === id);
  effects.push(entry);
  const dest = join(stage, 'assets', cat, name);
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(srcDir)) execFileSync('cp', [join(srcDir, f), join(dest, f)]);
}
writeFileSync(join(stage, 'index.json'), JSON.stringify({ source: pack.source, category: 'arcana20', note: 'ARCANA20 pilot-selected set — PNGs copied byte-identical from web/src/game/pixelfx/pilot-assets (the full-res assets embedded in the game)', effects }, null, 1));
const zipPath = join(outDir, 'arcana20.zip');
execFileSync('zip', ['-q', '-r', '-X', zipPath, 'index.json', 'assets'], { cwd: stage });
execFileSync('rm', ['-rf', stage]);
execFileSync('unzip', ['-t', '-q', zipPath], { stdio: 'pipe' });
const sha = createHash('sha256').update(readFileSync(zipPath)).digest('hex');

// append/refresh the arcana20 entry in BATCHES-MANIFEST.json
const mp = join(outDir, 'BATCHES-MANIFEST.json');
const man = JSON.parse(readFileSync(mp, 'utf8'));
man.batches = (man.batches || []).filter(b => b.category !== 'arcana20');
man.batches.push({
  category: 'arcana20', zip: 'arcana20.zip', effects: ids.length,
  pngFiles: ids.reduce((s, id) => { const [c, n] = id.split('/'); return s + readdirSync(join(web, 'src/game/pixelfx/pilot-assets', c, n)).length; }, 0),
  zipBytes: statSync(zipPath).size, sha256: sha,
  note: 'ARCANA20 pilot-selected effects — full-res, byte-identical to the game-embedded pilot assets; ids all exist inside the 244 pack too',
  download: 'https://github.com/Khanh-glitch/Soul-of-Hero/releases/download/pixelfx244-test-v2/arcana20.zip',
  effectIds: ids,
});
man.totalCategories = man.batches.length;
man.totalEffects = man.batches.reduce((s, b) => s + b.effects, 0) - ids.length + 244; // avoid double count: arcana20 ⊂ 244
writeFileSync(mp, JSON.stringify(man, null, 1));
console.log('arcana20.zip:', (statSync(zipPath).size / 1e6).toFixed(1), 'MB,', ids.length, 'effects, sha256', sha.slice(0, 16) + '…');
console.log('manifest updated:', mp);
