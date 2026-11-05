/**
 * Compatibility layer that lets the ORIGINAL SOH render.ts draw the new
 * chunk-backed world without any WW/WH=200 dependency. render.ts is patched to
 * import from this module instead of world.ts / engine.ts / sim.ts, and to use
 * LW.w / LW.h + chunkKey() instead of WW / WH + `cy*100+cx`.
 *
 * Nothing here grants gameplay legality. All permission comes from the typed
 * boundary in geometry.ts and from DurableStore.
 */
import { BAL, T, hash2, clamp } from '../core';
import { SOURCES, ITEMS } from '../catalog';
import type { WorldProfile } from './profile';
import type { ChunkStore } from './chunk';
import type { DurableStore } from './state';
import { sampleAt } from './geometry';
import { inFrame, index, chunkFromTile, localIndex } from './coords';

export const LW: { w: number; h: number; p: WorldProfile | null; chunks: ChunkStore | null; durable: DurableStore | null; run: any | null } =
  { w: 200, h: 200, p: null, chunks: null, durable: null, run: null };
export function setActive(p: WorldProfile, chunks: ChunkStore, durable: DurableStore, run: any) {
  LW.w = p.w; LW.h = p.h; LW.p = p; LW.chunks = chunks; LW.durable = durable; LW.run = run;
}

const zero = new Proxy({}, { get: () => 0 }) as any;
export const ZONES = ['Heartland','Meadow Bay',"Fisher's Point",'Pinewatch','Eastcove','Frostcrown Peaks','Caldera Wastes','Dead Foundry','Drowned Fen','Oldgrowth','Lighthouse Spit','Harbor Reach','Serpent Strand','Wreck Coast','Old Mill','The Sea'];
export function getWorld() {
  return { zone: zero, seaDist: zero, fresh: zero, tiles: zero, src: zero, sourceV3: zero, sourceOverlayV2: zero,
    buildings: [], statics: [], places: [], zoneNames: ZONES } as any;
}
export const SRC_KEYS = ['oak','pine','snowpine','palm','willow','deadtree','rock','iron','coalv','crystal','salt_shale','sulfur','bush','grass','reed','herb','mushroom','scrap','wreck'];
export function fbm(x: number, y: number, s: number, _oct = 4) {
  const n = (a: number, b: number, c: number) => hash2(Math.floor(a * 64), Math.floor(b * 64), c + s);
  return (n(x, y, 1) + n(x * 2, y * 2, 2) * 0.5 + n(x * 4, y * 4, 3) * 0.25) / 1.75;
}

/** Terrain lookup: resident chunk first, deterministic geography fallback. */
export function effTile(_r: any, tx: number, ty: number): number {
  const p = LW.p; if (!p) return T.DEEP;
  const m = LW.run?.terrain?.[indexSafe(p, tx, ty)]; if (m && (!m.until || m.until > (LW.run.clock?.simMs || 0))) return m.t;
  if (!inFrame(p, tx, ty)) return T.DEEP;
  // Resident chunk wins. A cache MISS is NOT ocean: fall back to deterministic
  // authored geometry so a streaming boundary can never paint a false sea.
  const c = LW.chunks;
  if (c) { const cc = chunkFromTile(p, tx, ty); const ch = c.get(cc.chunkX, cc.chunkY);
    if (ch) return ch.tiles[localIndex(p, cc.localX, cc.localY)]; }
  return sampleAt(p, tx, ty).tile;
}
function indexSafe(p: WorldProfile, x: number, y: number) { try { return index(p, x, y); } catch { return -1; } }

const KIND_TO_ART: Record<string, string> = { wood: 'oak', stone: 'rock', ore: 'iron', sulfur: 'sulfur', obsidian: 'crystal', clay: 'rock', salt: 'salt_shale', herbs: 'herb', food: 'bush', fish: 'reed', fresh_water: 'reed', dock: 'scrap', bridge: 'scrap' };
export function sourceAt(_r: any, tx: number, ty: number, _now?: number) {
  const p = LW.p, c = LW.chunks, d = LW.durable; if (!p || !c || !d || !inFrame(p, tx, ty)) return null;
  const cc = c.get(Math.floor(tx / p.chunkSize), Math.floor(ty / p.chunkSize)); if (!cc) return null;
  const lx = tx - cc.cx * p.chunkSize, ly = ty - cc.cy * p.chunkSize;
  const n = cc.sources.find(s => s.lx === lx && s.ly === ly); if (!n) return null;
  const kind = (n.id.split(':')[0] || n.kind);
  const key = KIND_TO_ART[kind] || 'rock';
  const def = SOURCES[key] || SOURCES.rock;
  const depleted = d.records.has(`source:${n.id}`);
  return { i: index(p, tx, ty), key, def, stock: depleted ? 0 : def.stock, hp: depleted ? 0 : def.hp, st: null, fire: undefined, globalId: n.id };
}
export function entsAt(_r: any, tx: number, ty: number): any[] {
  const p = LW.p, d = LW.durable; if (!p || !d || !inFrame(p, tx, ty)) return [];
  const out: any[] = [];
  for (const r of d.records.values()) if ((r.kind === 'struct' || r.kind === 'loot') && r.tile.x === tx && r.tile.y === ty)
    out.push({ id: r.id, kind: r.kind === 'loot' ? 'loot' : 'struct', type: 'claim', x: tx * 16 + 8, y: ty * 16 + 8, tx, ty, hp: r.data.hp ?? 100, maxHp: r.data.hp ?? 100, c: r.id });
  return out;
}
export function C(_r: any, id: string): any { return { slots: [], name: id }; }
export function roofRoom(_r?: any, _x?: number, _y?: number) { return { cells: new Set<number>() }; }
export function buildReason(_gs: any, _type: string, tx: number, ty: number): string | null {
  const p = LW.p; if (!p || !inFrame(p, tx, ty)) return 'OUTSIDE_WORLD_FRAME';
  const s = sampleAt(p, tx, ty);
  return s.permissions.build ? null : 'MAP_BUILDABLE_CANDIDATE_ONLY__GAMEPLAY_PERMISSION_NOT_APPROVED';
}
export const FX: any[] = []; export const PROJ: any[] = []; export const HAZ: any[] = [];
export function activeStack(_r: any) { const d = LW.durable; if (!d) return null; const first = d.inv()[0]; return first ? { key: first.key, qty: first.qty } : null; }

// --- time / weather: exact SOH formulas, unchanged rates (no game-time hack) ---
export const runElapsedMs = (r: any, now: number) => now - r.startedAt + (r.qaOffset || 0);
export const runHours = (r: any, now: number) => runElapsedMs(r, now) / 3600000;
export function phaseOf(r: any, now: number) { const h = runHours(r, now); const max = BAL.run.maxRunHours;
  if (h >= max) return 'expired'; if (h >= (BAL.run.eldersAwakenDay - 1) * 24) return 'awakening'; if (h >= max - BAL.run.ragnarokFinalHours) return 'danger'; return 'calm'; }
export const isRagnarok = (r: any, now: number) => { const p = phaseOf(r, now); return p === 'danger' || p === 'awakening'; };
export function dayTime(r: any, now: number) { const len = BAL.dayNight.dayLengthMinutes * 60000; return ((((runElapsedMs(r, now) + len * 0.3) % len) + len) % len) / len; }
export function darkness(r: any, now: number) { const t = dayTime(r, now); const s = Math.cos((t - 0.5) * Math.PI * 2); return clamp(0.5 - s * 0.85, 0, 0.78); }
export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog';
export function weatherSlot(seed: number, slot: number): Weather {
  const w = BAL.weather.weights; const keys = Object.keys(w) as Weather[]; const tot = keys.reduce((a, k) => a + w[k], 0);
  let h = ((slot * 2654435761) ^ seed) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; let x = (h % 10000) / 10000 * tot;
  for (const k of keys) { x -= w[k]; if (x < 0) return k; } return 'clear';
}
export const weatherAt = (r: any, at: number): Weather => weatherSlot(r.seed, Math.floor(runElapsedMs(r, at) / (BAL.weather.slotMinutes * 60000)));
export const ITEM_DEFS = ITEMS;
