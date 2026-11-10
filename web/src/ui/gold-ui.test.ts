import { describe, expect, it } from 'vitest';
import type { RunState } from '../game/core';
import { goldGoals } from './GoldJourney';

const NOW = 1_762_800_000_000;
function run(overrides: Partial<RunState> = {}): RunState {
  return {
    startedAt: NOW - 7 * 3_600_000,
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
      explore: 2, shelter: 1, craft: 3, endure: 7, hunt: 1, guardians: 1, stones: 1,
    });
    expect(JSON.stringify(r)).toBe(original);
  });
  it('does not spoof map knowledge, boss victories or offline progress', () => {
    const goals = goldGoals(run({
      poiSeen: [], receipts: [], sideBossDefeated: {}, elderStones: [],
      knowledge: { recipes: [], studied: [] }, entities: {},
    }), NOW);
    for (const id of ['explore', 'craft', 'hunt', 'guardians', 'stones', 'shelter']) {
      expect(goals.find(g => g.id === id)?.progress).toBe(0);
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
