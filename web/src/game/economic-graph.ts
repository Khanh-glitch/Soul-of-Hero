/**
 * The production ontology is the existing ITEMS registry (catalog.ts). This module is a
 * derived view: it never defines a second item catalog and can be rebuilt from runtime data.
 * Crafting depth is independent from recipe discovery tier and physical station level.
 */
import { ITEMS, RECIPES, SOURCES, CREATURES, STRUCTS, GARDEN_CROPS, GARDEN_FRAME_COST, ELDERS, PRIMORDIAL_ELDERS, INDUSTRIAL_MODULE, FURNACE_LINING, GENERATOR_CAPACITY_UPGRADE, CART_FREIGHT_UPGRADE, WORKBENCH_UPGRADE, WORKBENCH_UPGRADE_III } from './catalog';
import { LOOT_CLASSES, LOOT_B01_ROLES, LOOT_B04_ROLES, LOOT_B05_TOOLBOX_GRADE } from './loot-ecology';
import { MAP_CONTENT_PACKS } from './content';
import { BAL } from './core';
import { componentRuleSnapshot } from './recycler';

export const ITEM_ONTOLOGY_VERSION = 2 as const;
export type SourceKind = 'world-node' | 'creature-drop' | 'loot-table' | 'authored-map' | 'recipe' | 'system';
export interface ItemGraphNode {
  id: string; name: string; category: string; level: number | null;
  description: string; weight: number; stackLimit: number; durability: number | null; chargeCapacity: number | null;
  sources: string[]; recipesIn: string[]; recipesOut: string[]; consumers: string[];
  recipes: { id: string; inputs: [string,number][]; outputs: [string,number][]; station: string | null; stationLevel: number; researchTier: number; seconds: number }[];
  recipeConsumption: { id: string; inputQuantity: number; outputs: [string,number][] }[];
  functionTags: string[]; status: 'reachable' | 'special-only' | 'unresolved';
  disposition: 'KEEP' | 'RENAME'; dispositionNote: string;
}
export interface ItemGraphEdge { from: string; to: string; recipe: string; inputQuantity: number; outputQuantity: number }
export interface ItemGraph {
  version: 2; items: ItemGraphNode[]; edges: ItemGraphEdge[]; recipeCount: number;
  diagnostics: { unknownItems: string[]; cycles: string[][]; unresolved: string[] };
}

const add = (m: Map<string, Set<string>>, key: string, value: string) => {
  if (!m.has(key)) m.set(key, new Set()); m.get(key)!.add(value);
};

/** Return full provenance/dependency graph and least attainable crafting depth. */
export function buildEconomicGraph(): ItemGraph {
  const direct = new Map<string, Set<string>>();
  const recipeOutputs = new Map<string, Array<{ key: string; ins: [string, number][] }>>();
  const inputsByItem = new Map<string, Set<string>>();
  const outputsByItem = new Map<string, Set<string>>();
  const actionConsumers = new Map<string, Set<string>>();
  const edges: ItemGraphEdge[] = [];
  const known = new Set(Object.keys(ITEMS));
  const outputMap = (r: (typeof RECIPES)[string]) => r.outs ?? [[r.out, r.qty] as [string, number]];

  for (const [id, source] of Object.entries(SOURCES)) {
    for (const [item, qty] of source.yields) add(direct, item, `Node: ${source.name} (${id}) · base ${qty}/stock`);
    for (const [item, chance] of source.bonus ?? []) add(direct, item, `Bonus salvage: ${source.name} (${id}) · authored chance ${chance}`);
  }
  for (const [id, creature] of Object.entries(CREATURES)) {
    for (const [item, qty, chance] of creature.drops) add(direct, item, `Creature: ${creature.name} (${id}) · ${qty} · authored chance ${chance}`);
    if (creature.uniqueDrop) add(direct, creature.uniqueDrop, `Unique reward: ${creature.name} (${id}) · unique`);
  }
  for (const [id, elder] of Object.entries(ELDERS)) add(direct, elder.stone, `Elder progression reward: ${elder.name} (${id})`);
  for (const [id, elder] of Object.entries(PRIMORDIAL_ELDERS)) add(direct, elder.stone, `Primordial Elder progression reward: ${elder.name} (${id})`);
  add(direct, 'rcash', 'Finite authored POI cash entity (mint action)');
  add(direct, 'knife', 'New-run starter equipment');
  add(direct, 'escrow_chest', 'Vendor exchange for physical Ragnarok Cash');
  add(direct, 'salvaged_oil', 'Finite car-wreck salvage action (engine-authored drop)');
  const husbandrySources: [string,string][] = [
    ['grouse_egg','Pen yield: female adult grouse · 1 / 4h'], ['feather','Pen yield: grouse molt · 2 / 4h; butchery adult 3 / juvenile 1'],
    ['fur','Pen yield: hare molt · 1 / 4.5h; butchery adult 2 / juvenile 1'], ['mushroom','Pen yield: adult boar · 2 / 5h'],
    ['fiber','Pen yield: adult deer · 2 / 5.5h'], ['herb','Pen yield: adult deer secondary · 1 / 5.5h'],
    ['meat','Butchery: boar adult 5/juvenile 2; deer 5/2; hare 2/1; grouse 2/1'], ['hide','Butchery: boar adult 2/juvenile 1; deer adult 3/juvenile 1'], ['boar_tusk','Butchery: adult boar · 2'],
  ];
  for (const [item, source] of husbandrySources) add(direct, item, source);
  for (const item of ['animal_feed','crop','berries','herb','mushroom','seed']) add(actionConsumers, item, 'Husbandry trough feeding');
  for (const item of ['seed','crop','herb']) add(actionConsumers, item, 'Garden planting / harvest');
  for (const kind of ['v1','v2','v3'] as const) {
    const table = BAL[`recycler${kind.charAt(0).toUpperCase()}${kind.slice(1)}`]?.rules as Record<string, { base?: [string,number][]; mid?: [string,number][]; high?: [string,number][] }> | undefined;
    for (const [input, rule] of Object.entries(table ?? {})) {
      add(actionConsumers, input, `Recycler (${kind}) input`);
      for (const [output] of [...(rule.base ?? []), ...(rule.mid ?? []), ...(rule.high ?? [])]) add(direct, output, `Recycler recovery ${kind} from ${input}`);
    }
  }
  for (const [ruleId, rule] of Object.entries(componentRuleSnapshot())) {
    add(actionConsumers, rule.key, `Recycler component (${ruleId})`);
    for (const [output] of rule.outputs) add(direct, output, `Recycler component recovery ${ruleId}`);
  }
  for (const [kind, def] of Object.entries(LOOT_CLASSES)) {
    add(direct, def.fixed[0], `Loot table: ${kind} fixed · ${def.fixed[1]}`);
    for (const [item, qty] of def.options) add(direct, item, `Loot table: ${kind} option · ${qty}`);
  }
  for (const [role, def] of Object.entries(LOOT_B01_ROLES)) {
    for (const [item, qty] of [...def.fixed, ...def.pool]) add(direct, item, `Loot role B01: ${role} · ${qty}`);
  }
  for (const [role, def] of Object.entries(LOOT_B04_ROLES)) {
    for (const [item, qty] of [...def.fixed, ...def.pool]) add(direct, item, `Loot role B04: ${role} · ${qty}`);
  }
  for (const [grade, def] of Object.entries(LOOT_B05_TOOLBOX_GRADE)) {
    for (const [item, qty] of [...def.fixed, ...def.pool]) add(direct, item, `Loot grade B05: ${grade} · ${qty}`);
  }
  // Actual automated garden outputs and regrown seed are direct farm sources; harvest is not a recipe.
  for (const [crop, def] of Object.entries(GARDEN_CROPS)) for (const [item, qty] of def.output) add(direct, item, `Farm production: ${def.name} (${crop}) · ${qty}/harvest, ${def.seconds}s`);
  // Authored POI pack caches are a data source, not inferred loot odds.
  for (const [layoutId, pack] of Object.entries(MAP_CONTENT_PACKS)) for (const poi of pack.pois) {
    for (const cache of ['outer', 'vault'] as const) for (const entry of poi.loot[cache]) {
      const item = entry.item.startsWith('blueprint:') ? 'blueprint' : entry.item;
      add(direct, item, `Authored map loot: ${layoutId}/${poi.id}/${cache} · ${entry.quantity}`);
    }
  }
  // Existing Shipping-authored crate literals; reference-only audit labels. Their quantities remain in world.ts.
  const shippingCaches: Record<string, [string, number][]> = {
    'start/s0': [['berries',3],['fiber',6],['rope',1]], 'start/s1': [['meat',2],['rope',2],['bandage',1]],
    'start/s2': [['torch',2],['stone',4],['bandage',1]], 'start/s3': [['scrap',4],['spares',2],['water_flask',1],['field_repair_kit',1]],
    'trading-post': [['rope',3],['cloth',2],['blueprint',1]], 'trading-post/side-cache': [['wood',8],['iron_ingot',1]],
    'old-mill': [['seed',6],['blueprint',1],['crop',2]], 'old-mill/side-cache': [['leather',2],['blueprint',1]],
    'factory-vault': [['core_fire',1],['blueprint',1],['spares',6]], 'factory-vault/side-cache': [['blueprint',1],['iron_ingot',4]],
    'factory-exterior': [['scrap',6],['spares',3],['iron_sword',1],['mechanical_parts',2],['fasteners',3]], 'factory-ore-cache': [['iron_ore',4],['coal',3]],
    'lighthouse-top': [['core_storm',1],['blueprint',1]], 'lighthouse': [['fuel_can',1],['rope',2]],
    'wreck': [['core_frost',1],['spares',4]], 'wreck/side-cache': [['cloth',3],['fuel_can',1],['blueprint',1],['treated_canvas',2]],
    'watchtower': [['keycard',1],['blueprint',1],['torch',2]], 'evacuation-pier': [['medkit',1],['water_flask',1]],
  };
  for (const [source, items] of Object.entries(shippingCaches)) for (const [item, qty] of items) add(direct, item, `Authored map loot: shipping/${source} · ${qty}`);

  for (const [recipeId, recipe] of Object.entries(RECIPES)) {
    const outs = outputMap(recipe);
    for (const [item] of outs) {
      add(outputsByItem, item, recipeId);
      const alternatives = recipeOutputs.get(item) ?? [];
      alternatives.push({ key: recipeId, ins: recipe.ins }); recipeOutputs.set(item, alternatives);
    }
    for (const [item] of recipe.ins) add(inputsByItem, item, recipeId);
    for (const [item, inputQuantity] of recipe.ins) for (const [out, outputQuantity] of outs) edges.push({ from: item, to: out, recipe: recipeId, inputQuantity, outputQuantity });
  }

  const levels = new Map<string, number>();
  // Direct loot does not erase a craft chain: only items with no recipe are level 0.
  for (const id of known) if ((direct.get(id)?.size ?? 0) > 0 && !recipeOutputs.has(id)) levels.set(id, 0);
  // Least fixed point: alternative recipes are viable if every ingredient has a finite depth.
  let changed = true; let guard = 0;
  while (changed && guard++ < known.size + 1) {
    changed = false;
    for (const [out, recipes] of recipeOutputs) {
      const possible = recipes.filter(r => r.ins.every(([item]) => levels.has(item)));
      if (!possible.length) continue;
      const n = 1 + Math.min(...possible.map(r => Math.max(0, ...r.ins.map(([item]) => levels.get(item) ?? 0))));
      if (!levels.has(out) || n < levels.get(out)!) { levels.set(out, n); changed = true; }
    }
  }

  const cycles = findCycles([...known], recipeOutputs);
  const nodes = [...known].sort().map(id => {
    const item = ITEMS[id]; const tags: string[] = [];
    if (item.food) tags.push('consumable'); if (item.fuel !== undefined) tags.push('fuel');
    if (item.charge !== undefined || item.initialCharge !== undefined) tags.push('charge/container');
    if (item.dur !== undefined || item.slot || item.dmg !== undefined || item.power) tags.push('equipment');
    if (item.creatorCore || item.cat === 'core') tags.push('Creator Core / legacy Core'); if (item.essence) tags.push('Essence');
    if (id === 'energy_basic' || id === 'energy_refined') tags.push('Core ammunition');
    if (item.specimen || item.studyRecipe) tags.push('research/specimen');
    if (item.place) tags.push('placeable'); if (item.light) tags.push('light');
    if (item.repair) tags.push('repairable'); if (item.salvage) tags.push('salvageable');
    if (item.ranged) tags.push('ammunition user');
    if ([...Object.values(ITEMS)].some(def => def.ranged === id)) tags.push('ammunition');
    if (GARDEN_CROPS.crop.output.some(([key]) => key === id) || GARDEN_CROPS.herb.output.some(([key]) => key === id)) tags.push('farm output');
    const consumers = new Set<string>();
    for (const r of inputsByItem.get(id) ?? []) consumers.add(`Recipe: ${r}`);
    for (const action of actionConsumers.get(id) ?? []) consumers.add(action);
    if (item.repair) consumers.add('Repair action'); if (item.salvage) consumers.add('Salvage action');
    if (item.specimen) consumers.add('Research study'); if (item.studyRecipe) consumers.add('Research unlock');
    if (item.fuel !== undefined) consumers.add('Fuel burn'); if (item.food) consumers.add('Eat/drink/use');
    if (item.waterContainer) consumers.add('Refill, drink, water crops, or hydrate pen');
    if ([...Object.values(ITEMS)].some(def => def.ranged === id)) consumers.add('Consumed as ranged-weapon ammunition');
    if (id === 'arrow') consumers.add('Consumed by arrow turret');
    if (id === 'fuel_can') consumers.add('Motorbike refueling');
    if (item.cat === 'bp') consumers.add('Learn recipe from physical blueprint');
    if (item.charge !== undefined) consumers.add('Charge/reload'); if (item.creatorCore || item.cat === 'core') consumers.add('Equip / Core abilities');
    if (id === 'energy_basic' || id === 'energy_refined' || item.essence) consumers.add('Load / consume in Creator Core');
    if (id === 'keycard') consumers.add('Unlock gated POI door');
    if (item.place) consumers.add('World placement');
    if (id === 'rcash') { consumers.add('Deposit into secured profile cash'); consumers.add('Purchase escrow chest'); }
    if (item.cat === 'stone') consumers.add('Elder collection / progression record');
    for (const [sid, s] of Object.entries(STRUCTS)) for (const [input, qty] of s.cost) if (input === id) {
      consumers.add(`Build structure: ${sid} · ${qty}`);
      consumers.add(`Repair structure: ${sid} · ${Math.max(1, Math.ceil(qty * 0.25))}`);
    }
    for (const [label, cost] of [['Garden frame', GARDEN_FRAME_COST], ['Industrial module', INDUSTRIAL_MODULE.cost], ['Furnace lining', FURNACE_LINING.cost], ['Generator capacity', GENERATOR_CAPACITY_UPGRADE.cost], ['Cart freight', CART_FREIGHT_UPGRADE.cost], ['Workbench II', WORKBENCH_UPGRADE.cost], ['Workbench III', WORKBENCH_UPGRADE_III.cost]] as const) {
      for (const [input, qty] of cost) if (input === id) consumers.add(`${label} upgrade · ${qty}`);
    }
    if (id === 'spares') consumers.add('Run-local research spending');
    if (id === 'rcash') consumers.add('Authorized vendor purchases');
    if (id === 'mechanical_parts') consumers.add('Motorbike repair · 1');
    if (id === 'fasteners') consumers.add('Motorbike repair · 1');
    const sources = [...(direct.get(id) ?? [])];
    if (outputsByItem.has(id)) sources.push(...[...outputsByItem.get(id)!].map(r => { const recipe = RECIPES[r]; const out = outputMap(recipe).find(([key]) => key === id); return `Craft: ${r} · ${out?.[1] ?? 0}`; }));
    const level = levels.get(id) ?? null;
    const renamed: Record<string, string> = { mechanical_parts: 'Display name normalized to Parts; stable item key retained.', refined_iron_ingot: 'Display name normalized to Refined Iron; stable item key retained.' };
    const disposition = Object.prototype.hasOwnProperty.call(renamed, id) ? 'RENAME' as const : 'KEEP' as const;
    const recipeIds = [...(outputsByItem.get(id) ?? [])].sort();
    const recipes = recipeIds.map(recipeId => { const r = RECIPES[recipeId]; return { id: recipeId, inputs: r.ins.map(([key, qty]) => [key, qty] as [string,number]), outputs: outputMap(r).map(([key, qty]) => [key, qty] as [string,number]), station: r.station, stationLevel: r.stationLevel ?? 1, researchTier: r.tier, seconds: r.secs }; });
    const recipeConsumption = [...(inputsByItem.get(id) ?? [])].sort().map(recipeId => { const r = RECIPES[recipeId]; return { id: recipeId, inputQuantity: r.ins.find(([key]) => key === id)![1], outputs: outputMap(r).map(([key, qty]) => [key, qty] as [string,number]) }; });
    return { id, name: item.name, category: item.cat, level, description: item.desc, weight: item.w, stackLimit: item.max, durability: item.dur ?? null, chargeCapacity: item.charge ?? null, sources, recipesIn: [...(inputsByItem.get(id) ?? [])].sort(), recipesOut: recipeIds, recipes, recipeConsumption, consumers: [...consumers].sort(), functionTags: tags, status: level !== null ? 'reachable' as const : tags.length || sources.length ? 'special-only' as const : 'unresolved' as const, disposition, dispositionNote: renamed[id] ?? 'Retain identity and current game behavior; no migration evidence authorizes a change.' };
  });
  const unknown = new Set<string>();
  for (const e of edges) { if (!known.has(e.from)) unknown.add(e.from); if (!known.has(e.to)) unknown.add(e.to); }
  for (const [id, source] of Object.entries(SOURCES)) for (const [item] of source.yields) if (!known.has(item)) unknown.add(item);
  for (const creature of Object.values(CREATURES)) for (const [item] of creature.drops) if (!known.has(item)) unknown.add(item);
  const unresolved = nodes.filter(n => n.status === 'unresolved').map(n => n.id);
  return { version: 2, items: nodes, edges, recipeCount: Object.keys(RECIPES).length, diagnostics: { unknownItems: [...unknown].sort(), cycles, unresolved } };
}

function findCycles(items: string[], recipes: Map<string, Array<{ key: string; ins: [string, number][] }>>): string[][] {
  const graph = new Map<string, Set<string>>();
  for (const [out, rs] of recipes) for (const r of rs) for (const [input] of r.ins) {
    if (!graph.has(input)) graph.set(input, new Set()); graph.get(input)!.add(out);
  }
  const visiting = new Set<string>(), done = new Set<string>(), path: string[] = [], found: string[][] = [];
  const visit = (n: string) => {
    if (visiting.has(n)) { const i = path.indexOf(n); found.push([...path.slice(i), n]); return; }
    if (done.has(n)) return;
    visiting.add(n); path.push(n); for (const next of graph.get(n) ?? []) visit(next); path.pop(); visiting.delete(n); done.add(n);
  };
  for (const id of items) visit(id);
  return found;
}
