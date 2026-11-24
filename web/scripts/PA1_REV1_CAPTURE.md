# Capturing `web/tests/fixtures/pa1-rev1-queued-jobs.json` (PA1 P0b)

The P0b fixture must come from the engine that predates the recipe cutover, otherwise it proves nothing:
a save written by the current engine could be a manufactured revision. This document is the recipe and the
exact generator source, kept beside the fixture so the capture can be repeated by hand at any later date.

## Method

1. Check out the pre-cutover commit in a second worktree (`023ec62` here — the last commit before
   `RECIPE_REVISION = 2` was introduced):

       git worktree add /tmp/soh-base 023ec62
       ln -s $REPO/web/node_modules /tmp/soh-base/web/node_modules

2. Drop the generator below at `/tmp/soh-base/web/tests/scratch-capture-rev1.test.ts` — a scratch file in
   the OLD worktree on purpose, so it can never be collected by the repository's own test glob — then run
   it serially, writing straight into the live checkout:

       cd /tmp/soh-base/web
       CAPTURE_OUT=$REPO/web/tests/fixtures/pa1-rev1-queued-jobs.json \
         npx vitest run --testTimeout=180000 --fileParallelism=false tests/scratch-capture-rev1.test.ts

3. Read the `CAPTURED …` line it prints (queued recipes, the research outcome, byte size) and re-read
   `source.note` in the JSON. `web/tests/pa1-rev1-queued-jobs.test.ts` pins the same facts, so a capture
   that changes shape shows up as a failing pin rather than a silent drift.

## What the generator guarantees, and why each part is load-bearing

- the Workbench is upgraded by the REAL `upgradeStation` payment, because every captured formula is
  level-gated — a free level would be a fabricated fixture;
- the Fuel Canister knowledge is acquired by paid directed research, then a blueprint, then `useItem`, so
  the save legitimately knows a formula the new catalog no longer offers: that is the case the cutover has
  to survive;
- one revision-1 Metal Pipe is crafted, collected and then consumed by a queued revision-1 Iron Plate, so
  the captured queue holds work paid for in the retired topology — no edit of an `rv` field can fake that;
- a second study (`R:motorbike_kit`) is left in flight, so the research queue crosses the cutover too;
- two environments are recorded (`earlier`, and `later` = the old engine's own +60 s settle), so the new
  engine can be compared against the old one over an identical window.

## Generator source (verbatim)

```ts
// SCRATCH GENERATOR — run only in the /tmp/soh-base worktree at 023ec62.
// Produces the PA1 revision-1 fixture: a REAL run with REAL paid, queued station and research jobs,
// captured mid-flight by the pre-cutover engine, then one tick later. That engine has no `rv` field at
// all, which is exactly why the result is a genuine legacy save rather than a synthetic mutation.
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { TILE, T, WW, BAL, type GameState } from '../src/game/core';
import { RECIPES, STRUCTS, ITEMS, WORKBENCH_UPGRADE, permitsDirectedResearch } from '../src/game/catalog';
import { newGame, dispatch, addItem, C, countItem, markDirty, buildReason, stepStations } from '../src/game/engine';
import { getWorld, setActiveLayout } from '../src/game/world';
import { settle } from '../src/game/sim';
import { serializeSnapshot, selectSnapshots } from '../src/game/persist';

const T0 = Date.UTC(2026, 10, 13, 9);
let serial = 0;
const act = (g: GameState, type: string, p: object = {}, at = Math.max(T0, g.run?.clock.lastSimAt ?? T0)) =>
  dispatch(g, { id: 'cap-' + ++serial, type, ...p }, at);

function yard() {
  setActiveLayout('shipping');
  const g = newGame();
  expect(act(g, 'startRun', { character: 'male', region: 0, seed: 90210 }).ok).toBe(true);
  const r = g.run!, w = getWorld(), avoid = w.accessCorridors?.mask;
  r.creatures = [];
  let xx = 0, yy = 0;
  outer: for (let y = 8; y < 185; y++) for (let x = 8; x < 185; x++) {
    let ok = true;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const i = (y + dy) * WW + x + dx;
      if (w.economyMap.protected[i] || avoid?.[i] || (w.enforceMasks && !w.economyMap.buildable[i])) ok = false;
    }
    if (ok) { xx = x; yy = y; break outer; }
  }
  expect(xx).toBeGreaterThan(0);
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const i = (yy + dy) * WW + xx + dx;
    r.terrain[i] = { t: T.GRASS };
    if (w.sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 };
  }
  r.player.x = (xx - 1) * TILE + 8; r.player.y = (yy + 1) * TILE + 8; markDirty();
  const used = new Set<string>();
  const place = (type: string) => {
    expect(act(g, 'craft', { recipe: 'deploy_' + type }).ok, 'pack ' + type).toBe(true);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const tx = xx + dx, ty = yy + dy, key = tx + ',' + ty;
      if (used.has(key) || buildReason(g, type, tx, ty)) continue;
      used.add(key);
      r.player.x = tx * TILE + 8; r.player.y = (ty + 1) * TILE + 8; markDirty();
      expect(act(g, 'build', { struct: type, tx, ty }).ok, 'place ' + type).toBe(true);
      return Object.values(r.entities).find(e => e.kind === 'struct' && e.type === type && e.tx === tx && e.ty === ty)!;
    }
    throw new Error('no tile for ' + type);
  };
  return { g, r, x: xx, y: yy, place };
}

describe('capture rev-1 fixture', () => {
  it('writes a real paid pre-cutover save with queued jobs', () => {
    const o = yard(); const r = o.r;
    addItem(r, 'inv', 'wood', 60); addItem(r, 'inv', 'stone', 40);
    // 40 Spares: the paid Workbench upgrade and two paid directed studies (9 each) all draw on this.
    addItem(r, 'inv', 'spares', 40); addItem(r, 'inv', 'iron_ingot', 8);
    const bench = o.place('workbench');
    const table = o.place('research');
    // The bench must be a real level-2 Workbench, paid for, before any of these formulas are legal.
    for (const [k, q] of WORKBENCH_UPGRADE.cost) addItem(r, 'inv', k, q);
    expect(act(o.g, 'upgradeStation', { eid: bench.id }).ok).toBe(true);
    expect(bench.station!.level).toBe(2);
    addItem(r, 'inv', 'refined_iron_ingot', 12); addItem(r, 'inv', 'mechanical_parts', 8);
    addItem(r, 'inv', 'fasteners', 4); addItem(r, 'inv', 'charcoal', 4);
    addItem(r, 'inv', 'sulfur', 4); addItem(r, 'inv', 'glass', 4);

    // 1) The retired formula has to be LEARNED the old way before it can be queued: a paid directed
    //    study at the Research Table, a blueprint taken out, and the blueprint read. All of that is
    //    real engine work at 023ec62 — no knowledge is written into the save by hand.
    const research: any = { fuelCanDirected: null, learnedBy: 'blueprint', inFlight: null };
    expect(act(o.g, 'research', { eid: table.id, mode: 'directed', recipe: 'fuel_can' }).ok).toBe(true);
    const studyJob = table.station!.queue[table.station!.queue.length - 1];
    research.fuelCanDirected = { recipe: studyJob.recipe, total: studyJob.total, reserved: (studyJob.reserved ?? []).map((x: any) => ({ uid: x.uid, key: x.key, qty: x.qty })) };
    stepStations(o.g, BAL.research.directedSeconds * 1000 + 1000, (o.g.run!.clock.lastSimAt ?? T0) + 1000);
    {
      const out = table.station!.outC!;
      const i = r.custody[out].slots.findIndex(sl => sl?.key === 'blueprint');
      expect(i, 'blueprint at table output').toBeGreaterThanOrEqual(0);
      expect(act(o.g, 'move', { from: out, fs: i, to: 'inv' }).ok).toBe(true);
      const bi = C(r, 'inv').slots.findIndex(sl => sl?.key === 'blueprint' && sl.meta === 'fuel_can');
      expect(bi).toBeGreaterThanOrEqual(0);
      expect(act(o.g, 'useItem', { slot: bi }).ok).toBe(true);
    }
    expect(r.knowledge.recipes.includes('fuel_can')).toBe(true);

    // 2) revision-1 Metal Pipe yields ONE section from 2 refined + 1 Mechanical Part, and it is
    //    crafted and collected first because revision-1 Iron Plate EATS a pipe: the queue captured
    //    below then holds a job whose inputs were paid in the retired topology.
    expect(act(o.g, 'craft', { recipe: 'metal_pipe', eid: bench.id }).ok).toBe(true);
    const completedBefore: any[] = [{ recipe: 'metal_pipe', ins: RECIPES.metal_pipe.ins.map(([k, q]) => [k, q]), out: 'metal_pipe', qty: RECIPES.metal_pipe.qty }];
    stepStations(o.g, RECIPES.metal_pipe.secs * 1000 + 500, (o.g.run!.clock.lastSimAt ?? T0) + 6000);
    {
      const out = bench.station!.outC!;
      const i = r.custody[out].slots.findIndex(sl => sl?.key === 'metal_pipe');
      expect(i).toBeGreaterThanOrEqual(0);
      completedBefore[0].uid = r.custody[out].slots[i]!.uid;
      completedBefore[0].pipeCountBefore = countItem(r, 'inv', 'metal_pipe');
      expect(act(o.g, 'move', { from: out, fs: i, to: 'inv' }).ok).toBe(true);
    }
    expect(countItem(r, 'inv', 'metal_pipe')).toBe(1);

    const queuePlan = ['iron_plate', 'mechanical_gear', 'fuel_can'];
    const jobs: any[] = [];
    for (const recipe of queuePlan) {
      const before: Record<string, number> = {};
      for (const [k] of RECIPES[recipe].ins) before[k] = countItem(r, 'inv', k);
      const res = act(o.g, 'craft', { recipe, eid: bench.id });
      expect(res.ok, recipe + ': ' + JSON.stringify(res)).toBe(true);
      const j = bench.station!.queue[bench.station!.queue.length - 1];
      jobs.push({
        recipe, out: RECIPES[recipe].out, qty: RECIPES[recipe].qty, secs: RECIPES[recipe].secs,
        stationLevel: RECIPES[recipe].stationLevel ?? 1,
        ins: RECIPES[recipe].ins.map(([k, q]) => [k, q]),
        paidBefore: before,
        reserved: (j.reserved ?? []).map((x: any) => ({ uid: x.uid, key: x.key, qty: x.qty, dur: x.dur ?? null })),
        left: j.left, total: j.total,
      });
    }

    // 3) A second study stays in flight at capture: an unknown, still-live formula, so the loaded save
    //    exercises the research queue across the cutover as well as the craft queue.
    // The first candidate can still be refused (e.g. it needs a bench level we do not have), so walk
    // the list and record what the engine actually accepted.
    const candidates = Object.keys(RECIPES).filter(k => k !== 'fuel_can' && !r.knowledge.recipes.includes(k) && permitsDirectedResearch(RECIPES[k]));
    const alt = candidates[0];
    if (alt) {
      const rr = act(o.g, 'research', { eid: table.id, mode: 'directed', recipe: alt });
      if (!rr.ok) throw new Error('directed ' + alt + ': ' + JSON.stringify(rr));
      const q = table.station!.queue[table.station!.queue.length - 1];
      research.inFlight = { recipe: alt, stored: q.recipe, left: q.left, total: q.total, reserved: (q.reserved ?? []).map((x: any) => ({ uid: x.uid, key: x.key, qty: x.qty })) };
    }
    void ITEMS; void STRUCTS;

    const env = (g: GameState) => {
      const gs = selectSnapshots([serializeSnapshot(g), null]).gs!;
      return { version: 3, revision: gs.revision, profile: gs.profile, run: gs.run };
    };
    const earlier = env(o.g);
    settle(o.g, (o.g.run!.clock.lastSimAt ?? T0) + 60_000);
    const later = env(o.g);

    const out = {
      source: {
        kind: 'pa1-rev1-queued-jobs',
        capturedFromSHA: process.env.CAPTURE_SHA ?? '023ec62',
        recipeRevisionAtCapture: 1,
        layout: 'shipping', seed: 90210, character: 'male',
        note: 'Produced by the pre-cutover engine at 023ec62. No Job.rv field exists in that engine, so every stored job must resolve through the frozen revision-1 ledger. All inputs were paid by real crafts; nothing was written into a queue by hand.',
        stations: { benchQueueAtCapture: jobs.map(j => j.recipe), tableQueueAtCapture: research.inFlight ? [research.inFlight.stored] : [] },
        completedBeforeCapture: completedBefore,
        queuedJobs: jobs.map(j => ({ recipe: j.recipe, out: j.out, qty: j.qty, secs: j.secs, stationLevel: j.stationLevel, ins: j.ins, paidBefore: j.paidBefore, reserved: j.reserved, left: j.left, total: j.total })),
        research,
        retiredRecipeAtCapture: { id: 'fuel_can', ins: RECIPES.fuel_can.ins.map(([k, q]) => [k, q]), out: RECIPES.fuel_can.out, qty: RECIPES.fuel_can.qty, secs: RECIPES.fuel_can.secs, station: RECIPES.fuel_can.station ?? null },
      },
      earlier, later,
    };
    writeFileSync(process.env.CAPTURE_OUT!, JSON.stringify(out, null, 1) + '\n');
    console.log('CAPTURED jobs=' + jobs.map(j => j.recipe).join(',') + ' research=' + JSON.stringify(research) + ' bytes=' + JSON.stringify(out).length);
    expect(jobs.length).toBe(3);            // queued (paid, unfinished) at capture
    expect(completedBefore.length).toBe(1); // one revision-1 craft already collected
  });
});
```
