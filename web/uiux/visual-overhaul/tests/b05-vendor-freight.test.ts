// B05-R freight: paid-once vendor parcel → collect or load into a cart in reach → real displacement → unload → usable.
// Fixture disclosed: profile secured cash is granted (securedCash = 20) so the purchase is affordable. Everything else is real state.
import { describe, it, expect, afterEach } from 'vitest';
import { TILE, type GameState, type Entity } from '../src/game/core';
import { addItem, C, dispatch, newGame, cartWeight, useItem } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { serializeSnapshot, validate } from '../src/game/persist';
import { tick, type Input } from '../src/game/sim';

const T = Date.UTC(2026, 10, 7);
let clock = T + 1; let serial = 0;
const act = (g: GameState, type: string, p: object = {}, id = `vf-${++serial}`) => { clock += 50; return dispatch(g, { id, type, ...p }, clock); };
const still: Input = { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false };
const east: Input = { ...still, right: true, mx: 100, my: 100 };
afterEach(() => setActiveLayout('shipping'));

function start(): GameState {
  setActiveLayout('shipping_fresh');
  const g = newGame();
  expect(dispatch(g, { id: 'start', type: 'startRun', character: 'female', seed: 131 }, T).ok).toBe(true);
  g.run!.creatures = [];
  g.profile.securedCash = 20; // disclosed fixture: affordability only
  return g;
}
const vendor = (g: GameState) => Object.values(g.run!.entities).find(e => e.kind === 'vendor')!;
const parcels = (g: GameState) => Object.values(g.run!.entities).filter(e => e.parcel);
function nearVendor(g: GameState) { const v = vendor(g), p = g.run!.player; p.x = v.x + 12; p.y = v.y + 26; }
const contents = (g: GameState, e: Entity) => C(g.run!, e.c!).slots.filter(Boolean);

describe('B05-R freight: vendor parcel', () => {
  it('pays once, debits stock once, and places one physical parcel with a real UID at the trader', () => {
    const g = start(); const r = g.run!; nearVendor(g);
    const before = { cash: g.profile.securedCash, stock: r.vendorStock.medkit };
    expect(act(g, 'buy', { eid: vendor(g).id, item: 'medkit', freight: true }, 'vf-1').ok).toBe(true);
    expect(g.profile.securedCash).toBe(before.cash - 4);
    expect(r.vendorStock.medkit).toBe(before.stock - 1);
    const [p] = parcels(g); expect(parcels(g)).toHaveLength(1);
    expect(p.parcel).toEqual({ purchaseId: 'vf-1', item: 'medkit' });
    expect(Math.hypot(p.x - vendor(g).x, p.y - vendor(g).y)).toBeLessThan(2.8 * TILE);  // beside the authorised trader
    expect(contents(g, p)).toHaveLength(1);
    expect(contents(g, p)[0]!.key).toBe('medkit');
    expect(contents(g, p)[0]!.uid).toBeTruthy();
    expect(r.custody.inv.slots.some(s => s?.key === 'medkit')).toBe(false); // nothing silently added to the pack
  });

  it('a replayed intent id or a second use of the same purchase id mints nothing and debits nothing', () => {
    const g = start(); const r = g.run!; nearVendor(g);
    expect(act(g, 'buy', { eid: vendor(g).id, item: 'medkit', freight: true }, 'vf-dup').ok).toBe(true);
    const cash = g.profile.securedCash, stock = r.vendorStock.medkit;
    const replay = act(g, 'buy', { eid: vendor(g).id, item: 'medkit', freight: true }, 'vf-dup');
    expect(replay.ok).toBe(false);
    expect(g.profile.securedCash).toBe(cash);
    expect(r.vendorStock.medkit).toBe(stock);
    expect(parcels(g)).toHaveLength(1);
  });

  it('insufficient secured cash and out-of-stock goods are refused with no parcel and no debit', () => {
    const g = start(); const r = g.run!; nearVendor(g);
    g.profile.securedCash = 1;
    const poor = act(g, 'buy', { eid: vendor(g).id, item: 'medkit', freight: true });
    expect(poor.ok).toBe(false);
    expect(g.profile.securedCash).toBe(1);
    expect(parcels(g)).toHaveLength(0);
    g.profile.securedCash = 20;
    const none = act(g, 'buy', { eid: vendor(g).id, item: 'wood', freight: true }); // not stocked by this trader
    expect(none.ok).toBe(false);
    expect(parcels(g)).toHaveLength(0);
    expect(r.custody.inv.slots.some(s => s?.key === 'medkit')).toBe(false);
  });

  it('a full pack cannot destroy a paid parcel: it stays on the ground with its item until there is room', () => {
    const g = start(); const r = g.run!; nearVendor(g);
    expect(act(g, 'buy', { eid: vendor(g).id, item: 'medkit', freight: true }, 'vf-full').ok).toBe(true);
    const [p] = parcels(g); const uid = contents(g, p)[0]!.uid;
    for (let i = 0; i < 40; i++) addItem(r, 'inv', 'stone', 999);      // fill the pack to the brim
    const take = act(g, 'move', { from: p.c, fs: 0, to: 'inv' });
    expect(take.ok).toBe(false);
    expect(contents(g, p)[0]!.uid).toBe(uid);                          // still paid, still there, same UID
  });

  it('save and reopen preserve the uncollected paid parcel; a crafted duplicate purchase id is rejected', () => {
    const g = start(); const r = g.run!; nearVendor(g);
    expect(act(g, 'buy', { eid: vendor(g).id, item: 'medkit', freight: true }, 'vf-save').ok).toBe(true);
    const [p] = parcels(g); const uid = contents(g, p)[0]!.uid;
    const saved = serializeSnapshot(g);
    const back = JSON.parse(JSON.parse(saved).payload);
    expect(validate(back)).toBeTruthy();
    const reloaded = Object.values(back.run.entities).filter((e: any) => e.parcel) as any[];
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].parcel).toEqual({ purchaseId: 'vf-save', item: 'medkit' });
    expect(back.run.custody[reloaded[0].c].slots.find(Boolean).uid).toBe(uid);
    // crafted save: a second parcel with the same purchase id must not validate (would mint goods)
    const forged = JSON.parse(JSON.stringify(back));
    const copy = { ...reloaded[0], id: reloaded[0].id + 'x', c: reloaded[0].c };
    forged.run.entities[copy.id] = copy;
    expect(validate(forged)).toBeNull();
  });

  it('paid parcel → loaded into a cart in reach → real displacement → unloaded → usable medkit', () => {
    const g = start(); const r = g.run!; nearVendor(g);
    expect(act(g, 'buy', { eid: vendor(g).id, item: 'medkit', freight: true }, 'vf-chain').ok).toBe(true);
    const [p] = parcels(g); const uid = contents(g, p)[0]!.uid;
    // a packed cart is deployed by the real placeCart action beside the trader (first open tile that the game accepts)
    addItem(r, 'inv', 'cart_kit', 1);
    let placed = false;
    for (const [dx, dy] of [[24, 0], [-24, 0], [0, 24], [0, -24], [28, 20], [-28, 20]]) {
      if (act(g, 'placeCart', { x: r.player.x + dx, y: r.player.y + dy }).ok) { placed = true; break; }
    }
    expect(placed).toBe(true);
    const cart = Object.values(r.entities).find(e => e.kind === 'cart')!;
    expect(Math.hypot(cart.x - r.player.x, cart.y - r.player.y)).toBeLessThan(3 * TILE);
    // negative: from out of reach, the parcel cannot be loaded
    const pp = r.player; const sx = pp.x, sy = pp.y; pp.x = p.x + 3 * TILE; pp.y = p.y + 3 * TILE;
    expect(act(g, 'move', { from: p.c, fs: 0, to: cart.c, ts: 0 }).ok).toBe(false);
    pp.x = sx; pp.y = sy;
    // load: parcel → cart container, same UID, parcel bag pruned
    expect(act(g, 'move', { from: p.c, fs: 0, to: cart.c, ts: 0 }).ok).toBe(true);
    expect(C(r, cart.c!).slots.find(Boolean)?.uid).toBe(uid);
    expect(cartWeight(r, cart.c!)).toBeGreaterThan(0);
    expect(parcels(g)).toHaveLength(0);
    // real displacement with the loaded cart
    const x0 = cart.x; r.player.x = cart.x - TILE; r.player.y = cart.y;
    expect(act(g, 'grabCart', { eid: cart.id }).ok).toBe(true);
    for (let i = 0; i < 40; i++) tick(g, { ...east, mx: 100, my: 100 }, 40, clock + 2000 + i * 40);
    clock += 4000;
    expect(Math.abs(cart.x - x0)).toBeGreaterThan(8);
    // unload at the cart, then use the item
    r.player.pulling = null; r.player.x = cart.x - TILE; r.player.y = cart.y;
    expect(act(g, 'move', { from: cart.c, fs: 0, to: 'inv' }).ok).toBe(true);
    const inv = r.custody.inv.slots.findIndex(s => s?.key === 'medkit');
    expect(inv).toBeGreaterThanOrEqual(0);
    expect(r.custody.inv.slots[inv]!.uid).toBe(uid);
    r.player.hp = 50;
    expect(act(g, 'useItem', { c: 'inv', slot: inv }).ok).toBe(true);
    expect(r.player.hp).toBeGreaterThan(50);
  });
});
