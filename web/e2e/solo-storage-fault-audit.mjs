/** Technical real-browser storage fault/recovery matrix. No experience evaluation.
 * All faults are test-only prototype hooks, in isolated browser contexts. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5173',out=process.env.SOH_AUDIT_OUT||'evidence/solo-final-fallback/20261117/technical-audit/storage-faults.json';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}),results=[];
try{
 for(const fault of ['healthy-concurrent','local-quota','idb-write','both-write','invalid-uid','readback-conflict']){
  const ctx=await browser.newContext(),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/__storage_audit',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Storage audit</title>'}));await p.goto(base+'/__storage_audit');
  const result=await p.evaluate(async fault=>{
   const E=await import('/src/game/engine.ts'),W=await import('/src/game/world.ts'),P=await import('/src/game/persist.ts');if(!W.setActiveLayout('veyra05-at-1920-512'))throw Error('layout unavailable');
   const gs=E.newGame(),at=Date.UTC(2026,10,17,12);if(!E.startRun(gs,'female',at,null,901).ok)throw Error('start failed');
   if(gs.run.layoutId!=='veyra05-at-1920-512')throw Error('fixture layout mismatch: '+gs.run.layoutId);
   if(E.addItem(gs.run,'inv','wood',1)!==0)throw Error('fixture capacity');
   const good=await P.saveDetailed(gs);if(!good.ok)throw Error('initial save failed');
   const key='soh.state.v3',prior=localStorage.getItem(key),before=E.countItem(gs.run,'inv','wood'),outcomes=[];
   let writes=0;const put=IDBObjectStore.prototype.put,set=Storage.prototype.setItem,get=Storage.prototype.getItem;
   IDBObjectStore.prototype.put=function(...args){writes++;if(['idb-write','both-write'].includes(fault))throw new DOMException('test fault','UnknownError');return put.apply(this,args);};
   Storage.prototype.setItem=function(k,v){writes++;if(/^soh.state/.test(k)&&['local-quota','both-write'].includes(fault))throw new DOMException('test quota','QuotaExceededError');return set.call(this,k,v);};
   Storage.prototype.getItem=function(k){if(k===key&&fault==='readback-conflict')return prior;return get.call(this,k);};
   E.addItem(gs.run,'inv','wood',1);
   if(fault==='invalid-uid'){
    const inv=E.C(gs.run,'inv'),s=inv.slots.find(s=>s?.key==='wood'),i=inv.slots.indexOf(null);if(i<0)throw Error('fixture no empty slot');inv.slots[i]={...s};
   }
   const started=performance.now(),first=P.saveDetailed(gs);let expected=before+1;
   if(fault==='healthy-concurrent'){E.addItem(gs.run,'inv','wood',1);const second=P.saveDetailed(gs);outcomes.push(...await Promise.all([first,second]));expected++;}else outcomes.push(await first);
   const elapsed=performance.now()-started;
   if(fault==='invalid-uid'||fault==='both-write')expected=before;
   IDBObjectStore.prototype.put=put;Storage.prototype.setItem=set;Storage.prototype.getItem=get;
   return {actualLayout:gs.run.layoutId,fault,outcomes,elapsedMs:elapsed,writes,expected,priorLocalPreserved:localStorage.getItem(key)===prior,bytes:new Blob([localStorage.getItem(key)||'']).size};
  },fault);
  await p.reload();
  result.recovered=await p.evaluate(async()=>{const P=await import('/src/game/persist.ts'),E=await import('/src/game/engine.ts'),v=await P.load();return {loaded:!!v.gs,wood:v.gs?.run?E.countItem(v.gs.run,'inv','wood'):null,note:v.note||null,valid:!!v.gs&&!!P.validate(v.gs)};});
  assert.equal(result.recovered.wood,result.expected,fault+' recovered quantity');assert.equal(result.recovered.valid,true);assert.equal(errors.length,0);
  for(const o of result.outcomes)assert.equal(o.ok,!['invalid-uid','both-write'].includes(fault));
  if(fault==='invalid-uid'){assert.equal(result.writes,0);assert.equal(result.priorLocalPreserved,true);}
  if(fault==='both-write')assert.equal(result.priorLocalPreserved,true);
  if(fault==='local-quota')assert.equal(result.outcomes[0].idbStatus,'ok');
  if(fault==='idb-write')assert.equal(result.outcomes[0].localStatus,'ok');
  results.push({...result,errors,status:'PASS'});console.log(JSON.stringify(results.at(-1)));await ctx.close();
 }
}finally{await browser.close();}
mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify({scope:'TECHNICAL_STORAGE_ONLY; fixture materials, simulated write failures, real localStorage/IndexedDB, actual page reload. Not experience, multi-device, endurance or release acceptance.',persistSHA256:createHash('sha256').update(readFileSync('src/game/persist.ts')).digest('hex'),results},null,2)+'\n');
