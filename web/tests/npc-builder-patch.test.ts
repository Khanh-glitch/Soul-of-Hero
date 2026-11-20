import {expect,it} from 'vitest';
import {C,allRunEntities,findRunEntity,mkStack,newGame,startRun} from '../src/game/engine';
import {humanEntityTile,planHumanOccupation,executeHumanWork} from '../src/game/human-jobs';
import {validate} from '../src/game/persist';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';
function scene(){
 setActiveLayout('veyra05-world');const gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!,comm=hw.communities['com:po_greywater'],wall=allRunEntities(r).find(e=>e.owner===comm.id&&e.type==='wall_stone')!;
 const h=comm.memberIds.map(id=>hw.people[id]).find(p=>p.occupation==='builder')!,store=findRunEntity(r,comm.storeEntityId)!,stock=C(r,store.c!),pack=C(r,h.inv.packId);
 const at=(e:typeof wall)=>{const [x,y]=humanEntityTile(r,e);h.gx=x;h.gy=y+1;h.floor=e.floor??0;};at(store);
 const plan=()=>{expect(planHumanOccupation(r,hw,h,T0,()=>[])).toBe(true);expect(h.intent?.work).toMatchObject({entityId:wall.id,patchType:'wall_stone'});};
 const snapshot=()=>JSON.stringify([wall,stock,pack,r.nextId]);const refused=()=>{const before=snapshot();expect(executeHumanWork(r,hw,h,T0+9000).done).toBe(false);expect(snapshot()).toBe(before);};
 return {gs,r,hw,comm,h,stock,wall,pack,at,plan,refused};
}
it('rechecks the site and the whole missing bill before withdrawing any stone',()=>{
 const {r,comm,wall,pack,stock,plan,refused}=scene();const hp=wall.hp;
 plan();wall.hp=wall.maxHp;refused();wall.hp=hp;
 plan();wall.owner='player';refused();wall.owner=comm.id;
 plan();wall.type='floor_stone';refused();wall.type='wall_stone';
 plan();const wood=pack.slots.findIndex(s=>s?.key==='wood');pack.slots[wood]=null;refused();
 pack.slots[wood]=mkStack(r,'wood',4);plan();const stone=stock.slots.find(s=>s?.key==='stone')!;stone.production={jobId:'other',workerId:'other'};refused();delete stone.production;
 plan();for(const [i,s] of pack.slots.entries())if(!s)pack.slots[i]=mkStack(r,'berries',1);refused();
 expect(r.receipts.some(q=>q.kind==='human.work.input')).toBe(false);
});
it('keeps materials in the pack if a competing patch completes or a selected UID disappears during travel',()=>{
 const {gs,r,hw,h,wall,pack,at,plan,refused}=scene();const hp=wall.hp!;plan();executeHumanWork(r,hw,h,T0+800);at(wall);plan();
 const i=pack.slots.findIndex(s=>s?.key==='stone'),lot=pack.slots[i]!;
 const bad=JSON.parse(JSON.stringify(gs));bad.run.humanWorld.people[h.actorId].intent.work.patchLots=[lot.uid,lot.uid];expect(validate(bad)).toBeNull();
 pack.slots[i]=mkStack(r,'stone',2);refused();pack.slots[i]=lot;
 plan();wall.hp=wall.maxHp;refused();wall.hp=hp;
 plan();expect(executeHumanWork(r,hw,h,T0+7999).done).toBe(false);expect(wall.hp).toBe(hp);
 expect(executeHumanWork(r,hw,h,T0+8000).done).toBe(true);expect(wall.hp).toBe(wall.maxHp);expect(pack.slots[i]).toBeNull();expect(executeHumanWork(r,hw,h,T0+8001).done).toBe(false);
});
