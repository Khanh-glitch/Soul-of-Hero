import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const manifest = path.join(root, 'docs/PIXELFX_RECOVERY_SHA1.txt');
if (!fs.existsSync(manifest)) throw Error('PixelFX integrity ledger is missing');
const entries = fs.readFileSync(manifest, 'utf8').trim().split(/\r?\n/).map(row => {
  const m = row.match(/^([a-f0-9]{40})  (src\/game\/pixelfx\/[^\s]+\.png)$/);
  if (!m) throw Error(`Invalid PixelFX ledger row: ${row}`);
  return { hash: m[1], relative: m[2] };
});
if (entries.length !== 54 || new Set(entries.map(e => e.relative)).size !== 54) throw Error(`Expected 54 unique PixelFX assets; found ${entries.length}`);
const missing = [], mismatched = [];
for (const item of entries) {
  const p = path.resolve(root, item.relative);
  if (!p.startsWith(path.join(root, 'src', 'game', 'pixelfx') + path.sep)) throw Error(`Unsafe asset: ${item.relative}`);
  if (!fs.existsSync(p)) { missing.push(item.relative); continue; }
  const data = fs.readFileSync(p);
  const gitBlob = crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  if (gitBlob !== item.hash) mismatched.push(item.relative);
}
if (missing.length || mismatched.length) throw Error(`PixelFX FAILURE: missing=${missing.join(',')} mismatched=${mismatched.join(',')}`);
const src = ['src/game/pixelfx/pilot.ts','src/game/pixelfx/owner-vfx.ts']
  .map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
const imports = [...src.matchAll(/from\s+['"](\.\/[^'"]+\.png)\?url['"]/g)].map(m=>m[1]);
if (imports.length!==54 || new Set(imports).size!==54) throw Error(`PixelFX source has ${imports.length} imports, expected 54`);
for(const imp of imports) if (!fs.existsSync(path.resolve(root,'src/game/pixelfx',imp))) throw Error('Unresolved import '+imp);
console.log(`PASS: ${entries.length}/54 PixelFX Git blob hashes, ${imports.length}/54 import paths`);
