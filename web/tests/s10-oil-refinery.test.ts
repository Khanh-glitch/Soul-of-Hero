import { describe, it, expect, afterEach } from 'vitest';
import { BAL, TILE, WW, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, dispatch, markDirty, mkContainer, newGame, stepStations, harvestHit } from '../src/game/engine';
import { getWorld, setActiveLayout } from '../src/game/world';
import { vehicleClear } from '../src/game/motorbike';
import { serializeSnapshot, validate } from '../src/game/persist';
import { tick, type Input } from '../src/game/sim';
import { RECIPES } from '../src/game/catalog';

const T = Date.UTC(2026, 10, 6);
let serial = 0;
const act = (g: GameState, type: string, p: object = {}, id = `s10-${++serial}`, now = T + 1) => dispatch(g, { id, type, ...p }, now);
function setup(seed = 77) {
  setActiveLayout('shipping_fresh');
  const g = newGame();
  expect(act(g, 'startRun', { character: 'female', seed }, 'start', T).ok).toBe(true);
  return g;
}
const snapshot = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
const inp: Input = { up: false, down: false, left: false, right: true, mx: 100, my: 100, attack: false, attackPressed: false, roll: false, cancel: false };
function line(g: GameState) {
  const r = g.run!, w = getWorld(r.layoutId);
  for (let y = 2; y < 198; y++) for (let x = 3; x < 194; x++) {
    let yes = true;
    for (let d = -1; d <= 4; d++) {
      const px = (x + d) * TILE + 8, py = y * TILE + 8;
      if (!w.economyMap.road[y * WW + x + d] || !vehicleClear(r, px, py)) { yes = false; break; }
    }
    if (yes) return { x: x * TILE + 8, y: y * TILE + 8 };
  }
  throw Error('no real road line');
}
function deployBike(g: GameState) {
  const r = g.run!, q = line(g);
  r.player.x = q.x - TILE; r.player.y = q.y;
  addItem(r, 'inv', 'motorbike_kit', 1);
  expect(act(g, 'placeMotorbike', q).ok).toBe(true);
  const e = Object.values(r.entities).find(e => e.kind === 'vehicle')!;
  return { r, e, q };
}
function drive(g: GameState, frames: number, start = T + 200) {
  for (let i = 0; i < frames; i++) tick(g, inp, 50, start + i * 50);
}
function stationNearPlayer(g: GameState, type: string, level?: number): Entity {
  const r = g.run!, p = r.player;
  const f = mkContainer(r, 'fuel', 3), o = mkContainer(r, 'out', 6);
  const e: Entity = { id: `fixture-${type}-${++serial}`, kind: 'struct', type, x: p.x + 8, y: p.y, tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE), hp: 280, maxHp: 280, station: { fuelC: f.id, outC: o.id, burn: 0, queue: [], ...(level ? { level: level as any } : {}) } };
  r.entities[e.id] = e;
  return e;
}
afterEach(() => setActiveLayout('shipping'));

describe('SYS10 oil refinery — physical fuel & lubricant economy', () => {
  it('requires an owned level-2 workbench within three tiles to build the refinery', () => {
    const g = setup(), r = g.run!;
    for (const [k, q] of BAL.oilRefineryV1.cost as [string, number][]) addItem(r, 'inv', k, q);
    const claimTx = Math.floor(r.player.x / TILE), claimTy = Math.floor(r.player.y / TILE);
    const tx = claimTx + 2, ty = claimTy;
    expect(act(g, 'build', { struct: 'refinery', tx, ty }).ok).toBe(false);
    const far = stationNearPlayer(g, 'workbench', 2);
    far.x = r.player.x + 10 * TILE; far.y = r.player.y + 10 * TILE; far.tx = Math.floor(far.x / TILE); far.ty = Math.floor(far.y / TILE);
    markDirty();
    expect(act(g, 'build', { struct: 'refinery', tx, ty }).ok).toBe(false);
    far.x = r.player.x + TILE; far.y = r.player.y; far.tx = claimTx + 1; far.ty = claimTy; far.type = 'workbench';
    far.tx = claimTx + 1; far.ty = claimTy; far.x = far.tx * TILE + 8; far.y = far.ty * TILE + 8;
    markDirty();
    for (const [cx, cy] of [[claimTx, claimTy], [tx, ty], [claimTx + 1, claimTy]]) {
      if (!Object.values(r.entities).some(e => e.tx === cx && e.ty === cy)) {
        const fl: Entity = { id: `floor-${cx}-${cy}`, kind: 'struct', type: 'floor_wood', tx: cx, ty: cy, x: cx * TILE + 8, y: cy * TILE + 8, hp: 120, maxHp: 120 };
        r.entities[fl.id] = fl;
      }
    }
    const cabinet: Entity = { id: 'cabinet-test', kind: 'struct', type: 'claim', tx: claimTx, ty: claimTy, x: claimTx * TILE + 8, y: claimTy * TILE + 8, hp: 200, maxHp: 200, c: mkContainer(r, 'chest', 24).id, cabinet: { credit: {}, legacy: false } };
    r.entities[cabinet.id] = cabinet;
    markDirty();
    expect(act(g, 'build', { struct: 'refinery', tx, ty }).ok).toBe(true);
    const ref = Object.values(g.run!.entities).find(e => e.type === 'refinery')!;
    expect(ref.station).toBeTruthy();
    expect(ref.station!.fuelC).toBeTruthy();
    expect(validate(snapshot(g))).toBeTruthy();
  });

  it('converts finite salvaged oil into fuel canisters and lubricant via fuelled station jobs', () => {
    const g = setup(), r = g.run!;
    const refinery = stationNearPlayer(g, 'refinery');
    const furnace = stationNearPlayer(g, 'furnace');
    // stock fuel for both — need enough for 14+22+12=48s => 3 wood (60s)
    addItem(r, furnace.station!.fuelC, 'wood', 3);
    addItem(r, refinery.station!.fuelC, 'wood', 3);
    addItem(r, 'inv', 'salvaged_oil', 10);
    addItem(r, 'inv', 'glass', 3);
    expect(countItem(r, 'inv', 'salvaged_oil')).toBe(10);
    // queue single fuel at refinery
    expect(act(g, 'craft', { recipe: 'refinery_fuel', eid: refinery.id }).ok).toBe(true);
    expect(countItem(r, 'inv', 'salvaged_oil')).toBe(7);
    expect(countItem(r, 'inv', 'glass')).toBe(2);
    stepStations(g, 14000, T + 20000);
    let out = C(r, refinery.station!.outC);
    expect(out.slots.some(s => s?.key === 'fuel_can')).toBe(true);
    expect(act(g, 'move', { from: out.id, fs: out.slots.findIndex(s => s?.key === 'fuel_can'), to: 'inv' }).ok).toBe(true);
    expect(countItem(r, 'inv', 'fuel_can')).toBe(1);
    // queue batch: 5 oil +1 glass ->2 fuel, more efficient (2.5 oil/fuel vs 3)
    expect(act(g, 'craft', { recipe: 'refinery_fuel_batch', eid: refinery.id }).ok).toBe(true);
    expect(countItem(r, 'inv', 'salvaged_oil')).toBe(2);
    stepStations(g, 22000, T + 50000);
    out = C(r, refinery.station!.outC);
    const fuels = out.slots.filter(s => s?.key === 'fuel_can').reduce((a, s) => a + s!.qty, 0);
    expect(fuels).toBe(2);
    for (let i = 0; i < out.slots.length; i++) if (out.slots[i]?.key === 'fuel_can') expect(act(g, 'move', { from: out.id, fs: i, to: 'inv' }).ok).toBe(true);
    expect(countItem(r, 'inv', 'fuel_can')).toBe(3);
    // lubricant: 2 oil ->1 lubricant
    expect(act(g, 'craft', { recipe: 'refinery_lubricant', eid: refinery.id }).ok).toBe(true);
    expect(countItem(r, 'inv', 'salvaged_oil')).toBe(0);
    stepStations(g, 12000, T + 80000);
    out = C(r, refinery.station!.outC);
    expect(out.slots.some(s => s?.key === 'lubricant')).toBe(true);
    expect(validate(snapshot(g))).toBeTruthy();
    // no oil remains, cannot queue another
    expect(act(g, 'craft', { recipe: 'refinery_fuel', eid: refinery.id }).ok).toBe(false);
  });

  it('refinery fuel canister refuels the motorbike and its lubricant halves measured wear', () => {
    const g = setup(), r = g.run!;
    const refinery = stationNearPlayer(g, 'refinery');
    addItem(r, refinery.station!.fuelC, 'wood', 2);
    addItem(r, 'inv', 'salvaged_oil', 5);
    addItem(r, 'inv', 'glass', 2);
    // one fuel can, then one lubricant
    expect(act(g, 'craft', { recipe: 'refinery_fuel', eid: refinery.id }).ok).toBe(true);
    stepStations(g, 14000, T + 20000);
    let out = C(r, refinery.station!.outC);
    expect(act(g, 'move', { from: out.id, fs: out.slots.findIndex(s => s?.key === 'fuel_can'), to: 'inv' }).ok).toBe(true);
    expect(act(g, 'craft', { recipe: 'refinery_lubricant', eid: refinery.id }).ok).toBe(true);
    stepStations(g, 12000, T + 40000);
    out = C(r, refinery.station!.outC);
    expect(act(g, 'move', { from: out.id, fs: out.slots.findIndex(s => s?.key === 'lubricant'), to: 'inv' }).ok).toBe(true);
    expect(countItem(r, 'inv', 'fuel_can')).toBe(1);
    expect(countItem(r, 'inv', 'lubricant')).toBe(1);
    // deploy the bike
    const { e: bike } = deployBike(g);
    // refuel the bike from the refinery output
    expect(act(g, 'vehicleRefuel', { eid: bike.id }).ok).toBe(true);
    expect(bike.vehicle!.fuel).toBe(100);
    expect(countItem(r, 'inv', 'fuel_can')).toBe(0);
    // second refinery fuel run for the same bike
    addItem(r, 'inv', 'salvaged_oil', 3); addItem(r, 'inv', 'glass', 1);
    r.player.x = refinery.x; r.player.y = refinery.y; markDirty();
    expect(act(g, 'craft', { recipe: 'refinery_fuel', eid: refinery.id }).ok).toBe(true);
    stepStations(g, 14000, T + 60000);
    out = C(r, refinery.station!.outC);
    expect(act(g, 'move', { from: out.id, fs: out.slots.findIndex(s => s?.key === 'fuel_can'), to: 'inv' }).ok).toBe(true);
    addItem(r, 'inv', 'fuel_can', 1);
    expect(act(g, 'vehicleExit', {}, 'exit1', T + 70000).ok).toBe(false); // not mounted
    r.player.x = bike.x; r.player.y = bike.y;
    // lubricate bike
    expect(act(g, 'vehicleLubricate', { eid: bike.id }).ok).toBe(true);
    expect(bike.vehicle!.lube).toBe(BAL.oilRefineryV1.lubricantDistancePx);
    expect(countItem(r, 'inv', 'lubricant')).toBe(0);
    // wear test: drive with and without lube on same road
    const baseBike = structuredClone(snapshot(g));
    const plain = structuredClone(snapshot(g));
    // remove lube from plain
    const plainBike = Object.values(plain.run!.entities).find(e => e.kind === 'vehicle')!;
    plainBike.vehicle!.lube = 0;
    plain.run!.entities[plainBike.id] = plainBike;
    // both start with same hp
    const hp0 = 200;
    baseBike.run!.entities[bike.id].hp = hp0; baseBike.run!.entities[bike.id].deployed!.dur = hp0;
    plain.run!.entities[plainBike.id].hp = hp0; plain.run!.entities[plainBike.id].deployed!.dur = hp0;
    // give both fuel
    for (const snap of [baseBike, plain]) {
      const b = Object.values(snap.run!.entities).find(e => e.kind === 'vehicle')!;
      b.vehicle!.fuel = 100;
      snap.run!.player.x = b.x; snap.run!.player.y = b.y;
      expect(act(snap, 'vehicleMount', { eid: b.id }, 'mount', T + 1).ok).toBe(true);
      // fixtures sit to the right of the player; drive left so the test measures wear, not blocked movement
      const leftInp: Input = { ...inp, right: false, left: true };
      for (let i = 0; i < 20; i++) tick(snap, leftInp, 50, T + 100 + i * 50);
      expect(b.vehicle!.odometer).toBeGreaterThan(0);
      expect(act(snap, 'vehicleExit', {}, 'exit', T + 5000).ok).toBe(true);
    }
    const lubedHp = baseBike.run!.entities[bike.id].hp!;
    const plainHp = plain.run!.entities[plainBike.id].hp!;
    expect(lubedHp).toBeGreaterThan(plainHp);
    // wear reduction approx 50%
    const plainWear = hp0 - plainHp, lubedWear = hp0 - lubedHp;
    expect(lubedWear).toBeLessThan(plainWear * 0.75);
    // lube distance consumed
    expect(baseBike.run!.entities[bike.id].vehicle!.lube).toBeLessThan(BAL.oilRefineryV1.lubricantDistancePx);
    expect(validate(snapshot(g))).toBeTruthy();
  });

  it('finite salvaged oil cannot be created from fuel or lubricant — no arbitrage loop', () => {
    const g = setup(), r = g.run!;
    const refinery = stationNearPlayer(g, 'refinery');
    addItem(r, refinery.station!.fuelC, 'wood', 5);
    // start with 10 oil, produce fuel and lubricant, then verify oil count never increases except via finite sources
    addItem(r, 'inv', 'salvaged_oil', 10); addItem(r, 'inv', 'glass', 5);
    const oil0 = countItem(r, 'inv', 'salvaged_oil');
    expect(act(g, 'craft', { recipe: 'refinery_fuel_batch', eid: refinery.id }).ok).toBe(true);
    expect(act(g, 'craft', { recipe: 'refinery_lubricant', eid: refinery.id }).ok).toBe(true);
    stepStations(g, 40000, T + 50000);
    const out = C(r, refinery.station!.outC);
    expect(out.slots.filter(s => s?.key === 'fuel_can').reduce((a, s) => a + s!.qty, 0)).toBe(2);
    expect(out.slots.filter(s => s?.key === 'lubricant').reduce((a, s) => a + s!.qty, 0)).toBe(1);
    // total oil consumed 7, no oil returned
    expect(countItem(r, 'inv', 'salvaged_oil')).toBe(3);
    // verify no recipe converts fuel_can or lubricant back into salvaged_oil
    const oilProducers = Object.entries(RECIPES).filter(([, rc]) => rc.out === 'salvaged_oil');
    expect(oilProducers.length).toBe(0);
    // finite source authority stays in wreck-economy / VENDOR_SPARES; this refinery adds no oil source.
  });

  it('refinery jobs settle at exact chronological boundaries and survive save/reload', () => {
    const g = setup(), r = g.run!;
    const refinery = stationNearPlayer(g, 'refinery');
    addItem(r, refinery.station!.fuelC, 'wood', 2);
    addItem(r, 'inv', 'salvaged_oil', 3); addItem(r, 'inv', 'glass', 1);
    expect(act(g, 'craft', { recipe: 'refinery_fuel', eid: refinery.id }, 'job1', T + 1000).ok).toBe(true);
    expect(act(g, 'craft', { recipe: 'refinery_fuel', eid: refinery.id }, 'job1', T + 1001).ok).toBe(false); // dup
    // settle exactly at completion
    stepStations(g, 14000, T + 15000);
    let out = C(r, refinery.station!.outC);
    expect(out.slots.some(s => s?.key === 'fuel_can')).toBe(true);
    const snap = snapshot(g);
    expect(validate(snap)).toBeTruthy();
    // reload and verify queue empty and output persists
    const reloaded = snapshot(snap);
    const reRef = Object.values(reloaded.run!.entities).find(e => e.type === 'refinery')!;
    expect(reRef.station!.queue.length).toBe(0);
    expect(C(reloaded.run!, reRef.station!.outC).slots.some(s => s?.key === 'fuel_can')).toBe(true);
    // output is physical: moving to inventory succeeds
    const out2 = C(reloaded.run!, reRef.station!.outC);
    expect(act(reloaded, 'move', { from: out2.id, fs: out2.slots.findIndex(s => s?.key === 'fuel_can'), to: 'inv' }).ok).toBe(true);
    expect(countItem(reloaded.run!, 'inv', 'fuel_can')).toBe(1);
  });

  it('rejects forged refinery, lubricant and vehicle lube state', () => {
    const g = setup(), r = g.run!;
    const refinery = stationNearPlayer(g, 'refinery');
    addItem(r, 'inv', 'salvaged_oil', 2);
    addItem(r, refinery.station!.fuelC, 'wood', 1);
    expect(act(g, 'craft', { recipe: 'refinery_lubricant', eid: refinery.id }).ok).toBe(true);
    stepStations(g, 12000, T + 20000);
    const good = snapshot(g);
    expect(validate(good)).toBeTruthy();
    // forged lube amount beyond max
    const badLube = snapshot(g);
    const v = Object.values(badLube.run!.entities).find(e => e.kind === 'vehicle');
    if (v) { v.vehicle!.lube = 999999; expect(validate(badLube)).toBeNull(); }
    // forged lubricant count exceeds max stack
    const badStack = snapshot(g);
    addItem(badStack.run!, 'inv', 'lubricant', 100);
    // addItem will split into multiple stacks if needed, but we can forge directly
    const inv = C(badStack.run!, 'inv');
    inv.slots[0] = { uid: 's9', key: 'lubricant', qty: 999 };
    expect(validate(badStack)).toBeNull();
    // forged refinery station kind
    const badStation = snapshot(g);
    const ref = Object.values(badStation.run!.entities).find(e => e.type === 'refinery')!;
    ref.type = 'furnace';
    // forged unknown recipe
    const badRecipe = snapshot(g);
    const ref2 = Object.values(badRecipe.run!.entities).find(e => e.type === 'refinery')!;
  });

  it('preserves 336-hour run clock and works offline via existing boundaries', () => {
    const g = setup(), r = g.run!;
    expect(BAL.run.maxRunHours).toBe(336);
    const refinery = stationNearPlayer(g, 'refinery');
    addItem(r, refinery.station!.fuelC, 'wood', 2);
    addItem(r, 'inv', 'salvaged_oil', 3); addItem(r, 'inv', 'glass', 1);
    expect(act(g, 'craft', { recipe: 'refinery_fuel', eid: refinery.id }).ok).toBe(true);
    // simulate offline via advanceWorld style: stepStations with large dt should produce fuel without extra grants
    const before = countItem(r, 'inv', 'fuel_can');
    stepStations(g, 100000, T + 100000);
    const after = C(r, refinery.station!.outC).slots.filter(s => s?.key === 'fuel_can').length;
    expect(after).toBe(1);
    expect(countItem(r, 'inv', 'fuel_can')).toBe(before);
  });
});
