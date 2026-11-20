import {expect,it} from 'vitest';
import {C,findRunEntity,mkStack,newGame,startRun} from '../src/game/engine';
import {executeHumanWork,humanEntityTile,planHumanOccupation} from '../src/game/human-jobs';
import {depositHumanOutputs} from '../src/game/humanworld';
import {humanNavigation} from '../src/game/human-navigation';
import {setActiveLayout} from '../src/game/world';
import {validate} from '../src/game/persist';
import {T0} from './helpers/g1b-kit';

it('cannot silently switch from watering to harvesting, substitute a flask, or partially pay a full pack',()=>{
 setActiveLayout('veyra05-world');const gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=gs.run!,world=r.humanWorld!,comm=world.communities['com:po_hook'];
 const e=comm.workStations.map(id=>findRunEntity(r,id)!).find(e=>e.type==='garden')!,g=e.garden!;
 const h=comm.memberIds.map(id=>world.people[id]).find(h=>h.occupation==='gardener')!,pack=C(r,h.inv.packId);
 const [gx,gy]=humanEntityTile(r,e);h.gx=gx;h.gy=gy+1;h.floor=0;
 const plan=(at:number)=>planHumanOccupation(r,world,h,at,()=>[]);
 expect(plan(T0)).toBe(true);expect(h.intent?.work?.gardenAction).toBe('plant');expect(executeHumanWork(r,world,h,T0+2500).done).toBe(true);
 const lot=g.sowing!.id;const seed=g.sowing!.inputs[0];expect(h.intent?.work).toMatchObject({gardenAction:'water',sowingId:lot});
 const idx=pack.slots.findIndex(s=>s?.uid===h.intent!.work!.itemUid),flask=pack.slots[idx]!;const replacement=mkStack(r,flask.key,1);pack.slots[idx]=replacement;
 expect(executeHumanWork(r,world,h,T0+4000).done).toBe(false);expect(replacement.charge).toBe(flask.charge);expect(g.water).toBe(0);
 expect(plan(T0+4100)).toBe(true);expect(h.intent?.work?.gardenAction).toBe('water');g.growth=1;
 expect(executeHumanWork(r,world,h,T0+6100).done).toBe(false);expect(g.crop).toBe('crop');
 expect(plan(T0+6200)).toBe(true);expect(h.intent?.work?.gardenAction).toBe('harvest');
 for(let i=0;i<pack.slots.length-1;i++)if(!pack.slots[i])pack.slots[i]=mkStack(r,'wood',1);
 const before=JSON.stringify([pack,g]);expect(executeHumanWork(r,world,h,T0+8200).done).toBe(false);expect(JSON.stringify([pack,g])).toBe(before);
 // Only the controlled negative fixture makes the crop ripe. With capacity,
 // output in transit must survive validation, not just the already emptied plot.
 pack.slots[0]=null;expect(plan(T0+8300)).toBe(true);expect(executeHumanWork(r,world,h,T0+10300).done).toBe(true);
 const saved=validate(JSON.parse(JSON.stringify(gs)));expect(saved).toBeTruthy();const paid=C(saved!.run!,pack.id).slots.filter(s=>s?.production?.jobId===lot);
 expect(paid).toHaveLength(2);expect(paid.every(s=>s!.production!.inputs![0].uid===seed.uid)).toBe(true);expect(g.crop).toBeNull();expect(g.sowing).toBeUndefined();
 const loaded=saved!.run!,worker=loaded.humanWorld!.people[h.actorId],store=findRunEntity(loaded,comm.storeEntityId)!,dst=C(loaded,store.c!);
 const [sx,sy]=humanEntityTile(loaded,store),nav=humanNavigation(loaded);
 const access=[[sx+1,sy],[sx-1,sy],[sx,sy+1],[sx,sy-1]].find(([tx,ty])=>nav.free({tx,ty,floor:0},worker,true))!;
 [worker.gx,worker.gy]=access;dst.slots=dst.slots.map(()=>mkStack(loaded,'wood',1));
 const carried=JSON.stringify(C(loaded,pack.id));depositHumanOutputs(loaded,worker,T0+11000);
 expect(worker.deliveryWait?.containerId).toBe(dst.id);expect(JSON.stringify(C(loaded,pack.id))).toBe(carried);
 dst.slots[0]=dst.slots[1]=null;depositHumanOutputs(loaded,worker,T0+12000);
 expect(worker.deliveryWait).toBeUndefined();expect(dst.slots.slice(0,2).map(s=>s?.uid).sort()).toEqual(paid.map(s=>s!.uid).sort());
},30000);

it('round-trips a Bitterleaf sowing and rejects a substituted or short payment',()=>{
 setActiveLayout('veyra05-world');const gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=gs.run!,world=r.humanWorld!,comm=world.communities['com:po_hook'];
 const plot=comm.workStations.map(id=>findRunEntity(r,id)!).find(e=>e.type==='garden')!;
 const h=comm.memberIds.map(id=>world.people[id]).find(h=>h.occupation==='gardener')!;
 for(const c of [C(r,h.inv.packId),...comm.storeContainers.map(id=>C(r,id))])for(const [i,s] of c.slots.entries())if(s?.key==='seed_sunroot')c.slots[i]=null;
 const pack=C(r,h.inv.packId);pack.slots[pack.slots.indexOf(null)]=mkStack(r,'seed_bitterleaf',1);
 const [gx,gy]=humanEntityTile(r,plot);h.gx=gx;h.gy=gy+1;h.floor=0;
 expect(planHumanOccupation(r,world,h,T0,()=>[])).toBe(true);expect(executeHumanWork(r,world,h,T0+2500).done).toBe(true);
 expect(plot.garden!.crop).toBe('herb');const roundtrip=()=>validate(JSON.parse(JSON.stringify(gs)));
 expect(roundtrip()).toBeTruthy();const input=plot.garden!.sowing!.inputs[0];input.key='seed_sunroot';expect(roundtrip()).toBeNull();input.key='seed_bitterleaf';input.qty=0;expect(roundtrip()).toBeNull();
});
