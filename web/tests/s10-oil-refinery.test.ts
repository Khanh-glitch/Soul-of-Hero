import { describe, it, expect, afterEach } from 'vitest';
import { BAL, TILE, WW, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, dispatch, markDirty, mkContainer, newGame, stepStations } from '../src/game/engine';
import { getWorld, setActiveLayout } from '../src/game/world';
import { vehicleClear } from '../src/game/motorbike';
import { serializeSnapshot, validate } from '../src/game/persist';
import { tick, settle, type Input } from '../src/game/sim';
import { ITEMS, RECIPES } from '../src/game/catalog';

// SYS10-R1 fixtures. Stations, injected stock and the motorbike kit are CONTROLLED FIXTURES
// placed by the test; they are not natural-player acquisition evidence.
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
/** Controlled fixture: a station with fuel/out containers placed beside the player. */
function fixtureStation(g: GameState, type: string, level?: number): Entity {
  const r = g.run!, p = r.player;
  const f = mkContainer(r, 'fuel', 3), o = mkContainer(r, 'out', 6);
  const e: Entity = { id: `fixture-${type}-${++serial}`, kind: 'struct', type, x: p.x + 8, y: p.y, tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE), hp: STRUCT_HP(type), maxHp: STRUCT_HP(type), station: { fuelC: f.id, outC: o.id, burn: 0, queue: [], ...(level ? { level: level as any } : {}) } };
  if (type === 'refinery') e.identity = 'refinery-v1';   // same identity stamp the build intent writes
  r.entities[e.id] = e;
  return e;
}
const STRUCT_HP = (type: string) => (type === 'refinery' ? BAL.oilRefineryV1.hp : 160);
const fuelQty = (c: { slots: any[] }) => c.slots.filter(s => s?.key === 'fuel_can').reduce((a, s) => a + s.qty, 0);
const lubeQty = (c: { slots: any[] }) => c.slots.filter(s => s?.key === 'lubricant').reduce((a, s) => a + s.qty, 0);
const bindRefinery = (g: GameState) => { const e = fixtureStation(g, 'refinery'); addItem(g.run!, e.station!.fuelC, 'wood', 3); return e; };
afterEach(() => setActiveLayout('shipping'));

describe('SYS10-R1 oil refinery — canonical balance, industrial co-products, validation', () => {
  it('derives every refinery recipe and cost from the single balance authority', () => {
    const R = BAL.oilRefineryV1.recipes;
    expect(RECIPES.refinery_fuel.ins).toEqual(R.single.ins);
    expect(RECIPES.refinery_fuel_batch.ins).toEqual(R.batch.ins);
    expect(RECIPES.refinery_industrial.ins).toEqual(R.industrial.ins);
    expect(RECIPES.refinery_industrial.outs).toEqual(R.industrial.outs);
    expect(RECIPES.refinery_industrial.secs).toBe(R.industrial.secs);
    expect(RECIPES.refinery_lubricant.outs ?? [[RECIPES.refinery_lubricant.out, RECIPES.refinery_lubricant.qty]]).toEqual(R.lube.outs);
    expect(BAL.motorbike).not.toHaveProperty('lubricantWearReduction');
    expect(BAL.oilRefineryV1.need).toBe('any');
  });

  it('builds the refinery on valid terrain with a level-2 Workbench and NO territory cabinet (K6)', () => {
    const g = setup(), r = g.run!;
    for (const [k, q] of BAL.oilRefineryV1.cost as [string, number][]) addItem(r, 'inv', k, q);
    const p = r.player, tx = Math.floor(p.x / TILE) + 1, ty = Math.floor(p.y / TILE);
    // Without any workbench: refused.
    expect(act(g, 'build', { struct: 'refinery', tx, ty }).ok).toBe(false);
    // A level-1 workbench is not enough.
    const bench1 = fixtureStation(g, 'workbench', 1); bench1.x = p.x - TILE; bench1.tx = Math.floor(bench1.x / TILE);
    expect(act(g, 'build', { struct: 'refinery', tx, ty }).ok).toBe(false);
    bench1.station!.level = 2 as any; bench1.type = 'workbench';
    markDirty();
    // PA1 changed this route: make one authentic packed refinery item first.
    const materialsBefore = (BAL.oilRefineryV1.cost as [string,number][])
      .map(([k,q])=>[k,countItem(r,'inv',k),q] as const);
    expect(act(g,'craft',{recipe:'deploy_refinery'}).ok).toBe(true);
    const pack=C(r,'inv').slots.find(v=>v?.key==='deploy_refinery')!;
    expect(pack).toBeTruthy();
    const uid=pack.uid;
    for(const [k,before,cost] of materialsBefore)
      expect(countItem(r,'inv',k), 'charged once for '+k).toBe(before-cost);
    expect(act(g, 'build', { struct: 'refinery', tx, ty }).ok).toBe(true);
    const ref = Object.values(r.entities).find(e => e.type === 'refinery')!;
    expect(ref.station?.fuelC).toBeTruthy();
    expect(ref.hp).toBe(BAL.oilRefineryV1.hp);
    expect(ref.deployed?.uid).toBe(uid);
    expect(countItem(r,'inv','deploy_refinery')).toBe(0);
    expect(Object.values(r.entities).some(e => e.type === 'claim')).toBe(false);
    expect(validate(snapshot(g))).toBeTruthy();
  });

  it('commits the industrial batch as one paid job: 2 Fuel Canisters + 1 Lubricant, atomically, on one timeline', () => {
    const g = setup(), r = g.run!, ref = bindRefinery(g);
    addItem(r, 'inv', 'salvaged_oil', 6); addItem(r, 'inv', 'glass', 1);
    expect(act(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }).ok).toBe(true);
    expect(countItem(r, 'inv', 'salvaged_oil')).toBe(0);
    expect(countItem(r, 'inv', 'glass')).toBe(0);
    expect(ref.station!.queue).toHaveLength(1);
    expect(ref.station!.queue[0].total).toBe(BAL.oilRefineryV1.recipes.industrial.secs * 1000);
    stepStations(g, 25000, T + 20000);
    const out = C(r, ref.station!.outC);
    expect(ref.station!.queue).toHaveLength(1);                    // not finished at 25 s
    stepStations(g, 2000, T + 30000);
    expect(ref.station!.queue).toHaveLength(0);
    expect(fuelQty(out)).toBe(2);
    expect(lubeQty(out)).toBe(1);
    expect(validate(snapshot(g))).toBeTruthy();
  });

  it('preflights the whole bundle: when only one product fits, neither is committed and inputs stay reserved', () => {
    const g = setup(), r = g.run!, ref = bindRefinery(g);
    const out = C(r, ref.station!.outC);
    addItem(r, 'inv', 'salvaged_oil', 6); addItem(r, 'inv', 'glass', 1);
    expect(act(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }).ok).toBe(true);
    // Output space is taken by other stock while the batch runs: five of six slots hold stone,
    // leaving one slot that fits 2 fuel but not 2 fuel + 1 lubricant.
    for (let i = 0; i < 5; i++) out.slots[i] = { uid: `pad${i}`, key: 'stone', qty: ITEMS.stone.max };
    stepStations(g, 26000, T + 30000);
    expect(fuelQty(out)).toBe(0);
    expect(lubeQty(out)).toBe(0);
    expect(ref.station!.queue).toHaveLength(1);
    expect(ref.station!.queue[0].left).toBe(0);                    // finished, held, not partially committed
    // Free two slots: the complete bundle lands on the next settlement.
    out.slots[0] = null; out.slots[1] = null;
    stepStations(g, 1000, T + 31000);
    expect(ref.station!.queue).toHaveLength(0);
    expect(fuelQty(out)).toBe(2);
    expect(lubeQty(out)).toBe(1);
    expect(validate(snapshot(g))).toBeTruthy();
  });

  it('refuses to queue an industrial batch that cannot land, reserving no inputs', () => {
    const g = setup(), r = g.run!, ref = bindRefinery(g);
    const out = C(r, ref.station!.outC);
    for (let i = 0; i < 6; i++) out.slots[i] = { uid: `pad${i}`, key: 'stone', qty: ITEMS.stone.max };
    addItem(r, 'inv', 'salvaged_oil', 6); addItem(r, 'inv', 'glass', 1);
    expect(act(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }).ok).toBe(false);
    expect(countItem(r, 'inv', 'salvaged_oil')).toBe(6);
    expect(ref.station!.queue).toHaveLength(0);
  });

  it('starves without fuel, keeps progress, and resumes when fuel arrives', () => {
    const g = setup(), r = g.run!, ref = fixtureStation(g, 'refinery');
    addItem(r, 'inv', 'salvaged_oil', 2);
    expect(act(g, 'craft', { recipe: 'refinery_lubricant', eid: ref.id }).ok).toBe(true);
    stepStations(g, 5000, T + 5000);
    expect(ref.station!.queue[0].left).toBe(12000);                // no fuel yet: nothing advances
    stepStations(g, 60000, T + 65000);
    expect(ref.station!.queue[0].left).toBe(12000);
    addItem(r, ref.station!.fuelC, 'wood', 1);
    stepStations(g, 4000, T + 69000);
    const partial = ref.station!.queue[0].left;
    expect(partial).toBeLessThan(12000);                           // progress kept once fuel arrives
    stepStations(g, 1000, T + 70000);
    expect(ref.station!.queue[0].left).toBeLessThan(partial);      // the burning fuel keeps the job moving
    addItem(r, ref.station!.fuelC, 'wood', 3);
    stepStations(g, 60000, T + 130000);
    expect(ref.station!.queue).toHaveLength(0);
    addItem(r, ref.station!.fuelC, 'wood', 3);
    stepStations(g, 60000, T + 125000);
    expect(ref.station!.queue).toHaveLength(0);
    expect(lubeQty(C(r, ref.station!.outC))).toBe(1);
  });

  it('cancelling a queued industrial batch refunds every reserved input exactly', () => {
    const g = setup(), r = g.run!, ref = bindRefinery(g);
    addItem(r, 'inv', 'salvaged_oil', 6); addItem(r, 'inv', 'glass', 1);
    expect(act(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }).ok).toBe(true);
    const jobId = ref.station!.queue[0].id;
    expect(act(g, 'cancelJob', { eid: ref.id, jobId }).ok).toBe(true);
    expect(countItem(r, 'inv', 'salvaged_oil')).toBe(6);
    expect(countItem(r, 'inv', 'glass')).toBe(1);
    expect(ref.station!.queue).toHaveLength(0);
    expect(validate(snapshot(g))).toBeTruthy();
  });

  it('offline settlement matches chronological stepping and produces no duplicate output', () => {
    const run = (chunks: number[]) => {
      const g = setup(), r = g.run!, ref = bindRefinery(g);
      addItem(r, 'inv', 'salvaged_oil', 8); addItem(r, 'inv', 'glass', 2);
      act(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }, 'a', T + 1);
      let now = T + 1;
      for (const c of chunks) { now += c; settle(g, now, true); }
      const out = C(r, ref.station!.outC);
      return { fuel: fuelQty(out), lube: lubeQty(out), queue: ref.station!.queue.length, oil: countItem(r, 'inv', 'salvaged_oil') };
    };
    const once = run([60000]);
    const chunked = run([5000, 5000, 5000, 5000, 5000, 35000]);
    expect(chunked).toEqual(once);
    expect(once).toEqual({ fuel: 2, lube: 1, queue: 0, oil: 2 });
  });

  it('wear split: only the protected distance is charged at the reduced rate, on the same bike UID', () => {
    const g = setup(), { r, e, q } = deployBike(g);
    addItem(r, 'inv', 'fuel_can', 1); expect(act(g, 'vehicleRefuel', { eid: e.id }).ok).toBe(true);
    expect(act(g, 'vehicleMount', { eid: e.id }).ok).toBe(true);
    const uid = e.deployed!.uid, base = snapshot(g);
    const lubeBike = structuredClone(base), plainBike = structuredClone(base);
    const lb = Object.values(lubeBike.run!.entities).find(v => v.kind === 'vehicle')!;
    const pb = Object.values(plainBike.run!.entities).find(v => v.kind === 'vehicle')!;
    lb.vehicle!.lube = 40; pb.vehicle!.lube = 0;
    const hp0 = lb.hp!, o0 = lb.vehicle!.odometer;
    for (const b of [lubeBike, plainBike]) {
      const x0 = b.run!.player.vehicle; expect(x0).toBe(e.id);
      for (let i = 0; i < 10; i++) tick(b, { ...inp, right: true }, 50, T + 100 + i * 50);
    }
    const travelled = lb.vehicle!.odometer - o0;
    expect(travelled).toBeGreaterThan(40);                         // protection expires mid-run
    const base1 = BAL.motorbike.wearPerPixel;                      // flat road, no load => base wear per px
    const lubeLoss = hp0 - lb.hp!;
    const expectedLoss = 40 * base1 * (1 - BAL.oilRefineryV1.lubricantWearReduction) + (travelled - 40) * base1;
    expect(lubeLoss).toBeCloseTo(expectedLoss, 6);
    expect(lb.hp! > hp0 - travelled * base1).toBe(true);           // reduced wear was actually applied
    expect(lb.vehicle!.lube).toBe(0);
    expect(lubeBike.run!.entities[e.id].deployed!.uid).toBe(uid);
    expect(q).toBeTruthy();
  });

  it('service: exact distance boundary, cap, inventory debit, same UID, no free HP', () => {
    const g = setup(), { r, e } = deployBike(g);
    const hpBefore = e.hp;
    for (let i = 0; i < 2; i++) addItem(r, 'inv', 'lubricant', 1);
    expect(act(g, 'vehicleLubricate', { eid: e.id }, 'l1').ok).toBe(true);
    expect(e.vehicle!.lube).toBe(BAL.oilRefineryV1.lubricantDistancePx);
    // Already covered by a full interval: a further service is refused, with no debit.
    expect(act(g, 'vehicleLubricate', { eid: e.id }, 'l2').ok).toBe(false);
    expect(countItem(r, 'inv', 'lubricant')).toBe(1);
    // Partial protection tops up but is capped at 1.5 service intervals.
    e.vehicle!.lube = 6000;
    expect(act(g, 'vehicleLubricate', { eid: e.id }, 'l3').ok).toBe(true);
    expect(e.vehicle!.lube).toBe(BAL.oilRefineryV1.lubricantDistancePx * 1.5);
    expect(countItem(r, 'inv', 'lubricant')).toBe(0);
    expect(e.hp).toBe(hpBefore);                                   // servicing never restores HP
    expect(e.deployed!.uid).toBeTruthy();
    expect(validate(snapshot(g))).toBeTruthy();
  });

  it('strict validation rejects forged refinery and vehicle states (fail-first assertions)', () => {
    const g = setup(), r = g.run!, ref = bindRefinery(g);
    addItem(r, 'inv', 'salvaged_oil', 6); addItem(r, 'inv', 'glass', 1);
    expect(act(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }).ok).toBe(true);
    const good = snapshot(g);
    expect(validate(good)).toBeTruthy();

    const forgedTime = snapshot(g); const fj = Object.values(forgedTime.run!.entities).find(e => e.type === 'refinery')!.station!.queue[0];
    fj.total = 1000; fj.left = 1000;
    expect(validate(forgedTime)).toBeNull();

    const forgedInputs = snapshot(g); const fi = Object.values(forgedInputs.run!.entities).find(e => e.type === 'refinery')!.station!.queue[0];
    fi.reserved![0].qty += 5;
    expect(validate(forgedInputs)).toBeNull();

    const forgedRecipe = snapshot(g); const fr = Object.values(forgedRecipe.run!.entities).find(e => e.type === 'refinery')!.station!.queue[0];
    fr.recipe = 'refinery_fuel_batch';                             // a different refinery recipe with the wrong inputs
    fr.total = RECIPES.refinery_fuel_batch.secs * 1000;
    expect(validate(forgedRecipe)).toBeNull();

    const badHp = snapshot(g); Object.values(badHp.run!.entities).find(e => e.type === 'refinery')!.hp = BAL.oilRefineryV1.hp * 10;
    expect(validate(badHp)).toBeNull();

    const retyped = snapshot(g); Object.values(retyped.run!.entities).find(e => e.type === 'refinery')!.type = 'furnace';
    expect(validate(retyped)).toBeNull();

    const badStation = snapshot(g); const bs = Object.values(badStation.run!.entities).find(e => e.type === 'refinery')!; bs.station!.fuelC = 'cdoesnotexist';
    expect(validate(badStation)).toBeNull();
  });

  it('strict validation rejects forged motorbike lubricant state', () => {
    const g = setup(), { e } = deployBike(g);
    const good = snapshot(g);
    expect(validate(good)).toBeTruthy();
    const over = snapshot(g); Object.values(over.run!.entities).find(v => v.kind === 'vehicle')!.vehicle!.lube = BAL.oilRefineryV1.lubricantDistancePx * 1.5 + 1000;
    expect(validate(over)).toBeNull();
    const neg = snapshot(g); Object.values(neg.run!.entities).find(v => v.kind === 'vehicle')!.vehicle!.lube = -1;
    expect(validate(neg)).toBeNull();
    expect(e.kind).toBe('vehicle');
  });

  it('legacy single-output furnace recipes still validate', () => {
    const g = setup(), r = g.run!;
    const furnace = fixtureStation(g, 'furnace');
    addItem(r, furnace.station!.fuelC, 'wood', 2);
    addItem(r, 'inv', 'salvaged_oil', 3); addItem(r, 'inv', 'glass', 1);
    r.knowledge.recipes.push('refine_salvaged_oil');
    expect(act(g, 'craft', { recipe: 'refine_salvaged_oil', eid: furnace.id }).ok).toBe(true);
    stepStations(g, 19000, T + 30000);
    expect(validate(snapshot(g))).toBeTruthy();
  });

  it('rejects a refinery job with no paid reservation, even on an otherwise valid refinery', () => {
    const g = setup(), r = g.run!, ref = fixtureStation(g, 'refinery');
    expect(validate(snapshot(g))).toBeTruthy();
    // Forged job: no paid reservation. Validation must reject the raw state (save guard would throw).
    ref.station!.queue.push({ id: 'j1', recipe: 'refinery_industrial', left: 26000, total: 26000 } as any);
    expect(validate(structuredClone(g))).toBeNull();
    // The same job with a canonical reservation is accepted.
    ref.station!.queue[0].reserved = [{ uid: 'resv1', key: 'salvaged_oil', qty: 6 }, { uid: 'resv2', key: 'glass', qty: 1 }] as any;
    expect(validate(structuredClone(g))).toBeTruthy();
    expect(r).toBeTruthy();
  });

  it('rejects an EMPTY refinery retyped to furnace, and a furnace relabeled as refinery', () => {
    const g = setup();
    fixtureStation(g, 'refinery');                                  // empty, no queue
    expect(validate(snapshot(g))).toBeTruthy();
    const emptyRetyped = snapshot(g);
    Object.values(emptyRetyped.run!.entities).find(e => e.type === 'refinery')!.type = 'furnace';
    expect(validate(emptyRetyped)).toBeNull();
    // A genuine plain furnace (no identity) is legitimate...
    const plainFurnace = snapshot(g);
    const pf = Object.values(plainFurnace.run!.entities).find(e => e.type === 'refinery')!;
    delete pf.identity; pf.type = 'furnace';
    expect(validate(plainFurnace)).toBeTruthy();
    // ...but relabeling that plain furnace as a refinery without identity is rejected.
    const relabeled = structuredClone(plainFurnace);
    Object.values(relabeled.run!.entities).find(e => e.type === 'furnace')!.type = 'refinery';
    expect(validate(relabeled)).toBeNull();
    const missingStation = structuredClone(g);
    delete Object.values(missingStation.run!.entities).find(e => e.type === 'refinery')!.station;
    expect(validate(missingStation)).toBeNull();
  });

  it('rejects an ACTIVE industrial job whose refinery is retyped, separately from the empty case', () => {
    const g = setup(), r = g.run!, ref = bindRefinery(g);
    addItem(r, 'inv', 'salvaged_oil', 6); addItem(r, 'inv', 'glass', 1);
    expect(act(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }).ok).toBe(true);
    expect(validate(snapshot(g))).toBeTruthy();
    const retyped = snapshot(g);
    Object.values(retyped.run!.entities).find(e => e.type === 'refinery')!.type = 'furnace';
    expect(validate(retyped)).toBeNull();
  });


  it('save -> reopen mid-job keeps UID, job progress and reservation; completion matches an uninterrupted run', () => {
    const reference = (() => {
      const g = setup(), r = g.run!, ref = bindRefinery(g);
      addItem(r, 'inv', 'salvaged_oil', 6); addItem(r, 'inv', 'glass', 1);
      act(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }, 'ref-job', T + 1);
      settle(g, T + 60000, true);
      const out = C(r, ref.station!.outC);
      return { fuel: fuelQty(out), lube: lubeQty(out), oil: countItem(r, 'inv', 'salvaged_oil') };
    })();
    const g = setup(), r = g.run!, ref = bindRefinery(g);
    addItem(r, 'inv', 'salvaged_oil', 6); addItem(r, 'inv', 'glass', 1);
    act(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }, 'rj', T + 1);
    settle(g, T + 10000, true);
    const reservedBefore = JSON.stringify(ref.station!.queue[0].reserved);
    const leftBefore = ref.station!.queue[0].left;
    // Persist, then reopen from the serialized save text only (no in-memory object reuse).
    const text = serializeSnapshot(g);
    const reopened = JSON.parse(JSON.parse(text).payload) as GameState;
    expect(validate(reopened)).toBeTruthy();
    const rref = Object.values(reopened.run!.entities).find(e => e.type === 'refinery')!;
    expect(rref.station!.queue[0].left).toBe(leftBefore);
    expect(JSON.stringify(rref.station!.queue[0].reserved)).toBe(reservedBefore);
    settle(reopened, T + 60000, true);
    const out = C(reopened.run!, rref.station!.outC);
    expect({ fuel: fuelQty(out), lube: lubeQty(out), oil: countItem(reopened.run!, 'inv', 'salvaged_oil') }).toEqual(reference);
    expect(rref.station!.queue).toHaveLength(0);
  });

  it('fault: no fuel never advances or grants output, and resumes exactly once fuel arrives', () => {
    const g = setup(), r = g.run!, ref = fixtureStation(g, 'refinery');
    addItem(r, 'inv', 'salvaged_oil', 2);
    act(g, 'craft', { recipe: 'refinery_lubricant', eid: ref.id }, 'nf', T + 1);
    settle(g, T + 600000, true);                                   // ten minutes, no fuel
    expect(ref.station!.queue[0].left).toBe(12000);
    expect(lubeQty(C(r, ref.station!.outC))).toBe(0);
    addItem(r, ref.station!.fuelC, 'wood', 3);
    settle(g, T + 700000, true);
    expect(ref.station!.queue).toHaveLength(0);
    expect(lubeQty(C(r, ref.station!.outC))).toBe(1);             // exactly one lubricant, no duplicate
  });

  it('fault: finished industrial job waits for storage, grants nothing partial, and lands once room exists', () => {
    const g = setup(), r = g.run!, ref = bindRefinery(g);
    const out = C(r, ref.station!.outC);
    addItem(r, 'inv', 'salvaged_oil', 6); addItem(r, 'inv', 'glass', 1);
    act(g, 'craft', { recipe: 'refinery_industrial', eid: ref.id }, 'full', T + 1);
    for (let i = 0; i < 5; i++) out.slots[i] = { uid: `full${i}`, key: 'stone', qty: ITEMS.stone.max };
    settle(g, T + 900000, true);                                   // fifteen minutes blocked
    expect(ref.station!.queue).toHaveLength(1);
    expect(ref.station!.queue[0].left).toBe(0);
    expect(fuelQty(out)).toBe(0);
    expect(lubeQty(out)).toBe(0);
    out.slots[0] = null; out.slots[1] = null;
    settle(g, T + 901000, true);
    expect(ref.station!.queue).toHaveLength(0);
    expect(fuelQty(out)).toBe(2);
    expect(lubeQty(out)).toBe(1);
  });
});
