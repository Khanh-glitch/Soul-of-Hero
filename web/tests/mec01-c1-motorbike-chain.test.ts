// MEC-01 R2 — C1: the FULL industrial chain to a packed Motorbike Kit, through real intents, on the live world.
// THE CHAIN (all real, paid actions):
//   factory exterior industrial-toolbox crate (authorized loot-source-v2, Shipping)
//     -> take mechanical_parts x2 / fasteners x3 / spares x5 by real `move` (NATURAL, source-identified)
//     -> build Furnace (wood 4 + stone 18, real build) -> craft refined_iron_ingot x2 (3 iron_ingot + 1 coal, real paid queue, real fuel in fuelC)
//     -> build Workbench (wood 14 + stone 4) -> upgradeStation L1->L2 (mechanical_parts x2 + iron_ingot x1, real paid upgrade)
//     -> craft mechanical_gear, metal_pipe (from OWN refined ingots), vehicle_frame_piped, vehicle_drive_geared
//     -> upgradeStation L2->L3 PAID (mechanical_parts x6 + iron_ingot x8 + fasteners x8 + spares x12)
//     -> build Research Table (wood 10 + spares x6 + iron_ingot x1) -> research.directed motorbike_kit (spares x9, directedSeconds)
//     -> learn.blueprint (useItem, real intent) -> craft motorbike_kit at bench L3 (frame + drive + iron_ingot x2 + fasteners x2)
//     -> placeMotorbike -> vehicleRefuel (1 Fuel Canister) -> vehicleMount -> scrap x3 (from the SAME crate) moved inv -> bike container by real `move`
//     -> save/reload UID check through serializeSnapshot/selectSnapshots (the game's own persistence path)
// WHAT IS FIXTURE (labelled, never NATURAL_INPUT): [F1] player fixture-placed beside the crate/stations (position only).
//   [F2] raw grants stand in for the gather loop nobody asked to re-prove: iron_ingot x20, coal x2, wood x30, stone x22,
//        mechanical_parts x11, fasteners x10, spares x26, 1 Fuel Canister. Every other item on this path is produced or taken, not granted.
//   [F3] the factory crate's own high-grade roll (refined_iron_ingot, mechanical_gear, metal_pipe) is deliberately left in the crate
//        untouched: gear and pipe here are CRAFTED, not looted, and this test asserts the crate still holds them at the end.
//   [F4] the survival kit (berries/knife/flask) is never used as chain fuel.
// TIMING SCOPE: crafting/research seconds come from stepStations with the catalog recipe times — real paid queue semantics,
// SIM_FIXTURE_MEASUREMENT, not human reaction time.
import { describe, it, expect } from 'vitest';
import { mkdirSync } from 'node:fs';
import { writeFileSync } from './_evidenceFs';
import { type GameState, type RunState, TILE, WW } from '../src/game/core';
import { RECIPES, WORKBENCH_UPGRADE, WORKBENCH_UPGRADE_III } from '../src/game/catalog';
import { BAL } from '../src/game/core';
import { dispatchCarryingPack, ensurePack } from './helpers/build-kit';
import { addItem, countItem, dispatch, markDirty, newGame, stepStations, buildReason } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { serializeSnapshot, selectSnapshots } from '../src/game/persist';

const START = Date.UTC(2026, 10, 8, 7, 0, 0);
const SEED = 4242;
let n = 0;
const copy = (g: GameState) => selectSnapshots([serializeSnapshot(g), null]).gs!;
function start() {
  setActiveLayout('shipping_fresh'); const g = newGame();
  expect(dispatch(g, { id: 'c1-start-' + (++n), type: 'startRun', character: 'female', seed: SEED }, START).ok).toBe(true);
  g.run!.creatures = []; markDirty(); return g;
}
/** The authorised factory crate: the one whose roll carries the high-grade parts (gear, pipe, refined iron). */
const crateOf = (r: RunState) => Object.values(r.entities).find(e => e.kind === 'loot' && e.poi === 'factory' && e.c && r.custody[e.c]?.slots.some(s => s?.key === 'mechanical_gear'))!;
function place(r: RunState, tx: number, ty: number) { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; markDirty(); }
/** Legal buildable tiles for three stations, nearest spawn first (FIXTURE position; build itself is real). */
function legalTilesNear(g: GameState, cx: number, cy: number, struct: string, count: number): [number, number][] {
  const r = g.run!; const out: [number, number][] = [];
  for (let k = 1; k <= 10 && out.length < count; k++) for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== k || out.length >= count) continue;
    const tx = cx + dx, ty = cy + dy; place(r, tx - 1, ty);
    if (!buildReason(g, struct, tx, ty)) out.push([tx, ty]);
  }
  if (out.length < count) throw new Error(`no legal tiles for ${struct}`);
  return out;
}
const countAll = (r: RunState, keys: string[]) => Object.fromEntries(keys.map(k => [k, countItem(r, 'inv', k)]));
const RAW = ['iron_ingot', 'charcoal', 'spares'] as const;
const LEDGER_KEYS = [...RAW, 'refined_iron_ingot', 'mechanical_gear', 'metal_pipe', 'iron_plate', 'vehicle_frame', 'motorbike_kit', 'fuel_can'];

// Ledger rev 6 chain (the live catalog is the authority; every cost below is read from it, not typed in):
//   Iron Ingot + Charcoal -> Refined Iron (furnace) -> Metal Pipe / Iron Plate / Mechanical Gear (bench L2)
//   -> Utility Frame (L2) -> paid bench L3 (2 gears, 2 plates, ingots, Parts) -> directed research ->
//   blueprint learned -> Utility Motorbike (packed) = frame + 2 gears + 3 plates + 4 refined iron.
// Machine Parts, Forged Fasteners, Scrap and the separate Motor Drive of the earlier chain are retired.
const CRAFTS: [station: 'furnace' | 'workbench', recipe: string, times: number][] = [
  ['furnace', 'refined_iron_ingot', 7],   // 14 refined: 2 pipe-craft + 6 plate-crafts + 2 frame + 4 kit
  ['workbench', 'mechanical_gear', 4],    // 2 for the L3 upgrade, 2 for the kit
  ['workbench', 'metal_pipe', 1],         // makes 2, the frame uses 1
  ['workbench', 'iron_plate', 3],         // makes 6: 2 for the L3 upgrade, 3 for the kit
  ['workbench', 'vehicle_frame', 1],
];
describe('MEC-01 C1 (Ledger rev 6): factory crate -> furnace -> workbench L2 -> paid L3 -> research -> packed Motorbike Kit', () => {
  it('walks the whole paid chain with real intents, debits exactly the catalog cost at every step, and preserves UIDs through save/reload', () => {
    const g = start(); const r = g.run!;
    const s0 = countAll(r, LEDGER_KEYS);
    // ============ LEG 1 — NATURAL take from the authorised factory crate (real moves) ============
    place(r, 150, 104);                                  // FIXTURE position beside the crate
    const crate = crateOf(r);
    expect(crate, 'factory crate with the high-grade roll').toBeTruthy();
    const crateSpares = r.custody[crate.c!].slots.reduce((n, v) => n + (v?.key === 'spares' ? v.qty : 0), 0);
    expect(crateSpares).toBeGreaterThan(0);
    for (let guard = 0; guard < 12; guard++) {
      const slot = r.custody[crate.c!].slots.findIndex(v => v?.key === 'spares');
      if (slot < 0) break;
      expect(dispatch(g, { id: `c1-take-spares-${++n}`, type: 'move', from: crate.c, fs: slot, to: 'inv' } as any, START + 6).ok, 'spares').toBe(true);
    }
    expect(countItem(r, 'inv', 'spares') - s0.spares).toBe(crateSpares);          // never more than the crate held
    // The crate's own high-grade roll stays untouched — gear, pipe and refined iron here are CRAFTED, not looted.
    for (const key of ['mechanical_gear', 'metal_pipe', 'refined_iron_ingot']) expect(r.custody[crate.c!].slots.some(v => v?.key === key), key).toBe(true);
    // ============ LEG 2 — FIXTURE_INTENT raw materials: exactly what the catalog says the chain costs ============
    const bill: Record<string, number> = { iron_ingot: 0, charcoal: 0, spares: 0 };
    const charge = (cost: readonly (readonly [string, number])[], times = 1) => { for (const [k, q] of cost) if (k in bill) bill[k] += q * times; };
    for (const [, recipe, times] of CRAFTS) charge(RECIPES[recipe].ins, times);
    charge(RECIPES.motorbike_kit.ins); charge(WORKBENCH_UPGRADE.cost); charge(WORKBENCH_UPGRADE_III.cost);
    bill.spares += BAL.research.directedSparesCost;
    expect(bill.spares).toBeGreaterThan(crateSpares);                              // the crate alone does not pay for a motorbike
    const grants = { iron_ingot: bill.iron_ingot, charcoal: bill.charcoal, spares: bill.spares - crateSpares, wood: 30 };   // wood is furnace fuel only (Coal is retired; Charcoal is an ingredient here)
    for (const [k, q] of Object.entries(grants)) expect(addItem(r, 'inv', k, q), k).toBe(0);
    // ============ LEG 3 — Furnace: real placement of the packed device, real fuel ============
    const spawnTx = Math.floor(r.player.x / TILE), spawnTy = Math.floor(r.player.y / TILE);
    const build = (id: string, struct: string, near: [number, number], at: number) => {
      ensurePack(r, struct);                             // PA1: a station is placed from its packed device
      const [tx, ty] = legalTilesNear(g, near[0], near[1], struct, 1)[0];
      place(r, tx - 1, ty);
      expect(dispatchCarryingPack(g, { id, type: 'build', struct, tx, ty }, at)).toMatchObject({ ok: true });
      return Object.values(r.entities).find(e => e.kind === 'struct' && e.type === struct && e.tx === tx && e.ty === ty)!;
    };
    const furnace = build('c1-build-furnace', 'furnace', [spawnTx, spawnTy], START + 10);
    const fuelSlot = r.custody.inv.slots.findIndex(v => v?.key === 'wood');
    expect(dispatchCarryingPack(g, { id: 'c1-feed', type: 'move', from: 'inv', fs: fuelSlot, to: furnace.station!.fuelC, ts: 0 } as any, START + 11)).toMatchObject({ ok: true });
    // ============ LEG 4 — Workbench: real placement, paid L1 -> L2 ============
    const bench = build('c1-build-bench', 'workbench', [furnace.tx! + 1, furnace.ty!], START + 20);
    expect(bench.station!.level ?? 1).toBe(1);
    const paid = (what: string, cost: readonly (readonly [string, number])[], act: () => void) => {
      const before = Object.fromEntries(cost.map(([k]) => [k, countItem(r, 'inv', k)]));
      act();
      for (const [k, q] of cost) expect(before[k] - countItem(r, 'inv', k), `${what}: ${k}`).toBe(q);
    };
    place(r, bench.tx! - 1, bench.ty!);
    paid('bench L2', WORKBENCH_UPGRADE.cost, () => expect(dispatch(g, { id: 'c1-l2', type: 'upgradeStation', eid: bench.id }, START + 21).ok).toBe(true));
    expect(bench.station!.level).toBe(2);
    // ============ LEG 5 — CRAFTED refined iron, gears, pipe, plates, frame: each job debits its catalog bill ============
    let clock = START + 30_000; const made: Record<string, string[]> = {};
    const craft = (station: typeof bench, recipe: string) => {
      const rc = RECIPES[recipe]; const outBefore = countItem(r, 'inv', rc.out);
      place(r, station.tx! - 1, station.ty!);
      paid(recipe, rc.ins.filter(([k]) => k !== rc.out), () => {
        expect(dispatch(g, { id: `c1-craft-${recipe}-${++n}`, type: 'craft', eid: station.id, recipe }, clock), recipe).toMatchObject({ ok: true });
        stepStations(g, rc.secs * 1000 + 1000, clock + 1000);
        const outC = station.station!.outC!;
        const fslot = r.custody[outC].slots.findIndex(v => v?.key === rc.out);
        expect(fslot, `${recipe} output`).toBeGreaterThanOrEqual(0);
        (made[rc.out] ??= []).push(r.custody[outC].slots[fslot]!.uid);
        expect(dispatch(g, { id: `c1-collect-${recipe}-${++n}`, type: 'move', from: outC, fs: fslot, to: 'inv' } as any, clock + rc.secs * 1000 + 2000).ok, recipe).toBe(true);
      });
      expect(countItem(r, 'inv', rc.out) - outBefore, `${recipe} yield`).toBe(rc.qty);
      clock += rc.secs * 1000 + 10_000;
    };
    for (const [where, recipe, times] of CRAFTS) for (let k = 0; k < times; k++) craft(where === 'furnace' ? furnace : bench, recipe);
    expect(countItem(r, 'inv', 'vehicle_frame')).toBe(1);
    // ============ LEG 6 — PAID L3 upgrade (the real gate): two crafted gears and two crafted plates go into the bench ============
    place(r, bench.tx! - 1, bench.ty!);
    expect(r.knowledge.recipes).not.toContain('motorbike_kit');
    paid('bench L3', WORKBENCH_UPGRADE_III.cost, () => expect(dispatch(g, { id: 'c1-l3', type: 'upgradeStation', eid: bench.id }, clock).ok).toBe(true));
    expect(bench.station!.level).toBe(3);
    // ============ LEG 7 — Research Table: real placement, directed research, real blueprint ============
    const table = build('c1-build-table', 'research', [bench.tx! + 1, bench.ty!], clock + 1000);
    place(r, table.tx! - 1, table.ty!);
    paid('directed research', [['spares', BAL.research.directedSparesCost]], () =>
      expect(dispatch(g, { id: 'c1-research', type: 'research', eid: table.id, mode: 'directed', recipe: 'motorbike_kit' } as any, clock + 2000)).toMatchObject({ ok: true }));
    stepStations(g, BAL.research.directedSeconds * 1000 + 1000, clock + 3000);
    const tableOut = table.station!.outC!;
    const bpSlot = r.custody[tableOut].slots.findIndex(v => v?.key === 'blueprint' && v?.meta === 'motorbike_kit');
    expect(bpSlot, 'directed blueprint').toBeGreaterThanOrEqual(0);
    const bpUid = r.custody[tableOut].slots[bpSlot]!.uid;
    clock += 60_000;
    expect(dispatch(g, { id: 'c1-take-bp', type: 'move', from: tableOut, fs: bpSlot, to: 'inv' } as any, clock).ok).toBe(true);
    const bpInv = r.custody.inv.slots.findIndex(v => v?.key === 'blueprint' && v?.meta === 'motorbike_kit');
    expect(dispatch(g, { id: 'c1-learn', type: 'useItem', slot: bpInv }, clock + 1000).ok).toBe(true);
    expect(r.knowledge.recipes).toContain('motorbike_kit');
    expect(r.custody.inv.slots.some(v => v?.uid === bpUid)).toBe(false);   // blueprint consumed by learning
    // ============ LEG 8 — the kit at bench L3, then deploy / fuel / mount / cargo ============
    clock += 10_000;
    craft(bench, 'motorbike_kit');
    const kitUid = made.motorbike_kit[0];
    expect(countItem(r, 'inv', 'motorbike_kit')).toBe(1);
    // The exact bill: every raw unit granted or taken from the crate is spent, and nothing else was needed.
    for (const k of RAW) expect(countItem(r, 'inv', k), `raw ${k} left over`).toBe(s0[k]);
    expect(countItem(r, 'inv', 'refined_iron_ingot')).toBe(s0.refined_iron_ingot);
    expect(countItem(r, 'inv', 'mechanical_gear')).toBe(s0.mechanical_gear);
    const leftovers = { metal_pipe: countItem(r, 'inv', 'metal_pipe') - s0.metal_pipe, iron_plate: countItem(r, 'inv', 'iron_plate') - s0.iron_plate };
    expect(leftovers).toEqual({ metal_pipe: 1, iron_plate: 1 });           // batch remainders, still in the pack
    place(r, 150, 104);                                // FIXTURE position (open ground beside the crate)
    expect(dispatch(g, { id: 'c1-place', type: 'placeMotorbike', x: 149 * TILE + 8, y: 104 * TILE + 8 }, clock)).toMatchObject({ ok: true });
    const bike = Object.values(r.entities).find(e => e.kind === 'vehicle')!;
    expect(bike.deployed!.uid).toBe(kitUid);
    expect(countItem(r, 'inv', 'motorbike_kit')).toBe(0);
    expect(bike.vehicle!.fuel ?? 0).toBe(0);           // packed dry
    addItem(r, 'inv', 'fuel_can', 1);                  // FIXTURE: fuel canister (source: refinery chain, out of scope here)
    expect(dispatch(g, { id: 'c1-fuel', type: 'vehicleRefuel', eid: bike.id }, clock + 1000).ok).toBe(true);
    expect(bike.vehicle!.fuel).toBeGreaterThan(0);
    expect(countItem(r, 'inv', 'fuel_can')).toBe(s0.fuel_can);
    expect(dispatch(g, { id: 'c1-mount', type: 'vehicleMount', eid: bike.id }, clock + 2000).ok).toBe(true);
    expect(r.player.vehicle).toBe(bike.id);
    // Physical cargo: a crafted Metal Pipe moved into the bike container by a real `move`, UID tracked.
    const cargoSlot = r.custody.inv.slots.findIndex(v => v?.key === 'metal_pipe');
    expect(cargoSlot).toBeGreaterThanOrEqual(0);
    const cargoUid = r.custody.inv.slots[cargoSlot]!.uid;
    const bikeEmpty = r.custody[bike.c!].slots.findIndex(v => !v);
    expect(bikeEmpty).toBeGreaterThanOrEqual(0);
    expect(dispatch(g, { id: 'c1-load-bike', type: 'move', from: 'inv', fs: cargoSlot, to: bike.c!, ts: bikeEmpty } as any, clock + 3000).ok).toBe(true);
    expect(r.custody[bike.c!].slots[bikeEmpty]!.uid).toBe(cargoUid);
    // ============ LEG 9 — save/reload UID check through the game's own serializer ============
    const reloaded = copy(g);
    const rb = Object.values(reloaded.run!.entities).find(e => e.kind === 'vehicle')!;
    expect(rb.id).toBe(bike.id);
    expect(rb.deployed!.uid).toBe(kitUid);
    expect(reloaded.run!.player.vehicle).toBe(bike.id);
    expect(reloaded.run!.custody[rb.c!].slots[bikeEmpty]!.uid).toBe(cargoUid);
    expect(reloaded.run!.knowledge.recipes).toContain('motorbike_kit');
    expect(reloaded.run!.entities[bench.id].station!.level).toBe(3);
    // ============ EVIDENCE ============
    const evidence = {
      note: 'C1 PAID CHAIN under Ledger rev 6, real intents end to end. Timing is SIM_FIXTURE_MEASUREMENT (stepStations with catalog recipe times). Fixtures labelled; the crate high-grade roll is left untouched (gear, pipe, refined iron are CRAFTED).',
      seed: SEED,
      route: 'factory crate -> furnace -> workbench L2 -> paid L3 -> research table -> motorbike_kit -> placeMotorbike -> vehicleRefuel -> vehicleMount -> pipe cargo in bike -> save/reload UID check',
      raw_bill_from_catalog: bill,
      taken_from_crate_real_moves: { spares: crateSpares },
      grants_fixture_intent: grants,
      crafts: Object.fromEntries(CRAFTS.map(([station, recipe, times]) => [recipe, { station, times, ins: RECIPES[recipe].ins, makes: RECIPES[recipe].qty }])),
      upgrades: { workbenchL2: WORKBENCH_UPGRADE.cost, workbenchL3_PAID: WORKBENCH_UPGRADE_III.cost },
      directedResearch_motorbike_kit: { spares: BAL.research.directedSparesCost },
      motorbike_kit: RECIPES.motorbike_kit.ins,
      leftovers_in_pack: leftovers,
      uids: { made, kit: kitUid, bike: bike.id, bikeDeployed: bike.deployed!.uid, cargoPipe: cargoUid, blueprint: bpUid },
      saveReload: { benchLevel: 3, reloadedBikeIdMatches: rb.id === bike.id, reloadedCargoUidMatches: reloaded.run!.custody[rb.c!].slots[bikeEmpty]!.uid === cargoUid, reloadedPlayerVehicleMatches: reloaded.run!.player.vehicle === bike.id },
      labels: { natural: ['crate takes', 'furnace placement/feed/craft', 'workbench placement/upgrade/craft', 'research placement/directed/learn', 'kit craft', 'motorbike place/refuel/mount', 'cargo move'], fixture: ['player placement beside stations', 'raw material grants (exactly the catalog bill)', 'packed station devices', 'one Fuel Canister'] },
    };
    mkdirSync('evidence/mec01-c1', { recursive: true });
    writeFileSync('evidence/mec01-c1/motorbike-chain.json', JSON.stringify(evidence, null, 2));
    expect(evidence.uids.kit).toBeTruthy();
  }, 120000);

  it('ordinary survival verbs (eat, drink) work without motorbike, Elder or Core ever entering the pack', () => {
    const g = start(); const r = g.run!;
    expect(r.custody.inv.slots.some(s => s?.key === 'motorbike_kit')).toBe(false);
    const berry = r.custody.inv.slots.findIndex(s => s?.key === 'berries');
    const before = r.player.hunger;
    expect(dispatch(g, { id: 'c1-eat', type: 'useItem', slot: berry }, START + 1).ok).toBe(true);
    expect(r.player.hunger).toBeGreaterThan(before);
    const flask = r.custody.inv.slots.findIndex(s => s?.key === 'water_flask');
    const beforeT = r.player.thirst;
    expect(dispatch(g, { id: 'c1-drink', type: 'useItem', slot: flask }, START + 2).ok).toBe(true);
    expect(r.player.thirst).toBeGreaterThan(beforeT);
    // No Elder kill, Creator Core study or motorbike is on the critical path of eating or drinking:
    expect(r.custody.inv.slots.some(s => s?.key.startsWith('core_'))).toBe(false);
    expect(r.player.vehicle).toBeUndefined();
  });
});
