/** Tiny static preview: serves the ONE untouched terrain-only game at "/",
 *  plus the SEPARATE NATURE-01 pilot at "/nature01". Both are read from disk
 *  on each request, so a rebuild is picked up without restarting the server.
 *  No build step, no dependencies, binds 0.0.0.0 for the Arena live preview. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html');
const NATURE_FILE = path.join(ROOT, 'SoulOfHero_Nature01_U05.html');
const PORT = Number(process.env.U05_TERRAIN_PORT || 5183);
if (!fs.existsSync(FILE)) throw Error('U05_TERRAIN_ONLY_FILE_MISSING ' + FILE);

const NAME = 'SoulOfHero_TerrainOnly_U05_x10.html';
const NATURE_NAME = 'SoulOfHero_Nature01_U05.html';
http.createServer((req, res) => {
  const u = new URL(req.url || '/', 'http://localhost');
  const p = u.pathname;
  const isNature = p === '/nature01' || p === '/nature01.html' || p === '/' + NATURE_NAME;
  const natureDownload = p === '/nature01-download' || p === '/nature01-download.html';
  const isGame = p === '/' || p === '/index.html' || p === '/game' || p === '/' + NAME;
  if (isNature || natureDownload) {
    if (!fs.existsSync(NATURE_FILE)) {
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('NATURE01 file missing'); return;
    }
    const html = fs.readFileSync(NATURE_FILE);
    const forceDownload = natureDownload || u.searchParams.has('download');
    res.writeHead(200, {
      'content-type': forceDownload ? 'application/octet-stream' : 'text/html; charset=utf-8',
      'content-length': html.length,
      'cache-control': 'no-store',
      ...(forceDownload ? { 'content-disposition': `attachment; filename="${NATURE_NAME}"` } : {})
    });
    res.end(html);
  } else if (isGame || p === '/download' || p === '/download.html') {
    const html = fs.readFileSync(FILE);
    // /download forces a real file download (Content-Disposition: attachment).
    const forceDownload = p === '/download' || p === '/download.html' || u.searchParams.has('download');
    res.writeHead(200, {
      'content-type': forceDownload ? 'application/octet-stream' : 'text/html; charset=utf-8',
      'content-length': html.length,
      'cache-control': 'no-store',
      ...(forceDownload ? { 'content-disposition': `attachment; filename="${NAME}"` } : {})
    });
    res.end(html);
  } else {
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
  }
}).listen(PORT, '0.0.0.0', () => console.log(`U05_TERRAIN_ONLY_PREVIEW http://0.0.0.0:${PORT}/  |  DOWNLOAD /download  |  NATURE-01 /nature01  |  NATURE-01 DOWNLOAD /nature01-download`));
