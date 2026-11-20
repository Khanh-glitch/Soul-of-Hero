import {describe,it,expect} from 'vitest';
import {newGame,startRun,clearSurvivorSight,mkCreature,markDirty,beginReceiptSink,endReceiptSink} from '../src/game/engine';
import {applyDamage,stepHumans,stepHumanCombat} from '../src/game/humanworld';
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
