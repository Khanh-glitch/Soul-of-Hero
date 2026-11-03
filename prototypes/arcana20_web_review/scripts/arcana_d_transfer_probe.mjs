// Narrow diagnostic: same D19 source raster through the current D world
// transfer. The neutral surface and zero warp isolate transfer only; this is
// deliberately NOT an in-game image, P0 comparison, benchmark, or art test.
// Start the Vite dev server, then run with CHROMIUM_PATH/SOH_URL as needed.
import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.SOH_URL||'http://127.0.0.1:4185/');
 const result=await page.evaluate(async()=>{
  const {DSource}=await import('/src/arcana_d/player.ts'),{DRaster}=await import('/src/arcana_d/raster.ts'),{DWorldGpu}=await import('/src/arcana_d/worldGpu.ts'),{DWarp}=await import('/src/arcana_d/warp.ts');
  const frame=new DSource({x:148,y:172},{x:244,y:132}).renderAtSeconds(8.3);if(!frame)throw Error('missing source frame');
  const raster=new DRaster();raster.render(frame.fields.commands,frame.fields.rendererTime);
  const scene=document.createElement('canvas');scene.width=480;scene.height=270;const g=scene.getContext('2d');g.fillStyle='#404040';g.fillRect(0,0,480,270);
  const gpu=new DWorldGpu(480,270);gpu.render(scene,raster.canvas,frame.fields.commands,new DWarp(),frame.transform,0,0,frame.fields.rendererTime,1);
  const read=c=>{const out=document.createElement('canvas');out.width=480;out.height=270;const g=out.getContext('2d');g.drawImage(c,0,0);return g.getImageData(0,0,480,270).data};
  const raw=read(raster.canvas),world=read(gpu.canvas),sample=(a,x,y)=>Array.from(a.slice((y*480+x)*4,(y*480+x)*4+4));
  return {time:frame.fields.time,transform:frame.transform,background:[64,64,64],centerSource:sample(raw,244,132),centerWorld:sample(world,244,132),controlSource:sample(raw,0,0),controlWorld:sample(world,0,0)};
 });
 assert.deepEqual(errors,[]);assert.deepEqual(Object.values(result.transform).map(v=>v===0?0:v),[1,0,0,1,0,0]);assert(result.centerSource[0]>230,'expected bright source center');assert(result.centerWorld[0]<result.centerSource[0]-30,'expected bounded LDR transfer to reduce the bright center');assert.deepEqual(result.controlWorld,[64,64,64,255]);
 console.log(JSON.stringify({scope:'D19 source-field vs current world transfer; neutral background, warp disabled; not game, P0 parity or performance',...result},null,2));
}finally{await browser.close();}
