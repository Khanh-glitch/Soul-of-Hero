/**
 * NATURE-02 — FOREST QUALITY VERTICAL SLICE. ONE biome only.
 *
 * This is a NEW, separate pilot. `src/nature01/*`, the NATURE-01 executable and
 * the terrain-only executable are NOT modified. Only the temperate-forest
 * 96x64-tile window receives objects; every other tile in the 4000x2800 frame
 * (including the other four NATURE-01 windows) has ZERO nature objects.
 *
 * All structures below are READ-ONLY interpretations of GOLD / WMP-04R1. No
 * road, river, lake, shoreline, biome raster or GOLD polygon is authored.
 */
import type { NatureKind } from '../nature01/nature-types';

export type CompositionKey = 'dense_interior' | 'clearing' | 'road_forest_edge';

export interface Stand {
  id: string; c: [number, number]; r: [number, number];
  species: keyof typeof SPECIES;
  note: string;
}
export interface Opening { id: string; c: [number, number]; r: [number, number]; note: string }
export interface Route { id: string; width: number; points: [number, number][]; note: string }
export interface Composition {
  key: CompositionKey; label: string; shotTile: [number, number];
  intent: string; reviewQuestions: string[];
}

/** The ONLY window with objects (identical to NATURE-01 temperate_forest). */
export const FOREST_BOUNDS: [number, number, number, number] = [1392, 1288, 1488, 1352];
export const FOREST_CHUNK = 32;
export const MAX_RESIDENT_FOREST_CHUNKS = 36;
export const ROAD_BUFFER_TILES = 3;   // NATURE-01 used 2; widened for a readable road edge
export const TREE_WATER_BUFFER_TILES = 2;

export const COMPOSITIONS: Record<CompositionKey, Composition> = {
  dense_interior: {
    key: 'dense_interior', label: '01 Rừng sâu / Dense forest interior',
    shotTile: [1416, 1320],
    intent: 'coherent oak stands with overlapping native-scale canopies, dense shrub/rock edges, a deliberate object-free trail and remaining natural gaps',
    reviewQuestions: ['Canopy reads as a forest mass, not evenly scattered lollipops?', 'Is there still legible empty space?', 'Is the route findable without painting a path?']
  },
  clearing: {
    key: 'clearing', label: '02 Khoảng trống / Clearing',
    shotTile: [1408, 1332],
    intent: 'one deliberately designed elliptical opening carved out of stands: sparse interior, dense rim, readable silhouette against the canopy wall',
    reviewQuestions: ['Is the opening actually readable at 640x360 1x?', 'Does the rim look like a natural edge?', 'Too empty or correctly empty?']
  },
  road_forest_edge: {
    key: 'road_forest_edge', label: '03 Rìa đường / Road–forest edge',
    shotTile: [1452, 1316],
    intent: 'forest stands stop at a 3-tile object-free buffer from the authored GOLD road; no object on any road/bridge tile; open traversable corridor stays legible',
    reviewQuestions: ['Is the road corridor unmistakably open?', 'Does the stand edge feel abrupt or natural?', 'Any object covering the road?']
  }
};
export const COMPOSITION_ORDER: CompositionKey[] = ['dense_interior', 'clearing', 'road_forest_edge'];

export const SPECIES = {
  oak:          [['oak', 0.80], ['pine', 0.10], ['dead', 0.05], ['willow', 0.05]],
  oak_pine:     [['oak', 0.56], ['pine', 0.36], ['dead', 0.05], ['willow', 0.03]],
  pine_oak:     [['pine', 0.60], ['oak', 0.32], ['dead', 0.08]],
  willow_oak:   [['willow', 0.44], ['oak', 0.44], ['pine', 0.08], ['dead', 0.04]],
  ancient_oak:  [['oak', 0.60], ['willow', 0.18], ['pine', 0.12], ['dead', 0.10]]
} as Record<string, [NatureKind, number][]>;

/** Explicit coherent stands — NOT a per-tile random scatter. Species is decided
 *  per STAND, so a stand reads as one ecological unit. */
export const STANDS: Stand[] = [
  { id: 'S01', c: [1404, 1308], r: [12, 9],  species: 'oak',         note: 'north-west oak stand beside the lake' },
  { id: 'S02', c: [1422, 1312], r: [11, 8],  species: 'oak_pine',    note: 'mixed stand, pine admixture' },
  { id: 'S03', c: [1402, 1324], r: [13, 10], species: 'oak',         note: 'main interior stand, carved by clearing C1' },
  { id: 'S04', c: [1424, 1338], r: [12, 9],  species: 'pine_oak',    note: 'pine-dominant south stand' },
  { id: 'S05', c: [1398, 1346], r: [9, 7],   species: 'oak',         note: 'south-west regrowth stand' },
  { id: 'S06', c: [1438, 1306], r: [9, 7],   species: 'willow_oak',  note: 'wet edge near the lake; willow admixture' },
  { id: 'S07', c: [1438, 1344], r: [13, 9],  species: 'ancient_oak', note: 'ancient stand west of the road' },
  { id: 'S08', c: [1468, 1346], r: [12, 8],  species: 'ancient_oak', note: 'ancient stand east of the road' },
  { id: 'S09', c: [1478, 1310], r: [8, 7],   species: 'ancient_oak', note: 'north-east ancient stand' },
  { id: 'S10', c: [1418, 1348], r: [9, 6],   species: 'oak',         note: 'south connector stand' },
  { id: 'S11', c: [1448, 1310], r: [10, 8],  species: 'oak_pine',    note: 'road-side stand north-west of the authored road; stops at the 3-tile buffer' },
  { id: 'S12', c: [1444, 1324], r: [10, 9],  species: 'ancient_oak', note: 'road-side stand west of the road; dense wall behind the open corridor' },
  { id: 'S13', c: [1430, 1324], r: [10, 7],  species: 'oak',         note: 'interior connector closing the gap between the glade and the road stands' }
];

/** Deliberate openings. C1 is the reviewed clearing; C2/C3 are natural gaps. */
export const CLEARINGS: Opening[] = [
  { id: 'C1', c: [1408, 1332], r: [12, 8], note: 'REVIEWED CLEARING — sparse floor, dense rim, trail heads here' },
  { id: 'C2', c: [1428, 1306], r: [8, 5],  note: 'small natural gap near the lake shore' },
  { id: 'C3', c: [1464, 1340], r: [9, 6],  note: 'natural gap in the ancient stands' }
];

/**
 * Deliberate routes are OBJECT-FREE CORRIDORS ONLY (1-tile half-width = a 3-tile
 * corridor, narrow enough to keep forest mass on both sides). No path/road/ground pixel is
 * painted, no GOLD geometry is authored, and no Gameplay navigation permission
 * is minted. The corridor simply has zero decorative objects, so the untouched
 * GOLD terrain stays visible and the existing collision authority is unchanged.
 */
export const ROUTES: Route[] = [
  { id: 'TRAIL_TO_ROAD', width: 1, points: [[1408, 1332], [1422, 1326], [1436, 1320], [1452, 1316]], note: 'clearing -> authored GOLD road' },
  { id: 'TRAIL_TO_LAKE', width: 1, points: [[1408, 1332], [1400, 1318], [1412, 1306], [1422, 1302]], note: 'clearing -> lake shore' },
  { id: 'ANCIENT_TRACK', width: 1, points: [[1464, 1340], [1456, 1330], [1452, 1316]], note: 'ancient gap -> road' }
];

/** Zone densities. `core` deliberately permits overlapping 24px canopies on
 *  16px tiles; sprites are NEVER scaled. */
export interface ZoneRule { tree: number; under: number; note: string }
export const ZONE_RULES: Record<string, ZoneRule> = {
  core:              { tree: 0.66, under: 0.14, note: 'overlapping native canopies, thicket/gap modulation' },
  edge:              { tree: 0.30, under: 0.42, note: 'dense mantle: floor tufts + rocks + occasional snag' },
  exterior:          { tree: 0.015, under: 0.09, note: 'natural empty ground, sparse tufts' },
  clearing_rim:      { tree: 0.06, under: 0.50, note: 'dense but low rim framing the opening' },
  clearing_interior: { tree: 0.00, under: 0.10, note: 'readable open floor, a few tufts/rocks' }
};

/** Minimal palette. `bush`/`bush_empty`/`herb`/`mush`/`reed` are EXCLUDED: in
 *  live Gameplay those exact sprites encode stocked / depleted harvest states. */
export const FOREST_PALETTE: NatureKind[] = ['oak', 'pine', 'willow', 'dead', 'rock', 'grass'];
export const UNDERGROWTH: [NatureKind, number][] = [['grass', 0.68], ['rock', 0.24], ['dead', 0.08]];

/* ------------------------------------------------------------------ *
 * EXACT OWNER DEPENDENCY — recorded, not resolved by Map.
 * ------------------------------------------------------------------ */
export const OWNER_DEPENDENCY = {
  branch: 'arena/d4bfcfff-soul-of-hero',
  verifiedHead: '5b3e683402bbc8540dea9404576164097e753f97',
  observedLaterHead: '2f0836587b76a4a98fffedf8c202fb37cbb2a67c',
  mapCannotChange: true,
  conflicts: [
    { file: 'web/src/game/catalog.ts', line: 143, symbol: 'SOURCES.oak', fact: "art:'oak', stock:6, yields:[['wood',1]], block:true -> a visually identical oak is SOLID and HARVESTABLE in live Gameplay" },
    { file: 'web/src/game/catalog.ts', line: 149, symbol: 'SOURCES.rock', fact: "art:'rock', stock:6, block:true -> a visually identical rock is SOLID and HARVESTABLE" },
    { file: 'web/src/game/catalog.ts', line: 156, symbol: 'SOURCES.grass', fact: "art:'grass', stock:2, yields:[['fiber',1]], regrow:300 -> visually identical grass is a harvestable source" },
    { file: 'web/src/game/render.ts', line: 212, symbol: 'render.ts sourceAt draw list', fact: "y = ty*16+14; the Gameplay source renderer draws A.src[art], depleted forms A.src.stump / A.src.rubble / A.src.picked" },
    { file: 'web/src/game/render.ts', line: 215, symbol: 'r.natureTrees', fact: "DRAWS THE SAME A.src.oak at x-4,y-16,y+14 for Gameplay grove trees, NOT decoration" },
    { file: 'web/src/game/sim.ts', line: 199, symbol: 'stepNatureTrees', fact: "grove trees spawn wood drops and receipts ('core.grove.wood') when mature -> they HAVE rewards" },
    { file: 'web/src/game/engine.ts', line: 189, symbol: 'blockGrid()', fact: "for (const tree of r.natureTrees||[]) arr[...] = 2 -> grove trees are SOLID COLLISION" },
    { file: 'web/src/game/engine.ts', line: 156, symbol: 'engine.ts sourceAt owner', fact: 'owner of stock/hp/regrow/burnt state and source layout version' }
  ],
  decisionRequiredFromGameplay: 'Designate, in Gameplay-owned data, which oak/pine/rock/grass instances are harvestable and which are purely visual; OR ship a distinct non-harvestable forest asset set. Map must not invent rewards, collision, stock, depletion or source ownership.',
  pilotStatus: 'NOT_APPROVED_FOR_PRODUCTION',
  pilotGuarantee: 'NATURE-02 objects have NO interaction, NO collision, NO reward, NO stock, NO depletion and NO owner; they never occupy a GOLD sourceTile. Therefore no contradictory interaction exists INSIDE this pilot, but production approval is blocked until the Gameplay owner resolves the identical-sprite conflict.'
};

/** PROPOSAL ONLY — nothing here is created, imported or drawn. */
export const ASSET_GAP_SPEC = {
  id: 'N02-ASSET-GAP-01',
  status: 'PROPOSED__NOT_CREATED__NOT_APPROVED',
  exactGap: 'There is NO dedicated non-harvestable forest art. Every tree, shrub and ground sprite in getArt().src is bound to a SOURCES definition with stock/yields/block, and live Gameplay reuses A.src.oak for grove trees that are solid and yield wood. Existing 24x32 trees are only 1.333x the 16x24 hero height, so they cannot form an overhead canopy; there is no mid-storey or non-harvestable undergrowth layer.',
  owner: 'Gameplay art + Gameplay semantic registry (NOT Map)',
  proposedAssets: [
    { key: 'forest_canopy_oak', sizePx: [24, 40], variants: 3, note: 'NEW asset, NOT an enlargement of S.oak; two irregular crown tiers + visible trunk; still native 1x pixel grid, outline #140c14' },
    { key: 'forest_fern', sizePx: [16, 16], variants: 3, note: 'non-harvestable undergrowth; NO berries, NO flowers, NO picked/depleted state' },
    { key: 'forest_snag', sizePx: [24, 32], variants: 2, note: 'standing deadwood without the charcoal/orange-ember reward cue of S.dead' }
  ],
  registrationConstraint: 'MUST NOT be added to SOURCES, sourceAt(), yields, stock, regrow, blockGrid() or any loot/receipt path.',
  cameraConstraint: 'U=0.5, 640x360 @1x, hero 16x24 unchanged; no sprite scaling, no camera zoom.',
  note: 'This is a specification for Control Tower review, NOT a substitute asset and NOT a claim that the gap is solved.'
};

export const FOREST_ASSET_INVENTORY = {
  sourceFile: 'creator-u05/web-u05/src/game/art.ts (vendored verbatim from b5c8004c:web/src/game/art.ts)',
  used: [
    { kind: 'oak', size: [24, 32], variants: 3, role: 'canopy tree', risk: 'IDENTICAL to SOURCES.oak (solid, harvestable, wood)' },
    { kind: 'pine', size: [24, 32], variants: 2, role: 'canopy tree / stand admixture', risk: 'IDENTICAL to SOURCES.pine' },
    { kind: 'willow', size: [24, 32], variants: 2, role: 'wet-edge tree', risk: 'IDENTICAL to SOURCES.willow' },
    { kind: 'dead', size: [24, 32], variants: 2, role: 'snag', risk: 'IDENTICAL to SOURCES.deadtree' },
    { kind: 'rock', size: [16, 16], variants: 3, role: 'edge mantle', risk: 'IDENTICAL to SOURCES.rock (solid, harvestable)' },
    { kind: 'grass', size: [16, 16], variants: 3, role: 'forest floor', risk: 'IDENTICAL to SOURCES.grass (harvestable fiber)' }
  ],
  deliberatelyExcluded: [
    'src.bush / src.bush_empty (stocked vs DEPLETED Berry Bush states)',
    'src.herb / src.mush / src.reed (harvestable plant sources)',
    'src.picked / src.stump / src.rubble (harvest depletion states)',
    'src.iron / src.coal / src.sulfur / src.crystal (ore sources)',
    'src.scrap / src.wreck / src.palm (artificial props / unrelated biome)'
  ],
  newArtAssets: 0, newAtlases: 0, spriteScaling: false,
  decorativeOnly: true, gameplayOwned: false,
  productionApproved: false
};
