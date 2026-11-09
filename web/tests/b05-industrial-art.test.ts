// B05: pure state→sprite rules for the vehicle and refinery, plus the icon-distinctness regression.
import { describe, it, expect } from 'vitest';
import { vehicleView, vehicleStateKey, refineryStateKey } from '../src/game/industrial-art';
import { ITEMS } from '../src/game/catalog';

describe('B05 vehicle facing follows the real travel angle', () => {
  it('heading right / left uses the side sprite, left is mirrored', () => {
    expect(vehicleView(0)).toEqual({ view: 'side', mirror: false });
    expect(vehicleView(Math.PI)).toEqual({ view: 'side', mirror: true });
    expect(vehicleView(-0.2)).toEqual({ view: 'side', mirror: false });
  });
  it('heading down (screen +y) shows the head-on sprite; up shows the tail sprite', () => {
    expect(vehicleView(Math.PI / 2)).toEqual({ view: 'front', mirror: false });
    expect(vehicleView(-Math.PI / 2)).toEqual({ view: 'back', mirror: false });
  });
  it('diagonal headings resolve to the dominant axis, deterministically', () => {
    expect(vehicleView(Math.PI / 4).view).toBe('side');        // equal |cos|=|sin| → side
    expect(vehicleView(Math.PI / 3).view).toBe('front');       // steeper than 45° toward +y
  });
});

describe('B05 vehicle state is derived from real fuel and HP', () => {
  it('running needs fuel and HP; empty tank or broken frame shows the dead sprite', () => {
    expect(vehicleStateKey(120, 150)).toBe('ok');
    expect(vehicleStateKey(0, 150)).toBe('dead');
    expect(vehicleStateKey(120, 0)).toBe('dead');
  });
});

describe('B05 refinery sprite shows lit only while burning for a queued job', () => {
  it('lit requires both fuel burn and a queued job', () => {
    expect(refineryStateKey(10, 1)).toBe('lit');
    expect(refineryStateKey(0, 1)).toBe('idle');    // queued but unfuelled
    expect(refineryStateKey(10, 0)).toBe('idle');   // fuelled but nothing to process
    expect(refineryStateKey(undefined, 0)).toBe('idle');
  });
});

describe('B05 industrial item icons are distinct', () => {
  it('machine lubricant no longer shares the oil/canister can icon', () => {
    expect(ITEMS.lubricant.icon).toBe('jug');
    expect(ITEMS.salvaged_oil.icon).toBe('can');
    expect(ITEMS.fuel_can.icon).toBe('can');
    expect(ITEMS.lubricant.icon).not.toBe(ITEMS.fuel_can.icon);
  });
});
