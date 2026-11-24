import {it,expect} from 'vitest';
import {startRun,newGame,findRunEntity,workLightPowered,powerAllocation,endReceiptSink,beginReceiptSink,C} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';
import {validate} from '../src/game/persist';
import {T0} from './helpers/g1b-kit';

it('a warehouse-funded load relights the ore yard, survives Continue and burns out',()=>{
 setActiveLayout('veyra05-world');let gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=()=>gs.run!,comm=()=>r().humanWorld!.communities['com:po_ironmine'];
 const gid=comm().workStations.find(id=>findRunEntity(r(),id)?.basePower)!;
 const gen=()=>findRunEntity(r(),gid)!,light=()=>findRunEntity(r(),gen().basePower!.workLightId)!;
 expect(workLightPowered(r(),light())).toBe(false);expect(C(r(),gen().c!).slots.every(s=>!s)).toBe(true);
 const store=comm().storeContainers[0];const events:ReturnType<typeof endReceiptSink>=[];
 let checkpoint:{at:number;energy:number;job:string;worker:string;uid:string}|undefined,offAt=0;
 for(let sec=10;sec<=1500;sec+=10){
  beginReceiptSink();try{settle(gs,T0+sec*1000,true);}finally{events.push(...endReceiptSink().filter(e=>e.kind==='human.generator.load'||e.kind==='power.yard.burn'||e.kind==='human.work.input'&&JSON.parse(e.detail).containerId===store));}
  const lit=workLightPowered(r(),light());
  if(checkpoint && !lit){offAt=sec;break;}
  if(checkpoint || !lit || gen().basePower!.energy<=0)continue;
  const latest=events.filter(e=>e.kind==='human.generator.load').slice(-1)[0];if(!latest)continue;
  const load=JSON.parse(latest.detail),fetch=events.find(e=>e.kind==='human.work.input'&&JSON.parse(e.detail).orderId===load.job);if(!fetch)continue;
  const transfer=JSON.parse(fetch.detail);expect(load).toMatchObject({generator:gid,from:transfer.into,into:gen().c,qty:1});
  expect(transfer).toMatchObject({workerId:load.worker,received:[{uid:load.sourceUid,key:load.key,qty:1}],inputs:[{key:load.key,qty:1}]});
  expect(r().humanWorld!.people[load.worker].occupation).toBe('engineer');
  expect(events.some(e=>e.kind==='power.yard.burn'&&JSON.parse(e.detail).uid===load.fuelUid)).toBe(true);
  expect(powerAllocation(r(),gen()).map(e=>e.id)).toEqual([light().id]);
  checkpoint={at:sec,energy:gen().basePower!.energy,job:load.job,worker:load.worker,uid:load.fuelUid};
  gs=validate(JSON.parse(JSON.stringify(gs)))!;expect(gs).toBeTruthy();expect(gen().basePower!.energy).toBe(checkpoint.energy);expect(workLightPowered(r(),light())).toBe(true);
 }
 expect(checkpoint).toBeDefined();expect(offAt).toBeGreaterThan(0);expect(gen().basePower!.energy).toBe(0);expect(powerAllocation(r(),gen())).toEqual([]);
 // The first dark sample must bracket the actual preserved fuel deadline.
 const remainingMs=(offAt-checkpoint!.at)*1000-checkpoint!.energy;expect(remainingMs).toBeGreaterThanOrEqual(-1);expect(remainingMs).toBeLessThan(10001);
 expect(events.filter(e=>e.kind==='power.yard.burn'&&JSON.parse(e.detail).uid===checkpoint!.uid)).toHaveLength(1);expect(r().qaUsed).toBe(false);
 console.log('NATURAL_ENGINEER',JSON.stringify({seed:r().seed,start:T0,site:comm().poi,generator:gid,light:light().id,cable:light().workLight!.cableId,checkpoint,offAt,events:events.filter(e=>e.kind!=='human.work.input'||JSON.parse(e.detail).orderId===checkpoint!.job)}));
},500000);
