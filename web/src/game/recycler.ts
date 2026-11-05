import { BAL, type Container, type Stack } from './core';
import { ITEMS } from './catalog';

type Output = [string, number];
export type RecoveryPlan = { recipe:'X:drive'|'X:recover-v1'; total:number; outputs:Output[]; condition:number|null };
/** Explicit v1 whitelist. A reserved instance and version determine all outputs.
 * Do not change v1 tuning in place when revising rules: old queued jobs use it. */
export function recoveryPlan(s:Stack):RecoveryPlan|null {
  if(!s||typeof s!=="object"||s.qty!==1)return null;
  if(s.key==='damaged_drive')return {recipe:'X:drive',total:12000,outputs:[['spares',2]],condition:null};
  const rules=BAL.recyclerV1.rules as Record<string,{base:Output[];mid:Output[];high:Output[]}>;
  if(!Object.prototype.hasOwnProperty.call(rules,s.key))return null;
  const max=ITEMS[s.key]?.dur;
  if(!max||!Number.isFinite(s.dur)||s.dur!<0||s.dur!>max)return null;
  const condition=s.dur!/max,rule=rules[s.key];
  return {recipe:'X:recover-v1',total:BAL.recyclerV1.seconds*1000,condition,outputs:[...rule.base,...(condition>=BAL.recyclerV1.midCondition?rule.mid:[]),...(condition>=BAL.recyclerV1.highCondition?rule.high:[])].map(([k,q])=>[k,q])};
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
