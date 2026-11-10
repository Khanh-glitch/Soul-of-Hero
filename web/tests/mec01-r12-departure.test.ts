// MEC-01 R12: J10 departure readiness (read-only read model + causal before/after + settle agreement).
// Every fixture is real engine intents except where a line says STAGED (labelled, not a success claim).
import '../tests/_evidenceFs';
import { describe, it, expect } from 'vitest';
import { mkdirSync } from 'node:fs';
import { writeFileSync } from './_evidenceFs';
import { BAL, HOUR, TILE, WW, T, type GameState, type RunState } from '../src/game/core';
import { newGame, dispatch, addItem, blockGrid, effTile, markDirty, C, weatherAt, isWet, destroyStructure, roofRoom } from '../src/game/engine';
import { settle } from '../src/game/sim';
import { getWorld } from '../src/game/world';
import { serializeSnapshot, validate } from '../src/game/persist';
import { phaseBoundaryAt } from '../src/game/calendar';
import { departureReadiness, forecastThermal, fmtH, DEPARTURE_HORIZON_MS } from '../src/game/departure';
import { readFileSync } from 'node:fs';

const T0 = Date.UTC(2026, 0, 1);
let seq = 0;
const act = (g: GameState, type: string, data: object = {}, now = T0) => dispatch(g, { id: `r12-${++seq}`, type, ...data }, now);
const copy = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
const expiryOf = (r: RunState) => r.startedAt - r.qaOffset + BAL.run.maxRunHours * HOUR;

function snowSpot(r: RunState) {
  const grid = blockGrid(r), w = getWorld();
  const free = (x: number, y: number) => { const i = y * WW + x; return grid[i] === 0 && effTile(r, x, y) === T.SNOW && !w.economyMap.protected[i] && !w.accessCorridors?.mask[i]; };
  for (let y = 12; y < 200; y++) for (let x = 12; x < 200; x++) if (free(x, y) && free(x + 1, y) && free(x + 2, y) && free(x, y - 1) && free(x + 2, y - 1)) return { x, y };
  throw new Error('no snow spot');
}
function site(g: GameState) {
  const r = g.run!, w = getWorld(), grid = blockGrid(r);
  for (let yy = 20; yy < 180; yy++) for (let xx = 20; xx < 180; xx++) {
    const cells = []; for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) cells.push([dx, dy]);
    if (cells.every(([dx, dy]) => { const i = (yy + dy) * WW + xx + dx; return grid[i] === 0 && !w.sourceV3[i] && w.economyMap.buildable[i] && !w.economyMap.protected[i] && !w.accessCorridors?.mask[i]; })) return { x: xx, y: yy };
  }
  throw new Error('no open site');
}

/** Real snow fixture: fresh run, no creatures, a built campfire (fuel 0), warmth set to 60 (STAGED). */
function snowCamp(seed = 313, warmth = 60) {
  const g = newGame(); expect(act(g, 'startRun', { character: 'female', region: 0, seed }).ok).toBe(true);
  const r = g.run!; r.creatures = [];
  const s = snowSpot(r);
  addItem(r, 'inv', 'wood', 40); addItem(r, 'inv', 'stone', 20);
  r.player.x = s.x * TILE + 8; r.player.y = s.y * TILE + 8; markDirty();
  expect(act(g, 'build', { struct: 'campfire', tx: s.x + 2, ty: s.y }).ok).toBe(true);
  const fire = Object.values(r.entities).find(e => e.type === 'campfire')!;
  r.player.warmth = warmth; r.clock.lastSimAt = T0;
  return { g, r, fire, s };
}

/** Fixture at `from`: REAL offline settle from T0 (crosses season boundaries), then a real campfire built at the
 * departure instant (an unroofed campfire decays offline, so it is rebuilt, not assumed), then STAGED warmth and paid fuel. */
function stagedAt(seed: number, from: number) {
  const g = newGame(); expect(act(g, 'startRun', { character: 'female', region: 0, seed }, T0).ok).toBe(true);
  const r = g.run!; r.creatures = [];
  // STAGED life support only: hunger/thirst/HP are topped up every 6 h so the 42 h offline walk reaches the boundary.
  // The thermal comparison does not depend on food; the top-up is labelled here and never used as evidence of survival.
  for (let t = T0 + 6 * HOUR; t < from; t += 6 * HOUR) {
    settle(g, t, true);
    r.player.hunger = 100; r.player.thirst = 100; r.player.hp = 100; r.player.dead = false;
  }
  if (from > T0) settle(g, from, true);
  r.player.hunger = 100; r.player.thirst = 100; r.player.hp = 100; r.player.dead = false;
  const s = snowSpot(r); // chosen AFTER the offline time: the departure-instant world decides what is free
  addItem(r, 'inv', 'wood', 40); addItem(r, 'inv', 'stone', 20);
  r.player.x = s.x * TILE + 8; r.player.y = s.y * TILE + 8; markDirty();
  const built = act(g, 'build', { struct: 'campfire', tx: s.x + 2, ty: s.y }, from);
  expect(built.ok, JSON.stringify(built)).toBe(true);
  const fire = Object.values(r.entities).find(e => e.type === 'campfire')!;
  r.player.warmth = 60; r.clock.lastSimAt = from;
  addItem(r, fire.station!.fuelC, 'wood', 3);
  return { g, r, fire, s };
}

/** Uniform real weather over [from,to): 'dry' or 'wet' (test-side check only; the model never does this). */
function uniformWeather(r: RunState, from: number, to: number): 'dry' | 'wet' | null {
  const slot = BAL.weather.slotMinutes * 60000; let wet = 0, dry = 0;
  for (let t = from + 1; t < to; t += slot) (isWet(weatherAt(r, t)) ? wet++ : dry++);
  return wet === 0 ? 'dry' : dry === 0 ? 'wet' : null;
}

describe('MEC-01 R12 departure readiness: read-only contract', () => {
  it('repeated views and forecasts do not mutate the run (no state, grants or claims)', () => {
    const { r, g } = snowCamp();
    const before = JSON.stringify(g.run);
    for (let i = 0; i < 3; i++) { departureReadiness(r, T0); forecastThermal(r, T0, T0 + HOUR, { id: 'dry', label: '', wet: false, sheltered: false }); }
    expect(JSON.stringify(g.run)).toBe(before);
  });

  it('every section carries provenance and a scope note; no certified survival hour is claimed', () => {
    const { r } = snowCamp();
    const d = departureReadiness(r, T0);
    for (const sec of [d.now, d.heat, d.outlook, d.home, d.survival]) {
      expect(sec.provenance.source.length).toBeGreaterThan(0);
      expect(sec.provenance.scope.length).toBeGreaterThan(0);
    }
    expect(d.survival.provenance.scope).toMatch(/Not a certified survival hour/);
    expect(d.unknown.join(' ')).toMatch(/Exact survival hour: not computed/);
    expect(JSON.stringify(d)).not.toMatch(/certified survival hour of/i);
  });

  it('bounded horizon: 24 h, or the remaining run when it is shorter', () => {
    const { r } = snowCamp();
    expect(departureReadiness(r, T0).horizonH).toBe(24);
    expect(departureReadiness(r, T0).horizonBasis).toBe('24h');
    const near = departureReadiness(r, expiryOf(r) - 2 * HOUR);
    expect(near.horizonH).toBeCloseTo(2, 9); expect(near.horizonBasis).toBe('run-remaining');
    const ended = departureReadiness(r, expiryOf(r) + HOUR);
    expect(ended.horizonBasis).toBe('ended'); expect(ended.outlook.scenarios).toEqual([]);
    expect(ended.outlook.phrase).toMatch(/Run has ended/);
    expect(DEPARTURE_HORIZON_MS).toBe(24 * HOUR);
  });

  it('weather is exact only for the current slot: the model calls weatherAt only at `now`', () => {
    const src = readFileSync(new URL('../src/game/departure.ts', import.meta.url), 'utf8');
    const calls = [...src.matchAll(/weatherAt\(r, ([^)]+)\)/g)].map(m => m[1]);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(a => a === 'now')).toBe(true);
  });

  it('exact-slot vs post-slot leakage: inside the known slot the scenario choice cannot change the answer', () => {
    const { r } = snowCamp();
    const slotEnd = T0 + (BAL.weather.slotMinutes * 60000 - ((T0 - (r.startedAt - r.qaOffset)) % (BAL.weather.slotMinutes * 60000)));
    const a = forecastThermal(r, T0, slotEnd, { id: 'dry', label: '', wet: false, sheltered: false });
    const b = forecastThermal(r, T0, slotEnd, { id: 'wet', label: '', wet: true, sheltered: false });
    expect(a.warmthAtEnd).toBeCloseTo(b.warmthAtEnd, 9);
    // After the slot the two scenarios must be allowed to diverge (wet adds cold).
    const a2 = forecastThermal(r, T0, T0 + HOUR, { id: 'dry', label: '', wet: false, sheltered: false });
    const b2 = forecastThermal(r, T0, T0 + HOUR, { id: 'wet', label: '', wet: true, sheltered: false });
    expect(b2.warmthAtEnd).toBeLessThan(a2.warmthAtEnd);
  });
});

describe('MEC-01 R12 forecast agrees with the real settle() (same frozen state)', () => {
  // Find a real window where the actual weather is uniform (test-side check), so one scenario is the truth.
  function windowSeed(from: number, to: number, startSeed: number) {
    for (let seed = startSeed; seed < startSeed + 400; seed++) {
      const g = newGame(); if (!act(g, 'startRun', { character: 'female', region: 0, seed }).ok) continue;
      const kind = uniformWeather(g.run!, from, to);
      if (kind) return { seed, kind };
    }
    throw new Error('no uniform window seed');
  }
  function agree(seed: number, kind: 'dry' | 'wet', from: number, endsMin: number[], sheltered = false) {
    const { g, r, fire } = stagedAt(seed, from);
    const frozen = copy(g);
    const sc = { id: kind, label: kind, wet: kind === 'wet', sheltered };
    const trace = forecastThermal(r, from, from + Math.max(...endsMin) * 60000, sc);
    const rows: { min: number; forecast: number; settle: number }[] = [];
    for (const m of endsMin) {
      const gs = copy(frozen);
      settle(gs, from + m * 60000, true);
      const f = forecastThermal(frozen.run!, from, from + m * 60000, sc).warmthAtEnd;
      rows.push({ min: m, forecast: f, settle: gs.run!.player.warmth });
    }
    return { trace, rows };
  }

  it('dry window: forecast warmth equals settle() warmth at 5/15/30/60 min', () => {
    const { seed, kind } = windowSeed(T0, T0 + 61 * 60000, 320);
    const { rows } = agree(seed, kind, T0, [5, 15, 30, 60]);
    for (const row of rows) expect(Math.abs(row.forecast - row.settle), JSON.stringify(row)).toBeLessThan(0.05);
  });

  it('cold crossing time agrees with settle(): settle is warm just before the forecast crossing and cold just after', () => {
    const { seed, kind } = windowSeed(T0, T0 + 61 * 60000, 320);
    const { g, r, fire } = snowCamp(seed, 60);
    addItem(r, fire.station!.fuelC, 'wood', 3);
    r.clock.lastSimAt = T0;
    const frozen = copy(g);
    const sc = { id: kind, label: kind, wet: kind === 'wet', sheltered: false };
    const f = forecastThermal(frozen.run!, T0, T0 + 60 * 60000, sc);
    expect(f.coldInH).not.toBeNull();
    const cross = f.coldInH!;
    const before = copy(frozen); settle(before, T0 + cross * HOUR * 0.99, true);
    const after = copy(frozen); settle(after, T0 + cross * HOUR * 1.01, true);
    // The forecast reports the physical crossing (warmth reaches the threshold). settle() is warm 1% before it and cold 1% after it.
    expect(before.run!.player.warmth).toBeGreaterThanOrEqual(BAL.comfortV1.coldThreshold - 0.05);
    expect(after.run!.player.warmth).toBeLessThan(BAL.comfortV1.coldThreshold + 0.05);
  });

  it('season transition: a forecast window crossing the phase boundary agrees with settle()', () => {
    // phaseBoundaryAt returns an ABSOLUTE instant (42 h after T0 for phase index 1).
    const from = phaseBoundaryAt({ startedAt: T0, qaOffset: 0 }, 1) - 20 * 60000;
    const { seed, kind } = windowSeed(from, from + 61 * 60000, 330);
    const { rows } = agree(seed, kind, from, [10, 25, 40, 60]);
    for (const row of rows) expect(Math.abs(row.forecast - row.settle), JSON.stringify(row)).toBeLessThan(0.05);
  });
});

describe('MEC-01 R12 heat: paid fuel, idle furnace, job, station loss', () => {
  it('heater paid vs unpaid: paid fuel gives a fuel limit and a later cold crossing; no fuel gives none', () => {
    const unpaid = snowCamp(313, 60); const dUnpaid = departureReadiness(unpaid.r, T0);
    expect(dUnpaid.heat.fuelLimitH).toBeNull();
    expect(dUnpaid.heat.notHeating.join(' ')).toMatch(/no paid fuel/);
    const paid = snowCamp(313, 60); addItem(paid.r, paid.fire.station!.fuelC, 'wood', 6);
    const dPaid = departureReadiness(paid.r, T0);
    expect(dPaid.heat.fuelLimitH).toBeGreaterThan(0);
    expect(dPaid.heat.heaters[0].status).toBe('burning');
    expect(dPaid.heat.fuelLimitH!).toBeLessThan(24);
    const tU = dUnpaid.outlook.scenarios.find(s => s.id === 'dry')!.coldInH!;
    const tP = dPaid.outlook.scenarios.find(s => s.id === 'dry')!.coldInH;
    expect(tP === null || tP > tU).toBe(true);
  });

  it('paid fuel ends and the target falls back: the post-supply target is the no-heat target, never a promise of warmth', () => {
    const { r, fire } = snowCamp(313, 90); addItem(r, fire.station!.fuelC, 'wood', 1);
    const d = departureReadiness(r, T0);
    const dry = d.outlook.scenarios.find(s => s.id === 'dry')!;
    expect(dry.supplyEndH).not.toBeNull();
    expect(dry.targetAfterSupply).toBeLessThan(d.now.target);
    expect(dry.targetAfterSupply).toBeCloseTo(19, 6); // snow base alone, no heat, no shelter
  });

  it('idle furnace is "not heating" even with fuel; a queued job makes it heat until the job or the fuel ends', () => {
    const { g, r, s } = snowCamp(313, 60);
    const x = s.x + 5, y = s.y;
    addItem(r, 'inv', 'stone', 40); addItem(r, 'inv', 'wood', 20); addItem(r, 'inv', 'iron_ore', 3);
    r.player.x = (x - 1) * TILE + 8; r.player.y = y * TILE + 8;
    expect(act(g, 'build', { struct: 'furnace', tx: x, ty: y }).ok).toBe(true);
    const furnace = Object.values(r.entities).find(e => e.type === 'furnace')!;
    addItem(r, furnace.station!.fuelC, 'wood', 6);
    const idle = departureReadiness(r, T0);
    const frow = idle.heat.heaters.find(h => h.kind === 'furnace')!;
    expect(frow.status).toBe('idle_furnace');
    expect(idle.heat.notHeating.join(' ')).toMatch(/idle/);
    expect(idle.heat.fuelLimitH).toBeNull();
    expect(idle.choices.some(c => c.id === 'queue-job-' + furnace.id)).toBe(true);
    // Real intent: queue an iron ingot job (10 s) at the furnace.
    expect(act(g, 'craft', { recipe: 'iron_ingot', eid: furnace.id }).ok).toBe(true);
    const busy = departureReadiness(r, T0);
    expect(busy.heat.heaters.find(h => h.kind === 'furnace')!.status).toBe('burning');
    expect(busy.heat.fuelLimitH).toBeCloseTo(10 / 3600, 6);       // job, 10 s, is the limit (fuel is longer)
    const job = busy.heat.nearbyStations.find(n => n.id === furnace.id)!;
    expect(job.queue).toBe(1); expect(job.firstLeftMin).toBeCloseTo(10 / 60, 1); expect(job.firstJob).toBe('Iron Ingot');
    expect(job.fuelItems).toBe(6);
  });

  it('nearby station: output full is shown as paused, with the free output slot count', () => {
    const { g, r, s } = snowCamp(313, 60);
    addItem(r, 'inv', 'stone', 40); addItem(r, 'inv', 'wood', 20); addItem(r, 'inv', 'iron_ore', 3);
    r.player.x = (s.x + 4) * TILE + 8; r.player.y = s.y * TILE + 8;
    expect(act(g, 'build', { struct: 'furnace', tx: s.x + 5, ty: s.y }).ok).toBe(true);
    const furnace = Object.values(r.entities).find(e => e.type === 'furnace')!;
    addItem(r, furnace.station!.fuelC, 'wood', 4);
    expect(act(g, 'craft', { recipe: 'iron_ingot', eid: furnace.id }).ok).toBe(true);
    const out = furnace.station!.outC;
    // STAGED: fill the output container so the next finished ingot has nowhere to go.
    const keys = ['stone', 'wood', 'fiber', 'iron_ore', 'coal', 'brick'];
    for (let i = 0; C(r, out).slots.some(s => !s) && i < 200; i++) addItem(r, out, keys[i % keys.length], 40);
    const d = departureReadiness(r, T0);
    const n = d.heat.nearbyStations.find(q => q.id === furnace.id)!;
    expect(n.freeOutputSlots).toBe(0);
    expect(n.note).toMatch(/output full/);
  });

  it('station loss: a destroyed campfire is no longer a heat source and no fuel limit is reported', () => {
    const { r, fire } = snowCamp(313, 60); addItem(r, fire.station!.fuelC, 'wood', 6);
    expect(departureReadiness(r, T0).heat.fuelLimitH).not.toBeNull();
    destroyStructure(r, fire, T0 + 1);
    const d = departureReadiness(r, T0);
    expect(d.heat.heaters.find(h => h.id === fire.id)).toBeUndefined();
    expect(d.heat.fuelLimitH).toBeNull();
    expect(d.outlook.scenarios.every(sc => sc.supplyEndH === null)).toBe(true);
  });
});

describe('MEC-01 R12 shelter, insulation, position, home, choices', () => {
  it('roof enclosure: the shelter counts only while roofed; the roof-lost scenario drops the +8 contribution', () => {
    const g = newGame(); expect(act(g, 'startRun', { character: 'female', region: 0, seed: 313 }).ok).toBe(true);
    const r = g.run!; r.creatures = [];
    const { x, y } = site(g);
    r.player.x = x * TILE + 8; r.player.y = (y + 1) * TILE + 8;
    addItem(r, 'inv', 'wood', 400); addItem(r, 'inv', 'fiber', 200); addItem(r, 'inv', 'stone', 60);
    const build = (struct: string, tx: number, ty: number) => { const res = act(g, 'build', { struct, tx, ty }); expect({ struct, tx, ty, why: res.ok ? '' : (res as any).reason }).toEqual({ struct, tx, ty, why: '' }); };
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) build('floor_wood', x + dx, y + dy);
    for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 2; dy++) {
      if (dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1) continue;
      const ox = dx < 0 ? -1 : dx > 1 ? 1 : 0, oy = dy < 0 ? -1 : dy > 1 ? 1 : 0;
      r.player.x = (x + dx + ox) * TILE + 8; r.player.y = (y + dy + oy) * TILE + 8;
      build('wall_wood', x + dx, y + dy);
    }
    r.player.x = x * TILE + 8; r.player.y = (y + 1) * TILE + 8;
    const noRoof = departureReadiness(r, T0);
    expect(noRoof.now.sheltered).toBe(false);
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) build('roof_thatch', x + dx, y + dy);
    const roofed = departureReadiness(r, T0);
    expect(roofed.now.sheltered).toBe(true);
    expect(roofed.now.target).toBeGreaterThan(noRoof.now.target);
    expect(roofed.now.target - noRoof.now.target).toBeCloseTo(BAL.comfortV1.sources.enclosedShelter.score * 0.75, 6);
    expect(roofed.outlook.scenarios.some(s => s.id === 'dry-shelter-lost')).toBe(true);
    const lost = roofed.outlook.scenarios.find(s => s.id === 'dry-shelter-lost')!;
    const kept = roofed.outlook.scenarios.find(s => s.id === 'dry')!;
    expect(lost.coldInH === null || kept.coldInH === null || lost.coldInH <= kept.coldInH).toBe(true);
    expect(roofed.choices.some(c => c.id === 'move-inside')).toBe(false);
    expect(roomSheltered(r, x, y + 1)).toBe(true);
  });

  it('cold gear: the cloak is the same insulation law as settle (cold 18 -> base +54 on snow)', () => {
    const { r } = snowCamp(313, 60);
    const before = departureReadiness(r, T0).now;
    const eq = C(r, 'eq');
    const idx = eq.slots.findIndex(s => !s);
    eq.slots[idx] = { uid: 'r12-cloak', key: 'fur_cloak', qty: 1, dur: 100 } as any;
    const after = departureReadiness(r, T0).now;
    expect(after.insulation).toBe(18);
    expect(after.target - before.target).toBeCloseTo(54, 6);
  });

  it('position change: a non-snow tile far from the campfire has no snow exposure, no fire and no cold crossing in the 24 h horizon', () => {
    const { r } = snowCamp(313, 60);
    const snow = departureReadiness(r, T0);
    // Move to a non-snow, non-water tile. This is a player-position change (no state write besides position).
    const grid = blockGrid(r), w = getWorld(); let spot: { x: number; y: number } | null = null;
    for (let y = 30; y < 170 && !spot; y++) for (let x = 30; x < 170 && !spot; x++) {
      const i = y * WW + x; if (grid[i] === 0 && effTile(r, x, y) !== T.SNOW && w.zone[i] !== 5 && !w.economyMap.protected[i]) spot = { x, y };
    }
    expect(spot).not.toBeNull();
    r.player.x = spot!.x * TILE + 8; r.player.y = spot!.y * TILE + 8;
    const d = departureReadiness(r, T0);
    expect(d.now.exposures.find(e => e.id === 'snow_zone')).toBeUndefined();
    expect(d.now.target).toBeGreaterThan(snow.now.target);
    expect(d.heat.heaters.length).toBe(0);
    expect(d.heat.nearbyNone).toMatch(/No owned production station/);
  });

  it('no home: the read model says so plainly, with no penalty', () => {
    const { r } = snowCamp(313, 60);
    const d = departureReadiness(r, T0);
    expect(d.home.hasHome).toBe(false);
    expect(d.home.penalty).toBe('none');
    expect(d.home.cabinets).toEqual([]);
  });

  it('partial home: a real built wall is listed with its HP; a damaged one shows HP below max; no invented repair task without state', () => {
    const { g, r, s } = snowCamp(313, 60);
    addItem(r, 'inv', 'wood', 40);
    r.player.x = (s.x + 1) * TILE + 8; r.player.y = (s.y + 1) * TILE + 8; markDirty();
    expect(act(g, 'build', { struct: 'wall_wood', tx: s.x + 4, ty: s.y + 1 }).ok).toBe(true);
    const wall = Object.values(r.entities).find(e => e.type === 'wall_wood')!;
    const intact = departureReadiness(r, T0);
    expect(intact.home.damagedStructures).toEqual([]);
    expect(intact.home.hasHome).toBe(false);          // a wall alone is partial shelter, not a home cabinet
    // STAGED damage: the wall loses HP (what a monster or decay would do), the read model must show exactly that.
    wall.hp = wall.maxHp! / 2;
    const hurt = departureReadiness(r, T0);
    expect(hurt.home.damagedStructures.map(x => x.id)).toEqual([wall.id]);
    expect(hurt.home.damagedStructures[0].hp).toBe(wall.maxHp! / 2);
    expect(hurt.home.penalty).toBe('none');
    expect(hurt.choices.some(c => c.id === 'repair-' + wall.id)).toBe(true);
  });

  it('choices are grounded: refuel is offered only when the fuel is physically carried and the heater is out', () => {
    const { r, fire } = snowCamp(313, 60);
    // STAGED: remove all carried wood so there is no burnable fuel in the bag.
    C(r, 'inv').slots = C(r, 'inv').slots.map(s => (s && s.key === 'wood' ? null : s));
    const none = departureReadiness(r, T0);
    expect(none.choices.some(c => c.id === 'refuel-' + fire.id)).toBe(false);
    addItem(r, 'inv', 'wood', 5);
    // Fuel carried in the bag: with a dry campfire, the offer names the real carried count.
    const out = departureReadiness(r, T0).choices.find(c => c.id === 'refuel-' + fire.id);
    expect(out).toBeDefined();
    expect(out!.text).toMatch(/you carry \d+ burnable fuel/);
  });

  it('fmtH: short windows read as minutes, never as "0.2-0.2 h"', () => {
    expect(fmtH(0.2)).toBe('12 min');
    expect(fmtH(2.345)).toBe('2.3 h');
  });
});

function roomSheltered(r: RunState, tx: number, ty: number) { return roofRoom(r, tx * TILE + 8, ty * TILE + 8).enclosed; }

describe('MEC-01 R12 causal before/after (real intents, labelled staging) → evidence', () => {
  it('writes the before/after table of the J10 fields for each cause', () => {
    const rows: Record<string, unknown>[] = [];
    const pick = (label: string, d: ReturnType<typeof departureReadiness>) => ({
      step: label, warmth: d.now.warmth, target: d.now.target, sheltered: d.now.sheltered, insulation: d.now.insulation,
      fuelLimitH: d.heat.fuelLimitH === null ? null : Math.round(d.heat.fuelLimitH * 1000) / 1000,
      heater: d.heat.heaters.map(h => h.status).join('|') || 'none',
      earliestColdH: d.outlook.earliestColdH === null ? null : Math.round(d.outlook.earliestColdH * 1000) / 1000,
      latestColdH: d.outlook.latestColdH === null ? null : Math.round(d.outlook.latestColdH * 1000) / 1000,
      phrase: d.outlook.phrase,
    });
    // Cause 1: physically paid fuel
    const c1 = snowCamp(313, 60);
    rows.push(pick('C1 BEFORE no paid fuel (campfire built, fuel 0)', departureReadiness(c1.r, T0)));
    addItem(c1.r, c1.fire.station!.fuelC, 'wood', 6); // STAGED-equivalent: a real fuel item placed in the campfire fuel container
    rows.push(pick('C1 AFTER 6 wood in fuel custody', departureReadiness(c1.r, T0)));
    // Cause 2: enclosing the roof (real build intents, same site as the shelter tests)
    const g2 = newGame(); act(g2, 'startRun', { character: 'female', region: 0, seed: 313 }); const r2 = g2.run!; r2.creatures = [];
    const st = site(g2); r2.player.x = st.x * TILE + 8; r2.player.y = (st.y + 1) * TILE + 8;
    addItem(r2, 'inv', 'wood', 400); addItem(r2, 'inv', 'fiber', 200); addItem(r2, 'inv', 'stone', 60);
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) act(g2, 'build', { struct: 'floor_wood', tx: st.x + dx, ty: st.y + dy });
    for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 2; dy++) {
      if (dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1) continue;
      const ox = dx < 0 ? -1 : dx > 1 ? 1 : 0, oy = dy < 0 ? -1 : dy > 1 ? 1 : 0;
      r2.player.x = (st.x + dx + ox) * TILE + 8; r2.player.y = (st.y + dy + oy) * TILE + 8;
      act(g2, 'build', { struct: 'wall_wood', tx: st.x + dx, ty: st.y + dy });
    }
    r2.player.x = st.x * TILE + 8; r2.player.y = (st.y + 1) * TILE + 8;
    rows.push(pick('C2 BEFORE walls, no roof', departureReadiness(r2, T0)));
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) act(g2, 'build', { struct: 'roof_thatch', tx: st.x + dx, ty: st.y + dy });
    rows.push(pick('C2 AFTER roof_thatch enclosure', departureReadiness(r2, T0)));
    // Cause 3: cold gear (worn cloak; STAGED placement into the worn slot)
    const c3 = snowCamp(313, 60);
    rows.push(pick('C3 BEFORE no cold gear', departureReadiness(c3.r, T0)));
    const eq = C(c3.r, 'eq'); eq.slots[eq.slots.findIndex(s => !s)] = { uid: 'r12-cloak', key: 'fur_cloak', qty: 1, dur: 100 } as any;
    rows.push(pick('C3 AFTER fur_cloak worn', departureReadiness(c3.r, T0)));
    // Cause 4: furnace idle vs running a job
    const c4 = snowCamp(313, 60); addItem(c4.r, 'inv', 'stone', 40); addItem(c4.r, 'inv', 'wood', 20); addItem(c4.r, 'inv', 'iron_ore', 3);
    c4.r.player.x = (c4.s.x + 4) * TILE + 8; c4.r.player.y = c4.s.y * TILE + 8;
    act(c4.g, 'build', { struct: 'furnace', tx: c4.s.x + 5, ty: c4.s.y });
    const fu = Object.values(c4.r.entities).find(e => e.type === 'furnace')!;
    addItem(c4.r, fu.station!.fuelC, 'wood', 6);
    rows.push(pick('C4 BEFORE furnace fuelled, idle (no job)', departureReadiness(c4.r, T0)));
    act(c4.g, 'craft', { recipe: 'iron_ingot', eid: fu.id });
    rows.push(pick('C4 AFTER furnace job queued (iron_ingot 10 s)', departureReadiness(c4.r, T0)));
    // Cause 5: position change (same real state; only the player's tile changes)
    const c5 = snowCamp(313, 60); addItem(c5.r, c5.fire.station!.fuelC, 'wood', 6);
    rows.push(pick('C5 BEFORE on snow beside the campfire', departureReadiness(c5.r, T0)));
    const grid = blockGrid(c5.r), w = getWorld(); let spot: { x: number; y: number } | null = null;
    for (let y = 30; y < 170 && !spot; y++) for (let x = 30; x < 170 && !spot; x++) { const i = y * WW + x; if (grid[i] === 0 && effTile(c5.r, x, y) !== T.SNOW && w.zone[i] !== 5 && !w.economyMap.protected[i]) spot = { x, y }; }
    c5.r.player.x = spot!.x * TILE + 8; c5.r.player.y = spot!.y * TILE + 8;
    rows.push(pick('C5 AFTER moved to a non-snow tile (campfire out of reach)', departureReadiness(c5.r, T0)));
    mkdirSync('evidence/mec01-r12', { recursive: true });
    writeFileSync('evidence/mec01-r12/R12_CAUSAL_BEFORE_AFTER.json', JSON.stringify(rows, null, 2));
    expect(rows.length).toBe(10);
    // Each cause must move the field it is about (the causal claim, not just a dump).
    const v = (i: number, k: string) => (rows[i] as any)[k];
    expect(v(1, 'fuelLimitH')).not.toBeNull(); expect(v(0, 'fuelLimitH')).toBeNull();
    expect(v(3, 'sheltered')).toBe(true); expect(v(2, 'sheltered')).toBe(false);
    expect(v(5, 'insulation')).toBe(18); expect(v(4, 'insulation')).toBe(0);
    expect(v(6, 'heater')).toMatch(/idle_furnace|out_of_fuel|burning/);
    expect(v(7, 'heater')).toMatch(/burning/);
    expect(v(9, 'target')).toBeGreaterThan(v(8, 'target')); // leaving snow removes the snow exposure
  });
});
