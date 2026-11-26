// Absence benchmark: replays an absence of a saved run headless, exactly as the Continue worker does, and prints
// time, counters and SHA-256 fingerprints of the settled save and of the return report.
//
//   scripts/absence-bench/build.sh <name>          build this file against the current working tree
//   cd node_modules/.sim/<name> && node scn.js <seed> <hours> [work|dump <tag>|census <tag>]
//
// The first run for a seed creates node_modules/.sim/save-<seed>.json (a new run, played 20 s). Compiled regions are
// kept in node_modules/.sim/packs/, so later runs measure the simulation alone ("compiled 0").
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deserialize, serialize } from 'node:v8';
import { newGame, startRun, markDirty } from '../../src/game/engine';
import { settle } from '../../src/game/sim';
import { setActiveLayout } from '../../src/game/world';
import { settleWithReturn } from '../../src/game/return-report';
import { selectSnapshots, serializeSnapshot } from '../../src/game/persist';
import { measureWorldWork, profileWorldWork } from '../../src/game/world-work';
import { compileGeometryRegionPack, getWindowWorld, setPrebuiltRegionSource, type GeometryRegionPack } from '../../src/veyra05/window';
import { isVeyra05Layout } from '../../src/veyra05/scenes';
import { syncFloor } from '../../src/veyra05/floors';

const [seedArg, hoursArg, mode, tag] = process.argv.slice(2);
const seed = +seedArg, hours = +hoursArg, HOUR = 3600_000, T0 = Date.UTC(2026, 10, 15, 8);
const root = new URL('../', import.meta.url).pathname, packDir = root + 'packs/'; mkdirSync(packDir, { recursive: true });
let loaded = 0, compiled = 0, compileMs = 0, packBytes = 0;
setPrebuiltRegionSource((layoutId, rules) => {
  const file = `${packDir}${rules}-${layoutId.replace(/[^\w.-]/g, '_')}.bin`;
  if (existsSync(file) && !process.env.NOPACKS) { const b = readFileSync(file); packBytes += b.length; loaded++; return deserialize(b) as GeometryRegionPack; }
  const t = performance.now(), pack = compileGeometryRegionPack(layoutId, rules); compileMs += performance.now() - t; compiled++;
  const b = serialize(pack); packBytes += b.length; if (!process.env.NOPACKS) writeFileSync(file, b); return pack;
});
const saveFile = `${root}save-${seed}.json`;
if (!existsSync(saveFile)) {
  if (!setActiveLayout('veyra05-greywater')) throw Error('layout');
  const gs0 = newGame(); const rc = startRun(gs0, 'female', T0, null, seed, { tx: 100, ty: 100 }); if (!rc.ok) throw Error(JSON.stringify(rc));
  settle(gs0, T0 + 20000, true, false);
  writeFileSync(saveFile, serializeSnapshot(gs0));
}
const gs = selectSnapshots([readFileSync(saveFile, 'utf8')]).gs!;
const layout = gs.run!.layoutId ?? 'shipping'; if (!setActiveLayout(layout)) throw Error('Missing saved island.');
if (isVeyra05Layout(layout)) { const ww = getWindowWorld(layout); syncFloor(gs, ww, ww.floors, markDirty); }
const now = gs.run!.clock.lastSimAt + hours * HOUR;
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const cpu0 = process.cpuUsage().user, t0 = performance.now(); let extra = '';
let result: ReturnType<typeof settleWithReturn>;
if (mode === 'work') {
  const p = profileWorldWork(() => settleWithReturn(gs, now)); result = p.result;
  extra = `\n  slices ${p.counts.worldSlices} plannerActivations ${p.counts.plannerActivations} actorPlans ${p.counts.actorPlans}\n` +
    Object.entries(p.timings).sort((a, b) => b[1].ms - a[1].ms).slice(0, 14).map(([k, v]) => `  ${k} ${(v.ms / 1000).toFixed(1)}s/${v.calls}`).join('\n');
} else { const m = measureWorldWork(() => settleWithReturn(gs, now)); result = m.result; extra = ` slices ${m.counts.worldSlices} plans ${m.counts.actorPlans}`; }
const sec = (performance.now() - t0) / 1000, cpu = (process.cpuUsage().user - cpu0) / 1e6, snap = serializeSnapshot(gs);
console.log(`RESULT seed ${seed} hours ${hours} snapshot ${sha(snap)} report ${sha(JSON.stringify(result))} seconds ${sec.toFixed(1)} cpu ${cpu.toFixed(1)} regions loaded ${loaded} compiled ${compiled} (${(compileMs / 1000).toFixed(1)} s) pack MB ${(packBytes / 1e6).toFixed(1)}${extra}`);
if (mode === 'dump') { writeFileSync(`${root}dump-${tag}-${seed}-${hours}.json`, snap); writeFileSync(`${root}dump-${tag}-${seed}-${hours}.report.json`, JSON.stringify(result, null, 1)); }
if (mode === 'census') {
  // What a player could notice: who is alive, where, how fed, what they carry, what the stores hold.
  const r = gs.run!, hw = r.humanWorld!, people = Object.values(hw.people), sum: Record<string, number> = {}, states: Record<string, number> = {};
  const add = (k: string, n: number) => { sum[k] = (sum[k] ?? 0) + n; };
  type Held = { slots: ({ key: string; qty: number } | null)[]; kind: string };
  const custody = r.custody as unknown as Record<string, Held>, own = new Set<string>();
  for (const h of people) { states[h.state] = (states[h.state] ?? 0) + 1; own.add(h.inv.packId); own.add(h.inv.cartId); }
  // carried: what residents hold in pack and cart; stores: every other container, by item.
  const stores: Record<string, number> = {};
  for (const id in custody) for (const s of custody[id]?.slots ?? []) if (s) { if (own.has(id)) add(s.key, s.qty); else stores[s.key] = (stores[s.key] ?? 0) + s.qty; }
  const kinds: Record<string, number> = {}; for (const x of r.receipts ?? []) { const k = String((x as unknown as { kind?: string; k?: string }).kind ?? (x as unknown as { k?: string }).k ?? '?'); kinds[k] = (kinds[k] ?? 0) + 1; }
  const census = { states, residents: Object.fromEntries(people.map(h => [h.actorId, { state: h.state, gx: h.gx, gy: h.gy, floor: h.floor, hp: Math.round(h.hp), hunger: Math.round(h.hunger), thirst: Math.round(h.thirst), rest: +h.rest.toFixed(2), wounds: h.wounds.length, intent: h.intent?.kind ?? null }])), carried: sum, stores, receiptKinds: kinds, entities: Object.keys(r.entities).length, creatures: r.creatures.length, report: result };
  writeFileSync(`${root}census-${tag}-${seed}-${hours}.json`, JSON.stringify(census, null, 1));
}
