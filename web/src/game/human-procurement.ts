/** Physical community recipe board. Requests and reports are knowledge, never stock.
 * Reads use canonical shared sources; all extraction/delivery stays in humanworld. */
import {WW,WH,uid,type RunState} from './core';
import {ITEMS,RECIPES,SOURCES} from './catalog';
import {C,findRunEntity,globalSourceAt,receipt} from './engine';
import {globalSourceCandidates} from '../veyra05/window';
import {humanCanUseEntity,humanEntityTile,moveHumanGoods} from './human-jobs';
import type {HumanRecord,HumanWorld} from './humanworld';
export interface FoodRequest {id:string;cookId:string;recipe:string;at:number}
export interface SourceReport {gx:number;gy:number;floor:number;key:string;observer:string;at:number}
const foodRecipes=(h:HumanRecord)=>(h.knownRecipes??[]).filter(k=>RECIPES[k]?.station==='campfire'&&(ITEMS[RECIPES[k].out]?.food?.hunger??0)>0);
const held=(r:RunState,cids:string[],key:string)=>cids.reduce((q,id)=>q+(r.custody[id]?.slots??[]).reduce((n,s)=>n+(s?.key===key&&!s.production?s.qty:0),0),0);
export function communityFoodDeficit(r:RunState,hw:HumanWorld,h:HumanRecord){
 const c=h.community?hw.communities[h.community]:undefined,request=c?.foodRequest;
 if(!c||!request||(h.occupation!=='cook'&&h.recipeKnownRequestId!==request.id))return [];
 const cook=hw.people[request.cookId],rc=RECIPES[request.recipe];
 if(!cook||['DEAD','EVACUATED'].includes(cook.state)||!foodRecipes(cook).includes(request.recipe)||!c.workStations.some(id=>findRunEntity(r,id)?.type==='campfire'))return [];
 if(c.storeContainers.some(id=>r.custody[id]?.slots.some(s=>s&&(ITEMS[s.key]?.food?.hunger??0)>0&&s.key===rc.out)))return [];
 return rc.ins.map(([key,qty])=>({key,qty:Math.max(0,qty-held(r,c.storeContainers,key))})).filter(v=>v.qty>0);
}
/** Learn from one's existing local catchment, then carry the report to the board.
 * No read of distant workers' knowledge/inventories or unexplored island cells. */
export function observeRecipeSources(r:RunState,h:HumanRecord,now:number){
 if(h.occupation!=='cook'||!foodRecipes(h).length)return;
 const wanted=new Set(foodRecipes(h).flatMap(k=>RECIPES[k].ins.map(([key])=>key)));
 const allowed=new Set(Object.keys(SOURCES).filter(k=>SOURCES[k].yields.some(([key])=>wanted.has(key))));
 const o=r.sourceMap?.veyra?.originAu,ox=o?o[0]*2:0,oy=o?o[1]*2:0,local=h.gx>=ox&&h.gy>=oy&&h.gx<ox+WW&&h.gy<oy+WH;
 for(const p of globalSourceCandidates(h.gx,h.gy,h.floor,r.sourceMap?.rules===4?4:3,allowed,local?r.layoutId:undefined)){
  const s=globalSourceAt(r,p.gx,p.gy,h.floor,now);if(!s||s.protected||s.stock<=0)continue;
  const reports=h.recipeSourceReports??=[],report={gx:p.gx,gy:p.gy,floor:h.floor,key:p.key,observer:h.actorId,at:now};
  h.recipeSourceReports=[...reports.filter(q=>q.gx!==p.gx||q.gy!==p.gy||q.floor!==h.floor),report].slice(-32);
 }
}
export function serviceRecipeBoard(r:RunState,hw:HumanWorld,h:HumanRecord,now:number):boolean {
 const c=h.community?hw.communities[h.community]:undefined,e=c?.storeEntityId?findRunEntity(r,c.storeEntityId):undefined;
 if(!c||!e||e.owner!==c.id||!humanCanUseEntity(r,h,e)||!e.c||!c.storeContainers.includes(e.c))return false;
 // Workers may withdraw one real charged water vessel for field duty. This
 // finite personal safety ration also frees pantry slots; no capacity is added.
 if(!C(r,h.inv.packId).slots.some(s=>s&&ITEMS[s.key]?.waterContainer)){
  const vessel=C(r,e.c).slots.find(s=>s&&!s.production&&ITEMS[s.key]?.waterContainer&&(s.charge??0)>0);
  if(vessel){const uid=vessel.uid;if(moveHumanGoods(r,e.c,h.inv.packId,vessel.key,1))receipt(r,now,'human.procurement.ration',JSON.stringify({workerId:h.actorId,uid,from:e.c,into:h.inv.packId,qty:1}));}
 }
 h.recipeBoardAt=now;
 h.recipeKnownReports=(c.recipeSourceReports??[]).map(p=>({...p}));
 if(h.occupation==='cook'){
  for(const report of h.recipeSourceReports??[]){const reports=c.recipeSourceReports??=[];c.recipeSourceReports=[...reports.filter(q=>q.gx!==report.gx||q.gy!==report.gy||q.floor!==report.floor),report].slice(-64);}
  const recipes=foodRecipes(h).map(recipe=>{
   const rc=RECIPES[recipe];let unknown=0,missing=0;
   for(const [key,qty]of rc.ins)if(held(r,[h.inv.packId,...c.storeContainers],key)<qty){missing++;if(!(c.recipeSourceReports??[]).some(p=>SOURCES[p.key].yields.some(([k])=>k===key)))unknown++;}
   return {recipe,unknown:unknown/rc.ins.length,missing};
  }).sort((a,b)=>a.unknown-b.unknown||a.missing-b.missing||a.recipe.localeCompare(b.recipe));
  const choice=recipes[0];
  if(choice&&(!c.foodRequest||c.foodRequest.recipe!==choice.recipe)){
   c.foodRequest={id:uid(r,'rq'),cookId:h.actorId,recipe:choice.recipe,at:now};
   receipt(r,now,'human.procurement.request',JSON.stringify({community:c.id,...c.foodRequest,reports:c.recipeSourceReports}));
  }
 }
 h.recipeKnownReports=(c.recipeSourceReports??[]).map(p=>({...p}));
 h.recipeKnownRequestId=c.foodRequest?.id;
 // A worker voluntarily contributes only the finite outstanding bill, from their
 // own unclaimed pack, at the reached authorized store. Tools are not requests.
 for(const {key,qty}of communityFoodDeficit(r,hw,h)){
  const before=new Map(C(r,e.c).slots.filter(s=>!!s).map(s=>[s.uid,s.qty]));
  const from=C(r,h.inv.packId).slots.filter(s=>s?.key===key&&!s.production).map(s=>({uid:s!.uid,qty:s!.qty}));
  const n=moveHumanGoods(r,h.inv.packId,e.c,key,qty);if(!n)continue;
  receipt(r,now,'human.procurement.contribute',JSON.stringify({requestId:c.foodRequest!.id,workerId:h.actorId,fromContainer:h.inv.packId,from,intoContainer:e.c,key,qty:n,received:C(r,e.c).slots.filter(s=>s&&(s.qty>(before.get(s.uid)??0))).map(s=>({uid:s!.uid,qty:s!.qty-(before.get(s!.uid)??0)}))}));
  for(const id of c.memberIds){const cook=hw.people[id];if(cook?.occupation==='cook')cook.nextThinkAt=Math.min(cook.nextThinkAt??now,now);}
 }
 return true;
}
export function recipeBoardDestination(r:RunState,hw:HumanWorld,h:HumanRecord,now:number){
 const c=h.community?hw.communities[h.community]:undefined;if(!c||!c.workStations.some(id=>findRunEntity(r,id)?.type==='campfire')||(h.recipeBoardAt??-Infinity)+60000>now)return;
 if(!['cook','salvager','gardener','mechanic','builder','engineer'].includes(h.occupation))return;
 const e=c.storeEntityId?findRunEntity(r,c.storeEntityId):undefined;if(!e||e.owner!==c.id||(e.hp??1)<=0)return;
 const [gx,gy]=humanEntityTile(r,e);return {gx,gy,floor:e.floor??0};
}
export function requestedSourceReports(r:RunState,hw:HumanWorld,h:HumanRecord){
 const wanted=new Set(communityFoodDeficit(r,hw,h).map(v=>v.key));
 // Only knowledge actually read at the physical board may guide this worker.
 return (h.recipeKnownReports??[]).filter(p=>p.floor===h.floor&&SOURCES[p.key].yields.some(([k])=>wanted.has(k)));
}
