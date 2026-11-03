// MAP-R01 identical-condition A/B/C capture — native 640x360, frozen fictional clock.
import { chromium } from '/home/user/pr38/web/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const BASE=process.env.GAME_URL, OUT=process.env.OUT, TAG=process.env.TAG||'x';
if(!BASE||!OUT)throw new Error('GAME_URL and OUT required');
await fs.mkdir(OUT,{recursive:true});
const errors=[];
const browser=await chromium.launch({headless:true,executablePath:'/tmp/chromium',env:{...process.env,LD_LIBRARY_PATH:'/tmp/al2023/lib'},args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
// Deterministic clock: all three builds see the identical epoch at startRun, so the
// run seed, world RNG, weather slot and day/night phase are identical. Physics dt
// comes from requestAnimationFrame/performance.now(), so real movement still works.
await ctx.addInitScript(()=>{const V0=1770000000000;Date.now=()=>V0;});
const page=await ctx.newPage();page.setDefaultTimeout(15000);
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,180))});
page.on('requestfailed',r=>errors.push('requestfailed: '+r.url().slice(0,120)));
const state=()=>page.evaluate(()=>{
 const r=window.__soh?.run;if(!r)return null;
 const len=24*60000;const elapsed=Date.now()-r.startedAt+r.qaOffset;
 const dayTime=(((elapsed+len*0.3)%len)+len)%len/len;
 const dark=Math.max(0,Math.min(0.78,0.5-Math.cos((dayTime-0.5)*Math.PI*2)*0.85));
 return {x:Math.round(r.player.x*100)/100,y:Math.round(r.player.y*100)/100,hp:r.player.hp,seed:r.seed,qaOffset:r.qaOffset,dayTime:+dayTime.toFixed(3),dark:+dark.toFixed(3),weatherSlot:r.clock.weatherSlot,regionName:r.player.regionName,invItems:r.custody.inv.slots.filter(Boolean).length};
});
const shot=async name=>{await page.waitForTimeout(260);await page.screenshot({path:OUT+'/'+name+'.png',animations:'disabled'});return state()};
const qaHour=async()=>{
 await page.keyboard.press('Escape');await page.waitForTimeout(200);
 const cont=page.getByRole('button',{name:'Continue',exact:true});
 if(await cont.count()&&await cont.isVisible().catch(()=>false)){await cont.click();await page.waitForTimeout(200);await page.keyboard.press('Escape');await page.waitForTimeout(150);}
 await page.getByRole('button',{name:'+1h',exact:true}).click();await page.waitForTimeout(250);
 await page.keyboard.press('Escape');await page.waitForTimeout(400);
};
const hold=async(code,ms)=>{await page.keyboard.down(code);await page.waitForTimeout(ms);await page.keyboard.up(code)};
const rec={tag:TAG,gameUrl:BASE,viewport:{w:640,h:360},clock:'frozen epoch 1770000000000; day/night via real +1h QA button',shots:{},route:[],errors};
try{
 await page.goto(BASE,{waitUntil:'load'});await page.waitForTimeout(350);
 await page.getByRole('button',{name:'New run'}).click();await page.waitForTimeout(350);
 await page.getByRole('button',{name:"Fisher's Point",exact:true}).click();await page.waitForTimeout(350);
 await page.getByRole('button',{name:/Begin the 14 days/}).click();
 await page.waitForFunction(()=>Boolean(window.__soh?.run),null,{timeout:20000});await page.waitForTimeout(700);
 rec.spawn=await state();
 rec.shots['forest-day']=await shot('forest-day');
 await qaHour();rec.shots['forest-night']=await shot('forest-night');
 for(const [k,ms] of [['KeyS',2800],['KeyA',2200],['KeyA',1200]]){await hold(k,ms);rec.route.push({key:k,ms,...await state()});}
 rec.shots['coast-night']=await shot('coast-night');
 await qaHour();rec.shots['coast-day']=await shot('coast-day');
}catch(e){rec.fatal=String(e);console.error('CAPTURE_FAIL',e);process.exitCode=1;}
rec.errors=errors;
await fs.writeFile(OUT+'/manifest.json',JSON.stringify(rec,null,2));
console.log(TAG,'spawn',JSON.stringify(rec.spawn),'end',JSON.stringify(rec.shots['coast-day']),'errors',errors.length,rec.fatal||'');
await browser.close();
