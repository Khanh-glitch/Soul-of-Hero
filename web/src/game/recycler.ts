import { BAL, type Container, type Stack } from './core';
import { ITEMS } from './catalog';

type Output = [string, number];
/** B01: X:recover-v1 jobs keep the v1 table forever; X:recover-v2 jobs use recyclerV2 (new physical outputs). */
export type RecoveryRecipe = 'X:drive'|'X:recover-v1'|'X:recover-v2'|'X:recover-v3'|'X:pipe-v1'|'X:gear-v1';
/** B04-P4 (SOH_PROVISIONAL): one carried Metal Pipe at the physical Foundry Recycler -> one Refined Iron Ingot. Net loss vs. the pipe's inputs (no loop). LI per-item yield: ORIGINAL_UNKNOWN. */
const PIPE_V1={seconds:10,outputs:[['refined_iron_ingot',1]] as Output[]};
function pipePlan(s:Stack):RecoveryPlan|null{
  if(s.key!=='metal_pipe'||s.qty!==1||s.dur!==undefined||s.meta!==undefined||s.charge!==undefined)return null;
  return {recipe:'X:pipe-v1',total:PIPE_V1.seconds*1000,outputs:PIPE_V1.outputs.map(([k,q])=>[k,q]),condition:null};
}
/** MEC-01 R2 (A1): one carried Mechanical Gear (no durability) -> recyclerV4 outputs. Net loss vs. its craft; recipe key X:gear-v1 is kept forever. */
function gearPlan(s:Stack):RecoveryPlan|null{
  const c=(BAL.recyclerV4.components as Record<string,{outputs:Output[]}>);
  if(!Object.prototype.hasOwnProperty.call(c,s.key)||s.key!=='mechanical_gear'||s.qty!==1||s.dur!==undefined||s.meta!==undefined||s.charge!==undefined)return null;
  return {recipe:'X:gear-v1',total:BAL.recyclerV4.seconds*1000,outputs:c[s.key].outputs.map(([k,q])=>[k,q]),condition:null};
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
  if(s.key==='metal_pipe')return pipePlan(s);
  if(s.key==='mechanical_gear')return gearPlan(s);
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
  if(recipe==='X:pipe-v1')return pipePlan(s);
  if(recipe==='X:gear-v1')return s.key==='mechanical_gear'?gearPlan(s):null;
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
