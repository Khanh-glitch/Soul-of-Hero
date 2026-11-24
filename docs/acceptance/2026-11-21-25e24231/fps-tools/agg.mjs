import fs from 'node:fs'; const P = JSON.parse(fs.readFileSync(process.argv[2])); const N = Number(process.argv[3] ?? 900), TOP = Number(process.argv[4] ?? 60);
const byId = new Map(P.nodes.map(n => [n.id, n])); const parent = new Map(); for (const n of P.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const name = n => `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`; const incl = {}, self = {};
P.samples.forEach((id, i) => { const d = (P.timeDeltas[i + 1] ?? 0) / 1000; const seen = new Set(); self[name(byId.get(id))] = (self[name(byId.get(id))] ?? 0) + d; for (let c = id; c !== undefined; c = parent.get(c)) { const k = name(byId.get(c)); if (!seen.has(k)) { seen.add(k); incl[k] = (incl[k] ?? 0) + d; } } });
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(v / N).toFixed(2).padStart(7)} ${k}`).join('\n'); console.log('incl ms/frame:\n' + top(incl, TOP)); console.log('self:\n' + top(self, 25));
