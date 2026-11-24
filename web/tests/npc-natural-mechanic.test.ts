import {it,expect} from 'vitest';
import {startRun,newGame,findRunEntity,C,beginReceiptSink,endReceiptSink} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';
import {validate} from '../src/game/persist';
import {ITEMS} from '../src/game/catalog';
import {T0} from './helpers/g1b-kit';

it('a New Game mechanic fetches the real bill and repairs their own worn tool once across reload',()=>{
 setActiveLayout('veyra05-world');let gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 expect(gs.run!.qaUsed).toBe(false);
 const start=gs.run!.humanWorld!,opening=new Map(Object.values(start.people).filter(h=>h.occupation==='mechanic').map(h=>[h.actorId,h.equip.weapon && {...h.equip.weapon}]));
 const events:ReturnType<typeof endReceiptSink>=[];let reloaded:string|undefined;
 for(let sec=2;sec<=480;sec+=2){
   beginReceiptSink();try{settle(gs,T0+sec*1000,true);}finally{events.push(...endReceiptSink().filter(q=>['human.work.input','human.maintenance'].includes(q.kind)));}
   const world=gs.run!.humanWorld!;
   if(!reloaded){const worker=Object.values(world.people).find(h=>h.intent?.work?.kind==='repair_item' && h.intent.work.phase!=='fetch' && h.state==='WORKING' && events.some(e=>e.kind==='human.work.input' && JSON.parse(e.detail).orderId===h.intent!.intentId));
     if(worker){reloaded=worker.intent!.intentId;gs=validate(JSON.parse(JSON.stringify(gs)))!;expect(gs).toBeTruthy();}}
   if(reloaded && events.some(e=>e.kind==='human.maintenance' && JSON.parse(e.detail).job===reloaded))break;
 }
 if(!reloaded || !events.some(e=>e.kind==='human.maintenance'))console.log('REPAIR DIAGNOSTIC',Object.values(gs.run!.humanWorld!.people).filter(h=>h.intent?.work?.kind==='repair_item').map(h=>[h.actorId,h.gx,h.gy,h.state,h.intent?.work,h.lastWorkBlock]));
 expect(reloaded).toBeTruthy();const done=events.filter(e=>e.kind==='human.maintenance').map(e=>JSON.parse(e.detail)).filter(e=>e.job===reloaded);expect(done).toHaveLength(1);
 const [repair]=done,r=gs.run!,world=r.humanWorld!,worker=world.people[repair.worker],comm=world.communities[worker.community!];
 const tool=worker.equip.weapon!,bench=findRunEntity(r,repair.station)!;
 expect(bench).toMatchObject({owner:comm.id,type:'workbench'});expect(tool.uid).toBe(repair.item);expect(opening.get(worker.actorId)).toMatchObject({uid:tool.uid,dur:repair.before});expect(tool.dur).toBe(ITEMS[tool.key].dur);expect(repair.before).toBeLessThan(tool.dur!);
 const fetched=events.filter(e=>e.kind==='human.work.input').map(e=>JSON.parse(e.detail)).filter(e=>e.orderId===reloaded);
 for(const [key,qty] of ITEMS[tool.key].repair!.cost){const input=repair.inputs.find((i:{key:string})=>i.key===key);expect(input).toMatchObject({qty,containerId:worker.inv.packId});const transfer=fetched.find(e=>e.received.some((s:{uid:string})=>s.uid===input.uid));expect(transfer).toMatchObject({containerId:comm.storeContainers[0],into:worker.inv.packId});expect(C(r,worker.inv.packId).slots.some(s=>s?.uid===input.uid)).toBe(false);}
 console.log('NATURAL_MECHANIC',JSON.stringify({site:comm.poi,worker:worker.actorId,reloaded,fetched,repair}));
},300000);
