// CAL-01.1 — corrective test: the pre-logout survival forecast must use the SAME
// season-dependent thirst law that sim.ts applies while the player is away.
//
// Control Tower finding C2: `offlineSurvivalEstimate()` divided thirst by the neutral
// baseline `BAL.player.offlineThirstPerHour` while `settle()` multiplied by
// `climateAt(player tile).thirstMultiplier`, so a warm summer cell advertised ~16 h and
// actually emptied in ~12-13 h. These tests pin the corrected forecast, including a
// window that crosses a real phase boundary, and keep it an APPROXIMATE thirst/hunger
// model (no invented supplies, creatures, rainfall or hazards).
import { describe, it, expect } from 'vitest';
import { BAL, HOUR, TILE, WW } from '../src/game/core';
import { newGame, dispatch, offlineSurvivalEstimate, markDirty, blockGrid } from '../src/game/engine';
import { settle } from '../src/game/sim';
import { calendarAt, climateAt, phaseBoundaryAt } from '../src/game/calendar';
import { getWorld } from '../src/game/world';

const T0 = Date.UTC(2026, 0, 1);
const H = (n: number) => n * HOUR;
let seq = 0;

/** A run parked on a warm Map cell, present at `at`, fully fed and watered. */
function parked(at: number, seed = 313) {
  const g = newGame();
  expect(dispatch(g, { id: `cal011-${++seq}`, type: 'startRun', character: 'female', region: 0, seed }, T0).ok).toBe(true);
  const r = g.run!; r.creatures = [];
  const m = getWorld().economyMap, grid = blockGrid(r);
  let cell = { x: 0, y: 0 };
  for (let y = 100; y < 190 && !cell.x; y++) for (let x = 20; x < 180; x++) {
    const i = y * WW + x;
    if (grid[i] === 0 && m.buildable[i] && !m.protected[i] && m.temperature[i] > 0.65) { cell = { x, y }; break; }
  }
  expect(cell.x).toBeGreaterThan(0);
  r.player.x = cell.x * TILE + 8; r.player.y = cell.y * TILE + 8; markDirty();
  r.player.hunger = 100; r.player.thirst = 100; r.player.hp = 100;
  r.clock.lastSimAt = at; r.clock.simMs = at;
  return { g, r, cell };
}

describe('CAL-01.1 — offline survival forecast matches the seasonal thirst law', () => {
  it('BEFORE/AFTER: the neutral season is unchanged, a hot summer cell is no longer overstated', () => {
    const baselineHours = 100 / BAL.player.offlineThirstPerHour;      // the old, season-blind answer
    expect(baselineHours).toBeCloseTo(16, 6);

    // Spring is exactly neutral: the corrected forecast must still report the measured baseline.
    const spring = parked(T0 + H(10));
    const springMult = climateAt(spring.r, spring.cell.x, spring.cell.y, spring.r.clock.lastSimAt, 'clear').thirstMultiplier;
    expect(springMult).toBe(1);
    const springForecast = offlineSurvivalEstimate(spring.r);
    expect(springForecast.thirstHours).toBeCloseTo(baselineHours, 6);
    expect(springForecast.thirstMultiplier).toBe(1);

    // Summer on the same warm cell: the old forecast advertised 16 h regardless.
    const summer = parked(T0 + H(50));
    expect(calendarAt(summer.r, summer.r.clock.lastSimAt).season).toBe('summer');
    const mult = climateAt(summer.r, summer.cell.x, summer.cell.y, summer.r.clock.lastSimAt, 'clear').thirstMultiplier;
    expect(mult).toBeGreaterThan(1);
    const forecast = offlineSurvivalEstimate(summer.r);
    expect(forecast.thirstMultiplier).toBeCloseTo(mult, 10);
    // AFTER: the reported hours equal the real seasonal depletion, not the neutral baseline.
    expect(forecast.thirstHours).toBeCloseTo(100 / (BAL.player.offlineThirstPerHour * mult), 6);
    expect(forecast.thirstHours).toBeLessThan(baselineHours - 1);
    // ... and it is strictly consistent with the multiplier: hotter/drier never predicts longer.
    expect(forecast.thirstHours).toBeLessThan(springForecast.thirstHours);
  });

  it('the reported depletion is not overstated: settling exactly that long really empties thirst', () => {
    const { g, r } = parked(T0 + H(50));
    const forecast = offlineSurvivalEstimate(r);
    settle(g, r.clock.lastSimAt + forecast.thirstHours * HOUR, true);
    expect(calendarAt(r, r.clock.lastSimAt).season).toBe('summer');
    expect(r.player.thirst).toBeCloseTo(0, 6);
    expect(r.player.dead).toBe(false);          // thirst only: HP damage starts, death is later
    // One second past the reported hour the player is still not resurrected to full thirst.
    expect(r.player.thirst).toBeLessThan(0.01);
  });

  it('accounts for a future phase boundary inside the prediction window', () => {
    // Start 6 h before the spring -> summer boundary, i.e. inside spring (rate 1.0 at first).
    const at = phaseBoundaryAt(parked(T0).r, 1) - 6 * HOUR;
    const { g, r } = parked(at);
    expect(calendarAt(r, at).season).toBe('spring');
    const forecast = offlineSurvivalEstimate(r);
    const springRate = BAL.player.offlineThirstPerHour;
    const summerMult = climateAt(r, Math.floor(r.player.x / TILE), Math.floor(r.player.y / TILE), phaseBoundaryAt(r, 1) + 60000, 'clear').thirstMultiplier;
    expect(summerMult).toBeGreaterThan(1);
    // Crossing model: the whole prediction is neither the all-spring nor the all-summer number.
    expect(forecast.thirstHours).toBeGreaterThan(100 / (springRate * summerMult));
    expect(forecast.thirstHours).toBeLessThan(100 / springRate);
    expect(forecast.thirstMultiplier).toBe(1);                 // rate at logout
    expect(forecast.thirstMultiplierHorizon).toBeCloseTo(summerMult, 10); // worst ahead
    // The forecast is exactly the segmented integral of the real law.
    const rate = (t: number) => springRate * climateAt(r, Math.floor(r.player.x / TILE), Math.floor(r.player.y / TILE), t, 'clear').thirstMultiplier;
    const boundary = phaseBoundaryAt(r, 1);
    const firstLeg = (boundary - at) / HOUR;
    const expected = firstLeg + (100 - firstLeg * rate(at)) / rate(boundary + 60000);
    expect(forecast.thirstHours).toBeCloseTo(expected, 4);
    // And settlement confirms it: that many hours away leaves thirst empty and the crossing committed.
    settle(g, at + forecast.thirstHours * HOUR, true);
    expect(r.player.thirst).toBeCloseTo(0, 6);
    expect(r.receipts.filter(x => x.kind === 'season.begin').length).toBe(1);
  });

  it('never predicts past the fixed 336 h run expiry and keeps its approximate scope', () => {
    const r0 = parked(T0).r;
    const expiry = r0.startedAt - r0.qaOffset + BAL.run.maxRunHours * HOUR;
    const { r } = parked(expiry - 2 * HOUR);
    const forecast = offlineSurvivalEstimate(r);
    expect(forecast.runHoursLeft).toBeCloseTo(2, 6);
    expect(forecast.survivalHours).toBeLessThanOrEqual(forecast.runHoursLeft + 1e-9);
    expect(forecast.scope).toContain('thirst+hunger only');
    // Hunger is capped by the same horizon instead of promising an unreachable full 24 h.
    expect(forecast.hungerHours).toBeLessThanOrEqual(2 + 1e-9);
  });
});
