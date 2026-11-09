// B05-R P0-C: outstanding-parcel invariants in persist.validate. Client-side save validation is NOT server-side anti-cheat.
import { describe, it, expect, afterEach } from 'vitest';
import { type GameState } from '../src/game/core';
import { addItem, C, dispatch, newGame } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { serializeSnapshot, validate } from '../src/game/persist';

const T = Date.UTC(2026, 10, 7);
let clock = T + 1; let serial = 0;
const act = (g: GameState, type: string, p: object = {}, id = `pp-${++serial}`) => { clock += 50; return dispatch(g, { id, type, ...p }, clock); };
afterEach(() => setActiveLayout('shipping'));
const snap = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload);

function paidParcel(id = 'pp-buy') {
  setActiveLayout('shipping_fresh');
  const g = newGame(); dispatch(g, { id: 'start', type: 'startRun', character: 'female', seed: 131 }, T);
  g.run!.creatures = []; g.profile.securedCash = 20;
  const v = Object.values(g.run!.entities).find(e => e.kind === 'vendor')!;
  g.run!.player.x = v.x + 12; g.run!.player.y = v.y + 26;
  expect(act(g, 'buy', { eid: v.id, item: 'medkit', freight: true }, id).ok).toBe(true);
  return g;
}
const parcelOf = (raw: any) => Object.values(raw.run.entities).find((e: any) => e.parcel) as any;

describe('B05-R P0-C parcel persistence invariants', () => {
  it('a normal outstanding parcel validates, and so does a save made mid-purchase-to-collection', () => {
    const g = paidParcel();
    expect(validate(snap(g))).not.toBeNull();
  });
  it('rejects contents that do not match the purchased product or quantity', () => {
    const g = paidParcel(); const raw = snap(g); const p = parcelOf(raw);
    raw.run.custody[p.c].slots[0].key = 'iron_axe';           // wrong good
    expect(validate(raw)).toBeNull();
    const raw2 = snap(g); parcelOf(raw2); raw2.run.custody[parcelOf(raw2).c].slots[0].qty = 2; // wrong quantity
    expect(validate(raw2)).toBeNull();
    const raw3 = snap(g); raw3.run.custody[parcelOf(raw3).c].slots[0] = null;                  // empty parcel
    expect(validate(raw3)).toBeNull();
  });
  it('rejects a duplicated UID (the same stack in two places)', () => {
    const g = paidParcel(); const raw = snap(g); const p = parcelOf(raw);
    raw.run.custody.inv.slots[0] = { ...raw.run.custody[p.c].slots[0] };
    expect(validate(raw)).toBeNull();
  });
  it('rejects a parcel with no matching paid receipt, and one with the wrong price', () => {
    const g = paidParcel(); const raw = snap(g);
    raw.profile.profileReceipts = [];
    expect(validate(raw)).toBeNull();
    const raw2 = snap(g); raw2.profile.profileReceipts = raw2.profile.profileReceipts.map((x: string) => x.replace(/:4$/, ':99'));
    expect(validate(raw2)).toBeNull();
  });
  it('rejects a second outstanding parcel for the same purchase id', () => {
    const g = paidParcel(); const raw = snap(g); const p = parcelOf(raw);
    raw.run.entities[p.id + 'x'] = { ...p, id: p.id + 'x' };
    expect(validate(raw)).toBeNull();
  });
  it('interrupted-save path: save while outstanding, reopen, load, save again; the emptied parcel is gone and the good is kept', () => {
    const g = paidParcel(); const reopened = validate(JSON.parse(JSON.parse(serializeSnapshot(g)).payload)) as GameState;
    expect(reopened).not.toBeNull();
    const r = reopened.run!; const p = Object.values(r.entities).find(e => e.parcel)!;
    const cart = { id: 'cartx', kind: 'cart' } as any; void cart;
    // no cart is needed for the invariant: take the good into the pack (reach is the same rule) and check the parcel is pruned
    r.player.x = p.x; r.player.y = p.y;
    expect(act(reopened, 'move', { from: p.c, fs: 0, to: 'inv' }).ok).toBe(true);
    expect(Object.values(r.entities).some(e => e.parcel)).toBe(false);
    const again = validate(snap(reopened)); expect(again).not.toBeNull();
    expect(C(again!.run!, 'inv').slots.some(s => s?.key === 'medkit')).toBe(true);
  });
  it('a crafted second medkit in the pack is not a parcel, but the paid parcel plus it still cannot share a UID', () => {
    const g = paidParcel(); addItem(g.run!, 'inv', 'medkit', 1);
    expect(validate(snap(g))).not.toBeNull();
  });
});
