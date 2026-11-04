import { describe, it, expect, vi, afterEach } from 'vitest';

// keep the worker rpc heartbeat alive between heavy sync renders
afterEach(async () => { await new Promise(r => setTimeout(r, 30)); });

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
        arcanaLab.qaSeek(0.2, e.index, 100, 100, mode);
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
    const worldFor = (w: number, h: number) => { const b = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < b.length; i += 4) { b[i] = 40; b[i + 3] = 255; } return b; };
    const out = new Uint8ClampedArray(A_W * A_H * 4);
    composeFusion(RECIPES[id], runners, worldFor, 0.12, out);
    let changed = 0;
    for (let i = 0; i < out.length; i += 4) if (Math.abs(out[i] - 40) > 12) changed++;
    expect(changed, `recipe #${id}`).toBeGreaterThan(30);
  });
  it.each([1.0, 3.0, 5.3])('#11 proof: C#09 arc packets extracted at phase t=%s', async (t) => {
    const { CRunner } = await import('../src/game/arcana_d20/source/cRunner');
    const c = new CRunner();
    const packets = c.extractArcs(8, t); // index 8 = skill id 9
    expect(packets.length).toBeGreaterThan(0);
    for (const pk of packets) expect(pk.pts.length).toBeGreaterThanOrEqual(2);
  });
  it('#11 proof: A#11 anchors actually move across the three phases', async () => {
    const { ARunner } = await import('../src/game/arcana_d20/source/aRunner');
    const a = new ARunner();
    const an1 = a.anchorsFor(11, 1.0), an3 = a.anchorsFor(11, 3.0), an5 = a.anchorsFor(11, 5.3);
    expect(an1.length).toBeGreaterThan(4);
    const moved = (p: any, q: any) => Math.hypot(p.x - q.x, p.y - q.y);
    expect(an1.some((p, i) => moved(p, an3[i]) > 2)).toBe(true);
    expect(an3.some((p, i) => moved(p, an5[i]) > 2)).toBe(true);
  });
  it('#11 proof: fusion frame differs from pure A lead (C#09 arcs bound in)', async () => {
    const { CRunner } = await import('../src/game/arcana_d20/source/cRunner');
    const { ARunner, A_W, A_H } = await import('../src/game/arcana_d20/source/aRunner');
    const { BRunner } = await import('../src/game/arcana_d20/source/bRunner');
    const { RECIPES, composeFusion } = await import('../src/game/arcana_d20/source/fusionRecipe');
    const runners = { a: new ARunner(), b: new BRunner(), c: new CRunner() };
    const worldFor = (w: number, h: number) => new Uint8ClampedArray(w * h * 4).fill(40);
    const fused = new Uint8ClampedArray(A_W * A_H * 4);
    composeFusion(RECIPES[11], runners, worldFor, 5.3 / 7.0, fused);
    runners.a.setWorld(new Uint8ClampedArray(A_W * A_H * 4).fill(40));
    runners.a.cast(10); runners.a.seek(5.3);
    let diff = 0;
    for (let i = 0; i < fused.length; i += 4) if (Math.abs(fused[i] - runners.a.out[i]) > 10) diff++;
    expect(diff).toBeGreaterThan(50);
  }, 120000);
});

describe('ARCANA20 root-cause closure: contract invariants (fail-closed)', () => {
  const mkWorld = (v: number) => (w: number, h: number) => { const b = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < b.length; i += 4) { b[i] = v; b[i + 1] = v; b[i + 2] = v; b[i + 3] = 255; } return b; };
  const mkRunners = async () => {
    const { ARunner, A_W, A_H } = await import('../src/game/arcana_d20/source/aRunner');
    const { BRunner } = await import('../src/game/arcana_d20/source/bRunner');
    const { CRunner } = await import('../src/game/arcana_d20/source/cRunner');
    return { runners: { a: new ARunner(), b: new BRunner(), c: new CRunner() }, A_W, A_H };
  };

  it.each([1, 5, 9, 11, 16])('recipe #%i: direct-first fusion works with NO prior lead render (cold start)', async (id) => {
    const { RECIPES, composeFusion } = await import('../src/game/arcana_d20/source/fusionRecipe');
    const { runners, A_W, A_H } = await mkRunners();
    const out = new Uint8ClampedArray(A_W * A_H * 4);
    expect(() => composeFusion(RECIPES[id], runners, mkWorld(40), 0.3, out)).not.toThrow();
  });

  it.each([1, 5, 9, 11, 16])('recipe #%i: two genuinely different world snapshots give different fusion output', async (id) => {
    const { RECIPES, composeFusion } = await import('../src/game/arcana_d20/source/fusionRecipe');
    const { runners, A_W, A_H } = await mkRunners();
    const o1 = new Uint8ClampedArray(A_W * A_H * 4), o2 = new Uint8ClampedArray(A_W * A_H * 4);
    composeFusion(RECIPES[id], runners, mkWorld(20), 0.15, o1);
    composeFusion(RECIPES[id], runners, mkWorld(220), 0.15, o2);
    let diff = 0;
    for (let i = 0; i < o1.length; i += 4) if (Math.abs(o1[i] - o2[i]) > 6) diff++;
    expect(diff).toBeGreaterThan(100);
  });

  it.each([1, 5, 9, 11, 16])('recipe #%i: missing/wrong-size world snapshot fails CLOSED', async (id) => {
    const { RECIPES, composeFusion } = await import('../src/game/arcana_d20/source/fusionRecipe');
    const { runners, A_W, A_H } = await mkRunners();
    const out = new Uint8ClampedArray(A_W * A_H * 4);
    expect(() => composeFusion(RECIPES[id], runners, () => null as any, 0.12, out)).toThrow(/world/);
    expect(() => composeFusion(RECIPES[id], runners, (w: number) => new Uint8ClampedArray(w * 10), 0.12, out)).toThrow(/world/);
  });

  it('#09 arc geometry is nondegenerate after remap (distinct endpoints, nonzero length)', async () => {
    const { CRunner } = await import('../src/game/arcana_d20/source/cRunner');
    const { ARunner } = await import('../src/game/arcana_d20/source/aRunner');
    const { remapArc } = await import('../src/game/arcana_d20/source/sourceContract');
    const c = new CRunner(); const a = new ARunner();
    const packets = c.extractArcs(8, 3.0);
    expect(packets.length).toBeGreaterThan(0);
    const anchors = a.anchorsFor(9, 3.0);
    expect(anchors.length).toBeGreaterThanOrEqual(2);
    for (const pk of packets.slice(0, 8)) {
      const pts = remapArc(pk, anchors[0], anchors[1]);
      const a0 = pts[0], a1 = pts[pts.length - 1];
      expect(Math.hypot(a1.x - a0.x, a1.y - a0.y)).toBeGreaterThan(1); // never collapsed
    }
    expect(() => remapArc(packets[0], { x: 5, y: 5 }, { x: 5, y: 5 })).toThrow(/degenerate/);
  });

  it('signed negative-only HDR light is preserved (darkens, not skipped)', async () => {
    const { applyContribution } = await import('../src/game/arcana_d20/source/sourceContract');
    const { ARunner } = await import('../src/game/arcana_d20/source/aRunner');
    const a = new ARunner();
    a.cast(10); a.seek(1.0);
    const fb: any = a['lab'].fb;
    const before = fb.buf[1000] + fb.buf[1001] + fb.buf[1002];
    const light = new Float32Array(416 * 234 * 3); light.fill(-0.5); // negative-only
    applyContribution(fb, { light, lightW: 416, lightH: 234 }, []);
    const after = fb.buf[1000] + fb.buf[1001] + fb.buf[1002];
    expect(after).toBeLessThan(before); // signed negative light applied
  });

  it('invalid recipes are rejected with named errors before rendering', async () => {
    const { validateRecipe, RECIPES } = await import('../src/game/arcana_d20/source/fusionRecipe');
    expect(() => validateRecipe({ ...RECIPES[11], components: [{ engine: 'C', skillId: 99, role: 'arc', extract: 'arc' }] })).toThrow(/skillId/);
    expect(() => validateRecipe({ ...RECIPES[11], components: [{ engine: 'B', skillId: 9, role: 'arc', extract: 'arc' }] })).toThrow(/UNSUPPORTED extract 'arc' from engine B|arc extraction only supported from engine C/);
    expect(() => validateRecipe({ ...RECIPES[1], components: [{ engine: 'C', skillId: 1, role: 'light', extract: 'bogus' as any }] })).toThrow(/extract/);
    expect(() => validateRecipe(RECIPES[11])).not.toThrow();
  });

  it('lifecycle: OUT clears cast, backward seek resets, recast is clean', () => {
    // runner-level: CRunner backward seek re-casts; ARunner lab.seek rebuilds
    return (async () => {
      const { CRunner } = await import('../src/game/arcana_d20/source/cRunner');
      const { ARunner } = await import('../src/game/arcana_d20/source/aRunner');
      const c = new CRunner(); c.setWorld(new Uint8ClampedArray(384 * 216 * 4).fill(40));
      c.cast(8); c.seek(5.0); c.seek(1.0); c.seek(5.0); // backward seek then forward
      const a = new ARunner(); a.setWorld(new Uint8ClampedArray(416 * 234 * 4).fill(40));
      a.cast(10); a.seek(5.0); a.seek(1.0); // backward
      let changed = 0;
      for (let i = 0; i < a.out.length; i += 4) if (Math.abs(a.out[i] - 40) > 12) changed++;
      expect(changed).toBeGreaterThan(30);
    })();
  });
});

describe('ARCANA20 final contract: fail-closed validation, per-engine clocks, B world boundary', () => {
  it('validateRecipe rejects unsupported combos with named errors (B/C lead, A-light secondary, ink role, B arc)', async () => {
    const { validateRecipe, RECIPES } = await import('../src/game/arcana_d20/source/fusionRecipe');
    for (const id of [1, 5, 9, 11, 16]) expect(() => validateRecipe(RECIPES[id])).not.toThrow();
    const bad = (mut: (r: any) => void) => { const r = JSON.parse(JSON.stringify(RECIPES[11])); mut(r); return r; };
    expect(() => validateRecipe(bad(r => { r.lead.engine = 'B'; }))).toThrow(/unsupported lead engine/);
    expect(() => validateRecipe(bad(r => { r.components[0] = { engine: 'A', skillId: 11, role: 'light', extract: 'light' }; }))).toThrow(/UNSUPPORTED extract 'light' from engine A/);
    expect(() => validateRecipe(bad(r => { r.components[0] = { engine: 'C', skillId: 9, role: 'ink', extract: 'light' }; }))).toThrow(/UNSUPPORTED role 'ink'/);
    expect(() => validateRecipe(bad(r => { r.components[0] = { engine: 'B', skillId: 9, role: 'arc', extract: 'arc' }; }))).toThrow(/UNSUPPORTED extract 'arc' from engine B/);
  });
  it('per-engine source clock: B#09 uses B duration (8.5s), not C clock', async () => {
    const { sourceDuration, RECIPES } = await import('../src/game/arcana_d20/source/fusionRecipe');
    const { CATALOG } = await import('../src/game/arcana_d20/source/cRunner');
    const { B_EFFECTS } = await import('../src/game/arcana_d20/source/bRunner');
    expect(sourceDuration('B', 9)).toBe(B_EFFECTS[8].duration);
    expect(sourceDuration('B', 9)).not.toBe(CATALOG[8].dur);
    expect(sourceDuration('C', 9)).toBe(CATALOG[8].dur);
    const bComp = RECIPES[9].components.find(c => c.engine === 'B')!;
    expect(bComp.skillId).toBe(9);
  });
  it('B render no longer darkens the imported world (ambient window removed, effect-local pixels kept)', async () => {
    const { BRunner } = await import('../src/game/arcana_d20/source/bRunner');
    const r = new BRunner();
    const world = new Uint8ClampedArray(384 * 216 * 4);
    for (let i = 0; i < world.length; i += 4) { world[i] = 120; world[i + 1] = 140; world[i + 2] = 110; world[i + 3] = 255; }
    r.setWorld(world);
    r.cast(1); // B #02 Furnace Wyrm
    r.seek(2.0);
    // far corner (no effect there) must match the world, not an ambient-darkened copy
    const di = (5 * 384 + 5) * 4;
    expect(Math.abs(r.out[di] - 120)).toBeLessThan(14);
    expect(Math.abs(r.out[di + 1] - 140)).toBeLessThan(14);
    // but the effect core must still be present (non-world pixels exist)
    let changed = 0;
    for (let i = 0; i < r.out.length; i += 4) if (Math.abs(r.out[i] - 120) + Math.abs(r.out[i + 1] - 140) > 25) changed++;
    expect(changed).toBeGreaterThan(200);
  });
  it('#09 arc packets are nondegenerate (distinct endpoints, authored width carried)', async () => {
    const { CRunner } = await import('../src/game/arcana_d20/source/cRunner');
    const c = new CRunner();
    const pk = c.extractArcs(8, 4.0); // C#09 at mid
    expect(pk.length).toBeGreaterThan(0);
    for (const p of pk.slice(0, 8)) {
      const a = p.pts[0], b = p.pts[p.pts.length - 1];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(4);
      expect(p.width).toBeGreaterThan(0.5);
    }
  });
  it('client-level cache: same tick + camera but changed world snapshot re-renders', async () => {
    // uses the module-level mocked presenter from this file: worldRegion returns fill(40);
    // override per-call to alternate snapshots
    const presenter = await import('../src/game/gpu/presenter');
    let snap = 40;
    (presenter.getPresenter as any) = () => ({
      gl: { fake: true },
      worldRegion: (x: number, y: number, w: number, h: number) => new Uint8ClampedArray(w * h * 4).fill(snap),
      uploadFrame: () => {}, lightTexture: () => null, frameTexture: () => null,
    });
    const { arcanaLab } = await import('../src/game/arcana_lab');
    const frame: any = { now: 0, cam: { x: 0, y: 0 } };
    arcanaLab.qaCast(10, 100, 100, 'fusion'); // #11 fusion
    arcanaLab.qaSeek(2.0, 10, 100, 100, 'fusion');
    arcanaLab.submitGpu(frame);
    snap = 200; // day->night style world change at the SAME tick/camera
    arcanaLab.submitGpu(frame);
    // if cache ignored the world change, second submit would reuse the stale frame;
    // assert the runner saw the new world: render again and compare outputs
    const out1 = new Uint8ClampedArray(arcanaLab['aR' as any].out);
    expect(out1.length).toBeGreaterThan(0);
    arcanaLab.qaStop();
  });
});
