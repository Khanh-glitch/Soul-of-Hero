// PA1 P0b — a PRE-CUTOVER save, loaded by the CURRENT engine.
//
// The fixture in tests/fixtures/pa1-rev1-queued-jobs.json was captured by the engine at 023ec62, BEFORE
// the recovered-paper recipe cutover. It is not a hand-written save and no `rv` field was manufactured:
// that engine has no `rv` field at all, every input was paid by a real craft, and one already-collected
// revision-1 Metal Pipe is eaten by a queued revision-1 Iron Plate. So this file is the P0 gate: what an
// actual player's unfinished work does when the ledger under it changes.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { RECIPES, ITEMS, RETIRED_RECIPES, RECIPE_REVISION, recipeForJob } from '../src/game/catalog';
import { LEGACY_RECIPES, PRE_STAMPING_REVISION } from '../src/game/recipe-migration';
import { migrate, selectSnapshots, serializeSnapshot } from '../src/game/persist';
import { wreckEconomy } from '../src/game/wreck-economy';
import { setActiveLayout } from '../src/game/world';
import { settle } from '../src/game/sim';
import { dispatch, countItem, C, markDirty, addItem } from '../src/game/engine';
import type { GameState, Stack } from '../src/game/core';

const FX = JSON.parse(readFileSync(new URL('./fixtures/pa1-rev1-queued-jobs.json', import.meta.url), 'utf8')) as {
  source: any;
  earlier: any;
  later: any;
};

let serial = 0;
const act = (g: GameState, type: string, p: object = {}) =>
  dispatch(g, { id: 'rev1-' + ++serial, type, ...p }, Math.max(Date.now(), g.run!.clock.lastSimAt + 1));

/** The production load path: the same selectSnapshots a restart uses (quarantine + revision migration). */
function loadPack(snapshot: string): GameState {
  const picked = selectSnapshots([null, snapshot]);
  if (!picked.gs) throw new Error('fixture refused by the loader: ' + JSON.stringify(picked).slice(0, 300));
  // …then the same post-selection steps the real restart does: migrate, pin the wreck economy, adopt the layout.
  const m = migrate(picked.gs);
  if (!m.gs) throw new Error('migrate refused the pre-cutover save');
  const gs = m.gs;
  if (!gs.run!.wreckEconomy) gs.run!.wreckEconomy = wreckEconomy(gs.run!);
  setActiveLayout(gs.run!.layoutId ?? 'shipping');
  return gs;
}
const load = (env: any) => loadPack(JSON.stringify(env));

const benchOf = (g: GameState) => Object.values(g.run!.entities).find(e => e.type === 'workbench' && e.station)!;
const tableOf = (g: GameState) => Object.values(g.run!.entities).find(e => e.type === 'research' && e.station)!;
const beside = (g: GameState, e: any) => {
  const r = g.run!;
  r.player.x = e.tx * 16 + 8; r.player.y = (e.ty + 1) * 16 + 8; markDirty();
};
const outKeys = (g: GameState, e: any) =>
  C(g.run!, e.station!.outC).slots.filter(Boolean).map((s: Stack) => `${s.qty}x${s.key}`).sort();
const tick = (g: GameState, ms: number) => settle(g, (g.run!.clock.lastSimAt ?? 0) + ms);
/** Move every queued job's own duration, so each one finishes exactly as it would have. */
const finishAll = (g: GameState, e: any) => {
  const total = e.station!.queue.reduce((a: number, j: any) => a + j.left, 0);
  tick(g, total + 5_000);
};
const stackOf = (r: any, uid: string): Stack | null => {
  for (const c of Object.values(r.custody) as any[]) { const s = c.slots.find((x: any) => x?.uid === uid); if (s) return s as Stack; }
  return null;
};
const holdsUid = (r: any, uid: string) => Object.values(r.custody).some((c: any) => c.slots.some((x: any) => x?.uid === uid));
const spend = (g: GameState, rows: [string, number][]) => {
  for (const [k, n] of rows) {
    let left = n;
    const c = C(g.run!, 'inv');
    for (let i = 0; i < c.slots.length && left > 0; i++) {
      const s = c.slots[i];
      if (!s || s.key !== k) continue;
      const take = Math.min(left, s.qty);
      s.qty -= take; left -= take;
      if (s.qty <= 0) c.slots[i] = null;
    }
  }
};

describe('PA1 P0b — the pre-cutover save keeps its own rules', () => {
  it('is a real capture from before the cutover, not a manufactured revision', () => {
    expect(FX.source.capturedFromSHA).toMatch(/^[0-9a-f]{7,40}$/);
    expect(FX.source.recipeRevisionAtCapture).toBe(PRE_STAMPING_REVISION);
    expect(FX.source.note).toMatch(/pre-cutover/i);
    expect(FX.source.note).toMatch(/023ec62/);
    // The rev-1 engine had no per-job stamp: nothing in the save may carry one.
    expect(JSON.stringify(FX.earlier.run)).not.toMatch(/"rv"/);
    expect(FX.earlier.run.recipeRevision).toBeUndefined();
    // …and the queue it captured is the paid, unfinished work we claim it is.
    expect(FX.source.stations.benchQueueAtCapture).toEqual(['iron_plate', 'mechanical_gear', 'fuel_can']);
    expect(FX.source.stations.tableQueueAtCapture).toEqual(['R:motorbike_kit']);
    const bench = FX.earlier.run.entities[Object.keys(FX.earlier.run.entities).find((k) => FX.earlier.run.entities[k].type === 'workbench')!];
    expect(bench.station.queue.map((j: any) => j.recipe)).toEqual(['iron_plate', 'mechanical_gear', 'fuel_can']);
    expect(bench.station.level).toBe(2); // the paid level-2 bench, upgraded by the old rules
  });

  it('the paid inputs ARE the retired bill of materials, and the live table is different', () => {
    const seen: Record<string, [string, number][]> = {};
    for (const j of FX.source.queuedJobs) seen[j.recipe] = j.ins;
    for (const id of ['iron_plate', 'mechanical_gear', 'fuel_can']) {
      const frozen = LEGACY_RECIPES[id + '@' + PRE_STAMPING_REVISION];
      expect(frozen, `rev-${PRE_STAMPING_REVISION} ${id} must be frozen`).toBeTruthy();
      expect(seen[id], `${id} paid BOM`).toEqual(frozen.ins);
      // Un-stamped (the whole point): the ledger, not the live table, prices this save's work.
      expect(recipeForJob(id, undefined)).toBe(frozen);
    }
    // Corrected formulas are still live, at a DIFFERENT bill; the improvised one is gone.
    expect(RECIPES.iron_plate).toBeTruthy();
    expect(RECIPES.mechanical_gear).toBeTruthy();
    expect(RECIPES.fuel_can, 'fuel_can must not be craftable any more').toBeUndefined();
    // Iron Plate: the save paid a pipe; the approved rule pays fasteners instead.
    expect(seen.iron_plate).toContainEqual(['metal_pipe', 1]);
    expect(RECIPES.iron_plate.ins).toEqual([['refined_iron_ingot', 2], ['fasteners', 1]]);
    expect(RECIPES.iron_plate.ins).not.toEqual(seen.iron_plate);
    // Mechanical Gear: the save paid 2 iron ingots; the approved rule needs a refined one.
    expect(seen.mechanical_gear).toEqual([['iron_ingot', 2], ['mechanical_parts', 2], ['fasteners', 1]]);
    expect(RECIPES.mechanical_gear.ins).toEqual([['refined_iron_ingot', 1], ['iron_ingot', 1], ['mechanical_parts', 2], ['fasteners', 1]]);
    // Fuel Canister is retired outright.
    expect(RETIRED_RECIPES).toContain('fuel_can');
    expect(seen.fuel_can).toEqual([['charcoal', 1], ['sulfur', 1], ['glass', 1]]);
    // The one job the capture collected before saving used the two-input rev-1 pipe.
    expect(FX.source.completedBeforeCapture[0].ins).toEqual([['refined_iron_ingot', 2], ['mechanical_parts', 1]]);
    expect(RECIPES.metal_pipe.qty).toBe(2); // rev 2: the same bill now yields two sections
  });

  it('loads with three un-stamped jobs and the exact stacks the save reserved', () => {
    const g = load(FX.earlier);
    const bench = benchOf(g);
    expect(bench.station!.queue.map((j: any) => j.recipe)).toEqual(['iron_plate', 'mechanical_gear', 'fuel_can']);
    // The loader must NOT stamp old jobs with the new revision: that would silently re-price them.
    for (const j of bench.station!.queue) expect((j as any).rv).toBeUndefined();
    // Pricing comes from the job, never from a run-level stamp — and there is no such stamp to drift.
    expect((g.run as unknown as { recipeRevision?: unknown }).recipeRevision).toBeUndefined();
    // The retired formula is taken out of knowledge and counted, so the UI can say so out loud.
    expect(g.run!.knowledge.recipes).not.toContain('fuel_can');
    expect(g.run!.migrated?.retiredRecipes).toBe(1);
    // The revision ledger is what prices them.
    expect(recipeForJob('iron_plate', undefined)!.ins).toEqual(LEGACY_RECIPES['iron_plate@1'].ins);
    expect(recipeForJob('fuel_can', undefined)!.ins).toEqual(LEGACY_RECIPES['fuel_can@1'].ins);
    // Reserved custody is the same physical stock, uid for uid.
    const pipe = FX.source.queuedJobs[0].reserved.find((s: any) => s.key === 'metal_pipe');
    expect(pipe.uid).toBe(FX.source.completedBeforeCapture[0].uid); // the pipe this save just made
    const reserved = bench.station!.queue[0].reserved!.map((s) => s.uid);
    expect(reserved).toEqual(FX.source.queuedJobs[0].reserved.map((s: any) => s.uid));
    // The save's own study receipt survives in its ledger even though the formula is gone from
    // knowledge: nothing is silently erased, it is pruned once and flagged.
  });

  it('queued work finishes at the price it paid, including the retired formula', () => {
    const g = load(FX.earlier);
    const bench = benchOf(g);
    const r = g.run!;
    // Inputs were paid when the old engine queued the jobs, so finishing must move NOTHING out of
    // the pack: the only change is product appearing in the station output.
    const invBefore = C(r, 'inv').slots.filter(Boolean).map((x) => `${x.qty}x${x.key}`).sort();
    finishAll(g, bench);
    expect(outKeys(g, bench)).toEqual(['1xfuel_can', '1xmechanical_gear', '2xiron_plate']);
    expect(C(r, 'inv').slots.filter(Boolean).map((x) => `${x.qty}x${x.key}`).sort()).toEqual(invBefore);
    beside(g, bench);
    for (let i = 0; i < 3; i++) {
      const slot = C(r, bench.station!.outC).slots.findIndex((x) => x);
      expect(slot, 'collect ' + i).toBeGreaterThanOrEqual(0);
      expect(act(g, 'move', { from: bench.station!.outC, fs: slot, to: 'inv' }).ok).toBe(true);
    }
    expect(countItem(r, 'inv', 'iron_plate')).toBe(2);          // rev-1 Iron Plate still yields two
    expect(countItem(r, 'inv', 'mechanical_gear')).toBe(1);
    expect(countItem(r, 'inv', 'fuel_can')).toBe(1);            // the retired formula still pays out
    expect(countItem(r, 'inv', 'metal_pipe')).toBe(0);          // rev-1 plate ate the section it reserved
    // Every reserved stack is gone: nothing was re-reserved and nothing was duplicated.
    for (const j of FX.source.queuedJobs) {
      for (const rs of j.reserved) expect(holdsUid(r, rs.uid), `${rs.key} uid ${rs.uid}`).toBe(false);
    }
    // The product is the same item the approved rule produces — only the bill differed.
    expect(recipeForJob('mechanical_gear', undefined)!.out).toBe(RECIPES.mechanical_gear.out);
    expect(C(r, bench.station!.outC).slots.filter(Boolean).length).toBe(0);
  });

  it('the retired formula pays out old work but never starts new work, and says so', () => {
    const g = load(FX.earlier);
    const bench = benchOf(g);
    const r = g.run!;
    beside(g, bench);
    // Knowledge is pruned and the item survives, so a naive "not learned" or "unknown recipe" is not
    // good enough: the refusal must name the retirement, and the sheet must be readable as retired too.
    expect(ITEMS.fuel_can).toBeTruthy();
    expect(ITEMS.fuel_can.fuel).toBeGreaterThan(0); // canisters still exist — they come from oil
    expect(RECIPES.fuel_can).toBeUndefined();
    const before = { charcoal: countItem(r, 'inv', 'charcoal'), sulfur: countItem(r, 'inv', 'sulfur'), glass: countItem(r, 'inv', 'glass') };
    const refused = act(g, 'craft', { recipe: 'fuel_can', eid: bench.id });
    expect(refused.ok).toBe(false);
    expect(String((refused as any).reason)).toMatch(/Retired by the Approved Ledger/);
    expect(String((refused as any).reason)).toMatch(/already paid for under the old rule still finishes/);
    expect(String((refused as any).reason)).not.toMatch(/Unknown recipe|Missing/);
    expect({
      charcoal: countItem(r, 'inv', 'charcoal'), sulfur: countItem(r, 'inv', 'sulfur'), glass: countItem(r, 'inv', 'glass'),
    }).toEqual(before);
    expect(bench.station!.queue.map((j: any) => j.recipe)).toEqual(['iron_plate', 'mechanical_gear', 'fuel_can']);
    // Research must not re-open it either.
    const study = act(g, 'research', { eid: tableOf(g).id, mode: 'directed', recipe: 'fuel_can' });
    expect(study.ok).toBe(false);
    expect(String((study as any).reason)).toMatch(/Retired by the Approved Ledger/);
    // A sheet of the retired drawing carried in from the old save is explained, never eaten.
    expect(addItem(r, 'inv', 'blueprint', 1, { meta: 'fuel_can' })).toBe(0); // addItem reports the LEFTOVER
    const slot = C(r, 'inv').slots.findIndex((x) => x?.key === 'blueprint' && x.meta === 'fuel_can');
    const read = act(g, 'useItem', { slot });
    expect(read.ok).toBe(false);
    expect(String((read as any).reason)).toMatch(/retired/i);
    expect(countItem(r, 'inv', 'blueprint')).toBe(1); // the paper survives; only the formula is gone
  });

  it('new work after the load is priced by the approved revision, and carries the stamp', () => {
    const g = load(FX.earlier);
    const bench = benchOf(g);
    const r = g.run!;
    finishAll(g, bench);
    beside(g, bench);
    if (!r.knowledge.recipes.includes('metal_pipe')) r.knowledge.recipes.push('metal_pipe');
    const refined = countItem(r, 'inv', 'refined_iron_ingot'), parts = countItem(r, 'inv', 'mechanical_parts');
    expect(act(g, 'craft', { recipe: 'metal_pipe', eid: bench.id }).ok).toBe(true);
    const job: any = bench.station!.queue[bench.station!.queue.length - 1];
    expect(job.rv).toBe(RECIPE_REVISION);            // new work declares its revision
    expect(countItem(r, 'inv', 'refined_iron_ingot')).toBe(refined - 2); // same bill as rev 1 ...
    expect(countItem(r, 'inv', 'mechanical_parts')).toBe(parts - 1);
    tick(g, job.total + 1000);
    expect(outKeys(g, bench)).toContain('2xmetal_pipe');   // ... but one paid cycle now yields TWO sections

    // The input-side correction, where it actually bites: an approved Iron Plate pays fasteners and
    // never eats a pipe section again, so a save with no pipes in the pack can still start the work.
    addItem(r, 'inv', 'refined_iron_ingot', 4); addItem(r, 'inv', 'fasteners', 2);
    if (!r.knowledge.recipes.includes('iron_plate')) r.knowledge.recipes.push('iron_plate');
    const pipesBefore = countItem(r, 'inv', 'metal_pipe');
    const again = act(g, 'craft', { recipe: 'iron_plate', eid: bench.id });
    expect(again.ok, 'rev-2 plate needs no pipe: ' + JSON.stringify(again)).toBe(true);
    const j2: any = bench.station!.queue[bench.station!.queue.length - 1];
    expect(j2.rv).toBe(RECIPE_REVISION);
    expect(j2.reserved!.some((x: Stack) => x.key === 'metal_pipe')).toBe(false);
    expect(countItem(r, 'inv', 'metal_pipe')).toBe(pipesBefore);
  });

  it('a cancelled revision-1 job returns the stacks it actually paid, not a revision-2 refund', () => {
    const g = load(FX.earlier);
    const bench = benchOf(g);
    const r = g.run!;
    const job: any = bench.station!.queue[0];
    expect(job.recipe).toBe('iron_plate');
    const paid = job.reserved.map((x: Stack) => `${x.uid}:${x.key}:${x.qty}`).sort();
    expect(act(g, 'cancelJob', { eid: bench.id, jobId: job.id }).ok).toBe(true);
    // The refund is the same physical stock, UID for UID — including the pipe the approved rule no longer
    // uses. A refund computed from today's BOM would hand back fasteners and lose this stack.
    for (const tag of paid) {
      const [uid, key, qty] = tag.split(':');
      const s2 = stackOf(r, uid);
      expect(s2, `${key} uid ${uid} came back`).toBeTruthy();
      expect(`${s2!.uid}:${s2!.key}:${s2!.qty}`).toBe(tag);
    }
    expect(countItem(r, 'inv', 'metal_pipe')).toBe(1);
    expect(bench.station!.queue.map((j: any) => j.recipe)).toEqual(['mechanical_gear', 'fuel_can']);
    // Cancelling spent nothing and produced nothing.
    expect(countItem(r, 'inv', 'iron_plate')).toBe(0);
  });

  it('rolling an old save back to its earlier copy keeps unfinished work unfinished', () => {
    // The capture recorded two environments: mid-flight, and the same run after the OLD engine's own
    // 60-second settle. A player restoring the older copy must land on the paid, unfinished queue.
    const forward = load(FX.later);
    expect(benchOf(forward).station!.queue).toHaveLength(0);
    expect(outKeys(forward, benchOf(forward))).toEqual(['1xfuel_can', '1xmechanical_gear', '2xiron_plate']);
    const back = load(FX.earlier);
    expect(benchOf(back).station!.queue.map((j: any) => j.recipe)).toEqual(['iron_plate', 'mechanical_gear', 'fuel_can']);
    // The loader picks the newer copy when both are offered, reports no conflict, and merges nothing.
    const picked = selectSnapshots([JSON.stringify(FX.earlier), JSON.stringify(FX.later)]);
    expect(picked.conflict).toBe(false);
    expect(picked.unsupported).toBe(false);
    expect(picked.gs!.revision).toBe(FX.later.revision);
    expect(C(picked.gs!.run!, benchOf(picked.gs!).station!.outC).slots.filter(Boolean).length).toBe(3);
    // Both copies still carry their own unfinished/paid shape untouched by being read.
    expect(JSON.stringify(FX.earlier.run)).not.toMatch(/"rv"/);
    // Neither copy hands out knowledge early: the older one still has the study in flight, and the
    // settled one produced a blueprint that only becomes knowledge when someone reads it.
    expect(back.run!.knowledge.recipes).not.toContain('motorbike_kit');
    expect(tableOf(back).station!.queue.map((j: any) => j.recipe)).toEqual(['R:motorbike_kit']);
    expect(C(forward.run!, tableOf(forward).station!.outC).slots.some((x) => x?.key === 'blueprint')).toBe(true);
  });

  it('the pre-cutover engine and this one agree on the same window', () => {
    const g = load(FX.earlier);
    const bench = benchOf(g), table = tableOf(g);
    tick(g, 60_000);
    const older = FX.later.run;
    const oldBench = Object.values(older.entities).find((e: any) => e.type === 'workbench')!;
    const oldTable = Object.values(older.entities).find((e: any) => e.type === 'research')!;
    expect(bench.station!.queue.length).toBe(oldBench.station.queue.length);
    expect(outKeys(g, bench)).toEqual(C(older, oldBench.station.outC).slots.filter(Boolean).map((s: Stack) => `${s.qty}x${s.key}`).sort());
    expect(outKeys(g, table)).toEqual(C(older, oldTable.station.outC).slots.filter(Boolean).map((s: Stack) => `${s.qty}x${s.key}`).sort());
    expect(older.knowledge.recipes).toContain('fuel_can');
  });

  it('two restarts mid-flight leave the same unfinished work, not a re-priced one', () => {
    const g = load(FX.earlier);
    tick(g, 20_000);
    const midway = serializeSnapshot(g);            // a real save written by the CURRENT engine
    const g2 = loadPack(midway);
    tick(g2, 20_000);
    const direct = load(FX.earlier);
    tick(direct, 40_000);
    const proj = (x: GameState) => {
      const b = benchOf(x);
      return JSON.stringify({
        queue: b.station!.queue.map((j: any) => [j.recipe, j.left, j.reserved!.map((s) => `${s.uid}:${s.key}:${s.qty}`)]),
        out: C(x.run!, b.station!.outC).slots.map((s) => (s ? `${s.uid}:${s.key}:${s.qty}` : null)),
        inv: C(x.run!, 'inv').slots.map((s) => (s ? `${s.uid}:${s.key}:${s.qty}` : null)),
        known: x.run!.knowledge.recipes.length,
      });
    };
    expect(proj(g2)).toBe(proj(direct));
    // The reloaded save must still be un-stamped: a restart never re-prices old work.
    for (const j of benchOf(g2).station!.queue) expect((j as any).rv).toBeUndefined();
  });
});
