/**
 * MULTI-ITEM BARTER — one committed transaction, or none at all.
 *
 * Law: a basket moves every line or refuses as a whole; the source is debited by exactly what
 * landed in the survivor's pack, and a failed line restores what was already moved (same slot,
 * same UID). No line is ever half-applied and nothing is minted.
 */
import { describe, expect, it } from 'vitest';
import { serializeSnapshot, validate } from '../src/game/persist';
import { WW, TILE, type GameState } from '../src/game/core';
import { newGame, startRun, addItem, C, dispatch } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { T0 } from './helpers/g1b-kit';
import { tickNeeds, humanPack, tradeBasketWithHuman, counterHumanBarter, quoteHumanBarter } from '../src/game/humanworld';

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

/** Engineering fixture: two real packs at the same reachable tile. Not a natural encounter. */
it('dispatch exchanges the exact selected quantities, refusing stale UIDs, unaffordable asks and unreachable partners',()=>{
 const gs=runAt(),r=gs.run!,hw=r.humanWorld!,[ax,ay]=r.sourceMap!.veyra!.originAu;
 const h=Object.values(hw.people).find(h=>h.floor===0&&h.gx>=ax*2&&h.gx<ax*2+WW&&h.gy>=ay*2&&h.gy<ay*2+WW)!;
 const x=(h.gx-ax*2+.5)*TILE,y=(h.gy-ay*2+.5)*TILE;
 const player=C(r,'inv'),pack=humanPack(r,h);player.slots.fill(null);pack.slots.fill(null);
 addItem(r,'inv','wood',10);addItem(r,'inv','stone',2);addItem(r,pack.id,'berries',4);
 const line=(s:NonNullable<typeof player.slots[number]>,qty:number)=>({uid:s.uid,qty});
 const snapshot=()=>JSON.stringify([player,pack,r.nextId,r.receipts.filter(e=>e.kind==='human.exchange'),h.trust]);
 const wood=player.slots[0]!,stone=player.slots[1]!,berries=pack.slots[0]!;
 const offer=[line(wood,8),line(stone,2)],ask=[line(berries,1)];const before=snapshot();
 expect(quoteHumanBarter(r,h,[line(wood,1)],[line(berries,4)]).reason).toContain('Counter-offer');
 expect(quoteHumanBarter(r,h,[...offer,offer[0]],ask).ok).toBe(false);
 expect(quoteHumanBarter(r,h,[line(wood,.5)],ask).ok).toBe(false);
 expect(quoteHumanBarter(r,h,offer,ask).ok).toBe(true);expect(snapshot()).toBe(before);
 const counter=counterHumanBarter(r,h,[line(wood,1)],[line(berries,4)]);expect(counter).not.toBeNull();
 expect(quoteHumanBarter(r,h,counter!.offer,counter!.ask).ok).toBe(true);expect(snapshot()).toBe(before);
 h.hunger=60;const first=quoteHumanBarter(r,h,offer,ask),revision=first.revision;expect(revision).toBeDefined();
 tickNeeds(r,hw,T0+500);const later=quoteHumanBarter(r,h,offer,ask);
 expect(later.requestedValue).not.toBe(first.requestedValue);expect(later.revision).toBe(revision);
 // An actual change in the visible price still needs a fresh review.
 const actual=h.hunger;h.hunger-=2;expect(quoteHumanBarter(r,h,offer,ask).revision).not.toBe(revision);h.hunger=actual;
 const intent={type:'humanExchange',actorId:h.actorId,offer,ask,revision};
 r.player.x=x+160;r.player.y=y;expect(dispatch(gs,{...intent,id:'far'},T0+1000).ok).toBe(false);
 r.player.x=x;expect(dispatch(gs,{...intent,id:'stale',ask:[{uid:'gone',qty:1}]},T0+1001).ok).toBe(false);
 expect(snapshot()).toBe(before);
 berries.meta='changed after quote';expect(dispatch(gs,{...intent,id:'changed'},T0+1002)).toMatchObject({ok:false,reason:expect.stringContaining('terms changed')});delete berries.meta;
 expect(dispatch(gs,{...intent,id:'barter'},T0+1002)).toMatchObject({ok:true});
 expect(player.slots.find(s=>s?.uid===wood.uid)?.qty).toBe(2);expect(pack.slots.find(s=>s?.uid===berries.uid)?.qty).toBe(3);
 expect(pack.slots.find(s=>s?.uid===stone.uid)?.qty).toBe(2);expect(pack.slots.find(s=>s?.key==='wood')).toMatchObject({qty:8});
 expect(player.slots.find(s=>s?.key==='berries')).toMatchObject({qty:1});
 const ids=[...player.slots,...pack.slots].flatMap(s=>s?[s.uid]:[]);expect(new Set(ids).size).toBe(ids.length);
 const event=r.receipts.filter(e=>e.kind==='human.exchange');expect(event).toHaveLength(1);
 const transfer=JSON.parse(event[0].detail);expect(transfer.lines).toEqual(expect.arrayContaining([
   {from:player.id,parent:wood.uid,portion:pack.slots.find(s=>s?.key==='wood')!.uid,to:pack.id,uid:pack.slots.find(s=>s?.key==='wood')!.uid,qty:8},
   {from:player.id,parent:stone.uid,portion:stone.uid,to:pack.id,uid:stone.uid,qty:2},
 ]));
 const after=snapshot();expect(dispatch(gs,{...intent,id:'barter'},T0+1003)).toMatchObject({ok:false,dup:true});expect(snapshot()).toBe(after);expect(dispatch(gs,{...intent,id:'stale-repeat'},T0+1003).ok).toBe(false);expect(snapshot()).toBe(after);
 const loaded=validate(JSON.parse(JSON.parse(serializeSnapshot(gs)).payload));expect(loaded).toBeTruthy();
 expect(dispatch(loaded!,{...intent,id:'barter'},T0+1004)).toMatchObject({ok:false,dup:true});
 expect(loaded!.run!.custody[pack.id].slots).toEqual(pack.slots);expect(loaded!.run!.custody.inv.slots).toEqual(player.slots);

});
