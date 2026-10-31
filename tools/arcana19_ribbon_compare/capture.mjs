// Original D WebGL RibbonBatch on neutral transparent geometry test inputs.
// This is a source-primitive diagnostic, never an SOH scene or approval.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=process.argv[2];if(!out)throw Error('output path required');mkdirSync(out,{recursive:true});
const cases=JSON.parse(readFileSync('tools/arcana19_ribbon_compare/cases.json','utf8'));
const html=path.resolve('prototypes/arcana_fusion20/original_source/package/handoff/reference/Elemental_VFX_Lab_FIXED_Standalone.html');
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:900,height:700},deviceScaleFactor:1});
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{}});
 await page.goto(pathToFileURL(html).href);
 await page.waitForFunction(()=>window.__vfxDebug||window.__vfxError,null,{timeout:30000});
 for(const c of cases){
  const result=await page.evaluate(c=>{
   if(window.__vfxError)throw Error(window.__vfxError);
   const r=window.__vfxDebug.state.renderer,gl=r.gl;
   r.scene.bind(true);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
   r.fx.g.line.reset();r.fx.g.line.push(c.pts,c.width,c.color,c.opts);r.fx.g.line.draw([480,270],[0,0],c.time);
   const pixels=new Uint8Array(480*270*4);gl.readPixels(0,0,480,270,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   const error=gl.getError();if(error!==gl.NO_ERROR)throw Error(`WebGL error ${error}`);
   let binary='';for(let i=0;i<pixels.length;i+=8192)binary+=String.fromCharCode(...pixels.subarray(i,Math.min(i+8192,pixels.length)));
   return btoa(binary);
  },c);
  writeFileSync(path.join(out,`${c.name}.original.rgba8`),Buffer.from(result,'base64'));
  console.log('D19_RIBBON_ORIGINAL_CAPTURE',c.name);
 }
}finally{await browser.close()}
