/** Control-to-save technical audit, NOT experience/playtesting.
 * A saved fixture places the player beside a real existing source, never edits
 * terrain/source tables. Subsequent harvest uses actual mouse input and shipped UI.
 * Dev-only timing wrappers; no production code or gameplay law changes. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5173',out=process.env.SOH_HARVEST_AUDIT_OUT||'evidence/solo-final-fallback/20261117/technical-audit/harvest-ui.json';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),results=[];
function inspect(){for(const c of document.querySelectorAll('canvas')){let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f&&!f.memoizedProps?.gs)f=f.return;if(f?.memoizedProps.gs?.run)return f.memoizedProps.gs;}throw Error('game unavailable');}
try{
 const setup=await browser.newContext(),boot=await setup.newPage();await boot.route('**/__harvest_setup',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await boot.goto(base+'/__harvest_setup');
 const fixtures=await boot.evaluate(async()=>{
  const E=await import('/src/game/engine.ts'),W=await import('/src/game/world.ts'),P=await import('/src/game/persist.ts'),fixtures=[];
  for(const [layout,seed]of [['veyra05-at-1920-512',901],['veyra05-at-1840-1526',902]]){
   if(!W.setActiveLayout(layout))throw Error('layout unavailable');const gs=E.newGame(),at=Date.now();if(!E.startRun(gs,'female',at,null,seed).ok)throw Error('start failed');const r=gs.run,grid=E.blockGrid(r);if(r.layoutId!==layout)throw Error('fixture layout mismatch: '+r.layoutId);
   const empty=E.C(r,'inv').slots.slice(0,8).indexOf(null);if(empty<0)throw Error('no empty hotbar');r.player.active=empty;
   let chosen;
   for(let ty=35;ty<165&&!chosen;ty++)for(let tx=35;tx<165&&!chosen;tx++){
    const s=E.sourceAt(r,tx,ty,at);if(!s||s.def.mat!=='plant'||s.def.block||s.stock<=0||s.hp>6)continue;
    for(const [dx,dy]of [[-1,0]]){const x=(tx+dx)*16+8,y=(ty+dy)*16+8;
     if(grid[(ty+dy)*200+tx+dx]!==0||E.sourceAt(r,tx+dx,ty+dy)||!E.clearPhysicalLine(r,{x,y},{x:tx*16+8,y:ty*16+8})||r.creatures.some(m=>Math.hypot(m.x-x,m.y-y)<260))continue;
     chosen={tx,ty,key:s.key,stock:s.stock,hp:s.hp,yields:s.def.yields,x,y};break;
    }
   }
   if(!chosen)throw Error('no isolated plant fixture in '+layout);r.player.x=chosen.x;r.player.y=chosen.y;E.markDirty();
   fixtures.push({layout,seed,source:chosen,text:P.serializeSnapshot(gs)});
  }return fixtures;
 });await setup.close();
 console.log('FIXTURES',JSON.stringify(fixtures.map(({text,...f})=>f)));
 for(const fixture of fixtures.slice(Number(process.env.SOH_AUDIT_SCENE||0))){
  const context=await browser.newContext({viewport:{width:640,height:360}}),page=await context.newPage(),errors=[],badResources=[];page.setDefaultTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)badResources.push({status:r.status(),url:r.url()});});
  await page.addInitScript(text=>{
   localStorage.setItem('soh.state.v3',text);window.__audit={phase:'boot',calls:[],frames:[],tasks:[],encodes:[]};
   window.__auditTimed=(name,fn)=>{const at=performance.now(),p=window.__audit.phase;try{return fn();}finally{window.__audit.calls.push({name,p,ms:performance.now()-at});}};
   const enc=HTMLCanvasElement.prototype.toDataURL;HTMLCanvasElement.prototype.toDataURL=function(...a){return window.__auditTimed('encode',()=>enc.apply(this,a));};
   new PerformanceObserver(l=>window.__audit.tasks.push(...l.getEntries().map(e=>({p:window.__audit.phase,ms:e.duration,at:e.startTime})))).observe({type:'longtask',buffered:true});
   let prev;function frame(t){if(prev!==undefined)window.__audit.frames.push({p:window.__audit.phase,ms:t-prev});prev=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  },fixture.text);
  await page.route(/\/src\/game\/(sim|render|persist)\.ts(?:\?.*)?$/,async route=>{
   const response=await route.fetch(),path=new URL(route.request().url()).pathname;let text=await response.text();
   const names=path.endsWith('/sim.ts')?['tick','findInteract']:path.endsWith('/render.ts')?['draw','consumeFX']:['serializeSnapshot'];
   for(const name of names){const target=`export function ${name}(`;if(!text.includes(target))throw Error('timing seam changed '+name);text=text.replace(target,`function __audit_${name}(`)+`\nexport function ${name}(...a){return window.__auditTimed(${JSON.stringify(name)},()=>__audit_${name}(...a));}\n`;}
   await route.fulfill({response,body:text});
  });
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});await page.getByRole('button',{name:/^Continue/}).click();await page.locator('canvas').first().waitFor();await page.waitForTimeout(1500);const dismiss=page.getByRole('button',{name:'Got it',exact:true});if(await dismiss.isVisible())await dismiss.click();const close=page.getByRole('button',{name:'Close panel',exact:true});if(await close.first().isVisible())await close.first().click();
  const before=await page.evaluate(inspect);assert.equal(before.run.layoutId,fixture.layout); // read-only React observation, not a mutable QA handle
  await page.evaluate(()=>window.__audit.phase='idle');await page.waitForTimeout(4000);
  const aim=await page.evaluate(s=>{const v=window.__sohView();return{x:v.off.x+(s.tx*16+8-Math.round(v.cam.x))*v.scale,y:v.off.y+(s.ty*16+8-Math.round(v.cam.y))*v.scale};},fixture.source);
  console.log('AIM',JSON.stringify({aim,player:before.run.player,layout:before.run.layoutId,hit:await page.evaluate(a=>document.elementFromPoint(a.x,a.y)?.outerHTML.slice(0,500),aim)}));await page.mouse.move(aim.x,aim.y);await page.evaluate(()=>window.__audit.phase='harvest');await page.mouse.down();
  const idx=fixture.source.ty*200+fixture.source.tx;
  await page.waitForTimeout(5500);await page.mouse.up();
  const held=await page.evaluate(inspect),holdObservation={source:held.run.sources[idx]||null,active:held.run.custody.inv.slots[held.run.player.active],gather:held.run.player.skills.gather,phase:'after 5.5s held mouse'};
  console.log('HOLD_OBSERVATION',JSON.stringify(holdObservation));
  for(let tap=0;tap<30;tap++){
   const current=await page.evaluate(inspect);if(current.run.sources[idx]?.stock===0)break;
   await page.mouse.click(aim.x,aim.y);await page.waitForTimeout(450);
  }
  await page.mouse.up();await page.waitForTimeout(3000);
  const after=await page.evaluate(inspect);console.log('AFTER',JSON.stringify({player:after.run.player,source:after.run.sources[idx],recent:after.run.receipts.slice(-8)}));assert.equal(after.run.layoutId,fixture.layout);assert.equal(after.run.sources[idx]?.stock,0,'actual source must be depleted by UI taps');assert(after.run.receipts.some(r=>r.kind==='harvest'));
  const count=(r,key)=>Object.values(r.custody).reduce((n,c)=>n+c.slots.reduce((m,s)=>m+(s?.key===key?s.qty:0),0),0);
  for(const [key,qty]of fixture.source.yields)assert.equal(count(after.run,key)-count(before.run,key),qty*fixture.source.stock,'primary yield conservation '+key);
  const harvested=after.run.receipts.filter(r=>r.kind==='harvest').length;
  // Repeated taps on an exhausted source must not produce more units.
  for(let i=0;i<5;i++){await page.mouse.click(aim.x,aim.y);await page.waitForTimeout(350);}
  const repeat=await page.evaluate(inspect);assert.equal(repeat.run.receipts.filter(r=>r.kind==='harvest').length,harvested);
  await page.evaluate(()=>window.__audit.phase='inventory');await page.keyboard.press('KeyI');await page.getByRole('button',{name:'Sort Pack',exact:true}).waitFor();await page.keyboard.press('KeyI');
  await page.evaluate(()=>window.__audit.phase='save');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Save & quit to title',exact:true}).click();await page.getByRole('button',{name:/^Continue/}).waitFor();
  const saved=await page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('soh.state.v3')).payload));assert.equal(saved.run.sources[idx].stock,0);
  const metrics=await page.evaluate(()=>{const v=window.__audit,stats=a=>{a=a.slice().sort((x,y)=>x-y);return{count:a.length,p50:a[Math.floor(a.length*.5)]??null,p95:a[Math.floor(a.length*.95)]??null,max:a.at(-1)??null,total:a.reduce((x,y)=>x+y,0)}};const phases={};for(const phase of ['boot','idle','harvest','inventory','save']){const calls={};for(const name of ['tick','findInteract','draw','consumeFX','serializeSnapshot','encode'])calls[name]=stats(v.calls.filter(x=>x.p===phase&&x.name===name).map(x=>x.ms));phases[phase]={calls,frames:stats(v.frames.filter(x=>x.p===phase).map(x=>x.ms)),longTasks:v.tasks.filter(x=>x.p===phase)};}return phases;});
  const state=await context.storageState();await context.close();
  const fresh=await browser.newContext({viewport:{width:640,height:360},storageState:state}),next=await fresh.newPage();next.setDefaultTimeout(120000);next.on('pageerror',e=>errors.push(e.message));
  await next.goto(base);await next.getByRole('button',{name:/^Continue/}).click();await next.locator('canvas').first().waitFor();const resumed=await next.evaluate(inspect);
  assert.equal(resumed.run.sources[idx].stock,0);assert.deepEqual(resumed.run.custody,saved.run.custody);assert.equal(resumed.run.qaUsed,false);assert.equal(errors.length,0);assert.equal(badResources.length,0);
  const result={layout:fixture.layout,seed:fixture.seed,source:fixture.source,actualLayout:after.run.layoutId,holdObservation,scope:'Fixture snapshot positions at existing source; real mouse/fists/tick/FX/draw/UI/save; fresh context with actual localStorage continuation. No experience or natural acquisition claim. Timed dev build, software GPU, not production/physicalGPU FPS.',harvestReceipts:harvested,primaryYieldsConserved:true,exhaustionNoExtraYield:true,savedAndResumedCustodyExact:true,metrics,errors,badResources,status:'PASS_TECHNICAL_ONLY'};results.push(result);console.log(JSON.stringify(result));await fresh.close();
 }
}finally{await browser.close();mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify({results,scope:'Technical only; partial results retained on failure.'},null,2)+'\n');}
mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify({sourceSHA256:Object.fromEntries(['src/game/engine.ts','src/game/sim.ts','src/game/render.ts','src/game/persist.ts','src/ui/Game.tsx'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),results},null,2)+'\n');
