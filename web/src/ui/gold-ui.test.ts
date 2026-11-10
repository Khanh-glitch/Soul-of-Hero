import { describe, expect, it } from 'vitest';
import type { RunState } from '../game/core';
import { goldGoals } from './GoldJourney';
import { cueFromReceipt } from './GoldFeedback';
import { RECIPES, ALWAYS_KNOWN_RECIPES } from '../game/catalog';
import { knownGoldRecipes, workCategory, GOLD_WORK_CATEGORIES } from './GoldWork';

const NOW = 1_762_800_000_000;
function run(overrides: Partial<RunState> = {}): RunState {
  return {
    startedAt: NOW - 7 * 3_600_000,
    player: {skills:{combat:2}} as unknown as RunState['player'],
    qaOffset: 0,
    poiSeen: ['po_ruinedkeep', 'po_cairns'],
    sideBossDefeated: { boss_ronin: NOW - 12_000 },
    knowledge: { recipes: ['stone_pick', 'rope', 'bandage'], studied: [] },
    elderStones: ['stone_surtur'],
    receipts: [
      { id: 'r1', seq: 1, at: NOW - 1000, kind: 'harvest', detail: 'stone' },
      { id: 'r2', seq: 2, at: NOW - 100, kind: 'creature.kill', detail: 'wolf' },
    ],
    entities: { cab: { id: 'cab', kind: 'struct', type: 'claim' } as RunState['entities'][string] },
    ...overrides,
  } as RunState;
}
describe('Gold Waymark adapter on authoritative SOH R12 world', () => {
  it('derives progress only from observed run state, with no rewards or mutation', () => {
    const r = run();
    const original = JSON.stringify(r);
    const goals = goldGoals(r, NOW);
    expect(goals.map(g => g.id)).toEqual(['explore','shelter','craft','endure','hunt','guardians','stones']);
    expect(Object.fromEntries(goals.map(g => [g.id, g.progress]))).toMatchObject({
      explore: 2, shelter: 1, craft: 0, endure: 7, hunt: 1, guardians: 1, stones: 1,
    });
    expect(JSON.stringify(r)).toBe(original);
  });
  it('does not spoof map knowledge, boss victories or offline progress', () => {
    const goals = goldGoals(run({
      poiSeen: [], receipts: [], sideBossDefeated: {}, elderStones: [],
      knowledge: { recipes: [], studied: [] }, entities: {}, player: {skills:{combat:0}} as unknown as RunState['player'],
    }), NOW);
    for (const id of ['explore', 'craft', 'hunt', 'guardians', 'stones', 'shelter']) {
      expect(goals.find(g => g.id === id)?.progress).toBe(0);
    }
  });
  it('honors committed event priority without inventing a stone pickup or reward', () => {
    const elder = cueFromReceipt({id:'r3',seq:3,at:NOW,kind:'elder.defeat',detail:'surtur'});
    expect(elder?.level).toBe(5);
    expect(elder?.detail).toContain('must still be claimed');
    const sideboss = cueFromReceipt({id:'r4',seq:4,at:NOW,kind:'boss.defeat',detail:'boss_ronin'});
    expect(sideboss?.level).toBe(4);
    expect(cueFromReceipt({id:'r5',seq:5,at:NOW,kind:'harvest',detail:'oak'})).toBeNull();
  });
  it('excludes ALL baseline recipes and admits genuinely learned non-base recipes', () => {
    const base = Object.keys(RECIPES).filter(k => RECIPES[k].base || ALWAYS_KNOWN_RECIPES.includes(k));
    const studied = Object.keys(RECIPES).filter(k => !RECIPES[k].base && !ALWAYS_KNOWN_RECIPES.includes(k)).slice(0,2);
    expect(goldGoals(run({knowledge:{recipes:base,studied:[]}}),NOW).find(g=>g.id==='craft')?.progress).toBe(0);
    expect(goldGoals(run({knowledge:{recipes:[...base,...studied],studied:[]}}),NOW).find(g=>g.id==='craft')?.progress).toBe(studied.length);
  });
  it('WORK never lists undiscovered recipes, and category filters do not invent any', () => {
    expect(knownGoldRecipes([], 'All')).toEqual([]);
    const known = Object.keys(RECIPES).filter(k=>!!RECIPES[k]).slice(0,9);
    const list = knownGoldRecipes(known,'All');
    expect(list.every(k=>known.includes(k))).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    for (const category of GOLD_WORK_CATEGORIES.filter(k=>k!=='All')) {
      expect(knownGoldRecipes(known,category).every(k=>workCategory(k)===category)).toBe(true);
    }
  });
  it('does not grant, consume or mint a gameplay item from UI-only tracking', () => {
    const r = run();
    const oldReceipts = r.receipts.length, oldStones = r.elderStones.length;
    goldGoals(r, NOW + 48 * 3_600_000);
    expect(r.receipts).toHaveLength(oldReceipts);
    expect(r.elderStones).toHaveLength(oldStones);
  });
});
