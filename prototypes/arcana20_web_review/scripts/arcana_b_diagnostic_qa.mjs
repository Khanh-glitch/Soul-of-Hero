// Internal source-B browser diagnostic only. This is not a playtest or parity QA.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];
page.on('pageerror',e=>errors.push(e.stack));
await page.goto((process.env.SOH_URL||'http://127.0.0.1:4176/')+'?arcanaBdev=1'+(process.env.B_GPU==='1'?'&arcanaGpu=1':''));
await page.getByRole('button',{name:'New run',exact:true}).click();await page.getByRole('button',{name:'Meadow Bay',exact:true}).click();await page.getByRole('button',{name:'Begin the 14 days',exact:true}).click();
try { await page.waitForFunction(()=>Boolean(window.__soh?.run),null,{timeout:30000}); } catch (e) { console.error('STARTUP_DIAGNOSTIC', JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,1000)})); await browser.close(); throw e; }
await page.evaluate(()=>{const r=window.__soh.run;r.custody.inv.slots[3]={uid:'B-qa',key:'core_arcana_02',qty:1,charge:3};r.player.active=3});
await page.mouse.move(850,350);await page.waitForTimeout(300);await page.mouse.down();await page.waitForTimeout(100);await page.mouse.up();
await page.waitForFunction(()=>window.__soh.run.custody.inv.slots[3].charge===2,null,{timeout:30000});
await page.waitForFunction(()=>window.__arcanaBDiagnosticTimings?.length>=8,null,{timeout:60000});
const live=await page.evaluate(()=>window.__arcanaBDiagnosticTimings.slice());
const isolated=await page.evaluate(async()=>{
 const {BSource}=await import('/src/arcana_b/player.ts');const {compositeB}=await import('/src/arcana_b/composite.ts');
 const game=document.querySelector('canvas');const g=game.getContext('2d');const base=g.getImageData(0,0,game.width,game.height);const out=[];
 for(const [id,t] of [[2,5.12],[3,7.25],[8,5.3]]){
  const b=new BSource(id,{x:260,y:186},{x:360,y:186});const render=[],composite=[];
  for(let k=0;k<8;k++){let s=performance.now();const frame=b.renderAtSeconds(t+k/60);render.push(performance.now()-s);const data=base.data.slice();s=performance.now();compositeB(data,base.width,base.height,frame.r,frame.transform,0,0);composite.push(performance.now()-s);}
  out.push({id,t,renderMs:render,compositeMs:composite});
 }
 return out;
});
assert.deepEqual(errors,[]);assert(live.length>=8);
console.log(JSON.stringify({scope:'internal browser source-B diagnostic only, software headless, no parity or device FPS claim',mode:process.env.B_GPU==='1'?'experimental-gpu':'cpu',chargeAfterCast:2,live:live.slice(0,12),isolated,errors},null,2));await browser.close();
