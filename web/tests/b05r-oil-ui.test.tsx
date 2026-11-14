// B05-R UI defects: (1) Oil Pump is discoverable in the Work build group and locked without an authorized source;
// (2) the source-stock line lives in the returned JSX and changes from positive to dry on screen.
// CONTROLLED FIXTURE: the test-fixture-v1 source is registered in-memory for these assertions only.
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BAL, TILE, type GameState } from '../src/game/core';
import { dispatch, newGame, registerTestOilSource, mkContainer } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { BuildPanel, BUILD_GROUPS, buildLocked, StationBody } from '../src/ui/panels';
import { BUILD_ORDER } from '../src/game/catalog';

const T = Date.UTC(2026, 10, 7);
function setup(): GameState {
  setActiveLayout('shipping_fresh');
  const g = newGame();
  expect(dispatch(g, { id: 'ui-start', type: 'startRun', character: 'female', seed: 91 } as any, T).ok).toBe(true);
  return g;
}
afterEach(() => setActiveLayout('shipping'));
// Node has no DOM. Icons draw to a canvas; a no-op canvas is enough to render markup (pixels are not asserted here).
const noopCtx: any = new Proxy({}, { get: (t: any, k) => (k in t ? t[k] : (k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => noopCtx)), set: () => true });
(globalThis as any).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => noopCtx, toDataURL: () => 'data:image/png;base64,' }) };
const api = (g: GameState): any => ({ gs: g, now: () => T, act: () => ({ ok: true }), toast: () => {}, open: () => {}, setBuild: () => {}, setReclaim: () => {}, setRepairMode: () => {}, setUpgradeMode: () => {} });

describe('B05-R P0 defect 1: Oil Pump is in the build menu and is locked without an authorized source', () => {
  it('the Work group and BUILD_ORDER both list oil_pump, so the Find box and the Work tab reach it', () => {
    expect(BUILD_ORDER).toContain('oil_pump');
    expect(BUILD_GROUPS.Work).toContain('oil_pump');
  });
  it('is locked with no authorized source, and unlocked once a test-fixture source has stock', () => {
    const g = setup();
    expect(buildLocked(g.run!, 'oil_pump')).toBe(true);
    registerTestOilSource(g.run!, 10, 10, 3);
    expect(buildLocked(g.run!, 'oil_pump')).toBe(false);
    g.run!.oilSources!['oil:10:10'].stock = 0;                 // a dry source does not unlock placement
    expect(buildLocked(g.run!, 'oil_pump')).toBe(true);
  });
  it('never locks other structures', () => {
    const g = setup();
    expect(buildLocked(g.run!, 'furnace')).toBe(false);
  });
});

describe('B05-R P0 defect 2: source-stock line is rendered (not discarded) and changes positive → dry', () => {
  function pumpAt(g: GameState, stock: number) {
    const r = g.run!, tx = 12, ty = 12;
    registerTestOilSource(r, tx, ty, stock);
    const id = 'ui-pump';
    r.entities[id] = { id, kind: 'struct', type: 'oil_pump', x: tx * TILE + 8, y: ty * TILE + 8, tx, ty, hp: BAL.oilPumpV1.hp, maxHp: BAL.oilPumpV1.hp,
      station: { queue: [], burn: 0, fuelC: mkContainer(r, 'fuel', 3).id, outC: mkContainer(r, 'out', 6).id } } as any;
    return id;
  }
  it('renders the stock line with the live stock value', () => {
    const g = setup(); const id = pumpAt(g, 4);
    const html = renderToStaticMarkup(React.createElement(StationBody, { api: api(g), eid: id }));
    expect(html).toContain('data-testid="oil-source-stock"');
    expect(html).toContain('4 Crude Petroleum left');
    expect(html).not.toContain('dry');
  });
  it('changes on screen to the dry state when the source stock reaches zero', () => {
    const g = setup(); const id = pumpAt(g, 1);
    const before = renderToStaticMarkup(React.createElement(StationBody, { api: api(g), eid: id }));
    expect(before).toContain('1 Crude Petroleum left');
    g.run!.oilSources!['oil:12:12'].stock = 0;
    const after = renderToStaticMarkup(React.createElement(StationBody, { api: api(g), eid: id }));
    expect(after).toContain('0 Crude Petroleum left — dry, cycles blocked');
    expect(after).not.toContain('1 Crude Petroleum left');
  });
  it('a pump with no authorized source says so instead of drawing a blank', () => {
    const g = setup(); const id = pumpAt(g, 2);
    delete g.run!.oilSources!['oil:12:12'];
    const html = renderToStaticMarkup(React.createElement(StationBody, { api: api(g), eid: id }));
    expect(html).toContain('No oil site exists in this world yet');
  });
});
