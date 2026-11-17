import {readFileSync,writeFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {validate} from '../src/game/persist';
import {C,beginReceiptSink,endReceiptSink} from '../src/game/engine';
import {settle} from '../src/game/sim';
import {setActiveLayout} from '../src/game/world';
import {ITEMS} from '../src/game/catalog';
import {T0} from './helpers/g1b-kit';
// Opt-in long biological-time continuation, not a replacement for unchanged h1.
const enabled=!!process.env.SOH_FOOD_CONSUMER_SAVE;
it.skipIf(!enabled)('separate-process natural biology consumes one delivered paid meal UID exactly once',()=>{
 setActiveLayout('veyra05-greywater');let gs=validate(JSON.parse(readFileSync(process.env.SOH_FOOD_CONSUMER_SAVE!,'utf8')))!;expect(gs).toBeTruthy();
 const ids=Object.keys(gs.run!.humanWorld!.people),evidence:unknown[]=[];let consumed=false;
 for(let at=gs.run!.clock.lastSimAt+300000;at<=T0+12*3600000;at+=300000){
  const r=gs.run!,hw=r.humanWorld!,beforeHunger=new Map(Object.values(hw.people).map(h=>[h.actorId,h.hunger]));
  const meals=new Map<string,{containerId:string;qty:number}>();
  for(const c of Object.values(hw.communities))for(const row of Object.values(c.cargoLedger??{}).flat())if(row.recipe&&(ITEMS[row.key]?.food?.hunger??0)>0){const s=C(r,c.storeContainers[0]).slots.find(s=>s?.uid===row.intoUid);if(s)meals.set(s.uid,{containerId:c.storeContainers[0],qty:s.qty});}
  const cpu=performance.now();beginReceiptSink();settle(gs,at,true);const events=endReceiptSink();
  const intake=events.filter(e=>e.kind==='human.consume').map(e=>({at:e.at,...JSON.parse(e.detail!)})).filter(e=>meals.has(e.uid));
  evidence.push({at,cpuMs:performance.now()-cpu,events:events.filter(e=>/production|cargo.lineage|human.consume/.test(e.kind))});
  writeFileSync('../tmp/verification/procurement-biological-save.json',JSON.stringify(gs));
  writeFileSync('../tmp/verification/procurement-biological-events.json',JSON.stringify(evidence));
  if(Math.floor((at-T0)/300000)%12===2)console.log(JSON.stringify({case:'natural-biological-progress',at,hours:(at-T0)/3600000,cpuMs:performance.now()-cpu,actors:Object.keys(hw.people).length}));
  if(intake.length){
   for(const e of intake){const b=meals.get(e.uid)!;expect(e.containerId).toBe(b.containerId);expect(e.qty).toBe(1);expect(C(r,e.containerId).slots.find(s=>s?.uid===e.uid)?.qty??0).toBe(b.qty-1);expect(hw.people[e.actorId].hunger).toBeGreaterThan(beforeHunger.get(e.actorId)!);expect((ITEMS[e.key].food?.hunger??0)>0).toBe(true);}
   console.log(JSON.stringify({case:'natural-paid-meal-consumed',intake,hunger:intake.map(e=>({actorId:e.actorId,before:beforeHunger.get(e.actorId),after:hw.people[e.actorId].hunger}))}));
   expect(Object.keys(hw.people)).toEqual(ids);expect(ids).toHaveLength(286);
   const once=JSON.stringify(gs);settle(gs,at,true);expect(JSON.stringify(gs)).toBe(once);const loaded=validate(JSON.parse(once));expect(loaded).toBeTruthy();gs=loaded!;settle(gs,at,true);expect(JSON.stringify(gs.run!.humanWorld)).toBe(JSON.stringify(hw));consumed=true;break;
  }
 }
 expect(consumed).toBe(true);
},1800000);
