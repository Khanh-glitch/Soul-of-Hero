/** Production single-file bundle: ordinary movement + harvest attempt, technical only.
 * Fresh run from the shipped menu — no injected state, no QA flags, no fixtures.
 * Read-only observation of the run through the React fiber and window.__sohView();
 * all play is real keyboard/mouse. Software GPU dev machine: frame intervals here are
 * NOT physical-GPU FPS and this is not an experience/progression claim. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5195';
const out=process.env.SOH_PROD_FRAME_OUT||'evidence/solo-final-fallback/20261117/frame-work/production-movement';
mkdirSync(out,{recursive:true});
const idleMs=Number(process.env.SOH_PROD_IDLE||8000),moveMs=Number(process.env.SOH_PROD_MOVE||12000),harvestMs=Number(process.env.SOH_PROD_HARVEST||12000);
const sources=['src/game/engine.ts','src/game/render.ts','src/game/sim.ts','src/game/world.ts','src/veyra05/scenes.ts','src/veyra05/window.ts','src/veyra05/floors.ts','src/ui/Game.tsx'];
const record={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),htmlSha256:createHash('sha256').update(readFileSync('dist/index.html')).digest('hex'),
 sourceSHA256:Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),
 scope:'PRODUCTION_BUNDLE_ORDINARY_INPUT_ONLY; software GPU; not FPS/human/progression acceptance',errors:[],badResources:[],steps:[],phases:{}};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const inspect=page=>page.evaluate(()=>{
 for(const c of document.querySelectorAll('canvas')){const key=Object.keys(c).find(x=>x.startsWith('__reactFiber$'));let f=key?c[key]:null;
  while(f&&!f.memoizedProps?.gs)f=f.return;const gs=f?.memoizedProps?.gs;if(gs?.run)return gs.run;}return null;});
try{
 const context=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1}),page=await context.newPage();
 page.setDefaultTimeout(180000);page.on('pageerror',e=>record.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)record.badResources.push({status:r.status(),url:r.url()});});
 await page.addInitScript(()=>{
  window.__prod={phase:'boot',frames:[],tasks:[]};
  new PerformanceObserver(l=>window.__prod.tasks.push(...l.getEntries().map(e=>({p:window.__prod.phase,ms:e.duration})))).observe({type:'longtask',buffered:true});
  let prev;function frame(t){if(prev!==undefined)window.__prod.frames.push({p:window.__prod.phase,ms:t-prev});prev=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'New run',exact:true}).click();
 await page.getByRole('button',{name:'Begin the 14 days',exact:true}).click();
 await page.locator('canvas').first().waitFor();await page.waitForTimeout(1500);
 const dismiss=page.getByRole('button',{name:'Got it',exact:true});if(await dismiss.isVisible().catch(()=>false))await dismiss.click();
 const close=page.getByRole('button',{name:'Close panel',exact:true});if(await close.first().isVisible().catch(()=>false))await close.first().click();
 const started=await inspect(page);assert(started,'run observable through the shipped UI');assert.equal(started.qaUsed,false);
 record.run={id:started.id,seed:started.seed,layout:started.layoutId,digest:started.sourceMap?.digest,qaUsed:started.qaUsed,player:[Math.round(started.player.x),Math.round(started.player.y)]};
 record.steps.push('fresh menu start, no injected state');
 await page.screenshot({path:out+'/spawn-640x360.png'});
 const phase=async(name,ms,act)=>{
  await page.evaluate(p=>{window.__prod.phase=p;window.__prod.start=performance.now();},name);
  const at=Date.now();await act(ms);
  const stats=await page.evaluate(()=>{const f=window.__prod.frames.filter(x=>x.p===window.__prod.phase).map(x=>x.ms).sort((a,b)=>a-b);
   const q=p=>f.length?f[Math.min(f.length-1,Math.floor(f.length*p))]:null;
   return {frames:f.length,p50:q(.5),p95:q(.95),max:f.at(-1)??null,longTasks:window.__prod.tasks.filter(t=>t.p===window.__prod.phase).map(t=>Math.round(t.ms))};});
  record.phases[name]={wallMs:Date.now()-at,...stats};
 };
 await phase('idle',idleMs,ms=>page.waitForTimeout(ms));
 // Movement: real keys, two directions, camera crosses terrain-chunk boundaries.
 await phase('movement',moveMs,async ms=>{await page.keyboard.down('KeyD');await page.waitForTimeout(ms/2);await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyS');await page.waitForTimeout(ms/2-200);await page.keyboard.up('KeyS');});
 record.steps.push('held D then S (ordinary movement)');
 // Harvest: find a real interactable by sweeping the mouse and reading the shipped target hook.
 let target=null,aim=null;
 for(let ry=0;ry<7&&!target;ry++)for(let rx=0;rx<11&&!target;rx++){
  const x=180+rx*28,y=120+ry*24;await page.mouse.move(x,y);await page.waitForTimeout(45);
  const t=await page.evaluate(()=>window.__sohView?.().target||null);
  if(t){target=t;aim={x,y};}
 }
 record.harvestTarget=target;record.harvestAim=aim;
 if(target&&aim){
  await phase('harvest',harvestMs,async ms=>{await page.mouse.move(aim.x,aim.y);await page.mouse.down();await page.waitForTimeout(ms*0.6);await page.mouse.up();
   for(let i=0;i<6;i++){await page.mouse.click(aim.x,aim.y);await page.waitForTimeout((ms*0.4)/6);}});
  record.steps.push('held then clicked LMB on an observed real target');
 }else{
  await phase('harvest-no-target',harvestMs,async ms=>{await page.mouse.move(320,180);await page.mouse.down();await page.waitForTimeout(ms/2);await page.mouse.up();await page.waitForTimeout(ms/2);});
  record.steps.push('no interactable found by the sweep: held LMB at screen centre instead');
 }
 const after=await inspect(page);assert(after,'run still observable');
 record.after={player:[Math.round(after.player.x),Math.round(after.player.y)],movedPx:Math.round(Math.hypot(after.player.x-started.player.x,after.player.y-started.player.y)),
  harvestReceipts:after.receipts.filter(r=>r.kind==='harvest').length,receiptKinds:[...new Set(after.receipts.map(r=>r.kind))].slice(-14),
  drops:Object.values(after.entities).filter(e=>e.kind==='drop').length,entities:Object.keys(after.entities).length,
  inventory:Object.values(after.custody?.inv?.slots??[]).filter(Boolean).map(s=>[s.key,s.qty]),qaUsed:after.qaUsed};
 assert.equal(after.qaUsed,false,'no QA preset may be used');
 assert(after.receipts.length>0,'a real run must have committed receipts');
 await page.screenshot({path:out+'/after-play-640x360.png'});
 // Save and resume in a FRESH browser process, then confirm the run survived intact.
 await page.keyboard.press('Escape');
 const save=page.getByRole('button',{name:'Save & quit to title',exact:true});
 if(await save.isVisible().catch(()=>false)){
  await save.click();await page.getByRole('button',{name:/^Continue/}).waitFor();
  const storageState=await context.storageState();await browser.close();
  const browser2=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context2=await browser2.newContext({viewport:{width:640,height:360},deviceScaleFactor:1,storageState}),page2=await context2.newPage();
  page2.setDefaultTimeout(180000);page2.on('pageerror',e=>record.errors.push(e.message));
  await page2.goto(base,{waitUntil:'domcontentloaded'});await page2.getByRole('button',{name:/^Continue/}).click();await page2.locator('canvas').first().waitFor();await page2.waitForTimeout(600);
  const resumed=await inspect(page2);assert(resumed,'resumed run observable');
  record.resumed={id:resumed.id,seed:resumed.seed,layout:resumed.layoutId,digest:resumed.sourceMap?.digest,qaUsed:resumed.qaUsed,player:[Math.round(resumed.player.x),Math.round(resumed.player.y)],harvestReceipts:resumed.receipts.filter(r=>r.kind==='harvest').length};
  assert.equal(record.resumed.seed,record.run.seed,'seed preserved');
  assert.equal(record.resumed.layout,record.run.layout,'layout preserved');
  assert.equal(record.resumed.qaUsed,false);
  assert(Math.hypot(record.resumed.player[0]-record.after.player[0],record.resumed.player[1]-record.after.player[1])<2,'position preserved across save/resume');
  await page2.screenshot({path:out+'/resumed-640x360.png'});
  record.steps.push('saved, quit, resumed in a fresh browser process');
  await context2.close();await browser2.close();
 }else record.steps.push('save button not visible; save/resume step skipped');
 assert.deepEqual(record.errors,[],'no page errors');assert.deepEqual(record.badResources,[],'no failed resources');
 record.status='PASS_TECHNICAL_SMOKE_ONLY';
}catch(e){record.status='FAIL';record.failure=String(e);process.exitCode=1;}
finally{await browser.close().catch(()=>{});writeFileSync(out+'/manifest.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record,null,2));}
