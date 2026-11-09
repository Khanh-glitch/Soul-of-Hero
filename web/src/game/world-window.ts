// B06 large-world compatibility seam. Pure functions only: no engine, persistence or render changes.
// The runtime world is still one WW×WH window (core.ts). This module defines the global identity
// arithmetic that a future multi-window runtime must use, so that entities, depletion and cargo keep one
// global identity when they leave the active window. The Map frame size below is a PENDING Map contract
// value (prototype reference), not an authored geography and not used by the runtime.
export const CHUNK_SIZE = 32;
export const PENDING_MAP_FRAME = { width: 4000, height: 2800 } as const;

export interface WindowIdentity { mapId: string; revision: number; digest: string }
export interface WindowCoord { cx: number; cy: number }

export function chunkOf(gx: number, gy: number): WindowCoord {
  if (!Number.isSafeInteger(gx) || !Number.isSafeInteger(gy)) throw new Error('global coordinates must be safe integers');
  return { cx: Math.floor(gx / CHUNK_SIZE), cy: Math.floor(gy / CHUNK_SIZE) };
}
/** Global cell key. Collision-free across the whole frame (no hash), exact up to 2^53. */
export function globalCellKey(gx: number, gy: number, frameW = PENDING_MAP_FRAME.width, frameH = PENDING_MAP_FRAME.height): number {
  if (!Number.isInteger(gx) || !Number.isInteger(gy) || gx < 0 || gy < 0 || gx >= frameW || gy >= frameH) throw new Error(`cell ${gx},${gy} outside frame`);
  return gy * frameW + gx;
}
export function toLocal(gx: number, gy: number, origin: WindowCoord): { x: number; y: number } {
  return { x: gx - origin.cx * CHUNK_SIZE, y: gy - origin.cy * CHUNK_SIZE };
}
export function windowId(c: WindowCoord, identity: WindowIdentity): string {
  return `${identity.mapId}@r${identity.revision}:${identity.digest}:${c.cx},${c.cy}`;
}
/** Movement across a chunk edge: returns the new window when the global cell crosses a chunk boundary. */
export function crossing(from: { gx: number; gy: number }, to: { gx: number; gy: number }): { changed: boolean; from: WindowCoord; to: WindowCoord } {
  const a = chunkOf(from.gx, from.gy), b = chunkOf(to.gx, to.gy);
  return { changed: a.cx !== b.cx || a.cy !== b.cy, from: a, to: b };
}
/** Safe rejection: a window may only be attached to the identity it was authored for. */
export function acceptWindow(expected: WindowIdentity, offered: WindowIdentity): string[] {
  const errors: string[] = [];
  if (expected.mapId !== offered.mapId) errors.push(`map id mismatch ${offered.mapId}`);
  if (expected.revision !== offered.revision) errors.push(`map revision mismatch ${offered.revision}`);
  if (expected.digest !== offered.digest) errors.push('map digest mismatch');
  return errors;
}
/** Persistent world record keyed by global cell. Depletion and owned-entity position survive window unload. */
export interface PersistentCellRecord { key: number; depleted: boolean; uid?: string }
export class GlobalCellStore {
  private cells = new Map<number, PersistentCellRecord>();
  set(gx: number, gy: number, patch: Partial<Omit<PersistentCellRecord, 'key'>>) {
    const key = globalCellKey(gx, gy); const prev = this.cells.get(key) ?? { key, depleted: false };
    this.cells.set(key, { ...prev, ...patch, key });
  }
  get(gx: number, gy: number): PersistentCellRecord | undefined { return this.cells.get(globalCellKey(gx, gy)); }
  toJSON(): PersistentCellRecord[] { return [...this.cells.values()].sort((a, b) => a.key - b.key); }
  static fromJSON(list: PersistentCellRecord[]): GlobalCellStore {
    const s = new GlobalCellStore();
    for (const r of list) { if (!Number.isSafeInteger(r.key) || r.key < 0 || typeof r.depleted !== 'boolean') throw new Error('invalid persistent cell record'); if (s.cells.has(r.key)) throw new Error('duplicate persistent cell key'); s.cells.set(r.key, r); }
    return s;
  }
}
