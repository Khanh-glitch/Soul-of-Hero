/** Matched drop rendering diagnosis. Fixture-spawned piles, not natural farming.
 * Serial ABBA, 640x360, same seeded world/positions. No changes to loot rules.
 * Covers isolated real drawEntity + complete world draw. No UI/physics/FPS acceptance claim. */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5173',out=process.env.SOH_LOOT_OUT||'evidence/solo-final-fallback/20261117/loot-render-profile.json';
const dwell=Number(process.env.SOH_LOOT_DWELL_MS||12000),samples=[];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 for(const variant of (process.env.SOH_LOOT_VARIANTS||'cells,sheet,sheet,cells').split(',')){
  const context=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__loot_profile',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}canvas{image-rendering:pixelated}</style><canvas width="640" height="360"></canvas>'}));
  // Reconstruct the rejected experiment at the network seam; production stays
  // on the exact original cell path. Fail closed if that source seam changes.
  await page.route(/\/src\/game\/(render|item-atlas)\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();let text=await response.text();
   if(!['cells','sheet'].includes(variant))throw Error('unknown variant '+variant);
   if(new URL(route.request().url()).pathname.endsWith('/item-atlas.ts')){
    if(variant==='sheet'){
     if(!text.includes('cells = next;'))throw Error('atlas load source changed');
     text=text.replace('cells = next;','cells = next; __sheet = img;')+'\nlet __sheet=null; export function __profileSheet(g,key,x,y,w,h){if(!__sheet||!hasApprovedIcon(key))return false;const f=ITEM_ATLAS.frames[key];g.drawImage(__sheet,f.x,f.y,f.w,f.h,x,y,w,h);return true;}\n';
    }
   }else{
    const target='g.drawImage(ic, X - 6, Y - 9 + bob, 12, 12);';
    const lookup=/const cell = atlasIconCell\(s.key\);\s*const ic = cell \?\? A.icon\[s.key\];/;
    if(!text.includes(target)||!lookup.test(text))throw Error('drop source changed');
    text=text.replace(lookup,'');
    if(variant==='sheet')text='import {__profileSheet} from "/src/game/item-atlas.ts";\n'+text.replace(target,'if(!__profileSheet(g,s.key,X-6,Y-9+bob,12,12))g.drawImage(A.icon[s.key],X-6,Y-9+bob,12,12);');
    else text=text.replace(target,'g.drawImage(atlasIconCell(s.key) ?? A.icon[s.key], X - 6, Y - 9 + bob, 12, 12);');
    text+='\nexport {drawEntity as __profileDrop};\n';
   }
   await route.fulfill({response,body:text});
  });
  await page.goto(base+'/__loot_profile');
  const boot=await page.evaluate(async()=>{
   window.__encodes=0;window.__canvases=0;const enc=HTMLCanvasElement.prototype.toDataURL,create=document.createElement.bind(document);
   HTMLCanvasElement.prototype.toDataURL=function(...a){window.__encodes++;return enc.apply(this,a)};
   document.createElement=function(name,...args){if(name==='canvas')window.__canvases++;return create(name,...args)};
   const engine=await import('/src/game/engine.ts'),world=await import('/src/game/world.ts'),atlas=await import('/src/game/item-atlas.ts'),render=await import('/src/game/render.ts');
   world.setActiveLayout('shipping_fresh');const at=Date.UTC(2026,10,17,12),gs=engine.newGame();const started=engine.startRun(gs,'female',at,1,901);if(!started.ok)throw Error(JSON.stringify(started));
   const t=performance.now();if(!await atlas.loadItemAtlas())throw Error('atlas unavailable');const atlasLoadMs=performance.now()-t,atlasCanvasCount=window.__canvases;
   const r=gs.run,keys=['wood','stone','fiber','iron_ore','crude_petroleum','seed','scrap','spares'],drops=[];
   for(let i=0;i<160;i++){const x=r.player.x-96+(i%20)*10,y=r.player.y-64+Math.floor(i/20)*14;drops.push(engine.spawnDrop(r,keys[i%keys.length],1,x,y,at,undefined,false));}
   window.__loot={engine,gs,render,drops,at,ctx:document.querySelector('canvas').getContext('2d'),before:JSON.stringify(r.custody)};
   const cv=document.createElement('canvas'),gl=cv.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');
   return {atlasLoadMs,atlasCanvasCount,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',seed:r.seed,layout:r.layoutId};
  });
  const phases=[];
  for(const [mode,count]of [['isolated',40],['isolated',160],['world',0],['world',40],['world',160]]){
   phases.push(await page.evaluate(async({mode,count,dwell})=>{
    const {gs,render,drops,at,ctx,engine}=window.__loot,r=gs.run,all=Object.values(r.entities).filter(e=>e.kind!=='drop');r.entities=Object.fromEntries([...all,...drops.slice(0,count)].map(e=>[e.id,e]));engine.markDirty();
    const beforeEncode=window.__encodes,beforeCanvas=window.__canvases,frames=[],cpu=[];let previous;
    const start=performance.now();await new Promise(resolve=>{function frame(t){if(previous!==undefined)frames.push(t-previous);previous=t;const a=performance.now();
     if(mode==='isolated'){ctx.clearRect(0,0,640,360);ctx.save();ctx.translate(320-r.player.x,180-r.player.y);for(const drop of drops.slice(0,count))render.__profileDrop(ctx,r,drop,at,at);ctx.restore();}
     else render.draw(ctx,gs,at,16.6667,{buildType:null,reclaim:false,mouseX:0,mouseY:0,target:null,time:at});
     cpu.push(performance.now()-a);if(performance.now()-start>=dwell)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);});
    const stats=a=>{a.sort((x,y)=>x-y);return {count:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1),total:a.reduce((x,y)=>x+y,0)}};
    return {mode,count,cpu:stats(cpu),frame:stats(frames),encodes:window.__encodes-beforeEncode,canvases:window.__canvases-beforeCanvas};
   },{mode,count,dwell}));
  }
  const custodyUnchanged=await page.evaluate(()=>JSON.stringify(window.__loot.gs.run.custody)===window.__loot.before);
  samples.push({variant,...boot,phases,custodyUnchanged,errors});console.log(JSON.stringify(samples.at(-1)));await context.close();
 }
}finally{await browser.close();}
mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSHA256:Object.fromEntries(['src/game/render.ts', 'src/game/item-atlas.ts', 'public/assets/atlas/soh_items_157_atlas.png'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),dwell,samples,limitations:'Matched diagnostic fixture. Software SwiftShader, no native/physicalGPU FPS or natural loot acquisition claim. Cells branch reconstructs original drop draw only; atlas loader/art/physics unchanged.'},null,2)+'\n');
