// Line-level self time from a .cpuprofile (positionTicks), mapped onto the unminified bundle.
import fs from 'node:fs';
const [file, bundle, frames = '1800', top = '30'] = process.argv.slice(2);
const prof = JSON.parse(fs.readFileSync(file, 'utf8')); const src = fs.readFileSync(bundle, 'utf8').split('\n');
const total = prof.endTime - prof.startTime, samples = prof.samples.length, per = total / samples / 1000;
const hits = new Map();
for (const n of prof.nodes) { if (!n.callFrame.url.includes('index-')) continue; for (const t of n.positionTicks ?? []) hits.set(t.line, (hits.get(t.line) ?? 0) + t.ticks); }
const rows = [...hits].sort((a, b) => b[1] - a[1]).slice(0, +top);
for (const [line, ticks] of rows) console.log((ticks * per / +frames).toFixed(3).padStart(7), String(line).padStart(7), (src[line - 1] ?? '').trim().slice(0, 150));
