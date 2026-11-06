// B05-R: physical oil pump on an AUTHORIZED source (test fixture authority only), crude petroleum, refinery crude recipe.
// CONTROLLED FIXTURES (disclosed): the test-only source registry entry, a level-2 workbench fixture for reach, and fuel loaded into the pump.
import { describe, it, expect, afterEach } from 'vitest';
import { BAL, TILE, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, dispatch, mkContainer, newGame, stepStations, registerTestOilSource, authorizedOilSource } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { serializeSnapshot, validate } from '../src/game/persist';
import { ITEMS, RECIPES } from '../src/game/catalog';

const T = Date.UTC(2026, 10, 6);
let serial = 0;
const act = (g: GameState, type: string, p: object = {}, now = T + 1) => dispatch(g, { id: `b05r-${++serial}`, type, ...p }, now);
function setup(seed = 81) {
  setActiveLayout('shipping_fresh');
  const g = newGame();
  expect(act(g, 'startRun', { character: 'female', seed }, T).ok).toBe(true);
  g.run!.creatures = [];
  return g;
}
afterEach(() => setActiveLayout('shipping'));
const reloaded = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
const crude = (c: { slots: any[] }) => c.slots.filter(s => s?.key === 'crude_petroleum').reduce((a, s) => a + s.qty, 0);
/** Controlled fixture: a pump on the authorized test source at the player's tile, with fuel and output containers. */
function fixturePump(g: GameState, stock = 4): Entity {
  const r = g.run!, p = r.player, tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  registerTestOilSource(r, tx, ty, stock);
  const e: Entity = { id: `fixture-pump-${++serial}`, kind: 'struct', type: 'oil_pump', x: tx * TILE + 8, y: ty * TILE + 8, tx, ty, hp: BAL.oilPumpV1.hp, maxHp: BAL.oilPumpV1.hp,
    station: { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 3).id, outC: mkContainer(r, 'out', 6).id } };
  r.entities[e.id] = e;
  return e;
}
const pumpedJob = (g: GameState, pump: Entity, wood = 2) => {
  addItem(g.run!, pump.station!.fuelC, 'wood', wood);
  const res = act(g, 'craft', { recipe: 'pump_crude', eid: pump.id });
  expect(res.ok, res.reason).toBe(true);
};

describe('B05-R oil source authority: production placement is refused', () => {
  it('a pump with no authorized source cannot be built (Map placement pending)', () => {
    const g = setup(), r = g.run!;
    for (const [k, q] of BAL.oilPumpV1.cost as [string, number][]) addItem(r, 'inv', k, q);
    const p = r.player, tx = Math.floor(p.x / TILE) + 1, ty = Math.floor(p.y / TILE);
    const res = act(g, 'build', { struct: 'oil_pump', tx, ty });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/authorized oil site/);
    expect(Object.values(r.entities).some(e => e.type === 'oil_pump')).toBe(false);
  });
  it('the test authority is not a production source: none is registered by default', () => {
    const g = setup();
    expect(g.run!.oilSources).toBeUndefined();
    expect(authorizedOilSource(g.run!, 0, 0)).toBeNull();
  });
});

describe('B05-R pump extraction: one physical crude per cycle, source stock decremented in the same commit', () => {
  it('a fuelled, queued cycle yields one crude and removes one unit of source stock (conservation)', () => {
    const g = setup(), r = g.run!; const pump = fixturePump(g, 4);
    pumpedJob(g, pump, 2);                                  // 2 wood = 40 fuel-s; the cycle needs 12 s
    expect(pump.station!.queue[0].total).toBe(BAL.oilPumpV1.secs * 1000);
    stepStations(g, BAL.oilPumpV1.secs * 1000, T + 60_000);
    expect(crude(C(r, pump.station!.outC))).toBe(1);
    expect(r.oilSources!['oil:' + pump.tx + ':' + pump.ty].stock).toBe(3);
    expect(pump.station!.queue.length).toBe(0);
    // conservation: source stock + output = the initial source stock
    expect(r.oilSources!['oil:' + pump.tx + ':' + pump.ty].stock + crude(C(r, pump.station!.outC))).toBe(4);
  });
  it('fuel runs out mid-cycle: the job pauses with progress kept and no output', () => {
    const g = setup(), r = g.run!; const pump = fixturePump(g, 4);
    addItem(g.run!, pump.station!.fuelC, 'wood', 1);        // 1 wood = 20 fuel-s < 2 cycles (24 s)
    expect(act(g, 'craft', { recipe: 'pump_crude', eid: pump.id }).ok).toBe(true);
    expect(act(g, 'craft', { recipe: 'pump_crude', eid: pump.id }).ok).toBe(true);
    stepStations(g, 30_000, T + 60_000);
    expect(crude(C(r, pump.station!.outC))).toBe(1);        // first cycle finished from 20 s of fuel
    expect(pump.station!.queue.length).toBe(1);             // second cycle still queued
    expect(pump.station!.queue[0].left).toBeGreaterThan(0); // paused, not finished
    expect(pump.station!.queue[0].left).toBeLessThan(BAL.oilPumpV1.secs * 1000);
    expect(r.oilSources!['oil:' + pump.tx + ':' + pump.ty].stock).toBe(3);
  });
  it('output full: the cycle blocks, stock is NOT decremented and no crude is created', () => {
    const g = setup(), r = g.run!; const pump = fixturePump(g, 4);
    for (let i = 0; i < 6; i++) addItem(r, pump.station!.outC, 'wood', 60);  // fill every output slot
    pumpedJob(g, pump, 2);
    stepStations(g, BAL.oilPumpV1.secs * 1000 + 5000, T + 60_000);
    expect(crude(C(r, pump.station!.outC))).toBe(0);
    expect(r.oilSources!['oil:' + pump.tx + ':' + pump.ty].stock).toBe(4);
    expect(pump.station!.queue.length).toBe(1);              // still queued, not lost
  });
  it('depletion after queueing: completion is refused, nothing is granted, the job stays cancellable', () => {
    const g = setup(), r = g.run!; const pump = fixturePump(g, 1);
    pumpedJob(g, pump, 2);
    r.oilSources!['oil:' + pump.tx + ':' + pump.ty].stock = 0;   // another path empties the source
    stepStations(g, BAL.oilPumpV1.secs * 1000 + 1000, T + 60_000);
    expect(crude(C(r, pump.station!.outC))).toBe(0);
    expect(pump.station!.queue.length).toBe(1);
    expect(pump.station!.stateCode).toBe('source_empty');
  });
  it('a new cycle cannot be queued on an empty source', () => {
    const g = setup(), r = g.run!; const pump = fixturePump(g, 1);
    r.oilSources!['oil:' + pump.tx + ':' + pump.ty].stock = 0;
    addItem(r, pump.station!.fuelC, 'wood', 2);
    const res = act(g, 'craft', { recipe: 'pump_crude', eid: pump.id });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/no oil left/);
  });
});

describe('B05-R save/reload and offline: no duplicate grant, same result on replay', () => {
  it('a queued cycle survives save/reload and is completed exactly once', () => {
    const g = setup(); const pump = fixturePump(g, 4);
    pumpedJob(g, pump, 2);
    const snap = reloaded(g);
    expect(validate(snap)).not.toBeNull();
    const rp = snap.run!.entities[pump.id];
    stepStations(snap, BAL.oilPumpV1.secs * 1000, T + 60_000);
    stepStations(snap, 60_000, T + 120_000);                 // replay tail: nothing more to do
    expect(crude(C(snap.run!, rp.station!.outC))).toBe(1);
    expect(snap.run!.oilSources!['oil:' + pump.tx + ':' + pump.ty].stock).toBe(3);
  });
  it('a finished cycle is not re-granted when the same state is reloaded again', () => {
    const g = setup(); const pump = fixturePump(g, 4);
    pumpedJob(g, pump, 2);
    stepStations(g, BAL.oilPumpV1.secs * 1000, T + 60_000);
    const once = reloaded(g);
    stepStations(once, 60_000, T + 120_000);
    expect(crude(C(once.run!, once.run!.entities[pump.id].station!.outC))).toBe(1);
  });
});

describe('B05-R refinery turns crude into the existing fuel canister', () => {
  it('four crude + glass refines into one Fuel Canister, which is the existing generator/motorbike fuel', () => {
    const g = setup(), r = g.run!;
    const fx = { ...fixturePump(g, 0) }; // only used for reach-free refinery fixture below
    expect(fx).toBeDefined();
    const ref: Entity = { id: `fixture-refinery-${++serial}`, kind: 'struct', type: 'refinery', x: r.player.x + 8, y: r.player.y, tx: Math.floor(r.player.x / TILE), ty: Math.floor(r.player.y / TILE), hp: BAL.oilRefineryV1.hp, maxHp: BAL.oilRefineryV1.hp, identity: 'refinery-v1', station: { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 3).id, outC: mkContainer(r, 'out', 6).id, level: undefined } as any };
    r.entities[ref.id] = ref;
    addItem(r, ref.station!.fuelC, 'wood', 2);
    addItem(r, 'inv', 'crude_petroleum', 4); addItem(r, 'inv', 'glass', 1);
    const bench: Entity = { id: `fixture-bench-${++serial}`, kind: 'struct', type: 'workbench', x: ref.x, y: ref.y, tx: ref.tx, ty: ref.ty, hp: 160, maxHp: 160, station: { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 0).id, outC: mkContainer(r, 'out', 4).id, level: 2 } };
    r.entities[bench.id] = bench;
    const res = act(g, 'craft', { recipe: 'refinery_crude', eid: ref.id });
    expect(res.ok, res.reason).toBe(true);
    expect(countItem(r, 'inv', 'crude_petroleum')).toBe(0);  // paid up front, reserved in the job
    stepStations(g, RECIPES.refinery_crude.secs * 1000, T + 90_000);
    expect(countItem(r, ref.station!.outC, 'fuel_can')).toBe(1);
    expect(ITEMS.fuel_can.fuel).toBeGreaterThan(0);          // consumed by the existing generator and motorbike paths
  });
  it('the crude recipe is derived from the single balance authority, not a copied number', () => {
    expect(RECIPES.refinery_crude.ins).toEqual([['crude_petroleum', 4], ['glass', 1]]);
    expect(RECIPES.refinery_crude.out).toBe('fuel_can');
    expect(RECIPES.refinery_crude.secs).toBe(BAL.oilRefineryV1.recipes.crude.secs);
    expect(RECIPES.pump_crude.ins).toEqual([]);
  });
});

describe('B05-R persistence rejects invalid pump and source states', () => {
  it('rejects a production-authority or negative-stock oil source', () => {
    const g = setup(); fixturePump(g, 4);
    const bad = reloaded(g) as any;
    const key = Object.keys(bad.run.oilSources)[0];
    bad.run.oilSources[key].authority = 'map-v1';
    expect(validate(bad)).toBeNull();
    bad.run.oilSources[key].authority = 'test-fixture-v1';
    bad.run.oilSources[key].stock = -1;
    expect(validate(bad)).toBeNull();
  });
  it('rejects a pump cycle with the wrong canonical time or held inputs', () => {
    const g = setup(); const pump = fixturePump(g, 4);
    pumpedJob(g, pump, 2);
    const bad = reloaded(g) as any;
    bad.run.entities[pump.id].station.queue[0].total = 999;
    expect(validate(bad)).toBeNull();
    bad.run.entities[pump.id].station.queue[0].total = BAL.oilPumpV1.secs * 1000;
    bad.run.entities[pump.id].station.queue[0].reserved = [{ key: 'wood', qty: 1, uid: 'x' }];
    expect(validate(bad)).toBeNull();
  });
});
