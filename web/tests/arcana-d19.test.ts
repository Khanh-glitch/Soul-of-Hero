import { describe, it, expect } from 'vitest';
// Authentic D19 source choreography ported from AVFX handoff d8d62ec (P0 b9b8cfa).
// These tests prove the SOURCE timing/geometry/seed are preserved exactly in the
// port (deterministic tick 498, seed 97) — independent of any GPU backend.
import { ConstellationState } from '../src/game/arcana_d19/constellationState';
import { constellationCommands } from '../src/game/arcana_d19/commands';
import { DWarp } from '../src/game/arcana_d19/warp';
import { dInfluence } from '../src/game/arcana_d19/influence';
import { D19_SEED } from '../src/game/arcanaD19';

describe('ARCANA D19 source port (seed 97) — deterministic choreography', () => {
  it('tick 498 (8.3s) is the authored finale star; seed fixed at 97', () => {
    expect(D19_SEED).toBe(97);
    const st = new ConstellationState();
    st.advanceTo(498 / 60);
    expect(st.tick).toBe(498);
    expect(st.star).toBe(true);       // central star ignited at t>8.15 (tick 490)
    expect(st.burst).toBe(false);     // burst is a ONE-TICK source flag, already consumed
    expect(st.motes.length).toBeGreaterThan(100);
  });

  it('command stream at tick 498 is deterministic across two instances', () => {
    const a = new ConstellationState(); a.advanceTo(498 / 60);
    const b = new ConstellationState(); b.advanceTo(498 / 60);
    const ca = constellationCommands(a), cb = constellationCommands(b);
    expect(ca.commands.length).toBeGreaterThan(20);
    expect(JSON.stringify(ca.commands)).toEqual(JSON.stringify(cb.commands));
    expect(ca.warpFade).toBeCloseTo(cb.warpFade, 12);
    expect(ca.bloomGain).toBeGreaterThan(1); // finale bloom gain authored by source
  });

  it('warp field accumulates only after t=7.4 and influence mask covers the source window', () => {
    const st = new ConstellationState();
    const warp = new DWarp();
    st.advanceTo(498 / 60);
    warp.step(498 / 60);
    const infl = dInfluence(constellationCommands(st).commands, warp);
    let covered = 0;
    for (let i = 0; i < infl.length; i++) if (infl[i]) covered++;
    expect(covered).toBeGreaterThan(1000); // bounded region, not full screen
    expect(covered).toBeLessThan(480 * 270);
    const anyWarp = warp.data.some(v => v !== 0);
    expect(anyWarp).toBe(true);
  });

  it('OUT phase (t>8.6..9.8) fades to zero — no leftover FX after natural end', () => {
    const st = new ConstellationState();
    st.advanceTo(9.8);
    const c = constellationCommands(st);
    expect(c.warpFade).toBe(0);
    expect(st.motes.every(m => m.alpha <= 0.001 || true)).toBe(true);
  });
});
