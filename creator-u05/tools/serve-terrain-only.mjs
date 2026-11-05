/** Tiny static preview: serves the ONE standalone terrain-only game at "/".
 *  No build step, no dependencies, binds 0.0.0.0 for the Arena live preview. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html');
const PORT = Number(process.env.U05_TERRAIN_PORT || 5183);
if (!fs.existsSync(FILE)) throw Error('U05_TERRAIN_ONLY_FILE_MISSING ' + FILE);

http.createServer((req, res) => {
  const p = new URL(req.url || '/', 'http://localhost').pathname;
  if (p === '/' || p === '/index.html' || p === '/game' || p === '/SoulOfHero_TerrainOnly_U05_x10.html') {
    const html = fs.readFileSync(FILE);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': html.length, 'cache-control': 'no-store' });
    res.end(html);
  } else {
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
  }
}).listen(PORT, '0.0.0.0', () => console.log(`U05_TERRAIN_ONLY_PREVIEW http://0.0.0.0:${PORT}/`));
