import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {expect,it} from 'vitest';
import {selectSnapshots,serializeSnapshot} from '../src/game/persist';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';
import {beginReceiptSink,endReceiptSink} from '../src/game/engine';
import {executeHumanWork} from '../src/game/human-jobs';

it('a Fishcamp eyewitness fetches one dose from the owned store and resumes at the actual casualty',()=>{
 let gs=selectSnapshots([gunzipSync(readFileSync('evidence/npc-integration/coast-62c9dae/h24.save.gz')).toString()]).gs!;
 const r=()=>gs.run!,hw=()=>r().humanWorld!,patient=()=>hw().people.h5v;
 const start=r().clock.lastSimAt,c=hw().communities[patient().community!],storeId=c.storeContainers[0];
 expect(setActiveLayout(r().layoutId!)).toBe(true);expect(patient().state).toBe('DOWNED');expect(patient().hp).toBe(1);
 expect(patient().lastWorkBlock).toBe('No available community responder with medicine.');
 const events:ReturnType<typeof endReceiptSink>=[];let interrupted:string|undefined,worker:string|undefined;
 for(let sec=2;sec<=300;sec+=2){
   beginReceiptSink();try{settle(gs,start+sec*1000,true);}finally{events.push(...endReceiptSink().filter(v=>['human.medical.respond','human.work.input','human.medical.payment'].includes(v.kind)));}
   const helper=Object.values(hw().people).find(h=>h.intent?.work?.patientId===patient().actorId);
   if(!interrupted&&helper?.state==='WORKING'&&helper.intent?.work?.phase!=='fetch'){
     const i=helper.intent!;worker=helper.actorId;interrupted=i.intentId;expect(helper.occupation).not.toBe('medic');expect(i.dueAt).toBeGreaterThan(r().clock.lastSimAt);
     const checkpoint=serializeSnapshot(gs);gs=selectSnapshots([checkpoint]).gs!;expect(hw().people[worker].intent?.intentId).toBe(interrupted);
     // Negative fork only: another responder already stabilized the patient.
     // First aid must not consume a second dose, even if other wounds remain.
     const fork=selectSnapshots([checkpoint]).gs!.run!,p=fork.humanWorld!.people.h5v,w=fork.humanWorld!.people[worker];p.state='IDLE';
     const stock=JSON.stringify(fork.custody[w.inv.packId]);expect(executeHumanWork(fork,fork.humanWorld!,w,i.dueAt).done).toBe(false);expect(JSON.stringify(fork.custody[w.inv.packId])).toBe(stock);expect(p.hp).toBe(1);
   }
   if(events.some(v=>v.kind==='human.medical.payment'&&JSON.parse(v.detail).patient==='h5v'))break;
 }
 expect(interrupted).toBeDefined();const paid=events.filter(v=>v.kind==='human.medical.payment'&&JSON.parse(v.detail).job===interrupted);expect(paid).toHaveLength(1);
 const payment=JSON.parse(paid[0].detail);expect(payment).toMatchObject({patient:'h5v',worker,hpBefore:1,hpAfter:31});expect(payment.at).toEqual(payment.seen);expect(payment.inputs).toHaveLength(1);
 const get=events.filter(v=>v.kind==='human.work.input').map(v=>JSON.parse(v.detail)).find(v=>v.orderId===interrupted);
 expect(get).toMatchObject({workerId:worker,containerId:storeId,into:hw().people[worker!].inv.packId});expect(get.inputs).toHaveLength(1);expect(get.received).toEqual([expect.objectContaining({uid:payment.inputs[0].uid,qty:1})]);expect(payment.inputs[0].qty).toBe(1);
 const call=events.find(v=>v.kind==='human.medical.respond'&&v.detail.startsWith(`${worker}:h5v:fetch:`));expect(call).toBeTruthy();expect(paid[0].at-call!.at).toBeGreaterThanOrEqual(6000);expect(patient().state).not.toBe('DOWNED');
 const evidence={run:r().id,seed:r().seed,start,call,fetched:get,paidAt:paid[0].at,payment,qa:!!r().qaUsed};console.log('FISHCAMP_AID',JSON.stringify(evidence));if(process.env.SOH_FISH_REPORT)writeFileSync(process.env.SOH_FISH_REPORT,JSON.stringify(evidence,null,2)+'\n');
},120000);
