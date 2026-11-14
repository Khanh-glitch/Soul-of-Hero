/**
 * Item Ontology V2 — PROJECTION of the existing SOH economic multigraph (`economic-graph.ts`).
 *
 * This module is an adapter, not a second graph. It takes the `SohEconomicGraph` that
 * `buildSohEconomicGraph` already extracts from the live catalogs and worlds, and reads out the
 * per-item view an ontology review needs: sources, consumers, craft depth, station and knowledge
 * requirements, recycling, per-layout reachability and structural duplication signals.
 *
 * Six properties are kept strictly apart, because merging them is what made earlier audits lie:
 *   craft_depth          recipe distance from a non-crafted input (0 = never crafted)
 *   station_tier         the physical station + level the cheapest live recipe needs
 *   research_tier        `RecipeDef.tier`, the discovery tier (independent of the station: catalog H08)
 *   rarity               NOT a runtime field in SOH — always null here; nothing is inferred
 *   acquisition_types    the edge kinds that can put the item in a container, per layout
 *   runtime_reachability the multigraph's fixed-point solver result per layout, never "it is in a loot table"
 *
 * Pure: no world building, no file access. Vitest injects the graph (tests/support).
 */
import {
  ALWAYS_KNOWN_RECIPES,
  DEPLOYABLE_TYPES,
  ITEMS,
  RECIPES,
  RECIPE_REVISION,
  RETIRED_RECIPES,
  familyOfRecipe,
  requiredStationLevel,
  starterKnowledge,
  type Recipe,
} from './catalog';
import { BAL, type Stack } from './core';
import type { EconEdge, EdgeKind, RuntimeStatus, SohEconomicGraph } from './economic-graph';
import { itemClass, type ItemClass } from './item-class';
import { recoveryPlan } from './recycler';

export const ITEM_ONTOLOGY_SCHEMA = 'soh.item-ontology.v2' as const;

/** Edge kinds that can put a NEW unit of an item into the world or a container. */
export const ACQUISITION_KINDS: readonly EdgeKind[] = [
  'HARVEST_YIELD', 'HARVEST_BONUS', 'HARVEST_QUALITY_TIER', 'CREATURE_DROP', 'SIDE_BOSS_UNIQUE_DROP',
  'ELDER_STONE_DROP', 'HUSBANDRY_RENEWABLE_YIELD', 'HUSBANDRY_BUTCHER', 'LOOT_STATIC_FIXED', 'LOOT_ECOLOGY_POOL',
  'CREATOR_LOOT_UNIQUE', 'AIRDROP_DROP', 'CRAFT_OUTPUT', 'RECYCLE_OUTPUT', 'GARDEN_HARVEST_OUTPUT',
  'VENDOR_TRADE_SPARES', 'VENDOR_TRADE_SECURED', 'ESCROW_PURCHASE', 'JOURNEY_REQUISITION', 'CORE_CAST_OUTPUT',
  'DISMANTLE_SALVAGE',
];
/** Returns of something already paid for. Never counted as a source of new supply. */
export const REFUND_KINDS: readonly EdgeKind[] = ['RECLAIM_REFUND'];
/** In-edges that are another item being spent ON this item (loading, repairing). Not supply. */
export const MAINTENANCE_IN_KINDS: readonly EdgeKind[] = ['CORE_LOAD', 'REPAIR_INPUT', 'FIELD_REPAIR'];
/** Out-edges that restate a build cost (upkeep, reclaim loss). Shown, but not counted as a distinct use. */
export const DERIVED_SINK_KINDS: readonly EdgeKind[] = ['TERRITORY_UPKEEP_PER_24H', 'RECLAIM_REFUND', 'RUN_WIPE_SINK'];
/** Out-edges that define what a material is FOR (used for consumer targets and co-consumption). */
export const COST_KINDS: readonly EdgeKind[] = ['CRAFT_INPUT', 'BUILD_COST', 'UPGRADE_COST'];
/** Out-edges where the item is spent to keep something else working. A real use, but of the "cost" kind. */
export const MAINTENANCE_OUT_KINDS: readonly EdgeKind[] = ['REPAIR_INPUT', 'VEHICLE_WEAR_REPAIR', 'TRAP_ARM_SINK', 'FIELD_REPAIR'];
/** Out-edges that ARE the item's own function: it is eaten, burned, loaded, fired, fed, scanned. */
export const FUNCTION_KINDS: readonly EdgeKind[] = [
  'SURVIVAL_CONSUME', 'CORE_LOAD', 'CORE_CAST_SINK', 'CORE_CAST_OUTPUT', 'POWER_FUEL', 'STATION_FUEL', 'VEHICLE_FUEL_SINK',
  'VEHICLE_LUBRICATE', 'VEHICLE_DEPLOY', 'HUSBANDRY_FEED_TAME', 'HUSBANDRY_PEN_FEED', 'TURRET_AMMO_SINK', 'POI_ACCESS_GATE',
  'GARDEN_PLANT_INPUT', 'ESCROW_DEPOSIT', 'ESCROW_PURCHASE', 'CASH_CHEST_MINT', 'VENDOR_TRADE_SPARES', 'VENDOR_TRADE_SECURED',
  'RESEARCH_RANDOM', 'RESEARCH_DIRECTED', 'BLUEPRINT_LEARN',
];

export type Layer = 'BOTH' | 'SHIPPING' | 'VEYRA' | 'FIXTURE' | 'HISTORICAL' | 'STUB';
export const layerOf = (s: RuntimeStatus): Layer =>
  s === 'LIVE_SHIPPING_AND_VEYRA' ? 'BOTH'
    : s === 'LIVE_SHIPPING_ONLY' ? 'SHIPPING'
    : s === 'LIVE_VEYRA_ONLY' ? 'VEYRA'
    : s === 'TEST_FIXTURE_ONLY' ? 'FIXTURE'
    : s === 'HISTORICAL_INFLIGHT_ONLY' ? 'HISTORICAL'
    : 'STUB';
const isLive = (l: Layer) => l === 'BOTH' || l === 'SHIPPING' || l === 'VEYRA';
const onVeyra = (l: Layer) => l === 'BOTH' || l === 'VEYRA';
const onShipping = (l: Layer) => l === 'BOTH' || l === 'SHIPPING';

export type Reachability = 'SHIPPING_AND_VEYRA' | 'SHIPPING_ONLY' | 'VEYRA_ONLY' | 'FIXTURE_ONLY' | 'UNREACHABLE';

export interface SourceRef {
  kind: EdgeKind; from: string; layer: Layer; qty: number | null; probability: number | null; gates: string[];
  /** How many graph edges were folded into this row (e.g. 15 Veyra containers of the same POI family). */
  count: number;
}
export interface ConsumerRef { kind: EdgeKind; to: string; layer: Layer; qty: number | null; count: number }

export interface OntologyRecipe {
  id: string; out: string; outs: [string, number][]; ins: [string, number][];
  station: string; stationLevel: number; station_tier: string; research_tier: number;
  base: boolean; starter_known: boolean; family: string | null; alias: string | null; secs: number;
  layer: Layer; craftable_shipping: boolean; craftable_veyra: boolean;
  /** 1 + the deepest input's craft_depth. */
  depth: number;
  /** Full bill of materials through canonical recipes: distinct item ids touched, recipes run, raw inputs per ONE output unit. */
  bom: { distinct_items: number; craft_steps: number; raw: Record<string, number> };
}

export interface OntologyItem {
  id: string; name: string; cat: string; item_class: ItemClass | null; desc: string; weight: number; stack_max: number;
  /** True for the 24 `deploy_*` items the catalog creates in a loop from DEPLOYABLE_TYPES. */
  generated_deployable: boolean;
  craft_depth: number;
  craft_depth_recipe: string | null;
  station_tier: string | null;
  research_tier: number | null;
  /** How the cheapest-to-know producing recipe is learned. */
  knowledge: 'STARTER' | 'RESEARCH_OR_BLUEPRINT' | 'NOT_CRAFTED';
  rarity: null;
  acquisition_types: { shipping: EdgeKind[]; veyra: EdgeKind[]; fixture: EdgeKind[] };
  runtime_reachability: Reachability;
  /** True when every live non-craft source sits behind a POI access gate (keycard / power). */
  non_craft_sources_all_gated: boolean;
  sources: SourceRef[];
  refunds: SourceRef[];
  maintained_by: SourceRef[];
  consumers: ConsumerRef[];
  derived_sinks: ConsumerRef[];
  produced_by: string[];
  consumed_by: string[];
  /** Distinct things this item is spent on (recipe outputs, structures, upgrades), a packed device and its structure counted once. */
  consumer_targets: string[];
  /** Things this item keeps working: repairs, re-arming, vehicle service. */
  maintenance_targets: string[];
  /** What the item itself does, from ItemDef fields, its category and the graph's function edges. Study/repair/recycle are NOT functions. */
  direct_use: string[];
  recycle: { rule: string; outputs: [string, number][] } | null;
  recycled_from: string[];
  alt_routes: { live_recipes: number; non_craft_source_kinds: number };
  raw_per_unit: Record<string, number>;
  signals: string[];
}

export interface DominatedAlternative {
  out: string; cheaper: string; dearer: string;
  cheaper_raw: Record<string, number>; dearer_raw: Record<string, number>;
  verdict: 'STRICTLY_DOMINATED' | 'KNOWLEDGE_BYPASS' | 'BATCH_SIZE_ONLY' | 'STATION_TRADEOFF';
  note: string;
}

export interface RecycleLoopRow {
  item: string; rule: string; outputs: [string, number][];
  /** Mechanical Parts + Spares spent to craft one unit (cheapest live recipe, intermediates expanded). */
  parts_in: number;
  /** Mechanical Parts + Spares returned at full condition. */
  parts_out: number;
  /** Under ONE merged Parts resource: positive = iron turns into Parts, neutral = Parts survive the loop. */
  merged_parts_verdict: 'PARTS_POSITIVE' | 'PARTS_NEUTRAL' | 'PARTS_NEGATIVE' | 'SOURCE_ONLY';
}

export interface ItemOntologyProjection {
  schema: typeof ITEM_ONTOLOGY_SCHEMA;
  counts: {
    items: number; items_static: number; items_generated_deployable: number;
    recipes: number; recipes_deploy: number; recipe_revision: number; retired_recipes: string[];
    graph_nodes: number; graph_edges: number;
    by_reachability: Record<Reachability, number>;
    by_craft_depth: Record<string, number>;
    by_class: Record<string, number>;
    by_cat: Record<string, number>;
  };
  items: OntologyItem[];
  recipes: OntologyRecipe[];
  dominated_alternatives: DominatedAlternative[];
  twin_intermediates: { a: string; b: string; raw_inputs: string[]; station_tier: string }[];
  recycle_loops: RecycleLoopRow[];
  research: { random_spares: number; directed_spares: number; directed_max_tier_exclusive: number };
  veyra_blocked_recipes: string[];
  shipping_blocked_recipes: string[];
}

const STATION_ORDER = ['hand', 'campfire', 'furnace', 'workbench_1', 'workbench_2', 'workbench_3', 'refinery', 'oil_pump'];
export const stationTierOf = (r: Recipe): string =>
  r.station === null ? 'hand' : r.station === 'workbench' ? `workbench_${requiredStationLevel(r)}` : r.station;

const round = (n: number) => Math.round(n * 1000) / 1000;
const sortRec = (r: Record<string, number>) =>
  Object.fromEntries(Object.entries(r).filter(([, v]) => Math.abs(v) > 1e-9).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, round(v)]));
const outsOf = (r: Recipe): [string, number][] => (r.outs ?? [[r.out, r.qty]]) as [string, number][];

export type RecipeTable = Record<string, Recipe>;

/** A recipe is live when the multigraph carries a live CRAFT_OUTPUT edge for it. */
function recipeLayers(graph: SohEconomicGraph): Map<string, Layer> {
  const m = new Map<string, Layer>();
  for (const e of graph.edges) {
    if (e.kind !== 'CRAFT_OUTPUT' || !e.from.startsWith('recipe:')) continue;
    const id = e.from.slice(7);
    if (!Object.prototype.hasOwnProperty.call(RECIPES, id)) continue;
    const l = layerOf(e.runtimeStatus);
    const prev = m.get(id);
    if (!prev || (isLive(l) && !isLive(prev))) m.set(id, l);
  }
  return m;
}

/**
 * craft_depth by relaxation: an item with no live recipe is 0; otherwise the MIN over its live
 * recipes of 1 + the deepest input. MIN is deliberate — it answers "how early can this exist",
 * and the per-recipe `depth` keeps every alternative route visible.
 */
export function craftDepths(table: RecipeTable, liveRecipe: (id: string) => boolean): { depth: Map<string, number>; via: Map<string, string> } {
  const producers = new Map<string, string[]>();
  for (const [id, r] of Object.entries(table)) {
    if (!liveRecipe(id)) continue;
    for (const [o] of outsOf(r)) producers.set(o, [...(producers.get(o) ?? []), id]);
  }
  const depth = new Map<string, number>();
  const via = new Map<string, string>();
  const itemIds = new Set<string>([...Object.keys(ITEMS), ...producers.keys()]);
  for (const k of itemIds) depth.set(k, producers.has(k) ? Infinity : 0);
  for (let pass = 0; pass < 64; pass++) {
    let changed = false;
    for (const [item, recs] of producers) {
      for (const id of recs) {
        const ins = table[id].ins;
        const d = 1 + (ins.length ? Math.max(...ins.map(([k]) => depth.get(k) ?? 0)) : 0);
        if (d < (depth.get(item) ?? Infinity)) { depth.set(item, d); via.set(item, id); changed = true; }
      }
    }
    if (!changed) break;
  }
  return { depth, via };
}

/**
 * The recipe used when an intermediate is expanded to raw inputs: the live recipe whose id equals
 * the item id when one exists (the item's own named formula), else the shallowest live recipe.
 */
export function canonicalRecipes(table: RecipeTable, liveRecipe: (id: string) => boolean, via: Map<string, string>): Map<string, string> {
  const canon = new Map<string, string>();
  for (const [item, id] of via) canon.set(item, id);
  for (const id of Object.keys(table)) {
    if (liveRecipe(id) && outsOf(table[id]).some(([o]) => o === id)) canon.set(id, id);
  }
  return canon;
}

/** Raw inputs for `qty` units of `item`, expanding intermediates through canonical recipes. `terminal` items are never expanded. */
export function rawVector(
  table: RecipeTable, canon: Map<string, string>, item: string, qty: number,
  terminal: ReadonlySet<string> = new Set(), seen: string[] = [], touched?: { items: Set<string>; recipes: Set<string> },
): Record<string, number> {
  touched?.items.add(item);
  const rid = canon.get(item);
  if (!rid || terminal.has(item) || seen.includes(item)) return { [item]: qty };
  touched?.recipes.add(rid);
  const r = table[rid];
  const made = outsOf(r).find(([o]) => o === item)?.[1] ?? r.qty;
  const out: Record<string, number> = {};
  for (const [k, q] of r.ins) {
    const sub = rawVector(table, canon, k, (q * qty) / made, terminal, [...seen, item], touched);
    for (const [rk, rv] of Object.entries(sub)) out[rk] = (out[rk] ?? 0) + rv;
  }
  return out;
}

/** Raw inputs for ONE primary output unit of a specific recipe. */
export function recipeRaw(
  table: RecipeTable, canon: Map<string, string>, recipeId: string, terminal: ReadonlySet<string> = new Set(),
): { raw: Record<string, number>; distinct_items: number; craft_steps: number } {
  const r = table[recipeId];
  const touched = { items: new Set<string>(), recipes: new Set<string>([recipeId]) };
  const raw: Record<string, number> = {};
  for (const [k, q] of r.ins) {
    const sub = rawVector(table, canon, k, q / r.qty, terminal, [r.out], touched);
    for (const [rk, rv] of Object.entries(sub)) raw[rk] = (raw[rk] ?? 0) + rv;
  }
  return { raw: sortRec(raw), distinct_items: touched.items.size, craft_steps: touched.recipes.size };
}

function dominates(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let strict = false;
  for (const k of keys) {
    const av = a[k] ?? 0, bv = b[k] ?? 0;
    if (av > bv + 1e-9) return false;
    if (av < bv - 1e-9) strict = true;
  }
  return strict;
}

function directUse(key: string, outs: EconEdge[]): string[] {
  const d = ITEMS[key];
  const u: string[] = [];
  if (d.food) u.push('consume');
  if (d.power) u.push('harvest_tool');
  if (d.dmg) u.push('weapon');
  if (d.slot) u.push(`equip_${d.slot}`);
  if (d.fuel) u.push('fuel');
  if (d.creatorCore) u.push('creator_core');
  if (d.core) u.push('legacy_core');
  if (d.place || d.cat === 'place') u.push('place');
  if (d.light) u.push('light');
  if (d.waterContainer) u.push('water_container');
  if (d.carryBonus) u.push('carry_bonus');
  // A tool with no stat field still does something when held (the Taming Lead is checked by
  // engine.ts taming, never consumed, and so has no edge in the multigraph).
  if (d.cat === 'tool' && u.length === 0) u.push('held_tool');
  if (d.cat === 'stone') u.push('elder_trophy');
  // A specimen's designated purpose is destructive study at the Research Table (RESEARCH_SPECIMEN).
  if (d.specimen || outs.some((e) => e.kind === 'RESEARCH_SPECIMEN')) u.push('specimen_study');
  for (const e of outs) {
    if (!FUNCTION_KINDS.includes(e.kind) || !isLive(layerOf(e.runtimeStatus))) continue;
    const tag = `graph:${e.kind}`;
    if (!u.includes(tag)) u.push(tag);
  }
  // Ammunition and durability are modelled as CRAFT_INPUT into a sink node.
  if (outs.some((e) => e.kind === 'CRAFT_INPUT' && e.to === 'sink:ammo_consumption')) u.push('ammo');
  return u;
}

/** Fold parallel edges that differ only by which container of a POI family they come from. */
function foldSources(edges: EconEdge[]): SourceRef[] {
  const m = new Map<string, SourceRef>();
  for (const e of edges) {
    const layer = layerOf(e.runtimeStatus);
    const from = e.from.startsWith('container:veyra:') ? e.from.split(':').slice(0, 3).join(':') : e.from;
    const qty = e.qtyOut ?? null, probability = e.probability ?? null;
    const key = [e.kind, from, layer, qty, probability, e.gateIds.join('+')].join('|');
    const cur = m.get(key);
    if (cur) cur.count++;
    else m.set(key, { kind: e.kind, from, layer, qty, probability, gates: [...e.gateIds], count: 1 });
  }
  return [...m.values()].sort((a, b) => (a.kind + a.from + a.layer).localeCompare(b.kind + b.from + b.layer));
}
function foldConsumers(edges: EconEdge[]): ConsumerRef[] {
  const m = new Map<string, ConsumerRef>();
  for (const e of edges) {
    const layer = layerOf(e.runtimeStatus);
    const qty = e.qtyIn ?? null;
    const key = [e.kind, e.to, layer, qty].join('|');
    const cur = m.get(key);
    if (cur) cur.count++;
    else m.set(key, { kind: e.kind, to: e.to, layer, qty, count: 1 });
  }
  return [...m.values()].sort((a, b) => (a.kind + a.to).localeCompare(b.kind + b.to));
}

/** A packed device recipe and the structure it becomes are ONE use of a material, not two. */
export function consumerTarget(to: string): string {
  if (to.startsWith('recipe:deploy_')) return `structure:${to.slice('recipe:deploy_'.length)}`;
  if (to.startsWith('recipe:')) {
    const r = RECIPES[to.slice(7)];
    return r ? `make:${r.out}` : to;
  }
  return to;
}

const PARTS_KEYS = new Set(['mechanical_parts', 'spares']);

export function projectItemOntology(graph: SohEconomicGraph): ItemOntologyProjection {
  const table = RECIPES as RecipeTable;
  const rLayer = recipeLayers(graph);
  const live = (id: string) => isLive(rLayer.get(id) ?? 'STUB');
  const { depth, via } = craftDepths(table, live);
  const canon = canonicalRecipes(table, live, via);
  const starter = new Set(starterKnowledge());
  const always = new Set(ALWAYS_KNOWN_RECIPES);
  const deployable = new Set((DEPLOYABLE_TYPES as readonly string[]).map((t) => `deploy_${t}`));
  const shipReach = new Set(graph.diagnostics.shippingReachableItems);
  const veyReach = new Set(graph.diagnostics.veyraReachableItems);
  const shipBlocked = new Set(graph.diagnostics.shippingUncraftableRecipes);
  const veyBlocked = new Set(graph.diagnostics.veyraUncraftableRecipes);

  const inEdges = new Map<string, EconEdge[]>();
  const outEdges = new Map<string, EconEdge[]>();
  for (const e of graph.edges) {
    if (e.to.startsWith('item:')) inEdges.set(e.to, [...(inEdges.get(e.to) ?? []), e]);
    if (e.from.startsWith('item:')) outEdges.set(e.from, [...(outEdges.get(e.from) ?? []), e]);
  }
  // The multigraph routes a physical item that doubles as a currency through a `currency:` node
  // (item:spares → currency:spares → research / vendor). Those spends belong to the item.
  for (const n of graph.nodes) {
    const phys = n.kind === 'currency' ? (n.meta as { physicalItem?: string } | undefined)?.physicalItem : undefined;
    if (!phys) continue;
    const spent = graph.edges.filter((e) => e.from === n.id);
    outEdges.set(phys, [...(outEdges.get(phys) ?? []).filter((e) => e.to !== n.id), ...spent]);
  }
  // The physical `blueprint` item is modelled by the graph as one node per recipe (`blueprint:<id>`).
  const blueprintIn = graph.edges.filter((e) => e.to.startsWith('blueprint:'));
  const blueprintOut = graph.edges.filter((e) => e.from.startsWith('blueprint:'));

  const recipes: OntologyRecipe[] = Object.entries(table).map(([id, r]) => {
    const bom = recipeRaw(table, canon, id);
    return {
      id, out: r.out, outs: outsOf(r), ins: r.ins.map(([k, q]) => [k, q] as [string, number]),
      station: r.station ?? 'hand', stationLevel: requiredStationLevel(r), station_tier: stationTierOf(r),
      research_tier: r.tier, base: !!r.base, starter_known: starter.has(id) || always.has(id),
      family: familyOfRecipe(id), alias: r.alias ?? null, secs: r.secs,
      layer: rLayer.get(id) ?? 'STUB', craftable_shipping: !shipBlocked.has(id), craftable_veyra: !veyBlocked.has(id),
      depth: 1 + (r.ins.length ? Math.max(...r.ins.map(([k]) => depth.get(k) ?? 0)) : 0),
      bom: { distinct_items: bom.distinct_items, craft_steps: bom.craft_steps, raw: bom.raw },
    };
  });
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  const recyclePlan = (key: string) => {
    const d = ITEMS[key];
    const plan = recoveryPlan({ uid: 'ontology-probe', key, qty: 1, ...(d.dur ? { dur: d.dur } : {}) } as Stack);
    return plan ? { rule: plan.recipe as string, outputs: plan.outputs.map(([k, q]) => [k, q] as [string, number]) } : null;
  };

  const items: OntologyItem[] = Object.entries(ITEMS).map(([id, d]) => {
    const node = `item:${id}`;
    const ins = id === 'blueprint' ? blueprintIn : inEdges.get(node) ?? [];
    const outs = id === 'blueprint' ? blueprintOut : outEdges.get(node) ?? [];
    const acq = ins.filter((e) => ACQUISITION_KINDS.includes(e.kind));
    const sources = foldSources(acq);
    const refunds = foldSources(ins.filter((e) => REFUND_KINDS.includes(e.kind)));
    const maintained = foldSources(ins.filter((e) => MAINTENANCE_IN_KINDS.includes(e.kind)));
    const consumers = foldConsumers(outs.filter((e) => !DERIVED_SINK_KINDS.includes(e.kind)));
    const derived = foldConsumers(outs.filter((e) => DERIVED_SINK_KINDS.includes(e.kind) && e.kind !== 'RUN_WIPE_SINK'));
    const produced = recipes.filter((r) => r.outs.some(([o]) => o === id)).map((r) => r.id);
    const consumed = recipes.filter((r) => r.ins.some(([k]) => k === id)).map((r) => r.id);
    const liveProduced = produced.filter(live);
    const targets = [...new Set(outs.filter((e) => COST_KINDS.includes(e.kind) && isLive(layerOf(e.runtimeStatus)) && !e.to.startsWith('sink:')).map((e) => consumerTarget(e.to)))].sort();
    const maint = [...new Set(outs.filter((e) => MAINTENANCE_OUT_KINDS.includes(e.kind) && isLive(layerOf(e.runtimeStatus))).map((e) => `${e.kind}:${e.to}`))].sort();
    const kindsOn = (pred: (l: Layer) => boolean) => [...new Set(acq.filter((e) => pred(layerOf(e.runtimeStatus))).map((e) => e.kind))].sort();
    const nonCraftLive = acq.filter((e) => e.kind !== 'CRAFT_OUTPUT' && isLive(layerOf(e.runtimeStatus)));
    const inShip = shipReach.has(id), inVey = veyReach.has(id);
    const onlyFixture = acq.length > 0 && acq.every((e) => layerOf(e.runtimeStatus) === 'FIXTURE');
    const reach: Reachability = inShip && inVey ? 'SHIPPING_AND_VEYRA' : inShip ? 'SHIPPING_ONLY' : inVey ? 'VEYRA_ONLY' : onlyFixture ? 'FIXTURE_ONLY' : 'UNREACHABLE';
    const bestKnow = liveProduced.some((r) => recipeById.get(r)!.starter_known) ? 'STARTER' : liveProduced.length ? 'RESEARCH_OR_BLUEPRINT' : 'NOT_CRAFTED';
    const tiers = liveProduced.map((r) => stationTierOf(table[r])).sort((a, b) => STATION_ORDER.indexOf(a) - STATION_ORDER.indexOf(b));
    const use = directUse(id, outs);
    const fn = use.filter((u) => u !== 'specimen_study');
    const recycle = recyclePlan(id);

    const signals: string[] = [];
    if (reach === 'SHIPPING_ONLY') signals.push('NOT_REACHABLE_ON_VEYRA');
    if (reach === 'VEYRA_ONLY') signals.push('NOT_REACHABLE_ON_SHIPPING');
    if (reach === 'FIXTURE_ONLY') signals.push('TEST_FIXTURE_SOURCE_ONLY');
    if (reach === 'UNREACHABLE') signals.push('UNREACHABLE_EVERYWHERE');
    if (liveProduced.length > 0 && fn.length === 0 && targets.length <= 1 && maint.length === 0 && !recycle) signals.push('PASS_THROUGH_INTERMEDIATE');
    if (liveProduced.length > 0 && fn.length === 0 && targets.length === 1 && maint.length === 0 && recycle) signals.push('SINGLE_CONSUMER_COMPONENT');
    if (targets.length === 0 && use.length === 0 && maint.length === 0) signals.push('NO_CONSUMER_NO_USE');
    if (consumed.length > 0 && consumed.every((r) => veyBlocked.has(r))) signals.push('ALL_RECIPE_CONSUMERS_BLOCKED_ON_VEYRA');
    if (consumed.some((r) => veyBlocked.has(r)) && reach === 'SHIPPING_ONLY') signals.push('BLOCKS_VEYRA_RECIPES');

    return {
      id, name: d.name, cat: d.cat, item_class: itemClass(id), desc: d.desc, weight: d.w, stack_max: d.max,
      generated_deployable: deployable.has(id),
      craft_depth: Number.isFinite(depth.get(id) ?? 0) ? depth.get(id) ?? 0 : 0,
      craft_depth_recipe: via.get(id) ?? null,
      station_tier: tiers[0] ?? null,
      research_tier: liveProduced.length ? Math.min(...liveProduced.map((r) => table[r].tier)) : null,
      knowledge: bestKnow,
      rarity: null,
      acquisition_types: {
        shipping: kindsOn(onShipping), veyra: kindsOn(onVeyra),
        fixture: [...new Set(acq.filter((e) => !isLive(layerOf(e.runtimeStatus))).map((e) => e.kind))].sort(),
      },
      runtime_reachability: reach,
      non_craft_sources_all_gated: nonCraftLive.length > 0 && nonCraftLive.every((e) => e.gateIds.some((g) => g.startsWith('gate:poi_'))),
      sources, refunds, maintained_by: maintained, consumers, derived_sinks: derived,
      produced_by: produced, consumed_by: consumed, consumer_targets: targets, maintenance_targets: maint, direct_use: use,
      recycle,
      recycled_from: [...new Set(acq.filter((e) => e.kind === 'RECYCLE_OUTPUT').map((e) => e.from))].sort(),
      alt_routes: { live_recipes: liveProduced.length, non_craft_source_kinds: new Set(nonCraftLive.map((e) => e.kind)).size },
      raw_per_unit: sortRec(rawVector(table, canon, id, 1)),
      signals,
    };
  });

  // ---- recipe-level duplication: two live formulas for the same output where one costs more of everything ----
  const dominated: DominatedAlternative[] = [];
  const byOut = new Map<string, OntologyRecipe[]>();
  for (const r of recipes) if (isLive(r.layer)) byOut.set(r.out, [...(byOut.get(r.out) ?? []), r]);
  for (const [out, list] of byOut) {
    for (const a of list) for (const b of list) {
      if (a.id === b.id || !dominates(a.bom.raw, b.bom.raw)) continue;
      const sameKinds = Object.keys(a.bom.raw).join() === Object.keys(b.bom.raw).join();
      const bypass = b.starter_known && !a.starter_known;
      const verdict = a.station_tier !== b.station_tier ? 'STATION_TRADEOFF'
        : bypass ? 'KNOWLEDGE_BYPASS' : sameKinds ? 'BATCH_SIZE_ONLY' : 'STRICTLY_DOMINATED';
      dominated.push({
        out, cheaper: a.id, dearer: b.id, cheaper_raw: a.bom.raw, dearer_raw: b.bom.raw, verdict,
        note: verdict === 'STATION_TRADEOFF'
          ? `${a.id} is cheaper per unit but needs ${a.station_tier}; ${b.id} runs at ${b.station_tier}. The station is the price.`
          : verdict === 'KNOWLEDGE_BYPASS'
          ? `${b.id} is known from the start; ${a.id} must be learned. Paying more materials buys skipping research.`
          : verdict === 'BATCH_SIZE_ONLY'
            ? `Same inputs and station; ${a.id} is only a larger batch.`
            : `${b.id} needs at least as much of every raw input as ${a.id} and both are ${a.starter_known === b.starter_known ? 'equally known' : 'differently known'}: no reason to ever pick ${b.id}.`,
      });
    }
  }
  dominated.sort((x, y) => (x.out + x.dearer).localeCompare(y.out + y.dearer));

  // ---- item-level duplication: two no-direct-use intermediates made at the same station tier from the same raw inputs ----
  const twins: ItemOntologyProjection['twin_intermediates'] = [];
  const inter = items.filter((i) => i.alt_routes.live_recipes > 0 && i.direct_use.every((u) => u === 'specimen_study') && canon.has(i.id));
  for (let a = 0; a < inter.length; a++) for (let b = a + 1; b < inter.length; b++) {
    const A = inter[a], B = inter[b];
    const ka = Object.keys(A.raw_per_unit).join(), kb = Object.keys(B.raw_per_unit).join();
    const ta = stationTierOf(table[canon.get(A.id)!]), tb = stationTierOf(table[canon.get(B.id)!]);
    if (ka === kb && ta === tb) twins.push({ a: A.id, b: B.id, raw_inputs: Object.keys(A.raw_per_unit), station_tier: ta });
  }
  for (const t of twins) for (const id of [t.a, t.b]) items.find((i) => i.id === id)!.signals.push(`TWIN_INTERMEDIATE:${id === t.a ? t.b : t.a}`);
  for (const d of dominated) if (d.verdict === 'STRICTLY_DOMINATED') {
    for (const [k] of table[d.dearer].ins) {
      const it = items.find((i) => i.id === k)!;
      if (!table[d.cheaper].ins.some(([c]) => c === k) && !it.signals.includes(`ONLY_USED_BY_DOMINATED_RECIPE:${d.dearer}`) && it.consumer_targets.length <= 1) {
        it.signals.push(`ONLY_USED_BY_DOMINATED_RECIPE:${d.dearer}`);
      }
    }
  }

  // ---- recycle loops, read against a hypothetical single Parts resource (mechanical_parts + spares) ----
  const partsIn = (item: string): number => {
    const made = items.find((i) => i.id === item)!.produced_by.filter(live);
    if (!made.length) return 0;
    return Math.min(...made.map((rid) => {
      const raw = recipeRaw(table, canon, rid, PARTS_KEYS).raw;
      return (raw.mechanical_parts ?? 0) + (raw.spares ?? 0);
    }));
  };
  const loops: RecycleLoopRow[] = items.filter((i) => i.recycle).map((i) => {
    const pin = round(partsIn(i.id));
    const pout = i.recycle!.outputs.filter(([k]) => PARTS_KEYS.has(k)).reduce((s, [, q]) => s + q, 0);
    const craftable = i.alt_routes.live_recipes > 0;
    return {
      item: i.id, rule: i.recycle!.rule, outputs: i.recycle!.outputs, parts_in: pin, parts_out: pout,
      merged_parts_verdict: !craftable ? 'SOURCE_ONLY' : pout > pin ? 'PARTS_POSITIVE' : pout === pin && pout > 0 ? 'PARTS_NEUTRAL' : 'PARTS_NEGATIVE',
    };
  });

  const tally = <T,>(xs: T[], f: (x: T) => string) => {
    const m: Record<string, number> = {};
    for (const x of xs) m[f(x)] = (m[f(x)] ?? 0) + 1;
    return Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
  };

  return {
    schema: ITEM_ONTOLOGY_SCHEMA,
    counts: {
      items: items.length,
      items_static: items.filter((i) => !i.generated_deployable).length,
      items_generated_deployable: items.filter((i) => i.generated_deployable).length,
      recipes: recipes.length,
      recipes_deploy: recipes.filter((r) => r.id.startsWith('deploy_')).length,
      recipe_revision: RECIPE_REVISION,
      retired_recipes: [...RETIRED_RECIPES],
      graph_nodes: graph.nodes.length,
      graph_edges: graph.edges.length,
      by_reachability: tally(items, (i) => i.runtime_reachability) as Record<Reachability, number>,
      by_craft_depth: tally(items, (i) => `L${i.craft_depth}`),
      by_class: tally(items, (i) => i.item_class ?? 'UNCLASSIFIED'),
      by_cat: tally(items, (i) => i.cat),
    },
    items, recipes, dominated_alternatives: dominated, twin_intermediates: twins, recycle_loops: loops,
    research: {
      random_spares: BAL.research.randomSparesCost,
      directed_spares: BAL.research.directedSparesCost,
      directed_max_tier_exclusive: 3,
    },
    veyra_blocked_recipes: [...veyBlocked].sort(),
    shipping_blocked_recipes: [...shipBlocked].sort(),
  };
}
