/**
 * WORLD-GLOBAL durable identities. A far chunk may be unloaded, but its source
 * depletion, placed structures, inventory, transactions, traces, monsters,
 * ownership and time are keyed by stable GLOBAL ids + global tile coords — never
 * by a resident chunk slot or a 200-stride linear index.
 *
 * Save compatibility: this pilot uses its OWN storage key. Existing legacy
 * 200x200 runs (soh.state.v3 ...) are never read-as-write, overwritten or wiped.
 */
import { chunkFromTile, chunkKey, index, type WorldCoord } from './coords';
import type { WorldProfile } from './profile';

export const LW_SAVE_VERSION = 1;
export const LW_SAVE_KEY = 'soh.lw01.save.v1';
export const LEGACY_SAVE_KEYS = ['soh.save.v3', 'soh.state.v3', 'soh.save', 'soh.game.v3'];

export type RecordKind = 'source' | 'struct' | 'loot' | 'monster' | 'trace' | 'txn' | 'ownership' | 'inventory' | 'discovery' | 'time';
export interface DurableRecord {
  id: string; kind: RecordKind;
  tile: WorldCoord; chunk: string;
  at: number; data: any; receipt: string;
}
export interface DelayedEvent { id: string; due: number; kind: string; data: any; seq: number }
export interface LwSave {
  schema: 'soh.lw01.save.v1'; version: number;
  profileId: string; profileW: number; profileH: number;
  mapHead: string; gameplayHead: string; sourceRevision: string;
  savedAt: number; simMs: number; seed: number;
  player: { x: number; y: number; hp: number; stamina: number; hunger: number; thirst: number; warmth: number; active: number; dir: number };
  inventory: { key: string; qty: number }[];
  records: DurableRecord[]; receipts: string[]; delayedEvents: DelayedEvent[];
  nextSeq: number; stats: { harvested: number; placed: number; grants: number; duplicateRejects: number; offlineProcessed: number };
}

export class DurableStore {
  readonly p: WorldProfile; readonly seed: number;
  records = new Map<string, DurableRecord>();
  receipts = new Set<string>();
  delayedEvents: DelayedEvent[] = [];
  inventory = new Map<string, number>();
  nextSeq = 1;
  stats = { harvested: 0, placed: 0, grants: 0, duplicateRejects: 0, offlineProcessed: 0 };
  simMs = 0;
  constructor(p: WorldProfile, seed: number) {
    this.p = p; this.seed = seed;
    this.inventory.set('knife', 1); this.inventory.set('water_flask', 1); this.inventory.set('berries', 3);
  }
  private chunkOf(t: WorldCoord) { const c = chunkFromTile(this.p, t.x, t.y); return chunkKey(this.p.id, c.chunkX, c.chunkY); }
  private put(kind: RecordKind, id: string, tile: WorldCoord, data: any, at = this.simMs): DurableRecord {
    const r: DurableRecord = { id, kind, tile, chunk: this.chunkOf(tile), at, data, receipt: `R${this.nextSeq}` };
    this.records.set(id, r); this.receipts.add(r.receipt); this.nextSeq++; return r;
  }
  /** Idempotent harvest. Same global source id can never grant twice. */
  harvest(sourceId: string, tile: WorldCoord, at = this.simMs) {
    const id = `source:${sourceId}`;
    if (this.records.has(id)) { this.stats.duplicateRejects++; return { ok: false, duplicate: true, reason: 'SOURCE_ALREADY_DEPLETED' }; }
    this.put('source', id, tile, { depleted: true, stock: 0 }, at);
    this.inventory.set('wood', (this.inventory.get('wood') || 0) + 1);
    this.stats.harvested++;
    return { ok: true, duplicate: false, id, receipt: this.records.get(id)!.receipt, inventory: this.inv() };
  }
  /** Idempotent placement. Placed structures survive unload / reload / restart. */
  place(structId: string, kind: string, tile: WorldCoord, at = this.simMs) {
    const id = `struct:${structId}`;
    if (this.records.has(id)) { this.stats.duplicateRejects++; return { ok: false, duplicate: true, reason: 'STRUCT_ALREADY_PLACED' }; }
    const have = this.inventory.get('wood') || 0;
    if (have < 1) return { ok: false, duplicate: false, reason: 'NO_WOOD__NO_MATERIAL_MINTED' };
    this.inventory.set('wood', have - 1);
    this.put('struct', id, tile, { type: kind, hp: 100, owner: 'player' }, at);
    this.stats.placed++;
    return { ok: true, duplicate: false, id, receipt: this.records.get(id)!.receipt, inventory: this.inv() };
  }
  grant(lootId: string, key: string, qty: number, tile: WorldCoord, at = this.simMs) {
    const id = `loot:${lootId}`;
    if (this.records.has(id)) { this.stats.duplicateRejects++; return { ok: false, duplicate: true, reason: 'LOOT_ALREADY_GRANTED' }; }
    this.inventory.set(key, (this.inventory.get(key) || 0) + qty);
    this.put('loot', id, tile, { key, qty }, at);
    this.stats.grants++;
    return { ok: true, duplicate: false, id, receipt: this.records.get(id)!.receipt };
  }
  setMonster(id: string, tile: WorldCoord, data: any) { return this.put('monster', `monster:${id}`, tile, data); }
  setOwnership(id: string, tile: WorldCoord, data: any) { return this.put('ownership', `ownership:${id}`, tile, data); }
  addTrace(id: string, tile: WorldCoord, data: any) { return this.put('trace', `trace:${id}`, tile, data); }
  transact(id: string, tile: WorldCoord, data: any) {
    const tid = `txn:${id}`;
    if (this.records.has(tid)) { this.stats.duplicateRejects++; return { ok: false, duplicate: true }; }
    this.put('txn', tid, tile, data); return { ok: true, duplicate: false, receipt: this.records.get(tid)!.receipt };
  }
  schedule(id: string, due: number, kind: string, data: any) {
    this.delayedEvents.push({ id, due, kind, data, seq: this.nextSeq++ });
  }
  /** Causal, bounded offline catch-up. Never runs every distant creature. */
  offlineCatchUp(nowMs: number, cap = 5000) {
    this.delayedEvents.sort((a, b) => a.due - b.due || a.seq - b.seq);
    let processed = 0, deferred = 0, truncated = 0;
    const keep: DelayedEvent[] = [];
    for (const e of this.delayedEvents) {
      if (e.due > nowMs) { keep.push(e); deferred++; continue; }
      if (processed >= cap) { truncated++; keep.push(e); continue; }
      if (e.kind === 'regrow' && !this.records.has(`source:${e.data.sourceId}`)) {
        // A delayed regrow cannot resurrect a depleted source without an explicit rule.
        keep.push(e); deferred++; continue;
      }
      processed++;
    }
    this.delayedEvents = keep; this.stats.offlineProcessed += processed;
    return { processed, deferred, truncated, cap };
  }
  inv() { return [...this.inventory.entries()].map(([key, qty]) => ({ key, qty })); }
  recordForChunk(cx: number, cy: number, kinds?: RecordKind[]) {
    const key = chunkKey(this.p.id, cx, cy); const out: DurableRecord[] = [];
    for (const r of this.records.values()) if (r.chunk === key && (!kinds || kinds.includes(r.kind))) out.push(r);
    return out;
  }
  serialize(player: any): LwSave {
    return {
      schema: 'soh.lw01.save.v1', version: LW_SAVE_VERSION,
      profileId: this.p.id, profileW: this.p.w, profileH: this.p.h,
      mapHead: 'f0c2182bd2ec5e067f5c59cf3985dcf71856cdb1',
      gameplayHead: 'e11a9b4471a0832cd6d039b5510725b10ee0275c',
      sourceRevision: this.p.sourceRevision,
      savedAt: Date.now(), simMs: this.simMs, seed: this.seed,
      player: { x: player.x, y: player.y, hp: player.hp, stamina: player.stamina, hunger: player.hunger, thirst: player.thirst, warmth: player.warmth, active: player.active, dir: player.dir },
      inventory: this.inv(), records: [...this.records.values()], receipts: [...this.receipts],
      delayedEvents: this.delayedEvents, nextSeq: this.nextSeq, stats: { ...this.stats },
    };
  }
  static deserialize(save: LwSave, p: WorldProfile): DurableStore | null {
    if (!save || save.schema !== 'soh.lw01.save.v1' || save.version !== LW_SAVE_VERSION) return null;
    if (save.profileId !== p.id || save.profileW !== p.w || save.profileH !== p.h) return null;
    const s = new DurableStore(p, save.seed || 0);
    s.simMs = save.simMs || 0; s.nextSeq = save.nextSeq || 1;
    s.inventory = new Map((save.inventory || []).map(i => [i.key, i.qty]));
    for (const r of save.records || []) s.records.set(r.id, r);
    for (const x of save.receipts || []) s.receipts.add(x);
    s.delayedEvents = (save.delayedEvents || []).slice();
    s.stats = { ...s.stats, ...(save.stats || {}) };
    return s;
  }
}

/** Legacy 200x200 saves are NEVER rewritten. Informational read-only inspection. */
export function inspectLegacySave(raw: string | null) {
  if (!raw) return { present: false, preserved: true, note: 'No legacy save present; nothing to wipe.' };
  try {
    const j = JSON.parse(raw);
    return { present: true, preserved: true, version: j.version ?? j.revision ?? null,
      hasRun: !!j.run, stride: 200,
      note: 'Legacy save inspected READ-ONLY. New pilot uses a separate storage key; legacy 200x200 stride/run is untouched.' };
  } catch { return { present: true, preserved: true, note: 'Legacy save unparseable; left untouched.' }; }
}
/** Read-only inspection of ALL known legacy 200x200 storage keys. The real
 *  current Gameplay key is `soh.state.v3` (persist.ts LS), not `soh.save.v3`. */
export function inspectLegacySaves() {
  const out: Record<string, ReturnType<typeof inspectLegacySave>> = {};
  if (typeof localStorage === 'undefined') return out;
  for (const k of LEGACY_SAVE_KEYS) {
    try { const raw = localStorage.getItem(k); if (raw !== null) out[k] = inspectLegacySave(raw); } catch { /* storage unavailable */ }
  }
  return out;
}
/** Explicit profile-scoped persistence validator (exact stride, no 200 constant). */
export function validateLwSave(save: LwSave, p: WorldProfile): string[] {
  const e: string[] = [];
  if (save.profileW !== p.w || save.profileH !== p.h) e.push(`profile dims ${save.profileW}x${save.profileH} != ${p.w}x${p.h}`);
  if (save.version !== LW_SAVE_VERSION) e.push('version');
  for (const r of save.records || []) {
    if (!Number.isSafeInteger(r.tile.x) || !Number.isSafeInteger(r.tile.y)) { e.push('non-integer tile ' + r.id); continue; }
    if (r.tile.x < 0 || r.tile.y < 0 || r.tile.x >= p.w || r.tile.y >= p.h) e.push('tile outside frame ' + r.id);
    else {
      const gi = index(p, r.tile.x, r.tile.y);
      if (!Number.isSafeInteger(gi) || gi >= p.w * p.h) e.push('linear index overflow ' + r.id);
    }
    const c = chunkFromTile(p, r.tile.x, r.tile.y);
    if (r.chunk !== chunkKey(p.id, c.chunkX, c.chunkY)) e.push('chunk key mismatch ' + r.id);
  }
  const receipts = new Set<string>();
  for (const x of save.receipts || []) { if (receipts.has(x)) e.push('duplicate receipt ' + x); receipts.add(x); }
  return e;
}
