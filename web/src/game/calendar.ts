// CAL-01 — world_calendar_v1: the single authoritative two-year / eight-season world calendar.
//
// Creator law (Bible §0.1c D-FINAL-02, CREATOR_LOCKED 2026-11-08):
//   * one run = 336 REAL hours including offline time (BAL.run.maxRunHours, LOCKED_CANON);
//   * those 336 hours contain about two in-world years, two cycles of
//     Spring -> Summer -> Autumn -> Winter == eight consecutive seasons;
//   * the eight equal phases of 336 h are the NOMINAL implementation parameter
//     (42 real h/season). Only the phase length is provisional; the 336 h run,
//     the final 72 h Ragnarok window and the season order may not be changed here;
//   * day/night length and the amplitude of each region's climate impact are
//     still "[CẦN ĐO]" — they are TUNABLE_BALANCE in balance.v1.json, never canon;
//   * the calendar advances through online AND offline time with one chronology,
//     survives save/reload and is deterministic from the run clock. A login must
//     never reset the season and no skill may move the run clock.
//
// Design rules obeyed here:
//   1. NO second timer. Every value is a pure function of the existing run clock
//      fields `startedAt`, `qaOffset` and the caller's `now` (engine.runElapsedMs
//      delegates to `runClockMs` below, so there is exactly one formula).
//   2. Nothing is granted. The only persisted calendar record is a derived
//      observation ledger ("which phase has already been announced"), so a
//      replay, a reload or a repeated Continue can never repeat a season event.
//   3. Map owns geography and climate. This module never invents a biome, a tile
//      or a temperature; it applies a documented seasonal DEVIATION to the
//      Map-owned `temperature`/`moisture` fields and derives bounded effects.
//      Spring is the neutral reference season (deviation 0), so the amplitude
//      measured for comfortV1 / garden tuning keeps its baseline.
//
// This file is pure TypeScript with no DOM and no engine import (engine imports
// this module, never the other way round).
import { BAL, HOUR, T, WW, WH, clamp, type RunState } from './core';
import { getWorld } from './world';

export const CALENDAR_VERSION = 'world_calendar_v1' as const;
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASON_ORDER: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'] as const;
/** Same union as engine's `Weather`; declared here so this module stays engine-free. */
export type PrecipWeather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog';
export type Precipitation = 'none' | 'rain' | 'snow';

// ---------------------------------------------------------------- run clock

/** The ONE run-clock formula. `at - startedAt + qaOffset`, clamped at 0 so a
 * client clock that is behind `startedAt` can never produce a negative season,
 * a negative phase or a "pre-run" reward. */
export const runClockMs = (r: Pick<RunState, 'startedAt' | 'qaOffset'>, at: number) =>
  Math.max(0, at - r.startedAt + r.qaOffset);

/** Nominal season length in real hours (provisional implementation parameter). */
export function phaseHours(): number { return BAL.calendar.phaseHours; }
export function phaseMs(): number { return BAL.calendar.phaseHours * HOUR; }
/** Number of phases in a run (two in-world years x four seasons). */
export function phaseCount(): number { return BAL.calendar.years * SEASON_ORDER.length; }

// ---------------------------------------------------------------- calendar state

export interface CalendarState {
  version: typeof CALENDAR_VERSION;
  /** Clamped run-clock elapsed ms that produced this state. */
  elapsedMs: number;
  /** In-world year, 1-based (two in-world years per run). */
  year: 1 | 2;
  /** 0..7 across the run: year-major, season-minor. */
  phaseIndex: number;
  /** 0..3 within `year`. */
  phaseInYear: 0 | 1 | 2 | 3;
  season: Season;
  /** Elapsed/remaining ms inside the current phase. */
  phaseElapsedMs: number;
  phaseRemainingMs: number;
  /** Absolute ms wall-clock time at which this phase started (run-clock anchored). */
  phaseStartedAt: number;
  /** True inside the final BAL.run.ragnarokFinalHours of the FIXED run clock. */
  ragnarok: boolean;
}

export function seasonOfPhase(phaseIndex: number): Season {
  return SEASON_ORDER[((phaseIndex % SEASON_ORDER.length) + SEASON_ORDER.length) % SEASON_ORDER.length];
}

/** Calendar identity at any run-clock instant. Pure, total and monotone. */
export function calendarAt(r: Pick<RunState, 'startedAt' | 'qaOffset'>, at: number): CalendarState {
  const ms = runClockMs(r, at);
  const len = phaseMs();
  const count = phaseCount();
  const raw = Math.floor(ms / len);
  const phase = Math.min(count - 1, Math.max(0, raw));
  const inYear = (phase % SEASON_ORDER.length) as 0 | 1 | 2 | 3;
  const year = (Math.min(BAL.calendar.years, Math.floor(phase / SEASON_ORDER.length) + 1)) as 1 | 2;
  const phaseElapsedMs = ms - phase * len;
  const runMs = BAL.run.maxRunHours * HOUR;
  return {
    version: CALENDAR_VERSION,
    elapsedMs: ms,
    year,
    phaseIndex: phase,
    phaseInYear: inYear,
    season: seasonOfPhase(phase),
    phaseElapsedMs,
    phaseRemainingMs: Math.max(0, len - phaseElapsedMs),
    phaseStartedAt: r.startedAt - r.qaOffset + phase * len,
    ragnarok: ms >= runMs - BAL.run.ragnarokFinalHours * HOUR,
  };
}

/** Absolute run-clock instant of a phase boundary (phase `index` starts here). */
export function phaseBoundaryAt(r: Pick<RunState, 'startedAt' | 'qaOffset'>, index: number): number {
  return r.startedAt - r.qaOffset + index * phaseMs();
}

export interface SeasonTransition { at: number; phaseIndex: number; year: 1 | 2; season: Season }

/** Genuine boundary transitions inside `(fromAt, toAt]`, in chronological order.
 * This is the only source of season-change events; it never reports the phase a
 * caller started in, so a partition cannot re-announce a season. */
export function seasonTransitionsBetween(r: Pick<RunState, 'startedAt' | 'qaOffset'>, fromAt: number, toAt: number): SeasonTransition[] {
  if (!(toAt > fromAt)) return [];
  const len = phaseMs(), count = phaseCount();
  const fromMs = runClockMs(r, fromAt), toMs = runClockMs(r, toAt);
  const out: SeasonTransition[] = [];
  const first = Math.floor(fromMs / len) + 1;
  const last = Math.min(count - 1, Math.floor(toMs / len));
  for (let k = first; k <= last; k++) {
    out.push({ at: phaseBoundaryAt(r, k), phaseIndex: k, year: (Math.floor(k / SEASON_ORDER.length) + 1) as 1 | 2, season: seasonOfPhase(k) });
  }
  return out;
}

/** Typed event contract for other owners (A0/A3/Map/UI/AVFX). Presentation may
 * render these; nothing may mint currency, items or enemies from them. */
export interface CalendarEventV1 {
  version: typeof CALENDAR_VERSION;
  kind: 'season.begin';
  at: number;              // exact boundary instant (absolute ms, run-clock derived)
  phaseIndex: number;
  year: 1 | 2;
  season: Season;
  ragnarok: boolean;
  /** SOH_PROVISIONAL label so a consumer never mistakes this for a canon value. */
  evidence: 'SOH_PROVISIONAL';
}
export function calendarEventV1(r: Pick<RunState, 'startedAt' | 'qaOffset'>, t: SeasonTransition): CalendarEventV1 {
  const runMs = BAL.run.maxRunHours * HOUR;
  return {
    version: CALENDAR_VERSION, kind: 'season.begin', at: t.at, phaseIndex: t.phaseIndex, year: t.year, season: t.season,
    ragnarok: t.at - r.startedAt + r.qaOffset >= runMs - BAL.run.ragnarokFinalHours * HOUR,
    evidence: 'SOH_PROVISIONAL',
  };
}

// ------------------------------------------------------- persisted ledger
/** Derived observation ledger. It is NOT a second time authority: `observedPhase`
 * is a high-water mark of announced boundaries, validated against the clock on
 * load. It carries no reward and can be recomputed at any time. */
export interface CalendarLedgerV1 {
  version: typeof CALENDAR_VERSION;
  observedPhase: number;
  observedAt: number;
}

/** One explicit policy for every stored calendar record.
 *  - absent (pre-season save): reconstruct from the clock, announce nothing, grant nothing;
 *  - well formed and non-future: keep;
 *  - malformed / ahead of the clock / from another version: discard and rebuild from the clock.
 * A corrupt season field therefore never resets the run, never grants and never
 * skips a future boundary (it can only re-anchor the observation high-water mark). */
export function normalizeCalendarLedger(raw: unknown, r: Pick<RunState, 'startedAt' | 'qaOffset'>, at: number): { ledger: CalendarLedgerV1; changed: boolean; reason?: string } {
  const derived = calendarAt(r, at).phaseIndex;
  const base = (phase: number, obsAt: number): CalendarLedgerV1 => ({ version: CALENDAR_VERSION, observedPhase: phase, observedAt: obsAt });
  if (raw === undefined || raw === null) return { ledger: base(derived, at), changed: true, reason: 'absent' };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ledger: base(derived, at), changed: true, reason: 'malformed' };
  const v = raw as Partial<CalendarLedgerV1>;
  if (v.version !== CALENDAR_VERSION) return { ledger: base(derived, at), changed: true, reason: 'version' };
  const phase = v.observedPhase as number, obsAt = v.observedAt as number;
  if (!Number.isInteger(phase) || phase < 0 || phase > phaseCount() - 1) return { ledger: base(derived, at), changed: true, reason: 'phase' };
  if (typeof obsAt !== 'number' || !Number.isFinite(obsAt) || obsAt < r.startedAt - r.qaOffset) return { ledger: base(derived, at), changed: true, reason: 'observedAt' };
  // A record cannot have observed an instant the run has not reached yet. Re-anchor it
  // to the clock instead of honouring it (a future ledger would skip real boundaries).
  if (obsAt > at) return { ledger: base(derived, at), changed: true, reason: 'observedAt-future' };
  // A ledger may lag the clock (the boundary has not been committed yet) but it may
  // never claim a phase the run clock has not reached: that would skip a real event.
  if (phase > calendarAt(r, obsAt).phaseIndex) return { ledger: base(calendarAt(r, obsAt).phaseIndex, obsAt), changed: true, reason: 'ahead-of-clock' };
  return { ledger: { version: CALENDAR_VERSION, observedPhase: phase, observedAt: obsAt }, changed: false };
}

// ------------------------------------------------------- seasonal climate
export interface LocalClimate {
  version: 'seasonal-climate-v1';
  phaseIndex: number;
  year: 1 | 2;
  season: Season;
  biome: string;
  /** Map-owned ground truth (never modified by this module). */
  mapTemperature: number;
  mapMoisture: number;
  /** Map value + documented seasonal deviation, clamped to the Map's own 0..1 range. */
  temperature: number;
  moisture: number;
  weather: PrecipWeather;
  precipitation: Precipitation;
  /** Liquid precipitation actually reaching the ground here (snow is not rain). */
  wet: boolean;
  snowing: boolean;
  /** Extra SYS15-C03 cold exposure points (bounded, 0 in the neutral season). */
  coldPoints: number;
  coldReason: string | null;
  /** Water demand from summer heat/dryness: >= 1, applied to thirst drain. */
  thirstMultiplier: number;
  /** Plot/barrel water loss multiplier (>= 1 in hot dry seasons). */
  evaporationMultiplier: number;
  /** Fraction of precipitation a plot/barrel actually catches (0 while snowing). */
  catchMultiplier: number;
  /** Footprint decay multiplier for this local precipitation + terrain. */
  traceDecayMultiplier: number;
}

const climateCache = new Map<string, LocalClimate>();
const CLIMATE_CACHE_MAX = 4096;

/** Bounded seasonal climate at one tile at one run-clock instant.
 *  Deterministic: same (map cell, phase, weather) -> same result. The Map's own
 *  `temperature`/`moisture`/`biome` arrays remain the only ground truth. */
export function climateAt(r: Pick<RunState, 'startedAt' | 'qaOffset'>, tx: number, ty: number, at: number, weather: PrecipWeather, surface?: number): LocalClimate {
  const cal = calendarAt(r, at);
  const w = getWorld();
  const x = clamp(Math.floor(tx), 0, WW - 1), y = clamp(Math.floor(ty), 0, WH - 1);
  const key = `${w.economyMap.id}#${w.economyMap.revision}|${y * WW + x}|${cal.phaseIndex}|${weather}|${surface ?? '-'}`;
  const hit = climateCache.get(key);
  if (hit) return hit;
  const m = w.economyMap, i = y * WW + x;
  const cfg = BAL.seasonClimateV1;
  const mapTemperature = m.temperature[i], mapMoisture = m.moisture[i];
  const dT = cfg.temperatureOffset[cal.season] ?? 0, dM = cfg.moistureOffset[cal.season] ?? 0;
  const temperature = clamp(mapTemperature + dT, 0, 1);
  const moisture = clamp(mapMoisture + dM, 0, 1);

  // Precipitation phase: the global weather family decides whether the sky gives
  // anything; the season's own cold deviation and the LOCAL Map temperature decide
  // whether it lands as rain or snow. A neutral (spring) phase can never snow, so the
  // measured spring baseline — rain-filled barrels, rain-cooled soil, rain-washed
  // footprints — is preserved exactly. Cold seasons snow first on Map-cold cells.
  const snowing = (weather === 'rain' || weather === 'storm') && dT < 0 && temperature < cfg.snowTemperatureBelow;
  const liquid = (weather === 'rain' || weather === 'storm') && !snowing;
  const precipitation: Precipitation = snowing ? 'snow' : liquid ? 'rain' : 'none';

  // Cold exposure. Two independent factors, both bounded:
  //  * how much the season really drops temperature below its neutral value
  //    (`drop` is exactly 0 in the neutral season, so spring keeps the measured
  //    comfort baseline byte-for-byte), and
  //  * how cold the LOCAL Map cell actually becomes (a Frostcrown snow cell and a
  //    warm sand coast are not the same winter even in the same season).
  // The product is the reason two regions behave differently in the same season.
  const drop = Math.max(0, -dT);
  const dropRatio = clamp(drop / Math.max(1e-6, cfg.cold.fullDeviation), 0, 1);
  const coldSeverity = clamp((cfg.cold.comfortReference - temperature) / cfg.cold.comfortReference, 0, 1);
  const coldPoints = Math.round(cfg.cold.maxPoints * coldSeverity * dropRatio * 10) / 10;

  // Water demand (SYS15-C01/C03). The seasonal harshness term is exactly 0 in the
  // neutral season, so the measured thirst baseline is never silently retuned; the
  // local term makes a dry sand coast and a wet fen diverge in the same summer.
  const harshness = clamp(
    (Math.max(0, dT) / Math.max(1e-6, cfg.heat.temperatureSpan)) +
    (Math.max(0, -dM) / Math.max(1e-6, cfg.heat.moistureSpan)), 0, 1);
  const localDry = clamp((cfg.heat.dryReference - moisture) / cfg.heat.dryReference, 0, 1);
  const localWarm = clamp((temperature - cfg.heat.warmReference) / (1 - cfg.heat.warmReference), 0, 1);
  const heat = harshness * clamp((localDry + localWarm) / 2, 0, 1);
  const thirstMultiplier = 1 + cfg.heat.maxThirstBonus * heat;
  const evaporationMultiplier = 1 + cfg.heat.maxEvaporationBonus * heat;

  const traceCfg = cfg.traces;
  const baseTrace = precipitation === 'snow' ? traceCfg.snowfallDecayMult
    : weather === 'storm' ? BAL.traces.stormDecayMult
    : weather === 'rain' && liquid ? BAL.traces.rainDecayMult
    : 1;
  // A footprint is cut into the surface it was left on (`surface`), which for a print is
  // the trace's own `s`, not whatever the Map currently renders on that cell.
  const tile = surface ?? w.tiles[i];
  const snowSurface = tile === T.SNOW || tile === T.ICE;
  // Fresh snow buries bare ground prints but preserves prints already cut into a
  // snow/ice surface (the mechanism the existing BAL.traces.snowfallSnowMult key names).
  const traceDecayMultiplier = precipitation === 'snow' && snowSurface ? baseTrace / BAL.traces.snowfallSnowMult : baseTrace;

  const out: LocalClimate = {
    version: 'seasonal-climate-v1', phaseIndex: cal.phaseIndex, year: cal.year, season: cal.season,
    biome: m.biome[i], mapTemperature, mapMoisture, temperature, moisture, weather, precipitation,
    wet: liquid, snowing,
    coldPoints, coldReason: coldPoints > 0 ? `season_cold_${cal.season}_${m.biome[i]}` : null,
    thirstMultiplier, evaporationMultiplier,
    catchMultiplier: liquid ? 1 : 0,
    traceDecayMultiplier,
  };
  if (climateCache.size > CLIMATE_CACHE_MAX) climateCache.clear();
  climateCache.set(key, out);
  return out;
}

/** Convenience for callers that hold a world position instead of a tile. */
export function climateAtPx(r: Pick<RunState, 'startedAt' | 'qaOffset'>, x: number, y: number, at: number, weather: PrecipWeather): LocalClimate {
  return climateAt(r, Math.floor(x / 16), Math.floor(y / 16), at, weather);
}

/** Per-crop seasonal suitability (SOH_PROVISIONAL). Sunroot wants the hot season;
 * Bitterleaf tolerates the cold better. This is the competing-output axis of
 * SYS15-C10 ("no magical universal crop"). */
export function cropSeasonFactor(season: Season, crop: 'crop' | 'herb'): number {
  const table = BAL.seasonClimateV1.growth;
  const f = crop === 'herb' ? table.herb[season] : table.crop[season];
  return clamp(f ?? 1, BAL.seasonClimateV1.growthMinFactor, 2);
}

/** Weather probability weights for the current season (spring == the existing
 * BAL.weather.weights, so the neutral season keeps its measured schedule). */
export function seasonWeatherWeights(season: Season): Record<PrecipWeather, number> {
  const table = BAL.weather.seasonWeights?.[season];
  return (table ?? BAL.weather.weights) as Record<PrecipWeather, number>;
}

export function weatherSeasonOf(r: Pick<RunState, 'startedAt' | 'qaOffset'>, at: number): Season {
  return calendarAt(r, at).season;
}

// ------------------------------------------------------- read model
/** Typed read-only view for UI/AVFX owners. Contains no authority and grants nothing. */
export interface CalendarViewV1 {
  version: typeof CALENDAR_VERSION;
  state: CalendarState;
  /** Human-readable label; presentation only. */
  label: string;
  /** Fraction of the whole 336 h run already elapsed (0..1). */
  runProgress: number;
  /** Local climate at the supplied tile, if one was supplied. */
  climate: LocalClimate | null;
}
const SEASON_LABEL: Record<Season, string> = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
export function seasonLabel(s: Season): string { return SEASON_LABEL[s]; }
export function calendarView(r: Pick<RunState, 'startedAt' | 'qaOffset'>, at: number, tile?: { tx: number; ty: number }, weather: PrecipWeather = 'clear'): CalendarViewV1 {
  const state = calendarAt(r, at);
  return {
    version: CALENDAR_VERSION, state,
    label: `Year ${state.year} · ${seasonLabel(state.season)}`,
    runProgress: clamp(state.elapsedMs / (BAL.run.maxRunHours * HOUR), 0, 1),
    climate: tile ? climateAt(r, tile.tx, tile.ty, at, weather) : null,
  };
}

// --------------------------------------------- cross-owner typed contracts
/** A0 (native SaveService / authoritative clock) obligations. This Web module
 * already satisfies the Web half; A0 must mirror the SAME formula and the SAME
 * single-clock rule rather than introduce a second season timer. */
export interface CalendarClockContractV1 {
  version: typeof CALENDAR_VERSION;
  /** Canonical run-clock formula. `qaOffset` moves elapsed run time, never wall time. */
  elapsedMs: '(now - startedAt + qaOffset), clamped at 0';
  /** Fixed, may not be changed by any skill or season tuning. */
  runHours: number;
  ragnarokFinalHours: number;
  /** Provisional: 8 equal phases inside the fixed run clock. */
  phaseHours: number;
  phaseCount: number;
  order: readonly Season[];
  /** Derived-data policy for saved calendar records (see normalizeCalendarLedger). */
  persistencePolicy: 'derived-from-clock; ledger is observation-only; corrupt/absent records rebuilt without grant or reset';
}

/** A3 (canonical economic source/cost authority) obligations: this module only
 * REPORTS seasonal physical conditions. It never sets a price, a recipe or a yield. */
export interface CalendarEconomyContractV1 {
  version: typeof CALENDAR_VERSION;
  /** What A3 may consume from the calendar without re-deriving climate. */
  provides: ('season' | 'phaseIndex' | 'year' | 'phaseRemainingMs' | 'cropSeasonFactor' | 'evaporationMultiplier' | 'catchMultiplier' | 'thirstMultiplier' | 'coldPoints')[];
  /** Seasonal multipliers remain TUNABLE_BALANCE, not source prices. */
  values: 'SOH_PROVISIONAL / TUNABLE_BALANCE only';
  /** Must not: create seasonal market prices, free seasonal stock or automatic replanting. */
  forbidden: string[];
}

/** Map / Veyra owner obligations: the Map stays the only climate authority. */
export interface CalendarMapContractV1 {
  version: typeof CALENDAR_VERSION;
  /** Read-only Map fields this module consumes; it never writes them. */
  consumes: ('economyMap.biome' | 'economyMap.temperature' | 'economyMap.moisture' | 'tiles')[];
  /** Season changes the DEVIATION applied to Map values; it never repaints geography. */
  mutation: 'none';
  /** Requested from Map: authored, per-region climate amplitude once measured. */
  requested: string[];
}

export const CALENDAR_CLOCK_CONTRACT: CalendarClockContractV1 = {
  version: CALENDAR_VERSION,
  elapsedMs: '(now - startedAt + qaOffset), clamped at 0',
  runHours: BAL.run.maxRunHours,
  ragnarokFinalHours: BAL.run.ragnarokFinalHours,
  phaseHours: BAL.calendar.phaseHours,
  phaseCount: BAL.calendar.years * SEASON_ORDER.length,
  order: SEASON_ORDER,
  persistencePolicy: 'derived-from-clock; ledger is observation-only; corrupt/absent records rebuilt without grant or reset',
};
export const CALENDAR_ECONOMY_CONTRACT: CalendarEconomyContractV1 = {
  version: CALENDAR_VERSION,
  provides: ['season', 'phaseIndex', 'year', 'phaseRemainingMs', 'cropSeasonFactor', 'evaporationMultiplier', 'catchMultiplier', 'thirstMultiplier', 'coldPoints'],
  values: 'SOH_PROVISIONAL / TUNABLE_BALANCE only',
  forbidden: [
    'seasonal market prices or sale multipliers (A3 owns source/cost authority)',
    'free seasonal stock, seeds, fuel or currency at a season boundary',
    'automatic replanting without funded seeds, water and station ownership',
  ],
};
export const CALENDAR_MAP_CONTRACT: CalendarMapContractV1 = {
  version: CALENDAR_VERSION,
  consumes: ['economyMap.biome', 'economyMap.temperature', 'economyMap.moisture', 'tiles'],
  mutation: 'none',
  requested: [
    'authored per-region climate amplitude [CẦN ĐO] instead of the provisional global deviation',
    'authored lake/river freezing and depth data before any frozen-water traversal is enabled',
  ],
};
