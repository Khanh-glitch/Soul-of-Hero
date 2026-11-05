/**
 * Produce the DELIVERABLE: one standalone, server-free HTML game file.
 *
 *   creator-u05/SoulOfHero_TerrainOnly_U05_x10.html
 *
 * It embeds the verbatim live-Gameplay terrain painter + 21 WMP-04R1 rasters +
 * native 16x24 hero, and NOTHING else: no buildings, no roofs/walls/doors,
 * no markers/labels/POI overlays, no HUD on the canvas. Speed is adjustable
 * x1..x10 (base 72 px/s unchanged).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(ROOT, 'web-u05');
const OUT_DIR = path.join(WEB, 'terrain-only-dist');
const BUILT = path.join(OUT_DIR, 'terrain-only.html');
const FILE = path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html');
const EVIDENCE = path.join(ROOT, 'evidence/terrain-only-build.json');

execFileSync('npx', ['vite', 'build', '--config', 'vite.terrain-only.config.mjs'], {
  cwd: WEB, stdio: 'inherit', env: { ...process.env }
});
if (!fs.existsSync(BUILT)) throw Error('U05_TERRAIN_ONLY_BUILD_MISSING');
const html = fs.readFileSync(BUILT, 'utf8');
const bytes = Buffer.byteLength(html);
// Self-contained proof: nothing is fetched at runtime.
const externalScript = /<script[^>]+src=/i.test(html);
const externalCss = /<link[^>]+rel=["']?stylesheet/i.test(html);
const importFromUrl = /(?:from\s*|import\s*)["']https?:\/\//.test(html);
if (externalScript || externalCss || importFromUrl) throw Error('U05_TERRAIN_ONLY_NOT_SELF_CONTAINED');
for (const marker of ['speedRange', 'x10', 'TERRAIN_ONLY', 'render16', 'creator-u05'])
  if (!html.includes(marker)) throw Error('U05_TERRAIN_ONLY_MARKER_MISSING ' + marker);
// Forbidden overlay code must not be bundled at all.
for (const forbidden of ['PhysicalLayer', 'U05_SCENES', 'SITE_ENVELOPE', 'roofHiddenCount', 'wall.u05.'])
  if (html.includes(forbidden)) throw Error('U05_TERRAIN_ONLY_OVERLAY_LEAK ' + forbidden);

fs.writeFileSync(FILE, html);
fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
const record = {
  schema: 'soh.u05.terrain-only-build.v1',
  generatedAt: new Date().toISOString(),
  file: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html',
  bytes,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(FILE)).digest('hex'),
  selfContained: { externalScript, externalCss, importFromUrl, allFalse: !externalScript && !externalCss && !importFromUrl },
  runsFrom: ['file:// (double-click, no server)', 'http(s):// static host', 'vite dev /terrain-only.html'],
  terrainSource: 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web/src/game/render.ts PAL/PRIO/texel sha256=f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803',
  layersDrawn: ['biome', 'roads', 'bridges', 'rivers', 'lakes', 'sea / shoreline', 'native 16x24 hero'],
  layersRemoved: ['buildings / footprints', 'walls / solid collision meshes', 'doors / rooms', 'roofs / occlusion', 'props', 'markers / labels', 'helipad reservation outline', 'HUD on canvas', 'particles / VFX', 'all scene JSON data'],
  speed: { basePxPerSec: 72, multiplierMin: 1, multiplierMax: 10, step: 0.5, maxPxPerSec: 720, note: 'VIEWER multiplier only; base SPEED constant unchanged and NOT a Gameplay law.' },
  camera: { viewport: [640, 360], dpr: 1, zoom: 1, U: 0.5, TILE: 16, frameTiles: [4000, 2800], addressableCells: 11200000, materializedAllCells: false },
  collisionDefault: 'FREE_ROAM__NO_COLLISION', collisionOptional: 'NATURAL_TERRAIN_ONLY (water/cliff/river); no walls, no POI collision, no marine/boat/ferry permission',
  scope: 'STANDALONE TERRAIN VIEWER ONLY — NOT full Gameplay runtime integration, NOT visual acceptance, NOT production game.'
};
fs.writeFileSync(EVIDENCE, JSON.stringify(record, null, 2) + '\n');
console.log(`U05_TERRAIN_ONLY_BUILD_OK file=${path.basename(FILE)} bytes=${bytes} sha256=${record.sha256.slice(0, 16)}…`);
