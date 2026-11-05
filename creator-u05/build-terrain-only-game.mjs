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
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(ROOT, 'web-u05');
const OUT_DIR = path.join(WEB, 'terrain-only-dist');
const BUILT = path.join(OUT_DIR, 'terrain-only.html');
const FILE = path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html');
const ZIP = path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.zip');
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
for (const marker of ['speedRange', 'x10', 'TERRAIN_ONLY', 'render16', 'creator-u05', 'zoomRange', 'WHOLE_MAP_OVERVIEW', 'CENTER_FOLLOW', 'playerMarker', 'lens', 'isolatedCells', 'despeckleStats'])
  if (!html.includes(marker)) throw Error('U05_TERRAIN_ONLY_MARKER_MISSING ' + marker);
// Forbidden overlay code must not be bundled at all.
for (const forbidden of ['PhysicalLayer', 'U05_SCENES', 'SITE_ENVELOPE', 'roofHiddenCount', 'wall.u05.'])
  if (html.includes(forbidden)) throw Error('U05_TERRAIN_ONLY_OVERLAY_LEAK ' + forbidden);

fs.writeFileSync(FILE, html);
// A ZIP mirror gives a PERMANENT forced-download link from GitHub raw
// (application/zip always downloads); the HTML itself stays the main file.
const zipBuf = makeZip([{ name: 'SoulOfHero_TerrainOnly_U05_x10.html', data: Buffer.from(html) }]);
fs.writeFileSync(ZIP, zipBuf);
fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
const record = {
  schema: 'soh.u05.terrain-only-build.v1',
  generatedAt: new Date().toISOString(),
  file: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html',
  zipMirror: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.zip',
  zipBytes: zipBuf.length,
  bytes,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(FILE)).digest('hex'),
  selfContained: { externalScript, externalCss, importFromUrl, allFalse: !externalScript && !externalCss && !importFromUrl },
  runsFrom: ['file:// (double-click, no server)', 'http(s):// static host', 'vite dev /terrain-only.html'],
  terrainSource: 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web/src/game/render.ts PAL/PRIO/texel sha256=f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803',
  layersDrawn: ['biome', 'roads', 'bridges', 'rivers', 'lakes', 'sea / shoreline', 'native 16x24 hero'],
  layersRemoved: ['buildings / footprints', 'walls / solid collision meshes', 'doors / rooms', 'roofs / occlusion', 'props', 'markers / labels', 'helipad reservation outline', 'HUD on canvas', 'particles / VFX', 'all scene JSON data'],
  speed: { basePxPerSec: 72, multiplierMin: 1, multiplierMax: 10, step: 0.5, maxPxPerSec: 720, note: 'VIEWER multiplier only; base SPEED constant unchanged and NOT a Gameplay law.' },
  camera: { viewport: [640, 360], dpr: 1, zoom: 1, U: 0.5, TILE: 16, frameTiles: [4000, 2800], addressableCells: 11200000, materializedAllCells: false },
  wholeMapZoom: {
    deepLink: '?zoom=fit opens directly at the smallest whole-map zoom',
    keys: ['Z whole-map FIT <-> native 1x', 'V back to native', ', / . step zoom', 'mouse wheel', 'zoom slider', 'B optional viewer guides'],
    fitPxPerTile: 0.12857142857142856, fitZoomScale: 0.008035714285714286,
    fitsWholeFrame: '4000x2800 tiles inside 640x360',
    overviewBitmap: [500, 350], strideTiles: 8, strideAu: 4, samplePointsPerPixel: 3, tileSamples: 525000,
    class: 'SAMPLED_VIEWER_PREVIEW_OF_EXACT_GOLD_TILE_CENTRES__NOT_8AU_RASTER_UPSCALE__NOT_AUTHORED_DETAIL',
    fullFrameAllocated: false,
    nativeUnchanged: '640x360 @1x, hero 16x24, U=0.5, base 72 px/s',
    followCamera: {
      rootCauseFixed: 'S.x/S.y are WORLD PIXELS but were projected with px-per-TILE (16x too far), so the follow offset always clamped to an extreme and the hero marker was drawn off-screen. The hero sprite was also omitted at overview scale. Now the player is converted with /TILE and a hero marker is ALWAYS drawn.',
      default: 'FIT_FOLLOW', modes: ['FIT_FOLLOW', 'CENTER_FOLLOW', 'LOCK'],
      fitFollow: 'proportional camera slide inside the letterbox; whole 4000x2800 frame stays visible',
      centerFollow: 'player exactly centred at viewport centre; map scrolls under it (may clip)',
      lock: 'map frozen, centred',
      heroMarkerAlwaysDrawn: true, guidesDefault: true,
      lens: { canvas: [192, 144], htmlCanvasNotOverlay: true, native1xHeroCentred: true, alwaysFollows: true },
      note: 'The native 1x camera NEVER stops following the player; zoom only changes the overview viewer layer.'
    },
    note: 'Zoom is a VIEWER control only, NOT a camera Gameplay law change.'
  },
  isolatedCellDespeckle: {
    report: 'có khá nhiều và bất hợp lí các ô A được vây quanh 4 phía bởi ô B',
    rootCause: 'biomeCodeAt() jitters EVERY tile independently by +/-2.6 AU against the 8 AU analysis raster; near a biome boundary a lone tile picks the other cell while all 4 orthogonal neighbours pick one cell. The verbatim renderChunk() PRIO edge dither then amplifies each speck.',
    fix: '3 deterministic passes over a bounded 34x34 tile window (32x32 chunk + 1-tile border): an eligible BIOME centre whose 4 orthogonal neighbours are the SAME biome tile and differ from the centre adopts that neighbour tile. Later passes read the UPDATED grid, so cascades are resolved.',
    eligible: 'authored land tile whose code is one of MEADOW/GRASS/FOREST/MARSH/SAND/HILL/SNOW/ASH/TOXIC',
    preservedByTileCode: 'ROAD, BRIDGE, RIVER, DEEP, SHALLOW, CLIFF, ICE, LAVA, FLOOR, PWALL, BURNT are never smoothable, so the Creator-liked Beacon road and every authored water/shore/bridge/cliff tile are unchanged.',
    bounded: '<=256 resident 34x34 windows LRU; whole 11.2M-cell frame never allocated; coarse whole-map overview keeps using the RAW sampler (specks are sub-pixel at 8-tile stride)',
    goldPolygonsUnchanged: true, analysisRasterUnchanged: true, verbatimPainterUnchanged: true,
    evidence: ['creator-u05/evidence/terrain-only-shots/speckle_before.png', 'creator-u05/evidence/terrain-only-shots/speckle_after.png']
  },
  collisionDefault: 'FREE_ROAM__NO_COLLISION', collisionOptional: 'NATURAL_TERRAIN_ONLY (water/cliff/river); no walls, no POI collision, no marine/boat/ferry permission',
  scope: 'STANDALONE TERRAIN VIEWER ONLY — NOT full Gameplay runtime integration, NOT visual acceptance, NOT production game.'
};
fs.writeFileSync(EVIDENCE, JSON.stringify(record, null, 2) + '\n');
console.log(`U05_TERRAIN_ONLY_BUILD_OK file=${path.basename(FILE)} bytes=${bytes} zip=${zipBuf.length} sha256=${record.sha256.slice(0, 16)}…`);

/** Minimal STORE/DEFLATE ZIP writer (single entry), no dependency. */
function makeZip(entries) {
  const chunks = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const payload = zlib.deflateRawSync(e.data, { level: 9 });
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    chunks.push(local, name, payload);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(8, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(payload.length, 20); cd.writeUInt32LE(e.data.length, 24);
    cd.writeUInt16LE(name.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, name]));
    offset += local.length + name.length + payload.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, cdBuf, end]);
}
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
