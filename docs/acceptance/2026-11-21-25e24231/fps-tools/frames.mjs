
// Per-frame attribution of a CPU profile: node frames.mjs <outdir> [thresholdMs]
import fs from 'node:fs'; import path from 'node:path';
const dir = process.argv[2], TH = Number(process.argv[3] ?? 25); const PHN = process.env.PHASE; const R = JSON.parse(fs.readFileSync(dir + (PHN ? `/phase-${PHN}.json` : '/result.json'))); const P = JSON.parse(fs.readFileSync(dir + (PHN ? `/phase-${PHN}.cpuprofile` : '/profile.cpuprofile')));
const byId = new Map(P.nodes.map(n => [n.id, n])); const parent = new Map(); for (const n of P.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const name = n => `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`;
const stackOf = new Map(); const stack = id => { let s = stackOf.get(id); if (!s) { s = []; for (let c = id; c !== undefined; c = parent.get(c)) s.push(name(byId.get(c))); s.reverse(); stackOf.set(id, s); } return s; };
let t = P.startTime; const samples = P.samples.map((id, i) => { t += P.timeDeltas[i]; return { id, t: t / 1000, d: (P.timeDeltas[i + 1] ?? 0) / 1000 }; });
const first = samples.find(s => stack(s.id).some(k => k.startsWith('loop:'))); const off = first.t - R.pstarts[0];
const frames = R.pstarts.map((s, i) => ({ s: s + off, e: s + off + R.pseries[i], dur: R.pseries[i], incl: {}, self: {} }));
let fi = 0; for (const s of samples) { while (fi < frames.length - 1 && s.t >= frames[fi].e) fi++; const f = frames[fi]; if (s.t < f.s || s.t >= f.e) continue; const st = stack(s.id); const seen = new Set(); for (const k of st) if (!seen.has(k)) { seen.add(k); f.incl[k] = (f.incl[k] ?? 0) + s.d; } const leaf = st.at(-1); f.self[leaf] = (f.self[leaf] ?? 0) + s.d; }
const grp = (fs_, label) => { if (!fs_.length) return; const acc = {}, sacc = {}; for (const f of fs_) { for (const k in f.incl) acc[k] = (acc[k] ?? 0) + f.incl[k]; for (const k in f.self) sacc[k] = (sacc[k] ?? 0) + f.self[k]; }
  console.log(`\n== ${label}: ${fs_.length} frames, mean ${(fs_.reduce((a, f) => a + f.dur, 0) / fs_.length).toFixed(1)} ms`); const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(v / fs_.length).toFixed(2).padStart(7)} ${k}`).join('\n'); console.log('incl:\n' + top(acc, Number(process.argv[4] ?? 45))); console.log('self:\n' + top(sacc, 18)); };
grp(frames.filter(f => f.dur >= TH), `SPIKE frames >= ${TH} ms`); grp(frames.filter(f => f.dur < TH), `normal frames < ${TH} ms`);
console.log('\nspike indexes:', frames.map((f, i) => f.dur >= TH ? i : -1).filter(i => i >= 0).join(' '));
