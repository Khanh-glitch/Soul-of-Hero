// Original full D cast, isolated g ribbon batch with zero camera and neutral base.
// Never used as a SOH background. The GL scene/bloom buffers remain source
// operations on a neutral base, not a live-world/approval comparison.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const html=path.join(root,'prototypes/arcana_fusion20/original_source/package/handoff/reference/Elemental_VFX_Lab_FIXED_Standalone.html');
const out=process.argv[2], coverage=process.argv[3]==='coverage';if(!out)throw Error('output path required');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:900,height:700},deviceScaleFactor:1});
await page.addInitScript((coverage)=>{if(coverage){const original=WebGL2RenderingContext.prototype.shaderSource;WebGL2RenderingContext.prototype.shaderSource=function(shader,source){if(source.includes('in vec4 vCol; in vec4 vM; in vec4 vS;')&&source.includes('frag = vec4(col, vCol.a * a);')){source=source.replace('frag = vec4(col, vCol.a * a);','frag = vec4(1.0, 1.0, 1.0, 1.0);');window.__ribbonCoverageShaderInstrumented=true;}return original.call(this,shader,source);};}let now=0,id=0;const callbacks=new Map();window.requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id};window.cancelAnimationFrame=n=>callbacks.delete(n);Object.defineProperty(performance,'now',{value:()=>now});window.__advance=count=>{for(let i=0;i<count;i++){now+=1000/60;const list=[...callbacks.values()];callbacks.clear();for(const cb of list)cb(now)}}},coverage);
try {
  page.on('pageerror',e=>console.error('PAGEERROR',e.message));
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(()=>window.__vfxDebug||window.__vfxError,null,{timeout:30000});
  const setup=await page.evaluate((coverage)=>{
    if(window.__vfxError)throw Error(window.__vfxError);if(coverage&&!window.__ribbonCoverageShaderInstrumented)throw Error('coverage shader not instrumented');
    const d=window.__vfxDebug,r=d.state.renderer,c=document.getElementById('stage');
    c.style.width='480px';c.style.height='270px';r.resize();
    const quad=r.quad.bind(r);r.quad=p=>{
      if(p===r.floorProg)return;
      quad(p);
      if(window.__capturePass && (p===r.brightProg || p===r.blurProg)) {
        const gl=r.gl, vp=gl.getParameter(gl.VIEWPORT), bytes=new Uint8Array(vp[2]*vp[3]*4);
        gl.readPixels(0,0,vp[2],vp[3],gl.RGBA,gl.UNSIGNED_BYTE,bytes);
        let b='';for(let i=0;i<bytes.length;i+=8192)b+=String.fromCharCode(...bytes.subarray(i,Math.min(i+8192,bytes.length)));
        window.__capturedPasses.push({width:vp[2],height:vp[3],base64:btoa(b)});
      }
    };r.drawMarkers=()=>{};
    const idx=d.ALL.findIndex(s=>s.id===19&&s.name==='Constellation Engine');if(idx<0)throw Error('D19 missing');
    d.cast(idx);d.state.playing=true;d.state.speed=1;
    const pushRibbon=r.fx.g.line.push.bind(r.fx.g.line);
    window.__lineCalls=[];
    r.fx.g.line.push=(pts,width,col,opts)=>{window.__lineCalls.push({pts:[...pts],width,col,opts});return pushRibbon(pts,width,col,opts);};
    r.drawLayerSet=(ls)=>{const gl=r.gl;gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);ls.line.draw([480,270],[0,0],r.time);};
    return {width:c.width,height:c.height,floatOK:r.floatOK,renderer:r.gl.getParameter(r.gl.RENDERER)};
  },coverage);
  if(setup.width!==480||setup.height!==270)throw Error('incorrect source dimensions '+JSON.stringify(setup));
  console.log('D19_ORIGINAL_GL',JSON.stringify(setup));
  const manifest={setup,scope:'source D WebGL RGBA8 scene and bloom targets on neutral base; no floor, actors or SOH world; not HDR',captures:[]};
  let last=0;
  for(const tick of [72,192,312,489,510,528,558,582]) {
    await page.evaluate(n=>{window.__capturePass=false;if(n>1)window.__advance(n-1);window.__capturedPasses=[];window.__lineCalls=[];window.__capturePass=true;window.__advance(1);window.__capturePass=false},tick-last);last=tick;
    const result=await page.evaluate(()=>{
      const r=window.__vfxDebug.state.renderer,gl=r.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER,r.scene.fbo);
      while(gl.getError()!==gl.NO_ERROR){};
      const bytes=new Uint8Array(480*270*4);gl.readPixels(0,0,480,270,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
      const error=gl.getError();if(error!==gl.NO_ERROR)throw Error(`readPixels: ${error}`);
      let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+8192,bytes.length)));
      return {time:window.__vfxDebug.state.t,renderer_time:r.time,vertex_count:r.fx.g.line.n,line_calls:window.__lineCalls,base64:btoa(binary)};
    });
    writeFileSync(path.join(out,`tick${tick}.original${coverage?'.coverage':''}.rgba8`),Buffer.from(result.base64,'base64'));
    writeFileSync(path.join(out,`tick${tick}.original.calls.json`),JSON.stringify(result.line_calls));
    const record={tick,time:result.time,renderer_time:result.renderer_time,vertex_count:result.vertex_count,call_count:result.line_calls.length,coverage};
    manifest.captures.push(record);console.log('D19_CAST_RIBBON_ORIGINAL',JSON.stringify(record));
  }
  writeFileSync(path.join(out,`source_manifest${coverage?'.coverage':''}.json`),JSON.stringify(manifest,null,2));
}finally{await browser.close()}
