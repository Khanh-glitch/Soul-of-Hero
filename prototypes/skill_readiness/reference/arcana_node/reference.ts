// Node reference for ORIGINAL ARCANA III pure engine utilities.
// Imports ONLY src/engine/util.ts from the recovered original source: it has no
// PixiJS/DOM dependency, so this executes the actual original RNG/easing/noise
// code (not a re-implementation). The Pixi multipass renderer (core/draw/post)
// is NOT executed here; no visual parity is claimed from this runner.
//   tsx reference.ts vectors  -> JSON oracle vectors (rng/ease/hash/vnoise)
import { reseed, rand, ease, prog, sstep, hash1, hash2, vnoise, fbm } from './src/engine/util';

const mode = process.argv[2];
if (mode === 'vectors') {
  const out: Record<string, unknown> = {};
  for (const seed of [1, 7, 0, 12345]) {
    reseed(seed);
    const seq: number[] = [];
    const raw: number[] = [];
    for (let i = 0; i < 16; i++) { const v = rand(); seq.push(v); raw.push(Math.round(v * 4294967296)); }
    out[`rng_seed_${seed}`] = seq;
    // Exact integer form: Godot's JSON parser can mis-round long decimal
    // literals by 1 ulp, so the gate compares against raw uint32 outputs.
    out[`rng_seed_${seed}_u32`] = raw;
  }
  const ts = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
  out['ease'] = Object.fromEntries(Object.entries(ease).map(([k, f]) => [k, ts.map((t) => (f as (x: number) => number)(t))]));
  out['prog'] = ts.map((t) => prog(t * 10, 2.3, 3.8));
  out['sstep'] = ts.map((t) => sstep(1.3, 3.2, 1.3 + t * 1.9));
  out['hash1'] = [0, 1, 7, 42, 1000].map((n) => hash1(n));
  out['hash2'] = [[0, 0], [1, 2], [7, 13], [100, 50]].map(([x, y]) => hash2(x, y));
  out['vnoise'] = [[0, 0], [1.5, 2.5], [7.25, 13.75], [100.5, 50.25]].map(([x, y]) => vnoise(x, y));
  out['fbm'] = [[0, 0], [3.5, 9.25], [40, 17]].map(([x, y]) => fbm(x, y));
  console.log(JSON.stringify(out, null, 1));
} else {
  console.error('usage: reference.ts vectors');
  process.exit(2);
}
