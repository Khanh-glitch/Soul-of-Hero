import { BAL, type Container, type Stack } from './core';
import { ITEMS } from './catalog';

type Output = [string, number];
/** B01: X:recover-v1 jobs keep the v1 table forever; X:recover-v2 jobs use recyclerV2 (new physical outputs). */
export type RecoveryRecipe = 'X:drive'|'X:recover-v1'|'X:recover-v2'|'X:recover-v3'|'X:pipe-v1'|'X:pipe-v2'|'X:gear-v1'|'X:blade-v1';
/**
 * MEC-01 R2 (A2): IMMUTABLE component rule snapshots. Each versioned key pins its own seconds and outputs in code,
 * so a saved job never re-reads a live balance table. recyclerV4 in balance.v1.json is a documentation mirror
 * that a test keeps equal to these constants. To change a return, add a NEW key; never edit an existing one.
 * LI per-item yields for these parts: ORIGINAL_UNKNOWN. Every value below is SOH_PROVISIONAL.
 */
const COMPONENT_RULES = {
  // X:pipe-v1 (B04-P4): one pipe -> one refined ingot. Kept forever for stored jobs.
  'X:pipe-v1': { key: 'metal_pipe', seconds: 10, outputs: [['refined_iron_ingot', 1]] as Output[] },
  // X:pipe-v2 (A2, new jobs): pipe -> 1 refined + 1 Mechanical Parts. Craft = 2 refined + 1 MP (>= 3.83 ingot-eq); return >= 2.33 ingot-eq.
  'X:pipe-v2': { key: 'metal_pipe', seconds: 12, outputs: [['refined_iron_ingot', 1], ['mechanical_parts', 1]] as Output[] },
  // X:gear-v1 (A1): gear -> 2 MP + 1 ingot. Craft = 2 ingot + 2 MP + 1 fastener (~4.11 ingot-eq); return ~2.67 ingot-eq.
  'X:gear-v1': { key: 'mechanical_gear', seconds: 15, outputs: [['mechanical_parts', 2], ['iron_ingot', 1]] as Output[] },
  // X:blade-v1 (A2): blade -> 2 ingot + 1 MP. Craft = 4 ingot + 1 MP (~4.83 ingot-eq); return ~2.83 ingot-eq.
  'X:blade-v1': { key: 'metal_blade', seconds: 14, outputs: [['iron_ingot', 2], ['mechanical_parts', 1]] as Output[] },
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
function planFromTable(s:Stack, table:RuleTable, recipe:'X:recover-v1'|'X:recover-v2'|'X:recover-v3', seconds:number):RecoveryPlan|null {
  if(!Object.prototype.hasOwnProperty.call(table,s.key))return null;
  const max=ITEMS[s.key]?.dur;
  if(!max||!Number.isFinite(s.dur)||s.dur!<0||s.dur!>max)return null;
  const condition=s.dur!/max,rule=table[s.key];
  return {recipe,total:seconds*1000,condition,outputs:[...rule.base,...(condition>=BAL.recyclerV1.midCondition?rule.mid:[]),...(condition>=BAL.recyclerV1.highCondition?rule.high:[])].map(([k,q])=>[k,q])};
}
/** Plan a NEW job. v2 supersedes v1 for keys it lists; every other v1 key stays on v1. */
export function recoveryPlan(s:Stack):RecoveryPlan|null {
  if(!s||typeof s!=="object"||s.qty!==1)return null;
  if(s.key==='damaged_drive')return {recipe:'X:drive',total:12000,outputs:[['spares',2]],condition:null};
  if(s.key==='metal_pipe')return componentPlan('X:pipe-v2',s);
  if(s.key==='mechanical_gear')return componentPlan('X:gear-v1',s);
  if(s.key==='metal_blade')return componentPlan('X:blade-v1',s);
  // MEC-01 P1: v3 supersedes v2 for the four keys it lists (v2 over-returned); new jobs only.
  const v3=BAL.recyclerV3.rules as RuleTable;
  if(Object.prototype.hasOwnProperty.call(v3,s.key))return planFromTable(s,v3,'X:recover-v3',BAL.recyclerV3.seconds);
  const v2=BAL.recyclerV2.rules as RuleTable;
  if(Object.prototype.hasOwnProperty.call(v2,s.key))return planFromTable(s,v2,'X:recover-v2',BAL.recyclerV2.seconds);
  return planFromTable(s,BAL.recyclerV1.rules as RuleTable,'X:recover-v1',BAL.recyclerV1.seconds);
}
/** Plan for an EXISTING job, keyed by its stored recipe version. Never falls back to the other table. */
export function recoveryPlanFor(s:Stack, recipe:string):RecoveryPlan|null {
  if(!s||typeof s!=="object"||s.qty!==1)return null;
  if(recipe==='X:drive')return s.key==='damaged_drive'?{recipe:'X:drive',total:12000,outputs:[['spares',2]],condition:null}:null;
  if(recipe==='X:recover-v1')return planFromTable(s,BAL.recyclerV1.rules as RuleTable,'X:recover-v1',BAL.recyclerV1.seconds);
  if(recipe==='X:recover-v2')return planFromTable(s,BAL.recyclerV2.rules as RuleTable,'X:recover-v2',BAL.recyclerV2.seconds);
  if(recipe==='X:recover-v3')return planFromTable(s,BAL.recyclerV3.rules as RuleTable,'X:recover-v3',BAL.recyclerV3.seconds);
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
