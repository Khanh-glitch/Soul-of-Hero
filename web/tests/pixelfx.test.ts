// Tests for the PixelFX adapter + event mappings (presentation-only layer).
import { describe, it, expect, beforeAll } from 'vitest';
import * as pfx from '../src/game/pixelfx';
import { pfxFromSimEvent } from '../src/game/pixelfxMap';

beforeAll(async () => { await pfx.initPfx(); });

describe('pixelfx adapter', () => {
  it('loads the embedded pilot manifest (Core-mapped ids present)', () => {
    const cat = pfx.catalog();
    for (const id of ['fire/fireball', 'nature/quake', 'lightning/chain-lightning', 'ice/frost-nova',
      'ice/ice-lance', 'arcane/arcane-orb', 'shadow/black-hole', 'explosions/small-explosion', 'arcane/spell-charge']) {
      expect(cat.some(c => c.id === id), id).toBe(true);
    }
    expect(pfx.hasEntry('shadow/black-hole')).toBe(true);
    expect(pfx.hasEntry('does/not-exist')).toBe(false);
  });

  it('frameOf loops looping effects and clamps one-shots', () => {
    const e = pfx.catalog(); void e;
    const entry = (pfx as any).manifest?.get?.('arcane/spell-charge');
    // use public behavior via spawn instead: looping charge survives past dur, one-shot expires
    pfx.clear();
    const a = pfx.spawn('arcane/spell-charge', { x: 0, y: 0, loop: true, family: 'hover' })!;
    const b = pfx.spawn('fire/fireball', { x: 0, y: 0, loop: false, family: 'proj' })!;
    expect(a).toBeTruthy(); expect(b).toBeTruthy();
    pfx.update(5000, 5000); // 5s >> both durations
    const ids = pfx.listInstances().map(i => i.id + (i.loop ? ':loop' : ''));
    expect(ids).toContain('arcane/spell-charge:loop');
    expect(ids.some(x => x.startsWith('fire/fireball'))).toBe(false);
  });

  it('respects delayMs (telegraph) and maxAgeMs', () => {
    pfx.clear();
    pfx.spawn('nature/quake', { x: 10, y: 10, delayMs: 500, family: 'ground' });
    pfx.update(100, 100);
    expect(pfx.listInstances().length).toBe(1);
    expect(pfx.listInstances()[0].t).toBeLessThan(0); // still winding up
    pfx.update(600, 700);
    expect(pfx.listInstances()[0].t).toBeGreaterThanOrEqual(0);
    pfx.clear();
    pfx.update(0, 100); // set adapter clock
    pfx.spawn('arcane/spell-charge', { x: 0, y: 0, loop: true, maxAgeMs: 300, family: 'hover' });
    pfx.update(400, 500);
    expect(pfx.listInstances().length).toBe(0);
  });

  it('caps instances and prefers evicting non-looping ones', () => {
    pfx.clear();
    for (let i = 0; i < 60; i++) pfx.spawn('arcane/spell-charge', { x: 0, y: 0, loop: i === 0, family: 'hover' });
    expect(pfx.listInstances().length).toBeLessThanOrEqual(48);
    expect(pfx.listInstances().some(i => i.loop)).toBe(true);
  });

  it('black hole is flagged warp from its presentation profile', () => {
    pfx.clear();
    const bh = pfx.spawn('shadow/black-hole', { x: 50, y: 50, family: 'ground' })!;
    expect(bh.warp).toBe(true);
    pfx.clear();
  });
});

describe('gameplay event -> FX mappings (visual only)', () => {
  it('maps boom to a grounded small explosion at the event point', () => {
    pfx.clear();
    expect(pfxFromSimEvent({ type: 'boom', x: 123, y: 45 })).toBe(true);
    const inst = pfx.listInstances()[0];
    expect(inst.id).toBe('explosions/small-explosion');
    expect(inst.x).toBe(123); expect(inst.y).toBe(45); expect(inst.family).toBe('ground');
  });
  it('maps storm bolt segments to a rotated, stretched chain lightning', () => {
    pfx.clear();
    expect(pfxFromSimEvent({ type: 'bolt', x0: 0, y0: 0, x1: 90, y1: 0 })).toBe(true);
    const inst = pfx.listInstances()[0];
    expect(inst.id).toBe('lightning/chain-lightning');
    expect(inst.angle).toBeCloseTo(0); expect(inst.stretch).toBeGreaterThan(0.3);
  });
  it('maps Core windup to a bounded charge glow (maxAge, hover)', () => {
    pfx.clear();
    pfxFromSimEvent({ type: 'windup', x: 5, y: 6, core: 'fire' });
    const inst = pfx.listInstances()[0];
    expect(inst.id).toBe('arcane/spell-charge');
    expect(inst.family).toBe('hover'); expect(inst.maxAgeMs).toBe(560);
  });
  it('does not mutate the event object (presentation-only contract)', () => {
    pfx.clear();
    const ev = { type: 'boom', x: 1, y: 2, small: true };
    const snapshot = JSON.stringify(ev);
    pfxFromSimEvent(ev);
    expect(JSON.stringify(ev)).toBe(snapshot);
  });
  it('ignores unknown event types', () => {
    pfx.clear();
    expect(pfxFromSimEvent({ type: 'toast', text: 'x' })).toBe(false);
    expect(pfx.listInstances().length).toBe(0);
  });
});
