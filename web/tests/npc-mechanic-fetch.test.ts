import {it,expect} from 'vitest';
import {newGame,startRun,findRunEntity,C,mkStack} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {planHumanOccupation,humanEntityTile,executeHumanWork,humanCanUseEntity} from '../src/game/human-jobs';
import {T0} from './helpers/g1b-kit';

it('rechecks the held tool, workbench and complete repair bill before withdrawing any warehouse lot',()=>{
 setActiveLayout('veyra05-world');const gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!;
 const comm=Object.values(hw.communities).find(c=>c.memberIds.some(id=>hw.people[id].occupation==='mechanic') && c.workStations.some(id=>findRunEntity(r,id)?.type==='workbench') && c.storeContainers.some(id=>C(r,id).slots.some(s=>s?.key==='stone')&&C(r,id).slots.some(s=>s?.key==='wood')))!;
 const h=comm.memberIds.map(id=>hw.people[id]).find(h=>h.occupation==='mechanic')!,tool=h.equip.weapon!;
 const store=findRunEntity(r,comm.storeEntityId)!,stock=C(r,store.c!),pack=C(r,h.inv.packId);
 const [gx,gy]=humanEntityTile(r,store);h.gx=gx;h.gy=gy+1;h.floor=store.floor??0;expect(humanCanUseEntity(r,h,store)).toBe(true);
 // A search slice is neither movement nor a reservation. Retain a pending
 // target, but release it on proof of failure with both inventories untouched.
 const original=JSON.stringify([pack,stock]);
 expect(planHumanOccupation(r,hw,h,T0,(x,y,floor)=>{h.routeSearch={target:`${floor}:${x},${y}`,status:'PENDING_SEARCH',expanded:256};return null;})).toBe(true);
 expect(h.state).toBe('IDLE');expect(h.intent?.work?.phase).toBe('fetch');expect(h.intent?.route).toEqual([]);
 expect(executeHumanWork(r,hw,h,T0+1000).done).toBe(false);
 expect(planHumanOccupation(r,hw,h,T0+3000,(x,y,floor)=>{h.routeSearch={target:`${floor}:${x},${y}`,status:'NO_PATH',expanded:261};return null;})).toBe(false);
 expect(h.intent).toBeUndefined();expect(JSON.stringify([pack,stock])).toBe(original);
 const plan=()=>{expect(planHumanOccupation(r,hw,h,T0,()=>[])).toBe(true);expect(h.intent?.work).toMatchObject({kind:'repair_item',phase:'fetch',itemUid:tool.uid});return findRunEntity(r,h.intent!.work!.entityId)!;};
 const refused=()=>{const before=JSON.stringify([stock,pack,tool,r.nextId]);expect(executeHumanWork(r,hw,h,T0+1000).done).toBe(false);expect(h.intent).toBeUndefined();expect(JSON.stringify([stock,pack,tool,r.nextId])).toBe(before);};
 plan();const wood=stock.slots.find(s=>s?.key==='wood')!;wood.production={jobId:'j1',workerId:h.actorId};refused();delete wood.production;
 const bench=plan(),owner=bench.owner;bench.owner='player';refused();bench.owner=owner;
 plan();const dur=tool.dur;tool.dur=180;refused();tool.dur=dur;
 plan();for(let i=0;i<pack.slots.length-1;i++)pack.slots[i]=mkStack(r,'berries',1);pack.slots[pack.slots.length-1]=null;refused();
 expect(r.receipts.some(e=>e.kind==='human.work.input')).toBe(false);
},30000);
