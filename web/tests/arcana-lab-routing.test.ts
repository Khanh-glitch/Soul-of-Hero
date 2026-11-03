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
  it.each([1, 5, 9, 11, 16])('composeFusion recipe #%i renders non-empty via contribution contract', async (id) => {
    const { RECIPES, composeFusion } = await import('../src/game/arcana_d20/source/fusionRecipe');
    const { ARunner, A_W, A_H } = await import('../src/game/arcana_d20/source/aRunner');
    const { BRunner } = await import('../src/game/arcana_d20/source/bRunner');
    const { CRunner } = await import('../src/game/arcana_d20/source/cRunner');
    const runners = { a: new ARunner(), b: new BRunner(), c: new CRunner() };
    runners.a.setWorld(new Uint8ClampedArray(A_W * A_H * 4).fill(40));
    const out = new Uint8ClampedArray(A_W * A_H * 4);
    composeFusion(RECIPES[id], runners, 0.3, out);
    let changed = 0;
    for (let i = 0; i < out.length; i += 4) if (Math.abs(out[i] - 40) > 12) changed++;
    expect(changed, `recipe #${id}`).toBeGreaterThan(30);
  });
  it('#11 proof: C#09 arc packets are extracted and bound to MOVING A#11 anchors across phases', async () => {
    const { CRunner } = await import('../src/game/arcana_d20/source/cRunner');
    const { ARunner } = await import('../src/game/arcana_d20/source/aRunner');
    const { BRunner } = await import('../src/game/arcana_d20/source/bRunner');
    const { RECIPES, composeFusion } = await import('../src/game/arcana_d20/source/fusionRecipe');
    const c = new CRunner();
    const a = new ARunner();
    // C#09 authored bolt events exist at all three motion phases
    const packets = [1.0, 3.0, 5.3].map(t => c.extractArcs(8, t)); // index 8 = skill id 9
    for (const pk of packets) expect(pk.length).toBeGreaterThan(0);
    // A#11 anchors actually move between phases
    const an1 = a.anchorsFor(11, 1.0), an3 = a.anchorsFor(11, 3.0), an5 = a.anchorsFor(11, 5.3);
    expect(an1.length).toBeGreaterThan(4);
    const moved = (p: any, q: any) => Math.hypot(p.x - q.x, p.y - q.y);
    expect(an1.some((p, i) => moved(p, an3[i]) > 2)).toBe(true);
    expect(an3.some((p, i) => moved(p, an5[i]) > 2)).toBe(true);
    // fusion differs from pure A lead at peak (arcs actually added)
    const { A_W, A_H } = await import('../src/game/arcana_d20/source/aRunner');
    const runners = { a: new ARunner(), b: new BRunner(), c: new CRunner() };
    runners.a.setWorld(new Uint8ClampedArray(A_W * A_H * 4).fill(40));
    const fused = new Uint8ClampedArray(A_W * A_H * 4);
    composeFusion(RECIPES[11], runners, 5.3 / 7.0, fused);
    runners.a.setWorld(new Uint8ClampedArray(A_W * A_H * 4).fill(40));
    runners.a.cast(10); runners.a.seek(5.3);
    let diff = 0;
    for (let i = 0; i < fused.length; i += 4) if (Math.abs(fused[i] - runners.a.out[i]) > 10) diff++;
    expect(diff).toBeGreaterThan(50); // C#09 arcs bound into the A#11 frame
  }, 120000);
});
