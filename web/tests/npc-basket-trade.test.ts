/**
 * MULTI-ITEM BARTER — one committed transaction, or none at all.
 *
 * Law: a basket moves every line or refuses as a whole; the source is debited by exactly what
 * landed in the survivor's pack, and a failed line restores what was already moved (same slot,
 * same UID). No line is ever half-applied and nothing is minted.
 */
import { describe, expect, it } from 'vitest';
import { WW, type GameState } from '../src/game/core';
import { newGame, startRun, addItem, C } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { T0 } from './helpers/g1b-kit';
import { humanPack, tradeBasketWithHuman } from '../src/game/humanworld';

function runAt(ax = 921, ay = 259, seed = 7606): GameState {
  const [gtx, gty] = auToTile(ax, ay);
  const win = windowAround(gtx, gty);
  setActiveLayout(layoutIdAt(win.originTx, win.originTy));
  const gs = newGame();
  const lx = Math.max(8, Math.min(WW - 9, gtx - win.originTx));
  const ly = Math.max(8, Math.min(WW - 9, gty - win.originTy));
  expect(startRun(gs, 'female', T0, null, seed, { tx: lx, ty: ly }).ok).toBe(true);
  return gs;
}
const count = (cid: string, key: string, gs: GameState) => (C(gs.run!, cid).slots as any[]).reduce((n, s) => n + (s?.key === key ? s.qty : 0), 0);

describe('multi-item barter', () => {
  it('moves every line of a basket and debits the source by exactly what landed', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const h = Object.values(hw.people).find(x => x.state !== 'DEAD')!;
    addItem(r, 'inv', 'herb', 3); addItem(r, 'inv', 'bandage', 2);
    const herbBefore = count('inv', 'herb', gs), bandBefore = count('inv', 'bandage', gs);
    const packHerb = humanPack(r, h).slots.reduce((n, s) => n + (s?.key === 'herb' ? s.qty : 0), 0);
    const res = tradeBasketWithHuman(r, hw, h, 'inv', [{ key: 'herb', qty: 2 }, { key: 'bandage', qty: 1 }], T0 + 1000);
    expect(res.ok).toBe(true);
    expect(res.transferred).toEqual([{ key: 'herb', qty: 2 }, { key: 'bandage', qty: 1 }]);
    expect(count('inv', 'herb', gs)).toBe(herbBefore - 2);
    expect(count('inv', 'bandage', gs)).toBe(bandBefore - 1);
    expect(humanPack(r, h).slots.reduce((n, s) => n + (s?.key === 'herb' ? s.qty : 0), 0)).toBe(packHerb + 2);
    expect(r.receipts.some(x => x.kind === 'human.trade.basket')).toBe(true);
  });

  it('refuses the whole basket when one line cannot be met, moving nothing', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const h = Object.values(hw.people).find(x => x.state !== 'DEAD')!;
    addItem(r, 'inv', 'herb', 2);
    const before = JSON.stringify(C(r, 'inv').slots);
    const res = tradeBasketWithHuman(r, hw, h, 'inv', [{ key: 'herb', qty: 2 }, { key: 'crystal', qty: 5 }], T0 + 1000);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('crystal');
    expect(JSON.stringify(C(r, 'inv').slots)).toBe(before);          // nothing left the player
    expect(r.receipts.some(x => x.kind === 'human.trade.basket')).toBe(false);
  });
  it.each(['merge', 'empty slot'])('restores both packs and next UID after a %s then a capacity refusal', mode => {
    const r = runAt().run!, hw = r.humanWorld!, h = Object.values(hw.people)[0];
    const pack = humanPack(r, h), player = C(r, 'inv');
    pack.slots.fill(null); player.slots.fill(null);
    addItem(r, 'inv', 'herb', 3); addItem(r, 'inv', 'bandage', 2);
    // Only one destination is usable, by the first line. In merge mode it
    // already contains a compatible stack; the second line has no room.
    for (let i = 0; i < pack.slots.length; i++) pack.slots[i] = { uid: `fixture-${i}`, key: 'stone', qty: 1 };
    pack.slots[0] = mode === 'merge' ? { uid: 'receiver', key: 'herb', qty: 1 } : null;
    const state = () => JSON.stringify([player, pack, r.nextId, r.receipts]);
    const before = state();
    const deal = tradeBasketWithHuman(r, hw, h, 'inv', [{key:'herb',qty:1},{key:'bandage',qty:1}], T0+1000);
    expect(deal).toMatchObject({ok:false,reason:'no carrying capacity'});
    expect(state()).toBe(before);
  });

});
