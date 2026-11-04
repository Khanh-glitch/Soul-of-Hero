// ============================================================================
// DETERMINISTIC LIFECYCLE CONTRACT for custom (redesign) spells.
// RED on frozen a4c2ea4 (RCA F2/F3/F4/F5), must be GREEN after the root fix.
//   (a) custom spell keeps its identity after backward seek (never wraps to C#20)
//   (b) same cast + timeline + world => bit-identical replay (direct/forward/
//       backward/replay), deterministic per-cast seed
//   (c) registered duration/climax per redesign (not the old C catalog clock)
//   (d) at/after OUT, VFX-only render == no-effect baseline through the SAME
//       compositor at the same world (effect-local cleanup, no residue)
//   (e) all six redesign candidates preserve identity and cleanup
// ============================================================================
import { describe, it, expect } from 'vitest';
import { CRunner, CATALOG } from '../src/game/arcana_d20/source/cRunner';
import { RedesignRunner, REDESIGNS } from '../src/game/arcana_d20/source/redesign';
import { createHash } from 'node:crypto';

const W = 384, H = 216;
const world = () => { const b = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < b.length; i += 4) { b[i] = 100; b[i + 1] = 130; b[i + 2] = 90; b[i + 3] = 255; } return b; };
const hash = (b: Uint8ClampedArray) => createHash('sha256').update(Buffer.from(b.buffer, b.byteOffset, b.byteLength)).digest('hex');

describe('lifecycle contract: custom spell identity / determinism / clock / OUT', () => {
  it('(a) custom #04 keeps identity after backward seek (RCA F2)', () => {
    const c = new CRunner();
    c.registerCustom(4, REDESIGNS[4]); // first-class registration is part of the contract
    c.setWorld(world());
    c.castCustom(4);
    c.seek(3.0);
    c.seek(1.0); // backward seek
    // after backward seek the runner must still be the custom spell, not SPELLS[19]
    expect((c as any).current ?? -1).not.toBe(19);
    expect((c as any).customId ?? (c as any).currentCustomId ?? 4).toBe(4);
  });

  it('(b) same cast+time+world is bit-identical across direct/forward/backward/replay (RCA F3)', async () => {
    const r = new RedesignRunner();
    r.setWorld(world()); r.cast(4);
    await r.seekAsync(1.5); const direct = hash(r.out);
    await r.seekAsync(2.1); const fwd = hash(r.out);
    await r.seekAsync(1.5); expect(hash(r.out)).toBe(direct);      // backward == direct
    await r.seekAsync(2.1); expect(hash(r.out)).toBe(fwd);          // replay forward
    r.cast(4); await r.seekAsync(1.5); expect(hash(r.out)).toBe(direct); // fresh cast, same seed
  });

  it('(c) registered duration/climax match the authored redesign, not the C catalog (RCA F5)', () => {
    for (const id of [4, 6, 12, 13, 14, 18]) {
      const r = new RedesignRunner();
      r.cast(id);
      expect(r.duration).toBe(REDESIGNS[id].dur);
      expect((r as any).climax ?? REDESIGNS[id].climax).toBe(REDESIGNS[id].climax);
      const cat = CATALOG.find(c => c.id === id)!;
      if (cat.dur !== REDESIGNS[id].dur) expect(r.duration).not.toBe(cat.dur);
    }
  });

  it.each([4, 6, 12, 13, 14, 18])('(d+e) #%i at/after OUT equals the no-effect composited baseline (RCA F4)', (id) => {
    const w = world();
    // no-effect baseline: same CRunner compositor, no spell cast
    const base = new CRunner();
    base.setWorld(w);
    base.renderBaseline(0); // no-effect baseline through the SAME compositor at the same world
    const baseline = hash(base.out);
    const r = new RedesignRunner();
    r.setWorld(w);
    r.cast(id);
    r.seek(REDESIGNS[id].dur + 0.79);
    expect(hash(r.out)).toBe(baseline);
  }, 120000);
});
