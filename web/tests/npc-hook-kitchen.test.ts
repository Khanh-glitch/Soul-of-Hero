import {it,expect} from 'vitest';
import {naturalHookGarden} from './helpers/hook-garden-run';
import {C,findRunEntity} from '../src/game/engine';
import {RECIPES} from '../src/game/catalog';
it('reconciles the delivered Hook Sunroot lot with actual campfire bills and loose stock',()=>{
 const samples:{sec:number;uid:string;store:string;qty:number;cooks:{id:string;fires:string[];bills:{recipe:string;inputs:{key:string;need:number;have:number}[]}[]}[]}[]=[];
 const run=naturalHookGarden((r,sec)=>{
   const hw=r.humanWorld!,c=hw.communities['com:po_hook'],delivered=Object.values(c.cargoLedger??{}).flat().find(q=>q.key==='crop'&&q.stationId&&findRunEntity(r,q.stationId)?.garden);
   if(!delivered)return;
   const store=c.storeContainers[0],lot=C(r,store).slots.find(s=>s?.uid===delivered.intoUid),cooks=c.memberIds.map(id=>hw.people[id]).filter(h=>h.occupation==='cook').map(h=>{
    const supply=[...C(r,h.inv.packId).slots,...c.storeContainers.flatMap(id=>C(r,id).slots)].filter(s=>s&&!s.production);
    return {id:h.actorId,fires:c.workStations.filter(id=>findRunEntity(r,id)?.type==='campfire'),bills:(h.knownRecipes??[]).filter(k=>RECIPES[k]?.station==='campfire'&&RECIPES[k].ins.some(([key])=>key==='crop')).map(recipe=>({recipe,inputs:RECIPES[recipe].ins.map(([key,need])=>({key,need,have:supply.reduce((n,s)=>n+(s?.key===key?s.qty:0),0)}))}))};});
   samples.push({sec,uid:delivered.intoUid,store,qty:lot?.qty??0,cooks});
 });
 const lot=run.output.find(row=>row.key==='crop')!;expect(samples.length).toBeGreaterThan(1);expect(samples[0]).toMatchObject({uid:lot.intoUid,qty:3});expect(samples[0].cooks.length).toBeGreaterThan(0);
 expect(samples[0].cooks.every(c=>c.bills.some(b=>b.recipe==='stew'))).toBe(true);
 for(const s of samples){expect(s.uid).toBe(lot.intoUid);expect(s.qty).toBe(3);for(const c of s.cooks){expect(c.fires.length).toBeGreaterThan(0);const stew=c.bills.find(b=>b.recipe==='stew')!;expect(stew.inputs.filter(l=>l.have<l.need)).toEqual([{key:'meat',need:1,have:0}]);}}
 console.log('HOOK_KITCHEN',JSON.stringify({seed:run.seed,delivery:lot,first:samples[0],last:samples.at(-1),minQty:Math.min(...samples.map(s=>s.qty)),payable:samples.filter(s=>s.cooks.some(c=>c.bills.some(b=>b.inputs.every(l=>l.have>=l.need)))).map(s=>s.sec)}));
},600000);
