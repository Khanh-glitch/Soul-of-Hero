// PA1 R1 — recipe / job migration and the source-backed v1.1 + v1.2 recipe slice.
// Scope: bounded transactions on a labelled station fixture. The player position and the
//   station entity are fixtures; every payment, UID, queue, completion, cancel and save below
//   goes through the real intents. NOT a natural-play or 14-day proof.
// Authority: docs/design/pa1-recovery/PA1_RECOVERED_RECIPE_PROVENANCE_15.csv (recovered v1.1
//   paper BOMs) with the v1.2 dry-kit override from PR #59's
//   docs/design/PA1_OIL_MOBILITY_V1_2_ACCEPTANCE.md. Paper-only or unapproved rows are asserted
//   ABSENT here on purpose: `steel_ingot`, the lubricant BOM rewrite and any invented recipe.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { stationBurnable, ITEMS, RECIPES, ALWAYS_KNOWN_RECIPES, DEPLOYABLE_TYPES, PA1_BASE_GEOMETRY, isRecipeKnown, permitsDirectedResearch, isFamilyGated, familyMembers, starterKnowledge, recipeForJob,
  RECIPE_REVISION, RECIPE_FAMILY, RESEARCH_FAMILIES, RETIRED_RECIPES, familyOfRecipe,
  purchasableFamilies, validateGameplayCatalog } from '../src/game/catalog';
import { LEGACY_RECIPES, recipeAtRevision, hasLegacyDefinition } from '../src/game/recipe-migration';
import { BAL, TILE, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, dispatch, markDirty, mkContainer, newGame, stepStations } from '../src/game/engine';
import { vehicleClear } from '../src/game/motorbike';
import { recoveryPlan, componentRuleSnapshot } from '../src/game/recycler';
import { proveItem } from '../src/game/industrial-proof';
import { serializeSnapshot, selectSnapshots, validate } from '../src/game/persist';

/** Storage doubles, same shape the shipped save tests use (b1-storage.test.ts). */
function fakeStorage() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
}
function fakeIDB() {
  const state: { value: string | null } = { value: null };
  const database: any = { transaction: () => {
    const tx: any = { objectStore: () => ({
      get: () => { const rq: any = {}; queueMicrotask(() => { rq.result = state.value; rq.onsuccess?.(); }); return rq; },
      put: (v: string) => { queueMicrotask(() => { state.value = v; tx.oncomplete?.(); }); },
      delete: () => { queueMicrotask(() => { state.value = null; tx.oncomplete?.(); }); },
    }) };
    return tx;
  } };
  const indexedDB = { open: () => { const rq: any = { result: database }; queueMicrotask(() => rq.onsuccess?.()); return rq; } };
  return { state, indexedDB };
}
afterEach(() => { vi.unstubAllGlobals(); delete (RECIPES as any).fuel_can; });
import { getWorld, setActiveLayout } from '../src/game/world';
import { WW } from '../src/game/core';
import BALTxt from '../src/game/balance.v1.json';

const T0 = Date.UTC(2026, 10, 13); let seq = 0;
const act = (gs: GameState, type: string, p: object = {}, now?: number) => dispatch(gs, { id: 'pa1r-' + (++seq), type, ...p }, now ?? T0 + 10 + seq * 1000);
const raw = (gs: GameState) => JSON.parse(JSON.parse(serializeSnapshot(gs)).payload);
const reload = (gs: GameState) => selectSnapshots([serializeSnapshot(gs), null]).gs!;
function fresh() {
  setActiveLayout('shipping');
  const gs = newGame();
  expect(act(gs, 'startRun', { character: 'male', region: 0, seed: 4021 }).ok).toBe(true);
  gs.run!.creatures = [];
  return gs;
}
/** FIXTURE station beside the player (position/ownership only); the transaction is real. */
function station(gs: GameState, type: 'workbench' | 'research' | 'furnace', level?: 1 | 2 | 3): Entity {
  const r = gs.run!, p = r.player, fuel = mkContainer(r, 'fuel', 3), out = mkContainer(r, 'out', 6);
  const e: Entity = { id: 'pa1r-st-' + (++seq), kind: 'struct', type, x: p.x + 16, y: p.y, tx: Math.floor(p.x / TILE) + 1, ty: Math.floor(p.y / TILE), hp: 200, maxHp: 200, station: { fuelC: fuel.id, outC: out.id, burn: 0, queue: [], ...(level ? { level } : {}) } };
  r.entities[e.id] = e; markDirty(); return e;
}
const give = (gs: GameState, key: string, qty = 1) => { expect(addItem(gs.run!, 'inv', key, qty)).toBe(0); };
const invStack = (gs: GameState, key: string) => C(gs.run!, 'inv').slots.find(s => s?.key === key);
const invCount = (gs: GameState, key: string) => countItem(gs.run!, 'inv', key);
const outC = (gs: GameState, e: Entity) => e.station!.outC;
const outOf = (gs: GameState, e: Entity, key: string) => countItem(gs.run!, e.station!.outC, key);
/** The first formula the Research Table itself would offer for directed study. */
const studyTarget = (gs: GameState) => Object.keys(RECIPES).find(k => !isRecipeKnown(gs.run!.knowledge.recipes, k) && permitsDirectedResearch(RECIPES[k]))!;
/** Queue one craft and run it to completion (station fuel is granted for fuel-burning stations). */
function craftOnce(gs: GameState, e: Entity, recipe: string, fuelKey?: string) {
  if (fuelKey) addItem(gs.run!, e.station!.fuelC, fuelKey, 4);
  expect(act(gs, 'craft', { eid: e.id, recipe }).ok, recipe).toBe(true);
  stepStations(gs, RECIPES[recipe].secs * 1000 + 500, T0 + 500_000);
}

describe('PA1 R1 contract freeze — live catalog vs recovered paper v1.1 + v1.2 correction', () => {
  it('applies exactly the four source-backed BOM changes', () => {
    expect(RECIPES.metal_pipe.qty).toBe(2);                                                 // 2 refined + 1 parts -> TWO sections
    expect(RECIPES.metal_pipe.ins).toEqual([['refined_iron_ingot', 2], ['mechanical_parts', 1]]);
    expect(RECIPES.mechanical_gear.ins).toEqual([['refined_iron_ingot', 1], ['iron_ingot', 1], ['mechanical_parts', 2], ['fasteners', 1]]);
    expect(RECIPES.iron_plate.ins).toEqual([['refined_iron_ingot', 2], ['fasteners', 1]]);
    expect(RECIPES.iron_plate.qty).toBe(2);
    expect(RECIPES.motorbike_kit.ins).toEqual([['vehicle_frame', 1], ['vehicle_drive', 1], ['iron_plate', 2], ['fasteners', 2]]);
    for (const id of ['metal_pipe', 'mechanical_gear', 'iron_plate', 'motorbike_kit']) expect(RECIPES[id].rev, id).toBe(2);
    // The frozen predecessor of each changed row is still resolvable and untouched.
    expect(LEGACY_RECIPES['metal_pipe@1'].qty).toBe(1);
    expect(LEGACY_RECIPES['iron_plate@1'].ins).toEqual([['refined_iron_ingot', 2], ['metal_pipe', 1], ['mechanical_parts', 1]]);
    expect(LEGACY_RECIPES['motorbike_kit@1'].ins).toContainEqual(['iron_ingot', 2]);
  });
  it('leaves the two rows the paper says already match untouched', () => {
    expect(RECIPES.refined_iron_ingot.ins).toEqual([['iron_ingot', 3], ['coal', 1]]);
    expect(RECIPES.refined_iron_ingot.qty).toBe(2);
    expect(RECIPES.refined_iron_ingot.rev).toBeUndefined();
    expect(RECIPES.refinery_fuel.ins).toEqual([['salvaged_oil', 3], ['glass', 1]]);
    expect(RECIPES.refinery_fuel.out).toBe('fuel_can');
    expect(BALTxt.oilRefineryV1.recipes.single.ins).toEqual([['salvaged_oil', 3], ['glass', 1]]);
  });
  it('does NOT implement paper-only or unapproved rows: no steel id, no lubricant BOM rewrite', () => {
    expect(RECIPES.steel_ingot).toBeUndefined();
    expect(ITEMS.steel_ingot).toBeUndefined();
    // Recovered paper wanted 1 oil + 2 meat + 1 raw_salt at the refinery. BAL stays the single
    // authority until the food/oil economy is validated end to end (CT WP2: isolate lubricant).
    expect(RECIPES.refinery_lubricant.ins).toEqual([['salvaged_oil', 2]]);
    expect(RECIPES.refinery_lubricant.rev).toBeUndefined();
    // `fuel_briquette_legacy` is a retirement MARKER in the paper, not a live extra recipe; the
    // live Packed Fuel Briquette is a different SOH item and is deliberately kept.
    expect(RECIPES.fuel_briquette_legacy).toBeUndefined();
    expect(RECIPES.fuel_briquette).toBeDefined();
  });
  it('retires the improvised bench Fuel Canister formula and its dangling study pointer', () => {
    expect(RECIPES.fuel_can).toBeUndefined();
    expect(RETIRED_RECIPES).toContain('fuel_can');
    expect(ITEMS.fuel_can.studyRecipe, 'v1.2 §2: no dangling research target').toBeUndefined();
    expect(ITEMS.fuel_can.specimen).toBeUndefined();
    // The ITEM keeps working: a canister is still station / generator / furnace fuel at the
    // same burn value it had before the cutover, and the motorbike fill is a separate number.
    expect(ITEMS.fuel_can.fuel).toBe(60);
    expect(BAL.motorbike.canFuel).toBe(100);
    // `stationBurnable` is deliberately false for a canister: it is generator / vehicle fuel paid
    // as a whole item, not generic kindling for a campfire or furnace. The cutover kept that rule.
    expect(stationBurnable('fuel_can')).toBe(false);
    expect(stationBurnable('wood')).toBe(true);
    // Salvaged oil still teaches the FURNACE route: the surviving non-refinery way to make a can.
    expect(ITEMS.salvaged_oil.specimen).toBe('refine_salvaged_oil');
    expect(RECIPES.refine_salvaged_oil.out).toBe('fuel_can');
    expect(RECIPES.refine_salvaged_oil.rev).toBeUndefined();
    expect(validateGameplayCatalog()).toBe(true);
  });
  it('census moves by ID set, not by ambition: minus one recipe, items and ontology unchanged', () => {
    const recipeIds = Object.keys(RECIPES);
    expect(new Set(recipeIds).size).toBe(recipeIds.length);
    expect(recipeIds).toHaveLength(112);                       // 113 live at the base SHA minus the retired canister
    expect(recipeIds).not.toContain('fuel_can');
    expect(recipeIds).toContain('refinery_fuel');              // still exactly ONE refinery fuel recipe id
    expect(Object.keys(RECIPES).filter(k => RECIPES[k].out === 'fuel_can')).toEqual(['refine_salvaged_oil', 'refinery_fuel', 'refinery_fuel_batch', 'refinery_industrial', 'refinery_crude']);
    expect(Object.keys(ITEMS)).toHaveLength(147);              // no phantom steel item was added
    expect(PA1_BASE_GEOMETRY).toHaveLength(15);
    expect(DEPLOYABLE_TYPES).toHaveLength(24);
    expect(ALWAYS_KNOWN_RECIPES.filter(k => k.startsWith('deploy_'))).toHaveLength(24); // nothing is withheld in this build
    expect(starterKnowledge().filter(k => k.startsWith('deploy_'))).toHaveLength(24);
    expect(RECIPE_REVISION).toBe(2);
  });
});

describe('PA1 R1 migration ledger — a cutover may not brick or re-price a saved job', () => {
  it('resolves every revision case explicitly, including a save newer than this build', () => {
    expect(recipeForJob('metal_pipe', 1)!.qty).toBe(1);        // frozen: one section for the old price
    expect(recipeForJob('metal_pipe', 2)!.qty).toBe(2);        // live: the cutover yield
    expect(recipeForJob('rope', 1)!.out).toBe('rope');         // unchanged recipe: one definition everywhere
    expect(recipeForJob('fuel_can', 1)!.out).toBe('fuel_can'); // retired but readable for old queues
    expect(recipeForJob('fuel_can', 2)).toBeNull();            // retired is NOT live at revision 2
    expect(recipeForJob('rope', RECIPE_REVISION + 1)).toBeNull(); // a future save fails closed, never downgrades
    expect(recipeForJob('nope', undefined)).toBeNull();
    expect(recipeAtRevision('metal_pipe', undefined, RECIPES as never)!.qty).toBe(1); // pre-stamping => rev 1
    expect(hasLegacyDefinition('fuel_can')).toBe(true);
    expect(hasLegacyDefinition('rope')).toBe(false);
  });
  it('a pre-cutover pipe job (no stamp) still pays ONE pipe for the old price', () => {
    const gs = fresh(), bench = station(gs, 'workbench', 2);
    give(gs, 'refined_iron_ingot', 2); give(gs, 'mechanical_parts', 1);
    const refined = invStack(gs, 'refined_iron_ingot')!, parts = invStack(gs, 'mechanical_parts')!;
    expect(act(gs, 'craft', { eid: bench.id, recipe: 'metal_pipe' }).ok).toBe(true);
    const job = bench.station!.queue[0];
    expect(job.rv, 'a new job carries the live revision').toBe(RECIPE_REVISION);
    expect(job.reserved!.map(s => s.uid).sort()).toEqual([refined.uid, parts.uid].sort());
    expect(invCount(gs, 'refined_iron_ingot')).toBe(0);
    // FIXTURE rewrite to the pre-stamping shape an older save holds, then round-trip the save.
    const saved = raw(gs); delete (saved.run.entities[bench.id].station.queue[0] as any).rv;
    const back = validate(saved)!;
    expect(back, 'the old save must still open').not.toBeNull();
    expect(back.run!.entities[bench.id].station!.queue[0].rv, 'an un-stamped job is not retro-stamped').toBeUndefined();
    stepStations(back, RECIPES.metal_pipe.secs * 1000 + 500, T0 + 900_000);
    expect(outOf(back, back.run!.entities[bench.id], 'metal_pipe'), 'no free second pipe').toBe(1);
    expect(validate(back)).not.toBeNull();
    // A job stamped for the live revision does get the new pair.
    const stamped = reload(gs);
    stepStations(stamped, RECIPES.metal_pipe.secs * 1000 + 500, T0 + 990_000);
    expect(outOf(stamped, stamped.run!.entities[bench.id], 'metal_pipe')).toBe(2);
  });
  it('two legacy pipe jobs pay 1 each — never the new pair twice', () => {
    const gs = fresh(), bench = station(gs, 'workbench', 2);
    give(gs, 'refined_iron_ingot', 4); give(gs, 'mechanical_parts', 2);
    expect(act(gs, 'craft', { eid: bench.id, recipe: 'metal_pipe' }).ok).toBe(true);
    expect(act(gs, 'craft', { eid: bench.id, recipe: 'metal_pipe' }).ok).toBe(true);
    const saved = raw(gs); for (const j of saved.run.entities[bench.id].station.queue) j.rv = 1;
    const back = validate(saved)!; expect(back).not.toBeNull();
    stepStations(back, 19_000, T0 + 900_000);
    expect(outOf(back, back.run!.entities[bench.id], 'metal_pipe')).toBe(1);
    stepStations(back, 19_000, T0 + 930_000);
    expect(outOf(back, back.run!.entities[bench.id], 'metal_pipe')).toBe(2);   // 1 + 1, not 2 + 2
    const tampered = raw(gs);                                        // from the still-queued snapshot
    tampered.run.entities[bench.id].station.queue[0].rv = RECIPE_REVISION + 1;
    expect(validate(tampered), 'a job cannot name a revision this build does not know').toBeNull();
  });
  it('an old queued fuel-can craft completes under the frozen definition and never re-queues', () => {
    const gs = fresh(), bench = station(gs, 'workbench', 2);
    // Build a genuine pre-cutover save: restore the retired definition only for the queueing
    // moment (it is exactly what the shipped catalog held), queue through the real intent,
    // then remove it again so the save is loaded across the cutover.
    (RECIPES as any).fuel_can = LEGACY_RECIPES['fuel_can@1'];
    gs.run!.knowledge.recipes.push('fuel_can');
    give(gs, 'charcoal', 2); give(gs, 'sulfur', 2); give(gs, 'glass', 3);
    expect(act(gs, 'craft', { eid: bench.id, recipe: 'fuel_can' }).ok).toBe(true);
    expect(act(gs, 'craft', { eid: bench.id, recipe: 'fuel_can' }).ok).toBe(true);
    expect(act(gs, 'craft', { eid: bench.id, recipe: 'fuel_can' }).ok, 'inputs are finite').toBe(false);
    const saved = raw(gs);                                              // the file a player held before the cutover
    delete (RECIPES as any).fuel_can;                                   // ...then the cutover lands
    for (const j of saved.run.entities[bench.id].station.queue) delete (j as any).rv;
    const back = validate(saved)!;
    expect(back, 'a retired recipe must not brick the save').not.toBeNull();
    expect(act(back, 'craft', { eid: back.run!.entities[bench.id].id, recipe: 'fuel_can' }).ok).toBe(false); // not queueable any more
    stepStations(back, 21_000, T0 + 900_000);          // first paid cycle finishes
    stepStations(back, 21_000, T0 + 921_000);          // and the second one behind it
    const rb = back.run!.entities[bench.id];
    expect(outOf(back, rb, 'fuel_can')).toBe(2);                          // both paid cycles finish
    expect(rb.station!.queue.some(j => j.recipe === 'fuel_can')).toBe(false);
    expect(countItem(back.run!, rb.station!.outC, 'charcoal')).toBe(0);  // inputs were really consumed
    expect(countItem(back.run!, rb.station!.outC, 'sulfur')).toBe(0);
    expect(validate(back)).not.toBeNull();
  });
  it('a legacy research job for the retired formula still pays out a blueprint that cannot teach it', () => {
    const gs = fresh(), table = station(gs, 'research');
    give(gs, 'spares', BAL.research.directedSparesCost);
    expect(act(gs, 'research', { mode: 'directed', recipe: studyTarget(gs), eid: table.id }).ok).toBe(true);
    const saved = raw(gs);                                              // FIXTURE: rename the stored job to what an old save holds
    saved.run.entities[table.id].station.queue[0].recipe = 'R:fuel_can';
    delete (saved.run.entities[table.id].station.queue[0] as any).rv;
    const back = validate(saved)!; expect(back, 'the retired research job loads').not.toBeNull();
    stepStations(back, BAL.research.directedSeconds * 1000 + 500, T0 + 900_000);
    const out = back.run!.entities[table.id].station!.outC;
    const paper = C(back.run!, out).slots.find(s => s?.key === 'blueprint');
    expect(paper?.meta).toBe('fuel_can');
    const again = reload(back);
    expect(again.run!.knowledge.recipes).not.toContain('fuel_can');     // migration pruned it
    expect(again.run!.migrated?.retiredRecipes ?? 0, 'nothing to prune: the retired formula was never learned').toBe(0);
    const cid = again.run!.entities[table.id].station!.outC;
    const slot = C(again.run!, cid).slots.findIndex(s => s?.key === 'blueprint');
    const read = act(again, 'useItem', { c: cid, slot });
    expect(read.ok, 'reading a retired blueprint is refused').toBe(false);
    expect(read.reason!).toMatch(/retired/);
    expect(C(again.run!, cid).slots[slot]?.meta, 'the physical paper is not destroyed').toBe('fuel_can');
    expect(again.run!.knowledge.recipes).not.toContain('fuel_can');
  });
  it('the shipped load path prunes the retired formula, says so, and keeps its word after a save', async () => {
    const gs = fresh();
    (RECIPES as any).fuel_can = LEGACY_RECIPES['fuel_can@1'];            // the pre-cutover catalog
    gs.run!.knowledge.recipes.push('fuel_can');
    const local = fakeStorage(), idb = fakeIDB();
    vi.stubGlobal('localStorage', local); vi.stubGlobal('indexedDB', idb.indexedDB);
    const p = await import('../src/game/persist');
    expect(p.saveSync(gs), 'the pre-cutover save was written').toBe(true);
    delete (RECIPES as any).fuel_can;                                    // ...then the cutover lands
    const first = await p.load();
    expect(first.gs, 'a save that knew the retired formula still opens').not.toBeNull();
    expect(first.gs!.run!.knowledge.recipes).not.toContain('fuel_can');
    expect(first.gs!.run!.migrated?.retiredRecipes).toBe(1);
    expect(first.note ?? '', 'the player is told what the cutover removed').toMatch(/retired Fuel Canister formula/i);
    expect(first.gs!.run!.migrated?.retiredNoticeShown, 'the notice is consumed, not replayed forever').toBe(true);
    expect(p.saveSync(first.gs!)).toBe(true);
    const second = await p.load();
    expect(second.gs!.run!.knowledge.recipes).not.toContain('fuel_can');
    expect(second.gs!.run!.migrated?.retiredRecipes, 'a rewritten save is not re-migrated').toBe(1);
    expect(second.note ?? '').not.toMatch(/retired Fuel Canister formula/i);
    expect(second.gs!.run!.migrated?.retiredRecipes, 'the evidence stays, the notice does not').toBe(1);
  });
  it('prunes retired knowledge, records the migration, and rejects forged ledgers', () => {
    const gs = fresh();
    gs.run!.knowledge.recipes.push('fuel_can');
    const saved = raw(gs);
    const back = validate(saved)!;
    expect(back, 'a save that knew the retired formula still loads').not.toBeNull();
    expect(back.run!.knowledge.recipes).not.toContain('fuel_can');
    expect(back.run!.migrated?.retiredRecipes).toBe(1);
    expect(validate(saved)).not.toBeNull();                              // migration is idempotent
    const forged = raw(gs); forged.run.tech = { families: ['NOT_A_FAMILY'], recipeRev: RECIPE_REVISION };
    expect(validate(forged), 'an unknown research family is not a legal save').toBeNull();
    const ahead = raw(gs); ahead.run.tech = { families: ['ENERGY'], recipeRev: RECIPE_REVISION + 5 };
    expect(validate(ahead), 'a save from a future catalog revision is not downgraded').toBeNull();
    const dup = raw(gs); dup.run.tech = { families: ['ENERGY', 'ENERGY'], recipeRev: RECIPE_REVISION };
    expect(validate(dup), 'a family cannot be bought twice on paper').toBeNull();
  });
});

describe('PA1 R1 recycler conservation — the pipe cut needs a matching return', () => {
  it('new pipe jobs use the recovered paper return; superseded rules stay frozen for stored jobs', () => {
    expect(recoveryPlan({ uid: 'x', key: 'metal_pipe', qty: 1 } as any)?.recipe).toBe('X:pipe-v3');
    const snap = componentRuleSnapshot();
    expect(snap['X:pipe-v3']).toEqual({ key: 'metal_pipe', seconds: 10, outputs: [['refined_iron_ingot', 1]] });
    expect(snap['X:pipe-v2'].outputs).toEqual([['refined_iron_ingot', 1], ['mechanical_parts', 1]]);   // still frozen
    expect(snap['X:pipe-v1'].outputs).toEqual([['refined_iron_ingot', 1]]);
    const mirror = (BALTxt as any).recyclerV4.components;
    for (const recipe of ['X:pipe-v3', 'X:gear-v1', 'X:blade-v1']) {
      const rule = snap[recipe as keyof typeof snap];
      const row = mirror[rule.key];
      expect(row.recipe, rule.key).toBe(recipe);
      expect(row.seconds, rule.key).toBe(rule.seconds);
      expect(row.outputs, rule.key).toEqual(rule.outputs);
    }
  });
  it('craft -> recycle -> craft stays net-negative for every changed part (bible.md K4)', () => {
    // The 2-per-craft yield is exactly what made X:pipe-v2 an over-return: the pair came back as
    // 2 refined + 2 parts against 2 refined + 1 parts paid. The D-proof still reports that, which
    // is why v2 can never be selected for a new job again.
    expect(proveItem('metal_pipe', 'X:pipe-v3').rows.map(r => r.verdict)).toEqual(['OK']);
    expect(proveItem('metal_pipe', 'X:pipe-v2').rows.map(r => r.verdict)).toEqual(['OVER_RETURN']);
    expect(proveItem('metal_pipe', 'X:pipe-v1').rows.map(r => r.verdict)).toEqual(['OK']);
    expect(proveItem('mechanical_gear', 'X:gear-v1').rows.map(r => r.verdict)).toEqual(['OK']);
    expect(proveItem('metal_blade', 'X:blade-v1').rows.map(r => r.verdict)).toEqual(['OK']);
    expect(recoveryPlan({ uid: 'x', key: 'mechanical_gear', qty: 1 } as any)?.recipe).toBe('X:gear-v1');
  });
  it('a real pipe pair recycles to two refined ingots, which cannot buy another cycle', () => {
    const gs = fresh(), bench = station(gs, 'workbench', 2);
    const rc = Object.values(gs.run!.entities).find(e => e.kind === 'recycler');
    expect(rc, 'the Foundry Recycler exists on this layout').toBeTruthy();
    give(gs, 'refined_iron_ingot', 2); give(gs, 'mechanical_parts', 1);
    craftOnce(gs, bench, 'metal_pipe');
    expect(outOf(gs, bench, 'metal_pipe')).toBe(2);
    expect(invCount(gs, 'mechanical_parts')).toBe(0);                    // the one part is inside the batch
    const pipeSlot = C(gs.run!, outC(gs, bench)).slots.findIndex(s => s?.key === 'metal_pipe');
    expect(pipeSlot).toBeGreaterThanOrEqual(0);
    expect(act(gs, 'move', { from: outC(gs, bench), fs: pipeSlot, to: 'inv' }).ok).toBe(true);
    expect(invCount(gs, 'metal_pipe'), 'the pair travels as one stack').toBe(2);
    gs.run!.player.x = rc!.x - TILE; gs.run!.player.y = rc!.y; markDirty();
    for (let k = 0; k < 2; k++) {
      let slot = C(gs.run!, 'inv').slots.findIndex(s => s?.key === 'metal_pipe' && s.qty === 1);
      if (slot < 0) {
        const pair = C(gs.run!, 'inv').slots.findIndex(s => s?.key === 'metal_pipe');
        expect(pair).toBeGreaterThanOrEqual(0);
        expect(act(gs, 'split', { c: 'inv', slot: pair }).ok, 'one pipe per recycle job').toBe(true);
        slot = C(gs.run!, 'inv').slots.findIndex(s => s?.key === 'metal_pipe' && s.qty === 1);
      }
      expect(slot).toBeGreaterThanOrEqual(0);
      const uid = C(gs.run!, 'inv').slots[slot]!.uid;
      expect(act(gs, 'recycleItem', { eid: rc!.id, slot, uid }).ok).toBe(true);
      stepStations(gs, 11_000, T0 + 600_000 + k * 20_000);
    }
    expect(countItem(gs.run!, rc!.station!.outC, 'refined_iron_ingot')).toBe(2);
    expect(countItem(gs.run!, rc!.station!.outC, 'mechanical_parts'), 'no parts are minted back').toBe(0);
    // Re-crafting from the recovered ingots is impossible without paying parts again.
    expect(act(gs, 'craft', { eid: bench.id, recipe: 'metal_pipe' }).ok).toBe(false);
    expect(validate(gs)).not.toBeNull();
  });
});

describe('PA1 v1.2 dry Motorbike Kit — first fuel is paid separately, never twice', () => {
  it('the kit recipe packages no canister; the placed bike starts dry and pays one real can', () => {
    expect(RECIPES.motorbike_kit.ins.some(([k]) => k === 'fuel_can'), 'v1.1 double-spend is gone').toBe(false);
    expect(ITEMS.motorbike_kit.fuel, 'the packed kit is not a fuel source').toBeUndefined();
    setActiveLayout('shipping_fresh');
    const gs = fresh();
    // Discovery is not under test here (the kit arrives on a blueprint); what is under test is
    // the paid BOM, the dry package and the separate first fill.
    gs.run!.knowledge.recipes.push('motorbike_kit');
    const bench = station(gs, 'workbench', 3);
    give(gs, 'vehicle_frame', 1); give(gs, 'vehicle_drive', 1); give(gs, 'iron_plate', 2); give(gs, 'fasteners', 2);
    const plate = invStack(gs, 'iron_plate')!;
    expect(invStack(gs, 'fuel_can'), 'nothing flammable is part of this recipe').toBeUndefined();
    craftOnce(gs, bench, 'motorbike_kit');
    expect(outOf(gs, bench, 'motorbike_kit')).toBe(1);
    expect(outOf(gs, bench, 'fuel_can'), 'no canister is packaged with it').toBe(0);
    expect(countItem(gs.run!, outC(gs, bench), 'iron_plate')).toBe(0);
    expect(plate.qty, 'both plates went into the kit, none were re-priced').toBe(2);
    expect(invCount(gs, 'iron_ingot')).toBe(0);                          // v1.1's 2 raw ingots are gone
    const kitSlot = C(gs.run!, outC(gs, bench)).slots.findIndex(s => s?.key === 'motorbike_kit');
    expect(act(gs, 'move', { from: outC(gs, bench), fs: kitSlot, to: 'inv' }).ok).toBe(true);
    const kitUid = C(gs.run!, 'inv').slots.find(s => s?.key === 'motorbike_kit')!.uid;
    // Real placement on eligible road, then the separate fuel payment.
    const r = gs.run!, w = getWorld(r.layoutId);
    let spot: { x: number; y: number } | null = null;
    outer: for (let y = 2; y < 198; y++) for (let x = 3; x < 194; x++) {
      let yes = true;
      for (let d = -1; d <= 4; d++) { if (!w.economyMap.road[y * WW + x + d] || !vehicleClear(r, (x + d) * TILE + 8, y * TILE + 8)) { yes = false; break; } }
      if (yes) { spot = { x: x * TILE + 8, y: y * TILE + 8 }; break outer; }
    }
    expect(spot, 'no eligible road for a motorbike').toBeTruthy();
    r.player.x = spot!.x - TILE; r.player.y = spot!.y; markDirty();
    expect(act(gs, 'placeMotorbike', spot!).ok).toBe(true);
    const bike = Object.values(r.entities).find(e => e.kind === 'vehicle')!;
    expect(bike.vehicle!.fuel, 'a dry kit places a dry tank').toBe(0);
    expect(bike.deployed!.uid, 'the placed bike carries the crafted kit UID').toBe(kitUid);
    expect(act(gs, 'vehicleRefuel', { eid: bike.id }).ok, 'no fuel, no ride').toBe(false);
    give(gs, 'fuel_can', 1);
    const can = invStack(gs, 'fuel_can')!;
    expect(act(gs, 'vehicleRefuel', { eid: bike.id }).ok).toBe(true);
    expect(bike.vehicle!.fuel).toBe(BAL.motorbike.canFuel);
    expect(invCount(gs, 'fuel_can')).toBe(0);
    expect(act(gs, 'vehicleRefuel', { eid: bike.id }).ok, 'one can, one refill').toBe(false);
    expect(validate(gs)).not.toBeNull();
    const back = reload(gs);
    expect(back.run!.entities[bike.id].vehicle!.fuel).toBe(BAL.motorbike.canFuel);
  });
});
describe('PA1 WP3 research families — recorded ledger, priced ENERGY study, enforcement still an approval', () => {
  /** Flip the one flag the Control Tower has not approved yet, then restore it. Everything the
   *  runtime does with it (starter grants, save re-grants, research pool, blueprint reads, the
   *  paid unlock) is the real code path, not a stub. */
  const enforcing = (family: string, body: () => void) => {
    const def = RESEARCH_FAMILIES[family] as { enforce: boolean };
    const was = def.enforce; def.enforce = true;
    try { body(); } finally { def.enforce = was; }
  };
  it('eleven family names are recorded; ENERGY alone is priced, and nothing is enforced in this build', () => {
    expect(Object.keys(RESEARCH_FAMILIES).sort()).toEqual(['AGRICULTURE', 'ARCANA', 'ARMORY', 'CORE_SPECIFIC', 'DEFENSE', 'ELECTRICAL', 'ENERGY', 'EXPLORATION', 'METALLURGY', 'MOBILITY', 'STEEL']);
    expect(purchasableFamilies()).toEqual(['ENERGY']);
    expect(RESEARCH_FAMILIES.ENERGY.price).toEqual([['spares', 5], ['iron_ingot', 2]]);   // recovered v1.1
    expect(RESEARCH_FAMILIES.ENERGY.status).toBe('SOURCE_APPROVED');
    // PA1 P1: ENERGY covers the recovered energy chain — the three plants AND the pump /
    // refinery work they do. The other ten families carry no price and no enforcement, so they
    // cannot collect anything from a player, and membership alone withholds nothing today.
    expect(familyMembers('ENERGY')).toEqual([
      'deploy_base_generator', 'deploy_oil_pump', 'deploy_refinery',
      'pump_crude', 'refinery_crude', 'refinery_fuel', 'refinery_fuel_batch',
      'refinery_industrial', 'refinery_lubricant',
    ]);
    for (const id of familyMembers('ENERGY')) {
      expect(familyOfRecipe(id), id).toBe('ENERGY');
      expect(isFamilyGated(id), id).toBe(false);
      expect(RECIPES[id].base, id + ' is a real craftable formula').toBe(true);
      expect(starterKnowledge(), id + ' stays free starter knowledge while enforcement is undecided').toContain(id);
    }
    // The furnace salvage fallback stays outside the family by decision, not by omission.
    expect(familyOfRecipe('refine_salvaged_oil')).toBeNull();
    for (const fam of Object.values(RESEARCH_FAMILIES)) {
      expect(fam.enforce, fam.id).toBe(false);
      if (fam.id !== 'ENERGY') expect(fam.price, fam.id).toBeNull();
    }
    for (const id of Object.keys(RECIPES)) expect(isFamilyGated(id), id).toBe(false);
    expect(validateGameplayCatalog()).toBe(true);
    // A family name is not a license to invent an economy: no recipe may sit behind an
    // unpriced family, and nothing in the catalog claims one today.
    for (const id of Object.keys(RECIPES)) expect(RECIPE_FAMILY[id] === undefined || !!RESEARCH_FAMILIES[RECIPE_FAMILY[id]], id).toBe(true);
  });
  it('starter crafting is untouched: the energy plant is craftable with no study bought', () => {
    const gs = fresh(), r = gs.run!;
    expect(r.tech, 'a fresh run has bought no studies').toEqual({ families: [], recipeRev: RECIPE_REVISION });
    for (const id of DEPLOYABLE_TYPES.map(k => 'deploy_' + k)) {
      expect(r.knowledge.recipes, id).toContain(id);              // still free starter knowledge
      expect(RECIPES[id].base, id).toBe(true);                     // and still a hand-craftable pack
    }
    // P1: the fuel chain is equally ungated today — a fresh run can already pump and refine.
    for (const id of familyMembers('ENERGY')) expect(r.knowledge.recipes, id).toContain(id);
    give(gs, 'iron_ingot', 8); give(gs, 'mechanical_parts', 6); give(gs, 'spares', 12); give(gs, 'brick', 12); give(gs, 'glass', 4);
    expect(act(gs, 'craft', { recipe: 'deploy_refinery' }).ok, 'no study may be required today').toBe(true);
    expect(countItem(gs.run!, 'inv', 'deploy_refinery')).toBe(1);
    // The pack is bought with ITS OWN material cost — exactly once, in materials.
    const paid: Record<string, number> = { iron_ingot: 8, mechanical_parts: 6, spares: 12, brick: 12, glass: 4 };
    for (const [k, q] of RECIPES.deploy_refinery.ins) {
      expect(invCount(gs, k), `${k} paid once`).toBe(paid[k] - q);
      expect(paid[k], `${k} is not over-charged`).toBeGreaterThanOrEqual(q);
    }
    // Placement then spends the pack, never the materials again (ontology contract, WP1).
    const pack = invStack(gs, 'deploy_refinery')!;
    expect(pack.qty).toBe(1);
    expect(ITEMS.deploy_refinery.cat).toBe('place');
  });
  it('refuses to sell a study that withholds nothing, and collects no materials', () => {
    const gs = fresh(), table = station(gs, 'research');
    give(gs, 'spares', 5); give(gs, 'iron_ingot', 2);
    const res = act(gs, 'unlockFamily', { family: 'ENERGY', eid: table.id });
    expect(res.ok).toBe(false);
    expect(res.reason!, 'the player is told why, not silently charged').toMatch(/nothing is withheld/i);
    expect(invCount(gs, 'spares')).toBe(5);
    expect(invCount(gs, 'iron_ingot')).toBe(2);
    expect(table.station!.queue).toHaveLength(0);
  });
  it('with enforcement approved: withheld at spawn, paid once, granted on completion, never researched around', () => {
    enforcing('ENERGY', () => {
      const gs = fresh(), table = station(gs, 'research');
      for (const id of familyMembers('ENERGY')) {
        expect(gs.run!.knowledge.recipes, id).not.toContain(id);   // the study is now the authority
        expect(RECIPES[id].base, id).toBe(true);                   // but the pack is still a physical craft
      }
      give(gs, 'iron_ingot', 8); give(gs, 'mechanical_parts', 6); give(gs, 'spares', 12); give(gs, 'brick', 12); give(gs, 'glass', 4);
      expect(act(gs, 'craft', { recipe: 'deploy_refinery' }).ok).toBe(false);
      expect(invCount(gs, 'spares'), 'a locked formula spends nothing').toBe(12);
      //  random and directed research cannot hand out a withheld formula
      for (let i = 0; i < 30; i++) {
        give(gs, 'spares', BAL.research.randomSparesCost);
        act(gs, 'research', { mode: 'random', eid: table.id });
        stepStations(gs, BAL.research.randomSeconds * 1000 + 500, T0 + 40_000 + i * 1000);
        while (table.station!.queue.length) expect(act(gs, 'cancelJob', { eid: table.id, jobId: table.station!.queue[0].id }).ok).toBe(true);
        for (const id of familyMembers('ENERGY')) expect(gs.run!.knowledge.recipes, id).not.toContain(id);
      }
      for (const id of familyMembers('ENERGY')) {
        give(gs, 'spares', BAL.research.directedSparesCost);
        const res = act(gs, 'research', { mode: 'directed', recipe: id, eid: table.id });
        expect(res.ok, id).toBe(false);
        expect(res.reason!, id).toMatch(/ENERGY study/);
      }
      const spent = { spares: invCount(gs, 'spares'), iron: invCount(gs, 'iron_ingot') };
      expect(act(gs, 'unlockFamily', { family: 'ENERGY', eid: table.id }).ok, 'paid at the table').toBe(true);
      expect(invCount(gs, 'spares'), 'the study costs exactly its 5 spares').toBe(spent.spares - 5);
      expect(invCount(gs, 'iron_ingot'), 'and exactly its 2 iron ingots').toBe(spent.iron - 2);
      expect(table.station!.queue[0].recipe).toBe('F:ENERGY');
      expect(table.station!.queue[0].rv).toBe(RECIPE_REVISION);
      expect(gs.run!.tech?.families ?? [], 'completion, not payment, unlocks').toEqual([]);
      // a cancel returns the paid quantity, then the study can be bought again and finished
      expect(act(gs, 'cancelJob', { eid: table.id, jobId: table.station!.queue[0].id }).ok).toBe(true);
      expect(invCount(gs, 'spares'), 'cancelling gives the exact spares back').toBe(spent.spares);
      expect(invCount(gs, 'iron_ingot')).toBe(spent.iron);
      expect(act(gs, 'unlockFamily', { family: 'ENERGY', eid: table.id }).ok).toBe(true);
      expect(act(gs, 'unlockFamily', { family: 'ENERGY', eid: table.id }).ok, 'no double purchase').toBe(false);
      const mid = reload(gs);
      expect(mid.run!.entities[table.id].station!.queue.length).toBe(1);
      expect(mid.run!.entities[table.id].station!.queue[0].recipe).toBe('F:ENERGY');
      stepStations(mid, BAL.research.directedSeconds * 1000 + 500, T0 + 500_000);
      const done = mid.run!;
      expect(done.tech?.families).toEqual(['ENERGY']);
      for (const id of familyMembers('ENERGY')) expect(done.knowledge.recipes.filter(k => k === id), id).toHaveLength(1);
      const grant = done.receipts.filter(x => x.kind === 'research.family.done').pop()!;
      for (const id of familyMembers('ENERGY')) expect(grant.detail).toContain(id);
      expect(validate(mid)).not.toBeNull();
      // and now the pack is craftable through the real path, paying materials only
      give(mid, 'iron_ingot', 8); give(mid, 'mechanical_parts', 6); give(mid, 'spares', 12); give(mid, 'brick', 12); give(mid, 'glass', 4);
      expect(act(mid, 'craft', { recipe: 'deploy_refinery' }).ok).toBe(true);
      expect(countItem(mid.run!, 'inv', 'deploy_refinery')).toBe(1);
      expect(act(mid, 'unlockFamily', { family: 'ENERGY', eid: table.id }).ok, 'already studied').toBe(false);
    });
  });
  it('an unpriced family cannot be bought, and a fake family cannot be persisted', () => {
    const gs = fresh(), table = station(gs, 'research');
    for (const fam of ['STEEL', 'MOBILITY', 'ELECTRICAL', 'ARMORY', 'CORE_SPECIFIC']) {
      const res = act(gs, 'unlockFamily', { family: fam, eid: table.id });
      expect(res.ok, fam).toBe(false);
      expect(res.reason!, fam).toMatch(/no authorized cost|Nothing is withheld/);
    }
    const bogus = act(gs, 'unlockFamily', { family: 'NOT_A_FAMILY', eid: table.id });
    expect(bogus.ok).toBe(false); expect(bogus.reason!).toMatch(/Unknown research family/);
    expect(table.station!.queue).toHaveLength(0);
    const forged = raw(gs); forged.run.tech = { families: ['NOT_A_FAMILY'], recipeRev: RECIPE_REVISION };
    expect(validate(forged), 'an unknown research family is not a legal save').toBeNull();
    const dup = raw(gs); dup.run.tech = { families: ['ENERGY', 'ENERGY'], recipeRev: RECIPE_REVISION };
    expect(validate(dup), 'a family cannot be bought twice on paper').toBeNull();
    const ahead = raw(gs); ahead.run.tech = { families: ['ENERGY'], recipeRev: RECIPE_REVISION + 5 };
    expect(validate(ahead), 'a save from a future catalog revision is not downgraded').toBeNull();
  });
  it('a legacy save keeps every pack it already knew — enforcement is never retroactive', () => {
    const gs = fresh(), r = gs.run!;
    // A save from before the packs were ever granted, holding exactly one of them (bought from
    // an elder, say). Enforcement must keep what it has and must not re-grant the rest.
    r.knowledge.recipes = r.knowledge.recipes.filter(k => !['deploy_refinery', 'deploy_oil_pump'].includes(k));
    if (!r.knowledge.recipes.includes('deploy_base_generator')) r.knowledge.recipes.push('deploy_base_generator');
    enforcing('ENERGY', () => {
      const saved = raw(gs); delete (saved.run as any).tech;       // written before this ledger existed
      const back = validate(saved)!;
      expect(back, 'an older run still opens').not.toBeNull();
      expect(back.run!.knowledge.recipes).toContain('deploy_base_generator');
      // the save-time re-grant must not hand out a second family formula either
      expect(back.run!.knowledge.recipes).not.toContain('deploy_refinery');
      give(back, 'iron_ingot', 3); give(back, 'mechanical_parts', 3); give(back, 'spares', 4); give(back, 'wood', 6);
      expect(act(back, 'craft', { recipe: 'deploy_base_generator' }).ok, 'no retroactive paywall').toBe(true);
      expect(invCount(back, 'iron_ingot') + invCount(back, 'spares') + invCount(back, 'wood')).toBe(0);
      expect(validate(back)).not.toBeNull();
    });
    expect(fresh().run!.knowledge.recipes).toContain('deploy_refinery');             // outside the flip, nothing is withheld
  });
});
