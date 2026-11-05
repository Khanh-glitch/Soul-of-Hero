/**
 * Produce the NATURE-02 DELIVERABLE: one standalone, server-free HTML pilot.
 *
 *   creator-u05/SoulOfHero_Nature02_ForestSlice.html
 *
 * ASSERTS by SHA-256 that the terrain-only baseline AND the NATURE-01 pilot are
 * untouched before writing anything. No existing executable/evidence is read
 * for modification — only for verification.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(ROOT, 'web-u05');
const OUT_DIR = path.join(WEB, 'nature02-dist');
const BUILT = path.join(OUT_DIR, 'nature02.html');
const FILE = path.join(ROOT, 'SoulOfHero_Nature02_ForestSlice.html');
const ZIP = path.join(ROOT, 'SoulOfHero_Nature02_ForestSlice.zip');
const EVIDENCE = path.join(ROOT, 'evidence/nature02-build.json');
const BASELINE = path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html');
const NATURE01 = path.join(ROOT, 'SoulOfHero_Nature01_U05.html');
const BASELINE_SHA = '540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0';
const NATURE01_SHA = 'ac4d54e310f0f3cf7e0e12d728bc5e9ad62f801994be37ce64f76b099af4a0a7';

const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const baselineSha = hash(BASELINE), nature01Sha = hash(NATURE01);
if (baselineSha !== BASELINE_SHA) throw Error('NATURE02_BASELINE_MODIFIED ' + baselineSha);
if (nature01Sha !== NATURE01_SHA) throw Error('NATURE02_NATURE01_MODIFIED ' + nature01Sha);

execFileSync('npx', ['vite', 'build', '--config', 'vite.nature02.config.mjs'], {
  cwd: WEB, stdio: 'inherit', env: { ...process.env }
});
if (!fs.existsSync(BUILT)) throw Error('NATURE02_BUILD_MISSING');
const html = fs.readFileSync(BUILT, 'utf8');
const bytes = Buffer.byteLength(html);
const externalScript = /<script[^>]+src=/i.test(html);
const externalCss = /<link[^>]+rel=["']?stylesheet/i.test(html);
const importFromUrl = /(?:from\s*|import\s*)["']https?:\/\//.test(html);
if (externalScript || externalCss || importFromUrl) throw Error('NATURE02_NOT_SELF_CONTAINED');
for (const marker of [
  'NATURE02', 'setForest', 'auditBtn', 'artAudit', 'auditForest', 'forestObjectsInRect',
  'speedRange', 'x10', 'TERRAIN_ONLY', 'render16', 'creator-u05', 'zoomRange',
  'WHOLE_MAP_OVERVIEW', 'CENTER_FOLLOW', 'playerMarker', 'lens', 'isolatedCells',
  'despeckleStats', 'getArt', 'NOT_APPROVED_FOR_PRODUCTION', 'N02-ASSET-GAP-01',
  'dense_interior', 'clearing', 'road_forest_edge', 'forest_canopy_oak'
]) if (!html.includes(marker)) throw Error('NATURE02_MARKER_MISSING ' + marker);
for (const forbidden of [
  'PhysicalLayer', 'U05_SCENES', 'SITE_ENVELOPE', 'BUILDING_COMPOSITION',
  'ROOF_OCCLUSION', 'roofHiddenCount', 'drawSource', 'harvestProbe', 'VEYRA_PLAYABLE'
]) if (html.includes(forbidden)) throw Error('NATURE02_FORBIDDEN_LEAK ' + forbidden);

fs.writeFileSync(FILE, html);
const zipBuf = makeZip([{ name: 'SoulOfHero_Nature02_ForestSlice.html', data: Buffer.from(html) }]);
fs.writeFileSync(ZIP, zipBuf);
fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
const sha256 = hash(FILE);
const sourceFiles = {
  'SoulOfHero_Nature02_ForestSlice.html': FILE,
  'SoulOfHero_Nature01_U05.html': NATURE01,
  'SoulOfHero_TerrainOnly_U05_x10.html': BASELINE,
  'web-u05/nature02.html': path.join(WEB, 'nature02.html'),
  'web-u05/src/nature02/main.ts': path.join(WEB, 'src/nature02/main.ts'),
  'web-u05/src/nature02/forest.ts': path.join(WEB, 'src/nature02/forest.ts'),
  'web-u05/src/nature02/forest-sites.ts': path.join(WEB, 'src/nature02/forest-sites.ts'),
  'web-u05/src/nature02/art-audit.ts': path.join(WEB, 'src/nature02/art-audit.ts'),
  'web-u05/src/game/art.ts': path.join(WEB, 'src/game/art.ts'),
  'web-u05/src/u05/terrain.ts': path.join(WEB, 'src/u05/terrain.ts'),
  'web-u05/src/u05/world.ts': path.join(WEB, 'src/u05/world.ts')
};
let sourceHead = 'UNCOMMITTED';
try { sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { }
const sites = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/nature02-forest.json'), 'utf8'));

const record = {
  schema: 'soh.u05.nature02-build.v1',
  generatedAt: new Date().toISOString(),
  file: 'creator-u05/SoulOfHero_Nature02_ForestSlice.html',
  zipMirror: 'creator-u05/SoulOfHero_Nature02_ForestSlice.zip',
  zipBytes: zipBuf.length, bytes, sha256, sourceHead,
  preserved: {
    terrainBaseline: { file: 'creator-u05/SoulOfHero_TerrainOnly_U05_x10.html', sha256: baselineSha, untouched: true },
    nature01: { file: 'creator-u05/SoulOfHero_Nature01_U05.html', sha256: nature01Sha, untouched: true },
    nature01EvidenceUntouched: true, goldPolygonsUnchanged: true, wmp04r1RastersUnchanged: true,
    roadsRiversCollisionAuthorityUnchanged: true, verbatimPainterUnchanged: true
  },
  selfContained: { externalScript, externalCss, importFromUrl, allFalse: !externalScript && !externalCss && !importFromUrl },
  runsFrom: ['file:// (double-click)', 'http(s):// static host', 'vite dev /nature02.html'],
  sourceSha256: Object.fromEntries(Object.entries(sourceFiles).map(([k, f]) => [k, hash(f)])),
  artSource: 'creator-u05/web-u05/src/game/art.ts (vendored verbatim from b5c8004c:web/src/game/art.ts)',
  geographySource: 'GOLD VEYRA_GOLD_MAP.sohmap.json + WMP-04R1 v4/r1 via sampleTile() — READ ONLY',
  contract: {
    U: 0.5, TILE: 16, viewport: [640, 360], dpr: 1, hero: [16, 24],
    basePxPerSec: 72, speedMultiplierRange: [1, 10], maxPxPerSec: 720,
    frameTiles: [4000, 2800], addressableCells: 11200000, materializedAllCells: false
  },
  forestSlice: {
    oneBiomeOnly: true, biome: 'temperate_forest', window: sites.window,
    compositions: sites.compositions, stands: sites.stands.length,
    clearings: sites.clearings.length, routes: sites.routes.length,
    routeDefinition: 'OBJECT-FREE CORRIDORS ONLY. No path/road/ground pixel painted, no GOLD geometry authored, no Gameplay navigation permission minted.',
    toggle: 'N key / button, or window.__nature02.setForest(false|true)',
    offIsPixelIdenticalToBaseline: 'PROVEN_BY_QA (see nature02-qa.json F-G1)',
    spriteScaling: false, newArtAssets: 0, newAtlases: 0,
    decorativeOnly: true, gameplayOwned: false, productionApproved: false,
    noRewards: true, noDepletion: true, noOwnership: true, noInteraction: true,
    blocksMovement: false, collisionUnchanged: true,
    noBuildingsOrPoiStructuresOrRuinsOrFencesOrProps: true,
    otherBiomesUnchanged: true, fullWorldPropagation: false,
    creatorVisualAcceptance: 'NOT_GRANTED', productionMerge: 'NOT_DONE', veyraPlayable: 'NOT_CLAIMED'
  },
  semanticConflict: {
    summary: 'Existing SOH oak/pine/rock/grass sprites are visually identical to live Gameplay SOURCES (block:true, stock, yields) and to r.natureTrees (solid, wood drops). Exact owner dependency is recorded in src/nature02/forest-sites.ts OWNER_DEPENDENCY.',
    ownerBranch: 'arena/d4bfcfff-soul-of-hero', verifiedHead: '5b3e683402bbc8540dea9404576164097e753f97',
    observedLaterHead: '2f0836587b76a4a98fffedf8c202fb37cbb2a67c',
    mapCannotChange: true, pilotStatus: 'NOT_APPROVED_FOR_PRODUCTION'
  },
  scope: 'ONE-BIOME FOREST QUALITY VERTICAL SLICE — reviewable pilot only. QA and screenshots are NOT visual acceptance.'
};
fs.writeFileSync(EVIDENCE, JSON.stringify(record, null, 2) + '\n');
console.log(`U05_NATURE02_BUILD_OK bytes=${bytes} zip=${zipBuf.length} sha256=${sha256.slice(0, 16)}… baselineUntouched=true nature01Untouched=true`);

/** Minimal STORE/DEFLATE ZIP writer (single entry), no dependency. */
function makeZip(entries) {
  const chunks = [], central = []; let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8'), crc = crc32(e.data);
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
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, name]));
    offset += local.length + name.length + payload.length;
  }
  const cdBuf = Buffer.concat(central), end = Buffer.alloc(22);
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
