import {expect,it} from 'vitest';
import {beginReceiptSink,endReceiptSink,newGame,startRun} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';
import {validate} from '../src/game/persist';
import {T0} from './helpers/g1b-kit';

it('a village medic sees a real harvest casualty and completes the same paid treatment after reload',()=>{
 setActiveLayout('veyra05-world');let gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const world=()=>gs.run!.humanWorld!;
 const events:ReturnType<typeof endReceiptSink>=[];
 let saved:{job:string;worker:string;patient:string;at:number;uid:string;qty:number}|undefined;
 // Survey the opening, then sample the observed accident window finely enough to save mid-treatment.
 for(let sec=30;sec<=1000;sec+=sec>=690?2:30){
   beginReceiptSink();try{settle(gs,T0+sec*1000,true);}finally{events.push(...endReceiptSink().filter(q=>['human.harvest.crush','human.down','human.medical.respond','human.medical.payment'].includes(q.kind)));}
   if(!saved){const medic=Object.values(world().people).find(h=>h.occupation==='medic' && h.state==='WORKING' && h.intent?.work?.kind==='medical' && events.some(q=>q.kind==='human.harvest.crush' && q.detail.split(':')[0]===h.intent?.work?.patientId));
    if(medic){const w=medic.intent!.work!,patient=world().people[w.patientId!];expect(patient.state).toBe('DOWNED');expect(w.observedPatient).toEqual({gx:patient.gx,gy:patient.gy,floor:patient.floor});
     const dose=gs.run!.custody[medic.inv.packId].slots.find(s=>s?.key===w.inputs[0][0]&&!s.production)!;
     saved={job:medic.intent!.intentId,worker:medic.actorId,patient:patient.actorId,at:sec,uid:dose.uid,qty:dose.qty};
     gs=validate(JSON.parse(JSON.stringify(gs)))!;expect(gs).toBeTruthy();expect(world().people[saved.worker].intent?.intentId).toBe(saved.job);
    }
   }
   if(saved && events.some(q=>q.kind==='human.medical.payment' && JSON.parse(q.detail).job===saved!.job))break;
 }
 expect(saved).toBeDefined();const s=saved!,medic=world().people[s.worker],patient=world().people[s.patient];
 const payments=events.filter(q=>q.kind==='human.medical.payment' && JSON.parse(q.detail).job===s.job);expect(payments).toHaveLength(1);
 const paid=JSON.parse(payments[0].detail);expect(paid).toMatchObject({worker:s.worker,patient:s.patient,job:s.job,hpBefore:1,hpAfter:31,inputs:[{uid:s.uid,containerId:medic.inv.packId,qty:1}]});
 expect(gs.run!.custody[medic.inv.packId].slots.find(v=>v?.uid===s.uid)?.qty??0).toBe(s.qty-1);
 expect(patient.hp).toBe(31);expect(patient.downedAt).toBeUndefined();expect(patient.wounds.every(w=>w.treated&&!w.bleeding)).toBe(true);expect(gs.run!.qaUsed).toBe(false);
 const cause=events.find(q=>q.kind==='human.harvest.crush'&&q.detail.startsWith(s.patient+':'))!,call=events.find(q=>q.kind==='human.medical.respond'&&q.detail.startsWith(`${s.worker}:${s.patient}:`))!;
 expect(cause.at).toBeLessThanOrEqual(call.at);expect(payments[0].at-call.at).toBeGreaterThanOrEqual(6000);
 console.log('NATURAL_MEDIC',JSON.stringify({seed:7606,start:T0,community:medic.community,cause,call,saved:s,paidAt:payments[0].at,paid}));
},400000);
