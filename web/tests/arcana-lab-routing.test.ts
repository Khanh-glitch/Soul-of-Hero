import { describe, it, expect, vi } from 'vitest';

// Mock the presenter + compositor BEFORE importing the lab client
const uploads: any[] = [];
vi.mock('../src/game/gpu/presenter', () => ({
  getPresenter: () => ({
    gl: { fake: true },
    worldRegion: (x: number, y: number, w: number, h: number) => new Uint8ClampedArray(w * h * 4).fill(40),
    uploadFrame: (d: Uint8ClampedArray, w?: number, h?: number) => { uploads.push({ len: d.length, w, h }); },
    lightTexture: () => null, frameTexture: () => null,
  }),
}));
const passes: any[] = [];
vi.mock('../src/game/compositor', () => ({
  submitGpuPass: (p: any) => { passes.push(p); },
}));

import { arcanaLab } from '../src/game/arcana_lab';

describe('arcanaLab routing smoke (all 20 x modes, mocked presenter)', () => {
  it('every entry casts and submits without throwing in lead/study/fusion modes', () => {
    const frame: any = { now: 0, cam: { x: 0, y: 0 } };
    for (const e of arcanaLab.catalog) {
      for (const mode of ['lead', 'study', 'fusion'] as const) {
        arcanaLab.qaCast(e.index, 100, 100, mode);
        arcanaLab.qaSeek(0.5, e.index, 100, 100, mode);
        try { arcanaLab.submitGpu(frame); } catch (err: any) { throw new Error(`entry #${e.id} mode=${mode}: ${err.stack}`); }
      }
    }
    arcanaLab.qaStop();
    expect(arcanaLab.catalog.length).toBe(20);
  }, 600000);
});
