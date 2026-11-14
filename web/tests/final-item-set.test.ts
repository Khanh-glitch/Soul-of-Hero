// ARENA 1 — FINAL ITEM SET v2 (Bible §0.2a): registry, recipes, Veyra sources, engine scenarios, migration.
//
// What this file IS: the catalog/roster contract, a measured survey of the real Veyra window data, and ENGINE
// scenarios that go through the real intents (`dispatch`), the real harvest and kill functions, the real station
// clock and the real save loader. What it is NOT: a browser play-through. Station and garden entities are placed
// as labelled fixtures (position and ownership only); nothing here is evidence for PLAYABLE. See
// `final-item-ledger.ts` ITEM_STATUS.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ITEMS, RECIPES, SOURCES, CREATURES, STRUCTS, GARDEN_CROPS, GARDEN_CROP_KINDS, RECIPE_REVISION, RETIRED_RECIPES, starterKnowledge, recipeForJob, validateGameplayCatalog } from '../src/game/catalog';
import { LEGACY_RECIPES, CUT_OVER_REVISIONS } from '../src/game/recipe-migration';
import { FINAL_ITEMS, FINAL_ITEM_IDS, ITEM_RETIREMENT, ITEM_SET_VERSION, LEGACY_STONE_IDS, RECIPE_SUCCESSOR, RETIRED_ITEM_IDS, isRetiredLive, liveItemId } from '../src/game/final-item-set';
import { DRAFT_RECIPES_NOT_LIVE, ITEM_SOURCE, LI_RECIPE_LEDGER, VISUAL_BRIEF, statusOf } from '../src/game/final-item-ledger';
import { TILE, WW, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, dispatch, harvestHit, killCreature, markDirty, mkContainer, mkCreature, mkStack, newGame, spawnDrop, startRun, stepGardensBarrels, stepStations } from '../src/game/engine';
import { serializeSnapshot, validate } from '../src/game/persist';
import { setActiveLayout } from '../src/game/world';
import { getWindowWorld } from '../src/veyra05/window';
import { SCENE_IDS, U05_WORLD_LAYOUT_ID, VEYRA05_SCENES } from '../src/veyra05/scenes';
import { ORDINARY_CREATURE_HABITATS } from '../src/veyra05/ecosystem';

const ROSTER = JSON.parse(readFileSync('ref/last-island-copy-first/FINAL_THREE_GROUP_ITEM_SET_20261115.json', 'utf8'));
const WRITE = process.env.SOH_WRITE_ARENA1 === '1';
const NEW_IDS = FINAL_ITEM_IDS.filter(id => FINAL_ITEMS[id][1] === 'LI_IMPORTED' || id.startsWith('seed_'));
const LIVE_RETIRED = Object.keys(ITEM_RETIREMENT).filter(isRetiredLive);
const REV4 = Object.keys(RECIPES).filter(k => RECIPES[k].rev === 4);

const T0 = Date.UTC(2026, 10, 14, 12); let seq = 0;
const act = (gs: GameState, type: string, p: object = {}, now?: number) => dispatch(gs, { id: 'fis-' + (++seq), type, ...p } as any, now ?? T0 + 10 + seq * 1000);
function veyraRun(character: 'male' | 'female', seed: number) {
  expect(setActiveLayout(U05_WORLD_LAYOUT_ID)).toBe(true);
  const gs = newGame(); const rc = startRun(gs, character, T0, null, seed); expect(rc.ok, JSON.stringify(rc)).toBe(true);
  gs.run!.creatures = []; return gs;
}
/** FIXTURE: a station beside the player. Position/ownership only; every transaction below is the real intent. */
function station(gs: GameState, type: 'workbench' | 'furnace' | 'campfire', level?: 1 | 2 | 3): Entity {
  const r = gs.run!, p = r.player, fuel = mkContainer(r, 'fuel', 3), out = mkContainer(r, 'out', 6);
  const e: Entity = { id: 'fis-st-' + (++seq), kind: 'struct', type, x: p.x + 16, y: p.y, tx: Math.floor(p.x / TILE) + 1, ty: Math.floor(p.y / TILE), hp: 200, maxHp: 200, station: { fuelC: fuel.id, outC: out.id, burn: 0, queue: [], ...(level ? { level } : {}) } } as Entity;
  if ((r as any).veyraFloor) (e as any).floor = (r as any).veyraFloor;
  r.entities[e.id] = e; markDirty(); return e;
}
const give = (gs: GameState, key: string, qty = 1) => { expect(addItem(gs.run!, 'inv', key, qty), key).toBe(0); };
const inv = (gs: GameState, key: string) => countItem(gs.run!, 'inv', key);
const learn = (gs: GameState, ...ids: string[]) => { for (const id of ids) if (!gs.run!.knowledge.recipes.includes(id)) gs.run!.knowledge.recipes.push(id); };
function craftAt(gs: GameState, e: Entity, recipe: string, fuelKey?: string) {
  if (fuelKey) addItem(gs.run!, e.station!.fuelC, fuelKey, 4);
  const rc = act(gs, 'craft', { eid: e.id, recipe }); expect(rc.ok, recipe + ': ' + JSON.stringify(rc)).toBe(true);
  stepStations(gs, RECIPES[recipe].secs * 1000 + 500, T0 + 900_000 + (++seq) * 1000);
  const out = RECIPES[recipe].out; const n = countItem(gs.run!, e.station!.outC, out); expect(n, recipe + ' output').toBeGreaterThan(0);
  const slot = C(gs.run!, e.station!.outC).slots.findIndex(s => s?.key === out);
  expect(act(gs, 'move', { from: e.station!.outC, fs: slot, to: 'inv' }).ok).toBe(true);
}
const snapshot = (gs: GameState) => JSON.parse(JSON.parse(serializeSnapshot(gs)).payload) as GameState;

describe('II — registration: the runtime registry is the roster, and every id is a real catalog row', () => {
  it('projects the design roster verbatim: 157 = A 78 + B 42 + C 37', () => {
    expect(FINAL_ITEM_IDS).toHaveLength(157);
    expect(FINAL_ITEM_IDS).toEqual(ROSTER.final_items.map((x: any) => x.id));
    for (const x of ROSTER.final_items) expect([...FINAL_ITEMS[x.id]], x.id).toEqual(x.li_id ? [x.group, x.origin, x.li_id] : [x.group, x.origin]);
    const by = (g: string) => FINAL_ITEM_IDS.filter(id => FINAL_ITEMS[id][0] === g).length;
    expect([by('A'), by('B'), by('C')]).toEqual([78, 42, 37]);
    expect(RETIRED_ITEM_IDS).toEqual(ROSTER.retired_soh_ids.map((x: any) => x.id));
    expect(LEGACY_STONE_IDS).toEqual(ROSTER.legacy_soh_ids.map((x: any) => x.id));
    expect(Object.keys(ITEM_RETIREMENT).sort()).toEqual([...RETIRED_ITEM_IDS].sort());
  });
  it('every roster id resolves to exactly one catalog row with a name, a description, a weight and a stack size', () => {
    expect(validateGameplayCatalog()).toBe(true);
    for (const id of FINAL_ITEM_IDS) {
      if (id === 'door_powered') { expect(STRUCTS.door_powered, 'powered door is a structure, not a pack').toBeDefined(); expect(ITEMS[id]).toBeUndefined(); continue; }
      const d = ITEMS[id]; expect(d, id).toBeDefined();
      expect(d.name.length, id).toBeGreaterThan(2); expect(d.desc.length, id).toBeGreaterThan(8);
      expect(d.w, id).toBeGreaterThan(0); expect(d.max, id).toBeGreaterThanOrEqual(1); expect(typeof d.icon, id).toBe('string');
    }
    for (const id of NEW_IDS) expect(ITEMS[id].vi, id + ' Vietnamese name').toBeTruthy();
    expect(NEW_IDS).toHaveLength(34);
  });
  it('no roster id is a retired id, and the catalog holds no id outside roster + retired + legacy stones', () => {
    const allowed = new Set([...FINAL_ITEM_IDS, ...RETIRED_ITEM_IDS, ...LEGACY_STONE_IDS]);
    for (const id of RETIRED_ITEM_IDS) expect(FINAL_ITEMS[id], id).toBeUndefined();
    const outside = Object.keys(ITEMS).filter(id => !allowed.has(id));
    expect(outside, 'every catalog id is in the roster, or ordered retired, or a legacy stone').toEqual([]);
  });
});

describe('retirement — 7 ids LIVE, 12 PENDING (never counted as done)', () => {
  it('stages are exactly as declared', () => {
    expect(LIVE_RETIRED.sort()).toEqual(['fuel_briquette', 'herb_roast', 'iron_sword', 'root_broth', 'salted_meat', 'seed', 'vehicle_drive']);
    for (const [id, r] of Object.entries(ITEM_RETIREMENT)) if (r.stage === 'PENDING') expect(r.blockedBy, id).toBeTruthy();
  });
  it('a LIVE-retired id has a 1:1 successor that is final, not retired, and can hold the old stack', () => {
    for (const id of LIVE_RETIRED) {
      const to = liveItemId(id); expect(to, id).not.toBe(id); expect(FINAL_ITEMS[to], id + '->' + to).toBeDefined();
      expect(ITEMS[to].max, id).toBeGreaterThanOrEqual(ITEMS[id].max);
    }
  });
  it('nothing live produces, consumes, yields, drops or costs a LIVE-retired id', () => {
    const dead = new Set(LIVE_RETIRED); const hits: string[] = [];
    for (const [k, rc] of Object.entries(RECIPES)) { if (dead.has(rc.out)) hits.push('recipe out ' + k); for (const [i] of rc.ins) if (dead.has(i)) hits.push('recipe in ' + k + ':' + i); for (const [o] of rc.outs ?? []) if (dead.has(o)) hits.push('recipe outs ' + k); }
    for (const [k, s] of Object.entries(SOURCES)) for (const [i] of [...s.yields, ...(s.bonus ?? [])]) if (dead.has(i)) hits.push('source ' + k + ':' + i);
    for (const [k, c] of Object.entries(CREATURES)) for (const [i] of c.drops) if (dead.has(i)) hits.push('creature ' + k + ':' + i);
    for (const [k, s] of Object.entries(STRUCTS)) for (const [i] of s.cost) if (dead.has(i)) hits.push('struct ' + k + ':' + i);
    for (const g of Object.values(GARDEN_CROPS)) for (const [i] of [...g.inputs, ...g.output]) if (dead.has(i)) hits.push('garden ' + i);
    for (const [k, d] of Object.entries(ITEMS)) { if (dead.has(k)) continue; for (const [i] of [...(d.repair?.cost ?? []), ...(d.salvage?.yields ?? [])]) if (dead.has(i)) hits.push('item ' + k + ':' + i); if (d.specimen && RETIRED_RECIPES.includes(d.specimen)) hits.push('specimen ' + k); }
    expect(hits).toEqual([]);
    for (const k of starterKnowledge()) expect(RECIPES[k], 'starter ' + k).toBeDefined();
  });
  it('the minting choke point: mkStack, addItem and spawnDrop can no longer create a retired stack', () => {
    const gs = veyraRun('male', 4021), r = gs.run!;
    for (const id of LIVE_RETIRED) {
      expect(mkStack(r, id, 1).key).toBe(liveItemId(id));
      expect(addItem(r, 'inv', id, 1)).toBe(0); expect(inv(gs, id)).toBe(0); expect(inv(gs, liveItemId(id))).toBeGreaterThan(0);
      const drop = spawnDrop(r, id, 1, r.player.x, r.player.y, T0); expect(C(r, drop.c!).slots[0]!.key).toBe(liveItemId(id));
    }
    expect(mkStack(r, 'blueprint', 1, 'iron_sword').meta).toBe('machete');
    expect(r.itemSetVersion).toBe(ITEM_SET_VERSION);
  });
});

describe('III — recipes: LI provenance, closure and no loops', () => {
  it('recipe revision 4 freezes every formula it changed or retired', () => {
    expect(RECIPE_REVISION).toBe(4);
    for (const id of CUT_OVER_REVISIONS[3]) expect(LEGACY_RECIPES[id + '@3'], id).toBeDefined();
    for (const id of Object.keys(RECIPE_SUCCESSOR)) { expect(RECIPES[id], id).toBeUndefined(); expect(RETIRED_RECIPES).toContain(id); expect(recipeForJob(id, 3), id).not.toBeNull(); }
    expect(recipeForJob('motorbike_kit', 3)!.ins).toContainEqual(['vehicle_drive', 1]);
    expect(recipeForJob('motorbike_kit', 4)!.ins).toEqual([['vehicle_frame', 1], ['mechanical_gear', 2], ['iron_plate', 3], ['refined_iron_ingot', 4]]);
  });
  it('every formula added or changed at rev 4 has a ledger row; LI_EXACT rows really are the LI numbers', () => {
    const audit: Record<string, any> = Object.fromEntries(ROSTER.li_source_audit.map((a: any) => [a.li_id, a]));
    const alias: Record<string, string> = { animal_meat: 'meat', wild_berry: 'berries', animal_hide: 'hide', parts: 'spares' };
    for (const id of REV4) {
      const row = LI_RECIPE_LEDGER[id]; expect(row, 'ledger row for ' + id).toBeDefined();
      if (row.li_id) { expect(audit[row.li_id], row.li_id).toBeDefined(); expect(row.li, id).toEqual(audit[row.li_id].recipe); expect(row.grade, id).toBe(audit[row.li_id].source_support); }
      if (row.kind === 'LI_EXACT') expect(Object.fromEntries(RECIPES[id].ins), id).toEqual(Object.fromEntries(Object.entries(row.li!).map(([k, v]) => [alias[k] ?? k, v])));
      expect(row.reason.length, id).toBeGreaterThan(10); expect(row.impact.length, id).toBeGreaterThan(10);
    }
    for (const [key, row] of Object.entries(LI_RECIPE_LEDGER)) if (key.startsWith('struct:')) { expect(STRUCTS[key.slice(7)], key).toBeDefined(); expect(row.li).toEqual(audit[row.li_id!].recipe); }
    for (const [id, d] of Object.entries(DRAFT_RECIPES_NOT_LIVE)) { expect(RECIPES[id], id + ' must not be craftable while blocked').toBeUndefined(); expect(d.li ?? null).toEqual(audit[FINAL_ITEMS[id][2] ?? id]?.recipe ?? null); }
  });
  it('no formula needs its own product, and no rev-4 product can be turned back into more of its inputs', () => {
    for (const [k, rc] of Object.entries(RECIPES)) for (const [i] of rc.ins) expect(i, k).not.toBe(rc.out);
    for (const id of REV4) {
      const out = RECIPES[id].out, d = ITEMS[out];
      expect(d.salvage?.yields.reduce((n, [, q]) => n + q, 0) ?? 0, out + ' salvage').toBeLessThan(RECIPES[id].ins.reduce((n, [, q]) => n + q, 0));
      for (const [k, rc] of Object.entries(RECIPES)) if (rc.ins.some(([i]) => i === out)) expect(RECIPES[id].ins.map(([i]) => i), k + ' must not return an input of ' + id).not.toContain(rc.out);
    }
  });
  it('every input of every rev-4 formula is reachable from a physical source without an Elder, a Core or a start gift', () => {
    const have = new Set<string>();
    for (const s of Object.values(SOURCES)) for (const [i] of [...s.yields, ...(s.bonus ?? [])]) have.add(i);
    for (const c of Object.values(CREATURES)) for (const [i] of c.drops) have.add(i);
    for (const g of Object.values(GARDEN_CROPS)) for (const [i] of g.output) have.add(i);
    for (let pass = 0; pass < 8; pass++) for (const rc of Object.values(RECIPES)) if (!ITEMS[rc.out].creatorCore && !ITEMS[rc.out].core && rc.ins.every(([i]) => have.has(i) && !ITEMS[i].creatorCore && !ITEMS[i].core && !i.startsWith('stone_s'))) { have.add(rc.out); for (const [o] of rc.outs ?? []) have.add(o); }
    for (const id of REV4) for (const [i] of RECIPES[id].ins) expect(have.has(i), id + ' <- ' + i).toBe(true);
    for (const id of NEW_IDS) if (statusOf(id).status !== 'BLOCKED') expect(have.has(id), id + ' obtainable').toBe(true);
    for (const id of Object.keys(DRAFT_RECIPES_NOT_LIVE)) expect(have.has(id), id + ' must not be issued while blocked').toBe(false);
  });
});

describe('IV — Veyra: measured from the real window data, not from the catalog', () => {
  it('surveys all twelve regions and the spawn tables; every loot/drop source of a new id exists on Veyra', () => {
    const perScene: Record<string, Record<string, number>> = {}; const total: Record<string, number> = {};
    for (const id of SCENE_IDS) {
      expect(setActiveLayout(id), id).toBe(true);
      const ww = getWindowWorld(id)!; const cnt: Record<string, number> = {};
      for (const s of ww.floors.ground.sources) if (s) { cnt[s] = (cnt[s] || 0) + 1; total[s] = (total[s] || 0) + 1; }
      perScene[id] = cnt;
    }
    const firstHour = VEYRA05_SCENES.filter(s => s.firstHour).map(s => s.id);
    const anchored = [...new Set(ORDINARY_CREATURE_HABITATS.map(h => h.species))];
    const survey = { note: 'Counts are source TILES in the 200x200 window around each of the 12 scene foci (windows can overlap; this is presence and relative density, not a world total).', firstHourScenes: firstHour, perScene, totalAcrossWindows: total, anchoredSpecies: anchored };
    if (WRITE) { mkdirSync('evidence/arena1', { recursive: true }); writeFileSync('evidence/arena1/veyra-source-survey.json', JSON.stringify(survey, null, 1) + '\n'); }
    // Seeds, berries, fiber: in at least one first-hour window each.
    for (const src of ['grass', 'bush', 'herb']) expect(firstHour.some(id => (perScene[id][src] || 0) > 0), src + ' in a first-hour region').toBe(true);
    // Tins / tubes / electronics need salvage nodes somewhere on the map.
    expect((total.scrap || 0) + (total.wreck || 0)).toBeGreaterThan(0);
    for (const [item, rows] of Object.entries(ITEM_SOURCE)) for (const row of rows) {
      const [table, key] = row.source_id.split('.');
      if (table === 'SOURCES') { expect(SOURCES[key], row.source_id).toBeDefined(); expect([...SOURCES[key].yields, ...(SOURCES[key].bonus ?? [])].map(([i]) => i), row.source_id).toContain(item); expect(total[key] || 0, row.source_id + ' placed on Veyra').toBeGreaterThan(0); }
      else { expect(CREATURES[key].drops.map(([i]) => i), row.source_id).toContain(item); }
    }
    expect(setActiveLayout(U05_WORLD_LAYOUT_ID)).toBe(true);
  }, 300_000);
});

describe('VI — engine scenarios on the Veyra world (two spawns, real intents, fixture stations)', () => {
  it('S1 knife survival, spawn A: grass gives fiber and — sometimes — a Sunroot seed; wood becomes a club; no Core needed', () => {
    const gs = veyraRun('male', 4021), r = gs.run!, ww = getWindowWorld(r.layoutId!)!;
    expect(C(r, 'inv').slots.some(s => s && (ITEMS[s.key].creatorCore || ITEMS[s.key].core)), 'no Core in the start kit').toBe(false);
    for (const id of NEW_IDS) expect(inv(gs, id), 'start kit must not gift ' + id).toBe(0);
    const knife = ITEMS.knife.power!; let seeds = 0, fiber = 0, hits = 0;
    const src = ww.floors.ground.sources;
    for (let i = 0; i < src.length && seeds < 1; i++) if (src[i] === 'grass') {
      const tx = i % WW, ty = Math.floor(i / WW);
      for (let k = 0; k < 6; k++) { const h = harvestHit(gs, tx, ty, knife, T0 + (++hits) * 400, tx * TILE, ty * TILE); if (h.result === 'depleted' || h.result === 'none') break; }
      for (const e of Object.values(r.entities)) if (e.kind === 'drop' && e.c) { const s = C(r, e.c).slots[0]; if (s) { addItem(r, 'inv', s.key, s.qty); C(r, e.c).slots[0] = null; } }
      seeds = inv(gs, 'seed_sunroot'); fiber = inv(gs, 'fiber') + 0;
      if (fiber > 30) { /* keep the pack from filling with fiber */ const sl = C(r, 'inv').slots.findIndex(s => s?.key === 'fiber'); C(r, 'inv').slots[sl] = null; }
    }
    expect(seeds, 'a Sunroot seed from wild grass with the starting knife').toBeGreaterThan(0);
    expect(inv(gs, 'seed'), 'the generic seed no longer exists').toBe(0);
    give(gs, 'wood', 12); expect(act(gs, 'craft', { recipe: 'wood_club' }).ok).toBe(true);
    expect(inv(gs, 'wood_club')).toBe(1); expect(inv(gs, 'wood')).toBe(0);
    expect(C(r, 'inv').slots.find(s => s?.key === 'wood_club')!.dur).toBe(ITEMS.wood_club.dur);
  });
  it('S1b spawn B: a boar pays fat, the fat renders into a canister at a furnace, and a second spawn point works the same', () => {
    const gs = veyraRun('female', 0x5eeda00), r = gs.run!;
    let fat = 0;
    for (let k = 0; k < 14; k++) { const m = mkCreature(r, 'boar', r.player.x + 20, r.player.y, CREATURES.boar.hp); r.creatures.push(m); killCreature(gs, m, T0 + k * 1000); }
    for (const e of Object.values(r.entities)) if (e.kind === 'drop' && e.c) { const s = C(r, e.c).slots[0]; if (s?.key === 'animal_fat') { fat += s.qty; } }
    expect(fat, 'boars drop Animal Fat (80% each)').toBeGreaterThanOrEqual(6);
    give(gs, 'animal_fat', 6); give(gs, 'cloth', 1);
    const f = station(gs, 'furnace');
    expect(act(gs, 'craft', { eid: f.id, recipe: 'low_quality_fuel' }).ok, 'tier-1 formula is NOT starter knowledge').toBe(false);
    learn(gs, 'low_quality_fuel'); craftAt(gs, f, 'low_quality_fuel', 'wood');
    expect(inv(gs, 'fuel_can')).toBe(1); expect(inv(gs, 'animal_fat')).toBe(0);
  });
  it('S3 LI food chain at a campfire: dried meat, grilled mushroom, tinned soup / meat / wine / jam, hand-pressed juice — and eating them', () => {
    const gs = veyraRun('male', 4021), r = gs.run!, fire = station(gs, 'campfire');
    const kitBerries = inv(gs, 'berries'); // the start kit's own food is not part of this chain
    give(gs, 'meat', 4); give(gs, 'mushroom', 6); give(gs, 'berries', 18); give(gs, 'tin_can', 4); give(gs, 'cloth', 1);
    for (const id of ['dried_meat', 'grilled_mushroom', 'mushroom_soup', 'canned_meat', 'fruit_wine', 'jam']) { expect(r.knowledge.recipes, id + ' is campfire starter knowledge').toContain(id); craftAt(gs, fire, id, 'wood'); expect(inv(gs, id), id).toBe(1); }
    const juice = act(gs, 'craft', { recipe: 'fruit_juice' }); expect(juice.ok, JSON.stringify(juice)).toBe(true); expect(inv(gs, 'fruit_juice')).toBe(1);
    expect([inv(gs, 'meat'), inv(gs, 'mushroom'), inv(gs, 'berries') - kitBerries, inv(gs, 'tin_can'), inv(gs, 'cloth')]).toEqual([0, 0, 0, 0, 0]);
    const p = r.player; p.hunger = 10; p.thirst = 10;
    const eat = (key: string) => { const slot = C(r, 'inv').slots.findIndex(s => s?.key === key); return act(gs, 'useItem', { c: 'inv', slot }); };
    const h0 = p.hunger; expect(eat('canned_meat').ok).toBe(true); expect(p.hunger - h0).toBe(70); expect(inv(gs, 'canned_meat')).toBe(0);
    const t0 = p.thirst; expect(eat('fruit_juice').ok).toBe(true); expect(p.thirst).toBeGreaterThan(t0);
    // Counter-example: no tin, no soup. Nothing is spent.
    give(gs, 'mushroom', 5); expect(act(gs, 'craft', { eid: fire.id, recipe: 'mushroom_soup' }).ok).toBe(false); expect(inv(gs, 'mushroom')).toBe(5);
  });
  it('S3b armour chain: cloth + iron -> needle thread -> iron plate helmet and chest; worn, they cut damage; legs and boots cannot be made', () => {
    const gs = veyraRun('male', 4021), r = gs.run!, bench = station(gs, 'workbench', 2);
    learn(gs, 'needle_thread', 'iron_plate_helmet', 'iron_plate_chest', 'syringe', 'machete', 'cleaver');
    give(gs, 'cloth', 6); give(gs, 'iron_ingot', 3); for (let k = 0; k < 3; k++) craftAt(gs, bench, 'needle_thread');
    expect(inv(gs, 'needle_thread')).toBe(6);
    give(gs, 'iron_plate', 4); give(gs, 'hide', 7); craftAt(gs, bench, 'iron_plate_helmet'); craftAt(gs, bench, 'iron_plate_chest');
    expect([inv(gs, 'needle_thread'), inv(gs, 'iron_plate'), inv(gs, 'hide')]).toEqual([0, 0, 0]);
    for (const [key, slot] of [['iron_plate_helmet', 0], ['iron_plate_chest', 1]] as const) {
      const fs = C(r, 'inv').slots.findIndex(s => s?.key === key); expect(act(gs, 'move', { from: 'inv', fs, to: 'eq', ts: slot }).ok, 'equip ' + key).toBe(true);
    }
    expect(C(r, 'eq').slots.reduce((n, s) => n + (s ? ITEMS[s.key].armor || 0 : 0), 0)).toBeCloseTo(0.42);
    give(gs, 'iron_plate_pants'); const fs = C(r, 'inv').slots.findIndex(s => s?.key === 'iron_plate_pants');
    for (const ts of [0, 1, 2]) expect(act(gs, 'move', { from: 'inv', fs, to: 'eq', ts }).ok, 'pants must not fit slot ' + ts).toBe(false);
    for (const id of ['iron_plate_pants', 'iron_plate_boots', 'refined_iron_legs', 'refined_iron_boots', 'wooden_ladder']) expect(act(gs, 'craft', { eid: bench.id, recipe: id }).ok, id).toBe(false);
    give(gs, 'needle_tube'); give(gs, 'animal_fat', 2); give(gs, 'iron_ingot', 1); craftAt(gs, bench, 'syringe');
    r.player.hp = 40; const sl = C(r, 'inv').slots.findIndex(s => s?.key === 'syringe'); expect(act(gs, 'useItem', { c: 'inv', slot: sl }).ok).toBe(true); expect(r.player.hp).toBe(75);
    give(gs, 'iron_ingot', 4); give(gs, 'metal_blade', 3); craftAt(gs, bench, 'machete'); expect(inv(gs, 'machete')).toBe(1); expect(RECIPES.iron_sword).toBeUndefined();
  });
  it('S6 garden: each cultivar takes its own seed and returns exactly that one seed — replanting never multiplies seed', () => {
    for (const kind of GARDEN_CROP_KINDS) {
      const gs = veyraRun('male', 4021), r = gs.run!, p = r.player, rule = GARDEN_CROPS[kind], seed = rule.inputs[0][0];
      const e: Entity = { id: 'fis-plot-' + kind, kind: 'struct', type: 'garden', x: p.x + 8, y: p.y, tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE), hp: 60, maxHp: 60, garden: { crop: null, growth: 0, water: 0 } } as Entity;
      if ((r as any).veyraFloor) (e as any).floor = (r as any).veyraFloor; r.entities[e.id] = e; markDirty();
      expect(act(gs, 'garden', { eid: e.id, crop: kind }).ok, 'no seed, no planting').toBe(false);
      give(gs, seed, 1);
      for (const other of GARDEN_CROP_KINDS) if (other !== kind) expect(act(gs, 'garden', { eid: e.id, crop: other }).ok, kind + ' seed must not plant ' + other).toBe(false);
      expect(act(gs, 'garden', { eid: e.id, crop: kind }).ok).toBe(true); expect(inv(gs, seed)).toBe(0); expect(e.garden!.crop).toBe(kind);
      act(gs, 'garden', { eid: e.id }); // unripe: this can only water the plot (if a flask has a charge), never pay out
      expect([inv(gs, seed), inv(gs, rule.output[0][0]) - (kind === 'berry' ? 0 : 0)], 'an unripe plot pays nothing').toEqual([0, inv(gs, rule.output[0][0])]); expect(e.garden!.crop).toBe(kind);
      const produce0 = inv(gs, rule.output[0][0]);
      const saved = snapshot(gs); expect(validate(saved), kind + ' plot survives a save').toBeTruthy();
      e.garden!.water = 3; let at = T0 + 60_000; for (let k = 0; k < 400 && e.garden!.growth < 1; k++) { stepGardensBarrels(gs, 30_000, true, at); at += 30_000; }
      expect(e.garden!.growth, kind + ' ripens under rain').toBe(1);
      expect(act(gs, 'garden', { eid: e.id }).ok).toBe(true);
      expect(inv(gs, seed), 'exactly the planted seed comes back').toBe(1);
      expect(inv(gs, rule.output[0][0]) - produce0).toBe(rule.output[0][1]);
      expect(rule.output.filter(([k]) => k.startsWith('seed')).reduce((n, [, q]) => n + q, 0)).toBe(rule.inputs.filter(([k]) => k.startsWith('seed')).reduce((n, [, q]) => n + q, 0));
    }
  });
});

describe('VI.11 — save migration across a serialize / validate boundary', () => {
  /** An OLD save: serialized from a real run, then the retired stacks are written into the RAW payload — exactly what
   *  a file saved before the cutover contains. (They cannot be placed in the live state: the save path validates, and
   *  therefore migrates, before it serializes.) */
  function oldSave() {
    const gs = veyraRun('male', 4021), r = gs.run!, chest = mkContainer(r, 'chest', 6);
    const e: Entity = { id: 'fis-chest', kind: 'struct', type: 'chest_small', x: r.player.x + 16, y: r.player.y, tx: Math.floor(r.player.x / TILE) + 1, ty: Math.floor(r.player.y / TILE), hp: 100, maxHp: 100, c: chest.id } as Entity;
    if ((r as any).veyraFloor) (e as any).floor = (r as any).veyraFloor; r.entities[e.id] = e; markDirty();
    const raw: any = snapshot(gs); const rr = raw.run; delete rr.itemSetVersion;
    const put = (cid: string, i: number, key: string, qty: number, extra: object = {}) => { rr.custody[cid].slots[i] = { uid: 's' + (rr.nextId++).toString(36), key, qty, ...extra }; };
    const free = rr.custody.inv.slots.map((s: any, i: number) => s ? -1 : i).filter((i: number) => i >= 0);
    put('inv', free[0], 'seed', 37); put('inv', free[1], 'iron_sword', 1, { dur: 175 }); put('inv', free[2], 'blueprint', 1, { meta: 'iron_sword' }); put('inv', free[3], 'salted_meat', 3);
    put(chest.id, 0, 'vehicle_drive', 2); put(chest.id, 1, 'fuel_briquette', 30); put(chest.id, 2, 'root_broth', 4); put(chest.id, 3, 'herb_roast', 5); put(chest.id, 4, 'scrap', 9);
    rr.knowledge.recipes.push('iron_sword', 'vehicle_drive', 'salted_meat');
    return { raw, chestId: chest.id };
  }
  it('converts every retired stack in place — same uid, same count — once, and a second load changes nothing', () => {
    const { raw, chestId } = oldSave();
    const uids = (g: any) => Object.values(g.run.custody).flatMap((c: any) => c.slots.filter(Boolean).map((s: any) => s.uid + ':' + s.qty)).sort();
    const before = uids(raw);
    const back = validate(raw)!; expect(back, 'an old save must load').toBeTruthy(); const r = back.run!;
    expect(uids(back), 'no stack deleted, none minted, no count changed').toEqual(before);
    const keys = (cid: string) => C(r, cid).slots.filter(Boolean).map(s => `${s!.key}x${s!.qty}`);
    expect(keys('inv')).toEqual(expect.arrayContaining(['seed_sunrootx37', 'machetex1', 'blueprintx1', 'dried_meatx3']));
    expect(keys(chestId)).toEqual(['mechanical_gearx2', 'charcoalx30', 'mushroom_soupx4', 'cooked_meatx5', 'scrapx9']);
    expect(C(r, 'inv').slots.find(s => s?.key === 'machete')!.dur, 'half-worn sword -> half-worn machete').toBe(175);
    expect(C(r, 'inv').slots.find(s => s?.key === 'blueprint')!.meta).toBe('machete');
    expect(r.itemSetVersion).toBe(ITEM_SET_VERSION); expect(r.migrated!.retiredItems).toBe(8);
    expect(r.knowledge.recipes).toContain('machete'); expect(r.knowledge.recipes).toContain('dried_meat');
    for (const dead of ['iron_sword', 'vehicle_drive', 'salted_meat']) expect(r.knowledge.recipes).not.toContain(dead);
    for (const c of Object.values(r.custody)) for (const s of c.slots) if (s) expect(isRetiredLive(s.key), s.key).toBe(false);
    // PENDING ids are untouched — they are not retired yet and this file does not pretend otherwise.
    expect(countItem(r, chestId, 'scrap')).toBe(9);
    const again = validate(snapshot(back))!; expect(again).toBeTruthy(); expect(again.run!.migrated!.retiredItems, 'idempotent').toBe(8); expect(uids(again)).toEqual(before);
  });
  it('a job queued under revision 3 still completes, pays once, and pays the successor item', () => {
    const gs = veyraRun('male', 4021), r = gs.run!, fire = station(gs, 'campfire');
    addItem(r, fire.station!.fuelC, 'wood', 4);
    fire.station!.queue.push({ id: 'fis-oldjob', recipe: 'salted_meat', left: 10_000, total: 10_000, rv: 3 } as any);
    const raw: any = snapshot(gs); delete raw.run.itemSetVersion;
    const back = validate(raw)!; expect(back, 'a save holding a retired-recipe job must load').toBeTruthy();
    const st = back.run!.entities[fire.id].station!; expect(st.queue).toHaveLength(1);
    stepStations(back, 11_000, T0 + 2_000_000);
    expect(st.queue).toHaveLength(0); expect(countItem(back.run!, st.outC, 'dried_meat')).toBe(1); expect(countItem(back.run!, st.outC, 'salted_meat')).toBe(0);
    stepStations(back, 60_000, T0 + 2_100_000); expect(countItem(back.run!, st.outC, 'dried_meat'), 'paid exactly once').toBe(1);
    expect(dispatch(back, { id: 'fis-retired', type: 'craft', eid: fire.id, recipe: 'salted_meat' } as any, T0 + 2_200_000).ok, 'the retired formula cannot be queued again').toBe(false);
  });
  it('fails closed on a save stamped by a newer item set', () => {
    const gs = veyraRun('male', 4021); const raw: any = snapshot(gs); raw.run.itemSetVersion = ITEM_SET_VERSION + 1; expect(validate(raw)).toBeNull();
  });
});

describe('V — asset contract: ITEM_VISUAL_HANDOFF.json is generated from the registry, one row per id', () => {
  const PATH = 'ref/last-island-copy-first/ITEM_VISUAL_HANDOFF.json';
  function build() {
    const usage: Record<string, number> = {}; for (const id of FINAL_ITEM_IDS) { const k = ITEMS[id]?.icon; if (k) usage[k] = (usage[k] || 0) + 1; }
    const rows = FINAL_ITEM_IDS.map(id => {
      const d = ITEMS[id], st = id === 'door_powered' ? STRUCTS.door_powered : null, brief = VISUAL_BRIEF[id], [group, origin, li] = FINAL_ITEMS[id];
      const isNew = !!brief, isPack = origin === 'STRUCT_PACK';
      const asset_status = isNew ? 'TEMP_FALLBACK' : isPack ? 'TEMP_SHARED_PACK_ICON' : id === 'door_powered' ? 'NO_ITEM_ICON_STRUCTURE_ONLY' : usage[d.icon] > 1 ? 'EXISTING_SHARED_ICON' : 'EXISTING_ICON';
      return {
        item_id: id, icon_key: id, current_art_key: d?.icon ?? null, palette: d ? [d.c1, d.c2] : null,
        name: d?.name ?? st!.name, name_vi: d?.vi ?? null, group, origin, li_id: li ?? null,
        physical_shape: brief?.shape ?? (isPack ? 'packed crate of the structure "' + d.name + '"; needs its own pack silhouette showing the device' : 'as drawn today by art key "' + (d?.icon ?? 'structure') + '"; no new brief written in round 1'),
        material: brief?.material ?? null, colour_silhouette: brief?.silhouette ?? null, display_size: brief?.size ?? null,
        contexts: brief?.contexts ?? (isPack ? ['inventory', 'world_drop', 'placed'] : id === 'door_powered' ? ['placed'] : ['inventory', 'world_drop']),
        asset_status, gameplay_status: statusOf(id).status,
      };
    });
    return {
      schema: 'soh-item-visual-handoff-v1', generated_by: 'web/tests/final-item-set.test.ts (SOH_WRITE_ARENA1=1)', owner_of_final_pixels: 'Arena 2',
      contract: [
        '`icon_key` is the stable asset id and always equals `item_id`: one asset registration per id, used by inventory, tooltip, hotbar, crafting, loot and world drop alike.',
        '`current_art_key` + `palette` is what the build draws TODAY through the single icon function `art.ts icon(key, c1, c2)`; an unknown key falls back to a flat square, so a missing asset never crashes a screen.',
        'asset_status: TEMP_FALLBACK = new id borrowing another item\'s art key, must be replaced; TEMP_SHARED_PACK_ICON = all 24 packs share one generic key; EXISTING_SHARED_ICON = an older id that shares its art key with other ids; EXISTING_ICON = unique art key today.',
        'Nothing in this file is final art. No icon was drawn for any new id in ARENA 1 round 1.',
      ],
      counts: { total: rows.length, by_asset_status: rows.reduce((m: Record<string, number>, r) => { m[r.asset_status] = (m[r.asset_status] || 0) + 1; return m; }, {}) },
      items: rows,
    };
  }
  it('has one row per roster id with a stable icon_key, and matches the committed file', () => {
    const doc = build(); expect(doc.items).toHaveLength(157); expect(new Set(doc.items.map(r => r.icon_key)).size).toBe(157);
    for (const id of NEW_IDS) expect(VISUAL_BRIEF[id], 'brief for ' + id).toBeDefined();
    const text = JSON.stringify(doc, null, 1) + '\n';
    if (WRITE) writeFileSync(PATH, text);
    expect(existsSync(PATH), 'run with SOH_WRITE_ARENA1=1 to generate').toBe(true);
    expect(readFileSync(PATH, 'utf8'), 'handoff drifted from the registry: regenerate with SOH_WRITE_ARENA1=1').toBe(text);
  });
});
