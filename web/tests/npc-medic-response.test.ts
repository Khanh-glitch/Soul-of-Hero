import {describe,it,expect} from 'vitest';
import {newGame,startRun} from '../src/game/engine';
import {applyDamage,stepHumans} from '../src/game/humanworld';
import {humanNavigation} from '../src/game/human-navigation';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';

function accident(mode:'normal'|'no medicine'|'isolated'){
  setActiveLayout('veyra05-greywater'); const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
  const r=gs.run!,hw=r.humanWorld!,medic=Object.values(hw.people).find(h=>h.occupation==='medic')!,community=hw.communities[medic.community!];
  const members=community.memberIds.map(id=>hw.people[id]);const patient=members.find(h=>h.occupation==='builder')!;
  const occupied=new Set(Object.values(hw.people).filter(h=>h!==patient&&h!==medic).map(h=>`${h.floor}:${h.gx}:${h.gy}`));const nav=humanNavigation(r,occupied,true);
  // Place the accident in a reachable field, not in treatment range.
  const spot=[[-4,0],[4,0],[0,-4],[0,4]].map(([dx,dy])=>({tx:medic.gx+dx,ty:medic.gy+dy,floor:medic.floor})).find(p=>nav.free(p,patient)&&nav.route(medic,p)?.length);
  expect(spot).toBeDefined();patient.gx=spot!.tx;patient.gy=spot!.ty;patient.floor=mode==='isolated'?92:medic.floor;
  if(mode==='no medicine')for(const c of Object.values(r.custody))for(let i=0;i<c.slots.length;i++)if(['herb','bandage'].includes(c.slots[i]?.key??''))c.slots[i]=null;
  applyDamage(r,hw,patient,patient.hp*3,0,T0,'hazard',patient.actorId,patient.floor);expect(patient.state).toBe('DOWNED');
  return {r,hw,medic,patient};
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
