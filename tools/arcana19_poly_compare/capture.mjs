// Original D WebGL PolyBatch on neutral geometry inputs. The second pass
// instruments the actual fragment shader *after its authored discard* to write
// white, so coverage is not inferred from brightness. No fake SOH battlefield.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=process.argv[2];if(!out)throw Error('output path required');mkdirSync(out,{recursive:true});
const cases=JSON.parse(readFileSync('tools/arcana19_poly_compare/cases.json','utf8'));
const html=path.resolve('prototypes/arcana_fusion20/original_source/package/handoff/reference/Elemental_VFX_Lab_FIXED_Standalone.html');
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 for(const coverage of [false,true]) {
  const page=await browser.newPage({viewport:{width:900,height:700},deviceScaleFactor:1});
  await page.addInitScript(({coverage})=>{
   window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};
   if(coverage){
    const original=WebGL2RenderingContext.prototype.shaderSource;
    WebGL2RenderingContext.prototype.shaderSource=function(shader,source){
     if(source.includes('in vec4 vCol; in vec4 vE;') && source.includes('frag = vec4(col, vCol.a * edge);')){
      source=source.replace('frag = vec4(col, vCol.a * edge);','frag = vec4(1.0, 1.0, 1.0, 1.0);');
      window.__polyCoverageShaderInstrumented=true;
     }
     return original.call(this,shader,source);
    };
   }
  },{coverage});
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(()=>window.__vfxDebug||window.__vfxError,null,{timeout:30000});
  for(const c of cases){
   const result=await page.evaluate(({c,coverage})=>{
    if(window.__vfxError)throw Error(window.__vfxError);
    if(coverage&&!window.__polyCoverageShaderInstrumented)throw Error('poly fragment coverage instrumentation not installed');
    const r=window.__vfxDebug.state.renderer,gl=r.gl;
    r.scene.bind(true);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    r.fx.g.poly.reset();r.fx.g.poly.pushQuad(c.pts,c.color,c.opts);r.fx.g.poly.draw([480,270],[0,0],c.time);
    const pixels=new Uint8Array(480*270*4);gl.readPixels(0,0,480,270,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const error=gl.getError();if(error!==gl.NO_ERROR)throw Error(`WebGL error ${error}`);
    let binary='';for(let i=0;i<pixels.length;i+=8192)binary+=String.fromCharCode(...pixels.subarray(i,Math.min(i+8192,pixels.length)));
    return btoa(binary);
   },{c,coverage});
   writeFileSync(path.join(out,`${c.name}.original${coverage?'.coverage':''}.rgba8`),Buffer.from(result,'base64'));
   console.log('D19_POLY_ORIGINAL_CAPTURE',c.name,coverage?'instrumented-coverage':'color');
  }
  await page.close();
 }
}finally{await browser.close()}
