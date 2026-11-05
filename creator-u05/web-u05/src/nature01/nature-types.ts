/** Sprite keys used by NATURE-01. All are pre-existing `getArt().src` arrays. */
export type NatureKind =
  | 'oak' | 'pine' | 'snowpine' | 'willow' | 'dead' | 'rock'
  | 'bush' | 'bush_empty' | 'grass' | 'reed' | 'herb' | 'mush';

/** A decorative natural object. NOT a Gameplay entity, NOT a resource node. */
export interface NatureObject {
  tx: number; ty: number;
  /** World pixel position of the tile origin. */
  wx: number; wy: number;
  /** Sprite offset from tile origin, matching the live Gameplay painter. */
  dx: number; dy: number;
  w: number; h: number;
  /** Depth-sort key: tile baseline + 14, exactly as live renderChunk does. */
  y: number;
  kind: NatureKind;
  variant: number;
  site: string;
  biome: string;
  /** Always true. Kept explicit so QA can assert no fabricated mechanics. */
  decorativeOnly: true;
  /** Always false. */
  gameplayOwned: false;
}
