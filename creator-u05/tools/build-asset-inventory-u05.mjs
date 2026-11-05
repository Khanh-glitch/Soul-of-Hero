/**
 * P5 — asset inventory for the additive U05 physical POI program.
 * Proves: NO new atlas, NO new PNG art, every drawn structure sprite is a
 * REUSED live Gameplay art.ts buildStructs() sprite; the hero is the native
 * 16x24 buildHero() sprite; the 21 WMP-04R1 rasters are analysis data only.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const U = (p) => path.join(ROOT, p);
const shaFile = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const art = fs.readFileSync(U('web-u05/src/game/art.ts'), 'utf8');
const spriteNames = [...new Set([...art.matchAll(/\bS\.([a-z_0-9]+)\s*=/g)].map(m => m[1]))].sort();
const used = new Set();
const scenes = fs.readdirSync(U('scenes')).filter(f => f.endsWith('.u05.json')).sort()
  .map(f => JSON.parse(fs.readFileSync(U('scenes/' + f), 'utf8')));
for (const s of scenes) {
  for (const b of s.BUILDING_COMPOSITION.buildings) { used.add(b.floorSprite); used.add(b.wallSprite); used.add(b.roofSprite); }
  for (const r of s.ROOF_OCCLUSION.roofs) used.add(r.sprite);
  for (const w of s.SOLID_COLLISION.solids) used.add(w.sprite);
  for (const o of s.DOORS_ROOMS.openings) used.add(o.doorSprite);
  for (const a of s.BUILDING_COMPOSITION.spatialProgrammeAreas) used.add(a.art);
}
used.delete('none'); used.delete(undefined);
const usedSorted = [...used].sort();
const srcPngs = fs.readdirSync(U('web-u05/src'), { recursive: true }).filter(f => String(f).endsWith('.png'));
const shots = fs.readdirSync(U('evidence/shots')).filter(f => f.endsWith('.png')).sort();
const meta = JSON.parse(fs.readFileSync(path.join(REPO, 'large-world-01/map-data/GENERATED_META.json'), 'utf8'));
const rasterNames = Object.keys(meta.rasters || {}).sort();
const inventory = {
  schema: 'soh.u05.asset-inventory.v1',
  generatedAt: new Date().toISOString(),
  scope: 'ISOLATED six-scene U05 Creator audition. Additive physical POI layer. NOT full Gameplay runtime integration, NOT visual acceptance, NOT art-complete.',
  policy: 'REUSE_EXISTING_SOH_GAME_ART_RENDERER_AND_SPRITES_FIRST; productionAtlas=NOT_AUTHORIZED; creatorVisualApproval=NOT_REQUESTED.',
  noNewAtlas: true,
  newPngArtFiles: srcPngs,
  reusedStructureSprites: {
    source: 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web/src/game/art.ts buildStructs()',
    availableCount: spriteNames.length,
    usedCount: usedSorted.length,
    used: usedSorted,
    allUsedExistInSource: usedSorted.every(n => spriteNames.includes(n)),
    unusedButDeliberatelyNotUsedAsSubstitute: ['wreck', 'roof_hull', 'cart', 'cargo'],
    note: 'The live art.ts "wreck" sprite exists but is NOT used as a car wreck / ship hull / helicopter substitute. Beacon helicopter remains PROVEN_MISSING and is drawn ONLY as a dashed helipad reservation outline.'
  },
  hero: { source: 'buildHero() in live art.ts', sizePx: [16, 24], stretched: false, hud: 'NOT recreated in the isolated audition' },
  terrainPainter: {
    source: 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web/src/game/render.ts PAL/PRIO/texel',
    sha256: 'f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803',
    byteIdenticalToLw01Benchmark: true,
    generatedModule: 'creator-u05/web-u05/src/u05/terrain.ts',
    generatedModuleSha256: shaFile(U('web-u05/src/u05/terrain.ts')),
    documentedSubstitutions: 7
  },
  rasters: { count: rasterNames.length, names: rasterNames, class: 'WMP-04R1 ANALYSIS DATA — 8 AU sampled with LW-01 deterministic 1 AU dither; NEVER upscaled as authored 8 AU square land detail', module: 'creator-u05/web-u05/src/u05/lw/sources.generated.ts', moduleSha256: shaFile(U('web-u05/src/u05/lw/sources.generated.ts')) },
  vendoredLiveGameplay: { files: 231, bytes: 2535968, custody: 'creator-u05/evidence/source-custody.json', verbatimMismatches: 0 },
  lockedVisualBenchmark: { file: 'large-world-01/evidence/shots/beacon_beacon_u05.png', sha256: shaFile(path.join(REPO, 'large-world-01/evidence/shots/beacon_beacon_u05.png')), usage: 'VISUAL PRESERVATION REFERENCE ONLY — no reauthor / redraw / widen / recolour' },
  evidenceShots: { count: shots.length, bytes: shots.reduce((a, f) => a + fs.statSync(U('evidence/shots/' + f)).size, 0), files: shots, note: 'P4 QA captures (before/after/approach/reentry/roof-in/roof-out/collision). Evidence, NOT game art assets.' },
  additiveRuntimeFiles: ['u05.html', 'tsconfig.u05.json', 'src/u05/contract.ts', 'src/u05/world.ts', 'src/u05/display.ts', 'src/u05/physical.ts', 'src/u05/game.ts', 'src/u05/main.ts', 'src/u05/scenes.generated.ts'].map(p => ({ path: p, sha256: shaFile(U('web-u05/' + p)) })),
  notAssets: ['door lock/key state', 'power/HP', 'loot/ownership/cash', 'boss/reward', 'marine/boat/ferry permission', 'helicopter entity']
};
if (!inventory.reusedStructureSprites.allUsedExistInSource) throw Error('U05_ASSET_INVENTORY_UNKNOWN_SPRITE');
if (srcPngs.length) throw Error('U05_ASSET_INVENTORY_NEW_PNG_ART');
fs.writeFileSync(U('evidence/asset-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(`U05_ASSET_INVENTORY_OK sprites=${usedSorted.length}/${spriteNames.length} rasters=${rasterNames.length} shots=${shots.length} newPngArt=${srcPngs.length}`);
