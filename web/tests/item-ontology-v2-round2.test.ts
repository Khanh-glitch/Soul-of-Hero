// Item Ontology V2 — ROUND 2 acceptance (Control Tower ruling on PR #61): P1, P3 (frame only), P4, P5, P7 are LIVE.
//
// Evidence vocabulary (never mixed):
//   INTENT   = a real dispatch() the UI sends (craft, build, upgradeStation, recycleItem, split, move, cancelJob),
//              with real station time through stepStations and real save validation through persist.validate.
//   FIXTURE  = raw atoms granted with addItem, the actor placed beside a station, a recipe taught by pushing its id,
//              or a frozen recipe put back in the table for the single moment an "old save" is authored.
//   ANALYTIC = arithmetic over the recipe tables (no engine).
// Nothing here is a natural-play PASS: nobody walked to a wreck, opened a crate or fought anything. Source
// obtainability on the two live layouts is asserted separately from the graph projection (item-ontology-v2.test.ts).
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Entity, type GameState, type RunState, TILE } from '../src/game/core';
import { ITEMS, RECIPES, STRUCTS, WORKBENCH_UPGRADE, WORKBENCH_UPGRADE_III, recipeForJob, validateGameplayCatalog, type RecipeDef } from '../src/game/catalog';
import { C, addItem, buildReason, countItem, dispatch, markDirty, newGame, stepStations } from '../src/game/engine';
import { CUT_OVER_REVISIONS, LEGACY_RECIPES, RECIPE_REVISION, RETIRED_RECIPES, hasLegacyDefinition, latestLegacyDefinition, recipeAtRevision } from '../src/game/recipe-migration';
import { COMPONENT_RECIPES, componentRuleSnapshot, recoveryPlan, recoveryPlanFor } from '../src/game/recycler';
import { serializeSnapshot, validate } from '../src/game/persist';
import { setActiveLayout } from '../src/game/world';
import { itemClassLabel } from '../src/game/item-class';

const START = Date.UTC(2026, 10, 14, 6); let n = 0;
const WRITE = process.env.SOH_WRITE_ONTOLOGY === '1';
const OUT = resolve(__dirname, '../evidence/item-ontology-v2');
const REPORT: Record<string, unknown> = {};
afterEach(() => {
  setActiveLayout('shipping');
  // The frozen definitions are only ever put back for the moment an old save is authored.
  delete (RECIPES as Record<string, unknown>).vehicle_frame_piped;
  (RECIPES as Record<string, RecipeDef>).vehicle_frame = LIVE.vehicle_frame;
  (RECIPES as Record<string, RecipeDef>).industrial_axe = LIVE.industrial_axe;
});
const LIVE = { vehicle_frame: RECIPES.vehicle_frame, industrial_axe: RECIPES.industrial_axe };

const act = (g: GameState, type: string, p: object = {}, at = START) => dispatch(g, { id: 'v2r2-' + (++n), type, ...p } as never, at);
const why = (res: unknown) => (res as { reason?: string }).reason ?? '';
const place = (r: RunState, tx: number, ty: number) => { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; markDirty(); };
const raw = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload);
function start(seed = 303) {
  setActiveLayout('shipping_fresh'); const g = newGame();
  expect(act(g, 'startRun', { character: 'female', seed }).ok).toBe(true); g.run!.creatures = []; markDirty(); return g;
}
function legalTileNear(g: GameState, cx: number, cy: number, struct: string): [number, number] {
  const r = g.run!;
  for (let k = 1; k <= 14; k++) for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== k) continue;
    const tx = cx + dx, ty = cy + dy; place(r, tx - 1, ty); if (!buildReason(g, struct, tx, ty)) return [tx, ty];
  }
  throw new Error('no legal tile for ' + struct);
}
/** INTENT: hand-craft the packed device from its material list, then place it (PA1 device custody). */
function build(g: GameState, struct: string, at: number): Entity {
  const r = g.run!; const cx = Math.floor(r.player.x / TILE), cy = Math.floor(r.player.y / TILE);
  const pack = act(g, 'craft', { recipe: 'deploy_' + struct }, at - 1); expect(pack.ok, 'pack ' + struct + ': ' + why(pack)).toBe(true);
  const [tx, ty] = legalTileNear(g, cx, cy, struct);
  const res = act(g, 'build', { struct, tx, ty }, at); expect(res.ok, struct + ': ' + why(res)).toBe(true);
  return Object.values(r.entities).filter((e) => e.kind === 'struct' && e.type === struct).pop()!;
}
/** INTENT: queue one job, prove nothing is paid out early, finish it, move every output stack to the pack. */
function craftOut(g: GameState, st: Entity, recipe: string, at: number): number {
  const r = g.run!; const rc = RECIPES[recipe]; place(r, st.tx! - 1, st.ty!);
  const pre = act(g, 'craft', { eid: st.id, recipe }, at); expect(pre.ok, recipe + ': ' + why(pre)).toBe(true);
  const out = st.station!.outC!; const ms = rc.secs * 1000;
  expect(countItem(r, out, rc.out), recipe + ' paid early').toBe(0);
  stepStations(g, ms + 500, at + ms + 500);
  expect(countItem(r, out, rc.out), recipe + ' output').toBe(rc.qty);
  for (let guard = 0; guard < 6; guard++) {
    const i = r.custody[out].slots.findIndex((s) => s?.key === rc.out); if (i < 0) break;
    expect(act(g, 'move', { from: out, fs: i, to: 'inv' }, at + ms + 600 + guard).ok).toBe(true);
  }
  return at + ms + 1000;
}
const recyclerOf = (r: RunState) => Object.values(r.entities).find((e) => e.kind === 'recycler')!;
/** INTENT: feed one single-item stack to the Foundry Recycler. Returns the job without finishing it. */
function recycleStart(g: GameState, key: string, at: number) {
  const r = g.run!; const rc = recyclerOf(r); expect(rc).toBeDefined(); place(r, rc.tx!, rc.ty!);
  const slot = C(r, 'inv').slots.findIndex((s) => s?.key === key && s.qty === 1);
  if (slot < 0) return { ok: false as const, reason: 'no single ' + key, rc, uid: '' };
  const uid = C(r, 'inv').slots[slot]!.uid;
  const res = act(g, 'recycleItem', { eid: rc.id, slot, uid }, at);
  return { ok: res.ok, reason: why(res), rc, uid };
}
function splitOne(g: GameState, key: string, at: number) {
  const r = g.run!; const i = C(r, 'inv').slots.findIndex((s) => s?.key === key && s.qty > 1);
  if (i >= 0) expect(act(g, 'split', { c: 'inv', slot: i }, at).ok).toBe(true);
  // `split` halves; keep halving until a single exists.
  for (let guard = 0; guard < 6 && !C(r, 'inv').slots.some((s) => s?.key === key && s.qty === 1); guard++) {
    const j = C(r, 'inv').slots.findIndex((s) => s?.key === key && s.qty > 1); if (j < 0) break;
    expect(act(g, 'split', { c: 'inv', slot: j }, at + 1 + guard).ok).toBe(true);
  }
}
function collect(g: GameState, cid: string, at: number) {
  const r = g.run!;
  for (let guard = 0; guard < 8; guard++) {
    const i = r.custody[cid].slots.findIndex((s) => !!s); if (i < 0) break;
    expect(act(g, 'move', { from: cid, fs: i, to: 'inv' }, at + guard).ok).toBe(true);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ANALYTIC planner: expands a goal list to raw atoms with real batch sizes, shared leftovers and station seconds.
// The same walk can drive the engine (exec callback), so the analytic bill and the INTENT run cannot diverge.
// ─────────────────────────────────────────────────────────────────────────────────────────────
type Table = Record<string, RecipeDef>;
type Step = { kind: 'need'; item: string; qty: number } | { kind: 'spend'; label: string; cost: [string, number][] };
function plan(table: Table, steps: Step[], exec?: { craft(recipe: string): void; spend(label: string): void }) {
  const stock = new Map<string, number>(), atoms = new Map<string, number>(), crafts = new Map<string, number>();
  let secs = 0;
  const need = (item: string, qty: number): void => {
    const have = stock.get(item) ?? 0;
    if (have >= qty) { stock.set(item, have - qty); return; }
    const short = qty - have; const rc = table[item]?.out === item ? table[item] : null;
    if (!rc) { atoms.set(item, (atoms.get(item) ?? 0) + short); stock.set(item, 0); return; }
    const runs = Math.ceil(short / rc.qty);
    for (let k = 0; k < runs; k++) { for (const [i, q] of rc.ins) need(i, q); exec?.craft(item); }
    crafts.set(item, (crafts.get(item) ?? 0) + runs); secs += rc.secs * runs;
    stock.set(item, (stock.get(item) ?? 0) + runs * rc.qty - qty);
  };
  for (const s of steps) {
    if (s.kind === 'need') { need(s.item, s.qty); stock.set(s.item, (stock.get(s.item) ?? 0) + s.qty); }
    else { for (const [i, q] of s.cost) need(i, q); exec?.spend(s.label); }
  }
  const obj = (m: Map<string, number>) => Object.fromEntries([...m].filter(([, v]) => v > 0).sort(([a], [b]) => a.localeCompare(b)));
  return { atoms: obj(atoms), crafts: obj(crafts), leftovers: obj(stock), station_seconds: secs };
}
/** Bare hands → one packed Utility Motorbike. The two formulas a new run does not know (Forged Fasteners,
 *  Motorbike Kit) are paid for as directed studies at a real Research Table (9 Parts each). */
const MOTORBIKE_STEPS: Step[] = [
  { kind: 'need', item: 'deploy_workbench', qty: 1 }, { kind: 'spend', label: 'place:workbench', cost: [['deploy_workbench', 1]] },
  { kind: 'need', item: 'deploy_furnace', qty: 1 }, { kind: 'spend', label: 'place:furnace', cost: [['deploy_furnace', 1]] },
  { kind: 'spend', label: 'upgrade:2', cost: WORKBENCH_UPGRADE.cost },
  { kind: 'need', item: 'deploy_research', qty: 1 }, { kind: 'spend', label: 'place:research', cost: [['deploy_research', 1]] },
  { kind: 'spend', label: 'research:fasteners', cost: [['spares', 9]] },
  { kind: 'spend', label: 'research:motorbike_kit', cost: [['spares', 9]] },
  { kind: 'spend', label: 'upgrade:3', cost: WORKBENCH_UPGRADE_III.cost },
  { kind: 'need', item: 'motorbike_kit', qty: 1 },
];
const tableAt = (rev: number): Table => {
  const t: Table = {};
  for (const id of new Set([...Object.keys(RECIPES), ...Object.keys(LEGACY_RECIPES).map((k) => k.split('@')[0])])) {
    const rc = recipeAtRevision(id, rev, RECIPES as never); if (rc) t[id] = rc as RecipeDef;
  }
  return t;
};
const delta = (a: Record<string, number>, b: Record<string, number>) =>
  Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].sort().map((k) => [k, (b[k] ?? 0) - (a[k] ?? 0)]).filter(([, v]) => v !== 0));

describe('P1 + P7 — display language (no id, recipe, source or price moved)', () => {
  it('Parts and Machine Parts are two different names, icons and classes; the Vietnamese names are alias data', () => {
    expect(ITEMS.spares.name).toBe('Parts'); expect(ITEMS.spares.vi).toBe('Linh kiện');
    expect(ITEMS.mechanical_parts.name).toBe('Machine Parts'); expect(ITEMS.mechanical_parts.vi).toBe('Bộ phận máy');
    // Not "one word apart" only: different icon, different accent colour, different class chip.
    expect(ITEMS.spares.icon).not.toBe(ITEMS.mechanical_parts.icon);
    expect(ITEMS.spares.c2).not.toBe(ITEMS.mechanical_parts.c2);
    expect(itemClassLabel('spares', 'x')).not.toBe(itemClassLabel('mechanical_parts', 'x'));
    // Parts stays uncraftable; Machine Parts stays the same bench recipe.
    expect(Object.values(RECIPES).some((rc) => rc.out === 'spares' || rc.outs?.some(([k]) => k === 'spares'))).toBe(false);
    expect(RECIPES.mechanical_parts.ins).toEqual([['scrap', 2], ['iron_ingot', 1]]);
    expect(RECIPES.mechanical_parts.qty).toBe(2);
    // The description no longer implies one source: Parts come from loot AND the Recycler.
    expect(ITEMS.spares.desc).toMatch(/loot/i); expect(ITEMS.spares.desc).toMatch(/Recycler/);
    expect(ITEMS.spares.desc).toMatch(/Cannot be crafted/);
  });
  it('every item name is English; the seven settled Vietnamese names survive as `vi`', () => {
    const want: Record<string, [string, string]> = {
      core_blast: ['Big Bang', 'Vụ nổ lớn'], core_meteor: ['Meteor', 'Thiên thạch'], core_dragon: ["Dragon's Breath", 'Hơi thở của rồng'],
      core_elsa: ["Elsa's Sword", 'Gươm Elsa'], core_earthmother: ["Earth Mother's Breath", 'Hơi thở đất mẹ'], core_demon: ['Demon Core', 'Lõi quỷ'],
      escrow_chest: ['Escrow Chest', 'Rương ký gửi'],
    };
    for (const [id, [en, vi]] of Object.entries(want)) { expect(ITEMS[id].name, id).toBe(en); expect(ITEMS[id].vi, id).toBe(vi); }
    // eslint-disable-next-line no-control-regex
    for (const [id, d] of Object.entries(ITEMS)) expect(/^[\x00-\x7F]+$/.test(d.name), `${id}: ${d.name}`).toBe(true);
    for (const [id, d] of Object.entries(STRUCTS)) expect(/^[\x00-\x7F]+$/.test(d.name), `struct ${id}: ${d.name}`).toBe(true);
    // Creator Core mechanics are keyed by id / creatorCore, never by the display string.
    expect(ITEMS.core_blast.creatorCore).toBe('blast'); expect(ITEMS.core_demon.creatorCore).toBe('demon');
    expect(Object.values(ITEMS).filter((d) => d.creatorCore)).toHaveLength(7);
  });
});

describe('G — migration ledger: exactly one revision bump, history stored', () => {
  it('revision is 3; the three rev-2 definitions are frozen verbatim; the live catalog validates', () => {
    expect(RECIPE_REVISION).toBe(3);
    expect(CUT_OVER_REVISIONS[2]).toEqual(['vehicle_frame', 'vehicle_frame_piped', 'industrial_axe']);
    expect(Object.keys(LEGACY_RECIPES).filter((k) => k.endsWith('@2')).sort()).toEqual(['industrial_axe@2', 'vehicle_frame@2', 'vehicle_frame_piped@2']);
    expect(LEGACY_RECIPES['vehicle_frame@2'].ins).toEqual([['iron_ingot', 3], ['mechanical_parts', 2], ['spares', 2]]);
    expect(LEGACY_RECIPES['vehicle_frame@2'].secs).toBe(25);
    expect(LEGACY_RECIPES['vehicle_frame_piped@2'].ins).toEqual([['metal_pipe', 1], ['iron_ingot', 2], ['mechanical_parts', 2], ['spares', 2]]);
    expect(LEGACY_RECIPES['industrial_axe@2'].ins).toEqual([['iron_axe', 1], ['mechanical_parts', 2], ['spares', 2]]);
    // Rev-1 entries are untouched (never edit a frozen key).
    expect(Object.keys(LEGACY_RECIPES).filter((k) => k.endsWith('@1')).sort()).toEqual(['fuel_can@1', 'iron_plate@1', 'mechanical_gear@1', 'metal_pipe@1', 'motorbike_kit@1']);
    expect(RETIRED_RECIPES).toEqual(['fuel_can', 'vehicle_frame_piped']);
    expect(RECIPES.vehicle_frame_piped).toBeUndefined();
    expect(RECIPES.vehicle_frame.ins).toEqual(LEGACY_RECIPES['vehicle_frame_piped@2'].ins);   // the piped BOM IS the frame now
    expect(RECIPES.vehicle_frame.rev).toBe(3); expect(RECIPES.industrial_axe.rev).toBe(3);
    expect(validateGameplayCatalog()).toBe(true);
  });
  it('resolves every (recipe, revision) pair to the definition that was live then', () => {
    const plain = LEGACY_RECIPES['vehicle_frame@2'];
    expect(recipeForJob('vehicle_frame', 3)).toBe(RECIPES.vehicle_frame);
    expect(recipeForJob('vehicle_frame', 2)).toBe(plain);
    expect(recipeForJob('vehicle_frame', 1)).toBe(plain);          // unchanged by the rev-1 cutover → still its @2 definition
    expect(recipeForJob('vehicle_frame', undefined)).toBe(plain);  // pre-stamping save
    expect(recipeForJob('vehicle_frame_piped', 2)).toBe(LEGACY_RECIPES['vehicle_frame_piped@2']);
    expect(recipeForJob('vehicle_frame_piped', 1)).toBe(LEGACY_RECIPES['vehicle_frame_piped@2']);
    expect(recipeForJob('vehicle_frame_piped', 3)).toBeNull();     // retired: not live
    expect(recipeForJob('industrial_axe', 2)).toBe(LEGACY_RECIPES['industrial_axe@2']);
    expect(recipeForJob('industrial_axe', 3)).toBe(RECIPES.industrial_axe);
    // Rev-1 behaviour is exactly what it was.
    expect(recipeForJob('metal_pipe', 1)!.qty).toBe(1); expect(recipeForJob('metal_pipe', 2)!.qty).toBe(2); expect(recipeForJob('metal_pipe', 3)!.qty).toBe(2);
    expect(recipeForJob('fuel_can', 1)!.out).toBe('fuel_can'); expect(recipeForJob('fuel_can', 2)).toBeNull(); expect(recipeForJob('fuel_can', 3)).toBeNull();
    expect(recipeForJob('rope', 1)).toBe(RECIPES.rope); expect(recipeForJob('rope', 4)).toBeNull();
    expect(hasLegacyDefinition('vehicle_frame_piped')).toBe(true); expect(latestLegacyDefinition('vehicle_frame')).toBe(plain);
    // Untouched this round, by order: the two fluid machines.
    expect(STRUCTS.oil_pump.cost).toEqual([['iron_ingot', 3], ['mechanical_parts', 2], ['spares', 2], ['brick', 2]]);
    expect(STRUCTS.refinery.cost).toEqual([['iron_ingot', 4], ['mechanical_parts', 3], ['spares', 5], ['brick', 6], ['glass', 2]]);
  });

  it('a rev-2 save keeps its queued jobs, reserved UIDs, stock, crafted frames and a held retired blueprint (INTENT on FIXTURE stock)', () => {
    const g = start(); const r = g.run!;
    // ── author the OLD save: for this moment only the table is the rev-2 table ──
    (RECIPES as Table).vehicle_frame = LEGACY_RECIPES['vehicle_frame@2'] as RecipeDef;
    (RECIPES as Table).vehicle_frame_piped = LEGACY_RECIPES['vehicle_frame_piped@2'] as RecipeDef;
    (RECIPES as Table).industrial_axe = LEGACY_RECIPES['industrial_axe@2'] as RecipeDef;
    for (const [k, q] of [['wood', 40], ['stone', 10], ['iron_ingot', 12], ['mechanical_parts', 12], ['spares', 8], ['metal_pipe', 1], ['vehicle_frame', 1]] as const) expect(addItem(r, 'inv', k, q)).toBe(0);
    expect(addItem(r, 'inv', 'iron_axe', 1)).toBe(0);
    expect(addItem(r, 'inv', 'blueprint', 1, { meta: 'vehicle_frame_piped' })).toBe(0);
    r.knowledge.recipes.push('vehicle_frame_piped', 'industrial_axe'); markDirty();
    const bench = build(g, 'workbench', START + 10); place(r, bench.tx! - 1, bench.ty!);
    expect(act(g, 'upgradeStation', { eid: bench.id }, START + 20).ok).toBe(true);
    const axeUid = C(r, 'inv').slots.find((s) => s?.key === 'iron_axe')!.uid;
    const frameUid = C(r, 'inv').slots.find((s) => s?.key === 'vehicle_frame')!.uid;
    const bpUid = C(r, 'inv').slots.find((s) => s?.key === 'blueprint')!.uid;
    for (const recipe of ['vehicle_frame', 'vehicle_frame_piped', 'industrial_axe']) {
      const res = act(g, 'craft', { eid: bench.id, recipe }, START + 30); expect(res.ok, recipe + ': ' + why(res)).toBe(true);
    }
    const saved = raw(g);
    const q = saved.run.entities[bench.id].station.queue as { recipe: string; rv?: number; reserved: { uid: string; key: string; qty: number }[] }[];
    for (const j of q) j.rv = 2;                                   // what a rev-2 build stamped
    const reservedBefore = q.map((j) => j.reserved.map((s) => `${s.uid}:${s.key}:${s.qty}`).sort());
    expect(q.map((j) => j.recipe)).toEqual(['vehicle_frame', 'vehicle_frame_piped', 'industrial_axe']);
    expect(q[0].reserved.some((s) => s.key === 'metal_pipe')).toBe(false);     // the old plain frame never held a pipe
    const stockBefore = Object.fromEntries(['iron_ingot', 'mechanical_parts', 'spares', 'metal_pipe', 'vehicle_frame', 'wood'].map((k) => [k, countItem(r, 'inv', k)]));
    // ── the cutover lands ──
    delete (RECIPES as Record<string, unknown>).vehicle_frame_piped;
    (RECIPES as Table).vehicle_frame = LIVE.vehicle_frame; (RECIPES as Table).industrial_axe = LIVE.industrial_axe;

    const file = JSON.stringify(saved); const open = () => validate(JSON.parse(file))!;   // validate() adopts the object it is given
    const back = open(); expect(back, 'a rev-2 save must open at rev 3').not.toBeNull();
    const br = back.run!; const bb = br.entities[bench.id];
    // jobs, stamps and reserved custody are byte-identical
    expect(bb.station!.queue.map((j) => [j.recipe, j.rv])).toEqual([['vehicle_frame', 2], ['vehicle_frame_piped', 2], ['industrial_axe', 2]]);
    expect(bb.station!.queue.map((j) => j.reserved!.map((s) => `${s.uid}:${s.key}:${s.qty}`).sort())).toEqual(reservedBefore);
    expect(bb.station!.queue[2].reserved!.some((s) => s.uid === axeUid)).toBe(true);
    // stock, UIDs, metadata, bench level
    for (const [k, v] of Object.entries(stockBefore)) expect(countItem(br, 'inv', k), k).toBe(v);
    expect(C(br, 'inv').slots.find((s) => s?.uid === frameUid)?.key).toBe('vehicle_frame');
    const bp = C(br, 'inv').slots.find((s) => s?.uid === bpUid)!;
    expect(bp.key).toBe('blueprint'); expect(bp.meta).toBe('vehicle_frame_piped');     // the paper is a real item: kept
    expect(bb.station!.level).toBe(2);
    // knowledge: the retired id is pruned and reported; the frame itself is still known
    expect(br.knowledge.recipes).not.toContain('vehicle_frame_piped'); expect(br.knowledge.recipes).toContain('vehicle_frame');
    expect(br.migrated?.retiredRecipes).toBe(1);
    // new work under the retired id is refused BY NAME, not as "unknown recipe"
    place(br, bb.tx! - 1, bb.ty!);
    const again = act(back, 'craft', { eid: bb.id, recipe: 'vehicle_frame_piped' }, START + 40);
    expect(again.ok).toBe(false); expect(why(again)).toMatch(/Retired/); expect(why(again)).toMatch(/Utility Frame/);
    // the three paid jobs finish under the definitions they were paid under
    stepStations(back, 26_000, START + 30_000); stepStations(back, 23_000, START + 60_000); stepStations(back, 26_000, START + 90_000);
    expect(bb.station!.queue).toHaveLength(0);
    expect(countItem(br, bb.station!.outC, 'vehicle_frame')).toBe(2);
    expect(countItem(br, bb.station!.outC, 'industrial_axe')).toBe(1);
    expect(countItem(br, bb.station!.outC, 'metal_blade')).toBe(0);
    expect(validate(raw(back)), 'and the finished state saves again').not.toBeNull();
    // a second load is stable (restart twice)
    const twice = validate(raw(open()))!; expect(twice.run!.entities[bench.id].station!.queue.map((j) => j.rv)).toEqual([2, 2, 2]);

    // cancelling an old job instead returns exactly the stacks it reserved
    const other = open(); const or = other.run!; const ob = or.entities[bench.id]; place(or, ob.tx! - 1, ob.ty!);
    const ironBefore = countItem(or, 'inv', 'iron_ingot') + countItem(or, ob.station!.outC, 'iron_ingot');
    const cancel = act(other, 'cancelJob', { eid: ob.id, jobId: ob.station!.queue[0].id }, START + 50);
    expect(cancel.ok, why(cancel)).toBe(true);
    const ironAfter = countItem(or, 'inv', 'iron_ingot') + countItem(or, ob.station!.outC, 'iron_ingot');
    expect(ironAfter - ironBefore).toBe(3);                         // the rev-2 plain frame held 3 ingots, not 2
    expect(validate(raw(other))).not.toBeNull();
  });
});

describe('P3 — the Utility Frame takes a Metal Pipe (frame only)', () => {
  it('ANALYTIC: bare hands → one Utility Motorbike, material and station time before (rev 2) vs after (rev 3)', () => {
    const before = plan(tableAt(2), MOTORBIKE_STEPS), after = plan(tableAt(3), MOTORBIKE_STEPS);
    const d = { atoms: delta(before.atoms, after.atoms), crafts: delta(before.crafts, after.crafts), leftovers: delta(before.leftovers, after.leftovers), station_seconds: after.station_seconds - before.station_seconds };
    if (process.env.V2_DUMP) console.log(JSON.stringify({ before, after, d }));
    REPORT.motorbike = { scope: 'ANALYTIC. Sequential station seconds only (no walking, gathering or fuel). Fuel is measured in the INTENT run.', steps: MOTORBIKE_STEPS.map((s) => (s.kind === 'need' ? `need ${s.qty} ${s.item}` : `${s.label} ${JSON.stringify(s.cost)}`)), before_rev2: before, after_rev3: after, delta: d };
    // The route still closes on the same atom KINDS: nothing new or unobtainable became mandatory.
    expect(Object.keys(after.atoms).sort()).toEqual(Object.keys(before.atoms).sort());
    expect(Object.keys(after.atoms).sort()).toEqual(['coal', 'iron_ore', 'scrap', 'spares', 'stone', 'wood']);
    // Parts (the uncraftable resource) cost is unchanged — the pipe adds iron and coal only.
    expect(after.atoms.spares).toBe(before.atoms.spares);
    // One extra refined batch (3 ingots + 1 coal) and one extra Machine Parts batch (2 scrap + 1 ingot) for the pipe pair,
    // minus the one ingot the frame no longer takes: +3 ore, +1 coal, +2 scrap. A pipe and a Machine Part are left over.
    expect(d.atoms).toEqual({ coal: 1, iron_ore: 3, scrap: 2 });
    expect(d.crafts).toEqual({ iron_ingot: 3, mechanical_parts: 1, metal_pipe: 1, refined_iron_ingot: 1 });
    expect(d.leftovers).toEqual({ mechanical_parts: 1, metal_pipe: 1 });
    expect(d.station_seconds).toBe(77);                                 // 3×10 smelt + 20 refine + 12 parts + 18 pipe − 3 (frame 25 → 22)
    // Pinned totals so any later drift is a named change.
    expect(before.atoms).toEqual({ coal: 1, iron_ore: 29, scrap: 17, spares: 41, stone: 22, wood: 28 });
    expect(after.atoms).toEqual({ coal: 2, iron_ore: 32, scrap: 19, spares: 41, stone: 22, wood: 28 });
    expect(before.station_seconds).toBe(543); expect(after.station_seconds).toBe(620);
  });

  it('INTENT on FIXTURE atoms: the rev-3 chain runs end to end and consumes exactly the analytic bill', () => {
    const g = start(); const r = g.run!;
    const bill = plan(tableAt(3), MOTORBIKE_STEPS);
    const spares0 = countItem(r, 'inv', 'spares');
    for (const [k, q] of Object.entries(bill.atoms)) expect(addItem(r, 'inv', k, q), k).toBe(0);     // FIXTURE: atoms only
    const FUEL_WOOD = 24; expect(addItem(r, 'inv', 'wood', FUEL_WOOD)).toBe(0);                    // FIXTURE: furnace fuel, measured below
    let t = START + 100; let bench!: Entity, furnace!: Entity, table!: Entity; const log: string[] = [];
    plan(tableAt(3), MOTORBIKE_STEPS, {
      craft(recipe) {
        const rc = RECIPES[recipe]; log.push(recipe);
        if (!rc.station) { const res = act(g, 'craft', { recipe }, t); expect(res.ok, recipe + ': ' + why(res)).toBe(true); t += 1000; return; }
        t = craftOut(g, rc.station === 'furnace' ? furnace : bench, recipe, t);
      },
      spend(label) {
        log.push(label);
        const [kind, what] = label.split(':');
        if (kind === 'place') {
          const cx = Math.floor(r.player.x / TILE), cy = Math.floor(r.player.y / TILE);
          const [tx, ty] = legalTileNear(g, cx, cy, what);
          const res = act(g, 'build', { struct: what, tx, ty }, t); expect(res.ok, label + ': ' + why(res)).toBe(true);
          const e = Object.values(r.entities).filter((x) => x.kind === 'struct' && x.type === what).pop()!;
          if (what === 'workbench') bench = e; else if (what === 'furnace') {
            furnace = e; place(r, e.tx! - 1, e.ty!);
            const wi = C(r, 'inv').slots.findIndex((s) => s?.key === 'wood');
            expect(act(g, 'move', { from: 'inv', fs: wi, to: e.station!.fuelC, qty: FUEL_WOOD }, t + 1).ok).toBe(true);
          } else table = e;
          t += 1000;
        } else if (kind === 'upgrade') {
          place(r, bench.tx! - 1, bench.ty!);
          const res = act(g, 'upgradeStation', { eid: bench.id }, t); expect(res.ok, label + ': ' + why(res)).toBe(true);
          expect(bench.station!.level).toBe(Number(what)); t += 1000;
        } else {
          // research:<recipe> — a real directed study paid in Parts, then the blueprint is read.
          place(r, table.tx! - 1, table.ty!);
          expect(r.knowledge.recipes).not.toContain(what);
          const res = act(g, 'research', { eid: table.id, mode: 'directed', recipe: what }, t); expect(res.ok, label + ': ' + why(res)).toBe(true);
          stepStations(g, 46_000, t + 46_000); t += 47_000;
          collect(g, table.station!.outC, t); t += 100;
          const bi = C(r, 'inv').slots.findIndex((s) => s?.key === 'blueprint' && s.meta === what); expect(bi, what + ' blueprint').toBeGreaterThanOrEqual(0);
          const use = act(g, 'useItem', { c: 'inv', slot: bi }, t); expect(use.ok, 'read blueprint: ' + why(use)).toBe(true);
          expect(r.knowledge.recipes).toContain(what); t += 1000;
        }
      },
    });
    expect(countItem(r, 'inv', 'motorbike_kit')).toBe(1);
    expect(bench.station!.level).toBe(3);
    // every granted atom was consumed; what is left is exactly the analytic batch remainder
    for (const k of Object.keys(bill.atoms)) expect(countItem(r, 'inv', k) - (k === 'spares' ? spares0 : 0), 'atom left: ' + k).toBe(0);
    for (const [k, q] of Object.entries(bill.leftovers)) if (k !== 'motorbike_kit') expect(countItem(r, 'inv', k), 'leftover ' + k).toBe(q);
    expect(countItem(r, 'inv', 'metal_pipe')).toBe(1);                 // the second section of the pair
    const fuelLeft = countItem(r, furnace.station!.fuelC, 'wood');
    // the spare pipe is not waste: the Recycler takes it back for one refined ingot
    const rec = recycleStart(g, 'metal_pipe', t + 10); expect(rec.ok, rec.reason).toBe(true);
    stepStations(g, 11_000, t + 12_000); expect(countItem(r, rec.rc.station!.outC, 'refined_iron_ingot')).toBe(1);
    expect(validate(raw(g)), 'the finished run saves').not.toBeNull();
    REPORT.motorbike_intent_run = { scope: 'INTENT on FIXTURE atoms (shipping_fresh, seed 303). Not natural play.', rev: RECIPE_REVISION, intents: log.length, sequence: log, station_seconds_simulated: Math.round((t - START) / 1000), furnace_fuel_wood_granted: FUEL_WOOD, furnace_fuel_wood_left_in_slot: fuelLeft, kit: 1, leftover_metal_pipe_recycled_to: 'refined_iron_ingot x1' };
  });
});

describe('P4 — the Salvager Axe takes a Metal Blade', () => {
  const AXE_STEPS: Step[] = [
    { kind: 'need', item: 'deploy_workbench', qty: 1 }, { kind: 'spend', label: 'place:workbench', cost: [['deploy_workbench', 1]] },
    { kind: 'need', item: 'deploy_furnace', qty: 1 }, { kind: 'spend', label: 'place:furnace', cost: [['deploy_furnace', 1]] },
    { kind: 'spend', label: 'upgrade:2', cost: WORKBENCH_UPGRADE.cost },
    { kind: 'need', item: 'industrial_axe', qty: 1 },
  ];
  it('ANALYTIC: cost and time before vs after; the Blade needs nothing the old axe did not already need', () => {
    const before = plan(tableAt(2), AXE_STEPS), after = plan(tableAt(3), AXE_STEPS);
    const d = { atoms: delta(before.atoms, after.atoms), crafts: delta(before.crafts, after.crafts), leftovers: delta(before.leftovers, after.leftovers), station_seconds: after.station_seconds - before.station_seconds };
    REPORT.salvager_axe = { scope: 'ANALYTIC. `hide` is the raw atom behind the Iron Axe leather grip. Recipe knowledge for industrial_axe (tier 2) is unchanged and not priced here.', before_rev2: before, after_rev3: after, delta: d, blade: { recipe: RECIPES.metal_blade, station: 'workbench level 2 (same level the axe upgrade itself needs)', known_from_start: RECIPES.metal_blade.base === true } };
    // Blade: base knowledge, Workbench II, 16 s, 4 Iron Ingot + 1 Machine Part — the same bench level as the axe upgrade.
    expect(RECIPES.metal_blade.base).toBe(true);
    expect(RECIPES.metal_blade.stationLevel).toBe(RECIPES.industrial_axe.stationLevel);
    expect(RECIPES.metal_blade.ins).toEqual([['iron_ingot', 4], ['mechanical_parts', 1]]);
    expect(Object.keys(after.atoms).sort()).toEqual(Object.keys(before.atoms).sort());      // no new atom kind
    expect(after.atoms.spares).toBe(before.atoms.spares);                                    // Parts cost unchanged
    expect(d.atoms).toEqual({ iron_ore: 4 });                                               // exactly the blade's four ingots
    expect(d.crafts).toEqual({ iron_ingot: 4, metal_blade: 1 });
    expect(d.station_seconds).toBe(56);                                                     // 4×10 s smelt + 16 s blade
    expect(after.crafts.mechanical_parts).toBe(before.crafts.mechanical_parts);             // the swapped Part pays for the blade's Part
  });
  it('INTENT on FIXTURE atoms: blade is craftable before the axe; the old BOM is refused; the new one pays out', () => {
    const g = start(); const r = g.run!;
    const bill = plan(tableAt(3), AXE_STEPS); const spares0 = countItem(r, 'inv', 'spares');
    for (const [k, q] of Object.entries(bill.atoms)) expect(addItem(r, 'inv', k, q), k).toBe(0);
    expect(addItem(r, 'inv', 'wood', 12)).toBe(0);
    r.knowledge.recipes.push('industrial_axe'); markDirty();              // FIXTURE: tier-2 knowledge (unchanged by P4)
    let t = START + 100; let bench!: Entity, furnace!: Entity; let bladeAt = -1, axeAt = -1, i = 0;
    plan(tableAt(3), AXE_STEPS, {
      craft(recipe) {
        i++; const rc = RECIPES[recipe];
        if (recipe === 'industrial_axe') {
          axeAt = i;
          // With the blade in the pack the craft is accepted; first prove it is refused WITHOUT one.
          const bi = C(r, 'inv').slots.findIndex((s) => s?.key === 'metal_blade'); const held = C(r, 'inv').slots[bi]!;
          C(r, 'inv').slots[bi] = null; markDirty(); place(r, bench.tx! - 1, bench.ty!);
          const refused = act(g, 'craft', { eid: bench.id, recipe }, t); expect(refused.ok, 'an axe without a blade').toBe(false);
          C(r, 'inv').slots[bi] = held; markDirty();
        }
        if (recipe === 'metal_blade') bladeAt = i;
        if (!rc.station) { expect(act(g, 'craft', { recipe }, t).ok, recipe).toBe(true); t += 1000; return; }
        t = craftOut(g, rc.station === 'furnace' ? furnace : bench, recipe, t);
      },
      spend(label) {
        const [kind, what] = label.split(':');
        if (kind === 'place') {
          const [tx, ty] = legalTileNear(g, Math.floor(r.player.x / TILE), Math.floor(r.player.y / TILE), what);
          expect(act(g, 'build', { struct: what, tx, ty }, t).ok, label).toBe(true);
          const e = Object.values(r.entities).filter((x) => x.kind === 'struct' && x.type === what).pop()!;
          if (what === 'workbench') bench = e; else { furnace = e; place(r, e.tx! - 1, e.ty!); const wi = C(r, 'inv').slots.findIndex((s) => s?.key === 'wood' && s.qty >= 12); expect(act(g, 'move', { from: 'inv', fs: wi, to: e.station!.fuelC, qty: 12 }, t + 1).ok).toBe(true); }
        } else { place(r, bench.tx! - 1, bench.ty!); expect(act(g, 'upgradeStation', { eid: bench.id }, t).ok, label).toBe(true); }
        t += 1000;
      },
    });
    expect(bladeAt).toBeGreaterThan(0); expect(bladeAt).toBeLessThan(axeAt);
    expect(countItem(r, 'inv', 'industrial_axe')).toBe(1); expect(countItem(r, 'inv', 'metal_blade')).toBe(0);
    expect(countItem(r, 'inv', 'spares')).toBe(spares0);
    for (const k of Object.keys(bill.atoms)) if (k !== 'spares' && k !== 'wood') expect(countItem(r, 'inv', k), 'atom left: ' + k).toBe(0);
    expect(validate(raw(g))).not.toBeNull();
  });
  it('Recycler loops around the axe and the blade return no net material (K4)', () => {
    // Raw ingot/part content of everything the rev-3 axe consumes, blade expanded.
    const embedded = { iron_ingot: 3 /* iron axe */ + 4 /* blade */, mechanical_parts: 1 + 1 /* blade */, spares: 2 };
    const axe = recoveryPlan({ uid: 'x', key: 'industrial_axe', qty: 1, dur: ITEMS.industrial_axe.dur } as never)!;
    expect(axe.recipe).toBe('X:recover-v3');                               // existing rule, untouched
    const back: Record<string, number> = {}; for (const [k, q] of axe.outputs) back[k] = (back[k] ?? 0) + q;
    expect(back).toEqual({ scrap: 1, mechanical_parts: 2, iron_ingot: 1 }); // same return as at rev 2
    expect(back.mechanical_parts).toBeLessThanOrEqual(embedded.mechanical_parts);
    expect(back.iron_ingot).toBeLessThan(embedded.iron_ingot);
    expect(back.spares ?? 0).toBe(0); expect(back.metal_blade ?? 0).toBe(0); expect(back.iron_axe ?? 0).toBe(0);
    // One Scrap comes back, but a Machine Part needs TWO scrap per pair plus an ingot, and the loop burns 6 ingots and 2 Parts.
    const blade = recoveryPlan({ uid: 'y', key: 'metal_blade', qty: 1 } as never)!;
    expect(blade.recipe).toBe('X:blade-v1'); expect(blade.outputs).toEqual([['iron_ingot', 2], ['mechanical_parts', 1]]);
    REPORT.salvager_axe_recycle = { embedded_in_one_rev3_axe: embedded, recycler_returns_at_full_condition: back, net_per_craft_recycle_turn: { iron_ingot: back.iron_ingot - embedded.iron_ingot, mechanical_parts: back.mechanical_parts - embedded.mechanical_parts, spares: -embedded.spares, scrap: back.scrap }, blade_loop_net: { iron_ingot: 2 - 4, mechanical_parts: 1 - 1 }, verdict: 'NO NET MATERIAL: iron and Parts strictly negative, Machine Parts neutral. New Recycler rule for the axe NOT needed (Round 1 migration note withdrawn).' };
  });
  it('INTENT: three blade craft → recycle turns only ever lose iron', () => {
    const g = start(); const r = g.run!;
    for (const [k, q] of [['wood', 20], ['stone', 6], ['iron_ingot', 13], ['mechanical_parts', 3]] as const) expect(addItem(r, 'inv', k, q)).toBe(0);
    const spares0 = countItem(r, 'inv', 'spares');
    const bench = build(g, 'workbench', START + 10); place(r, bench.tx! - 1, bench.ty!);
    expect(act(g, 'upgradeStation', { eid: bench.id }, START + 20).ok).toBe(true);       // −2 MP −1 iron
    let t = START + 100; const seen: [number, number][] = [];
    for (let turn = 0; turn < 3; turn++) {
      const iron = countItem(r, 'inv', 'iron_ingot'), mp = countItem(r, 'inv', 'mechanical_parts');
      t = craftOut(g, bench, 'metal_blade', t);
      const rec = recycleStart(g, 'metal_blade', t); expect(rec.ok, rec.reason).toBe(true);
      stepStations(g, 15_000, t + 15_000); t += 16_000; collect(g, rec.rc.station!.outC, t); t += 100;
      expect(countItem(r, 'inv', 'iron_ingot')).toBe(iron - 2); expect(countItem(r, 'inv', 'mechanical_parts')).toBe(mp);
      seen.push([countItem(r, 'inv', 'iron_ingot'), countItem(r, 'inv', 'mechanical_parts')]);
    }
    expect(seen).toEqual([[10, 1], [8, 1], [6, 1]]); expect(countItem(r, 'inv', 'spares')).toBe(spares0);
  });
});

describe('P5 — Recycler rule X:plate-v1 (1 Iron Plate → 1 Iron Ingot)', () => {
  it('is a NEW versioned key; every earlier rule is byte-identical', () => {
    const snap = componentRuleSnapshot();
    expect(snap['X:plate-v1']).toEqual({ key: 'iron_plate', seconds: 10, outputs: [['iron_ingot', 1]] });
    expect(COMPONENT_RECIPES).toContain('X:plate-v1');
    expect(snap['X:pipe-v1']).toEqual({ key: 'metal_pipe', seconds: 10, outputs: [['refined_iron_ingot', 1]] });
    expect(snap['X:pipe-v2']).toEqual({ key: 'metal_pipe', seconds: 12, outputs: [['refined_iron_ingot', 1], ['mechanical_parts', 1]] });
    expect(snap['X:pipe-v3']).toEqual({ key: 'metal_pipe', seconds: 10, outputs: [['refined_iron_ingot', 1]] });
    expect(snap['X:gear-v1']).toEqual({ key: 'mechanical_gear', seconds: 15, outputs: [['mechanical_parts', 2], ['iron_ingot', 1]] });
    expect(snap['X:blade-v1']).toEqual({ key: 'metal_blade', seconds: 14, outputs: [['iron_ingot', 2], ['mechanical_parts', 1]] });
    expect(recoveryPlan({ uid: 'd', key: 'damaged_drive', qty: 1 } as never)).toEqual({ recipe: 'X:drive', total: 12000, outputs: [['spares', 2]], condition: null });
    // Only a clean single plate qualifies; the rule cannot be reached through another recipe key.
    expect(recoveryPlan({ uid: 'p', key: 'iron_plate', qty: 2 } as never)).toBeNull();
    expect(recoveryPlanFor({ uid: 'p', key: 'iron_plate', qty: 1 } as never, 'X:pipe-v3')).toBeNull();
    expect(recoveryPlanFor({ uid: 'p', key: 'metal_pipe', qty: 1 } as never, 'X:plate-v1')).toBeNull();
    // ANALYTIC conservation: one plate embeds 1 refined ingot (1.5 ingot + 0.5 coal) + 0.5 fastener; it returns 1 plain ingot.
    const perPlate = { iron_ingot: (RECIPES.refined_iron_ingot.ins.find(([k]) => k === 'iron_ingot')![1] / RECIPES.refined_iron_ingot.qty) * (RECIPES.iron_plate.ins.find(([k]) => k === 'refined_iron_ingot')![1] / RECIPES.iron_plate.qty) };
    expect(perPlate.iron_ingot).toBe(1.5); expect(1).toBeLessThan(perPlate.iron_ingot);
  });

  it('INTENT: job, output, item move, save/restart mid-job, stack-of-two refusal', () => {
    const g = start(); const r = g.run!;
    expect(addItem(r, 'inv', 'iron_plate', 2)).toBe(0);                    // FIXTURE: plates as loot would deliver them
    const pair = recycleStart(g, 'iron_plate', START + 10);
    expect(pair.ok).toBe(false);                                           // a stack of two is not a single
    const rcE = recyclerOf(r); place(r, rcE.tx!, rcE.ty!);
    const slot2 = C(r, 'inv').slots.findIndex((s) => s?.key === 'iron_plate');
    const refused = act(g, 'recycleItem', { eid: rcE.id, slot: slot2, uid: C(r, 'inv').slots[slot2]!.uid }, START + 11);
    expect(refused.ok).toBe(false); expect(why(refused)).toMatch(/Split one Iron Plate/);
    splitOne(g, 'iron_plate', START + 20);
    const iron0 = countItem(r, 'inv', 'iron_ingot'), spares0 = countItem(r, 'inv', 'spares'), mp0 = countItem(r, 'inv', 'mechanical_parts');
    const rec = recycleStart(g, 'iron_plate', START + 30); expect(rec.ok, rec.reason).toBe(true);
    const job = rec.rc.station!.queue[0];
    expect(job.recipe).toBe('X:plate-v1'); expect(job.total).toBe(10_000);
    expect(job.reserved!.map((s) => [s.uid, s.key, s.qty])).toEqual([[rec.uid, 'iron_plate', 1]]);
    expect(countItem(r, 'inv', 'iron_plate')).toBe(1);
    // half-way: nothing paid out
    stepStations(g, 5_000, START + 5_030); expect(countItem(r, rec.rc.station!.outC, 'iron_ingot')).toBe(0);
    // save → restart
    const back = validate(raw(g))!; expect(back, 'a save with a running plate job must open').not.toBeNull();
    const br = back.run!; const brc = recyclerOf(br); const bj = brc.station!.queue[0];
    expect(bj.recipe).toBe('X:plate-v1'); expect(bj.left).toBe(5_000); expect(bj.reserved![0].uid).toBe(rec.uid);
    stepStations(back, 6_000, START + 11_030);
    expect(brc.station!.queue).toHaveLength(0);
    expect(countItem(br, brc.station!.outC, 'iron_ingot')).toBe(1);        // exactly once
    stepStations(back, 60_000, START + 71_030); expect(countItem(br, brc.station!.outC, 'iron_ingot')).toBe(1);
    // a tampered save that asks the plate rule for more is refused
    const forged = raw(g); forged.run.entities[rec.rc.id].station.queue[0].recipe = 'X:blade-v1';
    expect(validate(forged), 'a plate cannot be paid out under the blade rule').toBeNull();
    // move the ingot to the pack
    place(br, brc.tx!, brc.ty!); collect(back, brc.station!.outC, START + 72_000);
    expect(countItem(br, 'inv', 'iron_ingot')).toBe(iron0 + 1);
    expect(countItem(br, 'inv', 'spares')).toBe(spares0); expect(countItem(br, 'inv', 'mechanical_parts')).toBe(mp0);
    expect(countItem(br, 'inv', 'iron_plate')).toBe(1);
    expect(validate(raw(back))).not.toBeNull();
  });

  it('INTENT: repeated craft → recycle loses one ingot, one coal and one fastener per turn; never mints iron or Parts', () => {
    const g = start(); const r = g.run!;
    for (const [k, q] of [['wood', 40], ['stone', 30], ['iron_ingot', 10], ['coal', 3], ['fasteners', 3], ['mechanical_parts', 2]] as const) expect(addItem(r, 'inv', k, q)).toBe(0);
    const bench = build(g, 'workbench', START + 10); place(r, bench.tx! - 1, bench.ty!);
    expect(act(g, 'upgradeStation', { eid: bench.id }, START + 20).ok).toBe(true);       // −2 MP −1 iron → 9 ingots
    const furnace = build(g, 'furnace', START + 30); place(r, furnace.tx! - 1, furnace.ty!);
    const wi = C(r, 'inv').slots.findIndex((s) => s?.key === 'wood' && s.qty >= 8);
    expect(act(g, 'move', { from: 'inv', fs: wi, to: furnace.station!.fuelC, qty: 8 }, START + 31).ok).toBe(true);
    const spares0 = countItem(r, 'inv', 'spares'); let t = START + 100;
    const ledger = () => ({ iron_ingot: countItem(r, 'inv', 'iron_ingot'), coal: countItem(r, 'inv', 'coal'), fasteners: countItem(r, 'inv', 'fasteners'), refined_iron_ingot: countItem(r, 'inv', 'refined_iron_ingot'), iron_plate: countItem(r, 'inv', 'iron_plate'), mechanical_parts: countItem(r, 'inv', 'mechanical_parts'), spares: countItem(r, 'inv', 'spares') - spares0 });
    const turns = [ledger()];
    for (let turn = 0; turn < 3; turn++) {
      t = craftOut(g, furnace, 'refined_iron_ingot', t);                   // 3 ingot + 1 coal → 2 refined
      t = craftOut(g, bench, 'iron_plate', t);                             // 2 refined + 1 fastener → 2 plates
      for (let k = 0; k < 2; k++) {
        splitOne(g, 'iron_plate', t); t += 20;
        const rec = recycleStart(g, 'iron_plate', t); expect(rec.ok, rec.reason).toBe(true);
        stepStations(g, 11_000, t + 11_000); t += 12_000; collect(g, rec.rc.station!.outC, t); t += 100;
      }
      turns.push(ledger());
    }
    expect(turns).toEqual([
      { iron_ingot: 9, coal: 3, fasteners: 3, refined_iron_ingot: 0, iron_plate: 0, mechanical_parts: 0, spares: 0 },
      { iron_ingot: 8, coal: 2, fasteners: 2, refined_iron_ingot: 0, iron_plate: 0, mechanical_parts: 0, spares: 0 },
      { iron_ingot: 7, coal: 1, fasteners: 1, refined_iron_ingot: 0, iron_plate: 0, mechanical_parts: 0, spares: 0 },
      { iron_ingot: 6, coal: 0, fasteners: 0, refined_iron_ingot: 0, iron_plate: 0, mechanical_parts: 0, spares: 0 },
    ]);
    REPORT.plate_recycle_loop = { scope: 'INTENT on FIXTURE stock', per_turn: { iron_ingot: -1, coal: -1, fasteners: -1, mechanical_parts: 0, spares: 0 }, ledger_by_turn: turns, verdict: 'NET NEGATIVE: no iron, no Machine Parts and no Parts are created.' };
    expect(validate(raw(g))).not.toBeNull();
  });

  it('writes the simulation report (only when SOH_WRITE_ONTOLOGY=1)', () => {
    if (!WRITE) return;
    mkdirSync(OUT, { recursive: true });
    writeFileSync(resolve(OUT, 'round2-simulations.json'), JSON.stringify({ generated_from: { recipe_revision: RECIPE_REVISION, retired: [...RETIRED_RECIPES] }, ...REPORT }, null, 1) + '\n');
  });
});
