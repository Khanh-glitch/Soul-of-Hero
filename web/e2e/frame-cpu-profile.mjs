/** Real-play frame attribution: CDP CPU sampling + per-call timing wrappers.
 * Fixture positions the player beside an existing Veyra plant source (never edits
 * terrain/source tables); all input is real keyboard/mouse through the shipped UI.
 * Dev-only instrumentation served at the network seam; production files untouched.
 * Software GPU dev build: NOT a physical-GPU FPS or experience claim. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5193';
const out=process.env.SOH_FRAME_CPU_OUT||'evidence/solo-final-fallback/20261117/frame-work/cpu-profile.json';
const scenarios=(process.env.SOH_FRAME_SCENARIOS||'harvest,movement').split(',');
const variant=process.env.SOH_FRAME_RENDER_VARIANT||'after';
const useCdp=process.env.SOH_FRAME_CDP!=='0';
const useCounters=process.env.SOH_FRAME_COUNTERS!=='0';
const samplingIntervalUs=Number(process.env.SOH_FRAME_CDP_INTERVAL||200);
const idleMs=Number(process.env.SOH_FRAME_IDLE_MS||8000),scenarioMs=Number(process.env.SOH_FRAME_SCENARIO_MS||24000),settleMs=Number(process.env.SOH_FRAME_SETTLE_MS||8000);
assert(['before','after'].includes(variant),'render variant must be before|after');
mkdirSync('.cache/frame-baseline',{recursive:true});
// HEAD moved when the render optimisation was committed: the `before` variant pins the ref the
// recorded evidence used and refuses a byte-identical (vacuous) self-comparison.
const renderBaseRef=execFileSync('git',['rev-parse',process.env.SOH_BASE_REF||'53c168808e4264c39625ad3bd409211de005dfa7'],{encoding:'utf8'}).trim();
if(variant==='before'){
 const head=execFileSync('git',['show',renderBaseRef+':web/src/game/render.ts'],{encoding:'utf8'});
 if(head===readFileSync('src/game/render.ts','utf8'))throw Error(`vacuous comparison: render.ts at SOH_BASE_REF ${renderBaseRef} is byte-identical to the working tree; pass a pre-patch ref`);
 writeFileSync('.cache/frame-baseline/render.ts',head.replace(/(['"])\.\.\/([^'"]+)(['"])/g,(_,q,p,r)=>q+'/src/'+p+r).replace(/(['"])\.\/([^'"]+)(['"])/g,(_,q,p,r)=>q+'/src/game/'+p+r));
}
const launch=()=>chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--js-flags=--max-old-space-size=3072']});
let browser=await launch();
const inspect=()=>{for(const c of document.querySelectorAll('canvas')){let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f&&!f.memoizedProps?.gs)f=f.return;if(f?.memoizedProps.gs?.run)return f.memoizedProps.gs;}throw Error('game unavailable');};
function profileTotals(profile){
 const byId=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map();
 for(const n of profile.nodes)for(const c of n.children||[])parent.set(c,n.id);
 const self=new Map();
 for(let i=0;i<profile.samples.length;i++){const id=profile.samples[i],dt=profile.timeDeltas[i]||0;self.set(id,(self.get(id)||0)+dt);}
 const total=new Map();
 for(const [id,ms] of self){let cur=id;const seen=new Set();while(cur!==undefined&&!seen.has(cur)){seen.add(cur);total.set(cur,(total.get(cur)||0)+ms);cur=parent.get(cur);}}
 const key=id=>{const f=byId.get(id)?.callFrame||{};const url=(f.url||'').split('/').slice(-2).join('/');return `${f.functionName||'(anonymous)'} @${url}:${(f.lineNumber??-1)+1}`};
 const agg=(map)=>{const o={};for(const [id,us] of map)o[key(id)]=(o[key(id)]||0)+us/1000;return Object.entries(o).sort((a,b)=>b[1]-a[1]);};
 const fileOf=name=>{const m=/@([^:]*):/.exec(name);const url=m?m[1]:'';for(const f of ['game/render','game/sim','game/engine','game/world','game/art','game/pixelfx','game/compositor','game/item-atlas','living/life','visual/direction','veyra05','react-dom','scheduler','ui/','game/primordials','game/vfx'])if(url.includes(f))return f;return url.includes(':')?'(native/idle/gc)':'other:'+url};
 const byFile={};for(const [name,ms] of agg(self))byFile[fileOf(name)]=(byFile[fileOf(name)]||0)+ms;
 const edges=new Map();
 for(let i=0;i<profile.samples.length;i++){const dt=profile.timeDeltas[i]||0;let child=profile.samples[i];const seen=new Set();
  while(child!==undefined&&!seen.has(child)){seen.add(child);const par=parent.get(child);if(par!==undefined){const k=key(par)+'  ->  '+key(child);edges.set(k,(edges.get(k)||0)+dt/1000);}child=par;}}
 const topEdges=[...edges.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30);
 return {topEdges,durationMs:(profile.timeDeltas||[]).reduce((a,b)=>a+b,0)/1000,samples:profile.samples.length,topSelf:agg(self).slice(0,30),topTotal:agg(total).slice(0,25),selfMsByFile:Object.fromEntries(Object.entries(byFile).sort((a,b)=>b[1]-a[1]))};
}
const results=[];const countedSeams=new Set();
try{
 browser=await launch();
 const setup=await browser.newContext(),boot=await setup.newPage();
 await boot.route('**/__frame_boot',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await boot.goto(base+'/__frame_boot');
 const fixture=await boot.evaluate(async()=>{
  const E=await import('/src/game/engine.ts'),W=await import('/src/game/world.ts'),P=await import('/src/game/persist.ts');
  if(!W.setActiveLayout('veyra05-at-1920-512'))throw Error('layout unavailable');
  const gs=E.newGame(),at=Date.now();if(!E.startRun(gs,'female',at,null,901).ok)throw Error('start failed');
  const r=gs.run;if(r.layoutId!=='veyra05-at-1920-512')throw Error('fixture layout mismatch: '+r.layoutId);
  const grid=E.blockGrid(r),empty=E.C(r,'inv').slots.slice(0,8).indexOf(null);if(empty<0)throw Error('no empty hotbar');r.player.active=empty;
  // Selection only: among real, reachable plant sources pick the richest stock so
  // the measured phase contains actual repeated harvesting. Tables are never edited.
  const candidates=[];
  for(let ty=35;ty<165;ty++)for(let tx=35;tx<165;tx++){
   const s=E.sourceAt(r,tx,ty,at);if(!s||s.def.mat!=='plant'||s.def.block||s.stock<=0||s.hp>6)continue;
   const x=(tx-1)*16+8,y=ty*16+8;
   if(grid[ty*200+tx-1]!==0||E.sourceAt(r,tx-1,ty)||!E.clearPhysicalLine(r,{x,y},{x:tx*16+8,y:ty*16+8})||r.creatures.some(m=>Math.hypot(m.x-x,m.y-y)<260))continue;
   candidates.push({tx,ty,key:s.key,stock:s.stock,yields:s.def.yields,x,y});
   if(candidates.length>=400)break;
  }
  const chosen=candidates.sort((a,b)=>b.stock-a.stock||a.ty-b.ty||a.tx-b.tx)[0];
  if(!chosen)throw Error('no isolated plant fixture');
  const candidateStocks=candidates.slice(0,12).map(c=>c.stock);
  r.player.x=chosen.x;r.player.y=chosen.y;E.markDirty();
  return {layout:r.layoutId,seed:r.seed,source:chosen,candidates:candidates.length,candidateStocks,text:P.serializeSnapshot(gs)};
 });await setup.close();
 console.log('FIXTURE',JSON.stringify({layout:fixture.layout,seed:fixture.seed,source:fixture.source}));
 for(const scenario of scenarios){
  if(browser)await browser.close().catch(()=>{});browser=await launch();
  const context=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1}),page=await context.newPage(),errors=[],badResources=[];
  page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)badResources.push({status:r.status(),url:r.url()});});
  await page.addInitScript(text=>{
   localStorage.setItem('soh.state.v3',text);
   window.__counts=window.__counts||{windowForLayout:0,getWindowWorld:0,getWindowWorldForGlobalTile:0,getWorld:0,cellClass:0,blockGrid:0,blockRebuilds:0,blockRebuildMs:0,sourceAt:0,effTile:0,__t0:0};
   window.__frame={phase:'boot',calls:[],frames:[],tasks:[],chunkMs:0,chunkCalls:0,chunkInvalidations:0,syncMs:0,syncCalls:0,sigRebuilds:0};
   window.__timed=(name,fn)=>{const at=performance.now(),p=window.__frame.phase;try{return fn();}finally{window.__frame.calls.push({name,p,ms:performance.now()-at});}};
   new PerformanceObserver(l=>window.__frame.tasks.push(...l.getEntries().map(e=>({p:window.__frame.phase,ms:e.duration,at:e.startTime})))).observe({type:'longtask',buffered:true});
   let prev;function frame(t){if(prev!==undefined)window.__frame.frames.push({p:window.__frame.phase,ms:t-prev});prev=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  },fixture.text);
  await page.route(/\/src\/game\/(sim|render|persist)\.ts(?:\?.*)?$/,async route=>{
   const url=new URL(route.request().url()),path=url.pathname;let text;
   if(variant==='before'&&path.endsWith('/render.ts')){const r=await route.fetch({url:base+'/.cache/frame-baseline/render.ts'});if(r.status()!==200)throw Error('baseline transform failed');text=await r.text();}
   else text=await (await route.fetch()).text();
   const names=path.endsWith('/sim.ts')?['tick','findInteract']:path.endsWith('/render.ts')?['draw','consumeFX']:['serializeSnapshot'];
   for(const name of names){const target=`export function ${name}(`;if(!text.includes(target))throw Error('timing seam changed '+name);text=text.replace(target,`function __timed_${name}(`)+`\nexport function ${name}(...a){return window.__timed(${JSON.stringify(name)},()=>__timed_${name}(...a));}\n`;}
   if(path.endsWith('/render.ts')){
    // Seams match Vite's TRANSFORMED module text (types stripped), not the TS source.
    const gen=/if \(!c\) \{\s*c = renderChunk\(r, cx, cy\);\s*chunkCache\.set\(k, c\);\s*\}/;
    if(!gen.test(text))throw Error('chunk generation seam changed');
    text=text.replace(gen,'if (!c) { const __t = performance.now(); c = renderChunk(r, cx, cy); window.__frame.chunkMs += performance.now() - __t; window.__frame.chunkCalls++; chunkCache.set(k, c); }');
    const inv=/for \(const \[dx, dy\] of \[\[0, 0\], \[1, 0\], \[-1, 0\], \[0, 1\], \[0, -1\]\]\) chunkCache\.delete\(\(\(ty \+ dy\) \/ CH \| 0\) \* 100 \+ \(\(tx \+ dx\) \/ CH \| 0\)\);/;
    if(!inv.test(text))throw Error('chunk invalidation seam changed');
    text=text.replace(inv,'for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { chunkCache.delete(((ty + dy) / CH | 0) * 100 + ((tx + dx) / CH | 0)); window.__frame.chunkInvalidations++; }');
    const sig=/const sig = Object\.keys\(r\.terrain\)\.map\(\(k\) => k \+ ":" \+ r\.terrain\[\+k\]\.t\)\.join\(","\);/;
    if(!sig.test(text))throw Error('terrain signature seam changed');
    text=text.replace(sig,'window.__frame.sigRebuilds++; const sig = Object.keys(r.terrain).map((k) => k + ":" + r.terrain[+k].t).join(",");');
    const sync=/function syncTerrain\(r, now\) \{/;
    if(!sync.test(text))throw Error('syncTerrain seam changed');
    text=text.replace(sync,'function syncTerrain(r, now) { const __t = performance.now(); try { __syncTerrain(r, now); } finally { window.__frame.syncMs += performance.now() - __t; window.__frame.syncCalls++; } }\nfunction __syncTerrain(r, now) {');
   }
   await route.fulfill({status:200,contentType:'text/javascript',body:text});
  });
  // Call-frequency counters: identical seams in every variant, transformed text.
  if(useCounters)await page.route(/\/src\/(veyra05\/(scenes|window|floors)|game\/(world|engine))\.ts(?:\?.*)?$/,async route=>{
   const path=new URL(route.request().url()).pathname;let text=await (await route.fetch()).text();
   const seams=[
    [/export function windowForLayout\([^)]*\) \{/,'windowForLayout','window.__counts.windowForLayout++;'],
    [/export function getWindowWorld\([^)]*\) \{/,'getWindowWorld','window.__counts.getWindowWorld++;'],
    [/export function getWindowWorldForGlobalTile\([^)]*\) \{/,'getWindowWorldForGlobalTile','window.__counts.getWindowWorldForGlobalTile++;'],
    [/export function getWorld\([^)]*\) \{/,'getWorld','window.__counts.getWorld++;'],
    [/function cellClass\([^)]*\) \{/,'cellClass','window.__counts.cellClass++;'],
    [/export function blockGrid\([^)]*\) \{/,'blockGrid','window.__counts.blockGrid++;'],
    [/export function sourceAt\([^)]*\) \{/,'sourceAt','window.__counts.sourceAt++;'],
    [/export function effTile\([^)]*\) \{/,'effTile','window.__counts.effTile++;'],
   ];
   for(const [re,name,inc] of seams)if(re.test(text)){text=text.replace(re,m=>m+inc);countedSeams.add(name);}
   for(const must of [['/engine.ts',['cellClass','blockGrid','sourceAt','effTile']],['/world.ts',['getWorld']],['/scenes.ts',['windowForLayout']],['/window.ts',['getWindowWorld']],])
    if(path.endsWith(must[0]))for(const name of must[1])if(!countedSeams.has(name))throw Error('counter seam missing for '+name+' in '+path);
   if(path.endsWith('/engine.ts')){
    const hit=/if \(blockCache &&[^\n]*return blockCache\.arr;\n/;
    if(!hit.test(text))throw Error('blockGrid cache-hit seam changed');
    text=text.replace(hit,m=>m+'  window.__counts.blockRebuilds++; window.__counts.__t0 = performance.now();\n');
    const fin=/blockDirty = false;\n  return arr;/;
    if(!fin.test(text))throw Error('blockGrid finalize seam changed');
    text=text.replace(fin,'blockDirty = false;\n  window.__counts.blockRebuildMs += performance.now() - window.__counts.__t0;\n  return arr;');
   }
   await route.fulfill({status:200,contentType:'text/javascript',body:text});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/^Continue/}).click();await page.locator('canvas').first().waitFor();await page.waitForTimeout(1500);
  const dismiss=page.getByRole('button',{name:'Got it',exact:true});if(await dismiss.isVisible().catch(()=>false))await dismiss.click();
  const close=page.getByRole('button',{name:'Close panel',exact:true});if(await close.first().isVisible().catch(()=>false))await close.first().click();
  const opened=await page.evaluate(inspect);assert.equal(opened.run.layoutId,fixture.layout,'actual run layout');assert.equal(opened.run.seed,fixture.seed,'actual run seed');
  const cdp=useCdp?await context.newCDPSession(page):null;
  if(cdp){await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:samplingIntervalUs});}
  const phases=[],counters=[];
  const readCounters=()=>page.evaluate(()=>{const f=window.__frame,c=window.__counts;return {chunkMs:f.chunkMs,chunkCalls:f.chunkCalls,chunkInvalidations:f.chunkInvalidations,syncMs:f.syncMs,syncCalls:f.syncCalls,sigRebuilds:f.sigRebuilds,calls:Object.fromEntries(Object.entries(c).filter(([k])=>k!=='__t0'))};});
  const begin=async phase=>{await page.evaluate(p=>{window.__frame.phase=p;},phase);const c=await readCounters();counters.push({phase,c});if(cdp)await cdp.send('Profiler.start');};
  const end=async phase=>{const profile=cdp?(await cdp.send('Profiler.stop')).profile:null;const c=await readCounters();counters.push({phase,c,end:true});phases.push({phase,cpu:profile?profileTotals(profile):null});};
  const aim=await page.evaluate(s=>{const v=window.__sohView();return{x:v.off.x+(s.tx*16+8-Math.round(v.cam.x))*v.scale,y:v.off.y+(s.ty*16+8-Math.round(v.cam.y))*v.scale};},fixture.source);
  await begin('idle');await page.waitForTimeout(idleMs);await end('idle');
  await begin(scenario);
  const inputLog=[];
  if(scenario==='harvest'){
   await page.mouse.move(aim.x,aim.y);inputLog.push({at:'harvest',action:'mouse.move+down',aim});
   await page.mouse.down();await page.waitForTimeout(scenarioMs/2);await page.mouse.up();
   for(let tap=0;tap<Math.floor(scenarioMs/2/500);tap++){await page.mouse.click(aim.x,aim.y);await page.waitForTimeout(460);}
   inputLog.push({action:'held LMB then repeated clicks on the same real source'});
  }else if(scenario==='movement'){
   for(const key of ['KeyD','KeyS','KeyA','KeyW']){await page.keyboard.down(key);await page.waitForTimeout(scenarioMs/4);await page.keyboard.up(key);inputLog.push({action:'hold '+key,ms:scenarioMs/4});}
  }else throw Error('unknown scenario '+scenario);
  await end(scenario);
  await begin('settle');await page.waitForTimeout(settleMs);await end('settle');
  const observed=await page.evaluate(inspect);
  const metrics=await page.evaluate(()=>{const v=window.__frame,stats=a=>{a=a.slice().sort((x,y)=>x-y);return{count:a.length,p50:a[Math.floor(a.length*.5)]??null,p95:a[Math.floor(a.length*.95)]??null,p99:a[Math.floor(a.length*.99)]??null,max:a.at(-1)??null,total:a.reduce((x,y)=>x+y,0)};};
   const out={};for(const p of ['boot','idle','harvest','movement','settle']){const frames=v.frames.filter(f=>f.p===p);if(!frames.length&&!v.calls.some(c=>c.p===p))continue;const calls={};for(const name of ['tick','draw','findInteract','consumeFX','serializeSnapshot'])calls[name]=stats(v.calls.filter(c=>c.p===p&&c.name===name).map(c=>c.ms));out[p]={frames:stats(frames.map(f=>f.ms)),calls,longTasks:v.tasks.filter(t=>t.p===p).map(t=>Math.round(t.ms)),heap:performance.memory?.usedJSHeapSize};}return out;});
  const counterDeltas=Object.fromEntries(scenarios.length?['idle',scenario,'settle'].map(p=>{const list=counters.filter(c=>c.phase===p);const first=list[0]?.c,last=list.at(-1)?.c;return [p,last&&first?Object.fromEntries(Object.keys(last).map(k=>[k,k==='calls'?Object.fromEntries(Object.keys(last.calls).map(n=>[n,last.calls[n]-first.calls[n]])):+(last[k]-first[k]).toFixed(2)])):null];}):[]);
  const state={layout:observed.run.layoutId,seed:observed.run.seed,player:[Math.round(observed.run.player.x),Math.round(observed.run.player.y)],sourceStock:observed.run.sources[fixture.source.ty*200+fixture.source.tx]?.stock??null,harvestReceipts:observed.run.receipts.filter(r=>r.kind==='harvest').length,drops:Object.values(observed.run.entities).filter(e=>e.kind==='drop').length,qaUsed:observed.run.qaUsed};
  results.push({scenario,variant,countedSeams:[...countedSeams],fixture:{layout:fixture.layout,seed:fixture.seed,source:fixture.source},aim,inputLog,metrics,counterDeltas,phases,state,errors,badResources});
  console.log(JSON.stringify({scenario,variant,metrics:Object.fromEntries(Object.entries(metrics).map(([p,v])=>[p,{frames:v.frames,tick:v.calls.tick,draw:v.calls.draw,longTasks:v.longTasks.length}])),counterDeltas,state,errors}));
  mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});
  writeFileSync(out,JSON.stringify({renderBaseRef,scope:'Real-play CPU attribution on a seeded Veyra fixture. Dev build, software SwiftShader, timing wrappers and CDP sampling add small overhead; NOT physical-GPU FPS, natural-acquisition or experience evidence. before=render.ts at renderBaseRef served from cache, after=current working tree.',samplingIntervalUs,idleMs,scenarioMs,settleMs,sourceSHA256:Object.fromEntries(['src/game/engine.ts','src/game/render.ts','src/game/sim.ts','src/game/persist.ts','src/ui/Game.tsx'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),results},null,2)+'\n');
  await context.close();
 }
}finally{await browser.close();}
