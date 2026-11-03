// Phase-1 semantic bridge test: run the UNMODIFIED P0 donor spell on a
// controlled 384x216 reference background and assert source-semantic phases:
// opening displacement glitches, opaque void ink inside the tear, masked
// geometry, collision flash, world-sampled fragments, restitch OUT.
import { describe, it, expect } from 'vitest';
import { SemanticRipper, SF_W, SF_H } from '../src/game/arcana_d20/source/semantic';

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
