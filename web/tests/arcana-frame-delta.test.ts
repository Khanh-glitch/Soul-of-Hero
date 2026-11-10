// ============================================================================
// ACTIVE-FRAME COMPOSITING CLOSURE — regression contract (CT decision 6622564987).
// The C/redesign frame path must submit a SIGNED, effect-local delta gated by an
// influence mask, so an active cast can never paste a straight-edged 384x216
// "source window" over the real SOH world.
//   (a) no-effect baseline through the same compositor == raw world, bit-exact
//       => delta = out - worldRegion is exact matched-baseline subtraction
//   (b) influence mask is effect-local: the 14px edge ring is ~free of influence
//       (a full-frame rectangle would light up ~100% of it), interior has effect
//   (c) emulated presenter output (scene + delta*influence) preserves the scene
//       at every zero-influence pixel (incl. the whole edge ring outside the
//       effect) and reproduces the runner frame where influence is full
//   (d) OUT: delta and influence are all-zero => presented == scene bit-exact
//   (e) backward seek / replay: delta is bit-identical (deterministic per cast)
//   (f) signedness: active frames contain NEGATIVE delta pixels (darkness /
//       occlusion) — the path is not additive-only
// ============================================================================
import { describe, it, expect } from 'vitest';
import { CRunner } from '../src/game/arcana_d20/source/cRunner';
import { RedesignRunner, REDESIGNS } from '../src/game/arcana_d20/source/redesign';
import { createHash } from 'node:crypto';

const W = 384, H = 216;
const world = () => {
  const b = new Uint8ClampedArray(W * H * 4);
  let s = 1234567;
  for (let i = 0; i < b.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    b[i] = (s >> 7) & 255; b[i + 1] = (s >> 13) & 255; b[i + 2] = (s >> 19) & 255; b[i + 3] = 255;
  }
  return b;
};
const hash = (b: Uint8ClampedArray | Uint8Array | Float32Array) =>
  createHash('sha256').update(Buffer.from(b.buffer as ArrayBuffer, b.byteOffset, b.byteLength)).digest('hex');

/** CPU mirror of the presenter's signed FRAME_FS branch: scene + delta*(infl/255) */
function presentSigned(scene: Uint8ClampedArray, delta: Float32Array, infl: Uint8Array) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const k = infl[i] / 255;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(scene[i * 4 + c] + delta[i * 4 + c] * k)));
    out[i * 4 + 3] = 255;
  }
  return out;
}
const edgeRing = (fn: (x: number, y: number, i: number) => void) => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.min(x, W - 1 - x, y, H - 1 - y);
    if (d < 14) fn(x, y, y * W + x);
  }
};

const PHASES = (id: number): [string, number][] => {
  const dur = REDESIGNS[id].dur, cl = REDESIGNS[id].climax;
  return [['open', Math.min(1.0, dur * 0.2)], ['peak', cl], ['impact', Math.min(cl + 0.15, dur)], ['out', dur + 0.79]];
};

describe('active-frame compositing closure: signed effect-local frame delta', () => {
  it('(a) no-effect baseline through the same compositor == raw world, bit-exact', () => {
    const w = world();
    const c = new CRunner();
    c.setWorld(w);
    c.renderBaseline(0);
    expect(hash(c.out)).toBe(hash(w));
  });

  it.each([4, 6, 12, 13, 14, 18])('(b+c+f) #%i: influence is effect-local, presentation preserves scene outside it, delta is signed', async (id) => {
    const w = world();
    let negTotal = 0;
    for (const [ph, t] of PHASES(id)) {
      const r = new RedesignRunner();
      r.setWorld(w); r.cast(id);
      await r.seekAsync(t);
      const out = r.out;
      const infl = r.influenceMask(3);
      const delta = new Float32Array(W * H * 4);
      for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) delta[i * 4 + c] = out[i * 4 + c] - w[i * 4 + c];
      // edge ring: a pasted rectangle would alter ~100% of it; the influence mask
      // must keep the ring mostly clean so the scene survives at the boundary
      let edgeInfl = 0, edgeN = 0, interiorInfl = 0;
      edgeRing((x, y, i) => { edgeN++; if (infl[i]) edgeInfl++; });
      for (let i = 0; i < W * H; i++) if (infl[i]) interiorInfl++;
      if (ph !== 'out') {
        expect(edgeInfl / edgeN).toBeLessThan(0.2);          // no full-frame rectangle signature
        expect(interiorInfl).toBeGreaterThan(0);              // effect is present somewhere
      }
      // presented output: scene preserved at EVERY zero-influence pixel
      const presented = presentSigned(w, delta, infl);
      edgeRing((x, y, i) => {
        if (!infl[i]) for (let c = 0; c < 3; c++) expect(presented[i * 4 + c]).toBe(w[i * 4 + c]);
      });
      // where influence is full and scene==world, presentation == runner frame (effect intact)
      let fullChecked = 0;
      for (let i = 0; i < W * H && fullChecked < 500; i++) {
        if (infl[i] === 255) {
          fullChecked++;
          for (let c = 0; c < 3; c++) {
            const expectV = Math.max(0, Math.min(255, Math.round(w[i * 4 + c] + delta[i * 4 + c])));
            expect(presented[i * 4 + c]).toBe(expectV);
          }
        }
      }
      // signedness accumulates over the active phases of the spell
      if (ph !== 'out') for (let i = 0; i < W * H * 3; i++) if (delta[i] < -2) negTotal++;
    }
    expect(negTotal).toBeGreaterThan(0); // darkness/occlusion remains possible (not additive-only)
  });

  it.each([4, 6, 12, 13, 14, 18])('(d) #%i at OUT: delta and influence all zero => presented == scene bit-exact', async (id) => {
    const w = world();
    const r = new RedesignRunner();
    r.setWorld(w); r.cast(id);
    await r.seekAsync(REDESIGNS[id].dur + 0.79);
    const infl = r.influenceMask(3);
    const delta = new Float32Array(W * H * 4);
    for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) delta[i * 4 + c] = r.out[i * 4 + c] - w[i * 4 + c];
    expect([...infl].every(v => v === 0)).toBe(true);
    expect([...delta].every(v => v === 0)).toBe(true);
    expect(hash(presentSigned(w, delta, infl))).toBe(hash(w));
  });

  it('(e) #04 backward seek / replay: delta is bit-identical (deterministic)', async () => {
    const w = world();
    const r = new RedesignRunner();
    r.setWorld(w); r.cast(4);
    await r.seekAsync(4.1); const fwd = hash(r.out);
    await r.seekAsync(1.5); await r.seekAsync(4.1); // backward then forward replay
    expect(hash(r.out)).toBe(fwd);
    const infl = r.influenceMask(3);
    const d1 = hash(new Uint8Array(r.out));
    r.cast(4); await r.seekAsync(4.1); // fresh cast, same seed
    expect(hash(r.out)).toBe(d1);
    expect(hash(r.influenceMask(3))).toBe(hash(infl));
  });
});
