/** Bounded, immutable diagnostic view of the pinned full authoring frame.
 *  WMP-04R1 PILOT EXTENSION (additive):
 *   - the active WMP-04R1 effective biome / cold-transition / marine-region
 *     rasters are read through the browser-compatible build-time adapter;
 *   - coastlines, lakes, rivers, roads, POI footprints and LR02 static solids
 *     are STILL evaluated from the authored GOLD polygons / centrelines at tile
 *     centres. Nothing is replaced by low-resolution raster squares;
 *   - 8 AU analytical cells remain distinct from 2 AU diagnostic view tiles;
 *   - U=2 is DIAGNOSTIC, not an approved AU→tile world scale.
 *  No gameplay permission is derived from road/cargo/buildable semantics. */
import raw from '../../../geography/veyra-lr01/world_lab/lr01/output/geography_package.v1.json?raw';
import canonRaw from '../../../geography/veyra-lr01/map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json?raw';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { BODY_SHA, CANON_SHA, PACKAGE_CANONICAL_SHA, MAP_SOURCE_SHA, expandRle, type GeographyStage1 } from './intake';
import { T, TILE, WW, WH } from '../core';
import { compileEconomy, type Biome, type EconomyMap } from '../world-economy';
import type { World, Place } from '../world';
import { greywaterPatch, PATCH_BODY_SHA, PATCH_SOURCE_SHA } from './lr02';
import { eligibleRegions, ELIGIBILITY_BODY_SHA, ELIGIBILITY_SOURCE_SHA } from './eligibility';
import {
  WMP04R1_META, WMP04R1_LAYOUT_IDS, wmp04SceneForLayout, wmp04Raster,
  assertWmp04Integrity, type Wmp04Scene,
} from './wmp04r1';

export interface VeyraViewIdentity {
  sourceCommit: string; sourceDigest: string; originAu: [number, number];
  unitsPerTile: 0.5 | 1.6 | 2; frameAu: [number, number]; projection: 'cell-centre-v1'; // VEYRA05: 0.5 added additively (U=0.5 windows); 1.6|2 views unchanged
  patchSourceCommit?: string; patchDigest?: string;
  // WMP-04R1 extension. All fields are pure static geography metadata.
  worldRevision?: string; sceneId?: string; beforeLayoutId?: string | null;
  analysisCellAu?: 8; unitsPerTileDiagnostic?: 2; geometrySource?: string;
  biomeSource?: string; activeRevisionDigest?: string;
}
export const VEYRA_LAYOUTS = [
  'veyra-greywater-u16', 'veyra-greywater-u20', 'veyra-greywater-lr02-u16',
  'veyra-greywater-lr02-u20', 'veyra-oasis-u20', 'veyra-oasis-lr02-u20',
  ...WMP04R1_LAYOUT_IDS,
] as const;
const p = JSON.parse(raw) as GeographyStage1;
const canon = JSON.parse(canonRaw) as { project: { pois: { id: string; name: string; at: number[]; foot: number[][] }[]; land: { rings: number[][][] }[]; lakes: { ring: number[][] }[]; rivers: { points: number[][] }[]; roads: { points: number[][]; kind: string }[] } };
const hash = (s: string) => bytesToHex(sha256(s));
function verifyEmbedded() {
  if (p.schema !== 'soh.map.lr01.geography_package.v1' || p.revision !== 1 || p.revisionDigest !== BODY_SHA || hash(JSON.stringify(p.body)) !== BODY_SHA || hash(JSON.stringify(p)) !== PACKAGE_CANONICAL_SHA || hash(canonRaw) !== CANON_SHA)
    throw Error('Veyra geography source failed integrity checks');
}
const contains = (x: number, y: number, poly: number[][]) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
// The LR01 raster is 8-au analysis data. For water/road edges, evaluate the
// source polygons/centrelines at tile centres. 9 au is the MapLab analytical
// stroke, not an approved physical road/channel width or bridge clearance.
function lines(points: number[][], radius: number) { return points.slice(1).map((b, i) => { const a = points[i]; return { a, b, radius, minx: Math.min(a[0], b[0]) - radius, maxx: Math.max(a[0], b[0]) + radius, miny: Math.min(a[1], b[1]) - radius, maxy: Math.max(a[1], b[1]) + radius }; }); }
function onLine(x: number, y: number, s: { a: number[]; b: number[]; radius: number; minx: number; maxx: number; miny: number; maxy: number }) { if (x < s.minx || x > s.maxx || y < s.miny || y > s.maxy) return false; const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], d = dx * dx + dy * dy, t = d ? Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (y - s.a[1]) * dy) / d)) : 0; return Math.hypot(x - s.a[0] - t * dx, y - s.a[1] - t * dy) <= s.radius; }
export function globalFromTile(identity: VeyraViewIdentity, x: number, y: number): [number, number] { return [identity.originAu[0] + (x + .5) * identity.unitsPerTile, identity.originAu[1] + (y + .5) * identity.unitsPerTile]; }
export function tileFromGlobal(identity: VeyraViewIdentity, x: number, y: number): [number, number] { return [Math.floor((x - identity.originAu[0]) / identity.unitsPerTile), Math.floor((y - identity.originAu[1]) / identity.unitsPerTile)]; }

export function projectVeyra(layout: string): World {
  verifyEmbedded();
  const wscene: Wmp04Scene | undefined = wmp04SceneForLayout(layout);
  if (wscene) {
    const v = assertWmp04Integrity();
    if (!v.ok) throw Error('WMP04R1 browser raster integrity failed');
  }
  const oasis = layout === 'veyra-oasis-u20' || layout === 'veyra-oasis-lr02-u20', oasisM2 = layout === 'veyra-oasis-lr02-u20';
  const lr02 = layout === 'veyra-greywater-lr02-u16' || layout === 'veyra-greywater-lr02-u20';
  const legacyUnits = layout === 'veyra-greywater-u16' || layout === 'veyra-greywater-lr02-u16' ? 1.6 : layout === 'veyra-greywater-u20' || layout === 'veyra-greywater-lr02-u20' || oasis ? 2 : null;
  const unitsPerTile: 1.6 | 2 | null = wscene?.unitsPerTile ?? legacyUnits;
  if (!unitsPerTile) throw Error(`Unknown Veyra view ${layout}`);
  const originAu: [number, number] = wscene?.originAu ?? (oasis ? [400, 840] : [640, 440]);
  const identity: VeyraViewIdentity = {
    sourceCommit: MAP_SOURCE_SHA, sourceDigest: BODY_SHA, originAu, unitsPerTile,
    frameAu: [2000, 1400], projection: 'cell-centre-v1',
    ...(lr02 ? { patchSourceCommit: PATCH_SOURCE_SHA, patchDigest: PATCH_BODY_SHA } : oasisM2 ? { patchSourceCommit: ELIGIBILITY_SOURCE_SHA, patchDigest: ELIGIBILITY_BODY_SHA } : {}),
    ...(wscene ? {
      worldRevision: 'WMP-04R1', sceneId: wscene.id,
      beforeLayoutId: wscene.isBefore ? null : wscene.beforeId,
      analysisCellAu: 8 as const, unitsPerTileDiagnostic: 2 as const,
      geometrySource: 'GOLD_LR01_AUTHORED_POLYGONS_AND_CENTRELINES__UNCHANGED',
      biomeSource: wscene.isBefore ? 'WMP01_SOURCE_BIOME_CODE__QA_BEFORE' : 'WMP04R1_BIOME_EFFECTIVE_R1',
      activeRevisionDigest: WMP04R1_META.provenance.manifestR1Sha256,
    } : {}),
  };
  const n = WW * WH, mask = p.body.compactMasks, water = expandRle(mask.landWaterRle, 2), codes = expandRle(mask.biomeRle, 11), roads = expandRle(mask.roadClassRle, 5), rawElevation = expandRle(mask.elevationRle, 255);
  // WMP-04R1 static rasters (browser-decoded, SHA-256 verified). Each entry is an
  // 8 AU ANALYTICAL cell, sampled at the U=2 tile centre; never a gameplay tile.
  const effBiome = wscene ? wmp04Raster('biomeEffective') : null;
  const sourceBiome = wscene ? wmp04Raster('sourceBiomeCode') : null;
  const cold = wscene ? wmp04Raster('coldTransition') : null;
  const marine = wscene ? wmp04Raster('marineRegion') : null;
  const cliff = wscene && !wscene.isBefore ? wmp04Raster('cliffCandidate') : null;
  const heightClass = wscene ? wmp04Raster('heightClass') : null;
  const marineRegionTiles = new Uint8Array(n), coldTransitionTiles = new Uint8Array(n), effectiveBiomeTiles = new Uint8Array(n), cliffCandidateTiles = new Uint8Array(n);
  // Candidate render/economy mappings, NOT authored climate or approved physical height.
  // Legacy Gameplay mappings are preserved BYTE-FOR-BYTE for all WMP-01/02/03
  // layouts. Only the new WMP-04R1 pilot scenes use the extended mapping for
  // scrub_dry_steppe (code 6); no legacy digest, biome or save identity changes.
  const legacyCodeTile = [T.MEADOW, T.FOREST, T.FOREST, T.FOREST, T.MARSH, T.SAND, T.MEADOW, T.HILL, T.SNOW, T.ASH, T.TOXIC, T.SAND];
  const legacyCodeBiome: Biome[] = ['meadow', 'forest', 'forest', 'forest', 'marsh', 'sand', 'meadow', 'hill', 'snow', 'ash', 'toxic', 'sand'];
  // scrub_dry_steppe (code 6) reuses the EXISTING SOH brown hill palette:
  // a dry, readable ground distinct from green meadow and from pale sand desert.
  // No new tileset, no new sprite, no invented material.
  const wmpCodeTile = [T.MEADOW, T.FOREST, T.FOREST, T.FOREST, T.MARSH, T.SAND, T.HILL, T.HILL, T.SNOW, T.ASH, T.TOXIC, T.SAND];
  const wmpCodeBiome: Biome[] = ['meadow', 'forest', 'forest', 'forest', 'marsh', 'sand', 'hill', 'hill', 'snow', 'ash', 'toxic', 'sand'];
  const codeTile = wscene ? wmpCodeTile : legacyCodeTile;
  const codeBiome = wscene ? wmpCodeBiome : legacyCodeBiome;
  const tiles = new Uint8Array(n), fresh = new Uint8Array(n), zone = new Uint8Array(n), seaDist = new Uint8Array(n).fill(255), biome: Biome[] = Array(n), elevation = new Float32Array(n), slope = new Float32Array(n), moisture = new Float32Array(n), temperature = new Float32Array(n), walkable = new Uint8Array(n), buildable = new Uint8Array(n), cargoPassable = new Uint8Array(n), road = new Uint8Array(n), protectedCells = new Uint8Array(n), industrial = new Uint8Array(n), coast = new Uint8Array(n);
  const zones = (p.body.construction as { zones: { id: string; geometry: { ringAu: number[][] } }[] }).zones;
  // Ferry polylines are EXCLUDED from road centrelines: a ferry is a suggestion,
  // never a dry-land road and never a permission to walk on sea.
  const riverLines = canon.project.rivers.flatMap(r => lines(r.points, 4.5)), roadLines = canon.project.roads.filter(r => r.kind !== 'ferry').flatMap(r => lines(r.points, 4.5));
  const bounds = canon.project.pois.filter(a => a.foot && a.foot.length >= 3 && a.foot.some(([x, y]) => x >= identity.originAu[0] && x < identity.originAu[0] + WW * unitsPerTile && y >= identity.originAu[1] && y < identity.originAu[1] + WH * unitsPerTile));
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const i = y * WW + x, [gx, gy] = globalFromTile(identity, x, y), ri = Math.floor(gy / 8) * 250 + Math.floor(gx / 8);
    const sourceCode = codes[ri];
    const code = wscene ? (wscene.isBefore ? sourceBiome![ri] : effBiome![ri]) : sourceCode;
    // Geometry ALWAYS comes from authored GOLD polygons / centrelines, never from
    // a downsampled raster square.
    const land = canon.project.land.some(a => a.rings.length > 0 && contains(gx, gy, a.rings[0]) && !a.rings.slice(1).some(h => contains(gx, gy, h)));
    const freshWater = land && (canon.project.lakes.some(a => contains(gx, gy, a.ring)) || riverLines.some(a => onLine(gx, gy, a)));
    const w = land ? (freshWater ? 2 : 0) : 1;
    const boundary = x === 0 || y === 0 || x === WW - 1 || y === WH - 1;
    const poi = bounds.some(q => contains(gx, gy, q.foot));
    const isRoad = w === 0 && roadLines.some(a => onLine(gx, gy, a));
    if (boundary) { tiles[i] = T.CLIFF; biome[i] = 'wall'; protectedCells[i] = 1; continue; }
    let t = w === 1 ? T.DEEP : w === 2 ? T.SHALLOW : codeTile[code];
    if (isRoad) t = T.ROAD;
    // WMP-03 connected cliff faces are real physical geometry, applied only to
    // dry land that is not an authored road or POI footprint. No new structures.
    const isCliff = !!(cliff && w === 0 && !isRoad && !poi && cliff[ri] === 1);
    if (isCliff) t = T.CLIFF;
    tiles[i] = t; fresh[i] = +(w === 2); biome[i] = w ? 'water' : isRoad ? 'road' : codeBiome[code];
    elevation[i] = rawElevation[ri] / 255;
    moisture[i] = code === 4 ? .8 : code === 1 || code === 2 ? .65 : (wscene ? (code === 5 || code === 6 ? .2 : .45) : (code === 5 ? .2 : .45));
    temperature[i] = code === 8 ? .15 : code === 9 ? .8 : .55;
    // coldTransition is a geographic CLASS (0..3), NOT degrees Celsius or a rate.
    if (wscene && cold) { const c = cold[ri]; if (c >= 2 && code !== 8 && w === 0) temperature[i] = Math.min(temperature[i], .28); }
    walkable[i] = +(w === 0 && !isCliff);
    road[i] = +isRoad;
    const candidate = zones.some(z => contains(gx, gy, z.geometry.ringAu));
    protectedCells[i] = +(poi || isRoad);
    buildable[i] = +(w === 0 && !isRoad && !poi && !isCliff && candidate); // Map zones are candidates, not forced structures.
    cargoPassable[i] = +(w === 0 && !isCliff); // ordinary dry ground only; no water crossing or swept-clearance claim
    if (wscene) {
      // BEFORE QA scenes represent the pre-WMP-04 Web world: no WMP-04 marine
      // domain, no WMP-04R1 cold-transition class and no WMP-03 cliff faces.
      const before = !!wscene!.isBefore;
      marineRegionTiles[i] = !before && marine ? marine[ri] : 0;
      coldTransitionTiles[i] = !before && cold ? cold[ri] : 0;
      effectiveBiomeTiles[i] = code;
      cliffCandidateTiles[i] = cliff ? cliff[ri] : 0;
    }
  }
  // LR02 is a separately pinned diagnostic layout. Project Map's *clipped*
  // solids, not the older continuous parent walls. A tile-centre raster is a
  // candidate collision representation, not proof that every opening fits.
  let spawnEligible: Uint8Array | undefined;
  if (lr02) {
    const allowed = new Set(greywaterPatch.spawnEligibility.greywaterEligibleArea.cellIndices);
    spawnEligible = new Uint8Array(n);
    const solids = greywaterPatch.staticArchitecture.staticSolids.flatMap(s => lines([s.aAu, s.bAu], s.thicknessAu / 2));
    for (let y = 1; y < WH - 1; y++) for (let x = 1; x < WW - 1; x++) {
      const i = y * WW + x, [gx, gy] = globalFromTile(identity, x, y), ri = Math.floor(gy / 8) * 250 + Math.floor(gx / 8);
      spawnEligible[i] = +allowed.has(ri);
      if (solids.some(s => onLine(gx, gy, s))) { tiles[i] = T.PWALL; biome[i] = 'wall'; walkable[i] = 0; buildable[i] = 0; cargoPassable[i] = 0; road[i] = 0; protectedCells[i] = 1; }
    }
  }
  if (oasisM2) { const allowed = new Set(eligibleRegions.candidateRegions.flatMap(r => r.geometry.cellIndices)); spawnEligible = new Uint8Array(n); for (let y = 1; y < WH - 1; y++) for (let x = 1; x < WW - 1; x++) { const [gx, gy] = globalFromTile(identity, x, y), ri = Math.floor(gy / 8) * 250 + Math.floor(gx / 8); spawnEligible[y * WW + x] = +allowed.has(ri); } }
  // Coast distance for the existing Web shore renderer, in projected gameplay tiles.
  const queue = new Int32Array(n); let head = 0, tail = 0; for (let i = 0; i < n; i++) if (tiles[i] === T.DEEP) { seaDist[i] = 0; queue[tail++] = i; }
  while (head < tail) { const i = queue[head++], x = i % WW, y = Math.floor(i / WW); if (seaDist[i] >= 8) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= WW || ny >= WH) continue; const j = ny * WW + nx; if (seaDist[j] > seaDist[i] + 1) { seaDist[j] = seaDist[i] + 1; queue[tail++] = j; } } }
  for (let i = 0; i < n; i++) coast[i] = +(seaDist[i] <= 4 && !fresh[i] && tiles[i] !== T.DEEP);
  // Reachability anchors for population only; these are NOT spawn coordinates, landmarks or grants.
  const anchors: { id: string; x: number; y: number }[] = []; for (let y = 20; y < WH - 2; y += 40) for (let x = 20; x < WW - 2; x += 40) if (walkable[y * WW + x]) anchors.push({ id: `compiler_${x}_${y}`, x, y });
  if (!anchors.length) throw Error('No walkable terrain in Veyra diagnostic view');
  const economyMap: EconomyMap = { id: layout, revision: 1, seed: 2026, width: WW, height: WH, tileSize: TILE, biome, elevation, slope, moisture, temperature, freshwater: fresh, coast, walkable, buildable, cargoPassable, road, protected: protectedCells, industrial, starts: anchors };
  const generated = compileEconomy(economyMap); if (generated.errors.length) throw Error(`Veyra source compiler: ${generated.errors.join('; ')}`);
  const places: Place[] = bounds.map(q => { const [tx, ty] = tileFromGlobal(identity, q.at[0], q.at[1]); return { id: q.id, name: q.name, tx, ty, kind: 'poi' as const }; }).filter(q => q.tx > 0 && q.ty > 0 && q.tx < WW - 1 && q.ty < WH - 1);
  // Keep the ORIGINAL SOH top-left HUD compact. The long WMP-04R1 geography
  // label lives in the separate pilot HUD annotation, never in zoneNames[0].
  return {
    tiles, fresh, zone, seaDist, src: new Int8Array(n).fill(-1), sourceOverlayV2: new Int8Array(n).fill(-1),
    buildings: [], statics: [], places, starts: [], elders: [], economyMap, sourceV3: generated.sources,
    veyra: identity, randomSpawn: true, ...(spawnEligible ? { spawnEligible } : {}), enforceMasks: true,
    zoneNames: [wscene ? `WMP04R1 · ${wscene.short}` : oasis ? 'Veyra · Oasis and Dunes region' : 'Veyra · Greywater region'],
    ...(wscene ? {
      wmp04r1: {
        scene: wscene, revision: 'WMP-04R1',
        marineRegion: marineRegionTiles, coldTransition: coldTransitionTiles,
        effectiveBiome: effectiveBiomeTiles, cliffCandidate: cliffCandidateTiles,
        heightClassSamples: heightClass ? heightClass : new Uint8Array(0),
        integrity: assertWmp04Integrity(),
        note: 'Static Map geography only. Marine domains are NOT damage, swimming or boat permission. 8 AU cells and U=2 are diagnostic.',
      },
    } : {}),
  };
}
