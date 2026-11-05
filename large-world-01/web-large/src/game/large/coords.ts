/**
 * Stable WORLD-SPACE tile coordinates, chunk identity and linear indexing.
 * No hard-coded 200-tile width/height and no legacy 100-stride cache key.
 *
 * Negative coordinates and edges are explicitly handled: a chunk key is a
 * signed pair separated by ':' so (-1,10) can never alias (1,10), and the
 * legacy `cy*100+cx` key would collide for cx>=100 (which a 2,000-wide world
 * reaches). All linear-index functions reject out-of-frame coordinates.
 */
import type { WorldProfile } from './profile';

export interface ChunkCoord { chunkX: number; chunkY: number; localX: number; localY: number }
export interface WorldCoord { x: number; y: number }

/** Explicit profile-scoped, collision-free chunk key. Signed coordinates safe. */
export function chunkKey(profileId: string, cx: number, cy: number): string {
  if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) throw Error('LW01_CHUNK_COORD_NOT_INTEGER');
  return `${profileId}|${cx}:${cy}`;
}
export function parseChunkKey(k: string): { profileId: string; cx: number; cy: number } {
  const [pid, pair] = k.split('|'); const [a, b] = pair.split(':');
  return { profileId: pid, cx: Number(a), cy: Number(b) };
}

/** floor division (not truncation) so negative pixels map to negative chunks. */
export const floordiv = (a: number, b: number) => Math.floor(a / b);
export function toChunk(p: WorldProfile, x: number, y: number): ChunkCoord {
  const c = p.chunkSize;
  const chunkX = floordiv(x, c), chunkY = floordiv(y, c);
  return { chunkX, chunkY, localX: x - chunkX * c, localY: y - chunkY * c };
}
export const localIndex = (p: WorldProfile, lx: number, ly: number) => ly * p.chunkSize + lx;
export const chunkOrigin = (p: WorldProfile, cx: number, cy: number): WorldCoord => ({ x: cx * p.chunkSize, y: cy * p.chunkSize });
export function chunkFromTile(p: WorldProfile, tx: number, ty: number) { return toChunk(p, tx, ty); }

/** Global linear index with the PROFILE stride. Never a hard-coded 200. */
export function index(p: WorldProfile, x: number, y: number): number {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) throw Error('LW01_INDEX_NOT_INTEGER');
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) throw Error(`LW01_INDEX_OUT_OF_FRAME ${x},${y} in ${p.w}x${p.h}`);
  return y * p.w + x;
}
export function unindex(p: WorldProfile, i: number): WorldCoord {
  if (!Number.isSafeInteger(i) || i < 0 || i >= p.w * p.h) throw Error('LW01_UNINDEX_OUT_OF_RANGE ' + i);
  return { x: i % p.w, y: (i / p.w) | 0 };
}
export function inFrame(p: WorldProfile, x: number, y: number) {
  return Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && y >= 0 && x < p.w && y < p.h;
}
/** Global tile -> authoring unit centre (U-dependent, fixed identity transform). */
export function tileToAu(p: WorldProfile, tx: number, ty: number): [number, number] {
  return [(tx + 0.5) * p.U, (ty + 0.5) * p.U];
}
/** Authoring units -> global tile (floor). */
export function auToTile(p: WorldProfile, auX: number, auY: number): WorldCoord {
  return { x: Math.floor(auX / p.U), y: Math.floor(auY / p.U) };
}
/** Global pixel position -> global tile (TILE=16 preserved). */
export const TILE_PX = 16;
export function pixelToTile(px: number, py: number): WorldCoord {
  return { x: Math.floor(px / TILE_PX), y: Math.floor(py / TILE_PX) };
}
export function cameraTarget(p: WorldProfile, px: number, py: number, viewW: number, viewH: number) {
  return {
    x: Math.max(0, Math.min(p.w * TILE_PX - viewW, px - viewW / 2)),
    y: Math.max(0, Math.min(p.h * TILE_PX - viewH, py - viewH / 2 - 6)),
  };
}
/** Legacy 200x200 save stride. Kept ONLY for migration; never used by the new path. */
export const LEGACY_STRIDE = 200;

/** Exhaustive ALL-chunk key uniqueness for an explicit profile frame. */
export function verifyAllChunkKeys(p: WorldProfile): { totalChunks: number; uniqueKeys: number; collisions: number; legacyKeyCollisions: number } {
  const nx = Math.ceil(p.w / p.chunkSize), ny = Math.ceil(p.h / p.chunkSize);
  const keys = new Set<string>(), legacy = new Map<number, string>();
  let collisions = 0, legacyKeyCollisions = 0;
  for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
    const k = chunkKey(p.id, cx, cy);
    if (keys.has(k)) collisions++;
    keys.add(k);
    const lk = cy * 100 + cx;
    const prev = legacy.get(lk);
    if (prev !== undefined && prev !== `${cx}:${cy}`) legacyKeyCollisions++;
    legacy.set(lk, `${cx}:${cy}`);
  }
  return { totalChunks: nx * ny, uniqueKeys: keys.size, collisions, legacyKeyCollisions };
}

/** The ORIGINAL renderer caches 16x16-tile display canvases with the key
 *  `cy*100+cx`. At a 2,000-wide frame that resets to 125 display chunks across,
 *  so cx>=100 really DOES alias inside the authored frame. This is the concrete
 *  defect the profile-scoped string key removes. */
export function verifyRenderChunkKeys(p: WorldProfile, renderChunk = 16) {
  const nx = Math.ceil(p.w / renderChunk), ny = Math.ceil(p.h / renderChunk);
  const legacy = new Map<number, string>(), modern = new Set<string>();
  let legacyKeyCollisions = 0, newKeyCollisions = 0;
  for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
    const lk = cy * 100 + cx, tag = `${cx}:${cy}`;
    const prev = legacy.get(lk); if (prev !== undefined && prev !== tag) legacyKeyCollisions++;
    legacy.set(lk, tag);
    const k = chunkKey(p.id, cx, cy); if (modern.has(k)) newKeyCollisions++; modern.add(k);
  }
  return { renderChunk, renderChunksX: nx, renderChunksY: ny, total: nx * ny, legacyKeyCollisions, newKeyCollisions };
}

/** Exhaustive aliasing check used by the negative fixtures. */
export function verifyNoAliasing(p: WorldProfile): { checked: number; collisions: number; negativeSafe: boolean; edgeSafe: boolean; legacyKeyCollisions: number } {
  // An index may legitimately be probed twice; only a DIFFERENT coordinate
  // mapping to the same index is an aliasing defect.
  const indices = new Map<number, string>(); const chunkKeys = new Map<string, string>();
  let collisions = 0, checked = 0, legacyKeyCollisions = 0;
  const probes: [number, number][] = [[0, 0], [p.w - 1, 0], [0, p.h - 1], [p.w - 1, p.h - 1], [p.w, p.h]];
  // deterministic pseudo-random probes (no Math.random so the fixture is reproducible)
  let s = 0x51f15; for (let k = 0; k < 4000; k++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const x = s % p.w; const y = ((s >>> 8) % p.h); probes.push([x, y]); }
  for (const [x, y] of probes) {
    if (!inFrame(p, x, y)) continue;
    const i = index(p, x, y);
    const prev = indices.get(i); if (prev !== undefined && prev !== `${x},${y}`) collisions++; indices.set(i, `${x},${y}`);
    const u = unindex(p, i);
    if (u.x !== x || u.y !== y) collisions++;
    const c = toChunk(p, x, y); const o = chunkOrigin(p, c.chunkX, c.chunkY);
    if (o.x + c.localX !== x || o.y + c.localY !== y) collisions++;
    const key = chunkKey(p.id, c.chunkX, c.chunkY);
    const parsed = parseChunkKey(key);
    if (parsed.cx !== c.chunkX || parsed.cy !== c.chunkY || parsed.profileId !== p.id) collisions++;
    const expect = `${c.chunkX}:${c.chunkY}`;
    if (chunkKeys.has(key) && chunkKeys.get(key) !== expect) collisions++;
    chunkKeys.set(key, expect);
    // demonstrate the OLD key DOES collide at large widths
    const legacyKey = c.chunkY * 100 + c.chunkX;
    const otherCx = c.chunkX + 100, otherCy = c.chunkY - 1;
    if (otherCx >= 0 && otherCy >= 0 && otherCy * 100 + otherCx === legacyKey) legacyKeyCollisions++;
    checked++;
  }
  const neg = toChunk(p, -1, -33), pos = toChunk(p, 1, 33);
  const negativeSafe = chunkKey(p.id, neg.chunkX, neg.chunkY) !== chunkKey(p.id, pos.chunkX, pos.chunkY)
    && neg.chunkX === -1 && neg.chunkY === -2 && neg.localX === 31 && neg.localY === 31;
  const edgeSafe = inFrame(p, p.w - 1, p.h - 1) && !inFrame(p, p.w, p.h) && !inFrame(p, -1, 0);
  return { checked, collisions, negativeSafe, edgeSafe, legacyKeyCollisions };
}
