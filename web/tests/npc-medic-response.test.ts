import {describe,it,expect} from 'vitest';
import {newGame,startRun,clearSurvivorSight,mkCreature,markDirty,beginReceiptSink,endReceiptSink,addItem} from '../src/game/engine';
import {applyDamage,stepHumans,stepHumanCombat,downHuman,downedByThirst} from '../src/game/humanworld';
import {humanNavigation} from '../src/game/human-navigation';
import {setActiveLayout} from '../src/game/world';
import {validate} from '../src/game/persist';
import {TILE,WW,WH} from '../src/game/core';
import {planHumanOccupation} from '../src/game/human-jobs';
import {T0} from './helpers/g1b-kit';

function accident(mode:'normal'|'no medicine'|'isolated'|'wolf'){
  setActiveLayout('veyra05-greywater'); const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
  const r=gs.run!,hw=r.humanWorld!,medic=Object.values(hw.people).find(h=>h.occupation==='medic')!,community=hw.communities[medic.community!];
  const members=community.memberIds.map(id=>hw.people[id]);const patient=members.find(h=>h.occupation==='builder')!;
  const occupied=new Set(Object.values(hw.people).filter(h=>h!==patient&&h!==medic).map(h=>`${h.floor}:${h.gx}:${h.gy}`));const nav=humanNavigation(r,occupied,true);
  // Place the accident in a reachable field, not in treatment range.
  const spot=[[-4,0],[4,0],[0,-4],[0,4]].map(([dx,dy])=>({tx:medic.gx+dx,ty:medic.gy+dy,floor:medic.floor})).find(p=>nav.free(p,patient)&&nav.route(medic,p)?.length);
  expect(spot).toBeDefined();patient.gx=spot!.tx;patient.gy=spot!.ty;patient.floor=mode==='isolated'?92:medic.floor;
  if(mode==='no medicine')for(const c of Object.values(r.custody))for(let i=0;i<c.slots.length;i++)if(['herb','bandage'].includes(c.slots[i]?.key??''))c.slots[i]=null;
  if(mode==='wolf'){
    const [ax,ay]=r.sourceMap!.veyra!.originAu,tx=patient.gx-ax*2,ty=patient.gy-ay*2;expect(tx).toBeGreaterThanOrEqual(0);expect(tx).toBeLessThan(WW);expect(ty).toBeGreaterThanOrEqual(0);expect(ty).toBeLessThan(WH);
    const wolf=mkCreature(r,'wolf',(tx+.5)*TILE,(ty+.5)*TILE,100);wolf.state='attack';wolf.floor=r.veyraFloor??0;r.creatures.push(wolf);patient.hp=1;
    stepHumanCombat(r,hw,T0);expect(patient.wounds.some(w=>w.bleeding)).toBe(true);wolf.state='wander';
  }else applyDamage(r,hw,patient,patient.hp*3,0,T0,'hazard',patient.actorId,patient.floor);expect(patient.state).toBe('DOWNED');
  return {gs,r,hw,medic,patient};
}

describe('community medical call',()=>{
 it('walks to the downed body and spends exactly one carried dose after contact',()=>{
  const {r,hw,medic,patient}=accident('normal');const dose=()=>r.custody[medic.inv.packId].slots.reduce((n,s)=>n+(s?.key==='bandage'||s?.key==='herb'?s.qty:0),0);const before=dose(),hp=patient.hp;
  stepHumans(r,hw,T0+100);expect(medic.intent?.work?.patientId).toBe(patient.actorId);expect(medic.intent?.route?.length).toBeGreaterThan(0);expect(dose()).toBe(before);
  for(let t=1000;t<=120000&&patient.state==='DOWNED';t+=1000)stepHumans(r,hw,T0+t);
  expect(patient.state).toBe('IDLE');expect(patient.hp).toBeGreaterThan(hp);expect(patient.wounds.every(w=>w.treated)).toBe(true);expect(dose()).toBe(before-1);
  expect(r.receipts.filter(q=>q.kind==='human.treat'&&q.detail.startsWith(`${medic.actorId}:${patient.actorId}:`))).toHaveLength(1);
 });
 it.each(['no medicine','isolated'] as const)('retains the casualty with %s',mode=>{
  const {r,hw,patient}=accident(mode);stepHumans(r,hw,T0+1000);stepHumans(r,hw,T0+20000);
  expect(patient.state).toBe('DOWNED');expect(patient.wounds.some(w=>!w.treated)).toBe(true);expect(patient.lastWorkBlock).toMatch(/responder|route/);expect(r.receipts.some(q=>q.kind==='human.treat')).toBe(false);
 });
});

// Controlled encounter, not an organic New Game injury: only the casualty and
// wolf are staged. No medical task, medicine, travel or recovery is injected.
it('finishes a witnessed wolf injury after a validated save in treatment',()=>{
 const first=accident('wolf'),mid=first.medic.actorId,pid=first.patient.actorId;
 let gs=first.gs;const medic=()=>gs.run!.humanWorld!.people[mid],patient=()=>gs.run!.humanWorld!.people[pid];
 const pack=()=>gs.run!.custody[medic().inv.packId];const bandage=pack().slots.find(s=>s?.key==='bandage')!;
 const before=bandage.qty;let resumed:string|undefined;beginReceiptSink();let events:ReturnType<typeof endReceiptSink>;
 try{for(let ms=100;ms<=60000 && patient().state==='DOWNED';ms+=500){
    stepHumans(gs.run!,gs.run!.humanWorld!,T0+ms);
    if(!resumed && medic().state==='WORKING' && medic().intent?.work?.patientId===pid){
      resumed=medic().intent!.intentId;expect(pack().slots.find(s=>s?.uid===bandage.uid)?.qty).toBe(before);
      gs=validate(JSON.parse(JSON.stringify(gs)))!;expect(gs).toBeTruthy();expect(medic().intent?.intentId).toBe(resumed);expect(patient().state).toBe('DOWNED');
    }
 }}finally{events=endReceiptSink();}
 expect(resumed).toBeTruthy();const bills=events.filter(e=>e.kind==='human.medical.payment').map(e=>JSON.parse(e.detail)).filter(b=>b.patient===pid);
 expect(bills).toHaveLength(1);expect(bills[0]).toMatchObject({worker:mid,job:resumed,hpBefore:1,hpAfter:31,inputs:[{uid:bandage.uid,qty:1,containerId:pack().id}]});
 expect(pack().slots.find(s=>s?.uid===bandage.uid)?.qty??0).toBe(before-1);expect(patient().state).toBe('IDLE');expect(patient().wounds.every(w=>w.treated&&!w.bleeding)).toBe(true);
 console.log('CONTROLLED_MEDIC',JSON.stringify(bills[0]));
});

it('does not discover an unwitnessed patient through a wall or across the settlement',()=>{
 const {r,hw,patient,medic}=accident('normal');const [ax,ay]=r.sourceMap!.veyra!.originAu;
 // Keep the roster, site, health, medicine and route callback identical. Only
 // change visibility. Both the emergency dispatch and ordinary planner use it.
 const dx=Math.sign(patient.gx-medic.gx),dy=Math.sign(patient.gy-medic.gy);
 const tx=medic.gx+dx-ax*2,ty=medic.gy+dy-ay*2;
 expect(clearSurvivorSight(r,medic,patient)).toBe(true);
 r.entities['test-shutter']={id:'test-shutter',kind:'door',open:false,tx,ty,x:(tx+.5)*TILE,y:(ty+.5)*TILE};markDirty();
 expect(clearSurvivorSight(r,medic,patient)).toBe(false);
 expect(planHumanOccupation(r,hw,medic,T0,()=>[])).toBe(false);
 stepHumans(r,hw,T0+100);expect(medic.intent?.work?.patientId).not.toBe(patient.actorId);
 r.entities['test-shutter'].open=true;markDirty();expect(clearSurvivorSight(r,medic,patient)).toBe(true);
 patient.gx=medic.gx+9;patient.gy=medic.gy;expect(clearSurvivorSight(r,medic,patient)).toBe(false);
});

it('returns to the observed tile, not the current coordinates of an unseen casualty',()=>{
 const {gs,r,hw,medic,patient}=accident('normal');stepHumans(r,hw,T0+100);
 const seen=medic.intent!.work!.observedPatient!;expect(seen).toEqual({gx:patient.gx,gy:patient.gy,floor:patient.floor});
 patient.gx+=50;const routes:number[][]=[];
 planHumanOccupation(r,hw,medic,T0+200,(...p)=>{routes.push(p);return null;});expect(routes).toEqual([[seen.gx,seen.gy,seen.floor]]);
 const invalid=JSON.parse(JSON.stringify(gs));invalid.run.humanWorld.people[medic.actorId].intent.work.observedPatient.gx=-1;
 expect(validate(invalid)).toBeNull();
});

it('a landed hostile hit interrupts even an unarmed responder before the dose is paid',()=>{
 const {r,hw,medic,patient}=accident('normal');stepHumans(r,hw,T0+100);expect(medic.intent?.work?.patientId).toBe(patient.actorId);
 const carried=JSON.stringify(r.custody[medic.inv.packId]);medic.equip.weapon=null;
 expect(applyDamage(r,hw,medic,1,0,T0+101,'enemy','attacker',medic.floor)).toBe(true);
 expect(medic.intent?.work).toBeUndefined();expect(patient.state).toBe('DOWNED');expect(JSON.stringify(r.custody[medic.inv.packId])).toBe(carried);
 expect(r.receipts.some(q=>q.kind==='human.medical.interrupted')).toBe(true);
});

// Creator ruling 2026-11-23: water is the first aid for a resident who collapsed from thirst. Controlled scene: only
// the collapse, the patient's thirst and what the medic carries are staged; the call, the walk, the six seconds at
// the body and the debit are the game's own. Not claimed: that this collapse arose in organic play.
describe('first aid with water for a thirst collapse',()=>{
 function thirst(carry:{drink:boolean;medicine:boolean},cause:'thirst'|'thirst and bleeding'|'accident'){
  setActiveLayout('veyra05-greywater'); const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
  const r=gs.run!,hw=r.humanWorld!,medic=Object.values(hw.people).find(h=>h.occupation==='medic')!,community=hw.communities[medic.community!];
  const patient=community.memberIds.map(id=>hw.people[id]).find(h=>h.occupation==='builder')!;
  const occupied=new Set(Object.values(hw.people).filter(h=>h!==patient&&h!==medic).map(h=>`${h.floor}:${h.gx}:${h.gy}`));const nav=humanNavigation(r,occupied,true);
  const spot=[[-4,0],[4,0],[0,-4],[0,4]].map(([dx,dy])=>({tx:medic.gx+dx,ty:medic.gy+dy,floor:medic.floor})).find(q=>nav.free(q,patient)&&nav.route(medic,q)?.length);
  expect(spot).toBeDefined();patient.gx=spot!.tx;patient.gy=spot!.ty;patient.floor=medic.floor;
  // Nothing drinkable or medicinal anywhere except what this test hands the medic.
  const drinkable=(k:string)=>k==='water_flask'||k==='trail_canteen';
  for(const c of Object.values(r.custody))for(let i=0;i<c.slots.length;i++){const k=c.slots[i]?.key??'';if(drinkable(k)||(!carry.medicine&&['herb','bandage'].includes(k)))c.slots[i]=null;}
  const pack=()=>r.custody[medic.inv.packId];
  for(let i=0;i<pack().slots.length;i++){const st=pack().slots[i];if(st&&st.key!=='bandage'&&st.key!=='herb')pack().slots[i]=null;}   // room for the flask; no berries to hand over
  if(carry.drink)expect(addItem(r,medic.inv.packId,'water_flask',1)).toBe(0);
  medic.thirst=90;medic.hunger=90;patient.hp=1;patient.wounds=[];
  if(cause==='accident'){patient.thirst=50;applyDamage(r,hw,patient,patient.hp*3,0,T0,'hazard',patient.actorId,patient.floor);}
  else{patient.thirst=0;downHuman(r,hw,patient,T0,cause==='thirst'?'starvation':'enemy');}
  expect(patient.state).toBe('DOWNED');expect(downedByThirst(patient)).toBe(cause==='thirst');
  const flask=()=>pack().slots.find(q=>q?.key==='water_flask');
  const doses=()=>pack().slots.reduce((n,q)=>n+(q?.key==='bandage'||q?.key==='herb'?q.qty:0),0);
  const run=(ms:number)=>{for(let t=1000;t<=ms&&patient.state==='DOWNED';t+=1000)stepHumans(r,hw,T0+t);};
  const kinds=(k:string)=>r.receipts.filter(q=>q.kind===k);
  return {gs,r,hw,medic,patient,flask,doses,run,kinds};
 }

 it('the medic walks over and gives one drink; the patient comes round with water in them and no dose is spent',()=>{
  const o=thirst({drink:true,medicine:true},'thirst');const charge=o.flask()!.charge!,doses=o.doses();expect(doses).toBeGreaterThan(0);
  stepHumans(o.r,o.hw,T0+100);
  expect(o.medic.intent?.work).toMatchObject({kind:'medical',patientId:o.patient.actorId,inputs:[]});
  expect(o.kinds('human.medical.respond').at(-1)!.detail).toMatch(new RegExp(`^${o.medic.actorId}:${o.patient.actorId}:water:`));
  expect(o.flask()!.charge).toBe(charge);                                             // nothing is spent before contact
  o.run(120000);
  expect(o.patient.state).toBe('IDLE');expect(o.patient.thirst).toBe(30);expect(o.patient.downedAt).toBeUndefined();
  expect(o.patient.hp).toBe(10);                                                      // water is not medicine: it only stands the patient up at WATER_REVIVE_HP (10)
  expect(o.patient.wounds.every(w=>w.treated)).toBe(true);
  expect(o.flask()!.charge).toBe(charge-1);expect(o.doses()).toBe(doses);
  const water=o.kinds('human.medical.water').map(q=>JSON.parse(q.detail));
  expect(water).toHaveLength(1);expect(water[0]).toMatchObject({worker:o.medic.actorId,patient:o.patient.actorId,key:'water_flask',thirstBefore:0,thirstAfter:30});
  expect(o.kinds('human.medical.payment')).toHaveLength(0);
  expect(o.kinds('human.treat').map(q=>q.detail)).toEqual([`${o.medic.actorId}:${o.patient.actorId}:water`]);
 });

 it('the answer survives a validated save taken on the way to the patient',()=>{
  const o=thirst({drink:true,medicine:false},'thirst');stepHumans(o.r,o.hw,T0+100);
  const job=o.medic.intent!.intentId;expect(o.medic.intent?.work?.inputs).toEqual([]);
  const gs=validate(JSON.parse(JSON.stringify(o.gs)))!;expect(gs).toBeTruthy();
  const r=gs.run!,hw=r.humanWorld!,medic=hw.people[o.medic.actorId],patient=hw.people[o.patient.actorId];
  expect(medic.intent?.intentId).toBe(job);
  for(let t=1000;t<=120000&&patient.state==='DOWNED';t+=1000)stepHumans(r,hw,T0+t);
  expect(patient.state).toBe('IDLE');expect(patient.thirst).toBe(30);
  expect(r.receipts.filter(q=>q.kind==='human.medical.water').map(q=>JSON.parse(q.detail).job)).toEqual([job]);
 });

 it('thirst and a bleeding wound: the dose stops the bleeding and the same visit gives the drink',()=>{
  const o=thirst({drink:true,medicine:true},'thirst and bleeding');const charge=o.flask()!.charge!,doses=o.doses();
  stepHumans(o.r,o.hw,T0+100);expect(o.medic.intent?.work?.inputs).toHaveLength(1);
  o.run(120000);
  expect(o.patient.state).toBe('IDLE');expect(o.patient.wounds.every(w=>w.treated&&!w.bleeding)).toBe(true);
  expect(o.patient.hp).toBe(31);expect(o.patient.thirst).toBe(30);
  expect(o.doses()).toBe(doses-1);expect(o.flask()!.charge).toBe(charge-1);
  expect(o.kinds('human.medical.payment')).toHaveLength(1);expect(o.kinds('human.medical.water')).toHaveLength(1);
 });

 it('negative: bleeding and no medicine — water alone does not answer it, and the flask is untouched',()=>{
  const o=thirst({drink:true,medicine:false},'thirst and bleeding');const charge=o.flask()!.charge!;
  stepHumans(o.r,o.hw,T0+1000);stepHumans(o.r,o.hw,T0+20000);
  expect(o.patient.state).toBe('DOWNED');expect(o.patient.thirst).toBe(0);expect(o.flask()!.charge).toBe(charge);
  expect(o.kinds('human.treat')).toHaveLength(0);expect(o.kinds('human.medical.water')).toHaveLength(0);
 });

 it('negative: a collapse that is not from thirst gets no water-only answer',()=>{
  const o=thirst({drink:true,medicine:false},'accident');const charge=o.flask()!.charge!;
  stepHumans(o.r,o.hw,T0+1000);stepHumans(o.r,o.hw,T0+20000);
  expect(o.patient.state).toBe('DOWNED');expect(o.flask()!.charge).toBe(charge);expect(o.kinds('human.treat')).toHaveLength(0);
 });

 it('negative: no drink in the pack — the old rule holds: one dose, back on their feet, still without water',()=>{
  const o=thirst({drink:false,medicine:true},'thirst');const doses=o.doses();
  o.run(120000);
  expect(o.patient.state).toBe('IDLE');expect(o.patient.thirst).toBe(0);expect(o.doses()).toBe(doses-1);
  expect(o.kinds('human.medical.water')).toHaveLength(0);
 });
});
