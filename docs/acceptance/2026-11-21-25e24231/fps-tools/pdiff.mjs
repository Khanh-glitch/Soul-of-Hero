// Compare two CPU profiles by function name: self and inclusive ms per frame, largest differences first.
import fs from 'node:fs'; const [a, b, N = '1800', TOP = '30', under = ''] = process.argv.slice(2);
const load = f => { const P = JSON.parse(fs.readFileSync(f)); const byId = new Map(P.nodes.map(n => [n.id, n])); const parent = new Map(); for (const n of P.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const nm = n => n.callFrame.functionName || `(anon@${n.callFrame.url.split('/').pop().slice(0, 12)})`; const self = {}, incl = {};
  P.samples.forEach((id, i) => { const d = (P.timeDeltas[i + 1] ?? 0) / 1000 / +N; const chain = []; for (let c = id; c !== undefined; c = parent.get(c)) chain.push(nm(byId.get(c))); if (under && !chain.includes(under)) return;
    self[chain[0]] = (self[chain[0]] ?? 0) + d; for (const k of new Set(chain)) incl[k] = (incl[k] ?? 0) + d; }); return { self, incl }; };
const A = load(a), B = load(b);
for (const kind of ['self', 'incl']) { const keys = new Set([...Object.keys(A[kind]), ...Object.keys(B[kind])]); const rows = [...keys].map(k => [k, A[kind][k] ?? 0, B[kind][k] ?? 0]).sort((x, y) => Math.abs(y[2] - y[1]) - Math.abs(x[2] - x[1])).slice(0, +TOP);
  console.log(`-- ${kind} ms/frame: A, B, B-A`); for (const [k, x, y] of rows) console.log(`${x.toFixed(2).padStart(7)} ${y.toFixed(2).padStart(7)} ${(y - x >= 0 ? '+' : '') + (y - x).toFixed(2)}  ${k}`); }
