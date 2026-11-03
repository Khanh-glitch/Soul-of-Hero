import path from 'node:path';
import fs from 'node:fs';

export const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
export const DEFAULT_OUT = path.join(ROOT, 'output');

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, ...v] = a.slice(2).split('=');
      out[k] = v.length ? v.join('=') : true;
    } else out._.push(a);
  }
  return out;
}

export function ensureOut(dir) {
  fs.mkdirSync(path.join(dir, 'rasters'), { recursive: true });
  return dir;
}

export function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
