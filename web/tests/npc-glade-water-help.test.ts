import {expect,it} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {selectSnapshots,serializeSnapshot} from '../src/game/persist';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';
import {answerWaterAppeal} from '../src/game/human-jobs';
import {beginReceiptSink,endReceiptSink,findRunEntity,clearSurvivorSight,weatherAt} from '../src/game/engine';

const load=()=>{
  const gs=selectSnapshots([gunzipSync(readFileSync('evidence/npc-integration/coast-62c9dae/h51.save.gz')).toString()]).gs!;
  expect(setActiveLayout(gs.run!.layoutId!)).toBe(true);return gs;
};
const trace=(gs:ReturnType<typeof load>,at:number)=>{
  let rows:ReturnType<typeof endReceiptSink>;beginReceiptSink();try{settle(gs,at,true);}finally{rows=endReceiptSink();}
  return rows.filter(e=>['human.water.appeal','human.work.input','human.work.blocked','human.barrel.built','human.barrel.drink','human.cargo.lineage'].includes(e.kind));
};
it('does not answer through an obstacle, from a foreign store, or by interrupting a companion',()=>{
  const r=load().run!,hw=r.humanWorld!,b=hw.people.h4s,p=hw.people.h4t,c=hw.communities[b.community!];
  const ask=()=>answerWaterAppeal(r,hw,p,r.clock.lastSimAt,()=>{throw Error('an ineligible builder requested a path');});
  expect(clearSurvivorSight(r,b,p)).toBe(false);expect(ask()).toBe(false);
  // Controlled negatives only. Clear sight in the same cell isolates each other condition.
  p.gx=b.gx;p.gy=b.gy;expect(clearSurvivorSight(r,b,p)).toBe(true);
  b.following=true;expect(ask()).toBe(false);b.following=false;
  const e=findRunEntity(r,c.storeEntityId)!;e.owner='player';expect(ask()).toBe(false);e.owner=c.id;
  // A request without a physical path cannot even start a job or debit stock.
  const snapshot=JSON.stringify(r.custody[e.c!]);let tried=false;
  expect(answerWaterAppeal(r,hw,p,r.clock.lastSimAt,()=>{tried=true;return null;})).toBe(false);expect(tried).toBe(true);
  expect(JSON.stringify(r.custody[e.c!])).toBe(snapshot);expect(b.intent).toBeUndefined();
  expect(b.workOutputs).toEqual({sg0e:1});expect(c.rainBarrelId).toBeUndefined();
});
it('walks from an unseen dry resident to a witnessed, paid Glade catchment; Continue preserves custody',()=>{
  const gs=load(),r=gs.run!,hw=r.humanWorld!,c=hw.communities['com:po_glade'],b=hw.people.h4s,p=hw.people.h4t,start=r.clock.lastSimAt;
  expect(r.qaUsed).toBe(false);expect(p.thirst).toBeLessThan(10);expect(clearSurvivorSight(r,b,p)).toBe(false);expect(b.deliveryWait?.containerId).toBe('c25z');
  const events:ReturnType<typeof trace>=[];
  // Save during this particular accepted job, before it can spend materials.
  for(let sec=2;sec<=540&&!b.intent?.work?.catchment;sec+=2)events.push(...trace(gs,start+sec*1000));
  const offer=events.find(e=>e.kind==='human.water.appeal'&&JSON.parse(e.detail).requester===p.actorId&&JSON.parse(e.detail).builder===b.actorId);
  expect(offer).toBeDefined();const job=JSON.parse(offer!.detail).job;expect(b.intent?.intentId).toBe(job);
  expect(b.workOutputs).toEqual({sg0e:1});expect(c.rainBarrelId).toBeUndefined();
  const restored=selectSnapshots([serializeSnapshot(gs)]).gs!;expect(restored.run!.humanWorld!.people.h4s.intent?.intentId).toBe(job);
  const until=start+12*60000;
  const continuous=trace(gs,until),resumed=trace(restored,until);
  const local=(e:typeof events[number])=>/h4s|sg0e/.test(e.detail);
  const projection=(s:typeof gs)=>{const run=s.run!,w=run.humanWorld!,builder=w.people.h4s,comm=w.communities[c.id],barrel=findRunEntity(run,comm.rainBarrelId);return {builder:[builder.gx,builder.gy,builder.state,builder.workOutputs],pack:run.custody[builder.inv.packId],store:run.custody.c25z,line:comm.cargoLedger?.sg0e,barrel};};
  expect(resumed.filter(local)).toEqual(continuous.filter(local));expect(projection(restored)).toEqual(projection(gs));events.push(...continuous);
  const barrel=findRunEntity(r,c.rainBarrelId)!;expect(barrel?.owner).toBe(c.id);
  const built=events.filter(e=>e.kind==='human.barrel.built'&&JSON.parse(e.detail).entity===barrel.id);expect(built).toHaveLength(1);
  const inputs: {key:string;qty:number;uid:string;containerId:string}[]=JSON.parse(built[0].detail).inputs;
  expect(inputs.every(v=>v.containerId===b.inv.packId&&v.uid!=='sg0e')).toBe(true);
  for(const [key,qty] of [['wood',8],['fiber',3]] as const)expect(inputs.filter(v=>v.key===key).reduce((n,v)=>n+v.qty,0)).toBe(qty);
  expect(c.cargoLedger?.sg0e).toHaveLength(1);expect(c.cargoLedger?.sg0e?.[0]).toMatchObject({workerId:'h4s',jobId:'hjg0d',fromUid:'sg0e',qty:1,key:'wood'});
  const fetched=events.filter(e=>e.kind==='human.work.input'&&JSON.parse(e.detail).orderId===job);
  const obstructed=events.find(e=>e.kind==='human.work.blocked'&&e.detail.startsWith(`${b.actorId}:${job}:`));
  expect(fetched.flatMap(e=>JSON.parse(e.detail).inputs)).toEqual([{uid:'s2zx',key:'wood',qty:4},{uid:'s2zu',key:'fiber',qty:3}]);
  expect(barrel.water).toBe(0);
  // The barrel is still dry at minute twelve. Do not manufacture a shower or
  // a drink; run the real weather and require the original requester to drink.
  const drinks:ReturnType<typeof trace>=[];
  for(let minute=17;minute<=62&&!drinks.some(e=>e.detail===`h4t:${barrel.id}:1`);minute+=5){
    drinks.push(...trace(gs,start+minute*60000).filter(e=>e.kind==='human.barrel.drink'&&e.detail.includes(`:${barrel.id}:`)));
  }
  expect(drinks.some(e=>e.detail===`h4t:${barrel.id}:1`)).toBe(true);expect(p.thirst).toBeGreaterThan(25);
  const observation={seed:r.seed,run:r.id,qa:r.qaUsed,start,accepted:offer,fetch:fetched,firstSiteBlock:obstructed,construction:built[0],originalFreight:c.cargoLedger?.sg0e,sameAfterContinue:true,
    until:r.clock.lastSimAt,water:barrel.water,requester:{state:p.state,hp:p.hp,thirst:p.thirst},drinks:drinks.map(e=>({...e,weather:weatherAt(r,e.at)}))};
  if(process.env.SOH_GLADE_REPORT)writeFileSync(process.env.SOH_GLADE_REPORT,JSON.stringify(observation,null,2)+'\n');
},240000);
