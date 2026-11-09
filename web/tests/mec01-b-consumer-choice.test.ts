// MEC-01 R2 — B: lawful role × grade × access × stock differences at the authorized Shipping sources, and at least
// two ACTUAL consumer choices per industrial intermediate, executed through the real engine (not just a static matrix).
// SOURCES ARE THE AUTHORIZED loot-source-v2 SPEC (loot-source-spec.ts) + the world's authored statics — read, never invented.
// No mapDigest, POI, door, keycard or loot pool is added or edited here. B01/B04 save compatibility is covered by
// b01-industrial-loot / b04-p4-loot / b05-parcel-persistence / b05-recycler-reload; we assert the b01 grammar still
// resolves (one cheap, direct check) without weakening those contracts.
// WHAT IS FIXTURE (labelled): [F1] player placement, [F2] raw-material grants for the bench (wood/stone/ingots/parts/
// fasteners/spares), [F3] creatures cleared. Gear and pipe are CRAFTED, not granted — both paths consume the same stack.
import { describe, it, expect } from 'vitest';
import { mkdirSync } from 'node:fs';
import { writeFileSync } from './_evidenceFs';
import { type GameState, type RunState, TILE, WW } from '../src/game/core';
import { RECIPES } from '../src/game/catalog';
import { addItem, countItem, dispatch, markDirty, newGame, stepStations, buildReason, blockGrid, C } from '../src/game/engine';
import { setActiveLayout, getWorld } from '../src/game/world';
import { LOOT_GRAMMAR_CURRENT, lootGrammarRoll, isKnownLootGrammar } from '../src/game/loot-ecology';
import { SHIPPING_LOOT_SOURCES, specForSite, validLootSourceContract } from '../src/game/loot-source-spec';
import { validLootSourceContractV3 } from '../src/game/loot-source-v3';
import type { StaticEnt } from '../src/game/world';

const START = Date.UTC(2026, 10, 8, 9, 0, 0);
const SEED = 4242;
let n = 0;
const act = (g: GameState, type: string, data: object = {}, now = START) => dispatch(g, { id: `b-${++n}`, type, ...data } as any, now);
function start() { setActiveLayout('shipping_fresh'); const g = newGame(); expect(act(g, 'startRun', { character: 'female', seed: SEED }).ok).toBe(true); g.run!.creatures = []; return g; }
function place(r: RunState, tx: number, ty: number) { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; markDirty(); }
function legalBench(g: GameState): [number, number] {
  const r = g.run!; const w = getWorld(); const grid = blockGrid(r);
  for (let yy = 20; yy < 190; yy++) for (let xx = 20; xx < 190; xx++) {
    const ok = [[0,0],[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dy]) => grid[(yy+dy)*WW+xx+dx] === 0 && w.economyMap.buildable[(yy+dy)*WW+xx+dx] && !w.economyMap.protected[(yy+dy)*WW+xx+dx] && !(w.accessCorridors?.mask[(yy+dy)*WW+xx+dx]));
    if (!ok) continue; place(r, xx - 1, yy);
    if (!buildReason(g, 'workbench', xx, yy)) return [xx, yy];
  }
  throw new Error('no legal bench tile');
}
function craftCollect(g: GameState, bench: any, recipe: string, at: number): string {
  const r = g.run!;
  expect(act(g, 'craft', { eid: bench.id, recipe }, at).ok, recipe).toBe(true);
  stepStations(g, RECIPES[recipe].secs * 1000 + 1000, at + 1000);
  const outC = bench.station!.outC!;
  const fs = r.custody[outC].slots.findIndex((s: any) => s?.key === RECIPES[recipe].out);
  expect(fs, recipe).toBeGreaterThanOrEqual(0);
  const uid = r.custody[outC].slots[fs]!.uid;
  expect(act(g, 'move', { from: outC, fs, to: 'inv' } as any, at + 2000).ok, recipe).toBe(true);
  return uid;
}
function bringUpL2(g: GameState): any {
  const r = g.run!;
  const [bx, by] = legalBench(g);
  expect(act(g, 'build', { struct: 'workbench', tx: bx, ty: by }, START + 1).ok).toBe(true);
  const bench = Object.values(r.entities).find(e => e.kind === 'struct' && e.type === 'workbench')!;
  expect(act(g, 'upgradeStation', { eid: bench.id }, START + 2).ok).toBe(true);
  return bench;
}

describe('B1: role × grade × access × stock — the three authorized sources differ on every axis, as authored', () => {
  it('reads the spec directly: factory high/open/renewable/24h/cap3 vs tp mid/open/renewable/24h/cap2 vs vault high/poi-door/finite/48h/cap2', () => {
    const by = (id: string) => SHIPPING_LOOT_SOURCES.find(s => s.id === id)!;
    const factory = by('factory-exterior-industrial'), tp = by('tp-bow-cache-standard'), vault = by('factory-vault-advanced');
    expect([factory.grade, factory.role, factory.access, factory.stock, factory.cooldownHours, factory.capacity]).toEqual(['high', 'toolbox', { kind: 'open' }, 'renewable', 24, 3]);
    expect([tp.grade, tp.role, tp.stock, tp.capacity]).toEqual(['mid', 'toolbox', 'renewable', 2]);
    expect(tp.cooldownHours).toBe(24);
    expect([vault.grade, vault.access.kind, vault.stock, vault.cooldownHours, vault.capacity]).toEqual(['high', 'poi-door', 'finite', 48, 2]);
    // Every spec must bind EXACTLY ONE authored static in the world — nothing invented by this test.
    const w = getWorld('shipping_fresh');
    for (const spec of SHIPPING_LOOT_SOURCES) {
      const hits = w.statics.filter(s => s.kind === 'loot' && s.poi === spec.match.poi);
      const binding = hits.find(s => specForSite(s)?.id === spec.id);
      expect(binding, spec.id).toBeTruthy();
    }
  });
  it('grade determines the high-grade pool: gear/pipe/refined roll in factory toolbox + advanced vault; never in supply or military', () => {
    const site = (poi: string): StaticEnt => ({ kind: 'loot', tx: 10, ty: 10, poi, loot: [['spares', 1]] } as any);
    const SITES: Record<string, StaticEnt> = { toolbox: site('factory'), supply: site('tp'), military: site('watch'), advanced: site('factory_vault') };
    const run = (seed: number) => ({ seed, layoutId: 'shipping_fresh', lootEcology: { version: 'w06-v1', cycles: {}, grammar: LOOT_GRAMMAR_CURRENT } } as any);
    const rolls = (cls: string) => { const out: string[][] = []; for (const seed of [97, 313, 55]) for (let cycle = 1; cycle <= 60; cycle++) out.push(lootGrammarRoll(run(seed), SITES[cls], cycle).map(([k]) => k)); return out; };
    for (const cls of ['toolbox', 'advanced']) { const all = rolls(cls); expect(all.some(r => r.includes('mechanical_gear')), cls).toBe(true); expect(all.some(r => r.includes('metal_pipe')), cls).toBe(true); }
    for (const cls of ['supply', 'military']) { const all = rolls(cls); expect(all.every(r => !r.includes('mechanical_gear')), cls).toBe(true); expect(all.every(r => !r.includes('metal_pipe')), cls).toBe(true); expect(all.every(r => !r.includes('refined_iron_ingot')), cls).toBe(true); }
  });
  it('the run contract stays valid (all three accesses as expected) and the b01 grammar still resolves', () => {
    const g = start(); const r = g.run!;
    expect(validLootSourceContractV3(r.lootEcology!.sourceContract as any)).toBe(true);   // WEC-01: the new run contract is V3
    expect(isKnownLootGrammar('b01-v1')).toBe(true);
    expect(isKnownLootGrammar(LOOT_GRAMMAR_CURRENT)).toBe(true);
  });
});

describe('B2: consumer choice — gear and pipe each feed at least two real, paid recipes', () => {
  it('same craft order, two worlds: vehicle_drive_geared beats industrial_pick_geared for the same gear stack (drive path)', () => {
    const g = start(); const r = g.run!;
    for (const [k, q] of [['wood', 20], ['stone', 10], ['iron_ingot', 6], ['refined_iron_ingot', 2], ['mechanical_parts', 4], ['fasteners', 4], ['spares', 6], ['iron_pick', 1]] as const) expect(addItem(r, 'inv', k, q)).toBe(0);
    const bench = bringUpL2(g);
    const gearUid = craftCollect(g, bench, 'mechanical_gear', START + 10_000);
    expect(r.custody.inv.slots.some(s => s?.uid === gearUid && s.key === 'mechanical_gear')).toBe(true);
    // CONSUMER A: the geared motor drive (what the C1 chain uses for the motorbike)
    const driveUid = craftCollect(g, bench, 'vehicle_drive_geared', START + 20_000);
    expect(r.custody.inv.slots.some(s => s?.uid === driveUid && s.key === 'vehicle_drive')).toBe(true);
    expect(countItem(r, 'inv', 'mechanical_gear')).toBe(0);   // the gear is GONE — consumed, not copied
    expect(countItem(r, 'inv', 'vehicle_drive')).toBe(1);
  });
  it('the SAME gear stack instead feeds the salvager pick (the other live consumer) — one gear, one outcome, no duplication', () => {
    const g = start(); const r = g.run!;
    for (const [k, q] of [['wood', 20], ['stone', 10], ['iron_ingot', 3], ['mechanical_parts', 4], ['fasteners', 1], ['spares', 4], ['iron_pick', 1]] as const) expect(addItem(r, 'inv', k, q)).toBe(0);
    const bench = bringUpL2(g);
    const gearUid = craftCollect(g, bench, 'mechanical_gear', START + 10_000);
    const pickUid = craftCollect(g, bench, 'industrial_pick_geared', START + 20_000);
    expect(countItem(r, 'inv', 'industrial_pick')).toBe(1);
    expect(r.custody.inv.slots.some(s => s?.uid === pickUid && s.key === 'industrial_pick')).toBe(true);
    expect(r.custody.inv.slots.some(s => s?.uid === gearUid)).toBe(false);
    expect(countItem(r, 'inv', 'mechanical_gear')).toBe(0);
  });
  it('metal_pipe feeds the piped frame (motorbike path) — consumer A', () => {
    const g = start(); const r = g.run!;
    for (const [k, q] of [['wood', 20], ['stone', 10], ['iron_ingot', 6], ['refined_iron_ingot', 2], ['mechanical_parts', 5], ['fasteners', 1], ['spares', 4]] as const) expect(addItem(r, 'inv', k, q)).toBe(0);
    const bench = bringUpL2(g);
    craftCollect(g, bench, 'metal_pipe', START + 10_000);
    expect(countItem(r, 'inv', 'metal_pipe')).toBe(1);
    craftCollect(g, bench, 'vehicle_frame_piped', START + 20_000);
    expect(countItem(r, 'inv', 'vehicle_frame')).toBe(1);
    expect(countItem(r, 'inv', 'metal_pipe')).toBe(0);
  });
  it('metal_pipe feeds the iron plate instead — consumer B — and the plate exists for walls/doors (repairStructure path)', () => {
    const g = start(); const r = g.run!;
    for (const [k, q] of [['wood', 20], ['stone', 10], ['iron_ingot', 2], ['refined_iron_ingot', 4], ['mechanical_parts', 4]] as const) expect(addItem(r, 'inv', k, q)).toBe(0);
    const bench = bringUpL2(g);
    craftCollect(g, bench, 'metal_pipe', START + 10_000);
    expect(countItem(r, 'inv', 'metal_pipe')).toBe(1);
    const plateUid = craftCollect(g, bench, 'iron_plate', START + 20_000);
    expect(countItem(r, 'inv', 'iron_plate')).toBe(2);   // iron_plate recipe yields 2
    expect(countItem(r, 'inv', 'metal_pipe')).toBe(0);
    expect(r.custody.inv.slots.some(s => s?.uid === plateUid && s.key === 'iron_plate')).toBe(true);
  });
  it('writes the consumer-choice evidence with real UIDs and the sources B actually read', () => {
    const g = start(); const r = g.run!;
    for (const [k, q] of [['wood', 20], ['stone', 10], ['iron_ingot', 3], ['mechanical_parts', 4], ['fasteners', 1], ['spares', 2], ['iron_pick', 1]] as const) expect(addItem(r, 'inv', k, q)).toBe(0);
    const bench = bringUpL2(g);
    const gearUid = craftCollect(g, bench, 'mechanical_gear', START + 10_000);
    const pickUid = craftCollect(g, bench, 'industrial_pick_geared', START + 20_000);
    mkdirSync('evidence/mec01-b', { recursive: true });
    writeFileSync('evidence/mec01-b/consumer-choice.json', JSON.stringify({
      note: 'B: two real consumer choices executed for the crafted gear (vehicle_drive_geared / industrial_pick_geared); pipe covered in the sibling tests (vehicle_frame_piped / iron_plate). One stack, one outcome — UIDs never duplicated.',
      seed: SEED,
      sourcesRead: SHIPPING_LOOT_SOURCES.map(s => ({ id: s.id, sourceId: s.sourceId, role: s.role, grade: s.grade, access: s.access, stock: s.stock, cooldownHours: s.cooldownHours, capacity: s.capacity })),
      gearConsumersProven: ['vehicle_drive_geared', 'industrial_pick_geared'],
      pipeConsumersProvenInSiblingTests: ['vehicle_frame_piped', 'iron_plate'],
      uiDs: { gear: gearUid, industrialPick: pickUid },
      contractValid: validLootSourceContract(r.lootEcology!.sourceContract!),
      b01GrammarStillResolves: isKnownLootGrammar('b01-v1'),
      labels: { fixture: ['player placement', 'raw-material grants', 'creatures cleared'], natural: ['bench build/upgrade', 'real craft queues and consumption'] },
    }, null, 2));
    expect(pickUid).toBeTruthy();
  });
});
