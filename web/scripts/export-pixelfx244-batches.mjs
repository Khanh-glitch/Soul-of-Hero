// Export the full 244-effect PixelFX pack as per-CATEGORY batches at 100% original
// resolution (the upstream-rendered PNGs, untouched) so other channels can import
// individual effects without the single-file HTML's lossy re-encode.
//
// Output (git-committed, small):  web/releases/pixelfx244-batches/BATCHES-MANIFEST.json
// Output (uploaded to GitHub release, NOT committed): /tmp/pfx244-batches/<category>.zip
//   each zip = assets/<category>/... original PNGs (combined + light) + index.json
//             (effects of that category only, with zip-relative page paths)
//
// Usage (from web/): node scripts/export-pixelfx244-batches.mjs --pack /tmp/pfx244 --out /tmp/pfx244-batches
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const packDir = resolve(web, flag('--pack', 'pixelfx-assets'));
const outDir = resolve(flag('--out', '/tmp/pfx244-batches'));

const manifest = JSON.parse(readFileSync(join(packDir, 'index.json'), 'utf8'));
const byCat = new Map();
for (const e of manifest.effects) {
  const cat = e.id.split('/')[0];
  if (!byCat.has(cat)) byCat.set(cat, []);
  byCat.get(cat).push(e);
}

mkdirSync(outDir, { recursive: true });
const batches = [];
for (const [cat, effects] of [...byCat.entries()].sort()) {
  const stage = join(outDir, '.stage-' + cat);
  mkdirSync(join(stage, 'assets'), { recursive: true });
  // category-scoped index.json with zip-relative paths
  const catIndex = { source: manifest.source, category: cat, effects: effects.map(e => ({
    ...e,
    export: { ...e.export, pages: {
      combined: e.export.pages.combined.map(p => ({ ...p })),
      light: e.export.pages.light.map(p => ({ ...p })),
    } },
  })) };
  writeFileSync(join(stage, 'index.json'), JSON.stringify(catIndex));
  // copy original PNGs untouched (100% resolution, lossless)
  let pngBytes = 0, pngCount = 0;
  for (const e of effects) {
    const dest = join(stage, 'assets', cat, e.id.split('/')[1]);
    mkdirSync(dest, { recursive: true });
    for (const ch of ['combined', 'light']) for (const p of e.export.pages[ch]) {
      const src = join(packDir, p.path);
      execFileSync('cp', [src, join(dest, p.path.split('/').pop())]);
      pngBytes += statSync(src).size; pngCount++;
    }
  }
  const zipPath = join(outDir, cat + '.zip');
  execFileSync('zip', ['-q', '-r', '-X', zipPath, 'index.json', 'assets'], { cwd: stage });
  execFileSync('rm', ['-rf', stage]);
  // integrity check
  execFileSync('unzip', ['-t', '-q', zipPath], { stdio: 'pipe' });
  const zipBytes = statSync(zipPath).size;
  const sha = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
  batches.push({
    category: cat, zip: cat + '.zip', effects: effects.length, pngFiles: pngCount,
    pngBytes, zipBytes, sha256: sha,
    download: `https://github.com/Khanh-glitch/Soul-of-Hero/releases/download/pixelfx244-test-v2/${cat}.zip`,
    effectIds: effects.map(e => e.id),
  });
  console.log(`${cat}: ${effects.length} effects, ${pngCount} pngs, zip ${(zipBytes / 1e6).toFixed(1)} MB`);
}
const summary = {
  note: 'Per-category batches of the 244-effect PixelFX pack at 100% original resolution (upstream-rendered PNGs, PARITY_PASS). Zips are release assets on tag pixelfx244-test-v2, not git-tracked (too large). Each zip contains index.json (category-scoped manifest) + assets/<category>/<effect>/ original combined-*.png and light-*.png. The single-file HTML (SOH-PIXELF-244-TEST.html) re-encodes to WebP k=0.5 to fit GitHub 100MB raw limit — use these batches when importing individual effects and sharpness must be preserved.',
  source: manifest.source,
  totalEffects: manifest.effects.length,
  totalCategories: batches.length,
  totalPngBytes: batches.reduce((s, b) => s + b.pngBytes, 0),
  totalZipBytes: batches.reduce((s, b) => s + b.zipBytes, 0),
  batches,
};
const manifestPath = join(web, 'releases/pixelfx244-batches/BATCHES-MANIFEST.json');
mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, JSON.stringify(summary, null, 1));
console.log('wrote', manifestPath, 'total zip MB', (summary.totalZipBytes / 1e6).toFixed(1));
