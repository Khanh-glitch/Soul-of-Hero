// Generates the V8 (Node) reference vectors for native/venom/v8_math.gd.
//
//   node gen_v8_math_vectors.js > ../../tests/data/v8_math_vectors.json
//
// Each vector stores the input and V8's output as IEEE-754 bit patterns (hex),
// so the GDScript test compares bit-for-bit, with no decimal round trip.
// Inputs come from a fixed LCG so the file is reproducible.
let seed = 20261029;
function rnd() { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; }
const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
function hex(x) {
  f64[0] = x;
  return u32[1].toString(16).padStart(8, '0') + u32[0].toString(16).padStart(8, '0');
}
const N = 1000;
const out = { node: process.version, schema: 'gold93/v8-math-vectors/v1', fns: {} };
const add = (name, arity, rows) => { out.fns[name] = { arity, rows }; };

// Argument ranges mirror what the skills actually feed the functions:
//   trig: t*k + phase over a few seconds (|x| up to ~1500 rad), boids angles, small deltas.
const trig = [];
for (let i = 0; i < N; i++) trig.push([rnd() * 3000 - 1500]);
for (let i = 0; i < N; i++) trig.push([rnd() * 2 - 1]);
for (let i = 0; i < N; i++) trig.push([(rnd() - 0.5) * 12]);
add('sin', 1, trig.map(([a]) => [hex(a), hex(Math.sin(a))]));
add('cos', 1, trig.map(([a]) => [hex(a), hex(Math.cos(a))]));

const pairs = [];
for (let i = 0; i < 2 * N; i++) pairs.push([rnd() * 400 - 200, rnd() * 400 - 200]);
add('atan2', 2, pairs.map(([y, x]) => [hex(y), hex(x), hex(Math.atan2(y, x))]));
add('hypot', 2, pairs.map(([x, y]) => [hex(x), hex(y), hex(Math.hypot(x, y))]));

const unit = [];
for (let i = 0; i < N; i++) unit.push(rnd() * 2 - 1);
add('asin', 1, unit.map((s) => [hex(s), hex(Math.asin(s))]));

const ex = [];
for (let i = 0; i < N; i++) ex.push(rnd() * 1400 - 700);
add('exp', 1, ex.map((e) => [hex(e), hex(Math.exp(e))]));
const lg = [];
for (let i = 0; i < N; i++) lg.push(Math.abs(rnd() * 400 - 200) + 1e-9);
add('log', 1, lg.map((v) => [hex(v), hex(Math.log(v))]));

// pow: exponent 2 is special-cased by V8 (x*x) and is in the verified set.
// Other exponents are recorded separately as the known residual.
const pw2 = [];
for (let i = 0; i < N; i++) { const b = rnd() * 400 - 200; pw2.push([b, Math.pow(b, 2)]); }
add('pow_exp2', 2, pw2.map(([b, r]) => [hex(b), '2', hex(r)]));
const pwg = [];
for (let i = 0; i < N; i++) { const b = rnd() * 3; pwg.push([b, rnd() * 4 - 2]); }
add('pow_general', 2, pwg.map(([b, e]) => [hex(b), hex(e), hex(Math.pow(b, e))]));
process.stdout.write(JSON.stringify(out));
