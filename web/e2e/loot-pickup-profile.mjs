/** Matched ABBA cache-invalidation diagnosis in a real Veyra window.
 * Controlled material/position fixture, real dispatcher and tick. Not natural farming or GPU FPS proof.
 * Run from web: CHROMIUM_EXECUTABLE_PATH=... node e2e/loot-pickup-profile.mjs */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5173',out=process.env.SOH_LOOT_PICKUP_OUT||'evidence/solo-final-fallback/20261117/loot-pickup-profile.json';
const samples=[],browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const variant of (process.env.SOH_LOOT_VARIANTS||'old,current,current,old').split(',')){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__loot_pickup',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Controlled loot pickup profile</title>'}));
  await page.route(/\/src\/game\/engine\.ts(?:\?.*)?$/,async route=>{
   const response=await route.fetch();let text=await response.text();const target='if (e.kind !== "drop") markDirty();'; // Vite-normalized quotes
   if(!text.includes(target))throw Error('pickup invalidation source changed');
   if(variant==='old')text=text.replace(target,'markDirty();');else if(variant!=='current')throw Error('unknown variant '+variant);
   if(text.split('blockDirty = false;').length!==2)throw Error('collision publish seam changed');
   text=text.replace('blockDirty = false;','blockDirty = false; window.__collisionRebuilds=(window.__collisionRebuilds||0)+1;');
   await route.fulfill({response,body:text});
  });
  await page.goto(base+'/__loot_pickup');
  const result=await page.evaluate(async()=>{
   const E=await import('/src/game/engine.ts'),{tick,FX}=await import('/src/game/sim.ts'),W=await import('/src/game/world.ts'),P=await import('/src/game/persist.ts');
   const at=Date.UTC(2026,10,17,12),phases=[],stats=values=>{const a=values.slice().sort((x,y)=>x-y);return {count:a.length,first:values[0],p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1),total:a.reduce((x,y)=>x+y,0)}};
   for(const burst of [1,8,32]){
    if(!W.setActiveLayout('veyra05-at-1920-512'))throw Error('layout unavailable');const gs=E.newGame();if(!E.startRun(gs,'female',at,null,901).ok)throw Error('start failed');const r=gs.run;if(r.layoutId!=='veyra05-at-1920-512')throw Error('fixture layout mismatch: '+r.layoutId);
    const input={up:false,down:false,left:false,right:false,mx:r.player.x,my:r.player.y,attack:false,attackPressed:false,roll:false,cancel:false};
    let now=at;for(let i=0;i<4;i++){now+=40;tick(gs,input,40,now);FX.length=0;}E.blockGrid(r);
    const rebuildStart=window.__collisionRebuilds;
    const ticks=[],queries=[],rebuilt=[],drops=[],beforeWood=E.countItem(r,'inv','wood');
    for(let frame=0;frame<12;frame++){
     now+=40;const ids=[];for(let j=0;j<burst;j++){const e=E.spawnDrop(r,'wood',1,r.player.x,r.player.y,now-500,undefined,false);ids.push(e.id);}drops.push(...ids);
     const cached=E.blockGrid(r),a=performance.now();tick(gs,input,40,now);ticks.push(performance.now()-a);
     const b=performance.now(),next=E.blockGrid(r);queries.push(performance.now()-b);rebuilt.push(next!==cached);FX.length=0;
     if(ids.some(id=>r.entities[id]))throw Error('fixture pickup not committed');
     await new Promise(resolve=>setTimeout(resolve,0));
    }
    const before=JSON.stringify(r.custody),copy=P.selectSnapshots([P.serializeSnapshot(gs)]).gs;
    const sameCustody=!!copy&&JSON.stringify(copy.run.custody)===before,qty=E.countItem(r,'inv','wood')-beforeWood;
    if(qty!==12*burst||!sameCustody)throw Error('material/save invariant failed');
    phases.push({actualLayout:r.layoutId,burst,tick:stats(ticks),nextCollisionQuery:stats(queries),collisionRebuildsDuringTickAndQuery:window.__collisionRebuilds-rebuildStart,invalidatedAfterTick:rebuilt.filter(Boolean).length,qty,sameCustody,remainingDrops:drops.filter(id=>r.entities[id]).length,state:JSON.stringify(gs)});
   }
   return {layout:'veyra05-at-1920-512',seed:901,phases};
  });
  for(const phase of result.phases){phase.stateSHA256=createHash('sha256').update(phase.state).digest('hex');delete phase.state;}
  samples.push({variant,...result,errors});console.log(JSON.stringify(samples.at(-1)));await context.close();
 }
}finally{await browser.close();}
for(let i=0;i<3;i++)if(new Set(samples.map(s=>s.phases[i].stateSHA256)).size!==1)throw Error('matched variants diverged in state');
mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSHA256:Object.fromEntries(['src/game/engine.ts', 'src/game/sim.ts'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),samples,limitations:'Controlled Veyra loose-drop waves at player; real tick, dispatcher and next collision query. No rendering/UI, natural farming, physical GPU or full-release claim. Old reconstructs unconditional removeEntity markDirty only.'},null,2)+'\n');
