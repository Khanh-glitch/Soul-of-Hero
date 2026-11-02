/** Diagnostic preview of only three source-B effects. Deliberately disabled
 * unless explicitly enabled on a Vite dev server. NOT a delivery mode. */
import { BSource,type BId } from './player';
import { arcanaLabEnabled } from '../game/previewFlags';
import { compositeB } from './composite';
import { worldRect } from './worldRect';
import { BGpuComposite } from './gpu';
export const bDiagnosticEnabled = arcanaLabEnabled;
type Active={source:BSource;runId:string;startMs:number;tick:number;frame:ReturnType<BSource['renderAtSeconds']>};
const active:Active[]=[];
const gpuRequested=bDiagnosticEnabled && new URLSearchParams(location.search).get('arcanaGpu')==='1';
let gpu:BGpuComposite|null=null;let gpuFailed=false;
export const bDiagnosticTimings:{id:BId;sourceMs:number;compositeMs:number}[]=[];
if (bDiagnosticEnabled) (window as any).__arcanaBDiagnosticTimings=bDiagnosticTimings;
export function startBDiagnostic(e:any) {
  if(!bDiagnosticEnabled || ![2,3,8].includes(e.id))return;
  const dx=e.aimX-e.x,dy=e.aimY-e.y,reach=Math.max(35,Math.min(130,Math.hypot(dx,dy)));
  const caster={x:e.x,y:e.y},target={x:e.x+Math.cos(e.a)*reach,y:e.y+Math.sin(e.a)*reach};
  active.push({source:new BSource(e.id as BId,caster,target),runId:e.runId,startMs:e.simMs,tick:-1,frame:null});
}
export function drawBDiagnostic(g:CanvasRenderingContext2D,runId:string,simMs:number,cx:number,cy:number) {
  if(!bDiagnosticEnabled || !active.length)return;
  for(let i=active.length-1;i>=0;i--){const a=active[i],seconds=(simMs-a.startMs)/1000;if(a.runId!==runId||seconds>=a.source.duration){active.splice(i,1);continue;}
    const tick=Math.floor(seconds*60+1e-8);let sourceMs=0;
    if(tick!==a.tick){const start=performance.now();a.frame=a.source.renderAtSeconds(seconds);sourceMs=performance.now()-start;a.tick=tick;}
    if(!a.frame)continue;
    const start=performance.now();
    if(gpuRequested&&!gpuFailed){
      try { if(!gpu)gpu=new BGpuComposite(g.canvas.width,g.canvas.height);gpu.render(g.canvas,a.frame.r,a.frame.transform,cx,cy);
        g.save();g.setTransform(1,0,0,1,0,0);g.drawImage(gpu.canvas,0,0);g.restore();
      } catch(e) {gpuFailed=true;console.warn('Experimental GPU B pass failed; falling back to CPU',e);}
    }
    if(!gpuRequested||gpuFailed){const box=worldRect(a.frame.transform,cx,cy,g.canvas.width,g.canvas.height);if(!box.w||!box.h)continue;
      const image=g.getImageData(box.x,box.y,box.w,box.h);
      compositeB(image.data,image.width,image.height,a.frame.r,a.frame.transform,cx+box.x,cy+box.y);g.putImageData(image,box.x,box.y);
    }
    if(bDiagnosticTimings.length<1200)bDiagnosticTimings.push({id:a.source.id,sourceMs,compositeMs:performance.now()-start});
  }
}
