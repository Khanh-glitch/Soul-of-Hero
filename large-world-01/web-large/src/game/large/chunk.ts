/**
 * Real chunk streaming: per-chunk lazy materialization, LRU residency, load /
 * unload accounting and a bounded active simulation set. This is NOT just a
 * renderChunk() canvas cache: each chunk owns typed layer arrays and durable
 * source/POI identities resolved from global world coordinates.
 */
import { chunkKey, chunkOrigin, localIndex, chunkFromTile, inFrame } from './coords';
import { sampleAt, type TileSample } from './geometry';
import type { WorldProfile } from './profile';

export interface PlacedNode { lx: number; ly: number; id: string; kind: string; label: string }
export interface WorldChunk {
  key: string; cx: number; cy: number; profileId: string;
  tiles: Uint8Array; biome: Uint8Array; foot: Uint8Array; flags: Uint8Array; elevation: Uint8Array;
  sources: PlacedNode[]; pois: PlacedNode[];
  digest: number; bytes: number;
  bornAt: number; touchedAt: number; materializeMs: number;
  /** Presentation-only cache, keyed by the SAME collision-free chunk key. */
  canvas: HTMLCanvasElement | null; canvasVersion: number;
}
export const FLAG = { WATER: 1, COAST: 2, CLIFF: 4, ROAD: 8, BRIDGE: 16, LAKE: 32, RIVER: 64, MARINE: 128 };

function fnv(bytes: Uint8Array): number {
  let h = 0x811c9dc5; for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); } return h >>> 0;
}
export interface ChunkStats {
  resident: number; residentBytes: number; peakResident: number; peakResidentBytes: number;
  loads: number; unloads: number; evictions: number; uniqueKeysEver: number;
  materializeMsTotal: number; materializeMsMax: number; simSetSize: number;
  canvasCached: number; canvasBytes: number;
}

export class ChunkStore {
  readonly p: WorldProfile;
  readonly chunks = new Map<string, WorldChunk>();
  private order: string[] = [];
  readonly keysEver = new Set<string>();
  stats: ChunkStats = { resident: 0, residentBytes: 0, peakResident: 0, peakResidentBytes: 0, loads: 0, unloads: 0, evictions: 0, uniqueKeysEver: 0, materializeMsTotal: 0, materializeMsMax: 0, simSetSize: 0, canvasCached: 0, canvasBytes: 0 };
  simSet = new Set<string>();
  constructor(p: WorldProfile) { this.p = p; }

  get(cx: number, cy: number): WorldChunk | undefined { return this.chunks.get(chunkKey(this.p.id, cx, cy)); }
  acquire(cx: number, cy: number): WorldChunk {
    const key = chunkKey(this.p.id, cx, cy);
    const hit = this.chunks.get(key);
    if (hit) { hit.touchedAt = performance.now(); this.touch(key); return hit; }
    const t0 = performance.now();
    const S = this.p.chunkSize, N = S * S;
    const tiles = new Uint8Array(N), biome = new Uint8Array(N), foot = new Uint8Array(N), flags = new Uint8Array(N), elevation = new Uint8Array(N);
    const sources: PlacedNode[] = [], pois: PlacedNode[] = [];
    const seenSources = new Set<string>(), seenPois = new Set<string>();
    const o = chunkOrigin(this.p, cx, cy);
    for (let ly = 0; ly < S; ly++) for (let lx = 0; lx < S; lx++) {
      const tx = o.x + lx, ty = o.y + ly;
      const i = localIndex(this.p, lx, ly);
      if (!inFrame(this.p, tx, ty)) { tiles[i] = 0; flags[i] = FLAG.WATER; continue; }
      const s: TileSample = sampleAt(this.p, tx, ty);
      tiles[i] = s.tile; biome[i] = s.biomeCode; foot[i] = s.permissions.foot ? 1 : 0; elevation[i] = s.elevation;
      let f = 0;
      if (s.water) f |= FLAG.WATER; if (s.coast) f |= FLAG.COAST;
      if (s.cliffCandidate >= 2) f |= FLAG.CLIFF; if (s.road) f |= FLAG.ROAD;
      if (s.bridge) f |= FLAG.BRIDGE; if (s.lake) f |= FLAG.LAKE; if (s.river) f |= FLAG.RIVER;
      if (!s.authoredLand && s.marineRegion > 0) f |= FLAG.MARINE;
      flags[i] = f;
      if (s.sourceTile && s.sourceInstanceId && s.sourceKind && !seenSources.has(s.sourceInstanceId)) {
        seenSources.add(s.sourceInstanceId);
        sources.push({ lx, ly, id: s.sourceInstanceId, kind: s.sourceKind, label: s.sourceInstanceId });
      }
      if (s.poiId && !seenPois.has(s.poiId)) { seenPois.add(s.poiId); pois.push({ lx, ly, id: s.poiId, kind: 'poi', label: s.poiId }); }
    }
    const ms = performance.now() - t0;
    const bytes = tiles.byteLength + biome.byteLength + foot.byteLength + flags.byteLength + elevation.byteLength;
    const c: WorldChunk = { key, cx, cy, profileId: this.p.id, tiles, biome, foot, flags, elevation, sources, pois,
      digest: fnv(tiles), bytes, bornAt: t0, touchedAt: t0, materializeMs: ms, canvas: null, canvasVersion: 0 };
    this.chunks.set(key, c); this.keysEver.add(key); this.touch(key);
    this.stats.loads++; this.stats.materializeMsTotal += ms; this.stats.materializeMsMax = Math.max(this.stats.materializeMsMax, ms);
    this.stats.uniqueKeysEver = this.keysEver.size;
    this.enforce();
    this.refreshStats();
    return c;
  }
  private touch(key: string) { const j = this.order.indexOf(key); if (j >= 0) this.order.splice(j, 1); this.order.push(key); }
  /** Deterministic node thinning so source identities are STABLE (never reset). */
  private enforce() {
    const lim = this.p.maxResidentChunks;
    while (this.chunks.size > lim) {
      const victim = this.order.shift(); if (!victim) break;
      if (this.simSet.has(victim)) { this.order.push(victim); continue; }
      const c = this.chunks.get(victim); if (!c) continue;
      this.chunks.delete(victim); this.stats.unloads++; this.stats.evictions++;
      c.canvas = null;
    }
  }
  /** Window of visible chunks + simulation radius. Returns the sim set keys. */
  updateWindow(playerTileX: number, playerTileY: number): string[] {
    const S = this.p.chunkSize, R = this.p.simRadiusChunks;
    const pc = chunkFromTile(this.p, playerTileX, playerTileY);
    const sim: string[] = [];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const cx = pc.chunkX + dx, cy = pc.chunkY + dy;
      const key = chunkKey(this.p.id, cx, cy);
      // Only chunks overlapping the authored frame are materialized.
      const o = chunkOrigin(this.p, cx, cy);
      if (o.x >= this.p.w || o.y >= this.p.h || o.x + S < 0 || o.y + S < 0) continue;
      this.acquire(cx, cy); sim.push(key);
    }
    this.simSet = new Set(sim);
    // Unload anything outside the active set (LRU order is rebuilt by acquire()).
    for (const key of [...this.chunks.keys()]) {
      if (!this.simSet.has(key)) { const c = this.chunks.get(key); this.chunks.delete(key); this.stats.unloads++; if (c) c.canvas = null; }
    }
    this.refreshStats();
    return sim;
  }
  tile(tx: number, ty: number): number {
    const c = chunkFromTile(this.p, tx, ty); const ch = this.get(c.chunkX, c.chunkY);
    if (!ch) return 0; // DEEP outside resident set; collision treats it as blocked
    return ch.tiles[localIndex(this.p, c.localX, c.localY)];
  }
  walkable(tx: number, ty: number): boolean {
    if (!inFrame(this.p, tx, ty)) return false;
    const c = chunkFromTile(this.p, tx, ty); const ch = this.get(c.chunkX, c.chunkY);
    if (!ch) return false;
    return ch.foot[localIndex(this.p, c.localX, c.localY)] === 1;
  }
  sample(tx: number, ty: number) { return inFrame(this.p, tx, ty) ? sampleAt(this.p, tx, ty) : null; }
  refreshStats() {
    let bytes = 0, canvas = 0, cb = 0;
    for (const c of this.chunks.values()) { bytes += c.bytes; if (c.canvas) { canvas++; cb += c.canvas.width * c.canvas.height * 4; } }
    this.stats.resident = this.chunks.size; this.stats.residentBytes = bytes;
    this.stats.peakResident = Math.max(this.stats.peakResident, this.stats.resident);
    this.stats.peakResidentBytes = Math.max(this.stats.peakResidentBytes, bytes);
    this.stats.simSetSize = this.simSet.size;
    this.stats.canvasCached = canvas; this.stats.canvasBytes = cb;
  }
  keys(): string[] { return [...this.chunks.keys()]; }
}
