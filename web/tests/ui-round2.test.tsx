// Second UI round: small windows, touch controls, the map's bag marks, and two reworded readouts.
import { describe, expect, it } from 'vitest';
import { resolveHudScale, resolveTouchControls } from '../src/visual/direction';
import { placeHint } from '../src/ui/BuildBar';
import { upkeepRateLabel } from '../src/ui/HomeStatus';
import { isOwnBag } from '../src/ui/ExpeditionMap';

describe('HUD size in small windows', () => {
  it('leaves the HUD alone from 1088x612 upward (stage scale 1.7)', () => {
    for (const scale of [1.7, 2, 3, 4]) expect(resolveHudScale(scale, { hudScale: 'auto' })).toBe(1);
  });
  it('enlarges the HUD as the window shrinks, never past 1.5x', () => {
    expect(resolveHudScale(1.6, { hudScale: 'auto' })).toBe(1.05);    // 1024x768
    expect(resolveHudScale(1.25, { hudScale: 'auto' })).toBe(1.35);   // 800x600
    expect(resolveHudScale(1, { hudScale: 'auto' })).toBe(1.5);       // 640x360
    expect(resolveHudScale(0.5, { hudScale: 'auto' })).toBe(1.5);
  });
  it('stops at 1.25x when the touch buttons share the screen', () => {
    expect(resolveHudScale(1.08, { hudScale: 'auto' }, true)).toBe(1.25);
    expect(resolveHudScale(2, { hudScale: 'auto' }, true)).toBe(1);
  });
  it('a size the player picked always wins', () => {
    for (const pick of [1, 1.25, 1.5] as const) for (const scale of [0.5, 1, 2, 4]) expect(resolveHudScale(scale, { hudScale: pick }, true)).toBe(pick);
  });
  it('an unusable scale falls back to 1', () => {
    expect(resolveHudScale(0, { hudScale: 'auto' })).toBe(1);
    expect(resolveHudScale(Number.NaN, { hudScale: 'auto' })).toBe(1);
  });
});

describe('touch controls preference', () => {
  const phone = { coarseOnly: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', maxTouchPoints: 5 };
  const desk = { coarseOnly: false, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0 };
  it('auto follows the device', () => {
    expect(resolveTouchControls({ touchControls: 'auto' }, phone)).toBe(true);
    expect(resolveTouchControls({ touchControls: 'auto' }, desk)).toBe(false);
  });
  it('always and never override the device', () => {
    expect(resolveTouchControls({ touchControls: 'on' }, desk)).toBe(true);
    expect(resolveTouchControls({ touchControls: 'off' }, phone)).toBe(false);
  });
});

describe('build bar wording', () => {
  it('turns the bare "Too far away." into what to do about it', () => {
    expect(placeHint('Too far away.')).toBe('aim closer: you build within 4 tiles of yourself');
  });
  it('keeps every other reason, without the final full stop', () => {
    expect(placeHint('Needs a foundation.')).toBe('Needs a foundation');
    expect(placeHint('Blocked')).toBe('Blocked');
  });
});

describe('cabinet upkeep in words', () => {
  it('speaks in whole items, not in hundredths of an item', () => {
    expect(upkeepRateLabel(0.35, 'Wood')).toBe('1 Wood every 3 days');
    expect(upkeepRateLabel(0.5, 'Stone')).toBe('1 Stone every 2 days');
    expect(upkeepRateLabel(1, 'Wood')).toBe('1 Wood a day');
    expect(upkeepRateLabel(2.26, 'Wood')).toBe('2.3 Wood a day');
    expect(upkeepRateLabel(73.75, 'Stone')).toBe('74 Stone a day');
    expect(upkeepRateLabel(0, 'Rope')).toBe('no Rope');
  });
  it('between two round answers it names the dearer one', () => {
    expect(upkeepRateLabel(0.7, 'Wood')).toBe('1 Wood a day');          // not "every 2 days", which is 0.5 a day
    expect(upkeepRateLabel(0.45, 'Wood')).toBe('1 Wood every 2 days');  // not "every 3 days"
    expect(upkeepRateLabel(0.96, 'Wood')).toBe('1 Wood a day');
  });
});

describe('continent map bag marks', () => {
  it('marks the player\'s own bag only', () => {
    expect(isOwnBag({ kind: 'bag', label: 'Your bag' })).toBe(true);
    expect(isOwnBag({ kind: 'bag', label: 'Your bag', parcel: { purchaseId: 'p', item: 'x' } })).toBe(false);
    expect(isOwnBag({ kind: 'bag', owner: 'community_3', label: 'Store' })).toBe(false);   // survivor store
    expect(isOwnBag({ kind: 'bag' })).toBe(false);                                          // corpse or loot bag
    expect(isOwnBag({ kind: 'struct', label: 'Your bag' })).toBe(false);
  });
});
