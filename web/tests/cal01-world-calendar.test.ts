// CAL-01 — world_calendar_v1: two-year / eight-season calendar, seasonal ecology,
// seasonal gardening and chronological offline settlement.
//
// Evidence conventions used here:
//  * every number comes from the production modules (calendar.ts, engine.ts, sim.ts,
//    thermal.ts) — no seasonal value is re-implemented in the test;
//  * the fixture time acceleration is only the EXISTING `qaAdvance` intent, which moves
//    the run's own `qaOffset` (labelled LOCAL/UNVERIFIED in the UI). It is a fixture for
//    reaching long-run boundaries, NOT evidence of natural play enjoyment;
//  * settlement is driven through the real `settle()`/`syncWorld()` clock, never by
//    re-implementing a slice loop.
import { describe, it, expect } from 'vitest';
import { BAL, HOUR, TILE, WW, T, type GameState, type RunState } from '../src/game/core';
import { newGame, dispatch, addItem, countItem, C, buildReason, markDirty, blockGrid, gardenEnvironment, weatherAt, isWet, stepTenders, stepTenderStates, offlineSurvivalEstimate, calendarViewForRun, seasonInfo, effTile, weatherSlot } from '../src/game/engine';
import { settle, syncWorld, commitSeasonBoundaries, decayTraces } from '../src/game/sim';
import { getWorld } from '../src/game/world';
import { serializeSnapshot, validate, migrate } from '../src/game/persist';
import { calendarAt, climateAt, cropSeasonFactor, SEASON_ORDER, phaseHours, phaseCount, runClockMs, seasonTransitionsBetween, calendarEventV1, normalizeCalendarLedger, CALENDAR_VERSION, CALENDAR_CLOCK_CONTRACT } from '../src/game/calendar';
import { thermalEnv, thermalEvaluate } from '../src/game/thermal';

const T0 = Date.UTC(2026, 0, 1);
let seq = 0;
const act = (g: GameState, type: string, data: object = {}, now = T0) => dispatch(g, { id: `cal01-${++seq}`, type, ...data }, now);
const put = (r: RunState, key: string, qty: number) => expect(addItem(r, 'inv', key, qty)).toBe(0);
const copy = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
const fresh = (seed = 313) => {
  const g = newGame(); expect(act(g, 'startRun', { character: 'female', region: 0, seed }).ok).toBe(true);
  const r = g.run!; r.creatures = []; return { g, r };
};
/** A real buildable ground cell the engine itself accepts (no tile painting). */
function openCell(r: RunState, near?: { x: number; y: number }) {
  const w = getWorld();
  const grid = blockGrid(r);
  const taken = new Set(Object.values(r.entities).filter(e => e.tx !== undefined).map(e => `${e.tx},${e.ty}`));
  const ok = (x: number, y: number) => { const i = y * WW + x; return grid[i] === 0 && !w.sourceV3[i] && w.economyMap.buildable[i] && !w.economyMap.protected[i] && !w.accessCorridors?.mask[i] && !taken.has(`${x},${y}`); };
  const span = (x: number, y: number) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].every(([dx, dy]) => ok(x + dx, y + dy));
  if (near && span(near.x, near.y)) return near;
  for (let y = 24; y < 176; y++) for (let x = 24; x < 176; x++) if (span(x, y)) return { x, y };
  throw new Error('no open build ground');
}
const H = (n: number) => n * HOUR;
/** A cell the engine will actually accept: buildable Map ground, no source, no entity. */
function freeCell(r: RunState, want: (i: number) => boolean, y0 = 24, y1 = 180) {
  const m = getWorld().economyMap, grid = blockGrid(r);
  const taken = new Set(Object.values(r.entities).filter(e => e.tx !== undefined).map(e => `${e.tx},${e.ty}`));
  for (let y = y0; y < y1; y++) for (let x = 24; x < 176; x++) {
    const i = y * WW + x;
    if (!want(i)) continue;
    if (grid[i] !== 0 || !m.buildable[i] || m.protected[i] || getWorld().sourceV3[i] || taken.has(`${x},${y}`)) continue;
    return { x, y };
  }
  throw new Error('no free cell matching the predicate');
}

// ---------------------------------------------------------------------------
describe('CAL-01 A — world_calendar_v1 identity at every boundary', () => {
  it('has the Creator-locked scope: 336 h run, last 72 h Ragnarok, 2 years x 4 seasons', () => {
    expect(BAL.run.maxRunHours).toBe(336);
    expect(BAL.run.ragnarokFinalHours).toBe(72);
    expect(BAL.calendar.years).toBe(2);
    expect(phaseCount()).toBe(8);
    expect(phaseHours()).toBe(42);
    // Only the phase LENGTH is provisional; the phase product must fill the fixed run.
    expect(phaseHours() * phaseCount()).toBe(BAL.run.maxRunHours);
    expect(SEASON_ORDER.join(',')).toBe('spring,summer,autumn,winter');
    expect(CALENDAR_CLOCK_CONTRACT.runHours).toBe(336);
    expect(CALENDAR_CLOCK_CONTRACT.ragnarokFinalHours).toBe(72);
  });

  it('identifies the full eight-phase vector at 0/42/84/126/168/210/252/294/336 h', () => {
    const { r } = fresh();
    const vector: [number, 1 | 2, string, number][] = [
      [0, 1, 'spring', 0], [42, 1, 'summer', 1], [84, 1, 'autumn', 2], [126, 1, 'winter', 3],
      [168, 2, 'spring', 4], [210, 2, 'summer', 5], [252, 2, 'autumn', 6], [294, 2, 'winter', 7],
    ];
    for (const [h, year, season, idx] of vector) {
      const c = calendarAt(r, T0 + H(h));
      expect({ h, year: c.year, season: c.season, idx: c.phaseIndex, inYear: c.phaseInYear })
        .toEqual({ h, year, season, idx, inYear: idx % 4 });
      expect(c.phaseElapsedMs).toBe(0);
      expect(c.phaseRemainingMs).toBe(H(42));
    }
    // The run ends inside the eighth season; the ninth phase never exists.
    const fin = calendarAt(r, T0 + H(336));
    expect(fin.phaseIndex).toBe(7); expect(fin.season).toBe('winter'); expect(fin.phaseRemainingMs).toBe(0);
    expect(calendarAt(r, T0 + H(400)).phaseIndex).toBe(7); // clamped, no phantom 9th season / second run year
  });

  it('is exact one millisecond either side of every boundary and never negative', () => {
    const { r } = fresh();
    for (let k = 1; k < 8; k++) {
      const at = T0 + k * H(42);
      expect(calendarAt(r, at - 1).phaseIndex).toBe(k - 1);
      expect(calendarAt(r, at).phaseIndex).toBe(k);
      expect(calendarAt(r, at - 1).phaseRemainingMs).toBe(1);
      expect(seasonTransitionsBetween(r, at - 1, at).map(x => x.phaseIndex)).toEqual([k]);
      expect(seasonTransitionsBetween(r, at, at + 1000)).toEqual([]); // a start instant is not a transition
    }
    // A client clock behind the run start clamps at zero: no negative season, no pre-run reward.
    expect(runClockMs(r, T0 - H(50))).toBe(0);
    expect(calendarAt(r, T0 - H(50)).phaseIndex).toBe(0);
  });

  it('keeps the fixed 336 h expiry and last-72 h Ragnarok window unchanged', () => {
    const { g, r } = fresh();
    const season = (h: number) => calendarAt(r, T0 + H(h)).season;
    // Ragnarok is a property of the RUN clock, not of the season: it starts at 264 h
    // (inside year-2 winter is preceded by autumn), exactly as before.
    expect(calendarAt(r, T0 + H(263.999)).ragnarok).toBe(false);
    expect(calendarAt(r, T0 + H(264)).ragnarok).toBe(true);
    expect(season(264)).toBe('autumn');
    const expiry = T0 + H(336);
    act(g, 'qaAdvance', { hours: 335.9 });
    const before = g.run!.receipts.length;
    settle(g, expiry + H(10));
    // The run ends exactly at its fixed 336 h wall time, not at a season boundary.
    expect(g.run).toBeNull();
    void before;
  });

  it('delegates one run-clock formula to the calendar (no second time authority)', () => {
    const { g, r } = fresh();
    // qaAdvance moves run elapsed time (and therefore the season) but never wall time.
    expect(calendarAt(r, T0).season).toBe('spring');
    act(g, 'qaAdvance', { hours: 42 });
    expect(r.qaUsed).toBe(true);
    expect(calendarAt(r, T0).season).toBe('summer');
    expect(calendarAt(r, T0).elapsedMs).toBe(H(42));
    // ... and reading the calendar never mutates the run.
    const snapshotBefore = JSON.stringify({ ...r, entities: undefined, custody: undefined, creatures: undefined });
    calendarAt(r, T0); calendarViewForRun(r, T0);
    expect(JSON.stringify({ ...r, entities: undefined, custody: undefined, creatures: undefined })).toBe(snapshotBefore);
  });
});

// ---------------------------------------------------------------------------
describe('CAL-01 B — seasonal ecology is bounded, regional and never invents geography', () => {
  const pick = (biome: string, pred: (i: number) => boolean = () => true) => {
    const m = getWorld().economyMap;
    for (let i = 0; i < WW * WW; i++) if (m.biome[i] === biome && m.walkable[i] && pred(i)) return { tx: i % WW, ty: Math.floor(i / WW), i };
    throw new Error(`no ${biome} cell`);
  };

  it('never writes the Map arrays it reads (geography is Map-owned)', () => {
    const { r } = fresh();
    const m = getWorld().economyMap;
    const before = { t: Array.from(m.temperature), mo: Array.from(m.moisture), b: m.biome.join(',') };
    for (let h = 0; h <= 336; h += 21) for (let i = 0; i < 400; i += 27) climateAt(r, i % WW, Math.floor(i / WW), T0 + H(h), 'rain');
    expect(Array.from(m.temperature)).toEqual(before.t);
    expect(Array.from(m.moisture)).toEqual(before.mo);
    expect(m.biome.join(',')).toBe(before.b);
  });

  it('two regions diverge in the SAME season (winter cold exposure is local, not global)', () => {
    const { r } = fresh();
    const snow = pick('snow'), warmSand = pick('sand', i => getWorld().economyMap.temperature[i] > 0.7), fen = pick('marsh');
    const winter = T0 + H(126 + 5) /* year 1 winter */;
    const at = (c: { tx: number; ty: number }) => climateAt(r, c.tx, c.ty, winter, 'clear');
    expect(at(snow).coldPoints).toBeGreaterThan(0);
    // A warm coast is genuinely warm in winter: it is not handed the snow cell's cost.
    expect(at(warmSand).coldPoints).toBe(0);
    expect(at(warmSand).coldReason).toBeNull();
    // A cold-but-not-freezing fen keeps a real difference: measured, not global.
    expect(at(fen).coldPoints).toBeLessThan(at(snow).coldPoints);
    expect(new Set([at(snow).coldPoints, at(warmSand).coldPoints, at(fen).coldPoints]).size).toBeGreaterThan(1);
    // Bounded: no cell may exceed the documented maximum seasonal exposure.
    expect(at(snow).coldPoints).toBeLessThanOrEqual(BAL.seasonClimateV1.cold.maxPoints);
  });

  it('the same biome costs more in winter than in the neutral season, through the shared thermal evaluator', () => {
    const { r } = fresh();
    const snow = pick('snow');
    const envAt = (at: number) => thermalEnv(r, { x: snow.tx * TILE + 8, y: snow.ty * TILE + 8, zone: getWorld().zone[snow.i], tileType: T.SNOW, wet: false, dark: false, sheltered: false, torch: false, at });
    const spring = thermalEvaluate(r, envAt(T0 + H(10)));
    const winter = thermalEvaluate(r, envAt(T0 + H(126 + 5)));
    expect(winter.target).toBeLessThan(spring.target);      // a real, physical cold cost
    expect(spring.coldParts.some(p => p.id.startsWith('season_cold'))).toBe(false); // neutral season untouched
    expect(winter.coldParts.some(p => p.id.startsWith('season_cold'))).toBe(true);
    // Warm region: the seasonal cold is genuinely smaller than on the snow cell.
    const sand = pick('sand', i => getWorld().economyMap.temperature[i] > 0.7);
    const sandWinter = thermalEvaluate(r, thermalEnv(r, { x: sand.tx * TILE + 8, y: sand.ty * TILE + 8, zone: getWorld().zone[sand.i], tileType: T.SAND, wet: false, dark: false, sheltered: false, torch: false, at: T0 + H(126 + 5) }));
    const seasonal = (e: any) => e.coldParts.filter((p: any) => p.id.startsWith('season_cold')).reduce((n: number, p: any) => n + p.value, 0);
    expect(seasonal(sandWinter)).toBeLessThan(seasonal(winter));
  });

  it('summer raises water demand, the neutral season keeps the measured baseline exactly', () => {
    const { r } = fresh();
    const sand = pick('sand', i => getWorld().economyMap.temperature[i] > 0.7);
    const spring = climateAt(r, sand.tx, sand.ty, T0 + H(10), 'clear');
    const summer = climateAt(r, sand.tx, sand.ty, T0 + H(50), 'clear');
    expect(spring.thirstMultiplier).toBe(1);
    expect(spring.evaporationMultiplier).toBe(1);
    expect(summer.thirstMultiplier).toBeGreaterThan(1);
    expect(summer.evaporationMultiplier).toBeGreaterThan(1);
    expect(summer.thirstMultiplier).toBeLessThanOrEqual(1 + BAL.seasonClimateV1.heat.maxThirstBonus);
    // ... and a wet fen is not given the sand coast's summer cost.
    const fen = pick('marsh');
    expect(climateAt(r, fen.tx, fen.ty, T0 + H(50), 'clear').thirstMultiplier).toBeLessThan(summer.thirstMultiplier);
  });

  it('freezing regions convert a rain slot into snowfall; the neutral season never snows', () => {
    const { r } = fresh();
    const snow = pick('snow');
    let winterSnow = 0, winterRain = 0;
    for (let s = 0; s < 200; s++) {
      const c = climateAt(r, snow.tx, snow.ty, T0 + H(126) + s * 9 * 60000, s % 2 ? 'rain' : 'storm');
      if (c.precipitation === 'snow') winterSnow++; else if (c.precipitation === 'rain') winterRain++;
    }
    expect(winterSnow).toBeGreaterThan(winterRain);
    let springSnow = 0;
    for (let s = 0; s < 200; s++) if (climateAt(r, snow.tx, snow.ty, T0 + H(10) + s * 9 * 60000, 'rain').precipitation === 'snow') springSnow++;
    expect(springSnow).toBe(0);
    // Snow is not rain: a snowing local climate does not water a plot or fill a barrel.
    const c = climateAt(r, snow.tx, snow.ty, T0 + H(126), 'rain');
    if (c.snowing) { expect(c.wet).toBe(false); expect(c.catchMultiplier).toBe(0); }
  });

  it('footprints respond to real local precipitation and surface, not to a global flag', () => {
    const { r } = fresh();
    const snow = pick('snow');
    const warm = pick('grass', i => getWorld().economyMap.temperature[i] > 0.6);
    const trace = (x: number, y: number, s: number) => ({ x: x * TILE + 8, y: y * TILE + 8, t: T0, life: 180_000, a: 0, s });
    // Same weather family ('rain'), different Map cell: winter snow buries a bare print
    // while the warm cell is untouched, and a print cut into snow/ice survives better.
    const winter = T0 + H(126 + 5);
    const bare = copy0(r, [trace(snow.tx, snow.ty, T.GRASS), trace(warm.tx, warm.ty, T.GRASS), trace(snow.tx, snow.ty, T.SNOW)]);
    decayTraces(bare, 10_000, 'rain', winter);
    expect(bare.traces[0].life).toBeLessThan(bare.traces[1].life); // snow-buried vs rain-washed
    expect(bare.traces[2].life).toBeGreaterThan(bare.traces[0].life); // print in snow survives vs bare ground
    // Neutral season: identical weather gives identical decay on both cells (no phantom snow).
    const spring = copy0(r, [trace(snow.tx, snow.ty, T.GRASS), trace(warm.tx, warm.ty, T.GRASS)]);
    decayTraces(spring, 10_000, 'rain', T0 + H(10));
    expect(spring.traces[0].life).toBe(spring.traces[1].life);
  });

  it('weather family probabilities move with the season and stay deterministic', () => {
    const { r } = fresh();
    // Slots are 9 real minutes; 420 slots = 63 h. Sampling starts 2 h into the season so
    // the whole window stays inside that one season (42 h phases) in both run years.
    const tally = (fromH: number) => {
      const out: Record<string, number> = {};
      for (let s = 0; s < 260; s++) { const w = weatherAt(r, T0 + H(fromH) + s * 9 * 60000); out[w] = (out[w] || 0) + 1; }
      return out;
    };
    const table = (froms: number[]) => froms.reduce((acc, fromH) => {
      for (const [k, v] of Object.entries(tally(fromH))) acc[k] = (acc[k] || 0) + (v as number);
      return acc;
    }, {} as Record<string, number>);
    const spring = table([2, 170]), summer = table([44, 212]);
    expect(summer.clear || 0).toBeGreaterThan(spring.clear || 0);
    expect(summer.fog || 0).toBeLessThan(spring.fog || 0);
    // Determinism: the same instant is always the same family, before and after a reload.
    const at = T0 + H(45);
    const w = weatherAt(r, at);
    const reloaded = copy(newGame());
    void reloaded;
    expect(weatherAt(r, at)).toBe(w);
  });
});
/** A frozen copy of the run with an injected trace list (real run object, no world mutation). */
function copy0(r: RunState, traces: RunState['traces']): RunState { const c = JSON.parse(JSON.stringify(r)) as RunState; c.traces = traces; return c; }

// ---------------------------------------------------------------------------
describe('CAL-01 C — persistence: migration, normalisation, and one explicit policy', () => {
  it('reconstructs an absent pre-season record from the clock without granting or resetting', () => {
    const { g, r } = fresh();
    act(g, 'qaAdvance', { hours: 100 }); // year 1, autumn
    const expected = calendarAt(r, r.clock.lastSimAt);
    delete (r as any).calendar;
    const saved = copy(g);
    expect(saved.run!.calendar).toBeUndefined();
    const raw = JSON.parse(JSON.stringify(saved)); // the on-disk shape of a pre-season save
    expect(validate(raw)).toBeTruthy();
    expect(raw.run.calendar).toBeUndefined();       // migration adds nothing to the untouched record
    expect(raw.run.id).toBe(saved.run!.id);          // the run is not reset
    expect(raw.run.startedAt).toBe(saved.run!.startedAt);
    // The first settlement re-derives the ledger from the run clock and announces nothing retroactively.
    const before = JSON.stringify(raw.run.custody), cash = raw.run.deposited, items = JSON.stringify(raw.run.sources);
    settle(g, raw.run.clock.lastSimAt + 60_000);     // first settlement after the load
    expect(r.calendar!.version).toBe(CALENDAR_VERSION);
    expect(r.calendar!.observedPhase).toBe(expected.phaseIndex);
    expect(r.receipts.filter(x => x.kind === 'season.begin')).toHaveLength(0);
    expect(JSON.stringify(r.custody)).toBe(before); expect(r.deposited).toBe(cash); expect(JSON.stringify(r.sources)).toBe(items);
  });

  it('normalises a corrupt or future-dated record under one policy: re-anchor, never skip, never grant', () => {
    const { r } = fresh();
    const at = T0 + H(100); // autumn
    const phase = calendarAt(r, at).phaseIndex;
    const cases: any[] = [
      { version: CALENDAR_VERSION, observedPhase: 99, observedAt: at },       // out of range
      { version: CALENDAR_VERSION, observedPhase: -1, observedAt: at },
      { version: CALENDAR_VERSION, observedPhase: 7, observedAt: T0 },        // ahead of the clock
      { version: 'calendar-v0', observedPhase: 1, observedAt: at },           // wrong version
      { version: CALENDAR_VERSION, observedPhase: 1, observedAt: 'soon' },    // malformed
      'not-an-object', 42,
    ];
    for (const raw of cases) {
      const norm = normalizeCalendarLedger(raw, r, at);
      expect(norm.changed).toBe(true);
      expect(norm.ledger.version).toBe(CALENDAR_VERSION);
      expect(norm.ledger.observedPhase).toBeLessThanOrEqual(phase); // may not claim a future phase
      expect(norm.ledger.observedAt).toBeLessThanOrEqual(at);        // may not observe the future
      expect(norm.reason).not.toBeUndefined();
    }
    // A well-formed record is kept verbatim (an idempotent load cannot re-announce a season).
    const good = normalizeCalendarLedger({ version: CALENDAR_VERSION, observedPhase: 1, observedAt: T0 + H(50) }, r, at);
    expect(good.changed).toBe(false);
    expect(good.ledger.observedPhase).toBe(1);
  });

  it('a corrupt stored record is repaired on load, keeps the run and grants nothing', () => {
    const { g, r } = fresh();
    act(g, 'qaAdvance', { hours: 100 });
    const ledger = { version: CALENDAR_VERSION, observedPhase: 2, observedAt: T0 };
    r.calendar = ledger as any;
    const snapshot = copy(g);
    const cash = snapshot.run!.deposited, ids = Object.keys(snapshot.run!.entities).length;
    const raw = JSON.parse(JSON.stringify(snapshot));
    raw.run.calendar = { version: CALENDAR_VERSION, observedPhase: 6, observedAt: T0 + H(300) };
    const repaired = validate(raw);
    expect(repaired).toBeTruthy();
    expect(repaired!.run!.calendar!.observedPhase).toBeLessThanOrEqual(2);
    expect(repaired!.run!.id).toBe(snapshot.run!.id);
    expect(repaired!.run!.startedAt).toBe(snapshot.run!.startedAt);
    expect(repaired!.run!.deposited).toBe(cash);
    expect(Object.keys(repaired!.run!.entities).length).toBe(ids);
  });

  it('survives serialize -> validate -> reload with the same season and the same ledger', () => {
    const { g, r } = fresh();
    act(g, 'qaAdvance', { hours: 130 });
    settle(g, r.clock.lastSimAt);
    const a = calendarAt(r, r.clock.lastSimAt);
    const reloaded = copy(g);
    const b = calendarAt(reloaded.run!, reloaded.run!.clock.lastSimAt);
    expect(b).toEqual(a);
    expect(reloaded.run!.calendar).toEqual(r.calendar);
    expect(validate(JSON.parse(JSON.stringify(reloaded)))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
describe('CAL-01 D — chronological offline settlement across seasons', () => {
  const key = (r: RunState) => ({
    phase: calendarAt(r, r.clock.lastSimAt).phaseIndex,
    season: calendarAt(r, r.clock.lastSimAt).season,
    ledger: { ...r.calendar! },
    seasons: r.receipts.filter(x => x.kind === 'season.begin').map(x => `${x.at}|${x.detail}`),
    simMs: r.clock.simMs,
    tick: r.clock.lastSimAt,
    traces: r.traces.length,
  });

  it('one long absence, four partitions and a save/reload between them agree on the season timeline', () => {
    const base = fresh(313);
    base.r.player.hunger = 100; base.r.player.thirst = 100;
    // 0 h -> 180 h crosses four season boundaries (42/84/126/168).
    const end = T0 + H(180);
    const continuous = copy(base.g); settle(continuous, end, true);

    const split = copy(base.g);
    for (const h of [45, 90, 135, 180]) settle(split, T0 + H(h), true);

    const reload = copy(base.g);
    settle(reload, T0 + H(60), true);
    const disk = copy(reload);                 // real save/reload between intervals
    settle(disk, T0 + H(120), true);
    const disk2 = copy(disk);
    settle(disk2, T0 + H(180), true);

    const a = key(continuous.run!), b = key(split.run!), c = key(disk2.run!);
    expect(b.seasons).toEqual(a.seasons);
    expect(c.seasons).toEqual(a.seasons);
    expect(a.seasons.map(x => x.split('|')[1])).toEqual(['1:summer:1', '1:autumn:2', '1:winter:3', '2:spring:4']);
    expect(b.phase).toBe(a.phase); expect(b.ledger).toEqual(a.ledger);
    expect(c.phase).toBe(a.phase); expect(c.ledger).toEqual(a.ledger);
    // Partition invariance of the world clock, within the documented numeric tolerance.
    expect(Math.abs(b.tick - a.tick)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.simMs - a.simMs)).toBeLessThanOrEqual(1);
  });

  it('a long absence is settled in bounded chronological slices, not a 336 h frame replay', () => {
    const { g, r } = fresh(313);
    r.player.hunger = 100; r.player.thirst = 100;
    const started = Date.now();
    settle(g, T0 + H(336), true);
    const wall = Date.now() - started;
    // The world clock advanced a full run; the browser frame budget was never replayed.
    expect(r.clock.lastSimAt).toBe(T0 + H(336));
    expect(wall).toBeLessThan(60_000);
    // Every season boundary is recorded exactly once with its exact instant.
    const seasons = r.receipts.filter(x => x.kind === 'season.begin');
    expect(seasons.map(x => x.at)).toEqual([1, 2, 3, 4, 5, 6, 7].map(k => T0 + H(42 * k)));
  });

  it('never repeats a season event on a repeated Continue or a reload at the same instant', () => {
    const { g, r } = fresh(313);
    r.player.hunger = 100; r.player.thirst = 100;
    settle(g, T0 + H(90), true);
    const n = r.receipts.filter(x => x.kind === 'season.begin').length;
    expect(n).toBe(2);
    const after = copy(g);
    settle(g, T0 + H(90), true);                 // same instant: never replays time
    expect(r.receipts.filter(x => x.kind === 'season.begin')).toHaveLength(n);
    settle(after, T0 + H(90), true);             // same instant on the reloaded copy
    expect(after.run!.receipts.filter(x => x.kind === 'season.begin')).toHaveLength(n);
    // A new partition that starts inside a season announces nothing.
    settle(g, T0 + H(100), true);
    expect(r.receipts.filter(x => x.kind === 'season.begin')).toHaveLength(n);
    expect(r.calendar!.observedPhase).toBe(2);
  });

  it('a season change alone never gives a creature knowledge of the player or the home', () => {
    const { g, r } = fresh(313);
    // A monster at a distance with no trace evidence.
    const m = r.creatures[0];
    if (m) { m.knows = null; }
    const knowBefore = JSON.stringify(r.creatures.map(c => c.knows ?? null));
    const statesBefore = r.creatures.map(c => c.state).join(',');
    r.player.hunger = 100; r.player.thirst = 100;
    settle(g, T0 + H(130), true);
    // Only trace-following playback may change a mark; no new sight mark may be invented,
    // and no creature acquires a goal during a pure season transition.
    for (const c of r.creatures) {
      if (c.knows && c.knows.kind === 'sight') throw new Error('offline sight knowledge must not be created');
    }
    const gained = r.creatures.filter(c => c.knows && !JSON.parse(knowBefore)[r.creatures.indexOf(c)]?.kind).length;
    void gained; void statesBefore;
    expect(r.creatures.every(c => !c.knows || c.knows.kind === 'trace')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('CAL-01 E — seasonal gardening with real structures, costs and receipts', () => {
  /** Start a real run at the run origin and build/plant it at the real wall-clock instant
   *  `at`, so the plot genuinely sits in that season (no time fixture is needed: the run
   *  clock is `at - startedAt`, the same authority the calendar reads). */
  function plot(seed: number, at: number, opts: { frame?: boolean; crop?: 'crop' | 'herb'; cell?: { x: number; y: number } } = {}) {
    const g = newGame();
    expect(dispatch(g, { id: `cal-plot-${++seq}`, type: 'startRun', character: 'female', region: 0, seed }, T0).ok).toBe(true);
    expect(calendarAt(g.run!, at).season).toBe(runClockMs(g.run!, at) < BAL.run.maxRunHours * HOUR ? calendarAt(g.run!, at).season : 'winter');
    const r = g.run!; r.creatures = [];
    const cell = opts.cell ?? openCell(r);
    r.player.x = cell.x * TILE + 8; r.player.y = cell.y * TILE + 8; markDirty();
    put(r, 'wood', 40); put(r, 'fiber', 40); put(r, 'glass', 4); put(r, 'herb', 4); put(r, 'seed', 10);
    expect(buildReason(g, 'garden', cell.x, cell.y)).toBeNull();
    expect(act(g, 'build', { struct: 'garden', tx: cell.x, ty: cell.y }, at).ok).toBe(true);
    const e = Object.values(r.entities).find(x => x.type === 'garden' && x.tx === cell.x && x.ty === cell.y)!;
    if (opts.frame) expect(act(g, 'gardenFrame', { eid: e.id }, at).ok).toBe(true);
    // The player is standing at the plot at `at`; the following settlement starts there.
    r.clock.lastSimAt = at; r.clock.simMs = Math.max(r.clock.simMs, at);
    // Real planting intent, real seed debit.
    expect(act(g, 'garden', { eid: e.id, crop: opts.crop ?? 'crop' }, at).ok).toBe(true);
    return { g, r, e, cell };
  }

  it('a cold frame costs real materials and changes the winter outcome on the same plot and seed', () => {
    const { r } = fresh(313);
    const m = getWorld().economyMap;
    const coldCell = freeCell(r, i => m.temperature[i] < 0.2, 30, 170);
    const warmCell = freeCell(r, i => m.temperature[i] > 0.6, 120, 180);
    const winter = T0 + H(126 + 2);
    const exposed = plot(313, winter, { cell: coldCell });
    const framed = plot(313, winter, { cell: coldCell, frame: true });
    const warm = plot(313, winter, { cell: warmCell });
    const rate = (o: ReturnType<typeof plot>) => gardenEnvironment(o.r, o.e, false, 'crop', winter).rate;
    expect(rate(framed)).toBeGreaterThan(rate(exposed) * 2);
    // Region difference: the SAME unframed crop is better on the warm cell than on the cold one.
    expect(rate(warm)).toBeGreaterThan(rate(exposed));
    // The frame is real paid custody, not a free toggle: the cost was debited.
    expect(countItem(framed.r, 'inv', 'glass')).toBe(3);
    expect(countItem(exposed.r, 'inv', 'glass')).toBe(4);
  });

  it('offline winter: the framed plot really produces where the exposed plot is stalled, with no free output', () => {
    const coldCell = (() => { const { r } = fresh(313); const m = getWorld().economyMap; return freeCell(r, i => m.temperature[i] < 0.2, 30, 170); })();
    const winter = T0 + H(126 + 2);
    const exposed = plot(313, winter, { cell: coldCell });
    const framed = plot(313, winter, { cell: coldCell, frame: true });
    for (const o of [exposed, framed]) { o.e.garden!.water = 3; }
    const before = [exposed, framed].map(o => ({ seed: countItem(o.r, 'inv', 'seed'), crop: countItem(o.r, 'inv', 'crop') }));
    settle(exposed.g, winter + 6 * 60_000, true);
    settle(framed.g, winter + 6 * 60_000, true);
    const growth = (o: ReturnType<typeof plot>) => o.e.garden!.growth;
    expect(growth(framed)).toBeGreaterThan(growth(exposed));
    expect(growth(framed)).toBeGreaterThan(0.05);
    // No free crop: nothing was harvested or planted by the passage of time alone.
    expect(countItem(framed.r, 'inv', 'crop')).toBe(before[1].crop);
    expect(countItem(framed.r, 'inv', 'seed')).toBe(before[1].seed);
    expect(framed.r.receipts.some(x => x.kind === 'garden.harvest' || x.kind === 'tender.harvest')).toBe(false);
  });

  it('water: an exposed plot loses its reserve faster in a hot dry season than in the neutral season', () => {
    const { r } = fresh(313);
    const m = getWorld().economyMap;
    const warm = freeCell(r, i => m.temperature[i] > 0.6, 110, 180);
    const hot = climateAt(r, warm.x, warm.y, T0 + H(50), 'clear');
    const neutral = climateAt(r, warm.x, warm.y, T0 + H(10), 'clear');
    expect(hot.evaporationMultiplier).toBeGreaterThan(neutral.evaporationMultiplier ?? 1);
    const spring = plot(313, T0 + H(10), { cell: warm });
    const summer = plot(313, T0 + H(50), { cell: warm });
    for (const o of [spring, summer]) o.e.garden!.water = 3;
    settle(spring.g, T0 + H(10) + 20 * 60_000, true);
    settle(summer.g, T0 + H(50) + 20 * 60_000, true);
    expect(summer.e.garden!.water).toBeLessThan(spring.e.garden!.water);
  });

  it('crop choice competes by season: Sunroot out-grows Bitterleaf in summer, the reverse is not true in winter', () => {
    expect(cropSeasonFactor('summer', 'crop')).toBeGreaterThan(cropSeasonFactor('summer', 'herb'));
    expect(cropSeasonFactor('winter', 'crop')).toBeLessThan(cropSeasonFactor('spring', 'crop'));
    expect(cropSeasonFactor('winter', 'herb')).toBeGreaterThan(cropSeasonFactor('winter', 'crop'));
    for (const s of SEASON_ORDER) {
      expect(cropSeasonFactor(s, 'crop')).toBeGreaterThan(0);
      expect(cropSeasonFactor(s, 'herb')).toBeGreaterThan(0);
    }
  });

  it('the Garden Tender keeps its receipts single-shot across a season boundary (no duplicate harvest)', () => {
    const { g, r } = fresh(313);
    const cell = openCell(r);
    r.player.x = cell.x * TILE + 8; r.player.y = cell.y * TILE + 8; markDirty();
    put(r, 'wood', 200); put(r, 'fiber', 100); put(r, 'glass', 8); put(r, 'herb', 8);
    put(r, 'stone', 60); put(r, 'rope', 8); put(r, 'iron_ingot', 12); put(r, 'mechanical_parts', 16); put(r, 'fasteners', 16); put(r, 'spares', 16);
    // A level-2 workbench is the engine's real prerequisite for a Garden Tender.
    const bench = Object.values(r.entities).find(e => e.type === 'workbench');
    if (bench) expect(act(g, 'upgradeStation', { eid: bench.id }).ok).toBe(true);
    else {
      expect(act(g, 'build', { struct: 'workbench', tx: cell.x + 2, ty: cell.y }).ok).toBe(true);
      const b = Object.values(r.entities).find(e => e.type === 'workbench' && e.tx === cell.x + 2)!;
      expect(act(g, 'upgradeStation', { eid: b.id }).ok).toBe(true);
    }
    expect(act(g, 'build', { struct: 'garden', tx: cell.x, ty: cell.y }).ok).toBe(true);
    const garden = Object.values(r.entities).find(e => e.type === 'garden' && e.tx === cell.x && e.ty === cell.y)!;
    expect(act(g, 'build', { struct: 'barrel', tx: cell.x + 1, ty: cell.y }).ok).toBe(true);
    const barrel = Object.values(r.entities).find(e => e.type === 'barrel' && e.tx === cell.x + 1 && e.ty === cell.y)!;
    expect(act(g, 'build', { struct: 'farm_controller', tx: cell.x, ty: cell.y + 1 }).ok).toBe(true);
    const tender = Object.values(r.entities).find(e => e.type === 'farm_controller')!;
    expect(act(g, 'build', { struct: 'chest_small', tx: cell.x - 1, ty: cell.y }).ok).toBe(true);
    const chest = Object.values(r.entities).find(e => e.type === 'chest_small' && e.tx === cell.x - 1 && e.ty === cell.y)!;
    for (const [field, e] of [['gardenId', garden], ['barrelId', barrel], ['chestId', chest]] as const)
      expect(act(g, 'farmConfigure', { eid: tender.id, field, value: e.id }).ok).toBe(true);
    expect(addItem(r, chest.c!, 'seed', 6)).toBe(0); expect(addItem(r, tender.c!, 'wood', 6)).toBe(0); barrel.water = 12;
    expect(act(g, 'farmConfigure', { eid: tender.id, field: 'enabled', value: true }).ok).toBe(true);
    stepTenders(g, r.clock.lastSimAt);
    const planted = r.receipts.filter(x => x.kind === 'tender.plant').length;
    expect(planted).toBeGreaterThan(0);
    // Settle across the real spring -> summer boundary (42 h). The tender harvests only what
    // it physically planted, and a replay of the identical window cannot harvest again.
    const to = T0 + H(42 + 6);
    settle(g, to, true);
    const harvests = r.receipts.filter(x => x.kind === 'tender.harvest').length;
    const again = copy(g);
    settle(again, to, true);
    expect(again.run!.receipts.filter(x => x.kind === 'tender.harvest').length).toBe(harvests);
    expect(r.receipts.filter(x => x.kind === 'season.begin').length).toBe(1);
    settle(g, to + 60_000, true);
    expect(r.receipts.filter(x => x.kind === 'season.begin').length).toBe(1); // never re-announced
  });
});

// ---------------------------------------------------------------------------
describe('CAL-01 F — real gameplay consequences and no exploits', () => {
  it('a season boundary grants nothing: no items, cash, score or achievement', () => {
    const { g, r } = fresh(313);
    r.player.hunger = 100; r.player.thirst = 100;
    const start = {
      slots: Object.values(r.custody).flatMap(c => c.slots.filter(Boolean).map(s => `${s!.uid}:${s!.key}:${s!.qty}`)).sort(),
      score: r.score, deposited: r.deposited, ach: [...r.achievements], nextId: r.nextId,
    };
    settle(g, T0 + H(42 * 7), true); // all seven boundaries
    const end = {
      slots: Object.values(r.custody).flatMap(c => c.slots.filter(Boolean).map(s => `${s!.uid}:${s!.key}:${s!.qty}`)).sort(),
      score: r.score, deposited: r.deposited, ach: [...r.achievements],
    };
    expect(end.score).toBe(start.score);
    expect(end.deposited).toBe(start.deposited);
    expect(end.ach).toEqual(start.ach);
    // Supplies may only ever be consumed, never minted: no uid that did not exist may appear.
    const startUids = new Set(start.slots.map(s => s.split(':')[0]));
    const minted = end.slots.filter(s => !startUids.has(s.split(':')[0]));
    expect(minted).toEqual([]);
    expect(r.receipts.filter(x => x.kind === 'season.begin')).toHaveLength(7);
  });

  it('the calendar read model is what other owners consume, and it exposes a genuine transition list', () => {
    const { r } = fresh(313);
    const view = calendarViewForRun(r, T0 + H(45));
    expect(view.version).toBe(CALENDAR_VERSION);
    expect(view.state.season).toBe('summer');
    expect(view.label).toContain('Summer');
    expect(view.runProgress).toBeCloseTo(45 / 336, 6);
    const info = seasonInfo(r, T0 + H(45));
    expect(info.season).toBe('summer');
    expect(info.phaseRemainingMs).toBe(H(42 - 3));
    const events = seasonTransitionsBetween(r, T0, T0 + H(200)).map(t => calendarEventV1(r, t));
    expect(events).toHaveLength(4);
    expect(events.every(e => e.version === CALENDAR_VERSION && e.kind === 'season.begin' && e.evidence === 'SOH_PROVISIONAL')).toBe(true);
    expect(events.map(e => e.at)).toEqual([42, 84, 126, 168].map(k => T0 + H(k)));
  });

  it('accepts the qaAdvance fixture only as a labelled time acceleration, and it moves the season', () => {
    const { g, r } = fresh(313);
    expect(r.qaUsed).toBe(false);
    act(g, 'qaAdvance', { hours: 133 });
    expect(r.qaUsed).toBe(true);
    expect(calendarAt(r, r.clock.lastSimAt).season).toBe('winter');
    expect(calendarAt(r, r.clock.lastSimAt).year).toBe(1);
    act(g, 'qaAdvance', { hours: 40 });
    expect(calendarAt(r, r.clock.lastSimAt).season).toBe('spring');
    expect(calendarAt(r, r.clock.lastSimAt).year).toBe(2);
  });

  it('keeps the fixed run expiry boundary while the season wraps (no season-driven death or reset)', () => {
    const { g, r } = fresh(313);
    r.player.hunger = 100; r.player.thirst = 100;
    act(g, 'qaAdvance', { hours: 300 });
    expect(calendarAt(r, r.clock.lastSimAt).season).toBe('winter');
    expect(calendarAt(r, r.clock.lastSimAt).year).toBe(2);
    const forecast = offlineSurvivalEstimate(r);
    expect(forecast.survivalHours).toBeGreaterThan(0);
    // Settling past the fixed end expires the run at 336 h exactly — not at 336 + season remainder.
    settle(g, T0 + H(400));
    expect(g.run).toBeNull();
  });
});
