// B05-R C3: causal feedback for a powered gate. Uses the existing Lighthouse door + generator (authored site, no new geometry).
import { describe, it, expect, afterEach } from 'vitest';
import { BAL, type GameState } from '../src/game/core';
import { addItem, C, countItem, dispatch, newGame } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { move_ } from './c3-helpers';

const T = Date.UTC(2026, 10, 7); let n = 0;
const act = (g: GameState, type: string, p: object = {}, at = T + 1) => dispatch(g, { id: `c3-${++n}`, type, ...p }, at);
function start() { setActiveLayout('shipping_fresh'); const g = newGame(); expect(dispatch(g, { id: 'start', type: 'startRun', character: 'female', seed: 113 } as any, T).ok).toBe(true); g.run!.creatures = []; return g; }
const site = (g: GameState, kind: 'door' | 'gen', poi: string) => Object.values(g.run!.entities).find(e => e.kind === kind && e.poi === poi)!;
afterEach(() => setActiveLayout('shipping'));

describe('C3 powered gate feedback: the reason names the exact missing state and the one action that fixes it', () => {
  it('empty generator: refused with the add-can reason; the locked door and the pack are unchanged', () => {
    const g = start(), r = g.run!, door = site(g, 'door', 'light');
    move_(g, door.x, door.y + 16);
    const before = countItem(r, 'inv', 'fuel_can');
    const res = act(g, 'door', { eid: door.id });
    expect(res.ok).toBe(false);
    expect((res as any).reason).toMatch(/generator is empty\. Add 1 physical Fuel Canister/);
    expect(door.open).toBeFalsy();
    expect(countItem(r, 'inv', 'fuel_can')).toBe(before);             // nothing consumed by a refused access
  });
  it('switched-off generator with banked time: the reason says resume with E, no can needed, and the resume works', () => {
    const g = start(), r = g.run!, door = site(g, 'door', 'light'), gen = site(g, 'gen', 'light');
    move_(g, gen.x, gen.y + 16); addItem(r, 'inv', 'fuel_can', 1);
    expect(act(g, 'generator', { eid: gen.id }, T + 1).ok).toBe(true);
    expect(act(g, 'generator', { eid: gen.id }, T + 1010).ok).toBe(true);     // switch off, time banked
    move_(g, door.x, door.y + 16);
    const res = act(g, 'door', { eid: door.id }, T + 1020);
    expect(res.ok).toBe(false);
    expect((res as any).reason).toMatch(/generator is OFF with \d+s banked\. Use E on the generator to resume; no can needed\./);
    move_(g, gen.x, gen.y + 16);                                              // back at the generator (reach is required)
    expect(act(g, 'generator', { eid: gen.id }, T + 1030).ok).toBe(true);    // resume without a can
    expect(gen.power).toBe(1);
  });
  it('depleted generator: the reason says it has run out, not that it is empty', () => {
    const g = start(), r = g.run!, door = site(g, 'door', 'light'), gen = site(g, 'gen', 'light');
    move_(g, gen.x, gen.y + 16); addItem(r, 'inv', 'fuel_can', 1);
    expect(act(g, 'generator', { eid: gen.id }, T + 1).ok).toBe(true);
    move_(g, door.x, door.y + 16);
    const res = act(g, 'door', { eid: door.id }, T + 1 + BAL.poiAccess.fuelRuntimeMs + 5000);
    expect(res.ok).toBe(false);
    expect((res as any).reason).toMatch(/has run out/);
  });
});
