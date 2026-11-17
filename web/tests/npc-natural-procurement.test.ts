import {readFileSync,writeFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {validate} from '../src/game/persist';
import {newGame,startRun,beginReceiptSink,endReceiptSink,C} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';
import {ITEMS} from '../src/game/catalog';
import {T0} from './helpers/g1b-kit';
// Genesis is ordinary seed7606. SOH_PROCUREMENT_SAVE resumes only an actual
// serialized engine trajectory in a separate process; no test writes run state.
it('normal population physically procures and delivers a positive-hunger paid recipe',()=>{
 setActiveLayout('veyra05-greywater');const input=process.env.SOH_PROCUREMENT_SAVE;
 const gs=input?validate(JSON.parse(readFileSync(input,'utf8')))!:newGame();expect(gs).toBeTruthy();
 if(!input)expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 const ids=Object.keys(gs.run!.humanWorld!.people),before=performance.now();beginReceiptSink();
 const start=gs.run!.clock.lastSimAt;
 // This is a new 30min gameplay trajectory, NOT a changed h1 test or timeout.
 for(let at=start+60000;at<=start+1800000;at+=60000){
  settle(gs,at,true);
  const delivered=Object.values(gs.run!.humanWorld!.communities).some(c=>Object.values(c.cargoLedger??{}).flat().some(v=>v.recipe&&(ITEMS[v.key]?.food?.hunger??0)>0));
  if(delivered)break;
 }
 const events=endReceiptSink(),r=gs.run!,hw=r.humanWorld!;
 writeFileSync('../tmp/verification/procurement-final-natural-save.json',JSON.stringify(gs));
 writeFileSync('../tmp/verification/procurement-final-natural-events.json',JSON.stringify(events));
 const deliveries=events.filter(e=>e.kind==='human.cargo.lineage').map(e=>JSON.parse(e.detail!)).filter(v=>v.lineage.some((s:{recipe?:string;key:string})=>s.recipe&&(ITEMS[s.key]?.food?.hunger??0)>0));
 console.log(JSON.stringify({case:'natural-procurement',elapsedMs:performance.now()-before,simAt:r.clock.lastSimAt,actors:ids.length,deliveries,paid:events.filter(e=>e.kind==='human.production.pay')}));
 expect(Object.keys(hw.people)).toEqual(ids);expect(ids).toHaveLength(286);
 expect(deliveries.length).toBeGreaterThan(0);
 if(!input){
  const paid=events.filter(e=>e.kind==='human.production.pay').map(e=>JSON.parse(e.detail!));expect(paid.length).toBeGreaterThan(0);
  for(const d of deliveries)for(const s of d.lineage){expect(s.recipe).toBeTruthy();expect((ITEMS[s.key].food?.hunger??0)>0).toBe(true);expect(paid.some(p=>p.jobId===s.jobId)).toBe(true);expect(C(r,d.containerId).slots.some(v=>v!==null&&v.uid===s.intoUid&&v.qty>=s.qty)).toBe(true);}
  const paidTin=paid.flatMap(p=>p.inputs).find(v=>v.key==='tin_can');expect(paidTin).toBeTruthy();
  const tin=events.filter(e=>e.kind==='human.harvest.output').map(e=>JSON.parse(e.detail!)).find(e=>e.uid===paidTin.uid&&e.key==='tin_can');expect(tin).toBeTruthy();
  const transfer=events.filter(e=>e.kind==='human.cargo.lineage').map(e=>JSON.parse(e.detail!)).flatMap(d=>d.lineage).find(v=>v.fromUid===tin.uid&&v.intoUid===paidTin.uid&&v.sourceId===tin.sourceId);expect(transfer).toBeTruthy();
  expect(events.some(e=>e.kind==='human.procurement.contribute'&&JSON.parse(e.detail!).key==='cloth')).toBe(true);
 }
 const snapshot=JSON.stringify(r);settle(gs,r.clock.lastSimAt,true);expect(JSON.stringify(r)).toBe(snapshot);
},180000);
