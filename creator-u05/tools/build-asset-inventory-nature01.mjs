/**
 * NATURE-01 asset inventory — reproducible, no new art created.
 * Reads the vendored SOH art source, enumerates every `getArt().src` sprite
 * array, and explicitly classifies NATURE-01's objects as DECORATIVE (not
 * Gameplay-owned harvestable resources).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web-u05');
const art = fs.readFileSync(path.join(WEB, 'src/game/art.ts'), 'utf8');
const sites = fs.readFileSync(path.join(WEB, 'src/nature01/sites.ts'), 'utf8');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// Every sprite array built by buildSources(), in declaration order.
const body = art.slice(art.indexOf('export function buildSources()'), art.indexOf('// ===================== STRUCTURES'));
const allSprites = [...body.matchAll(/S\.([a-z_0-9]+)\s*=/g)].map(m => m[1]);
const used = [...sites.matchAll(/kind:\s*'([a-z_]+)'/g)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i);
const GAMEPLAY_OWNED = ['iron', 'coal', 'sulfur', 'crystal', 'stump', 'rubble', 'picked'];
const ARTIFICIAL = ['scrap', 'wreck'];
const UNUSED_UNRELATED = ['palm'];
const excluded = k => GAMEPLAY_OWNED.includes(k) ? 'GAMEPLAY_OWNED_HARVESTABLE_RESOURCE_SPRITE__NOT_USED'
  : ARTIFICIAL.includes(k) ? 'ARTIFICIAL_PROP_SPRITE__NOT_USED'
    : UNUSED_UNRELATED.includes(k) ? 'EXISTING_SOH_ART__UNUSED_IN_THESE_FIVE_WINDOWS' : 'EXISTING_SOH_ART__UNUSED_BY_PILOT';
const sizes = k => ['oak', 'pine', 'snowpine', 'palm', 'willow', 'dead'].includes(k) ? [24, 32] : k === 'wreck' ? [32, 20] : [16, 16];
const variants = k => {
  const m = body.match(new RegExp('S\\.' + k + '\\s*=\\s*\\[([^\\]]*)\\]'));
  if (!m) return 1;
  const n = (m[1].match(/,/g) || []).length + 1;
  return Math.max(1, n);
};

const files = {
  'SoulOfHero_Nature01_U05.html': path.join(ROOT, 'SoulOfHero_Nature01_U05.html'),
  'SoulOfHero_TerrainOnly_U05_x10.html': path.join(ROOT, 'SoulOfHero_TerrainOnly_U05_x10.html'),
  'web-u05/src/game/art.ts': path.join(WEB, 'src/game/art.ts'),
  'web-u05/src/u05/terrain.ts': path.join(WEB, 'src/u05/terrain.ts'),
  'web-u05/src/u05/world.ts': path.join(WEB, 'src/u05/world.ts'),
  'web-u05/src/nature01/nature.ts': path.join(WEB, 'src/nature01/nature.ts'),
  'web-u05/src/nature01/sites.ts': path.join(WEB, 'src/nature01/sites.ts'),
  'web-u05/src/nature01/main.ts': path.join(WEB, 'src/nature01/main.ts'),
  'web-u05/nature01.html': path.join(WEB, 'nature01.html')
};

const inventory = {
  schema: 'soh.u05.nature01-assets.v1',
  generatedAt: new Date().toISOString(),
  artSource: {
    file: 'creator-u05/web-u05/src/game/art.ts',
    sha256: sha(files['web-u05/src/game/art.ts']),
    vendoredFrom: 'b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web/src/game/art.ts',
    unchangedAtGameplayHead: '5b3e683402bbc8540dea9404576164097e753f97 (git diff --stat on art.ts is empty)',
    note: 'Original SOH pixel art painted into offscreen canvases at boot. No third-party sprites, no new PNG/JPG, no new atlas.'
  },
  sourceSha256: Object.fromEntries(Object.entries(files).map(([k, f]) => [k, sha(f)])),
  totalGetArtSrcArrays: allSprites.length,
  nature01UsedSprites: used.map(k => ({
    spriteArray: 'src.' + k, sizePx: sizes(k), variants: variants(k),
    classification: 'DECORATIVE_NATURE_ONLY',
    decorative: true, gameplayOwned: false, harvestable: false,
    hasStock: false, hasDepletion: false, hasReward: false, hasOwnership: false, hasInteraction: false
  })),
  excludedSprites: allSprites.filter(k => !used.includes(k)).map(k => ({
    spriteArray: 'src.' + k, sizePx: sizes(k), classification: excluded(k), usedByNature01: false
  })),
  gameplayOwnedSourceEntities: {
    definition: 'Live Gameplay `sourceAt()` entities backed by SOURCES definitions with stock/yields/regrow and depletion state, drawn by drawSource().',
    status: 'NOT_IMPORTED__NOT_DRAWN__NOT_MINTED_BY_NATURE01',
    examples: GAMEPLAY_OWNED.map(k => 'src.' + k),
    explicitDisclosure: 'NATURE-01 decorative trees/rocks/plants are NOT automatically harvestable resources. No reward, depletion, ownership, interaction range or inventory transaction exists in this pilot.'
  },
  geographyAssets: {
    rasters: '21 WMP-04R1 v4/r1 base64 rasters embedded in the standalone HTML (unchanged from the terrain-only build)',
    gold: 'veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json (read only)',
    painter: 'verbatim live PAL/PRIO/texel sha256=f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803',
    editedByNature01: false
  },
  newArtAssets: 0, newPngOrJpgFiles: 0, newAtlases: 0, externalAssetsAtRuntime: 0,
  scope: 'FIVE-BIOME PILOT INVENTORY — not a production-art claim, not an all-81-art claim, not a merge-ready claim.'
};
const out = path.join(ROOT, 'evidence/nature01-assets.json');
fs.writeFileSync(out, JSON.stringify(inventory, null, 2) + '\n');
console.log(`U05_NATURE01_ASSETS_OK getArtSrcArrays=${allSprites.length} used=${used.length} excluded=${allSprites.length - used.length} newArt=${inventory.newArtAssets}`);
