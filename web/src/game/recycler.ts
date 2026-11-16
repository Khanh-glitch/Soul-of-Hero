import { BAL, type Container, type Stack } from './core';
import { ITEMS, RECIPES } from './catalog';
import { ITEM_RETIREMENT } from './final-item-set';
/** live successor id → the LIVE-retired id whose recycler rule it inherits. */
const PREDECESSOR:Record<string,string>=Object.fromEntries(Object.entries(ITEM_RETIREMENT).filter(([,r])=>r.stage==='LIVE'&&r.to).map(([k,r])=>[r.to as string,k]));

type Output = [string, number];
/** B01: X:recover-v1 jobs keep the v1 table forever; X:recover-v2 jobs use recyclerV2 (new physical outputs). */
export type RecoveryRecipe = 'X:drive'|'X:recover-v1'|'X:recover-v2'|'X:recover-v3'|'X:recover-v4'|'X:gear-v2'|'X:blade-v2'|'X:pipe-v1'|'X:pipe-v2'|'X:pipe-v3'|'X:gear-v1'|'X:blade-v1'|'X:plate-v1';
/**
 * MEC-01 R2 (A2): IMMUTABLE component rule snapshots. Each versioned key pins its own seconds and outputs in code,
 * so a saved job never re-reads a live balance table. recyclerV4 in balance.v1.json is a documentation mirror
 * that a test keeps equal to these constants. To change a return, add a NEW key; never edit an existing one.
 * LI per-item yields for these parts: ORIGINAL_UNKNOWN. Every value below is SOH_PROVISIONAL.
 */
const COMPONENT_RULES = {
  // X:pipe-v1 (B04-P4): one pipe -> one refined ingot. Kept forever for stored jobs.
  'X:pipe-v1': { key: 'metal_pipe', seconds: 10, outputs: [['refined_iron_ingot', 1]] as Output[] },
  // X:pipe-v2 (A2, new jobs): pipe -> 1 refined + 1 Machine Parts. Craft = 2 refined + 1 MP (>= 3.83 ingot-eq); return >= 2.33 ingot-eq.
  'X:pipe-v2': { key: 'metal_pipe', seconds: 12, outputs: [['refined_iron_ingot', 1], ['mechanical_parts', 1]] as Output[] },
  // X:pipe-v3 (PA1 R1): the recovered paper return — one pipe back into exactly one
  // Refined Iron Ingot. Mandatory companion to the pipe recipe cut to 2 per craft: at
  // X:pipe-v2 the pair of pipes returned 2 refined + 2 parts against a 2 refined + 1 parts
  // craft, i.e. a repeatable +1 Machine Parts mint (bible.md K4 forbids craft->recycle->craft
  // producing net-positive material). v1/v2 stay frozen for jobs already stored.
  'X:pipe-v3': { key: 'metal_pipe', seconds: 10, outputs: [['refined_iron_ingot', 1]] as Output[] },
  // X:gear-v1 (historical gear experiment): gear -> 2 MP + 1 ingot. Craft = 2 ingot + 2 MP + 1 fastener (~4.11 ingot-eq); return ~2.67 ingot-eq.
  'X:gear-v1': { key: 'mechanical_gear', seconds: 15, outputs: [['mechanical_parts', 2], ['iron_ingot', 1]] as Output[] },
  // X:blade-v1 (A2): blade -> 2 ingot + 1 MP. Craft = 4 ingot + 1 MP (~4.83 ingot-eq); return ~2.83 ingot-eq.
  'X:blade-v1': { key: 'metal_blade', seconds: 14, outputs: [['iron_ingot', 2], ['mechanical_parts', 1]] as Output[] },
  // X:plate-v1 (Item Ontology V2 P5, Control Tower ruling): plate -> 1 Iron Ingot, nothing else.
  // Craft = 2 refined + 1 fastener -> 2 plates, i.e. 1 refined (1.5 ingot + 0.5 coal) + 0.5 fastener per plate.
  // The return is one PLAIN ingot: less iron than went in, no refined ingot, no Fastener, no Machine Parts,
  // no Parts — so craft -> recycle -> craft loses iron every turn and can mint nothing (bible.md K4).
  'X:plate-v1': { key: 'iron_plate', seconds: 10, outputs: [['iron_ingot', 1]] as Output[] },
  // Item set v2 round 2 (Machine Parts retired). New jobs only; v1 rows stay for stored jobs and pay out through the
  // mint point, which turns their Machine Parts into Parts.
  // X:gear-v2: gear -> 2 Parts + 1 ingot. Craft (rev 5) = 2 ingot + 3 Parts, so a turn loses 1 ingot and 1 Part.
  'X:gear-v2': { key: 'mechanical_gear', seconds: 15, outputs: [['spares', 2], ['iron_ingot', 1]] as Output[] },
  // X:blade-v2: blade -> 2 ingot. Craft (rev 5) = 4 ingot + 1 Part: half the iron back, never the Part.
  // Recipe revision 6 cut the craft to 3 ingot + 1 Part; the return is unchanged, so a turn still loses 1 ingot and 1 Part.
  'X:blade-v2': { key: 'metal_blade', seconds: 14, outputs: [['iron_ingot', 2]] as Output[] },
} as const;
export const COMPONENT_RECIPES: readonly string[] = Object.keys(COMPONENT_RULES);
/** Pinned-rule view for tests and the balance mirror. */
export function componentRuleSnapshot(): Record<string, { key: string; seconds: number; outputs: Output[] }> {
  return Object.fromEntries(Object.entries(COMPONENT_RULES).map(([k, v]) => [k, { key: v.key, seconds: v.seconds, outputs: v.outputs.map(([i, q]) => [i, q] as Output) }]));
}
function componentPlan(recipe: keyof typeof COMPONENT_RULES, s: Stack): RecoveryPlan|null {
  const rule = COMPONENT_RULES[recipe];
  if (!s || s.key !== rule.key || s.qty !== 1 || s.dur !== undefined || s.meta !== undefined || s.charge !== undefined) return null;
  return { recipe, total: rule.seconds * 1000, outputs: rule.outputs.map(([k, q]) => [k, q] as Output), condition: null };
}
export type RecoveryPlan = { recipe:RecoveryRecipe; total:number; outputs:Output[]; condition:number|null };
type RuleTable = Record<string,{base:Output[];mid:Output[];high:Output[]}>;
/** Item set v3 — X:recover-v4, NEW jobs only. The frozen v1/v2/v3 tables name Scrap Metal and Machine Parts, both
 *  retired, so they cannot price a new job. v4 is authored in live ids and keeps the old invariant: a tool made from
 *  renewable iron never pays out Parts (Parts are finite salvage), and never returns as much iron as it took.
 *  Scrap Metal (a third of an ingot) has no live equivalent: the wreck-bottom tier pays the handle wood instead, or
 *  one ingot for tools that hold six or more. SOH_PROVISIONAL / SOH_TRIAL_UNVERIFIED.
 *  The tables above are never edited; a stored v1/v2/v3 job still resolves through them and its retired outputs are
 *  converted where they are minted. */
const RULES_V4: RuleTable = Object.freeze({
  iron_pick: { base: [['wood', 1]], mid: [['iron_ingot', 1]], high: [['iron_ingot', 1]] },
  iron_axe: { base: [['wood', 1]], mid: [['iron_ingot', 1]], high: [['iron_ingot', 1]] },
  machete: { base: [['iron_ingot', 1]], mid: [['iron_ingot', 1]], high: [['iron_ingot', 1]] },
  industrial_pick: { base: [['iron_ingot', 1]], mid: [['iron_ingot', 1]], high: [['iron_ingot', 1]] },
  industrial_axe: { base: [['iron_ingot', 1]], mid: [['iron_ingot', 1]], high: [['refined_iron_ingot', 1]] },
  reinforced_spear: { base: [['wood', 1]], mid: [['iron_ingot', 1]], high: [['iron_ingot', 1]] },
}) as RuleTable;
export function recyclerV4Rules(): RuleTable { return JSON.parse(JSON.stringify(RULES_V4)); }
export const RECYCLER_V4_SECONDS: number = BAL.recyclerV3.seconds;
export const isToolRecoveryRecipe = (id: string): boolean => id === 'X:recover-v1' || id === 'X:recover-v2' || id === 'X:recover-v3' || id === 'X:recover-v4';
function planFromTable(s:Stack, table:RuleTable, recipe:'X:recover-v1'|'X:recover-v2'|'X:recover-v3'|'X:recover-v4', seconds:number):RecoveryPlan|null {
  // Item set v2: a successor inherits the frozen rule of the id it replaced (the tables are never edited), minus any
  // output its own formula does not contain — so a Machete (ingots + blades) can never pay out the Iron Sword's leather.
  const own=Object.prototype.hasOwnProperty.call(table,s.key);
  const from=own?s.key:PREDECESSOR[s.key];
  if(!from||!Object.prototype.hasOwnProperty.call(table,from))return null;
  const max=ITEMS[s.key]?.dur;
  if(!max||!Number.isFinite(s.dur)||s.dur!<0||s.dur!>max)return null;
  const condition=s.dur!/max,rule=table[from];
  const made=own?null:new Set(['scrap','spares',...(RECIPES[s.key]?.ins.map(([k])=>k)??[])]);
  return {recipe,total:seconds*1000,condition,outputs:[...rule.base,...(condition>=BAL.recyclerV1.midCondition?rule.mid:[]),...(condition>=BAL.recyclerV1.highCondition?rule.high:[])].filter(([k])=>!made||made.has(k)).map(([k,q])=>[k,q])};
}
/** Plan a NEW job. v2 supersedes v1 for keys it lists; every other v1 key stays on v1. */
export function recoveryPlan(s:Stack):RecoveryPlan|null {
  if(!s||typeof s!=="object"||s.qty!==1)return null;
  if(s.key==='metal_pipe')return componentPlan('X:pipe-v3',s);
  if(s.key==='mechanical_gear')return componentPlan('X:gear-v2',s);
  if(s.key==='metal_blade')return componentPlan('X:blade-v2',s);
  if(s.key==='iron_plate')return componentPlan('X:plate-v1',s);
  return planFromTable(s,RULES_V4,'X:recover-v4',RECYCLER_V4_SECONDS);
}
/** Plan for an EXISTING job, keyed by its stored recipe version. Never falls back to the other table. */
export function recoveryPlanFor(s:Stack, recipe:string):RecoveryPlan|null {
  if(!s||typeof s!=="object"||s.qty!==1)return null;
  if(recipe==='X:drive')return s.key==='damaged_drive'?{recipe:'X:drive',total:12000,outputs:[['spares',2]],condition:null}:null;
  if(recipe==='X:recover-v1')return planFromTable(s,BAL.recyclerV1.rules as RuleTable,'X:recover-v1',BAL.recyclerV1.seconds);
  if(recipe==='X:recover-v2')return planFromTable(s,BAL.recyclerV2.rules as RuleTable,'X:recover-v2',BAL.recyclerV2.seconds);
  if(recipe==='X:recover-v3')return planFromTable(s,BAL.recyclerV3.rules as RuleTable,'X:recover-v3',BAL.recyclerV3.seconds);
  if(recipe==='X:recover-v4')return planFromTable(s,RULES_V4,'X:recover-v4',RECYCLER_V4_SECONDS);
  if(Object.prototype.hasOwnProperty.call(COMPONENT_RULES,recipe))return componentPlan(recipe as keyof typeof COMPONENT_RULES,s);
  return null;
}
/** Simulates all outputs together: a single empty slot cannot fit several kinds. */
export function recoveryFits(container:Container,outputs:Output[]):boolean {
  const slots=container.slots.map(s=>s?{...s}:null);
  for(const [key,amount] of outputs){const def=ITEMS[key];if(!def||!Number.isSafeInteger(amount)||amount<=0||def.dur||def.charge)return false;let left=amount;
    for(const s of slots)if(s&&s.key===key&&s.meta===undefined&&s.dur===undefined&&s.charge===undefined){const n=Math.min(left,def.max-s.qty);s.qty+=n;left-=n;}
    for(let i=0;i<slots.length&&left>0;i++)if(!slots[i]){const n=Math.min(left,def.max);slots[i]={uid:'preview',key,qty:n};left-=n;}
    if(left>0)return false;
  }return true;
}
