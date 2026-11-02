/** Local diagnostic fixtures only. Does not define production rewards. */
import type { GameState } from './core';
import { ARCANA_CORES } from './arcana20';
import { addItem } from './engine';
export function grantReviewCore(gs:GameState,id:number):{ok:boolean;reason?:string}{
 const r=gs.run,core=ARCANA_CORES[id-1];if(!r||!core||core.id!==id)return {ok:false,reason:'Invalid Core or no active run.'};
 if(addItem(r,'inv',core.itemKey,1)>0)return {ok:false,reason:'Inventory is full.'};
 r.qaUsed=true;gs.revision++;return {ok:true};
}
/** Seed every experimental Core for a new isolated QA run, prioritizing the
 * four requested final abilities in the first available hotbar positions.
 * Never overwrites an existing item; reports any IDs that could not fit. */
export function seedReviewInventory(gs:GameState):{added:number[];missing:number[]} {
 const added:number[]=[],missing:number[]=[];if(!gs.run)return {added,missing:ARCANA_CORES.map(c=>c.id)};
 const r=gs.run,order=[17,18,19,20,...Array.from({length:16},(_,i)=>i+1)];
 for(const id of order){const c=ARCANA_CORES[id-1];
  if(r.custody.inv.slots.some(s=>s?.key===c.itemKey))continue;
  if(addItem(r,'inv',c.itemKey,1)>0)missing.push(id);else added.push(id);
 }
 if(added.length){r.qaUsed=true;gs.revision++;}return {added,missing};
}
