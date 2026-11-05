/**
 * Exact, PROFILE-AWARE package validator for the new large-world path.
 * The legacy `validateRuntimeMapPackage()` in map-package.ts is preserved
 * verbatim for the untouched 200x200 app; this validator never hard-codes 200.
 */
import { index, unindex, inFrame, chunkKey, chunkFromTile, verifyNoAliasing, verifyAllChunkKeys, verifyRenderChunkKeys, type WorldCoord } from './coords';
import { sampleAt } from './geometry';
import type { WorldProfile } from './profile';
import type { WorldChunk } from './chunk';
import { validateLwSave, DurableStore, type LwSave } from './state';
import { T } from '../core';

export interface PackageLayerSpec { name: string; bytes: number; stride: number }
export function validateRuntimePackageProfile(p: WorldProfile, pkg: { id: string; w: number; h: number; layers: PackageLayerSpec[] }): string[] {
  const e: string[] = [];
  if (pkg.w !== p.w || pkg.h !== p.h) e.push(`package ${pkg.w}x${pkg.h} != profile ${p.w}x${p.h}`);
  const cells = p.w * p.h;
  for (const l of pkg.layers) {
    if (l.stride !== p.w) e.push(`${l.name} stride ${l.stride} != ${p.w}`);
    if (l.bytes !== cells) e.push(`${l.name} length ${l.bytes} != ${cells}`);
  }
  return e;
}
export function validateChunkPackage(p: WorldProfile, c: WorldChunk): string[] {
  const e: string[] = [];
  const n = p.chunkSize * p.chunkSize;
  for (const [name, arr] of [['tiles', c.tiles], ['biome', c.biome], ['foot', c.foot], ['flags', c.flags], ['elevation', c.elevation]] as const)
    if (arr.length !== n) e.push(`${name} length ${arr.length} != ${n}`);
  if (c.key !== chunkKey(p.id, c.cx, c.cy)) e.push('chunk key mismatch');
  for (let ly = 0; ly < p.chunkSize; ly++) for (let lx = 0; lx < p.chunkSize; lx++) {
    const tx = c.cx * p.chunkSize + lx, ty = c.cy * p.chunkSize + ly;
    if (!inFrame(p, tx, ty)) continue;
    const i = ly * p.chunkSize + lx;
    // No default walkability on water / cliffs.
    const s = sampleAt(p, tx, ty);
    if (s.water && c.foot[i] === 1) e.push(`foot granted on water at ${tx},${ty}`);
    if (s.cliffCandidate >= 2 && s.heightClass >= 2 && !s.bridge && c.foot[i] === 1) e.push(`foot granted on cliff at ${tx},${ty}`);
  }
  return e;
}

export interface NegativeResult { id: string; pass: boolean; detail: any }
/** Reproducible negative fixtures. Each is an assertion, never a weakened validator. */
export function runNegativeFixtures(p: WorldProfile): NegativeResult[] {
  const out: NegativeResult[] = [];
  const alias = verifyNoAliasing(p);
  const allChunks = verifyAllChunkKeys(p);
  out.push({ id: 'LW-N01 chunk coordinate uniqueness (2,000×2,000)', pass: alias.collisions === 0, detail: alias });
  out.push({ id: 'LW-N01b exhaustive ALL-chunk key uniqueness for active frame', pass: allChunks.collisions === 0 && allChunks.uniqueKeys === allChunks.totalChunks, detail: allChunks });
  const rk = verifyRenderChunkKeys(p);
  out.push({ id: 'LW-N02 legacy 100-stride key arithmetic alias (cx>=100)', pass: alias.legacyKeyCollisions > 0,
    detail: { legacyKeyCollisions: alias.legacyKeyCollisions, note: 'Hypothetical arithmetic alias outside the 32-tile streaming frame; see LW-N02b for the in-frame renderer defect.' } });
  out.push({ id: 'LW-N02b legacy render-cache 100-stride key collides IN-FRAME', pass: rk.legacyKeyCollisions > 0 && rk.newKeyCollisions === 0,
    detail: { ...rk, note: 'Original render.ts caches 16x16-tile canvases at cy*100+cx; with 125 display chunks across a 2,000-tile frame this aliases. New string key has zero collisions.' } });
  out.push({ id: 'LW-N03 negative coords and frame edges', pass: alias.negativeSafe && alias.edgeSafe, detail: { negativeSafe: alias.negativeSafe, edgeSafe: alias.edgeSafe } });
  // No wrong stride / cell-index cross-chunk aliasing
  let strideCollisions = 0;
  for (const [x, y] of [[0, 1], [p.w, 0], [1, 1], [p.w - 1, p.h - 1]]) {
    if (!inFrame(p, x, y)) continue;
    const i = index(p, x, y), u = unindex(p, i);
    if (u.x !== x || u.y !== y) strideCollisions++;
    const c = chunkFromTile(p, x, y);
    if (chunkKey(p.id, c.chunkX, c.chunkY) !== chunkKey(p.id, Math.floor(x / p.chunkSize), Math.floor(y / p.chunkSize))) strideCollisions++;
  }
  out.push({ id: 'LW-N04 no wrong-stride / cross-chunk index aliasing', pass: strideCollisions === 0, detail: { strideCollisions } });
  // Sea / ferry / cliff / buildable / duplicate grants
  const probes: WorldCoord[] = [];
  let s = 1234567; for (let k = 0; k < 400; k++) { s = (s * 1103515245 + 12345) & 0x7fffffff; probes.push({ x: s % p.w, y: (s >>> 9) % p.h }); }
  let landWalkOnSea = 0, ferryFoot = 0, cliffWalk = 0, bogusBuild = 0, beachDup = 0, inlandWaterTiles = 0;
  for (const t of probes) {
    const sm = sampleAt(p, t.x, t.y);
    if (sm.water && sm.permissions.foot) landWalkOnSea++;
    if (sm.permissions.ferryFoot) ferryFoot++;
    if (sm.cliffCandidate >= 2 && sm.heightClass >= 2 && sm.permissions.foot && !sm.bridge) cliffWalk++;
    if (sm.permissions.build) bogusBuild++;
    // Authored lakes/rivers on land are inland water, NOT a duplicated beach.
    // A duplication defect is sea rendered as walkable land, or inland water
    // rendered as a dry beach/land tile.
    if (sm.authoredLand && (sm.lake || sm.river)) inlandWaterTiles++;
    const seaTile = sm.tile === T.DEEP || sm.tile === T.SHALLOW || sm.tile === T.RIVER;
    if ((!sm.authoredLand && !seaTile) || (sm.authoredLand && !sm.lake && !sm.river && seaTile) || ((sm.lake || sm.river) && sm.tile !== T.RIVER)) beachDup++;
  }
  out.push({ id: 'LW-N05 no land-walk on sea', pass: landWalkOnSea === 0, detail: { landWalkOnSea, probes: probes.length } });
  out.push({ id: 'LW-N06 no ferry foot permission', pass: ferryFoot === 0, detail: { ferryFoot } });
  out.push({ id: 'LW-N07 no default walkability on cliffs / blocked crossings', pass: cliffWalk === 0, detail: { cliffWalk } });
  out.push({ id: 'LW-N08 no bogus buildable grants', pass: bogusBuild === 0, detail: { bogusBuild } });
  out.push({ id: 'LW-N09 no beach/land duplication', pass: beachDup === 0, detail: { beachDup, inlandWaterTiles, probes: probes.length } });
  return out;
}

/** Duplicate-loot / duplicate-source / duplicate-receipt fixture. */
export function runDurableNegativeFixtures(store: DurableStore): NegativeResult[] {
  const t = { x: 10, y: 10 };
  const first = store.harvest('dup-src', t), second = store.harvest('dup-src', t);
  const g1 = store.grant('dup-loot', 'wood', 1, t), g2 = store.grant('dup-loot', 'wood', 1, t);
  const tx1 = store.transact('dup-txn', t, {}), tx2 = store.transact('dup-txn', t, {});
  const save = store.serialize({ x: 160, y: 160, hp: 100, stamina: 100, hunger: 100, thirst: 100, warmth: 100, active: 0, dir: 0 });
  const receipts = new Set<string>(); let duplicates = 0;
  for (const r of save.receipts) { if (receipts.has(r)) duplicates++; receipts.add(r); }
  return [
    { id: 'LW-N10 no duplicate source grant', pass: first.ok === true && second.duplicate === true, detail: { first: first.ok, second: second.duplicate } },
    { id: 'LW-N11 no duplicate loot grant', pass: g1.ok === true && g2.duplicate === true, detail: { first: g1.ok, second: g2.duplicate } },
    { id: 'LW-N12 no duplicate transaction receipt', pass: tx1.ok === true && tx2.duplicate === true && duplicates === 0, detail: { first: tx1.ok, second: tx2.duplicate, duplicateReceipts: duplicates } },
  ];
}
export function validateSaveProfile(save: LwSave, p: WorldProfile) { return validateLwSave(save, p); }
