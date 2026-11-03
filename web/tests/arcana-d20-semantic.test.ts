// Phase-1 semantic bridge test: run the UNMODIFIED P0 donor spell on a
// controlled 384x216 reference background and assert source-semantic phases:
// opening displacement glitches, opaque void ink inside the tear, masked
// geometry, collision flash, world-sampled fragments, restitch OUT.
import { describe, it, expect } from 'vitest';
import { SemanticRipper, SF_W, SF_H } from '../src/game/arcana_d20/source/semantic';
import { CRunner, CATALOG } from '../src/game/arcana_d20/source/cRunner';

function refBackground(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(SF_W * SF_H * 4);
  for (let y = 0; y < SF_H; y++) for (let x = 0; x < SF_W; x++) {
    const i = (y * SF_W + x) * 4;
    // lab-like dark blue floor with a lighter grid, like the source arena
    const grid = (x % 32 < 2 || y % 32 < 2) ? 40 : 0;
    px[i] = 18 + grid; px[i + 1] = 24 + grid; px[i + 2] = 48 + grid * 2; px[i + 3] = 255;
  }
  return px;
}

function statsAt(t: number) {
  const sem = new SemanticRipper();
  sem.setWorld(refBackground());
  sem.stepTo(t);
  const out = sem.out;
  let changed = 0, darkInk = 0, bright = 0;
  const base = refBackground();
  for (let i = 0; i < out.length; i += 4) {
    if (Math.abs(out[i] - base[i]) + Math.abs(out[i + 1] - base[i + 1]) + Math.abs(out[i + 2] - base[i + 2]) > 24) changed++;
    if (out[i] < 80 && out[i + 1] < 70 && out[i + 2] < 110 && out[i + 2] > out[i]) darkInk++;
    if (out[i] > 200 && out[i + 1] > 180 && out[i + 2] > 200) bright++;
  }
  return { changed, darkInk, bright, flash: sem.flash };
}

describe('arcana-d20 semantic bridge (unmodified donor spell on C Frame)', () => {
  it('opening glitches displace real background pixels (t=0.4)', () => {
    const s = statsAt(0.4);
    expect(s.changed).toBeGreaterThan(10); // f.D moves real pixels, not gray lines
  }, 60000);
  it('open tear contains opaque dark void ink at t=4.5', () => {
    const s = statsAt(4.5);
    expect(s.darkInk).toBeGreaterThan(1000);
    expect(s.changed).toBeGreaterThan(2000);
  }, 60000);
  it('collision beat fires flash at t=6.6 and debris/fragments at t=7.8', () => {
    const c = statsAt(6.6);
    expect(c.flash).toBeGreaterThan(0.3);
    const r = statsAt(7.8);
    expect(r.changed).toBeGreaterThan(1500); // blocks flung + world-sampled
  }, 60000);
  it('restitch leaves only residual pixels by t=9.9', () => {
    const early = statsAt(6.0).changed;
    const late = statsAt(9.9).changed;
    expect(late).toBeLessThan(early);
  }, 60000);
  it('replay determinism: reset reproduces the collision frame', () => {
    const a = new SemanticRipper(); a.setWorld(refBackground()); a.stepTo(6.6);
    const b = new SemanticRipper(); b.setWorld(refBackground()); b.stepTo(1.0); b.reset(); b.stepTo(6.6);
    expect(Buffer.from(a.out).equals(Buffer.from(b.out))).toBe(true);
  }, 60000);
}, 60000);

describe('ARCANA20 batch: all 20 vendored C spells run on the semantic runner', () => {
  it.each(CATALOG.map(c => [c.index, c] as const))('spell #%i casts and renders non-empty frames', async (_i, c: any) => {
    const r = new CRunner();
    const base = new Uint8ClampedArray(384 * 216 * 4);
    for (let i = 0; i < base.length; i += 4) { base[i] = 30; base[i + 1] = 60; base[i + 2] = 40; base[i + 3] = 255; }
    r.setWorld(base);
    r.cast(c.index);
    await r.seekAsync(c.id >= 19 ? Math.min(c.climax + 0.3, c.dur * 0.6) : Math.min(1.6, c.dur * 0.3)); // #19/#20 are slow-burn openers
    let changed = 0;
    for (let i = 0; i < r.out.length; i += 4) if (Math.abs(r.out[i] - 30) + Math.abs(r.out[i + 1] - 60) > 20) changed++;
    expect(changed, `spell #${c.id} ${c.name}`).toBeGreaterThan(30);
  });
  it('catalog covers all 20 with honest status split 8/6/6', () => {
    const base = new Uint8ClampedArray(384 * 216 * 4);
    for (let i = 0; i < base.length; i += 4) { base[i] = 30; base[i + 1] = 60; base[i + 2] = 40; base[i + 3] = 255; }
    expect(CATALOG.length).toBe(20);
    const statuses = { SOURCE_PREVIEW: 0, FUSION_PREVIEW: 0, REDESIGN_STUDY: 0 };
    for (const c of CATALOG) statuses[c.status]++;
    expect(statuses.SOURCE_PREVIEW).toBe(8);
    expect(statuses.FUSION_PREVIEW).toBe(6);
    expect(statuses.REDESIGN_STUDY).toBe(6);
  });
});

describe('ARCANA20 phase 2: A and B source-semantic adapters', () => {
  const world = () => { const b = new Uint8ClampedArray(416 * 234 * 4); for (let i = 0; i < b.length; i += 4) { b[i] = 30; b[i + 1] = 60; b[i + 2] = 40; b[i + 3] = 255; } return b; };
  it.each([2, 3, 8])('B lead #%i renders non-empty via BRunner', async (id) => {
    const { BRunner, B_EFFECTS } = await import('../src/game/arcana_d20/source/bRunner');
    const r = new BRunner();
    r.setWorld(world());
    r.cast(B_EFFECTS.findIndex(e => e.id === id));
    r.seek(Math.min(1.6, r.duration * 0.3));
    let changed = 0;
    for (let i = 0; i < r.out.length; i += 4) if (Math.abs(r.out[i] - 30) + Math.abs(r.out[i + 1] - 60) > 20) changed++;
    expect(changed, `B spell #${id}`).toBeGreaterThan(30);
  });
  it('A runner (vendored A Lab) casts #11 Volt Carousel and renders non-empty', async () => {
    const { ARunner, A_SPELLS } = await import('../src/game/arcana_d20/source/aRunner');
    const r = new ARunner();
    r.setWorld(world());
    r.cast(A_SPELLS.findIndex(s => s.id === 11));
    r.seek(Math.min(2.0, r.duration * 0.35));
    let changed = 0;
    for (let i = 0; i < r.out.length; i += 4) if (Math.abs(r.out[i] - 30) + Math.abs(r.out[i + 1] - 60) > 20) changed++;
    expect(changed).toBeGreaterThan(30);
  }, 120000);
  it('manifest separates approvedVisualLead / renderedSource / fusionStatus / artAcceptance', async () => {
    const { LAB_CATALOG, sourceLabel } = await import('../src/game/arcana_lab');
    expect(LAB_CATALOG.length).toBe(20);
    const byId = Object.fromEntries(LAB_CATALOG.map(e => [e.id, e]));
    expect(byId[2].approvedVisualLead).toBe('B');
    expect(sourceLabel(2, 'lead')).toBe('B');
    expect(sourceLabel(19, 'lead')).toContain('D');
    expect(sourceLabel(20, 'lead')).toContain('A+C');
    expect(sourceLabel(7, 'lead')).toBe('C');
    expect(byId[4].artAcceptance).toBe('STUDY_NOT_APPROVED');
    expect(byId[1].fusionStatus).toBe('CANDIDATE_ONLY_NOT_APPROVED');
    expect(LAB_CATALOG.filter(e => e.approvedVisualLead === 'B').map(e => e.id)).toEqual([2, 3, 8]);
  });
});
