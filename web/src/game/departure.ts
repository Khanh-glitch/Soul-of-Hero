// MEC-01 R12 — J10 departure readiness (Bible K2: forecast, never omniscience).
// READ-ONLY. Every number is derived from owned inventory/equipment, real structures and stations,
// the real thermal law and the run clock. Nothing here writes state, grants items, rolls survival,
// or schedules anything. Weather is exact only for the CURRENT 9-minute slot; past it, the outlook
// is a bounded conditional (dry / wet), never a call to weatherAt() for a future slot.
import { BAL, HOUR, TILE, WW, type RunState } from './core';
import { ITEMS, STRUCTS, RECIPES, stationBurnable } from './catalog';
import { C, darkness, effTile, homeStatus, isSheltered, isWet, offlineSurvivalEstimate, weatherAt, type HomeCabinetState } from './engine';
import { calendarAt, phaseBoundaryAt } from './calendar';
import { thermalEnv, thermalEvaluate, heaterRows, heatersInReach, coldPartsFor, insulationOf, targetFromParts, fuelItemsMs, coldCrossingMs, thermalStep, coldDamageActive, type HeaterRow, type ThermalEnv } from './thermal';
import { getWorld } from './world';

export const DEPARTURE_VERSION = 'departure-readiness-v1';
/** Bounded read horizon (R12): the lesser of 24 h and the remaining run. */
export const DEPARTURE_HORIZON_MS = 24 * HOUR;
/** Same 1-minute slice cap settle() uses, so the forecast partitions time identically. */
const SLICE_MS = 60000;

export type Scenario = { id: string; label: string; wet: boolean; sheltered: boolean };
export interface ScenarioResult { id: string; label: string; coldInH: number | null; supplyEndH: number | null; warmthAtSupplyEnd: number | null; targetAfterSupply: number | null }

export interface Provenance { source: string[]; scope: string }

export interface DepartureReadiness {
  version: typeof DEPARTURE_VERSION;
  readOnly: true;
  horizonH: number;
  horizonBasis: 'run-remaining' | '24h' | 'ended';
  runEndsInH: number;
  now: {
    provenance: Provenance;
    dead: boolean; warmth: number; target: number; cold: boolean; coldThreshold: number;
    sheltered: boolean; insulation: number; wetNow: boolean; dark: boolean;
    zone: number; tileType: number; tileCold: boolean; seasonCold: string | null;
    knownWeatherSlotEndsInH: number;
    exposures: { id: string; value: number }[];
    hp: number; hunger: number; thirst: number;
  };
  heat: {
    provenance: Provenance;
    heaters: HeaterRow[];
    /** Paid heat, hours from now, when the last in-reach heater stops heating (null: none in reach). */
    fuelLimitH: number | null;
    notHeating: string[];
    nearbyStations: { id: string; name: string; kind: string; queue: number; firstJob: string | null; firstLeftMin: number | null; fuelPaidMin: number; fuelItems: number; freeOutputSlots: number; state: string | null; note: string }[];
    nearbyNone: string | null;
  };
  outlook: {
    provenance: Provenance;
    scenarios: ScenarioResult[];
    /** Earliest and latest cold threshold crossing over the scenarios. null = not inside the horizon. */
    earliestColdH: number | null; latestColdH: number | null; allWithinHorizon: boolean;
    phrase: string;
  };
  home: {
    provenance: Provenance;
    hasHome: boolean; penalty: 'none';
    cabinets: { id: string; tx: number; ty: number; state: HomeCabinetState; hours: number | null; funded: boolean }[];
    damagedStructures: { id: string; name: string; hp: number; maxHp: number; funded: boolean }[];
    roofed: boolean;
  };
  survival: {
    provenance: Provenance;
    hungerH: number; thirstH: number; survivalH: number; scope: string;
  };
  unknown: string[];
  choices: { id: string; text: string; evidence: string }[];
}

const runStartMs = (r: RunState) => r.startedAt - r.qaOffset;
/** Hours as minutes below one hour, so a short window never reads as "0.2–0.2 h". */
export function fmtH(h: number): string { return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h.toFixed(1)} h`; }
/** Same weather-slot grid as sim.settle(): the end of the slot that contains `t`. */
function slotEndAt(r: RunState, t: number): number {
  const slotMs = BAL.weather.slotMinutes * 60000, base = runStartMs(r);
  return base + (Math.floor((t - base) / slotMs) + 1) * slotMs;
}
/** Same season boundary rule as sim.seasonBoundaryAt (next phase start after `t`). */
function nextSeasonAt(r: RunState, t: number): number {
  const cal = calendarAt(r, t); const at = phaseBoundaryAt(r, cal.phaseIndex + 1);
  return at > t ? at : Infinity;
}

interface HeaterTimeline { e: { id: string }; points: number; endMs: number; kind: 'campfire' | 'furnace' }

/** Exact end (ms from now) of paid heating for each in-reach heater, as the same law settle() uses. */
function heaterTimeline(r: RunState, x: number, y: number): HeaterTimeline[] {
  const out: HeaterTimeline[] = [];
  for (const { e, st } of heatersInReach(r, { x, y })) {
    if (!st.active) continue;
    const station = e.station!;
    const pts = st.kind === 'campfire' ? BAL.comfortV1.sources.campfireBurning.score : BAL.comfortV1.sources.furnaceBurning.score;
    if (st.kind === 'campfire') out.push({ e, points: pts, endMs: st.paidMs, kind: 'campfire' });
    else {
      // Furnace heats only while a queued job runs AND burn lasts (jobs run back to back in stepStations).
      const rate = station.upgrade === 'kiln_lining' ? BAL.fuel.linedFurnaceFuelMultiplier : 1;
      const jobsLeft = station.queue.reduce((v, j) => v + Math.max(0, j.left), 0);
      out.push({ e, points: pts, endMs: Math.min(st.paidMs / rate, jobsLeft), kind: 'furnace' });
    }
  }
  return out;
}

export interface ForecastTrace extends ScenarioResult { warmthAtEnd: number }
/** One conditional scenario from `now` to `end`, same slicing and integrator as settle(). Known weather only inside the current slot. */
export function forecastThermal(r: RunState, now: number, end: number, sc: Scenario): ForecastTrace {
  const p = r.player;
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  const zone = getWorld().zone[ty * WW + tx];
  const wetNowSlot = isWet(weatherAt(r, now));
  const slotEnd = slotEndAt(r, now);
  const heaters = heaterTimeline(r, p.x, p.y);
  return simulateScenario(r, now, end, sc, wetNowSlot, slotEnd, heaters, p.warmth, zone, p.x, p.y);
}
function simulateScenario(r: RunState, now: number, end: number, sc: Scenario, wetNowSlot: boolean, slotEnd: number, heaters: HeaterTimeline[], startWarmth: number, zone: number, x: number, y: number): ForecastTrace {
  const thr = BAL.comfortV1.coldThreshold;
  const tileType = effTile(r, Math.floor(x / TILE), Math.floor(y / TILE));
  const torch = !!(C(r, 'inv').slots[r.player.active]?.key === 'torch');
  const insulation = insulationOf(r);
  const envAt = (t: number, wet: boolean, sheltered: boolean): ThermalEnv => thermalEnv(r, { x, y, zone, tileType, wet, dark: darkness(r, t) > 0.45, sheltered, at: t });
  const heatAt = (t: number) => heaters.filter(h => now + h.endMs > t).reduce((v, h) => v + h.points, 0);
  const targetAt = (t: number, wet: boolean) => targetFromParts({ coldParts: coldPartsFor(envAt(t, wet, sc.sheltered)), insulation, heatPoints: heatAt(t), sheltered: sc.sheltered, torch, zone6: zone === 6 }).target;
  const wetAt = (t: number) => (t < slotEnd ? wetNowSlot : sc.wet);
  const supplyEnd = heaters.length ? now + Math.max(...heaters.map(h => h.endMs)) : now;

  let t = now, w = startWarmth, coldAt: number | null = w < thr ? now : null;
  let warmthAtSupplyEnd: number | null = supplyEnd <= now ? w : null;
  // The cold crossing is recorded once; integration continues to `end` so warmthAtEnd is the true state.
  while (t < end) {
    const tgt = targetAt(t, wetAt(t));
    let dt = Math.min(SLICE_MS, end - t, slotEndAt(r, t) - t, nextSeasonAt(r, t) - t);
    for (const h of heaters) if (now + h.endMs > t) dt = Math.min(dt, now + h.endMs - t);
    if (coldAt === null) dt = Math.min(dt, coldCrossingMs(w, tgt));
    if (supplyEnd > t && supplyEnd < t + dt) dt = supplyEnd - t;
    dt = Math.max(dt, 0.001);
    w = thermalStep(w, tgt, dt / 60000);
    t += dt;
    if (warmthAtSupplyEnd === null && supplyEnd > now && t >= supplyEnd - 1e-6) warmthAtSupplyEnd = w;
    // First physical crossing: warmth reaches the threshold. settle()'s damage gate is strict (w < threshold) and
    // can switch on one slice later at an exact tie; the forecast reports the earlier physical instant (safe side).
    if (coldAt === null && w <= BAL.comfortV1.coldThreshold + 1e-9) coldAt = t;
  }
  const after = targetAt(Math.max(now, supplyEnd), wetAt(Math.max(now, supplyEnd)));
  return {
    id: sc.id, label: sc.label, warmthAtEnd: w,
    coldInH: coldAt === null ? null : (coldAt - now) / HOUR,
    supplyEndH: heaters.length ? (supplyEnd - now) / HOUR : null,
    warmthAtSupplyEnd: warmthAtSupplyEnd === null ? null : Math.round(warmthAtSupplyEnd * 10) / 10,
    targetAfterSupply: heaters.length ? Math.round(after * 10) / 10 : null,
  };
}

function stationName(type: string | undefined): string { return (type && STRUCTS[type]?.name) || type || 'Station'; }

/**
 * J10 departure readiness. Read-only, bounded, provenance on every section.
 * Use `now` as the read instant; the forecast starts from the stored warmth and fuel custody.
 */
export function departureReadiness(r: RunState, now: number): DepartureReadiness {
  const p = r.player;
  const expiry = runStartMs(r) + BAL.run.maxRunHours * HOUR;
  const runLeftMs = Math.max(0, expiry - now);
  const horizonMs = Math.min(DEPARTURE_HORIZON_MS, runLeftMs);
  const horizonBasis: DepartureReadiness['horizonBasis'] = runLeftMs <= 0 ? 'ended' : runLeftMs < DEPARTURE_HORIZON_MS ? 'run-remaining' : '24h';
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  const zone = getWorld().zone[ty * WW + tx];
  const tileType = effTile(r, tx, ty);
  const wetNow = isWet(weatherAt(r, now));
  const dark = darkness(r, now) > 0.45;
  const sheltered = isSheltered(r, p.x, p.y);
  const env = thermalEnv(r, { x: p.x, y: p.y, zone, tileType, wet: wetNow, dark, sheltered, at: now });
  const ev = thermalEvaluate(r, env);
  const slotEnd = slotEndAt(r, now);
  const dead = !!p.dead;

  // ---- NOW ------------------------------------------------------------
  const now_ = {
    provenance: { source: ['sim.warmth (stored)', 'thermal.thermalEvaluate (same law as settle)', 'engine.isSheltered (roofRoom)', 'engine.weatherAt(current slot only)', 'engine.darkness'], scope: 'Current instant and the known weather slot only.' },
    dead, warmth: Math.round(p.warmth * 10) / 10, target: Math.round(ev.target * 10) / 10,
    cold: coldDamageActive(p.warmth), coldThreshold: BAL.comfortV1.coldThreshold,
    sheltered, insulation: insulationOf(r), wetNow, dark, zone, tileType, tileCold: env.tileCold,
    seasonCold: env.seasonCold ? `${env.seasonCold.reason} +${env.seasonCold.points}` : null,
    knownWeatherSlotEndsInH: Math.max(0, (slotEnd - now) / HOUR),
    exposures: ev.coldParts.map(c => ({ id: c.id, value: c.value })),
    hp: Math.round(p.hp), hunger: Math.round(p.hunger), thirst: Math.round(p.thirst),
  };

  // ---- HEAT / WORK SUPPLY -----------------------------------------------
  const rows = heaterRows(r, { x: p.x, y: p.y });
  const timeline = heaterTimeline(r, p.x, p.y);
  const fuelLimitH = timeline.length ? Math.max(...timeline.map(h => h.endMs)) / HOUR : null;
  const notHeating: string[] = [];
  for (const row of rows) {
    if (row.status === 'idle_furnace') notHeating.push(`Furnace …${row.id.slice(-4)} is idle (no queued job): not heating, even with fuel.`);
    if (row.status === 'out_of_fuel') notHeating.push(`${row.kind === 'campfire' ? 'Campfire' : 'Furnace'} …${row.id.slice(-4)} has no paid fuel: not heating.`);
    if (row.status === 'blocked_by_wall') notHeating.push(`${row.kind === 'campfire' ? 'Campfire' : 'Furnace'} …${row.id.slice(-4)} is behind a wall: shown, not counted.`);
  }
  const stations = Object.values(r.entities).filter(e => e.kind === 'struct' && e.station && e.type && STRUCTS[e.type] && (e.owner === undefined || e.owner === 'player') && (e.hp ?? 1) > 0)
    .filter(e => Math.hypot(e.x - p.x, e.y - p.y) <= 6 * TILE)
    .sort((a, b) => a.id.localeCompare(b.id)).slice(0, 4);
  const nearbyStations = stations.map(e => {
    const st = e.station!; const job = st.queue[0] ?? null;
    const recipe = job ? (RECIPES[job.recipe]?.out ? ITEMS[RECIPES[job.recipe].out].name : job.recipe) : null;
    const freeOutputSlots = C(r, st.outC).slots.filter(s => !s).length;
    const fuelItems = C(r, st.fuelC).slots.reduce((v, s) => v + (s ? s.qty : 0), 0);
    const fuelPaid = st.burn + fuelItemsMs(r, st.fuelC);
    const needsFuel = ['campfire', 'furnace', 'refinery', 'oil_pump'].includes(STRUCTS[e.type!].station ?? '');
    const note = job === null ? 'no queued job' : needsFuel && fuelPaid <= 0 ? 'queued but no paid fuel: paused' : freeOutputSlots === 0 ? 'output full: paused' : 'queued';
    return { id: e.id, name: stationName(e.type), kind: STRUCTS[e.type!].station ?? 'station', queue: st.queue.length, firstJob: recipe, firstLeftMin: job ? Math.round((job.left / 60000) * 10) / 10 : null, fuelPaidMin: Math.round((fuelPaid / 60000) * 10) / 10, fuelItems, freeOutputSlots, state: st.stateCode ?? null, note };
  });
  const heat = {
    provenance: { source: ['thermal.heatersInReach (owned, in radius, line of sight)', 'station.burn + fuelItemsMs(fuelC)', 'station.queue[0].left and queue total', 'container slots (outC)'], scope: 'Heat counts only while paid fuel burns and a furnace has a queued job. No automatic refuel or restart.' },
    heaters: rows, fuelLimitH, notHeating,
    nearbyStations,
    nearbyNone: stations.length ? null : 'No owned production station within 6 tiles of this position.',
  };

  // ---- OUTLOOK (conditional, bounded) -------------------------------------
  const scenarioDefs: Scenario[] = [
    { id: 'dry', label: 'dry after this slot', wet: false, sheltered },
    { id: 'wet', label: 'wet after this slot', wet: true, sheltered },
  ];
  if (sheltered) {
    scenarioDefs.push({ id: 'dry-shelter-lost', label: 'dry, roof lost', wet: false, sheltered: false });
    scenarioDefs.push({ id: 'wet-shelter-lost', label: 'wet, roof lost', wet: true, sheltered: false });
  }
  const outlookEnd = now + horizonMs;
  const scenarios: ScenarioResult[] = horizonMs > 0 && !dead
    ? scenarioDefs.map(sc => forecastThermal(r, now, outlookEnd, sc))
    : [];
  const crossings = scenarios.map(s => s.coldInH);
  const finite = crossings.filter((c): c is number => c !== null);
  const earliestColdH = p.warmth < BAL.comfortV1.coldThreshold ? 0 : finite.length ? Math.min(...finite) : null;
  const latestColdH = crossings.some(c => c === null) ? null : crossings.length ? Math.max(...(crossings as number[])) : null;
  const outlook = {
    provenance: { source: ['sim.thermalStep / coldCrossingMs (same integrator)', 'calendar phase boundaries (exact)', 'darkness clock (exact)', 'heater timeline (exact paid end)', 'weatherAt for the current slot ONLY; later slots are conditional'], scope: 'Bounded conditional. Not a predicted survival hour.' },
    scenarios, earliestColdH, latestColdH, allWithinHorizon: crossings.every(c => c !== null),
    phrase: dead ? 'Dead: no outlook.' : horizonMs <= 0 ? 'Run has ended: no outlook.'
      : p.warmth < BAL.comfortV1.coldThreshold ? 'Already below the cold threshold.'
      : earliestColdH === null ? `Not below the cold threshold within ${(horizonMs / HOUR).toFixed(1)} h under any listed scenario.`
      : `Cold threshold reached ${fmtH(earliestColdH)} to ${latestColdH === null ? 'beyond the horizon in some scenario' : fmtH(latestColdH)} from now (dry vs wet, roof kept vs lost).`,
  };

  // ---- HOME / CHOICES --------------------------------------------------------
  const hs = homeStatus(r);
  const home = {
    provenance: { source: ['engine.homeStatus (planTerritory authority)', 'structure hp/maxHp', 'engine.isSheltered'], scope: 'Upkeep and decay as currently planned; not a forecast beyond the same plan.' },
    hasHome: hs.cabinets.length > 0, penalty: 'none' as const,
    cabinets: hs.cabinets.map(c => ({ id: c.id, tx: c.tx, ty: c.ty, state: c.state, hours: Number.isFinite(c.hours) ? c.hours : null, funded: c.funded })),
    damagedStructures: hs.structures.filter(s => s.damaged).map(s => ({ id: s.id, name: s.name, hp: s.hp, maxHp: s.maxHp, funded: s.state === 'funded' })),
    roofed: sheltered,
  };

  const survival = offlineSurvivalEstimate(r);
  const survivalBlock = {
    provenance: { source: ['engine.offlineSurvivalEstimate (hunger, thirst, stationary body, no new hazards)'], scope: 'Hunger and thirst only. Not a certified survival hour.' },
    hungerH: survival.hungerHours, thirstH: survival.thirstHours, survivalH: survival.survivalHours,
    scope: 'Stationary, no new hazards. Cold, radiation, fire, monsters, shelter changes or run expiry can end it sooner.',
  };

  // ---- CHOICES (only when state grounds them) ------------------------------
  const choices: DepartureReadiness['choices'] = [];
  // Fuel the player carries that a station would actually burn (same stationBurnable policy).
  const burnableCarried = C(r, 'inv').slots.reduce((v, s) => v + (s && stationBurnable(s.key) ? s.qty : 0), 0);
  for (const row of rows) {
    if (row.status === 'out_of_fuel' && row.paidMs <= 0 && burnableCarried > 0) choices.push({ id: 'refuel-' + row.id, text: `Refuel ${row.kind} …${row.id.slice(-4)} (you carry ${burnableCarried} burnable fuel)`, evidence: 'out_of_fuel in reach' });
    if (row.status === 'burning' && fuelLimitH !== null && fuelLimitH * HOUR < horizonMs) choices.push({ id: 'refuel-before-' + row.id, text: `Paid heat from ${row.kind} …${row.id.slice(-4)} ends inside the horizon: ${burnableCarried ? `you carry ${burnableCarried} burnable fuel` : 'you carry no burnable fuel'}`, evidence: 'burning, paid end in horizon' });
    if (row.status === 'idle_furnace') choices.push({ id: 'queue-job-' + row.id, text: `Furnace …${row.id.slice(-4)} heats only while a job is queued`, evidence: 'idle_furnace in reach' });
  }
  if (!sheltered && outlook.earliestColdH !== null) choices.push({ id: 'move-inside', text: 'Stand under an enclosed roof: shelter is not counted here now', evidence: 'not sheltered; cold reachable in horizon' });
  for (const s of home.damagedStructures) choices.push({ id: 'repair-' + s.id, text: `Repair ${s.name} (${s.hp}/${s.maxHp} HP)`, evidence: 'damaged structure in home plan' });

  const unknown = [
    'Weather after the known slot: dry/wet scenarios only.',
    'Monsters, traps, fire spread, radiation, combat while away.',
    'Roof decay beyond this plan (the roof-lost scenario bounds it).',
    'Furnace output-full pauses: heat counts while a job is queued.',
    'Exact survival hour: not computed, not certified.',
  ];

  return {
    version: DEPARTURE_VERSION, readOnly: true,
    horizonH: horizonMs / HOUR, horizonBasis, runEndsInH: runLeftMs / HOUR,
    now: now_, heat, outlook, home, survival: survivalBlock, unknown, choices,
  };
}
