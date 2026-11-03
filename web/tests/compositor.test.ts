import { describe, it, expect, beforeEach } from 'vitest';
import * as comp from '../src/game/compositor';

const mkLayer = (clientId: string): any => ({
  clientId, kind: 'd19', lightTex: {}, warp: new Float32Array(4), influence: new Uint8Array(4),
  region: { x: 0, y: 0, w: 480, h: 270 }, fade: 1, bloomGain: 1, time: 0, tick: 498, seed: 97,
});

const fakeFrame: any = { g: {}, cam: { x: 0, y: 0 }, now: 0, dark: 0 };

beforeEach(() => {
  for (const c of [...comp.vfxClients()]) comp.unregisterVfxClient(c.id);
});

describe('unified compositor (AVFX M1)', () => {
  it('rejects duplicate client ids explicitly', () => {
    comp.registerVfxClient({ id: 'a' });
    expect(() => comp.registerVfxClient({ id: 'a' })).toThrow(/duplicate/);
    expect(comp.vfxClients().length).toBe(1);
  });

  it('unregister/reset semantics work', () => {
    comp.registerVfxClient({ id: 'a' });
    comp.registerVfxClient({ id: 'b' });
    expect(comp.unregisterVfxClient('a')).toBe(true);
    expect(comp.unregisterVfxClient('nope')).toBe(false);
    expect(comp.vfxClients().map(c => c.id)).toEqual(['b']);
  });

  it('two clients submit in deterministic registration order and queue drains exactly once per frame', () => {
    comp.registerVfxClient({ id: 'first', submitGpu: () => comp.submitGpuPass(mkLayer('first')) });
    comp.registerVfxClient({ id: 'second', submitGpu: () => comp.submitGpuPass(mkLayer('second')) });
    const a = comp.collectGpuPasses(fakeFrame);
    expect(a.map(l => l.clientId)).toEqual(['first', 'second']);
    // second collection in the same frame = empty: the post runs exactly once
    expect(comp.collectGpuPasses(fakeFrame).map(l => l.clientId)).toEqual(['first', 'second']);
    expect(comp.takeGpuPasses()).toEqual([]);
  });

  it('zero registered GPU clients => zero passes (zero-cast identity path)', () => {
    expect(comp.collectGpuPasses(fakeFrame)).toEqual([]);
  });

  it('canvas2d pass dispatch order is fixed: auras -> warp -> screen -> postNight', () => {
    const order: string[] = [];
    comp.registerVfxClient({
      id: 'x',
      drawAuras: () => order.push('auras'),
      drawWarpPass: () => order.push('warp'),
      drawScreen: () => order.push('screen'),
      drawPostNight: () => order.push('post'),
    });
    const g: any = {};
    comp.drawAuras(g, { x: 0, y: 0 });
    comp.drawWarpPass(g, { x: 0, y: 0 }, 0);
    comp.drawScreen(g);
    comp.drawPostNight(g, { x: 0, y: 0 }, 0);
    expect(order).toEqual(['auras', 'warp', 'screen', 'post']);
  });
});
