/** Local diagnostic fixtures only. Does not define production rewards. */
import type { GameState } from './core';
import { ARCANA_CORES } from './arcana20';
import { addItem } from './engine';
export function grantReviewCore(gs:GameState,id:number):{ok:boolean;reason?:string}{
 const r=gs.run,core=ARCANA_CORES[id-1];if(!r||!core||core.id!==id)return {ok:false,reason:'Invalid Core or no active run.'};
 if(addItem(r,'inv',core.itemKey,1)>0)return {ok:false,reason:'Inventory is full.'};
 r.qaUsed=true;gs.revision++;return {ok:true};
}
