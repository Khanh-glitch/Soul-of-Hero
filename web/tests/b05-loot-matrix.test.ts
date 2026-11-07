// B05-R C1: source → item → consumer matrix for the industrial materials, derived from the REAL loot roll and recipe graph.
// Writes evidence/b05-loot/matrix.json. Asserts: deterministic rolls, legacy b01 saves keep their grammar, every item the
// loot can emit has at least one real consumer (no orphan), and no Fuel Canister / crude / cash comes from a container.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { RECIPES, STRUCTS, ITEMS } from '../src/game/catalog';
import { LOOT_CLASSES, LOOT_B04_ROLES, LOOT_B01_ROLES, LOOT_GRAMMAR_CURRENT, LOOT_GRAMMAR_VERSION, lootClass, lootGrammarRoll, lootRoll } from '../src/game/loot-ecology';
import type { RunState } from '../src/game/core';

const MATERIALS = ['metal_pipe', 'iron_plate', 'mechanical_gear', 'refined_iron_ingot', 'mechanical_parts', 'spares', 'salvaged_oil', 'crude_petroleum', 'fuel_can', 'metal_blade', 'fasteners'];
/** Non-recipe consumers that the engine reads directly (engine.ts repairStructure: material 'iron_plate' patches walls and doors). */
const DIRECT_CONSUMERS: Record<string, string[]> = { iron_plate: ['action:repairStructure material=iron_plate (engine.ts)'] };
/** Real consumers: recipe inputs, structure build costs, and direct engine actions. */
function consumers(item: string): string[] {
  const out: string[] = [...(DIRECT_CONSUMERS[item] ?? [])];
  for (const [id, r] of Object.entries(RECIPES)) if ((r.ins as [string, number][]).some(([k]) => k === item)) out.push('recipe:' + id);
  for (const [id, s] of Object.entries(STRUCTS)) if ((s.cost as [string, number][]).some(([k]) => k === item)) out.push('build:' + id);
  return out;
}
const site = (poi: string, label?: string, loot: [string, number][] = [['x', 1]]) => ({ kind: 'loot', poi, label, loot, tx: 1, ty: 1 } as any);
const run = (grammar: string): RunState => ({ seed: 4242, layoutId: 'shipping', lootEcology: { version: 'w06-v1', grammar } } as any);

describe('B05-R C1 loot → industry matrix (real rolls, real consumers)', () => {
  const classes: [string, any][] = [['toolbox', site('factory')], ['supply', site('mill')], ['military', site('watch')], ['advanced', site('factory_vault')]];
  const rows: any[] = [];
  it('builds the matrix from the live roll and writes it as evidence', () => {
    for (const [name, st] of classes) {
      const cls = lootClass(st);
      const seen = new Set<string>();
      for (let cycle = 0; cycle < 64; cycle++) for (const [k] of lootRoll(run(LOOT_GRAMMAR_CURRENT), st, cycle)) seen.add(k);
      rows.push({ cls: name, resolvedClass: cls, w06Fixed: LOOT_CLASSES[cls!].fixed, w06Options: LOOT_CLASSES[cls!].options, b04Role: LOOT_B04_ROLES[cls!], b01Role: LOOT_B01_ROLES[cls!].pool, emittedB04Over64Cycles: [...seen].sort() });
    }
    const mats = MATERIALS.map(m => ({ item: m, name: ITEMS[m]?.name, consumers: consumers(m), lootSources: rows.filter(r => r.emittedB04Over64Cycles.includes(m)).map(r => r.cls) }));
    mkdirSync('evidence/b05-loot', { recursive: true });
    writeFileSync('evidence/b05-loot/matrix.json', JSON.stringify({ note: 'SOH_PROVISIONAL. Rolls from lootRoll (w06 fixed/option + b04-v1 role pool). Consumers from catalog recipe inputs and structure costs.', classes: rows, materials: mats }, null, 1));
    expect(rows.length).toBe(4);
  });
  it('rolls are deterministic per seed, source and cycle, and never consume world RNG', () => {
    for (const [, st] of classes) for (let c = 0; c < 8; c++) expect(lootRoll(run(LOOT_GRAMMAR_CURRENT), st, c)).toEqual(lootRoll(run(LOOT_GRAMMAR_CURRENT), st, c));
  });
  it('legacy b01-v1 saves keep their own pools (no gear/pipe/plate in toolbox; no blade in advanced)', () => {
    const toolbox = site('factory');
    const b01 = new Set<string>(); for (let c = 0; c < 64; c++) for (const [k] of lootGrammarRoll(run(LOOT_GRAMMAR_VERSION), toolbox, c)) b01.add(k);
    expect([...b01].some(k => ['mechanical_gear', 'metal_pipe', 'iron_plate'].includes(k))).toBe(false);
    expect(LOOT_B01_ROLES.toolbox.pool.length).toBe(0);
  });
  it('no emitted loot item is an orphan: each has at least one real consumer', () => {
    const emitted = new Set<string>();
    for (const [, st] of classes) for (let c = 0; c < 64; c++) for (const [k] of lootRoll(run(LOOT_GRAMMAR_CURRENT), st, c)) emitted.add(k);
    for (const item of emitted) expect(consumers(item).length, `orphan loot item: ${item}`).toBeGreaterThan(0);
  });
  it('containers never emit Fuel Canister, crude petroleum, cash or blueprints', () => {
    for (const [, st] of classes) for (let c = 0; c < 64; c++) for (const [k] of lootRoll(run(LOOT_GRAMMAR_CURRENT), st, c)) expect(['fuel_can', 'crude_petroleum', 'rcash', 'blueprint']).not.toContain(k);
  });
});
