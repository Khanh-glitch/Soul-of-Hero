// Original D GPU intermediates, excluding source Gold floor + fake markers.
// Never used as a SOH background. The GL scene/bloom buffers remain source
// operations on a neutral base, not a live-world/approval comparison.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const html=path.join(root,'prototypes/arcana_fusion20/original_source/package/handoff/reference/Elemental_VFX_Lab_FIXED_Standalone.html');
const out=process.argv[2];if(!out)throw Error('output path required');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:900,height:700},deviceScaleFactor:1});
await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map();window.requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id};window.cancelAnimationFrame=n=>callbacks.delete(n);Object.defineProperty(performance,'now',{value:()=>now});window.__advance=count=>{for(let i=0;i<count;i++){now+=1000/60;const list=[...callbacks.values()];callbacks.clear();for(const cb of list)cb(now)}}});
try {
  page.on('pageerror',e=>console.error('PAGEERROR',e.message));
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(()=>window.__vfxDebug||window.__vfxError,null,{timeout:30000});
  const setup=await page.evaluate(()=>{
    if(window.__vfxError)throw Error(window.__vfxError);
    const d=window.__vfxDebug,r=d.state.renderer,c=document.getElementById('stage');
    c.style.width='480px';c.style.height='270px';r.resize();
    const quad=r.quad.bind(r);r.quad=p=>{if(p!==r.floorProg)quad(p)};r.drawMarkers=()=>{};
    const idx=d.ALL.findIndex(s=>s.id===19&&s.name==='Constellation Engine');if(idx<0)throw Error('D19 missing');
    d.cast(idx);d.state.playing=true;d.state.speed=1;
    return {width:c.width,height:c.height,floatOK:r.floatOK,renderer:r.gl.getParameter(r.gl.RENDERER)};
  });
  if(setup.width!==480||setup.height!==270)throw Error('incorrect source dimensions '+JSON.stringify(setup));
  console.log('D19_ORIGINAL_GL',JSON.stringify(setup));
  const manifest={setup,scope:'source D WebGL RGBA8 scene and bloom targets on neutral base; no floor, actors or SOH world; not HDR',captures:[]};
  let last=0;
  for(const tick of [72,192,312,489,510]) {
    await page.evaluate(n=>window.__advance(n),tick-last);last=tick;
    const result=await page.evaluate(()=>{
      const r=window.__vfxDebug.state.renderer,gl=r.gl, result={time:window.__vfxDebug.state.t,buffers:{}};
      for(const name of ['scene','bloomSmall','bloom2']) {
        const target=r[name];gl.bindFramebuffer(gl.FRAMEBUFFER,target.fbo);
        while(gl.getError()!==gl.NO_ERROR){};
        // The original HTML allocates scene and bloom targets as RGBA8,
        // even when its warp targets support RGBA16F. Preserve source format.
        const bytes=new Uint8Array(target.w*target.h*4);
        gl.readPixels(0,0,target.w,target.h,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
        const error=gl.getError();if(error!==gl.NO_ERROR)throw Error(`readPixels ${name} RGBA8 failed: ${error}`);
        let binary='';
        for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+8192,bytes.length)));
        result.buffers[name]={width:target.w,height:target.h,base64:btoa(binary)};
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);return result;
    });
    const record={tick,time:result.time,buffers:{}};
    for(const [name,v] of Object.entries(result.buffers)) {
      writeFileSync(path.join(out,`original_${tick}.${name}.rgba8`),Buffer.from(v.base64,'base64'));
      record.buffers[name]={width:v.width,height:v.height};
    }
    manifest.captures.push(record);console.log('D19_SOURCE_PASS',JSON.stringify(record));
  }
  writeFileSync(path.join(out,'source_manifest.json'),JSON.stringify(manifest,null,2));
}finally{await browser.close()}
