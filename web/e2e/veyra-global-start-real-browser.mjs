// PR55 Veyra global-start BROWSER verification.
// REAL menu/keyboard/save/reload input. React state is READ ONLY.
// This is not a human 14-day journey, harvest proof, or offshore ferry proof.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const out='evidence/veyra-global-start-browser';
await mkdir(out,{recursive:true});
const rec={sha:process.env.BUILD_SHA||'unknown',scope:'REAL_BROWSER_INPUT_START_MOVE_SAVE_RELOAD_ONLY',status:'RUNNING',shots:[],events:[],errors:[]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
const page=await ctx.newPage();
page.on('pageerror',e=>rec.errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')rec.errors.push('console: '+m.text());});
const shot=async name=>{
 const file=name+'.png',b=await page.screenshot({path:out+'/'+file,animations:'disabled'});
 rec.shots.push({file,sha256:createHash('sha256').update(b).digest('hex')});
};
const inspect=()=>page.evaluate(()=>{
 for(const canvas of document.querySelectorAll('canvas')){
  const key=Object.keys(canvas).find(x=>x.startsWith('__reactFiber$'));
  let fiber=key?canvas[key]:null;
  while(fiber&&!fiber.memoizedProps?.gs)fiber=fiber.return;
  const gs=fiber?.memoizedProps?.gs;
  if(!gs?.run?.player)continue;
  const r=gs.run,o=r.sourceMap?.veyra?.originAu||[0,0];
  return {layout:r.layoutId,qaUsed:r.qaUsed,spawnRegion:r.spawnRegion,
   spawn:r.spawnChoice,seed:r.seed,originAu:o,sourceDigest:r.sourceMap?.digest,
   player:{x:r.player.x,y:r.player.y,hp:r.player.hp},
   globalTile:[Math.round(o[0]*2)+Math.floor(r.player.x/16),Math.round(o[1]*2)+Math.floor(r.player.y/16)],
   revision:gs.revision};
 }
 return null;
});
try{
 const url=process.env.GAME_URL||'http://127.0.0.1:4173/';
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(response?.status(),200);
 await page.getByRole('button',{name:'New run',exact:true}).click();
 await page.getByRole('button',{name:'VEYRA · Unified World',exact:true}).click();
 await page.getByRole('button',{name:'Random safe region'}).waitFor();
 assert.equal(await page.getByText(/Seeded random landing across source-verified mainland cells/).count(),1);
 await shot('01-menu');
 await page.getByRole('button',{name:'Begin the 14 days',exact:true}).click();
 await page.waitForFunction(()=>{
  for(const c of document.querySelectorAll('canvas')){
   const k=Object.keys(c).find(x=>x.startsWith('__reactFiber$'));let f=k?c[k]:null;
   while(f&&!f.memoizedProps?.gs)f=f.return;
   if(f?.memoizedProps?.gs?.run?.player)return true;
  }return false;
 },{timeout:45000});
 await page.waitForTimeout(800);
 const initial=await inspect();
 assert(initial&&initial.layout?.startsWith('veyra05-at-'),'Player did not start in globally selected Veyra window');
 assert.equal(initial.qaUsed,false);
 assert.equal(initial.spawnRegion,-1);
 assert(Array.isArray(initial.globalTile)&&initial.globalTile.every(Number.isInteger));
 rec.events.push({kind:'START',state:initial});
 await shot('02-global-start-640x360');
 await page.setViewportSize({width:1280,height:720});
 await page.waitForTimeout(350);await shot('03-global-start-1280x720');
 await page.setViewportSize({width:640,height:360});
 let walked=false,movedTo=null;
 for(const key of ['KeyD','KeyS','KeyA','KeyW']){
  const a=await inspect();
  await page.keyboard.down(key);await page.waitForTimeout(600);await page.keyboard.up(key);await page.waitForTimeout(120);
  const b=await inspect();
  if(b&&a&&Math.hypot(b.player.x-a.player.x,b.player.y-a.player.y)>4){walked=true;movedTo=b;break;}
 }
 assert(walked,'Keyboard controller failed to move on all four cardinal directions');
 rec.events.push({kind:'KEYBOARD_DISPLACEMENT',before:initial.player,after:movedTo.player});
 await shot('04-after-real-keyboard');
 await page.keyboard.press('Escape');
 const quit=page.getByRole('button',{name:'Save & quit to title',exact:true});
 await quit.waitFor({timeout:12000});
 await quit.click();
 await page.getByRole('button',{name:/^Continue/}).waitFor({timeout:15000});
 const keys=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('soh.state')));
 assert(keys.length>0,'No persisted save key');
 rec.events.push({kind:'SAVE_LOCALSTORAGE',keys});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/^Continue/}).waitFor({timeout:20000});
 await page.getByRole('button',{name:/^Continue/}).first().click();
 await page.waitForTimeout(900);
 const resumed=await inspect();
 assert(resumed,'Run missing after page reload');
 assert.equal(resumed.layout,movedTo.layout);
 assert.equal(resumed.sourceDigest,movedTo.sourceDigest);
 assert.equal(resumed.seed,movedTo.seed);
 assert.equal(resumed.qaUsed,false);
 assert(Math.hypot(resumed.player.x-movedTo.player.x,resumed.player.y-movedTo.player.y)<25,'Position did not survive resume');
 rec.events.push({kind:'RELOAD_RESUME',state:resumed});
 await shot('05-after-real-browser-reload');
 rec.status=rec.errors.length?'FAIL_BROWSER_ERRORS':'PASS_BROWSER_SMOKE_ONLY';
}catch(e){rec.status='FAIL';rec.failure=String(e);try{await shot('failure');}catch{}}
finally{
 await writeFile(out+'/manifest.json',JSON.stringify(rec,null,2)+'\n');
 console.log('VEYRA_GLOBAL_BROWSER '+JSON.stringify({status:rec.status,events:rec.events.map(e=>e.kind),failure:rec.failure,errors:rec.errors,sha:rec.sha}));
 await ctx.close();await browser.close();
}
if(rec.status!=='PASS_BROWSER_SMOKE_ONLY')process.exitCode=1;
