// Compare two engine revisions with the same serialized ordinary run and exact hourly stops.
// From web/: node scripts/npc-follow-checkpoint.mjs WEB_ROOT SAVE.gz ACTOR END_HOUR REPORT.json
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createServer} from 'vite';
const [rootArg,save,id,endArg,out]=process.argv.slice(2),root=resolve(rootArg),end=Number(endArg);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=gunzipSync(readFileSync(save));
const vite=await createServer({root,configFile:join(root,'vite.http.config.ts'),server:{middlewareMode:true,hmr:false}});
try{
  const mod=file=>vite.ssrLoadModule(`/src/game/${file}.ts`);
  const {selectSnapshots}=await mod('persist'),{setActiveLayout}=await mod('world'),{settle}=await mod('sim');
  const {beginReceiptSink,endReceiptSink,findRunEntity}=await mod('engine');
  const gs=selectSnapshots([bytes.toString()]).gs,r=gs?.run,h=r?.humanWorld?.people[id];
  assert.ok(h && !r.qaUsed && h.community && setActiveLayout(r.layoutId));
  const hw=r.humanWorld,c=hw.communities[h.community],hour=()=> (r.clock.lastSimAt-r.startedAt)/3600000;
  assert.ok(Number.isInteger(hour())&&Number.isInteger(end)&&end>hour()&&end<336);
  const fingerprint=Object.fromEntries(['human-jobs','humanworld'].map(name=>[name,digest(readFileSync(join(root,`src/game/${name}.ts`)))]));
  const observe=()=>({hour:hour(),position:[h.gx,h.gy,h.floor],state:h.state,hp:h.hp,thirst:h.thirst,hunger:h.hunger,
    communityStates:Object.fromEntries(c.memberIds.map(id=>[id,hw.people[id].state])),barrel:c.rainBarrelId??null,water:findRunEntity(r,c.rainBarrelId)?.water??null});
  const report={scope:'Hourly settle from preserved checkpoint; no edited actors, weather or custody. Not a new game or an ending.',saveSHA256:digest(bytes),fingerprint,seed:r.seed,run:r.id,actor:id,community:c.id,endHour:end,hours:[observe()]};
  for(let n=hour()+1;n<=end;n++){
    beginReceiptSink();let rows;try{settle(gs,r.startedAt+n*3600000,true);}finally{rows=endReceiptSink();}
    assert.equal(hour(),n);report.hours.push({...observe(),drinks:rows.filter(e=>e.kind==='human.barrel.drink'&&e.detail.startsWith(`${id}:`)).map(e=>[e.at,e.detail]),
      firstAppeal:rows.find(e=>e.kind==='human.water.appeal'&&JSON.parse(e.detail).requester===id)});
    writeFileSync(out+'.tmp',JSON.stringify(report,null,2)+'\n');renameSync(out+'.tmp',out);console.log(c.poi,n,h.state,h.hp,h.thirst);
  }
}finally{await vite.close();}
