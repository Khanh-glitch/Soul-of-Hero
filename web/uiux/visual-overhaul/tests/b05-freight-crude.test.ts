// B05-R Package B1: Crude Petroleum physical chain, using the EXISTING custody/movement/unload authorities.
// Chain: authorized (fixture) source -> pump cycle -> pump output -> player inventory -> motorbike cargo
//        -> real motion under tick() -> dry bike unload into a ground bag -> bag -> inventory -> refinery craft -> Fuel Canister.
// CONTROLLED FIXTURES: the test-fixture source, a workbench level-2 fixture for reach, and a refinery fixture. No Map site is invented.
import { describe, it, expect, afterEach } from 'vitest';
import { BAL, TILE, WW, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, dispatch, mkContainer, newGame, stepStations, registerTestOilSource } from '../src/game/engine';
import { getWorld, setActiveLayout } from '../src/game/world';
import { vehicleClear } from '../src/game/motorbike';
import { tick, type Input } from '../src/game/sim';

const T = Date.UTC(2026, 10, 7);
let serial = 0;
let clock = T + 1;   // commands must not predate the committed world clock
const act = (g: GameState, type: string, p: object = {}, now = clock) => dispatch(g, { id: `b1-${++serial}`, type, ...p }, now);
const still: Input = { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false };
const east: Input = { ...still, right: true, mx: 100, my: 100 };
afterEach(() => setActiveLayout('shipping'));

function setup(seed = 83) {
  setActiveLayout('shipping_fresh');
  const g = newGame();
  expect(act(g, 'startRun', { character: 'female', seed }, T).ok).toBe(true);
  g.run!.creatures = [];
  return g;
}
/** Every stack holding crude petroleum anywhere in the run, with its UID (conservation accounting). */
function crudeStacks(g: GameState) {
  // Visit each container OBJECT once (custody map and entity.c can name the same container).
  const seen = new Set<unknown>(); const out: { where: string; uid: string; qty: number }[] = [];
  const visit = (where: string, c: any) => { if (!c || seen.has(c)) return; seen.add(c); for (const s of c.slots) if (s?.key === 'crude_petroleum') out.push({ where, uid: s.uid, qty: s.qty }); };
  for (const [cid, c] of Object.entries(g.run!.custody ?? {})) visit(cid, c);
  for (const e of Object.values(g.run!.entities)) { if (e.c) visit(e.id, C(g.run!, e.c)); if (e.station) { visit(e.id, C(g.run!, e.station.fuelC)); visit(e.id, C(g.run!, e.station.outC)); } }
  return out;
}
const crudeTotal = (g: GameState) => crudeStacks(g).reduce((a, s) => a + s.qty, 0);
function roadLine(g: GameState) {
  const r = g.run!, w = getWorld(r.layoutId);
  for (let y = 2; y < 198; y++) for (let x = 3; x < 186; x++) {
    let yes = true;
    for (let d = -1; d <= 6; d++) { const px = (x + d) * TILE + 8, py = y * TILE + 8; if (!w.economyMap.road[y * WW + x + d] || !vehicleClear(r, px, py)) { yes = false; break; } }
    if (yes) return { x: x * TILE + 8, y: y * TILE + 8 };
  }
  throw Error('no real road line in the Shipping layout');
}

describe('B05-R B1: crude petroleum conserved through pump → inventory → motorbike → bag → refinery → fuel', () => {
  it('moves four crude UID-stacks through the existing custody and produces one Fuel Canister, with no duplication', () => {
    const g = setup(), r = g.run!;
    // controlled fixtures: source with 4 units, pump, refinery, workbench (reach)
    const p = r.player, tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    registerTestOilSource(r, tx, ty, 4);
    const pump: Entity = { id: 'b1-pump', kind: 'struct', type: 'oil_pump', x: tx * TILE + 8, y: ty * TILE + 8, tx, ty, hp: 160, maxHp: 160, station: { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 3).id, outC: mkContainer(r, 'out', 6).id } };
    r.entities[pump.id] = pump;
    addItem(r, pump.station!.fuelC, 'wood', 3);                          // 60 fuel-s for four 12 s cycles
    for (let i = 0; i < 4; i++) expect(act(g, 'craft', { recipe: 'pump_crude', eid: pump.id }).ok).toBe(true);
    stepStations(g, 4 * BAL.oilPumpV1.secs * 1000, T + 60_000);
    expect(r.oilSources!['oil:' + tx + ':' + ty].stock).toBe(0);
    expect(crudeTotal(g)).toBe(4);                                       // conservation: 4 from source → 4 in pump output

    // 1) pump output → player inventory (existing move)
    const outC = C(r, pump.station!.outC);
    const fs = outC.slots.findIndex(s => s?.key === 'crude_petroleum');
    expect(act(g, 'move', { from: pump.station!.outC, to: 'inv', fs }).ok).toBe(true);
    expect(countItem(r, 'inv', 'crude_petroleum')).toBe(4);
    expect(crudeTotal(g)).toBe(4);
    const uidBefore = crudeStacks(g)[0].uid;

    // 2) motorbike: deploy on a real road, load cargo, drive under tick()
    const q = roadLine(g);
    r.player.x = q.x - TILE; r.player.y = q.y;
    addItem(r, 'inv', 'motorbike_kit', 1);
    expect(act(g, 'placeMotorbike', q).ok).toBe(true);
    const bike = Object.values(r.entities).find(e => e.kind === 'vehicle')!;
    expect(act(g, 'vehicleMount', { eid: bike.id }).ok).toBe(true);
    const ibs = C(r, 'inv').slots.findIndex(s => s?.key === 'crude_petroleum');
    expect(act(g, 'move', { from: 'inv', to: bike.c, fs: ibs }).ok).toBe(true);     // whole stack into cargo
    expect(crudeTotal(g)).toBe(4);
    expect(crudeStacks(g).some(s => s.uid === uidBefore && s.where === bike.c)).toBe(true);
    // fuel: a real Fuel Canister via the existing refuel action (dismount → refuel → remount)
    expect(act(g, 'vehicleExit', {}, T + 500).ok).toBe(true);
    addItem(r, 'inv', 'fuel_can', 1);
    expect(act(g, 'vehicleRefuel', { eid: bike.id }, T + 501).ok).toBe(true);
    expect(act(g, 'vehicleMount', { eid: bike.id }, T + 502).ok).toBe(true);
    const x0 = bike.x, fuel0 = bike.vehicle!.fuel;
    let ticks = 0, t = T + 70_000;
    const west: Input = { ...still, left: true, mx: 0, my: 100 };
    // Drive back and forth on the same clear road segment; the bike's own motion burns fuel until empty.
    while ((bike.vehicle!.fuel ?? 0) > 0 && ticks < 40_000) { tick(g, Math.floor(ticks / 240) % 2 ? west : east, 50, t); t += 50; ticks++; }
    expect(bike.x).toBeGreaterThan(x0);
    expect(bike.vehicle!.fuel).toBeLessThanOrEqual(0);                   // fuel depleted by the motion itself
    expect(fuel0).toBeGreaterThan(0);
    expect(crudeTotal(g)).toBe(4);                                       // cargo conserved through motion
    expect(crudeStacks(g).some(s => s.uid === uidBefore)).toBe(true);    // same UID after motion

    clock = t + 10;
    // 3) dry bike → unload its real stacks into one ground bag (existing vehicleUnloadBag)
    expect(act(g, 'vehicleExit', {}, t + 1).ok).toBe(true);
    const spotNear = { x: bike.x, y: bike.y };
    r.player.x = spotNear.x + TILE; r.player.y = spotNear.y;
    const bagRes = act(g, 'vehicleUnloadBag', { eid: bike.id }, t + 2);
    expect(bagRes.ok, bagRes.reason).toBe(true);
    const bag = Object.values(r.entities).find(e => e.kind === 'bag' && e.vehicleSource?.vehicleId === bike.id)!;
    expect(bag).toBeDefined();
    expect(crudeTotal(g)).toBe(4);
    // 4) bag → inventory → refinery input (craft reserves inputs from inventory)
    const bc = C(r, bag.c!);
    const bfs = bc.slots.findIndex(s => s?.key === 'crude_petroleum');
    const mv = act(g, 'move', { from: bag.c, to: 'inv', fs: bfs }); expect(mv.ok, mv.reason + ' fs=' + bfs + ' bagC=' + bag.c).toBe(true);
    expect(countItem(r, 'inv', 'crude_petroleum')).toBe(4);
    expect(crudeStacks(g).some(s => s.uid === uidBefore)).toBe(true);    // the original UID survived the whole chain
    // 5) refinery fixture (reach via a level-2 workbench fixture), 4 crude + glass → Fuel Canister
    const rx = Math.floor(r.player.x / TILE), ry = Math.floor(r.player.y / TILE);
    const ref: Entity = { id: 'b1-ref', kind: 'struct', type: 'refinery', x: r.player.x + 8, y: r.player.y, tx: rx, ty: ry, hp: BAL.oilRefineryV1.hp, maxHp: BAL.oilRefineryV1.hp, identity: 'refinery-v1', station: { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 3).id, outC: mkContainer(r, 'out', 6).id } as any };
    r.entities[ref.id] = ref;
    const bench: Entity = { id: 'b1-bench', kind: 'struct', type: 'workbench', x: ref.x, y: ref.y, tx: rx, ty: ry, hp: 160, maxHp: 160, station: { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 0).id, outC: mkContainer(r, 'out', 4).id, level: 2 } as any };
    r.entities[bench.id] = bench;
    addItem(r, ref.station!.fuelC, 'wood', 2); addItem(r, 'inv', 'glass', 1);
    expect(act(g, 'craft', { recipe: 'refinery_crude', eid: ref.id }).ok).toBe(true);
    expect(crudeTotal(g)).toBe(0);                                       // reserved into the job: consumed, not duplicated
    stepStations(g, BAL.oilRefineryV1.recipes.crude.secs * 1000, t + 10_000);
    expect(countItem(r, ref.station!.outC, 'fuel_can')).toBe(1);
    expect(crudeStacks(g).length).toBe(0);
  });
});
