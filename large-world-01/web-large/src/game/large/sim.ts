/**
 * BOUNDED active simulation. Only chunks in the active sim set are ticked;
 * distant creatures are NOT instantiated or run every frame. Their durable
 * state lives in DurableStore and is reattached when their chunk is acquired.
 */
import type { ChunkStore } from './chunk';
import type { DurableStore } from './state';

export interface SimStats {
  tickedChunks: number; tickedCreatures: number; distantCreatureCount: number;
  deferredEvents: number; processedEvents: number; simMs: number; lastTickMs: number;
}
export interface LocalCreature { id: string; x: number; y: number; hp: number; state: string; homeX: number; homeY: number; chunkKey: string }

export class ActiveSim {
  readonly chunks: ChunkStore; readonly durable: DurableStore;
  private locals = new Map<string, LocalCreature>();
  stats: SimStats = { tickedChunks: 0, tickedCreatures: 0, distantCreatureCount: 0, deferredEvents: 0, processedEvents: 0, simMs: 0, lastTickMs: 0 };
  constructor(chunks: ChunkStore, durable: DurableStore) { this.chunks = chunks; this.durable = durable; }
  /** Reattach persisted monster states for chunks entering the active set. */
  sync() {
    const active = this.chunks.simSet;
    for (const key of [...this.locals.keys()]) {
      if (!active.has(this.locals.get(key)!.chunkKey)) this.locals.delete(key);
    }
    for (const r of this.durable.records.values()) {
      if (r.kind !== 'monster') continue;
      if (!active.has(r.chunk)) { this.stats.distantCreatureCount++; continue; }
      if (!this.locals.has(r.id)) this.locals.set(r.id, { id: r.id, x: r.tile.x * 16 + 8, y: r.tile.y * 16 + 8, hp: r.data.hp ?? 30, state: r.data.state ?? 'idle', homeX: r.tile.x * 16 + 8, homeY: r.tile.y * 16 + 8, chunkKey: r.chunk });
    }
  }
  tick(dtMs: number, playerTileX: number, playerTileY: number) {
    const t0 = performance.now();
    const active = [...this.chunks.simSet];
    this.chunks.updateWindow(playerTileX, playerTileY);
    this.sync();
    let ticked = 0;
    for (const c of this.locals.values()) {
      if (!this.chunks.simSet.has((c as any).chunkKey)) continue;
      // bounded deterministic wander; no global scan, no distant AI
      const dx = playerTileX * 16 - c.x, dy = playerTileY * 16 - c.y;
      if (Math.hypot(dx, dy) < 220) { c.state = 'chase'; c.x += Math.sign(dx) * Math.min(0.35, dtMs / 60); c.y += Math.sign(dy) * Math.min(0.35, dtMs / 60); }
      else c.state = 'idle';
      ticked++;
    }
    this.durable.simMs += dtMs; this.stats.simMs = this.durable.simMs;
    this.stats.tickedChunks = this.chunks.simSet.size; this.stats.tickedCreatures = ticked;
    this.stats.distantCreatureCount = [...this.durable.records.values()].filter(r => r.kind === 'monster' && !this.chunks.simSet.has(r.chunk)).length;
    this.stats.deferredEvents = this.durable.delayedEvents.length;
    this.stats.lastTickMs = performance.now() - t0;
  }
  localsList(): LocalCreature[] { return [...this.locals.values()]; }
  /** One explicit delayed-world event: proven persisted, bounded on catch-up. */
  scheduleRegrow(sourceId: string, tile: { x: number; y: number }, delayMs: number) {
    this.durable.schedule(`regrow:${sourceId}`, this.durable.simMs + delayMs, 'regrow', { sourceId, tile });
  }
  catchUp(nowMs: number) { return this.durable.offlineCatchUp(nowMs); }
}
