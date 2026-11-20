import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {newGame,startRun,beginReceiptSink,endReceiptSink} from '../src/game/engine';
import type {RunState,GameState} from '../src/game/core';
import {setActiveLayout} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
import {settle} from '../src/game/sim';
import {profileWorldWork} from '../src/game/world-work';
import {T0} from './helpers/g1b-kit';
const dir=process.env.SOH_DAY_DIR, fork=process.env.SOH_DAY_CONTINUE==='1';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const counts=(keys:string[])=>keys.reduce<Record<string,number>>((a,k)=>(a[k]=(a[k]??0)+1,a),{});
function census(r:RunState){
 const hw=r.humanWorld!,people=Object.values(hw.people);
 const states=(hs:typeof people)=>{const active=hs.filter(h=>!['DEAD','DOWNED','EVACUATED','ON_VESSEL'].includes(h.state));return {count:hs.length,states:counts(hs.map(h=>h.state)),active:active.length,hungry:active.filter(h=>h.hunger<40).length,thirsty:active.filter(h=>h.thirst<40).length};};
 return {clock:r.clock.lastSimAt,all:states(people),playerDead:r.player.dead,regions:['com:po_hook','com:po_greywater'].map(id=>{
  const c=hw.communities[id];return {id,...states(c.memberIds.map(k=>hw.people[k])),stock:c.storeContainers.flatMap(k=>r.custody[k].slots.filter(Boolean).map(s=>[s!.uid,s!.key,s!.qty])),delivered:counts(Object.values(c.cargoLedger??{}).flat().map(v=>v.key))};}),
  digests:{ids:hash(Object.keys(hw.people).sort()),people:hash(hw.people),jobs:hash(people.map(h=>[h.actorId,h.intent,h.harvestJob,h.workOutputs])),custody:hash(r.custody),communities:hash(hw.communities)}};
}
it.skipIf(!dir)('audits an unchanged geographic first day and a fresh-process Continue at h8',()=>{
 mkdirSync(dir!,{recursive:true});const output=(name:string,v:string)=>{const p=join(dir!,name);writeFileSync(p+'.tmp',v);renameSync(p+'.tmp',p);};
 setActiveLayout('veyra05-world');let gs:GameState;
 if(fork){const loaded=selectSnapshots([readFileSync(join(dir!,'h8.save'),'utf8')]);expect(loaded.bad).toEqual([]);gs=loaded.gs!;expect(setActiveLayout(gs.run!.layoutId!)).toBe(true);
  expect(census(gs.run!)).toEqual(JSON.parse(readFileSync(join(dir!,'fork-origin.json'),'utf8')));
 }else{gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);}
 const r=gs.run!,ids=Object.keys(r.humanWorld!.people).sort(),label=fork?'continued':'uninterrupted';expect(ids).toHaveLength(286);
 const report=[];const until=Number(process.env.SOH_DAY_END??24);expect(until).toBeGreaterThan(fork?8:0);expect(until).toBeLessThanOrEqual(24);
 for(let hour=fork?9:1;hour<=until;hour++){
   beginReceiptSink();let work,events;try{work=profileWorldWork(()=>settle(gs,T0+hour*3600000,true));}finally{events=endReceiptSink();}
   expect(r.clock.lastSimAt).toBe(T0+hour*3600000);expect(Object.keys(r.humanWorld!.people).sort()).toEqual(ids);expect(r.qaUsed).toBeFalsy();
   const state=census(r);expect(r.humanWorld!.lastNeedsAt).toBe(state.clock);
   const digest=hash(r);settle(gs,state.clock,true);expect(hash(r)).toBe(digest);
   report.push({hour,state,receiptKinds:counts(events.map(e=>e.kind)),elapsedMs:work.elapsedMs,counts:work.counts,timings:work.timings});
   output(`${label}.json`,JSON.stringify(report));
   if(hour===8&&!fork){const snapshot=serializeSnapshot(gs);expect(census(r)).toEqual(state);output('fork-origin.json',JSON.stringify(state));output('h8.save',snapshot);}
   if(hour===1||hour===24)output(`${label}-h${hour}.json`,JSON.stringify(gs));
   if(hour===24 && fork)output('continued-h24.save',serializeSnapshot(gs));
 }
},14400000);

// Verify the terminal captures after BOTH arms have finished, without changing
// their trajectories. Provenance UIDs are references, not additional inventory.
const checkDir=process.env.SOH_DAY_CHECK;
it.skipIf(!checkDir)('round-trips both h24 states and audits physical stack owners',()=>{
 for(const label of ['uninterrupted','continued']){
  const gs:GameState=JSON.parse(readFileSync(join(checkDir!,`${label}-h24.json`),'utf8')),r=gs.run!;
  expect(setActiveLayout(r.layoutId!)).toBe(true);expect(r.clock.lastSimAt).toBe(T0+24*3600000);
  const before=census(r),uids=new Set<string>();
  const claim=(uid:string)=>{if(uids.has(uid))throw Error(`Duplicate physical owner of ${uid}`);uids.add(uid);};
  for(const c of Object.values(r.custody))for(const s of c.slots)if(s)claim(s.uid);
  for(const h of Object.values(r.humanWorld!.people))for(const s of Object.values(h.equip))if(s)claim(s.uid);
  for(const e of [...Object.values(r.entities),...Object.values(r.veyraOffscreenEntities??{})])for(const j of e.station?.queue??[])for(const s of j.reserved??[])claim(s.uid);
  const load=selectSnapshots([serializeSnapshot(gs)]);expect(load.bad).toEqual([]);expect(census(load.gs!.run!)).toEqual(before);
  console.log('DAY_CHECK',JSON.stringify({label,uids:uids.size}));
 }
});
