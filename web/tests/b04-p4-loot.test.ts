// B04-P4 P3: cache families, role/grade discrimination, forbidden loot, and old-save grammar compatibility.
import { describe, it, expect } from 'vitest';
import { ITEMS } from '../src/game/catalog';
import { LOOT_B01_ROLES, LOOT_B04_ROLES, LOOT_GRAMMAR_CURRENT, LOOT_GRAMMAR_VERSION, isKnownLootGrammar, lootClass, lootGrammarRoll, lootSpriteKey, type LootClass } from '../src/game/loot-ecology';
import type { StaticEnt } from '../src/game/world';

const site = (poi: string, label?: string): StaticEnt => ({ kind: 'loot', tx: 10, ty: 10, poi, label, loot: [['spares', 1]] } as any);
const SITES: Record<LootClass, StaticEnt> = { toolbox: site('factory'), supply: site('tp'), military: site('watch'), advanced: site('factory_vault') };
const run = (seed: number, grammar: string) => ({ seed, layoutId: 'shipping', lootEcology: { version: 'w06-v1', cycles: {}, grammar } } as any);
const FORBIDDEN = ['rcash', 'blueprint', 'keycard', 'damaged_drive', 'energy_basic', 'energy_refined', 'core_blast', 'core_earthmother', 'iron_pick', 'iron_axe', 'iron_sword'];
function rollsOf(kind: LootClass, grammar: string) {
  const out: string[][] = [];
  for (const seed of [97, 313, 55]) for (let cycle = 1; cycle <= 60; cycle++) out.push(lootGrammarRoll(run(seed, grammar), SITES[kind], cycle).map(([k]) => k));
  return out;
}

describe('B04-P4 cache families are physically distinct and identifiable', () => {
  it('each W06 class maps to its own sprite family; unclassed crates keep the generic art', () => {
    expect(SITES.toolbox && lootClass(SITES.toolbox)).toBe('toolbox');
    const keys = (Object.keys(SITES) as LootClass[]).map(k => lootSpriteKey(SITES[k]));
    expect(new Set(keys).size).toBe(4);
    expect(keys).toEqual(['loot_toolbox', 'loot_supply', 'loot_military', 'loot_advanced']);
    expect(lootSpriteKey(site('unknown_poi'))).toBeNull();
  });
});

describe('B04-P4 roles and grades discriminate what each cache can hold (b04-v1, SOH_PROVISIONAL)', () => {
  it('advanced grade always carries the high-grade medkit; toolbox never does', () => {
    for (const grammar of [LOOT_GRAMMAR_CURRENT]) {
      expect(rollsOf('advanced', grammar).every(ks => ks.includes('medkit'))).toBe(true);
      expect(rollsOf('toolbox', grammar).some(ks => ks.includes('medkit'))).toBe(false);
    }
  });
  it('toolbox (metal role) and advanced draw physical metal sinks, with real variety across cycles', () => {
    const toolPicks = new Set(rollsOf('toolbox', LOOT_GRAMMAR_CURRENT).flat());
    expect(['mechanical_gear', 'metal_pipe', 'iron_plate'].every(k => toolPicks.has(k))).toBe(true);
    const advPicks = new Set(rollsOf('advanced', LOOT_GRAMMAR_CURRENT).flat());
    expect(advPicks.has('metal_blade')).toBe(true);
  });
  it('no class ever emits a forbidden item, and every pool entry is a defined item', () => {
    for (const kind of Object.keys(SITES) as LootClass[]) for (const ks of rollsOf(kind, LOOT_GRAMMAR_CURRENT)) {
      for (const k of ks) { expect(FORBIDDEN).not.toContain(k); expect(ITEMS[k]).toBeDefined(); }
    }
    for (const role of Object.values(LOOT_B04_ROLES)) for (const [k] of [...role.fixed, ...role.pool]) expect(FORBIDDEN).not.toContain(k);
  });
});

describe('B04-P4 old saves keep their b01-v1 grammar; grammar versions are validated', () => {
  it('b01-v1 runs never receive the new b04 metal/blade pools', () => {
    const adv = rollsOf('advanced', LOOT_GRAMMAR_VERSION).flat();
    expect(adv.includes('metal_blade') || adv.includes('mechanical_gear') || adv.includes('metal_pipe')).toBe(false);
    const tool = rollsOf('toolbox', LOOT_GRAMMAR_VERSION).flat();
    expect(tool.includes('iron_plate') || tool.includes('metal_pipe') || tool.includes('mechanical_gear')).toBe(false);
    expect(LOOT_B01_ROLES.toolbox.pool.length).toBe(0);                 // the b01 table is unchanged
  });
  it('the same run, source and cycle always produce the same physical stack (deterministic)', () => {
    const a = lootGrammarRoll(run(97, LOOT_GRAMMAR_CURRENT), SITES.advanced, 7);
    const b = lootGrammarRoll(run(97, LOOT_GRAMMAR_CURRENT), SITES.advanced, 7);
    expect(a).toEqual(b);
  });
  it('unknown grammar strings are refused (no silent acceptance)', () => {
    expect(isKnownLootGrammar('b01-v1')).toBe(true);
    expect(isKnownLootGrammar('b04-v1')).toBe(true);
    expect(isKnownLootGrammar('b99-v9')).toBe(false);
    expect(isKnownLootGrammar(undefined)).toBe(false);
  });
});
