/** Verify the actual two terminal saves (all fields, arrays in order). JSON
 * object member insertion order is not a field value. Keep the historical
 * byte-digest audit intact so discrepancies remain visible, not discarded. */
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const [dir,output]=process.argv.slice(2);
const read=name=>JSON.parse(readFileSync(join(dir,name),'utf8'));
const warm=read('uninterrupted.json'),cold=read('continued.json');
assert.deepEqual(warm.map(s=>s.hour),Array.from({length:24},(_,i)=>1+i));assert.deepEqual(cold.map(s=>s.hour),warm.slice(8).map(s=>s.hour));
const observations=cold.map((v,i)=>{
 const w=warm[8+i];
 assert.deepEqual(v.receiptKinds,w.receiptKinds,`event counts h${v.hour}`);
 // These hourly samples are reduced: prove only what they actually contain.
 const {people:cp,...cd}=v.state.digests,{people:wp,...wd}=w.state.digests;
 assert.deepEqual(cd,wd,`roster/jobs/custody/communities h${v.hour}`);
 assert.deepEqual({...v.state,digests:cd},{...w.state,digests:wd},`census h${v.hour}`);
 return {hour:v.hour,orderedPeopleDigestEqual:cp===wp,actorValuesDigestEqual:
   w.state.actorValuesDigest!==undefined ? w.state.actorValuesDigest===v.state.actorValuesDigest : null};
});
const a=read('uninterrupted-h24.json'),b=read('continued-h24.json');
assert.deepEqual(a,b,'Terminal game differs');
const keys=Object.keys(a.run.humanWorld.people);
assert.deepEqual(keys,Object.keys(b.run.humanWorld.people),'actor traversal order differs');
const orderOnly=keys.filter(id=>JSON.stringify(a.run.humanWorld.people[id])!==JSON.stringify(b.run.humanWorld.people[id]));
writeFileSync(output,JSON.stringify({seed:a.run.seed,actorCount:keys.length,h24WholeGameEqual:true,h24ActorTraversalOrderEqual:true,h24ActorsWithDifferentObjectKeyOrder:orderOnly,allHourlyCensusesJobsCustodyCommunitiesAndEventCountsEqual:true,observations},null,2)+'\n');
