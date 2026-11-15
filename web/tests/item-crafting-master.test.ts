// ITEM & RECIPE RECONSTRUCTION (Control Tower order 2026-11-15) — generator and guard of the ONE canonical
// crafting document: web/ref/last-island-copy-first/ITEM_CRAFTING_MASTER.json (+ the .md rendered from it).
//
// Numbers come from the live catalog, the recipe-migration tables, the recycler and the LI audit JSON. Authored
// meaning (family, purpose, policy, rationale) comes from src/game/item-crafting-design.ts. The committed files must
// equal what this file generates, so the document cannot drift from the code.
//   regenerate:  WRITE_MASTER=1 npx vitest run tests/item-crafting-master.test.ts
//
// Engine scenarios below use real intents with labelled fixtures (a station beside the player, `give()` of inputs).
// This file is evidence for SPEC_READY / RECIPE_READY only. It proves nothing about sources, loot or PLAYABLE.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ITEMS, RECIPES, STRUCTS, WORKBENCH_UPGRADE, WORKBENCH_UPGRADE_III, INDUSTRIAL_MODULE, FURNACE_LINING, GENERATOR_CAPACITY_UPGRADE, CART_FREIGHT_UPGRADE, GARDEN_FRAME_COST, VENDOR_SPARES, VENDOR_SECURED, CORE_STUDY, starterKnowledge, permitsDirectedResearch, recipeForJob, validateGameplayCatalog } from '../src/game/catalog';
import { BAL, TILE, type Entity, type GameState } from '../src/game/core';
import { addItem, buildReason, C, countItem, dispatch, markDirty, mkContainer, newGame, startRun, stepStations } from '../src/game/engine';
import { FINAL_ITEMS, RECIPE_SUCCESSOR, liveRecipeId } from '../src/game/final-item-set';
import { LI_RECIPE_LEDGER } from '../src/game/final-item-ledger';
import { RECIPE_REVISION, LEGACY_RECIPES, RETIRED_RECIPES, CUT_OVER_REVISIONS } from '../src/game/recipe-migration';
import { componentRuleSnapshot } from '../src/game/recycler';
import { FAMILY_ORDER, FAMILY_MEMBERS, FAMILY_RULES, ITEM_DESIGN, RECIPE_DESIGN, ALTERNATIVES, SYSTEM_CONSUMERS, CHANGELOG, OPEN_QUESTIONS, INGREDIENT_MEANING, BALANCE_WATCH } from '../src/game/item-crafting-design';

const REF = resolve(__dirname, '../ref/last-island-copy-first');
const JSON_PATH = resolve(REF, 'ITEM_CRAFTING_MASTER.json'), MD_PATH = resolve(REF, 'ITEM_CRAFTING_MASTER.md');
const AUDIT = JSON.parse(readFileSync(resolve(REF, 'FINAL_THREE_GROUP_ITEM_SET_20261115.json'), 'utf8')) as { final_items: { id: string; li_id: string | null }[]; li_source_audit: { li_id: string; source_support: string; source_url: string; recipe: Record<string, number> | null; source_edition: string }[] };
const auditByLi = new Map(AUDIT.li_source_audit.map(r => [r.li_id, r]));
const liIdOf = new Map(AUDIT.final_items.map(r => [r.id, r.li_id]));

type Bill = [string, number][];
const ROSTER = Object.keys(FINAL_ITEMS);
const familyOf = new Map<string, string>(); for (const f of FAMILY_ORDER) for (const id of FAMILY_MEMBERS[f]) familyOf.set(id, f);
const liveIds = Object.keys(RECIPES);
const starter = new Set(starterKnowledge());
const recipesFor = (item: string) => liveIds.filter(id => RECIPES[id].out === item || (RECIPES[id].outs ?? []).some(([k]) => k === item));
const primaryRecipe = (item: string) => { const all = recipesFor(item); return all.includes(item) ? item : all[0]; };
const nm = (id: string) => ITEMS[id]?.name ?? STRUCTS[id]?.name ?? id;
const bill = (b: Bill) => b.map(([k, n]) => `${n} ${nm(k)}`).join(' + ') || 'nothing';
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const outsOf = (id: string): Bill => RECIPES[id].outs ?? [[RECIPES[id].out, RECIPES[id].qty]];

/** Expand to no-recipe leaves through each item's primary formula. Fractions are real (batch yields). */
function rawBom(b: Bill, depth = 0): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const [k, n] of b) {
    const rid = primaryRecipe(k), R = rid ? RECIPES[rid] : null;
    if (!R || R.ins.length === 0 || depth > 12) { acc[k] = (acc[k] ?? 0) + n; continue; }
    const yieldOfK = outsOf(rid).find(([o]) => o === k)![1];
    for (const [kk, v] of Object.entries(rawBom(R.ins, depth + 1))) acc[kk] = (acc[kk] ?? 0) + v * n / yieldOfK;
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, r3(v)]).sort((a, b) => a[0] < b[0] ? -1 : 1));
}
const weightOf = (b: Bill) => r3(b.reduce((s, [k, n]) => s + (ITEMS[k]?.w ?? 0) * n, 0));

function provenance(rid: string) {
  const R = RECIPES[rid], led = LI_RECIPE_LEDGER[rid] ?? (rid === R?.out ? undefined : undefined);
  if (led) return { basis: 'LEDGER', kind: led.kind, li_id: led.li_id, grade: led.grade, li_recipe: led.li, li_station: led.li_station, note: led.reason };
  const li = R ? liIdOf.get(R.out) ?? null : null, a = li ? auditByLi.get(li) : undefined;
  if (rid.startsWith('deploy_')) {
    return { basis: a?.recipe ? 'AUDIT_DERIVED' : 'NONE', kind: a?.recipe ? 'SOH_ADJUSTED' : 'SOH_ONLY', li_id: li, grade: a?.source_support ?? 'NONE', li_recipe: a?.recipe ?? null, li_station: null, note: a?.recipe ? 'The audit records an LI bill for the matching LI item. The SOH pack bill is the SOH structure cost and was not derived from it by a fixed divisor.' : 'No LI bill recorded for this id.' };
  }
  if (a?.recipe && rid === R.out) {
    const liKeys = Object.keys(a.recipe).sort().join(','), sohKeys = R.ins.map(([k]) => k).sort().join(',');
    const exact = liKeys === sohKeys && R.ins.every(([k, n]) => a.recipe![k] === n);
    return { basis: 'AUDIT_DERIVED', kind: exact ? 'LI_EXACT' : liKeys === sohKeys ? 'LI_SCALED' : 'SOH_ADJUSTED', li_id: li, grade: a.source_support, li_recipe: a.recipe, li_station: null, note: exact ? 'Same ingredients and counts as the audit row.' : liKeys === sohKeys ? 'Same ingredient set as the audit row; counts are SOH values (no fixed divisor is claimed).' : 'Ingredient set differs from the audit row.' };
  }
  return { basis: 'NONE', kind: 'SOH_ONLY', li_id: rid === R?.out ? li : null, grade: 'NONE', li_recipe: null, li_station: null, note: rid === R?.out ? 'No LI bill recorded for this id.' : 'Alternative formula; SOH design.' };
}
const confidenceOf = (grade: string) => grade === 'DIRECT' ? 'HIGH for the LI shape; SOH counts provisional' : grade === 'INDIRECT' ? 'MEDIUM' : grade === 'LEGACY_CLAIM' || grade === 'UNSUPPORTED_CITATION' ? 'LOW (no dated primary source in the repository)' : 'SOH_PROVISIONAL (no LI figure exists)';

function recipeRow(rid: string) {
  const R = RECIPES[rid], outs = outsOf(rid), d = RECIPE_DESIGN[rid], p = provenance(rid);
  const main = outs[0][1];
  return {
    id: rid, output: R.out, output_name: nm(R.out), qty: R.qty, co_products: R.outs ? R.outs.filter(([k]) => k !== R.out) : [], alias: R.alias ?? null,
    ingredients: R.ins, unit_cost: R.ins.map(([k, n]) => [k, r3(n / main)] as [string, number]), raw_cost_per_unit: Object.fromEntries(Object.entries(rawBom(R.ins)).map(([k, v]) => [k, r3(v / main)])),
    station: R.station ?? 'hand', station_level: R.station === 'workbench' ? R.stationLevel ?? 1 : null, knowledge_tier: R.tier, seconds: R.secs, seconds_per_unit: r3(R.secs / main),
    craft_class: rid === 'pump_crude' ? 'EXTRACTION' : rid.startsWith('deploy_') ? 'PACK' : R.station === null ? 'HAND' : 'STATION',
    knowledge: starter.has(rid) ? 'STARTER' : (CORE_STUDY[R.out] === rid ? 'CORE_STUDY_OR_' : '') + (ROSTER.some(k => (ITEMS[k] as any)?.specimen === rid) ? 'SPECIMEN_OR_' : '') + (ROSTER.some(k => ITEMS[k]?.studyRecipe === rid) ? 'STUDY_THE_ITEM_OR_' : '') + (permitsDirectedResearch(R) ? 'DIRECTED_RESEARCH' : 'RANDOM_RESEARCH_OR_BLUEPRINT'),
    revision: R.rev ?? 1, frozen_previous: Object.keys(LEGACY_RECIPES).filter(k => k.startsWith(rid + '@')),
    provenance: p.kind, provenance_basis: p.basis, li_id: p.li_id, li_grade: p.grade, li_recipe: p.li_recipe, li_station: p.li_station, provenance_note: p.note, confidence: confidenceOf(p.grade),
    decision: d?.[0] ?? 'MISSING', learning_rationale: d?.[1] ?? 'MISSING',
    ingredient_roles: R.ins.map(([k]) => `${nm(k)} = ${INGREDIENT_MEANING[k] ?? 'MISSING'}`),
    status: 'IMPLEMENTED',
  };
}

function consumersOf(item: string) {
  const out: string[] = [];
  for (const id of liveIds) if (!id.startsWith('deploy_') && RECIPES[id].ins.some(([k]) => k === item)) out.push('recipe:' + id);
  for (const [k, s] of Object.entries(STRUCTS)) if (s.cost.some(([c]) => c === item)) out.push('struct:' + k);
  for (const [k, c] of Object.entries(UPGRADES)) if (c.cost.some(([x]) => x === item)) out.push('upgrade:' + k);
  for (const [k, d] of Object.entries(ITEMS)) { if (d.repair?.cost.some(([x]) => x === item)) out.push('repair:' + k); }
  for (const c of SYSTEM_CONSUMERS) if (c.item === item) out.push('system:' + c.system);
  return out;
}
const UPGRADES: Record<string, { cost: Bill; note: string }> = {
  workbench_level_2: { cost: WORKBENCH_UPGRADE.cost, note: 'Workbench level 1 -> 2' },
  workbench_level_3: { cost: WORKBENCH_UPGRADE_III.cost, note: 'Workbench level 2 -> 3' },
  industrial_module: { cost: INDUSTRIAL_MODULE.cost, note: 'Capability upgrade at a level-2 bench' },
  furnace_lining: { cost: FURNACE_LINING.cost, note: 'Furnace upgrade at a level-2 bench' },
  generator_capacity: { cost: GENERATOR_CAPACITY_UPGRADE.cost, note: 'Field Generator capacity upgrade' },
  cart_freight: { cost: CART_FREIGHT_UPGRADE.cost, note: 'Hand Cart freight upgrade' },
  garden_frame: { cost: GARDEN_FRAME_COST, note: 'Garden Plot cold frame' },
};

function tagsOf(id: string) {
  const d = ITEMS[id] as any, t: string[] = [];
  if (!d) return ['STRUCTURE_MODULE'];
  if (d.dur && !d.place) t.push('DURABILITY_ON_ACTION');
  if (d.place) t.push('DEPLOY_TO_HP_ENTITY');
  if (d.max > 1) t.push('STACKABLE');
  if (d.food && d.max > 1) t.push('STACK_CONSUME');
  if (d.slot) t.push('EQUIPPABLE');
  if (d.core || d.creatorCore || d.charge || id.endsWith('_card')) t.push('CHARGES');
  if (d.specimen || id === 'blueprint') t.push('KNOWLEDGE_OR_SPECIMEN');
  if (familyOf.get(id) === '11' && !t.includes('STACKABLE')) t.push('RARE_UNIQUE');
  return t;
}

function itemRow(id: string) {
  const [group, origin] = FINAL_ITEMS[id], d = ITEM_DESIGN[id], li = liIdOf.get(id) ?? null, a = li ? auditByLi.get(li) : undefined, rs = recipesFor(id);
  const hasBill = rs.length > 0 || id === 'door_powered';
  return {
    id, name: nm(id), provenance_group: group, origin, family: familyOf.get(id), family_label: FAMILY_RULES[familyOf.get(id) as '01']?.label, tags: tagsOf(id),
    acquire_policy: d?.[0] ?? 'MISSING', player_purpose: d?.[1] ?? 'MISSING',
    recipes: rs, build_cost: id === 'door_powered' ? STRUCTS.door_powered.cost : null,
    no_recipe_reason: d?.[2] ?? (id === 'crude_petroleum' ? 'NO CRAFT FORMULA: the only row is the pump_crude extraction job (no inputs, finite seep stock).' : null),
    has_bill: hasBill,
    upstream: Array.from(new Set(rs.flatMap(r => RECIPES[r].ins.map(([k]) => k)).concat(id === 'door_powered' ? STRUCTS.door_powered.cost.map(([k]) => k) : []))),
    downstream: consumersOf(id),
    li_id: li, li_grade: a?.source_support ?? 'NONE', li_edition: a?.source_edition ?? null, li_source_url: a?.source_url ?? null,
    chosen_rule: rs.length ? RECIPE_DESIGN[primaryRecipe(id)]?.[1] ?? 'MISSING' : d?.[2] ?? 'MISSING',
  };
}

function graphAudit(items: ReturnType<typeof itemRow>[]) {
  const use: Record<string, { recipes: number; packs: number; other: number }> = {};
  const bump = (k: string, f: 'recipes' | 'packs' | 'other') => { (use[k] ??= { recipes: 0, packs: 0, other: 0 })[f]++; };
  for (const id of liveIds) for (const [k] of RECIPES[id].ins) bump(k, id.startsWith('deploy_') ? 'packs' : 'recipes');
  for (const [k] of STRUCTS.door_powered.cost) bump(k, 'other');
  for (const u of Object.values(UPGRADES)) for (const [k] of u.cost) bump(k, 'other');
  const top = Object.entries(use).map(([k, v]) => ({ item: k, name: nm(k), family: familyOf.get(k) ?? null, ...v, total: v.recipes + v.packs + v.other })).sort((a, b) => b.total - a.total || (a.item < b.item ? -1 : 1));
  // reachability from no-bill items, ignoring map placement, honouring bench levels
  const have = new Set(items.filter(i => i.recipes.length === 0).map(i => i.id));
  const canPay = (b: Bill) => b.every(([k]) => have.has(k));
  let level = 1, moved = true; const unlockedAt: Record<string, number> = {}; let pass = 0;
  const packOk = (k: string) => have.has('deploy_' + k);
  while (moved) {
    moved = false; pass++;
    for (const id of liveIds) {
      const R = RECIPES[id]; if (id in unlockedAt) continue;
      const st = R.station; const stOk = st === null || (st === 'workbench' ? packOk('workbench') && (R.stationLevel ?? 1) <= level : packOk(st === 'furnace' ? 'furnace' : st === 'campfire' ? 'campfire' : st));
      if (stOk && canPay(R.ins)) { for (const [k] of outsOf(id)) have.add(k); unlockedAt[id] = pass; moved = true; }
    }
    if (level === 1 && packOk('workbench') && canPay(WORKBENCH_UPGRADE.cost)) { level = 2; moved = true; }
    if (level === 2 && canPay(WORKBENCH_UPGRADE_III.cost)) { level = 3; moved = true; }
  }
  const unreachableRecipes = liveIds.filter(id => !(id in unlockedAt));
  // silent gates: a recipe at bench level L with an ingredient whose every formula needs a higher bench level
  const minLevel = (item: string) => { const rs = recipesFor(item).map(r => RECIPES[r]).filter(R => R.station === 'workbench'); return rs.length && rs.length === recipesFor(item).length ? Math.min(...rs.map(R => R.stationLevel ?? 1)) : 0; };
  const silent = liveIds.filter(id => RECIPES[id].station === 'workbench').flatMap(id => RECIPES[id].ins.filter(([k]) => minLevel(k) > (RECIPES[id].station === null ? 0 : RECIPES[id].stationLevel ?? 1)).map(([k]) => ({ recipe: id, bench_level: RECIPES[id].station === null ? 0 : RECIPES[id].stationLevel ?? 1, ingredient: k, ingredient_needs_level: minLevel(k), ingredient_policy: ITEM_DESIGN[k]?.[0] })));
  // alternatives
  const groups: Record<string, string[]> = {}; for (const id of liveIds) (groups[RECIPES[id].out] ??= []).push(id);
  const alt = Object.entries(groups).filter(([, v]) => v.length > 1).map(([out, ids]) => {
    const rows = ids.map(id => { const R = RECIPES[id], q = outsOf(id).find(([k]) => k === out)![1]; return { id, raw: Object.fromEntries(Object.entries(rawBom(R.ins)).map(([k, v]) => [k, r3(v / q)])), secs: r3(R.secs / q), level: R.station === 'workbench' ? R.stationLevel ?? 1 : 0, station: R.station ?? 'hand', starter: starter.has(id) }; });
    const dominates = (a: typeof rows[0], b: typeof rows[0]) => { const keys = new Set([...Object.keys(a.raw), ...Object.keys(b.raw)]); let strict = false; for (const k of keys) { const x = a.raw[k] ?? 0, y = b.raw[k] ?? 0; if (x > y) return false; if (x < y) strict = true; } if (a.secs > b.secs || a.level > b.level || (!a.starter && b.starter) || a.station !== b.station) return false; return strict || a.secs < b.secs || a.level < b.level || (a.starter && !b.starter); };
    const dominated = rows.flatMap(b => rows.filter(a => a !== b && dominates(a, b)).map(a => `${a.id} dominates ${b.id}`));
    return { output: out, routes: rows, strictly_dominated: dominated, verdict: ALTERNATIVES[out]?.verdict ?? 'MISSING', trade: ALTERNATIVES[out]?.trade ?? 'MISSING' };
  });
  // conservation: latest component recycle rule against the per-unit craft bill
  const rules = componentRuleSnapshot(); const latest: Record<string, string> = {};
  for (const [rid, r] of Object.entries(rules)) { const v = Number(rid.split('-v')[1]); if (!latest[r.key] || v > Number(latest[r.key].split('-v')[1])) latest[r.key] = rid; }
  const conservation = Object.entries(latest).map(([item, rid]) => {
    const R = RECIPES[primaryRecipe(item)], unit = Object.fromEntries(R.ins.map(([k, n]) => [k, n / R.qty])), craftRaw = rawBom(R.ins.map(([k, n]) => [k, n / R.qty] as [string, number])), back = rawBom(rules[rid].outputs as Bill);
    const keys = new Set([...Object.keys(craftRaw), ...Object.keys(back)]);
    const net = Object.fromEntries([...keys].map(k => [k, r3((back[k] ?? 0) - (craftRaw[k] ?? 0))]));
    return { item, rule: rid, craft_per_unit: unit, returns: rules[rid].outputs, net_raw_per_cycle: net, loses_every_cycle: Object.values(net).every(v => v <= 0) && Object.values(net).some(v => v < 0) };
  });
  const zeroCost = liveIds.filter(id => RECIPES[id].ins.length === 0);
  const selfLoop = liveIds.filter(id => RECIPES[id].ins.some(([k]) => outsOf(id).some(([o]) => o === k)));
  // components and leaves
  const adj = new Map<string, Set<string>>(); const link = (a: string, b: string) => { (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b); (adj.get(b) ?? adj.set(b, new Set()).get(b)!).add(a); };
  for (const i of items) { adj.set(i.id, adj.get(i.id) ?? new Set()); for (const u of i.upstream) link(i.id, u); }
  for (const u of Object.values(UPGRADES)) for (const [k] of u.cost) link(k, 'deploy_workbench');
  const seen = new Set<string>(), comps: string[][] = [];
  for (const i of items) if (!seen.has(i.id)) { const q = [i.id], c: string[] = []; seen.add(i.id); while (q.length) { const x = q.pop()!; c.push(x); for (const y of adj.get(x) ?? []) if (!seen.has(y)) { seen.add(y); q.push(y); } } comps.push(c.sort()); }
  comps.sort((a, b) => b.length - a.length);
  const isolated = comps.slice(1).flat().map(id => ({ id, family: familyOf.get(id), linked_by: items.find(i => i.id === id)!.downstream.filter(x => x.startsWith('system:')), policy: ITEM_DESIGN[id]?.[0] }));
  const inputFams = new Set(['01', '02']);
  const deadEnds = items.filter(i => inputFams.has(i.family!) && i.downstream.length === 0).map(i => i.id);
  const singleUse = items.filter(i => inputFams.has(i.family!) && i.downstream.length === 1).map(i => ({ id: i.id, only_consumer: i.downstream[0] }));
  const bridges = top.filter(t => { const fams = new Set(liveIds.filter(id => RECIPES[id].ins.some(([k]) => k === t.item)).map(id => familyOf.get(RECIPES[id].out))); (t as any).families = [...fams].sort(); return fams.size >= 4; }).map(t => ({ item: t.item, families: (t as any).families as string[] }));
  for (const t of top) delete (t as any).families;
  return { top_reused: top.slice(0, 10), all_ingredient_use: top, bridge_materials: bridges, main_component_size: comps[0].length, outside_main_component: isolated, dead_end_materials: deadEnds, single_consumer_materials: singleUse, reachability: { final_bench_level: level, unreachable_recipes: unreachableRecipes, craftable_items_reached: items.filter(i => i.recipes.length && have.has(i.id)).length, note: 'Start set = every item without a formula, treated as obtainable; map placement ignored.' }, silent_gates: silent, alternatives: alt, conservation, zero_input_recipes: zeroCost, self_consuming_recipes: selfLoop };
}

const EXPANSIONS: [string, string, Bill][] = [
  ['Iron Plate armour set (4 pieces)', 'L2 bench', [['iron_plate_helmet', 1], ['iron_plate_chest', 1], ['iron_plate_pants', 1], ['iron_plate_boots', 1]]],
  ['Refined Iron armour set (4 pieces)', 'L2 bench', [['refined_iron_helmet', 1], ['refined_iron_chest', 1], ['refined_iron_legs', 1], ['refined_iron_boots', 1]]],
  ['Utility Motorbike', 'L3 bench', [['motorbike_kit', 1]]],
  ['Workbench level 3 (both upgrades)', 'prerequisite of the Motorbike', [...WORKBENCH_UPGRADE.cost, ...WORKBENCH_UPGRADE_III.cost]],
  ['Big Bang (common Core)', 'L1 bench', [['core_blast', 1]]],
  ['Meteor (rare Core)', 'L2 bench', [['core_meteor', 1]]],
  ["Dragon's Breath (top Core)", 'L3 bench', [['core_dragon', 1]]],
  ['Field Generator', 'pack', [['deploy_base_generator', 1]]],
  ['Powered Door module', 'build cost', STRUCTS.door_powered.cost],
  ['Large Furnace', 'L2 bench', [['large_furnace', 1]]],
  ['Salvager Axe (from nothing)', 'L2 bench', [['industrial_axe', 1]]],
  ['Machete', 'L2 bench', [['machete', 1]]],
  ['Steel Folding Ladder', 'L2 bench', [['steel_folding_ladder', 1]]],
  ['Oil chain: Pump + Refinery', 'packs', [['deploy_oil_pump', 1], ['deploy_refinery', 1]]],
];
function expansions() {
  return EXPANSIONS.map(([title, where, b]) => {
    const top = b.every(([k]) => RECIPES[k] && RECIPES[k].out === k) && b.every(([k]) => !['iron_ingot', 'mechanical_gear', 'iron_plate'].includes(k));
    const merged: Record<string, number> = {}; if (top) for (const [k, n] of b) for (const [kk, v] of RECIPES[k].ins) merged[kk] = (merged[kk] ?? 0) + v * n;
    const direct: Bill = top ? Object.entries(merged) : Object.entries(b.reduce((a, [k, n]) => (a[k] = (a[k] ?? 0) + n, a), {} as Record<string, number>));
    const mid: Record<string, number> = {};
    const walk = (bb: Bill, mult: number, depth = 0) => { for (const [k, n] of bb) { const rid = primaryRecipe(k), R = rid ? RECIPES[rid] : null; if (!R || !R.ins.length || depth > 12) continue; const q = outsOf(rid).find(([o]) => o === k)![1]; mid[k] = r3((mid[k] ?? 0) + n * mult); walk(R.ins, n * mult / q, depth + 1); } };
    walk(b, 1); if (top) for (const [k] of b) delete mid[k];
    return { title, where, direct_bill: direct, direct_weight_kg: weightOf(direct), intermediates: mid, raw: rawBom(b) };
  });
}

function buildMaster() {
  const items = ROSTER.map(itemRow);
  const recipes = liveIds.map(recipeRow);
  const retired = Object.keys(RECIPE_DESIGN).filter(id => RECIPE_DESIGN[id][0] === 'RETIRED').map(id => ({ id, successor: RECIPE_SUCCESSOR[id] ?? null, frozen: Object.keys(LEGACY_RECIPES).filter(k => k.startsWith(id + '@')), frozen_bill: LEGACY_RECIPES[id + '@5']?.ins ?? null, decision: 'RETIRED', why: RECIPE_DESIGN[id][1] }));
  const policy: Record<string, number> = {}; for (const i of items) policy[i.acquire_policy] = (policy[i.acquire_policy] ?? 0) + 1;
  const prov: Record<string, number> = {}; for (const r of recipes) prov[r.provenance] = (prov[r.provenance] ?? 0) + 1;
  const grade: Record<string, number> = {}; for (const r of recipes) grade[r.li_grade] = (grade[r.li_grade] ?? 0) + 1;
  return {
    schema: 'soh.item_crafting_master.v1',
    status: 'SPEC_READY / RECIPE_READY. Not PLAYABLE, not VISUAL_ACCEPTED. Source, loot, container and map design are out of scope.',
    authority: 'This is the one canonical item and recipe document. It supersedes the recipe sections of ARENA1_ROUND1_REPORT.md, ARENA1_ROUND2_REPORT.md, SOH_147_ITEMS_BY_ROLE.md and earlier item audits. The 157-id roster itself stays in FINAL_THREE_GROUP_ITEM_SET_20261115.json.',
    generated_by: 'web/tests/item-crafting-master.test.ts (numbers from live code) + web/src/game/item-crafting-design.ts (authored meaning)',
    recipe_revision: RECIPE_REVISION,
    reading_notes: [
      'acquire_policy is design intent. WORLD_ONLY / BOTH do not assert that a map source exists today; placing sources is the next phase.',
      'provenance: LI_EXACT / LI_SCALED / SOH_ADJUSTED / SOH_ONLY. provenance_basis LEDGER = hand-audited row in final-item-ledger.ts; AUDIT_DERIVED = classified mechanically against the li_source_audit row; NONE = no LI bill recorded.',
      'li_grade is the audit grade of the LI figure: DIRECT, INDIRECT, LEGACY_CLAIM, UNSUPPORTED_CITATION or NONE. Every audit row is graded "LI: many versions/modes (mostly historical material)": no figure is tied to one dated LI version.',
      'No fixed LI -> SOH divisor is claimed. Where SOH counts differ from LI they are SOH_PROVISIONAL.',
      'Three separate axes per recipe: knowledge (STARTER, DIRECTED_RESEARCH for tier < 3, otherwise random research / blueprint / specimen / core study), bench level, and bill.',
    ],
    counts: { items: items.length, by_group: { A: items.filter(i => i.provenance_group === 'A').length, B: items.filter(i => i.provenance_group === 'B').length, C: items.filter(i => i.provenance_group === 'C').length }, by_family: Object.fromEntries(FAMILY_ORDER.map(f => [f, FAMILY_MEMBERS[f].length])), by_policy: policy, live_recipes: recipes.length, explicit_recipes: recipes.filter(r => r.craft_class !== 'PACK').length, pack_recipes: recipes.filter(r => r.craft_class === 'PACK').length, retired_this_revision: retired.length, items_with_bill: items.filter(i => i.has_bill).length, items_without_bill: items.filter(i => !i.has_bill).length, recipes_by_provenance: prov, recipes_by_li_grade: grade, recipes_by_decision: { KEEP: recipes.filter(r => r.decision === 'KEEP').length, REVISE: recipes.filter(r => r.decision === 'REVISE').length, RETIRED: retired.length } },
    families: FAMILY_ORDER.map(f => ({ id: f, ...FAMILY_RULES[f], members: FAMILY_MEMBERS[f] })),
    ingredient_meaning: INGREDIENT_MEANING,
    items, recipes, retired_recipes: retired,
    non_recipe_consumers: {
      structure_module: { door_powered: { cost: STRUCTS.door_powered.cost, note: 'Build cost, fitted to a Wood or Iron Door. No pack item.' } },
      upgrades: UPGRADES,
      research: { random: { spares: BAL.research.randomSparesCost, seconds: BAL.research.randomSeconds }, directed: { spares: BAL.research.directedSparesCost, seconds: BAL.research.directedSeconds, rule: 'knowledge tier < 3' }, specimen: { seconds: BAL.research.specimenSeconds } },
      specimen_study: Object.fromEntries(ROSTER.filter(k => ITEMS[k]?.specimen).map(k => [k, ITEMS[k].specimen])),
      study_the_item_itself: Object.fromEntries(ROSTER.filter(k => ITEMS[k]?.studyRecipe).map(k => [k, ITEMS[k].studyRecipe])),
      core_study: CORE_STUDY,
      item_repair: Object.fromEntries(Object.entries(ITEMS).filter(([k, d]) => d.repair && FINAL_ITEMS[k]).map(([k, d]) => [k, d.repair])),
      vendor_for_parts: VENDOR_SPARES, vendor_for_rcash: VENDOR_SECURED,
      recycler_latest_rules: Object.fromEntries(graphAuditCache(items).conservation.map(c => [c.item, { rule: c.rule, returns: c.returns }])),
      systems: SYSTEM_CONSUMERS,
    },
    graph_audit: graphAuditCache(items),
    bom_expansions: expansions(),
    balance_watch: BALANCE_WATCH,
    changelog: CHANGELOG,
    migration: { revision: RECIPE_REVISION, cut_over_at_5: CUT_OVER_REVISIONS[5], frozen_at_5: Object.fromEntries((CUT_OVER_REVISIONS[5] as string[]).map(id => [id + '@5', { ins: LEGACY_RECIPES[id + '@5'].ins, qty: LEGACY_RECIPES[id + '@5'].qty, secs: LEGACY_RECIPES[id + '@5'].secs, tier: LEGACY_RECIPES[id + '@5'].tier }])), rule: 'A queued job stamped with revision 5 or older resolves to its frozen bill and yield. Frozen rows are never edited.' },
    open_questions: OPEN_QUESTIONS,
  };
}
let _ga: ReturnType<typeof graphAudit> | null = null;
const graphAuditCache = (items: ReturnType<typeof itemRow>[]) => (_ga ??= graphAudit(items));

function renderMd(m: ReturnType<typeof buildMaster>) {
  const L: string[] = [], p = (s = '') => L.push(s);
  const rmap = new Map(m.recipes.map(r => [r.id, r]));
  const kb = (b: Bill | [string, number][]) => bill(b as Bill);
  const rec = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${v} ${nm(k)}`).join(' + ') || 'nothing';
  const st = (r: typeof m.recipes[0]) => r.station === 'hand' ? 'Hand' : r.station === 'workbench' ? `Workbench L${r.station_level}` : nm('deploy_' + r.station).replace(/^Packed /, '');
  const know = (k: string) => k === 'STARTER' ? 'Starter' : k.replace(/_OR_/g, ' / ').replace(/_/g, ' ').toLowerCase();
  p('# Item and Crafting Master — Soul of Hero'); p();
  p('> GENERATED FILE. Do not edit by hand. Source: `ITEM_CRAFTING_MASTER.json`, produced by `web/tests/item-crafting-master.test.ts`.'); p();
  p(`**Status:** ${m.status}`); p(); p(`**Authority:** ${m.authority}`); p();
  p(`**Recipe revision:** ${m.recipe_revision}. **Items:** ${m.counts.items} (A ${m.counts.by_group.A} / B ${m.counts.by_group.B} / C ${m.counts.by_group.C}). **Live formulas:** ${m.counts.live_recipes} (${m.counts.explicit_recipes} explicit + ${m.counts.pack_recipes} packs). **Items with a bill:** ${m.counts.items_with_bill}. **Items with no bill by design:** ${m.counts.items_without_bill}.`); p();
  p('## How to read this'); p(); for (const n of m.reading_notes) p('- ' + n); p();
  p('## 1. The crafting language in one page'); p();
  p('| Ingredient | Always means | Used in (formulas / packs / other) |'); p('|---|---|---|');
  for (const t of m.graph_audit.all_ingredient_use.filter(t => m.ingredient_meaning[t.item]).slice(0, 24)) p(`| ${t.name} | ${m.ingredient_meaning[t.item]} | ${t.recipes} / ${t.packs} / ${t.other} |`);
  p(); p('## 2. Family rulebook'); p();
  for (const f of m.families) {
    p(`### ${f.id} ${f.label} (${f.members.length})`); p(); p(f.role); p(); p('**Rules**'); p(); f.rules.forEach((r, i) => p(`${i + 1}. ${r}`)); p();
    p('**Examples**'); p(); for (const e of f.examples) p('- ' + e); p(); p(`**Inferring an unseen formula:** ${f.infer}`); p();
  }
  p('## 3. All 157 items'); p();
  for (const f of m.families) {
    p(`### ${f.id} ${f.label}`); p(); p('| Item | id | Grp | Policy | Purpose | How it is made, or why it is not | LI id / grade |'); p('|---|---|---|---|---|---|---|');
    for (const id of f.members) { const i = m.items.find(x => x.id === id)!;
      const how = i.build_cost ? `Build cost: ${kb(i.build_cost)}. ${i.no_recipe_reason}` : i.has_bill ? i.recipes.map(r => { const R = rmap.get(r)!; return `${R.alias ? '*alt* ' : ''}${kb(R.ingredients)} → ${R.qty}`; }).join('<br>') : i.no_recipe_reason;
      p(`| ${i.name} | \`${i.id}\` | ${i.provenance_group} | ${i.acquire_policy} | ${i.player_purpose} | ${how} | ${i.li_id ?? '—'} / ${i.li_grade} |`); }
    p();
  }
  p('## 4. Every formula'); p();
  p('Unit cost divides the bill by the yield. Knowledge: Starter = known from the first minute; directed research = tier below 3, can be studied on purpose for Parts.'); p();
  for (const f of m.families) {
    const rs = m.recipes.filter(r => familyOf.get(r.output) === f.id); if (!rs.length) continue;
    p(`### ${f.id} ${f.label}`); p(); p('| Formula | Makes | Bill | Per unit | Station | Tier / knowledge | Time | Provenance (LI grade) | LI figure | Decision | Why it has this shape |'); p('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of rs) p(`| \`${r.id}\` | ${r.qty} ${r.output_name}${r.co_products.length ? ' + ' + kb(r.co_products) : ''} | ${kb(r.ingredients)} | ${r.qty > 1 ? kb(r.unit_cost) : '—'} | ${st(r)} | ${r.knowledge_tier} / ${know(r.knowledge)} | ${r.seconds} s | ${r.provenance} (${r.li_grade}) | ${r.li_recipe ? rec(r.li_recipe) : '—'} | ${r.decision}${r.revision === m.recipe_revision ? ' (rev ' + r.revision + ')' : ''} | ${r.learning_rationale} |`);
    p();
  }
  p('### Retired at this revision'); p(); for (const r of m.retired_recipes) p(`- \`${r.id}\` → successor \`${r.successor}\`. Frozen as ${r.frozen.map(x => '`' + x + '`').join(', ')} (${r.frozen_bill ? kb(r.frozen_bill) : ''}). ${r.why}`); p();
  p('## 5. Costs that are not formulas'); p();
  p(`- **Powered Door module:** ${kb(m.non_recipe_consumers.structure_module.door_powered.cost)}. ${m.non_recipe_consumers.structure_module.door_powered.note}`);
  for (const [k, u] of Object.entries(m.non_recipe_consumers.upgrades)) p(`- **${u.note}** (\`${k}\`): ${kb(u.cost)}.`);
  const R = m.non_recipe_consumers.research; p(`- **Research:** random study ${R.random.spares} Parts, ${R.random.seconds} s; directed study ${R.directed.spares} Parts, ${R.directed.seconds} s (${R.directed.rule}); specimen study ${R.specimen.seconds} s and consumes the specimen.`);
  p(`- **Specimen study** (consumes the specimen): ${Object.entries(m.non_recipe_consumers.specimen_study).map(([k, v]) => `${nm(k)} → ${nm(RECIPES[v as string]?.out ?? v as string)}`).join('; ')}.`);
  p(`- **Studying the item itself** teaches its own formula: ${Object.keys(m.non_recipe_consumers.study_the_item_itself).map(nm).join(', ')}.`);
  p(`- **Core study** (taking a Core apart teaches its formula): ${Object.keys(m.non_recipe_consumers.core_study).map(nm).join(', ')}.`);
  p(`- **Item repair at a station:** ${Object.entries(m.non_recipe_consumers.item_repair).map(([k, v]: any) => `${nm(k)} = ${kb(v.cost)}`).join('; ')}.`);
  p(`- **Vendor, paid in Parts** (price / quantity / stock): ${Object.entries(m.non_recipe_consumers.vendor_for_parts).map(([k, v]) => `${nm(k)} ${v.price}/${v.qty}/${v.stock}`).join('; ')}.`);
  p(`- **Vendor, paid in Ragnarok Cash** (price / stock): ${Object.entries(m.non_recipe_consumers.vendor_for_rcash).map(([k, v]) => `${nm(k)} ${v.price}/${v.stock}`).join('; ')}.`);
  p(`- **Recycler (latest rule per component):** ${Object.entries(m.non_recipe_consumers.recycler_latest_rules).map(([k, v]: any) => `${nm(k)} → ${kb(v.returns)}`).join('; ')}.`);
  p(); p('| Item | System | What consumes or uses it | Code anchor |'); p('|---|---|---|---|'); for (const c of m.non_recipe_consumers.systems) p(`| ${nm(c.item)} | ${c.system} | ${c.what} | \`${c.anchor}\` |`); p();
  const g = m.graph_audit;
  p('## 6. Cross-family graph audit'); p();
  p('### Ten most reused ingredients'); p(); p('| # | Ingredient | Formulas | Packs | Other costs | Total |'); p('|---|---|---|---|---|---|'); g.top_reused.forEach((t, i) => p(`| ${i + 1} | ${t.name} | ${t.recipes} | ${t.packs} | ${t.other} | ${t.total} |`)); p();
  p('### Bridge materials (used by formulas in four or more families)'); p(); for (const b of g.bridge_materials) p(`- ${nm(b.item)}: families ${b.families.join(', ')}`); p();
  p('### Reachability, ignoring map placement'); p(); p(`${g.reachability.note} Result: bench level ${g.reachability.final_bench_level} reached; ${g.reachability.craftable_items_reached} craftable items reached; formulas that cannot be reached: ${g.reachability.unreachable_recipes.length ? g.reachability.unreachable_recipes.join(', ') : 'none'}.`); p();
  p('### Bench-level gates hidden inside a bill'); p(); if (!g.silent_gates.length) p('None.'); for (const s of g.silent_gates) p(`- \`${s.recipe}\` is a level-${s.bench_level} formula but ${nm(s.ingredient)} can only be made at level ${s.ingredient_needs_level}. Ingredient policy: ${s.ingredient_policy}.`); p();
  p('### Alternative routes to one item'); p(); for (const a of g.alternatives) { p(`- **${nm(a.output)}** — ${a.verdict}. ${a.trade}`); for (const r of a.routes) p(`  - \`${r.id}\`: raw per unit ${rec(r.raw)}; ${r.secs} s per unit; ${r.station}${r.level ? ' L' + r.level : ''}; ${r.starter ? 'starter' : 'learned'}`); if (a.strictly_dominated.length) p(`  - Mechanical check: ${a.strictly_dominated.join('; ')}.`); } p();
  p('### Conservation: craft then recycle'); p(); p('| Component | Craft, per unit | Recycle returns | Net raw per cycle | Loses every cycle |'); p('|---|---|---|---|---|'); for (const c of g.conservation) p(`| ${nm(c.item)} | ${rec(c.craft_per_unit)} | ${kb(c.returns as Bill)} | ${Object.entries(c.net_raw_per_cycle).filter(([, v]) => v !== 0).map(([k, v]) => `${v} ${nm(k)}`).join(', ')} | ${c.loses_every_cycle ? 'yes' : 'NO'} |`); p();
  p(`Zero-input formulas: ${g.zero_input_recipes.map(x => '`' + x + '`').join(', ') || 'none'} (extraction from finite seep stock). Formulas that consume their own output: ${g.self_consuming_recipes.join(', ') || 'none'}. Parts have no formula and no recycle rule returns more Parts than its craft spent.`); p();
  p('### Materials with no consumer or one consumer'); p(); p(`No consumer: ${g.dead_end_materials.map(nm).join(', ') || 'none'}.`); p(); for (const s of g.single_consumer_materials) p(`- ${nm(s.id)}: only \`${s.only_consumer}\``); p();
  p('### Items outside the main crafting graph'); p(); p(`Main connected component: ${g.main_component_size} of ${m.counts.items} items. The rest have no bill and appear in no bill; each is tied to the game by a system, not a formula:`); p(); for (const i of g.outside_main_component) p(`- ${nm(i.id)} (family ${i.family}, ${i.policy}): ${i.linked_by.join(', ') || 'MISSING'}`); p();
  p('## 7. Full bill expansions'); p(); p('Raw totals expand every intermediate through its main formula. Fractions come from batch yields; round up per craft.'); p();
  for (const e of m.bom_expansions) { p(`### ${e.title} (${e.where})`); p(); p(`- Direct bill: ${kb(e.direct_bill)} — ${e.direct_weight_kg} kg carried to the station`); p(`- Intermediates made on the way: ${rec(e.intermediates)}`); p(`- Raw total: ${rec(e.raw)}`); p(); }
  p('## 8a. Balance watch'); p(); for (const w of m.balance_watch) { p(`- **${w.id}.** ${w.fact}`); p(`  - Posture: ${w.posture}`); } p();
  p('## 8. Changelog (revision 5 → 6)'); p(); p('| Formula | Kind | Before | After | Evidence | Economic consequence | Status |'); p('|---|---|---|---|---|---|---|'); for (const c of m.changelog) p(`| \`${c.id}\` | ${c.kind} | ${c.before} | ${c.after} | ${c.evidence} | ${c.consequence} | ${c.status} |`); p();
  p(`Migration: ${m.migration.rule} Frozen at revision 5: ${Object.keys(m.migration.frozen_at_5).map(x => '`' + x + '`').join(', ')}.`); p();
  p('## 9. Open questions'); p(); for (const q of m.open_questions) { p(`- **${q.id}.** ${q.question}`); p(`  - Why the sources cannot settle it: ${q.whyUnresolvable}`); p(`  - Current posture: ${q.currentPosture}`); }
  p(); return L.join('\n');
}

const MASTER = buildMaster();
const MASTER_JSON = JSON.stringify(MASTER, null, 1) + '\n', MASTER_MD = renderMd(MASTER);
if (process.env.WRITE_MASTER === '1') { writeFileSync(JSON_PATH, MASTER_JSON); writeFileSync(MD_PATH, MASTER_MD); }

describe('ITEM_CRAFTING_MASTER — the document equals the code', () => {
  it('committed JSON and MD are exactly what the generator produces', () => {
    expect(existsSync(JSON_PATH) && existsSync(MD_PATH)).toBe(true);
    expect(readFileSync(JSON_PATH, 'utf8')).toBe(MASTER_JSON);
    expect(readFileSync(MD_PATH, 'utf8')).toBe(MASTER_MD);
  });
  it('covers exactly the 157 roster ids, one family each, with the ordered family sizes', () => {
    expect(ROSTER.length).toBe(157);
    const all = FAMILY_ORDER.flatMap(f => FAMILY_MEMBERS[f]);
    expect(all.length).toBe(157); expect(new Set(all).size).toBe(157);
    expect([...all].sort()).toEqual([...ROSTER].sort());
    expect(FAMILY_ORDER.map(f => FAMILY_MEMBERS[f].length)).toEqual([20, 14, 22, 16, 14, 17, 17, 10, 4, 4, 19]);
    expect(Object.keys(ITEM_DESIGN).sort()).toEqual([...ROSTER].sort());
  });
  it('every item has a purpose and either a bill or a stated reason for having none', () => {
    for (const i of MASTER.items) {
      expect(i.player_purpose.length, i.id).toBeGreaterThan(15);
      expect(['CRAFT_ONLY', 'WORLD_ONLY', 'BOTH', 'SPECIAL_AUTHORITY'], i.id).toContain(i.acquire_policy);
      if (i.id === 'crude_petroleum') expect(i.acquire_policy).toBe('WORLD_ONLY');   // its only row is extraction
      else if (i.has_bill) expect(['CRAFT_ONLY', 'BOTH'], i.id + ' has a bill').toContain(i.acquire_policy);
      else { expect(i.no_recipe_reason, i.id).toBeTruthy(); expect(['WORLD_ONLY', 'SPECIAL_AUTHORITY'], i.id + ' has no bill').toContain(i.acquire_policy); }
      if (i.id !== 'door_powered' && i.id !== 'crude_petroleum') expect(!!ITEM_DESIGN[i.id][2], i.id + ': a reason exists exactly when no formula does').toBe(i.recipes.length === 0);
    }
    expect(MASTER.counts.items_with_bill + MASTER.counts.items_without_bill).toBe(157);
    expect(MASTER.counts.items_without_bill).toBe(49);
  });
  it('every live formula has a decision and a rationale; nothing documented is missing from the code', () => {
    expect(MASTER.counts.live_recipes).toBe(114); expect(MASTER.counts.pack_recipes).toBe(24);
    const designed = Object.keys(RECIPE_DESIGN).filter(id => RECIPE_DESIGN[id][0] !== 'RETIRED').sort();
    expect(designed).toEqual([...liveIds].sort());
    for (const r of MASTER.recipes) {
      expect(r.learning_rationale.length, r.id).toBeGreaterThan(20);
      expect(r.ingredient_roles.join('|'), r.id).not.toContain('MISSING');
      expect(ROSTER, r.id).toContain(r.output);
      for (const [k] of r.ingredients) expect(ROSTER, r.id + ' input ' + k).toContain(k);
      expect(r.decision === 'REVISE', r.id + ' REVISE exactly when touched at this revision').toBe(r.revision === RECIPE_REVISION || ['arrow', 'refined_iron_helmet', 'refined_iron_chest', 'refined_iron_legs', 'refined_iron_boots'].includes(r.id));
    }
    for (const id of Object.keys(RECIPE_DESIGN).filter(id => RECIPE_DESIGN[id][0] === 'RETIRED')) { expect(RECIPES[id], id).toBeUndefined(); expect(RETIRED_RECIPES as readonly string[]).toContain(id); }
    expect(validateGameplayCatalog()).toBe(true);
  });
  it('a pack bill is exactly its structure cost, made by hand, and the door module has no pack', () => {
    const packs = liveIds.filter(x => x.startsWith('deploy_')); expect(packs.length).toBe(24);
    for (const id of packs) {
      const s = STRUCTS[id.slice('deploy_'.length)]; expect(s, id).toBeTruthy();
      expect(RECIPES[id].ins, id).toEqual(s.cost); expect(RECIPES[id].qty).toBe(1); expect(RECIPES[id].station, id).toBeNull();
    }
    expect(ITEMS.door_powered).toBeUndefined(); expect(RECIPES.door_powered).toBeUndefined(); expect(RECIPES.deploy_door_powered).toBeUndefined();
  });
});

describe('ITEM_CRAFTING_MASTER — the grammar holds in the live catalog', () => {
  const ins = (id: string) => Object.fromEntries(RECIPES[id].ins);
  it('components: metal + Parts at a level-2 bench; Pipe and Plate share one bill; a Blade is cheaper than a Gear', () => {
    for (const id of ['metal_pipe', 'iron_plate', 'mechanical_gear', 'metal_blade']) { expect(RECIPES[id].station).toBe('workbench'); expect(RECIPES[id].stationLevel).toBe(2); expect(ins(id).spares, id).toBeGreaterThan(0); }
    expect(RECIPES.metal_pipe.ins).toEqual(RECIPES.iron_plate.ins); expect(RECIPES.metal_pipe.qty).toBe(RECIPES.iron_plate.qty);
    const units = (id: string) => RECIPES[id].ins.reduce((s, [, n]) => s + n, 0);
    expect(units('metal_blade')).toBeLessThan(units('mechanical_gear'));
    expect(ins('metal_blade').spares).toBeLessThan(ins('mechanical_gear').spares);
  });
  it('tools: axe and pick of a tier match; a Salvager tool consumes the Iron tool plus refined metal and a Pipe', () => {
    expect(RECIPES.iron_axe.ins).toEqual(RECIPES.iron_pick.ins);
    for (const [hi, lo] of [['industrial_axe', 'iron_axe'], ['industrial_pick', 'iron_pick']]) { expect(ins(hi)[lo]).toBe(1); expect(ins(hi).refined_iron_ingot).toBe(2); expect(ins(hi).metal_pipe).toBe(1); }
    expect(ins('industrial_axe').metal_blade).toBe(1); expect(ins('industrial_pick').metal_blade).toBeUndefined();
    expect(ins('steel_folding_ladder').wooden_ladder).toBe(1);
  });
  it('edged weapons are priced in Blades: Cleaver 1, Reinforced Spear 1, Machete 3', () => {
    expect([ins('cleaver').metal_blade, ins('reinforced_spear').metal_blade, ins('machete').metal_blade]).toEqual([1, 1, 3]);
  });
  it('armour: within a set only the metal count (and the chest) moves', () => {
    const plate = ['iron_plate_helmet', 'iron_plate_chest', 'iron_plate_pants', 'iron_plate_boots'].map(ins);
    expect(plate.map(b => b.iron_plate)).toEqual([1, 3, 2, 1]); expect(plate.map(b => b.needle_thread)).toEqual([3, 3, 3, 3]); expect(plate.map(b => b.hide)).toEqual([3, 4, 3, 3]);
    const ref = ['refined_iron_helmet', 'refined_iron_chest', 'refined_iron_legs', 'refined_iron_boots'].map(ins);
    expect(ref.map(b => b.refined_iron_ingot)).toEqual([3, 5, 3, 3]); expect(ref.map(b => b.hide)).toEqual([5, 5, 5, 5]); expect(ref.map(b => b.needle_thread)).toEqual([6, 8, 6, 6]);
    for (const id of ['refined_iron_helmet', 'refined_iron_chest', 'refined_iron_legs', 'refined_iron_boots']) { expect(permitsDirectedResearch(RECIPES[id]), id).toBe(true); expect(RECIPES[id].stationLevel).toBe(2); }
  });
  it('Cores: every Core is Iron or its element + Parts + Crystal, and the top Core is exactly two Meteors', () => {
    for (const id of liveIds.filter(x => x.startsWith('core_'))) { expect(ins(id).spares, id).toBeGreaterThan(0); expect(ins(id).crystal, id).toBeGreaterThan(0); }
    for (const id of ['core_blast', 'core_earthmother', 'core_meteor', 'core_dragon', 'core_elsa', 'core_mjolnir', 'core_demon']) expect(ins(id).iron_ingot, id).toBeGreaterThan(0);
    expect(RECIPES.core_blast.ins).toEqual(RECIPES.core_earthmother.ins);
    expect(RECIPES.core_dragon.ins).toEqual(RECIPES.core_meteor.ins.map(([k, n]) => [k, n * 2]));
    for (const id of ['essence_fire', 'essence_nature', 'essence_water', 'essence_spirit']) { expect(RECIPES[id].qty).toBe(2); expect(RECIPES[id].ins.length).toBe(2); }
    // Crystal and essences are Core-family materials: outside family 06 Crystal appears only in Glass.
    const crystalUsers = liveIds.filter(id => ins(id).crystal).filter(id => familyOf.get(RECIPES[id].out) !== '06');
    expect(crystalUsers).toEqual(['glass']);
  });
  it('graph: everything is reachable, nothing mints material, and every alternative trades something', () => {
    const g = MASTER.graph_audit;
    expect(g.reachability.unreachable_recipes).toEqual([]); expect(g.reachability.final_bench_level).toBe(3);
    expect(g.zero_input_recipes).toEqual(['pump_crude']); expect(g.self_consuming_recipes).toEqual([]);
    for (const c of g.conservation) expect(c.loses_every_cycle, c.item + ' ' + JSON.stringify(c.net_raw_per_cycle)).toBe(true);
    expect(recipesFor('spares')).toEqual([]);
    for (const a of g.alternatives) { expect(a.verdict, a.output).not.toBe('MISSING'); if (a.verdict === 'LEGITIMATE') expect(a.strictly_dominated, a.output).toEqual([]); }
    expect(g.alternatives.map(a => a.output).sort()).toEqual(Object.keys(ALTERNATIVES).sort());
    // the one bench gate hidden in a bill is the recorded Cleaver decision, and nothing else
    expect(g.silent_gates.map(s => s.recipe + ':' + s.ingredient)).toEqual(['cleaver:metal_blade']);
    expect(ITEM_DESIGN.metal_blade[0]).toBe('BOTH');
    for (const i of g.outside_main_component) expect(i.linked_by.length, i.id + ' must be tied to a system').toBeGreaterThan(0);
    expect(g.dead_end_materials).toEqual([]);
  });
});

describe('recipe revision 6 — cut-over and old jobs', () => {
  const T0 = Date.UTC(2026, 10, 15, 9); let seq = 0, clk = T0 + 10; const at = (ms = 1000) => (clk += ms);
  const act = (gs: GameState, type: string, p: object = {}) => dispatch(gs, { id: 'icm-' + (++seq), type, ...p } as any, at());
  const run = () => { const gs = newGame(); const rc = startRun(gs, 'male', T0, null, 11); expect(rc.ok, JSON.stringify(rc)).toBe(true); gs.run!.creatures = []; return gs; };
  const give = (gs: GameState, key: string, qty = 1) => expect(addItem(gs.run!, 'inv', key, qty), key).toBe(0);
  const inv = (gs: GameState, key: string) => countItem(gs.run!, 'inv', key);
  /** FIXTURE: a Workbench beside the player (position, ownership and level only). */
  function bench(gs: GameState, level: number): Entity {
    const r = gs.run!, px = Math.floor(r.player.x / TILE), py = Math.floor(r.player.y / TILE), fuel = mkContainer(r, 'fuel', 3), out = mkContainer(r, 'out', 6);
    const e = { id: 'icm-st-' + (++seq), kind: 'struct', type: 'workbench', x: (px + 1) * TILE + 8, y: py * TILE + 8, tx: px + 1, ty: py, hp: 200, maxHp: 200, station: { fuelC: fuel.id, outC: out.id, burn: 0, queue: [], level } } as unknown as Entity;
    r.entities[e.id] = e; markDirty(); return e;
  }
  it('revision is 6 and every changed id is frozen at 5 with its old bill', () => {
    expect(RECIPE_REVISION).toBe(6);
    expect([...(CUT_OVER_REVISIONS[5] as string[])].sort()).toEqual(['arrow', 'metal_blade', 'refined_iron_boots', 'refined_iron_chest', 'refined_iron_helmet', 'refined_iron_legs', 'reinforced_spear', 'reinforced_spear_blade']);
    for (const id of CUT_OVER_REVISIONS[5] as string[]) expect(LEGACY_RECIPES[id + '@5'], id).toBeTruthy();
    expect(LEGACY_RECIPES['metal_blade@5'].ins).toEqual([['iron_ingot', 4], ['spares', 1]]);
    expect(LEGACY_RECIPES['reinforced_spear@5'].ins).toEqual([['iron_ingot', 2], ['metal_blade', 1], ['wood', 2]]);
    expect(LEGACY_RECIPES['refined_iron_chest@5'].tier).toBe(3); expect(LEGACY_RECIPES['refined_iron_chest@5'].ins).toEqual(RECIPES.refined_iron_chest.ins);
    expect(recipeForJob('metal_blade', 5)).toBe(LEGACY_RECIPES['metal_blade@5']); expect(recipeForJob('metal_blade', 6)).toBe(RECIPES.metal_blade);
    expect(recipeForJob('reinforced_spear_blade', 5)).toBe(LEGACY_RECIPES['reinforced_spear_blade@5']);
    expect(recipeForJob('metal_blade', 7)).toBeNull();
  });
  it('the dominated spear alias is gone and resolves to the one spear formula', () => {
    expect(RECIPES.reinforced_spear_blade).toBeUndefined();
    expect(liveRecipeId('reinforced_spear_blade')).toBe('reinforced_spear');
    expect(RECIPES.reinforced_spear.ins).toEqual(LEGACY_RECIPES['reinforced_spear_blade@5'].ins);
    expect(starter.has('reinforced_spear')).toBe(true); expect(starter.has('arrow')).toBe(true);
  });
  it('a new Metal Blade job pays 3 Iron + 1 Parts through the real craft intent', () => {
    const gs = run(), st = bench(gs, 2); give(gs, 'iron_ingot', 4); give(gs, 'spares', 1);
    const rc = act(gs, 'craft', { recipe: 'metal_blade', eid: st.id }); expect(rc.ok, JSON.stringify(rc)).toBe(true);
    expect(inv(gs, 'iron_ingot')).toBe(1); expect(inv(gs, 'spares')).toBe(0);
    expect(st.station!.queue[0].rv).toBe(6);
    const ms = RECIPES.metal_blade.secs * 1000 + 500; stepStations(gs, ms, at(ms));
    expect(countItem(gs.run!, st.station!.outC, 'metal_blade')).toBe(1);
  });
  it('placing a pack spends the pack and nothing else; raw materials without a pack place nothing', () => {
    const gs = run(), r = gs.run!, px = Math.floor(r.player.x / TILE), py = Math.floor(r.player.y / TILE);
    let spot: [number, number] | null = null;
    give(gs, 'deploy_campfire', 1);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2], [1, 1], [-1, -1]]) if (!spot && !buildReason(gs, 'campfire', px + dx, py + dy)) spot = [px + dx, py + dy];
    expect(spot, 'a free tile beside the start').toBeTruthy();
    for (const [k] of STRUCTS.campfire.cost) expect(inv(gs, k), k + ' not carried').toBe(0);
    const rc = act(gs, 'build', { struct: 'campfire', tx: spot![0], ty: spot![1] }); expect(rc.ok, JSON.stringify(rc)).toBe(true);
    expect(inv(gs, 'deploy_campfire')).toBe(0);
    expect(Object.values(r.entities).filter(e => e.type === 'campfire').length).toBe(1);
    // the same structure cannot be paid for a second time out of raw materials
    for (const [k, n] of STRUCTS.campfire.cost) give(gs, k, n);
    const free = ([[3, 0], [0, 3], [-3, 0], [0, -3], [2, 2], [-2, -2], [3, 1], [1, 3]] as [number, number][]).map(([dx, dy]) => [px + dx, py + dy] as [number, number]);
    for (const [tx, ty] of free) expect(act(gs, 'build', { struct: 'campfire', tx, ty }).ok, `raw build at ${tx},${ty}`).toBe(false);
    for (const [k, n] of STRUCTS.campfire.cost) expect(inv(gs, k), k + ' untouched').toBe(n);
  });
  it('a paid job stored at revision 5 finishes with its old yield and is not charged again', () => {
    const gs = run(), st = bench(gs, 2);
    // The job is paid through the real craft intent (the revision-6 spear bill IS the frozen alias bill), then
    // FIXTURE: relabelled to what a revision-5 save holds: the retired alias id stamped rv 5.
    give(gs, 'metal_blade', 1); give(gs, 'iron_ingot', 1); give(gs, 'wood', 2);
    const rc = act(gs, 'craft', { recipe: 'reinforced_spear', eid: st.id }); expect(rc.ok, JSON.stringify(rc)).toBe(true);
    const job = st.station!.queue[0]; job.recipe = 'reinforced_spear_blade'; job.rv = 5;
    job.left = job.total = LEGACY_RECIPES['reinforced_spear_blade@5'].secs * 1000;
    expect(act(gs, 'craft', { recipe: 'reinforced_spear_blade', eid: st.id }).ok, 'no NEW work under the retired id').toBe(false);
    const before = JSON.stringify(C(gs.run!, 'inv').slots);
    const ms = job.total + 1000; stepStations(gs, ms, at(ms));
    expect(countItem(gs.run!, st.station!.outC, 'reinforced_spear')).toBe(1);
    expect(JSON.stringify(C(gs.run!, 'inv').slots)).toBe(before);
    expect(st.station!.queue.length).toBe(0);
  });
});
