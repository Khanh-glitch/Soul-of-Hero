// MEC-01 P1: recycler economic proof. Pure functions over the live recipe registry and the pinned recovery plans.
// Numeraire (authored, not invented): 1 iron_ingot = 1 iron_ore (furnace iron_ingot) = 3 scrap (furnace scrap_ingot).
// Atoms without an authored conversion (coal, wood, leather, stone, crystal, spares) are compared per material and never
// converted. damaged_drive is salvage-only (non-repeatable): any route through it is excluded from craft cost.
import { RECIPES, ITEMS } from './catalog';
import { recoveryPlanFor, COMPONENT_RECIPES, type RecoveryPlan } from './recycler';
import BAL from './balance.v1.json';

export type Vec = Record<string, number>;
const add = (a: Vec, b: Vec, m = 1) => { for (const [k, q] of Object.entries(b)) a[k] = (a[k] ?? 0) + q * m; return a; };
export const SALVAGE_ONLY = new Set(['damaged_drive']);
/** Atoms: expansion stops here. iron_ingot/iron_ore/scrap are the numeraire; the rest are compared per material. */
// R8C: rich_iron_ore is an authored atom valued at 3 ingot-equivalents: the furnace recipe refined_iron_rich (1 rich + 1 coal -> 2 refined)
// replaces refined_iron_ingot (3 iron_ingot + 1 coal -> 2 refined), so one rich ore stands for three iron ore units.
const ATOMS = new Set(['iron_ingot', 'iron_ore', 'rich_iron_ore', 'scrap', 'coal', 'wood', 'stone', 'leather', 'spares', 'crystal', 'damaged_drive']);
const INGOT_PER: Record<string, number> = { iron_ingot: 1, iron_ore: 1, rich_iron_ore: 3, scrap: 1 / 3 };

export type Route = { recipe: string; out: string; qty: number; secs: number; ins: [string, number][]; alias?: string };
export function routesFor(item: string): Route[] {
  return Object.entries(RECIPES).filter(([, r]) => r.out === item).map(([id, r]) => ({ recipe: id, out: r.out, qty: r.qty, secs: r.secs, ins: r.ins as [string, number][], alias: (r as any).alias }))
    // Mechanical parts' recover_drive route: a salvage input, so it is listed but excluded from craft cost below.
    ;
}
/** Expand one unit-quantity of `item` to atoms along the cheapest non-salvage route. Returns null if no acyclic route. */
export function expand(item: string, qty = 1, depth = 0, seen = new Set<string>()): { vec: Vec; route?: string; secs: number; salvageDependent: boolean } | null {
  if (ATOMS.has(item)) return { vec: { [item]: qty }, secs: 0, salvageDependent: SALVAGE_ONLY.has(item) };
  if (depth > 12 || seen.has(item)) return null;
  const nextSeen = new Set(seen).add(item);
  let best: { vec: Vec; route: string; secs: number } | null = null; let bestIe = Infinity; let anyRoute = false;
  for (const rt of routesFor(item)) {
    if (rt.ins.some(([k]) => SALVAGE_ONLY.has(k))) continue;   // salvage-dependent route: not a repeatable craft route
    anyRoute = true;
    const v: Vec = {}; let ok = true; let secs = rt.secs * (qty / rt.qty);
    for (const [i, q] of rt.ins) { const e = expand(i, (q * qty) / rt.qty, depth + 1, nextSeen); if (!e) { ok = false; break; } add(v, e.vec); secs += e.secs; }
    if (!ok) continue;
    const ie = ieValue(v);
    if (ie < bestIe) { bestIe = ie; best = { vec: v, route: rt.recipe, secs }; }
  }
  if (!best) return anyRoute ? null : { vec: { [item]: qty }, secs: 0, salvageDependent: false }; // raw material with no craft route
  return { vec: best.vec, route: best.route, secs: best.secs, salvageDependent: false };
}
/** MEC-01 R2 D: stock class of an input source. Only a renewable source may underwrite a REPEATABLE craft route;
 *  a finite source (vault) is a non-repeatable windfall, never a loop input. World-node sources carry units of
 *  stock but their respawn clock is not modelled in Web — tagged 'world-node' with an unknown clock, not assumed infinite. */
export type StockClass = 'renewable' | 'finite' | 'world-node' | 'unknown';
export function stockClassOf(stock: string | undefined | null): StockClass {
  return stock === 'renewable' ? 'renewable' : stock === 'finite' ? 'finite' : 'unknown';
}
/** Eligibility rule, exported so the benchmark and its tests assert one shared rule (no per-file reinterpretation). */
export const B05_REPEATABLE_RULE = 'a source may underwrite a REPEATABLE craft route only when its stock class is renewable; a finite source (vault) is a non-repeatable windfall, never a loop input; world-node sources are renewable in count but their respawn clock is ORIGINAL_UNKNOWN in Web';
/** Integer batch accounting for a single craft route at an ask of `qty` units: whole crafts only, exact authored
 *  inputs consumed for the whole batch, surplus output reported. Alternative to the amortized per-unit model. */
export function integerBatch(route: Route, qty = 1): { rule: string; crafts: number; outputs: number; consumed: Vec; seconds: number; surplusOutputs: number } {
  const crafts = Math.max(1, Math.ceil(qty / route.qty));
  const outputs = crafts * route.qty;
  const consumed: Vec = {};
  for (const [i, q] of route.ins) consumed[i] = (consumed[i] ?? 0) + q * crafts;
  return { rule: 'integer craft batches (whole crafts only; overshoot is surplus output, never fractional crafts)', crafts, outputs, consumed, seconds: route.secs * crafts, surplusOutputs: outputs - qty };
}
/** Integer-batch recursive tree for `item` at ask `qty`: cheapest acyclic non-salvage route at every node, whole crafts only.
 *  Unlike expand() (amortized per-unit), atom totals are exact craft-batch multiples. Salvage routes are never eligible. */
export function integerTree(item: string, qty = 1, depth = 0, seen = new Set<string>()): { vec: Vec; secs: number; crafts: Record<string, number> } | null {
  if (ATOMS.has(item)) return { vec: { [item]: qty }, secs: 0, crafts: {} };
  if (depth > 12 || seen.has(item)) return null;
  const nextSeen = new Set(seen).add(item);
  let best: { vec: Vec; secs: number; crafts: Record<string, number>; ie: number } | null = null;
  let anyRoute = false;
  for (const rt of routesFor(item)) {
    if (rt.ins.some(([k]) => SALVAGE_ONLY.has(k))) continue;   // salvage-dependent route: not a repeatable craft route
    anyRoute = true;
    const crafts = Math.max(1, Math.ceil(qty / rt.qty));
    const v: Vec = {}; const craftAgg: Record<string, number> = { [rt.recipe]: crafts };
    let secs = rt.secs * crafts, ok = true;
    for (const [i, q] of rt.ins) {
      const e = integerTree(i, q * crafts, depth + 1, nextSeen);
      if (!e) { ok = false; break; }
      for (const [k, n] of Object.entries(e.vec)) v[k] = (v[k] ?? 0) + n;
      secs += e.secs;
      for (const [k, n] of Object.entries(e.crafts)) craftAgg[k] = (craftAgg[k] ?? 0) + n;
    }
    if (!ok) continue;
    const ie = ieValue(v);
    if (!best || ie < best.ie) best = { vec: v, secs, crafts: craftAgg, ie };
  }
  if (!best) return anyRoute ? null : { vec: { [item]: qty }, secs: 0, crafts: {} };   // matches expand(): unpriced leaf, or null when priced routes exist but failed
  return { vec: best.vec, secs: best.secs, crafts: best.crafts };
}
/** Iron-ingot-equivalent of an atom vector (only numeraire atoms). */
export function ieValue(v: Vec): number { return Object.entries(v).reduce((n, [k, q]) => n + (INGOT_PER[k] ?? 0) * q, 0); }

/** Recovery vector of one recycle at a given condition tier, through the pinned recovery plan of that version. */
export function recoveryAtTier(item: string, recipe: string, tier: 'base' | 'mid' | 'high' | 'single'): { plan: RecoveryPlan | null; vec: Vec | null; repeatable: boolean } {
  // Component recipes (gear/pipe/blade) carry no durability: one unconditioned stack, tier 'single'.
  const component = COMPONENT_RECIPES.includes(recipe);
  if (component !== (tier === 'single')) return { plan: null, vec: null, repeatable: false };
  const max = ITEMS[item]?.dur ?? 1;
  const cond = tier === 'base' || tier === 'single' ? 0 : tier === 'mid' ? BAL.recyclerV1.midCondition : BAL.recyclerV1.highCondition;
  const s: any = component ? { uid: 'proof', key: item, qty: 1 } : { uid: 'proof', key: item, qty: 1, dur: Math.round(max * Math.max(cond, tier === 'high' ? 1 : cond)) };
  const plan = recoveryPlanFor(s, recipe);
  if (!plan) return { plan: null, vec: null, repeatable: false };
  const vec: Vec = {};
  for (const [k, q] of plan.outputs) { const e = expand(k, q); if (!e) return { plan, vec: null, repeatable: false }; add(vec, e.vec); }
  return { plan, vec, repeatable: true };
}

/** Verdicts: NO_RECOVERY_ROUTE = the item has no applicable recovery route for this recipe (not a numeric claim);
 *  UNPROVEN = a route exists but its craft or output cannot be expanded to priced atoms (unknown evidence, never zero);
 *  OVER_RETURN / OK = both priced. Scope: a DIRECT_CRAFT_RECYCLE comparison at atom level, NOT a global anti-arbitrage proof. */
export type Verdict = 'OK' | 'OVER_RETURN' | 'UNPROVEN' | 'NO_RECOVERY_ROUTE';
export function proveItem(item: string, recipe: string) {
  const craft = expand(item, 1);
  const tiers = COMPONENT_RECIPES.includes(recipe) ? (['single'] as const) : (['base', 'mid', 'high'] as const);
  const rows: any[] = [];
  for (const tier of tiers) {
    const rec = recoveryAtTier(item, recipe, tier);
    if (!rec.plan) { rows.push({ tier, verdict: 'NO_RECOVERY_ROUTE' as Verdict }); continue; }
    if (!rec.vec || !craft) { rows.push({ tier, cumulativeOutputs: rec.plan.outputs, verdict: 'UNPROVEN' as Verdict, reason: !craft ? 'no acyclic craft route priced to atoms' : 'an output has no priced route' }); continue; }
    const ieRec = ieValue(rec.vec), ieCraft = ieValue(craft.vec);
    const mintedOther = Object.keys(rec.vec).filter(k => !INGOT_PER[k] && !SALVAGE_ONLY.has(k) && (rec.vec![k] > (craft.vec[k] ?? 0) + 1e-9)).map(k => `${k}:+${Math.round((rec.vec![k] - (craft.vec[k] ?? 0)) * 100) / 100}`);
    const over = ieRec > ieCraft + 1e-9 || mintedOther.length > 0;
    rows.push({ tier, cumulativeOutputs: rec.plan.outputs, ieRecovered: round(ieRec), ieCraft: round(ieCraft), mintedNonNumeraire: mintedOther, verdict: (over ? 'OVER_RETURN' : 'OK') as Verdict, claim: 'DIRECT_CRAFT_RECYCLE_LOSS_OR_GAIN (atom-level, one cycle; not a global anti-arbitrage proof)' });
  }
  return { item, recipe, craftRoute: craft?.route, craftSeconds: craft ? routesFor(item).find(r => r.recipe === craft.route)?.secs : undefined, craftVec: craft?.vec, rows };
}
const round = (n: number) => Math.round(n * 1000) / 1000;
