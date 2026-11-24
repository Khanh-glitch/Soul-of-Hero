import {it,expect} from 'vitest';
import {newGame,startRun,allRunEntities,findRunEntity,C,structureRepairCost,beginReceiptSink,endReceiptSink} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';
import {humanEntityTile} from '../src/game/human-jobs';
import {validate} from '../src/game/persist';
import {T0} from './helpers/g1b-kit';
it('a Greywater builder fetches masonry, resumes at the flood wall and pays for one patch',()=>{
 setActiveLayout('veyra05-world');let gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=()=>gs.run!,comm=r().humanWorld!.communities['com:po_greywater'];const wall=allRunEntities(r()).find(e=>e.label==='North Flood Wall Buttress')!;
 expect(wall).toBeTruthy();const target=()=>findRunEntity(r(),wall.id)!,before=wall.hp!,bill=structureRepairCost(wall);
 const builder=comm.memberIds.map(id=>r().humanWorld!.people[id]).find(h=>h.occupation==='builder')!,actor=()=>r().humanWorld!.people[builder.actorId];
 const pack=()=>C(r(),builder.inv.packId),store=C(r(),comm.storeContainers[0]),stone=store.slots.find(s=>s?.key==='stone')!,wood=pack().slots.find(s=>s?.key==='wood')!;
 expect(stone).toBeTruthy();expect(pack().slots.some(s=>s?.key==='stone')).toBe(false);const woodBefore=wood.qty,events:ReturnType<typeof endReceiptSink>=[];
 let saved:{at:number;job:string;gx:number;gy:number;floor:number}|undefined;
 for(let sec=2;sec<=600;sec+=2){
  beginReceiptSink();try{settle(gs,T0+sec*1000,true);}finally{events.push(...endReceiptSink().filter(q=>q.kind==='human.structure.patch'||q.kind==='human.work.input'&&JSON.parse(q.detail).workerId===builder.actorId));}
  const h=actor();if(!saved&&h.intent?.work?.entityId===wall.id && h.intent.work.phase!=='fetch' && h.state==='WORKING'){
   const [x,y]=humanEntityTile(r(),target());expect(Math.abs(x-h.gx)+Math.abs(y-h.gy)).toBe(1);expect(h.floor).toBe(target().floor);
   saved={at:sec,job:h.intent.intentId,gx:h.gx,gy:h.gy,floor:h.floor};expect(target().hp).toBe(before);gs=validate(JSON.parse(JSON.stringify(gs)))!;expect(gs).toBeTruthy();expect(actor().intent?.intentId).toBe(saved.job);}
  if(events.some(q=>q.kind==='human.structure.patch'&&JSON.parse(q.detail).site===wall.id))break;
 }
 expect(saved).toBeDefined();const job=saved!.job,withdraw=events.filter(q=>q.kind==='human.work.input'&&JSON.parse(q.detail).orderId===job),patch=events.filter(q=>q.kind==='human.structure.patch'&&JSON.parse(q.detail).job===job);
 expect(withdraw).toHaveLength(1);expect(patch).toHaveLength(1);const fetch=JSON.parse(withdraw[0].detail),paid=JSON.parse(patch[0].detail);
 expect(C(r(),store.id).slots.some(s=>s?.uid===stone.uid)).toBe(false);expect(patch[0].at-withdraw[0].at).toBeGreaterThanOrEqual(8000);
 expect(fetch).toMatchObject({containerId:store.id,into:pack().id,inputs:[{uid:stone.uid,key:'stone',qty:2}]});
 expect(paid).toMatchObject({worker:builder.actorId,site:wall.id,before,after:before+Math.ceil(wall.maxHp!/4)});
 for(const [key,qty] of bill)expect(paid.inputs).toContainEqual(expect.objectContaining({key,qty,uid:key==='stone'?fetch.received[0].uid:wood.uid,containerId:pack().id}));
 expect(target().hp).toBe(target().maxHp);expect(pack().slots.find(s=>s?.uid===wood.uid)?.qty).toBe(woodBefore-1);expect(pack().slots.some(s=>s?.uid===fetch.received[0].uid)).toBe(false);expect(r().qaUsed).toBe(false);
 console.log('NATURAL_BUILDER',JSON.stringify({seed:r().seed,start:T0,site:comm.poi,tile:humanEntityTile(r(),target()),capacity:store.slots.length,saved,withdraw:withdraw[0],patch:patch[0]}));
},300000);
