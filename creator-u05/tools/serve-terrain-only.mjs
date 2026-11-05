/** Tiny static preview: serves the ONE untouched terrain-only game at "/",
 *  the SEPARATE NATURE-01 pilot at "/nature01", and the NEW NATURE-02 forest
 *  quality vertical slice at "/nature02" (+ its download route). All three are
 *  read from disk on each request, so a rebuild is picked up without restarting
 *  the server. No build step, no dependencies, binds 0.0.0.0 for Arena preview.
 *
 *  The four pre-existing routes are byte-for-byte unchanged in behaviour. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'SoulOfHero_TerrainOnly_U05_x10.html';
const NATURE_NAME = 'SoulOfHero_Nature01_U05.html';
const FOREST_NAME = 'SoulOfHero_Nature02_ForestSlice.html';
const FILE = path.join(ROOT, NAME);
const NATURE_FILE = path.join(ROOT, NATURE_NAME);
const FOREST_FILE = path.join(ROOT, FOREST_NAME);
const PORT = Number(process.env.U05_TERRAIN_PORT || 5183);
if (!fs.existsSync(FILE)) throw Error('U05_TERRAIN_ONLY_FILE_MISSING ' + FILE);

const serve = (res, file, filename, forceDownload) => {
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('file missing: ' + filename);
    return;
  }
  const html = fs.readFileSync(file);
  res.writeHead(200, {
    'content-type': forceDownload ? 'application/octet-stream' : 'text/html; charset=utf-8',
    'content-length': html.length,
    'cache-control': 'no-store',
    ...(forceDownload ? { 'content-disposition': `attachment; filename="${filename}"` } : {})
  });
  res.end(html);
};

http.createServer((req, res) => {
  const u = new URL(req.url || '/', 'http://localhost');
  const p = u.pathname;
  // --- original routes (unchanged) ---
  const isNature = p === '/nature01' || p === '/nature01.html' || p === '/' + NATURE_NAME;
  const natureDownload = p === '/nature01-download' || p === '/nature01-download.html';
  const isGame = p === '/' || p === '/index.html' || p === '/game' || p === '/' + NAME;
  // --- NEW NATURE-02 routes ---
  const isForest = p === '/nature02' || p === '/nature02.html' || p === '/' + FOREST_NAME;
  const forestDownload = p === '/nature02-download' || p === '/nature02-download.html';

  if (isForest || forestDownload) {
    serve(res, FOREST_FILE, FOREST_NAME, forestDownload || u.searchParams.has('download'));
  } else if (isNature || natureDownload) {
    serve(res, NATURE_FILE, NATURE_NAME, natureDownload || u.searchParams.has('download'));
  } else if (isGame || p === '/download' || p === '/download.html') {
    serve(res, FILE, NAME, p === '/download' || p === '/download.html' || u.searchParams.has('download'));
  } else {
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
  }
}).listen(PORT, '0.0.0.0', () => console.log(
  `U05_PREVIEW http://0.0.0.0:${PORT}/  |  DOWNLOAD /download  |  NATURE-01 /nature01 + /nature01-download  |  NATURE-02 /nature02 + /nature02-download`));
