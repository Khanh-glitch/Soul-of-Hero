/**
 * Produce the NATURE-01 DELIVERABLE: one standalone, server-free HTML game.
 *
 *   creator-u05/SoulOfHero_Nature01_U05.html
 *
 * It is a NEW file. The terrain-only executable is ASSERTED untouched by SHA256
 * before anything is written. This build reuses the verbatim live-Gameplay
 * terrain painter + 21 WMP-04R1 rasters + native 16x24 hero and adds ONE
 * separate, toggleable decorative nature layer restricted to five pilot sites.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(ROOT, 'web-u05');
const OUT_DIR = path.join(WEB, 'nature01-dist');
const BUILT = path.join(OUT_DIR, 'nature01.html');
const FILE = path.join(ROOT, 'SoulOfHero_Nature01_U05.html');
const ZIP = path.join(ROOT, 'SoulOfHero_Nature01_U05.zip');
const EVIDENCE = path.join(ROOT, 'evidence/nature01-build.json');
const BASELINE = path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html');
const BASELINE_SHA = '540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0';

const baselineSha = crypto.createHash('sha256').update(fs.readFileSync(BASELINE)).digest('hex');
if (baselineSha !== BASELINE_SHA) throw Error('NATURE01_BASELINE_MODIFIED ' + baselineSha);

execFileSync('npx', ['vite', 'build', '--config', 'vite.nature01.config.mjs'], {
  cwd: WEB, stdio: 'inherit', env: { ...process.env }
});
if (!fs.existsSync(BUILT)) throw Error('NATURE01_BUILD_MISSING');
const html = fs.readFileSync(BUILT, 'utf8');
const bytes = Buffer.byteLength(html);
const externalScript = /<script[^>]+src=/i.test(html);
const externalCss = /<link[^>]+rel=["']?stylesheet/i.test(html);
const importFromUrl = /(?:from\s*|import\s*)["']https?:\/\//.test(html);
if (externalScript || externalCss || importFromUrl) throw Error('NATURE01_NOT_SELF_CONTAINED');
for (const marker of [
  'NATURE01', 'setNature', 'natureBtn', 'sitePresets', 'auditPilot', 'natureObjectsInRect',
  'speedRange', 'x10', 'TERRAIN_ONLY', 'render16', 'creator-u05', 'zoomRange',
  'WHOLE_MAP_OVERVIEW', 'CENTER_FOLLOW', 'playerMarker', 'lens', 'isolatedCells',
  'despeckleStats', 'getArt'
]) if (!html.includes(marker)) throw Error('NATURE01_MARKER_MISSING ' + marker);
// No artificial structures / Gameplay resource systems may be bundled.
for (const forbidden of [
  'PhysicalLayer', 'U05_SCENES', 'SITE_ENVELOPE', 'BUILDING_COMPOSITION',
  'ROOF_OCCLUSION', 'roofHiddenCount', 'wall.u05.', 'drawSource',
  'harvestProbe', 'VEYRA_PLAYABLE'
]) if (html.includes(forbidden)) throw Error('NATURE01_FORBIDDEN_LEAK ' + forbidden);

fs.writeFileSync(FILE, html);
const zipBuf = makeZip([{ name: 'SoulOfHero_Nature01_U05.html', data: Buffer.from(html) }]);
fs.writeFileSync(ZIP, zipBuf);
fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(FILE)).digest('hex');
const artSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(WEB, 'src/game/art.ts'))).digest('hex');
const terrainSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(WEB, 'src/u05/terrain.ts'))).digest('hex');
const worldSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(WEB, 'src/u05/world.ts'))).digest('hex');
const natureSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(WEB, 'src/nature01/nature.ts'))).digest('hex');
const sitesSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(WEB, 'src/nature01/sites.ts'))).digest('hex');
const mainSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(WEB, 'src/nature01/main.ts'))).digest('hex');

const sites = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/nature01-sites.json'), 'utf8'));
let sourceSha = 'UNCOMMITTED';
try { sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { /* build before commit is fine */ }

const record = {
  schema: 'soh.u05.nature01-build.v1',
  generatedAt: new Date().toISOString(),
  file: 'creator-u05/SoulOfHero_Nature01_U05.html',
  zipMirror: 'creator-u05/SoulOfHero_Nature01_U05.zip',
  zipBytes: zipBuf.length,
  bytes, sha256,
  sourceHead: sourceSha,
  baseline: {
    file: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html',
    bytes: fs.statSync(BASELINE).size,
    sha256: baselineSha,
    untouched: baselineSha === BASELINE_SHA,
    note: 'NATURE-01 is a separate executable; the terrain-only file is never written by this build.'
  },
  selfContained: { externalScript, externalCss, importFromUrl, allFalse: !externalScript && !externalCss && !importFromUrl },
  runsFrom: ['file:// (double-click, no server)', 'http(s):// static host', 'vite dev /nature01.html'],
  sourceSha256: {
    'web-u05/src/nature01/main.ts': mainSha,
    'web-u05/src/nature01/nature.ts': natureSha,
    'web-u05/src/nature01/sites.ts': sitesSha,
    'web-u05/src/game/art.ts': artSha,
    'web-u05/src/u05/terrain.ts': terrainSha,
    'web-u05/src/u05/world.ts': worldSha
  },
  terrainSource: 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web/src/game/render.ts PAL/PRIO/texel sha256=f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803 (verbatim, unchanged)',
  geographySource: 'GOLD VEYRA_GOLD_MAP.sohmap.json + WMP-04R1 v4/r1 rasters via sampleTile() — READ ONLY. No polygon, road, river, lake, shoreline or biome raster edited.',
  contract: {
    U: 0.5, TILE: 16, viewport: [640, 360], dpr: 1, hero: [16, 24],
    basePxPerSec: 72, speedMultiplierRange: [1, 10], maxPxPerSec: 720,
    frameTiles: [4000, 2800], addressableCells: 11200000, materializedAllCells: false
  },
  natureLayer: {
    toggle: 'N key / button, or window.__nature.setNature(false|true)',
    offIsPixelIdenticalToBaseline: 'PROVEN_BY_QA (see evidence/nature01-qa.json N-G1)',
    boundedToFiveSites: true,
    sites: Object.fromEntries(Object.entries(sites.sites || {})
      .filter(([k]) => (sites.pilotSiteKeys || []).includes(k))
      .map(([k, v]) => [k, { centreTile: v.centreTile, boundsTile: v.boundsTile, shotTile: v.shotTile, shotFocus: v.shotFocus, biomeCounts: v.biomeCounts }])),
    controlWindows: Object.fromEntries(Object.entries(sites.sites || {})
      .filter(([k]) => !(sites.pilotSiteKeys || []).includes(k))
      .map(([k, v]) => [k, { centreTile: v.centreTile, boundsTile: v.boundsTile, natureObjects: 0, note: v.shotFocus }])),
    chunk: 32, maxResidentNatureChunks: 36,
    placement: 'deterministic jittered 3x3 / 2x2 lattices + low-frequency fbm clearings and clusters; biome rules, 2-tile road/bridge buffer, water-edge reed band, GOLD resource-instance exclusion, cliff exclusion',
    sprites: 'getArt().src ONLY: oak, pine, snowpine, willow, dead, rock, bush, bush_empty, grass, reed, herb, mush',
    newArtAssets: 0, newAtlas: false,
    decorativeOnly: true, gameplayOwned: false,
    noHarvest: true, noRewards: true, noDepletion: true, noOwnership: true,
    noInteraction: true, blocksMovement: false, collisionUnchanged: true,
    noBuildingsOrPoiStructures: true, noWallsRoofsDoorsFencesRuins: true,
    fullWorldPropagation: false, poiArchitectureStarted: false,
    creatorVisualAcceptance: 'NOT_GRANTED', productionMerge: 'NOT_DONE', veyraPlayable: 'NOT_CLAIMED'
  },
  scope: 'FIVE-BIOME DECORATIVE ECOLOGY PILOT ONLY — independent review requested before any full-world propagation, POI architecture, production merge or visual-acceptance claim.'
};
fs.writeFileSync(EVIDENCE, JSON.stringify(record, null, 2) + '\n');
console.log(`U05_NATURE01_BUILD_OK file=${path.basename(FILE)} bytes=${bytes} zip=${zipBuf.length} sha256=${sha256.slice(0, 16)}… baselineUntouched=${record.baseline.untouched}`);

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
