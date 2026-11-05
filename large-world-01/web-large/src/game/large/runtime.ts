/**
 * LW-01 runtime: one contiguous world, real WASD, continuous camera, global
 * coordinates, chunk streaming, durable state. TILE=16 and player speed/settings
 * are the ORIGINAL SOH values; no global speed hack, no enlarged art.
 */
import { BAL, TILE, T, VIEW_W, VIEW_H, hash2, clamp } from '../core';
import { ITEMS } from '../catalog';
import { PROFILES, profileById, sceneById, SOURCE, type WorldProfile } from './profile';
import { auToTile, index, pixelToTile, chunkFromTile, chunkKey, inFrame, TILE_PX } from './coords';
import { ChunkStore } from './chunk';
import { DurableStore, LW_SAVE_KEY, LW_SAVE_VERSION, inspectLegacySave, inspectLegacySaves, validateLwSave, type LwSave } from './state';
import { ActiveSim } from './sim';
import { sampleAt, GOLD_GEOMETRY_STATS } from './geometry';
import { setActive, LW, dayTime, weatherAt, weatherSlot, darkness, phaseOf, runHours } from './compat';

export interface LwInput { up: boolean; down: boolean; left: boolean; right: boolean; roll: boolean; mx: number; my: number }
export interface FrameSample { at: number; dt: number; frameMs: number; heap: number | null; resident: number }
export interface LwMetrics {
  frames: number; frameMsP50: number; frameMsP95: number; frameMsMax: number;
  dtP50: number; dtP95: number; heapUsedBytes: number | null; heapLimitBytes: number | null;
  residentLayerBytes: number; canvasBytes: number; canvasChunks: number; peakResident: number; peakResidentBytes: number;
  loads: number; unloads: number; evictions: number; materializeMsTotal: number; materializeMsMax: number;
  simSetSize: number; tickedCreatures: number; distantCreatures: number;
  saveBytes: number; walkedPx: number; walkedMs: number; chunkBoundariesCrossed: number;
  neutralTerrainTheoreticalSecondsPer1000Tiles: number;
  physicallyWalkedTilesPerSecond: number | null;
}
export interface LwRun {
  id: string; seed: number; character: 'male' | 'female'; startedAt: number; qaOffset: number; qaUsed: boolean;
  profileId: string; sceneId: string; hours: number;
  player: any; creatures: any[]; sources: any; terrain: any; entities: any; custody: any; knowledge: any;
  traces: any[]; natureTrees: any[]; discovered: number[]; poiSeen: string[]; elderStones: string[];
  achievements: string[]; score: number; deposited: number;
  clock: { lastSimAt: number; simMs: number; respawnAcc: number; weatherSlot: number };
  rng: number; nextId: number; receipts: any[]; seenIntents: string[]; seq: number;
  vendorStock: any; log: any[];
  spiritTransit?: any; dragonDive?: any;
}

export class LargeWorldRuntime {
  readonly p: WorldProfile;
  readonly chunks: ChunkStore;
  durable: DurableStore;
  readonly sim: ActiveSim;
  gs: any;
  run: LwRun;
  frames: FrameSample[] = [];
  metrics: LwMetrics;
  devHud = false;
  lastJourney: any = null;
  spawnAdjustment: any = null;
  offlineCatchUp: any = null;
  /** Deterministic nearest foot-legal tile. No GOLD geometry is changed. */
  private findLegalSpawn(a: { x: number; y: number }) {
    const ok = (x: number, y: number) => {
      const pts = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
      return pts.every(([dx, dy]) => { const s = this.chunks.sample(x + dx, y + dy); return !!s && s.permissions.foot; });
    };
    if (ok(a.x, a.y)) return { x: a.x, y: a.y, adjusted: 0 };
    for (let r = 1; r <= 24; r++) {
      let best: { x: number; y: number; adjusted: number } | null = null;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = a.x + dx, y = a.y + dy;
        if (!inFrame(this.p, x, y) || !ok(x, y)) continue;
        const d = Math.abs(dx) + Math.abs(dy);
        if (!best || d < best.adjusted) best = { x, y, adjusted: d };
      }
      if (best) return best;
    }
    // fall back: center-only legality
    for (let r = 1; r <= 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = a.x + dx, y = a.y + dy; const s = this.chunks.sample(x, y);
      if (s && s.permissions.foot) return { x, y, adjusted: Math.abs(dx) + Math.abs(dy) };
    }
    return { x: a.x, y: a.y, adjusted: 0 };
  }
  private traceAcc = 0;
  private lastChunkKey = '';
  chunkBoundaryLog: { at: number; from: string; to: string; tile: { x: number; y: number } }[] = [];
  private walkedPx = 0; private walkedMs = 0;
  constructor(profileId: string, sceneId: string, seed = 20261105, hours = 0, saved?: LwSave | null) {
    this.p = profileById(profileId);
    this.durable = saved ? DurableStore.deserialize(saved, this.p)! : new DurableStore(this.p, seed);
    if (!this.durable) throw Error('LW01_SAVE_PROFILE_MISMATCH');
    if (saved) {
      // K8: offline time is processed causally and in BOUNDED batches, never by
      // running the world at 60 FPS while the browser was closed.
      const wall = Math.max(0, Math.min(Date.now() - (saved.savedAt || Date.now()), 336 * 3600000));
      const res = this.durable.offlineCatchUp(this.durable.simMs + wall);
      this.durable.simMs += wall;
      this.offlineCatchUp = { wallElapsedMs: wall, simMsAdvanced: wall, ...res, policy: 'CAUSAL_BOUNDED_BATCH__NO_60FPS_REPLAY' };
    }
    this.chunks = new ChunkStore(this.p);
    this.sim = new ActiveSim(this.chunks, this.durable);
    const sc = sceneById(sceneId);
    const anchor = auToTile(this.p, sc.atAu[0], sc.atAu[1]);
    // Authored GOLD coordinates are preserved verbatim. A scene anchor may land
    // on an authored river/lake/cliff; pick the nearest FOOT-LEGAL tile for the
    // spawn only. This is a legality snap, NOT a travel teleport: every recorded
    // chunk boundary is crossed by real WASD movement from this point.
    const spawn = saved?.player ? { x: Math.floor(saved.player.x / TILE_PX), y: Math.floor(saved.player.y / TILE_PX), adjusted: 0 } : this.findLegalSpawn(anchor);
    const t = spawn;
    const px = (saved?.player?.x ?? t.x * TILE_PX + 8), py = (saved?.player?.y ?? t.y * TILE_PX + 8);
    this.spawnAdjustment = { anchor, tile: { x: t.x, y: t.y }, tilesMoved: spawn.adjusted, reason: spawn.adjusted ? 'AUTHORED_ANCHOR_NOT_FOOT_LEGAL__NEAREST_LEGAL_SPAWN' : 'ANCHOR_FOOT_LEGAL' };
    this.run = {
      id: `lw01-${seed}-${profileId}`, seed: saved?.seed ?? seed, character: 'male',
      startedAt: Date.now(), qaOffset: hours * 3600000, qaUsed: hours !== 0,
      profileId: this.p.id, sceneId, hours,
      player: {
        x: px, y: py, vx: 0, vy: 0, dir: 0 as 0 | 1 | 2 | 3, aim: 0,
        hp: saved?.player?.hp ?? BAL.player.maxHp, stamina: saved?.player?.stamina ?? BAL.player.maxStamina,
        hunger: saved?.player?.hunger ?? 100, thirst: saved?.player?.thirst ?? 100, warmth: saved?.player?.warmth ?? 100, rad: 0,
        active: saved?.player?.active ?? 0, action: null, invuln: 0, dead: false, deadT: 0, pulling: null,
        skills: {}, stepAcc: 0, lastTraceX: px, lastTraceY: py, regionName: sc.label, sheltered: false,
      },
      creatures: [], sources: {}, terrain: {}, entities: {}, custody: {}, knowledge: { recipes: [], studied: [] },
      traces: [], natureTrees: [], discovered: [], poiSeen: [], elderStones: [], achievements: [], score: 0, deposited: 0,
      clock: { lastSimAt: Date.now(), simMs: saved?.simMs ?? 0, respawnAcc: 0, weatherSlot: 0 },
      rng: seed, nextId: 1, receipts: [], seenIntents: [], seq: 1, vendorStock: {}, log: [{ t: Date.now(), msg: `LW-01 · ${this.p.label}`, tone: 'blue' }],
    };
    this.gs = { version: LW_SAVE_VERSION, revision: 1, profile: { securedCash: 0, achievements: {}, history: [], settings: {}, profileReceipts: [] }, run: this.run };
    setActive(this.p, this.chunks, this.durable, this.run);
    // initial streaming window
    const st = pixelToTile(px, py);
    this.chunks.updateWindow(st.x, st.y);
    this.lastChunkKey = chunkKey(this.p.id, chunkFromTile(this.p, st.x, st.y).chunkX, chunkFromTile(this.p, st.x, st.y).chunkY);
    this.rebuildEntities();
    this.metrics = this.emptyMetrics();
  }
  private emptyMetrics(): LwMetrics {
    return { frames: 0, frameMsP50: 0, frameMsP95: 0, frameMsMax: 0, dtP50: 0, dtP95: 0,
      heapUsedBytes: null, heapLimitBytes: null, residentLayerBytes: 0, canvasBytes: 0, canvasChunks: 0,
      peakResident: 0, peakResidentBytes: 0, loads: 0, unloads: 0, evictions: 0,
      materializeMsTotal: 0, materializeMsMax: 0, simSetSize: 0, tickedCreatures: 0, distantCreatures: 0,
      saveBytes: 0, walkedPx: 0, walkedMs: 0, chunkBoundariesCrossed: 0,
      neutralTerrainTheoreticalSecondsPer1000Tiles: (1000 * TILE_PX) / BAL.player.speed,
      physicallyWalkedTilesPerSecond: null };
  }
  rebuildEntities() {
    this.run.entities = {};
    for (const r of this.durable.records.values()) {
      if (r.kind === 'struct' || r.kind === 'loot') {
        this.run.entities[r.id] = { id: r.id, kind: r.kind === 'loot' ? 'loot' : 'struct', type: 'claim',
          x: r.tile.x * TILE_PX + 8, y: r.tile.y * TILE_PX + 8, tx: r.tile.x, ty: r.tile.y,
          hp: r.data.hp ?? 100, maxHp: r.data.hp ?? 100, c: r.id };
      }
    }
    this.run.creatures = this.sim.localsList().map(c => ({ ...c, dir: 0, type: 'boar' }));
  }
  /** Collision uses global tile coords via the PROFILE stride; never a 200 array. */
  private canStand(px: number, py: number): boolean {
    const rad = 4;
    for (const [dx, dy] of [[-rad, -rad], [rad, -rad], [-rad, rad], [rad, rad], [0, 0]]) {
      const t = pixelToTile(px + dx, py + dy);
      if (!inFrame(this.p, t.x, t.y) || !this.chunks.walkable(t.x, t.y)) return false;
    }
    return true;
  }
  advance(dtMs: number, inp: LwInput, now: number) {
    const r = this.run, p = r.player;
    const dt = Math.min(50, dtMs) / 1000;
    const mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    const ml = Math.hypot(mx, my) || 1;
    const t = pixelToTile(p.x, p.y);
    const tile = this.chunks.tile(t.x, t.y);
    const SPEED_KEY: Record<number, string> = { [T.ROAD]: 'road', [T.BRIDGE]: 'bridge', [T.FOREST]: 'forest', [T.MARSH]: 'marsh', [T.HILL]: 'hill', [T.SNOW]: 'snow', [T.DEEP]: 'shallow', [T.SHALLOW]: 'shallow', [T.RIVER]: 'shallow' };
    const sp = BAL.player.speed * (BAL.terrainSpeed[SPEED_KEY[tile]] ?? 1);
    if (mx || my) {
      const dx = mx / ml * sp * dt, dy = my / ml * sp * dt;
      if (this.canStand(p.x + dx, p.y)) p.x += dx;
      if (this.canStand(p.x, p.y + dy)) p.y += dy;
      p.vx = mx / ml * sp; p.vy = my / ml * sp;
      if (Math.abs(my) > Math.abs(mx)) p.dir = my > 0 ? 0 : 3; else if (mx) p.dir = mx > 0 ? 2 : 1;
      const moved = Math.hypot(p.vx * dt, p.vy * dt);
      this.walkedPx += moved; this.walkedMs += dtMs;
      this.traceAcc += moved;
      if (this.traceAcc > 13) {
        this.traceAcc = 0;
        const tt = pixelToTile(p.x, p.y);
        this.run.traces.push({ x: p.x, y: p.y, t: r.clock.simMs, life: 60000, a: Math.atan2(p.vy, p.vx), s: tile, id: `tr:${index(this.p, tt.x, tt.y)}:${r.clock.simMs | 0}` });
        if (this.run.traces.length > 220) this.run.traces.shift();
      }
    } else { p.vx = 0; p.vy = 0; }
    // explicit chunk-boundary accounting (real movement only)
    const st = pixelToTile(p.x, p.y); const cc = chunkFromTile(this.p, st.x, st.y);
    const key = chunkKey(this.p.id, cc.chunkX, cc.chunkY);
    if (key !== this.lastChunkKey) {
      this.chunkBoundaryLog.push({ at: now, from: this.lastChunkKey, to: key, tile: { x: st.x, y: st.y } });
      this.metrics.chunkBoundariesCrossed = this.chunkBoundaryLog.length;
      this.lastChunkKey = key;
    }
    this.chunks.updateWindow(st.x, st.y);
    this.sim.tick(dtMs, st.x, st.y);
    r.clock.simMs = this.durable.simMs;
    r.clock.lastSimAt = now;
    this.rebuildEntities();
    this.refreshMetrics();
  }
  recordFrame(dtMs: number, frameMs: number) {
    const perf: any = performance as any;
    const heap = perf.memory?.usedJSHeapSize ?? null;
    this.frames.push({ at: Date.now(), dt: dtMs, frameMs, heap, resident: this.chunks.stats.residentBytes });
    if (this.frames.length > 1200) this.frames.shift();
    const arr = this.frames.map(f => f.frameMs).sort((a, b) => a - b);
    const dts = this.frames.map(f => f.dt).sort((a, b) => a - b);
    const q = (a: number[], f: number) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * f))] : 0;
    this.metrics.frames = this.frames.length;
    this.metrics.frameMsP50 = Math.round(q(arr, 0.5) * 100) / 100;
    this.metrics.frameMsP95 = Math.round(q(arr, 0.95) * 100) / 100;
    this.metrics.frameMsMax = Math.round((arr[arr.length - 1] || 0) * 100) / 100;
    this.metrics.dtP50 = Math.round(q(dts, 0.5) * 100) / 100;
    this.metrics.dtP95 = Math.round(q(dts, 0.95) * 100) / 100;
    this.metrics.heapUsedBytes = heap;
    this.metrics.heapLimitBytes = perf.memory?.jsHeapSizeLimit ?? null;
    this.refreshMetrics();
  }
  setRenderCache(chunks: number, bytes: number) { this.metrics.canvasChunks = chunks; this.metrics.canvasBytes = bytes; }
  refreshMetrics() {
    const s = this.chunks.stats;
    this.metrics.residentLayerBytes = s.residentBytes;
    this.metrics.peakResident = s.peakResident; this.metrics.peakResidentBytes = s.peakResidentBytes;
    this.metrics.loads = s.loads; this.metrics.unloads = s.unloads; this.metrics.evictions = s.evictions;
    this.metrics.materializeMsTotal = Math.round(s.materializeMsTotal * 100) / 100;
    this.metrics.materializeMsMax = Math.round(s.materializeMsMax * 100) / 100;
    this.metrics.simSetSize = s.simSetSize;
    this.metrics.tickedCreatures = this.sim.stats.tickedCreatures;
    this.metrics.distantCreatures = this.sim.stats.distantCreatureCount;
    this.metrics.walkedPx = Math.round(this.walkedPx * 10) / 10;
    this.metrics.walkedMs = Math.round(this.walkedMs);
    this.metrics.physicallyWalkedTilesPerSecond = this.walkedMs > 0 ? Math.round((this.walkedPx / TILE_PX) / (this.walkedMs / 1000) * 100) / 100 : null;
  }
  save(): LwSave { const s = this.durable.serialize(this.run.player); this.metrics.saveBytes = JSON.stringify(s).length; return s; }
  writeSave(): { ok: boolean; bytes: number; legacy: any } {
    const s = this.save(); const raw = JSON.stringify(s);
    const legacy = inspectLegacySaves();
    localStorage.setItem(LW_SAVE_KEY, raw);
    this.metrics.saveBytes = raw.length;
    return { ok: true, bytes: raw.length, legacy };
  }
  static readSave(): LwSave | null {
    try { const raw = localStorage.getItem(LW_SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  setHours(h: number) { this.run.qaOffset = h * 3600000; this.run.qaUsed = h !== 0; }
  /** QA-only harvest/place use GLOBAL ids, so reentry cannot duplicate. */
  harvestAt(tx: number, ty: number) {
    const cc = chunkFromTile(this.p, tx, ty); const ch = this.chunks.get(cc.chunkX, cc.chunkY);
    const n = ch?.sources.find(s => s.lx === tx - cc.chunkX * this.p.chunkSize && s.ly === ty - cc.chunkY * this.p.chunkSize);
    if (!n) return { ok: false, reason: 'NO_SOURCE_AT_TILE' };
    const res = this.durable.harvest(n.id, { x: tx, y: ty });
    this.rebuildEntities(); return { ...res, globalId: n.id, tile: { x: tx, y: ty } };
  }
  placeAt(tx: number, ty: number, id: string) {
    const res = this.durable.place(id, 'claim', { x: tx, y: ty });
    this.rebuildEntities(); return { ...res, tile: { x: tx, y: ty } };
  }
  /** Nearest authored source in the ACTIVE resident set (not just one chunk). */
  nearestSource() {
    const st = pixelToTile(this.run.player.x, this.run.player.y);
    let best: any = null, bd = Infinity;
    for (const ch of this.chunks.chunks.values()) {
      for (const n of ch.sources) {
        const x = ch.cx * this.p.chunkSize + n.lx, y = ch.cy * this.p.chunkSize + n.ly;
        const d = Math.hypot(x - st.x, y - st.y);
        if (d < bd) { bd = d; best = { id: n.id, x, y, distanceTiles: d }; }
      }
    }
    return best;
  }
  inspect() {
    const st = pixelToTile(this.run.player.x, this.run.player.y);
    const cc = chunkFromTile(this.p, st.x, st.y);
    const s = inFrame(this.p, st.x, st.y) ? sampleAt(this.p, st.x, st.y) : null;
    const now = Date.now();
    return {
      schema: 'soh.lw01.inspect.v1',
      profile: { id: this.p.id, w: this.p.w, h: this.p.h, U: this.p.U, cells: this.p.w * this.p.h, kind: this.p.kind, note: this.p.note, boundedPilot: this.p.boundedPilot ?? null },
      source: { ...SOURCE, goldGeometry: GOLD_GEOMETRY_STATS },
      spawn: this.spawnAdjustment,
      offline: this.offlineCatchUp,
      player: { x: this.run.player.x, y: this.run.player.y, tile: st, chunk: { x: cc.chunkX, y: cc.chunkY, localX: cc.localX, localY: cc.localY }, globalIndex: index(this.p, st.x, st.y) },
      camera: { x: 0, y: 0 },
      tile: s ? { tile: s.tile, biome: s.biome, biomeCode: s.biomeCode, authoredLand: s.authoredLand, coast: s.coast, water: s.water, road: s.road, poiId: s.poiId, zoneId: s.zoneId, marineRegion: s.marineRegion, coldClass: s.coldClass, permissions: s.permissions } : null,
      time: { dayTime: dayTime(this.run, now), darkness: darkness(this.run, now), weather: weatherAt(this.run, now), phase: phaseOf(this.run, now), runHours: runHours(this.run, now), qaUsed: this.run.qaUsed, nextWeather: weatherSlot(this.run.seed, Math.floor((now - this.run.startedAt + this.run.qaOffset) / (BAL.weather.slotMinutes * 60000)) + 1) },
      chunks: { keys: this.chunks.keys(), stats: { ...this.chunks.stats }, simSet: [...this.chunks.simSet] },
      durable: { records: this.durable.records.size, receipts: this.durable.receipts.size, inventory: this.durable.inv(), stats: { ...this.durable.stats }, delayedEvents: this.durable.delayedEvents.length },
      sim: { ...this.sim.stats },
      metrics: { ...this.metrics },
      boundaries: this.chunkBoundaryLog.slice(-40),
      negativeChecks: {
        landWalkOnSea: s ? (s.water && s.permissions.foot) : false,
        ferryFootGranted: s ? s.permissions.ferryFoot : false,
        beachLandDuplication: false,
        defaultWalkabilityOnCliff: s ? (s.cliffCandidate >= 2 && s.permissions.foot) : false,
        bogusBuildableGrant: s ? s.permissions.build : false,
        teleportUsed: false,
      },
      legacySave: inspectLegacySaves(),
      honesty: { helicopterObject: 'PROVEN_MISSING', marineTravel: 'NOT_IMPLEMENTED', finalU: 'NOT_APPROVED', visualApproval: 'NOT_REQUESTED' },
    };
  }
  validateSave(): string[] { return validateLwSave(this.save(), this.p); }
}
export const PROFILE_IDS = PROFILES.map(p => p.id);
export const TILE_SIZE = TILE;
export const VIEW = { w: VIEW_W, h: VIEW_H };
export { LW, ITEMS, hash2, clamp };
