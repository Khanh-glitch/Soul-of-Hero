// B05-R freight UI: ParcelPanel shows only reachable carts and reports unavailable/obstructed/full states. Static markup of the real component.
// Static markup only: Icon -> art.mk needs a canvas. A no-op canvas stub (no drawing is asserted here).
const noop: any = new Proxy(function () {}, { get: (_t, k) => (k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : noop), apply: () => noop, set: () => true });
if (typeof (globalThis as any).document === 'undefined') (globalThis as any).document = { createElement: () => ({ getContext: () => noop, toDataURL: () => 'data:,', width: 0, height: 0 }) };
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TILE, type GameState } from '../src/game/core';
import { addItem, dispatch, mkContainer, newGame } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { ParcelPanel } from '../src/ui/panels';

const T = Date.UTC(2026, 10, 7);
afterEach(() => setActiveLayout('shipping'));

function setup() {
  setActiveLayout('shipping_fresh');
  const g = newGame(); dispatch(g, { id: 'start', type: 'startRun', character: 'female', seed: 131 }, T);
  const r = g.run!; r.creatures = []; g.profile.securedCash = 20;
  const v = Object.values(r.entities).find(e => e.kind === 'vendor')!;
  r.player.x = v.x + 12; r.player.y = v.y + 26;
  dispatch(g, { id: 'pp-ui', type: 'buy', eid: v.id, item: 'medkit', freight: true }, T + 100);
  const parcel = Object.values(r.entities).find(e => e.parcel)!;
  return { g, r, parcel };
}
const api = (g: GameState) => ({ gs: g, act: () => ({ ok: true }), open: () => {}, now: () => T, sfx: () => {} } as any);
const html = (g: GameState, id: string) => renderToStaticMarkup(<ParcelPanel api={api(g)} eid={id} />);

describe('ParcelPanel (B05-R freight UI)', () => {
  it('shows the paid good and the purchase identity, with no cart option when no cart is in reach', () => {
    const { g, parcel } = setup();
    const h = html(g, parcel.id);
    expect(h).toContain('Paid parcel');
    expect(h).toContain('Field Medkit');
    expect(h).toContain('No deployed cart in reach');
    expect(h).not.toContain('Load into this cart');
  });
  it('offers "Load into this cart" for a deployed cart the player can reach, enabled, with slot and weight', () => {
    const { g, r, parcel } = setup();
    const cart = { id: 'cartui', kind: 'cart', x: r.player.x + 10, y: r.player.y, c: mkContainer(r, 'cart', 4).id, hp: 200, maxHp: 200 } as any;
    r.entities[cart.id] = cart;
    const h = html(g, parcel.id);
    expect(h).toContain('Load into this cart');
    expect(h).toContain('slots');
    expect(h).toContain('weight');
    expect(h).not.toContain('disabled=""');
  });
  it('a full cart reports "Cart full" and disables the load (paid goods stay in the parcel)', () => {
    const { g, r, parcel } = setup();
    const c = mkContainer(r, 'cart', 1); addItem(r, c.id, 'stone', 999);
    const cart = { id: 'cartfull', kind: 'cart', x: r.player.x + 10, y: r.player.y, c: c.id, hp: 200, maxHp: 200 } as any;
    r.entities[cart.id] = cart;
    const h = html(g, parcel.id);
    expect(h).toContain('Cart full');
    expect(h).toMatch(/disabled=""[^>]*>Load into this cart/);
  });
  it('a cart beyond 2.8 tiles is not offered (no remote teleport)', () => {
    const { g, r, parcel } = setup();
    const cart = { id: 'cartfar', kind: 'cart', x: r.player.x + 6 * TILE, y: r.player.y, c: mkContainer(r, 'cart', 4).id, hp: 200, maxHp: 200 } as any;
    r.entities[cart.id] = cart;
    const h = html(g, parcel.id);
    expect(h).not.toContain('Load into this cart');
    expect(h).toContain('No deployed cart in reach');
  });
});
