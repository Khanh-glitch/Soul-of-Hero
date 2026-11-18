/** Production single-file ordinary-controls technical smoke. No injected game state,
 * QA flags, items or position. Not natural progression, FPS or human acceptance. */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5174';
const out=process.env.SOH_SMOKE_OUT||'evidence/solo-final-fallback/20261117/production-7050116';mkdirSync(out,{recursive:true});
const opts={executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']};
const record={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),htmlSha256:createHash('sha256').update(readFileSync('dist/index.html')).digest('hex'),scope:'PRODUCTION_ORDINARY_UI_640_SAVE_FRESH_BROWSER_ONLY; software GPU; not FPS/human/progression acceptance',errors:[],steps:[]};
let browser=await chromium.launch(opts);
const inspect=page=>page.evaluate(()=>{
  for(const c of document.querySelectorAll('canvas')){
    const key=Object.keys(c).find(x=>x.startsWith('__reactFiber$'));let f=key?c[key]:null;
    while(f&&!f.memoizedProps?.gs)f=f.return;
    const r=f?.memoizedProps?.gs?.run;if(!r)continue;
    return {id:r.id,seed:r.seed,layout:r.layoutId,digest:r.sourceMap?.digest,qaUsed:r.qaUsed,x:r.player.x,y:r.player.y};
  }return null;
});
const pageFor=async context=>{const page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>record.errors.push(e.message));return page;};
try{
  let context=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1}),page=await pageFor(context);
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});await page.getByRole('button',{name:'New run',exact:true}).click();
  await page.getByRole('button',{name:'Begin the 14 days',exact:true}).click();
  await page.locator('canvas').first().waitFor();await page.waitForTimeout(1200);
  record.initial=await inspect(page);assert(record.initial);assert.equal(record.initial.qaUsed,false);record.steps.push('fresh menu start');
  await page.screenshot({path:out+'/spawn-640x360.png',timeout:120000});
  const inventoryInputAt=Date.now();await page.keyboard.press('KeyI');await page.getByRole('button',{name:'Sort Pack',exact:true}).waitFor();
  record.inventoryInputToDOMMs=Date.now()-inventoryInputAt;
  record.uiIconNodes=await page.evaluate(()=>({atlasImages:document.querySelectorAll('img[data-icon="atlas157"]').length,drawnCanvases:document.querySelectorAll('canvas[data-icon="drawn"]').length}));
  await page.screenshot({path:out+'/inventory-640x360.png',timeout:120000});record.steps.push('ordinary inventory input');
  await page.keyboard.press('KeyI');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Save & quit to title',exact:true}).click();await page.getByRole('button',{name:/^Continue/}).waitFor();
  const saved=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/^soh.state.v\d+$/.test(k))));
  assert(Object.keys(saved).length>0);const state=JSON.parse(JSON.parse(Object.values(saved)[0]).payload);record.saved={seed:state.run.seed,layout:state.run.layoutId,digest:state.run.sourceMap.digest,qaUsed:state.run.qaUsed,x:state.run.player.x,y:state.run.player.y};
  const storageState=await context.storageState();record.steps.push('normal save and quit');await browser.close();
  browser=await chromium.launch(opts);context=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1,storageState});page=await pageFor(context);
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});await page.getByRole('button',{name:/^Continue/}).click();await page.locator('canvas').first().waitFor();await page.waitForTimeout(400);
  record.resumed=await inspect(page);assert(record.resumed);
  for(const key of ['seed','layout','digest','qaUsed'])assert.equal(record.resumed[key],record.saved[key],key);
  assert.equal(record.resumed.qaUsed,false);assert(Math.hypot(record.resumed.x-record.saved.x,record.resumed.y-record.saved.y)<1);
  await page.screenshot({path:out+'/resumed-640x360.png',timeout:120000});record.steps.push('fresh browser process actual-storage continuation');
  assert.deepEqual(record.errors,[]);record.status='PASS_TECHNICAL_SMOKE_ONLY';
}catch(e){record.status='FAIL';record.failure=String(e);process.exitCode=1;}
finally{await browser.close();writeFileSync(out+'/manifest.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record,null,2));}
