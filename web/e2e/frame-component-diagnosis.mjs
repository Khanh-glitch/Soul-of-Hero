/** Diagnostic ablations only; NEVER ships skipped rendering/quality settings.
 * Fixed Veyra, no simulation/UI. Separate contexts, constant 640x360 backing.
 * Distinguishes JS submission cost from asynchronous software raster tails. */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5192',out=process.env.SOH_FRAME_OUT||'evidence/solo-final-fallback/20261117/frame-work/diagnosis.json',dwell=Number(process.env.SOH_FRAME_DWELL||25000),samples=[];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const variant of (process.env.SOH_FRAME_VARIANTS||'baseline,no-grade,no-weather,no-living,no-light,software,baseline').split(',')){
  const context=await browser.newContext({viewport:{width:640,height:360}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__frame_diag',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}canvas{image-rendering:pixelated}</style><canvas width="640" height="360"></canvas>'}));
  await page.route(/\/src\/(game\/render|visual\/direction|veyra05\/living\/life)\.ts(?:\?.*)?$/,async route=>{
   const response=await route.fetch();let text=await response.text(),path=new URL(route.request().url()).pathname;
   if(variant==='clear'&&path.endsWith('/render.ts')){const seam=/(export function draw\([^)]*\)\s*\{)/;if(!seam.test(text))throw Error('clear seam changed');text=text.replace(seam,'$1 g.clearRect(0,0,g.canvas.width,g.canvas.height);');}
   const livingSkip = {'no-trees':['drawLivingTree'],'no-shadows':['castShadow'],'no-water':['drawWaterTile'],'no-ground':['drawGroundTile','drawElderGround','drawUnderground'],'no-air':['drawAir']}[variant];
   const skip=livingSkip&&path.endsWith('/life.ts')?livingSkip:variant==='no-grade'&&path.endsWith('/direction.ts')?['gradeWorld']:variant==='no-weather'&&path.endsWith('/render.ts')?['drawWeather']:variant==='no-light'&&path.endsWith('/render.ts')?['drawLight']:variant==='no-living'&&path.endsWith('/life.ts')?['drawLivingTree','drawWaterTile','drawLavaTile','drawGroundTile','drawElderGround','drawUnderground','drawAir']:[];
   for(const name of skip){const re=new RegExp(`(function ${name}\\([^)]*\\)\\s*\\{)`);if(!re.test(text))throw Error('skip seam '+name);text=text.replace(re,'$1 return;');}
   await route.fulfill({response,body:text});
  });
  await page.goto(base+'/__frame_diag');
  const result=await page.evaluate(async({variant,dwell})=>{
   const E=await import('/src/game/engine.ts'),W=await import('/src/game/world.ts'),R=await import('/src/game/render.ts'),A=await import('/src/game/item-atlas.ts');
   if(!W.setActiveLayout('veyra05-at-1920-512'))throw Error('layout invalid');const gs=E.newGame(),epoch=Date.UTC(2026,10,17,12);if(!E.startRun(gs,'female',epoch,null,901).ok||gs.run.layoutId!=='veyra05-at-1920-512')throw Error('wrong fixture layout');await A.loadItemAtlas();
   const canvas=document.querySelector('canvas'),g=canvas.getContext('2d',variant==='software'?{willReadFrequently:true}:undefined);g.imageSmoothingEnabled=false;
   const before=JSON.stringify(gs),frames=[],submit=[],windows=[],start=performance.now();let prev,cold;
   await new Promise(resolve=>{function frame(t){if(prev!==undefined)frames.push({at:t,ms:t-prev});prev=t;const a=performance.now();R.draw(g,gs,epoch,16.6667,{buildType:null,reclaim:false,mouseX:0,mouseY:0,target:null,time:t});const ms=performance.now()-a;if(cold===undefined)cold=ms;submit.push({at:t,ms});if(performance.now()-start>=dwell)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);});
   const stat=a=>{a.sort((x,y)=>x-y);return{count:a.length,p50:a[Math.floor(a.length*.5)]??null,p95:a[Math.floor(a.length*.95)]??null,p99:a[Math.floor(a.length*.99)]??null,max:a.at(-1)??null}};
   for(let sec=0;sec<dwell/1000;sec+=5)windows.push({seconds:[sec,sec+5],frame:stat(frames.filter(f=>f.at>=start+sec*1000&&f.at<start+(sec+5)*1000).map(f=>f.ms)),submit:stat(submit.filter(f=>f.at>=start+sec*1000&&f.at<start+(sec+5)*1000).map(f=>f.ms))});
   return {variant,layout:gs.run.layoutId,coldDrawMs:cold,windows,stateUnchanged:before===JSON.stringify(gs),contextAttributes:g.getContextAttributes?.()};
  },{variant,dwell});samples.push({...result,errors});console.log(JSON.stringify(samples.at(-1)));mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify({dwell,samples,scope:'Partial/completed diagnostic samples. Ablations are test-only.'},null,2)+'\n');await context.close();
 }
}finally{await browser.close();mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify({scope:'Ablation diagnosis, no simulation/UI, softwareGPU only. Skips must never ship. State may be observationally normalized by sourceAt; inspect rather than assume.',dwell,samples},null,2)+'\n');}
