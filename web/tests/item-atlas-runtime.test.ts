import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Browser API fixtures exercise load lifecycle, not just atlas metadata. */
describe('atlas load lifecycle and lazy encoding', () => {
  let images: FakeImage[], canvases: { toDataURL: ReturnType<typeof vi.fn> }[];
  let failAt: number;
  class FakeImage {
    naturalWidth = 0; naturalHeight = 0; src = '';
    onload: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor() { images.push(this); }
  }
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers(); images = []; canvases = []; failAt = -1;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('document', { createElement: vi.fn(() => {
      const n = canvases.length;
      const c = { width: 0, height: 0, getContext: () => n === failAt ? null : { drawImage: vi.fn(), imageSmoothingEnabled: true }, toDataURL: vi.fn(() => `data:image/png;cell-${n}`) };
      canvases.push(c); return c;
    }) });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const loadImage = (img: FakeImage, atlas: { width: number; height: number }) => { img.naturalWidth = atlas.width; img.naturalHeight = atlas.height; img.onload?.(); };

  it('shares one in-flight request and settles every caller', async () => {
    const a = await import('../src/game/item-atlas');
    const first = a.loadItemAtlas(), second = a.loadItemAtlas();
    expect(images).toHaveLength(1);
    loadImage(images[0], a.ITEM_ATLAS);
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(vi.getTimerCount()).toBe(0);
    expect(canvases).toHaveLength(157);
    expect(canvases.every(c => c.toDataURL.mock.calls.length === 0)).toBe(true);
    expect(a.atlasIconUrl('wood')).toBe(a.atlasIconUrl('wood'));
    expect(canvases.reduce((s, c) => s + c.toDataURL.mock.calls.length, 0)).toBe(1);
    expect(a.atlasIconCell('unknown')).toBeNull();
    expect(a.atlasIconUrl('toString')).toBe('');
    expect(a.atlasIconCell('__proto__')).toBeNull();
  });

  it('ignores late completion after timeout, including while retry is loading', async () => {
    const a = await import('../src/game/item-atlas');
    const first = a.loadItemAtlas(10), oldOnload = images[0].onload!;
    await vi.advanceTimersByTimeAsync(10); expect(await first).toBe(false);
    expect(a.itemAtlasState()).toBe('failed');
    const retry = a.loadItemAtlas(50);
    images[0].naturalWidth = a.ITEM_ATLAS.width; images[0].naturalHeight = a.ITEM_ATLAS.height;
    oldOnload();
    expect(a.itemAtlasState()).toBe('loading'); expect(canvases).toHaveLength(0);
    loadImage(images[1], a.ITEM_ATLAS); expect(await retry).toBe(true);
    await vi.advanceTimersByTimeAsync(100); expect(a.itemAtlasState()).toBe('ready');
  });

  it('publishes no partial atlas when a crop fails and can retry cleanly', async () => {
    const a = await import('../src/game/item-atlas'); failAt = 3;
    const p = a.loadItemAtlas(); loadImage(images[0], a.ITEM_ATLAS);
    expect(await p).toBe(false);
    expect(a.atlasIconCell(Object.keys(a.ITEM_ATLAS.frames)[0])).toBeNull();
    failAt = -1;
    const retry = a.loadItemAtlas(); loadImage(images[1], a.ITEM_ATLAS); expect(await retry).toBe(true);
  });

  it('rejects bad dimensions, image errors, and unavailable DOM without hanging', async () => {
    const a = await import('../src/game/item-atlas');
    const badSize = a.loadItemAtlas(); images[0].onload?.(); expect(await badSize).toBe(false);
    const badNetwork = a.loadItemAtlas(); images[1].onerror?.(); expect(await badNetwork).toBe(false);
    vi.stubGlobal('Image', undefined); expect(await a.loadItemAtlas()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
