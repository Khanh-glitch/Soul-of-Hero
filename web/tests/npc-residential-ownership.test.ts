import {describe,it,expect} from 'vitest';
import {newGame,startRun,findRunEntity,mkContainer,addItem,C,queuePaidRecipe,stepStations,mkStack,blockGrid,dispatch} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {usingHumanBed,resolveOrder,commandHuman,stepHumans,stepHumanCombat,startHumanAid,stepPlayerHumanAid,killHuman} from '../src/game/humanworld';
import {humanEntityTile,moveHumanGoods} from '../src/game/human-jobs';
import {validate} from '../src/game/persist';
import {T0} from './helpers/g1b-kit';
import {TILE,type Entity} from '../src/game/core';
function scene(){setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);return gs;}
describe('physical housing and production rights',()=>{
 it('cargo moves the same UID once and a full destination restores the original source slot',()=>{
  const gs=scene(),r=gs.run!,h=Object.values(r.humanWorld!.people)[0];
  const o=r.sourceMap!.veyra!.originAu;
  h.gx=Math.round(o[0]/.5)+Math.floor(r.player.x/TILE);h.gy=Math.round(o[1]/.5)+Math.floor(r.player.y/TILE);h.floor=r.veyraFloor??0;h.following=true;h.state='IDLE';
  const cart=C(r,h.inv.cartId),inv=C(r,'inv');cart.slots.fill(null);
  const stack=inv.slots.find(s=>s&&!s.production)!;const slot=inv.slots.indexOf(stack),uid=stack.uid;
  const send=(direction:'return'|'load',id:string)=>dispatch(gs,{type:'humanCargo',actorId:h.actorId,direction,stackUid:uid,id} as any,T0+100);
  expect(send('load','cargo-load').ok).toBe(true);expect(inv.slots[slot]).toBeNull();expect(cart.slots.filter(s=>s?.uid===uid)).toHaveLength(1);
  expect(send('return','cargo-return').ok).toBe(true);expect(inv.slots.some(s=>s?.uid===uid)).toBe(true);expect(cart.slots.some(s=>s?.uid===uid)).toBe(false);
  for(let i=0;i<cart.slots.length;i++)cart.slots[i]=mkStack(r,'knife',1);
  const before=JSON.stringify(inv.slots);expect(send('load','cargo-full').ok).toBe(false);expect(JSON.stringify(inv.slots)).toBe(before);
 });
 it('beds are unique real furniture, never custody chests; shortages do not mint or remove people',()=>{
  const gs=scene(),r=gs.run!,hw=r.humanWorld!,assigned=Object.values(hw.people).filter(h=>h.bedId);
  expect(assigned.length).toBeGreaterThan(0);
  expect(new Set(assigned.map(h=>h.bedId)).size).toBe(assigned.length);
  for(const h of assigned){const bed=findRunEntity(r,h.bedId)!;expect(bed.type).toBe('bed_straw');expect(bed.owner).toBe(h.community);expect(r.custody[h.bedId!]).toBeUndefined();}
  expect(Object.values(hw.people).some(h=>!h.bedId)).toBe(true);
  expect(validate(JSON.parse(JSON.stringify(gs)))).not.toBeNull();
 });
 it('same offscreen bed grants rest only beside its own physical enclosed slot; loss, floor, duplicate assignment deny it',()=>{
  const r=scene().run!,hw=r.humanWorld!;
  const h=Object.values(hw.people).find(h=>h.bedId&&r.veyraOffscreenEntities?.[h.bedId])!;
  expect(h).toBeTruthy();const bed=findRunEntity(r,h.bedId)!,[gx,gy]=humanEntityTile(r,bed);
  h.gx=gx-1;h.gy=gy;h.floor=bed.floor??0;h.state='IDLE';
  // Pick a genuinely enclosed neighbor, not a magic community radius.
  const adjacent=[[gx-1,gy],[gx+1,gy],[gx,gy-1],[gx,gy+1]].find(([x,y])=>{h.gx=x;h.gy=y;return usingHumanBed(r,hw,h);});
  expect(adjacent).toBeTruthy();expect(usingHumanBed(r,hw,h)).toBe(true);
  const loaded=JSON.parse(JSON.stringify(r)),lh=loaded.humanWorld.people[h.actorId];expect(usingHumanBed(loaded,loaded.humanWorld,lh)).toBe(true);
  lh.floor=2;expect(usingHumanBed(loaded,loaded.humanWorld,lh)).toBe(false);lh.floor=h.floor;
  loaded.veyraOffscreenEntities[bed.id].hp=0;expect(usingHumanBed(loaded,loaded.humanWorld,lh)).toBe(false);
  const other=Object.values(hw.people).find(q=>q!==h)!;other.bedId=bed.id;expect(usingHumanBed(r,hw,h)).toBe(false);
 });
 it('old fake chest entitlement is removed idempotently without deleting its goods',()=>{
  const gs=scene(),r=gs.run!,h=Object.values(r.humanWorld!.people)[0],c=mkContainer(r,'chest',4);addItem(r,c.id,'wood',2);
  const comm=r.humanWorld!.communities[h.community!];comm.homeBeds.push(c.id);h.bedId=c.id;
  const loaded=validate(JSON.parse(JSON.stringify(gs)))!;expect(loaded).toBeTruthy();
  expect(loaded.run!.humanWorld!.people[h.actorId].bedId).toBeUndefined();
  expect(loaded.run!.humanWorld!.communities[comm.id].legacyHouseholdContainers).toContain(c.id);
  expect(C(loaded.run!,c.id).slots[0]?.qty).toBe(2);expect(validate(JSON.parse(JSON.stringify(loaded)))).not.toBeNull();
 });
 it('shared production never merges worker outputs with player output and only matching claim can collect',()=>{
  const gs=scene(),r=gs.run!,h=Object.values(r.humanWorld!.people)[0],other=Object.values(r.humanWorld!.people)[1];
  const e:Entity={id:'test-station',kind:'struct',type:'campfire',x:1608,y:1608,station:{burn:30000,queue:[],fuelC:mkContainer(r,'fuel',3).id,outC:mkContainer(r,'out',6).id}};r.entities[e.id]=e;
  C(r,h.inv.packId).slots.fill(null);addItem(r,h.inv.packId,'meat',1);addItem(r,'inv','meat',1);
  addItem(r,e.station!.outC,'cooked_meat',2);const publicUid=C(r,e.station!.outC).slots[0]!.uid;
  const npcJob=queuePaidRecipe(r,e,h.inv.packId,'cooked_meat',h.actorId);expect(npcJob.ok).toBe(true);
  expect(queuePaidRecipe(r,e,'inv','cooked_meat').ok).toBe(true);stepStations(gs,20000,T0+20000);
  const output=C(r,e.station!.outC);expect(output.slots.find(s=>s?.uid===publicUid)?.qty).toBe(3);
  const claimed=output.slots.find(s=>s?.production)!;expect(claimed.production).toEqual({jobId:npcJob.jobId,workerId:h.actorId});
  expect(moveHumanGoods(r,e.station!.outC,other.inv.packId,'cooked_meat',5,{jobId:npcJob.jobId!,workerId:other.actorId})).toBe(0);
  expect(moveHumanGoods(r,e.station!.outC,h.inv.packId,'cooked_meat',5,{jobId:npcJob.jobId!,workerId:h.actorId})).toBe(1);
  expect(C(r,h.inv.packId).slots.find(s=>s?.uid===claimed.uid)?.production).toBeUndefined();
  expect(moveHumanGoods(r,e.station!.outC,h.inv.packId,'cooked_meat',5,{jobId:npcJob.jobId!,workerId:h.actorId})).toBe(0);
  expect(output.slots.find(s=>s?.uid===publicUid)?.qty).toBe(3);
 });
 it('neutral refusal is stable across fresh order IDs; same committed order cannot change after injury/reload',()=>{
  const r=scene().run!,hw=r.humanWorld!,h=Object.values(hw.people)[0],target=Object.values(hw.people).find(p=>p.community!==h.community)!;
  h.following=true;h.disposition='neutral';h.gx=target.gx-1;h.gy=target.gy;h.floor=target.floor;
  // A hidden target cannot create attack knowledge, regardless of order identity.
  const a=resolveOrder(r,hw,h,'order-a','engage',T0,target.actorId),b=resolveOrder(r,hw,h,'order-b','engage',T0+1,target.actorId);
  expect(a.result).toBe(b.result);expect(a.reason).toBe(b.reason);
  h.state='DOWNED';const loaded=JSON.parse(JSON.stringify(r));
  expect(resolveOrder(loaded,loaded.humanWorld,loaded.humanWorld.people[h.actorId],'order-a','engage',T0+2,target.actorId)).toEqual(a);
  expect(resolveOrder(loaded,loaded.humanWorld,loaded.humanWorld.people[h.actorId],'order-c','engage',T0+2,target.actorId).result).toBe('CANNOT_EXECUTE');
 });
 it('timed aid pays once, grants bounded useful trust, and cancels on movement without a debit',()=>{
  const r=scene().run!,hw=r.humanWorld!,h=Object.values(hw.people)[0];
  const o=r.sourceMap!.veyra!.originAu,ox=Math.round(o[0]/.5),oy=Math.round(o[1]/.5),grid=blockGrid(r);
  let cell=grid.findIndex((n,i)=>n===0&&i%200>10&&Math.floor(i/200)>10);
  h.gx=ox+cell%200;h.gy=oy+Math.floor(cell/200);h.floor=0;h.state='IDLE';h.hunger=10;h.thirst=10;h.trust=50;
  r.player.x=(cell%200+.5)*16;r.player.y=(Math.floor(cell/200)+.5)*16;
  const food=C(r,'inv').slots.find(s=>s?.key==='berries')!,water=C(r,'inv').slots.find(s=>s?.key==='water_flask')!;
  const before=food.qty;
  expect(startHumanAid(r,hw,h,'aid-food',food.uid,T0).ok).toBe(true);
  stepPlayerHumanAid(r,hw,T0+1000);expect(food.qty).toBe(before);
  stepPlayerHumanAid(r,hw,T0+1500);expect(food.qty).toBe(before-1);expect(h.trust).toBe(53);
  stepPlayerHumanAid(r,hw,T0+1500);expect(food.qty).toBe(before-1);
  expect(startHumanAid(r,hw,h,'aid-water',water.uid,T0+2000).ok).toBe(true);
  const loaded=JSON.parse(JSON.stringify(r)),lh=loaded.humanWorld.people[h.actorId];
  stepPlayerHumanAid(loaded,loaded.humanWorld,T0+3500);expect(lh.trust).toBe(56);
  const charge=water.charge!;stepPlayerHumanAid(r,hw,T0+3500);expect(water.charge).toBe(charge-1);
  h.hunger=10;expect(startHumanAid(r,hw,h,'aid-repeat',food.uid,T0+4000).ok).toBe(true);
  r.player.x+=32;stepPlayerHumanAid(r,hw,T0+5500);expect(food.qty).toBe(before-1);expect(hw.playerAid).toBeUndefined();
 });
 it('hold cancels walking and work; follow restores real intent; carried cargo enters one corpse only',()=>{
  const r=scene().run!,hw=r.humanWorld!,h=Object.values(hw.people)[0];h.following=true;h.state='MOVING';
  h.motion={fromGx:h.gx,fromGy:h.gy,toGx:h.gx+1,toGy:h.gy,elapsedMs:2};
  expect(commandHuman(r,hw,h,'cmd-hold','hold',T0).ok).toBe(true);expect(h.intent).toBeUndefined();expect(h.motion).toBeUndefined();expect(h.state).toBe('IDLE');
  expect(commandHuman(r,hw,h,'cmd-follow','follow',T0+1).ok).toBe(true);expect(h.intent?.kind).toBe('follow');
  C(r,h.inv.cartId).slots[0]=mkStack(r,'wood',4);const uid=C(r,h.inv.cartId).slots[0]!.uid;
  killHuman(r,hw,h,T0+2,'test');killHuman(r,hw,h,T0+3,'test');
  expect(Object.values(r.custody).flatMap(c=>c.slots).filter(s=>s?.uid===uid)).toHaveLength(1);
  expect(C(r,h.inv.cartId).slots.every(s=>!s)).toBe(true);
 });

});
