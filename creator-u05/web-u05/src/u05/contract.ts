/**
 * CREATOR_CHOSEN_U05 v1.0.0 — executable form of the versioned scale contract.
 * Creator-locked SCALE INTENT only. Full Gameplay runtime integration remains
 * NOT_YET_VALIDATED. See creator-u05/contracts/CREATOR_CHOSEN_U05.v1.json.
 */
export const CONTRACT_ID = 'CREATOR_CHOSEN_U05.v1' as const;
export const U = 0.5;                       // AU per runtime tile
export const TILE = 16;                     // px per runtime tile (SOH core.ts)
export const TILES_PER_AU = 1 / U;          // 2
export const PX_PER_AU = TILE / U;          // 32
export const FRAME_AU: [number, number] = [2000, 1400];
export const FRAME_W = 4000;                // runtime tiles
export const FRAME_H = 2800;                // NON-SQUARE
export const ADDRESSABLE_CELLS = FRAME_W * FRAME_H; // 11,200,000 — NEVER materialised
export const VIEW_W = 640, VIEW_H = 360;    // native SOH camera, 1x
export const HERO_W = 16, HERO_H = 24;      // native SOH hero sprite
export const SPEED = 72;                    // px/s
export const CHUNK = 32;                    // geometry chunk (tiles)
export const RENDER_CHUNK = 16;             // display canvas chunk (tiles)
export const CHUNKS_X = Math.ceil(FRAME_W / CHUNK);   // 125
export const CHUNKS_Y = Math.ceil(FRAME_H / CHUNK);   // 88
export const TOTAL_CHUNKS = CHUNKS_X * CHUNKS_Y;      // 11000
export const MAX_RESIDENT_CHUNKS = 36;
export const MAX_DISPLAY_CANVASES = 36;

export function auToTile(auX: number, auY: number): [number, number] {
  return [Math.floor(auX / U), Math.floor(auY / U)];
}
export function tileToAuCentre(tx: number, ty: number): [number, number] {
  return [(tx + 0.5) * U, (ty + 0.5) * U];
}
export function tileToPx(tx: number, ty: number): [number, number] {
  return [tx * TILE, ty * TILE];
}
export function auToPx(auX: number, auY: number): [number, number] {
  return [auX * PX_PER_AU, auY * PX_PER_AU];
}
export function reprojectPolygonAu(poly: [number, number][]): [number, number][] {
  return poly.map(([x, y]) => [x / U, y / U]);
}
export function snapPolygonTiles(poly: [number, number][]): [number, number][] {
  return poly.map(([x, y]) => [Math.floor(x / U), Math.floor(y / U)]);
}
/** Profile-scoped, collision-free chunk key; signed coords. NEVER cy*100+cx. */
export function geometryChunkKey(cx: number, cy: number): string {
  if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) throw Error('U05_CHUNK_COORD_NOT_INTEGER');
  return `creator-u05|${cx}:${cy}`;
}
export function displayChunkKey(cx: number, cy: number): string {
  if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) throw Error('U05_CHUNK_COORD_NOT_INTEGER');
  return `creator-u05|render16|${cx}:${cy}`;
}
export function chunkFromTile(tx: number, ty: number) {
  const cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK);
  return { cx, cy, localX: tx - cx * CHUNK, localY: ty - cy * CHUNK };
}
export function inFrame(tx: number, ty: number) {
  return Number.isSafeInteger(tx) && Number.isSafeInteger(ty) && tx >= 0 && ty >= 0 && tx < FRAME_W && ty < FRAME_H;
}
/** Global linear index with the PROFILE stride (4000), never hard-coded 200. */
export function index(tx: number, ty: number): number {
  if (!inFrame(tx, ty)) throw Error(`U05_INDEX_OUT_OF_FRAME ${tx},${ty} in ${FRAME_W}x${FRAME_H}`);
  return ty * FRAME_W + tx;
}
/** Exhaustive chunk-key uniqueness audit for the non-square U=0.5 frame. */
export function verifyAllChunkKeys() {
  const keys = new Set<string>(), legacy = new Map<number, string>();
  let collisions = 0, legacyKeyCollisions = 0;
  for (let cy = 0; cy < CHUNKS_Y; cy++) for (let cx = 0; cx < CHUNKS_X; cx++) {
    const k = geometryChunkKey(cx, cy);
    if (keys.has(k)) collisions++;
    keys.add(k);
    const lk = cy * 100 + cx, pair = `${cx}:${cy}`;
    const prev = legacy.get(lk);
    if (prev !== undefined && prev !== pair) legacyKeyCollisions++;
    legacy.set(lk, pair);
  }
  return { totalChunks: CHUNKS_X * CHUNKS_Y, uniqueKeys: keys.size, collisions, legacyKeyCollisions };
}
export const CONTRACT_INVARIANTS = {
  status: 'CREATOR_SCALE_INTENT_APPROVED__FULL_GAMEPLAY_RUNTIME_INTEGRATION_NOT_YET_VALIDATED',
  nonSquare: (FRAME_W as number) !== (FRAME_H as number),
  neverMaterializeAllCells: true,
  noNewAtlas: true,
  roadWidthAu: 3.0,
  roadWidthTilesAtU05: 3.0 / U,
  noRoadWideningBeyondTransform: true,
  noZoom: true,
  noStretchedSprites: true,
  physicalLayerIsAdditive: true
};
