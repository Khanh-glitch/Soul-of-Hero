
// Which work makes the long frames long. node causes.mjs <dir> <phase> [thresholdMs]
import fs from 'node:fs'; const dir = process.argv[2], ph = process.argv[3], TH = Number(process.argv[4] ?? 25);
const R = JSON.parse(fs.readFileSync(`${dir}/phase-${ph}.json`)), P = JSON.parse(fs.readFileSync(`${dir}/phase-${ph}.cpuprofile`));
const byId = new Map(P.nodes.map(n => [n.id, n])); const parent = new Map(); for (const n of P.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const CATS = [['region compile', /^compileCanonicalGeometryRegion$|^getWindowWorld$|^compileCanonicalTerrainRegion$/], ['autosave', /^saveDetailed$|^saveSync$|^save$/], ['route search', /^route$|^humanRouteToAdjacent$/], ['resident needs', /^tickNeeds$/], ['resident planning/other', /^stepHumans$/], ['resident deadlines', /^humanEventBoundary$/], ['other world step', /^advanceWorld$|^syncWorld$/], ['draw', /^draw$/], ['GC', /^\(garbage collector\)$/], ['React UI', /^performWorkUntilDeadline$/], ['player/creatures', /^tick$/]];
const catOf = new Map(); const cat = id => { if (catOf.has(id)) return catOf.get(id); const st = []; for (let c = id; c !== undefined; c = parent.get(c)) st.push(byId.get(c).callFrame.functionName); let r = 'other'; for (const [name, re] of CATS) if (st.some(f => re.test(f))) { r = name; break; } catOf.set(id, r); return r; };
let t = P.startTime; const samples = P.samples.map((id, i) => { t += P.timeDeltas[i]; return { id, t: t / 1000, d: (P.timeDeltas[i + 1] ?? 0) / 1000 }; });
const first = samples.find(s => { for (let c = s.id; c !== undefined; c = parent.get(c)) if (byId.get(c).callFrame.functionName === 'loop') return true; return false; }); const off = first.t - R.pstarts[0];
const frames = R.pstarts.map((s, i) => ({ s: s + off, e: s + off + R.pseries[i], dur: R.pseries[i], c: {} })); let fi = 0;
for (const s of samples) { while (fi < frames.length - 1 && s.t >= frames[fi].e) fi++; const f = frames[fi]; if (s.t < f.s || s.t >= f.e) continue; const k = cat(s.id); f.c[k] = (f.c[k] ?? 0) + s.d; }
const long = frames.filter(f => f.dur >= TH), all = {}, lng = {}, dom = {}; for (const f of frames) for (const k in f.c) all[k] = (all[k] ?? 0) + f.c[k];
for (const f of long) { for (const k in f.c) lng[k] = (lng[k] ?? 0) + f.c[k]; const d = Object.entries(f.c).sort((a, b) => b[1] - a[1])[0]?.[0]; dom[d] = (dom[d] ?? 0) + 1; }
console.log(`frames ${frames.length}; mean ${(frames.reduce((a, f) => a + f.dur, 0) / frames.length).toFixed(2)} ms; long (>=${TH} ms): ${long.length}, worst ${Math.max(...frames.map(f => f.dur)).toFixed(0)} ms, time lost in long frames ${long.reduce((a, f) => a + f.dur, 0).toFixed(0)} ms`);
console.log('category'.padEnd(26), 'ms/frame(all)', ' ms total in long frames', ' long frames it dominates');
for (const k of Object.keys(all).sort((a, b) => all[b] - all[a])) console.log(k.padEnd(26), (all[k] / frames.length).toFixed(2).padStart(10), String(Math.round(lng[k] ?? 0)).padStart(18), String(dom[k] ?? 0).padStart(18));
console.log('worst 8:', [...frames].sort((a, b) => b.dur - a.dur).slice(0, 8).map(f => `${f.dur.toFixed(0)}ms[` + Object.entries(f.c).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ') + ']').join('  '));
