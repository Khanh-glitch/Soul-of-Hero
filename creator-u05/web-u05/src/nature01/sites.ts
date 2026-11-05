/**
 * NATURE-01 — FIVE BOUNDED PILOT SITES (not a whole-world system).
 *
 * These are real GOLD / WMP-04R1 tile windows, chosen by scanning the actual
 * 0.5 AU-per-tile sampling of the active map (see evidence/nature01-sites.json).
 * Nothing here reauthors geography: no polygon, road, river, lake, shoreline or
 * biome-raster byte is written. The nature layer ONLY reads `sampleTile()`.
 *
 * IMPORTANT SCOPE: nature objects are generated ONLY inside these five windows.
 * Every other tile in the 4000x2800 frame has zero nature objects. This is a
 * five-biome PILOT, deliberately NOT full-world propagation.
 */
import type { NatureKind } from './nature-types';

export type SiteKey = 'temperate_forest' | 'snow_forest' | 'marsh' | 'dry' | 'rocky_highlands';

export interface SiteSpec {
  key: SiteKey;
  label: string;
  /** Native 1x camera centre of the bounded pilot window, in 0.5 AU tiles. */
  centreTile: [number, number];
  /** Representative native 1x shot position INSIDE the window (same for OFF/ON). */
  shotTile: [number, number];
  /** What the OFF/ON pair is framed to show. */
  shotFocus: string;
  /** Inclusive-exclusive tile bounds [x0, y0, x1, y1]. */
  boundsTile: [number, number, number, number];
  /** GOLD biome names expected in this window (authority, never asserted by us). */
  expectedBiomes: string[];
  /** What this sample is supposed to demonstrate; NOT an acceptance claim. */
  demonstrates: string;
  /** Placement-rule family applied to the window. */
  ruleSet: string;
  /** Deterministic seed offset for the clearing / clustering fields. */
  seed: number;
}

export const PILOT_HALF_W = 48; // 96 tiles wide  = 1536 px
export const PILOT_HALF_H = 32; // 64 tiles high = 1024 px
export const PILOT_CHUNK = 32;  // same geometry chunk as the terrain viewer
export const MAX_RESIDENT_NATURE_CHUNKS = 36;
export const ROAD_BUFFER_TILES = 2;
export const TREE_WATER_BUFFER_TILES = 2;

function bounds(cx: number, cy: number): [number, number, number, number] {
  return [cx - PILOT_HALF_W, cy - PILOT_HALF_H, cx + PILOT_HALF_W, cy + PILOT_HALF_H];
}

export const SITES: Record<SiteKey, SiteSpec> = {
  temperate_forest: {
    key: 'temperate_forest', label: '01 Rừng ôn đới / Temperate forest',
    centreTile: [1440, 1320], shotTile: [1472, 1336], boundsTile: bounds(1440, 1320),
    shotFocus: 'ancient/forest stand beside a GOLD road corridor (2-tile object-free buffer)',
    expectedBiomes: ['forest', 'ancient', 'meadow'],
    demonstrates: 'oak / pine trees, undergrowth, scattered rocks, noise-driven clearings, road kept open',
    ruleSet: 'TEMPERATE_FOREST', seed: 0x4e413101
  },
  snow_forest: {
    key: 'snow_forest', label: '02 Rừng tuyết / Snow forest',
    centreTile: [1360, 840], shotTile: [1360, 840], boundsTile: bounds(1360, 840),
    shotFocus: 'snow-pine field with a conifer/snow transition, exposed rocks and a legible lake shore',
    expectedBiomes: ['snow', 'conifer', 'rock'],
    demonstrates: 'snow pines on snow, green pines on conifer, exposed rock, snow/conifer transition, lake shore left legible',
    ruleSet: 'SNOW_FOREST', seed: 0x4e413102
  },
  marsh: {
    key: 'marsh', label: '03 Đầm lầy / Marsh',
    centreTile: [2160, 840], shotTile: [2152, 828], boundsTile: bounds(2160, 840),
    shotFocus: 'lake shore with a reed fringe, willow behind it and visible wet marsh ground',
    expectedBiomes: ['marsh', 'forest'],
    demonstrates: 'reeds exactly on the land side of a water edge, willow behind them, wet ground left visible',
    ruleSet: 'MARSH', seed: 0x4e413103
  },
  dry: {
    key: 'dry', label: '04 Vùng khô / Dry region',
    centreTile: [2640, 1320], shotTile: [2640, 1320], boundsTile: bounds(2640, 1320),
    shotFocus: 'very sparse scrub and rock formations on a large open dry floor',
    expectedBiomes: ['scrub_dry_steppe', 'desert', 'beach'],
    demonstrates: 'sparse dead scrub and rock formations with a deliberately large open-ground floor',
    ruleSet: 'DRY', seed: 0x4e413104
  },
  rocky_highlands: {
    key: 'rocky_highlands', label: '05 Cao nguyên đá / Rocky highlands',
    centreTile: [1100, 1200], shotTile: [1100, 1200], boundsTile: bounds(1100, 1200),
    shotFocus: 'rock clusters, conifer/rock transition and an open traversable road corridor',
    expectedBiomes: ['rock', 'conifer', 'meadow'],
    demonstrates: 'low-frequency rock clusters, y-sorted depth, conifer/rock transition, visible traversable road corridor',
    ruleSet: 'ROCKY_HIGHLANDS', seed: 0x4e413105
  }
};

export const SITE_ORDER: SiteKey[] = ['temperate_forest', 'snow_forest', 'marsh', 'dry', 'rocky_highlands'];

export function siteAt(tx: number, ty: number): SiteKey | null {
  for (const k of SITE_ORDER) {
    const [x0, y0, x1, y1] = SITES[k].boundsTile;
    if (tx >= x0 && tx < x1 && ty >= y0 && ty < y1) return k;
  }
  return null;
}

export function siteWorldPx(key: SiteKey): [number, number] {
  const [cx, cy] = SITES[key].centreTile;
  return [cx * 16 + 8, cy * 16 + 12];
}

/* ------------------------------------------------------------------ *
 * PLACEMENT RULES — deterministic, biome-aware, NOT generic scatter.
 * ------------------------------------------------------------------ */

export interface Weighted { kind: NatureKind; w: number }
export interface BiomeRule {
  /** Tall / volume objects on a jittered 3x3-tile lattice. */
  big: Weighted[];
  /** Ground-cover objects on a jittered 2x2-tile lattice. */
  small: Weighted[];
  bigChance: number;
  smallChance: number;
  /** fbm < floor => NO tall object (creates a clearing). */
  clearingFloor?: number;
  /** fbm > ceiling => NO tall object (creates an open gap). */
  openGapCeiling?: number;
  /** fbm >= floor required for tall objects (creates rock clusters). */
  clusterFloor?: number;
  /** Minimum Chebyshev distance from water for a tall object. */
  bigWaterMin?: number;
  /** Maximum Chebyshev distance from water for a tall object (willow band). */
  bigWaterMax?: number;
  /** Draw reeds / grass on land tiles exactly adjacent to water. */
  waterEdgeGround?: boolean;
  /** fbm >= floor turns a rock into a small NATURAL FORMATION (2-4 adjacent rocks). */
  formationFloor?: number;
  /** Minimum open-ground fraction this rule is designed to keep (QA measured). */
  designedOpenGroundFloor: number;
}

const W = (kind: NatureKind, w: number): Weighted => ({ kind, w });

export const BIOME_RULES: Record<string, BiomeRule> = {
  forest: {
    big: [W('oak', 0.72), W('pine', 0.16), W('rock', 0.08), W('willow', 0.04)],
    small: [W('bush', 0.22), W('bush_empty', 0.20), W('grass', 0.40), W('mush', 0.10), W('herb', 0.08)],
    bigChance: 0.86, smallChance: 0.46, clearingFloor: 0.43, bigWaterMin: 2,
    designedOpenGroundFloor: 0.72
  },
  ancient: {
    big: [W('oak', 0.58), W('willow', 0.22), W('rock', 0.12), W('pine', 0.08)],
    small: [W('bush', 0.18), W('grass', 0.38), W('mush', 0.20), W('herb', 0.14), W('bush_empty', 0.10)],
    bigChance: 0.78, smallChance: 0.50, clearingFloor: 0.40, bigWaterMin: 2,
    designedOpenGroundFloor: 0.72
  },
  meadow: {
    big: [W('oak', 0.32), W('rock', 0.18), W('bush', 0.34), W('willow', 0.16)],
    small: [W('grass', 0.64), W('bush_empty', 0.20), W('herb', 0.10), W('mush', 0.06)],
    bigChance: 0.42, smallChance: 0.52, clearingFloor: 0.30, bigWaterMin: 2,
    designedOpenGroundFloor: 0.78
  },
  snow: {
    big: [W('snowpine', 0.66), W('rock', 0.24), W('dead', 0.10)],
    small: [W('bush_empty', 0.42), W('grass', 0.24), W('rock', 0.34)],
    bigChance: 0.66, smallChance: 0.20, clearingFloor: 0.30,
    formationFloor: 0.66, bigWaterMin: 2, designedOpenGroundFloor: 0.82
  },
  conifer: {
    big: [W('pine', 0.58), W('snowpine', 0.20), W('rock', 0.14), W('dead', 0.08)],
    small: [W('bush_empty', 0.36), W('grass', 0.34), W('rock', 0.30)],
    bigChance: 0.68, smallChance: 0.22, clearingFloor: 0.30, bigWaterMin: 2,
    designedOpenGroundFloor: 0.80
  },
  marsh: {
    // Reeds are a SHORELINE BAND, not general ground cover; the marsh interior
    // keeps wet ground, grass, caps and berry-less scrub. Willow sits behind reeds.
    big: [W('willow', 0.58), W('oak', 0.24), W('rock', 0.18)],
    small: [W('grass', 0.52), W('bush_empty', 0.34), W('mush', 0.06), W('herb', 0.08)],
    bigChance: 0.54, smallChance: 0.44, clearingFloor: 0.28, bigWaterMin: 2, bigWaterMax: 6,
    waterEdgeGround: true, designedOpenGroundFloor: 0.72
  },
  desert: {
    big: [W('dead', 0.40), W('rock', 0.46), W('bush_empty', 0.14)],
    small: [W('grass', 0.52), W('bush_empty', 0.32), W('rock', 0.16)],
    bigChance: 0.26, smallChance: 0.18, openGapCeiling: 0.62, clusterFloor: 0.44,
    formationFloor: 0.50, bigWaterMin: 2, designedOpenGroundFloor: 0.88
  },
  scrub_dry_steppe: {
    big: [W('dead', 0.38), W('rock', 0.46), W('bush_empty', 0.16)],
    small: [W('grass', 0.56), W('bush_empty', 0.30), W('rock', 0.14)],
    bigChance: 0.24, smallChance: 0.16, openGapCeiling: 0.62, clusterFloor: 0.44,
    formationFloor: 0.50, bigWaterMin: 2, designedOpenGroundFloor: 0.90
  },
  beach: {
    big: [W('rock', 0.60), W('bush_empty', 0.40)],
    small: [W('grass', 0.60), W('reed', 0.40)],
    bigChance: 0.18, smallChance: 0.14, openGapCeiling: 0.60,
    bigWaterMin: 2, waterEdgeGround: true, designedOpenGroundFloor: 0.92
  },
  rock: {
    big: [W('rock', 0.80), W('dead', 0.10), W('pine', 0.10)],
    small: [W('rock', 0.62), W('grass', 0.24), W('bush_empty', 0.14)],
    bigChance: 0.62, smallChance: 0.16, clusterFloor: 0.47, clearingFloor: 0.22,
    formationFloor: 0.60, bigWaterMin: 2, designedOpenGroundFloor: 0.82
  },
  volcanic: {
    big: [W('rock', 0.72), W('dead', 0.28)],
    small: [W('rock', 0.72), W('bush_empty', 0.28)],
    bigChance: 0.50, smallChance: 0.12, clusterFloor: 0.50,
    formationFloor: 0.62, bigWaterMin: 2, designedOpenGroundFloor: 0.86
  },
  toxic: {
    big: [W('dead', 0.56), W('rock', 0.44)],
    small: [W('bush_empty', 0.60), W('grass', 0.40)],
    bigChance: 0.36, smallChance: 0.14, bigWaterMin: 2,
    designedOpenGroundFloor: 0.86
  }
};

/** Every sprite used here is an EXISTING `getArt().src` entry. No new art. */
export const NATURE_ASSET_INVENTORY: {
  used: { kind: NatureKind; spriteArray: string; sizePx: [number, number]; variants: number; decorativeOnly: true; gameplayOwned: false }[];
  excludedGameplayOwned: string[];
  excludedArtificial: string[];
  sourceFile: string;
  note: string;
} = {
  used: [
    { kind: 'oak',        spriteArray: 'src.oak',        sizePx: [24, 32], variants: 3, decorativeOnly: true, gameplayOwned: false },
    { kind: 'pine',       spriteArray: 'src.pine',       sizePx: [24, 32], variants: 2, decorativeOnly: true, gameplayOwned: false },
    { kind: 'snowpine',   spriteArray: 'src.snowpine',   sizePx: [24, 32], variants: 2, decorativeOnly: true, gameplayOwned: false },
    { kind: 'willow',     spriteArray: 'src.willow',     sizePx: [24, 32], variants: 2, decorativeOnly: true, gameplayOwned: false },
    { kind: 'dead',       spriteArray: 'src.dead',       sizePx: [24, 32], variants: 2, decorativeOnly: true, gameplayOwned: false },
    { kind: 'rock',       spriteArray: 'src.rock',       sizePx: [16, 16], variants: 3, decorativeOnly: true, gameplayOwned: false },
    { kind: 'bush',       spriteArray: 'src.bush',       sizePx: [16, 16], variants: 2, decorativeOnly: true, gameplayOwned: false },
    { kind: 'bush_empty', spriteArray: 'src.bush_empty', sizePx: [16, 16], variants: 2, decorativeOnly: true, gameplayOwned: false },
    { kind: 'grass',      spriteArray: 'src.grass',      sizePx: [16, 16], variants: 3, decorativeOnly: true, gameplayOwned: false },
    { kind: 'reed',       spriteArray: 'src.reed',       sizePx: [16, 16], variants: 2, decorativeOnly: true, gameplayOwned: false },
    { kind: 'herb',       spriteArray: 'src.herb',       sizePx: [16, 16], variants: 1, decorativeOnly: true, gameplayOwned: false },
    { kind: 'mush',       spriteArray: 'src.mush',       sizePx: [16, 16], variants: 1, decorativeOnly: true, gameplayOwned: false }
  ],
  excludedGameplayOwned: ['src.iron', 'src.coal', 'src.sulfur', 'src.crystal', 'src.stump', 'src.rubble', 'src.picked'],
  excludedArtificial: ['src.scrap', 'src.wreck', 'src.palm (unused: no oasis in these five windows)'],
  sourceFile: 'creator-u05/web-u05/src/game/art.ts (vendored verbatim from b5c8004c:web/src/game/art.ts, unchanged at 5b3e683)',
  note: 'getArt().src also contains the live Gameplay harvestable-source sprites. NATURE-01 deliberately does NOT use the Gameplay resource sprites and does NOT consult sourceAt()/stock/depletion/ownership. Nature objects have no interaction, no reward, no depletion, no collision and no owner.'
};
