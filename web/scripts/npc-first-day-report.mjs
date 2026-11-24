/** Read-only reduction of the two npc-first-day runs. Never load a report as a save. */
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [dir,out,gate]=process.argv.slice(2);if(!dir||!out)throw Error('Usage: node scripts/npc-first-day-report.mjs <run directory> <report.json> [--require-parity]');
const load=file=>JSON.parse(readFileSync(join(dir,file),'utf8'));
const live=load('uninterrupted.json'),cold=load('continued.json');
assert.deepEqual(live.map(v=>v.hour),Array.from({length:24},(_,i)=>i+1));assert.deepEqual(cold.map(v=>v.hour),live.slice(8).map(v=>v.hour));
const checkpoint=load('fork-origin.json');
const h8=JSON.parse(load('h8.save').payload).run;
// Measure the payload itself, not a second copy of the pre-save census.
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hw8=h8.humanWorld,hs8=Object.values(hw8.people);
const savedDigests={ids:hash(Object.keys(hw8.people).sort()),people:hash(hw8.people),jobs:hash(hs8.map(h=>[h.actorId,h.intent,h.harvestJob,h.workOutputs])),custody:hash(h8.custody),communities:hash(hw8.communities)};
assert.deepEqual(checkpoint.digests,savedDigests,'h8 payload differs from the immediate pre-save census');
const pendingAtFork=Object.values(h8.humanWorld.people).filter(h=>h.routeSearch?.status==='PENDING_SEARCH').map(h=>({actor:h.actorId,occupation:h.occupation,from:[h.gx,h.gy,h.floor],...h.routeSearch}));
const compare=(a,b)=>Object.fromEntries(Object.keys(a).map(k=>[k,a[k]===b[k]]));
const samples=xs=>xs.filter(v=>[1,8,9,24].includes(v.hour)).map(({hour,state,elapsedMs,counts,timings})=>({hour,state,elapsedMs,counts,inclusiveMs:Object.fromEntries(Object.entries(timings).sort(([,a],[,b])=>b.ms-a.ms).slice(0,8).map(([k,v])=>[k,Math.round(v.ms)]))}));
const villages=file=>{const r=load(file).run,world=r.humanWorld;const rows=Object.values(world.communities).map(c=>{
  const hs=c.memberIds.map(k=>world.people[k]);const active=hs.filter(h=>!['DOWNED','DEAD','EVACUATED','ON_VESSEL'].includes(h.state));
  return {poi:c.poi,total:hs.length,active:active.length,down:hs.filter(h=>h.state==='DOWNED').length,dead:hs.filter(h=>h.state==='DEAD').length,hungry:active.filter(h=>h.hunger<40).length,thirsty:active.filter(h=>h.thirst<40).length};});
  return rows.sort((a,b)=>a.poi.localeCompare(b.poi));};
const events=xs=>xs.reduce((acc,v)=>{for(const [kind,n]of Object.entries(v.receiptKinds))if(/^human\.(water|drink|consume|treat|down|death|cargo\.deliver|production\.finish|harvest\.crush)$/.test(kind))acc[kind]=(acc[kind]??0)+n;return acc;},{});
const summaries=xs=>Object.fromEntries([1,8,24].filter(h=>xs.some(v=>v.hour===h)).map(h=>[h,Math.round(xs.filter(v=>v.hour<=h).reduce((n,v)=>n+v.elapsedMs,0))]));
const comparisons=cold.map(v=>({hour:v.hour,match:compare(live[v.hour-1].state.digests,v.state.digests)}));
const firstMismatch=comparisons.find(v=>Object.values(v.match).some(equal=>!equal));
const parity={passed:!firstMismatch,firstDifferentHour:firstMismatch?.hour??null};
const endPeople=label=>load(`${label}-h24.json`).run.humanWorld.people;
const condition=people=>{
  const hs=Object.values(people),active=hs.filter(h=>!['DEAD','DOWNED','EVACUATED','ON_VESSEL'].includes(h.state));
  const low=active.filter(h=>h.hunger<40||h.thirst<40);
  const dead=hs.filter(h=>h.state==='DEAD');
  return {active:active.length,activeLowNeed:low.length,activeNotLow:active.length-low.length,down:hs.filter(h=>h.state==='DOWNED').length,dead:dead.length,deadZeroHungerOnly:dead.filter(h=>h.hunger===0&&h.thirst>0).length,deadZeroThirstOnly:dead.filter(h=>h.thirst===0&&h.hunger>0).length,deadBothZero:dead.filter(h=>h.hunger===0&&h.thirst===0).length};
};
const warmPeople=endPeople('uninterrupted'),coldPeople=endPeople('continued');
assert.deepEqual(Object.keys(warmPeople).sort(),Object.keys(coldPeople).sort());
const mortalityDifferences=Object.values(warmPeople).filter(h=>(h.state==='DEAD')!==(coldPeople[h.actorId].state==='DEAD')).map(h=>({id:h.actorId,community:h.community,continuous:h.state,continued:coldPeople[h.actorId].state}));
writeFileSync(out,JSON.stringify({seed:7606,parity,condition:{h1:condition(load('uninterrupted-h1.json').run.humanWorld.people),h8:condition(h8.humanWorld.people),h24:condition(warmPeople),continuedH24:condition(coldPeople)},mortalityDifferences,layout:'veyra05-world',notes:'Same one-hour settle boundaries; sha256 over ordered JSON. Counts for low hunger/thirst exclude dead, downed and embarked. Timings inclusive, not FPS.',preSaveVsSerializedAtH8:compare(live[7].state.digests,savedDigests),pendingAtFork,cumulativeSettleMs:{continuous:summaries(live),fromH8:summaries(cold)},continuous:samples(live),continued:samples(cold),comparisons,eventsH0To24:events(live),eventsH8To24:{continuous:events(live.slice(8)),continued:events(cold)},villagesAt24: villages('uninterrupted-h24.json'),continuedVillagesAt24:villages('continued-h24.json')},null,2)+'\n');
if(gate==='--require-parity'&&!parity.passed){console.error(`Day-one parity failed: first differing hourly sample h${firstMismatch.hour}`);process.exitCode=1;}
