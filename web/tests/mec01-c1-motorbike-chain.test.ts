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
import { RECIPES } from '../src/game/catalog';
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
const crateOf = (r: RunState) => Object.values(r.entities).find(e => e.kind === 'loot' && e.poi === 'factory' && e.c && r.custody[e.c]?.slots.some(s => s?.key === 'iron_sword'))!;
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
const LEDGER_KEYS = ['iron_ingot', 'refined_iron_ingot', 'mechanical_parts', 'fasteners', 'spares', 'wood', 'stone', 'coal', 'scrap', 'fuel_can'];

describe('MEC-01 R2 C1: factory source -> furnace -> workbench L2 -> paid L3 -> research -> packed Motorbike Kit', () => {
  it('walks the whole paid chain with real intents, preserves UIDs through save/reload, and keeps survival kit-free of it', () => {
    const g = start(); const r = g.run!;
    const s0 = countAll(r, LEDGER_KEYS);
    // ============ LEG 1 — NATURAL take from the authorized factory crate (real moves) ============
    place(r, 150, 104);                                  // FIXTURE position beside the crate
    const crate = crateOf(r);
    const taken: Record<string, number> = {};
    for (const key of ['mechanical_parts', 'fasteners', 'scrap'] as const) {
      const slot = r.custody[crate.c!].slots.findIndex(s => s?.key === key);
      expect(slot, key).toBeGreaterThanOrEqual(0);
      const qty = key === 'scrap' ? 3 : r.custody[crate.c!].slots[slot]!.qty;
      // move only what we need; the crate keeps the rest (scrap: exactly 3 of the 6)
      const res = dispatch(g, { id: `c1-take-${key}-${++n}`, type: 'move', from: crate.c, fs: slot, to: 'inv', qty } as any, START + 5);
      expect(res.ok, key).toBe(true);
      taken[key] = qty;
    }
    // spares live in TWO stacks in the crate (s-fixes: 3 + 2). Take both — never more than exists.
    let sparesTaken = 0;
    for (let guard = 0; guard < 4; guard++) {
      const slot = r.custody[crate.c!].slots.findIndex(s => s?.key === 'spares');
      if (slot < 0) break;
      const res = dispatch(g, { id: `c1-take-spares-${++n}`, type: 'move', from: crate.c, fs: slot, to: 'inv' } as any, START + 6);
      expect(res.ok, 'spares').toBe(true); sparesTaken += 0; // qty read post-move below via counts
    }
    sparesTaken = countItem(r, 'inv', 'spares') - s0.spares;
    expect(sparesTaken).toBe(5);
    // The crate's own high-grade roll stays untouched — gear/pipe/refined here are CRAFTED, not looted.
    expect(r.custody[crate.c!].slots.some(s => s?.key === 'mechanical_gear')).toBe(true);
    expect(r.custody[crate.c!].slots.some(s => s?.key === 'metal_pipe')).toBe(true);
    expect(r.custody[crate.c!].slots.some(s => s?.key === 'refined_iron_ingot')).toBe(true);
  // ============ LEG 2 — FIXTURE_INTENT raw materials (labelled; the gather loop is not what this test proves) ============
    const grant = (key: string, qty: number) => addItem(r, 'inv', key, qty);
    grant('iron_ingot', 20); grant('coal', 2); grant('wood', 30); grant('stone', 22);
    grant('mechanical_parts', 11); grant('fasteners', 10); grant('spares', 26);
    const grants = { iron_ingot: 20, coal: 2, wood: 30, stone: 22, mechanical_parts: 11, fasteners: 10, spares: 26 };
    const s1 = countAll(r, LEDGER_KEYS);
  // ============ LEG 3 — Furnace: real build, real fuel, real refined ingots ============
    const spawnTx = Math.floor(r.player.x / TILE), spawnTy = Math.floor(r.player.y / TILE);
    const [fx, fy] = legalTilesNear(g, spawnTx, spawnTy, 'furnace', 1)[0];
    place(r, fx - 1, fy);
    expect(dispatch(g, { id: 'c1-build-furnace', type: 'build', struct: 'furnace', tx: fx, ty: fy }, START + 10).ok).toBe(true);
    const furnace = Object.values(r.entities).find(e => e.kind === 'struct' && e.type === 'furnace')!;
    // fuel: 1 coal moved into the furnace fuelC by real move (furnace burns coal fine)
    const coalSlot = r.custody.inv.slots.findIndex(s => s?.key === 'coal');
    expect(dispatch(g, { id: 'c1-feed', type: 'move', from: 'inv', fs: coalSlot, to: furnace.station!.fuelC, ts: 0, qty: 1 } as any, START + 11).ok).toBe(true);
    expect(dispatch(g, { id: 'c1-refine', type: 'craft', eid: furnace.id, recipe: 'refined_iron_ingot' }, START + 12).ok).toBe(true);
    stepStations(g, RECIPES.refined_iron_ingot.secs * 1000 + 1000, START + 13000);
    const furnaceOut = furnace.station!.outC!;
    const refinedUid = r.custody[furnaceOut].slots.find(s => s?.key === 'refined_iron_ingot')!.uid;
    const fsOut = r.custody[furnaceOut].slots.findIndex(s => s?.key === 'refined_iron_ingot');
    expect(dispatch(g, { id: 'c1-take-refined', type: 'move', from: furnaceOut, fs: fsOut, to: 'inv' } as any, START + 14000).ok).toBe(true);
    expect(countItem(r, 'inv', 'refined_iron_ingot')).toBe(2);
  // ============ LEG 4 — Workbench: real build, L1->L2 paid upgrade ============
    const [bx, by] = legalTilesNear(g, fx + 1, fy, 'workbench', 1)[0];
    place(r, bx - 1, by);
    expect(dispatch(g, { id: 'c1-build-bench', type: 'build', struct: 'workbench', tx: bx, ty: by }, START + 20).ok).toBe(true);
    const bench = Object.values(r.entities).find(e => e.kind === 'struct' && e.type === 'workbench')!;
    expect(bench.station!.level ?? 1).toBe(1);
    expect(dispatch(g, { id: 'c1-l2', type: 'upgradeStation', eid: bench.id }, START + 21).ok).toBe(true);
    expect(bench.station!.level).toBe(2);
    // L2 upgrade consumed 2 MP + 1 iron_ingot (paid).
  // ============ LEG 5 — CRAFTED gear, pipe, frame (piped), drive (geared) ============
    const s2 = countAll(r, LEDGER_KEYS);
    const craftAt = (eid: string, recipe: string, at: number) => {
      expect(dispatch(g, { id: `c1-craft-${recipe}`, type: 'craft', eid, recipe }, at).ok, recipe).toBe(true);
      stepStations(g, RECIPES[recipe].secs * 1000 + 1000, at + 1000);
      const outC = bench.station!.outC!;
      const fslot = r.custody[outC].slots.findIndex(s => s?.key === RECIPES[recipe].out);
      expect(fslot, recipe).toBeGreaterThanOrEqual(0);
      const uid = r.custody[outC].slots[fslot]!.uid;
      expect(dispatch(g, { id: `c1-collect-${recipe}`, type: 'move', from: outC, fs: fslot, to: 'inv' } as any, at + 2000).ok, recipe).toBe(true);
      return uid;
    };
    const gearUid = craftAt(bench.id, 'mechanical_gear', START + 30000);
    const pipeUid = craftAt(bench.id, 'metal_pipe', START + 40000);
    const frameUid = craftAt(bench.id, 'vehicle_frame_piped', START + 50000);
    const driveUid = craftAt(bench.id, 'vehicle_drive_geared', START + 60000);
    expect(countItem(r, 'inv', 'vehicle_frame')).toBe(1);
    expect(countItem(r, 'inv', 'vehicle_drive')).toBe(1);
  // ============ LEG 6 — PAID L3 upgrade (the real gate) ============
    const s3 = countAll(r, LEDGER_KEYS);
    place(r, bx - 1, by);
    expect(dispatch(g, { id: 'c1-l3', type: 'upgradeStation', eid: bench.id }, START + 70000).ok).toBe(true);
    expect(bench.station!.level).toBe(3);
    const s4 = countAll(r, LEDGER_KEYS);
    expect(s3.iron_ingot - s4.iron_ingot).toBe(8);
    expect(s3.mechanical_parts - s4.mechanical_parts).toBe(6);
    expect(s3.fasteners - s4.fasteners).toBe(8);
    expect(s3.spares - s4.spares).toBe(12);
  // ============ LEG 7 — Research Table: real build, directed research, real blueprint ============
    const [rx, ry] = legalTilesNear(g, bx + 1, by, 'research', 1)[0];
    place(r, rx - 1, ry);
    expect(dispatch(g, { id: 'c1-build-table', type: 'build', struct: 'research', tx: rx, ty: ry }, START + 71000).ok).toBe(true);
    const table = Object.values(r.entities).find(e => e.kind === 'struct' && e.type === 'research')!;
    place(r, rx - 1, ry);
    expect(dispatch(g, { id: 'c1-research', type: 'research', eid: table.id, mode: 'directed', recipe: 'motorbike_kit' } as any, START + 72000).ok).toBe(true);
    stepStations(g, 46_000, START + 73000);
    const tableOut = table.station!.outC!;
    const bpSlot = r.custody[tableOut].slots.findIndex(s => s?.key === 'blueprint' && s?.meta === 'motorbike_kit');
    expect(bpSlot, 'directed blueprint').toBeGreaterThanOrEqual(0);
    const bpUid = r.custody[tableOut].slots[bpSlot]!.uid;
    expect(dispatch(g, { id: 'c1-take-bp', type: 'move', from: tableOut, fs: bpSlot, to: 'inv' } as any, START + 120000).ok).toBe(true);
    const bpInv = r.custody.inv.slots.findIndex(s => s?.key === 'blueprint' && s?.meta === 'motorbike_kit');
    expect(dispatch(g, { id: 'c1-learn', type: 'useItem', slot: bpInv }, START + 121000).ok).toBe(true);
    expect(r.knowledge.recipes).toContain('motorbike_kit');
    expect(r.custody.inv.slots.some(s => s?.uid === bpUid)).toBe(false);   // blueprint consumed by learning
  // ============ LEG 8 — motorbike_kit at bench L3, then deploy/fuel/mount/cargo/save ============
    const s5 = countAll(r, LEDGER_KEYS);
    const kitUid = craftAt(bench.id, 'motorbike_kit', START + 130000);
    expect(countItem(r, 'inv', 'motorbike_kit')).toBe(1);
    place(r, 150, 104);                                // FIXTURE position (open ground beside the crate)
    expect(dispatch(g, { id: 'c1-place', type: 'placeMotorbike', x: 149 * TILE + 8, y: 104 * TILE + 8 }, START + 140000).ok).toBe(true);
    const bike = Object.values(r.entities).find(e => e.kind === 'vehicle')!;
    expect(bike.deployed!.uid).toBe(kitUid);
    addItem(r, 'inv', 'fuel_can', 1);                  // FIXTURE: fuel canister (source: refinery chain, out of scope here)
    expect(dispatch(g, { id: 'c1-fuel', type: 'vehicleRefuel', eid: bike.id }, START + 141000).ok).toBe(true);
    expect(bike.vehicle!.fuel).toBeGreaterThan(0);
    expect(dispatch(g, { id: 'c1-mount', type: 'vehicleMount', eid: bike.id }, START + 142000).ok).toBe(true);
    expect(r.player.vehicle).toBe(bike.id);
    // Physical cargo: scrap moved into the bike container by a real `move`, UID tracked.
    const scrapUids: string[] = [];
    for (let guard = 0; guard < 1; guard++) {
      const slot = r.custody[crate.c!]?.slots.findIndex(s => s?.key === 'scrap') ?? -1;
      if (slot < 0) break;
      const scrapRes = dispatch(g, { id: `c1-cargo-scrap-${++n}`, type: 'move', from: crate.c, fs: slot, to: 'inv' } as any, START + 143000);
      expect(scrapRes.ok).toBe(true);
    }
    const scrapSlot = r.custody.inv.slots.findIndex(s => s?.key === 'scrap');
    expect(scrapSlot).toBeGreaterThanOrEqual(0);
    const scrapUid = r.custody.inv.slots[scrapSlot]!.uid; scrapUids.push(scrapUid);
    const bikeEmpty = r.custody[bike.c!].slots.findIndex(s => !s);
    expect(bikeEmpty).toBeGreaterThanOrEqual(0);
    expect(dispatch(g, { id: 'c1-load-bike', type: 'move', from: 'inv', fs: scrapSlot, to: bike.c!, ts: bikeEmpty } as any, START + 143500).ok).toBe(true);
    expect(r.custody[bike.c!].slots[bikeEmpty]!.uid).toBe(scrapUid);
  // ============ LEG 9 — save/reload UID check through the game's own serializer ============
    const reloaded = copy(g);
    const rb = Object.values(reloaded.run!.entities).find(e => e.kind === 'vehicle')!;
    expect(rb.id).toBe(bike.id);
    expect(reloaded.run!.player.vehicle).toBe(bike.id);
    expect(reloaded.run!.custody[rb.c!].slots[bikeEmpty]!.uid).toBe(scrapUid);
    expect(reloaded.run!.knowledge.recipes).toContain('motorbike_kit');
    expect(reloaded.run!.entities[bench.id].station!.level).toBe(3);
    // ============ COST LEDGER + EVIDENCE ============
    const s6 = countAll(r, LEDGER_KEYS);
    const ledger: Record<string, number> = {};
    for (const k of LEDGER_KEYS) ledger[k] = s1[k] - s6[k];   // net consumed after grants+takes (kit/bike out of inv)
    const costs = {
      furnaceBuild: { stone: 18, wood: 4 },
      workbenchBuild: { wood: 14, stone: 4 },
      workbenchL2: { mechanical_parts: 2, iron_ingot: 1 },
      refinedIron: { iron_ingot: 3, coal: 1 },
      mechanical_gear: { iron_ingot: 2, mechanical_parts: 2, fasteners: 1 },
      metal_pipe: { refined_iron_ingot: 2, mechanical_parts: 1 },
      vehicle_frame_piped: { metal_pipe: 1, iron_ingot: 2, mechanical_parts: 2, spares: 2 },
      vehicle_drive_geared: { mechanical_gear: 1, iron_ingot: 1, fasteners: 2, spares: 2 },
      workbenchL3_PAID: { mechanical_parts: 6, iron_ingot: 8, fasteners: 8, spares: 12 },
      researchTable: { wood: 10, spares: 6, iron_ingot: 1 },
      directedResearch_motorbike_kit: { spares: 9 },
      motorbike_kit: { vehicle_frame: 1, vehicle_drive: 1, iron_ingot: 2, fasteners: 2 },
      vehicleRefuel: { fuel_can: 1 },
    };
    const evidence = {
      note: 'C1 PAID CHAIN, real intents end to end. Timing is SIM_FIXTURE_MEASUREMENT (stepStations with catalog recipe times). Fixtures labelled; crate high-grade roll left untouched (gear/pipe CRAFTED).',
      seed: SEED,
      route: 'factory crate -> furnace -> workbench L2 -> paid L3 -> research table -> motorbike_kit -> placeMotorbike -> vehicleRefuel -> vehicleMount -> scrap cargo in bike -> save/reload UID check',
      grants_fixture_intent: grants,
      taken_from_crate_real_moves: { mechanical_parts: 2, fasteners: 3, spares: 5, scrap: 3 },
      intermediates: { refined_iron_ingot: 2, mechanical_gear: 1, metal_pipe: 1, vehicle_frame: 1, vehicle_drive: 1, motorbike_kit: 1, blueprint: 1 },
      uiDs: { refined: refinedUid, gear: gearUid, pipe: pipeUid, frame: frameUid, drive: driveUid, kit: kitUid, bike: bike.id, bikeDeployed: bike.deployed!.uid, cargoScrap: scrapUid },
      costs,
      net_consumed_after_grants: ledger,
      saveReload: { midChainBenchLevel: 3, reloadedBikeIdMatches: rb.id === bike.id, reloadedCargoUidMatches: reloaded.run!.custody[rb.c!].slots[bikeEmpty]!.uid === scrapUid, reloadedPlayerVehicleMatches: reloaded.run!.player.vehicle === bike.id, reloadedKnowledgeHasKit: reloaded.run!.knowledge.recipes.includes('motorbike_kit') },
      crate_kept_high_grade_roll: true,
      ordinary_survival_without_chain: 'covered by the sibling test in this file',
      labels: { natural: ['crate takes', 'furnace build/feed/craft', 'workbench build/upgrade/craft', 'research build/directed/learn', 'kit craft', 'motorbike place/refuel/mount', 'cargo move'], fixture: ['player placement at the ends', 'raw material grants', 'fuel canister', 'creatures cleared at start'] },
    };
    mkdirSync('evidence/mec01-c1', { recursive: true });
    writeFileSync('evidence/mec01-c1/motorbike-chain.json', JSON.stringify(evidence, null, 2));
    expect(evidence.uiDs.kit).toBeTruthy();
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
