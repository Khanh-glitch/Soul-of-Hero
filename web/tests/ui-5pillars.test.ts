import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BAL, TILE, WW, type GameState } from '../src/game/core';
import { C, addItem, blockGrid, dispatch, markDirty, mkContainer, mkStack, newGame } from '../src/game/engine';
import { getWorld, setActiveLayout } from '../src/game/world';
import { canDropInSlot } from '../src/ui/dragSlots';
import { evaluateFieldNotes, readFieldNoteStore, writeFieldNoteStore } from '../src/game/field-notes';
import { classifyOfflineReturn, readReturnHistory, recordReturnHistory, type OfflineReturnV1 } from '../src/game/return-report';

const NOW = Date.UTC(2026, 10, 10, 8, 0);
let base: GameState;

beforeAll(() => {
  setActiveLayout('shipping_fresh');
  base = newGame();
  expect(dispatch(base, { id: 'p5-start', type: 'startRun', character: 'female', seed: 91 }, NOW).ok).toBe(true);
  const r = base.run!;
  r.creatures = [];
  const grid = blockGrid(r), w = getWorld();
  for (let y = 20; y < 180; y++) {
    let placed = false;
    for (let x = 20; x < 180; x++) {
      if (grid[y * WW + x] === 0 && !w.sourceV3[y * WW + x]) {
        r.player.x = x * TILE + 8; r.player.y = y * TILE + 8;
        placed = true; break;
      }
    }
    if (placed) break;
  }
  C(r, 'inv').slots = Array(24).fill(null);
  markDirty();
});

afterAll(() => setActiveLayout('shipping'));

const cloneRun = () => {
  setActiveLayout('shipping_fresh');
  const g = structuredClone(base);
  markDirty();
  return { g, r: g.run! };
};

describe('Inventory drop-target validation mirrors engine custody', () => {
  it('enforces equipment slots, station fuel burnables, and read-only output containers', () => {
    const { r } = cloneRun();
    C(r, 'inv').slots[0] = mkStack(r, 'scrap_helm', 1);
    C(r, 'inv').slots[1] = mkStack(r, 'wood', 4);
    C(r, 'inv').slots[2] = mkStack(r, 'fuel_can', 1);

    expect(canDropInSlot(r, 'inv', 0, 'eq', 0).valid).toBe(true);   // helm -> head
    expect(canDropInSlot(r, 'inv', 0, 'eq', 1).valid).toBe(false);  // helm -> body rejected
    expect(canDropInSlot(r, 'inv', 1, 'eq', 0).valid).toBe(false);  // wood -> head rejected
    expect(canDropInSlot(r, 'inv', 1, 'inv', 8).valid).toBe(true);  // wood -> backpack valid

    const fuelC = mkContainer(r, 'fuel', 3);
    const outC = mkContainer(r, 'out', 6);
    r.entities.st_test = {
      id: 'st_test', kind: 'struct', type: 'furnace', x: r.player.x + 16, y: r.player.y,
      tx: Math.floor(r.player.x / TILE) + 1, ty: Math.floor(r.player.y / TILE),
      station: { queue: [], burn: 0, fuelC: fuelC.id, outC: outC.id },
    };
    expect(canDropInSlot(r, 'inv', 1, fuelC.id, 0).valid).toBe(true);   // wood is station burnable
    expect(canDropInSlot(r, 'inv', 2, fuelC.id, 0).valid).toBe(false);  // fuel_can is NOT station fuel
    expect(canDropInSlot(r, 'inv', 1, outC.id, 0).valid).toBe(false);   // outC is read-only
  });
});

describe('Contextual Field Notes respond to player state without repetition or production leaks', () => {
  it('triggers first_landfall on fresh arrival, advances when pack_and_craft is relevant, and respects dismiss & QA isolation', () => {
    const { r } = cloneRun();
    const actions = new Set<string>();
    const s0 = readFieldNoteStore(r, true);

    const e1 = evaluateFieldNotes(r, NOW + 5000, actions, s0);
    expect(e1.active?.id).toBe('first_landfall');

    // Gathering raw wood makes pack_and_craft active (higher priority than first_landfall)
    addItem(r, 'inv', 'wood', 2);
    const e2 = evaluateFieldNotes(r, NOW + 6000, actions, e1.nextStore);
    expect(e2.active?.id).toBe('pack_and_craft');

    // Opening Survivor auto-resolves pack_and_craft permanently for this run
    actions.add('survivor');
    const e3 = evaluateFieldNotes(r, NOW + 7000, actions, e2.nextStore);
    expect(e3.nextStore.resolved).toContain('pack_and_craft');
    expect(e3.active?.id).not.toBe('pack_and_craft');

    // Dismissing first_landfall keeps it dismissed and persists in QA memory without touching localStorage
    const oldLS = (globalThis as any).localStorage;
    (globalThis as any).localStorage = { getItem: () => { throw Error('should not touch localStorage in QA'); }, setItem: () => { throw Error('should not touch localStorage in QA'); } };
    try {
      const saved = writeFieldNoteStore(r, true, { ...e3.nextStore, dismissed: ['first_landfall'] });
      const e4 = evaluateFieldNotes(r, NOW + 8000, actions, saved);
      expect(e4.active).toBeNull();
    } finally {
      (globalThis as any).localStorage = oldLS;
    }

    // Critical thirst triggers hunger_thirst contextually
    r.player.thirst = 40;
    const e5 = evaluateFieldNotes(r, NOW + 9000, actions, readFieldNoteStore(r, true));
    expect(e5.active?.id).toBe('hunger_thirst');
  });
});

describe('Offline Return classification and QA-isolated history', () => {
  const mkReport = (over: Partial<OfflineReturnV1> = {}): OfflineReturnV1 => ({
    version: 'offline-return-v1',
    away: { fromAt: NOW, toAt: NOW + 60000, gapMs: 60000, expired: false, quiet: false },
    summary: 'Away 1 min.',
    sections: { body: [], home: [], production: [], loss: [], world: [] },
    next: [],
    receiptCount: 0,
    ...over,
  });

  it('classifies quiet/idle reports as minimal, work events as notable, and losses/deaths/expiry as critical', () => {
    expect(classifyOfflineReturn(mkReport({ away: { fromAt: NOW, toAt: NOW + 2000, gapMs: 2000, expired: false, quiet: true } }))).toBe('minimal');
    expect(classifyOfflineReturn(mkReport({ receiptCount: 1, away: { fromAt: NOW, toAt: NOW + 17 * 60000, gapMs: 17 * 60000, expired: false, quiet: false } }))).toBe('minimal');
    expect(classifyOfflineReturn(mkReport({ receiptCount: 2 }))).toBe('notable');
    expect(classifyOfflineReturn(mkReport({ away: { fromAt: NOW, toAt: NOW + BAL.run.maxRunHours * 3600_000, gapMs: BAL.run.maxRunHours * 3600_000, expired: true, quiet: false } }))).toBe('critical');
    expect(classifyOfflineReturn(mkReport({
      sections: {
        body: [], home: [], production: [], world: [],
        loss: [{ id: 'l1', tone: 'bad', text: 'Wall lost', receipts: ['r1'], source: 'event' }],
      },
    }))).toBe('critical');
  });

  it('records and reads past return chronicles in memory in QA mode', () => {
    const { r } = cloneRun();
    const rep1 = mkReport({ receiptCount: 1, away: { fromAt: NOW, toAt: NOW + 3600_000, gapMs: 3600_000, expired: false, quiet: false } });
    const rep2 = mkReport({ receiptCount: 3, away: { fromAt: NOW + 3600_000, toAt: NOW + 7200_000, gapMs: 3600_000, expired: false, quiet: false } });
    recordReturnHistory(r, true, rep1);
    const hist = recordReturnHistory(r, true, rep2);
    expect(hist).toHaveLength(2);
    expect(readReturnHistory(r, true)[0].report.receiptCount).toBe(3);
  });
});
