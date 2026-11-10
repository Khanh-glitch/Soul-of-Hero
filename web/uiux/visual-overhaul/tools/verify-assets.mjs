// Fails the build if any PixelFX PNG imported by the manifests is missing from the tree.
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('src/game/pixelfx'); let missing = 0, total = 0;
for (const f of ['pilot.ts', 'owner-vfx.ts']) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of src.matchAll(/from '(\.\/[^']+\.png)\?url'/g)) { total++; if (!fs.existsSync(path.join(root, m[1]))) { missing++; console.error('MISSING', f, m[1]); } }
}
console.log(`pixelfx assets: ${total - missing}/${total} present`);
if (missing) process.exit(1);
