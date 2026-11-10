/** WMP-04R1 browser geography reader. Static Map data ONLY; no Gameplay authority.
 *  The generated module was produced at build time from pinned Map bytes because
 *  a browser cannot import node:fs. Every raster is SHA-256 verified on decode. */
import {
  WMP04R1_META, WMP04R1_SCENES, WMP04R1_ALL, WMP04R1_LAYOUT_IDS,
  wmp04Raster, wmp04SceneForLayout, wmp04CellIndex, verifyWmp04R1,
  type Wmp04Scene,
} from './wmp04r1.generated';

export { WMP04R1_META, WMP04R1_SCENES, WMP04R1_ALL, WMP04R1_LAYOUT_IDS, wmp04SceneForLayout, wmp04CellIndex, wmp04Raster, verifyWmp04R1 };
export type { Wmp04Scene };

export interface Wmp04TileGeography {
  cellIndex: number;
  atAu: [number, number];
  analysisCellAu: 8;
  unitsPerTile: 2;
  effectiveBiomeCode: number;
  effectiveBiome: string;
  sourceBiomeCode: number;
  coldTransitionCode: number;
  coldTransition: string;
  marineRegionCode: number;
  marineRegionId: string | null;
  cliffCandidate: number;
  heightClass: number;
  waterClass: number;
  isBefore: boolean;
}

let verified: ReturnType<typeof verifyWmp04R1> | null = null;
export function assertWmp04Integrity() {
  if (!verified) verified = verifyWmp04R1();
  if (!verified.ok || verified.revision !== 'WMP-04R1') throw new Error('WMP04R1_BROWSER_INTEGRITY_FAIL');
  return verified;
}

const R = () => ({
  biomeEffective: wmp04Raster('biomeEffective'), coldTransition: wmp04Raster('coldTransition'),
  marineRegion: wmp04Raster('marineRegion'), cliffCandidate: wmp04Raster('cliffCandidate'),
  heightClass: wmp04Raster('heightClass'), waterClass: wmp04Raster('waterClass'),
  sourceBiomeCode: wmp04Raster('sourceBiomeCode'),
});

/** Sample the 8 AU analytical cell that contains a U=2 gameplay tile centre.
 *  The 8 AU cell is an ANALYSIS cell; the 16px/U=2 tile is a DIAGNOSTIC VIEW.
 *  They are deliberately not conflated and no world scale is approved here. */
export function geographyAtTile(scene: Wmp04Scene, tileX: number, tileY: number): Wmp04TileGeography | null {
  if (!scene.originAu || !scene.unitsPerTile) return null;
  const atAu: [number, number] = [scene.originAu[0] + (tileX + .5) * scene.unitsPerTile, scene.originAu[1] + (tileY + .5) * scene.unitsPerTile];
  const ci = wmp04CellIndex(atAu);
  if (ci === null) return null;
  const r = R(), names = WMP04R1_META.biomeCodes, cold = WMP04R1_META.coldCodes, marine = WMP04R1_META.marineCodes;
  const effectiveBiomeCode = scene.isBefore ? r.sourceBiomeCode[ci] : r.biomeEffective[ci];
  return {
    cellIndex: ci, atAu, analysisCellAu: 8, unitsPerTile: 2,
    effectiveBiomeCode, effectiveBiome: names[effectiveBiomeCode] ?? `code${effectiveBiomeCode}`,
    sourceBiomeCode: r.sourceBiomeCode[ci],
    coldTransitionCode: r.coldTransition[ci], coldTransition: cold[r.coldTransition[ci]] ?? 'unknown',
    marineRegionCode: r.marineRegion[ci], marineRegionId: r.marineRegion[ci] ? marine[r.marineRegion[ci]] : null,
    cliffCandidate: r.cliffCandidate[ci], heightClass: r.heightClass[ci],
    waterClass: r.waterClass[ci], isBefore: !!scene.isBefore,
  };
}

/** Fast scene selector entries. Scene 1 targets the ORIGINAL untouched layout. */
export const WMP04_PILOT_SCENES = WMP04R1_SCENES.map(s => ({
  id: s.id,
  layoutId: s.layoutId ?? s.id,
  title: s.title,
  short: s.short,
  description: s.description,
  viewAnchorTile: s.viewAnchorTile ?? null,
  beforeLayoutId: s.beforeId,
  marineRegion: s.marineRegion,
  landmark: s.landmark,
}));
