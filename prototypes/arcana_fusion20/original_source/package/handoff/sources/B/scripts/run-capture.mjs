// Bundles scripts/capture.ts with esbuild (bundled with Vite) and runs it.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
await build({ entryPoints: ['scripts/capture.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'scripts/.capture.mjs', logLevel: 'error' });
const res = spawnSync('node', ['scripts/.capture.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(res.status ?? 0);
