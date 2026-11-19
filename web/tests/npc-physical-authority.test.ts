import { describe, it, expect } from 'vitest';
import { WW, TILE, HOUR } from '../src/game/core';
import { ITEMS } from '../src/game/catalog';
import { newGame, startRun, mkStack, sourceAt, blockGrid, mkCreature } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { humanConsume, humanPack, humanHarvest, tickNeeds, finalizeHumanOutcomes, advanceElderPressure, applyDamage, stepHumans, stepHumanCombat } from '../src/game/humanworld';
import { T0 } from './helpers/g1b-kit';

function scene() {
  const [gx, gy] = auToTile(921, 259), w = windowAround(gx, gy);
  setActiveLayout(layoutIdAt(w.originTx, w.originTy));
  const gs = newGame();
  expect(startRun(gs, 'female', T0, null, 7606, { tx: gx - w.originTx, ty: gy - w.originTy }).ok).toBe(true);
  const r = gs.run!, hw = r.humanWorld!, h = Object.values(hw.people)[0];
  humanPack(r, h).slots.fill(null);
  return { gs, r, hw, h, pack: humanPack(r, h) };
}

describe('human mutation boundaries', () => {
  it('one food debit grants one serving, not the full stack', () => {
    const { r, hw, h, pack } = scene();
    pack.slots[0] = mkStack(r, 'berries', 5); h.hunger = 0; h.thirst = 0;
    expect(humanConsume(r, hw, h, 'food', T0)).toBe(true);
    expect(h.hunger).toBe(ITEMS.berries.food!.hunger);
    expect(h.thirst).toBe(ITEMS.berries.food!.thirst ?? 0);
    expect(pack.slots[0]?.qty).toBe(4);
  });
  it('the last potable charge preserves the same empty vessel UID', () => {
    const { r, hw, h, pack } = scene();
    const key = Object.keys(ITEMS).find(k => ITEMS[k].waterContainer && ITEMS[k].charge)!;
    const flask = mkStack(r, key, 1); flask.charge = 1; pack.slots[0] = flask; h.thirst = 0;
    expect(humanConsume(r, hw, h, 'water', T0)).toBe(true);
    expect(pack.slots[0]).toMatchObject({ uid: flask.uid, charge: 0, qty: 1 });
    expect(humanConsume(r, hw, h, 'water', T0 + 1)).toBe(false);
  });
  it('non-vessel hydration consumes one real item and cannot be repeated for free', () => {
    const { r, hw, h, pack } = scene(); h.community = undefined;
    pack.slots[0] = mkStack(r, 'berries', 1); h.thirst = 0;
    expect(humanConsume(r, hw, h, 'water', T0)).toBe(true);
    expect(pack.slots[0]).toBeNull();
    expect(humanConsume(r, hw, h, 'water', T0 + 1)).toBe(false);
  });
  it('community permission grants neither remote food nor cross-floor hydration', () => {
    const { r, hw, h } = scene(), comm = hw.communities[h.community!];
    const store = r.custody[comm.foodStores[0]];
    store.slots.fill(null); store.slots[0] = mkStack(r, 'berries', 5);
    h.gx = -1000; h.gy = -1000; h.hunger = 0; h.thirst = 0;
    const before = JSON.stringify(store);
    expect(humanConsume(r, hw, h, 'food', T0)).toBe(false);
    expect(humanConsume(r, hw, h, 'water', T0)).toBe(false);
    expect(JSON.stringify(store)).toBe(before);
  });
  it('remote and wrong-floor harvest calls cannot damage source or mint output', () => {
    const { r, hw, h, pack } = scene();
    let target: { x: number; y: number } | undefined;
    for (let y = 3; y < WW - 3 && !target; y++) for (let x = 3; x < WW - 3; x++) if (sourceAt(r, x, y, T0)?.key === 'bush') { target = { x, y }; break; }
    expect(target).toBeDefined(); h.gx = -1000; h.gy = -1000;
    const before = JSON.stringify(r.sources), custody = JSON.stringify(pack);
    expect(humanHarvest(r, hw, h, target!.x, target!.y, T0).result).toBe('blocked');
    expect(JSON.stringify(r.sources)).toBe(before); expect(JSON.stringify(pack)).toBe(custody);
    const o = r.sourceMap!.veyra!.originAu;
    h.gx = Math.round(o[0] / 0.5) + target!.x; h.gy = Math.round(o[1] / 0.5) + target!.y; h.floor = 1;
    expect(humanHarvest(r, hw, h, target!.x, target!.y, T0).result).toBe('blocked');
    expect(JSON.stringify(r.sources)).toBe(before);
  });
  it('a generic shared custody chest does not erase sleep debt', () => {
    const { r, hw, h } = scene(); h.rest = 0.5; h.state = 'IDLE';
    tickNeeds(r, hw, T0 + HOUR);
    expect(h.rest).toBeGreaterThan(0.5);
  });
  it('awakening does not forge attack evidence, and early exit saves nobody speculatively', () => {
    const { r, hw } = scene();
    advanceElderPressure(r, hw, T0 + 313 * HOUR);
    for (const elder of Object.values(hw.elderPressure)) {
      expect(elder.awakenedAt).toBeDefined(); expect(elder.lastAttackAt).toBeUndefined();
    }
    const summary = finalizeHumanOutcomes(r, hw, T0 + HOUR);
    expect(summary.survived).toBe(0); expect(summary.unresolved).toBe(summary.total);
    expect(finalizeHumanOutcomes(r, hw, T0 + HOUR)).toEqual(summary);
  });
  it('a downed body takes subsequent lethal damage instead of becoming immortal', () => {
    const { r, hw, h } = scene(); h.floor = 0;
    applyDamage(r, hw, h, 10000, 0, T0, 'enemy', undefined, 0);
    expect(h.state).toBe('DOWNED');
    applyDamage(r, hw, h, 10000, 0, T0 + 1, 'enemy', undefined, 0);
    expect(h.state).toBe('DEAD'); expect(h.hp).toBe(0);
  });
  it('a chase is not a hit, and each creature attack contacts a human only once across reload', () => {
    const { gs, r, hw, h } = scene(), o = r.sourceMap!.veyra!.originAu;
    for (const other of Object.values(hw.people)) if (other !== h) other.state = 'DEAD';
    h.gx = Math.round(o[0] / 0.5) + Math.floor(r.player.x / TILE);
    h.gy = Math.round(o[1] / 0.5) + Math.floor(r.player.y / TILE); h.floor = 0;
    h.equip = { head: null, body: null, legs: null, feet: null, weapon: null };
    const m = mkCreature(r, 'wolf', r.player.x, r.player.y, 100); m.floor = 0; m.state = 'chase'; r.creatures = [m];
    const before = h.hp;
    stepHumanCombat(r, hw, T0 + 1000); expect(h.hp).toBe(before);
    m.state = 'attack'; m.atk = { humanVictims: [] };
    stepHumanCombat(r, hw, T0 + 2000); const after = h.hp; expect(after).toBeLessThan(before);
    stepHumanCombat(r, hw, T0 + 3000); expect(h.hp).toBe(after);
    const loaded = JSON.parse(JSON.stringify(gs));
    stepHumanCombat(loaded.run, loaded.run.humanWorld, T0 + 4000);
    expect(loaded.run.humanWorld.people[h.actorId].hp).toBe(after);
  });
  it('a hostile human physically closes distance along a legal lane', () => {
    const { r, hw, h } = scene(), grid = blockGrid(r), o = r.sourceMap!.veyra!.originAu;
    const ox = Math.round(o[0] / 0.5), oy = Math.round(o[1] / 0.5);
    for (const other of Object.values(hw.people)) if (other !== h) other.state = 'DEAD';
    r.creatures = [];
    let lane: [number, number] | undefined;
    for (let y = 5; y < WW - 5 && !lane; y++) for (let x = 5; x < WW - 10; x++) if (Array.from({ length: 8 }, (_, i) => grid[y * WW + x + i]).every(v => v === 0 || v === 4)) { lane = [x, y]; break; }
    expect(lane).toBeDefined();
    const [x, y] = lane!; h.gx = ox + x; h.gy = oy + y; h.floor = 0; h.state = 'FIGHTING'; h.nextThinkAt = 0;
    h.equip.weapon = mkStack(r, 'knife', 1);
    h.intent = { intentId: 'approach', actorId: h.actorId, kind: 'fight', target: 'player', startAt: T0, dueAt: T0, preconditions: [], reserved: [] };
    r.player.x = (x + 7.5) * TILE; r.player.y = (y + 0.5) * TILE;
    stepHumans(r, hw, T0 + 100); stepHumans(r, hw, T0 + 350);
    expect(h.gx).toBe(ox + x + 1); expect(h.dir).toBe(2); expect(h.intent?.kind).toBe('fight');
  });
});
