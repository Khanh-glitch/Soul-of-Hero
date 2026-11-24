// Read a preserved pre-ending milestone, not the changing checkpoint or live engine.
// node --experimental-strip-types scripts/npc-hour-census.mjs DIRECTORY HOUR OUT.csv
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {NPC_POI_CENSUS} from '../src/game/npc-census.ts';
const [dir,hour,out]=process.argv.slice(2);
const read=name=>readFileSync(join(dir,name));
const snapshot=gunzipSync(read(`h${hour}.save.gz`)),m=JSON.parse(read(`h${hour}.json`)),p=JSON.parse(read('progress.json'));
const digest=createHash('sha256').update(snapshot).digest('hex');
assert.equal(m.digest,digest);assert.equal(p.reports.find(r=>r.minute===Number(hour)*60)?.digest,digest);
const r=JSON.parse(JSON.parse(snapshot).payload).run;assert.ok(r&&!r.qaUsed);
assert.equal(r.id,m.runId);assert.equal(r.id,p.runId);assert.equal(r.seed,m.seed);assert.equal(m.sha,p.sha);assert.equal(r.clock.lastSimAt,r.startedAt+Number(hour)*3600000);
const hw=r.humanWorld,entity=id=>r.entities[id]??r.veyraOffscreenEntities?.[id];
const sites=new Map(Object.values(hw.communities).map(c=>[c.poi,c]));
assert.deepEqual([...sites.keys()].sort(),NPC_POI_CENSUS.map(c=>c.id).sort());
const memberIds=new Set(),rows=NPC_POI_CENSUS.map(({id})=>{
 const c=sites.get(id),people=c.memberIds.map(id=>{assert.ok(!memberIds.has(id));memberIds.add(id);const h=hw.people[id];assert.equal(h.community,c.id);return h;});
 const active=people.filter(h=>!h.transit&&!['DEAD','DOWNED','EVACUATED','ON_VESSEL'].includes(h.state));
 const beds=c.homeBeds.filter(id=>{const e=entity(id);return e?.type==='bed_straw'&&e.owner===c.id&&e.hp>0;});
 const store=entity(c.storeEntityId),bin=store?.owner===c.id&&c.storeContainers.includes(store.c)?r.custody[store.c]:null;
 const receipts=Object.values(c.cargoLedger??{}).flat(),sources=[...new Set(receipts.map(v=>v.sourceId).filter(Boolean))].sort();
 const classes=values=>Object.fromEntries([...new Set(values)].sort().map(v=>[v,values.filter(x=>x===v).length]));
 return {sha:m.sha,run:r.id,hour:m.hour,poi:id,siteClass:c.class,assigned:people.map(h=>h.actorId),roles:classes(people.map(h=>h.occupation)),states:classes(people.map(h=>h.state)),active:active.length,hungryActive:active.filter(h=>h.hunger<40).length,thirstyActive:active.filter(h=>h.thirst<40).length,ownedBeds:beds,occupiedAssignments:active.filter(h=>beds.includes(h.bedId)).map(h=>[h.actorId,h.bedId]),store:bin?.id??'',finiteStock:bin?.slots.filter(Boolean).map(s=>[s.uid,s.key,s.qty,s.charge??null])??[],deliveredSourceIds:sources,deliveredQuantities:receipts.reduce((sum,v)=>(sum[v.key]=(sum[v.key]??0)+v.qty,sum),{}),observedSearchStatus:classes(active.map(h=>h.routeSearch?.status??'NOT_OBSERVED')),barrel:c.rainBarrelId??'',elderWavesReceived:people.reduce((n,h)=>n+(h.threat?.waves??0),0)};
});
assert.equal(rows.length,81);
const cell=v=>'"'+String(typeof v==='object'?JSON.stringify(v):v).replaceAll('"','""')+'"';
writeFileSync(out,[Object.keys(rows[0]).join(','),...rows.map(r=>Object.values(r).map(cell).join(','))].join('\n')+'\n');
console.log(JSON.stringify({sha:m.sha,run:r.id,hour:m.hour,snapshotSHA256:digest,sites:rows.length,assigned:memberIds.size,active:rows.reduce((n,v)=>n+v.active,0),withDeliveries:rows.filter(v=>v.deliveredSourceIds.length).length}));
