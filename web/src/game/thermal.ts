// Shared physical thermal evaluator (B03 Deliverable A).
// Used by live tickSurvival() and by bounded offline settle(). It reads only real
// structures, real station burn/fuel custody, real equipment and real geometry.
// Balance: BAL.comfortV1 (SOH_PROVISIONAL unless the source note says otherwise).
import { BAL, T, dist, type Entity, type RunState } from './core';
import { ITEMS, STRUCTS } from './catalog';
import { C, owned, clearSegment } from './engine';

export type HeaterKind = 'campfire' | 'furnace';

export interface HeaterStatus {
  id: string;
  kind: HeaterKind;
  active: boolean;
  /** burning | out_of_fuel | idle (furnace without a running job) */
  code: 'burning' | 'out_of_fuel' | 'idle';
  /** Paid burn remaining in ms (station burn + stored fuel items). */
  paidMs: number;
}

export interface ThermalEnv {
  x: number; y: number;
  zone: number;
  tileType: number;
  wet: boolean;
  dark: boolean;
  sheltered: boolean;
  torch: boolean;
  tileCold: boolean; // snow tile or zone 5 or water: legacy ambient cold tile test
}

export interface ThermalEval {
  target: number;
  base: number;
  coldParts: { id: string; value: number }[];
  cold: number;
  insulation: number;
  heat: { raw: number; sources: { id: string; kind: HeaterKind; points: number; code: string }[] };
  shelterPoints: number;
  bonus: number;
  torch: boolean;
  zone6: boolean;
  /** Human-readable reason lines, in order of importance. */
  reasons: string[];
}

const K = () => BAL.comfortV1;

/** Paid fuel ms stored in a container's fuel items (same unit as station.burn). */
export function fuelItemsMs(r: RunState, cid: string): number {
  return C(r, cid).slots.reduce((v, s) => v + (s && ITEMS[s.key].fuel ? ITEMS[s.key].fuel! * 1000 * s.qty : 0), 0);
}

/** A campfire or furnace with paid fuel custody is "burning" only when it can actually heat. */
export function heaterStatus(r: RunState, e: Entity): HeaterStatus | null {
  const def = e.type ? STRUCTS[e.type] : undefined; const st = e.station;
  if (!def || !def.warmth || !st || e.kind !== 'struct') return null;
  const kind = def.station as HeaterKind; if (kind !== 'campfire' && kind !== 'furnace') return null;
  const paidMs = st.burn + fuelItemsMs(r, st.fuelC);
  const base = { id: e.id, kind, paidMs };
  if (kind === 'furnace') {
    const job = st.queue[0];
    if (!job || job.left <= 0) return { ...base, active: false, code: 'idle' };
  }
  if (paidMs <= 0) return { ...base, active: false, code: 'out_of_fuel' };
  return { ...base, active: true, code: 'burning' };
}

/** Only real, owned, living, in-range heaters with a line of sight (no solid wall between) count. */
export function heatersInReach(r: RunState, env: { x: number; y: number }): { e: Entity; st: HeaterStatus }[] {
  const out: { e: Entity; st: HeaterStatus }[] = [];
  for (const e of Object.values(r.entities)) {
    if (e.kind !== 'struct' || !e.station || !e.type || !STRUCTS[e.type]?.warmth) continue;
    if (!owned(e) || (e.hp ?? 0) <= 0) continue;
    if (dist(e.x, e.y, env.x, env.y) >= K().sources.campfireBurning.radiusPx) continue;
    const st = heaterStatus(r, e); if (!st) continue;
    if (!clearSegment(r, env, e)) continue;
    out.push({ e, st });
  }
  return out;
}

export function thermalEnv(r: RunState, env: Omit<ThermalEnv, 'torch' | 'tileCold'> & { torch?: boolean }): ThermalEnv {
  const torch = env.torch ?? (C(r, 'inv').slots[r.player.active]?.key === 'torch');
  const tileCold = env.zone === 5 || env.tileType === SNOW_TILE || env.tileType === SHALLOW_TILE || env.tileType === RIVER_TILE;
  return { ...env, torch, tileCold };
}
const SNOW_TILE = T.SNOW, SHALLOW_TILE = T.SHALLOW, RIVER_TILE = T.RIVER;

/** Physical target Warmth for this instant. Same rule online and offline. */
export function thermalEvaluate(r: RunState, env: ThermalEnv): ThermalEval {
  const c = K(); const reasons: string[] = [];
  const coldParts: { id: string; value: number }[] = [];
  if (env.zone === 5 || env.tileType === SNOW_TILE) coldParts.push({ id: 'snow_zone', value: 9 });
  if (env.dark) coldParts.push({ id: 'darkness', value: 2.5 });
  if (env.wet) coldParts.push({ id: 'wet_weather', value: 3 });
  if (env.tileType === SHALLOW_TILE || env.tileType === RIVER_TILE) coldParts.push({ id: 'water', value: 4 });
  const cold = coldParts.reduce((v, p) => v + p.value, 0);
  // Worn cold-protection gear (legacy insulation/3 multiplier, unchanged).
  let insulation = 0; for (const s of C(r, 'eq').slots) if (s) insulation += ITEMS[s.key].cold || 0;
  const base = 100 - Math.max(0, cold - insulation / 3) * 9;

  const heaters = heatersInReach(r, env).filter(h => h.st.active);
  const sources = heaters.map(({ e, st }) => ({
    id: e.id, kind: st.kind,
    points: st.kind === 'campfire' ? c.sources.campfireBurning.score : c.sources.furnaceBurning.score,
    code: st.code,
  }));
  const heatRaw = sources.reduce((v, s) => v + s.points, 0);
  const shelterPoints = env.sheltered ? c.sources.enclosedShelter.score : 0;
  const raw = heatRaw + shelterPoints;
  const score = Math.min(c.scoreCap, raw);
  const bonus = Math.min(c.targetMaxBonus, score * c.targetPerScore);

  let target = base + bonus;
  if (env.torch) target = Math.min(100, target + 20);
  if (env.zone === 6) target = 100;
  target = Math.max(0, Math.min(100, target));

  for (const s of sources) reasons.push(`${s.kind === 'campfire' ? 'Campfire' : 'Furnace'} burning nearby +${s.points} comfort`);
  if (env.sheltered) reasons.push(`Enclosed roofed shelter +${shelterPoints} comfort`);
  if (!sources.length && !env.sheltered) reasons.push('No heat source in reach: no fire, no shelter');
  for (const p of coldParts) reasons.push(`${p.id.replace('_', ' ')} cold ${p.value}`);
  if (insulation) reasons.push(`Worn cold gear ${insulation}`);
  if (env.torch) reasons.push('Torch held +20');

  return { target, base, coldParts, cold, insulation, heat: { raw: heatRaw, sources }, shelterPoints, bonus, torch: env.torch, zone6: env.zone === 6, reasons };
}

/** Exact exponential approach to the target over `minutes` (same integrator online and offline). */
export function thermalStep(warmth: number, target: number, minutes: number): number {
  if (minutes <= 0) return warmth;
  return target + (warmth - target) * Math.exp(-K().warmthRatePerMin * minutes);
}

/** Ms until warmth crosses the cold threshold under a constant target (or Infinity). */
export function coldCrossingMs(warmth: number, target: number): number {
  const thr = K().coldThreshold; const a = warmth - target, b = thr - target;
  if (a === 0) return Infinity;
  const q = b / a; if (!(q > 0 && q < 1)) return Infinity;
  return (-Math.log(q) / K().warmthRatePerMin) * 60000;
}

/** Earliest physical boundary for the thermal state from `t` (ms): heater exhaustion, job end,
 * or cold-threshold crossing. Offline settle must end its slice here so no heat is double counted. */
export function thermalBoundaryMs(r: RunState, env: ThermalEnv, warmth: number, target: number): number {
  let dt = coldCrossingMs(warmth, target);
  for (const { e, st } of heatersInReach(r, env)) {
    if (!st.active) continue;
    const station = e.station!;
    if (st.kind === 'campfire') dt = Math.min(dt, st.paidMs);
    else {
      const rate = station.upgrade === 'kiln_lining' ? BAL.fuel.linedFurnaceFuelMultiplier : 1;
      dt = Math.min(dt, st.paidMs / rate);
      const job = station.queue[0]; if (job && job.left > 0) dt = Math.min(dt, job.left);
    }
  }
  return Math.max(0.001, dt);
}

/** Warmth-driven cold damage gate (online and offline use this exact predicate). */
export function coldDamageActive(warmth: number): boolean { return warmth < K().coldThreshold; }

