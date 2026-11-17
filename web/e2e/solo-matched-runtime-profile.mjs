/** Audit-only, matched saved scene. Never ships profiling switches or changes game art.
 * CHROMIUM_EXECUTABLE_PATH=... SOH_BASE_URL=http://127.0.0.1:5173 node e2e/solo-matched-runtime-profile.mjs
 * Run SERIAL, with no concurrent tests/builds. Browser renderer is recorded, never assumed hardware.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5173';
const out=process.env.SOH_PERF_OUT||'evidence/solo-final-fallback/20261117/matched-runtime-profile.json';
const epoch=Date.UTC(2026,10,17,12),samples=[],light=process.env.SOH_PERF_LIGHT==='1';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
function group(url,name){
  if(name==='(garbage collector)')return 'GC';
  if(/item-atlas/.test(url))return 'item-atlas';
  if(/\/pixelfx|\/vfx\/|pixelfxMap/.test(url))return 'VFX';
  if(/react-dom|react_jsx|react\.js/.test(url))return 'React';
  if(/\/game\/(sim|engine|calendar|journey|motorbike|power-network|territory)|\/veyra05\//.test(url))return 'simulation/world';
  if(/\/game\/(render|draw|art|life|gpu\/)/.test(url))return 'Canvas/world JS';
  return 'other/native/idle';
}
function summarizeCPU(profile){
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),groups={},functions={};
  for(let i=0;i<(profile.samples||[]).length;i++){
    const n=nodes.get(profile.samples[i]),c=n.callFrame,ms=(profile.timeDeltas?.[i]||0)/1000;
    const cat=group(c.url,c.functionName);groups[cat]=(groups[cat]||0)+ms;
    const key=`${c.functionName||'(anonymous)'} @ ${c.url.split('?')[0]}:${c.lineNumber+1}`;functions[key]=(functions[key]||0)+ms;
  }
  return {selfSampleMs:groups,topSelf:Object.entries(functions).sort((a,b)=>b[1]-a[1]).slice(0,20)};
}
try{
  // One legitimate seeded new game, no grant/QA/position/creature mutation. All samples load the exact same bytes.
  const boot=await browser.newPage();await boot.route('**/__profile_bootstrap',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body>profile bootstrap</body>'}));
  await boot.goto(base+'/__profile_bootstrap');
  const snapshot=await boot.evaluate(async epoch=>{
    const w=await import('/src/game/world.ts'),e=await import('/src/game/engine.ts'),p=await import('/src/game/persist.ts'),c=await import('/src/game/core.ts');
    w.setActiveLayout('veyra05-world');const gs=e.newGame();const result=e.startRun(gs,'female',epoch,1,901);
    if(!result.ok)throw Error(JSON.stringify(result));
    return {key:`soh.state.v${c.SAVE_VERSION}`,text:p.serializeSnapshot(gs),scene:{seed:gs.run.seed,layout:gs.run.layoutId,player:[gs.run.player.x,gs.run.player.y],creatures:gs.run.creatures.length}};
  },epoch);await boot.close();
  // ABBA order; same app/modules, only historical eager atlas encoding is reconstructed for B.
  for(const [index,variant]of (process.env.SOH_PERF_VARIANTS?.split(',')||['current','eager-atlas-only','eager-atlas-only','current']).entries()){
    const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1}),page=await ctx.newPage(),errors=[],resources=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)resources.push({url:r.url(),status:r.status()});});
    await page.addInitScript(({snapshot,epoch,light})=>{
      localStorage.setItem(snapshot.key,snapshot.text);Date.now=()=>epoch; // controlled idle scene, no offline time drift
      window.__profile={phase:'startup',timings:{},encodes:[],frames:[],longTasks:[]};
      window.__timed=(name,fn)=>{const t=performance.now();try{return fn();}finally{const v=window.__profile,k=`${v.phase}/${name}`,x=v.timings[k]||(v.timings[k]={count:0,totalMs:0,maxMs:0});const ms=performance.now()-t;x.count++;x.totalMs+=ms;x.maxMs=Math.max(x.maxMs,ms);}};
      const orig=HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL=function(...a){return window.__timed('canvas.encode',()=>{const t=performance.now(),v=orig.apply(this,a);window.__profile.encodes.push({at:t,ms:performance.now()-t,phase:window.__profile.phase,w:this.width,h:this.height});return v;});};
      if(!light)for(const name of ['drawImage','fillRect','stroke','fill','fillText','getImageData','putImageData']){
        const fn=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...a){return window.__timed(`canvas.${name}`,()=>fn.apply(this,a));};
      }
      new PerformanceObserver(l=>window.__profile.longTasks.push(...l.getEntries().map(e=>({at:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
      let prev;function frame(t){if(prev!==undefined)window.__profile.frames.push({at:t,ms:t-prev,phase:window.__profile.phase});prev=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
    },{snapshot,epoch,light});
    await page.route(/\/src\/game\/(sim|render|pixelfx|item-atlas|art|vfx\/director)\.ts(?:\?.*)?$/,async route=>{
      const res=await route.fetch();let text=await res.text();const path=new URL(route.request().url()).pathname;
      const names=light?[]:path.endsWith('/sim.ts')?['tick']:path.endsWith('/render.ts')?['draw']:path.endsWith('/pixelfx.ts')?['update','drawScreen','drawWarpPass','drawAuras','drawPostNight']:path.endsWith('/director.ts')?['update','sync','onEvent']:[];
      for(const name of names){const target=`export function ${name}(`;if(!text.includes(target))throw Error(`Cannot instrument ${path}:${name}`);
        text=text.replace(target,`function __profile_${name}(`)+`\nexport function ${name}(...a){return window.__timed(${JSON.stringify(path+':'+name)},()=>__profile_${name}(...a));}\n`;
      }
      if(variant==='procedural-cached-ui'&&path.endsWith('/art.ts')){
        const target='g.putImageData(d, 0, 0);';if(!text.includes(target))throw Error('outlineCanvas changed');
        text=text.replace(target,target+' __uiPixels.set(c,d);');
        text+='\nconst __uiPixels=new WeakMap(); export function __profileSpriteURL(c){const p=__uiPixels.get(c);if(!p)return c.toDataURL();const out=document.createElement("canvas");out.width=c.width;out.height=c.height;out.getContext("2d",{willReadFrequently:true}).putImageData(p,0,0);return out.toDataURL();}\n';
      }
      if(variant==='procedural-readback'&&path.endsWith('/art.ts')){
        const target='const g = c.getContext("2d");';if(!text.includes(target))throw Error('Procedural mk changed');
        text=text.replace(target,'const g = c.getContext("2d", {willReadFrequently:true});'); // mk only, NOT the displayed canvas
      }
      if(variant==='eager-atlas-only'&&path.endsWith('/item-atlas.ts')){if(!text.includes('next[key] = c;'))throw Error('Atlas loader changed');text=text.replace('next[key] = c;','urls[key] = c.toDataURL("image/png"); next[key] = c;');}
      await route.fulfill({response:res,body:text});
    });
    if(variant==='procedural-cached-ui')await page.route(/\/src\/ui\/common\.tsx(?:\?.*)?$/,async route=>{
      const res=await route.fetch();let text=await res.text();const target='c.toDataURL()';if(!text.includes(target))throw Error('drawnIconUrl changed');
      if(!text.includes('import { getArt }'))throw Error('getArt import changed');text=text.replace('import { getArt }','import { getArt, __profileSpriteURL }').replace(target,'__profileSpriteURL(c)');await route.fulfill({response:res,body:text});
    });
    const cdp=await ctx.newCDPSession(page);if(!light){await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});}
    const started=Date.now();await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByRole('button',{name:/^Continue/}).waitFor({timeout:120000});const titleMs=Date.now()-started;
    await page.getByRole('button',{name:/^Continue/}).click();await page.waitForTimeout(2500);
    const phases=[];
    for(const phase of ['idle','inventory-first','inventory-repeat']){
      await page.evaluate(phase=>{window.__profile.phase=phase;},phase);if(!light)await cdp.send('Profiler.start');
      const at=Date.now();if(phase!=='idle'){await page.keyboard.press('KeyI');await page.getByRole('button',{name:'Sort Pack',exact:true}).waitFor({timeout:30000});}
      const inputToDOMMs=Date.now()-at;await page.waitForTimeout(4000);
      const {profile}=light?{profile:{nodes:[],samples:[]}}:await cdp.send('Profiler.stop');phases.push({phase,inputToDOMMs,...summarizeCPU(profile)});
      if(phase!=='idle'){await page.keyboard.press('KeyI');await page.waitForTimeout(300);}
    }
    const metrics=await page.evaluate(()=>{
      const p=window.__profile,c=document.createElement('canvas'),gl=c.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');
      const frameStats={};for(const phase of ['idle','inventory-first','inventory-repeat']){const f=p.frames.filter(f=>f.phase===phase).map(f=>f.ms).sort((a,b)=>a-b);frameStats[phase]={count:f.length,p50:f[Math.floor(f.length*.5)],p95:f[Math.floor(f.length*.95)],p99:f[Math.floor(f.length*.99)]};}
      return {timings:p.timings,encodes:p.encodes,longTasks:p.longTasks,frameStats,heapBytes:performance.memory?.usedJSHeapSize,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'};
    });
    const proceduralPixels=await page.evaluate(async()=>{
      const {getArt}=await import('/src/game/art.ts');const images=[];
      function visit(value,path){if(value instanceof HTMLCanvasElement){const data=value.getContext('2d').getImageData(0,0,value.width,value.height).data;let h=2166136261;for(const b of data)h=Math.imul(h^b,16777619);images.push([path,value.width,value.height,(h>>>0).toString(16)]);}else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value))visit(v,`${path}/${key}`);}
      visit(getArt(),'art');return images;
    });
    const cachedUIPixels=variant!=='procedural-cached-ui'?null:await page.evaluate(async()=>{
      const {getArt,__profileSpriteURL}=await import('/src/game/art.ts');let checked=0;const mismatches=[];
      for(const type of ['st','icon'])for(const [key,src]of Object.entries(getArt()[type])){
        const img=new Image();img.src=__profileSpriteURL(src);await img.decode();const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
        const expected=src.getContext('2d').getImageData(0,0,src.width,src.height).data,actual=g.getImageData(0,0,c.width,c.height).data;
        if(!expected.every((b,i)=>b===actual[i]))mismatches.push(`${type}/${key}`);checked++;
      }return {checked,mismatches};
    });
    samples.push({index,variant,titleMs,scene:snapshot.scene,phases,metrics,proceduralPixels,cachedUIPixels,errors,resources});
    await ctx.close();console.log(JSON.stringify({index,variant,titleMs,frames:metrics.frameStats,renderer:metrics.renderer,errors}));
  }
}finally{await browser.close();}
mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});
writeFileSync(out,JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),viewport:[640,360],lightInstrumentation:light,samples,
  limitations:['Dev modules, software ANGLE/SwiftShader if recorded as such; not native/hardware FPS.','Same legitimate seeded snapshot, frozen wall time; idle/inventory only, not combat/Core VFX stress or enjoyment.','CPU samples are exclusive self samples; named timings are inclusive and overlap Canvas calls. Native/GPU asynchronous work is not isolated.','Per-call Canvas timers and CDP add overhead equally to ABBA samples. No uninstrumented hardware baseline; frame times are diagnostic only.','Eager variant reconstructs only historical atlas encoding, not an old complete game/NPC build. No map-size causal conclusion.']},null,2)+'\n');
