import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {expect,it} from 'vitest';
import {validate,serializeSnapshot} from '../src/game/persist';
import {settle} from '../src/game/sim';
import {newGame,startRun,beginReceiptSink,endReceiptSink} from '../src/game/engine';
import {advanceElderPressure,advanceEvacuation,departEvac,boardEvac,evacSchedule} from '../src/game/humanworld';
import {HOUR,type GameState} from '../src/game/core';import {setActiveLayout} from '../src/game/world';import {T0} from './helpers/g1b-kit';
const reload=(gs:GameState)=>{const copy=validate(JSON.parse(JSON.parse(serializeSnapshot(gs)).payload));expect(copy).toBeTruthy();return copy!;};
const json=(file:string)=>JSON.parse(readFileSync('tests/fixtures/'+file,'utf8'));
for(const [name,data] of Object.entries({shipping:json('7b9805b2-shipping-v3.json').save,lr01:json('7b9805b2-veyra-v3.json').save,industrial:JSON.parse(json('g1a-legacy-veyra-save-3f80bf4f.json').payload),research:json('3b37ae9-legacy-pair.json').earlier,paid:json('pa1-rev1-queued-jobs.json').earlier})){
 it(`loads historical ${name} stock and jobs without adding a human society or duplicating custody`,()=>{
  const keys=Object.keys(data.run.custody).sort();const jobs=(r:GameState['run'])=>Object.values(r!.entities).flatMap(e=>e.station?.queue.map(j=>j.id)??[]).sort();const before=jobs(data.run);
  const gs=validate(data);expect(gs).toBeTruthy();expect(Object.keys(gs!.run!.custody).sort()).toEqual(keys);expect(jobs(gs!.run)).toEqual(before);expect(gs!.run!.humanWorld).toBeUndefined();
  const copy=reload(gs!);expect(copy.run!.custody).toEqual(gs!.run!.custody);expect(jobs(copy.run)).toEqual(before);
 });
}
it('resumes a genuine browser save with harvesters walking; same instant never extracts twice',()=>{
 const snapshot=JSON.parse(gunzipSync(readFileSync('evidence/npc-integration/browser-field-log/continue-snapshot.json.gz')).toString());const gs=validate(JSON.parse(snapshot.payload))!,r=gs.run!,hw=r.humanWorld!;
 const jobs=new Set(Object.values(hw.people).flatMap(h=>h.harvestJob?[h.harvestJob.id]:[]));expect(jobs.size).toBeGreaterThan(0);const at=r.clock.lastSimAt+45000;
 beginReceiptSink();settle(gs,at,true);const out=endReceiptSink().filter(q=>q.kind==='human.harvest.output').map(q=>JSON.parse(q.detail)).filter(q=>jobs.has(q.jobId));expect(out.length).toBeGreaterThan(0);expect(new Set(out.map(q=>q.uid)).size).toBe(out.length);
 const copy=reload(gs),before=JSON.stringify(copy.run);settle(copy,at,true);expect(JSON.stringify(copy.run)).toBe(before);
},180000);
function scene(){setActiveLayout('veyra05-greywater');const gs=newGame();startRun(gs,'female',T0,null,7606,{tx:100,ty:100});return gs;}
// Controlled boundary samples: launch by the real authority. Start the offline
// integration just before its computed deadline, not a 4h/endurance claim.
function checkpoint(gs:GameState,due:number){const r=gs.run!;r.clock.lastSimAt=due-1200;const hw=r.humanWorld!;hw.lastNeedsAt=hw.lastStepAt=hw.lastResolvedAt=r.clock.lastSimAt;return reload(gs);}
it('a resumed crossing settles its manifest once, with no second fare',()=>{const gs=scene(),r=gs.run!,hw=r.humanWorld!,trip=Object.values(hw.evacuation)[0],h=Object.values(hw.people)[0];r.qaOffset=evacSchedule().openHour*HOUR;advanceEvacuation(r,hw,T0);h.gx=trip.siteGx;h.gy=trip.siteGy;expect(boardEvac(r,hw,h,trip.tripId,T0).ok).toBe(true);expect(departEvac(r,hw,trip.tripId,T0).ok).toBe(true);const at=trip.arriveAt!,copy=checkpoint(gs,at),hold=JSON.stringify(r.custody[trip.vessel!.holdId]);settle(copy,at,true);const c=copy.run!.humanWorld!.evacuation[trip.tripId];expect(c.departures).toHaveLength(1);expect(c.departures![0].arrivedAt).toBe(at);expect(copy.run!.custody[c.vessel!.holdId]).toEqual(JSON.parse(hold));const same=JSON.stringify(copy.run);settle(copy,at,true);expect(JSON.stringify(copy.run)).toBe(same);});
it('a resumed Elder approach commits a single contact at the launched deadline',()=>{const gs=scene(),r=gs.run!,hw=r.humanWorld!;r.qaOffset=312*HOUR;advanceElderPressure(r,hw,T0);const flight=Object.values(hw.elderPressure).flatMap(e=>(e.events??[]).filter(v=>v.state==='APPROACH').map(v=>({e:e.elderId,v}))).sort((a,b)=>a.v.arriveAt-b.v.arriveAt)[0];expect(flight).toBeDefined();const at=flight.v.arriveAt,copy=checkpoint(gs,at);settle(copy,at,true);const ev=copy.run!.humanWorld!.elderPressure[flight.e].events!.find(v=>v.wave===flight.v.wave)!;expect(ev.state).toBe('CONTACT');expect(ev.contactReceipt).toBeTruthy();const same=JSON.stringify(copy.run);settle(copy,at,true);expect(JSON.stringify(copy.run)).toBe(same);});
