// B05-R P0: one station fuel policy (stationBurnable) used by burn, deposit and UI.
// Fixtures: a refinery and a base generator placed in the test run (controlled fixtures, labelled).
import { describe, it, expect, afterEach } from 'vitest';
import { BAL, TILE, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, dispatch, mkContainer, newGame, stepStations, isStationFuel } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { serializeSnapshot, validate } from '../src/game/persist';
import { stationBurnable } from '../src/game/catalog';

const T = Date.UTC(2026, 10, 7);
let clock = T + 1; let serial = 0;
const act = (g: GameState, type: string, p: object = {}) => dispatch(g, { id: `fp-${++serial}`, type, ...p }, clock);
afterEach(() => setActiveLayout('shipping'));
function setup() {
  setActiveLayout('shipping_fresh');
  const g = newGame(); expect(act(g, 'startRun', { character: 'female', seed: 111 }).ok).toBe(true);
  g.run!.creatures = []; return g;
}
function refineryWithBench(g: GameState): Entity {
  const r = g.run!, p = r.player, tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  const ref: Entity = { id: 'e' + (r.nextId++).toString(36), kind: 'struct', type: 'refinery', x: tx * TILE + 8, y: ty * TILE + 8, tx, ty, hp: BAL.oilRefineryV1.hp, maxHp: BAL.oilRefineryV1.hp, identity: 'refinery-v1', station: { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 3).id, outC: mkContainer(r, 'out', 6).id } as any };
  r.entities[ref.id] = ref;
  const bench: Entity = { id: 'e' + (r.nextId++).toString(36), kind: 'struct', type: 'workbench', x: ref.x, y: ref.y, tx, ty, hp: 160, maxHp: 160, station: { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 0).id, outC: mkContainer(r, 'out', 4).id, level: 2 } as any };
  r.entities[bench.id] = bench;
  return ref;
}
const snap = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;

describe('B05-R station fuel policy: one rule for burn, deposit and display', () => {
  it('the policy: wood, charcoal, coal and briquette are station fuel; Fuel Canister and non-fuel are not', () => {
    for (const k of ['wood', 'charcoal', 'coal', 'fuel_briquette']) expect(stationBurnable(k)).toBe(true);
    expect(stationBurnable('fuel_can')).toBe(false);
    expect(stationBurnable('iron_ingot')).toBe(false);
    expect(stationBurnable(undefined)).toBe(false);
  });
  it('a station refuses a Fuel Canister deposit with a reason and consumes nothing', () => {
    const g = setup(), r = g.run!, ref = refineryWithBench(g);
    expect(isStationFuel(r, ref.station!.fuelC)).toBe(true);
    addItem(r, 'inv', 'fuel_can', 1);
    const i = C(r, 'inv').slots.findIndex(s => s?.key === 'fuel_can');
    const res = act(g, 'move', { from: 'inv', fs: i, to: ref.station!.fuelC });
    expect(res.ok).toBe(false);
    expect((res as any).reason).toMatch(/not station fuel/);
    expect(countItem(r, 'inv', 'fuel_can')).toBe(1);
    expect(countItem(r, ref.station!.fuelC, 'fuel_can')).toBe(0);
  });
  it('legitimate wood is accepted by the station and burns while a job runs', () => {
    const g = setup(), r = g.run!, ref = refineryWithBench(g);
    addItem(r, 'inv', 'wood', 1); addItem(r, 'inv', 'salvaged_oil', 3); addItem(r, 'inv', 'glass', 1);
    const w = C(r, 'inv').slots.findIndex(s => s?.key === 'wood');
    expect(act(g, 'move', { from: 'inv', fs: w, to: ref.station!.fuelC }).ok).toBe(true);
    expect(act(g, 'craft', { recipe: 'refinery_fuel', eid: ref.id }).ok).toBe(true);
    stepStations(g, 1000, T + 60_000);
    expect(ref.station!.burn).toBeGreaterThan(0);                 // wood is burning
    stepStations(g, 14_000, T + 61_000);
    expect(countItem(r, ref.station!.outC, 'fuel_can')).toBe(1);   // and the job finished
  });
  it('a station holding only Fuel Canisters does not run; the canisters are kept', () => {
    const g = setup(), r = g.run!, ref = refineryWithBench(g);
    addItem(r, ref.station!.fuelC, 'fuel_can', 2);                 // as an older save would hold them
    addItem(r, 'inv', 'salvaged_oil', 3); addItem(r, 'inv', 'glass', 1);
    expect(act(g, 'craft', { recipe: 'refinery_fuel', eid: ref.id }).ok).toBe(true);
    stepStations(g, 60_000, T + 60_000);
    expect(countItem(r, ref.station!.outC, 'fuel_can')).toBe(0);
    expect(countItem(r, ref.station!.fuelC, 'fuel_can')).toBe(2);
    expect(ref.station!.burn).toBe(0);
  });
  it('an older save with canisters in a station fuel input loads, and the canisters can be taken out to the pack', () => {
    const g = setup(), r = g.run!, ref = refineryWithBench(g);
    addItem(r, ref.station!.fuelC, 'fuel_can', 2);
    const saved = snap(g);
    expect(validate(saved)).not.toBeNull();                       // loads, nothing silently deleted
    const s2 = saved.run!;
    const fc = s2.custody[saved.run!.entities[ref.id].station!.fuelC];
    const idx = fc.slots.findIndex(s => s?.key === 'fuel_can');
    expect(idx).toBeGreaterThanOrEqual(0);
    const out = dispatch(saved, { id: 'fp-take', type: 'move', from: fc.id, to: 'inv', fs: idx } as any, clock);
    expect(out.ok).toBe(true);
    expect(countItem(s2, 'inv', 'fuel_can')).toBeGreaterThanOrEqual(1);   // recovered, not converted or burned
  });
  it('a base generator still accepts and burns a Fuel Canister (consumer unchanged)', () => {
    const g = setup(), r = g.run!;
    const cont = mkContainer(r, 'fuel', 3);
    const gen: Entity = { id: 'e' + (r.nextId++).toString(36), kind: 'struct', type: 'base_generator', x: r.player.x + 8, y: r.player.y, tx: Math.floor(r.player.x / TILE), ty: Math.floor(r.player.y / TILE), hp: 100, maxHp: 100, c: cont.id, basePower: { enabled: true, energy: 0 } as any };
    r.entities[gen.id] = gen;
    addItem(r, 'inv', 'fuel_can', 1);
    const i = C(r, 'inv').slots.findIndex(s => s?.key === 'fuel_can');
    expect(act(g, 'move', { from: 'inv', fs: i, to: cont.id }).ok).toBe(true);
    expect(isStationFuel(r, cont.id)).toBe(false);
    expect(countItem(r, cont.id, 'fuel_can')).toBe(1);
  });
});
