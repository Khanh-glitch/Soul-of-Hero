import {it,expect} from 'vitest';
import {newGame,startRun,mkContainer,mkStack,findRunEntity,addItem,C,stepStations,queuePaidRecipe} from '../src/game/engine';
import {depositHumanOutputs,humanConsume,setFollowing,stepHumans} from '../src/game/humanworld';
import {humanEntityTile} from '../src/game/human-jobs';
import {humanNavigation} from '../src/game/human-navigation';
import {ITEMS} from '../src/game/catalog';
import {validate} from '../src/game/persist';
import {setActiveLayout} from '../src/game/world';
import {moveHumanGoods,executeHumanWork} from '../src/game/human-jobs';
import {T0} from './helpers/g1b-kit';
import type {Entity} from '../src/game/core';
it('cook spends carried canonical inputs and fuel, waits for real station, and collects once across reload',()=>{
 setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 let r=gs.run!,hw=r.humanWorld!,h=Object.values(hw.people)[0];
 const o=r.sourceMap!.veyra!.originAu;h.gx=Math.round(o[0]/.5)+100;h.gy=Math.round(o[1]/.5)+100;h.floor=0;h.occupation='cook';h.knownRecipes=['cooked_meat'];
 C(r,h.inv.packId).slots.fill(null);addItem(r,h.inv.packId,'meat',1);addItem(r,h.inv.packId,'wood',2);
 const e:Entity={id:'work-test',kind:'struct',type:'campfire',tx:101,ty:100,x:1624,y:1608,station:{queue:[],burn:0,fuelC:mkContainer(r,'fuel',3).id,outC:mkContainer(r,'out',6).id}};
 r.entities[e.id]=e;hw.communities[h.community!].workStations.push(e.id);
 h.intent={intentId:'cook-test',actorId:h.actorId,kind:'work',target:e.id,preconditions:[],reserved:[],startAt:T0,dueAt:T0,work:{kind:'cook',phase:'act',entityId:e.id,inputs:[['meat',1]],recipe:'cooked_meat',duration:1000,outputs:[['cooked_meat',1]]}};h.state='WORKING';
 expect(executeHumanWork(r,hw,h,T0).reason).toBe('machine running');expect(e.station!.queue).toHaveLength(1);
 expect(C(r,h.inv.packId).slots.some(s=>s?.key==='meat')).toBe(false);
 r=JSON.parse(JSON.stringify(r));hw=r.humanWorld!;h=hw.people[h.actorId];
 gs.run=r;stepStations(gs,10000,T0+10000);
 expect(h.intent!.work!.readyAt).toBeDefined();
 expect(executeHumanWork(r,hw,h,T0+10001).done).toBe(true);
 const cooked=C(r,h.inv.packId).slots.find(s=>s?.key==='cooked_meat')!;expect(cooked.production).toMatchObject({jobId:h.intent?.work?.machineJobId??cooked.production!.jobId,workerId:h.actorId,recipe:'cooked_meat',stationId:e.id});expect(cooked.production!.inputs?.[0]).toMatchObject({key:'meat',qty:1,containerId:h.inv.packId});
 expect(moveHumanGoods(r,h.inv.packId,r.entities[e.id].station!.outC,'cooked_meat',1,{jobId:cooked.production!.jobId,workerId:'another-worker'})).toBe(0);
 const outputs=()=>C(r,h.inv.packId).slots.filter(s=>s?.key==='cooked_meat').reduce((n,s)=>n+s!.qty,0);
 expect(outputs()).toBe(1);expect(executeHumanWork(r,hw,h,T0+20000).done).toBe(false);expect(outputs()).toBe(1);
 // Controlled continuation, NOT a natural New Game proof: reach the actual
 // authored community warehouse, reject full capacity, reload and retry.
 const comm=hw.communities[h.community!],store=findRunEntity(r,comm.storeEntityId)!,dst=C(r,store.c!);
 const receiver=mkStack(r,'cooked_meat',ITEMS.cooked_meat.max);dst.slots=[receiver];
 const [gx,gy]=humanEntityTile(r,store),nav=humanNavigation(r),bank=[[gx+1,gy],[gx-1,gy],[gx,gy+1],[gx,gy-1]].find(([tx,ty])=>nav.free({tx,ty,floor:store.floor??0},h,true))!;
 h.gx=bank[0];h.gy=bank[1];h.floor=store.floor??0;h.state='IDLE';h.hunger=0;
 expect(humanConsume(r,hw,h,'food',T0+20001)).toBe(true); // warehouse meal, NOT owned output
 expect(outputs()).toBe(1);receiver.qty=ITEMS.cooked_meat.max;
 depositHumanOutputs(r,h,T0+20002);expect(h.deliveryWait?.containerId).toBe(store.c);expect(h.nextThinkAt).toBe(Number.MAX_SAFE_INTEGER);expect(outputs()).toBe(1);expect(cooked.production?.workerId).toBe(h.actorId);
 const restored=validate(JSON.parse(JSON.stringify(gs)));expect(restored).not.toBeNull();gs.run=restored!.run;r=gs.run!;hw=r.humanWorld!;h=hw.people[h.actorId];
 h.hunger=100;C(r,store.c!).slots[0]!.qty--;stepHumans(r,hw,T0+20003);expect(h.deliveryWait).toBeUndefined();expect(outputs()).toBe(0);
 const history=Object.values(hw.communities[h.community!].cargoLedger!).flat();expect(history).toHaveLength(1);expect(history[0]).toMatchObject({fromUid:cooked.uid,intoUid:receiver.uid,workerId:h.actorId,recipe:'cooked_meat',qty:1,stationId:e.id});expect(history[0].sourceId).toBeUndefined();expect(history[0].inputs?.[0]).toMatchObject({key:'meat',qty:1});
 const before=JSON.stringify(r.custody);depositHumanOutputs(r,h,T0+20003);expect(JSON.stringify(r.custody)).toBe(before);
 h.hunger=0;const prior=C(r,store.c!).slots[0]!.qty;humanConsume(r,hw,h,'food',T0+20004);expect(C(r,store.c!).slots[0]!.qty).toBe(prior-1);

});

it('occupation planning carries the real station floor; denied route and wrong-floor work never pay or mint',async()=>{
 const {planHumanOccupation}=await import('../src/game/human-jobs');
 setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!,h=Object.values(hw.people)[0];h.floor=0;h.occupation='cook';h.knownRecipes=['cooked_meat'];h.following=false;h.intent=undefined;
 C(r,h.inv.packId).slots.fill(null);addItem(r,h.inv.packId,'meat',1);addItem(r,h.inv.packId,'wood',2);
 const e:Entity={id:'upper-floor-test-station',kind:'struct',type:'campfire',floor:1,tx:101,ty:100,x:1624,y:1608,station:{queue:[],burn:30000,fuelC:mkContainer(r,'fuel',3).id,outC:mkContainer(r,'out',6).id}};
 r.entities[e.id]=e;hw.communities[h.community!].workStations.push(e.id);
 const before=JSON.stringify(C(r,h.inv.packId));let seenFloor:number|undefined;
 expect(planHumanOccupation(r,hw,h,T0,(_x,_y,floor)=>{if(floor===1)seenFloor=floor;return null;})).toBe(false);
 expect(seenFloor).toBe(1);expect(h.intent).toBeUndefined();expect(JSON.stringify(C(r,h.inv.packId))).toBe(before);
 // Route seam fixture only: real stair/admission execution has separate tests.
 expect(planHumanOccupation(r,hw,h,T0,(x,y,floor)=>floor===1?[{tx:x,ty:y-1,floor}]:null)).toBe(true);
 expect(h.intent!.work!.entityId).toBe(e.id);expect(h.intent!.route![0].floor).toBe(1);
 h.state='WORKING'; // Forged arrival must still fail the executor's physical gate.
 expect(executeHumanWork(r,hw,h,T0+5000).done).toBe(false);expect(e.station!.queue).toHaveLength(0);expect(JSON.stringify(C(r,h.inv.packId))).toBe(before);
});


it('controlled authored campfire pauses on exhausted fuel across reload and keeps a recruited worker claim exclusive',()=>{
 setActiveLayout('veyra05-greywater');let gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 let r=gs.run!,hw=r.humanWorld!,h=Object.values(hw.people).find(h=>h.occupation==='cook')!,comm=hw.communities[h.community!],e=comm.workStations.map(id=>findRunEntity(r,id)!).find(e=>e.type==='campfire')!;
 // Negative transaction fixture: actual authored station, explicitly seeded bill.
 C(r,h.inv.packId).slots.fill(null);addItem(r,h.inv.packId,'berries',5);addItem(r,h.inv.packId,'tin_can',1);addItem(r,e.station!.fuelC,'wood',1);
 const inputBefore=JSON.stringify(C(r,h.inv.packId));C(r,e.station!.outC).slots=[mkStack(r,'stone',60)];expect(queuePaidRecipe(r,e,h.inv.packId,'fruit_wine',h.actorId,T0).ok).toBe(false);expect(JSON.stringify(C(r,h.inv.packId))).toBe(inputBefore);
 C(r,e.station!.outC).slots=[null];const paid=queuePaidRecipe(r,e,h.inv.packId,'fruit_wine',h.actorId,T0);expect(paid.ok).toBe(true);expect(C(r,h.inv.packId).slots.every(s=>s===null)).toBe(true);
 setFollowing(r,hw,h,true,T0+1);stepStations(gs,30000,T0+30000);expect(e.station!.queue[0].left).toBe(10000);expect(C(r,e.station!.outC).slots[0]).toBeNull();expect(e.station!.burn).toBe(0);
 const loaded=validate(JSON.parse(JSON.stringify(gs)));expect(loaded).not.toBeNull();gs=loaded!;r=gs.run!;hw=r.humanWorld!;h=hw.people[h.actorId];e=findRunEntity(r,e.id)!;
 stepStations(gs,30000,T0+60000);expect(e.station!.queue[0].left).toBe(10000);addItem(r,e.station!.fuelC,'wood',1);stepStations(gs,10000,T0+70000);expect(e.station!.queue).toHaveLength(0);
 const out=C(r,e.station!.outC).slots[0]!;expect(out.production).toMatchObject({jobId:paid.jobId,workerId:h.actorId,recipe:'fruit_wine'});
 expect(moveHumanGoods(r,e.station!.outC,h.inv.packId,out.key,1)).toBe(0);expect(moveHumanGoods(r,e.station!.outC,h.inv.packId,out.key,1,{jobId:paid.jobId!,workerId:'other'})).toBe(0);
 expect(moveHumanGoods(r,e.station!.outC,h.inv.packId,out.key,1,{jobId:paid.jobId!,workerId:h.actorId})).toBe(1);expect(C(r,h.inv.packId).slots[0]!.uid).toBe(out.uid);expect(C(r,h.inv.packId).slots[0]!.production?.jobId).toBe(paid.jobId);
 expect(moveHumanGoods(r,e.station!.outC,h.inv.packId,out.key,1,{jobId:paid.jobId!,workerId:h.actorId})).toBe(0);
});
it('recovered paid job physically fetches fuel without paying recipe inputs twice; missing station releases the actor',async()=>{
 const {planHumanOccupation}=await import('../src/game/human-jobs');
 setActiveLayout('veyra05-greywater');let gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 let r=gs.run!,hw=r.humanWorld!,h=hw.people.h1,comm=hw.communities[h.community!],e=comm.workStations.map(id=>findRunEntity(r,id)!).find(e=>e.type==='campfire')!;
 // Controlled bill; actual authored station and finite original warehouse fuel.
 C(r,h.inv.packId).slots.fill(null);addItem(r,h.inv.packId,'berries',5);addItem(r,h.inv.packId,'tin_can',1);addItem(r,e.station!.fuelC,'wood',1);
 const paid=queuePaidRecipe(r,e,h.inv.packId,'fruit_wine',h.actorId,T0);expect(paid.ok).toBe(true);stepStations(gs,30000,T0+30000);expect(e.station!.queue[0].left).toBe(10000);
 const store=findRunEntity(r,comm.storeEntityId)!,[sx,sy]=humanEntityTile(r,store);h.gx=sx+1;h.gy=sy;h.floor=store.floor??0;h.state='IDLE';h.intent=undefined;
 const originalFuel=C(r,store.c!).slots.filter(s=>s?.key==='charcoal').reduce((n,s)=>n+s!.qty,0);
 expect(planHumanOccupation(r,hw,h,T0+30001,()=>[])).toBe(true);expect(h.intent!.work!.phase).toBe('fetch');expect(executeHumanWork(r,hw,h,T0+32001).done).toBe(false);expect(h.intent!.work!.phase).toBe('machine');expect(C(r,store.c!).slots.filter(s=>s?.key==='charcoal').reduce((n,s)=>n+s!.qty,0)).toBe(originalFuel-1);
 const [gx,gy]=humanEntityTile(r,e),nav=humanNavigation(r),p=[[gx+1,gy],[gx-1,gy],[gx,gy+1],[gx,gy-1]].find(([tx,ty])=>nav.free({tx,ty,floor:e.floor??0},h,true))!;h.gx=p[0];h.gy=p[1];h.floor=e.floor??0;
 expect(planHumanOccupation(r,hw,h,T0+32002,()=>[])).toBe(true);executeHumanWork(r,hw,h,T0+34002);expect(e.station!.queue).toHaveLength(1);expect(e.station!.queue[0].id).toBe(paid.jobId);expect(e.station!.queue[0].left).toBe(10000);
 stepStations(gs,10000,T0+44002);expect(executeHumanWork(r,hw,h,T0+44003).done).toBe(true);expect(C(r,h.inv.packId).slots.find(s=>s?.key==='fruit_wine')?.production?.jobId).toBe(paid.jobId);
 // A subsequently destroyed target must not leave an immortal WORKING intent.
 h.intent={intentId:'lost-station',actorId:h.actorId,kind:'work',preconditions:[],reserved:[],startAt:T0,dueAt:T0,work:{kind:'cook',phase:'act',entityId:e.id,inputs:[],duration:1,recipe:'jam'}};h.state='WORKING';e.hp=0;
 expect(executeHumanWork(r,hw,h,T0+45000).done).toBe(false);expect(h.state).toBe('IDLE');expect(h.intent).toBeUndefined();
});

it('missing or claimed recipe inputs and two cooks competing for one bill never double debit across reload',()=>{
 setActiveLayout('veyra05-greywater');let gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 let r=gs.run!;const hw=r.humanWorld!,h=Object.values(hw.people).find(h=>h.occupation==='cook')!,comm=hw.communities[h.community!];
 const stationId=comm.workStations.find(id=>findRunEntity(r,id)?.type==='campfire')!;
 let e=findRunEntity(r,stationId)!;
 // Explicit transaction fixture, not natural supply: one canonical jam bill.
 const cid=h.inv.packId;C(r,cid).slots.fill(null);C(r,e.station!.outC).slots.fill(null);
 addItem(r,cid,'berries',10);addItem(r,cid,'cloth',1);
 const missing=JSON.stringify([C(r,cid),e.station]);
 expect(queuePaidRecipe(r,e,cid,'jam',h.actorId,T0).ok).toBe(false);
 expect(JSON.stringify([C(r,cid),e.station])).toBe(missing);
 addItem(r,cid,'tin_can',1);const tin=C(r,cid).slots.find(s=>s?.key==='tin_can')!;
 tin.production={jobId:'fixture-existing-claim',workerId:'another-worker'};
 const claimed=JSON.stringify([C(r,cid),e.station]);
 expect(queuePaidRecipe(r,e,cid,'jam',h.actorId,T0+1).ok).toBe(false);
 expect(JSON.stringify([C(r,cid),e.station])).toBe(claimed);delete tin.production;
 const uid=tin.uid,first=queuePaidRecipe(r,e,cid,'jam',h.actorId,T0+2);expect(first.ok).toBe(true);
 expect(e.station!.queue).toHaveLength(1);expect(e.station!.queue[0].inputProvenance?.find(s=>s.key==='tin_can')).toMatchObject({uid,qty:1,containerId:cid});
 gs=validate(JSON.parse(JSON.stringify(gs)))!;expect(gs).toBeTruthy();r=gs.run!;e=findRunEntity(r,stationId)!;
 const once=JSON.stringify([C(r,cid),e.station]);
 expect(queuePaidRecipe(r,e,cid,'jam','second-cook',T0+3).ok).toBe(false);
 expect(queuePaidRecipe(r,e,cid,'jam',h.actorId,T0+3).ok).toBe(false);
 expect(JSON.stringify([C(r,cid),e.station])).toBe(once);
 expect(e.station!.queue[0].id).toBe(first.jobId);
});
it('mechanic never spends a reserved delivery lot; the paid repair records the material UIDs and original tool',()=>{
 setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!,h=Object.values(hw.people).find(p=>p.occupation==='mechanic')!,o=r.sourceMap!.veyra!.originAu;
 h.gx=o[0]*2+100;h.gy=o[1]*2+100;h.floor=0;
 const e:Entity={id:'test-bench',kind:'struct',type:'workbench',tx:101,ty:100,x:1624,y:1608,station:{burn:0,queue:[],fuelC:mkContainer(r,'fuel',1).id,outC:mkContainer(r,'out',1).id}};
 r.entities[e.id]=e;hw.communities[h.community!].workStations.push(e.id);
 const tool=mkStack(r,'wood_club',1);tool.dur=1;h.equip.weapon=tool;
 const pack=C(r,h.inv.packId);pack.slots.fill(null);const held=mkStack(r,'wood',9);held.production={workerId:h.actorId,jobId:'other-delivery'};pack.slots[0]=held;
 const assignment=()=>{h.state='WORKING';h.intent={intentId:'local-repair',kind:'work',actorId:h.actorId,reserved:[],preconditions:[],startAt:T0,dueAt:T0,work:{kind:'repair_item',phase:'act',inputs:[['wood',3]],duration:8000,entityId:e.id,itemUid:tool.uid}};};
 assignment();expect(executeHumanWork(r,hw,h,T0+8000).done).toBe(false);expect(tool.dur).toBe(1);expect(held.qty).toBe(9);
 const free=mkStack(r,'wood',3);pack.slots[1]=free;assignment();expect(executeHumanWork(r,hw,h,T0+16000).done).toBe(true);
 expect(tool.dur).toBe(ITEMS.wood_club.dur);expect(held.qty).toBe(9);expect(pack.slots[1]).toBeNull();expect(JSON.parse(r.receipts.find(q=>q.kind==='human.maintenance')!.detail)).toMatchObject({worker:h.actorId,item:tool.uid,before:1,inputs:[{uid:free.uid,qty:3}]});
});
it('treats a conscious injured resident without dismissing their work; treating twice does not spend twice',()=>{
 setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!,h=Object.values(hw.people).find(p=>p.occupation==='medic')!,p=Object.values(hw.people).find(p=>p.community===h.community&&p!==h)!;
 p.floor=h.floor;p.gx=h.gx;p.gy=h.gy;p.state='WORKING';p.hp=p.maxHp-20;p.wounds=[{severity:1,bleeding:true,treated:false}];
 const dose=mkStack(r,'bandage',2);C(r,h.inv.packId).slots.fill(null);C(r,h.inv.packId).slots[0]=dose;
 const assign=()=>{h.state='WORKING';h.intent={intentId:'dress-wound',actorId:h.actorId,kind:'work',startAt:T0,dueAt:T0+6000,preconditions:[],reserved:[],work:{kind:'medical',phase:'act',duration:6000,inputs:[['bandage',1]],patientId:p.actorId}};};
 assign();expect(executeHumanWork(r,hw,h,T0+5999).done).toBe(false);expect(dose.qty).toBe(2);
 expect(executeHumanWork(r,hw,h,T0+6000).done).toBe(true);expect(p.state).toBe('WORKING');expect(p.wounds[0]).toMatchObject({treated:true,bleeding:false});expect(dose.qty).toBe(1);
 assign();expect(executeHumanWork(r,hw,h,T0+12000).done).toBe(false);expect(dose.qty).toBe(1);
});
