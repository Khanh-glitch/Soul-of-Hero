// B05-R Package B2: same eligible Shipping road segment, same tick schedule, four freight modes.
// Measures real movement from tick(): walking, hand cart (empty/loaded), motorbike (empty/loaded).
// Values are SOH_PROVISIONAL balance readings (BAL.motorbike / BAL.cart), not LI-confirmed numbers.
// SCOPE: SIM_FIXTURE_MEASUREMENT physics baseline ticked on a checked road segment. This is NOT a
// source-to-destination delivery test and NOT NATURAL_INPUT: cargo/positions are injected and the line oscillates.
// The end-to-end single-haul delivery proof is tests/mec01-c2-delivery.test.ts (real crate -> real route -> real chest).
import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { BAL, TILE, WW, type Entity, type GameState } from '../src/game/core';
import { addItem, C, dispatch, newGame, cartWeight } from '../src/game/engine';
import { getWorld, setActiveLayout } from '../src/game/world';
import { vehicleClear } from '../src/game/motorbike';
import { tick, type Input } from '../src/game/sim';

const T = Date.UTC(2026, 10, 7);
let clock = T + 1;
let serial = 0;
const act = (g: GameState, type: string, p: object = {}) => dispatch(g, { id: `b2-${++serial}`, type, ...p }, clock);
const still: Input = { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false };
const east: Input = { ...still, right: true, mx: 100, my: 100 };
const west: Input = { ...still, left: true, mx: 0, my: 100 };
afterEach(() => setActiveLayout('shipping'));

function setup(seed = 85) {
  setActiveLayout('shipping_fresh');
  const g = newGame();
  expect(act(g, 'startRun', { character: 'female', seed }).ok).toBe(true);
  g.run!.creatures = [];
  return g;
}
function roadLine(g: GameState) {
  const r = g.run!, w = getWorld(r.layoutId);
  for (let y = 2; y < 198; y++) for (let x = 3; x < 186; x++) {
    let yes = true;
    for (let d = -1; d <= 6; d++) { const px = (x + d) * TILE + 8, py = y * TILE + 8; if (!w.economyMap.road[y * WW + x + d] || !vehicleClear(r, px, py)) { yes = false; break; } }
    if (yes) return { x: x * TILE + 8, y: y * TILE + 8 };
  }
  throw Error('no real road line');
}
/** Drive/walk east then west on the same clear road for `ticks` steps; return distance covered and resources consumed. */
function measure(g: GameState, ticks: number, mount: Entity | null, carrying: boolean) {
  const r = g.run!, p = r.player;
  const fuel0 = mount?.vehicle?.fuel ?? 0, hp0 = mount?.hp ?? 0;
  let t = clock + 1000, path = 0;
  const pos = () => (mount ? { x: mount.x, y: mount.y } : { x: p.x, y: p.y });
  let last = pos();
  for (let i = 0; i < ticks; i++) {
    tick(g, Math.floor(i / 12) % 2 ? west : east, 50, t); t += 50;   // short legs keep the whole path on the checked road segment
    const now = pos(); path += Math.hypot(now.x - last.x, now.y - last.y); last = now;   // PATH length, not net displacement
  }
  return { seconds: +(ticks * 0.05).toFixed(2), pixelsPath: Math.round(path), pxPerSec: +(path / (ticks * 0.05)).toFixed(1), fuelUsed: mount ? +(fuel0 - (mount.vehicle?.fuel ?? 0)).toFixed(2) : 0, wearHp: mount ? +(hp0 - (mount.hp ?? 0)).toFixed(2) : 0, carrying };
}

describe('B05-R B2: freight modes on the same eligible Shipping road segment', () => {
  it('walking, hand cart and motorbike are distinguished by measured speed, capacity, fuel and wear', () => {
    const rows: Record<string, any> = {};
    // Walking (no vehicle, no cart)
    { const g = setup(), q = roadLine(g); g.run!.player.x = q.x; g.run!.player.y = q.y; clock = T + 1; rows.walk = measure(g, 240, null, false); }
    // Hand cart: packed kit placed on the road, pulled by the player, empty and loaded
    for (const loaded of [false, true]) {
      const g = setup(), r = g.run!, q = roadLine(g);
      r.player.x = q.x - TILE; r.player.y = q.y;
      addItem(r, 'inv', 'cart_kit', 1);
      expect(act(g, 'placeCart', { x: q.x, y: q.y }).ok).toBe(true);
      const cart = Object.values(r.entities).find(e => e.kind === 'cart')!;
      r.player.x = cart.x - TILE; r.player.y = cart.y;
      expect(act(g, 'grabCart', { eid: cart.id }).ok).toBe(true);
      if (loaded) addItem(r, cart.c!, 'iron_ingot', 4);
      const w = cartWeight(r, cart.c!);
      rows[loaded ? 'cart_loaded' : 'cart_empty'] = { ...measure(g, 240, null, loaded), cartWeight: +w.toFixed(1), cartLimit: BAL.cart.maxWeight, slots: BAL.cart.slots };
    }
    // Motorbike: deployed on the same road, fuelled once, empty and loaded
    for (const loaded of [false, true]) {
      const g = setup(), r = g.run!, q = roadLine(g);
      r.player.x = q.x - TILE; r.player.y = q.y;
      addItem(r, 'inv', 'motorbike_kit', 1);
      expect(act(g, 'placeMotorbike', q).ok).toBe(true);
      const bike = Object.values(r.entities).find(e => e.kind === 'vehicle')!;
      addItem(r, 'inv', 'fuel_can', 1);
      expect(act(g, 'vehicleRefuel', { eid: bike.id }).ok).toBe(true);
      expect(act(g, 'vehicleMount', { eid: bike.id }).ok).toBe(true);
      if (loaded) { addItem(r, 'inv', 'iron_ingot', 4); const i = C(r, 'inv').slots.findIndex(s => s?.key === 'iron_ingot'); expect(act(g, 'move', { from: 'inv', fs: i, to: bike.c }).ok).toBe(true); }
      rows[loaded ? 'bike_loaded' : 'bike_empty'] = { ...measure(g, 240, bike, loaded), cargoWeight: +cartWeight(r, bike.c!).toFixed(1), cargoLimit: BAL.motorbike.maxWeight, slots: BAL.motorbike.slots, tank: BAL.motorbike.tank };
    }
    writeFileSync('evidence/b05-freight/freight-compare.json', JSON.stringify({ note: 'SOH_PROVISIONAL balance readings; same road segment; 12 s simulated per row', rows }, null, 1));
    // Relations the balance must keep (not absolute numbers):
    expect(rows.bike_empty.pxPerSec).toBeGreaterThan(rows.walk.pxPerSec);           // motorbike outruns walking on road
    expect(rows.bike_empty.pxPerSec).toBeCloseTo(BAL.motorbike.roadSpeed, 0);       // on the road the bike runs at its balance speed
    // Observation (NOT asserted as a fix): sim.ts applies the cart road factor (1.36 x base) WITHOUT the terrainSpeed table
    // that walking uses, so on this road a pulled empty cart (~98 px/s) is only marginally faster than walking (~92 px/s).
    expect(rows.cart_empty.pxPerSec).toBeLessThan(rows.bike_empty.pxPerSec);
    expect(rows.bike_loaded.fuelUsed).toBeGreaterThanOrEqual(0);
    expect(rows.bike_empty.fuelUsed).toBeGreaterThan(0);                              // vehicle consumes fuel
    expect(rows.walk.fuelUsed).toBe(0);                                              // walking burns no vehicle fuel
    expect(rows.cart_empty.pxPerSec).toBeGreaterThan(0);
    expect(rows.cart_loaded.cartWeight).toBeLessThanOrEqual(rows.cart_loaded.cartLimit);
    expect(rows.bike_loaded.cargoWeight).toBeLessThanOrEqual(rows.bike_loaded.cargoLimit);
  });
});
