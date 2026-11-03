/** Local diagnostic fixtures only. Does not define production rewards. */
import type { GameState } from './core';
import { ARCANA_CORES } from './arcana20';
import { addItem } from './engine';
import { ITEMS } from './catalog';
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

/** Reserve ordinary loot space in a fresh, isolated review run. Never removes
 * items or shrinks an existing inventory. Call only for an explicitly new
 * review run; existing runs and ordinary game saves are not migrated. */
export function expandReviewInventory(gs:GameState):void {
 const slots=gs.run?.custody.inv.slots;if(!slots)return;
 while(slots.length<40)slots.push(null);
}
/** Explicit testing convenience: refill carried ARCANA Cores only. Other
 * equipment, ordinary Core items, containers, and custody stay untouched. */
export function refillReviewCores(gs:GameState):number {
 const r=gs.run;if(!r)return 0;let count=0;
 for(const stack of r.custody.inv.slots){if(!stack || !ARCANA_CORES.some(c=>c.itemKey===stack.key))continue;const max=ITEMS[stack.key]?.charge;if(typeof max==='number' && (stack.charge??0)<max){stack.charge=max;count++;}}
 if(count){r.qaUsed=true;gs.revision++;}return count;
}
