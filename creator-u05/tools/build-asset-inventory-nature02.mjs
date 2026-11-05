/**
 * NATURE-02 ART AUDIT / ASSET INVENTORY — reproducible, no new art created.
 *
 * Enumerates EVERY `getArt().src` array in the vendored SOH art.ts, then reads
 * REAL alpha bounding boxes of the live offscreen canvases from the standalone
 * NATURE-02 executable in Chromium. Records exact proportions vs the 16x24
 * hero, the decorative-vs-harvestable semantic conflict, and the proposed
 * (NOT created, NOT approved) asset gap specification.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from '/home/user/pr38/web/node_modules/playwright/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web-u05');
const HTML = path.join(ROOT, 'SoulOfHero_Nature02_ForestSlice.html');
const OUT = path.join(ROOT, 'evidence/nature02-assets.json');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const art = fs.readFileSync(path.join(WEB, 'src/game/art.ts'), 'utf8');
const body = art.slice(art.indexOf('export function buildSources()'), art.indexOf('// ===================== STRUCTURES'));
const allSprites = [...body.matchAll(/S\.([a-z_0-9]+)\s*=/g)].map(m => m[1]);
const USED = ['oak', 'pine', 'willow', 'dead', 'rock', 'grass'];
const HERO = [16, 24];

const browser = await chromium.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib' }
});
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('file://' + HTML);
await page.waitForFunction(() => window.__nature02 && window.__nature02.ready === true, { timeout: 60000 });
const live = await page.evaluate(() => ({
  metrics: window.__nature02.artMetrics(),
  inventory: window.__nature02.assetInventory(),
  owner: window.__nature02.ownerDependency(),
  gap: window.__nature02.assetGapSpec(),
  forest: window.__nature02.forestStats()
}));
await browser.close();

const byKey = Object.fromEntries(live.metrics.sprites.map(m => [m.key, m]));
const proportion = m => ({
  canvasPx: m.size, canvasWidthVsHero: +(m.size[0] / HERO[0]).toFixed(3),
  canvasHeightVsHero: +(m.size[1] / HERO[1]).toFixed(3),
  alphaBBox: m.alphaBBox, alphaPixels: m.alphaPixels,
  visibleWidthPx: m.alphaBBox[2] - m.alphaBBox[0] + 1,
  visibleHeightPx: m.alphaBBox[3] - m.alphaBBox[1] + 1,
  visibleWidthVsHero: +((m.alphaBBox[2] - m.alphaBBox[0] + 1) / HERO[0]).toFixed(3),
  visibleHeightVsHero: +((m.alphaBBox[3] - m.alphaBBox[1] + 1) / HERO[1]).toFixed(3)
});

const inventory = {
  schema: 'soh.u05.nature02-assets.v1',
  generatedAt: new Date().toISOString(),
  auditQuestion: 'Can the ACTUAL native SOH tree / shrub / rock sprites convincingly represent forest canopy and undergrowth at U=0.5, 640x360 @1x, hero 16x24, WITHOUT arbitrarily enlarging them?',
  answer: 'PARTIAL / NOT CONVINCING AS A SURVIVAL FOREST. Coherent stands, dense edges and readable clearings ARE achievable at native scale with existing art, but there is NO overhead canopy, NO mid-storey, NO non-harvestable undergrowth and NO semantic separation from harvestable SOURCES.',
  artSource: {
    file: 'creator-u05/web-u05/src/game/art.ts', sha256: sha(path.join(WEB, 'src/game/art.ts')),
    vendoredFrom: 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web/src/game/art.ts',
    note: 'Original SOH pixel art painted into offscreen canvases at boot. No third-party sprites, no new PNG/JPG, no new atlas.',
    htmlSha256: sha(HTML)
  },
  method: {
    hero: 'getArt().hero.male.idle0[0], alpha bounding box measured from the live canvas',
    sprites: 'AUDIT_KEYS = 12 real getArt().src arrays; alpha bounding box = min/max opaque pixel coordinates',
    inspection: 'creator-u05/evidence/nature02-shots/art_audit_sheet.png — 640x360 native sheet, sprites at 1x plus a labelled 2x inspection panel (M key in the pilot)',
    spriteScaling: false, spriteEnlargement: false, newPixelsPaintedIntoArt: false,
    renderingOnlyEffect: 'a translucent 0.22-alpha ground shadow ellipse under tall sprites (render effect, not an asset, not a prop)'
  },
  hero: { key: live.metrics.hero.key, canvasPx: live.metrics.hero.size, ...proportion(live.metrics.hero) },
  totalGetArtSrcArrays: allSprites.length,
  auditedSpriteArrays: live.metrics.sprites.length,
  auditedSprites: live.metrics.sprites.map(m => ({ spriteArray: 'src.' + m.key, ...proportion(m) })),
  usedByNATURE02: USED.map(k => ({
    spriteArray: 'src.' + k, ...proportion(byKey[k]), role: live.inventory.used.find(u => u.kind === k)?.role,
    semanticRisk: live.inventory.used.find(u => u.kind === k)?.risk,
    classification: 'DECORATIVE_FOREST_ONLY__NOT_APPROVED_FOR_PRODUCTION',
    decorativeOnly: true, gameplayOwned: false, hasStock: false, hasDepletion: false,
    hasReward: false, hasOwnership: false, hasInteraction: false, blocksMovement: false,
    spriteScaling: false
  })),
  excludedSprites: allSprites.filter(k => !USED.includes(k)).map(k => ({
    spriteArray: 'src.' + k,
    ...(byKey[k] ? proportion(byKey[k]) : {}),
    usedByNATURE02: false,
    reason: ['bush', 'bush_empty'].includes(k) ? 'stocked / DEPLETED Berry Bush states'
      : ['herb', 'mush', 'reed'].includes(k) ? 'harvestable plant SOURCE'
        : ['stump', 'rubble', 'picked'].includes(k) ? 'harvest depletion state'
          : ['iron', 'coal', 'sulfur', 'crystal'].includes(k) ? 'ore SOURCE'
            : ['scrap', 'wreck'].includes(k) ? 'artificial prop'
              : ['palm'].includes(k) ? 'unrelated biome'
                : k === 'snowpine' ? 'snow/conifer biome; this slice is temperate forest only'
                  : 'not needed by the six-sprite forest palette'
  })),
  proportionsSummary: {
    treeCanvasHeightVsHero: +(32 / 24).toFixed(4),
    treeCanvasWidthVsHero: +(24 / 16).toFixed(4),
    heroVisibleAlphaBBoxPx: [live.metrics.hero.alphaBBox[2] - live.metrics.hero.alphaBBox[0] + 1, live.metrics.hero.alphaBBox[3] - live.metrics.hero.alphaBBox[1] + 1],
    oakVisibleAlphaBBoxPx: [byKey.oak.alphaBBox[2] - byKey.oak.alphaBBox[0] + 1, byKey.oak.alphaBBox[3] - byKey.oak.alphaBBox[1] + 1],
    interpretation: 'A tree is only 1.333x the hero height (8px taller), and its crown starts at the TOP of its 32px canvas. With the hero drawn at tile y+14 and trees at tile y-16, the crown never rises above the hero head by more than a few pixels. At native 1x the forest is a WALL of separate lollipop crowns seen obliquely; there is no overhead canopy, no layered silhouette and no sense of walking UNDER trees.'
  },
  canopyVerdict: 'NOT_CONVINCING_WITH_EXISTING_ART_ALONE',
  undergrowthVerdict: 'NOT_CONVINCING_WITH_EXISTING_ART_ALONE: grass/rock/reed/herb/mush are harvestable SOURCES; bush/bush_empty encode stocked/depleted Berry Bush; there is no dedicated non-harvestable fern/sapling layer.',
  semanticConflict: {
    status: 'UNRESOLVED__BLOCKS_PRODUCTION',
    ownerDependency: live.owner,
    exactFact: 'A visually identical oak/rock/grass sprite is SOLID and HARVESTABLE (stock, yields, block:true) in live Gameplay, and r.natureTrees reuses A.src.oak for SOLID grove trees that spawn wood drops. NATURE-02 objects have none of those properties. Two identical-looking objects with contradictory interactions may NOT be approved for production.',
    mapCannotChange: true,
    pilotGuarantee: live.owner.pilotGuarantee
  },
  assetGap: live.gap,
  decorativeOnlyClassification: {
    newArtAssets: 0, newAtlases: 0, newPngOrJpgFiles: 0, externalAssetsAtRuntime: 0,
    spriteScaling: false, fullWorldPropagation: false,
    noBuildingsOrPoiOrRuinsOrFencesOrArbitraryProps: true,
    productionApproved: false, creatorVisualAcceptance: 'NOT_GRANTED'
  },
  browserErrors: errors,
  scope: 'ONE-BIOME FOREST ART AUDIT — not a production-art claim, not a substitute asset, not visual acceptance.'
};
fs.writeFileSync(OUT, JSON.stringify(inventory, null, 2) + '\n');
console.log(`U05_NATURE02_ASSETS_OK getArtSrcArrays=${allSprites.length} audited=${live.metrics.sprites.length} used=${USED.length} excluded=${allSprites.length - USED.length} newArt=0 errors=${errors.length}`);
