// MAP-R01 real-browser verification on the FINAL C build (identical frozen clock to A/B/C).
// 1) HUD + real movement + I/C/M/B panels  2) real harvest  3) real POI/container [E] + Take all
// 4) A-vs-C authority fingerprint: C changes visuals only, never world/gameplay state.
import { chromium } from '/home/user/pr38/web/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const A_URL=process.env.A_URL||'http://127.0.0.1:4199/a/';
const C_URL=process.env.GAME_URL||'http://127.0.0.1:4199/c/';
const OUT=process.env.OUT||'/home/user/r01_scratch/shots/verify';
await fs.mkdir(OUT,{recursive:true});
const errors=[];const b=await chromium.launch({headless:true,executablePath:'/tmp/chromium',env:{...process.env,LD_LIBRARY_PATH:'/tmp/al2023/lib'},args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const state=p=>p.evaluate(()=>{const r=window.__soh.run,p=r.player;return {x:+p.x.toFixed(2),y:+p.y.toFixed(2),hp:p.hp,dead:p.dead,gather:p.skills.gather,inv:r.custody.inv.slots.filter(Boolean).length,poiSeen:r.poiSeen.length,loot:Object.values(r.entities).filter(e=>e.kind==='loot').length,doors:Object.values(r.entities).filter(e=>e.kind==='door').length,regionName:p.regionName};});
const hold=async(p,k,ms)=>{await p.keyboard.down(k);await p.waitForTimeout(ms);await p.keyboard.up(k);await p.waitForTimeout(90)};
const text=p=>p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
async function fresh(url){
 const c=await b.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
 await c.addInitScript(()=>{const V0=1770000000000;Date.now=()=>V0;});
 const p=await c.newPage();p.setDefaultTimeout(15000);
 p.on('pageerror',e=>errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,200))});
 await p.goto(url,{waitUntil:'load'});await p.waitForTimeout(350);
 await p.getByRole('button',{name:'New run'}).click();await p.waitForTimeout(300);
 await p.getByRole('button',{name:"Fisher's Point",exact:true}).click();await p.waitForTimeout(300);
 await p.getByRole('button',{name:/Begin the 14 days/}).click();await p.waitForFunction(()=>!!window.__soh?.run);await p.waitForTimeout(800);
 return {c,p};
}
const fingerprint=p=>p.evaluate(()=>{const r=window.__soh.run;
 const ents=Object.values(r.entities);const byKind={};for(const e of ents)byKind[e.kind||'?']=(byKind[e.kind||'?']||0)+1;
 const positions=ents.map(e=>e.kind+':'+(e.x|0)+','+(e.y|0)).sort().join(';');
 const inv=r.custody.inv.slots.filter(Boolean).map(s=>s.key+':'+s.qty).join(',');
 return {seed:r.seed,startedAt:r.startedAt,spawn:[+r.player.x.toFixed(2),+r.player.y.toFixed(2)],hp:r.player.hp,inv,byKind,entityCount:ents.length,entityPositionsSha:positions.length+':'+positions.split(';').slice(0,3).join(';'),poiSeen:r.poiSeen.slice(),terrainMutations:Object.keys(r.terrain).length,sourceMutations:Object.keys(r.sources).length,worldPlacesSeen:r.poiSeen.length};});
const rec={build:'C (MAP-R01 asset-backed)',urls:{A:A_URL,C:C_URL},clock:'frozen epoch 1770000000000 (identical to A/B/C capture)',checks:{},errors};
try{
 // ---- 1. HUD, real movement, panels ----
 {
  const {c,p}=await fresh(C_URL);rec.spawn=await state(p);
  const hud=await text(p);
  rec.checks.hud={hasClock:/CALM Day 1\/14/.test(hud),hasRegion:/Fisher's Point/.test(hud),hasHotbarTool:/Survival Knife/.test(hud),canvases:await p.evaluate(()=>document.querySelectorAll('canvas').length)};
  rec.checks.panels={};
  const kw={inventory:/\bInventory\b/,craft:/Crafting —/,map:/Map of the island/,build:/Build — pay real materials/};
  for(const [key,name] of [['KeyI','inventory'],['KeyC','craft'],['KeyM','map'],['KeyB','build']]){
   await p.keyboard.press(key);await p.waitForTimeout(280);
   const t=await text(p);
   rec.checks.panels[name]={key,opened:kw[name].test(t),matched:(t.match(kw[name])||[''])[0]};
   await p.keyboard.press('Escape');await p.waitForTimeout(180);
   const cont=p.getByRole('button',{name:'Continue',exact:true});
   if(await cont.count()&&await cont.isVisible().catch(()=>false)){await cont.click();await p.waitForTimeout(160);}
  }
  let path=0,prev=rec.spawn;const route=[];
  for(const [k,ms] of [['KeyS',2200],['KeyA',1900],['KeyS',1400],['KeyA',1300],['KeyD',900]]){await hold(p,k,ms);const s=await state(p);path+=Math.hypot(s.x-prev.x,s.y-prev.y);route.push({key:k,ms,...s});prev=s;}
  rec.checks.route=route;rec.checks.walkedPathPx=+path.toFixed(2);
  rec.checks.movementPass=path>300&&route.every(x=>!x.dead);
  rec.checks.hpUnchanged=prev.hp===100;rec.checks.worldStateAfterRoute=prev;
  await c.close();
 }
 // ---- 2. real harvest of a REAL grass source at world tile (83,176) ----
 {
  const {c,p}=await fresh(C_URL);
  await hold(p,'KeyS',1050);await hold(p,'KeyW',120);
  const before=await state(p);
  const tgt=await p.evaluate(()=>{const p=window.__soh.run.player;return {sx:Math.round(320+(1336-p.x)),sy:Math.round(186+(2824-p.y)),dist:+Math.hypot(1336-p.x,2824-p.y).toFixed(1)};});
  if(tgt.sx>0&&tgt.sx<640&&tgt.sy>0&&tgt.sy<360){
   await p.mouse.move(tgt.sx,tgt.sy);await p.waitForTimeout(140);
   for(let i=0;i<4;i++){await p.mouse.down();await p.waitForTimeout(110);await p.mouse.up();await p.waitForTimeout(420);}
  }
  await p.waitForTimeout(500);const after=await state(p);
  rec.checks.harvest={targetTile:[83,176],target:tgt,beforeGather:before.gather,afterGather:after.gather,pass:after.gather>before.gather,finalHp:after.hp};
  await c.close();
 }
 // ---- 3. real POI / container access: Net Shed starter crate ----
 {
  const {c,p}=await fresh(C_URL);
  const near=await p.evaluate(()=>{const r=window.__soh.run,px=r.player.x,py=r.player.y;
   const ls=Object.values(r.entities).filter(e=>e.kind==='loot').map(e=>({x:e.x,y:e.y,d:+Math.hypot(e.x-px,e.y-py).toFixed(1)})).sort((a,b)=>a.d-b.d);
   return {nearest:ls[0],count:ls.length};});
  // Real physical route around the Net Shed wall to the crate at world (1304,2696).
  for(const [k,ms] of [['KeyW',1000],['KeyA',400],['KeyA',400],['KeyS',350]])await hold(p,k,ms);
  const s=await state(p);
  const scr=await p.evaluate(()=>{const p=window.__soh.run.player;return {sx:Math.round(320+(1304-p.x)),sy:Math.round(186+(2696-p.y))};});
  await p.mouse.move(scr.sx,scr.sy);await p.waitForTimeout(280);
  const prompt=(await text(p)).match(/\[E\][^|]{0,60}/);
  const invBefore=s.inv;
  await p.keyboard.press('KeyE');await p.waitForTimeout(380);
  const afterE=await text(p);
  const panelOpened=/Take all/.test(afterE)&&/\bCrate\b/.test(afterE);
  let invAfter=invBefore;
  if(panelOpened){const take=p.getByRole('button',{name:'Take all',exact:true});if(await take.count()){await take.click();await p.waitForTimeout(350);invAfter=(await state(p)).inv;}}
  rec.checks.poi={nearestLoot:near.nearest,lootCrates:near.count,doors:s.doors,finalDistance:+Math.hypot(near.nearest.x-s.x,near.nearest.y-s.y).toFixed(1),
   prompt:prompt?prompt[0]:null,panelOpened,invBefore,invAfter,pass:!!prompt&&panelOpened&&invAfter>invBefore};
  await c.close();
 }
 // ---- 4. authority fingerprint A vs C ----
 {
  const a=await fresh(A_URL),c=await fresh(C_URL);
  const fa=await fingerprint(a.p),fc=await fingerprint(c.p);
  delete fa.entityPositionsSha;delete fc.entityPositionsSha;
  rec.checks.authority={A:fa,C:fc,identical:JSON.stringify(fa)===JSON.stringify(fc)};
  await a.c.close();await c.c.close();
 }
}catch(e){rec.fatal=String(e);console.error('VERIFY_FAIL',e);process.exitCode=1;}
rec.errors=errors;
await fs.writeFile(OUT+'/verify.json',JSON.stringify(rec,null,2));
console.log('movement',rec.checks.walkedPathPx,'panels',JSON.stringify(Object.fromEntries(Object.entries(rec.checks.panels||{}).map(([k,v])=>[k,v.opened]))),'harvest',JSON.stringify(rec.checks.harvest),'poi',JSON.stringify(rec.checks.poi),'authorityIdentical',rec.checks.authority?.identical,'errors',errors.length,rec.fatal||'');
await b.close();
