#!/usr/bin/env node
// WMP-04R1 build-time adapter: Node `fs` reads the pinned Map rasters and emits
// ONE deterministic, browser-compatible TypeScript module. The browser NEVER
// imports node:fs; it decodes base64 at runtime and re-verifies SHA-256.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MAP_HEAD, GAMEPLAY_HEAD } from './vendor.mjs';

const PILOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MD = path.join(PILOT, 'map-data');
const sha256 = b => createHash('sha256').update(b).digest('hex');
const read = f => fs.readFileSync(path.join(MD, f));
const json = f => JSON.parse(read(f).toString('utf8'));

// Five pilot scenes. Scene 1 is the UNCHANGED original SOH forest/coast.
// Every WMP-04R1 scene carries a same-camera "before" layout that uses the
// pre-WMP-04R1 LR01 biome codes at the IDENTICAL origin / unitsPerTile.
const SCENES = [
  {
    id: 'wmp04r1-baseline-forest', beforeId: null, layoutId: 'shipping_fresh',
    title: 'Original SOH forest/coast', short: 'BASELINE', originAu: null, unitsPerTile: null,
    description: 'Untouched original Shipping Island; baseline for visual regression.',
    expected: ['forest', 'coast', 'meadow'], marineRegion: null, landmark: null,
  },
  {
    id: 'wmp04r1-snow-highlands', beforeId: 'wmp04r1-before-snow-highlands',
    title: 'Typhon–Argus snow highlands', short: 'SNOW', originAu: [600, 220], unitsPerTile: 2,
    description: 'WMP-04R1 snow biome, restored rock outcrops and cold-transition fringe.', viewAnchorTile: [30, 162],
    expected: ['snow', 'rock', 'forest', 'cliff'], marineRegion: null, landmark: null,
  },
  {
    id: 'wmp04r1-oasis-corridor', beforeId: 'wmp04r1-before-oasis-corridor',
    title: 'Oasis dry road/resource corridor', short: 'OASIS', originAu: [400, 840], unitsPerTile: 2,
    description: 'WMP-04R1 arid desert + scrub dry-steppe transitions with authored road centrelines.', viewAnchorTile: [176, 58],
    expected: ['desert', 'scrub_dry_steppe', 'road', 'beach'], marineRegion: null, landmark: null,
  },
  {
    id: 'wmp04r1-cinder-shore', beforeId: 'wmp04r1-before-cinder-shore',
    title: 'Cinder geothermal shoreline', short: 'CINDER', originAu: [1380, 760], unitsPerTile: 2,
    description: 'WMP-04R1 volcanic shore and the marine_cinder_geothermal_strait static domain.', viewAnchorTile: [100, 48],
    expected: ['volcanic', 'coast', 'deep_water'], marineRegion: 2, landmark: null,
  },
  {
    id: 'wmp04r1-deathwater-beacon', beforeId: 'wmp04r1-before-deathwater-beacon',
    title: 'Western Deathwater / Beacon Rock shore', short: 'DEATHWATER', originAu: [160, 560], unitsPerTile: 2,
    description: 'WMP-04R1 western Deathwater marine domain and Beacon Rock landmark coordinates.', viewAnchorTile: [56, 46],
    expected: ['forest', 'coast', 'deep_water', 'beach'], marineRegion: 1,
    landmark: { id: 'poi_beacon_engine_out_helicopter', atAu: [272, 652], status: 'PROVEN_MISSING_SCENE_OBJECT' },
  },
];
const BEFORE_SCENES = SCENES.filter(s => s.beforeId).map(s => ({
  id: s.beforeId, beforeId: null, title: `[QA BEFORE] ${s.title}`, short: `BEFORE-${s.short}`,
  originAu: s.originAu, unitsPerTile: s.unitsPerTile,
  description: `Same camera as ${s.id}, but pre-WMP-04R1 LR01 biome codes. QA comparison only.`,
  viewAnchorTile: s.viewAnchorTile,
  expected: s.expected, marineRegion: null, landmark: null, isBefore: true, afterId: s.id,
}));
// QA-ONLY diagnostic pair, NOT one of the five creator scenes. At the Oasis
// origin ([400,840]) WMP-04R1 changed ZERO biome cells, so that window cannot
// prove the dry-steppe expansion. This pair uses the actual region where WMP-04
// changed 790 meadow cells into scrub dry steppe (AU ~1000..1400 / 560..1000),
// with authored road centrelines, at the identical camera in BEFORE and AFTER.
const DIAGNOSTIC_SCENES = [
  {
    id: 'wmp04r1-dry-transition', beforeId: 'wmp04r1-before-dry-transition',
    title: '[QA] WMP-04R1 dry-steppe expansion', short: 'DRY-DELTA',
    originAu: [1000, 600], unitsPerTile: 2, viewAnchorTile: [69, 97],
    description: 'QA diagnostic: the actual WMP-04 meadow→scrub dry-steppe expansion with authored roads; not one of the five creator scenes.',
    expected: ['scrub_dry_steppe', 'road', 'beach', 'meadow'], marineRegion: null, landmark: null,
    diagnostic: true,
  },
  {
    id: 'wmp04r1-before-dry-transition', beforeId: null,
    title: '[QA BEFORE] dry-steppe expansion', short: 'BEFORE-DRY-DELTA',
    originAu: [1000, 600], unitsPerTile: 2, viewAnchorTile: [69, 97],
    description: 'Same camera as wmp04r1-dry-transition, pre-WMP-04R1 LR01 biome codes. QA comparison only.',
    expected: ['meadow', 'road', 'beach'], marineRegion: null, landmark: null,
    isBefore: true, afterId: 'wmp04r1-dry-transition', diagnostic: true,
  },
];
const ALL = [...SCENES, ...BEFORE_SCENES, ...DIAGNOSTIC_SCENES];

function main() {
  const provenance = JSON.parse(fs.readFileSync(path.join(PILOT, 'ASSET_PROVENANCE.json'), 'utf8'));
  const byFile = new Map(provenance.files.map(r => [r.file, r]));
  // 1. active authority
  const pointer = json('CURRENT_WORLD_MASTER.json');
  if (pointer.activeRevision !== 'WMP-04R1') throw new Error('WMP04R1_NOT_ACTIVE');
  if (pointer.activeManifest !== 'v4/r1/manifest.r1.json') throw new Error('WMP04R1_MANIFEST_MISMATCH');
  const mv4 = json('manifest.v4.json'), mr1 = json('manifest.r1.json');
  if (mr1.revision !== 'WMP-04R1' || mv4.revision !== 'WMP-04') throw new Error('WMP04R1_MANIFEST_REVISION');
  const design = json('geography_design.r1.json');
  const sites = json('marine_sites.v4.json');
  const nav = json('marine_navigation.v4.json');
  if (design.revision !== 'WMP-04R1' || nav.static.footOnSea !== 'FORBIDDEN; cargoPassable on sea likewise false')
    throw new Error('WMP04R1_DESIGN_OR_NAV_CONTRACT');

  // 2. every copied Map byte matches its pinned source digest
  const RASTERS = {
    biomeEffective: 'biomeEffective.r1.u8',
    coldTransition: 'coldTransition.r1.u8',
    marineRegion: 'marineRegion.v4.u8',
    cliffCandidate: 'cliffCandidate.v3.u8',
    heightClass: 'heightClass.v3.u8',
    waterClass: 'waterClass.u8',
    sourceBiomeCode: 'biomeCode.u8',
  };
  const data = {}, digests = {}, sizes = {};
  for (const [key, file] of Object.entries(RASTERS)) {
    const b = read(file);
    const rec = byFile.get(`map-data/${file}`);
    if (!rec) throw new Error(`MISSING_PROVENANCE ${file}`);
    const h = sha256(b);
    if (h !== rec.sha256 || b.length !== rec.bytes) throw new Error(`DIGEST_MISMATCH ${file}`);
    if (b.length !== 250 * 175) throw new Error(`RASTER_LENGTH ${file} ${b.length}`);
    data[key] = b; digests[key] = h; sizes[key] = b.length;
    if (file.endsWith('.r1.u8') || file === 'marineRegion.v4.u8') {
      const isR1 = file.startsWith('biomeEffective') || file.startsWith('coldTransition');
      const list = isR1 ? mr1.outputs : mv4.data;
      const declared = list.find(d => d.path.endsWith(file));
      if (!declared) throw new Error(`MANIFEST_ENTRY_MISSING ${file}`);
      if (declared.bytes !== b.length) throw new Error(`MANIFEST_BYTES ${file}`);
    }
  }
  // 3. static geographic assertions from the Map contract
  let marineOnlyOnWater = true, biomeRangeOk = true, coldRangeOk = true, changedSeaCells = 0;
  for (let i = 0; i < 43750; i++) {
    if (data.marineRegion[i] > 2) marineOnlyOnWater = false;
    if (data.marineRegion[i] !== 0 && data.waterClass[i] === 0) marineOnlyOnWater = false;
    if (data.biomeEffective[i] > 11) biomeRangeOk = false;
    if (data.coldTransition[i] > 3) coldRangeOk = false;
    if (data.waterClass[i] !== 0 && data.biomeEffective[i] !== data.sourceBiomeCode[i]) changedSeaCells++;
  }
  if (!marineOnlyOnWater || !biomeRangeOk || !coldRangeOk) throw new Error('WMP04R1_STATIC_ASSERTION_FAIL');
  // WMP-04R1 promises zero changed sea-water biome cells.
  if (changedSeaCells !== 0) throw new Error(`WMP04R1_CHANGED_SEA_CELLS ${changedSeaCells}`);

  // 4. per-scene measured geography (8 AU analytical cell sampled at U=2 tile centres)
  const codeName = ['meadow', 'forest', 'ancient', 'conifer', 'marsh', 'desert', 'scrub_dry_steppe', 'rock', 'snow', 'volcanic', 'toxic', 'beach'];
  const sceneStats = ALL.filter(s => s.originAu).map(s => {
    const counts = { tiles: 0, dryTiles: 0, waterTiles: 0 }, codes = {}, cold = {}, marine = {};
    for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) {
      const auX = s.originAu[0] + (x + .5) * s.unitsPerTile, auY = s.originAu[1] + (y + .5) * s.unitsPerTile;
      const gx = Math.floor(auX / 8), gy = Math.floor(auY / 8);
      if (gx >= 250 || gy >= 175) continue;
      const ri = gy * 250 + gx; counts.tiles++;
      if (data.waterClass[ri] === 0) counts.dryTiles++; else counts.waterTiles++;
      const code = s.isBefore ? data.sourceBiomeCode[ri] : data.biomeEffective[ri];
      const name = codeName[code] || `code${code}`; codes[name] = (codes[name] || 0) + 1;
      cold[data.coldTransition[ri]] = (cold[data.coldTransition[ri]] || 0) + 1;
      marine[data.marineRegion[ri]] = (marine[data.marineRegion[ri]] || 0) + 1;
    }
    return { id: s.id, originAu: s.originAu, unitsPerTile: s.unitsPerTile, isBefore: !!s.isBefore, counts, biomeTileCounts: codes, coldTransitionTileCounts: cold, marineRegionTileCounts: marine };
  });

  // 5. emit the browser module. Deterministic: no wallclock, stable key order.
  const b64 = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.toString('base64')]));
  const meta = {
    schema: 'soh.wmp04r1.browser_geography.v1',
    activeRevision: pointer.activeRevision,
    activeManifest: pointer.activeManifest,
    basePhysicalRevision: pointer.basePhysicalRevision,
    mapHead: MAP_HEAD, gameplayHead: GAMEPLAY_HEAD,
    sourceGrid: { gw: 250, gh: 175, cellAu: 8, unitsPerTileDiagnostic: 2 },
    policy: pointer.policy,
    authority: pointer.authority,
    artDirection: pointer.artDirection,
    digests, sizes,
    biomeCodes: codeName,
    coldCodes: ['unrelated', 'outer_fringe', 'frost_boundary', 'snow_biome_core'],
    marineCodes: ['ordinary', 'marine_west_deadly_depths', 'marine_cinder_geothermal_strait'],
    marineRegions: sites.regions,
    landmarks: sites.uniqueLandmarks,
    navigationStatic: nav.static,
    scenes: SCENES, beforeScenes: BEFORE_SCENES, diagnosticScenes: DIAGNOSTIC_SCENES, allLayouts: ALL,
    sceneStats,
    provenance: { currentWorldMasterSha256: sha256(read('CURRENT_WORLD_MASTER.json')), manifestV4Sha256: sha256(read('manifest.v4.json')), manifestR1Sha256: sha256(read('manifest.r1.json')) },
    note: 'Generated by tools/build-adapter.mjs from pinned Map bytes. 8 AU analytical cells are NOT gameplay tiles; U=2 is diagnostic and NOT an approved world scale.',
  };
  const ts = `// GENERATED FILE — DO NOT EDIT. Source: wmp04r1-pilot/tools/build-adapter.mjs
// Browser-compatible WMP-04R1 static geography. No node:fs, no network, no GOLD.
// 8 AU analytical cells and U=2 are DIAGNOSTIC, not an approved world scale.
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
export interface Wmp04Scene { id: string; beforeId: string | null; layoutId?: string; title: string; short: string; originAu: [number, number] | null; unitsPerTile: 1.6 | 2 | null; description: string; expected: string[]; viewAnchorTile?: [number, number]; diagnostic?: boolean; marineRegion: number | null; landmark: { id: string; atAu: [number, number]; status: string } | null; isBefore?: boolean; afterId?: string }
export const WMP04R1_META = ${JSON.stringify(meta, null, 2)} as const;
const B64: Record<string, string> = ${JSON.stringify(b64, null, 2)};
const EXPECTED: Record<string, string> = ${JSON.stringify(digests, null, 2)};
const cache: Record<string, Uint8Array> = {};
export function wmp04Raster(name: keyof typeof B64): Uint8Array {
  if (cache[name]) return cache[name];
  const bin = atob(B64[name]);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  if (a.length !== 250 * 175) throw new Error('WMP04R1_BAD_RASTER ' + name);
  if (bytesToHex(sha256(a)) !== EXPECTED[name]) throw new Error('WMP04R1_DIGEST_MISMATCH ' + name);
  cache[name] = a; return a;
}
export function verifyWmp04R1(): { ok: boolean; digests: Record<string, string>; revision: string } {
  const out: Record<string, string> = {};
  for (const name of Object.keys(B64)) out[name] = bytesToHex(sha256(wmp04Raster(name as keyof typeof B64)));
  return { ok: Object.keys(B64).every(k => out[k] === EXPECTED[k]), digests: out, revision: WMP04R1_META.activeRevision };
}
export const WMP04R1_SCENES: readonly Wmp04Scene[] = ${JSON.stringify(SCENES, null, 2)};
export const WMP04R1_BEFORE: readonly Wmp04Scene[] = ${JSON.stringify(BEFORE_SCENES, null, 2)};
export const WMP04R1_ALL: readonly Wmp04Scene[] = ${JSON.stringify(ALL, null, 2)};
export const WMP04R1_LAYOUT_IDS: readonly string[] = ${JSON.stringify(ALL.filter(s => s.originAu).map(s => s.id))};
export function wmp04SceneForLayout(layout: string): Wmp04Scene | undefined {
  return WMP04R1_ALL.find(s => s.id === layout);
}
export function wmp04CellIndex(atAu: [number, number]): number | null {
  const [x, y] = atAu;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= 2000 || y >= 1400) return null;
  return Math.floor(y / 8) * 250 + Math.floor(x / 8);
}
`;
  const outDir = path.join(PILOT, 'web-pilot/src/game/veyra');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'wmp04r1.generated.ts'), ts);
  fs.writeFileSync(path.join(PILOT, 'map-data/GENERATED_META.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(`WMP04R1_ADAPTER_OK rasters=${Object.keys(data).length} layouts=${ALL.filter(s => s.originAu).length} active=${pointer.activeRevision} changedSeaCells=${changedSeaCells} moduleBytes=${ts.length}`);
}

if (process.argv[1] && process.argv[1].endsWith('build-adapter.mjs')) main();
export { main as buildAdapter, SCENES, ALL };
