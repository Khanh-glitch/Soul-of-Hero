import {expect,it} from 'vitest';
import {newGame,startRun,findRunEntity,C,mkStack,workLightPowered,stepBasePower,powerAllocation} from '../src/game/engine';
import {planHumanOccupation,humanEntityTile,executeHumanWork} from '../src/game/human-jobs';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';

function yard(){
 setActiveLayout('veyra05-world');const gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!,comm=hw.communities['com:po_ironmine'];
 const h=comm.memberIds.map(id=>hw.people[id]).find(h=>h.occupation==='engineer')!,pack=C(r,h.inv.packId),store=findRunEntity(r,comm.storeEntityId)!;
 const g=comm.workStations.map(id=>findRunEntity(r,id)!).find(e=>e.basePower)!,lamp=findRunEntity(r,g.basePower!.workLightId)!,wire=findRunEntity(r,lamp.workLight!.cableId)!,tank=C(r,g.c!);
 return {r,hw,h,pack,store,g,lamp,wire,tank};
}
it('retains the selected fuel when it changes, the tank is full, or the yard circuit breaks',()=>{
 const {r,hw,h,pack,g,lamp,wire,tank}=yard();const [x,y]=humanEntityTile(r,g);h.gx=x;h.gy=y+1;
 const plan=()=>{expect(planHumanOccupation(r,hw,h,T0,()=>[])).toBe(true);expect(h.intent?.work?.kind).toBe('engineer');};
 const blocked=()=>{const before=JSON.stringify([pack,tank,r.nextId]);expect(executeHumanWork(r,hw,h,T0+3000).done).toBe(false);expect(JSON.stringify([pack,tank,r.nextId])).toBe(before);expect(workLightPowered(r,lamp)).toBe(false);};
 plan();const i=pack.slots.findIndex(s=>s?.uid===h.intent!.work!.itemUid);pack.slots[i]=mkStack(r,'charcoal',2);blocked();
 plan();tank.slots=tank.slots.map(()=>mkStack(r,'stone',1));blocked();tank.slots.fill(null);
 plan();wire.hp=0;blocked();wire.hp=wire.maxHp;
 plan();lamp.owner='player';blocked();
});
it('does not withdraw warehouse stock for a refuelled or foreign generator',()=>{
 const {r,hw,h,pack,g,store,tank}=yard(),stock=C(r,store.c!);pack.slots.fill(null);const [x,y]=humanEntityTile(r,store);h.gx=x;h.gy=y+1;
 const plan=()=>{expect(planHumanOccupation(r,hw,h,T0,()=>[])).toBe(true);expect(h.intent?.work).toMatchObject({phase:'fetch',kind:'engineer'});};
 const blocked=()=>{const before=JSON.stringify([pack,stock]);expect(executeHumanWork(r,hw,h,T0+800).done).toBe(false);expect(JSON.stringify([pack,stock])).toBe(before);};
 plan();tank.slots[0]=mkStack(r,'charcoal',1);blocked();tank.slots[0]=null;
 plan();tank.slots=tank.slots.map(()=>mkStack(r,'stone',1));blocked();tank.slots.fill(null);
 plan();g.owner='player';blocked();
});
it('never burns reserved charcoal, and a broken or cross-floor cable cannot light the yard',()=>{
 const {r,h,g,lamp,wire,tank}=yard();const claimed=mkStack(r,'charcoal',1);claimed.production={jobId:'other',workerId:h.actorId};tank.slots[0]=claimed;g.basePower!.enabled=true;
 expect(workLightPowered(r,lamp)).toBe(false);stepBasePower(r,500,T0+500);expect(tank.slots[0]).toEqual(claimed);expect(g.basePower!.energy).toBe(0);
 tank.slots[1]=mkStack(r,'charcoal',1);expect(workLightPowered(r,lamp)).toBe(true);stepBasePower(r,1000,T0+1500);expect(tank.slots[0]?.qty).toBe(1);expect(tank.slots[1]).toBeNull();expect(g.basePower!.energy).toBe(54000);
 wire.floor=1;expect(powerAllocation(r,g)).toEqual([]);wire.floor=0;wire.tx!++;expect(workLightPowered(r,lamp)).toBe(false);wire.tx!--;
 stepBasePower(r,53999,T0+55499);expect(workLightPowered(r,lamp)).toBe(true);expect(g.basePower!.energy).toBe(1);
 stepBasePower(r,1,T0+55500);expect(workLightPowered(r,lamp)).toBe(false);expect(tank.slots[0]?.qty).toBe(1);
});
