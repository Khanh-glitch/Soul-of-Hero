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

describe('ARCANA20 phase 3: semantic fusion recipes', () => {
  it('#11 fusion recipe binds A#11 structure + C#09 arcs (NOT C#11); lead is pure A', async () => {
    const { RECIPES, recipeLabel } = await import('../src/game/arcana_d20/source/fusionRecipe');
    const { sourceLabel } = await import('../src/game/arcana_lab');
    const r = RECIPES[11];
    expect(r.lead).toMatchObject({ engine: 'A', skillId: 11, role: 'structure' });
    expect(r.components.some(c => c.engine === 'C' && c.skillId === 9 && c.role === 'arc')).toBe(true);
    expect(r.components.some(c => c.skillId === 11 && c.engine === 'C')).toBe(false);
    expect(sourceLabel(11, 'lead')).toBe('A');
    expect(sourceLabel(11, 'study')).toBe('C (study)');
    expect(recipeLabel(r)).toBe('A#11+C#9');
    for (const id of [1, 5, 9, 16]) expect(RECIPES[id].lead.engine).toBe('A');
  });
  it('composeFusion merges signed deltas (not RGB average) and runs for all recipes', async () => {
    const { RECIPES, composeFusion } = await import('../src/game/arcana_d20/source/fusionRecipe');
    const { ARunner, A_W, A_H } = await import('../src/game/arcana_d20/source/aRunner');
    const { BRunner } = await import('../src/game/arcana_d20/source/bRunner');
    const { CRunner } = await import('../src/game/arcana_d20/source/cRunner');
    const worldFor = (w: number, h: number) => { const b = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < b.length; i += 4) { b[i] = 30; b[i + 1] = 60; b[i + 2] = 40; b[i + 3] = 255; } return b; };
    const runners = { a: new ARunner(), b: new BRunner(), c: new CRunner() };
    for (const id of Object.keys(RECIPES).map(Number)) {
      const out = new Uint8ClampedArray(A_W * A_H * 4);
      composeFusion(RECIPES[id], runners, worldFor, 0.5, out);
      let changed = 0;
      for (let i = 0; i < out.length; i += 4) if (Math.abs(out[i] - 30) + Math.abs(out[i + 1] - 60) > 20) changed++;
      expect(changed, `recipe #${id}`).toBeGreaterThan(30);
    }
  }, 600000);
});
