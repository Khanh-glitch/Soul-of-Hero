import { expect, it } from 'vitest';
import { windowAround } from '../src/veyra05/frame';
import { layoutIdAt } from '../src/veyra05/scenes';
import { setActiveLayout, VEYRA_RECYCLER_SITE as site } from '../src/game/world';
import { C, dispatch, findRunEntity, mkStack, newGame, startRun, stepStations } from '../src/game/engine';
import { planHumanOccupation, executeHumanWork, humanEntityTile,humanCanUseEntity } from '../src/game/human-jobs';
import { humanNavigation } from '../src/game/human-navigation';
import { depositHumanOutputs } from '../src/game/humanworld';
import { validate } from '../src/game/persist';
import { T0 } from './helpers/g1b-kit';
import type { HumanRecord } from '../src/game/humanworld';
import type { Entity, RunState } from '../src/game/core';

// Controlled input and actor positions; the machine, member, warehouse, queues
// and downstream UID transfers are all from the shipping Veyra run.
function foundry(){
 const w=windowAround(site.tx,site.ty);setActiveLayout(layoutIdAt(w.originTx,w.originTy));
 const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!,comm=hw.communities['com:po_slag'];
 const h=comm.memberIds.map(id=>hw.people[id]).find(h=>h.occupation==='salvager')!;
 const e=Object.values(r.entities).find(e=>e.kind==='recycler')!,store=findRunEntity(r,comm.storeEntityId)!;
 const stock=C(r,store.c!),pack=C(r,h.inv.packId);pack.slots.fill(null);
 stock.slots.fill(null);stock.slots[0]=mkStack(r,'metal_pipe',2);
 const reach=(target:Entity)=>{const [x,y]=humanEntityTile(r,target);h.floor=target.floor??0;
   for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){h.gx=x+dx;h.gy=y+dy;if(humanCanUseEntity(r,h,target))return;}
   throw Error('no physical contact');};
 const plan=(at:number)=>planHumanOccupation(r,hw,h,at,()=>[]);
 return {gs,r,hw,h,comm,e,store,stock,pack,reach,plan};
}
function walkTo(r:RunState,h:HumanRecord,e:Entity,at:number){
 const [tx,ty]=humanEntityTile(r,e);
 const nav=humanNavigation(r),target={tx,ty,floor:e.floor??0};let path=nav.route(h,target);
 for(let i=0;i<190&&!path&&h.routeSearch?.status==='PENDING_SEARCH';i++)path=nav.route(h,target);
 expect(path,h.lastWorkBlock).not.toBeNull();for(const edge of path!){expect(nav.enter(h,edge,at)).toBe(true);h.gx=edge.tx;h.gy=edge.ty;h.floor=edge.floor;}
}
it('Slagworks salvager separates a real warehouse unit, resumes the fuel-free queue after reload and delivers its exclusive output',()=>{
 const {gs,r,hw,h,comm,e,store,stock,pack,reach,plan}=foundry();const sourceUid=stock.slots[0]!.uid;
 expect(humanEntityTile(r,e)).toEqual([site.tx,site.ty]);reach(store);expect(plan(T0)).toBe(true);
 expect(h.intent?.work).toMatchObject({phase:'fetch',entityId:e.id,itemUid:sourceUid});executeHumanWork(r,hw,h,T0+800);
 const unit=pack.slots[0]!;expect(unit.uid).not.toBe(sourceUid);expect(stock.slots[0]).toMatchObject({qty:1,uid:sourceUid});
 walkTo(r,h,e,T0+801);
 expect(plan(T0+801)).toBe(true);expect(executeHumanWork(r,hw,h,T0+2400).reason).toBe('recycler running');
 const job=e.station!.queue[0];expect(job.reserved![0].uid).toBe(unit.uid);expect(pack.slots.every(s=>!s)).toBe(true);
 r.player.x=e.x;r.player.y=e.y;expect(dispatch(gs,{id:'steal-reservation',type:'cancelJob',eid:e.id,jobId:job.id},T0+2401)).toMatchObject({ok:false,reason:expect.stringMatching(/worker/)});
 stepStations(gs,3000,T0+5400);h.intent=undefined;h.state='IDLE';const loaded=validate(JSON.parse(JSON.stringify(gs)));expect(loaded).not.toBeNull();
 const rr=loaded!.run!,world=rr.humanWorld!,worker=world.people[h.actorId],machine=findRunEntity(rr,e.id)!;
 expect(planHumanOccupation(rr,world,worker,T0+5401,()=>[])).toBe(true);expect(worker.intent?.work).toMatchObject({phase:'machine',kind:'recycle',machineJobId:job.id});
 expect(executeHumanWork(rr,world,worker,T0+6300).reason).toBe('machine processing or paused');expect(machine.station!.queue[0].left).toBe(job.total-3000);
 stepStations(loaded!,job.total-3000,T0+12400);const out=machine.station!.outC,lot=C(rr,out).slots[0]!;
 expect(lot.production).toMatchObject({jobId:job.id,stationId:e.id,recipe:job.recipe,inputs:[{uid:unit.uid,key:'metal_pipe',qty:1,containerId:pack.id}]});
 expect(dispatch(loaded!,{type:'drop',id:'steal-output',slot:0,c:out},T0+12400)).toMatchObject({ok:false,reason:expect.stringMatching(/worker/)});
 expect(executeHumanWork(rr,world,worker,T0+12401).done).toBe(true);expect(C(rr,pack.id).slots[0]!.uid).toBe(lot.uid);
 const dest=findRunEntity(rr,store.id)!;walkTo(rr,worker,dest,T0+12402);
 expect(humanCanUseEntity(rr,worker,dest)).toBe(true);depositHumanOutputs(rr,worker,T0+12402);depositHumanOutputs(rr,worker,T0+12403);
 const ledger=Object.values(world.communities[comm.id].cargoLedger!).flat();expect(ledger).toHaveLength(1);expect(ledger[0]).toMatchObject({fromUid:lot.uid,key:'refined_iron_ingot',qty:1,stationId:e.id,inputs:lot.production!.inputs});
 expect(C(rr,stock.id).slots[0]).toMatchObject({qty:1,uid:sourceUid});
});
it('does not replace a removed salvage lot with a lookalike UID',()=>{
 const {r,hw,h,store,stock,pack,reach,plan}=foundry();reach(store);expect(plan(T0)).toBe(true);
 const replacement=mkStack(r,'metal_pipe',2);stock.slots[0]=replacement;
 expect(executeHumanWork(r,hw,h,T0+900).reason).toMatch(/missing/);expect(h.intent).toBeUndefined();expect(replacement.qty).toBe(2);expect(pack.slots.every(s=>!s)).toBe(true);
});

it('leaves protected cargo and tools alone, and cannot fetch across floors',()=>{
 const {r,hw,h,store,stock,pack,reach,plan}=foundry();reach(store);
 pack.slots[0]=mkStack(r,'iron_pick',1);stock.slots[1]=mkStack(r,'metal_pipe',1);
 stock.slots[1]!.production={jobId:'j1',workerId:h.actorId};
 const unit=stock.slots[0]!;stock.slots[0]=null;expect(plan(T0)).toBe(false);
 stock.slots[0]=unit;expect(plan(T0)).toBe(true);h.floor++;
 expect(executeHumanWork(r,hw,h,T0+800).reason).toMatch(/authorized store/);
 expect(stock.slots[0]).toBe(unit);expect(unit.qty).toBe(2);expect(pack.slots.filter(Boolean)).toHaveLength(1);
});

it('player cannot split or consume an accessible claimed stack',()=>{
 const {gs,r,h,e}=foundry();r.player.x=e.x;r.player.y=e.y;
 const c=e.station!.outC,stack=mkStack(r,'berries',2);stack.production={workerId:h.actorId,jobId:'j1'};C(r,c).slots[0]=stack;
 for(const type of ['split','useItem'])expect(dispatch(gs,{type,id:type,c,slot:0},T0+1).ok).toBe(false);
 expect(stack.qty).toBe(2);expect(C(r,c).slots.filter(Boolean)).toEqual([stack]);
});
