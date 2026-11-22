// children breakdown under a function: node sub.mjs <profile> <fn> <calls>
import fs from 'node:fs'; const P = JSON.parse(fs.readFileSync(process.argv[2])); const FN = process.argv[3], CALLS = Number(process.argv[4] ?? 1);
const byId = new Map(P.nodes.map(n => [n.id, n])); const parent = new Map(); for (const n of P.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const incl = {}; let total = 0;
P.samples.forEach((id, i) => { const d = (P.timeDeltas[i + 1] ?? 0) / 1000; const st = []; for (let c = id; c !== undefined; c = parent.get(c)) st.push(byId.get(c).callFrame.functionName || '(anon)'); const at = st.lastIndexOf(FN); if (at < 0) return; total += d; const seen = new Set(); for (const k of st.slice(0, at)) if (!seen.has(k)) { seen.add(k); incl[k] = (incl[k] ?? 0) + d; } const leaf = 'SELF ' + st[0]; incl[leaf] = (incl[leaf] ?? 0) + d; });
console.log(`${FN}: ${(total / CALLS).toFixed(1)} ms per call (${CALLS} calls)`); for (const [k, v] of Object.entries(incl).sort((a, b) => b[1] - a[1]).slice(0, Number(process.argv[5] ?? 22))) console.log((v / CALLS).toFixed(1).padStart(8), k);
