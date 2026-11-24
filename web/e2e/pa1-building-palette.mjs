// Browser acceptance is UI-only: real menu + real B hotkey + real click + browser screenshots.
// Transaction, physical blocker and save tests remain separate and do not use UI state injection.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='evidence/pa1-building-palette';
await mkdir(out,{recursive:true});
const rec={sha:process.env.BUILD_SHA||'unknown',status:'RUNNING',screenshots:[],tabs:[],errors:[]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',e=>rec.errors.push('pageerror:'+e.message));
page.on('console',m=>{if(m.type()==='error')rec.errors.push('console:'+m.text());});
async function shot(name){const path=name+'.png';await page.screenshot({path:out+'/'+path,animations:'disabled'});rec.screenshots.push(path);}
try{
 const url=process.env.GAME_URL||'http://127.0.0.1:4173/';
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(response?.status(),200);
 await page.getByRole('button',{name:'New run',exact:true}).click();
 await page.getByRole('button',{name:'VEYRA · Unified World',exact:true}).click();
 await page.getByRole('button',{name:'Begin the 14 days',exact:true}).click();
 await page.waitForSelector('canvas',{timeout:45000});
 await page.keyboard.press('b');
 const bar=page.getByTestId('pa1-expanded-buildbar');
 await bar.waitFor({timeout:15000});
 const tabs=[['Foundation',4],['Wall',8],['Roof',3]];
 for(const [name,count] of tabs){
   await bar.getByRole('button',{name:new RegExp('^'+name+'\\s')}).click();
   const chips=bar.locator('.buildbar__row .bslot:not(.mode)');
   assert.equal(await chips.count(),count,'Wrong palette length for '+name);
   const icons=await chips.locator('img').evaluateAll(els=>els.map(el=>({alt:el.alt,ok:el.complete&&el.naturalWidth>0})));
   assert(icons.every(x=>x.ok),'Unloaded sprite in '+name+':'+JSON.stringify(icons));
   rec.tabs.push({name,count,icons});
   await shot('01-'+name+'-1280');
 }
 await page.setViewportSize({width:640,height:360});
 await bar.getByRole('button',{name:/^Wall\s/}).click();
 await shot('04-Wall-640');
 assert.equal(await bar.locator('.buildbar__row .bslot:not(.mode)').count(),8);
 assert.equal(rec.errors.length,0,'Browser console/page errors');
 rec.status='PASS_BROWSER_UI';
}catch(e){rec.status='FAIL';rec.failure=String(e);try{await shot('FAIL')}catch{}}
finally{
 await writeFile(out+'/manifest.json',JSON.stringify(rec,null,2)+'\n');
 console.log('PA1_BUILD_PALETTE '+JSON.stringify({status:rec.status,sha:rec.sha,tabs:rec.tabs.map(x=>({name:x.name,count:x.count})),errors:rec.errors,failure:rec.failure}));
 await context.close();await browser.close();
}
if(rec.status!=='PASS_BROWSER_UI')process.exitCode=1;
