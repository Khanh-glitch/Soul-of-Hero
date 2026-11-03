// Serve one single-file Vite build for A/B capture.
//   node serve.mjs ../pr38-baseline/web/dist/index.html 4180
//   node serve.mjs ../pr38-art/web/dist/index.html      4181
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const html = readFileSync(path.resolve(process.argv[2]));
const port = Number(process.argv[3] || 4180);
createServer((_q, s) => {
  s.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  s.end(html);
}).listen(port, '0.0.0.0', () => console.log(`serving ${port}`));
