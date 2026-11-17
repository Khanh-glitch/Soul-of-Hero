import {it,expect} from 'vitest';
import {newGame,startRun,mkContainer,addItem,C,stepStations} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {executeHumanWork} from '../src/game/human-jobs';
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
 const outputs=()=>C(r,h.inv.packId).slots.filter(s=>s?.key==='cooked_meat').reduce((n,s)=>n+s!.qty,0);
 expect(outputs()).toBe(1);expect(executeHumanWork(r,hw,h,T0+20000).done).toBe(false);expect(outputs()).toBe(1);
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
