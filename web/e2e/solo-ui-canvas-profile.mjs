/** Serial ABBA: direct canvas UI vs exact HEAD PNG UI. No experience evaluation.
 * Fixed seeded Veyra snapshot, frozen wall clock, phase deadlines include input
 * latency (legacy flush must not give its world an extra 20s of GPU age).
 * Run on a freshly started Vite server: avoids HMR singleton duplication.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5190',out=process.env.SOH_UI_CANVAS_OUT||'evidence/solo-final-fallback/20261117/ui-canvas/profile.json';
const settleFrames=Number(process.env.SOH_UI_CANVAS_SETTLE_FRAMES||0),dwell=Number(process.env.SOH_UI_CANVAS_DWELL_MS||30000),epoch=Date.UTC(2026,10,17,12),samples=[];
const baselineRef=process.env.SOH_UI_PNG_BASE_REF||'53c168808e4264c39625ad3bd409211de005dfa7';
const names=['common','SurvivorScreen','panels','BuildBar','VehicleConsole'];
mkdirSync('.cache/ui-png-baseline',{recursive:true});
for(const name of names){let text=execFileSync('git',['show',`${baselineRef}:web/src/ui/${name}.tsx`],{encoding:'utf8'});text=text.replace(/(['"])\.\.\/([^'"]+)\1/g,(_,q,p)=>q+'/src/'+p+q).replace(/(['"])\.\/([^'"]+)\1/g,(_,q,p)=>q+'/src/ui/'+p+q);writeFileSync(`.cache/ui-png-baseline/${name}.tsx`,text);}
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const inspect=()=>{for(const c of document.querySelectorAll('canvas')){let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f&&!f.memoizedProps?.gs)f=f.return;if(f?.memoizedProps.gs?.run)return f.memoizedProps.gs;}throw Error('no game');};
function persist(){mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify({baseHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineUIRef:baselineRef,dwell,settleFrames,sourceSHA256:Object.fromEntries(['src/ui/common.tsx','src/index.css','src/game/art.ts','src/game/render.ts',...names.slice(1).map(n=>'src/ui/'+n+'.tsx')].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),samples,limitations:'Dev build, software SwiftShader, no physicalGPU/native/FPS/experience claim. Same verified Veyra seed snapshot, serial ABBA. Without settleFrames, phase deadlines include cold input. With settleFrames, record input separately, warm the same number of rendered inventory frames, THEN measure the steady phase. Both controls retained: a long PNG flush pauses GPU submissions and can reset the graphics queue despite equal wall-time ages. Pixel reads performed only AFTER timing phases. Baseline UI from HEAD; same current engine and CSS selectors (img selectors broadened only).'},null,2)+'\n');}
try{
 const boot=await browser.newPage();await boot.route('**/__ui_boot',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await boot.goto(base+'/__ui_boot');
 const snapshot=await boot.evaluate(async epoch=>{const W=await import('/src/game/world.ts'),E=await import('/src/game/engine.ts'),P=await import('/src/game/persist.ts');if(!W.setActiveLayout('veyra05-at-1920-512'))throw Error('layout not installed');const gs=E.newGame();if(!E.startRun(gs,'female',epoch,null,901).ok)throw Error('start failed');if(gs.run.layoutId!=='veyra05-at-1920-512')throw Error('split module world instance');return {text:P.serializeSnapshot(gs),scene:{layout:gs.run.layoutId,seed:gs.run.seed,player:[gs.run.player.x,gs.run.player.y]}};},epoch);await boot.close();
 for(const variant of (process.env.SOH_UI_CANVAS_VARIANTS||'png,canvas,canvas,png').split(',')){
  assert(['png','canvas'].includes(variant));const context=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1}),page=await context.newPage(),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
  if(variant==='png')await page.route(/\/src\/ui\/(common|SurvivorScreen|panels|BuildBar|VehicleConsole)\.tsx(?:\?.*)?$/,async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1),response=await route.fetch({url:base+'/.cache/ui-png-baseline/'+name});if(response.status()!==200)throw Error('baseline transform failed');await route.fulfill({response});});
  await page.addInitScript(({snapshot,epoch})=>{
   localStorage.setItem('soh.state.v3',snapshot.text);Date.now=()=>epoch;
   window.__ui={phase:'boot',frames:[],encodes:[],copies:[],starts:{},tasks:[]};
   const enc=HTMLCanvasElement.prototype.toDataURL;HTMLCanvasElement.prototype.toDataURL=function(...args){const t=performance.now(),p=window.__ui.phase;try{return enc.apply(this,args);}finally{window.__ui.encodes.push({p,ms:performance.now()-t,w:this.width,h:this.height});}};
   const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...args){if(this.canvas.dataset?.icon==='drawn'){const t=performance.now();try{return draw.apply(this,args);}finally{window.__ui.copies.push({p:window.__ui.phase,ms:performance.now()-t,key:this.canvas.dataset.item});}}return draw.apply(this,args);};
   new PerformanceObserver(l=>window.__ui.tasks.push(...l.getEntries().map(e=>({at:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
   let prev;function frame(t){if(prev!==undefined)window.__ui.frames.push({at:t,p:window.__ui.phase,ms:t-prev});prev=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  },{snapshot,epoch});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/^Continue/}).click();await page.locator('canvas').first().waitFor();
  const actual=await page.evaluate(inspect);assert.equal(actual.run.layoutId,snapshot.scene.layout);
  const phases=[];
  for(const phase of ['idle','inventory-first','inventory-repeat']){
   await page.evaluate(phase=>{window.__ui.phase=phase;window.__ui.starts[phase]=performance.now();},phase);const at=Date.now();
   if(phase!=='idle'){await page.keyboard.press('KeyI');await page.getByRole('button',{name:'Sort Pack',exact:true}).waitFor();}
   const inputToDOMMs=Date.now()-at;let warmedFrames=0,warmMs=0;
   if(settleFrames&&phase!=='idle'){
    const warmStart=Date.now();await page.evaluate(()=>window.__ui.phase='inventory-warm');
    const target=phase==='inventory-first'?settleFrames:Math.floor(settleFrames/3);
    const initial=await page.evaluate(()=>window.__ui.frames.filter(f=>f.p==='inventory-warm').length);
    await page.waitForFunction(({initial,target})=>window.__ui.frames.filter(f=>f.p==='inventory-warm').length>=initial+target,{initial,target},{timeout:120000});
    warmedFrames=target;warmMs=Date.now()-warmStart;
    await page.evaluate(phase=>{window.__ui.phase=phase;window.__ui.starts[phase]=performance.now();},phase);
   }
   await page.waitForTimeout(Math.max(0,dwell-(settleFrames?0:inputToDOMMs)));phases.push({phase,inputToDOMMs,warmedFrames,warmMs});
   if(phase==='inventory-first'){await page.keyboard.press('KeyI');await page.waitForTimeout(200);}
  }
  const metrics=await page.evaluate(()=>{
   const v=window.__ui,stat=a=>{a=a.slice().sort((x,y)=>x-y);return {count:a.length,p50:a[Math.floor(a.length*.5)]??null,p95:a[Math.floor(a.length*.95)]??null,p99:a[Math.floor(a.length*.99)]??null,max:a.at(-1)??null};},phases={};
   for(const p of ['idle','inventory-first','inventory-repeat']){const start=v.starts[p];phases[p]={frames:stat(v.frames.filter(f=>f.p===p&&f.at>=start).map(f=>f.ms)),tail10s:stat(v.frames.filter(f=>f.p===p&&f.at>=start+20000&&f.at<start+30000).map(f=>f.ms)),windows:[0,5,10,15,20,25].map(s=>({seconds:[s,s+5],...stat(v.frames.filter(f=>f.p===p&&f.at>=start+s*1000&&f.at<start+(s+5)*1000).map(f=>f.ms))})),encodes:v.encodes.filter(e=>e.p===p),copies:v.copies.filter(e=>e.p===p)};}
   const c=document.createElement('canvas'),gl=c.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return {phases,tasks:v.tasks,heap:performance.memory?.usedJSHeapSize,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'};
  });
  // Native-resolution pixel check for every mounted fallback, and DOM geometry
  // for BOTH img and canvas paths. Must not contaminate timing with readback.
  const ui=await page.evaluate(async()=>{
   const {getArt}=await import('/src/game/art.ts'),A=getArt(),pixels=[],mismatches=[];
   for(const c of document.querySelectorAll('canvas[data-icon="drawn"]')){const key=c.dataset.item,sprites=key.startsWith('st:')?A.st:A.icon,s=sprites[key.startsWith('st:')?key.slice(3):key];if(!s)continue;const expected=s.getContext('2d').getImageData(0,0,s.width,s.height).data,actual=c.getContext('2d').getImageData(0,0,c.width,c.height).data;if(expected.length!==actual.length||!expected.every((b,i)=>b===actual[i]))mismatches.push(key);pixels.push(key);}
   const geometry=[...document.querySelectorAll('.sv img.px, .sv canvas.px[data-icon]')].map(el=>{const b=el.getBoundingClientRect();return {key:el.dataset.item,marker:el.dataset.icon,w:b.width,h:b.height,x:b.x,y:b.y};});
   return {checked:pixels.length,mismatches,geometry};
  });assert.deepEqual(ui.mismatches,[]);assert.equal(errors.length,0);
  samples.push({variant,scene:snapshot.scene,phases,metrics,ui,errors});persist();console.log(JSON.stringify({variant,phases,frames:Object.fromEntries(Object.entries(metrics.phases).map(([p,v])=>[p,{frames:v.frames,tail:v.tail10s,encodeCount:v.encodes.length,copyCount:v.copies.length}])),checked:ui.checked}));await context.close();
 }
}finally{await browser.close();persist();}
