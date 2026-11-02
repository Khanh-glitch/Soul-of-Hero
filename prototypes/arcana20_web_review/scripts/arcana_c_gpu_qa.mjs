// Offscreen experimental C GPU-vs-CPU compositor comparison; not P0 parity.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage();await page.goto(process.env.SOH_URL||'http://127.0.0.1:4176/');
const result=await page.evaluate(async()=>{
 const {CSource}=await import('/src/arcana_c/player.ts');const {compositeC}=await import('/src/arcana_c/composite.ts');const {CGpuComposite}=await import('/src/arcana_c/gpu.ts');
 const W=384,H=216,scene=document.createElement('canvas');scene.width=W;scene.height=H;const g=scene.getContext('2d');const image=g.createImageData(W,H);
 for(let i=0;i<image.data.length;i+=4){const p=i/4;image.data[i]=(p*13+37)%256;image.data[i+1]=(p*7+51)%256;image.data[i+2]=(p*3+22)%256;image.data[i+3]=255}g.putImageData(image,0,0);
 const gpu=new CGpuComposite(W,H),out=[];
 for(const [id,t] of [[7,6.62],[10,4.84],[17,6.45]]){
  const f=new CSource(id,{x:105,y:140},{x:255,y:120}).renderAtSeconds(t);const cpu=image.data.slice();compositeC(cpu,W,H,f.frame,f.transform,0,0);gpu.render(scene,f.frame,f.transform,0,0);
  const dst=document.createElement('canvas');dst.width=W;dst.height=H;const dg=dst.getContext('2d');dg.drawImage(gpu.canvas,0,0);const actual=dg.getImageData(0,0,W,H).data;
  let changed=0,sum=0,max=0;for(let i=0;i<cpu.length;i+=4){let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(cpu[i+c]-actual[i+c]));if(d){changed++;sum+=d;max=Math.max(max,d);}}
  out.push({id,t,differingPixels:changed,totalPixels:W*H,maxChannelError:max,meanMaxError:sum/(W*H)});
 }
 return out;
});console.log(JSON.stringify(result,null,2));await browser.close();
// Bounded diagnostic case only, not proof of equality or P0 parity.
for(const row of result)assert(row.maxChannelError<=1, `GPU mismatch for ${row.id}: ${row.maxChannelError}`);
