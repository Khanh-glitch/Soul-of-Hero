// B03 Deliverable A: shared physical thermal rules (online tick and offline settle).
import { describe, it, expect } from 'vitest';
import { BAL, TILE, WW, T, type GameState, type RunState } from '../src/game/core';
import { newGame, dispatch, addItem, countItem, blockGrid, effTile, destroyStructure, markDirty } from '../src/game/engine';
import { settle, tick } from '../src/game/sim';
import { thermalEvaluate, thermalEnv, thermalStep, thermalBoundaryMs, heaterStatus } from '../src/game/thermal';
import { getWorld } from '../src/game/world';
import { serializeSnapshot, validate } from '../src/game/persist';

const T0 = Date.UTC(2026, 0, 1);
let seq = 0;
const act = (g: GameState, type: string, data: object = {}, now = T0) => dispatch(g, { id: `thermal-${++seq}`, type, ...data }, now);
const copy = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;

// Finds a real snow tile with free 7x7 ground, so the cold rule comes from the map, not a test override.
function snowSpot(r: RunState) {
  const grid = blockGrid(r), w = getWorld();
  const free = (x: number, y: number) => { const i = y * WW + x; return grid[i] === 0 && effTile(r, x, y) === T.SNOW && !w.economyMap.protected[i] && !w.accessCorridors?.mask[i]; };
  for (let y = 12; y < 200; y++) for (let x = 12; x < 200; x++) if (free(x, y) && free(x + 1, y) && free(x + 2, y) && free(x, y - 1) && free(x + 2, y - 1)) return { x, y };
  throw new Error('no snow spot');
}

function campSetup(seed = 313, fuelWood = 0) {
  const g = newGame(); expect(act(g, 'startRun', { character: 'female', region: 0, seed }).ok).toBe(true);
  const r = g.run!; r.creatures = [];
  const s = snowSpot(r);
  addItem(r, 'inv', 'wood', 40); addItem(r, 'inv', 'stone', 20);
  r.player.x = s.x * TILE + 8; r.player.y = s.y * TILE + 8; markDirty();
  const built = act(g, 'build', { struct: 'campfire', tx: s.x + 2, ty: s.y });
  expect(built).toMatchObject({ ok: true });
  const fire = Object.values(r.entities).find(e => e.type === 'campfire' && e.tx === s.x + 2 && e.ty === s.y)!;
  if (fuelWood) addItem(r, fire.station!.fuelC, 'wood', fuelWood);
  return { g, r, fire, s };
}

const envFor = (r: RunState, s: { x: number; y: number }, sheltered = false) =>
  thermalEnv(r, { x: r.player.x, y: r.player.y, zone: getWorld().zone[s.y * WW + s.x], tileType: T.SNOW, wet: false, dark: false, sheltered, torch: false });

describe('B03-A comfortV1 physical thermal evaluator', () => {
  it('balance is source-scoped: LI 40 is a historical cap, not 40 SOH warmth units', () => {
    expect(BAL.comfortV1.liHistoricalCap).toBe(40);
    expect(BAL.comfortV1.scoreCap).toBe(40);
    expect(BAL.comfortV1.targetMaxBonus).toBe(30);
    expect(BAL.comfortV1.sources.campfireBurning.score).toBe(18);
    expect(BAL.comfortV1.sources.furnaceBurning.score).toBe(12);
    expect(BAL.comfortV1.sources.enclosedShelter.score).toBe(8);
    expect(BAL.comfortV1.sources.campfireBurning.radiusPx).toBe(52);
  });

  it('snow cold alone gives base 19; a burning campfire in line of sight adds 13.5 (0.75 per score)', () => {
    const { r, s, fire } = campSetup(313, 2);
    const env = envFor(r, s);
    expect(heaterStatus(r, fire)?.active).toBe(true);
    const hot = thermalEvaluate(r, env);
    expect(hot.base).toBeCloseTo(19, 6);
    expect(hot.heat.sources.map(x => x.id)).toEqual([fire.id]);
    expect(hot.target).toBeCloseTo(19 + 18 * 0.75, 6);
  });

  it('no paid fuel means no heat; a sheltered shelter alone gives +6; stacked score is capped at 40', () => {
    const { r, s, fire, g } = campSetup(313, 0);
    expect(heaterStatus(r, fire)?.code).toBe('out_of_fuel');
    expect(thermalEvaluate(r, envFor(r, s)).target).toBeCloseTo(19, 6);
    expect(thermalEvaluate(r, envFor(r, s, true)).target).toBeCloseTo(19 + 8 * 0.75, 6);
    addItem(r, fire.station!.fuelC, 'wood', 1);
    // Second fire on a free tile whose line of sight to the player is clear (physical LOS is required).
    let f2: any = null;
    for (const [dx, dy] of [[0, 2], [-2, 0], [0, -2], [-1, 2], [-2, 2], [2, -2], [-2, -2], [-3, 0], [0, 3]]) {
      if (!act(g, 'build', { struct: 'campfire', tx: s.x + dx, ty: s.y + dy }).ok) continue;
      const cand = Object.values(r.entities).find(e => e.type === 'campfire' && e.tx === s.x + dx && e.ty === s.y + dy)!;
      addItem(r, cand.station!.fuelC, 'wood', 1);
      if (thermalEvaluate(r, envFor(r, s, true)).heat.sources.some(h => h.id === cand.id)) { f2 = cand; break; }
      // Not in line of sight from here: remove it so the cap test keeps a clean state.
      destroyStructure(r, cand, T0 + 5);
    }
    expect(f2).toBeTruthy();
    // 18 + 18 + 8 = 44 raw -> capped at 40 -> bonus 30 (cap of the 0.75 mapping), target 19 + 30.
    const both = thermalEvaluate(r, envFor(r, s, true));
    expect(both.heat.sources.length).toBe(2);
    expect(both.target).toBeCloseTo(19 + 30, 6);
  });

  it('a wall between player and campfire blocks the heat; a destroyed heater contributes nothing', () => {
    const { r, s, fire } = campSetup(313, 2);
    const grid = blockGrid(r); void grid;
    // Place a wall tile on the straight line between the player and the fire.
    const mid = { tx: s.x + 1, ty: s.y };
    r.terrain[mid.ty * WW + mid.tx] = { t: T.PWALL };
    markDirty();
    expect(thermalEvaluate(r, envFor(r, s)).heat.sources.length).toBe(0);
    delete r.terrain[mid.ty * WW + mid.tx]; markDirty();
    expect(thermalEvaluate(r, envFor(r, s)).heat.sources.length).toBe(1);
    destroyStructure(r, fire, T0 + 10);
    expect(thermalEvaluate(r, envFor(r, s)).heat.sources.length).toBe(0);
  });

  it('warmth integrator is exact exponential approach and the cold boundary splits the slice', () => {
    expect(thermalStep(100, 19, 1)).toBeCloseTo(19 + 81 * Math.exp(-1.6), 9);
    expect(thermalStep(50, 50, 10)).toBe(50);
    const { r, s } = campSetup(313, 0);
    const env = envFor(r, s);
    // Cold boundary must be a finite event when warmth falls toward a target below 8.
    expect(thermalBoundaryMs(r, env, 30, 0)).toBeGreaterThan(0);
    expect(Number.isFinite(thermalBoundaryMs(r, env, 30, 0))).toBe(true);
  });
});

describe('B03-A offline chronology and save custody', () => {
  it('one 2h settle equals eight 15-minute partitions for warmth, HP, fuel stock and the exact heat-out receipt', () => {
    const { g, fire } = campSetup(313, 0);
    // 30 wood = 600 s of paid fuel (20 s each). The fire goes out at T0+600 s while away.
    addItem(g.run!, fire.station!.fuelC, 'wood', 30);
    g.run!.player.warmth = 60; g.run!.player.hp = 100; g.run!.player.hunger = 80; g.run!.player.thirst = 80;
    const a = copy(g), b = copy(g);
    settle(a, T0 + 2 * 3600000, true);
    for (let i = 1; i <= 8; i++) settle(b, T0 + i * 15 * 60000, true);
    const runA = a.run!, runB = b.run!;
    expect(runA.player.warmth).toBeCloseTo(runB.player.warmth, 6);
    expect(runA.player.hp).toBeCloseTo(runB.player.hp, 6);
    expect(countItem(runA, runA.entities[fire.id].station!.fuelC, 'wood')).toBe(0);
    expect(countItem(runB, runB.entities[fire.id].station!.fuelC, 'wood')).toBe(0);
    const outA = runA.receipts.filter(x => x.kind === 'heat.out');
    const outB = runB.receipts.filter(x => x.kind === 'heat.out');
    expect(outA.length).toBe(1); expect(outB.length).toBe(1);
    expect(outA[0].at).toBe(outB[0].at);
    expect(outA[0].at).toBeGreaterThanOrEqual(T0 + 599000);
    expect(outA[0].at).toBeLessThanOrEqual(T0 + 601000);
  });

  it('save and reload keeps the thermal state; a repeated settle at the same time adds no second heat-out receipt', () => {
    const { g, fire } = campSetup(313, 0);
    addItem(g.run!, fire.station!.fuelC, 'wood', 5);
    const first = copy(g);
    settle(first, T0 + 3600000, true);
    const after1 = first.run!.receipts.filter(x => x.kind === 'heat.out').length;
    const reloaded = copy(first);
    expect(validate(reloaded)).toBeTruthy();
    settle(reloaded, T0 + 3600000, true);
    expect(reloaded.run!.receipts.filter(x => x.kind === 'heat.out').length).toBe(after1);
    expect(reloaded.run!.player.warmth).toBeCloseTo(first.run!.player.warmth, 9);
  });

  it('a live survival tick with a burning fire warms the player toward the physical target, not to a fixed 100', () => {
    const { g, r, fire } = campSetup(313, 4);
    r.player.warmth = 10;
    const input = { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false } as any;
    // 4 wood = 80 s of paid fuel; tick() clamps each call to 50 ms, so 800 calls = 40 s keeps the fire lit.
    for (let i = 1; i <= 800; i++) tick(g, input, 50, T0 + i * 50);
    expect(heaterStatus(r, r.entities[fire.id])?.active).toBe(true);
    const env = envFor(r, { x: Math.floor(r.player.x / TILE), y: Math.floor(r.player.y / TILE) });
    expect(thermalEvaluate(r, env).target).toBeCloseTo(32.5, 6);
    // Exact integrator: 800 x 50 ms = 0.667 min at 1.6/min from 10 toward 32.5 (no fixed 100 ceiling).
    expect(r.player.warmth).toBeCloseTo(32.5 - 22.5 * Math.exp(-1.6 * 40 / 60), 1);
  });
});
