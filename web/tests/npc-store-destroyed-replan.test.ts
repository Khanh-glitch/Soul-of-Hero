import {RECIPES} from "../src/game/catalog";
import {expect,it} from 'vitest';
import {findRunEntity,newGame,startRun,mkStack,destroyStructure} from '../src/game/engine';
import {humanNavigation} from '../src/game/human-navigation';
import {humanCanUseEntity,planHumanOccupation,humanEntityTile,executeHumanWork} from '../src/game/human-jobs';
import {stepHumans} from '../src/game/humanworld';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';
function ruin(){setActiveLayout('veyra05-greywater');const gs=newGame();startRun(gs,'female',T0,null,7606,{tx:100,ty:100});const r=gs.run!,hw=r.humanWorld!,h=Object.values(hw.people).find(h=>h.occupation==='builder')!,comm=hw.communities[h.community!],store=findRunEntity(r,comm.storeEntityId)!;store.hp=0;const nav=humanNavigation(r);const plan=()=>planHumanOccupation(r,hw,h,T0+100,(tx,ty,floor)=>nav.route(h,{tx,ty,floor},4000));return {r,hw,h,store,plan};}
it('braces the collapsed store on site with two real carried wood; same custody reopens',()=>{const {r,hw,h,store,plan}=ruin(),wood=r.custody[h.inv.packId].slots.find(s=>s?.key==='wood')!,before=wood.qty,contents=JSON.stringify(r.custody[store.c!]);expect(humanCanUseEntity(r,h,store)).toBe(false);expect(plan()).toBe(true);expect(h.intent?.work?.entityId).toBe(store.id);
 for(let i=1;i<200&&store.hp===0;i++)stepHumans(r,hw,T0+i*2000);expect(store.hp).toBe(store.maxHp);expect(wood.qty).toBe(before-2);expect(humanCanUseEntity(r,h,store)).toBe(true);expect(JSON.stringify(r.custody[store.c!])).toBe(contents);expect(r.receipts.some(q=>q.kind==='human.store.rebuilt')).toBe(true);},90000);
it('no wood or a lost load means no reconstruction and no phantom stock',()=>{const {r,hw,h,store,plan}=ruin();const pack=r.custody[h.inv.packId];expect(plan()).toBe(true);pack.slots[pack.slots.findIndex(s=>s?.key==='wood')]=null;const before=JSON.stringify(r.custody[store.c!]);for(let i=1;i<200&&h.intent?.work?.entityId===store.id;i++)stepHumans(r,hw,T0+i*2000);expect(store.hp).toBe(0);expect(h.lastWorkBlock).toMatch(/wood/);expect(JSON.stringify(r.custody[store.c!])).toBe(before);},90000);
it('rebuilds a destroyed registered kitchen from the canonical bill, not its old fuel or outputs',()=>{
 setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!,comm=Object.values(hw.communities).find(c=>c.workStations.some(id=>findRunEntity(r,id)?.type==='campfire')&&c.memberIds.some(id=>hw.people[id].occupation==='builder'))!;
 const builder=comm.memberIds.map(id=>hw.people[id]).find(p=>p.occupation==='builder')!,old=comm.workStations.map(id=>findRunEntity(r,id)).find(e=>e?.type==='campfire')!;
 const out=old.station!.outC, fuel=old.station!.fuelC, bill=RECIPES.deploy_campfire.ins,goods=r.custody[builder.inv.packId];goods.slots.fill(null);
 for(const [i,[k,q]] of bill.entries())goods.slots[i]=mkStack(r,k,q);
 const [tx,ty]=humanEntityTile(r,old);destroyStructure(r,old,T0);expect(comm.lostWorksites?.[old.id]).toMatchObject({tx,ty,type:'campfire'});
 const nav=humanNavigation(r),neighbor=[[tx+1,ty],[tx-1,ty],[tx,ty+1],[tx,ty-1]].find(([x,y])=>nav.free({tx:x,ty:y,floor:0},builder,true))!;
 builder.gx=neighbor[0];builder.gy=neighbor[1];builder.floor=0;
 expect(planHumanOccupation(r,hw,builder,T0+1,(tx,ty,floor)=>nav.route(builder,{tx,ty,floor}))).toBe(true);expect(builder.intent?.work?.rebuildSite).toBe(old.id);
 const saved=goods.slots[0];goods.slots[0]=null;expect(executeHumanWork(r,hw,builder,T0+10000).done).toBe(false);expect(comm.lostWorksites?.[old.id]).toBeTruthy();goods.slots[0]=saved;
 expect(planHumanOccupation(r,hw,builder,T0+20000,(tx,ty,floor)=>nav.route(builder,{tx,ty,floor}))).toBe(true);
 const result=executeHumanWork(r,hw,builder,T0+30000);expect(result,result.reason).toMatchObject({done:true});
 const station=comm.workStations.map(id=>findRunEntity(r,id)).find(e=>e?.deployed?.key==='deploy_campfire')!;expect(humanEntityTile(r,station)).toEqual([tx,ty]);expect(station.station!.queue).toHaveLength(0);
 expect(r.custody[fuel]).toBeUndefined();expect(r.custody[out]).toBeUndefined();expect(goods.slots.every(s=>!s)).toBe(true);expect(comm.lostWorksites?.[old.id]).toBeUndefined();
});
